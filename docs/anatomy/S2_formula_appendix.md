# Stage 2: Formula Appendix -- Detailed Derivations

> ANATOMY V5 -- Complete derivation chains for all formulas in S2 Sections 2.1-2.2
> Convention: [ID] matches the formula identifier in S2_theoretical_basis.md
> Code locations: absolute file paths with line numbers as of 2026-04-06

---

## Table of Contents

| ID | Formula | Implementation | Grade Summary |
|----|---------|----------------|---------------|
| M-1 | Bayes' Theorem | backtester.js (Beta-Binomial) | All [A] |
| M-2 | Random Walk | N/A (null hypothesis) | [A] |
| M-3 | GBM / Black-Scholes | api.js demo mode | [A] except KRX_TRADING_DAYS [C] |
| M-4 | Martingale | appWorker.js HMM regime | [A] |
| M-5 | Jump-Diffusion | Pattern gap detection | [A] |
| M-6 | Hurst R/S | indicators.js:212-264 | 1[A], 1[B], 1[C], 1[D] |
| M-7 | Hurst Shrinkage | patterns.js:230-237 | 1[A], 2[B], 1[C], 1[D] |
| M-8 | Levy Stable | Theoretical reference | [A] |
| M-9 | Power Law Tail | indicators.js:276-307 | 1[A], 1[B] |
| M-10 | Shannon Entropy | signalEngine.js (indirect) | [A] |
| M-11 | KL Divergence | Theoretical reference | [A] |
| M-12 | Fisher Information | Theoretical reference | [A] |
| S-1 | Stationarity | calcHurst log-returns | [A] |
| S-2 | ADF Test | Not implemented (Python MRA) | N/A |
| S-3 | ACF | calcHurst (implicit) | [A] |
| S-4 | GARCH(1,1) | indicators.js:1336-1376 (EWMA) | 3[B] |
| S-5 | WLS | indicators.js:558-749 | 1[C] (lambda) |
| S-6 | Ridge | indicators.js:581-585 | 1[C] (lambda=GCV auto) |
| S-7 | HC3 | indicators.js:636-674 | 1[A] |
| S-8 | VIF | indicators.js:676-733 | [A] |
| S-9 | GEV | Theoretical reference | [A] |
| S-10 | GPD | indicators.js:323-376 | 1[A], 2[B] |
| S-11 | Hill Estimator | indicators.js:276-307 | 1[A], 1[B] |
| S-12 | Beta-Binomial | backtester.js | [A] |
| S-13 | Mean Reversion | patterns.js:245-250 | 1[B], 1[C], 2[D] |
| S-14 | BCa Bootstrap | backtester.js | [A] |
| S-15 | BH-FDR | backtester.js | 1[B] |
| S-16 | Cornish-Fisher | backtester.js _tCriticalForAlpha() (lines 976-1010) | All [A] |
| S-17 | Kalman Filter | indicators.js:170-199 | 1[A], 1[B], 2[C] |
| S-18 | VRP Proxy | signalEngine.js, indicators.js | 3[D] |
| S-19 | WLS 6-Variable | backtester.js:590-614 | [B] |

### V5 to V7 Formula ID Mapping

> This appendix (V5) uses Derivation IDs (D-1 through D-19).
> The main theoretical basis (V7) uses Section IDs (M-* and S-*).
> The following table maps between them.

| Derivation | Topic | V5 Appendix ID | V7 Section ID | Status |
|-----------|-------|----------------|---------------|--------|
| D-1 | Hurst R/S | M-6 | M-2 | V7 canonical |
| D-2 | Hurst Shrinkage | M-7 | -- | V5-only |
| D-3 | Hill Estimator | S-11 | S-6 | V7 canonical |
| D-4 | GPD Tail Model | S-10 | S-7 | V7 canonical |
| D-5 | WLS/Ridge/HC3 | S-5,S-6,S-7 | S-1,S-2,S-3 | V7 canonical |
| D-6 | EWMA Volatility | S-4 | S-8 | V7 canonical |
| D-7 | Mean Reversion | -- | -- | V5-only |
| D-8 | Cornish-Fisher | S-16 | S-11 | V7 canonical |
| D-9 | Kalman Filter | S-17 | M-3 | V7 canonical |
| D-10 | Parkinson HV | -- | S-14 | NEW in V7 |
| D-11 | VRP Calculation | S-18 | S-10 | V7 canonical |
| D-12 | SW Beta | -- | S-15 | NEW in V7 |
| D-13 | Vol Regime | S-13 | S-16 | NEW in V7 |
| D-14 | Huber-IRLS | -- | -- | NEW (this session) |
| D-15 | Beta-Binomial | -- | S-12 | V7 canonical |
| D-16 | BCa Bootstrap | -- | S-4 | V7 canonical |
| D-17 | CUSUM ARL | -- | S-12 | V7 canonical |
| D-18 | GCV Eigendecomp | -- | S-2 | V7 canonical |
| D-19 | Walk-Forward | -- | -- | NEW (this session) |

---

## Derivation D-1: Hurst Exponent R/S Analysis [V7: M-2]

> **Log-return definition and rationale:** See V7 M-1 (S2_theoretical_basis_v7.md section M-1).

### Step 2: Block partition

For block size w (ranging from minWindow=10 to floor(T/2), step factor 1.5):

```
numBlocks = floor(T / w)
block_b = returns[b*w : (b+1)*w],  b = 0, 1, ..., numBlocks-1
```

The geometric step factor 1.5 produces logarithmically spaced window sizes:
w = 10, 15, 22, 33, 50, 75, 112, ...

Code reference: indicators.js:225-226

### Step 3: R/S for each block

For each block of length w:

```
mean = (1/w) * sum(block)
deviations = block - mean
cumDevs[k] = sum(deviations[0..k])
R = max(cumDevs) - min(cumDevs)      (rescaled range)
S = sqrt((1/w) * sum(deviations^2))   (population std)
```

Note: Population standard deviation (divisor w, not w-1) is used per
Mandelbrot & Wallis (1969) convention for R/S analysis. This is correct
for R/S but differs from the sample std convention in most statistics.

If S = 0 (flat price block), the block is excluded from averaging.

Code reference: indicators.js:229-241

### Step 4: Log-log regression

Average R/S across valid blocks for each w:

```
RS_avg(w) = (1/validBlocks) * sum(R/S per block)
```

Then perform OLS on:

```
log(RS_avg) = H * log(w) + c
```

The slope H is the Hurst exponent.

Numerically:

```
H = (n * sum(logN * logRS) - sum(logN) * sum(logRS)) /
    (n * sum(logN^2) - sum(logN)^2)
```

