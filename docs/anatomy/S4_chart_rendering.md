# Stage 4 — Chart Rendering Architecture
## CheeseStock ANATOMY V5

**Last updated:** 2026-04-06
**Scope:** `js/chart.js`, `js/patternRenderer.js`, `js/signalRenderer.js`, `js/drawingTools.js`
**Version:** LWC v5.1.0 (CDN `unpkg.com`, local fallback)

---

## 4.1 LWC Integration Architecture

### Library Loading

TradingView Lightweight Charts v5.1.0 loads via CDN in `index.html` as a global `LightweightCharts`. There is no bundler — the library exposes `LightweightCharts.*` directly. Chart.js wraps all LWC calls inside `ChartManager` and never touches `LightweightCharts` outside that class.

### Chart Creation Options (`_baseOptions()`)

Every chart (main, RSI, MACD, sub-charts) calls `_baseOptions()` and applies overrides. All color values come from `KRX_COLORS.*`:

| Option | Value | Source constant |
|--------|-------|-----------------|
| Background | `#131722` | `KRX_COLORS.CHART_BG` |
| Text | `#d1d4dc` | `KRX_COLORS.CHART_TEXT` |
| Grid vertical | `rgba(42,46,57,0.12)` | `KRX_COLORS.CHART_GRID_VERT` |
| Grid horizontal | `rgba(42,46,57,0.20)` | `KRX_COLORS.CHART_GRID_HORZ` |
| Crosshair | `rgba(149,152,161,0.4)` | `KRX_COLORS.CHART_CROSSHAIR` |
| Axis border | `#2a2e39` | `KRX_COLORS.CHART_BORDER` |
| Price scale margins | top:0.15, bottom:0.20 | hardcoded in base |

**Price formatter:** `Math.round(price).toLocaleString('ko-KR')` — integers only (KRW).

**Time formatter and tickMarkFormatter:** Both handle three input types:
- `"YYYY-MM-DD"` string (daily candles) — returned as-is or reformatted
- `{ year, month, day }` object (LWC internal) — formatted `YYYY-MM-DD`
- Unix timestamp (number) — converted to KST via `+9 * 3600`. The KST rollover uses `new Date((time + 9*3600)*1000)` to correctly handle month boundaries.

**Time scale:** `fixLeftEdge: true`, `fixRightEdge: true` (last candle anchored to right axis). `barSpacing` is computed dynamically: `Math.max(6, Math.floor(containerWidth / 17))`.

**Input handling:**
```
handleScale:  { mouseWheel:true, pinch:true, axisPressedMouseMove:true }
handleScroll: { mouseWheel:true, pressedMouseMove:true, horzTouchDrag:true, vertTouchDrag:true }
```
Drawing tools override `pressedMouseMove` and `axisPressedMouseMove` to `false` while a tool is active.

### Chart Types

| `chartType` param | Series created | Notes |
|-------------------|---------------|-------|
| `candle` (default) | `CandlestickSeries` | `borderVisible:false`, no wicks border |
| `bar` | `BarSeries` | `openVisible:true`, `thinBars:true` |
| `line` | `CandlestickSeries` (empty) + `LineSeries` as `_priceLine` | candleSeries holds primitives; line data in separate series |
| `heikin` | `CandlestickSeries` + `_convertToHeikinAshi()` transform | HA formula: `haClose=(O+H+L+C)/4`, `haOpen=avg(prevHaO, prevHaC)` |

Chart type switching goes through `_swapMainSeries(toType)` which: detaches primitives, removes price lines, removes old series, creates new series, re-attaches primitives.

---

## 4.2 ChartManager Lifecycle

### Constructor State

```
mainChart, rsiChart, macdChart          — chart instances
stochChart, cciChart, adxChart,         — sub-chart instances
willrChart, atrChart

candleSeries, volumeSeries              — main series
indicatorSeries {}                      — map: key → LineSeries/AreaSeries
trendlineSeries []                      — LineSeries for pattern trendlines

_resizeMap: Map<container, {observer, chart}>
_syncUnsubs: []                         — time scale sync unsubscribe fns
_indicatorCache: {key, results{}}       — candle-keyed calc cache
_subChartCache: {key, results{}}        — sub-chart calc cache
_lastDataKey: {}                        — setData() dedup per indicator key
_visibleRangeUnsub                      — subscribeVisibleLogicalRangeChange unsub
_visibleRangeCallback                   — registered by app.js via onVisibleRangeChange()
```

