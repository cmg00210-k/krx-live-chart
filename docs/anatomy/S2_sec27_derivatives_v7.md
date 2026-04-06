# Stage 2 -- Section 2.7: Derivatives Theory (V7)

## Document Metadata

| Field | Value |
|-------|-------|
| Section | 2.7 |
| Title | Derivatives Theory -- Options Pricing, Volatility, Futures, Investor Flow, Short Selling |
| Author | Derivatives Expert Agent |
| Date | 2026-04-06 |
| Version | V6 (supersedes V5 at `S2_sec27_derivatives.md`) |
| Sources | Doc 26, 27, 36, 37, 38, 39, 40, 45, 46 |
| Implementation | `appWorker.js`, `signalEngine.js`, `compute_options_analytics.py`, `compute_basis.py` |
| Formula Count | 17 (DRV-1 through DRV-17) |
| Status | Complete |

### Change Log V5 --> V6

1. Every formula now carries full CFA-paper-grade annotation: symbol table, constants table with [A-E] grade, system mapping, edge cases.
2. Added Breeden-Litzenberger RND extraction (DRV-5) and GEX formula (DRV-6).
3. Added ETF leverage ratio (DRV-17), Variance Risk Premium (DRV-12) with HAR-RV connection.
4. End-to-end data pipeline trace for each formula: API data --> Python compute --> JSON --> JS loader --> signal/confidence --> chart display.
5. Implementation cross-references updated to current line numbers (verified 2026-04-06).
6. Findings section expanded with FIX AUTHORITY corrections.

---

## 2.7.1 Options Pricing

### DRV-1: Black-Scholes-Merton European Call

**Formula:**

```
C = S * e^(-qT) * N(d1) - K * e^(-rT) * N(d2)
P = K * e^(-rT) * N(-d2) - S * e^(-qT) * N(-d1)

d1 = [ln(S/K) + (r - q + sigma^2/2) * T] / (sigma * sqrt(T))
d2 = d1 - sigma * sqrt(T)
```

**Symbol Table:**

| Symbol | Name | Unit | Typical Range (KRX) | Source |
|--------|------|------|---------------------|--------|
| C | European call option price | KRW or index pts | 0.01 - 50 pt (KOSPI200) | BSM output |
| P | European put option price | KRW or index pts | 0.01 - 50 pt | BSM output |
| S | Spot price (underlying) | Index pts (KOSPI200) | 250-450 pt | `data/market/kospi200_daily.json` |
| K | Strike price | Same as S | 2.5 pt intervals | Options chain |
| r | Risk-free rate (continuous) | Annualized decimal | 0.030-0.040 | `bonds_latest.json` KTB 3Y |
| q | Continuous dividend yield | Annualized decimal | 0.015-0.025 | Historical estimate |
| T | Time to expiry | Years | 0.003-0.25 (1 day to 3 months) | Calendar |
| sigma | Volatility | Annualized decimal | 0.10-0.50 | IV extraction or HV |
| N() | Standard normal CDF | Dimensionless | [0, 1] | `api_constants.py` |
| N'() | Standard normal PDF | Dimensionless | [0, 0.399] | `_normal_pdf()` |

**Constants Table:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| DIVIDEND_YIELD | 0.017 | [C] GCV | KOSPI200 historical avg ~1.7% p.a. | `compute_options_analytics.py` L52 |
| DEFAULT_RF | 0.035 | [C] Manual | Fallback when KTB 3Y unavailable from `bonds_latest.json` | `compute_options_analytics.py` L53 |

**System Mapping:**

```
[API]  KRX options chain -> download_options_latest.py
       bonds_latest.json (KTB 3Y) -> download_bonds.py
[Compute]  compute_options_analytics.py::_bs_price(S,K,T,r,sigma,q,is_call) L66-84
           -> Reads S from data/market/kospi200_daily.json
           -> Reads r from data/macro/bonds_latest.json (ktb_3y / 100)
           -> q = DIVIDEND_YIELD = 0.017
[JSON]  data/derivatives/options_analytics.json
        Keys: analytics.atmIV, analytics.straddleImpliedMove, analytics.putCallRatio, analytics.skew25d
[JS Load]  appWorker.js L462-475 -> _optionsAnalytics global
[Signal]   signalEngine.js::_detectPCRSignal() L2448
           appWorker.js::_applyPhase8ConfidenceToPatterns() L612-623 (implied move)
[Display]  Toast notification, confidence badge on pattern cards
```

**Edge Cases:**

- T <= 0 or sigma <= 0: Returns intrinsic value `max(S-K,0)` for call (L73-75).
- Deep ITM/OTM: Vega approaches zero; Newton-Raphson guard `vega < 1e-12` breaks iteration (L121).
- KRX price limits (+/-30%): Truncate tail distribution; BSM underprices deep OTM puts during limit-down events. See Doc 20 S2.2.

**BSM Assumptions vs KRX Reality:**

| BSM Assumption | KRX Reality | Violation Severity |
|----------------|-------------|-------------------|
| Continuous trading | 09:00-15:30 KST, overnight gaps | Medium |
| Constant volatility | Volatility clustering, GARCH effects | Severe |
| Log-normal returns | +/-30% price limits truncate tails | Severe |
| No transaction costs | Securities tax 0.18% + commission ~0.03% | Medium |
| Free short selling | KRX short-sale restrictions (2023-2025 ban, partial lift 2025.03.31) | Severe |
| Constant r | BOK base rate changes (quarterly MPC) | Minor |

**Academic Source:** Black & Scholes (1973), Merton (1973). Doc 26 S1.1.

---

### DRV-2: Greeks

All Greeks use the Merton extension (continuous dividend yield q).

**Delta -- Directional Sensitivity:**

```
Call:  Delta_C = dC/dS = e^(-qT) * N(d1)       in [0, 1]
Put:   Delta_P = dP/dS = e^(-qT) * (N(d1) - 1) in [-1, 0]
```

**Symbol Table:**

| Symbol | Name | Interpretation |
|--------|------|----------------|
| Delta_C | Call delta | +1 unit change in S -> Delta_C change in C. ATM ~= 0.50 |
| Delta_P | Put delta | ATM ~= -0.50 |
| N(d1) | Risk-neutral probability proxy for finishing ITM | |

**Implementation:** `compute_options_analytics.py::_bs_delta()` L136-148. Used to classify options by 25-delta moneyness for skew calculation. Guard: Returns 1.0 or 0.0 (call) / -1.0 or 0.0 (put) when T <= 0 or sigma <= 0.

**Gamma -- Convexity / Acceleration:**

```
Gamma = d^2C/dS^2 = e^(-qT) * N'(d1) / (S * sigma * sqrt(T))

N'(x) = (1/sqrt(2*pi)) * e^(-x^2/2)
```

Properties: Maximized at ATM; increases sharply near expiry ("gamma risk"). Identical for calls and puts at same strike. KOSPI200 near-expiry gamma drives pin risk (Doc 36 S2.5).

**Theta -- Time Decay:**

```
Theta_C = -[S * e^(-qT) * N'(d1) * sigma / (2*sqrt(T))]
          - r * K * e^(-rT) * N(d2) + q * S * e^(-qT) * N(d1)
```

BSM PDE relationship: `Theta + 0.5 * sigma^2 * S^2 * Gamma + r * S * Delta = r * C`

This implies the Gamma-Theta tradeoff: high Gamma entails high Theta decay (Doc 46 S3).

**Vega -- Volatility Sensitivity:**

```
Vega = dC/dsigma = S * e^(-qT) * sqrt(T) * N'(d1)
```

**Implementation:** `compute_options_analytics.py::_bs_vega()` L87-93. Used as Newton-Raphson denominator for IV iteration. Guard: returns 0.0 when T <= 0 or sigma <= 0.

Properties: Maximized at ATM; larger for longer-dated options. Identical for calls and puts at same strike (follows from put-call parity). KOSPI200 ATM Vega example: S=350, sigma=0.18, T=1/12 -> Vega ~= 6.5.

