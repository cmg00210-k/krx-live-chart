# Stage 2 Part B: Academic Foundations -- Finance, Economics, and Psychology

> Theoretical coherence document for CheeseStock KRX Live Chart.
> Traces every implemented formula back to its academic discipline, key paper, and mathematical derivation.
> Stage color: Amber Dark #3D3000 | Version: V8 (2026-04-08)

---

## 2A. Economics

### 2A.1 Theoretical Foundation

Economics provides the macroeconomic and microeconomic context that governs equity
market behavior. CheeseStock consumes economic theory at two levels: (1) macro-level
business cycle and monetary policy signals that adjust pattern confidence, and
(2) micro-level market structure and agency theory that inform per-stock adjustments.

The core_data documents in this discipline are:

| Doc# | Title | Sub-discipline | Key Theories |
|------|-------|----------------|--------------|
| 09 | Game Theory | Strategic Interaction | Nash Equilibrium, Vickrey Auction, Signaling |
| 29 | Macro Sector Rotation | Business Cycle | Stovall (1996), OECD CLI, MCS Composite |
| 30 | Macroeconomics IS-LM AD-AS | Macro Theory | Hicks (1937) IS-LM, Taylor (1993) Rule, Mundell-Fleming |
| 31 | Microeconomics Market Signals | Micro Theory | Walrasian Equilibrium, Elasticity, HHI |
| 32 | Search Attention Pricing | Behavioral Economics | Stigler (1961), Peng-Xiong (2006), Barber-Odean (2008) |
| 33 | Agency Costs Industry Concentration | Corporate Economics | Jensen-Meckling (1976), Holmstrom (1979), HHI |

#### 2A.1.1 Macroeconomics: IS-LM, AD-AS, and Monetary Policy

The IS-LM model (Hicks 1937) provides the equilibrium framework for interest rate
and output determination. In CheeseStock, this manifests as the Taylor Rule gap:

**Taylor Rule** (Taylor 1993):

```
i* = r* + pi + 0.5(pi - pi*) + 0.5(y - y*)
```

where `i*` is the target nominal rate, `r*` is the equilibrium real rate (typically 2%),
`pi` is observed inflation, `pi*` is the target inflation rate, and `(y - y*)` is the
output gap. The Taylor gap is:

```
Taylor_gap = i_actual - i*
```

A positive Taylor gap indicates contractionary monetary policy (rates above equilibrium),
bearish for equity markets. A negative gap indicates accommodative policy, bullish for
equities. This feeds directly into confidence Factor F7.

The **Mundell-Fleming** extension (Mundell 1963, Fleming 1962) introduces the open
economy dimension. For Korea -- a small open economy with managed exchange rates --
the capital account channel is critical:

```
Capital Flow = f(i_domestic - i_foreign, E[exchange_rate])
```

The BOK-Fed rate differential (confidence Factor F9) captures this: when Korean rates
fall below US rates, capital outflow pressure increases, creating headwinds for Korean
equities. Implementation: `_applyMacroConfidenceToPatterns()` Factor F9, clamp [0.70, 1.25].

The **AD-AS framework** provides the business cycle classification used in Stovall
sector rotation. Aggregate demand shocks (IS shifts) vs supply shocks (AS shifts)
determine the cycle phase:

| Phase | AD/AS | Output | Inflation | Equity Impact |
|-------|-------|--------|-----------|---------------|
| Early Expansion | AD shifts right, AS stable | Rising | Low | Bullish |
| Late Expansion | AD strong, AS tightens | Peak | Rising | Mixed |
| Early Contraction | AD shifts left | Falling | Peak | Bearish |
| Late Contraction | AD weak, AS loosens | Trough | Falling | Bottoming |

#### 2A.1.2 Sector Rotation: Stovall (1996)

Sam Stovall's "Sector Investing" (1996) documents the empirical relationship between
business cycle phases and sector performance using S&P 500 data from 1953 to 1996.
The key insight is that sectors have differential sensitivity to the economic cycle:

```
Sector_Return_Excess = beta_cycle * CyclePhase + epsilon
```

CheeseStock implements this via `_STOVALL_CYCLE` mapping in `appState.js`, with a
critical KRX adaptation: all cycle-sensitivity coefficients are dampened by 0.5x
because Stovall's empirical results are calibrated on US S&P 500 data and have
not been independently validated on KRX/KOSPI/KOSDAQ data.

Implementation: Confidence Factor F1a in `_applyMacroConfidenceToPatterns()`.

#### 2A.1.3 MCS (Macro Composite Score)

The Macro Composite Score synthesizes multiple macro signals into a single 0-100 metric:

```
MCS_v2 = w1*CLI + w2*CCI + w3*Taylor + w4*CreditSpread + w5*YieldCurve + ...
```

MCS is computed offline by `scripts/compute_mcs.py` and loaded from
`data/macro/macro_composite.json`. It feeds confidence Factor F6
(+/-10% max adjustment) and Phase 8 factor P8-1.

#### 2A.1.4 KOSIS CLI-CCI Gap

The gap between the OECD Composite Leading Indicator (CLI) and the Coincident
Composite Index (CCI) captures the business cycle's leading-vs-lagging dynamics:

```
CLI_CCI_gap = CLI - CCI
```

When the gap exceeds +5pp, the leading indicator is accelerating relative to current
conditions (bullish). When the gap falls below -5pp, a slowdown is signaled.
Implementation: Factor F11, +/-4%.

#### 2A.1.5 Microeconomics: Supply, Demand, and Market Structure

**Walrasian equilibrium** (Walras 1874) provides the foundational price-clearing
mechanism: prices adjust until excess demand equals zero. In CheeseStock, this
principle underlies the assumption that observed prices reflect the intersection of
supply and demand -- deviations from which technical patterns attempt to identify.

**Elasticity** concepts from Marshall (1890) inform how responsive stock prices are
to volume changes. Highly elastic stocks (large-cap, liquid) exhibit smaller
price-per-volume impact; highly inelastic stocks (small-cap, illiquid) exhibit larger
moves per unit volume. This connects directly to the Amihud ILLIQ measure (I-28).

**HHI (Herfindahl-Hirschman Index)** measures industry concentration:

```
HHI = sum(s_i^2) for all firms i in industry
```

where `s_i` is firm `i`'s market share. Higher concentration (HHI > 2500) implies
greater market power and potentially faster mean-reversion in stock prices due to
stable oligopolistic earnings. Implementation: Micro Factor M2 in
`_applyMicroConfidenceToPatterns()`, `HHI_MEAN_REV_COEFF` boost of +10% * HHI.

#### 2A.1.6 Agency Theory

Jensen and Meckling (1976) "Theory of the Firm" established that separation of
ownership and control creates agency costs. In the Korean chaebol context, this is
particularly relevant:

- **Tunneling**: Controlling shareholders may extract value through related-party
  transactions, reducing minority shareholder returns
- **EPS Stability Mediator**: Agency costs are mediated through earnings stability --
  firms with stable EPS face lower agency discount. This connects Doc 33 to
  `eps_stability` in the micro confidence layer

Holmstrom (1979) extends this with the informativeness principle: only signals that
are informative about agent effort should be used in compensation contracts. By
analogy, only pattern signals that are informationally efficient (IC > 0) should
receive confidence weight.

#### 2A.1.7 Search Theory and Attention Pricing

Stigler (1961) "The Economics of Information" introduced search costs: investors
face costs in acquiring and processing information, leading to imperfect price
discovery. Peng and Xiong (2006) formalize this as an attention allocation model:

```
Attention Budget: sum(a_i) <= A_total
```

Investors allocate limited attention across stocks, creating predictable pricing
patterns. High-attention events (news, volume spikes) attract attention away from
other stocks, creating temporary mispricing in neglected securities.

