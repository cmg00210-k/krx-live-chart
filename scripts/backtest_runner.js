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
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Math, Object, Array, Map, Set, Date, Number, String,
    Boolean, RegExp, JSON, Error, TypeError, RangeError,
    parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, undefined,
    self: {},
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

  return sandbox;
}

// ── Analyze one stock ────────────────────────────────
function analyzeStock(sandbox, code, market) {
  const candleFile = path.join(DATA_DIR, market.toLowerCase(), `${code}.json`);
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
  const backtestResults = sandbox.backtester.backtestAll(candles);

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
  const KRX_COST = 0.36;
  const occurrenceReturns = [];
  for (const p of patterns) {
    const idx = p.endIndex !== undefined ? p.endIndex : p.startIndex;
    if (idx === undefined) continue;
    const entryIdx = idx + 1;
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
  // Batch mode: process all stocks from index.json
  const indexPath = path.join(DATA_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) {
    process.stderr.write('index.json not found\n');
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const stocks = index.stocks || [];
  const total = stocks.length;

  process.stderr.write(`[backtest] Loading engine...\n`);
  const sandbox = createEngine();
  process.stderr.write(`[backtest] Engine ready. Processing ${total} stocks...\n`);

  let done = 0;
  let errors = 0;
  let skipped = 0;
  const startTime = Date.now();

  for (const stock of stocks) {
    try {
      const result = analyzeStock(sandbox, stock.code, stock.market);
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
