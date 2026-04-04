#!/usr/bin/env python3
"""
KRX Open API 공통 클라이언트 모듈 (v2 — Production Hardened)

KRX 정보데이터시스템 Open API (data-dbg.krx.co.kr) 인증 및 호출 래퍼.
모든 download_*.py 스크립트가 이 모듈을 통해 KRX API에 접근한다.

인증 방식: AUTH_KEY 헤더 (KRX Open API 가입 후 발급, 1년 유효)
키 저장: .env 파일 (KRX_API_KEY=...)
일일 한도: 10,000건/일 (공식)

v2 개선 (2026-04-02):
  1. 31개 엔드포인트 전수 매핑 (3개 독립소스 교차검증)
  2. 레이트리밋 0.3s → 0.5s (커뮤니티 기준)
  3. 분리 타임아웃 (connect 10s, read 60s)
  4. 3회 지수 백오프 재시도 (5xx/timeout만)
  5. 에러 분류 (retryable vs fatal)
  6. 일일 쿼터 추적 (9,000건 경고, 10,000건 중단)
  7. HTTP status + JSON respCode 이중 검증
  8. 응답 필드 메타데이터

사용법:
    from krx_api import KRXClient
    client = KRXClient()  # .env에서 자동 로드
    data = client.get('drv/fut_bydd_trd', basDd='20260401')
    data = client.get('idx_deriv', basDd='20260401')  # ENDPOINTS 키 지원
"""

import json
import os
import sys
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    raise SystemExit("[KRX-API] requests 패키지 필요: pip install requests")

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")

# ── 공통 상수/유틸 (api_constants.py) ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from api_constants import KRX_OPEN_API_BASE as API_BASE, RATE_LIMIT_SEC

# ── KRX Open API 설정 ──
DAILY_QUOTA = 10000     # KRX 공식 일일 한도
QUOTA_WARN = 9000       # 경고 임계치

