# ══════════════════════════════════════════════════════
#  KRX WebSocket 실시간 데이터 서버 v3.0
#
#  Kiwoom OCX 직접 연결 (PyQt5 + websockets 하이브리드)
#
#  DataProvider 추상화 유지:
#  - KiwoomProvider (현재 구현): Kiwoom OpenAPI+ OCX
#  - KoscomProvider (스텁): Koscom API 연결 대비
#
#  아키텍처:
#  - 메인 스레드: PyQt5 QApplication + Kiwoom OCX
#  - 별도 스레드: asyncio + websockets 서버
#  - 스레드 간 통신: queue.Queue
#
#  kiwoom_project(KNOWSTOCK)와 완전 독립 프로세스
#  (동시 실행 불가 — Kiwoom 동시 접속 1개 제한)
# ══════════════════════════════════════════════════════

import sys
import json
import asyncio
import logging
import os
import queue
import threading
import time
import collections
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Optional, Dict, Set, List

# ── PyQt5 (32-bit 전용) ──
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import QTimer, QThread, pyqtSignal, QObject
from PyQt5.QAxContainer import QAxWidget

# ── WebSocket ──
import websockets
import websockets.server

# ── 로깅 설정 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("krx-ws")


# ══════════════════════════════════════════════════════
#  설정
# ══════════════════════════════════════════════════════

WS_HOST = os.getenv("KRX_WS_HOST", "0.0.0.0")
WS_PORT = int(os.getenv("KRX_WS_PORT", "8765"))
HISTORY_DAYS = 365
SCREEN_BASE = 2000          # 화면번호 시작 (KNOWSTOCK과 겹치지 않도록)
SCREEN_REALTIME = "2001"    # 실시간 체결 화면번호
SCREEN_INDEX = "2002"       # 지수 실시간 화면번호
TR_THROTTLE_MS = 250        # TR 요청 간격 (ms) — 초당 4회 제한

# ── 로그인 보호 설정 (Login Protection) ──
# 키움 계정은 비밀번호 5회 연속 실패 시 잠금됨 (해제에 3~4일 소요).
# Kiwoom accounts lock after 5 consecutive failed password attempts (3-4 day unlock).
# 안전 마진을 위해 최대 2회만 시도.
MAX_LOGIN_ATTEMPTS = 2          # 최대 로그인 시도 횟수 (절대 5 이상 금지!)
LOGIN_COOLDOWN_SEC = 60         # 로그인 실패 후 재시도 대기 (초)
# 비밀번호 오류로 추정되는 에러코드 (자동 재시도 금지)
# Error codes that indicate password/auth failure (NEVER auto-retry)
LOGIN_FATAL_ERRORS = {-101, -100, -106}  # -101: 비밀번호 오류/연결 실패, -100: 사용자 취소, -106: 이중 로그인

# ── 영구 로그인 시도 카운터 (Persistent Login Guard) ──
# 프로세스 재시작 시에도 시도 횟수를 보존하여 계정 잠금 방지.
# Preserves attempt count across process restarts to prevent account lockout.
# 파일 위치: server/.login_guard.json
# 만료 시간: LOGIN_GUARD_EXPIRY_SEC 이후 자동 리셋 (정상 로그인 후 또는 시간 경과).
LOGIN_GUARD_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".login_guard.json")
LOGIN_GUARD_EXPIRY_SEC = 3600    # 1시간 후 자동 리셋 (비밀번호 수정 후 여유 시간)
LOGIN_GUARD_MAX_TOTAL = 3        # 재시작 포함 총 최대 시도 (키움 5회 한도의 안전 마진)