**Rho -- Interest Rate Sensitivity:**

```
Rho_C = dC/dr = K * T * e^(-rT) * N(d2)
```

KRX practical note: For short-dated (1-3 month) pattern analysis, Rho's contribution is negligible (~0.013% daily, per Doc 25 S1.3).

**Higher-Order Greeks (reference only -- not implemented in CheeseStock):**

| Greek | Formula | Interpretation |
|-------|---------|----------------|
| Vanna | dDelta/dsigma = dVega/dS | Delta sensitivity to volatility changes |
| Volga | d^2C/dsigma^2 = dVega/dsigma | Vol-of-vol sensitivity |
| Charm | dDelta/dT | Delta drift over time |

Higher-order Greeks are critical for KOSPI200 options market makers but not computed in CheeseStock's equity pattern analysis pipeline.

**Academic Source:** Doc 26 S1.2, Hull (2021).

---

### DRV-3: Put-Call Parity

**Formula:**

```
C - P = S * e^(-qT) - K * e^(-rT)
```

**Symbol Table:**

| Symbol | Name |
|--------|------|
| C | European call price at strike K, expiry T |
| P | European put price at same K, T |
| S * e^(-qT) | Dividend-adjusted spot (present value of dividends deducted) |
| K * e^(-rT) | Present value of strike (discounted at risk-free rate) |

**Validation Use:** Any computed option chain must satisfy this identity within transaction cost bounds. Violations indicate data errors or arbitrage opportunities (conversion/reversal).

**KRX Practical Tolerance:**

```
|C - P - (S * e^(-qT) - K * e^(-rT))| < 2 * transaction_cost

transaction_cost ~= 0.21% (tax 0.18% + commission 0.03%)
```

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| Transaction cost bound | 0.21% | [A] Fixed | KRX securities transaction tax + commission |

**Edge Cases:**

- KOSPI200 options are European and cash-settled: no early-exercise premium to break parity.
- Put-call parity violations of > 0.5% indicate stale quotes or data feed errors; `compute_options_analytics.py` should flag these (currently not implemented -- aspirational).
- During VKOSPI > 40 crisis episodes, bid-ask spreads widen to 1-2%, relaxing the no-arbitrage band.

**Academic Source:** Doc 45 S3, Hull (2021).

---

### DRV-4: SVI Parameterization (Gatheral 2006)

**Formula:**

```
w(k) = a + b * [rho * (k - m) + sqrt((k - m)^2 + sigma_svi^2)]
```

**Symbol Table:**

| Symbol | Name | Range | Interpretation |
|--------|------|-------|----------------|
| w(k) | Total implied variance = sigma_IV^2 * T | >= 0 | Variance surface value |
| k | Log-moneyness = ln(K/F) | R | Centered on ATM forward |
| a | Variance level | R | Overall IV level |
| b | Variance slope | >= 0 | Wing steepness |
| rho | Asymmetry / rotation | [-1, 1] | Skew direction (rho < 0 = downside skew) |
| m | Translation | R | Vertex location |
| sigma_svi | ATM curvature | > 0 | Smoothness of vertex |
| F | Forward price | Index pts | F = S * e^((r-q)T) |

**Theoretical Foundation:**

SVI is inspired by the Heston (1993) stochastic volatility model. Under Heston, the long-maturity total implied variance converges to:

```
w(k) --> theta + xi^2/(2*kappa) * [rho_H * k + sqrt(k^2 + xi^2*(1-rho_H^2)/(4*kappa^2))]
```

This convergence gives SVI its theoretical grounding -- it is not merely an empirical fit.

**No-Arbitrage Conditions:**

1. Butterfly spread (strike direction): `g(k) = (1 - k*w'/(2w))^2 - w'/4*(1/w + 1/4) + w''/2 >= 0`
2. Calendar spread (maturity direction): `w(k, T2) >= w(k, T1)` for T2 > T1
3. Roger Lee (2004) wing slope upper bound: `b*(1 + |rho|) <= 4`
4. Non-negative minimum variance: `a + b*sigma_svi*sqrt(1 - rho^2) >= 0`

**KOSPI200 IV Surface Stylized Facts:**

- Persistent negative skew: OTM put IV > ATM IV > OTM call IV. Typical rho = -0.3 to -0.5.
- Foreign positioning effect: foreign call selling + put buying widens skew.
- Near-expiry skew instability: SVI fitting residuals increase 3-5x within 1 week of expiry.
- Price limit (+/-30%) effect: truncates extreme OTM option IV, biases SVI wing parameters.
- KRX strike grid: 2.5pt intervals. Less dense than S&P 500 (5pt, ~0.1% moneyness) -> SVI preferred over spline interpolation.

**System Mapping:**

```
[Status] NOT IMPLEMENTED in CheeseStock pipeline.
SVI is a theoretical reference for interpreting KOSPI200 IV surface shape.
The compute_options_analytics.py script computes per-strike IV but does not fit SVI parameters.
Implementation priority: [D] -- requires full option chain with sufficient liquidity across strikes.
```

**Academic Source:** Doc 37 S2, Gatheral (2006), Gatheral & Jacquier (2014).

---

### DRV-5: Breeden-Litzenberger RND Extraction

**Formula:**

```
q(S_T = K) = e^(rT) * d^2C/dK^2
```

**Discrete approximation (for finite strike spacing dK):**

```
q(K) ~= e^(rT) * [C(K + dK) - 2*C(K) + C(K - dK)] / (dK)^2
```

**Symbol Table:**

| Symbol | Name | Interpretation |
|--------|------|----------------|
| q(K) | Risk-neutral probability density at S_T = K | Market-implied probability distribution |
| C(K) | Call option price at strike K | From options chain |
| dK | Strike spacing | 2.5 pt for KOSPI200 |
| r | Risk-free rate | KTB 3Y |
| T | Time to expiry | Years |

**Interpretation:**

The RND reveals the market's implicit probability distribution for the underlying at expiry. Departures from log-normal (BSM baseline) indicate:
- Left tail heavier than log-normal -> crash premium (OTM put IV elevated)
- Right tail heavier -> squeeze premium (OTM call IV elevated)
- Bimodality -> market sees two distinct outcome clusters (e.g., election, binary event)

**Skew-RND Connection (Bakshi, Kapadia & Madan 2003):**

```
RND skewness mu_3 ~= -6 * psi_T + ...
RND kurtosis mu_4 ~= 12 * (p_T + c_T) + ...

where psi_T, p_T, c_T are SVI jump-wing parameters (DRV-4)
```

**Edge Cases:**

- Requires at least 3 adjacent strikes with valid prices. KOSPI200 typically has 20-30 strikes -> sufficient.
- Near-expiry (T < 5 days): second derivative is numerically unstable due to gamma spikes.
- Individual stock options: liquidity insufficient for reliable RND (only ~85 KRX-listed stocks have options, of which top 10-15 have adequate OI).

**System Mapping:**

```
[Status] NOT IMPLEMENTED. Theoretical reference only.
Priority: [D] -- requires dense option chain OI data.
```

**Academic Source:** Doc 26 S2.4, Breeden & Litzenberger (1978).

---

### DRV-6: Gamma Exposure (GEX)

**Formula:**

```
GEX = SUM_i [OI_call(K_i) * Gamma_call(K_i) * multiplier * S]
    - SUM_i [OI_put(K_i) * Gamma_put(K_i) * multiplier * S]

KOSPI200 options multiplier = 250,000 KRW
```

**Symbol Table:**

| Symbol | Name | Unit |
|--------|------|------|
| GEX | Aggregate gamma exposure | KRW |
| OI_call(K_i) | Call open interest at strike K_i | Contracts |
| Gamma_call(K_i) | BSM gamma for call at K_i | 1/pt |
| multiplier | KOSPI200 contract multiplier | 250,000 KRW |
| S | Spot index | pts |

