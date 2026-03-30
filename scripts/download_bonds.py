"""
한국 채권시장 수익률곡선 및 크레딧 스프레드 다운로더

데이터 소스: BOK ECOS API (한국은행 경제통계시스템)
  - 국고채 수익률곡선: 1Y, 2Y, 3Y, 5Y, 10Y, 20Y, 30Y
  - 회사채 수익률: AA- 3년, BBB- 3년
  - 크레딧 스프레드: AA-/BBB- vs 국고 3년

수익률곡선 피팅: Nelson-Siegel-Svensson (scipy 선택적 의존)
  y(τ) = β₁ + β₂×[(1-e^(-τ/λ₁))/(τ/λ₁)]
       + β₃×[(1-e^(-τ/λ₁))/(τ/λ₁) - e^(-τ/λ₁)]
       + β₄×[(1-e^(-τ/λ₂))/(τ/λ₂) - e^(-τ/λ₂)]

출력 파일:
  data/macro/bonds_latest.json    ← 최신 스냅샷 (수익률, 스프레드, NSS 파라미터)
  data/macro/bonds_history.json   ← 과거 2년 월별 시계열

사용법:
  python scripts/download_bonds.py --api-key YOUR_ECOS_KEY
  python scripts/download_bonds.py --api-key YOUR_KEY --verbose
  python scripts/download_bonds.py --offline

ECOS API 키 발급:
  https://ecos.bok.or.kr/ 에서 회원가입 후 인증키 발급 (무료)

의존성:
  pip install requests
  (선택) pip install scipy  — NSS 피팅용
"""

import sys
import os
import json
import time
import argparse
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple

sys.stdout.reconfigure(encoding='utf-8')

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
MACRO_DIR = os.path.join(DATA_DIR, "macro")

LATEST_FILE = os.path.join(MACRO_DIR, "bonds_latest.json")
HISTORY_FILE = os.path.join(MACRO_DIR, "bonds_history.json")

# ── ECOS API 설정 ──
ECOS_BASE_URL = "https://ecos.bok.or.kr/api"
ECOS_STAT_CODE = "817Y002"  # 시장금리(일별)
RATE_LIMIT_SEC = 0.5

# 국고채 수익률 항목코드
KTB_ITEMS = {
    "ktb_1y":  "010200001",
    "ktb_2y":  "010200002",
    "ktb_3y":  "010200000",
    "ktb_5y":  "010200003",
    "ktb_10y": "010210000",
    "ktb_20y": "010220000",
    "ktb_30y": "010230000",
}

# 회사채 수익률 항목코드
CREDIT_ITEMS = {
    "aa_minus": "010300000",   # 회사채 AA- 3년
    "bbb_minus": "010400000",  # 회사채 BBB- 3년
}

# 국고채 만기(년) — NSS 피팅용
KTB_MATURITIES = {
    "ktb_1y": 1.0,
    "ktb_2y": 2.0,
    "ktb_3y": 3.0,
    "ktb_5y": 5.0,
    "ktb_10y": 10.0,
    "ktb_20y": 20.0,
    "ktb_30y": 30.0,
}

# ── scipy 선택적 임포트 ──
try:
    from scipy.optimize import minimize as scipy_minimize
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

# ── requests 임포트 ──
try:
    import requests
except ImportError:
    print("[BONDS] 오류: requests 패키지가 필요합니다. pip install requests")
    sys.exit(1)


# ══════════════════════════════════════════════════════
#  ECOS API 호출
# ══════════════════════════════════════════════════════

