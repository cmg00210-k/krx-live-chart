// debug/pattern-trace-hook.js — trace-only monkeypatch, NEVER deploy.
// Installs hooks on Worker-scope patternEngine / signalEngine singletons
// created by importScripts('patterns.js','signalEngine.js','backtester.js').
//
// Contract:
//   - Transparent: wrapped analyze() returns the ORIGINAL result unchanged.
//     A/B regression Δ=0 depends on this.
//   - Error-isolated: try/catch around every capture. Capture failures are
//     recorded to trace.meta.captureErrors[] and must not bubble.
//   - No DOM / no fetch. Worker scope only.
//
// Exposes self.__PATTERN_TRACE__ = { runOnce(msg) }.
// pattern-trace-worker.js calls runOnce() inside its onmessage handler.

(function installPatternTraceHook(global) {
  'use strict';

  // ── Guard — singletons must exist (importScripts loaded them) ──────────
  if (typeof patternEngine === 'undefined') {
    throw new Error('[pattern-trace] patternEngine singleton not found. ' +
      'Check importScripts order in pattern-trace-worker.js.');
  }
  if (typeof signalEngine === 'undefined') {
    throw new Error('[pattern-trace] signalEngine singleton not found.');
  }
  // backtester is optional for MVP (WR lookup is best-effort)
  var haveBacktester = (typeof backtester !== 'undefined');

  // ── Canonical family table (45 patterns, from .claude/rules/patterns.md) ──
  var FAMILY_TABLE = {
    // candle.single (13)
    doji: 'candle.single.doji',
    hammer: 'candle.single.hammer',
    invertedHammer: 'candle.single.invertedHammer',
    hangingMan: 'candle.single.hangingMan',
    shootingStar: 'candle.single.shootingStar',
    dragonflyDoji: 'candle.single.dragonflyDoji',
    gravestoneDoji: 'candle.single.gravestoneDoji',
    longLeggedDoji: 'candle.single.longLeggedDoji',
    spinningTop: 'candle.single.spinningTop',
    bullishMarubozu: 'candle.single.bullishMarubozu',
    bearishMarubozu: 'candle.single.bearishMarubozu',
    bullishBeltHold: 'candle.single.bullishBeltHold',
    bearishBeltHold: 'candle.single.bearishBeltHold',
    // candle.double (10)
    bullishEngulfing: 'candle.double.bullishEngulfing',
    bearishEngulfing: 'candle.double.bearishEngulfing',
    bullishHarami: 'candle.double.bullishHarami',
    bearishHarami: 'candle.double.bearishHarami',
    bullishHaramiCross: 'candle.double.bullishHaramiCross',
    bearishHaramiCross: 'candle.double.bearishHaramiCross',
    piercingLine: 'candle.double.piercingLine',
    darkCloud: 'candle.double.darkCloud',
    tweezerBottom: 'candle.double.tweezerBottom',
    tweezerTop: 'candle.double.tweezerTop',
    // candle.triple (9)
    threeWhiteSoldiers: 'candle.triple.threeWhiteSoldiers',
    threeBlackCrows: 'candle.triple.threeBlackCrows',
    morningStar: 'candle.triple.morningStar',
    eveningStar: 'candle.triple.eveningStar',
    threeInsideUp: 'candle.triple.threeInsideUp',
    threeInsideDown: 'candle.triple.threeInsideDown',
    abandonedBabyBullish: 'candle.triple.abandonedBabyBullish',
    abandonedBabyBearish: 'candle.triple.abandonedBabyBearish',
    stickSandwich: 'candle.triple.stickSandwich',
    // candle.multi (2)
    risingThreeMethods: 'candle.multi.risingThreeMethods',
    fallingThreeMethods: 'candle.multi.fallingThreeMethods',
    // chart (11)
    doubleBottom: 'chart.doubleBottom',
    doubleTop: 'chart.doubleTop',
    headAndShoulders: 'chart.headAndShoulders',
    inverseHeadAndShoulders: 'chart.inverseHeadAndShoulders',
    ascendingTriangle: 'chart.ascendingTriangle',
    descendingTriangle: 'chart.descendingTriangle',
    symmetricTriangle: 'chart.symmetricTriangle',
    risingWedge: 'chart.risingWedge',
    fallingWedge: 'chart.fallingWedge',
    channel: 'chart.channel',
    cupAndHandle: 'chart.cupAndHandle'
  };

  function familyOf(patternType) {
    return FAMILY_TABLE[patternType] || ('unknown.' + String(patternType));
  }

  // ── Ring buffer — MAX_EVENTS=5000, cap flag on overflow ───────────────
  var MAX_EVENTS = 5000;

  function makeSession() {
    return {
      events: [],                 // ring buffer
      capped: false,              // ring overflow flag
      captureErrors: [],          // hook-internal error trail
      opts: null,                 // last analyze() opts (market/timeframe)
      postCtx: null,              // snapshot of PatternEngine statics after analyze
      durationStartMs: 0,
      durationMs: 0
    };
  }
  var session = makeSession();

  function pushEvent(e) {
    if (session.events.length >= MAX_EVENTS) {
      session.capped = true;
      session.events.shift(); // drop oldest
    }
    session.events.push(e);
  }

  function captureSafe(label, fn) {
    try { return fn(); }
    catch (err) {
      session.captureErrors.push({
        where: label,
        message: (err && err.message) || String(err),
        stack: (err && err.stack) || null
      });
      return null;
    }
  }

  // ── Pattern engine analyze() wrap ──────────────────────────────────────
  var origPatternAnalyze = patternEngine.analyze.bind(patternEngine);
  patternEngine.analyze = function wrappedPatternAnalyze(candles, opts) {
    captureSafe('patternAnalyze.pre', function () {
      session.opts = {
        market: (opts && opts.market) || null,
        timeframe: (opts && opts.timeframe) || '1d',
        detectFrom: (opts && opts.detectFrom != null) ? opts.detectFrom : null
      };
      pushEvent({ t: 'patternAnalyze.enter', barCount: (candles || []).length });
    });

    var result = origPatternAnalyze(candles, opts);

    captureSafe('patternAnalyze.post', function () {
      // Snapshot PatternEngine static fields populated during analyze()
      var caps = (typeof PatternEngine !== 'undefined' && PatternEngine._currentDynamicCaps) || null;
      session.postCtx = {
        currentMarket:   (typeof PatternEngine !== 'undefined') ? PatternEngine._currentMarket   : null,
        currentTimeframe:(typeof PatternEngine !== 'undefined') ? PatternEngine._currentTimeframe: null,
        currentVolRegime:(typeof PatternEngine !== 'undefined') ? PatternEngine._currentVolRegime: null,
        currentDynamicCaps: caps
      };
      pushEvent({ t: 'patternAnalyze.exit', patternCount: (result || []).length });
    });

    return result; // transparent — no mutation
  };

  // ── Signal engine analyze() wrap ───────────────────────────────────────
  var origSignalAnalyze = signalEngine.analyze.bind(signalEngine);
  signalEngine.analyze = function wrappedSignalAnalyze(candles, candlePatterns) {
    captureSafe('signalAnalyze.pre', function () {
      pushEvent({ t: 'signalAnalyze.enter',
        barCount: (candles || []).length,
        patternInputCount: (candlePatterns || []).length });
    });
    var result = origSignalAnalyze(candles, candlePatterns);
    captureSafe('signalAnalyze.post', function () {
      pushEvent({ t: 'signalAnalyze.exit',
        signalCount: (result && result.signals) ? result.signals.length : 0 });
    });
    return result;
  };

  // ── WR lookup helper ───────────────────────────────────────────────────
  // Reads PatternEngine.PATTERN_WIN_RATES (raw), PATTERN_SAMPLE_SIZES (N),
  // PATTERN_WIN_RATES_SHRUNK (EB shrunk at N0=35). grandMean computed lazily.
  var _grandMeanCache = null;
  function computeGrandMeans() {
    if (_grandMeanCache) return _grandMeanCache;
    try {
      var raw = PatternEngine.PATTERN_WIN_RATES || {};
      var sizes = PatternEngine.PATTERN_SAMPLE_SIZES || {};
      var chartSet = {
        doubleBottom: 1, doubleTop: 1, headAndShoulders: 1, inverseHeadAndShoulders: 1,
        ascendingTriangle: 1, descendingTriangle: 1, symmetricTriangle: 1,
        risingWedge: 1, fallingWedge: 1, channel: 1
      };
      var N0 = 35;
      var sumWN_c = 0, sumN_c = 0, sumWN_k = 0, sumN_k = 0;
      for (var k in raw) {
        var n = sizes[k] || N0;
        if (chartSet[k]) { sumWN_k += raw[k] * n; sumN_k += n; }
        else             { sumWN_c += raw[k] * n; sumN_c += n; }
      }
      _grandMeanCache = {
        candle: sumN_c > 0 ? (sumWN_c / sumN_c) : 50,
        chart:  sumN_k > 0 ? (sumWN_k / sumN_k) : 50,
        isChart: function (t) { return !!chartSet[t]; },
        N0: N0
      };
    } catch (err) {
      _grandMeanCache = { candle: 50, chart: 50, isChart: function () { return false; }, N0: 35 };
    }
    return _grandMeanCache;
  }

  function wrFor(patternType) {
    try {
      if (typeof PatternEngine === 'undefined') return null;
      var raw = PatternEngine.PATTERN_WIN_RATES && PatternEngine.PATTERN_WIN_RATES[patternType];
      if (raw == null) return null;
      var N = (PatternEngine.PATTERN_SAMPLE_SIZES && PatternEngine.PATTERN_SAMPLE_SIZES[patternType]) || null;
      var shrunk = (PatternEngine.PATTERN_WIN_RATES_SHRUNK && PatternEngine.PATTERN_WIN_RATES_SHRUNK[patternType]);
      var gm = computeGrandMeans();
      return {
        raw: raw,
        N: N,
        N0: gm.N0,
        grandMean: +(gm.isChart(patternType) ? gm.chart : gm.candle).toFixed(2),
        shrunk: (shrunk != null) ? shrunk : null
      };
    } catch (err) { return null; }
  }

  // ── Build perPattern[] entries from result array ───────────────────────
  function buildPerPattern(patterns, bars) {
    var groups = Object.create(null); // family → {family, detected: [...]}
    if (!patterns || !patterns.length) return [];
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      if (!p || !p.type) continue;
      var fam = familyOf(p.type);
      if (!groups[fam]) {
        groups[fam] = { family: fam, detected: [], nearMiss: [], aggregateRejected: null };
      }
      // patterns.js writes endIndex (triple/double) or barIndex (older code paths)
      var barIdx = (p.barIndex != null) ? p.barIndex
                 : (p.endIndex != null) ? p.endIndex
                 : (p.endIdx   != null) ? p.endIdx
                 : (p.idx      != null) ? p.idx
                 : null;
      var time = null;
      if (barIdx != null && bars && bars[barIdx]) time = bars[barIdx].time;

      groups[fam].detected.push({
        barIndex: barIdx,
        time: time,
        tracePreId: 'pre-1',
        l2: [],                                    // MVP — mid/full sessions populate
        l3: {
          outcome: 'detected',
          baseConfidence: (p.baseConfidence != null ? p.baseConfidence : null),
          confidencePath: [],                      // MVP — full session populates
          finalConfidence: (p.confidence != null ? p.confidence : null),
          stopLoss: (p.stopLoss != null ? p.stopLoss : null),
          priceTarget: (p.priceTarget != null ? p.priceTarget : null),
          wr: wrFor(p.type),
          antiPredictor: null,                     // full session
          pValue: null,
          bhFdrThreshold: null
        }
      });
    }
    var out = [];
    for (var key in groups) out.push(groups[key]);
    return out;
  }

  // ── SR levels extraction — non-enumerable array property on patterns ──
  function extractSRLevels(patterns) {
    try {
      if (!patterns) return [];
      var sr = patterns._srLevels;
      if (!Array.isArray(sr)) return [];
      return sr.map(function (lv) {
        return {
          price: (lv && lv.price != null) ? lv.price : null,
          touchCount: (lv && lv.touchCount != null) ? lv.touchCount : null,
          strength: (lv && lv.strength != null) ? lv.strength : null
        };
      });
    } catch (err) { return []; }
  }

  // ── runOnce — Worker onmessage calls this ─────────────────────────────
  function runOnce(msg) {
    session = makeSession();
    session.durationStartMs = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

    var candles = (msg && msg.candles) || [];
    var opts = {
      market: msg && msg.market,
      timeframe: msg && msg.timeframe
    };

    // Run pipeline via wrapped methods (they capture into `session`)
    var patterns;
    try {
      patterns = patternEngine.analyze(candles, opts);
    } catch (err) {
      session.captureErrors.push({ where: 'runOnce.patternEngine.analyze',
        message: err.message, stack: err.stack });
      patterns = [];
    }

    var signalResult = { signals: [], cache: null, stats: null };
    try {
      signalResult = signalEngine.analyze(candles, patterns) || signalResult;
    } catch (err) {
      session.captureErrors.push({ where: 'runOnce.signalEngine.analyze',
        message: err.message, stack: err.stack });
    }

    session.durationMs = ((typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now()) - session.durationStartMs;

    // Build trace payload — schema v1
    var post = session.postCtx || {};
    var regime = {
      hurstWeight: { _unavailable: true, reason: 'local var in analyze()' },
      volWeight:   { _unavailable: true, reason: 'local var in analyze()' },
      meanRevWeight: { _unavailable: true, reason: 'local var in analyze()' },
      regimeWeight:  { _unavailable: true, reason: 'local var in analyze()' },
      dynamicATRCap: (post.currentDynamicCaps && post.currentDynamicCaps.confidence) || { _unavailable: true },
      amhDecayFactor: { _unavailable: true, reason: 'computed per-pattern, not stored' },
      currentVolRegime: post.currentVolRegime || null,
      currentDynamicCaps: post.currentDynamicCaps || null
    };

    // Best-effort indicator cache summary — read from signalResult.cache if present
    var indicatorSummary = {};
    captureSafe('indicatorSummary', function () {
      var c = signalResult && signalResult.cache;
      if (c && typeof c.atr === 'function') {
        var atr14 = c.atr(14); if (atr14 && atr14.length) indicatorSummary['atr14.last'] = atr14[atr14.length - 1];
      }
      if (c && typeof c.ma === 'function') {
        var ma20 = c.ma(20); if (ma20 && ma20.length) indicatorSummary['ma20.last'] = ma20[ma20.length - 1];
      }
      if (c && typeof c.rsi === 'function') {
        var rsi = c.rsi(14); if (rsi && rsi.length) indicatorSummary['rsi14.last'] = rsi[rsi.length - 1];
      }
    });

    var bars = [];
    for (var bi = 0; bi < candles.length; bi++) {
      var cc = candles[bi];
      bars.push({
        time: cc.time,
        open: cc.open, high: cc.high, low: cc.low, close: cc.close,
        volume: (cc.volume != null ? cc.volume : null)
      });
    }

    var perPattern = buildPerPattern(patterns, candles);
    var srLevels = extractSRLevels(patterns);

    // Trace events for replayTrace
    var replayEvents = [];
    for (var ei = 0; ei < session.events.length; ei++) {
      var e = session.events[ei];
      if (e.t === 'patternAnalyze.exit') {
        // also emit detect events from patterns
        for (var pi = 0; pi < (patterns || []).length; pi++) {
          var pp = patterns[pi];
          if (!pp || !pp.type) continue;
          var bIdx = (pp.barIndex != null) ? pp.barIndex : (pp.endIndex != null ? pp.endIndex : null);
          replayEvents.push({ bar: bIdx, type: 'detect', family: familyOf(pp.type) });
        }
      }
    }

    var trace = {
      schemaVersion: 1,
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'browser-worker',
        stockCode: (msg && msg.stockCode) || null,
        market:    (msg && msg.market)    || null,
        timeframe: (msg && msg.timeframe) || null,
        barCount: bars.length,
        patternEngineVersion: (global.__TRACE_VERSIONS__ && global.__TRACE_VERSIONS__.patterns) || null,
        signalEngineVersion:  (global.__TRACE_VERSIONS__ && global.__TRACE_VERSIONS__.signalEngine) || null,
        traceLevel: (msg && msg.traceLevel) || 'mvp',
        durationMs: +session.durationMs.toFixed(2),
        ringBufferCapped: session.capped,
        eventsEmitted: session.events.length,
        captureErrors: session.captureErrors
      },
      bars: bars,
      preAnalyze: {
        tracePreId: 'pre-1',
        regime: regime,
        indicatorCacheSummary: indicatorSummary
      },
      perPattern: perPattern,
      postPipeline: {
        srLevels: srLevels,
        confluenceApplications: [],                // full session
        signals: (signalResult && signalResult.signals) ? signalResult.signals : [],
        signalTrace: []
      },
      replayTrace: {
        density: 'sparse',
        events: replayEvents
      }
    };

    return trace;
  }

  global.__PATTERN_TRACE__ = {
    runOnce: runOnce,
    _familyOf: familyOf,           // exported for debug viewer
    _wrFor: wrFor,
    _MAX_EVENTS: MAX_EVENTS
  };

  // Signal successful install — worker's postMessage('ready') will follow
  if (typeof console !== 'undefined' && console.log) {
    console.log('[pattern-trace] hook installed on patternEngine / signalEngine singletons. '
      + 'haveBacktester=' + haveBacktester);
  }
})(self);
