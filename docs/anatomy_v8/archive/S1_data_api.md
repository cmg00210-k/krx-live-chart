# Stage 1: Data & API — The Raw Material

> **Stage Color:** Slate Blue `#2C3E5C`
>
> Every computation in CheeseStock begins with data. This stage documents not merely
> *what* data enters the system, but *why* each data source is **academically necessary** —
> which theoretical framework in Stage 2 demands its existence.

---

## 1.1 Design Philosophy: Theory-Driven Data Selection

Traditional charting platforms acquire data opportunistically — whatever APIs are cheaply available.
CheeseStock inverts this: each data source was added because a specific academic theory in the
47-document `core_data/` library requires it as input.

**Principle:** No data pipeline exists without a theoretical consumer.

This creates a traceable chain:

```
Academic Theory (Stage 2)
    requires →
Data Source (Stage 1)
    feeds →
TA Formula (Stage 3)
    renders on →
Chart (Stage 4)
    delivers via →
Website (Stage 5)
```

---

## 1.2 Data Source Inventory with Academic Justification

### 1.2.1 OHLCV Candle Data — pykrx / KRX Open API

| Property | Value |
|----------|-------|
| **Source** | pykrx (daily), KRX Open API (intraday), Kiwoom OCX (real-time) |
| **Script** | `scripts/download_ohlcv.py` |
| **Output** | `data/kospi/{code}.json`, `data/kosdaq/{code}.json` |
| **Coverage** | 2,700+ stocks, KOSPI + KOSDAQ |
| **Update** | Daily via `daily_update.bat` (Task Scheduler 09:30-16:05 KST) |

**Academic Theories Requiring OHLCV:**

| Theory | Discipline | core_data Doc | What It Needs |
|--------|-----------|---------------|---------------|
| Dow Theory | Technical Analysis | doc 06 | Price trends, highs/lows, volume confirmation |
| Nison Candlestick | Japanese TA | doc 16 | Open, High, Low, Close for body/shadow ratios |
| Bollinger Bands | Statistics | doc 02 | Close prices for rolling mean + standard deviation |
| GARCH/EWMA | Econometrics | doc 02, 34 | Log-returns r_t = ln(P_t/P_{t-1}) for volatility modeling |
| Hurst Exponent | Fractal Math | doc 01 | Close prices for R/S analysis and persistence detection |
| ATR Normalization | Risk Measurement | doc 06 | True Range (H, L, C_{t-1}) for cross-stock comparison |
| OBV | Behavioral Finance | doc 04 | Close + Volume for accumulation/distribution |

**Without OHLCV, zero Stage 3 formulas can execute.** This is the foundational data layer.

### 1.2.2 Corporate Financial Statements — DART (FSS)

| Property | Value |
|----------|-------|
| **Source** | DART OpenAPI (dart-fss.or.kr) |
| **Script** | `scripts/download_financials.py` |
| **Output** | `data/financials/{code}.json` |
| **Coverage** | 2,607/2,736 stocks (95%) |
| **Rate Limit** | 0.5s between calls, API key required |

**Academic Theories Requiring Financial Statements:**

| Theory | Discipline | core_data Doc | Data Fields Needed |
|--------|-----------|---------------|-------------------|
| DCF Valuation | Corporate Finance | doc 14 | Revenue, Net Income, Total Assets, Equity |
| PER/PBR/PSR | Financial Management | doc 14 | EPS, BPS, Revenue per share |
| Merton DD | Credit Risk | doc 47 | Total Assets, Total Debt, Equity for Distance-to-Default |
| Jensen-Meckling Agency | Agency Theory | doc 33 | Free Cash Flow, debt ratios |
| ROE/ROA | Financial Analysis | doc 14 | Net Income, Equity, Total Assets |

**Trust Architecture:**
- **Tier 1 (DART):** `source: 'dart'` — real financial statements, full metric display
- **Tier 2 (Hardcoded):** `source: 'hardcoded'` — Samsung/SK Hynix verified data + warning indicator
- **Tier 3 (Seed):** `source: 'seed'` — PRNG-generated, **all metrics cleared to "—"**

