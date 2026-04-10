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
//    → { type: 'analyze', candles, realtimeMode, version, source?, timeframe?, market? }
//    ← { type: 'result', patterns, signals, stats, version, source }
//
//    → { type: 'backtest', candles, version }
//    ← { type: 'backtestResult', results, learnedWeights, backtestEpochMs, candleLength, version }
//
//    → { type: 'marketContext', vkospi, pcr, basis, leverageRatio, foreignAlignment }
//    (no response — one-way injection into Worker-scope globals for signalEngine)
//
//    ← { type: 'ready' }   Worker 초기화 완료
//    ← { type: 'error', message, version }   처리 중 에러
// ══════════════════════════════════════════════════════

/* global patternEngine, signalEngine, backtester */

// ── Worker 초기화 상태 ────────────────────────────────
let _workerReady = false;

// ── [H-2] 시장 맥락 데이터 — signalEngine 전역 참조용 ────
// signalEngine._classifyVolRegimeFromVKOSPI()가 `typeof _marketContext`로 참조.
// signalEngine._detect*Signal()이 `typeof _derivativesData` 등으로 참조.
// app.js가 postMessage({type:'marketContext'})로 주입하면 여기에 저장.
// var 선언: Worker 전역 스코프에 등록되어 signalEngine typeof 체크가 작동.
var _marketContext = null;
var _derivativesData = null;
var _investorData = null;
var _etfData = null;
var _shortSellingData = null;

// ── [PERF] 분석 결과 캐시 — 동일 캔들 재분석 방지 ────
// 캔들 길이 + 마지막 캔들의 time + open + close + realtimeMode로 변경 감지
// drag 이벤트에서 동일 visible 구간 반복 요청 시 캐시 적중
// NOTE: Worker msg에 stock code가 없으므로 open을 추가하여 충돌 확률 저감
// NOTE: realtimeMode 포함 — WS 연결 전환 시 file 모드 stale 캐시 방지
let _analyzeCache = { key: null, patterns: null, signals: null, stats: null };

// ── 적응형 가중치 — 백테스트 WLS 계수에서 추출 ────
let _learnedWeights = {};

// ── 승률 맵 — 백테스트 결과에서 패턴별 5일 승률 + CI95 캐시 ────
// { [patternType]: { winRate, sampleSize, ci95Lower?, ci95Upper?, expectedReturn? } }
// backtest 메시지 처리 후 갱신, analyze 결과 패턴에 부착
let _winRateMap = {};

// ── 시그널 승률 맵 — backtestAllSignals 결과에서 시그널별 5일 승률 캐시 ────
// { [signalType]: { wr, n, tier, expectancy } }
// backtest 메시지 처리 후 갱신, analyze 결과 시그널에 부착
var _signalWinRateMap = {};

// ── 백테스트 기준시점 — AMH 시변성 감쇠 계산용 ────────
// Lo (2004) AMH: 패턴 알파는 exp(-λ×days) 속도로 감쇠.
// null이면 감쇠 미적용 (하위 호환 유지).
let _backtestEpochMs = null;

function _makeCacheKey(candles, timeframe, realtimeMode) {
  if (!candles || !candles.length) return '';
  var last = candles[candles.length - 1];
  // [P1-FIX] realtimeMode 포함 — WS 연결 시 file 모드 캐시 반환 방지
  return (timeframe || '') + '_' + candles.length + '_' + last.time + '_' + last.open + '_' + last.close + '_' + (realtimeMode ? 'rt' : 'file');
}

