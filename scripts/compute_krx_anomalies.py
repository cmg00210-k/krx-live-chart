#!/usr/bin/env python3
"""
KRX Structural Anomalies Quantification -- core_data/20
Computes: magnet effect frequency, TOM effect, circuit breaker events, limit-hits.

Output: data/backtest/krx_anomalies.json

Academic basis:
  Du, Liu & Rhee (2009) magnet effect
  Park & Byun (2022) TOM in KOSDAQ
  Subrahmanyam (1994) circuit breakers
"""
import json, os, math, sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'krx_anomalies.json')

def load_all_daily_returns():
    """Load daily returns for all stocks, return {code: [(date, return, volume, market)]}."""
    index_path = os.path.join(DATA_DIR, 'index.json')
    with open(index_path, 'r', encoding='utf-8') as f:
        idx = json.load(f)
    stocks = idx.get('stocks', idx.get('data', {}))

    all_rets = {}
    market_daily = defaultdict(list)  # date -> list of (return, mcap)
    total = 0

    items = stocks.items() if isinstance(stocks, dict) else [(s.get('code',''), s) for s in stocks]
    for code, info in items:
        if not code:
            continue
        market = info.get('market', 'KOSPI') if isinstance(info, dict) else 'KOSPI'
        mcap = info.get('marketCap', 0) if isinstance(info, dict) else 0
        fpath = os.path.join(DATA_DIR, market.lower(), f'{code}.json')
        if not os.path.exists(fpath):
            continue
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                d = json.load(f)
            candles = d.get('candles', [])
        except (json.JSONDecodeError, OSError, KeyError) as e:
            continue

        rets = []
        for i in range(1, len(candles)):
            prev = candles[i-1]['close']
            if prev <= 0:
                continue
            r = (candles[i]['close'] - prev) / prev
            rets.append((candles[i]['time'], r, candles[i]['volume'], market))
            market_daily[candles[i]['time']].append((r, mcap or 1))

        if rets:
            all_rets[code] = rets
        total += 1
        if total % 500 == 0:
            print(f'  [{total}] stocks loaded...')

    return all_rets, market_daily

def compute_magnet_effect(all_rets):
    """Count near-limit returns (|r| > 0.25) and actual limit hits (|r| > 0.29)."""
    near_limit = 0  # 25-29%
    limit_hit = 0   # > 29%
    total_obs = 0
    limit_dates = []

    for code, rets in all_rets.items():
        for date, r, vol, mkt in rets:
            total_obs += 1
            ar = abs(r)
            if ar > 0.29:
                limit_hit += 1
                limit_dates.append(date)
            elif ar > 0.25:
                near_limit += 1

    return {
        'total_observations': total_obs,
        'near_limit_25_29pct': near_limit,
        'limit_hit_29pct_plus': limit_hit,
        'near_limit_rate_bps': round(near_limit / max(total_obs,1) * 10000, 2),
        'limit_hit_rate_bps': round(limit_hit / max(total_obs,1) * 10000, 2),
        'unique_limit_dates': len(set(limit_dates)),
    }

