# S2 Theoretical Basis -- Sections 2.3-2.4: Finance Theory & Behavioral Finance (V7)

> ANATOMY V7 -- CheeseStock Production Anatomy
> Author: financial-theory-expert (Opus 4.6 1M context)
> Date: 2026-04-06
> Scope: CFA-paper-grade documentation of every finance theory and behavioral
> finance concept underlying CheeseStock's asset pricing, factor models,
> valuation pipeline, confidence adjustments, and market microstructure.
>
> **Upgrade from V5 (1,180 lines):** Complete formula provenance chains
> (academic paper --> core_data document --> JS/Python implementation --> UI display),
> CFA Paper Grade annotation (symbol tables, constants tables with grades and
> sensitivity), edge case catalogs, and cross-system mapping for 15 formulas
> (F-1 through F-9, B-1 through B-6).

---

## Table of Contents

```
2.3  Classical Finance Theory
  2.3.1   Efficient Market Hypothesis (EMH)
  2.3.2   Adaptive Markets Hypothesis (AMH)
  2.3.3   Modern Portfolio Theory (MPT)
  2.3.4   CAPM [F-1]
  2.3.5   APT [F-2]
  2.3.6   Fama-French 3-Factor [F-3]
  2.3.7   Jensen's Alpha [F-4]
  2.3.8   Scholes-Williams Beta Correction [F-5]
  2.3.9   Blume Beta Mean-Reversion [F-6]
  2.3.10  Sharpe Ratio [F-7]
  2.3.11  WACC [F-8]
  2.3.12  EVA [F-9]
  2.3.13  Zero-Beta CAPM
  2.3.14  ICAPM (Intertemporal CAPM)
  2.3.15  CCAPM (Consumption-Based CAPM)
  2.3.16  Black-Scholes-Merton Option Pricing
  2.3.17  Corporate Finance: MM Theorems
  2.3.18  Valuation Ratios (PER, PBR, PSR)

2.4  Behavioral Finance
  2.4.1   Prospect Theory Value Function [B-1]
  2.4.2   Fear-Greed Index (KRX) [B-2]
  2.4.3   Disposition Effect Coefficient [B-3]
  2.4.4   LSV Herding Measure [B-4]
  2.4.5   CSAD Herding Index [B-5]
  2.4.6   Kyle Lambda [B-6]
  2.4.7   Overreaction and Underreaction
  2.4.8   Anchoring and S/R Psychology
  2.4.9   Market Emotion Cycle
  2.4.10  Information Cascades
  2.4.11  Cross-Cultural Behavioral Finance: KRX Specifics

Appendix A: Implementation Correctness Audit
Appendix B: Identified Deviations and Fixes
Appendix C: Full Cross-Reference Index
```

---

## 2.3 Classical Finance Theory

This section documents the canonical finance theories underpinning CheeseStock's
asset pricing, risk decomposition, factor modeling, valuation, and corporate finance.
Every numbered formula (F-1 through F-9) carries full CFA Paper Grade annotation.

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

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| P_t | Price | Asset price at time t | KRW | (0, inf) | OHLCV close |
| Phi_t | Info set | Information set at time t | -- | -- | Theoretical construct |
| r | Required return | Required rate of return | decimal | [0, 0.30] | CAPM or factor model |
| E[.] | Expectation | Conditional expectation operator | -- | -- | Probability theory |

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

**System mapping:**
- `indicators.js:calcHurst()` -- rolling H estimation.
  H > 0.5: trend persistence (efficiency departure); H = 0.5: random walk
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

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| Efficiency_t | Efficiency level | Market efficiency at time t | dimensionless | [0, 1] | Rolling ACF, Hurst |
| rho_t | Autocorrelation | Rolling first-order autocorrelation | dimensionless | [-1, 1] | calcHurst() |

#### Testable Predictions

| AMH Prediction | Measurement Method | CheeseStock Implementation |
|---------------|-------------------|---------------------------|
| Time-varying autocorrelation | Rolling rho_1 over 60d window | `calcHurst()` in `indicators.js` |
| Strategy lifecycle decay | Half-life estimation | `backtester.js` WLS lambda=0.995 decay |
| Regime-dependent pattern validity | HMM state classification | `appWorker.js` 4-regime RORO model |

**Key implication for CheeseStock:** Pattern confidence should be regime-conditional.
The WLS exponential decay weighting (lambda=0.995) implements AMH by down-weighting
older pattern observations.

**Unfalsifiability caveat (Doc 05 S6):** "Sometimes works, sometimes doesn't" is
not falsifiable. CheeseStock mitigates this by using quantitative efficiency proxies
(rolling Hurst, ACF) rather than qualitative AMH claims.

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

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| w_i | Weight | Weight of asset i in portfolio | decimal | [0, 1] | Optimization |
| E[R_i] | Expected return | Expected return of asset i | decimal p.a. | [-1, +inf) | Factor model |
| sigma_ij | Covariance | Covariance of returns i, j | decimal^2 | (-inf, +inf) | Sample/shrinkage |
| sigma_p^2 | Portfolio var | Portfolio variance | decimal^2 | [0, +inf) | Computed |
| R* | Target return | Target portfolio return | decimal p.a. | frontier domain | User |

#### Dimensionality Problem

```
N = 2,700 (KRX full universe):
  Full covariance parameters: N(N+3)/2 = 3,646,350
  Single-Index Model (Sharpe 1963): 3N + 2 = 8,102
  Reduction: 99.78%
```

**Provenance:**
- Academic: Markowitz (1952) --> Sharpe (1963) simplification
- core_data: Doc 05 S2 (MPT basics), Doc 42 S2 (single-index)
- Code: `compute_capm_beta.py` (single-index OLS for ~2,700 stocks)

---

### 2.3.4 Capital Asset Pricing Model (CAPM) -- Formula F-1

**Citation:**
- Sharpe, W. F. (1964). "Capital Asset Prices: A Theory of Market Equilibrium
  under Conditions of Risk." *Journal of Finance*, 19(3), 425-442.
- Lintner, J. (1965). "The Valuation of Risk Assets and the Selection of Risky
  Investments in Stock Portfolios and Capital Budgets." *Review of Economics and
  Statistics*, 47(1), 13-37.
- (Both: Nobel Prize in Economics, 1990)

#### F-1: CAPM Equation

```
E[R_i] = R_f + beta_i * (E[R_m] - R_f)

beta_i = Cov(R_i, R_m) / Var(R_m)
```

#### F-1 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| E[R_i] | Expected return | Expected return of asset i | decimal p.a. | (-inf, +inf) | Model output |
| R_f | Risk-free rate | Risk-free rate of return | decimal p.a. | [0, 0.10] | KTB 10Y: `bonds_latest.json` |
| beta_i | Beta | Systematic risk sensitivity | dimensionless | (-inf, +inf), typical [0, 3] | OLS regression |
| E[R_m] | Market return | Expected return on market portfolio | decimal p.a. | [0, 0.30] | KOSPI index |
| Cov(R_i, R_m) | Covariance | Covariance of asset i with market | decimal^2 | (-inf, +inf) | Daily returns |
| Var(R_m) | Market variance | Variance of market returns | decimal^2 | (0, +inf) | Daily returns |
| ERP | Risk premium | E[R_m] - R_f | decimal p.a. | typical [0.04, 0.10] | Damodaran/KCMI |

#### F-1 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| R_f (Korea 2026) | ~3.0-3.5% p.a. | [A] | Low (0.5pp shift: <1% alpha change) | KTB 10Y, observable market rate | `bonds_latest.json`, `compute_capm_beta.py:load_rf_annual()` |
| ERP (Korea) | 5.5-7.0% p.a. | [B] | Medium (1pp: ~1% WACC shift) | Damodaran annual + KCMI 2000-2020 | `compute_eva.py:EQUITY_RISK_PREMIUM=0.06` |
| KRX_TRADING_DAYS | 250 | [A] | Negligible | KRX official ~250 days/year | `compute_capm_beta.py` line 356: `alpha_annual = alpha_final * 250` |
| MIN_OBS for beta | 60 | [B] | Medium (lower N: noisier beta) | 3-month minimum, practitioner convention | `compute_capm_beta.py:MIN_OBS=60` |
| DEFAULT_WINDOW | 250 | [B] | Medium (shorter: more responsive) | 1-year rolling window | `compute_capm_beta.py:DEFAULT_WINDOW=250` |

#### F-1 System Mapping

```
Provenance chain:
  Sharpe (1964), Lintner (1965)
    --> core_data/05_finance_theory.md S3.1 (CAPM formula)
    --> core_data/25_capm_delta_covariance.md S1.1-1.5 (estimation methods)
    --> core_data/42_advanced_asset_pricing.md S2 (single-index model context)
    --> scripts/compute_capm_beta.py:compute_beta() lines 264-390 (offline OLS)
    --> js/indicators.js:calcCAPMBeta() lines 391-478 (in-browser live beta)
    --> js/financials.js:_renderCAPMBeta() lines 143-178 (D-column display)
    --> data/backtest/capm_beta.json (cached beta for all stocks)
```

**Beta estimation in `compute_capm_beta.py:compute_beta()` (lines 264-390):**
1. Build aligned (stock_return, market_return) pairs by date matching
2. Both returns subtract `rf_daily`: `ri = (sc - prev_sc) / prev_sc - rf_daily`
3. OLS beta: `beta0 = cov_rm_ri / var_rm`
4. Alpha: `alpha0 = mean_ri - beta0 * mean_rm`
5. Conditional Scholes-Williams correction if thin-trading detected (see F-5)
6. R-squared: `1 - ss_res / ss_tot` (using SW-corrected beta)
7. Alpha annualized: `alpha_final * 250`
8. Blume adjustment: `0.67 * beta_final + 0.33 * 1.0` (see F-6)

**In-browser `indicators.js:calcCAPMBeta()`:** Mirrors the Python implementation
for live beta display. Uses excess-return formulation (lines 408-409).

#### F-1 Edge Cases

| Edge Case | Handling | Code Reference |
|----------|---------|----------------|
| Insufficient data (< 60 obs) | Return null | `compute_capm_beta.py` line 292 |
| Zero market variance | Return null | `compute_capm_beta.py` line 310 |
| Negative beta | Valid (inverse market, gold ETF) | No special handling |
| Extreme beta (> 3.0) | Valid but flagged as high-risk | `financials.js` line 175: label system |
| No market index data | Return '--' in display | `financials.js` line 160 |

#### Beta Interpretation (Display)

