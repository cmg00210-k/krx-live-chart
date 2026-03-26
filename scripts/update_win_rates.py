#!/usr/bin/env python3
"""Beta-Binomial win-rate updater for PATTERN_WIN_RATES.

Reads backtest results (pattern_performance.json) and computes
Beta posterior parameters (alpha, beta) for each pattern.
Writes win_rates_live into rl_policy.json.

If no backtest data exists, generates prior-only parameters
from the hardcoded PATTERN_WIN_RATES and PATTERN_SAMPLE_SIZES
so that posterior mean == current hardcoded value (no behavior change).

Usage:
    python scripts/update_win_rates.py
    python scripts/update_win_rates.py --prior-only
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
POLICY_PATH = os.path.join(ROOT_DIR, 'data', 'backtest', 'rl_policy.json')
PERF_PATH = os.path.join(ROOT_DIR, 'data', 'backtest', 'pattern_performance.json')

# Mirror of patterns.js PATTERN_WIN_RATES (h=5 empirical)
PATTERN_WIN_RATES = {
    'hammer': 47.9, 'invertedHammer': 52.3, 'shootingStar': 56.0, 'hangingMan': 55.2,
    'doji': 42.0, 'dragonflyDoji': 50.0, 'gravestoneDoji': 59.1, 'spinningTop': 43.1,
    'bullishEngulfing': 43.5, 'bearishEngulfing': 56.4, 'bullishHarami': 45.9, 'bearishHarami': 53.7,
    'piercingLine': 37.3, 'darkCloud': 55.1, 'tweezerBottom': 42.6, 'tweezerTop': 54.0,
    'threeWhiteSoldiers': 56.2, 'threeBlackCrows': 63.6, 'morningStar': 42.9, 'eveningStar': 53.3,
    'bullishMarubozu': 42.1, 'bearishMarubozu': 58.1,
    'bullishBeltHold': 55.0, 'bearishBeltHold': 58.0,
    'threeInsideUp': 56.0, 'threeInsideDown': 55.0,
    'abandonedBabyBullish': 53.0, 'abandonedBabyBearish': 53.0,
    'longLeggedDoji': 45.0, 'channel': 58.0,
    'doubleBottom': 65.6, 'doubleTop': 73.0,
    'headAndShoulders': 50.0, 'inverseHeadAndShoulders': 50.0,
    'ascendingTriangle': 41.7, 'descendingTriangle': 58.3,
    'symmetricTriangle': 32.3, 'risingWedge': 64.5, 'fallingWedge': 35.5,
}

PATTERN_SAMPLE_SIZES = {
    'hammer': 380, 'invertedHammer': 503, 'shootingStar': 366, 'hangingMan': 803,
    'doji': 42031, 'dragonflyDoji': 20, 'gravestoneDoji': 22, 'spinningTop': 137246,
    'bullishEngulfing': 20461, 'bearishEngulfing': 24538, 'bullishHarami': 12476, 'bearishHarami': 8650,
    'piercingLine': 102, 'darkCloud': 341, 'tweezerBottom': 660, 'tweezerTop': 783,
    'threeWhiteSoldiers': 633, 'threeBlackCrows': 539, 'morningStar': 5304, 'eveningStar': 4623,
    'bullishMarubozu': 5873, 'bearishMarubozu': 7883,
    'bullishBeltHold': 3200, 'bearishBeltHold': 2800,
    'threeInsideUp': 950, 'threeInsideDown': 720,
    'abandonedBabyBullish': 12, 'abandonedBabyBearish': 10,
    'longLeggedDoji': 8500, 'channel': 1500,
    'doubleBottom': 2930, 'doubleTop': 1699, 'headAndShoulders': 4,
    'inverseHeadAndShoulders': 4, 'ascendingTriangle': 12, 'descendingTriangle': 12,
    'symmetricTriangle': 1252, 'risingWedge': 609, 'fallingWedge': 1420,
}


def compute_prior(wr_pct, n):
    """Compute Beta prior from empirical win rate and sample size."""
    p = wr_pct / 100.0
    alpha = round(p * n, 1)
    beta = round((1 - p) * n, 1)
    return max(alpha, 0.1), max(beta, 0.1)


def main():
    prior_only = '--prior-only' in sys.argv

    # Load existing rl_policy.json
    if not os.path.exists(POLICY_PATH):
        print(f'[WARN] {POLICY_PATH} not found — creating minimal structure')
        policy = {}
    else:
        with open(POLICY_PATH, 'r', encoding='utf-8') as f:
            policy = json.load(f)

    win_rates_live = {}

    if not prior_only and os.path.exists(PERF_PATH):
        # Load backtest performance data
        with open(PERF_PATH, 'r', encoding='utf-8') as f:
            perf = json.load(f)

        for ptype, wr in PATTERN_WIN_RATES.items():
            n_prior = PATTERN_SAMPLE_SIZES.get(ptype, 50)
            alpha_prior, beta_prior = compute_prior(wr, n_prior)

            # Extract h=5 results if available
            pdata = perf.get(ptype, {})
            h5 = pdata.get('5', pdata.get('h5', {}))
            total = h5.get('total_occurrences', h5.get('n', 0))
            win_rate = h5.get('weighted_win_rate', h5.get('win_rate', 0))

            if total > 0:
                wins = round(total * win_rate / 100.0)
                losses = total - wins
                alpha_post = round(alpha_prior + wins, 1)
                beta_post = round(beta_prior + losses, 1)
            else:
                alpha_post, beta_post = alpha_prior, beta_prior

            win_rates_live[ptype] = {'alpha': alpha_post, 'beta': beta_post}

        print(f'[OK] Updated {len(win_rates_live)} patterns from backtest data')
    else:
        # Prior-only mode
        if not prior_only:
            print(f'[INFO] {PERF_PATH} not found — using prior-only (no behavior change)')

        for ptype, wr in PATTERN_WIN_RATES.items():
            n_prior = PATTERN_SAMPLE_SIZES.get(ptype, 50)
            alpha_prior, beta_prior = compute_prior(wr, n_prior)
            win_rates_live[ptype] = {'alpha': alpha_prior, 'beta': beta_prior}

        print(f'[OK] Generated prior-only params for {len(win_rates_live)} patterns')

    policy['win_rates_live'] = win_rates_live

    with open(POLICY_PATH, 'w', encoding='utf-8') as f:
        json.dump(policy, f, indent=2, ensure_ascii=False)

    print(f'[OK] Written to {POLICY_PATH}')


if __name__ == '__main__':
    main()
