# Stage 2: Theoretical Basis -- Sections 2.1-2.2

> ANATOMY V5 -- Mathematical & Statistical Foundations
> Scope: Every formula used in CheeseStock's pattern detection, backtesting, and signal pipeline
> Standard: CFA Paper Grade annotation (symbol table + constant grading A-E)
> Cross-reference: `docs/anatomy/S2_formula_appendix.md` for full derivations

---

## 2.1 Mathematical Foundations

This section establishes the axiomatic and analytical machinery that underpins
every indicator, pattern detector, and prediction model in the system.

---

### 2.1.1 Probability Theory

#### Kolmogorov Axiom System (1933)

The entire pattern confidence framework rests on a probability space (Omega, F, P):

- Omega: sample space of all possible future price paths for a stock
- F: sigma-algebra of measurable events (e.g., "5-day return > 0")
- P: probability measure satisfying P(Omega) = 1

**Source:** Kolmogorov, A.N. (1933). *Grundbegriffe der Wahrscheinlichkeitsrechnung*.
Ergebnisse der Mathematik. Berlin: Springer.

**System mapping:** `patternEngine.PATTERN_WIN_RATES` assigns P(5-day return > 0 | pattern)
for each of 35+ patterns, estimated from 545,307 occurrences across 2,768 stocks over
5 years (2021-03 to 2026-03). These are frequentist estimates of conditional probabilities.

#### Bayes' Theorem and Conditional Probability

### [M-1] Bayes' Theorem (Bayes 1763)

$$P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| P(A\|B) | Posterior probability | Updated belief about A given evidence B | dimensionless | [0,1] | Bayes (1763) |
| P(B\|A) | Likelihood | Probability of observing B if A is true | dimensionless | [0,1] | -- |
| P(A) | Prior probability | Initial belief before evidence | dimensionless | [0,1] | -- |
| P(B) | Marginal likelihood | Total probability of evidence B | dimensionless | (0,1] | -- |

**System mapping:** The Bayesian framework appears in two places:
1. **Beta-Binomial shrinkage** of pattern win rates (`backtester.js`): prior P(WR) = 0.5
   (uninformative), updated with observed wins/total.
2. **James-Stein shrinkage** of Hurst exponent (`patterns.js:230-237`): prior H = 0.5
   (random walk / EMH), shrinkage intensity determined by effective sample size.

#### Law of Large Numbers (LLN)

$$\lim_{n \to \infty} \frac{1}{n} \sum_{i=1}^{n} X_i = \mu \quad \text{almost surely}$$

**System relevance:** LLN justifies using sample win rates as estimators of true pattern
success probabilities. However, convergence rate depends on tail behavior. For financial
returns with tail index alpha ~ 3 (Section 2.2.1), the convergence is slower than
for Gaussian data, requiring larger samples for equivalent precision.

**Minimum sample size implication:** For a pattern with true WR = 0.55 and alpha = 0.05,
the margin of error epsilon = z_{alpha/2} * sqrt(WR*(1-WR)/n). For epsilon = 0.03:
n >= (1.96)^2 * 0.55 * 0.45 / 0.03^2 = 1,057. Most candle patterns in the system
exceed this threshold (e.g., bullishEngulfing n=103,287), but chart patterns
(e.g., cupAndHandle n=125, abandonedBabyBearish n=71) do not.

#### Central Limit Theorem (CLT)

$$\sqrt{n}(\bar{X}_n - \mu) / \sigma \xrightarrow{d} N(0, 1)$$

**Critical caveat for financial data:** The CLT requires finite variance. For returns
with tail index alpha in (2,4), variance is finite but kurtosis is infinite or very
large (Section 2.2.1). In this regime, the CLT convergence rate is O(n^{-1/2}) but
the Berry-Esseen constant is inflated by excess kurtosis, meaning:

- Bollinger Band +/-2sigma coverage is ~90-93% instead of 95.4% (Doc 02 Section 1.2)
- Normal-approximation CIs for mean returns are anticonservative in small samples (n < 100)
- Bootstrap methods (Section 2.2.7) should be preferred for inference

---

### 2.1.2 Stochastic Processes

#### Random Walk (Bachelier 1900)

### [M-2] Random Walk Model

$$S_t = S_{t-1} + \varepsilon_t, \quad \varepsilon_t \sim N(0, \sigma^2)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| S_t | Price at time t | Stock price level | KRW | (0, inf) | -- |
| epsilon_t | Innovation | i.i.d. random shock | KRW | (-inf, inf) | Bachelier (1900) |
| sigma^2 | Variance of innovation | Controls dispersion of price changes | KRW^2 | (0, inf) | -- |

**Source:** Bachelier, L. (1900). *Theorie de la speculation*. Annales Scientifiques de
l'Ecole Normale Superieure, 3(17), 21-86.

**System mapping:** If markets follow a pure random walk, technical analysis is futile.
The entire pattern detection pipeline (`patternEngine.analyze()`) is predicated on
the alternative hypothesis: price series exhibit serial dependence detectable as patterns.

**Empirical status:** Lo, A. & MacKinlay, A.C. (1999) provide variance ratio evidence
against the random walk for weekly stock returns. The system's Hurst exponent estimator
(`calcHurst()`) directly tests this: H != 0.5 implies departure from random walk.

#### Geometric Brownian Motion (GBM)

### [M-3] GBM / Black-Scholes Dynamics

$$dS_t = \mu S_t \, dt + \sigma S_t \, dW_t$$

**Solution:**

$$S_t = S_0 \cdot \exp\left(\left(\mu - \frac{\sigma^2}{2}\right)t + \sigma W_t\right)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| mu | Drift | Expected annualized return | yr^{-1} | (-inf, inf) | -- |
| sigma | Diffusion coefficient | Annualized volatility | yr^{-1/2} | (0, inf) | -- |
| W_t | Wiener process | Standard Brownian motion | yr^{1/2} | (-inf, inf) | Wiener (1923) |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| sigma annualization factor | sqrt(252) US, sqrt(250) KRX | [A] | KRX_TRADING_DAYS=250 (indicators.js:9) |

**Sigma disambiguation (critical):** The symbol sigma carries different meanings
depending on context:

| Context | Symbol | Unit | Example |
|---------|--------|------|---------|
| GBM diffusion | sigma_GBM | dimensionless (annualized) | 0.30 = 30%/yr |
| Bollinger Band | sigma_price | KRW (price std dev) | 2,500 KRW |
| Daily return | sigma_return | dimensionless (daily) | 0.02 = 2%/day |
| EWMA vol | sigma_EWMA | dimensionless (daily) | calcEWMAVol output |

