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
         CLAUDE.md  (already caught by *.md)

Files INCLUDED despite extension rules:
  data/backtest/rl_policy.json    -- backtester.js fetches this at runtime
  data/backtest/wr_5year.json     -- backtester.js fetches this at runtime
  data/backtest/rl_*.json         -- kept; small RL artefacts used by app

Exit codes: 0 = OK, 1 = error
"""

import os
import sys
import shutil
import argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPLOY_DIR = os.path.join(ROOT, "deploy")

# ---------------------------------------------------------------------------
# Exclusion rules
# ---------------------------------------------------------------------------
EXCLUDE_DIRS = {
    "scripts", "core_data", "pattern_impl", "docs", "server",
    ".claude", ".git", "deploy",  # never recurse into deploy/ itself
    "czw",                         # research/dev directory, not needed at runtime
    os.path.join("data", "backtest", "results"),
}

EXCLUDE_EXTENSIONS = {".py", ".bat", ".md", ".ndjson", ".csv"}

# Filename suffix patterns to exclude (checked after extension)
EXCLUDE_SUFFIX_PATTERNS = [
    "_1m.json",   # 1분봉 (2,400+ files) — not needed for Cloudflare static deploy
]

# Exact relative paths (from ROOT) that are always excluded regardless of ext.
# Use OS-native sep so comparisons work on both Windows and Unix.
EXCLUDE_EXACT = {
    ".env",                        # NEVER deploy -- contains DART_API_KEY
    ".cfignore",                   # deploy tooling artifact, not app code
    ".vercelignore",               # leftover from old Vercel setup
    "vercel.json",                 # leftover from old Vercel setup
    os.path.join("data", "backtest", "raw_results.ndjson"),
    os.path.join("data", "backtest", "batch_log.txt"),
    os.path.join("data", "backtest", "wr_5year.txt"),
}

# ---------------------------------------------------------------------------

def rel(path):
    """Relative path from ROOT, using OS separator."""
    return os.path.relpath(path, ROOT)


def should_exclude(relpath):
    parts = relpath.split(os.sep)

    # Exclude top-level dirs
    if parts[0] in EXCLUDE_DIRS:
        return True

    # Exclude data/backtest/results/ subtree
    if len(parts) >= 3 and parts[0] == "data" and parts[1] == "backtest" and parts[2] == "results":
        return True

    # Exact exclusions
    if relpath in EXCLUDE_EXACT:
        return True

    # Extension exclusions
    _, ext = os.path.splitext(relpath)
    if ext.lower() in EXCLUDE_EXTENSIONS:
        return True

    # Suffix pattern exclusions (e.g. _1m.json)
    fname = os.path.basename(relpath)
    for pat in EXCLUDE_SUFFIX_PATTERNS:
        if fname.endswith(pat):
            return True

    return False


def stage(dry_run=False, verbose=False):
    # Wipe and recreate deploy/ (skip in dry-run mode)
    if not dry_run:
        if os.path.exists(DEPLOY_DIR):
            shutil.rmtree(DEPLOY_DIR)
        os.makedirs(DEPLOY_DIR)

    linked = 0
    skipped = 0
    errors = 0

    for dirpath, dirnames, filenames in os.walk(ROOT):
        # Prune excluded directories in-place so os.walk won't descend.
        # We build the relative path of each subdirectory from ROOT and check it
        # against EXCLUDE_DIRS.  Hidden dirs (e.g. .git, .claude) are excluded
        # by being listed in EXCLUDE_DIRS -- we do NOT blanket-exclude all
        # dot-dirs so that dotfiles at root level (e.g. .gitignore) still appear
        # in filenames and can be individually included or skipped.
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

            if should_exclude(relpath):
                skipped += 1
                if verbose:
                    print(f"  SKIP  {relpath}")
                continue

            dst = os.path.join(DEPLOY_DIR, relpath)
            dst_dir = os.path.dirname(dst)

            if not dry_run:
                os.makedirs(dst_dir, exist_ok=True)
                try:
                    os.link(src, dst)
                    linked += 1
                except (OSError, NotImplementedError):
                    # Cross-device or filesystem doesn't support hard links
                    # Fall back to copy
                    shutil.copy2(src, dst)
                    linked += 1
            else:
                linked += 1

            if verbose:
                print(f"  LINK  {relpath}")

    return linked, skipped, errors


def main():
    parser = argparse.ArgumentParser(description="Stage deploy/ directory for Cloudflare Pages")
    parser.add_argument("--dry-run", action="store_true", help="Count files without creating deploy/")
    parser.add_argument("--verbose", action="store_true", help="Print each file decision")
    parser.add_argument("--limit", type=int, default=20000, help="Cloudflare Pages file limit (default 20000)")
    args = parser.parse_args()

    print("CheeseStock -- Staging deploy/ directory")
    print(f"ROOT: {ROOT}")
    print(f"DEPLOY: {DEPLOY_DIR}")
    print()

    linked, skipped, errors = stage(dry_run=args.dry_run, verbose=args.verbose)

    print(f"Files staged : {linked:,}")
    print(f"Files skipped: {skipped:,}")
    if errors:
        print(f"Errors       : {errors}")

    if linked > args.limit:
        print(f"ERROR: {linked:,} files exceeds Cloudflare Pages limit of {args.limit:,}")
        print("Remove more files from the staging set (e.g. exclude _1m or _30m timeframes)")
        sys.exit(1)
    else:
        margin = args.limit - linked
        print(f"OK: {margin:,} files under the {args.limit:,} limit")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
