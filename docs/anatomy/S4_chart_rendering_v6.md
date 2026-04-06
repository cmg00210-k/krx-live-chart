# Stage 4 — Chart Rendering Architecture
## CheeseStock ANATOMY V6

**Last updated:** 2026-04-06
**Scope:** `js/chart.js`, `js/patternRenderer.js`, `js/signalRenderer.js`, `js/drawingTools.js`, `js/colors.js`
**Version:** LWC v5.1.0 (CDN `unpkg.com`)
**Supersedes:** `S4_chart_rendering.md` (V5) + `S4_canvas_layer_spec.md` (V5)

---

## 4.1 ChartManager Architecture

### 4.1.1 Library Loading and Chart Creation

TradingView Lightweight Charts v5.1.0 loads via CDN in `index.html` as a global `LightweightCharts`. The `ChartManager` class in `chart.js` wraps all LWC calls. No LWC API is called outside `ChartManager`.

Series are created with `mainChart.addSeries(SeriesType, options)` — the LWC v5 unified API. The v4 `addCandlestickSeries()` / `addLineSeries()` convenience methods are not used.

### 4.1.2 Base Options (`_baseOptions()`)

Every chart (main + all sub-charts) calls `_baseOptions()` then applies overrides. All color values come from `KRX_COLORS.*`.

| Option | Value | KRX_COLORS constant |
|--------|-------|---------------------|
| Background | `#131722` | `CHART_BG` |
| Text | `#d1d4dc` | `CHART_TEXT` |
| Grid vertical | `rgba(42,46,57,0.12)` | `CHART_GRID_VERT` |
| Grid horizontal | `rgba(42,46,57,0.20)` | `CHART_GRID_HORZ` |
| Crosshair line | `rgba(149,152,161,0.4)` | `CHART_CROSSHAIR` |
| Crosshair label bg | `#363a45` | `CHART_CROSSHAIR_LABEL` |
| Axis border | `#2a2e39` | `CHART_BORDER` |
| Price scale margins | top: 0.15, bottom: 0.20 | hardcoded in `_baseOptions` |
| Font family | `'JetBrains Mono', 'Pretendard', monospace` | layout.fontFamily |
| Font size | 11 | layout.fontSize |

**Price formatter:** `Math.round(price).toLocaleString('ko-KR')` — integers only (KRW has no cents).

**Time formatters (both `timeFormatter` and `tickMarkFormatter`)** handle three input types:
- `"YYYY-MM-DD"` string (daily candles) — returned as-is or reformatted
- `{ year, month, day }` object (LWC internal representation) — formatted `YYYY-MM-DD`
- Unix timestamp (number) — converted to KST via `new Date((time + 9*3600) * 1000)` using `getUTCMonth()`/`getUTCDate()` to handle month-boundary rollover correctly (the "1/32 bug" was fixed by switching from arithmetic to a Date object)

**Time scale options:**
- `fixLeftEdge: true`, `fixRightEdge: true` — last candle anchored to right axis
- `barSpacing`: `Math.max(6, Math.floor(containerWidth / 17))` — computed dynamically on `createMainChart()`
- `minBarSpacing: 3`
- `rightOffset: 0`
- `lockVisibleTimeRangeOnResize: true`

**Input handling (default state):**
```
handleScale:  { mouseWheel:true, pinch:true, axisPressedMouseMove:true }
handleScroll: { mouseWheel:true, pressedMouseMove:true, horzTouchDrag:true, vertTouchDrag:true }
```
Drawing tools override `axisPressedMouseMove:false` and `pressedMouseMove:false` while active, then restore on deactivation.

### 4.1.3 Chart Types

| `chartType` param | Series created | Notes |
|-------------------|---------------|-------|
| `candle` (default) | `CandlestickSeries` | `borderVisible:false`, no wick border |
| `bar` | `BarSeries` via `_swapMainSeries('bar')` | `openVisible:true`, `thinBars:true` |
| `heikin` | `CandlestickSeries` + `_convertToHeikinAshi()` | HA: `haClose=(O+H+L+C)/4`, `haOpen=avg(prevHaO,prevHaC)` |
| `line` | `CandlestickSeries` (empty data) + `LineSeries` as `indicatorSeries._priceLine` | candleSeries holds ISeriesPrimitive anchors; price data in `_priceLine` |

**Series swap via `_swapMainSeries(toType)`:** detaches `_visHighLowPrimitive`, removes price lines (`_currentPriceLine`, `_visHighLine`, `_visLowLine`), removes old `candleSeries`, creates new series, re-attaches `_visHighLowPrimitive`.

### 4.1.4 Main Chart Series Map

| Key | Type | Purpose |
|-----|------|---------|
| `candleSeries` | `CandlestickSeries` or `BarSeries` | Primary OHLC; ISeriesPrimitive anchor |
| `volumeSeries` | `HistogramSeries` | Volume on `priceScaleId:'vol'`, `scaleMargins:{top:0.8,bottom:0}` |
| `indicatorSeries['ma5']`, `['ma20']`, `['ma60']` | `LineSeries` | MA lines; colors `MA_SHORT`, `MA_MID`, `MA_LONG` |
| `indicatorSeries['ema12']`, `['ema26']` | `LineSeries` | EMA lines; colors `EMA_12`, `EMA_26` |
| `indicatorSeries['_priceLine']` | `LineSeries` | Line-chart mode price data; color `LINE_PRICE` (`#2962ff`), lineWidth 2 |
| `indicatorSeries['_ichBullCeil']`, `['_ichBullFloor']` | `AreaSeries` | Ichimoku bullish cloud fill (ceiling/floor pair) |
| `indicatorSeries['_ichBearCeil']`, `['_ichBearFloor']` | `AreaSeries` | Ichimoku bearish cloud fill (ceiling/floor pair) |
| `indicatorSeries['ichTenkan']`, `['ichKijun']`, `['ichSpanA']`, `['ichSpanB']`, `['ichChikou']` | `LineSeries` | Ichimoku lines |
| `indicatorSeries['bbUpper']`, `['bbMid']`, `['bbLower']` | `LineSeries` | Bollinger bands; colors `BB`, `BB_MID` |
| `indicatorSeries['_bbCeil']`, `['_bbFloor']` | `AreaSeries` | BB fill (ceiling/floor pair); fill `BB_FILL` (`rgba(255,140,66,0.06)`) |
| `indicatorSeries['kalman']` | `LineSeries` | Kalman filter; color `KALMAN` |
| `trendlineSeries[]` | `LineSeries[]` | Pattern trendlines; recycled (resize array rather than destroy/recreate) |
| `_volMaSeries` | `LineSeries` | Volume MA20 on `priceScaleId:'vol'`; color `VOL_MA`, `lineStyle:2` (dashed) |

**Ichimoku cloud fill technique:** ceiling `AreaSeries` fills downward in cloud color; floor `AreaSeries` overwrites lower portion with `CHART_BG`. The intersection is the visible cloud. Bull and bear segments use separate series pairs; each pair collapses to zero thickness in non-matching segments.

**Volume dynamic opacity:** ratio = `candle.volume / avg(last-20)`. alpha: `ratio<1→0.15`, `1≤ratio<2→0.25`, `ratio≥2→0.45`. Applied per-candle as `UP_FILL(alpha)` or `DOWN_FILL(alpha)`.

### 4.1.5 Sub-Chart Architecture (8 charts)

| Chart | Series | Reference lines | Colors |
|-------|--------|-----------------|--------|
| `rsiChart` | `rsiSeries` (LineSeries) | 70, 50 (hidden), 30 via `createPriceLine(lineStyle:2)` | `RSI` (`#ff9800`); ref 70=`UP_FILL(0.4)`, 50=`CHART_ZERO_LINE`, 30=`DOWN_FILL(0.4)` |
| `macdChart` | `macdHistSeries` (Histogram) + `macdLineSeries` + `macdSignalSeries` | 0 line via `macdHistSeries.createPriceLine` | `MACD_LINE`/`MACD_SIGNAL`/`UP_FILL(0.5)` or `DOWN_FILL(0.5)` per histogram bar |
| `stochChart` | `stochKSeries` + `stochDSeries` | 80, 20 | `STOCH_K` (`#7CB342`), `STOCH_D` (`#e91e63`) |
| `cciChart` | `cciSeries` | 100, -100 | `CCI` (`#26C6DA`) |
| `adxChart` | `adxSeries` + `adxPlusDISeries` + `adxMinusDISeries` | 25 (`ADX_REF_LINE`) | `ADX` (`#AB47BC`), `UP`, `DOWN` |
| `willrChart` | `willrSeries` | -20, -80 | `WILLR` (`#FF7043`) |
| `atrChart` | `atrSeries` | none | `ATR_LINE` (`#FFA726`) |