```
beta < 0.7  --> '방어적' (Defensive)
0.7 <= beta < 1.0 --> '중립' (Neutral)
1.0 <= beta < 1.5 --> '공격적' (Aggressive)
beta >= 1.5 --> '고위험' (High Risk)
```

**KRX empirical beta distribution (2,628 stocks, compute_capm_beta.py 2026-03-30):**
```
KOSPI: mean=0.75, median=0.68, std=0.48
KOSDAQ: mean=0.83, median=0.77, std=0.55
```

#### CML and SML

```
CML: E[R_p] = R_f + [(E[R_m] - R_f) / sigma_m] * sigma_p
  x-axis = total risk (sigma), efficient portfolios only

SML: E[R_i] = R_f + beta_i * (E[R_m] - R_f)
  x-axis = systematic risk (beta), all assets
  SML is the geometric representation of CAPM

Alpha interpretation:
  Above SML: alpha > 0 --> undervalued (buy candidate)
  Below SML: alpha < 0 --> overvalued (sell candidate)
```

**Citation:** Tobin, J. (1958). "Liquidity Preference as Behavior Towards Risk."
*Review of Economic Studies*, 25(2), 65-86.

#### Separation Theorem (Tobin 1958)

```
Two-Fund Separation:
  Step 1 (Investment decision): Determine optimal risky portfolio M
    --> identical for all investors (market portfolio)
  Step 2 (Financing decision): Allocate between R_f and M
    --> varies by individual risk aversion

Limitation: Homogeneous expectations, free borrowing/lending violated in practice
  --> Zero-Beta CAPM addresses this (Section 2.3.13)
```

---

### 2.3.5 Arbitrage Pricing Theory (APT) -- Formula F-2

**Citation:** Ross, S. A. (1976). "The Arbitrage Theory of Capital Asset Pricing."
*Journal of Economic Theory*, 13(3), 341-360.

#### F-2: APT Pricing Equation

```
E[R_i] = R_f + SUM_{j=1}^{K} beta_{i,j} * lambda_j
```

#### F-2 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| E[R_i] | Expected return | Expected return of asset i | decimal p.a. | (-inf, +inf) | Model output |
| R_f | Risk-free rate | Risk-free rate | decimal p.a. | [0, 0.10] | KTB 10Y |
| beta_{i,j} | Factor loading | Sensitivity of asset i to factor j | dimensionless | (-inf, +inf) | Time-series regression |
| lambda_j | Factor premium | Risk premium for factor j | decimal p.a. | (-inf, +inf) | Cross-sectional regression |
| K | Factor count | Number of systematic factors | integer | typical 3-7 | Empirical |
| F_j | Factor innovation | Unexpected realization of factor j | decimal | E[F_j]=0 | Factor-mimicking portfolio |
| epsilon_i | Idiosyncratic return | Asset-specific return component | decimal | E[eps]=0 | Regression residual |

#### F-2 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| K (MRA pipeline) | 17 columns (12 pattern + 5 APT) | [C] | High (feature selection) | Ross (1976) theory; FF3 (1993) empirical | `backtester.js` WLS design matrix |
| Ridge lambda | GCV-selected | [B] | Medium | Golub, Heath & Wahba (1979) GCV | `backtester.js:selectRidgeLambdaGCV()` |
| Walk-forward window | 120 train + 20 test | [C] | High (shorter: more responsive, noisier) | Pardo (2008) WFE protocol | `backtester.js:walkForwardTest()` |

#### CAPM vs APT Comparison

| Property | CAPM (F-1) | APT (F-2) |
|----------|-----------|-----------|
| Derivation logic | Equilibrium (utility maximization) | No-arbitrage (weaker assumption) |
| Number of factors | 1 (market) | K (unspecified, empirical) |
| Requires market portfolio | Yes | No |
| Factor identity specified | Yes (market return) | No (data-determined) |
| Distributional assumption | Normal returns (mean-variance) | Approximate (asymptotic, large N) |
| CAPM is special case of APT | Yes (K=1, factor=market) | -- |

#### F-2 Derivation Sketch (Ross 1976)

```
Assumptions:
  (A1) R_i = E[R_i] + SUM_k b_{i,k} * F_k + epsilon_i  (factor structure)
  (A2) Cov(epsilon_i, epsilon_j) = 0  for all i != j  (no cross-idiosyncratic correlation)
  (A3) K << N  (few factors relative to assets)

No-arbitrage argument:
  Construct portfolio w with:
    SUM_i w_i = 0       (zero cost)
    SUM_i w_i * b_{i,k} = 0  for all k  (zero factor exposure)
    w_i = O(1/N)         (well-diversified)

  Portfolio return: R_p = SUM_i w_i * E[R_i] + ~0 (deterministic!)
  No-arbitrage requires: SUM_i w_i * E[R_i] = 0

  --> E[R_i] lies in span of factor loading vectors
  --> E[R_i] = lambda_0 + SUM_k b_{i,k} * lambda_k  (pricing equation)
  --> With risk-free asset: lambda_0 = R_f

Note: APT holds approximately (not exactly) for finite N.
  Ross (1976) Theorem: pricing errors bounded by O(1/N).
```

#### F-2 System Mapping

```
Provenance chain:
  Ross (1976) APT
    --> core_data/23_apt_factor_model.md (APT basics, CZW connection)
    --> core_data/42_advanced_asset_pricing.md S6 (formal derivation)
    --> scripts/mra_apt_extended.py (17-col Ridge regression, offline calibration)
    --> js/backtester.js WLS 5-col design matrix (in-browser factor model)
    --> data/macro/ff3_factors.json (daily factor returns)

Phase 4-1 validation (297K samples):
  12-col WF IC: 0.0567  -->  17-col WF IC: 0.0998  (delta: +0.0430)
  All 5 APT factors significant at p<0.001:
    liquidity t=-27.6, log_size t=+20.0, value t=-14.6, beta t=+11.9, momentum t=-6.0
```

---

### 2.3.6 Fama-French 3-Factor Model -- Formula F-3

**Citation:** Fama, E. F. & French, K. R. (1993). "Common Risk Factors in the
Returns on Stocks and Bonds." *Journal of Financial Economics*, 33(1), 3-56.

#### F-3: Fama-French 3-Factor Regression

```
R_i - R_f = alpha_i + beta_MKT * (R_m - R_f) + beta_SMB * SMB + beta_HML * HML + epsilon_i
```

#### F-3 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| R_i - R_f | Excess return | Asset excess return | decimal | (-inf, +inf) | OHLCV - rfDaily |
| alpha_i | Intercept | FF3 alpha (pricing error) | decimal | (-inf, +inf) | Regression output |
| beta_MKT | Market loading | Market factor sensitivity | dimensionless | typical [0, 2] | OLS regression |
| SMB | Size factor | Small Minus Big returns | decimal | (-inf, +inf) | Cap-sorted L/S portfolio |
| HML | Value factor | High Minus Low returns | decimal | (-inf, +inf) | BM-sorted L/S portfolio |
| beta_SMB | Size loading | Size factor sensitivity | dimensionless | typical [-1, 1] | OLS regression |
| beta_HML | Value loading | Value factor sensitivity | dimensionless | typical [-1, 1] | OLS regression |
| epsilon_i | Residual | Unexplained return | decimal | E[eps]=0 | Regression residual |

#### F-3 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| SMB construction | Bottom 50% - Top 50% by market cap | [B] | Medium (breakpoint choice) | Fama & French (1993) original 2x3 sort | `scripts/ff3_factors.py` |
| HML construction | Top 30% - Bottom 30% by B/M | [B] | Medium (breakpoint choice) | Fama & French (1993) original 2x3 sort | `scripts/ff3_factors.py` |
| rfDaily | KTB 10Y / 250 | [A] | Low | Observable | `ff3_factors.json:rf_daily` |

#### 5-Factor Extension (Fama-French 2015)

**Citation:** Fama, E. F. & French, K. R. (2015). "A Five-Factor Asset Pricing
Model." *Journal of Financial Economics*, 116(1), 1-22.

```
R_i - R_f = alpha_i + b*MKT + s*SMB + h*HML + r*RMW + c*CMA + epsilon_i

RMW = Robust Minus Weak (profitability factor)
CMA = Conservative Minus Aggressive (investment factor)
```

**CheeseStock status:** FF5 not implemented; FF3 sufficient for current pipeline.

#### Carhart 4-Factor (Momentum)

**Citation:** Carhart, M. M. (1997). "On Persistence in Mutual Fund Performance."
*Journal of Finance*, 52(1), 57-82.

```
+ u_i * UMD
UMD = Up Minus Down (momentum factor, 12-1 month formation)
```

**Connection:** Technical analysis trend-following strategies are
interpretable as exposure to the momentum factor (UMD).

#### F-3 System Mapping

```
Provenance chain:
  Fama & French (1993)
    --> core_data/05_finance_theory.md S4.1-4.2 (3/5-factor overview)
    --> core_data/23_apt_factor_model.md (FF as APT special case)
    --> core_data/42_advanced_asset_pricing.md S7 (FF5 deep dive, 2x3 sort)
    --> scripts/ff3_factors.py (KRX-specific factor construction)
    --> data/macro/ff3_factors.json (daily MKT_RF[], SMB[], HML[], rf_daily)
    --> js/financials.js:_renderFF3Factors() lines 295-359 (in-browser OLS)
    --> UI: fin-smb, fin-hml elements in financial panel (D column)
```

**FF3 regression in financials.js (lines 295-359):**

```javascript
// Dependent variable: excess return (R_i - R_f) -- CORRECT per academic standard
var rfDaily = _ff3FactorData.rf_daily || 0;
var ri = (stockCandles[si].close - prev) / prev - rfDaily;

// Design matrix: [MKT_RF, SMB, HML]
// OLS via calcWLSRegression() with uniform weights
// Output: beta = [alpha, mkt_beta, smb_loading, hml_loading]
```

**Display labels:**
- SMB loading > 0: "소형주 특성" (small-cap character)
- SMB loading < 0: "대형주 특성" (large-cap character)
- HML loading > 0: "가치주 특성" (value character)
- HML loading < 0: "성장주 특성" (growth character)

---

### 2.3.7 Jensen's Alpha -- Formula F-4

**Citation:** Jensen, M. C. (1968). "The Performance of Mutual Funds in the
Period 1945-1964." *Journal of Finance*, 23(2), 389-416.

#### F-4: Jensen's Alpha

