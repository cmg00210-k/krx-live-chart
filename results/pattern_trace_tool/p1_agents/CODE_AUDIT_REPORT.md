# Pattern Trace Tool — Code Audit (P2 cross-check)

Audited: 7 debug/ files + scripts/pattern_trace_ab_test.mjs  
Reference: js/analysisWorker.js (production template), index.html ?v=N, js/colors.js,
scripts/stage_deploy.py EXCLUDE_DIRS.

## Summary

- HIGH findings: 2
- MED findings: 5
- LOW findings: 4
- PASS categories: A/B transparency invariant, production isolation, importScripts order,
  ?v=N sync, Canvas layer ordering, schema v1 completeness, deploy-day protection

## HIGH (blockers)

### H1 — Playback rAF not cancelled on new trace load (memory leak + stale indexing)
- File: `debug/pattern-trace.js:76-110` (`_applyTrace`)
- Problem: `_applyTrace(trace)` does not call `_stopPlay()`. If the user is playing
  trace A and drops trace B, the running rAF continues to read `scrubber.value` and
  advance against `traceCanvas.getBarCount()` which now reflects trace B. Result:
  - Stale reads of `scrubber.value` that was overwritten to `barCount-1` at L108
  - Potential NaN propagation if B has 0 bars (L84: `Math.max(0, barCount - 1)`)
  - Similar gap in `showError` path: `tracePanel.showError(...)` returns without
    stopping playback that may be running from a prior successful load.
- Fix: Call `_stopPlay()` at the top of both `_applyTrace()` and inside
  `_readFile`'s onerror / onload-fail paths (L131, L136, L142).

### H2 — Unescaped user-controlled data in 4 innerHTML sinks (XSS via crafted trace JSON)
- Files/lines:
  - `debug/tracePanel.js:580` — `nm.barIndex` and `nm.gateFailed`, `nm.pctMiss`
    interpolated into `innerHTML` via string concat inside `_renderNearMiss`.
  - `debug/tracePanel.js:602-604` — `sr.touchCount`, `sr.strength` NOT escaped
    (escape only applied to `Number(sr.price)`); `Number(...)` is only called on
    `price` and `strength`, but `touchCount` goes in raw.
  - `debug/tracePanel.js:666-668` — `c.barIndex`, `c.conf` interpolated raw.
  - `debug/traceCanvas.js:764-767` — template literals inside `_onMouseMove`
    interpolate `n.gateFailed`, `n.measured`, `n.threshold`, `n.pctMiss` directly
    into `_tooltipEl.innerHTML` (L739).
- Problem: The viewer accepts arbitrary user-provided JSON via file-drop. A crafted
  file with `gateFailed: "<img src=x onerror=alert(1)>"` executes JS. Because this
  is a local debug tool on the author's machine, realistic impact is low — but
  the viewer will eventually be shared and paths like `window.__trace_load(obj)`
  from pasted console snippets amplify the risk.
- Fix: Wrap every non-numeric field with `_esc()` (already defined at L114), and
  coerce numerics with `Number(...)` before interpolation. For the canvas tooltip,
  either use `textContent` + structured DOM nodes, or run `_esc()` on every
  interpolated value.

## MED (should-fix before PR)

### M1 — Dead ternary in candle body fill
- File: `debug/traceCanvas.js:176`
- Evidence: `ctx.fillStyle = isUp ? color : color;`
- Fix: Collapse to `ctx.fillStyle = color;`. Purely code quality — no behavior impact.

### M2 — Confidence clamp indicator fires on every row (D7)
- File: `debug/traceCanvas.js:502-506`
- Problem: `const totalC = Math.min(100, finalC);` then
  `if (cap !== undefined && finalC >= totalC)` — the second condition is
  tautological (`finalC >= min(100, finalC)` is always true). Also
  `_state.trace.meta.dynamicATRCap` is the wrong path — the actual ATR cap is
  at `trace.preAnalyze.regime.dynamicATRCap` (see
  `pattern-trace-hook.js:319`). Result: red clamp bar painted on every pattern
  even when not capped; when meta path is undefined the `cap !== undefined`
  check silently skips.