**Oscillator mutual exclusion:** `OSCILLATOR_GROUP = ['rsi','stoch','cci','adx','willr','atr']`. Only one slot active simultaneously. MACD uses a separate independent slot. Managed by `_OSC_MAP` in `appState.js`.

**Sub-chart time scale:** `visible: false` (hidden — synced via `_rebuildSync()`). Price scale margins: `{top:0.08, bottom:0.08}` for RSI; `{top:0.1, bottom:0.1}` for MACD.

### 4.1.6 Create/Destroy Pairs

```
createMainChart(container)        destroyAll()
createRSIChart(container)         destroyRSI()
createMACDChart(container)        destroyMACD()
createStochasticChart(container)  destroyStochastic()
createCCIChart(container)         destroyCCI()
createADXChart(container)         destroyADX()
createWilliamsRChart(container)   destroyWilliamsR()
createATRChart(container)         destroyATR()
```

**Destroy pattern (each sub-chart):**
1. Find entry in `_resizeMap` by `entry.chart === targetChart`
2. `observer.disconnect()`; delete from `_resizeMap`
3. `chart.remove()`
4. Null series references
5. Call `_rebuildSync()`

**`destroyAll()`** additionally calls `patternRenderer.cleanup()`, `signalRenderer.cleanup()`, `drawingTools.cleanup()` to safely detach all ISeriesPrimitive instances before chart removal.

### 4.1.7 Time Scale Synchronization

`_rebuildSync()` uses a microtask debounce (`Promise.resolve().then(...)`) via `_syncScheduled` flag. Multiple consecutive sub-chart create/destroy calls collapse into a single `_doRebuildSync()` execution.

`_doRebuildSync()` subscribes all active charts (main + any live sub-charts) bidirectionally via `subscribeVisibleLogicalRangeChange`. A `_syncing` boolean flag prevents infinite loops when one chart's range update triggers another's.

### 4.1.8 Visible Range Change — Drag-Based Pattern UX

`_subscribeVisibleRange()` subscribes `mainChart.timeScale().subscribeVisibleLogicalRangeChange` to fire `_visibleRangeCallback` (registered by `appWorker.js` via `cm.onVisibleRangeChange()`).

Deduplication: if `from === _lastVisibleFrom && to === _lastVisibleTo`, the callback is skipped. A 150ms debounce prevents per-frame calls during continuous dragging. The callback triggers pattern analysis on the new visible candle slice.

### 4.1.9 Resize Handling (`_observeResize`)

`_resizeMap` is a `Map<container, {observer: ResizeObserver, chart}>`. Each chart container gets one ResizeObserver. The observer RAF-batches resize events and calls `chart.applyOptions({width, height})`. For the main chart, `barSpacing` is recalculated only when width changes by more than 10px (prevents false triggers from zoom gestures). Visible logical range is saved before and restored after `barSpacing` changes.

### 4.1.10 Performance Caches

| Cache | Key format | Purpose |
|-------|-----------|---------|
| `_indicatorCache` | `length + '_' + lastTime + '_' + lastOpen + '_' + lastClose` | Skip `calcMA/calcEMA/calcBB/…` when candles unchanged |
| `_subChartCache` | Same key format | Skip sub-chart indicator recalculation |
| `_lastDataKey[key]` | `key + '_' + length + '_' + first + '_' + last` | Skip redundant `series.setData()` per indicator key |

### 4.1.11 Visible High/Low (`_HighLowPrimitive`)

A dedicated `_HighLowPrimitive` (ISeriesPrimitive) tracks the highest and lowest candle in the visible range. It holds a single `_HighLowPaneView` (`zOrder: 'bottom'`).

**Rendering:** `_HighLowRenderer.draw()` uses `target.useMediaCoordinateSpace`. For each tracked point:
1. Dashed horizontal line from candle x to last-candle x (line never extends into right-side whitespace): dash `[2,3]`, `lineWidth 1`
2. Small triangle marker at candle x position: high=upward triangle (`▲`), low=downward triangle (`▼`), 4px size

Colors: `VIS_HIGH_FILL(0.6)` (red-based) for high; `VIS_LOW_FILL(0.6)` (sky-blue) for low.

Axis labels are via `createPriceLine({lineVisible:false, axisLabelVisible:true})` — axis label only, no visible line.

**Off-screen guard:** if `endX == null` (last candle outside visible range), dashed line is omitted. Marker drawn only when `-10 <= x <= w+10`.

### 4.1.12 Watermark

LWC v5 `createTextWatermark` plugin used for the CheeseStock logo watermark. Reference stored in `this._watermark`. Color: `CHART_WATERMARK` (`rgba(255,255,255,0.04)`).

### 4.1.13 Pattern Trendlines (`trendlineSeries[]`)

`_drawPatterns()` manages `LineSeries` for pattern trendlines alongside the Canvas overlay:
- Counts `trendlineData.length` from all active patterns
- Trims excess series from the end of `trendlineSeries[]` via `chart.removeSeries()`
- Reuses existing series via `applyOptions()` + `setData()`
- Creates new series only when `trendlineData.length > existing`
- Color defaults to `KRX_COLORS.PTN_STRUCT`; `tl.style === 'dashed'` → `lineStyle:2`

Note: `setMarkers()` is not used — LWC v5 removed it. All marker rendering is Canvas-based via `patternRenderer`.

---

## 4.2 PatternRenderer — 9-Layer Canvas2D Pipeline

### 4.2.1 Architecture Overview

`patternRenderer` is an IIFE that exposes `{ render, cleanup }`. Internally it maintains:
- `_primitive` — `PatternOverlayPrimitive` instance (ISeriesPrimitive)
- `_attachedSeries` — the series the primitive is currently attached to

**Entry point:** `patternRenderer.render(cm, candles, chartType, patterns)`

**Internal pipeline:**
```
render()
  → reconnection check (_attachedSeries !== targetSeries)
  → _primitive.setPatterns(candles, sortedPatterns, extendedStructLines, visibleBars)
    → _requestUpdate()
      → PatternPaneView.update()  [coordinate conversion]
        → _buildSingleGlow / _buildBracket / _buildDoubleBottom /
          _buildDoubleTop / _buildHeadAndShoulders / _buildTriangle /
          _buildWedge / _buildChannel / _buildCupAndHandle
        → _buildLabel() for all patterns
        → _buildForecastZone() for patterns[0] only
        → _buildStopTarget() for top pattern with stopLoss/priceTarget
        → extended lines pixel conversion
      → PatternRenderer.draw() target ← 9 layers in fixed order
```

### 4.2.2 Pattern Classification Sets

Three mutually exclusive classification sets determine rendering path:

| Set | Contents | Count | Rendering path |
|-----|----------|-------|----------------|
| `SINGLE_PATTERNS` | hammer, invertedHammer, hangingMan, shootingStar, doji, dragonflyDoji, gravestoneDoji, longLeggedDoji, spinningTop, bullishMarubozu, bearishMarubozu, bullishBeltHold, bearishBeltHold | 13 | Layer 1 (glow) |
| `ZONE_PATTERNS` | threeWhiteSoldiers, threeBlackCrows, bullishEngulfing, bearishEngulfing, bullishHarami, bearishHarami, morningStar, eveningStar, piercingLine, darkCloud, tweezerBottom, tweezerTop, threeInsideUp, threeInsideDown, bullishHaramiCross, bearishHaramiCross, stickSandwich, abandonedBabyBullish, abandonedBabyBearish, risingThreeMethods, fallingThreeMethods | 21 | Layer 2 (bracket) |
| `CHART_PATTERNS` | doubleBottom, doubleTop, headAndShoulders, inverseHeadAndShoulders, ascendingTriangle, descendingTriangle, symmetricTriangle, risingWedge, fallingWedge, channel, cupAndHandle | 11 | Layers 3-6 (pattern-specific builders) |

All patterns receive Layer 7 (labels). The top pattern (patterns[0]) receives Layer 8 (forecast zone).

