# Section 2.8: Bond & Credit Theory

> ANATOMY V5 -- Stage 2, Section 2.8
> Scope: Yield curve analysis, duration metrics, Merton Distance-to-Default, RORO regime classification
> Authority: Fix NSS parameterization errors, flag uncalibrated thresholds, report findings

---

## 8A. Yield Curve

### 8A.1 Nelson-Siegel-Svensson (NSS) Model

The NSS model decomposes the yield curve into economically interpretable factors.
CheeseStock uses NSS parameters from KOFIA (daily publication, 16:00 KST) or
self-fits from ECOS KTB yields via `scipy.optimize.least_squares`.

**Nelson-Siegel (1987) 3-Factor:**

```
y(tau) = beta_1 + beta_2 * [(1 - e^(-tau/lambda_1)) / (tau/lambda_1)]
                + beta_3 * [(1 - e^(-tau/lambda_1)) / (tau/lambda_1) - e^(-tau/lambda_1)]
```

**Svensson (1994) 4-Factor Extension:**

```
y(tau) = beta_1
       + beta_2 * [(1 - e^(-tau/lambda_1)) / (tau/lambda_1)]
       + beta_3 * [(1 - e^(-tau/lambda_1)) / (tau/lambda_1) - e^(-tau/lambda_1)]
       + beta_4 * [(1 - e^(-tau/lambda_2)) / (tau/lambda_2) - e^(-tau/lambda_2)]
```

**Variable Annotation:**

| Symbol | Meaning | Economic Interpretation | Grade | JS/Py Location |
|--------|---------|------------------------|-------|----------------|
| `y(tau)` | Continuously compounded yield at maturity tau | Observable output | -- | `bonds_latest.json: yields.*` |
| `beta_1` | Level factor | Long-run equilibrium rate = expected inflation + real equilibrium rate. `lim tau->inf y(tau) = beta_1`. Korea 2020-2026: 2.5-4.5% | [B] | `bonds_latest.json: nss_params.beta1` |
| `beta_2` | Slope factor | Monetary policy stance. `y(0) = beta_1 + beta_2`. beta_2 < 0 = normal curve (long > short); beta_2 > 0 = inverted | [B] | `bonds_latest.json: nss_params.beta2` |
| `beta_3` | Curvature factor | Medium-term economic uncertainty, policy ambiguity. Controls hump height. |beta_3| increase = uncertainty expansion | [B] | `bonds_latest.json: nss_params.beta3` |
| `beta_4` | 2nd curvature factor (Svensson extension) | Additional flexibility for ultra-long end (20Y-50Y). Smaller magnitude than beta_3 | [C] | `bonds_latest.json: nss_params.beta4` |
| `lambda_1` | 1st decay parameter | Controls where slope/curvature loading peaks. Typical: 1.0-2.0 | [C] | `bonds_latest.json: nss_params.lambda1` |
| `lambda_2` | 2nd decay parameter | Controls 2nd hump location. Typical: 2.5-5.0. Only meaningful when beta_4 != 0 | [C] | `bonds_latest.json: nss_params.lambda2` |

**Academic basis:**

- Nelson, C.R. & Siegel, A.F. (1987). "Parsimonious Modeling of Yield Curves." *Journal of Business*, 60(4), 473-489.
- Svensson, L. (1994). "Estimating and Interpreting Forward Interest Rates: Sweden 1992-1994." NBER Working Paper 4871.
- Diebold, F. & Li, C. (2006). "Forecasting the Term Structure of Government Bond Yields." *Journal of Econometrics*, 130(2), 337-364.

**Diebold-Li (2006) empirical validation:**

```
Level    <-> inflation expectations           (r ~ 0.97 with 10Y survey)
Slope    <-> monetary policy stance           (r ~ 0.92 with policy rate)
Curvature <-> economic uncertainty            (r ~ 0.85 with PMI dispersion)
```

**Self-fitting procedure (when KOFIA params unavailable):**

```
Objective: min sum_k [y_observed(tau_k) - y_NSS(tau_k; beta, lambda)]^2

tau_k in {1, 2, 3, 5, 10, 20, 30, 50}  (8 observation points)
Parameters: beta_1..4, lambda_1..2  (6 parameters)

Method: Levenberg-Marquardt (scipy.optimize.least_squares)
Initial: beta_1 = y(30Y), beta_2 = y(1Y) - y(30Y),
         beta_3 = 2*y(5Y) - y(1Y) - y(30Y),
         lambda_1 = 1.5, lambda_2 = 3.0
Convergence: |residual| < 1bp (0.01%p)
```

**Data source:** KOFIA Bond Information Center (`kofiabond.or.kr`) publishes daily NSS params after 16:00 KST. Fallback: ECOS API stat code `060Y001` (KTB yields by tenor).


### 8A.2 Yield Curve Shapes

CheeseStock classifies the yield curve into four shapes using the 10Y-3Y slope
and the butterfly spread (curvature).

**Classification algorithm** -- `compute_bond_metrics.py: classify_curve_shape()`:

```python
slope     = KTB_10Y - KTB_3Y
curvature = 2 * KTB_5Y - KTB_3Y - KTB_10Y   # butterfly spread

if curvature > 0.3:    classification = 'humped'
elif slope > 0.5:      classification = 'normal'
elif slope < -0.5:     classification = 'inverted'
else:                  classification = 'flat'
```

| Shape | Condition | Economic Signal | Pattern Impact |
|-------|-----------|-----------------|----------------|
| Normal | slope > 0.5%p | Growth expected, rate hikes ahead | Buy patterns reinforced |
| Flat | \|slope\| <= 0.5%p | Peak or uncertainty | Neutral |
| Inverted | slope < -0.5%p | Recession 6-12 months ahead (Estrella-Mishkin 1998) | Buy patterns suppressed |
| Humped | curvature > 0.3%p | Mid-term uncertainty spike | Moderate caution |

**JS rendering** -- `financials.js: _renderYieldCurve()` (line 418):

```javascript
// bonds_latest.json fields used:
var slope = bonds.slope_10y3y;      // pre-computed by download_bonds.py
var inverted = bonds.curve_inverted; // boolean flag

// Regime badge: 역전/평탄/정상
if (inverted || slope < 0)  -> '역전' (inverted class)
else if (slope < 0.15)      -> '평탄' (flat class)
else                        -> '정상' (normal class)
```

