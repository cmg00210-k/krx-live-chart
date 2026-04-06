# Section 0.3: Document Internal Consistency Audit

**Date:** 2026-04-06
**Auditor:** Code Audit Inspector (Claude Opus 4.6)
**Scope:** 17 V7 anatomy documents in `docs/anatomy/`
**Method:** Automated grep + manual spot-check against source code

---

## 0.3.1 Formula ID Uniqueness

### Summary

Total formula definition IDs found: **218** (unique by prefix-number combination)

| Prefix | Range | Count | Home Document |
|--------|-------|-------|---------------|
| M- | 1-5 | 5 | S2_theoretical_basis_v6.md |
| S- | 1-13 | 13 | S2_theoretical_basis_v6.md |
| F- | 1-9 | 9 | S2_sec23_finance_behavioral_v6.md |
| B- | 1-6 | 6 | S2_sec23_finance_behavioral_v6.md |
| MAC- | 1-10 | 10 | S2_sec25_macroeconomics_v6.md |
| MIC- | 1-10 | 10 | S2_sec26_microeconomics_v6.md |
| DRV- | 1-17 | 17 | S2_sec27_derivatives_v6.md |
| BND- | 1-15 | 15 | S2_sec28_bonds_credit_v6.md |
| GT- | 1-3 | 3 | S2_sec29_rl_game_control_v6.md |
| OC- | 1-3 | 3 | S2_sec29_rl_game_control_v6.md |
| RL- | 1-4 | 4 | S2_sec29_rl_game_control_v6.md |
| AD- | 1-5 | 5 | S2_sec29_rl_game_control_v6.md |
| I- | 01-32 | 32 | S3_ta_methods_v6.md |
| P- | 01-45 | 45 | S3_ta_methods_v6.md |
| PF- | 1-12 | 12 | S3_signal_backtester_v6.md |
| SIG- | 01-19 | 19 | S3_signal_backtester_v6.md |
| CONF- | 1-10 | 10 | S3_confidence_chain_v6.md |

### Duplicates Found: **YES -- "F-" prefix collision (3 documents)**

The "F-" prefix is used with two different semantic meanings across three documents:

| ID | S2_sec23 (Finance Formula) | S1_sec1to4 (Finding) | S2_sec25 (Finding) |
|----|---------------------------|---------------------|---------------------|
| F-1 | CAPM Equation | `mcs` key missing from macro_latest.json | Taylor Rule r* discrepancy |
| F-2 | APT Pricing Equation | `download_market_index.py` not in daily_update.bat | MCS weight structure divergence |
| F-3 | Fama-French 3-Factor | `compute_hmm_regimes.py` not scheduled | TAYLOR_OUTPUT_GAP hardcoded |
| F-4 | Jensen's Alpha | Per-stock investor flow not implemented | Crisis severity formula distributed |
| F-5 | Scholes-Williams Beta | `bbb_minus` confusable item code | Stovall sector rotation unvalidated |
| F-6 | Blume Adjusted Beta | OECD CLI parser silent on header change | MCS double-application safeguard fragile |
| F-7 | Sharpe Ratio | `data/backtest/` may not deploy to CF Pages | -- |
| F-8 | WACC | `market_context.json` VKOSPI conflict | -- |
| F-9 | EVA Formula | -- | -- |

**Impact:** A cross-document reference to "F-3" is ambiguous -- it could mean the Fama-French 3-Factor formula, a daily_update.bat scheduling issue, or a Taylor Rule output gap issue, depending on the reader's context.

**Recommendation:** Rename Finding IDs in S1 and S2_sec25 to use a distinct prefix such as `FND-` or `FIND-` to avoid ambiguity with the Finance formula `F-` prefix.

### Content-Level Overlaps (different IDs, same concept)

These are not strict ID collisions but may cause confusion:

| Concept | ID in Doc A | ID in Doc B | Assessment |
|---------|-------------|-------------|------------|
| RORO Regime Classification | MAC-8 (S2_sec25) | BND-15 (S2_sec28) | Same function `_classifyRORORegime()`. Bonds doc presents bond-credit perspective, macro doc presents IS-LM perspective. Acceptable if cross-referenced. |
| CUSUM Change Detection | S-12 (S2_theoretical) | AD-3 (S2_sec29) | S-12 covers pure statistics; AD-3 covers adaptive markets context. Acceptable separation of concerns. |
| Binary Segmentation | S-13 (S2_theoretical) | AD-4 (S2_sec29) | Same as above. |
| Kyle Lambda | B-6 (S2_sec23) | MIC-3 (S2_sec26) | B-6 covers behavioral/slippage application; MIC-3 covers microstructure theory. Acceptable. |
| VRP (Variance Risk Premium) | S-10 (S2_theoretical) | DRV-12 (S2_sec27) | S-10 covers statistical formula; DRV-12 covers derivatives market application. Acceptable. |