**Conversion:** sigma_daily = sigma_annual / sqrt(KRX_TRADING_DAYS)

Mixing sigma_price with sigma_return is a dimensional error. The system correctly uses
sigma_price for Bollinger Bands (`calcBB()`) and sigma_return for CAPM/EWMA
(`calcCAPMBeta()`, `calcEWMAVol()`).

#### Martingale Theory

### [M-4] Martingale Property

$$E[X_{n+1} | X_1, X_2, \ldots, X_n] = X_n$$

**Sub-martingale:** E[X_{n+1} | ...] >= X_n (upward drift -- bullish regime)
**Super-martingale:** E[X_{n+1} | ...] <= X_n (downward drift -- bearish regime)

**Precision note (from Doc 01):** The EMH claims *log-returns* are a martingale
(E[ln(P_{t+1}/P_t) | Phi_t] = mu, a constant), not that *prices* are a martingale.
By Jensen's inequality, E[P_{t+1} | Phi_t] = P_t * exp(mu + sigma^2/2) != P_t.
Technical analysis detecting price-level patterns is therefore not automatically
in contradiction with EMH -- only return predictability would be.

**System mapping:** The HMM regime detection (`appWorker.js`) classifies the current
market state as bullish/bearish/neutral, which corresponds to testing whether the
return process is a sub-martingale, super-martingale, or martingale.

#### Jump-Diffusion (Merton 1976)

### [M-5] Merton Jump-Diffusion

$$\frac{dS_t}{S_t} = (\mu - \lambda k) \, dt + \sigma \, dW_t + J \, dN_t$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| N_t | Poisson process | Jump arrival count | count | {0,1,2,...} | -- |
| J | Jump size | Log-normal random variable | dimensionless | (0, inf) | Merton (1976) |
| lambda | Jump intensity | Expected jumps per year | yr^{-1} | (0, inf) | Merton (1976) |
| k | Expected jump size | E[J-1] | dimensionless | (-1, inf) | -- |

**Source:** Merton, R.C. (1976). *Option pricing when underlying stock returns
are discontinuous*. Journal of Financial Economics, 3(1-2), 125-144.

**System mapping:** Gap patterns (abandoned baby, morning/evening star) are
empirical detectors of jump events. The KRX 30% price limit (expanded 2015-06-15
from 15%) truncates extreme jumps, reducing gap pattern frequency.

---

### 2.1.3 Fractal Mathematics

#### Hurst Exponent and R/S Analysis

### [M-6] Hurst Exponent via Rescaled Range (Hurst 1951)

$$E\left[\frac{R(n)}{S(n)}\right] = C \cdot n^H$$

where R(n) is the range of cumulative deviations and S(n) is the standard deviation
within a block of size n.

**Estimation procedure (as implemented in `calcHurst()`, indicators.js:212-264):**

1. Compute log-returns: r_t = ln(P_{t+1}/P_t)
2. For block sizes w from minWindow to floor(T/2), stepping by factor 1.5:
   a. Divide return series into floor(T/w) non-overlapping blocks
   b. For each block: compute mean, cumulative deviations, R = max - min, S = population std
   c. Average R/S across valid blocks (S > 0)
3. Regress log(R/S) on log(w) by OLS: slope = H

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| H | Hurst exponent | Long-memory / persistence parameter | dimensionless | (0, 1) | Hurst (1951) |
| n | Block size | Number of observations per block | count | [minWindow, T/2] | -- |
| C | Proportionality constant | Scale factor | dimensionless | (0, inf) | -- |

**Interpretation:**

| H value | Behavior | Optimal strategy type |
|---------|----------|----------------------|
| H = 0.5 | Random walk (independent) | No systematic edge |
| H > 0.5 | Persistent (trending) | Trend-following (MA crossover) |
| H < 0.5 | Anti-persistent (mean-reverting) | Contrarian (Bollinger reversion) |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| minWindow | 10 | [C] | Calibratable; R/S needs sufficient data per block |
| Block size step factor | 1.5 | [D] | Heuristic geometric progression; no academic derivation |
| Minimum data points | 4*minWindow+1 = 41 | [B] | Ensures >= 4 log-scale points for regression |
| Population std divisor | 1/n (not 1/(n-1)) | [A] | Mandelbrot & Wallis (1969) convention for R/S |

**References:**
- Hurst, H.E. (1951). *Long-term storage capacity of reservoirs*. Trans. ASCE, 116, 770-808.
- Peters, E. (1994). *Fractal Market Analysis*. Wiley. Chapter 4.
- Mandelbrot, B. & Wallis, J. (1969). *Robustness of the rescaled range R/S*. Water Resources Research, 5(5), 967-988.

**Finite-sample correction note:** Anis & Lloyd (1976) proposed a correction for
E[R/S] under the null H=0.5, which would reduce positive bias in small samples.
This correction is not implemented; instead, James-Stein shrinkage toward H=0.5
serves as a bias correction (see Section 2.1.3 Hurst Shrinkage below).

#### James-Stein Shrinkage for Hurst Exponent

### [M-7] Hurst Weight via James-Stein Shrinkage (patterns.js:230-237)

$$n_{\text{eff}} = \left\lfloor \frac{\ln(N/20)}{\ln(1.5)} \right\rfloor$$

$$\text{shrinkage} = \frac{n_{\text{eff}}}{n_{\text{eff}} + k}$$

$$H_{\text{shrunk}} = \text{shrinkage} \cdot H + (1 - \text{shrinkage}) \cdot 0.5$$

$$h_w = \text{clamp}(2 \cdot H_{\text{shrunk}}, \; 0.6, \; 1.4)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| N | Data length | Number of closing prices | count | [41, inf) | -- |
| n_eff | Effective observations | Information content, log-scaled | count | [1, ~12] | patterns.js |
| k | Prior strength | Equivalent prior sample size | count | 20 | -- |
| H | Raw Hurst | From R/S regression | dimensionless | (0,1) | calcHurst() |
| H_shrunk | Shrunk Hurst | Bayesian posterior mean | dimensionless | (0.3, 0.7) | -- |
| h_w | Hurst weight | Multiplicative confidence adjustment | dimensionless | [0.6, 1.4] | -- |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Prior mean | 0.5 | [A] | EMH: H=0.5 = random walk. Fama (1970). Canonical. |
| Prior strength k | 20 | [C] | "20 equivalent observations". R/S sub-samples non-independent. Calibratable. |
| Log base for n_eff | 1.5 | [D] | No academic derivation. Heuristic: data doubling gives ~1.7x information. |
| Linear scale factor | 2 | [B] | Maps H in [0.3, 0.7] to hw in [0.6, 1.4]. Designer choice. |
| Clamp bounds | [0.6, 1.4] | [B] | Prevents extreme adjustment. Designer choice. |

