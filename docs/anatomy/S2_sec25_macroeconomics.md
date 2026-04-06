# 2.5 Macroeconomic Foundations

> Stage 2 -- ANATOMY V5 Section 2.5
>
> Author: Macro Economist Agent
> Date: 2026-04-06
> Sources: core_data/30, core_data/29, core_data/28, js/appWorker.js, js/appState.js, scripts/compute_macro_composite.py

---

## Overview

CheeseStock's macro layer consists of **four stacked confidence-adjustment functions** that modulate pattern reliability based on macroeconomic regime, monetary policy stance, and cross-market risk signals. The theoretical foundation spans IS-LM equilibrium analysis (Hicks 1937), Mundell-Fleming open-economy extension, Taylor Rule monetary policy assessment, Stovall sector rotation, and AD-AS shock classification.

**Adjustment pipeline order** (appWorker.js):

```
_applyMarketContextToPatterns()     -- CCSI, foreign flow, earning season
    |
_applyMacroConfidenceToPatterns()   -- 11 factors, [0.70, 1.25] clamp
    |
_applyPhase8ConfidenceToPatterns()  -- MCS v2, HMM regime, DD, options
    |
_applyRORORegimeToPatterns()        -- Risk-On/Off 3-regime, [0.92, 1.08] clamp
    |
_applyMicroConfidenceToPatterns()   -- Amihud ILLIQ, HHI, [0.80, 1.15] clamp
```

---

## 2.5.1 IS-LM Framework

### IS Curve (Goods Market Equilibrium)

The IS curve represents all (Y, r) combinations where the goods market clears.

**Derivation:**

```
Y = C + I + G + NX

where:
  C  = C_0 + c_1 * (Y - T)              -- consumption
  I  = I_0 - b * r                       -- investment
  G  = G_0                               -- government spending (exogenous)
  T  = T_0 + t * Y                       -- taxation
  NX = X_0 - m * Y + eta * e             -- net exports
```

**Variable Annotations (IS behavioral equations):**

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| Y | Real GDP (output) | trillion KRW | [1,500, 2,500] | BOK quarterly |
| r | Real interest rate | % | [0, 8] | BOK base rate - CPI |
| C_0 | Autonomous consumption | trillion KRW | exogenous | National Accounts |
| c_1 | Marginal propensity to consume (MPC) | dimensionless | [0.50, 0.65] | BOK (2023) |
| I_0 | Autonomous investment | trillion KRW | exogenous | |
| b | Investment sensitivity to interest rate | trillion KRW per %pt | [800, 1800] | Kim & Park (2016) |
| t | Marginal tax rate | dimensionless | 0.25 (fixed) | National Tax Stats |
| m | Marginal propensity to import | dimensionless | [0.38, 0.52] | Customs Admin |
| eta | Export elasticity to exchange rate | dimensionless | [0.40, 0.80] | Shin & Wang (2003) |
| e | Real exchange rate (up = KRW weak = exports up) | index | variable | BOK |
| X_0 | Autonomous exports | trillion KRW | exogenous | Customs Admin |

**Solving for Y as function of r:**

```
Let A = C_0 - c_1*T_0 + I_0 + G_0 + X_0 + eta*e    (autonomous spending)
Let s = 1 - c_1*(1-t) + m                             (marginal leakage rate)

IS curve:  r = A/b - (s/b) * Y                        (downward sloping)

Slope: dr/dY = -s/b < 0
```

**Korean parameter calibration:**

| Parameter | Symbol | Value | Grade | Justification |
|-----------|--------|-------|-------|---------------|
| MPC | c_1 | 0.55 | B | BOK 2023 National Accounts; post-COVID household debt may have shifted this downward |
| Marginal tax rate | t | 0.25 | A | National Tax Statistics annual average, fixed for Korea |
| Marginal propensity to import | m | 0.45 | B | Korea Customs; structurally high (export-dependent economy, GDP ratio ~50%) |
| Investment interest sensitivity | b | 1200 | C | Kim & Park (2016); wide uncertainty [800, 1800] |
| FX export elasticity | eta | 0.60 | C | Shin & Wang (2003); range [0.40, 0.80] |

> **Parameter Vintage Warning (Doc30 section 1.1):** These estimates are based on 2010-2016 Korean data. Post-COVID structural changes (supply chain reshoring, digital acceleration, household debt surge) may have altered c_1 downward and m unpredictably. Re-estimation with 2020-2025 data is recommended before using these in any production calibration.

### LM Curve (Money Market Equilibrium)

```
Money demand:  L(Y, r) = k * Y - h * r
Money supply:  M^s / P  (exogenous real money supply)

Equilibrium:   M/P = k*Y - h*r

LM curve:  r = (k/h) * Y - (M/P) / h    (upward sloping)

Slope: dr/dY = k/h > 0
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| k | Income sensitivity of money demand | dimensionless | [0.15, 0.30] | BOK M2/GDP |
| h | Interest sensitivity of money demand | trillion KRW per %pt | [1200, 3500] | Kim & Park (2016) |
| M | Nominal money supply | trillion KRW | exogenous | BOK M2 |
| P | Price level (GDP deflator) | index (2020=100) | positive | Statistics Korea |

**Two extreme cases with KRX implications:**

| Case | Condition | LM shape | Monetary policy effectiveness | Pattern implication |
|------|-----------|----------|-------------------------------|---------------------|
| Liquidity trap | h -> inf | Horizontal at r_min | Zero (all added liquidity absorbed as speculative balances) | BOK rate-decision trading signals attenuate; happened Korea 2020 Q2 at 0.50% |
| Classical case | h -> 0 | Vertical | Maximum (money -> output 1:1) | BOK announcements dominate all pattern signals |

> **Modern Reinterpretation (Romer 2000):** Modern central banks target interest rates, not money supply. The LM curve is better replaced by a horizontal MP rule (i = Taylor rule output). Section 2.5.4 below adopts this IS-MP approach. The LM framework here is retained for pedagogical completeness and for explaining why the Taylor Gap factor (Factor 7) supersedes a raw money-supply signal.

### IS-LM Equilibrium and Comparative Statics

```
Solving IS and LM simultaneously:

Y* = [h*A + b*(M/P)] / D
r* = [k*A - s*(M/P)] / D

where D = h*s + b*k  (always positive)
```

**Comparative statics relevant to KRX:**

| Shock | dY* | dr* | Equity market effect | CheeseStock mapping |
|-------|-----|-----|---------------------|---------------------|
| G up (fiscal expansion) | +h/D > 0 | +k/D > 0 | Y up but r up (partial crowding-out); growth stocks: r-pressure, value stocks: Y-benefit | conf_fiscal = 1.03 (weak, Doc30 section 1.4) |
| M/P up (monetary expansion) | +b/D > 0 | -s/D < 0 | Y up AND r down (double positive); broadly bullish, especially growth | Factor 7 Taylor gap -> dovish -> buy boost |
| T up (tax hike) | -c_1*h/D < 0 | -c_1*k/D < 0 | Y down, r down; consumer discretionary bearish | Not directly implemented |
| X_0 up (export boom) | +h/D > 0 | +k/D > 0 | Export sectors directly benefit | MCS export_growth component |
| Oil price spike (supply shock) | Ambiguous | Ambiguous | Stagflation -> all patterns conf * 0.88 | AD-AS regime detection |

**Equity Duration concept (connecting r-change to stock prices):**

```
D_equity = 1 / (r_e - g)

where:
  r_e  = cost of equity (required return)
  g    = earnings growth rate

Growth stock (g=8%, r_e=10%):  D_equity = 50   (extremely rate-sensitive)
Value stock  (g=2%, r_e=10%):  D_equity = 12.5 (relatively insensitive)

Price impact:  dP/P = -D_equity * dr

BOK -25bp cut:
  Growth: +12.5% theoretical (empirical: +5-8%, reflecting pre-pricing)
  Value:  +3.1% theoretical  (empirical: +1-2%)
  Financials: -1 to -2% (NIM compression, opposing channel)
