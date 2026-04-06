# 3.7 Confidence Adjustment Chain -- 10-Function Sequential Pipeline

> Stage 3 -- ANATOMY V5 Section 3.7
>
> Author: Macro Economist Agent
> Date: 2026-04-06
> Authority: appWorker.js lines 105-125 (Worker path), lines 1659-1679 (main thread fallback)
> Cross-refs: pattern_impl/05_confidence_chain.md, S1 (API pipeline), S2.5-S2.8 (theory)

---

## Overview

The confidence chain is the central integration point where all upstream stages converge.
Raw pattern confidence (set by `patternEngine.analyze()`) is sequentially adjusted by 10
multiplicative functions, each drawing from different data sources and theoretical
frameworks. This is a **pure multiplicative pipeline**: each function reads
`pattern.confidence`, multiplies by a per-function adjustment factor `adj`, and writes
back the result clamped to `[10, 100]` for confidence and `[10, 95]` for confidencePred.

### Wide Structure -- Stage Convergence Map

```
Stage 1 (APIs) -------> JSON files --> JS globals --> [10-Function Chain]
Stage 2 (Theory) -----> formula basis for each adjustment
Stage 3.1 (Indicators)  ATR, Hurst, EWMA Vol, Amihud ILLIQ
Stage 3.4 (Signals) --> signal confidence input
                                                       |
                                                       v
                                        Stage 4 (adjusted patterns --> renderer)
```

### Execution Order (appWorker.js lines 106-125)

```
detectedPatterns = msg.patterns;
_applyMarketContextToPatterns(detectedPatterns);         //  1. Market Context
_classifyRORORegime();                                   //     (RORO score computation)
_applyRORORegimeToPatterns(detectedPatterns);             //  2. RORO Regime
_applyMacroConfidenceToPatterns(detectedPatterns);        //  3. Macro 11-Factor
_updateMicroContext(candles);                             //     (micro indicator calc)
_applyMicroConfidenceToPatterns(detectedPatterns, _);     //  4. Micro ILLIQ/HHI
_applyDerivativesConfidenceToPatterns(detectedPatterns);  //  5. Derivatives 7-Factor
_calcNaiveDD(candles.map(c => c.close));                  //     (DD computation)
_applyMertonDDToPatterns(detectedPatterns);               //  6. Merton DD
_applyPhase8ConfidenceToPatterns(detectedPatterns);       //  7. MCS+HMM+Flow+Options
_applySurvivorshipAdjustment(detectedPatterns);           //  8. Survivorship Bias
_applyMacroConditionsToSignals(detectedSignals);          //  9. Macro -> Signals
_injectWcToSignals(detectedSignals, detectedPatterns);    // 10. Wc Injection
```

**Idempotency**: The same order is maintained in three code paths: Worker result handler
(line 106-125), main thread fallback `_analyzeOnMainThread()` (line 1659-1679), and drag
fallback `_analyzeDragOnMainThread()` (line 1720-1727). All three paths are audited to be
identical in function order and arguments.

### Core Mechanism

- All adjustments are **multiplicative**: `p.confidence *= adj`
- Each function has an independent **per-function clamp** on `adj` (prevents any single
  layer from dominating)
- Final confidence is always `[10, 100]`, confidencePred `[10, 95]`
- `p.signal === 'buy'` vs `'sell'` determines direction asymmetry in most functions
- **Null data = no-op**: every function guards against missing inputs and returns without
  modification when data is unavailable

---

## [CC-01] _applyMarketContextToPatterns

**JS Location**: appWorker.js:1016-1051
**Execution Order**: 1/10

### Stage References (Wide Structure)

- **S1 Input**: `data/market_context.json` -> JS global `_marketContext` (appState.js:253, loaded in app.js:118-120)
- **S2 Theory**: S2.5 (Lemmon & Portniaguina 2006 -- consumer sentiment and stock returns), S2.7 (Richards 2005 -- foreign investor herding threshold)
- **S3 Input**: none (no indicator dependency)
- **S4 Output**: pattern.confidence +/-12% per factor, compound range [0.818x, 1.145x]

### Data Loading Path

```
scripts/download_market_context.py --> data/market_context.json
  app.js init() line 118: fetch('data/market_context.json')
  app.js line 120: _marketContext = await mctxRes.json()
```

Note: `_marketContext` is loaded in `app.js` (init-time, once), NOT in `appWorker.js`
loaders. This is distinct from all other pipeline data which loads in appWorker's three
`_load*()` functions.

### Adjustment Formula

Three independent factors, multiplicatively combined:

| # | Condition | adj | Direction | Academic Reference |
|---|-----------|-----|-----------|-------------------|
| 1 | CCSI < 85 | x0.88 | buy only | Lemmon & Portniaguina (2006) |
| 2 | CCSI > 108 | x1.06 | buy only | Lemmon & Portniaguina (2006) |
| 3 | net_foreign_eok > 1000 | x1.08 | buy only | Richards (2005), ~$75M threshold |
| 4 | earning_season = 1 | x0.93 | both | Earnings uncertainty discount |

$$adj_{compound} = \prod_{i=1}^{4} adj_i, \quad adj_{compound} \in [0.55, 1.35]$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| CCSI | Consumer Composite Sentiment Index | index (100=neutral) | [60, 130] | ECOS 511Y002/FME/99988 |
| net_foreign_eok | Foreign net buying | 억원 | [-5000, +5000] | market_context.json |
| earning_season | Earnings season flag | binary (0/1) | {0, 1} | market_context.json |

### Constants

| Constant | Value | Grade | Clamp | Academic Source |
|----------|-------|-------|-------|----------------|
| CCSI_BEAR_THRESHOLD | 85 | [C] | -- | Lemmon & Portniaguina (2006), adapted for Korea |
| CCSI_BULL_THRESHOLD | 108 | [B] | -- | Lemmon & Portniaguina (2006), 105->108 adjustment |
| CCSI_BEAR_MULT | 0.88 | [D] | -- | No direct academic calibration |
| CCSI_BULL_MULT | 1.06 | [D] | -- | No direct academic calibration |
| FOREIGN_BUY_MULT | 1.08 | [D] | -- | Richards (2005) threshold, mult heuristic |
| NET_FOREIGN_THRESHOLD | 1000 (억원) | [B] | -- | Richards (2005): ~$75M converted |
| EARNING_SEASON_MULT | 0.93 | [D] | -- | Heuristic |
| ADJ_CLAMP | [0.55, 1.35] | [D] | per-pattern | Accommodates 3-factor compound |

### Direction Asymmetry

- **Buy patterns**: affected by all 4 factors (CCSI, foreign, earning season)
- **Sell patterns**: affected by earning_season only (line 1039)

### Null/Missing Data Behavior

- `_marketContext === null`: immediate return, no-op (line 1017)
- `_marketContext.source === 'demo'`: no-op (line 1018, prevents demo data from affecting confidence)
- Individual fields null (ccsi, netForeign, earningSeason): corresponding factor skipped

### Double-Counting Prevention

- **VKOSPI removed** (line 1021, [C-11 FIX]): previously this function applied VKOSPI
  adjustment, but `patterns.js::regimeWeight` is the authoritative VKOSPI handler with a
  3-tier cascade. Removal prevents double-counting with patterns.js vol regime AND
  RORO Factor 1 AND Macro Factor 8 (VRP).

---

## [CC-02] _applyRORORegimeToPatterns

**JS Location**: appWorker.js:1455-1477 (application), 1339-1450 (classification)
**Execution Order**: 2/10

### Stage References (Wide Structure)

- **S1 Input**: `data/macro/macro_latest.json` -> `_macroLatest` (.vkospi, .usdkrw, .mcs, .us_hy_spread, .vix), `data/macro/bonds_latest.json` -> `_bondsLatest` (.credit_spreads.aa_spread), `data/derivatives/investor_summary.json` -> `_investorData` (.alignment), `data/vkospi.json` -> merged into `_macroLatest.vkospi`
- **S2 Theory**: S2.5 RORO framework (Baele, Bekaert & Inghelbrecht 2010, "The Determinants of Stock and Bond Return Comovements", RFS 23(6))
- **S3 Input**: none
- **S4 Output**: pattern.confidence +/-8% (risk-on/off), no change (neutral)

### RORO Score Classification (_classifyRORORegime)

5-factor weighted composite score -> hysteresis regime classification:

| Factor | Weight | Source Variable | Threshold Buckets |
|--------|--------|----------------|-------------------|
| 1. VKOSPI/VIX | 0.30 | `_marketContext.vkospi` -> `_macroLatest.vkospi` -> `_macroLatest.vix * VIX_VKOSPI_PROXY(1.12)` | >30: -1.0, >22: -0.5, <15: +0.5, else 0 |
| 2a. AA- credit spread | 0.10 | `_bondsLatest.credit_spreads.aa_spread` | >1.5: -1.0, >1.0: -0.5, <0.5: +0.3, else 0 |
| 2b. US HY spread | 0.10 | `_macroLatest.us_hy_spread` | >5.0: -1.0, >4.0: -0.5, <3.0: +0.3, else 0 |
| 3. USD/KRW | 0.20 | `_macroLatest.usdkrw` | >1450: -1.0, >1350: -0.5, <1200: +0.5, <1100: +1.0, else 0 |
| 4. MCS v1 | 0.15 | `_macroLatest.mcs` | (mcs - 0.5) * 2 continuous |
| 5. Investor alignment | 0.15 | `_investorData.alignment` | aligned_buy: +0.8, aligned_sell: -0.8, else 0 |

**Normalization**: `normalizedScore = score * min(count/3, 1.0)` -- proportional discount
when fewer than 3 factors available.

**Hysteresis regime classification**:

| Transition | Threshold |
|------------|-----------|
| neutral -> risk-on | score >= +0.25 (ENTER_ON) |
| neutral -> risk-off | score <= -0.25 (ENTER_OFF) |
| risk-on -> neutral | score <= +0.10 (EXIT_ON) |
| risk-off -> neutral | score >= -0.10 (EXIT_OFF) |

### Adjustment Formula

| Regime | Buy adj | Sell adj |
|--------|---------|---------|
| risk-on | x1.06 | x0.94 |
| risk-off | x0.92 | x1.08 |
| neutral | x1.00 (no-op) | x1.00 (no-op) |

$$adj = \begin{cases} 1.06 & \text{risk-on, buy} \\ 0.94 & \text{risk-on, sell} \\ 0.92 & \text{risk-off, buy} \\ 1.08 & \text{risk-off, sell} \end{cases}$$

### Constants

| Constant | Value | Grade | Clamp | Academic Source |
|----------|-------|-------|-------|----------------|
| VOL_WEIGHT | 0.30 | [C] | -- | Heuristic, VIX is dominant risk-off proxy |
| CREDIT_AA_WEIGHT | 0.10 | [C] | -- | Split from 0.20 credit total |
| CREDIT_HY_WEIGHT | 0.10 | [C] | -- | Split from 0.20 credit total |
| FX_WEIGHT | 0.20 | [C] | -- | KRW is EM proxy currency |
| MCS_WEIGHT | 0.15 | [C] | -- | Composite macro indicator |
| FLOW_WEIGHT | 0.15 | [C] | -- | Institutional flow signal |
| ENTER_ON / ENTER_OFF | +0.25 / -0.25 | [D] | -- | Heuristic hysteresis |
| EXIT_ON / EXIT_OFF | +0.10 / -0.10 | [D] | -- | Heuristic hysteresis |
| RISK_ON_BUY_ADJ | 1.06 | [D] | [0.92, 1.08] | Heuristic |
| RISK_OFF_BUY_ADJ | 0.92 | [D] | [0.92, 1.08] | Heuristic |
| VIX_VKOSPI_PROXY | 1.12 | [B] | -- | Whaley (2009), appState.js:43 |

### Direction Asymmetry

- **Buy patterns**: range [0.92, 1.06]
- **Sell patterns**: range [0.94, 1.08]
- **Neutral signal patterns** (`p.signal !== 'buy' && p.signal !== 'sell'`): skipped entirely (line 1468)

### Null/Missing Data Behavior

- `count === 0` (all 5 factors null): regime='neutral', score=0, no-op
- `count < 3`: proportional discount via `min(count/3, 1.0)` multiplier
- `_currentRORORegime === 'neutral'`: immediate return (line 1457)

### Double-Counting Prevention

- **Clamp [0.92, 1.08]** is intentionally narrow to prevent double-counting with Macro
  Factor 3 (credit regime, same AA- spread source) and Macro Factor 8 (VRP, same VIX
  source). RORO provides a regime-level directional overlay, while Macro factors provide
  level-specific adjustments.

---

## [CC-03] _applyMacroConfidenceToPatterns

**JS Location**: appWorker.js:1071-1328
**Execution Order**: 3/10

### Stage References (Wide Structure)

- **S1 Input**: `data/macro/macro_latest.json` -> `_macroLatest` (cycle_phase, term_spread, foreigner_signal, vix, rate_diff, taylor_gap, mcs, ktb10y, usdkrw), `data/macro/bonds_latest.json` -> `_bondsLatest` (slope_10y3y, curve_inverted, credit_spreads, credit_regime), `data/macro/kosis_latest.json` -> `_kosisLatest` (cli_cci_gap), `data/macro/macro_composite.json` -> `_macroComposite` (mcsV2, used for dedup guard)
- **S2 Theory**: S2.5 IS-LM (Doc30 section 1), AD-AS (Doc30 section 2), Taylor Rule (Doc30 section 4.1), Mundell-Fleming (Doc30 section 1.4), Stovall Sector Rotation (1996), Yield Curve 4-regime (Estrella & Mishkin 1998, Doc35 section 3), Carr-Wu VRP (2009)
- **S3 Input**: none directly (but relies on S3.1 indicators indirectly via cycle_phase computed upstream)
- **S4 Output**: pattern.confidence cumulative adj in [0.70, 1.25]

### 11 Factors (in execution order within the function)

#### Factor 1: Business Cycle Phase + Stovall Sector Rotation (lines 1095-1116)

**IS-LM equilibrium direction** mapped to cycle phase, with **Stovall(1996) sector
differentiation** when a KSIC->macro sector mapping exists.

Default (no sector match):

| Phase | Buy adj | Sell adj |
|-------|---------|---------|
| expansion | x1.06 | x0.94 |
| peak | x0.95 | x1.08 |
| contraction | x0.92 | x1.08 |
| trough | x1.10 | x0.90 |

Stovall override (when `_STOVALL_CYCLE[sector][phase]` exists):

| Sector | trough | expansion | peak | contraction |
|--------|--------|-----------|------|-------------|
| semiconductor | 1.14 | 1.10 | 0.90 | 0.88 |
| tech | 1.12 | 1.08 | 0.93 | 0.90 |
| financial | 1.12 | 1.04 | 0.94 | 0.92 |
| cons_disc | 1.10 | 1.06 | 0.95 | 0.92 |
| industrial | 1.06 | 1.08 | 0.97 | 0.93 |
| material | 0.96 | 1.04 | 1.08 | 0.94 |
| energy | 0.94 | 1.02 | 1.10 | 0.96 |
| healthcare | 1.02 | 1.00 | 1.02 | 1.06 |
| cons_staple | 0.98 | 0.98 | 1.02 | 1.08 |
| utility | 0.96 | 0.96 | 1.04 | 1.10 |
| telecom | 1.02 | 1.00 | 1.00 | 1.04 |
| realestate | 1.08 | 1.04 | 0.94 | 0.94 |

Sell mult = `2.0 - buyMult` (symmetric inversion). Source: appState.js:414-432.

#### Factor 2: Yield Curve 4-Regime (lines 1118-1150)

Combines `taylorGap` sign (Bull/Bear) and `slope` level (Steep/Flat):

| Regime | Condition | Buy adj | Sell adj |
|--------|-----------|---------|---------|
| Inverted | slope < 0 or `curve_inverted=true` | x0.88 | x1.12 |
| Bull Steepening | gap < 0, slope > 0.20 | x1.06 | x0.95 |
| Bull Flattening | gap < 0, slope <= 0.20 | x0.97 | x1.03 |
| Bear Steepening | gap > 0, slope > 0.20 | x0.95 | x1.04 |
| Bear Flattening | gap > 0, slope <= 0.20 | x0.90 | x1.10 |
| Fallback (no taylorGap) | slope < 0.15 | x0.96 | x1.04 |
| Fallback (no taylorGap) | slope > 0.50 | x1.04 | x0.97 |

#### Factor 3: Credit Regime (lines 1152-1161)

| Condition | Buy adj | Sell adj |
|-----------|---------|---------|
| AA- spread > 1.5 or credit_regime='stress' | x0.85 | x0.85 |
| AA- spread > 1.0 or credit_regime='elevated' | x0.93 | x1.04 |
| Normal | x1.00 | x1.00 |

Note: stress regime applies symmetrically to both directions (all patterns unreliable
in credit stress).

#### Factor 4: Foreign Investor Signal (lines 1163-1172)

| Condition | Buy adj | Sell adj |
|-----------|---------|---------|
| foreigner_signal > +0.3 | x1.05 | x0.96 |
| foreigner_signal < -0.3 | x0.95 | x1.05 |