```
alpha_i = R_i - [R_f + beta_i * (R_m - R_f)]
```

#### F-4 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| alpha_i | Jensen's alpha | Risk-adjusted excess return | decimal p.a. | (-inf, +inf) | Regression intercept |
| R_i | Realized return | Actual return of asset i | decimal | -- | OHLCV |
| R_f | Risk-free rate | Daily: (1 + R_f_annual)^(1/250) - 1 | decimal/day | ~0.013%/day | KTB 10Y |
| beta_i | Market beta | CAPM beta (possibly Scholes-Williams corrected) | dimensionless | [0, 3] | OLS/SW |
| R_m | Market return | Market portfolio return | decimal | -- | KOSPI/KOSDAQ index |

#### F-4 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| KRX_TRADING_DAYS | 250 | [A] | Direct scaling | Standard convention | `compute_capm_beta.py` line 356 |
| Alpha significance threshold | |t| > 2.0 | [B] | ~95% confidence (normal approx) | `financials.js` line 267 |
| R_f fallback | 3.5% | [B] | Low at pattern horizons | KTB 10Y historical median | `compute_capm_beta.py` line 261 |

#### F-4 System Mapping (Two Implementations)

**Implementation 1: Offline (compute_capm_beta.py)**
```
Provenance:
  Jensen (1968)
    --> core_data/05_finance_theory.md S3.2 (alpha definition)
    --> core_data/25_capm_delta_covariance.md S1.5 (alpha attribution)
    --> scripts/compute_capm_beta.py:compute_beta() lines 346-356
        alpha_final = mean_ri - beta_final * mean_rm
        alpha_annual = alpha_final * 250
    --> data/backtest/capm_beta.json: per-stock alpha, alphaTstat, alphaPvalue
    --> js/financials.js:_renderBlumeBetaAlpha() lines 263-273 (display)
    --> UI: fin-alpha-sig element ("+X.XX% *유의" or "+X.XX% 비유의")
```

**Implementation 2: Online pattern-level (backtester.js)**
```
  --> js/backtester.js:_calcJensensAlpha() lines 489-504
      alpha = rawReturn - (rfPeriod + beta * (marketReturnPct - rfPeriod))
  --> Called per pattern per horizon in _computeStats() lines 1749-1780
  --> Stored in result.horizons[h].jensensAlpha
```

**Significance testing:**
- `compute_capm_beta.py` lines 364-376: t-statistic = alpha_daily / SE(alpha)
- SE(alpha) = sigma_epsilon / sqrt(T), where sigma_epsilon = sqrt(ss_res / (T-2))
- p-value: two-sided normal approximation (valid for T > 60)
- Display: `financials.js` shows "*유의" (significant) when |t| > 2.0

#### F-4 Edge Cases

| Edge Case | Handling | Code Reference |
|----------|---------|----------------|
| beta is null | Return null | `backtester.js` line 500 |
| Market return unavailable | Skip alpha calculation | `backtester.js` lines 1751-1755 |
| Very short holding period (h=1) | R_f contribution ~0.013%, negligible | Conceptually valid |
| Negative alpha + significant | Display red with "*유의" | `financials.js` line 270 |

---

### 2.3.8 Scholes-Williams Beta Correction -- Formula F-5

**Citation:** Scholes, M. & Williams, J. (1977). "Estimating Betas from
Nonsynchronous Data." *Journal of Financial Economics*, 5(3), 309-327.

#### F-5: Scholes-Williams Corrected Beta

```
beta_SW = (beta_{-1} + beta_0 + beta_{+1}) / (1 + 2 * rho_m)

beta_{-1} = Cov(r_{i,t}, r_{m,t-1}) / Var(r_m)   (lag beta)
beta_0    = Cov(r_{i,t}, r_{m,t})   / Var(r_m)   (contemporaneous, standard OLS)
beta_{+1} = Cov(r_{i,t}, r_{m,t+1}) / Var(r_m)   (lead beta)
rho_m     = Cov(r_{m,t}, r_{m,t-1}) / Var(r_m)   (market return autocorrelation)
```

#### F-5 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| beta_SW | Corrected beta | Scholes-Williams beta | dimensionless | (-inf, +inf) | Computation |
| beta_{-1} | Lag beta | Stock vs lagged market | dimensionless | (-inf, +inf) | OLS on r_{m,t-1} |
| beta_0 | Contemporaneous beta | Standard OLS beta | dimensionless | (-inf, +inf) | OLS |
| beta_{+1} | Lead beta | Stock vs lead market | dimensionless | (-inf, +inf) | OLS on r_{m,t+1} |
| rho_m | Market ACF(1) | First-order autocorrelation of market returns | dimensionless | [-1, 1] | Sample ACF |

#### F-5 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| THIN_TRADING_THRESH | 0.10 (10%) | [B] | Medium (lower: more corrections applied) | Scholes & Williams (1977) practitioner threshold | `compute_capm_beta.py:THIN_TRADING_THRESH=0.10` |
| SW denominator guard | abs(denom) > 0.01 | [C] | Low (prevents division by near-zero) | Numerical stability | `compute_capm_beta.py` line 342 |

#### F-5 System Mapping

```
Provenance chain:
  Scholes & Williams (1977) -- non-synchronous trading correction
    --> core_data/25_capm_delta_covariance.md S2.1 (SW theory)
    --> scripts/compute_capm_beta.py:compute_beta() lines 318-343 (offline)
    --> js/indicators.js:calcCAPMBeta() lines 433-458 (in-browser)

Trigger condition:
  thinTrading = (zero_return_days / T) > 0.10
  If thinTrading == True: apply SW correction
  Else: use standard OLS beta (beta_0)
```

**Why thin-trading correction matters for KRX:** Many KOSDAQ small-cap stocks have
frequent zero-volume days. Without SW correction, the OLS beta is biased toward zero
because the stock's delayed response to market movements is not captured by
contemporaneous covariance alone. The SW correction aggregates lag, contemporaneous,
and lead covariances to capture the full price adjustment process.

---

### 2.3.9 Blume Beta Mean-Reversion -- Formula F-6

**Citation:** Blume, M. E. (1975). "Betas and Their Regression Tendencies."
*Journal of Finance*, 30(3), 785-795.

**IMPORTANT PROVENANCE CORRECTION:** The original Blume (1971) paper reported
different shrinkage coefficients. Blume (1975) updated them. The existing Doc 05
reference to "0.371 + 0.635" appears to cite Merrill Lynch's proprietary adaptation.
The CheeseStock implementation uses the practitioner-standard form of shrinkage
toward the cross-sectional mean (assumed to be 1.0).

#### F-6: Blume Adjusted Beta (as implemented)

```
beta_Blume = w * beta_OLS + (1 - w) * 1.0

w = 0.67  (shrinkage weight on raw beta)
```

This is algebraically equivalent to:
```
beta_Blume = 0.33 + 0.67 * beta_OLS
```

#### F-6 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| beta_Blume | Adjusted beta | Shrinkage-adjusted beta | dimensionless | (0.33, +inf) | Computation |
| beta_OLS | Raw beta | OLS or SW-corrected beta | dimensionless | (-inf, +inf) | F-1 or F-5 |
| w | Shrinkage weight | Weight on raw beta | dimensionless | 0.67 | Blume (1975) |

#### F-6 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| BLUME_WEIGHT (w) | 0.67 | [B] | Medium (higher w: less shrinkage) | Blume (1975); practitioner convention | `compute_capm_beta.py` line 361: `BLUME_WEIGHT = 0.67` |
| Grand mean beta | 1.0 | [B] | Low (standard assumption) | Cross-sectional average; mathematical identity for cap-weighted portfolios | Implicit in formula |

**DISCREPANCY FLAG:** The existing V5 document (line 248) states the formula as
`beta_Blume = 0.343 + 0.677 * beta_OLS`, which implies shrinkage toward a grand
mean of ~1.06 (solving: 0.343 / (1 - 0.677) = 1.062). The actual Python code
uses `0.67 * beta + 0.33 * 1.0` which shrinks toward exactly 1.0.