```

---

## 2.5.2 Mundell-Fleming (Open Economy IS-LM-BP)

Korea is a small open economy with exports at ~50% of GDP. Closed-economy IS-LM is insufficient. Mundell (1963) and Fleming (1962) add the Balance of Payments equilibrium.

### BP Curve

```
BP = NX(Y, e) + KA(r - r*, E[de]) = 0

NX    = X_0 - m*Y + eta*e                  (current account)
KA    = kappa * (r - r* - E[de])            (capital account)

BP curve:  r = r* + E[de] + (m/kappa)*Y - (X_0 + eta*e)/kappa

Slope: dr/dY = m / kappa
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| kappa | Capital mobility parameter | trillion KRW per %pt | [2000, inf) | Lane & Milesi-Ferretti (2007) |
| r* | World interest rate (proxy: Fed funds rate) | % | [0, 6] | FRED |
| E[de] | Expected exchange rate depreciation | % | variable | Forward premium |

Korea's choice: kappa approx 5000 (near-perfect capital mobility, post-2000 liberalization).

### Mundell-Fleming Trilemma

Three simultaneously impossible goals:
1. Free capital movement
2. Independent monetary policy
3. Fixed exchange rate

**Korea's choice: (1) + (2) -> (3) abandoned (floating rate since 1997)**

> Caveat: Korea is de jure floating but de facto managed-float. BOK uses FX stabilization fund and verbal guidance to dampen extreme volatility. IMF classification (2024): "floating" with intervention history.

### Policy Effectiveness Under Floating Rate

**Monetary expansion (M up):**
```
r down -> capital outflow -> KRW weakens -> NX up -> IS shifts right -> Y increases strongly
Result: MONETARY POLICY STRONG under floating rate
KRX: Export stocks especially bullish (FX + rate double benefit)
```

**Fiscal expansion (G up):**
```
r up -> capital inflow -> KRW strengthens -> NX down -> IS partially offsets
Result: FISCAL POLICY WEAK under floating rate
KRX: Crowding-out + appreciation -> export stocks hurt, only domestic demand sectors benefit mildly
```

**Key CheeseStock insight (Doc30 section 1.4):**

```
BOK rate decision impact > supplementary budget impact
  Empirical: BOK -25bp -> KOSPI +1.2% (same day)
             Supplementary budget 10 tril KRW -> KOSPI +0.3% (same day)

Pattern confidence adjustment:
  BOK rate decision day: conf_adj = +/-1.08 (monetary policy strong)
  Supplementary budget:  conf_adj = +/-1.03 (fiscal policy weak)
```

| Constant | Symbol | Value | Grade | Justification |
|----------|--------|-------|-------|---------------|
| BOK event conf adjustment | conf_bok | 1.08 | C | Doc29 section 3.1 empirical; range [1.03, 1.15] |
| Fiscal event conf adjustment | conf_fiscal | 1.03 | D | Theoretical (Mundell-Fleming weak fiscal); insufficient Korean empirical evidence |

### USD/KRW Transmission to KRX (Doc28 section 3)

Two opposing channels with different time horizons:

```
Short-term (1-3 trading days):
  KRW weakness -> foreign investors' USD-denominated return falls -> net selling -> stock prices fall
  beta_FX(short) = -0.2 to -0.4

Medium-term (1+ months):
  KRW weakness -> exporters' KRW-denominated revenue rises -> EPS upgrade -> stock prices rise
  beta_FX(medium) = +0.1 to +0.3
```

**Sector FX sensitivity (Doc28 section 3.2):**

| Category | Sectors | beta_FX | Mechanism |
|----------|---------|---------|-----------|
| Export beneficiary (medium-term positive) | Samsung Electronics, SK hynix, Hyundai Motor, Kia | +0.3 to +0.5 | KRW revenue translation |
| Import cost burden (negative) | Airlines (Korean Air), refiners | -0.2 to -0.4 | Fuel/raw material costs |
| Neutral (domestic defensive) | Telecom (SKT), utilities, food & beverage | 0 to +/-0.05 | Domestic demand insulated |

KOSPI index-level: beta_FX = +0.15 (long-term, reflecting manufacturing weight).
KOSDAQ index-level: beta_FX = -0.05 to 0 (bio/domestic heavy).

**Implementation in appWorker.js Factor 9 (rate differential):**

```javascript
// Factor 9: Mundell-Fleming rate differential (line 1271-1283)
// rate_diff = bok_rate - fed_rate
// Negative: Korea rate < US -> capital outflow pressure
if (rateDiff < -1.5)  adj *= isBuy ? 0.95 : 1.04;   // large inversion
if (rateDiff < -0.5)  adj *= isBuy ? 0.98 : 1.02;   // mild inversion
if (rateDiff > 1.0)   adj *= isBuy ? 1.03 : 0.98;   // Korea premium -> inflow
```

---

## 2.5.3 AD-AS Framework

### Aggregate Demand (AD)

Derived from IS-LM by varying P:

```
AD: Y_AD(P) = [h*A + b*(M/P)] / D

Slope: dY_AD/dP = -b*M / (D * P^2) < 0    (downward sloping)
```

Three mechanisms for AD downward slope:
1. **Pigou effect (real balance):** P down -> M/P up -> real wealth up -> C up -> Y up
2. **Keynes effect (interest rate):** P down -> M/P up -> LM shifts right -> r down -> I up -> Y up
3. **Mundell-Fleming effect (exchange rate):** P down -> real FX rate up (KRW weak) -> NX up -> Y up (strongest in Korea given export share ~50%)

**AD shift factors relevant to KRX:**

| Shock | AD shift | KRX sector impact |
|-------|----------|-------------------|
| G up (government spending) | Right | Construction/SOC, but weak effect |
| M up (monetary supply) | Right | Broadly bullish |
| China GDP up | Right (via X_0) | Semiconductors, chemicals, steel |
| US recovery | Right (via X_0) | IT, autos |
| Oil price surge | Left (cost push via SRAS) + mixed | Refiners up, airlines down |

### Aggregate Supply (AS) -- Three Paradigms

**1. Classical Long-Run AS (LRAS):**
```
LRAS: Y = Y_n     (natural output, vertical)
Money is neutral in long run. No policy affects Y.
```

**2. Keynesian Short-Run AS (SRAS):**
```
SRAS: P = P_e + (1/alpha) * (Y - Y_n)

where:
  P_e   = expected price level (set during wage contracts)
  alpha = price stickiness parameter, value 1.20 [C grade]
  Y_n   = natural (potential) output
```

**3. New Keynesian Phillips Curve (NKPC):**
```
NKPC: pi_t = beta * E_t[pi_{t+1}] + kappa * y_tilde

where:
  pi_t       = inflation rate                          [%, observable]
  beta       = discount factor                         [0.99, A grade, standard]
  y_tilde    = output gap = (Y_t - Y_n) / Y_n         [%, estimated]
  kappa      = NKPC slope                              [0.05, B grade]
  theta      = Calvo price stickiness (fraction of     [0.75, B grade, Kim & Park 2016]
               firms unable to adjust each period)      meaning avg 4 quarters between adjustments
```

Korea's theta = 0.75 > US theta = 0.66 -> prices are stickier in Korea -> monetary policy transmits more strongly to real output (and thus stock prices) than in the US.

### AD-AS Shock Scenarios and Pattern Implications

| Scenario | Cause | P | Y | Pattern implication | conf_adj |
|----------|-------|---|---|---------------------|----------|
| 1. Positive demand shock (AD right) | M up, export boom, consumer confidence | Up | Up | Trend-following patterns strengthen | trend +0.08, reversal -0.05 |
| 2. Negative demand shock (AD left) | Tightening, export collapse, consumer fear | Down | Down | Bottom-reversal patterns strengthen | reversal +0.10, breakout -0.08 |
| 3. Negative supply shock (SRAS left) | Oil spike, supply chain disruption | Up | Down | STAGFLATION: all patterns weaken (conflicting signals) | ALL -0.12 |
| 4. Positive supply shock (SRAS right) | Tech innovation, semiconductor supercycle | Down | Up | GOLDILOCKS: all patterns strengthen (max signal-to-noise) | ALL +0.05 |

