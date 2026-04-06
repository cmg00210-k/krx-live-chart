# Stage 1 API Pipeline Anatomy — CheeseStock (ANATOMY V5)

**Document version**: 2026-04-06  
**Scope**: Complete data pipeline from 8 external API sources through 18+ Python download
scripts, 8+ compute scripts, 25+ JSON output files, and JavaScript data loading with
3-tier cache.  
**Authority**: Findings section at the end flags dead endpoints, contract mismatches, and
missing quality gates found during this audit.

---

## 1.1 API Inventory

### API 1 — ECOS (한국은행 경제통계시스템)

| Field | Value |
|-------|-------|
| Base URL | `https://ecos.bok.or.kr/api` |
| Auth | API key in URL path: `/StatisticSearch/{API_KEY}/json/kr/...` |
| Key env var | `ECOS_API_KEY` (20-char uppercase) |
| Rate limit | 0.5s between calls (`RATE_LIMIT_SEC` in `api_constants.py`) |
| Timeout | 15s (`TIMEOUT_QUICK`) |
| URL template | `{BASE}/StatisticSearch/{KEY}/json/kr/{start}/{end}/{STAT_CODE}/{FREQ}/{START_YM}/{END_YM}/{ITEM_CODE}` |
| Error codes | `000`=OK, `INFO-200`=no data (normal), `010`=key error, `011`=quota |

**Callers**: `download_macro.py` (15 monthly ECOS series + 8 FRED series), `download_bonds.py`
(9 daily yield series), `download_market_context.py` (CCSI only)

**ECOS series used by `download_macro.py`** (all monthly, freq=`M`):

| Key | Stat Code | Item Code | Series Name |
|-----|-----------|-----------|-------------|
| `bok_rate` | `722Y001` | `0101000` | 한국은행 기준금리 |
| `ktb10y` | `721Y001` | `5050000` | 국고채 10년 (월별) |
| `ktb3y` | `721Y001` | `5020000` | 국고채 3년 (월별) |
| `m2` | `161Y006` | `BBHA00` | M2 광의통화 (평잔) |
| `cli` | `901Y067` | `I16A` | 경기선행지수 순환변동치 |
| `cpi` | `901Y009` | `0` | 소비자물가지수 총지수 |
| `bsi_mfg` | `512Y013` | `C0000/AA`* | 제조업 BSI 업황실적 |
| `export_value` | `901Y118` | `T002` | 통관기준 수출액 (천불) |
| `ipi` | `901Y033` | `A00/2`* | 산업생산지수 전산업 계절조정 |
| `foreign_equity` | `301Y013` | `BOPF22100000` | 외인 주식투자 순유입 (백만불) |
| `cd_rate_91d` | `721Y001` | `2010000` | CD금리 91일 |
| `cp_rate_91d` | `721Y001` | `4020000` | CP금리 91일 |
| `household_credit` | `151Y002` | `1110000` | 가계대출 예금취급기관 (십억원) |
| `unemployment_rate` | `901Y027` | `I61BC` | 실업률 |
| `house_price_idx` | `901Y064` | `P65A` | 주택매매가격 종합지수 (전국) |

*Item codes containing `/` must be URL-encoded with `urllib.parse.quote()` before
insertion in the URL path. `download_bonds.py` uses raw codes (daily stat `817Y002`
uses simple numeric codes; no slash encoding needed there).

**ECOS series used by `download_bonds.py`** (all daily, freq=`D`, stat code `817Y002`):

| Key | Item Code | Tenor | Notes |
|-----|-----------|-------|-------|
| `ktb_1y` | `010190000` | 1Y | 국고채 |
| `ktb_2y` | `010195000` | 2Y | 국고채 |
| `ktb_3y` | `010200000` | 3Y | 국고채 |
| `ktb_5y` | `010200001` | 5Y | 국고채 |
| `ktb_10y` | `010210000` | 10Y | 국고채 |
| `ktb_20y` | `010220000` | 20Y | 국고채 |
| `ktb_30y` | `010230000` | 30Y | 국고채 |
| `aa_minus` | `010300000` | 3Y | 회사채 AA- |
| `bbb_minus` | `010320000` | 3Y | 회사채 BBB- |

**IMPORTANT**: `817Y002` is daily-only. Monthly (`M`) requests return an error. The two
fetch functions for ECOS are intentionally separate: `download_macro.py::fetch_ecos_series`
handles monthly data with YYYYMM dates and URL-encodes slashes; `download_bonds.py::ecos_fetch`
handles daily data with YYYYMMDD dates and no slash encoding.

**ECOS series used by `download_market_context.py`** (monthly, stat `511Y002`):

| Key | G1 Code | G2 Code | Name |
|-----|---------|---------|------|
| `ccsi` | `FME` | `99988` | 소비자심리지수 (소비자동향조사) |

Range: 80–120 (100 = long-term average). Previously broken with wrong freq `MM`; fixed
to `M`.

**Deprecated ECOS codes (do not use)**:

| Code | Reason |
|------|--------|
| `101Y003` | Discontinued in 2004 (old M2 indicator) |
| `817Y002` with freq `M` | Daily-only table; monthly requests produce error |
| `BBGA00` (in `161Y006`) | Non-existent item code; correct code is `BBHA00` |

**Output files**:
- `data/macro/macro_latest.json` — JS global `_macroLatest` (appWorker.js)
- `data/macro/macro_history.json` — not consumed by JS (archival)
- `data/macro/bonds_latest.json` — JS global `_bondsLatest` (appWorker.js)
- `data/macro/bonds_history.json` — not consumed by JS (archival)
- `data/market_context.json` — JS global (appState.js `_marketContext`)

---

### API 2 — FRED (Federal Reserve Economic Data)

| Field | Value |
|-------|-------|
| Base URL | `https://api.stlouisfed.org/fred/series/observations` |
| Auth | `api_key` query parameter |
| Key env var | `FRED_API_KEY` (32-char alphanumeric lowercase) |
| Rate limit | 0.5s (shared with ECOS in `download_macro.py`) |
| Timeout | 15s (`TIMEOUT_QUICK`) |
| Params | `series_id`, `api_key`, `file_type=json`, `sort_order=desc`, `limit=100` |

**Series used** (all merged into `macro_latest.json`):

