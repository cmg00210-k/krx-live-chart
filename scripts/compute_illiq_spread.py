#!/usr/bin/env python3
"""
Amihud ILLIQ + Roll Spread Proxy -- core_data/18 quantification
Computes per-stock illiquidity ratio and bid-ask spread proxy from OHLCV data.

Output: data/backtest/illiq_spread.json
  { summary: { kospi_large, kospi_mid, kosdaq_large, kosdaq_small },
    stocks: { code: { illiq_20d, illiq_60d, roll_spread, segment } } }

Academic basis:
  Amihud (2002) ILLIQ = (1/D) * sum(|r_t| / DVOL_t)
  Roll (1984) S = 2 * sqrt(max(0, -Cov(dP_t, dP_{t-1})))
"""
import json, os, math, sys

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'illiq_spread.json')

def load_index():
    with open(os.path.join(DATA_DIR, 'index.json'), 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('stocks', data.get('data', []))

def load_candles(market, code):
    path = os.path.join(DATA_DIR, market.lower(), f'{code}.json')
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        d = json.load(f)
    return d.get('candles', [])

def compute_illiq(candles, window=20):
    """Amihud ILLIQ over last `window` trading days."""
    if len(candles) < window + 1:
        return None
    total = 0
    count = 0
    for i in range(len(candles) - window, len(candles)):
        prev_close = candles[i-1]['close']
        if prev_close <= 0:
            continue
        ret = abs((candles[i]['close'] - prev_close) / prev_close)
        dvol = candles[i]['close'] * candles[i]['volume']
        if dvol > 0:
            total += ret / dvol
            count += 1
    if count == 0:
        return None
    return total / count

def compute_roll_spread(candles, window=60):
    """Roll (1984) implicit spread proxy."""
    if len(candles) < window + 2:
        return None
    dps = []
    start = len(candles) - window
    for i in range(start, len(candles)):
        dps.append(candles[i]['close'] - candles[i-1]['close'])
    if len(dps) < 10:
        return None
    # Cov(dP_t, dP_{t-1})
    n = len(dps) - 1
    mean0 = sum(dps[1:]) / n
    mean1 = sum(dps[:-1]) / n
    cov = sum((dps[i+1] - mean0) * (dps[i] - mean1) for i in range(n)) / n
    if cov >= 0:
        return 0.0  # No negative autocovariance => spread not estimable
    return 2 * math.sqrt(-cov)

def classify_segment(market, mcap):
    """Classify stock into ILLIQ segment."""
    if market == 'KOSPI':
        if mcap and mcap > 10_0000_0000_0000:  # > 10 trillion won
            return 'kospi_large'
        return 'kospi_mid'
    else:
        if mcap and mcap > 1_0000_0000_0000:  # > 1 trillion won
            return 'kosdaq_large'
        return 'kosdaq_small'

def main():
    stocks = load_index()
    if isinstance(stocks, dict):
        stock_list = []
        for code, info in stocks.items():
            if isinstance(info, dict):
                info['code'] = code
                stock_list.append(info)
        stocks = stock_list

    results = {}
    segment_illiq = {'kospi_large': [], 'kospi_mid': [], 'kosdaq_large': [], 'kosdaq_small': []}
    total = len(stocks)

    for idx, s in enumerate(stocks):
        code = s.get('code', '')
        market = s.get('market', 'KOSPI')
        mcap = s.get('marketCap', 0)
        if not code:
            continue

        candles = load_candles(market, code)
        if len(candles) < 30:
            continue

        illiq_20 = compute_illiq(candles, 20)
        illiq_60 = compute_illiq(candles, 60)
        roll = compute_roll_spread(candles, 60)
        seg = classify_segment(market, mcap)

        if illiq_20 is not None:
            # Scale to per-million-KRW basis for readability
            illiq_scaled = illiq_20 * 1e6
            results[code] = {
                'illiq_20d': round(illiq_scaled, 6),
                'illiq_60d': round((illiq_60 or 0) * 1e6, 6),
                'roll_spread': round(roll or 0, 2),
                'segment': seg
            }
            segment_illiq[seg].append(illiq_scaled)

        if (idx + 1) % 500 == 0:
            print(f'  [{idx+1}/{total}] processed...')

    # Summary statistics
    summary = {}
    for seg, vals in segment_illiq.items():
        if vals:
            vals.sort()
            summary[seg] = {
                'count': len(vals),
                'mean': round(sum(vals) / len(vals), 6),
                'median': round(vals[len(vals)//2], 6),
                'p25': round(vals[len(vals)//4], 6),
                'p75': round(vals[3*len(vals)//4], 6)
            }

    output = {'summary': summary, 'stocks': results}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'\nILLIQ + Roll Spread computed for {len(results)} stocks')
    for seg, stats in summary.items():
        print(f'  {seg}: n={stats["count"]}, median ILLIQ={stats["median"]:.6f}')
    print(f'Output: {OUT_PATH}')

if __name__ == '__main__':
    main()
