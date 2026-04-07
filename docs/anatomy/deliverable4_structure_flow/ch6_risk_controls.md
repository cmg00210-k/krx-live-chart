# Chapter 6: Risk Controls & Validation

> **D4 Structure Flow** -- CheeseStock / KRX Live Chart
> **Author**: statistical-validation-expert
> **Source Date**: 2026-04-07 (ANATOMY V7 production state)

---

## 6.1 The Validation Problem

A system detecting 30+ patterns across 2,700+ stocks and 5 return horizons
evaluates up to 607,500 (pattern, horizon, stock) triples. Without
statistical controls, random chance produces thousands of apparently
significant results. This chapter describes the seven gates every pattern
must survive, the empirical results, and the acknowledged limitations.

Cross-reference: D2 `P3_validation_risk.md` Sections 3.1--3.7.

## 6.2 Seven-Gate Validation Stack

Each pattern type passes through seven sequential gates. Failure at any
gate triggers tier demotion or rejection. Gates are ordered from
estimation through multiple-testing correction to survivorship adjustment.

| Gate | Method | Failure Mode Addressed | Academic Basis |
|------|--------|------------------------|----------------|
| 1 | WLS Regression (Ridge + HC3) | Heteroscedasticity in KRX returns | Hoerl & Kennard (1970); MacKinnon & White (1985) |
| 2 | Walk-Forward Evaluation | Overfitting to single train/test split | Pardo (2008); Bailey & Lopez de Prado (2014) |
| 3 | BH-FDR (q=0.05, 45 hypotheses) | False discoveries from multiple testing | Benjamini & Hochberg (1995) |
| 4 | Hansen SPA (B=500) | Data snooping across pattern universe | Hansen (2005) |
| 5 | BCa Bootstrap CI (500 rep) | Non-normal return distributions | Efron (1987); Fama & French (2010) |
| 6 | Rolling OOS IC | In-sample IC inflation | Grinold & Kahn (2000) |
| 7 | Survivorship Correction | Delisted-stock bias (308 stocks) | Elton, Gruber & Blake (1996) |

**Gates 1--2: Estimation and overfitting control.** Ridge-penalized WLS
with GCV-selected lambda provides stable coefficients; HC3 standard
errors (sandwich estimator with Ridge-penalized inverse) produce valid
inference under the heteroscedastic returns caused by KRX's +-30% daily
price limit. Walk-Forward Evaluation (4--6 expanding-window folds,
2x-horizon purge gap) measures out-of-sample retention: WFE < 30%
demotes to Tier C regardless of in-sample statistics.

**Gates 3--4: Multiple testing and data snooping.** BH-FDR controls the
false discovery proportion at 5% across 45 per-stock hypotheses --
substantially more powerful than Bonferroni while maintaining statistical
rigor. Hansen SPA tests whether the best pattern genuinely outperforms a
random-entry benchmark; SPA failure demotes all Tier A/B patterns to C.

**Gate 5: Distribution robustness.** Calendar-time block bootstrap
(resampling whole months) preserves within-month dependence. BCa
correction provides second-order accurate coverage for KRX's skewed,
leptokurtic returns. Winsorization at 1st/99th percentile bounds CI width.

**Gate 6: Predictive power.** Spearman rank IC on non-overlapping OOS
windows gates tier promotion: IC > 0.02 for Tier A, IC > 0.01 for B.

**Gate 7: Survivorship.** Three-tier lookup corrects buy-pattern WR
inflation from 308 missing delisted stocks. Adjustment clamped [0.92, 1.0].

Cross-reference: D2 `P3_validation_risk.md` Sec 3.1--3.4;
`S3_signal_backtester_v7.md` BT-01 through BT-28.

---

## 6.3 Validation Gate Flow

```
   VALIDATION GATE FLOW (per pattern type)
   ========================================

   Raw Pattern Occurrences (303,956 instances)
          |
          v
   [Gate 1] WLS Regression (Ridge + HC3)
          |  HC3 SEs for heteroscedasticity
          v
   [Gate 2] Walk-Forward Evaluation
          |  4-6 folds, purge = 2 x horizon
          |  WFE < 30% --> demote to C
          v
   [Gate 3] BH-FDR (q=0.05, 45 hypotheses)
          |  Reject where p_(k) <= k * q / m
          v
   [Gate 4] Hansen SPA (B=500)
          |  H0 not rejected --> A/B to C
          v
   [Gate 5] BCa Bootstrap CI (500 rep)
          |  Calendar-time block resampling
          v
   [Gate 6] Rolling OOS IC (Spearman)
          |  IC > 0.02: A | IC > 0.01: B
          v
   [Gate 7] Survivorship Correction
          |  308 delisted, Elton et al. (1996)
          |  Buy WR adjusted down 0.1-1.1pp
          v
   Tier Assignment: A / B / C / D
```

---

## 6.4 Information Coefficient: Honest Disclosure

The system-wide IC (Huber-IRLS, post-upgrade) is **0.051**. Published
equity factor ICs range from 0.03 to 0.10 (Grinold & Kahn 2000). At
0.051 the system sits in the lower-middle of this range -- modest but
non-trivial for short-horizon single-stock TA on a mid-tier emerging
market. The system does not claim alpha-generating performance.

Pre-upgrade OLS IC was ~0.013 (near-random). The gain comes from robust
down-weighting of outlier returns at KRX's +-30% price limit (Huber
1964, delta = 1.345 x sigma, sigma = 4.3% from 5-day MAD).

