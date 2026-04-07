# Chapter 4: Confidence Pipeline -- The Core Moat

> **Cross-Reference:** S3_confidence_chain_v7.md (1,117 lines) | D1 P0 Section 1.1
> **Scope:** 10-function multiplicative chain, CONF-1 through CONF-10
> **Source Authority:** `js/appWorker.js` lines 105-1679

---

## 4.1 Pipeline Overview

### What Makes This the Core Moat

The confidence adjustment chain is CheeseStock's central integration point
and its primary differentiator from conventional charting platforms. While
most technical analysis tools display pattern detections at face value,
CheeseStock subjects every detected pattern to a gauntlet of 10
sequential adjustment functions that incorporate macroeconomic regime,
credit risk, derivatives flow, liquidity conditions, and survivorship
bias before the pattern reaches the user's screen.

The result: a pattern's displayed confidence is not merely a measure of
geometric quality -- it is a market-context-aware probability estimate
that degrades appropriately under adverse conditions and strengthens
when multiple independent data sources confirm the pattern's thesis.

### Why Multiplicative, Not Additive

All adjustments use the multiplicative form:

```
   confidence_final = confidence_raw
                      * adj_1 * adj_2 * ... * adj_8
```

An additive model (confidence += delta) would allow a single large
delta to dominate regardless of other factors. Multiplicative
compounding ensures that each factor independently scales confidence,
and adverse factors compound naturally: a pattern in a risk-off,
illiquid, credit-stressed environment faces compounding discounts
that correctly reflect the simultaneous degradation of multiple
independent predictability assumptions.

Each function clamps its own adjustment factor to a function-specific
range before application. After all 8 pattern functions complete,
confidence is clamped to the absolute range:

| Field | Absolute Range | Purpose |
|-------|---------------|---------|
| `confidence` | [10, 100] | Pattern display and rendering priority |
| `confidencePred` | [10, 95] | Prediction confidence (conservative ceiling) |

The 95% ceiling on `confidencePred` embodies a deliberate epistemic
humility: no technical pattern, regardless of how many confirming
factors align, should claim near-certainty about future price
movements.

### Three Identical Call Sites

The chain is invoked identically in three code paths to ensure
consistency regardless of execution context:

| Path | Trigger | When Used |
|------|---------|-----------|
| Worker result | `msg.type === 'result'` | Normal: Worker completes analysis |
| Main thread fallback | `_analyzeOnMainThread()` | Worker unavailable or crashed |
| Drag fallback | `_analyzeDragOnMainThread()` | User drags chart without Worker |

This triple invocation guarantees that a pattern displayed via
Worker analysis, main-thread fallback, or drag-triggered reanalysis
receives identical confidence adjustments -- preventing inconsistent
user experiences between execution paths.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.1

---

## 4.2 Confidence Waterfall

The following diagram traces a hypothetical buy pattern (raw
confidence 65) through the full chain under a risk-off,
low-liquidity, inverted-yield scenario -- the most informative
stress case for demonstrating the chain's behavior.

```
CONFIDENCE WATERFALL
====================
Buy Pattern in Risk-Off / Low-Liquidity Scenario

  Raw (patterns.js quality scoring)
  |
  |  65.0  ##########################################
  |
  |  CONF-1: Market Context (earnings season)
  |  60.5  #####################################  x0.93
  |
  |  CONF-2: RORO Regime (risk-off, buy penalized)
  |  55.6  ##################################  x0.92
  |
  |  CONF-3: Macro (yield slope inverted)
  |  53.9  ################################  x0.97
  |
  |  CONF-4: Micro (high ILLIQ, low liquidity)
  |  45.8  ###########################  x0.85
  |            *** LARGEST SINGLE ADJ ***
  |
  |  CONF-5: Derivatives (basis slightly positive)
  |  47.6  ############################  x1.04
  |
  |  CONF-6: Merton DD (elevated default risk)
  |  45.3  ##########################  x0.95
  |
  |  CONF-7: Phase 8 (MCS neutral, flow weak+)
  |  46.2  ###########################  x1.02
  |
  |  CONF-8: Survivorship (-2% standard)
  |  45.3  ##########################  x0.98
  |
  |  FINAL: 45.3 (clamped to [10, 100])
  |
  |  Effective discount: 65.0 -> 45.3 = -30.3%
  |  Dominant factor: CONF-4 Micro (ILLIQ) -15%

```

