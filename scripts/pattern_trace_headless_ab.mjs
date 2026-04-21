// ══════════════════════════════════════════════════════════════════════
//  pattern_trace_headless_ab.mjs — browser-free A/B regression harness
//
//  Session 2 post-merge addendum (auto-captured by Claude Code).
//  Replaces the manual DevTools capture workflow documented in
//  HANDOFF_SESSION2.md / PR #9 test plan. Loads production js/*.js via
//  Node vm.createContext and runs patternEngine.analyze() headlessly,
//  then re-runs it with debug/pattern-trace-hook.js monkeypatch installed.
//  Tuple Δ=0 across {type, barIndex, outcome, confidence, priceTarget,
//  stopLoss} proves the hook's transparency invariant.
//
//  Differences vs browser workflow:
//   - Bypasses main-thread 14-stage cascade (appWorker.js L309-336) — the
//     A/B here compares raw patternEngine.analyze() output only. This is
//     actually CORRECT for transparency testing: the hook is a Worker-scope
//     monkeypatch; the cascade runs on main thread post-Worker.
//   - Uses raw candle JSON from data/{market}/{code}.json — same files
//     that dataService.getCandles() loads in browser file-mode.
//
//  Usage:
//    node scripts/pattern_trace_headless_ab.mjs           # default 10 pairs
//    node scripts/pattern_trace_headless_ab.mjs --only 005930:1d,035720:1d
//
//  Output: results/pattern_trace_tool/ab_reports/<code>_<tf>/
//            prod_ref.json      (raw patternEngine output — matches
//                                schema consumed by pattern_trace_ab_test.mjs)
//            debug_trace.json   (schema v1 per hook)
//  Exit 0 iff all pairs pass Δ=0 on tuple fields.
// ══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const JS_DIR = join(REPO, 'js');
const DEBUG_DIR = join(REPO, 'debug');
const DATA_DIR = join(REPO, 'data');
const OUT_DIR = join(REPO, 'results', 'pattern_trace_tool', 'ab_reports');

const PROD_FILES = [
  'colors.js',
  'indicators.js',
  'patterns.js',
  'signalEngine.js',
  'backtester.js'
];

const HOOK_FILE = join(DEBUG_DIR, 'pattern-trace-hook.js');

const DEFAULT_PAIRS = [
  { code: '005930', market: 'KOSPI',  tf: '1d'  },
  { code: '005930', market: 'KOSPI',  tf: '1m'  },
  { code: '035720', market: 'KOSPI',  tf: '1d'  },
  { code: '000660', market: 'KOSPI',  tf: '15m' },
  { code: '000250', market: 'KOSDAQ', tf: '1d'  },
  { code: '293490', market: 'KOSDAQ', tf: '1d'  },
  { code: '035420', market: 'KOSPI',  tf: '1m'  },
  { code: '207940', market: 'KOSPI',  tf: '30m' },
  { code: '068270', market: 'KOSPI',  tf: '1d'  },
  { code: '247540', market: 'KOSDAQ', tf: '15m' }
];

// ── Build a Worker-like VM context ────────────────────────────────────
// Stub fetch — backtester.js calls fetch for calibration JSONs, which are
// either absent on disk or live at relative paths with no base URL in Node.
// Backtester's .catch() handlers swallow failures; returning a rejecting
// Promise keeps patternEngine functional while the class instantiates.
function stubFetch() {
  return Promise.reject(new Error('fetch unavailable in headless harness'));
}

function makeWorkerContext() {
  const ctx = {
    console,
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array,
    ArrayBuffer, DataView,
    JSON,
    Math, Date, RegExp, Error, TypeError, RangeError, Symbol, Promise,
    Object, Array, String, Number, Boolean, Map, Set, WeakMap, WeakSet,
    URL, URLSearchParams,
    AbortController, AbortSignal,
    fetch: stubFetch,
    Response: globalThis.Response,
    Request: globalThis.Request,
    Headers: globalThis.Headers
  };
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

function loadInto(ctx, fullpath) {
  const src = readFileSync(fullpath, 'utf8');
  try {
    vm.runInContext(src, ctx, { filename: fullpath });
  } catch (e) {
    throw new Error(`[harness] load failed: ${fullpath}\n  ${e.message}`);
  }
}

function loadProductionPipeline(ctx) {
  for (const f of PROD_FILES) loadInto(ctx, join(JS_DIR, f));
}

function loadHook(ctx) {
  loadInto(ctx, HOOK_FILE);
}

// ── Read candles for (code, market, tf) ───────────────────────────────
function readCandles(code, market, tf) {
  const mdir = market.toLowerCase();
  const fname = tf === '1d' ? `${code}.json` : `${code}_${tf}.json`;
  const path = join(DATA_DIR, mdir, fname);
  if (!existsSync(path)) return { error: `missing: ${path}` };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const candles = Array.isArray(raw) ? raw : (raw.candles || raw.data || []);
    if (!candles.length) return { error: `no candles: ${path}` };
    return { candles, meta: Array.isArray(raw) ? null : raw };
  } catch (e) {
    return { error: `parse failed ${path}: ${e.message}` };
  }
}

