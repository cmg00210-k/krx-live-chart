#!/usr/bin/env python3
"""
KRX 파생상품 (선물 + 옵션) 일별 데이터 다운로더

데이터 소스 (우선순위):
  1. KRX Open API (data-dbg.krx.co.kr) — drv/fut_bydd_trd, drv/opt_bydd_trd
  2. OTP 폴백 (data.krx.co.kr) — MDCSTAT12501, MDCSTAT12601

다운로드 항목:
  1. KOSPI200 선물 — 일별 OHLCV + 정산가 + 미결제약정 + 거래량
     출력: data/derivatives/futures_daily.json
  2. KOSPI200 옵션 — 행사가별 일별 정산가 + IV + 미결제약정 + 거래량 (콜/풋 분리)
     출력: data/derivatives/options_daily.json
  3. 파생 요약 지표 — 선물 베이시스, P/C Ratio, 총 미결제약정
     출력: data/derivatives/derivatives_summary.json

학술 근거:
  - core_data/27_futures_basis_program_trading.md §1.2
    Basis = F_market - S_spot, 초과 베이시스 = 실제 베이시스 - 이론 베이시스
  - core_data/26_options_volatility_signals.md §1
    BSM 모형, IV, Put/Call Ratio 시장 심리 지표

사용법:
    python scripts/download_derivatives.py
    python scripts/download_derivatives.py --start 2024-01-01 --end 2024-12-31
    python scripts/download_derivatives.py --verbose
    python scripts/download_derivatives.py --futures-only
    python scripts/download_derivatives.py --options-only
    python scripts/download_derivatives.py --otp-only
"""

import argparse
import json
import os
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict
from datetime import datetime, timedelta

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DERIV_DIR = os.path.join(DATA_DIR, "derivatives")

# ── KRX Open API 클라이언트 / 공통 상수 (없으면 OTP 폴백) ──
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

try:
    from krx_api import KRXClient
except ImportError:
    KRXClient = None

try:
    from krx_otp import KRXOTPClient, KRXOTPError
    _HAS_KRX_OTP = True
except ImportError:
    _HAS_KRX_OTP = False

from api_constants import (
    KRX_OTP_URL as _OTP_URL,
    KRX_CSV_URL as _CSV_URL,
    generate_business_days as _gen_biz_days,
    parse_number as _parse_number_base,
    clean_csv_fieldnames as _clean_fieldnames,
    DEFAULT_USER_AGENT,
    TIMEOUT_QUICK,
    TIMEOUT_NORMAL,
    TIMEOUT_HEAVY,
    TIMEOUT_EXTREME,
)

# ── verbose 전역 (main에서 설정) ──
_verbose = False


def _log(msg: str):
    print(msg)


def _vlog(msg: str):
    if _verbose:
        print(msg)


def _parse_number(val):
    """KRX API 문자열 → 숫자. 쉼표 제거, 빈문자열/'-'/'–' → None.
    api_constants.parse_number 위임 + KRX 특수 em-dash('–') 사전 처리.
    """
    if isinstance(val, str) and val.strip() == "–":
        return None
    return _parse_number_base(val)


def _format_date(yyyymmdd: str) -> str:
    """YYYYMMDD → YYYY-MM-DD"""
    s = str(yyyymmdd).strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return s


def _generate_business_days(start_dt, end_dt):
    """영업일(월~금) YYYYMMDD 생성기."""
    for d in _gen_biz_days(start_dt, end_dt):
        yield d.strftime("%Y%m%d")


# ════════════════════════════════════════════════════════
# Open API 기반 선물/옵션 수집
# ════════════════════════════════════════════════════════