def _load_login_guard() -> dict:
    """영구 로그인 가드 파일 로드. 만료 시 리셋.
    Load persistent login guard file. Reset if expired.
    """
    try:
        if os.path.exists(LOGIN_GUARD_FILE):
            with open(LOGIN_GUARD_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            # 만료 확인
            first_attempt = data.get("first_attempt_time", 0)
            if first_attempt and (time.time() - first_attempt) > LOGIN_GUARD_EXPIRY_SEC:
                log.info("[LOGIN_GUARD] 가드 파일 만료 (%.0f분 경과) → 리셋",
                         (time.time() - first_attempt) / 60)
                _reset_login_guard()
                return {"total_attempts": 0, "first_attempt_time": 0,
                        "locked": False, "last_error": None}
            return data
    except (json.JSONDecodeError, OSError, KeyError) as e:
        log.warning("[LOGIN_GUARD] 가드 파일 읽기 실패: %s → 리셋", e)
    return {"total_attempts": 0, "first_attempt_time": 0,
            "locked": False, "last_error": None}


def _save_login_guard(data: dict):
    """영구 로그인 가드 파일 저장.
    Save persistent login guard file.
    """
    try:
        with open(LOGIN_GUARD_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except OSError as e:
        log.error("[LOGIN_GUARD] 가드 파일 저장 실패: %s", e)


def _reset_login_guard():
    """로그인 가드 파일 삭제 (로그인 성공 시 또는 만료 시).
    Delete login guard file (on successful login or expiry).
    """
    try:
        if os.path.exists(LOGIN_GUARD_FILE):
            os.remove(LOGIN_GUARD_FILE)
            log.info("[LOGIN_GUARD] 가드 파일 리셋 완료")
    except OSError as e:
        log.warning("[LOGIN_GUARD] 가드 파일 삭제 실패: %s", e)


# ══════════════════════════════════════════════════════
#  KRX 장 상태 판별
# ══════════════════════════════════════════════════════

def get_market_state() -> str:
    """
    현재 KRX 장 상태 반환.
    - 'pre'   : 08:30 ~ 09:00 (프리마켓)
    - 'open'  : 09:00 ~ 15:30 (정규장)
    - 'close' : 15:30 ~ 16:00 (시간외 단일가)
    - 'closed': 나머지 (장 종료)
    """
    now = datetime.now()
    if now.weekday() >= 5:
        return "closed"

    t = now.hour * 100 + now.minute
    if t < 830:
        return "closed"
    elif t < 900:
        return "pre"
    elif t < 1530:
        return "open"
    elif t < 1600:
        return "close"
    else:
        return "closed"


# ══════════════════════════════════════════════════════
#  TR 요청 쓰로틀러 (슬라이딩 윈도우)
#
#  키움 OpenAPI 제한: 초당 5회.
#  안전 마진 포함 초당 4회 제한.
#  이 서버는 독립 프로세스이므로 직접 슬립 허용.
# ══════════════════════════════════════════════════════

class TRThrottler:
    """슬라이딩 윈도우 기반 TR 요청 쓰로틀러."""

    def __init__(self, max_calls: int = 4, window_sec: float = 1.0):
        self._max_calls = max_calls
        self._window_sec = window_sec
        self._timestamps = collections.deque()

    def acquire(self) -> float:
        """호출 가능할 때까지 대기. 대기한 시간(초) 반환.

        PyQt5 메인 스레드에서 호출되므로 time.sleep() 대신
        QApplication.processEvents()로 이벤트 루프를 유지하며 대기.
        """
        waited = 0.0
        now = time.time()
        while self._timestamps and (now - self._timestamps[0]) >= self._window_sec:
            self._timestamps.popleft()
        if len(self._timestamps) >= self._max_calls:
            sleep_sec = self._window_sec - (now - self._timestamps[0]) + 0.02
            if sleep_sec > 0:
                # time.sleep() → processEvents 폴링으로 변경 (메인 스레드 블로킹 방지)
                deadline = time.time() + sleep_sec
                while time.time() < deadline:
                    QApplication.processEvents()
                    time.sleep(0.01)
                waited = sleep_sec
            now = time.time()
            while self._timestamps and (now - self._timestamps[0]) >= self._window_sec:
                self._timestamps.popleft()
        self._timestamps.append(time.time())
        return waited


# ══════════════════════════════════════════════════════
#  DataProvider 추상 클래스
#
#  데이터 소스 교체 시 이 인터페이스만 구현하면 됨.
#  - KiwoomProvider: Kiwoom OCX (현재 구현)
#  - KoscomProvider: Koscom API (스텁, 향후 연결)
# ══════════════════════════════════════════════════════

class DataProvider(ABC):
    """
    KRX 데이터 소스 추상 클래스.
    교체 시 provider만 변경하면 됨.
    """

    @abstractmethod
    def get_daily_candles(self, code: str, days: int = HISTORY_DAYS) -> list:
        """
        일봉 OHLCV 히스토리 조회.

        Returns:
            [{'time': 'YYYY-MM-DD', 'open': int, 'high': int,
              'low': int, 'close': int, 'volume': int}, ...]
        """
        ...

    @abstractmethod
    def get_minute_candles(self, code: str, interval: int = 1) -> list:
        """
        분봉 OHLCV 조회.

        Args:
            code: 종목코드 (6자리)
            interval: 분봉 간격 (1, 3, 5, 10, 15, 30, 60)

        Returns:
            [{'time': unix_timestamp, 'open': int, 'high': int,
              'low': int, 'close': int, 'volume': int}, ...]
        """
        ...

    @abstractmethod
    def get_current_price(self, code: str) -> Optional[dict]:
        """
        현재가 조회.

        Returns:
            {'price': int, 'open': int, 'high': int, 'low': int,
             'volume': int, 'change': int, 'changeRatio': float,
             'previousClose': int} 또는 None
        """
        ...

    @abstractmethod
    def get_stock_name(self, code: str) -> str:
        """종목명 조회"""
        ...

    @abstractmethod
    def subscribe_realtime(self, code: str):
        """실시간 체결 데이터 구독"""
        ...

    @abstractmethod
    def unsubscribe_realtime(self, code: str):
        """실시간 체결 데이터 해제"""
        ...

    @abstractmethod
    def unsubscribe_all(self):
        """모든 실시간 구독 해제"""
        ...

    @abstractmethod
    def is_connected(self) -> bool:
        """API 연결 상태"""
        ...

    def get_market_indices(self) -> dict:
        """
        KOSPI/KOSDAQ 지수 조회.
        기본 구현: 빈 딕셔너리.
        """
        return {}


# ══════════════════════════════════════════════════════
#  KiwoomProvider — Kiwoom OpenAPI+ OCX 직접 연결
#
#  C:\OpenAPI\khopenapi.ocx 등록 필수 (regsvr32)
#  PyQt5 QApplication 메인 스레드에서만 호출 가능.
#
#  KNOWSTOCK(kiwoom_project)와 완전 독립:
#  - 별도 프로세스, 별도 화면번호 대역 (2000~)
#  - 동시 실행 불가 (Kiwoom 동시 접속 1개 제한)
# ══════════════════════════════════════════════════════

class KiwoomProvider(DataProvider):
    """
    Kiwoom OpenAPI+ OCX 기반 데이터 제공.

    메인 스레드(PyQt5)에서만 호출해야 합니다.
    dynamicCall은 COM 호출이므로 반드시 OCX 생성 스레드에서 실행.

    TR 요청:
    - opt10081: 주식 일봉 차트 (일봉 히스토리)
    - opt10080: 주식 분봉 차트 (분봉 히스토리)
    - opt10001: 주식 기본 정보 (현재가, 종목명)

    실시간:
    - SetRealReg: 실시간 체결 등록
    - FID 10(현재가), 11(전일대비), 12(등락률), 13(누적거래량),
      15(거래량), 16(시가), 17(고가), 18(저가), 20(체결시간), 25(전일대비기호)
    """

    def __init__(self):
        self.ocx = QAxWidget("KHOPENAPI.KHOpenAPICtrl.1")
        self._connected = False
        self._login_event = threading.Event()
        self._subscribed_codes: Set[str] = set()
        self._screen_counter = SCREEN_BASE
        self._throttler = TRThrottler(max_calls=4, window_sec=1.0)

        # TR 응답 대기용
        self._tr_event = threading.Event()
        self._tr_data: dict = {}

        # 실시간 콜백
        self._realtime_callback = None

        # 지수 실시간 콜백
        self._index_callback = None

        # 종목명 캐시
        self._name_cache: Dict[str, str] = {}

        # ── 로그인 보호 상태 (Login Protection State) ──
        # 계정 잠금 방지: 시도 횟수 추적 + 쿨다운 + 치명적 에러 차단
        # Account lock prevention: attempt tracking + cooldown + fatal error blocking
        self._login_attempt_count = 0           # 누적 로그인 시도 횟수
        self._login_last_attempt_time = 0.0     # 마지막 시도 시간 (time.time())
        self._login_locked = False              # True이면 로그인 시도 완전 차단
        self._login_last_error: Optional[int] = None  # 마지막 에러코드

        # 로그인 에러 → WS 클라이언트 브로드캐스트용 콜백
        # Callback for broadcasting login errors to all WS clients
        self._login_error_callback = None

        # 이벤트 연결
        self.ocx.OnEventConnect.connect(self._on_event_connect)
        self.ocx.OnReceiveTrData.connect(self._on_receive_tr_data)
        self.ocx.OnReceiveRealData.connect(self._on_receive_real_data)

        log.info("KiwoomProvider 초기화 완료 (OCX: KHOPENAPI.KHOpenAPICtrl.1)")

    def _next_screen(self) -> str:
        """화면번호 생성 (2000~2999 순환)"""
        self._screen_counter += 1
        if self._screen_counter > 2999:
            self._screen_counter = SCREEN_BASE + 10
        return str(self._screen_counter)

    # ── dynamicCall 안전 래퍼 ──

    def _call(self, func_str, *args):
        """dynamicCall 래퍼 — COM 연결 끊김 시 안전 반환."""
        try:
            if len(args) > 8:
                return self.ocx.dynamicCall(func_str, list(args))
            else:
                return self.ocx.dynamicCall(func_str, *args)
        except Exception as exc:
            log.warning("[KIWOOM] dynamicCall 실패 (%s): %s",
                        func_str.split("(")[0], exc)
            return None

    # ── 로그인 (Login with Account Lock Protection) ──
    #
    # [중요] 키움 계정 잠금 방지
    # Kiwoom locks the account after 5 consecutive failed password attempts.
    # Unlocking requires 3-4 business days via customer service.
    # This code enforces:
    #   1. Hard limit of MAX_LOGIN_ATTEMPTS (default: 2) attempts
    #   2. LOGIN_COOLDOWN_SEC (default: 60s) between attempts
    #   3. Permanent block on fatal errors (wrong password, etc.)
    #   4. Clear error broadcasting to all WebSocket clients

    def set_login_error_callback(self, callback):
        """로그인 에러 발생 시 WS 클라이언트에 브로드캐스트할 콜백 등록.
        Register callback to broadcast login errors to WS clients.
        """
        self._login_error_callback = callback

    def _can_attempt_login(self) -> bool:
        """로그인 시도 가능 여부 확인.
        Check if a login attempt is allowed (account lock prevention).

        Returns False and logs reason if:
        - Permanently locked (fatal error encountered)
        - Max attempts exceeded (in-memory)
        - Persistent guard: total attempts across restarts exceeded
        - Cooldown period active
        """
        # 치명적 에러 후 영구 차단 (비밀번호 오류 등)
        # Permanently blocked after fatal error (wrong password, etc.)
        if self._login_locked:
            log.error(
                "[KIWOOM] 로그인 차단됨 — 치명적 에러 발생 이력 (에러코드: %s). "
                "서버를 재시작하기 전에 비밀번호를 확인하세요.",
                self._login_last_error
            )
            log.error(
                "[KIWOOM] LOGIN BLOCKED — fatal error previously occurred (code: %s). "
                "Verify your password before restarting the server.",
                self._login_last_error
            )
            return False

        # ── 영구 가드 확인 (재시작 간 누적 카운터) ──
        # Persistent guard check (cumulative counter across restarts)
        guard = _load_login_guard()
        if guard.get("locked"):
            log.error(
                "[KIWOOM] 영구 가드 차단됨 — 이전 세션에서 치명적 에러 발생 "
                "(에러코드: %s). .login_guard.json 삭제 후 재시작하세요.",
                guard.get("last_error")
            )
            log.error(
                "[KIWOOM] PERSISTENT GUARD BLOCKED — fatal error in previous session "
                "(code: %s). Delete .login_guard.json and restart.",
                guard.get("last_error")
            )
            self._login_locked = True
            self._login_last_error = guard.get("last_error")
            return False

        if guard.get("total_attempts", 0) >= LOGIN_GUARD_MAX_TOTAL:
            log.error(
                "[KIWOOM] 재시작 포함 총 로그인 시도 %d/%d회 초과 — 계정 잠금 방지를 위해 차단합니다. "
                ".login_guard.json 삭제 후 비밀번호 확인 후 재시작하세요.",
                guard["total_attempts"], LOGIN_GUARD_MAX_TOTAL
            )
            log.error(
                "[KIWOOM] TOTAL login attempts across restarts %d/%d exceeded — "
                "blocked to prevent account lockout. "
                "Delete .login_guard.json after verifying password, then restart.",
                guard["total_attempts"], LOGIN_GUARD_MAX_TOTAL
            )
            return False

        # 최대 시도 횟수 초과 (세션 내)
        # Max attempts exceeded (within this session)
        if self._login_attempt_count >= MAX_LOGIN_ATTEMPTS:
            log.error(
                "[KIWOOM] 로그인 시도 횟수 초과 (%d/%d) — 계정 잠금 방지를 위해 중단합니다. "
                "수동으로 HTS에서 로그인을 확인한 후 서버를 재시작하세요.",
                self._login_attempt_count, MAX_LOGIN_ATTEMPTS
            )
            log.error(
                "[KIWOOM] Login attempt limit reached (%d/%d) — stopped to prevent account lockout. "
                "Verify login via HTS manually, then restart the server.",
                self._login_attempt_count, MAX_LOGIN_ATTEMPTS
            )
            return False

        # 쿨다운 확인
        # Cooldown check
        elapsed = time.time() - self._login_last_attempt_time
        if self._login_attempt_count > 0 and elapsed < LOGIN_COOLDOWN_SEC:
            remaining = LOGIN_COOLDOWN_SEC - elapsed
            log.warning(
                "[KIWOOM] 로그인 쿨다운 중 — %.0f초 후 재시도 가능 (계정 보호)",
                remaining
            )
            log.warning(
                "[KIWOOM] Login cooldown active — retry possible in %.0f seconds (account protection)",
                remaining
            )
            return False

        return True

    def login(self, auto=True):
        """CommConnect() — 로그인. 계정 잠금 방지 로직 포함.
        CommConnect() — Login with account lock prevention.

        auto=True면 자동로그인 시도 (HTS 자동로그인 설정 필요).
        Returns False if login attempt was blocked.
        """
        if not self._can_attempt_login():
            self._broadcast_login_error(
                "로그인 시도가 차단되었습니다 (계정 잠금 방지). "
                "서버를 재시작하거나 HTS에서 수동 로그인하세요.",
                blocked=True
            )
            return False

        self._login_attempt_count += 1
        self._login_last_attempt_time = time.time()

        # ── 영구 가드 업데이트 (Persistent guard update) ──
        guard = _load_login_guard()
        guard["total_attempts"] = guard.get("total_attempts", 0) + 1
        if not guard.get("first_attempt_time"):
            guard["first_attempt_time"] = time.time()
        _save_login_guard(guard)

        if auto:
            log.info(
                "[KIWOOM] 자동로그인 시도 %d/%d (총 누적: %d/%d)...",
                self._login_attempt_count, MAX_LOGIN_ATTEMPTS,
                guard["total_attempts"], LOGIN_GUARD_MAX_TOTAL,
            )
        else:
            log.info(
                "[KIWOOM] 수동로그인 시작 (시도 %d/%d, 총 누적: %d/%d)...",
                self._login_attempt_count, MAX_LOGIN_ATTEMPTS,
                guard["total_attempts"], LOGIN_GUARD_MAX_TOTAL,
            )

        self._login_event.clear()
        self._call("CommConnect()")
        return True

    def _on_event_connect(self, err_code):
        """OnEventConnect 이벤트 핸들러.
        Login result callback from Kiwoom OCX.

        err_code == 0: 성공
        err_code != 0: 실패 — 에러코드에 따라 재시도 차단 여부 결정
        """
        if err_code == 0:
            self._connected = True
            # 로그인 성공 → 영구 가드 리셋 (누적 카운터 초기화)
            # Login success → reset persistent guard (clear cumulative counter)
            _reset_login_guard()
            user_id = self._call("GetLoginInfo(QString)", "USER_ID") or ""
            accounts = self._call("GetLoginInfo(QString)", "ACCNO") or ""
            server = self._call("GetLoginInfo(QString)", "GetServerGubun") or ""
            server_name = "모의투자" if server == "1" else "실서버"
            log.info(
                "[KIWOOM] 로그인 성공 (ID: %s, 서버: %s, 계좌수: %d, 시도: %d회)",
                user_id, server_name, len(accounts.split(";")) - 1,
                self._login_attempt_count
            )
        else:
            self._connected = False
            self._login_last_error = err_code

            # 치명적 에러 판별 — 비밀번호 오류 시 절대 재시도 금지
            # Fatal error check — NEVER retry on password errors
            if err_code in LOGIN_FATAL_ERRORS:
                self._login_locked = True
                # 영구 가드에도 잠금 기록 (재시작해도 차단 유지)
                # Record lock in persistent guard (survives restarts)
                guard = _load_login_guard()
                guard["locked"] = True
                guard["last_error"] = err_code
                _save_login_guard(guard)
                log.critical(
                    "[KIWOOM] *** 로그인 치명적 실패 (에러코드: %d) ***", err_code
                )
                log.critical(
                    "[KIWOOM] *** 자동 재시도 영구 차단됨 — 비밀번호 확인 필요 ***"
                )
                log.critical(
                    "[KIWOOM] *** FATAL LOGIN FAILURE (code: %d) ***", err_code
                )
                log.critical(
                    "[KIWOOM] *** Auto-retry permanently disabled — verify password ***"
                )
                log.critical(
                    "[KIWOOM] *** 해제: .login_guard.json 삭제 후 비밀번호 확인 후 재시작 ***"
                )
                self._broadcast_login_error(
                    f"로그인 실패 (에러코드: {err_code}). "
                    "비밀번호를 확인하세요. 자동 재시도가 차단되었습니다. "
                    "서버 재시작으로도 해제 불가 — .login_guard.json 삭제 필요.",
                    fatal=True
                )
            else:
                log.error(
                    "[KIWOOM] 로그인 실패 (에러코드: %d, 시도: %d/%d)",
                    err_code, self._login_attempt_count, MAX_LOGIN_ATTEMPTS
                )
                remaining = MAX_LOGIN_ATTEMPTS - self._login_attempt_count
                if remaining > 0:
                    log.warning(
                        "[KIWOOM] 남은 로그인 시도: %d회 (쿨다운 %d초 후 가능)",
                        remaining, LOGIN_COOLDOWN_SEC
                    )
                else:
                    log.error(
                        "[KIWOOM] 로그인 시도 소진 — 서버를 재시작하세요."
                    )
                self._broadcast_login_error(
                    f"로그인 실패 (에러코드: {err_code}, 시도: {self._login_attempt_count}/{MAX_LOGIN_ATTEMPTS}). "
                    f"남은 시도: {remaining}회.",
                    fatal=False
                )

        self._login_event.set()

    def _broadcast_login_error(self, message: str, fatal: bool = False,
                                blocked: bool = False):
        """로그인 에러를 WS 클라이언트에 브로드캐스트.
        Broadcast login error to all connected WS clients.
        """
        if self._login_error_callback:
            self._login_error_callback({
                "type": "loginError",
                "message": message,
                "fatal": fatal,          # True = 비밀번호 오류 (재시도 금지)
                "blocked": blocked,      # True = 시도 차단됨
                "attempts": self._login_attempt_count,
                "maxAttempts": MAX_LOGIN_ATTEMPTS,
                "errorCode": self._login_last_error,
            })

    def wait_for_login(self, timeout: float = 120.0) -> bool:
        """로그인 완료까지 대기 (QTimer 기반)"""
        return self._login_event.wait(timeout=timeout)

    def is_connected(self) -> bool:
        if not self._connected:
            return False
        state = self._call("GetConnectState()")
        try:
            return int(state) == 1 if state is not None else False
        except (TypeError, ValueError):
            return False

    # ── TR 요청 공통 ──

    def _set_input(self, key: str, value: str):
        self._call("SetInputValue(QString,QString)", key, value)

    def _request_tr(self, rqname: str, trcode: str, screen: str,
                    prev_next: int = 0, timeout: float = 10.0) -> dict:
        """TR 요청 후 응답 대기. 쓰로틀링 적용.

        PyQt5 이벤트 루프를 유지하면서 대기해야 OnReceiveTrData가 수신됨.
        threading.Event.wait()는 메인 스레드를 블로킹하여 데드락 유발.
        """
        self._throttler.acquire()
        self._tr_event.clear()
        self._tr_data = {}

        ret = self._call("CommRqData(QString,QString,int,QString)",
                         rqname, trcode, prev_next, screen)
        if ret is None or int(ret) != 0:
            log.warning("[TR] CommRqData 실패: %s (ret=%s)", rqname, ret)
            return {}

        # PyQt 이벤트 루프를 유지하며 응답 대기 (데드락 방지)
        deadline = time.time() + timeout
        while not self._tr_event.is_set():
            if time.time() > deadline:
                log.warning("[TR] 응답 타임아웃: %s (%s)", rqname, trcode)
                return {}
            QApplication.processEvents()
            time.sleep(0.01)

        return self._tr_data

    def _on_receive_tr_data(self, screen, rqname, trcode,
                            record, prev_next, *_args):
        """OnReceiveTrData 이벤트 핸들러"""
        try:
            if rqname == "일봉조회":
                self._parse_daily_candles(trcode, record, prev_next)
            elif rqname == "분봉조회":
                self._parse_minute_candles(trcode, record, prev_next)
            elif rqname == "현재가조회":
                self._parse_current_price(trcode, record)
            elif rqname == "종목정보":
                self._parse_stock_info(trcode, record, prev_next)
            else:
                log.debug("[TR] 미처리 rqname: %s", rqname)
        except Exception as e:
            log.error("[TR] 응답 파싱 오류 (%s): %s", rqname, e)
        finally:
            self._tr_event.set()

    # ── 일봉 조회 (opt10081) ──

    def get_daily_candles(self, code: str, days: int = HISTORY_DAYS) -> list:
        """opt10081 — 주식 일봉 차트 조회"""
        if not self._connected:
            log.warning("[TR] 미연결 상태 — 일봉 조회 불가 (%s)", code)
            return []

        screen = self._next_screen()
        today = datetime.now().strftime("%Y%m%d")

        self._set_input("종목코드", code)
        self._set_input("기준일자", today)
        self._set_input("수정주가구분", "1")

        result = self._request_tr("일봉조회", "opt10081", screen)
        candles = result.get("candles", [])

        # 요청 기간보다 많으면 잘라냄
        if candles and days < 9999:
            cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            candles = [c for c in candles if c["time"] >= cutoff]

        log.info("[TR] 일봉 조회 완료: %s %d건", code, len(candles))
        return candles

    def _parse_daily_candles(self, trcode, record, prev_next):
        """opt10081 응답 파싱"""
        count = self._call("GetRepeatCnt(QString,QString)", trcode, record)
        count = int(count) if count else 0

        candles = []
        for i in range(count):
            date_raw = (self._call("GetCommData(QString,QString,int,QString)",
                                   trcode, record, i, "일자") or "").strip()
            if not date_raw or len(date_raw) < 8:
                continue

            time_str = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
            o = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "시가") or "0").strip()))
            h = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "고가") or "0").strip()))
            l = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "저가") or "0").strip()))
            c = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "현재가") or "0").strip()))
            v = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "거래량") or "0").strip()))

            if o == 0 and h == 0 and l == 0 and c == 0:
                continue

            candles.append({
                "time": time_str,
                "open": o, "high": h, "low": l, "close": c,
                "volume": v,
            })

        # opt10081은 최신 날짜가 먼저 → 역순 정렬
        candles.reverse()
        self._tr_data = {"candles": candles, "prev_next": prev_next}

    # ── 분봉 조회 (opt10080) ──

    def get_minute_candles(self, code: str, interval: int = 1) -> list:
        """opt10080 — 주식 분봉 차트 조회"""
        if not self._connected:
            log.warning("[TR] 미연결 상태 — 분봉 조회 불가 (%s)", code)
            return []

        screen = self._next_screen()

        self._set_input("종목코드", code)
        self._set_input("틱범위", str(interval))
        self._set_input("수정주가구분", "1")

        result = self._request_tr("분봉조회", "opt10080", screen)
        candles = result.get("candles", [])

        log.info("[TR] 분봉(%d분) 조회 완료: %s %d건", interval, code, len(candles))
        return candles

    def _parse_minute_candles(self, trcode, record, prev_next):
        """opt10080 응답 파싱"""
        count = self._call("GetRepeatCnt(QString,QString)", trcode, record)
        count = int(count) if count else 0
        log.debug("[TR] 분봉 파싱 시작: record=%s, count=%d", record, count)

        candles = []
        skipped = 0
        for i in range(count):
            dt_raw = (self._call("GetCommData(QString,QString,int,QString)",
                                 trcode, record, i, "체결시간") or "").strip()
            if not dt_raw or len(dt_raw) < 12:
                skipped += 1
                if i < 3:
                    log.debug("[TR] 분봉[%d] 체결시간 누락/짧음: '%s'", i, dt_raw)
                continue

            # 체결시간: "YYYYMMDDHHMMSS" → Unix timestamp
            try:
                dt = datetime.strptime(dt_raw[:12], "%Y%m%d%H%M")
                ts = int(dt.timestamp())
            except ValueError:
                skipped += 1
                continue

            o = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "시가") or "0").strip()))
            h = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "고가") or "0").strip()))
            l = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "저가") or "0").strip()))
            c = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "현재가") or "0").strip()))
            v = abs(int((self._call("GetCommData(QString,QString,int,QString)",
                                    trcode, record, i, "거래량") or "0").strip()))

            if o == 0 and h == 0 and l == 0 and c == 0:
                skipped += 1
                continue

            candles.append({
                "time": ts,
                "open": o, "high": h, "low": l, "close": c,
                "volume": v,
            })

        if skipped > 0:
            log.debug("[TR] 분봉 파싱 스킵: %d건 (총 %d건 중 유효 %d건)",
                      skipped, count, len(candles))

        # opt10080은 최신 체결이 먼저 → 역순 정렬
        candles.reverse()
        self._tr_data = {"candles": candles, "prev_next": prev_next}

    # ── 현재가 조회 (opt10001) ──

    def get_current_price(self, code: str) -> Optional[dict]:
        """opt10001 — 주식 기본 정보 (현재가 조회)"""
        if not self._connected:
            return None

        screen = self._next_screen()
        self._set_input("종목코드", code)

        result = self._request_tr("현재가조회", "opt10001", screen)
        return result.get("price_info")

    def _parse_current_price(self, trcode, record):
        """opt10001 응답 파싱 (현재가)"""
        def _get(item):
            v = self._call("GetCommData(QString,QString,int,QString)",
                           trcode, record, 0, item)
            return (v or "").strip()

        price = abs(int(_get("현재가") or "0"))
        change = int(_get("전일대비") or "0")
        ratio_str = _get("등락율") or "0"
        try:
            ratio = float(ratio_str)
        except ValueError:
            ratio = 0.0

        open_p = abs(int(_get("시가") or "0"))
        high = abs(int(_get("고가") or "0"))
        low = abs(int(_get("저가") or "0"))
        volume = abs(int(_get("거래량") or "0"))
        prev_close = abs(int(_get("전일종가") or "0"))

        # 전일종가가 0이면 현재가에서 역산
        if prev_close == 0 and price > 0:
            prev_close = price - change

        stock_code = _get("종목코드") or ""
        name = _get("종목명") or stock_code
        if stock_code:
            self._name_cache[stock_code] = name

        self._tr_data = {
            "price_info": {
                "price": price,
                "open": open_p,
                "high": high,
                "low": low,
                "volume": volume,
                "change": abs(change),
                "changeSign": 1 if change > 0 else (-1 if change < 0 else 0),
                "changeRatio": ratio,
                "previousClose": prev_close,
                "marketStatus": get_market_state().upper(),
            },
            "name": name,
        }

    # ── 종목 정보 ──

    def _parse_stock_info(self, trcode, record, prev_next):
        """종목정보 TR 응답 파싱 (opt10001 종목명 등)"""
        def _get(item):
            v = self._call("GetCommData(QString,QString,int,QString)",
                           trcode, record, 0, item)
            return (v or "").strip()

        name = _get("종목명")
        code = _get("종목코드")
        if code and name:
            self._name_cache[code] = name
        self._tr_data = {"name": name, "code": code}

    def get_stock_name(self, code: str) -> str:
        """종목명 조회 (캐시 → GetMasterCodeName)"""
        if code in self._name_cache:
            return self._name_cache[code]

        name = self._call("GetMasterCodeName(QString)", code)
        if name:
            name = name.strip()
            self._name_cache[code] = name
            return name
        return code

    def get_stock_list(self, market: str = "0") -> List[dict]:
        """
        전체 종목 목록 조회.
        market: '0'=KOSPI, '10'=KOSDAQ, '8'=ETF
        """
        codes_str = self._call("GetCodeListByMarket(QString)", market)
        if not codes_str:
            return []

        stocks = []
        for code in codes_str.split(";"):
            code = code.strip()
            if not code:
                continue
            name = self.get_stock_name(code)
            stocks.append({
                "code": code,
                "name": name,
                "market": "KOSPI" if market == "0" else "KOSDAQ",
            })

        return stocks

    # ── 실시간 체결 ──

    def subscribe_realtime(self, code: str):
        """SetRealReg — 실시간 체결 등록"""
        if not self._connected:
            log.warning("[REAL] 미연결 — 실시간 등록 불가 (%s)", code)
            return

        # FID: 10(현재가), 11(전일대비), 12(등락률), 13(누적거래량),
        #      15(거래량), 16(시가), 17(고가), 18(저가), 20(체결시간),
        #      25(전일대비기호), 228(체결강도), 27(매도호가), 28(매수호가)
        fids = "10;11;12;13;15;16;17;18;20;25;228"

        # 0=기존 해제 후 등록, 1=기존 유지 추가 등록
        opt = "1" if self._subscribed_codes else "0"
        self._call("SetRealReg(QString,QString,QString,QString)",
                    SCREEN_REALTIME, code, fids, opt)
        self._subscribed_codes.add(code)
        log.info("[REAL] 실시간 등록: %s (총 %d종목)",
                 code, len(self._subscribed_codes))

    def unsubscribe_realtime(self, code: str):
        """SetRealRemove — 특정 종목 실시간 해제"""
        if code in self._subscribed_codes:
            self._call("SetRealRemove(QString,QString)", SCREEN_REALTIME, code)
            self._subscribed_codes.discard(code)
            log.info("[REAL] 실시간 해제: %s (남은 %d종목)",
                     code, len(self._subscribed_codes))

    def unsubscribe_all(self):
        """모든 실시간 해제"""
        if self._subscribed_codes:
            self._call("SetRealRemove(QString,QString)", SCREEN_REALTIME, "ALL")
            count = len(self._subscribed_codes)
            self._subscribed_codes.clear()
            log.info("[REAL] 전체 실시간 해제 (%d종목)", count)

    def subscribe_index_realtime(self):
        """KOSPI/KOSDAQ 지수 실시간 등록"""
        if not self._connected:
            return
        # 업종코드: 001=KOSPI, 101=KOSDAQ
        # 지수 FID: 10(현재가), 11(전일대비), 12(등락률)
        fids = "10;11;12"
        self._call("SetRealReg(QString,QString,QString,QString)",
                    SCREEN_INDEX, "001", fids, "0")
        self._call("SetRealReg(QString,QString,QString,QString)",
                    SCREEN_INDEX, "101", fids, "1")
        log.info("[REAL] 지수 실시간 등록 (KOSPI, KOSDAQ)")

    def _on_receive_real_data(self, code, real_type, real_data):
        """OnReceiveRealData 이벤트 핸들러"""
        try:
            if real_type == "주식체결":
                self._handle_stock_tick(code)
            elif real_type == "업종지수":
                self._handle_index_tick(code)
        except Exception as e:
            log.error("[REAL] 실시간 데이터 처리 오류 (%s, %s): %s",
                      code, real_type, e)

    def _get_real(self, code: str, fid: int) -> str:
        """GetCommRealData 래퍼"""
        v = self._call("GetCommRealData(QString,int)", code, fid)
        return (v or "").strip()

    def _handle_stock_tick(self, code: str):
        """주식체결 실시간 데이터 처리"""
        price = abs(int(self._get_real(code, 10) or "0"))
        change = int(self._get_real(code, 11) or "0")
        ratio_str = self._get_real(code, 12) or "0"
        try:
            ratio = float(ratio_str)
        except ValueError:
            ratio = 0.0
        cum_vol = abs(int(self._get_real(code, 13) or "0"))
        volume = abs(int(self._get_real(code, 15) or "0"))
        open_p = abs(int(self._get_real(code, 16) or "0"))
        high = abs(int(self._get_real(code, 17) or "0"))
        low = abs(int(self._get_real(code, 18) or "0"))
        time_str = self._get_real(code, 20) or ""    # HHMMSS
        sign = self._get_real(code, 25) or ""         # 전일대비기호

        if price == 0:
            return

        tick_data = {
            "code": code,
            "price": price,
            "open": open_p,
            "high": high,
            "low": low,
            "volume": volume,
            "cumVolume": cum_vol,
            "change": abs(change),
            "changeSign": 1 if change > 0 else (-1 if change < 0 else 0),
            "changeRatio": ratio,
            "time": time_str,
            "sign": sign,
        }

        if self._realtime_callback:
            self._realtime_callback(tick_data)

    def _handle_index_tick(self, code: str):
        """업종지수 실시간 데이터 처리"""
        value_str = self._get_real(code, 10) or "0"
        change_str = self._get_real(code, 11) or "0"
        ratio_str = self._get_real(code, 12) or "0"

        try:
            value = abs(float(value_str.replace("+", "").replace("-", "")))
            change = float(change_str)
            ratio = float(ratio_str)
        except ValueError:
            return

        index_name = "kospi" if code == "001" else "kosdaq" if code == "101" else None
        if not index_name:
            return

        index_data = {
            "name": index_name,
            "value": value,
            "change": change,
            "changeRatio": ratio,
        }

        if self._index_callback:
            self._index_callback(index_data)

    def set_realtime_callback(self, callback):
        """실시간 체결 콜백 등록"""
        self._realtime_callback = callback

    def set_index_callback(self, callback):
        """지수 실시간 콜백 등록"""
        self._index_callback = callback

    def get_market_indices(self) -> dict:
        """현재가 기준 KOSPI/KOSDAQ 지수 조회 (TR)"""
        # 실시간 구독으로 대체되므로, 초기값 제공용
        return {}


