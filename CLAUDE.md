# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KRX Live Chart (CheeseStock) — Korean stock market (KOSPI/KOSDAQ) charting web app with 30+ pattern technical analysis. No build system, no bundler. Deployed to Cloudflare Pages at `cheesestock.pages.dev` / `cheesestock.co.kr`. Local dev: open `index.html` via HTTP server (VS Code Live Server or `npx serve`).

## Architecture

**No module system, no bundler, no package.json, no test framework.** All JS files use global variables. Script load order in `index.html` is critical — breaking it causes reference errors.

### Script Load Order (16 files, all `defer`)

```
colors.js → data.js → api.js → realtimeProvider.js → indicators.js → patterns.js → signalEngine.js → chart.js → patternRenderer.js → signalRenderer.js → backtester.js → sidebar.js → patternPanel.js → financials.js → drawingTools.js → app.js
```

See `.claude/rules/architecture.md` for file responsibilities table and data flow.

### CDN Dependencies

| Library | CDN | Version |
|---------|-----|---------|
| TradingView Lightweight Charts | unpkg.com | see `index.html` `<script>` tag |
| Pretendard (Korean font) | jsDelivr | see `index.html` `<link>` tag |
| JetBrains Mono | Google Fonts | — |

## Core Principles

- **Dual-mode required**: All features must work in both WS (real-time Kiwoom) and file (static JSON) modes. File mode first, WS upgrade in background. Domain detection in `api.js` for `cheesestock.co.kr`/`.pages.dev`→WSS, localhost→`ws://localhost:8765`.
- **Use `KRX_COLORS.*` or `var(--*)`** for all colors. See `.claude/rules/colors.md`.
- **Web Worker offloads analysis** — IndicatorCache contains functions (cannot postMessage). Pattern analysis throttled to 3s intervals.
- **Service Worker** (`sw.js`): Cache name `cheesestock-vN` (see `sw.js` line 8 for current value). Bump `CACHE_NAME` when deploying breaking changes.

## Key Patterns

- **Chart Lifecycle**: `_resizeMap` tracks ResizeObservers. Sub-charts have explicit `destroyRSI()`/`destroyMACD()`. Time scale sync via `_syncUnsubs` + `_rebuildSync()`.
- **Drawing tools active** → disable `handleScroll.pressedMouseMove` AND `handleScale.axisPressedMouseMove`.
- **Rendering**: See `.claude/rules/rendering.md` for 9 draw layers, ISeriesPrimitive reconnection, density limits.
- **Caching**: 3 layers — IndicatorCache (lazy-eval), chart.js `_indicatorCache` (key: length+time+close), Worker `_analyzeCache` (fingerprint).

## Development

No build step:
1. `python scripts/download_ohlcv.py` (first time, ~40 min)
2. `index.html` via HTTP server (`npx serve -l 5500 -s`)
3. Without `data/` folder, demo mode runs automatically

Verification (closest thing to lint/test):
```bash
python scripts/verify.py              # 5-category pre-deploy check (exit 0=pass)
python scripts/verify.py --strict     # Fail on warnings too
python scripts/verify.py --check colors   # Single category: colors/patterns/dashes/globals/scripts
```

Runtime checkpoints (F12 Console):
- `[KRX] index.json 로드 완료: N종목` — data layer initialized
- `[Worker] 분석 Worker 초기화 완료` — Web Worker ready
- Toast `N개 패턴 감지됨` — pattern pipeline working end-to-end

See `.claude/rules/scripts.md` for all script commands and deployment.

## WebSocket Server (Kiwoom OCX)

Start: `server\start_server.bat`. Full setup in `docs/developer-setup.md`.
- **KNOWSTOCK와 동시 실행 불가** — Kiwoom allows only 1 concurrent connection.
- **Respect single login limit** — Kiwoom locks accounts after 5 failed passwords (3-4 day unlock). Server has 7-layer protection. See `server/ws_server.py`.

## Collaboration

- **chart.js + patternRenderer.js** = technical analysis owner
- **css/style.css + index.html** = UI/design owner
- **app.js** = shared — coordinate before editing
- Stage specific files only (`git add js/file.js`). Use standard push with upstream tracking.
- Always `git pull` before starting work

## Timezone (KST = UTC+9)

- Daily candles: `"YYYY-MM-DD"` strings. Intraday: Unix timestamps (09:00 KST = 00:00 UTC).
- `generate_intraday.py` uses `calendar.timegm()` (NOT `datetime.timestamp()`).
- `tickMarkFormatter` and `timeFormatter` must handle both string dates and timestamps.
- Market hours: 09:00-15:30 KST.

## Common Pitfalls

- Serve via HTTP — `file://` causes CORS errors on `data/index.json`
- Sub-chart labels must be outside chart containers (LWC takes over container DOM)
- Line chart markers go on `indicatorSeries._priceLine`, not `candleSeries`
- `calcEMA([])`/`calcMACD()` with empty data need early returns to avoid NaN
- Both `tickMarkFormatter` and `timeFormatter` must handle `"YYYY-MM-DD"` strings
- Canvas DPR: `ctx.setTransform(1,0,0,1,0,0)` before `ctx.scale(dpr,dpr)`
- Wrangler `--commit-message` and `.bat` files: ASCII-only (Korean breaks both)
- Adding/removing JS files → update `sw.js` `STATIC_ASSETS` array too (cache miss = broken offline)

## Reference

- `.claude/rules/` — Detailed rules for architecture, colors, rendering, patterns, financial, scripts, UI layout
- `core_data/` — 24 academic documents (math, finance theory, pattern algorithms, APT, behavioral). Not loaded at runtime.
- `pattern_impl/` — 5 implementation bridge documents (theory→code mapping).
- `docs/` — Developer setup, QA checklist (100+ items). Note: `docs/deployment.md` describes old Lightsail setup — current deployment uses Cloudflare Pages.