Theory: UIP / Mundell-Fleming capital flow (Doc28 section 8, Doc30 section 1.4).

#### Factor 5: Pattern-Specific Override (lines 1174-1210)

High-WR pattern types receive additional macro-conditional adjustments:

| Pattern | Condition | Extra adj |
|---------|-----------|-----------|
| doubleTop (sell, WR=74.7%) | contraction/peak + inverted/flat | x1.10 |
| doubleBottom (buy, WR=62.1%) | trough + slope > 0.3 | x1.12 |
| bearishEngulfing (sell, n=113K) | CLI delta < -0.1 | x1.06 |
| hammer (buy, WR=47.9%) | trough/contraction | x1.06 |
| hammer (buy) | expansion/peak | x0.96 |
| invertedHammer (buy, WR=48.9%) | trough/contraction | x1.05 |
| invertedHammer (buy) | expansion/peak | x0.97 |

These compound with the other 10 factors. Example: doubleTop in contraction with
inverted curve receives Factor 1 contraction adj x Factor 2 inversion adj x Factor 5
override adj.

#### Factor 6: MCS v1 (lines 1212-1226)

Uses `_macroLatest.mcs` (0-1 range, computed by `download_macro.py`).

**Double-counting guard**: if `_macroComposite.mcsV2` exists, Factor 6 is skipped
(line 1218). MCS v2 is handled by CC-07 (`_applyPhase8ConfidenceToPatterns`).

| Condition | Formula |
|-----------|---------|
| MCS > 0.6 | `mcsAdj = 1.0 + (mcs - 0.6) * 0.25` -> buy x mcsAdj, sell x (2 - mcsAdj) |
| MCS < 0.4 | `mcsAdj = 1.0 + (0.4 - mcs) * 0.25` -> buy x (2 - mcsAdj), sell x mcsAdj |
| 0.4-0.6 | no-op |

Max effect: MCS=1.0 -> mcsAdj=1.10 -> buy x1.10, sell x0.90.

#### Factor 7: Taylor Rule Gap (lines 1228-1254)

$$tgNorm = \text{clamp}(\text{taylorGap} / 2, -1, +1)$$

Dead band: |tgNorm| <= 0.25 -> no-op.

$$tAdj = 1 + |tgNorm| \times 0.05$$

| Condition | Buy adj | Sell adj |
|-----------|---------|---------|
| tgNorm < -0.25 (dovish) | x tAdj | x (2 - tAdj) |
| tgNorm > +0.25 (hawkish) | x (2 - tAdj) | x tAdj |

Max effect: |taylorGap| = 2 -> tAdj = 1.05 -> +/-5%.

Sign convention: `taylor_gap = i_actual - i_Taylor`. Positive = overtly tight (hawkish),
negative = overtly loose (dovish).

**[FINDING-01] Taylor r***: Code uses `TAYLOR_R_STAR = 0.5%` (compute_macro_composite.py:65)
vs Doc30 which states `r* = 1.0%`. The code value reflects more recent Korean estimates
(post-COVID lowered neutral rate). **Flag as intentional divergence from Doc30, code is
authoritative**.

**[FINDING-02] Output gap**: Code uses `TAYLOR_OUTPUT_GAP = 0.0` (hardcoded,
compute_macro_composite.py:67). Comment states "실시간 불가, 0 가정". This effectively
drops the output gap term from the Taylor equation, making the gap estimate sensitive
only to inflation. Real-time output gap estimation requires GDP/potential GDP data not
available from ECOS at monthly frequency. **Flag as known limitation, not a bug**.

#### Factor 8: VRP -- Volatility Risk Premium (lines 1256-1269)

| VIX Level | Buy adj | Sell adj |
|-----------|---------|---------|
| > 30 (crisis) | x0.93 | x0.93 |
| 25-30 (elevated) | x0.97 | x1.02 |
| < 15 (low vol) | x1.03 | x0.98 |
| 15-25 (normal) | x1.00 | x1.00 |

Theory: Carr & Wu (2009), Doc26 section 3. Uses `_macroLatest.vix` (FRED VIXCLS or
VIX_FRED backup). Note: VIX > 30 applies symmetrically (both directions unreliable in
high-vol regime).

#### Factor 9: KR-US Rate Differential (lines 1271-1283)

`rate_diff = bok_rate - fed_rate`. Negative = Korean rate below US -> capital outflow
pressure (Mundell-Fleming).

| rate_diff | Buy adj | Sell adj |
|-----------|---------|---------|
| < -1.5 (strong inversion) | x0.95 | x1.04 |
| -1.5 to -0.5 (mild inversion) | x0.98 | x1.02 |
| > +1.0 (Korean premium) | x1.03 | x0.98 |

#### Factor 10: Rate Beta x Rate Direction (lines 1285-1301)

Sector-specific interest rate sensitivity applied via Taylor gap direction:

$$rateDir = \text{clamp}(\text{taylorGap} / 2, -1, +1)$$
$$levelAmp = \begin{cases} 1.5 & \text{if } ktb10y > 4.0 \\ 1.0 & \text{otherwise} \end{cases}$$
$$rateAdj = rateDir \times rBeta \times levelAmp$$
$$adj \mathrel{*}= \begin{cases} 1 + rateAdj & \text{buy} \\ 1 - rateAdj & \text{sell} \end{cases}$$

`_RATE_BETA` lookup table (appState.js:472-485):

| Sector | Rate Beta | Interpretation |
|--------|-----------|----------------|
| utility | -0.08 | Most rate-sensitive (high dividend -> bond substitute) |
| realestate | -0.07 | Leverage-dependent |
| tech | -0.05 | Growth: DCF discount rate sensitivity |
| semiconductor | -0.04 | Capital-intensive growth |
| cons_disc | -0.03 | Household borrowing cost |
| healthcare | -0.02 | Near-neutral |
| telecom | -0.01 | Defensive |
| cons_staple | 0.00 | Inelastic demand -> rate-neutral |
| industrial | +0.01 | Cycle > rate |
| material | +0.02 | Inflation hedge |
| energy | +0.03 | Inflation co-movement |
| financial | +0.05 | NIM expansion (Damodaran 2012) |

Max effect: `rateDir=1.0 * rBeta=-0.08 * levelAmp=1.5 = -0.12` -> buy adj x0.88.

#### Factor 11: KOSIS CLI-CCI Gap (lines 1303-1316)

`cli_cci_gap = CLI (leading) - CCI (coincident)`. Positive = recovery signal.

| cli_cci_gap | Buy adj | Sell adj |
|-------------|---------|---------|
| > +5 | x1.04 | x0.97 |
| < -5 | x0.97 | x1.04 |

### Constants (Summary)

| Constant | Value | Grade | Factor | Academic Source |
|----------|-------|-------|--------|----------------|
| Stovall cycle multipliers (48 values) | 0.88-1.14 | [B] | F1 | Stovall (1996) |
| RATE_BETA (12 sectors) | -0.08 to +0.05 | [B] | F10 | Damodaran (2012) |
| KTB10Y_HIGH_AMP | 4.0 | [C] | F10 | Heuristic |
| KTB10Y_AMP_MULT | 1.5 | [D] | F10 | Heuristic |
| AA_SPREAD_STRESS | 1.5%p | [B] | F3 | Market convention |
| AA_SPREAD_ELEVATED | 1.0%p | [B] | F3 | Market convention |
| CREDIT_STRESS_MULT | 0.85 | [D] | F3 | Heuristic |
| FOREIGNER_THRESHOLD | +/-0.3 | [D] | F4 | Heuristic |
| MCS_NEUTRAL_RANGE | [0.4, 0.6] | [C] | F6 | Heuristic |
| MCS_SENSITIVITY | 0.25 | [D] | F6 | Heuristic |
| TAYLOR_DEAD_BAND | 0.25 (normalized) | [B] | F7 | Taylor (1993) dead band convention |
| TAYLOR_MAX_ADJ | 0.05 | [D] | F7 | Heuristic |
| VIX_CRISIS | 30 | [A] | F8 | Whaley (2009), CBOE convention |
| VIX_ELEVATED | 25 | [A] | F8 | Whaley (2009) |
| VIX_LOW | 15 | [A] | F8 | Whaley (2009) |
| RATE_DIFF_STRONG | -1.5%p | [C] | F9 | Heuristic |
| RATE_DIFF_MILD | -0.5%p | [C] | F9 | Heuristic |
| CLI_CCI_GAP_THRESHOLD | +/-5 | [C] | F11 | Heuristic |
| ADJ_CLAMP | [0.70, 1.25] | [D] | all | Asymmetric: wider downside |