// ── Worker 내부에 필요한 스크립트 로드 ───────────────
// importScripts 경로는 Worker 파일(js/) 기준 상대 경로
try {
  importScripts(
    'colors.js?v=14',
    'indicators.js?v=28',
    'patterns.js?v=48',
    'signalEngine.js?v=45',
    'backtester.js?v=42'
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
// confidence = rSquared × clamp(n/300, 0, 1): 샘플 수 패널티 포함 (C-2 교정: 100→200→300). [P0-C4] R⁴→R² fix.
function _extractLearnedWeights(backtestResults) {
  for (var pType in backtestResults) {
    var bt = backtestResults[pType];
    if (!bt || !bt.horizons) continue;
    var h5 = bt.horizons[5];
    // [Expert Consensus] Campbell-Thompson (2008) R²_OOS >= 0.03 standard
    if (h5 && h5.regression && h5.regression.rSquared >= 0.03 && h5.n >= 30) {
      _learnedWeights[pType] = {
        beta: h5.regression.coeffs,
        rSquared: h5.regression.rSquared,
        n: h5.n,
        confidence: h5.regression.rSquared * Math.min(h5.n / 300, 1),
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
      var entry = {
        winRate: h5.winRate,
        sampleSize: h5.n,
      };
      // CI95 + expectedReturn: WLS 회귀 예측의 95% 신뢰구간
      // 예측 영역 opacity 변조에 사용 — 넓은 CI = 낮은 확신 = 투명
      if (h5.ci95Lower != null && h5.ci95Upper != null) {
        entry.ci95Lower = h5.ci95Lower;
        entry.ci95Upper = h5.ci95Upper;
      }
      if (h5.expectedReturn != null) {
        entry.expectedReturn = h5.expectedReturn;
      }
      _winRateMap[pType] = entry;
    }
  }
}

// ── 시그널 백테스트 결과 → 시그널 승률 맵 추출 ────────────
// horizons[5] (5일 승률)을 시그널별로 캐시.
// n < 5이면 신뢰도 부족으로 저장하지 않음 (패턴 기준 10보다 완화 — 신호 희소성 반영).
function _extractSignalWinRateMap(signalResults) {
  if (!signalResults) return;
  _signalWinRateMap = {};  // 종목 전환 시 이전 종목 데이터 오염 방지
  for (var sType in signalResults) {
    var sr = signalResults[sType];
    if (sr && sr.horizons && sr.horizons[5] && sr.horizons[5].n >= 5) {
      _signalWinRateMap[sType] = {
        wr: sr.horizons[5].winRate,
        n: sr.horizons[5].n,
        tier: sr.reliabilityTier || 'D',
        expectancy: sr.horizons[5].expectancy || 0,
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
      // CI95 부착: 예측 영역 opacity 변조용 (patternRenderer._buildForecastZone)
      // ci95는 return % 단위이므로 주가 무관, 감쇠 불필요 (폭만 사용)
      p.backtestCi95Lower = entry.ci95Lower != null ? entry.ci95Lower : null;
      p.backtestCi95Upper = entry.ci95Upper != null ? entry.ci95Upper : null;
      p.backtestExpectedReturn = entry.expectedReturn != null ? entry.expectedReturn : null;
    } else {
      p.backtestWinRate = null;
      p.backtestSampleSize = null;
      p.backtestCi95Lower = null;
      p.backtestCi95Upper = null;
      p.backtestExpectedReturn = null;
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
      const cacheKey = _makeCacheKey(analyzeCandles, msg.timeframe, realtimeMode);
      let patterns, signals, stats;
      var _cacheMiss = false;  // 캐시 미스 여부 — auto-backtest 트리거 판단용

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
        _cacheMiss = true;
        // 캐시 미스: 새로 분석
        // [PERF] UI 분석: lookback 윈도우 제한 (HS_WINDOW=120 + S/R 버퍼 + 지표 warm-up)
        // 분봉(5m/1m)에서 8-20x 속도향상. 백테스트는 별도 전체 분석.
        var uiWindow = 180;
        var detectFrom = Math.max(0, analyzeCandles.length - uiWindow);
        // 1) 캔들 패턴 분석
        // [Phase C-1] 밸류에이션 S/R: financialData가 있으면 opts에 포함
        // [TF-AWARE] 타임프레임 전달 — 패턴 활성화/ATR fallback 분기
        var analyzeOpts = { detectFrom: detectFrom };
        if (msg.financialData) analyzeOpts.financialData = msg.financialData;
        if (msg.timeframe) analyzeOpts.timeframe = msg.timeframe;
        if (msg.market) analyzeOpts.market = msg.market;
        patterns = patternEngine.analyze(analyzeCandles, analyzeOpts);

        // 2) 지표 시그널 + 복합 시그널 분석
        //    signalEngine.analyze()는 IndicatorCache를 내부 생성하며,
        //    cache 객체는 함수를 포함하므로 structured clone 불가 → 전달하지 않음
        const result = signalEngine.analyze(analyzeCandles, patterns);
        signals = result.signals;
        stats = result.stats;

        // [Phase I] S/R proximity boost — support/resistance 근접 신호 강화
        if (patterns._srLevels && typeof signalEngine.applySRProximityBoost === 'function') {
          signalEngine.applySRProximityBoost(signals, analyzeCandles, patterns._srLevels, result.cache);
        }

        // 캐시 갱신 — windowed 플래그: 백테스트 캐시 시딩 시 윈도우된 결과 제외
        _analyzeCache = { key: cacheKey, patterns: patterns, signals: signals, stats: stats, windowed: detectFrom > 0 };
      }

      // 이전 백테스트에서 캐시된 승률을 패턴에 부착 (첫 분석 시 빈 맵 → null 부착)
      _attachWinRates(patterns);

      // [Signal Backtest] 이전 backtestAllSignals에서 캐시된 승률을 시그널에 부착
      // 첫 분석 시에는 빈 맵 → 부착 스킵 (백테스트 완료 후 다음 analyze 시 활성화)
      if (_signalWinRateMap && Object.keys(_signalWinRateMap).length > 0) {
        for (var si = 0; si < signals.length; si++) {
          var sKey = signals[si].compositeId || signals[si].type;
          var swm = _signalWinRateMap[sKey];
          if (swm) {
            signals[si].backtestWR = swm.wr;
            signals[si].backtestN = swm.n;
            signals[si].reliabilityTier = swm.tier;
            signals[si].backtestExpectancy = swm.expectancy;
          }
        }
      }

      // [Expert Consensus] Pattern-Signal Agreement Score
      // Cross-validate most recent pattern direction vs signal sentiment
      var agreementScore = null;
      if (patterns && patterns.length > 0 && stats && stats.sentiment !== undefined) {
        var recentPattern = null;
        var lastIdx = analyzeCandles.length - 1;
        // Find most recent pattern (within last 5 bars)
        for (var pi = patterns.length - 1; pi >= 0; pi--) {
          var pIdx = patterns[pi].endIndex || patterns[pi].startIndex || 0;
          if (lastIdx - pIdx <= 5) { recentPattern = patterns[pi]; break; }
        }

        if (recentPattern) {
          var patDir = recentPattern.signal; // 'buy', 'sell', 'neutral'
          var sigSentiment = stats.sentiment || 0; // -100 to +100

          // Determine agreement
          var patBuy = (patDir === 'buy');
          var patSell = (patDir === 'sell');
          var sigBuy = (sigSentiment >= 25);
          var sigSell = (sigSentiment <= -25);

          if ((patBuy && sigBuy) || (patSell && sigSell)) {
            // Agreement: boost both
            agreementScore = { status: 'agree', boost: 5 };
            recentPattern.confidence = Math.min(90, (recentPattern.confidence || 50) + 5);
            if (recentPattern.confidencePred) {
              recentPattern.confidencePred = Math.min(95, recentPattern.confidencePred + 3);
            }
          } else if ((patBuy && sigSell) || (patSell && sigBuy)) {
            // Conflict: discount the weaker one
            agreementScore = { status: 'conflict', penalty: -10 };
            var patConf = recentPattern.confidencePred || recentPattern.confidence || 50;
            var sigConf = Math.abs(sigSentiment);
            if (patConf < sigConf) {
              // Pattern is weaker — discount pattern
              recentPattern.confidence = Math.max(10, (recentPattern.confidence || 50) - 10);
              recentPattern.conflictFlag = true;
            } else {
              // Signal sentiment is weaker — flag but don't modify (signals already posted)
              agreementScore.weakerSide = 'signal';
            }
          } else {
            agreementScore = { status: 'neutral' };
          }
        }
      }

      self.postMessage({
        type: 'result',
        patterns: patterns,
        srLevels: patterns._srLevels || [],  // 배열 비-열거형 속성은 structured clone 소실 → 별도 전송
        signals: signals,
        stats: stats,
        agreementScore: agreementScore,
        version: version,
        source: msg.source || 'full',
      });

      // [Expert Consensus] Worker auto-trigger — eliminates 1 round-trip latency
      // Only on cache miss (new stock) with sufficient data
      // [TF-AWARE] 1m/5m 분봉은 HORIZONS가 분 단위가 되어 무의미 → 백테스트 비실행
      var _autoTf = msg.timeframe || '1d';
      if (_cacheMiss && _autoTf !== '1m' && _autoTf !== '5m' && analyzeCandles && analyzeCandles.length >= 50 && typeof backtester !== 'undefined') {
        try {
          backtester._currentMarket = msg.market || '';
          // [H-2] save/restore _currentTimeframe — 백테스터 내부 analyze()가 '1d'로 리셋 방지
          var _savedTf = (typeof PatternEngine !== 'undefined') ? PatternEngine._currentTimeframe : null;
          var autoResults = backtester.backtestAll(analyzeCandles);
          // [H-2] restore _currentTimeframe after backtester's internal analyze()
          if (_savedTf != null && typeof PatternEngine !== 'undefined') PatternEngine._currentTimeframe = _savedTf;
          // Extract learned weights for next analyze cycle
          _extractLearnedWeights(autoResults);
          _extractWinRateMap(autoResults);
          // [AMH] 백테스트 기준시점 기록 (Lo 2004 시변 효율성)
          if (analyzeCandles.length > 0) {
            var lastTime = analyzeCandles[analyzeCandles.length - 1].time;
            _backtestEpochMs = (typeof lastTime === 'string')
              ? new Date(lastTime).getTime()
              : lastTime * 1000;
          }
          // [Signal Backtest] 시그널 백테스트 자동 실행 — optional enhancement
          var autoSignalResults = null;
          try {
            var _t0sig = performance.now();
            autoSignalResults = backtester.backtestAllSignals(analyzeCandles);
            console.log('[Perf] Signal backtest (auto): ' + (performance.now() - _t0sig).toFixed(1) + 'ms, ' +
              Object.keys(autoSignalResults || {}).length + ' signals');
            _extractSignalWinRateMap(autoSignalResults);
          } catch (e) { /* silent — signal backtest is optional enhancement */ }
          self.postMessage({
            type: 'backtestResult',
            results: autoResults,
            signalResults: autoSignalResults,
            learnedWeights: _learnedWeights,
            backtestEpochMs: _backtestEpochMs,
            candleLength: analyzeCandles.length,
            version: msg.version,
          });
        } catch (btErr) { console.warn('[Worker] auto-backtest error:', btErr.message); }
      }

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

      // [TF-AWARE] 분봉(5m 이하)에서는 백테스트 비실행 — HORIZONS [1,3,5,10,20]일이
      // 분봉에서는 [5~100분]이 되어 거래비용 > 기대수익, 통계적 무의미
      var _btTf = msg.timeframe || '1d';
      if (_btTf === '1m' || _btTf === '5m') {
        self.postMessage({ type: 'backtestResult', results: {}, learnedWeights: _learnedWeights,
          backtestEpochMs: _backtestEpochMs, candleLength: candles ? candles.length : 0, version: version });
        return;
      }

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
      // [H-2] save/restore _currentTimeframe — 백테스터 내부 analyze()가 리셋 방지
      var _savedTf2 = (typeof PatternEngine !== 'undefined') ? PatternEngine._currentTimeframe : null;
      const results = backtester.backtestAll(candles);
      if (_savedTf2 != null && typeof PatternEngine !== 'undefined') PatternEngine._currentTimeframe = _savedTf2;
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

      // [Signal Backtest] 시그널 백테스트 실행 — optional enhancement
      var signalResults = null;
      try {
        var _t0sig = performance.now();
        signalResults = backtester.backtestAllSignals(candles);
        console.log('[Perf] Signal backtest (explicit): ' + (performance.now() - _t0sig).toFixed(1) + 'ms, ' +
          Object.keys(signalResults || {}).length + ' signals');
        _extractSignalWinRateMap(signalResults);
      } catch (sigErr) { /* silent — signal backtest is optional enhancement */ }

      self.postMessage({
        type: 'backtestResult',
        results: results,
        signalResults: signalResults,
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

  // ── [H-2] 시장 맥락 주입 ────────────────────────────
  // app.js → Worker: 파생상품/수급/ETF/VKOSPI 데이터를 Worker 전역에 주입.
  // signalEngine._classifyVolRegimeFromVKOSPI()는 _marketContext.vkospi를 읽고,
  // signalEngine._detect*Signal()은 _derivativesData/_investorData/_etfData/_shortSellingData를 읽는다.
  // 레짐 분류만 Worker 내부 수행, 멀티플라이어 적용은 메인 스레드 (이중 적용 방지).
  else if (msg.type === 'marketContext') {
    try {
      // _marketContext: signalEngine._classifyVolRegimeFromVKOSPI()가 vkospi 읽기
      if (msg.vkospi != null) {
        _marketContext = _marketContext || {};
        _marketContext.vkospi = msg.vkospi;
      }

      // _derivativesData: signalEngine._detectBasisSignal(), _detectPCRSignal()
      if (msg.pcr != null || msg.basis != null || msg.basisPct != null) {
        _derivativesData = _derivativesData || {};
        if (msg.pcr != null) _derivativesData.pcr = msg.pcr;
        if (msg.basis != null) _derivativesData.basis = msg.basis;
        if (msg.basisPct != null) _derivativesData.basisPct = msg.basisPct;
      }

      // _etfData: signalEngine._detectETFSentiment()
      if (msg.leverageRatio != null) {
        _etfData = _etfData || {};
        _etfData.leverageSentiment = _etfData.leverageSentiment || {};
        _etfData.leverageSentiment.leverageRatio = msg.leverageRatio;
        // Derive sentiment string from ratio (same thresholds as download_etf.py)
        if (msg.leverageRatio > 2.0) _etfData.leverageSentiment.sentiment = 'strong_bullish';
        else if (msg.leverageRatio > 1.0) _etfData.leverageSentiment.sentiment = 'bullish';
        else if (msg.leverageRatio > 0.5) _etfData.leverageSentiment.sentiment = 'neutral';
        else _etfData.leverageSentiment.sentiment = 'strong_bearish';
      }

      // _investorData: signalEngine._detectFlowSignal()
      if (msg.foreignAlignment != null) {
        _investorData = _investorData || {};
        _investorData.alignment = msg.foreignAlignment;
      }

      // Invalidate analyze cache — regime data changed, signals need recalculation
      _analyzeCache = { key: null, patterns: null, signals: null, stats: null };

      console.log('[Worker] marketContext 주입 완료',
        'vkospi=' + (msg.vkospi != null ? msg.vkospi : '-'),
        'pcr=' + (msg.pcr != null ? msg.pcr : '-'),
        'basis=' + (msg.basis != null ? msg.basis : '-'));
    } catch (err) {
      console.warn('[Worker] marketContext 처리 실패:', err.message);
    }
  }

  else {
    console.warn('[Worker] Unknown message type:', msg.type);
  }
};
