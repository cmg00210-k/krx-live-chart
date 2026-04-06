# Section 1.9 -- Pipeline Reliability Audit

**Audit date**: 2026-04-06  
**Scope**: `daily_update.bat` (18-step pipeline), `auto_update.bat` (3-step hourly), `daily_deploy.bat` (6-step), `deploy.bat` (3-step), `verify.py` (9 checks), `stage_deploy.py`, `sw.js`, version sync chain  
**Auditor**: Code Audit Inspector  
**Status**: COMPLETE -- 4 P0 CRITICAL, 5 P1 HIGH, 8 P2 MEDIUM

---

## 1.9.1 Failure Mode Analysis -- daily_update.bat (18 Steps)

### Failure Model

`daily_update.bat` uses a two-tier error model:

- **Step 0 (API Health Check)**: Hard abort (`exit /b 1`) on failure. This is the ONLY gate-keeping step.
- **Steps 1-18**: All use `WARNING` + continue pattern. No step failure halts the pipeline.

This means the pipeline is **fail-forward by design** -- it will always run to completion (exit 0) even if every single download and compute step fails. The intent is resilience (partial data is better than no data), but this creates silent degradation.

### Per-Step Failure Analysis

| Step | Script | Exit on Fail? | Downstream Impact if Failed | Race Risk |
|------|--------|:---:|---|:---:|
| **0** | `krx_probe_phase0.py --quick --save-health` | **ABORT** | Entire pipeline halts. Writes `data/api_health.json`. | None |
| **1** | `download_kosis.py` | WARN | Step 15 (`compute_macro_composite.py`) reads stale `kosis_latest.json`. MCS v2 composite uses stale CSI/ESI/IPI. | None |
| **2** | `download_macro.py` | WARN | Step 15 uses stale `macro_latest.json`. Step 17 uses stale BOK rate for CAPM risk-free. JS `_macroLatest` stale. | None |
| **3** | `download_bonds.py` | WARN | Step 13 (`compute_bond_metrics.py`) reads stale `bonds_latest.json`. Step 12 uses stale risk-free rate. Step 15 uses stale credit spreads. | None |
| **4** | `download_market_context.py` | WARN | CCSI, VKOSPI proxy, investor flow base data stale. | None |
| **5** | `download_derivatives.py` | WARN | Step 11 (`prepare_options_latest.py`) reads stale `options_daily.json`. Step 14 (`compute_basis.py`) reads stale `derivatives_summary.json`. | None |
| **6** | `download_vkospi.py` + `download_etf.py` | WARN (ETF only) | See **P0-1** below. `download_vkospi.py` failure is SILENT. `vkospi.json` stale. `etf_summary.json` stale. | **YES** |
| **7** | `download_investor.py` + `download_shortselling.py` | WARN (shortselling only) | See **P0-2** below. `download_investor.py` failure is SILENT. Step 16 (`compute_flow_signals.py`) uses stale investor data. | **YES** |
| **8** | `download_ohlcv.py --cron --incremental` | WARN | Steps 9, 10, 17, 18 all depend on OHLCV data. Intraday generation uses stale daily candles. Index prices stale. CAPM beta uses stale returns. | None |
| **9** | `generate_intraday.py --timeframe 5m` | WARN | Only 5m bars generated (daily_deploy.bat generates 1m/5m/15m/30m/1h). Missing intraday granularity for clients. | None |
| **10** | `update_index_prices.py --offline` | WARN | `index.json` sidebar data stale (prevClose/change/volume). No FDR fallback (--offline flag). | None |
| **11** | `prepare_options_latest.py` | WARN | Step 12 (`compute_options_analytics.py`) has no input. BSM IV/Greeks/PCR calculations fail or produce stale output. | None |
| **12** | `compute_options_analytics.py` | WARN | `options_analytics.json` stale. JS `_optionsAnalytics` stale. Implied move/PCR/skew adjustments skip. | None |
| **13** | `compute_bond_metrics.py` | WARN | `bond_metrics.json` stale. Duration/Convexity/DV01 display stale. | None |
| **14** | `compute_basis.py` | WARN | `basis_analysis.json` stale. Futures basis z-score adjustments skip. | None |
| **15** | `compute_macro_composite.py` | WARN | `macro_composite.json` stale. MCS v2 score stale. Pattern confidence adjustments use old macro reading. | None |
| **16** | `compute_flow_signals.py` | WARN | `flow_signals.json` stale. HMM regime labels stale. Per-stock foreign momentum stale. | None |
| **17** | `compute_capm_beta.py` | WARN | `capm_beta.json` stale. CAPM beta display stale. Jensen's alpha stale. | None |
| **18** | `compute_eva.py` | WARN | `eva_scores.json` stale. EVA display stale. | None |

