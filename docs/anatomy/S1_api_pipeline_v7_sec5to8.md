# Stage 1 API Pipeline Anatomy -- Sections 1.5-1.8 (ANATOMY V7)

**Document version**: 2026-04-06
**Scope**: Compute scripts (post-download processing), JSON data file catalog,
JavaScript data loading pipeline, and quality gates.
**Complements**: `S1_api_pipeline.md` (sections 1.1-1.4: API inventory, download scripts,
rate limits, error handling).

---

## 1.5 Compute Scripts Catalog

All compute scripts live in `scripts/`. They read download-stage JSON files and produce
derived analytics JSON files. None hit external APIs -- they are pure offline transforms.
Every compute script uses **pure Python** (no scipy/numpy) unless otherwise noted.

### 1.5.1 compute_options_analytics.py

| Field | Value |
|-------|-------|
| **Input files** | `data/derivatives/options_latest.json` (option chain snapshot), `data/macro/bonds_latest.json` (KTB 3Y risk-free rate), `data/market/kospi200_daily.json` (spot index) |
| **Output file** | `data/derivatives/options_analytics.json` |
| **Key formulas** | BSM European option pricing: `C = S*e^(-qT)*N(d1) - K*e^(-rT)*N(d2)`, IV inversion via Brenner-Subrahmanyam (1988) initial guess + Newton-Raphson |
| **Metrics produced** | `straddleImpliedMove` (ATM straddle / spot %), `putCallRatio` (volume + OI), `skew25d` (25-delta put IV - call IV, %p), `atmIV` (annualized %), `termStructureSlope` (next - near ATM IV), `maxPainStrike` |
| **Academic source** | Black & Scholes (1973), Merton (1973), Brenner & Subrahmanyam (1988), Bates (1991), `core_data/45_option_pricing_strategy.md` |
| **Parameters** | `DIVIDEND_YIELD=0.017`, `DEFAULT_RF=0.035`, `NEWTON_MAX_ITER=50`, `NEWTON_TOL=1e-6`, `IV_LOWER=0.01`, `IV_UPPER=3.0` |
| **Source guards** | Rejects `options_latest.json` with `source` in `('sample','seed','demo')`. Rejects `bonds_latest.json` with same guard. |
| **Error handling** | Missing input -> writes `{status:'no_data', analytics:null}` (graceful null output). IV convergence failure -> skips option. Vega < 1e-12 -> breaks Newton loop. |
| **Upstream dependency** | `prepare_options_latest.py` must run first to transform `options_daily.json` -> `options_latest.json` |

### 1.5.2 prepare_options_latest.py (Bridge Script)

| Field | Value |
|-------|-------|
| **Input files** | `data/derivatives/options_daily.json` (full daily history), `data/market/kospi200_daily.json` (spot) |
| **Output file** | `data/derivatives/options_latest.json` |
| **Purpose** | Extracts latest trading day from options_daily.json, separates near/next month, maps fields (`optionType`->`type`, `strikePrice`->`strike`, `closePrice`->`close`), calculates `timeToExpiry` |
| **Error handling** | Missing input -> exit(1). Missing spot -> warning (analytics script has fallback). |

### 1.5.3 compute_bond_metrics.py

| Field | Value |
|-------|-------|
| **Input files** | `data/macro/bonds_latest.json` (yield snapshot), `data/macro/bonds_history.json` (monthly time series, unused currently) |
| **Output file** | `data/macro/bond_metrics.json` |
| **Key formulas** | Macaulay Duration: `D = (1/P) * sum(t * CF_t / (1+y/2)^t) / 2`, Modified Duration: `D_mod = D_mac / (1+y/2)`, DV01: `P * D_mod * 0.0001`, Convexity: `(1/P) * sum(t*(t+1) * CF_t / (1+y/2)^(t+2)) / 4` |
| **Metrics produced** | Per-benchmark (KTB 3Y/10Y/30Y): `macaulayDuration`, `modifiedDuration`, `dv01`, `convexity`. Curve shape: `classification` (normal/flat/inverted/humped), `slope_10y_3y`, `slope_30y_10y`, `curvature` (butterfly). Key Rate Durations: 7 tenors. |
| **Academic source** | Fabozzi (2007) ch.4, Macaulay (1938), Litterman & Scheinkman (1991), Ho (1992), `core_data/44_bond_pricing_theory.md` |
| **Parameters** | Semi-annual coupon convention. Par bond assumption (coupon=YTM). `DV01_BUMP_BP=1`. |
| **Source guards** | Rejects `bonds_latest.json` with `source` in `('sample','seed','demo')`. |
| **Error handling** | Missing file -> exit(1). Zero yields -> return 0 duration. |

### 1.5.4 compute_basis.py

| Field | Value |
|-------|-------|
| **Input files** | `data/derivatives/derivatives_summary.json` (actual basis, basisPct), `data/macro/bonds_latest.json` (KTB 3Y), `data/market/kospi200_daily.json` (spot backup) |
| **Output file** | `data/derivatives/basis_analysis.json` |
| **Key formula** | Cost-of-carry: `F* = S * exp((r - d) * T)`, excess basis = actual - theoretical, z-score = rolling 60-day standardization |
| **Metrics produced** | Per-date array: `fairValue`, `theoreticalBasis`, `excessBasis`, `excessBasisPct`, `basisZScore`, `timeToExpiryDays` |
| **Academic source** | Doc27 ss1.2 cost-of-carry model, Bessembinder & Seguin (1993) |
| **Parameters** | `DIVIDEND_YIELD=0.017`, `ZSCORE_WINDOW=60` |
| **Source guards** | Rejects both input files with `source` in `('sample','seed','demo')`. |
| **Error handling** | Missing input -> returns None. Spot <= 0 -> tries KOSPI200 daily fallback. Z-score requires >= 5 data points. |
| **Expiry calculation** | Second Thursday of month. If past expiry, uses next month. |

### 1.5.5 compute_macro_composite.py

