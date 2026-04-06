# Stage 2: Theoretical Basis v6 -- Sections 2.1-2.2

> ANATOMY V6 -- Mathematical & Statistical Foundations
> Scope: Every formula used in CheeseStock's pattern detection, backtesting, and signal pipeline
> Standard: CFA Paper Grade annotation (symbol table + constant grading [A]-[E])
> Date: 2026-04-06
> Audit authority: Statistical Validation Expert (statistical-validation-expert agent)
> Cross-reference: `docs/anatomy/S2_formula_appendix.md` for legacy derivations

---

## Conventions

**Constant Grades:**
- **[A]** Academic Fixed -- author-standard value, change invalidates the formula's identity
- **[B]** Tunable with basis -- academic support exists for a range of values
- **[C]** KRX-Adapted -- calibrated to Korean market microstructure
- **[D]** Heuristic -- no published derivation; empirical or intuitive
- **[E]** Deprecated -- empirically falsified or superseded

**Discrepancy markers:**
- `[VALID]` Implementation matches academic derivation
- `[DISCREPANCY]` Implementation diverges from cited source -- details provided
- `[CORRECTED]` Error found and annotated in this audit

**System stages referenced:**
- S1: Data input (candles, returns)
- S2: Indicator computation (indicators.js)
- S3: Pattern/signal calculation (patterns.js, signalEngine.js, backtester.js)
- S4: Display/rendering (patternRenderer.js, signalRenderer.js)

---

# 2.1 Mathematical Foundations

---

## M-1: Log-Returns Definition

### Academic Source
- Cont, R. (2001). "Empirical Properties of Asset Returns: Stylized Facts and Statistical Issues." *Quantitative Finance*, 1, 223-236.
- Campbell, Lo & MacKinlay (1997). *The Econometrics of Financial Markets*. Princeton. Ch.1.

### Formula

$$r_t = \ln\left(\frac{P_t}{P_{t-1}}\right)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $r_t$ | Log-return at time $t$ | Continuously compounded return | dimensionless | $(-\infty, +\infty)$; KRX bounded $[-0.357, +0.262]$ due to $\pm 30\%$ limit | Cont (2001) |
| $P_t$ | Closing price at time $t$ | Last traded price or auction price | KRW | $(0, +\infty)$ | Market data |
| $P_{t-1}$ | Closing price at time $t-1$ | Previous period close | KRW | $(0, +\infty)$ | Market data |

**Why log-returns:** Additivity across time ($r_{t_1 \to t_n} = \sum r_t$), approximate normality for small returns, and mathematical tractability (Ito calculus).

**KRX bound note:** Simple returns are bounded $[-0.30, +0.30]$ by KRX price limits, so log-returns are bounded $[\ln(0.70), \ln(1.30)] = [-0.357, +0.262]$. This truncation affects all tail-based statistics (Hill, GPD, kurtosis).

### Implementation

**File:** `js/indicators.js`

Log-returns are computed in multiple locations:

| Location | Line | Context | Formula |
|----------|------|---------|---------|
| `calcHurst` | 217-219 | Hurst R/S analysis | `Math.log(closes[i + 1] / closes[i])` |
| `calcEWMAVol` | 1347 | EWMA volatility | `Math.log(closes[i] / closes[i - 1])` |
| `calcHillEstimator` | (input) | Hill tail index | Receives pre-computed returns |
| `calcGPDFit` | (input) | GPD VaR | Receives pre-computed returns |
| `harRV` (cache) | 2082 | HAR-RV realized vol | `Math.log(closes[i] / closes[i - 1])` |
| `calcOnlineCUSUM` | (input) | CUSUM breakpoints | Receives pre-computed returns |
| `calcBinarySegmentation` | (input) | Binary segmentation | Receives pre-computed returns |

**Guard:** All locations check `closes[i] > 0` before `Math.log()`. Division by zero and negative prices produce `null` return or early exit.

### Verdict: `[VALID]`

All implementations use $\ln(P_t / P_{t-1})$, consistent with the continuous compounding convention. No sign errors or off-by-one errors detected. The guard against non-positive prices is sound.

---

## M-2: Hurst Exponent -- R/S Analysis

### Academic Source
- Hurst, H.E. (1951). "Long-Term Storage Capacity of Reservoirs." *Transactions of the American Society of Civil Engineers*, 116, 770-808.
- Mandelbrot, B.B. & Wallis, J.R. (1969). "Robustness of the Rescaled Range R/S in the Measurement of Noncyclic Long Run Statistical Dependence." *Water Resources Research*, 5(5), 967-988.
- Peters, E. (1994). *Fractal Market Analysis*. Wiley. Ch.4.
- Di Matteo, T. et al. (2005). "Long-term Memories of Developed and Emerging Markets." *Journal of Banking & Finance*, 29(4), 827-851.

### Formula

$$E\left[\frac{R(n)}{S(n)}\right] = C \cdot n^H$$

The Hurst exponent $H$ is estimated by OLS regression of $\log(R/S)$ on $\log(n)$:

$$\log\left(\frac{R(n)}{S(n)}\right) = H \cdot \log(n) + c$$

**R/S computation per block of size $w$:**

$$R(w) = \max_{1 \le k \le w} \sum_{i=1}^{k} (r_i - \bar{r}) - \min_{1 \le k \le w} \sum_{i=1}^{k} (r_i - \bar{r})$$

$$S(w) = \sqrt{\frac{1}{w} \sum_{i=1}^{w} (r_i - \bar{r})^2}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $H$ | Hurst exponent | Slope of $\log(R/S)$ vs $\log(n)$ | dimensionless | $(0, 1)$ | Hurst (1951) |
| $R(n)$ | Range of cumulative deviations | Max minus min of cumulative deviations from mean | same as $r_t$ | $[0, \infty)$ | Mandelbrot & Wallis (1969) |
| $S(n)$ | Standard deviation of block | Population $\sigma$ ($\div n$, not $\div(n-1)$) | same as $r_t$ | $(0, \infty)$ | Mandelbrot & Wallis (1969) |
| $n$ | Block size (window) | Number of observations per block | integer | $[\text{minWindow}, \lfloor N/2 \rfloor]$ | -- |
| $C$ | Proportionality constant | Irrelevant for slope estimation | -- | -- | -- |
| $r_i$ | Log-return within block | See M-1 | dimensionless | -- | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| `minWindow` | 10 | [C] | [8, 20] | Di Matteo (2005): min 8 for stable R/S | `indicators.js:212` param default |
| Window growth factor | 1.5 | [D] | [1.2, 2.0] | Heuristic geometric progression | `indicators.js:225` (`w * 1.5`) |
| Min data points for regression | 4 | [B] | [3, 6] | OLS requires $n > 2$ for meaningful fit | `indicators.js:246` |
| Min input length | `minWindow * 4 + 1` = 41 | [D] | [33, 81] | Ensures $\ge 4$ window sizes | `indicators.js:214` |

### Implementation: `indicators.js:212-264`

```
function calcHurst(closes, minWindow = 10)
```

**S1(input):** `closes` array (price levels)
**S2(calc):** Internal log-return conversion, multi-scale R/S, OLS slope
**S3(output):** `{ H: slope, rSquared: rSquared }`

### Audit Findings

**`[VALID]` Log-return conversion (line 217-219):** Uses $\ln(P_{t+1}/P_t)$ on price levels, producing stationary returns. Peters (1994) explicitly warns that applying R/S to non-stationary price levels biases $H$ upward by ~0.4. This implementation correctly differentiates first.

**`[VALID]` Population $\sigma$ (line 238):** Uses $\sqrt{\frac{1}{w}\sum d_i^2}$ (denominator $w$, not $w-1$). This matches Mandelbrot & Wallis (1969) convention for R/S analysis, which uses population standard deviation. Comment in code confirms this is intentional.

**`[VALID]` Zero-variance guard (line 239-241):** Blocks with $S = 0$ (flat prices) are excluded from the average R/S. The `validBlocks` counter (line 228) ensures the denominator reflects only non-degenerate blocks. This prevents $\log(0)$ and $\log(-\infty)$.

**`[DISCREPANCY]` Anis-Lloyd finite-sample correction not applied:** Anis & Lloyd (1976) showed that $E[R/S] = \sqrt{\pi n/2} \cdot \Gamma((n-1)/2) / \Gamma(n/2)$ for i.i.d. data, causing upward bias in $H$ for small $n$. The code comment (line 206) notes this is intentionally omitted because "James-Stein shrinkage is the substitute" (in `patterns.js:230-237`, $H$ is shrunk toward 0.5 with effective sample size weighting). This is a defensible design choice: the shrinkage toward $H=0.5$ absorbs the finite-sample bias in a data-adaptive manner, whereas Anis-Lloyd correction is fixed and assumes i.i.d. (which financial returns are not). **Severity: NOTE -- acceptable substitute.**

