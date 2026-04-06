# Stage 2 -- Section 2.7: Derivatives Theory

## Document Metadata

| Field | Value |
|-------|-------|
| Section | 2.7 |
| Title | Derivatives Theory -- Options, Volatility, Futures, Investor Flow |
| Author | Derivatives Expert Agent |
| Date | 2026-04-06 |
| Sources | Doc 26, 27, 36, 37, 38, 39, 40, 45, 46 |
| Implementation | `appWorker.js`, `signalEngine.js`, `compute_options_analytics.py`, `compute_basis.py` |
| Status | Complete |

---

## 7A. Options Pricing

### 7A.1 Black-Scholes-Merton (1973)

The foundational options pricing model assumes geometric Brownian motion for the underlying asset under the risk-neutral measure Q.

**Call Option Price:**

```
C = S * e^(-qT) * N(d1) - K * e^(-rT) * N(d2)
```

**Put Option Price:**

```
P = K * e^(-rT) * N(-d2) - S * e^(-qT) * N(-d1)
```

**d1 and d2:**

```
d1 = [ln(S/K) + (r - q + sigma^2 / 2) * T] / (sigma * sqrt(T))
d2 = d1 - sigma * sqrt(T)
```

**Variable Annotation:**

| Symbol | Name | Unit | Typical Range (KRX) |
|--------|------|------|---------------------|
| S | Spot price (underlying current price) | KRW (index points for KOSPI200) | KOSPI200: 250-450 pt |
| K | Strike price | Same as S | 2.5 pt intervals for KOSPI200 |
| r | Risk-free rate (continuous compounding) | Annualized decimal | 0.030-0.040 (KTB 3Y) |
| q | Continuous dividend yield | Annualized decimal | 0.015-0.025 (KOSPI200) |
| T | Time to expiry | Years | 0.003-0.25 (1 day to 3 months) |
| sigma | Volatility | Annualized decimal | 0.10-0.50 (10%-50%) |
| N() | Standard normal CDF | Dimensionless | [0, 1] |

**Constant Annotation:**

| Constant | Value | Grade | Justification | JS Location |
|----------|-------|-------|---------------|-------------|
| DIVIDEND_YIELD | 0.017 | [C] | KOSPI200 historical avg ~1.7% p.a. | `compute_options_analytics.py` L52 |
| DEFAULT_RF | 0.035 | [C] | Fallback when KTB 3Y unavailable | `compute_options_analytics.py` L53 |

**Implementation:** `scripts/compute_options_analytics.py` function `_bs_price()` (L62-84). Uses Merton (1973) continuous-dividend extension with `q = DIVIDEND_YIELD`. Risk-free rate sourced from `data/macro/bonds_latest.json` (KTB 3Y yield), with 3.5% fallback.

**BSM Assumptions vs KRX Reality:**

| BSM Assumption | KRX Reality | Violation Severity |
|----------------|-------------|-------------------|
| Continuous trading | 09:00-15:30 KST, overnight gaps | Medium |
| Constant volatility sigma | Volatility clustering, GARCH effects | Severe |
| Log-normal returns | +/-30% price limits truncate tails | Severe |
| No transaction costs | Securities tax 0.18% + commission ~0.03% | Medium |
| Free short selling | KRX short-sale restrictions (2023-2025 ban, partial lift) | Severe |
| Constant r | BOK base rate changes | Minor |

Source: Doc 26 S1, Black & Scholes (1973), Merton (1973).

### 7A.2 Greeks

Greeks are partial derivatives of the option price with respect to model parameters. All formulas below use the Merton extension (with continuous dividend yield q).

**Delta -- Directional Sensitivity:**

```
Call:  Delta_C = dC/dS = e^(-qT) * N(d1)       in [0, 1]
Put:   Delta_P = dP/dS = e^(-qT) * (N(d1) - 1) in [-1, 0]
```

| Variable | Description |
|----------|-------------|
| Delta_C | Change in call price per 1-unit change in S |
| N(d1) | Probability proxy for finishing ITM (risk-neutral) |

ATM approximation: Delta ~= 0.50 for calls, ~= -0.50 for puts.

**Implementation:** `compute_options_analytics.py` function `_bs_delta()` (L136-148). Used to classify options by 25-delta moneyness for skew calculation.

**Gamma -- Convexity / Acceleration:**

```
Gamma = d^2C/dS^2 = dDelta/dS = e^(-qT) * N'(d1) / (S * sigma * sqrt(T))

N'(x) = (1/sqrt(2*pi)) * e^(-x^2/2)    (standard normal PDF)
```

| Variable | Description |
|----------|-------------|
| Gamma | Rate of change of Delta per 1-unit change in S |
| N'(d1) | Standard normal density at d1 |

Properties: Maximized at ATM; increases sharply near expiry ("gamma risk"). Identical for calls and puts at same strike.

**Theta -- Time Decay:**

```
Theta_C = dC/dt = -[S * e^(-qT) * N'(d1) * sigma / (2*sqrt(T))]
                  - r * K * e^(-rT) * N(d2) + q * S * e^(-qT) * N(d1)
```

BSM PDE relationship: `Theta + 0.5 * sigma^2 * S^2 * Gamma + r * S * Delta = r * C`

This implies a Gamma-Theta tradeoff: high Gamma entails high Theta decay.

**Vega -- Volatility Sensitivity:**

```
Vega = dC/dsigma = S * e^(-qT) * sqrt(T) * N'(d1)
```

**Implementation:** `compute_options_analytics.py` function `_bs_vega()` (L87-93). Used as the denominator in Newton-Raphson IV iteration. Guard: returns 0.0 when T <= 0 or sigma <= 0. Convergence guard: `vega < 1e-12` breaks the iteration loop.

Properties: Maximized at ATM; larger for longer-dated options. Identical for calls and puts at same strike (follows from put-call parity).

**Rho -- Interest Rate Sensitivity:**

```
Rho_C = dC/dr = K * T * e^(-rT) * N(d2)
```

KRX practical note: For short-dated (1-3 month) pattern analysis, Rho's contribution is negligible (~0.013% daily, per Doc 25 S1.3).

**Higher-Order Greeks (reference only -- not implemented):**

| Greek | Formula | Interpretation |
|-------|---------|----------------|
| Vanna | dDelta/dsigma = dVega/dS | Delta sensitivity to volatility changes |
| Volga | d^2C/dsigma^2 = dVega/dsigma | Vol-of-vol sensitivity |
| Charm | dDelta/dT | Delta drift over time |

