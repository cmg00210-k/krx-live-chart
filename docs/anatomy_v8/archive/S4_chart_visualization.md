# Stage 4: Chart — The Visual Translation

> **Stage Color:** Deep Violet `#2D1B4E`
>
> This stage documents how theoretical computations from Stage 3 become visual elements
> on the chart. Every color, shape, layer, and density limit has a rationale rooted in
> perceptual psychology, financial convention, or information theory.

---

## 4.1 Rendering Engine: TradingView Lightweight Charts v5.1.0

### 4.1.1 Why Canvas2D

CheeseStock renders 2,700+ stocks with up to 13 draw layers per chart. The rendering
engine choice reflects a deliberate trade-off:

| Engine | Pros | Cons | Verdict |
|--------|------|------|---------|
| SVG | DOM-accessible, CSS-styleable | O(n) DOM nodes → slow at 1000+ elements | Rejected |
| WebGL | GPU-accelerated, massive throughput | Complex shader pipeline, overkill for 2D charts | Rejected |
| Canvas2D | Fast rasterization, simple API, DPR control | No hit-testing, manual text layout | **Selected** |

TradingView Lightweight Charts (LWC) wraps Canvas2D with financial-domain primitives
(time scale, price scale, crosshair, series types). The `ISeriesPrimitive` API allows
custom drawing on the chart canvas — this is how patterns, signals, and forecast zones render.

### 4.1.2 Chart Lifecycle

```
chartManager.createChart()
    │
    ├── candleSeries (OHLC candles or line)
    ├── indicatorSeries (MA, EMA, BB overlays)
    ├── sub-charts (RSI, MACD, Stochastic — separate panes)
    │
    ├── patternRenderer (ISeriesPrimitive — 9 layers)
    ├── signalRenderer (ISeriesPrimitive — dual pane)
    └── drawingTools (ISeriesPrimitive — user drawings)
```

**Critical: ISeriesPrimitive Reconnection**

When `candleSeries` is recreated (stock change, chart type toggle):
1. Check `_attachedSeries !== targetSeries`
2. Detach old primitive (wrapped in try/catch for safety)
3. Create new primitive instance
4. Attach to new series

This pattern applies to patternRenderer, signalRenderer, and drawingTools identically.
Failure to reconnect produces invisible overlays — a silent rendering failure.

---

## 4.2 The 9 Draw Layers (PatternRenderer)

PatternRenderer uses a fixed-order 9-layer architecture. Each layer visualizes a
specific category of Stage 3 output. Layer order is critical — later layers draw
on top of earlier ones.

### Layer 1: Glows — Single Candle Identification

| Property | Value |
|----------|-------|
| **Visual** | Vertical stripe behind individual candles |
| **Color** | Purple `PTN_CANDLE_FILL(0.12)` = `rgba(179,136,255,0.12)` |
| **Stage 3 Source** | Single candlestick patterns (hammer, doji, shooting star, etc.) |
| **Rationale** | Subtle highlight that marks the candle without obscuring price action |

### Layer 2: Brackets — Multi-Candle Grouping

| Property | Value |
|----------|-------|
| **Visual** | Rounded rectangle encompassing 2-3 candles |
| **Color** | Purple `PTN_CANDLE_FILL(0.12)` |
| **Stage 3 Source** | Double/triple patterns (engulfing, morning star, three soldiers) |
| **Rationale** | Groups related candles visually to show the pattern as a unit |

### Layer 3: TrendAreas — Triangle/Wedge Fills

| Property | Value |
|----------|-------|
| **Visual** | Gradient-filled polygon between trendlines + pivot point markers |
| **Color** | Mint `PTN_BUY_FILL` = `rgba(150,220,200,0.12)` |
| **Stage 3 Source** | Chart patterns with trendlines (ascending/descending/symmetric triangles, rising/falling wedges) |
| **Rationale** | Area fills show the contracting/expanding price range that defines the pattern |

### Layer 4: Polylines — Structure Connections