**Korean historical examples (Doc30 section 2.3):**

| Period | Type | Shock | KOSPI reaction | Pattern reliability |
|--------|------|-------|---------------|---------------------|
| 2022 H1 | Supply (-) | Russia-Ukraine oil surge | -25% | Degraded (stagflation) |
| 2023 H2 | Supply (+) | Semiconductor upturn + oil stabilization | +18% | Improved (near-goldilocks) |
| 2020 Q1 | Demand (-) | COVID shock | -35% | Reversal accuracy improved |
| 2020 Q3 | Demand (+) | Liquidity flood + fiscal stimulus | +42% | Trend accuracy improved |

**Regime detection rule (Doc30 section 6.2):**
```
if GDP_gap > 0 AND CPI_yoy < 2.5%:   'goldilocks'
if GDP_gap > 0 AND CPI_yoy >= 2.5%:  'demand_expansion'
if GDP_gap < 0 AND CPI_yoy >= 3.0%:  'stagflation'
if GDP_gap < 0 AND CPI_yoy < 3.0%:   'demand_contraction'
```

---

## 2.5.4 Taylor Rule

### Standard Taylor Rule (Taylor 1993)

```
i = r* + pi + a_pi * (pi - pi*) + a_y * (y - y*)
```

**Full variable annotation:**

| Symbol | Meaning | Unit | Value/Range | Grade | Source |
|--------|---------|------|-------------|-------|--------|
| i | Nominal policy rate (Taylor-implied) | % | computed | -- | Output |
| r* | Natural (equilibrium) real interest rate | % | 1.0 (Korea 2020s) | C | Laubach-Williams method; BOK (2023); uncertainty band +/-1pp. Note: compute_macro_composite.py uses 0.5 -- see Finding F-1. |
| pi | Current inflation rate (CPI YoY) | % | observable | -- | Statistics Korea |
| pi* | Inflation target | % | 2.0 | A | BOK official target (fixed since 2016) |
| a_pi | Inflation gap response coefficient | dimensionless | 0.50 | B | Taylor (1993); range [0.30, 0.80] |
| a_y | Output gap response coefficient | dimensionless | 0.50 | B | Taylor (1993); range [0.25, 0.75] |
| y | Actual output (or log GDP) | index | observable | -- | BOK quarterly |
| y* | Potential output | index | estimated | -- | BOK semiannual estimate |

**Extended Taylor Rule for open economy (Ball 1999):**

```
i = r* + pi + a_pi * (pi - pi*) + a_y * (y - y*) + a_e * Delta_e
```

| Symbol | Meaning | Value | Grade | Source |
|--------|---------|-------|-------|--------|
| a_e | Exchange rate change response | 0.10 | C | Kim & Park (2016); Ball (1999) for small open economies; range [0.05, 0.20] |
| Delta_e | KRW/USD change rate | % | observable | implies +100bp additional tightening per 10% KRW depreciation |

### Taylor Gap

```
Taylor_gap = i_actual - i_Taylor

Taylor_gap > 0:  Overtly tight (hawkish)
  -> Growth stocks suppressed, financial stocks benefit
  -> Forward: eventual easing pivot -> growth stock accumulation opportunity
  Half-life: ~4 quarters (Rudebusch 2002)

Taylor_gap < 0:  Overtly loose (dovish)
  -> Growth stocks overheat, asset bubble risk
  -> Forward: eventual tightening pivot -> defensive positioning
```

### Output Gap Estimation via CLI (Implementation)

Since BOK publishes output gap estimates only semiannually, the system uses CLI as a real-time proxy:

```python
# compute_macro_composite.py (line 265-267):
output_gap = (CLI - 100) * CLI_TO_GAP_SCALE
CLI_TO_GAP_SCALE = 0.5   (constant #139)

# Taylor rule calculation:
r_taylor = TAYLOR_R_STAR + pi + 0.5 * (pi - TAYLOR_PI_STAR) + 0.5 * output_gap
gap = bok_rate - r_taylor
```

> **Limitation:** CLI is a leading indicator, not a direct measure of the current output gap. It provides directional guidance rather than precise level estimation.

### Implementation: Factor 7 (appWorker.js lines 1228-1254)

```javascript
// Taylor Rule Gap:  i_actual - i_Taylor
// Sign convention: gap > 0 = hawkish, gap < 0 = dovish
// Normalization: gap / 2 -> [-1, +1]
// Dead band: |tgNorm| <= 0.25 -> no adjustment (constant #141)
// Maximum adjustment: +/- 5% (constant #140)

if (taylorGap != null) {
  var tgNorm = Math.max(-1, Math.min(1, taylorGap / 2));
  if (tgNorm < -0.25) {        // dovish
    var tAdj = 1.0 + Math.abs(tgNorm) * 0.05;
    adj *= isBuy ? tAdj : (2.0 - tAdj);
  } else if (tgNorm > 0.25) {  // hawkish
    var tAdj = 1.0 + Math.abs(tgNorm) * 0.05;
    adj *= isBuy ? (2.0 - tAdj) : tAdj;
  }
}
```

---

## 2.5.5 Five Monetary Policy Transmission Channels (Mishkin 1995)

| Channel | Mechanism | Primary KRX beneficiaries | Lag (stock price) | Lag (GDP) | Relative strength (Korea) |
|---------|-----------|--------------------------|-------------------|-----------|--------------------------|
| 1. Interest rate | BOK r down -> market rates down -> investment cost down -> I up | Growth stocks, construction, REITs | Immediate to 1 week | 3-6 months | Medium-high |
| 2. Exchange rate | BOK r down -> rate diff narrows -> capital outflow -> KRW weak -> NX up | Export (semiconductors, autos) | Immediate | 3-6 months | **Highest** (Korea-specific: export ~50% GDP) |
| 3. Asset price | BOK r down -> PV(dividends) = D/(r-g) up -> wealth effect -> C up | All equities (proportional to duration) | Immediate | 1-3 months | Medium-high |
| 4. Credit | BOK r down -> bank lending rate down -> credit expansion | KOSDAQ small caps, real estate (bank-loan dependent) | 1-3 months | 6-12 months | Medium (KOSDAQ amplified) |
| 5. Expectations | Forward guidance -> expected inflation/growth path changed | All (front-run) | Immediate | Variable | **Growing** (BOK communication improving since 2024) |

**Korea-specific observations:**
- Channel 2 (exchange rate) is relatively stronger than in the US due to export dependence and floating rate regime
- Channel 4 (credit) is especially powerful for KOSDAQ, where small firms depend heavily on bank borrowing
- Channel 5 (expectations) is gaining importance as BOK adopts dot-plot-like communication

**Empirical transmission estimates (BOK 2023):**
- BOK -25bp -> 3-month equipment investment: +1.2%
- KRW/USD +1% -> Samsung Electronics: +0.3%, Hyundai Motor: +0.4% (simultaneous)
- BOK rate decision statement tone change alone -> KOSPI +/-0.5%
- Bank lending attitude easing -> KOSDAQ 3-month excess return: +2.1%

---

## 2.5.6 Business Cycle Theory and Sector Rotation

### Business Cycle Phases (NBER / Statistics Korea)

```
GDP_gap(t) = (GDP_actual - GDP_potential) / GDP_potential

Phase identification:
  Expansion:   GDP_gap > 0 AND d(GDP_gap)/dt > 0
  Peak:        GDP_gap > 0 AND d(GDP_gap)/dt <= 0
  Contraction: GDP_gap < 0 AND d(GDP_gap)/dt < 0
  Trough:      GDP_gap < 0 AND d(GDP_gap)/dt >= 0
```

**Korean Composite Indexes (Statistics Korea):**
- Leading (CLI): 10 components including inventory cycle, construction orders, export L/Cs, KOSPI, term spread
- Coincident (CCI): 7 components including industrial production, service output, retail sales, employment
- Lagging (LCI): late confirmatory indicators
- CLI leads CCI by 6-9 months (BOK research)

