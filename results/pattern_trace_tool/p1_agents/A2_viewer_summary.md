---
agent: A2 (pattern-analysis-renderer)
task: A-MVP debug viewer — 4 files in debug/
date: 2026-04-21
---

## LOC per file

| File | LOC |
|------|-----|
| `debug/pattern-trace.html` | 72 |
| `debug/traceStyles.css` | 375 |
| `debug/traceCanvas.js` | 840 |
| `debug/tracePanel.js` | 295 |
| `debug/pattern-trace.js` | 328 |
| **Total** | **1,910** |

## Schema fields not rendered (gaps for Session 2/3)

- `preAnalyze.indicatorCacheSummary.ma20.last` — rendered ATR14 + RSI14 only; full cache keys not enumerated (panel shows what's present)
- `l2[]` steps (per-detection gate trace array) — schema present, not rendered in D3 since MVP trace has empty `nearMiss[]`; D3 layer skeleton implemented and ready
- `l3.pValue` + `l3.bhFdrThreshold` — captured in schema, not yet displayed in panel cards (Session 2 stat panel)
- `l3.antiPredictor` + `l3.inverted` — warning shown in panel but no dedicated canvas layer
- `replayTrace.events[]` — schema parsed, not yet used for event-driven replay (Session 2 tail-follow mode)
- `postPipeline.signals[]` + `signalTrace[]` — not rendered (signalRenderer scope, Session 3)
- Near-miss rejection X mark (D8 spec) — skeleton for `nearMissMap` present, X mark deferred to Session 2 when `traceLevel='mid'` populates `nearMiss[]`

## KRX_COLORS keys referenced

- `KRX_COLORS.UP` / `KRX_COLORS.DOWN` — D1 candle up/down bodies and wicks
- `KRX_COLORS.ACCENT` — D2 S/R band lines and price axis labels
- `KRX_COLORS.PTN_BUY_FILL` / `PTN_SELL_FILL` / `PTN_NEUTRAL_FILL` — D4 detected zone fill at alpha 0.18
- `KRX_COLORS.TAG_BG` — D8 pill badge background
- `KRX_COLORS.CHART_BG` / `CHART_TEXT` / `CHART_GRID_HORZ` — background and grid
- `KRX_COLORS.PTN_SELL` (via PTN_SELL_FILL) — bearish family zones

**2 new colors justified:**
- `#888888` / `rgba(136,136,136,0.10)` (D3 near-miss gray): no KRX_COLORS semantic for rejected/near-miss state
- `rgba(255,180,0,0.7)` (D5 confluence amber arrow): no KRX_COLORS entry for confluence annotation; closest is ACCENT (#A08830) but that is a golden-brown used for S/R labels — a brighter amber distinguishes the dynamic confluence annotation from static S/R

## ResizeObserver + DPR handling

- `ResizeObserver` is attached to `canvas.parentElement` in `traceCanvas.js` `_initResize()`. Falls back to `window.addEventListener('resize', ...)` for browsers without ResizeObserver.
- DPR: `_resize()` calls `ctx.setTransform(1,0,0,1,0,0)` to reset any accumulated transform, then `ctx.scale(dpr,dpr)`. `canvas.width/height` set to `Math.round(clientW * dpr)`. All layout calculations use `canvas.width / dpr` for logical pixel coordinates.
- `_prepareLayout()` recomputes `candleW` on every render from current canvas logical width, so DPR changes are transparent.

## Known limitations

- **>250 bars**: `barsVisible` capped at 120; `viewOffset` starts at `bars.length - 120`. No pan/scroll gesture (mouse wheel not implemented — Session 2). Horizontal navigation via scrubber or arrow keys only.
- **D7 confidence bar positioning**: rows are spaced by `chartH / (patternCount + 1)` with a fixed base Y; if many patterns (>8) rows may overlap. Session 2 should add a scrollable row layout.
- **D5 arrowhead direction**: uses `bars[det.barIndex].close` as origin Y; if close is very far from S/R level the arrow may extend off-screen — clipping to `chartTop/chartBottom` not yet applied.
- **D2 S/R price label overlap**: multiple levels close in price can overlap labels; no collision avoidance applied to axis labels.
- **Playback speed**: Shift+Space toggles 10x but does not show a speed indicator in the UI (Session 2 UX).
- `tracePanel.js` was already present in `debug/` from a prior agent; file was overwritten with the new implementation.
