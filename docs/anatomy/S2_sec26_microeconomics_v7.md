# Section 2.6: Microeconomic Foundations -- V7

> Stage 2 -- ANATOMY V7, CheeseStock KRX Live Chart
> Author: Microeconomics Analyst Agent
> Date: 2026-04-06
> Supersedes: S2_sec26_microeconomics.md (V5, 1,241 lines)

---

## Revision Summary (V5 -> V6)

| Change | Detail |
|--------|--------|
| Added MIC-1 through MIC-10 CFA-grade formula annotations | Full symbol tables, constant grades, data-path traces |
| [CORRECTED] HHI thresholds now carry academic citations | DOJ Horizontal Merger Guidelines (2010 rev.) |
| [CORRECTED] HHI computation basis documented as marketCap (not revenue) with divergence note |
| Added complete ILLIQ data-path trace: OHLCV -> compute_illiq_spread.py -> JSON -> JS loader -> micro confidence |
| Added MIC-9 KRX magnet effect and MIC-10 slippage square-root law as new formulas |
| Added Finding M-6 (adaptive slippage already implemented in backtester.js) |
| Expanded constant grades to include E-grade deprecated entries |

---

## Overview

This section documents the microeconomic theory underlying CheeseStock's **micro confidence adjustments** and **market structure analysis**. The system's `_applyMicroConfidenceToPatterns()` pipeline (appWorker.js lines 1523-1556) applies two distinct micro adjustments to detected pattern confidence scores: (1) Amihud ILLIQ liquidity discount and (2) HHI mean-reversion boost. These adjustments are grounded in six pillars of microeconomic theory, each documented below with CFA-grade formula annotations.

**Theory-to-Code Map:**

| Pillar | Core Theory | Code Entry Point | Status |
|--------|-------------|------------------|--------|
| 2.6.1 Value-Price-Equilibrium | Marshall, Walras, Grossman-Stiglitz | chart.js candle rendering, api.js order model | Conceptual |
| 2.6.2 Market Structure | Cournot, Bertrand, HHI | appWorker.js `_updateMicroContext()` HHI calc | **Implemented** |
| 2.6.3 Information Asymmetry | Akerlof, Spence, Kyle | indicators.js `calcAmihudILLIQ()` | **Implemented** |
| 2.6.4 Market Microstructure | Amihud, Kyle lambda, Roll | appWorker.js ILLIQ confDiscount, backtester.js adaptive slippage | **Implemented** |
| 2.6.5 Search and Attention | Stigler, Peng-Xiong, Barber-Odean | indicators.js attentionState (IndicatorCache) | Partial |
| 2.6.6 Agency Costs | Jensen-Meckling, Holmstrom | Design spec only (ARI not implemented) | Design |

**Pipeline Position:** Micro confidence runs after macro confidence (`_applyMacroConfidenceToPatterns`) and before derivatives confidence (`_applyDerivativesConfidenceToPatterns`). Clamp range is [0.80, 1.15], narrower than macro's range, reflecting the principle that micro factors are second-order corrections.

---

## MIC-1: Amihud ILLIQ Ratio

### Formula

```
ILLIQ = (1/D) * SUM_{t=1}^{D} |r_t| / DVOL_t
```

**Source:** Amihud, Y. (2002). Illiquidity and Stock Returns: Cross-Section and Time-Series Effects. *Journal of Financial Markets*, 5(1), 31-56.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| ILLIQ | Amihud illiquidity ratio | 1/KRW | [0, inf) | Computed |
| D | Number of trading days in window | days | > 0 | Parameter (default 20) |
| r_t | Daily return = (close_t - close_{t-1}) / close_{t-1} | dimensionless | [-0.30, 0.30] on KRX | OHLCV |
| DVOL_t | Daily dollar volume = close_t x volume_t | KRW | > 0 | OHLCV |

### Constants Table

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| WINDOW | 20 | [B] | Fixed | 10-60 | Amihud (2002) standard specification; 20 trading days = 1 calendar month. #162 |
| CONF_DISCOUNT (max) | 0.85 | [C] | [L:WLS] | 0.70-0.95 | Maximum 15% discount for illiquid stocks. Calibrated to KRX KOSDAQ small-cap spread of 0.25-0.80%. #163 |
| LOG_HIGH | -1.0 | [C] | [L:MAN] | -2.0 to 0.0 | logIlliq > -1 flags severe illiquidity (KOSDAQ micro-cap territory). #164 |
| LOG_LOW | -3.0 | [C] | [L:MAN] | -4.0 to -2.0 | logIlliq < -3 flags liquid (KOSPI mid-cap or larger). #165 |

**Grade justification:**
- WINDOW = 20 is **[B] Academic range** because Amihud (2002) uses 20 days as the standard, with 60 days as a robustness check. Not [A] because shorter/longer windows are valid alternatives.
- CONF_DISCOUNT, LOG_HIGH, LOG_LOW are **[C] Calibratable** because their optimal values depend on KRX market microstructure, which evolves with tick-size reforms, short-selling regulations, and market participant composition.

### System Mapping: Complete Data Path

```
OHLCV daily candles
  |
  +--[OFFLINE PATH]---> scripts/compute_illiq_spread.py
  |                       compute_illiq(candles, window=20)
  |                       => sum(|r_t|/dvol_t) / count
  |                       => illiq_scaled = illiq_20 * 1e6  (per-million-KRW readability)
  |                       => Segment classification: kospi_large/kospi_mid/kosdaq_large/kosdaq_small
  |                       => OUTPUT: data/backtest/illiq_spread.json
  |                       => CONSUMER: backtester.js _getAdaptiveSlippage(code)
  |
  +--[RUNTIME PATH]---> indicators.js calcAmihudILLIQ(candles, window)
                          => sum(|r_t|/dvol_t) / validDays   (identical formula)
                          => logIlliq = log10(illiq * 1e8)    (KRW-scaled log transform)
                          => level classification: 'liquid' / 'moderate' / 'illiquid'
                          => confDiscount: linear interpolation [1.0, 0.85]
                          => CONSUMER: appWorker.js _updateMicroContext()
                                        _microContext.illiq = calcAmihudILLIQ result
                                        _applyMicroConfidenceToPatterns() applies confDiscount
```

**Dual-path note:** The ILLIQ measure is computed in two independent paths. The offline path (`compute_illiq_spread.py`) pre-computes ILLIQ for all stocks and stores segment classifications in JSON, used by `backtester.js` for adaptive slippage. The runtime path (`calcAmihudILLIQ()`) computes ILLIQ on-the-fly for the currently selected stock, used by `_applyMicroConfidenceToPatterns()` for confidence adjustment. Both paths use identical formulas.

### logIlliq Scale (KRW-denominated, x 1e8 normalization)

| Segment | logIlliq Range | Level | confDiscount |
|---------|---------------|-------|-------------|
| KOSPI 200 large | ~ -5 to -4 | liquid | 1.000 |
| KOSPI mid | ~ -4 to -3 | liquid | 1.000 |
| KOSDAQ large | ~ -3 to -2 | moderate | 0.925-1.000 (interpolated) |
| KOSDAQ small | ~ -1 to 0+ | illiquid | 0.850 (max discount) |

### Confidence Discount Interpolation

```
If logIlliq <= LOG_LOW (-3.0):
  confDiscount = 1.0                    (no penalty -- liquid stock)

If logIlliq >= LOG_HIGH (-1.0):
  confDiscount = CONF_DISCOUNT = 0.85   (max penalty -- illiquid stock)

If LOG_LOW < logIlliq < LOG_HIGH:
  t = (logIlliq - LOG_LOW) / (LOG_HIGH - LOG_LOW)
  confDiscount = 1.0 - t * (1.0 - CONF_DISCOUNT)
               = 1.0 - 0.15 * t
```

