"""
D-1 Survivorship Bias Correction Factor Computation

Compares pattern_performance.json (listed stocks) with
delisted_pattern_performance.json (delisted stocks) to compute
empirical survivorship bias correction factors.

Theory: Elton, Gruber & Blake (1996, JF 51(4):1097-1108)
  — listed-only WR is positively biased by ~2-5pp

Output: data/backtest/survivorship_correction.json
  Used by js/backtester.js to adjust absolute WR.

Usage:
  python scripts/compute_survivorship_correction.py
  python scripts/compute_survivorship_correction.py --verbose
"""

import json
import os
import sys
import math
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
BACKTEST_DIR = ROOT / "data" / "backtest"

LISTED_PERF = BACKTEST_DIR / "pattern_performance.json"
DELISTED_PERF = BACKTEST_DIR / "delisted_pattern_performance.json"
OUTPUT = BACKTEST_DIR / "survivorship_correction.json"

# Minimum delisted occurrences for per-pattern correction
MIN_DELISTED_N = 30

HORIZONS = ['1', '3', '5', '10', '20']


def weighted_median(values, weights):
    """Weighted median computation."""
    if not values or not weights:
        return 0
    pairs = sorted(zip(values, weights))
    total_w = sum(weights)
    cum_w = 0
    for val, w in pairs:
        cum_w += w
        if cum_w >= total_w / 2:
            return val
    return pairs[-1][0]


def normal_ci(p1, n1, p2, n2, alpha=0.05):
    """95% CI for difference of two proportions (WR1 - WR2).
    p1, p2 are percentages (0-100)."""
    p1f, p2f = p1 / 100, p2 / 100
    if n1 == 0 or n2 == 0:
        return None
    se = math.sqrt(p1f * (1 - p1f) / n1 + p2f * (1 - p2f) / n2) * 100
    z = 1.96  # 95%
    delta = p1 - p2
    return [round(delta - z * se, 2), round(delta + z * se, 2)]