**Sign Convention (Dealer Perspective):**

| GEX Sign | Dealer Position | Market Effect | Pattern Implication |
|----------|----------------|---------------|---------------------|
| Positive (GEX > 0) | Net long gamma | Mean-reversion (stabilizing) | Range-bound patterns (double top/bottom, rectangle) +10% conf |
| Negative (GEX < 0) | Net short gamma | Momentum (destabilizing) | Breakout patterns (triangle, wedge) +10% conf |

**Mechanism:**

```
Positive GEX:
  S rises -> dealer delta increases -> dealer sells underlying (rebalance)
  S falls -> dealer delta decreases -> dealer buys underlying
  Effect: "Buy dips, sell rips" = mean-reversion enforcement

Negative GEX:
  S falls -> put delta increases -> dealer sells more underlying (hedge)
  S rises -> dealer reduces hedging
  Effect: "Sell into weakness" = momentum amplification

GEX Flip Level: S at which GEX = 0
  Above: stable (positive GEX)
  Below: unstable (negative GEX)
  Acts as structural support/resistance from options microstructure
```

**VRP-GEX Alignment:**

VRP > 0 (IV > RV) typically co-occurs with Positive GEX (stable market). When both signals agree, confidence adjustment is amplified.

**System Mapping:**

```
[Status] NOT IMPLEMENTED. Aspirational [D] tier.
compute_options_analytics.py computes per-option delta/IV but does not aggregate GEX.
Implementation requires: per-strike OI data from options chain.
Confidence adjustment rules documented in Doc 26 S6.2 ready for wiring once data pipeline is complete.
```

**Academic Source:** Doc 26 S6, Doc 37 S5.

---

## 2.7.2 Futures

### DRV-7: Cost-of-Carry

**Formula:**

```
F* = S * e^((r - d) * T)
```

**Symbol Table:**

| Symbol | Name | Unit | Typical Range (KRX) | Source |
|--------|------|------|---------------------|--------|
| F* | Theoretical futures price (fair value) | Index pts | KOSPI200: 250-450 pt | Computed |
| S | Spot index (KOSPI200) | Index pts | 250-450 pt | `kospi200_daily.json` |
| r | Risk-free rate (KTB 3Y) | Annualized decimal | 0.030-0.035 | `bonds_latest.json` |
| d | Dividend yield (KOSPI200) | Annualized decimal | 0.015-0.020 | Historical estimate |
| T | Time to expiry | Years (= remaining_days / 365) | 0-0.25 | Calendar |

**Constants Table:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| DIVIDEND_YIELD | 0.017 | [C] GCV | KOSPI200 historical avg ~1.7% p.a. | `compute_basis.py` L26 |
| ZSCORE_WINDOW | 60 | [B] | Standard rolling window for basis z-score | `compute_basis.py` L27 |

**KRX Specifics:**

- KOSPI200: `r - d ~= 1.0-1.5%` -> `F* ~= S + S * 0.015 * T` (3-month expiry ~= +0.375%)
- KOSDAQ150: Lower dividend yield (d ~= 0.3-0.8%) -> wider normal contango
- Fair value band: `F* +/- ~15-25 bps` (transaction costs), within which arbitrage is unprofitable
- Linear approximation valid for T < 0.25: `F* ~= S * (1 + (r - d) * T)`

**System Mapping:**

```
[API]  KRX derivatives -> download_derivatives.py -> data/derivatives/derivatives_summary.json
       KRX bonds -> download_bonds.py -> data/macro/bonds_latest.json
[Compute]  compute_basis.py::compute_fair_value(spot, rfr, div_yield, T) L81-86
           -> math.exp((rfr - div_yield) * T)
[JSON]  data/derivatives/basis_analysis.json
        Keys: fairValue, theoreticalBasis, excessBasis, excessBasisPct, basisZScore
[JS Load]  appWorker.js L452-475 -> merged into _derivativesData.basis array
[Signal]   signalEngine.js::_detectBasisSignal() L2409
           appWorker.js::_applyDerivativesConfidenceToPatterns() L742-758
[Display]  Signal diamond on chart, confidence adjustment on pattern cards
```

**Edge Cases:**

- `spot <= 0`: Skipped (L147 guard in `compute_basis.py`).
- Expiry date calculation: `_get_next_expiry()` L55-78 computes second Thursday. If current date past this month's expiry, rolls to next month.
- Division of year: Uses 365, not 252 (calendar days, appropriate for cost-of-carry).

**Academic Source:** Doc 27 S1.1.

---

### DRV-8: Basis Definition

**Formula:**

```
Basis = F_market - S_spot
Basis% = (F_market - S_spot) / S_spot * 100
```

**Derived Metrics:**

```
Theoretical Basis = F* - S = S * (e^((r-d)*T) - 1)   (always positive with positive r-d)
Excess Basis = Actual Basis - Theoretical Basis        (pure sentiment component)
Excess Basis% = Excess Basis / S * 100
```

**Interpretation Table:**

| Basis State | Condition | Market Interpretation | Typical Range (KOSPI200) |
|-------------|-----------|----------------------|--------------------------|
| High basis | Basis > F* | Institutional/foreign net buying -> bullish | +0.5% to +2.0% |
| Neutral | Basis ~= F* | No arbitrage opportunity | +/-0.3% |
| Low basis | Basis < F* | Hedge selling dominant -> bearish | -0.3% to -2.0% |
| Panic | Basis < -5% | Crisis / panic selling | 2008 GFC levels |

**Basis Convergence (Ornstein-Uhlenbeck):**

```
dBasis/dt = -kappa(t) * Basis_t * dt + sigma_B(t) * dW_t

kappa(t) = kappa_0 * exp(lambda * (T - t)^(-alpha))
  kappa_0 ~= 0.05/day (baseline convergence speed)

At expiry: Basis_T = F_T - S_T = 0 (mandatory convergence)
Practical: |Basis| < 0.3pt by 14:00 KST on expiry day
```

**Implementation:** `compute_basis.py::compute_basis_analysis()` L89+. Outputs to `data/derivatives/basis_analysis.json`.

**Academic Source:** Doc 27 S1.2-1.3, Doc 36 S3.2.

---

### DRV-9: OI 4-Quadrant Analysis

**Formula:**

```
OI_trend = sign(dP_t) * dOI_t / OI_{t-1}

dP_t = F_close_t - F_close_{t-1}    (futures close change)
dOI_t = OI_t - OI_{t-1}             (open interest change)
```

**Quadrant Matrix:**

```
                    OI Increase (new entry)     OI Decrease (position close)
  Price Up     Q1: New longs (Strong trend)    Q2: Short covering (Weak trend)
  Price Down   Q3: New shorts (Strong trend)   Q4: Long liquidation (Weak trend)
```

**Interpretation:**

```
OI_trend > 0:  Price and OI move together (Q1 or Q3) -> trend confirmed
OI_trend < 0:  Price and OI diverge (Q2 or Q4) -> trend fragile

Z-score normalization (60-day rolling):
OI_trend_z = (OI_trend_t - mean(OI_trend_{t-60})) / std(OI_trend_{t-60})
```

**Bessembinder-Seguin (1993) OI-Volatility Relationship:**

```
sigma^2_t = alpha + beta1*V_t + beta2*V_hat_t + beta3*OI_t + beta4*OI_hat_t + epsilon

beta3 < 0: Higher OI -> lower volatility (market depth effect)
beta4 < 0: Unexpected OI increase -> volatility suppression

KRX estimates (2015-2025):
  beta2 (unexpected volume) ~= +0.18 (t = 4.2)
  beta3 (expected OI) ~= -0.07 (t = -2.8)
  beta4 (unexpected OI) ~= -0.12 (t = -3.5)
```

**System Mapping:**

