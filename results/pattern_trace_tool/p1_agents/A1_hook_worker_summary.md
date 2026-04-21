# A1 — Hook + Worker MVP Summary

**Files written** (in `c:\Users\seth1\krx-live-chart-remote\debug\`):

| File                      | LOC | Role                                       |
| ------------------------- | --: | ------------------------------------------ |
| `pattern-trace-hook.js`   | 419 | Monkeypatch + `runOnce()` + trace builder  |
| `pattern-trace-worker.js` |  87 | Worker entry + importScripts + dispatch    |

Both pass `node --check`.

## ?v=N pin resolution (grep `index.html`)

```text
743  js/colors.js?v=14
747  js/indicators.js?v=28
749  js/patterns.js?v=50
750  js/signalEngine.js?v=47
754  js/backtester.js?v=49
```

Hard-coded in worker under `self.__TRACE_VERSIONS__`. Cross-checked against `js/analysisWorker.js:77-83` — identical. Session 2 should add verify.py check-5g for `debug/*.js` pins.

## Singleton locations (spot-checked)

- `patternEngine = new PatternEngine()` at **patterns.js:4359**
- `signalEngine = new SignalEngine()` at **signalEngine.js:3190**
- `backtester = new PatternBacktester()` at **backtester.js:3119**

Hook targets *instances* (`patternEngine.analyze`), not prototypes.

## Ghost thresholds / Session 3 input

1. **`hurstWeight` / `volWeight` / `meanRevWeight` / `regimeWeight` / `dynamicATRCap`** are LOCAL vars inside `patternEngine.analyze()` (patterns.js L670-770), not instance fields. Captured as `{_unavailable: true, reason: 'local var in analyze()'}`. Session 3 options: (a) source-touch to persist via `this._lastRegime = {...}`, or (b) re-compute in hook.
2. **`PatternEngine._currentDynamicCaps` / `_currentVolRegime` / `_currentMarket` / `_currentTimeframe`** ARE reachable post-analyze as class statics. Hook surfaces them under `preAnalyze.regime.currentDynamicCaps` / `currentVolRegime`.
3. `TRIANGLE_BREAK_ATR_MULT` at patterns.js L222 is defined but unused by `detectSymmetricTriangle` (plan §215).
4. Spinning-top / doji inline trend gates (`if (bodyRatio < 0.3) continue;`) are not helper-wrapped — full-session observer cannot capture. Route via `aggregateRejected.unexplainedReject`.
5. `_srLevels` is a non-enumerable property on the returned patterns array. Hook extracts and rebuilds under `postPipeline.srLevels[]`.
6. Backtester WR: hook reads `PatternEngine.PATTERN_WIN_RATES` / `PATTERN_SAMPLE_SIZES` / `PATTERN_WIN_RATES_SHRUNK` (N0=35). `PatternBacktester._META` has only `{name, signal}` — no WR. `risingThreeMethods` / `fallingThreeMethods` missing from win-rate tables (43 of 45); `wrFor()` returns `null` for those.

## Self-verification

- [x] Syntax: `node --check` passes on both files.
- [x] Transparency: wrapped `analyze` returns `origAnalyze(...)` verbatim. A/B Δ=0 holds — only the hook's `session` closure mutates.
- [x] Zero writes to production-visible singleton state. Hook READS `PatternEngine._current*` and `patterns._srLevels`; never assigns.
- [x] All captures wrapped in `captureSafe()` → push to `trace.meta.captureErrors[]` on throw, never bubble.
- [x] Ring buffer: MAX=5000, shift-on-overflow, `ringBufferCapped` flag.
- [x] No DOM / no fetch in Worker scope.
- [x] Production files untouched: `git status --short -- debug/` shows only `?? debug/`. The three pre-existing `M js/*.js` entries belong to the audit branch, not this task.

## Schema v1 payload exposed to A2 (viewer)

`self.__PATTERN_TRACE__.runOnce(msg)` returns:

- `meta.{durationMs, ringBufferCapped, eventsEmitted, captureErrors, patternEngineVersion, signalEngineVersion}`
- `preAnalyze.regime` (partial — see gap 1)
- `perPattern[].detected[]` = `{barIndex, time, tracePreId, l2:[], l3:{outcome, baseConfidence, finalConfidence, stopLoss, priceTarget, wr}}`
- `perPattern[].nearMiss: []`, `aggregateRejected: null` (Session 2)
- `postPipeline.{srLevels, signals}`
- `replayTrace.events[]` sparse `{bar, type:'detect', family}`

Worker `ready` message includes `patternEngineVersion` / `signalEngineVersion` for viewer display.