Code reference: indicators.js:248-256

### Step 5: R-squared quality metric

```
R^2 = SS_reg / SS_tot
SS_tot = sum(logRS^2) - (sum(logRS))^2 / n
SS_reg = (n * sum(logN * logRS) - sum(logN) * sum(logRS))^2 / (n * denom)
```

Code reference: indicators.js:258-262

### Minimum data guard

Requires: closes.length >= 4*minWindow + 1 = 41 (for minWindow=10)
This ensures at least 4 distinct window sizes for log-log regression,
providing a meaningful slope estimate.

Code reference: indicators.js:214

---

## Derivation D-2: James-Stein Hurst Shrinkage [V5-only: M-7]

### Theoretical foundation

James & Stein (1961) proved that for dimension p >= 3, the MLE theta_hat
of a multivariate normal mean is inadmissible under squared error loss.
The James-Stein estimator:

```
theta_JS = (1 - c / ||X||^2) * X + (c / ||X||^2) * mu_prior
c = (p - 2) * sigma^2
```

dominates the MLE uniformly (lower risk for every theta).

Efron & Morris (1973) showed this is equivalent to the empirical Bayes
posterior mean under a Normal-Inverse-Gamma prior:

```
theta_EB = (n_eff / (n_eff + k)) * theta_MLE + (k / (n_eff + k)) * theta_prior
```

### Application to Hurst

For a single Hurst estimate H from N price observations:

**Step 1: Effective sample size**

```
n_eff = floor(log(N/20) / log(1.5))
```

Rationale: R/S analysis uses overlapping sub-samples, so information grows
sub-linearly with data length. The log(N/20)/log(1.5) form says:
- At N=30 (minimum): n_eff = floor(log(1.5)/log(1.5)) = 1
- At N=200: n_eff = 5
- At N=1000: n_eff = 9

The base 1.5 is the same geometric step factor used in R/S block sizes.
While this creates internal consistency, the value 1.5 itself lacks
academic derivation (Grade [D]).

**Step 2: Shrinkage coefficient**

```
shrinkage = n_eff / (n_eff + 20)
```

The prior strength k=20 means: "the prior is as informative as 20
effective observations." Since n_eff rarely exceeds 10, the prior
(H=0.5) always dominates substantially.

| N | n_eff | shrinkage | Interpretation |
|---|-------|-----------|----------------|
| 30 | 1 | 0.05 | 95% prior (nearly pure H=0.5) |
| 100 | 4 | 0.17 | 83% prior |
| 500 | 7 | 0.26 | 74% prior |
| 1000 | 9 | 0.31 | 69% prior |

**Step 3: Shrunk Hurst**

```
H_shrunk = shrinkage * H + (1 - shrinkage) * 0.5
```

For N=500, H_raw=0.7: H_shrunk = 0.26*0.7 + 0.74*0.5 = 0.552
The extreme H=0.7 is pulled toward the random walk prior.

**Step 4: Weight conversion**

```
hw = clamp(2 * H_shrunk, 0.6, 1.4)
```

The factor 2 maps [0.3, 0.7] -> [0.6, 1.4], with clamp preventing extremes.

Code reference: patterns.js:230-237

---

## Derivation D-3: Hill Tail Index Estimator [V7: S-6]

### Setup

Given returns r_1, ..., r_n, take absolute values and sort descending:

```
|r|_(1) >= |r|_(2) >= ... >= |r|_(n)
```

### Hill estimator for the top k order statistics

```
H_k = (1/k) * sum_{i=1}^{k} [ln(|r|_(i)) - ln(|r|_(k+1))]

alpha_hat = 1 / H_k = k / sum_{i=1}^{k} [ln(|r|_(i)) - ln(|r|_(k+1))]
```

The index k is the (k+1)-th order statistic in 0-indexed arrays.
Code uses absRet[k] as the threshold (indicators.js:291).

### Automatic k selection

```
k = max(2, floor(sqrt(n)))
```

For n=500: k=22. For n=1000: k=31.

This is a common rule of thumb. Drees & Kaufmann (1998) propose a
data-adaptive bootstrap method that minimizes MSE, but it is computationally
expensive. The sqrt(n) rule provides a reasonable bias-variance tradeoff
for routine application.

### Standard error (IID assumption)

Under the IID assumption:

```
SE(alpha_hat) = alpha_hat / sqrt(k)
```

This is the asymptotic standard error from Hill (1975). The code correctly
flags (in comments, line 304) that this SE is invalid for serially dependent
data. For time-dependent returns, a block bootstrap or the Drees (2000)
variance estimator should be used.

### Heavy tail classification

```
isHeavyTail = (alpha < 4)
```

When alpha < 4, the fourth moment (kurtosis) of the return distribution
is infinite or undefined. This means:
- Normal-based confidence intervals are unreliable
- Sample variance converges very slowly
- EVT methods (GPD) are necessary for tail risk quantification

Code reference: indicators.js:276-307

---

## Derivation D-4: GPD Fit via Probability Weighted Moments [V7: S-7]

### Step 1: Threshold selection

Sort absolute returns descending. Set threshold at the 5th percentile:

```
u = absRet[floor(n * 0.05)]
```

This typically gives 25-50 exceedances for 500-1000 data points.

### Step 2: Compute exceedances

```
y_i = |r|_(i) - u,  for all i where |r|_(i) > u
Nu = count of exceedances
```

Code requires Nu >= 20 for stable estimation (indicators.js:347).

### Step 3: PWM estimation (Hosking & Wallis 1987)

Sort exceedances ascending: y_{[1]} <= y_{[2]} <= ... <= y_{[Nu]}

Probability Weighted Moments:

```
beta_0 = (1/Nu) * sum_{i=0}^{Nu-1} y_{[i+1]}
beta_1 = (1/Nu) * sum_{i=0}^{Nu-1} y_{[i+1]} * (i / (Nu-1))
```

Note: The i/(Nu-1) weighting assigns higher weight to larger exceedances,
capturing the tail shape.

### Step 4: Parameter estimation

```
denom = beta_0 - 2 * beta_1

xi_hat = 2 - beta_0 / denom
sigma_hat = 2 * beta_0 * beta_1 / denom
```

**Validity check:** PWM estimator requires xi < 0.5 (Hosking & Wallis 1987).
When xi >= 0.5, the estimate is clamped to 0.499 (indicators.js:365).
This is a pragmatic guard; for xi > 0.5, MLE would be more appropriate
but is computationally heavier.

### Step 5: VaR calculation

