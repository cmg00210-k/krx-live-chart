#!/usr/bin/env python3
"""
KOSIS (통계청) 경제지표 다운로더

데이터 소스: KOSIS OpenAPI (통계청 국가통계포털)
  - DT_1C8016: 경기종합지수 (선행/동행/후행 22개 항목)
    - CLI 선행종합지수, ESI 경제심리지수, IPI 산업생산, 소매판매, 고용자수 등

출력:
  data/macro/kosis_latest.json   <- JS 소비용 최신 스냅샷
  data/macro/kosis_history.json  <- 2년 월별 시계열

사용법:
  python scripts/download_kosis.py
  python scripts/download_kosis.py --api-key YOUR_KEY
  python scripts/download_kosis.py --offline
  python scripts/download_kosis.py --verbose

의존성:
  pip install requests
"""

import sys
import os
import json
import argparse
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
MACRO_DIR = os.path.join(DATA_DIR, "macro")
LATEST_PATH = os.path.join(MACRO_DIR, "kosis_latest.json")
HISTORY_PATH = os.path.join(MACRO_DIR, "kosis_history.json")

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ── KOSIS API 설정 ──
KOSIS_URL = "https://kosis.kr/openapi/Param/statisticsParameterData.do"
TIMEOUT = 30

# ── 수집 대상 항목코드 → 키명 매핑 (DT_1C8016) ──
# C1 code → internal key name
SERIES_MAP = {
    # 선행지표 (Leading)
    "A01":   {"key": "cli_composite",   "name": "선행종합지수 (2020=100)"},
    "A0102": {"key": "esi",             "name": "경제심리지수 (Doc29 §2.2 CSI proxy)"},
    "A0104": {"key": "construction_orders", "name": "건설수주(실질)"},
    "A0106": {"key": "kospi_kosis",     "name": "종합주가지수 (KOSIS)"},
    "A0107": {"key": "rate_spread_5y",  "name": "금리스프레드 5년국채-콜금리"},
    # 동행지표 (Coincident)
    "B02":   {"key": "cci_composite",   "name": "동행종합지수 (2020=100)"},
    "B0201": {"key": "ipi_all",         "name": "전산업생산지수 (ECOS 교차검증)"},
    "B0204": {"key": "retail_sales",    "name": "소매판매지수"},
    "B0207": {"key": "employed_nonfarm","name": "비농림어업 취업자수 (천명)"},
    # 후행지표 (Lagging)
    "C03":   {"key": "lag_composite",   "name": "후행종합지수 (2020=100)"},
    "C0301": {"key": "inventory_index", "name": "생산자제품재고지수"},
    "C0305": {"key": "cp_yield_kosis",  "name": "CP수익률 (ECOS 교차검증)"},
}

# ── MCS v2 확장 대상 (별도 테이블) ──
# 실업률, 소비자심리지수(CSI)는 DT_1C8016에 포함되지 않음.
# 별도 테이블에서 수집 필요 — 선택적 확장 (API 실패 시 건너뜀).
#
# Note: ESI (경제심리지수, A0102)가 CSI를 포함하는 통합지표이므로
# CSI 단독 수집은 선택적. MCS v2에서는 ESI를 CSI proxy로 사용.
OPTIONAL_SERIES = {
    # 실업률: 통계청 경제활동인구조사 (orgId=101, tblId=DT_1DA7102S)
    # 항목코드는 테이블 구조에 따라 다를 수 있으므로 placeholder로 기록.
    # "unemployment": {
    #     "orgId": "101",
    #     "tblId": "DT_1DA7102S",  # 경제활동인구 월별 - 확인 필요
    #     "key": "unemployment_rate_kosis",
    #     "name": "실업률 (%) — MCS v2 unemployment_inv 입력",
    #     "note": "macro_latest.json의 unemployment_rate와 교차검증 가능",
    # },
    #
    # 소비자심리지수 (CSI): 한국은행 소비자동향조사
    # ECOS에서 이미 수집 가능 (download_ecos.py 참조).
    # KOSIS에서는 orgId=301 (한국은행) 테이블을 통해 접근 가능하나,
    # ESI가 이미 CSI를 포함하므로 중복 수집 불필요.
    # "csi": {
    #     "orgId": "301",
    #     "tblId": "TBD",  # 한국은행 소비자동향조사 테이블ID 확인 필요
    #     "key": "csi_kosis",
    #     "name": "소비자심리지수 (CSI) — ESI에 포함됨, 단독 수집 선택적",
    # },
}

