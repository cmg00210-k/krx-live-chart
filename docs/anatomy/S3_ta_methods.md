# Stage 3: Technical Analysis Methods -- Indicators, Pattern Detection, Quality Scoring

> ANATOMY V5 -- Complete documentation of 28 indicator functions, 42 pattern detection methods, and quality scoring system
> File: `js/indicators.js` (2,217 lines), `js/patterns.js` (4,200 lines), `js/patternRenderer.js` (2,145 lines)
> Audit date: 2026-04-06

---

## Stage 참조 의존성 (Cross-Stage References)

```
Stage 1 (API) --> Stage 2 (Theory) --> * Stage 3 (here) * --> Stage 4 (Rendering) --> Stage 5 (UI)
```

**S1 --> S3 (Data inputs)**:
- `data/{market}/{code}.json` OHLCV --> all `calc*()` functions in indicators.js
- `data/backtest/capm_beta.json` --> `calcCAPMBeta()` cross-validation
- `data/macro/macro_latest.json` --> VRP proxy, VKOSPI regime classification

**S2 --> S3 (Theory --> Implementation)**:
- S2 M-6 (Hurst R/S) --> `calcHurst()` at indicators.js:212
- S2 M-7 (Shrinkage) --> Hurst prior correction at patterns.js:648-656
- S2 S-4 (EWMA/GARCH) --> `calcEWMAVol()` at indicators.js:1336
- S2 S-5 (WLS) --> `calcWLSRegression()` at indicators.js:558
- S2 S-6 (Ridge) --> lambda=0.05 regularization at indicators.js:581
- S2 S-7 (HC3) --> heteroskedasticity correction at indicators.js:636
- S2 S-10 (GPD) --> `calcGPDFit()` at indicators.js:323
- S2 S-17 (Kalman) --> `calcKalman()` at indicators.js:170
- S2 D-1~D-13 (Derivations) --> formula appendix cross-reference

**S3 --> S4 (Detection --> Rendering)**:
- `detect*()` results --> patternRenderer 9-layer input
- Quality score --> `MAX_PATTERNS=3` confidence-sorted selection
- `stopLoss/priceTarget` per pattern --> forecastZone (Layer 8)
- Pattern `type` --> Builder function dispatch (Section 3.3)

---

## Section 3.1: Indicator Computation (28 Functions)

### Global Constant

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `KRX_TRADING_DAYS` | 250 | indicators.js:10 | Annualization factor for all volatility/return metrics |

---

### [I-01] Simple Moving Average -- SMA

**Function**: `calcMA(data, n)` at indicators.js:15
**Formula**: $SMA_t = \frac{1}{n}\sum_{i=0}^{n-1} P_{t-i}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| P | Price (close) | KRW | > 0 | S1 OHLCV |
| n | Period | bars | {5, 20, 50, 200} | User/system |

**Constants**: None (parameterized).
**Stage ref**: S1(closes) --> S3(calcMA) --> S4(line series via chart.js)
**Edge Cases**: `data` null/empty or `n <= 0` --> returns `[]`. First `n-1` entries are `null`.

---

### [I-02] Exponential Moving Average -- EMA

**Function**: `calcEMA(data, n)` at indicators.js:26
**Formula**: $EMA_t = \alpha \cdot P_t + (1-\alpha) \cdot EMA_{t-1}$, where $\alpha = \frac{2}{n+1}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| alpha | Smoothing factor | dimensionless | (0,1) | Derived from n |
| n | Period | bars | {12, 26} typical | User/system |

**Constants**: None.
**Initialization**: First `n` values averaged as SMA seed (accuracy improvement over single-value init).
**Stage ref**: S1(closes) --> S3(calcEMA) --> S3(calcMACD uses EMA 12/26)
**Edge Cases**: Empty/null data --> `[]`. `data.length < n` --> all null. SMA init skips null/NaN entries; returns all null if fewer than `n` valid entries in seed window.

---

### [I-03] Bollinger Bands -- BB

**Function**: `calcBB(closes, n, mult)` at indicators.js:50
**Formula**: $Upper = SMA_n + mult \cdot \sigma_n$, $Lower = SMA_n - mult \cdot \sigma_n$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| n | Period | bars | 20 (default) | Bollinger (2001) |
| mult | Width multiplier | dimensionless | 2.0 (default) | Bollinger (2001) |
| sigma | Population std dev | KRW | >= 0 | Computed |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| n | 20 | [A] | 10-30 | Bollinger (2001) standard |
| mult | 2 | [A] | 1.5-3.0 | Bollinger (2001) standard |

**Note**: Uses population standard deviation (division by `n`, not `n-1`) per Bollinger (2001) original specification.
**Stage ref**: S1(closes) --> S3(calcBB) --> S4(BB band series via chart.js)
**Edge Cases**: Empty --> `[]`. First `n-1` entries return `{upper: null, lower: null, mid: null}`.

**EVT-aware variant**: `IndicatorCache.bbEVT()` at indicators.js:1757. When Hill alpha < 4 (heavy-tailed distribution), multiplier is widened: `mult_adj = mult * (1 + 0.45 * max(0, 4 - alpha))`. Ref: Gopikrishnan (1999), core_data/12 S7.1.

---

### [I-04] Relative Strength Index -- RSI (Wilder Smoothing)

**Function**: `calcRSI(closes, period)` at indicators.js:63
**Formula**: $RSI = 100 - \frac{100}{1 + RS}$, where $RS = \frac{AvgGain}{AvgLoss}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| period | Lookback | bars | 14 (default) | Wilder (1978) |
| RS | Relative strength | dimensionless | >= 0 | Computed |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| period | 14 | [A] | 7-21 | Wilder (1978) "New Concepts in Technical Trading Systems" |

**Smoothing**: Wilder exponential smoothing: `avgGain_t = (avgGain_{t-1} * (period-1) + gain_t) / period`. This is equivalent to EMA with alpha = 1/period.
**Stage ref**: S1(closes) --> S3(calcRSI) --> S3(signalEngine RSI divergence) --> S4(sub-chart)
**Edge Cases**: `closes.length < period + 1` --> all null. Division by zero when `avgLoss = 0` --> RSI = 100.

---

### [I-05] MACD (Moving Average Convergence Divergence)

**Function**: `calcMACD(closes, fast, slow, sig)` at indicators.js:993
**Formula**: $MACD = EMA_{12} - EMA_{26}$, $Signal = EMA_9(MACD)$, $Histogram = MACD - Signal$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| fast | Fast EMA period | bars | 12 | Appel (1979) |
| slow | Slow EMA period | bars | 26 | Appel (1979) |
| sig | Signal period | bars | 9 | Appel (1979) |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| fast | 12 | [A] | 8-15 | Appel (1979) |
| slow | 26 | [A] | 20-30 | Appel (1979) |
| sig | 9 | [A] | 5-12 | Appel (1979) |

**Stage ref**: S1(closes) --> S3(calcEMA x2 + calcEMA on MACD) --> S4(sub-chart histogram)
**Edge Cases**: Empty closes --> null arrays. P0-4 fix: validMacd filter matches null AND NaN to prevent index misalignment in signal line.

---

### [I-06] Average True Range -- ATR

**Function**: `calcATR(candles, period)` at indicators.js:87
**Formula**: $TR_t = \max(H_t - L_t, |H_t - C_{t-1}|, |L_t - C_{t-1}|)$, $ATR_t = \frac{ATR_{t-1} \cdot (period-1) + TR_t}{period}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| period | Smoothing period | bars | 14 (default) | Wilder (1978) |
| TR | True Range | KRW | >= 0 | Computed |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| period | 14 | [A] | 7-21 | Wilder (1978) |

**Critical role**: ATR(14) is the universal normalization denominator for all pattern detection thresholds in PatternEngine. Without ATR, the system falls back to `close * ATR_FALLBACK_PCT` (2% for daily, timeframe-adaptive).
**Stage ref**: S1(OHLCV) --> S3(calcATR) --> S3(all detect*() thresholds, stopLoss, priceTarget)
**Edge Cases**: `candles.length < 2` --> all null. First TR uses `high - low` only (no previous close). First `period-1` entries null (SMA initialization).

---

### [I-07] Ichimoku Cloud (Ichimoku Kinko Hyo)

**Function**: `calcIchimoku(candles, conv, base, spanBPeriod, displacement)` at indicators.js:135
**Formula**:
- Tenkan-sen = (highest high + lowest low) / 2 over `conv` periods
- Kijun-sen = (highest high + lowest low) / 2 over `base` periods
- Senkou Span A = (Tenkan + Kijun) / 2, displaced `displacement` bars forward
- Senkou Span B = (highest high + lowest low) / 2 over `spanBPeriod`, displaced forward
- Chikou Span = Close, displaced `displacement` bars backward

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| conv | Conversion period | bars | 9 | Hosoda (1968) |
| base | Base period | bars | 26 | Hosoda (1968) |
| spanBPeriod | Span B period | bars | 52 | Hosoda (1968) |
| displacement | Cloud offset | bars | 26 | Hosoda (1968) |

