# S2 Theoretical Basis -- Sections 2.3-2.4: Finance Theory & Behavioral Finance

> ANATOMY V5 -- CheeseStock Theoretical Foundations
> Author: financial-theory-expert
> Date: 2026-04-06
> Scope: Academic finance theory and behavioral finance underpinning CheeseStock's
> pattern analysis, factor models, valuation pipeline, and confidence adjustments.

---

## 2.3 Finance Theory

This section documents the canonical finance theories that CheeseStock relies upon
for asset pricing, risk decomposition, factor modeling, valuation, and corporate
finance. Every formula follows CFA Paper Grade annotation: all symbols are defined
in a table, all constants carry an evidence grade [A-E], and every implementation
pointer is cross-referenced to the specific JS/Python file and line range.

---

### 2.3.1 Efficient Market Hypothesis (EMH)

**Citation:** Fama, E. F. (1970). "Efficient Capital Markets: A Review of Theory
and Empirical Work." *Journal of Finance*, 25(2), 383-417.

#### Three Forms

```
Weak Form:
  P_t = E[P_{t+1} | Phi_t] / (1 + r)
  Phi_t = all historical price and volume data
  Implication: technical analysis cannot generate alpha

Semi-Strong Form:
  Phi_t = all publicly available information (prices + fundamentals + news)
  Implication: neither technical nor fundamental analysis generates alpha

Strong Form:
  Phi_t = all information including insider knowledge
  Implication: no analysis of any kind generates alpha
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| P_t | Asset price at time t | KRW | (0, inf) | OHLCV close |
| Phi_t | Information set at time t | -- | -- | Theoretical construct |
| r | Required rate of return | decimal | [0, 0.30] | CAPM or factor model |
| E[.] | Conditional expectation operator | -- | -- | Probability theory |

#### Counter-evidence and CheeseStock's Position

| Study | Finding | EMH Form Challenged |
|-------|---------|-------------------|
| Lo & MacKinlay (1988) | Positive weekly return autocorrelation | Weak |
| Brock, Lakonishok & LeBaron (1992) | MA/S&R strategies earn significant returns | Weak |
| Lo, Mamaysky & Wang (2000) | Automated pattern recognition finds statistically significant information | Weak |
| Jegadeesh & Titman (1993) | 3-12 month momentum profits | Semi-Strong |
| DeBondt & Thaler (1985) | 3-5 year reversal in extreme winners/losers | Semi-Strong |

**CheeseStock stance:** The system does not assume markets are efficient or
inefficient. Instead, it implements adaptive efficiency measurement (Hurst exponent,
rolling autocorrelation) and adjusts confidence dynamically.

**Code reference:** `indicators.js:calcHurst()` provides rolling H estimation.
H > 0.5 implies trend persistence (efficiency departure); H = 0.5 is random walk
(weak-form efficiency consistent).

---

### 2.3.2 Adaptive Markets Hypothesis (AMH)

**Citation:** Lo, A. W. (2004). "The Adaptive Markets Hypothesis: Market Efficiency
from an Evolutionary Perspective." *Journal of Portfolio Management*, 30(5), 15-29.

#### Core Proposition

```
Market efficiency is not a fixed state but a dynamic process
that varies with:
  1. Competition intensity among market participants
  2. Magnitude of profit opportunities
  3. Adaptability of participants to changing environments
  4. Degree of structural/regulatory change

Efficiency_t = f(Competition_t, Information_t, Technology_t) in [0, 1]
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| Efficiency_t | Market efficiency level at time t | dimensionless | [0, 1] | Rolling ACF, Hurst |
| rho_t | Rolling autocorrelation coefficient | dimensionless | [-1, 1] | calcHurst() / rolling ACF |

#### Testable Predictions

| AMH Prediction | Measurement Method | CheeseStock Implementation |
|---------------|-------------------|---------------------------|
| Time-varying autocorrelation | Rolling rho_1 over 60d window | `calcHurst()` in `indicators.js` |
| Strategy lifecycle decay | Half-life estimation | `backtester.js` WLS lambda=0.995 decay |
| Regime-dependent pattern validity | HMM state classification | `appWorker.js` 4-regime RORO model |

**Key implication for CheeseStock:** Pattern confidence should be regime-conditional.
The WLS exponential decay weighting (lambda=0.995) implements this by down-weighting
older pattern observations, reflecting AMH's prediction that pattern effectiveness
changes over time.

**Code reference:**
- `indicators.js:calcHurst()` -- rolling H exponent for efficiency measurement
- `backtester.js` WLS lambda=0.995 -- exponential decay for regime adaptation
- `appWorker.js:_applyRORORegimeToPatterns()` -- 4-regime (Risk-On/Risk-Off) adjustment

---

### 2.3.3 Modern Portfolio Theory (MPT)

**Citation:** Markowitz, H. (1952). "Portfolio Selection." *Journal of Finance*,
7(1), 77-91. (Nobel Prize in Economics, 1990)

#### Mean-Variance Optimization

```
Portfolio expected return:
  E[R_p] = SUM_i  w_i * E[R_i]

Portfolio variance:
  sigma_p^2 = SUM_i SUM_j  w_i * w_j * sigma_ij

Optimization problem:
  min  sigma_p^2
  s.t. E[R_p] = R*          (target return)
       SUM_i w_i = 1         (budget constraint)
       w_i >= 0              (no short-selling, KRX constraint)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| w_i | Weight of asset i in portfolio | decimal | [0, 1] | Optimization output |
| E[R_i] | Expected return of asset i | decimal per annum | [-1, +inf) | Factor model / historical |
| sigma_ij | Covariance of returns between assets i and j | decimal^2 | (-inf, +inf) | Sample or shrinkage estimator |
| sigma_p^2 | Portfolio variance | decimal^2 | [0, +inf) | Computed |
| R* | Target portfolio return | decimal per annum | domain of efficient frontier | User-specified |

#### Dimensionality Problem and Sharpe's Simplification

The N-asset full covariance matrix requires N(N+3)/2 parameters:

```
N = 2,700 (KRX full universe):
  Full covariance: 3,646,350 parameters
  Single-Index Model (Sharpe 1963): 3N + 2 = 8,102 parameters
  Reduction: 99.78%