`CANDLE_PATTERN_TYPES` is a superset Set combining all SINGLE_PATTERNS keys plus all ZONE_PATTERNS keys — used by `vizToggles` filtering and label color assignment.

### 4.2.3 Density Control and Filtering

Before reaching the renderer, `_filterPatternsForViz()` in `appUI.js` applies `vizToggles`. Inside `render()`:

**Three-tier visibility filter:**
- **Tier 1 (candle patterns):** visible range check via `ei >= from && si <= to`. If outside visible range: skip entirely.
- **Tier 2 (chart patterns):** if outside visible range, extract structure lines (trendlines or necklines) into `extendedStructLines` (capped at `MAX_EXTENDED_LINES = 5` by confidence).
- **Tier 3 (S/R levels):** hlines already span full width; included via `visiblePatterns`.

**Effective max patterns (zoom-adaptive):**
```javascript
var effectiveMax = visibleBars <= 50 ? 1 : (visibleBars <= 200 ? 2 : MAX_PATTERNS);  // MAX_PATTERNS = 3
```

**Active-pattern priority sort:** patterns with `priceTarget != null || stopLoss != null` ranked first, then by confidence descending.

### 4.2.4 Draw Call Architecture

All 9 layers execute inside a single `target.useMediaCoordinateSpace(scope => { … })` call. Coordinate system is media coordinates (logical pixels, DPR-handled by LWC). The single `ctx.save()` at the top / `ctx.restore()` at the bottom of `PatternRenderer.draw()` is the outer canvas state envelope.

**Early exit:** if all data arrays are empty, returns before `ctx.save()`.

**Data structure passed to `PatternRenderer`:**
```javascript
data = {
  glows:          [],  // Layer 1
  brackets:       [],  // Layer 2
  trendAreas:     [],  // Layer 3
  polylines:      [],  // Layer 4
  hlines:         [],  // Layer 5
  connectors:     [],  // Layer 6
  labels:         [],  // Layer 7
  forecastZones:  [],  // Layer 8
  _extendedLines: [],  // Layer 9
  _visibleBars:   200, // zoom state for adaptive sizing
}
```

### 4.2.5 Layer 1 — Glows

**Purpose:** Single-candle pattern highlight. Vertical stripe spanning the candle's full high-to-low range.

**Builder:** `_buildSingleGlow(candles, p, toXY, data.glows)` — uses `p.endIndex`

**Color logic:**
- Neutral patterns (`doji`, `spinningTop`, `longLeggedDoji`): `PTN_NEUTRAL_FILL(0.06)` fill, `PTN_NEUTRAL` border
- All other single-candle patterns: `PTN_CANDLE_FILL(0.06)` fill (`rgba(179,136,255,0.06)`), `PTN_CANDLE` (`#B388FF`) border

**Canvas operations (per glow):**
```
fillStyle = g.fill
fillRect(rx, ry, glowW, rh)          // rx = x - width/2, ry = min(y1,y2)
strokeStyle = g.border
lineWidth = 1
globalAlpha = 0.25
beginPath() → rect() → stroke()
globalAlpha = 1
```
Width is fixed at `14px`. Off-screen skip: `g.x < -20 || g.x > w + 20`.

### 4.2.6 Layer 2 — Brackets

**Purpose:** Multi-candle pattern group highlight. Rounded rectangle bounding the pattern's candle range.

**Builder:** `_buildBracket(candles, p, toXY, data.brackets)` — uses `startIndex` to `endIndex`

**`useBody` flag (harami variants):** uses first candle's body (`open`/`close`) instead of full `high`/`low` range.

**Color:** Always `PTN_CANDLE_FILL(0.06)` fill, `PTN_CANDLE` border — candle patterns are always purple.

**Canvas operations (per bracket):**
```
fillStyle = br.fill
beginPath() → _roundRect(ctx, rx, ry, rw, rh, 4) → fill()
strokeStyle = br.border
lineWidth = 1
globalAlpha = 0.25
beginPath() → _roundRect(ctx, rx, ry, rw, rh, 4) → stroke()
globalAlpha = 1
```
Padding: 1px on each side. Off-screen skip: `br.x2 < 0 || br.x1 > w`.

### 4.2.7 Layer 3 — Trend Areas

**Purpose:** Filled polygons for multiple uses: (1) triangle/wedge gradient fills, (2) small pivot markers (triangles/diamonds), (3) cup bottom markers.

**Color:** Fill-only. No stroke applied in this layer.

**Canvas operations (per trendArea):**
```
validPts = pts.filter(p => p.x != null && p.y != null)
if validPts.length < 3 → skip
if all pts.x < 0 or all pts.x > w → skip
beginPath() → moveTo → lineTo… → closePath()
fillStyle = ta.fill || PTN_NEUTRAL_FILL(0.04)
fill()
```

**Usage as markers (4-point diamond = breakout):**
```javascript
{ points: [
    {x: brkPt.x, y: brkPt.y - 4},
    {x: brkPt.x + 4, y: brkPt.y},
    {x: brkPt.x, y: brkPt.y + 4},
    {x: brkPt.x - 4, y: brkPt.y},
  ], fill: BUY_COLOR }
```

**Usage as markers (3-point triangle = trough/peak):**
- `doubleBottom` troughs: upward triangle (`▲`), fill `BUY_COLOR`
- `doubleTop` peaks: downward triangle (`▼`), fill `SELL_COLOR`
- `cupAndHandle` bottom: upward triangle, fill `BUY_COLOR`

**Triangle/wedge area fill:**
- All triangle types: 4-point quad `[u1, u2, l2, l1]`, fill `BUY_FILL` (`rgba(150,220,200,0.12)`)
- Wedge types: same structure, same fill (direction conveyed by label, not color)
- Channel: same structure, fill `BUY_FILL`

### 4.2.8 Layer 4 — Polylines

**Purpose:** Connected line segments for pattern structure lines: necklines, boundary lines, convergence lines, W/M shape, cup U-curve.

**Data item:**
```javascript
{
  points: [{x, y}, …],   // minimum 2 valid points
  color: string,
  width: number,          // default 1.5
  dash: number[],         // [] = solid; [5,3] = standard dash; [8,4] = long dash
  smooth: boolean,        // quadratic curve smoothing (cupAndHandle U-curve)
  dots: boolean,          // filled circle (3.5px) at each endpoint
}
```

**Canvas operations (straight):**
```
beginPath() → moveTo → lineTo…
strokeStyle = pl.color
lineWidth = pl.width || 1.5
setLineDash(pl.dash || [])
stroke()
setLineDash([])
```

**Canvas operations (smooth — `pl.smooth === true`):**
Quadratic Bezier midpoint algorithm:
```javascript
ctx.moveTo(pts[0].x, pts[0].y);
for (let i = 1; i < pts.length - 1; i++) {
  const xc = (pts[i].x + pts[i+1].x) / 2;
  const yc = (pts[i].y + pts[i+1].y) / 2;
  ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
}
ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
```
Used by `cupAndHandle` U-curve with ~15 sample points.

**Color conventions:**

| Pattern | Upper line | Lower line |
|---------|-----------|-----------|
| ascendingTriangle | `SELL_COLOR` (mint) | `BUY_COLOR` (mint) |
| descendingTriangle | `SELL_COLOR` | `BUY_COLOR` |
| symmetricTriangle | `SELL_COLOR` | `BUY_COLOR` |
| risingWedge | `SELL_COLOR` | `GOLD_COLOR` |
| fallingWedge | `GOLD_COLOR` | `BUY_COLOR` |
| doubleBottom boundaries | `BUY_COLOR` | `BUY_COLOR` |
| doubleTop boundaries | `BUY_COLOR` | `BUY_COLOR` |
| H&S neckline (confirmed) | `BUY_COLOR`, solid | — |
| H&S neckline (unconfirmed) | `GOLD_COLOR`, solid | — |
| H&S extensions (confirmed) | `BUY_COLOR`, solid, 1.5px | — |
| H&S extensions (unconfirmed) | `GOLD_COLOR`, dashed `[5,3]`, 1px | — |
| cupAndHandle U-curve | `BUY_COLOR`, 2px, smooth | — |
| channel | `GOLD_COLOR`, dashed `[5,3]` | `GOLD_COLOR` |

Note: `BUY_COLOR` and `SELL_COLOR` are both `rgba(150,220,200,0.65)` (mint). Direction is conveyed by label text and position, not line color.

