#!/usr/bin/env python3
"""
채권 지표 계산기 — Duration, Convexity, DV01, 수익률곡선 형상 분류

입력:
  data/macro/bonds_latest.json  ← 최신 수익률 스냅샷
  data/macro/bonds_history.json ← 월별 시계열 (추세 분석용)

출력:
  data/macro/bond_metrics.json
    { benchmarks: { ktb_3y: {yield, macaulayDuration, modifiedDuration, dv01, convexity}, ... },
      curveShape: { classification, slope_10y_3y, slope_30y_10y, curvature },
      keyRateDurations: { 1y, 3y, 5y, 10y, 20y, 30y } }

학술 근거:
  Fabozzi (2007), Bond Markets, Analysis and Strategies
  core_data/44_bond_pricing_theory.md — Duration/Convexity/DV01

사용법:
  python scripts/compute_bond_metrics.py
  python scripts/compute_bond_metrics.py --verbose
"""
import json
import math
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'data')
MACRO_DIR = os.path.join(DATA_DIR, 'macro')

LATEST_FILE = os.path.join(MACRO_DIR, 'bonds_latest.json')
HISTORY_FILE = os.path.join(MACRO_DIR, 'bonds_history.json')
OUT_PATH = os.path.join(MACRO_DIR, 'bond_metrics.json')

# 벤치마크 국고채 종목 (만기 연수)
BENCHMARKS = {
    'ktb_3y':  3,
    'ktb_10y': 10,
    'ktb_30y': 30,
}

# 수익률곡선 분석용 전체 만기 포인트
ALL_TENORS = {
    'ktb_1y':  1,
    'ktb_2y':  2,
    'ktb_3y':  3,
    'ktb_5y':  5,
    'ktb_10y': 10,
    'ktb_20y': 20,
    'ktb_30y': 30,
}

# DV01 산출용 yield bump (1bp = 0.01%)
DV01_BUMP_BP = 1


def compute_bond_price(coupon_rate, ytm, maturity_years, face=100):
    """
    채권 가격 계산 (반기 이표, Fabozzi ch.4).

    Parameters:
        coupon_rate: 연간 쿠폰금리 (%, 예: 3.25)
        ytm:         만기수익률 (%, 예: 3.25)
        maturity_years: 잔존 만기 (년)
        face:        액면가

    Returns:
        float: 채권 가격
    """
    n = int(maturity_years * 2)  # 반기 기간 수
    c = (coupon_rate / 100) * face / 2  # 반기 쿠폰
    y = (ytm / 100) / 2  # 반기 수익률

    if y <= 0:
        # zero/negative yield: 단순 합산
        return c * n + face

    price = 0.0
    for t in range(1, n + 1):
        price += c / (1 + y) ** t
    price += face / (1 + y) ** n

    return price


def compute_macaulay_duration(coupon_rate, ytm, maturity_years, face=100):
    """
    Macaulay Duration (반기 이표 채권).

    D_mac = (1/P) * sum_{t=1}^{2n} [ t * CF_t / (1+y/2)^t ]
    여기서 CF_t = 반기 쿠폰 (t < 2n), 반기 쿠폰 + 액면 (t = 2n)
    결과는 반기 단위 → 연 단위로 /2 변환.

    Academic: Fabozzi (2007) ch.4, Macaulay (1938)
    """
    n = int(maturity_years * 2)
    c = (coupon_rate / 100) * face / 2
    y = (ytm / 100) / 2

    if n <= 0:
        return 0.0

    if y <= 0:
        # edge case: zero yield
        price = c * n + face
        if price <= 0:
            return 0.0
        weighted_sum = sum(t * c for t in range(1, n + 1)) + n * face
        return (weighted_sum / price) / 2.0

    price = 0.0
    weighted_sum = 0.0

    for t in range(1, n + 1):
        cf = c
        if t == n:
            cf += face
        discounted = cf / (1 + y) ** t
        price += discounted
        weighted_sum += t * discounted

    if price <= 0:
        return 0.0

    # 반기 단위 duration → 연 단위
    return (weighted_sum / price) / 2.0


def compute_convexity(coupon_rate, ytm, maturity_years, face=100):
    """
    Convexity (반기 이표 채권).

    C = (1/P) * sum_{t=1}^{2n} [ t*(t+1) * CF_t / (1+y/2)^{t+2} ]
    결과는 반기 단위 → 연 단위로 /4 변환.

    Academic: Fabozzi (2007) ch.4
    """
    n = int(maturity_years * 2)
    c = (coupon_rate / 100) * face / 2
    y = (ytm / 100) / 2

    if n <= 0 or y <= 0:
        return 0.0

    price = compute_bond_price(coupon_rate, ytm, maturity_years, face)
    if price <= 0:
        return 0.0

    conv_sum = 0.0
    for t in range(1, n + 1):
        cf = c
        if t == n:
            cf += face
        conv_sum += t * (t + 1) * cf / (1 + y) ** (t + 2)

    # 반기 단위 → 연 단위: /4
    return (conv_sum / price) / 4.0


