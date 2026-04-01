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