### Step Counter Mislabeling (P2)

Steps are labeled `[0/10]` through `[10/10]` for Phase 1 (downloads), then `[11/18]` through `[18/18]` for Phase 2 (compute). The labels claim "18 steps" in the banner but the numbering shows 19 steps (0 through 18). Step 0 is the API health check, making the actual count 19 execution units but 18 data pipeline steps. This is cosmetic but confusing in log review.

---

## 1.9.2 Error Propagation Map

### Dependency Graph

```
                        ┌─────────────────────────────────────────────────┐
    PHASE 1: DOWNLOAD   │                 PHASE 2: COMPUTE                │
    ════════════════     │                 ════════════════                 │
                        │                                                 │
    [0] API Health ─────┤ GATE (only hard abort point)                    │
                        │                                                 │
    [1] KOSIS ──────────┼──────────────────────────── [15] macro_composite│
    [2] Macro ──────────┼──────────────────────────── [15] macro_composite│
                        ├──────────────────────────── [17] capm_beta      │
    [3] Bonds ──────────┼──────────────────────────── [12] options_analytics│
                        ├──────────────────────────── [13] bond_metrics   │
                        ├──────────────────────────── [15] macro_composite│
    [4] Market Context ─┤ (no direct compute dependency)                  │
    [5] Derivatives ────┼─── [11] prepare_options ─── [12] options_analytics│
                        ├──────────────────────────── [14] compute_basis  │
    [6] VKOSPI + ETF ───┤ (data used by JS directly)                     │
    [7] Investor + SS ──┼──────────────────────────── [16] flow_signals   │
    [8] OHLCV ──────────┼──────────────────────────── [17] capm_beta      │
                        ├──────────────────────────── [18] compute_eva    │
    [9] Intraday ───────┤ (depends on [8], no compute downstream)        │
    [10] Index prices ──┤ (depends on [8], no compute downstream)        │
                        │                                                 │
                        │ Compute chain:                                  │
                        │ [11]→[12] (sequential dependency)               │
                        │ [13] standalone (bonds only)                    │
                        │ [14] standalone (derivatives only)              │
                        │ [15] standalone (macro+kosis+bonds)             │
                        │ [16] standalone (investor+hmm)                  │
                        │ [17] standalone (ohlcv+macro)                   │
                        │ [18] standalone (ohlcv+financials)              │
                        └─────────────────────────────────────────────────┘
```

### Single Points of Failure

1. **Step 0 (API Health Check)** -- If KRX API is down, the entire pipeline is blocked. No retry logic. No alternative data source fallback.

2. **Step 8 (OHLCV)** -- If this fails, Steps 9 (intraday), 10 (index prices), 17 (CAPM beta), and 18 (EVA) all operate on stale data. This is the highest fan-out failure point.

3. **Step 5 (Derivatives)** -- If this fails, both Step 11 (options prep) and Step 14 (basis) fail. Step 12 (options analytics) cascades via Step 11.

### JS Runtime Impact of Missing Data

```
Step fails → File stale/missing → JS loads null/stale → Confidence chain impact
═══════════════════════════════════════════════════════════════════════════════

[1]+[2]+[3] → macro_latest.json → _macroLatest = stale → _applyMacroConfidenceToPatterns() 
                                                           uses old KTB/VIX/CPI

[5]+[14] → basis_analysis.json → _derivativesData.basis = null → _applyDerivativesConfidenceToPatterns()
                                                                    skips basis spread adjustment

[7]+[16] → flow_signals.json → _flowSignals = stale → _applyPhase8ConfidenceToPatterns()
                                                        uses old HMM regimes

[15] → macro_composite.json → _macroComposite.mcsV2 = null → _applyPhase8ConfidenceToPatterns()
                                                                skips MCS bull/bear adjustment

[12] → options_analytics.json → _optionsAnalytics = null → Implied move adjustment skips

ALL: No error propagates to the user beyond console.warn + optional toast.
     Confidence chain degrades silently to base confidence without any data adjustments.
```