Off-screen skip: all points left of 0 or all points right of `w`.

### 4.2.9 Layer 5 — Horizontal Lines (hlines)

**Purpose:** Horizontal reference lines for necklines, stop-loss, price targets, and pattern invalidation levels.

**Data item:**
```javascript
{
  y: number,              // pixel y from series.priceToCoordinate()
  x1: number,             // left x (defaults to 0)
  x2: number,             // right x (defaults to canvas width)
  color: string,
  width: number,          // default 1
  dash: number[],         // default [5,3]
  priceLabel: string,     // optional: HTS-style tag at right side
  marker: string,         // optional: 'stop' | 'target' | 'invalid'
}
```

**Canvas operations:**
```
beginPath() → moveTo(x1, y) → lineTo(x2, y)
strokeStyle = hl.color
lineWidth = hl.width || 1
setLineDash(hl.dash || [5,3])
stroke()
setLineDash([])
```

**Price label (HTS-style tag):**
- Font: `700 12px 'JetBrains Mono', monospace`
- Tag background: `TAG_BG(0.92)`, via `_roundRect(ctx, …, 3)` before `fill()`
- Tag border: `hl.color`, `lineWidth 0.8`
- Text: `hl.color`, `textAlign:'left'`, `textBaseline:'middle'`
- Position: right-aligned, clamped minimum 60px from right canvas edge

**End-point markers:**
- `'stop'`: downward triangle at `w-50` (손절 ▼, 5px base, 4px height below y)
- `'target'`: upward triangle at `w-50` (목표 ▲, 5px base, 4px height above y)
- `'invalid'`: diamond at `w-50` (패턴이탈 ◆, 5px diagonal)

**Color/dash mapping:**

| Line type | Color | Dash |
|-----------|-------|------|
| Stop-loss | `PTN_STOP` (`rgba(255,107,53,0.55)`) | `[8,4]` |
| Price target | `PTN_TARGET` (`rgba(150,220,200,0.55)`) | `[8,4]` |
| Pattern invalidation | `PTN_INVALID` (`#FF6B35`) | `[5,3]` |
| Neckline (unconfirmed) | `GOLD_COLOR` = `PTN_STRUCT` (`rgba(200,200,200,0.45)`) | `[5,3]` |
| Neckline (confirmed) | `BUY_COLOR` = `PTN_BUY` (`rgba(150,220,200,0.65)`) | `[]` solid |

**`_buildStopTarget()` behavior:**
- Finds top pattern with `stopLoss != null || priceTarget != null`
- Stop and target lines start at `candles[endIndex].x` (not at chart left edge)
- Invalidation line spans `[startIndex.x, endIndex.x]` only (within-pattern range)
- Invalidation shows only when its price differs from `stopLoss` by >0.5%

Null check: `hl.y == null` → skip.

### 4.2.10 Layer 6 — Connectors

**Purpose:** H&S shoulder/head hollow circle markers; cup-and-handle rim circles; optional dashed connection lines between pattern points.

**Data item (hollow circle mode — `hollowCircle: true`):**
```javascript
{
  hollowCircle: true,
  circleX: number,       // center x
  circleY: number,       // center y
  circleR: 4,            // radius px (default 4)
  circleWidth: 1.5,      // stroke width
  color: string,
}
```

**Data item (line mode):**
```javascript
{
  points: [{x,y}, …],
  color: string,
  width: number,
  dash: number[],        // default [2,3]
  alpha: number,         // default 0.5
  showDots: boolean,     // 3px filled circles at endpoints
}
```

**Canvas operations (hollow circle — early return after drawing):**
```
beginPath() → arc(cx, cy, r, 0, 2π)
strokeStyle = cn.color
lineWidth = cn.circleWidth || 1.5
stroke()
return  // skip line drawing below
```

**Canvas operations (line):**
```
beginPath() → moveTo → lineTo…
strokeStyle = cn.color
lineWidth = cn.width || 1
setLineDash(cn.dash || [2,3])
globalAlpha = cn.alpha || 0.5
stroke()
globalAlpha = 1
setLineDash([])
```

Off-screen skip: `cn.circleX < -20 || cn.circleX > w + 20` (hollow circle); all-left or all-right (line).

**H&S extreme finding:** `_findExtreme(slice, priceKey, 'min'|'max')` — linear scan of candle slice returning the candle with the most extreme `high` or `low`.

**H&S marker color:** `BUY_COLOR` for inverse H&S; `SELL_COLOR` for standard H&S (both are mint — direction conveyed by position).

### 4.2.11 Layer 7 — Labels

**Purpose:** HTS-style pill badge labels identifying each pattern with name, confidence percentage, Wc factor, and outcome indicator.

**Zoom suppression:** `if (d._visibleBars > 800) return` — labels hidden at extreme zoom-out.

**Zoom-adaptive font sizing:**

| Visible bars | Font size | Padding | Border radius |
|-------------|-----------|---------|---------------|
| ≤ 30 | 11px | 7 | 2 |
| ≤ 150 | 12px | 10 | 3 |
| ≤ 400 | 11px | 7 | 2 |
| > 400 | 10px | 7 | 2 |

**Label text format:** `{nameKo} {quality|confidence}%` + ` W{wc.toFixed(2)}` (if wc ≠ 1.0 by >0.01) + ` (확인)` (if `necklineBreakConfirmed`)

**Y positioning:**
- Bullish: `patternLow → priceToCoordinate → y + 24px` (below low)
- Bearish/neutral: `patternHigh → priceToCoordinate → y - 24px` (above high)
- OHLC safe zone: `labelY = max(OHLC_SAFE_Y=40, labelY)`

**Collision avoidance:** up to 6 shift attempts. Shift direction: top-placement moves up (negative Y), bottom-placement moves down (positive Y). Each shift: `boxH + 2` pixels. After shifts, clamp to `[OHLC_SAFE_Y, h - boxH/2 - 2]`.

**Pill rendering sequence:**
1. `font = '700 {fontSize}px Pretendard, sans-serif'`
2. `measureText(lb.text)` → compute `boxW`, `boxH`
3. Collision avoidance loop
4. Pill background: `globalAlpha = agingAlpha`. Active pattern: `BUY_FILL` (bullish) or `CANDLE_FILL(0.12)` (candle); inactive: `TAG_BG(0.88)`
5. Left color bar: 3px wide, left-rounded `[radius,0,0,radius]`, in `lb.color`
6. Border: active=`lineWidth 1.8` (or 1.2 if `confidence<50`); inactive=`wc`-scaled lineWidth; dashed `[2,3]` if `confidence<50`
7. Text: `globalAlpha = textAlpha` (0.55 if `confidence<35`, else agingAlpha)
8. Outcome dot: `arc(boxX + boxW + 5, labelY, r)` — active: `ACCENT` stroke 2px hollow; hit: `UP` fill; failed: `DOWN` fill
9. State reset: `globalAlpha=1`, `lineWidth=1`, `setLineDash([])`

**Label color assignment:**
- Candle patterns: `PTN_CANDLE` (`#B388FF`) except `doji` → `PTN_NEUTRAL` (`rgba(200,200,200,0.55)`)
- Bullish chart patterns: `BUY_COLOR` (`rgba(150,220,200,0.65)`)
- Bearish chart patterns: `SELL_COLOR` (same mint)
- Neutral chart patterns: `NEUTRAL_COLOR` (`rgba(200,200,200,0.55)`)

**Outcome tracking + caching (`_outcomeCache`):**
- Map keyed by `type + '_' + endIndex`, value `{outcome, checkedLength}`
- Invalidated when `candles.length` changes
- Forward scan from `endIndex+1`: hit target → `'hit'`; breach stop → `'failed'`; neither → `'active'`

**Pattern aging decay:**
- Active: `decayAlpha = 1.0`
- Hit/failed with `age <= 10` bars post-completion: `decayAlpha = 1.0`
- Age > 10: `decayAlpha = max(0.25, 1.0 - (age-10) * 0.05)`

### 4.2.12 Layer 8 — Forecast Zones

**Purpose:** Autochartist-style predicted move visualization. Rendered only for `patterns[0]` (highest confidence after sorting).

**Zone geometry:** `fzStart = p.endIndex`, `fzEnd = min(endIndex+8, candles.length-1)`. If `fzEnd <= fzStart` (last-bar pattern), extends 8 bar-widths to the right using estimated bar spacing.