Barber and Odean (2008) document that individual investors are net buyers of
attention-grabbing stocks, creating short-term overpricing that reverses. This
provides theoretical justification for OBV divergence signals (S-20) and volume
breakout signals (S-19).

Implementation: `calcADVLevel()` (planned), `calcAttentionState()` (planned).
Currently, volume-based signals serve as proxies for attention-driven pricing.


### 2A.2 Mathematical Formulation

#### MF-2A.1: Taylor Rule Gap

```
i* = r* + pi_t + alpha_pi * (pi_t - pi*) + alpha_y * (y_t - y*)
TaylorGap = (BOK_rate - i*) / sigma_gap
```

where `alpha_pi = alpha_y = 0.5` (Taylor's original coefficients), `sigma_gap` is
the historical standard deviation for normalization to [-1, +1].

Confidence adjustment: `conf *= 1.0 + 0.05 * TaylorGap_normalized`

#### MF-2A.2: Rate Differential (Mundell-Fleming)

```
rate_diff = BOK_rate - Fed_rate
```

When `rate_diff < -0.5%`: capital outflow pressure, `conf *= 0.95` (buy patterns).
When `rate_diff > +0.5%`: capital inflow support, `conf *= 1.05` (buy patterns).

#### MF-2A.3: Herfindahl-Hirschman Index

```
HHI = sum_{i=1}^{N} s_i^2,  s_i = Revenue_i / Revenue_industry
```

where `s_i` is firm `i`'s market share by revenue. HHI ranges from 1/N (perfect
competition) to 1 (monopoly). US DOJ thresholds: < 1500 competitive, 1500-2500
moderate, > 2500 concentrated.

Confidence adjustment:
```
conf *= 1.0 + HHI_MEAN_REV_COEFF * HHI_normalized
```

#### MF-2A.4: MCS v2 Composite

```
MCS_v2 = sum_{k=1}^{K} w_k * z_k
```

where `z_k` is the z-score of macro factor `k` and `w_k` is its weight.
The score is mapped to [0, 100] and applied as:

```
if (MCS > 70) conf *= 1.05   // strong macro tailwind
if (MCS < 30) conf *= 0.95   // strong macro headwind
```

#### MF-2A.5: CLI-CCI Gap

```
gap = CLI_index - CCI_index
```

Adjustment: `conf *= 1.0 + 0.04 * sign(gap)` when `|gap| > 5pp`.


### 2A.3 Forward Derivation Table

| Academic Theory | Key Paper | Stage 3 Formula ID | JS Function | Connection |
|---|---|---|---|---|
| IS-LM / Taylor Rule | Hicks (1937), Taylor (1993) | CONF-F7 | `_applyMacroConfidenceToPatterns()` | Taylor gap -> +/-5% confidence |
| Mundell-Fleming | Mundell (1963) | CONF-F9 | `_applyMacroConfidenceToPatterns()` | Rate differential -> +/-5% |
| Stovall Sector Rotation | Stovall (1996) | CONF-F1a | `_applyMacroConfidenceToPatterns()` | Cycle phase -> sector multiplier |
| AD-AS Business Cycle | — (textbook) | CONF-F1 | `_applyMacroConfidenceToPatterns()` | Cycle -> +/-6-10% |
| MCS Composite | Docs 29, 30 | CONF-F6, P8-1 | `_applyMacroConfidenceToPatterns()`, `_applyPhase8ConfidenceToPatterns()` | MCS -> +/-10% |
| CLI-CCI Gap | OECD methodology | CONF-F11 | `_applyMacroConfidenceToPatterns()` | Gap -> +/-4% |
| HHI Industry Conc. | Herfindahl, Jensen-Meckling (1976) | CONF-M2 | `_applyMicroConfidenceToPatterns()` | HHI -> mean-reversion boost |
| Walrasian Price Discovery | Walras (1874) | I-28 | `calcAmihudILLIQ()` | Liquidity -> confidence discount |
| Agency Theory | Jensen-Meckling (1976) | CONF-M2 | `_applyMicroConfidenceToPatterns()` | EPS stability mediator |
| Search Costs / Attention | Stigler (1961), Barber-Odean (2008) | S-19, S-20 | `signalEngine` volume signals | Attention -> volume breakout |
| Nash Equilibrium / Signaling | Nash (1950), Spence (1973) | — | Not directly implemented | Theoretical foundation only |

---

## 2B. Finance

### 2B.1 Theoretical Foundation

Finance theory constitutes the largest academic pillar of CheeseStock, spanning
15 core_data documents. The coverage ranges from foundational asset pricing models
to advanced credit risk and derivatives theory.

| Doc# | Title | Sub-discipline | Key Theories |
|------|-------|----------------|--------------|
| 05 | Finance Theory | Asset Pricing | EMH, MPT, CAPM, BSM |
| 14 | Finance Management | Corporate Finance | DCF, Capital Structure, Kelly, Risk |
| 23 | APT Factor Model | Factor Models | Ross (1976) APT, FF3, FF5 |
| 25 | CAPM Delta Covariance | CAPM Extensions | Ledoit-Wolf, Delta Covariance |
| 26 | Options Volatility Signals | Derivatives | VKOSPI, IV/HV, PCR, GEX |
| 27 | Futures Basis Program Trading | Derivatives | Cost-of-Carry, Basis, OI |
| 28 | Cross-Market Correlation | Cross-Asset | DCC-GARCH, VIX Transmission |
| 35 | Bond Signals Yield Curve | Fixed Income | NSS, Credit Spread, Rate Beta |
| 36 | Futures Microstructure OI | Microstructure | OI-Price Quadrant, Hasbrouck |
| 37 | Options IV Surface Skew | Derivatives | SVI, Skew, GEX, UOA |
| 38 | ETF Ecosystem Fund Flow | ETF Analytics | Creation/Redemption, Leverage |
| 39 | Investor Flow Information | Microstructure | Kyle 3-Type, Foreign Flow |
| 40 | Short Selling Securities Lending | Microstructure | Miller, Diamond-Verrecchia |
| 41 | Bond-Equity Relative Value | Cross-Asset | Fed Model, ERP, RORO |
| 42 | Advanced Asset Pricing | Asset Pricing | Zero-Beta, ICAPM, CCAPM, FF5 |
| 43 | Corporate Finance Advanced | Corporate Finance | MM Tax, Signaling, EVA |
| 44 | Bond Pricing Duration | Fixed Income | YTM, Duration, DV01, Convexity |
| 45 | Options Pricing Advanced | Derivatives | CRR, Heston, Local Vol |
| 46 | Options Strategies | Applied Derivatives | Greeks, Gamma Scalping, Straddle |
| 47 | Credit Risk Models | Credit Risk | Merton (1974), KMV, Basel IRB |

#### 2B.1.1 Classical Asset Pricing

**Efficient Market Hypothesis (EMH)** -- Fama (1970) "Efficient Capital Markets":

Three forms of market efficiency define what information is reflected in prices:
- **Weak form**: Prices reflect all past trading data (historical prices, volumes)
- **Semi-strong form**: Prices reflect all publicly available information
- **Strong form**: Prices reflect all information including insider knowledge

CheeseStock operates at the boundary of weak-form efficiency: technical patterns
attempt to extract predictive information from historical price data. The system's
IC measurements (Grinold-Kahn 2000) provide empirical evidence on whether patterns
have residual predictive power. The measured IC of 0.051 (t=3.73) from Huber-IRLS
regression suggests statistically significant but economically modest predictability.

**Modern Portfolio Theory (MPT)** -- Markowitz (1952) "Portfolio Selection":

```
min sigma_p^2 = w' * Sigma * w
s.t. w' * mu = mu_target, w' * 1 = 1
```