> **Epistemological Basis:** Seed data must NEVER display as real financial data.
> Applying Merton DD or DCF to PRNG-generated numbers would produce theoretically
> meaningless results — a violation of the data-theory contract.

### 1.2.3 Korean Macroeconomic Indicators — ECOS (Bank of Korea)

| Property | Value |
|----------|-------|
| **Source** | ECOS API (ecos.bok.or.kr) |
| **Script** | `scripts/download_ecos.py` |
| **Output** | `data/macro/macro_latest.json` |
| **Key Fields** | bok_rate, ktb_10y, ktb_3y, usd_krw, cpi_yoy |

**Academic Theories Requiring ECOS:**

| Theory | Discipline | core_data Doc | ECOS Data Used |
|--------|-----------|---------------|---------------|
| IS-LM Model | Macroeconomics | doc 30 | BOK base rate (r), money supply |
| Taylor Rule | Macro Policy | doc 30 | Policy rate vs inflation gap |
| Yield Curve Analysis | Fixed Income | doc 35, 44 | KTB 3Y, 10Y yields → slope = 10Y - 3Y |
| Sector Rotation | Business Cycle | doc 29 | CLI/CCI for cycle phase detection |
| Credit Spread | Credit Risk | doc 35, 47 | AA-/BBB- corporate bond yields |

**MCS (Macro Composite Score) Dependency:**
ECOS data directly feeds `_macroComposite.mcsV2` in `appWorker.js`, which adjusts
pattern confidence by ±5% based on macroeconomic regime (strong_bull/bull/bear/strong_bear).
See Stage 3, Section 3.4 (Confidence Chain CONF-3, CONF-7).

### 1.2.4 US Macroeconomic Data — FRED (Federal Reserve)

| Property | Value |
|----------|-------|
| **Source** | FRED API (Federal Reserve Bank of St. Louis) |
| **Script** | `scripts/download_fred.py` |
| **Output** | `data/macro/macro_latest.json` (merged with ECOS) |
| **Key Fields** | vix, fed_rate, us_10y, dxy |

**Academic Theories Requiring FRED:**

| Theory | Discipline | core_data Doc | FRED Data Used |
|--------|-----------|---------------|---------------|
| VIX-VKOSPI Transmission | Cross-Market | doc 28 | VIX as global risk proxy |
| Mundell-Fleming | Open Economy | doc 30 | US rates → capital flow → KRW |
| Risk-On/Risk-Off | Asset Pricing | doc 41 | DXY + VIX for global regime |
| Fed Model | Equity Valuation | doc 41 | US 10Y yield vs E/P ratio |

### 1.2.5 Korean Statistical Data — KOSIS

| Property | Value |
|----------|-------|
| **Source** | KOSIS API (kosis.kr) |
| **Script** | `scripts/download_kosis.py` |
| **Output** | `data/macro/kosis_latest.json` |
| **Key Fields** | cli, esi, retail_sales, exports, imports |

**Academic Theories Requiring KOSIS:**

| Theory | Discipline | core_data Doc | KOSIS Data Used |
|--------|-----------|---------------|----------------|
| Business Cycle Phase | Macro | doc 29 | CLI (leading), CCI (coincident) for Stovall sector rotation |
| Consumer Sentiment | Behavioral | doc 24 | ESI/CSI for fear-greed quantification |
| Export Dependency | Micro/Macro | doc 31 | Export/import data for trade-dependent sectors |

### 1.2.6 KRX Market Microstructure — KRX Open API / Scraping

| Property | Value |
|----------|-------|
| **Source** | KRX Open API (data.krx.co.kr), Naver Finance scraping (fallback) |
| **Scripts** | `scripts/download_investor.py`, `download_shortselling.py`, `compute_derivatives.py` |
| **Output** | `data/derivatives/investor_summary.json`, `shortselling_summary.json`, `derivatives_summary.json` |

**Academic Theories Requiring Microstructure Data:**