**Interpretation:** Under this adverse scenario, the pattern loses
nearly one-third of its raw confidence. The largest single
contributor is CONF-4 (Amihud ILLIQ), reflecting the empirical
reality that illiquid Korean stocks exhibit wider bid-ask spreads
and less reliable pattern signals (Amihud, 2002). CONF-5
(derivatives) provides a modest offset via contango basis, but
the overall chain correctly penalizes buy patterns in an
unfavorable macro environment.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.3

---

## 4.3 Function-by-Function Summary

The following table provides a condensed reference for each of
the 10 confidence functions. Full factor-by-factor documentation
with line numbers and edge cases is available in S3_confidence_chain_v7.md
Sections 3.6.2 through 3.6.11.

| CONF | Function Name | Data Source(s) | Academic Basis | Adj Range | Direction | Grade Mix |
|------|--------------|----------------|----------------|-----------|-----------|-----------|
| 1 | Market Context | market_context.json | Lemmon & Portniaguina (2006), Richards (2005) | [0.55, 1.35] | Buy-focused | 4[D] |
| 2 | RORO Regime | 5-factor composite (macro, bonds, investor) | Baele, Bekaert & Inghelbrecht (2010) | [0.92, 1.08] | Directional | 6[C], 6[D] |
| 3 | Macro 11-Factor | macro_latest, bonds_latest, kosis_latest, macro_composite | IS-LM, Taylor (1993), Stovall (1996), Gilchrist & Zakrajsek (2012) | [0.70, 1.25] | Both | 24[B-C], 21[D] |
| 4 | Micro (ILLIQ/HHI) | Candles (OHLCV), ALL_STOCKS | Amihud (2002), Kyle (1985) | [0.80, 1.15] | Both | 5[B-C] |
| 5 | Derivatives 6-Factor | derivatives, investor, etf, shortselling, basis | Bessembinder & Seguin (1993), Pan & Poteshman (2006) | [0.70, 1.30] | Directional | 6[B-C], 8[D] |
| 6 | Merton DD | Candles, financials, market cap, bonds | Merton (1974), Bharath & Shumway (2008) | [0.75, 1.15] | Directional | 3[A-B], 5[D] |
| 7 | Phase 8 (MCS/HMM/IV) | macro_composite, flow_signals, options_analytics | MCS Doc30, HMM Doc46, Simon & Wiggins (2001) | Final [10,100] | Both | 4[B-C], 4[D] |
| 8 | Survivorship | backtester._survivorshipCorr | Elton, Gruber & Blake (1996) | [0.92, 1.00] | Buy only | 3[C-D] |
| 9 | Signal Macro | macro_latest, bonds_latest (signals path) | Same as CONF-3 | [0.70, 1.25] | Composite-specific | Inherited |
| 10 | Wc Injection | patterns avg wc | Metadata only | No change | Both | N/A |

### Key Design Rationale per Function

**CONF-1 Market Context** applies consumer sentiment (CCSI) and
institutional flow thresholds. CCSI below 85 triggers a 12%
buy-pattern discount, reflecting Lemmon & Portniaguina's finding
that consumer sentiment extremes predict equity returns. The
earnings season flag applies a blanket 7% discount to all patterns
during reporting periods when corporate news dominates price action.

**CONF-2 RORO Regime** classifies a 3-state regime (risk-on /
neutral / risk-off) from a 5-factor weighted composite: VKOSPI/VIX
(0.30), AA- credit spread (0.10), US HY spread (0.10), USD/KRW
(0.20), MCS (0.15), and investor alignment (0.15). Hysteresis
(entry +/-0.25, exit +/-0.10) prevents regime chatter. The clamp
[0.92, 1.08] is deliberately narrow -- see Section 4.6 on
interaction effects.

