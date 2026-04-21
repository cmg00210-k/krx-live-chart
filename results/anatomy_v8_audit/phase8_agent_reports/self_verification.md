# Phase 8 Self-Verification — 7-Layer Report

**Date**: 2026-04-21 | **Commit basis**: Phase 7 `352965461`

---

## Layer 1 — Script Load Order: **PASS**

`index.html` L.742-762 defer chain (19 files + sign.js):
sign → colors → data → api → realtimeProvider → indicators → **aptModel (L.748)** → patterns → signalEngine → chart → patternRenderer → signalRenderer → **backtester (L.754)** → sidebar → patternPanel → **financials (L.757)** → drawingTools → appState → appWorker → appUI → app.

- **aptModel BEFORE backtester**: L.748 → L.754 OK.
- **financials vs backtester**: task premise ("backtester depends on financials") is **inaccurate** — grep confirms `backtester.js` contains zero references to `getFF3Loadings|getFinancialData|PAST_DATA`. FF3 loadings are consumed by `appWorker.js` (L.1777 `_applyFF3ConfidenceToPatterns`), not backtester. Current order (backtester L.754 → financials L.757) is irrelevant to their coupling. **No regression.**

## Layer 2 — Global Variable Conflicts: **PASS**

- `_currentStockMeta`: only `backtester.js` (instance field `this._currentStockMeta`, L.1666) + `analysisWorker.js` (L.432, L.514 `backtester._currentStockMeta = msg.stockMeta`) + `appWorker.js` L.1208 (comment only). No duplicate declarations.
- `_currentMarket`: (a) `PatternEngine._currentMarket` static class field (`patterns.js` L.358); (b) `backtester._currentMarket` instance field (L.81). Namespaced via class/instance — no shadow.
- `aptModel`: single global in `js/aptModel.js`, referenced only in `backtester.js` under `typeof aptModel !== 'undefined'` guards (L.1663). No Worker-context shadow.

## Layer 3 — Worker importScripts Compatibility: **PASS**

`analysisWorker.js` L.77-83 imports: `colors?v=14, indicators?v=28, patterns?v=50, signalEngine?v=47, backtester?v=48`. Matches `index.html` `?v=` values exactly. **`aptModel.js` is intentionally NOT imported** into Worker — backtester L.1663-1664 guards `typeof aptModel === 'undefined'` → `aptEnabled=false`, `rawApt=null` per staging entry, cohort z-score skipped (n<5 fallback), `aptPrediction=null` — graceful degradation confirmed. aptModel.js L.43-45 `_signGet` optional chain: uses `self._signGet` if present, falls back to plain `fetch('/api/apt')` otherwise; main-thread only (never reached from Worker).

## Layer 4 — Rendering Regression: **PASS**

Grep `_aptMeta|aptDiagnostic|aptModel` across `js/` returns **only** `backtester.js` + `aptModel.js`. Zero hits in `patternRenderer.js`, `signalRenderer.js`, `chart.js`, `sidebar.js`, `patternPanel.js`, `financials.js`, `appUI.js`. APT diagnostic fields reside exclusively in backtest result objects and are never rendered. Regression risk: **zero**.

## Layer 5 — Confidence Chain Integrity: **PASS**

`appWorker.js` L.1777 `_applyFF3ConfidenceToPatterns` intact; invoked at L.324, L.1976, L.2057 in all three analysis entry paths. Clamp `[0.90, 1.10]`, MCS-fallback aware, n<60 gate, `MICRO_FF3` dedup guard — unchanged. `_aptMeta` grep in appWorker.js returns **zero matches** — confirms Phase 7 Option C "orphan field" design: `result._aptMeta` is read-only diagnostic, never consumed by `_applyPhase8ConfidenceToPatterns` or sibling chain. **Zero-risk wiring verified.**

## Layer 6 — Cache Invalidation: **PASS**

`sw.js` L.8 `CACHE_NAME = 'cheesestock-v87'`. STATIC_ASSETS (L.12-41) contains `/js/aptModel.js` (L.22) — new file properly registered. All 19 JS + sign.js + analysisWorker + screenerWorker present. No orphan paths.

## Layer 7 — Version Sync ?v=N Triad: **PASS**

| File | index.html | analysisWorker importScripts | Match |
|------|-----------|------------------------------|-------|
| aptModel.js | v=3 | (not imported — main-only) | N/A OK |
| backtester.js | v=48 | v=48 | PASS |
| appWorker.js | v=20 | (not Worker-loaded) | N/A OK |
| colors.js | v=14 | v=14 | PASS |
| indicators.js | v=28 | v=28 | PASS |
| patterns.js | v=50 | v=50 | PASS |
| signalEngine.js | v=47 | v=47 | PASS |

All Worker-imported scripts synchronized.

---

## Summary

- **Total issues**: 0 critical, 0 high, 0 low
- **Safe to commit/deploy**: **YES**
- **Required actions**: none
- **Note on Layer 1 task premise**: "backtester depends on financials" assumption is incorrect per code inspection (backtester has no financials.js symbol references). FF3 dependency lives in appWorker, which is loaded L.760 — after both financials (L.757) and backtester (L.754). Chain correct.
