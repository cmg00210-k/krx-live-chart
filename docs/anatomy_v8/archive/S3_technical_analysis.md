# Stage 3: Technical Analysis -- The Applied Theory

> Theoretical coherence document for CheeseStock KRX Live Chart.
> Every indicator, pattern, signal, and confidence function is traced to its academic lineage.
> Stage color: Emerald Teal #1A3D35 | Version: V8 (2026-04-08)

---

## 3.1 Indicator Lineage Cards

Each indicator implemented in `js/indicators.js` is documented with its complete
academic provenance, mathematical formulation, implementation details, and
downstream consumers.

### I-01: Simple Moving Average (SMA)

**Academic Lineage:** Mathematics -> Descriptive Statistics -> Arithmetic Mean
**Key Papers:** No single originator; foundational statistical concept.
Popularized for markets by Donchian (1960s) and Murphy (1999).
**Formula:**
```
SMA(n) = (1/n) * sum_{i=0}^{n-1} P_{t-i}
```
**Why in stock chart:** The SMA smooths price noise to reveal the underlying trend
direction. As a low-pass filter, it removes high-frequency fluctuations while
preserving the dominant trend. The choice of period `n` determines the cutoff
frequency: shorter periods (5, 10) track recent momentum; longer periods (50, 200)
capture secular trends.
**Implementation:** `js/indicators.js` `calcMA(data, n)`, line 15.
Constants: n = 5 [A], 20 [A], 60 [A] (standard periods).
**Consumed by:** Signal S-1 (MA crossover), S-2 (MA alignment), Stochastic %D smoothing,
CCI mean deviation, composite signals.
**Back-reference:** Stage 2, Section 2A (Statistics foundation).

---

### I-02: Exponential Moving Average (EMA)

**Academic Lineage:** Statistics -> Time Series Smoothing -> Exponential Smoothing
**Key Papers:** Brown (1956) "Exponential Smoothing for Predicting Demand";
Holt (1957) generalization; Hunter (1986) EWMA interpretation.
**Formula:**
```
EMA_t = alpha * P_t + (1 - alpha) * EMA_{t-1}
alpha = 2 / (n + 1)
```
Initialization: `EMA_0 = SMA(first n observations)`.
**Why in stock chart:** EMA gives exponentially declining weight to older observations,
making it more responsive to recent price changes than SMA. This responsiveness is
critical for MACD (I-19), which relies on the difference between fast and slow EMAs
to detect momentum shifts.
**Implementation:** `js/indicators.js` `calcEMA(data, n)`, line 26.
Constants: n = 12 [A], 26 [A] (MACD default), 9 [A] (signal line).
P0-3 fix: SMA init with null/NaN guard.
**Consumed by:** MACD (I-19), EWMA Volatility (I-26), vol regime long-run EMA.
**Back-reference:** Stage 2, Section 2A (Doc 01, Mathematics).

---

### I-03: Bollinger Bands (BB)

**Academic Lineage:** Statistics -> Descriptive Statistics -> Standard Deviation Bands
**Key Papers:** Bollinger (2001) "Bollinger on Bollinger Bands." Uses population
sigma (divide by n), not Bessel-corrected sample sigma (divide by n-1). This is an
intentional authorial choice documented in the original text.
**Formula:**
```
Middle = SMA(n)
Upper = SMA(n) + k * sigma_pop(n)
Lower = SMA(n) - k * sigma_pop(n)
sigma_pop = sqrt((1/n) * sum(P_i - SMA)^2)
```
**Why in stock chart:** Bollinger Bands capture 2-sigma price envelopes, identifying
overbought (upper band) and oversold (lower band) conditions. The squeeze (band
narrowing) precedes volatility expansion -- a key regime-change signal.
**Implementation:** `js/indicators.js` `calcBB(closes, n, mult)`, line 50.
Constants: n = 20 [A], mult = 2.0 [A]. Population sigma per Bollinger (2001).
**Consumed by:** Signal S-7 (BB bounce/break/squeeze), composite signals
(buy_hammerBBVol, sell_shootingStarBBVol), EVT-aware extension (I-3E).
**Back-reference:** Stage 2, Section 2A (Doc 02, Statistics).

---

### I-03E: EVT-Aware Bollinger Bands

**Academic Lineage:** Statistics -> Extreme Value Theory -> Tail-Adjusted Bands
**Key Papers:** Gopikrishnan et al. (1999) "Scaling of the Distribution of
Financial Market Fluctuations"; Hill (1975) tail index.
**Formula:**
```
if Hill_alpha < 4 (heavy tail detected):
  EVT_mult = k * (1 + 0.45 * (4 - Hill_alpha))
else:
  EVT_mult = k  (standard Bollinger)
```
**Why in stock chart:** Financial returns exhibit fat tails (alpha typically 3-5 for
KRX stocks). Standard 2-sigma bands assume normality; EVT-adjusted bands widen to
accommodate the true tail probability, reducing false breakout signals.
**Implementation:** `js/indicators.js` `IndicatorCache.bbEVT()`, lazy evaluation.
Constants: 0.45 coefficient [D] heuristic (not exact quantile mapping).
**Consumed by:** Enhanced Bollinger signals when EVT data available.
**Back-reference:** Stage 2, Section 2A (Doc 12, Extreme Value Theory).

---

### I-04: RSI (Relative Strength Index)

**Academic Lineage:** Technical Analysis -> Momentum Oscillators -> Wilder
**Key Papers:** Wilder (1978) "New Concepts in Technical Trading Systems."
**Formula:**
```
RS = AvgGain(n) / AvgLoss(n)
RSI = 100 - 100 / (1 + RS)
```
Wilder smoothing: `AvgGain_t = (AvgGain_{t-1} * (n-1) + Gain_t) / n`
This is equivalent to an exponential moving average with alpha = 1/n.
**Why in stock chart:** RSI measures the speed and magnitude of directional price
movements, oscillating 0-100. Values > 70 indicate overbought conditions (selling
pressure building); values < 30 indicate oversold (buying opportunity).
Psychologically, RSI maps to the fear-greed spectrum (Stage 2, Section 2C.1.4).
**Implementation:** `js/indicators.js` `calcRSI(closes, period)`, line 63.
Constants: period = 14 [A] (Wilder original).
**Consumed by:** Signal S-5 (RSI zones), S-6 (RSI divergence), StochRSI (I-21),
composite signals (strongBuy_hammerRsiVolume, buy_bbBounceRsi, etc.).
**Back-reference:** Stage 2, Section 2C.1.4 (Psychology -- fear/greed proxy).

---

### I-05: ATR (Average True Range)

**Academic Lineage:** Technical Analysis -> Volatility Measurement -> Wilder
**Key Papers:** Wilder (1978) "New Concepts in Technical Trading Systems."
**Formula:**
```
TR_t = max(H_t - L_t, |H_t - C_{t-1}|, |L_t - C_{t-1}|)
ATR_t = (ATR_{t-1} * (n-1) + TR_t) / n
```
**Why in stock chart:** ATR is the universal normalization unit in CheeseStock. By
expressing all pattern thresholds, stop-losses, and targets as ATR multiples, the
system achieves price-level independence: a pattern on Samsung (60,000 KRW) and a
pattern on a 1,000 KRW penny stock are evaluated identically in volatility-relative
terms. This is the most critical design decision in the pattern engine.
**Implementation:** `js/indicators.js` `calcATR(candles, period)`, line 87.
Constants: period = 14 [A] (Wilder original).
Fallback: `close * 0.02` when ATR(14) unavailable; timeframe-specific in
`PatternEngine.ATR_FALLBACK_BY_TF`.
**Consumed by:** Every pattern detection, every stop/target calculation, S/R
clustering tolerance, confidence adjustments, OLS trend normalization.
**Back-reference:** Stage 2, Section 2A (Doc 06, Technical Analysis).

---

### I-06: OBV (On-Balance Volume)

**Academic Lineage:** Technical Analysis -> Volume Analysis -> Granville
**Key Papers:** Granville (1963) "New Key to Stock Market Profits";
Murphy (1999) Ch. 7.
**Formula:**
```
if C_t > C_{t-1}: OBV_t = OBV_{t-1} + V_t
if C_t < C_{t-1}: OBV_t = OBV_{t-1} - V_t
if C_t = C_{t-1}: OBV_t = OBV_{t-1}
```
**Why in stock chart:** Granville's core hypothesis: "volume precedes price." OBV
accumulates volume in the direction of price movement, creating a running total
that reveals accumulation (smart money buying) or distribution (smart money selling)
before price reacts. Divergence between OBV trend and price trend is one of the
most reliable leading indicators in the behavioral finance literature (Barber-Odean
2008 attention theory, Stage 2 Section 2C.1.7).
**Implementation:** `js/indicators.js` `calcOBV(candles)`, line 115.
No tunable constants (pure formula).
**Consumed by:** Signal S-20 (OBV divergence), composite signal
buy_volRegimeOBVAccumulation.
**Back-reference:** Stage 2, Section 2C.1.7 (Attention and volume psychology).

---

### I-07: Ichimoku Cloud (Ichimoku Kinko Hyo)

