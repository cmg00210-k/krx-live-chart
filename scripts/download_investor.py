#!/usr/bin/env python3
"""
투자자별 매매동향 다운로더 (KRX 정보데이터시스템)

데이터 소스: data.krx.co.kr (KRX 정보데이터시스템)
인증 방식: OTP 2단계 — generate.cmd → download.cmd

수집 항목:
  1. 시장 전체 투자자별 거래실적 (외국인/기관/개인) — KOSPI + KOSDAQ
  2. 종목별 외국인 보유현황 (보유비중, 순매수)
  3. 파생 요약 (순매수 누적, 외국인-기관 방향 일치 신호)

출력:
  data/derivatives/investor_daily.json   ← 시장별 투자자 유형 일별 매매
  data/derivatives/foreign_flow.json     ← 종목별 외국인 보유/순매수
  data/derivatives/investor_summary.json ← 파생 요약 (누적, 정렬 신호)

학술 근거:
  core_data/20_krx_structural_anomalies.md §4 — 외국인 흐름 영향 회귀
    r_t = alpha + beta_f * FF_t + beta_d * DF_t + epsilon
    외국인 매도 시 기술적 패턴 정확도 40% 하락
  core_data/18_behavioral_market_microstructure.md §6 — 군집행동(herding) 역학

사용법:
    python scripts/download_investor.py
    python scripts/download_investor.py --start 2024-01-01 --end 2025-12-31
    python scripts/download_investor.py --verbose
    python scripts/download_investor.py --skip-foreign-flow  # 종목별 외국인 생략 (빠름)

의존성:
    pip install requests
"""

import argparse
import csv
import io
import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import time
from datetime import datetime, timedelta

# ── KRX OTP 공통 클라이언트 ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from krx_otp import KRXOTPClient, KRXOTPError, RATE_LIMIT_SEC
from api_constants import clean_csv_fieldnames as clean_fieldnames

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DERIV_DIR = os.path.join(DATA_DIR, "derivatives")

OUTPUT_INVESTOR_DAILY = os.path.join(DERIV_DIR, "investor_daily.json")
OUTPUT_FOREIGN_FLOW = os.path.join(DERIV_DIR, "foreign_flow.json")
OUTPUT_SUMMARY = os.path.join(DERIV_DIR, "investor_summary.json")

# KRX 시장 코드
MARKETS = {
    "KOSPI": "STK",
    "KOSDAQ": "KSQ",
}

# 투자자 유형 한글→영문 매핑
INVESTOR_TYPE_MAP = {
    "금융투자": "financial_investment",
    "보험": "insurance",
    "투신": "investment_trust",
    "사모": "private_equity",
    "은행": "bank",
    "기타금융": "other_financial",
    "연기금등": "pension_fund",
    "기관합계": "institutional_total",
    "기타법인": "other_corp",
    "개인": "retail",
    "외국인": "foreign",
    "기타외국인": "other_foreign",
    "전체": "total",
}

VERBOSE = False


def log(msg: str):
    """--verbose 플래그일 때만 출력"""
    if VERBOSE:
        print(msg)


# ─────────────────────────────────────────────────
# CSV 파싱 유틸
# ─────────────────────────────────────────────────

def parse_int(val: str) -> int:
    """쉼표 포함 숫자 문자열 → int, 파싱 실패 시 0"""
    try:
        return int(val.strip().replace(",", ""))
    except (ValueError, AttributeError):
        return 0


def parse_float(val: str) -> float:
    """쉼표 포함 숫자 문자열 → float, 파싱 실패 시 0.0"""
    try:
        return float(val.strip().replace(",", ""))
    except (ValueError, AttributeError):
        return 0.0


# ─────────────────────────────────────────────────
# 1. 시장 전체 투자자별 거래실적
# ─────────────────────────────────────────────────