VERBOSE = False


def log(msg):
    print(f"[KOSIS] {msg}")


def vlog(msg):
    if VERBOSE:
        print(f"[KOSIS][v] {msg}")


def fetch_kosis_table(api_key, tbl_id="DT_1C8016", org_id="101",
                      start_ym="202201", end_ym=None, prd_se="M"):
    """KOSIS OpenAPI에서 통계표 데이터 조회

    Returns: list of dict (raw JSON rows) or None
    """
    if not HAS_REQUESTS or not api_key:
        return None

    if end_ym is None:
        end_ym = datetime.today().strftime("%Y%m")

    params = {
        "method": "getList",
        "apiKey": api_key,
        "itmId": "T1+",
        "objL1": "ALL",
        "objL2": "", "objL3": "", "objL4": "",
        "objL5": "", "objL6": "", "objL7": "", "objL8": "",
        "format": "json",
        "jsonVD": "Y",
        "prdSe": prd_se,
        "startPrdDe": start_ym,
        "endPrdDe": end_ym,
        "orgId": org_id,
        "tblId": tbl_id,
    }

    vlog(f"URL: {KOSIS_URL}")
    vlog(f"Params: tblId={tbl_id}, orgId={org_id}, {start_ym}~{end_ym}")

    try:
        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0"})
        r = session.get(KOSIS_URL, params=params, timeout=TIMEOUT, verify=False)

        if r.status_code != 200:
            log(f"  HTTP {r.status_code}")
            return None

        data = r.json()
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "err" in data:
            log(f"  API 오류: {data.get('err')} — {data.get('errMsg','')}")
            return None
        return None
    except Exception as e:
        log(f"  요청 실패: {e}")
        return None


def parse_series(raw_data):
    """KOSIS raw JSON을 시리즈별 시계열로 변환

    Returns: dict of {key: [{"date": "YYYY-MM", "value": float}, ...]}
    """
    series = {}

    for item in raw_data:
        c1 = item.get("C1", "")
        if c1 not in SERIES_MAP:
            continue

        key = SERIES_MAP[c1]["key"]
        prd = item.get("PRD_DE", "")
        dt_str = item.get("DT", "")

        if not prd or not dt_str:
            continue

        # PRD_DE format: "202501" → "2025-01"
        date_str = f"{prd[:4]}-{prd[4:6]}"

        try:
            val = float(dt_str.replace(",", ""))
        except ValueError:
            continue

        if key not in series:
            series[key] = []
        series[key].append({"date": date_str, "value": val})

    # 날짜 오름차순 정렬
    for key in series:
        series[key].sort(key=lambda x: x["date"])

    return series


def build_latest(series):
    """kosis_latest.json 구성"""
    today = datetime.today().strftime("%Y-%m-%d")

    latest = {"updated": today, "source": "KOSIS DT_1C8016"}

    for c1_code, info in SERIES_MAP.items():
        key = info["key"]
        data = series.get(key, [])
        if data:
            latest[key] = data[-1]["value"]
            latest[f"{key}_date"] = data[-1]["date"]
        else:
            latest[key] = None

    # 파생 지표: 선행-동행 격차 (경기 방향 선행 시그널)
    cli = latest.get("cli_composite")
    cci = latest.get("cci_composite")
    if cli is not None and cci is not None:
        latest["cli_cci_gap"] = round(cli - cci, 2)

    # 소수점 정리
    for k, v in latest.items():
        if isinstance(v, float):
            latest[k] = round(v, 2)

    return latest


def build_history(series):
    """kosis_history.json 구성 — 2년 월별 시계열"""
    all_dates = set()
    for key, data in series.items():
        for d in data:
            all_dates.add(d["date"])

    sorted_dates = sorted(all_dates)
    if len(sorted_dates) > 24:
        sorted_dates = sorted_dates[-24:]

    history = {"dates": sorted_dates}

    for key, data in series.items():
        date_map = {d["date"]: d["value"] for d in data}
        history[key] = [date_map.get(dt) for dt in sorted_dates]

    return history