---

## 1.9.3 verify.py Coverage Audit

### CHECK 1 -- Pattern Registry (7 locations / 5 files)

**What it catches**: Missing pattern entries across `patterns.js analyze()`, `patternRenderer.js` (SINGLE/ZONE/CHART/CANDLE_PATTERN_TYPES/BULLISH/BEARISH/PATTERN_NAMES_KO), `backtester._META`, `patternPanel PATTERN_ACADEMIC_META`, `app _VIZ_CANDLE_TYPES/_VIZ_CHART_TYPES`. Handles D-tier exclusions via `_SUPPRESS_PATTERNS` and `_CONTEXT_ONLY_PATTERNS`.

**What it does NOT catch**:
- Pattern detection logic correctness (only checks registration, not algorithm validity)
- Pattern confidence range validity (could emit negative or >1.0 confidence)
- Pattern startIndex/endIndex boundary correctness

### CHECK 2 -- Hardcoded Color Constants

**What it catches**: Unapproved hex colors and rgba() values in 12 JS files. Whitelists from `colors.js` and `COLOR_EXCEPTIONS` dict.

**What it does NOT catch**:
- CSS `style.css` hardcoded colors (not scanned)
- Inline styles in `index.html` (not scanned)
- Color values constructed dynamically (e.g., string concatenation)

### CHECK 3 -- setLineDash Standardization

**What it catches**: Non-standard dash patterns in JS files.

**What it does NOT catch**:
- Dynamic dash patterns computed at runtime
- CSS `border-style: dashed` patterns

### CHECK 4 -- Script Load Order & Global Exports

**What it catches**: Missing JS files, wrong load order in `index.html`, missing global exports at module scope.

**What it does NOT catch**:
- Runtime initialization order violations (DOMContentLoaded vs deferred script execution)
- Conditional global assignments (e.g., `if (condition) var X = ...`)

### CHECK 5 -- Deployment & Script Health

**What it catches**:
- 5a: SW CACHE_NAME presence
- 5b: `verify.py` call in deploy bat files
- 5c: SRI integrity on CDN scripts
- 5d: Project name in deploy bat
- 5e: Non-ASCII chars in bat command lines
- 5f: `?v=N` sync between `index.html` and `analysisWorker.js importScripts`
- 5g: SW STATIC_ASSETS covers all index.html local scripts + CSS
- 5h: SW STATIC_ASSETS files exist on disk

**What it does NOT catch**:
- **P0-3**: `appWorker.js` Worker constructor version (`new Worker('js/analysisWorker.js?v=61')`) is NOT checked against any other version. This is a stale-cache vector: if `analysisWorker.js` is updated but `appWorker.js` line 38 is not bumped, browsers may load a cached old Worker.
- **P1-1**: `appUI.js` screenerWorker constructor version (`new Worker('js/screenerWorker.js?v=10')`) is NOT checked against index.html (screenerWorker has no `<script>` tag in index.html, so the 5f check does not apply).
- CACHE_NAME bump verification (only reports current value, does not detect stale deployments)
- CDN stylesheet SRI (Pretendard CSS has no `integrity` attribute -- line 21 of index.html)
- Google Fonts stylesheet SRI (not applicable for dynamically generated CSS)

### CHECK 6 -- JSON Pipeline Connectivity (19 data sources)

**What it catches**: File existence, required keys, sample/error/unavailable guards, staleness (14-day threshold), nested key paths (`analytics.straddleImpliedMove`), screenerWorker version sync.

**What it does NOT catch**:
- **P2-1**: Does not validate that compute script outputs match their declared schemas beyond top-level keys. For example, `macro_composite.json` could have `mcsV2: null` and still pass (key exists but value is null).
- Does not validate array element schemas beyond the last element (earlier elements could be malformed)
- Does not check `data/backtest/wr_5year.json` (fetched by `backtester.js` at runtime)
- Does not check `data/market/kospi200_daily.json` (used by `compute_basis.py` and `compute_options_analytics.py`)
- Does not check `data/investors/*.json` (per-stock investor data used by `compute_flow_signals.py`)

### CHECK 7 -- Global Name Collisions

**What it catches**: Same variable name declared in 2+ main-thread JS files.

**What it does NOT catch**: Worker-scope collisions between `analysisWorker.js` and `screenerWorker.js`.

