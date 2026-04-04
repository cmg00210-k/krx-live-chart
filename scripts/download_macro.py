#!/usr/bin/env python3
"""
거시경제 지표 다운로더

데이터 소스:
  1. BOK ECOS API — 기준금리, 국고채 수익률, M2, CLI, CPI
  2. FRED API — Fed Funds Rate, US 10Y, VIX
  3. OECD SDMX API — 한국/중국/미국 경기선행지수(CLI)
  4. yfinance — USD/KRW, DXY

출력:
  data/macro/macro_latest.json   ← JS 소비용 최신 스냅샷
  data/macro/macro_history.json  ← 2년 월별 시계열

UIP 기반 외인 시그널:
  foreigner_signal = 0.45*(-dVIX_norm) + 0.30*(rate_diff) + 0.25*(-dDXY_norm)

사용법:
  python scripts/download_macro.py
  python scripts/download_macro.py --api-key ECOS_KEY --fred-key FRED_KEY
  python scripts/download_macro.py --offline
  python scripts/download_macro.py --verbose

의존성:
  pip install requests
  (선택) pip install yfinance
"""

import sys
import os
import json
import time
import argparse
from datetime import datetime, timedelta
import urllib.parse

sys.stdout.reconfigure(encoding='utf-8')

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
MACRO_DIR = os.path.join(DATA_DIR, "macro")
LATEST_PATH = os.path.join(MACRO_DIR, "macro_latest.json")
HISTORY_PATH = os.path.join(MACRO_DIR, "macro_history.json")

# ── 선택적 의존성 ──
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

try:
    import FinanceDataReader as fdr
    HAS_FDR = True
except ImportError:
    HAS_FDR = False

# ── 공통 상수/유틸 (api_constants.py) ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from api_constants import (
    ECOS_BASE_URL as ECOS_BASE,
    FRED_BASE_URL as FRED_BASE,
    RATE_LIMIT_SEC as RATE_LIMIT,
    TIMEOUT_QUICK as TIMEOUT,
)

# ── API 설정 ──
OECD_BASE = "https://sdmx.oecd.org/public/rest/data"

# ── ECOS 통계코드 ──
ECOS_SERIES = {
    "bok_rate": {
        "stat_code": "722Y001",
        "item_code": "0101000",
        "name": "한국은행 기준금리",
        "freq": "M",
    },
    # FIX: 817Y002(일별전용) → 721Y001(월별), item_code도 변경
    "ktb10y": {
        "stat_code": "721Y001",
        "item_code": "5050000",
        "name": "국고채 10년 (월별)",
        "freq": "M",
    },
    "ktb3y": {
        "stat_code": "721Y001",
        "item_code": "5020000",
        "name": "국고채 3년 (월별)",
        "freq": "M",
    },
    # FIX: 101Y003(2004폐기) → 161Y006(신지표), item_code BBGA00→BBHA00
    "m2": {
        "stat_code": "161Y006",
        "item_code": "BBHA00",
        "name": "M2 광의통화 (평잔, 원계열, 신지표)",
        "freq": "M",
    },
    # NOTE: ECOS cli (순환변동치) differs from download_kosis.py cli_composite (2020=100 level).
    # Intentional cross-validation: ECOS=cyclical component, KOSIS=absolute level index.
    "cli": {
        "stat_code": "901Y067",
        "item_code": "I16A",
        "name": "경기선행지수 순환변동치",
        "freq": "M",
    },
    "cpi": {
        "stat_code": "901Y009",
        "item_code": "0",
        "name": "소비자물가지수 총지수",
        "freq": "M",
    },
    # ── NEW: 4 CRITICAL series (Phase ECOS-3) ──
    "bsi_mfg": {
        "stat_code": "512Y013",
        "item_code": "C0000/AA",
        "name": "제조업 BSI 업황실적 (Doc29 §2.2)",
        "freq": "M",
    },
    "export_value": {
        "stat_code": "901Y118",
        "item_code": "T002",
        "name": "통관기준 수출액 (천불, Doc29 §2.5)",
        "freq": "M",
    },
    # NOTE: Intentional cross-validation with download_kosis.py ipi_all (DT_1C8016/B0201).
    # Same underlying series, different API pipelines — discrepancy = data quality alert.
    "ipi": {
        "stat_code": "901Y033",
        "item_code": "A00/2",
        "name": "산업생산지수 전산업 계절조정 (Doc30 §2)",
        "freq": "M",
    },
    "foreign_equity": {
        "stat_code": "301Y013",
        "item_code": "BOPF22100000",
        "name": "외인 주식투자 순유입 (백만불, Doc29 §5.2)",
        "freq": "M",
    },
    # ── Phase 2: 6 추가 시리즈 ──
    "cd_rate_91d": {
        "stat_code": "721Y001",
        "item_code": "2010000",
        "name": "CD금리 91일 (월별금리)",
        "freq": "M",
    },
    # NOTE: Intentional cross-validation with download_kosis.py cp_yield_kosis (DT_1C8016/C0305).
    # ECOS = 721Y001 시장금리 테이블, KOSIS = DT_1C8016 후행지표 — same rate, different pipeline.
    "cp_rate_91d": {
        "stat_code": "721Y001",
        "item_code": "4020000",
        "name": "CP금리 91일 (월별금리)",
        "freq": "M",
    },
    "household_credit": {
        "stat_code": "151Y002",
        "item_code": "1110000",
        "name": "가계대출 예금취급기관 (십억원, 월별)",
        "freq": "M",
    },
    # capacity_util: 901Y068은 농어가 테이블 — 설비가동률은 ECOS에 없음 (통계청 KOSIS 전용)
    "unemployment_rate": {
        "stat_code": "901Y027",
        "item_code": "I61BC",
        "name": "실업률 (원계열+계절조정 반환, 날짜 중복제거로 계절조정 사용)",
        "freq": "M",
    },
    "house_price_idx": {
        "stat_code": "901Y064",
        "item_code": "P65A",
        "name": "주택매매가격 종합지수 (전국)",
        "freq": "M",
    },
}

# ── FRED 시리즈 (VIX는 FDR/yfinance에서 수집 — API키 불필요) ──
FRED_SERIES = {
    "fed_rate": {"series_id": "FEDFUNDS", "name": "Federal Funds Rate"},
    "us10y": {"series_id": "DGS10", "name": "US 10Y Treasury"},
    # ── Phase 1-B: 6 확장 시리즈 (Doc28 교차시장, Doc30 IS-LM, Doc34 VRP) ──
    "us_cpi": {"series_id": "CPIAUCSL", "name": "US CPI (SA, Doc30 §2 real rate)"},
    "us_unemp": {"series_id": "UNRATE", "name": "US Unemployment (Doc30 §3 Phillips Curve)"},
    "us_breakeven": {"series_id": "T10YIE", "name": "US 10Y Breakeven Inflation"},
    "us_hy_spread": {"series_id": "BAMLH0A0HYM2", "name": "US HY Spread (Doc28 §5 risk appetite)"},
    "dxy_fred": {"series_id": "DTWEXBGS", "name": "Trade-Weighted USD (Doc28 §3 official DXY)"},
    "vix_fred": {"series_id": "VIXCLS", "name": "VIX Daily Close (FRED backup)"},
}

# ── OECD CLI 국가코드 ──
OECD_CLI_COUNTRIES = {
    "korea_cli": "KOR",
    "china_cli": "CHN",
    "us_cli": "USA",
}

# ── UIP 가중치 (Doc30 Mundell-Fleming / agent-memory P1 UIP 모델) ──
UIP_W_VIX = 0.45
UIP_W_RATE = 0.30
UIP_W_DXY = 0.25

# ── MCS v2 가중치 (Doc30 §4.3 Macro Context Score v2) ──
# MCS_v2 = 0.225*PMI + 0.180*CSI + 0.225*export + 0.135*yield + 0.135*EPU_inv + 0.100*Taylor_gap
# v1→v2: 기존 5개 비례 축소 + Taylor gap(#142 w6=0.10) 추가
MCS_W = {"pmi": 0.225, "csi": 0.180, "export": 0.225, "yield_curve": 0.135, "epu_inv": 0.135, "taylor_gap": 0.100}
_mcs_w_sum = sum(MCS_W.values())
if abs(_mcs_w_sum - 1.0) > 0.001:
    print(f'[MACRO][WARN] MCS_W sum={_mcs_w_sum:.4f}, expected 1.0')

# [STAT-B] Inertial Taylor Rule — Woodford (2003), Clarida-Galí-Gertler (1999)
# Central banks smooth rate changes: i_t = ρ*i_{t-1} + (1-ρ)*i_taylor
# BOK empirical ρ ≈ 0.8 (Shin & Kim, 2014, BOK Working Paper)
TAYLOR_RHO = 0.8  # interest rate smoothing parameter (#167)

# ── FF3 상수 — Fama & French (1993), "Common risk factors in the returns of stocks and bonds" ──
FF3_SIZE_BREAKPOINT = 0.50       # #168 median market cap split (50th percentile)
FF3_VALUE_BREAKPOINT_HIGH = 0.30  # #169 top 30% book-to-market → High (value)
FF3_VALUE_BREAKPOINT_LOW = 0.30   # #170 bottom 30% book-to-market → Low (growth)
FF3_REBALANCE_MONTH = 6           # #171 June rebalancing (Fama-French convention)
FF3_FACTORS_PATH = os.path.join(MACRO_DIR, "ff3_factors.json")
FF3_MIN_STOCKS = 100              # minimum universe size for meaningful factor construction

VERBOSE = False


def log(msg):
    print(f"[MACRO] {msg}")


def vlog(msg):
    if VERBOSE:
        print(f"[MACRO][v] {msg}")