| Field | Value |
|-------|-------|
| **Input files** | `data/macro/kosis_latest.json` (CLI, ESI, IPI), `data/macro/macro_latest.json` (BOK rate, CPI, exports), `data/macro/bonds_latest.json` (yield curve, credit spreads) |
| **Output file** | `data/macro/macro_composite.json` |
| **Key formulas** | MCS v2: weighted composite of 8 indicators (CLI 20%, ESI 15%, IPI 15%, CSI 10%, PMI 10%, exports 10%, unemployment_inv 10%, yield_spread 10%), range-normalized to 0-100. Taylor Rule: `r = r* + pi + 0.5*(pi - pi*) + 0.5*(y - y*)`. |
| **Metrics produced** | `mcsV2` (0-100), `taylorGap` (actual - Taylor rate), `yieldCurvePhase` (steepening/flattening/normal/inverted), `creditCyclePhase` (expansion/peak/contraction/trough) |
| **Academic source** | Taylor (1993), Estrella & Mishkin (1998), Bernanke & Gertler (1989), OECD CLI methodology, `core_data/29_behavioral_market_sentiment.md` |
| **Parameters** | `TAYLOR_R_STAR=0.5`, `TAYLOR_PI_STAR=2.0`, `TAYLOR_OUTPUT_GAP=0.0`. Normalization ranges: CLI [80,130], ESI [60,120], IPI [70,130], etc. |
| **Source guards** | Each of the 3 inputs independently guarded: `source` in `('sample','seed','demo')` -> nullified. |
| **Error handling** | All sources null -> writes `{status:'no_data', mcsV2:null}`. Missing indicators -> weight redistribution (proportional). Output validation: MCS outside [0,100] -> warning, Taylor gap |tg| > 5 -> warning. |
| **Note** | `ecos_latest.json` does NOT exist (documented phantom in C-3 fix). All ECOS fields aggregated in `macro_latest.json`. |

### 1.5.6 compute_flow_signals.py

| Field | Value |
|-------|-------|
| **Input files** | `data/investors/{code}.json` (per-stock investor flows), `data/backtest/hmm_regimes.json` (HMM regime labels), `data/index.json` (stock list) |
| **Output file** | `data/backtest/flow_signals.json` |
| **Key formulas** | Foreign momentum: 20-day MA of net foreign buy (buy/sell/neutral). Retail contrarian: top/bottom 5% percentile -> contrarian signal (Barber & Odean 2000). Institutional alignment: foreign + institution same direction. |
| **Metrics produced** | Per-stock: `foreignMomentum`, `retailContrarian`, `institutionalAlignment`, `hmmRegimeLabel`. Global: summary counts, `hmmRegimeLabel` (market-wide). |
| **Academic source** | Barber & Odean (2000), Froot et al. (2001), Hamilton (1989), `core_data/29` ss3, `core_data/35` ss4 |
| **Parameters** | `FOREIGN_MA_WINDOW=20`, `RETAIL_EXTREME_PCT=0.05`, `HMM_STALE_DAYS=30`, `MIN_FLOW_DAYS=10` |
| **Source guards** | `investor_summary.json` source='sample' -> global fallback skipped. Per-stock data required for flow signals (C-5 fix: no global fabrication). |
| **Error handling** | Missing `data/investors/` directory -> skips flow signals (only HMM label assigned). HMM stale > 30 days -> label = null. Stocks without investor data -> flow signals = null, only HMM label populated. |
| **Critical design**: Stocks without per-stock investor data receive `foreignMomentum: null` (not global market direction), preventing false confidence propagation to 2,600+ stocks. |

**V7 Market-Level Fallback:** When per-stock investor data is unavailable (`data/investors/{code}.json` missing), the pipeline falls back to market-level data:
- Source: `data/derivatives/investor_summary.json` field `total_trading_days`
- `effective_flow_count = market_flow_count` (typically ~30)
- `flowDataSource: "market_summary"` tag added to output
- **HMM regime:** Still applied (market-wide label available)
- **Per-stock bonuses:** Set to `null` (skipped) — only market-wide adjustment applies
- This ensures `flowDataCount > 0` passes the quality gate in `appWorker.js` line 534, enabling HMM regime multipliers even without granular per-stock data.

### 1.5.7 compute_capm_beta.py

| Field | Value |
|-------|-------|
| **Input files** | `data/index.json` (stock list + marketCap), `data/{market}/{code}.json` (per-stock OHLCV), `data/market/kospi_daily.json` + `kosdaq_daily.json` (market proxies), `data/macro/bonds_latest.json` (KTB 10Y for Rf), `data/financials/{code}.json` (total_liabilities for DD) |
| **Output file** | `data/backtest/capm_beta.json` |
| **Key formulas** | OLS beta: `beta = Cov(Ri,Rm) / Var(Rm)`. Scholes-Williams (1977) correction for thin trading: `beta_SW = (beta_lag + beta_0 + beta_lead) / (1 + 2*rho_m)`. Blume (1971) adjustment: `beta_adj = 0.67*beta + 0.33*1.0`. Merton DD: `DD = [ln(V/F) + (r - sigma_V^2/2)*T] / (sigma_V*sqrt(T))`. Jensen alpha: annualized `alpha * 250`, with t-stat and p-value. |
| **Metrics produced** | Per-stock: `beta`, `alpha`, `rSquared`, `thinTrading`, `nObs`, `betaBlume`, `alphaTstat`, `alphaPvalue`, `distanceToDefault`, `probDefault`, `ddGrade` (safe/caution/warning). Summary: KOSPI/KOSDAQ stats. |
| **Academic source** | Sharpe (1964), Lintner (1965), Scholes & Williams (1977), Merton (1974), Bharath & Shumway (2008), `core_data/25_capm_delta_covariance.md` |
| **Parameters** | `DEFAULT_WINDOW=250`, `MIN_OBS=60`, `THIN_TRADING_THRESH=0.10`, `DD_MIN_CANDLES=120`, `DD_DEFAULT_POINT_RATIO=0.75`, `DD_T=1`, `DD_DEBT_VOL=0.05` |
| **Source guards** | Financial data: rejects source not in `('dart','hardcoded','')`. Financial sectors excluded from DD (banks, insurance, securities -- debt=operating assets). |
| **Error handling** | Insufficient data -> skip. Zero variance market -> skip. Rf fallback: KTB 10Y -> macro_latest ktb10y -> 3.5%. |

### 1.5.8 compute_eva.py