def ecos_fetch(api_key: str, stat_code: str, item_code: str,
               start_date: str, end_date: str,
               frequency: str = "D", verbose: bool = False) -> List[dict]:
    """
    ECOS StatisticSearch API 호출.

    Parameters:
        api_key:    ECOS 인증키
        stat_code:  통계표코드 (예: 817Y002)
        item_code:  항목코드 (예: 010200000 = 국고 3년)
        start_date: 시작일 YYYYMMDD
        end_date:   종료일 YYYYMMDD
        frequency:  D(일별), M(월별), A(연별)
        verbose:    디버그 출력

    Returns:
        list of dicts with 'TIME' and 'DATA_VALUE' keys
    """
    # ECOS REST URL 구조:
    # /StatisticSearch/{key}/json/kr/1/100/{stat_code}/{freq}/{start}/{end}/{item_code1}
    url = (
        f"{ECOS_BASE_URL}/StatisticSearch"
        f"/{api_key}/json/kr/1/100"
        f"/{stat_code}/{frequency}/{start_date}/{end_date}"
        f"/{item_code}"
    )

    if verbose:
        print(f"  [ECOS] GET {stat_code}/{item_code} ({start_date}~{end_date}, {frequency})")

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.Timeout:
        print(f"  [ECOS] 타임아웃: {item_code}")
        return []
    except requests.exceptions.RequestException as e:
        print(f"  [ECOS] 요청 실패: {item_code} — {e}")
        return []
    except json.JSONDecodeError:
        print(f"  [ECOS] JSON 파싱 실패: {item_code}")
        return []

    # ECOS 응답 구조 확인
    if "StatisticSearch" not in data:
        # 에러 응답 체크
        if "RESULT" in data:
            code = data["RESULT"].get("CODE", "")
            msg = data["RESULT"].get("MESSAGE", "")
            if code == "INFO-200":
                if verbose:
                    print(f"  [ECOS] 데이터 없음: {item_code} ({msg})")
                return []
            else:
                print(f"  [ECOS] API 에러: {code} — {msg}")
                return []
        if verbose:
            print(f"  [ECOS] 예상치 못한 응답: {list(data.keys())}")
        return []

    rows = data["StatisticSearch"].get("row", [])
    if verbose:
        print(f"  [ECOS] {item_code}: {len(rows)}건 수신")

    return rows


def fetch_latest_yield(api_key: str, item_code: str,
                       verbose: bool = False) -> Optional[float]:
    """
    최근 영업일 기준 수익률 1건 조회.
    최근 30일 범위에서 가장 마지막 데이터 반환.
    """
    today = datetime.now()
    end_str = today.strftime("%Y%m%d")
    start_str = (today - timedelta(days=30)).strftime("%Y%m%d")

    rows = ecos_fetch(api_key, ECOS_STAT_CODE, item_code,
                      start_str, end_str, "D", verbose)
    if not rows:
        return None

    # 가장 최근 데이터
    last = rows[-1]
    try:
        return float(last["DATA_VALUE"])
    except (KeyError, ValueError, TypeError):
        return None


def fetch_monthly_history(api_key: str, item_code: str,
                          months: int = 24,
                          verbose: bool = False) -> List[Tuple[str, float]]:
    """
    월별 시계열 조회 (기본 24개월).
    Returns: list of (YYYY-MM, value) tuples
    """
    today = datetime.now()
    end_str = today.strftime("%Y%m")
    # months 개월 전
    start_dt = today - timedelta(days=months * 31)
    start_str = start_dt.strftime("%Y%m")

    rows = ecos_fetch(api_key, ECOS_STAT_CODE, item_code,
                      start_str, end_str, "M", verbose)

    result = []
    for row in rows:
        try:
            t = row["TIME"]  # YYYYMM
            v = float(row["DATA_VALUE"])
            date_label = f"{t[:4]}-{t[4:6]}"
            result.append((date_label, v))
        except (KeyError, ValueError, TypeError):
            continue

    return result


# ══════════════════════════════════════════════════════
#  Nelson-Siegel-Svensson 수익률곡선 피팅
# ══════════════════════════════════════════════════════

def nss_yield(tau, beta1, beta2, beta3, beta4, lambda1, lambda2):
    """
    Nelson-Siegel-Svensson 모형으로 만기 tau(년)의 수익률 계산.

    y(τ) = β₁ + β₂×[(1-e^(-τ/λ₁))/(τ/λ₁)]
         + β₃×[(1-e^(-τ/λ₁))/(τ/λ₁) - e^(-τ/λ₁)]
         + β₄×[(1-e^(-τ/λ₂))/(τ/λ₂) - e^(-τ/λ₂)]
    """
    import math

    if tau <= 0:
        return beta1 + beta2

    x1 = tau / lambda1
    x2 = tau / lambda2

    # 수치 안정성: 매우 작은 x에 대해 극한값 사용
    if x1 < 1e-10:
        factor1 = 1.0
        factor1_decay = 0.0
    else:
        exp1 = math.exp(-x1)
        factor1 = (1.0 - exp1) / x1
        factor1_decay = factor1 - exp1

    if x2 < 1e-10:
        factor2_decay = 0.0
    else:
        exp2 = math.exp(-x2)
        factor2_decay = (1.0 - exp2) / x2 - exp2

    return beta1 + beta2 * factor1 + beta3 * factor1_decay + beta4 * factor2_decay