While CheeseStock does not implement full portfolio optimization, the mean-variance
framework underpins the risk-return tradeoff displayed in the backtester:

- Expected return: WLS-predicted N-day return
- Risk: ATR-based volatility proxy + HC3 standard errors
- Sharpe-like metric: (mean_return - KRX_COST) / std_return

**Capital Asset Pricing Model (CAPM)** -- Sharpe (1964), Lintner (1965):

```
E[R_i] = R_f + beta_i * (E[R_m] - R_f)
```

The CAPM is directly implemented as `calcCAPMBeta()` (I-12) with:
- Market proxy: KOSPI index for KOSPI stocks, KOSDAQ index for KOSDAQ stocks
- Risk-free rate: KTB 10Y yield from `bonds_latest.json`
- Window: 250 trading days (KRX_TRADING_DAYS)
- Scholes-Williams (1977) thin-trading correction when zero-volume days exceed 10%

Jensen's Alpha:
```
alpha_i = R_i - [R_f + beta_i * (R_m - R_f)]
```

Annualized as `alpha * KRX_TRADING_DAYS` in `calcCAPMBeta()` and confirmed in
`backtester._calcJensensAlpha()`.

#### 2B.1.2 Extended Asset Pricing

**Zero-Beta CAPM** -- Black (1972):

When a risk-free asset does not exist (or borrowing at the risk-free rate is
restricted), the CAPM becomes:

```
E[R_i] = E[R_z] + beta_i * (E[R_m] - E[R_z])
```

where `R_z` is the return on the zero-beta portfolio. This is theoretically
documented in Doc 42 but not directly implemented, as KTB 10Y serves as an
adequate risk-free proxy.

**Intertemporal CAPM (ICAPM)** -- Merton (1973):

```
E[R_i] - R_f = beta_{i,m} * lambda_m + sum_k beta_{i,k} * lambda_k
```

The ICAPM introduces hedging demand for state variables that predict future
investment opportunities. In CheeseStock, the VKOSPI regime classification (S-28)
and VRP (I-14) serve as proxies for these state variables. When volatility is
elevated, hedging demand increases, altering the cross-section of expected returns.

**APT (Arbitrage Pricing Theory)** -- Ross (1976):

```
R_i = alpha_i + sum_{k=1}^{K} beta_{i,k} * F_k + epsilon_i
```

The APT provides theoretical justification for multi-factor confidence adjustments.
Each confidence layer in CheeseStock corresponds to a systematic risk factor:

- Layer 1 (Macro): Business cycle factor, monetary policy factor
- Layer 2 (Micro): Liquidity factor (Amihud), concentration factor (HHI)
- Layer 3 (Derivatives): Volatility factor (VKOSPI), sentiment factor (PCR)
- Layer 6 (RORO): Global risk appetite factor

**Fama-French 3-Factor** -- Fama and French (1993):

```
R_i - R_f = alpha + beta_MKT * (R_m - R_f) + beta_SMB * SMB + beta_HML * HML + epsilon
```

FF3 factors are constructed offline via `scripts/compute_ff3.py` using 2x3 sorts
on size (market cap) and value (B/M ratio). Constants #168-#171 in `appState.js`
define the factor loadings. SMB (Small Minus Big) captures the size premium;
HML (High Minus Low) captures the value premium.

**Fama-French 5-Factor** -- Fama and French (2015):

```
R_i - R_f = alpha + b*MKT + s*SMB + h*HML + r*RMW + c*CMA + epsilon
```

RMW (Robust Minus Weak) captures profitability; CMA (Conservative Minus Aggressive)
captures investment. Documented in Doc 42 but not yet implemented in JS.

#### 2B.1.3 Fixed Income Theory

**Bond Pricing** -- The fundamental bond pricing equation (Doc 44):

```
P = sum_{t=1}^{T} C / (1 + y)^t + F / (1 + y)^T
```

where `C` is coupon, `F` is face value, `y` is yield to maturity, `T` is maturity.

**Duration** -- Macaulay (1938):

```
D_mac = (1/P) * sum_{t=1}^{T} t * CF_t / (1 + y)^t
```

Modified duration: `D_mod = D_mac / (1 + y/m)` where `m` is compounding frequency.

**DV01** (Dollar Value of a Basis Point):

```
DV01 = -dP/dy * 0.0001 = D_mod * P * 0.0001
```

DV01 is computed by `scripts/compute_bond_metrics.py` and displayed in
`financials.js`.

**Nelson-Siegel-Svensson (NSS) Yield Curve** -- Nelson and Siegel (1987),
Svensson (1994):

```
y(tau) = beta_0 + beta_1 * ((1-e^(-tau/tau_1))/(tau/tau_1))
         + beta_2 * ((1-e^(-tau/tau_1))/(tau/tau_1) - e^(-tau/tau_1))
         + beta_3 * ((1-e^(-tau/tau_2))/(tau/tau_2) - e^(-tau/tau_2))
```

The yield curve shape determines the 4-regime classification in confidence Factor F2:

| Regime | Yield Curve | Equity Impact |
|--------|-------------|---------------|
| Bull Steep | Normal, steepening | +3-5% confidence |
| Bull Flat | Normal, flattening | +0-3% confidence |
| Bear Steep | Inverted, steepening | -3-7% confidence |
| Bear Flat | Inverted, flattening | -7-12% confidence |

Harvey (1986) documented that an inverted yield curve predicts recessions with
high accuracy. Implementation: Confidence Factor F2 in `_applyMacroConfidenceToPatterns()`.

**Credit Spreads** -- Gilchrist and Zakrajsek (2012):

The excess bond premium (EBP) captures credit market conditions beyond default risk.
CheeseStock uses AA- corporate bond spread as a proxy:

```
Credit_spread = AA_corporate_yield - KTB_yield
```

Elevated spreads indicate credit stress, reducing pattern confidence for buy signals.
Implementation: Factor F3, -7% to -18% for buy patterns.

#### 2B.1.4 Derivatives Theory

**Black-Scholes-Merton** -- Black and Scholes (1973), Merton (1973):

```
C = S * N(d1) - K * e^(-rT) * N(d2)
d1 = (ln(S/K) + (r + sigma^2/2) * T) / (sigma * sqrt(T))
d2 = d1 - sigma * sqrt(T)
```

While BSM option pricing is not directly computed in the browser, the framework
provides:

1. **Implied Volatility** (IV): Market's expectation of future realized volatility,
   embedded in option prices. VKOSPI is the KRX's official IV index.
2. **Greeks**: Delta, Gamma, Vega, Theta -- used in options analytics
   (`data/derivatives/options_analytics.json`)
3. **Merton DD**: Equity as a European call on firm assets (see 2B.1.6)

**Cost-of-Carry Model** -- Working (1949), extended by Hull (2018):

```
F_0 = S_0 * e^{(r - d) * T}
```

where `F_0` is futures price, `S_0` is spot, `r` is risk-free rate, `d` is dividend
yield, `T` is time to maturity. The basis is:

```
Basis = F_0 - S_0
BasisPct = (F_0 - S_0) / S_0 * 100
```

When basis exceeds theoretical fair value (excess basis), it signals institutional
positioning. Implementation: `_detectBasisSignal()`, confidence Factor D1.

**Put/Call Ratio (PCR)** -- Pan and Poteshman (2006):

```
PCR = Put_Volume / Call_Volume
```

Extreme PCR values are contrarian signals:
- PCR > 1.3: Excessive fear -> bullish contrarian (confidence +6%)
- PCR < 0.5: Excessive complacency -> bearish contrarian (confidence -6%)

Implementation: Signal S-22, confidence Factor D2.

**VKOSPI Regime** -- Whaley (2009):