### CHECK 8 -- Dead Global Exports

**What it catches**: Exported globals never referenced by any other file.

**What it does NOT catch**: Exported functions that are referenced but never actually called at runtime (dead code paths).

### CHECK 9 -- Canvas Safety

**What it catches**: `ctx.save()`/`ctx.restore()` imbalance, `ctx.scale(dpr)` without preceding `setTransform`.

**What it does NOT catch**:
- Missing `setLineDash([])` reset after dashed drawing
- Missing `globalAlpha = 1` reset after transparency changes

---

## 1.9.4 Version Sync Audit

### Three-Way Version Matrix (Current State)

**index.html script tags** (line 726-744):
```
colors.js?v=13, data.js?v=12, api.js?v=15, realtimeProvider.js?v=10,
indicators.js?v=27, patterns.js?v=45, signalEngine.js?v=42, chart.js?v=12,
patternRenderer.js?v=24, signalRenderer.js?v=12, backtester.js?v=40,
sidebar.js?v=12, patternPanel.js?v=22, financials.js?v=16, drawingTools.js?v=11,
appState.js?v=2, appWorker.js?v=7, appUI.js?v=1, app.js?v=35
```

**analysisWorker.js importScripts** (line 77-83):
```
colors.js?v=13, indicators.js?v=27, patterns.js?v=45,
signalEngine.js?v=42, backtester.js?v=40
```

**screenerWorker.js importScripts** (line 25-29):
```
colors.js?v=13, indicators.js?v=27, patterns.js?v=45,
signalEngine.js?v=42, backtester.js?v=40
```

**Worker constructor calls**:
- `appWorker.js:38` -- `new Worker('js/analysisWorker.js?v=61')`
- `appUI.js:3171` -- `new Worker('js/screenerWorker.js?v=10')`

**SW CACHE_NAME**: `cheesestock-v66`

### Sync Status

| Check | Status | Detail |
|-------|:------:|--------|
| index.html vs analysisWorker.js importScripts | **PASS** | 5/5 files match |
| index.html vs screenerWorker.js importScripts | **PASS** | 5/5 files match |
| Worker constructor `?v=N` (appWorker.js:38) | **INFO** | `v=61` -- this is a standalone cache-buster for the Worker file itself, not tied to any importScripts version. No automated check exists. |
| Worker constructor `?v=N` (appUI.js:3171) | **INFO** | `v=10` -- same pattern. |
| Pretendard CDN SRI | **FAIL** | Line 21: `<link>` has no `integrity` attribute. |
| LWC CDN SRI | **PASS** | Line 24-27: `integrity="sha384-..."` present. |
| Google Fonts SRI | **N/A** | Dynamic CSS -- SRI not applicable. |

### Gap: verify.py Does Not Check Worker Constructor Versions

`verify.py` CHECK 5f validates that `importScripts('FILE.js?v=N')` versions match `<script src="js/FILE.js?v=N">` tags. However, it does NOT validate the `new Worker('js/analysisWorker.js?v=61')` version in `appWorker.js:38` or the `new Worker('js/screenerWorker.js?v=10')` version in `appUI.js:3171`.

These Worker constructor `?v=N` values serve as cache busters for the Worker script itself. If `analysisWorker.js` content changes but the `?v=61` in `appWorker.js:38` is not bumped, browsers with an existing SW cache may continue loading the old Worker file.

In practice, the SW `ignoreSearch: true` matching (sw.js line 130) means the `?v=N` parameter on Worker constructor calls is **irrelevant for SW caching** but **still matters for browser HTTP cache**. The `_headers` file sets `max-age=3600` for `/js/*`, so a stale Worker constructor version can serve an old Worker for up to 1 hour.

---

## 1.9.5 Service Worker Cache Audit

### STATIC_ASSETS Coverage (sw.js lines 11-38)

**Listed assets (26 entries)**:
```
/, /index.html, /favicon.svg, /css/style.css,
/js/colors.js, /js/data.js, /js/api.js, /js/indicators.js,
/js/patterns.js, /js/signalEngine.js, /js/chart.js,
/js/patternRenderer.js, /js/signalRenderer.js, /js/backtester.js,
/js/sidebar.js, /js/patternPanel.js, /js/financials.js,
/js/drawingTools.js, /js/realtimeProvider.js,
/js/analysisWorker.js, /js/screenerWorker.js,
/js/appState.js, /js/appWorker.js, /js/appUI.js, /js/app.js,
/lib/lightweight-charts.standalone.production.js
```

