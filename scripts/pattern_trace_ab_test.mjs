#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
//  pattern_trace_ab_test.mjs — A/B regression: production Worker vs debug
//  trace Worker outputs compared on identical candle inputs.
//
//  Node 18+, pure stdlib (no puppeteer, playwright, undici, ws package).
//  Strategy: OFFLINE ref-JSON comparison.
//    - "Production ref" JSON is captured manually by the user (see --help).
//    - "Debug trace" JSON is produced by pattern-trace-worker.js in-browser
//      and saved via the viewer's Download button.
//    - This script loads both, extracts comparison tuples, and asserts Δ=0.
//
//  Why NOT browser automation:
//    Puppeteer/Playwright require npm install and Chrome binary.  This repo
//    has no package.json, no build step, and is designed for zero-dep runs.
//    Worker isolation via Node vm.runInContext hits the same wall: the
//    production Worker calls importScripts() which is browser-only.
//    Offline ref-JSON comparison is deterministic, fast (<200ms), and
//    requires only fs + path from stdlib.  It is the correct trade-off for
//    this architecture.
//
//  ── Capturing a production ref (manual, once per stock/tf) ───────────────
//
//  Browser DevTools (cheesestock.co.kr tab, after stock analysis completes):
//
//    copy(JSON.stringify({
//      patterns: window._lastAnalysisResult.patterns,
//      meta: {
//        stockCode:   currentStock.code,
//        barCount:    candles.length,
//        timeframe:   currentTimeframe
//      }
//    }))
//
//  Then: paste clipboard → results/pattern_trace_tool/ab_reports/prod_ref_<code>_<tf>.json
//
//  Note: window._lastAnalysisResult is set by appWorker.js each time the
//  Worker posts a 'result' message back to the main thread. currentStock,
//  candles, and currentTimeframe are globals in appState.js.
//
//  Alternative (full payload — includes signals, stats):
//    copy(JSON.stringify(window._lastAnalysisResult, null, 2))
//
//  ── Capturing a debug trace JSON ─────────────────────────────────────────
//
//  1. Open http://localhost:5500/debug/pattern-trace.html
//  2. Drop or load the stock candles JSON (from data/kospi/<code>.json).
//  3. Click "Download trace" — file saved to local downloads.
//  4. Move to: results/pattern_traces/<code>_<YYYYMMDD>_<tf>.json
//
//  ── Usage ────────────────────────────────────────────────────────────────
//
//  # Single pair
//  node scripts/pattern_trace_ab_test.mjs \
//    --ref   results/pattern_trace_tool/ab_reports/prod_ref_005930_1d.json \
//    --trace results/pattern_traces/005930_20260421_1d.json
//
//  # Batch directory (sub-dirs: <code>_<tf>/{prod_ref.json,debug_trace.json})
//  node scripts/pattern_trace_ab_test.mjs \
//    --batch-dir results/pattern_trace_tool/ab_reports/
//
//  # List expected pairs (no files required yet)
//  node scripts/pattern_trace_ab_test.mjs --stocks 005930:1d,035720:1d
//
//  # Help
//  node scripts/pattern_trace_ab_test.mjs --help
//
//  ── Output ───────────────────────────────────────────────────────────────
//
//  Console: PASS/FAIL per pair, summary line.
//  File:    results/pattern_trace_tool/ab_reports/ab_report_<timestamp>.json
//  Exit 0 = all PASS, Exit 1 = any Δ≠0.
//
//  ── Batch directory layout (--batch-dir) ─────────────────────────────────
//
//  Each sub-directory represents one stock × timeframe pair:
//
//    <batch-dir>/
//      005930_daily/
//        prod_ref.json       ← production Worker output (captured via DevTools)
//        debug_trace.json    ← debug trace Worker output (downloaded from viewer)
//      005930_1m/
//        prod_ref.json
//        debug_trace.json
//      035720_daily/
//        ...
//
//  Sub-directory naming convention:
//    <code>_<tf>    where tf = daily | 1m | 5m | 15m | 30m | 1h
//
//  Wildcard KOSDAQ small-cap: any sub-dir whose name does not start with
//  digits 1-5 is accepted (e.g. 001000_daily, 000250_daily).
//
//  ── Tuple key and rounding (M4 fix) ──────────────────────────────────────
//
//  KRX price convention: prices >= 100 KRW are integers by market convention
//  (minimum tick 1 KRW at most price ranges). Sub-integer precision only
//  occurs for stocks trading below 100 KRW (rare, mostly low-priced KOSDAQ).
//
//  tupleKey() applies:
//    priceTarget, stopLoss: integer rounding (Math.round) when |price| >= 100
//                           2-decimal rounding when |price| < 100
//    confidence:            integer rounding always (patterns.js returns int)
//
//  This matches the project's "KRW >= 100 → integer" convention from patterns.js.
// ══════════════════════════════════════════════════════════════════════════

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// ── Constants ────────────────────────────────────────────────────────────
// Use fileURLToPath to handle Windows drive letters correctly (avoids double-slash
// path resolution bug when import.meta.url has /C:/ prefix on Windows Node).
const REPO_ROOT  = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'results', 'pattern_trace_tool', 'ab_reports');