```
[Status] Theoretical reference. OI 4-quadrant not computed in current pipeline.
KRX D+1 data includes OI, but no OI-trend signal is generated.
Priority: [D] -- future enhancement for derivatives_summary enrichment.
```

**Academic Source:** Doc 27 S2.1, Doc 36 S2.2-2.3, Bessembinder & Seguin (1993).

---

### DRV-10: Basis Z-Score Normalization

**Formula:**

```
basis_z = (basisPct_t - mean(basisPct_{t-W})) / std(basisPct_{t-W})

W = ZSCORE_WINDOW = 60 (trading days)
```

**Constants Table:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| ZSCORE_WINDOW | 60 | [B] | Standard rolling window, ~3 months | `compute_basis.py` L27 |
| Basis signal threshold (normal) | basisPct >= 0.5% | [C] GCV | Doc 27 S5.1 empirical | `signalEngine.js` L2422 |
| Basis signal threshold (extreme) | basisPct >= 2.0% | [C] GCV | Doc 27 S5.1 extreme | `signalEngine.js` L2423 |

**Confidence Adjustment (appWorker.js L742-758):**

```
Basis positive (contango) + Buy pattern:  conf *= 1.05 (normal) or 1.08 (extreme)
Basis positive (contango) + Sell pattern: conf *= 0.95 (normal) or 0.92 (extreme)
Basis negative (backwardation) + Buy:     conf *= 0.95 or 0.92
Basis negative (backwardation) + Sell:    conf *= 1.05 or 1.08
```

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| Normal basis mult | +/-5% | [C] GCV | Bessembinder & Seguin (1993) direction alignment | `appWorker.js` L751 |
| Extreme basis mult | +/-8% | [C] GCV | Empirical KRX calibration | `appWorker.js` L751 |

**System Mapping:**

```
[Compute]  compute_basis.py -> basisZScore in basis_analysis.json (L188-198)
[JS Load]  appWorker.js L452-475 -> _derivativesData array/object
[Signal]   signalEngine.js::_detectBasisSignal() L2409-2441
           -> Generates basisContango (buy) or basisBackwardation (sell) signal
           -> Strength: 'strong' (extreme), 'medium', 'weak'
           -> Confidence: 72 (extreme), 62 (medium), 55 (weak)
[Confidence]  appWorker.js::_applyDerivativesConfidenceToPatterns() L742-758
[Display]  Signal diamond + tooltip with basisPct value
```

**Academic Source:** Doc 27 S5.1, Doc 36 S3.

---

## 2.7.3 VKOSPI & Volatility

### DRV-11: VKOSPI 4-Tier Regime Classification

**Formula:**

```
VKOSPI = 100 * sqrt[(2/T) * SUM_i (dK_i / K_i^2) * e^(rT) * Q(K_i)
                     - (1/T) * (F/K0 - 1)^2]
```

**Symbol Table:**

| Symbol | Name | Description |
|--------|------|-------------|
| T | Time to expiry (annualized) | Weighted avg of near-month and next-month |
| F | Forward price | K0 + e^(rT) * [C(K0) - P(K0)] |
| K0 | First strike below forward price | |
| K_i | i-th strike price | |
| dK_i | (K_{i+1} - K_{i-1}) / 2 | Average spacing |
| Q(K_i) | Mid-quote of OTM option | Put if K < K0, call if K > K0, average at K0 |
| r | Risk-free rate | |

The index interpolates between near-month and next-month expiries to produce exactly 30-calendar-day implied volatility. This is a **model-free** calculation (does not depend on BSM assumptions).

**Regime Classification:**

| Regime | VKOSPI Range | Frequency (2009-2026) | Pattern Confidence Adjustment |
|--------|-------------|----------------------|------------------------------|
| Low volatility | < 15 | ~20% | Breakout +10%, reversal -5% |
| Normal | 15-22 | ~45% | Standard (no adjustment) |
| High | 22-30 | ~20% | All directional x 0.85 |
| Crisis | > 30 | ~15% | All directional x 0.50-0.75 |

**Constants Table:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| Low threshold | 15 | [C] GCV | KRX empirical distribution, calibrated 2026-04 | `signalEngine.js` L1808 |
| Normal-High boundary | 22 | [C] GCV | Adjusted from academic 25 based on KRX distribution | `signalEngine.js` L1808 |
| High-Crisis boundary | 30 | [C] GCV | Adjusted from academic 35 based on KRX distribution | `signalEngine.js` L1808 |
| VIX_VKOSPI_PROXY | 1.12 | [C] DEPRECATED | Whaley (2009) KRX proxy; fallback only | `appState.js` L43, `signalEngine.js` L12 |

**Note on Threshold Calibration:** The regime thresholds (15/22/30) differ from original academic values (15/25/35). Code documents this as "KRX 실측 분포 기반 15/22/30으로 보정 (2026-04 calibration)" at Doc 26 S2.3.

**System Mapping:**

```
[API]  download_vkospi.py -> data/vkospi.json (547+ trading days, 2024-01-02 onward)
[JS Load]  appWorker.js -> _macroLatest.vkospi (injected from vkospi.json array)
[Signal]   signalEngine.js::_classifyVolRegimeFromVKOSPI() L1789-1828
           Fallback chain: _marketContext.vkospi -> _macroLatest.vkospi -> VIX * 1.12 (DEPRECATED)
           signalEngine.js::_volRegimeDiscount() L645 applies regime multiplier to signal confidence
           signalEngine.js::_detectVolRegimeChange() L476-516 generates volRegime signals
[Confidence]  _volRegimeDiscount() applies to all directional signals
[Display]  VKOSPI value in macro panel, regime badge on pattern cards
```

**VIX-to-VKOSPI Proxy (DEPRECATED):**

```
VKOSPI_proxy = VIX * VIX_VKOSPI_PROXY = VIX * 1.12
```

The empirical VKOSPI/VIX ratio varies by regime: ~1.0 (normal) to ~1.5 (crisis). The flat 1.12 is an oversimplification. With 547+ days of direct VKOSPI data, the proxy fires only in truly offline scenarios.

**Academic Source:** Doc 26 S2.3, KRX (2009), CBOE VIX White Paper (2003).

---

### DRV-12: Variance Risk Premium (VRP)

**Formula:**

```
VRP = IV^2 - E[RV^2]
```

Or in volatility terms (approximation):

```
VRP_approx = IV - RV
IV = VKOSPI (or ATM implied volatility from options)
RV = sqrt(252 * Var(r_daily, 20-day window))
```

**Interpretation:**

| VRP | Condition | Market Meaning | GEX Correlation |
|-----|-----------|---------------|-----------------|
| VRP > 0 (typical) | IV > RV | Options "expensive" relative to realized vol; positive expected return from selling options | Correlates with positive GEX (stabilizing) |
| VRP < 0 (rare) | RV > IV | Markets under-pricing risk; realized vol exceeding expectations | Correlates with negative GEX (destabilizing) |

**HAR-RV Connection (Corsi 2009):**

The Heterogeneous Autoregressive model provides the RV forecast for forward-looking VRP:

```
RV_{t+1}^(d) = beta_0 + beta_d * RV_t^(d) + beta_w * RV_t^(w) + beta_m * RV_t^(m) + epsilon

RV_t^(d) = daily RV (1-day realized volatility)
RV_t^(w) = weekly RV (5-day average)
RV_t^(m) = monthly RV (22-day average)
```

**Constants Table:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| VRP discount threshold | VRP_z < -1.5 | [C] GCV | VRP negative z-score indicates underpriced risk | `compute_mra.py` feature column |
| RV window | 20 days | [B] | Standard realized volatility estimation window | Academic standard |

**System Mapping:**