def calc_taylor_implied_rate(pi, y_gap, r_star=1.0, pi_star=2.0, a_pi=0.50, a_y=0.50, a_e=0.1, delta_e=0.0):
    """Taylor Rule implied rate (Taylor 1993, Ball 1999 open-economy extension).

    i* = r* + pi + a_pi*(pi - pi*) + a_y*y_gap + a_e*delta_e

    [1-E#4] Ball (1999): a_e * delta_e adds exchange rate pass-through.
    a_e ≈ 0.1 (conservative for KRW — lower than commodity currencies).
    delta_e = YoY KRW/USD change rate (positive = depreciation = tightening).

    상수: r_star=#135, pi_star=#136, a_pi=#137, a_y=#138, a_e=#143 (Ball 1999)
    """
    return r_star + pi + a_pi * (pi - pi_star) + a_y * y_gap + a_e * delta_e


def _rate_limit():
    """API 호출 간 대기"""
    time.sleep(RATE_LIMIT)


# ══════════════════════════════════════════════════════
#  1. BOK ECOS API
# ══════════════════════════════════════════════════════

def fetch_ecos_series(api_key, stat_code, item_code, freq="M",
                      start_ym=None, end_ym=None, limit=100):
    """BOK ECOS API 시계열 조회

    Returns: list of {"date": "YYYY-MM", "value": float} or None
    """
    if not HAS_REQUESTS or not api_key:
        return None

    today = datetime.today()
    if end_ym is None:
        end_ym = today.strftime("%Y%m")
    if start_ym is None:
        start_dt = today - timedelta(days=365 * 2 + 90)
        start_ym = start_dt.strftime("%Y%m")

    # [C-10 FIX] URL-encode item_code to prevent '/' from being interpreted as path separator
    safe_item_code = urllib.parse.quote(item_code, safe='')
    url = (
        f"{ECOS_BASE}/StatisticSearch/{api_key}/json/kr/1/{limit}/"
        f"{stat_code}/{freq}/{start_ym}/{end_ym}/{safe_item_code}"
    )
    vlog(f"ECOS URL: {url}")

    try:
        r = requests.get(url, timeout=TIMEOUT)
        if r.status_code != 200:
            vlog(f"ECOS HTTP {r.status_code} for {stat_code}/{item_code}")
            return None
        data = r.json()

        # ECOS 에러 처리
        if "StatisticSearch" not in data:
            err = data.get("RESULT", {})
            code = err.get("CODE", "?")
            msg = err.get("MESSAGE", "알 수 없는 오류")
            vlog(f"ECOS error: {code} - {msg}")
            return None

        rows = data["StatisticSearch"].get("row", [])
        result = []
        for row in rows:
            time_str = row.get("TIME", "")
            val_str = row.get("DATA_VALUE", "")
            if not time_str or not val_str:
                continue
            try:
                val = float(val_str)
            except ValueError:
                continue
            # YYYYMM → YYYY-MM
            if len(time_str) == 6:
                date_fmt = f"{time_str[:4]}-{time_str[4:6]}"
            else:
                date_fmt = time_str
            result.append({"date": date_fmt, "value": val})

        # 날짜 중복 제거 — 같은 날짜에 여러 행(원계열/계절조정 등) 반환 시
        # 마지막 값(계절조정)만 유지
        if result:
            deduped = {}
            for r in result:
                deduped[r["date"]] = r["value"]
            result = [{"date": d, "value": v} for d, v in deduped.items()]

        return result if result else None

    except Exception as e:
        vlog(f"ECOS fetch error ({stat_code}): {e}")
        return None


def fetch_all_ecos(api_key):
    """ECOS에서 모든 시리즈 수집

    Returns: dict of {key: [{"date":..., "value":...}]}
    """
    results = {}
    for key, info in ECOS_SERIES.items():
        log(f"  ECOS: {info['name']} ({info['stat_code']})...")
        data = fetch_ecos_series(
            api_key,
            info["stat_code"],
            info["item_code"],
            freq=info["freq"],
        )
        if data:
            results[key] = data
            log(f"    -> {len(data)}개 데이터포인트 수집")
        else:
            log(f"    -> 수집 실패")
        _rate_limit()
    return results


# ══════════════════════════════════════════════════════
#  2. FRED API
# ══════════════════════════════════════════════════════

def fetch_fred_series(fred_key, series_id, limit=100):
    """FRED API 시계열 조회

    Returns: list of {"date": "YYYY-MM", "value": float} or None
    """
    if not HAS_REQUESTS or not fred_key:
        return None

    params = {
        "series_id": series_id,
        "api_key": fred_key,
        "file_type": "json",
        "sort_order": "desc",
        "limit": limit,
    }
    vlog(f"FRED: {series_id}")

    try:
        r = requests.get(FRED_BASE, params=params, timeout=TIMEOUT)
        if r.status_code != 200:
            vlog(f"FRED HTTP {r.status_code} for {series_id}")
            return None
        data = r.json()
        obs = data.get("observations", [])

        result = []
        seen_months = set()
        for o in obs:
            date_str = o.get("date", "")
            val_str = o.get("value", "")
            if not date_str or val_str == ".":
                continue
            try:
                val = float(val_str)
            except ValueError:
                continue
            # YYYY-MM-DD → YYYY-MM (월별 집계: 해당 월 마지막 값)
            month_key = date_str[:7]
            if month_key not in seen_months:
                seen_months.add(month_key)
                result.append({"date": month_key, "value": val})

        # desc → asc 정렬
        result.sort(key=lambda x: x["date"])
        return result if result else None

    except Exception as e:
        vlog(f"FRED fetch error ({series_id}): {e}")
        return None


def fetch_all_fred(fred_key):
    """FRED에서 모든 시리즈 수집"""
    results = {}
    for key, info in FRED_SERIES.items():
        log(f"  FRED: {info['name']} ({info['series_id']})...")
        data = fetch_fred_series(fred_key, info["series_id"])
        if data:
            results[key] = data
            log(f"    -> {len(data)}개 데이터포인트 수집")
        else:
            log(f"    -> 수집 실패")
        _rate_limit()
    return results


# ══════════════════════════════════════════════════════
#  3. OECD API (인증 불필요)
#
#  stats.oecd.org CSV 엔드포인트 사용
#  MEI_CLI dataset: LOLITOAA = CLI (amplitude adjusted)
#  MEASURE=LI (Leading Indicator), IX (Index), monthly
# ══════════════════════════════════════════════════════

OECD_STATS_BASE = "https://stats.oecd.org/sdmx-json/data"


def fetch_oecd_cli(country_code):
    """OECD stats.oecd.org → CLI (Composite Leading Indicator) for a country

    Uses CSV endpoint with MEI_CLI dataset.
    Filters for: MEASURE=LI, ADJUSTMENT=_Z, TRANSFORMATION=IX (index level)
    to get the amplitude-adjusted CLI centered on 100.

    Returns: list of {"date": "YYYY-MM", "value": float} or None
    """
    if not HAS_REQUESTS:
        return None

    today = datetime.today()
    start_year = today.year - 2
    url = (
        f"{OECD_STATS_BASE}/MEI_CLI/LOLITOAA.{country_code}.M/all"
        f"?startTime={start_year}-01&contentType=csv"
    )
    vlog(f"OECD URL: {url}")

    try:
        r = requests.get(url, timeout=TIMEOUT, headers={"Accept": "text/csv"})
        if r.status_code != 200:
            vlog(f"OECD HTTP {r.status_code}")
            return None

        lines = r.text.strip().split("\n")
        if len(lines) < 2:
            return None

        # CSV 헤더 파싱
        header = [h.strip().strip('"').strip('\r') for h in lines[0].split(",")]
        col_map = {name: i for i, name in enumerate(header)}

        # 필수 컬럼 검증 — OECD API 헤더 변경 감지
        expected_headers = {'TIME_PERIOD', 'OBS_VALUE'}
        actual_headers = set(col_map.keys())
        if not expected_headers.issubset(actual_headers):
            missing = expected_headers - actual_headers
            vlog(f"OECD CSV header change detected: missing {missing}, got {sorted(actual_headers)}")
            return None

        ref_area_idx = col_map.get("REF_AREA")
        measure_idx = col_map.get("MEASURE")
        adjustment_idx = col_map.get("ADJUSTMENT")
        transform_idx = col_map.get("TRANSFORMATION")
        time_idx = col_map["TIME_PERIOD"]
        val_idx = col_map["OBS_VALUE"]

        # 국가 + MEASURE=LI + TRANSFORMATION=IX 필터링
        # LI = Leading Indicator (amplitude-adjusted CLI)
        # IX = Index level (100 = trend)
        # 값이 ~95-105 범위인 것이 정규화된 CLI
        result = []
        seen_dates = {}

        for line in lines[1:]:
            cols = line.split(",")
            if len(cols) <= max(time_idx, val_idx):
                continue

            ref_area = cols[ref_area_idx].strip() if ref_area_idx is not None else ""
            measure = cols[measure_idx].strip() if measure_idx is not None else ""
            transform = cols[transform_idx].strip() if transform_idx is not None else ""
            date_str = cols[time_idx].strip().strip('"')
            val_str = cols[val_idx].strip().strip('"')

            # 필터: 해당 국가, LI (Leading Indicator), IX (Index)
            if ref_area != country_code:
                continue
            if measure != "LI":
                continue
            if transform != "IX":
                continue

            # 월별 데이터만 (YYYY-MM 형식, 분기 제외)
            if len(date_str) != 7 or "Q" in date_str:
                continue

            try:
                val = float(val_str)
            except (ValueError, TypeError):
                continue

            # 정규화된 CLI는 ~95-105 범위 (trend-normalized)
            # 절대 수준 CLI (~120+)는 제외
            if val > 110 or val < 80:
                continue

            # 같은 날짜에 여러 값이 있으면 마지막 값 사용
            seen_dates[date_str] = val

        result = [
            {"date": d, "value": round(v, 4)}
            for d, v in sorted(seen_dates.items())
        ]
        return result if result else None

    except Exception as e:
        vlog(f"OECD fetch error ({country_code}): {e}")
        return None


