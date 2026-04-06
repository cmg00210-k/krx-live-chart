# S3: Technical Analysis Methods — Pattern Detection & Indicator Functions

> **ANATOMY V6** | Stage 3 Sections 3.1-3.2 | 2026-04-06
>
> Definitive production audit of PatternEngine (js/patterns.js ~4,200 lines) and
> Indicator Module (js/indicators.js ~2,218 lines). Every threshold constant
> annotated with CFA-paper grade [A-E], academic source, and sensitivity range.
>
> Cross-references: core_data/06 (Dow/Elliott/Nison), core_data/07 (algorithms),
> core_data/12 (EVT), core_data/22 (learnable constants guide).

---

## 3.1 Indicator Functions Catalog

**File**: `js/indicators.js` (2,218 lines)
**Global constant**: `KRX_TRADING_DAYS = 250` (KRX annual trading days; US uses 252)
**Caching layer**: `IndicatorCache` class (lazy-eval, key-based invalidation)

### 3.1.1 Core Technical Indicators (I-01 through I-10)

| ID | Function | Line | Parameters | Output | Academic Source | Grade |
|----|----------|------|------------|--------|----------------|-------|
| I-01 | `calcMA(data, n)` | 15 | data: number[], n: period | number[] (null-padded) | Murphy (1999) Technical Analysis | [A] |
| I-02 | `calcEMA(data, n)` | 26 | data: number[], n: period | number[] (SMA-seeded init) | Appel (1979); k=2/(n+1) | [A] |
| I-03 | `calcBB(closes, n=20, mult=2)` | 50 | closes, period, multiplier | {upper, lower, mid}[] | Bollinger (2001); population sigma (div n, not n-1) | [A] |
| I-04 | `calcRSI(closes, period=14)` | 63 | closes, period | number[] (0-100) | Wilder (1978) New Concepts; Wilder smoothing | [A] |
| I-05 | `calcATR(candles, period=14)` | 87 | OHLCV[], period | number[] | Wilder (1978); true range with prev close | [A] |
| I-06 | `calcOBV(candles)` | 115 | OHLCV[] | number[] (cumulative) | Granville (1963); Murphy (1999) Ch.7 | [A] |
| I-07 | `calcIchimoku(candles, conv=9, base=26, spanB=52, disp=26)` | 135 | OHLCV[], 4 params | {tenkan, kijun, spanA, spanB, chikou} | Hosoda (1969); standard params | [A] |
| I-08 | `calcKalman(closes, Q=0.01, R=1.0)` | 170 | closes, process noise, meas noise | number[] | Kalman (1960); adaptive Q via Mohamed & Schwarz (1999) | [B] |
| I-09 | `calcMACD(closes, fast=12, slow=26, sig=9)` | 993 | closes, 3 params | {macdLine, signalLine, histogram} | Appel (1979); EMA-based | [A] |
| I-10 | `calcStochastic(candles, kP=14, dP=3, smooth=3)` | 1028 | OHLCV[], 3 params | {k, d}[] (0-100) | Lane (1984); Slow Stochastic | [A] |

### 3.1.2 Extended Oscillators (I-11 through I-15)

| ID | Function | Line | Parameters | Output | Academic Source | Grade |
|----|----------|------|------------|--------|----------------|-------|
| I-11 | `calcStochRSI(closes, rsiP=14, kP=3, dP=3, stochP=14)` | 1085 | closes, 4 params | {k, d}[] (0-100) | Chande & Kroll (1994); Stoch(RSI) | [A] |
| I-12 | `calcCCI(candles, period=20)` | 1158 | OHLCV[], period | number[] | Lambert (1980); 0.015 constant | [A] |
| I-13 | `calcADX(candles, period=14)` | 1187 | OHLCV[], period | {adx, plusDI, minusDI}[] | Wilder (1978); DI+/DI-/ADX | [A] |
| I-14 | `calcWilliamsR(candles, period=14)` | 1262 | OHLCV[], period | number[] (-100 to 0) | Williams (1979) | [A] |
| I-15 | `calcTheilSen(xValues, yValues)` | 1287 | x[], y[] | {slope, intercept} or null | Theil (1950), Sen (1968); BD=29.3% | [A] |

### 3.1.3 Statistical/Econometric Functions (I-16 through I-22)

| ID | Function | Line | Parameters | Output | Academic Source | Grade |
|----|----------|------|------------|--------|----------------|-------|
| I-16 | `calcHurst(closes, minWindow=10)` | 212 | closes, min block size | {H, rSquared} or null | Mandelbrot (1963); Peters (1994) R/S analysis on log-returns | [B] |
| I-17 | `calcHillEstimator(returns, k)` | 276 | returns[], optional k | {alpha, se, isHeavyTail, k} or null | Hill (1975); k=floor(sqrt(n)) per Drees & Kaufmann (1998) | [A] |
| I-18 | `calcGPDFit(returns, quantile=0.99)` | 323 | returns[], VaR level | {VaR, xi, sigma, u, Nu} or null | Pickands-Balkema-de Haan; PWM per Hosking & Wallis (1987) | [B] |
| I-19 | `calcCAPMBeta(stockCloses, marketCloses, window, rfAnnual)` | 391 | closes[], market[], w=250, rf | {beta, alpha, rSquared, thinTrading, nObs} | Sharpe (1964); Scholes-Williams (1977) thin-trading correction | [A] |
| I-20 | `calcHV(candles, period=20)` | 492 | OHLCV[], period | number (annualized) or null | Parkinson (1980); 5x efficiency vs close-to-close | [A] |
| I-21 | `calcVRP(vkospi, hvAnnualized)` | 536 | VKOSPI%, HV decimal | number (variance diff) or null | core_data/34; VRP = IV^2 - HV^2 | [A] |
| I-22 | `calcWLSRegression(X, y, weights, ridgeLambda)` | 558 | design matrix, y, weights, lambda | {coeffs, rSquared, adjR2, stdErrors, tStats, hcStdErrors, hcTStats, df, fitted, sigmaHat2, invXtWX, vifs} | Reschenhofer et al. (2021); Ridge per Hoerl & Kennard (1970); HC3 per MacKinnon & White (1985); VIF per Marquardt (1970) | [A] |

### 3.1.4 Trend & Volatility Regime (I-23 through I-28)

