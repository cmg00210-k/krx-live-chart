# 3.6 Confidence Adjustment Chain -- Production Anatomy V7

> **Stage 3 -- ANATOMY V7 Section 3.6**
>
> Author: CFA Financial Analyst Agent
> Date: 2026-04-06
> Source Authority: `js/appWorker.js` (1,763 lines), `js/appState.js` (globals)
> Chain Entry Points: lines 105-125 (Worker path), lines 1659-1679 (main thread fallback), lines 1719-1727 (drag fallback)
> Cross-refs: `pattern_impl/05_confidence_chain.md` (1,063 lines), S1 (API pipeline), S2.5-S2.8 (theory)

---

## 3.6.1 Chain Overview

### What the Chain Does

The confidence adjustment chain is the central integration point of the CheeseStock analysis pipeline. After `patternEngine.analyze()` produces raw pattern detections with initial confidence scores (set by pattern quality, signal strength, and ATR normalization in `patterns.js`), these 10 sequential functions adjust each pattern's `confidence` field using macro, micro, derivatives, credit, sentiment, regime, and survivorship data. The chain transforms a pattern-intrinsic confidence into a market-context-aware confidence that drives rendering priority, panel display order, and Wc weighting.

### Execution Order (Fixed, Sequential)

```
patternEngine.analyze(candles)
         |
         v
  confidence_raw (0-100, from patterns.js)
         |
  1. _applyMarketContextToPatterns()        <- market_context.json
  2. _classifyRORORegime() +
     _applyRORORegimeToPatterns()            <- 5-factor composite (macro_latest, bonds_latest, investor_summary)
  3. _applyMacroConfidenceToPatterns()       <- macro_latest.json, bonds_latest.json, kosis_latest.json, macro_composite.json
  4. _updateMicroContext() +
     _applyMicroConfidenceToPatterns()       <- candles (ILLIQ), ALL_STOCKS (HHI)
  5. _applyDerivativesConfidenceToPatterns() <- derivatives_summary, investor_summary, etf_summary, shortselling_summary, basis_analysis
  6. _calcNaiveDD() +
     _applyMertonDDToPatterns()              <- candles, _financialCache, sidebarManager.MARKET_CAP, bonds_latest
  7. _applyPhase8ConfidenceToPatterns()      <- macro_composite.json, flow_signals.json, options_analytics.json
  8. _applySurvivorshipAdjustment()          <- backtester._survivorshipCorr
         |
         v
  confidence_final (clamped [10, 100])
  confidencePred_final (clamped [10, 95])
         |
  9. _applyMacroConditionsToSignals()        <- macro_latest, bonds_latest (signals path, not patterns)
 10. _injectWcToSignals()                    <- patterns avg wc (no confidence change)
```

### Mechanism: Pure Multiplicative Pipeline

All adjustments use the multiplicative form `p.confidence *= adj` where `adj` is a per-function adjustment factor. Each function independently clamps its own `adj` to a function-specific range before applying. After application, `p.confidence` is clamped to absolute `[10, 100]` and `p.confidencePred` to `[10, 95]`.

Functions 1-8 operate on **patterns** (output of `patternEngine.analyze()`).
Function 9 operates on **signals** (output of `signalEngine.analyze()`).
Function 10 injects metadata (Wc) without modifying confidence.

### Three Identical Call Sites

The chain is invoked identically in three code paths, ensuring consistency:

| Path | Location | Trigger |
|------|----------|---------|
| Worker result | appWorker.js lines 106-125 | Worker `msg.type === 'result'` (normal analysis) |
| Main thread fallback | appWorker.js lines 1659-1679 | `_analyzeOnMainThread()` (Worker unavailable) |
| Drag fallback | appWorker.js lines 1719-1727 | `_analyzeDragOnMainThread()` (drag without Worker) |

### Overall Clamp Ranges

| Field | Absolute Range | Enforced by |
|-------|---------------|-------------|
| `confidence` | [10, 100] | Each function + Phase8 final clamp (line 630) |
| `confidencePred` | [10, 95] | Each function + Phase8 final clamp (line 634) |

---

## 3.6.2 Function-by-Function Documentation

---

### CONF-1: `_applyMarketContextToPatterns(patterns)`

**Purpose:** Adjust pattern confidence using consumer sentiment (CCSI), foreign institutional flow, and earnings season status.

**Data Source:** `data/market_context.json` -> `_marketContext` (appState.js line 253)

**Academic Basis:**
- CCSI thresholds: Lemmon & Portniaguina (2006) "Consumer Confidence and Asset Prices" -- consumer sentiment extremes predict equity returns. CFA Level III behavioral finance curriculum.
- Foreign flow: Richards (2005) "Big Fish in Small Ponds" -- informed flow threshold ~$75M (~1,000 billion KRW).
- Earnings season discount: Empirical observation that pattern predictability degrades during reporting periods.

**Execution Order:** 1 of 10

**appWorker.js:** lines 1016-1051

**Adjustment Factors:**

| Factor | Condition | Adjustment | Direction | Range | Grade | Line |
|--------|-----------|------------|-----------|-------|-------|------|
| CCSI bear | `ccsi < 85` | x0.88 | buy only | -12% | [D] | 1031 |
| CCSI bull | `ccsi > 108` | x1.06 | buy only | +6% | [D] | 1032 |
| Foreign net buy | `net_foreign_eok > 1000` | x1.08 | buy only | +8% | [D] | 1036 |
| Earnings season | `earning_season === 1` | x0.93 | both | -7% | [D] | 1039 |

**Clamp:** `[0.55, 1.35]` (line 1042)

**Data Flow:**
```
download_market_context.py -> data/market_context.json -> fetch in app.js init()
  -> _marketContext (appState.js line 253) -> this function -> p.confidence *= adj
```

**Edge Cases:**
- `_marketContext === null`: immediate return, no-op (line 1017)
- `_marketContext.source === 'demo'`: immediate return, demo data is not real (line 1018)
- Individual fields `null`: each factor independently skipped via null check (lines 1030, 1036, 1039)

**Sensitivity Analysis:** Maximum compound: CCSI<85 x earning_season = 0.88 x 0.93 = 0.818 (buy). Maximum boost: CCSI>108 x foreign>1000 = 1.06 x 1.08 = 1.145 (buy).

**[D]-Grade Flag:** All 4 multiplier values (0.88, 1.06, 1.08, 0.93) lack empirical calibration. CCSI thresholds (85, 108) are grounded in Lemmon & Portniaguina but multiplier magnitudes are heuristic. Foreign threshold 1000 is [B] (Richards 2005 ~$75M at KRW/USD 1300 era).

---

### CONF-2: `_classifyRORORegime()` + `_applyRORORegimeToPatterns(patterns)`

**Purpose:** Classify a 3-state Risk-On/Risk-Off/Neutral regime using a 5-factor composite score, then apply directional bias to patterns.

**Data Source:** Composite of 5 data sources:

| Factor | Weight | Source Variable | JSON File |
|--------|--------|----------------|-----------|
| VKOSPI/VIX | 0.30 | `_marketContext.vkospi` -> `_macroLatest.vkospi` -> `_macroLatest.vix * VIX_VKOSPI_PROXY` | vkospi.json / macro_latest.json |
| AA- credit spread | 0.10 | `_bondsLatest.credit_spreads.aa_spread` | bonds_latest.json |
| US HY spread | 0.10 | `_macroLatest.us_hy_spread` | macro_latest.json |
| USD/KRW level | 0.20 | `_macroLatest.usdkrw` | macro_latest.json |
| MCS v1 | 0.15 | `_macroLatest.mcs` | macro_latest.json |
| Investor alignment | 0.15 | `_investorData.alignment` | investor_summary.json |

**Academic Basis:** Baele, Bekaert & Inghelbrecht (2010) "The Determinants of Stock and Bond Return Comovements", RFS 23(6). Risk-on/risk-off framework for cross-asset regime classification. VIX_VKOSPI_PROXY = 1.12 from Whaley (2009).

**Execution Order:** 2 of 10

**appWorker.js:** Classification: lines 1339-1450. Application: lines 1455-1477.

**RORO Score Classification:**

| Score Range | Regime |
|-------------|--------|
| >= +0.25 | risk-on |
| <= -0.25 | risk-off |
| -0.25 to +0.25 | neutral |

Hysteresis: entry +/-0.25, exit +/-0.10 (prevents regime chatter).

**Individual Factor Scoring (inside `_classifyRORORegime`):**