This linear interpolation maps logIlliq in [-3, -1] to confDiscount in [1.0, 0.85].

### Edge Cases

1. **Zero volume days:** `if dvol > 0` guard in both implementations. Days with zero volume are skipped (not counted in D).
2. **Insufficient data:** `if validDays < 10` in JS, `if len(candles) < window + 1` in Python. Returns null/None.
3. **KRX price limit truncation:** ILLIQ uses |r_t| which is censored at 0.30 on KRX. This causes ILLIQ to be *understated* on limit-hit days because the true |r_t*| exceeds 0.30. The effect is small (limit hits are rare events).
4. **Source guard:** Python `compute_illiq_spread.py` rejects `source in ('sample', 'seed', 'demo')` data. JS `calcAmihudILLIQ()` does not have this guard but receives candles from `dataService.getCandles()` which already performs source filtering.

### Implementation Verification: CONFIRMED

The implementation in `indicators.js` lines 1430-1472 correctly follows Amihud (2002):
- Formula: `ILLIQ = (1/validDays) * SUM(|r_t| / DVOL_t)` -- matches standard
- Window: 20 trading days -- matches Amihud specification
- logIlliq: `log10(illiq * 1e8)` -- appropriate KRW-denominated scaling
- Interpolation: linear between LOG_LOW and LOG_HIGH -- smooth, reasonable

**No deviation from the academic standard detected.**

---

## MIC-2: HHI -- Herfindahl-Hirschman Index

### Formula

```
HHI = SUM_{i=1}^{N} s_i^2
```

**Source:** Herfindahl, O.C. (1950). *Concentration in the U.S. Steel Industry.* PhD Dissertation, Columbia University. Hirschman, A.O. (1964). The Paternity of an Index. *AER*, 54(5), 761-762.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| HHI | Herfindahl-Hirschman Index | dimensionless | [1/N, 1] | Computed from market shares |
| s_i | Market share of firm i | dimensionless | [0, 1], SUM = 1 | Revenue or market-cap basis |
| N | Number of firms in industry | count | >= 1 | Industry classification |

### Mathematical Properties

```
Variance representation:    HHI = N * Var(s) + 1/N
Numbers Equivalent:         NE = 1/HHI   (equivalent number of equal-sized firms)
Lerner connection:          L_industry = HHI / |epsilon_d|   (Cowling & Waterson 1976)
```

### Classification Thresholds

| HHI Range | Classification | Academic Source |
|-----------|---------------|----------------|
| < 0.15 | Unconcentrated | US DOJ/FTC Horizontal Merger Guidelines (2010 rev.), sec 5.3 |
| 0.15 - 0.25 | Moderately concentrated | Same source |
| >= 0.25 | Highly concentrated | Same source |

[CORRECTED] Previous version (V5) listed these thresholds without academic citation. The DOJ/FTC Horizontal Merger Guidelines (2010 revision, Section 5.3) are the authoritative source. Note that the DOJ uses HHI on a 0-10,000 scale (share percentages squared), whereas this document and the CheeseStock implementation use the 0-1 scale (share fractions squared). The thresholds 0.15, 0.25 correspond to 1,500 and 2,500 on the DOJ scale.

### Constants Table

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| HHI_MEAN_REV_COEFF | 0.10 | [C] | [L:WLS] | 0.04-0.15 | Doc33 sec 6.2 cross-validated. Maps HHI to confidence boost for mean-reversion patterns. #119 |

### System Mapping

```
ALL_STOCKS array (loaded from data/index.json)
  |
  +-> appWorker.js _updateMicroContext(candles) [lines 1486-1510]
       |
       +-> currentStock.industry (or .sector) -> filter ALL_STOCKS by same industry
       +-> For each stock in industry: accumulate marketCap
       +-> s_i = stock.marketCap / totalCap
       +-> hhi = SUM(s_i^2)
       +-> hhiBoost = HHI_MEAN_REV_COEFF * hhi  (= 0.10 * hhi)
       +-> _microContext.hhiBoost stored
       |
       +-> _applyMicroConfidenceToPatterns() [lines 1523-1556]
            if pattern type in MEAN_REV_TYPES AND hhiBoost > 0:
              adj *= (1 + hhiBoost)
```

### Application Scope

Only applies to mean-reversion pattern types:

```javascript
var MEAN_REV_TYPES = {
  doubleBottom: true, doubleTop: true,
  headAndShoulders: true, inverseHeadAndShoulders: true
};
```

### KRX Industry HHI Estimates (2024, marketCap-based)

| Industry | Major Firms | HHI (est.) | Structure | NE |
|----------|-------------|-----------|-----------|-----|
| Memory Semiconductor | Samsung, SK Hynix | ~0.45 | Duopoly | 2.2 |
| Airlines | Korean Air (+ Asiana merger) | ~0.55 | Monopolization | 1.8 |
| Automotive | Hyundai, Kia | ~0.40 | Duopoly + niche | 2.5 |
| Steel | POSCO, Hyundai Steel | ~0.35 | Duopoly | 2.9 |
| Mobile Telecom | SKT, KT, LGU+ | ~0.33 | Oligopoly | 3.0 |
| Shipbuilding | HD Korea, Samsung HI, Hanwha Ocean | ~0.30 | Oligopoly | 3.3 |
| Refining | SK Inno, GS Caltex, S-Oil, HDO | ~0.25 | Oligopoly | 4.0 |
| Gaming/Entertainment | Krafton, Nexon, HYBE | ~0.12 | Monopolistic comp. | 8.3 |
| Bio/Pharma | Samsung Bio, Celltrion, Hanmi | ~0.08 | Competitive | 12.5 |
| Construction | Many (Hyundai, Daewoo, etc.) | ~0.06 | Competitive | 16.7 |

### Worked Examples

| Case | HHI | eps_stability | Boost | Effective conf change |
|------|-----|---------------|-------|----------------------|
| Semiconductor duopoly (full formula) | 0.45 | 0.70 | 0.10 x 0.45 x 0.70 = 0.0315 | +3.2% |
| Telecom oligopoly (full formula) | 0.33 | 0.85 | 0.10 x 0.33 x 0.85 = 0.028 | +2.8% |
| Bio/Pharma competitive (full formula) | 0.08 | 0.30 | 0.10 x 0.08 x 0.30 = 0.0024 | ~0% (negligible) |
| **Current impl (no eps_stability)** | 0.45 | 1.0 (omitted) | 0.10 x 0.45 x 1.0 = 0.045 | **+4.5% (overestimate)** |

### Edge Cases

1. **Industry field missing:** If `currentStock.industry` and `.sector` are both empty/undefined, HHI computation is skipped and `hhiBoost = 0`.
2. **Single firm in industry:** HHI = 1.0 (monopoly). hhiBoost = 0.10. This is the theoretical maximum boost.
3. **ALL_STOCKS not loaded:** Guard `typeof ALL_STOCKS !== 'undefined'` prevents crash.

### [CORRECTED] Basis Discrepancy

The implementation uses `s.marketCap` (market capitalization shares) rather than revenue shares. Standard industrial organization defines HHI on revenue shares. Market-cap HHI can diverge from revenue HHI when P/E ratios vary across firms.

**Impact:** Low for major Korean industries where dominant firms also have dominant revenue. Divergence is largest in biotech (high market-cap, low revenue firms). Revenue-based HHI would require `data/sector_fundamentals.json` revenue data.

---

## MIC-3: Kyle Lambda -- Market Impact

### Formula

```
Delta_p = lambda * (x + u)
```