def fetch_futures_openapi(client, start_dt, end_dt):
    """
    Open API drv/fut_bydd_trd로 선물 데이터 수집.

    필드 매핑:
      BAS_DD → time, ISU_NM → contractName, PROD_NM → (KOSPI200 필터)
      TDD_OPNPRC → open, TDD_HGPRC → high, TDD_LWPRC → low, TDD_CLSPRC → close
      CMPPREVDD_PRC → change, ACC_TRDVOL → volume, ACC_TRDVAL → tradingValue
      ACC_OPNINT_QTY → openInterest, SETL_PRC → settlementPrice, SPOT_PRC → spot
    """
    records = []
    days = list(_generate_business_days(start_dt, end_dt))
    _log(f"[파생] 선물 Open API: {len(days)} 영업일 조회")

    consecutive_empty = 0
    for i, dd in enumerate(days):
        date_str = _format_date(dd)
        _vlog(f"  [선물] {date_str} ({i+1}/{len(days)})")

        raw = client.get("drv/fut_bydd_trd", basDd=dd)
        if not raw:
            consecutive_empty += 1
            _vlog(f"    → 데이터 없음")
            if consecutive_empty >= 10:
                _log("[파생] 선물: 연속 10일 빈 응답 → 중단")
                break
            continue
        consecutive_empty = 0

        # KOSPI200 선물 필터 (PROD_NM에 "코스피" 또는 "KOSPI")
        for r in raw:
            prod = r.get("PROD_NM", "")
            if "코스피" not in prod and "KOSPI" not in prod.upper():
                continue

            close_v = _parse_number(r.get("TDD_CLSPRC"))
            if close_v is None:
                close_v = _parse_number(r.get("SETL_PRC"))
            if close_v is None:
                continue

            record = {
                "time": date_str,
                "contractName": r.get("ISU_NM", "").strip(),
                "close": close_v,
            }

            field_map = {
                "TDD_OPNPRC": "open",
                "TDD_HGPRC": "high",
                "TDD_LWPRC": "low",
                "CMPPREVDD_PRC": "change",
                "ACC_TRDVOL": "volume",
                "ACC_TRDVAL": "tradingValue",
                "ACC_OPNINT_QTY": "openInterest",
                "SETL_PRC": "settlementPrice",
            }
            for api_key, out_key in field_map.items():
                val = _parse_number(r.get(api_key))
                if val is not None and out_key not in record:
                    record[out_key] = val

            # SPOT_PRC 저장 (basis 계산용, 출력 JSON에는 포함 안 함)
            spot = _parse_number(r.get("SPOT_PRC"))
            if spot is not None:
                record["_spot"] = spot

            records.append(record)

        if (i + 1) % 50 == 0:
            _log(f"  [선물] {i+1}/{len(days)} 완료, {len(records)}건 수집")

    return records


def fetch_options_openapi(client, start_dt, end_dt):
    """
    Open API drv/opt_bydd_trd로 옵션 데이터 수집.

    필드 매핑:
      RGHT_TP_NM → optionType (콜/풋)
      IMP_VOLT → iv
      ISU_NM → contractName (행사가 추출)
    """
    records = []
    days = list(_generate_business_days(start_dt, end_dt))
    _log(f"[파생] 옵션 Open API: {len(days)} 영업일 조회")

    consecutive_empty = 0
    for i, dd in enumerate(days):
        date_str = _format_date(dd)
        _vlog(f"  [옵션] {date_str} ({i+1}/{len(days)})")

        raw = client.get("drv/opt_bydd_trd", read_timeout=TIMEOUT_EXTREME, basDd=dd)
        if not raw:
            consecutive_empty += 1
            _vlog(f"    → 데이터 없음")
            if consecutive_empty >= 10:
                _log("[파생] 옵션: 연속 10일 빈 응답 → 중단")
                break
            continue
        consecutive_empty = 0

        day_calls = 0
        day_puts = 0

        # KOSPI200 옵션 필터
        for r in raw:
            prod = r.get("PROD_NM", "")
            if "코스피" not in prod and "KOSPI" not in prod.upper():
                continue

            close_v = _parse_number(r.get("TDD_CLSPRC"))
            if close_v is None:
                close_v = _parse_number(r.get("NXTDD_BAS_PRC"))
            if close_v is None:
                continue

            # 콜/풋 판별
            rght = r.get("RGHT_TP_NM", "")
            if "콜" in rght or "call" in rght.lower() or "C" == rght.strip():
                option_type = "call"
                day_calls += 1
            elif "풋" in rght or "put" in rght.lower() or "P" == rght.strip():
                option_type = "put"
                day_puts += 1
            else:
                option_type = _detect_option_type_from_name(r.get("ISU_NM", ""))
                if option_type == "call":
                    day_calls += 1
                elif option_type == "put":
                    day_puts += 1

            contract_name = r.get("ISU_NM", "").strip()
            record = {
                "time": date_str,
                "contractName": contract_name,
                "optionType": option_type,
                "close": close_v,
            }

            # 행사가 추출
            strike = _extract_strike_price_from_name(contract_name)
            if strike is not None:
                record["strikePrice"] = strike

            field_map = {
                "TDD_OPNPRC": "open",
                "TDD_HGPRC": "high",
                "TDD_LWPRC": "low",
                "CMPPREVDD_PRC": "change",
                "ACC_TRDVOL": "volume",
                "ACC_TRDVAL": "tradingValue",
                "ACC_OPNINT_QTY": "openInterest",
                "NXTDD_BAS_PRC": "settlementPrice",
                "IMP_VOLT": "iv",
            }
            for api_key, out_key in field_map.items():
                val = _parse_number(r.get(api_key))
                if val is not None and out_key not in record:
                    record[out_key] = val

            records.append(record)

        _vlog(f"    → 콜 {day_calls} / 풋 {day_puts}")
        if (i + 1) % 50 == 0:
            _log(f"  [옵션] {i+1}/{len(days)} 완료, {len(records)}건 수집")

    return records