def fetch_all_oecd():
    """OECD에서 한/중/미 CLI 수집"""
    results = {}
    for key, country in OECD_CLI_COUNTRIES.items():
        log(f"  OECD: {country} CLI...")
        data = fetch_oecd_cli(country)
        if data:
            # 최근 30개월만 유지 (OECD는 전체 이력 반환)
            data = data[-30:]
            results[key] = data
            latest = data[-1]["value"] if data else "?"
            log(f"    -> {len(data)}개월 수집 (최신: {latest})")
        else:
            log(f"    -> 수집 실패")
        _rate_limit()
    return results


# ══════════════════════════════════════════════════════
#  4. 시장 데이터 (USD/KRW, DXY, VIX)
#
#  우선순위: FinanceDataReader → yfinance → 건너뜀
#  FinanceDataReader는 한국 개발 환경에서 더 안정적
# ══════════════════════════════════════════════════════

# FDR 심볼 → yfinance 심볼 매핑
MARKET_SERIES = {
    "usdkrw": {
        "fdr_sym": "USD/KRW",
        "yf_sym": "KRW=X",
        "name": "USD/KRW 환율",
    },
    "dxy": {
        "fdr_sym": "DX-Y.NYB",
        "yf_sym": "DX-Y.NYB",
        "name": "달러인덱스(DXY)",
    },
    "vix": {
        "fdr_sym": "VIX",
        "yf_sym": "^VIX",
        "name": "VIX 변동성지수",
    },
}


def _fdr_to_monthly(symbol, years=2):
    """FinanceDataReader → 월별 종가 시계열

    Returns: list of {"date": "YYYY-MM", "value": float} or None
    """
    if not HAS_FDR:
        return None

    try:
        start = (datetime.today() - timedelta(days=365 * years + 30)).strftime("%Y-%m-%d")
        df = fdr.DataReader(symbol, start)
        if df is None or df.empty:
            return None

        # 월말 리샘플링
        monthly = df.resample("M").last()
        result = []
        for idx, row in monthly.iterrows():
            close = row.get("Close")
            if close is None or (isinstance(close, float) and close != close):
                continue
            date_str = idx.strftime("%Y-%m")
            result.append({"date": date_str, "value": round(float(close), 2)})

        return result if result else None

    except Exception as e:
        vlog(f"FDR error ({symbol}): {e}")
        return None


def _yf_to_monthly(symbol, years=2):
    """yfinance → 월별 종가 시계열 (FDR 실패 시 fallback)

    Returns: list of {"date": "YYYY-MM", "value": float} or None
    """
    if not HAS_YFINANCE:
        return None

    try:
        tk = yf.Ticker(symbol)
        period = f"{years}y"
        hist = tk.history(period=period, interval="1mo")
        if hist.empty:
            hist = tk.history(period=period, interval="1d")
            if hist.empty:
                return None
            hist = hist.resample("M").last()

        result = []
        for idx, row in hist.iterrows():
            close = row.get("Close")
            if close is None or close != close:
                continue
            date_str = idx.strftime("%Y-%m")
            result.append({"date": date_str, "value": round(float(close), 2)})

        return result if result else None

    except Exception as e:
        vlog(f"yfinance error ({symbol}): {e}")
        return None


def fetch_all_market():
    """FDR/yfinance에서 환율/DXY/VIX 수집 (FDR 우선)"""
    results = {}
    for key, info in MARKET_SERIES.items():
        name = info["name"]
        log(f"  시장: {name}...")

        # 1차: FinanceDataReader
        data = _fdr_to_monthly(info["fdr_sym"])
        if data:
            results[key] = data
            log(f"    -> {len(data)}개 데이터포인트 수집 (FDR)")
            continue

        # 2차: yfinance fallback
        data = _yf_to_monthly(info["yf_sym"])
        if data:
            results[key] = data
            log(f"    -> {len(data)}개 데이터포인트 수집 (yfinance)")
            continue

        log(f"    -> 수집 실패")
    return results


# ══════════════════════════════════════════════════════
#  데이터 병합 및 파생지표 계산
# ══════════════════════════════════════════════════════

def _latest_value(series_data):
    """시계열에서 최신 값 추출"""
    if not series_data:
        return None
    return series_data[-1]["value"]


def _get_monthly_values(series_data, dates):
    """시계열을 dates 기준으로 정렬된 값 리스트로 변환

    dates: ["YYYY-MM", ...] 기준 날짜 리스트
    Returns: list of float|None (dates와 동일 길이)
    """
    if not series_data:
        return [None] * len(dates)

    lookup = {d["date"]: d["value"] for d in series_data}
    return [lookup.get(d) for d in dates]


def _calc_yoy(values):
    """전년동월비(YoY %) 계산

    Returns: float or None (최신값의 12개월 전 대비 변화율)
    """
    if not values or len(values) < 13:
        return None
    current = values[-1]
    prev_year = values[-13]
    if current is None or prev_year is None or prev_year == 0:
        return None
    return round((current - prev_year) / prev_year * 100, 2)


def _normalize_change(values, lookback=1):
    """최근 변화를 [-1, 1]로 정규화

    Args:
        values: 시계열 (시간순)
        lookback: 변화 기간 (월)

    Returns: float in [-1, 1] or None
    """
    if not values or len(values) < lookback + 1:
        return None
    current = values[-1]
    previous = values[-(lookback + 1)]
    if current is None or previous is None or previous == 0:
        return None

    delta = (current - previous) / abs(previous)
    # tanh로 [-1, 1] 압축 (극단값 방지)
    import math
    return round(math.tanh(delta * 5), 4)


def calc_foreigner_signal(all_data):
    """UIP 기반 외인 매수 시그널 계산

    foreigner_signal = w_vix*(-dVIX_norm) + w_rate*(rate_diff_norm) + w_dxy*(-dDXY_norm)

    rate_diff = bok_rate - fed_rate (한미 금리차)
    dVIX_norm = VIX 1개월 변화 정규화
    dDXY_norm = DXY 1개월 변화 정규화

    양(+)이면 외인 순매수 유리, 음(-)이면 순매도 유리
    """
    # VIX 변화
    vix_data = all_data.get("vix")
    vix_norm = None
    if vix_data and len(vix_data) >= 2:
        vix_values = [d["value"] for d in vix_data]
        vix_norm = _normalize_change(vix_values, lookback=1)

    # DXY 변화
    dxy_data = all_data.get("dxy")
    dxy_norm = None
    if dxy_data and len(dxy_data) >= 2:
        dxy_values = [d["value"] for d in dxy_data]
        dxy_norm = _normalize_change(dxy_values, lookback=1)

    # 한미 금리차
    bok = _latest_value(all_data.get("bok_rate"))
    fed = _latest_value(all_data.get("fed_rate"))
    rate_diff = None
    rate_diff_norm = None
    if bok is not None and fed is not None:
        rate_diff = round(bok - fed, 2)
        # 금리차를 [-1, 1]로 정규화 (historical range ~[-3, +3])
        import math
        rate_diff_norm = round(math.tanh(rate_diff / 2), 4)

    # 시그널 합성
    signal = None
    components_available = 0
    signal_sum = 0.0
    weight_sum = 0.0

    if vix_norm is not None:
        signal_sum += UIP_W_VIX * (-vix_norm)
        weight_sum += UIP_W_VIX
        components_available += 1

    if rate_diff_norm is not None:
        signal_sum += UIP_W_RATE * rate_diff_norm
        weight_sum += UIP_W_RATE
        components_available += 1

    if dxy_norm is not None:
        signal_sum += UIP_W_DXY * (-dxy_norm)
        weight_sum += UIP_W_DXY
        components_available += 1

    if weight_sum > 0:
        # 가용 가중치로 재정규화
        signal = round(signal_sum / weight_sum, 4)

    vlog(f"UIP components: vix_norm={vix_norm}, rate_diff={rate_diff}, "
         f"rate_diff_norm={rate_diff_norm}, dxy_norm={dxy_norm}")
    vlog(f"UIP signal: {signal} (components: {components_available}/3)")

    return signal, rate_diff


def classify_business_cycle(cli_series):
    """OECD 표준 4-phase 경기순환 분류기 — core_data/29 §1.2
    CLI(경기선행지수 순환변동치) 수준(vs 100) + 방향(delta)으로 4국면 판정.
    2개월 연속 확인으로 위상 전환 노이즈 방지."""
    if not cli_series or len(cli_series) < 3:
        return None

    # null 제거 후 최근 값 추출
    valid = [v for v in cli_series if v is not None]
    if len(valid) < 3:
        return None

    current = valid[-1]
    previous = valid[-2]
    prev2 = valid[-3]
    delta = current - previous
    delta_prev = previous - prev2
    above_trend = current > 100
    rising = delta > 0

    if above_trend and rising:          phase = "expansion"
    elif above_trend and not rising:    phase = "peak"
    elif not above_trend and not rising: phase = "contraction"
    else:                                phase = "trough"

    # 2개월 연속 확인 — 단일 delta 부호 반전 시 이전 국면 유지
    above_prev = previous > 100
    rising_prev = delta_prev > 0
    if above_prev and rising_prev:          prev_phase = "expansion"
    elif above_prev and not rising_prev:    prev_phase = "peak"
    elif not above_prev and not rising_prev: prev_phase = "contraction"
    else:                                    prev_phase = "trough"

    confirmed = (phase == prev_phase)

    # confidence: level distance (0~3 typ) + delta magnitude (0~0.3 typ)
    level_dist = abs(current - 100)
    delta_mag = abs(delta)
    confidence = min(1.0, (level_dist / 1.5) * 0.6 + (delta_mag / 0.15) * 0.4)

    # months_in_phase: 연속 동일 국면 개월 수
    months = 1
    for i in range(len(valid) - 2, 0, -1):
        d = valid[i] - valid[i - 1]
        ab = valid[i] > 100
        ri = d > 0
        if ab and ri:          p = "expansion"
        elif ab and not ri:    p = "peak"
        elif not ab and not ri: p = "contraction"
        else:                   p = "trough"
        if p == phase:
            months += 1
        else:
            break

    return {
        "phase": phase,
        "cli": round(current, 4),
        "delta": round(delta, 4),
        "confidence": round(confidence, 2),
        "confirmed": confirmed,
        "months_in_phase": months,
    }