**Source:** Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| Delta_p | Price change | KRW | R | Market observation |
| lambda | Kyle's lambda (price impact coefficient) | KRW/share | > 0 | Estimated from order flow regression |
| x | Informed trader order flow | shares | R | Unobservable (model variable) |
| u | Noise trader order flow | shares | R | Unobservable (model variable) |

### Constants Table

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| eta (market impact coefficient) | 0.5-1.0 | [B] | [L:MAN] | 0.3-1.5 | Almgren & Chriss (2001), calibrated to institutional trade data |

### Theoretical Framework

Kyle (1985) models a single informed trader, noise traders, and a competitive market maker. The key result is that the informed trader trades *gradually* to conceal private information, and the equilibrium price impact is linear in total order flow. Lambda measures the information content per unit of order flow.

**Relationship to Amihud ILLIQ:** Kyle's lambda is a theoretical construct; Amihud's ILLIQ is its empirical proxy. Both measure price sensitivity to trading volume, but ILLIQ is computable from OHLCV data without requiring trade-level information.

```
Theoretical equivalence (approximate):
  ILLIQ approx proportional to lambda / sigma_u
  where sigma_u = noise trading volatility
```

### System Mapping

Kyle's lambda is not directly computed in CheeseStock. Its influence enters through two channels:

1. **ILLIQ ratio** (MIC-1): empirical proxy for lambda, used in confidence discount
2. **Slippage model** (MIC-10): square-root market impact formula derived from Kyle's framework

### Edge Cases

1. **Non-competitive market maker:** Kyle (1985) assumes a competitive market maker who sets prices at expected value conditional on order flow. KRX has no designated market makers; limit-order submitters collectively serve this function.
2. **Multiple informed traders:** Foster & Viswanathan (1996) extend Kyle to N informed traders, showing faster information revelation. This is relevant for KOSPI 200 stocks with many institutional analysts.

---

## MIC-4: Grossman-Stiglitz Paradox

### Formula

```
E[Return_informed] - E[Return_uninformed] = c_info / risk_aversion
```

**Source:** Grossman, S. & Stiglitz, J. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| E[Return_informed] | Expected return of informed investors | % p.a. | > 0 | Equilibrium outcome |
| E[Return_uninformed] | Expected return of uninformed investors | % p.a. | market return | Equilibrium outcome |
| c_info | Cost of information collection and processing | KRW | > 0 | Stigler (1961) search cost |
| risk_aversion | Aggregate risk aversion coefficient | dimensionless | > 0 | Market calibration |

### Constants Table

No system-level constants. This formula provides the theoretical existence condition for technical analysis, not a quantitative adjustment.

### Theoretical Framework

The Grossman-Stiglitz impossibility theorem:

```
Premise 1: If prices perfectly reflect all information -> no incentive to collect 
            information (cost c_info > 0 but benefit = 0)
Premise 2: If no one collects information -> prices cannot reflect information
Conclusion: Perfectly efficient markets are logically impossible.

Resolution: Equilibrium information inefficiency exists. Its size is proportional 
            to c_info. This residual inefficiency is what pattern analysis exploits.
```

### System Mapping

The paradox is the **theoretical existence condition** for the entire CheeseStock pattern analysis system. It justifies why technical patterns can have non-zero alpha in equilibrium:

1. **AMH decay mechanism** (signalEngine.js): Models the convergence of pattern alpha toward c_info level. When a pattern becomes widely known, its alpha declines but never reaches zero.
2. **Pattern crowding** (Doc 21): When all traders use the same pattern, alpha vanishes toward c_info -- the Grossman-Stiglitz floor.
3. **Composite signals**: Higher-complexity signals face lower crowding (higher c_info for replication), preserving more alpha.

### Edge Cases

1. **c_info approaching zero:** As AI/ML tools make information processing nearly free, the equilibrium inefficiency shrinks. This could reduce pattern alpha in the long run but never eliminate it (because c_info > 0 always).
2. **Heterogeneous c_info:** Different investors face different information costs. Sophisticated investors (low c_info) extract more alpha. This justifies the CheeseStock system's investment in complex signal processing.

---

## MIC-5: Jensen-Meckling Agency Cost Decomposition

### Formula

```
AC = MC + BF + RL
```

**Source:** Jensen, M.C. & Meckling, W.H. (1976). Theory of the Firm: Managerial Behavior, Agency Costs and Ownership Structure. *JFE*, 3(4), 305-360.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| AC | Total agency costs | KRW | > 0 | Jensen & Meckling (1976) |
| MC | Monitoring costs (board, audit, internal controls) | KRW | > 0 | Observable from DART disclosures |
| BF | Bonding costs (stock options, performance pay, covenants) | KRW | > 0 | Observable from compensation reports |
| RL | Residual loss (V_optimal - V_actual) | KRW | >= 0 | Indirectly estimated via Tobin's Q deviation |

### Constants Table

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| ARI_CONFIDENCE_DECAY | 0.20 | [D] | [L:WLS] | 0.10-0.30 | Max 20% discount when ARI=1.0. Conservative: agency costs corrupt ~1/5 of pattern signal. #166 |
| CHAEBOL_TUNNELING_THRESHOLD | 0.30 | [C] | [L:MAN] | 0.20-0.40 | RPRR > 30% flags tunneling possibility. Bae et al. (2002) empirical. #168 |

### Jensen (1986) Free Cash Flow Hypothesis

```
FC_i = CF_operating_i - CF_investment_needed_i

When FC > 0 AND agency costs high:
  -> Manager invests in NPV < 0 projects (empire building)
  -> V_actual < V_optimal (RL increases)
```

### Holmstrom (1979) Optimal Incentive Intensity

```
beta* = 1 / (1 + rho * sigma^2 / Delta_f^2)
```

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| beta* | Optimal incentive intensity | dimensionless | [0, 1] | Holmstrom (1979) |
| rho | Agent risk aversion (CARA) | dimensionless | > 0 | Utility parameter |
| sigma^2 | Output variance (environmental uncertainty) | (KRW)^2 | > 0 | Industry characteristic |
| Delta_f | Marginal product of effort | KRW | > 0 | Task characteristic |

### Agency Risk Index (ARI) -- Design Specification

**STATUS: NOT IMPLEMENTED.** ARI requires real-time factor data feeds.

```
ARI = w1 * ROE_inv + w2 * CAPEX_excess + w3 * (1 - BI) + w4 * RPRR

Weights: w1=0.30, w2=0.25, w3=0.20, w4=0.25  (SUM = 1.00)
Range: [0, 1]

Pattern confidence adjustment:
  conf_adj = conf_base * (1 - ARI_CONFIDENCE_DECAY * ARI)
```

| ARI Range | Interpretation | Conf Discount |
|-----------|---------------|---------------|
| 0.00-0.20 | Low agency risk | 0-4% |
| 0.20-0.40 | Moderate | 4-8% |
| 0.40-0.60 | High agency risk | 8-12% |
| 0.60-1.00 | Very high agency risk | 12-20% |

**Phase 1 Simplified ARI (implementable):**

```
ARI_simplified = 0.55 * ROE_inv + 0.45 * CAPEX_excess
  (~60% explanatory power of full ARI, R^2 basis)
```

### Korean Chaebol Specifics

**Tunneling** (Bae et al. 2002): Controlling shareholder transfers resources from high-ownership subsidiary to low-ownership subsidiary. Empirical finding: acquiring firm CAR[-1,+1] = -0.6%, controlling shareholder wealth +1.5%.

**Propping** (Friedman, Johnson & Mitton 2003): Reverse of tunneling -- resources flow to prop up key subsidiary during crisis.

