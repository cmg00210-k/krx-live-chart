# Phase C — Code Audit (Phase 7 P7-001 APT 5-factor)

## 1. Executive Summary

Commit `352965461` on branch `audit/anatomy-v8-fix`. 4 files, ~6.1k LOC reviewed.
Counts: **CRIT 0 / HIGH 2 / MED 4 / LOW 3**. Core 2-pass pipeline, IC 6-Layer
MVP, and 5/5 gate math are sound and match agent-2 pseudocode exactly. Two
production-blocking issues: (1) `beta60d` always null because `marketReturns60d`
is never supplied by `_getStockMetaForApt`, (2) `_analyzeCache` is keyed only on
`candles` identity and NOT on `_currentStockMeta` — stale APT factors leak across
stock switches sharing identical candle array identity.

## 2. Findings by File

### backtester.js
- **HIGH — L.1630-1635 `_analyzeCache` meta-leak**: cache key is only
  `this._analyzeCache._candles !== candles`. `_currentStockMeta`/`_currentMarket`
  mutations from `onmessage` do NOT invalidate. If two consecutive jobs share the
  same candles reference (e.g. worker reuse after mutation) the raw APT factors
  computed in Pass 1 for stock A will be served to stock B.
- **MED — L.1660 Worker-side aptEnabled**: `typeof aptModel !== 'undefined'`
  present (good), but `analysisWorker.js` importScripts does NOT load
  `aptModel.js`. Comment correctly notes Worker = all null factors, but the
  cohort then runs zscoreCohort → 0 contribution, yielding 18-col × [0…0] APT
  suffix. That is silent capability loss: the MVP gate evaluates an APT signal
  that was never actually computed in Worker mode. Worker path should either
  load `aptModel.js` or explicitly skip `_computeAPTDiagnostic`.
- **LOW — L.932 stdIC variance**: uses `nDates−1` (correct) but the earlier
  `meanIC` when `nDates<10` falls back to pooled `icAptPool`, and L3 is then
  skipped — OK, documented. Minor: `stdICPerDate` is emitted as 0 rather than
  null in the pooled branch.
- **LOW — L.799 Fisher r=±1 clamp** (`r=1-1e-6`): acceptable, returns ~±0.999
  CI; matches common practice.

### aptModel.js
- **MED — L.157-178 `beta60d` unreachable in production**: requires
  `meta.marketReturns60d` as 60-element finite number array. `_getStockMetaForApt`
  (appWorker.js L.1215-1237) only returns `{marketCap, pbr, market}`. Consequence:
  `beta60d` is ALWAYS null ⇒ L9 `fullFactorRatio` capped at 4/5=0.8 nominal,
  but more importantly `nFull` branch loses 1 factor ∴ the "5/5 complete" count
  in null-contamination split is effectively dead. Either wire KOSPI/KOSDAQ
  60d returns into stockMeta or document beta as Phase 8.
- **MED — L.241 `vals.length<3` fallback silently produces `params[f]=null`** →
  all occurrences for that factor receive z=0. Acceptable but not logged;
  diagnostics should record `droppedFactors`.
- **LOW — L.243 median uses upper-mid for even n**: `vals[Math.floor(n/2)]`.
  Training pipeline (scripts/mra_apt_extended.py L.382-393) uses NumPy
  `np.median` which averages mid pair. Small bias for even-sized cohorts.

### appWorker.js
- **HIGH — L.1235 stockMeta sentinel collision**: `if (mcap == null && pbr == null) return null;`
  — null stockMeta means backtester sets `_currentStockMeta = null` and
  `computeFactors` is still called with `{}`, yielding valueInvPbr/logSize null
  AND momentum60d null even when candles have ≥60 bars (because
  `stockMeta || {}` is truthy but empty — momentum path doesn't need meta, so
  it DOES work). Net effect: momentum/liquidity still computable, but UX flag
  for "APT disabled" is missing. Minor UX, not correctness.
- **LOW — L.388, 468 duplicated `stockMeta:` injection**: both analyze +
  backtest postMessage sites; any future change must update both.

### analysisWorker.js
- **MED — L.431, 513 `backtester._currentStockMeta = msg.stockMeta || null`**:
  correctly injected both paths. However, no reset-on-error — if a later job
  omits `stockMeta`, the field falls back to null as expected. OK.

## 3. Required-Item Matrix

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Null factor 5/5 → `aptPrediction=null` | **WARN** | predict() returns number (not null) with all zeros when factors null; null only on model unloaded or throw. backtester.js L.1746-1764 |
| 2 | idx<60 per-factor gate | **PASS** | aptModel.js L.148/157/193 independent gates |
| 3 | `typeof aptModel === 'undefined'` Worker branch | **PASS** | backtester.js L.1663 |
| 4 | `_computeAPTDiagnostic` div-by-zero / nDates<10 | **PASS** | L.932-937 `stdIC>1e-6` guard; L.914 pooled fallback |
| 5 | `aptDiagnostic` postMessage clone-safe | **PASS** | plain object, no fn/proto |
| 6 | `rawFactorsList` GC after Pass 3 | **PASS** | local to function scope; no closure retention |
| 7 | `_fisherCI` r=±1, nEff<4 | **PASS** | L.795 guard + L.799 clamp |
| 8 | `_computeAPTMeta` matches pseudocode | **PASS** | L.1031-1060 matches ic_precision_framework.md L.1129-1157 verbatim |
| 9 | `pbr>0.01` gate | **PASS** | aptModel.js L.182 |
| 10 | `count>=10` trading days min | **PASS** | aptModel.js L.203 |

## 4. Fix Recommendations

- **P0 — none** (no crash/corruption paths).
- **P1a** — aptModel.js L.177 / appWorker.js L.1215: either populate
  `marketReturns60d` from KOSPI/KOSDAQ index cache OR document
  `beta60d=always-null` until Phase 8 and deflate 5/5 gate denominator to 4/5.
- **P1b** — backtester.js L.1630: include `_currentStockMeta` (or a stable
  per-stock hash) in `_analyzeCache` key to prevent cross-stock factor leak.
- **P2a** — analysisWorker.js L.77-83: either add `aptModel.js?v=N` to
  importScripts, or skip `_computeAPTDiagnostic` entirely when aptModel absent
  (instead of running with all-zero vectors).
- **P2b** — aptModel.js L.247: use mid-pair-average median to match NumPy
  parity with training pipeline.

## 5. Regression Risk

- **Low runtime crash risk**: all math paths have null/finite guards; worst
  outcome is silent null-result or all-zero factor contribution.
- **Moderate measurement-validity risk**: the 5/5 GO gate (§P7-001 success
  criterion) is currently evaluating an APT prediction missing `beta60d` for
  every real stock. Headline numbers in the post-deploy QA will systematically
  under-report icirAnn / icLift magnitude — consider deflating the MVP
  threshold or tagging diagnostic with a "betaAvailable: false" field before
  promoting to GO.
- **No patent-gate impact**: z-score cohort formulation (client replicates
  training formula, never persists μ/σ) is intact.
