# 02. Chart Pattern Implementation Bridge

> **PatternEngine v2.0** — `js/patterns.js` (4,200 lines)
> Last regenerated: 2026-04-06 (post D-heuristic constant audit)
> Constant grade distribution: [A] 40, [B] 51, [C] 63, [D] 64, [E] 1

---

## Table of Contents

1. [Chart Pattern Infrastructure](#chart-pattern-infrastructure)
2. [Triangle Patterns (3)](#triangle-patterns)
3. [Wedge Patterns (2)](#wedge-patterns)
4. [Double Patterns (2)](#double-patterns)
5. [Head & Shoulders (2)](#head--shoulders)
6. [Channel (1)](#channel)
7. [Cup and Handle (1)](#cup-and-handle)
8. [Support/Resistance Detection](#supportresistance-detection)
9. [Neckline & Breakout Confirmation](#neckline--breakout-confirmation)

---

## Chart Pattern Infrastructure

### Swing Point Detection

All chart patterns depend on swing high/low detection, computed once in `analyze()` and shared across all chart pattern detectors.

**File:** patterns.js lines 3618-3644

**Method:** `_findSwingHighs(candles, lookback, detectFrom)` / `_findSwingLows(candles, lookback, detectFrom)`

- **Lookback:** 3 bars on each side (fixed)
- **A point is a swing high if:** `candles[i].high > candles[i-j].high` AND `candles[i].high > candles[i+j].high` for all j in [1, lookback]
- **Returns:** `{ index, price, time }[]`
- **PERF:** `swingFrom = max(0, detectFrom - HS_WINDOW - 10)` for UI analysis

**Note:** lookback=3 uses future bars (i+1, i+2, i+3), creating a 3-bar look-ahead. All chart patterns store `_swingLookback: 3` for backtester entry offset compensation (Fix-13).

### Adaptive Quality System

Chart patterns use `_adaptiveQuality(patternType, features)` instead of `_quality()`.

**File:** patterns.js line 560

- **Base:** Same Q_WEIGHT as candle patterns (body 0.25, volume 0.25, trend 0.20, shadow 0.15, extra 0.15)
- **Learning:** If `_globalLearnedWeights[patternType]` exists with confidence > 0.05:
  - Alpha = min(decayedConfidence * 2, alphaCap)
  - alphaCap = 0.7 if R^2 > 0.3, else 0.5
  - W_final = (1-alpha) * W_prior + alpha * W_learned
- **AMH decay:** alpha *= exp(-lambda * daysSince) via `_temporalDecayFactor()`

### Price Target System (Chart Patterns)

Chart patterns use **measured move** (pattern height projected from breakout) with triple cap:

**File:** patterns.js lines 192-196

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `CHART_TARGET_ATR_CAP` | 6 | [B] | EVT 99.5% VaR bound (Doc 12 S4.3) |
| `CHART_TARGET_RAW_CAP` | 2.0 | [B] | Bulkowski P80 (2x pattern height = top 20%) |

**Dynamic ATR cap (Hill estimator):**
- alpha < 3 (heavy tail) -> cap = 4
- alpha < 4 (moderate) -> cap = 5
- alpha >= 4 (near-normal) -> cap = 6 (default)

**Formula:** `patternHeight = min(raw * hw * mw, raw * RAW_CAP, atr * dynamicATRCap)`

Where `hw` = Hurst weight, `mw` = mean-reversion weight.

### Timeframe Activation

Chart patterns are timeframe-gated via `TF_PATTERN_MAP`:

| TF | Available Chart Patterns |
|----|-------------------------|
| 1m, 5m | none |
| 15m | triangles + wedges + channel |
| 30m | 15m + doubles |
| 1h | all except H&S |
| 1d | all |
| 1w | all |
| 1M | doubles + channel |

---

## Triangle Patterns

### Ascending Triangle (상승 삼각형)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — Flat resistance with rising support
- **Secondary:** Bulkowski (2005) — Median duration 47 days, 72% upside breakout
- **core_data ref:** Doc 07 S7.1, Doc 15 S2.1

#### Detection Chain
1. **Swing points:** Filter recent 60 bars (Phase1-C: was 40)
2. **Flat resistance:** Two swing highs with price diff <= ATR * 0.5
3. **Rising support:** Relevant lows between/around the highs, Theil-Sen slope > 0 (3+ points) or 2-point fallback
4. **Pattern registration:** resistanceLevel = avg(h1.price, h2.price)

**File:** patterns.js line 2752
**Method:** `detectAscendingTriangle(candles, swingHighs, swingLows, ctx)`

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Resistance tolerance | ATR * 0.5 | — | Inline, Bulkowski tighter |
| Lookback window | 60 bars | [C] | Phase1-C: Bulkowski median 47d |
| Min relevant lows | 2 | — | Minimum triangle definition |

#### Forecast (Target/StopLoss)
- **Price target:** resistanceLevel + min(raw * hw * mw, raw * 2.0, ATR * dynamicCap)
- **Stop loss:** Last relevant low - ATR
- **Raw:** resistance - first low (triangle height)

#### Quality Score
- body: 0.7 (fixed, geometry-based)
- volume: volRatio / 2
- trend: 0.6 (fixed)
- extra: volumeContraction (C-5: Edwards & Magee contraction check)

#### KRX 5-Year Statistics
- WR: 39.5%, n=352, signal: buy/strong

---

### Descending Triangle (하락 삼각형)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — Flat support with descending resistance
- **Secondary:** Bulkowski (2005) — Bearish mirror of ascending
- **core_data ref:** Doc 07 S7.1, Doc 15 S2.2

#### Detection Chain
1. **Flat support:** Two swing lows with price diff <= ATR * 0.5
2. **Descending resistance:** Relevant highs, Theil-Sen slope < 0 or 2-point fallback
3. **Confidence ceiling:** min(90) — M-8 Taleb-motivated

**File:** patterns.js line 2817
**Method:** `detectDescendingTriangle(candles, swingHighs, swingLows, ctx)`

#### Forecast
- **Price target:** supportLevel - patternHeight
- **Stop loss:** First high + ATR

#### KRX 5-Year Statistics
- WR: 54.3%, n=503, signal: sell/strong

#### Modification History
- [Fix C-3] Removed inline breakout confirmation (look-ahead bias)
- [M-8] Added confidence ceiling of 90

---

### Symmetric Triangle (대칭 삼각형)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — "Energy compression" pattern
- **Secondary:** Bulkowski (2005) — 54% upside breakout, measured move target
- **core_data ref:** Doc 07 S7.2, Doc 15 S2.3

#### Detection Chain
1. **Swing points:** Recent 50 bars
2. **Convergence:** h2.price < h1.price (descending highs) AND l2.price > l1.price (ascending lows)
3. **Slope validation:** |highSlope|/ATR and |lowSlope|/ATR both > 0.01 (not flat)
4. **Symmetry:** Slope ratio between 0.3 and 3.0
5. **Minimum span:** 10 bars

**File:** patterns.js line 3042
**Method:** `detectSymmetricTriangle(candles, swingHighs, swingLows, ctx)`

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Slope ratio bounds | [0.3, 3.0] | — | Inline: asymmetry filter |
| Min slope magnitude | 0.01/ATR | — | Inline: not sideways |
| Min span | 10 bars | — | Inline |

#### Signal Behavior
- **Pre-breakout:** signal = 'neutral', no stopLoss/priceTarget
- **Post-breakout:** Signal dynamically set to 'buy' or 'sell' by `_checkTriangleBreakout()`

#### Quality Score
- extra: symmetryScore = 1 - |1 - slopeRatio| / 2

#### KRX 5-Year Statistics
- WR: 32.3%, n=2,678, signal: neutral/medium (pre-breakout)

---

## Wedge Patterns

### Rising Wedge (상승 쐐기)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — Bearish reversal from converging uptrend
- **Secondary:** Bulkowski (2005) — Valid wedge has >= 10% convergence
- **core_data ref:** Doc 07 S7.3, Doc 15 S3.1

#### Detection Chain
1. **Swing points:** Recent 50 bars, sorted by index
2. **Both rising:** h2.price > h1.price AND l2.price > l1.price
3. **Convergence:** highSlope/ATR < lowSlope/ATR (upper line flatter than lower)
4. **Width reduction:** endHeight < startHeight * 0.9 (minimum 10% convergence)
5. **Minimum span:** 8 bars

**File:** patterns.js line 2886
**Method:** `detectRisingWedge(candles, swingHighs, swingLows, ctx)`

**Theil-Sen optimization:** Slopes hoisted outside loop (Phase I) to avoid O(n^2) redundancy per iteration.

#### Forecast
- **Price target:** max(l1.price, entry - min(wedgeHeight * hw * mw, height * 2.0, ATR * cap))
- **Stop loss:** h2.price + ATR

#### Quality Score
- shadow: volumeContraction (C-5)
- Other: body 0.6, volume volRatio/2, trend 0.5

#### KRX 5-Year Statistics
- WR: 59.8%, n=1,054, signal: sell/medium

---

### Falling Wedge (하락 쐐기)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — Bullish reversal from converging downtrend
- **core_data ref:** Doc 07 S7.3, Doc 15 S3.2

#### Detection Chain
1. **Both falling:** h2.price < h1.price AND l2.price < l1.price
2. **Convergence:** |lowSlope|/ATR < |highSlope|/ATR (lower line flatter)
3. **P0-fix:** Same convergence check as rising wedge (was missing)

**File:** patterns.js line 2962
**Method:** `detectFallingWedge(candles, swingHighs, swingLows, ctx)`

#### Forecast
- **Price target:** min(h1.price, entry + min(wedgeHeight * hw * mw, height * 2.0, ATR * cap))
- **Stop loss:** l2.price - ATR

#### KRX 5-Year Statistics
- WR: 39.1%, n=2,380, signal: buy/medium

#### Known Anomaly
- KRX buy-side structural underperformance (see `project_fallingwedge_krx_anomaly` memory)
- Residual -20pp gap vs Bulkowski is attributed to KRX structural factors (T+2, sell bias)

---

## Double Patterns

### Double Bottom (이중 바닥)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — "W-formation: prior downtrend required"
- **Secondary:** Bulkowski (2005) — Neckline breakout confirmation, volume decline at 2nd low
- **core_data ref:** Doc 07 S7.4, Doc 15 S4.1

#### Detection Chain
1. **Swing lows:** Recent 50 bars
2. **Price match:** |l1.price - l2.price| <= ATR * 0.5
3. **Span:** 5 to 40 bars between lows
4. **Prior downtrend:** Theil-Sen 15-bar lookback before l1 (Phase1-FIX)
5. **Neckline:** Max high between l1 and l2 (actual resistance)

**File:** patterns.js line 3127
**Method:** `detectDoubleBottom(candles, swingLows, ctx)`

#### Neckline Calculation
```
neckline = max(candles[j].high) for j in [l1.index, l2.index]
```
Stored as `pattern.neckline` for downstream confirmation check.

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Price tolerance | ATR * 0.5 | — | Bulkowski: tighter than original |
| Span range | [5, 40] bars | — | Inline |

#### Forecast
- **Price target:** neckline + min(raw * hw * mw, raw * 2.0, ATR * cap)
- **Stop loss:** min(l1.price, l2.price) - ATR
- **Raw:** neckline - min(l1, l2) (pattern height)

#### Volume Pattern
- Bulkowski: 2nd low with lower volume -> volDecline bonus (0.8 vs 0.5)

#### KRX 5-Year Statistics
- WR: 62.1%, n=1,939, signal: buy/strong

---

### Double Top (이중 천장)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — "M-formation: prior uptrend required"
- **core_data ref:** Doc 07 S7.4, Doc 15 S4.2

#### Detection Chain
1. **Swing highs:** Recent 50 bars
2. **Price match:** |h1.price - h2.price| <= ATR * 0.5
3. **Prior uptrend:** Phase1-FIX
4. **Neckline:** Min low between h1 and h2

**File:** patterns.js line 3177
**Method:** `detectDoubleTop(candles, swingHighs, ctx)`

#### Forecast
- **Price target:** neckline - patternHeight
- **Stop loss:** max(h1.price, h2.price) + ATR

#### KRX 5-Year Statistics
- WR: 74.7%, n=1,539, signal: sell/strong

---

## Head & Shoulders

### Head and Shoulders (머리어깨형)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — "Most reliable reversal pattern"
- **Secondary:** Bulkowski (2005) — Confirmed 83% vs unconfirmed 35%, avg 65 days, P75=85 days
- **core_data ref:** Doc 07 S7.5, Doc 15 S5.1

#### Detection Chain
1. **Swing highs:** Recent `HS_WINDOW` (120) bars
2. **Three highs:** ls, head, rs where head > ls AND head > rs
3. **Shoulder symmetry:** |ls.price - rs.price| / head.price <= 0.15 (HS_SHOULDER_TOLERANCE)
4. **Troughs:** t1 between ls-head, t2 between head-rs (swing lows)
5. **Neckline:** Sloped line through (t1.price, t1.index) and (t2.price, t2.index)
6. **Proximity filter:** lastClose <= neckline + ATR * 0.5 (not already above)
7. **Far-breakout filter:** lastClose >= neckline - ATR * 2.0 (not already too far below)
8. **Prior uptrend:** Pre-ls price < ls.price - ATR * 0.3

**File:** patterns.js line 3227
**Method:** `detectHeadAndShoulders(candles, swingHighs, swingLows, ctx)`

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `HS_WINDOW` | 120 | [C] | Bulkowski P75=85 + KRX margin (Phase1-A: 80->120) |
| `HS_SHOULDER_TOLERANCE` | 0.15 | [B] | Bulkowski: 40% of valid H&S have >5% asymmetry (Phase1-A: 0.10->0.15) |
| `NECKLINE_BREAK_LOOKFORWARD` | 20 | [B] | Bulkowski (2005): avg breakout 5-15 days |
| `NECKLINE_BREAK_ATR_MULT` | 0.5 | [B] | Edwards & Magee "decisive penetration" |
| `NECKLINE_UNCONFIRMED_PENALTY` | 15 | [B] | Bulkowski: confirmed 83% vs unconfirmed 35% |
| `NECKLINE_UNCONFIRMED_PRED_PENALTY` | 20 | [D] | Heuristic model penalty |

#### Neckline Calculation
```
neckSlope = (t2.price - t1.price) / (t2.index - t1.index)
neckAtEnd = t1.price + neckSlope * (endIdx - t1.index)
```

#### Forecast
- **Price target:** neckAtEnd - min(raw * hw * mw, raw * 2.0, ATR * cap)
  - raw = head.price - avg(t1.price, t2.price) (measured move)
- **Stop loss:** rs.price + ATR * 1.5 (right shoulder + buffer)

#### Quality Score
- body: patternHeight / ATR / 3
- volume: volRatio/2
- trend: dynamic from prior uptrend magnitude (was 0.7 hardcoded)
- shadow: symmetry = 1 - shoulderAsym / HS_SHOULDER_TOLERANCE
- extra: pivotVolumeDecline (C-5: LS > Head > RS volume pattern)

#### KRX 5-Year Statistics
- WR: 56.9%, n=1,156, signal: sell/strong

---

### Inverse Head and Shoulders (역머리어깨형)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — Bullish mirror of H&S
- **Secondary:** Bulkowski (2005) — 62% throwback after breakout
- **core_data ref:** Doc 07 S7.5, Doc 15 S5.2

#### Detection Chain
1. **Three swing lows:** ls, head, rs where head < ls AND head < rs
2. **Shoulder symmetry:** |ls.price - rs.price| / |head.price| <= 0.15
3. **Troughs become peaks:** t1, t2 are swing highs between pivots
4. **Neckline:** Sloped line through t1 and t2
5. **Proximity:** lastClose >= neckline - ATR * 0.5 AND <= neckline + ATR * 2.0
6. **Prior downtrend:** Pre-ls price > ls.price + ATR * 0.3

**File:** patterns.js line 3308
**Method:** `detectInverseHeadAndShoulders(candles, swingHighs, swingLows, ctx)`

#### Fixes Applied
- [P0-fix] head.price used as denominator (was ls.price, creating asymmetric scaling)
- [Fix invH&S-gap] Added far-breakout filter (ATR * 2.0) and prior downtrend check
- [Fix invH&S-gap] Dynamic trend score (was 0.7 hardcoded)

#### Forecast
- **Price target:** neckAtEnd + patternHeight
- **Stop loss:** rs.price - ATR * 1.5

#### KRX 5-Year Statistics
- WR: 44.0%, n=1,280, signal: buy/strong

#### Known Issues
- Residual -20pp gap vs Bulkowski theoretical due to KRX structural factors
- See `invhs_gap_analysis.md` memory file for root cause analysis

---

## Channel

### Channel (채널) — ascending / descending / horizontal

#### Academic Basis
- **Primary:** Murphy (1999) "Technical Analysis of the Financial Markets" — parallel trendline pairs
- **Secondary:** Edwards & Magee (2018) — channel continuation/reversal signals
- **core_data ref:** Doc 07 S7.6

#### Detection Chain (6 steps)
1. **Swing points:** Recent 3x CHANNEL_MIN_SPAN or 60 bars (whichever larger)
2. **OLS fitting:** Separate linear regression for swing highs and lows (line 3669)
3. **Parallelism:** |slope_hi - slope_lo| / ATR < 0.020 (CHANNEL_PARALLELISM_MAX)
4. **Width:** Channel width at midpoint between [1.5, 8.0] * ATR
5. **Containment:** >= 80% of bars within channel (with 0.15*ATR tolerance)
6. **Touches:** hiTouches + loTouches >= 3 (within ATR * 0.3 of fitted line)

**File:** patterns.js line 3651
**Method:** `detectChannel(candles, swH, swL, ctx)`

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `CHANNEL_TOUCH_TOL` | 0.3 | [D] | ATR*0.3 touch tolerance |
| `CHANNEL_PARALLELISM_MAX` | 0.020 | [D] | Slope difference per bar/ATR |
| `CHANNEL_WIDTH_MIN` | 1.5 | [D] | ATR multiples |
| `CHANNEL_WIDTH_MAX` | 8.0 | [D] | ATR multiples |
| `CHANNEL_CONTAINMENT` | 0.80 | [D] | 80% bar containment rate |
| `CHANNEL_MIN_SPAN` | 15 | [D] | Minimum bars |
| `CHANNEL_MIN_TOUCHES` | 3 | [B] | Murphy (1999) minimum |

#### Direction Classification
```
avgSlope = (hiLine.slope + loLine.slope) / 2
slopeNorm = avgSlope / ATR
direction = |slopeNorm| < 0.02 ? 'horizontal' : slopeNorm > 0 ? 'ascending' : 'descending'
```

#### Confidence Scoring
- Base: 45
- Touch bonus: min(15, (touches - 3) * 5)
- Containment bonus: min(15, round((containment - 0.80) * 150))
- Clamp: [20, 85]

#### Forecast
- **Ascending buy:** upperNow + width * 0.5 * hw * mw
- **Descending sell:** lowerNow - width * 0.5 * hw * mw
- **Stop loss:** Opposite channel line +/- ATR * STOP_LOSS_ATR_MULT

#### KRX 5-Year Statistics
- WR: 58.0%, n=125, signal: direction-dependent

---

## Cup and Handle

### Cup and Handle (컵앤핸들)

#### Academic Basis
- **Primary:** O'Neil (1988) "How to Make Money in Stocks"
- **Secondary:** Bulkowski (2005) — 61% breakout success
- **core_data ref:** Doc 07 S9.2

#### Detection Chain
1. **Left rim:** Local high (higher than 3 bars each side) — scan from n-200
2. **Cup search:** For each cupWidth in [30, 65] step 5:
   a. Find minimum low between rimL+5 and rimR-5
   b. Cup depth: 12-35% of left rim price
   c. Right rim: max high near rimR, must recover >= 90% of left rim
3. **U-shape verification:** Parabolic fit y = a*(t-center)^2 + bottom, R^2 >= 0.6
4. **Handle search:** For handleLen in [15-30% of cupWidth]:
   a. Handle low must be < 50% of cup depth
   b. Handle end close > rightRim * 0.98 (near-breakout)
5. **Volume U-shape:** Bottom volume < left volume AND right volume > bottom volume

**File:** patterns.js line 3790
**Method:** `detectCupAndHandle(candles, swingHighs, swingLows, ctx)`

#### Key Parameters
| Parameter | Value | Source |
|-----------|-------|--------|
| Cup width | 30-65 bars | cross-validation corrected |
| Cup depth | 12-35% of rim | O'Neil/Bulkowski |
| Handle depth | < 50% of cup depth | Doc 07 S9.2 |
| Handle length | 15-30% of cup width | proportional |
| U-shape R^2 | >= 0.6 | Doc 07 S9.2 |
| Rim recovery | >= 90% | O'Neil |

#### Neckline
```
neckline = max(leftRimPrice, rightRimPrice)
```

#### Forecast
- **Price target:** rightRim + min(cupDepth * hw * mw, depth * 2.0, ATR * cap)
- **Stop loss (handle found):** handleLow - ATR * STOP_LOSS_ATR_MULT
- **Stop loss (no handle):** bottom + 50% * (rightRim - bottom)

#### Quality Score
- body: R^2 (U-shape fit quality)
- volume: volUShape (0.8 if U-shape, 0.5 otherwise)
- trend: 0.8 with handle, 0.5 without
- shadow: rim symmetry = 1 - |leftRim - rightRim| / leftRim / 0.10
- extra: min(depth / 0.25, 1) — optimal depth around 25%

#### KRX 5-Year Statistics
- WR: 61.0%, n=125, signal: buy/strong

---

## Support/Resistance Detection

### Technical S/R (기술적 지지/저항)

#### Academic Basis
- **Primary:** Edwards & Magee (2018) — Price clustering at prior swing points
- **core_data ref:** Doc 07 S8.2

#### Algorithm
**File:** patterns.js line 3395
**Method:** `detectSupportResistance(candles, swingHighs, swingLows, ctx)`

1. **Input:** All swing highs (resistance) and lows (support)
2. **Clustering:** ATR * 0.5 tolerance window
3. **Minimum touches:** 2 (cluster size >= 2)
4. **Type assignment:** Support if support count >= cluster/2, else resistance
5. **Strength:** min(touches / 4, 1.0)
6. **Max levels:** 10, sorted by touch count (descending)

### Valuation S/R (밸류에이션 지지/저항)

#### Academic Basis
- **Primary:** Rothschild & Stiglitz (1976) — Information asymmetry screening theory
- **Secondary:** Shiller (2000) — Behavioral anchoring at round numbers
- **Tertiary:** Damodaran (2012) — PBR=1.0 as asset liquidation value

**File:** patterns.js line 3457
**Method:** `detectValuationSR(currentPrice, financialData)`

#### Valuation Thresholds

**PBR levels** (BPS-based, BPS > 0 required):
| Mult | Label | Meaning |
|------|-------|---------|
| 0.5 | PBR=0.5 | Deep value |
| 1.0 | PBR=1.0 | Book value |
| 1.5 | PBR=1.5 | — |
| 2.0 | PBR=2.0 | — |
| 3.0 | PBR=3.0 | Overvalued |

**PER levels** (EPS-based, EPS > 0 required):
| Mult | Label | Meaning |
|------|-------|---------|
| 5 | PER=5 | Deep value |
| 10 | PER=10 | Value stock |
| 15 | PER=15 | Fair value |
| 20 | PER=20 | Growth stock |
| 30 | PER=30 | Overvalued |

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `VALUATION_SR_RANGE` | 0.30 | [C] | KRX daily limit +/-30% |
| `VALUATION_SR_MAX_LEVELS` | 5 | [D] | Overcrowding prevention |
| `VALUATION_SR_STRENGTH` | 0.6 | [D] | Conservative vs technical (single touch) |

**Merging:** PBR and PER levels within 2% of each other are combined with label concatenation (e.g., "PBR=1.0 / PER=10").

### S/R Confluence

**File:** patterns.js line 3553
**Method:** `_applyConfluence(patterns, srLevels, ctx)`

- For each pattern with stopLoss/priceTarget:
  - If buy pattern stopLoss within ATR of support level -> boost += 3 * strength
  - If sell pattern stopLoss within ATR of resistance level -> boost += 3 * strength
  - If priceTarget within ATR of any S/R level -> boost += 2 * strength
- Confidence cap: 90 (Taleb 2007 overconfidence bias)
- Valuation S/R (type 'valuation_support'/'valuation_resistance') intentionally excluded from confluence boost but included in downstream processing.

---

## Neckline & Breakout Confirmation

### Neckline Break Confirmation

**File:** patterns.js line 3949
**Method:** `_checkNecklineBreak(candles, pattern, atr)`

**Applies to:** headAndShoulders, inverseHeadAndShoulders, doubleBottom, doubleTop, cupAndHandle

**Algorithm:**
1. Scan from endIndex+1 to endIndex + NECKLINE_BREAK_LOOKFORWARD (20 bars)
2. For sloped necklines (H&S): interpolate neckline price at each bar
3. For horizontal necklines (doubles/cup): use stored neckline value
4. **Breakout condition:** close beyond neckline +/- ATR * 0.5
5. Records: breakIndex, breakPrice, _breakUsedFutureData (look-ahead flag)

**Unconfirmed penalties (lines 844-852):**
- confidence -= 15 (NECKLINE_UNCONFIRMED_PENALTY)
- confidencePred -= 20 (NECKLINE_UNCONFIRMED_PRED_PENALTY)
- Also applied when `_breakUsedFutureData = true` (C-2 FIX: look-ahead bias prevention)

### Triangle/Wedge Breakout Confirmation

**File:** patterns.js line 4049
**Method:** `_checkTriangleBreakout(candles, pattern, atr)`

**Applies to:** ascendingTriangle, descendingTriangle, symmetricTriangle, risingWedge, fallingWedge

**Algorithm:**
1. Extract trendline slopes from pattern.trendlines[0] and [1]
2. Scan endIndex+1 to endIndex + TRIANGLE_BREAK_LOOKFORWARD (15 bars)
3. Extrapolate each trendline to bar j
4. **Breakout condition:** close beyond line +/- ATR * 0.3 (TRIANGLE_BREAK_ATR_MULT)
5. **Symmetric triangle special:** Signal dynamically set to 'buy' or 'sell' based on breakout direction, with measured move target

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `TRIANGLE_BREAK_ATR_MULT` | 0.3 | [B] | Bulkowski: less decisive than H&S neckline |
| `TRIANGLE_BREAK_LOOKFORWARD` | 15 | [B] | Bulkowski: 2/3 to 3/4 of apex |
| `TRIANGLE_UNCONFIRMED_PENALTY` | 12 | [D] | Confidence deduction |
| `TRIANGLE_UNCONFIRMED_PRED_PENALTY` | 15 | [D] | ConfidencePred deduction |

**Volume confirmation (C-5):**
- If breakout bar volume >= 1.5x pattern average -> confidence + 3
- If breakout bar volume < 0.8x -> confidence - 2
- `breakoutVolumeConfirmed` flag set at >= 1.2x

---

## Appendix: Volume Analysis Methods

### Pivot Volume Decline (_pivotVolumeDecline)

**File:** patterns.js line 499

Used by: H&S, inverse H&S

- Average volume at each pivot (+-1 bar to reduce noise)
- Scoring: full decline (LS > Head > RS) = 1.0, partial = 0.7, none = 0.3
- **Reference:** Bulkowski (2005) — volume should decline from LS to RS

### Volume Contraction (_volumeContraction)

**File:** patterns.js line 527

Used by: all triangles, wedges

- Split pattern span into first half and second half
- Ratio = second_avg / first_avg
- Scoring: ratio < 0.5 -> 1.0 (strong contraction), ratio = 1.0 -> 0.5 (unchanged), ratio > 1.5 -> 0.2 (expansion)
- **Reference:** Edwards & Magee (2018) — volume contraction during convergence

---

## Appendix: Complete Chart Pattern Constant Reference

| # | Constant | Value | Grade | Line | Source |
|---|----------|-------|-------|------|--------|
| 1 | CHART_TARGET_ATR_CAP | 6 | [B] | 193 | EVT 99.5% VaR |
| 2 | CHART_TARGET_RAW_CAP | 2.0 | [B] | 196 | Bulkowski P80 |
| 3 | HS_WINDOW | 120 | [C] | 238 | Bulkowski P75 + KRX margin |
| 4 | HS_SHOULDER_TOLERANCE | 0.15 | [B] | 242 | Bulkowski 40% asymmetric |
| 5 | NECKLINE_BREAK_LOOKFORWARD | 20 | [B] | 209 | Bulkowski avg 5-15d |
| 6 | NECKLINE_BREAK_ATR_MULT | 0.5 | [B] | 213 | Edwards & Magee |
| 7 | NECKLINE_UNCONFIRMED_PENALTY | 15 | [B] | 216 | Bulkowski confirmed 83% vs 35% |
| 8 | NECKLINE_UNCONFIRMED_PRED_PENALTY | 20 | [D] | 217 | Heuristic |
| 9 | TRIANGLE_BREAK_ATR_MULT | 0.3 | [B] | 221 | Bulkowski: less decisive |
| 10 | TRIANGLE_BREAK_LOOKFORWARD | 15 | [B] | 222 | Bulkowski 2/3-3/4 apex |
| 11 | TRIANGLE_UNCONFIRMED_PENALTY | 12 | [D] | 223 | Heuristic |
| 12 | TRIANGLE_UNCONFIRMED_PRED_PENALTY | 15 | [D] | 224 | Heuristic |
| 13 | CHANNEL_TOUCH_TOL | 0.3 | [D] | 228 | ATR tolerance |
| 14 | CHANNEL_PARALLELISM_MAX | 0.020 | [D] | 229 | Slope diff threshold |
| 15 | CHANNEL_WIDTH_MIN | 1.5 | [D] | 230 | ATR multiples |
| 16 | CHANNEL_WIDTH_MAX | 8.0 | [D] | 231 | ATR multiples |
| 17 | CHANNEL_CONTAINMENT | 0.80 | [D] | 232 | Bar inclusion rate |
| 18 | CHANNEL_MIN_SPAN | 15 | [D] | 233 | Minimum bars |
| 19 | CHANNEL_MIN_TOUCHES | 3 | [B] | 234 | Murphy (1999) |
| 20 | VALUATION_SR_RANGE | 0.30 | [C] | 352 | KRX +/-30% |
| 21 | VALUATION_SR_MAX_LEVELS | 5 | [D] | 355 | Overcrowding |
| 22 | VALUATION_SR_STRENGTH | 0.6 | [D] | 359 | Conservative |
