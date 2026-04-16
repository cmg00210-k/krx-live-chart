// scripts/build.mjs — V48 Phase 1 production bundler.
//
// Pipeline:
//   1. Concatenate js/*.js in the order defined by js/_entry.js (MAIN + WORKER).
//      Concat preserves classic-script semantics (no ES-module wrapping) so
//      top-level globals (KRX_COLORS, patternEngine, ...) remain reachable.
//   2. Minify with terser (mangle.toplevel=false so Workers can still resolve names).
//   3. Obfuscate with javascript-obfuscator (selfDefending + stringArray + CFF).
//   4. Hash the output and emit deploy.bundled/js/app.<hash>.js +
//      worker-bundle.<hash>.js.
//   5. Rewrite deploy.bundled/index.html and deploy.bundled/sw.js so they
//      reference the hashed bundle, and analysisWorker.js so it importScripts
//      the worker bundle.
//   6. Also emit deploy.raw/ (unbundled mirror) for rollback safety.
//
// Usage:
//   node scripts/build.mjs                       # dev build (no minify/obfuscate)
//   node scripts/build.mjs --minify              # minify only
//   node scripts/build.mjs --minify --obfuscate  # production
//   node scripts/build.mjs --raw-only            # skip bundle, emit deploy.raw/ only

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const OUT_BUNDLED = path.join(ROOT, 'deploy.bundled');
const OUT_RAW = path.join(ROOT, 'deploy.raw');

const MAIN_LOAD_ORDER = [
  'colors.js', 'data.js', 'api.js', 'realtimeProvider.js', 'indicators.js',
  'patterns.js', 'signalEngine.js', 'chart.js', 'patternRenderer.js',
  'signalRenderer.js', 'backtester.js', 'sidebar.js', 'patternPanel.js',
  'financials.js', 'drawingTools.js', 'appState.js', 'appWorker.js',
  'appUI.js', 'app.js',
];

const WORKER_LOAD_ORDER = [
  'colors.js', 'indicators.js', 'patterns.js', 'signalEngine.js', 'backtester.js',
];

const argv = new Set(process.argv.slice(2));
const MINIFY = argv.has('--minify');
const OBFUSCATE = argv.has('--obfuscate');
const RAW_ONLY = argv.has('--raw-only');

// ---------------------------------------------------------------------------