VKOSPI (Volatility Index of KOSPI) is derived from KOSPI 200 option prices using
the VIX methodology. CheeseStock classifies four regimes:

| Regime | VKOSPI Level | Confidence Impact |
|--------|-------------|-------------------|
| Crisis | > 35 | Buy: x0.65, Sell: x1.15 |
| High | 25-35 | Buy: x0.80, Sell: x1.05 |
| Normal | 15-25 | No adjustment |
| Low | < 15 | No adjustment |

VIX proxy: `VKOSPI_approx = VIX * 1.12` when VKOSPI data unavailable.
Implementation: Signal S-28, confidence Factor in Layer 3.

**IV/HV Ratio** -- Simon and Wiggins (2001):

```
IV_HV_ratio = VKOSPI^2 / HV_Parkinson^2
```

When IV/HV > 1.5, option markets price in significantly more volatility than
realized, indicating elevated uncertainty. This dampens pattern confidence by
-7% to -10%. Implementation: Signal S-27, Phase 8 Factor P8-4.

**Straddle Implied Move** -- From Doc 46:

```
Expected_Move = Straddle_Price / Underlying_Price
```

The at-the-money straddle price reflects the market's expected absolute move.
Implementation: `straddleImpliedMove` from `options_analytics.json` feeds
confidence adjustments in `_applyPhase8ConfidenceToPatterns()`.

#### 2B.1.5 Corporate Finance

**DCF Valuation** (Doc 14):

```
V = sum_{t=1}^{T} FCF_t / (1 + WACC)^t + TV / (1 + WACC)^T
```

**WACC**:

```
WACC = E/(E+D) * r_e + D/(E+D) * r_d * (1 - T_c)
```

where `r_e = R_f + beta * ERP` (CAPM-derived cost of equity).

**Modigliani-Miller** -- MM (1958):

Proposition I (no taxes): Capital structure irrelevance -- firm value independent
of debt/equity mix. Proposition II: Cost of equity rises linearly with leverage.
With taxes (Miller 1977): Tax shield creates value from debt.

**EVA (Economic Value Added)** -- Stern Stewart:

```
EVA = NOPAT - WACC * Invested_Capital
```

Computed by `scripts/compute_eva.py`, displayed in `financials.js`.

**Valuation Metrics** displayed in the financial panel (D column):

| Metric | Formula | Academic Basis |
|--------|---------|---------------|
| PER | Price / EPS | Graham and Dodd (1934) |
| PBR | Price / BPS | Tobin's Q proxy |
| PSR | Market Cap / Revenue | O'Shaughnessy (1998) |
| ROE | Net Income / Equity | DuPont decomposition |
| ROA | Net Income / Total Assets | Profitability measure |
| EV/EBITDA | Enterprise Value / EBITDA | Practitioner standard |

#### 2B.1.6 Credit Risk

**Merton Structural Model** -- Merton (1974):

Equity is a European call option on the firm's assets:

```
E = V * N(d1) - D * e^(-rT) * N(d2)
d1 = (ln(V/D) + (r + sigma_V^2/2) * T) / (sigma_V * sqrt(T))
d2 = d1 - sigma_V * sqrt(T)
```

**Distance-to-Default (DD)**:

```
DD = (ln(V/D) + (mu - 0.5 * sigma_V^2) * T) / (sigma_V * sqrt(T))
```

**Expected Default Frequency (EDF)**:

```
EDF = N(-DD)
```

CheeseStock implements the Bharath-Shumway (2008) naive approximation:
- `V approx E + D` (face value of debt)
- `sigma_V approx sigma_E * E/V + sigma_D * D/V` where `sigma_D = 0.05 + 0.25 * sigma_E`

Implementation: `_calcNaiveDD()` in `appWorker.js`, confidence Layer 4.
Financial sector excluded (bank debt is operating assets, not financial distress).

DD confidence penalty schedule:

| DD Range | Buy Pattern Adjustment | Sell Pattern Adjustment |
|----------|----------------------|------------------------|
| DD < 1.0 | x0.75 | No change |
| DD 1.0-1.5 | x0.82 | No change |
| DD 1.5-2.0 | x0.90 | No change |
| DD 2.0-3.0 | x0.95 | No change |
| DD > 3.0 | No change | No change |

#### 2B.1.7 Market Microstructure

**Kyle Lambda** -- Kyle (1985) "Continuous Auctions and Insider Trading":

```
lambda = sigma_v / (sigma_u * sqrt(n))
```

where `lambda` is the market impact coefficient, `sigma_v` is fundamental value
volatility, `sigma_u` is noise trader volatility, and `n` is the number of
informed traders. The key insight: price impact scales with `sqrt(h)` where `h`
is the holding period. This is directly used in the horizon cost model:

```
slippage_h = slippage_1 / sqrt(h)
```

Implementation: `backtester._horizonCost(h)`.

**Amihud ILLIQ** -- Amihud (2002):

```
ILLIQ = (1/D) * sum_{t=1}^{D} |r_t| / DVOL_t
```

Implementation: `calcAmihudILLIQ()` (I-28). See Stage 3 indicator card I-28.

**Grossman-Stiglitz Paradox** -- Grossman and Stiglitz (1980):

Markets cannot be perfectly efficient because there would be no incentive to
acquire information. This provides theoretical justification for the entire
technical analysis enterprise: some fraction of traders must earn returns from
information acquisition to sustain market efficiency.

**Foreign Flow Information** -- Kang and Stulz (1997), Choe, Kho, and Stulz (2005):

Foreign institutional investors in Korea tend to be better informed than domestic
retail investors. Their net buying/selling provides information about future returns.
Implementation: Signal S-23, confidence Factor D3 (+/-8%).

**Short Selling** -- Miller (1977), Diamond and Verrecchia (1987):

Miller's overvaluation hypothesis: short-sale constraints cause overpricing because
pessimists cannot express their views. When short-selling is banned (as KRX did in
2020-03 and 2023-11), overpricing is expected to increase.

Diamond-Verrecchia (1987): Short-selling restrictions reduce the speed of price
discovery for negative information. Implementation: Micro Factor M3
(-10% to -30% confidence for buy patterns during ban periods),
`_SHORT_BAN_PERIODS` in `appState.js`.

Short interest ratio regime (Signal S-26):
- SIR > 3%: High short interest -> potential squeeze (+6% buy confidence)
- SIR < 0.5%: Low short interest -> no constraint signal

#### 2B.1.8 Cross-Asset and RORO

**RORO (Risk-On/Risk-Off)** -- Baele, Bekaert, and Inghelbrecht (2010):

The RORO regime classifies the global risk appetite state using a 5-factor composite:

```
RORO = 0.30*VKOSPI + 0.05*CreditSpread_AA + 0.10*HY_Spread + 0.20*USD_KRW + 0.15*MCS + 0.15*InvestorAlign
```

Three regimes with hysteresis transition (Baele et al. 2010):
- Risk-On: RORO > +0.25 (entry) / +0.10 (exit) -> buy confidence +8%
- Neutral: -0.25 < RORO < +0.25
- Risk-Off: RORO < -0.25 (entry) / -0.10 (exit) -> sell confidence +8%

Implementation: `_applyRORORegimeToPatterns()`, confidence Layer 6, clamp [0.92, 1.08].

**Fed Model / ERP** -- Asness (2003):

```
ERP = Earnings_Yield - Government_Bond_Yield = E/P - Y_10Y
```

When ERP is high (z-score > +1.5), equities are cheap relative to bonds.
Implementation: Signal S-24.

**USD/KRW Export Channel** (Doc 28):

Korean export-oriented companies have FX exposure. A weakening KRW (rising
USD/KRW) benefits exporters but may signal capital outflow pressure.

```
FX_impact = beta_FX * (USD_KRW_change)
```

