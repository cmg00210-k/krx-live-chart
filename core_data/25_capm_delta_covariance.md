# 25. CAPM, Delta, and Covariance Theory for CheeseStock

> 2026-03-30 Research Report — financial-theory-expert
> Scope: Integration pathways for CAPM beta, factor delta, and covariance
> estimation into the existing Wc weight system and backtester pipeline.

---

## Part 1: CAPM Integration

### 1.1 CAPM Recap and Current System Position

The Capital Asset Pricing Model (Sharpe 1964, Lintner 1965):

```
E[R_i] = R_f + beta_i * (E[R_m] - R_f)

beta_i = Cov(R_i, R_m) / Var(R_m)
```

**Current status in CheeseStock:** The APT factor model (23_apt_factor_model.md)
already identifies Market Beta as an available factor with "LOW" implementation
difficulty and expected IC of +0.01~0.03. The 17-column offline Ridge regression
(rl_residuals.py) includes beta as a feature and found it significant at
t=+11.9, p<0.001 in the 297K-sample Phase 4-1 calibration.

**Key finding:** CAPM is a *special case* of the existing APT framework
(Ross 1976). APT with a single factor (the market portfolio) collapses to CAPM.
The existing system already subsumes CAPM through the multi-factor design.
However, explicit CAPM beta computation has standalone value for:

1. **Risk characterization** — labeling stocks as defensive (beta<0.8)
   vs aggressive (beta>1.2) in the sidebar/financial panel
2. **Jensen's Alpha computation** — measuring pattern-signal alpha
   after controlling for market exposure
3. **WACC inputs** — if the financial panel ever computes intrinsic value

### 1.2 Beta Calculation for KRX Stocks

#### Data Available NOW

```
Source: data/{market}/{code}.json — daily OHLCV, ~250 trading days
Market proxy: KOSPI index returns (needs external source or synthetic)

Stock returns: r_{i,t} = (close_t - close_{t-1}) / close_{t-1}
Market returns: r_{m,t} = (KOSPI_t - KOSPI_{t-1}) / KOSPI_{t-1}
```

#### Problem: No Market Index OHLCV in Current Data

The `data/index.json` has `lastClose`, `prevClose`, `change`, `changePercent`
for individual stocks — but no KOSPI/KOSDAQ *index* time series.

**Workaround A — Market-cap-weighted synthetic index:**
```
r_m,t = sum_i (w_i * r_i,t)

where w_i = marketCap_i / sum(marketCap)
```
This is constructible from existing data: all 938 KOSPI stocks have daily OHLCV
and marketCap in index.json. Equal-weighted or cap-weighted portfolio return
serves as the market proxy.

**Workaround B — Download KOSPI index series:**
pykrx provides `stock.get_index_ohlcv_by_date()` for market indices.
This would be the cleanest approach — one new data file:
`data/market/kospi_index.json` and `data/market/kosdaq_index.json`.

**Recommendation: Workaround B.** A single pykrx call per index costs ~1 second.
Add to `download_ohlcv.py` or create `download_market_index.py`.

#### Beta Estimation Methods (in order of sophistication)

**Method 1: Full-sample OLS (simplest)**
```
beta_i = Cov(r_i, r_m) / Var(r_m)

Cov(r_i, r_m) = (1/T) * sum_t (r_{i,t} - r_i_bar)(r_{m,t} - r_m_bar)
Var(r_m)       = (1/T) * sum_t (r_{m,t} - r_m_bar)^2
```
Using ~250 daily observations. This is trivially computable in JS with
existing calcWLSRegression() — single regressor `r_m` against `r_i`.

**Method 2: Rolling OLS (time-varying)**
```
beta_i,t = Cov(r_i, r_m | window) / Var(r_m | window)

window = 60 trading days (~3 months), rolled daily
```
Produces a time series of betas. More responsive to regime changes.

**Method 3: Exponentially weighted (EWMA beta)**
```
sigma_m,t^2  = lambda * sigma_m,t-1^2 + (1-lambda) * r_m,t^2
sigma_im,t   = lambda * sigma_im,t-1  + (1-lambda) * r_i,t * r_m,t
beta_i,t     = sigma_im,t / sigma_m,t^2

lambda = 0.94 (RiskMetrics 1996)
```
This uses the same EWMA lambda already present in `_buildRLContext()` for
EWMA volatility. Minimal new code.

**Method 4: Kalman filter beta**
```
State equation:     beta_t = beta_{t-1} + eta_t,  eta_t ~ N(0, Q)
Observation:        r_i,t = alpha + beta_t * r_m,t + eps_t,  eps_t ~ N(0, R)
```
The existing `calcKalman()` in indicators.js handles scalar state.
For beta estimation, the observation equation is *regression-type* rather
than level-type. This requires modifying the Kalman gain:

```
K_t = P_t|t-1 * r_m,t / (r_m,t^2 * P_t|t-1 + R)
beta_t = beta_t|t-1 + K_t * (r_i,t - beta_t|t-1 * r_m,t)
P_t = (1 - K_t * r_m,t) * P_t|t-1 + Q
```

(주: alpha = 0 가정 — 일별 기대수익률이 무시가능하므로 (RiskMetrics 1996 convention). Alpha를 jointly estimate하려면 2-dimensional state 필요.)

This is a *new function* (calcKalmanBeta) — ~20 lines of JS, reusing the
adaptive-Q pattern from calcKalman().

### 1.3 Risk-Free Rate (R_f) for Korea

**Source: 한국은행 경제통계시스템 (ECOS) or 금융투자협회 (KOFIA)**

| Instrument | Typical Maturity | As of 2026-03 | Source |
|-----------|-----------------|--------------|--------|
| 국고채 3년 | 3Y | ~3.0-3.5% p.a. | KOFIA API |
| 국고채 10년 | 10Y | ~3.2-3.8% p.a. | KOFIA API |
| CD 91일 | 91D | ~3.0-3.3% p.a. | 한국은행 ECOS |
| 통안채 1년 | 1Y | ~3.0-3.4% p.a. | 한국은행 ECOS |

**For daily returns regression:**
```
r_f,daily = (1 + R_f_annual)^(1/250) - 1

Example: R_f = 3.3% → r_f,daily = 0.0129% per day
```

**Practical shortcut:** For pattern-signal backtesting on a 1-20 day horizon,
the daily risk-free rate is ~0.013%. Over a 10-day holding period, R_f
contributes ~0.13% — which is smaller than the KRX transaction cost
(commission 0.03% + tax 0.18% = 0.21% one-way). At this frequency,
**setting R_f = 0 introduces negligible error** (<0.15% over 10 days).

**Recommendation:**
- For WLS regression: R_f ≈ 0 (de minimis at pattern horizons)
- For financial panel WACC: fetch annual 국고채 3년 from KOFIA or hardcode
  a conservative 3.5% (updated quarterly)
- Tier classification: [B][L:MAN] — academically grounded, manually updated

### 1.4 Market Risk Premium (E[R_m] - R_f) for KRX

Academic estimates for Korea:

| Study | Period | ERP Estimate |
|-------|--------|-------------|
| Damodaran (annual update) | 1990-2025 | 5.5-7.0% |
| KCMI (한국자본시장연구원) | 2000-2020 | 6.0-8.0% |
| Historical KOSPI excess return | 2000-2024 | ~4-5% geometric |

**KOSPI geometric mean return (2000-2024):** ~8-10% p.a.
**Minus R_f (~3-4%):** ERP ≈ 5-7% p.a.

For CheeseStock's pattern backtesting, the absolute ERP level matters less
than the *relative* beta ranking across stocks. As long as beta ordering is
preserved, the pattern-conditional expected return decomposition is valid.

### 1.5 CAPM vs APT: Complementary, Not Redundant

```
CAPM:  E[R_i] - R_f = beta_i * ERP                     (1 factor)
APT:   E[R_i] - R_f = b1*F1 + b2*F2 + ... + bK*FK      (K factors)
FF3:   E[R_i] - R_f = beta*MKT + s*SMB + h*HML          (3 factors)
```

CAPM is nested within APT. The existing 17-column Ridge model already includes
beta alongside momentum, value, size, liquidity — making it a *de facto*
multi-factor model. Adding CAPM separately is unnecessary for prediction.

**Where CAPM has unique value:**
1. **Alpha attribution** — "how much of this pattern's return is explained
   by market exposure vs genuine pattern information?"
