# A1 — Hook A-Mid Upgrade Summary (Session 2)

**Files written** (`c:\Users\seth1\krx-live-chart-remote\debug\`):

| File                      | LOC (before → after) | Change |
|---------------------------|----------------------|--------|
| `pattern-trace-hook.js`   | 419 → **744** (+325) | A-MVP extended with A-Mid features |
| `pattern-trace-worker.js` | 87 (unchanged)        | Already forwards `msg.traceLevel` |

Both pass `node --check`.

## New schema fields

Added under existing top-level objects (no new top-level keys — viewer forward-compatible):

- `meta.traceLevel` — now reflects `msg.traceLevel` dynamically (`'mvp' | 'mid' | 'full'`), previously hard-`'mvp'`.
- `meta.pValueDurationMs` — wall-clock ms spent in `backtester.backtestAll()` (0 if cached or not run).
- `meta.captureErrors[]` gains new `category` taxonomy: `'pvalue.unavailable'`, `'pvalue.slow'`, `'aggregate.invariant'`.
- `perPattern[].detected[].l3.pValue` — best-effort two-sided p-value from `horizons[5].tStat` via `backtester._approxPValue()`; `null` when unavailable.
- `perPattern[].detected[].l3.bhFdrThreshold` — fixed cross-asset baseline `9.62e-4` (q=0.05, n_tests=2631, per plan line 157).
- `perPattern[].detected[].l3.antiPredictor` — `true` when EB-shrunk WR < 48 (plan line 156); `null` if WR table missing the type.
- `perPattern[].detected[].l3.inverted` — honestly `null` (no detector currently sets `p.inverted`); `!!p.inverted` if ever added.
- `perPattern[].aggregateRejected` — `{considered, detected, nearMiss, unexplainedReject, source:'aggregate'}` for all 45 families, including zero-detection families (which now get their own `perPattern` entry with empty `detected[]`/`nearMiss[]`).

## pValue availability

- **43 / 45 candle+chart families** have reliable pValue when `backtester.backtestAll` succeeds: all patterns listed in `backtester._META` reach `horizons[5]` → t-stat → p-value via `_approxPValue(absT, n-1)`.
- **2 families always null**: `risingThreeMethods`, `fallingThreeMethods` — missing from `PATTERN_WIN_RATES` (43/45 coverage per A1 Session 1 summary) and likely also absent from backtester `_META`. Hook returns `null` for these without error.
- **Cached path (free)**: `backtester.getCached(stockCode, candleCount)` checked first; 0 ms if hit. Session logs `meta.pValueDurationMs=0`.
- **Cold path (~500 ms for 250 bars)**: `backtestAll` runs; budget warning emitted to `captureErrors` if >500 ms. Gated by `traceLevel='mid'` — A-MVP still runs in <5 ms.

## Perf validation

Stubbed 250-bar runs (cold, no backtester): **0.17–5.16 ms** across 5 trials (first run includes JIT warm-up). Budget of +20 ms over A-MVP is comfortably met. Real `backtester.backtestAll` adds ~500 ms but is surfaced separately in `meta.pValueDurationMs` so viewer can show it independently.

## Invariant guard

`considered >= detected + nearMiss + unexplainedReject` enforced in `computeAggregateRejections`. On violation: push `{category:'aggregate.invariant', family, considered, detected, nearMiss, unexplainedReject}` to `meta.captureErrors` and clamp `unexplainedReject` to 0 for downstream safety. Smoke-test confirms zero violations on synthetic data.

## M5 — Double-install guard

Wrapper functions now tag themselves `__isTraceWrapped = true`. Second `eval` of hook source logs `[pattern-trace] wrapper already installed...` and skips re-wrap. Tested via two sequential `eval(src)` calls: `patternEngine.analyze.__isTraceWrapped` stays stable `true`, no nested wrapping.

## Transparency audits (self-verified via Grep)

- `result.(push|splice|sort|reverse|shift|unshift)` in hook: **0 hits**.
- `result[i].X = ` or `patterns[i].Y = `: **0 hits**.
- `fetch(`, `WebSocket(`, `localStorage.`, `document.`: **0 hits** in hook.
- Only `session.events`, local `bars[]`/`replayEvents[]`/`groups[]`/`out[]`/`byFamily[]` arrays mutated.
- `result.signals` is READ only (line 272).

## Remaining gaps for Session 3 (full-observer)

1. **Near-miss capture stays 0** — plan's "helper-observer ~75–85% coverage" requires wrapping `_quality` / `_detectTrend` / `_atr` / `_stopLoss` / `_candleTarget` / `_applyConfluence` / `_applyRRGate`. Hook currently does not touch these; all rejection is aggregate-only.
2. **Ghost thresholds** (already documented in A-MVP summary): triangle break (`TRIANGLE_BREAK_ATR_MULT` unused in `detectSymmetricTriangle`), cupAndHandle breakout confirm, spinningTop/doji inline trend gates. Cannot be captured without source-touch.
3. **L2 micro-tests stay empty** — `[{step, input, threshold, pass}]` requires helper-observer stack unwind (`new Error().stack` caller-family correlation, plan line 86). Routed through Session 3 only.
4. **`confidencePath[]` stays empty** — stage-by-stage delta capture (quality +N / srConfluence +M / rrGate +0) needs helper wraps on confidence mutators.
5. **`LOOKBACK_BY_FAMILY` chart estimates are conservative** — `headAndShoulders: minLookback=80`, `cupAndHandle: minLookback=100`. Real pivot-scan windows may differ; `unexplainedReject` counts over-count for chart families compared to candle families. Session 3 helper-observer can replace with exact per-detector `considered`.
6. **`inverted` field always null** — no detector in `patterns.js` sets `p.inverted`. Plan line 156 suggests this be populated when pattern direction is logically reversed (e.g., bullishHarami after downtrend vs after uptrend). Needs source-side instrumentation or semantic derivation in Session 3.

## Blocker findings

None. All changes are pure additions; existing A-MVP behavior preserved when `traceLevel` is absent or `'mvp'`.

## Return path

- Summary: `c:\Users\seth1\krx-live-chart-remote\results\pattern_trace_tool\s2_agents\A1_hook_amid_summary.md`
- LOC: hook 419 → 744 (+325); worker unchanged 87.
- No git commit (per orchestrator policy).
