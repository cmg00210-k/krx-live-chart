#!/usr/bin/env python3
"""
KRX 공매도 데이터 다운로더 (Short Selling Data Downloader)

데이터 소스: data.krx.co.kr (KRX 정보데이터시스템)
인증 방식: OTP 2단계 — generate.cmd → download.cmd

출력:
  data/derivatives/shortselling_daily.json   — 공매도 거래현황 (종목별 일별)
  data/derivatives/shortselling_balance.json  — 공매도 잔고현황 (종목별 일별)
  data/derivatives/shortselling_summary.json  — 공매도 요약 (SIR, DTC, 스퀴즈 후보)

학술 근거: core_data/31_microeconomics_market_signals.md §3
  정보비대칭 기반 공매도 시그널 — 공매도 잔고비율(SIR), Days-to-Cover,
  Short Squeeze 후보 선별, 시장 전체 공매도 비율 추세

사용법:
    python scripts/download_shortselling.py
    python scripts/download_shortselling.py --start 2025-01-01 --end 2026-04-01
    python scripts/download_shortselling.py --market STK    # KOSPI만
    python scripts/download_shortselling.py --market KSQ    # KOSDAQ만
    python scripts/download_shortselling.py --verbose
"""

import argparse
import csv
import io
import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta
from collections import defaultdict

# krx_otp.py와 같은 디렉터리에 있으므로 import path 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from krx_otp import KRXOTPClient, KRXOTPError
from api_constants import (
    clean_csv_fieldnames as _clean_fieldnames, parse_number as _parse_number_base,
    TIMEOUT_HEAVY,
)

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DERIVATIVES_DIR = os.path.join(DATA_DIR, "derivatives")

# ── KRX CSV 한글 컬럼 매핑 ──

# 공매도 거래현황 (MDCSTAT08601 — 전종목)
TRADE_COLUMN_MAP = {
    "종목코드": "code",
    "종목명": "name",
    "공매도거래량": "shortVolume",
    "공매도거래대금": "shortAmount",
    "총거래량": "totalVolume",
    "총거래대금": "totalAmount",
    "공매도비중": "shortRatio",
    "직전40거래일평균공매도비중": "avgShortRatio40",
}

# 공매도 잔고현황 (MDCSTAT08301 — 전종목)
BALANCE_COLUMN_MAP = {
    "종목코드": "code",
    "종목명": "name",
    "공매도잔고수량": "shortBalance",
    "공매도잔고금액": "shortBalanceAmount",
    "상장주식수": "listedShares",
    "공매도잔고비율": "shortBalanceRatio",
}


def parse_number(val: str) -> float:
    """쉼표/공백 제거 후 숫자 파싱. 빈 값이면 0.
    코어 파싱은 api_constants.parse_number 위임.
    공매도 데이터는 None 대신 0.0 반환 (집계 로직 보호).
    """
    result = _parse_number_base(val)
    return float(result) if result is not None else 0.0


def parse_trade_csv(csv_text: str, date_str: str, market: str) -> list:
    """
    공매도 거래현황 CSV 파싱 (MDCSTAT08601 — 전종목 일별).

    Parameters:
        csv_text:  EUC-KR 디코딩된 CSV 원문
        date_str:  해당 거래일 (YYYY-MM-DD)
        market:    STK 또는 KSQ

    Returns:
        list of dicts [{code, name, shortVolume, shortAmount, totalVolume,
                        totalAmount, shortRatio, market, date}]
    """
    records = []
    reader = csv.DictReader(io.StringIO(csv_text))

    # BOM 및 공백 제거
    reader.fieldnames = _clean_fieldnames(reader.fieldnames)

    for row in reader:
        try:
            code = row.get("종목코드", "").strip()
            if not code:
                continue

            name = row.get("종목명", "").strip()

            record = {
                "code": code,
                "name": name,
                "date": date_str,
                "market": "KOSPI" if market == "STK" else "KOSDAQ",
                "shortVolume": int(parse_number(row.get("공매도거래량", "0"))),
                "shortAmount": int(parse_number(row.get("공매도거래대금", "0"))),
                "totalVolume": int(parse_number(row.get("총거래량", "0"))),
                "totalAmount": int(parse_number(row.get("총거래대금", "0"))),
            }

            # 공매도비중: KRX가 %로 제공하기도 하고 비율로 제공하기도 함
            raw_ratio = row.get("공매도비중", "0")
            ratio = parse_number(raw_ratio)
            # 100보다 크면 이미 %가 아닌 절대값 (KRX 포맷 변동 대비)
            if record["totalVolume"] > 0:
                record["shortRatio"] = round(
                    record["shortVolume"] / record["totalVolume"] * 100, 2
                )
            else:
                record["shortRatio"] = 0.0

            records.append(record)

        except (ValueError, KeyError):
            continue

    return records