**FINDING-8A-1**: The `_renderYieldCurve()` function uses `slope < 0.15` for "flat" display,
but `classify_curve_shape()` in Python uses `|slope| <= 0.5`. The JS display threshold is
more conservative (flags "flat" earlier), which is acceptable for a visual warning but
creates inconsistency between the badge label and the `bond_metrics.json` classification.
Not a bug -- the JS display serves UX (early alert) while the Python classification
serves analytical precision.


### 8A.3 Term Spread: 10Y-3Y (Recession Predictor)

**Theoretical basis:**

Harvey, C. (1988). "The Real Term Structure and Consumption Growth." *Journal of Financial Economics*, 22(2), 305-333.
Estrella, A. & Mishkin, F. (1998). "Predicting U.S. Recessions: Financial Variables as Leading Indicators." *Review of Economics and Statistics*, 80(1), 45-61.

```
Spread_10Y3Y = y(10Y) - y(3Y)

Spread > 0   -> Normal: market expects future growth and rate increases
Spread ~ 0   -> Flat: cycle peak or elevated uncertainty
Spread < 0   -> Inverted: recession leading signal (6-12 months ahead)
```

**Korean empirical evidence (2000-2025):**

| Episode | Period | Duration | KOSPI During | Aftermath | Lead Time |
|---------|--------|----------|-------------|-----------|-----------|
| 1 | 2006.11-2007.08 | 9 months | +25% | 2008 GFC -55% | ~12 months |
| 2 | 2019.07-2019.10 | 4 months | -3% | 2020 COVID -35% | ~6 months |
| 3 | 2022.09-2023.03 | 7 months | +8% | 2023 manufacturing slowdown | ~9 months |

**Key observation:** Selling immediately on inversion is premature. Prices can rise during the inversion period. The re-steepening point (inversion resolution) is a more reliable signal. Korea's structural curve compression from foreign KTB demand creates higher false positive rates than the US.

**Pattern confidence multiplier** -- `appWorker.js: _applyMacroConfidenceToPatterns()` (line 1122):

```
Inverted (slope < 0):
  Buy adj  = 0.88   (12% discount)
  Sell adj = 1.12   (12% boost)

Bull Steepening (taylorGap < 0, slope > 0.20):
  Buy adj  = 1.06
  Sell adj = 0.95

Bull Flattening (taylorGap < 0, slope <= 0.20):
  Buy adj  = 0.97
  Sell adj = 1.03

Bear Steepening (taylorGap >= 0, slope > 0.20):
  Buy adj  = 0.95
  Sell adj = 1.04

Bear Flattening (taylorGap >= 0, slope <= 0.20):
  Buy adj  = 0.90
  Sell adj = 1.10
```


### 8A.4 Korean Government Bond (KTB) Tenors

The system tracks the following KTB benchmark maturities:

| Tenor | ECOS Code | Primary Use |
|-------|-----------|-------------|
| 1Y | 060Y001 item 010190000 | Short-term rate proxy |
| 3Y | 060Y001 item 010200000 | Risk-free rate for CAPM/DD (r in Merton model) |
| 5Y | 060Y001 item 010200001 | Butterfly spread curvature |
| 10Y | 060Y001 item 010210000 | Yield Gap denominator, Duration benchmark |
| 30Y | 060Y001 item 010220000 | Ultra-long rate, pension liability reference |

**Data pipeline:**

```
ECOS API (daily) -> download_bonds.py -> data/macro/bonds_latest.json
                                      -> data/macro/bonds_history.json (monthly append)
                  -> compute_bond_metrics.py -> data/macro/bond_metrics.json
                     (Duration, Convexity, DV01, curve shape, KRD)
```

**`bond_metrics.json` output schema:**

```json
{
  "benchmarks": {
    "ktb_3y":  {"yield": 3.02, "macaulayDuration": 2.87, "modifiedDuration": 2.82, "dv01": 0.0282, "convexity": 9.15},
    "ktb_10y": {"yield": 3.45, "macaulayDuration": 8.52, "modifiedDuration": 8.37, "dv01": 0.0837, "convexity": 78.5},
    "ktb_30y": {"yield": 3.48, "macaulayDuration": 19.8, "modifiedDuration": 19.5, "dv01": 0.195, "convexity": 450.2}
  },
  "curveShape": {"classification": "normal", "slope_10y_3y": 0.43, "slope_30y_10y": 0.03, "curvature": -0.05},
  "keyRateDurations": {"ktb_1y": 0.99, "ktb_3y": 2.87, "ktb_5y": 4.70, "ktb_10y": 8.52, "ktb_20y": 15.8, "ktb_30y": 19.8}
}
```

---

## 8B. Duration & Convexity

### 8B.1 Macaulay Duration

Macaulay (1938) defines duration as the present-value-weighted average time to receive
a bond's cash flows. It is the "center of mass" of the discounted cash flow stream.

```
                 1       n       CF_t
D_mac = -----  *  SUM  t * ---------
                 P      t=1   (1+y)^t

      = SUM[t=1..n]( t * PV(CF_t) ) / SUM[t=1..n]( PV(CF_t) )
```

**Variable annotation:**

| Symbol | Meaning | Grade | Location |
|--------|---------|-------|----------|
| `D_mac` | Macaulay Duration (years) | -- | `compute_bond_metrics.py: compute_macaulay_duration()` |
| `P` | Bond price = SUM PV(CF_t) | -- | `compute_bond_metrics.py: compute_bond_price()` |
| `CF_t` | Cash flow at period t (coupon or coupon+principal) | -- | Derived from coupon_rate, face value |
| `y` | Yield per period (semiannual for KTB) | -- | `bonds_latest.json: yields.*` |
| `n` | Number of remaining coupon periods (= maturity_years * 2 for semiannual) | -- | Derived |
| `t` | Period index (semiannual) | -- | Loop variable |

**Implementation** -- `compute_bond_metrics.py: compute_macaulay_duration()` (line 91):

```python
def compute_macaulay_duration(coupon_rate, ytm, maturity_years, face=100):
    n = int(maturity_years * 2)            # semiannual periods
    c = (coupon_rate / 100) * face / 2     # semiannual coupon
    y = (ytm / 100) / 2                    # semiannual yield

    price = 0.0
    weighted_sum = 0.0
    for t in range(1, n + 1):
        cf = c
        if t == n:
            cf += face                     # principal at maturity
        discounted = cf / (1 + y) ** t
        price += discounted
        weighted_sum += t * discounted

    return (weighted_sum / price) / 2.0    # semiannual -> annual
```