def fit_nss(maturities: List[float], yields: List[float],
            verbose: bool = False) -> Optional[Dict[str, float]]:
    """
    관측된 수익률 데이터에 NSS 모형을 피팅.

    Parameters:
        maturities: 만기 리스트 (년)
        yields: 수익률 리스트 (%)

    Returns:
        dict with beta1, beta2, beta3, beta4, lambda1, lambda2
        scipy 없으면 None 반환
    """
    if not HAS_SCIPY:
        if verbose:
            print("  [NSS] scipy 미설치 — NSS 피팅 생략")
        return None

    if len(maturities) < 4:
        if verbose:
            print(f"  [NSS] 데이터 부족 ({len(maturities)}개) — 최소 4개 필요")
        return None

    import numpy as np

    taus = np.array(maturities)
    observed = np.array(yields)

    def objective(params):
        b1, b2, b3, b4, l1, l2 = params
        predicted = np.array([nss_yield(t, b1, b2, b3, b4, l1, l2) for t in taus])
        return np.sum((observed - predicted) ** 2)

    # 초기 추정치: 장기 수준, 기울기, 곡률
    long_rate = observed[-1] if len(observed) > 0 else 3.5
    short_rate = observed[0] if len(observed) > 0 else 3.0
    b1_init = long_rate
    b2_init = short_rate - long_rate
    b3_init = 0.0
    b4_init = 0.0

    x0 = [b1_init, b2_init, b3_init, b4_init, 1.5, 5.0]

    # 제약: lambda > 0
    bounds = [
        (None, None),    # beta1
        (None, None),    # beta2
        (None, None),    # beta3
        (None, None),    # beta4
        (0.01, 30.0),   # lambda1
        (0.01, 30.0),   # lambda2
    ]

    try:
        result = scipy_minimize(objective, x0, method='L-BFGS-B', bounds=bounds,
                                options={'maxiter': 5000, 'ftol': 1e-12})

        if result.success or result.fun < 0.01:
            params = result.x
            fitted = {
                "beta1": round(float(params[0]), 4),
                "beta2": round(float(params[1]), 4),
                "beta3": round(float(params[2]), 4),
                "beta4": round(float(params[3]), 4),
                "lambda1": round(float(params[4]), 4),
                "lambda2": round(float(params[5]), 4),
            }

            if verbose:
                residual = result.fun
                print(f"  [NSS] 피팅 완료 (잔차 제곱합: {residual:.6f})")
                print(f"        β₁={fitted['beta1']}, β₂={fitted['beta2']}, "
                      f"β₃={fitted['beta3']}, β₄={fitted['beta4']}")
                print(f"        λ₁={fitted['lambda1']}, λ₂={fitted['lambda2']}")

            return fitted
        else:
            if verbose:
                print(f"  [NSS] 피팅 실패: {result.message}")
            return None

    except Exception as e:
        if verbose:
            print(f"  [NSS] 피팅 예외: {e}")
        return None


# ══════════════════════════════════════════════════════
#  크레딧 레짐 분류
# ══════════════════════════════════════════════════════

def classify_credit_regime(aa_spread: Optional[float]) -> str:
    """
    AA- 크레딧 스프레드 기반 시장 레짐 분류.

    aa_spread < 0.50       → "compressed" (risk-on, 강세)
    0.50 <= spread < 1.00  → "normal"
    1.00 <= spread < 1.50  → "elevated" (경계)
    spread >= 1.50         → "stress" (risk-off, 약세)
    """
    if aa_spread is None:
        return "unknown"
    if aa_spread < 0.50:
        return "compressed"
    elif aa_spread < 1.00:
        return "normal"
    elif aa_spread < 1.50:
        return "elevated"
    else:
        return "stress"


