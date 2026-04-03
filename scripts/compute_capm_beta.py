#!/usr/bin/env python3
"""
CAPM Beta Estimation -- core_data/25 quantification
Computes per-stock OLS beta against market proxy with Scholes-Williams correction.

Output: data/backtest/capm_beta.json
  { summary: { kospi: {count, mean_beta, median_beta}, kosdaq: {...} },
    stocks: { code: { beta, alpha, rSquared, thinTrading, nObs } } }

Academic basis:
  Sharpe (1964), Lintner (1965): CAPM beta = Cov(Ri,Rm) / Var(Rm)
  Scholes & Williams (1977): non-synchronous trading correction
  core_data/25_capm_delta_covariance.md sec 1-2

Usage:
  python scripts/compute_capm_beta.py
  python scripts/compute_capm_beta.py --market KOSPI
  python scripts/compute_capm_beta.py --code 005930
  python scripts/compute_capm_beta.py --window 120
"""
import json
import math
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'data')
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'capm_beta.json')

# Parameters (core_data/25 sec 1-2)
DEFAULT_WINDOW = 250   # ~1 KRX trading year
MIN_OBS = 60           # minimum usable observations
THIN_TRADING_THRESH = 0.10  # >10% zero-return days triggers Scholes-Williams


def load_index():
    """Load stock list from data/index.json"""
    idx_path = os.path.join(DATA_DIR, 'index.json')
    with open(idx_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    stocks = data.get('stocks', data.get('data', []))
    if isinstance(stocks, dict):
        stock_list = []
        for code, info in stocks.items():
            if isinstance(info, dict):
                info['code'] = code
                stock_list.append(info)
        return stock_list
    return stocks


def load_candles(market, code):
    """Load per-stock daily OHLCV from data/{market}/{code}.json"""
    fpath = os.path.join(DATA_DIR, market.lower(), f'{code}.json')
    if not os.path.exists(fpath):
        return []
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('candles', data) if isinstance(data, dict) else data


def load_market_closes(market):
    """Load market index closes → {date_str: close} dict"""
    fname = 'kospi_daily.json' if market.upper() == 'KOSPI' else 'kosdaq_daily.json'
    fpath = os.path.join(DATA_DIR, 'market', fname)
    if not os.path.exists(fpath):
        return {}
    with open(fpath, 'r', encoding='utf-8') as f:
        records = json.load(f)
    return {r['time']: r['close'] for r in records if r.get('close')}


def load_rf_annual():
    """Load KTB 10Y from bonds_latest.json, fallback 0"""
    bonds_path = os.path.join(DATA_DIR, 'macro', 'bonds_latest.json')
    if os.path.exists(bonds_path):
        with open(bonds_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        ktb10y = data.get('yields', {}).get('ktb_10y')
        if ktb10y is not None:
            return float(ktb10y)
    # Fallback: macro_latest.json
    macro_path = os.path.join(DATA_DIR, 'macro', 'macro_latest.json')
    if os.path.exists(macro_path):
        with open(macro_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        ktb10y = data.get('ktb10y')
        if ktb10y is not None:
            return float(ktb10y)
    return 0.0


def compute_beta(stock_closes, market_closes_map, window, rf_daily):
    """
    OLS beta + conditional Scholes-Williams correction.
    Mirrors js/indicators.js calcCAPMBeta() lines 375-471.

    Returns dict or None if insufficient data.
    """
    # Build aligned (stock_return, market_return) pairs by date matching
    pairs = []
    prev_sc, prev_mc = None, None
    for c in stock_closes:
        date_str = c.get('time', '')
        sc = c.get('close')
        mc = market_closes_map.get(date_str)
        if sc is None or mc is None or sc <= 0 or mc <= 0:
            prev_sc, prev_mc = sc, mc
            continue
        if prev_sc is not None and prev_mc is not None and prev_sc > 0 and prev_mc > 0:
            ri = (sc - prev_sc) / prev_sc - rf_daily
            rm = (mc - prev_mc) / prev_mc - rf_daily
            pairs.append((ri, rm))
        prev_sc, prev_mc = sc, mc

    # Trim to window
    if len(pairs) > window:
        pairs = pairs[-window:]

    T = len(pairs)
    if T < MIN_OBS:
        return None

    # Zero-return detection for thin-trading flag
    zero_count = sum(1 for ri, _ in pairs if abs(ri) < 1e-10)
    thin_trading = (zero_count / T) > THIN_TRADING_THRESH

    # Mean
    mean_ri = sum(ri for ri, _ in pairs) / T
    mean_rm = sum(rm for _, rm in pairs) / T

    # Covariance and variance
    cov_rm_ri = 0.0
    var_rm = 0.0
    for ri, rm in pairs:
        cov_rm_ri += (ri - mean_ri) * (rm - mean_rm)
        var_rm += (rm - mean_rm) ** 2

    if var_rm < 1e-20:
        return None

    beta0 = cov_rm_ri / var_rm
    alpha0 = mean_ri - beta0 * mean_rm

    beta_final = beta0

    # Scholes-Williams correction (core_data/25 sec 2.1)
    if thin_trading and T > 3:
        # Lead/lag covariances
        cov_lag = 0.0   # Cov(ri_t, rm_{t-1})
        cov_lead = 0.0  # Cov(ri_t, rm_{t+1})
        auto_rm = 0.0   # Cov(rm_t, rm_{t-1}) for rho_m

        for t in range(1, T):
            ri_t = pairs[t][0] - mean_ri
            rm_t = pairs[t][1] - mean_rm
            rm_prev = pairs[t - 1][1] - mean_rm
            cov_lag += ri_t * rm_prev
            auto_rm += rm_t * rm_prev

        for t in range(0, T - 1):
            ri_t = pairs[t][0] - mean_ri
            rm_next = pairs[t + 1][1] - mean_rm
            cov_lead += ri_t * rm_next

        beta_lag = cov_lag / var_rm if var_rm > 1e-20 else 0
        beta_lead = cov_lead / var_rm if var_rm > 1e-20 else 0
        rho_m = auto_rm / var_rm if var_rm > 1e-20 else 0

        denom_sw = 1 + 2 * rho_m
        if abs(denom_sw) > 0.01:
            beta_final = (beta_lag + beta0 + beta_lead) / denom_sw

    # R-squared with final beta
    alpha_final = mean_ri - beta_final * mean_rm
    ss_res = 0.0
    ss_tot = 0.0
    for ri, rm in pairs:
        predicted = alpha_final + beta_final * rm
        ss_res += (ri - predicted) ** 2
        ss_tot += (ri - mean_ri) ** 2
    r_squared = 1 - ss_res / ss_tot if ss_tot > 1e-20 else 0.0

    # Alpha annualized (250 trading days)
    alpha_annual = alpha_final * 250

    return {
        'beta': round(beta_final, 3),
        'alpha': round(alpha_annual, 4),
        'rSquared': round(max(0, min(1, r_squared)), 3),
        'thinTrading': thin_trading,
        'nObs': T,
    }


def main():
    parser = argparse.ArgumentParser(description='CAPM Beta computation')
    parser.add_argument('--market', type=str, default=None, help='KOSPI or KOSDAQ')
    parser.add_argument('--code', type=str, default=None, help='Single stock code')
    parser.add_argument('--window', type=int, default=DEFAULT_WINDOW, help=f'Rolling window (default {DEFAULT_WINDOW})')
    args = parser.parse_args()

    stocks = load_index()
    rf_annual = load_rf_annual()
    rf_daily = (1 + rf_annual / 100) ** (1 / 250) - 1 if rf_annual > 0 else 0.0
    print(f"Risk-free rate: {rf_annual}% annual -> {rf_daily:.6f} daily")
    print(f"Window: {args.window}, Min obs: {MIN_OBS}")

    # Pre-load market index closes
    market_data = {}
    for m in ('KOSPI', 'KOSDAQ'):
        market_data[m] = load_market_closes(m)
        print(f"Market index [{m}]: {len(market_data[m])} days loaded")

    # Filter stocks
    if args.code:
        stocks = [s for s in stocks if s.get('code') == args.code]
    elif args.market:
        stocks = [s for s in stocks if s.get('market', '').upper() == args.market.upper()]

    print(f"Processing {len(stocks)} stocks...")

    results = {}
    segment_betas = {'KOSPI': [], 'KOSDAQ': []}
    skipped = 0

    for i, s in enumerate(stocks):
        code = s.get('code', '')
        market = s.get('market', 'KOSPI').upper()
        if market not in market_data or not market_data[market]:
            skipped += 1
            continue

        candles = load_candles(market, code)
        if len(candles) < MIN_OBS:
            skipped += 1
            continue

        result = compute_beta(candles, market_data[market], args.window, rf_daily)
        if result is None:
            skipped += 1
            continue

        results[code] = result
        segment_betas[market].append(result['beta'])

        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(stocks)} processed ({len(results)} ok, {skipped} skipped)")

    # Summary statistics
    def stats(vals):
        if not vals:
            return {'count': 0}
        vals_sorted = sorted(vals)
        n = len(vals_sorted)
        return {
            'count': n,
            'mean_beta': round(sum(vals_sorted) / n, 3),
            'median_beta': round(vals_sorted[n // 2], 3),
            'p25_beta': round(vals_sorted[n // 4], 3),
            'p75_beta': round(vals_sorted[3 * n // 4], 3),
            'min_beta': round(vals_sorted[0], 3),
            'max_beta': round(vals_sorted[-1], 3),
        }

    summary = {
        'kospi': stats(segment_betas['KOSPI']),
        'kosdaq': stats(segment_betas['KOSDAQ']),
        'total': stats(segment_betas['KOSPI'] + segment_betas['KOSDAQ']),
        'parameters': {
            'window': args.window,
            'min_obs': MIN_OBS,
            'rf_annual_pct': rf_annual,
            'thin_trading_threshold': THIN_TRADING_THRESH,
            'scholes_williams': True,
        },
    }

    output = {'summary': summary, 'stocks': results}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nComplete: {len(results)} stocks computed, {skipped} skipped")
    print(f"KOSPI: {summary['kospi']}")
    print(f"KOSDAQ: {summary['kosdaq']}")
    print(f"Saved: {OUT_PATH}")


if __name__ == '__main__':
    main()