| Field | Value |
|-------|-------|
| **Input files** | `data/index.json` (stock list), `data/financials/{code}.json` (DART financials), `data/backtest/capm_beta.json` (CAPM betas), `data/macro/macro_latest.json` (KTB 10Y for Rf) |
| **Output file** | `data/backtest/eva_scores.json` |
| **Key formulas** | NOPAT = OP * (1 - tax_rate). IC = equity + interest_bearing_debt. WACC = We*Re + Wd*Rd*(1-t). Re = Rf + beta*ERP (CAPM). EVA = NOPAT - WACC*IC. EVA Spread = ROIC - WACC. EVA Momentum = (EVA_t - EVA_{t-1}) / |IC_{t-1}|. |
| **Metrics produced** | Per-stock: `eva`, `evaSpread`, `roic`, `wacc`, `nopat`, `investedCapital`, `evaMomentum`. Summary: `positive_eva_pct`, mean/median/P25/P75 EVA spread. |
| **Academic source** | Stern Stewart & Co. (1991), Grant (2003), `core_data/14_apt_factor_model.md` ss2.8 |
| **Parameters** | `STATUTORY_TAX_RATE=0.22`, `EQUITY_RISK_PREMIUM=0.06`, `CORP_DEBT_SPREAD=0.015`, `INTEREST_BEARING_DEBT_RATIO=0.60`, `DEFAULT_RF_PCT=3.5`, `DEFAULT_BETA=1.0` |
| **Source guards** | Rejects financials with `source` in `('seed','demo')`. P0-fix: demo source also rejected (129 demo financials prevented from producing fake EVA). |
| **Error handling** | Missing financials -> skip. Zero/negative equity -> skip (capital erosion). Missing beta -> default 1.0. |

### 1.5.9 compute_hmm_regimes.py

| Field | Value |
|-------|-------|
| **Input files** | `data/index.json` (KOSPI stock list), `data/kospi/{code}.json` (per-stock OHLCV for cap-weighted proxy) |
| **Output file** | `data/backtest/hmm_regimes.json` |
| **Key formulas** | 2-state Gaussian HMM via Baum-Welch EM (50 iterations). State 0 = Bull (high mu, low sigma), State 1 = Bear (low mu, high sigma). Viterbi decoding for regime path. |
| **Metrics produced** | `parameters` (mu/sigma per state, transition matrix, average regime duration), `daily` (last 252 days: date, bull_prob, regime). |
| **Academic source** | Hamilton (1989), `core_data/21` sec 2 |
| **Parameters** | Initial: `mu=[0.001, -0.002]`, `sigma=[0.01, 0.02]`, `trans=[[0.98,0.02],[0.05,0.95]]`, `pi=[0.6,0.4]`. EM iterations: 50. |
| **Source guards** | Per-stock OHLCV: rejects `source` in `('sample','seed','demo')`. |
| **Error handling** | Fewer than 100 observations -> None. State labels auto-swapped if mu[0] < mu[1] (ensures state 0 = bull). |

### 1.5.10 compute_illiq_spread.py

| Field | Value |
|-------|-------|
| **Input files** | `data/index.json` (stock list), `data/{market}/{code}.json` (per-stock OHLCV) |
| **Output file** | `data/backtest/illiq_spread.json` |
| **Key formulas** | Amihud ILLIQ: `(1/D) * sum(|r_t| / DVOL_t)` (scaled to per-million-KRW). Roll (1984) spread: `S = 2 * sqrt(max(0, -Cov(dP_t, dP_{t-1})))`. |
| **Metrics produced** | Per-stock: `illiq_20d`, `illiq_60d`, `roll_spread`, `segment` (kospi_large/kospi_mid/kosdaq_large/kosdaq_small). Summary: per-segment mean/median/P25/P75. |
| **Academic source** | Amihud (2002), Roll (1984), `core_data/18` |
| **Source guards** | Per-stock OHLCV: rejects `source` in `('sample','seed','demo')`. |
| **Error handling** | < 30 candles -> skip. Zero DVOL -> skip observation. Non-negative autocovariance -> Roll spread = 0. |

### 1.5.11 compute_csad_herding.py

| Field | Value |
|-------|-------|
| **Input files** | `data/index.json`, `data/{market}/{code}.json` (all stocks OHLCV) |
| **Output file** | `data/backtest/csad_herding.json` |
| **Key formulas** | CSAD = (1/N) * sum(|R_i - R_m|). CCK regression: `CSAD = a + b1*|R_m| + b2*(R_m)^2 + e`. `b2 < 0` => herding (dispersion decreases in extreme markets). |
| **Metrics produced** | `daily` (last 252 days: csad, r_market, beta2_60d, herding_flag 0/1/2). Summary: herding_days, herding_pct, beta2 mean/median. |
| **Academic source** | Chang, Cheng & Khorana (2000), `core_data/19` sec 5.2 |
| **Parameters** | Rolling window: 60 days. Herding thresholds: beta2 < -0.003 extreme, < -0.001 mild. Min cross-section: 50 stocks. |
| **Source guards** | Per-stock OHLCV: rejects `source` in `('sample','seed','demo')`. |
| **Error handling** | OLS 3x3 Cramer's rule -- returns None if det < 1e-15. |

### 1.5.12 compute_disposition_proxy.py

| Field | Value |
|-------|-------|
| **Input files** | `data/index.json`, `data/{market}/{code}.json` (all stocks OHLCV) |
| **Output file** | `data/backtest/disposition_proxy.json` |
| **Key formula** | Disposition ratio = avg_volume_when_close > SMA(20)*1.01 / avg_volume_when_close < SMA(20)*0.99. D > 1 => sell winners, hold losers. |
| **Academic source** | Barberis & Xiong (2009), Frazzini (2006), Kahneman & Tversky (1979) lambda=2.25, `core_data/18` sec 5 |
| **Parameters** | Reference window: SMA(20). Gain/loss zone threshold: +/-1%. Min observations: 20 each side. |
| **Source guards** | Per-stock OHLCV: rejects `source` in `('sample','seed','demo')`. |

### 1.5.13 compute_hedge_ratio.py