**Academic Lineage:** Technical Analysis -> Japanese Technical -> Hosoda
**Key Papers:** Hosoda, Goichi (1969) "Ichimoku Kinko Hyo" (One-Glance Equilibrium
Chart). Published under pen name Ichimoku Sanjin.
**Formula:**
```
Tenkan-sen (Conversion):  (highest_high(9) + lowest_low(9)) / 2
Kijun-sen (Base):         (highest_high(26) + lowest_low(26)) / 2
Senkou Span A:            (Tenkan + Kijun) / 2, displaced +26
Senkou Span B:            (highest_high(52) + lowest_low(52)) / 2, displaced +26
Chikou Span:              Close, displaced -26
```
**Why in stock chart:** Ichimoku provides five data points simultaneously: trend
direction (Tenkan/Kijun relationship), momentum (cloud position), support/resistance
(cloud boundaries), and confirmation (Chikou vs price). The "three-line reversal"
(saneki-hoten / saneki-gyakuten) -- price above cloud, Tenkan crosses above Kijun,
and Chikou above price 26 periods ago -- is considered a strong signal in Japanese
TA tradition.
**Implementation:** `js/indicators.js` `calcIchimoku(candles, conv, base, spanBPeriod, displacement)`, line 135.
Constants: conv=9, base=26, spanB=52, displacement=26 [A] (Hosoda original).
**Consumed by:** Signal S-8 (cloud break, TK cross), composite signals
(buy_ichimokuTriple, sell_ichimokuTriple).
**Back-reference:** Stage 2, Section 2A (Doc 06, Japanese TA tradition).

---

### I-08: Kalman Filter

**Academic Lineage:** Mathematics/Engineering -> Optimal Control -> State Estimation
**Key Papers:** Kalman (1960) "A New Approach to Linear Filtering and Prediction
Problems"; Mohamed and Schwarz (1999) adaptive Q for INS/GPS.
**Formula:**
```
Predict: x_pred = x_{t-1},  P_pred = P_{t-1} + Q_adaptive
Update:  K = P_pred / (P_pred + R)
         x_t = x_pred + K * (z_t - x_pred)
         P_t = (1 - K) * P_pred
```
Adaptive Q: `Q_t = Q_base * (ewmaVar_t / meanVar)`
**Why in stock chart:** The Kalman filter provides optimal state estimation under
Gaussian noise assumptions. Applied to price series, it produces a smoothed estimate
that adapts its responsiveness based on the noise-to-signal ratio. Unlike moving
averages (fixed lag), the Kalman filter's gain `K` automatically adjusts: high
noise -> low gain (more smoothing); low noise -> high gain (more responsive).
The adaptive Q extension (Mohamed-Schwarz 1999) scales process noise by current
volatility regime, providing additional regime sensitivity.
**Implementation:** `js/indicators.js` `calcKalman(closes, Q, R)`, line 170.
Constants: Q=0.01 [B], R=1.0 [B], ewmaAlpha=0.06 [B] (~30-bar EWMA).
**Consumed by:** Signal S-12 (Kalman turn -- slope direction change).
**Back-reference:** Stage 2, Section 2A (Doc 10, Optimal Control).

---

### I-09: Hurst Exponent (R/S Analysis)

**Academic Lineage:** Physics/Fractals -> Long-Range Dependence -> Mandelbrot
**Key Papers:** Mandelbrot (1963) "The Variation of Certain Speculative Prices";
Peters (1994) "Fractal Market Analysis" Ch. 4; Mandelbrot and Wallis (1969)
R/S analysis convention.
**Formula:**
```
1. Convert prices to log-returns: r_t = ln(P_{t+1}/P_t)
2. For window sizes w = [minWindow, minWindow*1.5, minWindow*2.25, ...]:
   a. Divide returns into blocks of size w
   b. Per block: compute R/S = (max(cumDeviation) - min(cumDeviation)) / S
   c. Average R/S across blocks (valid blocks only, S > 0)
3. Regress: log(R/S) = H * log(w) + c
   H = slope of regression
```
**Why in stock chart:** H > 0.5 indicates trend persistence (momentum regime);
H < 0.5 indicates mean reversion; H = 0.5 indicates random walk. This directly
informs whether trend-following (momentum) or mean-reversion patterns are more
likely to succeed in the current regime. Note: R/S must use returns (stationary),
not price levels (I(1)), which would bias H upward by ~0.4.
**Implementation:** `js/indicators.js` `calcHurst(closes, minWindow)`, line 212.
Constants: minWindow=10 [C]. Population sigma per Mandelbrot-Wallis (1969).
No Anis-Lloyd (1976) finite-sample correction (James-Stein shrinkage cited as
substitute). R-squared reported for regression quality.
**Consumed by:** Signal S-11 (Hurst regime classification: H > 0.6 trending,
H < 0.4 mean-reverting).
**Back-reference:** Stage 2, Section 2A (Doc 01 Fractals, Doc 03 Econophysics).

---

### I-10: Hill Tail Estimator

**Academic Lineage:** Statistics -> Extreme Value Theory -> Tail Index
**Key Papers:** Hill (1975); Drees and Kaufmann (1998) automatic k-selection.
**Formula:**
```
alpha = k / sum_{i=1}^{k} [ln(X_{(i)}) - ln(X_{(k+1)})]
SE = alpha / sqrt(k)
```
where `X_{(i)}` are order statistics (absolute returns, descending).
k = floor(sqrt(n)) by Drees-Kaufmann (1998) rule.
**Why in stock chart:** alpha < 4 indicates heavy tails (power-law decay in return
distribution), violating the Gaussian assumption underlying standard Bollinger Bands.
When detected, EVT-aware bands (I-3E) widen to reflect the true tail probability.
This prevents false breakout signals from treating 3-sigma events as extraordinary
when the true distribution has fatter tails.
**Implementation:** `js/indicators.js` `calcHillEstimator(returns, k)`, line 276.
Constants: minimum n = 10 [A], k = floor(sqrt(n)) [A] (Drees-Kaufmann).
**Consumed by:** I-3E (EVT Bollinger), tail risk assessment in backtester.
**Back-reference:** Stage 2, Section 2A (Doc 12, Extreme Value Theory).

---

### I-11: GPD Tail Fit

**Academic Lineage:** Statistics -> EVT -> Peaks Over Threshold
**Key Papers:** Pickands (1975); Balkema-de Haan (1974); Hosking and Wallis (1987)
PWM estimation.
**Formula:**
```
Threshold: u = 5th percentile of |returns| (top 5%)
Exceedances: y_i = |r_i| - u for |r_i| > u
PWM: b_0 = mean(y), b_1 = mean(y * rank/(N_u-1))
xi = 2 - b_0/(b_0 - 2*b_1)
sigma = 2*b_0*b_1 / (b_0 - 2*b_1)
VaR_p = u + (sigma/xi) * [((n/N_u)*(1-p))^(-xi) - 1]
```
PWM validity: xi < 0.5 (Hosking-Wallis 1987); beyond this, use MLE.
**Why in stock chart:** GPD provides theoretically justified extreme-risk quantiles.
The standard VaR formula assumes normality; GPD-based VaR captures the true tail
behavior of KRX returns, which typically have alpha ~ 3-4 (Student-t-like tails).
This is used to set more realistic stop-loss levels for extreme scenarios.
**Implementation:** `js/indicators.js` `calcGPDFit(returns, quantile)`, line 323.
Constants: quantile = 0.99 [A], threshold = top 5% [B], min n = 500 [B],
min exceedances = 20 [B]. PWM validity guard: xi clamped at 0.499.
**Consumed by:** EVT-informed stop-loss optimization (backtester).
**Back-reference:** Stage 2, Section 2A (Doc 12, EVT).

---

### I-12: CAPM Beta