Higher-order Greeks are critical for KOSPI200 options market makers but are not computed in CheeseStock's equity pattern analysis pipeline.

Source: Doc 26 S1.2, Hull (2021).

### 7A.3 Implied Volatility Extraction

Implied Volatility (IV) is the value of sigma that makes the BSM model price equal the observed market price. No analytical inverse exists; numerical iteration is required.

**Newton-Raphson Method:**

```
sigma_{n+1} = sigma_n - [C_BSM(sigma_n) - C_market] / Vega(sigma_n)

Initial guess (Brenner-Subrahmanyam 1988):
  sigma_0 = C_market / (0.4 * S * sqrt(T))

Convergence criterion: |C_BSM(sigma_n) - C_market| < NEWTON_TOL
```

**Constant Annotation:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| NEWTON_MAX_ITER | 50 | [A] | Standard practice; typically converges in 3-5 iterations | `compute_options_analytics.py` L54 |
| NEWTON_TOL | 1e-6 | [A] | Sub-cent precision for index options | `compute_options_analytics.py` L55 |
| IV_LOWER | 0.01 (1%) | [B] | Floor to prevent negative/zero sigma | `compute_options_analytics.py` L56 |
| IV_UPPER | 3.0 (300%) | [B] | Ceiling; KOSPI200 options rarely exceed 200% | `compute_options_analytics.py` L57 |

**Implementation:** `compute_options_analytics.py` function `implied_volatility()` (L96-133).

Step 1: Brenner-Subrahmanyam initial guess, clamped to [IV_LOWER, IV_UPPER].
Step 2: Newton-Raphson loop up to NEWTON_MAX_ITER iterations.
Step 3: If final error < NEWTON_TOL * 10, return last sigma; else return None (convergence failure).

Guard: `vega < 1e-12` breaks loop (deep ITM/OTM where Vega is near zero -- NR would produce unbounded steps).

**IV Sanity Check:** Valid KOSPI200 option IV should satisfy 5% < IV < 200%. Values outside this range should be flagged as suspect. The implementation uses a broader [1%, 300%] band to avoid false rejections of crisis-period options.

**IV vs HV Interpretation:**

```
HV = sigma_realized = sqrt(252 * Var(r_daily))    -- past realized volatility
IV = sigma_implied                                  -- market's forward expectation

IV/HV > 1.3: Market overestimates future vol (fear premium)
              --> Option selling strategies favored; mean-reversion patterns favored
IV/HV ~= 1.0: Equilibrium
IV/HV < 0.8: Market underestimates vol (complacency)
              --> Breakout patterns warrant attention; option buying favored
```

Source: Doc 26 S2.1, Brenner & Subrahmanyam (1988).

### 7A.4 IV Surface and SVI Parameterization

The IV surface sigma(K, T) is a 2D function mapping strike K and time-to-expiry T to implied volatility. For KOSPI200 options: ~20-30 strikes (2.5pt spacing) x 4-8 expiries (weekly/monthly/quarterly).

**SVI Raw Parameterization (Gatheral 2004, 2006):**

```
w(k) = a + b * [rho * (k - m) + sqrt((k - m)^2 + sigma_svi^2)]
```

| Parameter | Name | Range | Interpretation |
|-----------|------|-------|----------------|
| w(k) | Total implied variance = sigma_IV^2 * T | >= 0 | Variance surface value |
| k | Log-moneyness = ln(K/F) | R | Centered on ATM forward |
| a | Variance level | R | Overall IV level |
| b | Variance slope | >= 0 | Wing steepness |
| rho | Asymmetry / rotation | [-1, 1] | Skew direction (rho < 0 = downside skew) |
| m | Translation | R | Vertex location |
| sigma_svi | ATM curvature | > 0 | Smoothness of vertex |

**Theoretical Foundation:** SVI is inspired by the Heston (1993) stochastic volatility model. Under Heston, the long-maturity total implied variance converges to the SVI form:

```
w(k) --> theta + xi^2/(2*kappa) * [rho_H * k + sqrt(k^2 + xi^2*(1-rho_H^2)/(4*kappa^2))]
```

This convergence gives SVI its theoretical grounding: it is not merely an empirical fit, but a parameterization with a stochastic volatility model foundation.

**No-Arbitrage Conditions:**

1. Butterfly spread (strike direction): `g(k) = (1 - k*w'/(2w))^2 - w'/4*(1/w + 1/4) + w''/2 >= 0`
2. Calendar spread (maturity direction): `w(k, T2) >= w(k, T1)` for T2 > T1
3. Roger Lee (2004) wing slope upper bound: `b*(1 + |rho|) <= 4`
4. Non-negative minimum variance: `a + b*sigma_svi*sqrt(1 - rho^2) >= 0`

**KOSPI200 IV Surface Stylized Facts:**

- Persistent negative skew: OTM put IV > ATM IV > OTM call IV (typical rho = -0.3 to -0.5)
- Foreign positioning effect: foreign call selling + put buying widens skew
- Near-expiry skew instability: SVI fitting residuals increase 3-5x within 1 week of expiry
- Price limit (+/-30%) effect: truncates extreme OTM option IV, biases SVI wing parameters

Source: Doc 37 S2, Gatheral (2006), Gatheral & Jacquier (2014).

### 7A.5 25-Delta Skew

The 25-delta risk reversal measures the asymmetry of the IV surface:

```
Skew_25d = IV(25-delta Put) - IV(25-delta Call)
```

| Metric | Description |
|--------|-------------|
| 25-delta Put | OTM put with N(d1) = -0.25 |
| 25-delta Call | OTM call with N(d1) = +0.25 |

**KRX Ranges:**

| Range | Interpretation |
|-------|----------------|
| Skew_25d = 3-7%p | Normal (standard crash premium) |
| Skew_25d > 15%p | Crisis (COVID 2020.03, geopolitical 2026.03) |

**Implementation:** `compute_options_analytics.py` L315-333. Finds puts/calls nearest to +/-0.25 delta from the computed delta values, then computes the IV difference.

Source: Doc 26 S2.2, Doc 37 S3.2, Bates (2000).

### 7A.6 Put-Call Parity

Put-call parity is the "first law of thermodynamics" for options -- the fundamental no-arbitrage relationship:

```
C - P = S * e^(-qT) - K * e^(-rT)
```

**Validation Use:** Any computed option chain must satisfy this identity within transaction cost bounds. Violations indicate either data errors or arbitrage opportunities (conversion/reversal).