| Key | Series ID | Name |
|-----|-----------|------|
| `fed_rate` | `FEDFUNDS` | Federal Funds Rate |
| `us10y` | `DGS10` | US 10Y Treasury |
| `us_cpi` | `CPIAUCSL` | US CPI (seasonally adjusted) |
| `us_unemp` | `UNRATE` | US Unemployment Rate |
| `us_breakeven` | `T10YIE` | 10Y Breakeven Inflation |
| `us_hy_spread` | `BAMLH0A0HYM2` | US HY Credit Spread |
| `dxy_fred` | `DTWEXBGS` | Trade-Weighted USD Index |
| `vix_fred` | `VIXCLS` | VIX Daily Close (FRED backup) |

**Output**: merged into `data/macro/macro_latest.json` alongside ECOS fields.  
**JS consumer**: `_macroLatest.fed_rate`, `_macroLatest.vix_fred`, etc. (appWorker.js)

---

### API 3 — OECD SDMX (경기선행지수)

| Field | Value |
|-------|-------|
| Base URL | `https://stats.oecd.org/sdmx-json/data` |
| Auth | None (public endpoint) |
| Dataset | `MEI_CLI` (Main Economic Indicators — Composite Leading Indicators) |
| Series filter | `LOLITOAA.{COUNTRY_CODE}.M` |
| Accept header | `text/csv` |
| Timeout | 15s (`TIMEOUT_QUICK`) |

**Countries and output keys**:

| Key | Country Code | Name |
|-----|-------------|------|
| `korea_cli` | `KOR` | 한국 CLI |
| `china_cli` | `CHN` | 중국 CLI |
| `us_cli` | `USA` | 미국 CLI |

**Output**: merged into `data/macro/macro_latest.json`.  
**NOTE**: `download_macro.py::fetch_oecd_cli` validates CSV header columns
`TIME_PERIOD` and `OBS_VALUE` — a header change breaks the parser silently (returns
`None`). No automatic alert is raised when this happens.

---

### API 4 — KRX pykrx / FinanceDataReader (OHLCV)

| Field | Value |
|-------|-------|
| Library | `pykrx` (KRX scraping), `FinanceDataReader` (FDR, stock listing) |
| Auth | None (scraping-based, no API key) |
| Data type | Daily OHLCV per stock, market index |
| Rate limit | Implicit — no explicit throttle in `download_ohlcv.py` |

**Stock listing**: `fdr.StockListing('KOSPI')` and `fdr.StockListing('KOSDAQ')`.  
**OHLCV download**: `stock.get_market_ohlcv_by_date(start, end, code)` (pykrx).  
**Index download**: `fdr.DataReader('KS11'/'KQ11'/'KS200', start, end)` or
`pykrx_stock.get_index_ohlcv_by_date()` for KOSPI/KOSDAQ/KOSPI200.

**SPAC filter**: Stocks with `'스팩'` or `'SPAC'` in the name are excluded from OHLCV
downloads (technical analysis not applicable to pre-merge SPACs).

**Output files**:
- `data/kospi/{code}.json` — per-stock daily candles (KOSPI)
- `data/kosdaq/{code}.json` — per-stock daily candles (KOSDAQ)
- `data/index.json` — full stock index (code, name, market, sector, marketCap, etc.)
- `data/market/kospi_daily.json` — KOSPI index daily closes
- `data/market/kosdaq_daily.json` — KOSDAQ index daily closes
- `data/market/kospi200_daily.json` — KOSPI200 index daily closes

**JS consumer**: `dataService.getCandles(stock, timeframe)` in `api.js`, which reads
`data/{market}/{code}.json`.

---

### API 5 — KRX Open API (data-dbg.krx.co.kr)

| Field | Value |
|-------|-------|
| Base URL | `https://data-dbg.krx.co.kr/svc/apis` |
| Auth | `AUTH_KEY` request header |
| Key env var | `KRX_API_KEY` (40-char alphanumeric) |
| Daily quota | 10,000 calls/day (official); warning at 9,000 |
| Rate limit | 0.5s (community standard; `krx_api.py` default) |
| Timeout | connect 10s, read 60s (split timeout in `KRXClient`) |
| Retry | 3x exponential backoff on 5xx / timeout only |

**31 endpoints mapped in `krx_api.py::ENDPOINTS`** (subset actually used):

| Alias | Endpoint path | Used by |
|-------|--------------|---------|
| `idx_deriv` | `idx/drvprod_dd_trd` | `download_vkospi.py` |
| `futures_daily` | `drv/fut_bydd_trd` | `download_derivatives.py` |
| `options_daily` | `drv/opt_bydd_trd` | `download_derivatives.py` |
| `etf_daily` | `etp/etf_bydd_trd` | `download_etf.py` |

Additional unused endpoints mapped in `ENDPOINTS` dict: `idx_krx`, `idx_kospi`,
`idx_kosdaq`, `stock_daily`, `kosdaq_daily`, `bond_govt`, `bond_general`,
`futures_stock_kospi`, `futures_stock_kosdaq`, `options_stock_kospi`,
`options_stock_kosdaq`, `gold_daily`, `oil_daily`, `esg_sri_bond`, etc.

**Output files**:
- `data/vkospi.json` — VKOSPI daily series
- `data/derivatives/futures_daily.json` — KOSPI200 futures daily OHLCV
- `data/derivatives/options_daily.json` — KOSPI200 option chain daily
- `data/derivatives/etf_daily.json` — ETF price/NAV/volume daily
- `data/derivatives/derivatives_summary.json` — aggregated futures/options metrics

**JS consumer**: `_macroLatest.vkospi` (injected from `data/vkospi.json` in
`_loadMarketData()`), `_derivativesData` (from `derivatives_summary.json`)

---

### API 6 — KRX OTP (data.krx.co.kr — legacy 2-step)

| Field | Value |
|-------|-------|
| OTP URL | `http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd` |
| CSV URL | `http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd` |
| Auth | OTP token (no API key required) |
| User-Agent | `DEFAULT_USER_AGENT` from `api_constants.py` |
| Referer | `http://data.krx.co.kr` |

**Note**: HTTP (not HTTPS). This is the KRX legacy endpoint, still operational as of
2026-04.

**OTP stat codes used**:

| Script | Stat Code | Description |
|--------|-----------|-------------|
| `download_investor.py` | `MDCSTAT02301` | 투자자별 매매동향 (시장 전체) |
| `download_investor.py` | `MDCSTAT03602` | 종목별 외국인 보유현황 |
| `download_shortselling.py` | `MDCSTAT08601` | 공매도 거래현황 (전종목) |
| `download_shortselling.py` | `MDCSTAT08301` | 공매도 잔고현황 (전종목) |
| `download_vkospi.py` | `MDCSTAT01701` | VKOSPI 일별 (OTP fallback) |
| `download_derivatives.py` | `MDCSTAT12501` | 선물 일별 (OTP fallback) |
| `download_derivatives.py` | `MDCSTAT12601` | 옵션 일별 (OTP fallback) |