def fetch_investor_daily(client: KRXOTPClient, mkt_id: str,
                         start_yyyymmdd: str, end_yyyymmdd: str) -> list:
    """
    투자자별 매매동향 (전체 시장) — MDCSTAT02301

    KRX 통계 > 주식 > 투자자별 거래실적 > 투자자별 거래실적(일별)
    URL: dbms/MDC/STAT/standard/MDCSTAT02301

    Parameters:
        client: KRXOTPClient 인스턴스 (재시도/백오프/레이트리밋 내장)
        mkt_id: "STK" (KOSPI) 또는 "KSQ" (KOSDAQ)
        start_yyyymmdd: 시작일 YYYYMMDD
        end_yyyymmdd: 종료일 YYYYMMDD

    Returns:
        list of dicts — 각 dict는 하루치 투자자별 매매 데이터
    """
    csv_text = client.fetch_csv(
        stat_url="dbms/MDC/STAT/standard/MDCSTAT02301",
        params={
            "mktId": mkt_id,
            "strtDd": start_yyyymmdd,
            "endDd": end_yyyymmdd,
        },
    )

    return _parse_investor_daily_csv(csv_text, mkt_id)


def _parse_investor_daily_csv(csv_text: str, mkt_id: str) -> list:
    """
    투자자별 거래실적 CSV 파싱.

    KRX CSV 구조 (MDCSTAT02301):
      일자 | 투자자명 | 매수(거래량) | 매도(거래량) | 순매수(거래량) |
                      매수(거래대금) | 매도(거래대금) | 순매수(거래대금)

    또는 피벗 형태 (투자자가 열 이름):
      일자 | 금융투자_매도 | 금융투자_매수 | 보험_매도 | 보험_매수 | ...

    Returns:
        날짜별, 투자자별 매매 집계 리스트
    """
    records = []
    reader = csv.DictReader(io.StringIO(csv_text))
    reader.fieldnames = clean_fieldnames(reader.fieldnames)

    cols = reader.fieldnames or []
    log(f"  [CSV] 컬럼: {cols[:10]}...")

    # 행 형태 판별: "투자자명" 컬럼 존재 여부
    has_investor_col = "투자자명" in cols

    if has_investor_col:
        # 행별 투자자 형식 (일자 + 투자자명 + 매수/매도 컬럼)
        for row in reader:
            raw_date = row.get("일자", "").strip()
            if not raw_date:
                continue
            date_str = raw_date.replace("/", "-").replace(".", "-")
            try:
                datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                continue

            inv_name = row.get("투자자명", "").strip()
            inv_key = INVESTOR_TYPE_MAP.get(inv_name, inv_name)

            # 거래량 (주)
            buy_vol = parse_int(row.get("매수거래량", row.get("매수, 거래량", "0")))
            sell_vol = parse_int(row.get("매도거래량", row.get("매도, 거래량", "0")))
            net_vol = parse_int(row.get("순매수거래량", row.get("순매수, 거래량", "0")))

            # 거래대금 (원)
            buy_amt = parse_int(row.get("매수거래대금", row.get("매수, 거래대금", "0")))
            sell_amt = parse_int(row.get("매도거래대금", row.get("매도, 거래대금", "0")))
            net_amt = parse_int(row.get("순매수거래대금", row.get("순매수, 거래대금", "0")))

            # net이 0이면 직접 계산 (일부 기간에 순매수 컬럼 누락)
            if net_vol == 0 and (buy_vol != 0 or sell_vol != 0):
                net_vol = buy_vol - sell_vol
            if net_amt == 0 and (buy_amt != 0 or sell_amt != 0):
                net_amt = buy_amt - sell_amt

            records.append({
                "time": date_str,
                "market": "KOSPI" if mkt_id == "STK" else "KOSDAQ",
                "investor": inv_key,
                "investor_kr": inv_name,
                "buy_volume": buy_vol,
                "sell_volume": sell_vol,
                "net_volume": net_vol,
                "buy_amount": buy_amt,
                "sell_amount": sell_amt,
                "net_amount": net_amt,
            })
    else:
        # 피벗 형태: 투자자가 컬럼 그룹으로 펼쳐진 형식
        # 일자 | 금융투자 매도 | 금융투자 매수 | ... 순매수
        for row in reader:
            raw_date = row.get("일자", "").strip()
            if not raw_date:
                # 일자 컬럼 없으면 첫 번째 컬럼 시도
                first_val = list(row.values())[0].strip() if row else ""
                try:
                    datetime.strptime(
                        first_val.replace("/", "-").replace(".", "-"),
                        "%Y-%m-%d",
                    )
                    raw_date = first_val
                except ValueError:
                    continue

            date_str = raw_date.replace("/", "-").replace(".", "-")
            try:
                datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                continue

            # 피벗 컬럼에서 투자자별 데이터 추출
            for col_name, val in row.items():
                if col_name in ("일자",):
                    continue
                # 컬럼명 예: "금융투자 매도거래량", "외국인 순매수거래대금"
                for inv_kr, inv_en in INVESTOR_TYPE_MAP.items():
                    if inv_kr in col_name:
                        # 이미 해당 투자자 + 날짜 레코드가 있는지 확인
                        existing = None
                        for r in records:
                            if r["time"] == date_str and r["investor"] == inv_en:
                                existing = r
                                break
                        if existing is None:
                            existing = {
                                "time": date_str,
                                "market": "KOSPI" if mkt_id == "STK" else "KOSDAQ",
                                "investor": inv_en,
                                "investor_kr": inv_kr,
                                "buy_volume": 0, "sell_volume": 0, "net_volume": 0,
                                "buy_amount": 0, "sell_amount": 0, "net_amount": 0,
                            }
                            records.append(existing)

                        v = parse_int(val)
                        cn = col_name.lower()
                        if "매도" in cn and "거래량" in cn:
                            existing["sell_volume"] = v
                        elif "매수" in cn and "순" not in cn and "거래량" in cn:
                            existing["buy_volume"] = v
                        elif "순매수" in cn and "거래량" in cn:
                            existing["net_volume"] = v
                        elif "매도" in cn and "거래대금" in cn:
                            existing["sell_amount"] = v
                        elif "매수" in cn and "순" not in cn and "거래대금" in cn:
                            existing["buy_amount"] = v
                        elif "순매수" in cn and "거래대금" in cn:
                            existing["net_amount"] = v
                        break

    # 날짜 오름차순 정렬
    records.sort(key=lambda r: (r["time"], r.get("investor", "")))
    return records