| Field | Value |
|-------|-------|
| **Input files** | `data/market/kospi_daily.json` (spot), `data/derivatives/futures_daily.json` (futures), fallback: `data/derivatives/derivatives_summary.json` (futuresClose field) |
| **Output file** | `data/derivatives/hedge_analytics.json` |
| **Key formulas** | Minimum variance: `h* = Cov(DS,DF) / Var(DF)`. Hedge efficiency: `R^2 = Cov^2 / (Var_S * Var_F)`. Basis volatility: `std(basis) / mean(spot)`. |
| **Academic source** | Johnson (1960), Ederington (1979), Hull (2022) Ch.3, `core_data/25` ss3, `core_data/27` ss3.1 |
| **Parameters** | `DEFAULT_WINDOW=60`, `MIN_OBS=20` |
| **Source guards** | All inputs: rejects `source` in `('sample','seed','demo')`. |
| **[CRITICAL: No JS Consumer]** | `hedge_analytics.json` is not fetched by any JavaScript file. The output file itself does not exist on disk. Dead data path. |

### 1.5.14 compute_krx_anomalies.py

| Field | Value |
|-------|-------|
| **Input files** | `data/index.json`, `data/{market}/{code}.json` (all stocks OHLCV) |
| **Output file** | `data/backtest/krx_anomalies.json` |
| **Metrics produced** | `magnet_effect` (near-limit/limit-hit counts), `turn_of_month` (TOM premium, t-stat), `circuit_breakers` (Level 1/2/3 event counts) |
| **Academic source** | Du, Liu & Rhee (2009), Park & Byun (2022), Subrahmanyam (1994), `core_data/20` |
| **[CRITICAL: No JS Consumer]** | `krx_anomalies.json` is not fetched by any JavaScript file. Furthermore, `.cfignore` excludes it from deployment. Dead data path. |

### 1.5.15 compute_survivorship_correction.py

| Field | Value |
|-------|-------|
| **Input files** | `data/backtest/pattern_performance.json` (listed stocks), `data/backtest/delisted_pattern_performance.json` (delisted stocks) |
| **Output file** | `data/backtest/survivorship_correction.json` |
| **Key formula** | delta_wr = listed_wr - combined_wr (weighted by n). Global median delta used as correction factor. 95% CI for difference of proportions. |
| **Academic source** | Elton, Gruber & Blake (1996), JF 51(4):1097-1108 |
| **Parameters** | `MIN_DELISTED_N=30`, `HORIZONS=['1','3','5','10','20']` |

### 1.5.16 backtest_signals.py (V7)

| Field | Value |
|-------|-------|
| **Input files** | `data/index.json` (stock list), `data/{market}/{code}.json` (per-stock OHLCV) |
| **Output file** | `data/backtest/signal_wr.json` |
| **Method** | Indicator-proxy signal detection: 10 signals (`goldenCross`, `deadCross`, `macdBullishCross`, `macdBearishCross`, `rsiOversoldExit`, `rsiOverboughtExit`, `bbLowerBounce`, `bbUpperBreak`, `volumeBreakout`, `volumeSelloff`) x 5 forward horizons (1d, 3d, 5d, 10d, 20d) |
| **Universe** | 2,753 stocks (KOSPI + KOSDAQ), minimum 30 observations per signal/horizon |
| **Statistics** | Wilson score confidence interval, Cohen's h effect size, Bonferroni correction (alpha = 0.05/200 = 0.00025) |
| **Academic sources** | Wilson (1927) score interval, Cohen (1988) h effect size, Brock-Lakonishok-LeBaron (1992) null WR = 50% |
| **Consumed by** | `PATTERN_WR_KRX` in `signalEngine.js` (offline calibration -- values manually transferred to JS constants) |
| **Error handling** | Stocks with < 50 candles skipped. Signals with < 30 fires excluded from output. |

---

## 1.6 JSON Data File Catalog

Complete inventory of all JSON files in `data/` that participate in the pipeline
(excluding per-stock OHLCV files in `data/kospi/` and `data/kosdaq/`).

### 1.6.1 Top-level files

| File | Producer | JS Consumer Variable | JS Consumer File | Required Keys | Sample Guard |
|------|----------|---------------------|-----------------|---------------|-------------|
| `data/index.json` | `download_ohlcv.py` / `update_index_prices.py` | `ALL_STOCKS` | `api.js` | `stocks` or `data` | none |
| `data/vkospi.json` | `download_vkospi.py` | `_macroLatest.vkospi` (injected) | `appWorker.js:357` | array with `close`, `time` | none |
| `data/market_context.json` | `download_market_context.py` | `_marketContext` | `app.js:118` | `ccsi`, `vkospi`, `net_foreign_eok` | `source !== 'demo'` |
| `data/sector_fundamentals.json` | `download_sector.py` | `_sectorData` | `app.js:106` | sector->metrics map | none |
| `data/delisted_index.json` | `download_ohlcv.py --delisted` | none (offline only) | n/a | `total` | none |
| `data/historical_mcap.json` | `download_ohlcv.py` | none (offline only) | n/a | -- | none |
| `data/api_health.json` | `daily_update.bat` / healthcheck | none | n/a | -- | none |

### 1.6.2 data/macro/

| File | Producer | JS Consumer Variable | JS Consumer File | Required Keys | Sample Guard |
|------|----------|---------------------|-----------------|---------------|-------------|
| `macro_latest.json` | `download_macro.py` | `_macroLatest` | `appWorker.js:333` | `updated`, `mcs`, `vix`, `bok_rate` | none |
| `bonds_latest.json` | `download_bonds.py` | `_bondsLatest` | `appWorker.js:334` | `updated`, `yields` | none |
| `kosis_latest.json` | `download_kosis.py` | `_kosisLatest` | `appWorker.js:335` | `updated`, `source` | none |
| `macro_composite.json` | `compute_macro_composite.py` | `_macroComposite` | `appWorker.js:501` | `mcsV2` | `status !== 'error'`, `source !== 'sample'/'demo'` |
| `macro_history.json` | `download_macro.py` | none | n/a (offline) | -- | -- |
| `bonds_history.json` | `download_bonds.py` | none | n/a (offline) | -- | -- |
| `kosis_history.json` | `download_kosis.py` | none | n/a (offline) | -- | -- |
| `bond_metrics.json` | `compute_bond_metrics.py` | `_bondMetricsCache` | `financials.js:488` | `benchmarks`, `curveShape` | none |
| `ff3_factors.json` | `compute_ff3_factors.py` | `_ff3Cache` | `financials.js:305` | -- | none |

