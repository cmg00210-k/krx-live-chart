# S3 Signal Engine & Backtester -- Production Anatomy v7

> **Scope**: `js/signalEngine.js` (3,117 lines), `js/backtester.js` (2,538 lines)
> **Date**: 2026-04-06
> **Auditor**: Statistical Validation Expert (Claude Opus 4.6)
> **Grade**: B+ (38 VALID, 16 CONCERN, 4 WARNING, 3 CRITICAL remaining)
> **Bridge Docs**: `pattern_impl/03_signal_engine.md`, `pattern_impl/04_backtester.md`

---

## Table of Contents

- [3.3 Signal Engine](#33-signal-engine)
  - [3.3.1 Base Signal Catalog (SIG-01 through SIG-19)](#331-base-signal-catalog)
  - [3.3.2 Composite Signal Definitions](#332-composite-signal-definitions)
  - [3.3.3 Divergence Detection](#333-divergence-detection)
  - [3.3.4 Post-Filters](#334-post-filters)
  - [3.3.5 Sentiment & Statistics](#335-sentiment--statistics)
- [3.4 Backtester Engine](#34-backtester-engine)
  - [3.4.1 Transaction Cost Model](#341-transaction-cost-model)
  - [3.4.2 WLS Regression Pipeline](#342-wls-regression-pipeline)
  - [3.4.3 LinUCB Multi-Armed Bandit](#343-linucb-multi-armed-bandit)
  - [3.4.4 Survivorship Bias Correction](#344-survivorship-bias-correction)
  - [3.4.5 Pattern Occurrence Collection](#345-pattern-occurrence-collection)
- [3.5 Backtest Statistics](#35-backtest-statistics)
  - [3.5.1 Per-Horizon Metrics Catalog](#351-per-horizon-metrics-catalog)
  - [3.5.2 Bootstrap Confidence Intervals](#352-bootstrap-confidence-intervals)
  - [3.5.3 Multiple Testing Correction](#353-multiple-testing-correction)
  - [3.5.4 Hansen SPA Test](#354-hansen-spa-test)
  - [3.5.5 Walk-Forward Evaluation](#355-walk-forward-evaluation)
  - [3.5.6 Reliability Tier System](#356-reliability-tier-system)
  - [3.5.7 Composite Score & Grade](#357-composite-score--grade)
  - [3.5.8 Jensen's Alpha & CAPM](#358-jensens-alpha--capm)
  - [3.5.9 Information Coefficient (IC)](#359-information-coefficient-ic)
- [3.6 Statistical Validation Summary](#36-statistical-validation-summary)
  - [3.6.1 VALID Methodologies](#361-valid-methodologies)
  - [3.6.2 CRITICAL Issues](#362-critical-issues)
  - [3.6.3 WARNING Issues](#363-warning-issues)
  - [3.6.4 Constant Registry (D-Tagged)](#364-constant-registry)

---

## 3.3 Signal Engine

**File**: `js/signalEngine.js`
**Global**: `signalEngine` (SignalEngine), `COMPOSITE_SIGNAL_DEFS` (Array)
**Dependencies**: `indicators.js` (IndicatorCache), `patterns.js` (patternEngine)

**Module-Level Globals (V7):**

| Global | Type | Location | Purpose | Grade |
|--------|------|----------|---------|-------|
| `PATTERN_WR_KRX` | `var`, Object (28 entries) | signalEngine.js:427-445 | KRX 5-year empirical win rate for 28 patterns (buy/sell). Source: `data/backtest/signal_wr.json` via offline calibration | [B] |
| `ANTI_PREDICTOR_THRESHOLD` | `var`, 48 | signalEngine.js:448 | WR gate threshold. Patterns with WR < 48% are anti-predictive (below coin flip minus KRX ~2% round-trip cost). BLL (1992) null = 50% | [B-1] |

### 3.3.1 Base Signal Catalog

The signal engine detects 40+ individual signal types across 19 detection methods grouped into 7 indicator categories plus derivatives/flow signals. Each signal emits `{ type, source, signal, strength, confidence, index, time, description }`.

#### SIG-01: MA Cross

| Field | Value |
|-------|-------|
| Method | `_detectMACross()` line 776 |
| Indicators | MA(5), MA(20), EMA(12), EMA(26), ATR(14) |
| Signals | `goldenCross` (buy), `deadCross` (sell) |
| Trigger | MA5/MA20 crossover with ATR gap filter: `abs(diff) >= ATR * 0.4` |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| ATR gap ratio | 0.4 | [C] | KRX noise filter, empirical | signalEngine.js:792 | Medium |
| goldenCross conf (EMA confirm) | 72 | [D] | Practitioner | signalEngine.js:803 | Medium |
| goldenCross conf (no confirm) | 60 | [D] | Practitioner | signalEngine.js:803 | Medium |
| deadCross conf (EMA confirm) | 70 | [D] | Practitioner, -2pp sell asymmetry | signalEngine.js:824 | Medium |
| deadCross conf (no confirm) | 58 | [D] | Practitioner | signalEngine.js:824 | Medium |

**Statistical Note**: EMA confirmation boost (+12pp) lacks published calibration. The 2pp buy-sell asymmetry reflects KRX short-sale constraints (empirical, not formal test). **[CONCERN]** -- no measured WR validates these specific confidence deltas.

#### SIG-02: MA Alignment

| Field | Value |
|-------|-------|
| Method | `_detectMAAlignment()` line 851 |
| Indicators | MA(5), MA(20), MA(60) |
| Signals | `maAlignment_bull` (buy), `maAlignment_bear` (sell) |
| Trigger | MA5 > MA20 > MA60 entry transition (not already aligned) |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| bull conf | 65 | [D] | Murphy (1999), unvalidated | signalEngine.js:875 | Low |
| bear conf | 63 | [D] | Murphy (1999), unvalidated | signalEngine.js:894 | Low |
| measuredWR | null | -- | Backtest not measured | signalEngine.js:879 | -- |

**[WARNING]**: `measuredWR: null` -- signal confidence assigned without empirical validation. Functions as composite filter only (weight=2), so impact is bounded.

#### SIG-03: MACD Cross

| Field | Value |
|-------|-------|
| Method | `_detectMACDSignals()` line 914 |
| Indicators | MACD(12,26,9): macdLine, signalLine, histogram |
| Signals | `macdBullishCross` (buy), `macdBearishCross` (sell) |
| Trigger | MACD/Signal line crossover |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| bull conf (above 0-line) | 70 | [D] | Practitioner | signalEngine.js:934 | Medium |
| bull conf (below 0-line) | 58 | [D] | Practitioner | signalEngine.js:934 | Medium |
| bear conf (below 0-line) | 68 | [D] | Practitioner | signalEngine.js:950 | Medium |
| bear conf (above 0-line) | 56 | [D] | Practitioner | signalEngine.js:950 | Medium |

VALID: Histogram zero-cross removed to prevent double-counting (mathematically identical to MACD cross). Divergence detection delegated to `_detectDivergence()` with lookback=40.

#### SIG-04: RSI Signals

| Field | Value |
|-------|-------|
| Method | `_detectRSISignals()` line 974 |
| Indicators | RSI(14), Hurst exponent (R/S analysis) |
| Signals | `rsiOversold`, `rsiOversoldExit`, `rsiOverbought`, `rsiOverboughtExit` |
| Trigger | RSI crosses 30 (oversold) or 70 (overbought) boundaries |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| RSI oversold | 30 | [A] | Wilder (1978) | signalEngine.js:1001 | Low (canonical) |
| RSI overbought | 70 | [A] | Wilder (1978) | signalEngine.js:1030 | Low (canonical) |
| extremeBonus | floor(abs(RSI-50)/10)*2 | [D] | Empirical | signalEngine.js:998 | Medium |
| hBase (no Hurst) | 55 | [D] | Fallback neutral | signalEngine.js:987 | High |
| Hurst R^2 quality gate | 0.70 | [D] | Empirical | signalEngine.js:984 | Medium |

VALID: Hurst-RSI integration (C-5 CZW). H > 0.6 trending reduces RSI reversal confidence; H < 0.4 mean-reverting increases it. R^2 quality gate prevents low-quality Hurst estimates from influencing confidence. Theoretically sound: RSI reversal signals are more reliable in mean-reverting regimes (Lo 2004 AMH).

#### SIG-05: Bollinger Band Signals

| Field | Value |
|-------|-------|
| Method | `_detectBBSignals()` line 1074, `_detectBBSqueeze()` line 1133 |
| Indicators | BB(20,2) or bbEVT(20,2) with Hill alpha fat-tail correction |
| Signals | `bbLowerBounce` (buy), `bbUpperBreak` (neutral), `bbSqueeze` (directional) |
| Trigger | Band touch/break + squeeze-expansion |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| BB period | 20 | [A] | Bollinger (2001) | indicators.js | Low (canonical) |
| BB multiplier | 2 | [A] | Bollinger (2001) | indicators.js | Low (canonical) |
| squeeze percentile | 10% | [A] | Bollinger (2001) | signalEngine.js:1154 | Low |
| durBoost 20-bar | +8 | [D] | Practitioner | signalEngine.js:1174 | Low |
| durBoost 10-bar | +4 | [D] | Practitioner | signalEngine.js:1174 | Low |
| bounce conf | 60 | [D] | Practitioner | signalEngine.js:1098 | Medium |
| break conf | 50 | [D] | Practitioner | signalEngine.js:1115 | Low |

VALID: EVT-aware BB (Gopikrishnan 1999) -- Hill alpha < 4 automatically widens bands for heavy-tailed returns. bbUpperBreak correctly classified as neutral (strong trends persist through upper band).

#### SIG-06: Volume Signals

| Field | Value |
|-------|-------|
| Method | `_detectVolumeSignals()` line 1200, `_detectVolumeExhaustion()` line 1266 |
| Indicators | volZScore(i, 20), volRatio(i, 20), ADV level |
| Signals | `volumeBreakout` (buy), `volumeSelloff` (sell), `volumeExhaustion` (neutral) |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| z-threshold | 2.0 | [A] | Upper 2.28% of normal distribution | signalEngine.js:1204 | Low (canonical) |
| buy conf formula | min(80, 50+15*ln(z)) | [D] | Information-theoretic (Ane & Geman 2000) | signalEngine.js:1220 | High |
| sell conf formula | min(78, 48+15*ln(z)) | [D] | Ane & Geman (2000) | signalEngine.js:1221 | High |
| ADV adj lv0 | -5 | [D] | Micro-cap liquidity penalty | signalEngine.js:1224 | Medium |
| ADV adj lv1 | -2 | [D] | Small-cap liquidity penalty | signalEngine.js:1224 | Medium |
| consecutive exhaustion | 5 bars | [D] | Practitioner | signalEngine.js:1269 | Low |

VALID: Z-score normalization auto-corrects for large-cap/small-cap volume distribution differences. Logarithmic confidence mapping (z -> conf) is information-theoretically consistent. ADV adjustment penalizes illiquid stocks where volume spikes are noisier.

#### SIG-07: OBV Divergence

| Field | Value |
|-------|-------|
| Method | `_detectOBVDivergence()` line 1321 |
| Indicators | OBV (cumulative), closes, ATR(14) |
| Signals | `obvBullishDivergence` (buy), `obvBearishDivergence` (sell) |
| Reference | Granville (1963), Murphy (1999) Ch.7 |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| lookback | 20 | [B] | ~1 trading month | signalEngine.js:1329 | Medium |
| swingOrder | 3 | [B] | Zigzag confirmation | signalEngine.js:1335 | Medium |
| bull conf formula | min(75, 50+12*ln(gap+0.5)) | [D] | ATR-normalized | signalEngine.js:1363 | Medium |
| bear conf formula | min(73, 48+12*ln(gap+0.5)) | [D] | ATR-normalized | signalEngine.js:1393 | Medium |

**[CONCERN]**: 3-bar look-ahead in swing detection. Signals are timestamped at the swing point, not the confirmation bar. For chart display this is acceptable; for real-time trading it introduces swingOrder bars of latency.

#### SIG-08: Ichimoku Signals

| Field | Value |
|-------|-------|
| Method | `_detectIchimokuSignals()` line 1429 |
| Indicators | Ichimoku (tenkan 9, kijun 26, spanA, spanB, chikou) |
| Signals | `ichimokuBullishCross`, `ichimokuBearishCross`, `ichimokuCloudBreakout`, `ichimokuCloudBreakdown` |
| Reference | Hosoda (1969) |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| TK cross conf (above cloud) | 72 | [D] | Hosoda (1969) | signalEngine.js | Medium |
| TK cross conf (below cloud) | 65 | [D] | Hosoda (1969) | signalEngine.js | Medium |
| cloud breakout conf | 70 | [D] | Hosoda (1969) | signalEngine.js | Medium |
| chikou bonus | +5 | [D] | Lagging span confirmation | signalEngine.js | Low |

#### SIG-09: Hurst Regime Filter

| Field | Value |
|-------|-------|
| Method | `_detectHurstSignal()` line 1553 |
| Indicators | Hurst exponent (R/S analysis) |
| Signals | `hurstTrending` (neutral), `hurstMeanReverting` (neutral) |
| Reference | Mandelbrot (1963), Lo (1991) |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| H trending threshold | 0.6 | [B] | Mandelbrot (1963) | signalEngine.js | Low |
| H reverting threshold | 0.4 | [B] | Mandelbrot (1963) | signalEngine.js | Low |
| R^2 quality gate | 0.50 | [D] | Empirical | signalEngine.js | Medium |
| base conf | round(55 * rQual) | [D] | Empirical | signalEngine.js | Low |

VALID: Used as regime filter only (weight=0). Does not generate directional signals. R^2 quality gate correctly prevents noisy Hurst estimates from affecting downstream.

#### SIG-10: StochRSI Signals

| Field | Value |
|-------|-------|
| Method | `_detectStochRSISignals()` line 1605 |
| Indicators | RSI(14), StochRSI(14,3,3,14) |
| Signals | `stochRsiOversold` (buy), `stochRsiOverbought` (sell) |
| Reference | Chande & Kroll (1994) |

Only activates in RSI neutral zone (40-60) to prevent double-counting with RSI signals. Cooldown: 5 bars.

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| RSI neutral zone | [40, 60] | [D] | Anti-double-counting | signalEngine.js | Medium |
| K oversold | 10 | [B] | Chande & Kroll (1994) | signalEngine.js | Low |
| K overbought | 90 | [B] | Chande & Kroll (1994) | signalEngine.js | Low |
| conf | min(55, 48+bonus) | [D] | Practitioner | signalEngine.js | Low |
| cooldown | 5 bars | [D] | Whipsaw prevention | signalEngine.js | Low |

#### SIG-11: Stochastic Oscillator

| Field | Value |
|-------|-------|
| Method | `_detectStochasticSignals()` line 1674 |
| Indicators | Slow Stochastic(14,3,3), Williams %R(14) |
| Signals | `stochasticOversold` (buy), `stochasticOverbought` (sell) |
| Reference | Lane (1984), Williams (1979) |

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| OVERSOLD | 20 | [A] | Lane (1984) | signalEngine.js | Low (canonical) |
| OVERBOUGHT | 80 | [A] | Lane (1984) | signalEngine.js | Low (canonical) |
| EXTREME_OS | 10 | [B] | Bulkowski (2005) | signalEngine.js | Low |
| COOLDOWN | 7 bars | [B] | 14-period half-cycle | signalEngine.js | Low |
| BASE_CONF | 52 | [D] | Practitioner | signalEngine.js | Medium |
| WR_BONUS | 3 | [D] | Williams %R confluence | signalEngine.js | Low |

VALID: Williams %R = -(100 - Raw %K) is mathematically equivalent to raw Stochastic. Correctly implemented as confluence bonus (+3) rather than independent signal, avoiding double-counting.

#### SIG-12: Kalman Filter

| Field | Value |
|-------|-------|
| Method | `_detectKalmanSignals()` line 2056 |
| Indicators | Kalman filter (Q=0.1, R=1.0) |
| Signals | `kalmanUpturn` (buy), `kalmanDownturn` (sell) |
| Reference | Kalman (1960), A. Harvey (1989) |

Composite condition only (weight=0). Steady-state K ~ 0.095, equivalent to EMA(~20) response speed. Detects second derivative sign change (inflection point).

| Constant | Value | Grade | Source | File:Line | Sensitivity |
|----------|-------|-------|--------|-----------|-------------|
| Q (process noise) | 0.1 | [D] | Empirical | signalEngine.js:2058 | Medium |
| R (measurement noise) | 1.0 | [D] | Empirical | signalEngine.js:2058 | Medium |
| conf | 40 | [D] | Low -- composite only | signalEngine.js:2071 | Low |

#### SIG-13 through SIG-18: C-3 Idle Indicator Signals

Six additional signal types from previously unused indicators, all with weight > 0 and integrated into composite signals:

| ID | Signal Type | Method | Line | Trigger | Conf | Grade |
|----|-------------|--------|------|---------|------|-------|
| SIG-13 | `cciOversoldExit` / `cciOverboughtExit` | `_detectCCISignals()` | 2633 | CCI crosses +/-100 | 45 | [D] |
| SIG-14 | `adxBullishCross` / `adxBearishCross` | `_detectADXSignals()` | 2666 | +DI/-DI cross, ADX>25 | 55 | [D] |
| SIG-15 | `williamsROversold` / `williamsROverbought` | `_detectWilliamsRSignals()` | 2700 | %R crosses -80/-20 | 42 | [D] |
| SIG-16 | `atrExpansion` | `_detectATRExpansion()` | 2733 | ATR/MA(ATR,20) >= 1.5 | 50 | [D] |
| SIG-17 | `cusumBreak` | `_detectCUSUMBreak()` | 2761 | Online CUSUM breakpoint | 52 | [D] |
| SIG-18 | `volRegimeExpand` / `volRegimeHigh` | `_detectVolRegimeChange()` | 2786 | EWMA vol regime shift | 48/55 | [D] |

#### SIG-19: Derivatives/Flow Signals (Phase KRX-API)

External JSON data-driven signals. Graceful no-op when data unavailable.

| Signal Type | Method | Line | Data Source | Trigger | Conf | Reference |
|-------------|--------|------|-------------|---------|------|-----------|
| `basisContango`/`basisBackwardation` | `_detectBasisSignal()` | 2409 | derivatives_summary.json | abs(basisPct) > 0.5-2.0% | 55-72 | Doc27, Bessembinder & Seguin (1993) |
| `pcrFearExtreme`/`pcrGreedExtreme` | `_detectPCRSignal()` | 2448 | derivatives_summary.json | PCR > 1.3 / < 0.5 | 62 | Doc37, Pan & Poteshman (2006) |
| `flowAlignedBuy`/`flowAlignedSell` | `_detectFlowSignal()` | 2472 | investor_summary.json | Foreign+institutional aligned | 65 | Doc39, Choe/Kho/Stulz (2005) |
| `flowForeignBuy`/`flowForeignSell` | | | investor_summary.json | Foreign 20d cumulative >5000B | 58 | Doc39 |
| `flowLeadershipBuy`/`flowLeadershipSell` | | | investor_summary.json | Foreign 1d >2000-5000B | 62-68 | Kyle (1985), Doc39 |
| `erpUndervalued`/`erpOvervalued` | `_detectERPSignal()` | 2539 | Computed E/P - KTB10Y | ERP > 5.5% / < 1.0% | 60 | Doc41, Asness (2003) |
| `etfBullishExtreme`/`etfBearishExtreme` | `_detectETFSentiment()` | 2573 | etf_summary.json | leverageRatio > 3.0 / < 0.3 | 55 | Doc38, Cheng & Madhavan (2009) |
| `shortHighSIR`/`shortSqueeze` | `_detectShortInterest()` | 2597 | shortselling_summary.json | market_short > 8% / squeeze candidates | 56/63 | Doc40, Desai et al. (2002) |

All derivatives/flow signals are grade [D] -- market-specific thresholds without published KRX calibration.

---

### 3.3.2 Composite Signal Definitions

`COMPOSITE_SIGNAL_DEFS` (line 15): 30 composite signals in 3-tier structure. All use `window: 5` bars.

#### Matching Algorithm

`_matchComposites()` (line 2242):
1. Indicator signals + candle patterns merged into unified type-index map
2. For each composite definition, search for all `required` signals within `window` bars
3. All `required` must be present within window for match
4. Count `optional` signals present; add `optionalBonus * count` to confidence
5. Dual Confidence: display = min(95, base + bonus), prediction = `_predMap` calibrated
6. Platt calibration from `rl_policy.platt_params` applied when available

#### Tier 1: Strong (3+ conditions simultaneous)

| ID | Dir | baseConf | Grade | Required | Optional |
|----|-----|----------|-------|----------|----------|
| strongBuy_hammerRsiVolume | buy | 61 | [C-8] | hammer, rsiOversoldExit | volumeBreakout |
| strongSell_shootingMacdVol | sell | 69 | [C-8] | shootingStar, macdBearishCross | volumeSelloff |
| buy_doubleBottomNeckVol | buy | 68 | [S-5] | doubleBottom, volumeBreakout | goldenCross |
| sell_doubleTopNeckVol | sell | 75 | [E-4] | doubleTop, volumeSelloff | deadCross |
| buy_ichimokuTriple | buy | 70 | [E-4] | ichimokuCloudBreakout, ichimokuBullishCross | volumeBreakout |
| sell_ichimokuTriple | sell | 70 | [E-4] | ichimokuCloudBreakdown, ichimokuBearishCross | volumeSelloff |
| buy_goldenMarubozuVol | buy | 65 | [E-4] | goldenCross, bullishMarubozu | volumeBreakout |
| sell_deadMarubozuVol | sell | 68 | [E-4] | deadCross, bearishMarubozu | volumeSelloff |
| buy_adxGoldenTrend | buy | 67 | [D] | goldenCross, adxBullishCross | volumeBreakout |
| sell_adxDeadTrend | sell | 67 | [D] | deadCross, adxBearishCross | volumeSelloff |
| buy_shortSqueezeFlow | buy | 66 | [D] | shortSqueeze, flowForeignBuy | volumeBreakout |

#### Tier 2: Medium Strength

| ID | Dir | baseConf | Grade | Required | Optional |
|----|-----|----------|-------|----------|----------|
| buy_goldenCrossRsi | buy | 58 | [C-8] | goldenCross | rsiOversoldExit, volumeBreakout |
| sell_deadCrossMacd | sell | 58 | [C-8] | deadCross | macdBearishCross, rsiOverboughtExit |
| buy_hammerBBVol | buy | 63 | [E-1] | hammer, bbLowerBounce | volumeBreakout |
| sell_shootingStarBBVol | sell | 69 | [E-1] | shootingStar, bbUpperBreak | volumeSelloff |
| buy_morningStarRsiVol | buy | 58 | [E-1] | morningStar, rsiOversoldExit | volumeBreakout |
| sell_eveningStarRsiVol | sell | 65 | [E-1] | eveningStar, rsiOverboughtExit | volumeSelloff |
| buy_engulfingMacdAlign | buy | 48 | [Audit] | bullishEngulfing, macdBullishCross | maAlignment_bull |
| sell_engulfingMacdAlign | sell | 66 | [E-4] | bearishEngulfing, macdBearishCross | maAlignment_bear |
| buy_flowPcrConvergence | buy | 63 | [D] | flowAlignedBuy | pcrFearExtreme, basisContango |
| sell_flowPcrConvergence | sell | 63 | [D] | flowAlignedSell | pcrGreedExtreme, basisBackwardation |
| buy_cciRsiDoubleOversold | buy | 58 | [D] | cciOversoldExit, rsiOversoldExit | volumeBreakout |
| sell_cciRsiDoubleOverbought | sell | 58 | [D] | cciOverboughtExit, rsiOverboughtExit | volumeSelloff |
| neutral_squeezeExpansion | neutral | 52 | [D] | bbSqueeze, atrExpansion | volumeBreakout |
| buy_cusumKalmanTurn | buy | 55 | [D] | cusumBreak, kalmanUpturn | goldenCross |
| sell_cusumKalmanTurn | sell | 55 | [D] | cusumBreak, kalmanDownturn | deadCross |
| buy_volRegimeOBVAccumulation | buy | 58 | [D] | volRegimeHigh, obvBullishDivergence | volumeBreakout |

#### Tier 3: Weak

| ID | Dir | baseConf | Grade | Required | Optional |
|----|-----|----------|-------|----------|----------|
| buy_bbBounceRsi | buy | 55 | [C-8] | bbLowerBounce | rsiOversold, volumeBreakout |
| sell_bbBreakoutRsi | sell | 55 | [C-8] | bbUpperBreak | rsiOverbought, volumeSelloff |
| buy_wrStochOversold | buy | 48 | [D] | williamsROversold, stochasticOversold | rsiOversoldExit |
| sell_wrStochOverbought | sell | 48 | [D] | williamsROverbought, stochasticOverbought | rsiOverboughtExit |

#### Composite Constants

| Constant | Value | Grade | Sensitivity | Notes |
|----------|-------|-------|-------------|-------|
| window | 5 bars | [D-Heuristic] | **HIGH** | All 30 composites affected. Nison (1991): "several sessions". 3->5 expanded for KRX. |
| optionalBonus | 3-5 | [D] | Medium | Per-optional confidence increment |
| composite cap | 95 | [D] | Low | Individual signals capped at 90 |

**[RESOLVED V7]**: `buy_engulfingMacdAlign` now capped to WR=41 via anti-predictor gate (`PATTERN_WR_KRX[bullishEngulfing]=41.3`, threshold=48). The gate prevents this composite from inflating confidence beyond empirical ceiling regardless of baseConfidence (48) or optional bonuses. See "Anti-Predictor WR Gate" subsection below.

**[CONCERN]**: `measuredWR: null` on ichimoku triple composites (buy_ichimokuTriple, sell_ichimokuTriple). baseConfidence=70 is theory-based estimate (Hosoda 65-75% range) without KRX empirical validation.

#### Anti-Predictor WR Gate (V7, BLL 1992)

**Code:** `signalEngine.js` lines 2354-2379

After composite confidence is calculated from `baseConfidence + optional bonuses`, the anti-predictor gate checks each `def.required` pattern against `PATTERN_WR_KRX`:

1. For each required pattern, look up its KRX 5-year win rate in `PATTERN_WR_KRX`
2. If any required pattern has `WR < ANTI_PREDICTOR_THRESHOLD (48)`, set `_wrCapped = true`
3. Cap confidence: `confidence = Math.min(confidence, Math.round(lowestWR))`
4. Cap prediction: `confidencePred = Math.min(confidencePred, Math.round(lowestWR))`
5. If capped: downgrade `strength` from `"strong"` to `"medium"`, set `wrCapped: true` flag

**Academic basis:** Brock, Lakonishok & LeBaron (1992): technical rules with WR < 50% are not merely weak — they are anti-predictive. The 48% threshold accounts for KRX round-trip transaction costs (~2%).

**Affected Composites (V7):**

| Composite | Anti-predictor Pattern | Pattern WR | Effective Cap |
|-----------|----------------------|------------|---------------|
| `strongBuy_hammerRsiVolume` | hammer | 45.2% | 45 |
| `buy_hammerBBVol` | hammer | 45.2% | 45 |
| `buy_morningStarRsiVol` | morningStar | 40.5% | 41 |
| `buy_engulfingMacdAlign` | bullishEngulfing | 41.3% | 41 |
| `buy_goldenMarubozuVol` | bullishMarubozu | 41.8% | 42 |

These 5 composites contain at least one required pattern with WR below the anti-predictor threshold. Their effective confidence is hard-capped to the lowest anti-predictor WR, regardless of `baseConfidence` or optional bonus accumulation.

---

### 3.3.3 Divergence Detection

**Method**: `_detectDivergence()` line 2099
**Shared by**: MACD (via `_detectMACDSignals()`) and RSI (via `_detectRSISignals()`)

#### Algorithm

1. **Swing point detection**: `swingOrder=3`, compare left/right 3 bars for extrema
2. **Regular bullish divergence**: price new low + indicator higher low -> buy (conf 70)
3. **Hidden bullish divergence**: price higher low + indicator lower low -> buy (conf 62)
4. **Regular bearish divergence**: price new high + indicator lower high -> sell (conf 68)
5. **Hidden bearish divergence**: price lower high + indicator higher high -> sell (conf 60)

| Constant | Value | Grade | Source | Sensitivity |
|----------|-------|-------|--------|-------------|
| lookback | 40 | [B] | 20->40 expanded for major reversals | Medium |
| swingOrder | 3 | [B] | Zigzag simplification | Medium |
| bull regular conf | 70 | [D] | Practitioner | Medium |
| bear regular conf | 68 | [D] | Practitioner, -2pp sell asymmetry | Medium |
| bull hidden conf | 62 | [D] | Lower than regular (hidden = continuation) | Low |
| bear hidden conf | 60 | [D] | Lower than regular | Low |

#### Divergence Signal Type Catalog (8 types total)

| Type | Direction | Confidence | Weight |
|------|-----------|------------|--------|
| macdBullishDivergence | buy | 70 | +2.5 |
| macdBearishDivergence | sell | 68 | -2.5 |
| macdHiddenBullishDivergence | buy | 62 | +2.0 |
| macdHiddenBearishDivergence | sell | 60 | -2.0 |
| rsiBullishDivergence | buy | 70 | +2.0 |
| rsiBearishDivergence | sell | 68 | -2.0 |
| rsiHiddenBullishDivergence | buy | 62 | +1.5 |
| rsiHiddenBearishDivergence | sell | 60 | -1.5 |

**[CONCERN]**: 3-bar look-ahead (`i+1..i+swingOrder`) used for swing confirmation. Signal index is the swing point, not the confirmation bar. For chart display: acceptable. For real-time trading: introduces `swingOrder` bars of latency. Documented inline at line 2107.

---

### 3.3.4 Post-Filters

Applied sequentially in `analyze()` after all individual signal detection. Order matters -- later filters compound on earlier adjustments.

#### PF-1: ADX Trend Filter (line 1915)

| Property | Value |
|----------|-------|
| Target | `_ADX_TREND_TYPES` (10 trend-following signal types) |
| Method | Isotonic piecewise-linear interpolation (Barlow et al. 1972) |
| Default breakpoints | [[10,-10],[15,-5],[20,0],[25,5],[30,7],[40,10],[50,10]] |
| TF-adaptive period | 1m/5m -> 28, 15m/30m -> 21, 1h/1d -> 14 [C] |
| Override | `rl_policy.adx_isotonic` |
| Range | [30, 90] clamped |

VALID: Isotonic regression correctly ensures monotonically increasing adjustment with ADX value. TF adaptation prevents short-period ADX instability in intraday data.

#### PF-2: CCI Regime Filter (line 1952)

| Property | Value |
|----------|-------|
| Target | Same `_ADX_TREND_TYPES` (10 types) |
| Default breakpoints | [[40,-3],[75,0],[100,0],[150,2],[200,3],[300,3]] |
| Override | `rl_policy.cci_isotonic` |
| Range | [30, 90] clamped |

VALID: ADX and CCI are partially orthogonal (r ~ 0.50): ADX measures directional movement magnitude, CCI measures price deviation from mean. Using both provides complementary trend assessment.

#### PF-3: CUSUM Breakpoint Discount (line 1980)

| Property | Value |
|----------|-------|
| Reference | Page (1954), Roberts (1966) |
| Discount | 0.70 at breakpoint -> 1.0 after 30 bars (linear recovery) |
| Scope | ALL signals (not direction-specific) |
| Threshold | Volatility-adaptive: `cache.cusum(2.5, lastVolRegime)` |

VALID: Structural breakpoint detection correctly discounts all signals near regime changes. Volatility-adaptive threshold prevents false breakpoints in high-vol periods.

#### PF-4: Binary Segmentation Discount (line 2018)

| Property | Value |
|----------|-------|
| Reference | Bai & Perron (1998) |
| Discount | 0.85 at breakpoint -> 1.0 after 30 bars (linear recovery) |
| Scope | Counter-trend signals only (direction-specific) |
| BinSeg params | minSegment=3, minSize=30 |

VALID: Weaker than CUSUM (0.85 vs 0.70) because BinSeg is direction-selective. Only discounts signals opposing the new regime direction -- theoretically sound.

#### PF-5: OLS Trend Confirmation (line 556)

| Property | Value |
|----------|-------|
| Reference | Lo & MacKinlay (1999) |
| Window | 20 bars [B] |
| Trigger | R^2 > 0.50 AND trend direction matches signal direction |
| Boost | +5, cap 90 |

**[CONCERN]**: R^2 > 0.50 threshold is [D]-tagged. In financial data, 20-bar OLS R^2 > 0.50 is quite high and may be reached primarily by strong momentum stocks, potentially creating a selection bias toward momentum-driven signals.

#### PF-6: Cumulative Adjustment Cap (line 570)

| Property | Value |
|----------|-------|
| Cap | MAX_CUMULATIVE_ADJ = 15 [D-Heuristic] |
| Purpose | Prevent ADX+CCI+OLS stack inflation |
| Final range | [10, 90] |

VALID: Essential safety guard. Without this, three partially correlated trend indicators could inflate confidence by 30+ points. The cap assumes partial correlation between ADX, CCI, and OLS -- theoretically justified but the exact value (15) is heuristic.

#### PF-7: Entropy Damping (line 597)

| Property | Value |
|----------|-------|
| Reference | Shannon (1948) |
| Formula | `scale = 0.80 + 0.20 * sqrt(entropyNorm)` |
| Range | entropyNorm=0 -> 0.80, 0.50 -> 0.94, 1.0 -> 1.0 |
| Trigger | signals.length > 2 AND entropyNorm < 1.0 |

VALID: Sqrt recovery is theoretically superior to linear recovery (prior implementation). Low entropy = concentrated signal categories = higher false positive risk from single-source overconfidence. Maximum 20% damping is conservative.

#### PF-8: IV/HV Ratio Discount (line 606)

| Property | Value |
|----------|-------|
| Reference | Doc26 S5.3 |
| Formula | `conf * max(0.50, 1 - 0.20 * max(0, IV/HV - 1))` |
| Alpha | 0.20 [C Tier], range [0.1, 0.3] |
| IV Source | VKOSPI or VIX * 1.12 proxy |

VALID: When implied volatility exceeds historical volatility, market expects larger moves than recent history suggests, reducing pattern reliability. Floor at 0.50 prevents excessive damping.

#### PF-9: VKOSPI/VIX Regime Discount (line 640)

| Property | Value |
|----------|-------|
| Reference | Doc26 S2.3, Whaley (2000, 2009) |
| Fallback chain | VKOSPI -> VIX * 1.12 proxy -> HMM |
| Thresholds | <15: low (1.0), 15-22: normal (0.95), 22-30: high (0.80), >30: crisis (0.60) [C] |

VALID: Threshold values align with VIX/VKOSPI empirical regime boundaries. Crisis discount of 0.60 is aggressive but justified by Longin & Solnik (2001) showing correlation breakdown in crises.

#### PF-10: Options Expiry Discount (line 657)

| Property | Value |
|----------|-------|
| Reference | Doc27 S4 |
| Scope | D-2 to D+1 around monthly options expiry (2nd Thursday) |
| Discount | conf * 0.70 [C] |

VALID: Options expiry creates abnormal volume patterns and price dislocations that invalidate normal technical signal reliability.

#### PF-11: Crisis Severity Discount (line 668)

| Property | Value |
|----------|-------|
| Reference | Doc28 S1.2, Longin & Solnik (2001) |
| Trigger | crisis severity > 0.7 |
| Formula | `conf * (1 - severity * 0.40)` |
| Target | Reversal-type signals only (continuation signals exempt) |

VALID: Correctly exempts continuation signals -- in crises, trend-following remains valid while reversal patterns fail.

#### PF-12: HMM Regime Fallback (line 682)

| Property | Value |
|----------|-------|
| Trigger | Only when VKOSPI/VIX unavailable (prevents double-discount) |
| Method | Directional: regime-confirming signals unpenalized, counter-trend signals 0.70-1.0 |
| Staleness | 30-day cutoff [D] |

VALID: Double-discount prevention through `_appliedVolDiscount` flag is essential. Directional discount (only counter-trend penalized) is theoretically justified by HMM regime persistence.

#### Post-Filter Application Order and Stacking

```
1. ADX Filter           -> trend signals +/-10
2. CCI Filter           -> trend signals +/-3
3. OLS Boost            -> trend-aligned +5
4. Cumulative Cap        -> |delta| <= 15
5. Entropy Damping       -> all signals * [0.80, 1.0]
6. IV/HV Discount        -> all signals * [0.50, 1.0]
7. Vol Regime Discount    -> all signals * [0.60, 1.0]
8. Expiry Discount        -> all signals * 0.70
9. Crisis Discount        -> reversal signals * [0.60, 1.0]
10. HMM Fallback          -> counter-trend * [0.70, 1.0]
```

**[CRITICAL]** -- Multiplicative stacking: In worst case (high IV/HV, crisis, expiry, HMM counter-trend), a signal with base confidence 70 could be reduced to: `70 * 0.80 * 0.50 * 0.60 * 0.70 * 0.70 = 8.2` -> clamped to 10. While each individual discount is justified, the multiplicative composition lacks formal analysis of joint probability. The `max(10, ...)` floor prevents complete confidence annihilation, but the compounding may be overly aggressive. Five multiplicative discounts without a floor on intermediate products could create confidence values that are no longer calibrated to actual predictive power.

---

### 3.3.5 Sentiment & Statistics

`_calcStats()` (line 2824): Market sentiment index + signal diversity measurement.

#### Sentiment Index

- Window: last 20 bars [B]
- Formula: `sentiment = round((buyWeight - sellWeight) / totalWeight * 100)`
- Range: [-100, +100]
- Labels: >= 60 "strong buy" / >= 25 "buy bias" / > -25 "neutral" / > -60 "sell bias" / else "strong sell"

#### Weight Map

Assigns directional weights to each signal type. All weights are [D]-tagged.

| Range | Examples | Magnitude |
|-------|----------|-----------|
| +/-3.0 | goldenCross, deadCross, ichimokuCloudBreakout | Highest |
| +/-2.5 | macdDivergence, obvDivergence, flowAligned | High |
| +/-2.0 | volumeBreakout, maAlignment, adxCross | Medium |
| +/-1.5 | rsiOversoldExit, stochasticOversold, basisContango | Medium-Low |
| +/-1.0 | stochRsiOversold, etfExtreme, williamsR | Low |
| 0 | hurstTrending, kalmanUpturn, cusumBreak, atrExpansion | Filter only |

#### Shannon Entropy

- Formula: `H = -sum(p_i * log2(p_i))` over 17 categories
- Normalized: `entropyNorm = H / log2(active_categories)` -> [0, 1]
- Low entropy = concentrated categories -> entropy damping trigger

#### Composite Tier Weighting (Sentiment)

| Tier | Weight | Rationale |
|------|--------|-----------|
| 1 | 1.5 | Most crowded -> lowest weight (Lo 2004 AMH alpha decay) |
| 2 | 2.5 | Medium |
| 3 | 3.5 | Retains alpha -> highest weight |

**[CONCERN]**: Inverted tier weighting (Tier 3 highest) is unconventional. Academic rationale (alpha decay from crowding) is sound, but the specific magnitudes (1.5/2.5/3.5) are [D]-tagged with no published calibration.

---

## 3.4 Backtester Engine

**File**: `js/backtester.js`
**Global**: `backtester` (PatternBacktester)
**Dependencies**: `patterns.js`, `indicators.js` (`calcATR`, `calcMA`, `calcWLSRegression`, `selectRidgeLambdaGCV`), `signalEngine.js`

### 3.4.1 Transaction Cost Model

#### Static Costs

| Cost Component | Value (%) | Grade | Source | File:Line |
|----------------|-----------|-------|--------|-----------|
| Commission (round-trip) | 0.03 | [C] | 0.015% one-way x 2 | backtester.js:19 |
| Tax (sell-side) | 0.18 | [C] | KOSPI 0.03%+agricultural 0.15% / KOSDAQ 0.18% (2025) | backtester.js:20 |
| Slippage (round-trip) | 0.10 | [C] | KOSPI large-cap bid-ask, Amihud (2002) | backtester.js:21 |
| **Total KRX_COST** | **0.31** | | | backtester.js:22 |

#### Horizon-Scaled Cost Function

`_horizonCost(h)` (line 44):
```
fixedCost = (commission + tax) / h       -- round-trip once, spread over holding period
variableCost = slippage / sqrt(h)        -- Kyle (1985) sqrt-time microstructure scaling
total = fixedCost + variableCost
```

| Horizon | New Cost (%) | Old Fixed (%) | Delta |
|---------|-------------|---------------|-------|
| h=1 | 0.31 | 0.31 | 0% |
| h=5 | 0.087 | 0.07 | +24% (was 112% understated) |
| h=20 | 0.033 | 0.07 | -53% (was overstated) |

VALID: Kyle (1985) sqrt-time scaling for market impact is theoretically correct. Fixed cost amortization over holding period is standard. The prior flat 0.07% was incorrect for all horizons except h ~= 4.4.

#### Adaptive Slippage (Amihud ILLIQ)

`_getAdaptiveSlippage(code)` (line 27):

| Segment | Slippage (%) | Grade | Source |
|---------|-------------|-------|--------|
| kospi_large | 0.04 | [C] | Amihud (2002) ILLIQ-calibrated |
| kospi_mid | 0.10 | [C] | compute_illiq_spread.py |
| kosdaq_large | 0.15 | [C] | compute_illiq_spread.py |
| kosdaq_small | 0.25 | [C] | compute_illiq_spread.py |

VALID: Segment-based slippage from empirical ILLIQ computation. 6.25x spread between largest and smallest segments is realistic for KRX market structure.

**[CONCERN]**: Adaptive slippage (`_getAdaptiveSlippage`) requires `_behavioralData.illiq_spread` to be loaded. If the JSON is missing, falls back to static 0.10%. The fallback is reasonable for large-caps but understates cost for KOSDAQ small-caps by ~2.5x.

---

### 3.4.2 WLS Regression Pipeline

`_computeStats()` line 1800. Minimum 30 samples required.

#### Design Matrix (5 features)

```
X = [intercept, confidence, trendStrength, ln(volumeRatio), atrNorm]
```

| Column | Variable | Description | Scale |
|--------|----------|-------------|-------|
| 0 | intercept | Constant 1 | fixed |
| 1 | confidence | (confidencePred or confidence) / 100 | [0, 1] |
| 2 | trendStrength | abs(OLS slope) / ATR, 10-bar window | [0, ~5] |
| 3 | ln(volumeRatio) | ln(max(volume/VMA20, 0.1)) | [-2.3, ~3] |
| 4 | atrNorm | ATR(14) / close | [0, ~0.1] |

Previous features `wc` and `momentum60` removed in Phase 7 C-1 for look-ahead bias (wc uses full-candle hw/mw) and parsimony (7->5 columns).

VALID: Feature set is parsimonious. n/k ratio = 30/5 = 6 at minimum threshold -- below the ideal 10-20 range. **[WARNING]**: At n=30, 5 features gives n/k=6, which is underpowered for reliable Ridge regression. Recommend n>=50 gate for regression activation.

#### Feature Normalization

Column-wise standard deviation normalization (line 1819):
```javascript
for (sj = 1; sj < 5; sj++) {
    scales[sj] = std(X[:, sj]);
    X[:, sj] /= scales[sj];
}
```

VALID: Required for Ridge regularization (Hoerl & Kennard 1970). Without normalization, atrNorm (~0.02) would receive ~278x stronger penalty than confidence (~0.5). Intercept correctly excluded from normalization.

#### Exponential Decay Weighting

```javascript
lambda = 0.995;  // half-life ~139 observations ≈ 7 months
weights[i] = lambda^(n-1-i);  // most recent gets weight 1.0
```

| Property | Value |
|----------|-------|
| Grade | [A] |
| Reference | core_data/17 S17.4; Lo (2004) AMH; Reschenhofer et al. (2021) |
| Half-life | ln(0.5)/ln(0.995) = 138.6 observations ~ 7 months |
| Sensitivity | **HIGH** -- affects all regression predictions |

VALID: 7-month half-life is consistent with Lo's AMH empirical finding that market regime changes occur on ~6-12 month cycles. Lambda=0.995 is conservative (slow decay).

#### Ridge Lambda Selection (GCV)

```javascript
var optLambda = selectRidgeLambdaGCV(X, returns, weights, 5);
```

| Property | Value |
|----------|-------|
| Method | Golub, Heath & Wahba (1979) Generalized Cross-Validation |
| Implementation | Jacobi eigendecomposition |
| Fallback | lambda = 1.0 |
| Grade | [C][L:GCV] |

VALID: GCV is the theoretically optimal method for Ridge lambda selection when cross-validation is computationally expensive. The Jacobi eigendecomposition approach is correct for small (5x5) systems.

#### Huber-IRLS Robust Estimation

Line 1839. Addresses KRX fat-tail returns (excess kurtosis from +/-30% limit-up/down).

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| HUBER_DELTA | 5.8 | [C] | 1.345 * sigma, where sigma ~ 4.3 from KRX 5-day MAD. Huber (1964) 95% efficiency |
| HUBER_ITERS | 5 | [B] | Street, Carroll & Ruppert (1988): converges in 3-5 iterations |

**Algorithm**:
1. Initial WLS+Ridge regression
2. For each iteration:
   - Compute residuals from current fit
   - Huber weights: `hw = abs(resid) > delta ? delta/abs(resid) : 1.0`
   - Combined weights: `huberWeights[i] = hw * exponentialWeights[i]`
   - Re-fit WLS with combined weights
3. Early stop if no residual exceeds delta

VALID: Huber-IRLS correctly handles the KRX fat-tail problem. The delta=5.8 calibration (1.345 * MAD-estimated sigma) follows the standard Huber (1964) recommendation for 95% asymptotic relative efficiency under normality.

#### Reverse Transform

Line 1868: De-standardize coefficients back to original scale.
```javascript
reg.coeffs[j] /= scales[j];  // Hastie, Tibshirani & Friedman (2009)
```

VALID: Correct reverse transformation for Ridge coefficients in standardized space.

#### HC3 Standard Errors

From `calcWLSRegression()` in `indicators.js`:
- White (1980) heteroskedasticity-consistent standard errors
- HC3 variant with (1 - h_ii)^2 jackknife correction
- Optimal for n = 30-300 (Long & Ervin 2000)
- Returns `reg.hcTStats` as array

VALID: HC3 is the correct choice for this sample size range. HC0 (White's original) underestimates SEs at small n. HC3's jackknife correction provides better finite-sample performance.

#### Prediction and Confidence Interval

```javascript
predicted = sum(xNew[j] * reg.coeffs[j])      // line 1898
se = sqrt(sigmaHat2 * (1 + x' * invXtWX * x))  // line 1933
tCrit = _tCritFatTail(df, returns, 0.05)        // Cont (2001) kurtosis-adjusted
ci95 = [predicted - tCrit*se, predicted + tCrit*se]
```

VALID: Prediction interval (not confidence interval) correctly includes `1 + x'(X'WX)^-1 x` term for prediction uncertainty. Fat-tail t-critical via Cont (2001) kurtosis adjustment is essential for financial returns.

---

### 3.4.3 LinUCB Multi-Armed Bandit

Contextual bandit (Li et al. 2010) -- single-step decision, NOT MDP.
Policy loaded from `data/backtest/rl_policy.json`.

#### Feature Vector (7-dim)

`_buildRLContext()` (line 348):

| Dim | Feature | Description | Normalization |
|-----|---------|-------------|---------------|
| 0 | ewma_vol | EWMA volatility (lambda=0.94, 80 bars) | z-scored (mu~0.027, sigma~0.018) |
| 1 | pred_magnitude | abs(WLS predicted) / pred_std | clamped [0, 3] |
| 2 | signal_dir | buy=1, sell=-1, neutral=0 | discrete |
| 3 | market_type | KOSDAQ=1, KOSPI=0 | binary |
| 4 | pattern_tier | Tier1=-1, Tier2=0, Tier3=1 | discrete |
| 5 | confidence_norm | confidencePred / 100 | [0, 1] |
| 6 | raw_hurst | R/S Hurst exponent | z-scored (mu~0.612, sigma~0.133) |

Normalization parameters loaded from `rl_policy.normalization`. Staleness guard: price-level Hurst (mean > 0.80) rejected in favor of returns-based fallback.

#### Action Space (5 actions)

```javascript
K = 5;  // action_factors typically [0.5, 0.75, 1.0, 1.25, 1.5]
```

Actions multiply the WLS expected return by the corresponding factor.

#### UCB Formula (Greedy-Only)

`_applyLinUCBGreedy()` (line 413):
```javascript
score = thetas[a][0];  // bias
for (j = 0; j < d; j++) score += thetas[a][j+1] * context[j];
bestA = argmax(score);
```

Exploration term `alpha * sqrt(x' A^-1 x)` dropped in JS runtime (full UCB in `rl_linucb.py` training only). This is a design decision: JS uses greedy exploitation, Python uses full UCB for exploration during training.

#### Safety Gates

| Gate | Condition | Action | Grade |
|------|-----------|--------|-------|
| IC threshold | `mean_ic_adjusted < 0` | Reject entire policy (anti-predictive) | [A] |
| t_stat_delta | `< 2.0` | Skip LinUCB, Ridge-only | [B] |
| Staleness | `trained_date > 90 days` | Console warning | [D] |
| Dimension mismatch | `policy.d != feature_dim` | Console warning | [B] |
| Safety clamp | `abs(factor) > 3.0` | Clamp to +/-3.0 | [D] |

VALID: IC threshold gate is essential -- negative IC means the policy's predictions are inversely correlated with outcomes. The t_stat_delta gate (currently t=-0.1518, NOT significant) keeps LinUCB inactive, defaulting to Ridge-only.

**[WARNING]** -- Known misalignment (C-8): RL reward (per-sample return) != evaluation metric (Spearman IC). This is documented at line 411. The reward function should ideally be aligned with the metric used to evaluate the policy.

#### Beta-Binomial Posterior (G-2)

Even when LinUCB policy is rejected (negative IC), `win_rates_live` from `rl_policy.json` are injected into PatternEngine:
```javascript
PatternEngine.PATTERN_WIN_RATES_LIVE = {
    patternType: alpha/(alpha+beta) * 100  // posterior mean
};
```

VALID: Beta-Binomial posteriors are IC-independent empirical data and remain valid even when the bandit policy itself is anti-predictive.

---

### 3.4.4 Survivorship Bias Correction

**Reference**: Elton, Gruber & Blake (1996), JF 51(4):1097-1108

#### Implementation

`_loadSurvivorshipCorrection()` (line 124): Loads `data/backtest/survivorship_correction.json`.

`_getSurvivorshipCorrection(patternType, h)` (line 141): Three-tier lookup:
1. Per-pattern per-horizon (most precise): requires `n_delisted >= 30`
2. Per-horizon (medium precision)
3. Global median (fallback)

Returns 0 if correction data not loaded (graceful degradation).

#### Application

```javascript
correctedWR = winRate - delta  // survivorship-corrected absolute WR
wrAlpha = winRate - wrNull     // NOT corrected (both share same bias)
```

VALID: `wrAlpha` correctly left uncorrected because both observed WR and null WR share survivorship bias (computed from same survivor-only universe). The `correctedWR` field applies the Elton et al. delta for absolute WR display. The n >= 30 requirement for per-pattern correction prevents noisy small-sample corrections.

---

### 3.4.5 Pattern Occurrence Collection

`_collectOccurrences()` (line 1162):

1. Run `patternEngine.analyze(candles)` once (cached by candle reference)
2. Extract matching patterns by type
3. For each occurrence, compute WLS features:
   - `confidence`: Dual Confidence (confidencePred preferred)
   - `trendStrength`: 10-bar OLS slope / ATR
   - `volumeRatio`: volume / VMA(20)
   - `atrNorm`: ATR(14) / close
   - `momentum60`: 60-day price momentum (retained for data but removed from regression)
   - `wc`: pattern Wc weight (hw * mw)
   - `priceTarget`: pattern price target (if available)

VALID: Dual Confidence (`confidencePred` preferred over `confidence`) correctly uses the calibrated prediction confidence rather than display confidence for regression features.

---

## 3.5 Backtest Statistics

### 3.5.1 Per-Horizon Metrics Catalog

`_computeStats()` (line 1270): Computes 37 metrics per horizon.

#### Return Calculation

```
Entry: candles[occ.idx + 1].open  (next candle open -- no look-ahead bias)
Exit:  candles[occ.idx + h].close
Return: (exit - entry) / entry * 100 - _horizonCost(h)
```

VALID: Entry at next-candle open eliminates look-ahead bias. Transaction costs correctly deducted per horizon.

#### BT-XX Metric Catalog

| ID | Metric | Formula | Line | Reference | Grade |
|----|--------|---------|------|-----------|-------|
| BT-01 | n | sample count | 1340 | -- | -- |
| BT-02 | mean | arithmetic mean of returns | 1381 | -- | VALID |
| BT-03 | median | sorted middle value | 1382 | -- | VALID |
| BT-04 | stdDev | sample std (Bessel, n-1) | 1387 | -- | VALID |
| BT-05 | winRate | direction-adjusted win % | 1404 | -- | VALID |
| BT-06 | wrNull | unconditional base rate | 1417 | Sullivan et al. (1999) | VALID |
| BT-07 | wrAlpha | winRate - wrNull | 1419 | -- | VALID |
| BT-08 | correctedWR | winRate - survivorshipDelta | 1424 | Elton et al. (1996) | VALID |
| BT-09 | winRateCI | BCa bootstrap [2.5%, 97.5%] | 1457 | Efron (1987) | VALID |
| BT-10 | cohensH | 2*arcsin(sqrt(p_obs)) - 2*arcsin(sqrt(p_null)) | 1431 | Cohen (1988) | VALID |
| BT-11 | informationRatio | exMean / TE * sqrt(250/h) | 1448 | Grinold & Kahn (2000) | VALID |
| BT-12 | regimeWR | {trending, reverting, neutral} | 1451 | Lo (2004) AMH | VALID |
| BT-13 | sortinoRatio | mean / downsideDev * sqrt(250/h) | 1400 | Sortino & van der Meer (1991) | VALID |
| BT-14 | medianMAE | path min return (median) | 1346 | Sweeney (1997) | VALID |
| BT-15 | mae5 | 5th percentile MAE (Type 7 interpolation) | 1353 | Hyndman & Fan (1996) | VALID |
| BT-16 | medianMFE | path max return (median) | 1347 | -- | VALID |
| BT-17 | mfe95 | 95th percentile MFE | 1358 | -- | VALID |
| BT-18 | maxDrawdown | peak-to-trough cumulative | 1365 | CFA Level III | VALID |
| BT-19 | cvar5 | Expected Shortfall 5% | 1374 | Basel Committee | VALID |
| BT-20 | maxLoss / maxGain | sorted extremes | 1553 | -- | VALID |
| BT-21 | avgWin / avgLoss | avg of positive/negative returns | 1558 | -- | VALID |
| BT-22 | riskReward | avgWin / avgLoss | 1561 | -- | VALID |
| BT-23 | expectancy | WR*avgWin - (1-WR)*avgLoss | 1565 | Kelly (1956) | VALID |
| BT-24 | profitFactor | grossProfit / grossLoss | 1568 | -- | VALID |
| BT-25 | kellyFraction | clamped [0, 1.0] | 1582 | Kelly (1956), Thorp (2006) | VALID |
| BT-26 | tStat | mean / (std/sqrt(n)) | 1586 | -- | VALID |
| BT-27 | significant | abs(tStat) > tCritFatTail | 1589 | Cont (2001) | VALID |
| BT-28 | hlzSignificant | abs(tStat) > 3.0 | 1592 | Harvey, Liu & Zhu (2016) | VALID |
| BT-29 | mde | tCrit * std / sqrt(n) | 1598 | Cohen (1988) | VALID |
| BT-30 | adjustedSignificant | BH-FDR corrected | 806 | Benjamini & Hochberg (1995) | VALID |
| BT-31 | directionalAccuracy | winRate alias | 1608 | -- | VALID |
| BT-32 | targetHitRate | priceTarget reach % (n>=5 gate) | 1611 | -- | VALID |
| BT-33 | predictionMAE | abs(predicted - actual) mean (n>=5) | 1614 | -- | VALID |
| BT-34 | patternScore | composite 0-100 | 1627 | See 3.5.7 | [D] |
| BT-35 | patternGrade | A/B/C/D/F | 1632 | See 3.5.7 | [D] |
| BT-36 | mzRegression | Mincer-Zarnowitz slope/intercept/R^2 (n>=20) | 1642 | Mincer & Zarnowitz (1969) | VALID |
| BT-37 | calibrationCoverage | OOS prediction interval % (halfN>=10) | 1682 | Gneiting & Raftery (2007) | VALID |
| BT-38 | jensensAlpha | market-adjusted excess return | 1750 | CAPM, Doc25 | VALID |
| BT-39 | regression | WLS coefficients, R^2, HC3 tStats, VIFs | 1873 | -- | VALID |
| BT-40 | expectedReturn | WLS predicted return | 1900 | -- | VALID |
| BT-41 | ci95Lower/Upper | fat-tail corrected CI | 1937 | Cont (2001) | VALID |
| BT-42 | ic | Spearman rank IC (OOS rolling) | 1963 | Grinold & Kahn (2000) | VALID |
| BT-43 | icir | IC / std(IC) (jackknife SE) | 1983 | -- | VALID |

#### Key Statistical Fixes Applied

- **BT-06** (wrNull): `_computeNullWR()` independently computes unconditional base rate -- Sullivan et al. (1999) proper null
- **BT-10** (cohensH): Uses `wrNull/100` as null (not hardcoded 0.5) -- Cohen (1988) requires proper null hypothesis
- **BT-11** (IR): `_computeNullMeanReturn()` provides independent benchmark -- fixes circular dependency bug
- **BT-13** (Sortino): Denominator uses total N (not N_negative) per Sortino & van der Meer (1991)
- **BT-15** (mae5): Type 7 interpolation -- fixes off-by-one at small n
- **BT-25** (Kelly): Uses edge = WR - wrNull (no 0.5 recentering bias)
- **BT-37** (calibration): Train/test split of residuals -- fixes tautological coverage bug

---

### 3.5.2 Bootstrap Confidence Intervals

Line 1457. Minimum n=30 required.

#### Calendar-Time Block Bootstrap

Primary method for daily candle data:
1. **Winsorize** returns at 1st/99th percentile (Wilcox 2005) -- KRX +/-30% limit creates extreme kurtosis
2. **Group** returns by calendar month (YYYY-MM)
3. **Resample** whole months with replacement until n returns collected
4. **Compute** win rate for each bootstrap replicate
5. **B = 500** replicates [B] (Efron & Tibshirani 1993)
6. **Minimum 3 months** required for calendar resampling [D]

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| B | 500 | [B] | Efron & Tibshirani (1993): 200-1000 for percentile CIs |
| min months | 3 | [D] | Heuristic |
| winsorize percentiles | 1%/99% | [B] | Wilcox (2005) |

VALID: Calendar-time bootstrap (Fama & French 2010) preserves within-month temporal dependence and seasonal effects, addressing the i.i.d. violation from pattern clustering in volatile periods.

#### Fallback: Index-Based Block Bootstrap

For intraday data or missing date strings:
```javascript
blockSize = max(2, round(sqrt(n)));  // Kunsch (1989), Carlstein (1986)
```

**[CONCERN]**: Fallback does NOT correct for temporal clustering across periods. When calendar dates are unavailable, the block bootstrap may underestimate CI width due to unaddressed cross-period dependence.

#### BCa Correction

`_bcaCI()` (line 1102):
1. **Bias correction z0** = Phi^-1(proportion of boot stats below thetaHat)
2. **Acceleration a-hat** from jackknife third moment: `a = sum(d^3) / (6 * sum(d^2)^1.5)`
3. **Adjusted percentiles** via BCa transformation
4. Minimum 50 bootstrap replicates required

VALID: BCa (Efron 1987) addresses both bias and skewness in the bootstrap distribution, providing second-order accurate coverage. Implementation is correct: z0 from proportion, acceleration from jackknife, and proper percentile transformation.

---

### 3.5.3 Multiple Testing Correction

#### Benjamini-Hochberg FDR

`_applyBHFDR()` (line 806):

| Property | Value |
|----------|-------|
| FDR level q | 0.05 [A] |
| p-value method | `_approxPValue()` -- Abramowitz & Stegun 26.7.5 normal approximation |
| Algorithm | BH step-up: find largest k where p_(k) <= (k+1) * q / m |
| Previous method | Holm step-down (FWER) -- replaced as overly conservative for exploratory analysis |

VALID: BH-FDR is the correct choice for this setting. With 45 patterns x 5 horizons = 225 potential tests, Bonferroni/Holm would reject almost everything. BH controls the False Discovery Rate at 5% with greater statistical power.

**Validation**: At alpha=0.05 with ~225 tests, random chance yields ~11.25 false positives. BH step-up controls the *proportion* of false discoveries among rejected hypotheses to <= 5%.

---

### 3.5.4 Hansen SPA Test

`_hansenSPA()` (line 868):

| Property | Value |
|----------|-------|
| H0 | No strategy beats benchmark (random entry) |
| Test statistic | T_SPA = max_k(sqrt(n) * d_bar_k / sigma_hat_k) |
| Bootstrap B | 500 [B] (Politis & Romano 1994) |
| Hansen improvement | Negative-mean strategies zeroed (less conservative than White RC) |
| Rejection | p-value < 0.05 -> H0 rejected -> significant strategy exists |

#### Algorithm

1. Collect all (pattern, horizon) t-statistics where n >= 10
2. Find observed max t-statistic
3. Zero-out negative-mean strategies (Hansen 2005 vs White Reality Check)
4. Generate B=500 bootstrap null distribution via normal perturbation
5. p-value = proportion of bootstrap max >= observed max

VALID: Hansen (2005) SPA test is the gold standard for testing whether the best strategy among many candidates genuinely outperforms, accounting for data snooping. The zeroing of negative-mean strategies makes it less conservative than White's Reality Check.

**[CONCERN]**: Bootstrap null uses normal random noise (`Box-Muller`) rather than circular block bootstrap of actual returns. This is a simplification that works well when the t-statistics are approximately normal but may not capture the full dependence structure of the test statistics. For the 2,700-stock KRX application, this is a pragmatic trade-off between statistical rigor and computational cost.

#### SPA -> Reliability Tier Integration

```javascript
if (!results._spaTest.rejected) {
    // Best strategy not significant -> demote A/B to C
    for all patterns: if tier == 'A' or 'B' -> tier = 'C'
}
```

VALID: When SPA fails to reject H0, even the best-performing pattern may be a false positive. Demoting to C prevents overconfident tier assignments.

---

### 3.5.5 Walk-Forward Evaluation

`walkForwardTest()` (line 710):

#### Algorithm

1. **Expanding window**, K folds (4 default, 6 if candles >= 500)
2. **OOS block size**: `max(15, floor(len * 0.20 / folds))`
3. **Purge gap**: `2 * horizon` -- Bailey & Lopez de Prado (2014)
4. Per fold: IS backtest on training, OOS backtest on test
5. Clear `_resultCache` per fold (H-4 FIX: prevents cross-fold contamination)
6. **WFE** = `round((avgOOS / avgIS) * 100)`

| Constant | Value | Grade | Source | Sensitivity |
|----------|-------|-------|--------|-------------|
| default folds | 4 (6 if n>=500) | [B] | Bailey & Lopez de Prado (2014) | Low |
| OOS ratio | 20% | [D] | Practitioner convention | Medium |
| min OOS bars | 15 | [D] | Practitioner | Low |
| minTrain | 60 | [D] | Practitioner | Low |
| purge gap | 2 * horizon | [B] | Bailey & Lopez de Prado (2014): AR(1) half-life 6.5 > horizon(5) | Medium |
| minISEdge | 0.3% | [C] | ~ KRX round-trip cost (0.25% + 0.015%) | Medium |

#### WFE Labels

| WFE | Label | Interpretation |
|-----|-------|---------------|
| >= 50% | robust | OOS retains >= 50% of IS performance |
| 30-50% | marginal | Some overfitting |
| < 30% | overfit | Severe overfitting |
| both negative | negative | Strategically useless |

VALID: Purge gap of 2*horizon correctly prevents information leakage from overlapping return windows. Cache clearing per fold (H-4 FIX) prevents cross-contamination. WFE = OOS/IS ratio is the standard Pardo (2008) metric.

**[CONCERN]**: Minimum 2 valid folds required (line 770). With K=4 folds and short candle histories (e.g., ~200 bars), some folds may have 0 OOS pattern occurrences, reducing effective fold count. The test degrades gracefully (returns null) but the user should be aware that WFE reliability increases with candle history length.

---

### 3.5.6 Reliability Tier System

`backtestAll()` line 540:

#### Pattern Tier Criteria

| Tier | Requirements | IC Gate |
|------|-------------|---------|
| **A** | adjustedSignificant + wrAlpha >= 5 + n >= 100 + expectancy > 0 + PF >= 1.3 | IC > 0.02 |
| **B** | adjustedSignificant + wrAlpha >= 3 + n >= 30 + expectancy > 0 | IC > 0.01 |
| **C** | wrAlpha > 0 + n >= 30 | -- |
| **D** | default (none of above) | -- |

All thresholds are [D]-tagged (practitioner conventions, not from single published source).

#### Signal Tier Criteria (backtestAllSignals, relaxed)

| Tier | Requirements | IC Gate |
|------|-------------|---------|
| **A** | adjustedSignificant + wrAlpha >= 3 + n >= 50 + expectancy > 0 + PF >= 1.1 | IC > 0.02 |
| **B** | adjustedSignificant + wrAlpha >= 2 + n >= 20 + expectancy > 0 | IC > 0.01 |
| **C** | wrAlpha > 0 + n >= 20 | -- |
| **D** | default | -- |

#### Gating Mechanisms

1. **WFE Gate**: WFE < 30 AND tier = A or B -> demote to C (Pardo 2008)
2. **SPA Gate**: SPA not rejected -> demote all A/B to C (Hansen 2005)
3. **IC Gate**: OOS IC below threshold -> prevent promotion to A or B (Grinold & Kahn 2000)

VALID: Triple-gating (BH-FDR + WFE + SPA + IC) provides comprehensive protection against false positives. Each gate addresses a different failure mode: BH-FDR for multiple testing, WFE for overfitting, SPA for data snooping, IC for predictive power.

---

### 3.5.7 Composite Score & Grade

`_computeStats()` line 1618:

#### Score Formula

```
patternScore = max(0, min(100,
    DA * 0.30 +
    targetHitRate * 0.25 +
    (100 - MAE*10) * 0.25 +
    min(PF*20, 100) * 0.20
))
```

| Component | Weight | Scale | Fallback | Grade |
|-----------|--------|-------|----------|-------|
| Directional Accuracy | 0.30 | 0-100% | -- | [D] |
| Target Hit Rate | 0.25 | 0-100% | DA if null | [D] |
| MAE inverse | 0.25 | 100 - MAE*10 | 50 if null | [D] |
| Profit Factor | 0.20 | min(PF*20, 100) | -- | [D] |

#### Grade Cutoffs

| Grade | Score | Sensitivity |
|-------|-------|-------------|
| A | >= 80 | [D] |
| B | >= 65 | [D] |
| C | >= 50 | [D] |
| D | >= 35 | [D] |
| F | < 35 | [D] |

**[CONCERN]**: All scoring weights and grade boundaries are [D]-tagged. The composite score is entirely practitioner-designed with no published calibration. The MAE scaling factor (x10) and PF scaling factor (x20) are particularly influential -- a MAE of 10% yields a zero contribution, while PF=5 maxes out the PF component.

---

### 3.5.8 Jensen's Alpha & CAPM

`_calcJensensAlpha()` (line 499):

```
alpha = R_pattern - [R_f + beta * (R_market - R_f)]
```

| Parameter | Source | Grade |
|-----------|--------|-------|
| beta | `capm_beta.json` from `compute_capm_beta.py` | [C] |
| R_f | `capm_beta.summary.parameters.rf_annual_pct`, default 3.5% | [C] |
| R_market | `kospi_daily.json` market index returns | [B] |

Per-occurrence Jensen's Alpha computed, then averaged across all pattern instances.

VALID: Correct CAPM-adjusted excess return calculation. Risk-free rate conversion: `rfDaily = (1 + rfAnnual/100)^(1/250) - 1` is correct compound conversion. Graceful fallback when CAPM data unavailable (returns null).

---

### 3.5.9 Information Coefficient (IC)

#### Spearman Rank IC

`_spearmanCorr()` (line 617):
- Pearson-of-ranks with tied rank handling (Kendall & Gibbons 1990)
- Minimum 5 pairs required
- Tied ranks averaged (correct for financial data)

VALID: Spearman rank IC is the standard non-parametric measure for signal predictive power. Robust to non-normal return distributions (Cont 2001). The Pearson-of-ranks formula is used instead of the shortcut d^2 formula because ties are common in financial data.

#### Rolling OOS IC

`_rollingOOSIC()` (line 667):
- Non-overlapping OOS windows of size `minWindow` (default 12)
- Each window's IC computed on unseen data
- Average OOS IC reported
- Falls back to full-sample IC when n < 24 (flagged `isOOS=false`)

VALID: OOS IC addresses in-sample IC inflation (Lo 2002). Non-overlapping windows ensure genuine out-of-sample measurement.

#### ICIR (IC Information Ratio)

- Jackknife leave-one-out for IC variance estimation (n >= 20)
- ICIR = IC / std(IC)

VALID: Jackknife SE estimation is appropriate when the number of IC windows is small.

**[CONCERN]**: IC is computed using in-sample regression coefficients applied to "OOS" observations. This is not true OOS IC because the regression coefficients were fitted on the full training set. True OOS IC would require refitting the regression on each training fold -- which is done in WFE but not in the IC calculation path.

---

## 3.6 Statistical Validation Summary

### 3.6.1 VALID Methodologies

| Item | Methodology | Reference |
|------|-------------|-----------|
| RSI 30/70 thresholds | Canonical oversold/overbought | Wilder (1978) |
| Stochastic 20/80 | Canonical oversold/overbought | Lane (1984) |
| BB(20,2) parameters | Canonical Bollinger Bands | Bollinger (2001) |
| Volume z-score threshold | 2.0 = upper 2.28% | Standard normal |
| Fat-tail t-critical | Kurtosis-adjusted effective df | Cont (2001) |
| BH-FDR correction | FDR q=0.05 step-up | Benjamini & Hochberg (1995) |
| HLZ threshold | t > 3.0 for discovery | Harvey, Liu & Zhu (2016) |
| Hansen SPA test | Bootstrap data snooping correction | Hansen (2005) |
| BCa bootstrap CI | Bias-corrected and accelerated | Efron (1987) |
| Calendar-time bootstrap | Month-level resampling for clustering | Fama & French (2010) |
| WFE with purge gap | 2*horizon contamination guard | Bailey & Lopez de Prado (2014) |
| HC3 robust SEs | Jackknife heteroskedasticity correction | Long & Ervin (2000) |
| Ridge + GCV lambda | Optimal regularization selection | Golub, Heath & Wahba (1979) |
| Feature normalization | Uniform shrinkage requirement | Hoerl & Kennard (1970) |
| Huber-IRLS | Robust regression for fat tails | Huber (1964) |
| Exponential decay lambda=0.995 | AMH regime half-life | Lo (2004) |
| Kyle sqrt(h) cost scaling | Market microstructure theory | Kyle (1985) |
| Survivorship correction | Delisted universe adjustment | Elton et al. (1996) |
| Null WR (Sullivan) | Unconditional base rate | Sullivan et al. (1999) |
| Cohen's h (market-adjusted null) | Effect size vs proper null | Cohen (1988) |
| Sortino denominator | Total N, not N_negative | Sortino & van der Meer (1991) |
| Hyndman-Fan Type 7 percentile | Linear interpolation | Hyndman & Fan (1996) |
| Mincer-Zarnowitz regression | Forecast calibration | Mincer & Zarnowitz (1969) |
| Calibration coverage (train/test) | OOS residual interval | Gneiting & Raftery (2007) |
| Spearman rank IC | Non-parametric predictive power | Grinold & Kahn (2000) |
| Kelly fraction (edge-adjusted) | Uses WR - wrNull, not raw WR | Kelly (1956), Thorp (2006) |
| MACD histogram dedup | Prevents double-counting | Mathematical identity |
| StochRSI neutral zone | Anti-double-counting with RSI | Design pattern |
| Williams %R confluence bonus | Not independent signal | Mathematical equivalence |
| Entropy damping (sqrt) | Diversity-based confidence adjustment | Shannon (1948) |
| Cumulative adjustment cap | Stack inflation guard | Design pattern |
| Double-discount prevention | VKOSPI/HMM mutex | Design pattern |
| IC threshold gate | Reject anti-predictive policy | Design pattern |

### 3.6.2 CRITICAL Issues

| ID | Category | Description | Location | Impact | Fix |
|----|----------|-------------|----------|--------|-----|
| C-1 | Post-filter stacking | Multiplicative discount chain (5+ filters) can reduce confidence to floor=10 | signalEngine.js:597-703 | Confidence values may lose calibration under multiple simultaneous discounts | Add minimum intermediate floor (e.g., max(30, result)) or use additive model for correlated discounts |
| C-2 | Cross-stock MTC | 45 patterns tested across 2,700+ stocks without cross-stock multiple testing correction | backtester.js:516 | 2,700 * 225 = 607,500 effective tests; BH-FDR applied per-stock only | Implement Bonferroni-like cross-stock adjustment or bootstrap-based SPA across stocks |
| C-3 | Survivorship universe | Pattern backtests use survivor-only candle data; delisted stocks missing from OHLCV | backtester.js:1270 | Buy-pattern WR systematically overstated by ~0.1-1.1pp (D-1 partial fix) | Use survivorship_correction.json (already implemented); verify delta_wr magnitudes |

### 3.6.3 WARNING Issues

| ID | Category | Description | Location | Impact | Fix |
|----|----------|-------------|----------|--------|-----|
| W-1 | n/k ratio | WLS regression activates at n=30 with 5 features (n/k=6) | backtester.js:1803 | Underpowered regression, unstable coefficients | Raise minimum to n>=50 (n/k=10) |
| W-2 | RL misalignment | Reward function (return) != evaluation metric (IC) | backtester.js:411 | Policy optimization not aligned with evaluation | Align reward to rank-based metric |
| W-3 | unmeasured WR | 4+ signal types have measuredWR=null | signalEngine.js:879,898 | Confidence values not empirically validated | Run backtest calibration |
| W-4 | IC computation | OOS IC uses in-sample regression coefficients | backtester.js:1947 | IC may overstate predictive power | Refit regression per OOS fold |
| W-5 | SPA bootstrap | Normal noise simplification vs circular block bootstrap | backtester.js:910 | May not capture full test statistic dependence | Accept as pragmatic trade-off for computational cost |

### 3.6.4 Constant Registry (D-Tagged)

Total D-tagged constants identified: ~70 across both files.

#### High Sensitivity (calibration priority)

| Constant | Value | File:Line | Impact |
|----------|-------|-----------|--------|
| Composite window | 5 bars | signalEngine.js:27+ | All 30 composites |
| WLS lambda | 0.995 | backtester.js:1805 | All regression predictions |
| HUBER_DELTA | 5.8 | backtester.js:1844 | Robust estimation cutoff |
| Volume z->conf mapping | 50+15*ln(z) | signalEngine.js:1220 | All volume signals |
| ADV multipliers | 0.75/0.85/1.0/1.1 | signalEngine.js:advLevel | Liquidity scaling |
| Cumulative adj cap | 15 | signalEngine.js:572 | Stack inflation guard |
| Composite score weights | 0.30/0.25/0.25/0.20 | backtester.js:1628 | Grade determination |
| Reliability tier thresholds | alpha>=5, n>=100, PF>=1.3 | backtester.js:569 | A/B/C/D classification |

#### Medium Sensitivity

| Constant | Value | File:Line | Impact |
|----------|-------|-----------|--------|
| RSI hBase neutral | 55 | signalEngine.js:987 | RSI signals when H unavailable |
| MA cross conf | 72/60/70/58 | signalEngine.js:803,824 | Golden/Dead cross confidence |
| MACD conf | 70/58/68/56 | signalEngine.js:934,950 | MACD cross confidence |
| OLS R^2 threshold | 0.50 | signalEngine.js:557 | Trend boost gate |
| Entropy damping range | 0.80 base | signalEngine.js:598 | Min damping scale |
| Crisis severity threshold | 0.7 | signalEngine.js:670 | Crisis discount trigger |
| S/R buy boost factor | 8 | signalEngine.js:747 | Support proximity boost |
| S/R sell boost factor | 5 | signalEngine.js:753 | Resistance proximity boost |
| Grade boundaries | 80/65/50/35 | backtester.js:1632 | Grade cutoffs |
| hw regime boundaries | 1.1/0.9 | backtester.js:2122 | Trending/reverting threshold |
| LinUCB safety clamp | 3.0 | backtester.js:1913 | Max factor multiplier |
| t_stat_delta gate | 2.0 | backtester.js:1908 | LinUCB activation |

#### Low Sensitivity

| Constant | Value | File:Line |
|----------|-------|-----------|
| Sentiment labels | 60/25/-25/-60 | signalEngine.js |
| StochRSI cooldown | 5 bars | signalEngine.js |
| Stochastic cooldown | 7 bars | signalEngine.js |
| Kalman conf | 40 | signalEngine.js:2071 |
| CCI conf | 45 | signalEngine.js |
| Williams %R conf | 42 | signalEngine.js |
| ATR expansion conf | 50 | signalEngine.js |
| CUSUM break conf | 52 | signalEngine.js |
| RL policy staleness | 90 days | backtester.js:280 |
| HMM staleness | 30 days | backtester.js:234 |
| Result cache eviction | 200 entries | backtester.js:464 |
| Bootstrap B | 500 | backtester.js:1484 |
| WFE min folds | 2 valid | backtester.js:770 |
| OOS ratio | 20% | backtester.js:720 |

---

## Appendix A: _META Object (45 patterns)

| Type | Korean Name | Signal |
|------|------------|--------|
| threeWhiteSoldiers | 적삼병 | buy |
| threeBlackCrows | 흑삼병 | sell |
| hammer | 해머 | buy |
| hangingMan | 교수형 | sell |
| shootingStar | 유성형 | sell |
| bullishEngulfing | 상승장악형 | buy |
| bearishEngulfing | 하락장악형 | sell |
| morningStar | 샛별형 | buy |
| eveningStar | 석별형 | sell |
| ascendingTriangle | 상승삼각형 | buy |
| descendingTriangle | 하락삼각형 | sell |
| risingWedge | 상승쐐기 | sell |
| fallingWedge | 하락쐐기 | buy |
| symmetricTriangle | 대칭삼각형 | neutral |
| doubleBottom | 이중바닥 | buy |
| doubleTop | 이중천장 | sell |
| headAndShoulders | 머리어깨형 | sell |
| inverseHeadAndShoulders | 역머리어깨형 | buy |
| piercingLine | 관통형 | buy |
| darkCloud | 먹구름형 | sell |
| dragonflyDoji | 잠자리도지 | buy |
| gravestoneDoji | 비석도지 | sell |
| tweezerBottom | 족집게바닥 | buy |
| tweezerTop | 족집게천장 | sell |
| bullishMarubozu | 양봉마루보주 | buy |
| bearishMarubozu | 음봉마루보주 | sell |
| longLeggedDoji | 긴다리도지 | neutral |
| bullishBeltHold | 강세띠두름 | buy |
| bearishBeltHold | 약세띠두름 | sell |
| bullishHaramiCross | 강세잉태십자 | buy |
| bearishHaramiCross | 약세잉태십자 | sell |
| stickSandwich | 스틱샌드위치 | buy |
| abandonedBabyBullish | 강세버림받은아기 | buy |
| abandonedBabyBearish | 약세버림받은아기 | sell |
| invertedHammer | 역해머 | buy |
| doji | 도지 | neutral |
| bullishHarami | 상승잉태형 | buy |
| bearishHarami | 하락잉태형 | sell |
| spinningTop | 팽이형 | neutral |
| threeInsideUp | 상승삼내형 | buy |
| threeInsideDown | 하락삼내형 | sell |
| channel | 채널 | neutral |
| cupAndHandle | 컵앤핸들 | buy |
| risingThreeMethods | 상승삼법 | buy |
| fallingThreeMethods | 하락삼법 | sell |

---

## Appendix B: External Data Dependencies

| Field | File | Purpose | Fallback |
|-------|------|---------|----------|
| `_rlPolicy` | `data/backtest/rl_policy.json` | LinUCB thetas, win_rates_live | null (no RL) |
| `_behavioralData.illiq_spread` | `data/backtest/illiq_spread.json` | Adaptive slippage | KRX_SLIPPAGE |
| `_behavioralData.hmm_regimes` | `data/backtest/hmm_regimes.json` | HMM vol regime fallback | no HMM |
| `_behavioralData.disposition_proxy` | `data/backtest/disposition_proxy.json` | Doc24 S3 (future) | unused |
| `_behavioralData.csad_herding` | `data/backtest/csad_herding.json` | Chang et al. (2000) | unused |
| `_survivorshipCorr` | `data/backtest/survivorship_correction.json` | Elton et al. (1996) | 0 |
| `_capmBeta` | `data/backtest/capm_beta.json` | CAPM beta per stock | no alpha |
| `_marketIndex` | `data/market/kospi_daily.json` | Market returns | no alpha |
| calibrated_constants | `data/backtest/calibrated_constants.json` | D1 candle_target_atr | hardcoded |

Worker path resolution: `isWorker ? '../data/' : 'data/'`.

---

## Appendix C: Methodology Cross-Reference

| Academic Source | Where Used | Implementation |
|----------------|------------|----------------|
| Wilder (1978) | RSI 30/70, ADX 25, ATR | SIG-04, SIG-14, PF-1 |
| Bollinger (2001) | BB(20,2), squeeze 10% | SIG-05 |
| Lane (1984) | Stochastic 20/80 | SIG-11 |
| Hosoda (1969) | Ichimoku TK cross, cloud | SIG-08 |
| Mandelbrot (1963) / Lo (1991) | Hurst H > 0.6 / < 0.4 | SIG-09 |
| Granville (1963) | OBV divergence | SIG-07 |
| Shannon (1948) | Entropy damping | PF-7 |
| Page (1954) | CUSUM breakpoint | PF-3 |
| Bai & Perron (1998) | Binary segmentation | PF-4 |
| Kalman (1960) / Harvey (1989) | State-space filter | SIG-12 |
| Cont (2001) | Fat-tail t-critical | BT-27, BT-41 |
| Sullivan et al. (1999) | Null win rate | BT-06 |
| Benjamini & Hochberg (1995) | BH-FDR correction | BT-30 |
| Harvey, Liu & Zhu (2016) | t > 3.0 discovery threshold | BT-28 |
| Hansen (2005) | SPA test | Section 3.5.4 |
| Efron (1987) | BCa bootstrap CI | BT-09, Section 3.5.2 |
| Fama & French (2010) | Calendar-time bootstrap | Section 3.5.2 |
| Bailey & Lopez de Prado (2014) | WFE with purge gap | Section 3.5.5 |
| Pardo (2008) | Walk-Forward Efficiency | Section 3.5.5 |
| Hoerl & Kennard (1970) | Ridge feature normalization | Section 3.4.2 |
| Golub, Heath & Wahba (1979) | GCV lambda selection | Section 3.4.2 |
| Huber (1964) | IRLS robust regression | Section 3.4.2 |
| Lo (2004) | AMH, exponential decay | WLS lambda, regime WR |
| Kyle (1985) | sqrt(h) slippage scaling | Section 3.4.1 |
| White (1980) / Long & Ervin (2000) | HC3 robust SEs | Section 3.4.2 |
| Elton, Gruber & Blake (1996) | Survivorship bias correction | Section 3.4.4 |
| Cohen (1988) | Effect size (Cohen's h), MDE | BT-10, BT-29 |
| Kelly (1956) / Thorp (2006) | Kelly fraction | BT-25 |
| Grinold & Kahn (2000) | IC, IR | BT-11, BT-42 |
| Sortino & van der Meer (1991) | Sortino ratio | BT-13 |
| Mincer & Zarnowitz (1969) | Forecast calibration | BT-36 |
| Gneiting & Raftery (2007) | Prediction interval coverage | BT-37 |
| Li et al. (2010) | LinUCB contextual bandit | Section 3.4.3 |
| Amihud (2002) | ILLIQ-based slippage | Section 3.4.1 |

---

*End of S3 Signal Engine & Backtester Anatomy v6*