| ID | Function | Line | Parameters | Output | Academic Source | Grade |
|----|----------|------|------------|--------|----------------|-------|
| I-23 | `calcOLSTrend(closes, window=20, atr14Last)` | 912 | closes, window, ATR | {slope, slopeNorm, intercept, r2, direction, tStat} | Lo & MacKinlay (1999); R^2>0.15=trend | [B] |
| I-24 | `calcEWMAVol(closes, lambda=0.94)` | 1336 | closes, decay factor | number[] (conditional sigma) | J.P. Morgan RiskMetrics (1996); Bollerslev (1986) IGARCH | [B] |
| I-25 | `classifyVolRegime(ewmaVol)` | 1385 | ewmaVol[] | string[] ('low'/'mid'/'high'/null) | Heuristic; thresholds 0.75/1.50 of long-run EMA(alpha=0.01) | [C] |
| I-26 | `calcAmihudILLIQ(candles, window=20)` | 1430 | OHLCV[], window | {illiq, logIlliq, level, confDiscount} | Amihud (2002); Kyle (1985) | [B] |
| I-27 | `calcOnlineCUSUM(returns, threshold=2.5, volRegime)` | 1493 | returns[], threshold, regime | {breakpoints, cusum, isRecent, adaptedThreshold} | Page (1954); Roberts (1966) slack; vol-adaptive per Doc34 | [B] |
| I-28 | `calcBinarySegmentation(returns, maxBreaks=3, minSegment=30)` | 1586 | returns[], max breaks, min seg | {breakpoints[]} | Bai-Perron (1998); BIC-based greedy | [B] |

### 3.1.5 HAR-RV & Utilities (I-29 through I-31)

| ID | Function | Line | Parameters | Output | Academic Source | Grade |
|----|----------|------|------------|--------|----------------|-------|
| I-29 | `calcHAR_RV(candles)` | 2213 | OHLCV[] | harRV result[] (via IndicatorCache) | Corsi (2009); OLS on RV_d/RV_w/RV_m | [A] |
| I-30 | `_invertMatrix(m)` | 950 | n x n matrix | n x n inverse or null | Gauss-Jordan with partial pivoting | [A] |
| I-31 | `_jacobiEigen(A, p)` | 758 | p x p symmetric, dim | {eigenvalues, eigenvectors} | Jacobi iteration for GCV lambda | [A] |
| I-32 | `selectRidgeLambdaGCV(X, y, weights, p)` | 826 | design, y, weights, dim | optimal lambda (number) | Golub, Heath & Wahba (1979) GCV | [A] |

### 3.1.6 IndicatorCache Architecture

```
IndicatorCache (line 1692)
  constructor(candles) → setCandles() → invalidate(keyPrefix)
  Lazy accessors: .ma(n), .ema(n), .bb(n,mult), .rsi(period), .atr(period),
    .obv(), .macd(f,s,sig), .ichimoku(conv,base,spanB,disp), .kalman(Q,R),
    .hurst(minWindow), .olsTrend(window), .hill(k), .gpdVaR(quantile),
    .ewmaVol(lambda), .volRegime(lambda), .cusum(threshold,volRegime),
    .binarySegmentation(maxBreaks,minSegment), .stochastic(kP,dP,smooth),
    .stochRsi(rsiP,kP,dP,stochP), .cci(period), .adx(period), .williamsR(period),
    .vma(n), .volRatio(idx,n), .volZScore(idx,n), .harRV(idx), .bbEVT(n,baseMult)
  Key format: "<indicator>_<params>" e.g. "ma_20", "bbEVT_20_2"
  CRITICAL: Contains functions → cannot be postMessage'd to Web Worker (structured clone fails)
```

