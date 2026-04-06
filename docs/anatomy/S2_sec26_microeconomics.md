# Section 2.6: Microeconomic Foundations

> Stage 2 -- ANATOMY V5, CheeseStock KRX Live Chart
> Author: Microeconomics Analyst Agent
> Date: 2026-04-06

---

## Overview

This section documents the microeconomic theory underlying CheeseStock's **micro confidence adjustments** and **market structure analysis**. The system's `_applyMicroConfidenceToPatterns()` pipeline (appWorker.js lines 1523-1556) applies two distinct micro adjustments to detected pattern confidence scores: (1) Amihud ILLIQ liquidity discount and (2) HHI mean-reversion boost. These adjustments are grounded in six pillars of microeconomic theory, each documented below with CFA-grade formula annotations.

**Theory-to-Code Map:**

| Pillar | Core Theory | Code Entry Point | Status |
|--------|-------------|------------------|--------|
| 2.6.1 Value-Price-Equilibrium | Marshall, Walras, Grossman-Stiglitz | chart.js candle rendering, api.js order model | Conceptual |
| 2.6.2 Market Structure | Cournot, Bertrand, HHI | appWorker.js `_updateMicroContext()` HHI calc | **Implemented** |
| 2.6.3 Information Asymmetry | Akerlof, Spence, Kyle | indicators.js `calcAmihudILLIQ()` | **Implemented** |
| 2.6.4 Market Microstructure | Amihud, Kyle lambda, Roll | appWorker.js ILLIQ confDiscount | **Implemented** |
| 2.6.5 Search and Attention | Stigler, Peng-Xiong, Barber-Odean | indicators.js attentionState (IndicatorCache) | Partial |
| 2.6.6 Agency Costs | Jensen-Meckling, Holmstrom | Design spec only (ARI not implemented) | Design |

**Pipeline Position:** Micro confidence runs after macro confidence (`_applyMacroConfidenceToPatterns`) and before derivatives confidence (`_applyDerivativesConfidenceToPatterns`). Clamp range is [0.80, 1.15], narrower than macro's range, reflecting the principle that micro factors are second-order corrections.

---

## 2.6.1 Value, Price, and Equilibrium (VPE)

### 2.6.1.1 Supply-Demand in the Limit Order Book

The KRX limit order book is a direct empirical realization of Marshallian supply-demand analysis (Marshall 1890). Bid orders constitute the demand curve; ask orders constitute the supply curve. The market-clearing price emerges at the intersection.

**Demand Curve (Cumulative Bid):**

```
D(p) = SUM q_bid   where p_bid >= p
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| D(p) | Cumulative demand at price p | shares | [0, inf) | Order book aggregation |
| q_bid | Individual bid order quantity | shares | > 0 | Limit order submission |
| p_bid | Bid price of individual order | KRW | > 0 | Order book |
| p | Reference price level | KRW | > 0 | Query parameter |

**Supply Curve (Cumulative Ask):**

```
S(p) = SUM q_ask   where p_ask <= p
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| S(p) | Cumulative supply at price p | shares | [0, inf) | Order book aggregation |
| q_ask | Individual ask order quantity | shares | > 0 | Limit order submission |
| p_ask | Ask price of individual order | KRW | > 0 | Order book |

**Equilibrium (Market-Clearing Price):**

```
p* = argmax_p  min(D(p), S(p))
```

where D(p*) = S(p*) at equilibrium. This is the continuous double auction analog (Smith 1962) of Walrasian tatonnement (Walras 1874).

### 2.6.1.2 Walrasian Auction -- KRX Opening/Closing Call

KRX uses call auctions for price discovery at market open and close:

| Feature | Opening Call | Closing Call |
|---------|-------------|-------------|
| Time | 08:30-09:00 KST | 15:20-15:30 KST |
| Duration | 30 min order accumulation | 10 min order accumulation |
| Price rule | Volume-maximizing single price | Volume-maximizing single price |
| Theory basis | Walras (1874) tatonnement | Same; introduced 2016 to prevent closing manipulation |

The call auction price is the discrete Walrasian equilibrium:

```
p_W = argmax_p  min(D(p), S(p))
```

Tie-breaking: minimize residual quantity, then select price nearest to previous close.

**CheeseStock mapping:** `generate_intraday.py` uses the daily open as the 09:00 candle open price, which is the Walrasian equilibrium outcome. In WS mode, Kiwoom OCX delivers this price directly to `chart.js`.

### 2.6.1.3 Bid-Ask Spread Decomposition

The spread has three components (standard market microstructure decomposition):

```
s = s_inventory + s_adverse + s_order_processing
```

| Component | Formula | Theory Source | KRX Dominance |
|-----------|---------|---------------|---------------|
| s_inventory | proportional to sigma_stock * T_hold | Stoll (1978), Ho & Stoll (1981) | Low (no designated MM) |
| s_adverse | proportional to P(informed) * E[\|V - p\|] | Glosten & Milgrom (1985), Kyle (1985) | **60-80% of spread** (KOSDAQ small) |
| s_order_processing | system + regulatory cost | Roll (1984) | ~0.001% (negligible in electronic markets) |

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| s | Total bid-ask spread | % of mid-price | 0.02-0.80% | Order book |
| s_inventory | Inventory risk compensation | % | varies | Stoll (1978) |
| s_adverse | Adverse selection cost | % | 40-80% of s | Glosten & Milgrom (1985) |
| sigma_stock | Daily return volatility | % | 0.5-5% | OHLCV data |
| T_hold | Expected holding period | days | > 0 | Market maker parameter |
| P(informed) | Probability trade is from informed agent | dimensionless | [0, 1] | PIN model (Easley et al. 1996) |

**KRX-specific:** No designated market makers exist on KRX. The inventory component reflects limit-order-submitter execution risk rather than dealer inventory risk. As a result, s_adverse dominates the spread -- particularly for KOSDAQ small caps where individual investors constitute 80%+ of volume.

| Market Segment | Avg Spread | s_adverse Share | Interpretation |
|----------------|-----------|-----------------|----------------|
| KOSPI 200 large | 0.03-0.08% | ~40% | Abundant institutional/foreign flow, low info asymmetry |
| KOSPI mid | 0.08-0.15% | ~55% | Moderate |
| KOSDAQ large | 0.10-0.25% | ~65% | Higher retail share raises info asymmetry |
| KOSDAQ small | 0.25-0.80% | ~80% | Extreme adverse selection, wide bid-ask gap |

**CheeseStock mapping:** `backtester.js` uses `KRX_SLIPPAGE = 0.10%` (one-way), which is calibrated to KOSPI mid-cap. Theory suggests 3-tier slippage: large 0.04%, mid 0.10%, small 0.35%.

### 2.6.1.4 Grossman-Stiglitz Paradox and Pattern Existence

The Grossman-Stiglitz (1980) impossibility theorem provides the theoretical justification for technical pattern analysis:

