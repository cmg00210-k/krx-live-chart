# Stage 4 — Canvas Layer Specification
## PatternRenderer 9-Layer Pipeline

**Last updated:** 2026-04-06
**File:** `js/patternRenderer.js`
**Class:** `PatternRenderer.draw()` → called from `PatternPaneView.renderer()`

---

## Overview

All 9 layers execute inside a single `target.useMediaCoordinateSpace(scope => { ... })` call. The outer `ctx.save()` wraps all layers; `ctx.restore()` is the final call. Layers execute in strict order — earlier layers are visually behind later ones.

**Coordinate system:** Media coordinates (logical pixels). `scope.mediaSize.width` and `.height` give canvas dimensions. `ts.timeToCoordinate(time)` and `series.priceToCoordinate(price)` convert data space to pixel space — both can return `null` if the value is outside the visible range.

**Data structure:** `PatternPaneView.update()` populates a single `data` object passed to `PatternRenderer`:
```javascript
data = {
  glows: [],          // Layer 1
  brackets: [],       // Layer 2
  trendAreas: [],     // Layer 3 (also used for small filled polygon markers)
  polylines: [],      // Layer 4
  hlines: [],         // Layer 5
  connectors: [],     // Layer 6
  labels: [],         // Layer 7
  forecastZones: [],  // Layer 8
  _extendedLines: [], // Layer 9
  _visibleBars: 200,  // zoom state passed through for adaptive sizing
}
```

---

## Layer 1 — Glows

**Purpose:** Single-candle pattern highlight. A vertical stripe behind the candle body.

**Builder:** `_buildSingleGlow(candles, p, toXY, data.glows)`

**Input patterns:** All keys in `SINGLE_PATTERNS` (13 patterns):
`hammer`, `invertedHammer`, `hangingMan`, `shootingStar`, `doji`, `dragonflyDoji`, `gravestoneDoji`, `longLeggedDoji`, `spinningTop`, `bullishMarubozu`, `bearishMarubozu`, `bullishBeltHold`, `bearishBeltHold`

**Data item:**
```javascript
{
  x: number,         // candle center x (from candle high coordinate)
  y1: number,        // top y (candle high pixel)
  y2: number,        // bottom y (candle low pixel)
  width: 14,         // stripe width in pixels
  fill: string,      // rgba — KRX_COLORS.PTN_CANDLE_FILL(0.06) or PTN_NEUTRAL_FILL(0.06)
  border: string,    // KRX_COLORS.PTN_CANDLE or PTN_NEUTRAL
}
```

**Color logic:**
- Neutral patterns (`doji`, `spinningTop`, `longLeggedDoji`): `PTN_NEUTRAL_FILL(0.06)` fill, `PTN_NEUTRAL` border
- All others: `PTN_CANDLE_FILL(0.06)` fill (`rgba(179,136,255,0.06)`), `PTN_CANDLE` (`#B388FF`) border

**Canvas operations:**
```javascript
ctx.fillStyle = g.fill;
ctx.fillRect(rx, ry, glowW, rh);         // rx = x - width/2, ry = min(y1,y2)

ctx.strokeStyle = g.border;
ctx.lineWidth = 1;
ctx.globalAlpha = 0.25;
ctx.beginPath();
ctx.rect(rx, ry, glowW, rh);
ctx.stroke();
ctx.globalAlpha = 1;
```

**Off-screen skip:** `g.x < -20 || g.x > w + 20`

**Null check:** `g.x == null || g.y1 == null || g.y2 == null`

---

## Layer 2 — Brackets

**Purpose:** Multi-candle pattern group highlight. A rounded rectangle bounding the pattern's candle range.

**Builder:** `_buildBracket(candles, p, toXY, data.brackets)`

