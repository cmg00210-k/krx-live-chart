# Chapter 5: Classification & Rendering

> **Deliverable 4 -- Structure Flow | Chapter 5 of 6**
> **Version**: V7 (2026-04-07)
> **Source**: `S4_chart_rendering_v7.md`, `S3_signal_backtester_v7.md`,
> `S5_ui_architecture_v7.md`, `.claude/rules/rendering.md`, `.claude/rules/colors.md`

---

## 5.1 The Rendering Problem

A detection engine producing 45 pattern types and 49 signal definitions across
2,696 stocks generates far more annotations than any analyst can absorb. Density
limits, tier-based classification, and a structured layer stack transform raw
detection output (Chapter 3) into a readable chart with 3-5 focused annotations.

> D2: S4_chart_rendering_v7.md SS 4.2-4.3; S5_ui_architecture_v7.md SS 5.1.

---

## 5.2 Five-Tier Classification Matrix

### 5.2.1 Tier Definitions

```
5-TIER CLASSIFICATION MATRIX
==============================

   Tier | Criteria                       | Display Treatment
   -----+--------------------------------+---------------------------
    S   | Multi-agent consensus          | Always rendered. Full
        | WR>55%(sell) or <45%(buy)      | visual: glow/bracket +
        | n>1,000; BH-FDR significant   | label + forecast zone.
   -----+--------------------------------+---------------------------
    A   | 2+ agent consensus             | Rendered by default.
        | Statistically significant      | Full visual, behind S
        | WR 55-57% or composite-key     | in density priority.
   -----+--------------------------------+---------------------------
    B   | Required by composites or      | Detection runs; canvas
        | mirrors an S/A-tier pattern    | rendering inactive.
        | WR typically 40-55%            | Panel list only.
   -----+--------------------------------+---------------------------
    C   | Context-only. n<500 or         | Computed for pipeline.
        | WR CI includes 50%             | Warning badge if shown.
   -----+--------------------------------+---------------------------
    D   | WR~50%, noise, or redundant    | Suppressed entirely.
        | No independent predictive power| No detect, no render.
   -----+--------------------------------+---------------------------

   Backtester Gate (orthogonal):
     reliabilityTier A: BH-FDR sig, wrAlpha>=5%, n>=100, WFE>=50%
     reliabilityTier B: BH-FDR sig, wrAlpha>=3%, n>=30,  WFE>=30%
     A/B demoted to C if WFE<30% or Hansen SPA rejects
```

Classification (S/A/B/C/D) controls canvas visibility. The backtester's
reliability tier (A/B/C/D) controls confidence badge styling. A pattern can be
S-tier by classification yet reliability-C by backtesting (WFE < 30%).

### 5.2.2 Current Population

| Tier | Candle | Chart | Signal | Composite | Total |
|------|--------|-------|--------|-----------|-------|
| S    | 11     | 2     | 2      | 2         | 17    |
| A    | 2      | 2     | 15     | 3         | 22    |
| B    | 13     | 7     | 5      | 11        | 36    |
| C    | 3      | --    | --     | --        | 3     |
| D    | 5      | --    | 4      | 3         | 12    |

S + A = 39 active rendering elements. B-tier detection still runs because those
patterns serve as required inputs to composite signals (e.g., hammer WR = 45.2%
is B-tier, but mandatory in the S-tier composite `strongBuy_hammerRsiVolume`).

> D2: `js/appState.js` lines 46-207; S3_signal_backtester_v7.md SS 3.5.6.

---

## 5.3 The 9+4 Layer Rendering Stack

Two ISeriesPrimitive implementations draw all overlays in a single animation
frame. PatternRenderer handles 9 layers for pattern geometry. SignalRenderer
handles 4 layers for indicator-derived markers. Layer order is fixed --
lower layers are occluded by higher layers.