# ══════════════════════════════════════════════════════
#  KoscomProvider — Koscom API (스텁)
#
#  Koscom 스타트업 프로그램:
#  - 7년 미만 기업 3년 무료
#  - 실시간 체결, 호가, 일봉/분봉 제공
#  - REST + WebSocket 지원
# ══════════════════════════════════════════════════════

class KoscomProvider(DataProvider):
    """
    Koscom API 기반 데이터 제공 (스텁).

    교체 시:
      1. Koscom API 키 환경변수 설정 (KOSCOM_API_KEY)
      2. KRX_PROVIDER='koscom' 으로 변경
      3. 아래 메서드 구현
    """

    def __init__(self):
        self.api_key = os.getenv("KOSCOM_API_KEY", "")
        self.base_url = os.getenv(
            "KOSCOM_BASE_URL",
            "https://sandbox-apigw.koscom.co.kr",
        )
        if not self.api_key:
            log.warning(
                "KoscomProvider: KOSCOM_API_KEY 환경변수 미설정. "
                "스텁 모드로 동작합니다."
            )

    def get_daily_candles(self, code, days=HISTORY_DAYS):
        log.warning("KoscomProvider.get_daily_candles() 미구현 (%s)", code)
        return []

    def get_minute_candles(self, code, interval=1):
        log.warning("KoscomProvider.get_minute_candles() 미구현 (%s)", code)
        return []

    def get_current_price(self, code):
        log.warning("KoscomProvider.get_current_price() 미구현 (%s)", code)
        return None

    def get_stock_name(self, code):
        return code

    def subscribe_realtime(self, code):
        log.warning("KoscomProvider.subscribe_realtime() 미구현 (%s)", code)

    def unsubscribe_realtime(self, code):
        pass

    def unsubscribe_all(self):
        pass

    def is_connected(self):
        return bool(self.api_key)