// Supported CLI flags (strict: true rejects unknown flags with a clear error)
const SUPPORTED_FLAGS = ['ref', 'trace', 'batch-dir', 'help', 'stocks'];

// Default stock × timeframe pairs (mirrors P3 spec)
const DEFAULT_STOCKS = [
  { code: '005930', tf: 'daily', market: 'kospi'  },  // Samsung daily
  { code: '005930', tf: '1m',   market: 'kospi'  },  // Samsung 1-min
  { code: '035720', tf: 'daily', market: 'kospi'  },  // Kakao daily
  { code: '000660', tf: '15m',  market: 'kospi'  },  // SK Hynix 15m
  { code: '001000', tf: 'daily', market: 'kosdaq' },  // KOSDAQ small-cap daily
];

// ── CLI parsing ───────────────────────────────────────────────────────────
// strict: true — unknown flags throw immediately with a clear error message,
// preventing silent fall-through to "list expected pairs" mode on flag typos.
let args;
try {
  const parsed = parseArgs({
    options: {
      ref:          { type: 'string'  },
      trace:        { type: 'string'  },
      stocks:       { type: 'string'  },
      'batch-dir':  { type: 'string'  },
      help:         { type: 'boolean', short: 'h', default: false },
    },
    strict: true,   // L4 fix: was false — typos like --refs were silently ignored
    allowPositionals: false,
  });
  args = parsed.values;
} catch (parseErr) {
  console.error('[AB] CLI error:', parseErr.message);
  console.error('[AB] Supported flags: --' + SUPPORTED_FLAGS.join(', --'));
  console.error('[AB] Run with --help for full usage.');
  process.exit(1);
}

if (args.help) {
  console.log(`
pattern_trace_ab_test.mjs — offline A/B regression for Pattern Trace

Usage:
  # Single pair
  node scripts/pattern_trace_ab_test.mjs \\
    --ref   results/pattern_trace_tool/ab_reports/prod_ref_005930_1d.json \\
    --trace results/pattern_traces/005930_20260421_1d.json

  # Batch directory (sub-dirs with prod_ref.json + debug_trace.json)
  node scripts/pattern_trace_ab_test.mjs \\
    --batch-dir results/pattern_trace_tool/ab_reports/

  # Legacy: scan for paired prod_ref_* files at top level of batch-dir
  node scripts/pattern_trace_ab_test.mjs \\
    --batch-dir results/pattern_trace_tool/ab_reports/ --stocks 005930:1d,035720:1d

  # List expected pairs (no files required yet)
  node scripts/pattern_trace_ab_test.mjs --stocks 005930:1d,035720:1d

Supported flags: --${SUPPORTED_FLAGS.join(', --')}

Capturing a production ref JSON:
  1. Run: npx serve -l 5500 -s  (from repo root)
  2. Load http://localhost:5500, select stock, wait for analysis.
  3. DevTools console:
       copy(JSON.stringify({
         patterns: window._lastAnalysisResult.patterns,
         meta: { stockCode: currentStock.code, barCount: candles.length, timeframe: currentTimeframe }
       }))
  4. Save to: results/pattern_trace_tool/ab_reports/<code>_<tf>/prod_ref.json
     (sub-directory layout for --batch-dir mode)
     OR: results/pattern_trace_tool/ab_reports/prod_ref_<code>_<tf>.json
     (flat layout for legacy batch scan)

Capturing a debug trace JSON:
  1. Open http://localhost:5500/debug/pattern-trace.html
  2. Drop or load the stock candles JSON.
  3. Click "Download trace" — move to <code>_<tf>/debug_trace.json
`);
  process.exit(0);
}

