#!/usr/bin/env node
// ══════════════════════════════════════════════════════
//  KRX LIVE — Headless Backtest Runner (Node.js)
//
//  브라우저 JS를 Node에서 실행하여 종목별 백테스트 결과 생성.
//  backtest_all.py에서 호출됨.
//
//  Usage:
//    node scripts/backtest_runner.js <code> <market>    # Single stock
//    node scripts/backtest_runner.js --batch            # All stocks (NDJSON)
//    node scripts/backtest_runner.js --batch --incremental  # Changed stocks only
//
//  Output:
//    Single mode: JSON object to stdout
//    Batch mode:  One JSON line per stock (NDJSON) to stdout,
//                 progress to stderr
//
//  Dependencies: colors.js → indicators.js → patterns.js → backtester.js
//  (same load order as analysisWorker.js)
// ══════════════════════════════════════════════════════

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const DATA_DIR = path.join(ROOT, 'data');

// ── Create VM sandbox + load engine ──────────────────
function createEngine() {
  // [Phase H] fetch stub for Node.js VM — backtester._loadRLPolicy() needs fetch()
  // Load rl_policy.json synchronously and return it via a fake fetch Promise
  const rlPolicyPath = path.join(DATA_DIR, 'backtest', 'rl_policy.json');
  const fakeFetch = function(url) {
    // Resolve JSON data files for backtester lazy-loading
    const resolvers = [
      { match: 'rl_policy', file: 'rl_policy.json' },
      { match: 'survivorship_correction', file: 'survivorship_correction.json' },
    ];
    for (const r of resolvers) {
      if (url.includes(r.match)) {
        const fpath = path.join(DATA_DIR, 'backtest', r.file);
        if (fs.existsSync(fpath)) {
          const data = JSON.parse(fs.readFileSync(fpath, 'utf8'));
          return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
        }
      }
    }
    // Behavioral data files (illiq_spread, hmm_regimes, etc.)
    const btDir = path.join(DATA_DIR, 'backtest');
    const baseName = url.split('/').pop();
    if (baseName && baseName.endsWith('.json')) {
      const fpath = path.join(btDir, baseName);
      if (fs.existsSync(fpath)) {
        const data = JSON.parse(fs.readFileSync(fpath, 'utf8'));
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
      }
    }
    // Market data files (data/market/)
    const mktDir = path.join(DATA_DIR, 'market');
    if (baseName && baseName.endsWith('.json')) {
      const fpath2 = path.join(mktDir, baseName);
      if (fs.existsSync(fpath2)) {
        const data2 = JSON.parse(fs.readFileSync(fpath2, 'utf8'));
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data2) });
      }
    }
    return Promise.resolve({ ok: false });
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Math, Object, Array, Map, Set, Date, Number, String,
    Boolean, RegExp, JSON, Error, TypeError, RangeError,
    parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, undefined,
    setTimeout, clearTimeout, setInterval, clearInterval,
    self: {},
    fetch: fakeFetch,
    Promise,
    WorkerGlobalScope: undefined,
  };

  vm.createContext(sandbox);

  const JS_FILES = ['colors.js', 'indicators.js', 'patterns.js', 'backtester.js'];

  let combinedSource = JS_FILES.map(file => {
    return `// === ${file} ===\n` + fs.readFileSync(path.join(JS_DIR, file), 'utf8');
  }).join('\n\n');

  combinedSource += `
this.patternEngine = patternEngine;
this.backtester = backtester;
this.PatternEngine = PatternEngine;
`;

  vm.runInContext(combinedSource, sandbox, { filename: 'combined.js', timeout: 60000 });

  // [Phase 2-C] Sync-inject CAPM + market data for Jensen's Alpha
  // (Promise microtasks from constructor fetch() don't run in synchronous batch mode)
  const capmPath = path.join(DATA_DIR, 'backtest', 'capm_beta.json');
  if (fs.existsSync(capmPath)) {
    sandbox.backtester._capmBeta = JSON.parse(fs.readFileSync(capmPath, 'utf8'));
  }
  const mktPath = path.join(DATA_DIR, 'market', 'kospi_daily.json');
  if (fs.existsSync(mktPath)) {
    const mktData = JSON.parse(fs.readFileSync(mktPath, 'utf8'));
    const indexed = {};
    for (const d of mktData) if (d.time && d.close != null) indexed[d.time] = d.close;
    sandbox.backtester._marketIndex = indexed;
  }

  // [V25 A2] Sync-inject OOS winrates so batch runner matches live browser behavior
  // (backtester._loadOOSWinrates() uses fetch() which never resolves in synchronous VM)
  try {
    const oosPath = path.join(DATA_DIR, 'backtest', 'pattern_winrates_oos.json');
    if (fs.existsSync(oosPath)) {
      const oosData = JSON.parse(fs.readFileSync(oosPath, 'utf8'));
      if (oosData && oosData.patterns) {
        sandbox.PatternEngine.PATTERN_WIN_RATES_OOS = oosData.patterns;
        console.log(`  [OOS] ${Object.keys(oosData.patterns).length} pattern OOS winrates injected`);
      }
    }
  } catch (e) {
    console.log('  [OOS] pattern_winrates_oos.json load skipped:', e.message);
  }

  return sandbox;
}