### 1.6.3 data/derivatives/

| File | Producer | JS Consumer Variable | JS Consumer File | Required Keys | Sample Guard |
|------|----------|---------------------|-----------------|---------------|-------------|
| `derivatives_summary.json` | `download_derivatives.py` | `_derivativesData` | `appWorker.js:405` | array with `time` | `source !== 'sample'/'demo'` |
| `investor_summary.json` | `download_investors.py` | `_investorData` | `appWorker.js:406` | `date`, `foreign_net_1d` | `source !== 'sample'` |
| `etf_summary.json` | `download_etf.py` | `_etfData` | `appWorker.js:407` | `date` | `source !== 'sample'/'demo'` |
| `shortselling_summary.json` | `download_shortselling.py` | `_shortSellingData` | `appWorker.js:408` | `date`, `market_short_ratio` | `source !== 'sample'/'unavailable'` |
| `basis_analysis.json` | `compute_basis.py` | merged into `_derivativesData` | `appWorker.js:455` | array with `basis`, `basisPct` | none |
| `options_analytics.json` | `compute_options_analytics.py` | `_optionsAnalytics` | `appWorker.js:503` | `analytics.straddleImpliedMove` | `status !== 'error'`, `source !== 'sample'/'demo'` |
| `options_latest.json` | `prepare_options_latest.py` | none (consumed by `compute_options_analytics.py` only) | n/a | `near`, `timeToExpiry` | `source` guard in compute script |
| `options_daily.json` | `download_derivatives.py` | none (consumed by `prepare_options_latest.py` only) | n/a | array with `time` | -- |
| `futures_daily.json` | `download_derivatives.py` | none (consumed by `compute_basis.py`, `compute_hedge_ratio.py`) | n/a | array with `time`, `close` | -- |
| `investor_daily.json` | `download_investors.py` | none (consumed by `compute_flow_signals.py`) | n/a | -- | -- |
| `etf_daily.json` | `download_etf.py` | none (offline) | n/a | -- | -- |
| `hedge_analytics.json` | `compute_hedge_ratio.py` | **[CRITICAL: Dead Data]** No JS consumer | n/a | -- | -- |

### 1.6.4 data/backtest/

| File | Producer | JS Consumer Variable | JS Consumer File | Required Keys | Sample Guard |
|------|----------|---------------------|-----------------|---------------|-------------|
| `flow_signals.json` | `compute_flow_signals.py` | `_flowSignals` | `appWorker.js:502` | `stocks`, `hmmRegimeLabel` | `status !== 'error'`, `flowDataCount > 0` quality gate |
| `capm_beta.json` | `compute_capm_beta.py` | `backtester._capmBeta`, `_capmBetaCache` | `backtester.js:167`, `financials.js:191,236` | `stocks` (object) | none |
| `eva_scores.json` | `compute_eva.py` | `_evaCache` | `financials.js:467` | `stocks` (object) | none |
| `hmm_regimes.json` | `compute_hmm_regimes.py` | `backtester._behavioralData['hmm_regimes']` | `backtester.js:212` (via _loadBehavioralData) | `daily` array | 30-day staleness gate |
| `illiq_spread.json` | `compute_illiq_spread.py` | `backtester._behavioralData['illiq_spread']` | `backtester.js:212` (via _loadBehavioralData) | `stocks` (object) | none |
| `csad_herding.json` | `compute_csad_herding.py` | `backtester._behavioralData['csad_herding']` | `backtester.js:212` (via _loadBehavioralData) | `summary`, `daily` | none |
| `disposition_proxy.json` | `compute_disposition_proxy.py` | `backtester._behavioralData['disposition_proxy']` | `backtester.js:212` (via _loadBehavioralData) | `stocks` (object) | H-12: loaded but currently unused |
| `survivorship_correction.json` | `compute_survivorship_correction.py` | `backtester._survivorshipCorr` | `backtester.js:128` | `global.delta_wr_median` | none |
| `rl_policy.json` | `compute_rl_policy.py` (offline) | `backtester._rlPolicy` | `backtester.js:244` | `thetas`, `action_factors`, `d` | IC < 0 -> rejected (P0-fix) |
| `rl_residuals_summary.json` | offline | displayed in panel | `patternPanel.js:1535` | -- | none |
| `pattern_performance.json` | `backtest_all.py` | offline only | n/a | -- | -- |
| `delisted_pattern_performance.json` | `backtest_all.py --delisted` | offline only (consumed by `compute_survivorship_correction.py`) | n/a | -- | -- |
| `aggregate_stats.json` | `backtest_all.py` | offline only | n/a | -- | -- |
| `delisted_aggregate_stats.json` | `backtest_all.py --delisted` | offline only | n/a | -- | -- |
| `calibrated_constants.json` | `calibrate_constants.py` | offline only | n/a | -- | -- |
| `composite_calibration.json` | offline calibration | offline only | n/a | -- | -- |
| `wc_calibration.json` | offline calibration | offline only | n/a | -- | -- |
| `wr_5year.json` | offline backtest | offline only | n/a | -- | -- |
| `theory_vs_actual.json` | offline backtest | offline only | n/a | -- | -- |
| `rl_context_stats.json` | offline | offline only | n/a | -- | -- |
| `rl_stage_b_results.json` | offline | offline only | n/a | -- | -- |
| `rl_stage_c1_results.json` | offline | offline only | n/a | -- | -- |
| `mra_*.json` (6 files) | MRA scripts | offline only | n/a | -- | -- |
| `krx_anomalies.json` | `compute_krx_anomalies.py` | **[CRITICAL: Dead Data]** No JS consumer. Excluded from deploy (.cfignore). | n/a | -- | -- |
| `signal_wr.json` | `backtest_signals.py` | Offline only (consumed by `PATTERN_WR_KRX` in signalEngine.js constants) | n/a | per-signal WR, CI, effect size | none |
| `dgrade_promotion_roadmap.json` | D-grade audit (offline analysis) | Offline only | n/a | 64 D-grade constant classifications | none |

### 1.6.5 data/market/

