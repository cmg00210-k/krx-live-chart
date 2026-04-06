#!/usr/bin/env python3
"""
HMM Regime Identification -- core_data/21 sec 2 quantification
Fits 2-state Gaussian HMM to KOSPI-proxy daily returns via EM algorithm.

Output: data/backtest/hmm_regimes.json

Academic basis:
  Hamilton (1989): Regime-switching models
  Baum-Welch EM algorithm for HMM parameter estimation

Note: Pure numpy implementation (no hmmlearn dependency).
"""
import json, os, math, sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'hmm_regimes.json')

def load_kospi_returns():
    """Compute cap-weighted KOSPI-proxy daily returns."""
    index_path = os.path.join(DATA_DIR, 'index.json')
    with open(index_path, 'r', encoding='utf-8') as f:
        idx = json.load(f)
    stocks = idx.get('stocks', idx.get('data', {}))

    date_weighted = defaultdict(lambda: [0.0, 0.0])  # date -> [sum(r*mcap), sum(mcap)]
    total = 0

    items = stocks.items() if isinstance(stocks, dict) else [(s.get('code',''), s) for s in stocks]
    for code, info in items:
        if not code:
            continue
        if not isinstance(info, dict):
            continue
        market = info.get('market', 'KOSPI')
        if market != 'KOSPI':
            continue
        mcap = info.get('marketCap', 0) or 1
        fpath = os.path.join(DATA_DIR, 'kospi', f'{code}.json')
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
            r = (candles[i]['close'] - prev) / prev
            date = candles[i]['time']
            date_weighted[date][0] += r * mcap
            date_weighted[date][1] += mcap

        total += 1
        if total % 200 == 0:
            print(f'  [{total}] KOSPI stocks loaded...')

    dates = sorted(date_weighted.keys())
    returns = []
    for d in dates:
        w_sum, mcap_sum = date_weighted[d]
        if mcap_sum > 0:
            returns.append((d, w_sum / mcap_sum))

    print(f'  KOSPI proxy: {len(returns)} trading days from {total} stocks')
    return returns

def gaussian_pdf(x, mu, sigma):
    """Normal PDF."""
    if sigma <= 0:
        sigma = 1e-10
    return (1.0 / (sigma * math.sqrt(2 * math.pi))) * math.exp(-0.5 * ((x - mu) / sigma) ** 2)

