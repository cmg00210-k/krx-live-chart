# Stage 1 API Pipeline Anatomy — CheeseStock (V6, Sections 1.1–1.4)

**Document version**: 2026-04-06 (V6 revision of S1_api_pipeline.md)  
**Scope**: Sections 1.1–1.4 only — External API inventory, download scripts catalog,
daily pipeline sequence, and API health & rate limiting. Sections 1.5–1.6 remain
unchanged from V5.  
**Authority**: Every stat code, item code, endpoint path, and file path in this document
has been verified against the actual Python source on disk as of 2026-04-06.
Corrections from V5 are marked `[CORRECTED from V5]`. New findings not in V5 are marked
`[NEW FINDING]`.

---

## 1.1 External API Inventory

### API 1 — ECOS (한국은행 경제통계시스템)

| Field | Value |
|-------|-------|
| Provider | 한국은행 (Bank of Korea) |
| Base URL | `https://ecos.bok.or.kr/api` |
| Auth method | API key in URL path: `.../StatisticSearch/{API_KEY}/json/kr/...` |
| Key env var | `ECOS_API_KEY` (loaded via `api_constants.load_env_key()` from `.env`) |
| Rate limit | 0.5 s between calls (`RATE_LIMIT_SEC` in `api_constants.py` line 19) |
| Timeout (macro) | 15 s (`TIMEOUT_QUICK` — used by `download_macro.py` and `download_market_context.py`) |
| Timeout (bonds) | 15 s (`TIMEOUT_QUICK` — used by `download_bonds.py::ecos_fetch`) |
| URL template | `{BASE}/StatisticSearch/{KEY}/json/kr/1/{limit}/{STAT_CODE}/{FREQ}/{START}/{END}/{ITEM_CODE}` |
| Key registration | https://ecos.bok.or.kr/ (free, member account required) |

**Error code handling** (verified in `download_bonds.py::ecos_fetch` lines 158–170 and
`download_macro.py::fetch_ecos_series` lines 292–296):

| ECOS response code | Meaning | Handling |
|-------------------|---------|---------|
| `StatisticSearch` key present | Success | Parse `row` array |
| `RESULT.CODE = "INFO-200"` | No data for period (normal) | Return `[]` silently if verbose |
| Any other `RESULT.CODE` | API error (key expired, quota, bad stat code) | Print error, return `[]` or `None` |
| HTTP non-200 | Network/server error | Log, return `None` |
| Timeout | Connection failure | `requests.exceptions.Timeout` caught, return `[]` |
| JSON decode error | Malformed response | `json.JSONDecodeError` caught, return `[]` |

**IMPORTANT — Two intentionally separate ECOS fetch functions**:  
`download_macro.py::fetch_ecos_series` handles monthly (freq=`M`) data with YYYYMM dates
and URL-encodes slash-containing item codes via `urllib.parse.quote()`.  
`download_bonds.py::ecos_fetch` handles daily (freq=`D`) data with YYYYMMDD dates;
no slash-containing item codes so URL encoding is not applied.  
These two functions must NOT be merged without rewriting all callers simultaneously
(documented in `download_bonds.py` line 112, `M-15 NOTE`).

#### ECOS Series — `download_macro.py` (all monthly, freq=`M`)

| Internal key | Stat code | Item code | Series name (Korean) | Note |
|-------------|-----------|-----------|----------------------|------|
| `bok_rate` | `722Y001` | `0101000` | 한국은행 기준금리 | |
| `ktb10y` | `721Y001` | `5050000` | 국고채 10년 (월별) | [CORRECTED from V5: old `817Y002` was daily-only, migrated to `721Y001`] |
| `ktb3y` | `721Y001` | `5020000` | 국고채 3년 (월별) | [CORRECTED from V5: same migration] |
| `m2` | `161Y006` | `BBHA00` | M2 광의통화 (평잔, 원계열) | [CORRECTED from V5: old `101Y003`/`BBGA00` discontinued 2004] |
| `cli` | `901Y067` | `I16A` | 경기선행지수 순환변동치 | Cross-validates with KOSIS `cli_composite` (different: ECOS=cyclical component, KOSIS=absolute level) |
| `cpi` | `901Y009` | `0` | 소비자물가지수 총지수 | |
| `bsi_mfg` | `512Y013` | `C0000/AA`* | 제조업 BSI 업황실적 | Doc29 §2.2; item code has slash → URL-encoded |
| `export_value` | `901Y118` | `T002` | 통관기준 수출액 (천불) | Doc29 §2.5 |
| `ipi` | `901Y033` | `A00/2`* | 산업생산지수 전산업 계절조정 | Doc30 §2; item code has slash → URL-encoded; cross-validates with KOSIS `ipi_all` |
| `foreign_equity` | `301Y013` | `BOPF22100000` | 외인 주식투자 순유입 (백만불) | Doc29 §5.2 |
| `cd_rate_91d` | `721Y001` | `2010000` | CD금리 91일 | |
| `cp_rate_91d` | `721Y001` | `4020000` | CP금리 91일 | Cross-validates with KOSIS `cp_yield_kosis` |
| `household_credit` | `151Y002` | `1110000` | 가계대출 예금취급기관 (십억원) | |
| `unemployment_rate` | `901Y027` | `I61BC` | 실업률 | Returns both raw + seasonally adjusted; duplicate date removal keeps seasonally adjusted value |
| `house_price_idx` | `901Y064` | `P65A` | 주택매매가격 종합지수 (전국) | |

*Items marked `*` contain `/` in the code and are URL-encoded by `urllib.parse.quote(item_code, safe='')` before URL construction.

#### ECOS Series — `download_bonds.py` (all daily, freq=`D`, stat code `817Y002`)

Stat code `817Y002` = 시장금리(일별). This stat code is **daily-only**; requesting with
freq=`M` returns an API error. All item codes are purely numeric (no slash encoding needed).

| Internal key | Item code | Tenor | Instrument |
|-------------|-----------|-------|-----------|
| `ktb_1y` | `010190000` | 1Y | 국고채 |
| `ktb_2y` | `010195000` | 2Y | 국고채 |
| `ktb_3y` | `010200000` | 3Y | 국고채 |
| `ktb_5y` | `010200001` | 5Y | 국고채 |
| `ktb_10y` | `010210000` | 10Y | 국고채 |
| `ktb_20y` | `010220000` | 20Y | 국고채 |
| `ktb_30y` | `010230000` | 30Y | 국고채 |
| `aa_minus` | `010300000` | 3Y | 회사채 AA- |
| `bbb_minus` | `010320000` | 3Y | 회사채 BBB- |

**CRITICAL WARNING**: Item code `010400000` = 통안증권(91일), NOT BBB-. This confusable
neighbor code exists in the same `817Y002` stat table. If `010320000` is accidentally
replaced with `010400000`, the function returns treasury bill data silently with no
range-check validation. No assertion on BBB- range (3–15%) exists in `download_bonds.py`.

#### ECOS Series — `download_market_context.py` (monthly, stat `511Y002`)

| Internal key | Group1 | Group2 | Name | Normal range |
|-------------|--------|--------|------|-------------|
| `ccsi` | `FME` | `99988` | 소비자심리지수 (CCSI) | 80–120 (100 = long-term average) |

Range guard is implemented: values outside 50–150 are rejected (return `None`).
This prevents the previous bug where CCSI=0 was accepted as a valid value.

**Deprecated ECOS codes (never use)**:

| Code | Reason | Replaced by |
|------|--------|------------|
| `101Y003` | Discontinued 2004 | `161Y006` with item `BBHA00` |
| `817Y002` with freq=`M` | Daily-only table | Use `721Y001` for monthly KTB yields |
| Item `BBGA00` in `161Y006` | Non-existent item code | `BBHA00` |