**Numerical example (KTB 5Y, 4% coupon, YTM 3.50%):**

```
C = 200 (semiannual), n = 10, y = 1.75%
D_mac (semiannual) = 9.088 periods
D_mac (annual) = 9.088 / 2 = 4.544 years

Interpretation: weighted-average cash flow receipt in 4.54 years
(shorter than 5Y maturity -- coupons pull the "center of mass" forward)
```

**Special cases:**

| Bond Type | Duration | Reason |
|-----------|----------|--------|
| Zero-coupon | D = maturity | Only one cash flow at maturity |
| Perpetuity | D = (1+y)/y | Infinite stream, converges |
| FRN (at reset) | D ~ 0.25 years | Rate resets quarterly, nearly immune |

**Academic basis:** Macaulay, F. (1938). "Some Theoretical Problems Suggested by the Movements of Interest Rates." NBER.


### 8B.2 Modified Duration

Modified Duration converts Macaulay Duration into a direct price sensitivity measure.

```
D_mod = D_mac / (1 + y/n)

where:
  y = annual YTM
  n = compounding frequency per year (2 for semiannual KTB)
```

**Price sensitivity (first-order approximation):**

```
dP/P ~ -D_mod * dy

"For a 1%p (100bp) yield change, the bond price changes by approximately D_mod percent."
```

**Implementation** -- `compute_bond_metrics.py` (line 174):

```python
y_semi = (ytm / 100) / 2
mod_dur = mac_dur / (1 + y_semi) if (1 + y_semi) > 0 else mac_dur
```

| Symbol | Meaning | Grade | Location |
|--------|---------|-------|----------|
| `D_mod` | Modified Duration (years) | -- | `bond_metrics.json: benchmarks.*.modifiedDuration` |
| `y` | Annual YTM (decimal) | -- | Input |
| `n` | Compounding frequency (KTB: 2) | [A] Fixed | Hardcoded |

**Derivation:**

```
P = SUM CF_t / (1+y)^t

dP/dy = -SUM t * CF_t / (1+y)^(t+1)
      = -[1/(1+y)] * SUM t * CF_t / (1+y)^t
      = -[1/(1+y)] * P * D_mac

(1/P) * dP/dy = -D_mac / (1+y) = -D_mod

Therefore: dP/P ~ -D_mod * dy  (first-order Taylor expansion)
```

**Display** -- `financials.js: _renderBondMetrics()` (line 481):

```javascript
durEl.textContent = ktb10.modifiedDuration.toFixed(2) + '년';
```


### 8B.3 Convexity

Convexity captures the second-order price sensitivity -- the curvature of the
price-yield relationship. It corrects the linear approximation error of Duration
for large yield changes.

```
              1       n      t(t+1) * CF_t
C = -----  *  SUM   -------------------
              P      t=1   (1+y)^(t+2)

Price change (second-order):
  dP/P ~ -D_mod * dy + 0.5 * C * (dy)^2
```

**Implementation** -- `compute_bond_metrics.py: compute_convexity()` (line 134):

```python
def compute_convexity(coupon_rate, ytm, maturity_years, face=100):
    n = int(maturity_years * 2)
    c = (coupon_rate / 100) * face / 2
    y = (ytm / 100) / 2
    price = compute_bond_price(coupon_rate, ytm, maturity_years, face)

    conv_sum = 0.0
    for t in range(1, n + 1):
        cf = c
        if t == n:
            cf += face
        conv_sum += t * (t + 1) * cf / (1 + y) ** (t + 2)

    return (conv_sum / price) / 4.0     # semiannual -> annual: /4
```

| Symbol | Meaning | Grade | Location |
|--------|---------|-------|----------|
| `C` | Convexity (years^2) | -- | `bond_metrics.json: benchmarks.*.convexity` |
| `t(t+1)` | Second-order weighting | -- | Inner loop |
| `/4.0` | Semiannual-to-annual conversion (= /2^2) | [A] Fixed | Line 162 |

**Key properties:**

1. Positive convexity: for plain vanilla bonds, price rises MORE when yields fall
   than it falls when yields rise by the same amount.
2. Higher convexity is desirable (all else equal) -- "free option."
3. Callable bonds can exhibit negative convexity near the call price.


### 8B.4 DV01 (Dollar Value of a Basis Point)

DV01 = absolute price change for a 1bp yield move.

```
DV01 = P * D_mod * 0.0001

Equivalently: DV01 = |P(y - 1bp) - P(y + 1bp)| / 2
```

**Implementation** -- `compute_bond_metrics.py` (line 178):

```python
dv01 = price * mod_dur * 0.0001
```

| Symbol | Meaning | Grade | Location |
|--------|---------|-------|----------|
| `DV01` | Dollar value of a basis point (per 100 face) | -- | `bond_metrics.json: benchmarks.*.dv01` |
| `0.0001` | 1bp in decimal | [A] Constant | Line 178 |

**Display** -- `financials.js` (line 505):

```javascript
dv01El.textContent = 'DV01 ' + ktb10.dv01.toFixed(4);
```

**Typical KTB DV01 values:**

| Tenor | Approx D_mod | Approx DV01 (per 100) |
|-------|-------------|----------------------|
| 3Y | 2.8 | 0.028 |
| 10Y | 8.4 | 0.084 |
| 30Y | 19.5 | 0.195 |


### 8B.5 Key Rate Duration (KRD)

Key Rate Duration measures sensitivity to yield changes at specific maturity points,
enabling analysis of non-parallel yield curve shifts.

**Implementation** -- `compute_bond_metrics.py: compute_key_rate_durations()` (line 261):

```python
# For each tenor: bump yield by 1bp, measure price impact
bump = 1 * 0.01   # 1bp in %
price_up   = compute_bond_price(ytm, ytm + bump, maturity)
price_down = compute_bond_price(ytm, ytm - bump, maturity)
krd = -(price_up - price_down) / (2 * bump / 100 * price_base)
```

| Symbol | Meaning | Grade | Location |
|--------|---------|-------|----------|
| `KRD_i` | Key Rate Duration at tenor i | -- | `bond_metrics.json: keyRateDurations.*` |
| `bump` | 1bp finite difference step | [A] Fixed | `DV01_BUMP_BP = 1` (line 59) |

**Academic basis:** Ho, T.S.Y. (1992). "Key Rate Durations: Measures of Interest Rate Risks." *Journal of Fixed Income*, 2(2), 29-44.