### Direction Asymmetry

- **Buy patterns**: exposed to all 11 factors, most with directional bias
- **Sell patterns**: same 11 factors, mirror direction
- **Factor 3 (credit stress)**: symmetric -- both buy and sell reduced by 15%
- **Factor 8 (VIX > 30)**: symmetric -- both directions reduced by 7%

### Null/Missing Data Behavior

- `_macroLatest === null AND _bondsLatest === null`: immediate return (line 1075)
- Individual factor data null: that factor's adj contribution = 1.0 (no-op)
- `taylorGap === null`: Factors 2 (4-regime), 7 (Taylor), 10 (Rate Beta) all fall back
  to simpler alternatives or skip

### Double-Counting Prevention

- **Factor 6 MCS v1 vs CC-07 MCS v2**: explicit guard at line 1218: if `_macroComposite.mcsV2 != null`, Factor 6 is skipped entirely. Only one MCS path can fire.
- **Factor 3 (credit) vs CC-02 (RORO)**: same AA- spread source used, but RORO clamp [0.92, 1.08] limits overlap. Both can fire simultaneously -- this is a **potential double-counting concern** flagged in [FINDING-03].
- **Factor 8 (VRP/VIX) vs CC-02 (RORO Factor 1)**: same VKOSPI/VIX source. Both can apply simultaneously. RORO's narrow clamp mitigates but does not eliminate overlap. **[FINDING-04]**.

---

## [CC-04] _updateMicroContext + _applyMicroConfidenceToPatterns

**JS Location**: appWorker.js:1482-1512 (compute), 1523-1556 (apply)
**Execution Order**: 4/10

### Stage References (Wide Structure)

- **S1 Input**: OHLCV candles (per-stock, already loaded via `dataService.getCandles()`), `ALL_STOCKS` (index.json -> api.js)
- **S2 Theory**: S2.6 Microeconomics -- Amihud (2002) ILLIQ measure (Doc18 section 3.1), HHI Mean-Reversion (Doc33 section 6.2)
- **S3 Input**: `calcAmihudILLIQ(candles)` from indicators.js:1430 -> returns `{ illiq, logIlliq, level, confDiscount }`
- **S4 Output**: pattern.confidence in [0.80x, 1.15x]

### _updateMicroContext Computation

```javascript
_microContext = {
  illiq: calcAmihudILLIQ(candleData),  // Amihud ILLIQ with confDiscount
  hhiBoost: HHI_MEAN_REV_COEFF * HHI  // only if sectorCaps.length >= 2
};
```

HHI calculation (lines 1491-1508): iterates `ALL_STOCKS`, filters by matching `industry`,
computes Herfindahl-Hirschman Index from market cap shares.

### Adjustment Formula

#### Sub-factor 1: Amihud ILLIQ Liquidity Discount

```javascript
adj *= microCtx.illiq.confDiscount;  // range [0.85, 1.0]
```

`confDiscount` computation (indicators.js:1461-1468):
- `logIlliq >= LOG_HIGH(-1.0)`: `confDiscount = 0.85` (max discount for illiquid stocks)
- `logIlliq <= LOG_LOW(-3.0)`: `confDiscount = 1.0` (no discount for liquid stocks)
- Between: linear interpolation `1.0 - t * 0.15` where `t = (logIlliq - LOG_LOW) / (LOG_HIGH - LOG_LOW)`

#### Sub-factor 2: HHI Mean-Reversion Boost

Applied only to mean-reversion pattern types: `doubleBottom`, `doubleTop`,
`headAndShoulders`, `inverseHeadAndShoulders` (line 1526-1529).

```javascript
adj *= (1 + hhiBoost);  // hhiBoost = 0.10 * HHI
```

HHI range [0, 1]. Monopolistic sector (HHI=0.5) -> +5% boost. Perfect competition
(HHI->0) -> no boost.

### Constants

| Constant | Value | Grade | Clamp | Academic Source |
|----------|-------|-------|-------|----------------|
| ILLIQ_WINDOW | 20 days | [B] | -- | Amihud (2002) standard |
| CONF_DISCOUNT | 0.85 | [C] | -- | Heuristic min liquidity discount |
| LOG_ILLIQ_HIGH | -1.0 | [C] | -- | Heuristic (calibrated for KRX KRW volume) |
| LOG_ILLIQ_NORMAL | -3.0 | [C] | -- | Heuristic |
| HHI_MEAN_REV_COEFF | 0.10 | [C] | -- | Doc33 section 6.2, constant #119 |
| ADJ_CLAMP | [0.80, 1.15] | [D] | per-pattern | Narrower than macro (stock-specific) |

### Direction Asymmetry

- **Buy patterns**: Amihud discount applies equally; HHI boost applies only to mean-reversion types
- **Sell patterns**: same treatment (no directional differentiation in this function)

### Null/Missing Data Behavior

- `candleData.length < 21`: `_microContext = null`, function returns no-op (line 1483)
- `calcAmihudILLIQ` unavailable (not a function): `illiq = null` (line 1484)
- `illiq.confDiscount >= 1.0`: no discount applied
- `sectorCaps.length < 2`: `hhiBoost = 0`, HHI boost skipped
- `currentStock.industry` empty: HHI calculation skipped

---

## [CC-05] _applyDerivativesConfidenceToPatterns

**JS Location**: appWorker.js:711-825
**Execution Order**: 5/10

### Stage References (Wide Structure)

- **S1 Input**: `data/derivatives/derivatives_summary.json` -> `_derivativesData` (basis, basisPct, pcr), `data/derivatives/investor_summary.json` -> `_investorData` (alignment), `data/derivatives/etf_summary.json` -> `_etfData` (leverageSentiment), `data/derivatives/shortselling_summary.json` -> `_shortSellingData` (market_short_ratio), `data/derivatives/basis_analysis.json` -> merged into `_derivativesData` (basis, basisPct), `data/macro/macro_latest.json` -> `_macroLatest` (usdkrw)
- **S2 Theory**: S2.7 Derivatives -- basis (Doc27/36, Bessembinder & Seguin 1993), PCR (Doc37, Pan & Poteshman 2006), investor alignment (Doc39, Choe/Kho/Stulz 2005), ETF sentiment (Doc38, Cheng & Madhavan 2009), short interest (Doc40, Desai et al. 2002), FX channel (Doc28)
- **S3 Input**: none
- **S4 Output**: pattern.confidence * adj, adj clamped [0.70, 1.30]

### Pre-loop Computation: FX Export Channel (lines 724-735)

Computed once before the pattern loop. Only applies to export sectors (semiconductor,
tech, cons_disc, industrial):

```javascript
var _fxExportDir = 0;
if (usdkrw > 1400) _fxExportDir = 1;       // KRW weak -> exporter bullish
else if (usdkrw < 1300) _fxExportDir = -1;  // KRW strong -> exporter bearish
```

### 7 Factors (6 active + 1 removed)

| # | Factor | Condition | Buy adj | Sell adj | Academic |
|---|--------|-----------|---------|---------|----------|
| 1 | Basis (contango) | basisPct >= 0.5 | x(1+mult) | x(1-mult) | Doc27, Bessembinder & Seguin (1993) |
| 1 | Basis (backwardation) | basisPct < 0, abs >= 0.5 | x(1-mult) | x(1+mult) | " |
| 2 | PCR fear | pcr > 1.3 | x1.08 | x0.92 | Doc37, Pan & Poteshman (2006) |
| 2 | PCR greed | pcr < 0.5 | x0.92 | x1.08 | " |
| 3 | Investor aligned_buy | alignment = aligned_buy | x1.08 | x0.93 | Doc39, Choe/Kho/Stulz (2005) |
| 3 | Investor aligned_sell | alignment = aligned_sell | x0.93 | x1.08 | " |
| 4 | ETF strong_bullish | leverageSentiment.sentiment | x0.95 | x1.05 | Doc38, Cheng & Madhavan (2009) |
| 4 | ETF strong_bearish | " | x1.05 | x0.95 | " |
| 5 | Short ratio high | market_short_ratio > 10% | x1.06 | x0.94 | Doc40, Desai et al. (2002) |
| 5 | Short ratio low | market_short_ratio < 2% | x0.97 | x1.03 | " |
| 6 | ERP | **REMOVED** (line 807) | -- | -- | signalEngine handles exclusively |
| 7 | FX export channel | usdkrw > 1400, export sector | x1.05 | x0.95 | Doc28, beta_FX |
| 7 | FX export channel | usdkrw < 1300, export sector | x0.95 | x1.05 | " |