```
VaR_p = u + (sigma/xi) * [((n/Nu) * (1-p))^(-xi) - 1]
```

For p=0.99 (99% VaR):
- ratio = (n/Nu) * 0.01
- If n=500, Nu=25: ratio = 0.2
- VaR_0.99 = u + (sigma/xi) * (0.2^(-xi) - 1)

The term (n/Nu) adjusts for the proportion of data above the threshold.

Code reference: indicators.js:323-376

---

## Derivation D-5: WLS with Ridge and HC3 [V7: S-1, S-2, S-3]

### Full pipeline derivation

**Input:**
- X: n x p design matrix (with intercept in column 0)
- y: n x 1 response (forward returns)
- w: n x 1 time-decay weights: w_i = 0.995^(T - t_i)
- lambda: GCV auto-selected (indicators.js:826 selectRidgeLambdaGCV), fallback 1.0

**Step 1: Form weighted cross-product**

```
X^T W X = sum_i w_i * x_i x_i^T    (p x p matrix)
X^T W y = sum_i w_i * x_i * y_i     (p x 1 vector)
```

Code: indicators.js:562-578

**Step 2: Ridge penalty**

```
(X^T W X)_jj += lambda,  for j = 1, ..., p-1   (skip intercept j=0)
```

Code: indicators.js:581-585

**Step 3: Matrix inversion via Gauss-Jordan**

```
inv = (X^T W X + lambda*I_*)^{-1}
```

where I_* has 0 in the (0,0) position (no intercept penalty).

Code: indicators.js:588 -> _invertMatrix()

**Step 4: Coefficient estimation**

```
beta_hat = inv * X^T W y
```

Code: indicators.js:592-597

**Step 5: Residuals and R-squared**

```
fitted_i = x_i^T * beta_hat
e_i = y_i - fitted_i
R^2 = 1 - (sum w_i e_i^2) / (sum w_i (y_i - y_bar_w)^2)
```

where y_bar_w is the weighted mean.

Adjusted R^2 = 1 - (1-R^2)(n-1)/(n-p-1)   (Theil 1961)

Code: indicators.js:600-621

**Step 6: OLS standard errors**

```
sigma_hat^2 = sum w_i e_i^2 / (n - p)
SE_j = sqrt(sigma_hat^2 * inv_jj)
t_j = beta_j / SE_j
```

Code: indicators.js:624-634

**Step 7: HC3 heteroskedasticity-consistent standard errors**

For each observation i:

```
h_ii = w_i * x_i^T * inv * x_i    (leverage, hat matrix diagonal)
h_ii = min(h_ii, 0.99)             (guard against perfect leverage)
denom = (1 - h_ii)^2                (HC3 correction)
```

Meat matrix (the "B" in the sandwich):

```
B_jk = sum_i w_i^2 * e_i^2 / (1-h_ii)^2 * x_ij * x_ik
```

Sandwich estimator:

```
Cov_HC3 = inv * B * inv
HC3_SE_j = sqrt(max(0, (inv * B * inv)_jj))
HC3_t_j = beta_j / HC3_SE_j
```

Code: indicators.js:636-674

**Verification against canonical form:** The WLS HC3 sandwich is
`Cov_HC3_WLS = (X'WX)^{-1} [sum (w_i * e_i)^2/(1-h_ii)^2 * x_i x_i'] (X'WX)^{-1}`.
The code (indicators.js:654) computes `w^2 * e^2 / (1-h)^2 * x x'`, matching this form exactly. VALID.

**Step 8: VIF diagnostics**

For each predictor j (j >= 1, skip intercept):
1. Construct auxiliary design matrix Z = X without column j
2. Regress X[:,j] on Z by OLS
3. Compute R^2_j of auxiliary regression
4. VIF_j = 1 / (1 - R^2_j)

Code: indicators.js:676-733

---

## Derivation D-6: EWMA Volatility [V7: S-8]

### Initialization

Compute log-returns: r_i = ln(P_i / P_{i-1})

Initial variance: sample variance of first min(20, n-1) returns:

```
init_var = (1/N) * sum(r_i^2) - ((1/N) * sum(r_i))^2
```

Note: This uses the population variance formula (divisor N, not N-1).
For the first 20 returns, the bias is (20-1)/20 = 0.95, negligible.

Guard: if init_var <= 0 (flat price), set to 1e-8.

Code: indicators.js:1350-1359

### EWMA recursion

```
sigma^2_t = lambda * sigma^2_{t-1} + (1-lambda) * r^2_{t-1}
result_t = sqrt(sigma^2_t)
```

This is IGARCH (Integrated GARCH) with omega = 0, alpha = 1-lambda, beta = lambda.
The alpha + beta = 1 condition means the model has a unit root in variance --
shocks have permanent effects on the variance level.

For a proper GARCH(1,1) with alpha + beta < 1, the unconditional variance is:

```
sigma^2_infinity = omega / (1 - alpha - beta)
```

The EWMA (IGARCH) assumption of zero unconditional variance is a known limitation:
it means past shocks never fully decay. However, for financial applications with
daily horizons, this approximation is adequate because alpha + beta is typically
0.97-0.99, and the true unconditional variance mean-reverts very slowly.

**Half-life derivation:**

The weight of a return r_{t-k} in the current variance estimate is:

```
w(k) = (1-lambda) * lambda^k
```

Half-life h solves w(h) = w(0)/2:

```
lambda^h = 1/2
h = ln(2) / ln(1/lambda) = ln(2) / (-ln(lambda))
```

| lambda | Half-life (days) | Use case |
|--------|-----------------|----------|
| 0.86 | 4.6 | VRP short-term volatility |
| 0.94 | 11.2 | RiskMetrics default, daily vol |
| 0.97 | 22.7 | VRP long-term volatility |

Code: indicators.js:1336-1376

---

## Derivation D-7: Mean Reversion Weight (OU-Based) [V5-only]

### Ornstein-Uhlenbeck process

The continuous-time mean-reversion model:

```
dX(t) = kappa * (mu - X(t)) * dt + sigma * dW(t)
```

The expected value of X(t) given X(0) = x_0:

```
E[X(t)] = mu + (x_0 - mu) * exp(-kappa * t)
```

The half-life (time for displacement to halve):

```
t_{1/2} = ln(2) / kappa
```

### Discrete approximation

For the pattern system, the "displacement" is measured in ATR units:

```
moveATR = |close - MA50| / ATR14
```

The exponential decay weight:

```
w(excess) = exp(-kappa * excess)
```

where excess = max(0, moveATR - 3) and kappa = ln(2) / 5 = 0.1386.