| Factor | Value | Score |
|--------|-------|-------|
| VKOSPI > 30 | crisis | -1.0 |
| VKOSPI > 22 | elevated | -0.5 |
| VKOSPI < 15 | calm | +0.5 |
| VKOSPI 15-22 | normal | 0.0 |
| AA spread > 1.5 | stress | -1.0 |
| AA spread > 1.0 | elevated | -0.5 |
| AA spread < 0.5 | tight | +0.3 |
| US HY > 5.0 | stress | -1.0 |
| US HY > 4.0 | elevated | -0.5 |
| US HY < 3.0 | tight | +0.3 |
| USD/KRW > 1450 | crisis | -1.0 |
| USD/KRW > 1350 | weak KRW | -0.5 |
| USD/KRW < 1200 | strong KRW | +0.5 |
| USD/KRW < 1100 | very strong | +1.0 |
| MCS > 0.6 | bullish | up to +1.0 |
| MCS < 0.4 | bearish | down to -1.0 |
| aligned_buy | foreign+inst | +0.8 |
| aligned_sell | foreign+inst | -0.8 |

**Normalization:** `normalizedScore = score * min(count/3, 1.0)` -- if fewer than 3 factors have data, score is proportionally discounted (line 1427).

**Adjustment Application:**

| Regime | Buy Adj | Sell Adj |
|--------|---------|----------|
| risk-on | x1.06 | x0.94 |
| risk-off | x0.92 | x1.08 |
| neutral | 1.00 (no-op) | 1.00 (no-op) |

**Clamp:** `[0.92, 1.08]` (line 1471) -- deliberately narrow to prevent double-counting with Factor 3 (credit) and Factor 8 (VIX) in the macro chain.

**Constants:**

| Constant | Value | Grade | Line | Sensitivity |
|----------|-------|-------|------|-------------|
| VOL_WEIGHT | 0.30 | [C] | 1360 | Factor weighting heuristic |
| CREDIT_AA_WEIGHT | 0.10 | [C] | 1373 | |
| CREDIT_HY_WEIGHT | 0.10 | [C] | 1383 | |
| FX_WEIGHT | 0.20 | [C] | 1396 | |
| MCS_WEIGHT | 0.15 | [C] | 1405 | |
| FLOW_WEIGHT | 0.15 | [C] | 1417 | |
| ENTER_ON | +0.25 | [D] | 1430 | Regime switching threshold |
| ENTER_OFF | -0.25 | [D] | 1430 | |
| EXIT_ON | +0.10 | [D] | 1431 | Hysteresis exit |
| EXIT_OFF | -0.10 | [D] | 1431 | |
| RISK_ON_BUY | 1.06 | [D] | 1461 | +6% directional bias |
| RISK_OFF_BUY | 0.92 | [D] | 1463 | -8% directional bias |
| VIX_VKOSPI_PROXY | 1.12 | [B] | appState.js line 42 | Whaley (2009) |

**Edge Cases:**
- `count === 0` (all data sources null): regime='neutral', score=0, no adjustment (line 1422-1425)
- `count < 3`: proportional discount applied to score (line 1427)
- `p.signal !== 'buy' && p.signal !== 'sell'`: neutral patterns skipped (line 1468)

**[D]-Grade Flag:** All 4 regime thresholds (0.25, -0.25, 0.10, -0.10) and 2 regime multipliers (1.06/0.92, 0.94/1.08) are heuristic. The 6 factor weights sum to 1.00 but their relative allocation is not empirically optimized.

---

### CONF-3: `_applyMacroConfidenceToPatterns(patterns)`

**Purpose:** Apply 11 independent macroeconomic factors to pattern confidence. This is the most complex single adjustment function in the chain (258 lines, lines 1071-1328).

**Data Source:**

| Variable | JSON File | Python Script |
|----------|-----------|---------------|
| `_macroLatest` | `data/macro/macro_latest.json` | `scripts/download_ecos.py` |
| `_bondsLatest` | `data/macro/bonds_latest.json` | `scripts/download_ecos.py` |
| `_kosisLatest` | `data/macro/kosis_latest.json` | `scripts/download_kosis.py` |
| `_macroComposite` | `data/macro/macro_composite.json` | `scripts/compute_mcs.py` |

**Academic Basis:** IS-LM (Doc30), AD-AS (Doc30 section 2), Mundell-Fleming (Doc30 section 1.4), Yield Curve Regime (Doc35 section 3), MCS (Doc29 section 6.2), Stovall (1996) Sector Investing, Taylor Rule (Doc30 section 4.1), Carr-Wu (2009) VRP, Damodaran (2012) rate beta.

**Execution Order:** 3 of 10

**appWorker.js:** lines 1071-1328

**11 Factors (in execution order within function):**

#### Factor 1: Business Cycle + Stovall Sector Rotation (lines 1095-1116)

| Phase | Default Buy | Default Sell | Stovall Override |
|-------|------------|-------------|-----------------|
| expansion | x1.06 | x0.94 | Sector-specific via `_STOVALL_CYCLE` |
| peak | x0.95 | x1.08 | |
| contraction | x0.92 | x1.08 | |
| trough | x1.10 | x0.90 | |

Stovall table (`appState.js` lines 414-432): 12 sectors x 4 phases = 48 values. Range: [0.88, 1.14]. Grade: [B] (Stovall 1996 academic source). Sell multiplier = `2.0 - buyMult` (symmetric inversion).

#### Factor 2: Yield Curve 4-Regime (lines 1118-1150)

| Condition | Buy Adj | Sell Adj | Grade |
|-----------|---------|----------|-------|
| Inverted (`slope < 0`) | x0.88 | x1.12 | [B] (Doc35) |
| Bull Steepening (`taylorGap<0, slope>0.2`) | x1.06 | x0.95 | [C] |
| Bull Flattening (`taylorGap<0, slope<=0.2`) | x0.97 | x1.03 | [C] |
| Bear Steepening (`taylorGap>0, slope>0.2`) | x0.95 | x1.04 | [C] |
| Bear Flattening (`taylorGap>0, slope<=0.2`) | x0.90 | x1.10 | [C] |
| Fallback: `slope < 0.15` | x0.96 | x1.04 | [D] |
| Fallback: `slope > 0.5` | x1.04 | x0.97 | [D] |

#### Factor 3: Credit Regime (lines 1152-1161)

| Condition | Buy Adj | Sell Adj | Grade |
|-----------|---------|----------|-------|
| `aaSpread > 1.5` or `creditRegime === 'stress'` | x0.82 | x1.06 | [B] multiplier (Gilchrist & Zakrajsek 2012), [B] threshold |
| `aaSpread > 1.0` or `creditRegime === 'elevated'` | x0.93 | x1.04 | [D] multiplier, [B] threshold |

**V7 Update:** Symmetric x0.85/x0.85 replaced with asymmetric `isBuy ? 0.82 : 1.06`. Credit stress degrades buy patterns more (-18%) while confirming sell patterns (+6%). Academic basis: Gilchrist, S. & Zakrajsek, E. (2012), "Credit Spreads and Business Cycle Fluctuations," *AER* 102(4), 1692-1720. Code: `appWorker.js` line 1198.

#### Factor 4: Foreign Investor Signal (lines 1163-1172)

| Condition | Buy Adj | Sell Adj | Grade |
|-----------|---------|----------|-------|
| `foreigner_signal > +0.3` | x1.05 | x0.96 | [D] all |
| `foreigner_signal < -0.3` | x0.95 | x1.05 | [D] all |

Based on UIP and Mundell-Fleming capital flow theory (Doc28 section 8).

#### Factor 5: Pattern-Specific Override (lines 1174-1210)

| Pattern | Condition | Extra Adj | Grade |
|---------|-----------|-----------|-------|
| doubleTop (sell) | contraction/peak + inverted/flat | x1.10 | [D] |
| doubleBottom (buy) | trough + slope > 0.3 | x1.12 | [D] |
| bearishEngulfing (sell) | cliDelta < -0.1 | x1.06 | [D] |
| hammer (buy) | trough/contraction | x1.06 | [D] |
| hammer (buy) | expansion/peak | x0.96 | [D] |
| invertedHammer (buy) | trough/contraction | x1.05 | [D] |
| invertedHammer (buy) | expansion/peak | x0.97 | [D] |

These compound with previous factors. A doubleTop in contraction + inverted can receive Factor 2 (x0.88 buy) + Factor 5 (x1.10 sell) simultaneously.