// ── Ensure output directory ───────────────────────────────────────────────
fs.mkdirSync(REPORT_DIR, { recursive: true });

// ── Price rounding (M4 fix) ───────────────────────────────────────────────
/**
 * Round a KRW price value according to the project convention:
 *   |price| >= 100 → integer (minimum tick = 1 KRW at most price ranges)
 *   |price| <  100 → 2 decimal places (sub-100 KRW stocks, rare on KOSDAQ)
 *
 * This prevents false Δ on low-cap stocks while keeping the key compact for
 * normal (>= 100 KRW) stocks. Confidence is always integer — see tupleKey().
 */
function _priceRound(v) {
  if (v == null || !isFinite(v)) return v;
  // KRX convention: integer for prices >= 100 KRW; 2dp below 100
  return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
}

// ── Tuple extraction ──────────────────────────────────────────────────────
/**
 * Extract comparison tuples from a production Worker result object.
 * Shape: { patterns: [...], srLevels: [...], signals: [...], ... }
 * Tuple: { type, barIndex, outcome, confidence, priceTarget, stopLoss }
 */
function extractProdTuples(prodRef) {
  const tuples = [];
  if (!prodRef) return tuples;

  // prodRef may be the raw postMessage payload { patterns, signals, ... }
  // OR wrapped as { result: { patterns, ... } } — handle both
  const data = prodRef.patterns != null ? prodRef
              : prodRef.result   != null ? prodRef.result
              : prodRef;

  const patterns = data.patterns;
  if (!Array.isArray(patterns)) return tuples;

  patterns.forEach(function (p) {
    if (!p) return;
    tuples.push({
      type:        p.type        || p.pattern || null,
      barIndex:    p.barIndex    != null ? p.barIndex : null,
      outcome:     p.outcome     || 'detected',
      confidence:  p.confidence  != null ? Number(p.confidence)  : null,
      priceTarget: p.priceTarget != null ? Number(p.priceTarget) : null,
      stopLoss:    p.stopLoss    != null ? Number(p.stopLoss)    : null,
    });
  });
  return tuples;
}

/**
 * Extract comparison tuples from a debug trace JSON (schema v1).
 * Flattens perPattern[].detected[] into the same tuple shape.
 */
function extractTraceTuples(traceJson) {
  const tuples = [];
  if (!traceJson || !Array.isArray(traceJson.perPattern)) return tuples;

  traceJson.perPattern.forEach(function (pp) {
    if (!pp || !Array.isArray(pp.detected)) return;
    const parts  = (pp.family || '').split('.');
    const type   = parts[parts.length - 1] || pp.family;

    pp.detected.forEach(function (det) {
      if (!det) return;
      const l3 = det.l3 || {};
      tuples.push({
        type:        type,
        barIndex:    det.barIndex   != null ? det.barIndex : null,
        outcome:     l3.outcome     || 'detected',
        confidence:  l3.finalConfidence != null ? Number(l3.finalConfidence) : null,
        priceTarget: l3.priceTarget != null ? Number(l3.priceTarget) : null,
        stopLoss:    l3.stopLoss    != null ? Number(l3.stopLoss)    : null,
      });
    });
  });
  return tuples;
}

// ── Tuple comparison ──────────────────────────────────────────────────────
/**
 * Build a stable key for a tuple to allow set-based comparison.
 * Key: "type|barIndex|outcome|confidence|priceTarget|stopLoss"
 *
 * Rounding (M4 fix):
 *   confidence:  Math.round (patterns.js returns integer)
 *   priceTarget: _priceRound (integer >= 100 KRW; 2dp below 100)
 *   stopLoss:    _priceRound (same convention)
 */