### 8B.6 Effective Duration (Embedded Options)

For bonds with embedded options (callable, putable), effective duration uses
option-adjusted prices rather than analytical derivatives:

```
D_eff = [P(y - dy) - P(y + dy)] / [2 * P * dy]
```

CheeseStock does not currently compute effective duration -- all KTB benchmarks
are plain vanilla. This is noted for completeness and future expansion to
corporate bond analysis where callability is common.

---

## 8C. Credit Risk -- Merton Distance-to-Default

### 8C.1 Merton (1974) Structural Model

The foundational insight: equity is a European call option on firm assets,
with the face value of debt as the strike price.

```
At maturity T:
  If V_T > F:  shareholders receive V_T - F   (exercise the call)
  If V_T <= F: shareholders receive 0          (limited liability)
               creditors receive V_T           (loss = F - V_T)

Therefore:
  Equity E = max(V_T - F, 0) = Call option on V with strike F
  Debt   D = min(V_T, F) = F * e^(-rT) - Put option on V with strike F
```

**BSM Equity Valuation:**

```
Eq. (8C.1)  E = V * N(d_1) - F * e^(-rT) * N(d_2)

Eq. (8C.2)  d_1 = [ln(V/F) + (r + sigma_V^2/2) * T] / (sigma_V * sqrt(T))

Eq. (8C.3)  d_2 = d_1 - sigma_V * sqrt(T)
```

**Variable annotation:**

| Symbol | Meaning | Grade | JS Location |
|--------|---------|-------|-------------|
| `E` | Equity market value (market cap) | -- | `appWorker.js:877 mcapEok` |
| `V` | Firm asset value (unobservable, estimated) | -- | `appWorker.js:901 V = E + D` |
| `F` | Face value of debt (default point) | -- | `appWorker.js:880 D = totalLiab * 0.75` |
| `r` | Risk-free rate (KTB 3Y) | [B] | `appWorker.js:893 r = 0.035 fallback` |
| `T` | Time horizon | [A] Fixed at 1Y | `appWorker.js:904 T = 1` |
| `sigma_V` | Asset volatility (annualized) | -- | `appWorker.js:902` (computed) |
| `N(.)` | Standard normal CDF | -- | `appWorker.js:837 _normalCDF()` |
| `d_1, d_2` | BSM option delta parameters | -- | Embedded in DD formula |

**Assumptions (Merton 1974):**

```
A1. Asset value V follows GBM:  dV = mu_V * V * dt + sigma_V * V * dW
A2. Single zero-coupon debt maturity at T
A3. Default only at T (European-style)
A4. Constant risk-free rate r
A5. Frictionless markets
A6. Assets continuously tradable
A7. Modigliani-Miller: V independent of capital structure
```

**Academic basis:** Merton, R.C. (1974). "On the Pricing of Corporate Debt: The Risk Structure of Interest Rates." *Journal of Finance*, 29(2), 449-470.


### 8C.2 Distance-to-Default (DD)

DD measures how many standard deviations the firm's asset value is above
the default boundary.

```
Eq. (8C.4)  DD = [ln(V/F) + (mu_V - sigma_V^2/2) * T] / (sigma_V * sqrt(T))

Physical probability of default:
Eq. (8C.5)  PD = N(-DD)
```

**DD vs d_2 distinction:**

```
d_2 (risk-neutral) = [ln(V/F) + (r - sigma_V^2/2) * T] / (sigma_V * sqrt(T))
DD  (physical)     = [ln(V/F) + (mu_V - sigma_V^2/2) * T] / (sigma_V * sqrt(T))

Difference: DD - d_2 = (mu_V - r) * sqrt(T) / sigma_V   (market price of risk)

Risk-neutral PD = N(-d_2) > N(-DD) = Physical PD
(Risk-neutral PD is always higher due to the equity risk premium mu_V - r > 0)
```

**DD interpretation scale:**

| DD Range | Risk Level | PD = N(-DD) | CheeseStock Action |
|----------|-----------|-------------|-------------------|
| DD > 4.0 | Very safe | < 0.003% | No adjustment |
| DD > 3.0 | Safe | < 0.13% | No adjustment |
| DD >= 2.0 | Safe | < 2.3% | No adjustment |
| DD >= 1.5 | Caution | < 6.7% | Buy -5%, Sell +2% |
| DD >= 1.0 | Warning | < 15.9% | Buy -18%, Sell +12% |
| DD < 1.0 | Severe | > 15.9% | Buy -25%, Sell +15% |


### 8C.3 Naive DD Calculation (Bharath-Shumway 2008)

CheeseStock uses the "naive" estimator from Bharath & Shumway (2008), which avoids
the iterative Newton-Raphson solution of the full Merton system. Their empirical
finding: `corr(DD_naive, DD_iterative) > 0.90`, and default prediction AUC is
statistically equivalent.

**Implementation** -- `appWorker.js: _calcNaiveDD()` (line 850):

```javascript
// Step 1: Asset value approximation
var V = E + D;                                        // Eq. (2.16)

// Step 2: Asset volatility approximation
var sigmaV = sigmaE * (E / V) + 0.05 * (D / V);     // Eq. (2.15)

// Step 3: DD calculation
var dd = (Math.log(V / D) + (r - 0.5 * sigmaV * sigmaV) * T) / (sigmaV * Math.sqrt(T));
```

**Variable flow (complete):**

| Step | Variable | Source | Formula/Value |
|------|----------|--------|---------------|
| 1 | `E` (equity, eok) | `sidebarManager.MARKET_CAP[code]` or `currentStock.marketCap` | Market cap in 억원 |
| 2 | `totalLiab` | `_financialCache[code].quarterly[0].total_liabilities` | DART consolidated |
| 3 | `D` (default point) | KMV convention (Doc35 sec6.5) | `totalLiab * 0.75` [B] |
| 4 | `sigmaE` | `calcEWMAVol(candleCloses)` from `indicators.js` (line 1336) | EWMA lambda=0.94 [B], annualized * sqrt(250) |
| 5 | `r` | `_bondsLatest.yields.ktb_3y / 100` -> `_macroLatest.ktb3y / 100` -> 0.035 | Fallback chain [B] |
| 6 | `V` | Naive estimate | `E + D` |
| 7 | `sigmaV` | Bharath-Shumway Eq. (2.15) | `sigmaE * (E/V) + 0.05 * (D/V)` |
| 8 | `T` | Fixed | 1 year [A] |
| 9 | `DD` | Eq. (8C.4) with mu_V = r | `[ln(V/D) + (r - sigmaV^2/2)*T] / (sigmaV*sqrt(T))` |
| 10 | `EDF` | Eq. (8C.5) | `_normalCDF(-dd)` |