### Stovall Sector Rotation Model (Stovall 1996)

**Implementation in appState.js (line 414-432) -- _STOVALL_CYCLE table:**

```javascript
var _STOVALL_CYCLE = {
  //                         trough  expansion  peak  contraction
  'tech':         { trough: 1.12, expansion: 1.08, peak: 0.93, contraction: 0.90 },
  'semiconductor':{ trough: 1.14, expansion: 1.10, peak: 0.90, contraction: 0.88 },
  'financial':    { trough: 1.12, expansion: 1.04, peak: 0.94, contraction: 0.92 },
  'cons_disc':    { trough: 1.10, expansion: 1.06, peak: 0.95, contraction: 0.92 },
  'industrial':   { trough: 1.06, expansion: 1.08, peak: 0.97, contraction: 0.93 },
  'material':     { trough: 0.96, expansion: 1.04, peak: 1.08, contraction: 0.94 },
  'energy':       { trough: 0.94, expansion: 1.02, peak: 1.10, contraction: 0.96 },
  'healthcare':   { trough: 1.02, expansion: 1.00, peak: 1.02, contraction: 1.06 },
  'cons_staple':  { trough: 0.98, expansion: 0.98, peak: 1.02, contraction: 1.08 },
  'utility':      { trough: 0.96, expansion: 0.96, peak: 1.04, contraction: 1.10 },
  'telecom':      { trough: 1.02, expansion: 1.00, peak: 1.00, contraction: 1.04 },
  'realestate':   { trough: 1.08, expansion: 1.04, peak: 0.94, contraction: 0.94 },
};
```

> **UNVALIDATED FOR KOREA (Doc29 section 1.2):** This model is based on US S&P 500 sector behavior (Stovall 1996). Korean specifics -- semiconductor/auto export concentration (~25% of KOSPI market cap), chaebol structure causing atypical inter-sector capital flows, and high retail investor proportion in KOSDAQ -- mean the model serves as an analytical framework, not a validated prediction tool. KRX empirical validation is needed before high-confidence reliance.

**Sector mapping: KSIC to Stovall (appState.js lines 435-464):**

A keyword-based mapper (_KSIC_MACRO_SECTOR_MAP) converts Korean Standard Industry Classification names to the 12 Stovall sectors. The mapping prioritizes semiconductor detection first, then cascades through tech, financial, healthcare, energy, utility, consumer discretionary, consumer staples, materials, industrials, real estate, and telecom keywords.

### Rate Beta Sector Table (appState.js lines 472-485)

Implements Damodaran (2012) interest-rate sensitivity by sector:

| Sector | Rate Beta | Interpretation |
|--------|-----------|----------------|
| financial | +0.05 | NIM expansion -> benefits from rate hikes |
| energy | +0.03 | Inflation hedge |
| material | +0.02 | Inflation co-movement |
| industrial | +0.01 | Cycle-sensitive, rate secondary |
| cons_staple | 0.00 | Inelastic demand -> rate neutral |
| telecom | -0.01 | Defensive, mild sensitivity |
| healthcare | -0.02 | Near neutral |
| cons_disc | -0.03 | Household borrowing cost sensitivity |
| semiconductor | -0.04 | Capital-intensive cyclical growth |
| tech | -0.05 | DCF discount rate -> valuation compression |
| realestate | -0.07 | Leverage-dependent |
| utility | -0.08 | High dividend yield -> bond-substitute demand falls |

**Implementation: Factor 10 (appWorker.js lines 1285-1301):**
```javascript
// Rate Beta x rate direction interaction
// hawkish (gap>0) + positive beta = buy boost
// dovish (gap<0) + positive beta = buy discount
// Level amplification: KTB 10Y > 4.0% -> sensitivity * 1.5x
var rateDir = Math.max(-1, Math.min(1, taylorGap / 2));
var levelAmp = (ktb10y > 4.0) ? 1.5 : 1.0;
var rateAdj = rateDir * rBeta * levelAmp;
adj *= isBuy ? (1.0 + rateAdj) : (1.0 - rateAdj);
```

### Yield Curve as Recession Predictor (Estrella & Mishkin 1998)

```
Yield_Spread = KTB_10Y - KTB_3Y (or KTB_2Y)

Inversion (spread < 0) -> recession leading signal
  US: 8/8 recessions predicted (1960-2020)
  Korea: 4/5 recessions preceded by inversion
  Lead time: 12-18 months (US), 6-12 months (Korea, shorter cycles)
```

**Korean yield curve inversion history:**

| Inversion period | Spread (bp) | Subsequent economy | KOSPI reaction |
|-----------------|-------------|-------------------|----------------|
| 2006.11 | -15 | 2008 financial crisis | -54% (12 months) |
| 2019.08 | -5 | 2020 COVID | -35% (6 months, then bounce) |
| 2022.10 | -25 | 2023 slowdown | -8% (3 months) |

**Implementation: Factor 2 (appWorker.js lines 1118-1150):**

Four yield-curve regimes based on slope + Taylor gap direction:
- Bull Steepening (dovish + slope > 0.20): buy x1.06, sell x0.95 (early easing, most risk-on)
- Bull Flattening (dovish + slope <= 0.20): buy x0.97, sell x1.03 (growth slowdown concern)
- Bear Steepening (hawkish + slope > 0.20): buy x0.95, sell x1.04 (inflation/supply worry)
- Bear Flattening (hawkish + slope <= 0.20): buy x0.90, sell x1.10 (tightening, recession precursor)
- Inverted (slope < 0): buy x0.88, sell x1.12 (strongest bearish bias, 12-18 month recession signal)

---

## 2.5.7 Macro Composite Score v2 (MCS v2)

### Design and Formula

MCS v2 is a weighted composite of 8 macroeconomic indicators, computed by `scripts/compute_macro_composite.py` and stored in `data/macro/macro_composite.json`.

**Weight structure (compute_macro_composite.py lines 52-61):**

| Component | Weight | Data source | Normalization range | Academic justification |
|-----------|--------|-------------|--------------------|-----------------------|
| CLI (Leading Composite Index) | 0.20 | KOSIS kosis_latest.json | [80, 130] -> [0, 1] | OECD CLI methodology; most comprehensive leading indicator |
| ESI (Economic Sentiment Index) | 0.15 | KOSIS kosis_latest.json | [60, 120] -> [0, 1] | Consumer + business sentiment integrated |
| IPI (Industrial Production Index) | 0.15 | KOSIS or ECOS | [70, 130] -> [0, 1] | Real economy proxy |
| Consumer Confidence (CSI/BSI proxy) | 0.10 | KOSIS ESI or macro BSI | [60, 130] -> [0, 1] | Doc29 section 2.2 sentiment |
| PMI (BSI manufacturing proxy) | 0.10 | macro_latest BSI_mfg | [50, 120] -> [0, 1] | Hamilton (2011): most timely GDP direction indicator |
| Exports YoY | 0.10 | macro_latest export_yoy | [-30%, +40%] -> [0, 1] | Korea structural: exports ~50% GDP |
| Unemployment (inverse) | 0.10 | macro_latest | [2.0%, 6.0%] inverted | Employment health |
| Yield Spread | 0.10 | bonds or macro term_spread | [-1.0, +3.0] %pt -> [0, 1] | Estrella & Mishkin (1998) recession predictor |
| **Total** | **1.00** | | | |

**Computation:**
```python
# For each available indicator:
normalized = (value - range_low) / (range_high - range_low)  # clipped [0, 1]

# Missing indicators: excluded, weights redistributed proportionally
weighted_sum = sum(normalized_i * weight_i / available_weight_total)

# Scale to 0-100
mcsV2 = weighted_sum * 100
```

### MCS v2 vs Doc29/Doc30 specification comparison