def _detect_option_type_from_name(name: str) -> str:
    """종목명에서 콜/풋 판별."""
    if "콜" in name:
        return "call"
    if "풋" in name:
        return "put"
    tokens = name.upper().split()
    if "C" in tokens:
        return "call"
    if "P" in tokens:
        return "put"
    code = name.strip()
    if len(code) >= 3:
        if code[0] == "2":
            return "call"
        if code[0] == "3":
            return "put"
    return "unknown"


def _extract_strike_price_from_name(contract_name: str):
    """종목명 끝에서 행사가 숫자 추출."""
    match = re.search(r"(\d+\.?\d*)$", contract_name.strip())
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


# ════════════════════════════════════════════════════════
# OTP 폴백 (krx_api 불가 시)
# ════════════════════════════════════════════════════════

def _fetch_futures_otp(start_dt, end_dt):
    """OTP 방식 선물 수집 (레거시 폴백).

    M-18: KRXOTPClient (krx_otp.py) 우선 사용.
    M-16: requests는 모듈 상단에서 import (함수 내 import 제거).
    M-17: User-Agent는 DEFAULT_USER_AGENT 사용.
    M-9:  BOM 정리는 _clean_fieldnames() 사용.
    """
    import csv
    import io
    import time

    try:
        import requests
    except ImportError:
        _log("[파생] requests 미설치, OTP 폴백 불가")
        return []

    # M-18: KRXOTPClient 사용 가능하면 위임
    if _HAS_KRX_OTP:
        otp_client = KRXOTPClient(verbose=_verbose)

    OTP_URL = _OTP_URL
    CSV_URL = _CSV_URL
    # M-17: api_constants.DEFAULT_USER_AGENT 사용
    HEADERS = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Referer": "http://data.krx.co.kr",
    }

    records = []
    current = start_dt
    while current <= end_dt:
        if current.weekday() >= 5:
            current += timedelta(days=1)
            continue

        trd_dd = current.strftime("%Y%m%d")
        date_str = current.strftime("%Y-%m-%d")

        try:
            # M-18: KRXOTPClient 경유 (재시도·LOGOUT 감지 포함)
            if _HAS_KRX_OTP:
                csv_text = otp_client.fetch_csv(
                    "dbms/MDC/STAT/standard/MDCSTAT12501",
                    {"prodId": "KRDRVFUK2I", "trdDd": trd_dd},
                    csv_timeout=TIMEOUT_NORMAL,
                )
            else:
                # 원본 수동 OTP 경로 (krx_otp 미설치 환경 폴백)
                params = {
                    "locale": "ko_KR", "prodId": "KRDRVFUK2I",
                    "trdDd": trd_dd, "share": "2", "csvxls_isNo": "false",
                    "name": "fileDown", "url": "dbms/MDC/STAT/standard/MDCSTAT12501",
                }
                resp = requests.post(OTP_URL, data=params, headers=HEADERS, timeout=TIMEOUT_QUICK)
                if resp.status_code != 200:
                    _vlog(f"  [선물 OTP] {date_str} HTTP {resp.status_code}")
                    current += timedelta(days=1)
                    continue
                otp = resp.text.strip()
                time.sleep(0.5)
                resp2 = requests.post(CSV_URL, data={"code": otp}, headers=HEADERS, timeout=TIMEOUT_NORMAL)
                if resp2.status_code != 200:
                    _vlog(f"  [선물 CSV] {date_str} HTTP {resp2.status_code}")
                    current += timedelta(days=1)
                    continue
                raw = resp2.content
                for enc in ("euc-kr", "cp949", "utf-8-sig", "utf-8"):
                    try:
                        csv_text = raw.decode(enc)
                        break
                    except (UnicodeDecodeError, LookupError):
                        continue
                else:
                    current += timedelta(days=1)
                    continue
                time.sleep(0.5)

            reader = csv.DictReader(io.StringIO(csv_text))
            # M-9: BOM 정리는 _clean_fieldnames() 위임
            reader.fieldnames = _clean_fieldnames(reader.fieldnames)
            for row in reader:
                contract = (row.get("종목명", "") or row.get("종목코드", "")).strip()
                close_v = _parse_number(row.get("종가")) or _parse_number(row.get("정산가"))
                if not contract or close_v is None:
                    continue
                record = {"time": date_str, "contractName": contract, "close": close_v}
                for kr, en in [("시가","open"),("고가","high"),("저가","low"),("전일대비","change"),
                               ("거래량","volume"),("거래대금","tradingValue"),
                               ("미결제약정(수량)","openInterest"),("미결제약정수량","openInterest"),
                               ("정산가","settlementPrice")]:
                    val = _parse_number(row.get(kr, ""))
                    if val is not None and en not in record:
                        record[en] = val
                records.append(record)
        except Exception as e:
            _vlog(f"  [선물 OTP] {date_str} 실패: {e}")

        current += timedelta(days=1)

    return records