### Series Creation Pattern

All series use `addSeries(SeriesType, options)` (LWC v5 API). The main chart holds:
- `candleSeries` — primary OHLC series (also anchor for patternRenderer/signalRenderer primitives)
- `volumeSeries` — `HistogramSeries` on `priceScaleId:'vol'`, `scaleMargins:{top:0.8, bottom:0}`
- `indicatorSeries['ma5']`, `['ma20']`, `['ma60']`, `['ema12']`, `['ema26']` — `LineSeries`
- `indicatorSeries['_priceLine']` — `LineSeries` for line chart mode (2px, `KRX_COLORS.LINE_PRICE`)
- `indicatorSeries['_ichBullCeil']`, `['_ichBullFloor']`, `['_ichBearCeil']`, `['_ichBearFloor']` — 4 `AreaSeries` for Ichimoku cloud fill
- `trendlineSeries[]` — dynamically created `LineSeries` for pattern trendlines (recycled, not deleted on each update)

**Indicator line management** uses `_updateIndicatorLine(key, show, times, values, color, lineWidth)` which:
1. Removes series if `show=false`
2. Creates series if not exists
3. Checks `_lastDataKey[key]` fingerprint (length + first + last value) to skip redundant `setData()` calls

### Sub-chart Architecture

| Chart | Series | Reference lines | Color |
|-------|--------|-----------------|-------|
| RSI | `rsiSeries` (LineSeries) | 70, 50, 30 priceLine | `KRX_COLORS.RSI` |
| MACD | `macdHistSeries` + `macdLineSeries` + `macdSignalSeries` | 0 priceLine | `MACD_LINE`/`MACD_SIGNAL`/`UP_FILL(0.5)` |
| Stochastic | `stochKSeries` + `stochDSeries` | 80, 20 priceLine | `STOCH_K`/`STOCH_D` |
| CCI | `cciSeries` | 100, -100 priceLine | `KRX_COLORS.CCI` |
| ADX | `adxSeries` + `adxPlusDISeries` + `adxMinusDISeries` | 25 priceLine | `ADX`/`UP`/`DOWN` |
| Williams%R | `willrSeries` | -20, -80 priceLine | `KRX_COLORS.WILLR` |
| ATR | `atrSeries` | none | `KRX_COLORS.ATR_LINE` |

**Mutual exclusion:** `OSCILLATOR_GROUP = ['rsi','stoch','cci','adx','willr','atr']`. Only one oscillator slot is active. MACD uses an independent slot. Activation/deactivation is managed by `_OSC_MAP` in `appState.js`, called from `appUI.js`.

All sub-chart reference lines use `createPriceLine()` with `lineStyle:2` (dashed). Reference line colors use `KRX_COLORS.UP_FILL(0.4)` and `KRX_COLORS.DOWN_FILL(0.4)` — not hardcoded hex.

### Destroy Methods

Each sub-chart has a symmetric `create/destroy` pair:

```
createRSIChart(container)      destroyRSI()
createMACDChart(container)     destroyMACD()
createStochasticChart(...)     destroyStochastic()
createCCIChart(...)            destroyCCI()
createADXChart(...)            destroyADX()
createWilliamsRChart(...)      destroyWilliamsR()
createATRChart(...)            destroyATR()
destroyAll()                   — tears down everything
```

Destroy pattern: (1) find entry in `_resizeMap`, disconnect observer, delete entry; (2) call `chart.remove()`; (3) null series references; (4) call `_rebuildSync()`.

`destroyAll()` additionally calls `patternRenderer.cleanup()`, `signalRenderer.cleanup()`, `drawingTools.cleanup()` to detach primitives before chart removal.

### Time Scale Synchronization

`_rebuildSync()` uses a microtask debounce (`Promise.resolve().then(...)`) so that multiple consecutive sub-chart create/destroy calls only trigger one sync rebuild. `_doRebuildSync()` subscribes all chart pairs bidirectionally via `subscribeVisibleLogicalRangeChange`, guarded by `_syncing` flag to prevent infinite loops.

### Resize Handling (`_observeResize`)