#### Factor 6: MCS v1 (lines 1212-1226)

```
if mcs > 0.6:  mcsAdj = 1.0 + (mcs - 0.6) * 0.25   -> buy x mcsAdj, sell x (2 - mcsAdj)
if mcs < 0.4:  mcsAdj = 1.0 + (0.4 - mcs) * 0.25   -> buy x (2 - mcsAdj), sell x mcsAdj
```

**Double-application guard:** If `_macroComposite.mcsV2` is available, this Factor 6 (v1) is skipped to prevent MCS being applied twice (line 1218). MCS v2 is applied in CONF-7 instead.

MCS range [0, 1]. Neutral band: [0.4, 0.6]. Max adj at MCS=1.0: `1 + 0.4*0.25 = 1.10`. Grade: MCS_SENSITIVITY 0.25 is [D], MCS_NEUTRAL_RANGE [0.4, 0.6] is [C].

#### Factor 7: Taylor Rule Gap (lines 1228-1254)

```
tgNorm = clamp(taylorGap / 2, -1, +1)
if tgNorm < -0.25 (dovish):  tAdj = 1 + |tgNorm| * 0.05 -> buy boost
if tgNorm > +0.25 (hawkish): tAdj = 1 + |tgNorm| * 0.05 -> sell boost
Dead band: |tgNorm| <= 0.25 -> no adjustment
```

Sign convention: `taylor_gap = i_actual - i_Taylor`. Positive = overtly tight (hawkish), negative = overtly loose (dovish). Maximum adjustment: +/-5% at full normalization. Grade: TAYLOR_DEAD_BAND 0.25 is [B] (Taylor 1993 framework), TAYLOR_MAX_ADJ 0.05 is [D].

#### Factor 8: VRP - Volatility Risk Premium (lines 1256-1269)

| VIX Level | Buy Adj | Sell Adj | Grade |
|-----------|---------|----------|-------|
| > 30 (crisis) | x0.93 | x0.93 | [A] threshold, [D] multiplier |
| 25-30 (elevated) | x0.97 | x1.02 | [A] threshold |
| < 15 (low vol) | x1.03 | x0.98 | [A] threshold |

Reference: Carr & Wu (2009) VRP framework (Doc26 section 3). VIX thresholds are [A]-grade (well-established market convention). Multiplier magnitudes are [D] (heuristic).

#### Factor 9: KR-US Rate Differential (lines 1271-1283)

| rate_diff = bok_rate - fed_rate | Buy Adj | Sell Adj | Grade |
|---------------------------------|---------|----------|-------|
| < -1.5 (strong outflow) | x0.95 | x1.04 | [C] threshold, [D] multiplier |
| -1.5 to -0.5 (mild outflow) | x0.98 | x1.02 | [C] threshold |
| > +1.0 (Korean advantage) | x1.03 | x0.98 | [C] threshold |

Theory: Mundell-Fleming extension (Doc30 section 1.4). Current value at data time: -1.14pp (significant outflow pressure).

#### Factor 10: Rate Beta x Interest Rate Direction (lines 1285-1301)

```
rateDir = clamp(taylorGap / 2, -1, +1)
levelAmp = (ktb10y > 4.0) ? 1.5 : 1.0
rateAdj = rateDir * rBeta * levelAmp
adj *= isBuy ? (1 + rateAdj) : (1 - rateAdj)
```

`_RATE_BETA` table (appState.js lines 472-485): 12 sectors, range [-0.08, +0.05]. Source: Damodaran (2012). Grade: [B] for beta values, [D] for `KTB10Y_AMP_MULT = 1.5`, [C] for `KTB10Y_HIGH_AMP = 4.0`.

Maximum impact: `1.0 * 0.08 * 1.5 = +/-0.12` (12% swing for utility sector in high-rate hawkish environment).

#### Factor 11: KOSIS CLI-CCI Gap (lines 1303-1316)

| cli_cci_gap (CLI - CCI) | Buy Adj | Sell Adj | Grade |
|--------------------------|---------|----------|-------|
| > +5 (leading > coincident) | x1.04 | x0.97 | [C] threshold, [D] multiplier |
| < -5 (leading < coincident) | x0.97 | x1.04 | [C] threshold |

**Overall Clamp:** `[0.70, 1.25]` (line 1319)

**Edge Cases:**
- `!macro && !bonds`: immediate return, no-op (line 1075)
- Each of the 11 factors independently null-checks its input before applying (null data -> factor skipped)
- `_macroSector` null (KSIC mapping failure): Stovall sector override skipped, default cycle multipliers used (line 1104)

**Expected Effect Range:**
- Typical (1-3 factors active): 0.85x to 1.15x
- Maximum theoretical (all 11 adverse, buy): clamped to 0.70x floor
- Maximum boost (all 11 bullish, sell): clamped to 1.25x ceiling
- Pattern-specific overrides compound on top

**[D]-Grade Flags:** 21 of 45+ constants in this function are [D]-grade. Highest sensitivity: CREDIT_STRESS_MULT (0.85, -15% all patterns), doubleTop/doubleBottom overrides (+10/12%), Factor 10 rate beta amplifier (1.5x at high rates).

---

### CONF-4: `_updateMicroContext(candles)` + `_applyMicroConfidenceToPatterns(patterns, microCtx)`

**Purpose:** Adjust pattern confidence using stock-specific liquidity (Amihud ILLIQ) and industry concentration (HHI mean-reversion boost).

**Data Source:** Real-time computation from candles and ALL_STOCKS.

| Item | Source | Computation |
|------|--------|-------------|
| `_microContext.illiq` | `calcAmihudILLIQ(candles)` (indicators.js line 1430) | 20-day Amihud ratio |
| `_microContext.hhiBoost` | `ALL_STOCKS` market cap by industry | HHI of sector market cap shares |

**Academic Basis:**
- Amihud (2002) "Illiquidity and stock returns" -- illiquid stocks have wider bid-ask spreads and less reliable pattern signals. CFA Level II equity valuation.
- Kyle (1985) information asymmetry framework.
- HHI mean-reversion: Doc33 section 6.2. Concentrated industries exhibit stronger mean-reversion (monopolistic pricing power).

**Execution Order:** 4 of 10

**appWorker.js:** Computation: lines 1482-1512. Application: lines 1523-1556.

**Adjustment Factors:**

| Factor | Condition | Adjustment | Range | Grade | Line |
|--------|-----------|------------|-------|-------|------|
| ILLIQ discount | `logIlliq > -1` (illiquid) | x0.85 (max discount) | [0.85, 1.0] | [C] | 1536-1538 |
| ILLIQ discount | `logIlliq < -3` (liquid) | x1.00 (no discount) | | [C] | |
| HHI boost | mean-rev patterns + `hhi > 0` | x(1 + 0.10*HHI) | [1.0, 1.10] | [C] | 1542-1543 |

Mean-reversion patterns receiving HHI boost: `doubleBottom`, `doubleTop`, `headAndShoulders`, `inverseHeadAndShoulders` (line 1526-1529).

**Clamp:** `[0.80, 1.15]` (line 1547)

**Data Flow:**
```
candles (OHLCV) -> calcAmihudILLIQ() [indicators.js] -> illiq.confDiscount
ALL_STOCKS -> filter by industry -> market cap shares -> HHI -> hhiBoost
  -> _microContext -> this function -> p.confidence *= adj
```

**Edge Cases:**
- `candles.length < 21`: `_microContext = null`, no-op (line 1483)
- `calcAmihudILLIQ` unavailable (function missing): illiq = null, ILLIQ factor skipped (line 1484)
- `sectorCaps.length < 2`: HHI not computable, hhiBoost = 0 (line 1499)
- `microCtx === null`: immediate return (line 1524)

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| ILLIQ_WINDOW | 20 | [B] | Amihud (2002) standard |
| ILLIQ_CONF_DISCOUNT | 0.85 | [C] | Max discount for illiquid stocks |
| LOG_ILLIQ_HIGH | -1.0 | [C] | logIlliq > -1 = highly illiquid |
| LOG_ILLIQ_NORMAL | -3.0 | [C] | logIlliq < -3 = normal liquidity |
| HHI_MEAN_REV_COEFF | 0.10 | [C] | Doc33 section 6.2, constant #119 |

---

### CONF-5: `_applyDerivativesConfidenceToPatterns(patterns)`

**Purpose:** Adjust pattern confidence using 6 active derivatives/supply-demand factors (7th factor ERP removed to prevent double-application with signalEngine).