**Known limitation.** Regression coefficients in the IC calculation path
are fitted on the full training set, not refitted per OOS fold. True
recursive OOS IC (available in the WFE path, Gate 2) would be lower.
Flagged as Warning W-4 in the backtester.

Cross-reference: D2 `P3_validation_risk.md` Section 3.1.2--3.1.3.

---

## 6.5 Formula-Code Fidelity

An independent audit spot-checked 15 key formulas from ANATOMY
documentation against production JS/Python, symbol-by-symbol.

| Verdict | Count | Interpretation |
|---------|-------|----------------|
| MATCH | 12 | Exact correspondence between doc and code |
| MINOR_DIFF | 3 | Documentation precision issues; no code errors |
| DISCREPANCY | 0 | None found |

**Overall grade: A.** The three MINOR_DIFF items are documentation-level:
(1) BND-9/BND-10 label swap in a cross-reference table -- code implements
Bharath-Shumway (2008) naive DD correctly as BND-10; (2) MCS v2 consumer
confidence normalization range undocumented for BSI fallback [50,120] vs
ESI primary [60,130]; (3) JS live beta omits Blume (1975) adjustment by
design, but the documentation provenance chain does not note this.

Ten cross-file consistency checks confirmed Python and JS share identical
constants for risk-free rate, minimum observations, trading days (250),
thin-trading thresholds, and Scholes-Williams denominator guards.

Cross-reference: D2 `S0_formula_fidelity_v7.md` (full audit).

---

## 6.6 End-to-End Pipeline Traces

Five pipelines traced from external API through scripts, JSON storage,
and JS runtime to browser rendering. All passed without broken links.

| # | Pipeline | Source | Destination | Status |
|---|----------|--------|-------------|--------|
| 1 | KTB 10Y Bond | ECOS API (817Y002) | financials.js | PASS |
| 2 | Investor Flow | KRX OTP auth | Confidence chain | PASS |
| 3 | Hurst Exponent | OHLCV candles | Price target | PASS |
| 4 | Hammer Signal | patterns.js | signalRenderer | PASS |
| 5 | Backtest Tier | backtester.js | patternPanel badge | PASS |

Each trace verified: (a) API endpoint and schema, (b) sample-data guards
preventing synthetic data from entering the confidence chain, (c) JSON
intermediate schema, and (d) rendered output matching computed value.

Cross-reference: D2 `S0_cross_stage_verification_v7.md` Section 0.1.

---

## 6.7 Deployment Quality Gates

Five formal gates protect correctness across sessions, multi-agent runs,
and deploys.

| Gate | Name | Type | Trigger |
|------|------|------|---------|
| 1 | CHECK 6: Pipeline Connectivity | Automated | Every `verify.py` run |
| 2 | Browser Smoke Test | Manual, 10 items | After multi-file change |
| 3 | Change Contract | Document template | 6+ agents or 3+ JS files |
| 4 | ANATOMY-First Workflow | Read-then-write | 3+ JS files touched |
| 5 | Session Start/End Protocol | Checklists | Every session |

**Gate 1** validates 12 JSON data sources against a schema contract: file
existence, required keys, sample-data guards, array non-emptiness, and
14-day staleness. Catches silent failures where API scripts exit
successfully but produce stale output.

**Gate 2** covers initialization (index load, Worker startup, console
errors), data pipeline (chart render, macro load), pattern pipeline
(detection toast, panel cards), UI integrity (vizToggles, responsive
layout), and deploy integrity (no 404s, Service Worker).

**Gates 3--5** prevent multi-agent drift: Change Contract enforces file
ownership; ANATOMY-First ensures docs update before code; Session
Protocol requires `verify.py --strict` pass at session start and end.

Cross-reference: `.claude/rules/quality-gates.md`.

---

## 6.8 Honest Limitations

The following gaps are disclosed to prevent overclaiming.

**1. No true real-time OOS validation.** All validation runs on historical
OHLCV data. No paper-trading or live-fill loop exists to verify that
confidence scores predict forward returns in deployment conditions.

**2. Execution quality is unmeasured.** The backtester assumes next-candle-
open entry and 0.265% round-trip cost. Actual slippage, market impact
(especially small-cap KOSDAQ), and routing latency are not captured.

**3. Regime robustness is backward-looking.** HMM regime labels lag during
transitions (BOK surprises, circuit breakers). Confidence adjustments may
be directionally wrong until re-classification completes.

**4. D-grade constant sensitivity.** ~73 constants lack published source or
calibration. Highest-impact: regime multipliers (CONF-7, +-10-15% on all
patterns). A 255,000+ pattern recalibration with 70/30 split produced
worse OOS IC than academic defaults -- current heuristics remain in force.

**5. Cross-stock MTC absent.** BH-FDR is per-stock only. The 2,700 x 225
= 607,500 effective test count has no portfolio-level correction.

**6. Survivorship correction is statistical, not data reconstitution.**
The 308-stock delta adjusts win rates but does not include actual
delisted return series. Tail risk from bankruptcies is not in bootstraps.

Cross-reference: D2 `P3_validation_risk.md` Section 3.8.

---

## 6.9 Summary

Seven sequential gates applied to 303,956 pattern instances produce
IC = 0.051 (modest by factor standards). Formula fidelity: 12/15 exact,
3 minor doc issues, 0 code errors. Five pipeline traces: all PASS. Five
deployment gates protect production. The system discloses what it does
not validate: real-time OOS, execution quality, regime transitions,
D-grade magnitudes, cross-stock MTC, and delisted tail risk.