# ─────────────────────────────────────────────────
# 2. 종목별 외국인 보유현황
# ─────────────────────────────────────────────────

def fetch_foreign_flow(client: KRXOTPClient, mkt_id: str,
                       trade_date_yyyymmdd: str) -> list:
    """
    외국인 보유량 (종목별) — MDCSTAT03602

    KRX 통계 > 주식 > 외국인보유량(개별종목)
    URL: dbms/MDC/STAT/standard/MDCSTAT03602

    Parameters:
        client: KRXOTPClient 인스턴스 (재시도/백오프/레이트리밋 내장)
        mkt_id: "STK" 또는 "KSQ"
        trade_date_yyyymmdd: 조회 기준일 YYYYMMDD

    Returns:
        list of dicts — 종목별 외국인 보유현황
    """
    csv_text = client.fetch_csv(
        stat_url="dbms/MDC/STAT/standard/MDCSTAT03602",
        params={
            "mktId": mkt_id,
            "trdDd": trade_date_yyyymmdd,
        },
    )

    return _parse_foreign_flow_csv(csv_text, mkt_id)


def _parse_foreign_flow_csv(csv_text: str, mkt_id: str) -> list:
    """
    외국인 보유량 CSV 파싱.

    KRX CSV 구조 (MDCSTAT03602):
      종목코드 | 종목명 | 상장주식수 | 외국인보유수량 | 외국인지분율(%) |
      외국인한도수량 | 외국인한도소진율(%) | ...

    Returns:
        종목별 외국인 보유현황 리스트
    """
    records = []
    reader = csv.DictReader(io.StringIO(csv_text))
    reader.fieldnames = clean_fieldnames(reader.fieldnames)

    cols = reader.fieldnames or []
    log(f"  [CSV] 외국인 보유량 컬럼: {cols[:8]}...")

    for row in reader:
        # 종목코드 추출 (다양한 컬럼명 대응)
        code = (
            row.get("종목코드", "")
            or row.get("ISU_SRT_CD", "")
            or row.get("표준코드", "")
        ).strip()

        name = (
            row.get("종목명", "")
            or row.get("ISU_ABBRV", "")
        ).strip()

        if not code or not name:
            continue

        # 숫자 컬럼 파싱
        listed_shares = parse_int(
            row.get("상장주식수", row.get("LIST_SHRS", "0"))
        )
        foreign_shares = parse_int(
            row.get("외국인보유수량", row.get("FORN_HD_QTY", "0"))
        )
        foreign_ratio = parse_float(
            row.get("외국인지분율(%)", row.get("외국인보유비중", row.get("FORN_SHR_RT", "0")))
        )
        foreign_limit = parse_int(
            row.get("외국인한도수량", row.get("FORN_LMT_QTY", "0"))
        )
        foreign_exhaust = parse_float(
            row.get("외국인한도소진율(%)", row.get("FORN_LMT_EXHST_RT", "0"))
        )

        # 순매수 (컬럼이 있는 경우)
        net_buy = parse_int(
            row.get("순매수", row.get("FORN_NET_BUY_QTY", "0"))
        )

        records.append({
            "code": code,
            "name": name,
            "market": "KOSPI" if mkt_id == "STK" else "KOSDAQ",
            "listed_shares": listed_shares,
            "foreign_shares": foreign_shares,
            "foreign_ratio": foreign_ratio,
            "foreign_limit": foreign_limit,
            "foreign_exhaust_ratio": foreign_exhaust,
            "net_buy": net_buy,
        })

    return records