**Data Source:**

| Variable | JSON File | Python Script |
|----------|-----------|---------------|
| `_derivativesData` | `data/derivatives/derivatives_summary.json` | `scripts/download_derivatives.py` |
| `_investorData` | `data/derivatives/investor_summary.json` | `scripts/download_investor.py` |
| `_etfData` | `data/derivatives/etf_summary.json` | `scripts/download_etf.py` |
| `_shortSellingData` | `data/derivatives/shortselling_summary.json` | `scripts/download_shortselling.py` |
| `_derivativesData.basis` | `data/derivatives/basis_analysis.json` (merged) | `scripts/compute_basis.py` |
| `_macroLatest.usdkrw` | `data/macro/macro_latest.json` | `scripts/download_ecos.py` |

**Academic Basis:** Bessembinder & Seguin (1993) basis, Pan & Poteshman (2006) PCR, Choe/Kho/Stulz (2005) investor flow, Cheng & Madhavan (2009) ETF leverage, Desai et al. (2002) short interest, Doc28 section 3 FX beta.

**Execution Order:** 5 of 10

**appWorker.js:** lines 711-825

**6 Active Factors:**

#### Factor 1: Futures Basis (lines 742-758)

| Condition | Normal (abs>=0.5%) | Extreme (abs>=2.0%) |
|-----------|-------------------|---------------------|
| Contango (`excessBasisPct >= 0.5`, fallback: `basisPct`) | buy +5%, sell -5% | buy +8%, sell -8% |
| Backwardation (`excessBasisPct < 0`, fallback: `basisPct`) | buy -5%, sell +5% | buy -8%, sell +8% |

Grade: [B] thresholds (0.5%, 2.0%), [D] multipliers (0.05, 0.08).

**V7 Update:** `excessBasisPct` (carry-cost-removed basis) is now the priority source, with `basisPct` as fallback when excess basis is unavailable. Code: `appWorker.js` lines 772-773.

#### Factor 2: PCR Contrarian (lines 760-769)

| Condition | Buy Adj | Sell Adj | Grade |
|-----------|---------|----------|-------|
| PCR > 1.3 (extreme fear) | x1.08 | x0.92 | [B] threshold, [D] mult |
| PCR < 0.5 (extreme greed) | x0.92 | x1.08 | [B] threshold, [D] mult |

#### Factor 3: Investor Alignment (lines 771-782)

| Condition | Buy Adj | Sell Adj | Grade |
|-----------|---------|----------|-------|
| `aligned_buy` (foreign+institutional co-buy) | x1.08 | x0.93 | [D] |
| `aligned_sell` (foreign+institutional co-sell) | x0.93 | x1.08 | [D] |

Note: `alignment` field supports both object `{signal_1d}` and string formats (line 774-775, C-2 FIX).

#### Factor 4: ETF Leverage Sentiment -- Contrarian (lines 784-792)

| Condition | Buy Adj | Sell Adj | Grade |
|-----------|---------|----------|-------|
| `strong_bullish` | x0.95 | x1.05 | [D] |
| `strong_bearish` | x1.05 | x0.95 | [D] |

Contrarian logic: extreme bullish sentiment signals overbought, and vice versa.

#### Factor 5: Short Selling Ratio (lines 794-805)

| Condition | Buy Adj | Sell Adj | Grade |
|-----------|---------|----------|-------|
| `market_short_ratio > 10%` | x1.06 | x0.94 | [C] threshold, [D] mult |
| `market_short_ratio < 2%` | x0.97 | x1.03 | [C] threshold, [D] mult |

High short interest -> short squeeze potential (contrarian buy signal).

#### Factor 6: ERP -- REMOVED (line 807)

Handled exclusively by `signalEngine._detectERPSignal()` to prevent double-application.

#### Factor 7: USD/KRW Export Channel (lines 809-814)

| Condition | Buy Adj | Sell Adj | Sectors |
|-----------|---------|----------|---------|
| `USD/KRW > 1400` (KRW weak) | x1.05 | x0.95 | semiconductor, tech, cons_disc, industrial |
| `USD/KRW < 1300` (KRW strong) | x0.95 | x1.05 | same |

Non-export sectors: no adjustment. Export sector detection via `_EXPORT_SECTORS` lookup (line 730-731).

Grade: [C] thresholds (1400, 1300), [D] multiplier (0.05). Based on Doc28 section 3, beta_FX +/-5%.

**Overall Clamp:** `[0.70, 1.30]` (line 817)

**Edge Cases:**
- `!deriv && !investor && !etf && !shorts`: immediate return (line 722)
- `_derivativesData` is array: last element used (line 716, C-1 FIX)
- Sample/demo data guards: `_investorData.source === 'sample'` -> null (loader line 424), `_shortSellingData.source === 'sample'|'unavailable'` -> null (loader line 430)
- `alignment` field format polymorphism: object or string handled (line 774-775)
- `market_short_ratio` fallback: also checks `marketTrend[-1].shortRatio` (line 798-799)

**Expected Effect Range:**
- Typical (2-3 factors): 0.85x to 1.15x
- Maximum (all 6 aligned): theoretical ~0.66x (clamped 0.70) to ~1.46x (clamped 1.30)

---

### CONF-6: `_calcNaiveDD(candleCloses)` + `_applyMertonDDToPatterns(patterns)`

**Purpose:** Apply Merton (1974) Distance-to-Default credit risk gating. High default probability stocks get buy-pattern discounts and sell-pattern boosts. Financial sector stocks excluded (debt is operating asset, DD meaningless).

**Data Source:**

| Item | Source |
|------|--------|
| `_currentDD` | Computed from candle closes, financials, and market cap |
| Market cap (E) | `sidebarManager.MARKET_CAP[code]` or `currentStock.marketCap` |
| Total liabilities (D) | `_financialCache[code]` -> `total_liabilities * 0.75` |
| Equity vol (sigma_E) | `calcEWMAVol(closes)` x sqrt(250) annualized |
| Risk-free rate (r) | `_bondsLatest.yields.ktb_3y` -> fallback 3.5% |

**Academic Basis:** Merton (1974) structural credit model, Bharath & Shumway (2008) "Forecasting Default with the Merton Distance to Default Model" -- simplified (naive) DD computation. CFA Level II fixed income / credit analysis. KMV default point = 0.75 x total liabilities (industry convention). EWMA lambda = 0.94 from RiskMetrics (1996).

**Execution Order:** 6 of 10

**appWorker.js:** DD computation: lines 850-915. Application: lines 923-951. Normal CDF: lines 837-845 (Abramowitz & Stegun 1964 approximation).

**DD Formula (Naive DD, Bharath & Shumway 2008):**

```
V = E + D                                          (asset value approximation)
sigma_V = sigma_E * (E/V) + 0.05 * (D/V)          (asset volatility approximation)
DD = [ln(V/D) + (r - 0.5 * sigma_V^2) * T] / (sigma_V * sqrt(T))
EDF = Phi(-DD)                                      (expected default frequency)
```

Where T = 1 year.

**Adjustment Application:**

| DD Range | Buy Adj | Sell Adj | Interpretation |
|----------|---------|----------|----------------|
| DD >= 2.0 | no-op | no-op | Safe |
| 1.5 <= DD < 2.0 | x0.95 | x1.02 | Warning |
| 1.0 <= DD < 1.5 | x0.82 | x1.12 | Danger |
| DD < 1.0 | x0.75 | x1.15 | Critical |

**Clamp:** `[0.75, 1.15]` (line 945)

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| DD_SAFE | 2.0 | [A] | Moody's KMV industry standard |
| DD_WARNING | 1.5 | [A] | Doc35 section 6.4, constant #134 |
| DD_DANGER | 1.0 | [C] | |
| DEFAULT_POINT_RATIO | 0.75 | [B] | KMV convention (D = total_liab x 0.75) |
| EWMA_LAMBDA | 0.94 | [B] | RiskMetrics (1996) G7 default |
| FALLBACK_RISK_FREE | 0.035 | [C] | KTB3Y fallback when bonds data unavailable |
| KRX_TRADING_DAYS | 250 | [B] | sqrt(250) for annualization |
| DD_WARNING_BUY | 0.95 | [D] | Multiplier magnitude heuristic |
| DD_DANGER_BUY | 0.82 | [D] | Multiplier magnitude heuristic |
| DD_CRITICAL_BUY | 0.75 | [D] | Multiplier magnitude heuristic |
| DD_DANGER_SELL | 1.12 | [D] | Multiplier magnitude heuristic |
| DD_CRITICAL_SELL | 1.15 | [D] | Multiplier magnitude heuristic |

