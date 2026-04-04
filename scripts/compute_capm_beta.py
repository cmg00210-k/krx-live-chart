#!/usr/bin/env python3
"""
CAPM Beta Estimation + Merton Distance-to-Default -- core_data/25, Doc35 §6

Computes per-stock OLS beta against market proxy with Scholes-Williams correction,
plus Merton(1974) Distance-to-Default (DD) for credit risk assessment.

Output: data/backtest/capm_beta.json
  { summary: { kospi: {count, mean_beta, median_beta}, kosdaq: {...} },
    stocks: { code: { beta, alpha, rSquared, thinTrading, nObs,
                      distanceToDefault, probDefault, ddGrade } } }

Academic basis:
  Sharpe (1964), Lintner (1965): CAPM beta = Cov(Ri,Rm) / Var(Rm)
  Scholes & Williams (1977): non-synchronous trading correction
  Merton (1974): equity as call option on firm assets
  Bharath & Shumway (2008): naive DD simplified estimation
  core_data/25_capm_delta_covariance.md sec 1-2
  core_data/35 §6.1-6.5 (Merton DD)

Usage:
  python scripts/compute_capm_beta.py
  python scripts/compute_capm_beta.py --market KOSPI
  python scripts/compute_capm_beta.py --code 005930
  python scripts/compute_capm_beta.py --window 120
"""
import json
import math
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse

# ── 공통 유틸 (api_constants.py) ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from api_constants import normal_cdf as _normal_cdf

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'data')
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'capm_beta.json')

# Parameters (core_data/25 sec 1-2)
DEFAULT_WINDOW = 250   # ~1 KRX trading year
MIN_OBS = 60           # minimum usable observations
THIN_TRADING_THRESH = 0.10  # >10% zero-return days triggers Scholes-Williams

# ── Merton DD 파라미터 (Doc35 §6.1-6.5) ──
DD_MIN_CANDLES = 120       # 최소 120일봉 (안정적 변동성 추정)
DD_DEFAULT_POINT_RATIO = 0.75  # Default Point = total_liabilities × 0.75 (KMV 관행)
DD_T = 1                   # 예측 기간: 1년
DD_DEBT_VOL = 0.05         # 부채 변동성 근사 (Bharath & Shumway 2008)

# 금융업종 제외 키워드 (부채=영업자산이므로 DD 해석 무의미)
FINANCIAL_SECTORS = {'금융', '은행', '보험', '증권', '캐피탈', '저축은행', '카드',
                     'financial', 'banking', 'insurance', 'securities'}


def _is_financial_sector(stock_info):
    """금융주 여부 판별 — 부채=영업자산이므로 DD 계산 제외"""
    for field in ('sector', 'industry'):
        val = stock_info.get(field, '')
        if not val:
            continue
        val_lower = val.lower()
        for keyword in FINANCIAL_SECTORS:
            if keyword in val_lower:
                return True
    return False


