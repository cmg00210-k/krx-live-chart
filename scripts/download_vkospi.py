#!/usr/bin/env python3
"""
VKOSPI (한국 변동성지수) 일별 데이터 다운로더

데이터 소스 (우선순위):
  1. KRX Open API (data-dbg.krx.co.kr) — idx/drvprod_dd_trd 엔드포인트
  2. OTP 2단계 폴백 (data.krx.co.kr) — MDCSTAT01701

인증: .env 파일 KRX_API_KEY (Open API), OTP는 인증 불필요

출력: data/vkospi.json
형식: [{time: "YYYY-MM-DD", open: float, high: float, low: float, close: float}]

학술 근거: core_data/26_options_volatility_signals.md §2
  VKOSPI 4단계 레짐 분류 (signalEngine.js:1535 VIX*1.1 프록시 대체)

사용법:
    python scripts/download_vkospi.py
    python scripts/download_vkospi.py --start 2020-01-01 --end 2024-12-31
    python scripts/download_vkospi.py --output data/vkospi.json
"""

import argparse
import csv
import io
import json
import os
import sys
import time
from datetime import datetime, timedelta

try:
    import requests
except ImportError:
    print("[VKOSPI] 오류: requests 패키지가 필요합니다. pip install requests")
    raise SystemExit(1)

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

# ── KRX 클라이언트 임포트 ──
sys.path.insert(0, os.path.join(PROJECT_ROOT, "scripts"))
try:
    from krx_api import KRXClient
except ImportError:
    KRXClient = None

# ── OTP 폴백용 상수 ──
OTP_URL = "http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd"
CSV_URL = "http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd"

OTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "http://data.krx.co.kr",
}


# ── Open API 방식 ──

def _generate_business_days(start_dt, end_dt):
    """
    시작~종료 사이 영업일(월~금) 생성기.
    공휴일은 제외 불가 — API가 빈 결과로 처리.

    Parameters:
        start_dt: datetime 시작일
        end_dt:   datetime 종료일

    Yields:
        str YYYYMMDD 형식 영업일
    """
    current = start_dt
    while current <= end_dt:
        # 월(0)~금(4)만
        if current.weekday() < 5:
            yield current.strftime("%Y%m%d")
        current += timedelta(days=1)


def _parse_float_safe(val):
    """
    KRX Open API 숫자 필드 파싱.
    쉼표, 공백 제거 후 float 변환. 실패 시 None.
    """
    if val is None:
        return None
    s = str(val).strip().replace(",", "")
    if not s or s == "-":
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def download_via_open_api(start_dt, end_dt, verbose=False):
    """
    KRX Open API idx/drvprod_dd_trd를 일별로 호출하여 VKOSPI 추출.

    Open API는 per-day 쿼리 — 단일 호출로 해당 일자의 모든 파생상품지수(~282건)를
    반환하므로, 각 날짜별로 호출 후 VKOSPI 행을 필터링한다.

    Parameters:
        start_dt: datetime 시작일
        end_dt:   datetime 종료일
        verbose:  상세 로그 출력

    Returns:
        list of dicts [{time, open, high, low, close}] 오름차순
        None if Open API 사용 불가 (키 없음 등)
    """
    if KRXClient is None:
        print("[VKOSPI] Open API: krx_api.py 모듈 없음 → OTP 폴백")
        return None

    try:
        client = KRXClient(verbose=verbose)
    except (ValueError, RuntimeError) as e:
        print(f"[VKOSPI] Open API 초기화 실패: {e} → OTP 폴백")
        return None

    business_days = list(_generate_business_days(start_dt, end_dt))
    total_days = len(business_days)

    if total_days == 0:
        print("[VKOSPI] 경고: 영업일 없음")
        return []

    # 쿼터 사전 확인
    if total_days > client.remaining_quota:
        print(
            f"[VKOSPI] Open API 쿼터 부족: 필요 {total_days}건, "
            f"잔여 {client.remaining_quota}건 → OTP 폴백"
        )
        return None

    print(f"[VKOSPI] Open API: {total_days} 영업일 조회 시작")

    records = []
    api_errors = 0
    MAX_CONSECUTIVE_ERRORS = 10  # 연속 실패 임계치

    for i, date_str in enumerate(business_days):
        try:
            data = client.get("idx_deriv", basDd=date_str)
        except RuntimeError as e:
            # 쿼터 초과
            print(f"[VKOSPI] {e}")
            if records:
                print(f"[VKOSPI] 쿼터 초과 — 수집된 {len(records)}건 반환")
                break
            return None

        if not data:
            # 공휴일 또는 빈 응답 — 정상
            api_errors += 1
            if api_errors >= MAX_CONSECUTIVE_ERRORS:
                print(f"[VKOSPI] 연속 {MAX_CONSECUTIVE_ERRORS}회 빈 응답 → OTP 폴백")
                return None
            continue

        # 연속 에러 리셋
        api_errors = 0

        # VKOSPI 행 필터: IDX_NM에 "변동성" 또는 "VKOSPI" 포함
        vkospi_rows = [
            r for r in data
            if "변동성" in r.get("IDX_NM", "")
            or "VKOSPI" in r.get("IDX_NM", "").upper()
        ]

        if not vkospi_rows:
            continue

        row = vkospi_rows[0]

        # BAS_DD: "YYYYMMDD" → "YYYY-MM-DD"
        raw_date = row.get("BAS_DD", date_str)
        if len(raw_date) == 8:
            formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
        else:
            formatted_date = raw_date

        close_v = _parse_float_safe(row.get("CLSPRC_IDX"))
        if close_v is None:
            continue

        record = {"time": formatted_date, "close": close_v}

        open_v = _parse_float_safe(row.get("OPNPRC_IDX"))
        high_v = _parse_float_safe(row.get("HGPRC_IDX"))
        low_v = _parse_float_safe(row.get("LWPRC_IDX"))

        if open_v is not None:
            record["open"] = open_v
        if high_v is not None:
            record["high"] = high_v
        if low_v is not None:
            record["low"] = low_v

        records.append(record)

        # 진행 표시 (100일마다 또는 마지막)
        if verbose or (i + 1) % 100 == 0 or (i + 1) == total_days:
            print(
                f"[VKOSPI] Open API 진행: {i + 1}/{total_days} "
                f"({len(records)}건 수집)"
            )

    records.sort(key=lambda r: r["time"])
    return records