**Edge Cases:**
- `!currentStock` or `candleCloses.length < 60`: DD computation skipped, `_currentDD = null` (line 852)
- Financial sector (`sector === 'financial'`): excluded -- bank/insurance liabilities are operating assets (line 857)
- Seed financial data (`source !== 'dart' && source !== 'hardcoded'`): DD computation blocked (line 863)
- `totalLiab <= 0` or `mcapEok <= 0` or `sigmaE <= 0`: computation aborted, `_currentDD = null`
- `_currentDD === null` in application function: immediate return, no-op (line 924)

**Historical Note:** Previously, `_applyPhase8ConfidenceToPatterns` also applied a DD penalty (x0.90 for DD<2), causing double-application. This was removed (line 625-626 comment) to prevent compound: 0.90 x 0.82 = 0.738x double-discount bug.

---

### CONF-7: `_applyPhase8ConfidenceToPatterns(patterns)`

**Purpose:** Integrate MCS v2 composite score, HMM regime classification, per-stock foreign momentum alignment, and options implied move into a unified final adjustment layer. Despite its name ("Phase 8"), this is the 7th function in the chain.

**Data Source:**

| Variable | JSON File | Python Script |
|----------|-----------|---------------|
| `_macroComposite.mcsV2` | `data/macro/macro_composite.json` | `scripts/compute_mcs.py` |
| `_flowSignals.stocks[code]` | `data/backtest/flow_signals.json` | `scripts/compute_hmm_regimes.py` |
| `_optionsAnalytics.analytics.straddleImpliedMove` | `data/derivatives/options_analytics.json` | `scripts/download_options.py` |

**Academic Basis:** MCS v2: Doc30 section 4.3 (8-component macro composite score). HMM regime: Hidden Markov Model 3-state classification (Doc46 section 5). Options implied move: Black-Scholes straddle pricing, CFA Level II derivatives.

**Execution Order:** 7 of 10

**appWorker.js:** lines 554-637

**Sub-function A: MCS v2 (lines 560-571)**

| Condition | Adjustment | Direction |
|-----------|------------|-----------|
| `mcsV2 >= 70` (strong bull) AND `signal=buy` | x1.05 | buy only |
| `mcsV2 <= 30` (strong bear) AND `signal=sell` | x1.05 | sell only |

MCS_THRESHOLDS defined in appState.js line 403: `{ strong_bull: 70, bull: 55, bear: 45, strong_bear: 30 }`.

**Double-application guard with CONF-3 Factor 6:** When `_macroComposite.mcsV2` is available, CONF-3 Factor 6 (MCS v1) is skipped (line 1218 of CONF-3). MCS is applied exactly once: either here (v2) or in CONF-3 (v1), never both.

**Sub-function B: HMM Regime + Foreign Momentum (lines 573-609)**

**Quality gate:** `_flowSignals.flowDataCount > 0` (line 578). If zero, the entire HMM + flow section is skipped. This prevents unreliable regime labels from being applied to all 2,651 stocks when investor_daily data is empty.

HMM regime multipliers (`REGIME_CONFIDENCE_MULT`, appState.js lines 394-399):

| Regime | Buy Mult | Sell Mult |
|--------|----------|-----------|
| bull | x1.10 | x0.85 |
| bear | x0.85 | x1.10 |
| sideways | x1.00 | x1.00 |
| null | x1.00 | x1.00 |

Per-stock foreign momentum bonus (requires per-stock flow data, line 587-590):

| Condition | Adjustment |
|-----------|------------|
| `foreignMomentum=buy` AND `signal=buy` | x1.03 |
| `foreignMomentum=sell` AND `signal=sell` | x1.03 |

If per-stock flow data is absent (`foreignMomentum === null`): warning logged, bonus skipped, but market-wide HMM regime multiplier still applies (line 589-590).

**Sub-function C: Options IV/HV Ratio (Simon & Wiggins 2001, lines 628-642)**

| Condition | Adjustment | Grade |
|-----------|------------|-------|
| `atmIV/historicalVol > 2.0` | x0.90 (severe vol premium) | [B] |
| `atmIV/historicalVol > 1.5` | x0.93 (elevated vol premium) | [B] |
| Fallback: `straddleImpliedMove > 3.5%` (when IV/HV unavailable) | x0.93 | [C] |

Simon & Wiggins (2001): when implied volatility exceeds historical volatility by 50%+, pattern accuracy drops 15-20% due to elevated uncertainty. The IV/HV ratio is a more direct measure than raw straddle implied move.

Internal variables: `_ivHvRatio = atmIV / historicalVol`, `_ivHvFired` (boolean gate), `_ivDiscount` (0.90 or 0.93 based on severity).

**Final Clamp:** confidence `[10, 100]`, confidencePred `[10, 95]` (lines 628-636). This is the only function that applies absolute clamp rather than a per-adj clamp.

**Constants:**

| Constant | Value | Grade | Line |
|----------|-------|-------|------|
| MCS_THRESHOLDS.strong_bull | 70 | [C] | appState.js 403 |
| MCS_THRESHOLDS.strong_bear | 30 | [C] | appState.js 403 |
| MCS_BOOST | 1.05 | [D] | 566 |
| REGIME_CONFIDENCE_MULT.bull.buy | 1.06 | [C] | appState.js 395 |
| REGIME_CONFIDENCE_MULT.bull.sell | 0.92 | [C] | appState.js 395 |
| REGIME_CONFIDENCE_MULT.bear.buy | 0.90 | [C] | appState.js 396 |
| REGIME_CONFIDENCE_MULT.bear.sell | 1.06 | [C] | appState.js 396 |
| FOREIGN_ALIGN_BONUS | 1.03 | [D] | 604 |
| IV_HV_THRESHOLD | 1.5 | [B] | 630 |
| IV_HV_SEVERE | 2.0 | [B] | 632 |
| IV_HV_DISCOUNT | 0.93 | [B] | 634 |
| IV_HV_SEVERE_DISCOUNT | 0.90 | [B] | 632 |
| IMPLIED_MOVE_FALLBACK | 3.5% | [C] | 638 |

**Edge Cases:**
- `_macroComposite === null` or `mcsV2 === null`: MCS sub-function skipped (line 560)
- `_flowSignals === null` or `flowDataCount === 0`: per-stock flow skipped, BUT market-wide HMM regime label still available via `market_summary` fallback (`flowDataCount` ≈ 30). **V7:** Quality gate now passes via market-level fallback — `_sendMarketContextToWorker()` (appWorker.js lines 682-690) provides VKOSPI through 3-tier chain.
- `_flowSignals.stocks[code]` absent: per-stock section skipped (line 578)
- `_optionsAnalytics === null`: options sub-function skipped (line 614)
- Source guards: `macro_composite` status=error/source=sample/demo -> nulled at load (line 515-518); `options_analytics` same (line 520-523)

**Expected Compound Range:**
- Bull regime + MCS + foreign aligned + implied move: buy x1.10 x 1.05 x 1.03 x 0.95 = x1.130
- Bear regime + implied move: sell x1.10 x 0.95 = x1.045

---

### CONF-8: `_applySurvivorshipAdjustment(patterns)`

**Purpose:** Discount buy-pattern confidence to correct for survivorship bias. Stocks that delisted (went to zero) are absent from the OHLCV dataset, inflating apparent buy-pattern success rates. Sell patterns are NOT adjusted since delisted stocks confirm bearish patterns.

**Data Source:**

| Item | Source |
|------|--------|
| `backtester._survivorshipCorr` | Computed in `backtester.js` from delisted stock analysis |
| `corr.global.delta_wr_median` | Global median win-rate delta (percentage points) |

**Academic Basis:** Elton, Gruber & Blake (1996) "Survivorship Bias and Mutual Fund Performance", RFS 9(4). CFA Level I quantitative methods -- sample selection bias. Applied to pattern backtest methodology: without adjustment, buy-pattern win rates are systematically inflated by the exclusion of failed (delisted) stocks.

**Execution Order:** 8 of 10

**appWorker.js:** lines 959-979

**Adjustment Formula:**

```
adj = max(0.92, min(1.0, 1 - (globalDelta / 200)))
```

Only applied when `globalDelta > 1` (at least 1pp win-rate difference).