**Output files**:
- `data/derivatives/investor_daily.json` — per-market investor type daily
- `data/derivatives/foreign_flow.json` — per-stock foreign holding/net buy
- `data/derivatives/investor_summary.json` — aggregated investor flow signals
- `data/derivatives/shortselling_daily.json` — per-stock short selling daily
- `data/derivatives/shortselling_summary.json` — aggregated short interest signals

**JS consumer**: `_investorData`, `_shortSellingData` (appWorker.js `_loadDerivativesData`)

---

### API 7 — DART (전자공시시스템)

| Field | Value |
|-------|-------|
| Base URL | `https://opendart.fss.or.kr/api` |
| Auth | `crtfc_key` query parameter |
| Key env var | `DART_API_KEY` (40-char alphanumeric lowercase) |
| Rate limit | 0.5s between calls |
| Timeout | 15s quick, 30s normal |
| Error codes | `000`=OK, `013`=no data (normal), `010`=key error, `011`=quota |

**Endpoints used by `download_financials.py`**:

| Endpoint | Purpose | Key params |
|----------|---------|-----------|
| `/corpCode.xml` | corp_code lookup zip | `crtfc_key` |
| `/fnlttSinglAcnt.json` | financial statements | `crtfc_key`, `corp_code`, `bsns_year`, `reprt_code` |
| `/stockTotqySttus.json` | shares outstanding | `crtfc_key`, `corp_code`, `bsns_year`, `reprt_code` |
| `/company.json` | company info | `crtfc_key`, `corp_code` |

**Report codes**:

| Code | Report | Period |
|------|--------|--------|
| `11013` | 1분기보고서 | Q1 |
| `11012` | 반기보고서 | Q2 |
| `11014` | 3분기보고서 | Q3 |
| `11011` | 사업보고서 | Annual |

**Statement type priority**: CFS (연결재무제표) first, OFS (별도재무제표) fallback.

**Account name mapping** (`TARGET_ACCOUNTS` in `download_financials.py`):

| Korean account name | Internal key |
|--------------------|-------------|
| 매출액 / 수익(매출액) / 영업수익 | `revenue` |
| 영업이익 / 영업이익(손실) | `op` |
| 당기순이익 / 당기순이익(손실) | `ni` |
| 자산총계 | `total_assets` |
| 부채총계 | `total_liabilities` |
| 자본총계 | `total_equity` |
| 기본주당이익(손실) | `eps` |

**Output**: `data/financials/{code}.json` (one file per stock).  
**JS consumer**: `getFinancialData(code)` in `js/data.js`, which uses the 3-tier
fallback chain (DART JSON → hardcoded `PAST_DATA` → seed PRNG).

---

### API 8 — yfinance (USD/KRW, optional)

| Field | Value |
|-------|-------|
| Library | `yfinance` (Yahoo Finance wrapper) |
| Auth | None |
| Data | USD/KRW exchange rate (`USDKRW=X`) |
| Status | Optional import — `HAS_YFINANCE` flag in `download_macro.py` |

**Usage**: `yf.Ticker('USDKRW=X').history(period='3mo')` — provides `usdkrw` field
merged into `macro_latest.json`. Falls back to FDR or omission if yfinance is unavailable.

---

## 1.2 Download Scripts Matrix

| Script | Input API | Output JSON file(s) | Daily schedule step | Key config |
|--------|-----------|---------------------|--------------------|----|
| `download_ohlcv.py` | pykrx, FDR | `data/kospi/*.json`, `data/kosdaq/*.json`, `data/index.json` | Step 8 | `--incremental --years 1` in cron |
| `download_macro.py` | ECOS (15), FRED (8), OECD (3), yfinance | `data/macro/macro_latest.json`, `data/macro/macro_history.json`, `data/macro/ff3_factors.json` | Step 2 | `ECOS_API_KEY`, `FRED_API_KEY` |
| `download_bonds.py` | ECOS stat `817Y002` (9 daily) | `data/macro/bonds_latest.json`, `data/macro/bonds_history.json` | Step 3 | `ECOS_API_KEY` |
| `download_kosis.py` | KOSIS `DT_1C8016` (12 series) | `data/macro/kosis_latest.json`, `data/macro/kosis_history.json` | Step 1 | `KOSIS_API_KEY` |
| `download_market_context.py` | ECOS `511Y002` (CCSI) | `data/market_context.json` | Step 4 | `ECOS_API_KEY` |
| `download_derivatives.py` | KRX Open API (`drv/fut_bydd_trd`, `drv/opt_bydd_trd`); OTP fallback | `data/derivatives/futures_daily.json`, `data/derivatives/options_daily.json`, `data/derivatives/derivatives_summary.json` | Step 5 | `KRX_API_KEY` |
| `download_vkospi.py` | KRX Open API (`idx/drvprod_dd_trd`); OTP `MDCSTAT01701` fallback | `data/vkospi.json` | Step 6 | `KRX_API_KEY` |
| `download_etf.py` | KRX Open API (`etp/etf_bydd_trd`) | `data/derivatives/etf_daily.json`, `data/derivatives/etf_summary.json` | Step 6 | `KRX_API_KEY` |
| `download_investor.py` | KRX OTP `MDCSTAT02301`, `MDCSTAT03602` | `data/derivatives/investor_daily.json`, `data/derivatives/foreign_flow.json`, `data/derivatives/investor_summary.json` | Step 7 | No key (OTP) |
| `download_shortselling.py` | KRX OTP `MDCSTAT08601`, `MDCSTAT08301` | `data/derivatives/shortselling_daily.json`, `data/derivatives/shortselling_summary.json` | Step 7 | No key (OTP) |
| `download_financials.py` | DART `/fnlttSinglAcnt.json`, `/corpCode.xml` | `data/financials/{code}.json` | Manual / ad-hoc | `DART_API_KEY`, `--top N` |
| `download_sector.py` | Local: `data/index.json`, `data/financials/*.json` | `data/sector_fundamentals.json` | Manual | No API key |
| `download_market_index.py` | pykrx / FDR (market indices) | `data/market/kospi_daily.json`, `data/market/kosdaq_daily.json`, `data/market/kospi200_daily.json` | Not in `daily_update.bat` | `--years 2` |
| `generate_intraday.py` | Local: `data/{market}/{code}.json` | `data/{market}/{code}_{timeframe}.json` | Step 9 | `--timeframe 5m` in cron |
| `update_index_prices.py` | Local: `data/{market}/*.json` (OHLCV summary) | `data/index.json` (price update) | Step 10 | `--offline` in cron |

