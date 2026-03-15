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
        """호출 가능할 때까지 대기. 대기한 시간(초) 반환."""
        waited = 0.0
        now = time.time()
        while self._timestamps and (now - self._timestamps[0]) >= self._window_sec:
            self._timestamps.popleft()
        if len(self._timestamps) >= self._max_calls:
            sleep_sec = self._window_sec - (now - self._timestamps[0]) + 0.02
            if sleep_sec > 0:
                time.sleep(sleep_sec)
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

    # ── 로그인 ──

    def login(self, auto=True):
        """CommConnect() — 로그인. auto=True면 자동로그인 시도."""
        if auto:
            # 키움 자동로그인: OpenAPI 레지스트리 설정
            # HTS에서 자동로그인 설정이 되어있으면 CommConnect()만으로 자동 진행
            log.info("Kiwoom 자동로그인 시도...")
        else:
            log.info("Kiwoom 수동로그인 시작...")
        self._login_event.clear()
        self._call("CommConnect()")

    def _on_event_connect(self, err_code):
        """OnEventConnect 이벤트 핸들러"""
        if err_code == 0:
            self._connected = True
            user_id = self._call("GetLoginInfo(QString)", "USER_ID") or ""
            accounts = self._call("GetLoginInfo(QString)", "ACCNO") or ""
            server = self._call("GetLoginInfo(QString)", "GetServerGubun") or ""
            server_name = "모의투자" if server == "1" else "실서버"
            log.info("Kiwoom 로그인 성공 (ID: %s, 서버: %s, 계좌수: %d)",
                     user_id, server_name, len(accounts.split(";")) - 1)
        else:
            self._connected = False
            log.error("Kiwoom 로그인 실패 (에러코드: %d)", err_code)
        self._login_event.set()

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
        """TR 요청 후 응답 대기. 쓰로틀링 적용."""
        self._throttler.acquire()
        self._tr_event.clear()
        self._tr_data = {}

        ret = self._call("CommRqData(QString,QString,int,QString)",
                         rqname, trcode, prev_next, screen)
        if ret is None or int(ret) != 0:
            log.warning("[TR] CommRqData 실패: %s (ret=%s)", rqname, ret)
            return {}

        # 응답 대기 (OnReceiveTrData에서 _tr_event.set())
        if not self._tr_event.wait(timeout=timeout):
            log.warning("[TR] 응답 타임아웃: %s (%s)", rqname, trcode)
            return {}

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

        candles = []
        for i in range(count):
            dt_raw = (self._call("GetCommData(QString,QString,int,QString)",
                                 trcode, record, i, "체결시간") or "").strip()
            if not dt_raw or len(dt_raw) < 12:
                continue

            # 체결시간: "YYYYMMDDHHMMSS" → Unix timestamp
            try:
                dt = datetime.strptime(dt_raw[:12], "%Y%m%d%H%M")
                ts = int(dt.timestamp())
            except ValueError:
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
                continue

            candles.append({
                "time": ts,
                "open": o, "high": h, "low": l, "close": c,
                "volume": v,
            })

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