def parse_balance_csv(csv_text: str, date_str: str, market: str) -> list:
    """
    공매도 잔고현황 CSV 파싱 (MDCSTAT08301 — 전종목 일별).

    Parameters:
        csv_text:  EUC-KR 디코딩된 CSV 원문
        date_str:  해당 거래일 (YYYY-MM-DD)
        market:    STK 또는 KSQ

    Returns:
        list of dicts [{code, name, shortBalance, shortBalanceAmount,
                        listedShares, shortBalanceRatio, market, date}]
    """
    records = []
    reader = csv.DictReader(io.StringIO(csv_text))

    # BOM 및 공백 제거
    reader.fieldnames = _clean_fieldnames(reader.fieldnames)

    for row in reader:
        try:
            code = row.get("종목코드", "").strip()
            if not code:
                continue

            name = row.get("종목명", "").strip()

            short_bal = int(parse_number(row.get("공매도잔고수량", "0")))
            short_bal_amt = int(parse_number(row.get("공매도잔고금액", "0")))
            listed = int(parse_number(row.get("상장주식수", "0")))

            # 잔고비율: 직접 계산 (KRX 제공값 대비 정확도 확보)
            if listed > 0:
                bal_ratio = round(short_bal / listed * 100, 4)
            else:
                bal_ratio = 0.0

            record = {
                "code": code,
                "name": name,
                "date": date_str,
                "market": "KOSPI" if market == "STK" else "KOSDAQ",
                "shortBalance": short_bal,
                "shortBalanceAmount": short_bal_amt,
                "listedShares": listed,
                "shortBalanceRatio": bal_ratio,
            }

            records.append(record)

        except (ValueError, KeyError):
            continue

    return records


def download_trade_data(
    client: KRXOTPClient,
    start_yyyymmdd: str, end_yyyymmdd: str, market: str, verbose: bool = False
) -> list:
    """
    공매도 거래현황 다운로드 (MDCSTAT08601).
    KRX 전종목 일별 공매도 거래 — 기간 단위로 한번에 조회.

    Parameters:
        client:         KRXOTPClient 인스턴스 (재시도/백오프 내장)
        start_yyyymmdd: 시작일 (YYYYMMDD)
        end_yyyymmdd:   종료일 (YYYYMMDD)
        market:         STK (KOSPI) 또는 KSQ (KOSDAQ)
        verbose:        상세 로그 출력 여부

    Returns:
        list of trade records
    """
    date_str = f"{end_yyyymmdd[:4]}-{end_yyyymmdd[4:6]}-{end_yyyymmdd[6:]}"
    market_name = "KOSPI" if market == "STK" else "KOSDAQ"

    if verbose:
        print(f"  [거래] {market_name} CSV 다운로드 중...")

    csv_text = client.fetch_csv(
        stat_url="dbms/MDC/STAT/standard/MDCSTAT08601",
        params={
            "mktId": market,
            "strtDd": start_yyyymmdd,
            "endDd": end_yyyymmdd,
        },
        csv_timeout=TIMEOUT_HEAVY,  # 전종목 CSV는 크므로 타임아웃 여유
    )

    if verbose:
        print(f"  [거래] {market_name} CSV 수신 ({len(csv_text):,} bytes)")

    records = parse_trade_csv(csv_text, date_str, market)
    return records