# ── OTP 폴백 방식 (기존 로직 보존) ──

def _generate_otp(start_yyyymmdd, end_yyyymmdd):
    """
    KRX OTP 생성 엔드포인트에 POST 요청 (폴백용).

    Parameters:
        start_yyyymmdd: 시작일 (YYYYMMDD)
        end_yyyymmdd:   종료일 (YYYYMMDD)

    Returns:
        OTP 토큰 문자열
    """
    params = {
        "locale": "ko_KR",
        "share": "2",
        "csvxls_isNo": "false",
        "name": "fileDown",
        "url": "dbms/MDC/STAT/standard/MDCSTAT01701",
        "indIdx2CDNM": "변동성지수",
        "codeNmindIdx2Cd": "V-KOSPI200",
        "param1indIdx2Cd": "VKOSPI",
        "strtDd": start_yyyymmdd,
        "endDd": end_yyyymmdd,
    }

    resp = requests.post(OTP_URL, data=params, headers=OTP_HEADERS, timeout=15)
    resp.raise_for_status()

    otp = resp.text.strip()
    if not otp:
        raise ValueError("[VKOSPI] OTP 생성 실패: 빈 응답")

    return otp


def _download_csv(otp):
    """
    OTP 토큰으로 KRX CSV 파일 다운로드 (폴백용).

    Parameters:
        otp: _generate_otp()에서 받은 토큰

    Returns:
        CSV 원문 문자열 (EUC-KR 디코딩)
    """
    resp = requests.post(
        CSV_URL,
        data={"code": otp},
        headers=OTP_HEADERS,
        timeout=30,
    )
    resp.raise_for_status()

    raw_bytes = resp.content
    for encoding in ("euc-kr", "cp949", "utf-8-sig", "utf-8"):
        try:
            return raw_bytes.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue

    raise ValueError("[VKOSPI] CSV 인코딩 감지 실패")


def _parse_csv(csv_text):
    """
    KRX VKOSPI CSV 파싱 (폴백용).

    입력 컬럼 예시: 일자, 시가, 고가, 저가, 종가
    출력: [{time, open, high, low, close}] — 날짜 오름차순

    Parameters:
        csv_text: EUC-KR 디코딩된 CSV 원문

    Returns:
        list of dicts, 오름차순 정렬
    """
    records = []
    reader = csv.DictReader(io.StringIO(csv_text))

    fieldnames = reader.fieldnames or []
    cleaned = [f.lstrip("\ufeff").strip() for f in fieldnames]
    reader.fieldnames = cleaned

    for row in reader:
        try:
            raw_date = row.get("일자", "").strip()
            if not raw_date:
                continue
            date_str = raw_date.replace("/", "-").replace(".", "-")
            datetime.strptime(date_str, "%Y-%m-%d")

            def parse_float(key):
                val = row.get(key, "").strip().replace(",", "")
                return float(val) if val else None

            open_v = parse_float("시가")
            high_v = parse_float("고가")
            low_v = parse_float("저가")
            close_v = parse_float("종가")

            if close_v is None:
                continue

            record = {"time": date_str, "close": close_v}
            if open_v is not None:
                record["open"] = open_v
            if high_v is not None:
                record["high"] = high_v
            if low_v is not None:
                record["low"] = low_v

            records.append(record)

        except (ValueError, KeyError):
            continue

    records.sort(key=lambda r: r["time"])
    return records