**CONF-3 Macro 11-Factor** is the most complex function (258 lines,
11 independent factors): business cycle + Stovall sector rotation,
yield curve 4-regime, credit regime (Gilchrist & Zakrajsek 2012),
foreign investor signal, pattern-specific overrides, MCS v1
(with v2 double-application guard), Taylor Rule gap, VRP,
KR-US rate differential, rate beta x interest rate direction
(Damodaran 2012, 12 sectors), and KOSIS CLI-CCI gap.

**CONF-4 Micro** uses Amihud ILLIQ (2002) to discount illiquid
stocks (max 15% discount) and HHI to boost mean-reversion patterns
in concentrated industries (max 10% boost). This addresses the
Samsung 60,000 KRW vs. penny stock 1,000 KRW problem: a pattern
on a highly illiquid micro-cap deserves less confidence than the
same pattern on a liquid large-cap.

**CONF-5 Derivatives 6-Factor** integrates futures basis
(contango/backwardation, using excess basis when available),
PCR contrarian (Pan & Poteshman 2006), investor alignment,
ETF leverage sentiment (contrarian), short selling ratio, and
USD/KRW export channel. Factor 6 (ERP) was removed to prevent
double-application with signalEngine.

**CONF-6 Merton DD** applies the Bharath & Shumway (2008) naive
Distance-to-Default model. Financial sector stocks are excluded
(bank liabilities are operating assets). DD below 1.0 triggers
a 25% buy discount -- the largest single-factor penalty in the
chain. Uses EWMA volatility (lambda=0.94, RiskMetrics 1996)
and the KMV default point convention (0.75 x total liabilities).

**CONF-7 Phase 8** integrates MCS v2 (macro composite score with
double-application guard vs. CONF-3 Factor 6), HMM 3-state regime
classification (quality-gated: requires flowDataCount > 0), per-stock
foreign momentum alignment, and options IV/HV ratio (Simon & Wiggins
2001: when IV exceeds HV by 50%+, pattern accuracy drops 15-20%).

**CONF-8 Survivorship** applies a buy-only discount based on
Elton, Gruber & Blake (1996). With 308 delisted stocks excluded
from the OHLCV dataset, buy-pattern win rates are systematically
inflated. The correction (typically 1-3%, max 8%) is modest but
directionally correct and applies uniformly.

**CONF-9 Signal Macro** targets 5 specific high-conviction
composite signals with macro-conditional adjustments. Notable:
all 5 targets are sell-dominant, reflecting the empirical finding
that Korean bearish patterns have stronger directional
predictability (WR 57-75% vs. bullish 40-47%).

**CONF-10 Wc Injection** injects the average Wc (adaptive weight)
from patterns into signals as metadata. No confidence modification.

> **D2 Source:** S3_confidence_chain_v7.md Sections 3.6.2-3.6.11

---

## 4.4 Data Dependency Map

The following diagram maps which JSON data files feed which CONF
functions. This reveals critical dependency concentrations: the
loss of a single file can degrade multiple confidence functions
simultaneously.

```
DATA DEPENDENCY: JSON Files -> CONF Functions
=============================================

  macro_latest.json ----+-> CONF-2 (VIX, MCS, USD/KRW)
                        +-> CONF-3 (Taylor gap, yield)
                        +-> CONF-9 (Signal macro)

  bonds_latest.json ----+-> CONF-2 (AA- credit spread)
                        +-> CONF-3 (yield levels)
                        +-> CONF-6 (risk-free rate)
                        +-> CONF-9 (Signal macro)

  kosis_latest.json ----+-> CONF-3 (CLI, IPI, CCSI)

  market_context.json --+-> CONF-1 (CCSI, flow, earnings)

  macro_composite.json -+-> CONF-7 (MCS v2)

  investor_summary -----+-> CONF-2 (investor alignment)
                        +-> CONF-5 (foreign/inst flow)

  derivatives_summary --+-> CONF-5 (basis, PCR)

  etf_summary.json -----+-> CONF-5 (leverage ratio)

  shortselling_summary -+-> CONF-5 (short ratio)

  basis_analysis.json --+-> CONF-5 (basis z-score)

  options_analytics ----+-> CONF-7 (implied move, GEX)

  flow_signals.json ----+-> CONF-7 (flow, HMM regime)

  candles (OHLCV) ------+-> CONF-4 (ILLIQ calc)
                        +-> CONF-6 (equity vol calc)

  financials cache -----+-> CONF-6 (debt ratio)

  IMPACT ANALYSIS:
  bonds_latest.json missing -> 4 functions degraded
  macro_latest.json missing -> 3 functions degraded
  investor_summary  missing -> 2 functions degraded

```