def calc_mcs(all_data, latest):
    """Doc29 §6.2 — Macro Context Score (MCS)
    5개 거시 컴포넌트의 가중 합산으로 거시 레짐 판별.
    BSI는 0-200 스케일 (PMI 등가 = BSI/2).
    Graceful degradation: 컴포넌트 2개 미만 시 None 반환."""

    components = {}
    available = {}

    def _clip01(x):
        return max(0.0, min(1.0, x))

    # 1. PMI_norm — BSI 제조업경기실사지수 (0-200, PMI equiv = BSI/2)
    #    MCS v2: (PMI - 35) / 30, clipped [0,1]  — widened from (PMI-45)/10
    #    BSI=70(약세)→PMI=35→0.0, BSI=100(중립)→PMI=50→0.5, BSI=130(강세)→PMI=65→1.0
    #    상수 #143=35(low), #144=30(range)
    bsi = latest.get("bsi_mfg")
    if bsi is not None:
        pmi_equiv = bsi / 2.0  # BSI 0-200 → PMI 0-100 scale
        components["pmi"] = _clip01((pmi_equiv - 35) / 30)
        available["pmi"] = True
    else:
        available["pmi"] = False
    vlog(f"MCS pmi: bsi={bsi}, norm={components.get('pmi')}")

    # 2. CSI_norm — 소비자심리지수 (Consumer Sentiment Index)
    #    Doc29: (CSI - 80) / 40, clipped [0,1]
    #    Primary: latest dict, Fallback: data/market_context.json
    csi = latest.get("ccsi")  # ECOS CCSI if available
    if csi is None:
        # fallback 1: market_context.json
        mc_path = os.path.join(DATA_DIR, "market_context.json")
        if os.path.exists(mc_path):
            try:
                with open(mc_path, "r", encoding="utf-8") as f:
                    mc = json.load(f)
                csi = mc.get("ccsi") or mc.get("csi")
                if csi is not None:
                    vlog(f"MCS csi: market_context.json fallback csi={csi}")
            except Exception:
                pass
    if csi is None:
        # fallback 2: KOSIS ESI (경제심리지수, 100=neutral, same scale as CSI)
        kosis_path = os.path.join(DATA_DIR, "macro", "kosis_latest.json")
        if os.path.exists(kosis_path):
            try:
                with open(kosis_path, "r", encoding="utf-8") as f:
                    kosis = json.load(f)
                esi = kosis.get("esi")
                if esi is not None:
                    csi = esi
                    vlog(f"MCS csi: KOSIS ESI fallback csi={csi}")
            except Exception:
                pass
    if csi is not None:
        components["csi"] = _clip01((csi - 80) / 40)
        available["csi"] = True
    else:
        available["csi"] = False
    vlog(f"MCS csi: csi={csi}, norm={components.get('csi')}")

    # 3. export_norm — 수출 YoY (%)
    #    Doc29: (exp_g + 20) / 40, clipped [0,1]
    exp_yoy = latest.get("export_yoy")
    if exp_yoy is not None:
        components["export"] = _clip01((exp_yoy + 20) / 40)
        available["export"] = True
    else:
        available["export"] = False
    vlog(f"MCS export: yoy={exp_yoy}, norm={components.get('export')}")

    # 4. yield_curve_norm — 장단기 스프레드 (term_spread, %p 단위)
    #    Doc29: (spread_bp + 50) / 150, clipped [0,1]
    #    term_spread는 %p → bp 변환 (×100)
    spread = latest.get("term_spread")
    if spread is not None:
        spread_bp = spread * 100  # %p → bp
        components["yield_curve"] = _clip01((spread_bp + 50) / 150)
        available["yield_curve"] = True
    else:
        available["yield_curve"] = False
    vlog(f"MCS yield: spread={spread}, bp={spread * 100 if spread else None}, norm={components.get('yield_curve')}")

    # 5. EPU_inv_norm — 경제정책불확실성 역수 (VIX as proxy)
    #    Doc29: 1 - (EPU - 50) / 150, clipped [0,1]
    #    VIX proxy: 1 - (VIX - 12) / 28, clipped [0,1]
    vix = latest.get("vix")
    if vix is not None:
        components["epu_inv"] = _clip01(1.0 - (vix - 12) / 28)
        available["epu_inv"] = True
    else:
        available["epu_inv"] = False
    vlog(f"MCS epu_inv: vix={vix}, norm={components.get('epu_inv')}")

    # 6. Taylor_gap_norm — 테일러 갭 정규화 (Doc30 §4.3, 상수 #135-#142, #167 TAYLOR_RHO)
    #    Taylor Rule: i* = r* + pi + a_pi*(pi-pi*) + a_y*output_gap + a_e*delta_e
    #    Inertial smoothing: i_inertial = ρ*bok_rate + (1-ρ)*i_taylor (Woodford 2003)
    #    Taylor gap = bok_rate - i_inertial (bp)
    #    [1-E#16] Sign convention: positive gap = hawkish (actual > implied) = BAD for stocks
    #    MCS is "higher = better for stocks", so we INVERT the gap:
    #    Normalized: clip((-gap_bp + 100) / 200, 0, 1)
    #    gap=+100bp(극긴축)→0.0, gap=0(중립)→0.5, gap=-100bp(극완화)→1.0
    bok_r = latest.get("bok_rate")
    cpi_yoy_val = latest.get("cpi_yoy")
    cli_val = latest.get("korea_cli")
    if bok_r is not None and cpi_yoy_val is not None:
        output_gap = (cli_val - 100) * 0.5 if cli_val is not None else 0  # #139 CLI_TO_GAP_SCALE
        # [1-E#4] Ball (1999) exchange rate term — defaults to 0 until pipeline provides data
        exchange_rate_change = latest.get('exchange_rate_yoy', 0.0) or 0.0
        i_taylor = calc_taylor_implied_rate(
            pi=cpi_yoy_val, y_gap=output_gap, delta_e=exchange_rate_change
        )
        # [STAT-B] Inertial smoothing — Woodford (2003), Clarida-Galí-Gertler (1999)
        # i_inertial = ρ*i_{t-1} + (1-ρ)*i_taylor, using bok_rate as i_{t-1}
        i_inertial = TAYLOR_RHO * bok_r + (1 - TAYLOR_RHO) * i_taylor
        taylor_gap_bp = (bok_r - i_inertial) * 100  # %p → bp
        # [1-E#16] INVERTED: hawkish (positive gap) → low norm → reduces MCS (bad for stocks)
        components["taylor_gap"] = _clip01((-taylor_gap_bp + 100) / 200)
        available["taylor_gap"] = True
        vlog(f"MCS taylor: i*={i_taylor:.2f}, i_inertial={i_inertial:.2f}, gap={bok_r - i_inertial:.2f}%p, norm={components['taylor_gap']:.4f}")
    else:
        available["taylor_gap"] = False

    # -- 가중 합산 (graceful degradation: 가용 컴포넌트만 재정규화) --
    n_avail = sum(1 for v in available.values() if v)
    if n_avail < 2:
        vlog(f"MCS: 가용 컴포넌트 {n_avail}개 < 2 — None 반환")
        return None

    weight_sum = 0.0
    score_sum = 0.0
    for key, norm in components.items():
        w = MCS_W[key]
        weight_sum += w
        score_sum += w * norm

    mcs = round(score_sum / weight_sum, 4) if weight_sum > 0 else None

    def _r4(v):
        return round(v, 4) if v is not None else None

    result = {
        "mcs": mcs,
        "components": {
            "pmi_norm": _r4(components.get("pmi")),
            "csi_norm": _r4(components.get("csi")),
            "export_norm": _r4(components.get("export")),
            "yield_norm": _r4(components.get("yield_curve")),
            "epu_inv_norm": _r4(components.get("epu_inv")),
            "taylor_gap_norm": _r4(components.get("taylor_gap")),
            "available": n_avail,
            "total": 6,
        }
    }

    vlog(f"MCS v2 = {mcs} ({n_avail}/6 components)")
    return result