**References:**
- James, W. & Stein, C. (1961). *Estimation with Quadratic Loss*. Proc. Fourth Berkeley Symp.
- Efron, B. & Morris, C. (1973). *Stein's Estimation Rule and Its Competitors*. JASA 68(341).

#### Fractal Market Hypothesis

### [M-8] Levy Stable Distribution (Peters 1994)

$$\varphi(t) = \exp\left(i\mu t - |ct|^\alpha \left(1 - i\beta \cdot \text{sign}(t) \cdot \tan\frac{\pi\alpha}{2}\right)\right)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| alpha | Characteristic exponent | Tail thickness parameter | dimensionless | (0, 2] | Mandelbrot (1963) |
| beta | Skewness parameter | Asymmetry of distribution | dimensionless | [-1, 1] | -- |
| mu | Location | Center of distribution | same as X | (-inf, inf) | -- |
| c | Scale | Width parameter | same as X | (0, inf) | -- |

**Critical distinction (from Doc 01, Doc 03):** H = 1/alpha holds *only* for Levy
stable processes. For empirical financial returns (alpha ~ 3, H ~ 0.5-0.6):
- alpha: static property (tail thickness of the distribution)
- H: dynamic property (long-memory of the time series)
- These must be estimated independently (H via R/S, alpha via Hill estimator)

---

### 2.1.4 Power Laws

#### Inverse Cubic Law for Returns

### [M-9] Power Law Tail Distribution (Gabaix et al. 2003)

$$P(|r| > x) \sim L(x) \cdot x^{-\alpha}, \quad x \to \infty$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| alpha | Tail index | Rate of tail decay | dimensionless | (2, 5) typical | Cont (2001) |
| L(x) | Slowly varying function | Near-constant at large x | dimensionless | (0, inf) | -- |

**Empirical values:**
- S&P 500: alpha ~ 3 (Gopikrishnan et al. 1999)
- KOSPI: alpha ~ 3-5 (market-dependent)
- Implication: variance is finite (alpha > 2) but kurtosis diverges (alpha < 4)

**System mapping:** `calcHillEstimator()` (indicators.js:276-307) estimates alpha
from the return series. When `isHeavyTail` (alpha < 4) is true, parametric
tests assuming normality are unreliable.

**References:**
- Gopikrishnan, P. et al. (1999). *Scaling of the distribution of fluctuations
  of financial market indices*. Physical Review E, 60(5), 5305.
- Gabaix, X. et al. (2003). *A theory of power-law distributions in financial
  market fluctuations*. Nature, 423, 267-270.
- Cont, R. (2001). *Empirical properties of asset returns: stylized facts and
  statistical issues*. Quantitative Finance, 1, 223-236.

---

### 2.1.5 Information Theory

#### Shannon Entropy

### [M-10] Shannon Entropy (Shannon 1948)

$$H(X) = -\sum_{i} p(x_i) \cdot \log_2 p(x_i)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| H(X) | Entropy | Uncertainty of random variable X | bits | [0, log_2(n)] | Shannon (1948) |
| p(x_i) | Probability mass | Probability of outcome x_i | dimensionless | [0, 1] | -- |

**Financial interpretation:**
- High entropy: market direction is uncertain (ranging/consolidation)
- Low entropy: market direction is highly predictable (strong trend)
- Entropy increase signals transition from trending to ranging markets

**System mapping:** Shannon entropy is referenced in the signal engine's regime
classification logic. The `signalEngine.calcVolRegime()` uses EWMA volatility ratios
as a proxy for regime uncertainty, which is monotonically related to entropy of the
return distribution for location-scale families.

**Source:** Shannon, C.E. (1948). *A Mathematical Theory of Communication*. Bell System
Technical Journal, 27(3), 379-423.

#### KL Divergence

### [M-11] Kullback-Leibler Divergence

$$D_{KL}(P \| Q) = \sum_{x} P(x) \ln \frac{P(x)}{Q(x)}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| D_KL | KL divergence | Information gain from Q to P | nats (or bits) | [0, inf) | Kullback & Leibler (1951) |
| P | True distribution | Reference distribution | -- | -- | -- |
| Q | Approximate distribution | Model distribution | -- | -- | -- |