**Academic Lineage:** Finance -> Asset Pricing -> Capital Asset Pricing Model
**Key Papers:** Sharpe (1964), Lintner (1965), Fama-MacBeth (1973);
Scholes-Williams (1977) thin-trading correction.
**Formula:**
```
beta = Cov(R_i - R_f, R_m - R_f) / Var(R_m - R_f)
alpha = mean(R_i - R_f) - beta * mean(R_m - R_f)
Scholes-Williams: beta_SW = (beta_{-1} + beta_0 + beta_{+1}) / (1 + 2*rho_m)
```
**Why in stock chart:** Beta measures systematic risk -- the stock's sensitivity to
market-wide movements. A beta of 1.5 means the stock moves 1.5% for every 1%
market move. Jensen's alpha (annualized excess return after accounting for beta)
measures skill-adjusted performance. Beta is used in the backtester (B-6) to
decompose pattern returns into systematic (beta) and idiosyncratic (alpha) components.
**Implementation:** `js/indicators.js` `calcCAPMBeta(stockCloses, marketCloses, window, rfAnnual)`, line 391.
Constants: window = KRX_TRADING_DAYS=250 [A], min observations = 60 [B],
thin-trading threshold = 10% zero-vol days [C].
Rf: KTB 10Y from bonds_latest.json, daily = (1 + Rf_annual/100)^(1/250) - 1.
**Consumed by:** Backtester B-6 (Jensen's alpha), financial panel display,
`_loadCAPMBeta()` per-stock beta loading.
**Back-reference:** Stage 2, Section 2B.1.1 (CAPM).

---

### I-13: Historical Volatility (Parkinson)

**Academic Lineage:** Statistics -> Volatility Estimation -> Range-Based
**Key Papers:** Parkinson (1980) "The Extreme Value Method for Estimating the
Variance of the Rate of Return." Approximately 5x more efficient than close-to-close.
**Formula:**
```
HV_daily = sqrt(1 / (4*n*ln2) * sum[ln(H_i/L_i)]^2)
HV_annual = HV_daily * sqrt(KRX_TRADING_DAYS)
```
**Why in stock chart:** High-low range captures intraday price variation that
close-to-close volatility misses. Parkinson's estimator is statistically more
efficient (lower variance for the same sample size), providing a better estimate
of true volatility for VRP computation (I-14).
**Implementation:** `js/indicators.js` `calcHV(candles, period)`, line 492.
Constants: period = 20 [B], min valid = max(n/2, 5) [B].
Annualization: sqrt(250) per KRX convention.
**Consumed by:** VRP (I-14), vol regime classification.
**Back-reference:** Stage 2, Section 2B.1.4 (IV/HV ratio).

---

### I-14: VRP (Variance Risk Premium)

**Academic Lineage:** Finance/Derivatives -> Volatility -> Risk Premium
**Key Papers:** Bollerslev (2009) "Expected Stock Returns and Variance Risk Premia."
**Formula:**
```
VRP = sigma_IV^2 - sigma_RV^2
    = (VKOSPI/100)^2 - HV_Parkinson^2
```
**Why in stock chart:** A positive VRP means option markets price in more volatility
than is realized -- options are "expensive." This signals elevated uncertainty and
often precedes volatility compression (mean reversion of vol). A negative VRP
signals options are cheap, potentially preceding volatility expansion.
VRP feeds into macro confidence (Factor F8) and the RORO composite.
**Implementation:** `js/indicators.js` `calcVRP(vkospi, hvAnnualized)`, line 536.
No tunable constants (pure formula with unit conversion).
**Consumed by:** Confidence Factor F8, RORO Factor R1 (via VKOSPI).
**Back-reference:** Stage 2, Section 2B.1.4 (Derivatives theory).

---

### I-15: WLS Regression (with Ridge)

**Academic Lineage:** Statistics -> Regression Analysis -> Generalized Least Squares
**Key Papers:** Aitken (1935) GLS; Hoerl and Kennard (1970) Ridge regression;
Reschenhofer et al. (2021) "Time-dependent WLS for Stock Returns."
**Formula:**
```
beta = (X'WX + lambda*I)^{-1} * X'Wy
```
where W = diag(weights), lambda = Ridge penalty (intercept excluded).
**Why in stock chart:** WLS with exponentially decaying weights gives more influence
to recent observations, capturing time-varying relationships. Ridge regularization
prevents multicollinearity-induced instability when predictors (quality, trend,
volume, volatility) are correlated. Reschenhofer et al. (2021) demonstrated that
WLS significantly outperforms OLS for stock return prediction.
**Implementation:** `js/indicators.js` `calcWLSRegression(X, y, weights, ridgeLambda)`, line 558.
Constants: ridgeLambda selected by GCV (I-16), min n = p+2 [A].
**Consumed by:** Backtester WLS regression prediction, OLS trend (I-17).
**Back-reference:** Stage 2, Section 2A (Doc 02, Doc 17).

---

### I-15a: HC3 Robust Standard Errors

**Academic Lineage:** Statistics -> Heteroskedasticity-Consistent Estimation
**Key Papers:** White (1980) heteroskedasticity-consistent estimator;
MacKinnon and White (1985) HC3 variant.
**Formula:**
```
Cov_HC3 = (X'WX)^{-1} * M * (X'WX)^{-1}
M_{jk} = sum_i X_{ij} * w_i^2 * e_i^2 / (1 - h_{ii})^2 * X_{ik}
h_{ii} = w_i * x_i' * (X'WX)^{-1} * x_i  (leverage)
```
**Why in stock chart:** Stock returns are heteroskedastic -- volatility changes over
time. Standard OLS t-statistics are invalid under heteroskedasticity. HC3 is the
most conservative (approximately pivotal) variant of White's family, producing
reliable t-statistics regardless of the heteroskedasticity pattern.
**Implementation:** Within `calcWLSRegression()`, line 636 of `js/indicators.js`.
Leverage cap: h_ii clamped at 0.99 for numerical stability.
**Consumed by:** t-statistics for backtester WLS coefficients.
**Back-reference:** Stage 2, Section 2A (Doc 17).

---

### I-15b: VIF Multicollinearity Diagnostic

**Academic Lineage:** Statistics -> Regression Diagnostics -> Collinearity
**Key Papers:** Marquardt (1970); Belsley, Kuh, and Welsch (1980) collinearity
diagnostics.
**Formula:**
```
VIF_j = 1 / (1 - R^2_j)
```
where R^2_j is from auxiliary regression of X_j on all other features.
VIF > 5: moderate collinearity. VIF > 10: severe.
**Implementation:** Within `calcWLSRegression()`, line 676 of `js/indicators.js`.
Full auxiliary OLS for each feature; feasible since p <= 10.
**Consumed by:** Diagnostic output; flagged features in regression results.
**Back-reference:** Stage 2, Section 2A (Doc 02).

---

### I-16: GCV Lambda Selection

**Academic Lineage:** Statistics -> Model Selection -> Generalized Cross-Validation
**Key Papers:** Golub, Heath, and Wahba (1979) "Generalized Cross-Validation as a
Method for Choosing a Good Ridge Parameter." Technometrics 21(2).
**Formula:**
```
GCV(lambda) = (RSS(lambda) / n) / (1 - tr(H_lambda) / n)^2
lambda_opt = argmin_{lambda in grid} GCV(lambda)
```
Uses Jacobi eigendecomposition (I-16a) for efficient trace computation.
Grid: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0].
Flatness check: if GCV varies < 1% across grid, default to lambda = 1.0.
**Implementation:** `js/indicators.js` `selectRidgeLambdaGCV(X, y, w, p)`, line 826.
**Consumed by:** Backtester WLS Ridge lambda selection.
**Back-reference:** Stage 2, Section 2A (Doc 17).

---

### I-16a: Jacobi Eigendecomposition

**Academic Lineage:** Mathematics -> Numerical Linear Algebra -> Symmetric Eigenproblems
**Key Papers:** Jacobi (1846); Golub and Van Loan (2013) "Matrix Computations" 4th ed.
**Formula:**
Iterative Givens rotations to diagonalize symmetric matrix A.
Convergence: max off-diagonal < 1e-12 or 100 iterations.
**Implementation:** `js/indicators.js` `_jacobiEigen(A, p)`, line 758.
**Consumed by:** GCV lambda selection (I-16).
**Back-reference:** Stage 2, Section 2A (Doc 01, Mathematics).

---

### I-17: OLS Trendline

**Academic Lineage:** Statistics -> Regression Analysis -> Trend Detection
**Key Papers:** Lo and MacKinlay (1999) "A Non-Random Walk Down Wall Street":
R-squared > 0.15 indicates trend presence, > 0.50 indicates strong trend.
**Formula:**
```
P_t = a + b * t + epsilon
slopeNorm = b / ATR(14)
direction = 'up' if slopeNorm > 0.05, 'down' if < -0.05, 'flat' otherwise
```
**Implementation:** `js/indicators.js` `calcOLSTrend(closes, window, atr14Last)`, line 912.
Constants: window = 20 [B], slopeNorm threshold = 0.05 [D].
**Consumed by:** Pattern trend context, confidence adjustments.
**Back-reference:** Stage 2, Section 2A (Doc 02, Doc 17).

---

### I-18: Matrix Inversion (Gauss-Jordan)

**Academic Lineage:** Mathematics -> Linear Algebra -> Direct Methods
**Key Papers:** Gauss-Jordan elimination with partial pivoting (Golub-Van Loan 2013).
**Formula:** Augmented matrix [A | I] -> row echelon -> [I | A^{-1}].
Singularity detection: |pivot| < 1e-12.
**Implementation:** `js/indicators.js` `_invertMatrix(m)`, line 950.
**Consumed by:** WLS regression (I-15), VIF (I-15b), GCV (I-16).
**Back-reference:** Stage 2, Section 2A (Doc 01).

---

### I-19: MACD (Moving Average Convergence Divergence)

**Academic Lineage:** Technical Analysis -> Momentum -> Appel
**Key Papers:** Appel (1979) "The Moving Average Convergence-Divergence Trading Method."
**Formula:**
```
MACD Line = EMA(12) - EMA(26)
Signal Line = EMA(9, MACD Line)
Histogram = MACD Line - Signal Line
```
**Why in stock chart:** MACD captures momentum by measuring the convergence and
divergence of two EMAs. When the MACD line crosses above the signal line (bullish
crossover), momentum shifts upward; below (bearish crossover), downward. The
histogram visualizes the rate of momentum change.
**Implementation:** `js/indicators.js` `calcMACD(closes, fast, slow, sig)`, line 993.
Constants: fast=12, slow=26, sig=9 [A] (Appel original).
P0-4 fix: match validMacd filter (null AND NaN).
**Consumed by:** Signal S-3 (MACD crossover), S-4 (MACD divergence), composites.
**Back-reference:** Stage 2, Section 2A (Doc 06).

---

### I-20: Stochastic Oscillator

**Academic Lineage:** Technical Analysis -> Momentum -> Lane
**Key Papers:** Lane (1984) "Lane's Stochastics."
**Formula:**
```
Raw %K = (Close - Lowest_Low(k)) / (Highest_High(k) - Lowest_Low(k)) * 100
%K = SMA(Raw %K, smooth)    (Slow %K)
%D = SMA(%K, dPeriod)
```
**Implementation:** `js/indicators.js` `calcStochastic(candles, kPeriod, dPeriod, smooth)`, line 1028.
Constants: kPeriod=14, dPeriod=3, smooth=3 [A].
**Consumed by:** Signal S-10 (Stochastic oversold/overbought), composite buy_wrStochOversold.
**Back-reference:** Stage 2, Section 2A (Doc 06).

---