Doc29 section 6.2 specifies a 5-component MCS v1:
```
MCS_v1 = 0.25*PMI_norm + 0.20*CSI_norm + 0.25*export_growth_norm
       + 0.15*yield_curve_norm + 0.15*EPU_inv_norm
```

Doc30 section 4.3 extends this to MCS v2 by adding a Taylor gap component (w6 = 0.10).

The **actual implementation** in compute_macro_composite.py uses an 8-component structure that differs from both Doc29 and Doc30 specifications:
- CLI (0.20) and ESI (0.15) are added as separate components (not in Doc29/30 spec)
- IPI (0.15) is added (not in Doc29/30 spec)
- Unemployment inverse (0.10) is added (not in Doc29/30 spec)
- EPU is **not implemented** (VIX used as proxy in Doc29 but not in compute_macro_composite.py)
- Taylor gap is computed separately (compute_taylor_gap function), not folded into the MCS weight sum

### MCS v2 Pattern Confidence Application

**Phase 8 layer (appWorker.js lines 554-568):**
```javascript
// MCS thresholds (appState.js line 403):
var MCS_THRESHOLDS = { strong_bull: 70, bull: 55, bear: 45, strong_bear: 30 };

// Application:
if (mcs >= 70 && pattern.signal === 'buy')   pattern.confidence *= 1.05;
if (mcs <= 30 && pattern.signal === 'sell')   pattern.confidence *= 1.05;
```

**Legacy Factor 6 (appWorker.js lines 1212-1226):**
Uses the raw `macro.mcs` field (v1) when `_macroComposite.mcsV2` is not available:
```javascript
// Double-application prevention: if Phase 8 already used mcsV2, Factor 6 is skipped
if (mcs != null && !(_macroComposite && _macroComposite.mcsV2 != null)) {
  if (mcs > 0.6)  adj *= isBuy ? mcsAdj : (2.0 - mcsAdj);   // linear scaling
  if (mcs < 0.4)  adj *= isBuy ? (2.0 - mcsAdj) : mcsAdj;
}
```

### Regime Classification: Risk-On / Risk-Off / Neutral (RORO)

**Design (appWorker.js lines 1330-1477):**

The RORO classifier is a separate 5-factor weighted score with hysteresis-based regime transitions.

| Factor | Weight | Input | Thresholds |
|--------|--------|-------|------------|
| 1. VKOSPI/VIX level | 0.30 | vkospi.json or VIX * 1.12 proxy | >30: crisis (-1.0), >22: elevated (-0.5), <15: calm (+0.5) |
| 2a. AA- credit spread | 0.10 | bonds_latest credit_spreads | >1.5%: stress (-1.0), >1.0%: elevated (-0.5), <0.5%: tight (+0.3) |
| 2b. US HY spread | 0.10 | macro_latest us_hy_spread | >5.0%: stress (-1.0), >4.0%: elevated (-0.5), <3.0%: tight (+0.3) |
| 3. USD/KRW level | 0.20 | macro_latest usdkrw | >1450: crisis (-1.0), >1350: weak (-0.5), <1200: strong (+0.5), <1100: very strong (+1.0) |
| 4. MCS v2 | 0.15 | macro_latest mcs | Mapped: (mcs - 0.5) * 2 -> [-1, +1] |
| 5. Investor alignment | 0.15 | investor_summary alignment | aligned_buy: +0.8, aligned_sell: -0.8, else: 0 |

**Hysteresis transition thresholds:**

```
Entry:  risk-on if score >= 0.25, risk-off if score <= -0.25
Exit:   back to neutral if score crosses 0.10 (from risk-on) or -0.10 (from risk-off)
```

**Pattern adjustment:**
```
risk-on:   buy conf * 1.06, sell conf * 0.94
risk-off:  buy conf * 0.92, sell conf * 1.08
neutral:   no adjustment
clamp: [0.92, 1.08] to prevent double-counting with Factor 3 (credit) and Factor 8 (VIX)
```

**Academic basis:** Baele, Bekaert & Inghelbrecht (2010), "The Determinants of Stock and Bond Return Comovements," RFS 23(6).

---

## 2.5.8 Cross-Market Correlations

### KRX and Major Market Correlations (Doc28 section 1.1)

| Market pair | Correlation (r) | Notes |
|-------------|----------------|-------|
| KOSPI - S&P 500 | 0.65-0.75 | Gradually strengthening (+0.10 vs 2010s) |
| KOSPI - NASDAQ | 0.60-0.70 | Semiconductor/IT sector synchronization |
| KOSPI - Nikkei 225 | 0.70-0.80 | Highest: shared semiconductor/auto supply chains |
| KOSPI - Shanghai Composite | 0.40-0.55 | Declining trend (decoupling since 2020) |
| KOSPI - VIX | -0.65 | Strong negative correlation |
| KOSDAQ - NASDAQ | 0.55-0.65 | Bio/software sector overlap |

**Asymmetric correlation (Longin & Solnik 2001):**
Bear-market correlation is 0.15-0.25 higher than bull-market correlation for KOSPI-S&P 500. This means individual technical patterns are overwhelmed by global trends during downturns -- reversal signals (contrarian) have lower reliability during global sell-offs.

### VIX -> VKOSPI Risk Transmission (Doc28 section 2)

```
Transmission elasticity: d(VKOSPI) / d(VIX) = 0.85
  -> VIX +10pts -> VKOSPI +8.5pts (1-day basis)
```

**VIX-VKOSPI proxy constant:**

| Constant | Value | Grade | Source | Implementation |
|----------|-------|-------|--------|----------------|
| VIX_VKOSPI_PROXY | 1.12 | C | Whaley (2009) KRX proxy | appState.js line 43; used as fallback when direct VKOSPI data unavailable |

**VIX level impact on gap-down probability:**

| Condition | Gap-down probability | Magnitude |
|-----------|---------------------|-----------|
| VIX > 30 (next KST open) | 82% | >= -0.5% |
| VIX > 40 | 94% | >= -1.0% |
| S&P 500 prior day >= -2% | 76% | Gap down |

**Four transmission channels (Doc28 section 2.2):**
1. Direct fear contagion: VIX up -> global risk aversion -> VKOSPI up (immediate)
2. Foreign portfolio rebalancing: VIX up -> EM weight reduction -> KRX net selling (same day to next day)
3. Algorithmic cross-market arbitrage: S&P 500 futures down -> KOSPI 200 futures down -> spot pressure (continuous)
4. USD/KRW pressure: Risk-off -> USD strength -> KRW weakness -> foreign realized loss -> additional selling (hours)

Domino order: Channel 1 (immediate) -> Channel 4 (hours) -> Channel 2 (same/next day) -> Channel 3 (continuous)

**Implementation: Factor 8 VRP (appWorker.js lines 1256-1269):**
```javascript
if (vix > 30)     adj *= 0.93;                  // high VIX: -7% all patterns
if (vix > 25)     adj *= isBuy ? 0.97 : 1.02;  // elevated: buy -3%, sell +2%
if (vix < 15)     adj *= isBuy ? 1.03 : 0.98;  // low vol: buy +3%, sell -2%
```

### Crisis Severity Index (Doc28 section 5.1)

```
crisis_severity = 0.4 * (VIX - 20) / 20
               + 0.3 * (VKOSPI - 22) / 18
               + 0.2 * (USD_KRW - 1300) / 100
               + 0.1 * foreign_sell_score

crisis_severity in [0, 1]  (max clamp)

Level 0 (Normal):   VIX < 20, VKOSPI < 22, USD/KRW < 1,300
Level 1 (Caution):  VIX >= 20 OR VKOSPI >= 22 OR USD/KRW >= 1,300
Level 2 (Warning):  VIX >= 30 AND VKOSPI >= 30
Level 3 (Crisis):   VIX >= 35 AND VKOSPI >= 35 AND USD/KRW >= 1,350 AND foreign net selling >= 1 tril KRW/day
```

