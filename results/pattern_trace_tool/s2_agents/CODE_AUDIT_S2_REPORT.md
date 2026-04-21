# Pattern Trace Tool — Session 2 Code Audit (P2 cross-check)

Audited: 7 debug/ files + scripts/pattern_trace_ab_test.mjs on branch
`feat/pattern-trace-tool-s2` (commit pending). Reference: S1 audit report at
`results/pattern_trace_tool/p1_agents/CODE_AUDIT_REPORT.md`, production
analysisWorker.js, index.html, realtimeProvider.js, stage_deploy.py.

## Summary

- Gates PASSED: 8/10 (+ 2 PARTIAL)
- HIGH findings: 2 (both inherited-from-S1 / new footgun; neither blocks A/B Δ=0)
- MED findings: 4
- LOW findings: 3

### HIGH (blockers)
- **S2-H1** — tracePanel.js:852 `scrubber.dispatchEvent(new Event('input'))` on
  pattern-card click disables tail-follow in live-scan mode (G9 footgun realized).
- **S2-H2** — tracePanel.js:669-675, 672 — `det.barIndex` / `conf` interpolated
  raw into `data-bar` attribute, style attribute, and HTML content inside
  pattern-detection cards. Partial resolution of S1 H2.

### MED (should-fix)
- **S2-M1** — hook.js double-install guard (M5 from S1) captures `origPatternAnalyze`
  BEFORE the guard check when re-entered, wasting a closure, but does skip wrap.
  Verify: install-time IIFE means a second `importScripts` re-invokes the IIFE,
  which re-reads `patternEngine.analyze` (now wrapped) and correctly detects
  `__isTraceWrapped`. Safe, but the `origPatternAnalyze = ...bind` at L229 only
  runs inside the `if (!alreadyWrappedPattern)` block — verified safe.
- **S2-M2** — pattern-trace.js `_onTick` is unregistered on beforeunload
  correctly, but **NOT re-guarded** against being called after `_cleanup` if
  the WS produces one final tick between `_liveTickUnsubscribe()` and
  `realtimeProvider.stop()`. Race window is ~1ms; harmless since `_liveWorker`
  is terminated next, but could log noise.
- **S2-M3** — hook.js `computeAggregateRejections` uses `LOOKBACK_BY_FAMILY`
  conservative estimates (e.g. channel=40, cupAndHandle=100) which over-count
  `unexplainedReject` for chart families. Acknowledged in A1 summary; documented
  as Session 3 work. Source='aggregate' tag makes this honest.
- **S2-M4** — pattern-trace.js L514-525 `candlesSnapshot = _liveCandles.slice()`
  is a shallow copy; candle objects are shared with the live array. If the
  Worker postMessage structured-clone happens before `_onTick` mutates
  `_liveCandles[last]`, we are safe. But L606 does `_liveCandles[last] = updatedBar`
  which replaces the slot (not mutates in-place) — the `.slice()` at postMessage
  time still references the old bar. Verified safe by slot replacement semantics.

### LOW
- **S2-L1** — tracePanel.js L318-322 summary innerHTML still uses string concat
  for `tp-det-count` / `tp-nm-count` content — numeric but unescaped. Same
  risk as S2-H2 attribute breakout if trace JSON contains crafted arrays with
  `length` made non-numeric (JSON.parse forbids this, so latent only).
- **S2-L2** — debug/traceStyles.css L17-18 `--up: #E05050; --down: #5086DC;`
  duplicate KRX_COLORS values. Acceptable (CSS cannot import JS constants) but
  inconsistent with KRX_COLORS reference source-of-truth.
- **S2-L3** — `runBatchSubdirs` legacy fallback via `runBatchFlat` could loop
  if user mistakenly places both sub-dirs AND `prod_ref_*` files at top level.
  Not a bug; behavior is defined (sub-dir wins), but not documented in help.

---

## Per-gate verdict

### G1 — A/B transparency invariant — **PASS**