| Property | Value |
|----------|-------|
| **Visual** | Connected lines through pivot points (W, M, neckline shapes) |
| **Color** | Mint `PTN_BUY` = `rgba(150,220,200,0.65)` |
| **Stage 3 Source** | Double bottom/top W/M shapes, necklines |
| **Rationale** | Connects the structural points that define the pattern geometry |

### Layer 5: Hlines — Horizontal Reference Lines

| Property | Value |
|----------|-------|
| **Visual** | Horizontal lines at support/resistance, stop-loss, and target prices |
| **Color** | Stop: orange `PTN_STOP`, Target: mint `PTN_TARGET`, S/R: silver `PTN_STRUCT` |
| **Stage 3 Source** | Support/Resistance clustering, pattern stop/target levels |
| **Rationale** | Price levels are the most actionable output — clearly delineated |

### Layer 6: Connectors — H&S Structural Elements

| Property | Value |
|----------|-------|
| **Visual** | Empty circles at shoulders + connecting lines |
| **Color** | Mint `PTN_BUY` |
| **Stage 3 Source** | Head & Shoulders, Inverse H&S pivot points |
| **Rationale** | H&S is the most complex chart pattern — explicit structural annotation aids recognition |

### Layer 7: Labels — Pattern Identification Badges

| Property | Value |
|----------|-------|
| **Visual** | Pill-shaped badges with pattern name (Korean) |
| **Font** | Pretendard 12px weight 700 |
| **Color** | White text on dark background `TAG_BG(0.88)` |
| **Stage 3 Source** | All detected patterns |
| **Rationale** | Text identification for patterns that may be visually ambiguous |
| **Algorithm** | Collision avoidance — labels offset when overlapping |

### Layer 8: ForecastZones — Target/Stop Projections

| Property | Value |
|----------|-------|
| **Visual** | Gradient rectangles projecting future price targets + R:R vertical bar |
| **Color** | Target: mint gradient `FZ_TARGET_NEAR→FZ_TARGET_FAR`, Stop: orange gradient `FZ_STOP_NEAR→FZ_STOP_FAR` |
| **Stage 3 Source** | Pattern price targets and stop-loss levels |
| **Rationale** | Visualizes the risk-reward ratio as a spatial relationship |

### Layer 9: ExtendedLines — Off-Screen Structure

| Property | Value |
|----------|-------|
| **Visual** | Dashed lines extending pattern structures beyond visible chart area |
| **Color** | Accent gold `ACCENT` = `#A08830`, dash `[8,4]` |
| **Stage 3 Source** | Trendlines, necklines that extend beyond current view |
| **Rationale** | Structural lines remain valid beyond their detection window |
| **Limit** | MAX_EXTENDED_LINES = 5 |

---

## 4.3 Color Theory & Design Rationale

### 4.3.1 Korean Market Convention

Korean stock markets use the **opposite** color convention from Western markets:

| Direction | Korean (KRX) | Western (NYSE) | Rationale |
|-----------|-------------|----------------|-----------|
| Up / Buy | **Red** `#E05050` | Green | Red = prosperity, auspiciousness in East Asian culture |
| Down / Sell | **Blue** `#5086DC` | Red | Blue = calm, conservative |

This is not aesthetic preference — it is cultural convention observed by ALL Korean
trading platforms (Samsung Securities, Mirae Asset, NH, Kiwoom). CheeseStock follows
this to match user expectations.

### 4.3.2 Three-Column Color Independence

CheeseStock uses a 4-column layout where color meaning changes by column:

| Column | Area | Color System | Meaning |
|--------|------|-------------|---------|
| B (Chart) | Price action, indicators | Red (#E05050) / Blue (#5086DC) | Price direction (up/down) |
| C (Patterns) | Pattern annotations | Mint / Purple | Analysis type (chart/candle) |
| D (Financials) | Fundamental metrics | Green (#6BCB77) / Blue | Financial quality (good/poor) |

**Why separate color systems?**
- Patterns are **direction-independent** — a hammer is a hammer regardless of whether it
  appears at support (bullish) or resistance (less reliable). Using directional red/blue
  for patterns would introduce a cognitive bias not supported by pattern theory.
- Financial metrics measure **quality**, not direction — high ROE is "good" regardless
  of whether the stock is rising or falling.

### 4.3.3 Pattern Color Unification

Both buy and sell patterns use the **same mint color** (`PTN_BUY = PTN_SELL`):

```javascript
PTN_BUY:  'rgba(150,220,200,0.65)',    // mint border
PTN_SELL: 'rgba(150,220,200,0.65)',    // [unified] sell also mint
```

**Rationale:** Following Bloomberg/TradingView professional standard where pattern
detection is a **neutral analytical observation**, not a directional recommendation.
Direction is conveyed through the label text ("매수 신호" / "매도 신호") and position
(above/below price), not color.

---

## 4.4 Typography on Canvas

### 4.4.1 Font Selection Rationale

| Font | Usage | Why |
|------|-------|-----|
| **Pretendard** | Pattern labels, Korean text | Korean-optimized variable font with consistent glyph width. Weight 700 ensures readability at 12px on dark chart backgrounds |
| **JetBrains Mono** | Price labels, stock codes | Tabular numerals (`font-feature-settings: "tnum"`) align decimal points in price columns. Monospace ensures fixed-width digits |

### 4.4.2 Label Collision Avoidance

When multiple patterns detect on adjacent candles, labels overlap. The collision
avoidance algorithm:
1. Sort labels by bar index
2. For each label, check overlap with previous labels
3. If overlapping, offset vertically (above → below, or shift up/down)
4. Maximum 3 labels visible simultaneously (MAX_PATTERNS limit)

---

## 4.5 Density Control & Cognitive Load

### 4.5.1 Density Limits

| Constant | Value | Rationale |
|----------|-------|-----------|
| MAX_PATTERNS | 3 | Miller (1956): 7±2 working memory limit. 3 patterns with labels, zones, and lines already produce ~15 visual elements |
| MAX_EXTENDED_LINES | 5 | Prevents line clutter on charts with many historical patterns |
| MAX_DIAMONDS | 6 | Signal markers — enough for recent signals without overwhelming |
| MAX_STARS | 2 | High-confidence composite signals — rare by design |
| MAX_DIV_LINES | 4 | RSI/MACD divergence lines — structural, not cluttering |
| RECENT_BAR_LIMIT | 50 | Temporal focus: only render analysis for recent ~50 bars |

### 4.5.2 Academic Basis: Cognitive Load Theory

George Miller's (1956) "The Magical Number Seven, Plus or Minus Two" establishes
that human working memory can hold 7±2 chunks of information simultaneously.

In a chart context:
- Each pattern contributes ~5 visual elements (glow/bracket + label + S/R lines + forecast zone)
- 3 patterns × 5 elements = 15 visual elements
- Plus candlesticks, indicators, and axis labels → already at cognitive capacity

**Design Decision:** Show the 3 most recent/confident patterns rather than all detected.
Analysis completeness (Stage 3 runs on all data) is preserved; visual filtering
(Stage 4) respects human perception limits.

### 4.5.3 Visualization Toggles

Four toggle categories allow users to manage visual complexity:

| Toggle | Controls | Default |
|--------|----------|---------|
| Candle | Single/double/triple candlestick pattern overlays | ON |
| Chart | Chart patterns (triangles, H&S, etc.) | ON |
| Signal | Composite signal markers (diamonds, stars) | ON |
| Forecast | Target/stop-loss projection zones | ON |

**Architecture Principle:** `_filterPatternsForViz()` filters at render time.
Stage 3 analysis always runs completely — toggles never suppress computation,
only visualization. This ensures:
- Pattern detection accuracy is independent of display settings
- Users can toggle display without re-running analysis
- Backtest results remain valid regardless of visualization state

---

## 4.6 Canvas DPR (Device Pixel Ratio) Safety

High-DPI displays (Retina, 4K) require coordinate scaling:

```javascript
// CORRECT: Reset transform before scaling
ctx.setTransform(1, 0, 0, 1, 0, 0);  // Reset to identity
ctx.clearRect(0, 0, width, height);
ctx.scale(dpr, dpr);                   // Apply DPR scaling

// WRONG: Accumulated scaling (each redraw doubles the scale)
ctx.scale(dpr, dpr);  // Without reset → 2x, 4x, 8x...
```

This pattern is used in patternRenderer, signalRenderer, and financials.js
(trend chart Canvas2D rendering). Failure to reset causes exponentially growing
coordinates — a subtle bug that manifests as invisible or misplaced drawings.

---

## 4.7 Signal Renderer — Dual PaneView Architecture

SignalRenderer uses a split rendering approach:

| Pane | zOrder | Visual Elements | Rationale |
|------|--------|----------------|-----------|
| **Background** | `'bottom'` | Vertical bands (golden cross, dead cross zones) | Contextual signals should NOT obscure price action |
| **Foreground** | `'top'` | Diamonds, stars, divergence lines, volume labels | High-confidence signals MUST be visible above price |

**Why dual pane?**
- Golden/dead cross zones span multiple bars — large colored areas that would
  completely hide candlestick patterns if rendered on top
- Diamond/star markers are point signals on specific bars — small enough to
  coexist with candlesticks without occlusion

---

## 4.8 Drawing Tools — User-Generated Analysis Layer

7 drawing tools allow users to add their own analysis:

| Tool | Visual | Persistence |
|------|--------|-------------|
| Trendline | Diagonal line between two points | localStorage |
| Horizontal Line | Price level marker | localStorage |
| Vertical Line | Time marker | localStorage |
| Rectangle | Price/time zone | localStorage |
| Fibonacci | Retracement levels (23.6%, 38.2%, 50%, 61.8%) | localStorage |
| Eraser | Remove drawings | — |
| Text | Annotation | localStorage |

**Interaction with Analysis Layers:**
When drawing tools are active, chart scroll/zoom handlers are disabled:
```javascript
// Drawing active → disable chart interaction
handleScroll.pressedMouseMove = false;
handleScale.axisPressedMouseMove = false;
```

This prevents accidental chart panning while drawing — a UX necessity documented
in `.claude/rules/architecture.md`.

---

## 4.9 Stage 3 → Stage 4 Mapping Table

| Stage 3 Output Type | Stage 4 Layer | Visual Encoding | Example |
|---------------------|---------------|-----------------|---------|
| Indicator value (MA, BB) | Chart overlay (indicatorSeries) | Colored line | MA5 = red line |
| Candle pattern | Layers 1-2 (glow, bracket) + Layer 7 (label) | Purple highlight + badge | "해머" badge |
| Chart pattern | Layers 3-6 (trendArea, polyline, hline, connector) | Mint polygon + lines | Triangle fill |
| S/R level | Layer 5 (hline) | Silver horizontal line + price label | Support at 50,000 |
| Signal | SignalRenderer foreground | Diamond (medium) or Star (strong) | Golden cross diamond |
| Forecast zone | Layer 8 (forecastZones) | Mint/orange gradient + R:R bar | Target/stop projection |
| Confidence score | Label opacity + tier badge | Alpha 0.4-1.0 + A/B/C/D color | Tier A = green badge |
| Backtest result | Pattern panel card (C column) | Win rate %, avg return % | "승률 62%" text |

---

## 4.10 Forward Reference

Stage 4 visual elements are delivered to users through Stage 5:
- Chart renders in the B column of the 4-column grid
- Pattern panel (C column) shows detection results as interactive cards
- Financial panel (D column) shows valuation metrics from DART data
- Responsive breakpoints adapt layout for mobile (single column) to desktop (4 columns)

The visual translation is complete: mathematical computation → visual encoding.
Stage 5 documents how this encoded information reaches users at cheesestock.co.kr.