**Output files**:
- `data/macro/macro_latest.json` — consumed by `_macroLatest` (appWorker.js)
- `data/macro/macro_history.json` — archival only (no JS consumer)
- `data/macro/bonds_latest.json` — consumed by `_bondsLatest` (appWorker.js)
- `data/macro/bonds_history.json` — archival only (no JS consumer)
- `data/market_context.json` — consumed by `_marketContext` (appState.js)

---

### API 2 — FRED (Federal Reserve Economic Data)

| Field | Value |
|-------|-------|
| Provider | Federal Reserve Bank of St. Louis |
| Base URL | `https://api.stlouisfed.org/fred/series/observations` |
| Auth method | `api_key` query parameter |
| Key env var | `FRED_API_KEY` (loaded via `.env`) |
| Rate limit | 0.5 s (shared with ECOS in `download_macro.py::_rate_limit()`) |
| Timeout | 15 s (`TIMEOUT_QUICK`) |
| Params used | `series_id`, `api_key`, `file_type=json`, `sort_order=desc`, `limit=100` |
| Key registration | https://fred.stlouisfed.org/docs/api/api_key.html (free) |

**Error handling** (`download_macro.py::fetch_fred_series` lines 359–406): HTTP non-200
logged and returns `None`. Value `"."` in observations is treated as missing data
(filtered out). Monthly deduplication: per-month last-seen value kept.

**Series used** (all merged into `data/macro/macro_latest.json`):

| Internal key | Series ID | Name | Frequency |
|-------------|-----------|------|-----------|
| `fed_rate` | `FEDFUNDS` | Federal Funds Rate | Monthly |
| `us10y` | `DGS10` | US 10Y Treasury Yield | Daily (monthly-sampled) |
| `us_cpi` | `CPIAUCSL` | US CPI (seasonally adjusted) | Monthly |
| `us_unemp` | `UNRATE` | US Unemployment Rate | Monthly |
| `us_breakeven` | `T10YIE` | 10Y Breakeven Inflation | Daily (monthly-sampled) |
| `us_hy_spread` | `BAMLH0A0HYM2` | US HY Credit Spread (OAS) | Daily (monthly-sampled) |
| `dxy_fred` | `DTWEXBGS` | Trade-Weighted USD Index | Daily (monthly-sampled) |
| `vix_fred` | `VIXCLS` | VIX Daily Close (FRED backup) | Daily (monthly-sampled) |

**JS consumers**: `_macroLatest.fed_rate`, `_macroLatest.us10y`, `_macroLatest.vix`
(the JS field is `vix`, not `vix_fred` — remapped during `build_macro_latest()` in
`download_macro.py`).

---

### API 3 — OECD SDMX (경기선행지수 / Composite Leading Indicators)

| Field | Value |
|-------|-------|
| Provider | OECD (Organisation for Economic Co-operation and Development) |
| Base URL | `https://stats.oecd.org/sdmx-json/data` |
| Auth | None (public endpoint) |
| Dataset | `MEI_CLI` (Main Economic Indicators — Composite Leading Indicators) |
| Series filter | `LOLITOAA.{COUNTRY_CODE}.M` |
| Measure filter | `MEASURE=LI`, `TRANSFORMATION=IX` (amplitude-adjusted, index level) |
| Accept header | `text/csv` |
| Timeout | 15 s (`TIMEOUT_QUICK`) |

**Countries and output keys** (all merged into `macro_latest.json`):

| Internal key | Country code | Name |
|-------------|-------------|------|
| `korea_cli` | `KOR` | 한국 CLI |
| `china_cli` | `CHN` | 중국 CLI |
| `us_cli` | `USA` | 미국 CLI |

**CLI filter logic** (`download_macro.py::fetch_oecd_cli` lines 485–531):
- Only rows where `MEASURE=LI` and `TRANSFORMATION=IX` are accepted.
- Values outside 80–110 are discarded (trend-normalized CLI sits near 100; absolute-level
  variants near 120+ are excluded).
- Per-date last-seen value is kept (deduplication of adjustment variants).
- Only most recent 30 months are retained before merging.

**Silent failure risk** (FND-6 in V5 Findings): If OECD changes CSV headers `TIME_PERIOD`
or `OBS_VALUE`, `fetch_oecd_cli` returns `None` without raising an alert. The missing
check is logged only at verbose level. `korea_cli`, `china_cli`, `us_cli` will be absent
from `macro_latest.json` silently. This degrades the RORO regime and macro confidence
logic without any visible pipeline warning.

**Output**: merged into `data/macro/macro_latest.json`.

---

### API 4 — KRX pykrx + FinanceDataReader (OHLCV)

| Field | Value |
|-------|-------|
| Library (OHLCV) | `pykrx` v1.2.4 (KRX scraping) — requires 32-bit-compatible or 64-bit Python |
| Library (listing) | `FinanceDataReader` (FDR) — stock listing and market indices |
| Auth | None (scraping-based) |
| Rate limit | None explicit — pykrx has internal delays; no `time.sleep()` in `download_ohlcv.py` |
| Retry | 3 attempts per stock, 2 s sleep between retries, permanent errors (`404`, `invalid`) skipped |
| SPAC filter | Names containing `'스팩'` or `'SPAC'` are excluded from OHLCV downloads |

**Stock listing** (from `download_ohlcv.py::get_all_stocks()`):
- `fdr.StockListing('KOSPI')` — KOSPI universe
- `fdr.StockListing('KOSDAQ')` — KOSDAQ universe
- Both filtered: 6-digit codes only, SPAC excluded

**OHLCV per-stock download**: `pykrx.stock.get_market_ohlcv_by_date(start, end, code)`
returns DataFrame with columns `Open`, `High`, `Low`, `Close`, `Volume`.

**Incremental mode** (used in daily cron): `download_ohlcv.py --incremental` reads
existing `data/{market}/{code}.json`, finds the last candle date, downloads only from
that date+1 forward, and appends. Stocks already up-to-date are skipped with
`"skipped": True` flag.

**Market data** (USD/KRW, DXY, VIX) from `download_macro.py`:
- Primary: `FinanceDataReader.DataReader(symbol, start)` — FDR symbols `USD/KRW`,
  `DX-Y.NYB`, `VIX`
- Fallback: `yfinance.Ticker(symbol).history()` — yf symbols `KRW=X`, `DX-Y.NYB`, `^VIX`
- Both are optional imports (`HAS_FDR`, `HAS_YFINANCE` flags)

**Output files**:

| File | Description | JS consumer |
|------|-------------|------------|
| `data/kospi/{code}.json` | Per-stock daily candles, KOSPI | `dataService.getCandles()` in `api.js` |
| `data/kosdaq/{code}.json` | Per-stock daily candles, KOSDAQ | `dataService.getCandles()` in `api.js` |
| `data/index.json` | Full stock index (code, name, market, sector, marketCap, prevClose, change, changePercent, volume) | `dataService.initFromIndex()` in `api.js`; `ALL_STOCKS` global |
| `data/market/kospi_daily.json` | KOSPI index daily closes | `compute_basis.py`, `compute_options_analytics.py` |
| `data/market/kosdaq_daily.json` | KOSDAQ index daily closes | (archival) |
| `data/market/kospi200_daily.json` | KOSPI200 index daily closes | `compute_basis.py`, `compute_options_analytics.py`, `prepare_options_latest.py` |

**[CRITICAL — FND-2]**: `data/market/kospi200_daily.json` is generated by
`download_market_index.py` which is **not called in `daily_update.bat`**. Steps 11, 12,
and 14 all depend on this file being current. See Section 1.3 and Findings.

---

### API 5 — KRX Open API (data-dbg.krx.co.kr)

