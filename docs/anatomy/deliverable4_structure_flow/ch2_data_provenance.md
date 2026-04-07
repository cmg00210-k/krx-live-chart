# Chapter 2: Data Provenance and Trust Architecture

> **Deliverable 4 — Structure Flow | Chapter 2 of 4**
> **Version**: V7 (2026-04-07)
> **Source authority**: `S1_api_pipeline_v7_sec1to4.md`, `S1_api_pipeline_v7_sec5to8.md`,
> `S1_api_pipeline_v7_sec9.md`, `S3_confidence_chain_v7.md`, `.claude/rules/financial.md`
> **Tone**: CFA paper grade — precise, quantitative, citation-backed

---

## 2.1 Introduction: Why Data Provenance Matters

Technical analysis is only as reliable as the data underlying it. In the Korean
market context, three structural risks make data provenance non-trivial:

1. **Source heterogeneity**: Price data (KRX/pykrx), macro data (ECOS/FRED/KOSIS),
   fundamental data (DART), and derivatives data (KRX API) follow different update
   schedules, authentication schemes, and failure modes.

2. **Silent degradation**: The `daily_update.bat` pipeline uses a fail-forward model —
   every download step after the initial health check emits a WARNING and continues.
   A complete failure of the macro download produces no user-visible error; only the
   confidence chain silently drops that adjustment factor.

3. **Seed data contamination**: For stocks without DART financial data, the system
   generates deterministic pseudo-random financials from a code hash (seed data).
   Displaying seed data as real would materially mislead users. The trust system
   prevents this at the render layer.

This chapter documents the complete chain from API call through JSON file to browser
variable, the three-tier trust classification applied to financial data, and the
mechanisms that detect and contain data quality failures.

---

## 2.2 API Source Map

### 2.2.1 Five External APIs

CheeseStock integrates five primary external APIs plus the OECD SDMX endpoint (merged
into the macro pipeline). Each API serves a distinct analytical domain.

```
API SOURCE MAP: 5 EXTERNAL APIS -> SCRIPTS -> JSON FILES
=========================================================

  +----------+   download_macro.py      +------------------+
  | ECOS     |------------------------->| macro_latest.json|
  | (BOK)    |   download_bonds.py      | bonds_latest.json|
  | free API |------------------------->| bonds_history.json|
  | key reqd |   download_market_       | market_context.  |
  +----------+   context.py------------>|   json (CCSI)    |
                                        +------------------+
  +----------+   download_macro.py      +------------------+
  | FRED     |------------------------->| macro_latest.json|
  | (FRB St  |   (merged with ECOS      |  (fed_rate, vix, |
  | Louis)   |    in same script)       |   us10y, dxy...) |
  | free key |                          +------------------+
  +----------+

  +----------+   download_ohlcv.py      +------------------+
  | KRX      |------------------------->| data/kospi/      |
  | (pykrx   |                          |   {code}.json    |
  |  v1.2.4) |   download_market_       | data/kosdaq/     |
  | no auth  |   index.py-------------->|   {code}.json    |
  +----------+                          | market/kospi_    |
                                        |   daily.json ... |
  +----------+   download_              +------------------+
  | KRX      |   derivatives.py         +------------------+
  | OpenAPI  |------------------------->| derivatives_     |
  | (options |   download_investors.py  |   summary.json   |
  |  futures |   download_etf.py        | investor_summary |
  |  investor|   download_shortsell.py  | etf_summary.json |
  |  ETF)    |                          | shortselling_    |
  +----------+                          |   summary.json   |
                                        | options_daily,   |
                                        |   futures_daily  |
                                        +------------------+
  +----------+   download_              +------------------+
  | DART     |   financials.py          | data/financials/ |
  | (FSS     |------------------------->|   {code}.json    |
  | OPENDART)|   DART API v2            | (2,607 files)    |
  | free key |   0101000/연결/분기      +------------------+
  +----------+

  +----------+   download_kosis.py      +------------------+
  | KOSIS    |------------------------->| kosis_latest.json|
  | (KOSTAT) |                          | (CLI, ESI, IPI,  |
  | no auth  |                          |  CP yield, CPI)  |
  +----------+                          +------------------+

  +----------+   fetch_oecd_cli()       (merged into
  | OECD     |   inside download_        macro_latest.json:
  | SDMX     |   macro.py               korea_cli,
  | CLI data |-------------------------> china_cli,
  | no auth  |                           us_cli)
  +----------+
```