Pattern confidence crisis adjustment:
```
conf_adj = conf_raw * (1 - crisis_severity * 0.4)

crisis_severity = 0.0: no adjustment
crisis_severity = 0.5: -20% confidence
crisis_severity = 1.0: -40% confidence (cap)

Applied to: reversal patterns only (continuation/breakout patterns maintain or increase reliability)
```

> **Implementation status:** The crisis_severity formula is defined in Doc28 but is not directly implemented as a single function in appWorker.js. Instead, its components are distributed across Factor 8 (VIX), Factor 9 (rate differential), Factor 4 (foreign signal), and the RORO classifier.

---

## 2.5.9 Fiscal Policy and Korea-Specific Transmission

### Government Spending Multiplier

```
Simple closed-economy multiplier:
  k_G = 1 / (1 - c_1*(1-t))
      = 1 / (1 - 0.55*0.75) = 1 / 0.5875 = 1.70

Open-economy multiplier (import leakage):
  k_G_open = 1 / (1 - c_1*(1-t) + m)
           = 1 / (0.5875 + 0.45) = 1 / 1.0375 = 0.96

  NOTE: k_G_open < 1 -> government spending of 1 KRW increases GDP by LESS than 1 KRW
  Reason: marginal propensity to import m = 0.45 is extremely high, nearly neutralizing multiplier

IS-LM multiplier (with crowding-out):
  k_G_ISLM = h / D = 2000 / (2000*1.0375 + 1200*0.20) = 2000 / 2315 = 0.86
```

| Country | Estimated k_G | Key driver | Source |
|---------|---------------|-----------|--------|
| Korea | 0.86-1.04 | High import leakage (m=0.45) | Kim & Park (2016) |
| US | 1.50-2.00 | Low import share (m=0.15) | Blanchard & Perotti (2002) |
| Japan | 1.10-1.50 | Intermediate import share | Bruckner & Tuladhar (2014) |
| Korea ZLB | ~1.95 | LM horizontal -> no crowding-out | Christiano et al. (2011) |

> **Methodological caveat (Doc30 section 5.1):** These static Keynesian multipliers assume fixed interest rates and no crowding-out. Dynamic DSGE multipliers range from 0.5 to 2.0 depending on monetary accommodation (Christiano, Eichenbaum & Rebelo 2011). At ZLB, the multiplier can reach 1.95-2.30. Under active monetary tightening, it can fall below 0.5. The static values are upper bounds.

### Tax Multiplier

```
k_T = -c_1 / (1 - c_1*(1-t) + m) = -0.55 / 1.0375 = -0.53

Meaning: 1 tril KRW tax cut -> GDP +0.53 tril KRW (smaller than spending multiplier)
Reason: tax cut -> disposable income up -> only c_1 fraction consumed, rest saved

Balanced budget multiplier: k_BB = k_G + k_T = 0.96 + (-0.53) = 0.43
```

### Supplementary Budget Event-Pattern Mapping

| Type | Example | Market reaction | Pattern implication |
|------|---------|----------------|---------------------|
| Disaster relief | 2020 COVID emergency (14.3 tril) | Consumer staples +1-2%, low persistence | Short-lived, weak |
| SOC/Infrastructure | 2023 SOC (3.5 tril) | Construction +2-5% (1 week), then reversal | "Buy rumor sell news" |
| Corporate incentive | 2023 Semiconductor Support Act (25% tax credit) | Target sector +3-8% (pre-priced) | Announcement day signal weak due to front-running |

---

## 2.5.10 Complete 11-Factor Macro Confidence Adjustment

The `_applyMacroConfidenceToPatterns()` function (appWorker.js lines 1071-1328) applies 11 independent multiplicative factors, clamped to [0.70, 1.25].

| Factor | Academic basis | Input data | Buy pattern adj | Sell pattern adj |
|--------|---------------|-----------|-----------------|------------------|
| 1. Cycle phase + Stovall | IS-LM equilibrium direction; Stovall (1996) | macro.cycle_phase + _STOVALL_CYCLE table | +6% to +14% (trough, sector-dep) | +8% to +12% (contraction, sector-dep) |
| 2. Yield curve 4-regime | Estrella & Mishkin (1998) | bonds.slope_10y3y + taylorGap | -12% (inverted) to +6% (bull steep) | +12% (inverted) to -5% (bull steep) |
| 3. Credit regime | Bernanke & Gertler (1989) | bonds.credit_spreads.aa_spread | -15% (stress) to 0% (normal) | Same -15% (stress) |
| 4. Foreign signal | UIP / Mundell-Fleming | macro.foreigner_signal | +5% (inflow) / -5% (outflow) | -4% (inflow) / +5% (outflow) |
| 5. Pattern-specific override | Empirical WR + macro alignment | Pattern type + phase + slope | +6-12% for high-WR patterns in aligned regime | Same |
| 6. MCS v1 fallback | Doc29 section 6.2 | macro.mcs (0-1 scale) | +10% max when MCS > 0.6 | +10% max when MCS < 0.4 |
| 7. Taylor Rule gap | Taylor (1993) | macro.taylor_gap | +5% max (dovish) | +5% max (hawkish) |
| 8. VRP (VIX level) | Carr & Wu (2009) | macro.vix | -7% (VIX>30) to +3% (VIX<15) | +2% (VIX>25) to -2% (VIX<15) |
| 9. Rate differential | Mundell-Fleming | bok_rate - fed_rate | -5% (large inversion) to +3% (Korea premium) | +4% (large inversion) to -2% (Korea premium) |
| 10. Rate Beta x direction | Damodaran (2012) equity duration | taylorGap * _RATE_BETA[sector] | Sector-dependent, level-amplified (KTB>4%: 1.5x) | Symmetric inverse |
| 11. KOSIS CLI-CCI gap | OECD CLI methodology | kosis_latest.cli_cci_gap | +4% (CLI > CCI by 5+) | +4% (CLI < CCI by 5+) |

**Final clamp: adj = max(0.70, min(1.25, adj))**

Then applied:
```javascript
p.confidence = max(10, min(100, round(p.confidence * adj)));
p.confidencePred = max(10, min(95, round(p.confidencePred * adj)));
```

---

## 2.5.11 Market Context Adjustment (_applyMarketContextToPatterns)

A separate pre-macro function (appWorker.js lines 1016-1051) applies market-level context:

| Factor | Condition | Adjustment | Academic basis |
|--------|-----------|------------|----------------|
| CCSI (Composite Consumer Sentiment) | CCSI < 85 | Buy conf * 0.88 | Lemmon & Portniaguina (2006) |
| CCSI | CCSI > 108 | Buy conf * 1.06 | Same |
| Foreign net buying | > 1000 eok (100 bil KRW) | Buy conf * 1.08 | Richards (2005): threshold ~$75M |
| Earning season | earning_season = 1 | All conf * 0.93 | Earnings uncertainty discount |

Clamp: [0.55, 1.35] (wider than macro adjustment due to fewer factors).

---

## 2.5.12 Keynesian-Classical Synthesis and Pattern Regime

Doc30 section 3 develops the Keynesian-Classical spectrum as a pattern-regime framework:

**Short-run (1-20 trading days): Keynesian**
- Prices sticky -> demand determines output
- Monetary policy effective -> BOK announcements move prices
- Momentum patterns valid (gradual information incorporation)
- Examples: threeWhiteSoldiers, ascendingTriangle trend-following

**Long-run (60-250 trading days): Classical**
- Price adjustment complete -> Y returns to Y_n
- Money neutral -> liquidity effects dissipate
- Mean-reversion patterns valid (overreaction correction)
- Examples: doubleTop/Bottom long-term reversal, H&S structural change

**Regime-dependent pattern reliability model:**

```
Near-Keynesian regime (uncertainty high, VIX > 25):
  Momentum/trend conf_adj = +0.08
  Mean-reversion conf_adj = -0.06

Near-Classical regime (uncertainty low, VIX < 15):
  Mean-reversion conf_adj = +0.05
  Momentum conf_adj = -0.04 (alpha decay accelerates)
```