**bbEVT** (line 1756): EVT-aware Bollinger Band that widens multiplier when Hill alpha < 4.
Formula: `evtMult = baseMult * (1 + 0.45 * max(0, 4 - alpha))`.
[Phase0-#7 fix: coefficient 0.15 -> 0.45]. Grade: [C] -- the 0.45 coefficient and the expansion formula have no direct academic derivation; it is a heuristic inspired by Gopikrishnan (1999) observation that financial returns have alpha ~ 3.

---

## 3.2 Pattern Detection Catalog

**File**: `js/patterns.js` (4,200+ lines)
**Class**: `PatternEngine` (singleton: `const patternEngine = new PatternEngine()`)
**Pattern count**: 41 detect functions producing 45 named pattern types
**KRX backtest basis**: 5-year, 2,768 stocks, 545,307 pattern instances (2021-03 to 2026-03)

### 3.2.0 Pattern Output Schema

Every pattern object returned by `analyze()`:
```js
{
  type: string,           // e.g. 'hammer', 'doubleBottom'
  name: string,           // Korean + English display name
  nameShort: string,      // Abbreviated Korean name
  signal: 'buy'|'sell'|'neutral',
  strength: 'strong'|'medium'|'weak',
  confidence: number,     // 0-100 (형태점수, UI display)
  confidencePred: number, // 0-95 (예측승률, model input, direction-aware)
  stopLoss: number|null,  // KRW price
  priceTarget: number|null, // KRW price
  riskReward: number|null,  // reward/risk ratio
  description: string,    // Korean description
  startIndex: number,
  endIndex: number,
  marker: {...},           // TradingView marker config
  hw: number,              // Hurst weight
  vw: number,              // Vol weight (metadata only, E-grade deprecated from wc)
  mw: number,              // Mean-reversion weight
  rw: number,              // Regime weight
  wc: number,              // Composite weight = hw * mw * rw
  // Chart patterns additionally include:
  neckline: number,        // for DB/DT/H&S/invH&S/cupAndHandle
  necklineBreakConfirmed: boolean,
  breakoutConfirmed: boolean,
  trendlines: [{...}],     // for H&S neckline visualization
  _swingLookback: number,  // look-ahead bias offset for backtester
  _breakUsedFutureData: boolean,
}
```

### 3.2.1 Single Candle Patterns (P-01 through P-11)

| ID | Pattern | Type | Signal | Key Thresholds | Line | WR% | n | Tier |
|----|---------|------|--------|----------------|------|-----|---|------|
| P-01 | `hammer` | single | buy | SHADOW_BODY_MIN=2.0, COUNTER_SHADOW_MAX_STRICT=0.15, MAX_BODY_RANGE_HAMMER=0.40, MIN_BODY_RANGE=0.10; trend=down required | 1322 | 45.2 | 4,293 | B |
| P-02 | `invertedHammer` | single | buy | Same body/range as hammer; upper shadow > 2x body, lower shadow < 0.3x body; trend=down required | 1368 | 48.9 | 6,710 | B |
| P-03 | `hangingMan` | single | sell | Same geometry as hammer; trend=up required (strength >= 0.3); no look-ahead confirmation | 1410 | 59.4 | 5,554 | S |
| P-04 | `shootingStar` | single | sell | Same geometry as invertedHammer; trend=up required; vol boost (+3 if volR>=2.0, -2 if <0.7) | 1461 | 59.2 | 4,472 | S |
| P-05 | `doji` | single | context | DOJI_BODY_RATIO=0.05, MIN_RANGE_ATR=0.3; signal from trend context | 1512 | 42.0 | 42,031 | D-SUPPRESS |
| P-06 | `dragonflyDoji` | single | buy | DOJI_BODY_RATIO=0.05, SPECIAL_DOJI_SHADOW_MIN=0.70 (lower shadow >= 70% range), SPECIAL_DOJI_COUNTER_MAX=0.15 | 1941 | 45.0 | 1,180 | B |
| P-07 | `gravestoneDoji` | single | sell | Mirror of dragonfly; upper shadow >= 70% range | 1996 | 62.0 | 1,107 | S |
| P-08 | `spinningTop` | single | neutral | SPINNING_BODY_MIN=0.05, SPINNING_BODY_MAX=0.30, SPINNING_SHADOW_RATIO=0.75 | 2259 | 43.1 | 559,149 | D-SUPPRESS |
| P-09 | `longLeggedDoji` | single | context | DOJI_BODY_RATIO=0.05, LONG_DOJI_SHADOW_MIN=0.30 (both shadows >= 30%), LONG_DOJI_RANGE_MIN=0.80 ATR | 2310 | 45.0 | 36,690 | D-SUPPRESS |
| P-10 | `bullishMarubozu` | single | buy | MARUBOZU_BODY_RATIO=0.85 (body >= 85% range), MARUBOZU_SHADOW_MAX=0.02 (shadows <= 2% body); trend filter: skip if up | 2172 | 41.8 | 30,796 | B |
| P-11 | `bearishMarubozu` | single | sell | Same thresholds; trend filter: skip if down | 2172 | 57.7 | 41,696 | S |

### 3.2.2 Double Candle Patterns (P-12 through P-19)

| ID | Pattern | Type | Signal | Key Thresholds | Line | WR% | n | Tier |
|----|---------|------|--------|----------------|------|-----|---|------|
| P-12 | `bullishEngulfing` | double | buy | ENGULF_PREV_BODY_MIN=0.2, ENGULF_CURR_BODY_MIN=0.25, ENGULF_BODY_MULT=1.5; volR>=0.7 gate; trend!=up | 1551 | 41.3 | 103,287 | B |
| P-13 | `bearishEngulfing` | double | sell | Mirror; trend!=down | 1551 | 57.2 | 113,066 | S |
| P-14 | `bullishHarami` | double | buy | HARAMI_PREV_BODY_MIN=0.3, HARAMI_CURR_BODY_MAX=0.5, HARAMI_CURR_BODY_MIN=0.05; 0.8x quality penalty (no confirmation) | 1637 | 44.1 | 52,880 | B |
| P-15 | `bearishHarami` | double | sell | Mirror | 1637 | 58.7 | 47,269 | S |
| P-16 | `piercingLine` | double | buy | PIERCING_BODY_MIN=0.3 (both bodies); curr opens below prev low, closes > prev midpoint; trend=down | 1809 | 50.2 | 3,753 | B |
| P-17 | `darkCloud` | double | sell | Mirror; curr opens above prev high, closes < prev midpoint; trend=up | 1875 | 58.5 | 3,093 | S |
| P-18 | `tweezerBottom` | double | buy | TWEEZER_BODY_MIN=0.25, TWEEZER_TOLERANCE=0.1 ATR; matching lows | 2051 | 46.5 | 9,024 | B |
| P-19 | `tweezerTop` | double | sell | Mirror; matching highs | 2109 | 56.8 | 5,994 | A |

### 3.2.3 Triple Candle Patterns (P-20 through P-25)

| ID | Pattern | Type | Signal | Key Thresholds | Line | WR% | n | Tier |
|----|---------|------|--------|----------------|------|-----|---|------|
| P-20 | `threeWhiteSoldiers` | triple | buy | THREE_SOLDIER_BODY_MIN=0.5 ATR (each body); upper wicks < 0.5x body; opens within prev body; trend!=up (reversal) | 1105 | 47.6 | 4,811 | B |
| P-21 | `threeBlackCrows` | triple | sell | Mirror; lower wicks < 0.5x body; trend!=down | 1151 | 57.5 | 4,812 | S |
| P-22 | `morningStar` | triple | buy | STAR_BODY_MAX=0.2 (star body), STAR_END_BODY_MIN=0.5 (end bodies); gap down then up; trend=down | 1700 | 40.5 | 29,550 | B |
| P-23 | `eveningStar` | triple | sell | Mirror; gap up then down; trend=up | 1752 | 56.7 | 26,229 | S |
| P-24 | `threeInsideUp` | triple | buy | THREE_INSIDE_CONFIRM_MIN=0.2 ATR (3rd body); harami + confirmation close above | 2429 | 42.4 | 14,275 | B |
| P-25 | `threeInsideDown` | triple | sell | Mirror; confirmation close below | 2478 | 55.1 | 13,760 | A |

### 3.2.4 Extended Candle Patterns (P-26 through P-34)

| ID | Pattern | Type | Signal | Key Thresholds | Line | WR% | n | Tier |
|----|---------|------|--------|----------------|------|-----|---|------|
| P-26 | `bullishBeltHold` | single | buy | BELT_BODY_RATIO_MIN=0.60, BELT_OPEN_SHADOW_MAX=0.05, BELT_CLOSE_SHADOW_MAX=0.30, BELT_BODY_ATR_MIN=0.40 | 2360 | 51.4 | 3,930 | D-SUPPRESS |
| P-27 | `bearishBeltHold` | single | sell | Mirror | 2360 | 57.4 | 3,355 | S |
| P-28 | `bullishHaramiCross` | double | buy | HARAMI_CROSS_DOJI_MAX=0.08 (2nd bar is near-doji) | 2611 | 46.0 | 8,500 | D-SUPPRESS |
| P-29 | `bearishHaramiCross` | double | sell | Mirror | 2611 | 57.5 | 7,200 | S |
| P-30 | `abandonedBabyBullish` | triple | buy | ABANDONED_BABY_DOJI_MAX=0.15, ABANDONED_BABY_GAP_MIN=0.03 ATR | 2531 | 51.8 | 137 | D-CONTEXT |
| P-31 | `abandonedBabyBearish` | triple | sell | Mirror | 2531 | 64.8 | 71 | D-CONTEXT |
| P-32 | `stickSandwich` | triple | buy | STICK_SANDWICH_CLOSE_TOL=0.05 ATR (1st/3rd close match), STICK_SANDWICH_MID_BODY_MIN=0.3 ATR | 2695 | 52.0 | 420 | D-CONTEXT |
| P-33 | `risingThreeMethods` | 5-bar | buy | Body0 > 0.7 ATR; 3 inner bars = small bearish, within body0 range; body4 close > body0 high; trend=up (continuation) | 1202 | -- | -- | B |
| P-34 | `fallingThreeMethods` | 5-bar | sell | Mirror; inner bars = small bullish; trend=down | 1263 | -- | -- | B |

### 3.2.5 Chart Patterns (P-35 through P-45)

| ID | Pattern | Type | Signal | Key Thresholds | Line | WR% | n | Tier |
|----|---------|------|--------|----------------|------|-----|---|------|
| P-35 | `doubleBottom` | chart | buy | Swing lows within 0.5 ATR; span 5-40 bars; pre-trend=down; neckline = max high between lows | 3127 | 62.1 | 1,939 | S |
| P-36 | `doubleTop` | chart | sell | Mirror with swing highs; pre-trend=up; neckline = min low between highs | 3177 | 74.7 | 1,539 | S |
| P-37 | `headAndShoulders` | chart | sell | HS_WINDOW=120 bars, HS_SHOULDER_TOLERANCE=0.15; head > both shoulders; sloped neckline via 2 troughs; vol decline check; pre-trend=up | 3227 | 56.9 | 1,156 | A |
| P-38 | `inverseHeadAndShoulders` | chart | buy | Mirror; head < both shoulders; pre-trend=down | 3308 | 44.0 | 1,280 | B |
| P-39 | `ascendingTriangle` | chart | buy | Flat resistance (std < 0.3 ATR), rising lows slope > 0.03 ATR/bar; >= 2+2 touches; vol contraction scored | 2752 | 39.5 | 352 | B |
| P-40 | `descendingTriangle` | chart | sell | Flat support, falling highs | 2817 | 54.3 | 503 | B |
| P-41 | `symmetricTriangle` | chart | context | Both converging; slope_hi < -0.02, slope_lo > 0.02; direction from pre-trend | 3042 | 32.3 | 2,678 | B |
| P-42 | `risingWedge` | chart | sell | Both rising but converging; slope_hi > 0 and slope_lo > 0; |slope_hi| < |slope_lo| | 2886 | 59.8 | 1,054 | A |
| P-43 | `fallingWedge` | chart | buy | Mirror of risingWedge | 2962 | 39.1 | 2,380 | B |
| P-44 | `channel` | chart | context | CHANNEL_TOUCH_TOL=0.3 ATR, CHANNEL_PARALLELISM_MAX=0.020, CHANNEL_WIDTH_MIN=1.5, WIDTH_MAX=8.0 ATR, CONTAINMENT=0.80, MIN_SPAN=15, MIN_TOUCHES=3 | 3651 | 58.0 | 125 | B |
| P-45 | `cupAndHandle` | chart | buy | Cup depth 12-35% of rim; U-shape R^2 > 0.6; right rim >= 90% of left rim; handle depth < 50% cup depth; handle len 15-30% of cup width | 3790 | 61.0 | 125 | B |

### 3.2.6 Support/Resistance Detection

| Function | Type | Line | Method |
|----------|------|------|--------|
| `detectSupportResistance` | S/R | 3395 | Swing-point clustering (ATR*0.5 tolerance), min 2 touches, max 10 levels, sorted by touch count |
| `detectValuationSR` | Valuation S/R | (inline in analyze) | BPS/EPS-based price levels within VALUATION_SR_RANGE=0.30 (KRX daily limit), max 5 levels |

---

## 3.2.1 Threshold Constants Registry

Complete enumeration of all static constants in `PatternEngine` class (lines 22-366).

### Candle Geometry Constants

| Constant | Value | Grade | Academic Source | Sensitivity | Line |
|----------|-------|-------|----------------|-------------|------|
| `DOJI_BODY_RATIO` | 0.05 | [A] | Nison (1991) "body < 5% of range" | 0.03-0.08 (tighter=fewer doji, >0.08 includes near-doji) | 23 |
| `SHADOW_BODY_MIN` | 2.0 | [A] | Morris (2006) "lower shadow >= 2x body" | 1.5-3.0 (1.5=lenient, 3.0=strict) | 26 |
| `COUNTER_SHADOW_MAX_STRICT` | 0.15 | [A] | Morris (2006) for hammer | 0.05-0.20 | 29 |
| `COUNTER_SHADOW_MAX_LOOSE` | 0.30 | [B] | For inverted hammer/hangingMan/shootingStar | 0.15-0.40 | 30 |
| `MIN_BODY_RANGE` | 0.10 | [B] | Nison (1991) minimum visible body | 0.05-0.15 | 33 |
| `MAX_BODY_RANGE_HAMMER` | 0.40 | [C] | Nison (1991) 0.33 + KRX tick margin. [T-8] 0.45->0.40 | 0.33-0.45 | 37 |
| `THREE_SOLDIER_BODY_MIN` | 0.50 | [B] | Nison (1991) "long real body". [T-5] 0.3->0.5 | 0.3-0.7 | 41 |
| `ENGULF_PREV_BODY_MIN` | 0.20 | [B] | Nison "visible real body". [Audit] 0.1->0.2 | 0.10-0.30 | 46 |
| `ENGULF_CURR_BODY_MIN` | 0.25 | [B] | Nison | 0.15-0.35 | 47 |
| `ENGULF_BODY_MULT` | 1.50 | [C] | Nison "clearly engulfs" + KRX limit. [T-4] 1.2->1.5 | 1.2-2.0 | 51 |
| `HARAMI_PREV_BODY_MIN` | 0.30 | [B] | Nison (1991) | 0.20-0.40 | 54 |
| `HARAMI_CURR_BODY_MAX` | 0.50 | [B] | Nison (1991) | 0.30-0.60 | 55 |
| `HARAMI_CURR_BODY_MIN` | 0.05 | [B] | Minimum visible inner body | 0.03-0.10 | 56 |
| `STAR_BODY_MAX` | 0.20 | [A] | Nison (1991) star body ratio | 0.10-0.25 | 60 |
| `STAR_END_BODY_MIN` | 0.50 | [B] | Nison (1991) "long body". [T-6] 0.3->0.5 | 0.30-0.70 | 61 |
| `PIERCING_BODY_MIN` | 0.30 | [B] | Nison (1991) | 0.25-0.40 | 64 |
| `SPECIAL_DOJI_SHADOW_MIN` | 0.70 | [B] | Nison (1991) dragonfly/gravestone shadow dominance | 0.60-0.80 | 67 |
| `SPECIAL_DOJI_COUNTER_MAX` | 0.15 | [C] | Nison + KRX tick tolerance. [Phase1-D] 0.10->0.15 | 0.05-0.20 | 70 |
| `TWEEZER_BODY_MIN` | 0.25 | [C] | Nison + KRX tick. [T-7] 0.15->0.25 | 0.15-0.35 | 74 |
| `TWEEZER_TOLERANCE` | 0.10 | [C] | ATR*0.1 matching tolerance | 0.05-0.15 | 75 |
| `MARUBOZU_BODY_RATIO` | 0.85 | [A] | Nison (1991) body >= 85% of range | 0.80-0.95 | 78 |
| `MARUBOZU_SHADOW_MAX` | 0.02 | [A] | Morris (2006) shadows <= 2% of body | 0.01-0.05 | 80 |
| `SPINNING_BODY_MIN` | 0.05 | [A] | Nison (1991) above doji threshold | 0.03-0.08 | 83 |
| `SPINNING_BODY_MAX` | 0.30 | [A] | Nison (1991) below normal body | 0.25-0.35 | 84 |
| `SPINNING_SHADOW_RATIO` | 0.75 | [B] | Morris (2006) "shadow > body". [E-2] 0.50->0.75 | 0.50-1.00 | 87 |
| `THREE_INSIDE_CONFIRM_MIN` | 0.20 | [B] | Nison (1991) confirmation body size | 0.15-0.30 | 90 |
| `ABANDONED_BABY_DOJI_MAX` | 0.15 | [C] | Bulkowski (2008) near-doji. [Phase1-B] 0.10->0.15 | 0.05-0.20 | 94 |
| `ABANDONED_BABY_GAP_MIN` | 0.03 | [C] | KRX near-gap adapted. [Phase1-B] 0.05->0.03 | 0.02-0.10 | 97 |
| `LONG_DOJI_SHADOW_MIN` | 0.30 | [A] | Nison (1991) both shadows >= 30% | 0.25-0.40 | 100 |
| `LONG_DOJI_RANGE_MIN` | 0.80 | [B] | Larger than normal doji range | 0.50-1.00 | 102 |
| `BELT_BODY_RATIO_MIN` | 0.60 | [B] | Morris (2006) strong body | 0.55-0.70 | 105 |
| `BELT_OPEN_SHADOW_MAX` | 0.05 | [B] | Morris (2006) nearly no opening shadow | 0.02-0.10 | 107 |
| `BELT_CLOSE_SHADOW_MAX` | 0.30 | [D] | Differentiates from marubozu | 0.20-0.40 | 109 |
| `BELT_BODY_ATR_MIN` | 0.40 | [D] | Minimum meaningful size | 0.30-0.50 | 111 |
| `HARAMI_CROSS_DOJI_MAX` | 0.08 | [B] | Nison (1991) near-doji for harami cross | 0.05-0.10 | 115 |
| `STICK_SANDWICH_CLOSE_TOL` | 0.05 | [C] | KRX tick-size adapted | 0.03-0.08 | 120 |
| `STICK_SANDWICH_MID_BODY_MIN` | 0.30 | [B] | Bulkowski (2008) visible middle body | 0.20-0.40 | 122 |

### Chart Pattern Constants

| Constant | Value | Grade | Academic Source | Sensitivity | Line |
|----------|-------|-------|----------------|-------------|------|
| `MIN_RANGE_ATR` | 0.30 | [D] | Minimum meaningful candle range | 0.20-0.50 | 125 |
| `TREND_THRESHOLD` | 0.30 | [D] | core_data/07 SS3.4: normalized slope threshold for trend direction | 0.20-0.50 | 130 |
| `STOP_LOSS_ATR_MULT` | 2.0 | [B] | Wilder (1978) standard | 1.5-3.0 | 138 |
| `ATR_FALLBACK_PCT` | 0.02 | [D] | KRX large-cap median ATR/close ~ 2.1% | 0.015-0.030 | 143 |
| `CHART_TARGET_ATR_CAP` | 6.0 | [B] | EVT 99.5% VaR bound (core_data/12 S4.3) | 4-8 (dynamic: 4 if Hill alpha<3, 5 if <4) | 193 |
| `CHART_TARGET_RAW_CAP` | 2.0 | [B] | Bulkowski P80 (pattern height x2 = top 20%) | 1.5-2.5 | 196 |
| `PROSPECT_STOP_WIDEN` | 1.15 | [D] | Loosely inspired by Kahneman & Tversky (1979) loss aversion; sqrt(2.25) dampened to 1.15 for KRX | 1.0-1.5 | 202 |
| `PROSPECT_TARGET_COMPRESS` | 0.87 | [C] | 1/PROSPECT_STOP_WIDEN; disposition effect | 0.80-1.0 | 204 |
| `NECKLINE_BREAK_LOOKFORWARD` | 20 | [B] | Bulkowski (2005) 5-15 day avg, 20 = time decay | 10-30 | 209 |
| `NECKLINE_BREAK_ATR_MULT` | 0.5 | [B] | Edwards & Magee (2018) "decisive penetration" | 0.3-0.8 | 213 |
| `NECKLINE_UNCONFIRMED_PENALTY` | 15 | [B] | Bulkowski (2005) confirmed 83% vs unconfirmed 35% | 10-20 | 216 |
| `NECKLINE_UNCONFIRMED_PRED_PENALTY` | 20 | [D] | Higher for model input | 10-25 | 217 |
| `TRIANGLE_BREAK_ATR_MULT` | 0.3 | [B] | Bulkowski (2005) proportional to neckline 0.5 | 0.2-0.5 | 221 |
| `TRIANGLE_BREAK_LOOKFORWARD` | 15 | [B] | Bulkowski (2005) "2/3 to 3/4 of apex" | 10-20 | 222 |
| `TRIANGLE_UNCONFIRMED_PENALTY` | 12 | [D] | Heuristic | 8-15 | 223 |
| `TRIANGLE_UNCONFIRMED_PRED_PENALTY` | 15 | [D] | Higher for model input | 10-20 | 224 |
| `CHANNEL_TOUCH_TOL` | 0.3 | [D] | ATR*0.3 trendline touch tolerance | 0.2-0.5 | 228 |
| `CHANNEL_PARALLELISM_MAX` | 0.020 | [D] | Max slope difference per bar (ATR ratio) | 0.010-0.030 | 229 |
| `CHANNEL_WIDTH_MIN` | 1.5 | [D] | ATR multiples | 1.0-2.0 | 230 |
| `CHANNEL_WIDTH_MAX` | 8.0 | [D] | ATR multiples | 5.0-10.0 | 231 |
| `CHANNEL_CONTAINMENT` | 0.80 | [D] | 80% of bars within channel | 0.70-0.90 | 232 |
| `CHANNEL_MIN_SPAN` | 15 | [D] | Minimum bars in channel | 10-20 | 233 |
| `CHANNEL_MIN_TOUCHES` | 3 | [B] | Murphy (1999) minimum | 2-4 | 234 |
| `HS_WINDOW` | 120 | [C] | Bulkowski P75=85 + KRX margin. [Phase1-A] 80->120 | 80-150 | 238 |
| `HS_SHOULDER_TOLERANCE` | 0.15 | [B] | Bulkowski (2005) 40% have >5% asymmetry. [Phase1-A] 0.10->0.15 | 0.10-0.20 | 242 |
| `VALUATION_SR_RANGE` | 0.30 | [C] | KRX daily limit +-30% | 0.20-0.40 | 352 |
| `VALUATION_SR_MAX_LEVELS` | 5 | [D] | Prevent overcrowding | 3-7 | 355 |
| `VALUATION_SR_STRENGTH` | 0.60 | [D] | Conservative vs technical S/R | 0.40-0.80 | 358 |

### AMH & Behavioral Constants

| Constant | Value | Grade | Academic Source | Sensitivity | Line |
|----------|-------|-------|----------------|-------------|------|
| `AMH_LAMBDA.KOSDAQ` | 0.00367 | [C] | core_data/20 S10; half-life 189d | 0.002-0.005 | 363 |
| `AMH_LAMBDA.KOSPI` | 0.00183 | [C] | core_data/20 S10; half-life 378d | 0.001-0.003 | 364 |
| `AMH_LAMBDA.DEFAULT` | 0.00275 | [C] | Half-life 252d (1 year) | 0.002-0.004 | 365 |

### Target Price & Stop Loss Constants

| Constant | Value | Grade | Academic Source | Line |
|----------|-------|-------|----------------|------|
| `CANDLE_TARGET_ATR.strong` | 1.88 | [B] | KRX 76,443-instance Theil-Sen calibration (CI95=[1.86,1.91]) | 190 |
| `CANDLE_TARGET_ATR.medium` | 2.31 | [B] | Theil-Sen (CI95=[2.23,2.39]). Non-monotonic: reversal overshoot | 190 |
| `CANDLE_TARGET_ATR.weak` | 2.18 | [B] | Theil-Sen (CI95=[2.09,2.28]). WARNING: confounded by volatile context | 190 |

### ATR Fallback by Timeframe

| Timeframe | Value | Rationale | Line |
|-----------|-------|-----------|------|
| 1m | 0.002 | ~0.2% typical | 149 |
| 5m | 0.004 | ~0.3-0.5% | 149 |
| 15m | 0.006 | ~0.5-0.7% | 149 |
| 30m | 0.008 | ~0.7-1.0% | 149 |
| 1h | 0.012 | ~1.0-1.5% | 149 |
| 1d | 0.020 | KRX large-cap median | 149 |
| 1w | 0.044 | sqrt(5) x daily | 149 |
| 1M | 0.090 | sqrt(22) x daily | 149 |

### Grade Distribution Summary

| Grade | Count | Description |
|-------|-------|-------------|
| [A] | 16 | Canonical academic standard, exact formula match |
| [B] | 33 | Published source with minor adaptation (KRX tick, sample-based adjustment) |
| [C] | 14 | Published inspiration but adapted threshold or no direct derivation |
| [D] | 17 | Heuristic, no formal academic derivation; flagged for learnable calibration |

---

## 3.2.2 Quality Scoring System

### Q_WEIGHT Decomposition (line 133)

```
Q_WEIGHT = { body: 0.25, volume: 0.25, trend: 0.20, shadow: 0.15, extra: 0.15 }
```

| Factor | Weight | Meaning | Default if absent |
|--------|--------|---------|-------------------|
| `body` | 0.25 | Body size relative to ATR or pattern geometry | 0.5 |
| `volume` | 0.25 | Current volume / VMA(20) ratio, capped at 1.0 | 0.5 |
| `trend` | 0.20 | Pre-existing trend alignment strength (Theil-Sen) | 0.5 |
| `shadow` | 0.15 | Shadow/wick quality (pattern-specific) | 0.5 |
| `extra` | 0.15 | Confirmation factors (vol increase, gap, etc.) | **0.3** (conservative) |

### _quality() Function (line 547)

```js
_quality({ body = 0.5, volume = 0.5, trend = 0.5, shadow = 0.5, extra = 0.3 }) {
  const raw = W.body * body + W.volume * volume + W.trend * trend
            + W.shadow * shadow + W.extra * extra;
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}
```

**Output range**: 0-100 integer.
**Default (all 0.5 except extra 0.3)**: 0.25*0.5 + 0.25*0.5 + 0.20*0.5 + 0.15*0.5 + 0.15*0.3 = 0.470 -> 47%.

### _adaptiveQuality() Function (line 560)

Used for chart patterns only (9 types). Blends learned WLS regression weights with prior Q_WEIGHT:

```
alpha = min(decayedConfidence * 2, alphaCap)
  alphaCap = 0.7 if R^2 > 0.3, else 0.5
  decayedConfidence = learned.confidence * _temporalDecayFactor()

W_final = (1 - alpha) * Q_WEIGHT + alpha * W_learned
```

**AMH decay**: `_temporalDecayFactor() = exp(-lambda * daysSince)` where lambda is market-specific (KOSDAQ: 0.00367, KOSPI: 0.00183).

### Confidence Adjustments Pipeline (in analyze())

1. **Quality score** (base): `_quality()` or `_adaptiveQuality()` -> confidence 0-100
2. **Neckline unconfirmed**: -15 (`NECKLINE_UNCONFIRMED_PENALTY`)
3. **Triangle unconfirmed**: -12 (`TRIANGLE_UNCONFIRMED_PENALTY`)
4. **Look-ahead bias guard**: `_breakUsedFutureData=true` -> same penalty as unconfirmed
5. **R:R gate** (`_applyRRGate`): rr < 0.5 -> -5, rr < 1.0 -> -3
6. **confidencePred** construction:
   - Base: Beta-Binomial shrunk WR (or PATTERN_WIN_RATES_LIVE if available)
   - Direction-aware: sell patterns invert WR (100 - WR)
   - Quality scaling: clamp(confidence/50, 0.88, 1.12) multiplicative
   - Unconfirmed penalty: -20 (NECKLINE_UNCONFIRMED_PRED_PENALTY) or -15 (TRIANGLE)
   - Final clamp: [10, 95]
7. **Bayesian sigmoid R:R**: `penalty = max_pen / (1 + exp(k * (rr - rr_mid)))` where max_pen=15, k=8, rr_mid=2.375
8. **Herding adjustment** (`_applyHerdingAdjust`): CSAD flag >= 1.67 -> x0.76
9. **Breakpoint adjustment** (`_applyBreakpointAdjust`): CUSUM recent 20 bars -> linear recovery 0.70-1.0
10. **Deduplication** (`_dedup`): Same type within 3 bars -> keep highest confidence

---

## 3.2.3 5-Tier Classification System

Source: `js/appState.js` lines 46-193

### S-Tier (Always Rendered)

**Criteria**: WR >= 57% (or <43% inverted), n > 1000, multi-agent consensus

**S-Tier Candle** (11 patterns):
| Pattern | WR% | n | Rationale |
|---------|-----|---|-----------|
| gravestoneDoji | 62.0 | 1,107 | Nison (1991) upper rejection |
| shootingStar | 59.2 | 4,472 | Morris (2006) high-point selling |
| hangingMan | 59.4 | 5,554 | Nison (1991) downward pressure |
| bearishHarami | 58.7 | 47,269 | Nison (1991) momentum decay |
| darkCloud | 58.5 | 3,093 | Nison (1991) optimism negation |
| bearishMarubozu | 57.7 | 41,696 | Nison (1991) absolute selling pressure |
| threeBlackCrows | 57.5 | 4,812 | Nison (1991) staircase decline |
| bearishHaramiCross | 57.5 | 7,200 | Nison (1991) trend unsustainability |
| bearishBeltHold | 57.4 | 3,355 | Morris (2006) relaxed marubozu |
| bearishEngulfing | 57.2 | 113,066 | Nison (1991) largest sample, prior-day negation |
| eveningStar | 56.7 | 26,229 | Nison (1991) 3-bar top reversal |

**S-Tier Chart** (2 patterns):
| Pattern | WR% | n | Rationale |
|---------|-----|---|-----------|
| doubleTop | 74.7 | 1,539 | Edwards & Magee (2018) highest WR in system |
| doubleBottom | 62.1 | 1,939 | Edwards & Magee (2018) W-bottom |

### A-Tier (Default Display)

**Criteria**: WR 55-57%, or composite signal essential input, 2+ agent consensus

**A-Tier Candle** (2 patterns):
| Pattern | WR% | n |
|---------|-----|---|
| tweezerTop | 56.8 | 5,994 |
| threeInsideDown | 55.1 | 13,760 |

**A-Tier Chart** (2 patterns):
| Pattern | WR% | n |
|---------|-----|---|
| risingWedge | 59.8 | 1,054 |
| headAndShoulders | 56.9 | 1,156 |

### B-Tier (Computed, Not Rendered Standalone)

**Criteria**: Essential for composite signals or mirror of S/A-tier. WR < 55%.

**B-Tier Candle** (15 patterns): hammer, tweezerBottom, piercingLine, dragonflyDoji, threeWhiteSoldiers, bullishEngulfing, morningStar, bullishHarami, threeInsideUp, invertedHammer, bullishMarubozu, risingThreeMethods, fallingThreeMethods

**B-Tier Chart** (7 patterns): channel, descendingTriangle, inverseHeadAndShoulders, cupAndHandle, fallingWedge, ascendingTriangle, symmetricTriangle

### D-Tier: SUPPRESS (5 patterns)

**Criteria**: WR ~ 50% (noise), confirmation bias risk

| Pattern | WR% | n | Rationale |
|---------|-----|---|-----------|
| longLeggedDoji | 45.0 | 36,690 | Neutral, highest confirmation bias risk |
| bullishHaramiCross | 46.0 | 8,500 | Buy reverse-signal |
| bullishBeltHold | 51.4 | 3,930 | p=0.17, indistinguishable from 50% |
| spinningTop | 43.1 | 559,149 | Noise generator at 559K instances |
| doji | 42.0 | 42,031 | No independent predictive power |

### D-Tier: CONTEXT_ONLY (3 patterns)

**Criteria**: Ultra-small sample (n < 500) or WR confidence interval includes 50%

| Pattern | WR% | n | Rationale |
|---------|-----|---|-----------|
| abandonedBabyBullish | 51.8 | 137 | KRX gap rarity |
| abandonedBabyBearish | 64.8 | 71 | KRX gap rarity (n too small) |
| stickSandwich | 52.0 | 420 | WR CI includes 50% |

### Tier Promotion Protocol (appState.js line 209)

**B -> A promotion requires ALL**:
1. WR > 55% (sell) or < 45% (buy reversed), n >= 500
2. BH-FDR corrected q < 0.05
3. Walk-Forward WFE >= 50%
4. 2+ agent ESSENTIAL judgment
5. Reliability Tier B+

**A -> B demotion**: WR enters 47-53% range or loses statistical significance after n accumulation.

---

## 3.2.4 Target Price & Stop Loss

### _candleTarget() (line 614)

```
target = entry +/- ATR * CANDLE_TARGET_ATR[strength] * hw * mw * PROSPECT_TARGET_COMPRESS
```

Where:
- `CANDLE_TARGET_ATR = { strong: 1.88, medium: 2.31, weak: 2.18 }` (KRX Theil-Sen calibrated)
- `PROSPECT_TARGET_COMPRESS = 0.87` (disposition effect)
- `hw = hurstWeight`, `mw = meanRevWeight`

**Non-monotonic relationship explanation** (line 183-188):
- "strong" patterns (engulfing, 3soldiers) confirm ongoing moves -> residual move smaller (1.88)
- "medium" patterns (hammer, shootingStar) are reversals -> stop-cascade + mean-reversion overshoot (2.31)
- "weak" patterns appear more in volatile contexts -> confounding artifact (2.18)
- WARNING: weak > strong is a Theil-Sen calibration artifact, not causal

### _stopLoss() (line 594)

```
adjMult = STOP_LOSS_ATR_MULT * PROSPECT_STOP_WIDEN  // 2.0 * 1.15 = 2.30
stopDist = ATR * adjMult
if (GPD VaR99 exists && gpdDist > stopDist) stopDist = gpdDist
stopLoss = close -/+ stopDist (buy/sell)
```

**GPD VaR integration**: When n >= 500 (2+ years daily), calcGPDFit provides tail risk VaR at 99% confidence. The larger of ATR-based stop and GPD-based stop is used, ensuring fat-tail protection.

### Chart Pattern Target Price

```
patternHeight = min(raw * hw * mw, raw * CHART_TARGET_RAW_CAP, ATR * dynamicATRCap)
```

**3-level cap system**:
1. **Raw cap**: pattern_height * hw * mw (Hurst + mean-reversion context)
2. **Bulkowski P80 cap**: raw * 2.0 (top 20% measured moves)
3. **EVT ATR cap**: ATR * dynamicATRCap (default 6, reduced to 4-5 based on Hill alpha)

**dynamicATRCap** (line 726):
- Hill alpha < 3 (heavy tail): cap = 4 ATR
- Hill alpha < 4 (moderate): cap = 5 ATR
- Hill alpha >= 4 (near-normal): cap = 6 ATR (default)

### R:R Gate (_applyRRGate, line 3594)

```
rr = |priceTarget - entry| / |entry - stopLoss|
if rr < 0.5: confidence -= 5
if rr < 1.0: confidence -= 3
if rr >= 1.0: no adjustment
```

Plus Bayesian sigmoid (line 934):
```
rrPen = round(15 / (1 + exp(8 * (rr - 2.375))))
confidencePred -= rrPen  // continuous, no jump discontinuity
```

---

## 3.2.5 Timeframe Pattern Map

Source: `TF_PATTERN_MAP` (line 158-171) + `_WEEKLY_CANDLE_TYPES` (line 174)

| Timeframe | Candle Patterns | Chart Patterns | S/R |
|-----------|----------------|----------------|-----|
| 1m | null (disabled) | null | no |
| 5m | LIMITED: hammer, shootingStar, bullishEngulfing, bearishEngulfing, bullishMarubozu, bearishMarubozu, piercingLine, darkCloud | null | no |
| 15m | all | LIMITED: ascT, descT, symT, risingW, fallingW, channel | yes |
| 30m | all | LIMITED: above + doubleBottom, doubleTop | yes |
| 1h | all | all_except_hs (H&S/invH&S excluded) | yes |
| 1d | all | all | yes |
| 1w | LIMITED: engulfing, marubozu, piercing, darkCloud, hammer, shootingStar | all | yes |
| 1M | null (disabled) | LIMITED: doubleBottom, doubleTop, channel | yes |

**Rationale** (line 154): CFA + Chart Expert consensus. Intraday (1m/5m) has insufficient noise-to-signal for complex patterns. Weekly/monthly limits to patterns with sufficient bars-per-formation.

---

## 3.2.6 Contextual Weight System (CZW)

### Weight Construction in analyze() (lines 644-721)

| Weight | Symbol | Formula | Range | Academic Source |
|--------|--------|---------|-------|----------------|
| Hurst | hw | `clamp(2 * H_shrunk, 0.6, 1.4)` where H_shrunk = James-Stein shrunk Hurst | [0.6, 1.4] | Mandelbrot & Van Ness (1968); [D] heuristic mapping |
| Volatility | vw | `clamp(1/sqrt(ATR14/ATR50), 0.7, 1.4)` | [0.7, 1.4] | [D] Economic physics power law; E-grade deprecated from wc (IC=-0.083) |
| Mean-Reversion | mw | `clamp(exp(-0.1386 * max(0, moveATR - 3)), 0.6, 1.0)` | [0.6, 1.0] | OU process half-life; core_data/12 |
| Regime | rw | VKOSPI tier -> HMM fallback -> Mahalanobis fallback | [0.65, 1.0] | Hamilton (1989), Whaley (2009), Amari (1985) |
| Composite | wc | `hw * mw * rw` (vw excluded) | [0.23, 1.96] | — |

**vw deprecation** (line 888): IC = -0.083, E-grade. Preserved as metadata only; excluded from wc product. Future: detection threshold role considered.

### Regime Weight 3-Tier Fallback (lines 680-721)

1. **Tier 1 -- VKOSPI/VIX**: crisis(>35) -> 0.65, high(25-35) -> 0.80, normal/low -> 1.0
2. **Tier 2 -- HMM**: bull_prob > 0.5 -> `0.7 + 0.3 * (1 - bull_prob)`
3. **Tier 3 -- Mahalanobis**: 60-bar vs 20-bar return distribution -> Fisher anomaly -> sigmoid `0.7 + 0.3 / (1 + exp(dMaha - 2))`

---

## 3.2.7 Pattern Win Rate System (PATTERN_WIN_RATES)

### Beta-Binomial Shrinkage (line 296)

```
shrunk_WR = (n * raw_WR + N0 * grand_mean) / (n + N0)
  N0 = 35  (Empirical Bayes optimal, was 50, N0_hat = 34.5)
  grand_mean_candle ~ 43% (sample-weighted)
  grand_mean_chart ~ 45% (separate estimation)
```

**Design rationale**: Prevents spinningTop (n=559K) from dominating H&S (n=1,156) in grand mean. Candle and chart patterns have independent grand means.

### KRX Structural Observation

**Sell (bearish) patterns consistently outperform buy (bullish) patterns**:
- Average sell WR: 58.6% (16 S/A-tier patterns)
- Average buy WR: 44.2% (B-tier patterns)
- Gap: ~14.4pp

This KRX-specific asymmetry is documented in `project_fallingwedge_krx_anomaly.md` and attributed to:
1. KRX market microstructure (T+2 settlement, price limits)
2. Foreign investor dominance in KOSPI (momentum-based selling)
3. Structural short-selling constraints creating asymmetric reversals

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Indicator functions | 32 (29 calc* + 3 utility) |
| Pattern detect functions | 41 |
| Named pattern types | 45 (34 candle + 11 chart) |
| Static constants | 80+ in PatternEngine |
| Grade [A] constants | 16 |
| Grade [B] constants | 33 |
| Grade [C] constants | 14 |
| Grade [D] constants | 17 |
| S-Tier patterns | 13 (11 candle + 2 chart) |
| A-Tier patterns | 4 (2 candle + 2 chart) |
| B-Tier patterns | 22 (15 candle + 7 chart) |
| D-SUPPRESS | 5 |
| D-CONTEXT_ONLY | 3 |
| Win rate range (sell) | 54.3% - 74.7% |
| Win rate range (buy) | 39.1% - 48.9% |
| Total backtest instances | 545,307 (5-year, 2,768 stocks) |

---

## Cross-Reference Index

| Section | Referenced Files |
|---------|-----------------|
| 3.1 Indicators | js/indicators.js (all), js/analysisWorker.js (importScripts) |
| 3.2 Patterns | js/patterns.js (detection), js/appState.js (tier classification) |
| 3.2.2 Quality | patterns.js _quality()/_adaptiveQuality(), backtester.js (WLS coefficients) |
| 3.2.3 Tiers | appState.js _TIER_S_CANDLE through _CONTEXT_ONLY_PATTERNS |
| 3.2.4 Targets | patterns.js _candleTarget()/_stopLoss(), core_data/12 (EVT) |
| 3.2.5 Timeframe | patterns.js TF_PATTERN_MAP, appState.js DEFAULT_IND_PARAMS |
| Academic theory | core_data/06 (TA), core_data/07 (algorithms), core_data/12 (EVT), core_data/22 (constants) |
| Calibration | calibrated_constants.json (offline Theil-Sen, not loaded at runtime) |
| Implementation bridge | pattern_impl/01_candle_patterns.md, pattern_impl/02_chart_patterns.md |

---

*End of S3_ta_methods_v6.md*