# ══════════════════════════════════════════════════════
#  최신 스냅샷 수집
# ══════════════════════════════════════════════════════

def collect_latest(api_key: str, verbose: bool = False) -> dict:
    """
    최근 영업일 기준 국고채 수익률 + 크레딧 스프레드 수집.
    Returns: bonds_latest.json 구조
    """
    print("[BONDS] 최신 수익률 데이터 수집 중...")

    yields_data = {}
    credit_data = {}

    # 국고채 수익률 수집
    for key, item_code in KTB_ITEMS.items():
        val = fetch_latest_yield(api_key, item_code, verbose)
        if val is not None:
            yields_data[key] = val
            print(f"  {key}: {val:.2f}%")
        else:
            print(f"  {key}: 데이터 없음")
        time.sleep(RATE_LIMIT_SEC)

    # 회사채 수익률 수집
    for key, item_code in CREDIT_ITEMS.items():
        val = fetch_latest_yield(api_key, item_code, verbose)
        if val is not None:
            credit_data[key] = val
            print(f"  {key}: {val:.2f}%")
        else:
            print(f"  {key}: 데이터 없음")
        time.sleep(RATE_LIMIT_SEC)

    # 크레딧 스프레드 계산
    ktb_3y = yields_data.get("ktb_3y")
    aa_yield = credit_data.get("aa_minus")
    bbb_yield = credit_data.get("bbb_minus")

    aa_spread = None
    bbb_spread = None

    if ktb_3y is not None and aa_yield is not None:
        aa_spread = round(aa_yield - ktb_3y, 2)
    if ktb_3y is not None and bbb_yield is not None:
        bbb_spread = round(bbb_yield - ktb_3y, 2)

    credit_spreads = {
        "aa_minus": credit_data.get("aa_minus"),
        "bbb_minus": credit_data.get("bbb_minus"),
        "aa_spread": aa_spread,
        "bbb_spread": bbb_spread,
    }

    # 수익률곡선 기울기
    ktb_2y = yields_data.get("ktb_2y")
    ktb_10y = yields_data.get("ktb_10y")

    slope_10y3y = None
    slope_10y2y = None
    if ktb_10y is not None and ktb_3y is not None:
        slope_10y3y = round(ktb_10y - ktb_3y, 2)
    if ktb_10y is not None and ktb_2y is not None:
        slope_10y2y = round(ktb_10y - ktb_2y, 2)

    curve_inverted = False
    if slope_10y3y is not None:
        curve_inverted = slope_10y3y < 0
    elif slope_10y2y is not None:
        curve_inverted = slope_10y2y < 0

    # NSS 피팅
    nss_maturities = []
    nss_yields = []
    for key in ["ktb_1y", "ktb_2y", "ktb_3y", "ktb_5y",
                "ktb_10y", "ktb_20y", "ktb_30y"]:
        if key in yields_data:
            nss_maturities.append(KTB_MATURITIES[key])
            nss_yields.append(yields_data[key])

    nss_params = fit_nss(nss_maturities, nss_yields, verbose)

    # 레짐 분류
    credit_regime = classify_credit_regime(aa_spread)

    if aa_spread is not None:
        print(f"\n  크레딧 스프레드 AA-: {aa_spread:.2f}%p → 레짐: {credit_regime}")
    if slope_10y3y is not None:
        inv_label = " (역전!)" if curve_inverted else ""
        print(f"  수익률곡선 기울기 10Y-3Y: {slope_10y3y:+.2f}%p{inv_label}")

    result = {
        "updated": datetime.now().strftime("%Y-%m-%d"),
        "yields": yields_data,
        "credit_spreads": credit_spreads,
        "nss_params": nss_params,
        "slope_10y3y": slope_10y3y,
        "slope_10y2y": slope_10y2y,
        "curve_inverted": curve_inverted,
        "credit_regime": credit_regime,
    }

    return result


# ══════════════════════════════════════════════════════
#  과거 월별 시계열 수집
# ══════════════════════════════════════════════════════