def build_latest(all_data):
    """macro_latest.json 구성"""
    today = datetime.today().strftime("%Y-%m-%d")

    ktb10y = _latest_value(all_data.get("ktb10y"))
    ktb3y = _latest_value(all_data.get("ktb3y"))
    term_spread = None
    if ktb10y is not None and ktb3y is not None:
        term_spread = round(ktb10y - ktb3y, 2)

    foreigner_signal, rate_diff = calc_foreigner_signal(all_data)

    # M2 YoY
    m2_data = all_data.get("m2")
    m2_yoy = None
    if m2_data and len(m2_data) >= 13:
        m2_values = [d["value"] for d in m2_data]
        m2_yoy = _calc_yoy(m2_values)

    # CPI YoY
    cpi_data = all_data.get("cpi")
    cpi_yoy = None
    if cpi_data and len(cpi_data) >= 13:
        cpi_values = [d["value"] for d in cpi_data]
        cpi_yoy = _calc_yoy(cpi_values)

    # Export YoY (수출 전년동월비)
    export_data = all_data.get("export_value")
    export_yoy = None
    if export_data and len(export_data) >= 13:
        export_vals = [d["value"] for d in export_data]
        export_yoy = _calc_yoy(export_vals)

    # IPI (산업생산지수 최신값)
    ipi_latest = _latest_value(all_data.get("ipi"))

    latest = {
        "updated": today,
        "ktb10y": ktb10y,
        "ktb3y": ktb3y,
        "term_spread": term_spread,
        "bok_rate": _latest_value(all_data.get("bok_rate")),
        "fed_rate": _latest_value(all_data.get("fed_rate")),
        "rate_diff": rate_diff,
        "vix": _latest_value(all_data.get("vix")),
        "dxy": _latest_value(all_data.get("dxy")),
        "usdkrw": _latest_value(all_data.get("usdkrw")),
        "korea_cli": _latest_value(all_data.get("korea_cli")),
        "china_cli": _latest_value(all_data.get("china_cli")),
        "us_cli": _latest_value(all_data.get("us_cli")),
        "m2_yoy": m2_yoy,
        "cpi_yoy": cpi_yoy,
        "foreigner_signal": foreigner_signal,
        # Phase ECOS-3: 4 CRITICAL series
        "bsi_mfg": _latest_value(all_data.get("bsi_mfg")),
        "export_yoy": export_yoy,
        "ipi": ipi_latest,
        "foreign_equity": _latest_value(all_data.get("foreign_equity")),
        # Phase 2: 6 추가 시리즈
        "cd_rate_91d": _latest_value(all_data.get("cd_rate_91d")),
        "cp_rate_91d": _latest_value(all_data.get("cp_rate_91d")),
        "household_credit": _latest_value(all_data.get("household_credit")),
        # capacity_util 제거 — ECOS에 없음 (통계청 KOSIS 전용)
        "unemployment_rate": _latest_value(all_data.get("unemployment_rate")),
        "house_price_idx": _latest_value(all_data.get("house_price_idx")),
        # Phase 1-B: FRED 확장 6 시리즈 (Doc28,30,34)
        "us_cpi": _latest_value(all_data.get("us_cpi")),
        "us_unemp": _latest_value(all_data.get("us_unemp")),
        "us_breakeven": _latest_value(all_data.get("us_breakeven")),
        "us_hy_spread": _latest_value(all_data.get("us_hy_spread")),
        "cycle_phase": classify_business_cycle(
            [d["value"] for d in all_data.get("korea_cli", []) if d.get("value") is not None]
            if all_data.get("korea_cli") else None
        ),
    }

    # Phase 2: CD-국고채3Y 스프레드 (신용 스프레드 프록시)
    cd_val = latest.get("cd_rate_91d")
    ktb3y_val = latest.get("ktb3y")
    latest["cd_ktb3y_spread"] = round(cd_val - ktb3y_val, 2) if (cd_val is not None and ktb3y_val is not None) else None

    # Phase 1-B: 실질금리 파생 필드 (Doc30 Mundell-Fleming)
    fed_r = latest.get("fed_rate")
    bok_r = latest.get("bok_rate")
    us_cpi_latest = latest.get("us_cpi")
    kr_cpi_yoy = latest.get("cpi_yoy")
    # US CPI는 지수(index)로 제공 — YoY 계산 필요
    us_cpi_data = all_data.get("us_cpi")
    us_cpi_yoy = None
    if us_cpi_data and len(us_cpi_data) >= 13:
        us_cpi_yoy = _calc_yoy([d["value"] for d in us_cpi_data])
    latest["us_cpi_yoy"] = us_cpi_yoy
    # 실질금리: nominal - inflation
    us_real = round(fed_r - us_cpi_yoy, 2) if (fed_r is not None and us_cpi_yoy is not None) else None
    kr_real = round(bok_r - kr_cpi_yoy, 2) if (bok_r is not None and kr_cpi_yoy is not None) else None
    latest["us_real_rate"] = us_real
    latest["kr_real_rate"] = kr_real
    latest["real_rate_diff"] = round(kr_real - us_real, 2) if (kr_real is not None and us_real is not None) else None

    # None 값은 유지하되, 소수점 정리
    for k, v in latest.items():
        if isinstance(v, float):
            latest[k] = round(v, 4) if k == "foreigner_signal" else round(v, 2)

    # -- Taylor Rule Gap (Doc30 §4.1, 상수 #135-#138, #143 Ball 1999, #167 TAYLOR_RHO) --
    # [1-E#20] DRY: uses calc_taylor_implied_rate() helper
    # [STAT-B] Inertial smoothing: i_inertial = ρ*bok_rate + (1-ρ)*i_taylor (Woodford 2003)
    bok_rate_val = latest.get("bok_rate")
    cpi_yoy_val = latest.get("cpi_yoy")
    cli_val = latest.get("korea_cli")
    if bok_rate_val is not None and cpi_yoy_val is not None:
        output_gap = (cli_val - 100) * 0.5 if cli_val is not None else 0  # #139
        exchange_rate_change = latest.get('exchange_rate_yoy', 0.0) or 0.0
        i_taylor = calc_taylor_implied_rate(
            pi=cpi_yoy_val, y_gap=output_gap, delta_e=exchange_rate_change
        )
        # Inertial smoothing — gap is vs smoothed target, not raw Taylor
        i_inertial = TAYLOR_RHO * bok_rate_val + (1 - TAYLOR_RHO) * i_taylor
        latest["taylor_implied_rate"] = round(i_taylor, 4)
        latest["taylor_inertial_rate"] = round(i_inertial, 4)
        latest["taylor_gap"] = round(bok_rate_val - i_inertial, 4)  # %p, positive=hawkish
    else:
        latest["taylor_implied_rate"] = None
        latest["taylor_inertial_rate"] = None
        latest["taylor_gap"] = None

    # -- MCS v2 (Doc30 §4.3) — latest dict 완성 후 계산 --
    mcs_result = calc_mcs(all_data, latest)
    latest["mcs"] = mcs_result["mcs"] if mcs_result else None
    latest["mcs_components"] = mcs_result["components"] if mcs_result else None

    # ── 데이터 품질 검증 (범위 이상 경고) ──
    _RANGE_CHECKS = {
        "cpi_yoy":           (-5, 30,    "CPI YoY (%) — 디플레/하이퍼인플레 범위 이탈"),
        "korea_cli":         (80, 120,   "OECD CLI — 정상 범위 80~120 (trend=100)"),
        "bok_rate":          (-1, 15,    "한은 기준금리 — 역사적 범위"),
        "unemployment_rate": (0.5, 15,   "실업률 — 한국 역사적 범위"),
        "vix":               (5, 90,     "VIX — 사상 최고 89.5 (2020.03)"),
        "usdkrw":            (800, 2000, "USD/KRW — 역사적 범위"),
        "bsi_mfg":           (20, 180,   "BSI 제조업 — 0~200 스케일"),
    }
    for key, (lo, hi, desc) in _RANGE_CHECKS.items():
        val = latest.get(key)
        if val is not None and (val < lo or val > hi):
            log(f"[WARN] {key}={val} 범위 이탈 [{lo}, {hi}] — {desc}")
            # 경고만, None 처리하지 않음 (극단적 시장 환경에서 정당한 값일 수 있음)

    return latest


def build_history(all_data):
    """macro_history.json 구성 — 공통 날짜 축 기준 2년 월별 시계열"""
    # 모든 시리즈에서 날짜 합집합 수집
    all_dates = set()
    for key, series in all_data.items():
        if series:
            for d in series:
                all_dates.add(d["date"])

    if not all_dates:
        return {"dates": [], "message": "데이터 없음"}

    # 최근 24개월로 제한
    sorted_dates = sorted(all_dates)
    if len(sorted_dates) > 24:
        sorted_dates = sorted_dates[-24:]

    history = {"dates": sorted_dates}

    # 각 시리즈를 날짜 축에 맞춤
    series_keys = [
        "ktb10y", "ktb3y", "bok_rate", "fed_rate", "vix", "dxy",
        "usdkrw", "korea_cli", "china_cli", "us_cli", "m2", "cpi",
        "cli",  # ECOS CLI
        "bsi_mfg", "export_value", "ipi", "foreign_equity",  # Phase ECOS-3
        "cd_rate_91d", "cp_rate_91d", "household_credit",  # Phase 2
        "unemployment_rate", "house_price_idx",  # Phase 2 (capacity_util 제거)
        "us_cpi", "us_unemp", "us_breakeven", "us_hy_spread",  # Phase 1-B FRED 확장
    ]

    for key in series_keys:
        series = all_data.get(key)
        if series:
            values = _get_monthly_values(series, sorted_dates)
            history[key] = values

    # 파생 시계열 계산
    # term_spread
    if "ktb10y" in history and "ktb3y" in history:
        history["term_spread"] = [
            round(a - b, 2) if a is not None and b is not None else None
            for a, b in zip(history["ktb10y"], history["ktb3y"])
        ]

    # rate_diff (한미 금리차)
    if "bok_rate" in history and "fed_rate" in history:
        history["rate_diff"] = [
            round(a - b, 2) if a is not None and b is not None else None
            for a, b in zip(history["bok_rate"], history["fed_rate"])
        ]

    # cd_ktb3y_spread (CD-국고채3Y 신용 스프레드)
    if "cd_rate_91d" in history and "ktb3y" in history:
        history["cd_ktb3y_spread"] = [
            round(a - b, 2) if a is not None and b is not None else None
            for a, b in zip(history["cd_rate_91d"], history["ktb3y"])
        ]

    return history


