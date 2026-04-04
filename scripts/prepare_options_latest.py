#!/usr/bin/env python3
"""
prepare_options_latest.py -- options_daily.json -> options_latest.json 변환

compute_options_analytics.py는 단일 거래일의 옵션 체인(options_latest.json)을 기대하지만,
download_derivatives.py는 전체 일별 이력(options_daily.json)을 출력한다.
이 스크립트가 변환 브릿지 역할을 한다.

변환 로직:
  1. options_daily.json에서 최신 거래일 레코드만 추출
  2. 만기별 근월물/차월물 분리
  3. 필드 매핑: optionType->type, strikePrice->strike, closePrice/close->close,
     openInterest->oi, volume->volume
  4. spot 가격을 kospi200_daily.json에서 읽어 추가
  5. 잔존기간(timeToExpiry) 계산

사용법:
    python scripts/prepare_options_latest.py
    python scripts/prepare_options_latest.py --verbose
    python scripts/prepare_options_latest.py --date 2026-04-01

의존성: 없음 (순수 Python)
"""

import json
import os
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse
from datetime import datetime, date

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'data')
DERIV_DIR = os.path.join(DATA_DIR, 'derivatives')

OPTIONS_DAILY_PATH = os.path.join(DERIV_DIR, 'options_daily.json')
OPTIONS_LATEST_PATH = os.path.join(DERIV_DIR, 'options_latest.json')
KOSPI200_PATH = os.path.join(DATA_DIR, 'market', 'kospi200_daily.json')


def _load_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f'[WARN] {path}: {e}')
        return None


def _extract_contract_month(contract_name):
    """종목명에서 만기월(YYYYMM) 추출. 예: '코스피 200 C 202604 350' -> '202604'"""
    match = re.search(r'(20\d{4})', contract_name)
    if match:
        return match.group(1)
    return None


def _calc_days_to_expiry(contract_month, ref_date):
    """만기월에서 잔존 거래일수 추산 (매월 두 번째 목요일 만기 가정)."""
    try:
        year = int(contract_month[:4])
        month = int(contract_month[4:6])
        # 두 번째 목요일 계산
        first_day = date(year, month, 1)
        # 첫 번째 목요일 찾기
        weekday = first_day.weekday()  # 0=Mon
        days_to_thu = (3 - weekday) % 7
        first_thu = first_day.day + days_to_thu
        second_thu = first_thu + 7
        expiry = date(year, month, second_thu)
        delta = (expiry - ref_date).days
        return max(delta, 1)
    except (ValueError, OverflowError):
        return 20  # 기본값 ~1개월