**Input patterns:** All keys in `ZONE_PATTERNS` (21 patterns):
`threeWhiteSoldiers`, `threeBlackCrows`, `bullishEngulfing`, `bearishEngulfing`, `bullishHarami`, `bearishHarami`, `morningStar`, `eveningStar`, `piercingLine`, `darkCloud`, `tweezerBottom`, `tweezerTop`, `threeInsideUp`, `threeInsideDown`, `bullishHaramiCross`, `bearishHaramiCross`, `stickSandwich`, `abandonedBabyBullish`, `abandonedBabyBearish`, `risingThreeMethods`, `fallingThreeMethods`

**useBody flag:** Harami patterns (`bullishHarami`, `bearishHarami`, `bullishHaramiCross`, `bearishHaramiCross`) use the first candle's body (open/close) instead of full high/low range.

**Data item:**
```javascript
{
  x1: number, y1: number,   // top-left pixel
  x2: number, y2: number,   // bottom-right pixel
  fill: string,             // KRX_COLORS.PTN_CANDLE_FILL(0.06)
  border: string,           // KRX_COLORS.PTN_CANDLE
}
```

**Canvas operations:**
```javascript
ctx.fillStyle = br.fill;
ctx.beginPath();
_roundRect(ctx, rx, ry, rw, rh, 4);   // radius=4px
ctx.fill();

ctx.strokeStyle = br.border;
ctx.lineWidth = 1;
ctx.globalAlpha = 0.25;
ctx.beginPath();
_roundRect(ctx, rx, ry, rw, rh, 4);
ctx.stroke();
ctx.globalAlpha = 1;
```

**Off-screen skip:** `br.x2 < 0 || br.x1 > w`

**Note:** `_roundRect(ctx, x, y, w, h, r)` does NOT call `ctx.beginPath()` internally. Callers must open a path first.

---

## Layer 3 — Trend Areas

**Purpose:** Filled polygons for multiple uses:
1. Triangle/wedge gradient fill (convergence zone)
2. Small filled triangle/diamond markers (pattern pivot points, breakout markers)
3. Cup-and-handle cup fill (called via `_buildCupAndHandle`)

**Builder:** Various pattern builders push to `data.trendAreas`

**Data item:**
```javascript
{
  points: [{x, y}, ...],   // polygon vertices (minimum 3)
  fill: string,            // fill color
}
```

**Canvas operations:**
```javascript
const validPts = pts.filter(p => p.x != null && p.y != null);
if (validPts.length < 3) return;
if (validPts.every(p => p.x < 0) || validPts.every(p => p.x > w)) return;

ctx.beginPath();
ctx.moveTo(validPts[0].x, validPts[0].y);
for (let i = 1; i < validPts.length; i++) ctx.lineTo(validPts[i].x, validPts[i].y);
ctx.closePath();
ctx.fillStyle = ta.fill || KRX_COLORS.PTN_NEUTRAL_FILL(0.04);
ctx.fill();
```

**No stroke — fill only.** No ctx.save/restore in this layer (alpha unchanged).

**Usage as markers:**
- `doubleBottom` trough markers: 3-point upward triangle, `fill: BUY_COLOR` (`rgba(150,220,200,0.65)`)
- `doubleTop` peak markers: 3-point downward triangle, `fill: SELL_COLOR`
- `breakIndex` diamond markers (4-point rotated square): used by doubleBottom, doubleTop, H&S, cupAndHandle
- `cupAndHandle` bottom marker: upward triangle

**Triangle/wedge area fill:**
- `ascendingTriangle`, `descendingTriangle`, `symmetricTriangle`: 4-point quadrilateral `[u1, u2, l2, l1]`, `fill: BUY_FILL` (`rgba(150,220,200,0.12)`)
- `risingWedge`, `fallingWedge`: same structure, direction-dependent color

---

## Layer 4 — Polylines

**Purpose:** Connected line segments for pattern structure lines (necklines, W/M shape, cup U-curve, convergence lines, boundary segments).

**Builder:** Pattern-specific builders (`_buildDoubleBottom`, `_buildDoubleTop`, `_buildHeadAndShoulders`, `_buildTriangle`, `_buildWedge`, `_buildCupAndHandle`, etc.)

