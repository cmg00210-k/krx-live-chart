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

// ── [PERF] 분석 결과 캐시 — 동일 캔들 재분석 방지 ────
// 캔들 길이 + 마지막 캔들의 time + open + close로 변경 감지
// drag 이벤트에서 동일 visible 구간 반복 요청 시 캐시 적중
// NOTE: Worker msg에 stock code가 없으므로 open을 추가하여 충돌 확률 저감
let _analyzeCache = { key: null, patterns: null, signals: null, stats: null };

// ── 적응형 가중치 — 백테스트 WLS 계수에서 추출 ────
let _learnedWeights = {};

// ── 승률 맵 — 백테스트 결과에서 패턴별 5일 승률 캐시 ────
// { [patternType]: { winRate: number, sampleSize: number } }
// backtest 메시지 처리 후 갱신, analyze 결과 패턴에 부착
let _winRateMap = {};

// ── 백테스트 기준시점 — AMH 시변성 감쇠 계산용 ────────
// Lo (2004) AMH: 패턴 알파는 exp(-λ×days) 속도로 감쇠.
// null이면 감쇠 미적용 (하위 호환 유지).
let _backtestEpochMs = null;

function _makeCacheKey(candles, timeframe) {
  if (!candles || !candles.length) return '';
  var last = candles[candles.length - 1];
  return (timeframe || '') + '_' + candles.length + '_' + last.time + '_' + last.open + '_' + last.close;
}

// ── Worker 내부에 필요한 스크립트 로드 ───────────────
// importScripts 경로는 Worker 파일(js/) 기준 상대 경로
try {
  importScripts(
    'colors.js?v=12',
    'indicators.js?v=15',
    'patterns.js?v=30',
    'signalEngine.js?v=26',
    'backtester.js?v=26'
  );
  _workerReady = true;
  self.postMessage({ type: 'ready' });
} catch (err) {
  // 로드 실패 시 메인 스레드에 알림 → 폴백 모드 전환
  self.postMessage({ type: 'error', message: 'importScripts 실패: ' + err.message, version: -1 });
}


// ── 백테스트 WLS 계수 → 적응형 가중치 추출 ──────────
// h5(5일 수익률) 회귀 결과가 충분히 신뢰할 때만 저장.
// rSquared > 0.01 + n >= 30: 통계적 의미 최소 기준.
// confidence = rSquared² × clamp(n/200, 0, 1): 샘플 수 패널티 포함 (C-2 교정: 100→200).
function _extractLearnedWeights(backtestResults) {
  for (var pType in backtestResults) {
    var bt = backtestResults[pType];
    if (!bt || !bt.horizons) continue;
    var h5 = bt.horizons[5];
    if (h5 && h5.regression && h5.regression.rSquared > 0.01 && h5.n >= 30) {
      _learnedWeights[pType] = {
        beta: h5.regression.coeffs,
        rSquared: h5.regression.rSquared,
        n: h5.n,
        confidence: Math.pow(h5.regression.rSquared, 2) * Math.min(h5.n / 200, 1),
      };
    }
  }
}

// ── 백테스트 결과 → 승률 맵 추출 ──────────────────────
// horizons[5] (5일 승률)을 패턴별로 캐시.
// sampleSize < 10이면 신뢰도 부족으로 저장하지 않음.
function _extractWinRateMap(backtestResults) {
  _winRateMap = {};  // 종목 전환 시 이전 종목 데이터 오염 방지
  for (var pType in backtestResults) {
    var bt = backtestResults[pType];
    if (!bt || !bt.horizons) continue;
    var h5 = bt.horizons[5];
    if (h5 && h5.n >= 10) {
      _winRateMap[pType] = {
        winRate: h5.winRate,
        sampleSize: h5.n,
      };
    }
  }
}