| globalDelta (pp) | adj | Confidence Impact |
|------------------|-----|-------------------|
| 1 | 0.995 | -0.5% |
| 2.8 (typical) | 0.986 | -1.4% |
| 5 | 0.975 | -2.5% |
| 10 | 0.950 | -5.0% |
| >= 16 | 0.920 (clamp) | -8.0% |

**Clamp:** `[0.92, 1.0]` -- consistent with RORO band (line 969)

**Constants:**

| Constant | Value | Grade | Purpose |
|----------|-------|-------|---------|
| SURVIVORSHIP_MIN_DELTA | 1 (pp) | [D] | Minimum delta to trigger adjustment |
| SURVIVORSHIP_DIVISOR | 200 | [D] | WR delta -> confidence conversion factor |
| SURVIVORSHIP_CLAMP_FLOOR | 0.92 | [C] | Consistent with D-2 RORO band |

**Edge Cases:**
- `backtester._survivorshipCorr` undefined: immediate return, no-op (line 960)
- `globalDelta <= 1`: no-op, delta too small to matter (line 965)
- Sell patterns: explicitly excluded from adjustment (line 974)
- Confidence stored as `+(confidence * adj).toFixed(1)` -- note: this converts to number with 1 decimal precision, unlike other functions that use `Math.round()` (line 975)

**Precision Anomaly:** This is the only function that uses `.toFixed(1)` instead of `Math.round()` for the final confidence value. All other functions use `Math.round(p.confidence * adj)`. This creates a minor inconsistency: CONF-8 preserves one decimal place while all others produce integers. However, since downstream consumers (rendering, panel display) typically floor or round anyway, this is cosmetic.

---

### CONF-9: `_applyMacroConditionsToSignals(signals)`

**Purpose:** Apply macro-state-based confidence adjustments to 5 specific S/A-tier composite signals. Unlike CONF-1 through CONF-8, this function operates on **signals** (not patterns), targeting specific `compositeId` values.

**Data Source:** Same `_macroLatest`, `_bondsLatest` as CONF-3.

**Academic Basis:** Same as CONF-3, but with signal-specific application. Each composite signal has been pre-validated with sufficient sample size and win rate to warrant macro conditioning.

**Execution Order:** 9 of 10

**appWorker.js:** lines 1565-1626

**Adjustment Rules per compositeId:**

#### `sell_doubleTopNeckVol` (baseConf=75)

| Condition | Extra Adj | Line |
|-----------|-----------|------|
| `phase = contraction or peak` | x1.08 | 1586 |
| `inverted or slope < 0` | x1.10 | 1587 |
| `creditRegime = stress` | x1.06 | 1588 |

Max compound: 1.08 x 1.10 x 1.06 = 1.260 (clamped to 1.25)

#### `buy_doubleBottomNeckVol` (baseConf=72)

| Condition | Extra Adj | Line |
|-----------|-----------|------|
| `phase = trough` | x1.12 | 1593 |
| `phase = contraction` | x0.90 | 1594 |
| `slope > 0.3` | x1.05 | 1595 |
| `foreigner_signal > 0.3` | x1.06 | 1596 |

Max compound (trough path): 1.12 x 1.05 x 1.06 = 1.247

#### `strongSell_shootingMacdVol` (baseConf=69)

| Condition | Extra Adj | Line |
|-----------|-----------|------|
| `phase = peak or contraction` | x1.06 | 1601 |
| `inverted` | x1.08 | 1602 |

Max compound: 1.06 x 1.08 = 1.145

#### `sell_shootingStarBBVol` (baseConf=69)

| Condition | Extra Adj | Line |
|-----------|-----------|------|
| `creditRegime = elevated or stress` | x1.05 | 1607 |
| `phase = peak` | x1.04 | 1608 |

Max compound: 1.05 x 1.04 = 1.092

#### `sell_engulfingMacdAlign` (baseConf=66)

| Condition | Extra Adj | Line |
|-----------|-----------|------|
| `phase = peak or contraction` | x1.06 | 1613 |
| `foreigner_signal < -0.3` | x1.05 | 1614 |

Max compound: 1.06 x 1.05 = 1.113

**Overall Clamp:** `[0.70, 1.25]` (line 1617)

**Edge Cases:**
- `!signals || signals.length === 0`: immediate return (line 1566)
- `!macro && !bonds`: immediate return (line 1569)
- `s.type !== 'composite'`: non-composite signals skipped (line 1580)
- Only the 5 listed compositeIds receive adjustments; all others pass through at adj=1.0

**Notable:** This is the only function that applies `confidence` clamped to `[10, 95]` (not 100) for both confidence and confidencePred (line 1620), consistent with the signal confidence ceiling being lower than pattern confidence ceiling.

---

### CONF-10: `_injectWcToSignals(signals, patterns)`

**Purpose:** Inject the average Wc (composite weight) from patterns into all signals. This is metadata injection, not a confidence adjustment.

**Data Source:** `patterns[i].wc` values (computed in patterns.js/backtester.js adaptive weight system).

**Execution Order:** 10 of 10

**appWorker.js:** lines 1632-1643

**Formula:**

```javascript
avgWc = sum(patterns[i].wc) / count   // wc-null patterns excluded
signals[i].wc = avgWc                  // all signals receive same value
```

**Edge Cases:**
- `patterns.length === 0` or `signals.length === 0`: immediate return (lines 1633-1634)
- All patterns have `wc === null` (seed data): `avgWc = 1` (default, line 1639)

**Confidence Impact:** None. This function does not modify `confidence` or `confidencePred`. It only sets the `.wc` field on signals for downstream use in rendering priority and scoring.

---

## 3.6.3 Interaction Effects

### Multiplicative Compounding

All 8 pattern-affecting functions (CONF-1 through CONF-8) are multiplicative. Their adjustments compound:

```
confidence_final = confidence_raw * adj_1 * adj_2 * adj_3 * adj_4 * adj_5 * adj_6 * adj_7 * adj_8
```

However, each function applies its own per-function clamp to `adj` before multiplying, and then clamps the resulting `p.confidence` to `[10, 100]`. This means that the compound effect is bounded by the product of individual clamp ranges, further constrained by the absolute floor/ceiling.

### Theoretical Compound Ranges

| Scenario | Compound adj | Effective Confidence |
|----------|-------------|---------------------|
| All maximally adverse (buy) | 0.55 x 0.92 x 0.70 x 0.80 x 0.70 x 0.75 x (0.85*0.95) x 0.92 | -> 10 (absolute floor) |
| All maximally favorable (sell) | 1.35 x 1.08 x 1.25 x 1.15 x 1.30 x 1.15 x (1.10*1.05) x 1.00 | -> 100 (absolute ceiling) |
| Normal market (1-3 factors active) | 0.90 to 1.10 | ~45 to ~55 on base 50 |
| Macro stress (contraction + inverted + VIX>30) | ~0.70 to 0.80 for buy | ~35 to ~40 on base 50 |
| Strong bull (expansion + steep + aligned + MCS) | ~1.15 to 1.25 for buy | ~58 to ~63 on base 50 |
| Crisis (DD<1.0 + bear + credit stress) | Buy -> floor 10 | Credit-impaired sell -> 100 cap |

### Cancellation Effects

Yes, two functions can partially cancel each other:

1. **RORO vs Macro VIX:** A risk-on RORO regime (buy x1.06) can be partially offset by elevated VIX in Macro Factor 8 (buy x0.97). The [0.92, 1.08] RORO clamp was specifically designed narrow to prevent full cancellation with the VIX/credit factors in CONF-3.

2. **MCS v1 vs MCS v2:** Explicitly prevented. If `_macroComposite.mcsV2` exists, CONF-3 Factor 6 (MCS v1) is skipped, and MCS v2 is applied only in CONF-7.