Implementation: Confidence Factor D7, +/-5%.


### 2B.2 Mathematical Formulation

#### MF-2B.1: CAPM Beta (Sharpe 1964)

```
beta_i = Cov(R_i, R_m) / Var(R_m)
```

Excess return form with Rf:
```
R_i^e = R_i - R_f,  R_m^e = R_m - R_f
beta = sum[(R_i^e - mean(R_i^e)) * (R_m^e - mean(R_m^e))] / sum[(R_m^e - mean(R_m^e))^2]
```

Scholes-Williams (1977) correction for thin trading:
```
beta_SW = (beta_{-1} + beta_0 + beta_{+1}) / (1 + 2 * rho_m)
```

where `beta_{-1}` uses lagged market returns, `beta_{+1}` uses lead market returns,
and `rho_m` is the first-order autocorrelation of market returns.

Jensen's Alpha (annualized):
```
alpha = (mean(R_i^e) - beta * mean(R_m^e)) * KRX_TRADING_DAYS
```

#### MF-2B.2: Merton Distance-to-Default

Naive DD (Bharath-Shumway 2008):
```
V = E + D
sigma_V = sigma_E * (E/V) + (0.05 + 0.25*sigma_E) * (D/V)
DD = (ln(V/D) + (mu - 0.5*sigma_V^2)*T) / (sigma_V * sqrt(T))
EDF = N(-DD)
```

where `E` = market cap, `D` = total debt, `sigma_E` = equity volatility,
`T` = 1 year, `mu` = expected return (approximated by risk-free rate).

#### MF-2B.3: VRP (Variance Risk Premium)

Bollerslev (2009):
```
VRP = sigma_IV^2 - sigma_RV^2
    = (VKOSPI/100)^2 - HV_Parkinson^2
```

where `HV_Parkinson` is from I-13 (annualized).

#### MF-2B.4: Cost-of-Carry Basis

```
Fair_Basis = S_0 * (e^{(r-d)*T} - 1)
Excess_Basis = Observed_Basis - Fair_Basis
BasisPct = Basis / S_0 * 100
```

#### MF-2B.5: RORO 5-Factor Composite

```
RORO = sum_{k=1}^{5} w_k * z_k(factor_k)
```

Hysteresis:
```
if (RORO > 0.25 && prev_regime != 'risk_on') regime = 'risk_on'
if (RORO < -0.25 && prev_regime != 'risk_off') regime = 'risk_off'
// Exit thresholds narrower to prevent oscillation:
if (regime == 'risk_on' && RORO < 0.10) regime = 'neutral'
if (regime == 'risk_off' && RORO > -0.10) regime = 'neutral'
```


### 2B.3 Forward Derivation Table

| Academic Theory | Key Paper | Stage 3 Formula ID | JS Function | Connection |
|---|---|---|---|---|
| CAPM | Sharpe (1964) | I-12 | `calcCAPMBeta()` | Beta, alpha -> per-stock risk metric |
| CAPM Jensen's Alpha | Jensen (1968) | B-6 | `backtester._calcJensensAlpha()` | Excess return measurement |
| Fama-French 3-Factor | Fama-French (1993) | FF3 #168-#171 | `appState.js` constants | SMB/HML factor construction |
| MPT Mean-Variance | Markowitz (1952) | — | Backtester risk-return display | Framework for portfolio context |
| EMH Weak Form | Fama (1970) | B-1 | `backtester._spearmanCorr()` | IC tests EMH boundary |
| BSM IV Framework | Black-Scholes (1973) | I-14 | `calcVRP()` | IV^2 - HV^2 = VRP |
| VKOSPI Regime | Whaley (2009) | S-28 | `_classifyVolRegimeFromVKOSPI()` | Vol regime -> confidence |
| Cost-of-Carry | Working (1949) | S-21 | `_detectBasisSignal()` | Basis -> +/-4-7% |
| PCR Contrarian | Pan-Poteshman (2006) | S-22 | `signalEngine` | PCR extreme -> +/-6% |
| Merton DD | Merton (1974), Bharath-Shumway (2008) | CONF-DD1 | `_calcNaiveDD()`, `_applyMertonDDToPatterns()` | DD -> -5 to -25% buy conf |
| Kyle Lambda | Kyle (1985) | B-10 | `backtester._horizonCost()` | sqrt(h) slippage scaling |
| Amihud ILLIQ | Amihud (2002) | I-28, CONF-M1 | `calcAmihudILLIQ()` | Liquidity -> -15% max |
| Miller Overvaluation | Miller (1977) | S-26, CONF-M3 | Short ban / ratio regime | Ban -> -10 to -30% |
| Foreign Flow | Kang-Stulz (1997) | S-23, CONF-D3 | Flow alignment signal | +/-8% confidence |
| Diamond-Verrecchia | Diamond-Verrecchia (1987) | CONF-M3 | `_SHORT_BAN_PERIODS` | Price discovery impairment |
| NSS Yield Curve | Nelson-Siegel (1987) | CONF-F2 | Yield curve 4-regime | +/-3-12% confidence |
| Credit Spread | Gilchrist-Zakrajsek (2012) | CONF-F3 | AA- spread threshold | -7 to -18% buy |
| ETF Sentiment | Cheng-Madhavan (2009) | S-25 | ETF leverage ratio | +/-4% |
| Fed Model / ERP | Asness (2003) | S-24 | ERP z-score | Relative valuation |
| RORO Regime | Baele-Bekaert-Inghelbrecht (2010) | CONF-Layer6 | `_applyRORORegimeToPatterns()` | +/-8% directional bias |
| Straddle Implied Move | BSM Greeks, Doc 46 | CONF-P8 | `straddleImpliedMove` | Phase 8 confidence |
| USD/KRW Channel | Mundell-Fleming, Doc 28 | CONF-D7 | FX export sensitivity | +/-5% |
| DV01 / Duration | Macaulay (1938) | — | `financials.js` display | Bond risk metric |
| EVA | Stern Stewart | — | `financials.js` display | Corporate value creation |
| MM Capital Structure | Modigliani-Miller (1958) | — | Theoretical framework | WACC derivation |

---

## 2C. Psychology and Behavioral Finance

### 2C.1 Theoretical Foundation

Behavioral finance provides the theoretical justification for why technical patterns
work at all: systematic cognitive biases create predictable deviations from
fundamental value. If all market participants were rational Bayesian updaters
(as assumed by EMH), price patterns would carry no predictive information.

| Doc# | Title | Sub-discipline | Key Theories |
|------|-------|----------------|--------------|
| 04 | Psychology | Cognitive Psychology | Prospect Theory, Market Psychology Cycles |
| 18 | Behavioral Market Microstructure | Microstructure | Kyle Model, VPIN, Liquidity Asymmetry |
| 19 | Social Network Effects | Social Psychology | Information Cascades, Herding, Sentiment |
| 24 | Behavioral Quantification | Applied Behavioral | Fear-Greed Index, Disposition Effect |
| 39 | Investor Flow Information | Behavioral Finance | Grossman-Stiglitz, Foreign Flow Bias |

#### 2C.1.1 Prospect Theory

**Kahneman and Tversky (1979)** "Prospect Theory: An Analysis of Decision Under Risk"
is the foundational paper of behavioral finance. The key departures from expected
utility theory:

1. **Reference dependence**: Utility is defined over gains and losses relative to a
   reference point, not over final wealth levels
2. **Loss aversion**: Losses loom larger than gains. The loss aversion coefficient
   `lambda = 2.25` (original K&T estimate; Abdellaoui et al. 2008 estimate 1.75)
3. **Diminishing sensitivity**: The value function is concave for gains and convex
   for losses (S-shaped)
4. **Probability weighting**: Small probabilities overweighted, large probabilities
   underweighted