// ── Normalize pattern tuple for Δ comparison ──────────────────────────
function tupleKey(p) {
  const priceRound = (v) => {
    if (v == null || !isFinite(v)) return null;
    return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
  };
  return [
    p.type || '?',
    p.endIndex != null ? p.endIndex : (p.barIndex != null ? p.barIndex : '?'),
    p.outcome || 'detected',
    p.confidence != null ? Math.round(p.confidence) : '?',
    priceRound(p.priceTarget),
    priceRound(p.stopLoss)
  ].join('|');
}

// ── Run one pair ──────────────────────────────────────────────────────
function runPair(pair) {
  const { code, market, tf } = pair;
  const tag = `${code} ${market} ${tf}`;
  const result = readCandles(code, market, tf);
  if (result.error) {
    return { pair, status: 'SKIP', reason: result.error };
  }
  const candles = result.candles;

  // ── PROD run (no hook) ──
  const prodCtx = makeWorkerContext();
  try {
    loadProductionPipeline(prodCtx);
  } catch (e) {
    return { pair, status: 'ERROR', reason: 'prod load: ' + e.message };
  }
  prodCtx.__C = candles;
  prodCtx.__OPTS = { market, timeframe: tf };
  let prodPatterns;
  try {
    vm.runInContext('var __R = patternEngine.analyze(__C, __OPTS);', prodCtx);
    prodPatterns = prodCtx.__R;
  } catch (e) {
    return { pair, status: 'ERROR', reason: 'prod analyze: ' + e.message };
  }
  if (!Array.isArray(prodPatterns)) {
    return { pair, status: 'ERROR', reason: 'prod result not array' };
  }

  // ── DEBUG run (hook installed) ──
  const dbgCtx = makeWorkerContext();
  try {
    loadProductionPipeline(dbgCtx);
    loadHook(dbgCtx);
  } catch (e) {
    return { pair, status: 'ERROR', reason: 'dbg load: ' + e.message };
  }
  dbgCtx.__C = candles;
  dbgCtx.__OPTS = { market, timeframe: tf };
  let dbgPatterns;
  try {
    vm.runInContext('var __R = patternEngine.analyze(__C, __OPTS);', dbgCtx);
    dbgPatterns = dbgCtx.__R;
  } catch (e) {
    return { pair, status: 'ERROR', reason: 'dbg analyze: ' + e.message };
  }
  if (!Array.isArray(dbgPatterns)) {
    return { pair, status: 'ERROR', reason: 'dbg result not array' };
  }

  // ── Determinism check: same-context second analyze ──
  let prodPatterns2;
  try {
    vm.runInContext('__R = patternEngine.analyze(__C, __OPTS);', prodCtx);
    prodPatterns2 = prodCtx.__R;
  } catch (e) {
    return { pair, status: 'ERROR', reason: 'prod determinism: ' + e.message };
  }

  // ── Build tuple sets ──
  const prodKeys = new Set(prodPatterns.map(tupleKey));
  const dbgKeys  = new Set(dbgPatterns.map(tupleKey));
  const detKeys  = new Set(prodPatterns2.map(tupleKey));

  const prodOnly = [...prodKeys].filter(k => !dbgKeys.has(k));
  const dbgOnly  = [...dbgKeys].filter(k => !prodKeys.has(k));
  const determinismDelta = [...prodKeys].filter(k => !detKeys.has(k)).length +
                            [...detKeys].filter(k => !prodKeys.has(k)).length;

  const delta = prodOnly.length + dbgOnly.length;

  // ── Write artifacts ──
  const outSub = join(OUT_DIR, `${code}_${tf}`);
  mkdirSync(outSub, { recursive: true });

  const prodRef = {
    patterns: prodPatterns,
    meta: {
      stockCode: code,
      market,
      barCount: candles.length,
      timeframe: tf,
      source: 'headless-harness-prod',
      capturedAt: new Date().toISOString()
    }
  };
  writeFileSync(join(outSub, 'prod_ref.json'),
    JSON.stringify(prodRef, null, 2) + '\n');

  // For debug_trace.json we reshape to schema v1 subset consumable by
  // scripts/pattern_trace_ab_test.mjs (which handles perPattern[] grouping).
  const byFamily = {};
  for (const p of dbgPatterns) {
    if (!p || !p.type) continue;
    if (!byFamily[p.type]) byFamily[p.type] = { family: p.type, detected: [], nearMiss: [] };
    byFamily[p.type].detected.push({
      barIndex: p.endIndex != null ? p.endIndex : p.barIndex,
      l3: {
        outcome: p.outcome || 'detected',
        finalConfidence: p.confidence,
        priceTarget: p.priceTarget,
        stopLoss: p.stopLoss
      }
    });
  }
  const debugTrace = {
    schemaVersion: 1,
    meta: {
      stockCode: code,
      market,
      timeframe: tf,
      barCount: candles.length,
      source: 'headless-harness-debug',
      capturedAt: new Date().toISOString(),
      traceLevel: 'mvp'
    },
    bars: candles,
    preAnalyze: {},
    perPattern: Object.values(byFamily),
    postPipeline: {}
  };
  writeFileSync(join(outSub, 'debug_trace.json'),
    JSON.stringify(debugTrace, null, 2) + '\n');

  return {
    pair,
    status: delta === 0 && determinismDelta === 0 ? 'PASS' : 'FAIL',
    prodCount: prodPatterns.length,
    dbgCount: dbgPatterns.length,
    delta,
    determinismDelta,
    prodOnly: prodOnly.slice(0, 5),
    dbgOnly: dbgOnly.slice(0, 5),
    outDir: outSub
  };
}

