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
    // ── WebSocket 상태 (WS URL은 api.js에서 설정됨) ──
    this._ws = null;
    this._wsReconnectTimer = null;
    this._wsReconnectDelay = 2000;  // 재연결 초기 대기 (ms) — 서버 기동 시간 고려
    this._wsMaxReconnect = 20;      // 최대 재연결 시도 (~5분 커버리지)
    this._wsReconnectCount = 0;
    this._wsPingTimer = null;

    // ── 공통 상태 ──
    this._listeners = [];
    this._stock = null;
    this._timeframe = null;
    this._connected = false;
    this._mode = 'unknown';     // 'ws' | 'demo'

    // ── 서버 상태 콜백 (app.js에서 등록) ──
    // onServerStatus(status, message) — status: 'login_pending' | 'ready' | 'login_failed'
    this.onServerStatus = null;

    // ── 로그인 에러 수신 플래그 (Login Error Latch) ──
    // true이면 서버가 로그인 실패 상태 — 재연결 시도 억제
    // When true, server has login failure — suppress reconnection attempts
    this._loginErrorReceived = false;

    // ── 연결 상태 변경 콜백 (Connection Management UI) ──
    // onConnectionChange(state) — state: 'connected' | 'reconnecting' | 'failed'
    this.onConnectionChange = null;
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
      // 로그인 에러 수신 상태면 WS 연결 시도하지 않음 (계정 잠금 방지)
      // Skip WS connection if loginError was previously received (account lock prevention)
      if (this._loginErrorReceived) {
        console.warn('[RealtimeProvider] 로그인 에러 상태 — WS 연결 생략 (계정 보호)');
        this._emit({ error: true, message: 'Kiwoom 로그인 실패 상태 — 서버 재시작 필요' });
        return;
      }
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

  /**
   * 새 WS 서버 주소로 재연결
   * @param {string} wsUrl - 새 WebSocket 서버 주소
   */
  reconnectTo(wsUrl) {
    this.stop();
    this._wsReconnectCount = 0;
    KRX_API_CONFIG.wsUrl = wsUrl;
    if (this._stock) {
      this.start(this._stock, this._timeframe);
    }
  }

  // ══════════════════════════════════════════════════
  //  WebSocket 모드 (Kiwoom OCX 서버)
  // ══════════════════════════════════════════════════

  _connectWebSocket(stock, timeframe) {
    const wsUrl = KRX_API_CONFIG.wsUrl || _defaultWsUrl || 'ws://localhost:8765';

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

      // 연결 상태 콜백 (Connection Management UI)
      if (this.onConnectionChange) this.onConnectionChange('connected');

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

      // 연결 상태 콜백 (Connection Management UI)
      if (this.onConnectionChange) {
        this.onConnectionChange(
          this._wsReconnectCount >= this._wsMaxReconnect ? 'failed' : 'reconnecting'
        );
      }

      // 의도적 종료가 아니면 재연결 시도
      // 로그인 에러 수신 후에는 절대 재연결하지 않음 (계정 잠금 방지)
      // NEVER reconnect after receiving loginError (account lock prevention)
      if (this._loginErrorReceived) {
        console.warn('[RealtimeProvider] 로그인 에러 수신 후 재연결 차단 (계정 보호)');
        this._emit({ error: true, message: 'Kiwoom 로그인 실패 — 서버 재시작 필요' });
      } else if (this._stock && this._wsReconnectCount < this._wsMaxReconnect) {
        this._wsReconnectCount++;
        const baseDelay = this._wsReconnectDelay * Math.pow(1.5, this._wsReconnectCount - 1);
        const jitter = Math.random() * baseDelay * 0.3;  // 30% 지터 (다수 클라이언트 동시 재연결 방지)
        const delay = Math.min(baseDelay + jitter, 15000);
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

    } else if (type === 'loginError') {
      // ── Kiwoom 로그인 에러 (계정 잠금 방지) ──
      // Login error from server — do NOT auto-reconnect to prevent account lockout
      console.error('[RealtimeProvider] Kiwoom 로그인 에러:', data.message);

      // 로그인 에러 래치 설정 — start() 호출 시에도 재연결 억제
      // Set login error latch — suppresses reconnection even when start() is called
      this._loginErrorReceived = true;

      // 자동 재연결 즉시 중단 (로그인 에러에 재연결하면 계정 잠금 위험!)
      // Stop auto-reconnect immediately — reconnecting on login errors risks account lockout!
      this._wsReconnectCount = this._wsMaxReconnect;

      // 사용자에게 에러 표시 (UI toast)
      const isFatal = data.fatal || data.blocked;
      this._showLoginError(data.message, isFatal);

      // 에러 이벤트 emit (app.js 등에서 추가 처리 가능)
      this._emit({
        error: true,
        loginError: true,
        message: data.message,
        fatal: data.fatal,
        blocked: data.blocked,
        attempts: data.attempts,
        maxAttempts: data.maxAttempts,
      });

    } else if (type === 'serverStatus') {
      // ── 서버 상태 알림 (로그인 대기 / 준비 완료 / 로그인 실패) ──
      var status = data.status;    // 'login_pending' | 'ready' | 'login_failed'
      var message = data.message || '';
      console.log('[RealtimeProvider] 서버 상태:', status, message);

      // 상태 이벤트 발송 (app.js에서 처리)
      if (this.onServerStatus) {
        this.onServerStatus(status, message);
      }

      // ready 상태 → 로그인 에러 래치 해제 (서버 로그인 성공)
      // Ready status → clear login error latch (server login succeeded)
      if (status === 'ready') {
        this._loginErrorReceived = false;
      }

      // ready 상태이면 현재 구독 재전송 (로그인 완료 후 즉시 데이터 수신)
      if (status === 'ready' && this._stock) {
        this._wsSend({
          type: 'subscribe',
          code: this._stock.code,
          market: this._stock.market || 'KOSPI',
          timeframe: this._timeframe || '1d',
        });
      }

    } else if (type === 'pong') {
      // 핑/퐁 응답 — 연결 확인
    } else if (type === 'unsubscribed') {
      console.log('[RealtimeProvider] 구독 해제 완료');
    } else if (type === 'error') {
      console.warn('[RealtimeProvider] 서버 에러:', data.message);
    }
  }

  /**
   * 로그인 에러를 사용자에게 시각적으로 표시.
   * Display login error to the user via a visible toast/banner.
   */
  _showLoginError(message, isFatal) {
    // 기존 로그인 에러 토스트 제거
    const existing = document.getElementById('login-error-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'login-error-toast';
    toast.style.cssText = [
      'position: fixed',
      'top: 20px',
      'left: 50%',
      'transform: translateX(-50%)',
      'z-index: 99999',
      'padding: 16px 24px',
      'border-radius: 8px',
      'font-size: 14px',
      'font-weight: 600',
      'max-width: 600px',
      'text-align: center',
      'box-shadow: 0 4px 20px ' + KRX_COLORS.BOX_SHADOW_DARK,
      isFatal
        ? 'background: #B71C1C; color: #fff; border: 2px solid #E53935'
        : 'background: #E65100; color: #fff; border: 2px solid #FF6D00',
    ].join('; ');

    const icon = isFatal ? '[CRITICAL]' : '[WARNING]';
    toast.textContent = `${icon} ${message}`;

    // 닫기 버튼
    const closeBtn = document.createElement('span');
    closeBtn.textContent = ' X';
    closeBtn.style.cssText = 'cursor: pointer; margin-left: 12px; opacity: 0.8;';
    closeBtn.onclick = () => toast.remove();
    toast.appendChild(closeBtn);

    document.body.appendChild(toast);

    // Fatal이 아니면 30초 후 자동 제거
    if (!isFatal) {
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 30000);
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