Source: `S1_api_pipeline_v7_sec1to4.md` §1.1-1.4.

### 2.2.2 Compute Scripts: Post-Download Offline Transforms

Fifteen compute scripts run after the download phase, reading raw JSON files and
producing derived analytics. They hit no external APIs and run on the same host.

| Script | Inputs | Output | Key Methods |
|--------|--------|--------|-------------|
| compute_macro_composite.py | macro_latest, bonds_latest, kosis_latest | macro_composite.json | MCS v2 (8-factor, 0-100), Taylor Rule |
| compute_options_analytics.py | options_latest, bonds_latest, kospi200_daily | options_analytics.json | BSM IV (Newton-Raphson), straddle implied move |
| compute_capm_beta.py | OHLCV, market index, bonds_latest, financials | capm_beta.json | OLS beta, Scholes-Williams, Merton DD |
| compute_basis.py | derivatives_summary, bonds_latest | basis_analysis.json | Cost-of-carry, excess basis z-score |
| compute_eva.py | financials, capm_beta, macro_latest | eva_scores.json | NOPAT, WACC, EVA spread, EVA momentum |
| compute_hmm_regimes.py | OHLCV (cap-weighted proxy) | hmm_regimes.json | Baum-Welch EM, 2-state Gaussian HMM |
| compute_flow_signals.py | investor per-stock, hmm_regimes | flow_signals.json | Foreign momentum (20d MA), retail contrarian |
| compute_bond_metrics.py | bonds_latest | bond_metrics.json | Macaulay/Modified Duration, DV01, Convexity |
| compute_illiq_spread.py | OHLCV per-stock | illiq_spread.json | Amihud ILLIQ, Roll (1984) spread |
| compute_survivorship_correction.py | pattern_performance (listed + delisted) | survivorship_correction.json | delta_wr between listed and combined |

Source: `S1_api_pipeline_v7_sec5to8.md` §1.5.1-1.5.15.

---

## 2.3 Data Trust Decision Tree

### 2.3.1 Three-Tier Financial Data Trust System

DART financial data coverage is 95.3% (2,607 / 2,736 stocks). For the remaining
4.7%, and for any stock whose DART file fails to fetch, the system falls back through
a three-tier trust chain. The tier determines which financial metrics are rendered in
Column D (재무 패널).

```
FINANCIAL DATA TRUST DECISION TREE
=====================================

  getFinancialData(code)
       |
       v
  +-------------------+
  | 1. Memory cache   |---(hit)---> return cached result
  |    _financialCache|            (any tier, already resolved)
  +-------------------+
       | miss
       v
  +-------------------+
  | 2. fetch data/    |---(200 OK + source != 'seed')---> TIER 1: DART
  |    financials/    |
  |    {code}.json    |---(fetch error or 404)----------> try tier 3
  |    (10s timeout)  |
  +-------------------+
       | source == 'seed'
       v
  +---------------------------------------------+
  | 3. getPastData(code)                        |
  |                                             |
  |    is code in PAST_DATA (Samsung/SK Hynix)?|
  |      YES --> TIER 2: hardcoded              |
  |      NO  --> TIER 3: seed (PRNG from hash) |
  +---------------------------------------------+

  TIER 1 (source: 'dart')
    --> All financial metrics displayed in full
    --> PER, PBR, PSR, ROE, ROA, EVA, Merton DD
    --> Peer group comparison enabled

  TIER 2 (source: 'hardcoded')
    --> All financial metrics displayed in full
    --> Warning badge shown in UI: "하드코딩된 데이터"
    --> Peer group enabled (filtered for tier mismatch)

  TIER 3 (source: 'seed')
    --> ALL financial metrics displayed as '---'
    --> Seed data NEVER shown as real numbers
    --> Peer group EXCLUDES seed stocks
```

Source: `.claude/rules/financial.md` Data Trust System; `S1_api_pipeline_v7_sec5to8.md` §1.6.6.

### 2.3.2 Seed Data Contamination Prevention

The prohibition against displaying seed data as real is enforced at three layers:

**Layer 1 — Render guard (`financials.js`)**: When `source === 'seed'`, the function
`updateFinancials()` clears all metric fields to `'---'` before DOM update. No
seed-derived number ever reaches `textContent`.

