#!/usr/bin/env python3
"""
Macro Composite Score v2 (MCS v2) -- Multi-Source Weighted Composite

Reads:
  data/macro/kosis_latest.json    (CLI, ESI, IPI, retail, employment)
  data/macro/macro_latest.json    (aggregated macro: KTB, BOK rate, CPI, exports, etc.)
  data/macro/bonds_latest.json    (yield curve, credit spreads)

Output:
  data/macro/macro_composite.json

Metrics:
  - mcsV2:            weighted composite score 0-100 (percentile rank)
  - taylorGap:        actual policy rate - Taylor rule estimate
  - yieldCurvePhase:  steepening/flattening/normal/inverted
  - creditCyclePhase: expansion/peak/contraction/trough
  - lastUpdated:      ISO date

Academic basis:
  Taylor (1993): Discretion versus policy rules in practice
  Estrella & Mishkin (1998): Predicting U.S. recessions (yield curve)
  Bernanke & Gertler (1989): Credit cycle and business fluctuations
  OECD (2012): Composite Leading Indicators methodology
  core_data/29_behavioral_market_sentiment.md §2.2 (CSI/ESI)

Pure Python: no scipy/numpy dependency.

Usage:
  python scripts/compute_macro_composite.py
  python scripts/compute_macro_composite.py --verbose
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
OUT_PATH = os.path.join(MACRO_DIR, 'macro_composite.json')

# ── MCS v2 가중치 (합계 = 1.0) ──
# 각 지표가 경기 순환에 대한 예측력/설명력 기준으로 가중치 할당
# OECD CLI 방법론 + 한국 특수성 반영
MCS_WEIGHTS = {
    'cli':                  0.20,   # OECD CLI — 가장 포괄적 선행지표
    'esi':                  0.15,   # 경제심리지수 — 소비자+기업 심리 통합
    'ipi':                  0.15,   # 산업생산지수 — 실물경제 대리변수
    'consumer_confidence':  0.10,   # 소비자신뢰 (BSI or CSI proxy)
    'pmi':                  0.10,   # PMI proxy (BSI 제조업)
    'exports':              0.10,   # 수출 YoY — 한국 수출 의존도 반영
    'unemployment_inv':     0.10,   # 실업률 역수 — 고용 건전성
    'yield_spread':         0.10,   # 금리스프레드 — 경기 선행 (Estrella & Mishkin)
}

# ── Taylor Rule 파라미터 (Taylor 1993) ──
# r = r* + pi + 0.5*(pi - pi*) + 0.5*(y - y*)
TAYLOR_R_STAR = 0.5        # 균형실질이자율 (한국, 최근 추정)
TAYLOR_PI_STAR = 2.0       # 한은 물가안정목표 (2%)
TAYLOR_OUTPUT_GAP = 0.0    # 산출갭 추정 (실시간 불가, 0 가정)

# ── 정규화를 위한 역사적 참조값 ──
# 2020=100 기준 지수의 합리적 범위
CLI_RANGE = (80, 130)       # 선행종합지수 합리적 범위
ESI_RANGE = (60, 120)       # 경제심리지수
IPI_RANGE = (70, 130)       # 산업생산지수
UNEMP_RANGE = (2.0, 6.0)   # 실업률 범위 (%)
EXPORT_RANGE = (-30, 40)    # 수출 YoY (%)
SPREAD_RANGE = (-1.0, 3.0)  # 장단기 금리스프레드 (%p)
BSI_RANGE = (50, 120)       # BSI 범위
CSI_RANGE = (60, 130)       # 소비자심리 범위


# ── MCS v2 가중치 합계 검증 ──
_weight_sum = sum(MCS_WEIGHTS.values())
if abs(_weight_sum - 1.0) > 0.001:
    print(f'[WARN] MCS_WEIGHTS sum={_weight_sum:.4f}, expected 1.0 — results may be incorrect')


def _load_json(path):
    """JSON 파일 로드, 실패 시 None."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _normalize_range(value, low, high):
    """
    값을 [low, high] 범위에서 0-1로 정규화.
    범위 밖이면 0 또는 1로 클램프.
    """
    if high <= low:
        return 0.5
    normed = (value - low) / (high - low)
    return max(0.0, min(1.0, normed))