**Data item:**
```javascript
{
  points: [{x, y}, ...],  // minimum 2 points
  color: string,
  width: number,          // default 1.5
  dash: number[],         // [] = solid, [5,3] = standard dashed, etc.
  smooth: boolean,        // optional: quadratic curve smoothing
  dots: boolean,          // optional: endpoint circle markers
}
```

**Canvas operations (straight):**
```javascript
ctx.beginPath();
ctx.moveTo(pts[0].x, pts[0].y);
for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
ctx.strokeStyle = pl.color;
ctx.lineWidth = pl.width || 1.5;
ctx.setLineDash(pl.dash || []);
ctx.stroke();
ctx.setLineDash([]);
```

**Canvas operations (smooth — `pl.smooth === true`):**
```javascript
ctx.moveTo(pts[0].x, pts[0].y);
for (let i = 1; i < pts.length - 1; i++) {
  const xc = (pts[i].x + pts[i+1].x) / 2;
  const yc = (pts[i].y + pts[i+1].y) / 2;
  ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
}
ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
```
Used by `cupAndHandle` for the U-curve (~15 sample points).

**Endpoint dots:**
```javascript
ctx.fillStyle = pl.color;
pts.forEach(p => {
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
});
```

**Color conventions:**
| Pattern | Upper line | Lower line |
|---------|-----------|-----------|
| ascendingTriangle | `SELL_COLOR` (mint) | `BUY_COLOR` (mint) |
| descendingTriangle | `SELL_COLOR` | `BUY_COLOR` |
| symmetricTriangle | `SELL_COLOR` | `BUY_COLOR` |
| risingWedge | `SELL_COLOR` | `GOLD_COLOR` |
| fallingWedge | `GOLD_COLOR` | `BUY_COLOR` |
| doubleBottom boundary | `BUY_COLOR` | `BUY_COLOR` |
| doubleTop boundary | `BUY_COLOR` | `BUY_COLOR` |
| H&S neckline | `neckColor` (mint if break confirmed, else GOLD) | — |
| cupAndHandle U-curve | `BUY_COLOR`, width=2, smooth | — |

Note: `BUY_COLOR` and `SELL_COLOR` are both `rgba(150,220,200,0.65)` (mint) per the unified color design — direction is conveyed by label text and position, not color.

**Off-screen skip:** `pts.every(p => p.x < 0)` or `pts.every(p => p.x > w)`

---

## Layer 5 — Horizontal Lines (hlines)

**Purpose:** Horizontal reference lines for S/R levels, necklines, stop-loss, price targets, and pattern invalidation levels.

**Builder:** `_buildStopTarget()` for stop/target; pattern builders for necklines; also populated by double bottom/top neckline.

**Data item:**
```javascript
{
  y: number,              // pixel y coordinate (from series.priceToCoordinate)
  x1: number,             // left x (defaults to 0)
  x2: number,             // right x (defaults to canvas width)
  color: string,
  width: number,          // default 1
  dash: number[],         // default [5,3]
  priceLabel: string,     // optional: price text in tag badge
  marker: string,         // optional: 'stop'|'target'|'invalid' → triangle/diamond at right end
}
```

**Canvas operations:**
```javascript
ctx.beginPath();
ctx.moveTo(x1, hl.y);
ctx.lineTo(x2, hl.y);
ctx.strokeStyle = hl.color;
ctx.lineWidth = hl.width || 1;
ctx.setLineDash(hl.dash || [5, 3]);
ctx.stroke();
ctx.setLineDash([]);
```

**Price label (HTS-style tag):**
```javascript
ctx.font = "700 12px 'JetBrains Mono', monospace";
// Tag background: KRX_COLORS.TAG_BG(0.92)
// Tag border: hl.color, lineWidth 0.8
// Text: hl.color, textAlign 'left', textBaseline 'middle'
// Position: right-justified, minimum 60px from right edge
```