function tupleKey(t) {
  const roundConf  = (v) => (v == null ? 'null' : Math.round(v));
  const roundPrice = (v) => (v == null ? 'null' : _priceRound(v));
  return [
    t.type      || 'null',
    t.barIndex  != null ? t.barIndex : 'null',
    t.outcome   || 'null',
    roundConf(t.confidence),
    roundPrice(t.priceTarget),
    roundPrice(t.stopLoss),
  ].join('|');
}

function compareTuples(prodTuples, debugTuples, label) {
  const prodMap  = new Map();
  const debugMap = new Map();

  prodTuples.forEach(function (t) {
    const k = tupleKey(t);
    prodMap.set(k, (prodMap.get(k) || 0) + 1);
  });
  debugTuples.forEach(function (t) {
    const k = tupleKey(t);
    debugMap.set(k, (debugMap.get(k) || 0) + 1);
  });

  const allKeys = new Set([...prodMap.keys(), ...debugMap.keys()]);
  const diffs   = [];

  allKeys.forEach(function (k) {
    const pc = prodMap.get(k)  || 0;
    const dc = debugMap.get(k) || 0;
    if (pc !== dc) {
      diffs.push({ key: k, prod: pc, debug: dc });
    }
  });

  const pass = diffs.length === 0;
  return {
    label,
    prodCount:  prodTuples.length,
    debugCount: debugTuples.length,
    pass,
    diffs,
  };
}

// ── Single pair run ───────────────────────────────────────────────────────
function runPair(refPath, tracePath) {
  const label = path.basename(refPath) + ' vs ' + path.basename(tracePath);

  if (!fs.existsSync(refPath)) {
    return { label, error: 'prod-ref not found: ' + refPath, pass: false };
  }
  if (!fs.existsSync(tracePath)) {
    return { label, error: 'debug-trace not found: ' + tracePath, pass: false };
  }

  let prodRef, traceJson;
  try { prodRef    = JSON.parse(fs.readFileSync(refPath,   'utf8')); }
  catch (e) { return { label, error: 'prod-ref parse error: ' + e.message, pass: false }; }
  try { traceJson  = JSON.parse(fs.readFileSync(tracePath, 'utf8')); }
  catch (e) { return { label, error: 'trace parse error: '    + e.message, pass: false }; }

  const prodTuples  = extractProdTuples(prodRef);
  const debugTuples = extractTraceTuples(traceJson);

  return compareTuples(prodTuples, debugTuples, label);
}

// ── Batch sub-directory scan ──────────────────────────────────────────────
/**
 * Scan batchDir for sub-directories following the convention:
 *   <code>_<tf>/prod_ref.json  +  <code>_<tf>/debug_trace.json
 *
 * Each sub-directory represents one stock × timeframe pair.
 * The 5-stock P3 spec pairs expected:
 *   005930_daily, 005930_1m, 035720_daily, 000660_15m, <any>_daily (KOSDAQ small-cap)
 *
 * Also accepts flat layout (legacy): prod_ref_<code>_<tf>.json at top level.
 */
function runBatchSubdirs(batchDir) {
  const results = [];

  if (!fs.existsSync(batchDir)) {
    console.error('[AB] batch-dir not found:', batchDir);
    return results;
  }

  const entries = fs.readdirSync(batchDir, { withFileTypes: true });
  const subdirs = entries.filter(function (e) { return e.isDirectory(); });

  if (subdirs.length === 0) {
    // Fall back to legacy flat scan
    return runBatchFlat(batchDir);
  }

  subdirs.forEach(function (subdir) {
    const pairDir  = path.join(batchDir, subdir.name);
    const refPath  = path.join(pairDir, 'prod_ref.json');
    const trcPath  = path.join(pairDir, 'debug_trace.json');
    const label    = subdir.name;

    if (!fs.existsSync(refPath)) {
      results.push({
        label,
        pass:  false,
        error: 'prod_ref.json not found in ' + pairDir +
               '. Capture via DevTools (see --help) and save as prod_ref.json.',
      });
      return;
    }
    if (!fs.existsSync(trcPath)) {
      results.push({
        label,
        pass:  false,
        error: 'debug_trace.json not found in ' + pairDir +
               '. Download from viewer and save as debug_trace.json.',
      });
      return;
    }
    results.push(runPair(refPath, trcPath));
  });

  return results;
}