2. **Risk-adjusted Sharpe** — pattern returns adjusted by beta exposure
3. **Interpretability** — "Samsung is beta 1.2, pattern predicts +3%,
   of which 1.4% is market beta contribution and 1.6% is alpha"

---

## Part 2: Delta Measurement

### 2.1 Definition of Delta in This Context

"Delta" (δ) is the **sensitivity of a stock's return to a factor change**.
In the language of partial derivatives:

```
delta_{i,k} = partial R_i / partial F_k

For a linear factor model:
  R_i = alpha_i + sum_k delta_{i,k} * F_k + epsilon_i

delta_{i,k} is the regression coefficient (factor loading / factor beta)
```

In CAPM, there is one delta: `delta_i = beta_i = dR_i/dR_m`.
In the multi-factor APT, each factor has its own delta.

**Current system mapping:**

| Factor (F_k) | CheeseStock Variable | Existing Location |
|--------------|---------------------|-------------------|
| Market return | Not yet computed | NEW: needs market index |
| Momentum (60d) | `momentum60` | backtester.js (removed in Phase 7 C-1) |
| Confidence | `confidence/100` | backtester.js design matrix col 1 |
| Trend strength | `trendStrength` | backtester.js design matrix col 2 |
| Volume ratio | `ln(volumeRatio)` | backtester.js design matrix col 3 |
| Volatility (ATR) | `atrNorm` | backtester.js design matrix col 4 |

The WLS regression coefficients in backtester.js **are** the deltas.
They measure how sensitive pattern returns are to each factor.

### 2.2 Delta as Partial Derivative: Formal Statement

For the existing 5-column WLS model:

```
E[R_pattern] = beta_0 + beta_1*conf + beta_2*trend + beta_3*lnVol + beta_4*atrNorm

delta_conf  = dE[R] / d(conf)  = beta_1
delta_trend = dE[R] / d(trend) = beta_2
delta_lnVol = dE[R] / d(lnVol) = beta_3
delta_atr   = dE[R] / d(atrNorm) = beta_4
```

In a linear model, the deltas are constant (not state-dependent).
This is a limitation — in reality, the sensitivity of pattern returns to
confidence might vary in high-volatility vs low-volatility regimes.

### 2.3 Time-Varying Delta Estimation

**Method A: Rolling OLS Window**

```
For each stock i, at time t:
  Collect (r_i, F_k) for t-W to t (window W = 60 or 120 days)
  Run OLS: r_i = alpha + sum_k delta_k * F_k + eps
  delta_{i,k,t} = beta_k from this regression
```

**Pros:** Simple, interpretable, already achievable with calcWLSRegression().
**Cons:** Window choice is arbitrary; delta changes discontinuously when
old observations drop out; requires W >= 3*K observations for stability.

**Method B: Kalman Filter (already implemented for prices)**

The existing calcKalman() handles scalar state. For time-varying delta,
we need a *multivariate* state-space model:

```
State:       delta_t = delta_{t-1} + eta_t,  eta_t ~ N(0, Q_delta)
Observation: r_i,t = F_t' * delta_t + eps_t, eps_t ~ N(0, R)
```

Where delta_t is now a K-dimensional vector and Q_delta is K x K.
This is a **Kalman regression** — standard in finance (Wells 1996,
"The Kalman Filter in Finance").

For K=5 factors, this requires K x K matrix operations per time step.
Computationally feasible in JS for a single stock, but would require
~25 matrix multiplications per step per stock. For 2,700 stocks in the
Worker, this is expensive but parallelizable.

**Implementation cost:** Medium. Extend calcKalman() to vector state or
create new calcKalmanRegression(regressors, responses, Q, R).

**Method C: DCC-GARCH (Dynamic Conditional Correlation)**

Engle (2002), "Dynamic Conditional Correlation":

```
Stage 1: Estimate univariate GARCH for each return series
  sigma_i,t^2 = omega + alpha * r_{i,t-1}^2 + beta * sigma_{i,t-1}^2

Stage 2: Standardize returns
  z_{i,t} = r_{i,t} / sigma_{i,t}

Stage 3: Dynamic correlation
  Q_t = (1-a-b)*Q_bar + a*(z_{t-1} * z_{t-1}') + b*Q_{t-1}
  rho_t = diag(Q_t)^{-1/2} * Q_t * diag(Q_t)^{-1/2}
```

**Assessment for CheeseStock:** DCC-GARCH is overkill for the current
application. It requires maximum likelihood estimation with numerical
optimization — not achievable with the existing Gauss-Jordan matrix
inversion. This belongs in the Python offline pipeline, not in-browser JS.

**Recommendation:** Method B (Kalman filter) for a future upgrade path.
Method A (rolling window with EWMA weighting) for immediate use — this
is precisely what the current WLS with lambda=0.995 already does within
the pattern backtester.

### 2.4 Delta Decomposition: Systematic vs Idiosyncratic

From the factor model:

```
R_i = alpha_i + sum_k delta_{i,k} * F_k + epsilon_i
       |          \_____________/            |
       |          systematic return          idiosyncratic
       stock alpha
```

**Variance decomposition:**

```
Var(R_i) = delta_i' * Var(F) * delta_i + Var(epsilon_i)
           \_________________________/       \___________/
           systematic variance                idiosyncratic variance

R^2_i = systematic variance / total variance
```

**Existing metric:** The WLS regression R^2 in backtester.js is exactly this
ratio for the pattern-factor model. Current values:

```
R^2 in financial returns: 0.02-0.05 is economically significant (Lo 1999)
CheeseStock WLS R^2: varies by pattern, typically 0.01-0.08
```

**The residual (1 - R^2) is the idiosyncratic component.** This is directly
related to the Wc weight system's "unreliable weight domain" — the portion
of pattern return that cannot be explained by the factor model.

---

## Part 3: Delta Learnability

### 3.1 Can Delta Be a Learnable Parameter?

Yes. In the existing framework, deltas are already learned — they are the
regression coefficients from calcWLSRegression(). The question is whether
they should be treated as:

**(a) Fixed parameters** — estimated once on all data, applied to all stocks
**(b) Stock-specific parameters** — estimated per stock (requires per-stock data)
**(c) Regime-adaptive parameters** — varying over time (Kalman, rolling)
**(d) Cross-sectionally shrunk parameters** — James-Stein / Bayesian

Currently: **(a)** — same coefficients for all occurrences within a pattern type.

### 3.2 Connection to Learnable Constants Framework

From 22_learnable_constants_guide.md, deltas (WLS coefficients) map to:

| Delta Type | Tier | Mechanism | Rationale |
|-----------|------|-----------|-----------|
| Intercept (alpha_p) | C | WLS | Pattern-specific, KRX-adapted |
| delta_conf | B | WLS | Academic basis (Bulkowski) |
| delta_trend | B | WLS | Academic basis (Lo, Wang) |
| delta_lnVol | B | WLS | Academic basis (Caginalp) |
| delta_atr | C | WLS | KRX-specific volatility regime |

All are Tier B or C — **fully learnable** under the existing protocol.
The WLS refit mechanism [L:WLS] is already designated for these.

### 3.3 GCV for Delta Optimization

The Ridge lambda is already selected by GCV (Golub, Heath & Wahba 1979)
in `selectRidgeLambdaGCV()` (backtester.js). This indirectly optimizes
the deltas by controlling the bias-variance tradeoff:

```
GCV(lambda) = (1/n) * sum_i [y_i - f_lambda(x_i)]^2 / [1 - tr(S_lambda)/n]^2

S_lambda = X(X'WX + lambda*I)^{-1}X'W  (smoother matrix)
```

**Direct delta optimization via GCV:** Instead of using GCV only for lambda,
one could treat the design matrix columns as a model selection problem:

```
For each candidate feature set S ⊂ {conf, trend, lnVol, atrNorm, wc, mom60, ...}:
  Fit Ridge-WLS on S
  Compute GCV score
  Select S* with minimum GCV

The optimal delta vector is then the coefficients from S*.
```

This is essentially **automatic feature selection with Ridge regularization**
— already achievable with the existing infrastructure by looping over
subsets. For 6 candidate features, there are 2^6 = 64 subsets — computationally
trivial even in JS.

### 3.4 Ridge Regression and Shrinkage Theory

The relationship between Ridge and delta estimation is fundamental:

```
OLS delta:   delta_OLS = (X'WX)^{-1} X'Wy
Ridge delta: delta_Ridge = (X'WX + lambda*I)^{-1} X'Wy
```