# ── 31개 엔드포인트 매핑 (krx-rs + pykrx-openapi + openkrx-mcp 교차검증) ──
ENDPOINTS = {
    # 지수 (idx) — 접미사: _dd_trd
    "idx_krx":          "idx/krx_dd_trd",
    "idx_kospi":        "idx/kospi_dd_trd",
    "idx_kosdaq":       "idx/kosdaq_dd_trd",
    "idx_bond":         "idx/bon_dd_trd",
    "idx_deriv":        "idx/drvprod_dd_trd",       # VKOSPI 포함
    # 주식 (sto) — 접미사: _bydd_trd / _isu_base_info
    "stock_daily":      "sto/stk_bydd_trd",
    "stock_info":       "sto/stk_isu_base_info",
    "kosdaq_daily":     "sto/ksq_bydd_trd",
    "kosdaq_info":      "sto/ksq_isu_base_info",
    "konex_daily":      "sto/knx_bydd_trd",
    "konex_info":       "sto/knx_isu_base_info",
    "warrant_daily":    "sto/sw_bydd_trd",
    "rights_daily":     "sto/sr_bydd_trd",
    # 증권상품 (etp)
    "etf_daily":        "etp/etf_bydd_trd",
    "etn_daily":        "etp/etn_bydd_trd",
    "elw_daily":        "etp/elw_bydd_trd",
    # 채권 (bon)
    "bond_govt":        "bon/kts_bydd_trd",
    "bond_general":     "bon/bnd_bydd_trd",
    "bond_small":       "bon/smb_bydd_trd",
    # 파생상품 (drv)
    "futures_daily":        "drv/fut_bydd_trd",
    "futures_stock_kospi":  "drv/eqsfu_stk_bydd_trd",
    "futures_stock_kosdaq": "drv/eqkfu_ksq_bydd_trd",
    "options_daily":        "drv/opt_bydd_trd",
    "options_stock_kospi":  "drv/eqsop_bydd_trd",
    "options_stock_kosdaq": "drv/eqkop_bydd_trd",
    # 일반상품 (gen)
    "gold_daily":       "gen/gold_bydd_trd",
    "oil_daily":        "gen/oil_bydd_trd",
    "ets_daily":        "gen/ets_bydd_trd",
    # ESG
    "esg_sri_bond":     "esg/sri_bond_info",
    "esg_etp":          "esg/esg_etp_info",
    "esg_index":        "esg/esg_index_info",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

# 재시도 불가 에러 코드
FATAL_RESP_CODES = {"401", "403", "404"}


def _load_env_key() -> str:
    """
    .env 파일에서 KRX_API_KEY 로드.
    환경 변수 우선, .env 파일 폴백.
    """
    key = os.environ.get("KRX_API_KEY")
    if key:
        return key

    if os.path.isfile(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("KRX_API_KEY="):
                    return line.split("=", 1)[1].strip()

    raise ValueError(
        "[KRX-API] API 키 없음. .env 파일에 KRX_API_KEY=... 추가 필요.\n"
        "  KRX Open API 가입: https://openapi.krx.co.kr/"
    )


class KRXClient:
    """
    KRX Open API 클라이언트 (Production Hardened).

    사용법:
        client = KRXClient()
        futures = client.get('drv/fut_bydd_trd', basDd='20260401')
        vkospi  = client.get('idx_deriv', basDd='20260401')
    """

    def __init__(self, api_key: Optional[str] = None, verbose: bool = False,
                 max_retries: int = 3, backoff_factor: float = 1.0):
        self.api_key = api_key or _load_env_key()
        self.verbose = verbose
        self._last_call = 0.0
        self._daily_count = 0
        self._daily_date = datetime.now().strftime("%Y%m%d")
        self._max_retries = max_retries
        self._backoff_factor = backoff_factor

        # 세션 + 자동 재시도 (5xx/커넥션 에러만)
        self._session = requests.Session()
        self._session.headers.update(HEADERS)
        self._session.headers["AUTH_KEY"] = self.api_key

        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self._session.mount("https://", adapter)
        self._session.mount("http://", adapter)

    def _rate_limit(self):
        """KRX 서버 부하 방지용 호출 간격 유지."""
        elapsed = time.time() - self._last_call
        if elapsed < RATE_LIMIT_SEC:
            time.sleep(RATE_LIMIT_SEC - elapsed)
        self._last_call = time.time()

    def _check_quota(self):
        """일일 쿼터 확인. 날짜 변경 시 리셋."""
        today = datetime.now().strftime("%Y%m%d")
        if today != self._daily_date:
            self._daily_count = 0
            self._daily_date = today

        self._daily_count += 1

        if self._daily_count >= DAILY_QUOTA:
            raise RuntimeError(
                f"[KRX-API] 일일 쿼터 초과 ({DAILY_QUOTA}건). 내일 재시도 필요."
            )
        if self._daily_count == QUOTA_WARN:
            print(f"[KRX-API] 경고: 일일 쿼터 {QUOTA_WARN}/{DAILY_QUOTA}건 도달")

    @property
    def remaining_quota(self) -> int:
        """남은 일일 쿼터 추정치."""
        return max(0, DAILY_QUOTA - self._daily_count)

    def get(self, endpoint: str, connect_timeout: int = 10,
            read_timeout: int = 60, **params) -> List[Dict[str, Any]]:
        """
        KRX Open API GET 요청.

        Parameters:
            endpoint: API 경로 (예: 'drv/fut_bydd_trd') 또는 ENDPOINTS 키 (예: 'idx_deriv')
            connect_timeout: 연결 타임아웃 (초)
            read_timeout: 읽기 타임아웃 (초)
            **params: API 파라미터 (예: basDd='20260401')

        Returns:
            list of dicts (OutBlock_1 배열)

        Raises:
            RuntimeError: 일일 쿼터 초과 시
        """
        # ENDPOINTS 매핑 지원
        path = ENDPOINTS.get(endpoint, endpoint)
        url = f"{API_BASE}/{path}"

        self._check_quota()
        self._rate_limit()

        if self.verbose:
            print(f"[KRX-API] GET {path} params={params} (quota: {self._daily_count}/{DAILY_QUOTA})")

        try:
            resp = self._session.get(
                url, params=params,
                timeout=(connect_timeout, read_timeout),
            )
        except requests.exceptions.Timeout:
            if self.verbose:
                print(f"[KRX-API] 타임아웃: {path}")
            return []
        except requests.exceptions.RequestException as e:
            if self.verbose:
                print(f"[KRX-API] 요청 실패: {e}")
            return []

        # HTTP 레벨 에러
        if resp.status_code >= 400:
            if self.verbose:
                print(f"[KRX-API] HTTP {resp.status_code}: {path}")
            return []

        # JSON 파싱
        try:
            data = resp.json()
        except json.JSONDecodeError:
            if self.verbose:
                print(f"[KRX-API] JSON 파싱 실패: {resp.text[:100]}")
            return []

        # respCode 검증 (KRX 내부 에러 코드)
        resp_code = str(data.get("respCode", ""))
        if resp_code and resp_code != "200":
            resp_msg = data.get("respMsg", "unknown")
            if self.verbose:
                print(f"[KRX-API] 에러 {resp_code}: {resp_msg}")
            if resp_code in FATAL_RESP_CODES:
                # 401=미승인, 404=경로없음 — 재시도 무의미
                if self.verbose:
                    print(f"[KRX-API] FATAL: {path} → {resp_code} (재시도 불가)")
            return []

        return data.get("OutBlock_1", [])

    # ── 편의 메서드 ──

    def get_futures(self, date: str) -> List[Dict]:
        """선물 일별 시세 조회. date: YYYYMMDD"""
        return self.get("drv/fut_bydd_trd", basDd=date)

    def get_options(self, date: str) -> List[Dict]:
        """옵션 일별 시세 조회. date: YYYYMMDD"""
        return self.get("drv/opt_bydd_trd", read_timeout=120, basDd=date)

    def get_stocks(self, date: str) -> List[Dict]:
        """유가증권 일별 시세 조회. date: YYYYMMDD"""
        return self.get("sto/stk_bydd_trd", basDd=date)

    def get_kosdaq(self, date: str) -> List[Dict]:
        """코스닥 일별 시세 조회. date: YYYYMMDD"""
        return self.get("sto/ksq_bydd_trd", basDd=date)

    def get_etf(self, date: str) -> List[Dict]:
        """ETF 일별 시세 조회. date: YYYYMMDD"""
        return self.get("etp/etf_bydd_trd", basDd=date)

    def get_vkospi(self, date: str) -> List[Dict]:
        """파생상품지수 (VKOSPI 포함) 조회. date: YYYYMMDD"""
        return self.get("idx/drvprod_dd_trd", basDd=date)

    def get_kospi_index(self, date: str) -> List[Dict]:
        """KOSPI 지수 시리즈 조회. date: YYYYMMDD"""
        return self.get("idx/kospi_dd_trd", basDd=date)

    def test_connection(self) -> bool:
        """API 연결 테스트. 성공 시 True."""
        try:
            data = self.get("sto/stk_bydd_trd", read_timeout=15, basDd="20260401")
            ok = len(data) > 0
            if self.verbose:
                print(f"[KRX-API] 연결 테스트: {'성공' if ok else '실패'} ({len(data)} rows)")
            return ok
        except Exception:
            return False


# ── CLI 테스트 ──
if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")

    client = KRXClient(verbose=True)

    print("=" * 60)
    print("  KRX Open API v2 연결 테스트")
    print("=" * 60)

    if not client.test_connection():
        print("[KRX-API] 연결 실패. API 키와 네트워크 확인 필요.")
        sys.exit(1)

    print()

    # VKOSPI 테스트
    vkospi = client.get_vkospi("20260401")
    print(f"[KRX-API] 파생상품지수: {len(vkospi)} records")
    vk = [r for r in vkospi if "VKOSPI" in r.get("IDX_NM", "").upper()
          or "변동성" in r.get("IDX_NM", "")]
    if vk:
        print(f"[KRX-API] VKOSPI: {vk[0].get('IDX_NM', '?')} = {vk[0].get('CLSPRC_IDX', '?')}")

    # ETF 테스트
    etf = client.get_etf("20260401")
    print(f"[KRX-API] ETF: {len(etf)} records")

    # 선물 테스트
    futures = client.get_futures("20260401")
    print(f"[KRX-API] 선물: {len(futures)} records")

    print(f"\n[KRX-API] 남은 쿼터: {client.remaining_quota}/{DAILY_QUOTA}")
    print("=" * 60)
    print("  KRX Open API v2 테스트 완료!")
    print("=" * 60)
