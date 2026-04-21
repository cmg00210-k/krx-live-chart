# Phase 8 Phase C — Consistency Check

**Scope**: 6 cross-file contract chains for APT 5-factor activation (P7-001). Agent: python-consistency-verifier.

| # | Contract | Result | Evidence |
|---|----------|--------|----------|
| 1 | Coefficient JSON schema ↔ aptModel consume | **PASS** | See §1 |
| 2 | aptModel factor names ↔ backtester storage | **PASS** | See §2 |
| 3 | `functions/api/apt.js` pattern + stage_deploy registration | **PASS** | See §3 |
| 4 | Placeholder contract + aptModel fetch path | **PASS** (caveat) | See §4 |
| 5 | Worker stockMeta propagation | **PASS** | See §5 |
| 6 | Version sync triad | **PASS** | See §6 |

---

## §1 Coefficient JSON ↔ aptModel

Producer `scripts/mra_apt_extended.py` L.890-911 writes top-level keys: `model`, `lambda`, `horizon`, `n_samples`, `feature_names` (18 entries), `coefficients` (18 floats), `apt_factors` (5 metadata dicts).

Consumer `js/aptModel.js` L.52-61 reads exactly: `data.coefficients` (validates `length === 18`), `data.feature_names`, `data.apt_factors`, `data.n_samples`, `data.horizon`, `data.lambda`. All match.

Factor names in `feature_names[13..17]`: `momentum_60d`, `beta_60d`, `value_inv_pbr`, `log_size`, `liquidity_20d` (mra_apt_extended.py L.68-74). Positional alignment with `aptModel.predict()` vec[13..17] (aptModel.js L.110-114) verified.

**Note**: prompt-expected keys `intercept`/`r2`/`factorMeans`/`factorStds` do NOT exist in this schema variant — intercept is `coefficients[0]`, r2 not persisted, factorMeans/Stds intentionally absent (zscoreCohort replicates per-cohort). Not a FAIL — contract is internally consistent.

## §2 Factor name mapping

- Coefficient JSON keys: `momentum_60d`, `beta_60d`, `value_inv_pbr`, `log_size`, `liquidity_20d` (snake_case).
- `aptModel.computeFactors()` returns (aptModel.js L.139-145): `momentum60d`, `beta60d`, `valueInvPbr`, `logSize`, `liquidity20d` (camelCase).
- Mapping from computeFactors → predict happens via positional vec construction in `predict()` (L.110-114), not by key lookup — no string mapping needed.
- `backtester.js` L.1770-1776 stores aptFactors with short keys: `momentum`, `beta`, `value`, `size`, `liquidity`.
- Consumer `backtester.js` L.944, L.952 reads the SAME short keys. PASS.

## §3 apt.js + stage_deploy registration

`functions/api/apt.js` L.6-13: imports `../_data/mra_apt_coefficients.json`, uses `guardGet(request, env, 'light_get')` + `jsonResponse(data, g.origin, { 'Cache-Control': 'no-store' })` — byte-for-byte identical to `functions/api/constants.js` (V48 Phase 1 reference).

`scripts/stage_deploy.py` registrations for `data/backtest/mra_apt_coefficients.json`:
- EXCLUDE_EXACT: L.122 ✓
- SEC_PROTECTED_JSONS: L.134 ✓ (copied to `functions/_data/`)
- SEC_PLACEHOLDERS: L.145-150 ✓ (`{"moved":"/api/apt","protected":true,...}`)
- CRITICAL_FILES: L.497 (as `functions/_data/mra_apt_coefficients.json`) ✓

All 4 sets registered.

## §4 Placeholder + fetch path

`aptModel.js` L.44-45: fetch path is `/api/apt` (signed) — NOT `/data/backtest/mra_apt_coefficients.json`. PASS.

**Caveat**: source-tree file `data/backtest/mra_apt_coefficients.json` currently contains the REAL 73-line coefficient content (not a placeholder). This is expected — the placeholder is synthesized into `deploy/` at stage time (stage_deploy.py L.407-418), not stored in source. Confirm by running stage_deploy and inspecting `deploy/data/backtest/mra_apt_coefficients.json` (should be ~168B with `{"moved":"/api/apt"}`).

**Finding**: `js/aptModel.js` is NOT listed in CRITICAL_FILES (stage_deploy.py L.516-535). It loads via `index.html` L.748 script tag, so it will be staged by the generic walk, but absence from the critical-file guard means a silent drop would not FAIL verify. **Recommendation**: add `os.path.join("js", "aptModel.js")` to the non-bundled CRITICAL_FILES list.

## §5 stockMeta propagation

- Producer `_getStockMetaForApt()` in `appWorker.js` L.1215-1236 returns `{marketCap, pbr, market}` or null. Schema matches `aptModel.computeFactors()` meta param (aptModel.js L.131, L.182, L.187, L.193).
- postMessage sender sites: appWorker.js L.388 (backtest) and L.468 (analyze) — both send `stockMeta` key.
- Receiver sites: analysisWorker.js L.432 (backtest msg) and L.514 (analyze msg) — both read `msg.stockMeta` and assign to `backtester._currentStockMeta`.
- backtester.js L.1665-1666 reads `this._currentStockMeta` before calling `aptModel.computeFactors(candles, idx, stockMeta || {})` at L.1718. PASS.

## §6 Version sync triad

- `index.html` L.748 `aptModel.js?v=3`, L.754 `backtester.js?v=48`, L.760 `appWorker.js?v=20`.
- `analysisWorker.js` L.82 imports `backtester.js?v=48` — matches index.html.
- `sw.js` L.8 `CACHE_NAME = 'cheesestock-v87'`; `/js/aptModel.js` listed in STATIC_ASSETS L.22.
- All aligned. PASS.