**NOTE**: `download_market_index.py` is not called in `daily_update.bat`. Market index
data (`data/market/kospi200_daily.json`) required by `compute_basis.py` and
`compute_options_analytics.py` is not refreshed during the daily pipeline — this is a
gap (see Findings section).

---

## 1.3 Compute Scripts Pipeline

### DAG Order (dependency → dependent)

```
Step 1-7 downloads complete
    |
    ├── Step 11: prepare_options_latest.py
    |       needs: options_daily.json, kospi200_daily.json
    |       ↓
    ├── Step 12: compute_options_analytics.py
    |       needs: options_latest.json, bonds_latest.json, kospi200_daily.json
    |
    ├── Step 13: compute_bond_metrics.py
    |       needs: bonds_latest.json, bonds_history.json
    |
    ├── Step 14: compute_basis.py
    |       needs: derivatives_summary.json, bonds_latest.json, kospi200_daily.json
    |
    ├── Step 15: compute_macro_composite.py
    |       needs: kosis_latest.json, macro_latest.json, bonds_latest.json
    |
    ├── Step 16: compute_flow_signals.py
    |       needs: data/investors/{code}.json*, hmm_regimes.json*, index.json
    |       (* per-stock investor data pipeline not implemented)
    |
    ├── Step 17: compute_capm_beta.py
    |       needs: data/kospi/*.json, data/kosdaq/*.json, index.json
    |       (macro_latest.json for risk-free rate)
    |
    └── Step 18: compute_eva.py
            needs: data/financials/{code}.json, capm_beta.json (for beta),
                   macro_latest.json (for risk-free rate)
```

**Compute scripts detail table**:

| Script | Input files | Output file | Algorithm | Academic ref |
|--------|-------------|-------------|-----------|-------------|
| `prepare_options_latest.py` | `derivatives/options_daily.json`, `market/kospi200_daily.json` | `derivatives/options_latest.json` | Latest-day extraction + field mapping + TTM calc | Bridge script (no academic basis) |
| `compute_options_analytics.py` | `derivatives/options_latest.json`, `macro/bonds_latest.json`, `market/kospi200_daily.json` | `derivatives/options_analytics.json` | BSM IV (Newton-Raphson 50 iter), Greeks, PCR, 25-delta skew, max pain | Black-Scholes (1973), Merton (1973), Brenner-Subrahmanyam (1988) |
| `compute_bond_metrics.py` | `macro/bonds_latest.json`, `macro/bonds_history.json` | `macro/bond_metrics.json` | Macaulay/Modified Duration, DV01 (+1bp bump), Convexity, NSS fitting (scipy optional), curve shape classification | Fabozzi (2007), core_data/44 |
| `compute_basis.py` | `derivatives/derivatives_summary.json`, `macro/bonds_latest.json`, `market/kospi200_daily.json` | `derivatives/basis_analysis.json` | Cost-of-carry: F* = S × exp((r-d)×T), excess basis z-score (60-day window) | Doc27 §1.2 |
| `compute_macro_composite.py` | `macro/kosis_latest.json`, `macro/macro_latest.json`, `macro/bonds_latest.json` | `macro/macro_composite.json` | MCS v2 weighted composite (8 factors, weights sum to 1.0), Taylor Rule gap, yield curve phase, credit cycle phase | Taylor (1993), Estrella-Mishkin (1998), OECD (2012) |
| `compute_flow_signals.py` | `data/investors/{code}.json`*, `backtest/hmm_regimes.json`, `index.json` | `backtest/flow_signals.json` | Foreign momentum (20-day MA), retail contrarian (top/bottom 5%), institutional alignment, HMM regime label injection | Barber-Odean (2000), Froot et al. (2001), Hamilton (1989) |
| `compute_capm_beta.py` | `data/kospi/*.json`, `data/kosdaq/*.json`, `index.json` | `backtest/capm_beta.json` | OLS beta (250-day window, min 60 obs), Scholes-Williams correction (>10% zero-return days), Merton DD (naive Bharath-Shumway 2008) | Sharpe (1964), Lintner (1965), Scholes-Williams (1977), Merton (1974) |
| `compute_eva.py` | `data/financials/{code}.json`, `backtest/capm_beta.json`, `macro/bonds_latest.json` | `backtest/eva_scores.json` | NOPAT = op × (1-tax), IC = equity + interest-bearing debt (≈ total_liabilities × 0.60), WACC = CAPM Re + Rd×(1-t), EVA = NOPAT - WACC×IC | Stern-Stewart (1991), core_data/14 §2.8 |
| `compute_hmm_regimes.py` | `data/index.json`, `data/kospi/*.json` | `backtest/hmm_regimes.json` | 2-state Gaussian HMM via Baum-Welch EM; cap-weighted KOSPI-proxy returns | Hamilton (1989) |

**Scripts in `scripts/` but not in `daily_update.bat`** (run manually or ad-hoc):

| Script | Purpose |
|--------|---------|
| `compute_hmm_regimes.py` | HMM regime fitting — referenced by `compute_flow_signals.py` but not scheduled |
| `compute_capm_beta.py` | Step 17 is in bat, but only runs after OHLCV; no market index download precedes it |
| `compute_csad_herding.py` | CSAD herding metric — not in pipeline |
| `compute_disposition_proxy.py` | Disposition effect proxy — not in pipeline |
| `compute_illiq_spread.py` | ILLIQ/bid-ask spread — not in pipeline |
| `compute_hedge_ratio.py` | Hedge ratio — not in pipeline |
| `compute_survivorship_correction.py` | Survivorship bias correction — not in pipeline |
| `compute_krx_anomalies.py` | KRX calendar anomalies — not in pipeline |
| `download_market_index.py` | Market index download — not in daily_update.bat |
| `download_delisted.py` | Delisted stock data — not scheduled |
| `download_historical_mcap.py` | Historical market cap — not scheduled |

---

## 1.4 JSON Schema Contracts

The following table documents all pipeline output files and validates them against the
Gate 1 (CHECK 6) pipeline contract in `.claude/rules/quality-gates.md`.

### Macro data files