The value function:

```
v(x) = x^alpha           if x >= 0 (gains)
v(x) = -lambda * (-x)^beta   if x < 0 (losses)
```

where `alpha = beta = 0.88` and `lambda = 2.25`.

**CheeseStock Implementation**: Prospect theory directly shapes the stop-loss and
target price calculations in `patterns.js`:

```
PROSPECT_STOP_WIDEN = 1.12    // Stop wider by 12% (loss aversion)
PROSPECT_TARGET_COMPRESS = 0.89  // Target compressed by 11% (diminishing sensitivity)
```

The derivation: `SL_adj = SL_base * (1 + delta * (sqrt(lambda) - 1))`
where `delta = 0.25` (KRX price limits + T+2 settlement protection).
With `lambda = 2.25`: `1 + 0.25 * (1.50 - 1) = 1.125 approx 1.12`.

Cross-validation: Abdellaoui et al. (2008) `lambda = 1.75` yields
`1 + 0.25 * (1.32 - 1) = 1.08` (lower bound), confirming the 1.12 estimate
is between bounds.

#### 2C.1.2 Disposition Effect

**Shefrin and Statman (1985)** "The Disposition to Sell Winners Too Early and Ride
Losers Too Long": Investors exhibit a systematic tendency to:
- Sell winning positions prematurely (realizing gains too early)
- Hold losing positions too long (refusing to realize losses)

This is a direct consequence of prospect theory's value function shape:
- In the gain domain (concave): risk-averse -> sell early to lock in certain gains
- In the loss domain (convex): risk-seeking -> hold losers hoping for recovery

**Odean (1998)** provided empirical confirmation using 10,000 trading accounts:
the proportion of gains realized (PGR) significantly exceeds the proportion of
losses realized (PLR).

CheeseStock loads `disposition_proxy` data from behavioral datasets. The effect
creates predictable patterns:
- Stocks near recent highs face selling pressure from disposition-driven profit-taking
- Stocks well below purchase prices accumulate "holding" inventory that eventually
  capitulates

This connects to the 52-week high/low S/R levels (`SR_52W_STRENGTH = 0.8`):
George and Hwang (2004) showed 52-week high proximity explains 70% of momentum
returns, largely through disposition-driven anchoring.

#### 2C.1.3 Herding and Information Cascades

**Banerjee (1992)** "A Simple Model of Herd Behavior" and **Bikhchandani,
Hirshleifer, and Welch (1992)** "A Theory of Fads, Fashion, Custom, and Cultural
Change as Informational Cascades":

Information cascades occur when individuals rationally ignore their private
information and follow the actions of predecessors. Once a cascade forms:
- It can be based on very little information
- It is fragile (small shocks can reverse it)
- It explains sudden market reversals

**LSV Herding Measure** -- Lakonishok, Shleifer, and Vishny (1992):

```
H_i = |p_i - E[p_i]| - E[|p_i - E[p_i]|]
```

where `p_i` is the proportion of investors buying stock `i`.

**CSAD (Cross-Sectional Absolute Deviation)** -- Chang, Cheng, and Khorana (2000):

```
CSAD_t = (1/N) * sum |R_{i,t} - R_{m,t}|
```

Under rational pricing, CSAD should increase linearly with |R_m|. If CSAD
*decreases* during extreme market moves, it indicates herding (investors
moving together rather than independently evaluating).

CheeseStock loads CSAD herding data from `csad_herding` behavioral datasets.
When extreme herding is detected, pattern signals in the same direction may be
crowding artifacts rather than genuine opportunities.

#### 2C.1.4 Cognitive Biases Affecting Technical Analysis

**Anchoring** -- Tversky and Kahneman (1974):

Traders anchor to salient price levels (round numbers, 52-week highs, previous
support/resistance). This creates self-fulfilling S/R levels as traders place
orders near anchors. Implementation: S/R detection with ATR*0.5 clustering tolerance.

**Overconfidence** -- Daniel, Hirshleifer, and Subrahmanyam (1998):

Overconfident traders overreact to private signals and underreact to public
information, generating momentum (short-term) and reversal (long-term).
This provides theoretical justification for mean-reversion patterns (double top,
H&S) that capture overreaction reversal.

**Representativeness** -- Tversky and Kahneman (1974):

Traders judge probabilities based on similarity to prototypes, not base rates.
A "hammer" candlestick pattern *looks like* a bottom, triggering buy impulses
even when base rates (win rate) do not support the inference. This is why
CheeseStock implements the anti-predictor gate: patterns with WR < 48% are
flagged as potentially anti-predictive.

**Market Psychology Cycle** -- Shiller (2000) "Irrational Exuberance":

The fear-greed cycle maps psychological states to market phases:

```
Greed -> Euphoria -> Complacency -> Anxiety -> Fear -> Panic -> Capitulation -> Hope -> Optimism -> Greed
```

This cycle manifests in measurable indicators:
- RSI extremes (overbought/oversold) = fear/greed proxies
- OBV divergence = smart money vs retail sentiment divergence
- Volume spikes = capitulation or euphoria

#### 2C.1.5 Anti-Predictor Gate (BLL 1992)

**Brock, Lakonishok, and LeBaron (1992)** tested 26 technical trading rules on
90 years of DJIA data, finding statistically significant predictive power. However,
their methodology has been critiqued for data snooping (Sullivan, Timmermann, and
White 1999).

CheeseStock applies the BLL logic in reverse as an anti-predictor gate:

- Source: `PATTERN_WR_KRX` -- 5-year KRX empirical win rates (545,307 observations)
- Threshold: 48% (2pp below coin flip, accounts for transaction costs)
- Effect: Patterns with WR < 48% reduce composite confidence

**Key empirical findings from KRX**:
- KRX exhibits persistent sell bias: sell patterns (55-74.7% WR) consistently
  outperform buy patterns (39-62% WR)
- Strongest: doubleTop (74.7%), gravestoneDoji (62.0%), risingWedge (59.8%)
- Weakest: symmetricTriangle (32.3%), fallingWedge (39.1%), ascendingTriangle (39.5%)

This sell-side outperformance is consistent with prospect theory: loss aversion
makes sell signals more actionable (fear is a stronger motivator than greed).

#### 2C.1.6 Fear-Greed Index

The composite Fear-Greed index synthesizes multiple behavioral metrics:

```
FG = w1*VIX_level + w2*PCR + w3*Breadth + w4*SafeHaven + w5*Momentum + w6*Junk_Bond_Demand
```

CNN Fear & Greed methodology adapted for KRX with VKOSPI substitution.
Values 0-25 (extreme fear) to 75-100 (extreme greed).

Implementation: Feeds into `_macroComposite.fearGreed` (v2), used by
`_applyPhase8ConfidenceToPatterns()`.


### 2C.2 Mathematical Formulation

#### MF-2C.1: Prospect Theory Value Function

```
v(x) = x^0.88                  if x >= 0
v(x) = -2.25 * (-x)^0.88      if x < 0
```

Applied to stop-loss/target:
```
SL_adjusted = SL_base * 1.12   (PROSPECT_STOP_WIDEN)
TP_adjusted = TP_base * 0.89   (PROSPECT_TARGET_COMPRESS)
```

#### MF-2C.2: CSAD Herding Metric

```
CSAD_t = (1/N) * sum_{i=1}^{N} |R_{i,t} - R_{m,t}|
```

Herding detection: Regress `CSAD_t = gamma_0 + gamma_1 |R_m,t| + gamma_2 R_m,t^2`.
If `gamma_2 < 0` (significant), herding is present.

#### MF-2C.3: Disposition Ratio

```
PGR = Realized_Gains / (Realized_Gains + Paper_Gains)
PLR = Realized_Losses / (Realized_Losses + Paper_Losses)
Disposition_Effect = PGR - PLR > 0
```