def download_balance_data(
    client: KRXOTPClient,
    date_yyyymmdd: str, market: str, verbose: bool = False
) -> list:
    """
    공매도 잔고현황 다운로드 (MDCSTAT08301).
    KRX 전종목 특정일 공매도 잔고 — 일자 단위 조회.

    Parameters:
        client:        KRXOTPClient 인스턴스 (재시도/백오프 내장)
        date_yyyymmdd: 조회일 (YYYYMMDD)
        market:        STK (KOSPI) 또는 KSQ (KOSDAQ)
        verbose:       상세 로그 출력 여부

    Returns:
        list of balance records
    """
    date_str = f"{date_yyyymmdd[:4]}-{date_yyyymmdd[4:6]}-{date_yyyymmdd[6:]}"
    market_name = "KOSPI" if market == "STK" else "KOSDAQ"

    if verbose:
        print(f"  [잔고] {market_name} CSV 다운로드 중...")

    csv_text = client.fetch_csv(
        stat_url="dbms/MDC/STAT/standard/MDCSTAT08301",
        params={
            "mktId": market,
            "schDate": date_yyyymmdd,
            "strtDd": date_yyyymmdd,
            "endDd": date_yyyymmdd,
        },
        csv_timeout=TIMEOUT_HEAVY,  # 전종목 CSV는 크므로 타임아웃 여유
    )

    if verbose:
        print(f"  [잔고] {market_name} CSV 수신 ({len(csv_text):,} bytes)")

    records = parse_balance_csv(csv_text, date_str, market)
    return records