// ── Pattern tier mapping (mirrors appState.js _TIER_S/A/B/D) ─────────
const _PATTERN_TIER = new Map([
  // S-Tier (4) — candle
  ...['gravestoneDoji','shootingStar','hangingMan','bearishHarami','darkCloud',
      'bearishMarubozu','threeBlackCrows','bearishHaramiCross','bearishBeltHold',
      'bearishEngulfing','eveningStar'].map(p => [p, 4]),
  // S-Tier (4) — chart
  ...['doubleTop','doubleBottom'].map(p => [p, 4]),
  // A-Tier (3) — candle
  ...['tweezerTop','threeInsideDown'].map(p => [p, 3]),
  // A-Tier (3) — chart
  ...['risingWedge','headAndShoulders'].map(p => [p, 3]),
  // B-Tier (2) — candle
  ...['hammer','tweezerBottom','piercingLine','dragonflyDoji','threeWhiteSoldiers',
      'bullishEngulfing','morningStar','bullishHarami','threeInsideUp','invertedHammer',
      'bullishMarubozu','risingThreeMethods','fallingThreeMethods'].map(p => [p, 2]),
  // B-Tier (2) — chart
  ...['channel','descendingTriangle','inverseHeadAndShoulders','cupAndHandle',
      'fallingWedge','ascendingTriangle','symmetricTriangle'].map(p => [p, 2]),
  // D-Tier suppress (1)
  ...['longLeggedDoji','bullishHaramiCross','bullishBeltHold','spinningTop','doji'].map(p => [p, 1]),
  // D-Tier context-only (0)
  ...['abandonedBabyBullish','abandonedBabyBearish','stickSandwich'].map(p => [p, 0]),
]);