**Critical Dependency:** `bonds_latest.json` feeds 4 CONF
functions (CONF-2, CONF-3, CONF-6, CONF-9) -- the highest
fan-out of any single data file. Its absence degrades RORO
regime classification (missing credit spread), macro adjustment
(missing yield levels), Merton DD (missing risk-free rate fallback
used for discounting), and signal-level macro conditioning.

This dependency concentration motivates the pipeline reliability
checks described in Chapter 2 (Section 2.5): verify.py CHECK 6
specifically validates the presence and freshness of each data
file in the pipeline contract.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.4

---

## 4.5 Null-Safety Architecture

Every function in the chain is designed for graceful degradation.
When a data source is unavailable, the function either returns
immediately (no-op) or skips the individual factor, ensuring
that missing data never causes a crash or produces undefined
behavior.

### Guard Strategy by Function

| CONF | Guard Condition | Behavior |
|------|----------------|----------|
| 1 | `_marketContext === null` or `source === 'demo'` | Immediate return |
| 2 | All 5 factors null (`count === 0`) | Regime = neutral, no-op |
| 2 | Fewer than 3 factors available | Score proportionally discounted |
| 3 | `!macro && !bonds` | Immediate return |
| 3 | Individual factor null | That specific factor skipped (11 checks) |
| 4 | `candles.length < 21` | `_microContext = null`, no-op |
| 5 | All derivatives sources null | Immediate return |
| 6 | Financial sector stock | DD computation skipped (meaningless) |
| 6 | Seed financial data | DD computation blocked |
| 7 | `mcsV2 === null` | MCS sub-function skipped |
| 7 | `flowDataCount === 0` | HMM + flow section skipped |
| 8 | `_survivorshipCorr` undefined | Immediate return |

### Loader-Level Source Guards

Before data reaches the chain, the data loaders apply source
guards that nullify unreliable data at the entry point:

| Data | Guard | Effect |
|------|-------|--------|
| `_investorData` | `source === 'sample'` | Set to null |
| `_shortSellingData` | `source === 'sample'` or `'unavailable'` | Set to null |
| `_macroComposite` | `status === 'error'` or sample/demo | Set to null |
| `_optionsAnalytics` | `status === 'error'` or sample/demo | Set to null |

This two-layer guard architecture (loader-level + function-level)
ensures that neither fake data nor missing data can corrupt
confidence adjustments.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.4

---

## 4.6 Interaction Effects

### Deliberate Narrow Clamping (RORO)

CONF-2 (RORO) uses a deliberately narrow clamp of [0.92, 1.08]
-- the tightest in the chain. This is not a limitation but a
design decision to prevent double-counting.

The RORO composite score incorporates VIX (via VKOSPI proxy),
credit spreads, and MCS -- the same variables that appear
individually in CONF-3 (macro) and CONF-7 (Phase 8). Without
the narrow clamp, a VIX spike would be counted three times:
once in RORO factor scoring, once in CONF-3 Factor 8 (VRP),
and once in CONF-7 (MCS v2, which uses VIX as an input).

The narrow clamp ensures RORO provides a directional regime
signal (buy vs. sell bias) without amplifying the magnitude
beyond what the individual factors already contribute.

### MCS Double-Application Guard

MCS (Macro Composite Score) appears in two forms:
- **MCS v1** (simple): CONF-3 Factor 6, applied when v2 unavailable
- **MCS v2** (8-component): CONF-7, applied when available

An explicit guard (CONF-3 line 1218) skips MCS v1 when
`_macroComposite.mcsV2` is available, ensuring MCS is applied
exactly once in the chain -- either v1 or v2, never both.