def compute_summary(
    trade_records: list,
    balance_records: list,
    verbose: bool = False,
) -> dict:
    """
    공매도 요약 지표 산출.

    산출 지표:
      - Short Interest Ratio (SIR) = 공매도 잔고 / 평균 일거래량
      - Days to Cover (DTC) = 공매도 잔고 / 20일 평균 거래량
      - Short Squeeze 후보: SIR > 5 AND 최근 가격 상승 > 3%
      - 시장 전체 공매도 비율 추세 (5일/20일 이동평균)

    Parameters:
        trade_records:   download_trade_data() 결과
        balance_records: download_balance_data() 결과
        verbose:         상세 로그 출력 여부

    Returns:
        summary dict
    """
    # ── 종목별 거래량 집계 (DTC 산출용) ──
    volume_by_code = defaultdict(list)
    short_volume_by_code = defaultdict(list)
    for rec in trade_records:
        code = rec["code"]
        volume_by_code[code].append(rec["totalVolume"])
        short_volume_by_code[code].append(rec["shortVolume"])

    # ── SIR & DTC 산출 ──
    sir_results = []
    for bal in balance_records:
        code = bal["code"]
        short_balance = bal["shortBalance"]

        volumes = volume_by_code.get(code, [])
        if not volumes:
            continue

        # 평균 일거래량 (보유 데이터 전체 기간)
        avg_volume = sum(volumes) / len(volumes)

        # 20일 평균 거래량 (최근 20개)
        recent_20 = volumes[-20:] if len(volumes) >= 20 else volumes
        avg_volume_20 = sum(recent_20) / len(recent_20) if recent_20 else 0

        # SIR = 잔고 / 평균 거래량
        sir = round(short_balance / avg_volume, 2) if avg_volume > 0 else 0
        # DTC = 잔고 / 20일 평균 거래량
        dtc = round(short_balance / avg_volume_20, 2) if avg_volume_20 > 0 else 0

        # 공매도 거래 비중 추세 (최근 데이터)
        short_vols = short_volume_by_code.get(code, [])
        total_vols = volume_by_code.get(code, [])

        # 최근 5일/20일 공매도 비중
        def calc_short_ratio_ma(sv_list, tv_list, window):
            if len(sv_list) < window or len(tv_list) < window:
                return None
            recent_sv = sv_list[-window:]
            recent_tv = tv_list[-window:]
            total_tv = sum(recent_tv)
            if total_tv == 0:
                return 0
            return round(sum(recent_sv) / total_tv * 100, 2)

        ratio_5d = calc_short_ratio_ma(short_vols, total_vols, 5)
        ratio_20d = calc_short_ratio_ma(short_vols, total_vols, 20)

        entry = {
            "code": code,
            "name": bal["name"],
            "market": bal["market"],
            "shortBalance": short_balance,
            "shortBalanceRatio": bal["shortBalanceRatio"],
            "avgVolume": int(avg_volume),
            "avgVolume20": int(avg_volume_20),
            "sir": sir,
            "daysToCover": dtc,
            "shortRatio5d": ratio_5d,
            "shortRatio20d": ratio_20d,
        }
        sir_results.append(entry)

    # ── Short Squeeze 후보 (SIR > 5) ──
    # 가격 데이터는 이 스크립트에서 직접 접근하지 않으므로
    # SIR > 5 기준으로만 선별 (가격 변동은 JS 사이드에서 결합)
    squeeze_candidates = [
        {
            "code": r["code"],
            "name": r["name"],
            "market": r["market"],
            "sir": r["sir"],
            "daysToCover": r["daysToCover"],
            "shortBalanceRatio": r["shortBalanceRatio"],
        }
        for r in sir_results
        if r["sir"] > 5
    ]
    squeeze_candidates.sort(key=lambda x: x["sir"], reverse=True)

    # ── 시장 전체 공매도 비율 (일별) ──
    daily_market_short = defaultdict(lambda: {"shortVol": 0, "totalVol": 0})
    for rec in trade_records:
        date = rec.get("date", "")
        daily_market_short[date]["shortVol"] += rec["shortVolume"]
        daily_market_short[date]["totalVol"] += rec["totalVolume"]

    market_trend = []
    for date in sorted(daily_market_short.keys()):
        d = daily_market_short[date]
        ratio = round(d["shortVol"] / d["totalVol"] * 100, 2) if d["totalVol"] > 0 else 0
        market_trend.append({"date": date, "shortRatio": ratio})

    # 5일/20일 이동평균
    for i, item in enumerate(market_trend):
        # 5일 MA
        if i >= 4:
            window_5 = [market_trend[j]["shortRatio"] for j in range(i - 4, i + 1)]
            item["shortRatioMA5"] = round(sum(window_5) / 5, 2)
        else:
            item["shortRatioMA5"] = None

        # 20일 MA
        if i >= 19:
            window_20 = [market_trend[j]["shortRatio"] for j in range(i - 19, i + 1)]
            item["shortRatioMA20"] = round(sum(window_20) / 20, 2)
        else:
            item["shortRatioMA20"] = None

    # SIR 기준 상위 종목
    sir_results.sort(key=lambda x: x["sir"], reverse=True)
    top_sir = sir_results[:50]

    # Flat compat: latest market short ratio for JS [C-4 FIX]
    latest_market_ratio = market_trend[-1]["shortRatio"] if market_trend else 0
    latest_market_ratio_5d = market_trend[-1].get("shortRatioMA5", 0) if market_trend else 0
    latest_market_ratio_20d = market_trend[-1].get("shortRatioMA20", 0) if market_trend else 0
    latest_date = market_trend[-1]["date"] if market_trend else datetime.now().strftime("%Y-%m-%d")

    summary = {
        "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "date": latest_date,  # flat compat key for JS [C-4 FIX]
        "source": "live",  # Pipeline CHECK 6 guard — must not be "sample"
        "totalStocks": len(sir_results),
        "squeeze_candidates": squeeze_candidates[:30],
        "topSIR": top_sir,
        "marketTrend": market_trend,
        "stats": {
            "avgSIR": round(
                sum(r["sir"] for r in sir_results) / len(sir_results), 2
            ) if sir_results else 0,
            "avgDTC": round(
                sum(r["daysToCover"] for r in sir_results) / len(sir_results), 2
            ) if sir_results else 0,
            "squeezeCount": len(squeeze_candidates),
        },
        # Flat compat keys for JS backward compatibility [C-4 FIX]
        "market_short_ratio": latest_market_ratio,
        "market_short_ratio_5d_ma": latest_market_ratio_5d,
        "market_short_ratio_20d_ma": latest_market_ratio_20d,
        "total_short_volume": sum(r["shortVolume"] for r in trade_records) if trade_records else 0,
        "total_volume": sum(r["totalVolume"] for r in trade_records) if trade_records else 0,
    }

    if verbose:
        print(f"  [요약] 전체 {len(sir_results)}종목 분석")
        print(f"  [요약] 평균 SIR: {summary['stats']['avgSIR']}")
        print(f"  [요약] 평균 DTC: {summary['stats']['avgDTC']}")
        print(f"  [요약] 스퀴즈 후보: {len(squeeze_candidates)}종목 (SIR > 5)")

    return summary