# ─────────────────────────────────────────────────
# 3. 파생 요약 계산
# ─────────────────────────────────────────────────

def compute_summary(investor_daily: list) -> dict:
    """
    투자자별 일별 데이터로부터 파생 요약 계산.

    계산 항목:
      - 외국인 순매수 금액 (최근 1일, 5일 누적, 20일 누적)
      - 기관 순매수 금액 (최근 1일, 5일 누적, 20일 누적)
      - 개인 순매수 금액 (최근 1일, 5일 누적, 20일 누적)
      - 외국인-기관 방향 일치 신호 (same direction = strong)

    학술 근거: core_data/20_krx_structural_anomalies.md §4.2
      r_t = alpha + beta_f * FF_t + beta_d * DF_t + epsilon
      외국인 + 기관 동방향 매수 시 신호 강화

    Parameters:
        investor_daily: fetch_investor_daily() 결과 (양 시장 합산)

    Returns:
        요약 dict
    """
    if not investor_daily:
        return {"error": "데이터 없음"}

    # 날짜별 → 투자자별 순매수 금액 집계 (KOSPI + KOSDAQ 합산)
    daily_net = {}  # {date: {investor_key: net_amount}}
    for rec in investor_daily:
        d = rec["time"]
        inv = rec["investor"]
        if d not in daily_net:
            daily_net[d] = {}
        daily_net[d][inv] = daily_net[d].get(inv, 0) + rec["net_amount"]

    # 날짜 정렬
    sorted_dates = sorted(daily_net.keys())
    if not sorted_dates:
        return {"error": "유효 데이터 없음"}

    def _cumulative_net(investor_key: str, n_days: int) -> int:
        """최근 n일 순매수 금액 합산 (원)"""
        target_dates = sorted_dates[-n_days:]
        total = 0
        for d in target_dates:
            total += daily_net.get(d, {}).get(investor_key, 0)
        return total

    def _to_eok(amount_won: int) -> float:
        """원 → 억원 변환"""
        return round(amount_won / 1e8, 1)

    latest_date = sorted_dates[-1]
    total_days = len(sorted_dates)

    # 3대 투자자 순매수 (원)
    foreign_1d = _cumulative_net("foreign", 1)
    foreign_5d = _cumulative_net("foreign", min(5, total_days))
    foreign_20d = _cumulative_net("foreign", min(20, total_days))

    inst_1d = _cumulative_net("institutional_total", 1)
    inst_5d = _cumulative_net("institutional_total", min(5, total_days))
    inst_20d = _cumulative_net("institutional_total", min(20, total_days))

    retail_1d = _cumulative_net("retail", 1)
    retail_5d = _cumulative_net("retail", min(5, total_days))
    retail_20d = _cumulative_net("retail", min(20, total_days))

    # 외국인-기관 방향 일치 신호
    # 1일: 둘 다 순매수 or 둘 다 순매도 → aligned
    # 5일/20일 누적도 계산
    def _alignment_signal(f_net: int, i_net: int) -> str:
        """외국인-기관 방향 일치 판정"""
        if f_net > 0 and i_net > 0:
            return "aligned_buy"    # 동반 매수 — 강한 매수 신호
        elif f_net < 0 and i_net < 0:
            return "aligned_sell"   # 동반 매도 — 강한 매도 신호
        elif f_net == 0 or i_net == 0:
            return "neutral"
        else:
            return "divergent"      # 방향 불일치 — 약한 신호

    alignment_1d = _alignment_signal(foreign_1d, inst_1d)
    alignment_5d = _alignment_signal(foreign_5d, inst_5d)
    alignment_20d = _alignment_signal(foreign_20d, inst_20d)

    # 연기금 별도 추적 (KOSPI 대형주 영향력)
    pension_1d = _cumulative_net("pension_fund", 1)
    pension_5d = _cumulative_net("pension_fund", min(5, total_days))

    summary = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "latest_date": latest_date,
        "date": latest_date,  # flat compat key for JS [C-2 FIX]
        "total_trading_days": total_days,
        "source": "live",  # Pipeline CHECK 6 guard — must not be "sample"
        "foreign": {
            "net_1d_eok": _to_eok(foreign_1d),
            "net_5d_eok": _to_eok(foreign_5d),
            "net_20d_eok": _to_eok(foreign_20d),
        },
        "institutional": {
            "net_1d_eok": _to_eok(inst_1d),
            "net_5d_eok": _to_eok(inst_5d),
            "net_20d_eok": _to_eok(inst_20d),
        },
        "retail": {
            "net_1d_eok": _to_eok(retail_1d),
            "net_5d_eok": _to_eok(retail_5d),
            "net_20d_eok": _to_eok(retail_20d),
        },
        "pension_fund": {
            "net_1d_eok": _to_eok(pension_1d),
            "net_5d_eok": _to_eok(pension_5d),
        },
        "alignment": {
            "signal_1d": alignment_1d,
            "signal_5d": alignment_5d,
            "signal_20d": alignment_20d,
            "description": {
                "aligned_buy": "외국인+기관 동반 순매수 (강한 매수 신호)",
                "aligned_sell": "외국인+기관 동반 순매도 (강한 매도 신호)",
                "divergent": "외국인-기관 방향 불일치 (약한 신호)",
                "neutral": "중립 (순매수/순매도 없음)",
            },
        },
        # Flat compat keys for JS backward compatibility [C-2/C-3 FIX]
        "foreign_net_1d": _to_eok(foreign_1d),
        "foreign_net_5d": _to_eok(foreign_5d),
        "foreign_net_20d": _to_eok(foreign_20d),
        "institutional_net_1d": _to_eok(inst_1d),
        "institutional_net_5d": _to_eok(inst_5d),
        "institutional_net_20d": _to_eok(inst_20d),
        "retail_net_1d": _to_eok(retail_1d),
        "retail_net_5d": _to_eok(retail_5d),
        "retail_net_20d": _to_eok(retail_20d),
    }

    return summary