**Resolution:** The code is correct and follows the standard practitioner convention.
The V5 document's coefficients (0.343/0.677) likely originated from Merrill Lynch's
(later Bloomberg's) beta service which estimated slightly different shrinkage
parameters from US data. For KRX, shrinkage toward 1.0 is appropriate since
the cap-weighted market beta is by definition 1.0. The V6 document corrects this.

#### F-6 System Mapping

```
Provenance chain:
  Blume (1975) empirical finding: betas regress toward 1 over time
    --> core_data/25_capm_delta_covariance.md S9.3 (Blume adjustment theory)
    --> scripts/compute_capm_beta.py lines 358-362 (offline computation)
        BLUME_WEIGHT = 0.67
        beta_blume = BLUME_WEIGHT * beta_final + (1 - BLUME_WEIGHT) * 1.0
    --> data/backtest/capm_beta.json: per-stock betaBlume field
    --> js/financials.js:_renderBlumeBetaAlpha() lines 253-258 (display)
    --> UI: fin-blume-beta element ("X.XX (방어적/중립/공격적/고위험)")
```

> **Implementation gap note:** `js/financials.js` displays the `betaBlume` field from
> `data/backtest/capm_beta.json` (computed offline by `compute_capm_beta.py`). The JS
> code does **not** apply the Blume shrinkage formula at runtime — the adjusted beta is
> pre-computed in Python and stored in JSON. If `capm_beta.json` is absent or stale,
> the UI falls back to raw OLS beta without any shrinkage applied, and no warning is
> shown to the user. This is by design (offline computation model) but means the
> formula F-6 in this document describes Python behaviour only, not JS behaviour.

#### Theoretical Justification

Beta mean-reversion arises from two sources:

1. **Estimation error:** Extreme betas are disproportionately driven by sampling
   noise. Shrinkage toward the mean reduces mean squared error (James & Stein 1961:
   when K >= 3 parameters, the shrinkage estimator dominates OLS).

2. **Economic mean-reversion:** Firms with extreme betas tend to change their
   risk profiles over time (leveraged firms delever, conservative firms invest
   in growth). Blume (1975) documented this empirically across 7-year intervals.

---

### 2.3.10 Sharpe Ratio -- Formula F-7

**Citation:** Sharpe, W. F. (1966). "Mutual Fund Performance." *Journal of
Business*, 39(1), 119-138.

#### F-7: Sharpe Ratio

```
SR = (E[R_p] - R_f) / sigma_p
```

#### F-7 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| SR | Sharpe ratio | Risk-adjusted excess return per unit of total risk | dimensionless | (-inf, +inf), good > 0.5 | Computation |
| E[R_p] | Portfolio return | Expected (or realized) portfolio return | decimal p.a. | (-inf, +inf) | Performance data |
| R_f | Risk-free rate | Risk-free rate | decimal p.a. | [0, 0.10] | KTB 10Y |
| sigma_p | Portfolio vol | Standard deviation of portfolio returns | decimal p.a. | (0, +inf) | Historical returns |

#### F-7 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| R_f (annualized) | ~3.5% | [A] | Medium | KTB 10Y | `bonds_latest.json` |
| Annualization factor | sqrt(250) | [A] | Direct scaling | Standard convention | Used for daily-to-annual conversion |

#### Sharpe Ratio Variants

```
Sortino Ratio = (R_p - R_f) / sigma_downside
  --> penalizes only downside volatility
  --> Sortino & van der Meer (1991)

Treynor Ratio = (R_p - R_f) / beta_p
  --> risk measured by systematic risk only
  --> Treynor (1965)

Calmar Ratio = CAGR / MaxDrawdown
  --> risk measured by worst historical drawdown
```

#### F-7 System Mapping

```
Provenance chain:
  Sharpe (1966)
    --> core_data/05_finance_theory.md S7.3 (Sharpe formula)
    --> core_data/14_finance_management.md S5 (Sharpe/Sortino/Calmar variants)
    --> js/backtester.js line 658 reference: Lo (2002) "Statistics of Sharpe Ratios"
    --> Not currently computed as a standalone metric in the UI
    --> Used implicitly in reliability tier classification (risk-adjusted significance)
```

**Note:** While CheeseStock does not display a standalone Sharpe ratio, the concept
underlies the backtester's reliability assessment. The in-sample IC inflation concern
flagged by Lo (2002) is addressed via the walk-forward testing protocol.

---

### 2.3.11 WACC -- Formula F-8

**Citation:**
- Modigliani, F. & Miller, M. H. (1963). "Corporate Income Taxes and the Cost
  of Capital: A Correction." *American Economic Review*, 53(3), 433-443.
- Standard corporate finance textbook formula; see Damodaran (2012) for Korean
  parameter guidance.

#### F-8: Weighted Average Cost of Capital

```
WACC = w_E * k_E + w_D * k_D * (1 - t)

w_E = E / (E + D)      (equity weight)
w_D = D / (E + D)      (debt weight)
k_E = R_f + beta * ERP  (CAPM-derived cost of equity)
k_D = R_f + credit_spread  (cost of debt)
```

#### F-8 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| WACC | Weighted avg cost of capital | Blended cost of capital | decimal p.a. | (0, 0.25) | Computation |
| w_E | Equity weight | Market cap / (Market cap + Debt) | dimensionless | (0, 1) | index.json + financials |
| w_D | Debt weight | Debt / (Market cap + Debt) | dimensionless | (0, 1) | DART financials |
| k_E | Cost of equity | Required return on equity | decimal p.a. | (0, 0.30) | CAPM (F-1) |
| k_D | Cost of debt | Average interest rate on debt | decimal p.a. | (0, 0.15) | Imputed from financials |
| t | Corporate tax rate | Effective tax rate | decimal | [0.05, 0.50] | DART or statutory |
| E | Equity value | Market capitalization | 억원 | (0, +inf) | index.json:marketCap |
| D | Debt value | Interest-bearing debt | 억원 | [0, +inf) | DART: 부채총계 * 0.60 |

#### F-8 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| STATUTORY_TAX_RATE | 0.22 | [A] | Medium (1pp: ~0.15pp WACC) | Korean tax law 2024, >200M KRW bracket | `compute_eva.py:STATUTORY_TAX_RATE=0.22` |
| TAX_RATE_FLOOR | 0.05 | [C] | Low (guard) | Numerical stability | `compute_eva.py:TAX_RATE_FLOOR=0.05` |
| TAX_RATE_CAP | 0.50 | [C] | Low (guard) | Numerical stability | `compute_eva.py:TAX_RATE_CAP=0.50` |
| EQUITY_RISK_PREMIUM | 0.06 (6%) | [B] | High (1pp: ~0.6pp k_E) | Damodaran 2024 Korea estimate | `compute_eva.py:EQUITY_RISK_PREMIUM=0.06` |
| CORP_DEBT_SPREAD | 0.015 (1.5%) | [B] | Medium | BBB+ vs KTB10Y average spread | `compute_eva.py:CORP_DEBT_SPREAD=0.015` |
| INTEREST_BEARING_DEBT_RATIO | 0.60 | [C] | Medium | Korean corp avg ~60% of total liabilities | `compute_eva.py:INTEREST_BEARING_DEBT_RATIO=0.60` |
| DEFAULT_BETA | 1.0 | [B] | Medium | Market average | `compute_eva.py:DEFAULT_BETA=1.0` |
| DEFAULT_RF_PCT | 3.5 | [B] | Low | KTB 10Y historical median | `compute_eva.py:DEFAULT_RF_PCT=3.5` |

#### F-8 System Mapping

```
Provenance chain:
  MM (1963) tax shield theory
    --> core_data/14_finance_management.md S2.3 (WACC formula)
    --> core_data/43_corporate_finance_advanced.md S1 (Miller 1977 personal tax extension)
    --> scripts/compute_eva.py (WACC computation per stock, lines ~180-250)
        k_E = rf_annual/100 + beta * EQUITY_RISK_PREMIUM
        k_D = rf_annual/100 + CORP_DEBT_SPREAD
        D_ibd = total_liabilities * INTEREST_BEARING_DEBT_RATIO
        E = marketCap (억원)
        w_E = E / (E + D_ibd_eok)
        WACC = w_E * k_E + (1 - w_E) * k_D * (1 - tax_rate)
    --> data/backtest/eva_scores.json: per-stock wacc field
    --> js/financials.js:_renderEVA() lines 459-477 (displays EVA Spread = ROIC - WACC)
    --> UI: fin-eva-spread element
```

#### F-8 Edge Cases

| Edge Case | Handling | Code Reference |
|----------|---------|----------------|
| Zero debt (no leverage) | WACC = k_E (pure equity cost) | compute_eva.py |
| Financial sector | WACC conceptually differs (debt = operating asset) | EVA not computed for financials |
| Negative equity | WACC undefined; skip stock | compute_eva.py |
| Beta unavailable | Use DEFAULT_BETA = 1.0 | compute_eva.py line 59 |
| Tax rate negative | Clamp to TAX_RATE_FLOOR (0.05) | compute_eva.py:estimate_tax_rate() |

---

### 2.3.12 EVA (Economic Value Added) -- Formula F-9

**Citation:** Stewart, G. B. III (1991). *The Quest for Value: A Guide for
Senior Managers*. HarperBusiness.

**Additional:** Grant, J. L. (2003). *Foundations of Economic Value Added*. Wiley.

#### F-9: EVA Formula

```
EVA = NOPAT - WACC * IC

NOPAT = EBIT * (1 - t)                     (Net Operating Profit After Tax)
IC = Total_Equity + Interest_Bearing_Debt   (Invested Capital)

EVA Spread = ROIC - WACC
  ROIC = NOPAT / IC

EVA Momentum = (EVA_t - EVA_{t-1}) / |IC_{t-1}|

MVA = SUM_{t=1}^{inf} EVA_t / (1 + WACC)^t
  (Market Value Added = PV of future EVAs)
```

#### F-9 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| EVA | Economic value added | Residual income after capital charge | KRW (억원) | (-inf, +inf) | Computation |
| NOPAT | Net operating profit after tax | Operating income net of taxes | KRW (억원) | (-inf, +inf) | DART: 영업이익 * (1-t) |
| WACC | Cost of capital | Weighted average cost | decimal p.a. | (0, 0.25) | F-8 |
| IC | Invested capital | Capital deployed in operations | KRW (억원) | (0, +inf) | DART: equity + IBD |
| ROIC | Return on invested capital | Operating return on deployed capital | decimal | (-inf, +inf) | NOPAT / IC |
| EVA Spread | Value creation rate | Excess return over cost of capital | decimal | (-inf, +inf) | ROIC - WACC |
| MVA | Market value added | PV of future EVAs | KRW (억원) | (-inf, +inf) | Theoretical |

#### F-9 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| IBD ratio | 0.60 | [C] | Medium | Korean avg: ~60% of total liabilities is interest-bearing | `compute_eva.py:INTEREST_BEARING_DEBT_RATIO=0.60` |
| Tax rate | 0.22 (statutory) or imputed | [A]/[C] | Medium | Korean tax law / estimate_tax_rate() | `compute_eva.py:STATUTORY_TAX_RATE=0.22` |

#### F-9 System Mapping

```
Provenance chain:
  Stewart (1991) EVA
    --> core_data/14_finance_management.md S2.8 (EVA as residual income)
    --> scripts/compute_eva.py (full computation)
        NOPAT = operating_income * (1 - effective_tax_rate)
        IC = total_equity_eok + interest_bearing_debt_eok
        ROIC = NOPAT / IC
        eva = NOPAT - WACC * IC
        eva_spread = ROIC - WACC
    --> data/backtest/eva_scores.json
        {stocks: {code: {eva, evaMomentum, evaSpread, roic, wacc, nopat, investedCapital}}}
    --> js/financials.js:_renderEVA() lines 459-477
        Display: EVA Spread formatted as percentage
        Color: positive = KRX_COLORS fin-good (green), negative = KRX_COLORS down (blue)
    --> UI: fin-eva-spread element in financial panel D column
```

**Relationship to RIM (Ohlson 1995):**
```
RIM: V_equity = B_0 + SUM RI_t / (1+r)^t,  RI_t = NI_t - r * B_{t-1}
EVA: V_firm   = IC_0 + SUM EVA_t / (1+WACC)^t

V_equity(RIM) = V_firm(EVA) - D

Both are residual income models at different capital structure levels:
  RIM: equity-level (Net Income, equity cost, book equity)
  EVA: firm-level (NOPAT, WACC, invested capital)
```

#### F-9 Edge Cases

| Edge Case | Handling | Code Reference |
|----------|---------|----------------|
| Negative operating income | NOPAT is negative; EVA is deeply negative | compute_eva.py |
| seed/demo data source | Skip entirely (fake EVA prevention) | compute_eva.py line 89 |
| Financial sector | Skip (debt = operating asset) | compute_eva.py (sector check) |
| Zero invested capital | Skip (division by zero) | compute_eva.py |
| EVA Spread close to 0 | Display neutral color | financials.js |

---

### 2.3.13 Zero-Beta CAPM

**Citation:** Black, F. (1972). "Capital Market Equilibrium with Restricted
Borrowing." *Journal of Business*, 45(3), 444-455.

```
E[R_i] = E[R_z] + beta_i * (E[R_m] - E[R_z])

E[R_z] = expected return on the zero-beta portfolio
         (portfolio with Cov(R_z, R_m) = 0)
E[R_z] > R_f  (zero-beta portfolio bears idiosyncratic risk)
```

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| E[R_z] | Zero-beta return | Expected return of zero-beta portfolio | decimal p.a. | (R_f, E[R_m]) | Cross-sectional regression |

**KRX relevance:** Korea's repeated short-selling bans (2008, 2011, 2020,
2023-2025, cumulative ~5.5 years since 2008, ~30% of the period) violate the
standard CAPM's free borrowing/lending assumption. Zero-Beta CAPM is the more
appropriate equilibrium model for KRX during ban periods.