def _normal_cdf(x):
    """표준정규 CDF (Abramowitz & Stegun)."""
    if x > 6:
        return 1.0
    if x < -6:
        return 0.0
    neg = x < 0
    if neg:
        x = -x
    t = 1.0 / (1.0 + 0.2316419 * x)
    d = 0.3989422804014327 * math.exp(-0.5 * x * x)
    p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937
        + t * (-1.821255978 + t * 1.330274429))))
    return p if neg else 1.0 - p


def compute_mcs_v2(kosis, ecos, macro, bonds, verbose=False):
    """
    MCS v2: 가중 복합 점수 (0-100).

    각 지표를 z-score 또는 range 정규화 → 가중 평균 → percentile 변환 → 0-100.
    누락 지표는 제외하고 가중치 재분배.
    """
    indicators = {}
    available_weight = 0.0

    # ── 1. CLI (선행종합지수) — KOSIS ──
    cli = None
    if kosis:
        cli = kosis.get('cli_composite')
    if cli is None and macro:
        cli = macro.get('korea_cli')
    if cli is not None:
        indicators['cli'] = _normalize_range(cli, *CLI_RANGE)
        available_weight += MCS_WEIGHTS['cli']
        if verbose:
            print(f'  CLI: {cli} -> {indicators["cli"]:.3f}')

    # ── 2. ESI (경제심리지수) — KOSIS ──
    esi = None
    if kosis:
        esi = kosis.get('esi')
    if esi is not None:
        indicators['esi'] = _normalize_range(esi, *ESI_RANGE)
        available_weight += MCS_WEIGHTS['esi']
        if verbose:
            print(f'  ESI: {esi} -> {indicators["esi"]:.3f}')

    # ── 3. IPI (산업생산지수) — KOSIS 또는 ECOS ──
    ipi = None
    if kosis:
        ipi = kosis.get('ipi_all')
    if ipi is None and macro:
        ipi = macro.get('ipi')
    if ipi is not None:
        indicators['ipi'] = _normalize_range(ipi, *IPI_RANGE)
        available_weight += MCS_WEIGHTS['ipi']
        if verbose:
            print(f'  IPI: {ipi} -> {indicators["ipi"]:.3f}')

    # ── 4. Consumer Confidence (소비자신뢰) ──
    # KOSIS ESI를 CSI proxy로 사용 (Doc29 §2.2), 또는 macro_latest BSI
    csi = None
    if kosis:
        csi = kosis.get('esi')  # ESI ≈ CSI in Korea context
    if csi is None and macro:
        csi = macro.get('bsi_mfg')  # BSI 제조업 대리
    if csi is not None:
        indicators['consumer_confidence'] = _normalize_range(csi, *CSI_RANGE)
        available_weight += MCS_WEIGHTS['consumer_confidence']
        if verbose:
            print(f'  CSI/BSI: {csi} -> {indicators["consumer_confidence"]:.3f}')

    # ── 5. PMI proxy (BSI 제조업) ──
    pmi = None
    if macro:
        pmi = macro.get('bsi_mfg')
    if pmi is not None:
        indicators['pmi'] = _normalize_range(pmi, *BSI_RANGE)
        available_weight += MCS_WEIGHTS['pmi']
        if verbose:
            print(f'  PMI/BSI: {pmi} -> {indicators["pmi"]:.3f}')

    # ── 6. Exports YoY ──
    exports = None
    if macro:
        exports = macro.get('export_yoy')
    if exports is not None:
        indicators['exports'] = _normalize_range(exports, *EXPORT_RANGE)
        available_weight += MCS_WEIGHTS['exports']
        if verbose:
            print(f'  Exports YoY: {exports}% -> {indicators["exports"]:.3f}')

    # ── 7. Unemployment inverse ──
    # 실업률이 낮을수록 좋음 → 역수 사용
    unemp = None
    if macro:
        unemp = macro.get('unemployment_rate')
    if unemp is not None and unemp > 0:
        # 역전: 높은 실업률 = 나쁨, 낮은 실업률 = 좋음
        inv_norm = 1.0 - _normalize_range(unemp, *UNEMP_RANGE)
        indicators['unemployment_inv'] = inv_norm
        available_weight += MCS_WEIGHTS['unemployment_inv']
        if verbose:
            print(f'  Unemployment: {unemp}% -> inv {inv_norm:.3f}')

    # ── 8. Yield Spread (장단기 스프레드) ──
    spread = None
    if macro:
        spread = macro.get('term_spread')
    if spread is None and bonds:
        spread = bonds.get('slope_10y3y')
    if spread is None and kosis:
        spread = kosis.get('rate_spread_5y')
    if spread is not None:
        indicators['yield_spread'] = _normalize_range(spread, *SPREAD_RANGE)
        available_weight += MCS_WEIGHTS['yield_spread']
        if verbose:
            print(f'  Yield Spread: {spread}%p -> {indicators["yield_spread"]:.3f}')

    # ── 가중 합산 (누락 지표 가중치 재분배) ──
    if not indicators or available_weight <= 0:
        return None

    weighted_sum = 0.0
    for key, norm_val in indicators.items():
        weight_key = key
        raw_weight = MCS_WEIGHTS.get(weight_key, 0)
        adj_weight = raw_weight / available_weight  # 재분배
        weighted_sum += norm_val * adj_weight

    # 0-100 스케일 변환
    mcs_score = round(weighted_sum * 100, 1)

    return {
        'mcsV2': mcs_score,
        'components': {k: round(v, 4) for k, v in indicators.items()},
        'availableIndicators': len(indicators),
        'totalIndicators': len(MCS_WEIGHTS),
        'effectiveWeight': round(available_weight, 3),
    }