**Marker triangles/diamond:**
- `'stop'`: downward triangle at `w-50` (▼ — 손절 indication)
- `'target'`: upward triangle at `w-50` (▲ — 목표 indication)
- `'invalid'`: diamond at `w-50` (◆ — 패턴이탈)

**Color mapping:**
| Line type | Color constant | Dash |
|-----------|---------------|------|
| Stop-loss | `KRX_COLORS.PTN_STOP` `rgba(255,107,53,0.55)` | `[8,4]` |
| Price target | `KRX_COLORS.PTN_TARGET` `rgba(150,220,200,0.55)` | `[8,4]` |
| Invalidation | `KRX_COLORS.PTN_INVALID` `#FF6B35` | `[5,3]` |
| Neckline (unconfirmed) | `GOLD_COLOR` = `KRX_COLORS.PTN_STRUCT` | `[5,3]` |
| Neckline (confirmed) | `BUY_COLOR` = `KRX_COLORS.PTN_BUY` | `[]` solid |

**Null check:** `hl.y == null`

---

## Layer 6 — Connectors

**Purpose:** H&S shoulder/head hollow circle markers; cup-and-handle rim circles; also straight line segments with optional endpoint dots.

**Builder:** `_buildHeadAndShoulders()` and `_buildCupAndHandle()` push to `data.connectors`

**Data item (hollow circle mode):**
```javascript
{
  hollowCircle: true,
  circleX: number,     // center x
  circleY: number,     // center y
  circleR: 4,          // radius px
  circleWidth: 1.5,    // stroke width
  color: string,
  // other fields ignored in circle mode
}
```

**Data item (line mode):**
```javascript
{
  points: [{x,y}, ...],
  color: string,
  width: number,
  dash: number[],      // default [2,3]
  alpha: number,       // default 0.5
  showDots: boolean,
}
```

**Canvas operations (hollow circle):**
```javascript
ctx.beginPath();
ctx.arc(cn.circleX, cn.circleY, cn.circleR || 4, 0, Math.PI * 2);
ctx.strokeStyle = cn.color;
ctx.lineWidth = cn.circleWidth || 1.5;
ctx.stroke();
return;  // early return — skip line drawing
```

**Canvas operations (line):**
```javascript
ctx.beginPath();
ctx.moveTo(pts[0].x, pts[0].y);
for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
ctx.strokeStyle = cn.color;
ctx.lineWidth = cn.width || 1;
ctx.setLineDash(cn.dash || [2, 3]);
ctx.globalAlpha = cn.alpha || 0.5;
ctx.stroke();
ctx.globalAlpha = 1;
ctx.setLineDash([]);
```

**H&S extreme finding:** `_findExtreme(slice, priceKey, 'min'|'max')` scans a candle slice for the lowest/highest candle. Three circles per pattern: left shoulder, head, right shoulder. Color: `BUY_COLOR` (inverse H&S) or `SELL_COLOR` (H&S).

---

## Layer 7 — Labels

**Purpose:** HTS-style pill badge labels identifying each pattern with name, confidence%, Wc factor, and outcome indicator.

**Builder:** `_buildLabel(candles, p, toXY, data.labels)` — called for every pattern

**Data item:**
```javascript
{
  x: number,           // center x (midpoint of pattern range)
  y: number,           // computed pixel y from pattern high/low + offset
  placement: string,   // 'top' | 'bottom'
  text: string,        // e.g. "이중바닥 82% W1.23" or "이중바닥 (확인) 82%"
  color: string,       // border/text color
  bgColor: string,     // KRX_COLORS.TAG_BG(0.88)
  confidence: number,
  outcome: string,     // 'active' | 'hit' | 'failed' | null
  wc: number,
  decayAlpha: number,  // 1.0 for active, fades after 10 bars post-completion
  _patternType: string,
}
```

**Label text format:** `{nameKo} {quality%}%` optionally + ` W{wc.toFixed(2)}` if wc != 1 + ` (확인)` if necklineBreakConfirmed. Uses `p.quality` (preferred) or `p.confidence` for percentage.