### I-21: Stochastic RSI

**Academic Lineage:** Technical Analysis -> Composite Oscillator -> Chande-Kroll
**Key Papers:** Chande and Kroll (1994) "The New Technical Trader."
**Formula:**
```
StochRSI = (RSI - min(RSI, stochPeriod)) / (max(RSI, stochPeriod) - min(RSI, stochPeriod)) * 100
K = SMA(StochRSI, kPeriod)
D = SMA(K, dPeriod)
```
**Implementation:** `js/indicators.js` `calcStochRSI(closes, rsiPeriod, kPeriod, dPeriod, stochPeriod)`, line 1085.
Constants: rsiPeriod=14, kPeriod=3, dPeriod=3, stochPeriod=14 [A].
**Consumed by:** Signal S-9 (StochRSI oversold/overbought).
**Back-reference:** Stage 2, Section 2A (Doc 06).

---

### I-22: CCI (Commodity Channel Index)

**Academic Lineage:** Technical Analysis -> Deviation-Based Oscillator -> Lambert
**Key Papers:** Lambert (1980) "Commodity Channel Index."
**Formula:**
```
TP = (High + Low + Close) / 3
CCI = (TP - SMA(TP, n)) / (0.015 * MeanDeviation)
```
The constant 0.015 ensures ~70-80% of CCI values fall between -100 and +100.
**Implementation:** `js/indicators.js` `calcCCI(candles, period)`, line 1158.
Constants: period=20 [A], 0.015 [A] (Lambert original).
**Consumed by:** Signal S-13 (CCI oversold/overbought exit), composite buy_cciRsiDoubleOversold.
**Back-reference:** Stage 2, Section 2A (Doc 06).

---

### I-23: ADX / +DI / -DI

**Academic Lineage:** Technical Analysis -> Trend Strength -> Wilder
**Key Papers:** Wilder (1978) "New Concepts in Technical Trading Systems" -- Directional Movement System.
**Formula:**
```
+DM = max(High_t - High_{t-1}, 0) if > max(Low_{t-1} - Low_t, 0), else 0
-DM = max(Low_{t-1} - Low_t, 0) if > max(High_t - High_{t-1}, 0), else 0
+DI = Wilder_Smooth(+DM, n) / Wilder_Smooth(TR, n) * 100
-DI = Wilder_Smooth(-DM, n) / Wilder_Smooth(TR, n) * 100
DX = |+DI - -DI| / (+DI + -DI) * 100
ADX = Wilder_Smooth(DX, n)
```
**Why in stock chart:** ADX measures trend strength (not direction). ADX > 25
indicates a strong trend; ADX < 20 indicates a range-bound market. +DI/-DI
crossovers provide directional signals. The system uses ADX as a filter:
trend-following patterns receive higher confidence when ADX > 20.
**Implementation:** `js/indicators.js` `calcADX(candles, period)`, line 1187.
Constants: period=14 [A] (Wilder original).
**Consumed by:** Signal S-14 (ADX +DI/-DI crossover), composites buy_adxGoldenTrend, sell_adxDeadTrend.
**Back-reference:** Stage 2, Section 2A (Doc 06).

---

### I-24: Williams %R

**Academic Lineage:** Technical Analysis -> Momentum Oscillator -> Williams
**Key Papers:** Williams (1979) "How I Made One Million Dollars."
**Formula:**
```
%R = (Highest_High(n) - Close) / (Highest_High(n) - Lowest_Low(n)) * -100
```
Range: -100 (oversold) to 0 (overbought).
**Implementation:** `js/indicators.js` `calcWilliamsR(candles, period)`, line 1262.
Constants: period=14 [A].
**Consumed by:** Signal S-15 (Williams %R oversold/overbought), composite buy_wrStochOversold.
**Back-reference:** Stage 2, Section 2A (Doc 06).

---

### I-25: Theil-Sen Estimator

**Academic Lineage:** Robust Statistics -> Non-Parametric Regression -> Median Slopes
**Key Papers:** Theil (1950), Sen (1968) "Estimates of the Regression Coefficient
Based on Kendall's Tau."
**Formula:**
```
slope = median{(y_j - y_i) / (x_j - x_i) for all i < j}
intercept = median{y_i - slope * x_i}
```
**Why in stock chart:** Theil-Sen is breakdown-point-resistant: up to 29.3% of data
can be outliers without affecting the estimate. This is critical for trendline
fitting in patterns like triangles and wedges, where a few spike candles could
distort OLS-based trendlines. Used in candle target calibration (ATR multiples).
**Implementation:** `js/indicators.js` `calcTheilSen(xValues, yValues)`, line 1287.
No tunable constants (pure median computation).
**Consumed by:** Pattern target calibration (`CANDLE_TARGET_ATR`), trendline fitting in chart patterns.
**Back-reference:** Stage 2, Section 2A (Doc 07, Pattern Algorithms).

---

### I-26: EWMA Volatility

**Academic Lineage:** Finance/Risk -> Conditional Volatility -> RiskMetrics
**Key Papers:** J.P. Morgan RiskMetrics (1996); Bollerslev (1986) GARCH(1,1).
EWMA is the IGARCH special case (omega=0, alpha+beta=1).
**Formula:**
```
sigma^2_t = lambda * sigma^2_{t-1} + (1 - lambda) * r^2_{t-1}
r_t = ln(P_t / P_{t-1})
```
**Implementation:** `js/indicators.js` `calcEWMAVol(closes, lambda)`, line 1336.
Constants: lambda=0.94 [B] (RiskMetrics daily default -- KRX-specific calibration TBD).
Init: sample variance of first min(20, n-1) returns.
**Consumed by:** Vol regime classification (I-27), RORO composite (R1 via VKOSPI proxy).
**Back-reference:** Stage 2, Section 2B.1.4 (Doc 34, Volatility).

---

### I-27: Volatility Regime Classification

**Academic Lineage:** Finance/Regime -> Vol Ratio Classification -> Practitioner
**Key Papers:** Long-run EMA ratio approach (practitioner convention, no single
peer-reviewed source). Related: Hamilton (1989) HMM for formal regime classification.
**Formula:**
```
longRunEMA = alpha * sigma_t + (1-alpha) * longRunEMA_{t-1}, alpha=0.01
ratio = sigma_t / longRunEMA
regime = 'low' if ratio < 0.75, 'high' if ratio > 1.50, 'mid' otherwise
```
**Implementation:** `js/indicators.js` `classifyVolRegime(ewmaVol)`, line 1385.
Constants: VOL_REGIME_LOW=0.75 [D], VOL_REGIME_HIGH=1.50 [D], alpha=0.01 [B].
**Consumed by:** CUSUM threshold adaptation (I-29), composite signal buy_volRegimeOBVAccumulation.
**Back-reference:** Stage 2, Section 2A (Doc 34, Doc 21).

---

### I-28: Amihud ILLIQ

**Academic Lineage:** Market Microstructure -> Liquidity Measurement -> Amihud
**Key Papers:** Amihud (2002) "Illiquidity and Stock Returns." JFM 5(1): 31-56.
Kyle (1985) liquidity-price impact theory.
**Formula:**
```
ILLIQ = (1/D) * sum_{t=1}^{D} |r_t| / DVOL_t
logIlliq = log10(ILLIQ * 1e8)
```
Confidence discount: linear interpolation between logIlliq thresholds.
**Implementation:** `js/indicators.js` `calcAmihudILLIQ(candles, window)`, line 1430.
Constants: window=20 [B] #162, CONF_DISCOUNT=0.85 [C] #163,
LOG_HIGH=-1.0 [C] #164, LOG_LOW=-3.0 [C] #165.
**Consumed by:** Micro confidence Factor M1 (-15% max), adaptive slippage (B-11).
**Back-reference:** Stage 2, Section 2B.1.7 (Market Microstructure).

---

### I-29: Online CUSUM

**Academic Lineage:** Statistics -> Quality Control -> Sequential Analysis
**Key Papers:** Page (1954) "Continuous Inspection Schemes";
Roberts (1966) ARL optimization.
**Formula:**
```
z_t = (r_t - mu) / sigma
S^+_t = max(0, S^+_{t-1} + z_t - slack)
S^-_t = max(0, S^-_{t-1} - z_t - slack)
Breakpoint if S^+_t > threshold or S^-_t > threshold
```
Volatility-adaptive threshold (Doc 34 2.3):
high vol -> h=3.5, mid -> default, low -> h=1.5.
**Implementation:** `js/indicators.js` `calcOnlineCUSUM(returns, threshold, volRegime)`, line 1493.
Constants: threshold=2.5 [B], slack=0.5 [B], warmup=30 [B], alpha=2/31 [B].
**Consumed by:** Signal S-17 (CUSUM structural breakpoint), composite buy_cusumKalmanTurn.
**Back-reference:** Stage 2, Section 2A (Doc 21, Adaptive Pattern Modeling).

---

### I-30: Binary Segmentation

**Academic Lineage:** Statistics -> Structural Change Detection -> BIC-Based
**Key Papers:** Bai and Perron (1998) "Estimating and Testing Linear Models with
Multiple Structural Changes." Greedy binary segmentation approximation.
**Formula:**
```
BIC(segment) = n * log(max(RSS/n, 1e-12)) + 2 * log(n)
Split at k* = argmax_{k} [BIC(parent) - BIC(left) - BIC(right)]
Stop if delta_BIC <= 0 or maxBreaks reached.
```
**Implementation:** `js/indicators.js` `calcBinarySegmentation(returns, maxBreaks, minSegment)`, line 1586.
Constants: maxBreaks=3 [B], minSegment=30 [B].
**Consumed by:** Regime boundary detection, planned integration with confidence layers.
**Back-reference:** Stage 2, Section 2A (Doc 21).