def save_json(data, filepath: str, verbose: bool = False):
    """JSON 파일 저장 (디렉터리 자동 생성)."""
    out_dir = os.path.dirname(os.path.abspath(filepath))
    os.makedirs(out_dir, exist_ok=True)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(filepath) / 1024
    if verbose:
        print(f"  [저장] {filepath} ({size_kb:.1f}KB)")

    return size_kb


# ─────────────────────────────────────────��───────
# pykrx Fallback
# ─────────────────────────────────────────────────

def _pykrx_fallback_shortselling(start_str: str, end_str: str):
    """
    pykrx를 ���용한 공매도 거래현황 수집 (OTP 실패 시 fallback).
    Returns: (trade_records, balance_records) tuple. 실패 시 ([], []).
    """
    try:
        from pykrx import stock as pykrx_stock
    except ImportError:
        print("[공매도] pykrx 미설치 — pip install pykrx")
        return [], []

    import time as _time
    print(f"[공매도] pykrx fallback: {start_str} ~ {end_str}")
    start_fmt = start_str.replace("-", "")
    end_fmt = end_str.replace("-", "")
    trade_records = []
    balance_records = []

    # pykrx 1.2.4: get_shorting_volume_by_ticker(date, market) returns all tickers for 1 day
    # Iterate over business days, aggregate market totals per day
    from datetime import datetime as _dt
    start_d = _dt.strptime(start_fmt, "%Y%m%d")
    end_d = _dt.strptime(end_fmt, "%Y%m%d")
    current = start_d
    day_count = 0
    consecutive_failures = 0

    while current <= end_d:
        if current.weekday() >= 5:  # skip weekends
            current += timedelta(days=1)
            continue

        date_str_fmt = current.strftime("%Y%m%d")
        date_str_iso = current.strftime("%Y-%m-%d")

        for market_name in ["KOSPI", "KOSDAQ"]:
            mkt_code = "STK" if market_name == "KOSPI" else "KSQ"
            try:
                df = pykrx_stock.get_shorting_volume_by_ticker(
                    date_str_fmt, market=market_name
                )
                if df is None or df.empty:
                    continue

                # pykrx 1.2.4 columns: 공매도거래량, 총거래량, 공매도비중, ...
                total_short = int(df["공매도거래량"].sum()) if "공매도거래량" in df.columns else 0
                total_vol = int(df["총거래량"].sum()) if "총거래량" in df.columns else 0
                ratio = total_short / total_vol * 100 if total_vol > 0 else 0

                trade_records.append({
                    "date": date_str_iso,
                    "code": "MARKET",
                    "name": market_name,
                    "market": mkt_code,
                    "shortVolume": total_short,
                    "totalVolume": total_vol,
                    "shortRatio": round(ratio, 4),
                })
                day_count += 1
                consecutive_failures = 0  # 성공 시 리셋
            except (IndexError, KeyError, TypeError, ValueError, AttributeError) as e:
                consecutive_failures += 1
                if consecutive_failures <= 3:
                    print(f"  [pykrx] {market_name} {date_str_iso}: {type(e).__name__}")
                continue
            except Exception as e:
                consecutive_failures += 1
                if consecutive_failures <= 3:
                    print(f"  [pykrx] {market_name} {date_str_iso}: {type(e).__name__}: {e}")
                continue

        # 연속 실패 5회 이상이면 KRX OTP 차단으로 판단, 조기 종료
        if consecutive_failures >= 5:
            print("  [pykrx] 연속 5회 실패 — KRX OTP 차단 판단, 조기 종료")
            break

        _time.sleep(1)
        current += timedelta(days=1)

    if day_count > 0:
        print(f"  [pykrx] {day_count}건 수집 ({len(set(r['date'] for r in trade_records))}일)")
    else:
        print("  [pykrx] 공매도 데이터 없음 (KRX OTP 차단 시 정상)")

    return trade_records, balance_records