| Field | Value |
|-------|-------|
| Provider | 한국거래소 (KRX) |
| Base URL | `https://data-dbg.krx.co.kr/svc/apis` |
| Auth method | `AUTH_KEY` request header |
| Key env var | `KRX_API_KEY` (loaded via `api_constants.load_env_key()` from `.env`) |
| Key validity | 1 year from issuance |
| Daily quota | 10,000 calls/day (official); `QUOTA_WARN = 9,000` triggers warning in `KRXClient` |
| Rate limit | 0.5 s (`RATE_LIMIT_SEC` in `api_constants.py`; `krx_api.py` enforces it) |
| Timeout | Connect 10 s / Read 60 s (split timeout in `KRXClient._session`) |
| Retry | 3x exponential backoff (factor 1.0) on 5xx/timeout only |
| Fatal codes | `401`, `403`, `404` — no retry |
| Key registration | https://openapi.krx.co.kr/ |

**`KRXClient` class** (`scripts/krx_api.py`):
- Maintains session with `AUTH_KEY` header pre-set
- Tracks `_daily_count` and `_daily_date`; resets counter on new calendar day
- Warns at 9,000 calls; raises `RuntimeError` at 10,000
- `get(endpoint_alias_or_path, **params)` resolves alias via `ENDPOINTS` dict
- HTTP status + `respCode` JSON field double-checked; `respCode != "200"` treated as error

**Full 31-endpoint ENDPOINTS dict** (verified from `krx_api.py` lines 60–99):

| Alias | Endpoint path | Category | Used by pipeline |
|-------|--------------|---------|-----------------|
| `idx_krx` | `idx/krx_dd_trd` | 지수 | Not used |
| `idx_kospi` | `idx/kospi_dd_trd` | 지수 | Not used directly |
| `idx_kosdaq` | `idx/kosdaq_dd_trd` | 지수 | Not used directly |
| `idx_bond` | `idx/bon_dd_trd` | 지수 | Not used |
| `idx_deriv` | `idx/drvprod_dd_trd` | 지수 | `download_vkospi.py` — VKOSPI |
| `stock_daily` | `sto/stk_bydd_trd` | 주식 | Not used |
| `stock_info` | `sto/stk_isu_base_info` | 주식 | Not used |
| `kosdaq_daily` | `sto/ksq_bydd_trd` | 주식 | Not used |
| `kosdaq_info` | `sto/ksq_isu_base_info` | 주식 | Not used |
| `konex_daily` | `sto/knx_bydd_trd` | 주식 | Not used |
| `konex_info` | `sto/knx_isu_base_info` | 주식 | Not used |
| `warrant_daily` | `sto/sw_bydd_trd` | 주식 | Not used |
| `rights_daily` | `sto/sr_bydd_trd` | 주식 | Not used |
| `etf_daily` | `etp/etf_bydd_trd` | ETP | `download_etf.py` |
| `etn_daily` | `etp/etn_bydd_trd` | ETP | Not used |
| `elw_daily` | `etp/elw_bydd_trd` | ETP | Not used |
| `bond_govt` | `bon/kts_bydd_trd` | 채권 | Not used |
| `bond_general` | `bon/bnd_bydd_trd` | 채권 | Not used |
| `bond_small` | `bon/smb_bydd_trd` | 채권 | Not used |
| `futures_daily` | `drv/fut_bydd_trd` | 파생 | `download_derivatives.py` |
| `futures_stock_kospi` | `drv/eqsfu_stk_bydd_trd` | 파생 | Not used |
| `futures_stock_kosdaq` | `drv/eqkfu_ksq_bydd_trd` | 파생 | Not used |
| `options_daily` | `drv/opt_bydd_trd` | 파생 | `download_derivatives.py` |
| `options_stock_kospi` | `drv/eqsop_bydd_trd` | 파생 | Not used |
| `options_stock_kosdaq` | `drv/eqkop_bydd_trd` | 파생 | Not used |
| `gold_daily` | `gen/gold_bydd_trd` | 일반상품 | Not used |
| `oil_daily` | `gen/oil_bydd_trd` | 일반상품 | Not used |
| `ets_daily` | `gen/ets_bydd_trd` | 일반상품 | Not used |
| `esg_sri_bond` | `esg/sri_bond_info` | ESG | Not used |
| `esg_etp` | `esg/esg_etp_info` | ESG | Not used |
| `esg_index` | `esg/esg_index_info` | ESG | Not used |

The 27 "not used" endpoints are infrastructure-ready mappings. None produce errors
unless called — they are not dead code, they are pre-registered paths.

**Key field names used by callers** (verified from source):

| Caller | Endpoint | Request param | Key response fields |
|--------|---------|--------------|-------------------|
| `download_vkospi.py` | `idx/drvprod_dd_trd` | `basDd=YYYYMMDD` | `IDX_NM`, `BAS_DD`, `CLSPRC_IDX`, `OPNPRC_IDX`, `HGPRC_IDX`, `LWPRC_IDX` |
| `download_derivatives.py` (futures) | `drv/fut_bydd_trd` | `basDd=YYYYMMDD` | `PROD_NM`, `ISU_NM`, `BAS_DD`, `TDD_CLSPRC`, `TDD_OPNPRC`, `TDD_HGPRC`, `TDD_LWPRC`, `SETL_PRC`, `ACC_TRDVOL`, `ACC_TRDVAL`, `ACC_OPNINT_QTY`, `SPOT_PRC`, `CMPPREVDD_PRC` |
| `download_derivatives.py` (options) | `drv/opt_bydd_trd` | `basDd=YYYYMMDD` | `RGHT_TP_NM` (콜/풋), `IMP_VOLT` (IV), `ISU_NM`, `TDD_CLSPRC`, `ACC_TRDVOL`, `ACC_OPNINT_QTY` |
| `download_etf.py` | `etp/etf_bydd_trd` | `basDd=YYYYMMDD` | `ISU_CD`, `ISU_NM`, `TDD_CLSPRC`, `CMPPREVDD_PRC`, `FLUC_RT`, `NAV`, `TDD_OPNPRC`, `TDD_HGPRC`, `TDD_LWPRC`, `ACC_TRDVOL`, `ACC_TRDVAL`, `MKTCAP`, `LIST_SHRS`, `OBJ_STKPRC_IDX` |

**Output files**:
- `data/vkospi.json` — VKOSPI daily series (JS: `_macroLatest.vkospi` injected in `_loadMarketData()`)
- `data/derivatives/futures_daily.json` — KOSPI200 futures daily OHLCV
- `data/derivatives/options_daily.json` — KOSPI200 option chain by expiry/strike
- `data/derivatives/derivatives_summary.json` — aggregated futures/options metrics (JS: `_derivativesData`)
- `data/derivatives/etf_daily.json` — ETF price/NAV/volume daily
- `data/derivatives/etf_summary.json` — ETF summary with leverage sentiment (JS: `_etfData`)

---

### API 6 — KRX OTP (data.krx.co.kr — legacy 2-step)

| Field | Value |
|-------|-------|
| Provider | 한국거래소 (KRX) 정보데이터시스템 |
| OTP URL | `http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd` |
| CSV URL | `http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd` |
| Protocol | HTTP (not HTTPS) — KRX legacy endpoint |
| Auth | OTP token (no persistent API key required) |
| User-Agent | `DEFAULT_USER_AGENT` from `api_constants.py` (`Mozilla/5.0 ... CheeseStock/1.0`) |
| Referer | `http://data.krx.co.kr` |
| Rate limit | 0.5 s via `KRXOTPClient._rate_limit()` |
| Retry | 3x exponential backoff on timeout/network errors; immediate re-raise on `KRXOTPError` |
| Session auth | Required since 2025-12 KRX 회원제 전환 — `LOGOUT` string in OTP response = session expired |