def _fetch_options_otp(start_dt, end_dt):
    """OTP 방식 옵션 수집 (레거시 폴백).

    M-18: KRXOTPClient (krx_otp.py) 우선 사용.
    M-16: requests는 모듈 상단에서 import (함수 내 import 제거).
    M-17: User-Agent는 DEFAULT_USER_AGENT 사용.
    M-9:  BOM 정리는 _clean_fieldnames() 사용.
    """
    import csv
    import io
    import time

    try:
        import requests
    except ImportError:
        return []

    # M-18: KRXOTPClient 사용 가능하면 위임
    if _HAS_KRX_OTP:
        otp_client = KRXOTPClient(verbose=_verbose)

    OTP_URL = _OTP_URL
    CSV_URL = _CSV_URL
    # M-17: api_constants.DEFAULT_USER_AGENT 사용
    HEADERS = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Referer": "http://data.krx.co.kr",
    }

    records = []
    current = start_dt
    while current <= end_dt:
        if current.weekday() >= 5:
            current += timedelta(days=1)
            continue

        trd_dd = current.strftime("%Y%m%d")
        date_str = current.strftime("%Y-%m-%d")

        try:
            # M-18: KRXOTPClient 경유 (재시도·LOGOUT 감지 포함)
            if _HAS_KRX_OTP:
                csv_text = otp_client.fetch_csv(
                    "dbms/MDC/STAT/standard/MDCSTAT12601",
                    {"prodId": "KRDRVOPK2I", "trdDd": trd_dd},
                    csv_timeout=TIMEOUT_HEAVY,
                )
            else:
                # 원본 수동 OTP 경로 (krx_otp 미설치 환경 폴백)
                params = {
                    "locale": "ko_KR", "prodId": "KRDRVOPK2I",
                    "trdDd": trd_dd, "share": "2", "csvxls_isNo": "false",
                    "name": "fileDown", "url": "dbms/MDC/STAT/standard/MDCSTAT12601",
                }
                resp = requests.post(OTP_URL, data=params, headers=HEADERS, timeout=TIMEOUT_QUICK)
                if resp.status_code != 200:
                    _vlog(f"  [옵션 OTP] {date_str} HTTP {resp.status_code}")
                    current += timedelta(days=1)
                    continue
                otp = resp.text.strip()
                time.sleep(0.5)
                resp2 = requests.post(CSV_URL, data={"code": otp}, headers=HEADERS, timeout=TIMEOUT_HEAVY)
                if resp2.status_code != 200:
                    _vlog(f"  [옵션 CSV] {date_str} HTTP {resp2.status_code}")
                    current += timedelta(days=1)
                    continue
                raw = resp2.content
                for enc in ("euc-kr", "cp949", "utf-8-sig", "utf-8"):
                    try:
                        csv_text = raw.decode(enc)
                        break
                    except (UnicodeDecodeError, LookupError):
                        continue
                else:
                    current += timedelta(days=1)
                    continue
                time.sleep(0.5)

            reader = csv.DictReader(io.StringIO(csv_text))
            # M-9: BOM 정리는 _clean_fieldnames() 위임
            reader.fieldnames = _clean_fieldnames(reader.fieldnames)
            for row in reader:
                contract = (row.get("종목명", "") or row.get("종목코드", "")).strip()
                close_v = _parse_number(row.get("종가")) or _parse_number(row.get("정산가"))
                if not contract or close_v is None:
                    continue
                option_type = _detect_option_type_from_name(contract)
                record = {"time": date_str, "contractName": contract,
                          "optionType": option_type, "close": close_v}
                strike = _extract_strike_price_from_name(contract)
                if strike is not None:
                    record["strikePrice"] = strike
                for kr, en in [("시가","open"),("고가","high"),("저가","low"),("전일대비","change"),
                               ("거래량","volume"),("거래대금","tradingValue"),
                               ("미결제약정(수량)","openInterest"),("미결제약정수량","openInterest"),
                               ("정산가","settlementPrice"),("IV","iv"),("내재변동성","iv")]:
                    val = _parse_number(row.get(kr, ""))
                    if val is not None and en not in record:
                        record[en] = val
                records.append(record)
        except Exception as e:
            _vlog(f"  [옵션 OTP] {date_str} 실패: {e}")

        current += timedelta(days=1)

    return records


