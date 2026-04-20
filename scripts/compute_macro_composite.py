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
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse
from datetime import datetime

# ── 공통 유틸 (api_constants.py) ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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
# i* = r* + pi + 0.5*(pi - pi*) + 0.5*(y - y*)/y*
#
# Laubach & Williams (2003): "Measuring the Natural Rate of Interest"
#   r* estimated via Kalman filter on IS curve.
#   US r* ≈ 1.0% (2003), trended down to ~0.5% (2020s).
#   Korean r* structurally lower than US due to:
#     1. High household debt (~105% GDP, BOK 2024) compresses neutral rate
#     2. Aging demographics (fertility 0.72, 2024) reduce potential growth
#     3. Export-dependent economy → external shocks dominate domestic equilibrium
#   BOK own estimate (Monetary Policy Report 2023): r* ≈ 0.25-0.75%
#   We use midpoint 0.5% — consistent with download_macro.py (#135)
TAYLOR_R_STAR = 0.5        # 균형실질이자율 (한국) — Laubach-Williams (2003) adapted; #135
TAYLOR_PI_STAR = 2.0       # 한은 물가안정목표 (2%) — BOK official target; #136

# ── CLI → Output Gap Proxy (OECD methodology) ──
# OECD CLI is amplitude-adjusted, centered on 100 (= trend growth).
# output_gap ≈ (CLI - 100) * CLI_TO_GAP_SCALE
# Scale factor 0.5: CLI point ≈ 0.5%p output gap (conservative).
# Source: download_macro.py line 972 uses identical formula; #139
CLI_TO_GAP_SCALE = 0.5     # CLI-to-output-gap scaling factor; #139

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

    # ── [FND-MAC-6] Scale normalization safeguard ──
    # MCS v2 is always on 0-100 scale. This clamp prevents rounding/accumulation errors
    # from producing values outside the valid range, which could cause misinterpretation
    # in JS consumers (appWorker.js _applyPhase8ConfidenceToPatterns uses thresholds 30/45/55/70).
    # Note: macro_latest.json contains a DIFFERENT MCS (0-1 scale, computed by download_macro.py).
    # The two must never be confused. The 'scale' field in output makes the convention explicit.
    mcs_score = max(0.0, min(100.0, mcs_score))

    return {
        'mcsV2': mcs_score,
        'scale': '0-100',  # [FND-MAC-6] explicit scale annotation for JS consumers
        'components': {k: round(v, 4) for k, v in indicators.items()},
        'availableIndicators': len(indicators),
        'totalIndicators': len(MCS_WEIGHTS),
        'effectiveWeight': round(available_weight, 3),
    }


