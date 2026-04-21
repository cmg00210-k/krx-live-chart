---
agent: A2 (pattern-analysis-renderer)
task: Session 2 — live-scan viewer mode + M1/M2/M3 fixes + setTailFollow/destroy
date: 2026-04-21
branch: feat/pattern-trace-tool-s2
---

## LOC delta per file

| File | Before | After | Delta |
|------|--------|-------|-------|
| `debug/pattern-trace.js` | 332 | 834 | +502 |
| `debug/pattern-trace.html` | 72 | 81 | +9 |
| `debug/traceCanvas.js` | 846 | 897 | +51 |
| `debug/traceStyles.css` | 375 | 434 | +59 |
| **Total** | **1,625** | **2,246** | **+621** |

## Production globals consumed (read-only)

| Global | Source file | How used |
|--------|------------|----------|
| `KRX_API_CONFIG` | `js/api.js` | Set `.wsUrl` and `.mode` before `realtimeProvider.start()` |
| `dataService` | `js/api.js` | `dataService.getCandles(stockObj, tf)` for seed candle bootstrap |
| `realtimeProvider` | `js/realtimeProvider.js` | `.onTick(cb)` registration, `.start()`, `.stop()`, `.onConnectionChange` |
| `KRX_COLORS` | `js/colors.js` | Already used by traceCanvas; M2 fix adds `KRX_COLORS.UP` for clamp indicator |
| `TIMEFRAMES` | `js/api.js` | Loaded but not directly referenced; available for future tf validation |
| `ALL_STOCKS` | `js/api.js` | Loaded but not referenced; available for stock name lookup |

Script load order in pattern-trace.html: `colors.js → data.js → api.js → realtimeProvider.js → traceCanvas.js → tracePanel.js → pattern-trace.js`. Mirrors production load order for the 4 shared globals.

## Changes per file

### pattern-trace.js (Session 2 live-scan orchestrator)

- URL params: `?source=`, `?code=` (default 005930), `?market=` (default KOSPI), `?tf=` (default 1d)
- `_applySourceMode()`: adds connection-dot span to badge; repurposes session2Banner as live status line
- `_setConnectionState(state)`: drives `.connection-dot` class (`connected`/`reconnecting`/`failed`), badge pulse animation
- `_updateLiveBannerStatus()`: renders `[live] @ CODE · N bars · HH:MM:SS KST · mode · tf`
- `_initLiveScan()` (async): step-by-step bootstrap —
  1. Checks `typeof dataService/KRX_API_CONFIG/realtimeProvider` — falls back to file-drop if missing
  2. Sets `KRX_API_CONFIG.wsUrl` to `ws://localhost:8765` (kiwoom) or `wss://cheesestock.co.kr` (wss)
  3. `dataService.getCandles(stockObj, tf)` with `KRX_API_CONFIG.mode = 'file'` for seed
  4. Validates seed >= 50 bars; warns but continues if not
  5. `_initLiveWorker()` — creates `new Worker('./pattern-trace-worker.js')` once
  6. `_scheduleLiveAnalysis()` if seed >= 50
  7. Switches mode to `'ws'`, registers `onConnectionChange`, calls `realtimeProvider.start()`
- `_onTick(tick)`: handles both full `tick.candles[]` seed (WS candles message) and incremental price ticks; updates/appends last bar using `dayOpen/dayHigh/dayLow/currentPrice/volume`
- `_scheduleLiveAnalysis()`: 3000ms debounce using `setTimeout`/cancellation; posts `{type:'trace', candles, stockCode, market, timeframe, traceLevel:'mid', requestId}` to Worker
- `_onLiveTraceResult(trace)`: calls `_applyTrace()` + tail-follow scrubber advance + `_updateLiveBannerStatus()`
- `_tailFollow` flag: default `true` in live modes; scrubber `input` event sets it to `false`; `[live] Follow` button toggles back
- `_createFollowButton()`: injects button before play-hint in scrubber wrap
- `_cleanup()`: `beforeunload` handler — unsubs tick listener, `realtimeProvider.stop()`, clears debounce timer, `_liveWorker.terminate()`, `traceCanvas.destroy()`
- `window.__trace_getLiveCandles()` console helper exposed
- `onTick(_onTick)` registered exactly once per session (verified by grep); unsubscribe fn stored in `_liveTickUnsubscribe`

### pattern-trace.html

- Added `data.js`, `api.js`, `realtimeProvider.js` script tags before `traceCanvas.js`
- Replaced `style="display:none"` on `#session2-banner` with CSS class `.banner-hidden`
- Added `title` + `aria-label` to file input element (IDE accessibility diagnostic)
- `<label for="trace-file-input">` explicit association added

### traceCanvas.js (M1/M2/M3 + setTailFollow + destroy)

**M1 (L176)**: `ctx.fillStyle = isUp ? color : color` → `ctx.fillStyle = color` (dead ternary removed)