def main():
    parser = argparse.ArgumentParser(
        description="KRX 공매도 데이터 다운로더 (거래현황 + 잔고 + 요약)"
    )
    parser.add_argument(
        "--start",
        default=(datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"),
        help="거래현황 시작일 (YYYY-MM-DD, 기본: 30일 전)",
    )
    parser.add_argument(
        "--end",
        default=datetime.now().strftime("%Y-%m-%d"),
        help="거래현황/잔고 종료일 (YYYY-MM-DD, 기본: 오늘)",
    )
    parser.add_argument(
        "--market",
        default="ALL",
        choices=["STK", "KSQ", "ALL"],
        help="시장 선택: STK(KOSPI), KSQ(KOSDAQ), ALL(둘 다) (기본: ALL)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="상세 로그 출력",
    )
    args = parser.parse_args()

    # 날짜 형식 검증 및 YYYYMMDD 변환
    try:
        start_dt = datetime.strptime(args.start, "%Y-%m-%d")
        end_dt = datetime.strptime(args.end, "%Y-%m-%d")
    except ValueError as e:
        print(f"[공매도] 날짜 형식 오류: {e} (YYYY-MM-DD 사용)")
        raise SystemExit(1)

    if start_dt > end_dt:
        print(f"[공매도] 오류: 시작일({args.start})이 종료일({args.end})보다 늦습니다.")
        raise SystemExit(1)

    start_krx = start_dt.strftime("%Y%m%d")
    end_krx = end_dt.strftime("%Y%m%d")

    # 시장 목록 결정
    if args.market == "ALL":
        markets = ["STK", "KSQ"]
    else:
        markets = [args.market]

    print(f"[공매도] 다운로드 시작: {args.start} ~ {args.end}")
    print(f"[공매도] 시장: {', '.join('KOSPI' if m == 'STK' else 'KOSDAQ' for m in markets)}")

    # ── KRXOTPClient 초기화 (재시도/백오프/레이트리밋 내장) ──
    client = KRXOTPClient(verbose=args.verbose)

    # ── 1. 공매도 거래현황 다운로드 ──
    print(f"\n[공매도] ━━━ 1단계: 공매도 거래현황 (MDCSTAT08601) ━━━")
    all_trade_records = []
    for market in markets:
        try:
            records = download_trade_data(client, start_krx, end_krx, market, args.verbose)
            all_trade_records.extend(records)
            market_name = "KOSPI" if market == "STK" else "KOSDAQ"
            print(f"[공매도] {market_name} 거래현황: {len(records):,}건")
        except KRXOTPError as e:
            print(f"[공매도] 경고: {market} 거래현황 실패 — {e}")
        except ValueError as e:
            print(f"[공매도] 경고: {market} 거래현황 — {e}")

    # OTP 실패 시 pykrx fallback (거래현황만 — 잔고는 pykrx 미지원)
    if not all_trade_records:
        print("\n[공매도] OTP 수집 실패 — pykrx fallback 시도...")
        fallback_trades, fallback_balances = _pykrx_fallback_shortselling(args.start, args.end)
        all_trade_records = fallback_trades
        all_balance_records = fallback_balances

    # 거래현황 저장
    trade_output = os.path.join(DERIVATIVES_DIR, "shortselling_daily.json")
    if all_trade_records:
        # 날짜+코드 기준 정렬
        all_trade_records.sort(key=lambda r: (r["date"], r["code"]))
        trade_data = {
            "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "period": f"{args.start}~{args.end}",
            "totalRecords": len(all_trade_records),
            "records": all_trade_records,
        }
        kb = save_json(trade_data, trade_output, args.verbose)
        print(f"[공매도] 거래현황 저장: {trade_output} ({kb:.1f}KB)")
    else:
        print("[공매도] 경고: 거래현황 데이터 없음")

    # ── 2. 공매도 잔고현황 다운로드 ──
    print(f"\n[공매도] ━━━ 2단계: 공매도 잔고현황 (MDCSTAT08301) ━━━")
    all_balance_records = []
    for market in markets:
        try:
            records = download_balance_data(client, end_krx, market, args.verbose)
            all_balance_records.extend(records)
            market_name = "KOSPI" if market == "STK" else "KOSDAQ"
            print(f"[공매도] {market_name} 잔고현황: {len(records):,}건")
        except KRXOTPError as e:
            print(f"[공매도] 경고: {market} 잔고현황 실패 — {e}")
        except ValueError as e:
            print(f"[공매도] 경고: {market} 잔고현황 — {e}")

    # 잔고현황 저장
    balance_output = os.path.join(DERIVATIVES_DIR, "shortselling_balance.json")
    if all_balance_records:
        all_balance_records.sort(key=lambda r: (r["date"], r["code"]))
        balance_data = {
            "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "date": args.end,
            "totalRecords": len(all_balance_records),
            "records": all_balance_records,
        }
        kb = save_json(balance_data, balance_output, args.verbose)
        print(f"[공매도] 잔고현황 저장: {balance_output} ({kb:.1f}KB)")
    else:
        print("[공매도] 경고: 잔고현황 데이터 없음")

    # ── 3. 요약 지표 산출 ──
    print(f"\n[공매도] ━━━ 3단계: 요약 지표 산출 ━━━")
    summary_output = os.path.join(DERIVATIVES_DIR, "shortselling_summary.json")
    if all_trade_records and all_balance_records:
        summary = compute_summary(
            all_trade_records, all_balance_records, args.verbose
        )
        kb = save_json(summary, summary_output, args.verbose)
        print(f"[공매도] 요약 저장: {summary_output} ({kb:.1f}KB)")
    elif all_trade_records and not all_balance_records:
        # pykrx fallback: 거래현황만 있고 잔고 없음 → 간이 요약 생성
        print("[공매도] 잔고 없음 — 거래현황 기반 간이 요약 생성")
        daily_short = defaultdict(lambda: {"shortVol": 0, "totalVol": 0})
        for rec in all_trade_records:
            d = rec.get("date", "")
            daily_short[d]["shortVol"] += rec["shortVolume"]
            daily_short[d]["totalVol"] += rec["totalVolume"]
        market_trend = []
        for d in sorted(daily_short.keys()):
            dd = daily_short[d]
            ratio = round(dd["shortVol"] / dd["totalVol"] * 100, 2) if dd["totalVol"] > 0 else 0
            market_trend.append({"date": d, "shortRatio": ratio})
        latest_ratio = market_trend[-1]["shortRatio"] if market_trend else 0
        latest_date = market_trend[-1]["date"] if market_trend else args.end
        total_sv = sum(r["shortVolume"] for r in all_trade_records)
        total_v = sum(r["totalVolume"] for r in all_trade_records)
        summary = {
            "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "date": latest_date,
            "source": "pykrx",
            "totalStocks": 0,
            "squeeze_candidates": [],
            "topSIR": [],
            "marketTrend": market_trend,
            "stats": {"avgSIR": 0, "avgDTC": 0, "squeezeCount": 0},
            "market_short_ratio": latest_ratio,
            "market_short_ratio_5d_ma": 0,
            "market_short_ratio_20d_ma": 0,
            "total_short_volume": total_sv,
            "total_volume": total_v,
        }
        kb = save_json(summary, summary_output, args.verbose)
        print(f"[공매도] 간이 요약 저장: {summary_output} ({kb:.1f}KB)")

        # 최종 통계 출력
        stats = summary["stats"]
        print(f"\n[공매도] ══ 최종 통계 ══")
        print(f"  분석 종목 수: {summary['totalStocks']:,}")
        print(f"  평균 SIR (Short Interest Ratio): {stats['avgSIR']}")
        print(f"  평균 DTC (Days to Cover): {stats['avgDTC']}")
        print(f"  스퀴즈 후보 (SIR > 5): {stats['squeezeCount']}종목")

        if summary["squeeze_candidates"]:
            print(f"\n[공매도] ── 상위 스퀴즈 후보 (SIR > 5) ──")
            for i, c in enumerate(summary["squeeze_candidates"][:10]):
                print(
                    f"  {i+1:2d}. {c['code']} {c['name']:<12s} "
                    f"SIR={c['sir']:>6.1f}  DTC={c['daysToCover']:>6.1f}  "
                    f"잔고비율={c['shortBalanceRatio']:.2f}%"
                )

        if summary["marketTrend"]:
            latest = summary["marketTrend"][-1]
            print(f"\n[공매도] ── 시장 전체 공매도 비율 (최신) ──")
            print(f"  일자: {latest['date']}")
            print(f"  공매도 비율: {latest['shortRatio']}%")
            if latest.get("shortRatioMA5") is not None:
                print(f"  5일 MA: {latest['shortRatioMA5']}%")
            if latest.get("shortRatioMA20") is not None:
                print(f"  20일 MA: {latest['shortRatioMA20']}%")
    else:
        # Cached fallback: 기존 summary가 real data이고 90일 이내면 유지
        print("[공매도] 경고: 거래/잔고 데이터 부족으로 신규 요약 생성 불가")
        cache_applied = _try_cached_fallback(summary_output)
        if not cache_applied:
            # 캐시도 만료/없음 — source:"unavailable"로 최소한의 요약 생성
            print("[공매도] 캐시 만료 — source='unavailable' 최소 요약 생성")
            minimal = {
                "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
                "date": args.end,
                "source": "unavailable",
                "reason": "KRX OTP login required since Dec 2025; pykrx fallback blocked",
                "market_short_ratio": 0,
                "market_short_ratio_5d_ma": 0,
                "market_short_ratio_20d_ma": 0,
                "total_short_volume": 0,
                "total_volume": 0,
                "top_sir_stocks": [],
                "squeeze_candidates": [],
                "totalStocks": 0,
                "topSIR": [],
                "marketTrend": [],
                "stats": {"avgSIR": 0, "avgDTC": 0, "squeezeCount": 0},
            }
            kb = save_json(minimal, summary_output, args.verbose)
            print(f"[공매도] unavailable 요약 저장: {summary_output} ({kb:.1f}KB)")

    print(f"\n[공매도] 완료")


def _try_cached_fallback(summary_path: str, grace_days: int = 90) -> bool:
    """
    모든 수집이 실패한 경우, 기존 shortselling_summary.json이
    sample/unavailable이 아니고 grace_days 이내면 source='cached'로 유지.

    Returns:
        True if cache was applied, False if not (caller should write unavailable fallback)
    """
    if not os.path.exists(summary_path):
        print("[공매도] 캐시 파일 없음")
        return False

    try:
        with open(summary_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"[공매도] 캐시 파일 읽기 실패: {e}")
        return False

    existing_source = existing.get("source", "sample")
    if existing_source in ("sample", "unavailable"):
        print(f"[공매도] 기존 파일 source='{existing_source}' — 캐시 불가")
        return False

    # 날짜 확인
    date_str = existing.get("date", existing.get("updated", ""))
    if not date_str:
        print("[공매도] 기존 파일에 날짜 없음 — 캐시 불가")
        return False

    try:
        from datetime import date as date_type
        data_date = date_type.fromisoformat(date_str[:10])
        age_days = (date_type.today() - data_date).days
    except (ValueError, TypeError):
        print(f"[공매도] 날짜 파싱 실패 ({date_str}) — 캐시 불가")
        return False

    if age_days > grace_days:
        print(f"[공매도] 기존 데이터 {age_days}일 경과 (한도 {grace_days}일) — 캐시 만료")
        return False

    # Grace period 이내: source를 'cached'로 업데이트
    existing["source"] = "cached"
    existing["cached_from"] = existing_source
    existing["cached_age_days"] = age_days

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"[공매도] 캐시 유지: 원본 source='{existing_source}', "
          f"{age_days}일 경과 (한도 {grace_days}일)")
    print(f"[공매도] source='cached'로 업데이트 — CHECK 6 PASS 가능")
    return True


if __name__ == "__main__":
    main()
