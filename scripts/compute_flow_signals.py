#!/usr/bin/env python3
"""
Per-Stock Investor Flow Signals + HMM Regime Labels

Reads:
  data/investors/{code}.json         (per-stock investor flow data)
  data/backtest/hmm_regimes.json     (Hamilton 1989 HMM regime labels)
  data/index.json                    (stock list)

Output:
  data/backtest/flow_signals.json

Per-stock signals:
  - foreignMomentum:        foreign net buy 20-day MA direction (buy/sell/neutral)
  - retailContrarian:       retail contrarian signal (contrarian_buy/sell/neutral)
  - institutionalAlignment: institution+foreign alignment (aligned/misaligned/neutral)
  - hmmRegimeLabel:         bull/bear/sideways from HMM, null if stale >30 days

Academic basis:
  Barber & Odean (2000): Trading is hazardous to your wealth (retail contrarian)
  Froot et al. (2001): Information asymmetries and foreign investor flows
  Hamilton (1989): A new approach to the economic analysis of nonstationary time series
  core_data/29_behavioral_market_sentiment.md §3 (disposition, herding)
  core_data/35 §4 (HMM regimes)

Pure Python: no scipy/numpy dependency.

Usage:
  python scripts/compute_flow_signals.py
  python scripts/compute_flow_signals.py --code 005930
  python scripts/compute_flow_signals.py --verbose
"""
import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'data')
INVESTORS_DIR = os.path.join(DATA_DIR, 'investors')
OUT_PATH = os.path.join(DATA_DIR, 'backtest', 'flow_signals.json')

# ── Parameters ──
FOREIGN_MA_WINDOW = 20       # 외국인 순매수 이동평균 기간
RETAIL_EXTREME_PCT = 0.05    # 개인 극단 매수/매도 상위 5%
HMM_STALE_DAYS = 30          # HMM 라벨 유효기간 (일)
MIN_FLOW_DAYS = 10           # 최소 유효 거래일 수