| File | Producer | JS Consumer Variable | JS Consumer File | Required Keys | Sample Guard |
|------|----------|---------------------|-----------------|---------------|-------------|
| `kospi_daily.json` | `download_market_index.py` | `backtester._marketIndex` | `backtester.js:184`, `financials.js:157,281` | array with `time`, `close` | none |
| `kosdaq_daily.json` | `download_market_index.py` | market context | `financials.js:157,281` | array with `time`, `close` | none |
| `kospi200_daily.json` | `download_market_index.py` | spot for options/basis scripts | `compute_options_analytics.py`, `compute_basis.py` (offline) | array with `time`, `close` | none |

### 1.6.6 data/financials/

| File Pattern | Producer | JS Consumer | Required Keys | Sample Guard |
|-------------|----------|-------------|---------------|-------------|
| `data/financials/{code}.json` (2,607 files) | `download_financials.py` (DART API) | `_financialCache` via `getFinancialData()` | `quarterly`/`annual` arrays, `source` | `source !== 'seed'` -> show as real. `source === 'seed'` -> all metrics '---' |

---

## 1.7 JavaScript Data Loading Pipeline

### 1.7.1 Three-Batch Async Loader Architecture

The JS data pipeline uses three async loader functions called from `app.js init()` in
parallel via `Promise.allSettled`. Each loader has a 5-minute TTL (`_PIPELINE_LOAD_TTL = 300000ms`)
to prevent duplicate fetches within the same session.

```
app.js init()
  |
  +-- _loadMarketData()      [Batch 1: macro + bonds + KOSIS + VKOSPI]
  +-- _loadDerivativesData()  [Batch 2: derivatives + investor + ETF + shortselling + basis]
  +-- _loadPhase8Data()       [Batch 3: macro_composite + flow_signals + options_analytics]
  |
  +-- (after all 3 complete) -> _runPipelineStalenessCheck()
```

Additionally, `app.js init()` directly loads:
- `data/sector_fundamentals.json` -> `_sectorData`
- `data/market_context.json` -> `_marketContext`

And `data.js getFinancialData()` loads per-stock financials on demand:
- `data/financials/{code}.json` -> `_financialCache[code]`

And `backtester.js init()` loads (via `_loadBehavioralData`, `_loadSurvivorshipCorrection`,
`_loadCAPMBeta`, `_loadMarketIndex`):
- `data/backtest/illiq_spread.json`
- `data/backtest/hmm_regimes.json`
- `data/backtest/disposition_proxy.json`
- `data/backtest/csad_herding.json`
- `data/backtest/survivorship_correction.json`
- `data/backtest/capm_beta.json`
- `data/market/kospi_daily.json`

And `financials.js` loads on demand:
- `data/backtest/capm_beta.json` -> `_capmBetaCache` (for DD + beta display)
- `data/backtest/eva_scores.json` -> `_evaCache` (for EVA display)
- `data/macro/bond_metrics.json` -> `_bondMetricsCache` (for DV01/duration display)
- `data/macro/ff3_factors.json` -> `_ff3Cache` (for FF3 factor display)
- `data/macro/macro_latest.json` -> for ERP calculation

### 1.7.2 Batch 1: _loadMarketData() (appWorker.js lines 327-389)

**Files fetched** (Promise.allSettled, 5s timeout each):

| # | URL | Variable | Pipeline Status Key |
|---|-----|----------|-------------------|
| 1 | `data/macro/macro_latest.json` | `_macroLatest` | `macro_latest` |
| 2 | `data/macro/bonds_latest.json` | `_bondsLatest` | `bonds_latest` |
| 3 | `data/macro/kosis_latest.json` | `_kosisLatest` | `kosis_latest` |
| 4 | `data/vkospi.json` | injected into `_macroLatest.vkospi` | `vkospi` |

**Post-load behavior**:
- VKOSPI latest close injected into `_macroLatest.vkospi` if not already set
- VKOSPI staleness: warn if > 7 days old
- Calls `_sendMarketContextToWorker()` to push vkospi/pcr/basis to Worker
- Calls `_getPipelineHealth()` and logs ok/total count
- Increments `_stalenessLoadersComplete` and calls `_runPipelineStalenessCheck()`

**Error handling**: Individual fetch failure -> `_notifyFetchFailure()` (session-once toast).
JSON parse error -> `console.warn()`. All failures -> pipeline continues without data
(graceful degradation).

### 1.7.3 Batch 2: _loadDerivativesData() (appWorker.js lines 399-487)

**Files fetched** (Promise.allSettled, 5s timeout each):

| # | URL | Variable | Pipeline Status Key |
|---|-----|----------|-------------------|
| 1 | `data/derivatives/derivatives_summary.json` | `_derivativesData` | `derivatives` |
| 2 | `data/derivatives/investor_summary.json` | `_investorData` | `investor` |
| 3 | `data/derivatives/etf_summary.json` | `_etfData` | `etf` |
| 4 | `data/derivatives/shortselling_summary.json` | `_shortSellingData` | `shortselling` |

**Post-fetch sequential** (after allSettled):

| # | URL | Merge Target | Pipeline Status Key |
|---|-----|-------------|-------------------|
| 5 | `data/derivatives/basis_analysis.json` | merged into `_derivativesData` (latest basis/basisPct) | `basis` |

**Sample guards** (post-load nullification):
- `_investorData.source === 'sample'` -> `_investorData = null`, status = `'sample'`
- `_shortSellingData.source === 'sample'` or `'unavailable'` -> null, status = source
- `_derivativesData.source === 'sample'` or `'demo'` (non-array only) -> null
- `_etfData.source === 'sample'` or `'demo'` -> null

**Basis merge logic**: If `_derivativesData` is array, merges into last element. If object,
merges directly. If null, creates `[{basis, basisPct}]`.

### 1.7.4 Batch 3: _loadPhase8Data() (appWorker.js lines 495-539)

**Files fetched** (Promise.allSettled, 5s timeout each):

| # | URL | Variable | Pipeline Status Key |
|---|-----|----------|-------------------|
| 1 | `data/macro/macro_composite.json` | `_macroComposite` | `macro_composite` |
| 2 | `data/backtest/flow_signals.json` | `_flowSignals` | `flow_signals` |
| 3 | `data/derivatives/options_analytics.json` | `_optionsAnalytics` | `options_analytics` |

