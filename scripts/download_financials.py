"""
DART 재무제표 다운로더

데이터 소스: DART OpenAPI (전자공시시스템)
출력 형식:   종목별 JSON (매출, 영업이익, 순이익, 재무비율)

폴더 구조:
  data/
  └── financials/
      ├── 005930.json     ← 삼성전자 재무제표
      ├── 000660.json     ← SK하이닉스 재무제표
      └── ...

사용법:
  python scripts/download_financials.py --api-key YOUR_DART_KEY
  python scripts/download_financials.py --api-key YOUR_KEY --code 005930
  python scripts/download_financials.py --api-key YOUR_KEY --top 100
  python scripts/download_financials.py --demo              # API 키 없이 더미 데이터

DART API 키 발급:
  https://opendart.fss.or.kr/ 에서 회원가입 후 인증키 발급

의존성:
  pip install requests
  (pykrx, FinanceDataReader — 종목 리스트용, download_ohlcv.py와 공유)
"""

import sys
import os
import json
import time
import zipfile
import io
import argparse
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional

sys.stdout.reconfigure(encoding='utf-8')

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
FINANCIALS_DIR = os.path.join(DATA_DIR, "financials")

# ── DART API 설정 ──
DART_BASE_URL = "https://opendart.fss.or.kr/api"

# fnlttSinglAcnt 엔드포인트에서 조회할 주요 계정과목
# account_nm 기준 매칭 (DART 공시 기준 한글명)
TARGET_ACCOUNTS = {
    "매출액": "revenue",
    "수익(매출액)": "revenue",
    "영업수익": "revenue",
    "영업이익": "op",
    "영업이익(손실)": "op",
    "당기순이익": "ni",
    "당기순이익(손실)": "ni",
    "당기순이익(손실)의 귀속 지배기업의 소유주에게 귀속되는 당기순이익(손실)": "ni",
    "자산총계": "total_assets",
    "부채총계": "total_liabilities",
    "자본총계": "total_equity",
    "기본주당이익(손실)": "eps",
}


# ══════════════════════════════════════════════════════
#  DART 발행주식수 + 업종코드 조회
#
#  stockTotqySttus API: 주식 총수 현황
#  company.json API: 기업 기본정보 (업종코드, 대표자 등)
#
#  주의: 이 함수들은 설계만 작성된 상태이며, API 호출 제한을 고려하여
#        실행은 명시적으로 --include-shares 옵션을 줄 때만 수행합니다.
# ══════════════════════════════════════════════════════