**Properties:** D_KL >= 0 (Gibbs' inequality). Not symmetric: D_KL(P||Q) != D_KL(Q||P).

**Financial application:** Measures how much a model distribution (e.g., normal) diverges
from the empirical return distribution. Large D_KL(empirical || normal) signals fat tails,
motivating EVT-based approaches (Section 2.2.5).

#### Fisher Information Matrix

### [M-12] Fisher Information (Fisher 1922, Rao 1945)

$$I(\theta)_{ij} = E\left[\frac{\partial \log p(x;\theta)}{\partial \theta_i} \cdot \frac{\partial \log p(x;\theta)}{\partial \theta_j}\right]$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| I(theta) | Fisher information matrix | Curvature of log-likelihood | varies | positive semi-definite | Fisher (1922) |
| theta | Parameter vector | Model parameters | varies | Theta subset R^n | -- |

**Cramer-Rao lower bound:** Var(theta_hat) >= I(theta)^{-1}

For Normal(mu, sigma^2):
- Var(mu_hat) >= sigma^2/n (estimation precision improves with n)
- For Student-t(nu=4): Var(mu_hat) is ~2x worse than normal (Doc 13 Section 2.4)

**System implication:** Mean return estimation for heavy-tailed financial data
(nu ~ 3-5) is fundamentally harder than under normality. This motivates the
system's emphasis on ranking (win rates, directional accuracy) over point
estimation (mean returns).

---

## 2.2 Statistical Framework

---

### 2.2.1 Stylized Facts of Financial Returns (Cont 2001)

The entire statistical architecture must accommodate these five empirically
universal properties:

| # | Stylized Fact | Formal Statement | System Implication |
|---|---------------|------------------|--------------------|
| SF-1 | Fat tails (leptokurtosis) | K > 3, typically 5-15 for daily | Normal-based CIs are anti-conservative |
| SF-2 | Volatility clustering | Corr(\|r_t\|, \|r_{t+h}\|) > 0, slow decay | GARCH effects; EWMA vol meaningful |
| SF-3 | Negative skewness | S < 0 for equity indices | Downside risk > upside risk |
| SF-4 | Long memory in |r| | ACF of \|r\| decays as h^{2H-2} | Hurst H > 0.5 for absolute returns |
| SF-5 | Leverage effect | Corr(r_t, sigma_{t+1}) < 0 | Drops increase future volatility |

**Source:** Cont, R. (2001). *Empirical properties of asset returns: stylized facts
and statistical issues*. Quantitative Finance, 1(2), 223-236.

**Verification in CheeseStock:**
- SF-1: `calcHillEstimator()` reports alpha < 4 for most KRX stocks (isHeavyTail=true)
- SF-2: `calcEWMAVol()` with lambda=0.94 captures clustering
- SF-3: Bearish pattern win rates systematically exceed bullish (e.g., bearishEngulfing 57.2% vs bullishEngulfing 41.3%)
- SF-4: `calcHurst()` typically returns H > 0.5 for |return| series
- SF-5: VRP proxy (`calcVRP()`) captures volatility's asymmetric response

---

### 2.2.2 Time Series Analysis

#### Stationarity

### [S-1] Weak Stationarity Conditions

A time series {X_t} is weakly stationary if:

1. E[X_t] = mu (constant mean, for all t)
2. Var(X_t) = sigma^2 (constant variance, for all t)
3. Cov(X_t, X_{t+h}) = gamma(h) (autocovariance depends only on lag h)

**System mapping:** Raw prices are I(1) (non-stationary). The system correctly
uses log-returns for Hurst estimation (`calcHurst()` computes
r_t = ln(P_{t+1}/P_t) internally) and for CAPM beta regression (`calcCAPMBeta()`
computes arithmetic returns). Applying R/S analysis to raw prices would bias
H upward by ~+0.4 (noted in calcHurst JSDoc).

#### ADF Test

### [S-2] Augmented Dickey-Fuller Test (Dickey & Fuller 1979)

$$\Delta y_t = \alpha + \beta t + \gamma y_{t-1} + \sum_{j=1}^{p} \delta_j \Delta y_{t-j} + \varepsilon_t$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| gamma | Unit root coefficient | Test target: gamma=0 implies unit root | dimensionless | -- | Dickey & Fuller (1979) |
| H_0 | Null hypothesis | gamma = 0 (non-stationary, unit root) | -- | -- | -- |
| H_1 | Alternative | gamma < 0 (stationary) | -- | -- | -- |

**Source:** Dickey, D.A. & Fuller, W.A. (1979). *Distribution of the Estimators for
Autoregressive Time Series with a Unit Root*. JASA, 74(366), 427-431.

**System status:** ADF is not implemented in the client-side JavaScript. Stationarity
is assumed for return series (first-differenced prices), which is standard practice
for daily equity data. The Python MRA pipeline (`scripts/compute_mra.py`) performs
ADF-equivalent checks on factor series.

#### Autocorrelation Function (ACF)

### [S-3] Autocorrelation Function

$$\rho(h) = \frac{\gamma(h)}{\gamma(0)} = \frac{Cov(X_t, X_{t+h})}{Var(X_t)}$$

**Empirical regularities:**
- Returns ACF rho(h) ~ 0 for h > 1 (consistent with weak EMH)
- |Returns| ACF rho(h) > 0, slow decay (long memory, GARCH effect)
- Volume ACF shows strong positive autocorrelation (persistence)

**System mapping:** The Hurst exponent estimation in `calcHurst()` is a nonparametric
alternative to ACF analysis for detecting long memory. H > 0.5 implies positive
autocorrelation at long lags for the absolute return series.

---

### 2.2.3 GARCH Models

### [S-4] GARCH(1,1) (Bollerslev 1986)

$$\sigma_t^2 = \omega + \alpha \varepsilon_{t-1}^2 + \beta \sigma_{t-1}^2$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| omega | Long-run variance intercept | Baseline variance level | return^2 | (0, inf) | Bollerslev (1986) |
| alpha | ARCH coefficient | Sensitivity to recent shock | dimensionless | [0, 1) | -- |
| beta | GARCH coefficient | Persistence of past variance | dimensionless | [0, 1) | -- |
| epsilon_t | Innovation | Return shock: r_t - mu | return | (-inf, inf) | -- |

**Stationarity condition:** alpha + beta < 1.
**Persistence:** alpha + beta close to 1 implies high volatility persistence (IGARCH limit).

**System mapping:** Full GARCH estimation is computationally expensive and not implemented
client-side. Instead, `calcEWMAVol()` (indicators.js:1336-1376) implements the special
case IGARCH with omega=0, alpha=(1-lambda), beta=lambda:

$$\sigma_t^2 = \lambda \sigma_{t-1}^2 + (1-\lambda) r_{t-1}^2$$

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| lambda (daily) | 0.94 | [B] | RiskMetrics (1996) G7 default. KRX calibration TBD. |
| lambda (long-term) | 0.97 | [B] | Used in VRP proxy long-term vol. Half-life ~23 days. |
| lambda (short-term) | 0.86 | [B] | Used in VRP proxy short-term vol. Half-life ~4.6 days. |
| Initial variance | sample var of first 20 returns | [B] | Standard warm-up. See Doc 02 Section 2.4 note. |
| Positivity guard | max(variance, 1e-8) | [A] | IEEE 754 float underflow protection. |

**References:**
- Bollerslev, T. (1986). *Generalized Autoregressive Conditional Heteroskedasticity*.
  Journal of Econometrics, 31(3), 307-327.
- J.P. Morgan RiskMetrics (1996). Technical Document, 4th ed.

---

### 2.2.4 Regression Methods

#### OLS and WLS

### [S-5] Weighted Least Squares Normal Equation

$$\hat{\beta} = (X^T W X)^{-1} X^T W y$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| X | Design matrix | n x p matrix including intercept column | mixed | -- | -- |
| W | Weight matrix | Diagonal: W_ii = w_i | dimensionless | (0, inf) | -- |
| y | Response vector | N-day forward returns (%) | percent | (-30, 30) | -- |
| beta_hat | Coefficient vector | Estimated regression coefficients | mixed | (-inf, inf) | -- |

**WLS weight scheme (time decay):**

$$w_i = \lambda^{T - t_i}, \quad \lambda = 0.995$$

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| lambda (WLS) | 0.995 | [C] | Half-life ~139 trading days (~7 months). Lo (2004) AMH. |

**System mapping:** `calcWLSRegression()` (indicators.js:558-749) implements the full
WLS pipeline with Ridge regularization, HC3 standard errors, VIF diagnostics, and
adjusted R-squared. Called by `backtester.js` for each pattern's return prediction.

**Prediction interval:**

$$SE(\hat{y}_{new}) = \sqrt{\hat{\sigma}^2 \cdot \left(1 + x_{new}^T (X^T W X)^{-1} x_{new}\right)}$$

$$\text{95\% CI} = \hat{y}_{new} \pm t_{0.025, df} \cdot SE$$

#### Ridge Regression

### [S-6] Ridge Regression (Hoerl & Kennard 1970)

$$\hat{\beta}_{Ridge} = (X^T W X + \lambda I)^{-1} X^T W y$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| lambda | Regularization parameter | Penalty strength on coefficients | dimensionless | [0, inf) | Hoerl & Kennard (1970) |
| I | Identity matrix (intercept excluded) | Penalty applied to j >= 1 only | -- | -- | -- |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| lambda | 2.0 | [C] | Moderate regularization. GCV not applied (n=30-200 insufficient). Calibratable. |

**Implementation note (indicators.js:581-585):** The intercept column (j=0) is
excluded from the Ridge penalty, which is the standard convention
(Hastie, Tibshirani & Friedman, 2009, *Elements of Statistical Learning*, p.64).

**References:**
- Hoerl, A.E. & Kennard, R.W. (1970). *Ridge Regression: Biased Estimation for
  Nonorthogonal Problems*. Technometrics, 12(1), 55-67.
- Golub, G., Heath, M. & Wahba, G. (1979). *GCV as a Method for Choosing
  a Good Ridge Parameter*. Technometrics, 21(2), 215-223.

#### HC3 Heteroskedasticity-Consistent Standard Errors

### [S-7] HC3 Sandwich Estimator (MacKinnon & White 1985)

$$\widehat{Cov}_{HC3}(\hat{\beta}) = (X^TWX)^{-1} \left[\sum_{i} \frac{w_i^2 e_i^2}{(1-h_{ii})^2} x_i x_i^T\right] (X^TWX)^{-1}$$

where:

$$h_{ii} = w_i \cdot x_i^T (X^TWX)^{-1} x_i \quad \text{(leverage of observation } i \text{)}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| e_i | Residual | y_i - x_i^T beta_hat | percent | -- | -- |
| h_ii | Leverage | Diagonal of hat matrix | dimensionless | [0, 1) | -- |
| (1-h_ii)^2 | Leverage penalty | HC3 correction factor | dimensionless | (0, 1] | MacKinnon & White (1985) |

**HC variant comparison (Long & Ervin 2000):**

| Variant | Formula for observation i | Small-sample bias |
|---------|-------------------------|-------------------|
| HC0 | e_i^2 | Under-estimates (White 1980) |
| HC1 | n/(n-p) * e_i^2 | Degrees-of-freedom correction |
| HC2 | e_i^2 / (1 - h_ii) | First-order leverage correction |
| HC3 | e_i^2 / (1 - h_ii)^2 | Delete-one jackknife approximation |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| h_ii cap | min(h_ii, 0.99) | [A] | Prevents division by zero for perfect-leverage points |

**Why HC3 for CheeseStock:** Pattern samples are n=30-200. Long & Ervin (2000) show
HC3 has lowest size distortion for n < 250. Financial returns are structurally
heteroskedastic (GARCH effects, price-limit truncation at +/-30%).

**References:**
- White, H. (1980). *A Heteroskedasticity-Consistent Covariance Matrix Estimator*.
  Econometrica, 48(4), 817-838.
- MacKinnon, J.G. & White, H. (1985). *Some heteroskedasticity-consistent covariance
  matrix estimators with improved finite sample properties*. J. Econometrics, 29(3), 305-325.
- Long, J.S. & Ervin, L.H. (2000). *Using Heteroscedasticity Consistent Standard Errors
  in the Linear Regression Model*. American Statistician, 54(3), 217-224.

#### VIF Diagnostic

### [S-8] Variance Inflation Factor (Marquardt 1970)

$$VIF_j = \frac{1}{1 - R^2_j}$$

where R^2_j is from the auxiliary OLS regression of X_j on all other predictors.

| Threshold | Severity | Action |
|-----------|----------|--------|
| VIF < 5 | Acceptable | None required |
| 5 <= VIF < 10 | Moderate multicollinearity | Monitor, consider dropping |
| VIF >= 10 | Severe | Ridge or variable removal required |

**System mapping:** `calcWLSRegression()` computes full VIF diagnostics for all
predictor columns (j >= 1). The backtester reports VIF flags in regression output.

**Reference:** Marquardt, D.W. (1970). *Generalized Inverses, Ridge Regression, Biased
Linear Estimation, and Nonlinear Estimation*. Technometrics, 12(3), 591-612.

---

### 2.2.5 Extreme Value Theory (EVT)

#### Generalized Extreme Value Distribution (GEV)

### [S-9] Fisher-Tippett-Gnedenko Theorem / GEV (1928/1943)

$$G(x; \mu, \sigma, \xi) = \exp\left\{-\left[1 + \xi\frac{x-\mu}{\sigma}\right]^{-1/\xi}\right\}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| mu | Location parameter | Center of extreme value distribution | same as data | (-inf, inf) | -- |
| sigma | Scale parameter | Spread of extreme values | same as data | (0, inf) | -- |
| xi | Shape parameter | Tail behavior controller | dimensionless | (-inf, inf) | -- |

**Three regimes:**

| xi | Type | Tail behavior | Financial relevance |
|----|------|--------------|---------------------|
| xi = 0 | Gumbel (Type I) | Exponential decay (thin) | Normal extremes |
| xi > 0 | Frechet (Type II) | Power-law decay (fat) | **Financial returns** |
| xi < 0 | Weibull (Type III) | Finite upper bound | Bounded processes |

**Empirical:** KOSPI xi ~ 0.2-0.4 (Frechet), S&P 500 xi ~ 0.2-0.3.

**Reference:** Coles, S. (2001). *An Introduction to Statistical Modeling of
Extreme Values*. Springer.

#### Generalized Pareto Distribution (GPD)

### [S-10] GPD / Peaks Over Threshold (Pickands 1975, Balkema & de Haan 1974)

$$H(y; \sigma, \xi) = 1 - \left(1 + \frac{\xi y}{\sigma}\right)^{-1/\xi}, \quad y > 0$$

**GPD-based VaR:**

$$VaR_p = u + \frac{\sigma}{\xi}\left[\left(\frac{n}{N_u}(1-p)\right)^{-\xi} - 1\right]$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| u | Threshold | Exceedance cutoff (top 5%) | return | (0, 1) | -- |
| N_u | Exceedances | Count of observations above u | count | [20, inf) | -- |
| p | Confidence level | VaR probability level | dimensionless | (0.9, 0.999) | -- |

**System mapping:** `calcGPDFit()` (indicators.js:323-376) implements:
1. Threshold at top 5% of absolute returns (Doc 12 Section 3.4 guidance)
2. PWM estimation for (xi, sigma) -- Hosking & Wallis (1987)
3. VaR calculation at user-specified quantile (default 99%)

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Threshold percentile | 5% (top 5%) | [B] | Standard range 5-10%. Doc 12 Section 3.4 guidance. |
| Minimum exceedances | 20 | [B] | PWM stability. Conservative for n >= 500. |
| Minimum total observations | 500 | [B] | ~2 years daily data. Ensures 25+ exceedances at 5%. |
| xi validity guard | clamp xi < 0.5 | [A] | PWM estimator valid only for xi < 0.5 (Hosking & Wallis 1987). |

**References:**
- Pickands, J. (1975). *Statistical inference using extreme order statistics*.
  Annals of Statistics, 3(1), 119-131.
- Hosking, J.R.M. & Wallis, J.R. (1987). *Parameter and quantile estimation for
  the generalized Pareto distribution*. Technometrics, 29(3), 339-349.
- Embrechts, P., Kluppelberg, C. & Mikosch, T. (1997). *Modelling Extremal Events
  for Insurance and Finance*. Springer.

#### Hill Estimator

### [S-11] Hill Tail Index Estimator (Hill 1975)

$$\hat{H}_k = \frac{1}{k} \sum_{i=1}^{k} \left[\ln X_{(i)} - \ln X_{(k+1)}\right]$$

$$\hat{\alpha} = \frac{1}{\hat{H}_k} = \frac{k}{\sum_{i=1}^{k} [\ln X_{(i)} - \ln X_{(k+1)}]}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| X_{(i)} | Order statistic | i-th largest absolute return | dimensionless | (0, inf) | -- |
| k | Upper order statistics count | Number of tail observations used | count | [2, n-1] | -- |
| alpha_hat | Tail index estimate | Inverse of Hill estimator | dimensionless | (0, inf) | Hill (1975) |
| SE | Standard error | alpha / sqrt(k) (IID assumption) | dimensionless | (0, inf) | Hill (1975) |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| k auto-selection | floor(sqrt(n)) | [B] | Rule of thumb. Drees & Kaufmann (1998) suggest data-adaptive bootstrap for optimal k. |
| Minimum n | 10 | [B] | Guard against degenerate estimation |
| Heavy tail flag | alpha < 4 | [A] | 4th moment (kurtosis) diverges when alpha < 4. Academic consensus. |

**Caveat:** Hill SE assumes i.i.d. data. For time-dependent financial returns,
block bootstrap is theoretically more appropriate. The comment in the code
(indicators.js:304) correctly flags this limitation.

**Reference:** Hill, B.M. (1975). *A Simple General Approach to Inference about
the Tail of a Distribution*. Annals of Statistics, 3(2), 1163-1174.

---

### 2.2.6 Bayesian Methods

#### Beta-Binomial Shrinkage for Win Rates

### [S-12] Beta-Binomial Posterior Mean (Empirical Bayes)

$$\hat{p}_{shrunk} = \frac{n_{eff}}{n_{eff} + k_0} \cdot \hat{p}_{MLE} + \frac{k_0}{n_{eff} + k_0} \cdot p_0$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| p_hat_MLE | Sample win rate | wins / total | dimensionless | [0, 1] | -- |
| p_0 | Prior win rate | Uninformative prior | dimensionless | 0.5 | -- |
| k_0 | Prior strength | Equivalent prior sample size | count | varies | -- |
| n_eff | Effective sample size | May differ from n for correlated data | count | [1, n] | -- |

**System mapping:** Used in `backtester.js` for patterns with small samples (n < 30).
The Bulkowski fallback table (Doc 17 Section 17.6) provides academic priors when
empirical data is insufficient.

#### Mean Reversion Weight (Exponential Decay)

### [S-13] Ornstein-Uhlenbeck Mean Reversion Weight (patterns.js:245-250)

$$\text{moveATR} = \frac{|\text{close} - MA_{50}|}{ATR_{14}}$$

$$\text{excess} = \max(0, \text{moveATR} - 3)$$

$$m_w = \text{clamp}\left(\exp(-0.1386 \cdot \text{excess}), \; 0.6, \; 1.0\right)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| moveATR | ATR-normalized displacement | Distance from MA50 in ATR units | ATR | [0, inf) | -- |
| excess | Extreme displacement | Amount beyond 3 ATR threshold | ATR | [0, inf) | -- |
| 0.1386 | Decay rate kappa | ln(2)/5, half-life = 5 ATR units | ATR^{-1} | -- | -- |
| m_w | Mean reversion weight | Confidence discount for extreme displacement | dimensionless | [0.6, 1.0] | -- |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Threshold | 3 ATR | [C] | 3-sigma analogy (99.7% of normal). KRX moveATR distribution calibration pending. |
| Half-life | 5 ATR excess | [D] | No academic derivation. Empirical IC=+0.028 (positive, A- direction). |
| Decay constant | ln(2)/5 = 0.1386 | [D] | Derived from half-life choice. |
| Clamp bounds | [0.6, 1.0] | [B] | Minimum 60% confidence retained. No upward adjustment from m_w. |

**References:**
- DeBondt, W. & Thaler, R. (1985). *Does the Stock Market Overreact?* Journal of Finance, 40(3), 793-805.
- Poterba, J. & Summers, L. (1988). *Mean Reversion in Stock Prices*. Journal of Financial Economics, 22, 27-59.

---

### 2.2.7 Bootstrap Methods

#### BCa Bootstrap Confidence Intervals

### [S-14] Bias-Corrected and Accelerated Bootstrap (Efron 1987)

$$\hat{\theta}_{BCa}[\alpha] = \hat{G}^{-1}\left(\Phi\left(\hat{z}_0 + \frac{\hat{z}_0 + z_\alpha}{1 - \hat{a}(\hat{z}_0 + z_\alpha)}\right)\right)$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| z_hat_0 | Bias correction | Proportion of bootstrap theta < original theta | dimensionless | (-3, 3) | Efron (1987) |
| a_hat | Acceleration | Skewness correction from jackknife | dimensionless | (-0.5, 0.5) | Efron (1987) |
| z_alpha | Normal quantile | Phi^{-1}(alpha) | dimensionless | -- | -- |
| G_hat | Bootstrap distribution | Empirical CDF of bootstrap estimates | -- | -- | -- |

**System mapping:** The backtester uses BCa intervals for pattern return estimation
when n is sufficient (>= 30 occurrences). For financial time series, the block
bootstrap variant is preferred to preserve autocorrelation structure.

**Block size for financial data:** l ~ T^{1/3} (Lahiri, 2003).
Example: T = 1000 trading days implies l ~ 10 days.

**References:**
- Efron, B. (1987). *Better Bootstrap Confidence Intervals*. JASA, 82(397), 171-185.
- Lahiri, S.N. (2003). *Resampling Methods for Dependent Data*. Springer.

---

### 2.2.8 Multiple Testing Corrections

#### Benjamini-Hochberg FDR (current implementation)

### [S-15] BH-FDR Step-Up Procedure (Benjamini & Hochberg 1995)

For m simultaneous hypothesis tests with ordered p-values p_{(1)} <= ... <= p_{(m)}:

$$\text{Reject } H_{(k)} \text{ if } p_{(k)} \leq \frac{k}{m} \cdot q$$

where q is the target false discovery rate (default 0.05).

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| m | Number of tests | patterns x horizons (e.g., 39 x 5 = 195) | count | -- | -- |
| q | Target FDR | Expected proportion of false discoveries | dimensionless | (0, 1) | -- |
| p_{(k)} | k-th smallest p-value | Ordered test p-values | dimensionless | [0, 1] | -- |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| q | 0.05 | [B] | Standard FDR threshold. Conservative enough for pattern trading. |

**History:** System originally used Holm step-down FWER control (Doc 17 Section 17.11).
Switched to BH-FDR (Phase G, commit be27600) for better statistical power at
195 simultaneous tests.

**Comparison with FWER methods:**

| Method | Error control | Power | Independence required |
|--------|--------------|-------|----------------------|
| Bonferroni | FWER (most conservative) | Low | No |
| Holm step-down | FWER (uniformly more powerful than Bonf) | Medium | No |
| BH-FDR | FDR (expected false discovery proportion) | High | Weakly, under PRDS |
| Harvey-Liu-Zhu (2016) | Adjusted for data snooping | Very conservative | No |

**References:**
- Benjamini, Y. & Hochberg, Y. (1995). *Controlling the False Discovery Rate*.
  JRSS-B, 57(1), 289-300.
- Holm, S. (1979). *A Simple Sequentially Rejective Multiple Test Procedure*.
  Scandinavian Journal of Statistics, 6(2), 65-70.
- Harvey, C.R., Liu, Y. & Zhu, H. (2016). *...and the Cross-Section of Expected Returns*.
  Review of Financial Studies, 29(1), 5-68.

#### Cornish-Fisher t-Distribution Approximation

### [S-16] Cornish-Fisher Expansion (Cornish & Fisher 1937)

Normal quantile approximation (Abramowitz & Stegun Eq. 26.2.23):

$$z_p = t - \frac{c_0 + c_1 t + c_2 t^2}{1 + d_1 t + d_2 t^2 + d_3 t^3}$$

where t = sqrt(-2 ln(1-p)).

**Constants (Hastings 1955):**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| c_0 | 2.515517 | [A] | Abramowitz & Stegun Table 26.2. Standard reference. |
| c_1 | 0.802853 | [A] | Same source. |
| c_2 | 0.010328 | [A] | Same source. |
| d_1 | 1.432788 | [A] | Same source. |
| d_2 | 0.189269 | [A] | Same source. |
| d_3 | 0.001308 | [A] | Same source. |

**Accuracy:** |error| < 4.5e-4 for all p.

**t-distribution correction (2nd order):**

$$t_\nu \approx z + \frac{z^3 + z}{4\nu} + \frac{5z^5 + 16z^3 + 3z}{96\nu^2}$$

**Accuracy by degrees of freedom:**

| df | Max error | Assessment |
|----|-----------|------------|
| >= 30 | < 0.001 | Excellent |
| >= 10 | < 0.01 | Practical |
| = 5 | < 0.05 | Biased, offset by Holm conservatism |
| < 3 | Unreliable | Code returns Infinity |

**References:**
- Abramowitz, M. & Stegun, I.A. (1972). *Handbook of Mathematical Functions*. NBS Applied Mathematics Series 55.
- Cornish, E.A. & Fisher, R.A. (1937). *Moments and Cumulants in the Specification of Distributions*.
  Revue de l'Institut International de Statistique, 5(4), 307-320.

---

### 2.2.9 Kalman Filter

### [S-17] Adaptive Kalman Filter (indicators.js:170-199)

**Prediction step:**

$$\hat{x}_{t|t-1} = \hat{x}_{t-1|t-1}$$

$$P_{t|t-1} = P_{t-1|t-1} + Q_t$$

**Update step:**

$$K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}$$

