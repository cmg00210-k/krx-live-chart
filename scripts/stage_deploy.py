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
         data/backtest/results/
  Files: *.py  *.bat  *.md  *.ndjson  *.csv  *.txt
         data/backtest/raw_results.ndjson  (819 MB -- over 25 MB limit)
         data/backtest/batch_log.txt

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
    # czw/ removed — calibration data moved to data/backtest/
    os.path.join("data", "backtest", "results"),
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
}

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

    print("Files staged : {:,}".format(linked))
    print("Files skipped: {:,}".format(skipped))
    if errors:
        print("Errors       : {}".format(errors))

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