### Historical Bug Fix: DD Double-Application

Previously, CONF-7 (Phase 8) applied a DD penalty (x0.90 for
DD < 2) on top of CONF-6's Merton DD adjustment (x0.82 for
DD < 1.5). The compound effect was 0.90 x 0.82 = 0.738 -- an
excessive 26% discount that could suppress creditworthy patterns.
This was fixed by removing DD from CONF-7 entirely, ensuring
credit risk is assessed in exactly one place (CONF-6).

### Compound Range Analysis

| Scenario | Compound Effect | Final on Base 50 |
|----------|----------------|-------------------|
| Normal market (1-3 factors) | 0.90 to 1.10 | 45 to 55 |
| Macro stress (contraction + inverted + VIX>30) | ~0.70-0.80 buy | ~35-40 |
| Strong bull (expansion + steep + aligned + MCS) | ~1.15-1.25 buy | ~58-63 |
| Crisis (DD<1.0 + bear + credit stress) | Buy -> floor 10 | 10 |

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.3

---

## 4.7 [D]-Grade Constant Audit: Honest Disclosure

Approximately 40% of the confidence chain's multiplier constants
are graded [D] -- meaning their magnitudes lack empirical
calibration against forward returns. This section provides an
honest accounting of what is and is not validated.

### What [D]-Grade Means

A [D]-grade constant has two properties:

1. **Direction is academically grounded.** The sign of the
   adjustment (which variables move confidence up vs. down) is
   supported by peer-reviewed research. For example, that credit
   stress should reduce buy-pattern confidence is supported by
   Gilchrist & Zakrajsek (2012).

2. **Magnitude is heuristic.** The specific multiplier value
   (e.g., x0.82 for credit stress) was set by domain judgment
   rather than optimized against historical data. The true
   optimal value could be x0.75 or x0.90 -- we do not know.

### High-Sensitivity [D]-Grade Constants

| Constant | Value | Function | Impact | Academic Direction |
|----------|-------|----------|--------|--------------------|
| REGIME_MULT bull buy | 1.10 | CONF-7 | +10% all buy | HMM regime (Doc46) |
| REGIME_MULT bear buy | 0.85 | CONF-7 | -15% all buy | HMM regime (Doc46) |
| CCSI_BEAR_MULT | 0.88 | CONF-1 | -12% buy | Lemmon & Portniaguina (2006) |
| CREDIT_STRESS_MULT | 0.82 | CONF-3 | -18% buy | Gilchrist & Zakrajsek (2012) |
| PCR_MULT | +/-0.08 | CONF-5 | +/-8% | Pan & Poteshman (2006) |
| DD_DANGER_BUY | 0.82 | CONF-6 | -18% buy | Merton (1974), B&S (2008) |
| DD_CRITICAL_BUY | 0.75 | CONF-6 | -25% buy | Merton (1974), B&S (2008) |

### Why This Is Acceptable (and Why It Matters)

The [D]-grade status does not invalidate the confidence pipeline.
It means:

1. **Factor directions are correct.** Illiquid stocks, credit-
   stressed firms, and risk-off regimes genuinely degrade pattern
   predictability. The academic literature is unambiguous on
   direction.

2. **Magnitudes are conservative.** The heuristic multipliers
   were set to be individually small (most < 15%) and compound
   slowly. The chain's multiplicative structure ensures that no
   single factor dominates, and the absolute clamp [10, 100]
   prevents runaway compounding.

3. **The alternative is worse.** Not adjusting for macro/credit/
   liquidity conditions (i.e., displaying raw pattern confidence)
   is demonstrably less accurate. A miscalibrated adjustment in
   the correct direction is better than no adjustment at all.

4. **Calibration path exists.** Each [D]-grade constant has a
   defined calibration procedure: cross-sectional IC testing
   against N-day forward returns, using the existing 303,956
   pattern instance backtest dataset. The infrastructure for
   Walk-Forward Evaluation and BH-FDR multiple testing correction
   (Chapter 6) is already in production.

