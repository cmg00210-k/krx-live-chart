// debug/pattern-trace-worker.js — trace-only Worker entry, NEVER deploy.
//
// Mirrors production analysisWorker.js importScripts order (js/analysisWorker.js
// lines 76-83), then appends pattern-trace-hook.js which monkeypatches the
// patternEngine / signalEngine instance methods on THIS Worker scope only.
// HTML5 Worker isolation guarantees no cross-Worker pollution.
//
// Message protocol:
//   → { type: 'trace', candles, stockCode, market, timeframe, traceLevel, requestId }
//   ← { type: 'traceResult', trace, requestId }
//   ← { type: 'ready', patternEngineVersion, signalEngineVersion }
//   ← { type: 'error', where, message, stack, requestId? }
//
// ?v=N pins resolved from index.html (2026-04-21 grep; see summary doc):
//   colors=14, indicators=28, patterns=50, signalEngine=47, backtester=49
// Session 2 will add build-step verification; MVP hard-codes and exposes via
// self.__TRACE_VERSIONS__ so the hook can stamp meta.patternEngineVersion.

self.__TRACE_VERSIONS__ = {
  colors:       '14',
  indicators:   '28',
  patterns:     '50',
  signalEngine: '47',
  backtester:   '49'
};

try {
  // Worker file lives at /debug/, so ../js/ reaches the production sources.
  // Relative paths keep the same resolution rules as production's
  // analysisWorker.js (which is at /js/ and uses bare filenames).
  importScripts(
    '../js/colors.js?v='       + self.__TRACE_VERSIONS__.colors,
    '../js/indicators.js?v='   + self.__TRACE_VERSIONS__.indicators,
    '../js/patterns.js?v='     + self.__TRACE_VERSIONS__.patterns,
    '../js/signalEngine.js?v=' + self.__TRACE_VERSIONS__.signalEngine,
    '../js/backtester.js?v='   + self.__TRACE_VERSIONS__.backtester,
    './pattern-trace-hook.js'   // LAST — installs monkeypatch on singletons
  );
} catch (e) {
  self.postMessage({
    type: 'error',
    where: 'importScripts',
    message: (e && e.message) || String(e),
    stack:   (e && e.stack) || null
  });
  throw e; // terminate Worker; viewer surfaces the error
}

// ── Message handler ────────────────────────────────────────────────────
self.onmessage = function (ev) {
  var msg = ev && ev.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type !== 'trace') {
    // Unknown message types ignored — tool is intentionally narrow.
    return;
  }

  try {
    if (!self.__PATTERN_TRACE__ || typeof self.__PATTERN_TRACE__.runOnce !== 'function') {
      throw new Error('pattern-trace-hook not installed (self.__PATTERN_TRACE__ missing)');
    }
    var trace = self.__PATTERN_TRACE__.runOnce(msg);
    self.postMessage({
      type: 'traceResult',
      trace: trace,
      requestId: msg.requestId || null
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      where: 'onmessage.trace',
      message: (err && err.message) || String(err),
      stack:   (err && err.stack) || null,
      requestId: msg.requestId || null
    });
  }
};

// ── Ready signal ───────────────────────────────────────────────────────
// Sent AFTER importScripts completes and hook installs successfully.
// Viewer waits for this before dispatching the first 'trace' message.
self.postMessage({
  type: 'ready',
  patternEngineVersion: self.__TRACE_VERSIONS__.patterns,
  signalEngineVersion:  self.__TRACE_VERSIONS__.signalEngine
});