**Alpha computation (combined Wc × CI95):**
```javascript
var wcAlpha = fz.wc != null ? Math.min(0.4 + 0.5 * fz.wc, 1.0) : 1.0;
// wc=0→0.40, wc=1→0.90, wc≥1.2→1.0
var ciAlpha = fz.ciAlpha != null ? fz.ciAlpha : 1.0;
var fzAlpha = Math.max(0.18, wcAlpha * ciAlpha);
ctx.globalAlpha = fzAlpha;
```

**CI95 alpha formula:**
```javascript
var CI_REF = 5.5;          // [D-tier constant — not yet promoted]
var CI_ALPHA_MIN = 0.15;
var CI_ALPHA_MAX = 1.0;
ciAlpha = max(0.15, min(1.0, 1 - ci95Width / (2 * CI_REF)));
// ci95Width=0 → ciAlpha=1.0; ci95Width=11% → ciAlpha=0.0 (clamped to 0.15)
```
`ciAlpha` defaults to `1.0` when `backtestCi95Lower`/`backtestCi95Upper` are absent.

**Target zone canvas operations:**
```javascript
const tGrad = ctx.createLinearGradient(0, fz.yEntry, 0, fz.yTarget);
tGrad.addColorStop(0, KRX_COLORS.FZ_TARGET_NEAR);  // rgba(150,220,200,0.22)
tGrad.addColorStop(1, KRX_COLORS.FZ_TARGET_FAR);   // rgba(150,220,200,0.05)
ctx.fillStyle = tGrad;
ctx.fillRect(zoneX, tY, zoneW, tH);
```

**Return % text:** `700 11px Pretendard`, centered in target zone, `TAG_BG(0.75)` background pill.

**Win rate text:** `700 10px Pretendard`, 14px below return %, shown only when `sampleSize >= 10` and within zone bounds. Colors: `>60%→PTN_BUY`, `40-60%→NEUTRAL`, `<40%→DOWN`.

**Stop zone canvas operations:**
```javascript
const stopGrad = ctx.createLinearGradient(zoneX, fz.yEntry, zoneX, fz.yStop);
stopGrad.addColorStop(0, KRX_COLORS.FZ_STOP_NEAR);  // rgba(255,107,53,0.15)
stopGrad.addColorStop(1, KRX_COLORS.FZ_STOP_FAR);   // rgba(255,107,53,0.03)
```

**R:R vertical bar (when both target and stop present):**
- Bar position: `fz.x2 + 6` (right of zone)
- Target segment: `FZ_TARGET_BORDER` color, `lineWidth 2.5`
- Stop segment: `PTN_STOP` color, `lineWidth 2.5`
- Entry dot: **`'#fff'` hardcoded** — the only hardcoded hex in the entire rendering pipeline (bug F2, unfixed)
- R:R label: `700 10px Pretendard`; color `PTN_BUY` if ratio ≥ 1.5, else `PTN_TARGET`

**Off-screen target fallback:** when `yTarget == null` (outside visible range), draws a directional arrow at chart edge:
- Buy: `edgeY = 6`, `arrowDir = -1` (upward triangle)
- Sell: `edgeY = h-6`, `arrowDir = +1` (downward triangle)
- Arrow: 7px half-width, 6px height; `globalAlpha = 0.85`
- Return % pill label below/above arrow
- Uses `ctx.save()/ctx.restore()` for this sub-block specifically

**Zone clipping:** `zoneX` clamped to `[0, w]`; `zoneW` adjusted accordingly.

### 4.2.13 Layer 9 — Extended Lines

**Purpose:** Chart patterns outside the visible range contribute their necklines and trendlines to the current view as gold accent dashed lines.

**Color:** Always `KRX_COLORS.ACCENT` (`#A08830`) gold.
**Style:** `globalAlpha = 0.35`, `lineWidth = 1.5`, `setLineDash([8,4])` (LONG dash pattern).

**Rendering (per extended line — uses its own `ctx.save()/ctx.restore()`):**
```javascript
ctx.save();
ctx.globalAlpha = 0.35;
ctx.strokeStyle = KRX_COLORS.ACCENT;
ctx.lineWidth = 1.5;
ctx.setLineDash([8, 4]);

if (line.isNeckline) {
  const avgY = (p1.y + p2.y) / 2;
  ctx.beginPath();
  ctx.moveTo(0, avgY);
  ctx.lineTo(w, avgY);
  ctx.stroke();
} else {
  // slope-extrapolate to screen edges
  const slope = dx !== 0 ? (p2.y - p1.y) / dx : 0;
  // extStartY = p1.y + slope * (0 - p1.x), clamped to [-h, 2h]
  // extEndY = p1.y + slope * (w - p1.x), clamped to [-h, 2h]
  ctx.beginPath();
  ctx.moveTo(extStartX, extStartY);
  ctx.lineTo(extEndX, extEndY);
  ctx.stroke();
}
ctx.setLineDash([]);
ctx.restore();
```

Density limit: `MAX_EXTENDED_LINES = 5`, sorted by confidence descending before slicing.

---

## 4.3 SignalRenderer — 4-Layer Dual PaneView

### 4.3.1 Architecture

`signalRenderer` is an IIFE exposing `{ render, cleanup }`. Internally maintains `_primitive` (`SignalOverlayPrimitive`) and `_attachedSeries`.

**ISeriesPrimitive reconnection:** same pattern as `patternRenderer` — `_attachedSeries !== targetSeries` check on `render()` entry. Line-mode guard: uses `indicatorSeries._priceLine` as target when `chartType === 'line'`.

**SignalOverlayPrimitive** holds two pane views:
- `_bgView: SignalBgPaneView` — `zOrder:'bottom'`
- `_fgView: SignalFgPaneView` — `zOrder:'top'`

Both views use the same `SignalCanvasRenderer` class for drawing but receive different data objects (bgView gets only `vbands`; fgView gets `diamonds`, `stars`, `divLines`, `volLabels`).

### 4.3.2 Layer 1 — Vertical Bands (Background, `zOrder:'bottom'`)

**Source:** `goldenCross` and `deadCross` signal types.

**Span:** `[index-2, index+2]` bars (5-bar window).

**Canvas operations:**
```
fillStyle = b.fill   // UP_FILL(0.07) or DOWN_FILL(0.07)
fillRect(bx, h*0.15, max(bw,2), h*0.65)
```
Height: `h*0.15` to `h*0.65` — avoids OHLC display area (top 15%) and volume histogram (bottom 35%).

**Zoom-aware cutoff:**
```javascript
const effectiveLimit = Math.max(RECENT_BAR_LIMIT, src._visibleBars || 0);
const cutoff = lastIdx - effectiveLimit;
```

### 4.3.3 Layer 2 — Divergence Lines (Foreground)

**Signal types:** `macdBullishDivergence`, `rsiBullishDivergence`, `macdBearishDivergence`, `rsiBearishDivergence`, `macdHiddenBullishDivergence`, `rsiHiddenBullishDivergence`, `macdHiddenBearishDivergence`, `rsiHiddenBearishDivergence`.

**Line construction (`_buildDivergenceLine`):** reverse-scans up to 20 bars back from `signal.index` to find the previous order-3 local extremum (swing point where `priceKey` is more extreme than all neighbors within ±3 bars).

**Canvas operations:**
```
globalAlpha = 0.7
beginPath() → moveTo(x1,y1) → lineTo(x2,y2)
strokeStyle = dl.color   // BUY_COLOR or SELL_COLOR
lineWidth = 1.5
setLineDash([5,3])
stroke()
globalAlpha = 1
setLineDash([])
```

Density limit: `MAX_DIV_LINES = 4` (not sorted — first 4 collected).

### 4.3.4 Layer 3 — Diamond Markers (Foreground)

**Source:** `goldenCross` and `deadCross` signal types.

**Position:**
- Golden cross: at `c.low - (c.high - c.low) * 0.3` (below candle low)
- Dead cross: at `c.high + (c.high - c.low) * 0.3` (above candle high)

**Size:** `(s.strength === 'strong' ? 10 : 8) * Math.max(0.7, Math.min(s.wc, 1.5))`