$$\hat{x}_{t|t} = \hat{x}_{t|t-1} + K_t(z_t - \hat{x}_{t|t-1})$$

$$P_{t|t} = (1 - K_t) P_{t|t-1}$$

**Adaptive process noise (Mohamed & Schwarz 1999):**

$$Q_t = Q_{base} \cdot \frac{\sigma^2_{EWMA,t}}{\bar{\sigma}^2_{EWMA}}$$

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|------------|------|-------|--------|
| x_hat | State estimate | Smoothed price | KRW | (0, inf) | Kalman (1960) |
| P | Error covariance | Estimation uncertainty | KRW^2 | (0, inf) | -- |
| K_t | Kalman gain | Weight on new observation vs prediction | dimensionless | (0, 1) | -- |
| Q | Process noise | Model uncertainty | KRW^2 | (0, inf) | -- |
| R | Measurement noise | Observation uncertainty | KRW^2 | (0, inf) | -- |
| z_t | Observation | Raw closing price | KRW | (0, inf) | -- |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Q (default) | 0.01 | [C] | Adaptive via sigma_EWMA ratio. Base value calibratable. |
| R (default) | 1.0 | [C] | Measurement noise. Calibratable. |
| EWMA alpha | 0.06 (~2/(30+1)) | [B] | 30-bar EWMA for variance tracking |
| Initial state | closes[0] | [A] | Standard initialization |
| Initial P | 1.0 | [C] | Uncertainty prior. Calibratable. |