| File | Type | Required top-level keys | Sample guard | Gate 1 | Actual keys (verified) |
|------|------|------------------------|-------------|--------|------------------------|
| `data/macro/macro_latest.json` | Object | `updated`, `mcs`, `vix`, `bok_rate` | none | Required | `updated`, `ktb10y`, `ktb3y`, `bok_rate`, `fed_rate`, `vix`, `dxy`, `usdkrw`, `foreigner_signal`, ... |
| `data/macro/bonds_latest.json` | Object | `updated` | none | Required | `updated`, `yields`, `credit_spreads`, `nss_params`, `slope_10y3y`, `slope_10y2y`, `curve_inverted`, `yield_curve`, `credit_regime`, `metrics`, `_validation` |
| `data/macro/kosis_latest.json` | Object | `updated`, `source` | none | Required | `updated`, `source`, `cli_composite`, `esi`, `cci_composite`, `ipi_all`, `retail_sales`, ... |
| `data/macro/macro_composite.json` | Object | `mcsV2` | `status` | Required | `generated`, `lastUpdated`, `status`, `mcsV2`, `mcsComponents`, `mcsAvailable`, `taylorGap`, `yieldCurvePhase`, `creditCyclePhase`, `parameters` |
| `data/macro/bond_metrics.json` | Object | none in Gate 1 | none | Not in Gate 1 | `benchmarks`, `curveShape`, `keyRateDurations` |
| `data/macro/ff3_factors.json` | Object | none in Gate 1 | none | Not in Gate 1 | FF3 factor data |

**Mismatch 1**: Gate 1 requires `mcs` and `vix` as top-level keys in `macro_latest.json`.
Actual file uses `vix` (from FRED `vix_fred` field remapped) but does not have a `mcs`
key. The field appears to be `foreigner_signal` (a UIP composite) rather than an MCS
score. See Findings section.

### Market / VKOSPI files

| File | Type | Required keys (Gate 1) | Sample guard | Actual keys |
|------|------|----------------------|-------------|------------|
| `data/vkospi.json` | Array | `close`, `time` (per element) | none | `time`, `open`, `high`, `low`, `close` |
| `data/market_context.json` | Object | none in Gate 1 | none | `generated_at`, `source`, `ccsi`, `vkospi`, `net_foreign_eok`, `earning_season` |

### Derivatives files

| File | Type | Required keys (Gate 1) | Sample guard | Actual keys |
|------|------|----------------------|-------------|------------|
| `data/derivatives/derivatives_summary.json` | Array | `time` (per element) | none | `time`, `futuresClose`, `futuresVolume`, `futuresOI`, `basis`, `basisPct`, `totalCallVolume`, `totalPutVolume`, `totalCallOI`, ... |
| `data/derivatives/investor_summary.json` | Object | `date`, `foreign_net_1d` | `source` | `generated_at`, `latest_date`, `date`, `source`, `foreign`, `institutional`, `retail`, `foreign_net_1d`, `foreign_net_5d`, ... |
| `data/derivatives/etf_summary.json` | Object | `date` | none | `date`, `totalETFs`, `topByVolume`, `topByAUM`, `premiumAnomalies`, `leverageSentiment` |
| `data/derivatives/shortselling_summary.json` | Object | `date`, `market_short_ratio` | `source` | `updated`, `date`, `source`, `market_short_ratio`, `market_short_ratio_5d_ma`, `top_sir_stocks`, `squeeze_candidates`, ... |
| `data/derivatives/basis_analysis.json` | Array | `basis`, `basisPct` (per element) | none | `time`, `spot`, `futuresClose`, `basis`, `basisPct`, `fairValue`, `theoreticalBasis`, `excessBasis`, `basisZScore`, ... |
| `data/derivatives/options_analytics.json` | Object | `analytics.straddleImpliedMove` (nested) | `status` | `generated`, `status`, `analytics.straddleImpliedMove`, `analytics.putCallRatio`, `analytics.skew25d`, ... |
| `data/derivatives/options_latest.json` | Object | none in Gate 1 | none | intermediate transform file |

### Backtest / flow files

| File | Type | Required keys (Gate 1) | Sample guard | Actual keys |
|------|------|----------------------|-------------|------------|
| `data/backtest/flow_signals.json` | Object | `stocks`, `hmmRegimeLabel` | `status` | `generated`, `status`, `stockCount`, `flowDataCount`, `hmmRegimeLabel`, `hmmLatestDate`, `summary`, `parameters`, `stocks` |
| `data/backtest/capm_beta.json` | Object | none in Gate 1 | none | `summary`, `stocks` |
| `data/backtest/eva_scores.json` | Object | none in Gate 1 | none | `generated`, `summary`, `stocks` |
| `data/backtest/hmm_regimes.json` | Object | none in Gate 1 | none | HMM state labels |

### OHLCV candle format (per-stock JSON)

Each `data/kospi/{code}.json` and `data/kosdaq/{code}.json` follows:
```json
{
  "code": "005930",
  "name": "삼성전자",
  "market": "KOSPI",
  "source": "pykrx",
  "candles": [
    { "time": "2025-01-02", "open": 54200, "high": 55000, "low": 53800, "close": 54600, "volume": 12345678 }
  ]
}
```

---

## 1.5 JavaScript Data Loading

### 3-Tier Cache System (`js/api.js`)

| Tier | Storage | Key | TTL | Miss action |
|------|---------|-----|-----|------------|
| L1 | In-memory `KRXDataService.cache` object | `"{code}-{timeframe}"` | `MAX_CANDLES_DAILY=2000` entries cap | L2 lookup |
| L2 | IndexedDB (`krx_cache` DB, `candles` store) | `"{code}-{timeframe}"` | Persistent (no expiry) | L3 network fetch |
| L3 | Network fetch `data/{market}/{code}.json` | URL path | None | Demo mode fallback |

**IndexedDB implementation** (`_idb` singleton in `api.js`):
- DB name: `krx_cache`, store: `candles`, version: `1`
- All ops are async + fail-silent (private browsing safe)
- `_idb.get(key)` / `_idb.set(key, value)` used by `dataService.getCandles()`

**Memory cap**: `MAX_CACHE_ENTRIES = 50` (LRU eviction in `KRXDataService`).  
**Max candles**: `MAX_CANDLES_DAILY = 2000` (~8 years), `MAX_CANDLES_INTRADAY = 500`.

---

### Loader 1 — `_loadMarketData()` (appWorker.js)

**TTL guard**: 5 minutes (`_PIPELINE_LOAD_TTL`). Re-entry within TTL is a no-op.  
**Trigger**: Called from stock selection flow (`selectStock()` in `appUI.js`).