**Canvas operations (45° rotated square, no `ctx.rotate()`):**
```
beginPath()
moveTo(x, y-half)     // top
lineTo(x+half, y)     // right
lineTo(x, y+half)     // bottom
lineTo(x-half, y)     // left
closePath()
fillStyle = d.color   // BUY_COLOR (UP) or SELL_COLOR (DOWN)
globalAlpha = 0.85
fill()
strokeStyle = d.color
globalAlpha = 1
stroke()
```

Note: `signalRenderer` uses `KRX_COLORS.UP` / `KRX_COLORS.DOWN` (Korean convention red/blue) for diamond colors — distinct from `patternRenderer` which uses mint for all patterns.

Density limit: `MAX_DIAMONDS = 6`, sorted by `confidence` descending.

### 4.3.5 Layer 4 — Star Markers (Foreground)

**Source:** `composite` signals with `s.tier === 1`.

**Position:** `0.5 × (c.high - c.low)` outside candle extreme.

**Size:** `12 * Math.max(0.7, Math.min(s.wc, 1.5))`

**`_drawStar(ctx, x, y, r, color)` implementation:**
- 5-point star: outer radius `r`, inner radius `r * 0.4`
- `(spikes * 2) = 10` vertices, alternating outer/inner
- Angle offset: `-Math.PI/2` (point at top)
- Fill: `color`, `globalAlpha=0.9`
- Stroke: `CHART_TEXT`, `lineWidth=1.0`, `globalAlpha=0.7`
- Reset: `globalAlpha=1`

Density limit: `MAX_STARS = 2`, sorted by `confidence` descending.

### 4.3.6 Volume Breakout Labels ("거래↑")

**Source:** `volumeBreakout` and `volumeSelloff` signal types, collected into `_volBreakoutLabels` on the primitive.

**Position:** `h * 0.73` (above volume histogram, below price area).

**Font:** `'600 10px JetBrains Mono, monospace'`

**Spacing:** `MIN_LABEL_GAP = 30px` — sorted by x ascending; previous x tracked; skip if gap < 30px.

**Volume series color override:** breakout candles are individually updated via `cm.volumeSeries.update({time, value, color: ACCENT_FILL(0.7)})` — overrides the base dynamic-opacity color without `setData()`. Applied only when `opts.volumeActive === true`.

---

## 4.4 Drawing Tools

### 4.4.1 Tool Set

| Tool | Key | Points | Rendering |
|------|-----|--------|-----------|
| Select/Move | `S` | 0 (click to select) | Highlight + 5px square anchor handles (cyan) |
| Trendline | `T` | 2 | Bidirectional infinite extension + 3px anchor dots |
| Horizontal | `H` | 1 | Full-width dashed line + price label (top-left, font 11px JetBrains Mono) |
| Vertical | `V` | 1 | Full-height dashed line |
| Rectangle | `R` | 2 (diagonal corners) | `fillRect` (12% alpha fill) + `strokeRect` |
| Fibonacci | `G` | 2 (high/low) | 7 levels: see 4.4.2 |
| Eraser | — | 0 (click hit) | Removes nearest drawing within 20px threshold |

### 4.4.2 Fibonacci Levels

`FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]`
`FIB_LABELS = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%']`

Per-level rendering:
- Alternating band fill (even indices): `_colorToFill(color, 0.06)` — `fillRect` from level to next
- Horizontal line: `0%` and `100%` → solid; others → `setLineDash([5,3])`
- Line opacity: `0%`, `50%`, `100%` → 0.8 alpha; others → 0.4 alpha
- Line width: `50%` level → 1.2px (or 2px selected); others → 0.8px (1.2px selected)
- Label: `'38.2%  52,300'` format (level% + price), `textAlign:'left'`, 4px from left edge
- `_colorToFill(hexColor, alpha)` converts 6-digit hex to `rgba()` — fragile if input is not 6-digit hex

### 4.4.3 State Variables

```javascript
let _activeTool = null;       // current tool string or null
let _drawings = [];           // all drawings, all stocks
let _clickPoints = [];        // points collected for in-progress drawing
let _primitive = null;        // DrawingOverlayPrimitive
let _attachedSeries = null;
let _currentStockCode = null; // stockCode filter for _getVisibleDrawings()
let _selectedDrawing = null;  // selected drawing for select/move
let _dragState = null;        // { drawing, startPrice, startTime, origPoints }
let _previewPoint = null;     // { price, time } — live mouse position for preview
let _currentColor = null;     // user-selected color override (null = tool default)
```

### 4.4.4 Color System (Drawing Tools)

**Palette (6 swatches):**
| Swatch | KRX_COLORS constant | Value |
|--------|---------------------|-------|
| Gold | `DRAW_GOLD` | `#C9A84C` |
| Gray | `DRAW_GRAY` | `#787B86` |
| Blue | `DRAW_BLUE` | `#2962FF` |
| Red (KRX up) | `UP` | `#E05050` |
| Blue (KRX down) | `DOWN` | `#5086DC` |
| Cyan | `DRAW_CYAN` | `#26C6DA` |

**Default colors by tool type:**
- `trendline`: `DRAW_GOLD`
- `hline`, `vline`, `fib`: `DRAW_GRAY`
- `rect`: `DRAW_BLUE`

Color priority: `d.color` (user-set) overrides `DEFAULT_COLORS[d.type]`.

**Internal COLORS object** (render constants, not user-visible):
- `COLORS.trendline = ACCENT` (render fallback, differs from DEFAULT_COLORS)
- `COLORS.rect = 'rgba(41,98,255,0.25)'`
- `COLORS.fibFill = 'rgba(41,98,255,0.06)'`
- `COLORS.select = DRAW_CYAN` (selection handles)

### 4.4.5 localStorage Persistence

Key: `'krx_drawings_v1'`

Serialized fields per drawing: `{id, type, points, stockCode, color}`.

`_getVisibleDrawings()`: filters `_drawings` by `stockCode === _currentStockCode`. If `_currentStockCode` is null, returns all drawings.

### 4.4.6 Undo/Redo

`MAX_UNDO = 50`. Stacks hold objects: `{type: 'add'|'remove'|'move', drawing: deepCopy, prevState?: {points: deepCopy}}`.

### 4.4.7 Hit Testing

`_findNearestDrawing(price, time, threshold=20)`: iterates visible drawings, computes pixel distance for each type:
- `hline`: `|clickY - priceToCoordinate(points[0].price)|`
- `vline`: `|clickX - timeToCoordinate(points[0].time)|`
- `trendline`: perpendicular distance to infinite line (`_distPointToLine`)
- `rect`: 0 if inside, minimum edge distance otherwise
- `fib`: minimum distance to any of the 7 level lines

Returns the drawing with `dist < threshold`, or null.

### 4.4.8 ISeriesPrimitive Implementation

`DrawingOverlayPrimitive` holds one `DrawingPaneView` (`zOrder:'top'`). The `renderer()` method returns an inline object with `draw(target)`. Unlike patternRenderer and signalRenderer which pre-compute data in `update()`, drawingTools computes all coordinates inside `draw()` directly from the live `_drawings` array and current chart state.

**Chart interaction disable (while non-select tool active):**
```javascript
cm.mainChart.applyOptions({
  handleScale: { axisPressedMouseMove: false },
  handleScroll: { pressedMouseMove: false },
});
```
Restored to `true` on tool deactivation.

### 4.4.9 Selection Handles

`_renderSelectionHandles(ctx, d, toX, toY)` renders 5px square handles at each anchor point:
- `fillStyle = DRAW_CYAN`; `fillRect(a.x-5, a.y-5, 10, 10)`
- `strokeStyle = '#ffffff'` (hardcoded); `lineWidth=1`; `strokeRect`

Uses `ctx.save()/ctx.restore()`.

---

## 4.5 ISeriesPrimitive Lifecycle Protocol

All three overlay renderers (patternRenderer, signalRenderer, drawingTools) follow the same reconnection pattern:

```javascript
// At render() entry:
const targetSeries = (chartType === 'line' && cm.indicatorSeries._priceLine)
  ? cm.indicatorSeries._priceLine : cm.candleSeries;
if (!targetSeries) return;

if (_attachedSeries !== targetSeries) {
  if (_primitive && _attachedSeries) {
    try { _attachedSeries.detachPrimitive(_primitive); } catch (e) {}
  }
  _primitive = new XxxPrimitive();
  targetSeries.attachPrimitive(_primitive);
  _attachedSeries = targetSeries;
}
```