```

**Code reference:** The single-index model underpins `compute_capm_beta.py`,
which estimates alpha_i and beta_i for each of ~2,700 KRX stocks via OLS regression
against the market index.

---

### 2.3.4 Capital Asset Pricing Model (CAPM)

**Citation:**
- Sharpe, W. F. (1964). "Capital Asset Prices: A Theory of Market Equilibrium
  under Conditions of Risk." *Journal of Finance*, 19(3), 425-442.
- Lintner, J. (1965). "The Valuation of Risk Assets and the Selection of
  Risky Investments in Stock Portfolios and Capital Budgets." *Review of Economics
  and Statistics*, 47(1), 13-37.

(Both: Nobel Prize in Economics, 1990)

#### CAPM Formula

```
E[R_i] = R_f + beta_i * (E[R_m] - R_f)

beta_i = Cov(R_i, R_m) / Var(R_m)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| E[R_i] | Expected return of asset i | decimal p.a. | (-inf, +inf) | Model output |
| R_f | Risk-free rate | decimal p.a. | [0, 0.10] | KTB 10Y: `bonds_latest.json` |
| beta_i | Systematic risk sensitivity (market beta) | dimensionless | (-inf, +inf), typical [0, 3] | OLS regression |
| E[R_m] | Expected return on market portfolio | decimal p.a. | [0, 0.30] | KOSPI index |
| Cov(R_i, R_m) | Covariance of asset i with market | decimal^2 | (-inf, +inf) | Daily returns |
| Var(R_m) | Variance of market returns | decimal^2 | (0, +inf) | Daily returns |

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| R_f (Korea, 2026) | ~3.0-3.5% p.a. | [A] | KTB 10Y from BOK/KOFIA; observable market rate |
| ERP (Korea) | 5.5-7.0% p.a. | [B] | Damodaran annual estimate + KCMI 2000-2020 range |
| KRX_TRADING_DAYS | 250 | [A] | KRX official ~250 trading days/year |
| MIN_OBS for beta | 60 | [B] | 3-month minimum; aligned with compute_capm_beta.py |

#### Beta Interpretation

| Beta Range | Classification | KRX Example |
|-----------|---------------|-------------|
| beta < 0 | Inverse market | Gold ETF, inverse ETF |
| 0 < beta < 0.8 | Defensive | Utilities, telecoms |
| 0.8 < beta < 1.2 | Neutral | Diversified large caps |
| beta > 1.2 | Aggressive | Tech, biotech, small caps |

**KRX empirical beta distribution (2,628 stocks, 2026-03-30):**

```
KOSPI: mean=0.75, median=0.68, std=0.48
KOSDAQ: mean=0.83, median=0.77, std=0.55
```

#### Beta Estimation Methods (as implemented)

**Method 1 -- Full-sample OLS (primary):**

```
beta_i = Cov(r_i, r_m) / Var(r_m)
alpha_i = mean(r_i) - beta_i * mean(r_m)
```

**Code:** `indicators.js:calcCAPMBeta()` lines 391-478.

**Method 2 -- Scholes-Williams (1977) thin-trading correction:**

When zero-volume days exceed 10% of observations:

```
beta_SW = (beta_{-1} + beta_0 + beta_{+1}) / (1 + 2 * rho_m)

beta_{-1} = Cov(r_{i,t}, r_{m,t-1}) / Var(r_m)   (lag beta)
beta_0    = standard OLS beta                       (contemporaneous)
beta_{+1} = Cov(r_{i,t}, r_{m,t+1}) / Var(r_m)    (lead beta)
rho_m     = autocorrelation of market returns
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| beta_{-1} | Lag beta | dimensionless | (-inf, +inf) | OLS on lagged market |
| beta_{+1} | Lead beta | dimensionless | (-inf, +inf) | OLS on lead market |
| rho_m | Market return first-order autocorrelation | dimensionless | [-1, 1] | Sample ACF |

**Citation:** Scholes, M. & Williams, J. (1977). "Estimating Betas from
Nonsynchronous Data." *Journal of Financial Economics*, 5(3), 309-327.

**Code:** `indicators.js:calcCAPMBeta()` lines 433-458. Trigger: `thinTrading = (zeroVolDays / T) > 0.10`.

**Method 3 -- Blume (1975) shrinkage toward the grand mean:**

```
beta_Blume = 0.343 + 0.677 * beta_OLS
```

**Citation:** Blume, M. E. (1975). "Betas and Their Regression Tendencies."
*Journal of Finance*, 30(3), 785-795.

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Blume intercept | 0.343 | [B] | Blume (1975) empirical; implies grand mean beta = 1.06 |
| Blume slope | 0.677 | [B] | Blume (1975) empirical; shrinkage factor |

**Code:** `compute_capm_beta.py` computes `betaBlume` offline. Displayed via
`financials.js:_renderBlumeBetaAlpha()` lines 221-273.

#### Jensen's Alpha

**Citation:** Jensen, M. C. (1968). "The Performance of Mutual Funds in the
Period 1945-1964." *Journal of Finance*, 23(2), 389-416.

```
alpha_j = R_j - [R_f + beta_j * (R_m - R_f)]

Annualized: alpha_annual = alpha_daily * KRX_TRADING_DAYS
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| alpha_j | Jensen's alpha for asset j | decimal p.a. | (-inf, +inf) | Regression intercept |
| R_j | Realized return of asset j | decimal | -- | OHLCV |
| R_f | Risk-free rate (daily) | decimal | ~0.013% per day | KTB 10Y / 250 |

**Code:** `indicators.js:calcCAPMBeta()` line 473: `alphaFinal * KRX_TRADING_DAYS`.
Uses Scholes-Williams corrected beta when thin-trading is detected, ensuring alpha
is consistent with the corrected beta. The excess-return formulation (`r_i - rfDaily`,
`r_m - rfDaily`) on lines 408-409 ensures R_f is properly subtracted from both
stock and market returns before regression.

**Significance testing:** `compute_capm_beta.py` produces `alphaTstat` (t-statistic
of the regression intercept). Displayed in `financials.js:_renderBlumeBetaAlpha()`.

#### Capital Market Line (CML) and Security Market Line (SML)

```
CML: E[R_p] = R_f + [(E[R_m] - R_f) / sigma_m] * sigma_p
  (Efficient portfolios only; x-axis = total risk sigma)

SML: E[R_i] = R_f + beta_i * (E[R_m] - R_f)
  (All assets; x-axis = systematic risk beta)
  SML is the geometric representation of CAPM.

Alpha interpretation:
  Above SML: alpha > 0 --> undervalued (buy candidate)
  Below SML: alpha < 0 --> overvalued (sell candidate)
```