async function rmrf(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFile(src, dst) {
  await ensureDir(path.dirname(dst));
  await fs.copyFile(src, dst);
}

function hashShort(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
}

// Strip `?v=NN` query strings from a source snippet (e.g. 'backtester.js?v=43').
// After bundling, those version query strings are meaningless and could leak
// the pre-bundle filenames.
function stripVersionQueries(src) {
  return src.replace(/(['"])([\w.\-/]+\.js)\?v=\d+\1/g, '$1$2$1');
}

async function concatFiles(fileList, label) {
  let out = `// ==== ${label} bundle ====\n`;
  for (const f of fileList) {
    const src = await fs.readFile(path.join(JS_DIR, f), 'utf8');
    out += `\n// ==== ${f} ====\n${src}\n`;
  }
  return stripVersionQueries(out);
}

async function maybeMinify(code) {
  if (!MINIFY) return code;
  const { minify } = await import('terser');
  const result = await minify(code, {
    // [V48-SEC] mangle.toplevel=false preserves KRX_COLORS / patternEngine / etc.
    // so Workers and inline scripts can resolve them. Local identifiers inside
    // functions/classes ARE mangled (default behavior).
    mangle: { toplevel: false, properties: false },
    compress: {
      drop_console: false,
      pure_funcs: ['console.debug'],
      passes: 2,
    },
    format: { comments: false },
    ecma: 2020,
  });
  if (result.error) throw result.error;
  return result.code;
}

async function maybeObfuscate(code) {
  if (!OBFUSCATE) return code;
  const mod = await import('javascript-obfuscator');
  const obf = mod.default || mod;
  return obf.obfuscate(code, {
    // [V48-SEC] controlFlowFlattening disabled — broke iterator/spread patterns
    // in chartManager render loop (observed: _0x... is not iterable at
    // requestAnimationFrame callsite). stringArray + selfDefending + minify are
    // the primary IP protection; CFF added marginal obscurity but high risk.
    controlFlowFlattening: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    // [V48-SEC] Do NOT enable debugProtection — blocks legitimate DevTools.
    selfDefending: true,
    disableConsoleOutput: false,
    // Preserve top-level names so Workers / inline scripts can resolve globals.
    reservedNames: [
      'KRX_COLORS', 'patternEngine', 'PatternEngine', 'signalEngine',
      'COMPOSITE_SIGNAL_DEFS', 'chartManager', 'patternRenderer',
      'signalRenderer', 'backtester', 'sidebarManager', 'drawingTools',
      'dataService', 'realtimeProvider', 'KRX_API_CONFIG', 'ALL_STOCKS',
      'DEFAULT_STOCKS', 'TIMEFRAMES', 'PAST_DATA', 'IndicatorCache',
      'PATTERN_ACADEMIC_META', 'calcMA', 'calcEMA', 'calcBB', 'calcRSI',
      'calcMACD', 'calcATR', 'calcIchimoku', 'calcKalman', 'calcHurst',
      'calcWLSRegression', 'getPastData', 'getFinancialData',
      'renderPatternPanel', 'updateFinancials', 'drawFinTrendChart',
      'showToast', 'selectStock', 'updateChartFull', 'init',
      // appState globals
      'currentStock', 'currentTimeframe', 'candles', 'vizToggles',
      'detectedPatterns', 'detectedSignals', 'signalStats',
      // appWorker globals
      '_initAnalysisWorker', '_loadMarketData',
    ],
  }).getObfuscatedCode();
}

async function buildBundle(fileList, label, outDir) {
  const raw = await concatFiles(fileList, label);
  let code = raw;
  code = await maybeMinify(code);
  code = await maybeObfuscate(code);
  const hash = hashShort(code);
  const basename = `${label}.${hash}.js`;
  const dst = path.join(outDir, 'js', basename);
  await ensureDir(path.dirname(dst));
  await fs.writeFile(dst, code, 'utf8');
  return { basename, hash, bytes: Buffer.byteLength(code, 'utf8') };
}

// ---------------------------------------------------------------------------
// deploy.bundled/ rewrite helpers

async function writeIndexHtml(outDir, mainBasename) {
  const src = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  // Replace the 19 <script defer src="js/*.js?v=N"></script> block with a
  // single <script defer src="js/<hash>.js"></script>.
  const scriptBlockRe = /(\s*<script defer src="js\/\w+\.js\?v=\d+"><\/script>\s*)+/g;
  const replacement = `\n  <script defer src="js/${mainBasename}"></script>\n`;
  const rewritten = src.replace(scriptBlockRe, replacement);
  await fs.writeFile(path.join(outDir, 'index.html'), rewritten, 'utf8');
}

async function writeServiceWorker(outDir, mainBasename, workerBasename) {
  const src = await fs.readFile(path.join(ROOT, 'sw.js'), 'utf8');
  // Bump CACHE_NAME with hash prefix so browsers pick up the new bundle.
  const cacheVersion = mainBasename.match(/\.([a-f0-9]{10})\.js$/)?.[1] || 'bundled';
  let rewritten = src.replace(
    /const CACHE_NAME\s*=\s*['"][^'"]+['"]\s*;?/,
    `const CACHE_NAME = 'cheesestock-v${cacheVersion}';`
  );
  // Rebuild STATIC_ASSETS array: drop any entry pointing at a raw js/*.js file
  // except the two Worker scripts (analysisWorker.js / screenerWorker.js stay —
  // analysisWorker.js's own importScripts call is rewritten to load the worker
  // bundle). Append the main + worker bundle paths.
  rewritten = rewritten.replace(
    /(const STATIC_ASSETS\s*=\s*\[)([\s\S]*?)(\];)/,
    (m, open, body, close) => {
      const linesIn = body.split(/\r?\n/);
      const kept = [];
      for (const line of linesIn) {
        const t = line.trim();
        if (t === '') { kept.push(line); continue; }
        // Match entries of the form 'js/foo.js' or '/js/foo.js' (with or
        // without leading slash, any quote style, optional trailing comma).
        const m2 = t.match(/^['"]\/?js\/([\w.\-]+\.js)['"]\s*,?\s*$/);
        if (m2) {
          const fname = m2[1];
          if (fname === 'analysisWorker.js' || fname === 'screenerWorker.js') {
            kept.push(line);
          }
          // else: drop (will be replaced by bundle paths)
          continue;
        }
        kept.push(line);
      }
      const bundlePaths = [
        `  '/js/${mainBasename}',`,
        `  '/js/${workerBasename}',`,
      ].join('\n');
      return open + kept.join('\n') + '\n' + bundlePaths + '\n' + close;
    }
  );
  await fs.writeFile(path.join(outDir, 'sw.js'), rewritten, 'utf8');
}

async function writeWorkerShim(outDir, workerBasename) {
  // analysisWorker.js currently imports 5 files via importScripts. Replace with
  // a single importScripts call pointing to the worker bundle.
  const src = await fs.readFile(path.join(JS_DIR, 'analysisWorker.js'), 'utf8');
  const rewritten = src.replace(
    /importScripts\([\s\S]*?\);/,
    `importScripts('${workerBasename}');`
  );
  await fs.writeFile(path.join(outDir, 'js', 'analysisWorker.js'), rewritten, 'utf8');
  // screenerWorker.js — leave as-is unless it also imports bundled files.
  const screener = path.join(JS_DIR, 'screenerWorker.js');
  if (fsSync.existsSync(screener)) {
    await copyFile(screener, path.join(outDir, 'js', 'screenerWorker.js'));
  }
}

async function mirrorStaticAssets(outDir) {
  // Copy index.html, sw.js (will be overwritten), CSS, favicon, lib/, css/.
  // Functions are handled by stage_deploy.py; this build only produces the
  // static bundled output. stage_deploy.py --bundled (future) merges them.
  const keep = ['favicon.svg', '_headers', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml'];
  for (const name of keep) {
    const src = path.join(ROOT, name);
    if (fsSync.existsSync(src)) await copyFile(src, path.join(outDir, name));
  }
  // css/
  const cssSrc = path.join(ROOT, 'css');
  if (fsSync.existsSync(cssSrc)) {
    for (const f of await fs.readdir(cssSrc)) {
      await copyFile(path.join(cssSrc, f), path.join(outDir, 'css', f));
    }
  }
  // lib/
  const libSrc = path.join(ROOT, 'lib');
  if (fsSync.existsSync(libSrc)) {
    for (const f of await fs.readdir(libSrc)) {
      await copyFile(path.join(libSrc, f), path.join(outDir, 'lib', f));
    }
  }
}

// ---------------------------------------------------------------------------
// deploy.raw/ — unchanged mirror of all 19 JS files + sw.js + index.html.
// Not intended for production; exists only as a rollback target.

async function buildDeployRaw() {
  await rmrf(OUT_RAW);
  await ensureDir(OUT_RAW);
  await ensureDir(path.join(OUT_RAW, 'js'));
  for (const f of MAIN_LOAD_ORDER.concat(['analysisWorker.js', 'screenerWorker.js'])) {
    const src = path.join(JS_DIR, f);
    if (fsSync.existsSync(src)) {
      await copyFile(src, path.join(OUT_RAW, 'js', f));
    }
  }
  await copyFile(path.join(ROOT, 'index.html'), path.join(OUT_RAW, 'index.html'));
  await copyFile(path.join(ROOT, 'sw.js'), path.join(OUT_RAW, 'sw.js'));
  await mirrorStaticAssets(OUT_RAW);
}

// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();

  if (RAW_ONLY) {
    console.log('[build] --raw-only: emitting deploy.raw/ mirror only');
    await buildDeployRaw();
    console.log(`[build] done in ${Date.now() - t0}ms`);
    return;
  }

  console.log(`[build] mode: minify=${MINIFY} obfuscate=${OBFUSCATE}`);

  // Produce deploy.bundled/
  await rmrf(OUT_BUNDLED);
  await ensureDir(OUT_BUNDLED);
  await ensureDir(path.join(OUT_BUNDLED, 'js'));

  const main = await buildBundle(MAIN_LOAD_ORDER, 'app', OUT_BUNDLED);
  console.log(`[build] main bundle: js/${main.basename} (${(main.bytes / 1024).toFixed(1)}KB)`);

  const worker = await buildBundle(WORKER_LOAD_ORDER, 'worker', OUT_BUNDLED);
  console.log(`[build] worker bundle: js/${worker.basename} (${(worker.bytes / 1024).toFixed(1)}KB)`);

  await writeIndexHtml(OUT_BUNDLED, main.basename);
  await writeServiceWorker(OUT_BUNDLED, main.basename, worker.basename);
  await writeWorkerShim(OUT_BUNDLED, worker.basename);
  await mirrorStaticAssets(OUT_BUNDLED);

  const manifest = {
    generated: new Date().toISOString(),
    minify: MINIFY,
    obfuscate: OBFUSCATE,
    main: { file: `js/${main.basename}`, hash: main.hash, bytes: main.bytes },
    worker: { file: `js/${worker.basename}`, hash: worker.hash, bytes: worker.bytes },
    loadOrder: { main: MAIN_LOAD_ORDER, worker: WORKER_LOAD_ORDER },
  };
  await fs.writeFile(
    path.join(OUT_BUNDLED, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  // Also produce deploy.raw/ for rollback.
  await buildDeployRaw();

  console.log(`[build] done in ${Date.now() - t0}ms`);
  console.log('[build] outputs: deploy.bundled/ + deploy.raw/');
}

main().catch(e => {
  console.error('[build] FAILED:', e);
  process.exit(1);
});
