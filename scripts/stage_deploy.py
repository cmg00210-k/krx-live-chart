"""
stage_deploy.py  --  Build a deploy/ staging directory for Cloudflare Pages.

Strategy: hard-link every deployable file into deploy/ (zero disk cost on same
drive).  Then run:
  wrangler pages deploy deploy/ ...

Why hard-links, not copies:
  - data/ is ~960 MB; copying it wastes time and disk every run.
  - Hard-links on Windows NTFS are instant and take no extra space.
  - The deploy/ tree is re-created fresh each run so stale files never linger.

Files EXCLUDED from deploy/:
  Dirs : scripts/ core_data/ pattern_impl/ docs/ server/ .claude/ .git/
         data/backtest/results/  data/delisted/ (308 files, Python-only)
  Files: *.py  *.bat  *.md  *.ndjson  *.csv  *.txt
         data/backtest/raw_results.ndjson  (819 MB -- over 25 MB limit)
         data/backtest/batch_log.txt
         data/derivatives/{futures,options,etf}_daily.json  (Python compute-only)
         data/derivatives/options_latest.json  (Python compute-only)
         data/delisted_index.json  (backtest scripts only)

Files INCLUDED despite extension rules:
  data/backtest/rl_policy.json    -- backtester.js fetches this at runtime
  data/backtest/wr_5year.json     -- backtester.js fetches this at runtime
  data/backtest/rl_*.json         -- kept; small RL artefacts used by app

Default timeframe exclusions: _1m, _15m, _30m (client resamples from 5m).
Additional exclusion via --exclude-tf flag or STAGE_EXCLUDE_TF env var:
  --exclude-tf 1h         also exclude _1h.json files (~2,850 files saved)
  STAGE_EXCLUDE_TF=1h python scripts/stage_deploy.py

Exit codes: 0 = OK, 1 = error
"""

import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import shutil
import argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPLOY_DIR = os.path.join(ROOT, "deploy")

# ---------------------------------------------------------------------------
# Thresholds for early-warning system
# ---------------------------------------------------------------------------
WARN_THRESHOLD = 18000     # yellow: review exclusions
CRITICAL_THRESHOLD = 19500  # red: immediate action needed

# ---------------------------------------------------------------------------
# Exclusion rules
# ---------------------------------------------------------------------------
EXCLUDE_DIRS = {
    "scripts", "core_data", "pattern_impl", "docs", "server",
    ".claude", ".git", "deploy", "logs",  # never recurse into deploy/ itself
    "node_modules",  # [P0-fix] 1,489 files leaked to production — dev-only
    # czw/ removed — calibration data moved to data/backtest/
    os.path.join("data", "backtest", "results"),
    os.path.join("data", "delisted"),  # 308 files, only used by Python backtest scripts
}

EXCLUDE_EXTENSIONS = {".py", ".bat", ".md", ".ndjson", ".csv"}

# Filename suffix patterns to exclude (checked after extension).
# _1m.json is always excluded (2,400+ files, not served to production).
# Additional timeframes can be added at runtime via --exclude-tf or STAGE_EXCLUDE_TF.
_BASE_EXCLUDE_SUFFIX_PATTERNS = [
    "_1m.json",   # 1 min bars (2,400+ files) -- not needed for Cloudflare static deploy
    "_15m.json",  # 15 min bars -- client resamples from 5m (3-bar merge)
    "_30m.json",  # 30 min bars -- client resamples from 5m (6-bar merge)
]

