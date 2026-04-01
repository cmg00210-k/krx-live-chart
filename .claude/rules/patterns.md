# Pattern Rules

## Classification: 30+ Patterns

### Candle Patterns (21)
- **Single (9)**: doji, hammer, invertedHammer, hangingMan, shootingStar, dragonflyDoji, gravestoneDoji, bullishMarubozu, bearishMarubozu, spinningTop
- **Double (6)**: bullish/bearishEngulfing, bullish/bearishHarami, piercingLine, darkCloud, tweezerBottom, tweezerTop
- **Triple (4)**: threeWhiteSoldiers, threeBlackCrows, morningStar, eveningStar

### Chart Patterns (9)
doubleBottom, doubleTop, headAndShoulders, inverseHeadAndShoulders,
ascendingTriangle, descendingTriangle, symmetricTriangle, risingWedge, fallingWedge

### Support/Resistance
Clustering (ATR*0.5 tolerance), min 2 touches, max 10, sorted by touch count.
Confluence: pattern stopLoss/priceTarget within ATR of S/R → confidence +3*strength.

## ATR Normalization
All thresholds use ATR(14). Fallback: `close * 0.02` when ATR unavailable.
This ensures equal sensitivity for high-price (Samsung ~60,000 KRW) and low-price (~1,000 KRW) stocks.

## New Pattern Checklist (7 locations to update)
1. `patterns.js` — analyze() detection call
2. `patternRenderer.js` — ZONE_PATTERNS / SINGLE_PATTERNS / CHART_PATTERNS
3. `patternRenderer.js` — CANDLE_PATTERN_TYPES, BULLISH_TYPES/BEARISH_TYPES
4. `patternRenderer.js` — PATTERN_NAMES_KO
5. `backtester.js` — _META object
6. `patternPanel.js` — PATTERN_ACADEMIC_META
7. `app.js` — _VIZ_CANDLE_TYPES / _VIZ_CHART_TYPES

## Worker Protocol
```
→ { type:'analyze', candles, realtimeMode, version }
← { type:'result', patterns, signals, stats, version }
```
- IndicatorCache contains functions → cannot postMessage (structured clone fails)
- `version` field for stale-result rejection
- Worker cache: `_analyzeCache` by candle fingerprint
- app.js throttle: 3-second intervals (`_lastPatternAnalysis`)