```
RENDERING LAYER STACK (bottom to top)
=======================================

   PatternRenderer (attached to candleSeries)
   +---------------------------------------------------------+
   | L9: extendedLines   off-visible structure (gold dashed)  |
   | L8: forecastZones   target/stop gradients + R:R bar     |
   | L7: labels          HTS-style pill badges (Pretendard)  |
   | L6: connectors      H&S circles + shoulder lines        |
   | L5: hlines          S/R + stop/target horizontal lines  |
   | L4: polylines       W/M/neckline connections (smooth)   |
   | L3: trendAreas      triangle/wedge gradient fills       |
   | L2: brackets        multi-candle rounded rects (purple) |
   | L1: glows           single candle vertical stripes      |
   +---------------------------------------------------------+

   SignalRenderer (dual pane)
   +---------------------------------------------------------+
   | Background (zOrder='bottom'):                           |
   |   S-L1: vBands    golden/dead cross zones (5-bar)       |
   |                                                         |
   | Foreground (zOrder='top'):                              |
   |   S-L2: divLines  divergence lines (MAX=4)              |
   |   S-L3: diamonds  MA cross markers (MAX=6)              |
   |   S-L4: stars     Tier-1 composites (MAX=2)             |
   |   +  vLabels      volume anomaly text labels            |
   +---------------------------------------------------------+

   Density Budget per Visible Range:
   +-------------------------------+
   | Patterns:       max 3         |
   | Extended Lines: max 5         |
   | Diamonds:       max 6         |
   | Stars:          max 2         |
   | Div Lines:      max 4         |
   | Recent bars:    last 50 only  |
   +-------------------------------+
```

**PatternRenderer layers.** L1 (glows): vertical stripes for single-candle
patterns, purple 6% opacity. L2 (brackets): rounded rects for multi-candle
patterns, same purple family. L3 (trendAreas): gradient fills for triangles/
wedges + pivot markers. L4 (polylines): necklines and convergence lines;
Bezier-smoothed for cup-and-handle U-curves. L5 (hlines): stop-loss (orange
dashed), target (mint dashed), neckline levels with HTS-style price tags.
L6 (connectors): hollow circles at H&S pivot points. L7 (labels): pattern
name (Korean), confidence %, Wc factor, outcome dot; zoom-adaptive font
10-12px with 6-attempt collision avoidance. L8 (forecastZones): 8-bar
projected move for patterns[0] only; alpha modulated by Wc and CI95 width.
L9 (extendedLines): off-screen pattern structures persisted as gold dashed
lines for panning context.

**SignalRenderer layers.** S-L1 (vBands): 5-bar translucent rectangles at
golden/dead cross events, zOrder 'bottom'. S-L2 (divLines): dashed lines
connecting divergent swing points, red/blue per Korean convention. S-L3
(diamonds): 45-degree rotated squares at MA cross locations, sized by strength
and Wc. S-L4 (stars): 5-point stars for Tier-1 composites, max 2 -- scarce
by design so they command attention.

> D2: S4_chart_rendering_v7.md SS 4.2.2-4.2.13, SS 4.3.1-4.3.6;
> .claude/rules/rendering.md.

---

## 5.4 Density Control

### 5.4.1 Why Limits Exist

Density limits are a readability constraint, not a performance optimization.
Canvas2D handles hundreds of shapes without frame drops. The problem is cognitive:
a chart with 15 labels, 20 divergence lines, and 8 forecast zones communicates
nothing. Limits force the same editorial judgment a senior chartist makes --
show the strongest signals, suppress the rest.

### 5.4.2 Zoom-Adaptive Pattern Limit

```
ZOOM-ADAPTIVE DENSITY
======================

   Visible bars    Max patterns   Rationale
   --------------- -------------- --------------------------
   <= 50           1              Close zoom: max detail,
                                  avoid label collision
   51 - 200        2              Standard: room for two
                                  non-overlapping labels
   > 200           3              Wide: patterns spread
                                  across more bars
   > 800           labels hidden  Pill badges unreadable
```

Active patterns (with live priceTarget or stopLoss) receive density priority
over historical patterns regardless of confidence.

### 5.4.3 Three-Stage Visibility Filter

1. **VizToggle filter** (appUI.js): 4-category user toggles (candle / chart /
   signal / forecast). Analysis always runs; filtering at render time only.
2. **Tier filter**: S + A reach canvas. B appears in panel only. D suppressed.
3. **Visible-range filter**: off-screen candle patterns skipped; off-screen
   chart patterns contribute structure lines to L9 only.

> D2: S4_chart_rendering_v7.md SS 4.2.3; .claude/rules/rendering.md.

---

## 5.5 Color System

### 5.5.1 Korean Directional Convention

Korean markets follow the opposite color convention from Western markets -- a
cultural tradition dating to the founding of the Korea Stock Exchange (1956),
where red signifies prosperity and blue signifies decline.

