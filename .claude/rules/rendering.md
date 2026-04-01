# Rendering Rules

## PatternRenderer — 9 Draw Layers (order is fixed)
1. glows — single candle vertical stripes (purple 0.12)
2. brackets — multi-candle rounded rects (purple 0.12)
3. trendAreas — triangle/wedge gradient fills + pivot markers
4. polylines — W/M/neckline connections (smooth option)
5. hlines — S/R, stop/target horizontal lines + price labels
6. connectors — H&S empty circles + shoulder connections
7. labels — HTS-style pill badges (Pretendard 12px 700) + collision avoidance
8. forecastZones — target/stop gradients + R:R vertical bar
9. extendedLines — off-visible structure line extensions (accent gold, dash [8,4])

## ISeriesPrimitive Reconnection (CRITICAL)
When `candleSeries` is recreated (stock change, chart type switch):
- Check `_attachedSeries !== targetSeries`
- Detach old primitive (try/catch), create new, attach to new series
- Line mode: attach to `cm.indicatorSeries._priceLine` (may be null — guard)
- patternRenderer, signalRenderer, drawingTools all use same pattern

## SignalRenderer — Dual PaneView
- Background (`zOrder='bottom'`): vertical bands (golden/dead cross)
- Foreground (`zOrder='top'`): diamonds, stars, divergence lines, volume labels

## Density Limits
MAX_PATTERNS=3, MAX_EXTENDED_LINES=5, MAX_DIAMONDS=6, MAX_STARS=2,
MAX_DIV_LINES=4, RECENT_BAR_LIMIT=50

## Canvas2D Safety
- `ctx.save()`/`ctx.restore()` must be paired
- Reset `ctx.setLineDash([])` and `ctx.globalAlpha = 1` after changes
- Coordinate null check: `ts.timeToCoordinate()` and `series.priceToCoordinate()` can return null
- Off-screen skip: x < -20 or x > w+20
- DPR: `ctx.setTransform(1,0,0,1,0,0)` before `ctx.scale(dpr,dpr)` (prevents accumulation)

## Visualization Toggles
`vizToggles` in app.js: 4-category filter (candle/chart/signal/forecast).
Analysis runs regardless; filtering at render time via `_filterPatternsForViz()`.