# ════════════════════════════════════════════════════════
# 파생 요약 지표 산출
# ════════════════════════════════════════════════════════

def compute_derivatives_summary(futures_data, options_data, kospi200_spot=None):
    """
    파생 요약 지표 산출.

    학술 근거 (core_data/27_futures_basis_program_trading.md §1.2):
      Basis = F_market - S_spot
      basis_pct = (F_market - S_spot) / S_spot * 100
    """
    futures_by_date = defaultdict(list)
    options_by_date = defaultdict(list)

    for r in futures_data:
        futures_by_date[r["time"]].append(r)
    for r in options_data:
        options_by_date[r["time"]].append(r)

    all_dates = sorted(set(list(futures_by_date.keys()) + list(options_by_date.keys())))
    summaries = []

    for date_str in all_dates:
        summary = {"time": date_str}

        # ── 선물 베이시스 ──
        fut_list = futures_by_date.get(date_str, [])
        if fut_list:
            front_month = fut_list[0]
            summary["futuresClose"] = front_month.get("close")
            summary["futuresVolume"] = front_month.get("volume")
            summary["futuresOI"] = front_month.get("openInterest")
            summary["futuresContractName"] = front_month.get("contractName", "")

            if front_month.get("settlementPrice") is not None:
                summary["futuresSettlement"] = front_month["settlementPrice"]

            # 베이시스: _spot (Open API) 또는 kospi200_spot 파라미터
            spot = front_month.get("_spot") or kospi200_spot
            if spot is not None and front_month.get("close") is not None:
                basis = front_month["close"] - spot
                summary["basis"] = round(basis, 2)
                summary["basisPct"] = round(basis / spot * 100, 4)

        # ── 옵션 P/C Ratio ──
        opt_list = options_by_date.get(date_str, [])
        if opt_list:
            total_call_vol = 0
            total_put_vol = 0
            total_call_oi = 0
            total_put_oi = 0

            for opt in opt_list:
                vol = opt.get("volume") or 0
                oi = opt.get("openInterest") or 0
                if opt.get("optionType") == "call":
                    total_call_vol += vol
                    total_call_oi += oi
                elif opt.get("optionType") == "put":
                    total_put_vol += vol
                    total_put_oi += oi

            summary["totalCallVolume"] = total_call_vol
            summary["totalPutVolume"] = total_put_vol
            summary["totalCallOI"] = total_call_oi
            summary["totalPutOI"] = total_put_oi
            summary["totalOI"] = total_call_oi + total_put_oi

            if total_call_vol > 0:
                summary["pcr"] = round(total_put_vol / total_call_vol, 4)
            else:
                summary["pcr"] = None

            if total_call_oi > 0:
                summary["putCallOIRatio"] = round(total_put_oi / total_call_oi, 4)
            else:
                summary["putCallOIRatio"] = None

        summaries.append(summary)

    return summaries