**Reconnection triggers:** (1) stock change — `destroyAll()` creates new `candleSeries`; (2) chart type switch via `_swapMainSeries()`; (3) line mode activate/deactivate — switches between `candleSeries` and `_priceLine`.

**Primitive lifecycle methods:**
```javascript
class XxxPrimitive {
  attached(param) {          // called by LWC after attachPrimitive()
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }
  detached() {               // called by LWC before removal
    this._chart = null; this._series = null; this._requestUpdate = null;
  }
  updateAllViews() { … }     // coordinate recalculation (before render)
  paneViews() { return […]; } // list of PaneViews
}
```

**PaneView zOrder table:**

| Primitive | PaneView | zOrder |
|-----------|----------|--------|
| `_HighLowPrimitive` | `_HighLowPaneView` | `'bottom'` |
| `PatternOverlayPrimitive` | `PatternPaneView` | `'normal'` |
| `SignalOverlayPrimitive` | `SignalBgPaneView` | `'bottom'` |
| `SignalOverlayPrimitive` | `SignalFgPaneView` | `'top'` |
| `DrawingOverlayPrimitive` | `DrawingPaneView` | `'top'` |

**DPR handling:** `target.useMediaCoordinateSpace(scope => {...})` handles DPR scaling internally. Code does NOT call `ctx.scale(dpr, dpr)` manually inside `useMediaCoordinateSpace`. Manual DPR handling (`ctx.setTransform(1,0,0,1,0,0)` before `ctx.scale(dpr,dpr)`) applies only to canvas operations that bypass `useMediaCoordinateSpace`.

---

## 4.6 Canvas2D Safety Invariants

### Null Coordinate Guards

Every coordinate usage guards against null returns from `timeToCoordinate()` and `priceToCoordinate()`:
```javascript
const xy = toXY(time, price);
if (xy.x == null || xy.y == null) return;

const x = ts.timeToCoordinate(time);
if (x == null) return;
```

### Off-Screen Skip Thresholds

| Element | Skip condition |
|---------|---------------|
| Glow | `g.x < -20 || g.x > w + 20` |
| Bracket | `br.x2 < 0 || br.x1 > w` |
| Connector (hollow circle) | `cn.circleX < -20 || cn.circleX > w + 20` |
| TrendArea / Polyline | all points left of 0 OR all points right of w |
| Label | `lb.x < -50 || lb.x > w + 50` (x); `labelY < -20 || labelY > h + 20` (y) |
| Forecast zone | `zoneX + zoneW < 0 || zoneX > w` |

### Canvas State Invariants (End of `PatternRenderer.draw()`)

| Property | Required end state | Mechanism |
|----------|-------------------|-----------|
| `globalAlpha` | 1.0 | Explicit reset at end of each label iteration; reset at end of forecast zone |
| `lineWidth` | 1 | Explicit reset at end of each label iteration |
| `setLineDash` | `[]` | Reset after every stroked path |
| `ctx.save/restore` | balanced | Outer save/restore pair + individual saves per extended line + winRate sub-block + offscreen-target sub-block |

### `_roundRect` Contract

Both `patternRenderer.js` and `signalRenderer.js` define their own private `_roundRect(ctx, x, y, w, h, r)`. The function does NOT call `ctx.beginPath()` internally. Every caller must open a path with `ctx.beginPath()` before calling `_roundRect()`.

Per-corner radius: scalar `r` expands to `[r,r,r,r]`; or pass array `[tl, tr, br, bl]`. Left color bar uses `[radius, 0, 0, radius]`.

---

## 4.7 Color System (KRX_COLORS — Complete Reference)

`KRX_COLORS` is `Object.freeze({…})` in `js/colors.js`. All JS code references these constants; all CSS uses `var(--*)` equivalents. No hardcoded hex is permitted except one known bug (F2).

### Direction Colors (Korean convention: up=red, down=blue)

| Name | Value | Purpose |
|------|-------|---------|
| `UP` | `#E05050` | Up candles, buy signals, signal diamonds |
| `DOWN` | `#5086DC` | Down candles, sell signals |
| `NEUTRAL` | `#ffeb3b` | Neutral/doji, win rate 40-60% |
| `ACCENT` | `#A08830` | Extended structure lines, volume labels, active outcome dot |
| `UP_FILL(a)` | `rgba(224,80,80,a)` | Volume up, RSI 70 ref, golden cross bands |
| `DOWN_FILL(a)` | `rgba(80,134,220,a)` | Volume down, RSI 30 ref, dead cross bands |
| `ACCENT_FILL(a)` | `rgba(160,136,48,a)` | Volume MA, volume breakout highlight |

### Indicator Colors

| Name | Value | Indicator |
|------|-------|-----------|
| `MA_SHORT` | `#FF6B6B` | MA short period |
| `MA_MID` | `#FFD93D` | MA mid period |
| `MA_LONG` | `#6BCB77` | MA long period |
| `EMA_12` | `#C77DFF` | EMA fast |
| `EMA_26` | `#7B68EE` | EMA slow |
| `BB` | `#FF8C42` | Bollinger band lines |
| `BB_MID` | `rgba(255,140,66,0.4)` | Bollinger mid line |
| `BB_FILL` | `rgba(255,140,66,0.06)` | Bollinger band fill |
| `ICH_TENKAN` | `#E040FB` | Ichimoku tenkan |
| `ICH_KIJUN` | `#00BFA5` | Ichimoku kijun |
| `ICH_SPANA` | `rgba(129,199,132,0.35)` | Ichimoku span A line |
| `ICH_SPANB` | `rgba(239,154,154,0.35)` | Ichimoku span B line |
| `ICH_CHIKOU` | `#78909C` | Ichimoku chikou |
| `ICH_BULL_FILL` | `rgba(129,199,132,0.10)` | Bullish cloud AreaSeries |
| `ICH_BEAR_FILL` | `rgba(239,154,154,0.10)` | Bearish cloud AreaSeries |
| `KALMAN` | `#76FF03` | Kalman filter |
| `RSI` | `#ff9800` | RSI line |
| `VOL_MA` | `#B0BEC5` | Volume MA20 |
| `MACD_LINE` | `#2962ff` | MACD line |
| `MACD_SIGNAL` | `#ff9800` | MACD signal |
| `STOCH_K` | `#7CB342` | Stochastic %K |
| `STOCH_D` | `#e91e63` | Stochastic %D |
| `CCI` | `#26C6DA` | CCI |
| `ADX` | `#AB47BC` | ADX |
| `ADX_REF_LINE` | `rgba(255,255,255,0.2)` | ADX 25 reference |
| `WILLR` | `#FF7043` | Williams %R |
| `ATR_LINE` | `#FFA726` | ATR |

### Pattern Colors (Candle)

| Name | Value | Purpose |
|------|-------|---------|
| `PTN_CANDLE` | `#B388FF` | Candle pattern glow/bracket border, labels |
| `PTN_CANDLE_FILL(a)` | `rgba(179,136,255,a)` | Candle pattern glow/bracket fill (a=0.06 typically) |
| `PTN_NEUTRAL` | `rgba(200,200,200,0.55)` | Neutral patterns (doji, spinningTop) |
| `PTN_NEUTRAL_FILL(a)` | `rgba(200,200,200,a)` | Neutral pattern glow fill |

### Pattern Colors (Chart)

| Name | Value | Purpose |
|------|-------|---------|
| `PTN_BUY` | `rgba(150,220,200,0.65)` | Chart pattern border/line (all directions — unified mint) |
| `PTN_BUY_FILL` | `rgba(150,220,200,0.12)` | Chart pattern area fill |
| `PTN_SELL` | `rgba(150,220,200,0.65)` | Same as PTN_BUY (unified) |
| `PTN_SELL_FILL` | `rgba(150,220,200,0.12)` | Same as PTN_BUY_FILL |
| `PTN_STRUCT` | `rgba(200,200,200,0.45)` | Structure lines (unconfirmed necklines) |
| `PTN_STOP` | `rgba(255,107,53,0.55)` | Stop-loss hline |
| `PTN_TARGET` | `rgba(150,220,200,0.55)` | Price target hline |
| `PTN_INVALID` | `#FF6B35` | Pattern invalidation level |
| `PTN_MARKER_BUY` | `rgba(130,210,185,0.8)` | Candle markers (buy, unified mint) |
| `PTN_MARKER_SELL` | `rgba(130,210,185,0.8)` | Candle markers (sell, unified mint) |