**Label color assignment:**
- Candle patterns: `PTN_CANDLE` (`#B388FF`) — except `doji` which uses `PTN_NEUTRAL`
- Bullish chart patterns: `BUY_COLOR` (`rgba(150,220,200,0.65)`)
- Bearish chart patterns: `SELL_COLOR` (same mint)
- Neutral chart patterns: `NEUTRAL_COLOR` (`rgba(200,200,200,0.55)`)

**Y position:** 24px below pattern low (bullish) or 24px above pattern high (bearish). Passed as `lb.y`; collision avoidance shifts it further.

**Zoom suppression:** Labels hidden when `_visibleBars > 800`.

**Canvas operations (condensed):**

1. Font: `700 {fontSize}px 'Pretendard', sans-serif` (fontSize: 10-12px zoom-adaptive)
2. Measure text: `ctx.measureText(lb.text)`
3. Collision avoidance: up to 6 shift attempts
4. Pill background: `_roundRect` with `TAG_BG(0.88)` fill
5. Left color bar: 3px wide left-rounded rect in `lb.color`
6. Border: `globalAlpha = agingAlpha`, `lineWidth = 1.8` (active) or `wc`-scaled (others); dashed if `confidence < 50`
7. Text: `globalAlpha = textAlpha` (0.55 if `confidence < 35`, else agingAlpha)
8. Outcome dot: `arc(dotX, labelY, r, 0, 2π)`: gold stroke (active), `KRX_COLORS.UP` fill (hit), `KRX_COLORS.DOWN` fill (failed)
9. Reset: `globalAlpha = 1`, `lineWidth = 1`, `setLineDash([])`

**Outcome caching:** `_outcomeCache` (Map) keyed by `type+'_'+endIndex`, stores `{outcome, checkedLength}`. Invalidated when `candles.length` changes.

**Pattern aging decay:** Hit/failed patterns: `decayAlpha = max(0.25, 1.0 - (age-10)*0.05)` where `age = candles.length - 1 - endIndex`. Active patterns: `decayAlpha = 1.0`.

---

## Layer 8 — Forecast Zones

**Purpose:** Autochartist-style predicted move visualization. Rendered only for `patterns[0]` (highest confidence pattern).

**Builder:** `_buildForecastZone(candles, p, toXY, ts, data.forecastZones)`

**Zone geometry:** `fzStart = p.endIndex`, `fzEnd = min(endIndex+8, candles.length-1)`. If `fzEnd <= fzStart` (last bar pattern), extends 8 bar-widths to the right using estimated bar spacing.

**Data item:**
```javascript
{
  x1: number, x2: number,    // horizontal span
  yEntry: number,            // entry price pixel y
  yTarget: number | null,    // target price pixel y
  yStop: number | null,      // stop price pixel y
  wc: number,                // adaptive weight [0,1]
  ciAlpha: number,           // CI95-based opacity [CI_ALPHA_MIN, 1.0]
  returnText: string,        // e.g. "+8.3%"
  returnColor: string,       // BUY_COLOR or SELL_COLOR
  probWinRate: number | null,// backtested win rate %
  stopColor: string,         // KRX_COLORS.PTN_STOP
  targetFillNear: string,    // KRX_COLORS.FZ_TARGET_NEAR
  targetFillFar: string,     // KRX_COLORS.FZ_TARGET_FAR
  stopFill: string,          // KRX_COLORS.FZ_STOP_NEAR
  targetBorder: string,      // KRX_COLORS.FZ_TARGET_BORDER
  rrRatio: number | null,
  offScreenTarget: boolean,  // true if yTarget is off-screen (null)
  isBuy: boolean,
  entry: number,
  stopPrice: number | null,
}
```

**Alpha computation:**
```javascript
var wcAlpha = fz.wc != null ? Math.min(0.4 + 0.5 * fz.wc, 1.0) : 1.0;
var ciAlpha = fz.ciAlpha != null ? fz.ciAlpha : 1.0;
var fzAlpha = Math.max(0.18, wcAlpha * ciAlpha);
ctx.globalAlpha = fzAlpha;
```