Basis multiplier values: normal (abs(basisPct) >= 0.5): mult=0.05 (+/-5%); extreme
(abs(basisPct) >= 2.0): mult=0.08 (+/-8%).

### Constants

| Constant | Value | Grade | Clamp | Academic Source |
|----------|-------|-------|-------|----------------|
| BASIS_NORMAL_THR | 0.5% | [B] | -- | Market convention |
| BASIS_EXTREME_THR | 2.0% | [C] | -- | Heuristic |
| BASIS_NORMAL_MULT | 0.05 | [D] | -- | Heuristic |
| BASIS_EXTREME_MULT | 0.08 | [D] | -- | Heuristic |
| PCR_FEAR | 1.3 | [B] | -- | Pan & Poteshman (2006) |
| PCR_GREED | 0.5 | [B] | -- | Pan & Poteshman (2006) |
| ALIGN_BUY_MULT / ALIGN_SELL_MULT | 1.08 / 0.93 | [D] | -- | Heuristic |
| ETF_CONTRARIAN_MULT | +/-0.05 | [D] | -- | Heuristic |
| SHORT_HIGH | 10% | [C] | -- | Market convention |
| SHORT_LOW | 2% | [C] | -- | Market convention |
| USDKRW_WEAK | 1400 | [C] | -- | Historical breakpoint |
| USDKRW_STRONG | 1300 | [C] | -- | Historical breakpoint |
| FX_EXPORT_MULT | +/-0.05 | [D] | -- | beta_FX heuristic |
| ADJ_CLAMP | [0.70, 1.30] | [D] | per-pattern | Wide: 6 factors compound |

### Direction Asymmetry

- **Buy patterns**: benefit from contango, fear PCR, aligned_buy, bearish ETF (contrarian), high short ratio, KRW weak (export)
- **Sell patterns**: mirror direction in all factors
- Factor 4 (ETF) is **contrarian**: extreme bullish sentiment dampens buy, boosts sell

### Null/Missing Data Behavior

- All 4 data globals null (`!deriv && !investor && !etf && !shorts`): immediate return (line 722)
- `_derivativesData` is array: uses last element `deriv[deriv.length - 1]` (line 716)
- `alignment` can be object `{signal_1d}` or string: both handled (line 775)
- `market_short_ratio` can be flat field or nested in `marketTrend[-1].shortRatio` (line 798)
- Non-export sectors: Factor 7 (FX) skipped entirely

### Double-Counting Prevention

- **Factor 6 (ERP) removed** (line 807): `signalEngine._detectERPSignal()` is the sole
  ERP handler. Comment: `[C-6 FIX] ERP는 signalEngine._detectERPSignal()에서만 처리 -- 이중 적용 방지`
- **Factor 3 (investor alignment)** overlaps with CC-07 (foreignMomentum bonus in
  Phase8). Different data paths: CC-05 uses `_investorData.alignment` (market-wide 1-day
  signal), CC-07 uses `_flowSignals.stocks[code].foreignMomentum` (per-stock HMM-derived).
  Conceptually similar but operationally distinct. **[FINDING-05]**: potential subtle
  double-count on foreign flow direction.

---

## [CC-06] _calcNaiveDD + _applyMertonDDToPatterns

**JS Location**: appWorker.js:850-915 (compute), 923-951 (apply)
**Execution Order**: 6/10

### Stage References (Wide Structure)

- **S1 Input**: `data/financials/{code}.json` -> `_financialCache[code]` (total_liabilities), `data/macro/bonds_latest.json` -> `_bondsLatest` (yields.ktb_3y), `data/backtest/capm_beta.json` -> not used here (used separately)
- **S2 Theory**: S2.8 Bonds & Credit -- Merton (1974) structural credit model, Bharath & Shumway (2008) Naive DD, KMV Default Point convention (Doc35 sections 6.1-6.5)
- **S3 Input**: `calcEWMAVol(candleCloses)` from indicators.js:1336 (EWMA lambda=0.94, RiskMetrics 1996) -> annualized sigma_E
- **S4 Output**: pattern.confidence * adj, adj in [0.75, 1.15]

### DD Computation (_calcNaiveDD, lines 850-915)

**Exclusions** (returns `_currentDD = null`):
- No currentStock or candles < 60 bars
- Financial sector (`_getStovallSector() === 'financial'`): debt = operational asset, DD meaningless
- Seed financial data (`source !== 'dart' && source !== 'hardcoded'`): prevents fake DD

**Formula** (Bharath & Shumway 2008 Naive DD):

$$E = \text{market cap (억원)}$$
$$D = \text{total\_liabilities} \times 0.75 \quad \text{(KMV Default Point)}$$
$$\sigma_E = \text{calcEWMAVol(closes)} \times \sqrt{250} \quad \text{(annualized)}$$
$$r = \text{ktb\_3y} / 100 \quad \text{(fallback: 3.5\%)}$$
$$V = E + D \quad \text{(asset value approximation)}$$
$$\sigma_V = \sigma_E \times (E/V) + 0.05 \times (D/V) \quad \text{(asset vol approximation)}$$
$$DD = \frac{\ln(V/D) + (r - 0.5\sigma_V^2) \times T}{\sigma_V \sqrt{T}}, \quad T = 1$$
$$EDF = \Phi(-DD) \quad \text{(expected default frequency)}$$

**[FINDING-06]**: The formula uses risk-neutral $d_2$ (not $d_1$). This is the
Bharath-Shumway naive approach which intentionally avoids iterative estimation of the
Merton model. The use of $d_2$ (without the $\sigma_V\sqrt{T}$ offset that distinguishes
$d_1$) produces a **conservative** DD estimate. This is documented as intentional.

### Adjustment Formula (_applyMertonDDToPatterns, lines 923-951)

| DD Range | Buy adj | Sell adj |
|----------|---------|---------|
| DD >= 2.0 | no-op | no-op |
| 1.5 <= DD < 2.0 | x0.95 | x1.02 |
| 1.0 <= DD < 2.0 | x0.82 | x1.12 |
| DD < 1.0 | x0.75 | x1.15 |

### Constants

| Constant | Value | Grade | Clamp | Academic Source |
|----------|-------|-------|-------|----------------|
| DD_SAFE | 2.0 | [A] | -- | Industry convention (1% EDF boundary) |
| DD_WARNING | 1.5 | [A] | -- | Doc35 section 6.4, constant #134 |
| DD_DANGER | 1.0 | [C] | -- | Heuristic |
| DEFAULT_POINT_RATIO | 0.75 | [B] | -- | KMV convention (ST + 0.5*LT) |
| EWMA_LAMBDA | 0.94 | [B] | -- | RiskMetrics (1996) |
| FALLBACK_RISK_FREE | 0.035 (3.5%) | [C] | -- | KTB3Y approx when bonds_latest unavailable |
| KRX_TRADING_DAYS | 250 | [B] | -- | Korean market calendar |
| DD_SAFE_BUY | 0.95 | [D] | [0.75, 1.15] | Heuristic |
| DD_DANGER_BUY | 0.82 | [D] | [0.75, 1.15] | Heuristic |
| DD_CRITICAL_BUY | 0.75 | [D] | [0.75, 1.15] | Heuristic |

### Direction Asymmetry

- **Buy patterns**: strong penalty for low DD (up to x0.75 for DD < 1.0)
- **Sell patterns**: modest boost for low DD (up to x1.15 for DD < 1.0)
- **DD >= 2.0**: no adjustment for either direction (most normal companies)

### Null/Missing Data Behavior

- `_currentDD === null`: no-op (line 924). This covers: no stock, short candles, financial sector, seed data, no total_liabilities, no market cap, sigma_V <= 0
- `_bondsLatest.yields.ktb_3y` null: falls back to `_macroLatest.ktb3y`, then 3.5% (line 893-898)
- `sidebarManager.MARKET_CAP[code]` null: falls back to `currentStock.marketCap` (line 875)

### Double-Counting Prevention

- **Previously double-counted with CC-07**: Phase8 had a DD < 2 penalty (buy x0.90)
  that compounded with MertonDD (buy x0.82). Combined = x0.738 for DD 1.0-1.5.
  **Fixed** at line 625-626: DD penalty removed from Phase8. Comment:
  `DD 페널티는 _applyMertonDDToPatterns()에서 이미 적용됨 -- 이중 적용 방지를 위해 여기서 제거`

---

## [CC-07] _applyPhase8ConfidenceToPatterns

**JS Location**: appWorker.js:554-637
**Execution Order**: 7/10

### Stage References (Wide Structure)

