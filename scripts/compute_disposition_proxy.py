#!/usr/bin/env python3
"""
Disposition Effect Proxy -- core_data/18 sec 5 quantification
Approximates disposition ratio via volume asymmetry around reference prices.

Output: data/backtest/disposition_proxy.json

Academic basis:
  Barberis & Xiong (2009): Realization Utility
  Frazzini (2006): Disposition Effect and Underreaction
  Kahneman & Tversky (1979): loss aversion lambda=2.25
"""
import json, os, math, sys
sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'disposition_proxy.json')

def load_index():
    with open(os.path.join(DATA_DIR, 'index.json'), 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('stocks', data.get('data', {}))

def compute_disposition(candles, ref_window=20):
    """
    Disposition ratio = avg_volume_when_above_ref / avg_volume_when_below_ref
    Reference price = SMA(20) as proxy for average cost basis.
    D > 1 => sell winners (profit-taking), hold losers (loss aversion)
    """
    if len(candles) < ref_window + 10:
        return None

    vol_above = []  # volumes when close > reference
    vol_below = []  # volumes when close < reference

    for i in range(ref_window, len(candles)):
        # Reference price = SMA of last ref_window closes
        ref = sum(c['close'] for c in candles[i-ref_window:i]) / ref_window
        close = candles[i]['close']
        vol = candles[i]['volume']
        if vol <= 0 or ref <= 0:
            continue

        if close > ref * 1.01:  # 1% above reference (gain territory)
            vol_above.append(vol)
        elif close < ref * 0.99:  # 1% below reference (loss territory)
            vol_below.append(vol)

    if len(vol_above) < 20 or len(vol_below) < 20:
        return None

    avg_above = sum(vol_above) / len(vol_above)
    avg_below = sum(vol_below) / len(vol_below)

    if avg_below <= 0:
        return None

    disposition_ratio = avg_above / avg_below
    return {
        'ratio': round(disposition_ratio, 4),
        'n_above': len(vol_above),
        'n_below': len(vol_below),
        'avg_vol_above': round(avg_above),
        'avg_vol_below': round(avg_below),
    }

def main():
    stocks = load_index()
    items = stocks.items() if isinstance(stocks, dict) else [(s.get('code',''), s) for s in stocks]

    results = {}
    ratios_kospi = []
    ratios_kosdaq = []
    total = 0

    for code, info in items:
        if not code:
            continue
        market = info.get('market', 'KOSPI') if isinstance(info, dict) else 'KOSPI'
        fpath = os.path.join(DATA_DIR, market.lower(), f'{code}.json')
        if not os.path.exists(fpath):
            continue
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                d = json.load(f)
            candles = d.get('candles', [])
        except:
            continue

        disp = compute_disposition(candles, 20)
        if disp:
            results[code] = disp
            if market == 'KOSPI':
                ratios_kospi.append(disp['ratio'])
            else:
                ratios_kosdaq.append(disp['ratio'])

        total += 1
        if total % 500 == 0:
            print(f'  [{total}] processed...')

    # Summary
    def stats(vals):
        if not vals:
            return {}
        vals.sort()
        return {
            'count': len(vals),
            'mean': round(sum(vals)/len(vals), 4),
            'median': round(vals[len(vals)//2], 4),
            'pct_above_1': round(sum(1 for v in vals if v > 1.0) / len(vals) * 100, 1),
        }

    summary = {
        'kospi': stats(ratios_kospi),
        'kosdaq': stats(ratios_kosdaq),
        'all': stats(ratios_kospi + ratios_kosdaq),
        'theory_prediction': 'D > 1 (sell winners, hold losers) per Kahneman-Tversky lambda=2.25',
    }

    output = {'summary': summary, 'stocks': results}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    all_stats = summary['all']
    print(f'\nDisposition Effect Proxy:')
    print(f'  Total stocks: {all_stats.get("count", 0)}')
    print(f'  Mean ratio: {all_stats.get("mean", 0):.4f} (theory: > 1.0)')
    print(f'  Median ratio: {all_stats.get("median", 0):.4f}')
    print(f'  % with D > 1: {all_stats.get("pct_above_1", 0):.1f}%')
    print(f'  KOSPI mean: {summary["kospi"].get("mean", 0):.4f}')
    print(f'  KOSDAQ mean: {summary["kosdaq"].get("mean", 0):.4f}')
    print(f'Output: {OUT_PATH}')

if __name__ == '__main__':
    main()