**Layer 2 — Compute script guard**: `compute_eva.py` and other compute scripts reject
financial inputs where `source in ('seed', 'demo')`. This prevents seed-data EVA
scores from appearing in `eva_scores.json`.

**Layer 3 — Peer group filter**: `sidebarManager`'s peer group calculation excludes
stocks tagged as seed from the sector comparison pool. A seed stock cannot inflate
or deflate the sector median PER/PBR.

The only failure vector for this guarantee is if a `data/financials/{code}.json`
file incorrectly carries `source: 'dart'` while containing fabricated data. This
cannot happen through the normal pipeline (`download_financials.py` sets `source`
only from the DART API response status), but would require manual file corruption.

---

## 2.4 JSON File Catalog Summary

The 60+ JSON files that participate in the pipeline fall into six functional
categories. Per-stock OHLCV files (approximately 2,696 files in `data/kospi/` and
`data/kosdaq/`) are not enumerated individually.

### Category 1: Stock Universe and Prices

| File | Producer | JS Consumer | Critical Keys |
|------|----------|-------------|---------------|
| `data/index.json` | download_ohlcv.py / update_index_prices.py | `ALL_STOCKS` (api.js) | `stocks` array |
| `data/{market}/{code}.json` | download_ohlcv.py | `dataService.getCandles()` | OHLCV candle array |
| `data/{code}_{tf}.json` | generate_intraday.py | `dataService.getCandles()` | Intraday OHLCV |
| `data/market/kospi_daily.json` | download_market_index.py | `backtester._marketIndex` | `time`, `close` array |
| `data/market/kosdaq_daily.json` | download_market_index.py | `financials.js` peer context | `time`, `close` array |

### Category 2: Macro and Monetary Policy

| File | Producer | JS Consumer Variable | Required Keys |
|------|----------|---------------------|---------------|
| `data/macro/macro_latest.json` | download_macro.py | `_macroLatest` | `updated`, `mcs`, `vix`, `bok_rate` |
| `data/macro/bonds_latest.json` | download_bonds.py | `_bondsLatest` | `updated`, `yields` |
| `data/macro/kosis_latest.json` | download_kosis.py | `_kosisLatest` | `updated`, `source` |
| `data/macro/macro_composite.json` | compute_macro_composite.py | `_macroComposite` | `mcsV2` |
| `data/macro/bond_metrics.json` | compute_bond_metrics.py | `_bondMetricsCache` | `benchmarks`, `curveShape` |
| `data/market_context.json` | download_market_context.py | `_marketContext` | `ccsi`, `vkospi`, `net_foreign_eok` |

### Category 3: Derivatives and Market Structure

| File | Producer | JS Consumer Variable | Sample Guard |
|------|----------|---------------------|-------------|
| `data/derivatives/derivatives_summary.json` | download_derivatives.py | `_derivativesData` | source != 'sample' |
| `data/derivatives/investor_summary.json` | download_investors.py | `_investorData` | source != 'sample' |
| `data/derivatives/etf_summary.json` | download_etf.py | `_etfData` | source != 'sample' |
| `data/derivatives/shortselling_summary.json` | download_shortselling.py | `_shortSellingData` | source != 'sample'/'unavailable' |
| `data/derivatives/options_analytics.json` | compute_options_analytics.py | `_optionsAnalytics` | status != 'error' |
| `data/derivatives/basis_analysis.json` | compute_basis.py | merged into `_derivativesData` | none |
| `data/vkospi.json` | download_vkospi.py | injected into `_macroLatest.vkospi` | none |

### Category 4: Behavioral and Backtest Analytics

| File | Producer | JS Consumer | Note |
|------|----------|-------------|------|
| `data/backtest/capm_beta.json` | compute_capm_beta.py | `backtester._capmBeta`, `financials.js` | CAPM beta + Merton DD |
| `data/backtest/eva_scores.json` | compute_eva.py | `_evaCache` (financials.js) | EVA spread per stock |
| `data/backtest/hmm_regimes.json` | compute_hmm_regimes.py | `backtester._behavioralData` | 2-state HMM; 30-day staleness gate |
| `data/backtest/illiq_spread.json` | compute_illiq_spread.py | `backtester._behavioralData` | Amihud ILLIQ, Roll spread |
| `data/backtest/flow_signals.json` | compute_flow_signals.py | `_flowSignals` | HMM label + foreign momentum |
| `data/backtest/survivorship_correction.json` | compute_survivorship_correction.py | `backtester._survivorshipCorr` | delta_wr_median |
| `data/backtest/rl_policy.json` | compute_rl_policy.py (offline) | `backtester._rlPolicy` | IC < 0 gate rejects |