`_resizeMap` is a `Map<container, {observer: ResizeObserver, chart}>`. Each chart container gets one observer. The observer RAF-batches resize events and calls `chart.applyOptions({width, height})`. For the main chart, `barSpacing` is recalculated only when width changes by more than 10px (prevents zoom gesture false triggers). The visible logical range is saved before and restored after `barSpacing` changes to prevent zoom-level jumps.

---

## 4.3 ISeriesPrimitive Pattern

All three overlays (patternRenderer, signalRenderer, drawingTools) follow identical structure:

```
Module-level:
  let _primitive = null;
  let _attachedSeries = null;

render() entry:
  const targetSeries = (chartType === 'line' && cm.indicatorSeries._priceLine)
    ? cm.indicatorSeries._priceLine : cm.candleSeries;
  if (!targetSeries) return;

  if (_attachedSeries !== targetSeries) {
    if (_primitive && _attachedSeries) {
      try { _attachedSeries.detachPrimitive(_primitive); } catch(e) {}
    }
    _primitive = new XxxPrimitive();
    targetSeries.attachPrimitive(_primitive);
    _attachedSeries = targetSeries;
  }
```

**Line mode guard:** When `chartType === 'line'`, the target is `indicatorSeries._priceLine`. If that series is null (line series not yet created), rendering skips. This prevents attaching to a stale or null series.

**Reconnection trigger:** `_attachedSeries !== targetSeries` fires when:
- Stock changes (new `candleSeries` created via `destroyAll()`)
- Chart type switches between candlestick and bar (`_swapMainSeries`)
- Line mode activated/deactivated (different series object)

### Primitive Lifecycle API

```javascript
class XxxPrimitive {
  attached(param) {        // called by LWC after attachPrimitive()
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }
  detached() {             // called by LWC before removePrimitive()/series removal
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }
  updateAllViews() { ... } // coordinate recalculation (called before render)
  paneViews() { return [view]; }   // list of PaneViews
}
```

`_requestUpdate()` forces LWC to schedule a new `updateAllViews()` + render cycle.

### PaneView zOrder

| Renderer | PaneView | zOrder |
|----------|----------|--------|
| `_HighLowPrimitive` | single view | `'bottom'` |
| `PatternPaneView` | single view | `'normal'` |
| `SignalBgPaneView` | vertical bands | `'bottom'` |
| `SignalFgPaneView` | diamonds, stars, divlines | `'top'` |
| `DrawingPaneView` | all tools | `'top'` |

---

## 4.4 PatternRenderer — 9-Layer Canvas2D Pipeline

See `S4_canvas_layer_spec.md` for the detailed per-layer specification.

### Data Flow

```
patternRenderer.render(cm, candles, patterns, opts)
  → reconnection check (ISeriesPrimitive pattern)
  → _primitive.setPatterns(candles, patterns, extLines, visibleBars)
    → _requestUpdate()
      → PatternPaneView.update()
        → _buildSingleGlow / _buildBracket / _buildDoubleBottom /
          _buildDoubleTop / _buildHeadAndShoulders / _buildTriangle /
          _buildWedge / _buildChannel / _buildCupAndHandle
        → _buildLabel() for all patterns
        → _buildForecastZone() for patterns[0] only
        → _buildStopTarget() for patterns with stopLoss/priceTarget
        → extended lines pixel conversion
        → PatternRenderer.draw() ← 9 layers in order
```

### Pattern Classification

Three mutually exclusive classification sets determine rendering path:

| Set | Patterns | Rendering |
|-----|----------|-----------|
| `SINGLE_PATTERNS` | 13 single-candle | glow layer |
| `ZONE_PATTERNS` | 21 multi-candle | bracket layer |
| `CHART_PATTERNS` | 11 chart patterns | specialized builders |

Patterns in `CHART_PATTERNS` also go through the label and forecast zone builders.

### Density Limit

`MAX_PATTERNS = 3` is enforced by `_filterPatternsForViz()` in `appUI.js` before patterns reach the renderer. `MAX_EXTENDED_LINES = 5`.

### Visible Bar Zoom-Adaptation

`_visibleBars` is passed into the primitive from the render call:
```javascript
var vr = cm.mainChart.timeScale().getVisibleLogicalRange();
var visibleBars = vr ? Math.ceil(vr.to - vr.from) : 200;
```

The label layer skips text when `_visibleBars > 800` (extreme zoom-out). Font size scales: `<=30` bars → 11px, `<=150` → 12px, `<=400` → 11px, else 10px. Padding and border radius also scale.

