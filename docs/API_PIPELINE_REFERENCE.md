# API Pipeline Reference (2026-04-04)

> Claude Agent가 API 호출을 추적할 때 이 문서를 읽습니다.
> 각 API의 정확한 통계코드, 항목코드, URL 구성, 출력 JSON 경로, JS 소비 지점을 기록합니다.

## .env API Keys (5개)

| Key | Service | Length | Format |
|-----|---------|--------|--------|
| `ECOS_API_KEY` | 한국은행 ECOS | 20 | 영문 대문자 |
| `KRX_API_KEY` | KRX Open API | 40 | 영숫자+대문자 |
| `DART_API_KEY` | 전자공시 DART | 40 | 영숫자 소문자 |
| `FRED_API_KEY` | St. Louis Fed | 32 | 영숫자 소문자 |
| `KOSIS_API_KEY` | 국가통계포털 | ~44 | Base64 인코딩 |

추가: `KRX_API_CLIENT_ID`, `KRX_API_CLIENT_SECRET` (KRX Open API OAuth)

---

## 1. ECOS (한국은행 경제통계)

### Base URL
```
https://ecos.bok.or.kr/api
```

### URL 템플릿
```
{BASE}/StatisticSearch/{API_KEY}/json/kr/{start}/{end}/{STAT_CODE}/{FREQ}/{START_DATE}/{END_DATE}/{ITEM_CODE1}[/{ITEM_CODE2}]
```

### 호출 스크립트 3개

#### 1.1 download_macro.py — 15개 시리즈

| # | Key | Stat Code | Item Code | Freq | Name |
|---|-----|-----------|-----------|------|------|
| 1 | bok_rate | 722Y001 | 0101000 | M | 한국은행 기준금리 |
| 2 | ktb10y | 721Y001 | 5050000 | M | 국고채 10년 |
| 3 | ktb3y | 721Y001 | 5020000 | M | 국고채 3년 |
| 4 | m2 | 161Y006 | BBHA00 | M | M2 광의통화 |
| 5 | cli | 901Y067 | I16A | M | 경기선행지수 순환변동치 |
| 6 | cpi | 901Y009 | 0 | M | 소비자물가지수 |
| 7 | bsi_mfg | 512Y013 | C0000/AA | M | 제조업 BSI 업황 |
| 8 | export_value | 901Y118 | T002 | M | 통관수출액 |
| 9 | ipi | 901Y033 | A00/2 | M | 산업생산지수 |
| 10 | foreign_equity | 301Y013 | BOPF22100000 | M | 외인 주식투자 순유입 |
| 11 | cd_rate_91d | 721Y001 | 2010000 | M | CD금리 91일 |
| 12 | cp_rate_91d | 721Y001 | 4020000 | M | CP금리 91일 |
| 13 | household_credit | 151Y002 | 1110000 | M | 가계대출 |
| 14 | unemployment_rate | 901Y027 | I61BC | M | 실업률 |
| 15 | house_price_idx | 901Y064 | P65A | M | 주택매매가격 |

**출력**: `data/macro/macro_latest.json` → JS `_macroLatest` (appWorker.js:242)

**주의**: 슬래시 포함 항목코드(C0000/AA, A00/2)는 `urllib.parse.quote()`로 인코딩 필수.

#### 1.2 download_bonds.py — 9개 항목 (일별)

| Key | Stat Code | Item Code | Name |
|-----|-----------|-----------|------|
| ktb_1y | 817Y002 | 010190000 | 국고채(1년) |
| ktb_2y | 817Y002 | 010195000 | 국고채(2년) |
| ktb_3y | 817Y002 | 010200000 | 국고채(3년) |
| ktb_5y | 817Y002 | 010200001 | 국고채(5년) |
| ktb_10y | 817Y002 | 010210000 | 국고채(10년) |
| ktb_20y | 817Y002 | 010220000 | 국고채(20년) |
| ktb_30y | 817Y002 | 010230000 | 국고채(30년) |
| aa_minus | 817Y002 | 010300000 | 회사채(3년, AA-) |
| bbb_minus | 817Y002 | 010320000 | 회사채(3년, BBB-) |