# ══════════════════════════════════════════════════════
#  캔들 캐시 (TR 호출 절약)
# ══════════════════════════════════════════════════════

_candle_cache: Dict[str, dict] = {}
CACHE_TTL = timedelta(hours=1)


def _pykrx_daily_fallback(code: str, days: int = 365) -> list:
    """pykrx 폴백 — Kiwoom TR이 장외에 빈 결과 반환 시 사용"""
    try:
        from pykrx import stock as pykrx_stock
        d = datetime.now()
        while d.weekday() >= 5:
            d -= timedelta(days=1)
        to_date = d.strftime("%Y%m%d")
        from_date = (d - timedelta(days=days)).strftime("%Y%m%d")
        df = pykrx_stock.get_market_ohlcv_by_date(from_date, to_date, code)
        if df is None or df.empty:
            return []
        candles = []
        for idx, row in df.iterrows():
            o, h, l, c, v = int(row.iloc[0]), int(row.iloc[1]), int(row.iloc[2]), int(row.iloc[3]), int(row.iloc[4])
            if o == 0 and h == 0 and l == 0 and c == 0:
                continue
            candles.append({
                "time": idx.strftime("%Y-%m-%d"),
                "open": o, "high": h, "low": l, "close": c, "volume": v,
            })
        log.info("[pykrx 폴백] %s 일봉 %d건 로드", code, len(candles))
        return candles
    except Exception as e:
        log.warning("[pykrx 폴백] 실패 %s: %s", code, e)
        return []