**Reference:** Mohamed, A.H. & Schwarz, K.P. (1999). *Adaptive Kalman Filtering for INS/GPS*.
Journal of Geodesy, 73(4), 193-203.

---

### 2.2.10 Volatility Risk Premium

### [S-18] VRP and EWMA Proxy (Bollerslev, Tauchen & Zhou 2009)

$$VRP \equiv IV^2 - RV^2 = \left(\frac{VKOSPI}{100}\right)^2 - HV^2_{Parkinson}$$

**Individual stock proxy:**

$$VRP_{proxy} = \frac{\sigma_{EWMA}(\lambda=0.97)}{\sigma_{EWMA}(\lambda=0.86)}$$

| Proxy value | Regime | Interpretation | Pattern confidence adjustment |
|-------------|--------|----------------|------------------------------|
| > 1.2 | Risk-on | Vol decreasing, past fear resolving | +5% trend-following |
| 0.8 - 1.2 | Neutral | Equilibrium | No adjustment |
| < 0.8 | Risk-off | Vol spiking, new risk priced in | -5% directional patterns |

**Constants:**

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Risk-on threshold | 1.2 | [D] | Heuristic. No formal calibration. |
| Risk-off threshold | 0.8 | [D] | Heuristic. No formal calibration. |
| Confidence adjustment | +/-5% | [D] | Heuristic. No IC validation. |

