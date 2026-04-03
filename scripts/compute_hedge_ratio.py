#!/usr/bin/env python3
"""
KOSPI200 Futures Optimal Hedge Ratio -- Minimum Variance Hedging

Reads:
  data/market/kospi_daily.json              (spot index daily closes)
  data/derivatives/futures_daily.json       (futures daily closes)

Output:
  data/derivatives/hedge_analytics.json

Metrics:
  - hedgeRatio:      h* = Cov(DS, DF) / Var(DF)  (minimum variance)
  - hedgeEfficiency: R^2 = rho^2(DS, DF) = 1 - Var(hedged) / Var(unhedged)
  - basisVolatility: std(basis) / spot (residual basis risk)
  - calendarSpread:  near-far month spread statistics (if multi-contract data)

Academic basis:
  Johnson (1960): Minimum variance hedging
  Ederington (1979): OLS hedge ratio = slope coefficient
  Hull (2022): Options, Futures, and Other Derivatives, Ch.3
  core_data/25_capm_delta_covariance.md §3 (delta hedging)
  core_data/27_derivatives_pricing.md §3.1 (optimal hedge ratio)

Pure Python: no scipy/numpy dependency.

Usage:
  python scripts/compute_hedge_ratio.py
  python scripts/compute_hedge_ratio.py --window 60
  python scripts/compute_hedge_ratio.py --verbose
"""
import json
import math
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'data')
OUT_PATH = os.path.join(DATA_DIR, 'derivatives', 'hedge_analytics.json')

# ── Parameters ──
DEFAULT_WINDOW = 60     # 60-day rolling window (Hull Ch.3 recommendation)
MIN_OBS = 20            # 최소 관측치