// ── 패턴 배열에 승률 정보 부착 ──────────────────────────
// _winRateMap이 채워진 상태에서만 의미 있음.
// analyze보다 backtest가 나중에 실행되므로 첫 호출에는 빈 맵.
// 이후 재분석 시에는 이전 백테스트 승률이 자동 부착됨.
//
// [AMH] 시변 감쇠 적용: 오래된 백테스트 승률은 중립값(50%)으로 회귀.
// winRateDecayed = 50 + (winRate - 50) × exp(-λ × daysSince)
// Lo (2004), McLean & Pontiff (2016): 전략 알파는 시간에 따라 감쇠.
function _attachWinRates(patterns) {
  if (!patterns || !patterns.length) return;

  // 감쇠 인자 계산 (기본 λ=0.00275, 반감기 252일)
  var winRateDecay = 1.0;
  if (_backtestEpochMs != null) {
    var daysSince = (Date.now() - _backtestEpochMs) / 86400000;
    if (daysSince > 0) {
      winRateDecay = Math.exp(-0.00275 * daysSince);
    }
  }

  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    var entry = _winRateMap[p.type];
    if (entry) {
      // 중립(50)으로의 지수 감쇠: 오래된 엣지 추정치는 서서히 무의미해진다
      p.backtestWinRate = +(50 + (entry.winRate - 50) * winRateDecay).toFixed(1);
      p.backtestSampleSize = entry.sampleSize;
    } else {
      p.backtestWinRate = null;
      p.backtestSampleSize = null;
    }
  }
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

      // [PERF] 캐시 키 비교 — 동일 캔들이면 재분석 건너뜀
      // drag 이벤트에서 동일 visible 구간 반복 요청 시 효과적
      const cacheKey = _makeCacheKey(analyzeCandles, msg.timeframe);
      let patterns, signals, stats;

      // 적응형 가중치 주입 (이전 백테스트에서 학습)
      if (msg.learnedWeights) {
        _learnedWeights = msg.learnedWeights;
        // [AMH] app.js가 _backtestEpochMs를 learnedWeights에 piggyback
        if (msg.learnedWeights._backtestEpochMs != null) {
          _backtestEpochMs = msg.learnedWeights._backtestEpochMs;
        }
      }
      if (msg.backtestEpochMs != null) {
        _backtestEpochMs = msg.backtestEpochMs;
      }
      if (typeof patternEngine !== 'undefined' && patternEngine.constructor) {
        patternEngine.constructor._globalLearnedWeights = _learnedWeights;
        // [AMH] 감쇠 계산용 기준시점 주입
        patternEngine.constructor._backtestEpochMs = _backtestEpochMs;
      }

      if (_analyzeCache.key === cacheKey && _analyzeCache.patterns) {
        // 캐시 적중: 이전 분석 결과 재사용
        patterns = _analyzeCache.patterns;
        signals = _analyzeCache.signals;
        stats = _analyzeCache.stats;
      } else {
        // 캐시 미스: 새로 분석
        // [PERF] UI 분석: lookback 윈도우 제한 (HS_WINDOW=120 + S/R 버퍼 + 지표 warm-up)
        // 분봉(5m/1m)에서 8-20x 속도향상. 백테스트는 별도 전체 분석.
        var uiWindow = 180;
        var detectFrom = Math.max(0, analyzeCandles.length - uiWindow);
        // 1) 캔들 패턴 분석
        patterns = patternEngine.analyze(analyzeCandles, { detectFrom: detectFrom });

        // 2) 지표 시그널 + 복합 시그널 분석
        //    signalEngine.analyze()는 IndicatorCache를 내부 생성하며,
        //    cache 객체는 함수를 포함하므로 structured clone 불가 → 전달하지 않음
        const result = signalEngine.analyze(analyzeCandles, patterns);
        signals = result.signals;
        stats = result.stats;

        // [Phase I] Prospect theory loss aversion boost — Kahneman & Tversky (1979)
        if (patterns._srLevels && typeof signalEngine.applyProspectBoost === 'function') {
          signalEngine.applyProspectBoost(signals, analyzeCandles, patterns._srLevels, result.cache);
        }

        // 캐시 갱신 — windowed 플래그: 백테스트 캐시 시딩 시 윈도우된 결과 제외
        _analyzeCache = { key: cacheKey, patterns: patterns, signals: signals, stats: stats, windowed: detectFrom > 0 };
      }

      // 이전 백테스트에서 캐시된 승률을 패턴에 부착 (첫 분석 시 빈 맵 → null 부착)
      _attachWinRates(patterns);

      self.postMessage({
        type: 'result',
        patterns: patterns,
        signals: signals,
        stats: stats,
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

      // [PERF] 이전 analyze 결과가 동일 캔들이면
      // backtester의 _analyzeCache를 미리 채워서 중복 patternEngine.analyze() 방지
      //
      // WARNING: Direct mutation of backtester._analyzeCache (internal field).
      // backtester._collectOccurrences() checks `this._analyzeCache._candles !== candles`
      // to decide whether to re-run patternEngine.analyze(). Pre-seeding here avoids
      // that redundant O(n) call when we already have the result from the 'analyze' step.
      // If backtester's cache structure changes (field rename, shape change), this will
      // silently stop working and fall back to re-analysis — safe but slower.
      // No public setter exists on PatternBacktester for this purpose.
      const btCacheKey = _makeCacheKey(candles, msg.timeframe);
      if (_analyzeCache.key === btCacheKey && _analyzeCache.patterns && !_analyzeCache.windowed) {
        backtester._analyzeCache = {
          _candles: candles,
          patterns: _analyzeCache.patterns,
        };
      }

      backtester._currentMarket = msg.market || '';
      const results = backtester.backtestAll(candles);
      _extractLearnedWeights(results);
      // 승률 맵 갱신 (다음 analyze 호출 시 패턴에 자동 부착됨)
      _extractWinRateMap(results);

      // [AMH] 백테스트 기준시점 기록 — Lo (2004) 시변 효율성
      // 마지막 캔들 시각을 ms 단위로 저장. 일봉("YYYY-MM-DD") + 분봉(Unix sec) 양쪽 처리.
      if (candles && candles.length > 0) {
        var lastTime = candles[candles.length - 1].time;
        _backtestEpochMs = (typeof lastTime === 'string')
          ? new Date(lastTime).getTime()
          : lastTime * 1000;
      }

      self.postMessage({
        type: 'backtestResult',
        results: results,
        learnedWeights: _learnedWeights,
        backtestEpochMs: _backtestEpochMs,
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

  else {
    console.warn('[Worker] Unknown message type:', msg.type);
  }
};