def fit_hmm_2state(returns, n_iter=50):
    """
    Baum-Welch EM for 2-state Gaussian HMM.
    State 0 = Bull (high mean, low vol), State 1 = Bear (low mean, high vol)
    """
    N = len(returns)
    if N < 100:
        return None

    obs = [r for _, r in returns]

    # Initialize parameters
    mu = [0.001, -0.002]     # Bull +0.1%/day, Bear -0.2%/day
    sigma = [0.01, 0.02]     # Bull 1%, Bear 2%
    trans = [[0.98, 0.02], [0.05, 0.95]]  # High persistence
    pi = [0.6, 0.4]          # Start probability

    for iteration in range(n_iter):
        # Forward pass
        alpha = [[0.0, 0.0] for _ in range(N)]
        for s in range(2):
            alpha[0][s] = pi[s] * gaussian_pdf(obs[0], mu[s], sigma[s])
        # Normalize
        scale = [0.0] * N
        scale[0] = sum(alpha[0]) or 1e-300
        alpha[0] = [a / scale[0] for a in alpha[0]]

        for t in range(1, N):
            for j in range(2):
                alpha[t][j] = sum(alpha[t-1][i] * trans[i][j] for i in range(2)) * gaussian_pdf(obs[t], mu[j], sigma[j])
            scale[t] = sum(alpha[t]) or 1e-300
            alpha[t] = [a / scale[t] for a in alpha[t]]

        # Backward pass
        beta = [[0.0, 0.0] for _ in range(N)]
        beta[N-1] = [1.0, 1.0]
        for t in range(N-2, -1, -1):
            for i in range(2):
                beta[t][i] = sum(trans[i][j] * gaussian_pdf(obs[t+1], mu[j], sigma[j]) * beta[t+1][j] for j in range(2))
            s = sum(beta[t]) or 1e-300
            beta[t] = [b / s for b in beta[t]]

        # Gamma (posterior state probability)
        gamma = [[0.0, 0.0] for _ in range(N)]
        for t in range(N):
            denom = sum(alpha[t][s] * beta[t][s] for s in range(2)) or 1e-300
            for s in range(2):
                gamma[t][s] = alpha[t][s] * beta[t][s] / denom

        # Xi (transition posterior)
        xi_sum = [[0.0, 0.0], [0.0, 0.0]]
        for t in range(N-1):
            denom = 0.0
            for i in range(2):
                for j in range(2):
                    denom += alpha[t][i] * trans[i][j] * gaussian_pdf(obs[t+1], mu[j], sigma[j]) * beta[t+1][j]
            denom = denom or 1e-300
            for i in range(2):
                for j in range(2):
                    xi_sum[i][j] += alpha[t][i] * trans[i][j] * gaussian_pdf(obs[t+1], mu[j], sigma[j]) * beta[t+1][j] / denom

        # M-step: update parameters
        for s in range(2):
            gamma_sum = sum(gamma[t][s] for t in range(N)) or 1e-300
            mu[s] = sum(gamma[t][s] * obs[t] for t in range(N)) / gamma_sum
            sigma[s] = math.sqrt(sum(gamma[t][s] * (obs[t] - mu[s])**2 for t in range(N)) / gamma_sum)
            sigma[s] = max(sigma[s], 1e-6)

        for i in range(2):
            gamma_sum_t = sum(gamma[t][i] for t in range(N-1)) or 1e-300
            for j in range(2):
                trans[i][j] = xi_sum[i][j] / gamma_sum_t
            # Normalize
            s = sum(trans[i]) or 1
            trans[i] = [t / s for t in trans[i]]

        pi = [gamma[0][s] for s in range(2)]

    # Ensure state 0 = Bull (higher mean)
    if mu[0] < mu[1]:
        mu = [mu[1], mu[0]]
        sigma = [sigma[1], sigma[0]]
        trans = [[trans[1][1], trans[1][0]], [trans[0][1], trans[0][0]]]
        gamma = [[g[1], g[0]] for g in gamma]

    # Viterbi decoding
    viterbi = [0] * N
    for t in range(N):
        viterbi[t] = 0 if gamma[t][0] > gamma[t][1] else 1

    return {
        'mu': [round(m * 100, 4) for m in mu],  # in %
        'sigma': [round(s * 100, 4) for s in sigma],  # in %
        'transition_matrix': [[round(t, 4) for t in row] for row in trans],
        'bull_duration_days': round(1 / max(trans[0][1], 1e-6), 1),
        'bear_duration_days': round(1 / max(trans[1][0], 1e-6), 1),
        'gamma': gamma,
        'viterbi': viterbi,
    }

def main():
    print('Loading KOSPI returns...')
    returns = load_kospi_returns()

    print(f'Fitting 2-state HMM ({len(returns)} observations, 50 EM iterations)...')
    result = fit_hmm_2state(returns, n_iter=50)

    if not result:
        print('ERROR: Insufficient data for HMM fitting')
        return

    # Daily regime assignments (last 252 days)
    dates = [d for d, r in returns]
    daily = []
    start = max(0, len(dates) - 252)
    for i in range(start, len(dates)):
        daily.append({
            'date': dates[i],
            'bull_prob': round(result['gamma'][i][0], 4),
            'regime': 'bull' if result['viterbi'][i] == 0 else 'bear',
        })

    # Count regime days
    bull_days = sum(1 for v in result['viterbi'] if v == 0)
    bear_days = sum(1 for v in result['viterbi'] if v == 1)

    output = {
        'model': '2-state Gaussian HMM (Hamilton 1989)',
        'parameters': {
            'mu_bull_pct': result['mu'][0],
            'mu_bear_pct': result['mu'][1],
            'sigma_bull_pct': result['sigma'][0],
            'sigma_bear_pct': result['sigma'][1],
            'transition_matrix': result['transition_matrix'],
            'bull_avg_duration_days': result['bull_duration_days'],
            'bear_avg_duration_days': result['bear_duration_days'],
        },
        'summary': {
            'total_days': len(returns),
            'bull_days': bull_days,
            'bear_days': bear_days,
            'bull_pct': round(bull_days / len(returns) * 100, 1),
        },
        'daily': daily,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'\n=== HMM Regime Results ===')
    print(f'  Bull: mu={result["mu"][0]:.4f}%/day, sigma={result["sigma"][0]:.4f}%')
    print(f'  Bear: mu={result["mu"][1]:.4f}%/day, sigma={result["sigma"][1]:.4f}%')
    print(f'  Bull duration: ~{result["bull_duration_days"]:.0f} days')
    print(f'  Bear duration: ~{result["bear_duration_days"]:.0f} days')
    print(f'  Bull days: {bull_days} ({round(bull_days/len(returns)*100,1)}%)')
    print(f'Output: {OUT_PATH}')

if __name__ == '__main__':
    main()
