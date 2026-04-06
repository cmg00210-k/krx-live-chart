#!/usr/bin/env python3
"""
CSAD Herding Coefficient -- core_data/19 sec 5.2 quantification
Computes Cross-Sectional Absolute Deviation and CCK regression beta_2.

Output: data/backtest/csad_herding.json
  { daily: [{date, csad, r_market, beta2_60d, herding_flag}], summary: {...} }

Academic basis:
  Chang, Cheng & Khorana (2000): CSAD = (1/N)*sum(|R_i - R_m|)
  Herding test: CSAD = a + b1*|R_m| + b2*(R_m)^2 + e
  beta_2 < 0 => herding (dispersion decreases in extreme markets)
"""
import json, os, math, sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'csad_herding.json')

def load_all_returns():
    """Load daily returns for all stocks, organized by date."""
    index_path = os.path.join(DATA_DIR, 'index.json')
    with open(index_path, 'r', encoding='utf-8') as f:
        index_data = json.load(f)
    stocks = index_data.get('stocks', index_data.get('data', {}))

    # date -> list of (return, market)
    date_returns = defaultdict(list)
    total = 0

    for code, info in (stocks.items() if isinstance(stocks, dict) else [(s.get('code',''), s) for s in stocks]):
        if not code:
            continue
        market = info.get('market', 'KOSPI') if isinstance(info, dict) else 'KOSPI'
        fpath = os.path.join(DATA_DIR, market.lower(), f'{code}.json')
        if not os.path.exists(fpath):
            continue
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                d = json.load(f)
            # Source guard — reject fake/sample/demo data
            _src = d.get('source', '')
            if _src in ('sample', 'seed', 'demo'):
                continue
            candles = d.get('candles', [])
        except (json.JSONDecodeError, OSError, KeyError) as e:
            continue

        for i in range(1, len(candles)):
            prev = candles[i-1]['close']
            if prev <= 0:
                continue
            ret = (candles[i]['close'] - prev) / prev
            date_returns[candles[i]['time']].append((ret, market))

        total += 1
        if total % 500 == 0:
            print(f'  [{total}] stocks loaded...')

    print(f'  Total {total} stocks loaded, {len(date_returns)} trading days')
    return date_returns

def compute_csad_series(date_returns):
    """Compute daily CSAD and market return."""
    dates = sorted(date_returns.keys())
    results = []

    for date in dates:
        rets = [r for r, m in date_returns[date]]
        if len(rets) < 50:  # Need minimum cross-section
            continue

        r_market = sum(rets) / len(rets)  # Equal-weighted market return
        csad = sum(abs(r - r_market) for r in rets) / len(rets)

        # Separate KOSPI / KOSDAQ
        kospi_rets = [r for r, m in date_returns[date] if m == 'KOSPI']
        kosdaq_rets = [r for r, m in date_returns[date] if m != 'KOSPI']

        results.append({
            'date': date,
            'csad': csad,
            'r_market': r_market,
            'n_stocks': len(rets),
            'csad_kospi': sum(abs(r - sum(kospi_rets)/max(len(kospi_rets),1)) for r in kospi_rets) / max(len(kospi_rets),1) if kospi_rets else None,
            'csad_kosdaq': sum(abs(r - sum(kosdaq_rets)/max(len(kosdaq_rets),1)) for r in kosdaq_rets) / max(len(kosdaq_rets),1) if kosdaq_rets else None,
        })

    return results