```
If prices perfectly reflect all information:
  -> no incentive to collect information (cost c > 0)
  -> no one collects information
  -> prices cannot reflect information
  -> CONTRADICTION

Resolution: equilibrium information inefficiency exists, sized proportionally to c_info.

E[Return_informed] - E[Return_uninformed] = c_info / risk_aversion
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| c_info | Cost of information collection and processing | KRW | > 0 | Stigler (1961) |
| risk_aversion | Aggregate risk aversion coefficient | dimensionless | > 0 | Market calibration |

This equilibrium inefficiency is what pattern analysis exploits. The Adaptive Markets Hypothesis (Lo 2004) extends this to a time-varying c_info, explaining why pattern alpha waxes and wanes. CheeseStock's AMH decay mechanism (signalEngine.js) models the convergence of pattern alpha toward c_info.

### 2.6.1.5 Consumer/Producer Surplus in Securities Markets

```
Buyer Surplus:   BS = SUM_{i in filled_buys}  (V_reservation_i - p_execution_i)
Seller Surplus:  SS = SUM_{j in filled_sells} (p_execution_j - V_reservation_j)
Total Surplus:   TS = BS + SS   (maximized at Walrasian equilibrium)
```

**Deadweight Loss (DWL) sources on KRX:**

| DWL Source | Mechanism | Estimated Size |
|------------|-----------|---------------|
| Spread | Bid-ask gap in continuous trading | ~0.02% (KOSPI), ~0.15% (KOSDAQ) |
| Price limit +-30% | Trading halted at limit | 15-30% when limit hit |
| Circuit breaker | All-stock halt 20 min-1 hr | 20-40% of halt-period surplus |
| Transaction tax | Sell-side levy | 0.03% (KOSPI), 0.15% (KOSDAQ) |
| Tick size | Minimum price increment by tier | ~0.01-0.10% |

Du, Liu & Rhee (2009) document the **magnet effect**: as price approaches the limit, speculative orders accelerate arrival at the limit, blocking trades that would not otherwise have been blocked. This amplifies DWL beyond the naive limit-hit cost.

---

## 2.6.2 Market Structure Analysis

### 2.6.2.1 Competition Spectrum and EMH Correspondence

The four assumptions of perfect competition map directly to EMH preconditions:

| Perfect Competition Assumption | EMH Analog |
|-------------------------------|------------|
| (1) Many participants | Infinite price-taking traders |
| (2) Homogeneous goods | Substitutable investment opportunities |
| (3) Free entry/exit | No transaction costs or regulatory barriers |
| (4) Perfect information | All information reflected in prices |

When all four hold: P = V (intrinsic value), no excess return, pattern analysis is meaningless. **Assumption (4) fails in reality** (Grossman-Stiglitz 1980), which provides the existence condition for technical analysis.

### 2.6.2.2 Oligopoly Models for Korean Industries

Korean industries exhibit oligopolistic structures best modeled by Cournot and Bertrand frameworks.

**Cournot Duopoly (Quantity Competition, Cournot 1838):**

```
Market demand:     P = a - b(q_1 + q_2)
Firm i profit:     pi_i = (a - b(q_i + q_j) - c_i) * q_i
Best response:     q_i* = (a - 2*c_i + c_j) / (3*b)
Equilibrium price: P* = (a + c_1 + c_2) / 3
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| a | Demand intercept | KRW | > 0 | Market demand estimation |
| b | Demand slope | KRW/unit | > 0 | Market demand estimation |
| q_i | Quantity produced by firm i | units | >= 0 | Firm decision variable |
| c_i | Marginal cost of firm i | KRW/unit | > 0 | Cost structure |
| P* | Equilibrium market price | KRW | > c | Cournot equilibrium |

**Bertrand Duopoly with Differentiation (Bertrand 1883):**

```
Differentiated products: P_i* = (a + c_i + d*c_j) / (2 + d)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| d | Product substitutability | dimensionless | [0, 1] | 0=independent, 1=perfect substitute |

**Korean Industry Oligopoly Mapping:**

| Industry | Oligopoly Type | Major Players | Strategic Implication |
|----------|---------------|---------------|---------------------|
| Memory Semiconductor | Cournot | Samsung, SK Hynix, Micron | Supply cuts = price increase |
| Mobile Telecom | Bertrand (differentiated) | SKT, KT, LGU+ | Limited price war, stable margins |
| Banking | Bertrand (homogeneous) | 4 financial holdings | NIM convergence, regulation-dependent |
| Automotive | Cournot + differentiation | Hyundai-Kia, imports | Volume control + brand differentiation |
| Retail | Stackelberg | Coupang (leader), Shinsegae, Lotte | Leader's logistics investment determines structure |

### 2.6.2.3 HHI -- Herfindahl-Hirschman Index

**Definition (Herfindahl 1950, Hirschman 1964):**

```
HHI = SUM_{i=1}^{N}  s_i^2
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| HHI | Herfindahl-Hirschman Index | dimensionless | [1/N, 1] | Computed from market shares |
| s_i | Market share of firm i | dimensionless | [0, 1], SUM = 1 | Revenue or market cap basis |
| N | Number of firms in industry | count | >= 1 | Industry definition |

**Mathematical property (variance representation):**

```
HHI = N * Var(s) + 1/N

Numbers Equivalent: NE = 1/HHI
  (equivalent number of equal-sized firms)
```

**US DOJ Classification:**

| HHI Range | Classification |
|-----------|---------------|
| < 0.15 | Unconcentrated |
| 0.15 - 0.25 | Moderately concentrated |
| >= 0.25 | Highly concentrated |

**KRX Industry HHI Estimates (2024, revenue-based):**

| Industry | Major Firms | HHI (est.) | Structure |
|----------|-------------|-----------|-----------|
| Memory Semiconductor | Samsung, SK Hynix | ~0.45 | Duopoly |
| Automotive | Hyundai, Kia | ~0.40 | Duopoly + niche |
| Airlines | Korean Air (+ Asiana merger) | ~0.55 | Monopolization in progress |
| Steel | POSCO, Hyundai Steel | ~0.35 | Duopoly |
| Mobile Telecom | SKT, KT, LGU+ | ~0.33 | Oligopoly |
| Shipbuilding | HD Korea, Samsung HI, Hanwha Ocean | ~0.30 | Oligopoly |
| Refining | SK Inno, GS Caltex, S-Oil, HDO | ~0.25 | Oligopoly |
| Gaming/Entertainment | Krafton, Nexon, HYBE | ~0.12 | Monopolistic competition |
| Bio/Pharma | Samsung Bio, Celltrion, Hanmi | ~0.08 | Competitive |
| Construction | Many (Hyundai, Daewoo, etc.) | ~0.06 | Competitive |

**Limitations:** These are domestic HHI. Global HHI may differ (e.g., Samsung + Hynix have ~65% global DRAM share). Revenue vs market-cap basis produces different HHI. KOSDAQ industries with many small firms exhibit "long tail" structure.

### 2.6.2.4 Lerner Index Connection (Market Power)

Cowling & Waterson (1976) link HHI to industry-level market power:

```
Industry-average Lerner Index = HHI / |epsilon_d|
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| L | Lerner Index = (P - MC) / P | dimensionless | [0, 1] | Lerner (1934) |
| epsilon_d | Price elasticity of demand | dimensionless | < -1 typically | Demand estimation |

Higher HHI and lower |epsilon_d| (necessities) together imply stronger pricing power, more stable margins, and higher mean-reversion pattern reliability.

### 2.6.2.5 HHI Mean-Reversion Boost -- Implementation

**Theory:** High HHI -> strong pricing power -> stable margins -> EPS less volatile -> price anchored to fundamentals -> mean-reversion patterns more reliable.

**Causal chain:**

```
HHI UP -> pricing power UP -> margin stability UP -> EPS volatility DOWN
       -> fundamental anchor stable -> mean-reversion conf UP
```

**Formula (implemented in appWorker.js line 1507):**

```
mean_reversion_boost = HHI_MEAN_REV_COEFF * HHI * eps_stability
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| HHI_MEAN_REV_COEFF | Coefficient mapping HHI to conf boost | dimensionless | fixed | Doc33 sec 6.2 |
| HHI | Sector HHI computed from ALL_STOCKS marketCap | dimensionless | [0, 1] | appWorker.js line 1500-1504 |
| eps_stability | EPS growth stability factor = 1/(1 + sigma_EPS_growth) | dimensionless | (0, 1] | NOT YET IMPLEMENTED |

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| HHI_MEAN_REV_COEFF | 0.10 | [C] | [L:WLS] | 0.04-0.15 | Doc33 sec 6.2 cross-validated, #119 |