```
[Compute]  compute_mra.py computes VRP as part of 24-column feature expansion
           scripts/compute_options_analytics.py provides atmIV for IV component
[JSON]  VRP not directly in a standalone JSON; embedded in MRA feature matrix
[JS Load]  Indirect: VKOSPI (as IV proxy) in _macroLatest.vkospi
           ATR/HV computed in indicators.js::calcATR()
[Signal]   signalEngine.js::_detectVolRegimeChange() uses VKOSPI for IV component
           IV/HV ratio drives conf_adjusted = conf * (1 - alpha * max(0, IV/HV - 1))
           alpha = 0.2 [C] GCV, range [0.1, 0.3] (Doc 26 S5.3)
```

**Academic Source:** Doc 26 S2.3, Doc 34 S2, Corsi (2009).

---

### DRV-13: Put-Call Ratio (PCR) Reversal Signal

**Formula:**

```
PCR_volume = Volume_put / Volume_call    (short-term sentiment, intraday noise)
PCR_OI     = OI_put / OI_call            (medium-term positioning, more stable)

5-day smoothing: PCR_5d = MA(5, PCR_daily)
```

**Contrarian Interpretation (KRX Thresholds):**

| PCR Range | Interpretation | 20-day Return Median | Signal |
|-----------|----------------|---------------------|--------|
| PCR > 1.3 | Extreme fear | +1.8% | Contrarian buy |
| 0.8-1.2 | Neutral zone | -- | No signal |
| PCR < 0.5 | Extreme greed | -1.2% | Contrarian sell |

**Dual Confirmation (PCR + VKOSPI):**

```
Buy confirmation:  PCR_5d > 1.3 AND VKOSPI > 22
  -> "Fear priced in" probability high

Sell confirmation: PCR_5d < 0.5 AND VKOSPI < 15
  -> "Greed at extremes" probability high
```

**Constants Table:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| PCR fear threshold | 1.3 | [C] GCV | KRX KOSPI200 OI empirical 10th percentile | `appWorker.js` L764, `signalEngine.js` L2455 |
| PCR greed threshold | 0.5 | [C] GCV | KRX KOSPI200 OI empirical 90th percentile | `appWorker.js` L766, `signalEngine.js` L2459 |
| PCR fear confidence boost (buy) | 1.08 | [C] GCV | Pan & Poteshman (2006), IC ~= 0.03-0.05 | `appWorker.js` L765 |
| PCR greed confidence boost (sell) | 1.08 | [C] GCV | Symmetric application | `appWorker.js` L767 |

**System Mapping:**

```
[API]  KRX options data -> derivatives_summary.json (pcr field)
[JS Load]  appWorker.js -> _derivativesData (array or object)
[Signal]   signalEngine.js::_detectPCRSignal() L2448-2465
           -> pcrFearExtreme (buy, conf 62) or pcrGreedExtreme (sell, conf 62)
[Confidence]  appWorker.js::_applyDerivativesConfidenceToPatterns() L760-769
           -> PCR > 1.3: buy patterns * 1.08, sell patterns * 0.92
           -> PCR < 0.5: buy patterns * 0.92, sell patterns * 1.08
[Display]  Signal diamond, PCR value in tooltip
```

**Academic Source:** Doc 26 S3, Doc 37 S6, Pan & Poteshman (2006), Whaley (2000).

---

## 2.7.4 Flow & Short Selling

### DRV-14: Foreign Net Buying Alignment Signal

**Formula:**

```
CumNetBuy_FOR(t, N) = SUM_{i=0}^{N-1} NetBuy_FOR(t-i)

Normalized:
  NormCumFlow_FOR(t, N) = CumNetBuy_FOR(t, N) / AvgDailyTurnover(t, 20)
```

**KRX Empirical Evidence (Choe, Kho & Stulz 2005):**

```
r_{t+k} = alpha + beta_f * Delta_FOR_t + Controls + epsilon

k = 5 days:  beta_f = +0.032 (t = 3.4, p < 0.001)
k = 20 days: beta_f = +0.068 (t = 4.1, p < 0.001)
k = 60 days: beta_f = +0.085 (t = 2.8, p < 0.005)
```

**Kyle (1985) Three-Agent Framework -- KRX Mapping:**

| KRX Category | Kyle Mapping | Information Rank | Information Type |
|-------------|-------------|-----------------|-----------------|
| Foreign | Informed (Type A) | 1st (highest) | Global macro |
| Institutional | Informed (Type B) | 2nd | Local fundamentals |
| Retail | Noise Trader | 3rd (lowest) | Attention/emotion |

**Constants Table:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| Aligned buy boost | 1.08 | [C] GCV | Choe/Kho/Stulz (2005) | `appWorker.js` L777 |
| Aligned sell penalty | 0.93 | [C] GCV | Asymmetric (sell signal slightly weaker) | `appWorker.js` L778 |
| Foreign 1d large threshold | 5000 (billion KRW) | [C] GCV | ~2.5 sigma daily flow | `signalEngine.js` L2513 |
| Foreign 1d normal threshold | 2000 (billion KRW) | [C] GCV | ~1 sigma daily flow | `signalEngine.js` L2517 |
| Foreign 20d cumulative threshold | 5000 (billion KRW) | [C] GCV | Meaningful accumulation | `signalEngine.js` L2495 |
| Foreign momentum alignment bonus | 1.03 | [C] GCV | Per-stock direction match | `appWorker.js` L595 |

**System Mapping:**

```
[API]  KRX investor data -> download_investor.py -> data/derivatives/investor_summary.json
       Keys: alignment.signal_1d, foreign.net_1d_eok, foreign.net_20d_eok
       flow_signals.json -> stocks[code].foreignMomentum
[JS Load]  appWorker.js -> _investorData global
           appWorker.js -> _flowSignals global (per-stock)
[Signal]   signalEngine.js::_detectFlowSignal() L2472-2532
           -> flowAlignedBuy/Sell (conf 65), flowForeignBuy/Sell (conf 58)
           -> flowLeadershipBuy/Sell (conf 62/68)
[Confidence]  appWorker.js::_applyDerivativesConfidenceToPatterns() L771-782
           -> alignment = 'aligned_buy': buy * 1.08, sell * 0.93
           -> alignment = 'aligned_sell': buy * 0.93, sell * 1.08
           appWorker.js::_applyPhase8ConfidenceToPatterns() L578-609
           -> Per-stock foreign momentum: buy alignment * 1.03
[Display]  Signal diamond, flow description in tooltip, confidence badge
```

**Edge Cases:**

- `_investorData` null (no investor API data): No-op, returns empty signals (L2473-2474).
- Alignment value can be object `{signal_1d, signal_5d}` or string -- both handled (L2479-2480).
- Source guard: `_investorData` rejected if `source === "sample"` (appWorker.js L318-325).

**Academic Source:** Doc 39 S3, Kyle (1985), Choe et al. (2005), Kang & Stulz (1997).

---

### DRV-15: Short Interest Ratio (SIR)

**Formula:**

```
SIR_t = shortBalance_t / listedShares_t * 100   (%)
```

**Symbol Table:**

| Symbol | Name | Unit |
|--------|------|------|
| SIR | Short Interest Ratio | % of listed shares |
| shortBalance | Outstanding short positions | Shares |
| listedShares | Total listed shares | Shares |

**Interpretation:**

| SIR Range | Interpretation |
|-----------|----------------|
| < 1% | Low -- minimal bearish sentiment |
| 1-3% | Normal -- standard hedging/arbitrage |
| 3-5% | High -- informational short selling possible |
| 5-10% | Very high -- strong downside signal or squeeze risk |
| > 10% | Extreme -- short squeeze imminent |

**Desai et al. (2002) Empirical Evidence (NASDAQ):**

```
Long-Short portfolio (Q1 low SIR - Q5 high SIR):
  Monthly excess return = 1.18% (t-stat = 4.21)
  FF3-adjusted: still significant
  SIR prediction horizon: 1-3 months (strongest at 1 month)
```

**System Mapping:**