This means: at moveATR = 8 (excess = 5), the weight is exp(-0.693) = 0.5.

| moveATR | excess | mw | Interpretation |
|---------|--------|-----|----------------|
| 0-3 | 0 | 1.0 | Normal displacement, no discount |
| 5 | 2 | 0.76 | Moderate stretch |
| 8 | 5 | 0.50 | Half-life: 50% discount |
| 11 | 8 | 0.33 | Extreme stretch |
| 15+ | 12+ | 0.60 | Clamped at lower bound |

The 3 ATR threshold is motivated by the normal 3-sigma rule (99.7%),
but financial returns are fat-tailed, so the actual 99.7th percentile
of moveATR may be higher than 3. This is Grade [C] -- calibration against
the empirical KRX moveATR distribution is recommended.

Code reference: patterns.js:245-250

---

## Derivation D-8: Cornish-Fisher t-Quantile Approximation [V7: S-11]

### Problem

Given alpha and degrees of freedom df, compute t_{alpha, df}
(the t-distribution quantile) without a t-distribution lookup table.

### Step 1: Normal quantile (Abramowitz & Stegun 26.2.23)

For p = 1 - alpha/2 (upper tail):

```
t = sqrt(-2 * ln(1 - p))
z_p = t - (c0 + c1*t + c2*t^2) / (1 + d1*t + d2*t^2 + d3*t^3)
```

Coefficients (Hastings 1955, as tabulated in A&S):

```
c0 = 2.515517, c1 = 0.802853, c2 = 0.010328
d1 = 1.432788, d2 = 0.189269, d3 = 0.001308
```

Max |error| < 4.5e-4 over all p in (0, 1).

### Step 2: Cornish-Fisher correction (normal -> t)

```
t_quantile = z + (z^3 + z) / (4*df) + (5*z^5 + 16*z^3 + 3*z) / (96*df^2)
```

This is a 2nd-order expansion in 1/df. For large df, t -> z (t-distribution
approaches normal). For small df, the correction adds mass to the tails.

### Accuracy analysis

> **Numerical accuracy analysis:** Migrated to V7 S-11 (S2_theoretical_basis_v7.md §S-11, Appendix: Numerical Accuracy).

Code reference: backtester.js _tCriticalForAlpha() (lines 976-1010)

---

## Derivation D-9: Adaptive Kalman Filter [V7: M-3]

> **State-space model, prediction, and update equations:** See V7 M-3 (S2_theoretical_basis_v7.md section M-3).
> Only the adaptive-Q extension is derived below (unique to this appendix).

### Adaptive Q (Mohamed & Schwarz 1999)

```
ewmaVar_t = 0.06 * r_t^2 + 0.94 * ewmaVar_{t-1}
meanVar_t = cumulative average of ewmaVar

Q_t = Q_base * (ewmaVar_t / meanVar_t)
```

When current volatility exceeds the running average (ewmaVar/meanVar > 1),
Q_t increases, making the filter more responsive (higher K). In low
volatility periods, Q_t decreases, making the filter smoother.

**Return type note:** The Kalman filter operates on price levels (closing prices),
NOT log-returns. The output `x_t` is a smoothed price estimate. The innovation
`z_t - x_{t|t-1}` is a simple price difference, not a log-return. See V7 M-3
for the complete state-space specification.

**Behavior at extremes:**
- High vol: K -> ~0.5, filter tracks price closely
- Low vol: K -> ~0.01, filter produces very smooth output

Code reference: indicators.js:170-199

---

## Derivation D-10: Parkinson Historical Volatility [V7: S-14]

### Formula

$$HV_{Parkinson} = \sqrt{\frac{1}{4n \ln 2} \sum_{i=1}^{n} [\ln(H_i / L_i)]^2} \times \sqrt{250}$$

### Derivation

Parkinson (1980) showed that for a continuous GBM process, the range-based
volatility estimator is approximately 5x more efficient than close-to-close
estimator. The theoretical result:

```
E[ln(H/L)^2] = 4 * ln(2) * sigma^2 * dt
```

where sigma is the diffusion coefficient and dt is the time step.

Rearranging:

```
sigma^2 = E[ln(H/L)^2] / (4 * ln(2) * dt)
```

For daily data with dt=1:

```
sigma^2_daily = (1/(4n*ln2)) * sum[ln(H_i/L_i)^2]
sigma_annual = sqrt(sigma^2_daily) * sqrt(250)
```

**KRX-specific considerations:**
- Price limits (+/-30%) truncate the high-low range, potentially
  downward-biasing the Parkinson estimator for extreme days
- KOSDAQ small-caps with low volume may have compressed ranges
  that underestimate true volatility
- The system uses validCount (not period n) for averaging,
  skipping invalid candles (indicators.js:516)

Code reference: indicators.js:481-522

---

## Derivation D-11: VRP Calculation [V7: S-10]

### Formula

```
VRP = IV^2 - HV^2
    = (VKOSPI/100)^2 - HV_Parkinson^2
```

### Unit reconciliation

VKOSPI is reported as a percentage (e.g., 20.5 = 20.5% annualized).
HV from calcHV() is returned as a decimal (e.g., 0.205 = 20.5% annualized).

The code divides VKOSPI by 100 before squaring:

```
ivDecimal = vkospi / 100;         // 20.5 -> 0.205
return ivDecimal * ivDecimal - hvAnnualized * hvAnnualized;
```

Both terms are in (annualized decimal)^2 units, so the subtraction is
dimensionally consistent.

**Interpretation:**
- VRP > 0: IV overprices realized vol (normal state, options are "expensive")
- VRP < 0: realized vol exceeds IV (crisis state, options were "cheap")

Code reference: indicators.js:536-543

---

## Derivation D-12: CAPM Beta with Scholes-Williams Correction [V7: S-15]

### Standard OLS Beta

```
beta_0 = Cov(r_stock, r_market) / Var(r_market)
       = sum((r_i - mean_r)(r_m - mean_m)) / sum((r_m - mean_m)^2)

alpha = mean_r - beta_0 * mean_m
```

### Scholes-Williams (1977) thin-trading correction

When a stock has >10% zero-return days (thin trading), the OLS beta is
biased downward because prices update slowly. The correction uses
lead/lag betas:

```
beta_lag  = Cov(r_{stock,t}, r_{market,t-1}) / Var(r_market)
beta_lead = Cov(r_{stock,t}, r_{market,t+1}) / Var(r_market)
rho_m     = autocorrelation of market returns

beta_SW = (beta_lag + beta_0 + beta_lead) / (1 + 2*rho_m)
```