| Theory | Discipline | core_data Doc | Data Used |
|--------|-----------|---------------|-----------|
| Kyle Model | Microstructure | doc 18, 39 | Foreign/institutional/retail investor flows |
| Miller Divergence | Short Selling | doc 40 | Short Interest Ratio, Days-to-Cover |
| Grossman-Stiglitz | Information | doc 39 | Informed vs noise trader classification |
| LSV Herding | Behavioral | doc 24 | Institutional buy/sell concentration |
| Amihud ILLIQ | Liquidity | doc 18 | Volume + absolute returns for illiquidity ratio |

### 1.2.7 Derivatives Data — KRX / Computed

| Property | Value |
|----------|-------|
| **Source** | KRX (KOSPI200 futures/options), VKOSPI, computed analytics |
| **Scripts** | `scripts/download_vkospi.py`, `compute_basis.py`, `compute_options_analytics.py` |
| **Output** | `data/vkospi.json`, `data/derivatives/basis_analysis.json`, `options_analytics.json` |

**Academic Theories Requiring Derivatives:**

| Theory | Discipline | core_data Doc | Data Used |
|--------|-----------|---------------|-----------|
| Black-Scholes-Merton | Options Pricing | doc 26, 45 | VKOSPI (implied volatility index) |
| Cost-of-Carry | Futures | doc 27 | Basis = F - S*e^(rT) for arbitrage detection |
| VRP (Variance Risk Premium) | Risk Premium | doc 34 | IV² - HV² spread |
| Put-Call Ratio | Sentiment | doc 26 | PCR for contrarian signals |
| Gamma Exposure (GEX) | Dealer Hedging | doc 26, 37 | Net gamma for price pinning/acceleration |
| Straddle Implied Move | Volatility | doc 46 | ATM straddle price / underlying for expected range |

### 1.2.8 Real-time Market Data — Kiwoom OCX WebSocket

| Property | Value |
|----------|-------|
| **Source** | Kiwoom Securities OCX via WebSocket bridge |
| **Server** | `server/ws_server.py` (Python 3.9-32bit, PyQt5) |
| **Protocol** | WS (`ws://localhost:8765`) or WSS (`wss://ws.cheesestock.co.kr/ws`) |
| **Constraint** | Single login limit — 5 failed passwords = 3-4 day account lock |

**Academic Justification:**
Real-time data enables **intraday** application of the same theoretical framework that
operates on daily candles. Kyle (1985) price discovery model applies at tick level.
Market microstructure theory (doc 18, 36) specifically studies intraday dynamics.

**Dual-Mode Architecture:**
```
WebSocket Mode           File Mode
(Kiwoom OCX)            (Static JSON)
     │                       │
     ▼                       ▼
  api.js (KRX_API_CONFIG.mode)
     │
     ▼
  Same Analysis Pipeline
  (indicators → patterns → signals → backtest)
     │
     ▼
  Identical Output
```

Both modes produce the same theoretical analysis — the data source changes, not the theory.

### 1.2.9 International Indices — yfinance

| Property | Value |
|----------|-------|
| **Source** | Yahoo Finance (via yfinance Python library) |
| **Script** | `scripts/download_ohlcv.py` (index mode) |
| **Output** | International index data for cross-correlation |

**Academic Theory:** DCC-GARCH (doc 28) requires multi-market time series for
dynamic conditional correlation estimation. VIX-VKOSPI transmission channel
analysis needs synchronized US/KR data.

---

## 1.3 Data Flow to Academic Disciplines