| Constant | Value | Grade | Range | Source |
|----------|-------|-------|-------|--------|
| vkospi_keynesian (threshold) | 25 | C | [20, 35] | Empirical estimate |
| vkospi_classical (threshold) | 15 | C | [10, 20] | Empirical estimate |
| mom_keynesian (conf_adj) | +0.08 | D | [0.03, 0.15] | Insufficient academic evidence |
| mr_classical (conf_adj) | +0.05 | D | [0.02, 0.10] | Insufficient academic evidence |
| mom_life_short (bars) | 20 | C | [10, 30] | Jegadeesh & Titman (1993) |
| mr_life_long (bars) | 120 | C | [60, 250] | DeBondt & Thaler (1985) |

> **Implementation status:** The Keynesian-Classical regime detection is conceptually aligned with the RORO framework (Factor 1 uses VKOSPI thresholds) and the WLS decay lambda in backtester.js (which already implements AMH-style alpha decay per Lo 2004). A dedicated regime_score function is not yet implemented; the existing VKOSPI-based classification in RORO provides an approximate proxy.

---

## Macro Findings

### F-1: Taylor Rule r* discrepancy between Doc30 and compute_macro_composite.py

**Issue:** Doc30 section 4.1 specifies r* = 1.0% (Korean natural rate, 2020s, per Laubach-Williams method and BOK 2023 estimate). However, `compute_macro_composite.py` line 65 uses `TAYLOR_R_STAR = 0.5`.

**Impact:** A 50bp lower r* produces a Taylor-implied rate that is 50bp lower than the doc-specified value, which systematically biases the Taylor gap upward (more hawkish). This means the system perceives monetary policy as tighter than it actually is relative to the theoretical neutral rate.

**Assessment:** The 0.5% value may reflect the script author's judgment that the post-COVID Korean neutral rate has fallen further than the BOK's 2023 estimate suggests. Both values are within the stated uncertainty band of +/-1pp. However, the discrepancy should be documented. The C-grade classification (range [0.5%, 2.0%]) acknowledges this uncertainty.

**Recommendation:** Add a comment in compute_macro_composite.py noting the divergence from Doc30 and the rationale for 0.5% vs 1.0%. Consider making this a configurable parameter.

### F-2: MCS v2 weight structure diverges from Doc29/Doc30 specification

**Issue:** Three different MCS weight specifications exist:
1. **Doc29 section 6.2 (5 components):** PMI 0.25, CSI 0.20, exports 0.25, yield_curve 0.15, EPU_inv 0.15
2. **Doc30 section 4.3 (6 components):** Same as Doc29 + Taylor gap w6=0.10, other weights proportionally reduced
3. **compute_macro_composite.py (8 components):** CLI 0.20, ESI 0.15, IPI 0.15, consumer_confidence 0.10, PMI 0.10, exports 0.10, unemployment_inv 0.10, yield_spread 0.10

**Impact:** The actual implementation is substantially different from the documented design. The code version is more comprehensive (8 vs 5/6 indicators) but has different emphasis: PMI weight dropped from 0.25 to 0.10, exports from 0.25 to 0.10, while CLI (0.20) and ESI (0.15) are new additions. Taylor gap is computed separately rather than integrated into the MCS weight sum.

**Assessment:** The 8-component implementation is arguably superior (broader coverage, uses directly available KOSIS data). But the doc-implementation divergence creates confusion about which is authoritative. The weight redistribution when indicators are missing (proportional scaling) is correctly implemented.

**Recommendation:** Update Doc29 section 6.2 and Doc30 section 4.3 to reflect the actual 8-component implementation. Mark the 5-component version as "deprecated design" and the 8-component as "current implementation."

### F-3: TAYLOR_OUTPUT_GAP hardcoded to 0.0 in compute_macro_composite.py

**Issue:** Line 67 sets `TAYLOR_OUTPUT_GAP = 0.0` with comment "real-time estimation impossible, assumed 0." Doc30 section 4.1 specifies a CLI-based proxy: `output_gap = (CLI - 100) * 0.5`.

**Impact:** By assuming output_gap = 0, the Taylor rule calculation ignores the output gap term entirely. When CLI > 100 (expansion), the Taylor-implied rate should be higher; when CLI < 100, lower. This omission can cause the Taylor gap to be systematically misestimated.

**Assessment:** The CLI is already loaded in the compute function (line 118-127) but not used for the output gap calculation. This appears to be an oversight or intentional simplification that was not updated when the CLI data pipeline was completed.

**Recommendation:** Replace `TAYLOR_OUTPUT_GAP = 0.0` with a CLI-based calculation when CLI data is available, as specified in Doc30 section 4.1.

### F-4: Crisis severity formula (Doc28 section 5.1) is distributed, not unified

**Issue:** Doc28 defines a single `crisis_severity` composite index with explicit weights (VIX 0.4, VKOSPI 0.3, USD/KRW 0.2, foreign selling 0.1). This is not implemented as a single function. Instead, its components are spread across Factor 8 (VIX), Factor 9 (rate diff), Factor 4 (foreign signal), and the RORO classifier.

**Impact:** The distributed implementation means the effective crisis weighting may differ from Doc28's specification. The RORO classifier uses different weights (VKOSPI 0.30, credit 0.20, USD/KRW 0.20, MCS 0.15, investor alignment 0.15) and different thresholds.

**Assessment:** The distributed approach may actually be better (each factor is tuned independently with appropriate dead bands), but it makes it difficult to verify that the aggregate crisis response matches the documented specification.

**Recommendation:** No code change needed, but document the mapping from Doc28 crisis_severity to the distributed RORO + macro factor implementation.

### F-5: Stovall sector rotation model lacks KRX empirical validation

**Issue:** Doc29 section 1.2 explicitly warns: "UNVALIDATED FOR KOREA." The _STOVALL_CYCLE table (appState.js) assigns specific multipliers (e.g., semiconductor trough: 1.14, utility contraction: 1.10) without KRX backtesting.

**Impact:** These multipliers directly affect pattern confidence for all stocks mapped to a Stovall sector. If the US-derived rotation model does not hold for Korea -- plausible given semiconductor/chaebol concentration and high retail investor share -- the adjustments may add noise rather than signal.

**Assessment:** The multiplier magnitudes are conservative (max +14%, min -12%), limiting potential damage. The system falls back to uniform cycle-phase adjustment when sector mapping fails. However, the B-3 Rate Beta table and the Stovall cycle table together can stack adjustments of up to ~20% without Korean-specific validation.

**Recommendation:** Conduct backtesting of sector-phase returns using KRX data before increasing multiplier magnitudes. Consider adding a dampening factor (e.g., 0.5x) to Stovall multipliers until validation is complete.

### F-6: Double-application safeguard for MCS is fragile

**Issue:** Factor 6 (legacy MCS v1) checks `!(_macroComposite && _macroComposite.mcsV2 != null)` to skip if Phase 8 already applied mcsV2. This relies on the temporal ordering of function calls and the presence of the mcsV2 field.

**Impact:** If compute_macro_composite.py fails or produces a file without the mcsV2 key, Factor 6 activates with the raw `macro.mcs` value, which may be on a different scale (0-1 vs 0-100). This could cause significant over- or under-adjustment.

**Assessment:** The pipeline contract (quality-gates.md CHECK 6) requires the `mcsV2` key, which should prevent this scenario. But the defense-in-depth is thin.

**Recommendation:** Add explicit scale detection: if mcs > 1.0, it is on the 0-100 scale; divide by 100 before applying Factor 6 thresholds (which assume 0-1 scale).

---

## Learnable Constants Summary (Macro Domain)