def compute_taylor_gap(macro, ecos, kosis=None):
    """
    Taylor Gap = 실제 기준금리 - Taylor 규칙 추정치.

    Taylor (1993): "Discretion versus policy rules in practice"
      i* = r* + pi + 0.5*(pi - pi*) + 0.5*(y - y*)

    Output gap proxy: (CLI - 100) * CLI_TO_GAP_SCALE
      OECD CLI centered on 100 (= trend). Deviation ≈ output gap.
      Falls back to 0.0 if CLI data unavailable.
      Source: download_macro.py uses identical formula (#139).

    Sign convention:
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

    # ── Output gap: CLI-based proxy (FND-MAC-3 fix) ──
    # [FND-MAC-3] Previously hardcoded to 0.0, making output gap term irrelevant.
    # Now uses OECD CLI when available, consistent with download_macro.py.
    #
    # CRITICAL: Two different CLI sources exist with different semantics:
    #   1. macro_latest.json korea_cli (OECD 901Y067): amplitude-adjusted CYCLICAL
    #      component, centered on 100. Deviation from 100 = output gap proxy.
    #      Value ~101.65 → output gap ≈ +0.83%p (slight expansion).
    #   2. kosis_latest.json cli_composite (KOSIS DT_1C8016 A01): absolute LEVEL
    #      index, base 2020=100. Value ~125.2 reflects cumulative growth, NOT
    #      cyclical position. Using this for output gap gives absurd values.
    #
    # Priority: OECD cyclical CLI (korea_cli) > fallback 0.0
    # DO NOT use kosis cli_composite for Taylor rule -- it is the wrong series.
    cli = None
    if macro:
        cli = macro.get('korea_cli')  # OECD cyclical CLI (centered on 100)

    output_gap = 0.0  # fallback
    output_gap_source = 'fallback_zero'
    if cli is not None:
        output_gap = (cli - 100) * CLI_TO_GAP_SCALE
        output_gap_source = 'cli_proxy'
    else:
        print('  [WARN] CLI data unavailable for output gap — falling back to 0.0')

    # Taylor rule 계산
    # i* = r* + pi + 0.5*(pi - pi*) + 0.5*output_gap
    pi = cpi_yoy
    r_taylor = TAYLOR_R_STAR + pi + 0.5 * (pi - TAYLOR_PI_STAR) + 0.5 * output_gap

    gap = bok_rate - r_taylor

    return {
        'taylorGap': round(gap, 4),
        'taylorRate': round(r_taylor, 4),
        'actualRate': bok_rate,
        'cpiYoY': cpi_yoy,
        'rStar': TAYLOR_R_STAR,
        'piStar': TAYLOR_PI_STAR,
        'outputGap': round(output_gap, 4),
        'outputGapSource': output_gap_source,
        'cliValue': cli,
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


_MCS_FALLBACK_WEIGHTS = {
    'cli':    0.40,   # OECD/KOSIS CLI — 가장 강한 선행성 (Estrella & Mishkin)
    'esi':    0.25,   # 경제심리지수 — 소비자+기업 합성 심리
    'ipi':    0.20,   # 산업생산지수 — 실물경제 동행지표
    'retail': 0.15,   # 소매판매 — 소비 모멘텀 대리
}


def _ecos_stale(macro, max_age_days=14):
    """Returns True if macro_latest.json is missing or older than max_age_days.

    Used to trigger MCS v2 KOSIS fallback when ECOS-derived components (PMI,
    BSI, exports YoY, unemployment, term spread) are stale or unavailable.
    """
    if not macro:
        return True
    updated = macro.get('updated') or macro.get('lastUpdated')
    if not updated:
        return True
    try:
        if 'T' in updated:
            ts = datetime.fromisoformat(updated.replace('Z', '+00:00'))
        else:
            ts = datetime.strptime(updated, '%Y-%m-%d')
    except (ValueError, TypeError):
        return True
    age_days = (datetime.now() - ts.replace(tzinfo=None)).days
    return age_days > max_age_days


def compute_mcs_v2_fallback(kosis):
    """
    MCS v2 KOSIS-only 4-component fallback.

    When ECOS primary feed is stale (>14d), recompute MCS using only the four
    KOSIS leading indicators (CLI, ESI, IPI, retail sales). Weights normalized
    such that available components sum to 1.0 (missing components redistribute).

    Academic basis:
      OECD CLI methodology — CLI is the strongest single leading indicator
      Lee & Park (2013) — KOSIS leading indicator validation for KRX
      Doc31 §4.2 — KOSIS sentiment composites for KOSPI signal

    Returns dict with same shape as compute_mcs_v2() output, plus a
    'fallbackComposition' field listing which components were used.
    """
    if not kosis:
        return None

    indicators = {}
    available_weight = 0.0

    # CLI (KOSIS DT_1C8016 A01 — absolute level index, base 2020=100)
    cli = kosis.get('cli_composite')
    if cli is not None:
        indicators['cli'] = _normalize_range(cli, *CLI_RANGE)
        available_weight += _MCS_FALLBACK_WEIGHTS['cli']

    esi = kosis.get('esi')
    if esi is not None:
        indicators['esi'] = _normalize_range(esi, *ESI_RANGE)
        available_weight += _MCS_FALLBACK_WEIGHTS['esi']

    ipi = kosis.get('ipi_all')
    if ipi is not None:
        indicators['ipi'] = _normalize_range(ipi, *IPI_RANGE)
        available_weight += _MCS_FALLBACK_WEIGHTS['ipi']

    # Retail sales — base 2020=100. Reuse IPI_RANGE (both production-level indices).
    retail = kosis.get('retail_sales')
    if retail is not None:
        indicators['retail'] = _normalize_range(retail, *IPI_RANGE)
        available_weight += _MCS_FALLBACK_WEIGHTS['retail']

    if not indicators or available_weight <= 0:
        return None

    weighted_sum = 0.0
    for key, norm_val in indicators.items():
        weighted_sum += norm_val * (_MCS_FALLBACK_WEIGHTS[key] / available_weight)
    mcs_score = max(0.0, min(100.0, round(weighted_sum * 100, 1)))

    return {
        'mcsV2Fallback': mcs_score,
        'scale': '0-100',
        'components': {k: round(v, 4) for k, v in indicators.items()},
        'fallbackComposition': list(indicators.keys()),
        'availableIndicators': len(indicators),
        'totalIndicators': len(_MCS_FALLBACK_WEIGHTS),
        'effectiveWeight': round(available_weight, 3),
    }


def compute_adas_shock(macro, kosis):
    """
    AD-AS 4-Shock Classifier

    CPI 전년동월비와 IPI 수준으로 4가지 거시 충격 시나리오를 분류.
    Academic: Blanchard & Quah (1989): SVAR long-run output vs price level.

    Classification:
      CPI↑ IPI↑ → demand_positive (수요 확장)
      CPI↓ IPI↓ → demand_negative (수요 위축)
      CPI↑ IPI↓ → supply_negative (스태그플레이션)
      CPI↓ IPI↑ → supply_positive (골디락스)

    CPI direction: cpi_yoy > BOK target (TAYLOR_PI_STAR = 2.0%) → up
    IPI direction: ipi level > base year 100 → up (production expansion)
    """
    if not macro and not kosis:
        return None

    cpi_yoy = macro.get('cpi_yoy') if macro else None
    ipi_level = None
    if macro and macro.get('ipi') is not None:
        ipi_level = macro['ipi']
    elif kosis and kosis.get('ipi_all') is not None:
        ipi_level = kosis['ipi_all']

    if cpi_yoy is None or ipi_level is None:
        print(f'  [WARN] AD-AS: missing data (cpi_yoy={cpi_yoy}, ipi={ipi_level})')
        return None

    cpi_up = cpi_yoy > TAYLOR_PI_STAR  # Inflation above target
    ipi_up = ipi_level > 100.0         # Production above base year (2020=100)

    if cpi_up and ipi_up:
        shock = 'demand_positive'
        desc = '수요 확장 — 물가↑ 생산↑'
    elif not cpi_up and not ipi_up:
        shock = 'demand_negative'
        desc = '수요 위축 — 물가↓ 생산↓'
    elif cpi_up and not ipi_up:
        shock = 'supply_negative'
        desc = '공급 충격 — 물가↑ 생산↓ (스태그플레이션)'
    else:  # not cpi_up and ipi_up
        shock = 'supply_positive'
        desc = '공급 확장 — 물가↓ 생산↑ (골디락스)'

    return {
        'adAsShock': shock,
        'adAsDetail': {
            'cpiYoY': round(cpi_yoy, 2),
            'ipiLevel': round(ipi_level, 1),
            'cpiThreshold': TAYLOR_PI_STAR,
            'ipiThreshold': 100.0,
            'cpiUp': cpi_up,
            'ipiUp': ipi_up,
            'description': desc,
        }
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

    # Source guards — reject fake/sample/demo data per input
    for _name, _data in [('kosis_latest.json', kosis), ('macro_latest.json', macro), ('bonds_latest.json', bonds)]:
        if _data:
            _src = _data.get('source', '')
            if _src in ('sample', 'seed', 'demo'):
                print(f'  [WARN] Skipping {_name}: source={_src} (not real data)')
    if kosis and kosis.get('source', '') in ('sample', 'seed', 'demo'):
        kosis = None
    if macro and macro.get('source', '') in ('sample', 'seed', 'demo'):
        macro = None
    if bonds and bonds.get('source', '') in ('sample', 'seed', 'demo'):
        bonds = None

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

    # ── MCS v2 KOSIS 4-component fallback (Phase 6 P6-001) ──
    # Always compute so consumers can compare; mark fallbackActive=True when
    # ECOS primary feed is stale (>14d) or absent. Server confidence/macro.js
    # will substitute mcsV2Fallback for mcsV2 when fallbackActive=True.
    print('\n--- MCS v2 Fallback (KOSIS 4-component) ---')
    fallback_active = _ecos_stale(macro, max_age_days=14)
    fallback_result = compute_mcs_v2_fallback(kosis)
    if fallback_result:
        print(f'  Fallback MCS v2: {fallback_result["mcsV2Fallback"]} / 100')
        print(f'  Components: {fallback_result["fallbackComposition"]}')
        print(f'  Available: {fallback_result["availableIndicators"]}/{fallback_result["totalIndicators"]}')
    else:
        print('  [SKIP] KOSIS unavailable — no fallback computed')
    if fallback_active:
        age = '(no macro_latest)' if not macro else f'(age={macro.get("updated","?")})'
        print(f'  [FALLBACK ACTIVE] ECOS primary stale >14d {age} — consumers should use mcsV2Fallback')
    else:
        print('  [FALLBACK STANDBY] ECOS primary fresh — mcsV2 authoritative')

    # ── Taylor Gap ──
    print('\n--- Taylor Gap ---')
    taylor_result = compute_taylor_gap(macro, ecos, kosis=kosis)
    if taylor_result:
        gap = taylor_result['taylorGap']
        stance = '완화적' if gap < 0 else '긴축적' if gap > 0 else '중립'
        print(f'  Taylor Gap: {gap:+.4f} ({stance})')
        print(f'  Actual: {taylor_result["actualRate"]}%, Taylor: {taylor_result["taylorRate"]:.2f}%')
        print(f'  Output Gap: {taylor_result["outputGap"]:+.4f} (source: {taylor_result["outputGapSource"]})')
        if taylor_result.get('cliValue') is not None:
            print(f'  CLI: {taylor_result["cliValue"]} → gap = ({taylor_result["cliValue"]} - 100) * {CLI_TO_GAP_SCALE}')

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

    # ── AD-AS 4-Shock Classifier ──
    print('\n--- AD-AS Shock Classification ---')
    adas_result = compute_adas_shock(macro, kosis)
    if adas_result:
        print(f'  Shock: {adas_result["adAsShock"]}')
        detail = adas_result['adAsDetail']
        print(f'  CPI YoY: {detail["cpiYoY"]}% (threshold: {detail["cpiThreshold"]}%)')
        print(f'  IPI Level: {detail["ipiLevel"]} (threshold: {detail["ipiThreshold"]})')
        print(f'  {detail["description"]}')
    else:
        print('  [SKIP] Insufficient data for AD-AS classification')

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
        'mcsScale': mcs_result.get('scale', '0-100') if mcs_result else '0-100',  # [FND-MAC-6]
        'mcsComponents': mcs_result.get('components') if mcs_result else None,
        'mcsAvailable': mcs_result.get('availableIndicators') if mcs_result else 0,
        'taylorGap': taylor_result.get('taylorGap') if taylor_result else None,
        'taylorDetail': taylor_result,
        'yieldCurvePhase': yc_result.get('yieldCurvePhase') if yc_result else None,
        'yieldCurveDetail': yc_result,
        'creditCyclePhase': cc_result.get('creditCyclePhase') if cc_result else None,
        'creditCycleDetail': cc_result,
        'adAsShock': adas_result.get('adAsShock') if adas_result else None,
        'adAsDetail': adas_result.get('adAsDetail') if adas_result else None,
        # ── Phase 6 P6-001: MCS v2 KOSIS 4-component fallback ──
        'mcsV2Fallback': fallback_result.get('mcsV2Fallback') if fallback_result else None,
        'mcsFallbackActive': bool(fallback_active),
        'mcsFallbackDetail': fallback_result,
        'parameters': {
            'weights': MCS_WEIGHTS,
            'fallback_weights': _MCS_FALLBACK_WEIGHTS,
            'taylor_r_star': TAYLOR_R_STAR,
            'taylor_pi_star': TAYLOR_PI_STAR,
            'cli_to_gap_scale': CLI_TO_GAP_SCALE,
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
    if adas_result:
        print(f'  AD-AS Shock:        {adas_result["adAsShock"]}')
    if fallback_result:
        marker = '*ACTIVE*' if fallback_active else 'standby'
        print(f'  MCS v2 Fallback:    {fallback_result["mcsV2Fallback"]} / 100  [{marker}]')
    print(f'\n  저장: {OUT_PATH}')


if __name__ == '__main__':
    main()