**FINDING-8C-1 (DD formula deviation from Merton 1974):**

The JS implementation (line 906) uses `r` (risk-free rate) in place of `mu_V`
(expected asset return) in the DD numerator:

```javascript
var dd = (Math.log(V / D) + (r - 0.5 * sigmaV * sigmaV) * T) / (sigmaV * Math.sqrt(T));
//                            ^-- uses r, not mu_V
```

This computes the risk-neutral `d_2` rather than the physical DD. In the original
Merton (1974) paper, DD uses the physical drift `mu_V`. The Bharath-Shumway (2008)
paper discusses both approaches:

- Using `r`: yields the risk-neutral default probability N(-d_2), which is higher
  than the physical PD. This is conservative (overestimates default risk).
- Using `mu_V` (e.g., prior year equity return): yields the physical PD, which
  aligns with the DD definition in Doc 47 Eq. (2.11).

The current implementation is CONSERVATIVE (safe-side error) because it overstates
default risk. The EDF field `_normalCDF(-dd)` therefore represents the risk-neutral
PD, not the physical PD. For pattern confidence adjustment purposes, this conservative
bias is acceptable -- it reduces false buy signals on credit-risky stocks.

However, the variable name `edf` (Expected Default Frequency) in line 910 is
technically a misnomer: EDF in the KMV sense uses the physical measure, while
the current calculation uses the risk-neutral measure. Renaming to `pd_riskneutral`
would be more precise.

**Severity: LOW** -- functional impact is conservative (safe side). Naming is imprecise.

**FINDING-8C-2 (Default Point approximation):**

The implementation uses `D = totalLiab * 0.75` (line 880) as the default point.
The original KMV convention is `DP = STD + 0.5 * LTD` (short-term debt + 50% long-term debt).

DART's `부채총계` includes both financial and operating liabilities (trade payables,
deferred revenue, provisions). The 0.75 multiplier is a rough approximation that
attempts to discount non-financial liabilities.

For companies with high operating liabilities (e.g., construction, distribution),
this may overstate the default point. For financial-heavy balance sheets, it may
understate it. The financial sector exclusion (line 857) mitigates the worst cases.

**Severity: LOW** -- acceptable approximation given DART data granularity.

**FINDING-8C-3 (Annualization inconsistency):**

Line 890 uses `Math.sqrt(250)` for annualization (KRX_TRADING_DAYS=250),
while several other locations in the codebase use `Math.sqrt(252)`.

```javascript
sigmaE *= Math.sqrt(250);  // line 890: 250 trading days
```

The difference is < 0.4% (sqrt(252)/sqrt(250) = 1.004), negligible for the
naive DD calculation. However, for codebase consistency, a single constant
(250 or 252) should be standardized.

**Severity: NEGLIGIBLE** -- < 0.4% impact on DD.


### 8C.4 DD-Based Pattern Confidence Adjustment

**Implementation** -- `appWorker.js: _applyMertonDDToPatterns()` (line 923):

```javascript
function _applyMertonDDToPatterns(patterns) {
  if (dd >= 2.0) return;   // Safe -- no adjustment

  for each pattern:
    if (dd >= 1.5)       adj = isBuy ? 0.95 : 1.02;    // Caution
    else if (dd >= 1.0)  adj = isBuy ? 0.82 : 1.12;    // Warning
    else                 adj = isBuy ? 0.75 : 1.15;    // Severe

    adj = clamp(adj, 0.75, 1.15);
    p.confidence = clamp(round(p.confidence * adj), 10, 100);
}
```

**Design rationale:**

| DD Tier | Buy Discount | Sell Boost | Rationale |
|---------|-------------|-----------|-----------|
| >= 2.0 | 0% | 0% | Safe -- DD is firm-specific, limited scope |
| 1.5-2.0 | -5% | +2% | Caution -- monitor credit deterioration |
| 1.0-1.5 | -18% | +12% | Warning -- "dead cat bounce" risk high |
| < 1.0 | -25% | +15% | Severe -- default probability > 15.9% |

Clamp [0.75, 1.15] prevents extreme overrides from a single firm-specific indicator.

**Financial sector exclusion:**

```javascript
var sector = _getStovallSector(industry);
if (sector === 'financial') return;   // line 857
```

Banks and insurance companies use debt as operating assets -- their high leverage
is structural, not a sign of distress. DD is meaningless for financials.

**Data quality guard:**

```javascript
if (cached.source !== 'dart' && cached.source !== 'hardcoded') return;  // line 863
```

Seed data (PRNG-generated) must NEVER produce DD calculations -- this would
create phantom credit warnings on stocks without real financial data.


### 8C.5 Standard Normal CDF Implementation

**Implementation** -- `appWorker.js: _normalCDF()` (line 837):

```javascript
// Abramowitz & Stegun (1964), |error| < 7.5e-8
function _normalCDF(x) {
  if (x > 6) return 1;
  if (x < -6) return 0;
  var neg = (x < 0);
  // ... polynomial approximation
}
```

This is the Abramowitz & Stegun 26.2.17 rational approximation with 6 coefficients.
Maximum error < 7.5e-8, which is more than sufficient for DD calculations where
inputs are typically in the range [-4, 8].


### 8C.6 Merton Model Limitations (KRX Context)

| Limitation | Merton Assumption | KRX Reality | Impact |
|------------|-------------------|-------------|--------|
| Single maturity | Zero-coupon debt at T | Firms have complex debt schedules | DP=0.75*totalLiab approximates |
| European default | Default only at T | Default can occur anytime (covenant breach, interest default) | Underestimates short-term risk |
| Constant r | Fixed risk-free rate | BOK rate changes, yield curve shifts | Using live KTB3Y mitigates |
| Observable V | Continuous asset trading | Private subsidiaries, cross-guarantees (chaebol) | Individual DD may miss group risk |
| GBM assets | No jumps | Regulatory actions, M&A, lawsuits | Fat tails not captured |
| Price limits | Continuous prices | KRX +/-30% daily limit | sigma_E truncation bias |

---

## 8D. Credit Spreads

### 8D.1 Definition and Measurement

