# A3 Panel + A/B Test Summary

Agent: financial-systems-architect (A3)
Deliverable: `debug/tracePanel.js` + `scripts/pattern_trace_ab_test.mjs`
Date: 2026-04-21

## LOC

| File | Lines |
|------|-------|
| `debug/tracePanel.js` | 758 |
| `scripts/pattern_trace_ab_test.mjs` | 428 |
| Total | 1186 |

## Statistical Formula References

**Wilson 95% CI** (per-family win-rate):
`(p + z²/2n ± z√(p(1-p)/n + z²/4n²)) / (1 + z²/n)`, z=1.96.
Applied to EB-shrunk WR (0-1 range), not raw. Live-recomputed on N₀ slider input via `data-*` attributes on `.tp-wilson-cell` — no full panel rebuild needed.

**Empirical Bayes shrinkage**:
`shrunk_wr(N₀) = (N·raw + N₀·grand_mean) / (N + N₀)`.
Default N₀=35, grand_mean=45.0%. Slider range [5, 200].

**BH-FDR threshold**:
Cross-asset baseline `q/√2631 ≈ 9.62e-4` (q=0.05, 2631 tests).
Per pattern: raw p-value vs threshold → PASS/FAIL badge.

**Sample power (Cohen rule)**:
`n_min = 10 / p`. If detected N < n_min → weak; else strong.
H&S (p≈0.002) requires n_min≈5000 — single-stock power always weak; cross-asset pooling required.

## A/B Test: Pragmatic Path Chosen

**Strategy**: Offline ref-JSON comparison (Node 18 stdlib only — `fs`, `path`, `util`).

**Why Puppeteer/Playwright rejected**:

- Repo has no `package.json`, no build step, no `node_modules` — installing a browser binary violates the zero-dep contract.
- Worker isolation via `vm.runInContext` fails because production `analysisWorker.js` calls browser-only `importScripts()` — cannot be shimmed without a DOM.
- Offline comparison is deterministic, <200ms, CI-friendly, and exactly as rigorous for Δ=0 testing given identical candle inputs.

**Capture workflow** (two manual steps, once per stock/tf):

1. Production ref: DevTools console `copy(JSON.stringify(window._lastAnalysisResult,null,2))`, save to `results/pattern_trace_tool/ab_reports/prod_ref_<code>_<tf>.json`.
2. Debug trace: viewer Download button → `results/pattern_traces/<code>_<date>_<tf>.json`.

**Tuple comparison key**: `type|barIndex|outcome|confidence|priceTarget|stopLoss` (numerics rounded to 0 dp — KRW prices are integers).

## Known Limitations

1. **No `l3.pValue` in MVP trace** — Sample-power and BH-FDR cells show `—` until Session 2 captures `l3.pValue` from backtester. Cohen power rule requires p-value from the pattern's backtested return significance test.
2. **Anti-predictor audit** — Requires `l3.antiPredictor`, `l3.inverted`, `l3.finalConfidence`, and `l3.wr.shrunk` — all absent at `traceLevel=mvp`. Panel shows placeholder gracefully.
3. **Wilson CI on N<5** — Mathematically valid but statistically uninformative. No special guard; treat low-N results as directional only.
4. **A/B offline only** — Full Worker-level Δ=0 verification requires Session 2 harness (`debug/ab_harness.html`) driving both workers in-browser against live candles.

## Self-Verification

- `window.tracePanel` exported with `.load(trace)`, `.onFilterChange(cb)`, `.showError(msg)` — confirmed.
- AB script: exits 0 on all PASS, exits 1 on any Δ≠0 — confirmed via `process.exit(failCount > 0 ? 1 : 0)`.
- No `eval` on user input — `JSON.parse` only (stdlib, throws on malformed input).
- Zero production-file touch — writes only to `debug/`, `scripts/`, `results/pattern_trace_tool/ab_reports/`.
- Node syntax check: `node --input-type=module --check` passes.

## 45-Family List

| Group | Count | Members |
|-------|-------|---------|
| candle.single | 13 | doji, hammer, invertedHammer, hangingMan, shootingStar, dragonflyDoji, gravestoneDoji, longLeggedDoji, spinningTop, bullishMarubozu, bearishMarubozu, bullishBeltHold, bearishBeltHold |
| candle.double | 10 | bullishEngulfing, bearishEngulfing, bullishHarami, bearishHarami, bullishHaramiCross, bearishHaramiCross, piercingLine, darkCloud, tweezerBottom, tweezerTop |
| candle.triple | 9 | threeWhiteSoldiers, threeBlackCrows, morningStar, eveningStar, threeInsideUp, threeInsideDown, abandonedBabyBullish, abandonedBabyBearish, stickSandwich |
| candle.multi | 2 | risingThreeMethods, fallingThreeMethods |
| chart | 11 | doubleBottom, doubleTop, headAndShoulders, inverseHeadAndShoulders, ascendingTriangle, descendingTriangle, symmetricTriangle, risingWedge, fallingWedge, channel, cupAndHandle |
| **Total** | **45** | |