def load_financial_data(code):
    """종목 재무데이터 로드: data/financials/{code}.json → 최신 분기/연간"""
    fin_path = os.path.join(DATA_DIR, 'financials', f'{code}.json')
    if not os.path.exists(fin_path):
        return None
    try:
        with open(fin_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None
    # seed 데이터 제외 (가짜 데이터로 DD 계산 금지)
    source = data.get('source', '')
    if source not in ('dart', 'hardcoded', ''):
        return None
    # 최신 분기 우선, 없으면 연간 (배열은 오래된→최신 순)
    arr = data.get('quarterly', []) or data.get('annual', [])
    if not arr:
        return None
    return arr[-1]  # 가장 최신 기간 (마지막 원소)


def compute_dd(code, market, candles, stock_info, rf_annual):
    """
    Merton(1974) Distance-to-Default 계산.

    Bharath & Shumway(2008) naive DD:
      V = E + D (자산가치 근사)
      σ_V = σ_E × (E/V) + 0.05 × (D/V) (자산변동성 근사)
      DD = [ln(V/F) + (r - σ_V²/2) × T] / (σ_V × √T)
      PD = N(-DD)

    Args:
        code: 종목코드
        market: 시장 (KOSPI/KOSDAQ)
        candles: 일봉 리스트 [{time, close, ...}, ...]
        stock_info: index.json 종목 정보 (marketCap 포함)
        rf_annual: 연간 무위험이자율 (%, e.g. 3.5)

    Returns:
        dict with distanceToDefault, probDefault, ddGrade or None
    """
    # 금융주 제외
    if _is_financial_sector(stock_info):
        return None

    # 재무데이터 로드
    fin = load_financial_data(code)
    if not fin:
        return None

    total_liab = fin.get('total_liabilities')
    if not total_liab or total_liab <= 0:
        return None

    # E: 시총 (원 단위). index.json의 marketCap 단위 확인 필요
    market_cap = stock_info.get('marketCap')
    if not market_cap or market_cap <= 0:
        return None
    # marketCap in index.json: 억원 단위로 저장됨
    # total_liabilities in financials: 원 단위
    # 단위 통일: 억원으로 맞춤
    E = market_cap  # 억원

    # total_liabilities → 억원 변환 (원 → 억원)
    # toEok() 로직: |n| > 1,000,000이면 원 단위로 간주
    if abs(total_liab) > 1_000_000:
        total_liab_eok = round(total_liab / 1e8)
    else:
        total_liab_eok = total_liab

    if total_liab_eok <= 0:
        return None

    # F: Default Point = total_liabilities × 0.75 (KMV 관행)
    # 유동/비유동부채 미분리시 0.75 적용 (Doc35 §6.5)
    F = total_liab_eok * DD_DEFAULT_POINT_RATIO
    if F <= 0:
        return None

    # σ_E: 일간 로그수익률의 표준편차 → 연율화 (×√252)
    closes = [c.get('close') for c in candles if c.get('close') and c['close'] > 0]
    if len(closes) < DD_MIN_CANDLES:
        return None
    # 최근 250일만 사용
    closes = closes[-DEFAULT_WINDOW:]
    log_returns = []
    for i in range(1, len(closes)):
        if closes[i] > 0 and closes[i - 1] > 0:
            log_returns.append(math.log(closes[i] / closes[i - 1]))
    if len(log_returns) < 60:
        return None

    mean_lr = sum(log_returns) / len(log_returns)
    var_lr = sum((r - mean_lr) ** 2 for r in log_returns) / (len(log_returns) - 1)
    sigma_daily = math.sqrt(var_lr) if var_lr > 0 else 0
    sigma_E = sigma_daily * math.sqrt(252)  # 연율화
    if sigma_E <= 0:
        return None

    # V: 자산가치 근사 (Bharath & Shumway)
    D = F
    V = E + D

    # σ_V: 자산변동성 근사 (Bharath & Shumway 2008)
    sigma_V = sigma_E * (E / V) + DD_DEBT_VOL * (D / V)
    if sigma_V <= 0:
        return None

    # r: 무위험이자율 (연율, 소수)
    r = rf_annual / 100 if rf_annual > 0 else 0.035

    # DD 계산
    T = DD_T
    dd = (math.log(V / D) + (r - 0.5 * sigma_V ** 2) * T) / (sigma_V * math.sqrt(T))

    # PD: 부도확률
    pd = _normal_cdf(-dd)

    # 등급
    if dd > 3:
        grade = 'safe'
    elif dd >= 2:
        grade = 'caution'
    else:
        grade = 'warning'

    return {
        'distanceToDefault': round(dd, 2),
        'probDefault': round(pd, 6),
        'ddGrade': grade,
    }


def load_index():
    """Load stock list from data/index.json"""
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


def load_candles(market, code):
    """Load per-stock daily OHLCV from data/{market}/{code}.json"""
    fpath = os.path.join(DATA_DIR, market.lower(), f'{code}.json')
    if not os.path.exists(fpath):
        return []
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('candles', data) if isinstance(data, dict) else data


def load_market_closes(market):
    """Load market index closes → {date_str: close} dict"""
    fname = 'kospi_daily.json' if market.upper() == 'KOSPI' else 'kosdaq_daily.json'
    fpath = os.path.join(DATA_DIR, 'market', fname)
    if not os.path.exists(fpath):
        return {}
    with open(fpath, 'r', encoding='utf-8') as f:
        records = json.load(f)
    return {r['time']: r['close'] for r in records if r.get('close')}


def load_rf_annual():
    """Load KTB 10Y from bonds_latest.json, fallback 0"""
    bonds_path = os.path.join(DATA_DIR, 'macro', 'bonds_latest.json')
    if os.path.exists(bonds_path):
        with open(bonds_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        ktb10y = data.get('yields', {}).get('ktb_10y')
        if ktb10y is not None:
            return float(ktb10y)
    # Fallback: macro_latest.json
    macro_path = os.path.join(DATA_DIR, 'macro', 'macro_latest.json')
    if os.path.exists(macro_path):
        with open(macro_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        ktb10y = data.get('ktb10y')
        if ktb10y is not None:
            return float(ktb10y)
    return 0.0


def compute_beta(stock_closes, market_closes_map, window, rf_daily):
    """
    OLS beta + conditional Scholes-Williams correction.
    Mirrors js/indicators.js calcCAPMBeta() lines 375-471.

    Returns dict or None if insufficient data.
    """
    # Build aligned (stock_return, market_return) pairs by date matching
    pairs = []
    prev_sc, prev_mc = None, None
    for c in stock_closes:
        date_str = c.get('time', '')
        sc = c.get('close')
        mc = market_closes_map.get(date_str)
        if sc is None or mc is None or sc <= 0 or mc <= 0:
            prev_sc, prev_mc = sc, mc
            continue
        if prev_sc is not None and prev_mc is not None and prev_sc > 0 and prev_mc > 0:
            ri = (sc - prev_sc) / prev_sc - rf_daily
            rm = (mc - prev_mc) / prev_mc - rf_daily
            pairs.append((ri, rm))
        prev_sc, prev_mc = sc, mc

    # Trim to window
    if len(pairs) > window:
        pairs = pairs[-window:]

    T = len(pairs)
    if T < MIN_OBS:
        return None

    # Zero-return detection for thin-trading flag
    zero_count = sum(1 for ri, _ in pairs if abs(ri) < 1e-10)
    thin_trading = (zero_count / T) > THIN_TRADING_THRESH

    # Mean
    mean_ri = sum(ri for ri, _ in pairs) / T
    mean_rm = sum(rm for _, rm in pairs) / T

    # Covariance and variance
    cov_rm_ri = 0.0
    var_rm = 0.0
    for ri, rm in pairs:
        cov_rm_ri += (ri - mean_ri) * (rm - mean_rm)
        var_rm += (rm - mean_rm) ** 2

    if var_rm < 1e-20:
        return None

    beta0 = cov_rm_ri / var_rm
    alpha0 = mean_ri - beta0 * mean_rm

    beta_final = beta0

    # Scholes-Williams correction (core_data/25 sec 2.1)
    if thin_trading and T > 3:
        # Lead/lag covariances
        cov_lag = 0.0   # Cov(ri_t, rm_{t-1})
        cov_lead = 0.0  # Cov(ri_t, rm_{t+1})
        auto_rm = 0.0   # Cov(rm_t, rm_{t-1}) for rho_m

        for t in range(1, T):
            ri_t = pairs[t][0] - mean_ri
            rm_t = pairs[t][1] - mean_rm
            rm_prev = pairs[t - 1][1] - mean_rm
            cov_lag += ri_t * rm_prev
            auto_rm += rm_t * rm_prev

        for t in range(0, T - 1):
            ri_t = pairs[t][0] - mean_ri
            rm_next = pairs[t + 1][1] - mean_rm
            cov_lead += ri_t * rm_next

        beta_lag = cov_lag / var_rm if var_rm > 1e-20 else 0
        beta_lead = cov_lead / var_rm if var_rm > 1e-20 else 0
        rho_m = auto_rm / var_rm if var_rm > 1e-20 else 0

        denom_sw = 1 + 2 * rho_m
        if abs(denom_sw) > 0.01:
            beta_final = (beta_lag + beta0 + beta_lead) / denom_sw

    # R-squared with final beta
    alpha_final = mean_ri - beta_final * mean_rm
    ss_res = 0.0
    ss_tot = 0.0
    for ri, rm in pairs:
        predicted = alpha_final + beta_final * rm
        ss_res += (ri - predicted) ** 2
        ss_tot += (ri - mean_ri) ** 2
    r_squared = 1 - ss_res / ss_tot if ss_tot > 1e-20 else 0.0

    # Alpha annualized (250 trading days)
    alpha_annual = alpha_final * 250

    # ── Blume (1971) adjusted beta: shrink toward 1.0 ──
    # beta_blume = 0.67 * beta_raw + 0.33 * 1.0
    # Rationale: Blume (1971) showed betas tend to regress toward 1 over time
    BLUME_WEIGHT = 0.67
    beta_blume = BLUME_WEIGHT * beta_final + (1 - BLUME_WEIGHT) * 1.0

    # ── Jensen alpha t-statistic + p-value ──
    # SE(alpha) = sigma_epsilon / sqrt(T)
    # sigma_epsilon = sqrt(ss_res / (T - 2))   (OLS residual std error)
    # t = alpha_daily / SE(alpha_daily)
    # p-value = 2 * (1 - Phi(|t|))  (two-sided normal approx, large T)
    alpha_tstat = None
    alpha_pvalue = None
    if T > 2 and ss_res > 0:
        sigma_epsilon = math.sqrt(ss_res / (T - 2))
        se_alpha = sigma_epsilon / math.sqrt(T)
        if se_alpha > 1e-20:
            alpha_tstat = alpha_final / se_alpha
            alpha_pvalue = 2.0 * (1.0 - _normal_cdf(abs(alpha_tstat)))

    result = {
        'beta': round(beta_final, 3),
        'alpha': round(alpha_annual, 4),
        'rSquared': round(max(0, min(1, r_squared)), 3),
        'thinTrading': thin_trading,
        'nObs': T,
        'betaBlume': round(beta_blume, 3),
    }
    if alpha_tstat is not None:
        result['alphaTstat'] = round(alpha_tstat, 3)
        result['alphaPvalue'] = round(alpha_pvalue, 6)

    return result


def main():
    parser = argparse.ArgumentParser(description='CAPM Beta computation')
    parser.add_argument('--market', type=str, default=None, help='KOSPI or KOSDAQ')
    parser.add_argument('--code', type=str, default=None, help='Single stock code')
    parser.add_argument('--window', type=int, default=DEFAULT_WINDOW, help=f'Rolling window (default {DEFAULT_WINDOW})')
    args = parser.parse_args()

    stocks = load_index()
    rf_annual = load_rf_annual()
    rf_daily = (1 + rf_annual / 100) ** (1 / 250) - 1 if rf_annual > 0 else 0.0
    print(f"Risk-free rate: {rf_annual}% annual -> {rf_daily:.6f} daily")
    print(f"Window: {args.window}, Min obs: {MIN_OBS}")

    # Pre-load market index closes
    market_data = {}
    for m in ('KOSPI', 'KOSDAQ'):
        market_data[m] = load_market_closes(m)
        print(f"Market index [{m}]: {len(market_data[m])} days loaded")

    # Filter stocks
    if args.code:
        stocks = [s for s in stocks if s.get('code') == args.code]
    elif args.market:
        stocks = [s for s in stocks if s.get('market', '').upper() == args.market.upper()]

    print(f"Processing {len(stocks)} stocks...")

    results = {}
    segment_betas = {'KOSPI': [], 'KOSDAQ': []}
    skipped = 0

    for i, s in enumerate(stocks):
        code = s.get('code', '')
        market = s.get('market', 'KOSPI').upper()
        if market not in market_data or not market_data[market]:
            skipped += 1
            continue

        candles = load_candles(market, code)
        if len(candles) < MIN_OBS:
            skipped += 1
            continue

        result = compute_beta(candles, market_data[market], args.window, rf_daily)
        if result is None:
            skipped += 1
            continue

        # Merton DD (Doc35 §6.1-6.5) — 기존 beta 결과에 병합
        dd_result = compute_dd(code, market, candles, s, rf_annual)
        if dd_result:
            result.update(dd_result)

        results[code] = result
        segment_betas[market].append(result['beta'])

        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(stocks)} processed ({len(results)} ok, {skipped} skipped)")

    # Summary statistics
    def stats(vals):
        if not vals:
            return {'count': 0}
        vals_sorted = sorted(vals)
        n = len(vals_sorted)
        return {
            'count': n,
            'mean_beta': round(sum(vals_sorted) / n, 3),
            'median_beta': round(vals_sorted[n // 2], 3),
            'p25_beta': round(vals_sorted[n // 4], 3),
            'p75_beta': round(vals_sorted[3 * n // 4], 3),
            'min_beta': round(vals_sorted[0], 3),
            'max_beta': round(vals_sorted[-1], 3),
        }

    # DD 통계
    dd_counts = {'safe': 0, 'caution': 0, 'warning': 0}
    dd_values = []
    for code, r in results.items():
        if 'ddGrade' in r:
            dd_counts[r['ddGrade']] += 1
            dd_values.append(r['distanceToDefault'])
    dd_total = sum(dd_counts.values())

    summary = {
        'kospi': stats(segment_betas['KOSPI']),
        'kosdaq': stats(segment_betas['KOSDAQ']),
        'total': stats(segment_betas['KOSPI'] + segment_betas['KOSDAQ']),
        'dd': {
            'count': dd_total,
            'safe': dd_counts['safe'],
            'caution': dd_counts['caution'],
            'warning': dd_counts['warning'],
            'mean_dd': round(sum(dd_values) / len(dd_values), 2) if dd_values else None,
            'median_dd': round(sorted(dd_values)[len(dd_values) // 2], 2) if dd_values else None,
        },
        'parameters': {
            'window': args.window,
            'min_obs': MIN_OBS,
            'rf_annual_pct': rf_annual,
            'thin_trading_threshold': THIN_TRADING_THRESH,
            'scholes_williams': True,
            'blume_weight': 0.67,
            'dd_default_point_ratio': DD_DEFAULT_POINT_RATIO,
            'dd_min_candles': DD_MIN_CANDLES,
        },
    }

    output = {'summary': summary, 'stocks': results}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nComplete: {len(results)} stocks computed, {skipped} skipped")
    print(f"KOSPI: {summary['kospi']}")
    print(f"KOSDAQ: {summary['kosdaq']}")
    print(f"DD: {summary['dd']}")
    print(f"Saved: {OUT_PATH}")


if __name__ == '__main__':
    main()