def compute_taylor_gap(macro, ecos):
    """
    Taylor Gap = 실제 기준금리 - Taylor 규칙 추정치.

    Taylor (1993):
      r_taylor = r* + pi + 0.5*(pi - pi*) + 0.5*(y - y*)

    음수 → 완화적 (실제 금리가 Taylor보다 낮음)
    양수 → 긴축적 (실제 금리가 Taylor보다 높음)
    """
    # 기준금리
    bok_rate = None
    if macro:
        bok_rate = macro.get('bok_rate')
    if bok_rate is None:
        return None

    # CPI YoY
    cpi_yoy = None
    if macro:
        cpi_yoy = macro.get('cpi_yoy')
    if cpi_yoy is None:
        return None

    # 기존 Taylor 계산이 macro_latest에 있으면 참조
    existing_gap = None
    if macro:
        existing_gap = macro.get('taylor_gap')

    # Taylor rule 계산
    pi = cpi_yoy
    r_taylor = TAYLOR_R_STAR + pi + 0.5 * (pi - TAYLOR_PI_STAR) + 0.5 * TAYLOR_OUTPUT_GAP

    gap = bok_rate - r_taylor

    return {
        'taylorGap': round(gap, 4),
        'taylorRate': round(r_taylor, 4),
        'actualRate': bok_rate,
        'cpiYoY': cpi_yoy,
        'rStar': TAYLOR_R_STAR,
        'piStar': TAYLOR_PI_STAR,
        'outputGap': TAYLOR_OUTPUT_GAP,
        'existingGap': existing_gap,
    }


def compute_yield_curve_phase(bonds, macro):
    """
    수익률곡선 국면 분류.

    10Y-3Y 스프레드 수준 + 변화 방향 → 4-phase:
      - normal:      spread > 0, stable or increasing
      - steepening:  spread > 0, increasing rapidly
      - flattening:  spread > 0, decreasing
      - inverted:    spread <= 0

    Estrella & Mishkin (1998): 10Y-3M spread < 0 → 경기침체 선행 6-18개월
    """
    spread = None
    if bonds:
        spread = bonds.get('slope_10y3y')
    if spread is None and macro:
        spread = macro.get('term_spread')

    if spread is None:
        return None

    # 역전 여부
    is_inverted = False
    if bonds:
        is_inverted = bonds.get('curve_inverted', False)
    if spread <= 0:
        is_inverted = True

    # 스프레드 수준 기반 4-phase 분류
    if is_inverted or spread <= 0:
        phase = 'inverted'
        description = '수익률곡선 역전 — 경기침체 선행 신호'
    elif spread > 1.5:
        phase = 'steepening'
        description = '수익률곡선 급경사 — 경기 확장 기대'
    elif spread > 0.5:
        phase = 'normal'
        description = '수익률곡선 정상 — 안정적 경기'
    else:
        phase = 'flattening'
        description = '수익률곡선 평탄화 — 경기 둔화 가능'

    return {
        'yieldCurvePhase': phase,
        'spread_10y3y': round(spread, 3) if spread is not None else None,
        'isInverted': is_inverted,
        'description': description,
    }