**Empirical evidence:**
- Fama & MacBeth (1973): gamma_0 > R_f and gamma_1 < ERP in SML cross-sectional
  regression --> consistent with Zero-Beta CAPM
- Frazzini & Pedersen (2014) "Betting Against Beta": low-beta stocks systematically
  underpriced (exploiting leverage constraints)

**Implementation status:** Not yet implemented. Current alpha uses standard CAPM
baseline. Future path: estimate E[R_z] from returns of stocks with beta < 0.1
in `data/backtest/capm_beta.json`.

**Source:** core_data/42_advanced_asset_pricing.md S3.1-3.5

---

### 2.3.14 ICAPM (Intertemporal Capital Asset Pricing Model)

**Citation:** Merton, R. C. (1973). "An Intertemporal Capital Asset Pricing Model."
*Econometrica*, 41(5), 867-887. (Nobel Prize, 1997)

```
E[R_i] - R_f = beta_{i,M} * (E[R_M] - R_f) + SUM_k beta_{i,k} * lambda_k

beta_{i,k} = Cov(R_i, Delta_s_k) / Var(Delta_s_k)
  --> "hedging beta" for state variable k

State variables:
  s_1 = interest rate changes         (Delta_r)
  s_2 = volatility changes            (Delta_sigma, VKOSPI)
  s_3 = consumption growth            (KOSIS CCI proxy)
  s_4 = inflation changes             (Delta_pi)
```

**ICAPM's critical theoretical role:** ICAPM provides the economic justification
for why multiple factors (beyond market beta) should enter the pricing equation.
Without ICAPM, the Fama-French factors are purely empirical observations; with
ICAPM, they are interpretable as hedging demands against changes in the investment
opportunity set.

**MRA pipeline as ICAPM implementation:**

| MRA Column | ICAPM State Variable Proxy | Economic Intuition |
|-----------|---------------------------|-------------------|
| beta_60d | Market portfolio beta (beta_{i,M}) | Systematic risk exposure |
| momentum_60d | Market trend persistence state | Recent performance predicts future opportunities |
| value_inv_pbr | Discount rate sensitivity state | Value stocks more sensitive to rate changes |
| log_size | Business cycle sensitivity state | Small caps more vulnerable in downturns |
| liquidity_20d | Liquidity state | Illiquid assets suffer more in liquidity crises |

**Macro data as direct state variable measurements:**

| Data File | ICAPM State Variable | Field |
|-----------|---------------------|-------|
| `data/macro/macro_latest.json` | Interest rate (s_1) | `bok_rate` |
| `data/macro/bonds_latest.json` | Term structure (s_1 extension) | `ktb_3y`, `ktb_10y` |
| `data/vkospi.json` | Volatility (s_2) | `close` |
| `data/macro/ff3_factors.json` | Empirical factor proxies | `MKT_RF`, `SMB`, `HML` |

**Source:** core_data/42_advanced_asset_pricing.md S4.1-4.6

---

### 2.3.15 CCAPM (Consumption-Based CAPM)

**Citation:** Breeden, D. T. (1979). "An Intertemporal Asset Pricing Model with
Stochastic Consumption and Investment Opportunities." *Journal of Financial
Economics*, 7(3), 265-296.

```
CCAPM: E[R_i] - R_f = beta_{c,i} * lambda_c

beta_{c,i} = Cov(R_i, Delta_c) / Var(Delta_c)   (consumption beta)
lambda_c   = gamma * Var(Delta_c)                  (consumption risk premium)
Delta_c    = (C_{t+1} - C_t) / C_t                (consumption growth)
gamma      = relative risk aversion coefficient

Euler Equation (fundamental pricing equation):
  1 = E[M_{t+1} * (1 + R_{i,t+1})]
  M_{t+1} = beta * (C_{t+1}/C_t)^(-gamma)   (stochastic discount factor)
```

**Equity Premium Puzzle (Mehra & Prescott 1985):**
Required gamma ~ 27 to explain 6.2% US equity premium; plausible range is 1-10.
Resolutions: habit formation (Campbell & Cochrane 1999), recursive utility
(Epstein & Zin 1989), rare disasters (Barro 2006).

**KRX status:** CCAPM is not directly implemented. Consumption data is quarterly
(KOSIS API), too low-frequency for daily pattern analysis. The Consumer Confidence
Index (CCI) from `data/macro/kosis_latest.json` serves as an indirect proxy.

**Source:** core_data/42_advanced_asset_pricing.md S5.1-5.6

---

### 2.3.16 Black-Scholes-Merton Option Pricing

**Citation:**
- Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate
  Liabilities." *Journal of Political Economy*, 81(3), 637-654.
- Merton, R. C. (1973). "Theory of Rational Option Pricing." *Bell Journal of
  Economics*, 4(1), 141-183.
- (Nobel Prize in Economics, 1997)

```
Call: C = S*N(d_1) - K*e^(-rT)*N(d_2)
Put:  P = K*e^(-rT)*N(-d_2) - S*N(-d_1)

d_1 = [ln(S/K) + (r + sigma^2/2)*T] / (sigma*sqrt(T))
d_2 = d_1 - sigma*sqrt(T)
```

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| C, P | Option prices | Call, put value | KRW | [0, +inf) | Model output |
| S | Underlying | Current underlying price | KRW | (0, +inf) | Market |
| K | Strike | Strike price | KRW | (0, +inf) | Contract |
| r | Risk-free rate | Continuous rate | decimal p.a. | [0, 0.10] | KTB 3Y |
| T | Time to expiry | Years to expiration | years | (0, +inf) | Contract |
| sigma | Volatility | Implied or historical vol | decimal p.a. | (0, +inf) | BSM inversion |
| N(.) | Normal CDF | Standard normal CDF | dimensionless | [0, 1] | Tabulated |

**System mapping:**
- `data/vkospi.json` -- VKOSPI (Korean VIX equivalent) time series
- `compute_options_analytics.py` -- straddle implied move via BSM
- `appWorker.js` -- VKOSPI spike triggers pattern confidence dampening

**Source:** core_data/05_finance_theory.md S5, core_data/45 (options pricing deep dive)

---

### 2.3.17 Corporate Finance: MM Theorems

**Citation:** Modigliani, F. & Miller, M. H. (1958). "The Cost of Capital,
Corporation Finance and the Theory of Investment." *American Economic Review*,
48(3), 261-297.

```
MM Proposition I (no taxes, 1958):
  V_L = V_U
  --> Capital structure is irrelevant in perfect markets

MM Proposition I (corporate tax, 1963):
  V_L = V_U + T_c * D
  --> Tax shield creates debt advantage
  --> Extreme implication: 100% debt is optimal (unrealistic)

Miller (1977) personal tax correction:
  Net gain from debt = 1 - [(1-T_c)(1-T_s)] / (1-T_d)
  T_c = corporate tax rate
  T_s = personal tax on equity income
  T_d = personal tax on debt (interest) income

  If (1-T_c)(1-T_s) = (1-T_d): debt advantage vanishes entirely ("Miller equilibrium")
```

**KRX relevance:**
- Korea statutory corporate tax: 22-25% (bracket-dependent)
- Dividend income tax: 15.4% (including local surtax)
- Interest income tax: 15.4%
- In Korea, T_s ~ T_d, so debt advantage is primarily from corporate tax shield

**Source:** core_data/43_corporate_finance_advanced.md S1-2

---

### 2.3.18 Valuation Ratios (PER, PBR, PSR)

Displayed in financial panel (D column), `js/financials.js` lines 739-842.

#### PER (Price-to-Earnings Ratio)

```
PER = Price / EPS = Market_Cap / Net_Income
```

| Edge Case | Handling | Code Reference |
|----------|---------|----------------|
| Negative earnings (loss) | Display "적자" | `financials.js` |
| Near-zero earnings | PER unreliable; display "--" | `financials.js` |
| Trailing vs Forward | Uses trailing (most recent DART filing) | `data/financials/{code}.json` |

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| KOSPI historical avg PER | ~11x | [B] | Korea Discount vs S&P 500 ~18-20x |

#### PBR (Price-to-Book Ratio)

```
PBR = Price / BPS = Market_Cap / Total_Equity
```

| Edge Case | Handling |
|----------|---------|
| Negative equity | Display "--" (PBR undefined) |
| PBR < 1 | Value signal or value trap (requires EVA check) |

#### PSR (Price-to-Sales Ratio)

```
PSR = Market_Cap / Revenue
```

| Edge Case | Handling |
|----------|---------|
| Zero revenue | Display "--" |
| Pre-revenue biotech | PSR is the only applicable ratio |

**DART account matching:** Revenue maps from multiple K-IFRS account names:
매출액, 수익(매출액), 영업수익 all map to revenue.

**Source:** core_data/14_finance_management.md S2.5, `.claude/rules/financial.md`

---

## 2.4 Behavioral Finance

This section documents the behavioral finance theories that explain *why* technical
patterns exist, *how* cognitive biases create predictable price dynamics, and *where*
CheeseStock applies behavioral adjustments to its confidence pipeline.
Six formulas carry full CFA Paper Grade annotation (B-1 through B-6).

---

### 2.4.1 Prospect Theory Value Function -- Formula B-1

**Citation:** Kahneman, D. & Tversky, A. (1979). "Prospect Theory: An Analysis
of Decision under Risk." *Econometrica*, 47(2), 263-291. (Nobel Prize, 2002)

#### B-1: Prospect Theory Value Function