### Calibration Priority Ranking

| Priority | Target | Rationale |
|----------|--------|-----------|
| 1 | REGIME_CONFIDENCE_MULT (CONF-7) | Applies to ALL patterns; miscalibration = systematic bias |
| 2 | CCSI / Credit / PCR (CONF-1,3,5) | Macro-level, >5% impact per factor |
| 3 | DD tier thresholds (CONF-6) | Step function; jump from 0.95 to 0.82 needs validation |
| 4 | Taylor / FX / CLI (CONF-3) | Small adjustments (<5%), lower priority |
| 5 | Hysteresis thresholds (CONF-2) | Regime switch timing, time-series backtest needed |

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.6

---

## 4.8 Sensitivity Ranking

The following table ranks all 8 pattern-affecting functions by
their maximum single-factor impact, providing a quick reference
for understanding which functions drive the largest confidence
movements.

| Rank | Function | Max Impact | Trigger Frequency |
|------|----------|-----------|-------------------|
| 1 | CONF-6 Merton DD | -25% buy | Rare (credit-impaired only) |
| 2 | CONF-3 Macro 11-Factor | [0.70, 1.25] | Always (if macro data loaded) |
| 3 | CONF-5 Derivatives | [0.70, 1.30] | When derivatives data available |
| 4 | CONF-7 Phase 8 HMM | +/-15% regime | When flow_signals has data |
| 5 | CONF-1 Market Context | -12% to +8% | When market_context loaded |
| 6 | CONF-4 Micro ILLIQ | -15% to +10% | Always (computed from candles) |
| 7 | CONF-2 RORO Regime | -8% to +6% | Always (>=1 factor available) |
| 8 | CONF-8 Survivorship | -8% max | When backtester loaded |

**Notable asymmetry:** The buy-side penalty maximum (-25% from
Merton DD) significantly exceeds the sell-side penalty maximum.
This reflects the deliberate design philosophy that the system
should be more cautious about buy signals than sell signals --
consistent with the empirical finding that buy-pattern win rates
are more fragile under adverse conditions than sell-pattern win
rates in the Korean market.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.3

---

## 4.9 Chapter Summary

The confidence adjustment chain transforms raw pattern detections
into market-context-aware confidence scores through 10 sequential
multiplicative functions. Its key properties are:

1. **Multiplicative compounding** ensures independent factor
   contributions without single-factor dominance.

2. **Graceful degradation** via comprehensive null-safety means
   missing data produces neutral adjustments, never crashes.

3. **Narrow RORO clamping** prevents double-counting of shared
   variables (VIX, credit, MCS) across functions.

4. **Academic grounding** for all factor directions, with honest
   disclosure of [D]-grade magnitude heuristics.

5. **Triple call-site consistency** guarantees identical user
   experience across Worker, main-thread, and drag execution paths.

6. **Data dependency concentration** (bonds_latest.json feeds 4
   functions) motivates the pipeline reliability checks described
   in Chapter 2.

The chain's current IC of 0.051 (Chapter 6) confirms modest but
statistically significant predictive value -- appropriate for
short-horizon technical analysis and consistent with the system's
philosophy of honest, calibration-aware confidence reporting.

---

| D4 Section | D2 Source | D1 Source |
|------------|----------|----------|
| 4.1 Pipeline overview | S3_confidence_chain_v7.md 3.6.1 | P0 Section 1.1 |
| 4.2 Waterfall | S3_confidence_chain_v7.md 3.6.3 | -- |
| 4.3 Function table | S3_confidence_chain_v7.md 3.6.2-3.6.11 | P0 Section 2.3 |
| 4.4 Data dependency | S3_confidence_chain_v7.md 3.6.4 | -- |
| 4.5 Null safety | S3_confidence_chain_v7.md 3.6.4 | -- |
| 4.6 Interaction effects | S3_confidence_chain_v7.md 3.6.3 | -- |
| 4.7 D-grade audit | S3_confidence_chain_v7.md 3.6.6 | P0 Section 5.1 |
| 4.8 Sensitivity ranking | S3_confidence_chain_v7.md 3.6.3 | -- |