**19 JS files from index.html**: All present in STATIC_ASSETS. PASS.  
**analysisWorker.js + screenerWorker.js**: Present (loaded by Worker constructor, not script tag). PASS.  
**css/style.css**: Present. PASS.  
**favicon.svg**: Present. PASS.  
**LWC local fallback**: `/lib/lightweight-charts.standalone.production.js` present. PASS.

### Orphaned Entry Check

All 26 STATIC_ASSETS entries exist on disk. No orphans. PASS.

### CACHE_NAME Bump History

Current: `cheesestock-v66`. The `_headers` file and SW activation logic properly clean old cache versions (sw.js lines 59-71). The `skipWaiting()` + `clients.claim()` pattern ensures immediate activation.

### Caching Strategy Review

| Path Pattern | Strategy | Correctness |
|:---|:---|:---|
| External CDN | Stale-While-Revalidate | OK -- serves cached font/LWC immediately, revalidates in background |
| `/data/*.json` | Network-First | OK -- prioritizes fresh data, falls back to cache offline |
| Static assets (JS/CSS/HTML) | Stale-While-Revalidate with `ignoreSearch: true` | OK -- `?v=N` params ignored for cache matching; background revalidation ensures eventual freshness |

### Potential Issue: `ignoreSearch: true` Makes `?v=N` Redundant for SW

The `ignoreSearch: true` option on line 130 means `/js/app.js?v=35` matches cached `/js/app.js` (without version). This is correct behavior for SWR strategy (the old version is served immediately, the new one is fetched in background). However, it means the `?v=N` parameter only affects:
1. First load (no cache yet)
2. Browser HTTP cache layer (governed by `_headers` `max-age=3600`)

This is working as designed per the sw.js comments.

---

## 1.9.6 Critical Findings

### P0 CRITICAL -- Pipeline-Breaking

**P0-1: `daily_update.bat` Step 6 -- `download_vkospi.py` failure is SILENT**

- **File**: `scripts/daily_update.bat`, lines 93-97
- **Problem**: Step 6 runs two scripts sequentially (`download_vkospi.py` then `download_etf.py`), but `if errorlevel 1` only checks the exit code of the LAST command (`download_etf.py`). If `download_vkospi.py` fails (exit code 1) but `download_etf.py` succeeds (exit code 0), the VKOSPI failure is completely silent -- no WARNING is logged.
- **Evidence**:
  ```bat
  "%PYTHON%" scripts/download_vkospi.py
  "%PYTHON%" scripts/download_etf.py
  if errorlevel 1 (
      echo [%date% %time%] WARNING: VKOSPI/ETF download failed
  )
  ```
  In Windows batch, `%ERRORLEVEL%` is set by the most recent command. The `if errorlevel 1` check after `download_etf.py` overwrites any error from `download_vkospi.py`.
- **Impact**: `data/vkospi.json` could silently become stale. JS falls back to VIX proxy without notice. VKOSPI regime classification degrades.
- **Fix**: Add separate error check after each script:
  ```bat
  "%PYTHON%" scripts/download_vkospi.py
  if errorlevel 1 (
      echo [%date% %time%] WARNING: VKOSPI download failed
  )
  "%PYTHON%" scripts/download_etf.py
  if errorlevel 1 (
      echo [%date% %time%] WARNING: ETF download failed
  )
  ```

**P0-2: `daily_update.bat` Step 7 -- `download_investor.py` failure is SILENT**

- **File**: `scripts/daily_update.bat`, lines 102-106
- **Problem**: Identical pattern to P0-1. `download_investor.py` and `download_shortselling.py` run sequentially, but only `download_shortselling.py` exit code is checked.
- **Evidence**:
  ```bat
  "%PYTHON%" scripts/download_investor.py
  "%PYTHON%" scripts/download_shortselling.py
  if errorlevel 1 (
      echo [%date% %time%] WARNING: Investor/ShortSelling download failed
  )
  ```
- **Impact**: `investor_summary.json` could silently remain `source: "sample"`. JS `_loadDerivativesData()` would null out `_investorData`, and `compute_flow_signals.py` (Step 16) would produce `flow_signals.json` with `flowDataCount: 0`. The entire HMM regime + foreign momentum adjustment chain silently degrades.
- **Fix**: Same as P0-1 -- separate error checks.