**Citation:** Tobin, J. (1958). "Liquidity Preference as Behavior Towards Risk."
*Review of Economic Studies*, 25(2), 65-86. (Nobel Prize, 1981)

#### Separation Theorem

```
Two-Fund Separation (Tobin 1958):
  Step 1 (Investment decision): Determine optimal risky portfolio M
          --> identical for all investors (market portfolio)
  Step 2 (Financing decision): Allocate between R_f and M
          --> varies by individual risk aversion

Implication: All investors hold the same risky portfolio.
Limitation: Homogeneous expectations violated in practice.
```

#### Zero-Beta CAPM

**Citation:** Black, F. (1972). "Capital Market Equilibrium with Restricted
Borrowing." *Journal of Business*, 45(3), 444-455.

```
E[R_i] = E[R_z] + beta_i * (E[R_m] - E[R_z])

E[R_z] = expected return on the zero-beta portfolio
         (portfolio with Cov(R_z, R_m) = 0)
E[R_z] > R_f  (zero-beta portfolio bears idiosyncratic risk)
```

**KRX relevance:** Korea's repeated short-selling bans (2008, 2011, 2020, 2023-2025,
cumulative ~5.5 years since 2008) violate the standard CAPM's free borrowing/lending
assumption, making Zero-Beta CAPM the more appropriate equilibrium model for KRX.

**Empirical evidence:** Fama & MacBeth (1973) cross-sectional regression on US data
found gamma_0 > R_f and gamma_1 < ERP, consistent with Zero-Beta CAPM. Frazzini &
Pedersen (2014) "Betting Against Beta" strategy exploits the resulting low-volatility
anomaly.

---

### 2.3.5 Arbitrage Pricing Theory (APT)

**Citation:** Ross, S. A. (1976). "The Arbitrage Theory of Capital Asset Pricing."
*Journal of Economic Theory*, 13(3), 341-360.

#### Model Specification

```
E[R_i] - R_f = b_{i,1}*lambda_1 + b_{i,2}*lambda_2 + ... + b_{i,K}*lambda_K

Factor model (return generating process):
  R_i = E[R_i] + b_{i,1}*F_1 + b_{i,2}*F_2 + ... + b_{i,K}*F_K + epsilon_i

No-arbitrage condition:
  If a portfolio has zero cost, zero systematic risk, then E[return] = 0
  --> Factor risk premiums lambda_k are uniquely determined
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| b_{i,k} | Factor loading (sensitivity) of asset i to factor k | dimensionless | (-inf, +inf) | Time-series regression |
| lambda_k | Risk premium for factor k | decimal p.a. | (-inf, +inf) | Cross-sectional regression |
| F_k | Factor k innovation (unexpected realization) | decimal | (-inf, +inf) | Factor-mimicking portfolio |
| epsilon_i | Idiosyncratic return | decimal | E[eps]=0, Var(eps)=sigma_eps^2 | Regression residual |

#### CAPM vs APT

| Property | CAPM | APT |
|----------|------|-----|
| Number of factors | 1 (market) | K (unspecified) |
| Derivation | Equilibrium (utility maximization) | No-arbitrage |
| Requires market portfolio | Yes | No |
| Factor identity specified | Yes (market return) | No (empirical) |
| Distributional assumption | Normal returns (via mean-variance) | Approximate (asymptotic, large N) |
| Relationship | APT with K=1, factor=market collapses to CAPM | APT is more general |

#### ICAPM: The Theoretical Bridge

**Citation:** Merton, R. C. (1973). "An Intertemporal Capital Asset Pricing Model."
*Econometrica*, 41(5), 867-887. (Nobel Prize, 1997)

```
E[R_i] - R_f = beta_{i,M} * (E[R_M] - R_f) + SUM_k beta_{i,k} * lambda_k

beta_{i,k} = Cov(R_i, Delta_s_k) / Var(Delta_s_k)
  --> "hedging beta" for state variable k

State variables: macro factors that predict changes in the investment
opportunity set (interest rates, volatility, consumption growth, etc.)
```

**ICAPM's role in CheeseStock:**

ICAPM provides the economic justification for why multiple factors (beyond market
beta) should enter the pricing equation. The MRA pipeline's 17-column Ridge
regression is a *de facto* ICAPM implementation:

| MRA Column | ICAPM State Variable Proxy | Economic Intuition |
|-----------|---------------------------|-------------------|
| beta_60d | Market portfolio beta | Systematic risk exposure |
| momentum_60d | Market trend persistence | Recent performance predicts future opportunities |
| value_inv_pbr | Discount rate sensitivity | Value stocks more sensitive to rate changes |
| log_size | Business cycle sensitivity | Small caps more vulnerable in downturns |
| liquidity_20d | Liquidity state | Illiquid assets suffer more in liquidity crises |

**Phase 4-1 validation (297K samples):** All 5 APT factors significant at p<0.001.
Walk-forward IC: 0.0998 (17-col) vs 0.0567 (12-col), delta +0.0430.

---

### 2.3.6 Fama-French Factor Models

**Citation:** Fama, E. F. & French, K. R. (1993). "Common Risk Factors in the
Returns on Stocks and Bonds." *Journal of Financial Economics*, 33(1), 3-56.

#### 3-Factor Model

```
E[R_i] - R_f = beta_i*(R_m - R_f) + s_i*SMB + h_i*HML
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| SMB | Small Minus Big (size factor) | decimal | (-inf, +inf) | Cap-sorted L/S portfolio |
| HML | High Minus Low (value factor) | decimal | (-inf, +inf) | BM-sorted L/S portfolio |
| beta_i | Market factor loading | dimensionless | typical [0, 2] | Time-series regression |
| s_i | Size factor loading | dimensionless | typical [-1, 1] | Time-series regression |
| h_i | Value factor loading | dimensionless | typical [-1, 1] | Time-series regression |

#### 5-Factor Model (Fama-French 2015)

```
E[R_i] - R_f = beta_i*(R_m - R_f) + s_i*SMB + h_i*HML + r_i*RMW + c_i*CMA

RMW = Robust Minus Weak (profitability factor)
CMA = Conservative Minus Aggressive (investment factor)
```

#### KRX Factor Construction

**Code:** `scripts/ff3_factors.py` constructs KRX-specific FF3 factors using:

```
SMB: Market-cap sorted (KOSPI + KOSDAQ combined)
  Small = bottom 50% by market cap
  Big = top 50% by market cap
  SMB = mean(Small returns) - mean(Big returns)

HML: Book-to-market sorted
  High = top 30% by B/M (data/financials/{code}.json for equity book value)
  Low = bottom 30% by B/M
  HML = mean(High returns) - mean(Low returns)

Data: data/macro/ff3_factors.json
  Keys: dates[], MKT_RF[], SMB[], HML[], rf_daily
```

**Code reference:** `financials.js:_renderFF3Factors()` lines 295-359 performs
in-browser FF3 regression via `calcWLSRegression()` with uniform weights:

```javascript
// [FIX] FF3 regression: dependent variable is excess return (Ri - Rf)
var rfDaily = _ff3FactorData.rf_daily || 0;
var ri = (stockCandles[si].close - prev) / prev - rfDaily;
```

This correctly implements the academic FF3 regression by subtracting the risk-free
rate from stock returns before regressing on the three factors.

#### Carhart 4-Factor (Momentum)

**Citation:** Carhart, M. M. (1997). "On Persistence in Mutual Fund Performance."
*Journal of Finance*, 52(1), 57-82.

```
+ u_i * UMD

UMD = Up Minus Down (momentum factor)
    = winners (top 30% by 12-1 month return) - losers (bottom 30%)
```

**CheeseStock connection:** Technical analysis trend-following strategies can be
interpreted as exposure to the momentum factor. This creates a theoretical link
between pattern-based signals and factor risk premia.

---

### 2.3.7 Black-Scholes-Merton Option Pricing

**Citation:**
- Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate
  Liabilities." *Journal of Political Economy*, 81(3), 637-654.
- Merton, R. C. (1973). "Theory of Rational Option Pricing." *Bell Journal of
  Economics and Management Science*, 4(1), 141-183.

(Nobel Prize in Economics, 1997)

#### BSM Formula

```
Call: C = S*N(d_1) - K*e^(-rT)*N(d_2)
Put:  P = K*e^(-rT)*N(-d_2) - S*N(-d_1)

d_1 = [ln(S/K) + (r + sigma^2/2)*T] / (sigma*sqrt(T))
d_2 = d_1 - sigma*sqrt(T)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| S | Current underlying price | KRW | (0, +inf) | Market price |
| K | Strike price | KRW | (0, +inf) | Option contract |
| r | Risk-free rate (continuous) | decimal p.a. | [0, 0.10] | KTB 3Y |
| T | Time to expiration | years | (0, +inf) | Option contract |
| sigma | Volatility (implied or historical) | decimal p.a. | (0, +inf) | BSM inversion or HV |
| N(.) | Standard normal CDF | dimensionless | [0, 1] | Tabulated |

#### Implied Volatility and CheeseStock

```
Implied Volatility (IV): the sigma that makes BSM price = market price
  (found by numerical inversion, typically Newton-Raphson)

VKOSPI: KOSPI 200 option 30-day implied volatility
  --> Korean equivalent of VIX

Volatility Risk Premium (VRP):
  VRP = IV^2 - RV^2
  (IV = implied variance, RV = realized variance)
```

**Code reference:**
- `data/vkospi.json` -- VKOSPI time series
- `appWorker.js` -- VKOSPI injected into `_macroLatest.vkospi` for vol-regime classification
- `compute_options_analytics.py` -- straddle implied move calculation using BSM

**Connection to confidence adjustment:** VKOSPI serves as an ICAPM state variable
(volatility). When VKOSPI spikes, `_applyMacroConfidenceToPatterns()` applies
dampening to pattern confidence, reflecting the increased uncertainty.

---

### 2.3.8 Corporate Finance: WACC, Gordon Growth, and EVA

#### WACC (Weighted Average Cost of Capital)

```
WACC = (E/(E+D)) * R_e + (D/(E+D)) * R_d * (1 - T)

R_e = R_f + beta * (E[R_m] - R_f)    (CAPM)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| E | Market value of equity | KRW | (0, +inf) | Market cap from index.json |
| D | Market value of debt | KRW | (0, +inf) | DART financials (book value proxy) |
| R_e | Cost of equity | decimal p.a. | [0, 0.30] | CAPM output |
| R_d | Cost of debt | decimal p.a. | [0, 0.15] | Interest expense / interest-bearing debt |
| T | Corporate tax rate (Korea) | decimal | ~0.22-0.25 | Statutory rate |

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Korean statutory corporate tax rate | 22-25% | [A] | Korean tax law; varies by bracket |
| ERP for R_e | 6.0% | [B] | KCMI/Damodaran consensus for Korea |
| R_f for WACC | KTB 3Y rate | [A] | Observable; updated from bonds_latest.json |

**Code reference:** `compute_eva.py` computes WACC for each stock using CAPM-derived
R_e and DART financial statement data for D, R_d, and T.

#### Gordon Growth Model (Terminal Value)

**Citation:** Gordon, M. J. (1962). *The Investment, Financing, and Valuation of
the Corporation*. Richard D. Irwin.

```
Basic DDM:
  V_0 = D_1 / (r - g) = D_0 * (1 + g) / (r - g)

Terminal Value in DCF:
  TV = FCF_{n+1} / (WACC - g) = FCF_n * (1 + g) / (WACC - g)

Convergence condition: WACC > g (necessary)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| V_0 | Intrinsic value at time 0 | KRW | (0, +inf) | Model output |
| D_0, D_1 | Current / next-period dividend | KRW | [0, +inf) | DART financials |
| r | Required return (equity cost) | decimal p.a. | (g, 0.30] | CAPM |
| g | Perpetuity growth rate | decimal p.a. | [0, WACC) | <= nominal GDP growth |
| FCF_n | Free cash flow at end of forecast period | KRW | (-inf, +inf) | DCF model |

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| g (Korea, terminal) | 2.5-4.0% | [B] | Bounded by long-run nominal GDP growth (~3-4%) |
| TV share of total value | 60-80% typical | [B] | Damodaran (2012) empirical observation |

**Sensitivity warning:** A 0.5pp change in g can shift enterprise value by 20%+.
This is a fundamental limitation of DCF that technical analysis helps mitigate by
providing timing signals independent of terminal value assumptions.

#### EVA (Economic Value Added)

**Citation:** Stewart, G. B. III (1991). *The Quest for Value: A Guide for
Senior Managers*. HarperBusiness.

```
EVA = NOPAT - WACC * IC

NOPAT = EBIT * (1 - T)          (Net Operating Profit After Tax)
IC = Equity + Interest-bearing Debt  (Invested Capital)

