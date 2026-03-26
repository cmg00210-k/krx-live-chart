#!/usr/bin/env python3
"""Platt scaling calibrator for composite signal confidence.

Fits logistic parameters (a, b) per composite signal so that:
    P(correct) = 1 / (1 + exp(-(a * conf/100 + b)))

Reads composite performance from pattern_performance.json (or backtest output).
Writes platt_params into rl_policy.json.

If no calibration data exists, generates identity-like defaults
[0.04, -2.0] that produce near-linear mapping in the 50-80 range.

Usage:
    python scripts/calibrate_composites.py
    python scripts/calibrate_composites.py --default
"""

import json
import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
POLICY_PATH = os.path.join(ROOT_DIR, 'data', 'backtest', 'rl_policy.json')
PERF_PATH = os.path.join(ROOT_DIR, 'data', 'backtest', 'composite_performance.json')

# Mirror of signalEngine.js _predMap (18 composite signals)
COMPOSITE_IDS = [
    'strongBuy_hammerRsiVolume', 'strongSell_shootingMacdVol',
    'buy_goldenCrossRsi', 'sell_deadCrossMacd',
    'buy_bbBounceRsi', 'sell_bbBreakoutRsi',
    'buy_hammerBBVol', 'sell_shootingStarBBVol',
    'buy_morningStarRsiVol', 'sell_eveningStarRsiVol',
    'buy_engulfingMacdAlign', 'sell_engulfingMacdAlign',
    'buy_doubleBottomNeckVol', 'sell_doubleTopNeckVol',
    'buy_ichimokuTriple', 'sell_ichimokuTriple',
    'buy_goldenMarubozuVol', 'sell_deadMarubozuVol',
]

# Default Platt params: near-identity in 50-80% confidence range
# a=4.0, b=-2.0 → sigmoid(4.0*0.6 - 2.0)=0.55, sigmoid(4.0*0.7-2.0)=0.69
# This preserves existing confidencePred values when no calibration data available
DEFAULT_PARAMS = [4.0, -2.0]


def fit_platt(conf_values, outcomes):
    """Simple Platt fitting via gradient descent (Newton-Raphson).

    Args:
        conf_values: list of raw confidence / 100
        outcomes: list of 0/1 (loss/win)

    Returns:
        (a, b) parameters
    """
    n = len(conf_values)
    if n < 5:
        return DEFAULT_PARAMS

    # Initialize: a from logit of mean outcome, b from intercept
    mean_out = sum(outcomes) / n
    mean_out = max(0.01, min(0.99, mean_out))
    b = math.log(mean_out / (1 - mean_out))
    a = 0.01

    lr = 0.01
    for _ in range(200):
        grad_a, grad_b = 0.0, 0.0
        for x, y in zip(conf_values, outcomes):
            z = a * x + b
            z = max(-10, min(10, z))
            p = 1.0 / (1.0 + math.exp(-z))
            err = p - y
            grad_a += err * x
            grad_b += err
        grad_a /= n
        grad_b /= n
        a -= lr * grad_a
        b -= lr * grad_b

    return [round(a, 4), round(b, 4)]


def main():
    use_default = '--default' in sys.argv

    # Load existing rl_policy.json
    if not os.path.exists(POLICY_PATH):
        print(f'[WARN] {POLICY_PATH} not found — creating minimal structure')
        policy = {}
    else:
        with open(POLICY_PATH, 'r', encoding='utf-8') as f:
            policy = json.load(f)

    platt_params = {}

    if not use_default and os.path.exists(PERF_PATH):
        with open(PERF_PATH, 'r', encoding='utf-8') as f:
            perf = json.load(f)

        for cid in COMPOSITE_IDS:
            cdata = perf.get(cid, {})
            conf_values = cdata.get('conf_values', [])
            outcomes = cdata.get('outcomes', [])

            if len(conf_values) >= 5:
                params = fit_platt(conf_values, outcomes)
                platt_params[cid] = params
                print(f'  {cid}: a={params[0]}, b={params[1]}')
            else:
                platt_params[cid] = list(DEFAULT_PARAMS)

        print(f'[OK] Calibrated {len(platt_params)} composites from performance data')
    else:
        if not use_default:
            print(f'[INFO] {PERF_PATH} not found — using identity-like defaults')

        for cid in COMPOSITE_IDS:
            platt_params[cid] = list(DEFAULT_PARAMS)

        print(f'[OK] Generated default Platt params for {len(platt_params)} composites')

    policy['platt_params'] = platt_params

    with open(POLICY_PATH, 'w', encoding='utf-8') as f:
        json.dump(policy, f, indent=2, ensure_ascii=False)

    print(f'[OK] Written to {POLICY_PATH}')


if __name__ == '__main__':
    main()