```
v(x) = x^alpha                    (x >= 0, gains)
v(x) = -lambda * (-x)^beta        (x < 0, losses)
```

#### B-1 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| v(x) | Value | Subjective value of outcome x | utility units | (-inf, +inf) | Model output |
| x | Outcome | Gain or loss relative to reference point | KRW | (-inf, +inf) | Portfolio P&L |
| alpha | Gain curvature | Diminishing sensitivity for gains | dimensionless | [0.6, 1.0] | Experimental |
| beta | Loss curvature | Diminishing sensitivity for losses | dimensionless | [0.6, 1.0] | Experimental |
| lambda | Loss aversion | Loss aversion coefficient | dimensionless | [1.5, 3.5] | Experimental |

#### B-1 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| alpha | 0.88 | [B] | Medium | Kahneman & Tversky (1979) original; Stott (2006) meta-analysis [0.6-1.0] | Not directly coded; theoretical basis for S/R psychology |
| beta | 0.88 | [B] | Medium | Same as alpha; symmetric diminishing sensitivity | Not directly coded |
| lambda | 2.25 | [B] | High (determines loss-aversion strength) | KT (1979); Wakker (2010) range [1.5-3.5]; Abdellaoui et al. (2008) financial: 1.5-2.0 | `core_data/24_behavioral_quantification.md` S1: CZW R:R gate adjustment |

#### Probability Weighting Function (Cumulative Prospect Theory)

**Citation:** Tversky, A. & Kahneman, D. (1992). "Advances in Prospect Theory:
Cumulative Representation of Uncertainty." *Journal of Risk and Uncertainty*,
5(4), 297-323.

```
w(p) = p^gamma / (p^gamma + (1-p)^gamma)^(1/gamma)

gamma ~ 0.61 (TK 1992)
```

**IMPORTANT PROVENANCE NOTE:** The probability weighting function belongs to
**Cumulative Prospect Theory (1992)**, not the original Prospect Theory (1979).
The 1979 paper introduced the value function; the 1992 paper introduced
rank-dependent probability weighting. Some sources conflate the two.

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| gamma | 0.61 | [B] | Medium (controls probability distortion) | Tversky & Kahneman (1992) | Not directly coded |

**Effects on KRX investors:**
- Low probability overweighting: retail investors chase moonshots (KOSDAQ biotech)
- High probability underweighting: premature profit-taking on established trends
- Combined with loss aversion: hold losers too long (disposition effect, B-3)

#### B-1 System Mapping

```
Provenance chain:
  Kahneman & Tversky (1979) --> Tversky & Kahneman (1992)
    --> core_data/04_psychology.md S1.2 (value function, parameter estimates)
    --> core_data/18_behavioral_market_microstructure.md S5 (order book expression)
    --> core_data/24_behavioral_quantification.md S1 (CZW R:R gate lambda adjustment)
    --> Conceptual basis for:
        patterns.js S/R detection (support = loss-aversion anchor)
        signalEngine.js:applySRProximityBoost() (proximity to psychological levels)
        appWorker.js macro dampening (fear/greed regime adjustment)
    --> Not directly parameterized in any JS function (behavioral framework,
        not a computed value)
```

**KRX calibration gap:** Korean-specific lambda/alpha estimates are absent from
the academic literature. The retail-heavy KRX (~60-70% individual trading volume)
may exhibit different loss aversion from Western samples. Recommendation: use
range-based approaches pending Korean empirical data.

---

### 2.4.2 Fear-Greed Index (KRX Version) -- Formula B-2

**Citation:** CNN Money Fear & Greed Index (proprietary, non-academic).
KRX adaptation: CheeseStock internal design, inspired by CNN's 7-component structure.

**ACADEMIC CAVEAT (from Doc 24):** The CNN Fear & Greed Index is a marketing tool,
not a peer-reviewed academic instrument. CheeseStock's KRX adaptation uses a
simplified 4-component version. Component weights are initial guesses based on
CNN's equal-weighting approach and have NOT been calibrated to KRX data.

#### B-2: KRX Fear-Greed Composite

```
FearGreed = w_1*RSI_norm + w_2*volSurge_norm + w_3*volRatio_norm + w_4*newHighLow_norm
```

#### B-2 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| FearGreed | Fear-Greed score | Composite sentiment indicator | dimensionless | [0, 1] | Computation |
| RSI_norm | Normalized RSI | RSI(14) scaled to [0,1], 50=neutral | dimensionless | [0, 1] | indicators.js:calcRSI() |
| volSurge_norm | Vol surge ratio | ATR(14)/ATR(50), >1.2=fear, <0.8=greed | dimensionless | [0, 1] | indicators.js:calcATR() |
| volRatio_norm | Volume ratio | Volume/VMA(20), >2=extreme | dimensionless | [0, 1] | OHLCV volume |
| newHighLow_norm | High-Low breadth | (New highs - New lows) / Total stocks | dimensionless | [-1, 1] | Cross-sectional |

#### B-2 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| w_1 (RSI weight) | 0.30 | [D] | High (not calibrated to KRX) | Equal-weight approximation of CNN | `core_data/24_behavioral_quantification.md` S1 |
| w_2 (vol surge weight) | 0.30 | [D] | High | Equal-weight approximation | Same |
| w_3 (volume ratio weight) | 0.20 | [D] | High | Equal-weight approximation | Same |
| w_4 (breadth weight) | 0.20 | [D] | High | Equal-weight approximation | Same |

**Grade justification for [D]:** These weights are "initial guesses" without
KRX-specific calibration. The documentation explicitly states: "KRX 시장에 대한
개별적 가중치 최적화(calibration)가 수행되지 않았으며" (Doc 24 S1).

#### B-2 System Mapping

```
Provenance chain:
  CNN Fear & Greed Index (marketing tool, non-academic)
    --> core_data/24_behavioral_quantification.md S1 (KRX adaptation, 4-component)
    --> core_data/04_psychology.md S4.2 (criticism + modern alternatives)
    --> Not currently implemented as a standalone indicator in JS
    --> Conceptual basis for: CZW R:R gate lambda adjustment
        Fear (FG < 0.3): lambda raised --> higher R:R required
        Greed (FG > 0.7): lambda lowered --> lower R:R permitted
```

**Recommended academic alternatives (from Doc 04 S4.2):**
1. VIX/VKOSPI + term structure (academically validated)
2. NLP-based news sentiment (FinBERT/KR-FinBERT)
3. Options put/call ratio + skew
4. Social media sentiment scores

---

### 2.4.3 Disposition Effect Coefficient -- Formula B-3

**Citation:**
- Shefrin, H. & Statman, M. (1985). "The Disposition to Sell Winners Too Early
  and Ride Losers Too Long." *Journal of Finance*, 40(3), 777-790.
- Odean, T. (1998). "Are Investors Reluctant to Realize Their Losses?" *Journal
  of Finance*, 53(5), 1775-1798.

#### B-3: Disposition Effect Coefficient

```
DE = PGR - PLR

PGR = Realized_Gains / (Realized_Gains + Unrealized_Gains)
PLR = Realized_Losses / (Realized_Losses + Unrealized_Losses)

Disposition Effect: DE > 0
  --> Investors realize gains too quickly and hold losses too long
```

#### B-3 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| DE | Disposition effect | Difference between gain and loss realization propensities | dimensionless | [-1, 1] | Trade data |
| PGR | Proportion gains realized | Fraction of available gains realized | dimensionless | [0, 1] | Investor-level trade data |
| PLR | Proportion losses realized | Fraction of available losses realized | dimensionless | [0, 1] | Investor-level trade data |

#### B-3 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| Volume-based proxy | volume_at_support / avg_volume - 1 | [D] | High (requires volume at price level) | Odean (1998) proxy | `core_data/24_behavioral_quantification.md` S2 |

#### B-3 System Mapping

```
Provenance chain:
  Shefrin & Statman (1985) --> Odean (1998) empirical confirmation
    --> core_data/04_psychology.md S1.3 (disposition effect basics)
    --> core_data/24_behavioral_quantification.md S2 (volume proxy formula)
    --> core_data/18_behavioral_market_microstructure.md S5 (order book expression)
    --> js/signalEngine.js:applySRProximityBoost()
        Practical proxy: S/R proximity-based signal strength adjustment
        Support = accumulated loss-aversion-driven selling pressure
        Resistance = accumulated gain-realization selling pressure
    --> Full volume-based disposition measurement NOT implemented
        Requires investor-level trade data (pending Koscom transition)
```

**Technical analysis implications:**
| Pattern/Level | Disposition Mechanism | Effect |
|-------------|---------------------|--------|
| Support lines | Loss holders resist selling (loss aversion) | Selling pressure accumulates gradually |
| Resistance lines | Profit holders eager to realize (gain realization) | Creates ceiling |
| Three White Soldiers breaking resistance | Buying overcomes disposition selling | High conviction signal |
| Volume surge at support | Measures disposition-driven selling pressure | Higher volume = more losses realized |

---

### 2.4.4 LSV Herding Measure -- Formula B-4

**Citation:** Lakonishok, J., Shleifer, A. & Vishny, R. W. (1992). "The Impact
of Institutional Trading on Stock Prices." *Journal of Financial Economics*,
32(1), 23-43.

#### B-4: LSV Herding Measure

```
H_{i,t} = |p_{i,t} - E[p_t]| - E[|p_{i,t} - E[p_t]|]

p_{i,t} = B_{i,t} / (B_{i,t} + S_{i,t})    (buy proportion for stock i in period t)
E[p_t] = overall buy proportion across all stocks in period t
```

#### B-4 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| H_{i,t} | Herding measure | Excess clustering of trades in stock i | dimensionless | (-inf, +inf) | Computation |
| p_{i,t} | Buy proportion | Fraction of institutional trades that are buys | dimensionless | [0, 1] | Trade data |
| E[p_t] | Expected buy proportion | Cross-sectional average buy proportion | dimensionless | [0, 1] | Trade data |
| B_{i,t} | Buy count | Number of institutional buy trades | integer | [0, +inf) | Investor-type data |
| S_{i,t} | Sell count | Number of institutional sell trades | integer | [0, +inf) | Investor-type data |

#### B-4 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| (none) | -- | -- | -- | LSV (1992) | Not currently implemented |

#### B-4 System Mapping