# ══════════════════════════════════════════════════════
#  오프라인 모드 (기존 데이터 로드)
# ══════════════════════════════════════════════════════

def load_existing_history():
    """기존 macro_history.json 로드"""
    if os.path.exists(HISTORY_PATH):
        with open(HISTORY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def offline_rebuild():
    """기존 history에서 latest 재생성"""
    history = load_existing_history()
    if not history or not history.get("dates"):
        log("오프라인 모드: 기존 macro_history.json 없음 — 빈 파일 생성")
        return {}, {}

    log("오프라인 모드: 기존 macro_history.json에서 재생성")
    dates = history["dates"]

    # history → all_data 형식으로 변환
    all_data = {}
    for key in history:
        if key == "dates":
            continue
        values = history[key]
        if not isinstance(values, list):
            continue
        series = []
        for i, v in enumerate(values):
            if v is not None and i < len(dates):
                series.append({"date": dates[i], "value": v})
        if series:
            all_data[key] = series

    latest = build_latest(all_data)
    return latest, history


# ══════════════════════════════════════════════════════
#  저장
# ══════════════════════════════════════════════════════

def save_json(data, path, label):
    """JSON 파일 저장"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log(f"저장 완료: {path}")


# ══════════════════════════════════════════════════════
#  [STAT-A] Korean FF3 Factor Construction
#  Fama & French (1993), "Common risk factors in the
#  returns of stocks and bonds", JFE 33(1), 3-56.
#
#  2×3 size/value sort:
#    Size:  median market cap → Small (S) / Big (B)
#    Value: Book-to-Market top 30% (H) / mid 40% (M) / bottom 30% (L)
#
#  Factor returns (value-weighted):
#    SMB = 1/3*(S/H + S/M + S/L) - 1/3*(B/H + B/M + B/L)
#    HML = 1/2*(S/H + B/H) - 1/2*(S/L + B/L)
#    MKT_RF = VW market return - Rf
#
#  Rf: CD 91-day rate / 252 (daily), from macro_latest.json
#  Rebalancing: annual at June end (constant #171)
# ══════════════════════════════════════════════════════

def _load_ff3_universe():
    """Load stock universe with marketCap and book equity for FF3 construction.

    Returns: list of dicts with keys: code, market, marketCap_억, book_equity_krw, bm_ratio
             or empty list on failure.

    marketCap from index.json is in 억원.
    book_equity (total_equity) from financials/*.json is in raw KRW.
    B/M ratio = total_equity / (marketCap * 1e8)
    """
    index_path = os.path.join(DATA_DIR, "index.json")
    fin_dir = os.path.join(DATA_DIR, "financials")

    if not os.path.exists(index_path):
        log("[FF3] data/index.json 없음 — 건너뜀")
        return []

    try:
        with open(index_path, "r", encoding="utf-8") as f:
            idx = json.load(f)
    except Exception as e:
        log(f"[FF3] index.json 로드 실패: {e}")
        return []

    stocks = idx.get("stocks", [])
    if not stocks:
        log("[FF3] index.json에 stocks 없음")
        return []

    universe = []
    skip_no_cap = 0
    skip_no_fin = 0
    skip_no_equity = 0
    skip_negative_bm = 0

    for s in stocks:
        code = s.get("code", "")
        market = s.get("market", "")
        mcap = s.get("marketCap")

        # marketCap must be positive
        if not mcap or mcap <= 0:
            skip_no_cap += 1
            continue

        # Load financials for book equity
        fin_path = os.path.join(fin_dir, f"{code}.json")
        if not os.path.exists(fin_path):
            skip_no_fin += 1
            continue

        try:
            with open(fin_path, "r", encoding="utf-8") as f:
                fin = json.load(f)
        except Exception:
            skip_no_fin += 1
            continue

        # Only trust DART data — seed data must not be used (Data Trust Rules)
        source = fin.get("source", "")
        if source == "seed":
            skip_no_fin += 1
            continue

        # Get most recent annual total_equity
        annual = fin.get("annual", [])
        if not annual:
            skip_no_equity += 1
            continue

        # Use most recent period's total_equity
        total_equity = None
        for period in reversed(annual):
            te = period.get("total_equity")
            if te is not None and te > 0:
                total_equity = te
                break

        if total_equity is None or total_equity <= 0:
            skip_no_equity += 1
            continue

        # B/M = total_equity(KRW) / marketCap(억원 * 1e8)
        # = total_equity / (mcap * 1e8)
        bm_ratio = total_equity / (mcap * 1e8)

        if bm_ratio <= 0:
            skip_negative_bm += 1
            continue

        universe.append({
            "code": code,
            "market": market,
            "marketCap": mcap,          # 억원
            "book_equity": total_equity,  # KRW
            "bm_ratio": bm_ratio,
        })

    vlog(f"[FF3] Universe: {len(universe)} stocks "
         f"(skip: no_cap={skip_no_cap}, no_fin={skip_no_fin}, "
         f"no_equity={skip_no_equity}, neg_bm={skip_negative_bm})")

    return universe


def _load_daily_closes(code, market):
    """Load daily close prices for a stock from OHLCV data.

    Returns: dict of {"YYYY-MM-DD": close_price} or empty dict.
    """
    market_dir = market.lower()  # "kospi" or "kosdaq"
    ohlcv_path = os.path.join(DATA_DIR, market_dir, f"{code}.json")

    if not os.path.exists(ohlcv_path):
        return {}

    try:
        with open(ohlcv_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return {}

    candles = data.get("candles", [])
    closes = {}
    for c in candles:
        t = c.get("time")
        cl = c.get("close")
        if t and cl and cl > 0:
            closes[t] = cl

    return closes


def _compute_daily_returns(closes_dict):
    """Compute simple daily returns from close prices.

    Args:
        closes_dict: {"YYYY-MM-DD": close_price}

    Returns: dict of {"YYYY-MM-DD": return} (first day has no return)
    """
    sorted_dates = sorted(closes_dict.keys())
    returns = {}
    for i in range(1, len(sorted_dates)):
        prev_close = closes_dict[sorted_dates[i - 1]]
        curr_close = closes_dict[sorted_dates[i]]
        if prev_close > 0:
            returns[sorted_dates[i]] = (curr_close - prev_close) / prev_close
    return returns


def _assign_ff3_portfolios(universe):
    """Assign each stock to one of the 6 FF3 portfolios (S/H, S/M, S/L, B/H, B/M, B/L).

    Uses 2×3 independent sort:
      - Size: median market cap → S or B
      - Value: B/M top 30% → H, bottom 30% → L, middle 40% → M

    Returns: dict mapping portfolio name to list of {code, market, marketCap}
    """
    n = len(universe)
    if n < FF3_MIN_STOCKS:
        log(f"[FF3] Universe too small ({n} < {FF3_MIN_STOCKS}) — 건너뜀")
        return {}

    # Sort by marketCap for size breakpoint
    caps = sorted([s["marketCap"] for s in universe])
    size_median_idx = int(len(caps) * FF3_SIZE_BREAKPOINT)
    size_breakpoint = caps[size_median_idx]

    # Sort by B/M for value breakpoints
    bms = sorted([s["bm_ratio"] for s in universe])
    n_low = int(len(bms) * FF3_VALUE_BREAKPOINT_LOW)
    n_high = int(len(bms) * (1.0 - FF3_VALUE_BREAKPOINT_HIGH))
    bm_low_breakpoint = bms[n_low] if n_low < len(bms) else bms[-1]
    bm_high_breakpoint = bms[n_high] if n_high < len(bms) else bms[-1]

    portfolios = {
        "SH": [], "SM": [], "SL": [],
        "BH": [], "BM": [], "BL": [],
    }

    for s in universe:
        # Size assignment
        is_small = s["marketCap"] <= size_breakpoint

        # Value assignment (B/M: high = value, low = growth)
        if s["bm_ratio"] >= bm_high_breakpoint:
            value_group = "H"
        elif s["bm_ratio"] <= bm_low_breakpoint:
            value_group = "L"
        else:
            value_group = "M"

        size_group = "S" if is_small else "B"
        portfolio_key = f"{size_group}{value_group}"
        portfolios[portfolio_key].append({
            "code": s["code"],
            "market": s["market"],
            "marketCap": s["marketCap"],
        })

    for pf, members in portfolios.items():
        vlog(f"[FF3] Portfolio {pf}: {len(members)} stocks")

    return portfolios


def _compute_portfolio_vw_return(members, all_returns, date):
    """Compute value-weighted return for a portfolio on a given date.

    Args:
        members: list of {code, market, marketCap}
        all_returns: dict of {code: {date: return}}
        date: "YYYY-MM-DD"

    Returns: float (value-weighted return) or None if insufficient data
    """
    total_weight = 0.0
    weighted_return = 0.0
    count = 0

    for m in members:
        code = m["code"]
        ret = all_returns.get(code, {}).get(date)
        if ret is not None:
            w = m["marketCap"]
            weighted_return += w * ret
            total_weight += w
            count += 1

    if total_weight <= 0 or count < 2:
        return None

    return weighted_return / total_weight


def build_ff3_factors():
    """Build Korean FF3 (Fama-French 3-Factor) daily factor returns.

    Methodology: Fama & French (1993), adapted for KOSPI+KOSDAQ.
    Uses current snapshot for portfolio assignment (equivalent to assuming
    we are within the June-to-May holding period).

    For a full rolling implementation, historical June snapshots would be
    needed — this version uses the latest available data as the single
    rebalancing point, which is appropriate for the most recent ~1 year.

    Output: data/macro/ff3_factors.json
    """
    log("[FF3] Fama-French 3-Factor 구성 시작...")

    # 1. Load universe
    universe = _load_ff3_universe()
    if len(universe) < FF3_MIN_STOCKS:
        log(f"[FF3] 유효 종목 {len(universe)}개 — 최소 {FF3_MIN_STOCKS}개 필요. 건너뜀.")
        return False

    log(f"[FF3] Universe: {len(universe)}개 종목 (KOSPI+KOSDAQ)")

    # 2. Assign portfolios
    portfolios = _assign_ff3_portfolios(universe)
    if not portfolios:
        return False

    # 3. Load daily close prices and compute returns for all stocks
    log("[FF3] OHLCV 로드 중 (전 종목)...")
    all_codes = set()
    for members in portfolios.values():
        for m in members:
            all_codes.add((m["code"], m["market"]))

    all_returns = {}  # code → {date: return}
    all_dates_set = set()
    loaded = 0
    for code, market in all_codes:
        closes = _load_daily_closes(code, market)
        if not closes:
            continue
        returns = _compute_daily_returns(closes)
        if returns:
            all_returns[code] = returns
            all_dates_set.update(returns.keys())
            loaded += 1

    log(f"[FF3] {loaded}/{len(all_codes)}개 종목 수익률 계산 완료")

    if not all_dates_set:
        log("[FF3] 수익률 데이터 없음 — 건너뜀")
        return False

    sorted_dates = sorted(all_dates_set)
    vlog(f"[FF3] Date range: {sorted_dates[0]} ~ {sorted_dates[-1]} ({len(sorted_dates)} days)")

    # 4. Load Rf (CD 91-day rate, annualized → daily)
    # Rf_daily = CD_rate(%) / 100 / 252
    rf_daily = 0.0  # default if unavailable
    if os.path.exists(LATEST_PATH):
        try:
            with open(LATEST_PATH, "r", encoding="utf-8") as f:
                macro_latest = json.load(f)
            cd_rate = macro_latest.get("cd_rate_91d")
            if cd_rate is not None and cd_rate > 0:
                rf_daily = cd_rate / 100.0 / 252.0
                vlog(f"[FF3] Rf daily = {rf_daily:.6f} (CD 91d = {cd_rate}%)")
        except Exception:
            pass

    if rf_daily == 0.0:
        log("[FF3] CD 91일 금리 없음 — Rf=0 사용 (factor spread에 영향 없음)")

    # 5. Compute daily factor returns
    log("[FF3] 일별 팩터 수익률 계산 중...")
    factor_dates = []
    smb_series = []
    hml_series = []
    mkt_rf_series = []

    # Pre-build market portfolio (all stocks) — used for MKT-RF
    all_universe_members = []
    for members in portfolios.values():
        all_universe_members.extend(members)

    for date in sorted_dates:
        # Portfolio value-weighted returns
        pf_returns = {}
        valid = True
        for pf_name in ["SH", "SM", "SL", "BH", "BM", "BL"]:
            r = _compute_portfolio_vw_return(portfolios[pf_name], all_returns, date)
            if r is None:
                valid = False
                break
            pf_returns[pf_name] = r

        if not valid:
            continue

        # SMB = 1/3*(S/H + S/M + S/L) - 1/3*(B/H + B/M + B/L)
        smb = (1.0 / 3.0) * (pf_returns["SH"] + pf_returns["SM"] + pf_returns["SL"]) \
            - (1.0 / 3.0) * (pf_returns["BH"] + pf_returns["BM"] + pf_returns["BL"])

        # HML = 1/2*(S/H + B/H) - 1/2*(S/L + B/L)
        hml = 0.5 * (pf_returns["SH"] + pf_returns["BH"]) \
            - 0.5 * (pf_returns["SL"] + pf_returns["BL"])

        # MKT-RF = VW market return - Rf
        mkt_return = _compute_portfolio_vw_return(all_universe_members, all_returns, date)
        if mkt_return is None:
            continue

        mkt_rf = mkt_return - rf_daily

        factor_dates.append(date)
        smb_series.append(round(smb, 6))
        hml_series.append(round(hml, 6))
        mkt_rf_series.append(round(mkt_rf, 6))

    if not factor_dates:
        log("[FF3] 유효 팩터 수익률 없음 — 건너뜀")
        return False

    # 6. Compute summary statistics
    import math

    def _stats(series):
        n = len(series)
        if n == 0:
            return {"mean": None, "std": None, "sharpe": None}
        mean = sum(series) / n
        var = sum((x - mean) ** 2 for x in series) / max(n - 1, 1)
        std = math.sqrt(var)
        # Annualized: mean*252, std*sqrt(252), Sharpe = mean*252 / (std*sqrt(252))
        ann_mean = mean * 252
        ann_std = std * math.sqrt(252)
        sharpe = ann_mean / ann_std if ann_std > 0 else None
        return {
            "daily_mean": round(mean, 6),
            "daily_std": round(std, 6),
            "ann_mean_pct": round(ann_mean * 100, 2),
            "ann_std_pct": round(ann_std * 100, 2),
            "sharpe": round(sharpe, 3) if sharpe is not None else None,
            "n_days": n,
        }

    # 7. Build output
    result = {
        "updated": datetime.today().strftime("%Y-%m-%d"),
        "methodology": "Fama-French (1993) 2x3 size/value sort",
        "universe_size": len(universe),
        "rebalance_month": FF3_REBALANCE_MONTH,
        "rf_daily": round(rf_daily, 8),
        "constants": {
            "size_breakpoint": FF3_SIZE_BREAKPOINT,
            "value_breakpoint_high": FF3_VALUE_BREAKPOINT_HIGH,
            "value_breakpoint_low": FF3_VALUE_BREAKPOINT_LOW,
        },
        "portfolio_counts": {pf: len(members) for pf, members in portfolios.items()},
        "date_range": {
            "start": factor_dates[0],
            "end": factor_dates[-1],
            "n_days": len(factor_dates),
        },
        "statistics": {
            "SMB": _stats(smb_series),
            "HML": _stats(hml_series),
            "MKT_RF": _stats(mkt_rf_series),
        },
        "daily": {
            "dates": factor_dates,
            "SMB": smb_series,
            "HML": hml_series,
            "MKT_RF": mkt_rf_series,
        },
    }

    # 8. Save
    save_json(result, FF3_FACTORS_PATH, "ff3_factors")

    # 9. Print summary
    log(f"[FF3] === Fama-French 3-Factor 결과 ===")
    log(f"[FF3]   기간: {factor_dates[0]} ~ {factor_dates[-1]} ({len(factor_dates)}일)")
    log(f"[FF3]   종목수: {len(universe)} (6 portfolios)")
    for pf, cnt in sorted(result["portfolio_counts"].items()):
        log(f"[FF3]     {pf}: {cnt}종목")

    for factor_name in ["SMB", "HML", "MKT_RF"]:
        st = result["statistics"][factor_name]
        sharpe_str = f"{st['sharpe']:.3f}" if st["sharpe"] is not None else "N/A"
        log(f"[FF3]   {factor_name:6s}: ann_mean={st['ann_mean_pct']:+.2f}%, "
            f"ann_std={st['ann_std_pct']:.2f}%, sharpe={sharpe_str}")

    return True


# ══════════════════════════════════════════════════════
#  요약 출력
# ══════════════════════════════════════════════════════

def print_summary(latest, source_stats):
    """수집 결과 요약"""
    log("")
    log("=" * 55)
    log("  수집 결과 요약")
    log("=" * 55)

    # 소스별 성공/실패
    for source, stats in source_stats.items():
        ok = stats.get("ok", 0)
        fail = stats.get("fail", 0)
        total = ok + fail
        status = "OK" if fail == 0 else f"일부 실패({fail}/{total})"
        log(f"  {source:12s}: {ok}/{total} 성공  [{status}]")

    log("-" * 55)

    # 핵심 지표 출력
    indicators = [
        ("기준금리(BOK)", "bok_rate", "%"),
        ("Fed Rate", "fed_rate", "%"),
        ("한미금리차", "rate_diff", "%p"),
        ("국고채10Y", "ktb10y", "%"),
        ("국고채3Y", "ktb3y", "%"),
        ("장단기스프레드", "term_spread", "%p"),
        ("VIX", "vix", ""),
        ("DXY", "dxy", ""),
        ("USD/KRW", "usdkrw", ""),
        ("한국CLI", "korea_cli", ""),
        ("중국CLI", "china_cli", ""),
        ("미국CLI", "us_cli", ""),
        ("M2 YoY", "m2_yoy", "%"),
        ("CPI YoY", "cpi_yoy", "%"),
        ("외인시그널", "foreigner_signal", ""),
        ("제조업BSI", "bsi_mfg", ""),
        ("수출YoY", "export_yoy", "%"),
        ("산업생산(IPI)", "ipi", ""),
        ("외인주식유입", "foreign_equity", "백만$"),
        # Phase 2
        ("CD금리91일", "cd_rate_91d", "%"),
        ("CP금리91일", "cp_rate_91d", "%"),
        ("CD-국고3Y", "cd_ktb3y_spread", "%p"),
        ("가계신용잔액", "household_credit", ""),
        # capacity_util 제거 — ECOS에 없음 (통계청 KOSIS 전용)
        ("실업률(SA)", "unemployment_rate", "%"),
        ("주택매매가격", "house_price_idx", ""),
        # Phase 1-B: FRED 확장
        ("US CPI(지수)", "us_cpi", ""),
        ("US CPI YoY", "us_cpi_yoy", "%"),
        ("US 실업률", "us_unemp", "%"),
        ("US BEI 10Y", "us_breakeven", "%"),
        ("US HY스프레드", "us_hy_spread", "%"),
        ("US실질금리", "us_real_rate", "%"),
        ("KR실질금리", "kr_real_rate", "%"),
        ("실질금리차", "real_rate_diff", "%p"),
    ]

    for label, key, unit in indicators:
        val = latest.get(key)
        if val is not None:
            log(f"  {label:16s}: {val}{unit}")
        else:
            log(f"  {label:16s}: (수집 실패)")

    # -- Taylor Rule Gap (Doc30 §4.1, #167 inertial smoothing) --
    log("-" * 55)
    tg = latest.get("taylor_gap")
    ti = latest.get("taylor_implied_rate")
    ti_inertial = latest.get("taylor_inertial_rate")
    if tg is not None and ti is not None:
        stance = "완화적(dovish)" if tg < -0.25 else ("긴축적(hawkish)" if tg > 0.25 else "중립")
        log(f"  {'Taylor i*':16s}: {ti:.2f}%")
        log(f"  {'Inertial i*':16s}: {ti_inertial:.2f}% (ρ={TAYLOR_RHO})")
        log(f"  {'Taylor gap':16s}: {tg:+.2f}%p ({stance})")
    else:
        log(f"  {'Taylor gap':16s}: (계산 불가)")

    # -- MCS v2 (Doc30 §4.3) --
    log("-" * 55)
    mcs = latest.get("mcs")
    mcs_comp = latest.get("mcs_components")
    if mcs is not None:
        regime = "강세" if mcs > 0.6 else ("약세" if mcs < 0.4 else "중립")
        log(f"  {'MCS v2':16s}: {mcs:.4f} ({regime})")
        if mcs_comp:
            avail = mcs_comp.get("available", 0)
            total = mcs_comp.get("total", 6)
            parts = []
            for k in ["pmi_norm", "csi_norm", "export_norm", "yield_norm", "epu_inv_norm", "taylor_gap_norm"]:
                v = mcs_comp.get(k)
                parts.append(f"{k}={'—' if v is None else f'{v:.3f}'}")
            log(f"  {'  components':16s}: {', '.join(parts)}")
            log(f"  {'  available':16s}: {avail}/{total}")
    else:
        log(f"  {'MCS v2':16s}: (계산 불가 — 컴포넌트 부족)")

    log("=" * 55)


# ══════════════════════════════════════════════════════
#  메인
# ══════════════════════════════════════════════════════

def main():
    global VERBOSE

    parser = argparse.ArgumentParser(
        description="거시경제 지표 다운로더 → data/macro/macro_latest.json, macro_history.json"
    )
    parser.add_argument(
        "--api-key", default="",
        help="BOK ECOS API 키 (https://ecos.bok.or.kr/api/#/DevGuide/userGuide)"
    )
    parser.add_argument(
        "--fred-key", default="",
        help="FRED API 키 (https://fred.stlouisfed.org/docs/api/api_key.html)"
    )
    parser.add_argument(
        "--offline", action="store_true",
        help="API 호출 없이 기존 데이터에서 재생성"
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="디버그 출력"
    )
    args = parser.parse_args()
    VERBOSE = args.verbose

    # .env 파일에서 API 키 자동 로드
    if not args.api_key or not args.fred_key:
        env_path = os.path.join(PROJECT_ROOT, ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if line.startswith("ECOS_API_KEY=") and not args.api_key:
                        args.api_key = line.split("=", 1)[1].strip()
                        log(".env에서 ECOS API 키 로드 완료")
                    elif line.startswith("FRED_API_KEY=") and not args.fred_key:
                        args.fred_key = line.split("=", 1)[1].strip()
                        log(".env에서 FRED API 키 로드 완료")

    log("거시경제 지표 수집 시작")
    log(f"  날짜: {datetime.today().strftime('%Y-%m-%d %H:%M')}")
    log(f"  출력: {MACRO_DIR}/")
    log("")

    # ── 오프라인 모드 ──
    if args.offline:
        latest, history = offline_rebuild()
        if latest:
            save_json(latest, LATEST_PATH, "latest")
        if history:
            save_json(history, HISTORY_PATH, "history")
        # FF3 uses local files only — safe to run offline
        source_stats = {"오프라인": {"ok": 1, "fail": 0}}
        try:
            ff3_ok = build_ff3_factors()
            source_stats["FF3"] = {"ok": 1 if ff3_ok else 0, "fail": 0 if ff3_ok else 1}
        except Exception as e:
            log(f"[FF3] 오류 발생: {e}")
            source_stats["FF3"] = {"ok": 0, "fail": 1}
        print_summary(latest, source_stats)
        return

    # ── 의존성 확인 ──
    if not HAS_REQUESTS:
        log("[경고] requests 미설치 — pip install requests")
        log("       ECOS/FRED/OECD API 사용 불가, yfinance만 시도")

    if not HAS_FDR and not HAS_YFINANCE:
        log("[참고] FinanceDataReader/yfinance 미설치")
        log("       USD/KRW, DXY, VIX 수집 불가")
        log("       pip install finance-datareader  (권장)")
    elif not HAS_FDR:
        log("[참고] FinanceDataReader 미설치, yfinance fallback 사용")

    # ── 데이터 수집 (각 소스 독립적) ──
    all_data = {}
    source_stats = {}

    # 1. BOK ECOS
    if args.api_key:
        log("[1/4] BOK ECOS API 수집 중...")
        ecos_data = fetch_all_ecos(args.api_key)
        ok = len(ecos_data)
        fail = len(ECOS_SERIES) - ok
        all_data.update(ecos_data)
        source_stats["ECOS"] = {"ok": ok, "fail": fail}
    else:
        log("[1/4] BOK ECOS API 건너뜀 (--api-key 미지정)")
        source_stats["ECOS"] = {"ok": 0, "fail": 0}

    # 2. FRED
    if args.fred_key:
        log("[2/4] FRED API 수집 중...")
        fred_data = fetch_all_fred(args.fred_key)
        ok = len(fred_data)
        fail = len(FRED_SERIES) - ok
        all_data.update(fred_data)
        source_stats["FRED"] = {"ok": ok, "fail": fail}
    else:
        log("[2/4] FRED API 건너뜀 (--fred-key 미지정)")
        source_stats["FRED"] = {"ok": 0, "fail": 0}

    # 3. OECD (인증 불필요)
    if HAS_REQUESTS:
        log("[3/4] OECD SDMX API 수집 중...")
        oecd_data = fetch_all_oecd()
        ok = len(oecd_data)
        fail = len(OECD_CLI_COUNTRIES) - ok
        all_data.update(oecd_data)
        source_stats["OECD"] = {"ok": ok, "fail": fail}
    else:
        log("[3/4] OECD API 건너뜀 (requests 미설치)")
        source_stats["OECD"] = {"ok": 0, "fail": 0}

    # 4. 시장 데이터 (FDR/yfinance)
    if HAS_FDR or HAS_YFINANCE:
        log("[4/4] 시장 데이터 수집 중 (FDR/yfinance)...")
        market_data = fetch_all_market()
        ok = len(market_data)
        fail = len(MARKET_SERIES) - ok
        all_data.update(market_data)
        source_stats["FDR/yfinance"] = {"ok": ok, "fail": fail}
    else:
        log("[4/4] 시장 데이터 건너뜀 (FDR/yfinance 미설치)")
        source_stats["FDR/yfinance"] = {"ok": 0, "fail": 0}

    # ── 기존 데이터와 병합 (부분 실패 시 보완) ──
    existing_history = load_existing_history()
    if existing_history and existing_history.get("dates"):
        dates = existing_history["dates"]
        for key in existing_history:
            if key == "dates":
                continue
            if key not in all_data and isinstance(existing_history[key], list):
                # 이번에 수집 실패한 시리즈는 기존 데이터 유지
                series = []
                for i, v in enumerate(existing_history[key]):
                    if v is not None and i < len(dates):
                        series.append({"date": dates[i], "value": v})
                if series:
                    all_data[key] = series
                    vlog(f"기존 데이터 보완: {key} ({len(series)}건)")

    # ── 결과 없으면 종료 ──
    if not all_data:
        log("")
        log("[완료] 수집된 데이터 없음. API 키를 확인하거나 --offline을 사용하세요.")
        log("  사용법: python scripts/download_macro.py --api-key ECOS_KEY --fred-key FRED_KEY")
        return

    # ── 파일 생성 ──
    os.makedirs(MACRO_DIR, exist_ok=True)

    latest = build_latest(all_data)
    save_json(latest, LATEST_PATH, "latest")

    history = build_history(all_data)
    save_json(history, HISTORY_PATH, "history")

    # ── [STAT-A] FF3 팩터 구성 ──
    try:
        ff3_ok = build_ff3_factors()
        if ff3_ok:
            source_stats["FF3"] = {"ok": 1, "fail": 0}
        else:
            source_stats["FF3"] = {"ok": 0, "fail": 1}
    except Exception as e:
        log(f"[FF3] 오류 발생: {e}")
        source_stats["FF3"] = {"ok": 0, "fail": 1}

    # ── 요약 ──
    print_summary(latest, source_stats)

    total_ok = sum(s["ok"] for s in source_stats.values())
    total_fail = sum(s["fail"] for s in source_stats.values())
    log(f"\n[완료] {total_ok}개 시리즈 수집 성공, {total_fail}개 실패")


if __name__ == "__main__":
    main()

# [STAT-A] FF3 design block → IMPLEMENTED above as build_ff3_factors()
# Constants #168-#171 defined at module level. See Fama & French (1993).