```
Credit_Spread(rating, tau) = y_corp(rating, tau) - y_gov(tau)
```

**Key Korean credit spread benchmarks:**

| Spread | Definition | Role |
|--------|-----------|------|
| AA- spread (3Y) | AA- corporate 3Y - KTB 3Y | Investment-grade credit risk barometer |
| BBB- spread (3Y) | BBB- corporate 3Y - KTB 3Y | High-yield boundary, cycle-sensitive |
| BBB-AA spread | BBB- spread - AA- spread | Risk differentiation between quality tiers |

**Historical ranges (Korea 2005-2025):**

| Metric | AA- Spread | BBB- Spread |
|--------|-----------|------------|
| Min | 0.20%p (2021.Q2) | 2.50%p (2021.Q2) |
| Mean | 0.55%p | 4.20%p |
| Max | 2.80%p (2008.Q4 GFC) | 12.50%p (2009.Q1 GFC) |
| Std Dev | 0.35%p | 1.80%p |


### 8D.2 Credit Regime Classification

**4-tier classification** -- `appWorker.js` reads from `bonds_latest.json: credit_regime`:

| Regime | AA- Threshold | Constant | Pattern Adjustment |
|--------|--------------|----------|-------------------|
| Compressed | < 0.50%p | #131 [C] | Buy +2% (risk-on extreme) |
| Normal | 0.50-1.00%p | -- | No adjustment |
| Elevated | 1.00-1.50%p | #132 [C] | Buy -7%, Sell +4% |
| Stress | >= 1.50%p | #133 [C] | All patterns -15% |

**JS implementation** -- `appWorker.js: _applyMacroConfidenceToPatterns()` Factor 3 (line 1152):

```javascript
if (aaSpread > 1.5 || creditRegime === 'stress') {
    adj *= 0.85;                    // Stress: -15% (all patterns)
} else if (aaSpread > 1.0 || creditRegime === 'elevated') {
    adj *= isBuy ? 0.93 : 1.04;    // Elevated: buy -7%, sell +4%
}
```

**FINDING-8D-1 (Compressed regime not in JS):**

The `_applyMacroConfidenceToPatterns()` function handles "stress" and "elevated"
but does NOT have a branch for "compressed" (aaSpread < 0.50). The theoretical
adjustment from Doc 35 sec5.5 (`patternMult *= 1.02` for compressed) is not implemented.

The omission means that during extreme risk-on periods (spread < 0.50%p), buy patterns
do not get the small 2% confidence boost they theoretically should. The impact is
minor (2% adjustment), but it represents an asymmetry in the implementation:
the system penalizes risk-off but does not reward risk-on at the credit level.

**Severity: LOW** -- 2% missed boost in extreme risk-on. May be intentional conservatism.


### 8D.3 Credit Spread as Recession Indicator

Credit spread widening predicts economic downturns. Gilchrist & Zakrajsek (2012)
introduced the Excess Bond Premium (EBP) decomposition:

```
Credit Spread = Expected Default Component + Excess Bond Premium (EBP)

EBP captures:
  - Risk appetite shifts
  - Liquidity contraction
  - Financial intermediary health

EBP widening -> recession within 4-6 quarters (stronger predictor than raw spread)
```

**Flight-to-quality signal:**

```
If spread > mean(spread, 3Y) + 2 * std(spread, 3Y):
  -> Flight-to-quality signal active
  -> Buy patterns heavily discounted
```

This logic is embedded in the RORO factor (Factor 2) rather than as a standalone signal.

---

## 8E. Bond-Equity Linkage

### 8E.1 Equity Risk Premium (ERP)

```
ERP_implied = E/P - y(10Y) = 1/PER - KTB_10Y
```

| Symbol | Meaning | Grade | JS Location |
|--------|---------|-------|-------------|
| `E/P` | Earnings yield = 1/PER | -- | `financials.js:846 earningsYield` |
| `y(10Y)` | KTB 10Y yield | -- | `financials.js:848 ktb10y` |
| `ERP` | Equity Risk Premium (implied) | -- | Computed as yield gap |

**CheeseStock uses the simplified implied ERP** (= Fed Model yield gap), which is
the Yardeni (1997) formulation. Asness (2003) critiques this for money illusion,
growth neglect, and duration mismatch. However, Bekaert & Engstrom (2010)
defend its empirical utility (R^2 ~ 0.10-0.15 for 12M forward returns).

**Korean ERP distribution (2005-2025):**

```
Mean:   +4.8%p
Median: +4.5%p
Std:    1.8%p
P5:     +2.0%p (equity expensive extreme)
P95:    +8.5%p (equity cheap extreme)
```


### 8E.2 Yield Gap (Fed Model / BOK Model)

**Implementation** -- `financials.js` (line 851):

```javascript
var yieldGapVal = +(earningsYield - ktb10y).toFixed(2);
var yieldGapStr = (yieldGapVal >= 0 ? '+' : '') + yieldGapVal.toFixed(2) + '%p';
set('fin-yield-gap', yieldGapStr);
setClass('fin-yield-gap', 'fin-grid-value' + (yieldGapVal >= 0 ? ' up' : ' dn'));
```

**KTB10Y fallback chain:**

```javascript
var ktb10y = (_macroData && _macroData.ktb10y != null) ? _macroData.ktb10y
  : (_bondsLatest && _bondsLatest.yields && _bondsLatest.yields.ktb_10y != null)
    ? _bondsLatest.yields.ktb_10y
  : 3.5;   // fallback constant [B] #130 YIELD_GAP_FALLBACK_KTB
```

**Interpretation:**

| Yield Gap | Signal | Percentile (KR 2005-2025) |
|-----------|--------|--------------------------|
| > +5.0%p | VERY_CHEAP (equities) | P10 (bottom 10%) |
| +3.0 to +5.0%p | CHEAP | P10-P40 |
| +1.0 to +3.0%p | FAIR | P40-P60 |
| -1.0 to +1.0%p | EXPENSIVE | P60-P90 |
| < -1.0%p | VERY_EXPENSIVE | P90+ |


### 8E.3 RORO (Risk-On / Risk-Off) Regime

The RORO framework classifies the aggregate risk appetite state using a 5-factor
composite score with hysteresis-based regime switching.

**Theoretical basis:** Baele, Bekaert & Inghelbrecht (2010). "The Determinants
of Stock and Bond Return Comovements." *Review of Financial Studies*, 23(6), 2374-2428.