### System Mapping

ARI is not implemented in production code. Its influence enters conceptually through:
- Chaebol contagion coefficient (beta_chaebol = 0.3-0.5) in Doc31 sec 3.3
- Financial panel (financials.js) investment score already incorporates ROE/governance proxies
- Future implementation path: `data/governance/{code}.json` from DART API expansion

### Edge Cases

1. **Why ARI cap is 20%:** Even with extreme agency costs, technical patterns retain price-discovery function. Patterns reflect supply-demand imbalance, which agency problems do not nullify.
2. **Chaebol-specific reversal:** ARI discount may be counter-productive for post-tunneling-announcement bearish patterns (which correctly detect value destruction). This is an inherent limitation of pre-event adjustments.

---

## MIC-6: Stigler Search Cost Model

### Formula

```
Optimal search intensity: MB(n*) = MC(n*)

C(n) = c * n              (search cost: linear in n = stocks examined)
B(n) = E[V_best(n)] - E[V_best(n-1)]  (diminishing returns)

Reservation return:
r* = argmax_r [INTEGRAL_r^inf (x - r) dF(x)] / c
```

**Source:** Stigler, G.J. (1961). The Economics of Information. *JPE*, 69(3), 213-225.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| n | Number of stocks examined | count | >= 0 | Investor decision variable |
| c | Unit search cost (time + cognitive effort) | KRW-equivalent | > 0 | Stigler (1961) |
| MB(n) | Marginal benefit of n-th search | KRW | > 0, decreasing | Expected improvement from one more search |
| MC(n) | Marginal cost of n-th search | KRW | = c (constant) | Time value + information access cost |
| r* | Reservation return (minimum acceptable) | % | > 0 | Optimal stopping criterion |
| F(x) | CDF of return distribution across all stocks | dimensionless | [0, 1] | Market characteristic |

### Constants Table

No system-level constants directly. Search cost theory provides the theoretical foundation for why KOSDAQ small-cap stocks exhibit larger pattern alpha (higher search cost = larger Grossman-Stiglitz equilibrium inefficiency).

### Key Transition in Korean Market

| Era | Search Cost c | Method | Impact |
|-----|--------------|--------|--------|
| Pre-2000 | Very high | Broker visits, phone orders, newspapers | Extreme information asymmetry, manipulation common |
| 2000-2010 | High | HTS (home trading system), internet brokers | Retail participation surge |
| 2010-2020 | Moderate | MTS (mobile), real-time news | Speed improvement, attention fragmentation |
| 2020+ | Low | Robo-advisors, AI screeners, CheeseStock | Near-zero access cost, but **attention capacity** is now the binding constraint |

**Critical insight:** The binding constraint has shifted from information **cost** (c) to information **processing capacity** (A_total in Peng-Xiong 2006). This transition is the departure point for MIC-7.

### System Mapping

Search theory is embedded in CheeseStock's architecture:
- `sidebarManager` (sidebar.js): virtual scroll over 2,700+ stocks = the search process
- Screener filters: sector, market cap, volume = search cost reduction
- Pattern detection toast: "N patterns detected" = automated search reducing c toward zero

### Edge Cases

1. **Diamond Paradox** (Diamond 1971): Even infinitesimal c > 0 causes competitive outcome collapse to monopoly pricing. In securities markets: ask-price stickiness. Low-liquidity stocks exhibit maximum stickiness.
2. **Search cost = 0 paradox:** If c = 0, Grossman-Stiglitz says alpha = 0. But human cognitive limits mean c > 0 always (even with free data, processing costs exist).

---

## MIC-7: Peng-Xiong Attention Budget Constraint

### Formula

```
Budget constraint:    SUM_{i=1}^{N} a_i <= A_total
Information acquired: I_i = a_i * kappa_i
Price efficiency:     eta_i = 1 - exp(-I_i / sigma_i^2)
```

**Source:** Peng, L. & Xiong, W. (2006). Investor Attention, Overconfidence and Category Learning. *JFE*, 80(3), 563-602.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| a_i | Attention allocated to asset i | bits/period | >= 0 | Investor decision variable |
| A_total | Total attention budget | bits/period | finite, constant per individual | Cognitive capacity (Sims 2003) |
| kappa_i | Information density of asset i | dimensionless | > 0 | News coverage, disclosure frequency |
| I_i | Information processed about asset i | bits | >= 0 | a_i x kappa_i |
| eta_i | Price efficiency of asset i | dimensionless | [0, 1] | 1 = fully efficient, 0 = random walk |
| sigma_i^2 | Intrinsic uncertainty (return variance) | dimensionless | > 0 | OHLCV-derived |

### Category Learning Result

Under attention constraints, investors optimally process at sector level:

```
r_i = beta_i * f_sector + epsilon_i

Optimal allocation: a_sector >> a_epsilon_i (individual)
```

**Implication:** Sector momentum > individual stock momentum (empirically confirmed). Post-earnings-surprise drift is 3-5x longer for KOSDAQ small caps vs KOSPI large caps.

### Information Half-Life

```
lambda_att = lambda_0 + lambda_1 * (a_i / A_total)
t_half = -ln(2) / ln(1 - lambda_att)
```

| Segment | lambda_att | t_half | Interpretation |
|---------|-----------|--------|----------------|
| KOSPI 200 large | 0.80 | ~0.4 trading days (~3 hours) | Near-instant adjustment |
| KOSPI mid | 0.50 | ~1.0 trading day | Same-day adjustment |
| KOSDAQ large | 0.20 | ~3.1 trading days | Multi-day drift |
| KOSDAQ small | 0.05 | ~13.5 trading days | Weeks-long slow adjustment |

### Constants Table

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| ATTENTION_JUMP_THRESHOLD | 2.0 | [C] | [L:WLS] | 1.5-3.0 | attentionScore > 2.0 = jump phase. Barber-Odean (2008) calibration |
| deprivation_threshold | 0.4 | [D] | [L:MAN] | 0.2-0.6 | Approximately 1 std below normal attentionScore |
| confidenceAdj_deprivation | -0.05 | [D] | [L:MAN] | -0.10 to 0 | Conservative: low attention = low signal content |
| confidenceAdj_jump | +0.08 | [D] | [L:MAN] | +0.03 to +0.12 | Moderate: high attention = high info but overreaction risk |

### Attention Score Formula (CheeseStock)

```
attentionScore = log(1 + volRatio) * rangeRatio

where:
  volRatio   = V_t / SMA(V, 20)
  rangeRatio = (H_t - L_t) / ATR(14)
```

**Log transform justification:** Weber-Fechner law (psychophysics) -- sensation is logarithmic in stimulus intensity. Volume increase from 2x to 4x carries more informational meaning than 10x to 20x.

### System Mapping

`IndicatorCache.attentionState(idx, lookback)` in indicators.js implements the attention cycle using volume percentile (q30/q70) classification. Interface differs from the exact attentionScore formula above, but directional behavior is equivalent:

| Phase | Condition | confidenceAdj | Interpretation |
|-------|-----------|---------------|----------------|
| Deprivation | attentionScore < 0.4 (or vol < q30) | -0.05 | Potential energy accumulating, low signal content |
| Normal | 0.4 <= score <= 2.0 | 0.0 | Standard price discovery |
| Jump | attentionScore > 2.0 (or vol > q70) | +0.08 | Information rapidly incorporated |

**Status:** Partially implemented. Attention state is computed but not wired into the micro confidence pipeline (`_applyMicroConfidenceToPatterns`). It is available as an indicator for display purposes.

### Edge Cases