| Fetch | URL | Timeout | JS global assigned | Status key |
|-------|-----|---------|-------------------|-----------|
| Parallel | `data/macro/macro_latest.json` | 5s | `_macroLatest` | `_pipelineStatus.macro_latest` |
| Parallel | `data/macro/bonds_latest.json` | 5s | `_bondsLatest` | `_pipelineStatus.bonds_latest` |
| Parallel | `data/macro/kosis_latest.json` | 5s | `_kosisLatest` | `_pipelineStatus.kosis_latest` |
| Sequential | `data/vkospi.json` | 5s | `_macroLatest.vkospi` (injected) | `_pipelineStatus.vkospi` |

**Post-load actions**:
1. Injects VKOSPI close into `_macroLatest.vkospi` if not already present.
2. Warns if VKOSPI data is >7 days old.
3. Calls `_sendMarketContextToWorker()` to pass macro context to Web Worker.
4. Calls `_runPipelineStalenessCheck()` (staleness counter increment).
5. Logs pipeline health summary.

**Failure handling**: `_notifyFetchFailure(name)` (toast, once per session per source).
JSON parse errors are caught individually per fetch result; a parse failure on one file
does not abort the others.

---

### Loader 2 — `_loadDerivativesData()` (appWorker.js)

**TTL guard**: 5 minutes.

| Fetch | URL | Timeout | JS global assigned | Sample guard |
|-------|-----|---------|-------------------|-------------|
| Parallel | `data/derivatives/derivatives_summary.json` | 5s | `_derivativesData` | `source === 'sample'/'demo'` → null |
| Parallel | `data/derivatives/investor_summary.json` | 5s | `_investorData` | `source === 'sample'` → null |
| Parallel | `data/derivatives/etf_summary.json` | 5s | `_etfData` | `source === 'sample'/'demo'` → null |
| Parallel | `data/derivatives/shortselling_summary.json` | 5s | `_shortSellingData` | `source === 'sample'/'unavailable'` → null |
| Sequential | `data/derivatives/basis_analysis.json` | 5s | merged into `_derivativesData` | none |

**Post-load actions**:
1. Sample/demo data guards null out variables (silent warning to console).
2. `basis_analysis.json` latest record merged into `_derivativesData` last element.
3. Calls `_sendMarketContextToWorker()`.
4. Calls `_runPipelineStalenessCheck()`.

---

### Loader 3 — `_loadPhase8Data()` (appWorker.js)

**TTL guard**: 5 minutes.

| Fetch | URL | Timeout | JS global assigned | Guards |
|-------|-----|---------|-------------------|--------|
| Parallel | `data/macro/macro_composite.json` | 5s | `_macroComposite` | `status === 'error'` or `source === 'sample'/'demo'` → null |
| Parallel | `data/backtest/flow_signals.json` | 5s | `_flowSignals` | `flowDataCount === 0` → warning (not null) |
| Parallel | `data/derivatives/options_analytics.json` | 5s | `_optionsAnalytics` | `status === 'error'` or `source === 'sample'/'demo'` → null |

**Post-load actions**:
1. Applies Phase 8 confidence adjustments via `_applyPhase8ConfidenceToPatterns()`.
2. Calls `_runPipelineStalenessCheck()`.

**Staleness check** (`_runPipelineStalenessCheck()`): Fires once, after all 3 loaders
complete (counter reaches 3). Checks all loaded globals for >14-day age (warn) and
>30-day age (add to `_staleDataSources`, toast). Staleness check date fields:

| Global | Date field | Array? |
|--------|-----------|--------|
| `_macroLatest` | `updated` | no |
| `_bondsLatest` | `updated` | no |
| `_kosisLatest` | `updated` | no |
| `_derivativesData` | `time` | yes (last element) |
| `_investorData` | `date` | no |
| `_etfData` | `date` | no |
| `_shortSellingData` | `date` | no |
| `_flowSignals` | `generated` or `updated` | no |
| `_optionsAnalytics` | `generated` | no |

---

### Global Variable Summary

| JS global | Declared in | Set by loader | Type | Used in |
|-----------|------------|---------------|------|---------|
| `_macroLatest` | `appState.js` | `_loadMarketData` | Object | `_applyMacroConfidenceToPatterns`, signal engine |
| `_bondsLatest` | `appState.js` | `_loadMarketData` | Object | `_applyMacroConfidenceToPatterns` |
| `_kosisLatest` | `appState.js` | `_loadMarketData` | Object | `_applyPhase8ConfidenceToPatterns` |
| `_macroComposite` | `appState.js` | `_loadPhase8Data` | Object | `_applyPhase8ConfidenceToPatterns` |
| `_derivativesData` | `appState.js` | `_loadDerivativesData` | Array or Object | `_applyDerivativesConfidenceToPatterns` |
| `_investorData` | `appState.js` | `_loadDerivativesData` | Object | `_applyDerivativesConfidenceToPatterns` |
| `_etfData` | `appState.js` | `_loadDerivativesData` | Object | `_applyDerivativesConfidenceToPatterns` |
| `_shortSellingData` | `appState.js` | `_loadDerivativesData` | Object | `_applyDerivativesConfidenceToPatterns` |
| `_flowSignals` | `appState.js` | `_loadPhase8Data` | Object | `_applyPhase8ConfidenceToPatterns` |
| `_optionsAnalytics` | `appState.js` | `_loadPhase8Data` | Object | `_applyPhase8ConfidenceToPatterns` |

---

## 1.6 Pipeline Orchestration

### `daily_update.bat` — 18-step sequence

**Python resolution order**:
1. `KRX_PYTHON` environment variable (explicit path)
2. `%USERPROFILE%\miniconda3\envs\krx64\python.exe` (conda `krx64` env, Python 3.12 64-bit)
3. System `python` fallback

**Dual-Python architecture**: 64-bit Python for all pipeline scripts. 32-bit Python 3.9
reserved for Kiwoom WebSocket server (`server/start_server.bat`). These environments must
not be mixed.

