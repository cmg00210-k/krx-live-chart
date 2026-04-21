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
//  Usage:
//    node scripts/pattern_trace_ab_test.mjs \
//      --ref    results/pattern_trace_tool/ab_reports/prod_ref_005930_1d.json \
//      --trace  results/pattern_traces/005930_20260421_1d.json \
//      [--stocks 005930:1d,035720:1d,...] \
//      [--batch-dir  results/pattern_trace_tool/ab_reports/]
//
//  Capturing a production ref (manual step — run once per stock/tf):
//    1. Open http://localhost:5500 (npx serve -l 5500 -s must be running).
//    2. Load stock 005930, timeframe 1d.
//    3. In DevTools console:
//         copy(JSON.stringify(window._lastAnalysisResult, null, 2))
//    4. Paste into results/pattern_trace_tool/ab_reports/prod_ref_005930_1d.json
//       (window._lastAnalysisResult is set by appWorker.js after each Worker result).
//    OR use the helper snippet injected by pattern-trace.js (Session 2).
//
//  Output: results/pattern_trace_tool/ab_reports/ab_report_<timestamp>.json
//          Console: PASS/FAIL per tuple, summary line.
//  Exit code: 0 = all PASS, 1 = any Δ≠0.
// ══════════════════════════════════════════════════════════════════════════

import fs   from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

// ── Constants ────────────────────────────────────────────────────────────
const REPO_ROOT  = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'results', 'pattern_trace_tool', 'ab_reports');

// Default stock × timeframe pairs
const DEFAULT_STOCKS = [
  { code: '005930', tf: '1d',  market: 'kospi'  },  // Samsung daily
  { code: '005930', tf: '1m',  market: 'kospi'  },  // Samsung 1-min
  { code: '035720', tf: '1d',  market: 'kospi'  },  // Kakao daily
  { code: '000660', tf: '15m', market: 'kospi'  },  // SK Hynix 15m
  { code: '001000', tf: '1d',  market: 'kosdaq' },  // KOSDAQ small-cap daily
];

// ── CLI parsing ───────────────────────────────────────────────────────────
const { values: args } = parseArgs({
  options: {
    ref:       { type: 'string'  },   // single prod-ref JSON path
    trace:     { type: 'string'  },   // single debug-trace JSON path
    stocks:    { type: 'string'  },   // override default pairs (comma-sep code:tf)
    'batch-dir': { type: 'string' },  // directory scanned for paired files
    help:      { type: 'boolean', short: 'h', default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`
pattern_trace_ab_test.mjs — offline A/B regression for Pattern Trace

Usage:
  # Single pair
  node scripts/pattern_trace_ab_test.mjs \\
    --ref   results/pattern_trace_tool/ab_reports/prod_ref_005930_1d.json \\
    --trace results/pattern_traces/005930_20260421_1d.json

  # Batch directory (auto-pairs prod_ref_* with trace_*)
  node scripts/pattern_trace_ab_test.mjs \\
    --batch-dir results/pattern_trace_tool/ab_reports/

  # List expected pairs (no files required yet)
  node scripts/pattern_trace_ab_test.mjs --stocks 005930:1d,035720:1d

Capturing a production ref JSON (manual):
  1. Run: npx serve -l 5500 -s  (from repo root)
  2. Load http://localhost:5500, select stock, wait for analysis.
  3. DevTools console: copy(JSON.stringify(window._lastAnalysisResult, null, 2))
  4. Save to: results/pattern_trace_tool/ab_reports/prod_ref_<code>_<tf>.json

Capturing a debug trace JSON:
  1. Open http://localhost:5500/debug/pattern-trace.html
  2. Drop or load the stock candles JSON.
  3. Click "Download trace" — saves to results/pattern_traces/<code>_<date>_<tf>.json
`);
  process.exit(0);
}

// ── Ensure output directory ───────────────────────────────────────────────
fs.mkdirSync(REPORT_DIR, { recursive: true });

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
      type:       p.type        || p.pattern || null,
      barIndex:   p.barIndex    != null ? p.barIndex : null,
      outcome:    p.outcome     || 'detected',
      confidence: p.confidence  != null ? Number(p.confidence)  : null,
      priceTarget:p.priceTarget != null ? Number(p.priceTarget) : null,
      stopLoss:   p.stopLoss    != null ? Number(p.stopLoss)    : null,
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
        type:       type,
        barIndex:   det.barIndex   != null ? det.barIndex : null,
        outcome:    l3.outcome     || 'detected',
        confidence: l3.finalConfidence != null ? Number(l3.finalConfidence) : null,
        priceTarget:l3.priceTarget != null ? Number(l3.priceTarget) : null,
        stopLoss:   l3.stopLoss    != null ? Number(l3.stopLoss)    : null,
      });
    });
  });
  return tuples;
}