**`KRXOTPClient` class** (`scripts/krx_otp.py`):
- Session-based POST requests with `Referer` and `User-Agent` headers
- Step 1: POST to `OTP_URL` with stat params → receive OTP token string
- Step 2: POST to `CSV_URL` with `code=OTP_TOKEN` → receive CSV bytes
- CSV encoding: auto-detected in order: `euc-kr`, `cp949`, `utf-8-sig`, `utf-8`
- `LOGOUT` detection: both in OTP response (len > 500 or "LOGOUT" in text) and in CSV
  response (`b"LOGOUT"` or `b"<!DOCTYPE"` in first 200 bytes)

**OTP stat codes used by pipeline** (verified from source):

| Script | Stat URL path | Description | Output |
|--------|-------------|-------------|--------|
| `download_investor.py` | `dbms/MDC/STAT/standard/MDCSTAT02301` | 투자자별 매매동향 (시장 전체, 일별) | `investor_daily.json` |
| `download_investor.py` | `dbms/MDC/STAT/standard/MDCSTAT03602` | 종목별 외국인 보유현황 | `foreign_flow.json` |
| `download_shortselling.py` | `dbms/MDC/STAT/standard/MDCSTAT08601` | 공매도 거래현황 (전종목 일별) | `shortselling_daily.json` |
| `download_shortselling.py` | `dbms/MDC/STAT/standard/MDCSTAT08301` | 공매도 잔고현황 (전종목 일별) | `shortselling_balance.json` |
| `download_vkospi.py` (fallback) | `dbms/MDC/STAT/standard/MDCSTAT01701` | VKOSPI 일별 (Open API 실패 시) | `vkospi.json` |
| `download_derivatives.py` (fallback) | `dbms/MDC/STAT/standard/MDCSTAT12501` | 선물 일별 (Open API 실패 시) | `futures_daily.json` |
| `download_derivatives.py` (fallback) | `dbms/MDC/STAT/standard/MDCSTAT12601` | 옵션 일별 (Open API 실패 시) | `options_daily.json` |

**CSV encoding notes** (`download_investor.py`, `download_shortselling.py`):
- All KRX OTP CSV files are EUC-KR encoded; BOM removal via `api_constants.clean_csv_fieldnames()`
- Investor type Korean → English mapping in `download_investor.py::INVESTOR_TYPE_MAP` (13 types)
- Short ratio calculation: `shortVolume / totalVolume * 100` (not KRX-provided field, due to
  inconsistent KRX % format)

**Output files** (JS consumers in parentheses):
- `data/derivatives/investor_daily.json` — per-market, per-day, per-investor-type
- `data/derivatives/foreign_flow.json` — per-stock foreign holding and net buy
- `data/derivatives/investor_summary.json` — aggregated signals (JS: `_investorData`)
- `data/derivatives/shortselling_daily.json` — per-stock daily short volumes
- `data/derivatives/shortselling_balance.json` — per-stock short interest balances
- `data/derivatives/shortselling_summary.json` — SIR, DTC, squeeze candidates (JS: `_shortSellingData`)

---

### API 7 — DART (전자공시시스템 / DART OpenAPI)

| Field | Value |
|-------|-------|
| Provider | 금융감독원 (FSS) |
| Base URL | `https://opendart.fss.or.kr/api` |
| Auth method | `crtfc_key` query parameter |
| Key env var | `DART_API_KEY` (loaded from `.env` or `--api-key` CLI arg) |
| Rate limit | 0.5 s between calls (enforced in `download_financials.py`) |
| Timeout quick | 15 s (`TIMEOUT_QUICK`) |
| Timeout normal | 30 s (`TIMEOUT_NORMAL`) |
| Key registration | https://opendart.fss.or.kr/ (free, member account required) |

**Error codes** (checked in `download_financials.py`):

| Status code | Meaning | Handling |
|------------|---------|---------|
| `000` | Success | Parse result |
| `013` | No data (종목 미공시, 정상) | Skip silently |
| `010` | API key error | Log, skip stock |
| `011` | Quota exceeded | Log, abort batch |

**Endpoints used** (verified from `download_financials.py`):

| Endpoint | Purpose | Key parameters |
|----------|---------|---------------|
| `/corpCode.xml` | Corp code lookup (ZIP → XML containing corp_code ↔ stock_code mapping) | `crtfc_key` |
| `/fnlttSinglAcnt.json` | Financial statements (single company, single period) | `crtfc_key`, `corp_code`, `bsns_year`, `reprt_code`, `fs_div` |
| `/stockTotqySttus.json` | Shares outstanding (total, by share type) | `crtfc_key`, `corp_code`, `bsns_year`, `reprt_code=11011` |
| `/company.json` | Company info (sector code KSIC, CEO, homepage) | `crtfc_key`, `corp_code` |

**Report code schedule**:

| Code | Report | Period | Notes |
|------|--------|--------|-------|
| `11013` | 1분기보고서 | Q1 | April filing |
| `11012` | 반기보고서 | Q2 | August filing |
| `11014` | 3분기보고서 | Q3 | November filing |
| `11011` | 사업보고서 | Annual | March filing |

**Statement type priority**: `fs_div=CFS` (연결재무제표) first; fallback `OFS` (별도).

**Account name mapping** (`TARGET_ACCOUNTS` dict in `download_financials.py`):

| Korean account name(s) | Maps to | Notes |
|------------------------|---------|-------|
| `매출액` / `수익(매출액)` / `영업수익` | `revenue` | Bank/insurance use `영업수익` |
| `영업이익` / `영업이익(손실)` | `op` | |
| `당기순이익` / `당기순이익(손실)` / `...지배기업...당기순이익(손실)` | `ni` | Long consolidated-statement name also mapped |
| `자산총계` | `total_assets` | |
| `부채총계` | `total_liabilities` | |
| `자본총계` | `total_equity` | |
| `기본주당이익(손실)` | `eps` | |

**Output format** (`data/financials/{code}.json`):
```json
{
  "code": "005930",
  "source": "dart",
  "quarterly": [
    {
      "period": "2025-Q1",
      "revenue": 79200000000000,
      "op": 6600000000000,
      "ni": 5750000000000,
      "total_assets": 457000000000000,
      "total_liabilities": 180000000000000,
      "total_equity": 277000000000000,
      "eps": 950,
      "roe": "8.3%",
      "opm": "8.3%"
    }
  ]
}
```

**JS consumer**: `getFinancialData(code)` in `js/data.js`, 3-tier fallback chain:
(1) fetch `data/financials/{code}.json` → (2) `getPastData()` hardcoded → (3) seed PRNG.
Only `source: "dart"` or `source: "hardcoded"` data is displayed; seed data clears all
metrics to `"—"`.

---

### API 8 — yfinance / FinanceDataReader (Market Data, Optional)

| Field | Value |
|-------|-------|
| Library 1 | `FinanceDataReader` (FDR) — primary |
| Library 2 | `yfinance` — fallback |
| Auth | None |
| Data | USD/KRW exchange rate, DXY (dollar index), VIX |
| Status | Both are optional imports (`HAS_FDR`, `HAS_YFINANCE` flags in `download_macro.py`) |

**FDR symbols** (primary, `download_macro.py::_fdr_to_monthly`):
- `USD/KRW` → `usdkrw` field in `macro_latest.json`
- `DX-Y.NYB` → `dxy` field
- `VIX` → `vix` field

**yfinance symbols** (fallback, `download_macro.py::_yf_to_monthly`):
- `KRW=X` → `usdkrw`
- `DX-Y.NYB` → `dxy`
- `^VIX` → `vix`

**Monthly resampling**: Both FDR and yfinance data are resampled to month-end
(`df.resample('M').last()`). Daily data is not retained.

