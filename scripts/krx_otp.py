#!/usr/bin/env python3
"""
KRX OTP 공통 클라이언트 모듈

data.krx.co.kr OTP 2-step 방식 래퍼.
Open API에 없는 서비스 전용: 투자자별 매매동향, 공매도.

v1 (2026-04-02):
  - 3회 지수 백오프 재시도
  - EUC-KR 인코딩 자동 감지
  - "LOGOUT" 에러 감지
  - 0.5s 레이트 리밋

사용법:
    from krx_otp import KRXOTPClient
    client = KRXOTPClient()
    csv_text = client.fetch_csv(
        stat_url="dbms/MDC/STAT/standard/MDCSTAT02301",
        params={"mktId": "STK", "strtDd": "20260101", "endDd": "20260401"},
    )
"""

import os
import sys
import time

try:
    import requests
except ImportError:
    raise SystemExit("[KRX-OTP] requests 패키지 필요: pip install requests")

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 공통 상수/유틸 (api_constants.py) ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from api_constants import KRX_OTP_URL as OTP_URL, KRX_CSV_URL as CSV_URL, RATE_LIMIT_SEC

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "http://data.krx.co.kr",
}


class KRXOTPError(Exception):
    """KRX OTP 호출 오류."""
    pass


class KRXOTPClient:
    """
    KRX OTP 2-step CSV 다운로더 (투자자별 매매동향, 공매도 전용).

    사용법:
        client = KRXOTPClient(verbose=True)
        csv_text = client.fetch_csv("dbms/MDC/STAT/standard/MDCSTAT02301", {...})
    """

    def __init__(self, verbose: bool = False,
                 max_retries: int = 3, backoff_base: float = 1.0):
        self.verbose = verbose
        self._max_retries = max_retries
        self._backoff_base = backoff_base
        self._last_call = 0.0
        self._session = requests.Session()
        self._session.headers.update(HEADERS)

    def _rate_limit(self):
        """호출 간격 유지."""
        elapsed = time.time() - self._last_call
        if elapsed < RATE_LIMIT_SEC:
            time.sleep(RATE_LIMIT_SEC - elapsed)
        self._last_call = time.time()

    def _generate_otp(self, stat_url: str, params: dict, timeout: int = 15) -> str:
        """
        OTP 토큰 생성.

        Parameters:
            stat_url: KRX stat 페이지 경로 (예: "dbms/MDC/STAT/standard/MDCSTAT02301")
            params: 추가 파라미터 dict
            timeout: 요청 타임아웃

        Returns:
            OTP 토큰 문자열
        """
        otp_params = {
            "locale": "ko_KR",
            "share": "2",
            "csvxls_isNo": "false",
            "name": "fileDown",
            "url": stat_url,
        }
        otp_params.update(params)

        self._rate_limit()
        resp = self._session.post(OTP_URL, data=otp_params, timeout=timeout)
        resp.raise_for_status()

        otp = resp.text.strip()

        # LOGOUT 감지 (2025.12 KRX 회원제 전환 이후)
        if not otp or "LOGOUT" in otp.upper() or len(otp) > 500:
            raise KRXOTPError(
                f"[KRX-OTP] OTP 생성 실패: 응답={otp[:100]}... "
                "(로그인 세션 만료 또는 KRX 차단. data.krx.co.kr 직접 확인 필요)"
            )

        return otp

    def _download_csv(self, otp: str, timeout: int = 30) -> str:
        """
        OTP 토큰으로 CSV 다운로드.

        Parameters:
            otp: _generate_otp()에서 받은 토큰
            timeout: 요청 타임아웃

        Returns:
            CSV 원문 문자열 (디코딩됨)
        """
        self._rate_limit()
        resp = self._session.post(CSV_URL, data={"code": otp}, timeout=timeout)
        resp.raise_for_status()

        raw_bytes = resp.content

        # "LOGOUT" 감지 (CSV 대신 HTML 반환)
        if b"LOGOUT" in raw_bytes[:200] or b"<!DOCTYPE" in raw_bytes[:200]:
            raise KRXOTPError(
                "[KRX-OTP] CSV 다운로드 실패: 로그인 세션 만료 "
                "(data.krx.co.kr 직접 로그인 후 재시도)"
            )

        # EUC-KR 자동 감지
        for encoding in ("euc-kr", "cp949", "utf-8-sig", "utf-8"):
            try:
                return raw_bytes.decode(encoding)
            except (UnicodeDecodeError, LookupError):
                continue

        raise KRXOTPError("[KRX-OTP] CSV 인코딩 감지 실패")

    def fetch_csv(self, stat_url: str, params: dict,
                  otp_timeout: int = 15, csv_timeout: int = 30) -> str:
        """
        OTP 생성 → CSV 다운로드, 재시도 + 지수 백오프.

        Parameters:
            stat_url: KRX stat 페이지 (예: "dbms/MDC/STAT/standard/MDCSTAT02301")
            params: 추가 파라미터 dict
            otp_timeout: OTP 생성 타임아웃
            csv_timeout: CSV 다운로드 타임아웃

        Returns:
            CSV 원문 문자열

        Raises:
            KRXOTPError: 모든 재시도 실패 시
        """
        last_error = None

        for attempt in range(self._max_retries):
            try:
                if self.verbose and attempt > 0:
                    print(f"  [KRX-OTP] 재시도 {attempt + 1}/{self._max_retries}")

                otp = self._generate_otp(stat_url, params, timeout=otp_timeout)
                csv_text = self._download_csv(otp, timeout=csv_timeout)

                if self.verbose:
                    print(f"  [KRX-OTP] CSV 수신 ({len(csv_text):,} bytes)")

                return csv_text

            except KRXOTPError:
                # LOGOUT 등 치명적 에러 — 재시도 무의미
                raise
            except requests.exceptions.Timeout as e:
                last_error = e
                wait = self._backoff_base * (2 ** attempt)
                if self.verbose:
                    print(f"  [KRX-OTP] 타임아웃, {wait:.1f}s 대기 후 재시도")
                time.sleep(wait)
            except requests.exceptions.RequestException as e:
                last_error = e
                wait = self._backoff_base * (2 ** attempt)
                if self.verbose:
                    print(f"  [KRX-OTP] 요청 실패 ({e}), {wait:.1f}s 대기 후 재시도")
                time.sleep(wait)

        raise KRXOTPError(
            f"[KRX-OTP] {self._max_retries}회 재시도 실패: {stat_url} — {last_error}"
        )


# ── CLI 테스트 ──
if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")

    client = KRXOTPClient(verbose=True)

    print("=" * 60)
    print("  KRX OTP Client 연결 테스트")
    print("=" * 60)

    try:
        # 투자자별 매매동향 테스트 (KOSPI, 최근 1일)
        csv_text = client.fetch_csv(
            stat_url="dbms/MDC/STAT/standard/MDCSTAT02301",
            params={"mktId": "STK", "strtDd": "20260401", "endDd": "20260401"},
        )
        lines = csv_text.strip().split("\n")
        print(f"[KRX-OTP] 투자자별 매매동향: {len(lines) - 1} rows")
        if lines:
            print(f"  컬럼: {lines[0][:100]}...")
        print("[KRX-OTP] 연결 성공!")
    except KRXOTPError as e:
        print(f"[KRX-OTP] {e}")
        print("[KRX-OTP] 참고: data.krx.co.kr 로그인 필요 (2025.12 이후)")

    print("=" * 60)