Ridge shrinks deltas toward zero, which is a form of **James-Stein shrinkage**
(Stein 1956, James & Stein 1961):

```
delta_JS = (1 - c/||delta_OLS||^2) * delta_OLS

where c = (K-2) * sigma^2 / ||delta_OLS||^2
K = number of parameters (must be >= 3 for JS domination)
```

**Key theorem (Stein 1956):** When K >= 3, the James-Stein estimator
dominates the OLS estimator in terms of total mean squared error. This
provides theoretical justification for Ridge regularization.

The existing Ridge lambda=2.0 (now GCV-selected) is an implicit shrinkage
estimator. The N0=35 shrinkage denominator in backtester.js (Efron & Morris
1975) serves the same purpose for win-rate estimation.

### 3.5 Bayesian Shrinkage for Delta Stability

**Conjugate Normal-Inverse-Gamma prior (already described in 17_regression_backtesting.md §17.7):**

```
Prior:     delta ~ N(delta_0, sigma^2 * V_0)
           sigma^2 ~ IG(a_0, b_0)

Posterior: delta | data ~ N(delta_n, sigma_n^2 * V_n)

V_n = (V_0^{-1} + X'WX)^{-1}
delta_n = V_n * (V_0^{-1} * delta_0 + X'Wy)
```

**Choice of prior delta_0:**
- For market beta: delta_0 = 1.0 (prior that stocks move with market)
- For pattern factors: delta_0 = 0 (prior of no effect, conservative)
- For confidence: delta_0 = +0.02 (Bulkowski: higher confidence → higher return)