**M2 (L502-506)**: Rewritten clamp indicator:
- Reads cap from `trace.preAnalyze.regime.dynamicATRCap` (correct path per hook.js:319)
- Only activates if cap is a `typeof === 'number'` (skips `{_unavailable:true}` at A-MVP)
- Requires `l3.confidencePath` to exist AND at least one stage `|delta| == cap` (tolerance 0.01)
- Uses `KRX_COLORS.UP` instead of hardcoded `#E05050` (L1 fix bundled)

**M3 (L781-795)**:
- `_initResize()` now guards with `if (_resizeObserver) return` — no double-init
- `destroy()` exposed on public API:
  - `_resizeObserver.disconnect()` (guarded by existence)
  - Falls back to `window.removeEventListener('resize', _resize)` for non-ResizeObserver path
  - `canvas.removeEventListener('mousemove', _onMouseMove)` and `'mouseleave'`
  - Mouse handlers are module-level named functions (not arrow closures) — identity stable for `removeEventListener`
  - Does NOT touch canvas DOM element (viewer lifecycle owns that)

**setTailFollow(bool)**:
- Stores `_state.tailFollow`
- `load()` checks `_state.tailFollow` — if true and bars.length > 0, auto-sets `scrubberBar` and `viewOffset` to tail

**_state extension**: `tailFollow: false` added at module init (before `_initResize()`)

### traceStyles.css (source-badge + connection-dot)

- `.banner-hidden { display: none }` — replaces inline style on session2-banner
- `.connection-dot` base: 7px circle, `margin-left: 5px`, `vertical-align: middle`
- `.connection-dot.connected`: `#26a69a` green (matches `--badge-kiwoom` token)
- `.connection-dot.reconnecting`: `#f59e0b` amber + `dot-pulse` animation + `will-change: transform`
- `.connection-dot.failed`: `var(--up)` red (KRX convention)
- `@keyframes badge-pulse`: opacity + transform (no box-shadow — composited)
- `@keyframes dot-pulse`: transform scale only (composited)
- `.badge.wss.pulsing` / `.badge.kiwoom.pulsing`: apply badge-pulse + `will-change: opacity, transform`
- `.follow-btn`: default gray pill; `.active` state blue (rgba(41,98,255,0.18))

## V48 Phase 3 HMAC barrier — production-wss behavior

The debug viewer does NOT hold the HMAC secret used by V48 Phase 3. When `?source=production-wss`:

1. `KRX_API_CONFIG.wsUrl = 'wss://cheesestock.co.kr'` is set
2. `realtimeProvider.start()` calls `new WebSocket('wss://cheesestock.co.kr')`
3. The server-side HMAC gate (ws_server.py) will reject an unauthenticated connection
4. `ws.onclose` fires; `realtimeProvider` emits `onConnectionChange('reconnecting')` then eventually `'failed'` after `_wsMaxReconnect=20` attempts
5. The viewer logs the close code via `console.log('[RealtimeProvider] WebSocket 닫힘 (code=%d)', event.code)`
6. After max retries, banner shows: `[연결 실패] WS 재연결 실패. 기존 N 봉 데이터로 계속 사용 가능.`
7. Seed candles (from file-mode `dataService.getCandles`) remain usable for file-replay analysis

**Expected WS close code**: 1006 (abnormal closure — TCP refused before WebSocket handshake) or 1008/4000 (server policy rejection). The exact code is unverified until P4 smoke test since the server endpoint behavior for unauthenticated WS is implementation-specific.

**Implication**: `production-wss` mode in the debug viewer is effectively file-replay-with-seed until the server exposes an unauthenticated read-only ticker endpoint. The connection attempt is logged; the viewer degrades gracefully.

## Scope reductions from plan spec

| Plan item | Status | Note |
|-----------|--------|------|
| `realtimeProvider.connect(url)` call | Changed to `realtimeProvider.start(stockObj, tf)` | `connect()` is not a public method; plan had pseudocode. `start()` is the correct API per realtimeProvider.js L53 |
| Worker `{type:'tickAppend', tick}` message | Not implemented | Worker's `pattern-trace-worker.js` (A1-owned) handles `{type:'trace'}` for full re-analysis. Tick-level streaming into Worker would require A1 changes — out of scope |
| Horizontal scroll / pan gesture | Not added | A-MVP limitation; Session 2 scope was live-scan only |
| `dataService.initFromIndex()` call | Not called | Not needed — `getCandles()` works without index init when data/ files exist |

## Self-verification

- `grep -r "fetch(" debug/pattern-trace.js debug/traceCanvas.js` → 0 results (no direct fetch in these files; all network via dataService)
- `grep -n "document\." debug/pattern-trace.js` → 15 results, all own DOM IDs (`trace-dropzone`, `trace-file-input`, `trace-scrubber`, `trace-scrubber-label`, `source-badge`, `trace-meta-summary`, `session2-banner`, `trace-canvas-wrap`, `trace-scrubber-wrap`, `trace-play-hint`, `trace-follow-btn`); zero production DOM IDs
- `grep -n "onTick" debug/pattern-trace.js` → 3 lines: declaration (L59), handler def (L564), single registration (L734) — no duplicates
- `realtimeProvider.start()` called once inside `_initLiveScan()` — no re-entrant start without prior stop