**P0-3: verify.py Does Not Validate Worker Constructor `?v=N`**

- **File**: `scripts/verify.py`, CHECK 5f (lines 646-670)
- **Problem**: CHECK 5f validates `importScripts` versions match `index.html` but does NOT check the Worker constructor URLs in `appWorker.js:38` (`new Worker('js/analysisWorker.js?v=61')`) or `appUI.js:3171` (`new Worker('js/screenerWorker.js?v=10')`). If `analysisWorker.js` is modified and version tags are bumped elsewhere but the Worker constructor URL is not updated, browsers may load a cached stale Worker via HTTP cache (up to `max-age=3600`).
- **Impact**: Stale Worker for up to 1 hour after deploy. Pattern analysis uses old code. Has been the source of version desync issues in past audits (documented in audit memory as recurring "Worker v=N desync").
- **Fix**: Add to CHECK 5f:
  ```python
  # Also check Worker constructor URLs in appWorker.js and appUI.js
  for host_file, pattern in [
      ("appWorker.js", r"Worker\(['\"]js/analysisWorker\.js\?v=(\d+)['\"]"),
      ("appUI.js",     r"Worker\(['\"]js/screenerWorker\.js\?v=(\d+)['\"]"),
  ]:
      host_path = JS / host_file
      if host_path.exists():
          host_src = read(host_path)
          m = re.search(pattern, host_src)
          if m:
              # No html_vers to compare -- just report the value
              ok(f"{host_file} Worker constructor ?v={m.group(1)}")
  ```

**P0-4: `daily_deploy.bat` Skips Compute Pipeline (Steps 11-18)**

- **File**: `scripts/daily_deploy.bat`, lines 27-47
- **Problem**: `daily_deploy.bat` runs OHLCV download + intraday + index update + sector fundamentals + deploy, but it completely SKIPS the 8 compute pipeline steps (Steps 11-18 from `daily_update.bat`). This means if `daily_deploy.bat` is used instead of running `daily_update.bat` first, the deployed data includes stale `options_analytics.json`, `basis_analysis.json`, `macro_composite.json`, `flow_signals.json`, `capm_beta.json`, and `eva_scores.json`.
- **Evidence**: `daily_deploy.bat` steps:
  ```
  [1/5] verify.py
  [2/5] download_ohlcv.py --cron
  [3/5] generate_intraday.py (5 timeframes)
  [4/6] update_index_prices.py
  [5/6] download_sector.py
  [6/6] stage_deploy.py + wrangler deploy
  ```
  No `compute_*.py` or `prepare_options_latest.py` calls.
- **Impact**: Deployments via `daily_deploy.bat` serve stale computed analytics. The step numbering is also inconsistent (`[1/5]` then `[4/6]` -- suggests steps were added without updating the denominator).
- **Fix**: Either (a) call `daily_update.bat` as the first step in `daily_deploy.bat`, or (b) add the 8 compute steps between download and deploy.

---

### P1 HIGH -- Data Quality Impact

**P1-1: `auto_update.bat` Has No Error Checking At All**

- **File**: `scripts/auto_update.bat`, lines 24-37
- **Problem**: The hourly auto-update script runs 3 steps (`download_ohlcv.py --top 100`, `update_index_prices.py`, `download_sector.py`) without ANY `if errorlevel` checks. All failures are completely silent. The script always exits 0.
- **Impact**: Scheduled hourly task (`CheeseStock_HourlyDeploy`) silently fails without any log indication. Since it runs under Task Scheduler with no console, failures are invisible.
- **Fix**: Add error checks and redirect output to a log file:
  ```bat
  "%PYTHON64%" scripts/download_ohlcv.py --top 100 --delay 0.2
  if errorlevel 1 echo [%date% %time%] WARNING: OHLCV top-100 download failed
  ```

**P1-2: Pretendard CDN CSS Missing SRI Integrity**