- **S1 Input**: `data/macro/macro_composite.json` -> `_macroComposite` (mcsV2), `data/backtest/flow_signals.json` -> `_flowSignals` (stocks[code].hmmRegimeLabel, foreignMomentum), `data/derivatives/options_analytics.json` -> `_optionsAnalytics` (analytics.straddleImpliedMove)
- **S2 Theory**: S2.5 MCS v2 (Doc30 section 4.3, compute_macro_composite.py), S2.7 HMM regime (Hamilton 1989 via compute_hmm_regimes.py), options implied move (Doc46)
- **S3 Input**: none
- **S4 Output**: pattern.confidence final clamp [10, 100], confidencePred [10, 95]

### Sub-function A: MCS v2 (lines 560-571)

| Condition | adj |
|-----------|-----|
| mcsV2 >= 70 (strong_bull) AND signal=buy | x1.05 |
| mcsV2 <= 30 (strong_bear) AND signal=sell | x1.05 |
| Otherwise | no-op |

`MCS_THRESHOLDS` defined at appState.js:403. Scale is 0-100 (percentile rank).

**[FINDING-01b] MCS v2 component count**: `compute_macro_composite.py` defines **8
components** in `MCS_WEIGHTS`: cli (0.20), esi (0.15), ipi (0.15),
consumer_confidence (0.10), pmi (0.10), exports (0.10), unemployment_inv (0.10),
yield_spread (0.10). Earlier documentation (Doc30) mentioned 5-6 components. **Code is
authoritative** -- the 8-component version is the implemented reality. The discrepancy
arises because consumer_confidence uses ESI as proxy (same source as esi component),
and pmi uses BSI (same source as bsi_mfg in macro_latest), making the effective
independent data sources fewer than 8.

**[FINDING-07] `mcs` key absence from macro_latest.json**: When `download_macro.py`
runs successfully, it produces `macro_latest.json` containing a top-level `"mcs"` key
(line 1008 of download_macro.py: `"mcs": mcs`). However, the `mcs` key may be null if
`compute_mcs()` fails or if required ECOS/KOSIS series are unavailable. When `mcs` is
null/absent AND `mcsV2` is also unavailable, both Factor 6 (CC-03) and Sub-function A
(CC-07) produce no-op. **This is a silent degradation path** -- no warning is logged
when both MCS paths are inactive.

### Sub-function B: HMM Regime + Flow (lines 573-609)

**Quality gate**: `_flowSignals.flowDataCount > 0` (line 578). When `flowDataCount === 0`,
it means no real per-stock investor data exists; HMM regime labels are unreliable
(applied uniformly to all 2,651 stocks from empty investor_daily data). This gate was
added as a P0 fix.

HMM regime multiplier (market-wide, `REGIME_CONFIDENCE_MULT` at appState.js:394-399):

| Regime | Buy mult | Sell mult |
|--------|----------|----------|
| bull | x1.10 | x0.85 |
| bear | x0.85 | x1.10 |
| sideways | x1.00 | x1.00 |
| null | x1.00 | x1.00 |

Per-stock foreign momentum bonus (only when per-stock flow data exists, line 602):

| Condition | adj |
|-----------|-----|
| foreignMomentum='buy' AND signal=buy | x1.03 |
| foreignMomentum='sell' AND signal=sell | x1.03 |

### Sub-function C: Options Implied Move (lines 612-623)

| Condition | adj | Direction |
|-----------|-----|-----------|
| straddleImpliedMove > 3.0% | x0.95 | all patterns (both buy and sell) |

High implied move signals an event period (earnings, macro announcement) where
directional pattern reliability decreases.

### Sub-function D: DD Penalty (REMOVED, lines 625-626)

Previously applied buy x0.90 for DD < 2. Removed to prevent double-counting with CC-06.
Comment preserved for audit trail.

### Final Clamp (lines 628-636)

This function applies **absolute clamping** rather than per-factor adj clamping:

```javascript
patterns[c].confidence = Math.max(10, Math.min(100, patterns[c].confidence));
patterns[c].confidencePred = Math.max(10, Math.min(95, patterns[c].confidencePred));
```

This is the only function in the chain that enforces the final [10, 100] bounds on the
accumulated confidence value. All prior functions apply per-factor relative clamps.

### Constants

| Constant | Value | Grade | Clamp | Academic Source |
|----------|-------|-------|-------|----------------|
| MCS_THRESHOLDS.strong_bull | 70 | [C] | -- | Heuristic percentile threshold |
| MCS_THRESHOLDS.strong_bear | 30 | [C] | -- | Heuristic percentile threshold |
| MCS_BOOST | 1.05 | [D] | -- | Heuristic |
| REGIME_CONFIDENCE_MULT.bull.buy | 1.10 | [C] | -- | Heuristic, HMM calibrated |
| REGIME_CONFIDENCE_MULT.bear.buy | 0.85 | [C] | -- | Heuristic, HMM calibrated |
| FOREIGN_ALIGN_BONUS | 1.03 | [D] | -- | Heuristic |
| IMPLIED_MOVE_THRESHOLD | 3.0% | [C] | -- | Options straddle convention |
| IMPLIED_MOVE_DISCOUNT | 0.95 | [D] | -- | Heuristic |

### Direction Asymmetry

- **MCS v2**: only direction-concordant patterns get boost (buy in bull, sell in bear)
- **HMM regime**: strong asymmetry (bull: buy x1.10 / sell x0.85)
- **Implied Move**: symmetric (all patterns x0.95)
- **Foreign momentum**: direction-concordant only

### Null/Missing Data Behavior

- `_macroComposite === null` or `mcsV2 === null`: MCS sub-function skipped
- `_flowSignals === null` or `flowDataCount === 0`: entire HMM + flow sub-function skipped (quality gate)
- `_flowSignals.stocks[code]` not found: per-stock HMM/flow skipped
- Per-stock flow data null (`foreignMomentum === null`): foreign bonus skipped, but HMM regime multiplier still applies (line 588-590, it is market-wide)
- `_optionsAnalytics === null`: options sub-function skipped

### Double-Counting Prevention

- DD penalty removed (Sub-function D) to prevent overlap with CC-06
- MCS v1 (CC-03 Factor 6) has explicit guard: skipped when mcsV2 is available (line 1218)
- **[FINDING-05] repeated**: foreign momentum (here) vs investor alignment (CC-05 Factor 3) -- different data sources but similar directional signal. Both can fire simultaneously.

---

## [CC-08] _applySurvivorshipAdjustment

**JS Location**: appWorker.js:959-979
**Execution Order**: 8/10

### Stage References (Wide Structure)

- **S1 Input**: `data/backtest/survivorship_correction.json` -> `backtester._survivorshipCorr` (loaded by backtester.js:124-136 via fetch), which was computed from `data/delisted/delisted_index.json`
- **S2 Theory**: S2.2 Finance -- Elton, Gruber & Blake (1996) survivorship bias in mutual fund performance; applied to pattern buy signals
- **S3 Input**: none
- **S4 Output**: pattern.confidence * adj for buy patterns only, adj in [0.92, 1.0]

### Adjustment Formula

$$adj = \max\left(0.92,\ \min\left(1.0,\ 1 - \frac{\Delta WR_{global}}{200}\right)\right)$$

Only applied when `globalDelta > 1` (minimum 1 percentage point WR deviation).

| globalDelta (pp) | adj |
|-------------------|-----|
| 1 | 0.995 |
| 2.8 | 0.986 |
| 5 | 0.975 |
| 10 | 0.950 |
| >= 16 | 0.920 (floor) |

### Constants

| Constant | Value | Grade | Clamp | Academic Source |
|----------|-------|-------|-------|----------------|
| SURVIVORSHIP_MIN_DELTA | 1 pp | [D] | -- | Heuristic minimum |
| SURVIVORSHIP_DIVISOR | 200 | [D] | -- | Converts WR delta to confidence scale |
| SURVIVORSHIP_CLAMP | [0.92, 1.0] | [C] | per-pattern | Consistent with CC-02 RORO band |

### Direction Asymmetry

- **Buy patterns**: full adjustment applied
- **Sell patterns**: NO adjustment (line 974). Rationale: delisted stocks failing = bearish patterns were correct, so sell pattern WR is not inflated by survivorship bias.

### Null/Missing Data Behavior

- `backtester` undefined or `_survivorshipCorr === null`: immediate return, no-op
- `globalDelta <= 1`: no-op (trivial bias)

### Double-Counting Prevention

None needed. This is the only survivorship bias adjustment in the chain.

---

## [CC-09] _applyMacroConditionsToSignals

**JS Location**: appWorker.js:1565-1626
**Execution Order**: 9/10

### Stage References (Wide Structure)