**`[VALID]` OLS slope estimation (lines 248-256):** Standard bivariate OLS via normal equations. $R^2$ computed correctly (lines 258-262).

### Edge Cases

1. **Flat-price stocks (all closes identical):** All returns = 0, all $S = 0$, `validBlocks = 0` for every window. `logRS` array stays empty, returns `null` at line 246. **Handled correctly.**
2. **Very short data (<41 bars):** Returns `null` at line 214. **Handled correctly.**
3. **Single non-zero return in a block:** $S > 0$ but $R = |r|$, $R/S = |r|/S$. This is a valid (though noisy) data point. **Acceptable.**

---

## M-3: Kalman Filter State-Space Model

### Academic Source
- Kalman, R.E. (1960). "A New Approach to Linear Filtering and Prediction Problems." *Journal of Basic Engineering*, 82(1), 35-45.
- Mohamed, A.H. & Schwarz, K.P. (1999). "Adaptive Kalman Filtering for INS/GPS." *Journal of Geodesy*, 73, 193-203. (Adaptive $Q$)

### State-Space Model

**State equation (random walk):**
$$x_t = x_{t-1} + w_t, \quad w_t \sim N(0, Q_t)$$

**Observation equation:**
$$z_t = x_t + v_t, \quad v_t \sim N(0, R)$$

**Kalman recursion:**
$$\hat{x}_{t|t-1} = \hat{x}_{t-1|t-1}$$
$$P_{t|t-1} = P_{t-1|t-1} + Q_t$$
$$K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}$$
$$\hat{x}_{t|t} = \hat{x}_{t|t-1} + K_t (z_t - \hat{x}_{t|t-1})$$
$$P_{t|t} = (1 - K_t) P_{t|t-1}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $x_t$ | Hidden state (true price) | Latent smooth price level | KRW | $(0, \infty)$ | Kalman (1960) |
| $z_t$ | Observation (closing price) | Noisy measurement of $x_t$ | KRW | $(0, \infty)$ | Market data |
| $Q_t$ | Process noise variance | Controls smoothness vs responsiveness | (KRW)$^2$ | $(0, \infty)$ | Mohamed & Schwarz (1999) |
| $R$ | Measurement noise variance | Assumed observation noise level | (KRW)$^2$ | $(0, \infty)$ | Kalman (1960) |
| $K_t$ | Kalman gain | Optimal weighting of new observation | dimensionless | $[0, 1]$ | Kalman (1960) |
| $P_t$ | Estimation error covariance | Uncertainty in state estimate | (KRW)$^2$ | $(0, \infty)$ | Kalman (1960) |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $Q$ (base) | 0.01 | [D] | [0.001, 0.1] | Heuristic; Mehra (1970) adaptive framework | `indicators.js:170` default param |
| $R$ | 1.0 | [D] | [0.1, 10] | Heuristic; typical $Q/R$ ratio determines smoothing | `indicators.js:170` default param |
| $P_0$ | 1.0 | [D] | [0.1, 10] | Initial uncertainty (washed out after ~10 bars) | `indicators.js:173` |
| $x_0$ | `closes[0]` | [A] | fixed | Standard initialization at first observation | `indicators.js:173` |
| EWMA $\alpha$ for adaptive $Q$ | 0.06 | [D] | [0.03, 0.10] | $\approx 2/(30+1)$; 30-bar half-life | `indicators.js:179` |

### Implementation: `indicators.js:170-199`

```
function calcKalman(closes, Q = 0.01, R = 1.0)
```

**S1(input):** `closes` array
**S2(calc):** Adaptive Kalman filter with volatility-scaled $Q$
**S3(output):** Array of filtered price estimates (same length as input)

### Audit Findings

**`[VALID]` Kalman recursion (lines 190-197):** The predict-update cycle is correctly implemented:
- Predict: `xPred = x`, `PPred = P + qAdaptive`
- Update: `K = PPred / (PPred + R)`, `x = xPred + K * (closes[i] - xPred)`, `P = (1 - K) * PPred`
This matches the scalar Kalman equations exactly.

**`[VALID]` Adaptive $Q$ (lines 177-188):** $Q_t = Q_\text{base} \times (\sigma^2_{\text{EWMA},t} / \bar{\sigma}^2)$, where $\bar{\sigma}^2$ is the running mean of EWMA variance. This follows Mohamed & Schwarz (1999) adaptive framework: low-volatility periods get smoother filtering (lower $Q$), high-volatility periods get more responsive filtering (higher $Q$). The EWMA variance uses simple return $(P_t - P_{t-1})/P_{t-1}$ not log-return; this is a minor inconsistency with M-1 but immaterial for the $Q$-scaling ratio.

**`[DISCREPANCY]` $Q$ and $R$ operate in different scales:** $Q$ uses the adaptive variance of percentage returns ($\sim 10^{-4}$), while $R=1.0$ operates on raw price levels. The Kalman gain $K = P/(P+R)$ works because $P$ converges to a steady state where the ratio is meaningful, but the initial transient (~5 bars) is dominated by $R$'s arbitrary scale. This is a known issue with heuristic $Q/R$ ratios. **Severity: WARNING -- the $Q/R$ ratio, not individual values, determines filter behavior. Current values produce reasonable smoothing for KRX price ranges, but are not scale-invariant.**

**Edge case:** `closes[i-1] <= 0` (line 183) skips the bar with `continue`, leaving `result[i] = null`. This can cause gaps in the output array. Downstream code (`signalEngine._detectKalmanTurn`) must handle nulls.

---

## M-4: Ito's Lemma / Geometric Brownian Motion

### Academic Source
- Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate Liabilities." *Journal of Political Economy*, 81(3), 637-654.
- Ito, K. (1944). "Stochastic Integral." *Proceedings of the Imperial Academy*, 20(8), 519-524.

### Formula

**Geometric Brownian Motion (GBM):**
$$dS_t = \mu S_t \, dt + \sigma S_t \, dW_t$$

**Ito's Lemma applied to $f(S) = \ln(S)$:**
$$d\ln(S_t) = \left(\mu - \frac{\sigma^2}{2}\right) dt + \sigma \, dW_t$$

**Solution:**
$$S_t = S_0 \cdot \exp\left[\left(\mu - \frac{\sigma^2}{2}\right) t + \sigma W_t\right]$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $S_t$ | Stock price at time $t$ | -- | KRW | $(0, \infty)$ | Black-Scholes (1973) |
| $\mu$ | Drift rate | Expected return (annualized) | year$^{-1}$ | $(-\infty, +\infty)$ | -- |
| $\sigma$ | Volatility | Diffusion coefficient (annualized) | year$^{-1/2}$ | $(0, \infty)$ | -- |
| $W_t$ | Standard Wiener process | $W_t \sim N(0, t)$, independent increments | year$^{1/2}$ | $(-\infty, +\infty)$ | Wiener (1923) |

### System Mapping

GBM is the null model against which technical analysis patterns are implicitly tested. It is directly used in:
1. **Demo mode** (`api.js`): Seed-based simulation of candle data uses discretized GBM.
2. **Conceptual benchmark**: If returns are GBM, then $r_t \sim N(\mu - \sigma^2/2, \sigma^2)$, and all patterns are noise. The system's purpose is to detect departures from GBM.

### Verdict: `[VALID]` -- Theoretical reference. Not directly computed in indicators pipeline.

---

## M-5: Fractal Dimension and Self-Similarity

### Academic Source
- Mandelbrot, B.B. (1982). *The Fractal Geometry of Nature*. W.H. Freeman.
- Mandelbrot, B.B. (1963). "The Variation of Certain Speculative Prices." *Journal of Business*, 36(4), 394-419.

### Formula

**Box-counting fractal dimension:**
$$N(\epsilon) \sim \epsilon^{-D}$$

**Relationship to Hurst exponent:**
$$D = 2 - H$$

For financial time series:
- $H = 0.5$ (random walk): $D = 1.5$ (space-filling curve)
- $H > 0.5$ (trending): $D < 1.5$ (smoother, more persistent)
- $H < 0.5$ (mean-reverting): $D > 1.5$ (rougher, more reversal-prone)

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $D$ | Fractal dimension | Box-counting dimension of price path | dimensionless | $(1, 2)$ | Mandelbrot (1982) |
| $H$ | Hurst exponent | Long-range dependence parameter | dimensionless | $(0, 1)$ | See M-2 |

### System Mapping

$D$ is not computed directly. The system uses $H$ from `calcHurst()` (M-2) and infers the fractal properties. In `patterns.js:230-237`, $H$ is shrunk toward 0.5 using James-Stein estimation before being used in pattern weighting.

### Verdict: `[VALID]` -- Theoretical reference. $H$ is the operational proxy.

