// ══════════════════════════════════════════════════════
//  Pattern Trace Orchestrator — pattern-trace.js
//  Main-thread controller for the A-MVP debug viewer.
//
//  Responsibilities:
//    - Parse ?source= URL param, show banner for non-file modes
//    - File-drop + file picker -> FileReader -> JSON.parse
//    - Schema validate (schemaVersion === 1, required top-level keys)
//    - Store trace as window.__TRACE__ for console debugging
//    - Call traceCanvas.load() + tracePanel.load()
//    - Scrubber: input + change events, bar label update
//    - Spacebar toggle play/pause at 60fps rAF
//    - Shift+Space 10x speed
//    - Expose window.__trace_exportAnnotated() stub (Session 2/3)
//
//  NO fetch() calls. NO production DOM refs (#sidebar, etc.).
//  NO WebSocket code in MVP (Session 2 extension point only).
// ══════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Required top-level keys for schema v1 ──
  const REQUIRED_KEYS = ['schemaVersion', 'meta', 'bars', 'preAnalyze', 'perPattern', 'postPipeline'];

  // ── DOM references ──
  const dropzone      = document.getElementById('trace-dropzone');
  const fileInput     = document.getElementById('trace-file-input');
  const scrubber      = document.getElementById('trace-scrubber');
  const scrubberLabel = document.getElementById('trace-scrubber-label');
  const sourceBadge   = document.getElementById('source-badge');
  const metaSummary   = document.getElementById('trace-meta-summary');
  const session2Banner = document.getElementById('session2-banner');

  // ── Playback state ──
  let _playing       = false;
  let _playSpeed     = 1;     // 1 = normal, 10 = 10x
  let _rafHandle     = null;
  let _lastFrameTime = 0;
  const FRAME_MS     = 1000 / 60; // ~16.7ms per frame

  // ── Source mode from URL ──
  const _source = new URLSearchParams(window.location.search).get('source') || 'file';

  // ── Apply source badge and Session 2 banner ──
  function _applySourceMode() {
    if (_source === 'production-wss') {
      sourceBadge.textContent = 'Production-WSS';
      sourceBadge.classList.add('wss');
      session2Banner.style.display = 'block';
    } else if (_source === 'kiwoom-local') {
      sourceBadge.textContent = 'Kiwoom-local';
      sourceBadge.classList.add('kiwoom');
      session2Banner.style.display = 'block';
    } else {
      sourceBadge.textContent = 'File-replay';
      // Session 2 banner stays hidden
    }
  }

  // ── Schema validation ──
  function _validate(obj) {
    if (!obj || typeof obj !== 'object') return 'JSON이 객체가 아닙니다.';
    if (obj.schemaVersion !== 1) {
      return `schemaVersion 불일치: 기대값 1, 실제 ${JSON.stringify(obj.schemaVersion)}`;
    }
    for (const key of REQUIRED_KEYS) {
      if (!(key in obj)) return `필수 키 누락: "${key}"`;
    }
    if (!Array.isArray(obj.bars)) return '"bars"는 배열이어야 합니다.';
    if (!Array.isArray(obj.perPattern)) return '"perPattern"은 배열이어야 합니다.';
    return null; // valid
  }

  // ── Load a validated trace object ──
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
    const meta = trace.meta || {};
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

  // ── File reading ──
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

  // ── Drag-drop events ──
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

  // ── Scrubber ──
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
    scrubber.addEventListener('input',  _onScrubberChange);
    scrubber.addEventListener('change', _onScrubberChange);
  }

  // ── Playback rAF loop ──
  function _playLoop(timestamp) {
    if (!_playing) return;
    const elapsed = timestamp - _lastFrameTime;
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

  // ── Keyboard events ──
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
          if (_playSpeed === 10) {
            _playSpeed = 1;
          } else {
            _playSpeed = 10;
          }
          // If already playing, continue at new speed; otherwise start
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
        const total   = traceCanvas.getBarCount();
        if (current > 0) {
          const prev = current - 1;
          scrubber.value = prev;
          traceCanvas.setScrubberBar(prev);
          _updateScrubberLabel(prev, total);
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

  // ── Session 2/3 stub ──
  window.__trace_exportAnnotated = function () {
    console.warn('[PatternTrace] __trace_exportAnnotated not yet implemented (Session 2/3).');
    return null;
  };

  // ── Init ──
  _applySourceMode();
  _initDragDrop();
  _initFilePicker();
  _initScrubber();
  _initKeyboard();
  _initWindowResize();

  // Convenience: expose load function for programmatic use (e.g. paste from console)
  window.__trace_load = function (traceObj) {
    const err = _validate(traceObj);
    if (err) { console.error('[PatternTrace] Schema error:', err); return; }
    _applyTrace(traceObj);
  };

  console.log('[PatternTrace] A-MVP viewer ready. Drop a trace JSON or call window.__trace_load(obj).');

})();
