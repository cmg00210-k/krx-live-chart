# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KRX Live Chart (CheeseStock) — Korean stock market (KOSPI/KOSDAQ) charting web app with 30+ pattern technical analysis. No build system, no bundler. Deployed to Cloudflare Pages at `cheesestock.pages.dev` / `cheesestock.co.kr`. Local dev: open `index.html` via HTTP server (VS Code Live Server or `npx serve`).

## Architecture

**No module system, no bundler, no package.json, no test framework.** All JS files use global variables. Script load order in `index.html` is critical — breaking it causes reference errors.

### Script Load Order (19 files, all `defer`)

```
colors.js → data.js → api.js → realtimeProvider.js → indicators.js → patterns.js → signalEngine.js → chart.js → patternRenderer.js → signalRenderer.js → backtester.js → sidebar.js → patternPanel.js → financials.js → drawingTools.js → appState.js → appWorker.js → appUI.js → app.js
```

**app.js 4-split** (Phase C-1): `appState.js`(전역 상태/Tier), `appWorker.js`(Worker/분석), `appUI.js`(DOM/UX), `app.js`(init만)

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

## Deploy + Commit + Push Checklist (V48-SEC Phase 1 active)

**Always walk through these gates before `wrangler pages deploy` OR `git commit`.** Claude must surface these to the user and wait for confirmation on each, not auto-proceed.

### Pre-deploy gates (in order)

1. **Verify secrets**: `python scripts/verify.py --check ip` must pass (no IP JSON leaks)
2. **Bundle freshness**: if deploying `--bundled`, confirm `node scripts/build.mjs --minify --obfuscate` was run since last JS edit (check `deploy.bundled/manifest.json` timestamp)
3. **Source functions/_data/**: `stage_deploy.py` now auto-populates this; if running `wrangler pages deploy` manually without stage, the deploy WILL FAIL with "Could not resolve ../_data/*.json" — always stage first
4. **CACHE_NAME bump**: if any JS file changed, `sw.js` `CACHE_NAME` must be incremented or hash-bumped (`cheesestock-vN+1` or `cheesestock-v<hash>`)
5. **Git scope**: stage specific files (`git add path/to/file`), never `git add -A` or `git add .` — uncommitted V38/V39/... work can sneak in

### Cloudflare CDN cache: the stale-while-revalidate trap

`_headers` sets `/data/* Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. This means **when you REMOVE a file from deploy, the old cached content keeps serving for up to 24h** even after redeploy. This bit V48 Phase 1 (calibrated_constants.json leaked 17h after exclusion).

**If a deploy removes or restricts any file under `/data/`, immediately after deploy:**

- **Option A (fast, dashboard)**: dash.cloudflare.com → Websites → cheesestock.co.kr → Caching → Configuration → Custom Purge → paste exact URL(s) → Purge
- **Option B (CLI-friendly, autonomous)**: deploy a placeholder file at the same URL with a `{"moved":"/api/..."}` body. CF caches the placeholder, evicting the stale real content. Works without dashboard access. `scripts/stage_deploy.py` can be extended to auto-generate placeholders for removed paths.
- **Option C (hands-off)**: wait 6-8h for natural expiration. Acceptable only if content is non-sensitive.

Verification after any of A/B/C:

```bash
curl -o /dev/null -w "%{size_download}\n" https://cheesestock.co.kr/data/backtest/<FILE>
```

Size should match the NEW deployed content (43397B HTML fallback = safe, or small placeholder = safe). If it still matches the OLD file size, cache purge did not propagate — retry.

### Post-deploy gates (continued from above)

- **Gate 6 — Production smoke**: open `https://cheesestock.co.kr` in incognito, check for `[KRX] index.json 로드 완료: N종목` with N > 2000 and zero red Console errors
- **Gate 7 — IP endpoint check**: `curl -H "Origin: https://evil.com" https://cheesestock.co.kr/api/constants` must return 403; `curl -H "Origin: https://cheesestock.co.kr" ...` must return 200 with JSON
- **Gate 8 — Git push**: the agent cannot push directly to `main` (safety policy). Either push to a feature branch (`security/*`, `feat/*`, etc.) for user to merge, or have the user run `git push origin main` locally

### Claude behavior rule (for this project)

When the user asks "deploy" or "commit and push", Claude must:

- Show which files will be staged (run `git status --short`) and **pause for confirmation** if any file is outside the conversation's scope
- Show the exact `wrangler pages deploy` command and **pause for confirmation** before running
- After any `wrangler pages deploy` that excluded or modified `/data/backtest/*`, proactively run the CDN leak audit from Option C verification above
- Never push to `main` — always to a feature branch, then instruct the user on merge path

## Reference

- `.claude/rules/` — Detailed rules for architecture, colors, rendering, patterns, financial, scripts, UI layout
- `.claude/rules/quality-gates.md` — 5 quality gates: CHECK 6 pipeline, smoke test, change contract, ANATOMY-first, session start/end protocol
- `core_data/` — 24 academic documents (math, finance theory, pattern algorithms, APT, behavioral). Not loaded at runtime.
- `pattern_impl/` — 5 implementation bridge documents (theory→code mapping).
- `docs/` — Developer setup, QA checklist (100+ items). Note: `docs/deployment.md` describes old Lightsail setup — current deployment uses Cloudflare Pages.