# Exact relative paths (from ROOT) that are always excluded regardless of ext.
# Use OS-native sep so comparisons work on both Windows and Unix.
EXCLUDE_EXACT = {
    ".env",                        # NEVER deploy -- contains DART_API_KEY
    # [V48-SEC Phase 3] Wrangler local-dev secrets. CHEESESTOCK_HMAC_SECRET,
    # session master key, KV dev bindings. Production secrets are set via
    # `wrangler secret put` (Cloudflare-side, never in bundle) -- this entry
    # ensures a local .dev.vars never hard-links into deploy/.
    ".dev.vars",
    # .cfignore removed (wrangler ignores it; stage_deploy.py is the sole gatekeeper)
    ".vercelignore",               # leftover from old Vercel setup
    "vercel.json",                 # leftover from old Vercel setup
    "package.json",                # dev tooling config (wrangler pinning)
    "package-lock.json",           # npm lockfile
    ".nvmrc",                      # Node version manager config
    os.path.join("data", "backtest", "raw_results.ndjson"),
    os.path.join("data", "backtest", "batch_log.txt"),
    os.path.join("data", "backtest", "wr_5year.txt"),
    os.path.join("data", "historical_mcap.json"),  # 13MB, unused by JS runtime
    # History/timeseries files -- only consumed by Python compute scripts, not JS runtime
    os.path.join("data", "macro", "bonds_history.json"),
    os.path.join("data", "macro", "kosis_history.json"),
    os.path.join("data", "macro", "macro_history.json"),
    # Compute-only metadata -- Python scripts only, not fetched by JS
    os.path.join("data", ".dart_corp_codes.json"),   # DART corp code cache (372KB)
    os.path.join("data", "api_health.json"),          # krx_probe health check output
    # Derivatives daily/raw files -- only consumed by Python compute scripts
    # (JS fetches *_summary.json and options_analytics.json, not these)
    os.path.join("data", "derivatives", "futures_daily.json"),
    os.path.join("data", "derivatives", "options_daily.json"),
    os.path.join("data", "derivatives", "options_latest.json"),
    os.path.join("data", "derivatives", "etf_daily.json"),
    # Delisted stock index -- only used by backtest_runner.js and Python scripts
    os.path.join("data", "delisted_index.json"),
    # Dead output -- compute_krx_anomalies.py writes it but no JS consumer fetches it
    os.path.join("data", "backtest", "krx_anomalies.json"),
    # [V48-SEC Phase 1] Distilled IP JSONs -- excluded from static hosting.
    # Four runtime-fetched files are relocated to deploy/functions/_data/ and
    # served via Pages Functions /api/* with Origin gating.
    # composite_calibration.json is offline-only (constants baked into signalEngine.js).
    os.path.join("data", "backtest", "calibrated_constants.json"),
    os.path.join("data", "backtest", "composite_calibration.json"),
    os.path.join("data", "backtest", "flow_signals.json"),
    os.path.join("data", "backtest", "hmm_regimes.json"),
    os.path.join("data", "backtest", "eva_scores.json"),
}

# [V48-SEC Phase 1] IP-protected JSONs served via Pages Functions.
# These are copied to deploy/functions/_data/ after staging so Pages Functions
# can import them via ES module JSON import. They are NOT served as static assets.
SEC_PROTECTED_JSONS = [
    os.path.join("data", "backtest", "calibrated_constants.json"),
    os.path.join("data", "backtest", "flow_signals.json"),
    os.path.join("data", "backtest", "hmm_regimes.json"),
    os.path.join("data", "backtest", "eva_scores.json"),
]

# ---------------------------------------------------------------------------


def rel(path):
    """Relative path from ROOT, using OS separator."""
    return os.path.relpath(path, ROOT)


def build_exclude_suffix_patterns(extra_tfs):
    """
    Combine base suffix patterns with any extra timeframes requested.
    extra_tfs: list of strings like ['15m', '30m']
    Returns the full list of suffix patterns to exclude.
    """
    patterns = list(_BASE_EXCLUDE_SUFFIX_PATTERNS)
    for tf in extra_tfs:
        pat = "_{}.json".format(tf)
        if pat not in patterns:
            patterns.append(pat)
    return patterns