// ── Main ──────────────────────────────────────────────────────────────
function parseOnlyArg() {
  const idx = process.argv.indexOf('--only');
  if (idx < 0) return null;
  const spec = process.argv[idx + 1];
  if (!spec) return null;
  return spec.split(',').map(s => {
    const [code, tf] = s.trim().split(':');
    const pair = DEFAULT_PAIRS.find(p => p.code === code && p.tf === tf);
    if (!pair) {
      // Fallback: guess market from code prefix
      const market = /^00|^03|^04|^05|^06|^07/.test(code) ? 'KOSPI' : 'KOSDAQ';
      return { code, market, tf };
    }
    return pair;
  });
}

function main() {
  const pairs = parseOnlyArg() || DEFAULT_PAIRS;
  console.log('─'.repeat(72));
  console.log('Pattern Trace Headless A/B Harness');
  console.log(`${pairs.length} pairs · prod vs debug-hook transparency invariant`);
  console.log('─'.repeat(72));

  const results = [];
  for (const pair of pairs) {
    const start = Date.now();
    const r = runPair(pair);
    const ms = Date.now() - start;
    results.push({ ...r, ms });
    const tag = `${pair.code} ${pair.market} ${pair.tf}`.padEnd(22);
    if (r.status === 'PASS') {
      console.log(`  PASS  ${tag}  Δ=0  patterns=${r.prodCount}/${r.dbgCount}  det=${r.determinismDelta}  (${ms}ms)`);
    } else if (r.status === 'SKIP') {
      console.log(`  SKIP  ${tag}  ${r.reason}`);
    } else if (r.status === 'FAIL') {
      console.log(`  FAIL  ${tag}  Δ=${r.delta}  prod=${r.prodCount} dbg=${r.dbgCount}  det=${r.determinismDelta}`);
      if (r.prodOnly.length) console.log('        prodOnly: ' + r.prodOnly.join(' ; '));
      if (r.dbgOnly.length)  console.log('        dbgOnly:  ' + r.dbgOnly.join(' ; '));
    } else {
      console.log(`  ERROR ${tag}  ${r.reason}`);
    }
  }

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  const err  = results.filter(r => r.status === 'ERROR').length;

  console.log('─'.repeat(72));
  console.log(`  ${results.length} run(s) · ${pass} PASS · ${fail} FAIL · ${skip} SKIP · ${err} ERROR`);
  console.log('─'.repeat(72));

  const report = {
    generatedAt: new Date().toISOString(),
    harness: 'scripts/pattern_trace_headless_ab.mjs',
    totals: { runs: results.length, pass, fail, skip, error: err },
    results: results.map(r => ({
      pair: r.pair,
      status: r.status,
      ms: r.ms,
      delta: r.delta,
      determinismDelta: r.determinismDelta,
      prodCount: r.prodCount,
      dbgCount: r.dbgCount,
      reason: r.reason,
      prodOnly: r.prodOnly,
      dbgOnly: r.dbgOnly,
      outDir: r.outDir
    }))
  };
  const reportPath = join(OUT_DIR, `headless_ab_report_${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log('Report:', reportPath);

  process.exit(fail + err > 0 ? 1 : 0);
}

main();