#### MF-2C.4: Anti-Predictor Gate

```
if (PATTERN_WR_KRX[pattern] < 48%) {
  composite_confidence *= 0.85;  // Anti-predictor discount
  if (required_signal_WR < 48%) {
    flag_anti_predictive = true;
  }
}
```

Threshold derivation: 50% (coin flip) - 2pp (KRX round-trip cost 0.31%
amortized over 5-day horizon) = 48%.

#### MF-2C.5: Beta-Binomial Posterior (Efron-Morris 1975 EB)

For win rate estimation with empirical Bayes shrinkage:

```
theta_post = (n * theta_raw + N0 * mu_grand) / (n + N0)
```

where `N0 = 35` (optimal from 5-year 545K observations), `mu_grand` is the
category-specific grand mean (candle ~43%, chart ~45%).

This is equivalent to the posterior mean from a Beta(alpha_0, beta_0) prior:
```
alpha_0 = N0 * mu_grand
beta_0 = N0 * (1 - mu_grand)
```

Implemented in `PatternEngine.PATTERN_WIN_RATES_SHRUNK`.


### 2C.3 Forward Derivation Table

| Academic Theory | Key Paper | Stage 3 Formula ID | JS Function | Connection |
|---|---|---|---|---|
| Prospect Theory K&T | Kahneman-Tversky (1979) | P-31 | `PROSPECT_STOP_WIDEN`, `PROSPECT_TARGET_COMPRESS` | Stop/target asymmetry |
| Disposition Effect | Shefrin-Statman (1985) | P-29 | S/R 52-week high/low | Anchoring at purchase price |
| Overconfidence | Daniel et al. (1998) | P-20..P-28 | Chart pattern reversal detection | Overreaction -> mean reversion |
| Information Cascades | BHW (1992) | — | `csad_herding` data loading | Crowd behavior detection |
| Anti-Predictor Gate | Brock-Lakonishok-LeBaron (1992) | S-composite | `PATTERN_WR_KRX` threshold 48% | WR < 48% -> confidence discount |
| Loss Aversion lambda | K&T (1979), lambda=2.25 | P-31 | `PROSPECT_STOP_WIDEN = 1.12` | Stop-loss widening |
| Anchoring Bias | Tversky-Kahneman (1974) | P-29 | S/R detection ATR clustering | S/R level formation |
| Representativeness | Tversky-Kahneman (1974) | B-1, B-9 | `_spearmanCorr()`, reliability tier | IC distinguishes signal vs noise |
| Fear-Greed Cycle | Shiller (2000) | S-5, S-6 | RSI zones, RSI divergence | Overbought/oversold as fear/greed |
| Herding / LSV | Lakonishok-Shleifer-Vishny (1992) | — | CSAD data loading (planned active use) | Extreme crowd -> contrarian |
| OBV Volume Psychology | Granville (1963) | I-6, S-20 | `calcOBV()`, OBV divergence signal | Volume precedes price |
| Market Psychology Cycle | Shiller (2000) | S-19 | Volume breakout / selloff signals | Capitulation / euphoria detection |
| Attention Pricing | Barber-Odean (2008) | S-19 | Volume-based signals | Attention-grabbing -> overpricing |
| Beta-Binomial Posterior | Efron-Morris (1975) | P-32 | `PATTERN_WIN_RATES_SHRUNK` | Win rate shrinkage |
| Grossman-Stiglitz Paradox | Grossman-Stiglitz (1980) | — | Entire TA system | Theoretical justification for TA |

---

## 2ABC Cross-Discipline Summary

### Discipline Integration Map

```
Economics (2A)                    Finance (2B)                Psychology (2C)
|                                 |                           |
|-- Taylor Rule -----> F7 ------->|<----- CAPM Beta (I-12)   |<-- Prospect Theory
|-- Rate Diff -------> F9         |<----- DD (Layer 4)        |    -> Stop/Target
|-- Stovall ---------> F1a        |<----- VRP (I-14)          |
|-- HHI ------------> M2          |<----- RORO (Layer 6)      |<-- Disposition
|-- MCS ------------> F6,P8-1     |                           |    -> 52W S/R
|                                 |<----- PCR (D2)            |
|                                 |<----- Basis (D1)          |<-- Anti-Predictor
|                                 |<----- Flow (D3)           |    -> WR gate
|                                 |<----- Short (D5, M3)      |
|                                 |                           |<-- Herding
|                                 |                           |    -> CSAD (planned)
v                                 v                           v
           +----------------------------------------------+
           |  Stage 3: Technical Analysis Implementation  |
           |  Patterns + Signals + Confidence + Backtest  |
           +----------------------------------------------+
```

### Confidence Layer Architecture (Academic Attribution)

```
Layer 0: Base Pattern Confidence
  |  Nison (1991) + Bulkowski (2005) quality scoring
  v
Layer 1: Macro (11 factors)
  |  Hicks (1937), Taylor (1993), Stovall (1996), Mundell (1963)
  |  Clamp [0.70, 1.25]
  v
Layer 2: Micro (3 factors)
  |  Amihud (2002), Jensen-Meckling (1976), Miller (1977)
  |  Clamp [0.55, 1.15]
  v
Layer 3: Derivatives (7 factors)
  |  Bessembinder-Seguin (1993), Pan-Poteshman (2006),
  |  Choe-Kho-Stulz (2005), Whaley (2009)
  |  Clamp [0.70, 1.30]
  v
Layer 4: Credit Risk (1 factor)
  |  Merton (1974), Bharath-Shumway (2008)
  |  Clamp [0.75, 1.15]
  v
Layer 5: Phase 8 Combined (4 factors)
  |  Hamilton (1989) HMM, Kang-Stulz (1997), Simon-Wiggins (2001)
  |  Clamp [10, 100]
  v
Layer 6: RORO Regime (5-factor composite)
  |  Baele-Bekaert-Inghelbrecht (2010)
  |  Clamp [0.92, 1.08]
  v
Layer 7: Composite Signal Adjustments
  |  Pattern-specific behavioral overrides
  v
Final Confidence [10, 100]
```

### Key Cross-Discipline Flows

| Source (Stage 2) | Target (Stage 3) | Mechanism | Academic Chain |
|---|---|---|---|
| Economics -> TA | Business cycle -> pattern weight | Stovall mapping * 0.5x dampening | Doc 29 -> Factor F1a |
| Economics -> TA | Taylor gap -> confidence | Normalized gap [-1,+1] * 5% | Doc 30 -> Factor F7 |
| Finance -> TA | CAPM beta -> Jensen's alpha | Excess return decomposition | Doc 05/25 -> B-6 |
| Finance -> TA | Merton DD -> buy penalty | Structural credit model | Doc 47 -> Layer 4 |
| Finance -> TA | VRP -> vol discount | IV^2 - HV^2 signal | Doc 34 -> S-27 |
| Finance -> TA | RORO -> directional bias | 5-factor composite regime | Doc 41 -> Layer 6 |
| Psychology -> TA | Loss aversion -> stop width | K&T lambda=2.25 | Doc 04 -> P-31 |
| Psychology -> TA | Anti-predictor -> WR gate | BLL 1992 threshold 48% | Doc 04 -> PATTERN_WR_KRX |
| Psychology -> TA | Disposition -> S/R anchoring | 52-week high proximity | Doc 24 -> SR_52W |
| Micro -> TA | ILLIQ -> liquidity discount | Amihud ratio -> conf * 0.85 | Doc 18 -> CONF-M1 |
| Micro -> TA | Short ban -> discovery impairment | Miller overvaluation | Doc 40 -> CONF-M3 |

---

## Appendix 2.I: Academic Citation Index