def main():
    verbose = "--verbose" in sys.argv

    # Load performance files
    if not LISTED_PERF.exists():
        print(f"[ERROR] {LISTED_PERF} not found. Run: python scripts/backtest_all.py")
        sys.exit(1)
    if not DELISTED_PERF.exists():
        print(f"[ERROR] {DELISTED_PERF} not found. Run: python scripts/backtest_all.py --delisted")
        sys.exit(1)

    with open(LISTED_PERF, "r", encoding="utf-8") as f:
        listed = json.load(f)
    with open(DELISTED_PERF, "r", encoding="utf-8") as f:
        delisted = json.load(f)

    # Source guards — reject fake/sample/demo data
    for _name, _data in [("pattern_performance.json", listed), ("delisted_pattern_performance.json", delisted)]:
        if isinstance(_data, dict):
            _src = _data.get('source', '')
            if _src in ('sample', 'seed', 'demo'):
                print(f"[WARN] {_name}: source={_src} (not real data) — results may be unreliable")

    print("=" * 60)
    print("D-1 Survivorship Bias Correction Factor Computation")
    print("=" * 60)
    print(f"  Listed patterns:   {len(listed)} types")
    print(f"  Delisted patterns: {len(delisted)} types")

    # Compute per-pattern, per-horizon deltas
    per_pattern = {}
    per_horizon_deltas = {h: [] for h in HORIZONS}
    all_deltas = []

    for ptype in sorted(set(list(listed.keys()) + list(delisted.keys()))):
        l_data = listed.get(ptype, {})
        d_data = delisted.get(ptype, {})

        per_pattern[ptype] = {}

        for h in HORIZONS:
            l_h = l_data.get(h)
            d_h = d_data.get(h)

            if not l_h or not d_h:
                continue

            l_wr = l_h.get("weighted_win_rate", 0)
            l_n = l_h.get("total_occurrences", 0)
            d_wr = d_h.get("weighted_win_rate", 0)
            d_n = d_h.get("total_occurrences", 0)

            if l_n == 0 or d_n == 0:
                continue

            # Combined WR (listed + delisted weighted by n)
            combined_wr = (l_wr * l_n + d_wr * d_n) / (l_n + d_n)
            # Delta: how much the listed-only WR exceeds the true (combined) WR
            delta = l_wr - combined_wr

            if d_n >= MIN_DELISTED_N:
                ci = normal_ci(l_wr, l_n, combined_wr, l_n + d_n)
                per_pattern[ptype][h] = {
                    "delta": round(delta, 2),
                    "listed_wr": round(l_wr, 1),
                    "delisted_wr": round(d_wr, 1),
                    "combined_wr": round(combined_wr, 1),
                    "n_listed": l_n,
                    "n_delisted": d_n,
                    "ci95": ci,
                }

                per_horizon_deltas[h].append((delta, l_n + d_n))
                all_deltas.append((delta, l_n + d_n))

                if verbose:
                    print(f"  {ptype:30s} h={h:>2s}: "
                          f"listed={l_wr:5.1f}% delisted={d_wr:5.1f}% "
                          f"delta={delta:+5.2f}pp (n_d={d_n})")

        # Remove empty entries
        if not per_pattern[ptype]:
            del per_pattern[ptype]

    # Compute global and per-horizon corrections
    if all_deltas:
        global_median = round(weighted_median(
            [d[0] for d in all_deltas],
            [d[1] for d in all_deltas]
        ), 2)
        global_mean = round(sum(d[0] * d[1] for d in all_deltas) / sum(d[1] for d in all_deltas), 2)

        # Global CI: treat all deltas as one distribution
        delta_vals = [d[0] for d in all_deltas]
        if len(delta_vals) >= 3:
            delta_vals.sort()
            n_d = len(delta_vals)
            global_ci = [round(delta_vals[max(0, int(n_d * 0.025))], 2),
                         round(delta_vals[min(n_d - 1, int(n_d * 0.975))], 2)]
        else:
            global_ci = None
    else:
        global_median = 0
        global_mean = 0
        global_ci = None

    per_horizon = {}
    for h in HORIZONS:
        deltas = per_horizon_deltas[h]
        if deltas:
            median = round(weighted_median(
                [d[0] for d in deltas],
                [d[1] for d in deltas]
            ), 2)
            per_horizon[h] = median
        else:
            per_horizon[h] = global_median

    # Count universes
    listed_index = ROOT / "data" / "index.json"
    delisted_index = ROOT / "data" / "delisted_index.json"
    n_listed = 0
    n_delisted = 0
    if listed_index.exists():
        with open(listed_index, "r", encoding="utf-8") as f:
            n_listed = json.load(f).get("total", 0)
    if delisted_index.exists():
        with open(delisted_index, "r", encoding="utf-8") as f:
            n_delisted = json.load(f).get("total", 0)

    # Build output
    result = {
        "computed": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "method": "EGB1996_empirical",
        "reference": "Elton, Gruber & Blake (1996), JF 51(4):1097-1108",
        "universe": {
            "listed": n_listed,
            "delisted": n_delisted,
            "total": n_listed + n_delisted,
        },
        "global": {
            "delta_wr_median": global_median,
            "delta_wr_mean": global_mean,
            "ci95": global_ci,
            "recommended_adjustment": global_median,
            "pattern_horizon_pairs": len(all_deltas),
        },
        "per_horizon": per_horizon,
        "per_pattern": per_pattern,
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Summary
    print()
    print(f"  Global delta (median):  {global_median:+.2f}pp")
    print(f"  Global delta (mean):    {global_mean:+.2f}pp")
    if global_ci:
        print(f"  Global 95% CI:          [{global_ci[0]:+.2f}, {global_ci[1]:+.2f}]pp")
    print(f"  Per-horizon deltas:")
    for h in HORIZONS:
        print(f"    h={h:>2s}: {per_horizon[h]:+.2f}pp")
    print(f"  Pattern-horizon pairs:  {len(all_deltas)}")
    print(f"  Patterns with data:     {len(per_pattern)}")
    print()

    # Sanity checks
    warnings = []
    if global_median < 0:
        warnings.append(f"WARN: Global median delta is negative ({global_median}pp) — unexpected")
    if abs(global_median) > 6:
        warnings.append(f"WARN: Global median delta ({global_median}pp) outside expected [1, 6]pp range")
    if global_ci and global_ci[0] <= 0 <= global_ci[1]:
        warnings.append("WARN: Global CI spans zero — correction may not be statistically significant")

    if warnings:
        for w in warnings:
            print(f"  {w}")
    else:
        print("  All sanity checks passed.")

    print(f"\n  Output: {OUTPUT}")
    print("=" * 60)


if __name__ == "__main__":
    main()