---

## 0.3.2 Line Number Spot-Check

10 file:line references verified against source code (js/ directory).

| # | Doc | Reference | Claimed | Actual | Match? |
|---|-----|-----------|---------|--------|--------|
| 1 | S3_ta_methods_v6.md | I-01 `calcMA` in indicators.js | line 15 | `function calcMA(data, n)` at line 15 | PASS |
| 2 | S3_ta_methods_v6.md | I-16 `calcHurst` in indicators.js | line 212 | `function calcHurst(closes, minWindow = 10)` at line 212 | PASS |
| 3 | S3_confidence_chain_v6.md | CONF-1 `_applyMarketContextToPatterns` in appWorker.js | lines 1016-1051 | Function at 1016, clamp at 1042, closing brace at 1051 | PASS |
| 4 | S3_confidence_chain_v6.md | CONF-5 `_applyDerivativesConfidenceToPatterns` in appWorker.js | lines 711-825 | Function at 711, Factor 1 basis at 742-758 | PASS |
| 5 | S4_chart_rendering_v6.md | Entry-point dot on R:R bar in patternRenderer.js | line ~768 | `ctx.fillStyle = '#fff'; ctx.arc(barX, fz.yEntry, 2.5, ...)` at lines 768-771 | PASS |
| 6 | S4_chart_rendering_v6.md | SINGLE_PATTERNS / ZONE_PATTERNS / CHART_PATTERNS counts in patternRenderer.js | 13 / 21 / 11 | 13 keys at lines 72-86, 21 keys at lines 48-70, 11 entries at lines 88-93 | PASS |
| 7 | S5_lifecycle_workers_v6.md | `init()` call in app.js | line 540 | `init();` at line 540 | PASS |
| 8 | S5_lifecycle_workers_v6.md | `_continueInit()` in app.js | lines 39-435 | `async function _continueInit()` at line 39, closing `}` at line 435 | PASS |
| 9 | S2_theoretical_basis_v6.md | M-1 log-returns in `calcHurst`, indicators.js | lines 217-219 | `Math.log(closes[i + 1] / closes[i])` at line 219 | PASS |
| 10 | S2_theoretical_basis_v6.md | M-1 log-returns in `calcEWMAVol`, indicators.js | line 1347 | `Math.log(closes[i] / closes[i - 1])` at line 1347 | PASS |

---

## 0.3.3 File Path Verification

5 JSON data file paths referenced in S1 docs verified against disk.

| # | Path | Referenced In | Exists? |
|---|------|---------------|---------|
| 1 | `data/macro/macro_latest.json` | S1_api_pipeline_v6_sec1to4.md (pipeline contract, line 980) | PASS |
| 2 | `data/derivatives/investor_summary.json` | S1_api_pipeline_v6_sec1to4.md (pipeline contract) | PASS |
| 3 | `data/backtest/flow_signals.json` | S1_api_pipeline_v6_sec1to4.md (pipeline contract) | PASS |
| 4 | `data/derivatives/options_analytics.json` | S1_api_pipeline_v6_sec1to4.md (pipeline contract) | PASS |
| 5 | `data/macro/macro_composite.json` | S1_api_pipeline_v6_sec1to4.md (pipeline contract) | PASS |

---

## Summary

| Check | Items | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| 0.3.1 Formula ID Uniqueness | 218 IDs, 17 prefixes | 16 prefixes unique | 1 prefix collision ("F-") | F-1 through F-8 used as Finance formulas AND Findings across 3 docs |
| 0.3.2 Line Number Spot-Check | 10 references | 10 | 0 | All line numbers accurate against current source |
| 0.3.3 File Path Verification | 5 paths | 5 | 0 | All referenced JSON files exist on disk |
| **Total** | **233** | **231** | **1** | + 1 collision (not counted as pass/fail per-item) |

### Verdict: **CONDITIONAL PASS**

All line number references and file path references are accurate. The single issue is the "F-" prefix namespace collision across S1, S2_sec23, and S2_sec25. This is a documentation-level ambiguity, not a code defect, but should be resolved before the next ANATOMY version to prevent cross-reference confusion.

### Priority Fix

1. **Rename Finding IDs in S1_api_pipeline_v6_sec1to4.md:** Change `F-1` through `F-8`, `F-16`, `F-18`-`F-20` to `FND-1` through `FND-12` (or similar distinct prefix).
2. **Rename Finding IDs in S2_sec25_macroeconomics_v6.md:** Change `F-1` through `F-6` to `FND-MAC-1` through `FND-MAC-6` (or reuse `FND-` with offset numbering).
3. **Reserve the `F-` prefix** exclusively for Finance formulas in S2_sec23_finance_behavioral_v6.md.