---

### I-31: HAR-RV (Heterogeneous Autoregressive Realized Volatility)

**Academic Lineage:** Finance -> Volatility Forecasting -> Heterogeneous Market Hypothesis
**Key Papers:** Corsi (2009) "A Simple Approximate Long-Memory Model of Realized Volatility."
**Formula:**
```
RV_d = sum_{i=0}^{0} r^2_i             (daily RV)
RV_w = (1/5) * sum_{i=0}^{4} RV_{d,i}  (weekly average)
RV_m = (1/22) * sum_{i=0}^{21} RV_{d,i} (monthly average)
HAR-RV = beta_0 + beta_1*RV_d + beta_2*RV_w + beta_3*RV_m
```
**Why in stock chart:** The HAR-RV model captures the multi-scale volatility
dynamics arising from heterogeneous trader horizons: day traders, weekly rebalancers,
and monthly portfolio managers. This provides superior volatility forecasts compared
to GARCH for medium-term horizons.
**Implementation:** `js/indicators.js` `calcHAR_RV(candles)` via `IndicatorCache.harRV(idx)`, line 2213.
OLS variant (adequate for daily frequency, Corsi 2009).
**Consumed by:** Volatility forecasting, vol regime refinement.
**Back-reference:** Stage 2, Section 2B.1.4 (Doc 34).

---

## 3.2 Pattern Academic Derivation

### 3.2.1 Japanese Candlestick Tradition (Nison 1991, Morris 2006)

The 21+ candlestick patterns implemented in `js/patterns.js` originate from the
Japanese rice trading tradition, systematized by:

- **Nison (1991)** "Japanese Candlestick Charting Techniques" -- the seminal
  English-language text that introduced candlestick analysis to Western markets
- **Morris (2006)** "Candlestick Charting Explained" -- additional pattern detail
- **Bulkowski (2008)** "Encyclopedia of Candlestick Charts" -- empirical performance

#### Single-Bar Patterns (9 types)

| Pattern | Academic Basis | Key Threshold | ATR Role | Win Rate (KRX 5yr) |
|---------|---------------|---------------|----------|-------------------|
| Doji (P-1) | Nison (1991): body/range < 5% | DOJI_BODY_RATIO=0.05 [A] | Range significance | 42.0% |
| Hammer (P-2) | Morris (2006): shadow >= 2x body | SHADOW_BODY_MIN=2.0 [A] | ATR normalization | 45.2% |
| Inverted Hammer (P-3) | Morris (2006): upper shadow >= 2x | Same | Same | 48.9% |
| Hanging Man (P-4) | Nison (1991): hammer in uptrend | Same + trend context | Same | 59.4% |
| Shooting Star (P-5) | Morris (2006): upper shadow >= 2x in uptrend | Same + trend | Same | 59.2% |
| Dragonfly Doji (P-6) | Nison (1991): doji + long lower shadow | SPECIAL_DOJI_SHADOW_MIN=0.70 [B] | Same | 45.0% |
| Gravestone Doji (P-7) | Nison (1991): doji + long upper shadow | Same | Same | 62.0% |
| Bullish Marubozu (P-8) | Nison (1991): body >= 85% range | MARUBOZU_BODY_RATIO=0.85 [A] | Same | 41.8% |
| Bearish Marubozu (P-9) | Same | Same | Same | 57.7% |
| Spinning Top | Nison (1991): small body, both shadows | SPINNING_BODY_MIN/MAX [A] | Same | 43.1% |

All thresholds are ATR-normalized (Wilder 1978): `actual_threshold = constant * ATR(14)`.
This ensures Samsung (60,000 KRW) and a 1,000 KRW penny stock are evaluated with
equal sensitivity.

**Prospect Theory Integration**: Stop-loss widened by `PROSPECT_STOP_WIDEN = 1.12`
(K&T 1979 loss aversion, lambda=2.25); target compressed by
`PROSPECT_TARGET_COMPRESS = 0.89` (diminishing sensitivity).

#### Double-Bar Patterns (6 types)

| Pattern | Academic Basis | Key Constants | Win Rate (KRX 5yr) |
|---------|---------------|---------------|-------------------|
| Bullish Engulfing (P-10) | Nison (1991): 2nd body fully covers 1st | ENGULF_BODY_MULT=1.5 [C] | 41.3% |
| Bearish Engulfing (P-11) | Same | Same | 57.2% |
| Bullish Harami (P-12) | Nison (1991): 2nd body inside 1st | HARAMI_CURR_BODY_MAX=0.5 [B] | 44.1% |
| Bearish Harami (P-13) | Same | Same | 58.7% |
| Piercing Line (P-14) | Nison (1991): gap down + close above 50% | PIERCING_BODY_MIN=0.3 [B] | 50.2% |
| Dark Cloud (P-15) | Nison (1991): gap up + close below 50% | Same | 58.5% |
| Tweezer Bottom | Nison (1991): equal lows | TWEEZER_TOLERANCE=0.1 [C] | 46.5% |
| Tweezer Top | Same: equal highs | Same | 56.8% |

#### Triple-Bar Patterns (4+ types)

| Pattern | Academic Basis | Key Constants | Win Rate (KRX 5yr) |
|---------|---------------|---------------|-------------------|
| Three White Soldiers (P-16) | Nison (1991): three ascending long bodies | THREE_SOLDIER_BODY_MIN=0.5 [B] | 47.6% |
| Three Black Crows (P-17) | Same: three descending | Same | 57.5% |
| Morning Star (P-18) | Nison (1991): down + small body + up | STAR_BODY_MAX=0.12 [A] | 40.5% |
| Evening Star (P-19) | Same: up + small body + down | Same | 56.7% |
| Three Inside Up | Nison (1991): harami + confirm | THREE_INSIDE_CONFIRM_MIN=0.2 [B] | 42.4% |
| Three Inside Down | Same | Same | 55.1% |

**KRX Empirical Finding**: Sell patterns consistently outperform buy patterns by
10-15pp in win rate. This sell bias is consistent with prospect theory's loss
aversion (Stage 2, Section 2C) and KRX structural features: T+2 settlement,
price limits, and retail-dominated trading (Doc 20).

### 3.2.2 Western Chart Pattern Theory (Edwards-Magee 1948, Bulkowski 2005)

The 9+ chart patterns are derived from:

- **Edwards and Magee (1948)** "Technical Analysis of Stock Trends" -- original chart
  pattern classification
- **Bulkowski (2005)** "Encyclopedia of Chart Patterns" -- empirical performance
  statistics from 20+ years of data
- **Levy (1971)** -- early quantitative validation of chart patterns

| Pattern | Academic Basis | Detection Method | Key Constants |
|---------|---------------|------------------|---------------|
| Double Bottom (P-20) | Edwards-Magee (1948) | Two swing lows + neckline break | NECKLINE_BREAK_ATR_MULT=0.5 [B] |
| Double Top (P-21) | Same | Two swing highs + neckline break | Same |
| Head & Shoulders (P-22) | Bulkowski (2005): avg 65d, P75=85d | Left shoulder + head + right shoulder | HS_WINDOW=120 [C], HS_SHOULDER_TOLERANCE=0.15 [B] |
| Inverse H&S (P-23) | Same (inverted) | Same (inverted) | Same |
| Ascending Triangle (P-24) | Edwards-Magee (1948) | Flat resistance + rising support | TRIANGLE_BREAK_ATR_MULT=0.3 [B] |
| Descending Triangle (P-25) | Same | Flat support + falling resistance | Same |
| Symmetric Triangle (P-26) | Same | Converging trendlines | Same |
| Rising Wedge (P-27) | Bulkowski (2005) | Converging upward trendlines | Same |
| Falling Wedge (P-28) | Same | Converging downward trendlines | Same |
| Channel (P-29) | Murphy (1999), Edwards-Magee (2018) | Parallel trendlines | CHANNEL_TOUCH_TOL=0.25 [C] |
| Cup and Handle | O'Neil (1988) | Rounded bottom + handle consolidation | Custom detection |

**Breakout Confirmation**: Bulkowski (2005) documented that confirmed H&S patterns
have 83% success rate vs 35% unconfirmed. CheeseStock applies
`NECKLINE_UNCONFIRMED_PENALTY = 15` [B] for unconfirmed patterns.

**Target Calculation**: Chart pattern targets use the measured move method:
`target = breakout_price +/- pattern_height`. Capped by:
- `CHART_TARGET_ATR_CAP = 6` [B] -- EVT 99.5% VaR bound (Doc 12 4.3)
- `CHART_TARGET_RAW_CAP = 2.0` [B] -- Bulkowski P80

### 3.2.3 Dow Theory: Support and Resistance

**Dow (1900s)**, systematized by Hamilton (1922) and Rhea (1932):

Prices tend to find support (buying interest) and resistance (selling interest) at
previously significant price levels. CheeseStock implements S/R detection via:

1. **Price clustering**: ATR*0.5 tolerance, minimum 2 touches, maximum 10 levels
2. **Touch strength**: More touches -> higher strength (0 to 1.0 scale)
3. **Confluence**: Pattern stop/target within ATR of S/R -> confidence +3*strength

**Valuation S/R** (Rothschild-Stiglitz 1976 screening theory):
Fundamental valuation thresholds (target prices from PER/PBR) serve as behavioral
anchors. Strength = 0.6, range = +/-30% (matching KRX daily price limit).