def get_cached_candles(provider: DataProvider, code: str,
                       timeframe: str = "1d") -> list:
    """캐시된 캔들 반환. 만료 시 provider를 통해 재조회. 빈 결과면 폴백."""
    cache_key = f"{code}:{timeframe}"
    cached = _candle_cache.get(cache_key)
    if cached and (datetime.now() - cached["updated"]) < CACHE_TTL:
        return cached["candles"]

    if timeframe == "1d":
        candles = provider.get_daily_candles(code)
        # Kiwoom TR이 장외에 빈 결과 반환 시 pykrx 폴백
        if not candles:
            log.info("[폴백] Kiwoom 일봉 0건 → pykrx 시도: %s", code)
            candles = _pykrx_daily_fallback(code)
    else:
        interval_map = {"1m": 1, "3m": 3, "5m": 5, "10m": 10,
                        "15m": 15, "30m": 30, "1h": 60}
        interval = interval_map.get(timeframe, 1)
        candles = provider.get_minute_candles(code, interval)
        # Kiwoom 분봉 TR 0건 시 로그만 남김 (Naver 폴백 제거)
        if not candles:
            log.warning("[분봉] Kiwoom TR 0건: %s (%s) — 장중에 실시간 틱으로 생성",
                        code, timeframe)

    if candles:
        _candle_cache[cache_key] = {
            "candles": candles, "updated": datetime.now()
        }

    return candles


