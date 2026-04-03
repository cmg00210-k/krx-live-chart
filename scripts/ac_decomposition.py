#!/usr/bin/env python3
"""
AC (Autocorrelation) Overlap Decomposition Analysis
====================================================
Phase 5 reported within-stock AC = 0.549, date-level AC = 0.797.
Decomposes how much is mechanical (5-day overlap) vs genuine.

Hansen & Hodrick (1980): overlapping H-day returns create MA(H-1) errors.
Theoretical mechanical AC(1) = (H-1)/H = 4/5 = 0.80 for H=5.

Methods:
A) Non-overlapping subsample: every 5th obs -> removes overlap entirely
B) Newey-West HAC standard errors with bandwidth=5
C) Block bootstrap (block_size=5) for IC standard errors
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')
import csv
import math
import os
import random
from collections import defaultdict

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         '..', 'data', 'backtest', 'rl_residuals.csv')


def mean(xs):
    return sum(xs) / len(xs) if xs else float('nan')

def std(xs, m=None):
    if len(xs) < 2: return float('nan')
    if m is None: m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))

def corr(xs, ys):
    n = len(xs)
    if n < 3: return float('nan')
    mx, my = mean(xs), mean(ys)
    sx, sy = std(xs, mx), std(ys, my)
    if sx == 0 or sy == 0: return float('nan')
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / ((n - 1) * sx * sy)

def acf_lag(series, lag=1):
    if len(series) < lag + 3: return float('nan')
    return corr(series[:-lag], series[lag:])


def main():
    print("=" * 72)
    print("  AC Overlap Decomposition Analysis")
    print("  Hansen-Hodrick (1980) framework, H=5 day horizon")
    print("=" * 72)

    rows = []
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                'date': row['date'], 'code': row['code'],
                'y_pred': float(row['y_pred']),
                'y_actual': float(row['y_actual']),
                'residual': float(row['residual']),
            })
    print(f"\nTotal observations: {len(rows):,}")

    by_stock = defaultdict(list)
    for r in rows:
        by_stock[r['code']].append(r)
    for code in by_stock:
        by_stock[code].sort(key=lambda x: x['date'])
    print(f"Unique stocks: {len(by_stock):,}")

    by_date = defaultdict(list)
    for r in rows:
        by_date[r['date']].append(r)

    # Section 1: Full ACF spectrum
    print("\n" + "-" * 72)
    print("  SECTION 1: y_actual ACF spectrum (lags 1-10)")
    print("-" * 72)
    for lag in range(1, 11):
        vals = []
        for code, obs_list in by_stock.items():
            series = [o['y_actual'] for o in obs_list]
            if len(series) < lag + 5: continue
            a = acf_lag(series, lag=lag)
            if not math.isnan(a): vals.append(a)
        if vals:
            theoretical = max(0, (5 - lag) / 5) if lag <= 5 else 0
            print(f"  lag {lag:2d}: measured={mean(vals):+.4f}  "
                  f"theoretical={theoretical:.2f}  diff={mean(vals) - theoretical:+.4f}")

    # Section 2: Non-overlapping subsample
    print("\n" + "-" * 72)
    print("  SECTION 2: Non-Overlapping Subsample (every 5th obs)")
    print("-" * 72)
    for field in ['y_actual', 'y_pred', 'residual']:
        ac1_list = []
        for phase in range(5):
            for code, obs_list in by_stock.items():
                sub = [o[field] for i, o in enumerate(obs_list) if i % 5 == phase]
                if len(sub) < 5: continue
                a = acf_lag(sub, lag=1)
                if not math.isnan(a): ac1_list.append(a)
        avg = mean(ac1_list) if ac1_list else float('nan')
        sd = std(ac1_list) if len(ac1_list) > 1 else float('nan')
        t = avg / (sd / math.sqrt(len(ac1_list))) if sd and sd > 0 else 0
        print(f"  [{field}] non-overlap ACF(1): {avg:+.4f} (sd={sd:.4f}, t={t:+.3f}, n={len(ac1_list)})")

    # Section 3: Newey-West IC
    print("\n" + "-" * 72)
    print("  SECTION 3: Newey-West HAC IC t-stat")
    print("-" * 72)
    sorted_dates = sorted(by_date.keys())
    ic_vals = []
    for d in sorted_dates:
        obs = by_date[d]
        if len(obs) < 30: continue
        ic = corr([o['y_pred'] for o in obs], [o['y_actual'] for o in obs])
        if not math.isnan(ic): ic_vals.append(ic)

    ic_mean = mean(ic_vals)
    ic_std_naive = std(ic_vals)
    naive_se = ic_std_naive / math.sqrt(len(ic_vals))
    naive_t = ic_mean / naive_se

    L = 5
    demeaned = [ic - ic_mean for ic in ic_vals]
    n_ic = len(ic_vals)
    gamma = {j: sum(demeaned[t] * demeaned[t - j] for t in range(j, n_ic)) / n_ic for j in range(L + 1)}
    nw_var = gamma[0] + 2 * sum((1 - j / (L + 1)) * gamma[j] for j in range(1, L + 1))
    nw_se = math.sqrt(nw_var / n_ic)
    nw_t = ic_mean / nw_se

    print(f"  IC mean: {ic_mean:.4f}, n_dates: {n_ic}")
    print(f"  Naive:  SE={naive_se:.4f}, t={naive_t:.3f}")
    print(f"  NW(5):  SE={nw_se:.4f}, t={nw_t:.3f}")
    print(f"  SE inflation: {nw_se/naive_se:.2f}x")

    # Section 4: Block Bootstrap
    print("\n" + "-" * 72)
    print("  SECTION 4: Block Bootstrap (block_size=5)")
    print("-" * 72)
    random.seed(42)
    BLOCK, B = 5, 10000
    n_blocks = n_ic // BLOCK
    boot_means = []
    for _ in range(B):
        sample = []
        for _ in range(n_blocks):
            start = random.randint(0, n_ic - BLOCK)
            sample.extend(ic_vals[start:start + BLOCK])
        boot_means.append(mean(sample))
    boot_se = std(boot_means)
    boot_t = ic_mean / boot_se
    boot_sorted = sorted(boot_means)
    ci_lo = boot_sorted[int(0.025 * B)]
    ci_hi = boot_sorted[int(0.975 * B)]
    print(f"  Bootstrap SE: {boot_se:.4f}, t={boot_t:.3f}")
    print(f"  95% CI: [{ci_lo:.4f}, {ci_hi:.4f}]")

    # Section 5: Summary
    print("\n" + "-" * 72)
    print("  SUMMARY")
    print("-" * 72)
    full_ac1_list, genuine_list = [], []
    for code, obs_list in by_stock.items():
        s = [o['y_actual'] for o in obs_list]
        if len(s) < 10: continue
        a1 = acf_lag(s, lag=1)
        if not math.isnan(a1): full_ac1_list.append(a1)
        sub = [s[i] for i in range(0, len(s), 5)]
        if len(sub) >= 5:
            a1_no = acf_lag(sub, lag=1)
            if not math.isnan(a1_no): genuine_list.append(a1_no)

    full_ac1 = mean(full_ac1_list)
    genuine_ac1 = mean(genuine_list)
    mechanical = full_ac1 - genuine_ac1

    print(f"  Theoretical mechanical AC(1): 0.8000")
    print(f"  Measured full AC(1):          {full_ac1:+.4f}")
    print(f"  Non-overlapping genuine AC:   {genuine_ac1:+.4f}")
    print(f"  Implied mechanical:           {mechanical:+.4f}")
    print(f"  NW IC t-stat:                 {nw_t:.3f}")
    print(f"  Bootstrap IC t-stat:          {boot_t:.3f}")

    abs_g = abs(genuine_ac1)
    if abs_g < 0.10:
        print(f"\n  DECISION: CLOSE -- genuine AC < 0.10, almost entirely mechanical")
    elif abs_g < 0.30:
        print(f"\n  DECISION: MONITOR -- genuine AC {abs_g:.3f}, moderate serial dependence")
    else:
        print(f"\n  DECISION: ACTION -- genuine AC {abs_g:.3f}, add AR(1) feature")

    if full_ac1 != 0:
        print(f"  Mechanical fraction: {mechanical/full_ac1*100:.1f}% of total AC")

    print("\n" + "=" * 72)


if __name__ == "__main__":
    main()