def compute_bond_metrics(coupon_rate, ytm, maturity_years, face=100):
    """
    채권 지표 일괄 계산.

    Returns:
        dict: {macaulay_duration, modified_duration, dv01, convexity}
    """
    mac_dur = compute_macaulay_duration(coupon_rate, ytm, maturity_years, face)

    # Modified Duration = D_mac / (1 + y/2)
    y_semi = (ytm / 100) / 2
    mod_dur = mac_dur / (1 + y_semi) if (1 + y_semi) > 0 else mac_dur

    # DV01 = P * D_mod * 0.0001 (per 100 face)
    price = compute_bond_price(coupon_rate, ytm, maturity_years, face)
    dv01 = price * mod_dur * 0.0001

    # Convexity
    convexity = compute_convexity(coupon_rate, ytm, maturity_years, face)

    return {
        'macaulay_duration': round(mac_dur, 4),
        'modified_duration': round(mod_dur, 4),
        'dv01': round(dv01, 4),
        'convexity': round(convexity, 4),
    }


def classify_curve_shape(yields_data, verbose=False):
    """
    수익률곡선 형상 분류.

    slope = 10Y - 3Y
    curvature = 2*5Y - 3Y - 10Y (butterfly spread)

    분류:
      normal:   slope > 0.5
      flat:     |slope| <= 0.5
      inverted: slope < -0.5
      humped:   curvature > 0.3 (5Y가 볼록)

    Academic: Litterman & Scheinkman (1991) — level/slope/curvature 3-factor
    """
    ktb_3y = yields_data.get('ktb_3y')
    ktb_5y = yields_data.get('ktb_5y')
    ktb_10y = yields_data.get('ktb_10y')
    ktb_30y = yields_data.get('ktb_30y')

    result = {
        'classification': 'unknown',
        'slope_10y_3y': None,
        'slope_30y_10y': None,
        'curvature': None,
    }

    # Slope: 10Y - 3Y
    if ktb_10y is not None and ktb_3y is not None:
        slope = ktb_10y - ktb_3y
        result['slope_10y_3y'] = round(slope, 4)

        # Curvature (butterfly): 2*5Y - 3Y - 10Y
        if ktb_5y is not None:
            curvature = 2 * ktb_5y - ktb_3y - ktb_10y
            result['curvature'] = round(curvature, 4)

            # 분류: humped가 우선 (curvature가 큰 경우)
            if curvature > 0.3:
                result['classification'] = 'humped'
            elif slope > 0.5:
                result['classification'] = 'normal'
            elif slope < -0.5:
                result['classification'] = 'inverted'
            else:
                result['classification'] = 'flat'
        else:
            # 5Y 없이 slope만으로 분류
            if slope > 0.5:
                result['classification'] = 'normal'
            elif slope < -0.5:
                result['classification'] = 'inverted'
            else:
                result['classification'] = 'flat'

        if verbose:
            print(f"  기울기 10Y-3Y: {slope:+.4f}%p")
            if result['curvature'] is not None:
                print(f"  곡률 (butterfly): {result['curvature']:+.4f}%p")
            print(f"  분류: {result['classification']}")

    # Slope: 30Y - 10Y
    if ktb_30y is not None and ktb_10y is not None:
        result['slope_30y_10y'] = round(ktb_30y - ktb_10y, 4)

    return result


def compute_key_rate_durations(yields_data, verbose=False):
    """
    Key Rate Duration (KRD) 근사 계산.

    각 만기 포인트에서 yield를 1bp 상승시킨 후 포트폴리오 가격 변화로 KRD 추정.
    단일 par bond 가정: 해당 만기의 par bond만 영향 받음.

    KRD_i = -(1/P) * dP/dy_i ≈ (P(y_i - 1bp) - P(y_i + 1bp)) / (2 * P * 0.0001)

    Academic: Ho (1992), Key Rate Durations
    """
    krd = {}

    for key, maturity in ALL_TENORS.items():
        ytm = yields_data.get(key)
        if ytm is None:
            krd[key] = 0.0
            continue

        # Par bond: coupon = ytm
        bump = DV01_BUMP_BP * 0.01  # 1bp in %
        price_base = compute_bond_price(ytm, ytm, maturity)
        price_up = compute_bond_price(ytm, ytm + bump, maturity)
        price_down = compute_bond_price(ytm, ytm - bump, maturity)

        if price_base > 0:
            # KRD = -(dP/dy) / P, finite difference
            krd_val = -(price_up - price_down) / (2 * bump / 100 * price_base)
            krd[key] = round(krd_val, 4)
        else:
            krd[key] = 0.0

    if verbose:
        print("  Key Rate Durations:")
        for key in sorted(krd, key=lambda k: ALL_TENORS.get(k, 0)):
            print(f"    {key}: {krd[key]:.4f}")

    return krd