**Practical Tolerance (KRX):**

```
|C - P - (S*e^(-qT) - K*e^(-rT))| < 2 * transaction_cost

transaction_cost ~= 0.21% (tax 0.18% + commission 0.03%)
```

Source: Doc 45 S3, Hull (2021).

### 7A.7 CRR Binomial Tree (Reference)

Cox-Ross-Rubinstein (1979) provides the discrete-time foundation for options pricing, converging to BSM as the number of steps N increases.

```
u = e^(sigma * sqrt(dt))        -- up factor
d = 1/u = e^(-sigma * sqrt(dt)) -- down factor
p = (e^(r*dt) - d) / (u - d)    -- risk-neutral probability
dt = T / N                       -- time step

Backward induction (European):
  V(i,j) = e^(-r*dt) * [p * V(i+1,j+1) + (1-p) * V(i+1,j)]

Terminal payoff:
  Call: V(N,j) = max(S * u^j * d^(N-j) - K, 0)
  Put:  V(N,j) = max(K - S * u^j * d^(N-j), 0)
```

Not directly implemented in CheeseStock (BSM closed-form sufficient for KOSPI200 European options), but provides the conceptual foundation for understanding all pricing.

Source: Doc 45 S1, Cox, Ross & Rubinstein (1979).

---

## 7B. VKOSPI (Volatility Index)

### 7B.1 VKOSPI Calculation

VKOSPI is the Korean "fear index," applying the CBOE VIX methodology (Whaley 2009) to KOSPI200 options. It is model-free (does not depend on BSM assumptions).

**Formula:**

```
VKOSPI = 100 * sqrt[(2/T) * SUM_i (dK_i / K_i^2) * e^(rT) * Q(K_i)
                     - (1/T) * (F/K0 - 1)^2]
```

| Variable | Description |
|----------|-------------|
| T | Time to expiry (annualized) |
| F | Forward price = K0 + e^(rT) * [C(K0) - P(K0)] |
| K0 | First strike below the forward price |
| K_i | i-th strike price |
| dK_i | (K_{i+1} - K_{i-1}) / 2 (average spacing) |
| Q(K_i) | Mid-quote of OTM option: put if K < K0, call if K > K0, average at K0 |
| r | Risk-free rate |

The index interpolates between near-month and next-month expiries to produce exactly 30-calendar-day implied volatility.

**Data Source:** `data/vkospi.json` -- 547+ trading days of real VKOSPI data (2024-01-02 onward), loaded by `appWorker.js` and injected into `_macroLatest.vkospi`.

Source: Doc 26 S2.3, KRX (2009), CBOE VIX White Paper (2003).

### 7B.2 VIX-to-VKOSPI Proxy Factor

When VKOSPI data is unavailable (offline mode without `vkospi.json`), a proxy is used:

```
VKOSPI_proxy = VIX * VIX_VKOSPI_PROXY
```

| Constant | Value | Grade | Justification | JS Location |
|----------|-------|-------|---------------|-------------|
| VIX_VKOSPI_PROXY | 1.12 | [C] | Whaley (2009) KRX proxy; DEPRECATED fallback | `appState.js` L43, `signalEngine.js` L12 |

**FINDING: VKOSPI Proxy Factor Lacks Rigorous Empirical Validation.**

The 1.12 multiplier is attributed to "Whaley (2009) KRX proxy" but Whaley's paper primarily describes the VIX methodology, not a specific KRX scaling factor. The empirical correlation between VKOSPI and VIX is approximately 0.85 (daily, 2009-2026), but the relationship is not a simple multiplicative constant -- it varies by regime:

```
Observed VKOSPI/VIX ratio by regime:
  Normal (VIX < 20):   ratio ~= 1.0-1.1
  Elevated (VIX 20-30): ratio ~= 1.1-1.25
  Crisis (VIX > 30):    ratio ~= 1.25-1.5 (KRX-specific events can push higher)
```

The current implementation uses a regime-dependent scale in `signalEngine.js` L1802 but defaults to the flat 1.12 constant. The proxy is marked DEPRECATED with a preference for direct VKOSPI data, which is the correct approach.

**Recommendation:** Maintain the DEPRECATED status. The 547+ day VKOSPI time series should be sufficient for all practical purposes. The proxy should only fire in truly offline scenarios.

### 7B.3 Volatility Regime Classification

VKOSPI values are classified into four regimes that modulate pattern confidence adjustments:

```
VKOSPI < 15:    Low volatility regime
VKOSPI 15-22:   Normal regime
VKOSPI 22-30:   High volatility regime
VKOSPI > 30:    Crisis regime
```

| Constant | Value | Grade | Justification | JS Location |
|----------|-------|-------|---------------|-------------|
| Low threshold | 15 | [C] | KRX empirical distribution, calibrated 2026-04 | `signalEngine.js` L1808 |
| Normal-High boundary | 22 | [C] | Adjusted from academic 25 based on KRX distribution | `signalEngine.js` L1808 |
| High-Crisis boundary | 30 | [C] | Adjusted from academic 35 based on KRX distribution | `signalEngine.js` L1808 |

**Pattern Confidence Adjustment by Regime:**

| Regime | Breakout Patterns | Reversal Patterns | All Directional |
|--------|-------------------|-------------------|-----------------|
| Low (<15) | +10% | -5% | Standard |
| Normal (15-22) | Standard | Standard | Standard |
| High (22-30) | Standard | Caution (false positive increase) | x 0.85 |
| Crisis (>30) | Standard | Noise-dominated | x 0.50-0.75 |

**Implementation:** `signalEngine.js` static method `_classifyVolRegimeFromVKOSPI()` (L1789-1828). Fallback chain: `_marketContext.vkospi` --> `_macroLatest.vkospi` --> `_macroLatest.vix * VIX_VKOSPI_PROXY` (deprecated). The `_volRegimeDiscount()` method (called at L645) applies the regime multiplier to signal confidence.

Source: Doc 26 S2.3, KRX historical distribution.

### 7B.4 Volatility Risk Premium (VRP)

```
VRP = IV - RV

IV = VKOSPI (or implied volatility from options)
RV = sqrt(252 * Var(r_daily, 20-day window))   -- realized volatility
```

VRP > 0 (typical): Options are "expensive" relative to realized vol -- positive expected return from selling options (variance premium harvesting). VRP > 0 correlates with positive GEX (market stabilization).

VRP < 0 (rare): Realized vol exceeds implied vol -- markets under-pricing risk. Correlates with negative GEX and crisis episodes.