def compute_credit_cycle_phase(bonds):
    """
    신용 사이클 국면 분류.

    AA- 스프레드 수준 + 방향 → 4-phase:
      - expansion:   spread 낮음 (< 0.5%p), 안정/하락
      - peak:        spread 최저 근접, 반전 조짐
      - contraction: spread 상승 (> 0.8%p)
      - trough:      spread 최고 근접, 하락 시작

    Bernanke & Gertler (1989): 신용 스프레드 ↔ 경기 순환
    """
    if not bonds:
        return None

    credit_spreads = bonds.get('credit_spreads', {})
    aa_spread = credit_spreads.get('aa_spread')
    credit_regime = bonds.get('credit_regime')

    if aa_spread is None:
        return None

    # AA- 스프레드 수준 기반 분류
    # 한국 AA- 스프레드 역사적 범위: ~0.3%p (호황) ~ 2.0%p (위기)
    if aa_spread < 0.4:
        phase = 'expansion'
        description = '신용 확장기 — 스프레드 최저, 리스크 선호'
    elif aa_spread < 0.7:
        phase = 'peak'
        description = '신용 정점 — 스프레드 안정, 경계 필요'
    elif aa_spread < 1.2:
        phase = 'contraction'
        description = '신용 수축기 — 스프레드 확대, 리스크 회피'
    else:
        phase = 'trough'
        description = '신용 바닥 — 스프레드 극대, 반전 가능'

    return {
        'creditCyclePhase': phase,
        'aaSpread': round(aa_spread, 3),
        'creditRegime': credit_regime,
        'description': description,
    }