**References:**
- Bollerslev, T., Tauchen, G. & Zhou, H. (2009). *Expected Stock Returns and
  Variance Risk Premia*. Review of Financial Studies, 22(11), 4463-4492.
- Corsi, F. (2009). *A Simple Approximate Long-Memory Model of Realized Volatility*.
  Journal of Financial Econometrics, 7(2), 174-196.

---

### 2.2.11 WLS Design Matrix (6-Variable Specification)

### [S-19] Backtester Regression Specification (backtester.js:590-614)

$$E[R_N] = \alpha_p + \beta_1 \cdot \text{conf} + \beta_2 \cdot \text{trend} + \beta_3 \cdot \ln(\text{volRatio}) + \beta_4 \cdot \text{atrNorm} + \beta_5 \cdot w_c + \beta_6 \cdot \text{mom}_{60}$$

| Column | Variable | Range | Academic source |
|--------|----------|-------|----------------|
| 0 | Intercept | 1 | OLS/WLS standard |
| 1 | confidence | [0, 1] | Bulkowski (2005): pattern quality -> returns |
| 2 | trendStrength | [0, inf) | Lo & Wang (2000): trend context |
| 3 | ln(volumeRatio) | [-2.3, inf) | Karpoff (1987): price-volume relation |
| 4 | atrNorm (ATR/close) | [0, inf) | Volatility regime normalization |
| 5 | wc (hw * mw) | [0.36, 1.40] | Lo (2004) AMH: adaptive micro-structure |

