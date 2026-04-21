// ══════════════════════════════════════════════════════
//  Pattern Trace Orchestrator — pattern-trace.js
//  Main-thread controller for the debug viewer.
//
//  Session 1 (A-MVP):
//    - Parse ?source= URL param, show banner for non-file modes
//    - File-drop + file picker -> FileReader -> JSON.parse
//    - Schema validate (schemaVersion === 1, required top-level keys)
//    - Store trace as window.__TRACE__ for console debugging
//    - Call traceCanvas.load() + tracePanel.load()
//    - Scrubber: input + change events, bar label update
//    - Spacebar toggle play/pause at 60fps rAF
//    - Shift+Space 10x speed
//
//  Session 2 (live-scan):
//    - Bootstrap candles via dataService.getCandles() (api.js)
//    - Connect realtimeProvider (production-wss / kiwoom-local)
//    - Throttled 3s re-analysis via debug Worker
//    - Tail-follow scrubber auto-advance
//    - Source badge with connection-dot status
//    - Session status line in banner
//    - Cleanup: beforeunload stops WS + terminates Worker
// ══════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Required top-level keys for schema v1 ──
  const REQUIRED_KEYS = ['schemaVersion', 'meta', 'bars', 'preAnalyze', 'perPattern', 'postPipeline'];

  // ── URL params ──
  const _params   = new URLSearchParams(window.location.search);
  const _source   = _params.get('source')  || 'file';
  const _stockCode = _params.get('code')   || '005930';
  const _market    = _params.get('market') || 'KOSPI';
  const _timeframe = _params.get('tf')     || '1d';

  // ── DOM references ──
  const dropzone       = document.getElementById('trace-dropzone');
  const fileInput      = document.getElementById('trace-file-input');
  const scrubber       = document.getElementById('trace-scrubber');
  const scrubberLabel  = document.getElementById('trace-scrubber-label');
  const sourceBadge    = document.getElementById('source-badge');
  const metaSummary    = document.getElementById('trace-meta-summary');
  const session2Banner = document.getElementById('session2-banner');

  // ── Playback state ──
  let _playing       = false;
  let _playSpeed     = 1;     // 1 = normal, 10 = 10x
  let _rafHandle     = null;
  let _lastFrameTime = 0;
  const FRAME_MS     = 1000 / 60; // ~16.7ms per frame

  // ── Live-scan state ──
  let _liveCandles     = [];          // live candle array (grows with ticks)
  let _liveWorker      = null;        // debug Worker instance (one per session)
  let _liveReqId       = 0;           // monotonic request counter for result rejection
  let _liveAnalyzeTimer = null;       // pending 3s debounce timer
  let _liveTickUnsubscribe = null;    // function returned by realtimeProvider.onTick()
  let _liveDirty       = false;       // true if new candles since last analysis
  let _tailFollow      = (_source !== 'file'); // tail-follow default on in live modes
  let _connectionDotEl = null;        // the small status dot next to badge

  // ── Connection-dot state string ──
  // 'connected' | 'reconnecting' | 'failed'
  let _connectionState = 'reconnecting';

  // ── Is a live-scan session active? ──
  const _isLive = (_source === 'production-wss' || _source === 'kiwoom-local');

  // ══════════════════════════════════════════════════════
  //  Source badge + Session 2 banner
  // ══════════════════════════════════════════════════════
  function _applySourceMode() {
    if (_source === 'production-wss') {
      sourceBadge.textContent = 'WSS';
      sourceBadge.classList.add('wss');
      _addConnectionDot();
      session2Banner.style.display = 'block';
      _updateBannerText('연결 중...');
    } else if (_source === 'kiwoom-local') {
      sourceBadge.textContent = 'Kiwoom';
      sourceBadge.classList.add('kiwoom');
      _addConnectionDot();
      session2Banner.style.display = 'block';
      _updateBannerText('연결 중...');
    } else {
      sourceBadge.textContent = 'File-replay';
      // Session 2 banner stays hidden in file mode
    }
  }

  function _addConnectionDot() {
    _connectionDotEl = document.createElement('span');
    _connectionDotEl.className = 'connection-dot reconnecting';
    sourceBadge.appendChild(_connectionDotEl);
  }

  function _setConnectionState(state) {
    // state: 'connected' | 'reconnecting' | 'failed'
    _connectionState = state;
    if (!_connectionDotEl) return;
    _connectionDotEl.className = 'connection-dot ' + state;
    // Pulse animation only when connected (live @ tail-follow)
    if (state === 'connected' && _tailFollow) {
      sourceBadge.classList.add('pulsing');
    } else {
      sourceBadge.classList.remove('pulsing');
    }
  }

  function _updateBannerText(msg) {
    if (!session2Banner) return;
    session2Banner.textContent = msg;
  }

  function _updateLiveBannerStatus() {
    if (!_isLive) return;
    const barCount  = _liveCandles.length;
    const lastBar   = _liveCandles[barCount - 1];
    let lastTime    = '';
    if (lastBar && lastBar.time) {
      if (typeof lastBar.time === 'string') {
        lastTime = lastBar.time;
      } else {
        // Unix timestamp → KST HH:MM:SS
        const d = new Date((lastBar.time + 9 * 3600) * 1000);
        lastTime = d.toISOString().slice(11, 19) + ' KST';
      }
    }
    const tf   = _tailFollow ? '[live]' : '[paused]';
    const mode = _source === 'production-wss' ? 'WSS' : 'Kiwoom';
    _updateBannerText(
      tf + ' @ ' + _stockCode + ' · ' + barCount + ' bars · last ' + (lastTime || '—') +
      ' · ' + mode + ' · ' + _timeframe
    );
  }

  // ══════════════════════════════════════════════════════
  //  Schema validation
  // ══════════════════════════════════════════════════════
  function _validate(obj) {
    if (!obj || typeof obj !== 'object') return 'JSON이 객체가 아닙니다.';
    if (obj.schemaVersion !== 1) {
      return 'schemaVersion 불일치: 기대값 1, 실제 ' + JSON.stringify(obj.schemaVersion);
    }
    for (const key of REQUIRED_KEYS) {
      if (!(key in obj)) return '필수 키 누락: "' + key + '"';
    }
    if (!Array.isArray(obj.bars))       return '"bars"는 배열이어야 합니다.';
    if (!Array.isArray(obj.perPattern)) return '"perPattern"은 배열이어야 합니다.';
    return null; // valid
  }

  // ══════════════════════════════════════════════════════
  //  Load a validated trace object
  // ══════════════════════════════════════════════════════
  function _applyTrace(trace) {
    _stopPlay(); // H1: cancel any in-flight rAF before swapping state
    window.__TRACE__ = trace; // expose for console debugging

    const barCount = trace.bars ? trace.bars.length : 0;

    // Update scrubber range
    scrubber.min   = 0;
    scrubber.max   = Math.max(0, barCount - 1);
    scrubber.value = barCount > 0 ? barCount - 1 : 0;
    _updateScrubberLabel(parseInt(scrubber.value, 10), barCount);

    // Update meta summary in header
    const meta         = trace.meta || {};
    const patternCount = _countDetectedPatterns(trace);
    metaSummary.textContent =
      (meta.stockCode ? meta.stockCode + ' ' : '') +
      (meta.market    ? meta.market + ' '    : '') +
      (meta.timeframe ? meta.timeframe + '  ' : '') +
      barCount + '봉  |  ' +
      patternCount + '개 감지  |  ' +
      (meta.durationMs ? meta.durationMs + 'ms' : '');

    // Render canvas + panel
    traceCanvas.load(trace);
    tracePanel.load(trace);

    // Fade out dropzone
    dropzone.classList.add('hidden');

    // Jump scrubber to last bar (most recent)
    const lastBar = Math.max(0, barCount - 1);
    scrubber.value = lastBar;
    traceCanvas.setScrubberBar(lastBar);
    _updateScrubberLabel(lastBar, barCount);

    // In live-scan mode, propagate tail-follow to canvas
    if (_isLive) {
      traceCanvas.setTailFollow(_tailFollow);
    }
  }

  function _countDetectedPatterns(trace) {
    let count = 0;
    if (trace.perPattern) {
      for (const pp of trace.perPattern) {
        count += (pp.detected && pp.detected.length) || 0;
      }
    }
    return count;
  }

  // ══════════════════════════════════════════════════════
  //  File reading (file-drop mode)
  // ══════════════════════════════════════════════════════
  function _readFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      let obj;
      try {
        obj = JSON.parse(e.target.result);
      } catch (err) {
        _stopPlay(); // H1: stop playback on load failure
        tracePanel.showError('JSON 파싱 실패: ' + err.message);
        return;
      }
      const err = _validate(obj);
      if (err) {
        _stopPlay(); // H1: stop playback on schema failure
        tracePanel.showError(err);
        return;
      }
      _applyTrace(obj);
    };
    reader.onerror = function () {
      _stopPlay(); // H1: stop playback on FileReader error
      tracePanel.showError('파일 읽기 실패');
    };
    reader.readAsText(file);
  }

  // ══════════════════════════════════════════════════════
  //  Drag-drop events
  // ══════════════════════════════════════════════════════
  function _initDragDrop() {
    const wrap = document.getElementById('trace-canvas-wrap');

    wrap.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
      // Ensure dropzone is visible during drag
      dropzone.classList.remove('hidden');
    });

    wrap.addEventListener('dragleave', function (e) {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });

    wrap.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) _readFile(file);
    });
  }

  // ── File picker ──
  function _initFilePicker() {
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) {
        _readFile(fileInput.files[0]);
        // Reset so same file can be re-picked
        fileInput.value = '';
      }
    });
  }

  // ══════════════════════════════════════════════════════
  //  Scrubber
  // ══════════════════════════════════════════════════════
  function _updateScrubberLabel(idx, total) {
    scrubberLabel.textContent = 'Bar ' + idx + ' / ' + (total > 0 ? total - 1 : 0);
  }

  function _initScrubber() {
    function _onScrubberChange() {
      const idx = parseInt(scrubber.value, 10);
      const total = traceCanvas.getBarCount();
      traceCanvas.setScrubberBar(idx);
      _updateScrubberLabel(idx, total);
    }

    function _onScrubberInput(e) {
      // S2-H1: only treat user-initiated events as scrubber interaction.
      // Programmatic scrubber.dispatchEvent(new Event('input')) (used by
      // pattern-card click-to-jump) fires with isTrusted=false and must NOT
      // disable tail-follow.
      if (e && e.isTrusted && _isLive && _tailFollow) {
        _tailFollow = false;
        traceCanvas.setTailFollow(false);
        sourceBadge.classList.remove('pulsing');
        _updateFollowButtonState();
        _updateBannerText('[paused] scrubber interaction');
      }
      _onScrubberChange();
    }

    scrubber.addEventListener('input',  _onScrubberInput);
    scrubber.addEventListener('change', _onScrubberChange);
  }

  // ══════════════════════════════════════════════════════
  //  Playback rAF loop
  // ══════════════════════════════════════════════════════
  function _playLoop(timestamp) {
    if (!_playing) return;
    const elapsed     = timestamp - _lastFrameTime;
    const minInterval = FRAME_MS / _playSpeed;

    if (elapsed >= minInterval) {
      _lastFrameTime = timestamp;
      const current = parseInt(scrubber.value, 10);
      const total   = traceCanvas.getBarCount();
      if (current < total - 1) {
        const next = current + 1;
        scrubber.value = next;
        traceCanvas.setScrubberBar(next);
        _updateScrubberLabel(next, total);
      } else {
        // Reached end — stop playback
        _playing = false;
        return;
      }
    }
    _rafHandle = requestAnimationFrame(_playLoop);
  }

  function _startPlay() {
    if (_playing) return;
    if (traceCanvas.getBarCount() === 0) return;
    _playing = true;
    _lastFrameTime = performance.now();
    _rafHandle = requestAnimationFrame(_playLoop);
  }

  function _stopPlay() {
    _playing = false;
    if (_rafHandle !== null) {
      cancelAnimationFrame(_rafHandle);
      _rafHandle = null;
    }
  }

  function _togglePlay() {
    if (_playing) _stopPlay(); else _startPlay();
  }

  // ══════════════════════════════════════════════════════
  //  Keyboard events
  // ══════════════════════════════════════════════════════
  function _initKeyboard() {
    document.addEventListener('keydown', function (e) {
      // Ignore when focused in an input element
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Space: toggle 10x speed
          _playSpeed = _playSpeed === 10 ? 1 : 10;
          if (!_playing) _startPlay();
        } else {
          _playSpeed = 1;
          _togglePlay();
        }
      }

      // Arrow keys: step one bar at a time
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        _stopPlay();
        const current = parseInt(scrubber.value, 10);
        const total   = traceCanvas.getBarCount();
        if (current < total - 1) {
          const next = current + 1;
          scrubber.value = next;
          traceCanvas.setScrubberBar(next);
          _updateScrubberLabel(next, total);
        }
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        _stopPlay();
        const current = parseInt(scrubber.value, 10);
        if (current > 0) {
          const prev = current - 1;
          scrubber.value = prev;
          traceCanvas.setScrubberBar(prev);
          _updateScrubberLabel(prev, traceCanvas.getBarCount());
        }
      }
    });
  }

  // ── Window resize: delegate to traceCanvas ──
  function _initWindowResize() {
    window.addEventListener('resize', function () {
      traceCanvas.resize();
    });
  }

  // ══════════════════════════════════════════════════════
  //  Live-scan: Follow button
  // ══════════════════════════════════════════════════════
  function _createFollowButton() {
    const btn = document.createElement('button');
    btn.id        = 'trace-follow-btn';
    btn.className = 'follow-btn';
    btn.textContent = '[live] Follow';
    btn.title     = 'Tail-follow: scrubber auto-advances with new bars';

    btn.addEventListener('click', function () {
      _tailFollow = !_tailFollow;
      traceCanvas.setTailFollow(_tailFollow);
      _updateFollowButtonState();
      if (_tailFollow && _connectionState === 'connected') {
        sourceBadge.classList.add('pulsing');
        _updateLiveBannerStatus();
      } else {
        sourceBadge.classList.remove('pulsing');
      }
    });

    // Insert into scrubber wrap, before play-hint
    const wrap = document.getElementById('trace-scrubber-wrap');
    const hint = document.getElementById('trace-play-hint');
    if (wrap && hint) {
      wrap.insertBefore(btn, hint);
    }
    return btn;
  }

  function _updateFollowButtonState() {
    const btn = document.getElementById('trace-follow-btn');
    if (!btn) return;
    if (_tailFollow) {
      btn.classList.add('active');
      btn.textContent = '[live] Following';
    } else {
      btn.classList.remove('active');
      btn.textContent = '[live] Follow';
    }
  }

  // ══════════════════════════════════════════════════════
  //  Live-scan: Debug Worker
  // ══════════════════════════════════════════════════════
  function _initLiveWorker() {
    if (_liveWorker) {
      // Should not happen — guard against double-init
      console.warn('[PatternTrace] Live Worker already initialized');
      return;
    }
    try {
      _liveWorker = new Worker('./pattern-trace-worker.js');
    } catch (e) {
      console.error('[PatternTrace] Failed to create debug Worker:', e.message);
      _liveWorker = null;
      return;
    }

    _liveWorker.onmessage = function (e) {
      const msg = e.data;
      if (!msg) return;

      if (msg.type === 'traceResult') {
        // Ignore stale results from prior request IDs
        if (msg.requestId !== _liveReqId) {
          console.log('[PatternTrace] Worker: stale result ignored (req %d, current %d)',
            msg.requestId, _liveReqId);
          return;
        }
        _onLiveTraceResult(msg.trace);
      } else if (msg.type === 'ready') {
        console.log('[PatternTrace] Debug Worker ready');
      } else if (msg.type === 'error') {
        console.error('[PatternTrace] Worker error:', msg.message);
      }
    };

    _liveWorker.onerror = function (e) {
      console.error('[PatternTrace] Worker uncaught error:', e.message);
    };
  }

  // ── Throttled re-analysis trigger (3-second debounce) ──
  function _scheduleLiveAnalysis() {
    if (!_liveDirty) return;   // nothing new since last analysis
    if (!_liveWorker) return;  // worker not available

    if (_liveAnalyzeTimer !== null) {
      clearTimeout(_liveAnalyzeTimer);
      _liveAnalyzeTimer = null;
    }

    _liveAnalyzeTimer = setTimeout(function () {
      _liveAnalyzeTimer = null;
      if (!_liveDirty || !_liveWorker || !_liveCandles.length) return;

      _liveDirty = false;
      const reqId = ++_liveReqId;

      // Slice to avoid passing the live reference into worker (structured clone handles it)
      const candlesSnapshot = _liveCandles.slice();

      _liveWorker.postMessage({
        type:       'trace',
        candles:    candlesSnapshot,
        stockCode:  _stockCode,
        market:     _market,
        timeframe:  _timeframe,
        traceLevel: 'mid',
        requestId:  reqId,
      });

      console.log('[PatternTrace] Analysis dispatched to Worker (req %d, %d bars)',
        reqId, candlesSnapshot.length);
    }, 3000); // 3s throttle — same as production appUI.js:1131
  }

  // ── Handle Worker result ──
  function _onLiveTraceResult(trace) {
    if (!trace) return;

    _applyTrace(trace);

    // If tail-following, advance scrubber to last bar
    if (_tailFollow) {
      const barCount = traceCanvas.getBarCount();
      const lastBar  = Math.max(0, barCount - 1);
      scrubber.min   = 0;
      scrubber.max   = lastBar;
      scrubber.value = lastBar;
      traceCanvas.setScrubberBar(lastBar);
      _updateScrubberLabel(lastBar, barCount);
    }

    _updateLiveBannerStatus();
  }

  // ══════════════════════════════════════════════════════
  //  Live-scan: Tick handler
  // ══════════════════════════════════════════════════════

  /**
   * Append or update the current-bar candle from a realtime tick.
   * The tick payload from realtimeProvider._emit() has the shape of the
   * 'candles' WS message:
   *   { candles: [], currentPrice, previousClose, dayHigh, dayLow, dayOpen, volume, change, ... }
   * Or a direct tick shape from a server update.
   * We synthesize/update the last bar using currentPrice + dayOpen/H/L/volume.
   */
  function _onTick(tick) {
    if (!tick || tick.error) {
      // Connection error tick — do not append
      return;
    }

    // If server sent a full candles array (WS candles message), use it as seed
    if (tick.candles && Array.isArray(tick.candles) && tick.candles.length > 0) {
      if (_liveCandles.length === 0) {
        // First full candle history received — seed the live array
        _liveCandles = tick.candles.slice();
        console.log('[PatternTrace] Seeded %d candles from WS candles message', _liveCandles.length);
      } else {
        // Merge: replace the whole array only if server sent newer data (more bars or different last)
        const serverLast = tick.candles[tick.candles.length - 1];
        const localLast  = _liveCandles[_liveCandles.length - 1];
        if (tick.candles.length > _liveCandles.length || serverLast.time !== localLast.time) {
          _liveCandles = tick.candles.slice();
        }
      }
      _liveDirty = true;
      _scheduleLiveAnalysis();
      return;
    }

    // Incremental tick: update or append last bar using price fields
    const currentPrice = tick.currentPrice || 0;
    if (!currentPrice) return;  // malformed tick

    const nowTs = Math.floor(Date.now() / 1000);

    if (_liveCandles.length > 0) {
      const last = _liveCandles[_liveCandles.length - 1];
      // Update current bar with intraday fields
      const updatedBar = {
        time:   last.time,
        open:   tick.dayOpen   || last.open,
        high:   Math.max(last.high, tick.dayHigh || currentPrice),
        low:    Math.min(last.low,  tick.dayLow  || currentPrice),
        close:  currentPrice,
        volume: tick.volume    || last.volume || 0,
      };
      _liveCandles[_liveCandles.length - 1] = updatedBar;
    } else {
      // No seed data yet — create a synthetic single bar
      _liveCandles.push({
        time:   nowTs,
        open:   tick.dayOpen  || currentPrice,
        high:   tick.dayHigh  || currentPrice,
        low:    tick.dayLow   || currentPrice,
        close:  currentPrice,
        volume: tick.volume   || 0,
      });
    }

    _liveDirty = true;
    _updateLiveBannerStatus();
    _scheduleLiveAnalysis();
  }

  // ══════════════════════════════════════════════════════
  //  Live-scan: Bootstrap candles + connect WS
  // ══════════════════════════════════════════════════════
  async function _initLiveScan() {
    if (!_isLive) return;

    // Verify required globals exist (api.js + realtimeProvider.js must be loaded)
    const hasDataService      = typeof dataService     !== 'undefined';
    const hasApiConfig        = typeof KRX_API_CONFIG  !== 'undefined';
    const hasRealtimeProvider = typeof realtimeProvider !== 'undefined';

    if (!hasDataService || !hasApiConfig || !hasRealtimeProvider) {
      console.warn('[PatternTrace] Live-scan dependencies not available — falling back to file-drop');
      _updateBannerText('api.js / realtimeProvider.js 로드 실패 — 파일 드롭 사용');
      _setConnectionState('failed');
      return;
    }

    // Build stock object matching the shape api.js / realtimeProvider expects
    const stockObj = {
      code:   _stockCode,
      market: _market,
      name:   _stockCode, // name may not be known; use code as fallback
    };

    // ── Step 1: Set WS URL for mode ──
    if (_source === 'kiwoom-local') {
      KRX_API_CONFIG.wsUrl = 'ws://localhost:8765';
      KRX_API_CONFIG.mode  = 'file'; // file mode ensures getCandles() actually fetches JSON seed
    } else if (_source === 'production-wss') {
      // Production WSS: V48 Phase 3 HMAC gate may reject unauthenticated WS.
      // The debug viewer does NOT hold the HMAC secret.
      // We attempt connection; if server rejects, onclose fires with a non-1000 code.
      // Log the close code and fall through gracefully — file-drop remains available.
      KRX_API_CONFIG.wsUrl = 'wss://cheesestock.co.kr';
      KRX_API_CONFIG.mode  = 'file'; // seed candles via file fetch first
    }

    // ── Step 2: Bootstrap seed candles (file mode fetch, up to 200 bars daily) ──
    _updateBannerText('캔들 데이터 로딩 중...');
    let seedCandles = [];
    try {
      seedCandles = await dataService.getCandles(stockObj, _timeframe);
    } catch (seedErr) {
      console.warn('[PatternTrace] getCandles() failed:', seedErr.message);
    }

    if (seedCandles && seedCandles.length >= 50) {
      _liveCandles = seedCandles.slice();
      _liveDirty   = true;
      console.log('[PatternTrace] Seed candles loaded: %d bars (%s %s %s)',
        _liveCandles.length, _stockCode, _market, _timeframe);
      _updateLiveBannerStatus();
    } else {
      // Not enough bars — warn but continue (WS may provide data via candles message)
      const gotCount = seedCandles ? seedCandles.length : 0;
      console.warn('[PatternTrace] Seed candles insufficient (%d bars, need >=50)', gotCount);
      if (gotCount === 0) {
        _updateBannerText(
          '[경고] 캔들 시드 없음 — WS 연결 후 candles 메시지 대기 중 (' +
          _stockCode + ' ' + _timeframe + ')'
        );
      } else {
        _updateBannerText(
          '[경고] 캔들 ' + gotCount + '봉 (최소 50봉 필요) — WS 보완 대기 중'
        );
      }
    }

    // ── Step 3: Init debug Worker ──
    _initLiveWorker();

    // If we have seed candles, dispatch first analysis immediately
    if (_liveCandles.length >= 50) {
      _scheduleLiveAnalysis();
    }

    // ── Step 4: Connect realtimeProvider (WS mode) ──
    // Switch config to ws mode for actual WS connection
    if (_source === 'kiwoom-local') {
      KRX_API_CONFIG.mode = 'ws';
    } else if (_source === 'production-wss') {
      // Note: production-wss connection will likely fail with V48 Phase 3 HMAC barrier.
      // The viewer does not hold the secret. We attempt anyway so the infrastructure
      // path is exercised; the onclose handler logs the WS close code.
      KRX_API_CONFIG.mode = 'ws';
    }

    // Register connection-change callback BEFORE start()
    realtimeProvider.onConnectionChange = function (state) {
      // state: 'connected' | 'reconnecting' | 'failed'
      _setConnectionState(state);
      console.log('[PatternTrace] WS connection state:', state);
      if (state === 'failed') {
        _updateBannerText(
          '[연결 실패] WS 재연결 실패. 기존 ' + _liveCandles.length +
          ' 봉 데이터로 계속 사용 가능. 파일 드롭도 가능.'
        );
      } else if (state === 'connected') {
        _updateLiveBannerStatus();
      } else {
        _updateBannerText('[재연결 중...] ' + _stockCode + ' ' + _timeframe);
      }
    };

    // Register tick callback EXACTLY ONCE per live-scan session
    // (avoid double-registration: _liveTickUnsubscribe tracks the returned unsub fn)
    if (_liveTickUnsubscribe) {
      _liveTickUnsubscribe(); // defensive unregister
    }
    _liveTickUnsubscribe = realtimeProvider.onTick(_onTick);

    // Start WS subscribe
    try {
      realtimeProvider.start(stockObj, _timeframe);
    } catch (wsErr) {
      console.warn('[PatternTrace] realtimeProvider.start() error:', wsErr.message);
      _setConnectionState('failed');
      _updateBannerText(
        '[WS 시작 실패] ' + wsErr.message +
        ' — 기존 시드 데이터 사용. 파일 드롭 가능.'
      );
    }
  }

  // ══════════════════════════════════════════════════════
  //  Cleanup (beforeunload)
  // ══════════════════════════════════════════════════════
  function _cleanup() {
    // Stop playback rAF
    _stopPlay();

    // Unregister tick listener (prevents memory leak on WS reconnect callbacks)
    if (_liveTickUnsubscribe) {
      _liveTickUnsubscribe();
      _liveTickUnsubscribe = null;
    }

    // Stop WS / demo ticker
    if (typeof realtimeProvider !== 'undefined') {
      try { realtimeProvider.stop(); } catch (e) { /* ignore */ }
    }

    // Cancel pending analysis timer
    if (_liveAnalyzeTimer !== null) {
      clearTimeout(_liveAnalyzeTimer);
      _liveAnalyzeTimer = null;
    }

    // Terminate debug Worker
    if (_liveWorker) {
      try { _liveWorker.terminate(); } catch (e) { /* ignore */ }
      _liveWorker = null;
    }

    // Destroy canvas (ResizeObserver + mouse listeners)
    if (typeof traceCanvas !== 'undefined' && typeof traceCanvas.destroy === 'function') {
      try { traceCanvas.destroy(); } catch (e) { /* ignore */ }
    }
  }

  window.addEventListener('beforeunload', _cleanup);

  // ══════════════════════════════════════════════════════
  //  Session 2/3 stubs
  // ══════════════════════════════════════════════════════
  window.__trace_exportAnnotated = function () {
    console.warn('[PatternTrace] __trace_exportAnnotated not yet implemented (Session 3).');
    return null;
  };

  // Convenience: expose load function for programmatic use (e.g. paste from console)
  window.__trace_load = function (traceObj) {
    const err = _validate(traceObj);
    if (err) { console.error('[PatternTrace] Schema error:', err); return; }
    _applyTrace(traceObj);
  };

  // Expose live candles for console inspection
  window.__trace_getLiveCandles = function () { return _liveCandles.slice(); };

  // ══════════════════════════════════════════════════════
  //  Init
  // ══════════════════════════════════════════════════════
  _applySourceMode();
  _initDragDrop();
  _initFilePicker();
  _initScrubber();
  _initKeyboard();
  _initWindowResize();

  if (_isLive) {
    // Add [live] Follow button next to scrubber
    _createFollowButton();
    _updateFollowButtonState();

    // Start live scan (async — does not block page init)
    _initLiveScan().catch(function (err) {
      console.error('[PatternTrace] Live scan init failed:', err);
      _setConnectionState('failed');
      _updateBannerText('[초기화 실패] ' + (err.message || String(err)) + ' — 파일 드롭 사용');
    });
  }

  console.log(
    '[PatternTrace] Session 2 viewer ready. mode=%s stock=%s tf=%s. ' +
    'Drop a trace JSON or call window.__trace_load(obj).',
    _source, _stockCode, _timeframe
  );

})();
