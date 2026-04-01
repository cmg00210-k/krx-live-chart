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

# ── API 설정 ──
ECOS_BASE = "https://ecos.bok.or.kr/api"
FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"
OECD_BASE = "https://sdmx.oecd.org/public/rest/data"
TIMEOUT = 15  # seconds
RATE_LIMIT = 0.5  # seconds between API calls

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
}

# ── FRED 시리즈 (VIX는 FDR/yfinance에서 수집 — API키 불필요) ──
FRED_SERIES = {
    "fed_rate": {"series_id": "FEDFUNDS", "name": "Federal Funds Rate"},
    "us10y": {"series_id": "DGS10", "name": "US 10Y Treasury"},
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

VERBOSE = False


def log(msg):
    print(f"[MACRO] {msg}")


def vlog(msg):
    if VERBOSE:
        print(f"[MACRO][v] {msg}")


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

    # item_code에 '/'가 포함된 경우 다중 코드 (예: "C0000/AA" → 2개 항목)
    url = (
        f"{ECOS_BASE}/StatisticSearch/{api_key}/json/kr/1/{limit}/"
        f"{stat_code}/{freq}/{start_ym}/{end_ym}/{item_code}"
    )
    vlog(f"ECOS URL: {url}")

    try:
        r = requests.get(url, timeout=TIMEOUT)
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

        ref_area_idx = col_map.get("REF_AREA")
        measure_idx = col_map.get("MEASURE")
        adjustment_idx = col_map.get("ADJUSTMENT")
        transform_idx = col_map.get("TRANSFORMATION")
        time_idx = col_map.get("TIME_PERIOD")
        val_idx = col_map.get("OBS_VALUE")

        if time_idx is None or val_idx is None:
            vlog(f"OECD CSV header parse failed: {header}")
            return None

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
        "cycle_phase": classify_business_cycle(
            [d["value"] for d in all_data.get("korea_cli", []) if d.get("value") is not None]
            if all_data.get("korea_cli") else None
        ),
    }

    # None 값은 유지하되, 소수점 정리
    for k, v in latest.items():
        if isinstance(v, float):
            latest[k] = round(v, 4) if k == "foreigner_signal" else round(v, 2)

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
    ]

    for label, key, unit in indicators:
        val = latest.get(key)
        if val is not None:
            log(f"  {label:16s}: {val}{unit}")
        else:
            log(f"  {label:16s}: (수집 실패)")

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
        print_summary(latest, {"오프라인": {"ok": 1, "fail": 0}})
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

    # ── 요약 ──
    print_summary(latest, source_stats)

    total_ok = sum(s["ok"] for s in source_stats.values())
    total_fail = sum(s["fail"] for s in source_stats.values())
    log(f"\n[완료] {total_ok}개 시리즈 수집 성공, {total_fail}개 실패")


if __name__ == "__main__":
    main()