def should_exclude(relpath, exclude_suffix_patterns):
    parts = relpath.split(os.sep)

    # Exclude top-level dirs
    if parts[0] in EXCLUDE_DIRS:
        return True

    # Exclude data/backtest/results/ subtree
    if (len(parts) >= 3 and parts[0] == "data"
            and parts[1] == "backtest" and parts[2] == "results"):
        return True

    # Exact exclusions
    if relpath in EXCLUDE_EXACT:
        return True

    # Extension exclusions
    _, ext = os.path.splitext(relpath)
    if ext.lower() in EXCLUDE_EXTENSIONS:
        return True

    # Suffix pattern exclusions (e.g. _1m.json, _15m.json)
    fname = os.path.basename(relpath)
    for pat in exclude_suffix_patterns:
        if fname.endswith(pat):
            return True

    return False


def stage(dry_run=False, verbose=False, exclude_suffix_patterns=None):
    if exclude_suffix_patterns is None:
        exclude_suffix_patterns = _BASE_EXCLUDE_SUFFIX_PATTERNS

    # Wipe and recreate deploy/ (skip in dry-run mode)
    if not dry_run:
        if os.path.exists(DEPLOY_DIR):
            shutil.rmtree(DEPLOY_DIR)
        os.makedirs(DEPLOY_DIR)

    linked = 0
    skipped = 0
    errors = 0

    # Per-category counters for breakdown report
    buckets = {}

    for dirpath, dirnames, filenames in os.walk(ROOT):
        # Prune excluded directories in-place so os.walk won't descend.
        # Hidden dirs (e.g. .git, .claude) are excluded by being listed in
        # EXCLUDE_DIRS -- we do NOT blanket-exclude all dot-dirs so that
        # dotfiles at root level (e.g. .gitignore) still appear in filenames
        # and can be individually included or skipped.
        reldirpath = rel(dirpath)
        pruned = []
        for d in dirnames:
            subdirrel = os.path.join(reldirpath, d) if reldirpath != "." else d
            if subdirrel in EXCLUDE_DIRS:
                pass  # skip this subtree
            else:
                pruned.append(d)
        dirnames[:] = pruned

        for fname in filenames:
            src = os.path.join(dirpath, fname)
            relpath = rel(src)

            if should_exclude(relpath, exclude_suffix_patterns):
                skipped += 1
                if verbose:
                    print("  SKIP  {}".format(relpath))
                continue

            # Bucket accounting for breakdown report.
            # Files sitting directly in data/ (e.g. data/005930.json, data/index.json)
            # are grouped as "data/(root)" to keep the table readable.
            parts = relpath.split(os.sep)
            if parts[0] == "data" and len(parts) >= 3:
                # e.g. data/kospi/005930_5m.json -> "data/kospi"
                bucket = "data/{}".format(parts[1])
            elif parts[0] == "data":
                # direct children of data/: index.json, sector_fundamentals.json, etc.
                bucket = "data/(root)"
            else:
                bucket = "other"
            buckets[bucket] = buckets.get(bucket, 0) + 1

            dst = os.path.join(DEPLOY_DIR, relpath)
            dst_dir = os.path.dirname(dst)

            if not dry_run:
                os.makedirs(dst_dir, exist_ok=True)
                try:
                    os.link(src, dst)
                    linked += 1
                except (OSError, NotImplementedError):
                    # Cross-device or filesystem doesn't support hard links --
                    # fall back to copy (slower but correct)
                    shutil.copy2(src, dst)
                    linked += 1
            else:
                linked += 1

            if verbose:
                print("  LINK  {}".format(relpath))

    return linked, skipped, errors, buckets


def print_breakdown(buckets, limit):
    """Print a per-category breakdown table."""
    print()
    print("  Category breakdown:")
    print("  {:<22}  {:>7}  {:>10}".format("Category", "Files", "% of limit"))
    print("  {}  {}  {}".format("-" * 22, "-" * 7, "-" * 10))
    for cat in sorted(buckets):
        pct = buckets[cat] / limit * 100
        print("  {:<22}  {:>7,}  {:>9.1f}%".format(cat, buckets[cat], pct))
    total = sum(buckets.values())
    print("  {}  {}  {}".format("-" * 22, "-" * 7, "-" * 10))
    print("  {:<22}  {:>7,}  {:>9.1f}%".format("TOTAL", total, total / limit * 100))