```
Provenance chain:
  Lakonishok, Shleifer & Vishny (1992)
    --> core_data/24_behavioral_quantification.md S3 (KRX simplified LSV)
    --> core_data/19_social_network_effects.md S5.1 (LSV index)
    --> NOT IMPLEMENTED in JS/Python
    --> Requires investor-type trade data (개인/기관/외국인 순매수)
    --> Data source: Koscom API (pending transition from Kiwoom)
    --> core_data/24 notes: "현재 제약: 투자주체별 거래 데이터 미보유"
```

**KRX context:** Korean market LSV herding is documented to be significantly
stronger for retail investors than for institutions or foreigners, with
amplification during crises (Kim & Wei 2002). KOSDAQ shows stronger herding
than KOSPI due to higher retail participation.

---

### 2.4.5 CSAD Herding Index -- Formula B-5

**Citation:** Chang, E. C., Cheng, J. W. & Khorana, A. (2000). "An Examination
of Herd Behavior in Equity Markets: An International Perspective." *Journal of
Banking & Finance*, 24(10), 1651-1679.

#### B-5: CSAD Herding Regression

```
CSAD_t = (1/N) * SUM_i |R_{i,t} - R_{m,t}|

CSAD_t = alpha + gamma_1 * |R_{m,t}| + gamma_2 * R_{m,t}^2 + epsilon_t

Under rational pricing (EMH):
  gamma_2 >= 0  (dispersion increases at least linearly with market moves)

Under herding:
  gamma_2 < 0   (stocks move together, REDUCING cross-sectional dispersion)
  gamma_2 < 0 is THE herding signature
```

#### B-5 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| CSAD_t | Cross-sectional absolute deviation | Average absolute deviation of stock returns from market | decimal | [0, +inf) | All stock returns |
| R_{i,t} | Stock return | Individual stock return | decimal | (-inf, +inf) | OHLCV |
| R_{m,t} | Market return | Market index return | decimal | (-inf, +inf) | KOSPI/KOSDAQ |
| gamma_1 | Linear sensitivity | Normal dispersion response | dimensionless | [0, +inf) | OLS |
| gamma_2 | Herding coefficient | Quadratic term; negative = herding | dimensionless | (-inf, 0) if herding | OLS |

#### B-5 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| Korean gamma_2 (normal) | -0.0008 to -0.0015 | [B] | -- | Chang et al. (2000); Park et al. (2025) | Not implemented |
| Korean gamma_2 (crisis) | > -0.0030 | [B] | -- | Extreme herding episodes | Not implemented |
| US gamma_2 | -0.0002 to -0.0005 | [B] | -- | ~1/3 of Korean level | Not implemented |

#### B-5 System Mapping

```
Provenance chain:
  Chang, Cheng & Khorana (2000)
    --> core_data/19_social_network_effects.md S5.2 (CCK CSAD model)
    --> core_data/04_psychology.md S3 (herd behavior general)
    --> NOT IMPLEMENTED directly in JS
    --> Partial proxy: appWorker.js VIX/VKOSPI spike dampening
        (crisis periods when herding invalidates individual patterns)
    --> Partial proxy: appWorker.js 4-regime RORO model
        (crisis regime implicitly captures herding episodes)
```

**KRX herding characteristics (empirical):**

| Feature | KRX | NYSE |
|---------|-----|------|
| Retail trading share | ~60-70% | ~20-30% |
| Herding intensity (gamma_2) | 2-3x stronger | Baseline |
| Crisis amplification | Severe (1997, 2008, 2020) | Present but less extreme |
| Chaebol effect | Institutional herding in affiliates | N/A |
| Social media amplification | Naver/Kakao-driven cascades | Reddit (GameStop etc.) |

**Sources:** Kim & Wei (2002), Choi & Sias (2009), Park et al. (2025)

---

### 2.4.6 Kyle Lambda (Price Impact) -- Formula B-6

**Citation:** Kyle, A. S. (1985). "Continuous Auctions and Insider Trading."
*Econometrica*, 53(6), 1315-1335.

#### B-6: Kyle Lambda

```
Delta_P = lambda * Q

lambda = sigma_v / (sigma_v + sigma_u)

sigma_v: information value volatility (precision of informed trader's signal)
sigma_u: noise trading volume (uninformed order flow standard deviation)
```

#### B-6 Symbol Table

| Symbol | Name | Definition | Unit | Range | Source |
|--------|------|-----------|------|-------|--------|
| Delta_P | Price impact | Price change per unit order flow | KRW/unit | (0, +inf) | Market observation |
| lambda | Kyle lambda | Price impact coefficient | KRW/unit | (0, 1) | Model parameter |
| Q | Order flow | Net signed order flow (buy - sell) | units | (-inf, +inf) | Market data |
| sigma_v | Info volatility | SD of informed trader's value signal | KRW | (0, +inf) | Unobservable |
| sigma_u | Noise volume | SD of uninformed (noise) trading | units | (0, +inf) | Market data proxy |

#### B-6 Constants Table

| Constant | Value | Grade | Sensitivity | Academic Source | JS/Python Location |
|----------|-------|-------|-------------|----------------|-------------------|
| KRX_SLIPPAGE | 0.10% | [C] | Medium (underestimates KOSDAQ small by 4-10x) | Amihud (2002) ILLIQ calibrated for KOSPI large | `backtester.js` line 20: `KRX_SLIPPAGE = 0.10` |
| Adaptive slippage (KOSPI large) | 0.04% | [C] | Segment-specific | Amihud (2002) | `backtester.js:_getAdaptiveSlippage()` line 32 |
| Adaptive slippage (KOSPI mid) | 0.10% | [C] | Segment-specific | Amihud (2002) | `backtester.js:_getAdaptiveSlippage()` line 33 |
| Adaptive slippage (KOSDAQ large) | 0.15% | [C] | Segment-specific | Amihud (2002) | `backtester.js:_getAdaptiveSlippage()` line 34 |
| Adaptive slippage (KOSDAQ small) | 0.25% | [C] | Segment-specific | Amihud (2002) | `backtester.js:_getAdaptiveSlippage()` line 35 |

#### B-6 System Mapping

```
Provenance chain:
  Kyle (1985) continuous auction model
    --> core_data/18_behavioral_market_microstructure.md S1 (Kyle model + behavioral extension)
    --> core_data/18 S3.1 (Amihud ILLIQ as practical lambda proxy)
    --> js/backtester.js:KRX_SLIPPAGE=0.10% (simplified constant)
    --> js/backtester.js:_getAdaptiveSlippage() lines 26-37 (ILLIQ-based segment adjustment)
    --> js/backtester.js:_horizonCost() lines 39-48 (horizon-adjusted costs)
        fixedCost = (commission + tax) / h
        variableCost = slippage / sqrt(h)  -- Kyle (1985) sqrt scaling
    --> js/indicators.js:calcAmihudILLIQ() (canonical ILLIQ computation)
    --> js/appWorker.js:_updateMicroContext() (ILLIQ for confidence discount)
    --> js/appWorker.js:_applyMicroConfidenceToPatterns() (liquidity discount [0.80, 1.15])
```

**Horizon cost decomposition (backtester.js lines 39-48):**
```
Fixed cost (tax + commission = 0.21%): 1/h scaling (amortized over holding period)
Variable cost (slippage = 0.10%): 1/sqrt(h) scaling (Kyle 1985 market impact)

Examples:
  h=1:  0.21/1 + 0.10/1     = 0.31%
  h=5:  0.21/5 + 0.10/2.24  = 0.087%
  h=20: 0.21/20 + 0.10/4.47 = 0.033%
```

**Behavioral extension (Doc 18 S1.2):** Loss-averse informed traders (prospect
theory B-1 interaction) exploit information more aggressively, accelerating
price convergence: `lambda_b = lambda * (1 + k * PI(loss_aversion))`.

---

### 2.4.7 Overreaction and Underreaction

#### Long-Term Overreaction

**Citation:** DeBondt, W. F. M. & Thaler, R. (1985). "Does the Stock Market
Overreact?" *Journal of Finance*, 40(3), 793-805.

```
Extreme losers (past 3-5 years) subsequently outperform
Extreme winners (past 3-5 years) subsequently underperform
Mechanism: investor overreaction to bad/good news --> overshooting --> mean reversion
```

**System mapping:** `core_data/24_behavioral_quantification.md` S4:
"장기 과잉반응 (DeBondt-Thaler 1985): moveATR > 3 --> mw 감쇠 (이미 구현)"

#### Short-Term Underreaction (Momentum)

**Citation:** Jegadeesh, N. & Titman, S. (1993). "Returns to Buying Winners
and Selling Losers." *Journal of Finance*, 48(1), 65-91.

```
Winners (past 3-12 months) continue to outperform for next 3-12 months
Mechanism: investor underreaction to new information --> gradual price adjustment
Historical alpha: ~1% per month (US)
```

**System mapping:** Momentum factor in MRA 17-column Ridge regression (col 13).
Technical trend-following is interpretable as momentum factor exposure.

---

### 2.4.8 Anchoring and S/R Psychology

**Citation:** Tversky, A. & Kahneman, D. (1974). "Judgment under Uncertainty:
Heuristics and Biases." *Science*, 185(4157), 1124-1131.

```
Financial anchors creating S/R levels:
  1. 52-week high/low        --> major S/R   **[V7 구현됨: patterns.js:3444-3489, SR_52W_* constants]**
  2. Previous close           --> next-day reference point
  3. Moving averages          --> dynamic anchors
  4. Round numbers (10,000)   --> clustering
  5. IPO price                --> long-term anchor

S/R strength (anchoring-adjusted):
  R_strength = SUM_i V_i * w(P_anchor - P_i)
  V_i: volume at price level i
  w(): proximity weight (inverse distance from anchor)
```

**System mapping:**
- `patterns.js` S/R detection: ATR*0.5 tolerance clustering, min 2 touches, max 10
- `signalEngine.js:applySRProximityBoost()`: confidence boost at S/R confluence
- KRX tick-size boundaries (1,000/5,000/10,000/50,000 KRW): artificial S/R

**V7 Implementation Note:** `patterns.js` `_detectSupportResistance()` lines 3444-3489 now implements the 52-week high/low anchor as S/R levels with confluence merge. George & Hwang (2004) demonstrated that 52-week price proximity explains ~70% of individual stock momentum returns through anchoring bias (Tversky & Kahneman 1974). Constants: `SR_52W_STRENGTH=0.8`, `SR_52W_TOUCHES=3`, `SR_52W_MIN_BARS=60`, `SR_52W_WINDOW=252`.

---

### 2.4.9 Market Emotion Cycle