```
[API]  KRX short selling data -> download_shortselling.py -> data/derivatives/shortselling_summary.json
       Keys: market_short_ratio, marketTrend[].shortRatio, squeeze_candidates[]
[JS Load]  appWorker.js -> _shortSellingData global
           Source guard: rejected if source === "sample"
[Signal]   signalEngine.js::_detectShortInterest() L2597-2621
           -> shortHighSIR (buy, conf 56) when market short ratio > 8%
           -> shortSqueeze (buy, conf 63) when squeeze_candidates detected
[Confidence]  appWorker.js::_applyDerivativesConfidenceToPatterns() L794-805
           -> market_short_ratio > 10%: buy * 1.06, sell * 0.94
           -> market_short_ratio < 2%: buy * 0.97, sell * 1.03
[Display]  Signal diamond, short ratio in tooltip
```

**Academic Source:** Doc 40 S4, Desai et al. (2002), Boehmer, Jones & Zhang (2008).

---

### DRV-16: Days-to-Cover (DTC)

**Formula:**

```
DTC_t = shortBalance_t / avgDailyVolume(t-20, t)
```

**Symbol Table:**

| Symbol | Name | Unit |
|--------|------|------|
| DTC | Days-to-Cover | Trading days |
| shortBalance | Outstanding short positions | Shares |
| avgDailyVolume | 20-day average daily volume | Shares/day |

**Interpretation:**

| DTC Range | Cover Difficulty | Squeeze Risk |
|-----------|-----------------|--------------|
| < 1 | Easy | Low |
| 1-3 | Moderate | Watch level |
| 3-5 | Difficult | Significant |
| 5-10 | Very difficult | Elevated |
| > 10 | 2+ weeks to cover | Extreme |

**Hong et al. (2015): DTC Superior to SIR**

```
Long-Short portfolio (Low DTC - High DTC):
  Monthly excess return = 1.07% (t-stat = 3.12)
  Outperforms SIR-only portfolio
  DTC captures both magnitude (shortBalance) and liquidity (volume)
```

**Short Selling Composite Score (SSCS):**

```
SSCS_t = w1 * z(SIR_t) + w2 * z(DTC_t) + w3 * z(shortMomentum_t)

w1 = 0.35 (SIR level)
w2 = 0.40 (DTC -- strongest predictor per Hong et al. 2015)
w3 = 0.25 (momentum -- direction of change)

shortMomentum_t = (SIR_t - SIR_{t-20}) / SIR_{t-20} * 100
```

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| w1 (SIR weight) | 0.35 | [C] GCV | Academic consensus |
| w2 (DTC weight) | 0.40 | [C] GCV | Hong et al. (2015) finding |
| w3 (momentum weight) | 0.25 | [C] GCV | Change direction complements level |

**System Mapping:**

```
[Status] DTC and SSCS are not separately computed in the current pipeline.
The signalEngine._detectShortInterest() uses market_short_ratio (SIR-like) directly.
Individual stock DTC requires per-stock short balance data (available from KRX since 2025.03.31).
Priority: [C] -- implementable once per-stock short data pipeline is active.
```

**KRX Short Selling Participant Structure:**

```
Foreign: ~60-70% (primarily informational)
Institutional: ~25-30% (hedging + informational)
Retail: ~3-5% (limited, post-2025 partial lift)

-> Short selling on KRX carries higher per-unit information content
   than on US markets (regulatory barriers filter out noise trading)
```

**KRX Short Selling Ban History:**

| Period | Duration | Context |
|--------|----------|---------|
| 2008.10 - 2009.05 | 8 months | Global Financial Crisis |
| 2020.03 - 2021.05 | 14 months | COVID-19 pandemic |
| 2023.11 - 2025.03 | 17 months | Illegal naked short selling by global IBs |

Miller (1977) theory: During ban periods, bearish information is excluded from prices, causing systematic overpricing proportional to opinion divergence sigma^2_V.

**Academic Source:** Doc 40 S4-5, Desai et al. (2002), Hong et al. (2015), Miller (1977), Diamond & Verrecchia (1987).

---

### DRV-17: ETF Leverage Ratio Sentiment Indicator

**Formula:**

```
LR_t = Volume(KODEX Leverage) / Volume(KODEX Inverse)

Smoothed: LR_MA(t, n) = (1/n) * SUM_{k=0}^{n-1} LR_{t-k}   (n = 5)
```

**Symbol Table:**

| Symbol | Name | Unit |
|--------|------|------|
| LR | Leverage Ratio | Dimensionless |
| Volume(Leverage) | KODEX Leverage (2x) daily volume | Shares or KRW |
| Volume(Inverse) | KODEX Inverse (-1x) daily volume | Shares or KRW |

**Contrarian Interpretation:**

| LR Range | Sentiment | Contrarian Signal | Empirical (2015-2025) |
|----------|-----------|-------------------|----------------------|
| LR > 3.0 | Extreme bullish | Contrarian sell | 5-day avg return -0.8% |
| 0.5-2.0 | Neutral | No signal | -- |
| LR < 0.3 | Extreme bearish | Contrarian buy | 5-day avg return +1.2% |

**Volatility Drag Theory (Cheng & Madhavan 2009):**

```
E[R_lev(0,N)] ~= m * R_index(0,N) - 0.5 * m * (m-1) * sigma^2 * N

Annual volatility drag (KODEX 200 basis, sigma_daily ~= 1.2%):
  KODEX Leverage (2x):   ~= 3.6%
  KODEX Inverse (-1x):   ~= 3.6%
  KODEX Inverse 2X (-2x): ~= 10.9%
```

**Daily Rebalancing Market Impact:**

```
dPosition = AUM * m * (m - 1) * r_t

KODEX Leverage (AUM = 5T KRW, m = 2):
  Index +2%: 2,000B KRW additional buying near close
  Index -2%: 2,000B KRW selling near close
  -> Momentum amplification at close
```

**Constants Table:**

| Constant | Value | Grade | Justification | Location |
|----------|-------|-------|---------------|----------|
| LR extreme bullish | 3.0 | [C] GCV | Trainor (2010) -- UNVALIDATED for KRX | `signalEngine.js` L2580 |
| LR extreme bearish | 0.3 | [C] GCV | Trainor (2010) -- UNVALIDATED for KRX | `signalEngine.js` L2584 |
| ETF bullish contrarian mult | 0.95 (buy) / 1.05 (sell) | [C] GCV | Contrarian reversal logic | `appWorker.js` L788 |
| ETF bearish contrarian mult | 1.05 (buy) / 0.95 (sell) | [C] GCV | Contrarian reversal logic | `appWorker.js` L790 |

**UNVALIDATED WARNING:** The leverage ratio thresholds (3.0/0.3) are adapted from US leveraged ETF research (Trainor 2010). KRX investor composition differs substantially (retail 80%+ in leveraged ETFs vs ~40% in US). Separate KRX calibration is needed.

**System Mapping:**

```
[API]  KRX ETF data -> download_etf.py -> data/derivatives/etf_summary.json
       Keys: leverageSentiment.sentiment, leverageSentiment.leverageRatio
[JS Load]  appWorker.js -> _etfData global
[Signal]   signalEngine.js::_detectETFSentiment() L2573-2589
           -> etfBullishExtreme (sell, conf 55) when strong_bullish + ratio > 3.0
           -> etfBearishExtreme (buy, conf 55) when strong_bearish + ratio < 0.3
[Confidence]  appWorker.js::_applyDerivativesConfidenceToPatterns() L784-792
           -> strong_bullish: buy * 0.95, sell * 1.05 (contrarian)
           -> strong_bearish: buy * 1.05, sell * 0.95 (contrarian)
[Display]  Signal diamond, ETF ratio in tooltip
```

**ETF NAV and Premium/Discount:**

```
NAV_t = (SUM_i w_i * P_i,t + Cash_t - Expenses_t) / Shares_outstanding
PD_t = (P_etf,t - iNAV_t) / iNAV_t * 100  (%)

Premium: PD > 0 -> excess demand
Discount: PD < 0 -> excess supply
```

**Tracking Error:**