**52-Week High/Low S/R** (George-Hwang 2004):
Strength = 0.8, virtual touches = 3. George and Hwang showed 52-week high proximity
explains 70% of momentum returns through anchoring bias.

### 3.2.4 Mathematical Methods in Pattern Detection

**ATR Normalization** (Wilder 1978):
Every threshold is expressed as ATR(14) multiples. Fallback: `close * 0.02`
(median KRX large-cap daily ATR/close ratio). Timeframe-specific fallbacks in
`ATR_FALLBACK_BY_TF` (random walk sqrt scaling for weekly/monthly).

**Theil-Sen Trendline Fitting** (Theil 1950, Sen 1968):
Used for chart pattern trendline fitting (triangles, wedges, channels) due to
breakdown-point resistance to outlier candles.

**Quality Score** (PCA-weighted, V6-FIX calibration):
```
Q = 0.30*body + 0.22*volume + 0.21*trend + 0.15*shadow + 0.12*extra
```
Weights from PCA variance-explained + logistic regression on KRX data.
Nison (1991): "the real body is the most important element" (body = PC1 max loading).

**Beta-Binomial Posterior Win Rates** (Efron-Morris 1975):
```
theta_post = (n * theta_raw + N0 * mu_grand) / (n + N0)
N0 = 35 (Empirical Bayes optimal from 5yr 545K observations)
```
Separate grand means for candle (~43%) and chart (~45%) pattern categories.

**AMH Temporal Decay** (Lo 2004, McLean-Pontiff 2016):
```
decay = exp(-lambda * daysSince)
KOSDAQ: lambda=0.00367 (half-life 189 days)
KOSPI:  lambda=0.00183 (half-life 378 days)
```

---

## 3.3 Signal and Composite Lineage

### 3.3.1 Individual Indicator Signals (31 signals)

Each signal is derived from a specific indicator and has a clear academic basis:

#### Trend Signals

| Signal ID | Name | Indicator | Rule | Academic Basis |
|-----------|------|-----------|------|---------------|
| S-1 | MA Crossover | MA(5), MA(20) | MA(5) crosses MA(20) | Murphy (1999) Ch.9: dual MA crossover system |
| S-2 | MA Alignment | MA(5/20/60) | MA(5)>MA(20)>MA(60) or reverse | Multiple MA system: trend confirmation |
| S-3 | MACD Crossover | MACD line, Signal | MACD crosses Signal line | Appel (1979) original MACD signal |
| S-4 | MACD Divergence | MACD, Price | Price new high + MACD lower high | Murphy (1999) Ch.10: regular + hidden divergence |
| S-8 | Ichimoku Signals | Cloud, TK | Price breaks cloud; TK cross | Hosoda (1969) saneki-hoten/gyakuten |
| S-14 | ADX Crossover | +DI, -DI, ADX | +DI crosses -DI when ADX>20 | Wilder (1978) Directional Movement System |
| S-17 | CUSUM Break | Returns | CUSUM exceeds adaptive threshold | Page (1954), Roberts (1966) |
| S-18 | Vol Regime Change | EWMA Vol | Regime transition detected | RiskMetrics (1996) |

#### Oscillator Signals

| Signal ID | Name | Indicator | Rule | Academic Basis |
|-----------|------|-----------|------|---------------|
| S-5 | RSI Zones | RSI(14) | RSI exits <30 (buy) or >70 (sell) | Wilder (1978) overbought/oversold |
| S-6 | RSI Divergence | RSI, Price | Price-RSI divergence | Murphy (1999): momentum vs price |
| S-9 | StochRSI | StochRSI(14) | K exits oversold/overbought | Chande-Kroll (1994) |
| S-10 | Stochastic | %K, %D | %K crosses %D at extremes | Lane (1984) |
| S-13 | CCI Exit | CCI(20) | CCI exits <-100 (buy) or >100 | Lambert (1980) |
| S-15 | Williams %R | %R(14) | %R < -80 (oversold) | Williams (1979) |

#### Volatility and Volume Signals

| Signal ID | Name | Indicator | Rule | Academic Basis |
|-----------|------|-----------|------|---------------|
| S-7 | BB Signals | BB(20,2) | Lower bounce / upper break / squeeze | Bollinger (2001) |
| S-11 | Hurst Regime | Hurst(R/S) | H>0.6 trending, H<0.4 mean-reverting | Mandelbrot (1963), Peters (1994) |
| S-12 | Kalman Turn | Kalman Filter | Slope direction change | Kalman (1960) |
| S-16 | ATR Expansion | ATR(14) | ATR ratio > 1.5 vs 20-bar EMA | Wilder (1978), Parkinson (1980) |
| S-19 | Volume Breakout | Volume, MA(20) | Volume/MA > threshold | Granville (1963) |
| S-20 | OBV Divergence | OBV, Price | Price-OBV divergence | Granville (1963), Murphy (1999) |

#### Derivatives and Cross-Asset Signals

| Signal ID | Name | Data Source | Rule | Academic Basis |
|-----------|------|-------------|------|---------------|
| S-21 | Basis Signal | Futures basis | Excess contango/backwardation | Bessembinder-Seguin (1993) |
| S-22 | PCR Signal | Put/Call ratio | PCR extreme contrarian | Pan-Poteshman (2006) |
| S-23 | Flow Signal | Investor data | Foreign+Institutional alignment | Choe-Kho-Stulz (2005) |
| S-24 | ERP Signal | Bond+Equity | ERP z-score extreme | Fed Model, Asness (2003) |
| S-25 | ETF Sentiment | ETF data | Leverage ratio contrarian | Cheng-Madhavan (2009) |
| S-26 | Short Interest | Short selling | Market short ratio regime | Desai et al. (2002) |
| S-27 | IV/HV Discount | VKOSPI, HV | IV/HV > 1.5 dampen confidence | Simon-Wiggins (2001) |
| S-28 | VKOSPI Regime | VKOSPI | Crisis/High/Normal/Low | Whaley (2009) |
| S-29 | Expiry Discount | Calendar | D-2 to D+1 near expiry | Stoll-Whaley (1987) |
| S-30 | Crisis Severity | Multiple | Multi-factor crisis composite | DCC-GARCH, Engle (2002) |
| S-31 | Entropy Damping | Signals | Shannon entropy normalization | Shannon (1948) |

### 3.3.2 Composite Signals (30 definitions)

Composite signals combine multiple individual signals using a windowed coincidence
approach. The academic justification for each composite is multi-source confirmation:
two independent indicators confirming the same directional bias significantly
increases the probability of a correct prediction.

#### Tier 1 Composites (10 definitions -- strongest confirmation)

| ID | Components | Academic Chain | Base Confidence |
|---|---|---|---|
| strongBuy_hammerRsiVolume | Hammer + RSI oversold exit | Nison (1991) + Wilder (1978) | 61 [C-8 calibrated] |
| strongSell_shootingMacdVol | Shooting Star + MACD bearish | Nison (1991) + Appel (1979) | 69 |
| buy_doubleBottomNeckVol | Double Bottom + Volume breakout | Edwards-Magee (1948) + Granville (1963) | 68 |
| sell_doubleTopNeckVol | Double Top + Volume selloff | Edwards-Magee (1948) | 75 |
| buy_ichimokuTriple | Cloud breakout + TK cross | Hosoda (1969) saneki-hoten | 60 |
| sell_ichimokuTriple | Cloud breakdown + TK cross | Hosoda (1969) saneki-gyakuten | 65 |
| buy_goldenMarubozuVol | Golden Cross + Marubozu | Murphy (1999) + Nison (1991) | 60 |
| sell_deadMarubozuVol | Dead Cross + Marubozu | Murphy (1999) + Nison (1991) | 68 |
| buy_adxGoldenTrend | Golden Cross + ADX bullish | Murphy (1999) + Wilder (1978) | 58 |
| sell_adxDeadTrend | Dead Cross + ADX bearish | Murphy (1999) + Wilder (1978) | 65 |

#### Tier 2 Composites (12+ definitions -- moderate confirmation)

| ID | Components | Academic Chain | Base Confidence |
|---|---|---|---|
| buy_goldenCrossRsi | Golden Cross + RSI/Volume | Murphy + Wilder | 58 |
| sell_deadCrossMacd | Dead Cross + MACD/RSI | Murphy + Appel | 58 |
| buy_hammerBBVol | Hammer + BB lower bounce | Nison + Bollinger | 63 |
| sell_shootingStarBBVol | Shooting Star + BB upper break | Nison + Bollinger | 69 |
| buy_morningStarRsiVol | Morning Star + RSI oversold | Nison + Wilder | 58 |
| buy_engulfingMacdAlign | Engulfing + MACD cross | Nison + Appel | 48 |
| buy_cciRsiDoubleOversold | CCI exit + RSI exit | Lambert + Wilder | — |
| neutral_squeezeExpansion | BB squeeze + ATR expansion | Bollinger (2001) squeeze | — |
| buy_cusumKalmanTurn | CUSUM break + Kalman upturn | Page (1954) + Kalman (1960) | — |
| buy_volRegimeOBVAccumulation | Vol regime high + OBV div | RiskMetrics + Granville | — |
| buy_flowPcrConvergence | Flow aligned buy + PCR/basis | Choe-Kho-Stulz + Pan-Poteshman | — |
| buy_shortSqueezeFlow | Short squeeze + flow foreign | Lamont-Thaler + Kang-Stulz | — |

#### Tier 3 Composites (2 definitions -- basic confirmation)