```
Optimism --> Excitement --> Euphoria --> Anxiety --> Denial
--> Fear --> Despair --> Depression --> Hope --> Relief --> Optimism
```

| Phase | RSI | MACD | Bollinger | Pattern |
|-------|-----|------|-----------|---------|
| Optimism/Excitement | 60-80 | Positive, expanding | Upper band approach | Three White Soldiers |
| Euphoria | 80+ | Maximum | Upper breach | -- (unsustainable) |
| Anxiety/Denial | 70->50 | Positive, contracting | Mean reversion | Doji |
| Fear/Despair | 20-30 | Negative, expanding | Lower breach | Three Black Crows |
| Depression | <20 | Minimum | At lower band | Hammer |
| Hope/Relief | 30->50 | Negative, contracting | Mean reversion | Bullish Engulfing |

**System mapping:** `signalEngine.js` RSI overbought/oversold + MACD crossover
signals correspond to transitions in this emotion cycle.

---

### 2.4.10 Information Cascades

**Citation:** Bikhchandani, S., Hirshleifer, D. & Welch, I. (1992). "A Theory
of Fads, Fashion, Custom, and Cultural Change as Informational Cascades."
*Journal of Political Economy*, 100(5), 992-1026.

```
Cascade formation: when 2-3 agents choose the same action,
  subsequent agents ignore private signals --> cascade
Volume surge + trend = information cascade in progress
Three White Soldiers = buy cascade visual
Three Black Crows = sell cascade visual
```

**System mapping:** `patternEngine` quality scoring uses volume confirmation
(volume above average at pattern formation) as cascade evidence, strengthening
pattern reliability.

**Source:** core_data/19_social_network_effects.md S1 (cascade theory),
core_data/04_psychology.md S3.1 (financial cascades)

---

### 2.4.11 Cross-Cultural Behavioral Finance: KRX Specifics

**Citation:** Kim, W. & Wei, S.-J. (2002). "Foreign Portfolio Investors Before
and During a Crisis." *Journal of International Economics*, 56(1), 77-96.

| Characteristic | KRX Evidence | Citation |
|---------------|-------------|----------|
| Strong retail herding | Individual herding significantly > institutional/foreign | Kim & Wei (2002) |
| Confucian risk attitude | Lower perceived risk for same objective risk ("cushion hypothesis") | Weber & Hsee (1998) |
| Chaebol disposition effect | Disposition pronounced in large chaebol stocks | Choi & Sias (2009) |
| Crisis herding amplification | Herding spikes during crises (1997, 2008, 2020) | Kim & Wei (2002) |

```
Parameter calibration implications:
  - Western prospect theory: lambda = 2.25, alpha = 0.88
  - KRX considerations:
    - Retail dominance may amplify herding by 1.3-1.5x
    - Individual trading share: KRX ~60-70% vs NYSE ~20-30%
    - Korean-specific lambda/alpha: insufficient academic research
    - Recommendation: range-based approach (Wakker 2010), pending Korean data
```

**Source:** core_data/04_psychology.md S4B (cross-cultural behavioral finance)

---

## Appendix A: Implementation Correctness Audit

| Component | Status | Notes |
|-----------|--------|-------|
| `calcCAPMBeta()` OLS formula | CORRECT | `Cov(r_i, r_m) / Var(r_m)` using excess returns |
| Scholes-Williams correction | CORRECT | `(betaLag + beta0 + betaLead) / (1 + 2*rhoM)`; trigger at >10% zero-volume days |
| Jensen's Alpha annualization | CORRECT | `alphaFinal * 250` consistent with 250 trading days |
| Excess return formulation | CORRECT | Both stock and market returns subtract `rfDaily` before regression |
| FF3 excess return | CORRECT | `ri = (close - prev) / prev - rfDaily` before regressing on factors |
| R-squared computation | CORRECT | Uses SW-corrected beta for R^2; recomputes alpha for consistency |
| Blume shrinkage formula | CORRECT | `0.67 * beta_final + 0.33 * 1.0` (shrinks toward 1.0) |
| Blume V5 documentation | **CORRECTED** | V5 stated 0.343 + 0.677; V6 corrects to match code (0.33 + 0.67) |
| EVA formula | CORRECT | `NOPAT - WACC * IC` in `compute_eva.py` |
| EVA seed guard | CORRECT | seed/demo data sources rejected (no fake EVA) |
| ILLIQ confidence discount | CORRECT | `appWorker.js` applies discount with [0.80, 1.15] clamp |
| Horizon cost decomposition | CORRECT | Fixed: 1/h, Variable: 1/sqrt(h) per Kyle (1985) |
| Alpha significance threshold | CORRECT | |t| > 2.0 for ~95% confidence (line 267) |
| R_f fallback chain | CORRECT | macro_latest --> bonds_latest --> 3.5% (consistent across scripts) |

---

## Appendix B: Identified Deviations and Corrections

| Issue | Severity | Description | Recommendation | Status |
|-------|----------|------------|----------------|--------|
| Blume coefficient discrepancy | MEDIUM | V5 doc used 0.343/0.677; code uses 0.67/0.33 (shrink toward 1.0) | **CORRECTED in V6** -- document now matches code | FIXED |
| KRX_SLIPPAGE constant | LOW | Fixed 0.10% for all stocks; KOSDAQ small caps need 0.20-0.50% | Partially fixed: `_getAdaptiveSlippage()` exists but requires `illiq_spread` data | PARTIAL |
| Zero-Beta CAPM not implemented | INFO | Current alpha uses standard CAPM baseline; KRX short-selling bans suggest ZB-CAPM | Future: estimate E[R_z] from low-beta stock returns | TODO |
| CSAD herding measure | INFO | Not implemented in JS; captured indirectly via macro dampening | Requires cross-sectional daily data in Worker | TODO |
| Disposition factor | INFO | Volume-based measurement not implemented; requires investor-level data | Pending Koscom real-time data transition | TODO |
| Korean lambda/alpha calibration | INFO | Prospect theory uses Western estimates | Long-term: academic partnership or KRX trade data estimation | TODO |
| Fear-Greed weights uncalibrated | MEDIUM | All weights are [D]-grade initial guesses | Requires KRX backtesting for weight optimization | TODO |

---

## Appendix C: Full Cross-Reference Index

| Theory | Formula | Primary Doc | Code File | Function/Variable | UI Element |
|--------|---------|-----------|-----------|-------------------|-----------|
| EMH | -- | Doc 05 S1 | `indicators.js` | `calcHurst()` | -- |
| AMH | -- | Doc 05 S6 | `backtester.js` | WLS lambda=0.995 | -- |
| MPT | -- | Doc 05 S2 | -- | Conceptual | -- |
| CAPM | F-1 | Doc 05 S3, Doc 25 S1 | `indicators.js`, `compute_capm_beta.py` | `calcCAPMBeta()` | `fin-beta` |
| APT | F-2 | Doc 23, Doc 42 S6 | `backtester.js`, `mra_apt_extended.py` | 17-col Ridge | -- |
| FF3 | F-3 | Doc 05 S4, Doc 23 S3 | `financials.js`, `ff3_factors.py` | `_renderFF3Factors()` | `fin-smb`, `fin-hml` |
| Jensen's Alpha | F-4 | Doc 05 S3.2, Doc 25 | `backtester.js`, `compute_capm_beta.py` | `_calcJensensAlpha()` | `fin-alpha-sig` |
| Scholes-Williams | F-5 | Doc 25 S2 | `indicators.js`, `compute_capm_beta.py` | `calcCAPMBeta()` lines 433-458 | (within beta) |
| Blume Shrinkage | F-6 | Doc 25 S9.3 | `compute_capm_beta.py` | `betaBlume` | `fin-blume-beta` |
| Sharpe Ratio | F-7 | Doc 05 S7.3 | `backtester.js` | Implicit (reliability) | -- |
| WACC | F-8 | Doc 14 S2.3 | `compute_eva.py` | WACC computation | (within EVA) |
| EVA | F-9 | Doc 14 S2.8 | `financials.js`, `compute_eva.py` | `_renderEVA()` | `fin-eva-spread` |
| Zero-Beta CAPM | -- | Doc 42 S3 | -- | Not implemented | -- |
| ICAPM | -- | Doc 42 S4 | `appWorker.js` | Macro factor pipeline | -- |
| CCAPM | -- | Doc 42 S5 | -- | KOSIS CCI proxy only | -- |
| BSM | -- | Doc 05 S5, Doc 45 | `compute_options_analytics.py` | Straddle implied move | -- |
| MM Theorems | -- | Doc 14 S3, Doc 43 S1 | -- | Conceptual (WACC basis) | -- |
| Prospect Theory | B-1 | Doc 04 S1 | -- | Conceptual (S/R basis) | -- |
| Fear-Greed KRX | B-2 | Doc 24 S1 | -- | Not implemented | -- |
| Disposition Effect | B-3 | Doc 04 S1.3, Doc 24 S2 | `signalEngine.js` | `applySRProximityBoost()` | -- |
| LSV Herding | B-4 | Doc 24 S3 | -- | Not implemented | -- |
| CSAD Herding | B-5 | Doc 19 S5.2 | `appWorker.js` | Indirect: macro dampening | -- |
| Kyle Lambda | B-6 | Doc 18 S1 | `backtester.js` | `KRX_SLIPPAGE`, `_getAdaptiveSlippage()` | -- |
| Overreaction | -- | Doc 04 S5.2, Doc 24 S4 | `backtester.js` | moveATR > 3 dampening | -- |
| Anchoring | -- | Doc 04 S2.2 | `patterns.js` | S/R clustering + 52-week anchor (V7) | George & Hwang (2004) |
| ILLIQ | -- | Doc 18 S3.1 | `indicators.js`, `appWorker.js` | `calcAmihudILLIQ()` | -- |
| EWMA Vol | -- | Doc 05 S8 | `backtester.js` | `_buildRLContext()` | -- |
| Merton DD | -- | Doc 35 S6 | `compute_capm_beta.py` | `compute_dd()` | `fin-dd` |

---

### References Added in V7

- George, T.J. & Hwang, C.-Y. (2004). "The 52-Week High and Momentum Investing." *Journal of Finance*, 59(5), 2145-2176.

*End of S2 Sections 2.3-2.4 (V7)*
*Total formulas annotated: 15 (F-1 through F-9, B-1 through B-6)*
*Total cross-references: 31 theory-to-code mappings*
*Identified and corrected: 1 formula discrepancy (Blume coefficients)*