---

## 4.5 SignalRenderer — Dual PaneView

`signalRenderer.render(cm, candles, signals, opts)` drives a single `SignalOverlayPrimitive` with two pane views:

### Background PaneView (zOrder `'bottom'`)

`SignalBgPaneView` produces vertical bands around golden/dead cross events:
- Span: `[index-2, index+2]` bars
- Fill: `KRX_COLORS.UP_FILL(0.07)` (golden cross) or `KRX_COLORS.DOWN_FILL(0.07)` (dead cross)
- Height: `h*0.15` to `h*0.65` (avoids OHLC header and volume area)

### Foreground PaneView (zOrder `'top'`)

`SignalFgPaneView` produces diamonds, stars, and divergence lines.

**Diamonds (MA/EMA cross):**
- Shape: 45° rotated square, vertex coordinates calculated manually (no `ctx.rotate()`)
- Size: 8px base for normal strength, 10px for strong; scaled by `wc` factor `Math.max(0.7, Math.min(wc, 1.5))`
- Position: below candle low (golden) or above candle high (dead cross) with 30% body-range offset
- Alpha: 0.85 fill, 1.0 stroke
- Limit: `MAX_DIAMONDS = 6`, sorted by confidence descending

**Stars (Tier-1 composite signals):**
- Shape: 5-point star, `_drawStar(ctx, x, y, r, color)`: outer radius `r`, inner radius `r*0.4`, 5 spikes
- Size: 12px base, scaled by `wc`
- Position: 0.5 body-range outside candle extreme
- Alpha: 0.9 fill, 0.7 stroke with `KRX_COLORS.CHART_TEXT`
- Limit: `MAX_STARS = 2`

**Divergence lines:**
- Types: `macdBullishDivergence`, `rsiBullishDivergence`, `macdBearishDivergence`, `rsiBearishDivergence`, and hidden variants
- Construction: reverse-scan 20 bars back from signal index to find previous swing (order-3 local extremum)
- Style: 1.5px dashed `[5,3]`
- Limit: `MAX_DIV_LINES = 4`

**Volume breakout labels ("거래↑"):**
- Collected from `volumeBreakout`/`volumeSelloff` signal types
- Positioned at `h*0.73` (above volume histogram)
- Minimum 30px gap between labels (sorted by x-coordinate)
- Volume bars updated via `cm.volumeSeries.update()` with `KRX_COLORS.ACCENT_FILL(0.7)`

### Zoom-Aware Cutoff (`RECENT_BAR_LIMIT = 50`)

Both pane views use:
```javascript
const effectiveLimit = Math.max(RECENT_BAR_LIMIT, src._visibleBars || 0);
const cutoff = lastIdx - effectiveLimit;
```
When zoomed in beyond 50 bars, `effectiveLimit` expands to cover the full visible range.

---

## 4.6 Density Limiting and Collision Avoidance

### Pattern Level

| Limit | Value | Location |
|-------|-------|----------|
| `MAX_PATTERNS` | 3 | `patternRenderer.js` constant |
| `MAX_EXTENDED_LINES` | 5 | `patternRenderer.js` constant |
| Forecast zone | 1 (patterns[0] only) | `PatternPaneView.update()` |
| Stop/target hlines | 1 top pattern | `_buildStopTarget()` |

### Signal Level

| Limit | Value |
|-------|-------|
| `MAX_DIAMONDS` | 6 |
| `MAX_STARS` | 2 |
| `MAX_DIV_LINES` | 4 |
| `RECENT_BAR_LIMIT` | 50 (zoom-expanded) |

### Label Collision Avoidance

`placedLabels[]` tracks `{x, y, w}` of rendered labels. For each new label:
1. Compute `boxW` = text width + padding
2. Check all placed labels for overlap: `|dx| < (boxW + placed.w)/2 + 4` AND `|dy| < boxH + 2`
3. On collision, shift y by `boxH + 2` in the placement direction (top=up, bottom=down)
4. Retry up to 6 times, then clamp to screen bounds
5. OHLC safe zone: `labelY = max(OHLC_SAFE_Y=40, labelY)` prevents overlap with OHLC display bar

---

## 4.7 DPR Handling and Canvas Safety

### DPR Protocol

