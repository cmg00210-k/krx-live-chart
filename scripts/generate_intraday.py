#!/usr/bin/env python3
"""
분봉 캔들 데이터 생성 (일봉 기반 보간)
KRX 장시간(09:00-15:30 KST) 내 타임슬롯에 맞춤

일봉 OHLCV 데이터에서 브라운 브릿지 보간을 통해 분봉 데이터를 생성합니다.
실제 분봉 데이터가 없는 환경(file 모드)에서 demo 폴백 없이 분봉 차트를 표시할 수 있습니다.

출력 폴더 구조:
  data/
  ├── kospi/
  │   ├── 005930.json         ← 일봉 (기존)
  │   ├── 005930_5m.json      ← 5분봉 (생성)
  │   └── ...
  └── kosdaq/
      ├── 247540_1m.json      ← 1분봉 (생성)
      └── ...

사용법:
  python generate_intraday.py                    # 전 종목, 모든 분봉
  python generate_intraday.py --code 005930      # 단일 종목
  python generate_intraday.py --timeframe 5m     # 5분봉만
  python generate_intraday.py --days 10          # 최근 10일만 (기본: 30일)
"""

import sys
import json
import os
import argparse
import math
import random
import time
import calendar
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

# ── KRX 장시간 (KST) ──
KST_OFFSET_SECONDS = 9 * 3600   # UTC+9 (초)
KST_OFFSET_DELTA = timedelta(hours=9)
MARKET_OPEN_MIN = 9 * 60        # 09:00 (분 단위)
MARKET_CLOSE_MIN = 15 * 60 + 30 # 15:30 (분 단위)

# ── 지원 타임프레임 ──
TIMEFRAMES = {
    '1m':  1,
    '5m':  5,
    '15m': 15,
    '30m': 30,
    '1h':  60,
}


def _brownian_bridge(start, end, high, low, n, rng):
    """브라운 브릿지: start에서 end까지, [low, high] 범위 내 랜덤 경로 생성

    브라운 브릿지는 양 끝점이 고정된 확률 과정으로,
    일봉의 시가→종가 경로를 자연스럽게 보간합니다.
    고가/저가 범위를 제약 조건으로 사용하여 현실성을 높입니다.

    Args:
        start: 시작 가격 (일봉 시가)
        end:   종료 가격 (일봉 종가)
        high:  최고 가격 (일봉 고가)
        low:   최저 가격 (일봉 저가)
        n:     경로 노드 수 (슬롯 수 + 1)
        rng:   random.Random 인스턴스

    Returns:
        list[float]: n개의 가격 경로
    """
    if n <= 1:
        return [start]

    price_range = high - low
    # 노이즈 스케일: 일봉 변동폭에 비례 (최소 0.05% 보장)
    noise_scale = max(price_range * 0.1, start * 0.0005)

    path = [float(start)]
    for i in range(1, n - 1):
        t = i / (n - 1)
        # 선형 보간 기대값
        expected = start + t * (end - start)
        # 가우시안 노이즈 (시간 중앙부에서 더 큰 분산 — 브릿지 특성)
        bridge_var = t * (1 - t)
        noise = rng.gauss(0, noise_scale * math.sqrt(bridge_var))
        price = expected + noise
        # 고가/저가 범위로 클리핑
        price = max(low, min(high, price))
        path.append(price)

    path.append(float(end))
    return path