**HAR-RV Connection (Corsi 2009):**

The Heterogeneous Autoregressive model of Realized Volatility decomposes RV into daily, weekly, and monthly components:

```
RV_{t+1}^(d) = beta_0 + beta_d * RV_t^(d) + beta_w * RV_t^(w) + beta_m * RV_t^(m) + epsilon

RV_t^(d) = daily RV (1-day)
RV_t^(w) = weekly RV (5-day average)
RV_t^(m) = monthly RV (22-day average)
```

This provides the RV forecast needed for forward-looking VRP estimation. Implemented in `scripts/compute_mra.py` as part of the feature expansion (24-column model).

Source: Doc 26 S2.3, Doc 34 S2, Corsi (2009).

---

## 7C. Futures & Basis

### 7C.1 Cost-of-Carry Model

The theoretical (fair-value) futures price under continuous compounding:

```
F* = S * e^((r - d) * T)
```

| Variable | Name | Unit | Typical Range (KRX) |
|----------|------|------|---------------------|
| F* | Theoretical futures price | Index points | KOSPI200: 250-450 pt |
| S | Spot index (KOSPI200) | Index points | Same |
| r | Risk-free rate (KTB 3Y) | Annualized decimal | 0.030-0.035 |
| d | Dividend yield | Annualized decimal | 0.015-0.020 (KOSPI200) |
| T | Time to expiry | Years (T = remaining_days / 365) | 0-0.25 |

**KRX Specifics:**

- KOSPI200: r - d ~= 1.0-1.5% --> F* ~= S + S * 0.015 * T (for 3-month expiry ~= +0.375%)
- KOSDAQ150: Lower dividend yield (d ~= 0.3-0.8%) --> wider normal contango
- Fair value band: F* +/- ~15-25 bps (transaction costs), within which arbitrage is unprofitable

**Implementation:** `compute_basis.py` function `compute_fair_value()` (L81-86).

```python
def compute_fair_value(spot, rfr, div_yield, time_to_expiry_years):
    return spot * math.exp((rfr - div_yield) * time_to_expiry_years)
```

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| DIVIDEND_YIELD | 0.017 | [C] | KOSPI200 historical avg | `compute_basis.py` L26 |
| ZSCORE_WINDOW | 60 | [B] | Standard rolling window for z-score | `compute_basis.py` L27 |

Source: Doc 27 S1.1.

### 7C.2 Basis Definition and Interpretation

```
Basis = F_market - S_spot
Basis% = (F_market - S_spot) / S_spot * 100
```

**Excess Basis (pure sentiment component):**

```
Theoretical Basis = F* - S = S * (r - d) * T   (always positive with positive rates)
Excess Basis = Actual Basis - Theoretical Basis
```

| Basis State | Market Interpretation | Typical Range (KOSPI200) |
|-------------|----------------------|--------------------------|
| Basis > F* (high basis) | Institutional/foreign net buying --> bullish | +0.5% to +2.0% |
| Basis ~= F* | Neutral, no arbitrage opportunity | +/-0.3% |
| Basis < F* (low basis) | Hedge selling dominant --> bearish | -0.3% to -2.0% |
| Basis < -5% | Crisis / panic selling | 2008 GFC levels |

**Basis Convergence:**

At expiry, basis must converge to zero: `Basis_T = F_T - S_T = 0`. The convergence follows an Ornstein-Uhlenbeck process:

```
dBasis/dt = -kappa * (Basis_t - 0)

kappa increases sharply within 1 week of expiry
Practical: |Basis| < 0.3pt by 14:00 KST on expiry day
```

**Implementation:** `compute_basis.py` function `compute_basis_analysis()` (L89+). Outputs to `data/derivatives/basis_analysis.json`. The basis and basisPct values are merged into `_derivativesData` by `appWorker.js` (L452-475).

**Expiry Date Calculation:** `compute_basis.py` function `_get_next_expiry()` (L55-78) calculates the second Thursday of the month. If the current date is past this month's expiry, it rolls to next month.

Source: Doc 27 S1.2-1.3.

### 7C.3 Basis Z-Score for Signal Generation

The basis signal normalizes the current basis against its 60-day rolling distribution:

```
basis_z = (basis_t - mean(basis_{t-60})) / std(basis_{t-60})
```

This z-score is used by both `signalEngine.js` and `appWorker.js` for pattern confidence adjustment.

**Signal Thresholds in signalEngine.js:**

| Signal | Threshold | Interpretation |
|--------|-----------|----------------|
| basisContango | basis_z > +1.5 | Strong positive basis --> bullish confirmation |
| basisBackwardation | basis_z < -1.5 | Strong negative basis --> bearish confirmation |

**Implementation:** `signalEngine.js` `_detectBasisSignal()` method (L2409+). Uses `basisPct` (normalized, preferred) or absolute `basis` value. Thresholds: |basisPct| > 0.5% = normal signal, |basisPct| > 2.0% = extreme.

Source: Doc 27 S5.1, Doc 36 S3.

### 7C.4 Confidence Adjustment: Basis-Pattern Direction Alignment

The `_applyDerivativesConfidenceToPatterns()` function in `appWorker.js` (L711-825) adjusts pattern confidence based on whether the basis direction agrees with the pattern signal:

```
Basis positive (contango) + Buy pattern:  conf *= 1.05 (normal) or 1.08 (extreme)
Basis positive (contango) + Sell pattern: conf *= 0.95 (normal) or 0.92 (extreme)
Basis negative (backwardation) + Buy:     conf *= 0.95 or 0.92
Basis negative (backwardation) + Sell:    conf *= 1.05 or 1.08

Thresholds:
  basisPct normal: |basisPct| >= 0.5%,  mult = +/-5%
  basisPct extreme: |basisPct| >= 2.0%, mult = +/-8%
```

The overall derivatives adjustment is clamped to [0.70, 1.30] (L816-817).

Source: Doc 27 S6.2, Bessembinder & Seguin (1993).

### 7C.5 Futures Microstructure: Open Interest

**OI-Price 4-Quadrant Matrix:**

```
                    OI Increase (new entry)     OI Decrease (position close)
  Price Up     Q1: New longs (Strong trend)    Q2: Short covering (Weak)
  Price Down   Q3: New shorts (Strong trend)   Q4: Long liquidation (Weak)
```

**OI-Price Composite Indicator:**

```
OI_trend = sign(dP_t) * dOI_t / OI_{t-1}

OI_trend > 0: Price and OI move together (Q1 or Q3) --> trend confirmed
OI_trend < 0: Price and OI diverge (Q2 or Q4) --> trend fragile
```