# ════════════════════════════════════════════════════════
# KOSPI200 현물 (data/index.json에서 읽기 시도)
# ════════════════════════════════════════════════════════

def _try_load_kospi200_spot():
    """data/index.json에서 KOSPI200 현물 지수 로드 시도."""
    index_path = os.path.join(DATA_DIR, "index.json")
    if os.path.isfile(index_path):
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                index_data = json.load(f)
            if isinstance(index_data, dict):
                for market_key in ("kospi", "KOSPI", "index"):
                    market_stocks = index_data.get(market_key, [])
                    if isinstance(market_stocks, list):
                        for stock in market_stocks:
                            if isinstance(stock, dict):
                                name = stock.get("name", "")
                                code = stock.get("code", "")
                                if "KOSPI200" in name or "KOSPI 200" in name or code == "KOSPI200":
                                    price = stock.get("prevClose") or stock.get("close") or stock.get("price")
                                    if price:
                                        return float(price)
            elif isinstance(index_data, list):
                for stock in index_data:
                    if isinstance(stock, dict):
                        name = stock.get("name", "")
                        if "KOSPI200" in name or "KOSPI 200" in name:
                            price = stock.get("prevClose") or stock.get("close") or stock.get("price")
                            if price:
                                return float(price)
        except (json.JSONDecodeError, IOError, ValueError):
            pass
    return None


# ════════════════════════════════════════════════════════
# 메인
# ════════════════════════════════════════════════════════