### Category 5: Fundamental Financial Data

| File Pattern | Producer | JS Consumer | Trust Tier |
|-------------|----------|-------------|-----------|
| `data/financials/{code}.json` (2,607 files) | download_financials.py (DART) | `_financialCache` via `getFinancialData()` | Tier 1 (dart) / Tier 3 (seed filtered) |
| `data/macro/ff3_factors.json` | compute_ff3_factors.py | `_ff3Cache` (financials.js) | Fama-French 3-factor |
| `data/sector_fundamentals.json` | download_sector.py | `_sectorData` (app.js) | Peer group PER/PBR/PSR medians |

### Category 6: Dead Data Paths (Audit Findings)

Two compute scripts produce output files with no JavaScript consumer. These represent
analyst work that has not yet been wired into the browser pipeline:

| File | Producer | Status |
|------|----------|--------|
| `data/derivatives/hedge_analytics.json` | compute_hedge_ratio.py | No JS consumer; file absent from disk |
| `data/backtest/krx_anomalies.json` | compute_krx_anomalies.py | No JS consumer; excluded from deploy (.cfignore) |

Source: `S1_api_pipeline_v7_sec5to8.md` §1.5.13-1.5.14, §1.6.4.

---

## 2.5 Pipeline Reliability Summary

### 2.5.1 Overall Health Assessment

The V7 reliability audit (conducted 2026-04-06, documented in
`S1_api_pipeline_v7_sec9.md`) evaluated the 18-step `daily_update.bat` pipeline
and identified 17 findings across three severity tiers.

| Severity | Count | Scope |
|----------|-------|-------|
| P0 CRITICAL | 4 | Silent failure + stale-cache vectors |
| P1 HIGH | 5 | Partial data loss with downstream impact |
| P2 MEDIUM | 8 | Cosmetic / informational gaps |

The pipeline's overall architecture is **fail-forward by design**: Step 0 (API
health check) is the sole hard-abort gate. Steps 1-18 all emit `WARNING` and
continue, meaning the pipeline always exits with code 0 regardless of individual
step failures. This is an intentional resilience choice — partial data is considered
better than no data — but creates silent degradation risks.

### 2.5.2 Four P0 Critical Findings

**P0-1: VKOSPI download failure is silent**

`download_vkospi.py` is called without error capture in `daily_update.bat` Step 6.
If it fails, `data/vkospi.json` becomes stale without any `WARNING` log entry.
The VKOSPI time series is the primary input for volatility regime classification
(`vkospiClose > 25` = high-vol regime). A stale VKOSPI may incorrectly classify
the market as low-vol, inflating confidence scores on bullish patterns.

**P0-2: Investor flow download failure is silent**

Similarly, `download_investor.py` in Step 7 has no error capture. A silent failure
leaves `investor_summary.json` stale. The sample-data guard in `appWorker.js`
(lines 318-325) nullifies this variable if `source === 'sample'`, but a stale file
that still carries a real `source` value will propagate stale foreign flow data into
`_applyDerivativesConfidenceToPatterns()`.

**P0-3: Worker constructor version not covered by verify.py**

`appWorker.js` spawns the Analysis Worker with a hardcoded version string:
`new Worker('js/analysisWorker.js?v=N')`. This version is not validated by
`verify.py` CHECK 5f, which only checks the `importScripts()` calls inside
`analysisWorker.js` against `index.html` script tags. If `appWorker.js` line 38
is not updated when `analysisWorker.js` changes, browsers with a cached old Worker
binary will silently run the old analysis engine.

**P0-4: Options analytics null propagation**

When `compute_options_analytics.py` has no valid input (Step 12 failure), it writes
`{ status: 'no_data', analytics: null }`. `appWorker.js` then reads
`_optionsAnalytics.analytics.straddleImpliedMove` and throws a `TypeError` at
runtime if the null-chain check is absent. The V7 audit confirmed the null guard
exists but only covers the top-level null; nested field access is not fully guarded.