**Output**: All merged into `data/macro/macro_latest.json` alongside ECOS and FRED fields.

---

### API Cross-validation Pairs

Two ECOS-KOSIS cross-validation pairs exist intentionally in the pipeline. Discrepancies
between these pairs surface data quality issues without requiring a third reference:

| ECOS series | KOSIS series | What they share | What differs |
|-------------|-------------|----------------|-------------|
| `ipi` (901Y033/A00/2) | `ipi_all` (DT_1C8016/B0201) | Same underlying IPI | ECOS=seasonally adjusted, KOSIS=original series; different release calendars |
| `cp_rate_91d` (721Y001/4020000) | `cp_yield_kosis` (DT_1C8016/C0305) | CP 91-day yield | ECOS=시장금리 monthly table, KOSIS=후행지표 (lagging index context) |
| `cli` (901Y067/I16A) | `cli_composite` (DT_1C8016/A01) | Business cycle CLI | ECOS=cyclical component (순환변동치), KOSIS=absolute level (2020=100) |

---

## 1.2 Download Scripts Catalog

For each script: line count is approximate from source inspection. Error/retry behavior
refers to what the script does when a download partially or fully fails.

### `download_ohlcv.py`

| Field | Value |
|-------|-------|
| Line count | ~400 |
| API source(s) | `pykrx.stock.get_market_ohlcv_by_date()`, `fdr.StockListing()` |
| Output files | `data/kospi/{code}.json` (per-stock), `data/kosdaq/{code}.json` (per-stock), `data/index.json` |
| Daily step | Step 8 (`--cron --incremental --years 1`) |
| Key parameters | `--years N` (default 1), `--market KOSPI/KOSDAQ`, `--code`, `--top N`, `--incremental`, `--cron` |
| Incremental mode | Reads last candle date from existing JSON, fetches from date+1, appends; stocks up-to-date skipped |
| Error handling | 3 retries per stock with 2 s sleep; permanent errors (404, invalid) skipped; partial batch succeeds |
| Full/incremental | Both supported; cron uses `--incremental` |
| Rate limiting | No explicit sleep between stocks; pykrx has internal delays |

### `download_macro.py`

| Field | Value |
|-------|-------|
| Line count | ~700+ |
| API source(s) | ECOS (15 series), FRED (8 series), OECD SDMX (3 countries), FDR/yfinance (3 market series) |
| Output files | `data/macro/macro_latest.json`, `data/macro/macro_history.json`, `data/macro/ff3_factors.json` |
| Daily step | Step 2 |
| Key parameters | `--api-key ECOS_KEY`, `--fred-key FRED_KEY`, `--offline`, `--verbose` |
| Error handling | Per-series: failure returns `None`, field absent from JSON; no abort on partial failure |
| Full/incremental | Full fetch every run (2-year window); `--offline` regenerates from existing history |
| Rate limiting | `_rate_limit()` = `time.sleep(0.5)` between every ECOS and FRED call |
| Special | Computes UIP foreigner signal, Taylor Rule gap, FF3 factors as derived fields in output |

### `download_bonds.py`

| Field | Value |
|-------|-------|
| Line count | ~450+ |
| API source(s) | ECOS stat `817Y002` (daily, 9 items) |
| Output files | `data/macro/bonds_latest.json`, `data/macro/bonds_history.json` |
| Daily step | Step 3 |
| Key parameters | `--api-key ECOS_KEY`, `--offline`, `--verbose` |
| Error handling | Per-item: empty list on failure; NSS fitting is optional (scipy); partial yield curves accepted |
| Full/incremental | Fetches latest 30 days for spot yields; 24 months for history |
| Rate limiting | `time.sleep(RATE_LIMIT_SEC)` between each item fetch |
| Special | Optional Nelson-Siegel-Svensson curve fitting (requires scipy); imports `compute_bond_metrics` |

### `download_kosis.py`

| Field | Value |
|-------|-------|
| Line count | ~363 |
| API source(s) | KOSIS `DT_1C8016` (경기종합지수, 12 series) |
| Output files | `data/macro/kosis_latest.json`, `data/macro/kosis_history.json` |
| Daily step | Step 1 (runs before `download_macro.py` so KOSIS data is available for MCS computation) |
| Key parameters | `--api-key KOSIS_KEY`, `--offline`, `--verbose` |
| Error handling | Single batch call; failure returns `None` and exits gracefully (log only) |
| Full/incremental | Full: fetches 2 years + 90 days; `--offline` re-parses existing file |
| Rate limiting | Single API call for entire table; no per-series rate limit needed |
| Special | Computes derived `cli_cci_gap` field; range checks on 7 indicators (log warning only) |

### `download_market_context.py`

| Field | Value |
|-------|-------|
| Line count | ~200+ |
| API source(s) | ECOS `511Y002/FME/99988` (CCSI), local `data/vkospi.json` (VKOSPI), local `data/derivatives/investor_summary.json` |
| Output files | `data/market_context.json` |
| Daily step | Step 4 |
| Key parameters | `--ecos-key KEY`, `--demo` |
| Error handling | Per-source: CCSI failure → `null`; VKOSPI uses file fallback then macro_latest VIX; investor file fallback to 0 |
| Full/incremental | Full snapshot each run |
| Rate limiting | Single ECOS call; no multi-call rate limiting needed |
| Special | CCSI range guard (80–120); `earning_season` flag derived from calendar month (1/4/7/10) |

### `download_derivatives.py`

| Field | Value |
|-------|-------|
| Line count | ~600+ |
| API source(s) | KRX Open API (`drv/fut_bydd_trd`, `drv/opt_bydd_trd`) primary; KRX OTP (`MDCSTAT12501`, `MDCSTAT12601`) fallback |
| Output files | `data/derivatives/futures_daily.json`, `data/derivatives/options_daily.json`, `data/derivatives/derivatives_summary.json` |
| Daily step | Step 5 |
| Key parameters | `--start`, `--end`, `--verbose`, `--futures-only`, `--options-only`, `--otp-only` |
| Error handling | Open API: consecutive 10 empty-day threshold before fallback; OTP fallback on any Open API failure |
| Full/incremental | Per-day Open API calls (`basDd=YYYYMMDD` for each business day in range); default 1 year |
| Rate limiting | `KRXClient` enforces 0.5 s between calls |
| Special | KOSPI200 filter on `PROD_NM` field (Korean: "코스피" or English: "KOSPI"); P/C ratio and OI aggregation in summary |

### `download_vkospi.py`

| Field | Value |
|-------|-------|
| Line count | ~510 |
| API source(s) | KRX Open API `idx/drvprod_dd_trd` primary; KRX OTP `MDCSTAT01701` fallback |
| Output files | `data/vkospi.json` |
| Daily step | Step 6 |
| Key parameters | `--start` (default 2015-01-01), `--end`, `--output`, `--verbose`, `--otp-only` |
| Error handling | Open API: quota check before run; consecutive 10 empty-day threshold; OTP fallback on failure |
| Full/incremental | Open API per-day calls from start to end date; incremental not implemented (re-fetches full range) |
| Rate limiting | `KRXClient` 0.5 s between calls |
| Special | VKOSPI filter: `IDX_NM` containing "변동성" or "VKOSPI"; staleness check (7-day threshold); range check (warning if <10 or >50) |

### `download_etf.py`