def main():
    global _verbose

    parser = argparse.ArgumentParser(
        description="KRX 파생상품 (KOSPI200 선물/옵션) 일별 데이터 다운로더"
    )
    parser.add_argument("--start", default=(datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"),
                        help="시작일 (YYYY-MM-DD, 기본: 30일 전)")
    parser.add_argument("--end", default=datetime.now().strftime("%Y-%m-%d"),
                        help="종료일 (YYYY-MM-DD, 기본: 오늘)")
    parser.add_argument("--output-dir", default=DERIV_DIR)
    parser.add_argument("--futures-only", action="store_true")
    parser.add_argument("--options-only", action="store_true")
    parser.add_argument("--otp-only", action="store_true", help="OTP 방식만 사용 (Open API 건너뜀)")
    parser.add_argument("--kospi200-spot", type=float, default=None,
                        help="KOSPI200 현물 지수값 (베이시스 산출용)")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    _verbose = args.verbose

    try:
        start_dt = datetime.strptime(args.start, "%Y-%m-%d")
        end_dt = datetime.strptime(args.end, "%Y-%m-%d")
    except ValueError as e:
        _log(f"[파생] 날짜 형식 오류: {e}")
        raise SystemExit(1)

    if start_dt > end_dt:
        _log(f"[파생] 오류: 시작일이 종료일보다 늦습니다.")
        raise SystemExit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    do_futures = not args.options_only
    do_options = not args.futures_only

    _log(f"[파생] 다운로드 기간: {args.start} ~ {args.end}")

    # ── 소스 결정: Open API 우선, OTP 폴백 ──
    use_openapi = False
    client = None
    if not args.otp_only and KRXClient is not None:
        try:
            client = KRXClient(verbose=_verbose)
            use_openapi = True
            _log("[파생] 소스: KRX Open API (drv/fut_bydd_trd + drv/opt_bydd_trd)")
        except Exception as e:
            _log(f"[파생] Open API 초기화 실패 ({e}) → OTP 폴백")

    if not use_openapi:
        _log("[파생] 소스: OTP 폴백 (data.krx.co.kr)")

    # ── 1. 선물 수집 ──
    futures_data = []
    if do_futures:
        _log("[파생] ── 선물 수집 시작 ──")
        if use_openapi:
            futures_data = fetch_futures_openapi(client, start_dt, end_dt)
            if not futures_data:
                _log("[파생] Open API 선물 빈 결과 → OTP 폴백 시도")
                futures_data = _fetch_futures_otp(start_dt, end_dt)
        else:
            futures_data = _fetch_futures_otp(start_dt, end_dt)

        if futures_data:
            futures_data.sort(key=lambda r: (r["time"], r.get("contractName", "")))
            # _spot 필드 제거 (내부 계산용, 출력에 포함하지 않음)
            output_futures = []
            for r in futures_data:
                out = {k: v for k, v in r.items() if not k.startswith("_")}
                output_futures.append(out)

            futures_path = os.path.join(args.output_dir, "futures_daily.json")
            with open(futures_path, "w", encoding="utf-8") as f:
                json.dump(output_futures, f, ensure_ascii=False, indent=2)

            size_kb = os.path.getsize(futures_path) / 1024
            unique_dates = len(set(r["time"] for r in futures_data))
            _log(f"[파생] 선물 저장: {futures_path} ({size_kb:.1f}KB, {unique_dates}일, {len(futures_data)}건)")
        else:
            _log("[파생] 선물 데이터 없음")

    # ── 2. 옵션 수집 ──
    options_data = []
    if do_options:
        _log("[파생] ── 옵션 수집 시작 ──")
        if use_openapi:
            options_data = fetch_options_openapi(client, start_dt, end_dt)
            if not options_data:
                _log("[파생] Open API 옵션 빈 결과 → OTP 폴백 시도")
                options_data = _fetch_options_otp(start_dt, end_dt)
        else:
            options_data = _fetch_options_otp(start_dt, end_dt)

        if options_data:
            options_data.sort(key=lambda r: (r["time"], r.get("optionType", ""), r.get("strikePrice", 0)))

            options_path = os.path.join(args.output_dir, "options_daily.json")
            with open(options_path, "w", encoding="utf-8") as f:
                json.dump(options_data, f, ensure_ascii=False, indent=2)

            size_kb = os.path.getsize(options_path) / 1024
            unique_dates = len(set(r["time"] for r in options_data))
            _log(f"[파생] 옵션 저장: {options_path} ({size_kb:.1f}KB, {unique_dates}일, {len(options_data)}건)")
        else:
            _log("[파생] 옵션 데이터 없음")

    # ── 3. 요약 지표 ──
    if futures_data or options_data:
        _log("[파생] ── 파생 요약 지표 산출 ──")

        spot = args.kospi200_spot
        if spot is None:
            spot = _try_load_kospi200_spot()
            if spot:
                _vlog(f"  KOSPI200 현물 자동 탐색: {spot}")
            else:
                _log("[파생] KOSPI200 현물 미탐지 → 베이시스는 SPOT_PRC 사용")

        summaries = compute_derivatives_summary(futures_data, options_data, spot)

        if summaries:
            summary_path = os.path.join(args.output_dir, "derivatives_summary.json")
            with open(summary_path, "w", encoding="utf-8") as f:
                json.dump(summaries, f, ensure_ascii=False, indent=2)

            size_kb = os.path.getsize(summary_path) / 1024
            _log(f"[파생] 요약 저장: {summary_path} ({size_kb:.1f}KB, {len(summaries)}일)")

            latest = summaries[-1]
            _log(f"[파생] 최신 ({latest['time']}):")
            if "futuresClose" in latest:
                _log(f"  선물 종가: {latest['futuresClose']}")
            if "basis" in latest:
                _log(f"  베이시스: {latest['basis']} ({latest.get('basisPct', 'N/A')}%)")
            if "pcr" in latest and latest["pcr"] is not None:
                _log(f"  P/C Ratio: {latest['pcr']}")

    if use_openapi and client:
        _log(f"[파생] API 남은 쿼터: {client.remaining_quota}")
    _log("[파생] 완료")


if __name__ == "__main__":
    main()
