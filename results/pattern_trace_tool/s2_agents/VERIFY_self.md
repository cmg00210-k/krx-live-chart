# Self-Verification — S2 (`feat/pattern-trace-tool-s2` @ `397a7969a`)

Scope: 7 files +1,263 LOC (debug/* + scripts/pattern_trace_ab_test.mjs). ZERO production file touch verified by git status review. All production globals are consumed read-only; `KRX_API_CONFIG` is mutated but only within the debug HTML page — it is not a frozen object in `js/api.js:83`, so mutation is sanctioned, and the debug viewer runs on its own URL (`/debug/pattern-trace.html`) so production sessions are never exposed.

## Layer-by-layer verdict

### L1 — Reference integrity (Main thread globals) — PASS
- `debug/pattern-trace.html:19-25` loads `colors.js → data.js → api.js → realtimeProvider.js` in dependency order BEFORE debug scripts at lines 77-79. No `type="module"` — all rely on global side-effects.
- `api.js` loads without `defer`, but `data.js` is a dependency it requires on first use (`getFinancialData` import path); since both are ordered-sync tags, they execute in document order before debug code runs.
- Every use of `dataService` / `realtimeProvider` / `KRX_API_CONFIG` / `TIMEFRAMES` is inside `_initLiveScan()` (pattern-trace.js:630) which is called only after the outer IIFE runs — all production globals are resolved by then. The `typeof` guards at lines 634-643 are defensive belt-and-braces.
- `KRX_COLORS` keys used in `traceCanvas.js`: `UP`, `DOWN`, `ACCENT`, `CHART_BG`, `CHART_TEXT`, `CHART_GRID_HORZ`, `TAG_BG`, `PTN_BUY_FILL`, `PTN_SELL_FILL`, `PTN_NEUTRAL_FILL` — all verified present in `js/colors.js` (lines 7, 42, 43, 48, 56, 58, 60, 39).
- Singletons confirmed: `realtimeProvider` (`js/realtimeProvider.js:423`), `patternEngine` (`js/patterns.js:4359`), `signalEngine` (`js/signalEngine.js:3190`).

### L2 — Worker isolation — PASS
- `debug/pattern-trace-worker.js:31-38` preserves canonical importScripts order colors→indicators→patterns→signalEngine→backtester→hook (hook LAST).
- Version pins in `self.__TRACE_VERSIONS__` exactly match `index.html:743-754` and `js/analysisWorker.js:77-83`: colors=14, indicators=28, patterns=50, signalEngine=47, backtester=49.
- Hook monkeypatches instance methods (`patternEngine.analyze`, `signalEngine.analyze`) via `.bind()` — NOT prototype. Production `PatternEngine.prototype.analyze` is never touched, so production Worker is not affected even if the same class definition were shared (which it is not, since importScripts creates a fresh Worker-scope copy).
- **M5 double-install guard**: `pattern-trace-hook.js:217-225` checks `.__isTraceWrapped` before re-wrapping and logs a warning without throwing. Wrapper tagging at lines 256 and 276. Correct.

### L3 — Rendering regression — PASS (1 LOW)
- `_render()` (traceCanvas.js:725-741) calls layers D1→D8 with `_drawD7Legend` interleaved (acceptable — legend is a thin annotation). 10/10 save/restore pairs confirmed. 15 `setLineDash` references — reviewed all reset to `[]` before next primitive.
- **M2 clamp**: traceCanvas.js:501-519 reads from `trace.preAnalyze.regime.dynamicATRCap`, guards `typeof capRaw === 'number'`, requires `confidencePath` non-empty and at least one `step.delta` within `TOL=0.01` of the cap. No NaN propagation — numeric guard is explicit.
- **M3 destroy() + init guard**: `_resizeObserver` reassignment guarded at line 802 (`if (_resizeObserver) return`). `destroy()` disconnects the observer, removes `mousemove`/`mouseleave` via named function references at lines 763/795. Correct lifecycle.
- **Tail-follow**: `setTailFollow()` (line 863) sets `_state.tailFollow`. `load()` (line 830) auto-advances scrubberBar when flag is true. `pattern-trace.js:547-548` updates `scrubber.value` + `setScrubberBar()` directly without dispatching an `input` event, so S2-H1 isTrusted guard is not needed in this path.
- **LOW** (L3.1): `traceCanvas.js:543` uses `det.barIndex` directly. Hook (`pattern-trace-hook.js:446-450`) falls back to null if no barIdx field is present. `_barToX(null)` yields NaN (not null), so the `if (x === null)` sentinel at line 544 fails to short-circuit, and `_state.bars[null]` is undefined. Drawing proceeds with NaN coordinates — browser silently no-ops but wastes work. Non-blocking; fix would be `x == null || !isFinite(x)`.

### L4 — Worker protocol — PASS
- Worker types: `trace` (in), `traceResult`/`ready`/`error` (out). Viewer (`pattern-trace.js:476-498`) handles all three and ignores unknown types implicitly.
- **requestId round-trip**: incremented at line 515 (`const reqId = ++_liveReqId`), sent at line 527, compared on receipt at line 482. Stale results logged and discarded. Correct.
- `traceLevel: 'mid'` sent at line 526 and consumed at `pattern-trace-hook.js:582-584` → `meta.traceLevel`. Correct.

### L5 — Cache invalidation / memory — PASS
- `realtimeProvider.onTick()` unsubscribe fn stored at pattern-trace.js:737 (`_liveTickUnsubscribe`), called on cleanup (:761) and defensively before re-register (:735). `realtimeProvider.js:45-50` confirms fn returns an unsubscribe closure. One subscription per session — correct.
- Worker: single `new Worker(...)` at pattern-trace.js:469, `terminate()` on cleanup at :778.
- 3-second throttle: `clearTimeout` at :506 before reassigning, and nulled-out at :508 / :511 / :773. No double-fire.
- rAF: `_stopPlay()` called at `_applyTrace()` entry (:159), 3× file-load error paths (:221, 227, 234), and cleanup (:757). No stray `requestAnimationFrame` without matching cancel.

### L6 — Load order / CSS — PASS
- `pattern-trace.html:14` loads `traceStyles.css` once, which self-defines `:root` vars (lines 8+) — no dependency on production CSS. Safe.
- Debug scripts at bottom of body without `defer` (:77-79) — sequential execution. Production `defer` scripts in `<head>` finished parsing by the time body scripts run (defer queues until after DOMContentLoaded-precursor).

### L7 — Side-effect audit — PASS
- `grep` for `localStorage`/`sessionStorage` in `debug/` — ZERO hits.
- `fetch(` — ZERO direct calls (production dataService mediates).
- `new WebSocket(` — ZERO direct calls.
- `new Worker(` — single hit at pattern-trace.js:469. Correct.
- No references to `#sidebar`/`#app-root`/production DOM IDs.
- No mutation of `_financialCache` / `_idb` / `window.krxPrefs`.
- Sole shared-global mutation: `KRX_API_CONFIG.mode` and `.wsUrl` at pattern-trace.js:654/655/661/662/707/712. `api.js:83` does not freeze the object, and the viewer is an isolated page. Acceptable.

## Findings

### HIGH — none

### MEDIUM — none

### LOW
1. **L3.1 — `_barToX(null)` NaN leak** (traceCanvas.js:94-98 + 543). Non-blocking; remediation suggestion: swap `x === null` for `x == null || !isFinite(x)` at call sites where `barIndex` may be null.
2. **Debug script `?v=N` omission** (pattern-trace.html:19-25). Production globals are loaded without cache-busting query params, so after a production bump users of the debug viewer may get stale JS until manual hard-reload. Cosmetic for a debug tool.

## Cross-file reference map

| Caller | Line | Callee | Symbol |
|---|---|---|---|
| pattern-trace.js | 469 | debug/pattern-trace-worker.js | Worker constructor |
| pattern-trace.js | 634 | js/api.js | `dataService` (typeof guard) |
| pattern-trace.js | 635 | js/api.js | `KRX_API_CONFIG` (typeof guard) |
| pattern-trace.js | 636 | js/realtimeProvider.js | `realtimeProvider` |
| pattern-trace.js | 654/661 | js/api.js | `KRX_API_CONFIG.wsUrl`/`.mode` (set) |
| pattern-trace.js | 669 | js/api.js | `dataService.getCandles()` |
| pattern-trace.js | 716 | js/realtimeProvider.js | `.onConnectionChange` (assign) |
| pattern-trace.js | 737 | js/realtimeProvider.js | `.onTick(fn)` |
| pattern-trace.js | 741 | js/realtimeProvider.js | `.start(stock, tf)` |
| pattern-trace.js | 767 | js/realtimeProvider.js | `.stop()` |
| traceCanvas.js | 79,80,82,157,201,516,590,666,671,684,693 | js/colors.js | `KRX_COLORS.*` (11 keys) |
| pattern-trace-hook.js | 229,262 | js/patterns.js | `patternEngine.analyze` (bind+wrap) |
| pattern-trace-hook.js | 244-249 | js/patterns.js | `PatternEngine._currentMarket/Timeframe/VolRegime/DynamicCaps` (read) |
| pattern-trace-hook.js | 287-288 | js/patterns.js | `PatternEngine.PATTERN_WIN_RATES`, `_SAMPLE_SIZES`, `_SHRUNK` |
| pattern-trace-hook.js | 262,269 | js/signalEngine.js | `signalEngine.analyze` (bind+wrap) |
| pattern-trace-hook.js | 362,400,411 | js/backtester.js | `backtester._approxPValue`, `.getCached`, `.backtestAll` |

## Global pollution audit

| Symbol | Set by | Severity |
|---|---|---|
| `window.__TRACE__` | pattern-trace.js:160 | LOW — explicit debug export, documented |
| `window.__trace_exportAnnotated` | :793 | LOW — Session 3 stub |
| `window.__trace_load` | :799 | LOW — convenience |
| `window.__trace_getLiveCandles` | :806 | LOW — convenience |
| `window.traceCanvas` | traceCanvas.js:21 | LOW — module pattern, intentional |
| `KRX_API_CONFIG.mode` / `.wsUrl` | pattern-trace.js:654,655,661,662,707,712 | LOW — viewer is isolated URL; api.js does not freeze; mutation sanctioned |
| `__TRACE_VERSIONS__` (Worker scope) | pattern-trace-worker.js:19 | NONE — Worker-scoped self |
| `__PATTERN_TRACE__` (Worker scope) | pattern-trace-hook.js:727 | NONE — Worker-scoped self |
| `patternEngine.analyze` / `signalEngine.analyze` | Worker-scope wrap | NONE — Worker-scoped; production Worker unaffected |

No main-thread production global is written by debug code. No DOM IDs collide with production. No Service Worker cache implications (no JS file added/removed from `STATIC_ASSETS`).

## Recommendation

**MERGE-OK**.

All seven protocol layers pass. Zero HIGH or MEDIUM findings. Two LOW findings are cosmetic (NaN no-op and missing `?v=` on debug's production script tags) and do not block. ZERO production file touch verified (`git status` confirms only `debug/`, `scripts/pattern_trace_ab_test.mjs`, and related `results/` additions are in the working tree). Worker isolation, singleton-method wrapping, requestId round-trip, beforeunload cleanup, and tail-follow auto-advance all behave correctly. Draft PR #9 is safe to move to ready-for-review.

## Relevant absolute paths
- `c:\Users\seth1\krx-live-chart-remote\debug\pattern-trace.html`
- `c:\Users\seth1\krx-live-chart-remote\debug\pattern-trace-worker.js`
- `c:\Users\seth1\krx-live-chart-remote\debug\pattern-trace-hook.js`
- `c:\Users\seth1\krx-live-chart-remote\debug\pattern-trace.js`
- `c:\Users\seth1\krx-live-chart-remote\debug\traceCanvas.js`
- `c:\Users\seth1\krx-live-chart-remote\debug\tracePanel.js`
- `c:\Users\seth1\krx-live-chart-remote\debug\traceStyles.css`
- `c:\Users\seth1\krx-live-chart-remote\scripts\pattern_trace_ab_test.mjs`