The denominator (1 + 2*rho_m) accounts for the market return's own
autocorrelation, which would otherwise inflate the combined beta.

**Guard:** if |1 + 2*rho_m| < 0.01, the Scholes-Williams correction is
skipped to avoid numerical instability (indicators.js:453).

Code reference: indicators.js:391-477

---

## Derivation D-13: Volatility Regime Classification [V7: S-16]

### Formula

```
longRunEMA_t = alpha * sigma_t + (1-alpha) * longRunEMA_{t-1},  alpha = 0.01
ratio_t = sigma_t / longRunEMA_t

Classification:
  ratio < 0.75  ->  'low'   (below 75% of long-run level)
  0.75 <= ratio <= 1.50  ->  'mid'   (normal range)
  ratio > 1.50  ->  'high'  (above 150% of long-run level)
```

### EMA half-life

For alpha = 0.01, the half-life of the long-run EMA is:

```
h = -ln(2) / ln(1-alpha) = -0.693 / ln(0.99) = 0.693 / 0.01005 = 69 bars
```

This means the long-run volatility estimate adapts with a half-life of
~69 trading days (~3 months). The JSDoc comment says "~100 bar half-life"
which is approximate (half-life is exactly 69 for alpha=0.01).

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| VOL_REGIME_LOW | 0.75 | [D] | Heuristic threshold |
| VOL_REGIME_HIGH | 1.50 | [D] | Heuristic threshold |
| EMA alpha | 0.01 | [B] | Long lookback for structural volatility level |

Code reference: indicators.js:1385-1416

---

## Derivation D-14: Huber-IRLS Robust Regression [backtester.js:1859-1885]

### Problem

Standard WLS (Weighted Least Squares) is sensitive to outliers. KRX 5-day
returns exhibit excess kurtosis (~18.7) due to daily limit-up/down (+-30%)
events, meaning fat-tailed residuals violate the Gaussian WLS assumption.
Huber's M-estimation down-weights large residuals via Iteratively Reweighted
Least Squares (IRLS).

### Step 1: Huber loss function

The Huber loss replaces the quadratic loss with a linear penalty beyond
a threshold delta:

```
                 { e^2 / 2                   if |e| <= delta
rho(e; delta) = {
                 { delta * |e| - delta^2 / 2  if |e| > delta
```

This is convex and continuously differentiable (unlike trimmed least squares),
guaranteeing a unique minimum.

### Step 2: Influence function and weights

The psi-function (derivative of rho):

```
psi(e) = d/de rho(e) = { e        if |e| <= delta
                        { delta * sign(e)  if |e| > delta
```

The IRLS weight function w(e) = psi(e) / e:

```
w(e) = { 1              if |e| <= delta
       { delta / |e|    if |e| > delta
```

This is exactly the formula implemented at backtester.js:1875:
`hw = absR > HUBER_DELTA ? HUBER_DELTA / absR : 1.0`

### Step 3: IRLS convergence

At each iteration t, solve the weighted least squares problem:

```
beta^{(t+1)} = argmin sum_i w(e_i^{(t)}) * (y_i - x_i' beta)^2
```

where `e_i^{(t)} = y_i - x_i' beta^{(t)}`. Because Huber's rho is
strictly convex, the IRLS iterates converge to the unique M-estimator
(Huber 1981, Theorem 7.6.1). The convergence is essentially Fisher
scoring applied to the M-estimation score equations. In practice, 3-5
iterations suffice for financial data (Street, Carroll & Ruppert 1988).

### Step 4: Delta = 5.8 calibration for KRX

The canonical Huber delta = 1.345 * sigma achieves 95% asymptotic
efficiency at the Gaussian model. For non-Gaussian returns, sigma
must be estimated robustly:

```
MAD = median(|r_i - median(r)|)    (Median Absolute Deviation)
sigma_MAD = MAD / 0.6745           (consistency factor for normal)
```

Empirical calibration on KRX 5-day returns (2,704 stocks, 2023-2025):

```
MAD of 5-day returns    = 2.91%
sigma_MAD               = 2.91 / 0.6745 = 4.31%
delta = 1.345 * 4.31    = 5.80%
```

The empirical kurtosis is ~18.7 (vs 3.0 for normal), confirming
fat tails that justify robust regression.

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| HUBER_DELTA | 5.8 | [C] | 1.345 * sigma_MAD; sigma_MAD = 4.31 from KRX 5-day returns |
| HUBER_ITERS | 5 | [B] | Street, Carroll & Ruppert (1988): 3-5 for convex M-estimators |

References: Huber (1964) "Robust Estimation of a Location Parameter",
Maronna, Martin & Yohai (2006) "Robust Statistics" Ch.4,
Street, Carroll & Ruppert (1988) JASA 83(404).

Code reference: backtester.js:1859-1885

---

## Derivation D-15: Beta-Binomial Posterior for Pattern Win Rates [S-12]

### Problem

Given a pattern type with prior win rate belief and observed backtest
results, compute the posterior distribution of the true win rate p.
The Beta-Binomial model is the natural choice because the Beta prior
is conjugate to the Binomial likelihood.

### Step 1: Prior specification

For each pattern, the prior encodes empirical win rate from published
studies and initial KRX observations:

```
p ~ Beta(alpha_prior, beta_prior)

alpha_prior = p_0 * n_0
beta_prior  = (1 - p_0) * n_0
```

where p_0 is the prior win rate (e.g., 0.52) and n_0 is the effective
prior sample size (controls prior strength).

### Step 2: Binomial likelihood

Given n independent pattern occurrences with w wins:

```
L(p | w, n) = C(n,w) * p^w * (1-p)^(n-w)
```

### Step 3: Posterior derivation (conjugacy)

```
posterior  proportional to  prior * likelihood
Beta(alpha_post, beta_post) = Beta(alpha_prior + w, beta_prior + (n - w))
```

This follows because:

```
f(p | data) ~ p^(alpha-1) * (1-p)^(beta-1) * p^w * (1-p)^(n-w)
            = p^(alpha+w-1) * (1-p)^(beta+n-w-1)
```

which is the kernel of Beta(alpha + w, beta + n - w).

### Step 4: Posterior mean and credible interval

```
E[p | data] = (alpha + w) / (alpha + beta + n)
```

This is a weighted average of the prior mean alpha/(alpha+beta) and the
MLE w/n, with weights proportional to effective sample sizes. The 95%
credible interval uses Beta quantiles: [B^{-1}(0.025), B^{-1}(0.975)].

### Step 5: Implementation