Hook (pattern-trace-hook.js) wraps `patternEngine.analyze` and
`signalEngine.analyze` and returns the ORIGINAL result verbatim. Grep for
`result.(push|splice|sort|reverse|shift|unshift)` and `result[i].X =` returns
0 matches on hook. Local mutations only on `session.events`, local `bars[]`,
`replayEvents[]`, `groups[]`, `out[]`, `byFamily[]` arrays — none of these
are the caller's pattern-engine output.

`computeAggregateRejections` (L495-561) reads `perPatternList[i].family` and
`perPatternList[i].detected.length` only — no mutation of `patterns[]` or
the caller's arrays. It returns a NEW array `out = perPatternList.slice()`
with new pushes for zero-detection families; original group objects are
referenced but their `.aggregateRejected` is a new field set on the group
object. The group objects themselves are hook-owned (created at L443 in
`buildPerPattern`), not the production `patterns[]` return.

`backtester.backtestAll(candles)` call at hook.js:411 is correctly gated by
`session.traceLevel === 'mid' || 'full'` (L616). The returned `btResults`
object is used read-only in `extractPValueTable` (L356-382) — iterates with
`for (var pType in btResults)` and reads `r.horizons[5]`. No `.sort` or
mutation on the returned array.

### G2 — Production isolation — **PASS**

Grep across `debug/*.js` for `localStorage`, `sessionStorage`, `_idb`,
`indexedDB`, `XMLHttpRequest` returns 0 hits. Grep for `fetch(` returns 1
hit, on pattern-trace-hook.js:10 in a COMMENT (`// No DOM / no fetch.`).
`new WebSocket` has 0 hits — realtime is delegated to the production
`realtimeProvider` singleton via `.start()` / `.onTick()` / `.onConnectionChange`.

Main-thread references to production globals in pattern-trace.js are all
legitimate:
- L466 `new Worker('./pattern-trace-worker.js')` — single instantiation
- L631-633 `typeof dataService / KRX_API_CONFIG / realtimeProvider`
- L651, 658 `KRX_API_CONFIG.wsUrl = ...` (property assignment, not object reassignment)
- L652, 659, 704, 709 `KRX_API_CONFIG.mode = ...` (same)
- L666 `dataService.getCandles(stockObj, _timeframe)` (read call)
- L713 `realtimeProvider.onConnectionChange = function (state) {...}` (callback assignment)
- L734 `realtimeProvider.onTick(_onTick)` (subscribe)
- L738 `realtimeProvider.start(stockObj, _timeframe)`
- L764 `realtimeProvider.stop()`

**Caveat**: `KRX_API_CONFIG.mode` property ASSIGNMENT does modify shared
state. If the production app.js tab is open in the same browser session,
the debug viewer does not share memory (separate HTML page). But if a future
version loads pattern-trace.html inside an iframe or shares a window context,
this writes would bleed. Low risk because pattern-trace.html is a separate
document.