// ── Analyze one stock ────────────────────────────────
function analyzeStock(sandbox, code, market, filePath) {
  const candleFile = filePath
    ? path.join(DATA_DIR, filePath)
    : path.join(DATA_DIR, market.toLowerCase(), `${code}.json`);
  if (!fs.existsSync(candleFile)) {
    return { code, market, error: 'file_not_found' };
  }

  let stockData;
  try {
    stockData = JSON.parse(fs.readFileSync(candleFile, 'utf8'));
  } catch (e) {
    return { code, market, error: `json_parse: ${e.message}` };
  }

  const candles = stockData.candles;
  if (!candles || candles.length < 50) {
    return {
      code,
      name: stockData.name || code,
      market: market.toUpperCase(),
      candleCount: candles ? candles.length : 0,
      patterns: [],
      backtest: {},
      skipped: 'insufficient_candles',
    };
  }

  // Clear caches between stocks
  sandbox.backtester.invalidateCache();

  const patterns = sandbox.patternEngine.analyze(candles);
  const backtestResults = sandbox.backtester.backtestAll(candles, code);

  const patternSummary = patterns.map(p => ({
    type: p.type,
    signal: p.signal,
    confidence: p.confidence,
    startIndex: p.startIndex,
    endIndex: p.endIndex,
    priceTarget: p.priceTarget,
    stopLoss: p.stopLoss,
    riskReward: p.riskReward,
    hw: p.hw,
    vw: p.vw,
    mw: p.mw,
    rw: p.rw,
    wc: p.wc || +((p.hw || 1) * (p.mw || 1)).toFixed(4),
  }));

  // Per-occurrence Wc + actual return pairs (Phase C input)
  const HORIZONS = [1, 3, 5, 10, 20];
  const KRX_COST = 0.31;  // KRX round-trip: commission 0.03% + tax 0.18% + slippage 0.10% (flat, no horizon scaling)

  // Pre-compute indicator arrays once per stock (MRA A-2: 6 indicator variables + HAR-RV)
  const closes = candles.map(c => c.close);
  const _atr = sandbox.calcATR(candles, 14);
  const _vma = sandbox.calcMA(candles.map(c => c.volume || 0), 20);
  const _rsi = sandbox.calcRSI(closes, 14);
  const _macd = sandbox.calcMACD(closes);
  const _bb = sandbox.calcBB(closes, 20, 2);
  const _harRV = sandbox.calcHAR_RV(candles);  // Corsi (2009), needs 83+ candles

  const occurrenceReturns = [];
  for (const p of patterns) {
    const idx = p.endIndex !== undefined ? p.endIndex : p.startIndex;
    if (idx === undefined) continue;
    // [Fix-13] Chart patterns use swing points needing lookback future bars.
    // Offset entry to avoid look-ahead bias in backtest returns.
    const swingOffset = p._swingLookback || 0;
    const entryIdx = idx + swingOffset + 1;
    if (entryIdx >= candles.length) continue;
    const entryPrice = candles[entryIdx].open || candles[idx].close;
    if (!entryPrice || entryPrice === 0) continue;

    const returns = {};
    for (const h of HORIZONS) {
      const exitIdx = idx + h;
      if (exitIdx < candles.length) {
        returns[h] = +((candles[exitIdx].close - entryPrice) / entryPrice * 100 - KRX_COST).toFixed(3);
      }
    }
    if (Object.keys(returns).length > 0) {
      const sigDir = p.signal === 'buy' ? 1 : (p.signal === 'sell' ? -1 : 0);

      // trendStrength: OLS slope of 10-bar closes / ATR (backtester.js lines 1137-1152)
      let trendStrength = 0;
      const lookback = Math.min(10, idx);
      if (lookback >= 3 && _atr) {
        const atrVal = _atr[idx] || (candles[idx].close * 0.02);
        let sx = 0, sy = 0, sxy = 0, sx2 = 0;
        const n = lookback + 1;
        for (let ti = 0; ti <= lookback; ti++) {
          const ci = idx - lookback + ti;
          sx += ti; sy += candles[ci].close;
          sxy += ti * candles[ci].close; sx2 += ti * ti;
        }
        const denom = n * sx2 - sx * sx;
        if (Math.abs(denom) > 1e-10 && atrVal > 0) {
          trendStrength = Math.abs((n * sxy - sx * sy) / denom) / atrVal;
        }
      }

      // volumeRatio: current volume / 20-day VMA (backtester.js lines 1156-1159)
      let volumeRatio = 1;
      if (_vma && _vma[idx] && _vma[idx] > 0 && candles[idx].volume) {
        volumeRatio = candles[idx].volume / _vma[idx];
      }

      // atrNorm: ATR / close price (backtester.js lines 1162-1165)
      let atrNorm = 0.02;
      if (_atr && _atr[idx] && candles[idx].close > 0) {
        atrNorm = _atr[idx] / candles[idx].close;
      }

      // rsi_14: Wilder RSI at pattern bar
      const rsi14 = (_rsi && _rsi[idx] != null) ? +_rsi[idx].toFixed(2) : '';

      // macd_hist: MACD histogram at pattern bar
      const macdHist = (_macd && _macd.histogram[idx] != null) ? +_macd.histogram[idx].toFixed(4) : '';

      // bb_position: (close - lower) / (upper - lower) at pattern bar
      let bbPos = '';
      if (_bb && _bb[idx] && _bb[idx].upper != null && _bb[idx].lower != null) {
        const range = _bb[idx].upper - _bb[idx].lower;
        if (range > 0) {
          bbPos = +((candles[idx].close - _bb[idx].lower) / range).toFixed(4);
        }
      }

      // harRV: HAR-RV annualized forecast at pattern bar (Corsi 2009, Doc34 §1-3)
      const harRV = (_harRV && _harRV[idx] && _harRV[idx].harRV != null)
        ? +_harRV[idx].harRV.toFixed(4) : '';

      occurrenceReturns.push({
        type: p.type,
        signal: p.signal,
        idx,
        date: candles[idx].time,
        wc: p.wc || +((p.hw || 1) * (p.mw || 1)).toFixed(4),
        hw: p.hw,
        vw: p.vw,
        mw: p.mw,
        rw: p.rw,
        confidence: p.confidence,
        signal_direction: sigDir,
        market_type: market.toUpperCase() === 'KOSPI' ? 1 : 0,
        log_confidence: +Math.log((p.confidence || 50) / 100 + 0.001).toFixed(4),
        pattern_tier: _PATTERN_TIER.get(p.type) ?? 2,
        hw_x_signal: +((p.hw || 1) * sigDir).toFixed(4),
        vw_x_signal: +((p.vw || 1) * sigDir).toFixed(4),
        trendStrength: +trendStrength.toFixed(4),
        volumeRatio: +volumeRatio.toFixed(4),
        atrNorm: +atrNorm.toFixed(6),
        rsi_14: rsi14,
        macd_hist: macdHist,
        bb_position: bbPos,
        harRV: harRV,
        returns,
      });
    }
  }

  return {
    code,
    name: stockData.name || code,
    market: market.toUpperCase(),
    candleCount: candles.length,
    patternCount: patterns.length,
    patterns: patternSummary,
    occurrenceReturns,
    backtest: backtestResults,
  };
}