# ─────────────────────────────────────────────────
# pykrx Fallback
# ─────────────────────────────────────────────────

def _pykrx_fallback_investor(start_str: str, end_str: str) -> list:
    """
    pykrx를 사용한 투자자별 매매동향 수집 (OTP 실패 시 fallback).
    pykrx 미설치 또는 API 차단 시 빈 리스트 반환.
    """
    try:
        from pykrx import stock as pykrx_stock
    except ImportError:
        print("[INVESTOR] pykrx 미설치 — pip install pykrx")
        return []

    print(f"[INVESTOR] pykrx fallback: {start_str} ~ {end_str}")
    start_fmt = start_str.replace("-", "")
    end_fmt = end_str.replace("-", "")
    records = []

    # pykrx 1.2.4: get_market_trading_value_by_investor(fromdate, todate, ticker)
    # Market-level data uses ticker="KOSPI" or "KOSDAQ" (not a keyword argument)
    for market_name, market_code in [("KOSPI", "KOSPI"), ("KOSDAQ", "KOSDAQ")]:
        try:
            df = pykrx_stock.get_market_trading_value_by_investor(
                start_fmt, end_fmt, market_code
            )
            if df is None or df.empty:
                print(f"  [pykrx] {market_name}: 데이터 없음 (KRX OTP 차단 시 정상)")
                continue

            # pykrx 1.2.4 columns: 금융투자, 보험, 투신, 사모, 은행, 기타금융, 연기금등,
            #   기관합계, 기타법인, 개인, 외국인합계, 전체
            inv_map = {
                "기관합계": "institutional_total",
                "개인": "retail",
                "외국인합계": "foreign",
            }
            for date_idx, row in df.iterrows():
                date_str = date_idx.strftime("%Y-%m-%d")
                for ko_col, eng_key in inv_map.items():
                    if ko_col in row.index:
                        net_amount = int(row[ko_col])
                        records.append({
                            "time": date_str,
                            "market": market_code,
                            "investor": eng_key,
                            "net_amount": net_amount,
                        })

            print(f"  [pykrx] {market_name}: {len(df)}일 수집")
            time.sleep(1)
        except Exception as e:
            print(f"  [pykrx] {market_name} 실패: {e}")

    return records