LWC v5 provides `target.useMediaCoordinateSpace(scope => {...})` which handles DPR scaling internally. The scope provides `scope.context` (pre-scaled Canvas2D context) and `scope.mediaSize.{width, height}` (logical dimensions). Code does **not** call `ctx.scale(dpr, dpr)` manually — LWC handles it.

However, for `_HighLowPrimitive` and similar direct canvas access that bypasses `useMediaCoordinateSpace`, the rule applies: `ctx.setTransform(1,0,0,1,0,0)` before `ctx.scale(dpr,dpr)` to prevent DPR accumulation on consecutive draws.

### Canvas State Safety Rules

Every draw function:
1. Opens with `ctx.save()` (outermost in draw())
2. Closes with `ctx.restore()` (matching)
3. Resets `ctx.setLineDash([])` after each stroked path
4. Resets `ctx.globalAlpha = 1` at the end of each label iteration (explicit at line 575)
5. Resets `ctx.lineWidth = 1` after each label iteration (explicit at line 576)

The outer `ctx.save()` in `PatternRenderer.draw()` wraps all 9 layers — a single save/restore pair for the entire draw call. Individual layers that change alpha or lineDash reset them inline before the next operation.

### Null Coordinate Guards

Every coordinate usage:
```javascript
const xy = toXY(time, price);
if (xy.x == null || xy.y == null) return;

// Time-to-coordinate:
const x = ts.timeToCoordinate(time);
if (x == null) return;

// Price-to-coordinate:
const y = series.priceToCoordinate(price);
if (y != null) { /* use y */ }
```

`toXY()` helper: `{ x: ts.timeToCoordinate(time), y: series.priceToCoordinate(price) }`.

### Off-Screen Skip

```javascript
if (g.x < -20 || g.x > w + 20) return;     // glows
if (br.x2 < 0 || br.x1 > w) return;        // brackets
if (cn.circleX < -20 || cn.circleX > w + 20) return;  // connectors
```

The 20px buffer allows partial overlap at edges.

---

## 4.8 Drawing Tools Overlay

### Tool Set

| Tool | Key | Points needed | Rendering |
|------|-----|--------------|-----------|
| Select/Move | S | 0 (click to select) | Highlight + anchor handles |
| Trendline | T | 2 | Infinite extension, anchor dots |
| Horizontal | H | 1 | Full-width dashed line + price label |
| Vertical | V | 1 | Full-height dashed line |
| Rectangle | R | 2 (diagonal) | Fill + border |
| Fibonacci | G | 2 (high/low) | 7 levels: 0/23.6/38.2/50/61.8/78.6/100% |
| Eraser | — | 0 (click hit) | Removes clicked drawing |

### State Management

```javascript
let _activeTool = null;       // current tool string or null
let _drawings = [];           // all drawings for all stocks
let _clickPoints = [];        // points collected for current in-progress drawing
let _primitive = null;        // ISeriesPrimitive
let _attachedSeries = null;
let _currentStockCode = null; // filter: only show current stock's drawings
let _selectedDrawing = null;  // selected drawing for move
let _dragState = null;        // { drawing, startPrice, startTime, origPoints }
let _previewPoint = null;     // { price, time } for incomplete drawing preview
let _currentColor = null;     // user-selected color override
```

### Color System

6-color palette from `KRX_COLORS`:
- `DRAW_GOLD` (`#C9A84C`) — trendline default
- `DRAW_GRAY` (`#787B86`) — hline/vline/fib default
- `DRAW_BLUE` (`#2962FF`) — rect default
- `UP` (`#E05050`), `DOWN` (`#5086DC`), `DRAW_CYAN` (`#26C6DA`)

Drawing color priority: user-selected (`d.color`) overrides `DEFAULT_COLORS[d.type]`.

### Persistence

`localStorage` key `'krx_drawings_v1'`. Serialization saves: `{id, type, points, stockCode, color}`. Drawings are filtered by `stockCode` at render time via `_getVisibleDrawings()`.

### Undo/Redo

`_undoStack` and `_redoStack` each hold up to `MAX_UNDO = 50` entries. Entry format: `{ type: 'add'|'remove'|'move', drawing: {...}, prevState?: {points} }`.

### Keyboard Shortcuts

`S`=Select, `T`=Trendline, `H`=Horizontal, `V`=Vertical, `R`=Rectangle, `G`=Fibonacci, `Del`=Delete selected, `Esc`=Deactivate tool.