def collect_history(api_key: str, months: int = 24,
                    verbose: bool = False) -> dict:
    """
    과거 월별 국고채 + 크레딧 스프레드 시계열 수집.
    Returns: bonds_history.json 구조
    """
    print(f"\n[BONDS] 과거 {months}개월 월별 시계열 수집 중...")

    # 주요 시리즈: 국고 3년, 10년, AA- 3년, BBB- 3년
    series_config = {
        "ktb_3y": KTB_ITEMS["ktb_3y"],
        "ktb_10y": KTB_ITEMS["ktb_10y"],
        "aa_minus": CREDIT_ITEMS["aa_minus"],
        "bbb_minus": CREDIT_ITEMS["bbb_minus"],
    }

    all_series = {}
    all_dates = set()

    for key, item_code in series_config.items():
        history = fetch_monthly_history(api_key, item_code, months, verbose)
        series_dict = {}
        for date_label, val in history:
            series_dict[date_label] = val
            all_dates.add(date_label)
        all_series[key] = series_dict
        print(f"  {key}: {len(history)}개월 수신")
        time.sleep(RATE_LIMIT_SEC)

    # 날짜 정렬
    sorted_dates = sorted(all_dates)

    if not sorted_dates:
        print("  [BONDS] 시계열 데이터 없음")
        return {
            "dates": [],
            "ktb_3y": [],
            "ktb_10y": [],
            "aa_spread": [],
            "bbb_spread": [],
        }

    # 시리즈별 정렬된 배열 생성
    ktb_3y_arr = []
    ktb_10y_arr = []
    aa_spread_arr = []
    bbb_spread_arr = []

    for d in sorted_dates:
        k3 = all_series.get("ktb_3y", {}).get(d)
        k10 = all_series.get("ktb_10y", {}).get(d)
        aa = all_series.get("aa_minus", {}).get(d)
        bbb = all_series.get("bbb_minus", {}).get(d)

        ktb_3y_arr.append(k3)
        ktb_10y_arr.append(k10)

        # 스프레드 계산
        if k3 is not None and aa is not None:
            aa_spread_arr.append(round(aa - k3, 2))
        else:
            aa_spread_arr.append(None)

        if k3 is not None and bbb is not None:
            bbb_spread_arr.append(round(bbb - k3, 2))
        else:
            bbb_spread_arr.append(None)

    result = {
        "dates": sorted_dates,
        "ktb_3y": ktb_3y_arr,
        "ktb_10y": ktb_10y_arr,
        "aa_spread": aa_spread_arr,
        "bbb_spread": bbb_spread_arr,
    }

    print(f"  기간: {sorted_dates[0]} ~ {sorted_dates[-1]} ({len(sorted_dates)}개월)")

    return result


# ══════════════════════════════════════════════════════
#  파일 저장
# ══════════════════════════════════════════════════════