**Bessembinder-Seguin (1993) OI-Volatility Relationship:**

```
sigma^2_t = alpha + beta1*V_t + beta2*V_hat_t + beta3*OI_t + beta4*OI_hat_t + epsilon

beta3 < 0: Higher OI --> lower volatility (market depth effect)
beta4 < 0: Unexpected OI increase --> volatility suppression

KRX estimates (2015-2025):
  beta2 (unexpected volume) ~= +0.18 (t = 4.2)
  beta3 (expected OI) ~= -0.07 (t = -2.8)
  beta4 (unexpected OI) ~= -0.12 (t = -3.5)
```

Source: Doc 36 S2, Doc 27 S2, Bessembinder & Seguin (1993).

### 7C.6 Program Trading

**Arbitrage Trading:**

```
Buy program:  F_market > F* + threshold  -->  Buy spot basket + Sell futures
Sell program: F_market < F* - threshold  -->  Sell spot basket + Buy futures

threshold ~= 15-25 bps (round-trip transaction costs)
```

Individual stock impact proportional to KOSPI200 weight (Samsung ~20%).

**Confidence Adjustment for Program Trading Intensity:**

```
program_zscore = (|program_net_t| - mean(|program_net_{t-20}|))
               / std(|program_net_{t-20}|)

program_zscore > 2.0:  conf *= 0.90  (abnormal program distortion)
program_zscore > 3.0:  conf *= 0.80  (extreme distortion)
```

**Expiration Day / Rollover:**

| Market Event | Condition | Confidence Adjustment | Constant Grade |
|-------------|-----------|----------------------|----------------|
| Expiration day (D-0) | Options/futures expiry | conf *= 0.70 | [C] |
| Rollover period | D-3 to D-1 (quarterly futures) | conf *= 0.85 | [C] |
| Sidecar trigger (active) | During 5-min halt | conf *= 0.50 | [A] Fixed |
| Sidecar trigger (post) | 5-60 min after | conf *= 0.75 | [C] |
| Triple witching day | Quarterly expiry | conf *= 0.65 | [C] |

KRX expiry: Second Thursday of each month. Quarterly triple witching: March, June, September, December.

Source: Doc 27 S3-4, S6.

---

## 7D. Options Strategies & Market Signals

### 7D.1 Put-Call Ratio (PCR)

```
PCR_volume = Volume_put / Volume_call    -- short-term sentiment (intraday noise)
PCR_OI     = OI_put / OI_call            -- medium-term positioning (more stable)
```

PCR is a classic contrarian indicator: extreme fear (high PCR) precedes rallies; extreme greed (low PCR) precedes declines.

**KRX Thresholds (KOSPI200 OI-based, 2015-2026 distribution):**

| PCR Range | Interpretation | 20-day Return Median |
|-----------|----------------|---------------------|
| PCR > 1.3 | Extreme fear --> contrarian buy | +1.8% |
| 0.8-1.2 | Neutral zone | -- |
| PCR < 0.5 | Extreme greed --> contrarian sell | -1.2% |

**Dual Confirmation (PCR + VKOSPI):**

```
Buy confirmation:  PCR_5d > 1.3 AND VKOSPI > 22
  --> "Fear priced in" probability high

Sell confirmation: PCR_5d < 0.5 AND VKOSPI < 15
  --> "Greed at extremes" probability high
```

| Constant | Value | Grade | Justification | JS Location |
|----------|-------|-------|---------------|-------------|
| PCR fear threshold | 1.3 | [C] | KRX OI empirical distribution | `appWorker.js` L764 |
| PCR greed threshold | 0.5 | [C] | KRX OI empirical distribution | `appWorker.js` L766 |
| PCR fear confidence boost (buy) | 1.08 | [C] | Pan & Poteshman (2006), IC ~= 0.03-0.05 | `appWorker.js` L765 |
| PCR greed confidence boost (sell) | 1.08 | [C] | Symmetric application | `appWorker.js` L767 |

**Implementation:** `signalEngine.js` `_detectPCRSignal()` (L520). `appWorker.js` `_applyDerivativesConfidenceToPatterns()` (L760-769).

Source: Doc 26 S3, Doc 37 S6, Pan & Poteshman (2006), Whaley (2000).

### 7D.2 Gamma Exposure (GEX)

```
GEX = SUM_i [OI_call(K_i) * Gamma_call(K_i) * multiplier * S]
    - SUM_i [OI_put(K_i) * Gamma_put(K_i) * multiplier * S]

KOSPI200 options multiplier = 250,000 KRW
```

| GEX Sign | Dealer Position | Market Effect | Pattern Implication |
|----------|----------------|---------------|---------------------|
| Positive (GEX > 0) | Net long gamma | Mean-reversion (stabilizing) | Range-bound patterns +10% |
| Negative (GEX < 0) | Net short gamma | Momentum (destabilizing) | Breakout patterns +10% |

**GEX Flip Level:** The price at which GEX = 0. Above this level: stable; below: unstable. Acts as a structural support/resistance level derived from options market microstructure.

**VRP-GEX Alignment:** VRP > 0 (stable) typically co-occurs with Positive GEX. When both signals agree, confidence adjustment is amplified.

**Implementation Status:** GEX calculation requires option chain OI data per strike. Currently classified as [D] tier pending full KRX option chain data pipeline. The `compute_options_analytics.py` script computes individual option deltas/IVs but does not yet compute aggregate GEX.

Source: Doc 26 S6, Doc 37 S5.

### 7D.3 Straddle Implied Move

The ATM straddle price approximates the market's expected price range over the option's life:

```
Expected Move = (C_ATM + P_ATM) / S * 100   (%)

At ATM: C ~= P ~= 0.4 * S * sigma * sqrt(T)   (Brenner-Subrahmanyam)
--> Expected Move ~= 0.8 * sigma * sqrt(T) * 100
```

**Implementation:** `compute_options_analytics.py` computes `straddleImpliedMove` from ATM option prices (L14). The value is consumed by `appWorker.js` `_applyPhase8ConfidenceToPatterns()` (L612-623):

```javascript
if (impliedMove > 3.0) {
    // High implied move = event period: reduce all directional confidence
    patterns[k].confidence *= 0.95;
}
```

| Constant | Value | Grade | Justification | JS Location |
|----------|-------|-------|---------------|-------------|
| Implied move threshold | 3.0% | [C] | Indicates elevated event risk | `appWorker.js` L616 |
| Event period discount | 0.95 | [C] | 5% confidence reduction during uncertainty | `appWorker.js` L620 |