- **S1 Input**: same as CC-03 (`_macroLatest`, `_bondsLatest`)
- **S2 Theory**: S2.5 Macroeconomics -- same frameworks as CC-03, but applied to composite **signals** instead of patterns
- **S3 Input**: `detectedSignals` array (signal.type === 'composite', signal.compositeId)
- **S4 Output**: signal.confidence +/-25%, clamped [0.70, 1.25]

### Target: 5 Composite Signals (by compositeId)

This function operates on **signals** (not patterns). Only `type === 'composite'` signals
are affected (line 1580). Each compositeId has specialized macro conditions:

#### sell_doubleTopNeckVol (baseConf=75)

| Condition | Extra adj |
|-----------|-----------|
| phase = contraction or peak | x1.08 |
| inverted or slope < 0 | x1.10 |
| credit_regime = stress | x1.06 |

Max compound: 1.08 x 1.10 x 1.06 = 1.260 (clamped to 1.25)

#### buy_doubleBottomNeckVol (baseConf=72)

| Condition | Extra adj |
|-----------|-----------|
| phase = trough | x1.12 |
| phase = contraction | x0.90 |
| slope > 0.3 | x1.05 |
| foreigner_signal > 0.3 | x1.06 |

Max compound (trough): 1.12 x 1.05 x 1.06 = 1.247

#### strongSell_shootingMacdVol (baseConf=69)

| Condition | Extra adj |
|-----------|-----------|
| phase = peak or contraction | x1.06 |
| inverted | x1.08 |

Max compound: 1.06 x 1.08 = 1.145

#### sell_shootingStarBBVol (baseConf=69)

| Condition | Extra adj |
|-----------|-----------|
| credit = elevated or stress | x1.05 |
| phase = peak | x1.04 |

Max compound: 1.05 x 1.04 = 1.092

#### sell_engulfingMacdAlign (baseConf=66)

| Condition | Extra adj |
|-----------|-----------|
| phase = peak or contraction | x1.06 |
| foreigner_signal < -0.3 | x1.05 |

Max compound: 1.06 x 1.05 = 1.113

### Constants

Uses same macro state variables as CC-03 (cycle_phase, slope_10y3y, curve_inverted,
credit_regime, foreigner_signal). All multiplier values are [D]-grade heuristics.

| Constant | Value | Grade | Clamp | Academic Source |
|----------|-------|-------|-------|----------------|
| ADJ_CLAMP | [0.70, 1.25] | [D] | per-signal | Same as CC-03 |
| Signal-specific multipliers | 0.90-1.12 | [D] | -- | Heuristic per-signal tuning |

### Direction Asymmetry

- 4 of 5 targeted signals are **sell** composites -> function is sell-bias heavy
- `buy_doubleBottomNeckVol` is the only buy signal, with both boost (trough) and
  dampen (contraction) paths
- All other composite signals (not in the 5 listed) pass through unchanged

### Null/Missing Data Behavior

- `_macroLatest === null AND _bondsLatest === null`: immediate return (line 1569)
- Individual fields null: corresponding conditions simply don't trigger
- Non-composite signals (`s.type !== 'composite'`): skipped (line 1580)

### Double-Counting Prevention

- **[FINDING-08]**: This function applies to **signals**, while CC-03 applies to
  **patterns**. A composite signal like `sell_doubleTopNeckVol` is derived from a
  `doubleTop` pattern that already received CC-03's Factor 5 pattern-specific override
  (x1.10 in contraction + inverted). When this signal then receives its own x1.08 for
  contraction AND x1.10 for inverted, the macro condition is effectively applied twice
  through different objects. This is **by design** (signals aggregate multiple pattern +
  indicator confluences, warranting independent macro sensitivity), but the cumulative
  effect can be aggressive (pattern at x1.10 + signal at x1.19 = effective x1.31 macro
  influence on the displayed composite card).

---

## [CC-10] _injectWcToSignals

**JS Location**: appWorker.js:1632-1643
**Execution Order**: 10/10

### Stage References (Wide Structure)

- **S1 Input**: `data/backtest/eva_scores.json` -> **NOT directly consumed here** (EVA scores are consumed by financials.js:465-472 for display; Wc values come from patterns.js/backtester.js internal computation)
- **S2 Theory**: S2.3 EVA / Stern Stewart -- Wc (composite weight) is the pattern-level weight incorporating backtest performance, regime, and quality scoring
- **S3 Input**: `patterns[i].wc` (set by pattern analysis pipeline)
- **S4 Output**: `signals[i].wc = avgWc` (field injection, **no confidence modification**)

### Formula

```javascript
var sum = 0, cnt = 0;
for (var wi = 0; wi < patterns.length; wi++) {
  if (patterns[wi].wc != null) { sum += patterns[wi].wc; cnt++; }
}
var avgWc = cnt > 0 ? sum / cnt : 1;
for (var si = 0; si < signals.length; si++) {
  signals[si].wc = avgWc;
}
```

### Constants

None. This function has no thresholds, multipliers, or clamps.

### Direction Asymmetry

None. All signals receive the same average Wc regardless of direction.

### Null/Missing Data Behavior

- `signals.length === 0` or `patterns.length === 0`: immediate return (line 1633-1634)
- All patterns have `wc === null` (seed data): `avgWc = 1` (default, line 1639)

### Double-Counting Prevention

Not applicable. This function does not modify confidence values.

---

## Cumulative Effect Analysis

### Per-Function Clamp Summary

| # | Function | adj Clamp | Absolute Clamp | Target |
|---|----------|-----------|----------------|--------|
| 1 | MarketContext | [0.55, 1.35] | conf [10,100] | patterns |
| 2 | RORO Regime | [0.92, 1.08] | conf [10,100] | patterns |
| 3 | Macro 11-Factor | [0.70, 1.25] | conf [10,100] | patterns |
| 4 | Micro ILLIQ/HHI | [0.80, 1.15] | conf [10,100] | patterns |
| 5 | Derivatives 7-Factor | [0.70, 1.30] | conf [10,100] | patterns |
| 6 | Merton DD | [0.75, 1.15] | conf [10,100] | patterns |
| 7 | Phase8 MCS+HMM+Flow+Opts | (sub-function specific) | conf [10,100] | patterns |
| 8 | Survivorship | [0.92, 1.00] | -- | patterns (buy only) |
| 9 | Macro -> Signals | [0.70, 1.25] | conf [10,95] | signals |
| 10 | Wc Inject | n/a | -- | signals (field only) |

### Theoretical Compound Range (Buy Pattern, All Adverse)

```
Step 1: MarketContext (CCSI<85 + earning): adj = 0.88 * 0.93 = 0.818
Step 2: RORO (risk-off):                   adj = 0.92
Step 3: Macro (worst case):                adj = 0.70 (clamp floor)
Step 4: Micro (illiquid):                  adj = 0.80
Step 5: Derivatives (all bearish):         adj = 0.70 (clamp floor)
Step 6: Merton DD (DD < 1.0):             adj = 0.75
Step 7: Phase8 (bear HMM):                adj = 0.85
Step 8: Survivorship (16pp delta):         adj = 0.92

Cumulative: 0.818 * 0.92 * 0.70 * 0.80 * 0.70 * 0.75 * 0.85 * 0.92
          = 0.818 * 0.92 * 0.70 * 0.80 * 0.70 * 0.75 * 0.85 * 0.92
          = ~0.159

For a pattern starting at confidence 70:
  70 * 0.159 = 11.1 -> clamped to max(10, 11.1) = 11.1
```

### Theoretical Compound Range (Sell Pattern, All Favorable)

```
Step 1: MarketContext (earning only):      adj = 0.93 (sell: no CCSI/foreign)
Step 2: RORO (risk-off):                   adj = 1.08
Step 3: Macro (worst macro):               adj = 1.25 (clamp ceiling)
Step 4: Micro:                             adj = 1.00 (ILLIQ no boost on sell)
Step 5: Derivatives (all bearish):         adj = 1.30 (clamp ceiling)
Step 6: Merton DD (DD < 1.0):             adj = 1.15
Step 7: Phase8 (bear HMM):                adj = 1.10
Step 8: Survivorship:                      adj = 1.00 (sell exempt)

Cumulative: 0.93 * 1.08 * 1.25 * 1.00 * 1.30 * 1.15 * 1.10 * 1.00
          = ~2.14

For a pattern starting at confidence 60:
  60 * 2.14 = 128.4 -> clamped to min(100, 128.4) = 100
```

### Realistic Effect Range

In practice, not all factors are simultaneously at extreme values:

| Scenario | Typical adj (buy) | Typical adj (sell) |
|----------|-------------------|-------------------|
| Normal market, most data available | 0.90x - 1.10x | 0.90x - 1.10x |
| Mild macro stress (contraction + elevated VIX) | 0.75x - 0.85x | 1.10x - 1.20x |
| Strong bull (expansion + steep + aligned + MCS high) | 1.15x - 1.25x | 0.80x - 0.90x |
| Crisis (DD<1.0 + bear HMM + credit stress + high VIX) | May hit floor 10 | May hit ceiling 100 |

---

## Confidence Chain Findings

### [FINDING-01] Taylor r* Code vs Doc30 Divergence

- **Location**: compute_macro_composite.py:65, appWorker.js CC-03 Factor 7
- **Issue**: Code uses `TAYLOR_R_STAR = 0.5%`, Doc30 states `r* = 1.0%`
- **Impact**: The lower r* makes the Taylor-implied rate lower, so for a given
  actual BOK rate, the gap appears more hawkish (positive). This shifts Factor 7
  slightly toward sell-bias.
- **Resolution**: Code is authoritative. 0.5% reflects post-COVID Korean estimates.
  Doc30 should be updated to note this calibration.
- **Severity**: Low (0.5pp difference in neutral rate translates to ~2.5% max adj shift)

### [FINDING-02] Output Gap Hardcoded to Zero

- **Location**: compute_macro_composite.py:67
- **Issue**: `TAYLOR_OUTPUT_GAP = 0.0` eliminates the output gap term from Taylor Rule
- **Impact**: Taylor gap becomes purely an inflation-rate gap measure, losing the
  real-activity dimension. In a scenario where output is significantly below potential
  (recessionary gap), the Taylor rule would recommend lower rates, but the hardcoded
  zero misses this.
- **Resolution**: Known limitation. Real-time output gap requires GDP/potential GDP
  estimation not available from current API sources. To partially address: KOSIS IPI
  deviation from trend could serve as a high-frequency proxy.
- **Severity**: Medium (systematically biases Taylor gap away from real-activity signals)

### [FINDING-03] Credit Spread Double-Path

- **Location**: CC-02 RORO Factor 2 (AA- spread, weight 0.10) + CC-03 Factor 3 (AA- spread)
- **Issue**: Same `_bondsLatest.credit_spreads.aa_spread` source feeds both RORO scoring
  and Macro Factor 3. Both can fire simultaneously.
- **Impact**: In credit stress (AA- > 1.5), RORO may classify risk-off (buy x0.92)
  AND Macro Factor 3 applies x0.85. Combined: buy x0.782. The narrow RORO clamp
  [0.92, 1.08] was designed to mitigate this, but the overlap remains.
- **Resolution**: Acceptable by design. RORO provides regime classification (directional
  tilt), Factor 3 provides level-specific discount. The signals are conceptually distinct
  even though they share an input.
- **Severity**: Low (by-design overlap with mitigation via narrow RORO clamp)

### [FINDING-04] VIX/VKOSPI Triple-Path

- **Location**: CC-02 RORO Factor 1 (VKOSPI, weight 0.30) + CC-03 Factor 8 (VIX VRP)
  + CC-01 (VKOSPI removed but historically present)
- **Issue**: VKOSPI/VIX feeds both RORO scoring and Macro Factor 8. After CC-01's
  VKOSPI removal, only two paths remain.
- **Impact**: VIX > 30 triggers both RORO risk-off (buy x0.92) and VRP (buy x0.93).
  Combined: buy x0.856. Without the RORO narrow clamp mitigation, this would be more
  aggressive.
- **Resolution**: Same as FINDING-03. Regime vs level distinction justifies dual path.
  The CC-01 VKOSPI removal ([C-11 FIX]) correctly eliminated the third redundant path.
- **Severity**: Low (two-path overlap is within acceptable bounds)

### [FINDING-05] Foreign Flow Direction Double-Path

- **Location**: CC-05 Factor 3 (`_investorData.alignment`) + CC-07 Sub-B (`_flowSignals.stocks[code].foreignMomentum`)
- **Issue**: Both assess foreign investor directional preference. CC-05 uses market-wide
  1-day alignment signal from investor_summary.json. CC-07 uses per-stock HMM-derived
  foreignMomentum from flow_signals.json.
- **Impact**: When foreign flows are strongly buying, CC-05 may apply x1.08 (aligned_buy)
  and CC-07 may apply x1.03 (foreignMomentum=buy). Combined: x1.11 from foreign flow
  signal alone.
- **Resolution**: Partially justified by granularity difference (market-wide vs
  per-stock). However, the directional signal is fundamentally the same: "foreigners are
  buying." Consider reducing one path's multiplier.
- **Severity**: Medium (x1.11 combined effect from conceptually similar signal)

### [FINDING-06] DD Uses Risk-Neutral d2

- **Location**: appWorker.js:906
- **Issue**: The DD formula uses `d_2` (the BSM risk-neutral put option exercise
  probability) rather than the physical-measure DD. Bharath & Shumway (2008) naive DD
  is intentionally simplified.
- **Impact**: Produces conservative DD estimates (lower DD = higher perceived risk than
  the full iterative Merton solution would give). This means the credit penalty is
  slightly more aggressive than necessary.
- **Resolution**: Documented as intentional conservative approach. The naive DD avoids
  the numerical instability of iterative Merton estimation in a browser JS context.
- **Severity**: Low (conservative bias is acceptable for a risk overlay)

### [FINDING-07] Silent MCS Degradation

- **Location**: CC-03 Factor 6 (mcs v1), CC-07 Sub-A (mcsV2)
- **Issue**: When both `_macroLatest.mcs` and `_macroComposite.mcsV2` are null/absent,
  both MCS paths produce no-op. No warning is logged.
- **Impact**: The confidence chain silently loses its macro composite score adjustment.
  Users see no indication that macro assessment is degraded.
- **Resolution**: Add a console.warn when both MCS paths are null after all 3 loaders
  complete. Could be integrated into `_runPipelineStalenessCheck()`.
- **Severity**: Medium (silent degradation of a key macro signal)

### [FINDING-08] Pattern-Signal Macro Double Application

- **Location**: CC-03 Factor 5 (pattern-specific override) + CC-09 (signal-specific macro)
- **Issue**: A composite signal derived from a pattern (e.g., sell_doubleTopNeckVol from
  doubleTop) inherits the pattern's already-adjusted confidence, then receives additional
  macro adjustments in CC-09.
- **Impact**: In contraction + inverted curve: doubleTop pattern gets Factor 5 x1.10,
  then the derived composite signal gets CC-09 x1.08 x 1.10 = x1.188. The macro
  influence is applied through two different adjustment stages to two different objects
  that ultimately appear on the same UI card.
- **Resolution**: By design. The composite signal is a higher-confidence object that
  aggregates pattern + indicator confluences. Its independent macro sensitivity is
  warranted. However, users should understand that the displayed composite confidence
  reflects double macro influence.
- **Severity**: Low (by-design, but could surprise users expecting single macro pass)

### [FINDING-09] RORO Thresholds All [C]/[D] Grade

- **Location**: CC-02, appState.js RORO constants
- **Issue**: All 10 RORO constants (weights, thresholds, multipliers) are [C] or [D]
  grade. The hysteresis thresholds (ENTER_ON=0.25, EXIT_ON=0.10) and factor weights
  (VOL=0.30, FX=0.20, etc.) are heuristic with no empirical calibration against Korean
  market data.
- **Impact**: The RORO regime classification may not optimally separate risk-on/off
  periods for KOSPI/KOSDAQ. Backtesting the regime labels against subsequent returns
  would validate or necessitate recalibration.
- **Resolution**: Stage B empirical calibration recommended. Use historical KOSPI returns
  to evaluate regime classification accuracy.
- **Severity**: Medium (foundational regime classification relies on uncalibrated heuristics)

### [FINDING-10] Clamp Range Inconsistency

- **Location**: CC-01 [0.55, 1.35] vs CC-02 [0.92, 1.08] vs CC-03 [0.70, 1.25]
- **Issue**: Clamp ranges vary by 3x across functions. CC-01's [0.55, 1.35] is the
  widest, despite having only 3-4 simple factors. CC-02's [0.92, 1.08] is the narrowest,
  despite aggregating 5 factors into a regime score.
- **Impact**: CC-01 can dominate the compound effect with a single CCSI < 85 reading
  (x0.88, nearly as much as CC-03's 11-factor output clamped at x0.70). The clamp
  ranges do not proportionally reflect factor complexity.
- **Resolution**: Consider narrowing CC-01's clamp to [0.70, 1.25] (same as CC-03) or
  widening CC-02 slightly. The current ranges are functional but not optimally calibrated.
- **Severity**: Low (functional but asymmetric design)
