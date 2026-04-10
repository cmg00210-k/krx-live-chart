# -*- coding: utf-8 -*-
"""
compute_oos_winrates.py — V22-B Phase 3 Step 2

목적:
  `data/backtest/wc_return_pairs.csv`를 시간 기반으로 train/test 분할하여
  패턴별 OOS 승률을 계산하고 `data/backtest/pattern_winrates_oos.json`에 저장.

배경 (Phase 2 통계 설계 §3):
  - 기존 `PATTERN_WIN_RATES` (patterns.js:251)는 5년 full-sample 승률로,
    look-ahead bias 가능성 및 Lo 2002 30-50% IS inflation 위험.
  - 시간 기반 split (cross-sectional 금지) + Beta-Binomial shrinkage toward
    OOS grand mean + tier 분류.

Cutoff 선정 (데이터 편향 고려):
  `wc_return_pairs.csv`는 데이터 수집 편향으로 인해 2021-2024 샘플이 3,457건
  (4%), 2025-2026이 85,440건 (96%)이다. 원안 2025-04-01 cutoff는 train 4%
  / test 96%를 만들어 사용 불가. 대신 **2025-11-01 cutoff** (train 54% /
  test 46%)를 선택하여 Lo 2002 표준과 pattern coverage(35/44 ≥100)를 절충.

입력:
  data/backtest/wc_return_pairs.csv — code, market, type, signal, date, ret_5 등

출력:
  data/backtest/pattern_winrates_oos.json — 스키마 v1 (Phase 2 §3.2)

사용법:
  python scripts/compute_oos_winrates.py
  python scripts/compute_oos_winrates.py --cutoff 2025-11-01
  python scripts/compute_oos_winrates.py --cutoff 2025-11-01 --n0 35 --min-test-n 100
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

# UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parents[1]
CSV_PATH = BASE_DIR / 'data' / 'backtest' / 'wc_return_pairs.csv'
OUT_PATH = BASE_DIR / 'data' / 'backtest' / 'pattern_winrates_oos.json'
OOS_CONFIG_PATH = BASE_DIR / 'config' / 'oos_split.json'


def _load_oos_config():
    """Load canonical OOS split config from config/oos_split.json.

    Returns:
        tuple[str, float]: (cutoff_date, oos_ratio).

    Exits with code 1 if the config file is missing or malformed. Gap B's
    purpose is to eliminate silent inconsistency between calibrate_constants.py
    and compute_oos_winrates.py, so a missing config must FAIL LOUD instead of
    silently falling back to the historical hardcoded default.
    """
    try:
        with open(OOS_CONFIG_PATH, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
    except FileNotFoundError:
        print(f"[FATAL] OOS config not found: {OOS_CONFIG_PATH}", file=sys.stderr)
        print("[FATAL] Gap B requires config/oos_split.json to exist.", file=sys.stderr)
        print("[FATAL] Create the file or run from the repo root.", file=sys.stderr)
        sys.exit(1)
    except (json.JSONDecodeError, OSError) as e:
        print(f"[FATAL] OOS config unreadable: {OOS_CONFIG_PATH}: {e}", file=sys.stderr)
        sys.exit(1)

    cutoff = cfg.get('cutoff_date')
    ratio = cfg.get('oos_ratio')
    if cutoff is None or ratio is None:
        print(f"[FATAL] OOS config missing required keys "
              f"'cutoff_date' and/or 'oos_ratio': {OOS_CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    try:
        ratio = float(ratio)
    except (TypeError, ValueError):
        print(f"[FATAL] OOS config 'oos_ratio' not a number: {ratio!r}", file=sys.stderr)
        sys.exit(1)
    return str(cutoff), ratio


# 차트 패턴 집합 (patterns.js:306과 동일)
CHART_PATTERNS = frozenset({
    'doubleBottom', 'doubleTop', 'headAndShoulders', 'inverseHeadAndShoulders',
    'ascendingTriangle', 'descendingTriangle', 'symmetricTriangle',
    'risingWedge', 'fallingWedge', 'channel', 'cupAndHandle',
})


def load_data(csv_path: Path) -> pd.DataFrame:
    """wc_return_pairs.csv 로드 + directional 필터 + ret_5 유효성 확인"""
    print(f"[1/6] Loading {csv_path.name}...")
    df = pd.read_csv(csv_path, usecols=['code', 'market', 'type', 'signal', 'date', 'ret_5'])
    print(f"  Total rows: {len(df):,}")

    df['date'] = pd.to_datetime(df['date'])
    before = len(df)
    df = df.dropna(subset=['ret_5'])
    print(f"  After dropna(ret_5): {len(df):,} (dropped {before - len(df):,})")

    # buy/sell만 — neutral 패턴은 direction-less이므로 승률 계산 무의미
    directed = df[df['signal'].isin(['buy', 'sell'])].copy()
    print(f"  Directed rows (buy/sell): {len(directed):,}")
    print(f"  Date range: {directed['date'].min().date()} ~ {directed['date'].max().date()}")
    return directed


def compute_win(df: pd.DataFrame) -> pd.DataFrame:
    """버이 시그널 + ret_5 > 0 또는 sell 시그널 + ret_5 < 0 → win=1"""
    df = df.copy()
    df['win'] = np.where(
        df['signal'] == 'buy',
        (df['ret_5'] > 0).astype(int),
        (df['ret_5'] < 0).astype(int),
    )
    return df


def split_by_time(df: pd.DataFrame, cutoff: pd.Timestamp):
    """시간 기반 분할 — Lo (2002) 권고"""
    train = df[df['date'] < cutoff].copy()
    test = df[df['date'] >= cutoff].copy()
    return train, test


def binomial_ci(k: int, n: int, alpha: float = 0.05):
    """Wilson score interval (Wilson 1927) — Beta-Binomial 소표본 안정"""
    if n == 0:
        return (0.0, 0.0)
    low, high = stats.binomtest(k, n).proportion_ci(confidence_level=1 - alpha, method='wilson')
    return (float(low), float(high))


def binomial_pvalue(k: int, n: int, p0: float = 0.5) -> float:
    """이항 two-sided p-value vs H0: p = p0"""
    if n == 0:
        return 1.0
    return float(stats.binomtest(k, n, p0, alternative='two-sided').pvalue)


def shrinkage_toward_grand(wr: float, n: int, grand_mean: float, N0: int) -> float:
    """Beta-Binomial posterior mean shrinkage — Efron-Morris (1975)
    공식: θ_post = (n·wr + N0·grand_mean) / (n + N0)
    """
    if n + N0 == 0:
        return grand_mean
    return (n * wr + N0 * grand_mean) / (n + N0)


def contrarian_graduation(patterns: dict, q: float = 0.10) -> None:
    """V25: Benjamini-Hochberg FDR contrarian graduation for ANTI_PREDICTOR patterns.

    1-sided binomial test H0: p >= 0.50, H1: p < 0.50 (direction worse than chance).
    BH correction at FDR q (Benjamini & Hochberg 1995).
    Theoretical basis: Lo (2004) AMH crowding + Jegadeesh (1990) short-term reversal.
    """
    anti = []
    for ptype, data in patterns.items():
        if data['tier'] != 'ANTI_PREDICTOR':
            continue
        n = data['oos_n']
        wr_pct = data['oos_wr']
        if n == 0 or wr_pct is None:
            continue
        k = round(wr_pct / 100 * n)
        # 1-sided binomial: P(X <= k | n, p=0.5)
        p_value = float(stats.binom.cdf(k, n, 0.5))
        anti.append((ptype, p_value, k, n))

    if not anti:
        return

    # Sort by p-value (ascending) for BH step-up procedure
    anti.sort(key=lambda x: x[1])
    m = len(anti)

    # BH-FDR: find largest i where p(i) <= (i/m) * q, reject all up to that i
    max_reject_idx = -1
    for i, (_, p_val, _, _) in enumerate(anti):
        bh_threshold = (i + 1) / m * q
        if p_val <= bh_threshold:
            max_reject_idx = i

    significant = {anti[i][0] for i in range(max_reject_idx + 1)}

    # Write contrarian fields into pattern dicts
    for ptype, p_val, k, n in anti:
        is_grad = ptype in significant
        patterns[ptype]['contrarian'] = is_grad
        patterns[ptype]['contrarian_p_value'] = round(p_val, 6)

    print(f"  Contrarian graduation: {len(significant)}/{m} ANTI_PREDICTOR "
          f"passed BH-FDR at q={q}")
    for ptype, p_val, k, n in anti:
        tag = "GRADUATE" if ptype in significant else "null"
        print(f"    {ptype:30s} k={k:>4d}/{n:<5d} p={p_val:.2e}  -> {tag}")


def classify_tier(oos_wr: float, oos_n: int, grand_mean: float,
                  p_value_vs_50: float, is_oos_delta_p: float) -> str:
    """Phase 2 §3.3 taxonomy"""
    if oos_n < 100:
        return 'INSUFFICIENT'
    if oos_wr < grand_mean - 0.02 and p_value_vs_50 < 0.05:
        return 'ANTI_PREDICTOR'
    if oos_wr > grand_mean + 0.02 and p_value_vs_50 < 0.05 and oos_n >= 200 and is_oos_delta_p > 0.05:
        return 'RELIABLE'
    return 'BORDERLINE'


def compute_per_pattern(train: pd.DataFrame, test: pd.DataFrame, n0: int,
                        grand_candle_oos: float, grand_chart_oos: float) -> dict:
    """패턴별 IS/OOS win rate + shrinkage + tier"""
    result = {}
    all_types = set(train['type'].unique()) | set(test['type'].unique())

    for ptype in sorted(all_types):
        tr = train[train['type'] == ptype]
        te = test[test['type'] == ptype]

        is_n = len(tr)
        oos_n = len(te)
        is_wr = float(tr['win'].mean()) if is_n > 0 else float('nan')
        oos_wr = float(te['win'].mean()) if oos_n > 0 else float('nan')

        category = 'chart' if ptype in CHART_PATTERNS else 'candle'
        grand_oos = grand_chart_oos if category == 'chart' else grand_candle_oos

        # OOS binomial CI + p-value vs 0.5
        if oos_n > 0:
            oos_wins = int(te['win'].sum())
            ci_low, ci_high = binomial_ci(oos_wins, oos_n)
            p_vs_50 = binomial_pvalue(oos_wins, oos_n, 0.5)
        else:
            ci_low, ci_high, p_vs_50 = 0.0, 0.0, 1.0

        # IS vs OOS delta (two-proportion z-test)
        if is_n > 0 and oos_n > 0:
            is_oos_delta = oos_wr - is_wr
            is_wins = int(tr['win'].sum())
            oos_wins = int(te['win'].sum())
            # pooled proportion z-test
            p_pool = (is_wins + oos_wins) / (is_n + oos_n)
            se = np.sqrt(p_pool * (1 - p_pool) * (1 / is_n + 1 / oos_n)) if p_pool * (1 - p_pool) > 0 else 0
            if se > 0:
                z = (oos_wr - is_wr) / se
                delta_p = float(2 * (1 - stats.norm.cdf(abs(z))))
            else:
                delta_p = 1.0
        else:
            is_oos_delta = float('nan')
            delta_p = 1.0

        # Shrinkage toward OOS grand mean (NOT toward IS)
        wr_oos_shrunk = shrinkage_toward_grand(oos_wr, oos_n, grand_oos, n0) if oos_n > 0 else grand_oos

        tier = classify_tier(oos_wr, oos_n, grand_oos, p_vs_50, delta_p) if oos_n > 0 else 'INSUFFICIENT'

        result[ptype] = {
            'category': category,
            'is_wr': round(is_wr * 100, 2) if not np.isnan(is_wr) else None,
            'is_n': is_n,
            'oos_wr': round(oos_wr * 100, 2) if not np.isnan(oos_wr) else None,
            'oos_n': oos_n,
            'oos_wr_95ci': [round(ci_low * 100, 2), round(ci_high * 100, 2)] if oos_n > 0 else None,
            'oos_wr_p_value_vs_50': round(p_vs_50, 4),
            'is_oos_delta': round(is_oos_delta * 100, 2) if not np.isnan(is_oos_delta) else None,
            'is_oos_delta_p_value': round(delta_p, 4),
            'wr_oos_shrunk': round(wr_oos_shrunk * 100, 2),
            'tier': tier,
        }
    return result


def main():
    ap = argparse.ArgumentParser(description='V22-B time-based OOS winrates computation')
    ap.add_argument('--cutoff', default=None,
                    help='Train/test split date YYYY-MM-DD (default: from config/oos_split.json).')
    ap.add_argument('--n0', type=int, default=35,
                    help='Beta-Binomial shrinkage prior sample size (default: 35, Efron-Morris EB).')
    ap.add_argument('--min-test-n', type=int, default=100,
                    help='Minimum OOS sample size per pattern for non-INSUFFICIENT tier (default: 100).')
    ap.add_argument('--output', default=None, help='Override output path.')
    args = ap.parse_args()

    # Gap B: canonical cutoff loaded from config/oos_split.json; --cutoff overrides.
    cfg_cutoff, cfg_ratio = _load_oos_config()
    effective_cutoff_str = args.cutoff if args.cutoff is not None else cfg_cutoff
    print(f"  [OOS config] cutoff_date={cfg_cutoff}, oos_ratio={cfg_ratio} (from {OOS_CONFIG_PATH})")
    cutoff = pd.Timestamp(effective_cutoff_str)

    print("=" * 64)
    print("V22-B Phase 3 Step 2: Compute OOS Winrates")
    print("=" * 64)
    print(f"Cutoff: {effective_cutoff_str} (time-based split)")
    print(f"Shrinkage N0: {args.n0}")
    print(f"Minimum test n: {args.min_test_n}")
    print()

    df = load_data(CSV_PATH)
    df = compute_win(df)

    print(f"\n[2/6] Splitting by cutoff {effective_cutoff_str}...")
    train, test = split_by_time(df, cutoff)
    print(f"  Train: {len(train):,} ({len(train)/(len(train)+len(test))*100:.1f}%)  "
          f"range {train['date'].min().date()} ~ {train['date'].max().date()}")
    print(f"  Test:  {len(test):,} ({len(test)/(len(train)+len(test))*100:.1f}%)  "
          f"range {test['date'].min().date()} ~ {test['date'].max().date()}")

    print(f"\n[3/6] Computing category grand means...")
    train['category'] = train['type'].apply(lambda t: 'chart' if t in CHART_PATTERNS else 'candle')
    test['category'] = test['type'].apply(lambda t: 'chart' if t in CHART_PATTERNS else 'candle')

    gm_candle_is = float(train[train['category'] == 'candle']['win'].mean()) if len(train[train['category'] == 'candle']) > 0 else 0.5
    gm_candle_oos = float(test[test['category'] == 'candle']['win'].mean()) if len(test[test['category'] == 'candle']) > 0 else 0.5
    gm_chart_is = float(train[train['category'] == 'chart']['win'].mean()) if len(train[train['category'] == 'chart']) > 0 else 0.5
    gm_chart_oos = float(test[test['category'] == 'chart']['win'].mean()) if len(test[test['category'] == 'chart']) > 0 else 0.5

    print(f"  Candle grand mean  IS={gm_candle_is:.4f}  OOS={gm_candle_oos:.4f}")
    print(f"  Chart  grand mean  IS={gm_chart_is:.4f}  OOS={gm_chart_oos:.4f}")

    print(f"\n[4/6] Computing per-pattern statistics...")
    patterns = compute_per_pattern(train, test, args.n0, gm_candle_oos, gm_chart_oos)
    print(f"  Pattern count: {len(patterns)}")

    tier_counts = {}
    for p, data in patterns.items():
        tier = data['tier']
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
    print(f"  Tier distribution: {tier_counts}")

    print(f"\n[5/7] Contrarian graduation (BH-FDR q=0.10)...")
    contrarian_graduation(patterns, q=0.10)

    print(f"\n[6/7] Building output JSON...")
    output = {
        'schema_version': 1,
        'generated': datetime.now().strftime('%Y-%m-%d'),
        'split_method': f'time_cutoff_{effective_cutoff_str}',
        'train_range': [str(train['date'].min().date()), str(train['date'].max().date())] if len(train) > 0 else None,
        'test_range': [str(test['date'].min().date()), str(test['date'].max().date())] if len(test) > 0 else None,
        'n_train_total': int(len(train)),
        'n_test_total': int(len(test)),
        'shrinkage_n0': args.n0,
        'min_test_n': args.min_test_n,
        'grand_mean_candle_is': round(gm_candle_is * 100, 2),
        'grand_mean_candle_oos': round(gm_candle_oos * 100, 2),
        'grand_mean_chart_is': round(gm_chart_is * 100, 2),
        'grand_mean_chart_oos': round(gm_chart_oos * 100, 2),
        'patterns': patterns,
    }

    out_path = Path(args.output) if args.output else OUT_PATH
    print(f"\n[7/7] Writing {out_path.relative_to(BASE_DIR) if out_path.is_absolute() else out_path}...")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    size_kb = out_path.stat().st_size / 1024
    print(f"  Written: {size_kb:.1f} KB")

    print()
    print("=" * 64)
    print("Done.")
    print("=" * 64)
    print(f"RELIABLE: {tier_counts.get('RELIABLE', 0)}  "
          f"BORDERLINE: {tier_counts.get('BORDERLINE', 0)}  "
          f"ANTI_PREDICTOR: {tier_counts.get('ANTI_PREDICTOR', 0)}  "
          f"INSUFFICIENT: {tier_counts.get('INSUFFICIENT', 0)}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