def compute_tom_effect(all_rets):
    """Turn-of-Month: last 3 + first 2 days vs mid-month."""
    from datetime import datetime
    tom_returns = []
    mid_returns = []

    for code, rets in all_rets.items():
        for date_str, r, vol, mkt in rets:
            try:
                dt = datetime.strptime(date_str[:10], '%Y-%m-%d')
            except (ValueError, TypeError):
                continue
            day = dt.day
            # Last 3 days: day >= 27 (approximate)
            # First 2 days: day <= 2
            if day >= 27 or day <= 2:
                tom_returns.append(r)
            else:
                mid_returns.append(r)

    tom_mean = sum(tom_returns) / max(len(tom_returns), 1)
    mid_mean = sum(mid_returns) / max(len(mid_returns), 1)

    # T-test
    n1, n2 = len(tom_returns), len(mid_returns)
    if n1 > 30 and n2 > 30:
        var1 = sum((r - tom_mean)**2 for r in tom_returns) / (n1 - 1)
        var2 = sum((r - mid_mean)**2 for r in mid_returns) / (n2 - 1)
        se = math.sqrt(var1/n1 + var2/n2) if (var1/n1 + var2/n2) > 0 else 1
        t_stat = (tom_mean - mid_mean) / se
    else:
        t_stat = 0

    return {
        'tom_mean_return_pct': round(tom_mean * 100, 4),
        'mid_mean_return_pct': round(mid_mean * 100, 4),
        'tom_premium_bps': round((tom_mean - mid_mean) * 10000, 2),
        'tom_n': n1,
        'mid_n': n2,
        't_statistic': round(t_stat, 3),
        'significant_5pct': abs(t_stat) > 1.96,
    }

def compute_circuit_breaker_events(market_daily):
    """Approximate KOSPI index returns and count CB-level events."""
    dates = sorted(market_daily.keys())
    cb_events = {'level1_8pct': [], 'level2_15pct': [], 'level3_20pct': []}
    kospi_returns = []

    for date in dates:
        rets_mcaps = market_daily[date]
        # Cap-weighted return
        total_mcap = sum(mc for r, mc in rets_mcaps)
        if total_mcap <= 0:
            continue
        kospi_r = sum(r * mc for r, mc in rets_mcaps) / total_mcap
        kospi_returns.append((date, kospi_r))

        if kospi_r < -0.08:
            cb_events['level1_8pct'].append(date)
        if kospi_r < -0.15:
            cb_events['level2_15pct'].append(date)
        if kospi_r < -0.20:
            cb_events['level3_20pct'].append(date)

    return {
        'total_trading_days': len(kospi_returns),
        'level1_8pct_count': len(cb_events['level1_8pct']),
        'level2_15pct_count': len(cb_events['level2_15pct']),
        'level3_20pct_count': len(cb_events['level3_20pct']),
        'level1_dates': cb_events['level1_8pct'][:20],
        'kospi_daily_std_pct': round(
            math.sqrt(sum(r**2 for d,r in kospi_returns)/max(len(kospi_returns),1)) * 100, 3
        ) if kospi_returns else None,
    }

def main():
    print('Loading all stock returns...')
    all_rets, market_daily = load_all_daily_returns()
    print(f'  {len(all_rets)} stocks loaded')

    print('Computing magnet effect...')
    magnet = compute_magnet_effect(all_rets)

    print('Computing TOM effect...')
    tom = compute_tom_effect(all_rets)

    print('Computing circuit breaker events...')
    cb = compute_circuit_breaker_events(market_daily)

    output = {
        'magnet_effect': magnet,
        'turn_of_month': tom,
        'circuit_breakers': cb,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'\n=== KRX Anomalies Report ===')
    print(f'Magnet Effect:')
    print(f'  Near-limit (25-29%): {magnet["near_limit_25_29pct"]} ({magnet["near_limit_rate_bps"]} bps)')
    print(f'  Limit hits (>29%): {magnet["limit_hit_29pct_plus"]} ({magnet["limit_hit_rate_bps"]} bps)')
    print(f'TOM Effect:')
    print(f'  TOM mean: {tom["tom_mean_return_pct"]:.4f}%, Mid: {tom["mid_mean_return_pct"]:.4f}%')
    print(f'  Premium: {tom["tom_premium_bps"]:.2f} bps, t={tom["t_statistic"]:.3f}, sig={tom["significant_5pct"]}')
    print(f'Circuit Breakers:')
    print(f'  Level 1 (-8%): {cb["level1_8pct_count"]} days')
    print(f'  Level 2 (-15%): {cb["level2_15pct_count"]} days')
    print(f'Output: {OUT_PATH}')

if __name__ == '__main__':
    main()