def _naver_minute_fallback(code: str, timeframe: str = "1m") -> list:
    """
    Naver Finance API 폴백 — 장외 또는 Kiwoom 분봉 TR 0건 시 사용.

    Naver API 엔드포인트:
      https://api.stock.naver.com/chart/domestic/item/{code}/minute   (1분)
      https://api.stock.naver.com/chart/domestic/item/{code}/minute5  (5분)
      https://api.stock.naver.com/chart/domestic/item/{code}/minute15 (15분)
      https://api.stock.naver.com/chart/domestic/item/{code}/minute30 (30분)
      https://api.stock.naver.com/chart/domestic/item/{code}/minute60 (60분)

    응답 형식:
      [{"localDateTime":"20260313090000",
        "currentPrice":180250.0, "openPrice":180000.0,
        "highPrice":181100.0, "lowPrice":179900.0,
        "accumulatedTradingVolume":968681}, ...]
    """
    try:
        import urllib.request

        # timeframe → Naver API 경로 매핑
        naver_path_map = {
            "1m": "minute", "3m": "minute3", "5m": "minute5",
            "10m": "minute10", "15m": "minute15",
            "30m": "minute30", "1h": "minute60",
        }
        path = naver_path_map.get(timeframe, "minute")

        url = f"https://api.stock.naver.com/chart/domestic/item/{code}/{path}?count=3"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = json.loads(resp.read().decode("utf-8"))

        if not raw or not isinstance(raw, list):
            return []

        # 분봉 간격 (초)
        interval_sec_map = {
            "1m": 60, "3m": 180, "5m": 300, "10m": 600,
            "15m": 900, "30m": 1800, "1h": 3600,
        }
        interval_sec = interval_sec_map.get(timeframe, 60)

        candles = []
        for item in raw:
            dt_str = item.get("localDateTime", "")
            if len(dt_str) < 12:
                continue
            # "20260313090000" → unix timestamp
            try:
                dt = datetime.strptime(dt_str, "%Y%m%d%H%M%S")
                # 분봉 시작 시간에 정렬 (봉 시작 기준)
                ts = int(dt.timestamp())
                ts = (ts // interval_sec) * interval_sec
            except (ValueError, OSError):
                continue

            o = int(item.get("openPrice", 0))
            h = int(item.get("highPrice", 0))
            l = int(item.get("lowPrice", 0))
            c = int(item.get("currentPrice", 0))
            v = int(item.get("accumulatedTradingVolume", 0))

            if c == 0:
                continue

            candles.append({
                "time": ts,
                "open": o if o > 0 else c,
                "high": h if h > 0 else c,
                "low": l if l > 0 else c,
                "close": c,
                "volume": v,
            })

        # 중복 timestamp 제거 (같은 봉 시작시간이면 마지막 것 사용)
        seen = {}
        for candle in candles:
            seen[candle["time"]] = candle
        candles = sorted(seen.values(), key=lambda x: x["time"])

        log.info("[Naver 폴백] %s %s 분봉 %d건 로드", code, timeframe, len(candles))
        return candles

    except Exception as e:
        log.warning("[Naver 폴백] 실패 %s (%s): %s", code, timeframe, e)
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
        # Kiwoom 분봉 TR이 0건 (장외 등) → Naver Finance API 폴백
        if not candles:
            log.info("[폴백] Kiwoom 분봉 0건 → Naver 시도: %s (%s)", code, timeframe)
            candles = _naver_minute_fallback(code, timeframe)

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

    async def _handler(self, ws):
        """WebSocket 클라이언트 핸들러"""
        client_id = id(ws)
        self.clients.add(ws)
        log.info("[WS] 클라이언트 연결: %d (총 %d)", client_id, len(self.clients))

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

        # QTimer: 명령 큐 처리
        self._cmd_timer = QTimer()
        self._cmd_timer.timeout.connect(self._process_commands)
        self._cmd_timer.start(100)  # 100ms

        # 실시간 콜백 등록
        if isinstance(provider, KiwoomProvider):
            provider.set_realtime_callback(self._on_realtime_tick)
            provider.set_index_callback(self._on_index_tick)

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
        """종목 구독 처리 (메인 스레드)"""
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

        if not candles:
            log.warning("[SUB] 캔들 없음: %s (%s) — 실시간 틱 수신 시 생성 예정",
                        code, timeframe)

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
    if isinstance(provider, KiwoomProvider):
        provider.login()

        # 로그인 완료 후 지수 실시간 등록
        def _post_login():
            if provider.is_connected():
                provider.subscribe_index_realtime()
                log.info("서버 준비 완료 — 클라이언트 연결 대기 중")
            else:
                log.error("Kiwoom 연결 실패 — 재시작 필요")

        # 로그인은 비동기(이벤트 기반)이므로 타이머로 상태 체크
        login_check_timer = QTimer()
        login_check_count = [0]

        def _check_login():
            login_check_count[0] += 1
            if provider.is_connected():
                login_check_timer.stop()
                _post_login()
            elif login_check_count[0] > 600:  # 60초 타임아웃
                login_check_timer.stop()
                log.error("Kiwoom 로그인 타임아웃 (60초)")

        login_check_timer.timeout.connect(_check_login)
        login_check_timer.start(100)  # 100ms마다 체크
    else:
        log.info("서버 준비 완료 — 클라이언트 연결 대기 중")

    # 종료 시 정리
    app.aboutToQuit.connect(controller.cleanup)

    # PyQt5 이벤트 루프 시작
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