- Fix: Capture `capThreshold` from `preAnalyze.regime.dynamicATRCap?.confidence` and
  test `finalC >= capThreshold` where capThreshold is a numeric ceiling.

### M3 — ResizeObserver never disconnected; no cleanup hook
- File: `debug/traceCanvas.js:781-789`
- Problem: `_resizeObserver` is created once at module init and never stored on a
  public API for teardown. If a future iteration calls `load()` in a way that
  swaps the parent element (e.g. SPA navigation inside pattern-trace.html), the
  old observer would continue firing. For the current single-page viewer this is
  not yet a leak, but there is also no `window.addEventListener('beforeunload', …)`
  cleanup or reload teardown.
- Fix: Expose `destroy()` on the traceCanvas API that calls
  `_resizeObserver.disconnect()` and removes mousemove/mouseleave listeners.
  Also guard against double-init in `_initResize()`.

### M4 — AB script: tuple key rounds price fields but schema normalization may differ
- File: `scripts/pattern_trace_ab_test.mjs:174-184`
- Problem: `tupleKey` rounds confidence/priceTarget/stopLoss to integer. Production
  engine returns `confidence` as integer in patterns.js but `priceTarget` is a
  float KRW price (may have sub-integer precision for low-cap stocks < 100 KRW).
  Rounding integer-prices works for Samsung but could mask a genuine Δ on low-price
  stocks.
- Fix: Either round to 2 decimals, or use `(v.toFixed(0))` for prices that are
  by project convention integer KRW (≥100). For KRW sub-integer (rare, < 100),
  tag the stock tier and widen rounding.