| Field | Value |
|-------|-------|
| Line count | ~250+ |
| API source(s) | KRX Open API `etp/etf_bydd_trd` only (no OTP fallback) |
| Output files | `data/derivatives/etf_daily.json`, `data/derivatives/etf_summary.json` |
| Daily step | Step 6 (runs after `download_vkospi.py` in same step) |
| Key parameters | `--start`, `--verbose` |
| Error handling | Single-day call for latest; failure logged, existing file preserved |
| Full/incremental | Latest-day snapshot; no historical accumulation |
| Rate limiting | Single call (one `basDd` request); `KRXClient` enforces 0.5 s minimum |
| Special | ISIN to 6-digit code extraction; `trackingError = (close - NAV) / NAV * 100` computed locally; leverage/inverse ETF classification via regex (`레버리지|2X`, `인버스|곰|INVERSE`) |

### `download_investor.py`

| Field | Value |
|-------|-------|
| Line count | ~400+ |
| API source(s) | KRX OTP `MDCSTAT02301` (investor daily), `MDCSTAT03602` (foreign holdings per stock) |
| Output files | `data/derivatives/investor_daily.json`, `data/derivatives/foreign_flow.json`, `data/derivatives/investor_summary.json` |
| Daily step | Step 7 |
| Key parameters | `--start`, `--end`, `--verbose`, `--skip-foreign-flow` |
| Error handling | `KRXOTPError` on session expiry (LOGOUT); 3-retry backoff on network/timeout; partial failure logs continue |
| Full/incremental | Date-range fetch (default 1 year for daily, latest day for foreign flow) |
| Rate limiting | `KRXOTPClient._rate_limit()` = 0.5 s between each OTP+CSV call pair |
| Special | `source: "sample"` written when KRX API unavailable; JS guard in `_loadDerivativesData()` nulls `_investorData` on `source == "sample"` |

### `download_shortselling.py`

| Field | Value |
|-------|-------|
| Line count | ~400+ |
| API source(s) | KRX OTP `MDCSTAT08601` (trading volume), `MDCSTAT08301` (balance/잔고) |
| Output files | `data/derivatives/shortselling_daily.json`, `data/derivatives/shortselling_balance.json`, `data/derivatives/shortselling_summary.json` |
| Daily step | Step 7 (runs after `download_investor.py`) |
| Key parameters | `--start`, `--end`, `--market STK/KSQ`, `--verbose` |
| Error handling | `KRXOTPError` on session expiry; 3-retry backoff; `source: "unavailable"` written if no data (e.g., during 공매도 금지 period) |
| Full/incremental | Date-range fetch (default recent window) |
| Rate limiting | `KRXOTPClient._rate_limit()` = 0.5 s |
| Special | `shortRatio` recalculated locally as `shortVolume / totalVolume * 100` (KRX CSV format inconsistency); `source: "unavailable"` also triggers JS null guard |

### `download_financials.py`

| Field | Value |
|-------|-------|
| Line count | ~400+ |
| API source(s) | DART `/corpCode.xml`, `/fnlttSinglAcnt.json`, `/stockTotqySttus.json`, `/company.json` |
| Output files | `data/financials/{code}.json` (one per stock, ~2,600+ files) |
| Daily step | **Not in `daily_update.bat`** — manual/ad-hoc only |
| Key parameters | `--api-key DART_KEY`, `--code`, `--top N`, `--demo`, `--include-shares` |
| Error handling | Per-stock: status `013` = no data (skip); `010`/`011` = key/quota error (abort); network error = skip stock |
| Full/incremental | Full per-stock fetch; no incremental (DART reports change infrequently) |
| Rate limiting | 0.5 s sleep between stocks |
| Special | CFS preferred over OFS; `source` field written (`dart`/`demo`/`seed`); `--demo` generates synthetic data |

### `download_sector.py`

| Field | Value |
|-------|-------|
| Line count | ~150 |
| API source(s) | **No external API** — aggregates from local `data/index.json` + `data/financials/*.json` |
| Output files | `data/sector_fundamentals.json` |
| Daily step | **Not in `daily_update.bat`** — manual only |
| Key parameters | None (reads from fixed paths) |
| Error handling | Missing `data/index.json` → prints warning and returns; missing per-stock financials → uses 0 values |
| Full/incremental | Full recompute from current files |
| Special | Excludes `source: "demo"` and `source: "seed"` financials from sector averages; computes sector-median PER/PBR/ROE/OPM |

### `generate_intraday.py`

| Field | Value |
|-------|-------|
| Line count | ~200+ |
| API source(s) | **No external API** — generates synthetic intraday from daily OHLCV |
| Output files | `data/{market}/{code}_{timeframe}.json` (e.g., `kospi/005930_5m.json`) |
| Daily step | Step 9 (`--timeframe 5m` in cron) |
| Key parameters | `--code`, `--timeframe 1m/5m/15m/30m/1h` |
| Error handling | Missing source JSON → skip; generation error per stock → skip |
| Special | Uses Brownian bridge interpolation; `calendar.timegm()` for KST-safe Unix timestamps; 09:00–15:30 KST trading hours |

### `update_index_prices.py`

| Field | Value |
|-------|-------|
| Line count | ~150 |
| API source(s) | **No external API** (when `--offline`) — derives prices from OHLCV JSON files |
| Output files | `data/index.json` (price/change fields updated in-place) |
| Daily step | Step 10 (`--offline` in cron) |
| Key parameters | `--offline` (OHLCV-only mode), `--fdr` (FDR latest prices) |
| Error handling | Missing OHLCV file → skip stock; parse error → skip stock |
| Special | Updates `prevClose`, `change`, `changePercent`, `volume` in `data/index.json` from last candle of each stock JSON |

---

## 1.3 Daily Pipeline Sequence

### `daily_update.bat` — 19 steps (Step 0 through Step 18)

**[CORRECTED from V5 — FND-16]**: The header comment says "18 steps" but the pipeline has
19 steps numbered 0–18. The bat header itself (`echo ... v52, 18 steps`) is also off by one.

**Python resolution** (lines 22–35):
1. `KRX_PYTHON` environment variable (explicit path)
2. `%USERPROFILE%\miniconda3\envs\krx64\python.exe` (conda `krx64`, Python 3.12 64-bit)
3. System `python` fallback

**Dual-Python architecture**: 64-bit Python for all pipeline scripts. 32-bit Python 3.9
reserved for Kiwoom WebSocket server (`server/start_server.bat`). These must not be mixed.

#### Phase 1: Downloads (Steps 0–10)

| Step | Script + flags | Pipeline label | Failure behavior | Dependencies |
|------|--------------|---------------|-----------------|-------------|
| 0 | `krx_probe_phase0.py --quick --save-health` | API Health Check | **ABORT pipeline** | None |
| 1 | `download_kosis.py` | KOSIS download | WARNING, continue | None |
| 2 | `download_macro.py` | Macro indicators download | WARNING, continue | Step 1 (comment: "KOSIS runs before macro so MCS CSI uses today's KOSIS data") |
| 3 | `download_bonds.py` | Bonds download | WARNING, continue | None |
| 4 | `download_market_context.py` | Market context download | WARNING, continue | None (reads local vkospi.json if exists) |
| 5 | `download_derivatives.py` | Derivatives download (Open API) | WARNING, continue | None |
| 6a | `download_vkospi.py` | VKOSPI + ETF download | WARNING, continue | None |
| 6b | `download_etf.py` | (same step as 6a) | WARNING, continue | None |
| 7a | `download_investor.py` | Investor + Short Selling (OTP) | WARNING, continue | None |
| 7b | `download_shortselling.py` | (same step as 7a) | WARNING, continue | None |
| 8 | `download_ohlcv.py --cron --incremental --years 1` | OHLCV download | WARNING, continue (partial) | None |
| 9 | `generate_intraday.py --timeframe 5m` | Intraday generation (5m) | WARNING, continue | Step 8 (OHLCV must exist) |
| 10 | `update_index_prices.py --offline` | Index price update | WARNING, continue | Step 8 (OHLCV must exist) |