def _load_json(path):
    """JSON 파일 로드, 실패 시 None."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f'  [WARN] Cannot load {path}: {e}')
        return None


def compute_hedge_ratio(spot_changes, futures_changes):
    """
    최소분산 헤지비율 + 효율성 계산.

    h* = Cov(DS, DF) / Var(DF)     -- Johnson (1960)
    R^2 = Cov(DS,DF)^2 / (Var(DS) * Var(DF))  -- Ederington (1979)

    Args:
        spot_changes: list of float (DS_t = S_t - S_{t-1})
        futures_changes: list of float (DF_t = F_t - F_{t-1})

    Returns:
        dict with hedgeRatio, hedgeEfficiency, stats or None
    """
    n = len(spot_changes)
    if n < MIN_OBS:
        return None

    # 평균
    mean_ds = sum(spot_changes) / n
    mean_df = sum(futures_changes) / n

    # 공분산, 분산
    cov_sf = 0.0
    var_s = 0.0
    var_f = 0.0
    for i in range(n):
        ds_dev = spot_changes[i] - mean_ds
        df_dev = futures_changes[i] - mean_df
        cov_sf += ds_dev * df_dev
        var_s += ds_dev ** 2
        var_f += df_dev ** 2

    cov_sf /= (n - 1)
    var_s /= (n - 1)
    var_f /= (n - 1)

    if var_f < 1e-20:
        return None

    # h* = Cov(DS, DF) / Var(DF)
    h_star = cov_sf / var_f

    # R^2 (hedge effectiveness)
    if var_s > 1e-20:
        r_squared = (cov_sf ** 2) / (var_s * var_f)
    else:
        r_squared = 0.0

    # 상관계수
    rho = cov_sf / (math.sqrt(var_s) * math.sqrt(var_f)) if var_s > 0 and var_f > 0 else 0

    # 헤지 후 분산: Var(DS - h*DF) = Var(DS) - 2h*Cov + h*^2 Var(DF)
    var_hedged = var_s - 2 * h_star * cov_sf + h_star ** 2 * var_f
    # 이론상 var_hedged = var_s * (1 - R^2)
    hedge_reduction = 1 - var_hedged / var_s if var_s > 0 else 0

    return {
        'hedgeRatio': round(h_star, 4),
        'hedgeEfficiency': round(max(0, min(1, r_squared)), 4),
        'correlation': round(rho, 4),
        'varianceReduction': round(max(0, hedge_reduction), 4),
        'spotVolatility': round(math.sqrt(var_s), 4) if var_s > 0 else 0,
        'futuresVolatility': round(math.sqrt(var_f), 4) if var_f > 0 else 0,
        'nObs': n,
    }


def compute_basis_volatility(spot_closes, futures_map):
    """
    베이시스 변동성 분석.
    basis_t = F_t - S_t
    basisVolatility = std(basis) / mean(S) (정규화)

    Args:
        spot_closes: list of (date, close)
        futures_map: dict {date: futures_close}

    Returns:
        dict with basis stats
    """
    basis_series = []
    spot_values = []

    for date_str, spot_close in spot_closes:
        f_close = futures_map.get(date_str)
        if f_close is not None and spot_close > 0:
            basis = f_close - spot_close
            basis_series.append(basis)
            spot_values.append(spot_close)

    if len(basis_series) < MIN_OBS:
        return None

    n = len(basis_series)
    mean_basis = sum(basis_series) / n
    mean_spot = sum(spot_values) / n

    var_basis = sum((b - mean_basis) ** 2 for b in basis_series) / (n - 1) if n > 1 else 0
    std_basis = math.sqrt(var_basis) if var_basis > 0 else 0

    # 정규화 (spot 대비)
    basis_vol_normalized = std_basis / mean_spot if mean_spot > 0 else 0

    # 베이시스 변화율 (basis risk의 핵심)
    basis_changes = [basis_series[i] - basis_series[i - 1] for i in range(1, n)]
    if basis_changes:
        mean_bc = sum(basis_changes) / len(basis_changes)
        var_bc = sum((bc - mean_bc) ** 2 for bc in basis_changes) / (len(basis_changes) - 1) \
            if len(basis_changes) > 1 else 0
        std_bc = math.sqrt(var_bc) if var_bc > 0 else 0
    else:
        std_bc = 0

    return {
        'basisVolatility': round(basis_vol_normalized, 6),
        'basisStd': round(std_basis, 4),
        'basisMean': round(mean_basis, 4),
        'basisChangeStd': round(std_bc, 4),
        'latestBasis': round(basis_series[-1], 4) if basis_series else None,
        'nObs': n,
    }


def compute_calendar_spread(futures_data):
    """
    캘린더 스프레드 통계 (근월물-원월물 스프레드).
    futures_data에 복수 만기 계약이 있을 경우 분석.

    Args:
        futures_data: list of futures records

    Returns:
        dict or None
    """
    # 복수 만기 데이터 탐색
    by_date = {}
    for f in futures_data:
        date_str = f.get('time', '')
        contract = f.get('contractName', '')
        close = f.get('close')
        if not date_str or close is None:
            continue
        if date_str not in by_date:
            by_date[date_str] = []
        by_date[date_str].append({'contract': contract, 'close': close})

    # 같은 날짜에 2개 이상 계약이 있는 경우만
    spread_series = []
    for date_str in sorted(by_date.keys()):
        contracts = by_date[date_str]
        if len(contracts) >= 2:
            # 가격 기준 정렬 (보통 근월물이 원월물보다 낮거나 비슷)
            sorted_c = sorted(contracts, key=lambda c: c['close'])
            spread = sorted_c[-1]['close'] - sorted_c[0]['close']
            spread_series.append({'date': date_str, 'spread': spread})

    if not spread_series:
        return None

    spreads = [s['spread'] for s in spread_series]
    n = len(spreads)
    mean_spread = sum(spreads) / n
    if n > 1:
        var_spread = sum((s - mean_spread) ** 2 for s in spreads) / (n - 1)
    else:
        var_spread = 0

    return {
        'meanSpread': round(mean_spread, 4),
        'stdSpread': round(math.sqrt(var_spread), 4) if var_spread > 0 else 0,
        'latestSpread': round(spreads[-1], 4) if spreads else None,
        'nObs': n,
    }


def main():
    parser = argparse.ArgumentParser(description='KOSPI200 선물 최적 헤지비율 산출')
    parser.add_argument('--window', type=int, default=DEFAULT_WINDOW,
                        help=f'Rolling window days (default {DEFAULT_WINDOW})')
    parser.add_argument('--verbose', action='store_true', help='상세 출력')
    args = parser.parse_args()

    print('=== KOSPI200 Futures Optimal Hedge Ratio ===')
    print(f'  Date: {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print(f'  Window: {args.window} days')

    # ── 스팟 데이터 로드 ──
    spot_path = os.path.join(DATA_DIR, 'market', 'kospi_daily.json')
    spot_data = _load_json(spot_path)
    if not spot_data or not isinstance(spot_data, list):
        print(f'  [ERROR] {spot_path} not found or invalid')
        # Graceful null output
        output = {
            'generated': datetime.now().isoformat(timespec='seconds'),
            'status': 'no_data',
            'message': 'kospi_daily.json not available',
            'hedgeRatio': None,
        }
        os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
        with open(OUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f'  Saved (null): {OUT_PATH}')
        return

    print(f'  Spot data: {len(spot_data)} days loaded')

    # ── 선물 데이터 로드 ──
    futures_path = os.path.join(DATA_DIR, 'derivatives', 'futures_daily.json')
    futures_data = _load_json(futures_path)
    if not futures_data or not isinstance(futures_data, list):
        # derivatives_summary.json에서 futuresClose 추출 시도
        deriv_path = os.path.join(DATA_DIR, 'derivatives', 'derivatives_summary.json')
        deriv_data = _load_json(deriv_path)
        if deriv_data and isinstance(deriv_data, list):
            futures_data = [{'time': d.get('time'), 'close': d.get('futuresClose')}
                            for d in deriv_data if d.get('futuresClose')]
            print(f'  Futures from derivatives_summary: {len(futures_data)} days')
        else:
            print(f'  [ERROR] No futures data available')
            output = {
                'generated': datetime.now().isoformat(timespec='seconds'),
                'status': 'no_data',
                'message': 'futures data not available',
                'hedgeRatio': None,
            }
            os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
            with open(OUT_PATH, 'w', encoding='utf-8') as f:
                json.dump(output, f, ensure_ascii=False, indent=2)
            print(f'  Saved (null): {OUT_PATH}')
            return
    else:
        print(f'  Futures data: {len(futures_data)} days loaded')

    # ── 날짜 매핑 ──
    spot_map = {}
    for s in spot_data:
        date_str = s.get('time', '')
        close = s.get('close')
        if date_str and close is not None:
            spot_map[date_str] = close

    futures_map = {}
    for f in futures_data:
        date_str = f.get('time', '')
        close = f.get('close') or f.get('futuresClose')
        if date_str and close is not None:
            futures_map[date_str] = close

    # ── 정렬된 공통 날짜 추출 ──
    common_dates = sorted(set(spot_map.keys()) & set(futures_map.keys()))
    print(f'  Common dates: {len(common_dates)}')

    if len(common_dates) < MIN_OBS + 1:
        print(f'  [ERROR] Insufficient overlapping data (need {MIN_OBS + 1}+)')
        return

    # ── 가격 변화 계산 ──
    # Window 적용
    window_dates = common_dates[-(args.window + 1):]

    spot_changes = []
    futures_changes = []
    for i in range(1, len(window_dates)):
        ds = spot_map[window_dates[i]] - spot_map[window_dates[i - 1]]
        df = futures_map[window_dates[i]] - futures_map[window_dates[i - 1]]
        spot_changes.append(ds)
        futures_changes.append(df)

    # ── 최소분산 헤지비율 ──
    hedge_result = compute_hedge_ratio(spot_changes, futures_changes)

    # ── 전체 기간 헤지비율 (참고용) ──
    all_spot_changes = []
    all_futures_changes = []
    for i in range(1, len(common_dates)):
        ds = spot_map[common_dates[i]] - spot_map[common_dates[i - 1]]
        df = futures_map[common_dates[i]] - futures_map[common_dates[i - 1]]
        all_spot_changes.append(ds)
        all_futures_changes.append(df)

    full_hedge = compute_hedge_ratio(all_spot_changes, all_futures_changes)

    # ── 베이시스 변동성 ──
    spot_closes_list = [(d, spot_map[d]) for d in common_dates]
    basis_result = compute_basis_volatility(spot_closes_list, futures_map)

    # ── 캘린더 스프레드 ──
    calendar_result = compute_calendar_spread(futures_data)

    # ── 출력 구성 ──
    output = {
        'generated': datetime.now().isoformat(timespec='seconds'),
        'status': 'ok',
        'hedgeRatio': hedge_result.get('hedgeRatio') if hedge_result else None,
        'hedgeEfficiency': hedge_result.get('hedgeEfficiency') if hedge_result else None,
        'rolling': hedge_result,
        'fullPeriod': full_hedge,
        'basisAnalysis': basis_result,
        'calendarSpread': calendar_result,
        'parameters': {
            'window': args.window,
            'min_obs': MIN_OBS,
            'method': 'OLS minimum variance (Johnson 1960, Ederington 1979)',
            'period': f'{common_dates[0]} ~ {common_dates[-1]}' if common_dates else '',
        },
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # ── 결과 출력 ──
    print(f'\n{"=" * 55}')
    print(f'Hedge Ratio 분석 완료')
    print(f'{"=" * 55}')
    if hedge_result:
        print(f'  Hedge Ratio (h*):      {hedge_result["hedgeRatio"]}')
        print(f'  Hedge Efficiency (R2): {hedge_result["hedgeEfficiency"]}')
        print(f'  Correlation:           {hedge_result["correlation"]}')
        print(f'  Variance Reduction:    {hedge_result["varianceReduction"] * 100:.1f}%')
        print(f'  N obs (rolling):       {hedge_result["nObs"]}')
    if full_hedge:
        print(f'\n  Full-period h*:        {full_hedge["hedgeRatio"]}')
        print(f'  Full-period R2:        {full_hedge["hedgeEfficiency"]}')
        print(f'  Full-period N obs:     {full_hedge["nObs"]}')
    if basis_result:
        print(f'\n  Basis Volatility:      {basis_result["basisVolatility"]:.4f}')
        print(f'  Basis Mean:            {basis_result["basisMean"]}')
        print(f'  Latest Basis:          {basis_result["latestBasis"]}')
    if calendar_result:
        print(f'\n  Calendar Spread Mean:  {calendar_result["meanSpread"]}')
        print(f'  Calendar Spread Std:   {calendar_result["stdSpread"]}')
    print(f'\n  저장: {OUT_PATH}')


if __name__ == '__main__':
    main()