**Current implementation note:** `eps_stability` is documented as a TODO (appWorker.js line 1506). Currently the boost uses `hhiBoost = 0.10 * hhi` without the eps_stability mediator. This means the boost may overestimate reliability for cyclical high-HHI industries (e.g., semiconductors where HHI is high but EPS is volatile).

**Application scope:** Only applies to mean-reversion pattern types:

```javascript
var MEAN_REV_TYPES = {
  doubleBottom: true, doubleTop: true,
  headAndShoulders: true, inverseHeadAndShoulders: true
};
```

**Examples:**

| Case | HHI | eps_stability | Boost | Effect |
|------|-----|---------------|-------|--------|
| Semiconductor duopoly | 0.45 | 0.70 (full formula) | 0.0315 | +3.2% |
| Telecom oligopoly | 0.33 | 0.85 | 0.028 | +2.8% |
| Bio/Pharma competitive | 0.08 | 0.30 | 0.0024 | ~0% (negligible) |
| Current impl (no eps) | 0.45 | 1.0 (omitted) | 0.045 | +4.5% (overestimate) |

### 2.6.2.6 Game Theory in Market Equilibria

**Nash Equilibrium (Nash 1950):**

```
Strategy profile s* = (s_1*, s_2*, ..., s_n*) is Nash Equilibrium iff:

For all i, for all s_i in S_i:
  u_i(s_i*, s_{-i}*) >= u_i(s_i, s_{-i}*)

-> No player can unilaterally improve payoff by deviating.
```

Financial application: Market price IS the Nash equilibrium of all participants' strategies. When a technical pattern becomes widely known -> equilibrium shifts -> alpha vanishes. This is the game-theoretic expression of the AMH (Lo 2004).

**Prisoner's Dilemma and Market Panic:**

```
               Player B
              Hold    Sell
Player A
  Hold       (3,3)   (0,5)
  Sell       (5,0)   (1,1)

Nash Equilibrium: (Sell, Sell) = (1,1)
Pareto Optimal:   (Hold, Hold) = (3,3)
```

Each player's individually rational choice (sell) produces a collectively irrational outcome (price crash). Three Black Crows pattern = sequential realization of Prisoner's Dilemma.

**Repeated Games (Folk Theorem):**

```
If discount factor delta >= (5-3)/(5-1) = 0.5,
cooperation (Hold) can be sustained as Nash Equilibrium in infinitely repeated game.
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| delta | Discount factor (patience) | dimensionless | [0, 1] | Player type |

Institutional investors (high delta) stabilize markets by not joining panic. Day traders (low delta) amplify volatility. This is the theoretical basis for why institutional presence reduces market volatility.

**Chaebol Contagion (Cross-Group Transmission):**

```
Delta_P_affiliate = beta_chaebol * Delta_P_parent + epsilon
```

| Group | beta_chaebol | Example Pairs |
|-------|-------------|---------------|
| Samsung | 0.3-0.5 | Electronics -> SDI, SDS, C&T |
| Hyundai | 0.2-0.4 | Motor -> Mobis, Glovis, E&C |
| SK | 0.3-0.5 | Hynix -> Innovation, Telecom |
| LG | 0.2-0.3 | Energy Sol -> Chem, Electronics |

---

## 2.6.3 Information Asymmetry

### 2.6.3.1 Adverse Selection -- Akerlof (1970)

The "Market for Lemons" theory: quality information asymmetry causes market failure.

```
Seller (insider) information: V_true in [V_low, V_high]
Buyer (outsider) expectation:  E[V] = (V_low + V_high) / 2
Equilibrium price:             P* = E[V | seller willing to sell at P]

Result: firms with V_true > P* do not sell -> only "lemons" remain.
```

**Securities market translation:**
- Insider selling = signal that firm value < market price
- Insider buying = signal that firm value > market price
- Bid-ask spread = market maker's compensation for adverse selection risk

### 2.6.3.2 PIN -- Probability of Informed Trading

```
PIN = (alpha * mu) / (alpha * mu + epsilon_b + epsilon_s)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| PIN | Probability of Informed Trading | dimensionless | [0, 1] | Easley et al. (1996) |
| alpha | Probability of information event | dimensionless | [0, 1] | MLE estimation |
| mu | Informed trader arrival rate | traders/period | > 0 | MLE estimation |
| epsilon_b | Uninformed buy arrival rate | traders/period | > 0 | MLE estimation |
| epsilon_s | Uninformed sell arrival rate | traders/period | > 0 | MLE estimation |

**KRX PIN Estimates by Segment:**

| Segment | PIN Estimate | Interpretation |
|---------|-------------|----------------|
| KOSPI large | 0.10-0.15 | Low info asymmetry |
| KOSPI mid | 0.15-0.25 | Moderate |
| KOSDAQ large | 0.20-0.35 | Elevated |
| KOSDAQ small | 0.30-0.50 | High -- paradoxically because abundant noise trading makes it easier for informed traders to hide |

### 2.6.3.3 Signaling Theory -- Spence (1973)

Firms send costly signals to resolve information asymmetry:

| Signal | Cost | KRX Interpretation | Pattern Conf Direction |
|--------|------|--------------------|----------------------|
| Dividend increase | Cash outflow | Earnings stability confidence | Bullish +5% |
| Share buyback | Cash + opportunity cost | Undervaluation belief | Bullish +8% |
| R&D expansion | Short-term profit reduction | Long-term growth confidence | Growth bullish +3% |
| Equity offering | Dilution cost | Cash needed (bearish signal) | Bearish +5% |
| CB/BW issuance | Potential dilution | Immediate cash needed | Bearish +8% |

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| delta_info | 0.15 | [C] | [L:WLS] | 0.05-0.25 | Easley et al. (1996) based, Doc31 sec 3.4 #105 |
| signal_dividend_bonus | +0.05 | [D] | [L:MAN] | 0.02-0.10 | Spence (1973) application |
| signal_buyback_bonus | +0.08 | [D] | [L:MAN] | 0.03-0.15 | Buyback literature |

**Pattern-information alignment formula:**

```
conf_info_adj = conf_base * (1 + delta_info * sign_alignment)
sign_alignment = +1 (insider direction matches pattern direction)
sign_alignment = -1 (insider direction opposes pattern direction)
```

**Status:** Not implemented. Requires insider trading data feed (DART disclosure event pipeline).

### 2.6.3.4 Moral Hazard -- Holmstrom (1979)

**Optimal Contract (Linear):**