Source: `S1_api_pipeline_v7_sec9.md` §1.9.1-1.9.2.

### 2.5.3 Pipeline Failure Propagation

The dependency graph below shows how individual step failures cascade to the
confidence chain:

```
PIPELINE FAILURE -> CONFIDENCE CHAIN IMPACT
=============================================

  [Steps 1+2+3] fail
       |
       v
  macro_latest.json stale
       |
       v
  _macroLatest stale --> _applyMacroConfidenceToPatterns()
                         uses old KTB/VIX/CPI
                         (CONF-3 adjustment silent)

  [Steps 5+14] fail
       |
       v
  basis_analysis.json stale/missing
       |
       v
  _derivativesData.basis = null
       --> _applyDerivativesConfidenceToPatterns()
           skips basis spread adjustment
           (CONF-5 partial skip)

  [Steps 7+16] fail
       |
       v
  flow_signals.json stale
       |
       v
  _flowSignals stale --> _applyPhase8ConfidenceToPatterns()
                         uses old HMM regime labels
                         (CONF-7 adjustment silent)

  [Step 15] fails
       |
       v
  macro_composite.json stale / mcsV2 = null
       |
       v
  _macroComposite.mcsV2 = null
       --> _applyPhase8ConfidenceToPatterns()
           skips MCS bull/bear adjustment
           (CONF-7 silent skip)

  NOTE: No failure propagates to the user beyond console.warn
  and an optional session-once toast notification.
```

Source: `S1_api_pipeline_v7_sec9.md` §1.9.2 JS Runtime Impact diagram.

---

## 2.6 Sample Data Guard Pattern

### 2.6.1 The Guard Mechanism

Five JSON files carry a `source` field that gates their use in the JavaScript
confidence chain. The guard pattern is implemented in `appWorker.js` and follows
a consistent structure across all guarded files:

```
SAMPLE DATA GUARD PATTERN (pseudocode)
=======================================

  After fetch + JSON parse of {file}:

    if file.source === 'sample':
        variable = null          // nullify entirely
        log.warn("source=sample, skipping")

    if file.status === 'error':
        variable = null          // nullify entirely
        log.warn("status=error, skipping")

    if file.source === 'unavailable':
        variable = null          // specific to shortselling

    // Only non-null variable reaches the confidence chain.
    // Each confidence function checks variable !== null
    // before applying its adjustment factor.
```

### 2.6.2 Guarded Files and Failure Behavior

| File | Guard Field | Guard Value | Failure Behavior |
|------|------------|-------------|-----------------|
| `investor_summary.json` | `source` | `'sample'` | `_investorData = null`; CONF-5 skips foreign flow |
| `shortselling_summary.json` | `source` | `'sample'`, `'unavailable'` | `_shortSellingData = null`; CONF-5 skips short ratio |
| `derivatives_summary.json` | `source` | `'sample'`, `'demo'` | `_derivativesData = null`; CONF-5 skips basis/PCR |
| `flow_signals.json` | `status` | `'error'` | `_flowSignals = null`; CONF-7 skips HMM/flow bonuses |
| `options_analytics.json` | `status` | `'error'` | `_optionsAnalytics = null`; CONF-7 skips implied move |
| `macro_composite.json` | `source` | `'sample'`, `'demo'` | `_macroComposite.mcsV2 = null`; MCS adjustment skips |
| `market_context.json` | `source` | `'demo'` | `_marketContext` context reset; CCSI adjustment skips |

Source: `S1_api_pipeline_v7_sec5to8.md` §1.6.1-1.6.4; appWorker.js lines 318-325, 405-410.

### 2.6.3 Why `source === 'sample'` is a FAIL, Not a WARN

The `verify.py` CHECK 6 (Gate 1 of the quality gates system) treats `source ===
'sample'` as a FAIL for investor and shortselling files. The rationale:

- `appWorker.js` lines 318-325 null out `_investorData` when `source === 'sample'`.
  This is a known, documented code path that silently degrades the confidence chain.
- A WARN would allow the pipeline to pass verification while running without real
  investor data — invisible to the developer until pattern confidence scores are
  manually inspected.
- A FAIL forces the developer to confirm that the daily download ran successfully
  before the pipeline is considered production-ready.

This is one of five quality gates described in `.claude/rules/quality-gates.md`.

---