EVA Spread = ROIC - WACC
  EVA Spread > 0: value creation
  EVA Spread = 0: value neutral
  EVA Spread < 0: value destruction

MVA = SUM_{t=1}^{inf} EVA_t / (1 + WACC)^t
  (Market Value Added = PV of future EVAs)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| NOPAT | Net operating profit after tax | KRW | (-inf, +inf) | DART: 영업이익 * (1 - T) |
| IC | Invested capital | KRW | (0, +inf) | DART: 자본총계 + 이자부채 |
| WACC | Weighted average cost of capital | decimal p.a. | (0, 0.25) | CAPM + DART |
| ROIC | Return on invested capital | decimal | (-inf, +inf) | NOPAT / IC |
| MVA | Market value added | KRW | (-inf, +inf) | Market value - IC |

**Code reference:**
- `compute_eva.py` -- offline computation for all stocks with DART data
- `data/backtest/eva_scores.json` -- cached EVA scores keyed by stock code
- `financials.js:_renderEVA()` lines 459-477 -- display EVA Spread in financial panel
  - Positive: green `--fin-good`, Negative: red `--down`

**KRX EVA distribution:**

```
Top 10%:  EVA > 0, ROIC > WACC + 5pp  (Samsung Electronics, SK Hynix)
Mid 40%:  EVA ~ 0, ROIC ~ WACC        (capital cost breakeven)
Bot 50%:  EVA < 0, ROIC < WACC        (value destruction)

Korea Discount interpretation:
  High proportion of EVA < 0 firms justifies aggregate PBR < 1.0
  Governance discount = agency cost consuming EVA
```

#### RIM (Residual Income Model) and EVA Relationship

**Citation:** Ohlson, J. A. (1995). "Earnings, Book Values, and Dividends in
Equity Valuation." *Contemporary Accounting Research*, 11(2), 661-687.

```
RIM:  V_equity = B_0 + SUM_{t=1}^{inf} RI_t / (1 + r)^t
      RI_t = NI_t - r * B_{t-1}   (residual income)

EVA:  V_firm = IC_0 + SUM_{t=1}^{inf} EVA_t / (1 + WACC)^t

Relationship:
  V_equity(RIM) = V_firm(EVA) - D

Both models measure the same thing at different levels:
  RIM: equity-level (NI, equity cost r, book equity B)
  EVA: firm-level (NOPAT, WACC, invested capital IC)
```

---

### 2.3.9 Valuation Ratios

The financial panel displays the following ratios, each grounded in
corporate finance theory.

#### PER (Price-to-Earnings Ratio)

```
PER = Price / EPS = Market Cap / Net Income
```

| Edge Case | Handling | Code Reference |
|----------|---------|----------------|
| Negative earnings (loss) | Display "적자" (loss), not a negative PER | `financials.js` |
| Near-zero earnings | PER is unreliable (extremely large), display "--" | `financials.js` |
| Trailing vs Forward | CheeseStock uses trailing (most recent DART filing) | `data/financials/{code}.json` |

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| KOSPI historical avg PER | ~11x | [B] | Korea Discount: structural vs S&P 500 ~18-20x |
| PER threshold (low) | < industry avg * 0.7 | [C] | Heuristic for relative undervaluation |

#### PBR (Price-to-Book Ratio)

```
PBR = Price / BPS = Market Cap / Total Equity (book value)
```

| Edge Case | Handling | Code Reference |
|----------|---------|----------------|
| Negative equity | Display "--" (PBR undefined) | `financials.js` |
| PBR < 1 | Trading below book value -- potential value signal or value trap | Financial panel |

#### PSR (Price-to-Sales Ratio)

```
PSR = Market Cap / Revenue
```

| Edge Case | Handling |
|----------|---------|
| Zero revenue | Display "--" |
| Pre-revenue biotech | PSR is the only applicable ratio |

---

## 2.4 Behavioral Finance

This section documents the behavioral finance theories that explain *why* technical
patterns exist, *how* cognitive biases create predictable price dynamics, and *where*
CheeseStock applies behavioral adjustments to its confidence pipeline.

---

### 2.4.1 Prospect Theory

**Citation:** Kahneman, D. & Tversky, A. (1979). "Prospect Theory: An Analysis
of Decision under Risk." *Econometrica*, 47(2), 263-291. (Nobel Prize, 2002)

#### Value Function

```
v(x) = x^alpha           (x >= 0, gains)
v(x) = -lambda*(-x)^beta (x < 0, losses)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| x | Outcome relative to reference point | KRW | (-inf, +inf) | Portfolio P&L |
| alpha | Gain curvature (diminishing sensitivity) | dimensionless | [0.6, 1.0] | Experimental |
| beta | Loss curvature (diminishing sensitivity) | dimensionless | [0.6, 1.0] | Experimental |
| lambda | Loss aversion coefficient | dimensionless | [1.5, 3.5] | Experimental |

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| alpha | 0.88 | [B] | Kahneman-Tversky (1979) original; Stott (2006) meta-analysis confirms range [0.6, 1.0] |
| beta | 0.88 | [B] | Same as alpha in original; symmetric diminishing sensitivity |
| lambda | 2.25 | [B] | KT (1979) original; Wakker (2010) range [1.5, 3.5]; Abdellaoui et al. (2008) financial context: 1.5-2.0 |

**Key properties:**
1. **Reference dependence:** Utility evaluated as changes from reference point,
   not absolute wealth level
2. **Loss aversion:** Losses hurt ~2.25x more than equivalent gains feel good
3. **Diminishing sensitivity:** Concave for gains (risk-averse), convex for losses
   (risk-seeking)

**KRX calibration note:** Korean market-specific lambda estimates are unavailable
in the literature. The retail-heavy KRX investor base (~60-70% individual trading
volume vs NYSE ~20-30%) may exhibit stronger or weaker loss aversion depending
on cultural factors (Weber & Hsee 1998, "cushion hypothesis"). Algorithm
implementations should use range-based approaches rather than point estimates.

#### Probability Weighting Function

**Citation:** Tversky, A. & Kahneman, D. (1992). "Advances in Prospect Theory:
Cumulative Representation of Uncertainty." *Journal of Risk and Uncertainty*,
5(4), 297-323.

```
w(p) = p^gamma / (p^gamma + (1-p)^gamma)^(1/gamma)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| p | Objective probability | dimensionless | [0, 1] | -- |
| w(p) | Decision weight | dimensionless | [0, 1] | Transformed probability |
| gamma | Probability weighting parameter | dimensionless | ~0.61 | TK (1992) |

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| gamma | 0.61 | [B] | Tversky & Kahneman (1992) CPT; overweight small probs, underweight large probs |