1. **Consecutive jump penalty:** 2+ consecutive jump days signal overreaction probability. Reversal patterns gain +0.05 per extra day, continuation patterns lose -0.03 per extra day.
2. **KOSDAQ small-cap correction:** Market cap < 500B KRW requires `mktcap_factor` adjustment to effective jump threshold (raises from 2.0 to 2.7-3.7 depending on cap).

---

## MIC-8: Barber-Odean Attention-Driven Buying

### Formula

```
P_attention_jump = P_fundamental + alpha_overreaction * Attention_t
```

**Source:** Barber, B.M. & Odean, T. (2008). All That Glitters: The Effect of Attention and News on the Buying Behavior of Individual and Institutional Investors. *RFS*, 21(2), 785-818.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| P_attention_jump | Price during attention jump | KRW | > 0 | Market observation |
| P_fundamental | Fundamental price (pre-jump) | KRW | > 0 | Valuation models |
| alpha_overreaction | Overreaction premium coefficient | dimensionless | > 0 | Empirical calibration |
| Attention_t | Attention measure at time t | dimensionless | [0, inf) | attentionScore or volume surge |

### Core Asymmetry

- **BUY decision:** search over entire market (N = ~2,700 KRX stocks) -> search cost -> attention-grabbing bias
- **SELL decision:** search over portfolio (n stocks held) -> no search cost -> uniform review

This asymmetry means attention-grabbing events (volume spikes, extreme returns, news, limit-up/down) disproportionately drive BUYING, creating temporary overpricing followed by mean-reversion.

### Attention-Grabbing Events on KRX

| Event | Mechanism | Pattern Implication |
|-------|-----------|---------------------|
| Volume spike (vol > 3x SMA20) | Triggers attention jump | Initial momentum, followed by reversal |
| Extreme return (|r| > 2x ATR) | Grabs retail attention | Overreaction premium accumulates |
| News headline / search surge | Reduces search cost for specific stock | Short-term over-buying |
| Limit-up / limit-down (+-30%) | Maximum attention event on KRX | Magnet effect (MIC-9) amplifies |

### 3-Phase Attention Cycle

```
Phase 1 -- Deprivation: low volume, low volatility, information accumulates ("potential energy")
  Duration: weeks to months. volRatio < 0.5, rangeRatio < 0.5.

Phase 2 -- Jump: catalyst event triggers rapid information incorporation + overreaction
  Duration: 1-5 trading days. volRatio > 2.0, rangeRatio > 2.0.

Phase 3 -- Normalization: overreaction partially corrects, new equilibrium
  Duration: 5-20 trading days. volRatio -> 1.0, rangeRatio -> 1.0.
```

| Segment | Deprivation % of days | Jump intensity | Normalization period |
|---------|----------------------|---------------|---------------------|
| KOSPI large | 30-40% | vol x 2-3 | 3-5 days |
| KOSPI mid | 40-50% | vol x 3-5 | 5-10 days |
| KOSDAQ large | 50-60% | vol x 4-8 | 7-15 days |
| KOSDAQ small | 60-75% | vol x 8-20 | 10-30 days |

### System Mapping

Attention-driven buying is captured indirectly through:
- `signalEngine.js` VOLUME_SURGE signal: detects volume spikes
- `IndicatorCache.attentionState()`: classifies deprivation/normal/jump
- Backtester N-day horizon: should be adjusted by lambda_att for attention-delayed stocks (MIC-7)

### Edge Cases

1. **"Bad attention" asymmetry:** Hong, Lim & Stein (2000) show bad news travels slower than good news in low-attention stocks. Bearish patterns realize more slowly than bullish patterns for KOSDAQ small-caps.
2. **KRX retail dominance:** KOSDAQ's 60-91% individual investor share amplifies the Barber-Odean effect. The attention bias is structurally more severe on KOSDAQ than on KOSPI.

---

## MIC-9: KRX +-30% Price Limit Magnet Effect

### Formula

```
P(limit_hit | price_near_limit) >> P(limit_hit | price_far)

Truncated return:
r_t = max(-0.30, min(0.30, r_t*))

ATR correction:
ATR_adj = ATR / (1 - P(limit_hit))
```

**Source:** Du, Y., Liu, Q. & Rhee, G. (2009). An Anatomy of the Magnet Effect: Evidence from the Korea Exchange. *International Review of Finance*, 9(1-2), 50-74.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| r_t* | True (uncensored) return | dimensionless | (-inf, +inf) | Latent variable |
| r_t | Observed (truncated) return | dimensionless | [-0.30, +0.30] | KRX price limit |
| P(limit_hit) | Probability of hitting the price limit | dimensionless | [0, 1] | Empirical (rare event) |
| ATR_adj | Limit-adjusted ATR | KRW | > 0 | Corrected ATR for limit-hit days |

### Constants Table

No system-level constants from this formula. The price limit is a KRX structural parameter (+-30% since 2015).

### Magnet Effect Mechanism (Du, Liu & Rhee 2009)

```
1. Price approaches limit (e.g., current return > +25%)
2. Market orders surge (limit-order submitters withdraw, market-order submitters rush)
3. Order flow imbalance intensifies -> accelerated approach to limit
4. Self-fulfilling: speculative orders push price to limit faster than fundamentals justify
5. Technical pattern distortion begins 10-15 minutes before limit hit (intraday)
```

**Impact on pattern analysis:**

| KRX Structure | Pattern Distortion | Confidence Adjustment |
|---------------|-------------------|----------------------|
| Price limit +-30% | Magnet effect -> false breakouts near limit | Disable signals within 15 min of limit approach |
| Return truncation | ATR underestimated on limit days | Apply ATR_adj correction |
| Circuit breaker | Momentum reset after 20-min halt | All signals invalid post-halt |

### System Mapping

- `patterns.js` ATR calculation: should apply ATR_adj on limit-hit days (currently not implemented)
- Backtester target/stop: priceTarget and stopLoss must fall within +-30% range of current day's close (otherwise unreachable in single session)
- Circuit breaker handling: not implemented (would require intraday data and event detection)

### Edge Cases

1. **ATR bias:** On limit-hit days, true range = close * 0.30 but the actual range from open to limit may be smaller if price gapped open near the limit. ATR(14) averages over 14 days, so occasional limit hits have small impact.
2. **Consecutive limit-hits:** Rare but devastating. 2+ consecutive limit-up or limit-down days require multi-day ATR adjustment and invalidate most technical patterns.
3. **2015 expansion:** KRX expanded limits from +-15% to +-30% in 2015.06.15. Historical backtests spanning this date must account for the structural break.

---

## MIC-10: Slippage Model -- Square-Root Law

### Formula

```
MI = sigma_daily * sqrt(OrderSize / ADV) * eta
```

**Source:** Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335. Almgren, R. & Chriss, N. (2001). Optimal Execution of Portfolio Transactions. *J. Risk*, 3(2), 5-39.

### Symbol Table

| Symbol | Meaning | Unit | Range | Source |
|--------|---------|------|-------|--------|
| MI | Market impact (one-way slippage) | % | > 0 | Estimated |
| sigma_daily | Daily return standard deviation | % | 0.5-5% | OHLCV-derived |
| OrderSize | Order size | KRW | > 0 | Trade parameter |
| ADV | Average daily volume (KRW) | KRW | > 0 | 20-day average |
| eta | Market impact coefficient | dimensionless | 0.5-1.0 | Almgren & Chriss (2001) |

### Constants Table