**[NEW FINDING]**: `download_market_index.py` (generates `data/market/kospi200_daily.json`)
is **absent from Phase 1**. It should run after Step 5 (after derivatives) and before
Step 11 (options latest). This creates a staleness gap for Steps 11, 12, and 14.

#### Phase 2: Post-Processing Compute (Steps 11–18)

| Step | Script | Failure behavior | Hard dependencies | Output |
|------|--------|-----------------|------------------|--------|
| 11 | `prepare_options_latest.py` | WARNING, continue | `derivatives/options_daily.json` (Step 5), `market/kospi200_daily.json` (**missing from pipeline**) | `derivatives/options_latest.json` |
| 12 | `compute_options_analytics.py` | WARNING, continue | Step 11, `bonds_latest.json` (Step 3), `market/kospi200_daily.json` (**missing**) | `derivatives/options_analytics.json` |
| 13 | `compute_bond_metrics.py` | WARNING, continue | `bonds_latest.json` (Step 3) | `macro/bond_metrics.json` |
| 14 | `compute_basis.py` | WARNING, continue | `derivatives_summary.json` (Step 5), `bonds_latest.json` (Step 3), `market/kospi200_daily.json` (**missing**) | `derivatives/basis_analysis.json` |
| 15 | `compute_macro_composite.py` | WARNING, continue | `kosis_latest.json` (Step 1), `macro_latest.json` (Step 2), `bonds_latest.json` (Step 3) | `macro/macro_composite.json` |
| 16 | `compute_flow_signals.py` | WARNING, continue | `data/investors/{code}.json` (**not implemented**), `backtest/hmm_regimes.json` (**not scheduled**), `index.json` (Step 8/10) | `backtest/flow_signals.json` |
| 17 | `compute_capm_beta.py` | WARNING, continue | `data/kospi/*.json`, `data/kosdaq/*.json` (Step 8), `index.json` | `backtest/capm_beta.json` |
| 18 | `compute_eva.py` | WARNING, continue | `data/financials/{code}.json` (manual), `backtest/capm_beta.json` (Step 17), `macro/bonds_latest.json` (Step 3) | `backtest/eva_scores.json` |

**Only Step 0 aborts the pipeline**. All other failures are `if errorlevel 1` → `WARNING, continue`.
This means the pipeline will silently produce stale or incomplete output without interruption.

#### Parallelizability Analysis

Steps that could run in parallel (no data dependencies between them):
- Steps 1, 3, 4, 5, 6a/6b, 7a/7b are all independent downloads (no inter-dependency)
- Steps 13 and 17 are independent compute steps (both can run after their respective downloads)
- Steps 11 and 13 are independent (different inputs/outputs)

Steps that must be sequential:
- Step 1 → Step 2 (KOSIS data must exist before macro composite in macro_latest.json)
- Step 8 → Step 9 → Step 10 (OHLCV → intraday → index update)
- Step 5 → Step 11 → Step 12 (derivatives → options latest → options analytics)
- Step 17 → Step 18 (CAPM beta → EVA requires beta input)

**Current implementation**: All steps run sequentially in bat file.

#### `auto_update.bat` (Lightweight Intraday Variant)

Task Scheduler job: `CheeseStock_HourlyDeploy`, hourly 09:30–16:05 KST Monday–Friday.
Runs a subset of the daily pipeline:
- OHLCV update (incremental)
- Intraday generation
- Index prices update
- Cloudflare wrangler deploy (`npm run deploy`)

Does not run macro/bonds/derivatives downloads during intraday hours.

#### Compute Scripts NOT in `daily_update.bat`

| Script | Purpose | Why not scheduled |
|--------|---------|------------------|
| `compute_hmm_regimes.py` | HMM 2-state regime fitting | Computationally heavy; needed by Step 16 but not scheduled |
| `compute_csad_herding.py` | CSAD herding metric | Research/backtest only |
| `compute_disposition_proxy.py` | Disposition effect proxy | Research/backtest only |
| `compute_illiq_spread.py` | ILLIQ/bid-ask spread | Research/backtest only |
| `compute_hedge_ratio.py` | Min-variance hedge ratio | Research/backtest only |
| `compute_survivorship_correction.py` | Survivorship bias correction | Research/backtest only |
| `compute_krx_anomalies.py` | KRX calendar anomalies | Research/backtest only |
| `download_market_index.py` | kospi/kosdaq/kospi200 daily | **Missing from pipeline — CRITICAL gap** |
| `download_financials.py` | DART financial statements | Manual (infrequent refresh, ~monthly) |
| `download_sector.py` | Sector fundamentals aggregation | Run after manual financials refresh |
| `download_delisted.py` | Delisted stock OHLCV | Historical backtest only |
| `download_historical_mcap.py` | Historical market cap | Research only |

---

## 1.4 API Health & Rate Limiting

### `krx_probe_phase0.py` — Pipeline Guardian

The probe runs as **Step 0** in `daily_update.bat` and is the only step that can abort
the entire pipeline (`exit /b 1`). Its purpose is to verify KRX Open API reachability
before spending ~30–60 minutes on downloads.

**Two operating modes**:

| Mode | Command | What it tests | Exit code |
|------|---------|--------------|-----------|
| Quick mode | `--quick --save-health` | 13 pipeline-critical endpoints only | `0`=all OK/EMPTY, `1`=any FAIL |
| Full mode | (no flags) | All 28 registered endpoints | `0`=any OK, `1`=none OK |

**Result codes** (printed with prefix):
- `[OK   ]` — endpoint exists, data returned
- `[EMPTY]` — endpoint exists, no data (holiday, parameter needed)
- `[ERR  ]` — KRX `respCode != "200"` (bad path or insufficient permissions)
- `[HTTP ]` — HTTP 4xx/5xx (path does not exist)
- `[FAIL ]` — network error or timeout

**13 pipeline-critical endpoints** checked in quick mode (`QUICK_ENDPOINTS` set):
```
idx/drvprod_dd_trd   (VKOSPI)
idx/kospi_dd_trd     (KOSPI index)
idx/kosdaq_dd_trd    (KOSDAQ index)
sto/stk_bydd_trd     (KOSPI stocks)
sto/ksq_bydd_trd     (KOSDAQ stocks)
sto/knx_bydd_trd     (KONEX stocks)
sto/stk_isu_base_info (stock info)
etp/etf_bydd_trd     (ETF)
bon/kts_bydd_trd     (government bonds)
drv/fut_bydd_trd     (futures)
drv/opt_bydd_trd     (options)
gen/gold_bydd_trd    (gold)
gen/oil_bydd_trd     (oil)
```

**Health file output**: `--save-health` writes `data/api_health.json`. Format:
```json
{
  "generated": "2026-04-06T16:00:00",
  "quick_mode": true,
  "all_ok": true,
  "results": [
    {"endpoint": "idx/drvprod_dd_trd", "status": "OK", "records": 282, ...}
  ]
}
```

This file is not currently in the Gate 1 pipeline contract but is written to disk.

**Business day detection**: `_last_business_day()` in probe script looks back up to 3 days
to find most recent Mon–Fri date. This is used as the default `basDd` parameter for all
probe calls.

---

### Rate Limiting Architecture

All rate limiting in the pipeline is enforced by a single constant:

```python
# api_constants.py line 19
RATE_LIMIT_SEC = 0.5  # 500ms between API calls
```

This constant is imported by every module that makes external API calls:

| Module | How rate limit is applied |
|--------|--------------------------|
| `download_macro.py` | `_rate_limit()` = `time.sleep(RATE_LIMIT)` between each ECOS/FRED series call |
| `download_bonds.py` | `time.sleep(RATE_LIMIT_SEC)` between each ECOS item fetch |
| `krx_api.py::KRXClient` | `_last_call` timestamp; sleeps `RATE_LIMIT_SEC - elapsed` before each call |
| `krx_otp.py::KRXOTPClient` | Same `_last_call` mechanism, applied before each OTP+CSV call pair |
| `download_kosis.py` | Single call only; no per-call rate limit needed |
| `download_market_context.py` | Single ECOS call; no per-call rate limit needed |