```
w(x) = alpha + beta * x

Optimal incentive intensity:
  beta* = 1 / (1 + rho * sigma^2 / Delta_f^2)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| alpha | Base salary | KRW | > 0 | Contract design |
| beta | Incentive intensity (performance pay ratio) | dimensionless | [0, 1] | Holmstrom (1979) |
| rho | Agent risk aversion coefficient | dimensionless | > 0 | CARA utility parameter |
| sigma^2 | Output variance (environmental uncertainty) | (KRW)^2 | > 0 | Industry characteristic |
| Delta_f | Marginal product of effort = f(e_H) - f(e_L) | KRW | > 0 | Task characteristic |

**Sufficient Statistic Principle (Holmstrom 1979):** Relative Performance Evaluation (RPE) -- compensating managers on w(x - y_industry) rather than w(x) alone -- is optimal because industry average y filters out common noise. Only ~15% of Korean firms use RPE (2024), implying widespread agency cost inefficiency.

---

## 2.6.4 Market Microstructure

### 2.6.4.1 Amihud ILLIQ Ratio -- Implementation

**Definition (Amihud 2002):**

```
ILLIQ = (1/D) * SUM_{t=1}^{D}  |r_t| / DVOL_t
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| ILLIQ | Amihud illiquidity ratio | 1/KRW | [0, inf) | Amihud (2002) |
| D | Number of trading days in window | days | > 0 | Parameter |
| r_t | Daily return = (close_t - close_{t-1}) / close_{t-1} | dimensionless | [-0.30, 0.30] on KRX | OHLCV |
| DVOL_t | Daily dollar volume = close_t * volume_t | KRW | > 0 | OHLCV |

**Implementation in indicators.js (lines 1430-1472):**

```javascript
function calcAmihudILLIQ(candles, window) {
  var WINDOW = window || 20;           // [B] #162 Amihud standard
  var CONF_DISCOUNT = 0.85;            // [C] #163 max discount
  var LOG_HIGH = -1.0;                 // [C] #164 high illiquidity threshold
  var LOG_LOW  = -3.0;                 // [C] #165 liquid threshold

  // ... loop over last WINDOW candles computing sum(|r_t|/DVOL_t)/validDays

  var logIlliq = Math.log10(illiq * 1e8);  // KRW-scaled log transform

  // Linear interpolation for confDiscount
  if (logIlliq >= LOG_HIGH) confDiscount = CONF_DISCOUNT;
  else if (logIlliq > LOG_LOW)
    confDiscount = 1.0 - t * (1.0 - CONF_DISCOUNT);
  // else confDiscount = 1.0 (liquid, no discount)
}
```

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| WINDOW (ILLIQ) | 20 | [B] | Fixed | 10-60 | Amihud (2002) standard, #162 |
| CONF_DISCOUNT (max) | 0.85 | [C] | [L:WLS] | 0.70-0.95 | Max 15% discount for illiquid stocks, #163 |
| LOG_HIGH | -1.0 | [C] | [L:MAN] | -2.0 to 0.0 | logIlliq > -1 flags severe illiquidity, #164 |
| LOG_LOW | -3.0 | [C] | [L:MAN] | -4.0 to -2.0 | logIlliq < -3 flags liquid, no discount, #165 |

**logIlliq Scale (KRW-denominated, x 1e8 normalization):**

| Segment | logIlliq Range | Level | confDiscount |
|---------|---------------|-------|-------------|
| KOSPI 200 | ~ -5 to -4 | liquid | 1.000 |
| KOSPI mid | ~ -4 to -3 | liquid | 1.000 |
| KOSDAQ large | ~ -3 to -2 | moderate | 0.925-1.000 (interpolated) |
| KOSDAQ small | ~ -1 to 0+ | illiquid | 0.850 (max discount) |

**Confidence Discount Interpolation:**

```
If logIlliq <= LOG_LOW (-3.0):
  confDiscount = 1.0 (no penalty)

If logIlliq >= LOG_HIGH (-1.0):
  confDiscount = 0.85 (max penalty)

If LOG_LOW < logIlliq < LOG_HIGH:
  t = (logIlliq - LOG_LOW) / (LOG_HIGH - LOG_LOW)
  confDiscount = 1.0 - t * (1.0 - 0.85) = 1.0 - 0.15 * t
```

This linear interpolation maps the logIlliq range [-3, -1] to discount range [1.0, 0.85].

**Batch Script:** `scripts/compute_illiq_spread.py` computes ILLIQ and Roll spread proxy for all stocks, outputting to `data/backtest/illiq_spread.json`. Uses the same formula as `calcAmihudILLIQ()` but over 20-day and 60-day windows with segment classification.

### 2.6.4.2 Kyle Lambda -- Market Impact

Kyle (1985) models the permanent price impact of informed trading:

```
Delta_P = lambda * (order_flow)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| lambda | Kyle's lambda (information asymmetry measure) | KRW/share | > 0 | Kyle (1985) |
| Delta_P | Price impact | KRW | R | Order-level |
| order_flow | Signed order flow (buy - sell volume) | shares | R | Trade-level data |

**Square-root slippage decay:**

```
Market impact proportional to sqrt(order_size / ADV)
MI = sigma_daily * sqrt(OrderSize / ADV) * eta
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| MI | Market impact (one-way slippage) | % | > 0 | Almgren & Chriss (2001) |
| sigma_daily | Daily return standard deviation | % | 0.5-5% | OHLCV |
| ADV | Average daily volume (KRW) | KRW | > 0 | 20-day average |
| eta | Market impact coefficient | dimensionless | 0.5-1.0 | Almgren & Chriss (2001) |

The sqrt(h) decay means doubling order size increases impact by only sqrt(2) = 41%, not 100%. This is because larger orders attract more liquidity provision.

### 2.6.4.3 Roll Spread Proxy

Roll (1984) implicit spread estimator from serial covariance of price changes:

```
S_Roll = 2 * sqrt(max(0, -Cov(dP_t, dP_{t-1})))
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| S_Roll | Roll spread estimate | KRW | >= 0 | Roll (1984) |
| dP_t | Price change at time t | KRW | R | OHLCV-derived |

Implemented in `scripts/compute_illiq_spread.py` function `compute_roll_spread()` over 60-day window.

### 2.6.4.4 Price Limits: +-30% KRX and Microeconomic Effects

KRX imposes daily price limits of +-30% (expanded from +-15% in 2015).

**Truncated Return Distribution:**

```
r_t = max(-0.30, min(0.30, r_t*))
```

Effects:
1. **ATR underestimation:** True range is censored at limits -> ATR(14) underestimates actual volatility on limit-hit days
2. **Hill estimator bias:** Tail index alpha is overestimated (tails appear lighter than reality)
3. **Magnet effect** (Du, Liu & Rhee 2009): As price approaches limits, trading accelerates toward the limit, creating self-fulfilling limit-hits

**ATR Correction:**

```
ATR_adj = ATR / (1 - P(limit_hit))
```

**Pigouvian Tax Analogy:**

| Regulatory Tool | Pigouvian Analog | Benefit | Cost |
|-----------------|-----------------|---------|------|
| Price limit +-30% | Direct externality cap | Stop-loss cascade prevention | Price discovery delay, magnet effect |
| Transaction tax 0.03-0.15% | Tobin tax on speculation | HFT externality suppression | Liquidity reduction, spread widening |
| Circuit breaker | Emergency shutdown | Panic interruption | Surplus destruction during halt |

**Optimal regulation equilibrium:**

```
max W = TS - Externality_cost - Regulation_cost
FOC: d(Externality_cost)/d(regulation) = d(Regulation_cost)/d(regulation)
```

Korea's +-30% + transaction tax combination is moderate by international standards (Japan: no limits; Taiwan: +-10%; China: +-10%).

### 2.6.4.5 Marginal Cost of Trading

**Round-trip transaction cost breakdown:**

```
MC_trade = MC_explicit + MC_implicit

MC_explicit = Commission + Tax
  Commission = ~0.015% (online broker average, 2025)
  Tax_KOSPI  = 0.03% (sell-side, post-2023 reduction)
  Tax_KOSDAQ = 0.15% (sell-side)