def save_json(data, path, label=""):
    """JSON 파일 저장"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log(f"저장 완료: {path}")


def print_summary(latest):
    """수집 결과 요약"""
    log("")
    log("=" * 55)
    log("  KOSIS 수집 결과 요약")
    log("=" * 55)

    indicators = [
        ("선행종합지수", "cli_composite", ""),
        ("경제심리지수(ESI)", "esi", ""),
        ("건설수주(실질)", "construction_orders", ""),
        ("KOSPI(KOSIS)", "kospi_kosis", ""),
        ("금리스프레드5Y", "rate_spread_5y", "%p"),
        ("동행종합지수", "cci_composite", ""),
        ("IPI(전산업)", "ipi_all", ""),
        ("소매판매지수", "retail_sales", ""),
        ("비농림취업자", "employed_nonfarm", "천명"),
        ("후행종합지수", "lag_composite", ""),
        ("재고지수", "inventory_index", ""),
        ("CP수익률", "cp_yield_kosis", "%"),
        ("선행-동행 격차", "cli_cci_gap", ""),
    ]

    for label, key, unit in indicators:
        val = latest.get(key)
        if val is not None:
            log(f"  {label:18s}: {val}{unit}")
        else:
            log(f"  {label:18s}: (수집 실패)")

    log("=" * 55)


def main():
    global VERBOSE

    parser = argparse.ArgumentParser(description="KOSIS 경제지표 다운로더")
    parser.add_argument("--api-key", default="", help="KOSIS API 키")
    parser.add_argument("--offline", action="store_true", help="기존 데이터에서 재생성")
    parser.add_argument("--verbose", action="store_true", help="디버그 출력")
    args = parser.parse_args()
    VERBOSE = args.verbose

    # .env 파일에서 API 키 자동 로드
    if not args.api_key:
        env_path = os.path.join(PROJECT_ROOT, ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("KOSIS_API_KEY="):
                        args.api_key = line.split("=", 1)[1].strip()
                        log(".env에서 KOSIS API 키 로드 완료")
                        break

    if not args.api_key:
        log("[오류] KOSIS API 키가 필요합니다.")
        log("  사용법: python scripts/download_kosis.py --api-key YOUR_KEY")
        return

    log("KOSIS 경제지표 수집 시작")
    log(f"  날짜: {datetime.today().strftime('%Y-%m-%d %H:%M')}")
    log(f"  출력: {MACRO_DIR}/")
    log("")

    if args.offline:
        log("[오프라인 모드] API 호출 없이 기존 데이터 재사용")
        if os.path.exists(LATEST_PATH):
            with open(LATEST_PATH, "r", encoding="utf-8") as f:
                latest = json.load(f)
            print_summary(latest)
        else:
            log("기존 데이터 없음")
        return

    # ── 데이터 수집 ──
    # 2년치 수집 (선행-동행 비교에 충분한 기간)
    start_ym = (datetime.today() - timedelta(days=365 * 2 + 90)).strftime("%Y%m")
    end_ym = datetime.today().strftime("%Y%m")

    log("[1/1] KOSIS DT_1C8016 (경기종합지수) 수집 중...")
    raw_data = fetch_kosis_table(args.api_key, start_ym=start_ym, end_ym=end_ym)

    if not raw_data:
        log("[오류] KOSIS 데이터 수집 실패")
        return

    log(f"  -> {len(raw_data)}개 raw rows 수집")

    # ── 파싱 ──
    series = parse_series(raw_data)
    ok = len(series)
    total = len(SERIES_MAP)
    log(f"  -> {ok}/{total} 시리즈 파싱 완료")

    # ── 빌드 ──
    latest = build_latest(series)
    history = build_history(series)

    # ── 저장 ──
    save_json(latest, LATEST_PATH, "latest")
    save_json(history, HISTORY_PATH, "history")

    # ── 요약 ──
    print_summary(latest)

    log(f"\n[완료] {ok}/{total} 시리즈 수집 성공")


if __name__ == "__main__":
    main()