def fetch_shares_outstanding(api_key: str, corp_code: str,
                              year: int) -> Optional[int]:
    """
    DART stockTotqySttus API 호출 — 발행주식 총수 조회.

    API 엔드포인트: /api/stockTotqySttus.json
    파라미터:
        crtfc_key: API 인증키
        corp_code: DART 기업코드 (8자리)
        bsns_year: 사업연도
        reprt_code: '11011' (사업보고서)

    Returns:
        보통주 발행주식 총수 (int) 또는 None
    """
    import requests

    url = f"{DART_BASE_URL}/stockTotqySttus.json"
    params = {
        "crtfc_key": api_key,
        "corp_code": corp_code,
        "bsns_year": str(year),
        "reprt_code": "11011",  # 사업보고서 (연간)
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "000":
            return None

        items = data.get("list", [])
        for item in items:
            # se: 주식의 종류 — "보통주" 찾기
            se = item.get("se", "").strip()
            if "보통주" in se:
                # istc_totqy: 발행주식의 총수
                total_str = item.get("istc_totqy", "")
                if total_str:
                    cleaned = total_str.replace(",", "").strip()
                    try:
                        return int(cleaned)
                    except (ValueError, TypeError):
                        pass

        return None

    except Exception as e:
        print(f"    발행주식수 조회 실패 ({year}): {e}")
        return None


def fetch_company_info(api_key: str, corp_code: str) -> Optional[dict]:
    """
    DART company.json API 호출 — 기업 기본정보 조회.

    반환 필드:
        induty_code: 업종코드 (4자리 KSIC)
        est_dt: 설립일
        ceo_nm: 대표자명
        hm_url: 홈페이지 URL

    Returns:
        {'induty_code': 'C264', 'ceo_nm': '...', ...} 또는 None
    """
    import requests

    url = f"{DART_BASE_URL}/company.json"
    params = {
        "crtfc_key": api_key,
        "corp_code": corp_code,
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "000":
            return None

        return {
            "induty_code": data.get("induty_code", "").strip(),
            "ceo_nm": data.get("ceo_nm", "").strip(),
            "est_dt": data.get("est_dt", "").strip(),
            "hm_url": data.get("hm_url", "").strip(),
        }

    except Exception as e:
        print(f"    기업정보 조회 실패: {e}")
        return None


def enrich_with_shares_and_sector(api_key: str, stock_code: str,
                                   corp_info: dict,
                                   result: dict,
                                   delay: float = 0.5) -> dict:
    """
    기존 재무 데이터에 발행주식수 + 업종코드 추가.

    - shares_outstanding: 보통주 발행주식 총수
    - induty_code: KSIC 업종코드
    - bps: 자본총계 / 발행주식수 (계산)

    Args:
        api_key: DART API 인증키
        stock_code: 종목코드
        corp_info: {'corp_code': '...', 'corp_name': '...'}
        result: download_stock_financials()의 반환값 (수정됨)
        delay: API 호출 간 대기 시간

    Returns:
        enriched result dict
    """
    corp_code = corp_info["corp_code"]
    current_year = datetime.now().year

    # 1. 발행주식수 조회 (최근 사업연도부터 역순 탐색)
    shares = None
    for year in range(current_year, current_year - 4, -1):
        shares = fetch_shares_outstanding(api_key, corp_code, year)
        if shares:
            break
        time.sleep(delay)

    if shares:
        result["shares_outstanding"] = shares

        # BPS 계산: 가장 최근 연간 데이터의 자본총계 / 발행주식수
        for entry in result.get("annual", []):
            equity = entry.get("total_equity")
            if equity and shares > 0:
                # DART 금액은 원 단위 (백만원이 아님)
                entry["bps"] = round(equity / shares)
                entry["shares_outstanding"] = shares

        # 분기 데이터에도 BPS 추가
        for entry in result.get("quarterly", []):
            equity = entry.get("total_equity")
            if equity and shares > 0:
                entry["bps"] = round(equity / shares)
                entry["shares_outstanding"] = shares

    time.sleep(delay)

    # 2. 기업 기본정보 (업종코드) 조회
    company = fetch_company_info(api_key, corp_code)
    if company:
        result["induty_code"] = company.get("induty_code", "")
        result["ceo_nm"] = company.get("ceo_nm", "")

    return result


# ══════════════════════════════════════════════════════
#  DART CORPCODE.xml 매핑
#
#  DART는 고유 corp_code를 사용하므로
#  stock_code(6자리) → corp_code(8자리) 변환이 필요.
#  corpCode.xml은 ZIP으로 한번 다운로드 후 캐싱.
# ══════════════════════════════════════════════════════

def download_corp_codes(api_key: str) -> dict:
    """
    DART corpCode.xml 다운로드 후 stock_code → corp_code 매핑 딕셔너리 반환.

    Returns:
        {
            '005930': {'corp_code': '00126380', 'corp_name': '삼성전자'},
            '000660': {'corp_code': '00164779', 'corp_name': 'SK하이닉스'},
            ...
        }
    """
    import requests

    cache_path = os.path.join(DATA_DIR, ".dart_corp_codes.json")

    # 캐시 확인 (당일 다운로드분이면 재사용)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if cached.get("date") == datetime.now().strftime("%Y-%m-%d"):
                print(f"  CORPCODE 캐시 사용 ({len(cached['mapping'])}개 기업)")
                return cached["mapping"]
        except Exception:
            pass

    print("  DART CORPCODE.xml 다운로드 중...")

    url = f"{DART_BASE_URL}/corpCode.xml"
    params = {"crtfc_key": api_key}

    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"  CORPCODE 다운로드 실패: {e}")
        return {}

    # ZIP 안에 CORPCODE.xml이 들어있음
    try:
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        xml_name = zf.namelist()[0]  # 보통 'CORPCODE.xml'
        xml_data = zf.read(xml_name)
    except Exception as e:
        print(f"  CORPCODE ZIP 해제 실패: {e}")
        return {}

    # XML 파싱
    root = ET.fromstring(xml_data)
    mapping = {}

    for corp in root.iter("list"):
        corp_code = corp.findtext("corp_code", "").strip()
        corp_name = corp.findtext("corp_name", "").strip()
        stock_code = corp.findtext("stock_code", "").strip()

        # stock_code가 있는 상장 기업만
        if stock_code and len(stock_code) == 6 and corp_code:
            mapping[stock_code] = {
                "corp_code": corp_code,
                "corp_name": corp_name,
            }

    # 캐시 저장
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump({
                "date": datetime.now().strftime("%Y-%m-%d"),
                "count": len(mapping),
                "mapping": mapping,
            }, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    print(f"  CORPCODE 로드 완료: {len(mapping)}개 상장기업")
    return mapping


# ══════════════════════════════════════════════════════
#  DART fnlttSinglAcnt (단일회사 전체 재무제표)
# ══════════════════════════════════════════════════════

def fetch_financials(api_key: str, corp_code: str, year: int,
                     report_code: str) -> Optional[list]:
    """
    DART fnlttSinglAcnt API 호출.

    Args:
        api_key: DART API 인증키
        corp_code: DART 고유 기업코드 (8자리)
        year: 사업연도 (예: 2024)
        report_code: 보고서 코드
            - '11013': 1분기보고서
            - '11012': 반기보고서
            - '11014': 3분기보고서
            - '11011': 사업보고서 (연간)

    Returns:
        API 응답의 list 항목 (계정과목 리스트) 또는 None
    """
    import requests

    url = f"{DART_BASE_URL}/fnlttSinglAcnt.json"
    params = {
        "crtfc_key": api_key,
        "corp_code": corp_code,
        "bsns_year": str(year),
        "reprt_code": report_code,
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        status = data.get("status", "")
        if status == "000":
            return data.get("list", [])
        elif status == "013":
            # 조회된 데이터가 없음 (정상 — 해당 기간 공시 없음)
            return None
        else:
            msg = data.get("message", "알 수 없는 오류")
            if status == "010":
                print(f"    API 키 오류: {msg}")
            elif status == "011":
                print(f"    사용량 초과: {msg}")
            return None

    except Exception as e:
        print(f"    API 호출 실패 ({year}, {report_code}): {e}")
        return None


def parse_account_value(value_str: str) -> Optional[int]:
    """DART 계정 금액 문자열 → 정수 변환 (단위: 원, DART fnlttSinglAcnt 기준)"""
    if not value_str or value_str.strip() in ("", "-"):
        return None
    try:
        # 쉼표 제거, 마이너스 처리
        cleaned = value_str.replace(",", "").strip()
        return int(cleaned)
    except (ValueError, TypeError):
        return None


def extract_period_data(items: list, year: int,
                        report_code: str) -> Optional[dict]:
    """
    fnlttSinglAcnt API 응답에서 주요 계정과목 추출.

    Args:
        items: API 응답의 list (계정과목 리스트)
        year: 사업연도
        report_code: 보고서 코드

    Returns:
        {
            'period': '2024Q3' 또는 '2024',
            'revenue': 791050,
            'op': 91834,
            'ni': 73051,
            'total_assets': ...,
            'total_liabilities': ...,
            'total_equity': ...,
            'eps': 1330,
        }
    """
    # 보고서 코드 → 분기 매핑
    period_map = {
        "11013": f"{year}Q1",
        "11012": f"{year}Q2",
        "11014": f"{year}Q3",
        "11011": str(year),
    }
    period = period_map.get(report_code, str(year))

    result = {"period": period}
    found_any = False
    detected_unit = None  # DART API unit 필드 추적

    for item in items:
        account_nm = item.get("account_nm", "").strip()
        # 연결재무제표 우선 (fs_div='CFS'), 없으면 별도재무제표 ('OFS')
        fs_div = item.get("fs_div", "")

        # DART API unit 필드 추출 (첫 번째 발견된 값 사용)
        if detected_unit is None:
            unit_val = item.get("unit", "")
            if unit_val and unit_val.strip():
                detected_unit = unit_val.strip()

        # TARGET_ACCOUNTS에 매칭되는 계정과목 추출
        for dart_name, our_key in TARGET_ACCOUNTS.items():
            if account_nm == dart_name:
                # 이미 연결재무제표 값이 있으면 별도재무제표는 건너뛰기
                if our_key in result and fs_div == "OFS":
                    continue

                # thstrm_amount (당기금액) 사용
                val = parse_account_value(item.get("thstrm_amount", ""))
                if val is not None:
                    result[our_key] = val
                    found_any = True
                break

    if not found_any:
        return None

    # unit 필드 기록 (DART fnlttSinglAcnt 기본값: "원")
    result["unit"] = detected_unit or "원"

    return result


def calc_ratios(data: dict) -> dict:
    """
    추출된 재무 데이터에서 비율 지표 계산.

    - OPM (영업이익률) = 영업이익 / 매출액 * 100
    - ROE (자기자본이익률) = 당기순이익 / 자본총계 * 100
    - 부채비율 = 부채총계 / 자본총계 * 100
    """
    revenue = data.get("revenue")
    op = data.get("op")
    ni = data.get("ni")
    total_equity = data.get("total_equity")
    total_liabilities = data.get("total_liabilities")

    # OPM
    if revenue and op and revenue != 0:
        opm = round(op / revenue * 100, 1)
        data["opm"] = f"{opm}%"
    else:
        data["opm"] = None

    # ROE
    if ni and total_equity and total_equity != 0:
        roe = round(ni / total_equity * 100, 1)
        data["roe"] = f"{roe}%"
    else:
        data["roe"] = None

    # 부채비율
    if total_liabilities and total_equity and total_equity != 0:
        debt_ratio = round(total_liabilities / total_equity * 100, 1)
        data["debt_ratio"] = f"{debt_ratio}%"
    else:
        data["debt_ratio"] = None

    # BPS (자본총계가 있고 EPS가 있으면 — 주당순자산은 별도 계산 불가하므로
    #       DART에서 직접 제공하지 않으면 생략)

    return data


# ══════════════════════════════════════════════════════
#  종목별 재무제표 다운로드 + 저장
# ══════════════════════════════════════════════════════

def download_stock_financials(api_key: str, stock_code: str,
                              corp_info: dict, years: int = 3,
                              delay: float = 0.5) -> Optional[dict]:
    """
    단일 종목의 재무제표 데이터 다운로드.

    Args:
        api_key: DART API 인증키
        stock_code: 종목코드 (6자리)
        corp_info: {'corp_code': '00126380', 'corp_name': '삼성전자'}
        years: 조회 연수 (기본 3년)
        delay: API 호출 간 대기 시간 (초)

    Returns:
        저장된 재무 데이터 딕셔너리 또는 None
    """
    corp_code = corp_info["corp_code"]
    corp_name = corp_info["corp_name"]
    current_year = datetime.now().year

    quarterly_data = []
    annual_data = []

    # 보고서 코드: 분기 + 연간
    report_codes = {
        "11013": "Q1",  # 1분기
        "11012": "Q2",  # 반기
        "11014": "Q3",  # 3분기
        "11011": "연간", # 사업보고서
    }

    for year in range(current_year - years, current_year + 1):
        for rcode, rname in report_codes.items():
            items = fetch_financials(api_key, corp_code, year, rcode)
            if items is None:
                continue  # 데이터 없음 — sleep 불필요 (API 미호출 또는 "013" 응답)

            period_data = extract_period_data(items, year, rcode)
            if period_data is None:
                continue  # 파싱 실패 — sleep 불필요

            # 비율 지표 계산
            period_data = calc_ratios(period_data)

            if rcode == "11011":
                annual_data.append(period_data)
            else:
                quarterly_data.append(period_data)

            time.sleep(delay)

    if not quarterly_data and not annual_data:
        return None

    # 기간순 정렬
    quarterly_data.sort(key=lambda x: x["period"])
    annual_data.sort(key=lambda x: x["period"])

    result = {
        "code": stock_code,
        "name": corp_name,
        "source": "dart",
        "updated": datetime.now().strftime("%Y-%m-%d"),
        "quarterly": quarterly_data,
        "annual": annual_data,
    }

    # JSON 저장
    os.makedirs(FINANCIALS_DIR, exist_ok=True)
    filepath = os.path.join(FINANCIALS_DIR, f"{stock_code}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return result


# ══════════════════════════════════════════════════════
#  데모 모드 — API 키 없이 더미 데이터 생성
# ══════════════════════════════════════════════════════

DEMO_STOCKS = [
    {"code": "005930", "name": "삼성전자"},
    {"code": "000660", "name": "SK하이닉스"},
    {"code": "005380", "name": "현대차"},
    {"code": "000270", "name": "기아"},
    {"code": "035420", "name": "NAVER"},
    {"code": "035720", "name": "카카오"},
    {"code": "051910", "name": "LG화학"},
    {"code": "006400", "name": "삼성SDI"},
    {"code": "068270", "name": "셀트리온"},
    {"code": "207940", "name": "삼성바이오로직스"},
    {"code": "105560", "name": "KB금융"},
    {"code": "055550", "name": "신한지주"},
    {"code": "247540", "name": "에코프로비엠"},
    {"code": "086520", "name": "에코프로"},
    {"code": "196170", "name": "알테오젠"},
]


def _seeded_random(seed: int):
    """결정적 난수 생성기 (download_ohlcv.py 패턴과 동일)"""
    def _next():
        nonlocal seed
        seed = (seed * 9301 + 49297) % 233280
        return seed / 233280
    return _next


def generate_demo_financials(stock_code: str, name: str) -> dict:
    """
    더미 재무제표 데이터 생성.
    종목코드 해시 기반으로 결정적(deterministic) 데이터 생성.
    """
    # 코드 해시를 seed로 사용
    seed = sum(ord(c) for c in stock_code)
    rand = _seeded_random(seed)

    current_year = datetime.now().year
    base_revenue = int(50000 + rand() * 2000000)  # 매출 기본값 (백만원)
    growth = 0.95 + rand() * 0.2  # 성장률

    quarterly = []
    annual = []

    for year in range(current_year - 3, current_year + 1):
        year_revenue = int(base_revenue * growth ** (year - current_year + 3))

        # 연간 데이터
        opm_rate = 0.05 + rand() * 0.2  # OPM 5~25%
        ni_rate = 0.03 + rand() * 0.15  # 순이익률 3~18%
        year_op = int(year_revenue * opm_rate)
        year_ni = int(year_revenue * ni_rate)
        year_assets = int(year_revenue * (1.5 + rand() * 2))
        year_equity = int(year_assets * (0.4 + rand() * 0.3))
        year_liabilities = year_assets - year_equity
        year_eps = int(year_ni / (100 + rand() * 500))

        annual_entry = {
            "period": str(year),
            "revenue": year_revenue,
            "op": year_op,
            "ni": year_ni,
            "total_assets": year_assets,
            "total_liabilities": year_liabilities,
            "total_equity": year_equity,
            "eps": year_eps,
        }
        annual_entry = calc_ratios(annual_entry)
        annual.append(annual_entry)

        # 분기 데이터 (Q1~Q3, 현재 연도는 일부만)
        for q in range(1, 4):
            if year == current_year and q > (datetime.now().month - 1) // 3:
                break

            q_factor = 0.2 + rand() * 0.1  # 분기별 매출 비중 20~30%
            q_revenue = int(year_revenue * q_factor)
            q_opm = opm_rate + (rand() - 0.5) * 0.05
            q_op = int(q_revenue * q_opm)
            q_ni = int(q_revenue * ni_rate * (0.8 + rand() * 0.4))
            q_eps = int(q_ni / (100 + rand() * 500))

            q_entry = {
                "period": f"{year}Q{q}",
                "revenue": q_revenue,
                "op": q_op,
                "ni": q_ni,
                "total_assets": year_assets,
                "total_liabilities": year_liabilities,
                "total_equity": year_equity,
                "eps": q_eps,
            }
            q_entry = calc_ratios(q_entry)
            quarterly.append(q_entry)

    result = {
        "code": stock_code,
        "name": name,
        "updated": datetime.now().strftime("%Y-%m-%d"),
        "source": "demo",
        "quarterly": quarterly,
        "annual": annual,
    }

    # JSON 저장
    os.makedirs(FINANCIALS_DIR, exist_ok=True)
    filepath = os.path.join(FINANCIALS_DIR, f"{stock_code}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return result


# ══════════════════════════════════════════════════════
#  종목 리스트 로드 (index.json 또는 FinanceDataReader)
# ══════════════════════════════════════════════════════

def load_stock_list(market: Optional[str] = None,
                    top: Optional[int] = None) -> list:
    """
    종목 리스트 로드.
    1순위: data/index.json (download_ohlcv.py로 생성된 것)
    2순위: FinanceDataReader 직접 조회
    """
    index_path = os.path.join(DATA_DIR, "index.json")

    if os.path.exists(index_path):
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                index = json.load(f)
            stocks = index.get("stocks", [])
            print(f"  index.json에서 {len(stocks)}종목 로드")
        except Exception:
            stocks = []
    else:
        stocks = []

    if not stocks:
        try:
            import FinanceDataReader as fdr
            print("  FinanceDataReader에서 종목 리스트 로딩...")
            kospi = fdr.StockListing('KOSPI')
            kosdaq = fdr.StockListing('KOSDAQ')

            for _, row in kospi.iterrows():
                code = str(row['Code']).strip()
                name = str(row['Name']).strip()
                if code and name and len(code) == 6:
                    stocks.append({"code": code, "name": name, "market": "KOSPI"})
            for _, row in kosdaq.iterrows():
                code = str(row['Code']).strip()
                name = str(row['Name']).strip()
                if code and name and len(code) == 6:
                    stocks.append({"code": code, "name": name, "market": "KOSDAQ"})

            print(f"  FDR: {len(stocks)}종목 로드")
        except ImportError:
            print("  FinanceDataReader 미설치, 기본 종목 사용")
            stocks = DEMO_STOCKS

    # 시장 필터
    if market:
        stocks = [s for s in stocks if s.get("market") == market]

    # 상위 N개
    if top:
        stocks = stocks[:top]

    return stocks


# ══════════════════════════════════════════════════════
#  메인 실행
# ══════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="DART 재무제표 다운로더",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예제:
  python scripts/download_financials.py --api-key YOUR_KEY
  python scripts/download_financials.py --api-key YOUR_KEY --code 005930
  python scripts/download_financials.py --api-key YOUR_KEY --top 100
  python scripts/download_financials.py --demo
        """,
    )
    parser.add_argument("--api-key", type=str, help="DART OpenAPI 인증키")
    parser.add_argument("--code", type=str, help="특정 종목코드만 다운로드")
    parser.add_argument("--market", type=str, choices=["KOSPI", "KOSDAQ"],
                        help="특정 시장만")
    parser.add_argument("--top", type=int, help="상위 N개 종목만")
    parser.add_argument("--years", type=int, default=3,
                        help="조회 연수 (기본: 3)")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="API 호출 간 대기 (초, 기본: 0.5)")
    parser.add_argument("--demo", action="store_true",
                        help="API 키 없이 더미 데이터 생성")
    parser.add_argument("--include-shares", action="store_true",
                        help="발행주식수 + 업종코드 추가 조회 (API 호출 +2건/종목)")
    parser.add_argument("--skip-existing", action="store_true",
                        help="이미 DART 데이터가 있는 종목 건너뛰기 (데모 데이터만 갱신)")
    args = parser.parse_args()

    # .env 파일에서 API 키 자동 로드
    if not args.api_key and not args.demo:
        env_path = os.path.join(PROJECT_ROOT, ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DART_API_KEY="):
                        args.api_key = line.split("=", 1)[1].strip()
                        print(f"[INFO] .env에서 API 키 로드 완료")
                        break

    # API 키 또는 데모 모드 필수
    if not args.api_key and not args.demo:
        print("오류: --api-key 또는 --demo 중 하나를 지정하세요.")
        print("  DART API 키 발급: https://opendart.fss.or.kr/")
        print("  또는 .env 파일에 DART_API_KEY=키값 저장")
        print("  더미 모드: python scripts/download_financials.py --demo")
        sys.exit(1)

    os.makedirs(FINANCIALS_DIR, exist_ok=True)

    print(f"{'=' * 50}")
    print(f"  DART 재무제표 다운로더")
    if args.demo:
        print(f"  모드: 데모 (더미 데이터)")
    else:
        print(f"  모드: DART OpenAPI")
        print(f"  조회 기간: 최근 {args.years}년")
    print(f"  저장: data/financials/")
    print(f"{'=' * 50}")
    print()

    # ── 데모 모드 ──
    if args.demo:
        if args.code:
            targets = [{"code": args.code, "name": args.code}]
        else:
            targets = load_stock_list(args.market, args.top)
            if not targets:
                targets = DEMO_STOCKS

        print(f"  더미 데이터 생성 중 ({len(targets)}종목)...")
        success = 0
        for i, s in enumerate(targets):
            result = generate_demo_financials(s["code"], s.get("name", s["code"]))
            if result:
                success += 1
                if (i + 1) <= 5 or (i + 1) % 50 == 0:
                    q_count = len(result["quarterly"])
                    a_count = len(result["annual"])
                    print(f"    [{i+1}/{len(targets)}] {s.get('name', s['code'])}"
                          f"({s['code']}): {q_count}분기 + {a_count}연간")

        print(f"\n  완료: {success}종목 저장")
        print(f"  경로: data/financials/")
        return

    # ── DART API 모드 ──
    # 1. CORPCODE 매핑 다운로드
    corp_codes = download_corp_codes(args.api_key)
    if not corp_codes:
        print("  CORPCODE 다운로드 실패. API 키를 확인하세요.")
        sys.exit(1)

    # 2. 대상 종목 리스트
    if args.code:
        if args.code not in corp_codes:
            print(f"  종목코드 {args.code}에 대한 DART corp_code를 찾을 수 없습니다.")
            sys.exit(1)
        targets = [{"code": args.code,
                     "name": corp_codes[args.code]["corp_name"]}]
    else:
        targets = load_stock_list(args.market, args.top)
        # corp_code가 있는 종목만 필터링
        targets = [s for s in targets if s["code"] in corp_codes]

    extra_calls = 2 if args.include_shares else 0  # 발행주식수 + 기업정보
    total_calls = len(targets) * (args.years * 4 + extra_calls)
    print(f"\n  다운로드 시작 ({len(targets)}종목, 최근 {args.years}년)")
    print(f"  예상 API 호출: ~{total_calls}건" + (" (발행주식수+업종 포함)" if args.include_shares else ""))
    print(f"  예상 소요 시간: ~{int(total_calls * args.delay / 60)}분")
    print()

    success = 0
    fail = 0
    skip = 0
    start_time = time.time()

    for i, s in enumerate(targets):
        code = s["code"]
        corp_info = corp_codes.get(code)

        if not corp_info:
            skip += 1
            continue

        # --skip-existing: 이미 DART 데이터가 있으면 건너뛰기
        if args.skip_existing:
            existing_path = os.path.join(FINANCIALS_DIR, f"{code}.json")
            if os.path.exists(existing_path):
                try:
                    with open(existing_path, "r", encoding="utf-8") as ef:
                        existing = json.load(ef)
                    if existing.get("source") not in ("demo", "seed") and existing.get("quarterly"):
                        skip += 1
                        continue
                except Exception:
                    pass

        result = download_stock_financials(
            api_key=args.api_key,
            stock_code=code,
            corp_info=corp_info,
            years=args.years,
            delay=args.delay,
        )

        if result is None:
            skip += 1
        else:
            # --include-shares 옵션: 발행주식수 + 업종코드 추가 조회
            if args.include_shares:
                result = enrich_with_shares_and_sector(
                    api_key=args.api_key,
                    stock_code=code,
                    corp_info=corp_info,
                    result=result,
                    delay=args.delay,
                )
                # enriched result 재저장
                filepath = os.path.join(FINANCIALS_DIR, f"{code}.json")
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)

            success += 1
            q_count = len(result["quarterly"])
            a_count = len(result["annual"])

            # 진행률 표시
            if (i + 1) <= 5 or (i + 1) % 20 == 0:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                eta = (len(targets) - i - 1) / rate if rate > 0 else 0
                print(f"  [{i+1}/{len(targets)}] {corp_info['corp_name']}"
                      f"({code}): {q_count}분기 + {a_count}연간"
                      f" | 남은: {int(eta // 60)}분 {int(eta % 60)}초")

    elapsed = time.time() - start_time

    # ── 용량 계산 ──
    total_size = 0
    for f in os.listdir(FINANCIALS_DIR):
        if f.endswith(".json"):
            total_size += os.path.getsize(os.path.join(FINANCIALS_DIR, f))

    print(f"\n{'=' * 50}")
    print(f"  완료! ({int(elapsed // 60)}분 {int(elapsed % 60)}초 소요)")
    print(f"  성공: {success} | 건너뜀: {skip} | 실패: {fail}")
    print(f"  총 용량: {total_size / 1024:.1f}KB")
    print(f"  경로: data/financials/")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