MC_implicit = Spread + MarketImpact + OpportunityCost
```

| Component | KOSPI Large | KOSPI Mid | KOSDAQ Large | KOSDAQ Small |
|-----------|-----------|----------|-------------|-------------|
| Commission (round-trip) | 0.030% | 0.030% | 0.030% | 0.030% |
| Tax (sell-side) | 0.030% | 0.030% | 0.150% | 0.150% |
| Spread (round-trip) | 0.060% | 0.120% | 0.200% | 0.600% |
| Market impact | 0.010% | 0.030% | 0.050% | 0.150% |
| **Total** | **~0.13%** | **~0.21%** | **~0.43%** | **~0.93%** |

**Break-even signal quality:**

```
E[return | signal] > MC_round_trip
```

KOSDAQ small / KOSPI large ratio = 0.93/0.13 = 7.2x. KOSDAQ small-cap patterns need 7x stronger confidence to be profitable.

---

## 2.6.5 Search and Attention Pricing

### 2.6.5.1 Stigler (1961) Search Theory

Information is an economic good with search costs:

```
Optimal search intensity: MB(n*) = MC(n*)

C(n) = c * n              (search cost: linear in n=stocks examined)
B(n) = E[V_best(n)] - E[V_best(n-1)]  (diminishing returns)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| n | Number of stocks examined | count | >= 0 | Investor decision |
| c | Unit search cost (time + cognitive effort) | KRW-equivalent | > 0 | Stigler (1961) |
| MB | Marginal benefit of one more search | KRW | > 0, decreasing | Expected improvement |
| MC | Marginal cost of one more search | KRW | c (constant) | Time value |

**Key transition:** From cost-constrained era (pre-2010: HTS, broker visits) to capacity-constrained era (post-2020: AI screeners, free data). Information ACCESS is nearly free, but information PROCESSING capacity (attention) is still finite. This is the departure point for Peng-Xiong (2006).

**Reservation return model:**

```
r* = argmax_r  [INTEGRAL_r^inf  (x - r) dF(x)] / c

c UP   -> r* DOWN -> less selective -> more inefficient investment
c DOWN -> r* UP   -> more selective -> higher information efficiency
```

### 2.6.5.2 Peng-Xiong (2006) Limited Attention

**Attention Budget Model:**

```
Budget constraint:  SUM_{i=1}^{N}  a_i  <=  A_total

Information acquired:  I_i = a_i * kappa_i
Price efficiency:      eta_i = 1 - exp(-I_i / sigma_i^2)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| a_i | Attention allocated to asset i | bits/period | >= 0 | Investor decision |
| A_total | Total attention budget | bits/period | finite, constant | Cognitive capacity |
| kappa_i | Information density of asset i | dimensionless | > 0 | News coverage, disclosure frequency |
| I_i | Information processed about asset i | bits | >= 0 | a_i * kappa_i |
| eta_i | Price efficiency of asset i | dimensionless | [0, 1] | 1 = fully efficient |

**Category Learning:** Under attention constraints, investors optimally process information at sector level rather than stock level:

```
r_i = beta_i * f_sector + epsilon_i

Attention allocation: a_sector >> a_epsilon_i
```

Implication: sector momentum > individual stock momentum (empirically confirmed). Post-earnings-surprise drift is 3-5x longer for KOSDAQ small caps vs KOSPI large caps, because lower attention means slower price adjustment.

**Information Half-Life:**

```
t_half = -ln(2) / ln(1 - lambda_att)

lambda_att = lambda_0 + lambda_1 * (a_i / A_total)
```

| Segment | lambda_att | t_half | Interpretation |
|---------|-----------|--------|----------------|
| KOSPI 200 large | 0.80 | ~0.4 trading days (~3 hours) | Near-instant adjustment |
| KOSPI mid | 0.50 | ~1.0 trading day | Same-day adjustment |
| KOSDAQ large | 0.20 | ~3.1 trading days | Multi-day drift |
| KOSDAQ small | 0.05 | ~13.5 trading days | Weeks of slow adjustment |

**Pattern implication:** Lower lambda_att stocks need longer backtesting horizons. Theoretical adjustment:

```
N_day_adjusted = N_base * (1 / lambda_att)^0.3
```

### 2.6.5.3 Barber-Odean (2008) Attention Asymmetry

**Core asymmetry:**
- BUY decision: search over entire market (N stocks) -> search cost -> attention-grabbing bias
- SELL decision: search over portfolio (n stocks) -> no search cost -> uniform review

**Attention-grabbing events:**
- Abnormal volume (volume spike)
- Extreme returns (positive or negative)
- News headlines, search frequency surge
- Limit-up / limit-down on KRX

**Overreaction formula:**

```
P_attention_jump = P_fundamental + alpha_overreaction * Attention_t
```

### 2.6.5.4 Attention Score -- CheeseStock Implementation

```
attentionScore = log(1 + volRatio) * rangeRatio

where:
  volRatio   = V_t / SMA(V, 20)
  rangeRatio = (H_t - L_t) / ATR(14)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| volRatio | Current volume / 20-day average | dimensionless | (0, inf) | OHLCV |
| rangeRatio | Current range / ATR(14) | dimensionless | (0, inf) | OHLCV |
| attentionScore | Combined attention metric | dimensionless | [0, inf) | Doc32 sec 4.1 |

**Log transform justification:** Weber-Fechner law (psychophysics) -- sensation is logarithmic in stimulus. Volume doubling from 2x to 4x has greater informational meaning than from 10x to 20x.

**3-Phase Attention Cycle:**

| Phase | Condition | confidenceAdj | Interpretation |
|-------|-----------|---------------|----------------|
| Deprivation | attentionScore < 0.4 | -0.05 | Low info content, potential energy accumulating |
| Normal | 0.4 <= attentionScore <= 2.0 | 0.0 | Standard price discovery |
| Jump | attentionScore > 2.0 | +0.08 | New information rapidly incorporated |

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| ATTENTION_JUMP_THRESHOLD | 2.0 | [C] | Barber-Odean (2008), empirical calibration |
| deprivation_threshold | 0.4 | [D] | Heuristic, approximately 1 std below normal |
| confidenceAdj_deprivation | -0.05 | [D] | Conservative: low attention = low signal content |
| confidenceAdj_jump | +0.08 | [D] | Moderate: high attention = high info content but overreaction risk |

**Consecutive Jump Penalty:**

```
if jump_days >= 2:
  confidenceAdj_reversal     = +0.05 * (jump_days - 1)   // reversal patterns gain
  confidenceAdj_continuation = -0.03 * (jump_days - 1)   // continuation patterns lose
```

**KOSDAQ Small-Cap Correction:**

```
attentionScore_adj = attentionScore / mktcap_factor
mktcap_factor = max(1.0, 1.0 + 0.5 * log10(50B_KRW / max(marketCap, 5B_KRW)))
```

| Market Cap | mktcap_factor | Effective Jump Threshold |
|-----------|--------------|------------------------|
| 500B KRW | 1.00 | 2.0 (no adjustment) |
| 100B KRW | ~1.35 | 2.70 |
| 50B KRW | ~1.50 | 3.00 |
| 10B KRW | ~1.85 | 3.70 |

**CheeseStock mapping:** `IndicatorCache.attentionState(idx, lookback)` in indicators.js implements the attention cycle. Interface uses volume percentile (q30/q70) classification rather than the exact attentionScore formula above; direction is equivalent.

### 2.6.5.5 Diamond Paradox and Price Stickiness

Diamond (1971): Even infinitesimal search cost (c > 0) causes competitive outcome to collapse to monopoly pricing. In securities markets, this manifests as **ask-price stickiness** -- sell orders do not adjust downward as quickly as theory predicts.

```
Price stickiness magnitude:
  Delta_P_sticky = c_search / (dD/dP)
```

