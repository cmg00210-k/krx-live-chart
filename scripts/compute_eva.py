#!/usr/bin/env python3
"""
EVA (Economic Value Added) Computation -- Stern Stewart (1991)
종목별 EVA, EVA Momentum, EVA Spread를 산출하여 가치 창출/파괴 여부를 진단.

Output: data/backtest/eva_scores.json
  { summary: { count, positive_eva_pct, mean_eva_spread, median_eva_spread },
    stocks: { code: { eva, evaMomentum, evaSpread, roic, wacc, nopat, investedCapital } } }

Academic basis:
  Stern Stewart & Co. (1991): EVA = NOPAT - WACC × Invested Capital
  core_data/14_apt_factor_model.md §2.8: EVA as residual income metric
  Grant (2003): Foundations of Economic Value Added

Formulas:
  NOPAT = 영업이익 × (1 - 유효세율)
  IC = 자본총계 + 이자부부채 (approx: 부채총계 × 0.6, 유동부채 미제공)
  WACC = We × Re + Wd × Rd × (1 - t)
  Re = Rf + β × ERP (CAPM)
  EVA Spread = ROIC - WACC
  EVA Momentum = (EVA_t - EVA_{t-1}) / |IC_{t-1}|

Usage:
  python scripts/compute_eva.py
  python scripts/compute_eva.py --market KOSPI
  python scripts/compute_eva.py --code 005930
  python scripts/compute_eva.py --verbose
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
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'eva_scores.json')

# ── Parameters ──────────────────────────────────────────────────
# 한국 법인세 법정세율 (2024 기준, 2억 초과 구간 적용)
STATUTORY_TAX_RATE = 0.22
TAX_RATE_FLOOR = 0.05
TAX_RATE_CAP = 0.50

# 한국 주식시장 위험프리미엄 (Damodaran 2024 KR estimate ≈ 5.5~6.5%)
EQUITY_RISK_PREMIUM = 0.06

# 한국 회사채 평균 스프레드 (BBB+ 기준, KTB10Y 대비)
CORP_DEBT_SPREAD = 0.015

# 이자부부채 비율 추정: 부채총계 중 이자부부채 비중 (유동부채 미분리 시)
# 한국 기업 평균적으로 부채총계의 ~60%가 이자부부채(차입금+사채)
INTEREST_BEARING_DEBT_RATIO = 0.60

# 기본 risk-free rate fallback (%)
DEFAULT_RF_PCT = 3.5

# 기본 beta fallback (시장 평균)
DEFAULT_BETA = 1.0


def load_index():
    """data/index.json에서 종목 리스트 로드"""
    idx_path = os.path.join(DATA_DIR, 'index.json')
    with open(idx_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    stocks = data.get('stocks', data.get('data', []))
    if isinstance(stocks, dict):
        stock_list = []
        for code, info in stocks.items():
            if isinstance(info, dict):
                info['code'] = code
                stock_list.append(info)
        return stock_list
    return stocks


def load_financials(code):
    """data/financials/{code}.json에서 DART 재무제표 로드"""
    fpath = os.path.join(DATA_DIR, 'financials', f'{code}.json')
    if not os.path.exists(fpath):
        return None
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # seed 데이터는 실제 DART 데이터가 아니므로 제외
    if data.get('source') == 'seed':
        return None
    return data


def load_capm_betas():
    """data/backtest/capm_beta.json에서 CAPM beta 로드"""
    beta_path = os.path.join(DATA_DIR, 'backtest', 'capm_beta.json')
    if not os.path.exists(beta_path):
        return {}
    with open(beta_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('stocks', {})


def load_rf_rate():
    """macro_latest.json에서 KTB 10Y 무위험수익률 로드 (%, e.g. 3.73)"""
    macro_path = os.path.join(DATA_DIR, 'macro', 'macro_latest.json')
    if os.path.exists(macro_path):
        with open(macro_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        ktb10y = data.get('ktb10y')
        if ktb10y is not None:
            return float(ktb10y)
    return DEFAULT_RF_PCT


def get_latest_annual_periods(fin_data, n=2):
    """
    연간 재무데이터에서 최근 n개 기간을 반환.
    period 내림차순 정렬 후 최근 n개.
    Returns: list of dicts (newest first)
    """
    annual = fin_data.get('annual', [])
    if not annual:
        return []
    # period 기준 내림차순 정렬 (e.g. "2025", "2024", "2023")
    sorted_annual = sorted(annual, key=lambda x: x.get('period', ''), reverse=True)
    return sorted_annual[:n]


def estimate_tax_rate(op, ni):
    """
    유효세율 추정.
    DART 데이터에 법인세비용/세전순이익이 없으므로 영업이익-순이익 차이로 근사.
    tax_expense ≈ op - ni (영업외수익/비용 무시 가정은 부정확하나 available data 한계)

    정밀도 한계가 있으므로 법정세율 fallback + clamp 적용.
    """
    if op is None or ni is None:
        return STATUTORY_TAX_RATE

    # 영업손실이면 법정세율 사용
    if op <= 0:
        return STATUTORY_TAX_RATE

    # 순이익이 영업이익보다 큰 경우 (영업외이익 > 세금) → 법정세율 사용
    if ni >= op:
        return STATUTORY_TAX_RATE

    # 추정 세율 = (영업이익 - 순이익) / 영업이익
    # 이는 영업외손익을 세금으로 간주하는 근사치
    # 보다 정확하려면: tax = op - ni는 세금+영업외비용 합산이므로 과대추정 경향
    # 따라서 조정: 실효세율 = min(추정치, 법정세율 * 1.5) 로 상한 설정
    implied_rate = (op - ni) / op

    # Clamp to reasonable range
    return max(TAX_RATE_FLOOR, min(TAX_RATE_CAP, implied_rate))


def compute_eva_single(fin_data, beta, rf_pct, verbose=False):
    """
    단일 종목에 대한 EVA 산출.

    Returns:
      dict with eva, evaMomentum, evaSpread, roic, wacc, nopat, investedCapital
      or None if insufficient data
    """
    periods = get_latest_annual_periods(fin_data, n=2)
    if not periods:
        return None

    current = periods[0]
    prior = periods[1] if len(periods) >= 2 else None

    # ── 1. 필수 재무 항목 추출 ──
    op = current.get('op')                    # 영업이익
    ni = current.get('ni')                    # 당기순이익
    total_assets = current.get('total_assets')
    total_liabilities = current.get('total_liabilities')
    total_equity = current.get('total_equity')

    # 필수 값 검증
    if op is None or total_assets is None or total_equity is None:
        return None
    if total_liabilities is None:
        # 부채 = 자산 - 자본 으로 역산
        total_liabilities = total_assets - total_equity

    # 자본총계가 0 이하면 EVA 산출 불가 (자본잠식)
    if total_equity <= 0:
        return None

    # ── 2. 유효세율 추정 ──
    tax_rate = estimate_tax_rate(op, ni)

    # ── 3. NOPAT (Net Operating Profit After Tax) ──
    nopat = op * (1 - tax_rate)

    # ── 4. Invested Capital (IC) ──
    # 유동부채 미분리 → Method B 변형: IC = 자본총계 + 이자부부채(추정)
    # 이자부부채 ≈ 부채총계 × INTEREST_BEARING_DEBT_RATIO
    interest_bearing_debt = total_liabilities * INTEREST_BEARING_DEBT_RATIO
    invested_capital = total_equity + interest_bearing_debt

    # IC가 0 이하면 산출 불가
    if invested_capital <= 0:
        return None

    # ── 5. WACC 산출 ──
    rf = rf_pct / 100.0  # % → decimal

    # Re (자기자본비용) = Rf + β × ERP
    re = rf + beta * EQUITY_RISK_PREMIUM

    # Rd (타인자본비용) = Rf + 기업 스프레드
    rd = rf + CORP_DEBT_SPREAD

    # 장부가 기준 가중치
    total_capital = total_equity + interest_bearing_debt
    we = total_equity / total_capital     # 자기자본 비중
    wd = interest_bearing_debt / total_capital  # 타인자본 비중

    # WACC = We × Re + Wd × Rd × (1 - t)
    wacc = we * re + wd * rd * (1 - tax_rate)

    # WACC 하한선: 음수 방지 (이론적으로 불가하나 극단 beta에서 발생 가능)
    wacc = max(wacc, 0.001)

    # ── 6. EVA ──
    eva = nopat - wacc * invested_capital

    # ── 7. ROIC ──
    roic = nopat / invested_capital

    # ── 8. EVA Spread ──
    eva_spread = roic - wacc

    # ── 9. EVA Momentum (YoY 변화) ──
    eva_momentum = None
    if prior is not None:
        prior_op = prior.get('op')
        prior_ni = prior.get('ni')
        prior_total_assets = prior.get('total_assets')
        prior_total_liabilities = prior.get('total_liabilities')
        prior_total_equity = prior.get('total_equity')

        if (prior_op is not None and prior_total_equity is not None
                and prior_total_equity > 0):

            if prior_total_liabilities is None and prior_total_assets is not None:
                prior_total_liabilities = prior_total_assets - prior_total_equity

            if prior_total_liabilities is not None:
                prior_tax_rate = estimate_tax_rate(prior_op, prior_ni)
                prior_nopat = prior_op * (1 - prior_tax_rate)
                prior_ibd = prior_total_liabilities * INTEREST_BEARING_DEBT_RATIO
                prior_ic = prior_total_equity + prior_ibd

                if prior_ic > 0:
                    prior_eva = prior_nopat - wacc * prior_ic
                    eva_momentum = (eva - prior_eva) / abs(prior_ic)

    if verbose:
        code = fin_data.get('code', '?')
        name = fin_data.get('name', '?')
        print(f"  {code} {name}: OP={op/1e8:.0f}억 NOPAT={nopat/1e8:.0f}억 "
              f"IC={invested_capital/1e8:.0f}억 WACC={wacc:.3f} "
              f"ROIC={roic:.3f} EVA={eva/1e8:.0f}억 Spread={eva_spread:.3f}")

    result = {
        'eva': round(eva),
        'evaSpread': round(eva_spread, 4),
        'roic': round(roic, 4),
        'wacc': round(wacc, 4),
        'nopat': round(nopat),
        'investedCapital': round(invested_capital),
    }

    if eva_momentum is not None:
        result['evaMomentum'] = round(eva_momentum, 4)

    return result


def main():
    parser = argparse.ArgumentParser(description='EVA (Economic Value Added) 산출')
    parser.add_argument('--market', type=str, default=None,
                        help='KOSPI 또는 KOSDAQ')
    parser.add_argument('--code', type=str, default=None,
                        help='단일 종목코드 (e.g. 005930)')
    parser.add_argument('--verbose', action='store_true',
                        help='종목별 상세 출력')
    args = parser.parse_args()

    # ── 데이터 로드 ──
    stocks = load_index()
    betas = load_capm_betas()
    rf_pct = load_rf_rate()
    print(f"무위험수익률 (KTB 10Y): {rf_pct}%")
    print(f"주식위험프리미엄 (ERP): {EQUITY_RISK_PREMIUM * 100}%")
    print(f"기업부채 스프레드: {CORP_DEBT_SPREAD * 100}%")
    print(f"이자부부채 비율 추정치: {INTEREST_BEARING_DEBT_RATIO * 100}%")
    print(f"CAPM beta 로드: {len(betas)}종목")

    # ── 필터 ──
    if args.code:
        stocks = [s for s in stocks if s.get('code') == args.code]
    elif args.market:
        stocks = [s for s in stocks if
                  s.get('market', '').upper() == args.market.upper()]

    print(f"대상 종목: {len(stocks)}개")

    # ── 산출 루프 ──
    results = {}
    skipped = 0
    skip_reasons = {
        'no_financials': 0,
        'seed_data': 0,
        'insufficient_data': 0,
    }
    segment_spreads = {'KOSPI': [], 'KOSDAQ': []}

    for i, s in enumerate(stocks):
        code = s.get('code', '')
        market = s.get('market', 'KOSPI').upper()

        # 재무데이터 로드
        fin = load_financials(code)
        if fin is None:
            skipped += 1
            if os.path.exists(os.path.join(DATA_DIR, 'financials', f'{code}.json')):
                skip_reasons['seed_data'] += 1
            else:
                skip_reasons['no_financials'] += 1
            continue

        # Beta: CAPM 결과에서 조회, 없으면 기본값 1.0
        beta_info = betas.get(code, {})
        beta = beta_info.get('beta', DEFAULT_BETA)

        # EVA 산출
        result = compute_eva_single(fin, beta, rf_pct, verbose=args.verbose)
        if result is None:
            skipped += 1
            skip_reasons['insufficient_data'] += 1
            continue

        results[code] = result
        if market in segment_spreads:
            segment_spreads[market].append(result['evaSpread'])

        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(stocks)} 처리 완료 "
                  f"({len(results)} 산출, {skipped} 건너뜀)")

    # ── 요약 통계 ──
    all_spreads = segment_spreads['KOSPI'] + segment_spreads['KOSDAQ']
    all_evas = [results[c]['eva'] for c in results]

    def percentile(vals, p):
        """p번째 백분위수 (0~1)"""
        if not vals:
            return 0
        sorted_v = sorted(vals)
        idx = int(len(sorted_v) * p)
        idx = min(idx, len(sorted_v) - 1)
        return sorted_v[idx]

    def safe_median(vals):
        if not vals:
            return 0
        s = sorted(vals)
        n = len(s)
        return s[n // 2]

    positive_eva_count = sum(1 for e in all_evas if e > 0)
    positive_eva_pct = (positive_eva_count / len(all_evas) * 100) if all_evas else 0

    summary = {
        'count': len(results),
        'positive_eva_pct': round(positive_eva_pct, 1),
        'mean_eva_spread': round(sum(all_spreads) / len(all_spreads), 4) if all_spreads else 0,
        'median_eva_spread': round(safe_median(all_spreads), 4),
        'p25_eva_spread': round(percentile(all_spreads, 0.25), 4),
        'p75_eva_spread': round(percentile(all_spreads, 0.75), 4),
        'kospi_count': len(segment_spreads['KOSPI']),
        'kosdaq_count': len(segment_spreads['KOSDAQ']),
        'parameters': {
            'rf_pct': rf_pct,
            'erp': EQUITY_RISK_PREMIUM,
            'corp_spread': CORP_DEBT_SPREAD,
            'ibd_ratio': INTEREST_BEARING_DEBT_RATIO,
            'statutory_tax_rate': STATUTORY_TAX_RATE,
        },
    }

    output = {
        'generated': datetime.now().isoformat(timespec='seconds'),
        'summary': summary,
        'stocks': results,
    }

    # ── 저장 ──
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # ── 결과 출력 ──
    print(f"\n{'='*60}")
    print(f"EVA 산출 완료")
    print(f"{'='*60}")
    print(f"산출: {len(results)}종목 / 건너뜀: {skipped}종목")
    print(f"  - 재무데이터 없음: {skip_reasons['no_financials']}")
    print(f"  - Seed 데이터 (가짜): {skip_reasons['seed_data']}")
    print(f"  - 데이터 불충분: {skip_reasons['insufficient_data']}")
    print(f"")
    print(f"EVA > 0 (가치 창출): {positive_eva_count}종목 ({positive_eva_pct:.1f}%)")
    print(f"EVA <= 0 (가치 파괴): {len(results) - positive_eva_count}종목 "
          f"({100 - positive_eva_pct:.1f}%)")
    print(f"")
    print(f"EVA Spread (ROIC - WACC):")
    print(f"  평균: {summary['mean_eva_spread']:.4f}")
    print(f"  중앙값: {summary['median_eva_spread']:.4f}")
    print(f"  P25: {summary['p25_eva_spread']:.4f}")
    print(f"  P75: {summary['p75_eva_spread']:.4f}")
    print(f"")
    print(f"시장별:")
    if segment_spreads['KOSPI']:
        kospi_mean = sum(segment_spreads['KOSPI']) / len(segment_spreads['KOSPI'])
        print(f"  KOSPI: {len(segment_spreads['KOSPI'])}종목, "
              f"평균 Spread={kospi_mean:.4f}")
    if segment_spreads['KOSDAQ']:
        kosdaq_mean = sum(segment_spreads['KOSDAQ']) / len(segment_spreads['KOSDAQ'])
        print(f"  KOSDAQ: {len(segment_spreads['KOSDAQ'])}종목, "
              f"평균 Spread={kosdaq_mean:.4f}")
    print(f"")
    print(f"저장: {OUT_PATH}")


if __name__ == '__main__':
    main()