| Context       | Up / Buy       | Down / Sell    |
|---------------|----------------|----------------|
| Korean (KRX)  | Red `#E05050`  | Blue `#5086DC` |
| Western (NYSE)| Green          | Red            |

This applies to candlestick bodies, volume bars, sidebar price changes, and
signal diamonds. It does not apply to pattern overlays.

### 5.5.2 Pattern Color Independence

Pattern overlays avoid directional red/blue. A bullish engulfing and a bearish
engulfing use the same color family. Patterns are structural observations, not
directional recommendations -- color should not pre-judge confirmation status.

| Zone             | Color Family       | Purpose                  |
|------------------|--------------------|--------------------------|
| Chart patterns   | Mint (PTN_BUY/SELL)| Structural, neutral      |
| Candle patterns  | Purple (PTN_CANDLE)| Single-bar family marker |
| Forecast target  | Mint gradient      | Reward zone              |
| Forecast stop    | Orange gradient    | Risk zone                |
| Structure lines  | Silver (PTN_STRUCT)| Non-distracting neutral  |
| Extended lines   | Gold (ACCENT)      | Off-screen context       |
| Financial panel  | Green/blue         | Quality metric (D column)|

### 5.5.3 Dash Pattern Encoding

| Pattern  | Canvas         | Meaning                     |
|----------|----------------|-----------------------------|
| Solid    | `[]`           | Confirmed structure         |
| `[2,3]`  | Fine dash      | Reference / measurement     |
| `[5,3]`  | Standard dash  | Unconfirmed structure       |
| `[8,4]`  | Long dash      | Off-screen / projection     |

Confirmation status is readable at a glance: solid neckline = breakout
confirmed; `[5,3]` dashed = breakout pending.

> D2: .claude/rules/colors.md; S4_chart_rendering_v7.md SS 4.2.5-4.2.13.

---

## 5.6 ISeriesPrimitive Reconnection

### 5.6.1 The Problem

LWC v5.1 renders custom overlays via ISeriesPrimitive objects attached to a
specific series instance. When the user switches stocks or chart types, the
candleSeries is destroyed and recreated. Primitives pointing to the old series
become orphans -- draw calls silently fail. Three overlay systems
(PatternRenderer, SignalRenderer, DrawingTools) face this problem.

### 5.6.2 Reconnection Protocol

```
ISERIESPRIMITIVE RECONNECTION
===============================

   On every render() call:
   +---------------------------------------------+
   | 1. Identify target series:                  |
   |    Normal --> candleSeries                   |
   |    Line mode --> indicatorSeries._priceLine  |
   |    (guard: _priceLine may be null)           |
   +----------------------+----------------------+
                          |
                          v
   +---------------------------------------------+
   | 2. _attachedSeries === target?              |
   |    YES --> proceed to drawing                |
   |    NO  --> reconnect (steps 3-6)            |
   +----------------------+----------------------+
                          |  (NO)
                          v
   +---------------------------------------------+
   | 3. Detach old primitive (try/catch: old      |
   |    series may already be destroyed)          |
   | 4. Create new primitive instance             |
   | 5. Attach to target series                   |
   | 6. _attachedSeries = target                  |
   +---------------------------------------------+
```

The try/catch in step 3 handles rapid stock switching where `destroyAll()`
has already removed the old series. Line-mode null guard in step 1 defers
reconnection when `_priceLine` does not yet exist. The `destroyAll()` method
calls `cleanup()` on all three overlay systems before removing series,
ensuring ordered teardown when possible.

> D2: S4_chart_rendering_v7.md SS 4.2.1, SS 4.1.6; .claude/rules/rendering.md.

---

## 5.7 Detection-to-Display Funnel

```
DETECTION-TO-DISPLAY FUNNEL
=============================

   45 pattern types detected (Ch 3)
            |
   5-Tier gate: S(17)+A(22) pass --> 39
   B(36)+C(3)+D(12) suppressed
            |
   VizToggle user filter (4 categories)
            |
   Visible-range filter (on-screen only)
            |
   Density budget: max 3 patterns,
     6 diamonds, 2 stars, 4 divLines
            |
   9+4 layer stack: bottom-to-top draw
            |
   Color: direction-independent patterns,
     Korean red/blue for price signals
```

Each funnel stage reduces visual density while preserving the highest-value
information. The analyst sees 3-5 annotations on a typical chart -- enough
to act on, few enough to interpret at a glance.