// ── Tuple comparison ──────────────────────────────────────────────────────
/**
 * Build a stable key for a tuple to allow set-based comparison.
 * Key: "type|barIndex|outcome|confidence|priceTarget|stopLoss"
 * Numeric fields rounded to 0 dp (KRW prices are integers).
 */
function tupleKey(t) {
  const round = (v) => (v == null ? 'null' : Math.round(v));
  return [
    t.type      || 'null',
    t.barIndex  != null ? t.barIndex : 'null',
    t.outcome   || 'null',
    round(t.confidence),
    round(t.priceTarget),
    round(t.stopLoss),
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

// ── Batch directory scan ──────────────────────────────────────────────────
/**
 * Scan batchDir for pairs:
 *   prod_ref_<code>_<tf>.json  ↔  trace_<code>_<date>_<tf>.json
 * Also accepts traces in results/pattern_traces/.
 */
function runBatch(batchDir) {
  const traceDir = path.join(REPO_ROOT, 'results', 'pattern_traces');
  const results  = [];

  if (!fs.existsSync(batchDir)) {
    console.error('[AB] batch-dir not found:', batchDir);
    return results;
  }

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

// ── List mode (no files — show expected pairs) ────────────────────────────
function listExpected(stocksArg) {
  const pairs = parseStocksArg(stocksArg) || DEFAULT_STOCKS;
  console.log('\nExpected A/B pairs (no files found yet):\n');
  pairs.forEach(function (p) {
    const ref   = path.join(REPORT_DIR, 'prod_ref_' + p.code + '_' + p.tf + '.json');
    const trace = path.join(REPO_ROOT, 'results', 'pattern_traces',
                            p.code + '_<YYYYMMDD>_' + p.tf + '.json');
    const refEx    = fs.existsSync(ref)   ? '[EXISTS]' : '[MISSING]';
    const traceEx  = '(download from viewer)';
    console.log('  ' + p.code + ':' + p.tf);
    console.log('    prod-ref  ' + refEx + ' ' + ref);
    console.log('    trace     ' + traceEx + ' ' + trace);
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

  } else {
    // List expected pairs and exit
    listExpected(args.stocks || null);

    // If batch dir already has prod_ref_* files, run them automatically
    if (fs.existsSync(REPORT_DIR)) {
      const autoRefs = fs.readdirSync(REPORT_DIR)
        .filter(function (f) { return f.startsWith('prod_ref_'); });
      if (autoRefs.length > 0) {
        console.log('[AB] Found ' + autoRefs.length + ' ref file(s) in ' + REPORT_DIR + ', running batch...\n');
        results = runBatch(REPORT_DIR);
      } else {
        // No files to compare yet — inform and exit cleanly
        console.log('[AB] No prod_ref_*.json files found in:\n  ' + REPORT_DIR);
        console.log('[AB] Capture prod refs first (see --help), then re-run.\n');
        process.exit(0);
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
    const status = r.pass ? 'PASS' : 'FAIL';
    const icon   = r.pass ? '  ' : 'XX';

    if (r.error) {
      console.log(icon + ' [' + status + '] ' + r.label);
      console.log('         ERROR: ' + r.error);
    } else {
      const det = r.pass
        ? '(' + r.prodCount + ' tuples, Δ=0)'
        : '(prod=' + r.prodCount + ', debug=' + r.debugCount + ', diffs=' + r.diffs.length + ')';
      console.log(icon + ' [' + status + '] ' + r.label + '  ' + det);

      if (!r.pass && r.diffs) {
        r.diffs.slice(0, 5).forEach(function (d) {
          console.log('         DIFF key=' + d.key + '  prod=' + d.prod + '  debug=' + d.debug);
        });
        if (r.diffs.length > 5) {
          console.log('         ... and ' + (r.diffs.length - 5) + ' more diffs');
        }
      }
    }
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