| Constant | Value | Grade | Learnable | Range | Justification |
|----------|-------|-------|-----------|-------|---------------|
| KRX_SLIPPAGE (default) | 0.10% | [C] | [L:MAN] | 0.04-0.35% | One-way, KOSPI mid-cap calibration. backtester.js line 21 |
| kospi_large slippage | 0.04% | [C] | [L:MAN] | 0.02-0.06% | Amihud-calibrated. backtester.js line 33 |
| kospi_mid slippage | 0.10% | [C] | [L:MAN] | 0.06-0.15% | backtester.js line 34 |
| kosdaq_large slippage | 0.15% | [C] | [L:MAN] | 0.10-0.25% | backtester.js line 35 |
| kosdaq_small slippage | 0.25% | [C] | [L:MAN] | 0.15-0.40% | backtester.js line 36 |

### Square-Root Decay Intuition

```
Doubling order size -> impact increases by sqrt(2) = 41%, NOT 100%
```

Because larger orders attract more liquidity provision (Almgren & Chriss 2001). This is why institutional execution algorithms (TWAP, VWAP) spread orders over time.

### Horizon Cost Model (backtester.js)

```javascript
_horizonCost = function(h) {
  var fixedCost = (KRX_COMMISSION + KRX_TAX) / h;        // amortized fixed costs
  var variableCost = KRX_SLIPPAGE / Math.sqrt(h);         // sqrt(h) noise scaling (Kyle 1985)
  return fixedCost + variableCost;
};
```

| Horizon h | Fixed cost (0.21%/h) | Variable cost (0.10%/sqrt(h)) | Total |
|-----------|---------------------|------------------------------|-------|
| 1 day | 0.210% | 0.100% | 0.310% |
| 5 days | 0.042% | 0.045% | 0.087% |
| 20 days | 0.011% | 0.022% | 0.033% |

### System Mapping: Adaptive Slippage Data Path

```
scripts/compute_illiq_spread.py
  -> Computes ILLIQ for all stocks, classifies segments
  -> OUTPUT: data/backtest/illiq_spread.json
     { summary: { kospi_large, kospi_mid, kosdaq_large, kosdaq_small },
       stocks: { code: { illiq_20d, illiq_60d, roll_spread, segment } } }

backtester.js
  -> _loadBehavioralData() fetches illiq_spread.json [line 212]
  -> _getAdaptiveSlippage(code) [lines 27-38]:
     looks up code in illiq_spread.stocks
     returns segment-based slippage: 0.04% / 0.10% / 0.15% / 0.25%
  -> Used in backtest P&L calculations
```

### Round-Trip Transaction Cost Breakdown

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

KOSDAQ small / KOSPI large = 0.93% / 0.13% = 7.2x
-> KOSDAQ small-cap patterns need 7x stronger confidence for profitability
```

### Edge Cases

1. **KRX_SLIPPAGE as default fallback:** When `illiq_spread.json` is not loaded or stock code not found, `_getAdaptiveSlippage()` falls back to `KRX_SLIPPAGE = 0.10%` (KOSPI mid-cap level).
2. **Zero-volume stocks:** Cannot trade at all. `compute_illiq_spread.py` requires `len(candles) >= 30` minimum.
3. **Intraday vs daily:** The sqrt(h) scaling applies to daily horizons. Intraday execution would use Almgren-Chriss continuous-time model, which CheeseStock does not implement (file-mode only).

---

## Combined Micro Confidence Pipeline

### Pipeline Flow (appWorker.js)

```
STEP 1: _updateMicroContext(candles) [line 1482]
  |
  +-> calcAmihudILLIQ(candles) -> illiq { illiq, logIlliq, level, confDiscount }
  |
  +-> HHI from ALL_STOCKS marketCap:
  |     filter by currentStock.industry
  |     for each stock in industry: s_i = marketCap / totalCap
  |     hhi = SUM(s_i^2)
  |     hhiBoost = 0.10 * hhi   [NOTE: eps_stability missing, see Finding M-1]
  |
  +-> _microContext = { illiq: illiqResult, hhiBoost: hhiBoost }

STEP 2: _applyMicroConfidenceToPatterns(patterns, _microContext) [line 1523]
  |
  For each pattern p:
    adj = 1.0
    |
    +-> (1) ILLIQ liquidity discount:
    |     if microCtx.illiq && microCtx.illiq.confDiscount < 1.0:
    |       adj *= microCtx.illiq.confDiscount    // range: [0.85, 1.0]
    |
    +-> (2) HHI mean-reversion boost:
    |     if p.type in MEAN_REV_TYPES AND microCtx.hhiBoost > 0:
    |       adj *= (1 + microCtx.hhiBoost)        // range: [1.0, ~1.045]
    |
    +-> (3) Clamp: adj = max(0.80, min(1.15, adj))
    |
    +-> (4) Apply: p.confidence = max(10, min(100, round(confidence * adj)))
    |     Also applies to p.confidencePred if present
```

### Pipeline Position in Full Confidence Adjustment Chain

```
patternEngine.analyze(candles)           -> raw patterns with base confidence
  |
  _applyMarketContextToPatterns()        -> market-level adjustments
  _applyRORORegimeToPatterns()           -> risk-on/risk-off regime
  _applyMacroConfidenceToPatterns()      -> macro indicators (MCS, VIX, bonds)
  **_updateMicroContext(candles)**        -> compute ILLIQ + HHI  <-- THIS SECTION
  **_applyMicroConfidenceToPatterns()**   -> apply micro adjustments <-- THIS SECTION
  _applyDerivativesConfidenceToPatterns() -> derivatives/flow data
  _applyMertonDDToPatterns()             -> credit risk (Distance-to-Default)
  _applyPhase8ConfidenceToPatterns()     -> Phase 8 composite