**Freq**: D (일별) — 817Y002는 일별 전용, 월별(M) 요청 시 에러.
**출력**: `data/macro/bonds_latest.json` → JS `_bondsLatest` (appWorker.js:243)

#### 1.3 download_market_context.py — CCSI (FIXED)

| Key | Stat Code | Item Code (G1) | Item Code (G2) | Freq | Status |
|-----|-----------|-----------------|-----------------|------|--------|
| ccsi | 511Y002 | FME | 99988 | M | **FIXED** |

511Y002 = 소비자동향조사 (2-그룹 테이블). G1: FME=소비자심리지수, G2: 99988=전체(전국).
주기코드: `M` (not `MM`). 정상범위: 80~120 (100=장기평균).
**출력**: `data/market_context.json` → JS `_marketContext` (appState.js)

### 폐기된 코드 (사용 금지)

| Code | Item | Reason |
|------|------|--------|
| 101Y003 | * | 2004년 폐기 (M2 구지표) |
| 817Y002 | * (월별) | 일별 전용, MM 요청 시 에러 |
| BBGA00 | (161Y006) | 존재하지 않는 item_code |

---

## 2. KRX (한국거래소)

### Open API
```
Base URL: https://data-dbg.krx.co.kr/svc/apis
Auth: AUTH_KEY header
Rate Limit: 0.5s, Daily Quota: 10,000
```

### OTP 방식
```
OTP URL: http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd
CSV URL: http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd
```

### 실제 사용 엔드포인트