def ols_regression(y, X):
    """Simple OLS: y = X*beta + e. X is list of [x1, x2, ...] rows."""
    n = len(y)
    k = len(X[0])
    # X'X
    XtX = [[sum(X[i][a]*X[i][b] for i in range(n)) for b in range(k)] for a in range(k)]
    # X'y
    Xty = [sum(X[i][a]*y[i] for i in range(n)) for a in range(k)]
    # Solve via Cramer (for k=3)
    if k == 3:
        det = (XtX[0][0]*(XtX[1][1]*XtX[2][2]-XtX[1][2]*XtX[2][1])
              -XtX[0][1]*(XtX[1][0]*XtX[2][2]-XtX[1][2]*XtX[2][0])
              +XtX[0][2]*(XtX[1][0]*XtX[2][1]-XtX[1][1]*XtX[2][0]))
        if abs(det) < 1e-15:
            return None
        inv = [[0]*3 for _ in range(3)]
        inv[0][0] = (XtX[1][1]*XtX[2][2]-XtX[1][2]*XtX[2][1])/det
        inv[0][1] = (XtX[0][2]*XtX[2][1]-XtX[0][1]*XtX[2][2])/det
        inv[0][2] = (XtX[0][1]*XtX[1][2]-XtX[0][2]*XtX[1][1])/det
        inv[1][0] = (XtX[1][2]*XtX[2][0]-XtX[1][0]*XtX[2][2])/det
        inv[1][1] = (XtX[0][0]*XtX[2][2]-XtX[0][2]*XtX[2][0])/det
        inv[1][2] = (XtX[0][2]*XtX[1][0]-XtX[0][0]*XtX[1][2])/det
        inv[2][0] = (XtX[1][0]*XtX[2][1]-XtX[1][1]*XtX[2][0])/det
        inv[2][1] = (XtX[0][1]*XtX[2][0]-XtX[0][0]*XtX[2][1])/det
        inv[2][2] = (XtX[0][0]*XtX[1][1]-XtX[0][1]*XtX[1][0])/det
        beta = [sum(inv[a][b]*Xty[b] for b in range(3)) for a in range(3)]
        return beta
    return None

def add_herding_flag(series, window=60):
    """Add rolling 60-day CCK beta_2 and herding flag."""
    for i in range(window, len(series)):
        window_data = series[i-window:i]
        y = [d['csad'] for d in window_data]
        X = [[1.0, abs(d['r_market']), d['r_market']**2] for d in window_data]
        beta = ols_regression(y, X)
        if beta:
            series[i]['beta2_60d'] = round(beta[2], 6)
            # Herding classification
            if beta[2] < -0.003:
                series[i]['herding_flag'] = 2  # extreme
            elif beta[2] < -0.001:
                series[i]['herding_flag'] = 1  # mild
            else:
                series[i]['herding_flag'] = 0  # normal
        else:
            series[i]['beta2_60d'] = None
            series[i]['herding_flag'] = 0

def main():
    print('Loading all stock returns...')
    date_returns = load_all_returns()

    print('Computing daily CSAD...')
    series = compute_csad_series(date_returns)

    print(f'Adding herding flags (60-day rolling CCK regression)...')
    add_herding_flag(series, 60)

    # Summary
    beta2_vals = [d['beta2_60d'] for d in series if d.get('beta2_60d') is not None]
    herding_days = sum(1 for d in series if d.get('herding_flag', 0) >= 1)
    extreme_days = sum(1 for d in series if d.get('herding_flag', 0) >= 2)

    summary = {
        'total_days': len(series),
        'herding_days_mild': herding_days,
        'herding_days_extreme': extreme_days,
        'herding_pct': round(herding_days / max(len(series),1) * 100, 1),
        'beta2_mean': round(sum(beta2_vals)/max(len(beta2_vals),1), 6) if beta2_vals else None,
        'beta2_median': round(sorted(beta2_vals)[len(beta2_vals)//2], 6) if beta2_vals else None,
    }

    # Trim daily output to last 252 days for file size
    recent = series[-252:] if len(series) > 252 else series
    output = {'summary': summary, 'daily': recent}

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'\nCSAD Herding Analysis:')
    print(f'  Total days: {summary["total_days"]}')
    print(f'  Herding days (mild+): {summary["herding_days_mild"]} ({summary["herding_pct"]}%)')
    print(f'  Herding days (extreme): {summary["herding_days_extreme"]}')
    print(f'  Mean beta_2: {summary["beta2_mean"]}')
    print(f'Output: {OUT_PATH}')

if __name__ == '__main__':
    main()
