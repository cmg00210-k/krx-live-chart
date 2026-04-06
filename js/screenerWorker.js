// ══════════════════════════════════════════════════════
//  KRX LIVE — Screener Web Worker
//
//  전종목 스캔 시 patternEngine.analyze()를 Worker에서 실행하여
//  메인 스레드 UI 블로킹을 방지한다.
//
//  메시지 프로토콜:
//    → { type: 'init' }
//    ← { type: 'ready' }
//
//    → { type: 'scan', code, name, candles, market }
//    ← { type: 'scan-result', code, name, patterns: [...] }
//
//    ← { type: 'error', code?, message }
// ══════════════════════════════════════════════════════

/* global patternEngine */

var _workerReady = false;

// ── Worker 내부에 필요한 스크립트 로드 ───────────────
// importScripts 경로는 Worker 파일(js/) 기준 상대 경로
try {
  importScripts(
    'colors.js?v=13',
    'indicators.js?v=26',
    'patterns.js?v=45',
    'signalEngine.js?v=42',
    'backtester.js?v=40'
  );
  _workerReady = true;
  self.postMessage({ type: 'ready' });
} catch (err) {
  self.postMessage({
    type: 'error',
    message: 'importScripts 실패: ' + err.message,
  });
}

// ── 메시지 핸들러 ────────────────────────────────────
self.onmessage = function (e) {
  var msg = e.data;

  // 초기화 실패 시 모든 요청에 에러 응답
  if (!_workerReady) {
    self.postMessage({
      type: 'error',
      code: msg.code || '',
      message: '[ScreenerWorker] 초기화 실패 상태 — 요청 처리 불가',
    });
    return;
  }

  // ── 초기화 확인 ─────────────────────────────────
  if (msg.type === 'init') {
    self.postMessage({ type: 'ready' });
    return;
  }

  // ── 단일 종목 패턴 스캔 ─────────────────────────
  if (msg.type === 'scan') {
    try {
      var candles = msg.candles;
      var code = msg.code;
      var name = msg.name;

      if (!candles || candles.length < 30) {
        // 데이터 부족 — 빈 결과 반환 (에러 아님)
        self.postMessage({
          type: 'scan-result',
          code: code,
          name: name,
          patterns: [],
        });
        return;
      }

      // 패턴 분석 (CPU 헤비 작업)
      var analyzeOpts = {};
      if (msg.market) analyzeOpts.market = msg.market;
      var patterns = patternEngine.analyze(candles, analyzeOpts);

      // 최근 5봉 이내 패턴만 필터링
      var candleLen = candles.length;
      var recent = [];
      for (var i = 0; i < patterns.length; i++) {
        var p = patterns[i];
        var idx = p.endIndex != null ? p.endIndex : p.startIndex;
        if (idx != null && idx >= candleLen - 5) {
          // 전송에 필요한 필드만 추출 (structured clone 최소화)
          recent.push({
            type: p.type,
            confidence: p.confidence || 50,
            startIndex: p.startIndex,
            endIndex: p.endIndex,
          });
        }
      }

      self.postMessage({
        type: 'scan-result',
        code: code,
        name: name,
        patterns: recent,
      });

    } catch (err) {
      self.postMessage({
        type: 'error',
        code: msg.code || '',
        message: '[ScreenerWorker scan] ' + err.message,
      });
    }
    return;
  }

  console.warn('[ScreenerWorker] Unknown message type:', msg.type);
};