**Effects:**
- Low probabilities overweighted: lottery effect (retail investors chase moonshots)
- High probabilities underweighted: certainty effect (premature profit-taking)

**Technical analysis implication:** Investors systematically overweight the
probability of extreme breakouts (buying into parabolic moves) and underweight
the probability of continuation in established trends.

---

### 2.4.2 Disposition Effect

**Citation:** Shefrin, H. & Statman, M. (1985). "The Disposition to Sell Winners
Too Early and Ride Losers Too Long." *Journal of Finance*, 40(3), 777-790.

#### Formal Definition

```
PGR = Realized Gains / (Realized Gains + Unrealized Gains)
PLR = Realized Losses / (Realized Losses + Unrealized Losses)

Disposition Effect: PGR > PLR
  --> Investors realize gains too quickly and hold losses too long
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| PGR | Proportion of gains realized | dimensionless | [0, 1] | Trade data |
| PLR | Proportion of losses realized | dimensionless | [0, 1] | Trade data |

**Citation for empirical confirmation:** Odean, T. (1998). "Are Investors Reluctant
to Realize Their Losses?" *Journal of Finance*, 53(5), 1775-1798.

#### Technical Analysis Implications

| Pattern/Level | Disposition Mechanism | Effect |
|-------------|---------------------|--------|
| Support lines | Loss holders resist selling (loss aversion) | Selling pressure accumulates |
| Resistance lines | Profit holders eager to sell (gain realization) | Creates ceiling |
| Three White Soldiers breaking resistance | Strong buying overcoming disposition selling | High conviction signal |
| Volume at support | Measures disposition-driven selling pressure | Higher volume = more realized losses |

#### CheeseStock Implementation

**Disposition factor (aspirational):**

```
disposition = volume_at_support / avg_volume - 1

Interpretation:
  High disposition at sell signals: selling pressure already exhausted
    --> sell signal weakened
  High disposition at buy signals: post-disposition rebound expected
    --> buy signal strengthened
```

**Current status:** `signalEngine.js:applySRProximityBoost()` implements
S/R proximity-based signal strength adjustment, which is the practical proxy
for disposition-driven price dynamics. Full volume-based disposition measurement
requires investor-level trade data not currently available (pending Koscom transition).

**Code reference:** `core_data/24_behavioral_quantification.md` Section 2.

---

### 2.4.3 Herding Behavior

**Citation:** Chang, E. C., Cheng, J. W. & Khorana, A. (2000). "An Examination
of Herd Behavior in Equity Markets: An International Perspective." *Journal of
Banking & Finance*, 24(10), 1651-1679.

#### CSAD (Cross-Sectional Absolute Deviation) Regression

```
CSAD_t = alpha + gamma_1 * |R_m,t| + gamma_2 * R_m,t^2 + epsilon_t

Under rational pricing:
  CSAD increases linearly with |R_m| (dispersion should rise with market moves)

Under herding:
  CSAD increases less than linearly (gamma_2 < 0)
  --> stocks move together, reducing cross-sectional dispersion
  --> gamma_2 < 0 is the herding signature
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| CSAD_t | Cross-sectional absolute deviation at time t | decimal | [0, +inf) | All stock returns |
| R_m,t | Market return at time t | decimal | (-inf, +inf) | KOSPI/KOSDAQ index |
| gamma_1 | Linear dispersion sensitivity | dimensionless | [0, +inf) | OLS |
| gamma_2 | Herding coefficient | dimensionless | (-inf, 0) if herding | OLS |

**KRX herding characteristics:**

| Feature | KRX | NYSE |
|---------|-----|------|
| Retail trading share | ~60-70% | ~20-30% |
| Herding intensity (Kim & Wei 2002) | Significantly higher for retail | Lower overall |
| Crisis amplification | Herding spikes during crises (1997, 2008, 2020) | Present but less extreme |
| Chaebol effect | Institutional herding in chaebol affiliates (Choi & Sias 2009) | N/A |

**Code reference:** CSAD measurement is not currently implemented in JS (requires
cross-sectional data across all stocks). The concept is partially captured by:
- `appWorker.js:_applyMacroConfidenceToPatterns()` -- VIX/VKOSPI spike dampening
  reflects periods when herding invalidates individual pattern signals
- `appWorker.js` 4-regime RORO model -- crisis regime implicitly captures herding episodes

---

### 2.4.4 Overreaction and Underreaction

#### Long-Term Overreaction (Contrarian Profits)

**Citation:** DeBondt, W. F. M. & Thaler, R. (1985). "Does the Stock Market
Overreact?" *Journal of Finance*, 40(3), 793-805.

```
Finding: Stocks with extreme negative returns over 3-5 years
  subsequently outperform (losers become winners)
Mechanism: Investor overreaction to bad news leads to overshooting
  --> subsequent mean reversion generates contrarian profits

Overreaction test:
  Form Winner/Loser portfolios based on past 36-month returns
  Track subsequent 36-month returns
  If Loser > Winner: overreaction confirmed
```

#### Short-Term Underreaction (Momentum Profits)

**Citation:** Jegadeesh, N. & Titman, S. (1993). "Returns to Buying Winners
and Selling Losers: Implications for Stock Market Efficiency." *Journal of
Finance*, 48(1), 65-91.

```
Finding: Stocks with high returns over past 3-12 months continue
  to outperform over the next 3-12 months
Mechanism: Investor underreaction to new information
  --> gradual price adjustment creates momentum

Momentum strategy: Long winners (top decile), Short losers (bottom decile)
  3-12 month formation, 3-12 month holding
  Historical alpha: ~1% per month (US)
```

**CheeseStock implementation:**
- Momentum factor included in MRA 17-column Ridge regression (column 13: momentum_60d)
- `backtester.js` WLS includes ATR-normalized price moves, which capture both
  overreaction (moveATR > 3 triggers confidence dampening) and underreaction
  (trend continuation patterns)
- Overreaction threshold (moveATR > 3) is dynamically applied in
  `core_data/24_behavioral_quantification.md` Section 4: "장기 과잉반응
  (DeBondt-Thaler 1985): moveATR > 3 --> mw 감쇠 (이미 구현)"

---

### 2.4.5 Anchoring and Support/Resistance Psychology

**Citation:** Tversky, A. & Kahneman, D. (1974). "Judgment under Uncertainty:
Heuristics and Biases." *Science*, 185(4157), 1124-1131.