In `scripts/update_win_rates.py:62-67`, the prior is computed from
empirical win rates. In `backtester.js:288-294`, the posterior mean
`alpha / (alpha + beta) * 100` is injected into PatternEngine for
live win rate display.

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Prior n_0 | 50 (default) | [B] | Effective sample size; pattern-specific in PATTERN_SAMPLE_SIZES |
| Posterior mean | (alpha+w)/(alpha+beta+n) | [A] | Conjugate prior theorem |

References: DeGroot (1970) "Optimal Statistical Decisions",
Gelman et al. (2013) "Bayesian Data Analysis" 3rd ed. Ch.2.

Code reference: scripts/update_win_rates.py:62-106, backtester.js:288-294

---

## Derivation D-16: BCa Bootstrap Confidence Intervals [S-14]

### Problem

Standard percentile bootstrap CIs have poor coverage when the
statistic's sampling distribution is skewed or biased. The BCa
(Bias-Corrected and accelerated) method corrects both deficiencies
by adjusting the percentile cutoffs.

### Step 1: Bootstrap replication

Generate B bootstrap replicates theta_hat*_1, ..., theta_hat*_B by
resampling the original n observations with replacement and computing
the statistic on each resample.

### Step 2: Bias correction factor z_0

The bias-correction z_0 measures median bias of the bootstrap
distribution relative to the original estimate:

```
z_0 = Phi^{-1}( #{theta_hat*_b < theta_hat} / B )
```

where Phi^{-1} is the standard normal quantile function. If the
bootstrap distribution is centered on theta_hat, z_0 = 0. Positive
z_0 means the bootstrap distribution is shifted below theta_hat.

Implementation (backtester.js:1127-1130):
```
countBelow = sum(bootStats[i] < thetaHat for i=1..B)
z0 = normInv(countBelow / B)
```

### Step 3: Acceleration factor a_hat

The acceleration corrects for skewness in the sampling distribution.
It is estimated from jackknife values theta_hat_(i) (statistic computed
with observation i removed):

```
theta_bar = (1/n) * sum(theta_hat_(i))

a_hat = sum( (theta_bar - theta_hat_(i))^3 )
        -------------------------------------------
        6 * [ sum( (theta_bar - theta_hat_(i))^2 ) ]^{3/2}
```

This is the skewness of the influence function, normalized by the cube
of its standard deviation. When a_hat = 0, BCa reduces to BC (bias-corrected
only).

Implementation (backtester.js:1132-1146):
```
num = sum(d^3), den = sum(d^2), where d = jMean - jackValues[i]
aHat = num / (6 * pow(den, 1.5))
```

### Step 4: Adjusted percentile formula

The BCa interval endpoints are:

```
alpha_1 = Phi( z_0 + (z_0 + z_{alpha/2}) / (1 - a_hat * (z_0 + z_{alpha/2})) )
alpha_2 = Phi( z_0 + (z_0 + z_{1-alpha/2}) / (1 - a_hat * (z_0 + z_{1-alpha/2})) )
```

The CI is then [theta_hat*_{(alpha_1 * B)}, theta_hat*_{(alpha_2 * B)}]
from the sorted bootstrap distribution.

### Correctness proof sketch (Efron 1987, Theorem 2.1)

If the statistic has a monotone transformation phi = m(theta) such that
phi_hat ~ N(phi - z_0 * sigma_phi, sigma_phi^2) with sigma_phi = 1 + a*phi,
then the BCa interval achieves exact coverage in the transformed space.
The z_0 and a_hat parameters are identified from the bootstrap and
jackknife respectively, without knowing m explicitly.

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| B (bootstrap reps) | varies | [B] | Minimum 50 enforced (line 1125) |
| alpha | 0.05 | [B] | 95% CI standard |

References: Efron (1987) "Better Bootstrap Confidence Intervals" JASA 82(397),
DiCiccio & Efron (1996) "Bootstrap Confidence Intervals" Statistical Science.

Code reference: backtester.js:1113-1166

---

## Derivation D-17: CUSUM Average Run Length [indicators.js:1480-1570]

### Problem

The Page (1954) CUSUM procedure detects shifts in the mean of a
sequential process. The key design parameters are the slack k and
threshold h, which jointly determine the Average Run Length (ARL) --
the expected number of observations before a false alarm (in-control)
or before detection (out-of-control).

### Step 1: Standard one-sided CUSUM

For standardized observations z_t = (x_t - mu_0) / sigma:

```
S_t^+ = max(0, S_{t-1}^+ + z_t - k)     (upward shift detection)
S_t^- = max(0, S_{t-1}^- - z_t - k)     (downward shift detection)
```

An alarm fires when S_t^+ > h or S_t^- > h, where k is the slack
(allowance) and h is the decision threshold.

### Step 2: In-control ARL (Wald approximation)

Under H_0 (no shift), the in-control ARL is approximately:

```
ARL_0 ~ exp(2 * h * k + C) / (2 * k^2)
```

where C depends on the reference distribution. For Gaussian observations:

```
ARL_0(k=0.5, h=2.5) ~ 250    (approximately 1 year of trading days)
ARL_0(k=0.5, h=4.0) ~ 4,100  (approximately 16 years)
ARL_0(k=0.5, h=5.0) ~ 30,000
```

### Step 3: Optimality of k = 0.5

Lorden (1971) showed that for detecting a shift of magnitude delta
in the mean, the minimax-optimal slack is k = delta/2. For a 1-sigma
shift (delta = 1):

```
k_opt = delta / 2 = 0.5
```

The implementation uses k = 0.5 (indicators.js:1511 variable `slack`),
which is optimal for detecting shifts of approximately 1 standard
deviation.

### Step 4: Adaptive variant caveat

**CRITICAL:** The implementation at indicators.js:1509-1555 uses
time-varying mean and variance (EMA-based running statistics with
alpha = 2/31). This violates the standard CUSUM assumption of known
mu_0 and sigma. Consequences:

1. The theoretical ARL tables no longer apply exactly
2. The adaptive CUSUM has shorter effective ARL_0 because the running
   mean tracks the true mean, effectively recentering the CUSUM
3. The vol-regime adaptive threshold (h = 1.5/2.5/3.5) partially
   compensates by widening h during high-volatility regimes

The code comment at line 1508 flags this explicitly:
"ARL calibration assumes standard CUSUM; adaptive h/k variant may differ"

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| slack (k) | 0.5 | [B] | Lorden (1971) minimax for 1-sigma shift |
| threshold (h) | 2.5 default | [B] | Roberts (1966) ARL optimization |
| warmup | 30 | [B] | Initial mean/variance stabilization |
| EMA alpha | 2/31 | [B] | ~30-bar half-life for adaptive statistics |
| h_high | 3.5 | [C] | Vol-regime adaptive; reduces false alarms in high-vol |
| h_low | 1.5 | [C] | Vol-regime adaptive; increases sensitivity in low-vol |