**R-squared interpretation for financial returns:**

| R^2 | Interpretation | Source |
|-----|----------------|--------|
| 0.02-0.03 | Economically significant (hundreds of bps/yr) | Lo & MacKinlay (1999) |
| 0.05+ | Trading strategy grade | -- |
| > 0.10 | Extremely rare in return prediction | -- |

---

## Statistical Findings

The following issues were identified during this documentation effort:

```
[VALID] S-7 HC3 Implementation -- indicators.js:636-674
  The sandwich estimator correctly uses w^2 * e_i / (1-h_ii)^2 for the
  HC3 meat matrix, with h_ii capped at 0.99 to prevent division by zero.
  VIF diagnostic (lines 676-733) is a full auxiliary OLS implementation.

[VALID] S-11 Hill Estimator -- indicators.js:276-307
  Correctly uses absolute returns in descending order. The IID caveat for
  SE is explicitly noted in code comments. k = floor(sqrt(n)) is standard.

[VALID] M-6 Hurst Exponent -- indicators.js:212-264
  Log-returns used (not raw prices). Population std (1/n) per Mandelbrot-Wallis
  convention. R-squared of the log-log regression is returned for quality assessment.

[NOTE] S-10 GPD xi Clamp -- indicators.js:365
  xi is clamped at 0.499 when PWM gives xi >= 0.5. This is correct per
  Hosking & Wallis (1987), but the clamp silently truncates the estimate.
  For KOSPI data with xi typically 0.2-0.4, this rarely activates.
  Impact: Low. The guard protects against invalid PWM estimates.

[WARNING] S-18 VRP Proxy Thresholds -- signalEngine.js
  The 0.8/1.2 thresholds for risk-on/risk-off classification and the
  +/-5% confidence adjustments are all Grade [D] heuristics with no
  IC validation against forward returns. These should be calibrated
  against KRX data or demoted to informational-only status.

[WARNING] M-7 Hurst Shrinkage n_eff Base -- patterns.js:230-237
  The log base 1.5 for computing n_eff from data length N has no
  academic derivation. While the overall shrinkage framework (James-Stein)
  is Grade [A], this specific functional form is Grade [D].
  Impact: Moderate. Affects all pattern confidence scores via hw.
  Fix: Calibrate n_eff function against bootstrap simulation of R/S
  estimator variance as a function of sample size.

[WARNING] S-13 Mean Reversion Threshold 3 ATR -- patterns.js:245-250
  The 3 ATR threshold is based on a normal 3-sigma analogy, but KRX
  return distributions are fat-tailed (alpha ~ 3-5). The actual
  97th percentile of moveATR distribution may differ significantly from 3.
  Phase 3 M16 calibration (2026-03-25) confirmed this is uncalibrated.
  Fix: Compute empirical moveATR percentiles from 2,704-stock data.

[NOTE] S-4 EWMA vs Full GARCH -- indicators.js:1336-1376
  EWMA (IGARCH with omega=0) is a simplification that assumes zero
  long-run variance mean. For long time series, full GARCH(1,1) with
  omega > 0 would provide mean-reverting volatility. The current
  choice is computationally pragmatic for client-side JavaScript.

[NOTE] S-16 Cornish-Fisher Accuracy at Low df
  For patterns with very small samples (n < 10, df < 8), the
  Cornish-Fisher approximation degrades. However, such patterns
  fall below the n >= 30 WLS regression threshold and use
  Bulkowski fallback instead, so this approximation is never
  exercised in the danger zone.

[VALID] S-5 WLS R-squared -- indicators.js:605-617
  Weighted R-squared correctly uses weighted mean and weighted
  residual sum of squares. Math.max(0, ...) guards against
  numerical negativity. Adjusted R-squared (Theil 1961) is included.

[VALID] S-6 Ridge Penalty Exclusion -- indicators.js:581-585
  Intercept column (j=0) is correctly excluded from Ridge penalty.
  This follows Hastie, Tibshirani & Friedman (2009) standard practice.
```

---

*Document generated: 2026-04-06*
*Cross-reference: `S2_formula_appendix.md` for detailed derivations*
*Source files: `core_data/01_mathematics.md`, `core_data/02_statistics.md`,
`core_data/03_physics.md`, `core_data/12_extreme_value_theory.md`,
`core_data/13_information_geometry.md`, `core_data/17_regression_backtesting.md`,
`core_data/34_volatility_risk_premium_harv.md`*