#### Anchoring in Financial Markets

```
Insufficient adjustment from anchors:
  Initial information (anchor) disproportionately influences subsequent judgment

Financial anchors:
  1. 52-week high/low prices       --> major S/R levels
  2. Previous close                --> next-day reference point
  3. Moving averages               --> dynamic psychological anchors
  4. Round numbers (10,000 KRW)    --> clustering at price levels
  5. IPO price                     --> long-term anchor for recent IPOs
```

#### S/R Strength Formula (Anchoring-Adjusted)

```
R_strength = SUM_i V_i * w(P_anchor - P_i)

V_i: volume at price level i
w(): proximity weight function (inversely proportional to distance from anchor)
P_anchor: anchoring price level (52wk high, round number, etc.)
```

**Code reference:**
- `patterns.js` -- Support/Resistance detection uses ATR*0.5 tolerance clustering
  with minimum 2 touches, maximum 10 levels, sorted by touch count
- `signalEngine.js:applySRProximityBoost()` -- Confidence boost when pattern
  stop/target coincides with S/R level (ATR proximity)
- `core_data/18_behavioral_market_microstructure.md` Section 7 -- tick-size
  boundaries (1,000/5,000/10,000 KRW) create artificial resistance

**KRX-specific anchoring:** KRX tick-size transitions at 1,000/5,000/10,000/50,000 KRW
create discrete anchoring points where order clustering produces artificial S/R levels.

---

### 2.4.6 Market Microstructure: ILLIQ and Behavioral Liquidity

#### Amihud ILLIQ (Illiquidity Ratio)

**Citation:** Amihud, Y. (2002). "Illiquidity and Stock Returns: Cross-Section
and Time-Series Effects." *Journal of Financial Markets*, 5(1), 31-56.

```
ILLIQ = (1/D) * SUM_{d=1}^{D} |r_d| / DVOL_d

D: number of trading days
r_d: daily return
DVOL_d: daily trading value (KRW)
```

| Symbol | Definition | Unit | Range | Source |
|--------|-----------|------|-------|--------|
| ILLIQ | Amihud illiquidity ratio | 1/KRW | [0, +inf) | Computed from OHLCV |
| r_d | Daily return | decimal | (-inf, +inf) | Close-to-close |
| DVOL_d | Daily trading value | KRW | (0, +inf) | Volume * VWAP proxy |
| D | Number of trading days in window | integer | typically 20 | Rolling window |

| KRX Segment | ILLIQ Range | Practical Slippage |
|------------|------------|-------------------|
| KOSPI 200 | 0.001-0.010 | 0.01-0.03% |
| KOSPI mid-cap | 0.010-0.050 | 0.05-0.10% |
| KOSDAQ large | 0.050-0.200 | 0.08-0.15% |
| KOSDAQ small | 0.200-0.500+ | 0.20-0.50% |

**Code reference:**
- `indicators.js:calcAmihudILLIQ()` -- canonical ILLIQ computation (log-transformed)
- `appWorker.js:_updateMicroContext()` line 1484 -- calls `calcAmihudILLIQ(candleData)`
- `appWorker.js:_applyMicroConfidenceToPatterns()` lines 1518-1538 -- applies
  liquidity discount to pattern confidence when ILLIQ indicates low liquidity

**Confidence adjustment mechanism:**

```
// Phase 2-D: Amihud ILLIQ liquidity discount (Doc18 Section 3.1, Kyle 1985)
if (microCtx.illiq && microCtx.illiq.confDiscount < 1.0) {
    adj *= microCtx.illiq.confDiscount;
}
// Clamp: [0.80, 1.15] (micro adjustments narrower than macro)
```

**Behavioral interpretation:** High ILLIQ stocks are susceptible to Kyle (1985) price
impact effects. Pattern signals in illiquid stocks are less reliable because:
1. Wider effective spreads increase execution cost
2. Lower participation means less information aggregation
3. Thin order books amplify noise in price patterns

#### Kyle Lambda (Price Impact)

**Citation:** Kyle, A. S. (1985). "Continuous Auctions and Insider Trading."
*Econometrica*, 53(6), 1315-1335.

```
Delta_P = lambda * order_flow

lambda = sigma_v / (sigma_v + sigma_u)

sigma_v: information value volatility
sigma_u: noise trading volume
```

**Code reference:** `backtester.js` `KRX_SLIPPAGE = 0.10%` is a simplified
Kyle lambda proxy for KOSPI large-cap stocks. This underestimates slippage for
KOSDAQ small caps by 4-10x (see ILLIQ table above).

---

### 2.4.7 Cross-Cultural Behavioral Finance: KRX Specifics

**Citation:** Kim, W. & Wei, S.-J. (2002). "Foreign Portfolio Investors Before
and During a Crisis." *Journal of International Economics*, 56(1), 77-96.

#### Korean Market Behavioral Characteristics

| Characteristic | KRX Evidence | Citation |
|---------------|-------------|----------|
| Strong retail herding | Individual investor herding significantly stronger than institutional/foreign | Kim & Wei (2002) |
| Confucian risk attitude | Lower perceived risk for same objective risk level ("cushion hypothesis") | Weber & Hsee (1998) |
| Chaebol disposition effect | Disposition effect pronounced in large chaebol stocks | Choi & Sias (2009) |
| Crisis herding amplification | Herding intensity spikes during market crises | Kim & Wei (2002) |

#### Parameter Calibration Implications

```
Western prospect theory parameters: lambda = 2.25, alpha = 0.88
Korean market considerations:
  - Retail dominance: herding coefficient may be 1.3-1.5x Western markets
  - Individual trading share: KRX ~60-70% vs NYSE ~20-30%
  - Korean-specific lambda/alpha estimates: insufficient academic research
  - Recommendation: use range-based approach (Wakker 2010), pending Korean data
```

---

### 2.4.8 Market Emotion Cycle and Technical Pattern Mapping

```
Optimism --> Excitement --> Euphoria --> Anxiety --> Denial
--> Fear --> Despair --> Depression --> Hope --> Relief --> Optimism
```

| Emotion Phase | RSI | MACD | Bollinger | Pattern |
|-------------|-----|------|-----------|---------|
| Optimism/Excitement | 60-80 | Positive, expanding | Approaching upper band | Three White Soldiers |
| Euphoria | 80+ | Maximum | Upper band breach | -- (unsustainable) |
| Anxiety/Denial | 70-->50 | Positive, contracting | Mean reversion | Doji |
| Fear/Despair | 20-30 | Negative, expanding | Lower band breach | Three Black Crows |
| Depression | <20 | Minimum | At lower band | Hammer |
| Hope/Relief | 30-->50 | Negative, contracting | Mean reversion | Bullish Engulfing |