**Implementation** -- `appWorker.js: _classifyRORORegime()` (line 1339):

**5-Factor Composite Score:**

| Factor | Weight | Input | Scoring Logic |
|--------|--------|-------|---------------|
| F1: VKOSPI/VIX | 0.30 | `_macroLatest.vkospi` -> VIX*1.15 proxy | >30: -1.0, >22: -0.5, <15: +0.5 |
| F2a: AA- credit spread | 0.10 | `_bondsLatest.credit_spreads.aa_spread` | >1.5: -1.0, >1.0: -0.5, <0.5: +0.3 |
| F2b: US HY spread | 0.10 | `_macroLatest.us_hy_spread` | >5.0: -1.0, >4.0: -0.5, <3.0: +0.3 |
| F3: USD/KRW | 0.20 | `_macroLatest.usdkrw` | >1450: -1.0, >1350: -0.5, <1200: +0.5, <1100: +1.0 |
| F4: MCS v2 | 0.15 | `_macroLatest.mcs` | MCS [0,1] -> [-1,+1]: `(mcs - 0.5) * 2` |
| F5: Investor alignment | 0.15 | `_investorData.alignment` | aligned_buy: +0.8, aligned_sell: -0.8 |

**Normalization:**

```javascript
var normalizedScore = score * Math.min(count / 3, 1.0);
// If fewer than 3 valid inputs, proportionally discount the score
```

**Hysteresis regime switching:**

```
Entry thresholds:  ENTER_ON = +0.25,  ENTER_OFF = -0.25
Exit thresholds:   EXIT_ON  = +0.10,  EXIT_OFF  = -0.10

From 'neutral':
  score >= +0.25 -> 'risk-on'
  score <= -0.25 -> 'risk-off'

From 'risk-on':
  score <= +0.10 -> neutral (or risk-off if score <= -0.25)

From 'risk-off':
  score >= -0.10 -> neutral (or risk-on if score >= +0.25)
```

The hysteresis gap (ENTER - EXIT = 0.15) prevents oscillation at regime boundaries.
This is a critical design feature: without it, borderline scores would cause
rapid regime flipping and noisy confidence adjustments.

**Pattern adjustment** -- `_applyRORORegimeToPatterns()` (line 1455):

```
risk-on:   Buy +6%, Sell -6%    (buyAdj=1.06, sellAdj=0.94)
risk-off:  Buy -8%, Sell +8%    (buyAdj=0.92, sellAdj=1.08)
neutral:   No adjustment

Clamp: [0.92, 1.08]  -- prevents double-counting with Factor 3 (credit)
                         and Factor 8 (VIX) in the macro adjustment layer
```

**Asymmetry:** Risk-off impact (-8%) is larger than risk-on (+6%). This reflects
the empirical asymmetry in regime transitions (Ang & Bekaert 2002):

- Risk-On -> Risk-Off: Fast (2-4 weeks), driven by exogenous shocks
- Risk-Off -> Risk-On: Slow (3-6 months), driven by policy/data improvement

**FINDING-8E-1 (RORO threshold calibration):**

The VKOSPI thresholds (15, 22, 30) and USD/KRW thresholds (1100, 1200, 1350, 1450)
are hardcoded values. These appear to be reasonable based on historical ranges but
are not explicitly calibrated against backtest data. They carry a [C] grade
(D-heuristic audit classification).

The USD/KRW thresholds in particular may drift over time as the structural
equilibrium shifts (e.g., the 1200-1350 "neutral" band may need updating if
the KRW structurally weakens). A rolling percentile approach would be more robust
but increases computational complexity.

**Severity: MEDIUM** -- hardcoded FX thresholds may become stale. Monitored via
the D-heuristic constant audit process.


### 8E.4 Bond-Equity Correlation Regimes

Campbell, Sunderam & Viceira (2017) show that the sign of bond-equity correlation
depends on the dominant macro shock type:

| Regime | Correlation | Dominant Shock | Period (US) | Bond as Hedge? |
|--------|------------|----------------|-------------|---------------|
| Inflation | rho > 0 | Nominal (inflation) | 1970-1999, 2022 | NO |
| Growth | rho < 0 | Real (growth) | 2000-2020 | YES |
| Decoupled | rho ~ 0 | Policy/liquidity | 2020.Q2-2021 | Partial |

**Korea gamma_i (inflation beta) estimates (2005-2025):**

```
Overall mean: gamma_i ~ -0.8  (negative = inflation hurts equities)
Pre-2020:     gamma_i ~ -0.5
2022:         gamma_i ~ -2.0  (inflation fear extreme)
2023-2025:    gamma_i ~ -0.7  (normalizing)
```

Korea is predominantly in the "Growth regime" (negative correlation), meaning
government bonds serve as effective equity hedges. The 2022 inflation shock
temporarily switched to the "Inflation regime" where both assets fell together.

This correlation regime is captured implicitly in the RORO framework (Factor 2
uses credit spreads as a proxy for the flight-to-quality dynamic).


### 8E.5 Yield Gap Analysis: Earnings Yield vs KTB10Y

The yield gap serves as a relative valuation metric between equities and bonds:

```
Yield_Gap = E/P - KTB10Y = 1/PER - KTB10Y

Positive gap: equities offer higher yield than bonds -> equity preference
Negative gap: bonds offer higher yield than equities -> bond preference
```

**Structural break awareness:**

| Period | Mean Gap | Reason |
|--------|---------|--------|
| 2000-2010 | +4.0% | High interest rate era |
| 2010-2020 | +5.5% | Low interest rate era |
| 2020-2025 | +3.5% | Rate normalization |

The shifting mean gap means fixed thresholds are unreliable. ERP z-score
normalization (rolling 504-day window) adjusts for structural regime changes.

---

## Bond & Credit Findings

### Summary Table