Grep for production DOM IDs (`#sidebar`, `#rpanel`, `#pattern-panel`,
`#chart[^-]`) in debug/*: 0 hits. All 15 `document.getElementById` calls
in pattern-trace.js reference debug-only IDs (`trace-dropzone`,
`trace-file-input`, `trace-scrubber`, `source-badge`, etc.).

### G3 — importScripts order match (Worker) — **PASS**

pattern-trace-worker.js L31-38:
```
importScripts(
  '../js/colors.js?v=14',
  '../js/indicators.js?v=28',
  '../js/patterns.js?v=50',
  '../js/signalEngine.js?v=47',
  '../js/backtester.js?v=49',
  './pattern-trace-hook.js'     // LAST
);
```

Hook is LAST, after all singletons exist — correct. Matches production
`js/analysisWorker.js:77-83` order (colors → indicators → patterns →
signalEngine → backtester).

No backing out of aptModel.js — correct, since aptModel is not part of the
Worker-side analysis pipeline (it's main-thread-only per `js/analysisWorker.js`
which also does not import it).

### G4 — ?v=N sync — **PASS**

Triple-match verified:

| Module       | index.html | analysisWorker.js | pattern-trace-worker.js |
|--------------|-----------|-------------------|-------------------------|
| colors       | 14        | 14                | 14                      |
| indicators   | 28        | 28                | 28                      |
| patterns     | 50        | 50                | 50                      |
| signalEngine | 47        | 47                | 47                      |
| backtester   | 49        | 49                | 49                      |

`self.__TRACE_VERSIONS__` object (lines 19-25) exposes these for hook to
stamp `meta.patternEngineVersion` and `meta.signalEngineVersion`. Correct.

### G5 — Canvas layer ordering — **PASS**

traceCanvas.js `_render()` at L725-741:

```
_drawBackground → D1(Candles) → D2(SRBands) → D3(NearMiss) →
D4(DetectedZones) → D5(ConfluenceLines) → D6(ReplayHighlight) →
D7Legend → D7(ConfidenceBars) → D8(Labels)
```

Order matches documented contract. `_drawBackground` clears and draws grid
before any overlay. Every `ctx.save()` paired with `ctx.restore()` (verified
L149-180 D1; L200-229 D2; L261-282 D3; L298-319 D4; L338-388 D5; L400-419 D6;
L457-527 D7; L578-610 D8). `setLineDash([...])` always reset to `setLineDash([])`
at end of block. `globalAlpha` reset to `1` at end of D2, D3, D4, D5, D7, D8
(grepped).

`_drawD7Legend` at L711-722 fires before `_drawD7ConfidenceBars` — legend
header column name "conf" is painted first, then bars overlay. No visual
collision because they occupy different y-bands.

### G6 — Schema v1 completeness — **PASS**

pattern-trace-hook.js:687-722 produces:
```
{
  schemaVersion: 1,
  meta: { ... traceLevel, durationMs, pValueDurationMs, ... },
  bars: [...],
  preAnalyze: { tracePreId, regime, indicatorCacheSummary },
  perPattern: [...],
  postPipeline: { srLevels, confluenceApplications, signals, signalTrace },
  replayTrace: { density, events }
}
```

All 5 required top-level keys present. A-Mid adds NEW sub-fields under existing
objects, no new top-level keys:
- `meta.traceLevel` (L698), `meta.pValueDurationMs` (L700)
- `perPattern[].aggregateRejected` (L540-546 via computeAggregateRejections)
- `perPattern[].detected[].l3.pValue / bhFdrThreshold / antiPredictor / inverted`
  (L476-478 in buildPerPattern)

Viewer `_validate` at pattern-trace.js:142-153 checks `schemaVersion === 1`,
required keys, and array shapes of `bars` and `perPattern`. Still matches.

### G7 — Deploy-day protection — **PASS**

`scripts/stage_deploy.py:59` contains:
```
"debug",  # [pattern-trace] local debug tools — never deploy to production
```

inside `EXCLUDE_DIRS` set. Confirmed. No grep match for `debug/` path
references in `index.html`, `js/*.js`, `sw.js`. Service Worker STATIC_ASSETS
does not reference debug files.

### G8 — Live-scan isolation — **PARTIAL**

Worker instantiation: `new Worker('./pattern-trace-worker.js')` appears
exactly once at pattern-trace.js:466, inside `_initLiveWorker` which is
called once from `_initLiveScan` (L694). Re-entry guarded by `if (_liveWorker)`
at L460.

`realtimeProvider.onTick(_onTick)` registered exactly once at L734. Defensive
unsubscribe at L731-733 if `_liveTickUnsubscribe` is already set (currently
cannot happen because `_initLiveScan` is called once, but defense-in-depth OK).

beforeunload cleanup at L752-783 correctly:
- `_liveTickUnsubscribe()` called at L758
- `realtimeProvider.stop()` at L764
- `clearTimeout(_liveAnalyzeTimer)` at L769
- `_liveWorker.terminate()` at L775
- `traceCanvas.destroy()` at L781

3-second throttle at L529 `setTimeout(..., 3000)`. Prior scheduled analysis
cancelled via `clearTimeout(_liveAnalyzeTimer)` at L502-505. Correct.

**PARTIAL reason**: there is a latent race — `_onTick` at L564 can fire
between the `_liveTickUnsubscribe()` call and `realtimeProvider.stop()`
if the WS is mid-message dispatch. The handler accesses `_liveWorker`,
`_liveCandles`, etc. — if `_cleanup` has already terminated `_liveWorker`,
a subsequent `_scheduleLiveAnalysis` call at L621 will no-op (L500 guards
`if (!_liveWorker) return`). So the race is harmless; flagging as PARTIAL
for awareness.

### G9 — Tail-follow semantics — **PARTIAL** (HIGH finding)

Correct defaults and state transitions:
- `_tailFollow` default `true` when `_source !== 'file'` (L61)
- User scrubber input at L294-304 sets `_tailFollow = false`
- Follow button click at L423-433 toggles back to `true`
- `traceCanvas.load(trace)` at L830-833 checks `_state.tailFollow` and
  auto-sets `scrubberBar = bars.length - 1` + adjusts `viewOffset`. Correct.

**Footgun realized at tracePanel.js:852**:

```javascript
scrubber.value = barIdx;
scrubber.dispatchEvent(new Event('input'));
```

This fires the scrubber `input` event handler at pattern-trace.js:294-304,
which checks `if (_isLive && _tailFollow)` and sets `_tailFollow = false`
+ removes pulse + updates follow button + sets banner to "[paused] scrubber
interaction".

**Impact**: In live-scan mode, clicking ANY pattern card in the left panel
silently disables tail-follow. User perceives this as "I clicked to jump to
that pattern, and now my live-update stopped". The intent of the handler
was to detect USER interaction with the scrubber slider; it cannot distinguish
programmatic dispatch from user input.

This is the exact footgun called out in G9 audit instructions.

**Fix suggestions** (not applied):
1. Use a guard flag: `_suppressTailDisable = true; scrubber.dispatchEvent(...);
   _suppressTailDisable = false;` and check in `_onScrubberInput`.
2. OR: have tracePanel call a new `traceCanvas.setScrubberBar(idx)` +
   manually update the scrubber `value` attribute without dispatching input.
3. OR: in `_onScrubberInput`, check `event.isTrusted` — programmatic events
   have `isTrusted=false`, real user input has `isTrusted=true`.

Recommendation: use `event.isTrusted` check. Minimal edit, semantically correct.

### G10 — M1-M5 actual fixes — **PASS**

- **M1 (traceCanvas.js:176)**: `ctx.fillStyle = color;` — dead ternary
  collapsed. Verified.
- **M2 (traceCanvas.js:501-519)**: Clamp indicator now reads
  `trace.preAnalyze.regime.dynamicATRCap` (L508). Guards `typeof capRaw ===
  'number'` (L509) — skips object `{ _unavailable: true }`. Requires
  `confidencePath` to exist AND at least one stage `|delta|` matching cap
  (tolerance 0.01). Uses `KRX_COLORS.UP` (L516) instead of hardcoded
  `#E05050`. Verified.
  **Note**: at A-Mid, `confidencePath: []` (empty), so clamp never fires
  in A-Mid. This is correct behavior (nothing clamped to show).
- **M3 (traceCanvas.js:800-809, 872-882)**: `_initResize` guards
  `if (_resizeObserver) return`. `destroy()` exposed in return object at
  L895. Disconnects observer, removes `resize` listener on fallback path,
  removes `mousemove` and `mouseleave` listeners. Named function refs
  (`_onMouseMove`, `_onMouseLeave`) at L763, L795 — stable identity for
  removeEventListener. Verified.
- **M4 (pattern_trace_ab_test.mjs:211-215)**:
  `_priceRound(v)` implemented: `|v| >= 100 → Math.round(v)`, else 2dp.
  Applied to `priceTarget` AND `stopLoss` via `roundPrice` lambda at
  L291-298. Confidence stays integer (L290 `roundConf`). Verified.
- **M5 (pattern-trace-hook.js:217-225, 256, 276)**:
  `alreadyWrappedPattern` / `alreadyWrappedSignal` checked via
  `.__isTraceWrapped` tag. Console.warn + skip wrap. Wrapper functions
  tag themselves at L256 and L276. Verified.

---

## Fixed vs remaining from S1 audit

- **H1 (playback cancel on new trace load)** — **FIXED**. pattern-trace.js
  calls `_stopPlay()` at L159 (top of `_applyTrace`), L221 (JSON parse fail),
  L227 (schema fail), L234 (FileReader onerror). All four paths covered.
- **H2 (innerHTML XSS via 4 sinks)** — **PARTIAL**. Three of four sinks fixed:
  - tracePanel.js:707-712 near-miss: `barIdxNum = Number(...)`, `_esc(gateFailed)`. **FIXED**.
  - tracePanel.js:730-732 S/R: `tcNum = Number(touchCount)`, `Number(strength).toFixed(2)`. **FIXED**.
  - traceCanvas.js:776-788 tooltip: `esc()` + `fnum()` applied to every field. **FIXED**.
  - tracePanel.js:669-675 pattern cards: `det.barIndex` raw in `data-bar` attr AND HTML content; `conf` raw in style + content. **NOT FIXED** → see S2-H2.
- **M1 (dead ternary)** — **FIXED**. See G10.
- **M2 (clamp indicator)** — **FIXED**. See G10.
- **M3 (ResizeObserver cleanup)** — **FIXED**. See G10.
- **M4 (sub-KRW price rounding)** — **FIXED**. See G10.
- **M5 (double-install guard)** — **FIXED**. See G10.

---

## Regression risk

Low-to-zero risk of A/B Δ≠0 regression. The hook's A-Mid additions
(`computeAggregateRejections`, `buildPValueTable`, `isAntiPredictor`,
`extractPValueTable`) execute AFTER `patternEngine.analyze` and
`signalEngine.analyze` return, reading their results read-only. The
`backtester.backtestAll()` call IS a side effect, but: (a) it runs on a
per-Worker singleton; (b) production backtester.js already handles repeat
invocations via internal `_cache`; (c) the Worker is a separate scope from
production, so any mutation of `backtester._currentStockCode` affects only
the debug Worker. A/B Δ=0 regression should remain clean.

New `realtimeProvider` touchpoints in main-thread pattern-trace.js write to
`KRX_API_CONFIG.wsUrl` / `.mode` — these mutate the production config
singleton loaded into pattern-trace.html. Because pattern-trace.html is a
separate HTML document from index.html, there is no cross-page leakage.
Risk materializes only if both pages are loaded in the same tab (impossible
under current architecture).

The scrubber dispatchEvent footgun (S2-H1) is a UX regression in live-scan
mode only — does not affect file-replay correctness or A/B Δ=0.

S2-H2 (cards XSS) materializes only when a user loads a malicious trace
JSON via file-drop. Local-machine debug tool; realistic impact is low but
not zero (shared trace files, pasted console snippets).

---

## Recommendation

**FIX-RECOMMENDED**

Both S2-H1 (tail-follow footgun) and S2-H2 (card innerHTML XSS) are
small surgical edits that do not touch the hook, schema, or A/B test
script. Neither blocks the P3 5-stock Δ=0 regression or G7 deploy-day
protection. Fix before merging to `main` (via the S2 feature branch PR).

Suggested order:
1. **S2-H1** — in pattern-trace.js `_onScrubberInput` at L294, wrap the
   tail-follow disable block with `if (e.isTrusted) { ... }`. The `input`
   event default arg `e` is already available; add it to the handler
   signature: `function _onScrubberInput(e) { if (!e || !e.isTrusted)
   return _onScrubberChange(); ... }`. ~3 LOC.
2. **S2-H2** — in tracePanel.js L669-675, coerce `det.barIndex` with
   `Number(...)` and `conf` with `Number(...)` (or `_esc()` for
   non-numeric). Apply to L672 `conf + '%'` content and L669 `data-bar`
   attribute. ~4 LOC.

After fixes, re-run the 5-stock A/B Δ=0 regression. None of the changes
touch the hook, schema builder, or AB test script; Δ=0 should remain.

MED findings (S2-M1 to S2-M4) are defense-in-depth / documentation items
that can defer to PR review discussion. LOW findings are cosmetic.