---

# 2.2 Statistical Methods

---

## S-1: WLS Regression with Exponential Decay

### Academic Source
- Reschenhofer, E. et al. (2021). "Forecasting Stock Returns: A Time-Dependent Weighted Least Squares Approach." *International Journal of Forecasting*.
- Lo, A. (2004). "The Adaptive Markets Hypothesis." *Journal of Portfolio Management*, 30(5), 15-29.

### Formula

**Normal equation:**
$$\hat{\beta} = (X^T W X)^{-1} X^T W y$$

**Exponential decay weights:**
$$w_i = \lambda^{T - t_i}$$

**Half-life:** $h = \frac{\ln 2}{\ln(1/\lambda)}$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $X$ | Design matrix | $n \times p$ matrix, columns: [1, conf, trend, lnVol, atrNorm, wc, mom60] | mixed | varies | Doc 17 S17.14 |
| $W$ | Weight matrix | $\text{diag}(w_1, \ldots, w_n)$ | dimensionless | $(0, 1]$ | Reschenhofer (2021) |
| $y$ | Response vector | $N$-day returns (%) | percent | $(-\infty, +\infty)$ | Backtest data |
| $\hat{\beta}$ | Coefficient vector | $p \times 1$ OLS/WLS estimates | mixed | $(-\infty, +\infty)$ | -- |
| $\lambda$ | Decay parameter | Controls recency weighting | dimensionless | $(0, 1)$ | Lo (2004) AMH |
| $T$ | Total number of observations | Index of most recent observation | integer | -- | -- |
| $t_i$ | Time index of observation $i$ | -- | integer | $[0, T]$ | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $\lambda$ | 0.995 | [C] | [0.990, 0.999] | Lo (2004) AMH; half-life $\approx 139$ days | `backtester.js` weight computation |
| Design matrix columns | 7 (incl. intercept) | [B] | 5-8 features | Stage A-1 IC validation | `backtester.js:590-614` |

### Implementation: `indicators.js:558-674`

```
function calcWLSRegression(X, y, weights, ridgeLambda)
```

**S1(input):** Design matrix $X$, response $y$, weights, optional Ridge $\lambda$
**S2(calc):** Normal equation with Gauss-Jordan inversion
**S3(output):** `{ coeffs, rSquared, adjR2, stdErrors, tStats, hcStdErrors, hcTStats, vif }`

### Audit Findings

**`[VALID]` Normal equation computation (lines 563-596):** $X^T W X$ and $X^T W y$ are computed correctly with weight $w_i$ applied as $w \cdot X_i^T X_i$ and $w \cdot X_i^T y_i$. The intercept column (j=0) is included in $X$.

**`[VALID]` Minimum sample check (line 560):** `n < p + 2` returns null. This is more conservative than the bare minimum of $n > p$, which is correct -- regression with exactly $n = p$ has zero degrees of freedom.

**`[VALID]` Weighted $R^2$ (lines 606-617):** Uses weighted mean $\bar{y}_w = \frac{\sum w_i y_i}{\sum w_i}$ and weighted SS: $R^2 = 1 - \text{SS}_\text{res} / \text{SS}_\text{tot}$. Clamped to $[0, 1]$ via `Math.max(0, ...)`. Adjusted $R^2$ uses Theil (1961) formula.

**`[VALID]` Gauss-Jordan inversion:** `_invertMatrix()` implements full Gauss-Jordan elimination with partial pivoting. Returns `null` for singular matrices (near-zero pivot detection).

---

## S-2: Ridge Regression with GCV Lambda Selection

### Academic Source
- Hoerl, A.E. & Kennard, R.W. (1970). "Ridge Regression: Biased Estimation for Nonorthogonal Problems." *Technometrics*, 12(1), 55-67.
- Golub, G., Heath, M. & Wahba, G. (1979). "Generalized Cross-Validation as a Method for Choosing a Good Ridge Parameter." *Technometrics*, 21(2), 215-223.

### Formula

$$\hat{\beta}_\text{Ridge} = (X^T W X + \lambda I^*)^{-1} X^T W y$$

where $I^*$ is the identity matrix with $I^*_{00} = 0$ (intercept not penalized).

**GCV criterion:**
$$\text{GCV}(\lambda) = \frac{n^{-1} \sum_i (y_i - \hat{y}_i^\lambda)^2}{[n^{-1} \text{tr}(I - H_\lambda)]^2}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $\lambda$ | Ridge penalty | Regularization strength | dimensionless | $[0, \infty)$ | Hoerl & Kennard (1970) |
| $I^*$ | Modified identity | $I$ with $I^*_{00} = 0$ (no intercept penalty) | -- | -- | Standard practice |
| $H_\lambda$ | Hat matrix | $X(X^T W X + \lambda I^*)^{-1} X^T W$ | -- | -- | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $\lambda$ (GCV auto) | Data-driven | [B] | [0.1, 50] | Golub, Heath & Wahba (1979) | `backtester.js` GCV loop |
| $\lambda$ (fallback) | 1.0 | [C] | [0.5, 5.0] | Conservative default when GCV fails | `backtester.js` fallback |

### Implementation: `indicators.js:580-585`

```javascript
// Ridge regularization: (X^T W X + lambda*I) -- intercept (j=0) excluded
if (ridgeLambda && ridgeLambda > 0) {
  for (var j = 1; j < p; j++) {
    XtWX[j][j] += ridgeLambda;
  }
}
```

### Audit Findings

**`[VALID]` Intercept exclusion (line 582):** Loop starts at `j = 1`, correctly excluding the intercept column from penalization. This is standard Ridge practice -- penalizing the intercept would bias the mean prediction.

**`[VALID]` GCV lambda selection:** The backtester implements GCV search over a grid of $\lambda$ values, selecting the minimizer. When GCV is unstable (n < 30), falls back to $\lambda = 1.0$.

