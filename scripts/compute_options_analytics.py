#!/usr/bin/env python3
"""
KOSPI200 Option Chain Analytics -- Black-Scholes-Merton Implied Volatility & Greeks

Reads:
  data/derivatives/options_latest.json   (option chain snapshot)
  data/macro/bonds_latest.json           (risk-free rate: KTB 3Y)
  data/market/kospi200_daily.json        (spot index)

Output:
  data/derivatives/options_analytics.json

Metrics:
  - straddleImpliedMove: ATM straddle implied forward move (%)
  - putCallRatio: PCR (volume-based + OI-based)
  - skew25d: 25-delta skew (OTM put IV - OTM call IV)
  - atmIV: ATM implied volatility (annualized)
  - termStructureSlope: near-month vs next-month IV difference
  - maxPainStrike: max pain strike (point of maximum option seller profit)

Academic basis:
  Black & Scholes (1973): European option pricing
  Merton (1973): continuous-dividend extension
  Brenner & Subrahmanyam (1988): ATM IV closed-form approximation
  Bates (1991): skew as crash-risk premium
  core_data/45_option_pricing_strategy.md §1-3

Pure Python: no scipy/numpy dependency.

Usage:
  python scripts/compute_options_analytics.py
  python scripts/compute_options_analytics.py --verbose
"""
import json
import math
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse
from datetime import datetime

# ── 공통 유틸 (api_constants.py) ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from api_constants import normal_cdf as _normal_cdf

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'data')
OUT_PATH = os.path.join(DATA_DIR, 'derivatives', 'options_analytics.json')

# ── Parameters ──
DIVIDEND_YIELD = 0.017       # KOSPI200 historical avg ~1.7% p.a.
DEFAULT_RF = 0.035           # 3.5% fallback
NEWTON_MAX_ITER = 50         # IV Newton-Raphson iterations
NEWTON_TOL = 1e-6            # convergence tolerance
IV_LOWER = 0.01              # 1% floor
IV_UPPER = 3.0               # 300% ceiling


def _normal_pdf(x):
    """표준정규 PDF."""
    return 0.3989422804014327 * math.exp(-0.5 * x * x)


def _bs_price(S, K, T, r, sigma, q, is_call):
    """
    Black-Scholes-Merton 유럽형 옵션 가격.
    S: 기초자산, K: 행사가, T: 잔존기간(년), r: 무위험이자율,
    sigma: 변동성, q: 배당수익률, is_call: True=콜/False=풋
    """
    if T <= 0 or sigma <= 0:
        # 만기 또는 무변동성: 내재가치 반환
        if is_call:
            return max(S - K, 0)
        return max(K - S, 0)

    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T

    if is_call:
        return S * math.exp(-q * T) * _normal_cdf(d1) - K * math.exp(-r * T) * _normal_cdf(d2)
    else:
        return K * math.exp(-r * T) * _normal_cdf(-d2) - S * math.exp(-q * T) * _normal_cdf(-d1)


def _bs_vega(S, K, T, r, sigma, q):
    """BSM Vega = S * exp(-qT) * phi(d1) * sqrt(T)."""
    if T <= 0 or sigma <= 0:
        return 0.0
    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * sqrt_T)
    return S * math.exp(-q * T) * _normal_pdf(d1) * sqrt_T


def implied_volatility(market_price, S, K, T, r, q, is_call):
    """
    내재변동성 추출 (IV inversion).
    Step 1: Brenner-Subrahmanyam (1988) 초기값 — sigma_0 ~= C / (0.4 * S * sqrt(T))
    Step 2: Newton-Raphson refinement (vega-based)

    Returns: IV (annualized) or None if no convergence
    """
    if market_price <= 0 or T <= 0 or S <= 0:
        return None

    # 내재가치 검증 — 내재가치보다 작으면 IV 산출 불가
    intrinsic = max(S * math.exp(-q * T) - K * math.exp(-r * T), 0) if is_call \
        else max(K * math.exp(-r * T) - S * math.exp(-q * T), 0)
    if market_price < intrinsic * 0.99:
        return None

    # Brenner-Subrahmanyam 초기값
    sqrt_T = math.sqrt(T)
    sigma = market_price / (0.4 * S * sqrt_T)
    sigma = max(IV_LOWER, min(IV_UPPER, sigma))

    for _ in range(NEWTON_MAX_ITER):
        price = _bs_price(S, K, T, r, sigma, q, is_call)
        vega = _bs_vega(S, K, T, r, sigma, q)
        if vega < 1e-12:
            break
        diff = price - market_price
        if abs(diff) < NEWTON_TOL:
            return sigma
        sigma -= diff / vega
        sigma = max(IV_LOWER, min(IV_UPPER, sigma))

    # 수렴 실패 시 마지막 값 반환 (오차 범위 내면)
    final_price = _bs_price(S, K, T, r, sigma, q, is_call)
    if abs(final_price - market_price) / max(market_price, 0.01) < 0.05:
        return sigma
    return None