### M5 — Trace hook missing cleanup path if runOnce called twice
- File: `debug/pattern-trace-hook.js:124-150`
- Problem: `origPatternAnalyze = patternEngine.analyze.bind(patternEngine);` is
  captured at install time. The hook then reassigns `patternEngine.analyze` to
  the wrapper. If `pattern-trace-worker.js` were re-instantiated in the same
  process (it isn't today), the second install would double-wrap because
  `patternEngine.analyze` would already be the first wrapper. The guard at
  `typeof patternEngine === 'undefined'` doesn't catch this.
- Speculative: `[SPECULATIVE]` — in current design the Worker is a fresh
  context per viewer session, so this is latent risk only. Document the
  one-install invariant.

## LOW (nice-to-have)

### L1 — Hex literal color in D7 "conf" legend text
- File: `debug/traceCanvas.js:705` — `ctx.fillStyle = '#787b86';`
- And again: L504 `'#E05050'` (should be `KRX_COLORS.UP`), L491 `'#26C6DA'` (teal —
  no KRX_COLORS equivalent, keep), L497 `'#A08830'` (should be `KRX_COLORS.ACCENT`),
  L486 `'#2962ff'` (blue, no direct KRX_COLORS match — keep).
- Fix: Use `KRX_COLORS.UP` at L504, `KRX_COLORS.ACCENT` at L497.

### L2 — Hex literals sprinkled through tracePanel.js
- File: `debug/tracePanel.js:241`, `514-516`, `541`, `652-655`, `665-669`
- Problem: Confidence-tier colors `#26a69a`, `#A08830`, `#ff9800`, `#ff8a80` are
  hardcoded instead of being pulled from KRX_COLORS (or declared CSS variables in
  `traceStyles.css:16-21`). The CSS already exposes `--accent`, `--up`, `--down`,
  `--text-muted`; reusing them keeps a single source of truth.
- Fix: Route UI chrome colors through CSS classes + `traceStyles.css` variables.

### L3 — Korean comments inside JS identifiers/section banners
- `debug/tracePanel.js:486`, `502`, `574`, `599`, `648-655` — section titles like
  "패턴", "S/R 레벨", "집계 통계", etc. The project convention (CLAUDE.md) is
  Korean for user-facing strings, English for internal identifiers. These
  titles are user-facing strings so technically OK, but match production panel
  titles should use identical phrasing (e.g. production uses "패턴 감지" not
  "패턴"). Cosmetic only.
- `debug/pattern-trace.js:63-69` — error strings in Korean ("JSON이 객체가
  아닙니다", "필수 키 누락"). OK per convention.

### L4 — Node 18 parseArgs strict:false swallows unknown flags silently
- File: `scripts/pattern_trace_ab_test.mjs:69`
- Problem: `strict: false` means typos like `--refs` or `--traces` are
  silently ignored, causing the script to fall into "list expected pairs"
  mode with no warning. A user debugging a failing batch may not realize a
  flag was typoed.
- Fix: Either switch to `strict: true` (Node 18 parseArgs supports it), or
  post-validate that at least one of ref/trace/batch-dir/help/stocks was seen.

## Integration verdict

- A/B transparency invariant: **PASS**. Hook wraps `analyze()` but returns
  `origPatternAnalyze(candles, opts)` / `origSignalAnalyze(candles, candlePatterns)`
  unchanged (hook.js:135, 160). No `.push/.splice/.sort/.reverse/.shift/.unshift`
  on result arrays. No `p.X = ...` on pattern elements. Only `session.events`
  and local `bars[]`/`replayEvents[]`/`groups[]` arrays are mutated.
- Production isolation: **PASS**. Zero references to `localStorage`,
  `sessionStorage`, `_idb`, `indexedDB`, `fetch`, `XMLHttpRequest`,
  `WebSocket` across all 7 debug files. No reference to `krxPrefs` or
  production DOM IDs (`#sidebar`, `#rpanel`, `#pattern-panel`).
- importScripts order match: **PASS**.
  `pattern-trace-worker.js:31-38` orders
  `colors → indicators → patterns → signalEngine → backtester → pattern-trace-hook`.
  `js/analysisWorker.js:77-83` orders
  `colors → indicators → patterns → signalEngine → backtester`.
  Hook is correctly LAST, after all singletons exist.
- ?v=N sync: **PASS**. All 5 versions exact-match across three sources:
  - `index.html`: colors=14, indicators=28, patterns=50, signalEngine=47, backtester=49
  - `js/analysisWorker.js:78-82`: same
  - `debug/pattern-trace-worker.js:20-24` (self.__TRACE_VERSIONS__): same
- Canvas layer ordering: **PASS**. `_render()` at
  `traceCanvas.js:712-728` calls `_drawBackground → D1 → D2 → D3 → D4 → D5 → D6
  → D7Legend → D7 → D8` in strict documented order. Every `ctx.save()` is
  paired with `ctx.restore()`. Every `setLineDash([...])` has a matching
  `setLineDash([])` reset, and `globalAlpha` is reset to 1 at end of each
  layer.
- Schema v1 completeness: **PASS**. `pattern-trace-hook.js:368-402` produces
  `{ schemaVersion: 1, meta, bars, preAnalyze, perPattern, postPipeline }` —
  all 5 required top-level keys plus `replayTrace`. Viewer validation at
  `pattern-trace.js:24` matches REQUIRED_KEYS exactly.
- Deploy-day protection: **PASS**.
  - `scripts/stage_deploy.py:59` blacklists `"debug"` with comment
    `# [pattern-trace] local debug tools — never deploy to production`.
  - No production file (`index.html`, `js/*.js`, `sw.js`) references `debug/`
    paths (grep confirmed).
  - Service Worker STATIC_ASSETS does not include any debug file.

## Recommendation

**FIX-REQUIRED** — Resolve H1 (playback cancel) and H2 (XSS on 4 innerHTML
sinks) before PR merge. Both are small edits and do not affect the A-MVP
behavioral contract. The transparency/isolation/version/deploy protections are
solid; no architectural blockers.

Suggested order:
1. H1 — add `_stopPlay()` to `_applyTrace` and error paths (≤5 LOC).
2. H2 — wrap innerHTML interpolations with `_esc()` in tracePanel.js + canvas
   tooltip (≤15 LOC).
3. M1, M2 — trivial correctness cleanups (≤5 LOC).
4. M3-M5, L1-L4 — defer to Session 2 or PR review discussion.

After fixes, the 5-stock A/B Δ=0 regression (P2 gate in the HANDOFF plan)
should proceed unchanged; none of the recommended fixes touch the hook,
worker, or schema builder.