def save_json(filepath: str, data: dict):
    """JSON 파일 저장 (UTF-8, 들여쓰기 2)."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size_kb = os.path.getsize(filepath) / 1024
    print(f"  저장: {os.path.relpath(filepath, PROJECT_ROOT)} ({size_kb:.1f}KB)")


def create_template() -> Tuple[dict, dict]:
    """
    API 키 없을 때 null 값 템플릿 생성.
    데이터 구조를 유지하면서 모든 값을 null로 설정.
    """
    latest = {
        "updated": datetime.now().strftime("%Y-%m-%d"),
        "yields": {k: None for k in KTB_ITEMS},
        "credit_spreads": {
            "aa_minus": None,
            "bbb_minus": None,
            "aa_spread": None,
            "bbb_spread": None,
        },
        "nss_params": None,
        "slope_10y3y": None,
        "slope_10y2y": None,
        "curve_inverted": None,
        "credit_regime": "unknown",
    }

    history = {
        "dates": [],
        "ktb_3y": [],
        "ktb_10y": [],
        "aa_spread": [],
        "bbb_spread": [],
    }

    return latest, history


# ══════════════════════════════════════════════════════
#  메인
# ══════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="한국 채권시장 수익률곡선 및 크레딧 스프레드 다운로더"
    )
    parser.add_argument("--api-key", type=str, default=None,
                        help="BOK ECOS API 인증키 (필수)")
    parser.add_argument("--offline", action="store_true",
                        help="기존 데이터만 사용 (API 호출 없음)")
    parser.add_argument("--verbose", action="store_true",
                        help="상세 디버그 출력")

    args = parser.parse_args()

    print("=" * 60)
    print("  한국 채권시장 데이터 다운로더")
    print("  데이터 소스: BOK ECOS (한국은행 경제통계시스템)")
    print("=" * 60)

    if HAS_SCIPY:
        print("[BONDS] scipy 감지 — NSS 수익률곡선 피팅 활성화")
    else:
        print("[BONDS] scipy 미설치 — NSS 피팅 생략 (raw 수익률만 저장)")

    # ── 오프라인 모드 ──
    if args.offline:
        print("\n[BONDS] 오프라인 모드 — 기존 파일 확인")
        if os.path.exists(LATEST_FILE):
            with open(LATEST_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            updated = data.get("updated", "?")
            regime = data.get("credit_regime", "?")
            print(f"  bonds_latest.json: {updated} (레짐: {regime})")
        else:
            print(f"  bonds_latest.json: 파일 없음")

        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            n_dates = len(data.get("dates", []))
            print(f"  bonds_history.json: {n_dates}개월")
        else:
            print(f"  bonds_history.json: 파일 없음")

        print("\n[BONDS] 완료 (오프라인)")
        return

    # ── API 키 확인 ──
    if not args.api_key:
        print("\n[BONDS] 경고: API 키가 제공되지 않았습니다.")
        print("  ECOS API 키 발급: https://ecos.bok.or.kr/")
        print("  사용법: python scripts/download_bonds.py --api-key YOUR_KEY")

        # 기존 파일이 있으면 유지, 없으면 템플릿 생성
        if os.path.exists(LATEST_FILE) and os.path.exists(HISTORY_FILE):
            print("\n  기존 데이터 파일이 존재합니다. 변경 없이 종료합니다.")
        else:
            print("\n  null 값 템플릿을 생성합니다...")
            latest_tpl, history_tpl = create_template()
            save_json(LATEST_FILE, latest_tpl)
            save_json(HISTORY_FILE, history_tpl)
            print("  템플릿 생성 완료. API 키를 지정하여 실제 데이터를 받으세요.")

        return

    # ── 데이터 수집 ──
    start_time = time.time()

    # 1. 최신 스냅샷
    latest = collect_latest(args.api_key, args.verbose)
    save_json(LATEST_FILE, latest)

    # 2. 과거 시계열
    history = collect_history(args.api_key, months=24, verbose=args.verbose)
    save_json(HISTORY_FILE, history)

    elapsed = time.time() - start_time

    # ── 요약 ──
    print("\n" + "=" * 60)
    print("  수집 완료 요약")
    print("=" * 60)

    n_yields = sum(1 for v in latest.get("yields", {}).values() if v is not None)
    n_credit = sum(1 for k in ["aa_minus", "bbb_minus"]
                   if latest.get("credit_spreads", {}).get(k) is not None)

    print(f"  국고채 수익률: {n_yields}/7 만기")
    print(f"  크레딧 수익률: {n_credit}/2 등급")

    nss = latest.get("nss_params")
    if nss:
        print(f"  NSS 피팅: 완료 (β₁={nss['beta1']}, λ₁={nss['lambda1']})")
    else:
        print(f"  NSS 피팅: {'scipy 미설치' if not HAS_SCIPY else '실패'}")

    regime = latest.get("credit_regime", "unknown")
    regime_labels = {
        "compressed": "압축 (risk-on)",
        "normal": "정상",
        "elevated": "확대 (경계)",
        "stress": "스트레스 (risk-off)",
        "unknown": "판단 불가",
    }
    print(f"  크레딧 레짐: {regime} ({regime_labels.get(regime, regime)})")

    inv = latest.get("curve_inverted")
    if inv is not None:
        print(f"  수익률곡선: {'역전 (inverted)' if inv else '정상 (normal)'}")

    n_hist = len(history.get("dates", []))
    print(f"  시계열: {n_hist}개월")
    print(f"  소요 시간: {elapsed:.1f}초")
    print(f"\n[BONDS] 완료")


if __name__ == "__main__":
    main()