**Canvas operations — Target zone:**
```javascript
const tGrad = ctx.createLinearGradient(0, fz.yEntry, 0, fz.yTarget);
tGrad.addColorStop(0, KRX_COLORS.FZ_TARGET_NEAR);   // rgba(150,220,200,0.22)
tGrad.addColorStop(1, KRX_COLORS.FZ_TARGET_FAR);    // rgba(150,220,200,0.05)
ctx.fillStyle = tGrad;
ctx.fillRect(zoneX, tY, zoneW, tH);
```

Return % text: centered in zone, `700 11px Pretendard`, `TAG_BG(0.75)` background.
Win rate text: 10px below return %, shown only when `sampleSize >= 10` and within zone bounds.
Win rate color: `PTN_BUY` (>60%), `NEUTRAL` (40-60%), `DOWN` (<40%).

**Canvas operations — Stop zone:**
```javascript
const stopGrad = ctx.createLinearGradient(zoneX, fz.yEntry, zoneX, fz.yStop);
stopGrad.addColorStop(0, KRX_COLORS.FZ_STOP_NEAR);   // rgba(255,107,53,0.15)
stopGrad.addColorStop(1, KRX_COLORS.FZ_STOP_FAR);    // rgba(255,107,53,0.03)
ctx.fillStyle = stopGrad;
ctx.fillRect(zoneX, sY, zoneW, sH);
```

Stop % text: centered in zone, computed as `(|entry - stopPrice| / entry * 100).toFixed(1)`.

**Canvas operations — R:R vertical bar:**
- Bar x position: `fz.x2 + 6`
- Target segment: `FZ_TARGET_BORDER` color, 2.5px width
- Stop segment: `PTN_STOP` color, 2.5px width
- Entry dot: white (`#fff`) filled circle, 2.5px radius — this is the only hardcoded hex in the rendering pipeline (finding F2 in S4_chart_rendering.md)
- R:R label: `700 10px Pretendard`, `TAG_BG(0.80)` background, `PTN_BUY` text if ratio ≥ 1.5 else `PTN_TARGET`

**Off-screen target fallback:**
When `yTarget` is null (target off visible area), draws a direction arrow at chart edge:
- Buy: arrow at top (`edgeY = 6`, direction up)
- Sell: arrow at bottom (`edgeY = h-6`, direction down)
Arrow: filled triangle 7px wide × 6px tall. Label: return % pill below/above arrow.
Uses `ctx.save()/ctx.restore()` for this sub-block.

**CI95 opacity formula:**
```javascript
var CI_REF = 5.5;          // [D-tier — pending promotion]
ciAlpha = max(0.15, min(1.0, 1 - ci95Width / (2 * CI_REF)));
```
Linear decay: 0% width → alpha 1.0; 11% width → alpha 0.0 (clamped to 0.15).

**Wc alpha formula:**
```javascript
wcAlpha = min(0.4 + 0.5 * wc, 1.0);   // wc=0 → 0.4, wc=1 → 0.9, wc=1.2 → 1.0
```

---

## Layer 9 — Extended Lines

**Purpose:** Off-visible-range chart patterns contribute necklines and trendlines to the current view as gold accent dashed lines.

**Source:** `extendedLines` array passed to `PatternPrimitive.setPatterns()` from `appUI.js`/`appWorker.js`. These are patterns outside the visible range whose structure lines (necklines, wedge boundaries) still have meaning in the current view.

**Data item:**
```javascript
{
  points: [{x, y}, ...],   // pixel coordinates (at least 2)
  isNeckline: boolean,
  patternType: string,
  patternName: string,
}
```

