// ══════════════════════════════════════════════════════
//  KRX LIVE — 실시간 데이터 프로바이더
//  WebSocket (Kiwoom OCX 서버) + 데모 폴백
//
//  모드 선택:
//    KRX_API_CONFIG.mode === 'ws'   → WebSocket 서버 연결 (Kiwoom)
//    KRX_API_CONFIG.mode === 'demo' → 데모 (폴링 없음, app.js에서 tick)
// ══════════════════════════════════════════════════════

class RealtimeProvider {
  constructor() {
    // ── WebSocket 상태 ──
    this._ws = null;
    this._wsReconnectTimer = null;
    this._wsReconnectDelay = 3000;  // 재연결 대기 (ms)
    this._wsMaxReconnect = 10;      // 최대 재연결 시도
    this._wsReconnectCount = 0;
    this._wsPingTimer = null;

    // ── 공통 상태 ──
    this._listeners = [];
    this._stock = null;
    this._timeframe = null;
    this._connected = false;
    this._mode = 'unknown';     // 'ws' | 'demo'
  }

  get connected() { return this._connected; }
  get mode() { return this._mode; }

  /** 틱 콜백 등록 (해제 함수 반환) */
  onTick(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== callback);
    };
  }

  /** 실시간 데이터 시작 */
  start(stock, timeframe) {
    this.stop();
    this._stock = stock;
    this._timeframe = timeframe;
    this._wsReconnectCount = 0;

    if (KRX_API_CONFIG.mode === 'ws') {
      // WebSocket 모드: Kiwoom OCX 서버 연결
      this._connectWebSocket(stock, timeframe);
    }
    // demo 모드: 폴링 없음 (app.js의 startDemoTick이 처리)
  }

  /** 실시간 데이터 중지 */
  stop() {
    // WebSocket 종료
    this._closeWebSocket();

    this._connected = false;
    this._mode = 'unknown';
  }

  // ══════════════════════════════════════════════════
  //  WebSocket 모드 (Kiwoom OCX 서버)
  // ══════════════════════════════════════════════════

  _connectWebSocket(stock, timeframe) {
    const wsUrl = KRX_API_CONFIG.wsUrl || 'ws://localhost:8765';

    // 이전 연결 정리
    this._closeWebSocket();

    try {
      this._ws = new WebSocket(wsUrl);
    } catch (e) {
      console.warn('[RealtimeProvider] WebSocket 생성 실패:', e.message);
      this._connected = false;
      this._emit({ error: true, message: 'WebSocket 생성 실패: ' + e.message });
      return;
    }

    this._ws.onopen = () => {
      this._connected = true;
      this._mode = 'ws';
      this._wsReconnectCount = 0;
      console.log('[RealtimeProvider] WebSocket 연결됨:', wsUrl);

      // 종목 구독 요청
      this._wsSend({
        type: 'subscribe',
        code: stock.code,
        market: stock.market || 'KOSPI',
        timeframe: timeframe || '1d',
      });

      // Ping 타이머 (30초마다)
      this._startPing();
    };

    this._ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleWSMessage(data);
      } catch (e) {
        console.warn('[RealtimeProvider] 메시지 파싱 실패:', e.message);
      }
    };

    this._ws.onclose = (event) => {
      console.log('[RealtimeProvider] WebSocket 닫힘 (code=%d)', event.code);
      this._connected = false;
      this._stopPing();

      // 의도적 종료가 아니면 재연결 시도
      if (this._stock && this._wsReconnectCount < this._wsMaxReconnect) {
        this._wsReconnectCount++;
        const delay = Math.min(
          this._wsReconnectDelay * Math.pow(1.5, this._wsReconnectCount - 1),
          30000
        );
        console.log(
          '[RealtimeProvider] 재연결 시도 %d/%d (%.1f초 후)',
          this._wsReconnectCount, this._wsMaxReconnect, delay / 1000
        );
        this._wsReconnectTimer = setTimeout(() => {
          if (this._stock) {
            this._connectWebSocket(this._stock, this._timeframe);
          }
        }, delay);
      } else if (this._wsReconnectCount >= this._wsMaxReconnect) {
        console.warn('[RealtimeProvider] 최대 재연결 시도 초과');
        this._emit({ error: true, message: 'WebSocket 재연결 실패' });
      }
    };

    this._ws.onerror = (event) => {
      console.warn('[RealtimeProvider] WebSocket 에러');
      // onclose가 이어서 호출됨
    };
  }

  _closeWebSocket() {
    this._stopPing();

    if (this._wsReconnectTimer) {
      clearTimeout(this._wsReconnectTimer);
      this._wsReconnectTimer = null;
    }

    if (this._ws) {
      // 재연결 방지를 위해 핸들러 제거
      this._ws.onclose = null;
      this._ws.onerror = null;
      this._ws.onmessage = null;
      try {
        if (this._ws.readyState === WebSocket.OPEN) {
          this._wsSend({ type: 'unsubscribe' });
          this._ws.close(1000, 'Client stop');
        } else if (this._ws.readyState === WebSocket.CONNECTING) {
          this._ws.close();
        }
      } catch (e) { /* 무시 */ }
      this._ws = null;
    }
  }

  _wsSend(obj) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }

  _startPing() {
    this._stopPing();
    this._wsPingTimer = setInterval(() => {
      this._wsSend({ type: 'ping' });
    }, 30000);
  }

  _stopPing() {
    if (this._wsPingTimer) {
      clearInterval(this._wsPingTimer);
      this._wsPingTimer = null;
    }
  }

  _handleWSMessage(data) {
    const type = data.type;

    if (type === 'candles') {
      // 서버에서 보낸 캔들 데이터
      this._connected = true;
      this._mode = 'ws';

      this._emit({
        candles: data.candles || [],
        currentPrice: data.currentPrice || 0,
        previousClose: data.previousClose || 0,
        dayHigh: data.dayHigh || 0,
        dayLow: data.dayLow || 0,
        dayOpen: data.dayOpen || 0,
        volume: data.volume || 0,
        change: data.change || 0,
        changeRatio: data.changeRatio || 0,
        marketState: data.marketState || 'closed',
      });

    } else if (type === 'market_index') {
      // 서버에서 보낸 KOSPI/KOSDAQ 지수 데이터
      this._updateMarketIndex(data);

    } else if (type === 'pong') {
      // 핑/퐁 응답 — 연결 확인
    } else if (type === 'unsubscribed') {
      console.log('[RealtimeProvider] 구독 해제 완료');
    } else if (type === 'error') {
      console.warn('[RealtimeProvider] 서버 에러:', data.message);
    }
  }

  // ══════════════════════════════════════════════════
  //  지수 데이터 헤더 업데이트
  // ══════════════════════════════════════════════════

  /**
   * 서버에서 수신한 KOSPI/KOSDAQ 지수를 헤더 #t-kospi 등에 반영.
   * change >= 0이면 up 클래스, 아니면 dn 클래스 적용.
   */
  _updateMarketIndex(data) {
    const _fmt = (v, decimals) => {
      if (v == null) return '--';
      return Number(v).toLocaleString('ko-KR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };

    if (data.kospi) {
      const el = document.getElementById('t-kospi');
      if (el) {
        el.textContent = _fmt(data.kospi.value, 2);
        el.className = 'ticker-val ' + (data.kospi.change >= 0 ? 'up' : 'dn');
      }
    }
    if (data.kosdaq) {
      const el = document.getElementById('t-kosdaq');
      if (el) {
        el.textContent = _fmt(data.kosdaq.value, 2);
        el.className = 'ticker-val ' + (data.kosdaq.change >= 0 ? 'up' : 'dn');
      }
    }
    if (data.usdkrw) {
      const el = document.getElementById('t-usd');
      if (el) {
        el.textContent = _fmt(data.usdkrw.value, 2);
        el.className = 'ticker-val ' + (data.usdkrw.change >= 0 ? 'up' : 'dn');
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  공통
  // ══════════════════════════════════════════════════

  _emit(data) {
    this._listeners.forEach(fn => {
      try { fn(data); } catch (e) { console.error('[RealtimeProvider] listener error:', e); }
    });
  }
}

// 글로벌 인스턴스
const realtimeProvider = new RealtimeProvider();