def generate_intraday(daily_candles, timeframe_min, days=30, seed=42):
    """일봉 데이터에서 분봉 보간 생성

    Args:
        daily_candles: 일봉 캔들 리스트 [{ time, open, high, low, close, volume }, ...]
        timeframe_min: 분봉 간격 (1, 5, 15, 60)
        days:          생성할 최근 일수 (기본: 30)
        seed:          랜덤 시드 (재현성 보장)

    Returns:
        list[dict]: 분봉 캔들 배열 (time은 Unix 타임스탬프)
    """
    rng = random.Random(seed)
    intraday = []
    slots_per_day = (MARKET_CLOSE_MIN - MARKET_OPEN_MIN) // timeframe_min

    # 최근 N일만 사용 (일봉 데이터가 부족하면 있는 만큼)
    target_days = daily_candles[-days:] if len(daily_candles) > days else daily_candles

    for day in target_days:
        date_str = day['time']  # "YYYY-MM-DD"
        o = day['open']
        h = day['high']
        l = day['low']
        c = day['close']
        v = day.get('volume', 0)

        # 유효성 검증
        if o <= 0 or h <= 0 or l <= 0 or c <= 0:
            continue
        if h < l:
            continue

        # 일중 가격 경로 생성 (브라운 브릿지)
        prices = _brownian_bridge(o, c, h, l, slots_per_day + 1, rng)
        vol_per_slot = max(1, v // slots_per_day)

        try:
            base_dt = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            continue

        # 주말 건너뛰기
        if base_dt.weekday() >= 5:
            continue

        for s in range(slots_per_day):
            slot_min = MARKET_OPEN_MIN + s * timeframe_min
            hour = slot_min // 60
            minute = slot_min % 60

            # KST 시각 → UTC 타임스탬프 변환
            # Python의 naive datetime.timestamp()는 로컬(KST) 기준이므로
            # 수동 -9h 없이 calendar.timegm()으로 UTC 직접 계산
            kst_dt = base_dt.replace(hour=hour, minute=minute, second=0)
            utc_dt = kst_dt - KST_OFFSET_DELTA
            ts = int(calendar.timegm(utc_dt.timetuple()))

            slot_o = prices[s]
            slot_c = prices[s + 1]

            # 분봉 내 고가/저가: 시가/종가 범위에 약간의 위크 추가
            wick_factor = rng.random() * 0.002
            slot_h = max(slot_o, slot_c) * (1 + wick_factor)
            slot_l = min(slot_o, slot_c) * (1 - rng.random() * 0.002)

            # 일봉 범위를 벗어나지 않도록 클리핑
            slot_h = min(slot_h, h)
            slot_l = max(slot_l, l)

            # 거래량: 장 시작/마감 근처에서 높게 (U자형 분포)
            slot_progress = s / max(slots_per_day - 1, 1)
            vol_weight = 1.5 - math.cos(slot_progress * math.pi * 2) * 0.5
            slot_v = int(vol_per_slot * vol_weight * (0.5 + rng.random()))

            intraday.append({
                'time': ts,
                'open': round(slot_o),
                'high': round(slot_h),
                'low': round(slot_l),
                'close': round(slot_c),
                'volume': max(1, slot_v),
            })

    return intraday


def process_stock(code, market, timeframes_to_generate, days):
    """단일 종목의 분봉 데이터 생성

    Args:
        code:      종목 코드 (예: "005930")
        market:    시장 ("kospi" 또는 "kosdaq")
        timeframes_to_generate: 생성할 타임프레임 리스트 (예: ["5m", "15m"])
        days:      생성할 최근 일수

    Returns:
        dict: { timeframe: candle_count } 또는 None (실패 시)
    """
    # 일봉 파일 로드
    daily_path = os.path.join(DATA_DIR, market, f"{code}.json")
    if not os.path.exists(daily_path):
        return None

    try:
        with open(daily_path, "r", encoding="utf-8") as f:
            daily_data = json.load(f)
    except (json.JSONDecodeError, IOError):
        return None

    daily_candles = daily_data.get("candles", [])
    if not daily_candles:
        return None

    name = daily_data.get("name", code)
    # 종목 코드를 시드로 사용 (재현성 보장 — 같은 종목은 항상 같은 분봉)
    seed = sum(ord(ch) for ch in code)

    results = {}

    for tf_name in timeframes_to_generate:
        tf_min = TIMEFRAMES[tf_name]

        intraday = generate_intraday(daily_candles, tf_min, days=days, seed=seed)
        if not intraday:
            continue

        # 파일 저장: {code}_{timeframe}.json
        output_data = {
            "code": code,
            "name": name,
            "market": market.upper(),
            "timeframe": tf_name,
            "count": len(intraday),
            "generated": True,  # 보간 데이터 표시 (실제 분봉과 구분)
            "source_days": min(days, len(daily_candles)),
            "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "candles": intraday,
        }

        output_path = os.path.join(DATA_DIR, market, f"{code}_{tf_name}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, separators=(",", ":"))

        results[tf_name] = len(intraday)

    return results


def main():
    parser = argparse.ArgumentParser(
        description="분봉 캔들 데이터 생성 (일봉 기반 브라운 브릿지 보간)"
    )
    parser.add_argument("--code", type=str, help="특정 종목 코드만 (예: 005930)")
    parser.add_argument("--timeframe", type=str, choices=list(TIMEFRAMES.keys()),
                        help="특정 타임프레임만 (예: 5m)")
    parser.add_argument("--days", type=int, default=30,
                        help="최근 N일 분봉 생성 (기본: 30)")
    parser.add_argument("--market", type=str, choices=["kospi", "kosdaq"],
                        help="특정 시장만")
    args = parser.parse_args()

    # 생성할 타임프레임 결정
    if args.timeframe:
        tf_list = [args.timeframe]
    else:
        tf_list = list(TIMEFRAMES.keys())

    # 대상 시장
    if args.market:
        markets = [args.market]
    else:
        markets = ["kospi", "kosdaq"]

    print(f"{'=' * 50}")
    print(f"  분봉 캔들 생성기 (브라운 브릿지 보간)")
    print(f"  타임프레임: {', '.join(tf_list)}")
    print(f"  최근 {args.days}일 기준")
    print(f"{'=' * 50}")
    print()

    start_time = time.time()
    total_success = 0
    total_skip = 0
    total_candles = 0

    for market in markets:
        market_dir = os.path.join(DATA_DIR, market)
        if not os.path.isdir(market_dir):
            print(f"  {market}/ 폴더 없음 — 건너뜀")
            continue

        # 대상 종목 수집
        if args.code:
            codes = [args.code]
        else:
            # 일봉 JSON 파일만 수집 ({code}.json, _가 없는 것만)
            codes = []
            for fname in sorted(os.listdir(market_dir)):
                if fname.endswith(".json") and "_" not in fname:
                    codes.append(fname.replace(".json", ""))

        print(f"  [{market.upper()}] {len(codes)}종목 처리 중...")

        for i, code in enumerate(codes):
            results = process_stock(code, market, tf_list, args.days)

            if results is None:
                total_skip += 1
                continue

            total_success += 1
            for tf_name, count in results.items():
                total_candles += count

            # 진행률 표시 (100개마다)
            if (i + 1) % 100 == 0 or i < 3:
                print(f"    [{i + 1}/{len(codes)}] {code}: "
                      f"{', '.join(f'{k}={v}건' for k, v in results.items())}")

    elapsed = time.time() - start_time

    print()
    print(f"{'=' * 50}")
    print(f"  완료! ({elapsed:.1f}초 소요)")
    print(f"  성공: {total_success}종목 | 건너뜀: {total_skip}종목")
    print(f"  총 캔들: {total_candles:,}개")
    print(f"  타임프레임: {', '.join(tf_list)}")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