def _bs_delta(S, K, T, r, sigma, q, is_call):
    """BSM Delta."""
    if T <= 0 or sigma <= 0:
        if is_call:
            return 1.0 if S > K else 0.0
        return -1.0 if S < K else 0.0
    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * sqrt_T)
    if is_call:
        return math.exp(-q * T) * _normal_cdf(d1)
    return math.exp(-q * T) * (_normal_cdf(d1) - 1.0)


def _load_json(path):
    """JSON 파일 로드, 실패 시 None."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        return None


def _get_risk_free_rate():
    """KTB 3Y from bonds_latest.json."""
    bonds = _load_json(os.path.join(DATA_DIR, 'macro', 'bonds_latest.json'))
    if bonds and 'yields' in bonds:
        ktb3y = bonds['yields'].get('ktb_3y')
        if ktb3y is not None:
            return float(ktb3y) / 100.0
    return DEFAULT_RF


def _get_spot():
    """KOSPI200 최신 종가 from market data."""
    # kospi200_daily.json 시도
    spot_data = _load_json(os.path.join(DATA_DIR, 'market', 'kospi200_daily.json'))
    if spot_data and isinstance(spot_data, list) and spot_data:
        return spot_data[-1].get('close')
    return None


def compute_max_pain(options):
    """
    Max Pain 계산: 모든 옵션 매도자의 총 손실을 최소화하는 행사가.
    각 행사가를 만기가로 가정 → 전체 콜/풋 OI × max(0, 내재가치) 합계 최소.

    Args:
        options: list of {'strike', 'type'('call'/'put'), 'oi', ...}
    Returns:
        max_pain_strike or None
    """
    strikes = sorted(set(o.get('strike', 0) for o in options if o.get('strike')))
    if not strikes:
        return None

    min_pain = float('inf')
    max_pain_strike = None

    for test_strike in strikes:
        total_pain = 0
        for opt in options:
            K = opt.get('strike', 0)
            oi = opt.get('oi', 0) or opt.get('openInterest', 0) or 0
            if oi <= 0 or K <= 0:
                continue
            opt_type = opt.get('type', '').lower()
            if opt_type == 'call':
                pain = max(test_strike - K, 0) * oi
            elif opt_type == 'put':
                pain = max(K - test_strike, 0) * oi
            else:
                continue
            total_pain += pain

        if total_pain < min_pain:
            min_pain = total_pain
            max_pain_strike = test_strike

    return max_pain_strike


def analyze_options(options, spot, rfr, T, verbose=False):
    """
    옵션 체인 분석.

    Args:
        options: list of option records with strike, type, close/price, volume, oi, etc.
        spot: 기초자산 현재가
        rfr: 무위험이자율 (연율, 소수)
        T: 잔존기간 (년)
        verbose: 상세 출력

    Returns:
        dict with analytics
    """
    q = DIVIDEND_YIELD

    # IV 계산 및 분류
    calls = []
    puts = []

    for opt in options:
        strike = opt.get('strike')
        opt_type = opt.get('type', '').lower()
        price = opt.get('close') or opt.get('price') or opt.get('last') or 0
        volume = opt.get('volume', 0) or 0
        oi = opt.get('oi', 0) or opt.get('openInterest', 0) or 0

        if not strike or strike <= 0 or price <= 0:
            continue

        is_call = opt_type == 'call'
        iv = implied_volatility(price, spot, strike, T, rfr, q, is_call)
        delta = None
        if iv is not None:
            delta = _bs_delta(spot, strike, T, rfr, iv, q, is_call)

        entry = {
            'strike': strike,
            'price': price,
            'volume': volume,
            'oi': oi,
            'iv': iv,
            'delta': delta,
        }

        if is_call:
            calls.append(entry)
        else:
            puts.append(entry)

    if verbose:
        print(f"  Calls: {len(calls)} with IV, Puts: {len(puts)} with IV")

    # ── ATM IV ──
    # ATM = 행사가가 현재가에 가장 가까운 콜/풋
    atm_iv = None
    atm_call_iv = None
    atm_put_iv = None

    if calls:
        atm_call = min(calls, key=lambda c: abs(c['strike'] - spot))
        atm_call_iv = atm_call.get('iv')

    if puts:
        atm_put = min(puts, key=lambda p: abs(p['strike'] - spot))
        atm_put_iv = atm_put.get('iv')

    if atm_call_iv is not None and atm_put_iv is not None:
        atm_iv = (atm_call_iv + atm_put_iv) / 2
    elif atm_call_iv is not None:
        atm_iv = atm_call_iv
    elif atm_put_iv is not None:
        atm_iv = atm_put_iv

    # ── Straddle Implied Move ──
    # ATM 스트래들 가격 = ATM 콜 + ATM 풋 → 기대 변동폭 (%)
    straddle_implied_move = None
    if calls and puts:
        atm_call_entry = min(calls, key=lambda c: abs(c['strike'] - spot))
        atm_put_entry = min(puts, key=lambda p: abs(p['strike'] - spot))
        straddle_price = atm_call_entry['price'] + atm_put_entry['price']
        if spot > 0:
            straddle_implied_move = round((straddle_price / spot) * 100, 2)

    # ── Put-Call Ratio ──
    total_call_vol = sum(c['volume'] for c in calls)
    total_put_vol = sum(p['volume'] for p in puts)
    total_call_oi = sum(c['oi'] for c in calls)
    total_put_oi = sum(p['oi'] for p in puts)

    pcr_volume = round(total_put_vol / total_call_vol, 3) if total_call_vol > 0 else None
    pcr_oi = round(total_put_oi / total_call_oi, 3) if total_call_oi > 0 else None

    # ── 25-Delta Skew ──
    # OTM Put IV (delta ~ -0.25) vs OTM Call IV (delta ~ 0.25)
    skew_25d = None
    put_25d_iv = None
    call_25d_iv = None

    puts_with_delta = [p for p in puts if p['delta'] is not None]
    calls_with_delta = [c for c in calls if c['delta'] is not None]

    if puts_with_delta:
        # put delta는 음수, -0.25에 가장 가까운 것
        put_25d = min(puts_with_delta, key=lambda p: abs(p['delta'] - (-0.25)))
        put_25d_iv = put_25d.get('iv')

    if calls_with_delta:
        call_25d = min(calls_with_delta, key=lambda c: abs(c['delta'] - 0.25))
        call_25d_iv = call_25d.get('iv')

    if put_25d_iv is not None and call_25d_iv is not None:
        skew_25d = round((put_25d_iv - call_25d_iv) * 100, 2)  # 백분율포인트

    # ── Max Pain ──
    max_pain = compute_max_pain(options)

    result = {
        'spot': round(spot, 2),
        'riskFreeRate': round(rfr * 100, 2),
        'timeToExpiryYears': round(T, 4),
        'atmIV': round(atm_iv * 100, 2) if atm_iv is not None else None,
        'straddleImpliedMove': straddle_implied_move,
        'putCallRatio': {
            'volume': pcr_volume,
            'oi': pcr_oi,
        },
        'skew25d': skew_25d,
        'maxPainStrike': max_pain,
        'callCount': len(calls),
        'putCount': len(puts),
        'totalCallVolume': total_call_vol,
        'totalPutVolume': total_put_vol,
        'totalCallOI': total_call_oi,
        'totalPutOI': total_put_oi,
    }

    if verbose:
        print(f"  ATM IV: {result['atmIV']}%")
        print(f"  Straddle Implied Move: {straddle_implied_move}%")
        print(f"  PCR (vol): {pcr_volume}, PCR (OI): {pcr_oi}")
        print(f"  25d Skew: {skew_25d}bp")
        print(f"  Max Pain: {max_pain}")

    return result


def main():
    parser = argparse.ArgumentParser(description='KOSPI200 옵션 분석 (BSM IV + Greeks)')
    parser.add_argument('--verbose', action='store_true', help='상세 출력')
    args = parser.parse_args()

    print('=== KOSPI200 Option Chain Analytics ===')
    print(f'  Date: {datetime.now().strftime("%Y-%m-%d %H:%M")}')

    # ── 입력 데이터 로드 ──
    options_path = os.path.join(DATA_DIR, 'derivatives', 'options_latest.json')
    options_data = _load_json(options_path)

    if not options_data:
        print(f'  [WARN] {options_path} not found or empty — generating null result')
        # 빈 결과 출력 (graceful degradation)
        output = {
            'generated': datetime.now().isoformat(timespec='seconds'),
            'status': 'no_data',
            'message': 'options_latest.json not available',
            'analytics': None,
            'parameters': {
                'model': 'BSM (Black-Scholes-Merton 1973)',
                'iv_method': 'Brenner-Subrahmanyam init + Newton-Raphson',
                'dividend_yield': DIVIDEND_YIELD,
            },
        }
        os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
        with open(OUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f'  Saved (null): {OUT_PATH}')
        return

    # 데이터 형태 검증
    if isinstance(options_data, dict):
        # {near: [...], next: [...]} 또는 {options: [...]} 형태
        near_options = options_data.get('near', options_data.get('options', []))
        next_options = options_data.get('next', [])
    elif isinstance(options_data, list):
        near_options = options_data
        next_options = []
    else:
        print(f'  [ERROR] Unexpected options_latest.json format')
        return

    print(f'  Near-month options: {len(near_options)}')
    if next_options:
        print(f'  Next-month options: {len(next_options)}')

    # ── 기초자산 가격 ──
    spot = _get_spot()
    if spot is None:
        # 옵션 데이터에서 추출 시도
        spot = options_data.get('spot') or options_data.get('underlyingPrice')
    if spot is None or spot <= 0:
        print('  [ERROR] Cannot determine spot price')
        return
    print(f'  Spot (KOSPI200): {spot}')

    # ── 무위험이자율 ──
    rfr = _get_risk_free_rate()
    print(f'  Risk-free rate: {rfr * 100:.2f}%')

    # ── 잔존기간 추정 ──
    T_near = options_data.get('timeToExpiry', options_data.get('daysToExpiry'))
    if T_near is not None:
        if T_near > 1:  # 일수로 제공된 경우
            T_near = T_near / 365.0
    else:
        # 기본값: 만기까지 ~20 거래일 (약 1개월)
        T_near = 20 / 252.0

    T_next = options_data.get('nextTimeToExpiry')
    if T_next is not None:
        if T_next > 1:
            T_next = T_next / 365.0
    else:
        T_next = T_near + 30 / 365.0  # 1개월 추가

    print(f'  Time to expiry (near): {T_near * 365:.0f} days')

    # ── 근월물 분석 ──
    near_result = None
    if near_options:
        print('\n--- Near-month Analysis ---')
        near_result = analyze_options(near_options, spot, rfr, T_near, verbose=args.verbose)

    # ── 원월물 분석 (term structure slope) ──
    next_result = None
    term_structure_slope = None
    if next_options:
        print('\n--- Next-month Analysis ---')
        next_result = analyze_options(next_options, spot, rfr, T_next, verbose=args.verbose)

        if (near_result and near_result.get('atmIV') is not None
                and next_result and next_result.get('atmIV') is not None):
            term_structure_slope = round(
                next_result['atmIV'] - near_result['atmIV'], 2
            )

    # ── 출력 구성 ──
    analytics = near_result or {}
    if term_structure_slope is not None:
        analytics['termStructureSlope'] = term_structure_slope
    else:
        analytics['termStructureSlope'] = None

    output = {
        'generated': datetime.now().isoformat(timespec='seconds'),
        'status': 'ok',
        'analytics': analytics,
        'nearMonth': near_result,
        'nextMonth': next_result,
        'parameters': {
            'model': 'BSM (Black-Scholes-Merton 1973)',
            'iv_method': 'Brenner-Subrahmanyam init + Newton-Raphson',
            'dividend_yield': DIVIDEND_YIELD,
            'newton_max_iter': NEWTON_MAX_ITER,
            'newton_tol': NEWTON_TOL,
        },
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # ── 결과 출력 ──
    print(f'\n{"=" * 55}')
    print(f'Options Analytics 완료')
    print(f'{"=" * 55}')
    if analytics.get('atmIV') is not None:
        print(f'  ATM IV:               {analytics["atmIV"]}%')
    if analytics.get('straddleImpliedMove') is not None:
        print(f'  Straddle Implied Move: {analytics["straddleImpliedMove"]}%')
    pcr = analytics.get('putCallRatio', {})
    if pcr.get('volume') is not None:
        print(f'  PCR (Volume):          {pcr["volume"]}')
    if pcr.get('oi') is not None:
        print(f'  PCR (OI):              {pcr["oi"]}')
    if analytics.get('skew25d') is not None:
        print(f'  25d Skew:              {analytics["skew25d"]}%p')
    if analytics.get('termStructureSlope') is not None:
        print(f'  Term Structure Slope:  {analytics["termStructureSlope"]}%p')
    if analytics.get('maxPainStrike') is not None:
        print(f'  Max Pain Strike:       {analytics["maxPainStrike"]}')
    print(f'\n  저장: {OUT_PATH}')


if __name__ == '__main__':
    main()