**Canvas operations:**
```javascript
ctx.save();
ctx.globalAlpha = 0.35;
ctx.strokeStyle = KRX_COLORS.ACCENT;   // #A08830 gold
ctx.lineWidth = 1.5;
ctx.setLineDash([8, 4]);               // LONG dash pattern

if (line.isNeckline) {
  const avgY = (p1.y + p2.y) / 2;
  ctx.beginPath();
  ctx.moveTo(0, avgY);
  ctx.lineTo(w, avgY);
  ctx.stroke();
} else {
  // Slope-extrapolate to screen edges
  const slope = (p2.y - p1.y) / (p2.x - p1.x);
  // extStartY = p1.y + slope * (0 - p1.x)
  // extEndY = p1.y + slope * (w - p1.x)
  // Y clamped to [-h, 2h] to prevent degenerate lines
  ctx.beginPath();
  ctx.moveTo(extStartX, extStartY);
  ctx.lineTo(extEndX, extEndY);
  ctx.stroke();
}
ctx.setLineDash([]);
ctx.restore();
```

Each extended line uses its own `ctx.save()/ctx.restore()` pair (unlike other layers which share the outer save).

**Color:** Always `KRX_COLORS.ACCENT` (`#A08830`) gold — direction-neutral, purely structural.

**Density limit:** `MAX_EXTENDED_LINES = 5` enforced before lines are passed to the renderer.

---

## Helper: `_roundRect(ctx, x, y, w, h, r)`

Shared by `patternRenderer.js` and `signalRenderer.js` (both define their own copy).

```javascript
function _roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r];
  const [tl, tr, br, bl] = r;
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}
```

**Critical:** Does NOT call `ctx.beginPath()`. Every caller must open a path before calling this.

Per-corner radius: pass array `[tl, tr, br, bl]`. Left color bar uses `[radius, 0, 0, radius]`.

---

## Chart Pattern Builder Reference

| Pattern | Layers used | Key structure |
|---------|-------------|--------------|
| `doubleBottom` | polylines (2 vertical borders), hlines (neckline), trendAreas (2 trough ▲, optional break ◆) | `p.neckline`, `p.necklineBreakConfirmed`, `p.breakIndex` |
| `doubleTop` | polylines (2 vertical borders), hlines (neckline), trendAreas (2 peak ▼, optional break ◆) | `p.neckline`, `p.necklineBreakConfirmed`, `p.breakIndex` |
| `headAndShoulders` | polylines (neckline + extensions), trendAreas (optional break ◆), connectors (3 hollow circles) | `p.trendlines[0]`, `p.necklineBreakConfirmed` |
| `inverseHeadAndShoulders` | same | same |
| `ascendingTriangle` | polylines (2 boundary lines), trendAreas (fill) | `p.trendlines[0]`, `p.trendlines[1]` |
| `descendingTriangle` | same | same |
| `symmetricTriangle` | same | same |
| `risingWedge` | polylines (2 boundary lines), trendAreas (fill) | `p.trendlines[0]`, `p.trendlines[1]` |
| `fallingWedge` | same | same |
| `channel` | same as triangle | same |
| `cupAndHandle` | polylines (U-curve smooth), brackets (handle box), connectors (2 rim circles), trendAreas (bottom ▲, optional break ◆), hlines (neckline) | `p.bottomIndex`, `p.handleFound`, `p.neckline` |

All chart patterns also receive: labels (Layer 7), forecastZone if patterns[0] (Layer 8).

---

## Canvas State Invariants (End of draw())

After `PatternRenderer.draw()` completes, the canvas state must satisfy:

| Property | Required value | How guaranteed |
|----------|---------------|----------------|
| `globalAlpha` | 1.0 | Explicit reset in label loop, at end of forecast zone |
| `lineWidth` | 1 | Explicit reset in label loop |
| `setLineDash` | `[]` | Reset after every stroked path |
| `textAlign` | last set value (not reset) | Callers set before each text draw |
| `ctx.save/restore` | balanced | Outer save/restore + individual extended line save/restore |

**The outer `ctx.restore()` at the end of `draw()` restores the state to what it was before `draw()` was called, including any properties not explicitly reset.**