Source: Doc 46 S1.2, Brenner & Subrahmanyam (1988).

### 7D.4 Max Pain Theory

Max pain is the strike price at which the total value of expiring options (calls + puts) is maximized for sellers (equivalently, the point of maximum pain for option buyers):

```
MaxPain(K*) = argmin_K SUM_i [OI_call(K_i) * max(K_i - K, 0) * multiplier
                             + OI_put(K_i) * max(K - K_i, 0) * multiplier]
```

The theory predicts that the underlying tends to converge toward the max pain strike near expiry (pin risk). This creates structural support/resistance from options market dynamics.

**Implementation:** `compute_options_analytics.py` includes `maxPainStrike` in its output (L19).

Source: Doc 46 S4.

---

## 7E. Investor Flow & Short Selling

### 7E.1 Kyle (1985) Three-Agent Framework

The theoretical foundation for investor flow analysis:

```
Agent 1 -- Informed Trader: Knows true value v, trades x to maximize E[(v - p) * x]
Agent 2 -- Noise Trader: Trades u ~ N(0, sigma_u^2) for non-informational reasons
Agent 3 -- Market Maker: Observes total order flow (x + u), sets price p = mu + lambda*(x + u)

lambda = Kyle's price impact coefficient = sqrt(sigma_v^2 / (4 * sigma_u^2))
```

**KRX Investor Category Mapping:**

| KRX Category | Kyle Mapping | Information Rank | Information Type |
|-------------|-------------|-----------------|-----------------|
| Foreign | Informed (Type A) | 1st (highest) | Global macro |
| Institutional | Informed (Type B) | 2nd | Local fundamentals |
| -- Trust | Semi-informed | 2-A | Sector analysis |
| -- Pension | Policy-informed | 2-B | Policy signals |
| -- Insurance | Liability-driven | 2-C | ALM matching |
| -- Bank | Hedging | 2-D | Liquidity management |
| Retail | Noise Trader | 3rd (lowest) | Attention/emotion |

Source: Doc 39 S2, Kyle (1985), Grossman & Stiglitz (1980).

### 7E.2 Foreign Investor Flow Signal

Foreign net buying has empirical predictive power for subsequent returns:

```
CumNetBuy_FOR(t, N) = SUM_{i=0}^{N-1} NetBuy_FOR(t-i)

Normalized:
  NormCumFlow_FOR(t, N) = CumNetBuy_FOR(t, N) / AvgDailyTurnover(t, 20)
```

**KRX Empirical Evidence (Choe, Kho & Stulz 2005, updated):**

```
r_{t+k} = alpha + beta_f * Delta_FOR_t + Controls + epsilon

k = 5 days:  beta_f = +0.032 (t = 3.4, p < 0.001)
k = 20 days: beta_f = +0.068 (t = 4.1, p < 0.001)
k = 60 days: beta_f = +0.085 (t = 2.8, p < 0.005)
```

**Confidence Adjustment in appWorker.js (L771-782):**

```javascript
// Investor alignment
if (align === 'aligned_buy') {
    adj *= isBuy ? 1.08 : 0.93;   // Foreign + institutional buying together
} else if (align === 'aligned_sell') {
    adj *= isBuy ? 0.93 : 1.08;   // Foreign + institutional selling together
}
```

| Constant | Value | Grade | Justification | JS Location |
|----------|-------|-------|---------------|-------------|
| Aligned buy boost | 1.08 | [C] | Choe/Kho/Stulz (2005) | `appWorker.js` L777 |
| Aligned sell penalty | 0.93 | [C] | Symmetric | `appWorker.js` L778 |

**Phase 8 Integration (appWorker.js L578-609):** Per-stock foreign momentum from `_flowSignals.stocks[code]`:

```javascript
if (flow.foreignMomentum === 'buy' && pt.signal === 'buy') {
    pt.confidence *= 1.03;   // +3% bonus for direction alignment
}
```

Source: Doc 39 S3, Choe et al. (2005), Kang & Stulz (1997).

### 7E.3 LSV Herding Measure

Lakonishok, Shleifer & Vishny (1992) quantify institutional herding:

```
HM_i = |p_i - E[p_i]| - AF_i

p_i = B_i / (B_i + S_i)
  B_i = number of institutions net buying stock i
  S_i = number of institutions net selling stock i

E[p_i] = market-wide average p (removes aggregate directional bias)

AF_i = E[|p_i - E[p_i]|] under H0 of no herding
  (computed from binomial distribution)
```

| Metric | Value | Interpretation |
|--------|-------|----------------|
| HM_i > 0 | Herding present in stock i | |
| HM_i > 0.05 | Significant herding (5%+ institutions biased same direction) | |
| KOSPI institutions normal | HM ~= 0.02-0.04 | Moderate herding |
| Crisis period | HM ~= 0.06-0.10 | Amplified herding |
| Retail investors | HM ~= 0.05-0.08 | Higher herding than institutions |

Not directly implemented in CheeseStock (requires institutional-level position data beyond KRX aggregate disclosure), but the theoretical framework informs the interpretation of institutional flow alignment signals.

Source: Doc 39 S4.2, Lakonishok, Shleifer & Vishny (1992).

### 7E.4 ETF Creation/Redemption Flow

ETF flows transmit demand through three channels:

```
Channel 1 -- Demand Transmission:
  ETF buy --> AP creation --> Basket buy --> Individual stock demand impact

Channel 2 -- Correlation Amplification:
  Higher ETF ownership --> More basket trading --> Higher inter-stock correlation

Channel 3 -- Sentiment Proxy:
  Leveraged/Inverse ETF trading ratio --> Market sentiment extremes
```

**Implementation (appWorker.js L784-792):** ETF leverage sentiment adjustment uses contrarian logic:

```javascript
if (sentiment === 'strong_bullish') {
    adj *= isBuy ? 0.95 : 1.05;   // Extreme optimism --> contrarian (overheating warning)
} else if (sentiment === 'strong_bearish') {
    adj *= isBuy ? 1.05 : 0.95;   // Extreme pessimism --> contrarian (bottom proximity)
}
```

**NAV and Premium/Discount:**

```
NAV_t = (SUM_i w_i * P_i,t + Cash_t - Expenses_t) / Shares_outstanding
PD_t = (P_etf,t - iNAV_t) / iNAV_t * 100  (%)

Premium: PD > 0 --> excess demand (buy pressure)
Discount: PD < 0 --> excess supply (sell pressure)
```