**Quality gates** (post-load):
- `_macroComposite.status === 'error'` or source sample/demo -> null, status = `'rejected'`
- `_optionsAnalytics.status === 'error'` or source sample/demo -> null, status = `'rejected'`
- `_flowSignals.flowDataCount === 0` -> status = `'empty'` (HMM regime adjustments disabled;
  variable NOT nullified because hmmRegimeLabel is still valid market-wide)

### 1.7.5 _sendMarketContextToWorker() (appWorker.js lines 649-696)

Sends market context data to the analysis Worker for regime classification. Called from
both `_loadMarketData()` and `_loadDerivativesData()` (safe for duplicate calls).

**Data sent** (via `postMessage({type:'marketContext', ...})`):

| Field | Source | Fallback Chain |
|-------|--------|---------------|
| `vkospi` | `_marketContext.vkospi` -> `_macroLatest.vkospi` -> `_macroLatest.vix * VIX_VKOSPI_PROXY` | null if all absent |
| `pcr` | `_derivativesData[-1].pcr` | null |
| `basis` | `_derivativesData[-1].basis` | null |
| `basisPct` | `_derivativesData[-1].basisPct` | null |
| `leverageRatio` | `_etfData.leverageSentiment.leverageRatio` | null |
| `foreignAlignment` | `_investorData.alignment.signal_1d` or string | null |

### 1.7.6 Data Flow: JSON -> Global Variable -> Confidence Function

```
JSON File                   JS Global Variable        Confidence Adjustment Function
------                      ------------------        ------------------------------
macro_latest.json       ->  _macroLatest          ->  _applyMacroConfidenceToPatterns()
                                                      (9 factors: cycle, curve, credit, foreign,
                                                       pattern-specific, MCS, Taylor, VRP, rate_diff)
bonds_latest.json       ->  _bondsLatest          ->  _applyMacroConfidenceToPatterns()
                                                      (slope_10y3y, aa_spread, credit_regime)
market_context.json     ->  _marketContext         ->  _applyMarketContextToPatterns()
                                                      (CCSI, net_foreign, earning_season)
derivatives_summary     ->  _derivativesData       ->  _applyDerivativesConfidenceToPatterns()
  + basis_analysis          (basis/basisPct merged)    (7 factors: basis, PCR, investor, ETF,
investor_summary        ->  _investorData              shortselling, ERP, USD/KRW)
etf_summary             ->  _etfData
shortselling_summary    ->  _shortSellingData
macro_composite.json    ->  _macroComposite        ->  _applyPhase8ConfidenceToPatterns()
                                                      (MCS threshold, HMM regime mult,
flow_signals.json       ->  _flowSignals               foreign momentum bonus, implied move)
options_analytics.json  ->  _optionsAnalytics
capm_beta.json (DD)     ->  _currentDD             ->  _applyMertonDDToPatterns()
                            (via _calcNaiveDD)          (DD<2: buy discount, sell boost)
survivorship_correction ->  backtester._survivorCorr-> _applySurvivorshipAdjustment()
                                                      (buy patterns only, [0.92, 1.0] band)
hmm_regimes.json        ->  backtester._behavioral ->  backtester vol regime classification
illiq_spread.json       ->  backtester._behavioral ->  micro context ILLIQ/HHI
csad_herding.json       ->  backtester._behavioral ->  extreme herding discount
```

### 1.7.7 Confidence Adjustment Chain (execution order)

After Worker returns pattern analysis results, the main thread applies confidence
adjustments in this exact order (appWorker.js lines 105-124):

```
1. _applyMarketContextToPatterns()      -- market_context.json (CCSI, foreign, earning)
2. _classifyRORORegime() + _applyRORORegimeToPatterns() -- RORO 3-regime
3. _applyMacroConfidenceToPatterns()     -- macro_latest + bonds_latest (9 factors)
4. _updateMicroContext() + _applyMicroConfidenceToPatterns() -- ILLIQ, HHI
5. _applyDerivativesConfidenceToPatterns() -- derivatives + investor + ETF + shorts (7 factors)
6. _calcNaiveDD() + _applyMertonDDToPatterns() -- Merton DD credit risk
7. _applyPhase8ConfidenceToPatterns()    -- MCS + HMM + flow + options
8. _applySurvivorshipAdjustment()        -- buy pattern discount
9. _applyMacroConditionsToSignals()      -- signal-level adjustments
```

Each function applies multiplicative adjustments with individual clamp ranges:
- Market context: [0.55, 1.35]
- RORO: [0.92, 1.08]
- Macro: [0.70, 1.25]
- Derivatives: [0.70, 1.30]
- Merton DD: [0.75, 1.15]
- Phase 8: final clamp [10, 100]
- Survivorship: [0.92, 1.0]

---

## 1.8 Quality Gates & Staleness

### 1.8.1 Sample Data Guards

The JS pipeline rejects sample/fake data at two levels:

**Level 1: Load-time nullification** (appWorker.js loader functions)

| Variable | Guard Condition | Action |
|----------|----------------|--------|
| `_investorData` | `source === 'sample'` | Set to null, status = 'sample' |
| `_shortSellingData` | `source === 'sample'` or `'unavailable'` | Set to null, status = source |
| `_derivativesData` | non-array + `source === 'sample'` or `'demo'` | Set to null |
| `_etfData` | `source === 'sample'` or `'demo'` | Set to null |
| `_macroComposite` | `status === 'error'` or source sample/demo | Set to null, status = 'rejected' |
| `_optionsAnalytics` | `status === 'error'` or source sample/demo | Set to null, status = 'rejected' |
| `_flowSignals` | `flowDataCount === 0` | Status = 'empty' (not nullified; HMM label valid) |

**Level 2: Financial data trust system** (data.js `getFinancialData()`)

| Source Tier | Origin | Display Behavior |
|-------------|--------|-----------------|
| `'dart'` | DART API download | Full display OK |
| `'hardcoded'` | PAST_DATA constants (Samsung/SK Hynix) | Full display + warning |
| `'seed'` | Hash-based PRNG | **All metrics show '---'** -- never displayed as real |

Enforcement points:
- `financials.js`: PER/PBR/PSR/ROE display checks `cached.source`
- `appWorker.js _calcNaiveDD()`: requires `source === 'dart'` or `'hardcoded'`
- `appWorker.js _getFinancialDataForSR()`: same guard
- `compute_eva.py`: rejects `source in ('seed', 'demo')`
- `compute_capm_beta.py`: rejects source not in `('dart', 'hardcoded', '')`

