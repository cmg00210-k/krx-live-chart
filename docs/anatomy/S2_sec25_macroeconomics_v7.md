# 2.5 Macroeconomic Frameworks -- Definitive Production Anatomy

> Stage 2, Section 2.5, Version 6
>
> Author: Macro Economist Agent
> Date: 2026-04-06
> Sources: core_data/30 (IS-LM/AD-AS), core_data/29 (Sector Rotation), core_data/28 (Cross-Market),
> js/appWorker.js (confidence adjustment pipeline), js/appState.js (Stovall/RateBeta tables),
> scripts/compute_macro_composite.py (MCS v2), scripts/download_macro.py (ECOS/FRED pipeline),
> scripts/download_kosis.py (KOSIS 12-series), data/macro/macro_composite.json (live output)

---

## Overview

CheeseStock's macroeconomic layer transforms central bank data (BOK ECOS, FRED) through
Python compute pipelines into JSON files, which are loaded by `appWorker.js` and applied as
multiplicative confidence adjustments to detected pattern signals. The theoretical foundation
spans IS-LM equilibrium, Mundell-Fleming open-economy extension, Taylor Rule monetary policy,
AD-AS shock classification, Stovall sector rotation, and DCC-GARCH cross-market correlation.

### End-to-End Macro Data Flow

```
ECOS API (15 series)                scripts/download_macro.py
FRED API (8 series)         --->    scripts/download_kosis.py     --->  data/macro/macro_latest.json
KOSIS API (12 series)               scripts/compute_macro_composite.py  data/macro/macro_composite.json
yfinance (USD/KRW, VIX)                                                 data/macro/bonds_latest.json
                                                                         data/macro/kosis_latest.json
                                         |
                                         v
                                  appWorker.js _loadPhase8Data()
                                         |
                       +----------------------------------+
                       |                                  |
        _macroLatest (15+ fields)          _macroComposite (mcsV2, taylorGap)
        _bondsLatest (yield curve)         _kosisLatest (CLI, ESI, IPI)
                       |
                       v
              Pattern Confidence Pipeline
              (5 stacked adjustment functions)
```

### Adjustment Pipeline Order (appWorker.js)

```
_applyMarketContextToPatterns()     -- CCSI, foreign flow, earning season  [0.55, 1.35]
    |
_classifyRORORegime()               -- 5-factor composite score
_applyRORORegimeToPatterns()        -- Risk-On/Off 3-regime               [0.92, 1.08]
    |
_applyMacroConfidenceToPatterns()   -- 11 factors                         [0.70, 1.25]
    |
_applyMicroConfidenceToPatterns()   -- Amihud ILLIQ, HHI                  [0.80, 1.15]
    |
_applyPhase8ConfidenceToPatterns()  -- MCS v2, HMM regime, DD, options    [10, 100]
    |
_applyMacroConditionsToSignals()    -- Composite signal macro tuning      [0.70, 1.25]
```

---

## MAC-1: IS Curve (Goods Market Equilibrium)

### Formula

```
Y = C + I + G + NX

Behavioral equations:
  C  = C_0 + c_1 * (Y - T)              consumption
  I  = I_0 - b * r                       investment
  G  = G_0                               government spending (exogenous)
  T  = T_0 + t * Y                       taxation
  NX = X_0 - m * Y + eta * e             net exports

Autonomous spending:
  A = C_0 - c_1*T_0 + I_0 + G_0 + X_0 + eta*e

Marginal leakage rate:
  s = 1 - c_1*(1-t) + m

IS curve (solving for r):
  r = A/b - (s/b) * Y

Slope:
  dr/dY = -s/b < 0    (downward sloping)
```

### Symbol Table

| Symbol | Meaning | Unit | Range | Observable? |
|--------|---------|------|-------|-------------|
| Y | Real GDP (output) | trillion KRW | [1500, 2500] | BOK quarterly |
| r | Real interest rate | % | [0, 8] | BOK base rate minus CPI |
| C_0 | Autonomous consumption | trillion KRW | exogenous | National Accounts |
| c_1 | Marginal propensity to consume (MPC) | dimensionless | [0.50, 0.65] | BOK (2023) |
| I_0 | Autonomous investment | trillion KRW | exogenous | -- |
| b | Investment sensitivity to interest rate | tril KRW / %pt | [800, 1800] | Kim & Park (2016) |
| G_0 | Government spending | trillion KRW | exogenous | MOSF budget |
| T_0 | Lump-sum tax | trillion KRW | exogenous | -- |
| t | Marginal tax rate | dimensionless | 0.25 (fixed) | National Tax Stats annual avg |
| m | Marginal propensity to import | dimensionless | [0.38, 0.52] | Customs Admin |
| eta | Export elasticity to exchange rate | dimensionless | [0.40, 0.80] | Shin & Wang (2003) |
| e | Real exchange rate (up = KRW weak = exports favorable) | index | variable | BOK |
| X_0 | Autonomous exports | trillion KRW | exogenous | Customs Admin |
| A | Autonomous spending aggregate | trillion KRW | computed | -- |
| s | Marginal leakage rate | dimensionless | computed | -- |

### Constants Table

| Constant | Symbol | Value | Grade | Learn Method | Range | Source | System Location |
|----------|--------|-------|-------|-------------|-------|--------|-----------------|
| MPC | c_1 | 0.55 | B | Manual | [0.50, 0.65] | BOK (2023) National Accounts | Doc30 section 1.1 (not in runtime JS) |
| Marginal tax rate | t | 0.25 | A | Fixed | fixed | National Tax Statistics | Doc30 section 1.1 (not in runtime JS) |
| Marginal propensity to import | m | 0.45 | B | Manual | [0.38, 0.52] | Korea Customs; structurally high (export ~50% GDP) | Doc30 section 1.1 (not in runtime JS) |
| Investment interest sensitivity | b | 1200 | C | Grid search | [800, 1800] | Kim & Park (2016); wide uncertainty | Doc30 section 1.1 |
| FX export elasticity | eta | 0.60 | C | Grid search | [0.40, 0.80] | Shin & Wang (2003) | Doc30 section 1.1 |

> **Parameter Vintage Warning (Doc30 section 1.1):** These estimates are based on 2010-2016 Korean data. Post-COVID structural changes (supply chain reshoring, household debt surge reaching ~105% of GDP) may have shifted c_1 downward and m unpredictably. Re-estimation with 2020-2025 data is recommended.

### System Mapping

**Theory -> Implementation:** The IS curve parameters are NOT directly coded in JS. Their role is to provide the theoretical foundation for why:

1. Korea's fiscal multiplier is near 1 (m=0.45 import leakage), justifying the weak conf_fiscal = 1.03 (Doc30 section 1.4)
2. Monetary policy is stronger than fiscal under floating rates (Mundell-Fleming result, section MAC-4)
3. Export demand shocks are the dominant AD shifter (m captures high import leakage that weakens domestic multipliers)

**Indirect code connection:**
- `appWorker.js` Factor 1 uses `phase` (expansion/contraction) which is the IS-LM equilibrium direction
- `download_macro.py` line 15-16: UIP foreigner_signal calculation (Mundell-Fleming capital flow) uses rate_diff derived from IS-LM interest rate channel

### Edge Cases