def update_last_candle(code: str, tick: dict):
    """장중 실시간 틱으로 마지막 일봉 캔들 업데이트."""
    cache_key = f"{code}:1d"
    cached = _candle_cache.get(cache_key)
    if not cached or not cached["candles"]:
        return

    candles = cached["candles"]
    today_str = datetime.now().strftime("%Y-%m-%d")
    price = tick.get("price", 0)
    if price <= 0:
        return

    o = tick.get("open", price)
    h = tick.get("high", price)
    l = tick.get("low", price)
    v = tick.get("cumVolume", 0)

    if candles and candles[-1]["time"] == today_str:
        last = candles[-1]
        if o > 0:
            last["open"] = o
        last["high"] = max(last["high"], h, price)
        last["low"] = min(last["low"], l, price) if l > 0 else min(last["low"], price)
        last["close"] = price
        last["volume"] = v if v > 0 else last["volume"]
    else:
        candles.append({
            "time": today_str,
            "open": o if o > 0 else price,
            "high": max(h, price),
            "low": min(l, price) if l > 0 else price,
            "close": price,
            "volume": v,
        })


def update_minute_candle(code: str, tick: dict, timeframe: str):
    """장중 실시간 틱으로 분봉 캔들 업데이트 (마지막 봉 갱신 또는 새 봉 생성)."""
    cache_key = f"{code}:{timeframe}"
    cached = _candle_cache.get(cache_key)
    if not cached or not cached["candles"]:
        return

    interval_map = {"1m": 60, "3m": 180, "5m": 300, "10m": 600,
                    "15m": 900, "30m": 1800, "1h": 3600}
    interval_sec = interval_map.get(timeframe, 60)

    candles = cached["candles"]
    price = tick.get("price", 0)
    if price <= 0:
        return

    volume = abs(int(tick.get("volume", 0)))  # 이 틱의 체결량
    now_ts = int(time.time())

    # 현재 시간에 해당하는 봉의 시작 타임스탬프
    candle_start = (now_ts // interval_sec) * interval_sec

    if candles and candles[-1]["time"] == candle_start:
        # 기존 봉 업데이트
        last = candles[-1]
        last["high"] = max(last["high"], price)
        last["low"] = min(last["low"], price)
        last["close"] = price
        last["volume"] += volume
    else:
        # 새 봉 생성
        candles.append({
            "time": candle_start,
            "open": price,
            "high": price,
            "low": price,
            "close": price,
            "volume": volume,
        })
        # 캔들 수 제한 (최대 200개)
        if len(candles) > 200:
            candles.pop(0)


# ══════════════════════════════════════════════════════
#  WebSocket 브릿지 (별도 스레드)
#
#  PyQt5(메인 스레드)와 asyncio(WS 스레드) 사이의 통신:
#  - command_queue: WS → 메인 (subscribe/unsubscribe 요청)
#  - broadcast(): 메인 → WS (tick/candles 전송)
# ══════════════════════════════════════════════════════

class WebSocketBridge:
    """
    WebSocket 서버를 별도 스레드에서 운영.
    메인 스레드의 KiwoomProvider와 queue로 통신.
    """

    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set = set()
        self.command_queue = queue.Queue()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None

        # 클라이언트별 구독 종목 추적
        self._client_subs: Dict[int, str] = {}
        # 클라이언트별 구독 타임프레임
        self._client_tfs: Dict[int, str] = {}

        # 새 클라이언트 연결 시 호출할 콜백 (캐시된 데이터 전송용)
        self._on_connect_callback = None

        # 새 클라이언트 연결 시 즉시 전송할 초기 메시지 (지수 등)
        # ServerController가 지수 업데이트 시 갱신
        self._init_messages: Dict[str, str] = {}  # key → JSON string

    def start(self):
        """별도 스레드에서 WebSocket 서버 시작"""
        self._thread = threading.Thread(
            target=self._run_server, daemon=True, name="ws-server"
        )
        self._thread.start()
        log.info("WebSocket 서버 스레드 시작 (ws://%s:%d/ws)",
                 self.host, self.port)

    def _run_server(self):
        """asyncio 이벤트 루프 실행 (별도 스레드)"""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        async def _serve():
            async with websockets.server.serve(
                self._handler,
                self.host,
                self.port,
                ping_interval=30,
                ping_timeout=10,
                max_size=10 * 1024 * 1024,
            ) as server:
                log.info("WebSocket 서버 리스닝: ws://%s:%d", self.host, self.port)
                await asyncio.Future()  # run forever

        self._loop.run_until_complete(_serve())

    def set_on_connect_callback(self, callback):
        """새 클라이언트 연결 시 호출할 콜백 등록.
        callback(client_id) — 캐시된 지수 등 초기 데이터 전송용.
        """
        self._on_connect_callback = callback

    async def _handler(self, ws):
        """WebSocket 클라이언트 핸들러"""
        client_id = id(ws)
        self.clients.add(ws)
        log.info("[WS] 클라이언트 연결: %d (총 %d)", client_id, len(self.clients))

        # 새 클라이언트에게 캐시된 초기 데이터 전송 (지수 등)
        for key, msg_json in self._init_messages.items():
            try:
                await ws.send(msg_json)
            except Exception as e:
                log.error("[WS] 초기 데이터 전송 실패 (%s): %s", key, e)

        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    await ws.send(json.dumps({
                        "type": "error", "message": "Invalid JSON"
                    }))
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "subscribe":
                    code = msg.get("code", "").strip()
                    market = msg.get("market", "KOSPI").strip()
                    timeframe = msg.get("timeframe", "1d").strip()

                    if not code or len(code) != 6:
                        await ws.send(json.dumps({
                            "type": "error",
                            "message": f"Invalid stock code: {code}"
                        }))
                        continue

                    # 이전 구독 해제
                    old_code = self._client_subs.get(client_id)
                    if old_code and old_code != code:
                        self.command_queue.put(("unsubscribe", old_code, client_id))

                    self._client_subs[client_id] = code
                    self._client_tfs[client_id] = timeframe
                    self.command_queue.put(("subscribe", code, client_id, market, timeframe))

                    log.info("[WS] 클라이언트 %d 구독: %s (%s, %s)",
                             client_id, code, market, timeframe)

                elif msg_type == "unsubscribe":
                    code = self._client_subs.pop(client_id, None)
                    self._client_tfs.pop(client_id, None)
                    if code:
                        self.command_queue.put(("unsubscribe", code, client_id))
                    await ws.send(json.dumps({"type": "unsubscribed"}))

                elif msg_type == "ping":
                    await ws.send(json.dumps({
                        "type": "pong",
                        "ts": datetime.now().isoformat(),
                    }))

                elif msg_type == "provider":
                    await ws.send(json.dumps({
                        "type": "provider",
                        "name": PROVIDER_NAME,
                        "class": "KiwoomProvider",
                        "available": list(PROVIDERS.keys()),
                    }))

                else:
                    await ws.send(json.dumps({
                        "type": "error",
                        "message": f"Unknown message type: {msg_type}"
                    }))

        except (websockets.exceptions.ConnectionClosed, ConnectionError):
            pass
        except Exception as e:
            log.error("[WS] 핸들러 오류 (client %d): %s", client_id, e)
        finally:
            self.clients.discard(ws)
            old_code = self._client_subs.pop(client_id, None)
            self._client_tfs.pop(client_id, None)
            if old_code:
                self.command_queue.put(("unsubscribe", old_code, client_id))
            log.info("[WS] 클라이언트 연결 해제: %d (남은 %d)",
                     client_id, len(self.clients))

    def broadcast(self, message: dict, target_code: str = None):
        """
        모든 클라이언트(또는 특정 종목 구독자)에게 메시지 전송.
        메인 스레드에서 호출 → WS 스레드의 loop에 비동기 전송 예약.
        """
        if not self._loop or not self.clients:
            return

        data = json.dumps(message, ensure_ascii=False)

        async def _send():
            disconnected = set()
            for ws in list(self.clients):
                # 특정 종목 구독자만 대상
                if target_code:
                    sub_code = self._client_subs.get(id(ws))
                    if sub_code != target_code:
                        continue
                try:
                    await ws.send(data)
                except Exception:
                    disconnected.add(ws)

            for ws in disconnected:
                self.clients.discard(ws)
                cid = id(ws)
                self._client_subs.pop(cid, None)
                self._client_tfs.pop(cid, None)

        asyncio.run_coroutine_threadsafe(_send(), self._loop)

    def broadcast_all(self, message: dict):
        """모든 클라이언트에게 메시지 전송 (지수 등)"""
        self.broadcast(message, target_code=None)

    def send_to_client(self, client_id: int, message: dict):
        """특정 클라이언트에게 메시지 전송"""
        if not self._loop:
            return

        data = json.dumps(message, ensure_ascii=False)

        async def _send():
            for ws in list(self.clients):
                if id(ws) == client_id:
                    try:
                        await ws.send(data)
                    except Exception:
                        self.clients.discard(ws)
                        self._client_subs.pop(client_id, None)
                        self._client_tfs.pop(client_id, None)
                    break

        asyncio.run_coroutine_threadsafe(_send(), self._loop)

    def get_all_subscribed_codes(self) -> Set[str]:
        """현재 구독 중인 모든 종목코드"""
        return set(self._client_subs.values())


# ══════════════════════════════════════════════════════
#  Provider 팩토리
# ══════════════════════════════════════════════════════

PROVIDERS = {
    "kiwoom": KiwoomProvider,
    "koscom": KoscomProvider,
}

PROVIDER_NAME = os.getenv("KRX_PROVIDER", "kiwoom").lower()

if PROVIDER_NAME not in PROVIDERS:
    log.error(
        "알 수 없는 provider: '%s'. 사용 가능: %s. kiwoom으로 폴백합니다.",
        PROVIDER_NAME, list(PROVIDERS.keys()),
    )
    PROVIDER_NAME = "kiwoom"


# ══════════════════════════════════════════════════════
#  메인 컨트롤러 (PyQt5 메인 스레드)
#
#  QTimer를 사용하여:
#  1. WebSocket 명령 큐 처리 (100ms 간격)
#  2. 실시간 틱 → WebSocket 브로드캐스트
#  3. 지수 데이터 브로드캐스트
# ══════════════════════════════════════════════════════

class ServerController:
    """
    PyQt5 메인 스레드에서 동작하는 서버 컨트롤러.
    KiwoomProvider와 WebSocketBridge를 연결.
    """

    def __init__(self, provider: DataProvider, ws_bridge: WebSocketBridge):
        self.provider = provider
        self.ws = ws_bridge

        # 실시간 구독 참조 카운트 (여러 클라이언트가 같은 종목 구독 가능)
        self._sub_refcount: Dict[str, int] = {}

        # 지수 캐시
        self._index_cache: dict = {}

        # 틱 쓰로틀링 (클라이언트당 브로드캐스트 빈도 제한)
        self._last_broadcast: Dict[str, float] = {}
        self._broadcast_interval = 0.5  # 최소 0.5초 간격

        # ── 서버 상태 추적 (Server status tracking) ──
        # 브라우저 클라이언트에게 현재 서버 상태를 알려주기 위한 상태 관리
        # Tracks current server status for broadcasting to browser clients
        self._server_status: str = "initializing"   # initializing | login_pending | ready | login_failed
        self._server_status_message: str = "서버 초기화 중..."

        # ── 대기 중인 구독 요청 큐 (Pending subscribe queue) ──
        # 로그인 완료 전에 들어온 subscribe 요청을 저장했다가
        # 로그인 성공 후 자동으로 처리
        # Stores subscribe requests received before login completes,
        # automatically processed after successful login
        self._pending_subscribes: List[dict] = []

        # QTimer: 명령 큐 처리
        self._cmd_timer = QTimer()
        self._cmd_timer.timeout.connect(self._process_commands)
        self._cmd_timer.start(100)  # 100ms

        # 실시간 콜백 등록
        if isinstance(provider, KiwoomProvider):
            provider.set_realtime_callback(self._on_realtime_tick)
            provider.set_index_callback(self._on_index_tick)

    def set_server_status(self, status: str, message: str = ""):
        """서버 상태 변경 + 모든 WS 클라이언트에 브로드캐스트.
        Update server status and broadcast to all connected WS clients.

        Args:
            status: 'initializing' | 'login_pending' | 'ready' | 'login_failed'
            message: 사용자에게 표시할 한국어 메시지
        """
        self._server_status = status
        self._server_status_message = message
        log.info("[STATUS] 서버 상태 변경: %s — %s", status, message)

        # 모든 연결된 클라이언트에 브로드캐스트
        # Broadcast to all connected clients
        status_msg = {
            "type": "serverStatus",
            "status": status,
            "message": message,
        }
        self.ws.broadcast_all(status_msg)

        # 새 클라이언트 연결 시 즉시 전송할 캐시 갱신
        # Update cached init message for newly connecting clients
        self.ws._init_messages["serverStatus"] = json.dumps(
            status_msg, ensure_ascii=False
        )

    def get_server_status_msg(self) -> dict:
        """현재 서버 상태 메시지 딕셔너리 반환.
        Return current server status as a dict (for sending to a single client).
        """
        return {
            "type": "serverStatus",
            "status": self._server_status,
            "message": self._server_status_message,
        }

    def flush_pending_subscribes(self):
        """대기 중인 구독 요청을 모두 처리 (로그인 성공 후 호출).
        Process all queued subscribe requests (called after successful login).
        """
        if not self._pending_subscribes:
            return

        count = len(self._pending_subscribes)
        log.info("[PENDING] 대기 중인 구독 요청 %d건 처리 시작", count)

        for sub in self._pending_subscribes:
            self._handle_subscribe(
                sub["code"], sub["client_id"],
                sub["market"], sub["timeframe"]
            )

        self._pending_subscribes.clear()
        log.info("[PENDING] 대기 구독 %d건 처리 완료", count)

    def _process_commands(self):
        """WebSocket 명령 큐 처리 (메인 스레드)"""
        processed = 0
        while not self.ws.command_queue.empty() and processed < 10:
            try:
                cmd = self.ws.command_queue.get_nowait()
            except queue.Empty:
                break

            processed += 1
            action = cmd[0]

            if action == "subscribe":
                _, code, client_id, market, timeframe = cmd
                self._handle_subscribe(code, client_id, market, timeframe)

            elif action == "unsubscribe":
                _, code, client_id = cmd
                self._handle_unsubscribe(code, client_id)

    def _handle_subscribe(self, code: str, client_id: int,
                          market: str, timeframe: str):
        """종목 구독 처리 (메인 스레드).
        Handle stock subscribe request (main thread).

        로그인 전이면 큐에 저장하고 대기 상태 알림 전송.
        If not yet logged in, queue the request and notify the client.
        """
        # ── 로그인 전 구독 요청 → 큐에 저장 (Pending subscribe queue) ──
        # provider가 아직 연결되지 않았으면 캔들 조회가 불가능하므로
        # 큐에 저장하고 로그인 완료 후 자동 처리
        if isinstance(self.provider, KiwoomProvider) and not self.provider._connected:
            self._pending_subscribes.append({
                "code": code,
                "client_id": client_id,
                "market": market,
                "timeframe": timeframe,
            })
            # 클라이언트에 대기 상태 알림
            # Notify client that subscribe is queued
            self.ws.send_to_client(client_id, {
                "type": "serverStatus",
                "status": "login_pending",
                "message": "Kiwoom 로그인 대기 중... 로그인 후 자동 구독됩니다.",
            })
            log.info(
                "[PENDING] 구독 요청 큐 저장: %s (%s) → client %d (로그인 대기)",
                code, timeframe, client_id
            )
            return

        # ── 정상 구독 처리 (Normal subscribe flow) ──
        # 히스토리 캔들 전송
        candles = get_cached_candles(self.provider, code, timeframe)
        state = get_market_state()

        # 현재가 조회 (캔들 유무와 무관하게)
        current_price = 0
        previous_close = 0
        day_high = 0
        day_low = 0
        day_open = 0
        volume = 0
        change = 0
        change_ratio = 0.0

        if candles:
            previous_close = candles[-2]["close"] if len(candles) >= 2 else 0
            current_price = candles[-1]["close"]
            day_high = candles[-1]["high"]
            day_low = candles[-1]["low"]
            day_open = candles[-1].get("open", current_price)
            volume = candles[-1].get("volume", 0)

        price_info = self.provider.get_current_price(code)
        if price_info:
            current_price = price_info["price"]
            day_high = price_info.get("high", day_high)
            day_low = price_info.get("low", day_low)
            day_open = price_info.get("open", day_open)
            volume = price_info.get("volume", volume)
            change = price_info.get("change", 0)
            change_ratio = price_info.get("changeRatio", 0.0)
            previous_close = price_info.get("previousClose", previous_close)

        msg = {
            "type": "candles",
            "code": code,
            "timeframe": timeframe,
            "candles": candles or [],
            "currentPrice": current_price,
            "previousClose": previous_close,
            "dayHigh": day_high,
            "dayLow": day_low,
            "dayOpen": day_open,
            "volume": volume,
            "change": change,
            "changeRatio": change_ratio,
            "marketState": state,
            "provider": PROVIDER_NAME,
        }
        self.ws.send_to_client(client_id, msg)
        log.info("[SUB] 캔들 전송: %s (%s) %d건, 현재가=%d, 장상태=%s → client %d",
                 code, timeframe, len(candles or []), current_price, state, client_id)

        if not candles:
            log.warning("[SUB] 캔들 없음: %s (%s, 장상태=%s) — 실시간 틱 수신 시 생성 예정",
                        code, timeframe, state)

        # 실시간 구독 (참조 카운트)
        if code not in self._sub_refcount:
            self._sub_refcount[code] = 0
            self.provider.subscribe_realtime(code)

        self._sub_refcount[code] += 1

    def _handle_unsubscribe(self, code: str, client_id: int):
        """종목 구독 해제 처리 (메인 스레드)"""
        if code in self._sub_refcount:
            self._sub_refcount[code] -= 1
            if self._sub_refcount[code] <= 0:
                del self._sub_refcount[code]
                self.provider.unsubscribe_realtime(code)

    def _on_realtime_tick(self, tick: dict):
        """실시간 체결 콜백 (메인 스레드, OCX 이벤트)"""
        code = tick.get("code", "")
        if not code:
            return

        # 쓰로틀링: 같은 종목에 대해 최소 간격 이내 재전송 방지
        now = time.time()
        last = self._last_broadcast.get(code, 0)
        if (now - last) < self._broadcast_interval:
            return
        self._last_broadcast[code] = now

        # 일봉 캐시 업데이트
        update_last_candle(code, tick)

        # 해당 종목을 구독 중인 클라이언트들의 timeframe 수집
        subscribed_tfs = set()
        for cid, sub_code in list(self.ws._client_subs.items()):
            if sub_code == code:
                tf = self.ws._client_tfs.get(cid, "1d")
                subscribed_tfs.add(tf)

        if not subscribed_tfs:
            return

        # 각 timeframe별로 캔들 업데이트 & 전송
        for tf in subscribed_tfs:
            if tf != "1d":
                # 분봉 캐시 업데이트
                update_minute_candle(code, tick, tf)

            cache_key = f"{code}:{tf}"
            cached = _candle_cache.get(cache_key)
            candles = cached["candles"] if cached else []

            previous_close = 0
            if candles and len(candles) >= 2:
                previous_close = candles[-2]["close"]

            msg = {
                "type": "candles",
                "code": code,
                "timeframe": tf,
                "candles": candles,
                "currentPrice": tick["price"],
                "previousClose": previous_close,
                "dayHigh": tick.get("high", 0),
                "dayLow": tick.get("low", 0),
                "dayOpen": tick.get("open", 0),
                "volume": tick.get("cumVolume", 0),
                "change": tick.get("change", 0),
                "changeRatio": tick.get("changeRatio", 0.0),
                "marketState": get_market_state(),
                "provider": PROVIDER_NAME,
            }

            # 이 timeframe을 구독한 클라이언트에게만 전송
            self._broadcast_to_tf(code, tf, msg)

    def _broadcast_to_tf(self, code: str, timeframe: str, message: dict):
        """특정 종목+타임프레임 구독자에게만 메시지 전송"""
        if not self.ws._loop or not self.ws.clients:
            return

        data = json.dumps(message, ensure_ascii=False)

        async def _send():
            disconnected = set()
            for ws_client in list(self.ws.clients):
                cid = id(ws_client)
                if (self.ws._client_subs.get(cid) == code and
                        self.ws._client_tfs.get(cid, "1d") == timeframe):
                    try:
                        await ws_client.send(data)
                    except Exception:
                        disconnected.add(ws_client)

            for ws_client in disconnected:
                self.ws.clients.discard(ws_client)
                cid = id(ws_client)
                self.ws._client_subs.pop(cid, None)
                self.ws._client_tfs.pop(cid, None)

        asyncio.run_coroutine_threadsafe(_send(), self.ws._loop)

    def _on_index_tick(self, index_data: dict):
        """지수 실시간 콜백 (메인 스레드)"""
        name = index_data.get("name")
        if not name:
            return

        self._index_cache[name] = {
            "value": index_data["value"],
            "change": index_data["change"],
            "changeRatio": index_data["changeRatio"],
        }

        # 모든 클라이언트에게 지수 브로드캐스트
        msg = {"type": "market_index"}
        msg.update(self._index_cache)
        self.ws.broadcast_all(msg)

        # 새 클라이언트 연결 시 즉시 전송할 캐시 갱신
        self.ws._init_messages["market_index"] = json.dumps(
            msg, ensure_ascii=False
        )

    def cleanup(self):
        """종료 시 정리"""
        log.info("서버 종료 처리...")
        self._cmd_timer.stop()
        self.provider.unsubscribe_all()
        log.info("서버 종료 완료")


# ══════════════════════════════════════════════════════
#  메인 실행
# ══════════════════════════════════════════════════════

def main():
    log.info("=" * 56)
    log.info("  KRX WebSocket Server v3.0 (Kiwoom OCX)")
    log.info("  ws://%s:%d", WS_HOST, WS_PORT)
    log.info("  Provider: %s", PROVIDER_NAME)
    log.info("=" * 56)

    # PyQt5 QApplication (Kiwoom OCX 필수)
    app = QApplication(sys.argv)

    # Provider 생성
    provider = PROVIDERS[PROVIDER_NAME]()

    # WebSocket 브릿지 (별도 스레드)
    ws_bridge = WebSocketBridge(host=WS_HOST, port=WS_PORT)
    ws_bridge.start()

    # 서버 컨트롤러
    controller = ServerController(provider, ws_bridge)

    # Kiwoom 로그인 (KiwoomProvider인 경우)
    # Login with account lock protection
    if isinstance(provider, KiwoomProvider):
        # 로그인 에러 → 모든 WS 클라이언트에 브로드캐스트
        # Wire login error broadcasting to all WS clients
        def _on_login_error(error_msg: dict):
            ws_bridge.broadcast_all(error_msg)
        provider.set_login_error_callback(_on_login_error)

        # 로그인 시작 → 대기 상태 브로드캐스트
        # Login starting → broadcast pending status to all clients
        controller.set_server_status(
            "login_pending",
            "Kiwoom 로그인 대기 중..."
        )

        login_ok = provider.login()

        if not login_ok:
            log.error("[KIWOOM] 초기 로그인 시도 차단됨 — 서버는 오프라인 모드로 동작합니다.")
            log.error("[KIWOOM] Initial login attempt blocked — server will run in offline mode.")
            controller.set_server_status(
                "login_failed",
                "로그인 시도 차단됨 — 오프라인 모드"
            )

        # 로그인 완료 후 지수 실시간 등록 + 대기 구독 처리
        # Post-login: subscribe to market indices + flush pending subscribes
        def _post_login():
            if provider.is_connected():
                provider.subscribe_index_realtime()

                # 로그인 성공 → ready 상태 브로드캐스트
                # Login success → broadcast ready status
                controller.set_server_status(
                    "ready",
                    "실시간 데이터 준비 완료"
                )

                # 대기 중인 구독 요청 처리
                # Flush pending subscribe requests queued during login
                controller.flush_pending_subscribes()

                log.info("서버 준비 완료 — 클라이언트 연결 대기 중")
                log.info("Server ready — waiting for client connections")
            else:
                # 로그인 실패 → 실패 상태 브로드캐스트
                # Login failed → broadcast failure status
                controller.set_server_status(
                    "login_failed",
                    "로그인 실패 — 캐시/파일 데이터로 동작합니다. HTS에서 수동 로그인 후 서버를 재시작하세요."
                )
                log.error(
                    "[KIWOOM] 연결 실패 — 서버는 캐시/파일 데이터로 동작합니다. "
                    "수동으로 HTS 로그인 후 서버를 재시작하세요."
                )
                log.error(
                    "[KIWOOM] Connection failed — server will serve cached/file data. "
                    "Login via HTS manually, then restart the server."
                )

        # 로그인은 비동기(이벤트 기반)이므로 타이머로 상태 체크
        # Login is async (event-based), so poll status with QTimer
        # [중요] 로그인 실패 시 절대 자동 재시도하지 않음!
        # [IMPORTANT] NEVER auto-retry login on failure!
        login_check_timer = QTimer()
        login_check_count = [0]

        def _check_login():
            login_check_count[0] += 1
            if provider.is_connected():
                login_check_timer.stop()
                _post_login()
            elif provider._login_locked:
                # 치명적 에러 — 즉시 중단 (비밀번호 오류 등)
                # Fatal error — stop immediately (wrong password, etc.)
                login_check_timer.stop()
                controller.set_server_status(
                    "login_failed",
                    f"로그인 치명적 실패 (에러코드: {provider._login_last_error}) — 비밀번호 확인 후 재시작 필요"
                )
                log.critical(
                    "[KIWOOM] 로그인 영구 차단 — 비밀번호 확인 후 재시작 필요"
                )
                log.critical(
                    "[KIWOOM] Login permanently blocked — verify password and restart"
                )
            elif login_check_count[0] > 1200:  # 120초 타임아웃 (was 60s)
                login_check_timer.stop()
                controller.set_server_status(
                    "login_failed",
                    "로그인 타임아웃 (120초) — HTS에서 수동 로그인 후 서버 재시작"
                )
                log.error(
                    "[KIWOOM] 로그인 타임아웃 (120초). 자동 재시도하지 않습니다. "
                    "HTS에서 수동 로그인 후 서버를 재시작하세요."
                )
                log.error(
                    "[KIWOOM] Login timed out (120s). Will NOT auto-retry. "
                    "Login via HTS manually, then restart the server."
                )

        login_check_timer.timeout.connect(_check_login)
        login_check_timer.start(100)  # 100ms마다 체크
    else:
        # Kiwoom 이외 provider는 즉시 ready
        # Non-Kiwoom provider → immediately ready
        controller.set_server_status("ready", "서버 준비 완료")
        log.info("서버 준비 완료 — 클라이언트 연결 대기 중")

    # 종료 시 정리
    app.aboutToQuit.connect(controller.cleanup)

    # PyQt5 이벤트 루프 시작
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