**Implementation path:** This is the Bayesian NIG regression described in
§17.7 of the existing docs. It requires matrix algebra (V_0^{-1} + X'WX)^{-1}
which is already available via _invertMatrix(). The primary obstacle is
choosing V_0 (prior precision), which could itself be selected by
empirical Bayes / marginal likelihood maximization.

### 3.6 Delta Tier Classification (5-Tier A~E)

Proposed classification for delta parameters:

| # | Delta Parameter | Value (Current) | Proposed Tier | Learn Mech | Range |
|---|----------------|-----------------|--------------|-----------|-------|
| 51 | delta_conf (confidence→return slope) | varies by pattern | B | WLS | [-0.1, +0.3] |
| 52 | delta_trend (trend strength→return) | varies by pattern | B | WLS | [-0.2, +0.2] |
| 53 | delta_lnVol (volume→return) | varies by pattern | B | WLS | [-0.1, +0.1] |
| 54 | delta_atr (volatility→return) | varies by pattern | C | WLS | [-0.3, +0.3] |
| 55 | delta_market (beta, if added) | ~1.0 cross-section avg | B | WLS/Kalman | [0.0, 3.0] |
| 56 | delta_momentum (if re-added) | varies | B | WLS | [-0.1, +0.1] |

These would extend the Master Constant Registry (#41-#50 → #51-#56).

---

## Part 4: Individual Stock Covariance

### 4.1 Can Covariance Be Computed per Stock?

**Short answer: Yes, pairwise — but the N x N matrix is the challenge.**

For any pair of stocks (i, j) with overlapping daily OHLCV:

```
Cov(R_i, R_j) = (1/T) * sum_t (r_{i,t} - r_i_bar)(r_{j,t} - r_j_bar)
```

With T=250 daily observations and N=2,728 stocks:
- Full covariance matrix: N x N = 2,728 x 2,728 = 7,442,384 unique entries
- Memory: ~57 MB for float64 (manageable)
- Computation: O(T * N^2) ≈ 250 * 7.4M ≈ 1.9 billion multiply-adds

This is **not feasible in-browser JS** (would take minutes).
However, it is **easily feasible in offline Python** (numpy computes
a 2700x2700 covariance matrix in ~1 second).

### 4.2 Pairwise Estimation Challenges

**Challenge 1: Missing data / non-synchronous trading**

Not all 2,728 stocks trade on every day. Suspended stocks, IPOs, and
delistings create ragged arrays. Solutions:
- Pairwise deletion: use only common trading days for each pair
- List-wise deletion: restrict to stocks with full 250-day history (~90%)

**Challenge 2: Estimation error (Marchenko-Pastur limit)**

When N ≈ T (number of stocks ≈ number of observations), the sample
covariance matrix is dominated by noise. The critical ratio:

```
q = N / T

CheeseStock: q = 2728 / 250 = 10.9

Marchenko-Pastur: eigenvalue distribution of sample Σ is distorted when q > 0.
For q > 1, the sample covariance matrix is not even invertible!
```

With q = 10.9, the sample covariance matrix is **rank-deficient** — it has
at most 250 non-zero eigenvalues out of 2,728. Raw sample covariance is
**useless for portfolio optimization** without massive regularization.

**Challenge 3: Time-varying correlations**

Correlations increase during market stress (Forbes & Rigobon 2002,
"No Contagion, Only Interdependence"). A single covariance matrix does
not capture regime shifts. The DCC-GARCH approach (§2.3) addresses this
but is computationally intensive.

### 4.3 Sector-Based Covariance Approximation

**Core insight:** Most of the meaningful covariance structure is captured
by sector/industry membership. Instead of N x N, estimate:

```
1. Within-sector average correlation: rho_within,s for each sector s
2. Between-sector average correlation: rho_between,s1,s2 for each pair
3. Stock-specific volatility: sigma_i from individual OHLCV
```

Then the approximate covariance:

```
Cov(R_i, R_j) ≈ rho(sector_i, sector_j) * sigma_i * sigma_j
```

**Data available:**
- `index.json` has `sector` field for all 2,728 stocks (KSIC 기준)
- `data/sector_fundamentals.json` has sector-level aggregates
- Number of distinct sectors: ~50-80 (KSIC 중분류)

Sector covariance matrix: 80 x 80 = 6,400 entries — trivially estimable
and storeable. This is a **massive dimensionality reduction** from
7.4M to 6.4K parameters.

### 4.4 Factor Model Approach to Covariance

The gold standard for large-scale covariance estimation:

```
Sigma = B * Omega * B' + D

Where:
  B     = N x K factor loading matrix (N stocks, K factors)
  Omega = K x K factor covariance matrix (small, estimable)
  D     = N x N diagonal matrix of idiosyncratic variances
```

**Why this works:**
- With K=5 factors, we need only N*K + K*(K+1)/2 + N parameters
  = 2728*5 + 15 + 2728 = 16,383 parameters (vs 7.4M for full matrix)
- B is estimated from individual stock regressions (one per stock)
- Omega is a 5x5 matrix (trivially estimable)
- D requires only one variance per stock

**Factor model for existing CheeseStock factors:**

```
R_i,t = alpha_i + beta_i * MKT_t + s_i * SMB_t + h_i * HML_t
                + l_i * LIQ_t + m_i * MOM_t + epsilon_{i,t}

B_i = [beta_i, s_i, h_i, l_i, m_i]  (5-vector for stock i)
```

**Implementation path (Python offline):**

```python
# For each stock i:
#   Run OLS: r_i = alpha + B_i @ F + eps
#   Store B_i (factor loadings) and Var(eps_i)
#
# Factor covariance:
#   Omega = np.cov(F.T)  # 5x5
#
# Full covariance approximation:
#   Sigma = B @ Omega @ B.T + np.diag(D)
```

This is the approach used by BARRA/MSCI risk models, Northfield,
and most institutional risk systems.

---

## Part 5: Large-Scale Covariance Matrix Estimation

### 5.1 Ledoit-Wolf Shrinkage Estimator

Ledoit, O. & Wolf, M. (2004). "A Well-Conditioned Estimator for
Large-Dimensional Covariance Matrices." Journal of Multivariate Analysis.

```
Sigma_LW = alpha * F + (1 - alpha) * S

Where:
  S = sample covariance matrix
  F = structured target (e.g., diagonal, single-factor model, identity)
  alpha = optimal shrinkage intensity (computed analytically)

alpha* = min(beta_bar / delta_bar, 1)

beta_bar = (1/T^2) * sum_t || r_t r_t' - S ||_F^2
delta_bar = || S - F ||_F^2
```

(주: 위 공식은 target F = I (identity matrix)일 때의 단순화. Factor-model 또는 constant-correlation target 사용 시 rho 보정 항이 필요: kappa = (pi - rho) / gamma. 자세한 내용은 Ledoit & Wolf (2004) Theorem 1 참조.)

**Shrinkage target options:**

| Target F | Name | Properties |
|----------|------|------------|
| diag(S) | Diagonal | Assumes zero correlation — extreme |
| sigma_i * sigma_j * rho_bar | Constant correlation | Single correlation param |
| B * Omega * B' + D | Factor model | Uses APT structure |

**For CheeseStock:** The factor model target is optimal because:
1. We already have the factor loadings from the APT regression
2. It preserves sector structure while shrinking estimation noise
3. It is well-conditioned even when N >> T

### 5.2 Random Matrix Theory (RMT) for Noise Filtering

Marchenko, V. & Pastur, L. (1967). "Distribution of Eigenvalues for
Some Sets of Random Matrices."

For a random matrix with N rows, T columns, and ratio q = N/T:

```
Marchenko-Pastur distribution bounds:
  lambda_+ = sigma^2 * (1 + sqrt(q))^2     (upper edge)
  lambda_- = sigma^2 * (1 - sqrt(q))^2     (lower edge, if q < 1)

For CheeseStock: q = 2728/250 = 10.9
  lambda_+ = sigma^2 * (1 + sqrt(10.9))^2 = sigma^2 * 18.5
  lambda_- = 0  (since q > 1, there are N-T zero eigenvalues)
```

**RMT cleaning procedure (Laloux et al. 1999):**

```
1. Compute eigendecomposition: S = V * Lambda * V'
2. Identify noise eigenvalues: those within M-P bounds
3. Replace noise eigenvalues with their average (or zero)
4. Reconstruct: S_clean = V * Lambda_clean * V'
```

**For q > 1 (our case):** Most eigenvalues are noise. Only the largest
~10-30 eigenvalues are above the M-P upper bound and carry real signal.
This aligns with having ~5-10 meaningful factors in a market of 2,700 stocks.

### 5.3 Storage Architecture for Covariance Data

Proposed new core_data file or data/ JSON:

```
data/covariance/
  factor_loadings.json     — B matrix (N x K), ~100 KB
  factor_covariance.json   — Omega (K x K), ~1 KB
  idiosyncratic_var.json   — D diagonal (N x 1), ~20 KB
  sector_correlation.json  — sector pairwise rho (S x S), ~50 KB
  shrinkage_target.json    — pre-computed Ledoit-Wolf alpha, ~1 KB
```

Total: ~170 KB — well within Cloudflare Pages limits.

**Update frequency:** Monthly or quarterly (factor loadings are slow-moving).
Fits naturally into the existing `scripts/` batch pipeline.

### 5.4 Observation Requirements

**Minimum observations for reliable estimation:**

| Matrix Type | Dimension | Required T | Current T | Feasible? |
|-------------|----------|-----------|----------|-----------|
| Factor loading (per stock) | 1 x K=5 | ≥ 30 | 250 | YES |
| Factor covariance Omega | K x K = 5x5 | ≥ 30 | 250 | YES |
| Sector correlation (S=80) | 80 x 80 | ≥ 160 | 250 | YES (marginal) |
| Full covariance (N=2728) | N x N | ≥ 5,000+ | 250 | NO (rank-deficient) |
| Ledoit-Wolf shrunk | N x N | any T | 250 | YES (by design) |

**Key insight:** The factor model approach is exactly designed for this
regime (N >> T). It reduces the estimation problem from N^2 parameters
to N*K + K^2 parameters, making T=250 sufficient.

### 5.5 Reducing Residual Weight and Increasing Reliable Domains

The Wc weight system has a concept of "reliable" vs "unreliable" weight
domains. Covariance information contributes to reliability:

**Without covariance:** Pattern return prediction uses only pattern-specific
features (confidence, trend, volume, ATR). Cross-stock correlation structure
is ignored — the same pattern in a semiconductor stock and a telecom stock
is treated identically.

**With covariance/factor loading:**
```
predicted_return_i = alpha_p + delta' * x_i + beta_i * expected_market_return

The beta_i * expected_market_return term captures the portion of return
attributable to systematic risk. Subtracting this gives a purer alpha signal.
```

**Quantitative impact estimate:**
- Market factor alone explains ~10-30% of individual stock return variance
  (beta^2 * Var(R_m) / Var(R_i))
- Adding size + value + momentum: ~15-40% of variance explained
- Remaining 60-85%: idiosyncratic (pattern alpha lives here)

By controlling for systematic risk, the pattern signal's R^2 should
*increase* because the dependent variable has less unexplained noise.
This is equivalent to reducing the denominator of the information
coefficient IC = Corr(predicted, realized) when the prediction is
alpha rather than raw return.

---

## Part 6: Residual Reduction Strategy

### 6.1 How Covariance Reduces Unexplained Wc Weight

The Wc weight system (project_wc_formula_chain.md) follows this chain:

```
OHLCV → indicators → patterns → hw → vw → mw → rw → wc → predicted return
```

The **residual** is the portion of actual return not explained by the
predicted return. Currently:

```
residual_i = actual_return_i - predicted_return_i

Var(residual) = Var(actual) - R^2 * Var(actual)  [if model is correct]
              = (1 - R^2) * Var(actual)
```

**Strategy to reduce residual:**

**Step 1: Market-adjust returns before regression**
```
excess_return_i = actual_return_i - beta_i * market_return

Now regress: excess_return = alpha_p + delta' * x_i + eps

The eps here is smaller than before because market noise is removed.
```

This is the **Jensen's Alpha decomposition** applied to the backtest:

```
Before: R^2_total ≈ 0.02-0.05
After market adjustment:
  R^2_alpha ≈ 0.03-0.08 (expected improvement)

Because Var(excess_return) < Var(raw_return):
  The explained fraction increases even if the absolute explanatory
  power stays the same.
```

**Step 2: Add factor exposures to the design matrix**

Instead of removing market return from the dependent variable, add
factor returns as regressors:

```
Current 5-column: [1, conf, trend, lnVol, atrNorm]
Extended 8-column: [1, conf, trend, lnVol, atrNorm, market_ret, smb_ret, hml_ret]
```

This was the approach taken in the offline 17-column Ridge regression
(23_apt_factor_model.md), which improved IC from 0.0567 to 0.0998
(+0.0430 delta). The in-browser WLS removed these columns in Phase 7
to avoid look-ahead bias — but with proper factor returns computed
*ex-ante* (at pattern detection time), they could be re-added.

### 6.2 Idiosyncratic Risk and Pattern Confidence

**Theoretical link:** Stocks with high idiosyncratic risk (low R^2 in factor
model) are harder to predict. Pattern signals in these stocks should receive
lower confidence adjustments.

```
confidence_adjusted = confidence * (1 - lambda_idio * idio_risk_rank)

Where:
  idio_risk_rank = rank of Var(eps_i) among all stocks (0 = lowest risk)
  lambda_idio = sensitivity parameter [D][L:GS] range [0, 0.3]
```

This connects covariance analysis to the pattern detection pipeline:
- High idiosyncratic risk → more noise → lower adjusted confidence
- Low idiosyncratic risk → cleaner signal → preserve confidence

### 6.3 Cross-Sectional Regression: Alpha vs Beta

Fama-MacBeth (1973) two-pass regression:

```
Pass 1 (time-series): For each stock i, estimate factor loadings B_i
  R_{i,t} = alpha_i + B_i' * F_t + eps_{i,t}    for t = 1...T

Pass 2 (cross-section): For each time t, estimate risk premia
  R_{i,t} = gamma_0,t + gamma_1,t * beta_i + gamma_2,t * s_i + ... + u_{i,t}

Average across time:
  gamma_k = (1/T) * sum_t gamma_{k,t}
  t_stat(gamma_k) = gamma_k / (stderr(gamma_k,t) / sqrt(T))
```

**Application to CheeseStock:**

This procedure can decompose pattern returns into:
- **Factor premium component** — compensation for bearing systematic risk
- **Alpha component** — genuine pattern information beyond risk premia
- **Residual** — noise

If gamma_1 (market risk premium) is economically significant, it means
that patterns with higher-beta stocks tend to have higher returns simply
because of market exposure, not because the pattern is more predictive.

**Implementation feasibility:**
- Pass 1: already done for each pattern type in backtester.js
- Pass 2: requires cross-sectional data (many stocks on same date) —
  this is the batch backtest architecture (project_stage5_backtest_design.md)
  which processes 2,704 stocks and 303,956 pattern occurrences.

The Fama-MacBeth approach would run in the Python offline pipeline,
not in-browser.

---

## Part 7: Implementation Roadmap

### 7.1 What's ALREADY Possible (No New Data)

| Capability | Tool | Effort | Location |
|-----------|------|--------|----------|
| Per-pattern delta estimation | calcWLSRegression() | DONE | backtester.js |
| Ridge shrinkage of deltas | GCV + Ridge lambda | DONE | backtester.js |
| EWMA volatility (for beta) | _buildRLContext() | DONE | backtester.js |
| James-Stein shrinkage (win rates) | N0=35 shrinkage | DONE | backtester.js |
| HC3 robust standard errors | calcWLSRegression() | DONE | indicators.js |
| Sector grouping | index.json sector field | DONE | api.js + financials.js |
| Factor model design (APT) | 23_apt_factor_model.md | DOCUMENTED | core_data |

### 7.2 Requires NEW Data Sources

| Capability | Data Needed | Source | Effort |
|-----------|------------|--------|--------|
| Market beta | KOSPI/KOSDAQ index OHLCV | pykrx `get_index_ohlcv_by_date` | LOW |
| SMB/HML factors | Market cap + PBR ranking | index.json + financials/ | MEDIUM |
| Risk-free rate | 국고채 3년 | KOFIA API or hardcode | LOW |
| Investor type flow | 개인/기관/외인 순매수 | Koscom API | HIGH (blocked) |

### 7.3 Requires NEW Infrastructure

| Capability | What's Needed | Effort |
|-----------|--------------|--------|
| Full covariance matrix | Python batch (numpy) | MEDIUM |
| Factor loading storage | data/covariance/*.json | LOW |
| Kalman beta (in-browser) | calcKalmanBeta() in indicators.js | MEDIUM |
| Fama-MacBeth cross-section | Python batch pipeline | HIGH |
| DCC-GARCH | Python (arch package) | HIGH |
| Ledoit-Wolf shrinkage | Python (sklearn.covariance) | LOW |

### 7.4 Prioritized Implementation Order

```
Priority 1 (Immediate, LOW effort):
  - Download KOSPI/KOSDAQ index OHLCV via pykrx
  - Compute full-sample beta per stock in Python
  - Store in index.json or separate data/beta.json
  - Display beta in financial panel (D column)

Priority 2 (Near-term, MEDIUM effort):
  - Compute factor loadings (B matrix) for all stocks
  - Store factor covariance (Omega) and idiosyncratic variance (D)
  - Market-adjust pattern returns in the offline backtest pipeline
  - Measure IC improvement from market adjustment

Priority 3 (Medium-term, MEDIUM effort):
  - Implement calcKalmanBeta() for time-varying beta
  - Sector covariance approximation
  - Ledoit-Wolf shrinkage in Python batch
  - Confidence adjustment for idiosyncratic risk

Priority 4 (Long-term, HIGH effort):
  - Fama-MacBeth cross-sectional analysis
  - DCC-GARCH for dynamic correlations
  - Full portfolio optimization (if commercialized)
```

---

## Part 8: Summary of Key Formulas

### CAPM

```
E[R_i] = R_f + beta_i * (E[R_m] - R_f)
beta_i = Cov(R_i, R_m) / Var(R_m)
alpha_i = R_i - R_f - beta_i * (R_m - R_f)    [Jensen's Alpha]
```

### Factor Model Covariance

```
Sigma = B * Omega * B' + D
B: N x K factor loadings
Omega: K x K factor covariance
D: N x N diagonal idiosyncratic variance
```

### Ledoit-Wolf Shrinkage

```
Sigma_LW = alpha* * F + (1 - alpha*) * S
alpha* = min(beta_bar / delta_bar, 1)
```

### Kalman Beta

```
K_t = P_t|t-1 * r_m,t / (r_m,t^2 * P_t|t-1 + R)
beta_t = beta_t|t-1 + K_t * (r_i,t - beta_t|t-1 * r_m,t)
P_t = (1 - K_t * r_m,t) * P_t|t-1 + Q
```

### Market-Adjusted Return Regression

```
excess_return_i = R_i - beta_i * R_m
E[excess_return] = alpha_p + delta_conf * conf + delta_trend * trend + ...
```

### Idiosyncratic Confidence Adjustment

```
conf_adj = conf * (1 - lambda_idio * idio_risk_rank)
idio_risk = Var(eps_i) / Var(R_i) = 1 - R^2_factor
```

---

## Part 9: Beta 보정과 IC 형식론

Part 1~8에서 beta 추정의 이론적 기반을 다루었으나, 실전 적용에서 두 가지
핵심 문제가 남는다. 첫째, KRX 시장의 비동기 거래(thin trading)로 인한
**beta 편향(bias)** 문제와 그 보정 방법론. 둘째, 모형 전체의 예측력을
체계적으로 측정하는 **Information Coefficient (IC) 형식론**이다.

이 두 주제는 독립적이지 않다. Beta 보정이 정확할수록 alpha 분리가 깨끗해지고,
깨끗한 alpha는 IC를 개선하며, IC 개선은 Grinold의 기본법칙에 의해 기대 초과
수익으로 직접 연결된다.

### 9.1 Dimson (1979) Beta 보정: 비동기 거래 편향

#### 문제의 본질

비동기 거래(non-synchronous trading)는 소형주에서 특히 심각하다. 하루 중
마지막 체결이 종가에 반영되는 시점이 시장 전체의 종가 산출 시점과 불일치하면,
해당 주식의 일별 수익률은 시장 수익률과의 **공분산이 과소추정**된다.

이는 직관적으로 명확하다: 종목 A의 "오늘 종가"가 실제로는 14:30 마지막 체결
가격이라면, 14:30~15:30의 시장 움직임이 반영되지 않았으므로 beta가 실제보다
낮게 추정된다. KOSDAQ 소형주에서 이 효과가 두드러진다.

#### Dimson (1979) Lead-Lag 회귀

Dimson은 시차를 명시적으로 회귀식에 포함하여 편향을 제거한다:

```
R_{i,t} = alpha + sum_{k=-K}^{K} beta_k * R_{m,t+k} + epsilon_t

여기서:
  R_{i,t}   = 종목 i의 t일 수익률
  R_{m,t+k} = 시장의 (t+k)일 수익률 (lead/lag 포함)
  K         = lead-lag 차수 (통상 K=1~3)

Dimson Beta:
  beta_Dimson = sum_{k=-K}^{K} beta_k
```

핵심 아이디어는 단순하다. "오늘" 종가에 반영되지 못한 시장 영향은 "내일"
수익률에 나타나므로, lead/lag 계수를 모두 합산하면 참(true) beta에 수렴한다.

**차수 선택(K):** K가 너무 크면 추정 효율이 떨어지고 다중공선성이 증가한다.
KRX의 경우 거래 빈도가 극단적으로 낮은 종목이 드물므로 K=1이면 대부분
충분하다. K=2~3은 일평균 거래대금 1억원 미만의 극소형주에만 권장된다.

#### Scholes-Williams와의 관계

compute_capm_beta.py에 이미 구현된 Scholes-Williams (1977) 보정은
Dimson K=1의 **특수 사례**이다:

```
Dimson K=1:
  R_{i,t} = alpha + beta_{-1}*R_{m,t-1} + beta_0*R_{m,t} + beta_{+1}*R_{m,t+1} + eps

  beta_Dimson = beta_{-1} + beta_0 + beta_{+1}

Scholes-Williams K=1 (autocorrelation-adjusted):
  beta_SW = (beta_{-1} + beta_0 + beta_{+1}) / (1 + 2*rho_m)

  rho_m = Corr(R_{m,t}, R_{m,t-1})  [시장 수익률의 1차 자기상관]
```

SW는 분모에 `(1 + 2*rho_m)` 보정을 포함하여 시장 수익률 자체의 자기상관
효과를 제거한다. 이론적으로는 SW가 K=1에서 더 효율적인 추정량이지만,
실증적 차이는 미미하다 (Dimson 1979, Table 3 참조).

**현재 시스템:** compute_capm_beta.py는 thin trading 감지 시(일평균 거래대금
하위 30%) SW 보정을 자동 적용한다. Dimson K>1 확장은 필요 시 추가 가능하나,
현행 SW K=1으로 KRX 대부분의 비동기 편향이 제거된다.

### 9.2 Scholes-Williams (1977) 재논의

#### 수학적 구조

Scholes-Williams (1977)의 정확한 추정량:

```
Step 1: 3개의 개별 회귀 실행
  R_{i,t} = alpha_{-1} + beta_{-1} * R_{m,t-1} + eps_{-1,t}    [lag]
  R_{i,t} = alpha_0    + beta_0    * R_{m,t}   + eps_{0,t}      [contemporaneous]
  R_{i,t} = alpha_{+1} + beta_{+1} * R_{m,t+1} + eps_{+1,t}    [lead]

Step 2: 합산 및 자기상관 보정
  beta_SW = (beta_{-1} + beta_0 + beta_{+1}) / (1 + 2 * rho_m)

  rho_m = (1/T) * sum_t (R_{m,t} - R_m_bar)(R_{m,t-1} - R_m_bar) / Var(R_m)
```

**주의:** Dimson은 단일 다중회귀(multiple regression)로 모든 lead/lag를
동시 추정하는 반면, SW 원논문은 3개의 개별 단순회귀를 실행한 후 합산한다.
이 차이는 유한 표본에서 추정치 차이를 발생시킬 수 있다.

#### compute_capm_beta.py 구현 경로

현재 구현은 SW 방식을 따른다:

```python
# compute_capm_beta.py 에서의 Scholes-Williams 경로 (의사코드)
if thin_trading_detected:
    beta_lag  = OLS(R_i[1:], R_m[:-1]).beta    # lag regression
    beta_con  = OLS(R_i, R_m).beta              # contemporaneous
    beta_lead = OLS(R_i[:-1], R_m[1:]).beta     # lead regression
    rho_m     = autocorr(R_m, lag=1)
    beta_SW   = (beta_lag + beta_con + beta_lead) / (1 + 2 * rho_m)
```

thin trading 감지 기준: 일평균 거래대금 하위 30% (KOSDAQ 기준 약 5억원 미만).
이 임계값은 Dimson (1979) Table 5의 거래빈도별 편향 크기에 기반한다.

#### Dimson vs SW 실용적 비교

| 관점 | Dimson | Scholes-Williams |
|-----|--------|-----------------|
| 차수 | 임의 K (K>1 가능) | K=1 고정 |
| 추정 방식 | 단일 다중회귀 | 3개 개별 회귀 후 합산 |
| 자기상관 보정 | 없음 (합산만) | rho_m으로 명시적 보정 |
| 효율성 (K=1) | 약간 낮음 | 이론적 최적 |
| 확장성 | K 증가로 극단적 비유동 처리 가능 | K=1 한정 |
| 현재 시스템 | 미구현 | compute_capm_beta.py |

**결론:** K=1에서는 SW가 이론적으로 우월하므로 현행 구현이 적절하다.
KOSDAQ 초소형주(시가총액 100억 미만, 일거래량 1,000주 미만)에서 K=2
Dimson 확장을 고려할 수 있으나, 이러한 종목은 투자 가능성(investability)
자체가 의문이므로 우선순위가 낮다.

### 9.3 Blume (1975) 평균회귀 보정

#### Beta의 평균회귀 현상

Blume (1975)의 경험적 발견: 극단적 beta 값은 시간이 지남에 따라 1.0으로
회귀하는 경향이 있다. 이는 두 가지 원인에서 비롯된다:

1. **추정 오차(estimation error):** 고(저) beta 종목 중 일부는 단순히
   양(음)의 추정 오차가 큰 것이며, 다음 기간에는 평균으로 회귀한다.
2. **진정한 경제적 회귀:** 고위험 사업의 수익성이 자본을 유치하면서 경쟁이
   심화되고, 이에 따라 사업 리스크가 점진적으로 하락한다 (Berk, Green &
   Naik 1999).

#### Blume 보정 공식

```
beta_adj = w * beta_hist + (1 - w) * 1.0

여기서:
  beta_hist = 과거 데이터로 추정한 raw beta
  w         = 축소(shrinkage) 가중치
  1.0       = 시장 전체의 평균 beta (정의에 의해)

전통적 Blume 가중치:
  w = 0.67 (Blume 1975 원논문, 7년 rolling 기준)
  → beta_adj = 0.67 * beta_hist + 0.33 * 1.0

Bloomberg 관행:
  w = 2/3, 동일 (Bloomberg Beta = 0.67 * raw + 0.33 * 1.0)

Merrill Lynch (현 BofA):
  w = 0.66 (실질적으로 동일)
```

이 보정은 극단적으로 단순하면서도 out-of-sample 예측력을 일관되게 개선한다.
Beta = 2.0인 종목의 보정 후 값은 0.67*2.0 + 0.33*1.0 = 1.67이 되며,
이는 "다음 기간에도 beta = 2.0일 것"이라는 naive 예측보다 체계적으로
우수하다 (Blume 1975, Table 2).

#### Vasicek (1973) Bayesian 축소

Blume의 고정 가중치(w=0.67)를 **종목별 추정 정밀도에 따라 적응적으로**
조정하는 방법이다:

```
beta_Vasicek = (sigma^2_cs * beta_hist + s^2_i * beta_bar) / (sigma^2_cs + s^2_i)

여기서:
  beta_hist  = 개별 종목의 OLS beta
  beta_bar   = 전체 종목 beta의 cross-sectional 평균 (≈ 1.0)
  sigma^2_cs = cross-sectional variance of betas (전체 분포의 분산)
  s^2_i      = 개별 종목 beta의 추정 표준오차 제곱

직관:
  s^2_i가 크면 (추정이 부정확) → beta_bar 쪽으로 강하게 축소
  s^2_i가 작으면 (추정이 정확) → beta_hist를 거의 그대로 유지
```

Vasicek은 James-Stein (1961) 축소추정의 Bayesian 해석과 동일한 구조이다.
현재 시스템의 backtester.js가 승률에 적용하는 James-Stein 축소
(N0=35, empirical Bayes)와 철학적으로 동일하며, 대상이 다를 뿐이다.

#### KRX 적용 시사점

KOSDAQ 소형주는 beta 추정의 표준오차(s^2_i)가 크다:
- 거래량이 적어 일별 수익률의 잡음이 크고
- 관측 기간(~250일)이 충분히 길지 않으며
- 산업 구조 변화가 빈번하여 true beta 자체가 불안정하다

따라서 KOSDAQ 소형주에서 Blume/Vasicek 보정 효과가 극대화된다.
경험적으로 raw beta 2.5인 KOSDAQ 종목의 Blume-adjusted beta는 ~1.99,
Vasicek-adjusted beta는 (s^2_i가 큰 경우) ~1.5~1.8 수준으로 더 강하게
축소된다.

**구현 계획:** compute_capm_beta.py 출력에 `betaBlume` 필드 추가.
Vasicek은 cross-sectional 통계가 필요하므로 전체 종목 beta 계산 완료 후
2nd pass로 실행한다.

```
# compute_capm_beta.py 출력 확장 (계획)
{
  "betaRaw":    1.85,        # OLS raw beta
  "betaSW":     1.72,        # Scholes-Williams (thin trading 보정)
  "betaBlume":  1.57,        # Blume 0.67*SW + 0.33*1.0
  "betaVasicek": 1.48,       # Vasicek Bayesian (cross-sectional shrinkage)
  "betaUsed":   1.57         # 최종 사용값 (default: Blume)
}
```

### 9.4 Jensen Alpha 통계검정

#### Jensen (1968) Alpha 정의

Jensen Alpha는 CAPM이 예측하는 기대수익률 대비 **실현된 초과수익**이다:

```
alpha_J = R_bar_i - [R_f + beta_i * (R_bar_m - R_f)]

여기서:
  R_bar_i = 종목(또는 포트폴리오) i의 평균 실현 수익률
  R_bar_m = 시장의 평균 실현 수익률
  R_f     = 무위험이자율
  beta_i  = 종목 i의 시장 beta

등가 표현 (회귀 절편):
  R_{i,t} - R_f = alpha_J + beta_i * (R_{m,t} - R_f) + epsilon_t

  alpha_J = 위 회귀의 상수항(intercept)
```

alpha_J > 0이면 CAPM 대비 초과 성과, alpha_J < 0이면 과소 성과.
이는 펀드 매니저 평가에 원래 사용되었으나 (Jensen 1968), 개별 종목의
패턴 신호가 시장 위험 이상의 정보를 담고 있는지 검증하는 데에도 동일하게
적용된다.

#### 통계적 유의성 검정

Alpha가 "0이 아니다"는 주장은 반드시 통계 검정을 동반해야 한다:

```
H0: alpha_J = 0  (CAPM이 완전히 설명)
H1: alpha_J ≠ 0  (초과/과소 성과 존재)

t-statistic:
  t(alpha) = alpha_J / SE(alpha)

  SE(alpha) = sigma_epsilon / sqrt(T)

  여기서:
    sigma_epsilon = 회귀 잔차의 표준편차 = sqrt(SSR / (T - 2))
    T             = 관측치 수 (일별 250, 120-day rolling이면 120)

p-value 해석:
  |t(alpha)| > 1.645  → 10% 수준에서 유의
  |t(alpha)| > 1.960  → 5% 수준에서 유의 (학술 관행)
  |t(alpha)| > 2.576  → 1% 수준에서 유의
```

**주의:** T=250 (1년 일별)에서 alpha = 0.05% (일별)이면 연환산 약 12.5%이지만,
sigma_epsilon = 2.0%일 때 SE = 2.0/sqrt(250) = 0.126%, t = 0.05/0.126 = 0.40
으로 유의하지 않다. 일별 단위에서 alpha의 통계적 유의성 확보는 매우 어렵다.

이는 학술적으로 잘 알려진 문제이다: 높은 일별 변동성(sigma_epsilon)이
alpha 신호를 잡음으로 덮어버린다. 해결책:
1. **표본 크기 확대** — rolling window 대신 전체 기간 사용
2. **Cross-sectional pooling** — 여러 종목의 alpha를 동시 검정 (Fama-MacBeth)
3. **주간/월간 수익률** 사용 — 잡음 감소, 단 T 감소

#### Rolling Window Alpha

시간에 따른 alpha 변화를 추적하기 위해 rolling window 접근:

```
Rolling Alpha (window = 120 trading days):
  alpha_t = 시점 [t-119, t]의 120일 회귀에서 추정된 Jensen alpha

Alpha 시계열의 특성 분석:
  - 평균(alpha): 장기 평균 초과수익
  - 표준편차(alpha): alpha의 안정성 (낮을수록 일관된 성과)
  - Hurst(alpha): calcHurst()로 alpha 시계열의 지속성 측정
    H > 0.5 → alpha가 추세적 (momentum), 지속 가능성 높음
    H < 0.5 → alpha가 반전적 (mean-reverting), 일시적일 가능성
    H ≈ 0.5 → alpha가 랜덤워크, 구조적 원인 불명확
```

Rolling alpha + Hurst exponent의 조합은 "이 종목/패턴의 alpha가 구조적인가,
일시적인가?"를 판단하는 2차 필터로 기능한다. 현재 시스템의 calcHurst()
(indicators.js)가 이미 가격 수준에 적용되고 있으므로, alpha 시계열에도
동일하게 적용 가능하다.

#### 구현 필드

```
compute_capm_beta.py 출력 확장 (계획):
  "alphaJensen":   0.0005,    # 일별 alpha (소수)
  "alphaAnnual":   0.125,     # 연환산 (alpha * 250)
  "alphaTstat":    1.87,      # t-statistic
  "alphaPvalue":   0.062,     # two-sided p-value
  "alphaHurst":    0.58       # rolling alpha 시계열의 Hurst exponent (옵션)
```

### 9.5 IC 형식론 (Information Coefficient Formalism)

#### IC의 정의와 의미

Information Coefficient (IC)는 **예측값과 실현값의 횡단면 상관관계**로,
모형의 예측력을 측정하는 가장 보편적인 단일 지표이다.

```
IC = Corr(f_i, r_i)    for i = 1, ..., N

여기서:
  f_i = 종목 i에 대한 모형의 예측 수익률 (또는 점수/순위)
  r_i = 종목 i의 실현 수익률
  N   = 횡단면 종목 수

실무적으로는 Spearman rank correlation이 선호됨:
  IC_rank = RankCorr(f_i, r_i)

이유: rank 기반이면 극단값(outlier)에 강건하고, 예측값의 절대 수준이 아닌
      상대 순서(relative ordering)만 정확하면 높은 IC를 달성한다.
```

IC = 0.05는 "예측 순위와 실현 순위의 상관이 0.05"라는 의미이다.
직관적으로 매우 낮아 보이지만, 2,700개 종목의 횡단면에서 IC = 0.05는
통계적으로 고도로 유의하며, 경제적으로도 큰 가치를 갖는다.

#### IC의 통계검정

IC가 0과 유의하게 다른지 검정:

```
H0: IC = 0  (모형에 예측력 없음)
H1: IC ≠ 0  (예측력 존재)

t-statistic:
  t(IC) = IC * sqrt(N - 2) / sqrt(1 - IC^2)

  여기서 N = 횡단면 종목 수

예시 (현재 시스템):
  IC = 0.0998, N = 2700
  t(IC) = 0.0998 * sqrt(2698) / sqrt(1 - 0.0998^2)
        = 0.0998 * 51.94 / 0.9950
        = 5.21

  → |t| = 5.21 >> 2.576 → p < 0.001 → 고도로 유의
```

IC = 0.0998이 "낮아 보임에도 불구하고" t = 5.21인 이유는 횡단면의 breadth
(N = 2,700)가 극도로 크기 때문이다. 이것이 바로 Grinold의 기본법칙에서
Breadth가 핵심인 이유이다.

#### IC Decay: 예측 수명

IC는 예측 시점(forecast date)으로부터 실현 시점(realization date)까지의
시간 간격(horizon k)에 따라 감소한다:

```
IC(k) = Corr(f_{i,t}, r_{i,t+k})    for k = 1, 2, 3, ... days

전형적 decay 패턴:
  IC(1) = 0.10   ← 1일 후 실현
  IC(5) = 0.07   ← 5일 후 실현
  IC(10) = 0.04  ← 10일 후 실현
  IC(20) = 0.02  ← 20일 후 실현

IC decay 속도는 signal의 성격에 따라 다름:
  - Momentum 신호: slow decay (IC(10)/IC(1) > 0.5)
  - Mean-reversion 신호: fast decay (IC(10)/IC(1) < 0.3)
  - Flow/liquidity 신호: medium decay
```

**최적 예측 수명(optimal k)**: IC(k) * sqrt(250/k) (연환산 IR 기여도)를
최대화하는 k가 이론적 최적 보유기간이다. 이는 IC 자체는 감소하지만
리밸런싱 빈도(=sqrt(250/k) scaling)의 효과와 trade-off 되기 때문이다.

현재 시스템은 패턴별로 N-day return (N=1,3,5,10,20)을 추적하고 있으므로
(backtester.js), IC(k) decay curve를 구축할 데이터가 이미 존재한다.

#### Grinold (1989) 기본법칙: IC → IR → Alpha

Richard Grinold의 **Fundamental Law of Active Management**는 IC를
포트폴리오 성과로 변환하는 공식이다:

```
IR = IC * sqrt(BR)

여기서:
  IR = Information Ratio (초과수익/추적오차)
  IC = Information Coefficient (예측-실현 상관)
  BR = Breadth (연간 독립적 예측 횟수)

확장된 형태 (Grinold & Kahn 2000):
  IR = IC * sqrt(BR) * TC

  TC = Transfer Coefficient (예측 → 실행 전환 효율, 0~1)
  TC = 1이면 제약 없는 완전 전환
  TC < 1이면 거래비용, 포지션 제약, 유동성 한계 등으로 손실
```

**현재 시스템에의 적용:**

```
Given:
  IC  = 0.0998 (17-col Ridge, Phase 4-1 calibration)
  BR  ≈ 2700 (KOSPI+KOSDAQ 전 종목, 매일 횡단면 예측)
  TC  ≈ 0.7 (추정: 거래비용 0.21% one-way + 유동성 제약)

Fundamental Law:
  IR_raw = 0.0998 * sqrt(2700) = 0.0998 * 51.96 = 5.19
  IR_adj = 5.19 * 0.7 = 3.63

해석:
  연간 Information Ratio ≈ 3.6은 극도로 높은 수치이다.
  (IR > 0.5 = good, IR > 1.0 = exceptional in practice)

  단, 이는 BR = 2700이 모두 "독립적" 예측이라는 강한 가정에 의존한다.
  실제로는 종목 간 상관관계로 인해 유효 BR << 2700이다.
```

**유효 Breadth 보정:**

Grinold-Kahn의 BR은 **독립적** 예측 횟수이다. KOSPI+KOSDAQ 2,700개 종목은
서로 높은 상관을 보이므로 (같은 산업, 같은 테마, 같은 시장 베타), 유효
독립 예측 수는 크게 줄어든다.

```
유효 Breadth 추정:
  BR_eff = N / avg_rho_bar

  avg_rho_bar = 평균 종목간 상관 (KRX 경험적 ≈ 0.25~0.40)

  N = 2700, rho_bar = 0.30 가정:
  BR_eff ≈ 2700 / (1 + (2700-1)*0.30) ≈ 2700 / 810.7 ≈ 3.33

  수정된 IR:
  IR_adj = 0.0998 * sqrt(3.33) * 0.7 = 0.0998 * 1.825 * 0.7 = 0.127

  → 이것이 보다 현실적인 추정이다.
     IR ≈ 0.13 → 연간 초과수익 ≈ 0.13 * tracking_error
     TE ≈ 15% 가정 → alpha ≈ 1.9% p.a.
```

#### IC 증분 가치 (Incremental IC Value)

IC의 한계 가치를 정량화하면 연구 자원 배분의 근거가 된다:

```
dIR/dIC = sqrt(BR_eff) * TC

BR_eff = 3.33, TC = 0.7:
  dIR/dIC = 1.825 * 0.7 = 1.28

IC가 0.01 개선될 때:
  delta_IR = 0.01 * 1.28 = 0.0128
  delta_alpha = 0.0128 * 15% (TE) = 0.19% p.a.

IC 0.0998 → 0.11 개선 시:
  delta_alpha = 0.0102 * 1.28 * 15% ≈ 0.20% p.a.
```

이는 IC 개선의 경제적 가치가 **선형적**임을 의미한다. IC를 0.01 올리는
것이 어디에서 왔든 (새 feature, 더 나은 모형, noise 제거) 동일한 가치를
갖는다. 현재 MRA 파이프라인의 feature expansion (17-col → 24-col)이
IC 0.0998에서 더 높은 값을 달성한다면, 그 증분은 위 공식으로 직접
경제적 가치로 환산된다.

#### 기존 시스템과의 연결

IC 측정은 이미 시스템의 여러 지점에서 수행되고 있다:

```
backtester.js:
  - Ridge 회귀의 cross-validation에서 암묵적 IC 최적화
  - R^2 = IC^2 (단순 회귀에서의 관계, 다중 회귀에서는 근사)

rl_residuals.py (offline):
  - 17/24-col Ridge의 out-of-sample IC 명시적 측정
  - IC = 0.0998 (17-col), IC = 0.101 (18-col, HAR-RV 추가)
  - IC decay는 미측정 → 구현 필요

signalEngine.js:
  - 16 indicator signals의 개별 IC는 미측정
  - Composite signal IC 역시 미측정
  - Cross-sectional IC 측정은 Python offline에서만 가능
    (브라우저 내에서는 단일 종목의 time-series IC만 가능)
```

#### IC → IR → Expected Alpha → 포트폴리오 구성 연쇄

전체 흐름을 정리하면:

```
[1] Signal Generation
    patternEngine + signalEngine + Ridge regression
    → f_i (종목별 예측 점수)

[2] IC Measurement
    IC = RankCorr(f_i, r_i) across N stocks
    → IC ≈ 0.10

[3] IR Estimation (Fundamental Law)
    IR = IC * sqrt(BR_eff) * TC
    → IR ≈ 0.13

[4] Expected Alpha
    E[alpha] = IR * sigma_tracking
    → alpha ≈ 1.9% p.a. (TE=15% 가정)

[5] Optimal Portfolio Weights (Grinold & Kahn 2000)
    w_i* = (lambda^{-1}) * Sigma^{-1} * alpha_i
    → IC가 높은 종목에 overweight, 낮은 종목에 underweight

[6] Risk-Adjusted Performance
    Sharpe = (R_p - R_f) / sigma_p
    IR = (R_p - R_b) / TE
```

현재 CheeseStock은 [1]~[3]이 부분적으로 구현되어 있고, [4]~[6]은
미래 상용화(commercialization) 단계에서의 과제이다. 그러나 [1]~[3]의
IC 측정 인프라가 견고하면, [4]~[6]으로의 확장은 수학적으로 직접적이다.

---

## References

- Sharpe, W. (1964). "Capital Asset Prices." *Journal of Finance*, 19(3).
- Lintner, J. (1965). "Security Prices, Risk, and Maximal Gains from Diversification." *Journal of Finance*, 20(4).
- Ross, S. (1976). "The Arbitrage Theory of Capital Asset Pricing." *Journal of Economic Theory*, 13(3).
- Fama, E. & French, K. (1993). "Common Risk Factors in the Returns on Stocks and Bonds." *JFE*.
- Fama, E. & French, K. (2015). "A Five-Factor Asset Pricing Model." *JFE*, 116(1).
- Fama, E. & MacBeth, J. (1973). "Risk, Return, and Equilibrium." *JPE*, 81(3).
- Engle, R. (2002). "Dynamic Conditional Correlation." *Journal of Business & Economic Statistics*, 20(3).
- Ledoit, O. & Wolf, M. (2004). "A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices." *JMVA*, 88(2).
- Marchenko, V. & Pastur, L. (1967). "Distribution of Eigenvalues for Some Sets of Random Matrices." *Math. Sbornik*, 72(4).
- Laloux, L. et al. (1999). "Noise Dressing of Financial Correlation Matrices." *PRL*, 83(7).
- James, W. & Stein, C. (1961). "Estimation with Quadratic Loss." *Fourth Berkeley Symposium*, 1.
- Hoerl, A. & Kennard, R. (1970). "Ridge Regression." *Technometrics*, 12(1).
- Golub, G., Heath, M. & Wahba, G. (1979). "GCV as a Method for Choosing a Good Ridge Parameter." *Technometrics*, 21(2).
- Wells, C. (1996). *The Kalman Filter in Finance*. Kluwer Academic.
- Efron, B. & Morris, C. (1975). "Data Analysis Using Stein's Estimator." *JASA*, 70(350).
- Forbes, K. & Rigobon, R. (2002). "No Contagion, Only Interdependence." *Journal of Finance*, 57(5).
- Lo, A. (2004). "The Adaptive Markets Hypothesis." *JPM*, 30(5).
- RiskMetrics (1996). *Technical Document*, 4th ed. J.P. Morgan/Reuters.
- Damodaran, A. (annual). "Equity Risk Premiums." NYU Stern working paper.
- Dimson, E. (1979). "Risk Measurement when Shares are Subject to Infrequent Trading." *Journal of Financial Economics*, 7(2).
- Scholes, M. & Williams, J. (1977). "Estimating Betas from Nonsynchronous Data." *Journal of Financial Economics*, 5(3).
- Blume, M.E. (1975). "Betas and Their Regression Tendencies." *Journal of Finance*, 30(3).
- Vasicek, O.A. (1973). "A Note on Using Cross-Sectional Information in Bayesian Estimation of Security Betas." *Journal of Finance*, 28(5).
- Jensen, M.C. (1968). "The Performance of Mutual Funds in the Period 1945-1964." *Journal of Finance*, 23(2).
- Grinold, R.C. (1989). "The Fundamental Law of Active Management." *Journal of Portfolio Management*, 15(3).
- Grinold, R.C. & Kahn, R.N. (2000). *Active Portfolio Management*, 2nd ed. McGraw-Hill.

---

```
코드 매핑:
  indicators.js:128-158  (calcKalman — scalar, price-level)
  indicators.js:267-380  (calcWLSRegression + HC3 — the delta estimator)
  indicators.js:594+     (_invertMatrix — Gauss-Jordan)
  backtester.js:860-940  (Phase A OLS + Phase C WLS design matrix)
  backtester.js:195-240  (_buildRLContext — EWMA vol, market_type)
  backtester.js:922-923  (GCV Ridge lambda selection)
  api.js:222-245         (index.json loader — has sector, marketCap)

  핵심 학술 상수 신규:
  #51 delta_conf     [B][L:WLS] range [-0.1, +0.3]
  #52 delta_trend    [B][L:WLS] range [-0.2, +0.2]
  #53 delta_lnVol    [B][L:WLS] range [-0.1, +0.1]
  #54 delta_atr      [C][L:WLS] range [-0.3, +0.3]
  #55 delta_market   [B][L:WLS/Kalman] range [0.0, 3.0]
  #56 delta_momentum [B][L:WLS] range [-0.1, +0.1]
```