### 1.8.2 Staleness Detection (_runPipelineStalenessCheck)

**Architecture**: Three loaders each increment `_stalenessLoadersComplete`. When counter
reaches 3, `_runPipelineStalenessCheck()` runs once (`_stalenessChecked = true` guard).

**Per-source staleness check** (`_checkDataStaleness()` utility):

| Source | Date Field | Is Array | >14 days | >30 days |
|--------|-----------|----------|----------|----------|
| `_macroLatest` | `updated` | No | console.warn | add to `_staleDataSources`, status='stale' |
| `_bondsLatest` | `updated` | No | warn | stale |
| `_kosisLatest` | `updated` | No | warn | stale |
| `_derivativesData` | `time` | Yes (last element) | warn | stale |
| `_investorData` | `date` | No | warn | stale |
| `_etfData` | `date` | No | warn | stale |
| `_shortSellingData` | `date` | No | warn | stale |
| `_flowSignals` | `generated` (fallback `updated`) | No | warn | stale |
| `_optionsAnalytics` | `generated` | No | warn | stale |

**Stale notification**: When `_staleDataSources.size > 0`, shows toast:
`"{N}개 데이터 소스 30일+ 경과"` and logs list to console.

**HMM-specific staleness** (backtester.js line 233): If `hmm_regimes.json` latest daily
entry is > 30 days old, the entire HMM data is set to null (disabled). This is separate
from the pipeline-wide staleness check.

### 1.8.3 Pipeline Status Tracking (_pipelineStatus)

12 data sources tracked in `appState.js` `_pipelineStatus` object:

```
macro_latest, bonds_latest, kosis_latest, macro_composite,
vkospi, derivatives, investor, etf, shortselling, basis,
flow_signals, options_analytics
```

**Status values**: `'ok'` (loaded and valid), `'missing'` (not loaded/fetch failed),
`'stale'` (> 30 days old), `'sample'` (sample data rejected), `'rejected'` (error/demo),
`'empty'` (valid structure but no real data), `'unavailable'` (source explicitly unavailable).

**Health function**: `_getPipelineHealth()` returns `{ok, stale, missing, sample, total}` counts.
Logged to console after each loader batch: `[Pipeline] Health: N/12 sources OK`.

### 1.8.4 Fetch Failure Toast Deduplication

`_fetchFailToasts` (Set) tracks which sources have shown failure toasts. Each source
gets exactly one toast per session, preventing toast spam when the same data source
is unavailable across multiple reloads.

### 1.8.5 verify.py CHECK 6: Pipeline Connectivity Test

`python scripts/verify.py --check pipeline` validates the JSON-to-JS contract:

| Validation | Check |
|------------|-------|
| File exists | All 12 pipeline JSON files must be present on disk |
| Required keys | Top-level keys checked per contract table |
| Sample guard | `investor_summary.json` source !== 'sample', `shortselling_summary.json` source !== 'sample' |
| Array non-empty | `vkospi.json`, `derivatives_summary.json`, `basis_analysis.json` |
| Staleness | `updated`/`date`/`generated` fields < 14 days |
| Nested path | `options_analytics.json`: `analytics.straddleImpliedMove` exists |
| Status guard | `flow_signals.json` status !== 'error', `options_analytics.json` status !== 'error' |

**What CHECK 6 catches**:
- `investor_summary.json` still contains sample data after failed KRX API run
- `macro_composite.json` missing `mcsV2` key after schema change
- `vkospi.json` empty array after VKOSPI download failure
- Data file not refreshed in 3+ weeks (stale macro adjustments applied to live patterns)

---

## Findings

### [CRITICAL: Dead Data] Files with no JS consumer

| File | Producer Script | Status |
|------|----------------|--------|
| `data/derivatives/hedge_analytics.json` | `compute_hedge_ratio.py` | Output file does not exist on disk. No JS fetch for this file anywhere in codebase. Dead compute path. |
| `data/backtest/krx_anomalies.json` | `compute_krx_anomalies.py` | File exists on disk but no JS fetch. Additionally excluded from deploy via `.cfignore`. Dead data. |
| `data/backtest/disposition_proxy.json` | `compute_disposition_proxy.py` | File loaded by `backtester._loadBehavioralData()` but marked H-12: "loaded for future Doc24 ss3 integration; currently unused". Semi-dead. |

### [CRITICAL: Missing Directory] data/investors/

`compute_flow_signals.py` reads per-stock investor data from `data/investors/{code}.json`.
This directory does not exist on disk. The script handles this gracefully (prints warning,
skips flow signals, only assigns HMM label), but all per-stock flow signals
(`foreignMomentum`, `retailContrarian`, `institutionalAlignment`) are always null.
The global fallback from `investor_summary.json` is intentionally NOT applied to
per-stock entries (C-5 fix: prevents false confidence propagation).

### Offline-Only JSON Files (no JS consumer by design)

These files are produced by compute/backtest scripts but consumed only by other Python
scripts or manual analysis. They are NOT bugs:

- `data/backtest/calibrated_constants.json`
- `data/backtest/composite_calibration.json`
- `data/backtest/wc_calibration.json`
- `data/backtest/wr_5year.json`
- `data/backtest/theory_vs_actual.json`
- `data/backtest/rl_context_stats.json`
- `data/backtest/rl_stage_b_results.json`
- `data/backtest/rl_stage_c1_results.json`
- `data/backtest/mra_*.json` (6 files)
- `data/backtest/pattern_performance.json`
- `data/backtest/delisted_pattern_performance.json`
- `data/backtest/aggregate_stats.json`
- `data/backtest/delisted_aggregate_stats.json`
- `data/macro/macro_history.json`
- `data/macro/bonds_history.json`
- `data/macro/kosis_history.json`
- `data/derivatives/options_daily.json`
- `data/derivatives/futures_daily.json`
- `data/derivatives/investor_daily.json`
- `data/derivatives/etf_daily.json`
- `data/historical_mcap.json`
- `data/delisted_index.json`
- `data/api_health.json`
- `data/.dart_corp_codes.json`