References: Page (1954) "Continuous Inspection Schemes" Biometrika,
Lorden (1971) "Procedures for Reacting to a Change in Distribution"
Annals of Mathematical Statistics, Roberts (1966) Technometrics.

Code reference: indicators.js:1480-1570

---

## Derivation D-18: GCV Eigendecomposition for Ridge Lambda Selection [indicators.js:826-900]

### Problem

Ridge regression adds an L2 penalty lambda * ||beta||^2 to the WLS
objective. The regularization parameter lambda controls bias-variance
tradeoff. Generalized Cross-Validation (GCV) selects lambda by
minimizing a rotation-invariant estimate of prediction error, without
requiring leave-one-out refitting.

### Step 1: Eigendecomposition of the weighted normal equations

Form the weighted design matrix product A = X^T W X (p x p) and the
weighted response b = X^T W y (p x 1). Eigendecompose A:

```
A = Q * diag(sigma_1, ..., sigma_p) * Q^T
```

where Q is orthogonal (eigenvectors) and sigma_j >= 0 are eigenvalues.
The implementation uses Jacobi iteration (indicators.js:750-824) for
this p x p eigendecomposition (p = 5 in the 6-variable WLS model).

### Step 2: Rotated response

Define the rotated response vector z = Q^T b:

```
z_j = sum_k Q_{kj} * b_k,   j = 1, ..., p
```

This transforms the ridge problem into p independent scalar problems.

### Step 3: Hat matrix trace

The ridge hat matrix is H_lambda = X(X^T W X + lambda I)^{-1} X^T W.
In the eigenspace:

```
tr(H_lambda) = sum_{j=1}^{p} sigma_j / (sigma_j + lambda_j)
```

where lambda_j = lambda for j >= 1 (feature columns) and lambda_0 = 0
(intercept column is never regularized). This is implemented at
indicators.js:875-877:
```
lamj = (j === 0) ? 0 : lam
trH += sigma[j] / (sigma[j] + lamj)
```

### Step 4: RSS decomposition

The residual sum of squares decomposes into a lambda-independent
perpendicular component and a lambda-dependent bias component:

```
RSS_perp = ||W^{1/2} y||^2 - sum_j z_j^2 / sigma_j
```

This is the projection of y onto the null space of X (unaffected by
regularization). The bias component introduced by shrinkage:

```
RSS_bias(lambda) = sum_j lambda_j^2 * z_j^2 / (sigma_j * (sigma_j + lambda_j)^2)
```

Total: RSS(lambda) = RSS_perp + RSS_bias(lambda).

Derivation of RSS_bias: The ridge solution is beta_j = z_j / (sigma_j + lambda_j).
The unpenalized solution is beta_j^OLS = z_j / sigma_j. The shrinkage bias
for component j is z_j * lambda_j / (sigma_j * (sigma_j + lambda_j)), and
its squared contribution to RSS is:

```
sigma_j * (z_j * lambda_j / (sigma_j * (sigma_j + lambda_j)))^2
= lambda_j^2 * z_j^2 / (sigma_j * (sigma_j + lambda_j)^2)
```

### Step 5: GCV formula

The GCV score (Golub, Heath & Wahba 1979):

```
GCV(lambda) = (1/n) * RSS(lambda) / [(1/n) * tr(I - H_lambda)]^2
            = (RSS_perp + RSS_bias) / n  /  (1 - tr(H_lambda)/n)^2
```

GCV is an approximately unbiased estimate of prediction error that is
invariant to orthogonal rotations of the design matrix. It avoids the
O(n) leave-one-out refits that ordinary CV requires.

Implementation (indicators.js:880-884):
```
rss = rssPerp + rssBias
gcvDen = 1 - trH / n
gcv = (rss / n) / (gcvDen * gcvDen)
```

### Step 6: Grid search and flatness guard

The implementation searches over lambda in {0.01, 0.05, 0.1, 0.25, 0.5,
1.0, 2.0, 5.0, 10.0}. If the GCV surface varies less than 1% across
the grid (flat surface), lambda = 1.0 is returned as a conservative
default (indicators.js:897).

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Lambda grid | 9 values, 0.01-10.0 | [B] | Covers 3 orders of magnitude |
| Flatness threshold | 1% | [B] | Below noise floor; default conservative |
| Default fallback | lambda = 1.0 | [C] | Moderate regularization when GCV uninformative |
| Intercept exclusion | lambda_0 = 0 | [A] | Never regularize the intercept (Hastie et al. 2009) |
| Min eigenvalue | 1e-10 | [A] | Numerical stability guard |

References: Golub, Heath & Wahba (1979) "Generalized Cross-Validation as
a Method for Choosing a Good Ridge Parameter" Technometrics 21(2),
Hastie, Tibshirani & Friedman (2009) "Elements of Statistical Learning" Ch.3.

Code reference: indicators.js:826-900

---

## Derivation D-19: Walk-Forward Efficiency [backtester.js:697-790]

### Problem

A model that fits well in-sample (IS) may fail out-of-sample (OOS)
due to overfitting. Walk-Forward Efficiency (WFE) quantifies how much
of the IS performance survives in OOS conditions, providing a single
metric to detect overfitting.

### Step 1: Walk-Forward protocol

The time series of length T is divided into K folds using an expanding
training window:

```
Fold k (k = 1, ..., K):
  Training: candles[0 .. T - K*oosSize + (k-1)*oosSize - purge]
  Purge:    purge = 2 * horizon bars (eliminates look-ahead leakage)
  Test:     candles[trainEnd + purge .. trainEnd + purge + oosSize]
```

The expanding (not sliding) window ensures later folds have more
training data, mimicking realistic model deployment. The purge gap
follows Bailey & Lopez de Prado (2014): for AR(1) returns with
half-life ~6.5 bars, purge = 2 * horizon(5) = 10 bars provides
sufficient decorrelation.

### Step 2: WFE computation

For each fold, compute the mean return of detected patterns:

```
IS_return_k  = mean return of pattern occurrences in training period
OOS_return_k = mean return of pattern occurrences in test period
```

Average across valid folds:

```
avgIS  = (1/K_valid) * sum(IS_return_k)
avgOOS = (1/K_valid) * sum(OOS_return_k)
```