// ── Main ─────────────────────────────────────────────
const args = process.argv.slice(2);

if (args[0] === '--batch') {
  // Batch mode: process all stocks from index.json (or delisted_index.json with --delisted)
  const delistedMode = args.includes('--delisted');
  const indexFile = delistedMode ? 'delisted_index.json' : 'index.json';
  const indexPath = path.join(DATA_DIR, indexFile);
  if (!fs.existsSync(indexPath)) {
    process.stderr.write(indexFile + ' not found\n');
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const stocks = index.stocks || [];

  // --- Incremental mode: filter to changed stocks only ---
  let targetStocks = stocks;
  const incrementalIdx = args.indexOf('--incremental');
  if (incrementalIdx !== -1) {
    const codesFile = path.join(DATA_DIR, 'backtest', '.incremental_codes.json');
    if (fs.existsSync(codesFile)) {
      const changedCodes = new Set(JSON.parse(fs.readFileSync(codesFile, 'utf8')));
      targetStocks = stocks.filter(s => changedCodes.has(s.code));
      process.stderr.write('[backtest] Incremental mode: ' + targetStocks.length + '/' + stocks.length + ' stocks to process\n');
    } else {
      process.stderr.write('[backtest] WARNING: --incremental but no .incremental_codes.json found. Processing all.\n');
    }
  }

  const total = targetStocks.length;

  process.stderr.write(`[backtest] Loading engine...\n`);
  const sandbox = createEngine();
  process.stderr.write(`[backtest] Engine ready. Processing ${total} stocks...\n`);

  let done = 0;
  let errors = 0;
  let skipped = 0;
  const startTime = Date.now();

  for (const stock of targetStocks) {
    try {
      // D-1: delisted mode uses stock.file path directly (e.g., "delisted/008110.json")
      const filePath = delistedMode ? stock.file : null;
      const result = analyzeStock(sandbox, stock.code, stock.market, filePath);
      process.stdout.write(JSON.stringify(result) + '\n');
      if (result.skipped) skipped++;
      if (result.error) errors++;
    } catch (e) {
      process.stdout.write(JSON.stringify({
        code: stock.code,
        market: stock.market,
        error: e.message,
      }) + '\n');
      errors++;
    }

    done++;
    if (done % 100 === 0 || done === total) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (done / (Date.now() - startTime) * 1000).toFixed(1);
      process.stderr.write(
        `[backtest] ${done}/${total} (${(done/total*100).toFixed(1)}%) ` +
        `${elapsed}s elapsed, ${rate} stocks/s, ${errors} errors, ${skipped} skipped\n`
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  process.stderr.write(`[backtest] Done: ${done} stocks in ${totalTime}s\n`);

} else {
  // Single stock mode
  const code = args[0];
  const market = args[1];

  if (!code || !market) {
    process.stderr.write('Usage: node backtest_runner.js <code> <market>\n');
    process.stderr.write('       node backtest_runner.js --batch\n');
    process.exit(1);
  }

  const sandbox = createEngine();
  const result = analyzeStock(sandbox, code, market);

  if (result.error) {
    process.stderr.write(`Error: ${result.error}\n`);
    process.exit(2);
  }

  process.stdout.write(JSON.stringify(result));
}