| Step | Script | Dependency | Failure behavior |
|------|--------|-----------|-----------------|
| 0 | `krx_probe_phase0.py --quick --save-health` | KRX API health | ABORT pipeline on error |
| 1 | `download_kosis.py` | None | WARNING, continue |
| 2 | `download_macro.py` | Step 1 (KOSIS before MCS) | WARNING, continue |
| 3 | `download_bonds.py` | None | WARNING, continue |
| 4 | `download_market_context.py` | None | WARNING, continue |
| 5 | `download_derivatives.py` | None | WARNING, continue |
| 6 | `download_vkospi.py`, `download_etf.py` | None | WARNING, continue |
| 7 | `download_investor.py`, `download_shortselling.py` | None | WARNING, continue |
| 8 | `download_ohlcv.py --cron --incremental --years 1` | None | WARNING, continue (partial) |
| 9 | `generate_intraday.py --timeframe 5m` | Step 8 (OHLCV) | WARNING, continue |
| 10 | `update_index_prices.py --offline` | Step 8 | WARNING, continue |
| 11 | `prepare_options_latest.py` | Step 5 (options_daily.json) | WARNING, continue |
| 12 | `compute_options_analytics.py` | Step 11, Step 3 (bonds), market/kospi200_daily.json | WARNING, continue |
| 13 | `compute_bond_metrics.py` | Step 3 (bonds_latest.json) | WARNING, continue |
| 14 | `compute_basis.py` | Step 5 (derivatives_summary.json), Step 3 (bonds), market/kospi200_daily.json | WARNING, continue |
| 15 | `compute_macro_composite.py` | Steps 1, 2, 3 (kosis, macro, bonds) | WARNING, continue |
| 16 | `compute_flow_signals.py` | `data/investors/` per-stock, `hmm_regimes.json` | WARNING, continue |
| 17 | `compute_capm_beta.py` | Step 8 (OHLCV) | WARNING, continue |
| 18 | `compute_eva.py` | `data/financials/`, Step 17 (capm_beta.json) | WARNING, continue |

**Only Step 0 aborts the pipeline.** All other failures are warnings — the pipeline
continues even if critical compute steps fail.

### Task Scheduler configuration

```
schtasks /create /sc daily /tn "KRX_DailyUpdate"
         /tr "C:\Users\seth1\krx-live-chart-remote\scripts\daily_update.bat"
         /st 16:00
```

**Intraday updates** (auto_update.bat, Task Scheduler `CheeseStock_HourlyDeploy`):
- Frequency: Hourly, 09:30–16:05 KST, Monday–Friday
- Includes OHLCV + intraday + index prices + Cloudflare wrangler deploy

### API health check output

`krx_probe_phase0.py --save-health` writes `data/api_health.json`. This file is
checked by the pipeline before proceeding. Format not documented in Gate 1 contract.

### Deployment pipeline

After `daily_update.bat`:
1. `python scripts/stage_deploy.py` — copies whitelisted files to `deploy/` (excludes
   large raw OHLCV data, `data/backtest/`, `data/delisted/`, etc.)
2. `wrangler pages deploy deploy/ --project-name cheesestock --branch main --commit-dirty=true --commit-message="deploy"` (ASCII-only message)

**Deploy staging excludes** (not deployed to Cloudflare Pages):
- Raw daily files (`*_daily.json`) — too large
- `data/backtest/` — internal pipeline artifacts
- `data/delisted/` — delisted stock history

The `capm_beta.json`, `eva_scores.json`, `flow_signals.json`, `hmm_regimes.json`, and
`bond_metrics.json` files are in `data/backtest/` — their deployment status depends on
`stage_deploy.py` whitelist configuration.

---

## Findings

### CRITICAL — Contract mismatches and broken quality gates

**F-1 (CRITICAL): `mcs` key missing from `macro_latest.json`**  
Gate 1 requires `mcs` as a required top-level key in `data/macro/macro_latest.json`.  
Actual file does not contain an `mcs` key. The MCS score lives in
`data/macro/macro_composite.json` under `mcsV2`. The Gate 1 contract was written
expecting `mcs` to be in `macro_latest.json`, but it is not there — `compute_macro_composite.py`
writes to a separate file. The field `foreigner_signal` is a UIP composite, not MCS.  
**Impact**: `verify.py --check pipeline` will FAIL on the `mcs` key check every run.  
**Fix**: Either update Gate 1 contract to remove `mcs` from `macro_latest.json`
requirements, or add `mcs` field to `download_macro.py` output (copying from
`macro_composite.json`).

**F-2 (CRITICAL): `market/kospi200_daily.json` not refreshed in `daily_update.bat`**  
`compute_basis.py` (Step 14), `compute_options_analytics.py` (Step 12), and
`prepare_options_latest.py` (Step 11) all read `data/market/kospi200_daily.json`.
`download_market_index.py` is the script that generates this file, but it is not
called anywhere in `daily_update.bat`.  
**Impact**: `kospi200_daily.json` grows stale daily — basis z-scores and options spot
prices use old index data.  
**Fix**: Add `download_market_index.py` as Step 5.5 (after derivatives download, before
compute steps).

**F-3 (CRITICAL): `compute_hmm_regimes.py` not scheduled**  
`compute_flow_signals.py` (Step 16) reads `data/backtest/hmm_regimes.json` to inject
HMM regime labels into `flow_signals.json`. `compute_hmm_regimes.py` is not in
`daily_update.bat`. If `hmm_regimes.json` is stale, `_flowSignals.hmmRegimeLabel`
reflects outdated regime classification, silently.  
**Fix**: Add `compute_hmm_regimes.py` as a step before `compute_flow_signals.py` (after
OHLCV is refreshed, i.e., after Step 8).

**F-4 (CRITICAL): Per-stock investor flow data pipeline not implemented**  
`compute_flow_signals.py` reads `data/investors/{code}.json` for per-stock foreign/
retail/institutional flow signals. No script creates `data/investors/` directory or
populates per-stock files. This directory does not exist. The result: `flow_signals.json`
always has `flowDataCount=0`, triggering the `flowDataCount=0` warning guard in
`_loadPhase8Data()`. HMM regime labels from `hmm_regimes.json` are still injected, but
per-stock momentum signals (`foreignMomentum`, `retailContrarian`, `institutionalAlignment`)
are all `"neutral"` for every stock.  
**Impact**: `_applyPhase8ConfidenceToPatterns()` foreign alignment bonus (+3%) never fires.

---

### HIGH — Deprecated endpoints and dead code risks

**F-5 (HIGH): `download_bonds.py` `bbb_minus` item code confusion risk**  
Comment in `download_bonds.py` line 70 warns: `010400000 = 통안증권(91일) — BBB-와
혼동 금지`. The correct BBB- code `010320000` is used, but this confusable neighbor
code exists in the same stat table. Any future edit that accidentally uses `010400000`
would silently return non-credit data. No assertion validates the parsed value range
(BBB- spread should be 3–15%). The `_validation` key in `bonds_latest.json` is present
but its contents were not verified in this audit.