| ID | Components | Academic Chain | Base Confidence |
|---|---|---|---|
| buy_bbBounceRsi | BB lower bounce + RSI/Volume | Bollinger + Wilder | — |
| buy_wrStochOversold | Williams %R + Stochastic | Williams + Lane | — |

**Window parameter**: All composites use window=5 bars [D heuristic]. Nison (1991)
states "confirmation within a few sessions" -- 5 bars (1 trading week on KRX)
provides sufficient but not excessive time for signal convergence.

---

## 3.4 Confidence Chain (7 Layers)

Each confidence adjustment layer has a specific academic basis and bounded magnitude.
The layers are applied sequentially and multiplicatively.

### CONF-Layer1: Macro Confidence (11 factors)

**Academic Foundation:** IS-LM (Hicks 1937), Taylor Rule (Taylor 1993), Mundell-Fleming
(Mundell 1963), Stovall (1996) sector rotation, NSS yield curve (Nelson-Siegel 1987),
Gilchrist-Zakrajsek (2012) credit spreads.

| Factor | Theory | Paper | Magnitude | Tier |
|--------|--------|-------|-----------|------|
| F1 Business Cycle | IS-LM aggregate demand | Hicks (1937) | +/-6-10% | [B] |
| F1a Stovall Sector | Sector-cycle sensitivity | Stovall (1996) | Sector-specific * 0.5x | [C] |
| F2 Yield Curve | Term structure signaling | Harvey (1986) | +/-3-12% | [B] |
| F3 Credit Regime | Credit spread stress | Gilchrist-Zakrajsek (2012) | -7 to -18% buy | [B] |
| F4 Foreign Signal | Capital flows | Mundell (1963) | +/-5% | [C] |
| F5 Pattern Override | Cycle-pattern interaction | Nison + IS-LM | +6-12% conditional | [D] |
| F6 MCS v2 | Macro composite | Docs 29, 30 | +/-10% max | [C] |
| F7 Taylor Gap | Monetary policy stance | Taylor (1993) | +/-5% | [B] |
| F8 VRP/VIX | Vol risk premium | Carr-Wu (2009) | -3 to -7% | [B] |
| F9 Rate Diff | Mundell-Fleming | Mundell (1963) | +/-5% | [B] |
| F10 Rate Beta | Interest rate sensitivity | Damodaran (2012) | Sector-specific | [C] |
| F11 CLI-CCI Gap | Leading vs coincident | OECD methodology | +/-4% | [C] |

**Clamp:** [0.70, 1.25]. Implementation: `_applyMacroConfidenceToPatterns()`.

### CONF-Layer2: Micro Confidence (3 factors)

**Academic Foundation:** Amihud (2002), Jensen-Meckling (1976), Miller (1977),
Diamond-Verrecchia (1987).

| Factor | Theory | Paper | Magnitude | Tier |
|--------|--------|-------|-----------|------|
| M1 Amihud ILLIQ | Liquidity discount | Amihud (2002) | -15% max | [A] |
| M2 HHI Boost | Concentration mean-reversion | Jensen-Meckling (1976) | +10% * HHI | [C] |
| M3 Short Ban | Price discovery impairment | Miller (1977), D-V (1987) | -10 to -30% | [B] |

**Clamp:** [0.55, 1.15]. Implementation: `_applyMicroConfidenceToPatterns()`.

### CONF-Layer3: Derivatives Confidence (7 factors)

**Academic Foundation:** Bessembinder-Seguin (1993), Pan-Poteshman (2006),
Choe-Kho-Stulz (2005), Whaley (2009).

| Factor | Theory | Paper | Magnitude | Tier |
|--------|--------|-------|-----------|------|
| D1 Futures Basis | Cost-of-carry sentiment | Bessembinder-Seguin (1993) | +/-4-7% | [B] |
| D2 PCR Contrarian | Put/Call extreme | Pan-Poteshman (2006) | +/-6% | [B] |
| D3 Investor Alignment | Foreign+Institutional | Choe-Kho-Stulz (2005) | +/-8% | [B] |
| D4 ETF Sentiment | Leverage ratio | Cheng-Madhavan (2009) | +/-4% | [C] |
| D5 Short Ratio | Market short regime | Desai et al. (2002) | +6% high SIR | [C] |
| D6 ERP | (in signalEngine) | — | — | — |
| D7 USD/KRW | FX-export sensitivity | Doc 28 | +/-5% | [C] |

**Clamp:** [0.70, 1.30]. Implementation: `_applyDerivativesConfidenceToPatterns()`.

### CONF-Layer4: Merton DD (1 factor)

**Academic Foundation:** Merton (1974) structural model, Bharath-Shumway (2008) naive DD.

| DD Range | Buy Adjustment | Sell Adjustment |
|----------|---------------|-----------------|
| DD < 1.0 | x0.75 | No change |
| DD 1.0-1.5 | x0.82 | No change |
| DD 1.5-2.0 | x0.90 | No change |
| DD 2.0-3.0 | x0.95 | No change |
| DD > 3.0 | No change | No change |

Financial sector excluded (debt = operating assets).
**Clamp:** [0.75, 1.15]. Implementation: `_applyMertonDDToPatterns()`.

### CONF-Layer5: Phase 8 Combined (4 factors)

**Academic Foundation:** Hamilton (1989) HMM, Kang-Stulz (1997), Simon-Wiggins (2001).

| Factor | Theory | Magnitude | Tier |
|--------|--------|-----------|------|
| P8-1 MCS v2 | Macro composite | +5% strong alignment | [C] |
| P8-2 HMM Regime | Markov regime | Regime-specific multiplier | [B] |
| P8-3 Foreign Momentum | Per-stock flow | +3% for alignment | [C] |
| P8-4 IV/HV Ratio | Vol overpricing | -7 to -10% | [B] |

**Clamp:** [10, 100]. Implementation: `_applyPhase8ConfidenceToPatterns()`.

### CONF-Layer6: RORO Regime (5-factor composite)

**Academic Foundation:** Baele, Bekaert, and Inghelbrecht (2010) RFS.

5-factor composite with weights: VKOSPI 0.30, AA- credit 0.05, HY spread 0.10,
USD/KRW 0.20, MCS 0.15, Investor alignment 0.15.

Hysteresis: entry +/-0.25, exit +/-0.10.

**Clamp:** [0.92, 1.08]. Implementation: `_applyRORORegimeToPatterns()`.

### CONF-Layer7: Composite Signal Adjustments

Pattern-specific behavioral overrides applied within `_applyMacroConditionsToSignals()`.
Adjustments are composite-signal-specific, not indicator-level.

### Confidence Integrity Audit

| Criterion | Status | Notes |
|-----------|--------|-------|
| No circular adjustments | PASS | Each layer is independent, sequential |
| No double-counting | PARTIAL | F3/R2a credit overlap mitigated by R2a weight 0.20->0.05 |
| Clamp prevents runaway | PASS | Each layer bounded; final clamp [10, 100] |
| Asymmetric justified | PASS | Buy/sell asymmetry matches KRX sell bias |
| Seed data protection | PASS | DD requires dart/hardcoded source |

---

## 3.5 Backtesting Methodology

### 3.5.1 WLS Regression Prediction

**Academic Basis:** Reschenhofer et al. (2021) demonstrated WLS superiority over OLS
for stock return prediction. The system uses time-decaying weights (exponential)
to give more influence to recent pattern occurrences.

```
beta = (X'WX + lambda*I)^{-1} * X'Wy
W = diag(exp(-decay * (T-t)))
```

Features: [intercept, quality, trend, volume_ratio, volatility_ratio].
Ridge lambda selected by GCV (I-16).
HC3 robust standard errors for valid inference.

### 3.5.2 HC3 Standard Errors

**Academic Basis:** MacKinnon and White (1985) showed HC3 is approximately pivotal
(valid t-statistics regardless of sample size or heteroskedasticity pattern).

HC3 is preferred over HC0 (White 1980) and HC1 because:
- HC0 is downward-biased in small samples
- HC1 applies a degrees-of-freedom correction but is not pivotal
- HC3 divides by (1 - h_ii)^2, which accounts for high-leverage observations

Implementation: leverage h_ii capped at 0.99 to prevent numerical instability.

### 3.5.3 IC Measurement (Spearman Rank Correlation)

**Academic Basis:** Grinold and Kahn (2000) "Active Portfolio Management."

```
IC = corr(rank(predicted), rank(actual))
```

- Spearman (non-parametric): robust to non-normal returns (Cont 2001)
- Minimum 5 pairs required
- IC > 0.02: minimal non-trivial predictive power (Qian et al. 2007)
- IC > 0.05: operationally significant
- IC > 0.10: strong

**Tied ranks:** Averaged ties per Kendall and Gibbons (1990). Pearson-of-ranks formula
(not the 6*d^2 shortcut, which is invalid with ties).

### 3.5.4 Rolling OOS IC

**Academic Basis:** Lo (2002) "The Statistics of Sharpe Ratios" -- in-sample statistics
are upward-biased. Rolling OOS IC uses non-overlapping windows of size `minWindow=12`
to compute IC on data the model has never seen.

### 3.5.5 Walk-Forward Validation (WFE)

**Academic Basis:** Pardo (2008) "The Evaluation and Optimization of Trading Strategies";
Bailey and Lopez de Prado (2014) purge-gap methodology.

```
WFE = OOS_meanReturn / IS_meanReturn * 100
```