def _load_json(path):
    """JSON 파일 로드, 실패 시 None."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def load_index():
    """data/index.json에서 종목 리스트 로드."""
    idx_path = os.path.join(DATA_DIR, 'index.json')
    data = _load_json(idx_path)
    if not data:
        return []
    stocks = data.get('stocks', data.get('data', []))
    if isinstance(stocks, dict):
        stock_list = []
        for code, info in stocks.items():
            if isinstance(info, dict):
                info['code'] = code
                stock_list.append(info)
        return stock_list
    return stocks


def load_investor_data(code):
    """
    data/investors/{code}.json 로드.
    예상 형태:
      [{"date": "2026-01-02", "foreign": 1234, "institution": -567, "retail": -667}, ...]
    또는:
      {"flows": [...], ...}
    """
    fpath = os.path.join(INVESTORS_DIR, f'{code}.json')
    data = _load_json(fpath)
    if data is None:
        return None

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get('flows', data.get('data', []))
    return None


def load_hmm_regimes():
    """
    data/backtest/hmm_regimes.json 로드.
    형태: {daily: [{date, bull_prob, regime}, ...], ...}
    """
    hmm_path = os.path.join(DATA_DIR, 'backtest', 'hmm_regimes.json')
    data = _load_json(hmm_path)
    if not data:
        return None, None

    daily = data.get('daily', [])
    if not daily:
        return None, None

    # 최신 라벨
    latest = daily[-1] if daily else None
    return latest, data


def compute_foreign_momentum(flows, window=FOREIGN_MA_WINDOW):
    """
    외국인 순매수 20-day MA 방향.

    Args:
        flows: list of dicts with 'foreign' (net buy amount)
        window: MA 기간

    Returns:
        'buy', 'sell', or 'neutral'
    """
    foreign_net = []
    for f in flows:
        val = f.get('foreign') or f.get('foreignNet') or f.get('foreign_net')
        if val is not None:
            foreign_net.append(float(val))

    if len(foreign_net) < window:
        if len(foreign_net) < MIN_FLOW_DAYS:
            return None
        # 데이터 부족 시 전체 평균 사용
        window = len(foreign_net)

    recent = foreign_net[-window:]
    ma = sum(recent) / len(recent)

    # 방향 판별: MA > 0이면 순매수 추세
    if ma > 0:
        return 'buy'
    elif ma < 0:
        return 'sell'
    return 'neutral'


def compute_retail_contrarian(flows, all_retail_nets):
    """
    개인 투자자 역추세 신호.
    극단적 개인 순매수 (상위 5%) → contrarian_sell
    극단적 개인 순매도 (하위 5%) → contrarian_buy
    Barber & Odean (2000): 개인은 체계적으로 수익률 저조

    Args:
        flows: 해당 종목의 flow 데이터
        all_retail_nets: 전 종목 개인 누적순매수 리스트 (분위수 기준용)

    Returns:
        'contrarian_buy', 'contrarian_sell', or 'neutral'
    """
    retail_net = []
    for f in flows:
        val = f.get('retail') or f.get('retailNet') or f.get('retail_net') or f.get('individual')
        if val is not None:
            retail_net.append(float(val))

    if len(retail_net) < MIN_FLOW_DAYS:
        return None

    # 최근 20일 누적
    recent_sum = sum(retail_net[-20:]) if len(retail_net) >= 20 else sum(retail_net)

    if not all_retail_nets:
        # 자체 기준: 부호만 판별
        if recent_sum > 0:
            return 'contrarian_sell'  # 개인 과매수 → 역추세 매도
        elif recent_sum < 0:
            return 'contrarian_buy'   # 개인 과매도 → 역추세 매수
        return 'neutral'

    # 전체 분포에서 분위수 판별
    sorted_nets = sorted(all_retail_nets)
    n = len(sorted_nets)
    if n == 0:
        return 'neutral'

    # 상위/하위 5% 임계값
    top_thresh = sorted_nets[int(n * (1 - RETAIL_EXTREME_PCT))] if n > 20 else sorted_nets[-1]
    bot_thresh = sorted_nets[int(n * RETAIL_EXTREME_PCT)] if n > 20 else sorted_nets[0]

    if recent_sum >= top_thresh:
        return 'contrarian_sell'
    elif recent_sum <= bot_thresh:
        return 'contrarian_buy'
    return 'neutral'


def compute_institutional_alignment(flows):
    """
    기관+외국인 정렬도.
    둘 다 순매수 → aligned (강세 신호)
    둘 다 순매도 → aligned (약세 신호, 방향은 sell)
    엇갈림 → misaligned

    Args:
        flows: list of dicts

    Returns:
        'aligned_buy', 'aligned_sell', 'misaligned', or 'neutral'
    """
    foreign_net = []
    inst_net = []

    for f in flows:
        fval = f.get('foreign') or f.get('foreignNet') or f.get('foreign_net')
        ival = f.get('institution') or f.get('institutionNet') or f.get('inst_net')
        if fval is not None:
            foreign_net.append(float(fval))
        if ival is not None:
            inst_net.append(float(ival))

    if len(foreign_net) < MIN_FLOW_DAYS or len(inst_net) < MIN_FLOW_DAYS:
        return None

    # 최근 20일 합산
    window = min(20, len(foreign_net), len(inst_net))
    f_sum = sum(foreign_net[-window:])
    i_sum = sum(inst_net[-window:])

    if f_sum > 0 and i_sum > 0:
        return 'aligned_buy'
    elif f_sum < 0 and i_sum < 0:
        return 'aligned_sell'
    elif abs(f_sum) < 1e-6 and abs(i_sum) < 1e-6:
        return 'neutral'
    return 'misaligned'


def get_hmm_label(hmm_latest, stale_days=HMM_STALE_DAYS):
    """
    HMM 라벨 반환 (stale 체크).
    Hamilton (1989) 2-state model: bull/bear

    Args:
        hmm_latest: dict with 'date', 'regime', 'bull_prob'
        stale_days: 유효기간 일수

    Returns:
        'bull', 'bear', 'sideways', or None (stale)
    """
    if not hmm_latest:
        return None

    date_str = hmm_latest.get('date', '')
    regime = hmm_latest.get('regime', '')
    bull_prob = hmm_latest.get('bull_prob')

    if not date_str or not regime:
        return None

    # Stale 체크
    try:
        hmm_date = datetime.strptime(date_str, '%Y-%m-%d')
        days_old = (datetime.now() - hmm_date).days
        if days_old > stale_days:
            return None  # 30일 이상 지남
    except ValueError:
        return None

    # 3-state 확장: bull_prob로 sideways 판별
    if bull_prob is not None:
        if 0.3 <= bull_prob <= 0.7:
            return 'sideways'

    return regime


def main():
    parser = argparse.ArgumentParser(description='투자자 흐름 시그널 + HMM 레짐 라벨')
    parser.add_argument('--code', type=str, default=None, help='단일 종목코드')
    parser.add_argument('--market', type=str, default=None, help='KOSPI 또는 KOSDAQ')
    parser.add_argument('--verbose', action='store_true', help='상세 출력')
    args = parser.parse_args()

    print('=== Investor Flow Signals + HMM Regime ===')
    print(f'  Date: {datetime.now().strftime("%Y-%m-%d %H:%M")}')

    # ── 종목 리스트 ──
    stocks = load_index()
    if args.code:
        stocks = [s for s in stocks if s.get('code') == args.code]
    elif args.market:
        stocks = [s for s in stocks if s.get('market', '').upper() == args.market.upper()]

    print(f'  Target stocks: {len(stocks)}')

    # ── investors 디렉토리 확인 ──
    if not os.path.isdir(INVESTORS_DIR):
        print(f'  [WARN] {INVESTORS_DIR} does not exist — skipping flow signals')
        stocks_with_data = []
    else:
        available_files = set(f.replace('.json', '') for f in os.listdir(INVESTORS_DIR)
                              if f.endswith('.json'))
        stocks_with_data = [s for s in stocks if s.get('code') in available_files]
        print(f'  Stocks with investor data: {len(stocks_with_data)}')

    # ── HMM 레짐 ──
    hmm_latest, hmm_data = load_hmm_regimes()
    hmm_label = get_hmm_label(hmm_latest)
    if hmm_latest:
        print(f'  HMM latest: {hmm_latest.get("date")} regime={hmm_latest.get("regime")} '
              f'bull_prob={hmm_latest.get("bull_prob")}')
        print(f'  HMM effective label: {hmm_label}')
    else:
        print(f'  HMM: not available or stale')

    # ── 1차 패스: 모든 종목의 개인 순매수 합산 (분위수 기준) ──
    print('\n  [Phase 1] Collecting retail flow distribution...')
    all_retail_sums = []
    flow_cache = {}

    for s in stocks_with_data:
        code = s.get('code', '')
        flows = load_investor_data(code)
        if not flows:
            continue
        flow_cache[code] = flows

        retail_net = []
        for f in flows:
            val = f.get('retail') or f.get('retailNet') or f.get('retail_net') or f.get('individual')
            if val is not None:
                retail_net.append(float(val))

        if len(retail_net) >= MIN_FLOW_DAYS:
            window = min(20, len(retail_net))
            recent_sum = sum(retail_net[-window:])
            all_retail_sums.append(recent_sum)

    print(f'    Retail distribution: {len(all_retail_sums)} stocks')

    # ── 2차 패스: 종목별 시그널 산출 ──
    print('  [Phase 2] Computing per-stock signals...')
    results = {}
    skipped = 0

    for s in stocks_with_data:
        code = s.get('code', '')
        flows = flow_cache.get(code)
        if not flows:
            skipped += 1
            continue

        # 외국인 모멘텀
        foreign_mom = compute_foreign_momentum(flows)

        # 개인 역추세
        retail_sig = compute_retail_contrarian(flows, all_retail_sums)

        # 기관+외국인 정렬
        inst_align = compute_institutional_alignment(flows)

        # HMM 라벨 (전체 시장 공통)
        hmm = hmm_label

        # 모든 시그널이 None이면 건너뜀
        if all(v is None for v in [foreign_mom, retail_sig, inst_align, hmm]):
            skipped += 1
            continue

        results[code] = {
            'foreignMomentum': foreign_mom,
            'retailContrarian': retail_sig,
            'institutionalAlignment': inst_align,
            'hmmRegimeLabel': hmm,
        }

        if args.verbose and len(results) <= 10:
            print(f'    {code}: foreign={foreign_mom}, retail={retail_sig}, '
                  f'inst={inst_align}, hmm={hmm}')

    # ── 데이터 없는 종목도 HMM 라벨만 기록 ──
    if hmm_label and not args.code:
        for s in stocks:
            code = s.get('code', '')
            if code not in results and code not in flow_cache:
                results[code] = {
                    'foreignMomentum': None,
                    'retailContrarian': None,
                    'institutionalAlignment': None,
                    'hmmRegimeLabel': hmm_label,
                }

    # ── 요약 통계 ──
    signal_counts = {
        'foreignMomentum': {'buy': 0, 'sell': 0, 'neutral': 0, 'null': 0},
        'retailContrarian': {'contrarian_buy': 0, 'contrarian_sell': 0, 'neutral': 0, 'null': 0},
        'institutionalAlignment': {'aligned_buy': 0, 'aligned_sell': 0, 'misaligned': 0, 'neutral': 0, 'null': 0},
    }

    for code, sigs in results.items():
        for sig_name, counter in signal_counts.items():
            val = sigs.get(sig_name)
            if val is None:
                counter['null'] += 1
            elif val in counter:
                counter[val] += 1

    # ── 출력 ──
    output = {
        'generated': datetime.now().isoformat(timespec='seconds'),
        'status': 'ok',
        'stockCount': len(results),
        'flowDataCount': len(flow_cache),
        'hmmRegimeLabel': hmm_label,
        'hmmLatestDate': hmm_latest.get('date') if hmm_latest else None,
        'summary': signal_counts,
        'parameters': {
            'foreign_ma_window': FOREIGN_MA_WINDOW,
            'retail_extreme_pct': RETAIL_EXTREME_PCT,
            'hmm_stale_days': HMM_STALE_DAYS,
            'min_flow_days': MIN_FLOW_DAYS,
        },
        'stocks': results,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # ── 결과 출력 ──
    print(f'\n{"=" * 55}')
    print(f'Flow Signals 산출 완료')
    print(f'{"=" * 55}')
    print(f'  산출: {len(results)}종목 / 건너뜀: {skipped}종목')
    print(f'  흐름 데이터: {len(flow_cache)}종목')
    print(f'  HMM 라벨: {hmm_label}')
    print(f'')
    for sig_name, counter in signal_counts.items():
        non_null = {k: v for k, v in counter.items() if k != 'null'}
        print(f'  {sig_name}: {non_null}  (null={counter["null"]})')
    print(f'\n  저장: {OUT_PATH}')


if __name__ == '__main__':
    main()