def main():
    parser = argparse.ArgumentParser(description='Macro Composite Score v2 산출')
    parser.add_argument('--verbose', action='store_true', help='상세 출력')
    args = parser.parse_args()

    print('=== Macro Composite Score v2 ===')
    print(f'  Date: {datetime.now().strftime("%Y-%m-%d %H:%M")}')

    # ── 데이터 로드 ──
    # Note: ecos_latest.json does not exist; all ECOS-derived fields (BOK rate, CPI YoY)
    # are already aggregated into macro_latest.json by compute_macro.py.
    # The ecos parameter in helper functions is kept for API compatibility but receives None.
    kosis = _load_json(os.path.join(MACRO_DIR, 'kosis_latest.json'))
    macro = _load_json(os.path.join(MACRO_DIR, 'macro_latest.json'))
    bonds = _load_json(os.path.join(MACRO_DIR, 'bonds_latest.json'))
    ecos = None  # [C-3] was phantom ecos_latest.json — all ECOS fields live in macro_latest

    sources_loaded = sum(1 for s in [kosis, macro, bonds] if s is not None)
    print(f'  Data sources loaded: {sources_loaded}/3')
    if kosis:
        print(f'    KOSIS: {kosis.get("updated", "?")}')
    if macro:
        print(f'    Macro: {macro.get("updated", "?")}')
    if bonds:
        print(f'    Bonds: {bonds.get("updated", "?")}')

    if sources_loaded == 0:
        print('  [ERROR] No macro data available')
        output = {
            'generated': datetime.now().isoformat(timespec='seconds'),
            'status': 'no_data',
            'mcsV2': None,
        }
        os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
        with open(OUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f'  Saved (null): {OUT_PATH}')
        return

    # ── MCS v2 ──
    print('\n--- MCS v2 Computation ---')
    mcs_result = compute_mcs_v2(kosis, ecos, macro, bonds, verbose=args.verbose)

    # ── Taylor Gap ──
    print('\n--- Taylor Gap ---')
    taylor_result = compute_taylor_gap(macro, ecos)
    if taylor_result:
        gap = taylor_result['taylorGap']
        stance = '완화적' if gap < 0 else '긴축적' if gap > 0 else '중립'
        print(f'  Taylor Gap: {gap:+.4f} ({stance})')
        print(f'  Actual: {taylor_result["actualRate"]}%, Taylor: {taylor_result["taylorRate"]:.2f}%')

    # ── Yield Curve Phase ──
    print('\n--- Yield Curve Phase ---')
    yc_result = compute_yield_curve_phase(bonds, macro)
    if yc_result:
        print(f'  Phase: {yc_result["yieldCurvePhase"]}')
        print(f'  10Y-3Y: {yc_result["spread_10y3y"]}%p')
        print(f'  {yc_result["description"]}')

    # ── Credit Cycle Phase ──
    print('\n--- Credit Cycle Phase ---')
    cc_result = compute_credit_cycle_phase(bonds)
    if cc_result:
        print(f'  Phase: {cc_result["creditCyclePhase"]}')
        print(f'  AA- Spread: {cc_result["aaSpread"]}%p')
        print(f'  {cc_result["description"]}')

    # ── 출력 검증 ──
    if mcs_result:
        mcs_val = mcs_result.get('mcsV2')
        if mcs_val is not None and (mcs_val < 0 or mcs_val > 100):
            print(f'  [WARN] MCS v2={mcs_val} 범위 이탈 [0, 100] — 정규화 오류 가능')
        eff_w = mcs_result.get('effectiveWeight', 0)
        if eff_w > 0 and abs(eff_w - 1.0) > 0.001 and mcs_result.get('availableIndicators') == len(MCS_WEIGHTS):
            print(f'  [WARN] 전체 지표 가용인데 effectiveWeight={eff_w:.3f} != 1.0')

    if taylor_result:
        tg = taylor_result.get('taylorGap')
        if tg is not None and abs(tg) > 5:
            print(f'  [WARN] Taylor Gap={tg:+.4f} — 절대값 5%p 초과, 데이터 점검 필요')

    # ── 출력 구성 ──
    output = {
        'generated': datetime.now().isoformat(timespec='seconds'),
        'lastUpdated': datetime.now().strftime('%Y-%m-%d'),
        'status': 'ok',
        'mcsV2': mcs_result.get('mcsV2') if mcs_result else None,
        'mcsComponents': mcs_result.get('components') if mcs_result else None,
        'mcsAvailable': mcs_result.get('availableIndicators') if mcs_result else 0,
        'taylorGap': taylor_result.get('taylorGap') if taylor_result else None,
        'taylorDetail': taylor_result,
        'yieldCurvePhase': yc_result.get('yieldCurvePhase') if yc_result else None,
        'yieldCurveDetail': yc_result,
        'creditCyclePhase': cc_result.get('creditCyclePhase') if cc_result else None,
        'creditCycleDetail': cc_result,
        'parameters': {
            'weights': MCS_WEIGHTS,
            'taylor_r_star': TAYLOR_R_STAR,
            'taylor_pi_star': TAYLOR_PI_STAR,
        },
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # ── 최종 요약 ──
    print(f'\n{"=" * 55}')
    print(f'Macro Composite Score v2 완료')
    print(f'{"=" * 55}')
    if mcs_result:
        print(f'  MCS v2:             {mcs_result["mcsV2"]} / 100')
        print(f'  Available:          {mcs_result["availableIndicators"]}/{mcs_result["totalIndicators"]} indicators')
    if taylor_result:
        print(f'  Taylor Gap:         {taylor_result["taylorGap"]:+.4f}')
    if yc_result:
        print(f'  Yield Curve Phase:  {yc_result["yieldCurvePhase"]}')
    if cc_result:
        print(f'  Credit Cycle Phase: {cc_result["creditCyclePhase"]}')
    print(f'\n  저장: {OUT_PATH}')


if __name__ == '__main__':
    main()