```

### Effective Range

| Adjustment | Min | Max | Trigger |
|------------|-----|-----|---------|
| ILLIQ discount | 0.850 | 1.000 | All patterns, illiquid stocks only |
| HHI boost | 1.000 | ~1.045 | Mean-reversion patterns only, high-HHI industries |
| Combined clamp | 0.800 | 1.150 | Hard bounds (pre-clamp range rarely exceeds [-15%, +4.5%]) |

### Full Integration Formula (Including Unimplemented Components)

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

## Master Constants Table

All microeconomic constants referenced in MIC-1 through MIC-10:

| # | Constant | Value | Grade | Learnable | Range | Location | Formula | Source |
|---|----------|-------|-------|-----------|-------|----------|---------|--------|
| 119 | HHI_MEAN_REV_COEFF | 0.10 | [C] | [L:WLS] | 0.04-0.15 | appWorker.js L1507 | MIC-2 | Doc33 sec 6.2 |
| 162 | ILLIQ WINDOW | 20 | [B] | Fixed | 10-60 | indicators.js L1431 | MIC-1 | Amihud (2002) |
| 163 | CONF_DISCOUNT (max) | 0.85 | [C] | [L:WLS] | 0.70-0.95 | indicators.js L1432 | MIC-1 | KRX calibration |
| 164 | LOG_HIGH | -1.0 | [C] | [L:MAN] | -2.0 to 0.0 | indicators.js L1435 | MIC-1 | KRX DVOL scale |
| 165 | LOG_LOW | -3.0 | [C] | [L:MAN] | -4.0 to -2.0 | indicators.js L1436 | MIC-1 | KRX DVOL scale |
| 166 | ARI_CONFIDENCE_DECAY | 0.20 | [D] | [L:WLS] | 0.10-0.30 | NOT IMPL | MIC-5 | Jensen-Meckling heuristic |
| 168 | CHAEBOL_TUNNELING_THRESHOLD | 0.30 | [C] | [L:MAN] | 0.20-0.40 | NOT IMPL | MIC-5 | Bae et al. (2002) |
| -- | KRX_SLIPPAGE (default) | 0.10% | [C] | [L:MAN] | 0.04-0.35% | backtester.js L21 | MIC-10 | Amihud (2002) |
| -- | kospi_large slippage | 0.04% | [C] | [L:MAN] | 0.02-0.06% | backtester.js L33 | MIC-10 | compute_illiq_spread.py |
| -- | kospi_mid slippage | 0.10% | [C] | [L:MAN] | 0.06-0.15% | backtester.js L34 | MIC-10 | compute_illiq_spread.py |
| -- | kosdaq_large slippage | 0.15% | [C] | [L:MAN] | 0.10-0.25% | backtester.js L35 | MIC-10 | compute_illiq_spread.py |
| -- | kosdaq_small slippage | 0.25% | [C] | [L:MAN] | 0.15-0.40% | backtester.js L36 | MIC-10 | compute_illiq_spread.py |
| -- | ATTENTION_JUMP_THRESHOLD | 2.0 | [C] | [L:WLS] | 1.5-3.0 | indicators.js (cache) | MIC-7/8 | Barber-Odean (2008) |
| -- | deprivation_threshold | 0.4 | [D] | [L:MAN] | 0.2-0.6 | indicators.js (cache) | MIC-7 | Heuristic |
| -- | confidenceAdj_jump | +0.08 | [D] | [L:MAN] | +0.03 to +0.12 | indicators.js (cache) | MIC-8 | Barber-Odean (2008) |
| -- | eta (market impact) | 0.5-1.0 | [B] | [L:MAN] | 0.3-1.5 | conceptual | MIC-10 | Almgren & Chriss (2001) |

### Grade Legend

| Grade | Definition | Criteria |
|-------|-----------|----------|
| [A] | Fixed universal constant | Mathematical/physical constant, never changes |
| [B] | Academic range | Value specified in academic literature with accepted range |
| [C] | Calibratable | Theoretically grounded but optimal value depends on market conditions |
| [D] | Heuristic | Direction clear from theory but magnitude is empirical judgment |
| [E] | Deprecated | Previously used, now removed or replaced |

---

## Findings

### Finding M-1: eps_stability Mediator Missing (MODERATE)

**Location:** appWorker.js line 1506-1507

**Issue:** HHI mean-reversion boost is computed as `0.10 * hhi` without the `eps_stability` factor documented in Doc33 sec 6.2. The full formula is `mean_reversion_boost = HHI_MEAN_REV_COEFF * HHI * eps_stability` where `eps_stability = 1 / (1 + sigma_EPS_growth)`.

**Quantitative impact:** Cyclical high-HHI industries receive excess boost. Semiconductor (HHI=0.45): current boost = 4.5%, theoretically correct boost = 3.2% (with eps_stability=0.70). Excess = +1.3pp.

**Recommendation:** Implement eps_stability from quarterly EPS variance. If quarterly data unavailable, use ROE stability proxy: `eps_stability_proxy = 1 / (1 + ROE_std_5yr / 100)`.

### Finding M-2: Single Slippage Value vs Adaptive Slippage (LOW -- PARTIALLY RESOLVED)

**Location:** backtester.js `KRX_SLIPPAGE = 0.10%` (default) and `_getAdaptiveSlippage()` (segment-based)

**Issue:** The default KRX_SLIPPAGE = 0.10% is used only as a fallback. The `_getAdaptiveSlippage()` function (lines 27-38) already implements 4-tier segment-based slippage using `data/backtest/illiq_spread.json` from `compute_illiq_spread.py`.

[CORRECTED from V5] V5 reported this as "not implemented." In fact, adaptive slippage IS implemented but requires `illiq_spread.json` to be present (generated by running `compute_illiq_spread.py`). If the file is missing, fallback to 0.10% applies.

**Recommendation:** Ensure `compute_illiq_spread.py` is included in `daily_update.bat` pipeline so adaptive slippage data stays fresh.

### Finding M-3: ILLIQ Formula Implementation is Correct (CONFIRMED)

**Location:** indicators.js lines 1430-1472

**Verification:** The implementation correctly follows Amihud (2002):
- Formula: `ILLIQ = (1/validDays) * SUM(|r_t| / DVOL_t)` -- matches standard
- Window=20 trading days -- matches specification
- logIlliq uses `log10(illiq * 1e8)` -- appropriate KRW scaling
- Linear interpolation between LOG_LOW and LOG_HIGH -- smooth, reasonable

**No deviation from academic standard detected.**

### Finding M-4: HHI Uses marketCap Instead of Revenue (INFORMATIONAL)

**Location:** appWorker.js lines 1491-1504

**Issue:** HHI is computed using `s.marketCap` (market capitalization shares). Standard IO uses revenue shares. Divergence is small for most Korean industries but largest in biotech (high market-cap, low revenue firms).

**Impact:** Low. Acceptable as-is.

### Finding M-5: Short-Selling Ban Adjustment Not Implemented (INFORMATIONAL)

**Issue:** Doc33 sec 8.3 specifies confidence adjustments during short-selling ban periods (bearish: conf x 0.70, bullish: x 0.90). Korea has been under a full ban since November 2023. All bearish pattern confidence scores are ~30% too high relative to theory.

**Recommendation:** Implement short-selling ban flag with hardcoded date ranges. This is a discrete binary adjustment:
```
SHORT_BAN_PERIODS = [
  { start: '2020-03-16', end: '2021-05-02' },
  { start: '2023-11-06', end: null }  // ongoing
];
```

### Finding M-6: Adaptive Slippage Already Implemented (NEW in V6)

**Location:** backtester.js lines 27-38

**Discovery:** The `_getAdaptiveSlippage(code)` function implements 4-tier segment-based slippage (kospi_large: 0.04%, kospi_mid: 0.10%, kosdaq_large: 0.15%, kosdaq_small: 0.25%) using pre-computed ILLIQ data from `data/backtest/illiq_spread.json`. This was not documented in V5.

**Data path:** `compute_illiq_spread.py` -> `data/backtest/illiq_spread.json` -> `backtester._loadBehavioralData()` -> `_getAdaptiveSlippage(code)` -> per-stock slippage in backtest P&L.

**Status:** Fully functional when `illiq_spread.json` is present.

---

## Supplementary Theory (Non-Implemented Reference)

### Game Theory: Nash Equilibrium and Market Panic

Nash (1950): Strategy profile s* is Nash Equilibrium iff no player can unilaterally improve payoff by deviating.

**Prisoner's Dilemma and Three Black Crows:**

```
             Player B
            Hold    Sell
Player A
  Hold     (3,3)   (0,5)
  Sell     (5,0)   (1,1)

Nash Equilibrium: (Sell, Sell) = (1,1)
Pareto Optimal:   (Hold, Hold) = (3,3)
```

Sequential realization of this dilemma produces the Three Black Crows pattern.

**Folk Theorem:** If discount factor delta >= 0.5, cooperation (Hold) is sustainable in infinitely repeated games. Institutional investors (high delta) stabilize markets; day traders (low delta) amplify volatility.

### Information Cascade (Bikhchandani, Hirshleifer & Welch 1992)

```
Cascade condition: public signal strength > private signal strength
  -> Individual private information is ignored
  -> Cascading buy/sell wave
  -> Eventually collapses when accumulated private signals reverse the public signal
```

KOSDAQ small caps: cascade frequency HIGH, duration 3-15 days. KOSPI large caps: cascade frequency LOW, duration 1-3 days (institutional counter-positioning inhibits cascades).

### Margin Spiral (Brunnermeier & Pedersen 2009)

```
Liquidity Spiral: Price DOWN -> Margin UP -> Forced selling -> Price DOWN further
Loss Spiral:      Price DOWN -> Equity DOWN -> Leverage UP -> Deleveraging pressure

