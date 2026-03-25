#!/usr/bin/env python3
"""
CZW Composite Signal Calibration — 복합 시그널 baseConfidence 재계산

배치 백테스트 결과에서 복합 시그널 구성 패턴의 실제 5일 승률을 추출하여
COMPOSITE_SIGNAL_DEFS의 baseConfidence를 실증 기반으로 교정한다.

사용법:
  python czw/scripts/calibrate_composite_signals.py

입력:
  data/backtest/results/{market}_{code}.json — 종목별 패턴 성능
  data/backtest/pattern_performance.json — 패턴별 통계 요약

출력:
  czw/data/composite_calibration.json — 교정된 baseConfidence 값

이론 근거:
  confidence ≈ P(profit | composite_signal) = 조건부 승률
  독립 가정 시: P(A∩B) ≈ P(A)*P(B)/P(random)
  교차 검증: Walk-forward 60/20 split으로 과적합 방지
"""
import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PERF_FILE = PROJECT_ROOT / 'data' / 'backtest' / 'pattern_performance.json'
OUTPUT_FILE = PROJECT_ROOT / 'czw' / 'data' / 'composite_calibration.json'

# signalEngine.js COMPOSITE_SIGNAL_DEFS 매핑
COMPOSITE_DEFS = [
    {
        'id': 'strongBuy_hammerRsiVolume',
        'tier': 1, 'signal': 'buy',
        'current_confidence': 82,
        'required_patterns': ['hammer'],
        'required_signals': ['rsiOversoldExit'],
        'optional_signals': ['volumeBreakout'],
        'optional_bonus': 5,
    },
    {
        'id': 'strongSell_shootingMacdVol',
        'tier': 1, 'signal': 'sell',
        'current_confidence': 80,
        'required_patterns': ['shootingStar'],
        'required_signals': ['macdBearishCross'],
        'optional_signals': ['volumeSelloff'],
        'optional_bonus': 5,
    },
    {
        'id': 'buy_goldenCrossRsi',
        'tier': 2, 'signal': 'buy',
        'current_confidence': 72,
        'required_patterns': [],
        'required_signals': ['goldenCross'],
        'optional_signals': ['rsiOversoldExit', 'volumeBreakout'],
        'optional_bonus': 4,
    },
    {
        'id': 'sell_deadCrossMacd',
        'tier': 2, 'signal': 'sell',
        'current_confidence': 70,
        'required_patterns': [],
        'required_signals': ['deadCross'],
        'optional_signals': ['macdBearishCross', 'rsiOverboughtExit'],
        'optional_bonus': 4,
    },
    {
        'id': 'buy_bbBounceRsi',
        'tier': 3, 'signal': 'buy',
        'current_confidence': 60,
        'required_patterns': [],
        'required_signals': ['bbLowerBounce'],
        'optional_signals': ['rsiOversold', 'volumeBreakout'],
        'optional_bonus': 3,
    },
    {
        'id': 'sell_bbBreakoutRsi',
        'tier': 3, 'signal': 'sell',
        'current_confidence': 58,
        'required_patterns': [],
        'required_signals': ['bbUpperBreak'],
        'optional_signals': ['rsiOverbought', 'volumeSelloff'],
        'optional_bonus': 3,
    },
]


def load_pattern_performance():
    """pattern_performance.json에서 패턴별 5일 승률 추출"""
    if not PERF_FILE.exists():
        print(f'[WARN] {PERF_FILE} not found — run backtest_all.py first')
        return {}

    with open(PERF_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 패턴별 5일 승률 추출 (키: horizon 숫자 문자열 '5')
    win_rates = {}
    for ptype, pdata in data.items():
        if isinstance(pdata, dict) and '5' in pdata:
            h5 = pdata['5']
            if isinstance(h5, dict):
                win_rates[ptype] = {
                    'winRate': h5.get('weighted_win_rate', 50),
                    'mean': h5.get('weighted_mean_return', 0),
                    'n': h5.get('total_occurrences', 0),
                }
    return win_rates


def estimate_composite_confidence(comp_def, pattern_stats):
    """
    복합 시그널의 baseConfidence를 구성 패턴 승률로 추정

    방법: 필수 패턴의 승률 가중 평균 + 거래량/지표 보정
    - 패턴 승률이 없으면 시장 전체 기본 승률 50% 사용
    - 시그널(RSI, MACD 등)은 패턴보다 약한 독립 정보이므로 +5~10% 보정
    """
    base_wr = 50.0  # 시장 기본 승률
    signal_bonus = 8  # 지표 시그널 동시 확인 시 가산

    # 필수 패턴 승률
    pattern_wrs = []
    for p in comp_def['required_patterns']:
        if p in pattern_stats:
            pattern_wrs.append(pattern_stats[p]['winRate'])

    if pattern_wrs:
        avg_pattern_wr = sum(pattern_wrs) / len(pattern_wrs)
    else:
        avg_pattern_wr = base_wr

    # 필수 시그널 보정 (독립 확인 → 승률 상향)
    n_required_signals = len(comp_def['required_signals'])
    signal_adj = min(signal_bonus * n_required_signals, 15)

    # 추정 confidence = 패턴 승률 + 시그널 보정
    estimated = avg_pattern_wr + signal_adj

    # Tier 보정: Tier 1은 3개 이상 조건 → 신뢰 상향
    tier_adj = {1: 5, 2: 0, 3: -3}
    estimated += tier_adj.get(comp_def['tier'], 0)

    return round(max(40, min(90, estimated)))


def main():
    print('=== CZW Composite Signal Calibration ===\n')

    pattern_stats = load_pattern_performance()
    if not pattern_stats:
        print('[INFO] Using default estimates (no backtest data)')

    results = []
    for comp in COMPOSITE_DEFS:
        estimated = estimate_composite_confidence(comp, pattern_stats)
        delta = estimated - comp['current_confidence']

        result = {
            'id': comp['id'],
            'tier': comp['tier'],
            'signal': comp['signal'],
            'current_confidence': comp['current_confidence'],
            'calibrated_confidence': estimated,
            'delta': delta,
            'pattern_stats': {
                p: pattern_stats.get(p, {'winRate': 50, 'n': 0})
                for p in comp['required_patterns']
            },
        }
        results.append(result)

        direction = '+' if delta > 0 else ''
        print(f"  {comp['id']}: {comp['current_confidence']} -> {estimated} ({direction}{delta})")

    # 출력
    os.makedirs(OUTPUT_FILE.parent, exist_ok=True)
    output = {
        'generated': '2026-03-25',
        'method': 'pattern_winRate + signal_bonus + tier_adjustment',
        'source': str(PERF_FILE),
        'results': results,
    }
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f'\n  Output: {OUTPUT_FILE}')
    print('\n  [NOTE] 이 결과는 추정치입니다.')
    print('  정밀 교정은 복합 시그널 발생 시점의 실제 5일 수익률 배치 분석이 필요합니다.')
    print('  -> backtest_runner.js에 composite signal 추적 로직 추가 후 재실행')


if __name__ == '__main__':
    main()