/**
 * Legacy flat scan: prod_ref_<code>_<tf>.json at top level of batchDir.
 * Paired with trace_<code>_*_<tf>.json in batchDir or results/pattern_traces/.
 */
function runBatchFlat(batchDir) {
  const traceDir = path.join(REPO_ROOT, 'results', 'pattern_traces');
  const results  = [];

  const files = fs.readdirSync(batchDir);
  const refs  = files.filter(function (f) { return f.startsWith('prod_ref_'); });

  refs.forEach(function (refFile) {
    const refPath = path.join(batchDir, refFile);
    // prod_ref_005930_1d.json → code=005930, tf=1d
    const m = refFile.match(/^prod_ref_([^_]+)_([^.]+)\.json$/);
    if (!m) return;
    const code = m[1], tf = m[2];

    // Look for matching trace in batchDir or traceDir
    const candidates = [];
    [batchDir, traceDir].forEach(function (dir) {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(function (f) {
        // trace_<code>_*_<tf>.json  or  <code>_*_<tf>.json
        if ((f.startsWith(code + '_') || f.startsWith('trace_' + code + '_')) &&
            f.endsWith('_' + tf + '.json')) {
          candidates.push(path.join(dir, f));
        }
      });
    });

    if (candidates.length === 0) {
      results.push({
        label: refFile,
        pass:  false,
        error: 'No matching debug trace found for ' + code + ':' + tf +
               '. Run the viewer and download the trace first.',
      });
    } else {
      // Use the most-recently modified trace
      candidates.sort(function (a, b) {
        return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
      });
      results.push(runPair(refPath, candidates[0]));
    }
  });

  return results;
}

// Unified batch entry point — tries sub-dir layout first, falls back to flat
function runBatch(batchDir) {
  return runBatchSubdirs(batchDir);
}

// ── List mode (no files — show expected pairs) ────────────────────────────
function listExpected(stocksArg) {
  const pairs = parseStocksArg(stocksArg) || DEFAULT_STOCKS;
  console.log('\nExpected A/B pairs (no files found yet):\n');
  pairs.forEach(function (p) {
    const subDir   = path.join(REPORT_DIR, p.code + '_' + p.tf);
    const refPath  = path.join(subDir, 'prod_ref.json');
    const trcPath  = path.join(subDir, 'debug_trace.json');
    const refEx    = fs.existsSync(refPath) ? '[EXISTS]'  : '[MISSING]';
    const trcEx    = fs.existsSync(trcPath) ? '[EXISTS]'  : '(download from viewer)';
    console.log('  ' + p.code + ':' + p.tf + '  (' + p.market + ')');
    console.log('    prod-ref  ' + refEx  + '  ' + refPath);
    console.log('    trace     ' + trcEx  + '  ' + trcPath);
  });
  console.log('\nRun with --help for capture instructions.\n');
}

function parseStocksArg(stocksArg) {
  if (!stocksArg) return null;
  return stocksArg.split(',').map(function (s) {
    const parts = s.trim().split(':');
    return { code: parts[0], tf: parts[1] || '1d', market: 'kospi' };
  });
}

// ── Console summary line printer ──────────────────────────────────────────
/**
 * Print a per-stock summary line in the format specified by P3 spec:
 *   005930 daily   PASS Δ=0  patterns=23/23
 *   035720 daily   FAIL Δ=1  mismatch: bar=187 conf prod=73 debug=70
 */