- **Liquidity trap (h -> infinity, r near zero):** IS-LM predicts monetary policy ineffective. Korea experienced this 2020 Q2 (BOK rate 0.50%). Pattern implication: BOK rate-decision trading signals attenuate at r <= 0.75% (constant #94, ZLB threshold).
- **m approaching 0.50:** At m = 0.50, the marginal leakage rate s > 1, meaning open-economy multiplier k_G_open < 1 -- each 1 KRW of government spending creates less than 1 KRW of GDP.

---

## MAC-2: LM Curve (Money Market Equilibrium)

### Formula

```
Money demand:   L(Y, r) = k * Y - h * r
Money supply:   M^s / P  (exogenous real money supply)

Equilibrium:    M/P = k*Y - h*r

LM curve:       r = (k/h) * Y - (M/P) / h

Slope:          dr/dY = k/h > 0    (upward sloping)
```

### IS-LM Simultaneous Solution

```
Y* = [h*A + b*(M/P)] / D        where D = h*s + b*k (always positive)
r* = [k*A - s*(M/P)] / D
```

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| k | Income sensitivity of money demand (transaction + precautionary motive) | dimensionless | [0.15, 0.30] | BOK M2/GDP |
| h | Interest sensitivity of money demand (speculative motive) | tril KRW / %pt | [1200, 3500] | Kim & Park (2016) |
| M | Nominal money supply (M2) | trillion KRW | exogenous | BOK; ECOS stat 161Y006 item BBHA00 |
| P | Price level (GDP deflator) | index (2020=100) | positive | Statistics Korea |

### Constants Table

| Constant | Symbol | Value | Grade | Learn Method | Range | Source |
|----------|--------|-------|-------|-------------|-------|--------|
| Income money demand sensitivity | k | 0.20 | C | Manual | [0.15, 0.30] | BOK M2/GDP ratio estimate |
| Interest money demand sensitivity | h | 2000 | C | Grid search | [1200, 3500] | Kim & Park (2016) |

### System Mapping

**IS-LM comparative statics to KRX pattern confidence:**

| Shock | dY*/d(shock) | dr*/d(shock) | KRX effect | CheeseStock implementation |
|-------|-------------|-------------|------------|---------------------------|
| G up (fiscal) | +h/D > 0 | +k/D > 0 | Y up but r up (partial crowding-out); growth: r pressure, value: Y benefit | conf_fiscal = 1.03 (Doc30 section 1.4) |
| M/P up (monetary) | +b/D > 0 | -s/D < 0 | Y up AND r down (double positive); broadly bullish, growth especially | Factor 7 Taylor gap -> dovish -> buy boost |
| T up (tax hike) | -c_1*h/D < 0 | -c_1*k/D < 0 | Y down, r down; consumer discretionary bearish | Not directly implemented |
| X_0 up (export boom) | +h/D > 0 | +k/D > 0 | Export sectors benefit directly | MCS export component (w=0.225) |

**Equity Duration bridge (IS-LM r-change to stock prices):**

```
D_equity = 1 / (r_e - g)

Growth stock (g=8%, r_e=10%):  D_equity = 50    (extremely rate-sensitive)
Value stock  (g=2%, r_e=10%):  D_equity = 12.5  (relatively insensitive)

Price impact:  dP/P = -D_equity * dr

BOK -25bp cut (empirical, Doc29 section 3.2):
  Growth/Bio: +5-8% (theoretical +12.5%, gap = pre-pricing)
  Financial:  -1 to -2% (NIM compression, opposing channel)
```

> **Modern Reinterpretation (Romer 2000):** Modern central banks target interest rates, not money supply. The LM curve is better replaced by a horizontal MP rule where i = Taylor rule output. MAC-3 (Taylor Rule) adopts this IS-MP approach. The LM framework here is retained for explaining why Factor 7 (Taylor Gap) supersedes a raw money-supply signal.

---

## MAC-3: Taylor Rule (Monetary Policy Assessment)

### Formula -- Standard Taylor Rule (Taylor 1993)

```
i = r* + pi + a_pi * (pi - pi*) + a_y * (y - y*)/y*
```

### Formula -- Extended Open-Economy Taylor Rule (Ball 1999)

```
i = r* + pi + a_pi * (pi - pi*) + a_y * (y - y*)/y* + a_e * delta_e
```

### Formula -- Inertial Taylor Rule (Woodford 2003, Clarida-Gali-Gertler 1999)

```
i_inertial = rho * i_{t-1} + (1 - rho) * i_taylor

Taylor gap = i_actual - i_inertial
```

### Symbol Table

| Symbol | Meaning | Unit | Range | Observable? |
|--------|---------|------|-------|-------------|
| i | Nominal policy rate (Taylor-implied) | % | computed | Output |
| r* | Natural (equilibrium) real interest rate | % | [0.5, 2.0] | Estimated (Laubach-Williams) |
| pi | Current CPI inflation rate (YoY) | % | observable | Statistics Korea; ECOS stat 901Y009 |
| pi* | Inflation target | % | 2.0 (fixed) | BOK official target since 2016 |
| a_pi | Inflation gap response coefficient | dimensionless | 0.50 | Taylor (1993) |
| a_y | Output gap response coefficient | dimensionless | 0.50 | Taylor (1993) |
| y - y* | Output gap | % | estimated | CLI proxy: (CLI - 100) * 0.5 |
| a_e | Exchange rate change response | dimensionless | 0.10 | Ball (1999); Kim & Park (2016) |
| delta_e | KRW/USD annual change rate | % | observable | yfinance USD/KRW |
| rho | Interest rate smoothing parameter | dimensionless | 0.80 | Shin & Kim (2014) BOK WP |
| i_{t-1} | Previous-period policy rate | % | observable | Proxy: current BOK rate |

### Constants Table

| Constant | Symbol | Value | Grade | Learn Method | Range | Source | System Location |
|----------|--------|-------|-------|-------------|-------|--------|-----------------|
| Natural real interest rate | r* | 1.0% (Doc30) / 0.5% (code) | C | Manual | [0.5%, 2.0%] | Laubach-Williams (2003); BOK (2023) | download_macro.py `calc_taylor_implied_rate()` r_star=1.0; compute_macro_composite.py TAYLOR_R_STAR=0.5 |
| Inflation target | pi* | 2.0% | A | Fixed | fixed | BOK official | download_macro.py line 246; compute_macro_composite.py TAYLOR_PI_STAR=2.0 |
| Inflation response | a_pi | 0.50 | B | Grid search | [0.30, 0.80] | Taylor (1993) | download_macro.py line 237 (default arg) |
| Output gap response | a_y | 0.50 | B | Grid search | [0.25, 0.75] | Taylor (1993) | download_macro.py line 237 (default arg) |
| FX response (open econ) | a_e | 0.10 | C | Grid search | [0.05, 0.20] | Ball (1999); Kim & Park (2016) | download_macro.py line 237 (default arg); constant #143 |
| Smoothing parameter | rho | 0.80 | C | Manual | [0.70, 0.90] | Woodford (2003); Shin & Kim (2014) | download_macro.py TAYLOR_RHO line 215; constant #167 |
| CLI-to-output-gap scale | CLI_TO_GAP_SCALE | 0.5 | C | Manual | [0.3, 0.8] | OECD CLI design (100 = trend) | download_macro.py; constant #139 |
| Taylor gap dead band | -- | 0.25 (normalized) | D | Grid search | [0.10, 0.40] | Empirical | appWorker.js line 1244; constant #141 |
| Taylor gap max adj | -- | 5% | D | WLS | [2%, 8%] | Empirical | appWorker.js line 1246; constant #140 |

### System Mapping -- Full Trace

```
Step 1 (API):
  ECOS 722Y001/0101000 -> bok_rate     (download_macro.py)
  ECOS 901Y009/0       -> cpi_yoy      (download_macro.py)
  ECOS 901Y067/I16A    -> CLI          (download_macro.py)
  FRED FEDFUNDS        -> fed_rate     (download_macro.py)
  yfinance USDKRW      -> delta_e      (download_macro.py)

Step 2 (Python compute):
  output_gap = (CLI - 100) * 0.5                                    (download_macro.py)
  i_taylor = r* + pi + 0.5*(pi - 2.0) + 0.5*y_gap + 0.1*delta_e   (calc_taylor_implied_rate)
  i_inertial = 0.8 * bok_rate + 0.2 * i_taylor                     (Inertial smoothing)
  taylor_gap = bok_rate - i_inertial                                 (in %p)

Step 3 (JSON output):
  data/macro/macro_latest.json -> { "taylor_gap": -0.2305, "taylor_implied_rate": 2.74, ... }
  data/macro/macro_composite.json -> { "taylorGap": -0.24, "taylorRate": 2.74 }

Step 4 (JS load):
  appWorker.js _loadPhase8Data() -> _macroLatest.taylor_gap
  appWorker.js _loadPhase8Data() -> _macroComposite.taylorGap

Step 5 (Confidence adjustment -- Factor 7, appWorker.js lines 1228-1254):
  tgNorm = clamp(taylorGap / 2, -1, +1)
  if tgNorm < -0.25 (dovish):
    tAdj = 1.0 + |tgNorm| * 0.05    (max +5%)
    adj *= isBuy ? tAdj : (2.0 - tAdj)
  if tgNorm > +0.25 (hawkish):
    tAdj = 1.0 + |tgNorm| * 0.05    (max +5%)
    adj *= isBuy ? (2.0 - tAdj) : tAdj
  Dead band |tgNorm| <= 0.25: no adjustment

Step 6 (Pattern impact):
  pattern.confidence = clamp(round(pattern.confidence * adj), 10, 100)
```

### Taylor Gap Interpretation

```
Taylor_gap > 0 (hawkish): actual rate exceeds Taylor-implied
  -> Growth stocks suppressed, financial stocks benefit
  -> Forward: eventual easing pivot -> growth accumulation opportunity
  -> Half-life: ~4 quarters (Rudebusch 2002)

Taylor_gap < 0 (dovish): actual rate below Taylor-implied
  -> Growth stocks overheat, asset bubble risk
  -> Forward: eventual tightening pivot -> defensive positioning
```

### Live Data (2026-04-05 macro_composite.json)

```
taylorGap:     -0.24%p (slightly dovish)
taylorRate:    2.74% (implied)
actualRate:    2.50% (BOK)
cpiYoY:        2.16%
rStar:         0.5% (code value)
piStar:        2.0%
outputGap:     0.0% (hardcoded -- see Finding FND-MAC-3)
```

### Edge Cases

- **Output gap hardcoded to 0 (Finding FND-MAC-3):** compute_macro_composite.py uses `TAYLOR_OUTPUT_GAP = 0.0` despite CLI data being available. download_macro.py correctly uses `(CLI - 100) * 0.5`. The composite script's Taylor gap is less accurate than the macro_latest version.
- **r\* discrepancy (Finding FND-MAC-1):** Doc30 specifies r\* = 1.0%; `calc_taylor_implied_rate()` defaults to r\* = 1.0; but `compute_macro_composite.py` TAYLOR_R_STAR = 0.5. Both within uncertainty band +/-1pp, but the 50bp difference systematically biases the composite Taylor gap.
- **Taylor Principle violation:** If a_pi < 1, real rates fall when inflation rises (destabilizing). Korea's a_pi = 0.50 is the Taylor coefficient on the GAP (pi - pi*), so the total inflation coefficient = 1 + a_pi = 1.50, which satisfies the Taylor Principle.

---

## MAC-4: Mundell-Fleming (Open Economy IS-LM-BP)

### Formula -- BP Curve (Balance of Payments Equilibrium)

```
BP = NX(Y, e) + KA(r - r*, E[de]) = 0

NX    = X_0 - m*Y + eta*e                  (current account)
KA    = kappa * (r - r* - E[de])            (capital account)

BP curve:  r = r* + E[de] + (m/kappa)*Y - (X_0 + eta*e)/kappa

Slope: dr/dY = m / kappa
```

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| kappa | Capital mobility parameter | tril KRW / %pt | [2000, inf) | Lane & Milesi-Ferretti (2007) |
| r* | World interest rate (proxy: Fed funds rate) | % | [0, 6] | FRED FEDFUNDS |
| E[de] | Expected exchange rate depreciation | % | variable | Forward premium |

### Constants Table

| Constant | Symbol | Value | Grade | Learn Method | Range | Source | System Location |
|----------|--------|-------|-------|-------------|-------|--------|-----------------|
| Capital mobility | kappa | 5000 | C | Manual | [2000, inf) | Lane & Milesi-Ferretti (2007); post-2000 liberalization | Doc30 section 1.4 (not in runtime JS) |
| BOK event conf_adj | conf_bok | 1.08 | C | Grid search | [1.03, 1.15] | Doc29 section 3.1 empirical | Doc30 section 1.4 (theoretical; not separate JS factor) |
| Fiscal event conf_adj | conf_fiscal | 1.03 | D | Grid search | [1.00, 1.08] | Mundell-Fleming weak fiscal; insufficient Korean evidence | Doc30 section 1.4 (theoretical; not separate JS factor) |

### Mundell-Fleming Trilemma

```
Three simultaneously impossible goals:
  (1) Free capital movement
  (2) Independent monetary policy
  (3) Fixed exchange rate

Korea's choice: (1) + (2) -> (3) abandoned (floating rate since 1997)

Caveat: de jure floating, de facto managed-float. BOK uses FX stabilization
fund and verbal guidance. IMF classification (2024): "floating" with intervention history.
```

### Policy Effectiveness Under Floating Rate

| Policy | Mechanism | Y effect | KRX impact |
|--------|-----------|----------|-----------|
| Monetary expansion (M up) | r down -> capital outflow -> KRW weak -> NX up -> IS right | **STRONG** | Export stocks bullish (FX + rate double benefit) |
| Fiscal expansion (G up) | r up -> capital inflow -> KRW strong -> NX down -> partial offset | **WEAK** | Crowding-out + appreciation; only domestic demand mildly benefits |

### System Mapping -- Factor 9 (Rate Differential)

```
appWorker.js lines 1271-1283:

rate_diff = bok_rate - fed_rate    (from macro_latest.json)

if rate_diff < -1.5%p:   adj *= isBuy ? 0.95 : 1.04   (large inversion: buy -5%, sell +4%)
if rate_diff < -0.5%p:   adj *= isBuy ? 0.98 : 1.02   (mild inversion: buy -2%, sell +2%)
if rate_diff > +1.0%p:   adj *= isBuy ? 1.03 : 0.98   (Korea premium: buy +3%, sell -2%)
```

### System Mapping -- UIP Foreigner Signal

```
download_macro.py calc_foreigner_signal():

foreigner_signal = 0.45 * (-dVIX_norm)
                 + 0.30 * (rate_diff_norm)
                 + 0.25 * (-dDXY_norm)

rate_diff_norm = tanh((bok_rate - fed_rate) * 5)
dVIX_norm = tanh(VIX_delta_1m * 5)
dDXY_norm = tanh(DXY_delta_1m * 5)

-> macro_latest.json { "foreigner_signal": value }
-> appWorker.js Factor 4 (lines 1166-1172)
```

### USD/KRW Dual-Channel Transmission (Doc28 section 3)

| Time horizon | Effect | beta_FX | Mechanism |
|-------------|--------|---------|-----------|
| Short (1-3 days) | Negative | -0.2 to -0.4 | Foreign USD return falls -> net selling |
| Medium (1+ months) | Positive | +0.1 to +0.3 | Exporter KRW revenue rises -> EPS upgrade |

---

## MAC-5: AD-AS Equilibrium and Shock Transmission

### Formula -- Aggregate Demand (derived from IS-LM)

```
AD: Y_AD(P) = [h*A + b*(M/P)] / D

Slope: dY_AD/dP = -b*M / (D * P^2) < 0    (downward sloping)

Three mechanisms for AD downward slope:
  (1) Pigou effect (real balance):     P down -> M/P up -> C up
  (2) Keynes effect (interest rate):   P down -> M/P up -> r down -> I up
  (3) Mundell-Fleming effect (FX):     P down -> real FX weak -> NX up
      (strongest in Korea: export ~50% GDP)
```

### Formula -- Short-Run Aggregate Supply

```
SRAS: P = P_e + (1/alpha) * (Y - Y_n)

where:
  P_e   = expected price level (set during wage contracts)
  alpha = price stickiness parameter
  Y_n   = natural (potential) output
```

### Formula -- New Keynesian Phillips Curve (NKPC)

```
NKPC: pi_t = beta * E_t[pi_{t+1}] + kappa * y_tilde

where:
  beta    = discount factor                     0.99 [A]
  kappa   = NKPC slope                          0.05 [B]
  y_tilde = output gap = (Y_t - Y_n) / Y_n
  theta   = Calvo price stickiness              0.75 [B], Kim & Park (2016)
            (avg 4 quarters between adjustments)

Korea theta = 0.75 > US theta = 0.66 -> prices stickier in Korea
-> monetary policy transmits MORE strongly to real output (and stock prices) than in US
```

### Constants Table

| Constant | Symbol | Value | Grade | Range | Source |
|----------|--------|-------|-------|-------|--------|
| Calvo price stickiness | theta | 0.75 | B | [0.60, 0.85] | Kim & Park (2016) |
| NKPC slope | kappa | 0.05 | B | [0.02, 0.10] | Gali & Gertler (1999) |
| Discount factor | beta | 0.99 | A | fixed | Standard macro |
| Price stickiness | alpha | 1.20 | C | [0.80, 2.00] | Blanchard & Fischer (1989) |
| Goldilocks CPI ceiling | -- | 2.5% | C | [2.0%, 3.0%] | BOK target + 0.5pp; constant #90 |
| Stagflation CPI floor | -- | 3.0% | C | [2.5%, 4.0%] | Empirical; constant #91 |

### AD-AS Shock Scenarios and Pattern Implications

| Scenario | Cause | P | Y | Pattern implication | conf_adj (Doc30 section 6.2) |
|----------|-------|---|---|---------------------|------------------------------|
| 1. Positive demand (AD right) | M up, export boom, CSI up | Up | Up | Trend patterns strengthen | trend +0.08, reversal -0.05 |
| 2. Negative demand (AD left) | Tightening, export collapse | Down | Down | Bottom-reversal patterns strengthen | reversal +0.10, breakout -0.08 |
| 3. Negative supply (SRAS left) | Oil spike, supply chain disruption | Up | Down | **STAGFLATION**: all patterns weaken | ALL -0.12 |
| 4. Positive supply (SRAS right) | Semiconductor supercycle, tech innovation | Down | Up | **GOLDILOCKS**: all patterns strengthen | ALL +0.05 |

### Regime Detection Rule (Doc30 section 6.2)

```
if GDP_gap > 0 AND CPI_yoy < 2.5%:   return 'goldilocks'
if GDP_gap > 0 AND CPI_yoy >= 2.5%:  return 'demand_expansion'
if GDP_gap < 0 AND CPI_yoy >= 3.0%:  return 'stagflation'
if GDP_gap < 0 AND CPI_yoy < 3.0%:   return 'demand_contraction'
```

### System Mapping

The AD-AS regime detection is NOT directly implemented as a unified function in appWorker.js. Instead, its effects are distributed:

1. **Factor 1 (cycle phase):** Uses `macro.cycle_phase.phase` (expansion/peak/contraction/trough) from download_macro.py, which maps to AD-AS demand direction
2. **Factor 8 (VIX/VRP):** Captures the volatility component of supply shocks
3. **RORO classifier:** Integrates multiple signals into risk-on/risk-off, which correlates with AD-AS regime

### Korean Historical Examples

| Period | Type | Shock | KOSPI reaction | Pattern reliability |
|--------|------|-------|---------------|---------------------|
| 2022 H1 | Supply (-) | Russia-Ukraine oil surge | -25% | Degraded (stagflation) |
| 2023 H2 | Supply (+) | Semiconductor upturn + oil stabilization | +18% | Improved (goldilocks) |
| 2020 Q1 | Demand (-) | COVID shock | -35% | Reversal accuracy improved |
| 2020 Q3 | Demand (+) | Liquidity flood + fiscal stimulus | +42% | Trend accuracy improved |

---

## MAC-6: MCS v2 Composite Score

### Formula

```
MCS_v2 = sum(w_i * normalize(indicator_i)) * 100    for all available indicators

normalize(x) = clamp((x - range_low) / (range_high - range_low), 0, 1)

Missing indicators: excluded, weights redistributed proportionally:
  adj_weight_i = raw_weight_i / sum(available_weights)
```

### Two MCS Implementations (CRITICAL: they differ)

**Implementation A: compute_macro_composite.py (8 components, output: macro_composite.json)**

| Component | Key | Weight | Data Source | Normalization Range |
|-----------|-----|--------|-------------|---------------------|
| CLI (Leading Composite Index) | cli | 0.20 | KOSIS kosis_latest.json `cli_composite` | [80, 130] |
| ESI (Economic Sentiment Index) | esi | 0.15 | KOSIS kosis_latest.json `esi` | [60, 120] |
| IPI (Industrial Production Index) | ipi | 0.15 | KOSIS `ipi_all` or ECOS 901Y033 | [70, 130] |
| Consumer Confidence (CSI proxy) | consumer_confidence | 0.10 | KOSIS ESI or macro BSI_mfg | [60, 130] |
| PMI (BSI manufacturing proxy) | pmi | 0.10 | macro_latest `bsi_mfg` (ECOS 512Y013) | [50, 120] |
| Exports YoY | exports | 0.10 | macro_latest `export_yoy` (ECOS 901Y118) | [-30%, +40%] |
| Unemployment (inverse) | unemployment_inv | 0.10 | macro_latest `unemployment_rate` (ECOS 901Y027) | [2.0%, 6.0%] inverted |
| Yield Spread | yield_spread | 0.10 | bonds `slope_10y3y` or macro `term_spread` | [-1.0, +3.0] %pt |
| **Total** | | **1.00** | | |

**Implementation B: download_macro.py MCS_W (6 components, output: macro_latest.json `mcs` field)**

| Component | Key | Weight | Normalization |
|-----------|-----|--------|---------------|
| PMI (BSI proxy) | pmi | 0.225 | BSI/2 normalized to [35, 65] |
| CSI (consumer confidence) | csi | 0.180 | [80, 120] |
| Exports YoY | export | 0.225 | [-20%, +20%] |
| Yield curve spread | yield_curve | 0.135 | [-50bp, +100bp] |
| EPU inverse (VIX proxy) | epu_inv | 0.135 | 1 - (VIX-12)/28 |
| Taylor gap (inverted) | taylor_gap | 0.100 | (-gap_bp + 100) / 200 |
| **Total** | | **1.000** | |

### Constants Table

| Constant | Symbol | Value | Grade | Learn Method | Range | Source | System Location |
|----------|--------|-------|-------|-------------|-------|--------|-----------------|
| MCS strong_bull threshold | -- | 70 | D | Grid search | [60, 80] | Empirical | appState.js MCS_THRESHOLDS.strong_bull |
| MCS bull threshold | -- | 55 | D | Grid search | [45, 65] | Empirical | appState.js MCS_THRESHOLDS.bull |
| MCS bear threshold | -- | 45 | D | Grid search | [35, 55] | Empirical | appState.js MCS_THRESHOLDS.bear |
| MCS strong_bear threshold | -- | 30 | D | Grid search | [20, 40] | Empirical | appState.js MCS_THRESHOLDS.strong_bear |

### System Mapping -- MCS v2 to Pattern Confidence

**Path 1: Phase 8 layer (appWorker.js lines 554-571) -- uses macro_composite.json mcsV2:**

```javascript
// MCS thresholds: strong_bull=70, strong_bear=30
if (mcs >= 70 && pattern.signal === 'buy')   pattern.confidence *= 1.05;
if (mcs <= 30 && pattern.signal === 'sell')   pattern.confidence *= 1.05;
```

**Path 2: Factor 6 fallback (appWorker.js lines 1212-1226) -- uses macro_latest.json mcs:**

```javascript
// Guard: only if Phase 8 mcsV2 is NOT available (double-application prevention)
if (mcs != null && !(_macroComposite && _macroComposite.mcsV2 != null)) {
  if (mcs > 0.6) {
    var mcsAdj = 1.0 + (mcs - 0.6) * 0.25;   // linear: 0.6->1.0, 1.0->1.10
    adj *= isBuy ? mcsAdj : (2.0 - mcsAdj);
  }
  // symmetric for mcs < 0.4
}
```

### Live Data (2026-04-05)

```json
{
  "mcsV2": 65.7,
  "mcsComponents": {
    "cli": 0.904, "esi": 0.59, "ipi": 0.7467, "consumer_confidence": 0.5057,
    "pmi": 0.3, "exports": 0.8387, "unemployment_inv": 0.775, "yield_spread": 0.3375
  },
  "mcsAvailable": 8, "totalIndicators": 8
}
```

### Edge Cases

- **All 8 indicators available:** Weights used as-is (sum = 1.0).
- **Missing indicators:** Proportional weight redistribution. If only 4 indicators available, each gets 2x its nominal weight.
- **Scale mismatch (Finding FND-MAC-6):** Factor 6 uses `mcs` on [0,1] scale; Phase 8 uses `mcsV2` on [0,100] scale. If mcsV2 is absent but mcs is present and somehow on the [0,100] scale, Factor 6 thresholds (0.4/0.6) would mis-trigger.

---

## MAC-7: Yield Curve Slope as Recession Predictor

### Formula

```
Yield_Spread = KTB_10Y - KTB_3Y    (or KTB_2Y)

4-phase classification (compute_macro_composite.py lines 281-328):
  inverted:     spread <= 0
  flattening:   0 < spread <= 0.5%p
  normal:       0.5%p < spread <= 1.5%p
  steepening:   spread > 1.5%p
```

### Symbol Table

| Symbol | Meaning | Unit | Source |
|--------|---------|------|--------|
| KTB_10Y | Korean Treasury Bond 10-year yield | % | ECOS 721Y001/5050000 (monthly) |
| KTB_3Y | Korean Treasury Bond 3-year yield | % | ECOS 721Y001/5020000 (monthly) |

### Recession Prediction Accuracy

```
US: 8/8 recessions predicted (1960-2020) -- Estrella & Mishkin (1998)
Korea: 4/5 recessions preceded by inversion
Lead time: 12-18 months (US), 6-12 months (Korea, shorter cycles)
```

### Korean Yield Curve Inversion History

| Inversion period | Spread (bp) | Subsequent economy | KOSPI reaction |
|-----------------|-------------|-------------------|----------------|
| 2006.11 | -15 | 2008 financial crisis | -54% (12 months) |
| 2019.08 | -5 | 2020 COVID | -35% (6 months, then bounce) |
| 2022.10 | -25 | 2023 slowdown | -8% (3 months) |

### System Mapping -- Factor 2 (appWorker.js lines 1118-1150)

Four yield-curve regimes using slope + Taylor gap direction:

| Regime | Condition | Buy adj | Sell adj | Interpretation |
|--------|-----------|---------|----------|----------------|
| Bull Steepening | dovish (gap<0) + slope > 0.20 | x1.06 | x0.95 | Early easing, most risk-on |
| Bull Flattening | dovish (gap<0) + slope <= 0.20 | x0.97 | x1.03 | Growth slowdown concern |
| Bear Steepening | hawkish (gap>0) + slope > 0.20 | x0.95 | x1.04 | Inflation/supply worry |
| Bear Flattening | hawkish (gap>0) + slope <= 0.20 | x0.90 | x1.10 | Tightening, recession precursor |
| Inverted | slope < 0 | x0.88 | x1.12 | Strongest bearish signal |

### Live Data (2026-04-05)

```
yieldCurvePhase: "flattening"
spread_10y3y: 0.30%p
isInverted: false
```

---

## MAC-8: RORO Regime Classification (Risk-On / Risk-Off / Neutral)

### Formula

```
RORO_score = sum(factor_i * weight_i) * min(count / 3, 1.0)

5-factor model:
  Factor 1: VKOSPI/VIX level           weight = 0.30
  Factor 2a: AA- credit spread          weight = 0.10
  Factor 2b: US HY spread              weight = 0.10
  Factor 3: USD/KRW level              weight = 0.20
  Factor 4: MCS v2                     weight = 0.15
  Factor 5: Investor alignment          weight = 0.15

Hysteresis regime transition:
  Entry: risk-on if score >= ENTER_ON (0.25)
         risk-off if score <= ENTER_OFF (-0.25)
  Exit:  risk-on -> neutral if score <= EXIT_ON (0.10)
         risk-off -> neutral if score >= EXIT_OFF (-0.10)
```

### Factor Scoring Thresholds

| Factor | Input | Thresholds -> Score |
|--------|-------|---------------------|
| 1. Volatility | VKOSPI (or VIX * 1.12) | >30: -1.0, >22: -0.5, <15: +0.5, else: 0 |
| 2a. Korea credit | bonds AA- spread | >1.5%: -1.0, >1.0%: -0.5, <0.5%: +0.3, else: 0 |
| 2b. US credit | us_hy_spread | >5.0%: -1.0, >4.0%: -0.5, <3.0%: +0.3, else: 0 |
| 3. FX | USD/KRW | >1450: -1.0, >1350: -0.5, <1200: +0.5, <1100: +1.0, else: 0 |
| 4. MCS | macro_latest.mcs | (mcs - 0.5) * 2 -> [-1, +1] |
| 5. Flow | investor alignment | aligned_buy: +0.8, aligned_sell: -0.8, else: 0 |

### Constants Table

| Constant | Symbol | Value | Grade | Range | Source | System Location |
|----------|--------|-------|-------|-------|--------|-----------------|
| VIX_VKOSPI_PROXY | -- | 1.12 | C | [1.05, 1.25] | Whaley (2009) | appState.js line 43 |
| RORO entry threshold (on) | ENTER_ON | 0.25 | D | [0.15, 0.35] | Empirical | appWorker.js line 1430 |
| RORO entry threshold (off) | ENTER_OFF | -0.25 | D | [-0.35, -0.15] | Empirical | appWorker.js line 1430 |
| RORO exit threshold (on) | EXIT_ON | 0.10 | D | [0.05, 0.20] | Empirical | appWorker.js line 1431 |
| RORO exit threshold (off) | EXIT_OFF | -0.10 | D | [-0.20, -0.05] | Empirical | appWorker.js line 1431 |

### Pattern Adjustment (appWorker.js lines 1455-1477)

```
risk-on:   buy conf * 1.06, sell conf * 0.94
risk-off:  buy conf * 0.92, sell conf * 1.08
neutral:   no adjustment

clamp: [0.92, 1.08] to prevent double-counting with Factor 3 (credit) and Factor 8 (VIX)
```

### Academic Basis

Baele, Bekaert & Inghelbrecht (2010), "The Determinants of Stock and Bond Return Comovements," *Review of Financial Studies*, 23(6), 2374-2428.

---

## MAC-9: Sector Rotation by Business Cycle Phase (Stovall Framework)

### Formula

```
Pattern confidence adjustment:
  adj *= isBuy ? buy_mult : (2.0 - buy_mult)

where buy_mult = _STOVALL_CYCLE[sector][phase]

sell_mult = 2.0 - buy_mult    (symmetric inversion)
```

### Business Cycle Phase Identification

```
GDP_gap(t) = (GDP_actual - GDP_potential) / GDP_potential

Expansion:   GDP_gap > 0 AND d(GDP_gap)/dt > 0
Peak:        GDP_gap > 0 AND d(GDP_gap)/dt <= 0
Contraction: GDP_gap < 0 AND d(GDP_gap)/dt < 0
Trough:      GDP_gap < 0 AND d(GDP_gap)/dt >= 0

Korean Statistics Korea: CLI/CCI/LCI composite indexes
CLI leads CCI by 6-9 months (BOK research)
```

### Stovall Cycle Table (appState.js lines 414-432)

| Sector | Trough | Expansion | Peak | Contraction | Rationale |
|--------|--------|-----------|------|-------------|-----------|
| tech | 1.12 | 1.08 | 0.93 | 0.90 | CapEx leader in recovery |
| semiconductor | 1.14 | 1.10 | 0.90 | 0.88 | Korea-specific: strongest trough recovery |
| financial | 1.12 | 1.04 | 0.94 | 0.92 | Low rates + loan demand at trough |
| cons_disc | 1.10 | 1.06 | 0.95 | 0.92 | Consumer recovery spending |
| industrial | 1.06 | 1.08 | 0.97 | 0.93 | CapEx follower |
| material | 0.96 | 1.04 | 1.08 | 0.94 | Commodity demand peak at late cycle |
| energy | 0.94 | 1.02 | 1.10 | 0.96 | Commodity price peak |
| healthcare | 1.02 | 1.00 | 1.02 | 1.06 | Non-cyclical demand, defensive |
| cons_staple | 0.98 | 0.98 | 1.02 | 1.08 | Inelastic demand, defensive |
| utility | 0.96 | 0.96 | 1.04 | 1.10 | Highest defensive in contraction |
| telecom | 1.02 | 1.00 | 1.00 | 1.04 | Mild defensive |
| realestate | 1.08 | 1.04 | 0.94 | 0.94 | Rate-sensitive, trough recovery |

### Rate Beta Sector Table (appState.js lines 472-485)

| Sector | Rate Beta | Interpretation |
|--------|-----------|----------------|
| financial | +0.05 | NIM expansion: benefits from rate hikes |
| energy | +0.03 | Inflation hedge |
| material | +0.02 | Inflation co-movement |
| industrial | +0.01 | Cycle > rate sensitivity |
| cons_staple | 0.00 | Rate neutral |
| telecom | -0.01 | Mild sensitivity |
| healthcare | -0.02 | Near neutral |
| cons_disc | -0.03 | Household borrowing cost |
| semiconductor | -0.04 | Capital-intensive growth |
| tech | -0.05 | DCF valuation compression |
| realestate | -0.07 | Leverage-dependent |
| utility | -0.08 | Bond-substitute demand falls |

### KSIC to Stovall Mapping (appState.js lines 435-464)

Keyword-based mapper `_getStovallSector()` converts Korean Standard Industry Classification names to 12 Stovall sectors. Priority order: semiconductor > tech > financial > healthcare > energy > utility > cons_disc > cons_staple > material > industrial > realestate > telecom.

### System Mapping -- Factor 1 + Factor 10

**Factor 1 (Cycle Phase + Stovall, lines 1095-1116):**
```javascript
var _sectorCycle = _macroSector ? _STOVALL_CYCLE[_macroSector] : null;
if (_sectorCycle && _sectorCycle[phase] != null) {
  var buyMult = _sectorCycle[phase];
  adj *= isBuy ? buyMult : (2.0 - buyMult);
} else {
  // Fallback: uniform phase adjustment (no sector differentiation)
  if (phase === 'expansion') adj *= isBuy ? 1.06 : 0.94;
  // ... etc.
}
```

**Factor 10 (Rate Beta x Direction, lines 1285-1301):**
```javascript
var rateDir = clamp(taylorGap / 2, -1, +1);
var levelAmp = (ktb10y > 4.0) ? 1.5 : 1.0;   // absolute rate level amplifier
var rateAdj = rateDir * rBeta * levelAmp;
adj *= isBuy ? (1.0 + rateAdj) : (1.0 - rateAdj);
```

> **UNVALIDATED FOR KOREA (Doc29 section 1.2):** The Stovall model is US S&P 500 based. Korean specifics -- semiconductor/auto export concentration (~25% KOSPI), chaebol structure, high retail investor KOSDAQ share -- mean the model serves as an analytical framework, not a validated prediction tool. KRX empirical backtesting is needed.

---

## MAC-10: DCC-GARCH Cross-Market Correlation

### Formula -- Dynamic Conditional Correlation (Engle 2002)

```
Conditional covariance matrix:
  H_t = D_t * R_t * D_t

where:
  D_t = diag(sqrt(h_{1,t}), sqrt(h_{2,t}), ..., sqrt(h_{n,t}))
      -- conditional standard deviations from individual GARCH models
  R_t = conditional correlation matrix (time-varying)

DCC update equations:
  Q_t = (1 - a - b) * Q_bar + a * epsilon_{t-1} * epsilon'_{t-1} + b * Q_{t-1}
  R_t = Q_tilde_t^{-1/2} * Q_t * Q_tilde_t^{-1/2}

where:
  Q_bar   = unconditional covariance matrix of standardized residuals (long-run average)
  a       = correlation innovation coefficient     (estimated: 0.02-0.08)
  b       = correlation persistence coefficient    (estimated: 0.90-0.96)
  epsilon = standardized residuals vector

Stability condition: a + b < 1
```

### Symbol Table

| Symbol | Meaning | Unit | Range | Estimated? |
|--------|---------|------|-------|-----------|
| H_t | Conditional covariance matrix | variance units | positive definite | MLE |
| D_t | Diagonal matrix of conditional std devs | -- | positive | From GARCH(1,1) |
| R_t | Conditional correlation matrix | -- | [-1, 1] per element | DCC update |
| Q_t | Proxy correlation matrix | -- | -- | Updated each period |
| Q_bar | Unconditional correlation matrix | -- | -- | Sample average |
| a | Innovation coefficient | dimensionless | [0.02, 0.08] | MLE on KRX data |
| b | Persistence coefficient | dimensionless | [0.90, 0.96] | MLE on KRX data |

### Cross-Market Correlation Estimates (Doc28 section 1.1)

| Market Pair | Correlation (r) | Notes |
|-------------|----------------|-------|
| KOSPI - S&P 500 | 0.65-0.75 | Gradually strengthening (+0.10 vs 2010s) |
| KOSPI - NASDAQ | 0.60-0.70 | Semiconductor/IT synchronization |
| KOSPI - Nikkei 225 | 0.70-0.80 | Highest: shared supply chains |
| KOSPI - Shanghai Composite | 0.40-0.55 | Declining (decoupling since 2020) |
| KOSPI - VIX | -0.65 | Strong negative |
| KOSDAQ - NASDAQ | 0.55-0.65 | Bio/software overlap |

### Asymmetric Correlation (Longin & Solnik 2001)

```
rho_down > rho_up    (bear-market correlation 0.15-0.25 higher than bull-market)

Implication: Individual technical patterns are overwhelmed by global trends
during downturns. Reversal (contrarian) signals have lower reliability during
global sell-offs.
```

### VIX -> VKOSPI Transmission

```
Transmission elasticity: d(VKOSPI) / d(VIX) = 0.85
  VIX +10pts -> VKOSPI +8.5pts (1-day basis)

Transfer entropy (Schreiber 2000):
  Stable: TE(VIX->VKOSPI) = 0.03-0.05 nats
  Crisis: TE jumps 3-5x -> information flow accelerates
  Reverse: TE(VKOSPI->VIX) = 0.005-0.01 nats (unidirectional confirmed)
```

### System Mapping

DCC-GARCH is **not directly implemented** as a running model in the CheeseStock codebase. Its insights are captured through:

1. **VIX_VKOSPI_PROXY = 1.12** (appState.js line 43): Static approximation of the VIX-VKOSPI relationship
2. **RORO Factor 1:** Uses VKOSPI/VIX level as the highest-weighted input (0.30)
3. **Factor 8 (VRP):** VIX-level thresholds (15/25/30) capture the regime-dependent correlation structure
4. **Crisis severity formula (Doc28, distributed):** Captures the asymmetric correlation intensification during crises

### Crisis Severity Index (Doc28 section 5.1)

```
crisis_severity = 0.4 * (VIX - 20) / 20
               + 0.3 * (VKOSPI - 22) / 18
               + 0.2 * (USD_KRW - 1300) / 100
               + 0.1 * foreign_sell_score

crisis_severity in [0, 1]  (max clamp)

Pattern adjustment (reversal patterns only):
  conf_adj = conf_raw * (1 - crisis_severity * 0.4)
  Maximum reduction: 40% at crisis_severity = 1.0
```

**Implementation status:** Distributed across Factor 8 (VIX), Factor 9 (rate differential), Factor 4 (foreign signal), and RORO classifier -- not a single unified function.

---

## Complete 11-Factor Macro Confidence Adjustment Table

The `_applyMacroConfidenceToPatterns()` function (appWorker.js lines 1071-1328) applies 11 independent multiplicative factors, clamped to [0.70, 1.25].

| # | Factor | Academic Basis | Input Data | Buy adj | Sell adj | Lines |
|---|--------|---------------|-----------|---------|----------|-------|
| 1 | Cycle phase + Stovall | IS-LM direction; Stovall (1996) | macro.cycle_phase + _STOVALL_CYCLE | +6-14% (trough) | +8-12% (contraction) | 1095-1116 |
| 2 | Yield curve 4-regime | Estrella & Mishkin (1998) | bonds.slope_10y3y + taylorGap | -12% (inverted) to +6% | +12% (inverted) to -5% | 1118-1150 |
| 3 | Credit regime | Bernanke & Gertler (1989) | bonds.credit_spreads.aa_spread | -15% (stress) | Same -15% (stress) | 1152-1161 |
| 4 | Foreign signal | UIP / Mundell-Fleming | macro.foreigner_signal | +5% (inflow) / -5% (outflow) | -4% / +5% | 1163-1172 |
| 5 | Pattern-specific override | Empirical WR + macro alignment | pattern type + phase + slope | +6-12% for high-WR aligned | Same | 1174-1210 |
| 6 | MCS v1 fallback | Doc29 section 6.2 | macro.mcs [0-1] | +10% max (MCS>0.6) | +10% max (MCS<0.4) | 1212-1226 |
| 7 | Taylor Rule gap | Taylor (1993) | macro.taylor_gap | +5% max (dovish) | +5% max (hawkish) | 1228-1254 |
| 8 | VRP (VIX level) | Carr & Wu (2009) | macro.vix | -7% (>30) to +3% (<15) | +2% (>25) to -2% (<15) | 1256-1269 |
| 9 | Rate differential | Mundell-Fleming | bok_rate - fed_rate | -5% (large inv) to +3% | +4% (large inv) to -2% | 1271-1283 |
| 10 | Rate Beta x direction | Damodaran (2012) | taylorGap * _RATE_BETA[sector] | Sector-dep, level-amplified | Symmetric inverse | 1285-1301 |
| 11 | KOSIS CLI-CCI gap | OECD CLI methodology | kosis_latest.cli_cci_gap | +4% (gap > 5) | +4% (gap < -5) | 1303-1316 |

**Final computation:**
```javascript
adj = Math.max(0.70, Math.min(1.25, adj));
p.confidence = Math.max(10, Math.min(100, Math.round(p.confidence * adj)));
p.confidencePred = Math.max(10, Math.min(95, Math.round(p.confidencePred * adj)));
```

---

## Composite Signal Macro Conditions (_applyMacroConditionsToSignals)

appWorker.js lines 1565-1626 applies macro-conditioned adjustments to 5 S/A-tier composite signals:

| Composite ID | Base Conf | Macro Boost Conditions | Max adj |
|-------------|-----------|------------------------|---------|
| sell_doubleTopNeckVol | 75 | contraction/peak x1.08; inverted x1.10; credit stress x1.06 | ~1.25 |
| buy_doubleBottomNeckVol | 72 | trough x1.12; slope>0.3 x1.05; foreign inflow x1.06 | ~1.24 |
| strongSell_shootingMacdVol | 69 | peak/contraction x1.06; inverted x1.08 | ~1.14 |
| sell_shootingStarBBVol | 69 | elevated/stress credit x1.05; peak x1.04 | ~1.09 |
| sell_engulfingMacdAlign | 66 | peak/contraction x1.06; foreign outflow x1.05 | ~1.11 |

Clamp: [0.70, 1.25]

---

## Fiscal Policy Multipliers (Korea-Specific)

### Government Spending Multiplier

```
Simple (closed):     k_G = 1/(1 - c_1*(1-t))          = 1/0.5875 = 1.70
Open-economy:        k_G_open = 1/(1 - c_1*(1-t) + m) = 1/1.0375 = 0.96
IS-LM (crowding):    k_G_ISLM = h/D = 2000/2315       = 0.86

NOTE: k_G_open < 1 -> 1 KRW government spending creates < 1 KRW GDP
Reason: m = 0.45 import leakage nearly neutralizes multiplier
```

### Tax Multiplier

```
k_T = -c_1 / (1 - c_1*(1-t) + m) = -0.55 / 1.0375 = -0.53
Balanced budget multiplier: k_BB = k_G + k_T = 0.96 + (-0.53) = 0.43
```

### International Comparison

| Country | Estimated k_G | Key driver | Source |
|---------|---------------|-----------|--------|
| Korea | 0.86-1.04 | High import leakage (m=0.45) | Kim & Park (2016) |
| US | 1.50-2.00 | Low import share (m=0.15) | Blanchard & Perotti (2002) |
| Japan | 1.10-1.50 | Intermediate import share | Bruckner & Tuladhar (2014) |
| Korea ZLB | ~1.95 | LM horizontal, no crowding-out | Christiano et al. (2011) |

### ZLB Special Case

| Constant | Value | Grade | Range | Source |
|----------|-------|-------|-------|--------|
| ZLB threshold rate | 0.75% | C | [0.25%, 1.00%] | Empirical; constant #94 |
| ZLB fiscal multiplier boost | 1.50 | D | [1.20, 2.00] | Christiano et al. (2011); constant #95 |

---

## Data Pipeline: API Source to JSON Output

### ECOS Series (15 total, download_macro.py)

| Key | Stat Code | Item Code | Description | Freq |
|-----|-----------|-----------|-------------|------|
| bok_rate | 722Y001 | 0101000 | BOK base rate | M |
| ktb10y | 721Y001 | 5050000 | KTB 10-year yield | M |
| ktb3y | 721Y001 | 5020000 | KTB 3-year yield | M |
| m2 | 161Y006 | BBHA00 | M2 broad money | M |
| cli | 901Y067 | I16A | CLI cyclical component | M |
| cpi | 901Y009 | 0 | CPI total index | M |
| bsi_mfg | 512Y013 | C0000/AA | Manufacturing BSI | M |
| export_value | 901Y118 | T002 | Export value (thou USD) | M |
| ipi | 901Y033 | A00/2 | Industrial production SA | M |
| foreign_equity | 301Y013 | BOPF22100000 | Foreign equity inflow (mil USD) | M |
| cd_rate_91d | 721Y001 | 2010000 | CD 91-day rate | M |
| cp_rate_91d | 721Y001 | 4020000 | CP 91-day rate | M |
| household_credit | 151Y002 | 1110000 | Household loans (bil KRW) | M |
| unemployment_rate | 901Y027 | I61BC | Unemployment rate | M |
| house_price_idx | 901Y064 | P65A | House price index (national) | M |

### FRED Series (8 total, download_macro.py)

| Key | Series ID | Description |
|-----|-----------|-------------|
| fed_rate | FEDFUNDS | Federal Funds Rate |
| us10y | DGS10 | US 10Y Treasury |
| us_cpi | CPIAUCSL | US CPI (SA) |
| us_unemp | UNRATE | US Unemployment |
| us_breakeven | T10YIE | US 10Y Breakeven Inflation |
| us_hy_spread | BAMLH0A0HYM2 | US HY Spread |
| dxy_fred | DTWEXBGS | Trade-Weighted USD |
| vix_fred | VIXCLS | VIX Daily Close |

### KOSIS Series (12 total, download_kosis.py, table DT_1C8016)

| C1 Code | Key | Description |
|---------|-----|-------------|
| A01 | cli_composite | Leading Composite Index (2020=100) |
| A0102 | esi | Economic Sentiment Index |
| A0104 | construction_orders | Construction orders (real) |
| A0106 | kospi_kosis | KOSPI index (KOSIS) |
| A0107 | rate_spread_5y | 5Y KTB - call rate spread |
| B02 | cci_composite | Coincident Composite Index (2020=100) |
| B0201 | ipi_all | Industrial production (cross-validation with ECOS) |
| B0204 | retail_sales | Retail sales index |
| B0207 | employed_nonfarm | Non-farm employment (thousands) |
| C03 | lag_composite | Lagging Composite Index (2020=100) |
| C0301 | inventory_index | Producer inventory index |
| C0305 | cp_yield_kosis | CP yield (cross-validation with ECOS) |

---

## Learnable Constants Summary (Macro Domain)

### Doc30 Constants #83-#98

| # | Name | Default | Grade | Learn | Range | Source |
|---|------|---------|-------|-------|-------|--------|
| 83 | MCS_v2 Taylor gap weight (w6) | 0.10 | C | GCV | [0.05, 0.20] | Doc30 section 4.3 |
| 84 | BOK event conf_adj | 1.08 | C | GS | [1.03, 1.15] | Doc30 section 1.4 |
| 85 | Fiscal event conf_adj | 1.03 | D | GS | [1.00, 1.08] | Doc30 section 1.4 |
| 86 | VKOSPI Keynesian threshold | 25 | C | GS | [20, 35] | Doc30 section 3.3 |
| 87 | VKOSPI Classical threshold | 15 | C | GS | [10, 20] | Doc30 section 3.3 |
| 88 | Momentum regime conf_adj | +0.08 | D | WLS | [0.03, 0.15] | Doc30 section 3.3 |
| 89 | Mean-reversion regime conf_adj | +0.05 | D | WLS | [0.02, 0.10] | Doc30 section 3.3 |
| 90 | Goldilocks CPI ceiling | 2.5% | C | GS | [2.0%, 3.0%] | Doc30 section 6.2 |
| 91 | Stagflation CPI floor | 3.0% | C | GS | [2.5%, 4.0%] | Doc30 section 6.2 |
| 92 | Demand expansion trend adj | +0.08 | D | WLS | [0.03, 0.15] | Doc30 section 6.2 |
| 93 | Stagflation all-pattern adj | -0.12 | D | WLS | [-0.20, -0.05] | Doc30 section 6.2 |
| 94 | ZLB threshold rate | 0.75% | C | Manual | [0.25%, 1.00%] | Doc30 section 5.3 |
| 95 | ZLB fiscal multiplier boost | 1.50 | D | GS | [1.20, 2.00] | Christiano et al. (2011) |
| 96 | Taylor a_pi | 0.50 | B | GS | [0.30, 0.80] | Taylor (1993) |
| 97 | Taylor a_y | 0.50 | B | GS | [0.25, 0.75] | Taylor (1993) |
| 98 | Taylor a_e | 0.10 | C | GS | [0.05, 0.20] | Kim & Park (2016) |

### Implementation-Derived Constants

| Constant | Value | Grade | Source | System Location |
|----------|-------|-------|--------|-----------------|
| VIX_VKOSPI_PROXY | 1.12 | C | Whaley (2009) | appState.js line 43 |
| TAYLOR_R_STAR (code) | 0.5% | C | Author judgment | compute_macro_composite.py line 65 |
| TAYLOR_PI_STAR | 2.0% | A | BOK official | compute_macro_composite.py line 66 |
| TAYLOR_RHO | 0.80 | C | Woodford (2003) | download_macro.py line 215; #167 |
| MCS strong_bull | 70 | D | Empirical | appState.js MCS_THRESHOLDS |
| MCS strong_bear | 30 | D | Empirical | appState.js MCS_THRESHOLDS |
| RORO ENTER_ON | 0.25 | D | Empirical | appWorker.js line 1430 |
| RORO ENTER_OFF | -0.25 | D | Empirical | appWorker.js line 1430 |
| Macro adj clamp upper | 1.25 | C | Manual | appWorker.js line 1319 |
| Macro adj clamp lower | 0.70 | C | Manual | appWorker.js line 1319 |
| RORO adj clamp | [0.92, 1.08] | C | Manual | appWorker.js line 1471 |
| UIP w_vix | 0.45 | C | Empirical | download_macro.py line 200 |
| UIP w_rate | 0.30 | C | Empirical | download_macro.py line 201 |
| UIP w_dxy | 0.25 | C | Empirical | download_macro.py line 202 |

**Grade distribution:** A: 2, B: 3, C: 18, D: 12 -- heavily C/D reflecting empirical uncertainty in macro-to-pattern transmission.

---

## Findings

### FND-MAC-1: Taylor Rule r\* discrepancy (OPEN)

**Issue:** Doc30 specifies r\* = 1.0%; `calc_taylor_implied_rate()` defaults r_star=1.0; but `compute_macro_composite.py` TAYLOR_R_STAR = 0.5.

**Impact:** 50bp lower r\* systematically biases the composite Taylor gap upward (more hawkish). The system perceives monetary policy as tighter than it is relative to the doc-specified neutral rate.

**Assessment:** Both values within uncertainty band +/-1pp (Grade C). The download_macro.py version (r\*=1.0) is academically standard; the composite version (r\*=0.5) may reflect post-COVID neutral rate decline judgment.

**Recommendation:** Unify to r\*=0.5 with comment documenting divergence from Doc30, or make configurable.

### FND-MAC-2: MCS weight structure diverges from Doc29/Doc30 (DOCUMENTED)

**Issue:** Three different MCS specifications exist: Doc29 (5 components), Doc30 (6 components), compute_macro_composite.py (8 components), download_macro.py (6 components). The 8-component version has different emphasis (PMI dropped from 0.25 to 0.10, CLI 0.20 and ESI 0.15 added).

**Assessment:** The 8-component implementation is arguably superior (broader coverage, directly available KOSIS data). The 6-component download_macro.py version is used for the raw `mcs` field while the 8-component version produces the `mcsV2` field.

### FND-MAC-3: TAYLOR_OUTPUT_GAP hardcoded to 0.0 in compute_macro_composite.py (OPEN)

**Issue:** Line 67 sets `TAYLOR_OUTPUT_GAP = 0.0` despite CLI data being available and Doc30 specifying the proxy `(CLI - 100) * 0.5`.

**Impact:** Taylor rule calculation ignores output gap entirely in the composite script. The download_macro.py version correctly uses CLI-based estimation.

**Recommendation:** Replace with CLI-based calculation when CLI data is available.

### FND-MAC-4: Crisis severity formula distributed, not unified (DOCUMENTED)

**Issue:** Doc28's single `crisis_severity` composite (VIX 0.4, VKOSPI 0.3, USD/KRW 0.2, foreign 0.1) is implemented across multiple independent factors rather than as one function.

**Assessment:** The distributed approach provides better individual tuning but makes aggregate crisis response harder to verify against documentation.

### FND-MAC-5: Stovall sector rotation unvalidated for KRX (KNOWN)

**Issue:** Doc29 explicitly warns "UNVALIDATED FOR KOREA." Multipliers (max +14%, min -12%) lack KRX backtesting.

**Recommendation:** Conduct KRX sector-phase backtesting. Consider applying a dampening factor (0.5x) until validation.

### FND-MAC-6: MCS double-application safeguard is fragile (DOCUMENTED)

**Issue:** Factor 6 checks `!(_macroComposite && _macroComposite.mcsV2 != null)` to avoid double application with Phase 8. Scale difference (0-1 vs 0-100) could cause issues if fallback activates incorrectly.

---

## References

1. Hicks, J.R. (1937). Mr. Keynes and the "Classics." *Econometrica*, 5(2), 147-159.
2. Mundell, R.A. (1963). Capital Mobility and Stabilization Policy. *Canadian Journal of Economics*, 29(4), 475-485.
3. Fleming, J.M. (1962). Domestic Financial Policies Under Fixed and Under Floating Exchange Rates. *IMF Staff Papers*, 9(3), 369-380.
4. Taylor, J.B. (1993). Discretion versus Policy Rules in Practice. *Carnegie-Rochester Conference Series*, 39, 195-214.
5. Ball, L. (1999). Policy Rules for Open Economies. In Taylor (ed.), *Monetary Policy Rules*. University of Chicago Press.
6. Stovall, R. (1996). *S&P Guide to Sector Investing*. McGraw-Hill.
7. Estrella, A. & Mishkin, F.S. (1998). Predicting U.S. Recessions. *Review of Economics and Statistics*, 80(1), 45-61.
8. Mishkin, F.S. (1995). Symposium on the Monetary Transmission Mechanism. *JEP*, 9(4), 3-10.
9. Kim, S. & Park, Y. (2016). Monetary Policy Transmission in Korea. *BOK Working Paper*.
10. Shin, K. & Wang, Y. (2003). Trade Integration and Business Cycle Synchronization. *Asian Economic Papers*, 2(3), 1-20.
11. Damodaran, A. (2012). *Investment Valuation*. 3rd ed. Wiley.
12. Engle, R.F. (2002). Dynamic Conditional Correlations. *JBES*, 20(3), 339-350.
13. Longin, F. & Solnik, B. (2001). Extreme Correlation of International Equity Markets. *JF*, 56(2), 649-676.
14. Forbes, K.J. & Rigobon, R. (2002). No Contagion, Only Interdependence. *JF*, 57(5), 2223-2261.
15. Baele, L., Bekaert, G. & Inghelbrecht, K. (2010). Stock and Bond Return Comovements. *RFS*, 23(6), 2374-2428.
16. Calvo, G.A. (1983). Staggered Prices in a Utility-Maximizing Framework. *JME*, 12(3), 383-398.
17. Gali, J. & Gertler, M. (1999). Inflation Dynamics. *JME*, 44(2), 195-222.
18. Woodford, M. (2003). *Interest and Prices*. Princeton University Press.
19. Clarida, R., Gali, J. & Gertler, M. (1999). The Science of Monetary Policy. *JEL*, 37(4), 1661-1707.
20. Rudebusch, G.D. (2002). Term Structure Evidence on Interest Rate Smoothing. *JME*, 49(6), 1161-1187.
21. Romer, D. (2000). Keynesian Macroeconomics without the LM Curve. *JEP*, 14(2), 149-169.
22. Laubach, T. & Williams, J.C. (2003). Measuring the Natural Rate of Interest. *RES*, 85(4), 1063-1070.
23. Carr, P. & Wu, L. (2009). Variance Risk Premiums. *RFS*, 22(3), 1311-1341.
24. Whaley, R.E. (2009). Understanding the VIX. *JPM*, 35(3), 98-105.
25. Blanchard, O. & Perotti, R. (2002). Effects of Government Spending and Taxes on Output. *QJE*, 117(4), 1329-1368.
26. Christiano, L.J., Eichenbaum, M. & Rebelo, S. (2011). When Is the Government Spending Multiplier Large? *JPE*, 119(1), 78-121.
27. Schreiber, T. (2000). Measuring Information Transfer. *PRL*, 85(2), 461-464.
28. Bernanke, B. & Gertler, M. (1989). Agency Costs, Net Worth, and Business Fluctuations. *AER*, 79(1), 14-31.
29. Lane, P.R. & Milesi-Ferretti, G.M. (2007). External Wealth of Nations Mark II. *JIE*, 73(2), 223-250.
30. Jegadeesh, N. & Titman, S. (1993). Returns to Buying Winners and Selling Losers. *JF*, 48(1), 65-91.
31. DeBondt, W.F.M. & Thaler, R.H. (1985). Does the Stock Market Overreact? *JF*, 40(3), 793-805.
32. Lemmon, M. & Portniaguina, E. (2006). Consumer Confidence and Asset Prices. *RFS*, 19(4), 1499-1529.
33. Richards, A. (2005). Big Fish in Small Ponds. *JFQA*, 40(1), 1-27.
34. Hamilton, J.D. (1989). A New Approach to the Economic Analysis of Nonstationary Time Series. *Econometrica*, 57(2), 357-384.
35. Baker, S.R., Bloom, N. & Davis, S.J. (2016). Measuring Economic Policy Uncertainty. *QJE*, 131(4), 1593-1636.

---

**Document history:**
- v1-v5 (2026-04-06): Prior versions in S2_sec25_macroeconomics.md
- v6 (2026-04-06): Complete rewrite with MAC-1 through MAC-10 formula numbering, CFA paper grade annotations, full API-to-confidence trace, live data snapshot, 6 findings documented