def main():
    parser = argparse.ArgumentParser(description='options_daily.json -> options_latest.json 변환')
    parser.add_argument('--verbose', action='store_true')
    parser.add_argument('--date', default=None, help='특정 거래일 선택 (YYYY-MM-DD, 기본: 최신)')
    args = parser.parse_args()

    print('=== prepare_options_latest.py ===')

    # 1. options_daily.json 로드
    daily = _load_json(OPTIONS_DAILY_PATH)
    if not daily or not isinstance(daily, list) or len(daily) == 0:
        print(f'[ERROR] {OPTIONS_DAILY_PATH} not found or empty')
        print('  -> Run: python scripts/download_derivatives.py --options-only')
        sys.exit(1)

    # 2. 최신 거래일 또는 지정 거래일 필터
    all_dates = sorted(set(r.get('time', '') for r in daily if r.get('time')))
    if not all_dates:
        print('[ERROR] No valid dates in options_daily.json')
        sys.exit(1)

    target_date = args.date if args.date else all_dates[-1]
    if target_date not in all_dates:
        print(f'[ERROR] Date {target_date} not found. Available: {all_dates[:5]}...{all_dates[-3:]}')
        sys.exit(1)

    latest_records = [r for r in daily if r.get('time') == target_date]
    print(f'  Target date: {target_date}')
    print(f'  Records: {len(latest_records)}')

    # 3. spot 가격 로드
    spot = None
    kospi200 = _load_json(KOSPI200_PATH)
    if kospi200 and isinstance(kospi200, list):
        # 가장 가까운 날짜의 종가
        for rec in reversed(kospi200):
            t = rec.get('time', '')
            if t <= target_date:
                spot = rec.get('close')
                break
    if spot:
        print(f'  Spot (KOSPI200): {spot}')
    else:
        print('  [WARN] KOSPI200 spot not found — compute_options_analytics will try fallback')

    # 4. 만기월별 분류
    by_month = {}
    for r in latest_records:
        cn = r.get('contractName', '')
        cm = _extract_contract_month(cn)
        if cm:
            by_month.setdefault(cm, []).append(r)

    months_sorted = sorted(by_month.keys())
    if not months_sorted:
        print('[ERROR] No contract months found')
        sys.exit(1)

    near_month = months_sorted[0]
    next_month = months_sorted[1] if len(months_sorted) > 1 else None

    print(f'  Contract months: {months_sorted}')
    print(f'  Near-month: {near_month} ({len(by_month[near_month])} contracts)')
    if next_month:
        print(f'  Next-month: {next_month} ({len(by_month[next_month])} contracts)')

    # 5. 필드 매핑 + 변환
    ref_date = date.fromisoformat(target_date)

    def _extract_strike_from_name(name):
        """종목명에서 행사가 추출. 예: '미니코스피 C 202604   415.0 (야간)' -> 415.0"""
        # 괄호 제거 후 마지막 숫자
        cleaned = re.sub(r'\(.*?\)', '', name).strip()
        match = re.search(r'(\d+\.?\d*)\s*$', cleaned)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        return None

    def transform_records(records, contract_month):
        result = []
        for r in records:
            opt_type = r.get('optionType', 'unknown').lower()
            strike = r.get('strikePrice')
            if strike is None:
                strike = _extract_strike_from_name(r.get('contractName', ''))
            close = r.get('close')
            volume = r.get('volume', 0) or 0
            oi = r.get('openInterest', 0) or 0
            iv = r.get('iv')

            if not strike or not close or close <= 0:
                continue

            entry = {
                'type': opt_type,
                'strike': strike,
                'close': close,
                'volume': volume,
                'oi': oi,
            }
            if iv is not None:
                entry['iv'] = iv

            if args.verbose:
                cn = r.get('contractName', '')
                print(f'    {opt_type:4s} K={strike:8.1f} C={close:8.2f} V={volume:>8} OI={oi:>8}  {cn}')

            result.append(entry)
        return result

    near_options = transform_records(by_month[near_month], near_month)
    next_options = transform_records(by_month[next_month], next_month) if next_month else []

    near_days = _calc_days_to_expiry(near_month, ref_date)
    next_days = _calc_days_to_expiry(next_month, ref_date) if next_month else None

    # 6. 출력 구성
    output = {
        'date': target_date,
        'near': near_options,
        'next': next_options,
        'timeToExpiry': near_days,
        'nextTimeToExpiry': next_days,
    }
    if spot:
        output['spot'] = spot

    call_count = sum(1 for o in near_options if o['type'] == 'call')
    put_count = sum(1 for o in near_options if o['type'] == 'put')
    print(f'  Near-month output: {call_count} calls + {put_count} puts = {len(near_options)}')

    if next_options:
        nc = sum(1 for o in next_options if o['type'] == 'call')
        np_ = sum(1 for o in next_options if o['type'] == 'put')
        print(f'  Next-month output: {nc} calls + {np_} puts = {len(next_options)}')

    # 7. 저장
    os.makedirs(DERIV_DIR, exist_ok=True)
    with open(OPTIONS_LATEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(OPTIONS_LATEST_PATH) / 1024
    print(f'\n  Saved: {OPTIONS_LATEST_PATH} ({size_kb:.1f}KB)')
    print(f'  Days to expiry (near): {near_days}d')
    if next_days:
        print(f'  Days to expiry (next): {next_days}d')
    print('=== Done ===')


if __name__ == '__main__':
    main()