### Chart Interaction Disable

When `_activeTool !== null` and not `select`:
```javascript
cm.mainChart.applyOptions({
  handleScale: { axisPressedMouseMove: false },
  handleScroll: { pressedMouseMove: false },
});
```
Restored on tool deactivation.

---

## 4.9 vizToggles — Filter at Render Time

```javascript
var vizToggles = { candle: true, chart: true, signal: true, forecast: true };
```

Defined in `appState.js`. Pattern analysis always runs (Worker, 3s throttle). `_filterPatternsForViz(patterns)` in `appUI.js` filters before passing to `chartManager.updateMain()`:

| Toggle | Filters out |
|--------|-------------|
| `candle: false` | `CANDLE_PATTERN_TYPES` members |
| `chart: false` | `CHART_PATTERNS` members |
| `signal: false` | signals array passed to signalRenderer |
| `forecast: false` | `forecastZones` array in PatternPaneView data |

The `forecast` toggle specifically prevents `_buildForecastZone()` data from being populated, so no forecast zones appear even if patterns are present.

Toggle UI is managed in `appUI.js` with checkbox/button elements. Each toggle calls `updateChartFull()` which re-renders without re-analyzing.

---

## Rendering Findings

### Bugs Found

**F1 — `_roundRect` missing ctx.beginPath() before moveTo**
Location: `patternRenderer.js` `_roundRect()` function (line ~851), `signalRenderer.js` `_roundRect()` (line ~159).
The `_roundRect` helper does NOT call `ctx.beginPath()` internally. Callers must call `ctx.beginPath()` before `_roundRect()`. This is consistently done in all current callers but is a fragility point for future contributors.

**F2 — forecastZone `#fff` hardcode**
Location: `patternRenderer.js` line ~769, R:R vertical bar entry-point marker.
```javascript
ctx.fillStyle = '#fff';   // should be KRX_COLORS.CHART_TEXT or a named constant
```
This is the only hardcoded hex color found in the rendering pipeline. All other colors correctly reference `KRX_COLORS.*`.

**F3 — `rect` color fill uses inline `rgba` computation**
Location: `drawingTools.js` `_colorToFill()`.
```javascript
const r = parseInt(hexColor.slice(1, 3), 16);
```
This converts user-selected hex to rgba. Acceptable for user-input colors, but assumes input is always a 6-digit hex. DRAW_GRAY (`#787B86`) and DRAW_BLUE (`#2962FF`) are valid 6-digit hex, so this works. No bug, but fragile if palette ever includes rgba strings.

**F4 — `_buildForecastZone` CI95 constants are D-tier unverified**
Location: `patternRenderer.js` lines 1841-1844.
```javascript
var CI_REF = 5.5;        // [D][L:GS]
var CI_ALPHA_MIN = 0.15;
var CI_ALPHA_MAX = 1.0;
```
These are D-tier constants (not yet promoted). If `backtestCi95Lower`/`backtestCi95Upper` are absent, `ciAlpha` defaults to 1.0 (full opacity), which is safe.

**F5 — No `ctx.restore()` called after forecastZone `ctx.globalAlpha = 1` reset**
The forecastZone block (layer 8) ends with `ctx.globalAlpha = 1` inline rather than a `ctx.save()/ctx.restore()` pair. This works because globalAlpha is explicitly reset, but differs from the save/restore pattern used in the off-screen-target fallback sub-block (which does use `ctx.save()/ctx.restore()`). Not a bug — global alpha is reset — but inconsistent.

### Color Violations

Only one hardcoded color found (F2 above). All other colors in all three renderers correctly reference `KRX_COLORS.*`.

### Performance Notes

- `_indicatorCache` and `_subChartCache` use the same key format: `length + '_' + last.time + '_' + last.open + '_' + last.close`. These prevent redundant calcMA/calcEMA/calcATR etc. calls when the chart re-renders without new data.
- `_lastDataKey[key]` prevents redundant `series.setData()` calls for indicator lines.
- `_outcomeCache` in `PatternPaneView` (Map, keyed by `type+'_'+endIndex`) caches hit/failed/active outcome per pattern per candle array length, preventing O(n) forward scan every render frame.
- `_rebuildSync()` microtask debounce prevents N²  subscribeVisibleLogicalRangeChange calls when N sub-charts are created simultaneously.