```
TE = sigma(R_etf - R_index) * sqrt(252)   (annualized)

KODEX 200: TE ~= 0.5-1.2% annual
KODEX Inverse: TE ~= 2-4% annual (daily rebalancing cost)
```

**Academic Source:** Doc 38 S2-3, Cheng & Madhavan (2009), Trainor (2010), Ben-David, Franzoni & Moussawi (2018).

---

## 2.7.5 Confidence Adjustment Pipeline Summary

The derivatives-related confidence adjustments flow through three functions in `appWorker.js`, applied sequentially:

```
Pattern Analysis Pipeline:
  patternEngine.analyze(candles) -> detectedPatterns
    -> _applyMacroConfidenceToPatterns()
    -> _applyMicroConfidenceToPatterns()
    -> _applyDerivativesConfidenceToPatterns()     [DRV-7 through DRV-17]
    -> _applyMertonDDToPatterns()
    -> _applyPhase8ConfidenceToPatterns()           [DRV-11 implied move, HMM, MCS]
    -> _applySurvivorshipAdjustment()
```

### _applyDerivativesConfidenceToPatterns() -- 7 Channels (L711-825)

| # | Channel | DRV | Data Source | Academic Basis | Adjustment Range |
|---|---------|-----|-----------|----------------|-----------------|
| 1 | Futures basis | DRV-8,10 | `_derivativesData.basisPct` | Bessembinder & Seguin (1993) | +/-5% to +/-8% |
| 2 | PCR contrarian | DRV-13 | `_derivativesData.pcr` | Pan & Poteshman (2006) | +/-8% |
| 3 | Investor alignment | DRV-14 | `_investorData.alignment` | Choe/Kho/Stulz (2005) | +8% / -7% |
| 4 | ETF leverage sentiment | DRV-17 | `_etfData.leverageSentiment` | Cheng & Madhavan (2009) | +/-5% |
| 5 | Short selling ratio | DRV-15 | `_shortSellingData.market_short_ratio` | Desai et al. (2002) | +6%/-3% to -6%/+3% |
| 6 | (ERP -- handled in signalEngine only) | -- | -- | -- | -- |
| 7 | USD/KRW export channel | -- | `_macroLatest.usdkrw` | Doc 28 S3, beta_FX | +/-5% |

**Overall clamp:** `adj in [0.70, 1.30]` (L816-817), then confidence clamped to `[10, 100]` (L819).

### _applyPhase8ConfidenceToPatterns() -- 3 Channels (L554-633)

| Channel | DRV | Data Source | Adjustment |
|---------|-----|-----------|------------|
| MCS (macro composite) | -- | `_macroComposite.mcsV2` | +5% direction alignment |
| HMM regime + foreign flow | DRV-14 | `_flowSignals.stocks[code]` | regime mult + 3% foreign alignment |
| Options implied move | DRV-1 | `_optionsAnalytics.analytics.straddleImpliedMove` | -5% when > 3% |

### signalEngine.js Signal Generation -- 6 Derivatives Signals

| Function | DRV | Signal Types Generated | Category |
|----------|-----|----------------------|----------|
| `_detectBasisSignal()` L2409 | DRV-8,10 | basisContango, basisBackwardation | derivatives |
| `_detectPCRSignal()` L2448 | DRV-13 | pcrFearExtreme, pcrGreedExtreme | derivatives |
| `_detectFlowSignal()` L2472 | DRV-14 | flowAlignedBuy/Sell, flowForeignBuy/Sell, flowLeadershipBuy/Sell | flow |
| `_detectERPSignal()` L2539 | -- | erpUndervalued, erpOvervalued | macro |
| `_detectETFSentiment()` L2573 | DRV-17 | etfBullishExtreme, etfBearishExtreme | sentiment |
| `_detectShortInterest()` L2597 | DRV-15 | shortHighSIR, shortSqueeze | flow |

### Data Pipeline Health

Pipeline status tracked in `_pipelineStatus`. Source guards:
- `_investorData` rejected if `source === "sample"` (appWorker.js L318-325)
- `_shortSellingData` rejected if `source === "sample"` (appWorker.js L318-325)
- `_optionsAnalytics` rejected if `status === "error"` (appWorker.js L461)
- `_flowSignals` rejected if `status === "error"` (appWorker.js L485)

### Expiration Day / Rollover Adjustments

| Market Event | Condition | Confidence Adjustment | Constant Grade |
|-------------|-----------|----------------------|----------------|
| Expiration day (D-0) | Options/futures expiry (2nd Thursday) | conf *= 0.70 | [C] Manual |
| Rollover period | D-3 to D-1 (quarterly futures) | conf *= 0.85 | [C] Manual |
| Sidecar trigger (active) | During 5-min halt (KOSPI200 futures +/-5%) | conf *= 0.50 | [A] Fixed |
| Sidecar trigger (post) | 5-60 min after halt | conf *= 0.75 | [C] Manual |
| Triple witching day | Quarterly expiry (3/6/9/12 month) | conf *= 0.65 | [C] Manual |

---

## 2.7.6 Findings

### Finding 1: BSM Implementation is Correct and Well-Guarded

**Severity:** None (informational)

The `compute_options_analytics.py` BSM implementation is verified correct:

1. Call and put formulas include the Merton continuous-dividend extension (q parameter) at L78-84.
2. Newton-Raphson uses proper Brenner-Subrahmanyam initial guess: `sigma_0 = C / (0.4 * S * sqrt(T))` at L115.
3. Vega guard (`vega < 1e-12`) prevents division by zero for deep ITM/OTM options at L121.
4. IV bounds [1%, 300%] are reasonable for KRX options, wider than the sanity check range (5%-200%) to avoid false rejections of crisis-period options.
5. Delta calculation correctly handles the continuous-dividend case at L136-148.
6. The 25-delta skew uses actual computed deltas, not approximated moneyness, at L325-333.
7. Intrinsic value check prevents negative time value from producing spurious IV at L108-110.

### Finding 2: VKOSPI Proxy Factor Lacks Rigorous Empirical Basis

**Severity:** Low (mitigated by DEPRECATED status)

The VIX_VKOSPI_PROXY = 1.12 constant is attributed to "Whaley (2009) KRX proxy" but Whaley's paper describes VIX methodology, not a KRX scaling factor. The empirical VKOSPI/VIX ratio varies from ~1.0 (normal) to ~1.5 (crisis). With 547+ days of direct VKOSPI data, the proxy fires only in truly offline scenarios. Maintain DEPRECATED status.

### Finding 3: GEX Calculation Not Yet Implemented

**Severity:** Low (aspirational, [D] tier)

The GEX formula (DRV-6) describes the dealer gamma hedging mechanism, but `compute_options_analytics.py` does not compute aggregate GEX. Individual option deltas and gammas are computable from BSM, but the aggregate `SUM(OI * Gamma * multiplier * S)` is not output. Correctly classified as [D] tier pending option chain OI data pipeline.

### Finding 4: Double-Application Prevention is Active

**Severity:** None (already fixed)

Explicit comments prevent double-application:
- ERP handled only in `signalEngine._detectERPSignal()` -- `appWorker.js` L807 notes this.
- DD (Distance-to-Default) removed from Phase8 to prevent 0.738x double discount.

### Finding 5: ETF Leverage Ratio Thresholds Are Unvalidated for KRX

**Severity:** Medium

The leverage ratio thresholds (LR > 3.0 extreme bullish, LR < 0.3 extreme bearish) are adapted from US research (Trainor 2010). KRX KODEX leveraged ETF investor composition (retail 80%+) differs substantially from US TQQQ/SQQQ (~40% retail). The thresholds need separate KRX backtesting calibration. The current implementation uses low confidence (55) which partially mitigates the risk.

**Recommendation:** When sufficient KODEX leverage/inverse volume history is available, conduct KRX-specific percentile-based threshold calibration (e.g., 5th/95th percentile of rolling 60-day LR distribution).