function printSummaryLine(r) {
  // Derive stock/tf label from the result label
  const label = String(r.label).padEnd(32, ' ');

  if (r.error) {
    console.log('  FAIL  ' + label + '  ERROR: ' + r.error);
    return;
  }

  if (r.pass) {
    const count = r.prodCount != null ? r.prodCount : '?';
    console.log('  PASS  ' + label + '  Delta=0  patterns=' + count + '/' + count);
  } else {
    const delta = r.diffs ? r.diffs.length : '?';
    const counts = '(prod=' + r.prodCount + ' debug=' + r.debugCount + ')';
    console.log('  FAIL  ' + label + '  Delta=' + delta + '  ' + counts);
    if (r.diffs && r.diffs.length > 0) {
      // Show first mismatch parsed from key "type|barIndex|outcome|conf|target|stop"
      const firstDiff = r.diffs[0];
      const parts     = firstDiff.key.split('|');
      if (parts.length >= 6) {
        // Only show non-null fields for readability
        const details = [
          parts[1] !== 'null' ? 'bar=' + parts[1] : null,
          parts[3] !== 'null' ? 'conf prod=' + firstDiff.prod + ' debug=' + firstDiff.debug : null,
        ].filter(Boolean).join(' ');
        console.log('         mismatch: ' + details + '  key=' + firstDiff.key);
      }
    }
  }
}

// ── Report writer ─────────────────────────────────────────────────────────
function writeReport(results) {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(REPORT_DIR, 'ab_report_' + ts + '.json');

  const passCount = results.filter(function (r) { return r.pass; }).length;
  const summary = {
    generatedAt:  new Date().toISOString(),
    totalRuns:    results.length,
    passed:       passCount,
    failed:       results.length - passCount,
    results,
  };

  fs.writeFileSync(file, JSON.stringify(summary, null, 2), 'utf8');
  return file;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  let results = [];

  if (args.ref && args.trace) {
    // Single-pair mode
    const r = runPair(
      path.resolve(args.ref),
      path.resolve(args.trace)
    );
    results.push(r);

  } else if (args['batch-dir']) {
    // Batch directory mode
    results = runBatch(path.resolve(args['batch-dir']));

    if (results.length === 0) {
      console.log('[AB] No pairs found in batch-dir:', args['batch-dir']);
      console.log('[AB] Create sub-directories: <code>_<tf>/prod_ref.json + debug_trace.json');
      console.log('[AB] Run with --help for full layout convention.\n');
      process.exit(0);
    }

  } else {
    // List expected pairs and exit
    listExpected(args.stocks || null);

    // If batch dir already has prod_ref_* files (legacy flat), run them automatically
    if (fs.existsSync(REPORT_DIR)) {
      const autoRefs = fs.readdirSync(REPORT_DIR)
        .filter(function (f) { return f.startsWith('prod_ref_'); });
      if (autoRefs.length > 0) {
        console.log('[AB] Found ' + autoRefs.length + ' ref file(s) in ' + REPORT_DIR + ', running batch...\n');
        results = runBatchFlat(REPORT_DIR);
      } else {
        // Check for sub-directory pairs
        const entries = fs.readdirSync(REPORT_DIR, { withFileTypes: true });
        const subdirs = entries.filter(function (e) { return e.isDirectory(); });
        if (subdirs.length > 0) {
          console.log('[AB] Found ' + subdirs.length + ' sub-dir(s) in ' + REPORT_DIR + ', running batch...\n');
          results = runBatchSubdirs(REPORT_DIR);
        } else {
          console.log('[AB] No prod_ref_*.json files or sub-dirs found in:\n  ' + REPORT_DIR);
          console.log('[AB] Capture prod refs first (see --help), then re-run.\n');
          process.exit(0);
        }
      }
    } else {
      process.exit(0);
    }
  }

  // ── Print results ───────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(72));
  console.log('  Pattern Trace A/B Regression Report');
  console.log('─'.repeat(72));

  results.forEach(function (r) {
    printSummaryLine(r);
  });

  const passCount = results.filter(function (r) { return r.pass; }).length;
  const failCount = results.length - passCount;

  console.log('─'.repeat(72));
  console.log('  ' + results.length + ' run(s) · ' + passCount + ' PASS · ' + failCount + ' FAIL');
  console.log('─'.repeat(72) + '\n');

  if (results.length > 0) {
    const reportFile = writeReport(results);
    console.log('[AB] Report written to:\n  ' + reportFile + '\n');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(function (err) {
  console.error('[AB] Fatal:', err);
  process.exit(1);
});