**Constants**: All [A] -- Hosoda's original parameters, universally standard.
**Stage ref**: S1(OHLCV) --> S3(calcIchimoku) --> S3(signalEngine TK cross, cloud breakout) --> S4(cloud overlay)
**Edge Cases**: Arrays initialized to null; each component fills as sufficient data accumulates. Senkou spans only populate indices within array bounds.

---

### [I-08] On-Balance Volume -- OBV

**Function**: `calcOBV(candles)` at indicators.js:115
**Formula**: $OBV_t = OBV_{t-1} + \begin{cases} Vol_t & \text{if } C_t > C_{t-1} \\ -Vol_t & \text{if } C_t < C_{t-1} \\ 0 & \text{if } C_t = C_{t-1} \end{cases}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| Vol | Volume | shares | >= 0 | S1 OHLCV |

**Academic**: Granville (1963) "New Key to Stock Market Profits"; Murphy (1999) Ch.7.
Market psychology: volume precedes price (Granville's core hypothesis).
**Stage ref**: S1(OHLCV) --> S3(calcOBV) --> S3(signalEngine divergence) --> S4(sub-chart)
**Edge Cases**: Empty --> `[]`. OBV[0] = 0. Missing volume treated as 0.

---

### [I-09] Kalman Filter -- Adaptive Price Smoothing

**Function**: `calcKalman(closes, Q, R)` at indicators.js:170
**Formula**: Predict: $\hat{x}_t = x_{t-1}$, $P_t = P_{t-1} + Q_{adaptive}$. Update: $K = P_t/(P_t + R)$, $x_t = \hat{x}_t + K(z_t - \hat{x}_t)$, $P_t = (1-K)P_t$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| Q | Process noise | dimensionless | 0.01 (default) | [D] heuristic |
| R | Measurement noise | dimensionless | 1.0 (default) | [D] heuristic |
| K | Kalman gain | dimensionless | [0,1] | Computed |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| Q | 0.01 | [D] | 0.001-0.1 | Heuristic -- see S2 D-13 |
| R | 1.0 | [D] | 0.1-10.0 | Heuristic -- see S2 D-13 |
| ewmaAlpha | 0.06 | [B] | ~2/(30+1) | Mohamed & Schwarz (1999) |

**Adaptive Q**: $Q_t = Q_{base} \cdot (\sigma_t / \bar{\sigma})^2$ via EWMA variance. Low volatility --> smoother; high volatility --> responsive.
**Stage ref**: S2(S-17 Kalman) --> S3(calcKalman) --> S4(smooth price line overlay)
**Edge Cases**: Empty --> `[]`. `closes[i-1] <= 0` --> skip iteration (negative price guard).

---

### [I-10] Hurst Exponent -- R/S Analysis

**Function**: `calcHurst(closes, minWindow)` at indicators.js:212
**Formula**: $\log(R/S) = H \cdot \log(n) + c$ -- slope H estimated via OLS on log-log R/S blocks.

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| H | Hurst exponent | dimensionless | [0, 1] | Mandelbrot (1963) |
| minWindow | Minimum block size | bars | 10 (default) | [C] tunable |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| minWindow | 10 | [C] | 5-20 | Calibratable |

**Algorithm**: Input is log-returns (not raw prices -- Peters 1994 requirement for stationarity). Block sizes grow geometrically (1.5x). Population std dev per Mandelbrot & Wallis (1969). S=0 blocks excluded (M-9 fix). Returns `{ H, rSquared }`.

**Interpretation**: H > 0.5 = trend persistence, H < 0.5 = mean reversion, H ~= 0.5 = random walk.
**Stage ref**: S2(M-6 R/S, M-7 Shrinkage) --> S3(calcHurst) --> S3(patterns.js:648 hurstWeight)
**Edge Cases**: `closes.length < minWindow*4+1` --> null. Negative/zero prices --> null. logRS < 4 points --> null. Degenerate denominator (all logN identical) --> null.

---

### [I-11] Hill Tail Index Estimator

**Function**: `calcHillEstimator(returns, k)` at indicators.js:276
**Formula**: $\hat{\alpha} = \frac{k}{\sum_{i=1}^{k}[\ln X_{(i)} - \ln X_{(k+1)}]}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| alpha | Tail index | dimensionless | > 0 | Hill (1975) |
| k | Order statistics count | integer | auto: floor(sqrt(n)) | Drees & Kaufmann (1998) |
| se | Standard error | dimensionless | alpha/sqrt(k) | Hill (1975) |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| k auto-select | floor(sqrt(n)) | [B] | -- | Drees & Kaufmann (1998) |
| isHeavyTail threshold | 4 | [A] | -- | Standard EVT |

**Note**: SE assumes IID; dependent data should decluster extremes (Drees & Kaufmann 1998).
**Stage ref**: S2(M-9 Power Law) --> S3(calcHillEstimator) --> S3(dynamicATRCap in patterns.js:726)
**Edge Cases**: `returns.length < 10` --> null. k auto-selected, clamped to [2, n-1]. absRet[k] <= 0 or !isFinite --> null.

---

### [I-12] GPD Fit -- Generalized Pareto Distribution

**Function**: `calcGPDFit(returns, quantile)` at indicators.js:323
**Formula**: PWM estimator: $\hat{\xi} = 2 - \frac{b_0}{b_0 - 2b_1}$, $\hat{\sigma} = \frac{2b_0 b_1}{b_0 - 2b_1}$. VaR: $VaR_p = u + \frac{\sigma}{\xi}[((n/N_u)(1-p))^{-\xi} - 1]$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| xi | Shape parameter | dimensionless | (-0.5, 0.5) | Hosking & Wallis (1987) |
| sigma | Scale parameter | dimensionless | > 0 | Hosking & Wallis (1987) |
| u | Threshold | fraction | top 5% | core_data/12 S3.4 |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| quantile | 0.99 | [A] | 0.95-0.995 | Standard VaR |
| threshold percentile | 5% | [B] | 3-10% | core_data/12 S3.4 |
| min exceedances | 30 | [B] | 20-50 | Hosking & Wallis (1987) |
| min observations | 500 | [B] | 500+ | ~2 years daily |

**Note**: PWM estimator valid only for xi < 0.5 (clamped). For xi >= 0.5, MLE is recommended.
**Stage ref**: S2(S-10 GPD) --> S3(calcGPDFit) --> S3(_stopLoss EVT enhancement at patterns.js:600)
**Edge Cases**: `returns.length < 500` --> null. Insufficient exceedances --> null. Non-finite VaR --> null.

---

### [I-13] CAPM Beta -- Scholes-Williams Corrected

**Function**: `calcCAPMBeta(stockCloses, marketCloses, window, rfAnnual)` at indicators.js:391
**Formula**: $\beta_{OLS} = \frac{Cov(R_i, R_m)}{Var(R_m)}$, $\beta_{SW} = \frac{\beta_{-1} + \beta_0 + \beta_{+1}}{1 + 2\rho_m}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| beta | Market sensitivity | dimensionless | typically [0,3] | Sharpe (1964) |
| alpha | Jensen's alpha | annualized fraction | [-1, 1] | Jensen (1968) |
| rfAnnual | Risk-free rate | % | from bonds_latest.json | KTB 10Y |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| window | 250 (KRX_TRADING_DAYS) | [C] | 60-500 | Standard practice |
| MIN_OBS | 60 | [B] | 30-120 | Aligned with compute_capm_beta.py |
| thinTrading threshold | 10% zero-volume days | [B] | 5-20% | Scholes & Williams (1977) |

**SW correction**: Activated only when thin trading detected (>10% zero-volume days). Uses lead/lag beta and market autocorrelation.
**Stage ref**: S2(CAPM) --> S3(calcCAPMBeta) --> S1(data/backtest/capm_beta.json cross-validation) --> S5(D-column display)
**Edge Cases**: null inputs or length < 60 --> null. varM near zero --> null. Thin trading flag output.

---

### [I-14] Historical Volatility -- Parkinson Estimator

**Function**: `calcHV(candles, period)` at indicators.js:492
**Formula**: $HV_{Parkinson} = \sqrt{\frac{1}{4n \ln 2}\sum_{i=1}^{n}[\ln(H_i/L_i)]^2} \times \sqrt{250}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| HV | Annualized volatility | fraction (0.30 = 30%) | > 0 | Parkinson (1980) |
| period | Window | bars | 20 (default) | [B] |

**Academic**: Parkinson (1980) -- ~5x more efficient than close-to-close estimator. core_data/34 S3.1.
**Stage ref**: S1(OHLCV) --> S3(calcHV) --> S3(calcVRP)
**Edge Cases**: `candles.length < period` --> null. Zero/negative high or low --> skip. Valid count < max(n/2, 5) --> null.

---

### [I-15] Volatility Risk Premium -- VRP

**Function**: `calcVRP(vkospi, hvAnnualized)` at indicators.js:536
**Formula**: $VRP = (IV/100)^2 - HV^2$ (variance space difference)

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| vkospi | VKOSPI index | % | 10-80 | S1 macro data |
| HV | Realized vol | fraction | 0-1 | calcHV() |

**Academic**: core_data/34 S3.1. Positive VRP = IV overpriced (sell options favored); negative = underpriced.
**Stage ref**: S1(macro/VKOSPI) --> S3(calcVRP) --> S3(signalEngine VRP signal)
**Edge Cases**: Either input null or negative --> null. VKOSPI is %-based (20.5), HV is fraction (0.205).

---

### [I-16] WLS Regression -- Weighted Least Squares with Ridge + HC3

**Function**: `calcWLSRegression(X, y, weights, ridgeLambda)` at indicators.js:558
**Formula**: $\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| X | Design matrix | n x p | -- | Input |
| y | Response vector | n x 1 | -- | Input |
| weights | Observation weights | n x 1, null=OLS | >= 0 | Reschenhofer et al. (2021) |
| ridgeLambda | Regularization | dimensionless | 0.05 typical | Hoerl & Kennard (1970) |

**Features**:
- Ridge regularization: intercept (col 0) excluded from penalty.
- HC3 robust standard errors: MacKinnon & White (1985) sandwich estimator with leverage adjustment.
- VIF diagnostics: Marquardt (1970), Belsley, Kuh & Welsch (1980). VIF > 5 = moderate, > 10 = severe multicollinearity.
- Adjusted R-squared: Theil (1961) penalized R-squared.

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| ridgeLambda | varies (GCV-selected) | [C] | 0.01-10.0 | Golub, Heath & Wahba (1979) |

**Stage ref**: S2(S-5 WLS, S-6 Ridge, S-7 HC3) --> S3(calcWLSRegression) --> S3(backtester.js prediction model)
**Edge Cases**: `n < p + 2` --> null. Singular matrix (_invertMatrix returns null) --> null.

---

### [I-17] OLS Trend -- Linear Trend via WLS Wrapper

**Function**: `calcOLSTrend(closes, window, atr14Last)` at indicators.js:912
**Formula**: Simple linear regression on recent `window` closes. Slope normalized by ATR(14).

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| slope | Price change per bar | KRW/bar | -- | Computed |
| slopeNorm | ATR-normalized slope | dimensionless | -- | Lo & MacKinlay (1999) |
| r2 | R-squared | dimensionless | [0,1] | -- |
| direction | Trend direction | 'up'/'down'/'flat' | -- | |slopeNorm| < 0.05 = flat |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| window | 20 | [B] | 10-50 | Standard practice |
| flat threshold | 0.05 | [D] | 0.01-0.10 | Heuristic |

**Stage ref**: S1(closes) --> S3(calcOLSTrend, wraps calcWLSRegression with uniform weights) --> S4(trend line overlay)
**Edge Cases**: `closes.length < window` --> null. ATR fallback uses `close * 0.02`.

---

### [I-18] Stochastic Oscillator -- %K / %D

**Function**: `calcStochastic(candles, kPeriod, dPeriod, smooth)` at indicators.js:1028
**Formula**: $rawK = \frac{C - LL_k}{HH_k - LL_k} \times 100$, $\%K = SMA(rawK, smooth)$, $\%D = SMA(\%K, dPeriod)$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| kPeriod | %K lookback | bars | 14 | Lane (1984) |
| dPeriod | %D smoothing | bars | 3 | Lane (1984) |
| smooth | %K smoothing | bars | 3 (Slow), 1 (Fast) | Lane (1984) |

**Constants**: All [A] -- Lane (1984) standard parameters.
**Stage ref**: S1(OHLCV) --> S3(calcStochastic) --> S3(signalEngine Stoch cross) --> S4(sub-chart)
**Edge Cases**: `candles.length < kPeriod` --> all null. Range = 0 --> rawK = 50.

---

### [I-19] Stochastic RSI

**Function**: `calcStochRSI(closes, rsiPeriod, kPeriod, dPeriod, stochPeriod)` at indicators.js:1085
**Formula**: $StochRSI = \frac{RSI - \min(RSI, stochPeriod)}{\max(RSI, stochPeriod) - \min(RSI, stochPeriod)}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| rsiPeriod | RSI period | bars | 14 | Chande & Kroll (1994) |
| stochPeriod | Stochastic lookback | bars | 14 | Chande & Kroll (1994) |

**Stage ref**: S1(closes) --> S3(calcRSI) --> S3(calcStochRSI) --> S3(signalEngine)
**Edge Cases**: RSI range = 0 --> StochRSI = 50.

---

### [I-20] CCI -- Commodity Channel Index

**Function**: `calcCCI(candles, period)` at indicators.js:1158
**Formula**: $CCI = \frac{TP - SMA(TP, n)}{0.015 \times MD}$, where $TP = (H + L + C)/3$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| period | Lookback | bars | 20 (default) | Lambert (1980) |
| 0.015 | Normalization constant | dimensionless | fixed | Lambert (1980) |

**Constants**: 0.015 is Lambert's original constant ensuring ~75% of CCI values fall within [-100, +100].
**Stage ref**: S1(OHLCV) --> S3(calcCCI) --> S3(signalEngine CCI signal)
**Edge Cases**: MD = 0 --> CCI = 0.

---

### [I-21] ADX -- Average Directional Index

**Function**: `calcADX(candles, period)` at indicators.js:1187
**Formula**: $+DI = \frac{Smoothed +DM}{Smoothed TR} \times 100$, $DX = \frac{|+DI - (-DI)|}{+DI + (-DI)} \times 100$, $ADX = Wilder\_smooth(DX, period)$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| period | Smoothing period | bars | 14 | Wilder (1978) |
| +DI/-DI | Directional indicators | % | [0,100] | Wilder (1978) |
| ADX | Average directional index | % | [0,100] | Wilder (1978) |

**Stage ref**: S1(OHLCV) --> S3(calcADX) --> S3(signalEngine ADX trend strength)
**Edge Cases**: `candles.length < period + 1` --> all null. ADX starts at `2 * period`.

---

### [I-22] Williams %R

**Function**: `calcWilliamsR(candles, period)` at indicators.js:1262
**Formula**: $\%R = \frac{HH - C}{HH - LL} \times (-100)$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| period | Lookback | bars | 14 | Williams (1979) |
| %R | Oscillator value | % | [-100, 0] | Williams (1979) |

**Stage ref**: S1(OHLCV) --> S3(calcWilliamsR) --> S3(signalEngine)
**Edge Cases**: Range = 0 --> %R = -50.

---

### [I-23] Theil-Sen Robust Trendline

**Function**: `calcTheilSen(xValues, yValues)` at indicators.js:1287
**Formula**: $b = \text{median}\{(y_j - y_i)/(x_j - x_i) \text{ for all } i < j\}$, $a = \text{median}\{y_i - b \cdot x_i\}$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| slope | Robust slope | varies | -- | Theil (1950), Sen (1968) |
| intercept | Robust intercept | varies | -- | Theil (1950), Sen (1968) |

**Academic**: Breakdown point ~29.3% -- robust to ~29% outliers. core_data/07 S2.3.
**Stage ref**: S2(Theil-Sen) --> S3(calcTheilSen) --> S3(triangle/wedge slope estimation in detect*)
**Edge Cases**: n < 2 --> null. All x identical --> null. n = 2 --> direct calculation.

---

### [I-24] EWMA Conditional Volatility

**Function**: `calcEWMAVol(closes, lambda)` at indicators.js:1336
**Formula**: $\sigma^2_t = \lambda \sigma^2_{t-1} + (1-\lambda) r^2_{t-1}$, $r_t = \ln(P_t/P_{t-1})$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| lambda | Decay factor | dimensionless | 0.94 (default) | [B] RiskMetrics (1996) |
| sigma | Conditional std dev | fraction | > 0 | Computed |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| lambda | 0.94 | [B] | 0.90-0.97 | J.P. Morgan RiskMetrics (1996), Bollerslev (1986) IGARCH |

**Related**: `classifyVolRegime()` at indicators.js:1385 -- classifies into 'low' (<0.75x long-run EMA), 'mid' (0.75-1.50x), 'high' (>1.50x).
**Stage ref**: S2(S-4 GARCH/EWMA) --> S3(calcEWMAVol) --> S3(regime classification, CUSUM threshold adaptation)
**Edge Cases**: `closes.length < 2` --> all null. Negative/zero prices --> early return. Flat price --> `initVar = 1e-8`.

---

### [I-25] Amihud ILLIQ -- Illiquidity Measure

**Function**: `calcAmihudILLIQ(candles, window)` at indicators.js:1430
**Formula**: $ILLIQ = \frac{1}{D}\sum_{t=1}^{D}\frac{|r_t|}{DVOL_t}$, $logILLIQ = \log_{10}(ILLIQ \times 10^8)$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| ILLIQ | Raw illiquidity | 1/(KRW volume) | > 0 | Amihud (2002) |
| logIlliq | Log-scaled | dimensionless | ~[-5, 2] | Amihud (2002) |
| confDiscount | Confidence multiplier | dimensionless | [0.85, 1.0] | [C] #163 |

**Constants**:

| Constant | Value | Grade | ID | Academic Source |
|----------|-------|-------|----|----------------|
| WINDOW | 20 | [B] | #162 | Amihud (2002) standard |
| CONF_DISCOUNT | 0.85 | [C] | #163 | Max discount for illiquid stocks |
| LOG_HIGH | -1.0 | [C] | #164 | KRW DVOL scale threshold |
| LOG_LOW | -3.0 | [C] | #165 | Below this = liquid |

**Stage ref**: S2(Kyle 1985) --> S3(calcAmihudILLIQ) --> S3(confidence discount in backtester)
**Edge Cases**: Insufficient data --> `{illiq: null, confDiscount: 1.0}`. Valid days < 10 --> null.

---

### [I-26] Online CUSUM -- Change Point Detection

**Function**: `calcOnlineCUSUM(returns, threshold, volRegime)` at indicators.js:1493
**Formula**: $S^+_t = \max(0, S^+_{t-1} + z_t - k)$, $S^-_t = \max(0, S^-_{t-1} - z_t - k)$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| threshold | Detection limit | sigma units | 2.5 (default) | Page (1954) |
| slack (k) | ARL optimization | dimensionless | 0.5 | [B] Roberts (1966) |
| warmup | Init period | bars | 30 | [B] |
| alpha | EMA alpha for running stats | dimensionless | 2/31 | [B] ~30-bar half-life |

**Volatility-adaptive threshold** (Phase TA-3 C-1, Doc34 S2.3): `high` regime --> 3.5 (reduce false alarms), `low` --> 1.5 (increase sensitivity).
**Stage ref**: S2(Page 1954) --> S3(calcOnlineCUSUM) --> S3(_applyBreakpointAdjust in patterns.js:1056)
**Edge Cases**: `returns.length < 40` --> empty breakpoints.

---

### [I-27] Binary Segmentation -- Structural Breakpoints

**Function**: `calcBinarySegmentation(returns, maxBreaks, minSegment)` at indicators.js:1586
**Formula**: Greedy BIC minimization: $\Delta BIC = BIC_{parent} - (BIC_{left} + BIC_{right})$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| maxBreaks | Max breakpoints | integer | 3 (default) | Bai-Perron (1998) |
| minSegment | Min segment length | bars | 30 (default) | [B] |

**Complexity**: O(n * maxBreaks * maxSegmentSize). 252-bar, maxBreaks=3 --> ~576 iterations (real-time feasible).
**Stage ref**: S2(Bai-Perron 1998) --> S3(calcBinarySegmentation) --> S3(IndicatorCache.binarySegmentation)
**Edge Cases**: `returns.length < 2 * minSegment` --> empty. BIC improvement <= 0 --> early stop.

---

### [I-28] HAR-RV -- Heterogeneous Autoregressive Realized Volatility

**Function**: `calcHAR_RV(candles)` at indicators.js:2213 (wrapper), `IndicatorCache.harRV(idx)` at indicators.js:2063
**Formula**: $RV_{t+1} = \beta_0 + \beta_1 RV^{(d)}_t + \beta_2 RV^{(w)}_t + \beta_3 RV^{(m)}_t + \epsilon_t$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| RV_d | Daily RV proxy | fraction^2 | r_t^2 | Corsi (2009) |
| RV_w | Weekly avg RV | fraction^2 | mean(r2, 5d) | Corsi (2009) |
| RV_m | Monthly avg RV | fraction^2 | mean(r2, 22d) | Corsi (2009) |
| harRV | Annualized HAR-RV | % | sqrt(RV*250)*100 | Corsi (2009) |

**Constants**:

| Constant | Value | Grade | Range | Academic Source |
|----------|-------|-------|-------|----------------|
| D/W/M | 1/5/22 | [A] | standard | Corsi (2009) |
| MIN_FIT | 60 | [B] | 30-120 | OLS stability |
| MIN_BARS | 82 | [B] | M + MIN_FIT | Minimum data |

**Implementation**: Rolling 60-bar trailing OLS at each time step. 4x4 inverse via `_invertMatrix()`.
**Stage ref**: S2(Corsi 2009) --> S3(IndicatorCache.harRV) --> S3(signalEngine vol forecast)
**Edge Cases**: `candles.length < 83` --> all null. Singular 4x4 matrix --> skip. Negative RV prediction clamped to 0.

---

### Supporting Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `_invertMatrix(m)` | indicators.js:950 | Gauss-Jordan with partial pivoting, any size |
| `_jacobiEigen(A, p)` | indicators.js:758 | Jacobi eigenvalue for symmetric matrices (GCV) |
| `selectRidgeLambdaGCV(X, y, weights, p)` | indicators.js:826 | GCV-optimal Ridge lambda, Golub et al. (1979) |
| `classifyVolRegime(ewmaVol)` | indicators.js:1385 | 'low'/'mid'/'high' from EWMA vol ratio to long-run EMA |
| `IndicatorCache` class | indicators.js:1692 | Lazy-eval cache for all indicators, invalidates on candle change |

---

## Section 3.2: Pattern Detection (42 Methods)

### Architecture Overview

All detection methods are instance methods of `PatternEngine` class (patterns.js:13). The main entry point is `analyze(candles, opts)` at patterns.js:635, which:

1. Computes global context: `hurstWeight`, `volWeight`, `meanRevWeight`, `regimeWeight`, `dynamicATRCap`
2. Dispatches candle pattern detectors (gated by `TF_PATTERN_MAP`)
3. Dispatches chart pattern detectors (gated by `TF_PATTERN_MAP`)
4. Computes S/R levels + valuation S/R
5. Applies confluence scoring, CZW weights, confidencePred, R:R gate, herding/breakpoint adjustments
6. Deduplicates and returns pattern array

### Context Weights (analyze() computed)

| Weight | Symbol | Formula | Clamp | Source |
|--------|--------|---------|-------|--------|
| Hurst | hw | `2 * H_shrunk` (James-Stein) | [0.6, 1.4] | [D] Mandelbrot & Van Ness (1968) |
| Volatility | vw | `1/sqrt(ATR14/ATR50)` | [0.7, 1.4] | [D] Economic physics power law |
| Mean-reversion | mw | `exp(-0.1386 * excess)` | [0.6, 1.0] | core_data/12 OU process |
| Regime | rw | VKOSPI/HMM/Mahalanobis 3-tier | [0.65, 1.0] | Hamilton (1989), VKOSPI |

**Composite weight**: `wc = hw * mw * rw` (vw excluded -- IC=-0.083, E-grade deprecated).

---

### Candle Patterns -- Single (13 types from 10 detectors)

#### [P-01] Doji (Direction: context-dependent)

**Detect Function**: `detectDoji()` at patterns.js:1512
**Category**: Single
**Algorithm**:
1. `body / range <= DOJI_BODY_RATIO` (0.05) -- near-zero body
2. `range >= ATR * MIN_RANGE_ATR` (0.3) -- significant range required
3. Trend context determines signal: uptrend --> sell, downtrend --> buy, else neutral

**Constants Used**:

| Constant | Value | Grade | Academic Source |
|----------|-------|-------|----------------|
| DOJI_BODY_RATIO | 0.05 | [A] | Nison (1991) |
| MIN_RANGE_ATR | 0.3 | [D] | Heuristic |

**Quality Score Components**: body(0.5 fixed), shadow(range/ATR), volume(volRatio/2), trend(strength), extra(0.5 fixed)
**Price Target**: `_candleTarget(weak)` -- ATR * 2.18
**Stop Loss**: `_stopLoss(2 ATR * 1.15)` -- Prospect Theory widened
**Win Rate**: 42.0% (n=42,031, 5-year KRX)
**Stage ref**: S1(OHLCV) --> S2(Nison 1991) --> S3(detectDoji) --> S4(Layer 1 glow, Layer 7 label)

#### [P-02] Hammer (Direction: buy)

**Detect Function**: `detectHammer()` at patterns.js:1322
**Category**: Single
**Algorithm**:
1. `body <= range * MAX_BODY_RANGE_HAMMER` (0.40) -- small body
2. `lowerShadow >= body * SHADOW_BODY_MIN` (2.0) -- long lower shadow
3. `upperShadow <= body * COUNTER_SHADOW_MAX_STRICT` (0.15) -- almost no upper shadow
4. `body >= range * MIN_BODY_RANGE` (0.1) -- visible body
5. Prior downtrend required (ATR-normalized Theil-Sen)

**Constants Used**:

| Constant | Value | Grade | Academic Source |
|----------|-------|-------|----------------|
| MAX_BODY_RANGE_HAMMER | 0.40 | [C] | Nison 0.33 + KRX tick margin |
| SHADOW_BODY_MIN | 2.0 | [A] | Morris (2006) |
| COUNTER_SHADOW_MAX_STRICT | 0.15 | [A] | Morris (2006) |
| MIN_BODY_RANGE | 0.1 | [B] | Nison (1991) |

**Quality Score Components**: body(body/ATR), shadow(lowerShadow/range), volume(volRatio/2), trend(strength), extra(volSurge/1.5)
**Price Target**: `_candleTarget(medium)` -- ATR * 2.31
**Stop Loss**: `_stopLoss(2 ATR * 1.15)`
**Win Rate**: 45.2% (n=4,293)
**Stage ref**: S1(OHLCV) --> S2(Nison 1991, Morris 2006) --> S3(detectHammer) --> S4(Layer 1 glow + Layer 7 label)

#### [P-03] Inverted Hammer (Direction: buy)

**Detect Function**: `detectInvertedHammer()` at patterns.js:1368
**Category**: Single
**Algorithm**: Same shape tests as hammer but mirrored -- long upper shadow, near-zero lower shadow. Requires prior downtrend.
**Win Rate**: 48.9% (n=6,710)
**Strength**: weak

#### [P-04] Hanging Man (Direction: sell)

**Detect Function**: `detectHangingMan()` at patterns.js:1410
**Category**: Single
**Algorithm**: Hammer shape in uptrend context. Requires `trend.strength >= 0.3` (S-6 guard). Minimum 10 bars prior data. No look-ahead bias (future candle confirmation removed).
**Win Rate**: 59.4% (n=5,554)
**Strength**: weak (no confirmation candle)

#### [P-05] Shooting Star (Direction: sell)

**Detect Function**: `detectShootingStar()` at patterns.js:1461
**Category**: Single
**Algorithm**: Inverted hammer shape in uptrend context. Volume confirmation boost: `volR >= 2.0` --> +3, `volR < 0.7` --> -2.
**Win Rate**: 59.2% (n=4,472)
**Strength**: medium

#### [P-06] Dragonfly Doji (Direction: buy)

**Detect Function**: `detectDragonflyDoji()` at patterns.js:1941
**Category**: Single
**Algorithm**:
1. Doji body condition (body/range <= 0.05)
2. `lowerShadow >= range * SPECIAL_DOJI_SHADOW_MIN` (0.70)
3. `upperShadow <= range * SPECIAL_DOJI_COUNTER_MAX` (0.15)
4. Prior downtrend required

**Win Rate**: 45.0% (n=1,180)

#### [P-07] Gravestone Doji (Direction: sell)

**Detect Function**: `detectGravestoneDoji()` at patterns.js:1996
**Category**: Single
**Algorithm**: Mirror of dragonfly -- long upper shadow, near-zero lower. Prior uptrend required.
**Win Rate**: 62.0% (n=1,107)

#### [P-08] Long-Legged Doji (Direction: context-dependent)

**Detect Function**: `detectLongLeggedDoji()` at patterns.js:2310
**Category**: Single
**Algorithm**: Doji with both shadows >= `LONG_DOJI_SHADOW_MIN` (0.30) of range. Range >= `LONG_DOJI_RANGE_MIN` (0.80) of ATR.
**Win Rate**: 45.0% (n=36,690)

#### [P-09] Spinning Top (Direction: neutral)

**Detect Function**: `detectSpinningTop()` at patterns.js:2259
**Category**: Single
**Algorithm**: Body 5-30% of range, both shadows >= body * `SPINNING_SHADOW_RATIO` (0.75).
**Win Rate**: 43.1% (n=559,149)
**Note**: No stop/target (neutral signal). Direction indeterminate.

#### [P-10] Bullish Marubozu (buy) / Bearish Marubozu (sell)

**Detect Function**: `detectMarubozu()` at patterns.js:2172
**Category**: Single (produces 2 types)
**Algorithm**:
1. `body >= range * MARUBOZU_BODY_RATIO` (0.85)
2. Both shadows <= `body * MARUBOZU_SHADOW_MAX` (0.02)
3. Trend filter: bullish excluded in strong uptrend (>0.5 strength), bearish excluded in strong downtrend

**Win Rate**: bullish 41.8% (n=30,796), bearish 57.7% (n=41,696)
**Strength**: strong
**FLAG**: Marubozu trend filter is partial -- strong same-direction excluded but weak same-direction allowed as continuation.

#### [P-11] Bullish Belt Hold (buy) / Bearish Belt Hold (sell)

**Detect Function**: `detectBeltHold()` at patterns.js:2360
**Category**: Single (produces 2 types)
**Algorithm**:
1. `body >= range * BELT_BODY_RATIO_MIN` (0.60) but `< MARUBOZU_BODY_RATIO` (0.85) -- between marubozu and normal
2. Open-side shadow <= `body * BELT_OPEN_SHADOW_MAX` (0.05)
3. Close-side shadow <= `body * BELT_CLOSE_SHADOW_MAX` (0.30)
4. `body >= ATR * BELT_BODY_ATR_MIN` (0.40)
5. Opposite trend context required (reversal pattern)

**Win Rate**: bullish 51.4% (n=3,930), bearish 57.4% (n=3,355)

---

### Candle Patterns -- Double (10 types from 7 detectors)

#### [P-12] Bullish Engulfing (buy) / Bearish Engulfing (sell)

**Detect Function**: `detectEngulfing()` at patterns.js:1551
**Category**: Double
**Algorithm**:
1. Previous body >= `ATR * ENGULF_PREV_BODY_MIN` (0.2)
2. Current body >= `ATR * ENGULF_CURR_BODY_MIN` (0.25)
3. `currBody >= prevBody * ENGULF_BODY_MULT` (1.5) -- clearly engulfs
4. Volume >= 0.7x VMA (Wyckoff filter)
5. Opposite trend context (bullish: not in uptrend; bearish: not in downtrend)
6. Volume bonus: `curr.vol > prev.vol * 1.5` --> +10 confidence

**Win Rate**: bullish 41.3% (n=103,287), bearish 57.2% (n=113,066)
**Strength**: strong

#### [P-13] Bullish Harami (buy) / Bearish Harami (sell)

**Detect Function**: `detectHarami()` at patterns.js:1637
**Category**: Double
**Algorithm**:
1. `prevBody >= ATR * HARAMI_PREV_BODY_MIN` (0.3)
2. `currBody <= prevBody * HARAMI_CURR_BODY_MAX` (0.5) and `>= ATR * HARAMI_CURR_BODY_MIN` (0.05)
3. Current body contained within previous body open/close range
4. Quality *= 0.8 (inherently unconfirmed -- look-ahead bias removed)

**Win Rate**: bullish 44.1% (n=52,880), bearish 58.7% (n=47,269)

#### [P-14] Piercing Line (Direction: buy)

**Detect Function**: `detectPiercingLine()` at patterns.js:1809
**Category**: Double
**Algorithm**:
1. Previous: bearish candle. Current: bullish candle.
2. Both bodies >= `ATR * PIERCING_BODY_MIN` (0.3)
3. `curr.open <= prev.close` (gap-down or equal level)
4. `curr.close >= prev.close + prevBody * 0.5` (50%+ recovery)
5. `curr.close < prev.open` (not engulfing)
6. Prior downtrend required

**Win Rate**: 50.2% (n=3,753)

#### [P-15] Dark Cloud Cover (Direction: sell)

**Detect Function**: `detectDarkCloud()` at patterns.js:1875
**Category**: Double
**Algorithm**: Bearish mirror of Piercing Line. Prior uptrend required.
**Win Rate**: 58.5% (n=3,093)

#### [P-16] Tweezer Bottom (Direction: buy)

**Detect Function**: `detectTweezerBottom()` at patterns.js:2051
**Category**: Double
**Algorithm**:
1. Previous: bearish, current: bullish
2. Both bodies >= `ATR * TWEEZER_BODY_MIN` (0.25)
3. `|prev.low - curr.low| <= ATR * TWEEZER_TOLERANCE` (0.1)
4. Prior downtrend required

**Win Rate**: 46.5% (n=9,024)

#### [P-17] Tweezer Top (Direction: sell)

**Detect Function**: `detectTweezerTop()` at patterns.js:2109
**Category**: Double
**Algorithm**: Mirror of tweezer bottom on highs.
**Win Rate**: 56.8% (n=5,994)

#### [P-18] Bullish Harami Cross (buy) / Bearish Harami Cross (sell)

**Detect Function**: `detectHaramiCross()` at patterns.js:2611
**Category**: Double
**Algorithm**: Harami where 2nd candle is doji (`body/range <= HARAMI_CROSS_DOJI_MAX` = 0.08). Nison: more significant than regular harami.
**Win Rate**: bullish 46.0% (n=8,500), bearish 57.5% (n=7,200)

#### [P-19] Stick Sandwich (Direction: buy)

**Detect Function**: `detectStickSandwich()` at patterns.js:2695
**Category**: Triple (structurally) / Double (Nison classification)
**Algorithm**:
1. c0: bearish, c1: bullish (close > c0.close), c2: bearish
2. `|c2.close - c0.close| <= ATR * STICK_SANDWICH_CLOSE_TOL` (0.05)
3. `c1 body >= ATR * STICK_SANDWICH_MID_BODY_MIN` (0.3)
4. Downtrend or neutral context

**Win Rate**: 52.0% (n=420)

---

### Candle Patterns -- Triple (8 types from 6 detectors)

#### [P-20] Three White Soldiers (Direction: buy)

**Detect Function**: `detectThreeWhiteSoldiers()` at patterns.js:1105
**Category**: Triple
**Algorithm**:
1. All 3 candles bullish, each closing higher than previous
2. Each opens within previous candle's body
3. Each body >= `ATR * THREE_SOLDIER_BODY_MIN` (0.5)
4. Upper wicks <= body * 0.5 for all 3
5. Prior downtrend required (reversal pattern)

**Win Rate**: 47.6% (n=4,811)
**Strength**: strong

#### [P-21] Three Black Crows (Direction: sell)

**Detect Function**: `detectThreeBlackCrows()` at patterns.js:1151
**Category**: Triple
**Algorithm**: Mirror of Three White Soldiers. Prior uptrend required.
**Win Rate**: 57.5% (n=4,812)

#### [P-22] Morning Star (Direction: buy)

**Detect Function**: `detectMorningStar()` at patterns.js:1700
**Category**: Triple
**Algorithm**:
1. c0: long bearish. c1: small body (star). c2: long bullish.
2. c0, c2 bodies >= `ATR * STAR_END_BODY_MIN` (0.5)
3. c1 body <= `ATR * STAR_BODY_MAX` (0.2)
4. Gap condition (AND): `c1.close <= c0.close AND c1.open <= c0.close`
5. `c2.close >= c0.close + body0 * 0.5` (50% recovery)
6. Prior downtrend

**Win Rate**: 40.5% (n=29,550)

#### [P-23] Evening Star (Direction: sell)

**Detect Function**: `detectEveningStar()` at patterns.js:1752
**Category**: Triple
**Algorithm**: Mirror of Morning Star. Prior uptrend required.
**Win Rate**: 56.7% (n=26,229)

#### [P-24] Three Inside Up (Direction: buy) / Three Inside Down (sell)

**Detect Function**: `detectThreeInsideUp()` at patterns.js:2429, `detectThreeInsideDown()` at patterns.js:2478
**Category**: Triple
**Algorithm**: Harami + confirmation candle. 3rd candle closes beyond 1st candle's open.
**Win Rate**: up 42.4% (n=14,275), down 55.1% (n=13,760)

#### [P-25] Abandoned Baby Bullish (buy) / Bearish (sell)

**Detect Function**: `detectAbandonedBaby()` at patterns.js:2531
**Category**: Triple
**Algorithm**:
1. c1 is doji (`body/range <= ABANDONED_BABY_DOJI_MAX` = 0.15)
2. Bullish: c1 gapped below both c0 and c2 by `ATR * ABANDONED_BABY_GAP_MIN` (0.03)
3. Bearish: c1 gapped above both

**Win Rate**: bullish 51.8% (n=137), bearish 64.8% (n=71)
**Note**: Extremely rare in KRX due to continuous trading structure. GAP_MIN relaxed from 0.05 to 0.03.

---

### Candle Patterns -- 5-bar Continuation (2 types)

#### [P-26] Rising Three Methods (Direction: buy)

**Detect Function**: `detectRisingThreeMethods()` at patterns.js:1202
**Category**: 5-bar continuation
**Algorithm**:
1. c0: large bullish (body/ATR > 0.7)
2. c1-c3: small bearish candles within c0's range, each body < 50% of c0
3. c4: large bullish closing above c0's high
4. Prior uptrend required (continuation)

**Win Rate**: Not in PATTERN_WIN_RATES (rare pattern)
**Strength**: strong
**Academic**: Nison (1991), core_data/07 S8.1

#### [P-27] Falling Three Methods (Direction: sell)

**Detect Function**: `detectFallingThreeMethods()` at patterns.js:1263
**Category**: 5-bar continuation
**Algorithm**: Mirror of Rising Three Methods. Prior downtrend required.

---

### Chart Patterns (11 types from 11 detectors)

All chart patterns use swing point detection (`_findSwingHighs`/`_findSwingLows` at patterns.js:3618/3631) with lookback=3 as input.

#### [P-28] Double Bottom (Direction: buy)

**Detect Function**: `detectDoubleBottom()` at patterns.js:3127
**Category**: Chart
**Algorithm**:
1. Two swing lows within 50 bars, price difference <= `ATR * 0.5`
2. Span 5-40 bars
3. Prior downtrend confirmed (Edwards & Magee 2018)
4. Neckline = highest high between the two lows
5. Volume decline at 2nd low (Bulkowski confirmation)

**Price Target**: `neckline + min(patternHeight * hw * mw, raw * 2.0, ATR * dynamicATRCap)`
**Stop Loss**: `min(l1.price, l2.price) - ATR`
**Win Rate**: 62.1% (n=1,939)

#### [P-29] Double Top (Direction: sell)

**Detect Function**: `detectDoubleTop()` at patterns.js:3177
**Category**: Chart
**Algorithm**: Mirror of Double Bottom on swing highs.
**Win Rate**: 74.7% (n=1,539)

#### [P-30] Head and Shoulders (Direction: sell)

**Detect Function**: `detectHeadAndShoulders()` at patterns.js:3227
**Category**: Chart
**Algorithm**:
1. 3 swing highs within `HS_WINDOW` (120 bars): head > both shoulders
2. Shoulder asymmetry <= `HS_SHOULDER_TOLERANCE` (0.15)
3. 2 troughs between the 3 peaks for neckline slope
4. Price near neckline (within ATR*0.5 above, ATR*2.0 below)
5. Prior uptrend verified
6. Volume: pivot volume decline (LS > Head > RS)

**Price Target**: `neckline - patternHeight`
**Stop Loss**: `rs.price + ATR * 1.5`
**Win Rate**: 56.9% (n=1,156)

#### [P-31] Inverse Head and Shoulders (Direction: buy)

**Detect Function**: `detectInverseHeadAndShoulders()` at patterns.js:3308
**Category**: Chart
**Algorithm**: Mirror of H&S. Prior downtrend required. Neckline break filter: close must be within [-0.5 ATR, +2.0 ATR] of neckline.
**Win Rate**: 44.0% (n=1,280)

#### [P-32] Ascending Triangle (Direction: buy)

**Detect Function**: `detectAscendingTriangle()` at patterns.js:2752
**Category**: Chart
**Algorithm**:
1. 2+ swing highs at approximately equal level (within ATR*0.5)
2. 2+ swing lows with net ascending slope (Theil-Sen or 2-point fallback)
3. Volume contraction during formation
4. Uses `_adaptiveQuality` with learned weights

**Win Rate**: 39.5% (n=352)

#### [P-33] Descending Triangle (Direction: sell)

**Detect Function**: `detectDescendingTriangle()` at patterns.js:2817
**Category**: Chart
**Algorithm**: Mirror of ascending. Flat support + descending resistance.
**Win Rate**: 54.3% (n=503)

#### [P-34] Symmetric Triangle (Direction: neutral)

**Detect Function**: `detectSymmetricTriangle()` at patterns.js:3042
**Category**: Chart
**Algorithm**:
1. Highs descending, lows ascending (convergence)
2. Slope ratio 0.3-3.0 (symmetry check)
3. Minimum 10-bar span
4. Symmetry score = `1 - |1 - slopeRatio| / 2`

**Win Rate**: 32.3% (n=2,678)
**Note**: No stop/target (neutral -- direction determined by breakout).

#### [P-35] Rising Wedge (Direction: sell)

**Detect Function**: `detectRisingWedge()` at patterns.js:2886
**Category**: Chart
**Algorithm**:
1. Both highs and lows ascending (h2 > h1, l2 > l1)
2. Upper slope < lower slope (converging upward)
3. End height < start height * 0.9 (wedge narrowing >= 10%)
4. Span >= 8 bars

**Win Rate**: 59.8% (n=1,054)

#### [P-36] Falling Wedge (Direction: buy)

**Detect Function**: `detectFallingWedge()` at patterns.js:2962
**Category**: Chart
**Algorithm**: Mirror of rising wedge. Both slopes descending, lower slope less steep.
**Win Rate**: 39.1% (n=2,380)

#### [P-37] Channel (Direction: context-dependent)

**Detect Function**: `detectChannel()` at patterns.js:3651
**Category**: Chart
**Algorithm** (6-step verification):
1. OLS fit upper trend line on swing highs, lower on swing lows
2. Parallelism: `|slopeHi - slopeLo| / ATR < CHANNEL_PARALLELISM_MAX` (0.020)
3. Width: `CHANNEL_WIDTH_MIN` (1.5) to `CHANNEL_WIDTH_MAX` (8.0) ATR
4. Span >= `CHANNEL_MIN_SPAN` (15 bars)
5. Containment >= `CHANNEL_CONTAINMENT` (80%)
6. Touches >= `CHANNEL_MIN_TOUCHES` (3)

**Direction**: ascending/descending/horizontal based on avg slope / ATR.
**Win Rate**: 58.0% (n=125)

#### [P-38] Cup and Handle (Direction: buy)

**Detect Function**: `detectCupAndHandle()` at patterns.js:3790
**Category**: Chart
**Algorithm**:
1. Left rim: local high (3-bar dominance)
2. Cup bottom: lowest point 10-55 bars from rim
3. Depth: 12-35% of left rim price (O'Neil 1988)
4. U-shape: parabolic R-squared >= 0.6
5. Right rim: recovers >= 90% of left rim
6. Handle (optional): shallow pullback < 50% of cup depth, 15-30% of cup width
7. Volume U-shape: decrease at bottom, increase at right rim

**Win Rate**: 61.0% (n=125)
**Strength**: strong

---

### Support/Resistance + Valuation S/R

#### [P-39] Support/Resistance Clustering

**Detect Function**: `detectSupportResistance()` at patterns.js:3395
**Category**: S/R
**Algorithm**:
1. Merge all swing highs (resistance) and swing lows (support)
2. Cluster points within `ATR * 0.5` tolerance
3. Minimum 2 touches per cluster
4. Strength = `min(touches / 4, 1)`
5. Return top 10 by touch count

#### [P-40] Valuation S/R

**Detect Function**: `detectValuationSR()` at patterns.js:3457
**Category**: Fundamental S/R
**Algorithm**: PBR thresholds (0.5, 1.0, 1.5, 2.0, 3.0) x BPS + PER thresholds (5, 10, 15, 20, 30) x EPS. Filtered to current price +/- 30%. Nearby levels merged (2% tolerance). Max 5 levels.
**Academic**: Rothschild & Stiglitz (1976), Shiller (2000), Damodaran (2012).

---

### Post-Detection Processing

#### Neckline Break Confirmation

**Function**: `_checkNecklineBreak()` at patterns.js:3949
**Applied to**: H&S, inv H&S, doubleBottom, doubleTop, cupAndHandle
**Logic**: After endIndex, scan up to `NECKLINE_BREAK_LOOKFORWARD` (20) bars. Break = close exceeds neckline by `ATR * NECKLINE_BREAK_ATR_MULT` (0.5). Unconfirmed penalty: `-NECKLINE_UNCONFIRMED_PENALTY` (15) from confidence.

#### Triangle/Wedge Breakout Confirmation

**Function**: `_checkTriangleBreakout()` (not shown in read range, estimated patterns.js:3990+)
**Applied to**: ascTriangle, descTriangle, symTriangle, risingWedge, fallingWedge
**Logic**: Similar to neckline but with `TRIANGLE_BREAK_ATR_MULT` (0.3) and `TRIANGLE_BREAK_LOOKFORWARD` (15). Unconfirmed penalty: -12.

#### R:R Gate

**Function**: `_applyRRGate()` at patterns.js:3594
**Logic**: R:R < 0.5 --> -5 confidence. R:R < 1.0 --> -3. R:R >= 1.0 --> no penalty (monotonic). Bayesian sigmoid further adjusts confidencePred (separate from confidence).

#### Herding Adjustment

**Function**: `_applyHerdingAdjust()` at patterns.js:986
**Logic**: 3-day avg CSAD herding_flag >= 1.67 + rMarket < 0 --> buy patterns * 0.76. Same herding + rMarket > 0 --> sell patterns * 0.76. VKOSPI crisis/high --> buy patterns * 0.75.

#### Breakpoint Adjustment

**Function**: `_applyBreakpointAdjust()` at patterns.js:1056
**Logic**: If CUSUM breakpoint within 20 bars of pattern, apply discount `0.70 + 0.30 * min(1, barsSince/30)`. Volatility-adaptive threshold via classifyVolRegime.

---

## Section 3.3: Quality Scoring + Pattern-to-Builder Matrix

### 3.3.1 Five-Factor Quality Score

**Function**: `_quality({body, volume, trend, shadow, extra})` at patterns.js:547
**Formula**: $Q = \min(100, \max(0, 100 \times (W_b \cdot body + W_v \cdot volume + W_t \cdot trend + W_s \cdot shadow + W_e \cdot extra)))$

**Weight constants** (`Q_WEIGHT` at patterns.js:133):

| Factor | Weight | Grade | Rationale |
|--------|--------|-------|-----------|
| body | 0.25 | [B] | Nison: body is primary pattern element |
| volume | 0.25 | [B] | Nison/Edwards: volume confirms direction |
| trend | 0.20 | [B] | Murphy: context determines validity |
| shadow | 0.15 | [B] | Morris: shadow geometry is secondary |
| extra | 0.15 | [B] | Pattern-specific confirmation factor |

**Default values**: body=0.5, volume=0.5, trend=0.5, shadow=0.5, extra=0.3 (conservative for unconfirmed).

### 3.3.2 Adaptive Quality (Chart Patterns)

**Function**: `_adaptiveQuality(patternType, features)` at patterns.js:560
**Purpose**: Blends prior weights (`Q_WEIGHT`) with learned weights from backtester WLS regression.

**Blend formula**: $W_{final} = (1 - \alpha) \cdot W_{prior} + \alpha \cdot W_{learned}$, where:
- alpha = `min(decayedConfidence * 2, alphaCap)`, alphaCap = 0.7 if R-squared > 0.3, else 0.5
- `decayedConfidence = learned.confidence * temporalDecayFactor()` (AMH Lo 2004)
- `_normalizeCoeffsToWeights()` splits body coefficient into body/shadow using prior ratio 0.625/0.375

### 3.3.3 ATR Normalization Mechanism

All pattern thresholds are expressed as ATR multiples, ensuring equal sensitivity across price levels:
- Samsung (~60,000 KRW, ATR ~1,200): hammer body < 480 KRW
- Small-cap (~1,000 KRW, ATR ~20): hammer body < 8 KRW

**ATR fallback** (`_atr()` at patterns.js:624): When ATR(14) unavailable, uses `close * ATR_FALLBACK_BY_TF[timeframe]`:

| Timeframe | Fallback % | Rationale |
|-----------|-----------|-----------|
| 1m | 0.2% | Intraday noise floor |
| 5m | 0.4% | |
| 15m | 0.6% | |
| 30m | 0.8% | |
| 1h | 1.2% | |
| 1d | 2.0% | KRX large-cap median ATR/close ~2.1% |
| 1w | 4.4% | sqrt(5) * daily |
| 1M | 9.0% | sqrt(22) * daily |

### 3.3.4 Confluence Scoring

**Function**: `_applyConfluence()` at patterns.js:3553
**Logic**: For each pattern, if stop/target price is within 1 ATR of an S/R level:
- Stop near support (buy) or resistance (sell): `+3 * sr.strength`
- Target near S/R level: `+2 * sr.strength`
- Cap at 90 (Taleb 2007 overconfidence bias)

### 3.3.5 Dual Confidence System

| Field | Name | Purpose | Range |
|-------|------|---------|-------|
| `confidence` | Shape score | UI display, pattern card ranking | [10, 90] |
| `confidencePred` | Predictive probability | Model input for backtester/WLS | [10, 95] |

**confidencePred calculation** (patterns.js:896-928):
1. Base: Beta-Binomial posterior win rate (or PATTERN_WIN_RATES_SHRUNK fallback)
2. Direction-aware: sell patterns use `100 - WR` (since WR measures P(price UP))
3. Quality scaling: `pred * clamp(confidence/50, 0.88, 1.12)` (Caginalp 1998)
4. Unconfirmed penalty: neckline -20, triangle -15
5. Final clamp: [10, 95]

### 3.3.6 Win Rate Estimation

**Source**: `PATTERN_WIN_RATES` at patterns.js:247 -- 5-year KRX empirical data (2021-03 to 2026-03), 545,307 total patterns across 2,768 stocks.

**Shrinkage**: `PATTERN_WIN_RATES_SHRUNK` at patterns.js:296 -- Beta-Binomial conjugate prior with N0=35 (Empirical Bayes optimal, Phase2-E-2). Separate grand means for candle (~43%) and chart (~45%) categories to prevent high-sample patterns (spinningTop n=559K) from dominating low-sample patterns (H&S n=1,156).

### 3.3.7 Price Target and Stop Loss

**Candle pattern targets** (`_candleTarget` at patterns.js:614):

| Strength | ATR Multiplier | 95% CI | Calibration Source |
|----------|---------------|--------|-------------------|
| strong | 1.88 | [1.86, 1.91] | 55,469 patterns, Theil-Sen |
| medium | 2.31 | [2.23, 2.39] | 5,403 patterns |
| weak | 2.18 | [2.09, 2.28] | 1,392 patterns |

**Note**: Non-monotonic (medium > weak > strong) -- explained by confounding: medium patterns (reversal) appear in volatile contexts with larger subsequent moves; strong patterns (confirmation) capture remaining move after trend already established (Bulkowski 2008).

**Chart pattern targets**: Measured move (pattern height) capped by:
1. `raw * CHART_TARGET_RAW_CAP` (2.0) -- Bulkowski P80
2. `ATR * CHART_TARGET_ATR_CAP` (6, or 4-5 when Hill alpha < 3-4) -- EVT 99.5% VaR
3. Scaled by `hw * mw` (Hurst + mean-reversion weights)

**Stop loss** (`_stopLoss` at patterns.js:594):
- Base: `close +/- ATR * STOP_LOSS_ATR_MULT * PROSPECT_STOP_WIDEN` (2 * 1.15 = 2.3 ATR)
- EVT enhancement: when GPD VaR99 available and exceeds ATR stop, use GPD distance instead
- Prospect Theory: Kahneman & Tversky (1979) loss aversion widens stop (PROSPECT_STOP_WIDEN = 1.15)

### 3.3.8 Pattern-to-Builder Matrix

The following table maps each detected pattern type to its patternRenderer layers and builder functions.

| Pattern | Category | Layers Used | Builder Functions | Renderer Set |
|---------|----------|-------------|-------------------|--------------|
| doji | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| hammer | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| invertedHammer | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| hangingMan | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| shootingStar | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| dragonflyDoji | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| gravestoneDoji | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| longLeggedDoji | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| spinningTop | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| bullishMarubozu | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| bearishMarubozu | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| bullishBeltHold | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| bearishBeltHold | Single | 1, 7 | _buildSingleGlow, _buildLabel | SINGLE_PATTERNS |
| bullishEngulfing | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| bearishEngulfing | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| bullishHarami | Zone | 2, 5, 7, 8 | _buildZoneBracket (useBody), _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| bearishHarami | Zone | 2, 5, 7, 8 | _buildZoneBracket (useBody), _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| piercingLine | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| darkCloud | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| tweezerBottom | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| tweezerTop | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| bullishHaramiCross | Zone | 2, 5, 7, 8 | _buildZoneBracket (useBody), _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| bearishHaramiCross | Zone | 2, 5, 7, 8 | _buildZoneBracket (useBody), _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| stickSandwich | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| morningStar | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| eveningStar | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| threeWhiteSoldiers | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| threeBlackCrows | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| threeInsideUp | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| threeInsideDown | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| abandonedBabyBullish | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| abandonedBabyBearish | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| risingThreeMethods | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| fallingThreeMethods | Zone | 2, 5, 7, 8 | _buildZoneBracket, _buildHLines, _buildLabel, _buildForecastZone | ZONE_PATTERNS |
| doubleBottom | Chart | 4, 5, 7, 8 | _buildDoubleBottom (W-curve), _buildHLines (neckline+stop+target), _buildLabel, _buildForecastZone | CHART_PATTERNS |
| doubleTop | Chart | 4, 5, 7, 8 | _buildDoubleTop (M-curve), _buildHLines, _buildLabel, _buildForecastZone | CHART_PATTERNS |
| headAndShoulders | Chart | 4, 5, 6, 7, 8, 9 | _buildHeadAndShoulders (neckline polyline), _buildHLines, _buildConnectors (hollow circles), _buildLabel, _buildForecastZone, _buildExtendedLines | CHART_PATTERNS |
| inverseHeadAndShoulders | Chart | 4, 5, 6, 7, 8, 9 | Same as H&S (inverted) | CHART_PATTERNS |
| ascendingTriangle | Chart | 3, 4, 5, 7, 8 | _buildTriangleArea (gradient fill), _buildTrendlines, _buildHLines, _buildLabel, _buildForecastZone | CHART_PATTERNS |
| descendingTriangle | Chart | 3, 4, 5, 7, 8 | Same as ascending | CHART_PATTERNS |
| symmetricTriangle | Chart | 3, 4, 5, 7, 8 | Same as ascending | CHART_PATTERNS |
| risingWedge | Chart | 3, 4, 5, 7, 8 | _buildWedgeArea (gradient fill), _buildTrendlines, _buildHLines, _buildLabel, _buildForecastZone | CHART_PATTERNS |
| fallingWedge | Chart | 3, 4, 5, 7, 8 | Same as rising wedge | CHART_PATTERNS |
| channel | Chart | 3, 4, 5, 7, 8, 9 | _buildChannelArea, _buildChannelLines, _buildHLines, _buildLabel, _buildForecastZone, _buildExtendedLines | CHART_PATTERNS |
| cupAndHandle | Chart | 4, 5, 7, 8 | _buildCupAndHandle (U-curve), _buildHLines (neckline), _buildLabel, _buildForecastZone | CHART_PATTERNS |

**Layer Legend** (from `.claude/rules/rendering.md`):
1. Glows -- single candle vertical stripes (purple 0.12)
2. Brackets -- multi-candle rounded rects (purple 0.12)
3. TrendAreas -- triangle/wedge gradient fills + pivot markers
4. Polylines -- W/M/neckline connections (smooth option)
5. HLines -- S/R, stop/target horizontal lines + price labels
6. Connectors -- H&S empty circles + shoulder connections
7. Labels -- HTS-style pill badges (Pretendard 12px 700) + collision avoidance
8. ForecastZones -- target/stop gradients + R:R vertical bar
9. ExtendedLines -- off-visible structure line extensions (accent gold, dash [8,4])

**Density Limits**: MAX_PATTERNS=3, MAX_EXTENDED_LINES=5

---

## TA Findings

### Finding F-1: Marubozu Trend Filter Incomplete (PARTIAL compliance)

**Location**: patterns.js:2200-2203
**Issue**: Bullish marubozu excludes strong uptrend (>0.5) but allows weak uptrend (0.3-0.5). Bearish mirror symmetric. Nison defines marubozu as continuation signal, but the filter logic creates an ambiguous zone where pattern could be either continuation (weak uptrend) or reversal (downtrend).
**Impact**: WR 41.8% -- below 50% threshold for buy patterns. This was flagged in audit_20260404_theory_compliance.md.
**Recommendation**: Separate marubozu into reversal-context and continuation-context subtypes with distinct win rates.

### Finding F-2: Symmetric Triangle Has No Stop/Target

**Location**: patterns.js:3100-3105
**Issue**: `signal: 'neutral'`, `stopLoss: null`, `priceTarget: null`. Since direction is undetermined pre-breakout, this is theoretically correct. However, the `_checkTriangleBreakout()` post-processor does not retroactively assign stop/target upon confirmed breakout -- the pattern remains without actionable levels.
**Impact**: Low utility for trading decisions despite 32.3% directional WR suggesting breakout direction is relevant.
**Recommendation**: After breakout confirmation, populate stop (opposite boundary) and target (pattern height in breakout direction).

### Finding F-3: Rising/Falling Three Methods Missing Win Rates

**Location**: patterns.js PATTERN_WIN_RATES (line 247)
**Issue**: `risingThreeMethods` and `fallingThreeMethods` are not in `PATTERN_WIN_RATES` or `PATTERN_SAMPLE_SIZES`. The `PATTERN_WIN_RATES_SHRUNK` computation will log a console warning and use `N0` fallback.
**Impact**: confidencePred uses grand mean instead of pattern-specific rate. Low priority due to very rare pattern (5-bar formation).

### Finding F-4: Stage Reference Gap -- calcOBV Not Linked to Pattern Engine

**Location**: indicators.js:115, patterns.js (no reference to OBV)
**Issue**: `calcOBV()` is computed and available via IndicatorCache but not consumed by any pattern detection method. Only signalEngine uses it for divergence signals. Pattern volume analysis uses raw `candles[i].volume / VMA` ratio instead of OBV trend.
**Impact**: Information loss -- OBV's cumulative nature provides trend confirmation that simple volume ratio cannot capture (Granville 1963).

### Finding F-5: Abandoned Baby Sample Size Critically Low

**Location**: patterns.js PATTERN_SAMPLE_SIZES line 277
**Issue**: abandonedBabyBullish n=137, abandonedBabyBearish n=71. With N0=35, shrinkage is 79%/67% toward grand mean respectively. The reported win rates (51.8%/64.8%) are effectively overridden by shrinkage.
**Impact**: These patterns' confidencePred is nearly identical to the category grand mean regardless of shape quality. Acceptable given extreme rarity but should not be marketed as high-confidence patterns.

### Finding F-6: cupAndHandle Win Rate Source Unclear

**Location**: PATTERN_WIN_RATES line 258
**Issue**: cupAndHandle WR=61.0% with n=125. The n=125 is very low for 5-year 2,768-stock data, suggesting either (a) correct due to rarity or (b) the pattern was added after the 5-year calibration window. Cross-reference with calibrated_constants.json needed.
**Impact**: Low sample size means high shrinkage (~22% toward grand mean). WR estimate has wide confidence interval.

### Finding F-7: Timeframe Pattern Map Documentation Gap

**Location**: patterns.js:158-171 (TF_PATTERN_MAP)
**Issue**: The timeframe-to-pattern activation map is a critical configuration that determines which patterns fire on which timeframes, but it has no academic justification for its specific assignments. For example, why are H&S excluded from 1h but included in 1d? Why are candle patterns null on 1m?
**Impact**: The map is likely correct based on CFA/chart expert consensus (per code comment), but the specific choices should be documented with rationale per timeframe.