### Finding 6: Theta Formula Includes Dividend Term (Correct)

**Severity:** None (informational, FIX AUTHORITY verification)

The Theta formula in the existing anatomy (V5 L114) correctly includes the `+ q * S * e^(-qT) * N(d1)` dividend term from the Merton extension. This term is positive for calls and partially offsets time decay when q > 0. For KOSPI200 options with q ~= 1.7%, this term contributes ~0.002 to daily theta, which is minor but theoretically correct.

### Finding 7: Basis Z-Score Computation Uses Population Variance

**Severity:** Low (negligible for W=60)

`compute_basis.py` L192 uses `sum / len(window)` (population variance) rather than `sum / (len(window) - 1)` (sample variance). For the 60-day window, the difference is 1.7% (59/60 vs 60/60), which is negligible for signal thresholds. No fix required.

### Finding 8: Newton-Raphson Convergence Tolerance is Appropriate

**Severity:** None (informational)

NEWTON_TOL = 1e-6 provides sub-cent precision for KOSPI200 options. For ATM at sigma=0.20, S=350, T=1/12: Vega ~= 6.5. A 1e-6 price tolerance corresponds to sigma precision of ~1.5e-7 (0.000015%), far exceeding practical needs. The 50-iteration cap is generous; convergence typically occurs in 3-5 iterations.

### Finding 9: BSI Normalization Range (Cross-reference note)

**Severity:** None (informational, cross-reference)

The BOK Business Survey Index (BSI) used as a PMI proxy in macro signals (see S2_sec25_macroeconomics_v6.md FND-MAC-2) operates on a **0-200 scale**, not 0-100. The neutral level is 100 (not 50 as in PMI convention). `download_macro.py` comment at line 869 documents: `BSI는 0-200 스케일 (PMI 등가 = BSI/2)`.

`compute_macro_composite.py` normalizes BSI via `_normalize_range(bsi_mfg, *BSI_RANGE)` where `BSI_RANGE = (50, 120)`, mapping to [0, 1]. This is a sub-range normalization, not a full 0-200 → 0-100 centering. Code that reads `bsi_mfg` from `macro_latest.json` and compares against 50-based thresholds (PMI convention) will mis-read: a BSI of 100 (neutral) maps to PMI equivalent of 50 (also neutral), but any direct threshold like `bsi > 50` would always be true for a normal BSI reading.

**Recommendation:** Add explicit comments at every BSI consumption site noting the 0-200 scale. Consider normalizing at download time to a centered 0-100 scale (`bsi_centered = bsi - 100`) to prevent cross-file scale confusion.

---

## References

1. Black, F. & Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. *JPE*, 81(3), 637-654.
2. Merton, R.C. (1973). Theory of Rational Option Pricing. *Bell Journal of Economics*, 4(1), 141-183.
3. Cox, J.C., Ross, S.A. & Rubinstein, M. (1979). Option Pricing: A Simplified Approach. *JFE*, 7(3), 229-263.
4. Brenner, M. & Subrahmanyam, M.G. (1988). A Simple Formula to Compute the Implied Standard Deviation. *FAJ*, 44(5), 80-83.
5. Gatheral, J. (2006). *The Volatility Surface: A Practitioner's Guide*. Wiley.
6. Gatheral, J. & Jacquier, A. (2014). Arbitrage-Free SVI Volatility Surfaces. *QF*, 14(1), 59-71.
7. Heston, S.L. (1993). A Closed-Form Solution for Options with Stochastic Volatility. *RFS*, 6(2), 327-343.
8. Breeden, D.T. & Litzenberger, R.H. (1978). Prices of State-Contingent Claims Implicit in Option Prices. *JB*, 51(4), 621-651.
9. Bessembinder, H. & Seguin, P.J. (1993). Futures Trading Activity and Stock Price Volatility. *JF*, 48(5), 2015-2034.
10. Pan, J. & Poteshman, A.M. (2006). The Information in Option Volume for Future Stock Prices. *RFS*, 19(3), 871-908.
11. Whaley, R.E. (2000). The Investor Fear Gauge. *JPM*, 26(3), 12-17.
12. Whaley, R.E. (2009). Understanding the VIX. *JPM*, 35(3), 98-105.
13. Corsi, F. (2009). A Simple Approximate Long-Memory Model of Realized Volatility. *JFE*, 7(2), 174-196.
14. Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335.
15. Grossman, S.J. & Stiglitz, J.E. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.
16. Lakonishok, J., Shleifer, A. & Vishny, R.W. (1992). The Impact of Institutional Trading on Stock Prices. *JFE*, 32(1), 23-43.
17. Choe, H., Kho, B.-C. & Stulz, R. (2005). Do Domestic Investors Have an Edge? *RFS*, 18(3), 795-829.
18. Kang, J.-K. & Stulz, R.M. (1997). Why Is There a Home Bias? *JFE*, 46(1), 3-28.
19. Desai, H., Ramesh, K., Thiagarajan, S.R. & Balachandran, B.V. (2002). An Investigation of the Informational Role of Short Interest. *JF*, 57(5), 2263-2287.
20. Diamond, D.W. & Verrecchia, R.E. (1987). Constraints on Short-Selling and Asset Price Adjustment. *JFE*, 18(2), 277-311.
21. Boehmer, E., Jones, C.M. & Zhang, X. (2008). Which Shorts Are Informed? *JF*, 63(2), 491-527.
22. Miller, E.M. (1977). Risk, Uncertainty, and Divergence of Opinion. *JF*, 32(4), 1151-1168.
23. Hong, H., Li, W., Ni, S.X. & Scheinkman, J.A. (2015). Days to Cover and Stock Returns. *NBER Working Paper* No. 21166.
24. Gastineau, G.L. (2001). An Introduction to Exchange-Traded Funds. *JPM*, 27(3), 88-96.
25. Cheng, M. & Madhavan, A. (2009). The Dynamics of Leveraged and Inverse Exchange-Traded Funds. *JOIM*, 7(4), 43-62.
26. Ben-David, I., Franzoni, F. & Moussawi, R. (2018). Do ETFs Increase Volatility? *JF*, 73(6), 2471-2535.
27. Hull, J.C. (2021). *Options, Futures, and Other Derivatives*. 11th ed. Pearson.
28. Rubinstein, M. (1994). Implied Binomial Trees. *JF*, 49(3), 771-818.
29. Bates, D.S. (2000). Post-'87 Crash Fears in the S&P 500 Futures Option Market. *JoE*, 94(1-2), 181-238.
30. Roger Lee (2004). The Moment Formula for Implied Volatility at Extreme Strikes. *MF*, 14(3), 469-480.
31. Bakshi, G., Kapadia, N. & Madan, D. (2003). Stock Return Characteristics, Skew Laws, and Differential Pricing. *RFS*, 16(1), 101-143.
32. Natenberg, S. (2015). *Option Volatility and Pricing*. 2nd ed. McGraw-Hill.
33. Barber, B.M. & Odean, T. (2000). Trading Is Hazardous to Your Wealth. *JF*, 55(2), 773-806.
34. Trainor, W.J. (2010). Do Leveraged ETFs Increase Volatility? *Technology and Investment*, 1(3), 215-220.
35. Dupire, B. (1994). Pricing with a Smile. *Risk*, 7(1), 18-20.
36. Bris, A., Goetzmann, W.N. & Zhu, N. (2007). Efficiency and the Bear. *JF*, 62(3), 1029-1079.
37. Barber, B.M. & Odean, T. (2008). All That Glitters: Attention and Overtrading. *RFS*, 21(2), 785-818.
38. Petajisto, A. (2017). Inefficiencies in the Pricing of Exchange-Traded Funds. *FAJ*, 73(1), 24-54.
39. KRX (2009). VKOSPI Introduction. Korea Exchange Official Documentation.
40. CBOE (2003). VIX White Paper. Chicago Board Options Exchange.
