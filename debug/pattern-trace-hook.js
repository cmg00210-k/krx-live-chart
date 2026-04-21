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
//
// Session 2 — A-Mid upgrade (2026-04-21):
//   - Per-family aggregate rejection (considered / detected / nearMiss /
//     unexplainedReject) via pre/post candidate-bar enumeration.
//   - L3 statistical fields: pValue (best-effort from backtester cache),
//     bhFdrThreshold (cross-asset 9.62e-4 baseline), antiPredictor
//     (EB-shrunk WR < 48), inverted (p.inverted || null).
//   - Invariant guard: considered >= detected + nearMiss + unexplainedReject.
//   - Double-install guard (M5 audit finding): wrapper function tags itself.
//   - traceLevel: msg.traceLevel honored (mvp|mid). meta.traceLevel reflects.

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

  // ── LOOKBACK_BY_FAMILY — conservative minimum bars a detector consumes ──
  // Values chosen from patterns.js detector bodies (grep of detect* fns 2026-04-21):
  //   - Single-bar: 1-bar body + 14-bar ATR baseline (ctx.atr = calcATR(14))
  //   - Double-bar: 2-bar body + 14-bar ATR baseline → considered = length - 1 - 13
  //   - Triple-bar: 3-bar body + 14-bar ATR baseline → considered = length - 2 - 13
  //   - 5-bar multi (rising/fallingThreeMethods): length - 4 - 13
  //   - Chart patterns: pivot scans use larger windows; conservative estimates below.
  // Key fields: type='bar'|'chart'; barWindow=patt body length; minLookback=bars consumed
  // before first eligible detection point.
  var LOOKBACK_BY_FAMILY = {
    // 1-bar candles (13) — ATR(14) baseline requires 14 priors; first eligible idx=14
    hammer:              { type: 'bar', barWindow: 1, minLookback: 14 },
    invertedHammer:      { type: 'bar', barWindow: 1, minLookback: 14 },
    hangingMan:          { type: 'bar', barWindow: 1, minLookback: 14 },
    shootingStar:        { type: 'bar', barWindow: 1, minLookback: 14 },
    doji:                { type: 'bar', barWindow: 1, minLookback: 14 },
    dragonflyDoji:       { type: 'bar', barWindow: 1, minLookback: 14 },
    gravestoneDoji:      { type: 'bar', barWindow: 1, minLookback: 14 },
    longLeggedDoji:      { type: 'bar', barWindow: 1, minLookback: 14 },
    spinningTop:         { type: 'bar', barWindow: 1, minLookback: 14 },
    bullishMarubozu:     { type: 'bar', barWindow: 1, minLookback: 14 },
    bearishMarubozu:     { type: 'bar', barWindow: 1, minLookback: 14 },
    bullishBeltHold:     { type: 'bar', barWindow: 1, minLookback: 14 },
    bearishBeltHold:     { type: 'bar', barWindow: 1, minLookback: 14 },
    // 2-bar doubles (10)
    bullishEngulfing:    { type: 'bar', barWindow: 2, minLookback: 14 },
    bearishEngulfing:    { type: 'bar', barWindow: 2, minLookback: 14 },
    bullishHarami:       { type: 'bar', barWindow: 2, minLookback: 14 },
    bearishHarami:       { type: 'bar', barWindow: 2, minLookback: 14 },
    bullishHaramiCross:  { type: 'bar', barWindow: 2, minLookback: 14 },
    bearishHaramiCross:  { type: 'bar', barWindow: 2, minLookback: 14 },
    piercingLine:        { type: 'bar', barWindow: 2, minLookback: 14 },
    darkCloud:           { type: 'bar', barWindow: 2, minLookback: 14 },
    tweezerBottom:       { type: 'bar', barWindow: 2, minLookback: 14 },
    tweezerTop:          { type: 'bar', barWindow: 2, minLookback: 14 },
    // 3-bar triples (9)
    threeWhiteSoldiers:  { type: 'bar', barWindow: 3, minLookback: 14 },
    threeBlackCrows:     { type: 'bar', barWindow: 3, minLookback: 14 },
    morningStar:         { type: 'bar', barWindow: 3, minLookback: 14 },
    eveningStar:         { type: 'bar', barWindow: 3, minLookback: 14 },
    threeInsideUp:       { type: 'bar', barWindow: 3, minLookback: 14 },
    threeInsideDown:     { type: 'bar', barWindow: 3, minLookback: 14 },
    abandonedBabyBullish:{ type: 'bar', barWindow: 3, minLookback: 14 },
    abandonedBabyBearish:{ type: 'bar', barWindow: 3, minLookback: 14 },
    stickSandwich:       { type: 'bar', barWindow: 3, minLookback: 14 },
    // 5-bar multi (2)
    risingThreeMethods:  { type: 'bar', barWindow: 5, minLookback: 14 },
    fallingThreeMethods: { type: 'bar', barWindow: 5, minLookback: 14 },
    // chart patterns — conservative windows from patterns.js pivot scan bodies.
    // doubleBottom/Top: findPivots requires ~20-40 bar spans
    doubleBottom:            { type: 'chart', barWindow: 40, minLookback: 40 },
    doubleTop:               { type: 'chart', barWindow: 40, minLookback: 40 },
    // H&S: left shoulder + head + right shoulder each ~20-30 bars → ~80 bars
    headAndShoulders:        { type: 'chart', barWindow: 80, minLookback: 80 },
    inverseHeadAndShoulders: { type: 'chart', barWindow: 80, minLookback: 80 },
    // triangles/wedges: ~30-60 bar pivot scan window
    ascendingTriangle:       { type: 'chart', barWindow: 50, minLookback: 50 },
    descendingTriangle:      { type: 'chart', barWindow: 50, minLookback: 50 },
    symmetricTriangle:       { type: 'chart', barWindow: 50, minLookback: 50 },
    risingWedge:             { type: 'chart', barWindow: 50, minLookback: 50 },
    fallingWedge:            { type: 'chart', barWindow: 50, minLookback: 50 },
    // channel: repeat-touch trendline ~40 bars
    channel:                 { type: 'chart', barWindow: 40, minLookback: 40 },
    // cupAndHandle: cup ~50-100 bars + handle 10-20 → ~100 bars total
    cupAndHandle:            { type: 'chart', barWindow: 100, minLookback: 100 }
  };

  function computeConsidered(patternType, candleCount) {
    var m = LOOKBACK_BY_FAMILY[patternType];
    if (!m) return 0;
    // considered = count of distinct final-bar positions the detector could
    // have scanned, given at least `minLookback` priors and `barWindow` body.
    // c = candleCount - minLookback - (barWindow - 1), floored at 0.
    var c = candleCount - m.minLookback - (m.barWindow - 1);
    return c > 0 ? c : 0;
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
      durationMs: 0,
      traceLevel: 'mvp',          // dynamic per-call: 'mvp' | 'mid'
      pValueTable: null,          // { patternType: pValue } — set by buildPValueTable (mid only)
      pValueDurationMs: 0         // perf budget track
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

  // ── Double-install guard (M5) ───────────────────────────────────────────
  // If analyze is already wrapped, skip re-installation. Detect via a tag
  // attached to our wrapper function. Guards against repeat importScripts
  // (not expected today, but cheap defense).
  var alreadyWrappedPattern = !!(patternEngine.analyze && patternEngine.analyze.__isTraceWrapped);
  var alreadyWrappedSignal  = !!(signalEngine.analyze  && signalEngine.analyze.__isTraceWrapped);
  if (alreadyWrappedPattern || alreadyWrappedSignal) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[pattern-trace] wrapper already installed '
        + '(pattern=' + alreadyWrappedPattern + ', signal=' + alreadyWrappedSignal + '); '
        + 'skipping re-wrap to avoid double-install.');
    }
  }

  // ── Pattern engine analyze() wrap ──────────────────────────────────────
  if (!alreadyWrappedPattern) {
    var origPatternAnalyze = patternEngine.analyze.bind(patternEngine);
    var wrappedPatternAnalyze = function wrappedPatternAnalyze(candles, opts) {
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
    wrappedPatternAnalyze.__isTraceWrapped = true;
    patternEngine.analyze = wrappedPatternAnalyze;
  }

  // ── Signal engine analyze() wrap ───────────────────────────────────────
  if (!alreadyWrappedSignal) {
    var origSignalAnalyze = signalEngine.analyze.bind(signalEngine);
    var wrappedSignalAnalyze = function wrappedSignalAnalyze(candles, candlePatterns) {
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
    wrappedSignalAnalyze.__isTraceWrapped = true;
    signalEngine.analyze = wrappedSignalAnalyze;
  }

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

  // ── BH-FDR threshold (cross-asset baseline) ─────────────────────────────
  // Plan line 157: q/√N_tests ≈ 9.62e-4 with q=0.05, N_tests=2631.
  // backtester.js _applyBHFDR uses Math.sqrt(ALL_STOCKS.length ~2700) for the
  // same purpose. Hook exposes the fixed baseline so the viewer does not need
  // ALL_STOCKS at display time. If backtester has already computed it for this
  // stock, we will read that instead (see buildPValueTable).
  var BH_FDR_CROSS_BASELINE = 9.62e-4;

  // ── Anti-predictor test ─────────────────────────────────────────────────
  // Plan line 156: EB-shrunk WR < 48 → anti-predictor true.
  function isAntiPredictor(patternType) {
    try {
      var wr = wrFor(patternType);
      if (!wr || wr.shrunk == null) return null;
      return wr.shrunk < 48;
    } catch (err) { return null; }
  }

  // ── Best-effort p-value table ──────────────────────────────────────────
  // Tries backtester.getCached() first (free). If absent and traceLevel='mid',
  // runs backtester.backtestAll() under a perf budget guard and captures duration.
  // backtestAll mutates backtester._currentStockCode and ._cache — these are
  // per-Worker singletons so no production pollution.
  var PVALUE_BUDGET_MS = 500; // abort if we are about to exceed; record error

  function extractPValueTable(btResults) {
    // btResults shape: { [pType]: { horizons: { 5: { tStat, n, ... } }, ... }, _spaTest: {...} }
    // We prefer horizon=5 tStat → _approxPValue. Skip _spaTest and any non-horizons keys.
    var tbl = Object.create(null);
    if (!btResults) return tbl;
    try {
      var approxFn = (backtester && typeof backtester._approxPValue === 'function')
        ? backtester._approxPValue.bind(backtester) : null;
      for (var pType in btResults) {
        if (pType === '_spaTest') continue;
        var r = btResults[pType];
        if (!r || !r.horizons) continue;
        var h5 = r.horizons[5];
        if (!h5 || !h5.n || h5.n < 2) { tbl[pType] = null; continue; }
        var absT = Math.abs(h5.tStat || 0);
        if (!approxFn) { tbl[pType] = null; continue; }
        tbl[pType] = +approxFn(absT, h5.n - 1).toFixed(4);
      }
    } catch (err) {
      session.captureErrors.push({
        where: 'extractPValueTable',
        message: (err && err.message) || String(err),
        category: 'pvalue.unavailable'
      });
    }
    return tbl;
  }

  function buildPValueTable(candles, stockCode) {
    if (!haveBacktester) {
      session.captureErrors.push({ where: 'buildPValueTable',
        category: 'pvalue.unavailable',
        message: 'backtester singleton not imported into Worker' });
      return null;
    }
    if (!candles || candles.length < 50) {
      // backtester.backtestAll returns {} if <50 — skip silently, not an error
      return null;
    }
    var t0 = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    // First try cache (free)
    var cached = null;
    try {
      if (typeof backtester.getCached === 'function') {
        cached = backtester.getCached(stockCode || null, candles.length);
      }
    } catch (_) { cached = null; }
    if (cached) {
      session.pValueDurationMs = 0;
      return extractPValueTable(cached);
    }
    // Run full backtest (mid level only — caller gates this)
    var results = null;
    try {
      results = backtester.backtestAll(candles, stockCode || null);
    } catch (err) {
      session.captureErrors.push({
        where: 'buildPValueTable.backtestAll',
        category: 'pvalue.unavailable',
        message: (err && err.message) || String(err),
        stack: (err && err.stack) || null
      });
      return null;
    }
    var t1 = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    session.pValueDurationMs = +(t1 - t0).toFixed(2);
    if (session.pValueDurationMs > PVALUE_BUDGET_MS) {
      session.captureErrors.push({
        where: 'buildPValueTable.budgetExceeded',
        category: 'pvalue.slow',
        message: 'backtestAll took ' + session.pValueDurationMs + 'ms (budget ' + PVALUE_BUDGET_MS + 'ms)'
      });
    }
    return extractPValueTable(results);
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

      // A-Mid L3 stats (best-effort from session.pValueTable)
      var pv = (session.pValueTable && p.type in session.pValueTable)
        ? session.pValueTable[p.type] : null;
      var anti = isAntiPredictor(p.type);
      // p.inverted is not currently set by any detector in patterns.js — keep null
      // so the panel can display "n/a" honestly instead of false default.
      var invertedVal = (p.inverted != null) ? !!p.inverted : null;

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
          antiPredictor: anti,
          pValue: pv,
          bhFdrThreshold: BH_FDR_CROSS_BASELINE,
          inverted: invertedVal
        }
      });
    }
    var out = [];
    for (var key in groups) out.push(groups[key]);
    return out;
  }

  // ── Aggregate rejection — per-family candidate-bar enumeration ─────────
  // For each of the 45 families, compute:
  //   considered         = bars the detector could have scanned (LOOKBACK_BY_FAMILY)
  //   detected           = final patterns[] filtered by family
  //   nearMiss           = 0 at A-Mid (helper-observer is Session 3)
  //   unexplainedReject  = considered - detected - nearMiss
  // Invariant: considered >= detected + nearMiss + unexplainedReject.
  // On violation: record to captureErrors (category 'aggregate.invariant').
  function computeAggregateRejections(perPatternList, candleCount) {
    // Index detected counts by family/type so we can join against LOOKBACK_BY_FAMILY.
    var detectedByType = Object.create(null);
    // perPatternList is grouped by family; we need per-type breakdown within the family
    // because a single family key maps 1:1 to one patternType in FAMILY_TABLE (45→45).
    // Build reverse: familyStr → patternType
    var familyToType = Object.create(null);
    for (var k in FAMILY_TABLE) familyToType[FAMILY_TABLE[k]] = k;

    for (var pi = 0; pi < perPatternList.length; pi++) {
      var grp = perPatternList[pi];
      var pType = familyToType[grp.family] || null;
      if (!pType) continue;
      detectedByType[pType] = (grp.detected || []).length;
    }

    // Emit aggregateRejected for ALL 45 families, even those with 0 detections.
    // Families with 0 detections get their own perPattern entry so aggregate stats
    // are visible even when detector rejected everything.
    var byFamily = Object.create(null);
    for (var pii = 0; pii < perPatternList.length; pii++) {
      byFamily[perPatternList[pii].family] = perPatternList[pii];
    }

    var out = perPatternList.slice(); // shallow copy — do NOT mutate caller's array identity semantics

    for (var ptype in LOOKBACK_BY_FAMILY) {
      var fam = FAMILY_TABLE[ptype];
      var detected = detectedByType[ptype] || 0;
      var considered = computeConsidered(ptype, candleCount);
      var nearMiss = 0; // Session 3 helper-observer
      var unexplained = considered - detected - nearMiss;
      if (unexplained < 0) {
        session.captureErrors.push({
          where: 'computeAggregateRejections',
          category: 'aggregate.invariant',
          family: fam,
          considered: considered,
          detected: detected,
          nearMiss: nearMiss,
          unexplainedReject: unexplained,
          message: 'Invariant violated: considered < detected + nearMiss + unexplainedReject'
        });
        unexplained = 0; // clamp for downstream consumer
      }
      var agg = {
        considered: considered,
        detected: detected,
        nearMiss: nearMiss,
        unexplainedReject: unexplained,
        source: 'aggregate'
      };
      if (byFamily[fam]) {
        byFamily[fam].aggregateRejected = agg;
      } else {
        // Create a bare perPattern entry for 0-detection families so the viewer
        // can still show aggregate rejection stats.
        out.push({
          family: fam,
          detected: [],
          nearMiss: [],
          aggregateRejected: agg
        });
      }
    }
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
    session.traceLevel = (msg && msg.traceLevel === 'mid') ? 'mid'
                        : (msg && msg.traceLevel === 'full') ? 'full'
                        : 'mvp';
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

    // A-Mid: best-effort p-value table from backtester (mid/full only)
    // This runs AFTER analyze/signalAnalyze so it cannot perturb their results.
    // backtester singleton mutates its own _currentStockCode + _cache only —
    // these are per-Worker fields not visible to production.
    if (session.traceLevel === 'mid' || session.traceLevel === 'full') {
      captureSafe('buildPValueTable', function () {
        session.pValueTable = buildPValueTable(candles, (msg && msg.stockCode) || null);
      });
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
    // A-Mid: compute aggregate rejection per family
    if (session.traceLevel === 'mid' || session.traceLevel === 'full') {
      perPattern = captureSafe('computeAggregateRejections', function () {
        return computeAggregateRejections(perPattern, candles.length);
      }) || perPattern;
    }
    var srLevels = extractSRLevels(patterns);

    // Trace events for replayTrace
    var replayEvents = [];
    for (var ei = 0; ei < session.events.length; ei++) {
      var e = session.events[ei];
      if (e.t === 'patternAnalyze.exit') {
        // also emit detect events from patterns
        for (var pi2 = 0; pi2 < (patterns || []).length; pi2++) {
          var pp = patterns[pi2];
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
        traceLevel: session.traceLevel,
        durationMs: +session.durationMs.toFixed(2),
        pValueDurationMs: session.pValueDurationMs,
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
    _isAntiPredictor: isAntiPredictor,
    _computeConsidered: computeConsidered,
    _MAX_EVENTS: MAX_EVENTS,
    _BH_FDR_CROSS_BASELINE: BH_FDR_CROSS_BASELINE,
    _LOOKBACK_BY_FAMILY: LOOKBACK_BY_FAMILY
  };

  // Signal successful install — worker's postMessage('ready') will follow
  if (typeof console !== 'undefined' && console.log) {
    console.log('[pattern-trace] hook installed on patternEngine / signalEngine singletons. '
      + 'haveBacktester=' + haveBacktester
      + ' doubleInstall=' + (alreadyWrappedPattern || alreadyWrappedSignal));
  }
})(self);