- **File**: `index.html`, line 21
- **Problem**: The Pretendard font CSS is loaded from jsDelivr CDN without `integrity` attribute:
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
  ```
  The LWC script (lines 24-27) has proper SRI. Google Fonts CSS cannot have SRI (dynamically generated). But Pretendard is a static CSS file that can and should have SRI.
- **Impact**: CDN compromise could inject malicious CSS/font. Low probability but security best practice violation.
- **Fix**: Add `integrity` and `crossorigin` attributes.

**P1-3: `daily_update.bat` Step Counter Inconsistency -- Phase 1 is 11 Steps, Not 10**

- **File**: `scripts/daily_update.bat`, lines 42-131
- **Problem**: Steps are labeled `[0/10]` through `[10/10]`, but there are actually 11 steps (0 through 10). The denominator `/10` is wrong. This creates confusion in log review:
  ```
  [0/10] API Health Check...
  [1/10] KOSIS download...
  ...
  [10/10] Index price update...
  ```
  Step 0 was added later without updating the denominator.
- **Impact**: Misleading log output. An operator reading `[10/10]` expects 10 steps but there are 11.
- **Fix**: Renumber to `[0/18]` through `[18/18]` for the full pipeline, matching the Phase 2 labeling.

**P1-4: `daily_deploy.bat` Step Counter Bug**

- **File**: `scripts/daily_deploy.bat`, lines 19-48
- **Problem**: Steps are numbered `[1/5]`, `[2/5]`, `[3/5]`, then suddenly `[4/6]`, `[5/6]`, `[6/6]`. The denominator changes from 5 to 6 mid-pipeline, suggesting steps were added without updating the earlier labels.
- **Fix**: Renumber consistently.

**P1-5: `daily_deploy.bat` Generates 1m/15m/30m Intraday But `stage_deploy.py` Excludes Them**

- **File**: `scripts/daily_deploy.bat`, lines 36-40 vs `scripts/stage_deploy.py`, lines 68-72
- **Problem**: `daily_deploy.bat` generates 1m, 5m, 15m, 30m, and 1h intraday files, but `stage_deploy.py` EXCLUDES `_1m.json`, `_15m.json`, and `_30m.json` by default. This means Steps 3 generates files that are immediately discarded during deploy staging. Wasted computation time (~minutes for 2,700+ stocks at each timeframe).
- **Impact**: Performance waste. The 1m/15m/30m intraday data is generated but never deployed.
- **Fix**: Either (a) remove 1m/15m/30m generation from `daily_deploy.bat` (matching `daily_update.bat` which only generates 5m), or (b) document that these files exist for local dev use only.

---

### P2 MEDIUM -- Cosmetic / Monitoring Gap

**P2-1: verify.py CHECK 6 Does Not Validate Value Nullability**

- **File**: `scripts/verify.py`, CHECK 6 (lines 793-901)
- **Problem**: CHECK 6 validates that required keys EXIST but does not check if their values are null/empty/zero. For example, `macro_composite.json` could contain `{"mcsV2": null}` and pass. JS code would then receive `null` for `_macroComposite.mcsV2`, and the `mcs >= MCS_THRESHOLDS.strong_bull` comparison (appWorker.js:565) would evaluate `null >= 70` as false, silently skipping MCS adjustment.
- **Fix**: Add optional value-validity check: `if check_target.get(key) is None: warn(...)`.

**P2-2: No Pipeline Logging to File**

- **File**: `scripts/daily_update.bat`
- **Problem**: All pipeline output goes to stdout/stderr. When run by Task Scheduler, output is lost unless the scheduler captures it. There is no `>> logs/pipeline.log 2>&1` redirect.
- **Impact**: When investigating pipeline failures days later, no log file exists to review.
- **Fix**: Add log redirection at the batch level or per-step.

**P2-3: `stage_deploy.py` Critical Files List is Incomplete**

- **File**: `scripts/stage_deploy.py`, lines 310-321
- **Problem**: The `CRITICAL_FILES` list checked post-staging includes only 13 files (index.html, sw.js, _headers, favicon.svg, css/style.css, and 7 JS files). It misses 12 JS files that are in STATIC_ASSETS: `data.js`, `api.js`, `realtimeProvider.js`, `indicators.js`, `patterns.js`, `signalEngine.js`, `patternRenderer.js`, `signalRenderer.js`, `backtester.js`, `sidebar.js`, `patternPanel.js`, `financials.js`, `drawingTools.js`. If any of these are excluded by an errant EXCLUDE rule, the deploy proceeds with missing critical files.
- **Fix**: Either expand the list to all 19 JS files + Workers, or dynamically derive it from STATIC_ASSETS.

**P2-4: No Retry Logic for Download Steps**

- **File**: `scripts/daily_update.bat`
- **Problem**: All download steps (1-10) are single-attempt. Network transients, API rate limits, or temporary KRX outages cause permanent failure for the day. No retry with backoff.
- **Fix**: Add retry wrapper. Example:
  ```bat
  for /L %%i in (1,1,3) do (
      "%PYTHON%" scripts/download_kosis.py && goto :kosis_done
      timeout /t 30 /nobreak >nul
  )
  :kosis_done
  ```

**P2-5: `compute_basis.py` References Non-Existent `data/market/kospi200_daily.json`**

- **File**: `scripts/compute_basis.py`, line 9
- **Problem**: The script's docstring declares it reads `data/market/kospi200_daily.json`, but this file does not exist in the data directory. The script likely has a fallback or generates it from other sources, but this is undocumented. verify.py CHECK 6 does not check this intermediate file.
- **Impact**: If the script truly needs this file and has no fallback, `compute_basis.py` fails silently (Step 14 is WARN-and-continue).

**P2-6: `compute_options_analytics.py` Also References `data/market/kospi200_daily.json`**

- **File**: `scripts/compute_options_analytics.py`, line 8
- **Problem**: Same as P2-5. Declared input file may not exist.

**P2-7: Stale `daily_update.bat` Banner Version**

- **File**: `scripts/daily_update.bat`, lines 14 and 203
- **Problem**: The banner says `v52, 18 steps` but the actual step count is 19 (0-18) and the pipeline version tracking is disconnected from any other versioning system. The "v52" is a human-maintained label with no automated verification.

**P2-8: `auto_update.bat` Does Not Run Compute Pipeline**

- **File**: `scripts/auto_update.bat`
- **Problem**: The hourly auto-update runs OHLCV (top 100 only), index prices, and sector fundamentals. It does NOT run any compute scripts or macro/derivatives downloads. This means hourly deploys serve potentially stale computed analytics all day long until the daily `daily_update.bat` runs.
- **Impact**: Intraday data freshness is good, but macro/derivatives/computed analytics are only as fresh as the last daily run.

---

## 1.9.7 Summary

### Severity Counts

| Severity | Count | Key Items |
|:---------|:-----:|:----------|
| P0 CRITICAL | 4 | Silent download failures (Steps 6, 7), missing Worker constructor version check, daily_deploy skips compute pipeline |
| P1 HIGH | 5 | auto_update no error checks, Pretendard missing SRI, step counter bugs, wasted intraday generation |
| P2 MEDIUM | 8 | Null value validation gap, no log files, incomplete critical files list, no retry, stale banner |

### Priority Fix Order

1. **P0-1 + P0-2**: Fix `daily_update.bat` Steps 6 and 7 to check each script's exit code independently. This is a 4-line fix that prevents silent data degradation.

2. **P0-4**: Either integrate compute steps into `daily_deploy.bat` or document that `daily_update.bat` must be run first. This is the highest-impact production issue.

3. **P0-3**: Add Worker constructor version validation to `verify.py` CHECK 5f. This prevents the recurring "Worker v=N desync" pattern documented across 10+ past audit sessions.

4. **P1-1**: Add error checks to `auto_update.bat`. The hourly scheduler currently has no failure visibility.

### Pass/Fail Verdicts

| Component | Verdict |
|:----------|:--------|
| `daily_update.bat` pipeline ordering | PASS -- dependencies are correctly sequenced |
| `daily_update.bat` error handling | **FAIL** -- Steps 6/7 have silent failures |
| `daily_deploy.bat` completeness | **FAIL** -- skips 8 compute steps |
| `auto_update.bat` error handling | **FAIL** -- no error checks at all |
| `verify.py` CHECK 1-4 | PASS |
| `verify.py` CHECK 5 (scripts) | PASS with GAP -- Worker constructor versions unchecked |
| `verify.py` CHECK 6 (pipeline) | PASS -- all 19 sources covered, guards working |
| `verify.py` CHECK 7-9 | PASS |
| `sw.js` STATIC_ASSETS | PASS -- all entries valid, no orphans |
| Version sync (3-way) | PASS -- importScripts match index.html |
| `stage_deploy.py` | PASS with GAP -- critical files list incomplete |
| `_headers` security | PASS |
