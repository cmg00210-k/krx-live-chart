# 01. Candle Pattern Implementation Bridge

> **PatternEngine v2.0** — `js/patterns.js` (4,200 lines)
> Last regenerated: 2026-04-06 (post D-heuristic constant audit)
> Constant grade distribution: [A] 40, [B] 51, [C] 63, [D] 64, [E] 1

---

## Table of Contents

1. [Global Infrastructure](#global-infrastructure)
2. [Single-Candle Patterns (13)](#single-candle-patterns)
3. [Double-Candle Patterns (10)](#double-candle-patterns)
4. [Triple-Candle Patterns (8)](#triple-candle-patterns)
5. [Five-Candle Patterns (2)](#five-candle-patterns)
6. [Cross-Cutting Systems](#cross-cutting-systems)

---

## Global Infrastructure

### ATR Normalization System

All candle pattern thresholds are expressed as ATR(14) multiples. This ensures equal sensitivity across Samsung (~60,000 KRW) and penny stocks (~1,000 KRW).

**File:** `patterns.js` lines 140-172

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `ATR_FALLBACK_PCT` | 0.02 | [D] | KRX large-cap median ATR/close ~2.1% |
| `ATR_FALLBACK_BY_TF['1d']` | 0.020 | [D] | Random-walk scaling from daily |
| `ATR_FALLBACK_BY_TF['5m']` | 0.004 | [D] | Empirical intraday ratio |
| `ATR_FALLBACK_BY_TF['1w']` | 0.044 | [D] | sqrt(5) * daily |

**Method:** `_atr(atr, idx, candles)` at line 624 — returns `atr[idx]` if available, else `close * fallbackPct` (timeframe-aware).

### Quality Score System

**Method:** `_quality(features)` at line 547

Five-factor weighted scoring with `Q_WEIGHT`:

| Factor | Weight | Grade | Description |
|--------|--------|-------|-------------|
| `body` | 0.25 | [B] | Body size / ATR ratio |
| `volume` | 0.25 | [B] | Volume / VMA(20) ratio |
| `trend` | 0.20 | [B] | Preceding trend strength (Theil-Sen) |
| `shadow` | 0.15 | [B] | Shadow quality (pattern-specific) |
| `extra` | 0.15 | [B] | Additional confirmation factor |

Formula: `raw = W.body*body + W.volume*volume + W.trend*trend + W.shadow*shadow + W.extra*extra`
Output: `Math.round(raw * 100)`, clamped [0, 100]

Extra default is 0.3 (conservative; 0.5 was "half credit without confirmation" — inflation risk).

### Trend Detection

**Method:** `_detectTrend(candles, endIndex, lookback, atrVal)` at line 428

- **Algorithm:** Theil-Sen robust regression (Sen 1968, Theil 1950)
- **Breakdown point:** ~29.3% outlier resistance
- **Normalization:** slope / ATR, then compare against `TREND_THRESHOLD = 0.3` [D]
- **R-squared weighting:** strength *= (0.5 + 0.5*R^2) — low R^2 halves strength (floor)
- **core_data ref:** Doc 07 S2.3

### Price Target & Stop Loss

**Candle target method:** `_candleTarget(candles, idx, signal, strength, atr, hw, mw)` at line 614

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `CANDLE_TARGET_ATR.strong` | 1.88 | [B] | KRX 76,443 Theil-Sen calibration |
| `CANDLE_TARGET_ATR.medium` | 2.31 | [B] | KRX calibration (CI95 [2.23, 2.39]) |
| `CANDLE_TARGET_ATR.weak` | 2.18 | [B] | KRX calibration (CI95 [2.09, 2.28]) |
| `PROSPECT_TARGET_COMPRESS` | 0.87 | [C] | 1/1.15, disposition effect conservatism |
| `PROSPECT_STOP_WIDEN` | 1.15 | [D] | Dampened from sqrt(2.25), KRX tick fit |
| `STOP_LOSS_ATR_MULT` | 2 | [B] | Wilder (1978) |

**WARNING:** Non-monotonic target (medium > weak > strong). Theil-Sen artifact: weak patterns cluster in volatile contexts.

**Stop loss method:** `_stopLoss(candles, idx, signal, atr, mult)` at line 594

- Multiplied by `PROSPECT_STOP_WIDEN` (whipsaw reduction)
- GPD VaR99 enhancement when n >= 500 (EVT Doc 12 S4.1)

### Timeframe Pattern Activation Map

**File:** `patterns.js` lines 158-171 (`TF_PATTERN_MAP`)

| TF | Candle | Chart | S/R |
|----|--------|-------|-----|
| 1m | null (disabled) | null | false |
| 5m | Set(8 patterns) | null | false |
| 15m | 'all' | Set(6 triangles/wedges/channel) | true |
| 30m | 'all' | Set(8 + doubles) | true |
| 1h | 'all' | 'all_except_hs' | true |
| 1d | 'all' | 'all' | true |
| 1w | 'limited' (8 patterns) | 'all' | true |
| 1M | null | Set(doubles + channel) | true |

Weekly limited: engulfing, marubozu, piercing, darkCloud, hammer, shootingStar.

---

## Single-Candle Patterns

### Doji (도지)

#### Academic Basis
- **Primary:** Nison (1991) "Japanese Candlestick Charting Techniques" ch.5
- **core_data ref:** Doc 07 S4.1, Doc 16 S1.1

#### Detection Algorithm
- **File:** patterns.js line 1512
- **Method:** `detectDoji(candles, ctx)`
- **Key logic:** body/range <= 0.05 (DOJI_BODY_RATIO), range >= ATR * 0.3 (MIN_RANGE_ATR). Signal direction from trend context (up->sell, down->buy, neutral->neutral).

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `DOJI_BODY_RATIO` | 0.05 | [A] | Nison (1991) standard |
| `MIN_RANGE_ATR` | 0.3 | [D] | Heuristic minimum significance |

#### Quality Score
- body: 0.5 (fixed, doji body is intentionally small)
- shadow: range/ATR (bigger range = more indecision)
- volume: vol/VMA(20)/2
- trend: strength if directional, 0.3 if neutral
- extra: 0.5 (fixed)

#### KRX 5-Year Statistics
- WR: 42.0%, n=42,031, shrunk WR: ~43%
- Signal: weak, both directions

---

### Hammer (해머)

#### Academic Basis
- **Primary:** Nison (1991) ch.4 — "The hammer is a bullish reversal pattern that forms after a decline"
- **Secondary:** Morris (2006) — shadow/body ratio >= 2x, counter shadow <= 15%
- **core_data ref:** Doc 07 S4.2, Doc 16 S1.2

#### Detection Algorithm
- **File:** patterns.js line 1322
- **Method:** `detectHammer(candles, ctx)`
- **Key logic:**
  1. body <= range * 0.40 (MAX_BODY_RANGE_HAMMER)
  2. lowerShadow >= body * 2.0 (SHADOW_BODY_MIN)
  3. upperShadow <= body * 0.15 (COUNTER_SHADOW_MAX_STRICT)
  4. body >= range * 0.1 (MIN_BODY_RANGE)
  5. Preceding downtrend required (Theil-Sen)

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `MAX_BODY_RANGE_HAMMER` | 0.40 | [C] | Nison 0.33 + KRX tick margin (T-8: 0.45->0.40) |
| `SHADOW_BODY_MIN` | 2.0 | [A] | Morris (2006) |
| `COUNTER_SHADOW_MAX_STRICT` | 0.15 | [A] | Morris (2006) |
| `MIN_BODY_RANGE` | 0.1 | [B] | Nison (1991) |

#### Quality Score
- extra: volSurge = vol/VMA/1.5 (Odean 1998 — volume surge at reversal)

#### KRX 5-Year Statistics
- WR: 45.2%, n=4,293, signal: buy/medium

---

### Inverted Hammer (역해머)

#### Academic Basis
- **Primary:** Nison (1991) ch.4 — hammer mirror, bullish reversal candidate
- **core_data ref:** Doc 07 S4.2, Doc 16 S1.3

#### Detection Algorithm
- **File:** patterns.js line 1368
- **Method:** `detectInvertedHammer(candles, ctx)`
- **Key logic:** Same body/range checks as hammer, but upper shadow >= 2x body, lower shadow uses COUNTER_SHADOW_MAX_LOOSE (0.3). Preceding downtrend required.

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `COUNTER_SHADOW_MAX_LOOSE` | 0.3 | [B] | Inverted hammer/hanging man/shooting star |

#### KRX 5-Year Statistics
- WR: 48.9%, n=6,710, signal: buy/weak (Bulkowski: ~50%)

---

### Hanging Man (교수형)

#### Academic Basis
- **Primary:** Nison (1991) ch.4 — "Hanging man is a bearish reversal pattern after an uptrend"
- **core_data ref:** Doc 07 S4.3, Doc 16 S1.4

#### Detection Algorithm
- **File:** patterns.js line 1410
- **Method:** `detectHangingMan(candles, ctx)`
- **Key logic:** Same shape as hammer (long lower shadow, small body at top). Requires preceding uptrend with strength >= 0.3. Minimum 10 bars lookback (S-6 fix). Look-ahead bias removed (no i+1 reference).

#### Threshold Constants
Same as hammer: MAX_BODY_RANGE_HAMMER, SHADOW_BODY_MIN, COUNTER_SHADOW_MAX_LOOSE, MIN_BODY_RANGE.

#### Quality Score
- extra: volSurge (Morris: bearish reversal confirmed by volume increase)
- strength: 'weak' (no confirmation candle — look-ahead bias prevention)

#### KRX 5-Year Statistics
- WR: 59.4%, n=5,554, signal: sell/weak

---

### Shooting Star (유성형)

#### Academic Basis
- **Primary:** Nison (1991) ch.4, Morris (2006) — inverted hammer mirror in uptrend
- **core_data ref:** Doc 07 S4.3, Doc 16 S1.5

#### Detection Algorithm
- **File:** patterns.js line 1461
- **Method:** `detectShootingStar(candles, ctx)`
- **Key logic:** Long upper shadow, small body at bottom. Preceding uptrend required. Volume confirmation boost: volR >= 2.0 -> +3, volR < 0.7 -> -2.

#### Threshold Constants
Same as inverted hammer: SHADOW_BODY_MIN (2.0), COUNTER_SHADOW_MAX_LOOSE (0.3).

Volume boost/penalty thresholds: [D] Heuristic (Morris qualitative "above average volume").

#### KRX 5-Year Statistics
- WR: 59.2%, n=4,472, signal: sell/medium

---

### Dragonfly Doji (잠자리 도지)

#### Academic Basis
- **Primary:** Nison (1991) ch.5 — "More bullish than a regular doji at a market bottom"
- **core_data ref:** Doc 16 S1.7

#### Detection Algorithm
- **File:** patterns.js line 1941
- **Method:** `detectDragonflyDoji(candles, ctx)`
- **Key logic:**
  1. Doji condition: body <= range * 0.05
  2. Lower shadow >= range * 0.70 (SPECIAL_DOJI_SHADOW_MIN)
  3. Upper shadow <= range * 0.15 (SPECIAL_DOJI_COUNTER_MAX)
  4. Range >= ATR * 0.3 (MIN_RANGE_ATR)
  5. Downtrend required

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `SPECIAL_DOJI_SHADOW_MIN` | 0.70 | [B] | Nison (1991) |
| `SPECIAL_DOJI_COUNTER_MAX` | 0.15 | [C] | Phase1-D: 0.10->0.15 for KRX tick tolerance |

#### Quality Score
- body: 0.6 (fixed, doji body meaningless)
- extra: rangeScore = range/ATR

#### KRX 5-Year Statistics
- WR: 45.0%, n=1,180, signal: buy/medium

---

### Gravestone Doji (비석 도지)

#### Academic Basis
- **Primary:** Nison (1991) ch.5 — "Gravestone doji at a top is a bearish signal"
- **core_data ref:** Doc 16 S1.8

#### Detection Algorithm
- **File:** patterns.js line 1996
- **Method:** `detectGravestoneDoji(candles, ctx)`
- **Key logic:** Mirror of dragonfly: upper shadow >= 70%, lower shadow <= 15%. Uptrend required.

#### Threshold Constants
Same as dragonfly: SPECIAL_DOJI_SHADOW_MIN, SPECIAL_DOJI_COUNTER_MAX.

#### KRX 5-Year Statistics
- WR: 62.0%, n=1,107, signal: sell/medium

---

### Long-Legged Doji (긴다리도지)

#### Academic Basis
- **Primary:** Nison (1991) ch.5 — "Reflects great indecision in the market"
- **core_data ref:** Doc 16 S1.9

#### Detection Algorithm
- **File:** patterns.js line 2310
- **Method:** `detectLongLeggedDoji(candles, ctx)`
- **Key logic:**
  1. Doji: body <= range * 0.05
  2. Both shadows >= range * 0.30 (LONG_DOJI_SHADOW_MIN)
  3. Range >= ATR * 0.80 (LONG_DOJI_RANGE_MIN) — stricter than regular doji

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `LONG_DOJI_SHADOW_MIN` | 0.30 | [A] | Nison (1991): both 30%+ |
| `LONG_DOJI_RANGE_MIN` | 0.80 | [B] | Stricter than doji (0.3) |

#### Quality Score
- shadow: balance = 1 - |upper - lower|/range

#### KRX 5-Year Statistics
- WR: 45.0%, n=36,690, signal: context-dependent/weak

---

### Spinning Top (팽이형)

#### Academic Basis
- **Primary:** Nison (1991) ch.5 — "Spinning tops represent indecision"
- **Secondary:** Morris (2006) — shadow > body
- **Bulkowski:** Standalone directional prediction ~51%
- **core_data ref:** Doc 16 S1.10

#### Detection Algorithm
- **File:** patterns.js line 2259
- **Method:** `detectSpinningTop(candles, ctx)`
- **Key logic:**
  1. Body/range between 0.05 and 0.30 (SPINNING_BODY_MIN/MAX)
  2. Both shadows >= body * 0.75 (SPINNING_SHADOW_RATIO)
  3. Range >= ATR * 0.3

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `SPINNING_BODY_MIN` | 0.05 | [A] | Nison (1991) |
| `SPINNING_BODY_MAX` | 0.30 | [A] | Nison (1991) |
| `SPINNING_SHADOW_RATIO` | 0.75 | [B] | Morris (2006), E-2: 0.50->0.75, n=137K overdetection fix |

#### Quality Score
- body: 1 - bodyRatio (smaller = more indecision)
- shadow: balance between upper and lower
- trend/extra: both 0.3 (neutral pattern)

#### KRX 5-Year Statistics
- WR: 43.1%, n=559,149, signal: neutral/weak

---

### Bullish Marubozu (양봉 마루보주) / Bearish Marubozu (음봉 마루보주)

#### Academic Basis
- **Primary:** Nison (1991) ch.3 — "One of the strongest single-candle continuation signals"
- **Secondary:** Morris (2006) — shadows <= 2% of body
- **Bulkowski:** Bullish ~72% continuation, bearish ~71%
- **core_data ref:** Doc 07 S4.5, Doc 16 S1.11

#### Detection Algorithm
- **File:** patterns.js line 2172
- **Method:** `detectMarubozu(candles, ctx)` — detects both bullish and bearish
- **Key logic:**
  1. Body >= range * 0.85 (MARUBOZU_BODY_RATIO)
  2. Both shadows <= body * 0.02 (MARUBOZU_SHADOW_MAX)
  3. Range >= ATR * 0.3 (MIN_RANGE_ATR)
  4. Trend filter (T-1): bullish excluded in strong uptrend (>0.5), bearish in strong downtrend

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `MARUBOZU_BODY_RATIO` | 0.85 | [A] | Nison (1991) |
| `MARUBOZU_SHADOW_MAX` | 0.02 | [A] | Morris (2006) |

#### Quality Score
- extra: purity = (body/range - 0.85) / 0.15 (0 = minimum, 1 = perfect marubozu)
- Volume bonus: +10 if vol > prev.vol * 1.2 (Nison volume principle), cap 90

#### KRX 5-Year Statistics
- Bullish: WR 41.8%, n=30,796
- Bearish: WR 57.7%, n=41,696
- signal: buy/sell, strength: strong

#### Modification History
- [T-1] Added trend filter to prevent detection in continuation context
- [Phase1-FIX] Unified stop loss via `_stopLoss()` (was hardcoded 1.5 ATR)
- [ACC] Volume confirmation bonus

---

### Bullish Belt Hold (강세띠두름) / Bearish Belt Hold (약세띠두름)

#### Academic Basis
- **Primary:** Morris (2006) — "Strong single-candle pattern with large body, opening at extreme"
- **core_data ref:** Doc 16 S1.12

#### Detection Algorithm
- **File:** patterns.js line 2360
- **Method:** `detectBeltHold(candles, ctx)` — detects both directions
- **Key logic:**
  1. Body/range >= 0.60 (BELT_BODY_RATIO_MIN)
  2. Body/range < 0.85 (excludes marubozu)
  3. Body >= ATR * 0.40 (BELT_BODY_ATR_MIN)
  4. Open-side shadow <= body * 0.05 (BELT_OPEN_SHADOW_MAX)
  5. Close-side shadow <= body * 0.30 (BELT_CLOSE_SHADOW_MAX)
  6. Reverse trend context required

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `BELT_BODY_RATIO_MIN` | 0.60 | [B] | Morris (2006) |
| `BELT_OPEN_SHADOW_MAX` | 0.05 | [B] | Morris (2006) |
| `BELT_CLOSE_SHADOW_MAX` | 0.30 | [D] | Heuristic: distinguishes from marubozu |
| `BELT_BODY_ATR_MIN` | 0.40 | [D] | Heuristic: significance threshold |

#### KRX 5-Year Statistics
- Bullish: WR 51.4%, n=3,930
- Bearish: WR 57.4%, n=3,355
- signal: buy/sell, strength: medium

---

## Double-Candle Patterns

### Bullish Engulfing (상승장악형) / Bearish Engulfing (하락장악형)

#### Academic Basis
- **Primary:** Nison (1991) ch.4 — "Clearly engulfs" the prior candle body
- **Secondary:** Bulkowski — body multiplier significance; Wyckoff — volume confirmation
- **core_data ref:** Doc 07 S5.1, Doc 16 S2.1

#### Detection Algorithm
- **File:** patterns.js line 1551
- **Method:** `detectEngulfing(candles, ctx)` — detects both bullish and bearish
- **Key logic:**
  1. prevBody >= ATR * 0.2 (ENGULF_PREV_BODY_MIN)
  2. currBody >= ATR * 0.25 (ENGULF_CURR_BODY_MIN)
  3. currBody >= prevBody * 1.5 (ENGULF_BODY_MULT)
  4. Volume filter: volRatio >= 0.7 (Wyckoff, Audit Fix-4)
  5. Opposite trend required (Fix-MED: no bullish engulfing in uptrend)
  6. Volume bonus: +10 if curr.vol > prev.vol * 1.5, -8 if < prev.vol * 0.8

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `ENGULF_PREV_BODY_MIN` | 0.2 | [B] | Nison "visible real body" (Audit: 0.1->0.2) |
| `ENGULF_CURR_BODY_MIN` | 0.25 | [B] | Nison/Bulkowski |
| `ENGULF_BODY_MULT` | 1.5 | [C] | Nison "clearly engulfs" + KRX limit (T-4: 1.2->1.5) |

#### Quality Score
- shadow (dynamic): bullish = 1 - upperShadow/range; bearish = 1 - lowerShadow/range (Audit Fix-1)
- extra: engulfExtra = (currBody/prevBody - 1.5) / 2, clamped [0,1]
- trend: 0.1 for neutral (Audit Fix-2: was 0.3)

#### KRX 5-Year Statistics
- Bullish: WR 41.3%, n=103,287
- Bearish: WR 57.2%, n=113,066
- signal: buy/sell, strength: strong

---

### Bullish Harami (상승잉태형) / Bearish Harami (하락잉태형)

#### Academic Basis
- **Primary:** Nison (1991) ch.4 — "Harami means pregnant in old Japanese"
- **core_data ref:** Doc 07 S5.2, Doc 16 S2.2

#### Detection Algorithm
- **File:** patterns.js line 1637
- **Method:** `detectHarami(candles, ctx)` — detects both directions
- **Key logic:**
  1. prevBody >= ATR * 0.3 (HARAMI_PREV_BODY_MIN)
  2. currBody <= prevBody * 0.5 (HARAMI_CURR_BODY_MAX)
  3. currBody >= ATR * 0.05 (HARAMI_CURR_BODY_MIN)
  4. Containment: curr open/close within prev body
  5. Look-ahead bias removed: no i+1 reference
  6. Inherently unconfirmed: quality *= 0.8

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `HARAMI_PREV_BODY_MIN` | 0.3 | [B] | Nison (1991) |
| `HARAMI_CURR_BODY_MAX` | 0.5 | [B] | Nison (1991) |
| `HARAMI_CURR_BODY_MIN` | 0.05 | [B] | Prevents doji-level noise |

#### KRX 5-Year Statistics
- Bullish: WR 44.1%, n=52,880
- Bearish: WR 58.7%, n=47,269
- signal: buy/sell, strength: medium

---

### Bullish Harami Cross (강세잉태십자) / Bearish Harami Cross (약세잉태십자)

#### Academic Basis
- **Primary:** Nison (1991) — "More significant reversal signal than a regular harami"
- **Secondary:** Bulkowski (2008): bullish 56%, bearish 58%
- **core_data ref:** Doc 16 S2.3

#### Detection Algorithm
- **File:** patterns.js line 2611
- **Method:** `detectHaramiCross(candles, ctx)`
- **Key logic:**
  1. Prev: large body (>= ATR * 0.3)
  2. Curr: doji (body/range <= 0.08, HARAMI_CROSS_DOJI_MAX)
  3. Containment: curr high/low within prev body range
  4. Trend context required for direction

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `HARAMI_CROSS_DOJI_MAX` | 0.08 | [B] | Nison (1991): near-doji included |

#### Quality Score
- shadow: centrality = distance of doji center from prev body center (closer = higher)
- extra: volume contraction (Nison: volume decline at doji confirms indecision)

#### Dedup Hierarchy
- `bullishHaramiCross` suppresses `bullishHarami` at same endIndex
- `bearishHaramiCross` suppresses `bearishHarami`

#### KRX 5-Year Statistics
- Bullish: WR 46.0%, n=8,500
- Bearish: WR 57.5%, n=7,200
- signal: buy/sell, strength: medium

---

### Piercing Line (관통형)

#### Academic Basis
- **Primary:** Nison (1991) — Bullish reversal after decline, gap-down open then close above 50% of prior body
- **Bulkowski:** WR ~64%
- **core_data ref:** Doc 07 S5.3, Doc 16 S2.4

#### Detection Algorithm
- **File:** patterns.js line 1809
- **Method:** `detectPiercingLine(candles, ctx)`
- **Key logic:**
  1. Prev: bearish candle (close < open)
  2. Curr: bullish candle (close > open)
  3. Both bodies >= ATR * 0.3 (PIERCING_BODY_MIN)
  4. Curr open <= prev close (gap-down or equal)
  5. Curr close >= prev midpoint (50% recovery)
  6. Curr close < prev open (otherwise = engulfing)
  7. Downtrend required

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `PIERCING_BODY_MIN` | 0.3 | [B] | Nison (1991) |

#### Quality Score
- shadow: penetration ratio (0.5 to 1.0)
- extra: volConfirm = curr.vol / prev.vol / 1.5

#### KRX 5-Year Statistics
- WR: 50.2%, n=3,753, signal: buy/medium

---

### Dark Cloud Cover (먹구름형)

#### Academic Basis
- **Primary:** Nison (1991) — Bearish mirror of piercing line
- **Bulkowski:** WR ~60%
- **core_data ref:** Doc 07 S5.3, Doc 16 S2.5

#### Detection Algorithm
- **File:** patterns.js line 1875
- **Method:** `detectDarkCloud(candles, ctx)`
- **Key logic:** Symmetric to piercing line. Prev bullish, curr bearish. Curr open >= prev close (gap-up), curr close <= prev midpoint, curr close > prev open (not engulfing). Uptrend required.

#### Quality Score
- extra: volConfirm (H-2 FIX: symmetric with piercing line)

#### KRX 5-Year Statistics
- WR: 58.5%, n=3,093, signal: sell/medium

---

### Tweezer Bottom (족집게 바닥)

#### Academic Basis
- **Primary:** Nison (1991) — Two-candle bottom reversal with matching lows
- **Bulkowski:** ~57% reversal success
- **core_data ref:** Doc 16 S2.6

#### Detection Algorithm
- **File:** patterns.js line 2051
- **Method:** `detectTweezerBottom(candles, ctx)`
- **Key logic:**
  1. Prev: bearish, curr: bullish
  2. Both bodies >= ATR * 0.25 (TWEEZER_BODY_MIN)
  3. Low difference <= ATR * 0.1 (TWEEZER_TOLERANCE)
  4. Downtrend required
  5. Stop loss: min(prev.low, curr.low) - ATR

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `TWEEZER_BODY_MIN` | 0.25 | [C] | Nison + KRX tick (T-7: 0.15->0.25) |
| `TWEEZER_TOLERANCE` | 0.1 | [C] | ATR*0.1 tolerance |

#### Quality Score
- shadow: matchScore = 1 - lowDiff/(ATR*tolerance)
- extra: reversalDominance = currBody / (prevBody + currBody)

#### KRX 5-Year Statistics
- WR: 46.5%, n=9,024, signal: buy/medium

---

### Tweezer Top (족집게 천장)

#### Academic Basis
- **Primary:** Nison (1991) — Mirror of tweezer bottom
- **core_data ref:** Doc 16 S2.7

#### Detection Algorithm
- **File:** patterns.js line 2109
- **Method:** `detectTweezerTop(candles, ctx)`
- **Key logic:** Symmetric to tweezer bottom. Prev bullish, curr bearish. High difference <= ATR * 0.1. Uptrend required. Stop loss: max(highs) + ATR.

#### Quality Score
- extra: reversalDominance (H-2 FIX: symmetric)

#### KRX 5-Year Statistics
- WR: 56.8%, n=5,994, signal: sell/medium

---

### Stick Sandwich (스틱샌드위치)

#### Academic Basis
- **Primary:** Bulkowski (2008) — 3-candle bullish reversal, low frequency
- **Bulkowski WR:** ~56%
- **core_data ref:** Doc 16 S2.8

#### Detection Algorithm
- **File:** patterns.js line 2695
- **Method:** `detectStickSandwich(candles, ctx)`
- **Key logic:**
  1. c0: bearish, c1: bullish (close > c0.close), c2: bearish
  2. c0 and c2 closing prices nearly identical (<= ATR * 0.05)
  3. c1 body >= ATR * 0.3 (STICK_SANDWICH_MID_BODY_MIN)
  4. c0, c2 body >= ATR * 0.2
  5. Not in uptrend

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `STICK_SANDWICH_CLOSE_TOL` | 0.05 | [C] | KRX tick-size adapted |
| `STICK_SANDWICH_MID_BODY_MIN` | 0.3 | [B] | Bulkowski (2008) |

#### KRX 5-Year Statistics
- WR: 52.0%, n=420, signal: buy/medium

---

## Triple-Candle Patterns

### Three White Soldiers (적삼병)

#### Academic Basis
- **Primary:** Nison (1991) ch.7 — "Three advancing white soldiers" (reversal from downtrend)
- **core_data ref:** Doc 07 S6.1, Doc 16 S3.1

#### Detection Algorithm
- **File:** patterns.js line 1105
- **Method:** `detectThreeWhiteSoldiers(candles, ctx)`
- **Key logic:**
  1. Three consecutive bullish candles with ascending closes
  2. Each opens within previous body range
  3. Each body >= ATR * 0.5 (THREE_SOLDIER_BODY_MIN)
  4. Upper wick <= body * 0.5 (short wicks)
  5. Preceding downtrend required (uptrend = invalid, Nison reversal principle)

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `THREE_SOLDIER_BODY_MIN` | 0.5 | [B] | Nison "long real body" (T-5: 0.3->0.5, n=103K overdetection) |

#### Quality Score
- extra: volIncExtra — consecutive volume increase (3-step: 1.0 / 0.6 / 0.2)

#### KRX 5-Year Statistics
- WR: 47.6%, n=4,811, signal: buy/strong

---

### Three Black Crows (흑삼병)

#### Academic Basis
- **Primary:** Nison (1991) ch.7 — Mirror of three white soldiers
- **core_data ref:** Doc 07 S6.1, Doc 16 S3.2

#### Detection Algorithm
- **File:** patterns.js line 1151
- **Method:** `detectThreeBlackCrows(candles, ctx)`
- **Key logic:** Mirror of three white soldiers. Three bearish candles, descending closes, each opens within prior body, lower wicks <= body * 0.5. Preceding uptrend required (Fix-HIGH: was missing).

#### Quality Score
- extra: volIncExtra (H-2 FIX: symmetric with soldiers)

#### KRX 5-Year Statistics
- WR: 57.5%, n=4,812, signal: sell/strong

---

### Morning Star (샛별형)

#### Academic Basis
- **Primary:** Nison (1991) ch.6 — "Three-candle bullish reversal at bottom"
- **core_data ref:** Doc 07 S6.2, Doc 16 S3.3

#### Detection Algorithm
- **File:** patterns.js line 1700
- **Method:** `detectMorningStar(candles, ctx)`
- **Key logic:**
  1. c0: long bearish (body >= ATR * 0.5, STAR_END_BODY_MIN)
  2. c1: small body (body <= ATR * 0.2, STAR_BODY_MAX)
  3. c2: long bullish (body >= ATR * 0.5)
  4. Gap condition (T-2: OR->AND): c1.close AND c1.open <= c0.close
  5. c2 close >= c0 midpoint (50% recovery, Nison rule)
  6. Preceding downtrend for full score

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `STAR_BODY_MAX` | 0.2 | [A] | Nison (1991) star body ratio |
| `STAR_END_BODY_MIN` | 0.5 | [B] | Nison "long body" (T-6: 0.3->0.5) |

#### Quality Score
- shadow: starScore = 1 - body1/ATR (smaller star = better)
- extra: recoveryDepth = (c2.close - midpoint) / (body0 * 0.5)

#### KRX 5-Year Statistics
- WR: 40.5%, n=29,550, signal: buy/strong

#### Modification History
- [T-2] Gap condition AND (was OR) — Nison original, WR 40.5% -> 46-48% expected
- [T-6] STAR_END_BODY_MIN 0.3->0.5

---

### Evening Star (석별형)

#### Academic Basis
- **Primary:** Nison (1991) ch.6 — Bearish mirror of morning star
- **core_data ref:** Doc 07 S6.2, Doc 16 S3.4

#### Detection Algorithm
- **File:** patterns.js line 1752
- **Method:** `detectEveningStar(candles, ctx)`
- **Key logic:** Mirror of morning star. c0 bullish, c1 small, c2 bearish. Gap-up AND (T-3). c2 close <= c0 midpoint.

#### Quality Score
- extra: penetrationDepth (H-2 FIX: symmetric)

#### KRX 5-Year Statistics
- WR: 56.7%, n=26,229, signal: sell/strong

---

### Three Inside Up (상승삼내형)

#### Academic Basis
- **Primary:** Nison (1991) — "Bullish harami plus confirmation candle closing above first candle's open"
- **core_data ref:** Doc 16 S3.5

#### Detection Algorithm
- **File:** patterns.js line 2429
- **Method:** `detectThreeInsideUp(candles, ctx)`
- **Key logic:**
  1. c0: large bearish (body >= ATR * 0.3)
  2. c1: small bullish contained within c0 body (harami condition)
  3. c2: bullish confirmation, close > c0.open, body >= ATR * 0.2 (THREE_INSIDE_CONFIRM_MIN)
  4. Downtrend required (uptrend excluded)

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `THREE_INSIDE_CONFIRM_MIN` | 0.2 | [B] | Nison (1991) confirmation candle minimum |

#### Dedup Hierarchy
- `threeInsideUp` suppresses `bullishHarami` at same endIndex

#### KRX 5-Year Statistics
- WR: 42.4%, n=14,275, signal: buy/strong

---

### Three Inside Down (하락삼내형)

#### Academic Basis
- **Primary:** Nison (1991) — Bearish mirror of three inside up
- **core_data ref:** Doc 16 S3.6

#### Detection Algorithm
- **File:** patterns.js line 2478
- **Method:** `detectThreeInsideDown(candles, ctx)`
- **Key logic:** Mirror: c0 bullish, c1 small bearish inside c0, c2 bearish confirming below c0.open. Uptrend required.

#### Dedup Hierarchy
- `threeInsideDown` suppresses `bearishHarami`

#### KRX 5-Year Statistics
- WR: 55.1%, n=13,760, signal: sell/strong

---

### Bullish Abandoned Baby (강세버림받은아기)

#### Academic Basis
- **Primary:** Bulkowski (2008) — High reliability, extremely rare
- **core_data ref:** Doc 16 S3.7

#### Detection Algorithm
- **File:** patterns.js line 2531
- **Method:** `detectAbandonedBaby(candles, ctx)` — detects both directions
- **Key logic (bullish):**
  1. c0: bearish, c2: bullish
  2. c1: doji (body/range <= 0.15, ABANDONED_BABY_DOJI_MAX)
  3. c1.high < c0.low - gap (gap-down isolation)
  4. c1.high < c2.low - gap (gap-up isolation)
  5. Gap minimum: ATR * 0.03 (ABANDONED_BABY_GAP_MIN)
  6. Not in uptrend

#### Threshold Constants
| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| `ABANDONED_BABY_DOJI_MAX` | 0.15 | [C] | Bulkowski (2008) near-doji (Phase1-B: 0.10->0.15) |
| `ABANDONED_BABY_GAP_MIN` | 0.03 | [C] | KRX near-gap adapted (Phase1-B: 0.05->0.03) |

#### Quality Score
- shadow: gapScore (wider gaps = higher reliability)
- extra: 0.7 (fixed, high inherent reliability)

#### Dedup Hierarchy
- `abandonedBabyBullish` suppresses `morningStar`
- `abandonedBabyBearish` suppresses `eveningStar`

#### KRX 5-Year Statistics
- Bullish: WR 51.8%, n=137 (very rare)
- Bearish: WR 64.8%, n=71 (extremely rare)
- signal: buy/sell, strength: strong

---

### Bearish Abandoned Baby (약세버림받은아기)

#### Detection Algorithm
- **File:** patterns.js line 2569 (within `detectAbandonedBaby`)
- **Key logic (bearish):** c0 bullish, c1 doji with gap-up isolation from c0 and gap-down from c2. Not in downtrend.

See bullish abandoned baby for thresholds and statistics.

---

## Five-Candle Patterns

### Rising Three Methods (상승삼법)

#### Academic Basis
- **Primary:** Nison (1991) ch.8 — "Five-candle bullish continuation pattern"
- **core_data ref:** Doc 07 S8.1

#### Detection Algorithm
- **File:** patterns.js line 1202
- **Method:** `detectRisingThreeMethods(candles, ctx)`
- **Key logic:**
  1. c0: large bullish (body/ATR > 0.7)
  2. c1-c3: three small bearish candles, all within c0's high-low range
  3. Each inner body < c0 body * 0.5
  4. c4: large bullish confirmation, close > c0.high
  5. Preceding uptrend required (downtrend excluded, continuation pattern)

#### Quality Score
- body: body0/ATR
- shadow: containment (1 - maxPenetration)
- extra: breakoutScore = (c4.close - c0.high) / ATR

#### KRX Statistics
- No dedicated WR entry (grouped under continuation patterns)
- signal: buy/strong

---

### Falling Three Methods (하락삼법)

#### Academic Basis
- **Primary:** Nison (1991) ch.8 — Mirror of rising three methods
- **core_data ref:** Doc 07 S8.1

#### Detection Algorithm
- **File:** patterns.js line 1263
- **Method:** `detectFallingThreeMethods(candles, ctx)`
- **Key logic:** Mirror: c0 large bearish, c1-c3 small bullish within range, c4 bearish close < c0.low. Preceding downtrend required.

#### KRX Statistics
- signal: sell/strong

---

## Cross-Cutting Systems

### Dual Confidence System

Every pattern carries two confidence scores:
1. **`confidence`** (UI display) — quality score based on shape, volume, trend, shadow, extra
2. **`confidencePred`** (model input) — Beta-Binomial posterior win rate, direction-aware

**File:** patterns.js lines 896-928

**Direction correction (CRITICAL FIX):** WR measures P(price UP).
- Buy patterns: confidencePred = WR
- Sell patterns: confidencePred = 100 - WR (inverted)

**Quality scaling:** confidencePred *= clamp(confidence/50, [0.88, 1.12])
- Caginalp (1998): 3-7%p empirical bound
- E-2: tightened from [0.85, 1.15] to [0.88, 1.12]

### Beta-Binomial Shrinkage

**File:** patterns.js lines 296-331 (`PATTERN_WIN_RATES_SHRUNK`)

- **Formula:** theta_post = (n * theta_raw + N0 * mu_grand) / (n + N0)
- **N0 = 35** (Phase2-E-2: Empirical Bayes optimal, was 50, N0_hat=34.5)
- **Separate grand means:** candle ~43%, chart ~45%
- **Purpose:** Prevents small-sample patterns (e.g., abandonedBaby n=71) from extreme WR

### AMH Temporal Decay

**File:** patterns.js lines 362-389

Lo (2004) Adaptive Markets Hypothesis: pattern alpha decays over time.

| Market | Lambda | Half-life | Grade |
|--------|--------|-----------|-------|
| KOSDAQ | 0.00367 | 189 days | [C] |
| KOSPI | 0.00183 | 378 days | [C] |
| DEFAULT | 0.00275 | 252 days | [C] |

Applied to learned weight confidence via `_temporalDecayFactor()`.

### Post-Detection Adjustments

Applied to all patterns after detection (lines 954-967):

1. **CSAD Herding** (`_applyHerdingAdjust`, line 986): CCK (2000) bilateral herding.
   - Extreme herding + bearish market -> buy signal * 0.76
   - Extreme herding + bullish market -> sell signal * 0.76 (excl. bearishMarubozu)
   - High-vol regime (VKOSPI/HMM) -> buy * 0.75 (excl. bullishMarubozu)

2. **CUSUM Breakpoint** (`_applyBreakpointAdjust`, line 1056): Page (1954) structural break.
   - Breakpoint within 20 bars -> discount = 0.70 + 0.30 * min(barsSince/30, 1)

3. **R:R Gate** (`_applyRRGate`, line 3594):
   - rr < 0.5 -> -5 confidence
   - rr < 1.0 -> -3 confidence
   - rr >= 1.0 -> no penalty (monotonic principle)

4. **Bayesian Sigmoid R:R** (lines 937-952):
   - penalty = max_pen / (1 + exp(k * (rr - rr_mid)))
   - Default: max_pen=15, k=8, rr_mid=2.375

### Deduplication Hierarchy

**File:** patterns.js lines 4165-4195

| Specific Pattern | Suppresses |
|-----------------|------------|
| longLeggedDoji | doji |
| gravestoneDoji | doji |
| dragonflyDoji | doji |
| bullishHaramiCross | bullishHarami |
| bearishHaramiCross | bearishHarami |
| threeInsideUp | bullishHarami |
| threeInsideDown | bearishHarami |
| abandonedBabyBullish | morningStar |
| abandonedBabyBearish | eveningStar |

---

## Appendix: Complete Constant Reference Table

| # | Constant | Value | Grade | Line | Source |
|---|----------|-------|-------|------|--------|
| 1 | DOJI_BODY_RATIO | 0.05 | [A] | 23 | Nison (1991) |
| 2 | SHADOW_BODY_MIN | 2.0 | [A] | 26 | Morris (2006) |
| 3 | COUNTER_SHADOW_MAX_STRICT | 0.15 | [A] | 29 | Morris (2006) |
| 4 | COUNTER_SHADOW_MAX_LOOSE | 0.3 | [B] | 30 | Morris (2006) |
| 5 | MIN_BODY_RANGE | 0.1 | [B] | 33 | Nison (1991) |
| 6 | MAX_BODY_RANGE_HAMMER | 0.40 | [C] | 37 | Nison 0.33 + KRX margin |
| 7 | THREE_SOLDIER_BODY_MIN | 0.5 | [B] | 41 | Nison "long real body" |
| 8 | ENGULF_PREV_BODY_MIN | 0.2 | [B] | 46 | Nison "visible real body" |
| 9 | ENGULF_CURR_BODY_MIN | 0.25 | [B] | 47 | Nison/Bulkowski |
| 10 | ENGULF_BODY_MULT | 1.5 | [C] | 51 | Nison + KRX limit |
| 11 | HARAMI_PREV_BODY_MIN | 0.3 | [B] | 54 | Nison (1991) |
| 12 | HARAMI_CURR_BODY_MAX | 0.5 | [B] | 55 | Nison (1991) |
| 13 | HARAMI_CURR_BODY_MIN | 0.05 | [B] | 56 | Nison (1991) |
| 14 | STAR_BODY_MAX | 0.2 | [A] | 60 | Nison (1991) |
| 15 | STAR_END_BODY_MIN | 0.5 | [B] | 61 | Nison "long body" |
| 16 | PIERCING_BODY_MIN | 0.3 | [B] | 64 | Nison (1991) |
| 17 | SPECIAL_DOJI_SHADOW_MIN | 0.70 | [B] | 67 | Nison (1991) |
| 18 | SPECIAL_DOJI_COUNTER_MAX | 0.15 | [C] | 70 | Nison + KRX tick |
| 19 | TWEEZER_BODY_MIN | 0.25 | [C] | 74 | Nison + KRX tick |
| 20 | TWEEZER_TOLERANCE | 0.1 | [C] | 75 | ATR*0.1 tolerance |
| 21 | MARUBOZU_BODY_RATIO | 0.85 | [A] | 78 | Nison (1991) |
| 22 | MARUBOZU_SHADOW_MAX | 0.02 | [A] | 80 | Morris (2006) |
| 23 | SPINNING_BODY_MIN | 0.05 | [A] | 83 | Nison (1991) |
| 24 | SPINNING_BODY_MAX | 0.30 | [A] | 84 | Nison (1991) |
| 25 | SPINNING_SHADOW_RATIO | 0.75 | [B] | 87 | Morris (2006) |
| 26 | THREE_INSIDE_CONFIRM_MIN | 0.2 | [B] | 90 | Nison (1991) |
| 27 | ABANDONED_BABY_DOJI_MAX | 0.15 | [C] | 94 | Bulkowski (2008) |
| 28 | ABANDONED_BABY_GAP_MIN | 0.03 | [C] | 97 | KRX near-gap |
| 29 | LONG_DOJI_SHADOW_MIN | 0.30 | [A] | 100 | Nison (1991) |
| 30 | LONG_DOJI_RANGE_MIN | 0.80 | [B] | 102 | Empirical |
| 31 | BELT_BODY_RATIO_MIN | 0.60 | [B] | 105 | Morris (2006) |
| 32 | BELT_OPEN_SHADOW_MAX | 0.05 | [B] | 107 | Morris (2006) |
| 33 | BELT_CLOSE_SHADOW_MAX | 0.30 | [D] | 109 | Heuristic |
| 34 | BELT_BODY_ATR_MIN | 0.40 | [D] | 111 | Heuristic |
| 35 | HARAMI_CROSS_DOJI_MAX | 0.08 | [B] | 115 | Nison (1991) |
| 36 | STICK_SANDWICH_CLOSE_TOL | 0.05 | [C] | 120 | KRX tick |
| 37 | STICK_SANDWICH_MID_BODY_MIN | 0.3 | [B] | 122 | Bulkowski (2008) |
| 38 | MIN_RANGE_ATR | 0.3 | [D] | 125 | Heuristic |
| 39 | TREND_THRESHOLD | 0.3 | [D] | 130 | core_data/07 SS3.4 |
| 40 | STOP_LOSS_ATR_MULT | 2 | [B] | 138 | Wilder (1978) |
| 41 | PROSPECT_STOP_WIDEN | 1.15 | [D] | 202 | KRX damped from sqrt(2.25) |
| 42 | PROSPECT_TARGET_COMPRESS | 0.87 | [C] | 204 | 1/1.15 disposition effect |
| 43 | CANDLE_TARGET_ATR.strong | 1.88 | [B] | 190 | KRX Theil-Sen calibration |
| 44 | CANDLE_TARGET_ATR.medium | 2.31 | [B] | 190 | KRX Theil-Sen calibration |
| 45 | CANDLE_TARGET_ATR.weak | 2.18 | [B] | 190 | KRX Theil-Sen calibration |