# ─────────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────────

def main():
    global VERBOSE

    parser = argparse.ArgumentParser(
        description="투자자별 매매동향 다운로더 (KRX)"
    )
    parser.add_argument(
        "--start",
        default=(datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d"),
        help="시작일 (YYYY-MM-DD, 기본: 60일 전)",
    )
    parser.add_argument(
        "--end",
        default=datetime.now().strftime("%Y-%m-%d"),
        help="종료일 (YYYY-MM-DD, 기본: 오늘)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="상세 로그 출력",
    )
    parser.add_argument(
        "--skip-foreign-flow",
        action="store_true",
        help="종목별 외국인 보유현황 생략 (속도 우선)",
    )
    args = parser.parse_args()
    VERBOSE = args.verbose

    # 날짜 형식 검증 및 YYYYMMDD 변환
    try:
        start_dt = datetime.strptime(args.start, "%Y-%m-%d")
        end_dt = datetime.strptime(args.end, "%Y-%m-%d")
    except ValueError as e:
        print(f"[INVESTOR] 날짜 형식 오류: {e} (YYYY-MM-DD 사용)")
        raise SystemExit(1)

    if start_dt > end_dt:
        print(
            f"[INVESTOR] 오류: 시작일({args.start})이 "
            f"종료일({args.end})보다 늦습니다."
        )
        raise SystemExit(1)

    start_krx = start_dt.strftime("%Y%m%d")
    end_krx = end_dt.strftime("%Y%m%d")

    # 출력 디렉터리 생성
    os.makedirs(DERIV_DIR, exist_ok=True)

    print(f"[INVESTOR] 다운로드 기간: {args.start} ~ {args.end}")
    print(f"[INVESTOR] 출력 디렉터리: {DERIV_DIR}")

    # ── KRXOTPClient 초기화 ──
    client = KRXOTPClient(verbose=args.verbose)

    # ── 1. 시장 전체 투자자별 거래실적 ──
    all_investor_daily = []

    for market_name, mkt_id in MARKETS.items():
        print(f"\n[INVESTOR] {market_name} 투자자별 거래실적 수집 중...")

        try:
            records = fetch_investor_daily(client, mkt_id, start_krx, end_krx)
            if records:
                all_investor_daily.extend(records)
                # 날짜 수 계산
                dates = set(r["time"] for r in records)
                print(
                    f"[INVESTOR] {market_name}: {len(records)}건 "
                    f"({len(dates)}일, 투자자 {len(records) // max(len(dates), 1)}유형/일)"
                )
            else:
                print(
                    f"[INVESTOR] {market_name}: 데이터 없음 "
                    f"(공휴일 또는 날짜 범위 확인)"
                )
        except KRXOTPError as e:
            print(f"[INVESTOR] {market_name}: OTP 실패 — {e}")

    # Fallback chain: OTP → Naver HTML → pykrx
    _data_source = "live"  # Track which source succeeded

    if not all_investor_daily:
        # Fallback 2: Naver Finance HTML 스크래핑
        print("\n[INVESTOR] OTP 수집 실패 — Naver Finance fallback 시도...")
        try:
            from naver_investor import fetch_naver_investor
            all_investor_daily = fetch_naver_investor(
                pages=3, verbose=args.verbose
            )
            if all_investor_daily:
                _data_source = "naver"
                dates = set(r["time"] for r in all_investor_daily)
                print(f"[INVESTOR] Naver fallback 성공: {len(all_investor_daily)}건 ({len(dates)}일)")
        except Exception as e:
            print(f"[INVESTOR] Naver fallback 실패: {e}")

    if not all_investor_daily:
        # Fallback 3: pykrx
        print("\n[INVESTOR] Naver 실패 — pykrx fallback 시도...")
        all_investor_daily = _pykrx_fallback_investor(args.start, args.end)
        if all_investor_daily:
            _data_source = "pykrx"

    # investor_daily.json 저장
    if all_investor_daily:
        all_investor_daily.sort(
            key=lambda r: (r["time"], r["market"], r.get("investor", ""))
        )
        with open(OUTPUT_INVESTOR_DAILY, "w", encoding="utf-8") as f:
            json.dump(all_investor_daily, f, ensure_ascii=False, indent=1)
        size_kb = os.path.getsize(OUTPUT_INVESTOR_DAILY) / 1024
        print(f"\n[INVESTOR] 저장: {OUTPUT_INVESTOR_DAILY} ({size_kb:.1f}KB)")
    else:
        print("\n[INVESTOR] 경고: 투자자별 거래실적 데이터 수집 실패")

    # ── 2. 종목별 외국인 보유현황 ──
    if not args.skip_foreign_flow:
        all_foreign_flow = []

        # 최근 거래일 기준으로 조회 (주말/공휴일 대비 최근 5일 시도)
        trade_date = end_dt
        for attempt in range(5):
            trade_date_str = trade_date.strftime("%Y%m%d")
            print(
                f"\n[INVESTOR] 외국인 보유현황 수집 중 "
                f"(기준일: {trade_date.strftime('%Y-%m-%d')})..."
            )

            found_data = False
            for market_name, mkt_id in MARKETS.items():
                try:
                    records = fetch_foreign_flow(client, mkt_id, trade_date_str)
                    if records:
                        all_foreign_flow.extend(records)
                        print(
                            f"[INVESTOR] {market_name} 외국인 보유: "
                            f"{len(records)}종목"
                        )
                        found_data = True
                    else:
                        log(
                            f"  [{market_name}] 외국인 데이터 없음 "
                            f"(비거래일 가능)"
                        )
                except KRXOTPError as e:
                    print(f"[INVESTOR] {market_name} 외국인: {e}")
                except ValueError as e:
                    print(f"[INVESTOR] {market_name} 외국인: {e}")

                time.sleep(RATE_LIMIT_SEC)

            if found_data:
                break
            else:
                # 비거래일 → 이전 날짜 재시도
                trade_date -= timedelta(days=1)
                print(f"[INVESTOR] 비거래일 — {trade_date.strftime('%Y-%m-%d')} 재시도")

        # foreign_flow.json 저장
        if all_foreign_flow:
            # 외국인 보유비중 내림차순 정렬
            all_foreign_flow.sort(
                key=lambda r: r.get("foreign_ratio", 0), reverse=True
            )
            output = {
                "trade_date": trade_date.strftime("%Y-%m-%d"),
                "total_stocks": len(all_foreign_flow),
                "stocks": all_foreign_flow,
            }
            with open(OUTPUT_FOREIGN_FLOW, "w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False, indent=1)
            size_kb = os.path.getsize(OUTPUT_FOREIGN_FLOW) / 1024
            print(f"\n[INVESTOR] 저장: {OUTPUT_FOREIGN_FLOW} ({size_kb:.1f}KB)")

            # 상위 10 외국인 보유비중
            print("\n[INVESTOR] 외국인 보유비중 TOP 10:")
            for i, rec in enumerate(all_foreign_flow[:10], 1):
                print(
                    f"  {i:2d}. {rec['code']} {rec['name']:12s} "
                    f"{rec['foreign_ratio']:6.2f}% "
                    f"({rec['market']})"
                )
        else:
            print("\n[INVESTOR] 경고: 외국인 보유현황 수집 실패")
    else:
        print("\n[INVESTOR] 종목별 외국인 보유현황 생략 (--skip-foreign-flow)")

    # ── 3. 파생 요약 계산 ──
    if all_investor_daily:
        print("\n[INVESTOR] 파생 요약 계산 중...")
        summary = compute_summary(all_investor_daily)
        summary["source"] = _data_source  # live / naver / pykrx

        with open(OUTPUT_SUMMARY, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        size_kb = os.path.getsize(OUTPUT_SUMMARY) / 1024
        print(f"[INVESTOR] 저장: {OUTPUT_SUMMARY} ({size_kb:.1f}KB)")

        # 요약 출력
        print(f"\n[INVESTOR] === 투자자 요약 ({summary['latest_date']}) ===")
        print(f"  수집 거래일 수: {summary['total_trading_days']}일")
        print(f"  외국인 순매수: "
              f"1일 {summary['foreign']['net_1d_eok']:+,.1f}억, "
              f"5일 {summary['foreign']['net_5d_eok']:+,.1f}억, "
              f"20일 {summary['foreign']['net_20d_eok']:+,.1f}억")
        print(f"  기관 순매수:   "
              f"1일 {summary['institutional']['net_1d_eok']:+,.1f}억, "
              f"5일 {summary['institutional']['net_5d_eok']:+,.1f}억, "
              f"20일 {summary['institutional']['net_20d_eok']:+,.1f}억")
        print(f"  개인 순매수:   "
              f"1일 {summary['retail']['net_1d_eok']:+,.1f}억, "
              f"5일 {summary['retail']['net_5d_eok']:+,.1f}억, "
              f"20일 {summary['retail']['net_20d_eok']:+,.1f}억")
        print(f"  외국인-기관 방향: "
              f"1일={summary['alignment']['signal_1d']}, "
              f"5일={summary['alignment']['signal_5d']}, "
              f"20일={summary['alignment']['signal_20d']}")
    else:
        print("\n[INVESTOR] 경고: 요약 계산 생략 (투자자 데이터 없음)")

    print("\n[INVESTOR] 완료!")


if __name__ == "__main__":
    main()