Walk-Forward Efficiency:

```
WFE = (avgOOS / avgIS) * 100%
```

### Step 3: Interpretation thresholds (Pardo 2008)

| WFE Range | Label | Interpretation |
|-----------|-------|----------------|
| >= 50% | 'robust' | OOS retains majority of IS edge |
| 30-50% | 'marginal' | Some degradation but potentially viable |
| < 30% | 'overfit' | IS performance does not generalize |

The 30% threshold is Pardo's empirical recommendation from systematic
trading system development. Below 30%, the IS-to-OOS decay is so
severe that the model's apparent predictive power is likely spurious.

### Step 4: Edge cases

1. **Insufficient IS edge**: If |avgIS| < 0.3pp (approximately KRX
   round-trip cost of 0.25% + 0.015% slippage), WFE is set to 0
   because there is no meaningful edge to measure efficiency against.

2. **Both-negative returns**: If both avgIS < 0 and avgOOS < 0, the
   WFE ratio is numerically positive but strategically useless (both
   periods lose money). Labeled 'negative' regardless of WFE value.

3. **Reliability gating**: When WFE < 30, backtester.js:585 caps the
   pattern's reliability tier at 'C' (cannot achieve A or B), directly
   penalizing overfitted patterns in the signal pipeline.

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| WFE robust threshold | 50% | [B] | Pardo (2008) |
| WFE overfit threshold | 30% | [B] | Pardo (2008); below this, cap reliability at C |
| OOS ratio | 20% | [D] | Practitioner convention |
| Min OOS bars | 15 | [D] | Minimum for statistical stability |
| Purge | 2 * horizon | [B] | Bailey & Lopez de Prado (2014) AR(1) decorrelation |
| Min IS edge | 0.3pp | [C] | KRX round-trip cost approximation |

References: Pardo (2008) "The Evaluation and Optimization of Trading
Strategies" 2nd ed., Bailey & Lopez de Prado (2014) "The Deflated
Sharpe Ratio" Journal of Portfolio Management.

Code reference: backtester.js:697-790

---

## Constant Grade Summary

### Grade [A] -- Academic Fixed (24 constants)

| Constant | Value | Source |
|----------|-------|--------|
| Kolmogorov axioms | P(Omega)=1 | Kolmogorov (1933) |
| Hurst prior mean | 0.5 | Fama (1970) EMH |
| Hill heavy-tail threshold | alpha < 4 | Moment theory |
| HC3 leverage cap | min(h_ii, 0.99) | Numerical stability |
| GPD xi validity | xi < 0.5 for PWM | Hosking & Wallis (1987) |
| Cornish-Fisher c0 | 2.515517 | Abramowitz & Stegun (1972) |
| Cornish-Fisher c1 | 0.802853 | Abramowitz & Stegun (1972) |
| Cornish-Fisher c2 | 0.010328 | Abramowitz & Stegun (1972) |
| Cornish-Fisher d1 | 1.432788 | Abramowitz & Stegun (1972) |
| Cornish-Fisher d2 | 0.189269 | Abramowitz & Stegun (1972) |
| Cornish-Fisher d3 | 0.001308 | Abramowitz & Stegun (1972) |
| Population std in R/S | divisor n (not n-1) | Mandelbrot & Wallis (1969) |
| Positivity guard for EWMA | max(var, 1e-8) | IEEE 754 |
| R^2 non-negativity | max(0, R^2) | Definition |
| Kalman initial state | closes[0] | Standard |
| KRX_TRADING_DAYS | 250 | KRX official |

### Grade [B] -- Academic Tunable (14 constants)

| Constant | Value | Source | Tunable range |
|----------|-------|--------|---------------|
| EWMA lambda daily | 0.94 | RiskMetrics (1996) | 0.90-0.97 |
| EWMA lambda long | 0.97 | VRP proxy design | 0.95-0.99 |
| EWMA lambda short | 0.86 | VRP proxy design | 0.80-0.90 |
| GPD threshold percentile | 5% | Doc 12 Section 3.4 | 3-10% |
| GPD min exceedances | 20 | Stability | 15-30 |
| GPD min total obs | 500 | 2-year minimum | 250-750 |
| Hill k = sqrt(n) | Auto | Rule of thumb | Bootstrap-adaptive |
| BH-FDR q | 0.05 | Standard | 0.01-0.10 |
| Kalman EWMA alpha | 0.06 | ~30-bar EMA | 0.03-0.10 |
| Hurst clamp | [0.6, 1.4] | Designer choice | -- |
| mw clamp | [0.6, 1.0] | Designer choice | -- |
| EMA alpha for vol regime | 0.01 | ~69-bar half-life | 0.005-0.02 |
| Hurst linear scale | 2 | Maps [0.3,0.7]->[0.6,1.4] | -- |
| Hurst min regression points | 4 | Minimum for slope | 3-6 |

### Grade [C] -- KRX-Adapted (6 constants)

| Constant | Value | Calibration status |
|----------|-------|--------------------|
| WLS time-decay lambda | 0.995 | Half-life 139 days. Lo (2004) motivated. |
| Ridge lambda | GCV auto (fallback 1.0) | GCV applied since v58. selectRidgeLambdaGCV(). |
| Hurst minWindow | 10 | R/S block minimum. Calibratable. |
| Hurst prior strength k | 20 | Effective prior observations. Calibratable. |
| mw threshold | 3 ATR | Normal 3-sigma analogy. Uncalibrated. |
| Kalman Q/R defaults | Q=0.01, R=1.0 | Adaptive Q partially compensates. |

### Grade [D] -- Heuristic (6 constants)

| Constant | Value | Issue |
|----------|-------|-------|
| Hurst n_eff log base | 1.5 | No academic derivation |
| mw decay half-life | 5 ATR excess | No formal optimization. IC=+0.028. |
| mw decay constant | ln(2)/5 = 0.1386 | Derived from half-life [D] |
| VRP risk-on threshold | 1.2 | No IC validation |
| VRP risk-off threshold | 0.8 | No IC validation |
| VRP confidence adjustment | +/-5% | No IC validation |

### Grade [E] -- Deprecated (1 constant)

| Constant | Value | Status |
|----------|-------|--------|
| vw = 1/sqrt(ATR14/ATR50) | Computed but unused | IC=-0.083. E-grade. Excluded from Wc. |

---

*Document generated: 2026-04-07*
*Total formulas documented: 19 (M-1 through M-12, S-1 through S-19)*
*Total constants graded: 51 (24A + 14B + 6C + 6D + 1E)*
*Derivations: 19 (D-1 through D-19)*