### Economics Citations

| ID | Full Citation | Used In |
|---|---|---|
| E-01 | Hicks, J.R. (1937). "Mr. Keynes and the Classics: A Suggested Interpretation." Econometrica 5(2): 147-159. | IS-LM, Doc 30 |
| E-02 | Taylor, J.B. (1993). "Discretion versus Policy Rules in Practice." Carnegie-Rochester Conference Series 39: 195-214. | Taylor Rule, Factor F7 |
| E-03 | Mundell, R.A. (1963). "Capital Mobility and Stabilization Policy under Fixed and Flexible Exchange Rates." Canadian Journal of Economics 29(4): 475-485. | Open economy, Factors F4/F9 |
| E-04 | Stovall, S. (1996). "Sector Investing." McGraw-Hill. | Sector rotation, Factor F1a |
| E-05 | Jensen, M.C. & Meckling, W.H. (1976). "Theory of the Firm." Journal of Financial Economics 3(4): 305-360. | Agency costs, Factor M2 |
| E-06 | Stigler, G.J. (1961). "The Economics of Information." Journal of Political Economy 69(3): 213-225. | Search costs, Doc 32 |
| E-07 | Walras, L. (1874). "Elements d'economie politique pure." Lausanne. | Price clearing mechanism |
| E-08 | Marshall, A. (1890). "Principles of Economics." Macmillan. | Elasticity, demand curves |

### Finance Citations

| ID | Full Citation | Used In |
|---|---|---|
| F-01 | Sharpe, W.F. (1964). "Capital Asset Prices." Journal of Finance 19(3): 425-442. | CAPM, I-12 |
| F-02 | Fama, E.F. (1970). "Efficient Capital Markets." Journal of Finance 25(2): 383-417. | EMH framework |
| F-03 | Markowitz, H. (1952). "Portfolio Selection." Journal of Finance 7(1): 77-91. | MPT |
| F-04 | Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate Liabilities." JPE 81(3): 637-654. | BSM, IV framework |
| F-05 | Merton, R.C. (1974). "On the Pricing of Corporate Debt." Journal of Finance 29(2): 449-470. | Merton DD, Layer 4 |
| F-06 | Ross, S.A. (1976). "The Arbitrage Theory of Capital Asset Pricing." Journal of Economic Theory 13(3): 341-360. | APT, multi-factor |
| F-07 | Fama, E.F. & French, K.R. (1993). "Common Risk Factors in the Returns on Stocks and Bonds." JFE 33(1): 3-56. | FF3 |
| F-08 | Amihud, Y. (2002). "Illiquidity and Stock Returns." JFM 5(1): 31-56. | ILLIQ, I-28 |
| F-09 | Kyle, A.S. (1985). "Continuous Auctions and Insider Trading." Econometrica 53(6): 1315-1335. | Lambda, B-10 |
| F-10 | Bharath, S.T. & Shumway, T. (2008). "Forecasting Default with the Merton DD Model." RFS 21(3): 1339-1369. | Naive DD |
| F-11 | Gilchrist, S. & Zakrajsek, E. (2012). "Credit Spreads and Business Cycle Fluctuations." AER 102(4): 1692-1720. | Credit spread, F3 |
| F-12 | Pan, J. & Poteshman, A.M. (2006). "The Information in Option Volume for Future Stock Prices." RFS 19(3): 871-908. | PCR, S-22 |
| F-13 | Whaley, R.E. (2009). "Understanding the VIX." Journal of Portfolio Management 35(3): 98-105. | VKOSPI, S-28 |
| F-14 | Bollerslev, T. (2009). "Expected Stock Returns and Variance Risk Premia." RFS 22(11): 4463-4492. | VRP, I-14 |
| F-15 | Baele, L., Bekaert, G. & Inghelbrecht, K. (2010). "The Determinants of Stock and Bond Return Comovements." RFS 23(6): 2374-2428. | RORO regime |
| F-16 | Miller, E.M. (1977). "Risk, Uncertainty, and Divergence of Opinion." Journal of Finance 32(4): 1151-1168. | Short selling |
| F-17 | Diamond, D.W. & Verrecchia, R.E. (1987). "Constraints on Short-Selling and Asset Price Adjustment." JFE 18(2): 277-311. | Short ban |
| F-18 | Kang, J.K. & Stulz, R.M. (1997). "Why is There a Home Bias?" Journal of Financial Economics 46(1): 3-28. | Foreign flow |
| F-19 | Scholes, M.H. & Williams, J. (1977). "Estimating Betas from Nonsynchronous Data." JFE 5(3): 309-327. | Thin-trading beta |
| F-20 | Bessembinder, H. & Seguin, P.J. (1993). "Price Volatility, Trading Volume, and Market Depth." JFQA 28(1): 21-39. | Basis, OI |
| F-21 | Macaulay, F.R. (1938). "Some Theoretical Problems Suggested by the Movements of Interest Rates." NBER. | Duration |
| F-22 | Grossman, S.J. & Stiglitz, J.E. (1980). "On the Impossibility of Informationally Efficient Markets." AER 70(3): 393-408. | Information paradox |
| F-23 | Asness, C.S. (2003). "Fight the Fed Model." Journal of Portfolio Management 30(1): 11-24. | Fed Model/ERP |

### Psychology Citations

| ID | Full Citation | Used In |
|---|---|---|
| P-01 | Kahneman, D. & Tversky, A. (1979). "Prospect Theory: An Analysis of Decision Under Risk." Econometrica 47(2): 263-291. | Value function, lambda |
| P-02 | Shefrin, H. & Statman, M. (1985). "The Disposition to Sell Winners Too Early and Ride Losers Too Long." JF 40(3): 777-790. | Disposition effect |
| P-03 | Banerjee, A.V. (1992). "A Simple Model of Herd Behavior." QJE 107(3): 797-817. | Herding |
| P-04 | Bikhchandani, S., Hirshleifer, D. & Welch, I. (1992). "A Theory of Fads." JPE 100(5): 992-1026. | Information cascades |
| P-05 | Tversky, A. & Kahneman, D. (1974). "Judgment under Uncertainty: Heuristics and Biases." Science 185: 1124-1131. | Anchoring, representativeness |
| P-06 | Odean, T. (1998). "Are Investors Reluctant to Realize Their Losses?" JF 53(5): 1775-1798. | Disposition empirics |
| P-07 | Brock, W., Lakonishok, J. & LeBaron, B. (1992). "Simple Technical Trading Rules and the Stochastic Properties of Stock Returns." JF 47(5): 1731-1764. | Anti-predictor |
| P-08 | Daniel, K., Hirshleifer, D. & Subrahmanyam, A. (1998). "Investor Psychology and Security Market Under- and Overreactions." JF 53(6): 1839-1885. | Overconfidence |
| P-09 | Shiller, R.J. (2000). "Irrational Exuberance." Princeton University Press. | Market psychology cycle |
| P-10 | Barber, B.M. & Odean, T. (2008). "All That Glitters." RFS 21(2): 785-818. | Attention pricing |
| P-11 | George, T.J. & Hwang, C.Y. (2004). "The 52-Week High and Momentum Investing." JF 59(5): 2145-2176. | 52W anchoring |
| P-12 | Efron, B. & Morris, C. (1975). "Data Analysis Using Stein's Estimator and Its Generalizations." JASA 70(350): 311-319. | EB shrinkage |

---

*This document traces the academic lineage of Economics, Finance, and Behavioral
Psychology theories into CheeseStock's Stage 3 Technical Analysis implementation.
Every confidence adjustment layer, valuation metric, and behavioral gate is mapped
to its originating academic paper and core_data document.*

*Version: V8 (2026-04-08) | Stage 2 Part B | Color: Amber Dark #3D3000*