### Forecast Zone Colors

| Name | Value | Purpose |
|------|-------|---------|
| `FZ_TARGET_NEAR` | `rgba(150,220,200,0.22)` | Target gradient stop near entry |
| `FZ_TARGET_FAR` | `rgba(150,220,200,0.05)` | Target gradient stop at target |
| `FZ_TARGET_BORDER` | `rgba(150,220,200,0.45)` | R:R bar target segment |
| `FZ_STOP_NEAR` | `rgba(255,107,53,0.15)` | Stop gradient stop near entry |
| `FZ_STOP_FAR` | `rgba(255,107,53,0.03)` | Stop gradient stop at stop price |
| `FZ_STOP_BORDER` | `rgba(255,107,53,0.25)` | Stop zone border |

### Chart Layout Colors

| Name | Value | Purpose |
|------|-------|---------|
| `CHART_BG` | `#131722` | Chart background |
| `CHART_TEXT` | `#d1d4dc` | Text, star stroke |
| `CHART_BORDER` | `#2a2e39` | Axis borders |
| `CHART_CROSSHAIR` | `rgba(149,152,161,0.4)` | Crosshair lines |
| `CHART_CROSSHAIR_LABEL` | `#363a45` | Crosshair label background |
| `CHART_GRID_VERT` | `rgba(42,46,57,0.12)` | Grid vertical lines |
| `CHART_GRID_HORZ` | `rgba(42,46,57,0.20)` | Grid horizontal lines |
| `CHART_WATERMARK` | `rgba(255,255,255,0.04)` | Logo watermark |
| `CHART_ZERO_LINE` | `rgba(255,255,255,0.15)` | MACD/oscillator zero line |
| `LINE_PRICE` | `#2962ff` | Line-chart mode price line |
| `TAG_BG(a)` | `rgba(19,23,34,a)` | HTS tag badge backgrounds |

### Drawing Tool Colors

| Name | Value | Purpose |
|------|-------|---------|
| `DRAW_GOLD` | `#C9A84C` | Default trendline color |
| `DRAW_GRAY` | `#787B86` | Default hline/vline/fib color |
| `DRAW_BLUE` | `#2962FF` | Default rect color |
| `DRAW_CYAN` | `#26C6DA` | Selection handles |

### Reliability Tier Badge Colors

| Name | Value | Tier |
|------|-------|------|
| `TIER_A` | `#2ecc71` | A — high reliability |
| `TIER_B` | `#3498db` | B — moderate |
| `TIER_C` | `#f39c12` | C — amber |
| `TIER_D` | `#95a5a6` | D — insufficient |

### Visible High/Low Colors

| Name | Value | Purpose |
|------|-------|---------|
| `VIS_HIGH_FILL(a)` | `rgba(224,80,80,a)` | Visible high dashed line + triangle |
| `VIS_LOW_FILL(a)` | `rgba(100,200,255,a)` | Visible low dashed line + triangle |

---

## 4.8 Known Issues and Findings

### F1 — `_roundRect` Missing `ctx.beginPath()` (Fragility)
**Location:** `patternRenderer.js` and `signalRenderer.js` (both define their own copy).
`_roundRect()` does not call `ctx.beginPath()` internally. All current callers correctly open a path first, but this is a fragility point for future contributors.
**Status:** Not a bug today; documentation warning added here.

### F2 — Hardcoded `'#fff'` in Forecast Zone R:R Bar
**Location:** `patternRenderer.js` line ~768, the entry-point dot on the R:R vertical bar.
```javascript
ctx.fillStyle = '#fff';  // should be KRX_COLORS.CHART_TEXT or a named constant
```
This is the only hardcoded hex color in the entire rendering pipeline.
**Status:** Unfixed. Replacement: `KRX_COLORS.CHART_TEXT` (`#d1d4dc`).

### F3 — `_colorToFill` Assumes 6-Digit Hex Input
**Location:** `drawingTools.js` `_colorToFill()`.
Converts `hexColor.slice(1,3)` etc. to rgba. The palette only contains 6-digit hex values, so this works. Would break silently if palette ever included rgba strings.
**Status:** Low risk; palette is hardcoded from KRX_COLORS constants.

### F4 — CI_REF D-Tier Constant (Unverified)
**Location:** `patternRenderer.js` `_buildForecastZone()`.
`var CI_REF = 5.5;` — tagged `[D][L:GS]`. Not yet promoted from D-tier. Safe because `ciAlpha` defaults to 1.0 when `backtestCi95Lower`/`backtestCi95Upper` are absent.
**Status:** Pending promotion via calibration data.

### F5 — Forecast Zone Alpha Not Wrapped in Save/Restore
`ctx.globalAlpha = 1` is reset explicitly inline at end of the forecast zone block rather than via `ctx.save()/ctx.restore()`. This is functionally correct (alpha is reset) but inconsistent with the off-screen-target sub-block which uses save/restore.
**Status:** Not a bug; documentation note for consistency.

### F6 — `cupAndHandle` Handle Uses Non-Standard Bracket Fields
**Location:** `patternRenderer.js` `_buildCupAndHandle()`.
The handle bracket is pushed as `{x, y, w, h, color}` but the bracket renderer expects `{x1, y1, x2, y2, fill, border}`. This is a latent data shape mismatch.
**Status:** Needs verification — if the bracket layer skips null x1/y1, the handle silently fails to render.

---

## 4.9 Density Limits Summary

| Limit | Value | Enforced in |
|-------|-------|------------|
| `MAX_PATTERNS` | 3 (zoom-adaptive: 1 or 2 below 200 bars) | `patternRenderer.render()` |
| `MAX_EXTENDED_LINES` | 5 | `patternRenderer.render()` |
| Forecast zone | 1 (patterns[0] only) | `PatternPaneView.update()` |
| Stop/target hlines | 1 (top pattern with stop/target) | `_buildStopTarget()` |
| `MAX_DIAMONDS` | 6 | `SignalFgPaneView.update()` |
| `MAX_STARS` | 2 | `SignalFgPaneView.update()` |
| `MAX_DIV_LINES` | 4 | `SignalFgPaneView.update()` |
| `RECENT_BAR_LIMIT` | 50 (zoom-expanded) | Both signal pane views |
| Volume label min gap | 30px | `SignalCanvasRenderer.draw()` |

---

## 4.10 Chart Pattern Builder Reference

| Pattern | Layers Used | Key Pattern Fields |
|---------|-------------|-------------------|
| `doubleBottom` | polylines (2 vertical boundaries, dashed), hlines (neckline + priceLabel), trendAreas (2× upward ▲ at troughs, optional diamond at break) | `p.neckline`, `p.necklineBreakConfirmed`, `p.breakIndex` |
| `doubleTop` | polylines (2 vertical boundaries), hlines (neckline + priceLabel), trendAreas (2× downward ▼ at peaks, optional diamond at break) | same |
| `headAndShoulders` | polylines (neckline solid + 2 extension segments), trendAreas (optional diamond at break), connectors (3 hollow circles at shoulders/head) | `p.trendlines[0]`, `p.necklineBreakConfirmed`, `p.breakIndex` |
| `inverseHeadAndShoulders` | same | same |
| `ascendingTriangle` | polylines (upper mint, lower mint), trendAreas (quadrilateral fill mint) | `p.trendlines[0]`, `p.trendlines[1]` |
| `descendingTriangle` | same | same |
| `symmetricTriangle` | same | same |
| `risingWedge` | polylines (upper mint, lower gold), trendAreas (fill mint) | `p.trendlines[0]`, `p.trendlines[1]` |
| `fallingWedge` | polylines (upper gold, lower mint), trendAreas (fill mint) | same |
| `channel` | polylines (upper gold dashed, lower gold dashed), trendAreas (fill mint) | `p.upperSlope`, `p.upperIntercept`, `p.lowerSlope`, `p.lowerIntercept` |
| `cupAndHandle` | polylines (U-curve ~15pts, smooth, mint 2px), brackets (handle area), connectors (2 rim hollow circles), trendAreas (bottom ▲, optional break diamond), hlines (neckline) | `p.bottomIndex`, `p.handleFound`, `p.neckline`, `p.breakIndex` |

All chart patterns also receive: Layer 7 (label), Layer 8 (forecast zone if patterns[0]).
