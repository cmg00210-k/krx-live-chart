// ══════════════════════════════════════════════════════
//  KRX LIVE — Analysis Web Worker (Phase 9)
//
//  메인 스레드 블로킹 방지를 위해 패턴 분석, 시그널 분석,
//  백테스트 연산을 Web Worker로 오프로드한다.
//
//  importScripts로 indicators.js, patterns.js,
//  signalEngine.js, backtester.js를 로드하며,
//  각 파일의 전역 인스턴스(patternEngine, signalEngine,
//  backtester)가 Worker 스코프 내에 자동 생성된다.
//
//  메시지 프로토콜:
//    → { type: 'analyze', candles, realtimeMode, version, source? }
//    ← { type: 'result', patterns, signals, stats, version, source }
//
//    → { type: 'backtest', candles, version }
//    ← { type: 'backtestResult', results, candleLength, version }
//
//    ← { type: 'ready' }   Worker 초기화 완료
//    ← { type: 'error', message, version }   처리 중 에러
// ══════════════════════════════════════════════════════

/* global patternEngine, signalEngine, backtester */

// ── Worker 초기화 상태 ────────────────────────────────
let _workerReady = false;

// ── Worker 내부에 필요한 스크립트 로드 ───────────────
// importScripts 경로는 Worker 파일(js/) 기준 상대 경로
try {
  importScripts(
    'colors.js',
    'indicators.js',
    'patterns.js',
    'signalEngine.js',
    'backtester.js'
  );
  _workerReady = true;
  self.postMessage({ type: 'ready' });
} catch (err) {
  // 로드 실패 시 메인 스레드에 알림 → 폴백 모드 전환
  self.postMessage({ type: 'error', message: 'importScripts 실패: ' + err.message, version: -1 });
}


// ── 메시지 핸들러 ────────────────────────────────────
self.onmessage = function (e) {
  const msg = e.data;

  // 초기화 실패 시 모든 요청에 에러 응답
  if (!_workerReady) {
    self.postMessage({
      type: 'error',
      message: '[Worker] 초기화 실패 상태 — 요청 처리 불가',
      version: msg.version || -1,
    });
    return;
  }

  // ── 패턴 + 시그널 분석 ─────────────────────────────
  if (msg.type === 'analyze') {
    try {
      const { candles, realtimeMode, version } = msg;

      // 실시간 모드에서 미완성(마지막) 캔들 제외
      const analyzeCandles = (realtimeMode && candles.length > 1)
        ? candles.slice(0, -1)
        : candles;

      // 1) 캔들 패턴 분석
      const patterns = patternEngine.analyze(analyzeCandles);

      // 2) 지표 시그널 + 복합 시그널 분석
      //    signalEngine.analyze()는 IndicatorCache를 내부 생성하며,
      //    cache 객체는 함수를 포함하므로 structured clone 불가 → 전달하지 않음
      const result = signalEngine.analyze(analyzeCandles, patterns);

      self.postMessage({
        type: 'result',
        patterns: patterns,
        signals: result.signals,
        stats: result.stats,
        version: version,
        source: msg.source || 'full',
      });

    } catch (err) {
      self.postMessage({
        type: 'error',
        message: '[Worker analyze] ' + err.message,
        version: msg.version || -1,
        source: msg.source || 'full',
      });
    }
  }

  // ── 백테스트 ───────────────────────────────────────
  else if (msg.type === 'backtest') {
    try {
      const { candles, version } = msg;

      // backtester.backtestAll()은 내부적으로 patternEngine.analyze() 호출
      const results = backtester.backtestAll(candles);

      self.postMessage({
        type: 'backtestResult',
        results: results,
        candleLength: candles.length,
        version: version,
      });

    } catch (err) {
      self.postMessage({
        type: 'error',
        message: '[Worker backtest] ' + err.message,
        version: msg.version || -1,
      });
    }
  }
};