**F-6 (HIGH): OECD CLI parser has no alert on header change**  
`download_macro.py::fetch_oecd_cli` returns `None` silently if the CSV headers
`TIME_PERIOD` or `OBS_VALUE` are missing. OECD has changed its SDMX CSV format before.
There is no fallback and no pipeline-visible error. `korea_cli`, `china_cli`, `us_cli`
fields in `macro_latest.json` would silently be absent, degrading the RORO/macro regime
logic.

**F-7 (HIGH): `data/backtest/` files may not be deployed to Cloudflare Pages**  
`capm_beta.json` and `eva_scores.json` are in `data/backtest/`. `flow_signals.json`
is consumed by `_loadPhase8Data()` via `fetch('data/backtest/flow_signals.json', ...)`.
If `stage_deploy.py` excludes `data/backtest/`, the browser will get 404 on these files.
`_notifyFetchFailure()` will toast but not abort. The `financials.js` EVA display and
Phase 8 confidence adjustments will silently degrade.  
**Action needed**: Verify `stage_deploy.py` whitelist includes `data/backtest/flow_signals.json`,
`data/backtest/capm_beta.json`, and `data/backtest/eva_scores.json`.

**F-8 (HIGH): `download_market_context.py` VKOSPI field may conflict with `vkospi.json`**  
`market_context.json` contains a `vkospi` field (from a KRX snapshot call inside
`download_market_context.py`). `_loadMarketData()` in `appWorker.js` also injects
`_macroLatest.vkospi` from `vkospi.json`. The injection guard is `if (_macroLatest.vkospi == null)`,
so `market_context.json`'s VKOSPI (if pre-loaded elsewhere) could block the more accurate
`vkospi.json` series. `market_context.json` is consumed separately as `_marketContext`
(appState.js), not merged into `_macroLatest`, so this conflict does not currently
trigger — but future code that merges these two objects could produce stale VKOSPI.

---

### MEDIUM — Missing quality gates

**F-9 (MEDIUM): `bond_metrics.json` not in Gate 1 contract**  
`compute_bond_metrics.py` produces `data/macro/bond_metrics.json` (Duration, DV01,
Convexity, curve shape). This file is not in the Gate 1 pipeline contract table.
If `compute_bond_metrics.py` fails, `financials.js` bond metric display would silently
use no data. Add `data/macro/bond_metrics.json` with required key `benchmarks` to Gate 1.

**F-10 (MEDIUM): `capm_beta.json` and `eva_scores.json` not in Gate 1 contract**  
Both are required by `compute_eva.py` and `financials.js` (EVA display). Neither is
in Gate 1. `capm_beta.json` is also used as intermediate input by `compute_eva.py`.

**F-11 (MEDIUM): `data/market_context.json` not in Gate 1 contract**  
`market_context.json` is loaded by `appState.js` (via `_loadMarketContext()`) and used
in `_applyMarketContextToPatterns()`. Missing from Gate 1 pipeline contract.

**F-12 (MEDIUM): `investor_summary.json` key name mismatch**  
Gate 1 contract checks for `date` and `foreign_net_1d`. Actual file has both, but also
uses `latest_date` alongside `date`. The `generated_at` field is the ISO timestamp, not
`updated`. Staleness check in `_checkDataStaleness` uses `dateField='date'` — correct,
since `investor_summary.date` exists. No contract error; documenting for clarity.

**F-13 (MEDIUM): `etf_summary.json` missing `leverageSentiment` documentation**  
`leverageSentiment` key is present in `etf_summary.json` and consumed in
`_applyDerivativesConfidenceToPatterns()`. Not documented in Gate 1 or
`API_PIPELINE_REFERENCE.md`. `topByVolume` and `topByAUM` are arrays of ETF objects;
their schema is undocumented.

---

### LOW — Observational notes

**F-14 (LOW): `shortselling_summary.json` uses `source: "unavailable"` as a special case**  
The JS guard in `_loadDerivativesData()` checks for `source === 'sample'` or
`source === 'unavailable'` and nulls out `_shortSellingData`. Gate 1 checks for
`source === 'sample'`. The `"unavailable"` source string is a production state (when
KRX public short selling data is suspended — which occurs during short selling bans).
Gate 1 should be updated to also fail on `source === 'unavailable'`.

**F-15 (LOW): ECOS item codes with `/` in `download_bonds.py` vs `download_macro.py`**  
`download_bonds.py` uses `817Y002` which only has numeric item codes — no URL encoding
needed. `download_macro.py` explicitly URL-encodes item codes with `/` (e.g., `C0000/AA`,
`A00/2`). The intentional separation of the two ECOS fetch functions is documented in
`download_bonds.py` line 112 (`M-15 NOTE`). This split is correct — no bug.

**F-16 (LOW): `daily_update.bat` header says "v52, 18 steps" but step numbering goes 0–18**  
There are 19 steps (0 through 18), not 18. The header comment is off by one. Minor
documentation inconsistency.

**F-17 (LOW): `compute_flow_signals.py` `HMM_STALE_DAYS=30` creates circular dependency**  
If `hmm_regimes.json` is >30 days old, `compute_flow_signals.py` sets
`hmmRegimeLabel` to `null`. But `compute_hmm_regimes.py` requires OHLCV data to refit.
On first install (no OHLCV data), both scripts fail gracefully — but the failure chain
is silent. A pipeline status flag for HMM regime freshness would help.

---

### Deprecated / dead API code found in scripts

| Location | Dead code | Reason |
|----------|-----------|--------|
| `api_constants.py` line 14 | `KRX_OTP_URL`, `KRX_CSV_URL` | Still used — OTP is the fallback method. Not dead. |
| `download_macro.py` line 84 comment | `817Y002(일별전용) → 721Y001(월별)` | Fixed migration — old 817Y002 (monthly) use is eliminated. |
| `download_macro.py` line 96 comment | `101Y003(2004폐기) → 161Y006` | Fixed migration. Old code no longer called. |
| `download_macro.py` line 96 comment | `BBGA00 → BBHA00` | Fixed. Old item code not used. |
| `krx_api.py` ENDPOINTS dict | Many endpoints (e.g., `gold_daily`, `oil_daily`, `esg_sri_bond`) | Mapped but not called by any current download script. Infrastructure-ready, not dead. |
| `download_derivatives.py` | OTP fallback (`MDCSTAT12501`, `MDCSTAT12601`) | Fallback path — active when Open API unavailable. |

No truly dead API endpoint was found (endpoints that are mapped and would cause errors if called). The OTP fallbacks remain functional.