| ID | Severity | Component | Description |
|----|----------|-----------|-------------|
| FINDING-8A-1 | INFO | Yield Curve Display | JS flat threshold (0.15) differs from Python classification (0.5). Acceptable UX vs analytical divergence. |
| FINDING-8C-1 | LOW | Merton DD | DD uses risk-free rate `r` instead of physical drift `mu_V`. Computes risk-neutral d_2 rather than physical DD. Conservative (safe-side). EDF naming is imprecise. |
| FINDING-8C-2 | LOW | Default Point | `D = totalLiab * 0.75` approximates KMV's `STD + 0.5*LTD`. May overstate for high operating-liability firms. Acceptable given DART data granularity. |
| FINDING-8C-3 | NEGLIGIBLE | Annualization | `sqrt(250)` vs `sqrt(252)` inconsistency. < 0.4% impact. |
| FINDING-8D-1 | LOW | Credit Regime | "Compressed" regime (aaSpread < 0.50) has no JS implementation for the +2% buy boost. Asymmetric: penalizes risk-off but does not reward risk-on at credit level. |
| FINDING-8E-1 | MEDIUM | RORO Thresholds | VKOSPI (15/22/30) and USD/KRW (1100/1200/1350/1450) thresholds are hardcoded [C]-grade constants. FX thresholds particularly vulnerable to structural drift. |

### Formulas Cross-Reference

| Formula | Academic Source | JS Implementation | Python Implementation | Verified |
|---------|---------------|-------------------|----------------------|----------|
| NSS 4-factor | Nelson-Siegel 1987 + Svensson 1994 | Not self-computed; reads from `bonds_latest.json` | Self-fit option in `download_bonds.py` | YES (params match Doc 35 sec2) |
| Macaulay Duration | Macaulay 1938, Fabozzi 2007 ch.4 | Not computed in JS; reads from `bond_metrics.json` | `compute_bond_metrics.py:91` | YES |
| Modified Duration | D_mac / (1+y/n) | Display only | `compute_bond_metrics.py:174` | YES |
| DV01 | P * D_mod * 0.0001 | Display only | `compute_bond_metrics.py:178` | YES |
| Convexity | Fabozzi 2007 ch.4 | Not displayed | `compute_bond_metrics.py:134` | YES (/4 annual conversion correct) |
| KRD | Ho 1992 | Not displayed | `compute_bond_metrics.py:261` | YES (finite diff 1bp) |
| Merton equity = call | Merton 1974 Eq. E=V*N(d1)-F*e^(-rT)*N(d2) | `appWorker.js:906` (naive DD, not full BSM solve) | `compute_capm_beta.py` (pre-computed DD in capm_beta.json) | YES with NOTE: uses r not mu_V |
| DD = d_2 (risk-neutral) | Bharath-Shumway 2008 | `appWorker.js:906` | -- | YES (see FINDING-8C-1) |
| PD = N(-DD) | Merton 1974 | `appWorker.js:910 _normalCDF(-dd)` | -- | YES |
| Normal CDF | Abramowitz & Stegun 1964 sec26.2.17 | `appWorker.js:837 _normalCDF()` | -- | YES (|err| < 7.5e-8) |
| Credit spread regime | Doc 35 sec5.3 | `appWorker.js:1083-1158` (3 of 4 tiers) | `download_bonds.py` generates credit_regime | PARTIAL (compressed tier missing in JS) |
| RORO 5-factor | Baele, Bekaert & Inghelbrecht 2010 | `appWorker.js:1339 _classifyRORORegime()` | -- | YES |
| Yield gap (Fed Model) | Yardeni 1997, Asness 2003 critique | `financials.js:851` | -- | YES |
| Curve shape classification | Litterman & Scheinkman 1991 | `financials.js:418 _renderYieldCurve()` | `compute_bond_metrics.py:193 classify_curve_shape()` | YES (threshold divergence noted) |

### Data Pipeline Integrity

| Data File | Producer | Consumer (JS) | Required Keys | Status |
|-----------|----------|---------------|---------------|--------|
| `data/macro/bonds_latest.json` | `download_bonds.py` | `appWorker.js: _bondsLatest` | `updated`, `slope_10y3y`, `curve_inverted`, `credit_spreads.aa_spread`, `credit_regime`, `yields.*` | CRITICAL |
| `data/macro/bond_metrics.json` | `compute_bond_metrics.py` | `financials.js: _bondMetrics` | `benchmarks.ktb_10y.{modifiedDuration, dv01}`, `curveShape.classification` | OPTIONAL (display only) |
| `data/backtest/capm_beta.json` | `compute_capm_beta.py` | `financials.js: _capmBetaJson` | `stocks.{code}.distanceToDefault`, `stocks.{code}.ddGrade` | OPTIONAL (DD display) |

### Constants Registry (Bond & Credit)

| # | Name | Value | Grade | Location | Calibration Status |
|---|------|-------|-------|----------|--------------------|
| 130 | YIELD_GAP_FALLBACK_KTB | 3.5% | [B] | `appWorker.js:893`, `financials.js:850` | Manually set; should track current KTB3Y |
| 131 | CREDIT_COMPRESSED_THRESHOLD | 0.50%p | [C] | Doc 35 sec5.3 (NOT in JS) | Historical median reference |
| 132 | CREDIT_ELEVATED_THRESHOLD | 1.00%p | [C] | `appWorker.js:1157` | ~mean + 1.3 sigma |
| 133 | CREDIT_STRESS_THRESHOLD | 1.50%p | [C] | `appWorker.js:1155` | ~mean + 2.7 sigma |
| 134 | MERTON_DD_WARNING | 1.5 | [B] | `appWorker.js:933` (dd >= 1.5 boundary) | N(-1.5) = 6.7% PD |
| 135 | RORO_POS_THRESHOLD | +0.30 | [C] | Doc 35 sec3.2.3 (RORO uses 0.25 entry) | Conceptual; JS uses hysteresis |
| 136 | RORO_NEG_THRESHOLD | -0.30 | [C] | Doc 35 sec3.2.3 (RORO uses -0.25 entry) | Conceptual; JS uses hysteresis |
| 137 | RORO_WINDOW | 60 | [B] | Doc 35 sec3.2.3 | ~3 months rolling window |
| -- | DD clamp | [0.75, 1.15] | [B] | `appWorker.js:944` | Limits single-indicator override |
| -- | RORO clamp | [0.92, 1.08] | [B] | `appWorker.js:1471` | Prevents VIX/credit double-counting |
| -- | EWMA lambda | 0.94 | [B] | `indicators.js:1336` (via calcEWMAVol) | RiskMetrics 1996 default |
| -- | KRX_TRADING_DAYS | 250 | [B] | `appWorker.js:890` (250 vs 252 elsewhere) | KRX calendar ~249-251 |
| -- | Default Point multiplier | 0.75 | [B] | `appWorker.js:880` | Approximation of KMV DP formula |
| -- | Debt volatility term | 0.05 | [B] | `appWorker.js:902` | Bharath-Shumway Eq. (2.15) |