Constants registered in Doc30 section 6.3 (#83-#98) plus additional implementation-derived constants:

| # | Name | Default | Grade | Learn method | Range | Location |
|---|------|---------|-------|-------------|-------|----------|
| 83 | MCS_v2 Taylor gap weight (w6) | 0.10 | C | GCV | [0.05, 0.20] | Doc30 section 4.3 (not in code -- see F-2) |
| 84 | BOK event conf_adj | 1.08 | C | Grid search | [1.03, 1.15] | Doc30 section 1.4 |
| 85 | Fiscal event conf_adj | 1.03 | D | Grid search | [1.00, 1.08] | Doc30 section 1.4 |
| 86 | VKOSPI Keynesian threshold | 25 | C | Grid search | [20, 35] | Doc30 section 3.3 |
| 87 | VKOSPI Classical threshold | 15 | C | Grid search | [10, 20] | Doc30 section 3.3 |
| 88 | Momentum regime conf_adj | +0.08 | D | WLS | [0.03, 0.15] | Doc30 section 3.3 |
| 89 | Mean-reversion regime conf_adj | +0.05 | D | WLS | [0.02, 0.10] | Doc30 section 3.3 |
| 90 | Goldilocks CPI ceiling | 2.5% | C | Grid search | [2.0%, 3.0%] | Doc30 section 6.2 |
| 91 | Stagflation CPI floor | 3.0% | C | Grid search | [2.5%, 4.0%] | Doc30 section 6.2 |
| 92 | Demand expansion trend adj | +0.08 | D | WLS | [0.03, 0.15] | Doc30 section 6.2 |
| 93 | Stagflation all-pattern adj | -0.12 | D | WLS | [-0.20, -0.05] | Doc30 section 6.2 |
| 94 | ZLB threshold rate | 0.75% | C | Manual | [0.25%, 1.00%] | Doc30 section 5.3 |
| 95 | ZLB fiscal multiplier boost | 1.50 | D | Grid search | [1.20, 2.00] | Doc30 section 5.3 |
| 96 | Taylor a_pi | 0.50 | B | Grid search | [0.30, 0.80] | Taylor (1993) |
| 97 | Taylor a_y | 0.50 | B | Grid search | [0.25, 0.75] | Taylor (1993) |
| 98 | Taylor a_e | 0.10 | C | Grid search | [0.05, 0.20] | Kim & Park (2016) |
| -- | VIX_VKOSPI_PROXY | 1.12 | C | Manual | [1.05, 1.25] | Whaley (2009); appState.js line 43 |
| -- | TAYLOR_R_STAR (code) | 0.5% | C | Manual | [0.5%, 2.0%] | compute_macro_composite.py line 65 |
| -- | TAYLOR_PI_STAR | 2.0% | A | Fixed | fixed | BOK official target |
| -- | MCS strong_bull threshold | 70 | D | Grid search | [60, 80] | appState.js line 403 |
| -- | MCS strong_bear threshold | 30 | D | Grid search | [20, 40] | appState.js line 403 |
| -- | RORO entry_on threshold | 0.25 | D | Manual | [0.15, 0.35] | appWorker.js line 1430 |
| -- | RORO entry_off threshold | -0.25 | D | Manual | [-0.35, -0.15] | appWorker.js line 1430 |
| -- | Macro adj clamp upper | 1.25 | C | Manual | [1.15, 1.40] | appWorker.js line 1319 |
| -- | Macro adj clamp lower | 0.70 | C | Manual | [0.60, 0.85] | appWorker.js line 1319 |

**Grade distribution:** A: 1, B: 2, C: 14, D: 9 -- heavily tilted toward C/D, reflecting the empirical uncertainty inherent in macro-to-pattern transmission.

---

## References

1. Hicks, J.R. (1937). Mr. Keynes and the "Classics": A Suggested Interpretation. *Econometrica*, 5(2), 147-159.
2. Mundell, R.A. (1963). Capital Mobility and Stabilization Policy Under Fixed and Flexible Exchange Rates. *Canadian Journal of Economics*, 29(4), 475-485.
3. Fleming, J.M. (1962). Domestic Financial Policies Under Fixed and Under Floating Exchange Rates. *IMF Staff Papers*, 9(3), 369-380.
4. Taylor, J.B. (1993). Discretion versus Policy Rules in Practice. *Carnegie-Rochester Conference Series on Public Policy*, 39, 195-214.
5. Stovall, R. (1996). *Standard & Poor's Guide to Sector Investing*. McGraw-Hill.
6. Estrella, A. & Mishkin, F.S. (1998). Predicting U.S. Recessions: Financial Variables as Leading Indicators. *Review of Economics and Statistics*, 80(1), 45-61.
7. Mishkin, F.S. (1995). Symposium on the Monetary Transmission Mechanism. *Journal of Economic Perspectives*, 9(4), 3-10.
8. Kim, B.-H. & Park, H. (2016). Monetary Policy Transmission in Korea. *BOK Working Paper*.
9. Shin, K. & Wang, Y. (2003). Trade Integration and Business Cycle Synchronization in East Asia. *Asian Economic Papers*, 2(3), 1-20.
10. Ball, L. (1999). Policy Rules for Open Economies. In Taylor, J.B. (ed.), *Monetary Policy Rules*. University of Chicago Press.
11. Damodaran, A. (2012). *Investment Valuation*. 3rd ed. Wiley.
12. Laubach, T. & Williams, J.C. (2003). Measuring the Natural Rate of Interest. *Review of Economics and Statistics*, 85(4), 1063-1070.
13. Rudebusch, G.D. (2002). Term Structure Evidence on Interest Rate Smoothing and Monetary Policy Inertia. *Journal of Monetary Economics*, 49(6), 1161-1187.
14. Romer, D. (2000). Keynesian Macroeconomics without the LM Curve. *Journal of Economic Perspectives*, 14(2), 149-169.
15. Engle, R.F. (2002). Dynamic Conditional Correlations. *JBES*, 20(3), 339-350.
16. Longin, F. & Solnik, B. (2001). Extreme Correlation of International Equity Markets. *Journal of Finance*, 56(2), 649-676.
17. Forbes, K.J. & Rigobon, R. (2002). No Contagion, Only Interdependence. *Journal of Finance*, 57(5), 2223-2261.
18. Whaley, R.E. (2009). Understanding the VIX. *Journal of Portfolio Management*, 35(3), 98-105.
19. Carr, P. & Wu, L. (2009). Variance Risk Premiums. *Review of Financial Studies*, 22(3), 1311-1341.
20. Baele, L., Bekaert, G. & Inghelbrecht, K. (2010). The Determinants of Stock and Bond Return Comovements. *Review of Financial Studies*, 23(6), 2374-2428.
21. Calvo, G.A. (1983). Staggered Prices in a Utility-Maximizing Framework. *Journal of Monetary Economics*, 12(3), 383-398.
22. Baker, S.R., Bloom, N. & Davis, S.J. (2016). Measuring Economic Policy Uncertainty. *Quarterly Journal of Economics*, 131(4), 1593-1636.
23. Blanchard, O. & Perotti, R. (2002). An Empirical Characterization of the Dynamic Effects of Changes in Government Spending and Taxes on Output. *Quarterly Journal of Economics*, 117(4), 1329-1368.
24. Christiano, L.J., Eichenbaum, M. & Rebelo, S. (2011). When Is the Government Spending Multiplier Large? *Journal of Political Economy*, 119(1), 78-121.
25. Lemmon, M. & Portniaguina, E. (2006). Consumer Confidence and Asset Prices. *Review of Financial Studies*, 19(4), 1499-1529.
26. Richards, A. (2005). Big Fish in Small Ponds: The Trading Behavior and Price Impact of Foreign Investors in Asian Emerging Equity Markets. *Journal of Financial and Quantitative Analysis*, 40(1), 1-27.
27. Hamilton, J.D. (1989). A New Approach to the Economic Analysis of Nonstationary Time Series and the Business Cycle. *Econometrica*, 57(2), 357-384.
28. Jegadeesh, N. & Titman, S. (1993). Returns to Buying Winners and Selling Losers. *Journal of Finance*, 48(1), 65-91.
29. DeBondt, W.F.M. & Thaler, R.H. (1985). Does the Stock Market Overreact? *Journal of Finance*, 40(3), 793-805.
30. Lo, A.W. (2004). The Adaptive Markets Hypothesis. *Journal of Portfolio Management*, 30(5), 15-29.