def main():
    parser = argparse.ArgumentParser(description='채권 지표 계산 (Duration/Convexity/DV01)')
    parser.add_argument('--verbose', action='store_true', help='상세 출력')
    args = parser.parse_args()

    print("=" * 60)
    print("  채권 지표 계산기")
    print("  Duration, Convexity, DV01, 수익률곡선 형상")
    print("=" * 60)

    # ── 입력 데이터 로드 ──
    if not os.path.exists(LATEST_FILE):
        print(f"\n[BOND-METRICS] 오류: {os.path.relpath(LATEST_FILE, ROOT_DIR)} 파일 없음")
        print("  먼저 download_bonds.py를 실행하세요.")
        sys.exit(1)

    with open(LATEST_FILE, 'r', encoding='utf-8') as f:
        latest = json.load(f)

    # Source guard — reject fake/sample/demo data
    _src = latest.get('source', '')
    if _src in ('sample', 'seed', 'demo'):
        print(f'[BOND-METRICS] Skipping: source={_src} (not real data)')
        sys.exit(0)

    yields_data = latest.get('yields', {})
    updated = latest.get('updated', 'unknown')
    print(f"\n[BOND-METRICS] 데이터 기준일: {updated}")

    n_yields = sum(1 for v in yields_data.values() if v is not None)
    print(f"  수익률 데이터: {n_yields}/{len(ALL_TENORS)} 만기")

    if n_yields == 0:
        print("[BOND-METRICS] 오류: 수익률 데이터가 모두 null입니다.")
        sys.exit(1)

    # ── 벤치마크 지표 계산 ──
    print("\n[BOND-METRICS] 벤치마크 지표 계산 중...")
    benchmarks = {}

    for key, maturity in BENCHMARKS.items():
        ytm = yields_data.get(key)
        if ytm is None:
            print(f"  {key}: 수익률 없음 — 건너뜀")
            continue

        # Par bond 가정: coupon = ytm
        metrics = compute_bond_metrics(ytm, ytm, maturity)

        benchmarks[key] = {
            'yield': ytm,
            'macaulayDuration': metrics['macaulay_duration'],
            'modifiedDuration': metrics['modified_duration'],
            'dv01': metrics['dv01'],
            'convexity': metrics['convexity'],
        }

        print(f"  {key} (YTM={ytm:.3f}%, 만기={maturity}Y):")
        print(f"    Macaulay Duration: {metrics['macaulay_duration']:.4f}년")
        print(f"    Modified Duration: {metrics['modified_duration']:.4f}년")
        print(f"    DV01:              {metrics['dv01']:.4f} (per 100)")
        print(f"    Convexity:         {metrics['convexity']:.4f}")

    # ── 수익률곡선 형상 분류 ──
    print("\n[BOND-METRICS] 수익률곡선 형상 분류...")
    curve_shape = classify_curve_shape(yields_data, args.verbose)

    # ── Key Rate Duration ──
    print("\n[BOND-METRICS] Key Rate Duration 계산...")
    krd = compute_key_rate_durations(yields_data, args.verbose)

    # ── 출력 ──
    output = {
        'generated': datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
        'data_date': updated,
        'benchmarks': benchmarks,
        'curveShape': curve_shape,
        'keyRateDurations': krd,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # ── 요약 ──
    print("\n" + "=" * 60)
    print("  계산 완료 요약")
    print("=" * 60)
    print(f"  벤치마크: {len(benchmarks)}/{len(BENCHMARKS)} 종목")
    print(f"  곡선 형상: {curve_shape['classification']}")
    if curve_shape['slope_10y_3y'] is not None:
        print(f"  기울기 10Y-3Y: {curve_shape['slope_10y_3y']:+.4f}%p")
    if curve_shape['slope_30y_10y'] is not None:
        print(f"  기울기 30Y-10Y: {curve_shape['slope_30y_10y']:+.4f}%p")
    if curve_shape['curvature'] is not None:
        print(f"  곡률 (butterfly): {curve_shape['curvature']:+.4f}%p")
    print(f"  KRD 포인트: {sum(1 for v in krd.values() if v != 0.0)}/{len(krd)}")
    print(f"  저장: {os.path.relpath(OUT_PATH, ROOT_DIR)}")
    print(f"\n[BOND-METRICS] 완료")


if __name__ == '__main__':
    main()