- Expanding window, 4 folds (6 when n >= 500, Bailey-Lopez de Prado 2014)
- Purge gap = 2x horizon (AR(1) half-life guard)
- OOS ratio: ~20% (practitioner convention)
- WFE >= 50: robust, 30-50: marginal, < 30: overfit suspect
- Reliability gating: WFE < 30 caps tier at C

### 3.5.6 BH-FDR Multiple Testing Correction

**Academic Basis:** Benjamini and Hochberg (1995) "Controlling the False Discovery
Rate." JRSS-B 57(1): 289-300.

When testing M pattern-horizon pairs simultaneously, the probability of at least one
false positive increases with M. BH-FDR controls the expected proportion of false
discoveries:

```
Sort p-values: p_(1) <= p_(2) <= ... <= p_(M)
Reject H_0(i) if p_(i) <= (i/M) * alpha
```

Cross-stock correction: Harvey-Liu-Zhu (2016) sqrt(N) adjustment for multiple assets.

### 3.5.7 Hansen SPA Test

**Academic Basis:** Hansen (2005) "A Test for Superior Predictive Ability." Econometrica.

Tests whether the best model in a set has genuine predictive power, or whether its
apparent superiority is due to data snooping:

```
H_0: max_k E[d_k] <= 0  (no model beats the benchmark)
H_A: max_k E[d_k] > 0  (at least one model has superior predictive ability)
```

where `d_k = returns(model_k) - returns(benchmark)`.

### 3.5.8 Survivorship Bias Correction

**Academic Basis:** Elton, Gruber, and Blake (1996) "Survivorship Bias and Mutual Fund
Performance."

Pattern backtest results on surviving stocks overstate true performance because
failed/delisted stocks are excluded. The correction:

```
adjusted_WR = raw_WR + delta_WR(pattern, horizon)
```

where `delta_WR` is estimated from `survivorship_correction.json`, loaded in
`_loadSurvivorshipCorrection()`. Priority: per-pattern per-horizon > per-horizon > global median.

### 3.5.9 Transaction Cost Model

**Academic Basis:** Kyle (1985) sqrt(h) slippage scaling.

```
Fixed cost: (commission 0.03% + tax 0.18%) / h
Variable cost: slippage 0.10% / sqrt(h)
Total: _horizonCost(h) = fixedCost(h) + variableCost(h)
```

Adaptive slippage per Amihud (2002) ILLIQ segments:
| Segment | Slippage |
|---------|----------|
| KOSPI large | 0.04% |
| KOSPI mid | 0.10% |
| KOSDAQ large | 0.15% |
| KOSDAQ small | 0.25% |

### 3.5.10 Reliability Tier System (A/B/C/D)

Composite gating that synthesizes IC, WFE, BH-FDR, and sample size:

| Tier | Requirements | Interpretation |
|------|-------------|----------------|
| A | IC > 0.02, alpha >= 5pp, n >= 100, profitFactor >= 1.3, WFE >= 50, BH-FDR pass | Robust, actionable |
| B | IC > 0.01, alpha >= 3pp, n >= 50, WFE >= 30, BH-FDR pass | Moderate evidence |
| C | alpha > 0, n >= 30 | Weak evidence, exploratory |
| D | Below C thresholds | Insufficient statistical evidence |

WFE < 30 caps tier at C (overfit suspect, regardless of other metrics).
IC = null (insufficient data) is treated as "pass" (distinct from IC = 0).

### 3.5.11 Jensen's Alpha (Backtester)

**Academic Basis:** Jensen (1968), Sharpe (1964) CAPM decomposition.

```
alpha = mean(R_pattern) - beta * mean(R_market) - Rf
```

Annualized: `alpha_annual = alpha * KRX_TRADING_DAYS`.
Provides risk-adjusted pattern performance: positive alpha indicates the pattern
generates returns beyond what beta-adjusted market exposure would explain.

### 3.5.12 LinUCB Contextual Bandit

**Academic Basis:** Li et al. (2010) "A Contextual-Bandit Approach to Personalized
News Article Recommendation." WWW 2010.

```
p_a = theta_a' * x + alpha * sqrt(x' * A_a^{-1} * x)
```

where `theta_a` is the learned weight vector for action `a`, `x` is the context
vector, and the second term is the upper confidence bound. In CheeseStock, the
"actions" are pattern types and the "context" includes quality, trend, volume,
and volatility features.

RL policy loaded from `rl_policy.json`. Gating: if `mean_ic_adjusted < 0`, the
entire RL policy is rejected as anti-predictive (IC negative = worse than random).

---

## 3.6 Cross-Stage Lineage Summary

### From Stage 2 to Stage 3: The Complete Chain

```
[Stage 2A: Economics]
  IS-LM -----------> Taylor Gap ---------> CONF-F7
  Mundell-Fleming --> Rate Diff ----------> CONF-F9
  Stovall ---------> Sector Rotation -----> CONF-F1a
  HHI -------------> Mean-Rev Boost ------> CONF-M2

[Stage 2B: Finance]
  CAPM -------------> calcCAPMBeta() -----> Beta, Alpha (I-12)
  Merton DD --------> _calcNaiveDD() ----> CONF-Layer4
  VRP --------------> calcVRP() ----------> I-14
  BSM IV -----------> VKOSPI regime ------> S-28
  Cost-of-Carry ----> Basis signal -------> S-21
  Kyle Lambda ------> Horizon cost -------> B-10
  Amihud ILLIQ -----> calcAmihudILLIQ() --> I-28, CONF-M1
  RORO -------------> 5-factor composite -> CONF-Layer6

[Stage 2C: Psychology]
  Prospect Theory --> Stop/Target --------> PROSPECT_STOP_WIDEN
  Disposition ------> 52W S/R ------------> SR_52W_STRENGTH
  Anti-Predictor ---> WR gate ------------> PATTERN_WR_KRX
  Herding ----------> CSAD data ----------> (planned active use)
  Loss Aversion ----> KRX sell bias ------> Empirical WR asymmetry

[Stage 3: Internal]
  Wilder (1978) -----> ATR normalization -> ALL patterns
  Nison (1991) ------> 21+ candle ptn ----> P-1 to P-19
  Edwards-Magee -----> 9 chart ptn -------> P-20 to P-28
  Hosoda (1969) -----> Ichimoku signals --> S-8
  Appel (1979) ------> MACD signals ------> S-3, S-4
  Bollinger (2001) --> BB signals ---------> S-7
  Mandelbrot (1963) -> Hurst regime ------> S-11
  Page (1954) -------> CUSUM break -------> S-17
  Grinold-Kahn -----> Spearman IC --------> B-1
  Pardo (2008) ------> Walk-Forward ------> B-3
  BH (1995) ---------> FDR correction ---> B-4
  Hansen (2005) -----> SPA test ----------> B-5
```

### Theory-Practice Coherence Scores (Stage 3)

| Component | Coverage | Fidelity | Citation | Score |
|-----------|----------|----------|----------|-------|
| Indicators (31) | 90% | 92% | 90% | **91** |
| Patterns (45+) | 85% | 88% | 82% | **85** |
| Signals (31) | 90% | 85% | 80% | **85** |
| Composites (30) | 80% | 78% | 75% | **78** |
| Confidence (7 layers) | 95% | 85% | 88% | **89** |
| Backtesting (12 methods) | 85% | 90% | 88% | **88** |
| **Stage 3 Overall** | | | | **86** |

---

## Appendix 3.I: Constant Classification Summary

All constants referenced in this document follow the 5-tier system from
core_data/22_learnable_constants_guide.md:

| Tier | Count (Stage 3) | Examples |
|------|----------------|---------|
| [A] Academic Fixed | ~40 | DOJI_BODY_RATIO=0.05, RSI period=14, MACD 12/26/9 |
| [B] Academic Tunable | ~35 | SHADOW_BODY_MIN=2.0, ATR period=14, Kalman Q=0.01 |
| [C] Calibratable | ~30 | ENGULF_BODY_MULT=1.5, ILLIQ thresholds, CUSUM threshold=2.5 |
| [D] Heuristic | ~20 | Vol regime cutoffs, composite window=5, slopeNorm threshold |
| [E] Deprecated | 0 | None currently active |

## Appendix 3.II: KRX-Specific Adaptations

| Adaptation | Standard | KRX Modification | Rationale |
|------------|----------|------------------|-----------|
| KRX_TRADING_DAYS | 252 (NYSE) | 250 | Fewer KRX holidays |
| VIX_VKOSPI_PROXY | — | 1.12 | VKOSPI ~= VIX * 1.12 (Whaley 2009) |
| Stovall dampening | 1.0x | 0.5x | US S&P empirical, KRX unvalidated |
| KRX_COST | ~0.10% (US) | 0.31% | Higher tax 0.18% + wider spreads |
| Short ban periods | N/A | 2020-03, 2023-11 | Miller (1977) overpricing during bans |
| ATR fallback daily | close * 0.015 | close * 0.020 | KRX median ATR/close ~2.1% |
| N0 (EB shrinkage) | — | 35 | Empirical Bayes from 545K KRX patterns |
| AMH lambda KOSDAQ | — | 0.00367 | Faster alpha decay in small-cap market |
| AMH lambda KOSPI | — | 0.00183 | Slower alpha decay in large-cap market |

---

*This document provides the complete academic lineage for every indicator, pattern,
signal, confidence adjustment, and backtesting method implemented in CheeseStock's
Technical Analysis layer. Each formula traces backward to its Stage 2 academic
discipline and forward to its implementation in JavaScript.*

*Version: V8 (2026-04-08) | Stage 3 | Color: Emerald Teal #1A3D35*