## 2.7 Staleness Detection: verify.py CHECK 6

### 2.7.1 The Pipeline Connectivity Gate

CHECK 6 is the sixth automated check in `scripts/verify.py`, added to enforce the
pipeline contract documented in `.claude/rules/quality-gates.md` Gate 1. It validates
12 JSON files across four dimensions:

| Dimension | Failure Mode | Severity |
|-----------|-------------|---------|
| File existence | File absent from disk | FAIL |
| Required key presence | Top-level key missing after JSON parse | WARN |
| Sample-data guard | `source === 'sample'` on guarded files | FAIL |
| Array non-empty | Expected array is empty list | WARN |
| Staleness | `updated`/`date` field older than 14 calendar days | WARN |
| Nested key path | `analytics.straddleImpliedMove` path broken | WARN |

### 2.7.2 The 12 Files Under Contract

```
CHECK 6 PIPELINE CONTRACT (12 files)
======================================

  File                                   Keys Required
  ---------------------------------------------------
  data/macro/macro_latest.json           updated, mcs, vix, bok_rate
  data/macro/bonds_latest.json           updated
  data/macro/kosis_latest.json           updated, source
  data/macro/macro_composite.json        mcsV2
  data/vkospi.json                       [array] close, time
  data/derivatives/derivatives_summary   [array] time
  data/derivatives/investor_summary      date, foreign_net_1d
                                         [FAIL if source=sample]
  data/derivatives/etf_summary           date
  data/derivatives/shortselling_summary  date, market_short_ratio
                                         [FAIL if source=sample]
  data/derivatives/basis_analysis        [array] basis, basisPct
  data/backtest/flow_signals             stocks, hmmRegimeLabel
                                         [FAIL if status=error]
  data/derivatives/options_analytics     analytics.straddleImpliedMove
```

### 2.7.3 What CHECK 6 Catches That No Prior Check Caught

Prior to CHECK 6, the following failure modes were invisible to `verify.py`:

| Scenario | Prior behavior | CHECK 6 behavior |
|----------|---------------|-----------------|
| investor_summary still has `source='sample'` after failed KRX download | No verify.py signal | FAIL |
| macro_composite.json missing `mcsV2` after schema change | No verify.py signal | WARN |
| vkospi.json is empty after download failure | No verify.py signal | WARN |
| macro_latest.json not refreshed in 3 weeks | No verify.py signal | WARN (14-day threshold) |

Source: `.claude/rules/quality-gates.md` Gate 1 §CHECK 6.

---

## 2.8 Three-Batch JavaScript Data Loader

### 2.8.1 Loader Architecture

The JavaScript pipeline loads data in three asynchronous batches, called from
`app.js init()` using `Promise.allSettled`. Each batch has a 5-minute TTL
(`_PIPELINE_LOAD_TTL = 300,000 ms`) to prevent re-fetching within the same session.

```
THREE-BATCH JS DATA LOADER
============================

  app.js init()
       |
       +-- _loadMarketData()     [Batch 1]
       |     |
       |     +-- macro_latest.json    --> _macroLatest
       |     +-- bonds_latest.json    --> _bondsLatest
       |     +-- kosis_latest.json    --> _kosisLatest
       |     +-- vkospi.json          --> injected into _macroLatest.vkospi
       |     |
       |     +-- _sendMarketContextToWorker()
       |     +-- Console: "[KRX] 매크로/채권 데이터 로드 완료"
       |
       +-- _loadDerivativesData() [Batch 2]
       |     |
       |     +-- derivatives_summary  --> _derivativesData
       |     +-- investor_summary     --> _investorData  (sample guard)
       |     +-- etf_summary          --> _etfData
       |     +-- shortselling_summary --> _shortSellingData (sample guard)
       |     +-- basis_analysis       --> merged into _derivativesData
       |     |
       |     +-- Console: "[KRX] 파생상품/수급 데이터 로드 완료 (N/4)"
       |
       +-- _loadPhase8Data()     [Batch 3]
             |
             +-- macro_composite      --> _macroComposite
             +-- flow_signals         --> _flowSignals
             +-- options_analytics    --> _optionsAnalytics
             |
             +-- _getPipelineHealth()
             |     Console: "[Pipeline] Health: N/12 OK"
             +-- Console: "[KRX] Phase 8 데이터 로드 완료 (N/3)"
```