Source: Doc 38 S2, Gastineau (2001), Cheng & Madhavan (2009).

### 7E.5 Short Selling Analysis

**Short Interest Ratio (SIR):**

```
SIR_t = shortBalance_t / listedShares_t * 100

Interpretation:
  SIR < 1%:   Low -- minimal bearish sentiment
  1-3%:       Normal -- standard hedging/arbitrage
  3-5%:       High -- informational short selling possible
  5-10%:      Very high -- strong downside signal or squeeze risk
  > 10%:      Extreme -- short squeeze imminent
```

**Days-to-Cover (DTC):**

```
DTC_t = shortBalance_t / avgDailyVolume(t-20, t)

DTC < 1:    Easy cover --> low pressure
1-3:        Normal --> watch level
3-5:        High --> significant cover pressure
5-10:       Very high --> squeeze risk elevated
> 10:       Extreme --> 2+ weeks to cover
```

Hong et al. (2015) demonstrated that DTC is a more powerful return predictor than SIR alone:

```
Long-Short portfolio (Low DTC - High DTC):
  Monthly excess return = 1.07% (t-stat = 3.12)
```

**Confidence Adjustment (appWorker.js L794-805):**

```javascript
if (msr != null && msr > 10) {       // Market short ratio > 10%
    adj *= isBuy ? 1.06 : 0.94;      // High short interest --> short cover rally possible
} else if (msr != null && msr < 2) {
    adj *= isBuy ? 0.97 : 1.03;      // Low short interest --> no downside insurance
}
```

| Constant | Value | Grade | Justification | JS Location |
|----------|-------|-------|---------------|-------------|
| High short ratio threshold | 10% | [C] | Desai et al. (2002) | `appWorker.js` L800 |
| Low short ratio threshold | 2% | [C] | Empirical baseline | `appWorker.js` L802 |
| Short squeeze boost (buy) | 1.06 | [C] | Contrarian signal strength | `appWorker.js` L801 |

**KRX Short Selling Structure:**

```
Participant breakdown:
  Foreign: ~60-70% (primarily informational trading)
  Institutional: ~25-30% (hedging + informational)
  Retail: ~3-5% (limited, post-2025 partial lift)

--> Short selling on KRX carries higher per-unit information content
    than on US markets (regulatory barriers filter out noise trading)
```

Source: Doc 40 S4, Desai et al. (2002), Boehmer, Jones & Zhang (2008), Diamond & Verrecchia (1987).

---

## 7F. Confidence Adjustment Pipeline Summary

The derivatives-related confidence adjustments flow through three functions in `appWorker.js`, applied sequentially in the analysis pipeline:

```
Pattern Analysis Pipeline:
  patternEngine.analyze(candles) --> detectedPatterns
    --> _applyMacroConfidenceToPatterns()
    --> _applyMicroConfidenceToPatterns()
    --> _applyDerivativesConfidenceToPatterns()    [S7C-7E adjustments]
    --> _applyMertonDDToPatterns()
    --> _applyPhase8ConfidenceToPatterns()          [S7D.3 implied move, HMM, MCS]
    --> _applySurvivorshipAdjustment()
```

**`_applyDerivativesConfidenceToPatterns()` -- 7 adjustment channels (L711-825):**

| Channel | Data Source | Academic Basis | Adjustment Range |
|---------|-----------|----------------|-----------------|
| 1. Futures basis | `_derivativesData.basisPct` | Bessembinder & Seguin (1993) | +/-5% to +/-8% |
| 2. PCR contrarian | `_derivativesData.pcr` | Pan & Poteshman (2006) | +/-8% |
| 3. Investor alignment | `_investorData.alignment` | Choe/Kho/Stulz (2005) | +8% / -7% |
| 4. ETF leverage sentiment | `_etfData.leverageSentiment` | Cheng & Madhavan (2009) | +/-5% |
| 5. Short selling ratio | `_shortSellingData.market_short_ratio` | Desai et al. (2002) | +6%/-3% to -6%/+3% |
| 6. (ERP -- handled in signalEngine) | -- | -- | -- |
| 7. USD/KRW export channel | `_macroLatest.usdkrw` | Doc 28 S3, beta_FX | +/-5% |

**Overall clamp: adj in [0.70, 1.30]** (L816-817), then confidence clamped to [10, 100] (L819).

**`_applyPhase8ConfidenceToPatterns()` -- 3 adjustment channels (L554-633):**

| Channel | Data Source | Adjustment |
|---------|-----------|------------|
| MCS (macro composite score) | `_macroComposite.mcsV2` | +5% for aligned direction |
| HMM regime + foreign flow | `_flowSignals.stocks[code]` | regime mult + 3% foreign alignment |
| Options implied move | `_optionsAnalytics.analytics.straddleImpliedMove` | -5% when > 3% |

**Data Pipeline Health:** Pipeline status tracked in `_pipelineStatus` object. Source guards reject `source === "sample"` or `"demo"` data for `_investorData` and `_shortSellingData`. Status guards reject `status === "error"` for `_optionsAnalytics` and `_flowSignals`.

---

## Derivatives Findings

### Finding 1: VKOSPI Proxy Factor (VIX_VKOSPI_PROXY = 1.12) Lacks Rigorous Empirical Basis

**Severity:** Low (mitigated by DEPRECATED status)

The 1.12 constant is attributed to "Whaley (2009) KRX proxy" in `appState.js` L41-43 and `signalEngine.js` L12. However, Whaley (2009) describes the general VIX methodology, not a KRX-specific scaling factor. The empirical VKOSPI/VIX ratio varies from ~1.0 (normal) to ~1.5 (crisis).

**Current Mitigation:** The constant is marked `[DEPRECATED FALLBACK]` in code comments. With 547+ days of direct VKOSPI data in `data/vkospi.json`, the proxy fires only in offline mode without the data file. The `signalEngine.js` fallback chain (L1795-1807) correctly prioritizes direct VKOSPI data.

**Recommendation:** Maintain current approach. If the proxy is ever revisited, a regime-dependent scaling (already partially implemented at L1802) is more accurate than a flat constant.

### Finding 2: BSM Implementation is Correct and Well-Guarded

**Severity:** None (informational)

The `compute_options_analytics.py` BSM implementation is verified correct:

1. Call and put formulas include the Merton continuous-dividend extension (q parameter).
2. Newton-Raphson uses proper Brenner-Subrahmanyam initial guess.
3. Vega guard (`vega < 1e-12`) prevents division by zero for deep ITM/OTM options.
4. IV bounds [1%, 300%] are reasonable for KRX options, wider than the sanity check range (5%-200%) to avoid false rejections.
5. Delta calculation correctly handles the continuous-dividend case.
6. The 25-delta skew uses actual computed deltas, not approximated moneyness.

### Finding 3: GEX Calculation Not Yet Implemented

**Severity:** Low (aspirational feature, [D] tier)

The GEX formulas in Doc 26 S6 describe the dealer gamma hedging mechanism, but the implementation (`compute_options_analytics.py`) does not compute aggregate GEX. Individual option deltas and gammas are implied by the BSM computation, but the aggregate `SUM(OI * Gamma * multiplier * S)` is not output. This is correctly classified as [D] tier pending option chain OI data pipeline completion.

### Finding 4: Derivatives Confidence Double-Application Prevention

**Severity:** None (already fixed)

The code contains explicit comments preventing double-application of adjustments:
- ERP (Equity Risk Premium) is handled only in `signalEngine._detectERPSignal()` -- `appWorker.js` L807 notes this to prevent double counting.
- DD (Distance-to-Default) was previously applied in both `_applyMertonDDToPatterns()` and `_applyPhase8ConfidenceToPatterns()`, causing a 0.738x double discount. This was fixed by removing DD from Phase8 (L625 comment).

### Finding 5: Newton-Raphson Convergence Tolerance is Appropriate

**Severity:** None (informational)

NEWTON_TOL = 1e-6 provides sub-cent precision for KOSPI200 options (multiplier 250,000 KRW). For an ATM option at sigma = 0.20, S = 350, T = 1/12: Vega ~= 6.5. A 1e-6 price tolerance corresponds to sigma precision of ~1.5e-7 (0.000015%), far exceeding practical needs. The 50-iteration cap is generous; convergence typically occurs in 3-5 iterations.

### Finding 6: Regime Threshold Calibration Documented

**Severity:** None (informational)

The VKOSPI regime thresholds (15/22/30) differ from the original academic values (15/25/35). The code documents this as "KRX 실측 분포 기반 15/22/30으로 보정 (2026-04 calibration)" at `signalEngine.js` L1808. The adjustment is justified by KRX-specific VKOSPI distribution characteristics and is appropriately classified as [C] grade (calibratable via GCV).

---

## References

1. Black, F. & Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. *JPE*, 81(3), 637-654.
2. Merton, R.C. (1973). Theory of Rational Option Pricing. *Bell Journal of Economics*, 4(1), 141-183.
3. Cox, J.C., Ross, S.A. & Rubinstein, M. (1979). Option Pricing: A Simplified Approach. *JFE*, 7(3), 229-263.
4. Brenner, M. & Subrahmanyam, M.G. (1988). A Simple Formula to Compute the Implied Standard Deviation. *Financial Analysts Journal*, 44(5), 80-83.
5. Gatheral, J. (2006). *The Volatility Surface: A Practitioner's Guide*. Wiley.
6. Gatheral, J. & Jacquier, A. (2014). Arbitrage-Free SVI Volatility Surfaces. *Quantitative Finance*, 14(1), 59-71.
7. Heston, S.L. (1993). A Closed-Form Solution for Options with Stochastic Volatility. *RFS*, 6(2), 327-343.
8. Bessembinder, H. & Seguin, P.J. (1993). Futures Trading Activity and Stock Price Volatility. *JF*, 48(5), 2015-2034.
9. Pan, J. & Poteshman, A.M. (2006). The Information in Option Volume for Future Stock Prices. *RFS*, 19(3), 871-908.
10. Whaley, R.E. (2000). The Investor Fear Gauge. *Journal of Portfolio Management*, 26(3), 12-17.
11. Whaley, R.E. (2009). Understanding the VIX. *Journal of Portfolio Management*, 35(3), 98-105.
12. Corsi, F. (2009). A Simple Approximate Long-Memory Model of Realized Volatility. *JFE*, 7(2), 174-196.
13. Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335.
14. Grossman, S.J. & Stiglitz, J.E. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.
15. Lakonishok, J., Shleifer, A. & Vishny, R.W. (1992). The Impact of Institutional Trading on Stock Prices. *JFE*, 32(1), 23-43.
16. Choe, H., Kho, B.-C. & Stulz, R. (2005). Do Domestic Investors Have an Edge? *RFS*, 18(3), 795-829.
17. Kang, J.-K. & Stulz, R.M. (1997). Why Is There a Home Bias? *JFE*, 46(1), 3-28.
18. Desai, H., Ramesh, K., Thiagarajan, S.R. & Balachandran, B.V. (2002). An Investigation of the Informational Role of Short Interest. *JF*, 57(5), 2263-2287.
19. Diamond, D.W. & Verrecchia, R.E. (1987). Constraints on Short-Selling and Asset Price Adjustment. *JFE*, 18(2), 277-311.
20. Boehmer, E., Jones, C.M. & Zhang, X. (2008). Which Shorts Are Informed? *JF*, 63(2), 491-527.
21. Miller, E.M. (1977). Risk, Uncertainty, and Divergence of Opinion. *JF*, 32(4), 1151-1168.
22. Hong, H., Li, W., Ni, S.X. & Scheinkman, J.A. (2015). Days to Cover and Stock Returns. *NBER Working Paper* No. 21166.
23. Gastineau, G.L. (2001). An Introduction to Exchange-Traded Funds. *JPM*, 27(3), 88-96.
24. Cheng, M. & Madhavan, A. (2009). The Dynamics of Leveraged and Inverse Exchange-Traded Funds. *JPM*, 15(4), 43-56.
25. Hull, J.C. (2021). *Options, Futures, and Other Derivatives*. 11th ed. Pearson.
26. Rubinstein, M. (1994). Implied Binomial Trees. *JF*, 49(3), 771-818.
27. Bates, D.S. (2000). Post-'87 Crash Fears in the S&P 500 Futures Option Market. *JoE*, 94(1-2), 181-238.
28. Roger Lee (2004). The Moment Formula for Implied Volatility at Extreme Strikes. *Mathematical Finance*, 14(3), 469-480.
29. Natenberg, S. (2015). *Option Volatility and Pricing*. 2nd ed. McGraw-Hill.
30. Barber, B.M. & Odean, T. (2000). Trading Is Hazardous to Your Wealth. *JF*, 55(2), 773-806.