```
┌──────────────────────────────────────────────────────────────────┐
│                    STAGE 1: DATA SOURCES                        │
│                                                                  │
│  OHLCV ──┬──→ Statistics (time series)    ──→ TA Indicators     │
│          └──→ Physics (power laws)         ──→ Tail risk        │
│                                                                  │
│  DART  ────→ Finance (valuation/credit)   ──→ Fundamentals      │
│                                                                  │
│  ECOS  ──┬──→ Economics (IS-LM, Taylor)   ──→ Macro Confidence  │
│          └──→ Finance (yield curve)        ──→ Bond Signals      │
│                                                                  │
│  FRED  ────→ Cross-Market (VIX, DXY)      ──→ Global Regime     │
│                                                                  │
│  KOSIS ────→ Economics (business cycle)    ──→ Sector Rotation   │
│                                                                  │
│  KRX   ──┬──→ Microstructure (Kyle, ILLIQ) ──→ Flow Signals     │
│  Flow    └──→ Psychology (herding, LSV)    ──→ Sentiment         │
│                                                                  │
│  Deriv ──┬──→ Finance (BSM, Greeks)        ──→ Vol Regime        │
│          └──→ Finance (cost-of-carry)      ──→ Basis Analysis    │
│                                                                  │
│  Kiwoom ───→ Microstructure (price disc.)  ──→ Real-time TA     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1.4 Data Caching Architecture

Three-layer caching ensures performant access without sacrificing data freshness:

| Layer | Location | Scope | TTL | Academic Rationale |
|-------|----------|-------|-----|-------------------|
| L1 Memory | JS variables | Session | Until page reload | Immediate access for real-time computation |
| L2 IndexedDB | `_idb` in api.js | Persistent | Until OHLCV update | Eliminates network re-fetch on page reload |
| L3 Network | Fetch API | Remote | Per request | Source of truth for daily updates |

**Staleness Detection** (`_checkDataStaleness` in appWorker.js):
- >14 days: console warning
- >30 days: `_staleDataSources.add(name)` → confidence adjustments skip this source
- Rationale: Applying outdated macro data to current patterns violates the assumption
  of contemporaneous measurement required by most econometric models.

---

## 1.5 Data Trust & Epistemological Integrity

| Trust Level | Source Tag | Display | Theoretical Validity |
|-------------|-----------|---------|---------------------|
| **Full** | `'dart'` | All metrics | Theory applies — real financial data |
| **Verified** | `'hardcoded'` | All metrics + warning | Theory applies — manually verified subset |
| **None** | `'seed'` | All metrics "—" | Theory DOES NOT apply — PRNG data |
| **Sample** | `'sample'` | Nulled out | Theory DOES NOT apply — placeholder |
| **Unavailable** | `'unavailable'` | Nulled out | Source API failure — graceful degradation |

`appWorker.js` lines 318-325 enforce this contract:
```javascript
// source === "sample" → null out data to prevent false theory application
if (_investorData && _investorData.source === 'sample') _investorData = null;
if (_shortSellingData && _shortSellingData.source === 'sample') _shortSellingData = null;
```

---

## 1.6 Forward Reference Table

| Data Source | Academic Discipline (Stage 2) | Formula ID (Stage 3) | JS Function |
|-------------|------------------------------|---------------------|-------------|
| OHLCV Close | Statistics → Time Series | I-01 to I-08 | calcMA, calcEMA, calcBB, calcRSI, calcMACD |
| OHLCV HLCV | Risk Measurement | I-09 (ATR) | calcATR |
| OHLCV Close | Fractal Math | I-16 (Hurst) | calcHurst |
| OHLCV Close | Control Theory | I-08 (Kalman) | calcKalman |
| OHLCV Returns | EVT → Statistics | I-17, I-18 (Hill, GPD) | calcHillEstimator, calcGPDFit |
| OHLCV Returns | Econometrics | I-14 (EWMA) | calcEWMAVol |
| DART Financials | Corporate Finance | CONF-6 (Merton DD) | _applyMertonDD |
| ECOS Macro | Macroeconomics | CONF-3 (Macro) | _applyMacroConfidence |
| FRED VIX | Cross-Market | CONF-5 (Derivatives) | _applyDerivativesConfidence |
| KRX Investors | Microstructure | CONF-4 (Micro) | _applyMicroConfidence |
| VKOSPI | Derivatives | VRP, Vol Regime | calcVRP |
| Basis | Futures Theory | Basis Spread | _derivativesData.basis |
| Flow Signals | Bayesian/HMM | CONF-7 (Phase 8) | _applyPhase8Confidence |

---

*Stage 1 establishes the empirical foundation. Every data point that enters CheeseStock
has a theoretical consumer in Stage 2. No data is collected without purpose;
no theory is implemented without data.*

**Next:** Stage 2 traces how these data sources are transformed through academic
disciplines into the mathematical frameworks that power technical analysis.