**Code reference:** `signalEngine.js` implements RSI-based overbought/oversold
signals and MACD crossover/divergence signals that correspond to transitions
in this emotion cycle.

---

### 2.4.9 Information Cascade and Pattern Formation

**Citation:** Bikhchandani, S., Hirshleifer, D. & Welch, I. (1992). "A Theory
of Fads, Fashion, Custom, and Cultural Change as Informational Cascades."
*Journal of Political Economy*, 100(5), 992-1026.

```
Agent i's decision:
  - Private signal: s_i
  - Observed actions of predecessors: (a_1, a_2, ..., a_{i-1})
  - When sufficiently many predecessors chose the same action:
    --> agent ignores own private signal --> cascade forms

Volume surge + trend = information cascade in progress
Three White Soldiers = visual representation of a buy cascade
Three Black Crows = visual representation of a sell cascade
```

**Connection to pattern confidence:** The `patternEngine` quality scoring
considers volume confirmation (volume above average at pattern formation)
as evidence of an information cascade, which strengthens pattern reliability.

---

## Finance Theory Findings

### Implementation Correctness Audit

| Component | Status | Notes |
|-----------|--------|-------|
| `calcCAPMBeta()` OLS formula | CORRECT | `Cov(r_i, r_m) / Var(r_m)` on lines 418-430 |
| Scholes-Williams correction | CORRECT | `(betaLag + beta0 + betaLead) / (1 + 2*rhoM)` on line 456; trigger at >10% zero-volume days |
| Jensen's Alpha annualization | CORRECT | `alphaFinal * KRX_TRADING_DAYS` on line 473 |
| Excess return formulation | CORRECT | Both stock and market returns subtract `rfDaily` (lines 408-409) |
| FF3 excess return | CORRECT | `ri = (close - prev) / prev - rfDaily` before regression (line 332) |
| R-squared computation | CORRECT | Uses SW-corrected beta for R^2 (lines 460-469), recomputes alpha for consistency |
| Blume shrinkage | VERIFIED OFFLINE | `compute_capm_beta.py` computes `betaBlume`; displayed in `financials.js` |
| EVA formula | CORRECT | `NOPAT - WACC * IC` computed in `compute_eva.py`, displayed as spread in `financials.js` |
| ILLIQ confidence discount | CORRECT | `appWorker.js` line 1536 applies `microCtx.illiq.confDiscount` with [0.80, 1.15] clamp |

### Identified Deviations from Academic Standard

| Issue | Severity | Description | Recommendation |
|-------|----------|------------|----------------|
| KRX_SLIPPAGE constant | LOW | `backtester.js` uses fixed 0.10% for all stocks; KOSDAQ small caps need 0.20-0.50% | Make slippage ILLIQ-adaptive: `slippage = max(0.10%, k * ILLIQ)` |
| Zero-Beta CAPM not implemented | INFO | Current alpha uses standard CAPM baseline; KRX short-selling bans suggest Zero-Beta CAPM is more appropriate | Future: estimate E[R_z] from low-beta stock returns |
| CSAD herding measure | INFO | Not implemented in JS; herding effects captured only indirectly through macro dampening | Implement cross-sectional CSAD when full market data is available in Worker |
| Disposition factor | INFO | Volume-based disposition effect quantification not implemented; requires investor-level trade data | Pending Koscom real-time data transition |
| Korean lambda/alpha calibration | INFO | Prospect theory parameters use Western estimates; no KRX-specific calibration | Long-term: academic partnership or proprietary estimation from DART/KRX trade data |

### Cross-Reference Index

| Theory | Primary Doc | Code File | Function/Variable |
|--------|-----------|-----------|-------------------|
| EMH | Doc 05 S1 | `indicators.js` | `calcHurst()` |
| AMH | Doc 05 S6, Doc 21 S1 | `backtester.js` | WLS lambda=0.995 |
| MPT | Doc 05 S2 | -- | Conceptual (no portfolio optimizer) |
| CAPM | Doc 05 S3, Doc 25 S1 | `indicators.js` | `calcCAPMBeta()` |
| Jensen's Alpha | Doc 05 S3.2, Doc 25 S6 | `indicators.js` | `calcCAPMBeta().alpha` |
| Scholes-Williams | Doc 25 S2 | `indicators.js` | `calcCAPMBeta()` lines 433-458 |
| Blume Shrinkage | Doc 25 S9.3 | `compute_capm_beta.py` | `betaBlume` |
| Zero-Beta CAPM | Doc 42 S3 | -- | Not yet implemented |
| ICAPM | Doc 42 S4 | `appWorker.js` | Macro factor pipeline |
| APT | Doc 23, Doc 42 S6 | `backtester.js` | 17-col Ridge regression |
| FF3 | Doc 05 S4, Doc 23 S3 | `financials.js` | `_renderFF3Factors()` |
| BSM | Doc 05 S5, Doc 45 | `compute_options_analytics.py` | Straddle implied move |
| WACC | Doc 14 S2.3 | `compute_eva.py` | WACC computation |
| Gordon Growth | Doc 14 S2.4 | -- | Terminal value (conceptual) |
| EVA | Doc 14 S2.8.5 | `financials.js` | `_renderEVA()` |
| Prospect Theory | Doc 04 S1 | -- | Conceptual (parameter tables) |
| Disposition Effect | Doc 04 S1.3, Doc 24 S2 | `signalEngine.js` | `applySRProximityBoost()` |
| Herding (CSAD) | Doc 04 S3, Doc 24 S3 | `appWorker.js` | Indirect: macro dampening |
| Overreaction | Doc 04 S5.2, Doc 24 S4 | `backtester.js` | moveATR > 3 dampening |
| Anchoring | Doc 04 S2.2 | `patterns.js` | S/R clustering algorithm |
| ILLIQ | Doc 18 S3.1 | `indicators.js`, `appWorker.js` | `calcAmihudILLIQ()`, `_updateMicroContext()` |
| Kyle Lambda | Doc 18 S1.1 | `backtester.js` | `KRX_SLIPPAGE` |
| EWMA Volatility | Doc 05 S8 | `backtester.js` | `_buildRLContext()` |

---

*End of S2 Sections 2.3-2.4*
