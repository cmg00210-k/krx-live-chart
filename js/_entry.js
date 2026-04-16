// V48 Phase 1 — Bundle entry manifest.
//
// This file is NOT loaded by the browser. It serves two purposes:
//   1. Human-readable documentation of the script load order.
//   2. Optional use by scripts/build.mjs if switching to esbuild bundle mode.
//
// The 19 files below are loaded by index.html as classic scripts (<script defer>),
// so top-level `var`/`const`/`let` declarations become script-scope globals that
// cross-file code relies on (KRX_COLORS, patternEngine, signalEngine, ...).
//
// scripts/build.mjs does a SIMPLE CONCATENATION of these files (no ES-module
// rewriting). Semantics match the current classic-script loader exactly.
// Top-level identifier names are preserved through terser (mangle.toplevel=false)
// so that the Web Workers (analysisWorker.js, screenerWorker.js) which load a
// subset of these files via importScripts() continue to find the same globals.
//
// Load order is critical — see .claude/rules/architecture.md.
// Keep in sync with index.html <script> tags and scripts/build.mjs LOAD_ORDER.

export const MAIN_LOAD_ORDER = [
  'colors.js',
  'data.js',
  'api.js',
  'realtimeProvider.js',
  'indicators.js',
  'patterns.js',
  'signalEngine.js',
  'chart.js',
  'patternRenderer.js',
  'signalRenderer.js',
  'backtester.js',
  'sidebar.js',
  'patternPanel.js',
  'financials.js',
  'drawingTools.js',
  'appState.js',
  'appWorker.js',
  'appUI.js',
  'app.js',
];

// analysisWorker.js importScripts dependencies (subset of MAIN_LOAD_ORDER,
// restricted to computation-only files with no DOM access).
export const WORKER_LOAD_ORDER = [
  'colors.js',
  'indicators.js',
  'patterns.js',
  'signalEngine.js',
  'backtester.js',
];