Each fetch has a 5-second individual timeout. A fetch failure calls
`_notifyFetchFailure()` (session-once toast) and continues — the batch does not
abort on partial failure.

### 2.8.2 On-Demand Loaders

Four additional loaders fire outside the batch sequence:

| Loader | File | Trigger | Consumer |
|--------|------|---------|---------|
| `getFinancialData(code)` | `data/financials/{code}.json` | Stock selection | `financials.js` Column D |
| `_loadBehavioralData()` | `illiq_spread`, `hmm_regimes`, `csad_herding`, `disposition_proxy`, `survivorship_correction` | `backtester.init()` | Confidence chain CONF-8 |
| `_loadCAPMBeta()` | `data/backtest/capm_beta.json` | `backtester.init()` | CAPM beta + Merton DD display |
| `_loadMarketIndex()` | `data/market/kospi_daily.json` | `backtester.init()` | Beta regression benchmark |

Source: `S1_api_pipeline_v7_sec5to8.md` §1.7.

---

## 2.9 DART Financial Data Pipeline

### 2.9.1 Coverage and Fallback

DART (금융감독원 전자공시시스템) is the primary source for K-IFRS consolidated
financial statements (연결재무제표). Coverage is 95.3% of the DART-reporting universe:

| Category | Count |
|----------|-------|
| Stocks with DART financials (`source: 'dart'`) | 2,607 |
| Total DART-reporting universe | 2,736 |
| Coverage rate | 95.3% |
| Hardcoded fallback (Samsung 005930, SK Hynix 000660) | 2 |
| Seed-generated (hash PRNG, displayed as '---') | Remainder |

### 2.9.2 DART API Error Handling

`download_financials.py` follows the DART API v2 status code semantics:

| Status Code | Meaning | Handling |
|-------------|---------|---------|
| `"000"` | Success | Parse `list` array |
| `"013"` | No data for period (normal) | Skip quarter silently |
| `"010"` | API key error | Log + abort script |
| `"011"` | Daily quota exceeded | Log + sleep + retry |
| Other | Unexpected error | Log + continue to next stock |

Financial account matching uses Korean name-based mapping rather than numeric
account codes, because K-IFRS allows companies to use custom account names. The
mapping covers: 매출액 / 수익(매출액) / 영업수익 -> revenue; 영업이익 ->
operating income; 당기순이익 -> net income; 자본총계 -> total equity.

### 2.9.3 Unit Conversion

All raw DART values are denominated in KRW (원). Display conversion:

| Condition | Display format |
|-----------|---------------|
| Raw value |n| > 1,000,000 (억원 threshold) | Divide by 1e8, display as "X억원" |
| Display >= 10,000억 | Convert to "X.X조" |
| Display >= 100억 | Display as "X억" |

`toEok()` in `data.js` auto-detects the unit via the `|n| > 1,000,000` threshold.
This handles the mixed units that appear in DART filings (some companies report in
thousands of KRW, others in millions). Integer truncation via `Math.round()` is
applied — no floating-point residuals are shown.

Source: `.claude/rules/financial.md` Unit System; `S1_api_pipeline_v7_sec1to4.md` §1.4 DART section.

---

## Summary

Chapter 2 has established the following provenance and trust facts:

- Five external APIs (ECOS, FRED, KRX/pykrx, DART, KOSIS) feed 13 download scripts
  and 15 compute scripts, producing 60+ JSON files across six functional categories.
- Financial data follows a three-tier trust system (dart / hardcoded / seed). Seed
  data is displayed exclusively as `'---'`, enforced at three independent layers.
- The pipeline uses a fail-forward model: only the Step 0 health check is a hard
  gate; all 18 data steps degrade silently. Four P0 findings document the highest-risk
  silent failure vectors.
- Five JSON files carry `source`/`status` guard fields that nullify variables in the
  confidence chain when sample or error data is detected.
- `verify.py` CHECK 6 provides automated pipeline connectivity validation across
  12 contracted data files, catching silent degradation that no prior check detected.
- DART coverage is 95.3% (2,607/2,736), with KRW-denominated raw values converted
  to 억원 via the `|n| > 1,000,000` auto-detection threshold in `toEok()`.

Chapter 3 will document the confidence adjustment chain — the 10-function sequential
pipeline that transforms raw pattern detections into market-context-aware confidence
scores.