dP/dt = -gamma * (Margin_t - Margin_threshold) * Leverage_t
```

Korean vulnerability: Credit financing balance ~3-5% of KOSDAQ market cap (2024). Forced selling (bandeaemaemae) triggers at maintenance ratio < 140%.

### Grinold Fundamental Law of Active Management

```
IR = IC * sqrt(BR)

IC_combined(n) = IC_1 * sqrt(1 + (n-1) * rho_avg) / sqrt(n)
```

With rho_avg = 0.40 (CheeseStock's 22 signals from same price data):
- n=1: IC = 0.050
- n=5: IC = 0.034
- n=10: IC = 0.029
- n=22: IC = 0.026

Optimal: ~6-8 well-selected uncorrelated signals. Ridge regularization (lambda=278) implicitly achieves this via effective df = 5-8.

**Ridge as Pigouvian Tax on Overfitting:**

```
Ridge objective: min_beta ||y - X*beta||^2 + lambda*||beta||^2

lambda*||beta||^2 = complexity tax (Pigouvian tax on overfitting externality)
Current lambda=278 (GCV optimal): effective df = 5-8 out of 22 signals
```

### CSAD Herding Measure (Chang, Cheng & Khorana 2000)

```
CSAD_t = (1/N) * SUM |R_i,t - R_m,t|

Herding regression:
  CSAD_t = a + b1*|R_m,t| + b2*R_m,t^2 + epsilon_t

Herding detection: b2 < 0 (dispersion DECREASES in extreme markets)
```

Implemented in `scripts/compute_csad_herding.py` -> `data/backtest/csad_herding.json`.

### Regulatory Capture (Stigler 1971)

```
Self-reinforcing: High HHI -> easier lobbying -> regulatory barriers -> HHI maintained
```

### Political Business Cycle (Nordhaus 1975)

Korea: Presidential 5-year cycle (next: 2027.03), Legislative 4-year cycle (next: 2028.04). Pre-election 12 months: expansionary (construction/SOC stocks UP). Post-election 6 months: reform uncertainty (pattern confidence temporarily DOWN).

---

## References

1. Akerlof, G.A. (1970). The Market for "Lemons". *QJE*, 84(3), 488-500.
2. Almgren, R. & Chriss, N. (2001). Optimal Execution of Portfolio Transactions. *J. Risk*, 3(2), 5-39.
3. Amihud, Y. (2002). Illiquidity and Stock Returns. *JFM*, 5(1), 31-56.
4. Bae, K.-H., Kang, J.-K. & Kim, J.-M. (2002). Tunneling or Value Added? *JF*, 57(6), 2695-2740.
5. Barber, B.M. & Odean, T. (2008). All That Glitters. *RFS*, 21(2), 785-818.
6. Bertrand, J. (1883). Review of Cournot. *Journal des Savants*, 499-508.
7. Bikhchandani, S., Hirshleifer, D. & Welch, I. (1992). Informational Cascades. *JPE*, 100(5), 992-1026.
8. Brunnermeier, M. & Pedersen, L. (2009). Market Liquidity and Funding Liquidity. *RFS*, 22(6), 2201-2238.
9. Chang, E.C., Cheng, J.W. & Khorana, A. (2000). Herd Behavior in Equity Markets. *JBF*, 24(10), 1651-1679.
10. Coase, R.H. (1937). The Nature of the Firm. *Economica*, 4(16), 386-405.
11. Cournot, A.A. (1838). *Recherches sur les Principes Mathematiques de la Theorie des Richesses*.
12. Cowling, K. & Waterson, M. (1976). Price-Cost Margins and Market Structure. *Economica*, 43(171), 267-274.
13. Diamond, P. (1971). A Model of Price Adjustment. *JET*, 3(2), 156-168.
14. Du, Y., Liu, Q. & Rhee, G. (2009). Magnet Effect: Evidence from KRX. *IRF*, 9(1-2), 50-74.
15. Easley, D., Kiefer, N. & O'Hara, M. (1996). Liquidity and Infrequently Traded Stocks. *JF*, 51(4), 1405-1436.
16. Foster, F.D. & Viswanathan, S. (1996). Strategic Trading When Agents Forecast Others' Forecasts. *JF*, 51(4), 1437-1478.
17. Friedman, E., Johnson, S. & Mitton, T. (2003). Propping and Tunneling. *JCE*, 31(4), 732-750.
18. Glosten, L. & Milgrom, P. (1985). Bid, Ask and Transaction Prices. *JFE*, 14(1), 71-100.
19. Grinold, R.C. (1989). Fundamental Law of Active Management. *JPM*, 15(3), 30-37.
20. Grinold, R.C. & Kahn, R.N. (2000). *Active Portfolio Management*. 2nd ed., McGraw-Hill.
21. Grossman, S. & Stiglitz, J. (1980). Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.
22. Herfindahl, O.C. (1950). *Concentration in the U.S. Steel Industry*. PhD Dissertation, Columbia.
23. Hirschman, A.O. (1964). The Paternity of an Index. *AER*, 54(5), 761-762.
24. Holmstrom, B. (1979). Moral Hazard and Observability. *Bell Journal of Economics*, 10(1), 74-91.
25. Hong, H., Lim, T. & Stein, J. (2000). Bad News Travels Slowly. *JF*, 55(1), 265-295.
26. Jensen, M.C. (1986). Agency Costs of Free Cash Flow. *AER*, 76(2), 323-329.
27. Jensen, M.C. & Meckling, W.H. (1976). Theory of the Firm. *JFE*, 3(4), 305-360.
28. Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315-1335.
29. Lerner, A.P. (1934). Monopoly and Monopoly Power. *RES*, 1(3), 157-175.
30. Lo, A.W. (2004). The Adaptive Markets Hypothesis. *JPM*, 30(5), 15-29.
31. Marshall, A. (1890). *Principles of Economics*. Macmillan.
32. Miller, E. (1977). Risk, Uncertainty, and Divergence of Opinion. *JF*, 32(4), 1151-1168.
33. Nash, J. (1950). Equilibrium Points in N-Person Games. *PNAS*, 36(1), 48-49.
34. Nordhaus, W.D. (1975). The Political Business Cycle. *RES*, 42(2), 169-190.
35. Peng, L. & Xiong, W. (2006). Investor Attention and Category Learning. *JFE*, 80(3), 563-602.
36. Roll, R. (1984). Implicit Measure of Bid-Ask Spread. *JF*, 39(4), 1127-1139.
37. Rothschild, M. & Stiglitz, J. (1976). Equilibrium in Competitive Insurance Markets. *QJE*, 90(4), 629-649.
38. Sims, C.A. (2003). Implications of Rational Inattention. *JME*, 50(3), 665-690.
39. Smith, V.L. (1962). Experimental Study of Competitive Market Behavior. *JPE*, 70(2), 111-137.
40. Spence, M. (1973). Job Market Signaling. *QJE*, 87(3), 355-374.
41. Stigler, G.J. (1961). The Economics of Information. *JPE*, 69(3), 213-225.
42. Stigler, G.J. (1971). Theory of Economic Regulation. *Bell Journal of Economics*, 2(1), 3-21.
43. Stoll, H. (1978). Supply of Dealer Services. *JF*, 33(4), 1133-1151.
44. Tobin, J. (1978). Proposal for International Monetary Reform. *EEJ*, 4(3-4), 153-159.
45. US DOJ & FTC (2010). Horizontal Merger Guidelines. Revised August 19, 2010. Section 5.3.
46. Walras, L. (1874). *Elements of Pure Economics*. (1954 Jaffe translation).
47. Williamson, O.E. (1975). *Markets and Hierarchies*. Free Press.