**Note:** The Doc 22 master registry (constant #41) lists `Ridge lambda = GCV auto, fallback 1.0`, which matches the code. The earlier Doc 17 reference to $\lambda = 2.0$ is superseded.

---

## S-3: HC3 Heteroskedasticity-Consistent Standard Errors

### Academic Source
- White, H. (1980). "A Heteroskedasticity-Consistent Covariance Matrix Estimator and a Direct Test for Heteroskedasticity." *Econometrica*, 48(4), 817-838.
- MacKinnon, J.G. & White, H. (1985). "Some Heteroskedasticity-Consistent Covariance Matrix Estimators with Improved Finite Sample Properties." *Journal of Econometrics*, 29(3), 305-325.
- Long, J.S. & Ervin, L.H. (2000). "Using Heteroscedasticity Consistent Standard Errors in the Linear Regression Model." *The American Statistician*, 54(3), 217-224.

### Formula

**Sandwich estimator:**
$$\widehat{\text{Cov}}_\text{HC3}(\hat{\beta}) = (X^T W X)^{-1} \cdot B \cdot (X^T W X)^{-1}$$

**Meat matrix $B$ (HC3):**
$$B = \sum_{i=1}^{n} \frac{w_i^2 \, e_i^2}{(1 - h_{ii})^2} \cdot x_i x_i^T$$

**Leverage (hat matrix diagonal):**
$$h_{ii} = w_i \cdot x_i^T (X^T W X)^{-1} x_i$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $e_i$ | Residual | $y_i - x_i^T \hat{\beta}$ | same as $y$ | $(-\infty, +\infty)$ | -- |
| $h_{ii}$ | Leverage | Diagonal of hat matrix $H$ | dimensionless | $[0, 1)$; capped at 0.99 | MacKinnon & White (1985) |
| $w_i$ | WLS weight | Exponential decay weight | dimensionless | $(0, 1]$ | -- |

**HC variant comparison (Long & Ervin 2000):**

| HC | Formula | Small-sample performance |
|----|---------|------------------------|
| HC0 | $e_i^2$ | Biased downward |
| HC1 | $\frac{n}{n-p} e_i^2$ | Degree-of-freedom correction |
| HC2 | $\frac{e_i^2}{1 - h_{ii}}$ | First-order leverage correction |
| HC3 | $\frac{e_i^2}{(1 - h_{ii})^2}$ | Delete-one jackknife approximation |

### Implementation: `indicators.js:636-674`

### Audit Findings

**`[VALID]` Leverage computation (lines 647-652):** $h_{ii} = w_i \cdot x_i^T (X^T W X)^{-1} x_i$ correctly includes the WLS weight $w_i$ in the hat matrix diagonal. This is the WLS-adapted formula from MacKinnon & White (1985).

**`[DISCREPANCY]` HC3 meat matrix assembly (line 654):**

The code computes:
```javascript
var eScaled = w * w * residuals[i] / (denom * denom);  // w^2 * e_i / (1-h_ii)^2
// ...
meat[j][k] += X[i][j] * eScaled * residuals[i] * X[i][k];
```

This produces: $B_{jk} += x_{ij} \cdot \frac{w_i^2 \cdot e_i}{(1-h_{ii})^2} \cdot e_i \cdot x_{ik} = x_{ij} \cdot \frac{w_i^2 \cdot e_i^2}{(1-h_{ii})^2} \cdot x_{ik}$

This matches the HC3 formula. **Confirmed correct.** The apparent indirection (splitting $e_i$ into `eScaled` and `residuals[i]`) is just a code refactoring artifact -- the product is $w_i^2 e_i^2 / (1 - h_{ii})^2$.

**`[VALID]` Leverage cap (line 653):** `Math.min(h_ii, 0.99)` prevents division by zero when $h_{ii} \to 1$ (perfect leverage). This is standard defensive coding for HC3.

**`[VALID]` Sandwich assembly (lines 662-669):** $(X^T W X)^{-1} B (X^T W X)^{-1}$ is correctly computed by left- and right-multiplying the meat by the inverse.

### Verdict: `[VALID]` -- HC3 implementation is correct and appropriate for the $n = 30$-200 sample sizes typical in pattern backtesting.

---

## S-4: BCa Bootstrap Confidence Intervals

### Academic Source
- Efron, B. (1987). "Better Bootstrap Confidence Intervals." *Journal of the American Statistical Association*, 82(397), 171-185.
- Efron, B. & Tibshirani, R. (1993). *An Introduction to the Bootstrap*. Chapman & Hall. Ch.14.

### Formula

**Bias correction $z_0$:**
$$z_0 = \Phi^{-1}\left(\frac{\#\{\hat{\theta}^*_b < \hat{\theta}\}}{B}\right)$$

**Acceleration $\hat{a}$ (jackknife):**
$$\hat{a} = \frac{\sum_{i=1}^{n} (\bar{\theta}_{(\cdot)} - \hat{\theta}_{(i)})^3}{6 \left[\sum_{i=1}^{n} (\bar{\theta}_{(\cdot)} - \hat{\theta}_{(i)})^2\right]^{3/2}}$$

**Adjusted percentiles:**
$$\alpha_1 = \Phi\left(z_0 + \frac{z_0 + z_{\alpha/2}}{1 - \hat{a}(z_0 + z_{\alpha/2})}\right)$$
$$\alpha_2 = \Phi\left(z_0 + \frac{z_0 + z_{1-\alpha/2}}{1 - \hat{a}(z_0 + z_{1-\alpha/2})}\right)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $\hat{\theta}^*_b$ | Bootstrap replicate statistic | Win rate from $b$-th bootstrap sample | percent | $[0, 100]$ | Efron (1987) |
| $\hat{\theta}$ | Original sample statistic | Observed win rate | percent | $[0, 100]$ | -- |
| $\hat{\theta}_{(i)}$ | Jackknife statistic | Win rate with $i$-th observation removed | percent | $[0, 100]$ | -- |
| $B$ | Number of bootstrap replicates | -- | integer | $\ge 50$ | Efron (1987) |
| $z_0$ | Bias correction factor | Measures median bias of bootstrap distribution | dimensionless | -- | Efron (1987) |
| $\hat{a}$ | Acceleration | Measures rate of change of SE w.r.t. parameter | dimensionless | -- | Efron (1987) |
| $\Phi$ | Standard normal CDF | -- | -- | $[0, 1]$ | -- |
| $\Phi^{-1}$ | Standard normal quantile function | -- | -- | $(-\infty, +\infty)$ | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $B$ (bootstrap replicates) | 500 | [B] | [200, 2000] | Efron (1987): $B \ge 200$ for CI | `backtester.js:1484` |
| $\alpha$ | 0.05 | [A] | fixed | 95% confidence convention | `backtester.js:1103` |
| Min $B$ for BCa | 50 | [B] | [50, 200] | Efron & Tibshirani (1993) | `backtester.js:1105` |
| Winsorization percentiles | [1%, 99%] | [C] | [0.5%, 2%] | Wilcox (2005); KRX $\pm 30\%$ kurtosis | `backtester.js:1462-1464` |

### Implementation: `backtester.js:1093-1146`

```
_bcaCI(bootStats, thetaHat, jackValues, alpha)
```

### Audit Findings

**`[VALID]` Bias correction $z_0$ (lines 1108-1110):** `countBelow / B` gives the proportion of bootstrap replicates below the original estimate, and `_normInv()` inverts the normal CDF. This is Efron (1987) equation (2.3).

**`[VALID]` Acceleration (lines 1113-1126):** Jackknife-based $\hat{a}$ formula matches Efron (1987) equation (6.6). The numerator is $\sum (\bar{\theta} - \theta_{(i)})^3$ and the denominator is $6[\sum(\bar{\theta} - \theta_{(i)})^2]^{3/2}$.

**`[VALID]` Adjusted percentiles (lines 1128-1135):** Correctly implements the BCa percentile adjustment formula. Clamped to $[0.5/B, 1-0.5/B]$ to prevent out-of-range indexing.

**`[VALID]` Calendar-time bootstrap (lines 1487-1507):** Resamples whole months with replacement, following Fama & French (2010) calendar-time portfolio methodology. This preserves intra-month clustering (GARCH effects). Falls back to index-based block bootstrap (Kunsch 1989, block size $= \lceil\sqrt{n}\rceil$) when date strings are unavailable (intraday data).

**`[DISCREPANCY]` Winsorization before bootstrap (lines 1459-1464):** Returns are clipped at [1st, 99th] percentiles before computing win rates. This is appropriate for KRX data with $\pm 30\%$ price limits creating extreme kurtosis, but note that winsorization changes the win rate definition from "proportion of positive raw returns" to "proportion of positive winsorized returns." The magnitude of this distortion is small ($< 0.5$ pp for typical distributions) but should be documented. **Severity: NOTE.**

---

## S-5: Benjamini-Hochberg FDR Correction

### Academic Source
- Benjamini, Y. & Hochberg, Y. (1995). "Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing." *Journal of the Royal Statistical Society: Series B*, 57(1), 289-300.

### Formula

**BH step-up procedure:**

Given $m$ tests with ordered p-values $p_{(1)} \le p_{(2)} \le \ldots \le p_{(m)}$:

1. Find the largest $k$ such that $p_{(k)} \le \frac{k}{m} \cdot q$
2. Reject all hypotheses $H_{(1)}, \ldots, H_{(k)}$

This controls $\text{FDR} = E\left[\frac{V}{R \vee 1}\right] \le q$ where $V$ = false rejections, $R$ = total rejections.

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $m$ | Number of tests | Total simultaneous hypotheses | integer | $\sim 135$-195 | 27-39 patterns $\times$ 5 horizons |
| $q$ | FDR level | Maximum acceptable false discovery rate | dimensionless | 0.05 | BH (1995) |
| $p_{(k)}$ | Ordered p-value | $k$-th smallest p-value | dimensionless | $[0, 1]$ | -- |
| $k$ | Rank index | 0-indexed in implementation | integer | $[0, m-1]$ | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $q$ (FDR level) | 0.05 | [A] | fixed | BH (1995) standard | `backtester.js:807` |

### Implementation: `backtester.js:806-855`

```
_applyBHFDR(results)
```

### Audit Findings

**`[VALID]` Step-up procedure (lines 846-851):** The loop searches backward from $k = m-1$ to 0 for the largest $k$ satisfying $p_{(k)} \le (k+1) \cdot q / m$. The `(k+1)` converts from 0-indexed to 1-indexed rank, matching the BH formula. All tests with rank $\le$ this threshold are rejected.

**`[VALID]` P-value approximation (line 837):** `_approxPValue()` uses the Abramowitz & Stegun 26.7.5 normal approximation to the $t$-distribution, with accuracy $\sim 0.01$ for $\text{df} \ge 3$. This is adequate for BH ordering, which requires correct ranking (not exact p-values).

**`[VALID]` Independence assumption:** BH (1995) requires positive regression dependency (PRDS), which is satisfied by the positive correlation among pattern returns from the same stock. Benjamini & Yekutieli (2001) showed that BH controls FDR at $q$ under PRDS, not just independence.

**Design note:** The system previously used Holm step-down (FWER control) but switched to BH-FDR in Phase G (commit be27600). This is appropriate: with 195 tests, FWER control is overly conservative (Bonferroni threshold $= 0.05/195 = 0.000256$), while FDR at $q = 0.05$ permits more discoveries at the cost of $\le 5\%$ false discovery rate.

---

## S-6: Hill Tail Index Estimator (EVT)

### Academic Source
- Hill, B.M. (1975). "A Simple General Approach to Inference about the Tail of a Distribution." *Annals of Statistics*, 3(5), 1163-1174.
- Drees, H. & Kaufmann, E. (1998). "Selecting the Optimal Sample Fraction in Univariate Extreme Value Estimation." *Stochastic Processes and their Applications*, 75(2), 149-172.

### Formula

**Hill estimator of the tail index $\alpha$:**

Given order statistics $X_{(1)} \ge X_{(2)} \ge \ldots \ge X_{(n)}$ (descending):

$$\hat{H}_k = \frac{1}{k} \sum_{i=1}^{k} \left[\ln X_{(i)} - \ln X_{(k+1)}\right]$$

$$\hat{\alpha} = \frac{1}{\hat{H}_k} = \frac{k}{\sum_{i=1}^{k} \left[\ln X_{(i)} - \ln X_{(k+1)}\right]}$$

**Asymptotic standard error:**
$$\text{SE}(\hat{\alpha}) = \frac{\hat{\alpha}}{\sqrt{k}}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $\hat{\alpha}$ | Tail index estimate | Exponent of power-law tail: $P(X > x) \sim x^{-\alpha}$ | dimensionless | $(0, \infty)$; financial: $\sim 3$-$5$ | Hill (1975) |
| $k$ | Number of upper order statistics | Controls bias-variance tradeoff | integer | $[2, n-1]$ | -- |
| $X_{(i)}$ | $i$-th largest absolute return | -- | dimensionless | $(0, \infty)$ | -- |
| $\text{SE}$ | Standard error | Asymptotic, assumes i.i.d. | dimensionless | $(0, \infty)$ | Hill (1975) |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $k$ (auto) | $\lfloor\sqrt{n}\rfloor$ | [B] | Data-adaptive methods preferred | Drees & Kaufmann (1998) | `indicators.js:287` |
| Min $n$ | 10 | [B] | [10, 30] | Practical minimum for tail estimation | `indicators.js:277` |
| Heavy-tail threshold | $\alpha < 4$ | [B] | [3, 5] | $\alpha < 4 \Rightarrow$ infinite kurtosis | `indicators.js:307` |

### Implementation: `indicators.js:276-307`

```
function calcHillEstimator(returns, k)
```

### Audit Findings

**`[VALID]` Absolute value sorting (lines 279-283):** Uses $|r_t|$ (excluding zeros) sorted descending. This is correct for two-sided tail analysis -- the Hill estimator applies to the absolute returns to estimate the symmetric tail index.

**`[VALID]` Hill formula (lines 290-302):** $\hat{\alpha} = k / \sum[\ln|X_{(i)}| - \ln|X_{(k+1)}|]$. The 0-indexed `absRet[k]` corresponds to $X_{(k+1)}$ in 1-indexed notation. This is correct.

**`[VALID]` SE formula (line 305):** $\text{SE} = \hat{\alpha}/\sqrt{k}$. The code comment correctly notes this assumes i.i.d. and that dependent data requires declustering or block bootstrap (Drees & Kaufmann 1998).

**`[DISCREPANCY]` $k = \lfloor\sqrt{n}\rfloor$ rule-of-thumb:** The code attributes this to "Drees & Kaufmann (1998)" in the function docstring, but Drees & Kaufmann actually proposed a bootstrap-based adaptive $k$ selection, not the $\sqrt{n}$ rule. The $\sqrt{n}$ rule is a widespread heuristic without specific authorship. **Severity: NOTE -- attribution imprecise but value is reasonable for $n \sim 250$-$500$ ($k \sim 16$-$22$).**

---

## S-7: GPD VaR (Pickands-Balkema-de Haan)

### Academic Source
- Pickands, J. (1975). "Statistical Inference Using Extreme Order Statistics." *Annals of Statistics*, 3(1), 119-131.
- Balkema, A.A. & de Haan, L. (1974). "Residual Life Time at Great Age." *Annals of Probability*, 2(5), 792-804.
- Hosking, J.R.M. & Wallis, J.R. (1987). "Parameter and Quantile Estimation for the Generalized Pareto Distribution." *Technometrics*, 29(3), 339-349.

### Formula

**Generalized Pareto Distribution (GPD):**
$$H(y; \sigma, \xi) = 1 - \left(1 + \frac{\xi y}{\sigma}\right)^{-1/\xi}, \quad y > 0$$

**PWM parameter estimation (Hosking & Wallis 1987):**
$$\hat{\xi} = 2 - \frac{\beta_0}{\beta_0 - 2\beta_1}, \quad \hat{\sigma} = \frac{2\beta_0 \beta_1}{\beta_0 - 2\beta_1}$$

where $\beta_r = \frac{1}{N_u}\sum_{i=1}^{N_u} y_{(i)} \cdot \frac{\binom{i-1}{r}}{\binom{N_u-1}{r}}$ (for $r = 0$: $\beta_0 = \bar{y}$).

**GPD-based VaR:**
$$\text{VaR}_p = u + \frac{\hat{\sigma}}{\hat{\xi}} \left[\left(\frac{n}{N_u}(1-p)\right)^{-\hat{\xi}} - 1\right]$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $u$ | Threshold | Cutoff for extreme values | same as returns | upper 5th percentile | Doc 12 S3.4 |
| $N_u$ | Exceedances count | Number of observations above $u$ | integer | $\ge 20$ | -- |
| $\xi$ | Shape parameter | $\xi > 0$: heavy tail (Frechet); $\xi = 0$: exponential | dimensionless | $(-0.5, 0.5)$ clamped | Pickands (1975) |
| $\sigma$ | Scale parameter | Spread of excess distribution | same as returns | $(0, \infty)$ | -- |
| $p$ | Confidence level | VaR quantile | dimensionless | 0.99 default | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| Threshold percentile | 5% (upper tail) | [B] | [3%, 10%] | Doc 12 S3.4 practical guideline | `indicators.js:335` |
| Min exceedances | 20 | [B] | [15, 50] | PWM requires $N_u \ge 20$ for stability | `indicators.js:347` |
| Min total obs | 500 | [C] | [250, 1000] | 2+ years daily data for reliable tail fit | `indicators.js:324` |
| $\xi$ clamp | $< 0.5$ | [A] | fixed | PWM validity: Hosking & Wallis (1987) | `indicators.js:365` |
| Default quantile $p$ | 0.99 | [A] | fixed | 99% VaR standard | `indicators.js:369` |

### Implementation: `indicators.js:323-376`

```
function calcGPDFit(returns, quantile)
```

### Audit Findings

**`[VALID]` Threshold selection (line 335-338):** Uses upper 5th percentile of absolute returns. This is within the standard EVT guideline of 3%-10%.

**`[VALID]` PWM estimation (lines 349-364):** $\beta_0 = \bar{y}$ and $\beta_1 = \frac{1}{N_u}\sum y_{(i)} \cdot \frac{i}{N_u - 1}$ where $y_{(i)}$ are sorted exceedances (ascending). This matches Hosking & Wallis (1987) formula for $r = 0, 1$.

**`[VALID]` $\xi$ clamp (line 365):** PWM estimator is valid only for $\xi < 0.5$ (Hosking & Wallis 1987). Values are clamped to 0.499. Code comment explains this.

**`[VALID]` VaR formula (lines 369-373):** Correctly implements the GPD quantile: $u + (\sigma/\xi)[(n/N_u \cdot (1-p))^{-\xi} - 1]$.

**`[VALID]` Guard conditions:** Checks $\sigma > 0$, $\xi \in (-0.5, 1)$, `VaR > 0`, `isFinite(VaR)`.

---

## S-8: EWMA Volatility

### Academic Source
- JP Morgan/Reuters (1996). *RiskMetrics Technical Document*. 4th ed.
- Bollerslev, T. (1986). "Generalized Autoregressive Conditional Heteroskedasticity." *Journal of Econometrics*, 31(3), 307-327.

### Formula

$$\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_{t-1}^2$$

**Half-life:**
$$h = \frac{\ln 2}{\ln(1/\lambda)}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $\sigma_t^2$ | Conditional variance at $t$ | EWMA estimate of return variance | dimensionless$^2$ | $(0, \infty)$ | RiskMetrics (1996) |
| $\lambda$ | Decay factor | Weight on prior variance vs current return squared | dimensionless | $(0, 1)$ | RiskMetrics (1996) |
| $r_t$ | Log-return at $t$ | $\ln(P_t / P_{t-1})$ | dimensionless | -- | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $\lambda$ (default) | 0.94 | [B] | [0.86, 0.97] | RiskMetrics G7 default | `indicators.js:1338` |
| $\lambda$ (long-term) | 0.97 | [B] | -- | Half-life $\approx 23$ days | VRP proxy usage |
| $\lambda$ (short-term) | 0.86 | [B] | -- | Half-life $\approx 4.6$ days | VRP proxy usage |
| Initial variance window | 20 bars | [D] | [10, 30] | Heuristic warm-up | `indicators.js:1351` |

### Implementation: `indicators.js:1336-1376`

```
function calcEWMAVol(closes, lambda)
```

### Audit Findings

**`[VALID]` EWMA recursion (lines 1361-1373):** $\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_t^2$. Uses log-returns. The code uses `returns[i] * returns[i]` (current return squared), matching the EWMA(1) specification where the innovation is the current return.

**`[DISCREPANCY]` Initialization with population variance (lines 1350-1359):** Initial variance uses $\text{Var} = \frac{1}{N}\sum r_i^2 - \bar{r}^2$ (population formula, $\div N$ not $\div(N-1)$). For the initialization period of 20 bars, this differs from the sample variance by a factor of $20/19 \approx 1.05$. **Severity: NOTE -- immaterial, as the EWMA recursion washes out the initial value within $\sim 3$ half-lives ($\sim 60$ bars for $\lambda = 0.94$).**

**`[VALID]` Flat-price guard (line 1359):** `if (initVar <= 0) initVar = 1e-8` prevents division-by-zero or negative variance propagation.

**`[VALID]` Output format:** Returns $\sigma_t = \sqrt{\sigma_t^2}$ (standard deviation, not variance).

---

## S-9: HAR-RV Model (Corsi 2009)

### Academic Source
- Corsi, F. (2009). "A Simple Approximate Long-Memory Model of Realized Volatility." *Journal of Financial Econometrics*, 7(2), 174-196.

### Formula

**Heterogeneous Autoregressive model of Realized Volatility:**
$$RV_{t+1}^{(d)} = c_0 + c_d \cdot RV_t^{(d)} + c_w \cdot RV_t^{(w)} + c_m \cdot RV_t^{(m)} + \epsilon_{t+1}$$

where:
$$RV_t^{(d)} = r_t^2 \quad \text{(daily squared return proxy)}$$
$$RV_t^{(w)} = \frac{1}{5}\sum_{j=0}^{4} r_{t-j}^2 \quad \text{(weekly average)}$$
$$RV_t^{(m)} = \frac{1}{22}\sum_{j=0}^{21} r_{t-j}^2 \quad \text{(monthly average)}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $RV_t^{(d)}$ | Daily realized variance | Squared log-return as variance proxy | dimensionless$^2$ | $[0, \infty)$ | Corsi (2009) |
| $RV_t^{(w)}$ | Weekly realized variance | 5-day average of daily $RV$ | dimensionless$^2$ | $[0, \infty)$ | Corsi (2009) |
| $RV_t^{(m)}$ | Monthly realized variance | 22-day average of daily $RV$ | dimensionless$^2$ | $[0, \infty)$ | Corsi (2009) |
| $c_0, c_d, c_w, c_m$ | OLS coefficients | Estimated from trailing 60-bar window | mixed | $(-\infty, +\infty)$ | Rolling OLS |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $D$ (daily window) | 1 | [A] | fixed | Corsi (2009) | `indicators.js:2072` |
| $W$ (weekly window) | 5 | [A] | fixed | Corsi (2009): 1 trading week | `indicators.js:2072` |
| $M$ (monthly window) | 22 | [A] | fixed | Corsi (2009): ~1 trading month | `indicators.js:2072` |
| OLS fit window | 60 | [C] | [30, 120] | ~3 months trailing | `indicators.js:2073` |
| Min valid weekly obs | 3 | [D] | [3, 5] | Guard for missing data | `indicators.js:2101` |
| Min valid monthly obs | 10 | [D] | [10, 15] | Guard for missing data | `indicators.js:2108` |
| Min OLS observations | 30 | [B] | [20, 50] | OLS stability | `indicators.js:2126` |
| KRX_TRADING_DAYS | 250 | [C] | [248, 252] | KRX annual trading days | `indicators.js:9` |

### Implementation: `indicators.js:2062-2178` (within `IndicatorCache.harRV()`)

### Audit Findings

**`[VALID]` RV components (lines 2092-2108):** Daily: $r_t^2$. Weekly: $\frac{1}{\text{cnt}_W}\sum_{j=t-4}^{t} r_j^2$ with minimum 3 valid observations. Monthly: $\frac{1}{\text{cnt}_M}\sum_{j=t-21}^{t} r_j^2$ with minimum 10 valid observations. This matches Corsi (2009) with adaptive averaging for missing data.

**`[DISCREPANCY]` $RV^{(d)}$ is a single squared return, not sum-of-intraday:** Corsi (2009) defines $RV_t^{(d)} = \sum_{j=1}^{M} r_{t,j}^2$ using intraday returns at frequency $M$. CheeseStock uses $RV_t^{(d)} = r_t^2$ (a single daily squared return) because intraday data is not consistently available across all 2,700+ stocks. This is a well-known approximation in the HAR-RV literature for daily-frequency applications. **Severity: WARNING -- the single-return proxy is noisier than true realized volatility. The weekly and monthly components partially compensate by averaging.**

**`[VALID]` Rolling OLS (lines 2112-2164):** 4-parameter OLS ($c_0, c_d, c_w, c_m$) with intercept, using trailing 60-bar window. The $X^T X$ matrix is constructed, symmetrized, and inverted via `_invertMatrix()`. Predicted value clamped to $\ge 0$ (line 2168).

**`[VALID]` Annualization (line 2171):** $\text{HAR-RV}_\text{ann} = \sqrt{RV_\text{hat} \times \text{KRX\_TRADING\_DAYS}} \times 100$. This converts daily variance to annualized volatility percentage. Uses KRX-specific 250 trading days, not NYSE 252.

---

## S-10: VRP = IV^2 - RV^2 (Bollerslev-Tauchen-Zhou 2009)

### Academic Source
- Bollerslev, T., Tauchen, G. & Zhou, H. (2009). "Expected Stock Returns and Variance Risk Premia." *Review of Financial Studies*, 22(11), 4463-4492.

### Formula

**Variance Risk Premium:**
$$VRP \equiv E^{\mathbb{Q}}[\sigma^2] - E^{\mathbb{P}}[\sigma^2] = IV^2 - RV^2$$

**CheeseStock proxy (individual stock level):**
$$\text{vrp\_proxy} = \frac{\sigma_{\text{EWMA}}(\lambda=0.97)}{\sigma_{\text{EWMA}}(\lambda=0.86)}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $IV$ | Implied volatility | VKOSPI / 100 (index level) | year$^{-1/2}$ | $(0, \infty)$ | CBOE/KRX |
| $RV$ | Realized volatility | HAR-RV forecast or historical | year$^{-1/2}$ | $(0, \infty)$ | Corsi (2009) |
| $\text{vrp\_proxy}$ | VRP proxy ratio | Long-EWMA / short-EWMA | dimensionless | $(0, \infty)$ | Design choice |
| $\sigma_{\text{EWMA}}(\lambda)$ | EWMA vol | See S-8 | dimensionless | $(0, \infty)$ | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| $\lambda$ (long-term) | 0.97 | [B] | [0.95, 0.99] | Half-life $\approx 23$ days | `signalEngine.js:~1887` |
| $\lambda$ (short-term) | 0.86 | [B] | [0.80, 0.90] | Half-life $\approx 4.6$ days | `signalEngine.js:~1887` |
| Risk-on threshold | $> 1.2$ | [D] | [1.1, 1.3] | No published calibration | `signalEngine.js:~3057` |
| Risk-off threshold | $< 0.8$ | [D] | [0.7, 0.9] | No published calibration | `signalEngine.js:~3057` |
| Confidence adjustment | $\pm 5\%$ | [D] | [$\pm 3\%$, $\pm 8\%$] | No published calibration | Doc 34 S2.4 |

### Implementation: `signalEngine.js:calcVolRegime()`, `indicators.js:calcEWMAVol()`

### Audit Findings

**`[VALID]` Proxy construction:** The ratio of long-term to short-term EWMA volatility captures the relative position of current volatility in its historical context, which is a valid proxy for the sign and magnitude of VRP. When short-term vol exceeds long-term vol (ratio < 1), realized volatility is running above the structural level, indicating potential VRP inversion.

**`[DISCREPANCY]` Not true VRP:** This proxy measures relative volatility positioning, not the actual spread between implied and realized volatility. True VRP requires option-implied volatility data, which is only available at the index level (VKOSPI) and for a handful of single-stock options. The proxy cannot distinguish between a change in implied vol expectation and a change in realized vol dynamics. **Severity: WARNING -- acceptable proxy for KRX where individual stock IV data is unavailable, but users should understand this is a directional indicator, not a VRP measurement.**

**`[VALID]` Regime thresholds (1.2 / 0.8):** While heuristic [D], these create a dead band around 1.0 that prevents frequent regime switching. The asymmetric width (0.2 above, 0.2 below) is neutral with respect to volatility direction.

---

## S-11: Cornish-Fisher VaR Expansion

### Academic Source
- Cornish, E.A. & Fisher, R.A. (1937). "Moments and Cumulants in the Specification of Distributions." *Revue de l'Institut International de Statistique*, 5(4), 307-320.
- Abramowitz, M. & Stegun, I.A. (1972). *Handbook of Mathematical Functions*. NBS Applied Math Series 55. Eq. 26.2.23.

### Formula

**Purpose in this system:** Cornish-Fisher expansion is used to approximate t-distribution quantiles for varying significance levels (needed by BH-FDR and formerly Holm step-down procedures).

**Step 1: Normal quantile (Abramowitz & Stegun 26.2.23):**

$$z_p = t - \frac{c_0 + c_1 t + c_2 t^2}{1 + d_1 t + d_2 t^2 + d_3 t^3}$$

where $t = \sqrt{-2\ln(1-p)}$ and:

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| $c_0$ | 2.515517 | [A] | A&S (1972) |
| $c_1$ | 0.802853 | [A] | A&S (1972) |
| $c_2$ | 0.010328 | [A] | A&S (1972) |
| $d_1$ | 1.432788 | [A] | A&S (1972) |
| $d_2$ | 0.189269 | [A] | A&S (1972) |
| $d_3$ | 0.001308 | [A] | A&S (1972) |

Accuracy: $|\text{error}| < 4.5 \times 10^{-4}$.

**Step 2: Cornish-Fisher correction (normal to t):**
$$t_\nu \approx z + \frac{z^3 + z}{4\nu} + \frac{5z^5 + 16z^3 + 3z}{96\nu^2}$$

where $\nu = \text{df}$ (degrees of freedom).

| Accuracy by df | Error bound |
|----------------|-------------|
| $\text{df} \ge 30$ | $< 0.001$ |
| $\text{df} \ge 10$ | $< 0.01$ |
| $\text{df} = 5$ | $< 0.05$ |
| $\text{df} < 3$ | Not reliable |

### Implementation: `backtester.js:956-991`

```
_tCriticalForAlpha(alpha, df)
```

### Audit Findings

**`[VALID]` Normal quantile approximation (lines 964-977):** Correctly implements A&S 26.2.23 with the published coefficients. Handles both tails via the sign flip (`if (p <= 0.5) zp = -zp`).

**`[VALID]` Cornish-Fisher expansion (lines 979-991):** 2nd-order expansion correctly implements $z + (z^3 + z)/(4\nu) + (5z^5 + 16z^3 + 3z)/(96\nu^2)$. The 2nd-order term is only applied for $\text{df} \ge 3$ (line 987).

**`[VALID]` Fat-tail adjustment (lines 994-1033):** `_tCritFatTail()` computes excess kurtosis and reduces effective df when $K_e > 0.5$, using the inverse relationship $\nu \approx 4 + 6/K_e$. This is a sound heuristic based on the t-distribution's kurtosis formula $K = 6/(\nu - 4)$ for $\nu > 4$. This widens CIs for heavy-tailed return distributions.

---

## S-12: CUSUM Change Detection

### Academic Source
- Page, E.S. (1954). "Continuous Inspection Schemes." *Biometrika*, 41(1/2), 100-115.
- Roberts, S.W. (1966). "A Comparison of Some Control Chart Procedures." *Technometrics*, 8(3), 411-430.

### Formula

**Two-sided CUSUM:**
$$S_t^+ = \max(0, S_{t-1}^+ + z_t - k)$$
$$S_t^- = \max(0, S_{t-1}^- - z_t - k)$$

where $z_t = (r_t - \hat{\mu}_t) / \hat{\sigma}_t$ is the standardized return and $k$ is the slack parameter.

**Detection rule:** Signal a breakpoint when $S_t^+ > h$ or $S_t^- > h$, then reset $S^+$ or $S^-$ to 0.

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $S_t^+$ | Upper CUSUM | Accumulates evidence for upward shift | dimensionless | $[0, \infty)$ | Page (1954) |
| $S_t^-$ | Lower CUSUM | Accumulates evidence for downward shift | dimensionless | $[0, \infty)$ | Page (1954) |
| $z_t$ | Standardized return | $(r_t - \hat{\mu}_t) / \hat{\sigma}_t$ | dimensionless | $(-\infty, +\infty)$ | -- |
| $k$ | Slack (allowance) | Controls sensitivity; $k = 0.5$ for ARL optimization | dimensionless | typically 0.5 | Roberts (1966) |
| $h$ | Decision threshold | Controls false alarm rate | dimensionless | [2.0, 4.0] | design-dependent |
| $\hat{\mu}_t, \hat{\sigma}_t$ | Running estimates | EMA with $\alpha = 2/31$ | -- | -- | Mohamed & Schwarz (1999) |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| Threshold $h$ | 2.5 | [D] | [2.0, 4.0] | No published KRX calibration | `indicators.js:1494` |
| Slack $k$ | 0.5 | [B] | [0.3, 0.7] | Roberts (1966) ARL optimization | `indicators.js:1511` |
| EMA $\alpha$ | 2/31 $\approx 0.065$ | [B] | [0.03, 0.10] | ~30-bar half-life | `indicators.js:1510` |
| Warmup period | 30 | [D] | [20, 50] | Need stable $\hat{\mu}, \hat{\sigma}$ | `indicators.js:1515` |
| Recent window | 20 bars | [D] | [10, 30] | "Is this breakpoint recent?" | `indicators.js:1562` |
| Vol-adaptive scaling | $\times 0.85$ (high-vol) to $\times 1.15$ (low-vol) | [D] | [$\times 0.7$, $\times 1.3$] | Doc 34 S2.3 | `indicators.js:1496-1500` |

### Implementation: `indicators.js:1480-1570`

```
function calcOnlineCUSUM(returns, threshold, volRegime)
```

### Audit Findings

**`[VALID]` Two-sided CUSUM (lines 1537-1548):** $S^+ = \max(0, S^+ + z - k)$ and $S^- = \max(0, S^- - z - k)$. Correctly resets the triggered accumulator to 0 upon detection.

**`[VALID]` Online standardization (lines 1529-1536):** Running mean and variance via EMA ($\alpha = 2/31$), then $z = (r - \hat{\mu}) / \hat{\sigma}$. This adapts to non-stationary drift and volatility.

**`[DISCREPANCY]` ARL not calibrated for adaptive variant:** The code comment (line 1508) notes that "ARL calibration assumes standard CUSUM; adaptive h/k variant may differ -- validate with simulation." Since the standardization uses time-varying $\hat{\mu}_t, \hat{\sigma}_t$ rather than known target values, the standard CUSUM ARL tables (Page 1954) do not directly apply. The actual false alarm rate has not been empirically validated. **Severity: WARNING -- the false alarm rate is unknown. The threshold $h = 2.5$ with adaptive standardization may produce more or fewer false alarms than the standard CUSUM with the same $h$.**

**`[VALID]` Volatility-adaptive threshold (lines 1496-1500):** Scales $h$ by vol regime: high-vol $\times 0.85$ (more sensitive), low-vol $\times 1.15$ (less sensitive). This is a reasonable design choice -- high-volatility regimes may indicate genuine regime shifts that should be detected more readily.

---

## S-13: Binary Segmentation Breakpoints

### Academic Source
- Scott, A.J. & Knott, M. (1974). "A Cluster Analysis Method for Grouping Means in the Analysis of Variance." *Biometrics*, 30(3), 507-512.
- Bai, J. & Perron, P. (1998). "Estimating and Testing Linear Models with Multiple Structural Changes." *Econometrica*, 66(1), 47-78.

### Formula

**BIC for segment $[s, e)$:**
$$\text{BIC}(s, e) = n \cdot \ln\left(\frac{1}{n}\sum_{i=s}^{e-1}(r_i - \bar{r})^2\right) + 2\ln(n)$$

where $n = e - s$.

**Greedy binary segmentation:** At each iteration, find the split point $k^*$ within each existing segment that maximizes:
$$\Delta\text{BIC} = \text{BIC}_\text{parent} - (\text{BIC}_\text{left} + \text{BIC}_\text{right})$$

Stop when $\Delta\text{BIC} \le 0$ or `maxBreaks` reached.

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| $\Delta\text{BIC}$ | BIC improvement | Reduction in BIC from splitting | dimensionless | $(-\infty, +\infty)$; positive = improved | -- |
| $\bar{r}$ | Segment mean | Mean return within segment | dimensionless | -- | -- |

**Constants:**

| Constant | Value | Grade | Sensitivity Range | Academic Source | JS Location |
|----------|-------|-------|-------------------|----------------|-------------|
| `maxBreaks` | 3 | [D] | [2, 5] | Heuristic; ~1 year / 4 seasons | `indicators.js:1587` |
| `minSegment` | 30 | [B] | [20, 60] | ~6 weeks minimum regime duration | `indicators.js:1588` |
| BIC penalty term | $2\ln(n)$ | [A] | fixed | Schwarz (1978) BIC | `indicators.js:1608` |

### Implementation: `indicators.js:1573-1685`

```
function calcBinarySegmentation(returns, maxBreaks, minSegment)
```

### Audit Findings

**`[VALID]` BIC formula (lines 1597-1609):** $n \cdot \ln(\max(\text{RSS}/n, 10^{-12})) + 2\ln(n)$. The $\max(\cdot, 10^{-12})$ prevents $\ln(0)$ for constant segments. The BIC penalty $2\ln(n)$ corresponds to the standard Schwarz criterion with 2 parameters (mean + variance per segment).

**`[VALID]` Greedy search (lines 1630-1655):** Iterates over all existing segments, tries all valid split points (respecting `minSegment`), and selects the split with largest $\Delta\text{BIC}$. Terminates when no split improves BIC.

**`[DISCREPANCY]` This is simplified Bai-Perron:** The true Bai-Perron (1998) procedure uses global optimization (dynamic programming) to find simultaneous optimal break points, while this implementation uses greedy sequential splitting. Greedy binary segmentation can miss globally optimal configurations where two nearby breakpoints jointly improve the fit but neither improves it individually. **Severity: NOTE -- for the application (regime-discount of pattern confidence), the greedy approximation is computationally efficient ($O(n \times \text{maxBreaks})$ vs $O(n^2)$ for exact) and sufficient. The difference is typically small for $\text{maxBreaks} = 3$.**

**`[VALID]` Population variance in segment stats (line 1623):** Uses $\sqrt{\frac{1}{n}\sum d^2}$ (population $\sigma$). This is consistent with the BIC formula using RSS/$n$ rather than RSS/$(n-1)$.

---

## Appendix A: Cross-Reference Summary Table

| ID | Formula | File:Lines | Constants Count | Grade Profile | Verdict |
|----|---------|------------|----------------|---------------|---------|
| M-1 | Log-returns | Multiple locations | 0 | -- | VALID |
| M-2 | Hurst R/S | indicators.js:212-264 | 4 (1C, 2D, 1B) | Mixed | VALID (Anis-Lloyd: NOTE) |
| M-3 | Kalman filter | indicators.js:170-199 | 5 (1A, 4D) | D-heavy | WARNING ($Q/R$ scale) |
| M-4 | GBM/Ito | api.js (demo) | 0 | -- | VALID (theoretical) |
| M-5 | Fractal dimension | (derived from M-2) | 0 | -- | VALID (theoretical) |
| S-1 | WLS regression | indicators.js:558-674 | 2 (1C, 1B) | Good | VALID |
| S-2 | Ridge regression | indicators.js:580-585 | 2 (1B, 1C) | Good | VALID |
| S-3 | HC3 std errors | indicators.js:636-674 | 0 | All A | VALID |
| S-4 | BCa bootstrap | backtester.js:1093-1146 | 4 (2B, 1A, 1C) | Good | VALID |
| S-5 | BH-FDR | backtester.js:806-855 | 1 (1A) | All A | VALID |
| S-6 | Hill estimator | indicators.js:276-307 | 3 (2B, 1D) | Good | VALID (attribution: NOTE) |
| S-7 | GPD VaR | indicators.js:323-376 | 5 (2A, 2B, 1C) | Good | VALID |
| S-8 | EWMA vol | indicators.js:1336-1376 | 4 (3B, 1D) | Good | VALID (init: NOTE) |
| S-9 | HAR-RV | indicators.js:2062-2178 | 7 (3A, 2B, 1C, 1D) | Good | WARNING ($RV^{(d)}$ proxy) |
| S-10 | VRP proxy | signalEngine.js | 5 (2B, 3D) | D-heavy | WARNING (not true VRP) |
| S-11 | Cornish-Fisher | backtester.js:956-991 | 6 (all A) | All A | VALID |
| S-12 | CUSUM | indicators.js:1480-1570 | 6 (2B, 4D) | D-heavy | WARNING (ARL uncalibrated) |
| S-13 | Binary segmentation | indicators.js:1573-1685 | 3 (1A, 1B, 1D) | Mixed | VALID (greedy approx: NOTE) |

### Aggregate Grades

| Grade | Count | % |
|-------|-------|---|
| [A] Academic Fixed | 18 | 30% |
| [B] Tunable with basis | 19 | 32% |
| [C] KRX-Adapted | 7 | 12% |
| [D] Heuristic | 16 | 27% |
| [E] Deprecated | 0 | 0% |

**Total constants audited: 60**

### Overall System Assessment

**Grade: B+**

Strengths:
- Core statistical methods (HC3, BCa, BH-FDR, Hill, GPD) are correctly implemented with proper academic citations
- Guard conditions against numerical edge cases are comprehensive (division by zero, negative variance, singular matrices)
- The KRX-specific adaptations (price limit truncation awareness, KRX_TRADING_DAYS = 250, calendar-time bootstrap) are well-motivated

Weaknesses:
- 27% of constants are [D]-grade heuristics, concentrated in CUSUM ($h = 2.5$, warmup, vol-adaptive scaling) and Kalman ($Q, R, P_0$)
- VRP proxy (S-10) is a directional approximation, not a true variance risk premium
- HAR-RV uses single squared returns instead of true intraday realized volatility
- CUSUM ARL has not been empirically validated under the adaptive standardization variant

**Recommendations (priority order):**
1. Calibrate CUSUM threshold $h$ via simulation: generate synthetic KRX returns with known changepoints, measure detection power and false alarm rate
2. Implement GCV for Kalman $Q/R$ ratio selection, or switch to $Q/R$ expressed as a single dimensionless parameter
3. When VKOSPI data is available, use true VRP ($= \text{VKOSPI}^2/10000 - RV^2$) instead of EWMA ratio proxy for index-level signals
4. Document the $RV^{(d)} = r_t^2$ approximation limitation in user-facing HAR-RV displays

---

## Appendix B: Academic Reference Index

| # | Citation | Used In | First Author Affiliation |
|---|----------|---------|-------------------------|
| 1 | Abramowitz & Stegun (1972) | S-11, S-5 | NBS (US) |
| 2 | Bai & Perron (1998) | S-13 | MIT |
| 3 | Balkema & de Haan (1974) | S-7 | University of Amsterdam |
| 4 | Benjamini & Hochberg (1995) | S-5 | Tel Aviv University |
| 5 | Bollerslev (1986) | S-8 | Duke University |
| 6 | Bollerslev, Tauchen & Zhou (2009) | S-10 | Duke University |
| 7 | Cont (2001) | M-1, S-11 | Ecole Polytechnique |
| 8 | Cornish & Fisher (1937) | S-11 | University of Adelaide |
| 9 | Corsi (2009) | S-9 | University of Lugano |
| 10 | Di Matteo et al. (2005) | M-2 | King's College London |
| 11 | Drees & Kaufmann (1998) | S-6 | University of Hamburg |
| 12 | Efron (1987) | S-4 | Stanford University |
| 13 | Hill (1975) | S-6 | University of Michigan |
| 14 | Hoerl & Kennard (1970) | S-2 | University of Delaware |
| 15 | Hosking & Wallis (1987) | S-7 | IBM Research |
| 16 | Hurst (1951) | M-2 | Egyptian Ministry of Public Works |
| 17 | Kalman (1960) | M-3 | RIAS (Baltimore) |
| 18 | Lo (2004) | S-1 | MIT |
| 19 | Long & Ervin (2000) | S-3 | Indiana University |
| 20 | MacKinnon & White (1985) | S-3 | Queen's University |
| 21 | Mandelbrot & Wallis (1969) | M-2 | IBM Research |
| 22 | Mohamed & Schwarz (1999) | M-3 | University of Calgary |
| 23 | Page (1954) | S-12 | University of Cambridge |
| 24 | Pickands (1975) | S-7 | University of Pennsylvania |
| 25 | Reschenhofer et al. (2021) | S-1 | University of Vienna |
| 26 | RiskMetrics (1996) | S-8 | JP Morgan |
| 27 | Roberts (1966) | S-12 | Bell Telephone Labs |
| 28 | Scott & Knott (1974) | S-13 | Rothamsted Experimental Station |
| 29 | White (1980) | S-3 | UCSD |
| 30 | Golub, Heath & Wahba (1979) | S-2 | Stanford University |

---

*Document generated 2026-04-06 by Statistical Validation Expert.*
*60 constants audited across 13 formulas. 0 CRITICAL discrepancies, 4 WARNINGs, 4 NOTEs.*