| Script | Method | Endpoint / StatURL | Output |
|--------|--------|-------------------|--------|
| download_vkospi.py | Open API | idx/drvprod_dd_trd | data/vkospi.json |
| download_derivatives.py | Open API | drv/fut_bydd_trd | data/derivatives/futures_daily.json |
| download_derivatives.py | Open API | drv/opt_bydd_trd | data/derivatives/options_daily.json |
| download_etf.py | Open API | etp/etf_bydd_trd | data/derivatives/etf_daily.json |
| download_investor.py | OTP | MDCSTAT02301 | data/derivatives/investor_daily.json |
| download_investor.py | OTP | MDCSTAT03602 | data/derivatives/foreign_flow.json |
| download_shortselling.py | OTP | MDCSTAT08601 | data/derivatives/shortselling_daily.json |
| download_shortselling.py | OTP | MDCSTAT08301 | data/derivatives/shortselling_balance.json |
| download_ohlcv.py | pykrx | (indirect) | data/kospi/*.json, data/kosdaq/*.json |

### JS 소비
- `data/vkospi.json` → signalEngine.js, appWorker.js
- `data/derivatives/*` → appState.js (loadDerivativesData)

---

## 3. DART (전자공시)

### Base URL
```
https://opendart.fss.or.kr/api
```

### 엔드포인트

| Endpoint | Purpose | Params |
|----------|---------|--------|
| /corpCode.xml | corp_code 매핑 | crtfc_key |
| /fnlttSinglAcnt.json | 재무제표 | crtfc_key, corp_code, bsns_year, reprt_code |
| /stockTotqySttus.json | 발행주식수 | crtfc_key, corp_code, bsns_year, reprt_code |
| /company.json | 기업정보 | crtfc_key, corp_code |

### reprt_code 매핑

| Code | Report | Period |
|------|--------|--------|
| 11013 | 1분기보고서 | Q1 |
| 11012 | 반기보고서 | Q2 |
| 11014 | 3분기보고서 | Q3 |
| 11011 | 사업보고서 | Annual |

### 계정과목 한국어 매핑

```
매출액 / 수익(매출액) / 영업수익  → revenue
영업이익 / 영업이익(손실)         → op
당기순이익 / 당기순이익(손실)     → ni
자산총계                          → total_assets
부채총계                          → total_liabilities
자본총계                          → total_equity
기본주당이익(손실)                → eps
```

### CFS/OFS: CFS(연결) 우선, OFS(별도) fallback
### Rate Limit: 0.5s, Status: 000=OK, 013=no data, 010=key error, 011=quota
### Output: `data/financials/{code}.json` → JS `getFinancialData()` (data.js)

---

## 4. FRED (Federal Reserve Economic Data)

### Base URL
```
https://api.stlouisfed.org/fred/series/observations
```

### 호출: download_macro.py (단일 파일)

| # | Key | Series ID | Name |
|---|-----|-----------|------|
| 1 | fed_rate | FEDFUNDS | US Fed Funds Rate |
| 2 | us10y | DGS10 | US 10Y Treasury |
| 3 | us_cpi | CPIAUCSL | US CPI (SA) |
| 4 | us_unemp | UNRATE | US Unemployment |
| 5 | us_breakeven | T10YIE | 10Y Breakeven Inflation |
| 6 | us_hy_spread | BAMLH0A0HYM2 | US HY Spread |
| 7 | dxy_fred | DTWEXBGS | Trade-Weighted USD |
| 8 | vix_fred | VIXCLS | VIX Daily Close |

### Params: series_id, api_key, file_type=json, sort_order=desc, limit=100
### Output: `data/macro/macro_latest.json` (FRED fields merged with ECOS fields)
### JS: `_macroLatest.fed_rate`, `_macroLatest.us_hy_spread`, etc.

---

## 5. KOSIS (국가통계포털)

### Base URL
```
https://kosis.kr/openapi/Param/statisticsParameterData.do
```

### 호출: download_kosis.py (단일 파일)

### 통계표: DT_1C8016 (경기종합지수), orgId=101 (통계청)

| # | C1 Code | Key | Name |
|---|---------|-----|------|
| 1 | A01 | cli_composite | 선행종합지수 |
| 2 | A0102 | esi | 경제심리지수 (ESI) |
| 3 | A0104 | construction_orders | 건설수주(실질) |
| 4 | A0106 | kospi_kosis | 종합주가지수 |
| 5 | A0107 | rate_spread_5y | 금리스프레드 |
| 6 | B02 | cci_composite | 동행종합지수 |
| 7 | B0201 | ipi_all | 산업생산지수 |
| 8 | B0204 | retail_sales | 소매판매지수 |
| 9 | B0207 | employed_nonfarm | 비농림어업 취업자수 |
| 10 | C03 | lag_composite | 후행종합지수 |
| 11 | C0301 | inventory_index | 제품재고지수 |
| 12 | C0305 | cp_yield_kosis | CP수익률 |

### Params: method=getList, apiKey, orgId=101, tblId=DT_1C8016, itmId=T1+, objL1=ALL, prdSe=M
### Output: `data/macro/kosis_latest.json`, `data/macro/kosis_history.json`
### JS: `_kosisLatest` (appWorker.js:244)

---

## Data Flow Summary

```
.env API Keys
    │
    ├── ECOS ──→ download_macro.py (15), download_bonds.py (9), download_market_context.py (1)
    │              ↓                       ↓                        ↓
    │         macro_latest.json       bonds_latest.json        market_context.json
    │              ↓                       ↓                        ↓
    │         _macroLatest             _bondsLatest             _marketContext
    │
    ├── KRX ───→ download_vkospi.py, download_derivatives.py, download_investor.py, ...
    │              ↓
    │         vkospi.json, derivatives/*.json, investor_*.json
    │              ↓
    │         signalEngine, appWorker, appState
    │
    ├── DART ──→ download_financials.py
    │              ↓
    │         data/financials/{code}.json
    │              ↓
    │         getFinancialData() → financials.js UI
    │
    ├── FRED ──→ download_macro.py (merged with ECOS)
    │              ↓
    │         macro_latest.json (fed_rate, vix_fred, us_hy_spread, ...)
    │
    └── KOSIS ─→ download_kosis.py
                   ↓
              kosis_latest.json → _kosisLatest → MCS v2 calculation
```

## Known Bugs

1. ~~**CCSI**: download_market_context.py uses wrong stat code~~ — **FIXED** (511Y002/M/FME/99988, CCSI=107.0 confirmed)
2. ~~**options_latest.json**: Missing transform script~~ — **FIXED** (prepare_options_latest.py)
3. **flow_signals**: Per-stock investor data collection pipeline not implemented
4. **ECOS server**: Intermittent ERROR-100 — root cause was freq code `MM` vs `M` (511Y002 uses `M`)
