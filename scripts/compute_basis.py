#!/usr/bin/env python3
"""
compute_basis.py -- Futures Basis Fair Value & Z-Score Analysis
Doc27 §1.2 Cost-of-Carry Model: F* = S * exp((r - d) * T)

Reads:
  data/derivatives/derivatives_summary.json  (actual basis, basisPct)
  data/macro/bonds_latest.json               (risk-free rate: KTB 3Y)
  data/market/kospi200_daily.json            (spot index for normalization)

Outputs:
  data/derivatives/basis_analysis.json       (fair value, excess basis, z-score)
"""

import json
import math
import os
import sys
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
DATA = os.path.join(ROOT, 'data')

# Academic constants (Doc27 §1.2)
DIVIDEND_YIELD = 0.017       # KOSPI200 historical average ~1.7% p.a.
ZSCORE_WINDOW = 60           # 60-day rolling window for z-score


def _load_json(path):
    """Load JSON file, return None on failure."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f'  [WARN] Cannot load {path}: {e}')
        return None


def _get_risk_free_rate():
    """KTB 3Y from bonds_latest.json (annualized %)."""
    bonds = _load_json(os.path.join(DATA, 'macro', 'bonds_latest.json'))
    if bonds and 'yields' in bonds and bonds['yields'].get('ktb_3y') is not None:
        return bonds['yields']['ktb_3y'] / 100.0  # 3.37% -> 0.0337
    print('  [WARN] KTB 3Y not available, using default 3.5%')
    return 0.035


def _get_next_expiry(from_date):
    """
    Calculate next KOSPI200 futures expiry date (second Thursday of month).
    If from_date is past this month's expiry, use next month's.
    """
    year, month = from_date.year, from_date.month

    def second_thursday(y, m):
        # First day of month
        first = datetime(y, m, 1)
        # Day of week: 0=Mon ... 6=Sun. Thursday = 3
        dow = first.weekday()
        # First Thursday offset
        first_thu = (3 - dow) % 7 + 1
        return datetime(y, m, first_thu + 7)  # Second Thursday

    expiry = second_thursday(year, month)
    if from_date >= expiry:
        # Move to next month
        if month == 12:
            expiry = second_thursday(year + 1, 1)
        else:
            expiry = second_thursday(year, month + 1)
    return expiry


def compute_fair_value(spot, rfr, div_yield, time_to_expiry_years):
    """
    F* = S * exp((r - d) * T)
    Doc27 §1.2 cost-of-carry model.
    """
    return spot * math.exp((rfr - div_yield) * time_to_expiry_years)


def compute_basis_analysis():
    """Main analysis function."""
    print('=== Futures Basis Analysis (Doc27 §1.2) ===')

    # Load derivatives summary
    deriv_path = os.path.join(DATA, 'derivatives', 'derivatives_summary.json')
    deriv_data = _load_json(deriv_path)
    if not deriv_data:
        print('[ERROR] derivatives_summary.json not found')
        return None

    if isinstance(deriv_data, list):
        if len(deriv_data) == 0:
            print('[ERROR] derivatives_summary.json is empty')
            return None
    else:
        deriv_data = [deriv_data]

    # Get risk-free rate
    rfr = _get_risk_free_rate()
    print(f'  Risk-free rate (KTB 3Y): {rfr*100:.2f}%')
    print(f'  Dividend yield (est.):   {DIVIDEND_YIELD*100:.1f}%')

    # Load spot data for normalization backup
    spot_data = _load_json(os.path.join(DATA, 'market', 'kospi200_daily.json'))
    spot_map = {}
    if spot_data:
        for entry in spot_data:
            spot_map[entry.get('time', '')] = entry.get('close', 0)
        print(f'  KOSPI200 spot data: {len(spot_data)} days')

    results = []
    basis_pct_history = []

    for record in deriv_data:
        date_str = record.get('time', '')
        futures_close = record.get('futuresClose')
        basis = record.get('basis')
        basis_pct = record.get('basisPct')

        if futures_close is None or basis is None:
            continue

        # Derive spot from basis: S = F - basis (since basis = F - S)
        spot = futures_close - basis

        # If spot is unreasonable, try KOSPI200 daily data
        if spot <= 0 and date_str in spot_map:
            spot = spot_map[date_str]

        if spot <= 0:
            continue

        # Time to expiry
        try:
            current_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            continue

        expiry = _get_next_expiry(current_date)
        T = max((expiry - current_date).days, 1) / 365.0

        # Fair value: F* = S * exp((r-d)*T)
        fair_value = compute_fair_value(spot, rfr, DIVIDEND_YIELD, T)
        theoretical_basis = fair_value - spot

        # Excess basis = actual - theoretical (pure sentiment)
        excess_basis = basis - theoretical_basis
        excess_basis_pct = excess_basis / spot * 100 if spot > 0 else 0

        # Track for z-score
        if basis_pct is not None:
            basis_pct_history.append(basis_pct)
        else:
            basis_pct_history.append(basis / spot * 100 if spot > 0 else 0)

        result_entry = {
            'time': date_str,
            'spot': round(spot, 2),
            'futuresClose': futures_close,
            'basis': basis,
            'basisPct': round(basis_pct, 4) if basis_pct is not None else round(basis / spot * 100, 4),
            'fairValue': round(fair_value, 2),
            'theoreticalBasis': round(theoretical_basis, 2),
            'excessBasis': round(excess_basis, 2),
            'excessBasisPct': round(excess_basis_pct, 4),
            'timeToExpiryDays': (expiry - current_date).days,
            'riskFreeRate': round(rfr * 100, 2),
            'dividendYield': round(DIVIDEND_YIELD * 100, 1),
        }

        # Z-score (rolling window or full history)
        if len(basis_pct_history) >= 5:
            window = basis_pct_history[-ZSCORE_WINDOW:]
            mean_b = sum(window) / len(window)
            var_b = sum((x - mean_b) ** 2 for x in window) / len(window)
            std_b = math.sqrt(var_b) if var_b > 0 else 1e-6
            z_score = (basis_pct_history[-1] - mean_b) / std_b
            result_entry['basisZScore'] = round(z_score, 3)
            result_entry['zScoreWindow'] = len(window)
        else:
            result_entry['basisZScore'] = None
            result_entry['zScoreWindow'] = len(basis_pct_history)

        results.append(result_entry)

    if not results:
        print('[WARN] No valid records to analyze')
        return None

    # Print latest analysis
    latest = results[-1]
    print(f'\n  Latest ({latest["time"]}):')
    print(f'    Spot: {latest["spot"]:.2f}  Futures: {latest["futuresClose"]:.2f}')
    print(f'    Actual basis:      {latest["basis"]:.2f} ({latest["basisPct"]:.2f}%)')
    print(f'    Fair value:        {latest["fairValue"]:.2f}')
    print(f'    Theoretical basis: {latest["theoreticalBasis"]:.2f}')
    print(f'    Excess basis:      {latest["excessBasis"]:.2f} ({latest["excessBasisPct"]:.2f}%)')
    print(f'    Time to expiry:    {latest["timeToExpiryDays"]} days')
    if latest['basisZScore'] is not None:
        print(f'    Z-score:           {latest["basisZScore"]:.3f} (window={latest["zScoreWindow"]})')
    else:
        print(f'    Z-score:           insufficient data (need >= 5 days)')

    # Interpretation (Doc27 §5.1)
    bp = latest['basisPct']
    if bp < -2.0:
        regime = 'PANIC backwardation (extreme bearish)'
    elif bp < -0.5:
        regime = 'Backwardation (bearish sentiment)'
    elif bp > 2.0:
        regime = 'Extreme contango (overheated speculation)'
    elif bp > 0.5:
        regime = 'Contango (bullish sentiment)'
    else:
        regime = 'Neutral (arbitrage equilibrium)'
    print(f'    Regime: {regime}')

    # Save output
    out_path = os.path.join(DATA, 'derivatives', 'basis_analysis.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f'\n  Saved: {out_path} ({len(results)} records)')

    return results


if __name__ == '__main__':
    compute_basis_analysis()