3. **Merton DD vs Phase8 DD:** Previously a double-application bug (Phase8 applied x0.90 for DD<2 on top of Merton's x0.82). Fixed by removing DD from Phase8 (line 625-626).

4. **Survivorship vs everything:** Survivorship (CONF-8) only applies to buy patterns with a narrow [0.92, 1.0] range. It is always a drag, never a boost, and never offsets any other function's adjustment.

### Sensitivity Ranking (Largest Impact First)

| Rank | Function | Max Single-Factor Impact | Frequency |
|------|----------|------------------------|-----------|
| 1 | CONF-6 Merton DD | -25% buy (DD<1.0) | Rare (credit-impaired stocks only) |
| 2 | CONF-3 Macro 11-Factor | -30% to +25% (clamp) | Always (if macro data loaded) |
| 3 | CONF-5 Derivatives | -30% to +30% (clamp) | When derivatives data available |
| 4 | CONF-7 Phase8 HMM | +/-15% (regime mult) | When flow_signals has real data |
| 5 | CONF-1 Market Context | -12% to +8% per factor | When market_context loaded |
| 6 | CONF-2 RORO Regime | -8% to +6% | Always (if >=1 factor available) |
| 7 | CONF-4 Micro | -15% to +10% (ILLIQ) | Always (computed from candles) |
| 8 | CONF-8 Survivorship | -8% max | When backtester correction loaded |

---

## 3.6.4 Null Data Behavior

### Complete Null-Safety Matrix

Every function in the chain is designed for graceful degradation. When a data source is unavailable, the function either returns immediately (no-op) or skips the individual factor.

| Function | Guard Condition | Behavior When Null |
|----------|----------------|-------------------|
| CONF-1 MarketContext | `!_marketContext` OR `source==='demo'` | Immediate return, patterns unchanged |
| CONF-2 RORO | `count===0` (all 5 factors null) | `regime='neutral'`, `score=0`, no-op |
| CONF-2 RORO | `count < 3` | Score proportionally discounted by `min(count/3, 1.0)` |
| CONF-3 Macro | `!macro && !bonds` | Immediate return |
| CONF-3 Macro | Individual factor null | That specific factor skipped (11 independent null checks) |
| CONF-4 Micro | `!microCtx` (candles < 21) | Immediate return |
| CONF-4 Micro | `calcAmihudILLIQ` missing | ILLIQ=null, only HHI applied |
| CONF-5 Derivatives | `!deriv && !investor && !etf && !shorts` | Immediate return |
| CONF-5 Derivatives | Individual source null | That factor skipped |
| CONF-6 Merton DD | `!_currentDD` | Immediate return |
| CONF-6 Merton DD | Financial sector | DD computation skipped (meaningless) |
| CONF-6 Merton DD | Seed financial data | DD computation blocked |
| CONF-6 Merton DD | Market cap or liabilities unavailable | DD computation aborted |
| CONF-7 Phase8 MCS | `!_macroComposite` or `mcsV2===null` | MCS sub-function skipped |
| CONF-7 Phase8 HMM | `!_flowSignals` or `flowDataCount===0` | Entire HMM+flow skipped |
| CONF-7 Phase8 Options | `!_optionsAnalytics` | Options sub-function skipped |
| CONF-8 Survivorship | `!backtester._survivorshipCorr` | Immediate return |
| CONF-8 Survivorship | `globalDelta <= 1` | Too small to matter, no-op |
| CONF-9 MacroSignals | `!macro && !bonds` | Immediate return |
| CONF-9 MacroSignals | `s.type !== 'composite'` | Non-composite signals skipped |
| CONF-10 Wc Inject | `!patterns.length` or `!signals.length` | Immediate return |

### Source/Sample Guards (Loader-Level)

Before data reaches the chain, the loaders in `_loadDerivativesData()` and `_loadPhase8Data()` apply source guards:

| Data | Guard | Effect | Line |
|------|-------|--------|------|
| `_investorData` | `source === 'sample'` | Set to null, pipeline status = 'sample' | 424 |
| `_shortSellingData` | `source === 'sample'` or `'unavailable'` | Set to null | 430 |
| `_derivativesData` (non-array) | `source === 'sample'` or `'demo'` | Set to null | 436 |
| `_etfData` | `source === 'sample'` or `'demo'` | Set to null | 441 |
| `_macroComposite` | `status === 'error'` or sample/demo | Set to null | 515 |
| `_optionsAnalytics` | `status === 'error'` or sample/demo | Set to null | 520 |
| `_flowSignals` | `flowDataCount === 0` | HMM adjustments disabled (not nulled, but gated) | 526 |

### Staleness Detection

The `_checkDataStaleness()` function (line 255-276) tracks data age:
- **> 30 days:** Added to `_staleDataSources` set, pipeline status = 'stale', console warning
- **> 14 days:** Console warning only
- Staleness check runs once after all 3 loaders complete (`_runPipelineStalenessCheck()`, line 283-309)

Stale data sources trigger a user-visible toast: `"N개 데이터 소스 30일+ 경과"` (line 306).

**Important:** Stale data is NOT automatically excluded from the confidence chain. The `_staleDataSources` set is available for future gating but is not currently consumed by any CONF-N function. This is a potential improvement: staleness-aware functions could discount their adjustment magnitudes for aged data.

---

## 3.6.5 Signal Macro Conditions (CONF-9 Detail)

### Rate Environment Signal Filtering

CONF-9 (`_applyMacroConditionsToSignals`) is the only function that adjusts **signal** confidence (as opposed to pattern confidence). It targets 5 specific high-confidence composite signals and adjusts them based on macro state.

### Which Signals Are Enhanced in Which Macro Regimes

| compositeId | Macro Condition | Adjustment | Rationale |
|-------------|----------------|------------|-----------|
| sell_doubleTopNeckVol | Contraction/Peak | +8% | Double top in declining economy = stronger reversal signal |
| sell_doubleTopNeckVol | Inverted curve | +10% | 12-18 month recession lead indicator amplifies sell |
| sell_doubleTopNeckVol | Credit stress | +6% | Risk premium expansion confirms bearish pattern |
| buy_doubleBottomNeckVol | Trough | +12% | Double bottom at cycle trough = strongest buy signal |
| buy_doubleBottomNeckVol | Contraction | -10% | Too early for bottom -- discount premature buy |
| buy_doubleBottomNeckVol | Steep curve (>0.3) | +5% | Normal yield curve supports recovery thesis |
| buy_doubleBottomNeckVol | Foreign inflow (>0.3) | +6% | Smart money confirming bottom |
| strongSell_shootingMacdVol | Peak/Contraction | +6% | Shooting star + MACD bearish in declining phase |
| strongSell_shootingMacdVol | Inverted | +8% | Recession signal amplifies sell |
| sell_shootingStarBBVol | Credit elevated/stress | +5% | BB rejection + credit risk = stronger sell |
| sell_shootingStarBBVol | Peak | +4% | Late cycle shooting star |
| sell_engulfingMacdAlign | Peak/Contraction | +6% | Bearish engulfing in declining economy |
| sell_engulfingMacdAlign | Foreign outflow (<-0.3) | +5% | Smart money confirming bearish signal |

### Notable Asymmetry

All 5 composite signals addressed by CONF-9 are either sell signals or high-conviction buy/sell pairs (doubleBottom). There are no standalone buy-composite signals receiving macro enhancement. This is consistent with the empirical finding (Session 0405) that sell patterns have stronger directional predictability in the Korean market (bearish patterns: WR 57-75%, bullish patterns: WR 40-47%).

The only dampening case is `buy_doubleBottomNeckVol` in contraction phase (x0.90), which prevents premature bottom-calling before the cycle actually troughs.

---

## 3.6.6 [D]-Grade Constants Summary -- Uncalibrated Heuristics

The confidence chain contains **30+ [D]-grade constants** that lack empirical calibration. These are the highest-priority targets for future IC (Information Coefficient) testing and Walk-Forward Efficiency validation.

### High Sensitivity ([D]-Grade, >5% impact)

| Constant | Value | Function | Impact | Calibration Priority |
|----------|-------|----------|--------|---------------------|
| REGIME_MULT.bull.buy | 1.10 | CONF-7 | +10% all buy patterns | 1 (highest) |
| REGIME_MULT.bull.sell | 0.85 | CONF-7 | -15% all sell patterns | 1 |
| REGIME_MULT.bear.buy | 0.85 | CONF-7 | -15% all buy patterns | 1 |
| REGIME_MULT.bear.sell | 1.10 | CONF-7 | +10% all sell patterns | 1 |
| CCSI_BEAR_MULT | 0.88 | CONF-1 | -12% buy | 2 |
| CREDIT_STRESS_MULT | 0.85 | CONF-3 | -15% all | 2 |
| PCR_MULT | +/-0.08 | CONF-5 | +/-8% | 3 |
| ALIGN_BUY_MULT | 1.08 | CONF-5 | +8% buy | 3 |
| DD_DANGER_BUY | 0.82 | CONF-6 | -18% buy | 4 |
| DD_CRITICAL_BUY | 0.75 | CONF-6 | -25% buy | 4 |

### Medium Sensitivity ([D]-Grade, 3-5% impact)

| Constant | Value | Function | Impact |
|----------|-------|----------|--------|
| MCS_BOOST | 1.05 | CONF-7 | +5% |
| FOREIGN_ALIGN_BONUS | 1.03 | CONF-7 | +3% |
| FX_EXPORT_MULT | +/-0.05 | CONF-5 | +/-5% |
| IMPLIED_MOVE_DISCOUNT | 0.95 | CONF-7 | -5% |
| EARNING_SEASON_MULT | 0.93 | CONF-1 | -7% |
| TAYLOR_MAX_ADJ | 0.05 | CONF-3 | max +/-5% |
| FOREIGN_BUY_MULT | 1.08 | CONF-1 | +8% |
| CCSI_BULL_MULT | 1.06 | CONF-1 | +6% |

### Low Sensitivity ([D]-Grade, 1-3% impact)

| Constant | Value | Function | Impact |
|----------|-------|----------|--------|
| SHORT_LOW_BUY | 0.97 | CONF-5 | -3% |
| SURVIVORSHIP_DIVISOR | 200 | CONF-8 | ~1-3% |
| SURVIVORSHIP_MIN_DELTA | 1 (pp) | CONF-8 | trigger threshold |
| ENTER_ON/OFF thresholds | +/-0.25 | CONF-2 | regime switch sensitivity |
| EXIT_ON/OFF thresholds | +/-0.10 | CONF-2 | hysteresis width |

### Calibration Priority Recommendation

1. **REGIME_CONFIDENCE_MULT** (CONF-7) -- IC validation highest priority. These +/-10-15% multipliers apply to ALL patterns when a regime is classified. A miscalibrated regime multiplier introduces systematic bias across the entire portfolio.

2. **CCSI/CREDIT/PCR multipliers** (CONF-1, CONF-3, CONF-5) -- Macro-level factors with >5% impact per factor. Cross-sectional IC testing against forward returns recommended.

3. **DD tier thresholds** (CONF-6) -- Credit risk step function. The jump from 0.95 (warning) to 0.82 (danger) to 0.75 (critical) should be validated against actual default rates in Korean market.

4. **Taylor/FX/CLI** (CONF-3 Factors 7/9/11) -- Small adjustments (<5%), lower priority but still uncalibrated.

5. **Hysteresis thresholds** (CONF-2) -- Regime switching sensitivity. Requires time-series backtest of regime transitions vs market returns.

---

## 3.6.7 Null-Check Audit -- Functions Without Data Source Guards

**FINDING:** All 10 functions properly null-check their primary data sources before applying adjustments. No function applies a confidence adjustment without first verifying that its data source is non-null.

**Minor gap identified:** The staleness tracking system (`_staleDataSources`) is populated but not consumed by any confidence function. Stale data (>30 days old) is applied with full multiplier magnitude. Future improvement: adjust multiplier magnitude based on data age (e.g., half the adjustment for data >14 days old).

---

## 3.6.8 Data Dependency Map

```
data/market_context.json ────────── _marketContext ──────── CONF-1 MarketContext (CCSI, foreign, earnings)
                                                             CONF-2 RORO (vkospi fallback)

data/macro/macro_latest.json ────── _macroLatest ────────── CONF-2 RORO (vkospi/vix/mcs/usdkrw)
                                                             CONF-3 Macro (11 factors)
                                                             CONF-5 Derivatives (usdkrw for FX channel)
                                                             CONF-6 Merton DD (risk-free rate fallback)
                                                             CONF-9 MacroSignals

data/macro/bonds_latest.json ────── _bondsLatest ────────── CONF-2 RORO (aa_spread)
                                                             CONF-3 Macro (slope/inverted/credit)
                                                             CONF-6 Merton DD (ktb_3y)
                                                             CONF-9 MacroSignals

data/macro/kosis_latest.json ────── _kosisLatest ────────── CONF-3 Macro (cli_cci_gap, Factor 11)

data/macro/macro_composite.json ─── _macroComposite ─────── CONF-3 Macro (MCS v1/v2 dedup check)
                                                             CONF-7 Phase8 (mcsV2)

data/vkospi.json ────────────────── _macroLatest.vkospi ─── CONF-2 RORO (Factor 1)

data/derivatives/derivatives_summary.json ── _derivativesData ── CONF-5 (basis, PCR)
data/derivatives/basis_analysis.json ──────── (merged into _derivativesData.basis)
data/derivatives/investor_summary.json ────── _investorData ──── CONF-2 RORO (Factor 5)
                                                                   CONF-5 (alignment)
data/derivatives/etf_summary.json ──────────── _etfData ───────── CONF-5 (leverage sentiment)
data/derivatives/shortselling_summary.json ── _shortSellingData ─ CONF-5 (short ratio)
data/derivatives/options_analytics.json ───── _optionsAnalytics ─ CONF-7 Phase8 (implied move)

data/backtest/flow_signals.json ─────────────── _flowSignals ──── CONF-7 Phase8 (HMM regime + foreign momentum)

_financialCache (data.js) ──────────────────────────────────────── CONF-6 Merton DD (total_liabilities)
sidebarManager.MARKET_CAP ──────────────────────────────────────── CONF-6 Merton DD (E = market cap)
calcEWMAVol(closes) [indicators.js] ────────────────────────────── CONF-6 Merton DD (sigma_E)
calcAmihudILLIQ(candles) [indicators.js] ───────────────────────── CONF-4 Micro (ILLIQ)
backtester._survivorshipCorr [backtester.js] ───────────────────── CONF-8 Survivorship
ALL_STOCKS (api.js) ────────────────────────────────────────────── CONF-4 Micro (HHI computation)
```

### Data Freshness Requirements

| Data Source | Update Frequency | Script | Staleness Warning |
|-------------|-----------------|--------|-------------------|
| macro_latest.json | Daily (ECOS API) | download_ecos.py | >14 days |
| bonds_latest.json | Daily (ECOS API) | download_ecos.py | >14 days |
| kosis_latest.json | Monthly (KOSIS API) | download_kosis.py | >30 days |
| macro_composite.json | Daily (computed) | compute_mcs.py | No reliable date field |
| vkospi.json | Daily (KRX) | download_vkospi.py | >7 days |
| derivatives_summary.json | Daily (KRX Open API) | download_derivatives.py | >14 days |
| investor_summary.json | Daily (KRX Open API) | download_investor.py | >14 days |
| etf_summary.json | Daily (KRX Open API) | download_etf.py | >14 days |
| shortselling_summary.json | Daily (KRX Open API) | download_shortselling.py | >14 days |
| basis_analysis.json | Daily (computed) | compute_basis.py | >14 days |
| flow_signals.json | Weekly (computed) | compute_hmm_regimes.py | >14 days |
| options_analytics.json | Daily (computed) | download_options.py | >14 days |
| market_context.json | Daily | download_market_context.py | N/A (loaded in app.js) |

---

## 3.6.9 Individual Clamp Range Summary

| Function | adj Clamp | Absolute Clamp | Purpose |
|----------|-----------|----------------|---------|
| CONF-1 MarketContext | [0.55, 1.35] | [10, 100] / [10, 95] | Wide: up to 3 independent factors |
| CONF-2 RORO Regime | [0.92, 1.08] | [10, 100] / [10, 95] | Narrow: prevent VIX/credit double-count |
| CONF-3 Macro 11-Factor | [0.70, 1.25] | [10, 100] / [10, 95] | Widest: 11 factors compound |
| CONF-4 Micro | [0.80, 1.15] | [10, 100] / [10, 95] | Stock-specific, moderate range |
| CONF-5 Derivatives 7-Factor | [0.70, 1.30] | [10, 100] / [10, 95] | Wide: up to 6 independent factors |
| CONF-6 Merton DD | [0.75, 1.15] | [10, 100] / [10, 95] | Asymmetric: buy discount > sell boost |
| CONF-7 Phase8 | No adj clamp | [10, 100] / [10, 95] | Final absolute clamp only |
| CONF-8 Survivorship | [0.92, 1.0] | N/A (no absolute re-clamp) | Buy only, never boosts |
| CONF-9 MacroSignals | [0.70, 1.25] | [10, 95] / [10, 95] | Signal ceiling 95, not 100 |
| CONF-10 Wc Inject | N/A | N/A | No confidence change |

---

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2026-04-06 | v6.0 | Initial creation -- comprehensive 10-function chain audit with CFA-grade annotations |