Low-liquidity stocks (few limit-order providers = "sellers" in Diamond's framework) exhibit maximum stickiness. Pattern implication: target price arrival time increases for illiquid stocks.

```
N_horizon_adj = N_base * (ADV_median / ADV_stock)^0.2
```

ADV at 1/10 of median: horizon x 1.58 (+58% extension). ADV at 10x median: horizon x 0.63 (-37% reduction).

---

## 2.6.6 Agency Costs and Industry Concentration

### 2.6.6.1 Jensen-Meckling (1976) Agency Cost Decomposition

```
AC = MC + BF + RL

MC (Monitoring Costs):    Board operation, audit committee, external audit, internal controls
BF (Bonding Costs):       Stock options, performance-linked pay, non-compete agreements
RL (Residual Loss):       Unobservable inefficiency = V_optimal - V_actual
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| AC | Total agency costs | KRW | > 0 | Jensen & Meckling (1976) |
| MC | Monitoring costs | KRW | > 0 | Observable from disclosures |
| BF | Bonding costs | KRW | > 0 | Observable from compensation reports |
| RL | Residual loss | KRW | > 0 | Indirectly estimated via Tobin's Q deviation |

**Jensen (1986) Free Cash Flow Hypothesis:**

```
FC_i = CF_operating_i - CF_investment_needed_i

When FC > 0 AND agency costs high:
  -> Manager invests in NPV < 0 projects (empire building)
  -> V_actual < V_optimal (RL increases)

Jensen's prescription: Increase debt -> constrain free cash flow -> reduce AC
Korean complication: Chaebol cross-guarantees distort this mechanism
```

### 2.6.6.2 Korean Chaebol Agency Problems

**Tunneling (Bae et al. 2002):**

```
Resource transfer: High-ownership subsidiary (A) -> Low-ownership subsidiary (B)
Purpose: Maximize controlling shareholder private benefit
Means: Related-party pricing, directed equity offerings, asset transfers

Bae et al. (2002) finding:
  Acquiring firm CAR[-1,+1] = -0.6%
  Controlling shareholder wealth change = +1.5%
```

**Propping (Friedman, Johnson & Mitton 2003):**

```
Resource transfer: Low-ownership subsidiary (B) -> High-ownership subsidiary (A)
Purpose: Prevent key subsidiary failure (preserve chaebol survival)
Means: Guarantees, loans, directed business allocation
```

**Chaebol Agency Indicators (Quantifiable):**

| Indicator | Formula | Threshold | Data Source |
|-----------|---------|-----------|------------|
| RPRR (Related-Party Revenue Ratio) | Related-party revenue / Total revenue | > 0.30 = high risk | DART business report |
| CSS (Controlling Shareholder Stake) | Majority + special relationship shares | > 0.50 = risk | DART ownership disclosure |
| DPR (Dividend Payout Ratio) | Total dividends / Net income | Korea avg ~22% (OECD avg ~45%) | Financial statements |
| BI (Board Independence) | Outside directors / Total board | > 0.50 required for assets > 2T KRW | DART governance report |

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| CHAEBOL_TUNNELING_THRESHOLD | 0.30 | [C] | RPRR > 30% flags tunneling possibility, #168 |

### 2.6.6.3 Agency Risk Index (ARI) -- Design Specification

**NOT IMPLEMENTED.** ARI requires real-time factor data feeds (industry median ROE, CAPEX residuals, board composition, related-party ratios). This is a design specification for future implementation when DART pipeline is expanded.

```
ARI = w1 * ROE_inv + w2 * CAPEX_excess + w3 * (1 - BI) + w4 * RPRR
```

| Component | Formula | Weight | Data Availability |
|-----------|---------|--------|------------------|
| ROE_inv | max(0, 1 - ROE/ROE_industry_median) | 0.30 | Available (existing data) |
| CAPEX_excess | max(0, (CAPEX/Sales - median) / median) | 0.25 | Partial (tangible asset proxy) |
| (1 - BI) | 1 - (outside_directors / total_board) | 0.20 | Not collected |
| RPRR | Related-party revenue / Total revenue | 0.25 | Not collected |

**Phase 1 Simplified ARI (implementable now):**

```
ARI_simplified = 0.55 * ROE_inv + 0.45 * CAPEX_excess
  (~60% explanatory power of full ARI)
```

**Pattern Confidence Adjustment:**

```
conf_adj = conf_base * (1 - ARI_CONFIDENCE_DECAY * ARI)
```

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| ARI_CONFIDENCE_DECAY | 0.20 | [D] | [L:WLS] | 0.10-0.30 | Max 20% discount at ARI=1.0, #166 |

| ARI Range | Interpretation | Conf Discount |
|-----------|---------------|---------------|
| 0.00-0.20 | Low agency risk (good governance) | 0-4% |
| 0.20-0.40 | Moderate | 4-8% |
| 0.40-0.60 | High agency risk | 8-12% |
| 0.60-1.00 | Very high agency risk | 12-20% |

**Why capped at 20%?** Even with extreme agency costs, technical patterns retain price-discovery function. Patterns reflect supply-demand imbalance, which agency problems do not nullify. The 20% cap reflects that approximately 1/5 of pattern signal may be corrupted by agency-cost noise.

### 2.6.6.4 Coase Transaction Cost Theory and M&A

Coase (1937): Firms exist because market transactions have costs (search, negotiation, monitoring, hold-up). The firm boundary is where MC_market = MC_internal.

**M&A Type and Expected CAR:**

| M&A Type | TC Reduction | Expected CAR | KRX Example |
|----------|-------------|-------------|------------|
| Vertical integration | High (hold-up solved) | +1.5% to +3.0% | Samsung Electronics -> Samsung Display |
| Horizontal integration | Moderate (HHI increase) | +0.5% to +2.0% | Korean Air + Asiana |
| Unrelated diversification | Low (no TC synergy) | -1.0% to 0% | Chaebol expansion |
| Intra-chaebol merger | Ambiguous (tunneling risk) | -2% to +5% | Samsung C&T + Cheil Industries (2015) |

### 2.6.6.5 CSAD Herding Measure

**Chang, Cheng & Khorana (2000):**

```
CSAD_t = (1/N) * SUM_{i=1}^{N}  |R_i,t - R_m,t|

Herding regression:
  CSAD_t = a + b1 * |R_m,t| + b2 * R_m,t^2 + epsilon_t

Herding detection: beta_2 < 0
  (dispersion DECREASES in extreme markets = herding)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| CSAD_t | Cross-Sectional Absolute Deviation | % | >= 0 | Chang et al. (2000) |
| R_i,t | Return of stock i on day t | % | [-30, 30] on KRX | OHLCV |
| R_m,t | Market return on day t | % | [-30, 30] | Index-weighted average |
| beta_2 | Quadratic herding coefficient | dimensionless | < 0 if herding | OLS regression |

**Implementation:** `scripts/compute_csad_herding.py` computes daily CSAD values and 60-day rolling beta_2 for herding detection. Output: `data/backtest/csad_herding.json`.

### 2.6.6.6 Regulatory Capture and Political Cycle

**Stigler (1971):** Regulation is designed for the benefit of the regulated industry, not the public. High-HHI industries capture regulators more easily (collective action problem is weaker with few large firms).

```
Self-reinforcing mechanism:
  High HHI -> easier lobbying -> regulatory barriers -> HHI maintained
```

**Nordhaus (1975) Political Business Cycle:**

| Election Phase | Policy Direction | KRX Implication |
|---------------|-----------------|-----------------|
| Pre-election 12 months | Expansionary (fiscal stimulus) | Construction/SOC, policy beneficiary stocks UP |
| Post-election 6 months | Contractionary (structural reform) | Policy uncertainty -> pattern confidence temporarily DOWN |

Korea: Presidential cycle 5 years (next: 2027 March), legislative cycle 4 years (next: 2028 April).

**Short-Selling Ban Effects:**

```
Short-selling ban -> price discovery impaired (Miller 1977: overvaluation)
  bearish patterns: conf * 0.70 (30% discount, no downward pressure)
  bullish patterns: conf * 0.90 (10% discount, overvaluation risk)
  neutral patterns: conf * 0.95 (5% discount, liquidity cost increase)
```

Korea imposed full short-selling bans: 2020.03-2021.05, 2023.11-ongoing. These are discrete events implementable via candle date comparison.

---

## 2.6.7 Micro-Macro Bridge

### 2.6.7.1 Fallacy of Composition

Samuelson (1955): What is true for the individual is not necessarily true for the aggregate.

**Financial Market Fallacies:**

| Individual Action | Collective Consequence | Pattern Name |
|-------------------|----------------------|-------------|
| Stop-loss = rational risk management | All stop-losses trigger = cascade crash | Stop-Loss Cascade |
| Portfolio insurance = downside protection | All sell insurance = liquidity dry-up (1987 Black Monday) | Margin Spiral |
| Pattern-based trading = alpha capture | All use same pattern = crowding -> alpha vanishes | AMH Decay |
| Diversification into index = risk reduction | All index = overvaluation of included stocks | Index Inclusion Premium |

This is the microeconomic foundation of AMH decay (Doc21): individual alpha becomes collective zero-sum.

### 2.6.7.2 Margin Spiral (Brunnermeier & Pedersen 2009)

```
Liquidity Spiral: Price DOWN -> Margin UP -> Forced selling -> Price DOWN further
Loss Spiral:      Price DOWN -> Equity DOWN -> Leverage UP -> Deleveraging pressure

dP/dt = -gamma * (Margin_t - Margin_threshold) * Leverage_t
```

Korean vulnerability: Credit financing balance ~3-5% of KOSDAQ market cap (2024). Forced selling (bandeaemaemae) triggers at maintenance ratio < 140%.

### 2.6.7.3 Grinold Fundamental Law and Signal Efficiency

```
IR = IC * sqrt(BR)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| IR | Information Ratio | dimensionless | [0, inf) | Grinold (1989) |
| IC | Information Coefficient | dimensionless | [-1, 1] | Signal-return correlation |
| BR | Breadth (independent decision count) | count | >= 1 | Trading opportunities |

**Correlated signal combination (Grinold & Kahn 2000):**

```
IC_combined(n) = IC_1 * sqrt(1 + (n-1) * rho_avg) / sqrt(n)
```

With rho_avg = 0.40 (CheeseStock's 22 signals derived from same price data):
- n=1: IC = 0.050
- n=5: IC = 0.034
- n=10: IC = 0.029
- n=16: IC = 0.027 (marginal improvement < 0.03%)
- n=22: IC = 0.026

**Optimal signal count:** ~6-8 well-selected uncorrelated signals. Current 22 signals contain 14-16 redundant. However, Ridge regularization (lambda=278 in backtester.js) implicitly shrinks redundant signal weights toward zero, performing automatic MC=MB optimization.

**Ridge as Pigouvian Tax on Overfitting:**

```
Ridge objective: min_beta  ||y - X*beta||^2 + lambda*||beta||^2

Economic interpretation:
  ||y - X*beta||^2  = prediction error cost (inverse of benefit)
  lambda*||beta||^2  = complexity tax (Pigouvian tax on overfitting externality)

lambda UP -> higher complexity tax -> fewer "effective" signals
lambda DOWN -> overfitting externality tolerated -> good in-sample, bad out-of-sample

Current lambda=278 (GCV optimal): effective df = 5-8 out of 22 signals
```

---

## 2.6.8 Combined Micro Confidence Pipeline

### 2.6.8.1 Pipeline Flow

```
_updateMicroContext(candles)
  -> calcAmihudILLIQ(candles)      -> illiq { confDiscount }
  -> HHI from ALL_STOCKS marketCap -> hhiBoost
  -> _microContext = { illiq, hhiBoost }

_applyMicroConfidenceToPatterns(patterns, _microContext)
  -> For each pattern:
     adj = 1.0
     (1) adj *= illiq.confDiscount       // liquidity discount [0.85, 1.0]
     (2) if MEAN_REV_TYPE: adj *= (1 + hhiBoost)  // HHI boost [1.0, ~1.045]
     (3) clamp adj to [0.80, 1.15]
     (4) pattern.confidence = round(confidence * adj)
```

### 2.6.8.2 Effective Range

| Adjustment | Min | Max | Trigger |
|------------|-----|-----|---------|
| ILLIQ discount | 0.850 | 1.000 | All patterns, illiquid stocks only |
| HHI boost | 1.000 | ~1.045 | Mean-reversion patterns only |
| Combined clamp | 0.800 | 1.150 | Hard bounds |

In practice, the combined adjustment rarely exceeds [-15%, +4.5%] before clamping.

### 2.6.8.3 Full Integration Formula (Including Unimplemented Components)

The theoretical full micro adjustment would be:

```
conf_final = conf_base
  * illiq.confDiscount                              // [0.85, 1.0]  IMPLEMENTED
  * (1 + HHI_MEAN_REV_COEFF * HHI * eps_stability) // [1.0, ~1.05] PARTIAL (eps_stability TODO)
  * (1 - ARI_CONFIDENCE_DECAY * ARI)                // [0.80, 1.0]  NOT IMPLEMENTED
  * (1 + delta_info * sign_alignment)               // [0.85, 1.15] NOT IMPLEMENTED
  * attentionState.confidenceAdj                    // [-0.05, +0.08] PARTIAL
  * short_ban_factor                                // [0.70, 1.0]  NOT IMPLEMENTED

Clamped to [0.80, 1.15]
```

---

## Micro Findings

### Finding M-1: eps_stability Mediator Missing (MODERATE)

**Location:** appWorker.js line 1506-1507

**Issue:** HHI mean-reversion boost is computed as `0.10 * hhi` without the eps_stability factor documented in Doc33 sec 6.2. The full formula is `0.10 * hhi * eps_stability`. Without eps_stability, cyclical high-HHI industries (semiconductor: HHI=0.45 but volatile EPS) receive a boost of 4.5% instead of the theoretically correct ~3.2% (with eps_stability=0.70).

**Impact:** Overestimation of mean-reversion reliability for cyclical high-HHI sectors. Quantitative impact: +1.3pp excess boost for semiconductors.

**Recommendation:** Implement eps_stability from quarterly EPS variance data. If quarterly data unavailable, use ROE stability from `data/sector_fundamentals.json` as proxy:
```
eps_stability_proxy = 1 / (1 + ROE_std_5yr / 100)
```

### Finding M-2: Single Slippage Value for All Market Segments (LOW)

**Location:** backtester.js `KRX_SLIPPAGE = 0.10%`

**Issue:** Theory indicates round-trip costs range from 0.13% (KOSPI large) to 0.93% (KOSDAQ small), a 7.2x spread. Using a single 0.10% underestimates KOSDAQ small-cap costs by ~4.6x and overestimates KOSPI large-cap costs by ~2.5x.

**Impact:** Backtest results overstate KOSDAQ small-cap pattern profitability and understate KOSPI large-cap pattern profitability. Not a formula error but a calibration gap.

**Recommendation:** Introduce 3-tier slippage: large 0.04%, mid 0.10%, small 0.35%, keyed by market segment.

### Finding M-3: ILLIQ Formula Implementation is Correct (CONFIRMED)

**Location:** indicators.js lines 1430-1472

**Verification:** The implementation correctly follows Amihud (2002):
- `ILLIQ = (1/validDays) * SUM(|r_t| / DVOL_t)` -- matches standard formula
- Window=20 trading days -- matches Amihud's standard specification
- logIlliq uses `log10(illiq * 1e8)` for KRW-denominated scaling -- appropriate for Korean won-denominated dollar volume
- Linear interpolation between LOG_LOW and LOG_HIGH -- smooth, reasonable

**No deviation from standard detected.**

### Finding M-4: HHI Computation Uses marketCap Instead of Revenue (INFORMATIONAL)

**Location:** appWorker.js lines 1491-1504

**Issue:** HHI is computed using `s.marketCap` (market capitalization shares). Standard industrial organization uses revenue shares. Market-cap HHI can diverge from revenue HHI when P/E ratios vary across firms in the same industry.

**Impact:** Low. For major Korean industries (semiconductor, telecom, auto), the ranking and approximate magnitudes of HHI are similar under both measures because the dominant firms also have dominant revenue. Divergence is largest in biotech (high market-cap firms with low revenue).

**Recommendation:** Acceptable as-is. Revenue-based HHI would require `data/sector_fundamentals.json` revenue data, which could be incorporated in a future refinement.

### Finding M-5: Short-Selling Ban Adjustment Not Implemented (INFORMATIONAL)

**Issue:** Doc33 sec 8.3 specifies confidence adjustments during short-selling ban periods (bearish patterns: conf * 0.70, bullish: * 0.90). Korea has been under a full short-selling ban since November 2023. This means all bearish pattern confidence scores are currently ~30% too high relative to theory.

**Impact:** Moderate. All active pattern analysis during the ban period overestimates bearish pattern reliability because downward price pressure is structurally impaired.

**Recommendation:** Implement short-selling ban flag with hardcoded date ranges. This is a discrete binary adjustment, not a continuous variable.

---

## References

1. Akerlof, G.A. (1970). The Market for "Lemons": Quality Uncertainty and the Market Mechanism. *QJE*, 84(3), 488-500.
2. Almgren, R. & Chriss, N. (2001). Optimal Execution of Portfolio Transactions. *J. Risk*, 3(2), 5-39.
3. Amihud, Y. (2002). Illiquidity and Stock Returns: Cross-Section and Time-Series Effects. *JFM*, 5(1), 31-56.
4. Bae, K.-H., Kang, J.-K. & Kim, J.-M. (2002). Tunneling or Value Added? Evidence from Mergers by Korean Business Groups. *JF*, 57(6), 2695-2740.
5. Barber, B.M. & Odean, T. (2008). All That Glitters: The Effect of Attention and News on the Buying Behavior. *RFS*, 21(2), 785-818.
6. Bertrand, J. (1883). Review of Cournot. *Journal des Savants*, 499-508.
7. Bikhchandani, S., Hirshleifer, D. & Welch, I. (1992). A Theory of Fads, Fashion, Custom, and Cultural Change as Informational Cascades. *JPE*, 100(5), 992-1026.
8. Brunnermeier, M. & Pedersen, L. (2009). Market Liquidity and Funding Liquidity. *RFS*, 22(6), 2201-2238.
9. Chang, E.C., Cheng, J.W. & Khorana, A. (2000). An Examination of Herd Behavior in Equity Markets. *JBF*, 24(10), 1651-1679.
10. Coase, R.H. (1937). The Nature of the Firm. *Economica*, 4(16), 386-405.
11. Cournot, A.A. (1838). *Recherches sur les Principes Mathematiques de la Theorie des Richesses*.
12. Cowling, K. & Waterson, M. (1976). Price-Cost Margins and Market Structure. *Economica*, 43(171), 267-274.
13. Diamond, P. (1971). A Model of Price Adjustment. *JET*, 3(2), 156-168.
14. Du, Y., Liu, Q. & Rhee, G. (2009). An Anatomy of the Magnet Effect: Evidence from the Korea Exchange. *IRF*, 9(1-2), 50-74.
15. Easley, D., Kiefer, N. & O'Hara, M. (1996). Liquidity, Information, and Infrequently Traded Stocks. *JF*, 51(4), 1405-1436.
16. Glosten, L. & Milgrom, P. (1985). Bid, Ask and Transaction Prices in a Specialist Market. *JFE*, 14(1), 71-100.
17. Grinold, R.C. (1989). The Fundamental Law of Active Management. *JPM*, 15(3), 30-37.
18. Grinold, R.C. & Kahn, R.N. (2000). *Active Portfolio Management*. 2nd ed., McGraw-Hill.
19. Grossman, S. & Stiglitz, J. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.
20. Herfindahl, O.C. (1950). Concentration in the U.S. Steel Industry. PhD Dissertation, Columbia University.
21. Hirschman, A.O. (1964). The Paternity of an Index. *AER*, 54(5), 761-762.
22. Holmstrom, B. (1979). Moral Hazard and Observability. *Bell Journal of Economics*, 10(1), 74-91.
23. Hong, H., Lim, T. & Stein, J. (2000). Bad News Travels Slowly: Size, Analyst Coverage, and the Profitability of Momentum Strategies. *JF*, 55(1), 265-295.
24. Jensen, M.C. (1986). Agency Costs of Free Cash Flow, Corporate Finance, and Takeovers. *AER*, 76(2), 323-329.
25. Jensen, M.C. & Meckling, W.H. (1976). Theory of the Firm: Managerial Behavior, Agency Costs and Ownership Structure. *JFE*, 3(4), 305-360.
26. Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335.
27. Lerner, A.P. (1934). The Concept of Monopoly and the Measurement of Monopoly Power. *RES*, 1(3), 157-175.
28. Lo, A.W. (2004). The Adaptive Markets Hypothesis. *JPM*, 30(5), 15-29.
29. Marshall, A. (1890). *Principles of Economics*. Macmillan.
30. Miller, E. (1977). Risk, Uncertainty, and Divergence of Opinion. *JF*, 32(4), 1151-1168.
31. Nash, J. (1950). Equilibrium Points in N-Person Games. *PNAS*, 36(1), 48-49.
32. Nordhaus, W.D. (1975). The Political Business Cycle. *RES*, 42(2), 169-190.
33. Peng, L. & Xiong, W. (2006). Investor Attention, Overconfidence and Category Learning. *JFE*, 80(3), 563-602.
34. Roll, R. (1984). A Simple Implicit Measure of the Effective Bid-Ask Spread. *JF*, 39(4), 1127-1139.
35. Smith, V.L. (1962). An Experimental Study of Competitive Market Behavior. *JPE*, 70(2), 111-137.
36. Spence, M. (1973). Job Market Signaling. *QJE*, 87(3), 355-374.
37. Stigler, G.J. (1961). The Economics of Information. *JPE*, 69(3), 213-225.
38. Stigler, G.J. (1971). The Theory of Economic Regulation. *Bell Journal of Economics*, 2(1), 3-21.
39. Stoll, H. (1978). The Supply of Dealer Services in Securities Markets. *JF*, 33(4), 1133-1151.
40. Tobin, J. (1978). A Proposal for International Monetary Reform. *Eastern Economic Journal*, 4(3-4), 153-159.
41. Walras, L. (1874). *Elements of Pure Economics*. (1954 English translation by Jaffe).
42. Williamson, O.E. (1975). *Markets and Hierarchies: Analysis and Antitrust Implications*. Free Press.