**Rate limit rationale**: 0.5 s is the community-validated safe rate for KRX Open API
(documented in `krx_api.py` v2 comment). Original was 0.3 s but caused intermittent
`429 Too Many Requests` responses.

---

### API Key Management

All API keys are loaded via `api_constants.load_env_key()`:

```python
# api_constants.py lines 31–42
def load_env_key(key_name, env_path=".env"):
    val = os.environ.get(key_name)
    if val:
        return val.strip()
    if os.path.isfile(env_path):
        for line in open(env_path):
            if line.strip().startswith(key_name + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None
```

**Key priority**: environment variable first, `.env` file fallback.  
**Key file location**: `{PROJECT_ROOT}/.env` (not committed to git; listed in `.gitignore`).

**Keys required for full pipeline operation**:

| Env var | Used by | Notes |
|---------|---------|-------|
| `ECOS_API_KEY` | `download_macro.py`, `download_bonds.py`, `download_market_context.py` | Free registration at ecos.bok.or.kr |
| `FRED_API_KEY` | `download_macro.py` | Free registration at fred.stlouisfed.org |
| `KOSIS_API_KEY` | `download_kosis.py` | Free registration at kosis.kr |
| `KRX_API_KEY` | `krx_api.py` (all KRX Open API calls) | 1-year validity; register at openapi.krx.co.kr |
| `DART_API_KEY` | `download_financials.py` | Free registration at opendart.fss.or.kr |

**No key required** for: OECD SDMX, KRX OTP (no persistent key; OTP is session-based).

---

### KRX Daily Quota Tracking

`KRXClient` in `krx_api.py` tracks quota at runtime:

```python
DAILY_QUOTA = 10000   # KRX official limit
QUOTA_WARN  =  9000   # Warning threshold
```

Behavior at thresholds:
- At 9,000 calls: logs `[KRX-API] WARNING: quota at 9000/10000`
- At 10,000 calls: raises `RuntimeError("KRX quota exceeded")` — callers catch this

**VKOSPI quota pre-check** (`download_vkospi.py` line 143):
Before starting multi-day downloads, it checks `client.remaining_quota` against
`total_days` needed. If insufficient, falls back to OTP immediately rather than
discovering quota exhaustion mid-download.

**Derivatives quota concern**: `download_derivatives.py` downloads both futures and
options daily for every business day in a 1-year range (~250 days × 2 calls =
~500 calls/year). VKOSPI adds ~250 calls/year. ETF adds 1 call/day. Total KRX Open API
usage estimate: ~760 calls/day → well within 10,000 limit.

---

### KRX OTP Session Management (2025-12 회원제 전환)

Since December 2025, `data.krx.co.kr` requires a logged-in browser session for OTP
requests. `KRXOTPClient` detects session expiry via:

1. OTP response containing `"LOGOUT"` substring or response length > 500 characters
2. CSV response starting with `b"LOGOUT"` or `b"<!DOCTYPE"`

Both cases raise `KRXOTPError` immediately (no retry — retrying won't fix a session issue).

**Practical implication**: The OTP-based scripts (`download_investor.py`,
`download_shortselling.py`) may fail silently in unattended automation if the KRX web
session expires. The pipeline continues (WARNING only) and writes `source: "sample"` or
`source: "unavailable"` to output files, which the JS guards detect and null out.

---

### Kiwoom WebSocket Server (Separate from Pipeline)

The Kiwoom OCX WebSocket server (`server/ws_server.py`, started via `server/start_server.bat`)
is a separate process not called by `daily_update.bat`. It provides real-time market data
in the browser's WebSocket mode.

**7-layer Kiwoom protection** (documented in `server/ws_server.py`):
1. Auto-reconnect guard (max attempts)
2. Login attempt limiter (Kiwoom locks accounts after 5 failed passwords, ~3-4 day unlock)
3. Rate limiting (TR throttle per KRX fair-use policy)
4. Concurrent connection prevention (Kiwoom allows only 1 active connection)
5. KNOWSTOCK conflict detection (cannot run simultaneously with KNOWSTOCK)
6. Session timeout handler
7. Error classification (fatal vs. recoverable)

**Dual-Python constraint**: Kiwoom OCX requires **32-bit Python 3.9** (for COM/OCX
compatibility). The pipeline scripts use **64-bit Python 3.12** (conda `krx64`). These
environments must never be mixed.

---

## Summary of Critical Findings (Sections 1.1–1.4 scope)

### CRITICAL — Must fix before production use

| ID | Finding | Impact | Recommended fix |
|----|---------|--------|----------------|
| FND-1 | `mcs` key missing from `macro_latest.json` (Gate 1 contract mismatch) | `verify.py --check pipeline` FAILS on every run | Update Gate 1 contract to remove `mcs` from `macro_latest.json` required keys; or add an `mcs` bridging field in `download_macro.py` |
| FND-2 | `download_market_index.py` not in `daily_update.bat` | `kospi200_daily.json` is stale; basis z-scores, options analytics, and options latest all use outdated spot price | Add `download_market_index.py` as Step 5.5 in `daily_update.bat` |
| FND-3 | `compute_hmm_regimes.py` not scheduled | `flow_signals.json.hmmRegimeLabel` reflects stale or null regime | Add `compute_hmm_regimes.py` after Step 8 and before Step 16 |
| FND-4 | Per-stock investor flow pipeline (`data/investors/`) not implemented | `flow_signals.json` always has `flowDataCount=0`; per-stock momentum signals all `"neutral"` | Implement `download_investor.py --per-stock` or equivalent to populate `data/investors/{code}.json` |

### HIGH — Should fix for data quality

| ID | Finding | Impact |
|----|---------|--------|
| FND-5 | `bbb_minus` confusable item code neighbor (`010400000` = 통안증권 not BBB-) | Silent wrong data if code accidentally changed |
| FND-6 | OECD CLI parser silent on header change | `korea_cli`, `china_cli`, `us_cli` absent from output with no warning |
| FND-7 | `data/backtest/` files may not be deployed to Cloudflare Pages | `flow_signals.json`, `capm_beta.json`, `eva_scores.json` → 404 in production browser |
| FND-8 | `market_context.json` VKOSPI field potential conflict with `vkospi.json` injection | Future merge operations could use stale VKOSPI value |

### NEW FINDING (not in V5)

**[NEW FINDING — FND-18]**: `daily_update.bat` header comment states "v52, 18 steps" but
the bat file runs 19 steps (0 through 18). Both the `echo` banner lines on lines 14 and
203 say "18 steps". This is a documentation inconsistency only; the actual step execution
is correct.

**[NEW FINDING — FND-19]**: `download_market_context.py` calls a `fetch_investor_flow()`
function that attempts to read from KRX data directly. This function is separate from
`download_investor.py`'s output. If `data/derivatives/investor_summary.json` exists and
was written by `download_investor.py` with `source: "sample"`, the market context file
may silently inherit stale investor flow data. No cross-check between the two investor
flow sources is performed.

**[NEW FINDING — FND-20]**: `download_bonds.py` imports `compute_bond_metrics` directly:
```python
from compute_bond_metrics import compute_bond_metrics as _compute_bond_metrics_canonical
```
This creates a hard import-time dependency. If `compute_bond_metrics.py` has a syntax
error or missing dependency (e.g., scipy not installed), `download_bonds.py` will fail
to import and Step 3 of the pipeline will abort entirely. This tight coupling is
unusual for a download script.