def download_via_otp(start_dt, end_dt):
    """
    OTP 2단계 폴백으로 VKOSPI 다운로드.

    Parameters:
        start_dt: datetime 시작일
        end_dt:   datetime 종료일

    Returns:
        list of dicts [{time, open, high, low, close}] 오름차순
        None if 실패
    """
    start_krx = start_dt.strftime("%Y%m%d")
    end_krx = end_dt.strftime("%Y%m%d")

    print(f"[VKOSPI] OTP 폴백: {start_dt.strftime('%Y-%m-%d')} ~ {end_dt.strftime('%Y-%m-%d')}")

    try:
        otp = _generate_otp(start_krx, end_krx)
        print("[VKOSPI] OTP 생성 완료")
    except requests.exceptions.Timeout:
        print("[VKOSPI] 오류: OTP 요청 타임아웃 (data.krx.co.kr 연결 확인)")
        return None
    except requests.exceptions.RequestException as e:
        print(f"[VKOSPI] 오류: OTP 요청 실패 — {e}")
        return None
    except ValueError as e:
        print(e)
        return None

    time.sleep(0.5)

    try:
        csv_text = _download_csv(otp)
        print(f"[VKOSPI] CSV 수신 완료 ({len(csv_text):,} bytes)")
    except requests.exceptions.Timeout:
        print("[VKOSPI] 오류: CSV 다운로드 타임아웃")
        return None
    except requests.exceptions.RequestException as e:
        print(f"[VKOSPI] 오류: CSV 다운로드 실패 — {e}")
        return None
    except ValueError as e:
        print(e)
        return None

    return _parse_csv(csv_text)


# ── 메인 ──

def main():
    parser = argparse.ArgumentParser(description="VKOSPI 일별 데이터 다운로더 (KRX Open API + OTP 폴백)")
    parser.add_argument(
        "--start",
        default="2015-01-01",
        help="시작일 (YYYY-MM-DD, 기본: 2015-01-01)",
    )
    parser.add_argument(
        "--end",
        default=datetime.now().strftime("%Y-%m-%d"),
        help="종료일 (YYYY-MM-DD, 기본: 오늘)",
    )
    parser.add_argument(
        "--output",
        default=os.path.join(DATA_DIR, "vkospi.json"),
        help="출력 파일 경로 (기본: data/vkospi.json)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="상세 로그 출력",
    )
    parser.add_argument(
        "--otp-only",
        action="store_true",
        help="Open API 건너뛰고 OTP만 사용",
    )
    args = parser.parse_args()

    # 날짜 형식 검증
    try:
        start_dt = datetime.strptime(args.start, "%Y-%m-%d")
        end_dt = datetime.strptime(args.end, "%Y-%m-%d")
    except ValueError as e:
        print(f"[VKOSPI] 날짜 형식 오류: {e} (YYYY-MM-DD 사용)")
        raise SystemExit(1)

    if start_dt > end_dt:
        print(f"[VKOSPI] 오류: 시작일({args.start})이 종료일({args.end})보다 늦습니다.")
        raise SystemExit(1)

    print(f"[VKOSPI] 다운로드 중: {args.start} ~ {args.end}")

    records = None

    # 1차: Open API
    if not args.otp_only:
        records = download_via_open_api(start_dt, end_dt, verbose=args.verbose)
        if records is not None and len(records) > 0:
            print(f"[VKOSPI] Open API 성공: {len(records)}건")
        else:
            if records is not None and len(records) == 0:
                print("[VKOSPI] Open API: 데이터 없음")
            records = None  # OTP 폴백 트리거

    # 2차: OTP 폴백
    if records is None:
        print("[VKOSPI] ⚠ Open API 실패 → OTP 2단계 폴백")
        records = download_via_otp(start_dt, end_dt)

    if not records:
        print("[VKOSPI] 경고: 파싱된 데이터 없음 (날짜 범위 또는 공휴일 확인)")
        raise SystemExit(1)

    print(f"[VKOSPI] {len(records)}일 데이터 수집 ({records[0]['time']} ~ {records[-1]['time']})")

    # 출력 디렉터리 확인 및 JSON 저장
    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    size_kb = os.path.getsize(args.output) / 1024
    print(f"[VKOSPI] 저장 완료: {args.output} ({size_kb:.1f}KB)")
    print(f"[VKOSPI] signalEngine.js VIX*1.1 프록시 대체 가능")


if __name__ == "__main__":
    main()