def main():
    parser = argparse.ArgumentParser(
        description="Stage deploy/ directory for Cloudflare Pages"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Count files without creating deploy/"
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Print each file decision"
    )
    parser.add_argument(
        "--limit", type=int, default=20000,
        help="Cloudflare Pages file limit (default 20000)"
    )
    parser.add_argument(
        "--exclude-tf", default="",
        help=(
            "Comma-separated timeframes to exclude, e.g. '15m,30m'. "
            "Also reads STAGE_EXCLUDE_TF env var (CLI flag takes precedence)."
        )
    )
    parser.add_argument(
        "--breakdown", action="store_true",
        help="Print per-category file count breakdown (always on in --dry-run)"
    )
    parser.add_argument(
        "--bundled", action="store_true",
        help=(
            "Merge deploy.bundled/ (produced by scripts/build.mjs) into deploy/ "
            "after staging: replaces index.html, sw.js, analysisWorker.js and "
            "drops the 19 raw js/*.js files in favor of js/app.<hash>.js + "
            "js/worker.<hash>.js. Requires 'npm run build:prod' to have run first."
        )
    )
    args = parser.parse_args()

    # Resolve extra timeframe exclusions: CLI flag > env var
    raw_tf = args.exclude_tf.strip()
    if not raw_tf:
        raw_tf = os.environ.get("STAGE_EXCLUDE_TF", "").strip()
    extra_tfs = [t.strip() for t in raw_tf.split(",") if t.strip()] if raw_tf else []

    exclude_suffix_patterns = build_exclude_suffix_patterns(extra_tfs)

    print("CheeseStock -- Staging deploy/ directory")
    print("ROOT:   {}".format(ROOT))
    print("DEPLOY: {}".format(DEPLOY_DIR))
    if extra_tfs:
        excl_display = ", ".join("_{}.json".format(t) for t in extra_tfs)
        print("Extra timeframe exclusions: {}".format(excl_display))
    print()

    linked, skipped, errors, buckets = stage(
        dry_run=args.dry_run,
        verbose=args.verbose,
        exclude_suffix_patterns=exclude_suffix_patterns,
    )

    # [V48-SEC Phase 1] Copy IP-protected JSONs into deploy/functions/_data/
    # AND into SOURCE functions/_data/. Wrangler (both pages dev and pages deploy)
    # resolves `import ... from '../_data/*.json'` in Pages Functions relative to
    # the SOURCE functions/ directory, NOT deploy/functions/. So source copies
    # are required for wrangler to bundle the Functions successfully.
    # .gitignore excludes functions/_data/*.json so these never enter git.
    # Raw data/backtest/*.json paths stay excluded above (EXCLUDE_EXACT), so
    # these files reach the edge only via the /api/* Origin-gated endpoints.
    if not args.dry_run:
        fn_data_dir = os.path.join(DEPLOY_DIR, "functions", "_data")
        src_fn_data_dir = os.path.join(ROOT, "functions", "_data")
        os.makedirs(fn_data_dir, exist_ok=True)
        os.makedirs(src_fn_data_dir, exist_ok=True)
        sec_copied = 0
        sec_missing = []
        for rel_src in SEC_PROTECTED_JSONS:
            src = os.path.join(ROOT, rel_src)
            dst = os.path.join(fn_data_dir, os.path.basename(rel_src))
            src_dst = os.path.join(src_fn_data_dir, os.path.basename(rel_src))
            if not os.path.exists(src):
                sec_missing.append(rel_src)
                continue
            # Copy to deploy/functions/_data/ (hard link OK — served by bundler)
            try:
                os.link(src, dst)
            except (OSError, NotImplementedError):
                shutil.copy2(src, dst)
            # Copy to source functions/_data/ (required by wrangler bundler)
            if not os.path.exists(src_dst):
                try:
                    os.link(src, src_dst)
                except (OSError, NotImplementedError):
                    shutil.copy2(src, src_dst)
            sec_copied += 1
            linked += 1
        if sec_missing:
            print()
            print("WARNING: {} IP-protected JSON(s) missing from source tree:".format(
                len(sec_missing)))
            for f in sec_missing:
                print("  MISSING: {}".format(f))
            print("  /api/* Pages Functions will 500 until these are generated.")
        else:
            print("IP-protected JSONs: {} copied to deploy/functions/_data/".format(sec_copied))

    # [V48-SEC Phase 1] --bundled: merge deploy.bundled/ into deploy/.
    # Replaces index.html, sw.js, analysisWorker.js; drops 19 raw JS files.
    if args.bundled and not args.dry_run:
        bundled_dir = os.path.join(ROOT, "deploy.bundled")
        if not os.path.exists(bundled_dir):
            print()
            print("ERROR: --bundled requested but deploy.bundled/ is missing.")
            print("Run 'node scripts/build.mjs --minify --obfuscate' first.")
            sys.exit(1)

        # Raw JS files to remove from deploy/js/ (superseded by bundle).
        # Keep analysisWorker.js + screenerWorker.js (workers need them by name).
        RAW_JS_REPLACED = [
            "colors.js", "data.js", "api.js", "realtimeProvider.js",
            "indicators.js", "patterns.js", "signalEngine.js", "chart.js",
            "patternRenderer.js", "signalRenderer.js", "backtester.js",
            "sidebar.js", "patternPanel.js", "financials.js",
            "drawingTools.js", "appState.js", "appWorker.js", "appUI.js",
            "app.js", "_entry.js",
        ]
        dropped = 0
        for f in RAW_JS_REPLACED:
            p = os.path.join(DEPLOY_DIR, "js", f)
            if os.path.exists(p):
                os.remove(p)
                dropped += 1
                linked -= 1

        # Overlay deploy.bundled/ onto deploy/. For each file in bundled dir,
        # overwrite (or create) the matching path in deploy/.
        overlaid = 0
        for dirpath, _, filenames in os.walk(bundled_dir):
            for fn in filenames:
                src = os.path.join(dirpath, fn)
                rel = os.path.relpath(src, bundled_dir)
                dst = os.path.join(DEPLOY_DIR, rel)
                os.makedirs(os.path.dirname(dst) or DEPLOY_DIR, exist_ok=True)
                if os.path.exists(dst):
                    os.remove(dst)
                else:
                    linked += 1
                try:
                    os.link(src, dst)
                except (OSError, NotImplementedError):
                    shutil.copy2(src, dst)
                overlaid += 1
        print("Bundled merge: dropped {} raw JS files, overlaid {} bundle files".format(
            dropped, overlaid))

    print("Files staged : {:,}".format(linked))
    print("Files skipped: {:,}".format(skipped))
    if errors:
        print("Errors       : {}".format(errors))

    # Post-stage: verify critical files are present in deploy/
    if not args.dry_run:
        # [V6-FIX] P2-3: Complete list of all 19 load-order JS files + 2 Workers + assets
        # [V48-SEC] In --bundled mode, the 19 raw JS are replaced by one bundle.
        CRITICAL_FILES = [
            "index.html", "sw.js", "_headers", "favicon.svg",
            os.path.join("css", "style.css"),
            # Web Workers (always present — analysisWorker may be rewritten in bundled mode)
            os.path.join("js", "analysisWorker.js"),
            os.path.join("js", "screenerWorker.js"),
            # CDN fallback library
            os.path.join("lib", "lightweight-charts.standalone.production.js"),
            # [V48-SEC Phase 1] Pages Functions + bundled IP JSONs
            os.path.join("functions", "_shared", "origin.js"),
            os.path.join("functions", "api", "constants.js"),
            os.path.join("functions", "api", "flow.js"),
            os.path.join("functions", "api", "hmm.js"),
            os.path.join("functions", "api", "eva.js"),
            os.path.join("functions", "_data", "calibrated_constants.json"),
            os.path.join("functions", "_data", "flow_signals.json"),
            os.path.join("functions", "_data", "hmm_regimes.json"),
            os.path.join("functions", "_data", "eva_scores.json"),
        ]
        if args.bundled:
            # In bundled mode, require at least one app.*.js and worker.*.js
            # hash-named bundle to exist. Exact hashes change per build.
            bundled_js_dir = os.path.join(DEPLOY_DIR, "js")
            if os.path.exists(bundled_js_dir):
                js_files = os.listdir(bundled_js_dir)
                has_app = any(f.startswith("app.") and f.endswith(".js") for f in js_files)
                has_worker = any(f.startswith("worker.") and f.endswith(".js") for f in js_files)
                if not has_app:
                    print("CRITICAL: --bundled but deploy/js/app.<hash>.js missing")
                    errors += 1
                if not has_worker:
                    print("CRITICAL: --bundled but deploy/js/worker.<hash>.js missing")
                    errors += 1
        else:
            # Non-bundled mode — require all 19 raw JS files.
            CRITICAL_FILES += [
                os.path.join("js", "colors.js"),
                os.path.join("js", "data.js"),
                os.path.join("js", "api.js"),
                os.path.join("js", "realtimeProvider.js"),
                os.path.join("js", "indicators.js"),
                os.path.join("js", "patterns.js"),
                os.path.join("js", "signalEngine.js"),
                os.path.join("js", "chart.js"),
                os.path.join("js", "patternRenderer.js"),
                os.path.join("js", "signalRenderer.js"),
                os.path.join("js", "backtester.js"),
                os.path.join("js", "sidebar.js"),
                os.path.join("js", "patternPanel.js"),
                os.path.join("js", "financials.js"),
                os.path.join("js", "drawingTools.js"),
                os.path.join("js", "appState.js"),
                os.path.join("js", "appWorker.js"),
                os.path.join("js", "appUI.js"),
                os.path.join("js", "app.js"),
            ]
        missing_critical = []
        for f in CRITICAL_FILES:
            if not os.path.exists(os.path.join(DEPLOY_DIR, f)):
                missing_critical.append(f)
        if missing_critical:
            print()
            print("CRITICAL: {} mission-critical file(s) missing from deploy/:".format(
                len(missing_critical)))
            for f in missing_critical:
                print("  MISSING: {}".format(f))
            errors += len(missing_critical)
        else:
            print("Critical files: all {} present in deploy/".format(len(CRITICAL_FILES)))

    # Always print breakdown in dry-run mode; optionally in live mode
    if args.dry_run or args.breakdown:
        print_breakdown(buckets, args.limit)

    print()
    margin = args.limit - linked

    if linked > args.limit:
        print(
            "ERROR: {:,} files exceeds Cloudflare Pages limit of {:,}".format(
                linked, args.limit
            )
        )
        print("Remove more timeframes from the staging set:")
        print("  python scripts/stage_deploy.py --dry-run --exclude-tf 15m")
        print("  python scripts/stage_deploy.py --dry-run --exclude-tf 15m,30m")
        sys.exit(1)

    elif linked >= CRITICAL_THRESHOLD:
        print(
            "CRITICAL WARNING: {:,} files -- only {:,} remaining "
            "(threshold {:,}).".format(linked, margin, CRITICAL_THRESHOLD)
        )
        print("Consider excluding additional timeframes before next data expansion:")
        print("  python scripts/stage_deploy.py --dry-run --exclude-tf 15m")

    elif linked >= WARN_THRESHOLD:
        print(
            "WARNING: {:,} files -- {:,} headroom remaining "
            "(warn threshold {:,}).".format(linked, margin, WARN_THRESHOLD)
        )
        print("Monitor closely; ~1-2 years of stock additions remain before limit.")

    else:
        print(
            "OK: {:,} files -- {:,} headroom under the {:,} limit.".format(
                linked, margin, args.limit
            )
        )

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
