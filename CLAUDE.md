# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KRX Live Chart (CheeseStock) — a Korean stock market (KOSPI/KOSDAQ) charting web app with 26-pattern technical analysis. No build system, no bundler. Deployed to Cloudflare Pages at `cheesestock.pages.dev` / `cheesestock.co.kr`. Local dev: open `index.html` in browser or VS Code Live Server.

## Architecture

**No module system.** All JS files use global variables and classes. Script load order in `index.html` is critical:

```
colors.js → data.js → api.js → realtimeProvider.js → indicators.js → patterns.js → signalEngine.js → chart.js → patternRenderer.js → signalRenderer.js → backtester.js → sidebar.js → patternPanel.js → financials.js → drawingTools.js → app.js
```

Breaking this order causes reference errors (e.g., `ALL_STOCKS` from api.js is used in app.js, `patternRenderer` from patternRenderer.js is used in chart.js/app.js).

### File Responsibilities (16 JS files)

| File | Globals Exported | Role | Lines |
|------|-----------------|------|-------|
| `js/colors.js` | `KRX_COLORS` | Frozen color constants (30+) — UP/DOWN, PTN_BUY(mint)/PTN_CANDLE(purple)/PTN_SELL, TAG_BG(alpha), indicator colors (STOCH_K/D, CCI, ADX, WILLR, ATR_LINE), PTN_INVALID | 60 |
| `js/data.js` | `PAST_DATA`, `getPastData()`, `getFinancialData()` | Historical financial data; async loader tries `data/financials/{code}.json` first, falls back to hardcoded/seed data | 160 |
| `js/api.js` | `_idb`, `KRX_API_CONFIG`, `ALL_STOCKS`, `DEFAULT_STOCKS`, `TIMEFRAMES`, `dataService` | Data service layer (ws/file/demo, 2,700+ stocks from index.json, L1 memory + L2 IndexedDB + L3 network 3-tier caching, marketCap/sector fields) | 420 |
| `js/realtimeProvider.js` | `realtimeProvider` | WebSocket client for Kiwoom OCX server, demo fallback | 230 |
| `js/indicators.js` | `calcMA()`, `calcEMA()`, `calcBB()`, `calcRSI()`, `calcMACD()`, `calcATR()`, `calcIchimoku()`, `calcKalman()`, `calcHurst()`, `calcWLSRegression()`, `_invertMatrix()`, `IndicatorCache` | 9 technical indicators + WLS regression engine + lazy-evaluation cache with VMA/volRatio | 888 |
| `js/patterns.js` | `patternEngine` | PatternEngine class — 26 patterns (17 candle + 8 chart + S/R) with ATR normalization, quality scoring | 1488 |
| `js/signalEngine.js` | `COMPOSITE_SIGNAL_DEFS`, `signalEngine` | SignalEngine class — 16 indicator signals (5 categories) + 6 composite signals (3 tiers) + divergence detection | 1129 |
| `js/chart.js` | `chartManager` | ChartManager class using TradingView Lightweight Charts v4.2.3 (indicators delegated to indicators.js) | 697 |
| `js/patternRenderer.js` | `patternRenderer` | ISeriesPrimitive-based HTS-grade Canvas pattern visualization v3.1 (glows, brackets, trendAreas, polylines, hlines, labels, connectors, forecastZones) with 3-tier visibility filtering and label collision avoidance | 1400+ |
| `js/signalRenderer.js` | `signalRenderer` | ISeriesPrimitive-based Canvas signal visualization (diamonds, stars, vbands, divergence lines, volume highlight) | 469 |
| `js/backtester.js` | `backtester` | PatternBacktester class — per-pattern N-day return statistics + WLS regression return prediction + backtest panel rendering | 517 |
| `js/analysisWorker.js` | (Web Worker) | Offloads pattern + signal + backtest analysis to Web Worker thread; loads colors/indicators/patterns/signalEngine/backtester via importScripts | 103 |
| `js/sidebar.js` | `sidebarManager` | Collapsible sidebar with KOSPI/KOSDAQ stock lists, virtual scroll (2700+ stocks, ~40 DOM), accordion sections | 87 |
| `js/patternPanel.js` | `PATTERN_ACADEMIC_META`, `renderPatternPanel()`, `renderPatternCards()`, etc. | 27-pattern academic metadata + pattern UI panel (summary bar, history table, return curve, cards) | 770 |
| `js/financials.js` | `updateFinancials()`, `drawFinTrendChart()`, `drawOPMSparkline()`, etc. | Financial panel (D column): PER/PBR/PSR, CAGR, investment score, trend charts, sparklines | 510 |
| `js/drawingTools.js` | `drawingTools` | Left vertical toolbar + ISeriesPrimitive drawing overlay (trendline, hline, vline, rect, fib, eraser) with localStorage persistence per stock | 480 |
| `js/app.js` | (none — side effects only) | State management, UI event binding, initialization, Web Worker orchestration | 1650 |

### File Dependency Graph

```
colors.js ← (no deps — loaded first, provides KRX_COLORS)
  ↓
data.js ← (no deps)
  ↓
api.js ← data.js (PAST_DATA)
  ↓
realtimeProvider.js ← api.js (KRX_API_CONFIG, dataService)
  ↓
indicators.js ← (no deps — pure math functions)
  ↓
patterns.js ← indicators.js (calcATR for internal _calcATR cross-reference)
  ↓
signalEngine.js ← indicators.js (IndicatorCache), patterns.js (patternEngine)
  ↓
chart.js ← indicators.js (calcMA, calcEMA, ...), colors.js (KRX_COLORS)
  ↓
patternRenderer.js ← chart.js (chartManager.candleSeries)
  ↓
signalRenderer.js ← chart.js (chartManager.candleSeries, volumeSeries)
  ↓
backtester.js ← patterns.js (patternEngine.analyze), indicators.js (calcATR, calcMA, calcWLSRegression)
  ↓
sidebar.js ← api.js (ALL_STOCKS)
  ↓
patternPanel.js ← colors.js (KRX_COLORS), backtester.js (backtester)
  ↓
financials.js ← data.js (getFinancialData), colors.js (KRX_COLORS), sidebar.js (sidebarManager)
  ↓
drawingTools.js ← chart.js (chartManager.candleSeries — ISeriesPrimitive attach)
  ↓
app.js ← all of the above (orchestrates everything)

analysisWorker.js ← (Web Worker, separate context)
  importScripts: colors.js, indicators.js, patterns.js, signalEngine.js, backtester.js
```

### Key Patterns

- **ChartManager** uses `_resizeMap` (Map) to track ResizeObservers per container, preventing memory leaks.
- **Sub-charts** (RSI, MACD) have explicit `destroyRSI()` / `destroyMACD()` methods that clean up observers and rebuild time scale sync.
- **Time scale sync** across main/RSI/MACD charts uses `_syncUnsubs` array; `_rebuildSync()` unsubscribes all before re-subscribing.
- **Pattern analysis** is throttled to 3-second intervals (`_lastPatternAnalysis` in app.js) to avoid performance issues.
- **Pattern button** uses class `.pattern-btn` and is excluded from indicator handlers via `.ind-btn:not(.pattern-btn)`.
- **PatternRenderer** (v3.1) uses ISeriesPrimitive plugin API for Canvas2D HTS-grade drawing. 9 draw layers (glows → brackets → trendAreas → polylines → hlines → connectors → labels → forecastZones → extendedLines). Max 5 patterns (`MAX_PATTERNS`), 3-tier visibility filtering (candle patterns: visible-only, chart patterns: extend structure lines when off-screen, S/R: always visible). Forecast Zones show target/stop areas with gradient fills and return % text. Pattern colors use dedicated `KRX_COLORS.PTN_BUY` (mint) / `PTN_SELL` (lavender) — distinct from main UP/DOWN colors.
- **SignalRenderer** uses same ISeriesPrimitive pattern with dual PaneViews (bg `zOrder='bottom'` for vbands, fg `zOrder='top'` for diamonds/stars/divlines). Also highlights volumeSeries colors for breakout bars.
- **SignalEngine** builds an `IndicatorCache` internally for lazy indicator computation, then runs 5 signal categories + composite matching + sentiment scoring.
- **IndicatorCache** (indicators.js) uses lazy evaluation — each indicator computed only on first access, cached until `setCandles()` or `invalidate()` is called.
- **Web Worker** (`analysisWorker.js`) offloads heavy analysis (pattern + signal + backtest) off the main thread. Messages use `version` field for stale-result rejection.
- **KRX_COLORS** (colors.js) centralizes all color constants; JS files should reference `KRX_COLORS.UP` instead of hardcoding `'#E05050'`. Pattern-specific colors (`PTN_BUY`, `PTN_SELL`, `PTN_STRUCT`, `PTN_STOP`, `PTN_TARGET`) are separate from chart UP/DOWN colors.
- **Virtual Scroll** (sidebar.js v11.0) renders only ~40 DOM elements for 2700+ stocks. `.sb-body` is the scroll container; `#sb-all` contains a spacer div (total height) + absolute-positioned content div. `_renderVisibleItems()` recalculates on scroll via rAF throttling. Item height varies by view mode (42px default, 56px analysis).
- **Service Worker** (`sw.js`) provides offline caching. Cache-First for static assets (JS/CSS/HTML), Network-First for data files (`data/*.json`), stale-while-revalidate for CDN resources. WebSocket connections are not intercepted. Cache version `cheesestock-v2`.
- **index.html** uses 4-column grid layout: A=sidebar (collapsible stock list with sort/filter), B=chart area + return stats, C=pattern panel (academic cards), D=financial panel (PER/PBR/ROE/CAGR/score). Responsive breakpoints at 1200px, 1024px, 768px, 480px.
- **Visualization Toggle System** (`vizToggles` in app.js): 4-category filter (candle/chart/signal/forecast) with `[표시 ▼]` dropdown. Analysis engine runs regardless of toggles; filtering happens at render time via `_filterPatternsForViz()`. Centralized render via `_renderOverlays()`.
- **Dual Color System for Patterns**: Candle patterns use `PTN_CANDLE` (purple `#B388FF`), chart patterns use `PTN_BUY` (mint). Labels, fills, and borders follow this split. Forecast zones are mint-only.
- **Indicator Cache** (chart.js `_indicatorCache`): Caches MA/EMA/BB/Ichimoku etc. keyed by `candles.length + lastTime + lastClose`. Prevents redundant O(n) recomputation when `updateMain()` is called multiple times with same data.
- **Worker Analysis Cache** (analysisWorker.js `_analyzeCache`): Caches pattern/signal results by candle fingerprint. Drag-repeat and rapid stock re-selection skip re-analysis.

### Data Flow

```
app.js init() → dataService.initFromIndex() → loads data/index.json → populates ALL_STOCKS

dataService.getCandles(stock, timeframe)
  → file mode + 1d: fetch data/{market}/{code}.json
  → file mode + intraday: demo fallback (분봉 JSON 없음)
  → ws mode + connected: 서버 subscribe 응답 (서버 측 Kiwoom TR, 일봉 pykrx 폴백)
  → ws mode + disconnected: 일봉=file 폴백, 분봉=서버 재연결 대기
  → candles[] (OHLCV array)

Analysis path (main thread or Web Worker):
  → patternEngine.analyze(candles)           → patterns[] (26 types)
  → signalEngine.analyze(candles, patterns)  → { signals[], cache, stats }
  → backtester.backtestAll(candles)          → backtestResults[]

Rendering path:
  → chartManager.updateMain(candles, chartType, indicators, patterns, indParams)
    → _renderOverlays():
      → _filterPatternsForViz(detectedPatterns)  // vizToggles filter
      → patternRenderer.render(chartManager, candles, chartType, filteredPatterns)
      → signalRenderer.render(chartManager, candles, filteredSignals)
  → chartManager.updateRSI(candles) / updateMACD(candles) / etc.
```

### Data Modes

- **ws** (default): Kiwoom OCX WebSocket 서버 연결. `server/ws_server.py`가 PyQt5 + QAxWidget으로 Kiwoom OpenAPI+ OCX에 직접 연결. 실시간 체결(OnReceiveRealData), 일봉/분봉 TR 조회. `server/start_server.bat`로 서버 시작.
- **file**: Loads real OHLCV from `data/kospi/`, `data/kosdaq/` JSON files. Daily from local JSON, intraday from `{code}_{timeframe}.json` (generated by `generate_intraday.py`). Falls back to daily data if intraday file missing. Stock list from `data/index.json` (~2,733 stocks).
- **demo**: Deterministic simulated data using stock code hash as random seed.

`data/` folder is partially in `.gitignore`. Tracked in git: `data/index.json` (2,733 stock list), `data/kospi/*.json` and `data/kosdaq/*.json` (top 55 stocks daily + intraday for 6 timeframes). Full data (~2,736 stocks) generated locally by `scripts/download_ohlcv.py` and deployed to Cloudflare Pages via `wrangler pages deploy`.

### WebSocket Server (Kiwoom OCX)

```
Architecture:
  Main Thread:  PyQt5 QApplication + Kiwoom OCX (QAxWidget)
  WS Thread:    asyncio + websockets server (port 8765)
  Communication: queue.Queue (WS → Main), broadcast() (Main → WS)
```

Requirements:
- Python 3.9 32-bit (default: `%LOCALAPPDATA%\Programs\Python\Python39-32`, override: `KRX_PYTHON32` env var)
- PyQt5 (32-bit)
- Kiwoom OpenAPI+ OCX registered (`C:\OpenAPI\khopenapi.ocx`)
- Kiwoom HTS logged in

```bash
server\start_server.bat
```

The server provides:
- **WebSocket** `ws://localhost:8765` — subscribe/unsubscribe protocol for real-time candle + tick data
- KOSPI/KOSDAQ index real-time via OnReceiveRealData (업종지수)
- DataProvider abstraction: KiwoomProvider (current) / KoscomProvider (stub)

**KNOWSTOCK(kiwoom_project)와 동시 실행 불가** — Kiwoom 동시 접속 1개 제한. Screen numbers 2000~2999 사용 (KNOWSTOCK과 겹치지 않음).

### Downloading Stock Data (OHLCV)

```bash
python scripts/download_ohlcv.py              # All stocks, 1 year (default)
python scripts/download_ohlcv.py --years 3    # 3 years
python scripts/download_ohlcv.py --market KOSPI  # KOSPI only
python scripts/download_ohlcv.py --code 005930   # Single stock
python scripts/download_ohlcv.py --cron        # Unattended mode (log to file, exit codes)
```

Requires: `pip install pykrx FinanceDataReader`

Output: `data/kospi/*.json`, `data/kosdaq/*.json`, `data/index.json`

`--cron` flag: No interactive prompts, logs to `logs/download_YYYYMMDD_HHMMSS.log`, returns exit code 0/1.

### Generating Intraday Candles (Interpolation)

```bash
python scripts/generate_intraday.py                    # All stocks, all timeframes
python scripts/generate_intraday.py --code 005930      # Single stock
python scripts/generate_intraday.py --timeframe 5m     # 5-minute candles only
python scripts/generate_intraday.py --days 10          # Last 10 days only
```

Generates intraday candle JSON from daily OHLCV using Brownian bridge interpolation. Supported timeframes: `1m`, `5m`, `15m`, `30m`, `1h`. Uses `calendar.timegm()` for UTC timestamp generation (KST-safe). Output: `data/{market}/{code}_{timeframe}.json` (e.g., `data/kospi/005930_5m.json`).

### Daily Update Script (Cron/Scheduler)

```bash
scripts\daily_update.bat    # Run manually or via Windows Task Scheduler
```

Runs 3 steps: OHLCV download (cron mode) -> intraday generation (5m) -> index price update (offline).

Register with Task Scheduler: `schtasks /create /sc daily /tn "KRX_DailyUpdate" /tr "...\daily_update.bat" /st 16:00`

### Downloading Financial Statements (DART)

```bash
python scripts/download_financials.py --api-key YOUR_DART_KEY          # All stocks
python scripts/download_financials.py --api-key YOUR_KEY --code 005930 # Single stock
python scripts/download_financials.py --api-key YOUR_KEY --top 100     # Top 100
python scripts/download_financials.py --demo                           # No API key (dummy data)
```

Requires: `pip install requests` (+ pykrx/FinanceDataReader for stock list)

Output: `data/financials/{code}.json` — quarterly + annual financial data

**DART OpenAPI key:**
1. Visit https://opendart.fss.or.kr/
2. Sign up / Login
3. Go to "인증키 신청/관리" menu
4. Apply for API key (instant approval)
5. Use with `--api-key YOUR_KEY`

Without `data/financials/` folder, the app uses hardcoded data (Samsung/SK Hynix) or seed-based dummy data for other stocks. Run `--demo` mode for quick testing without an API key.

## Deployment (Cloudflare Pages)

Static files are deployed to Cloudflare Pages (`cheesestock.pages.dev`). WebSocket relay runs on seth1's PC via Cloudflare Tunnel (`wss://ws.cheesestock.co.kr/ws`).

```bash
# Manual deploy (from project root)
wrangler pages deploy . --project-name cheesestock --branch main --commit-dirty=true --commit-message="deploy"

# Automated daily deploy (장 마감 후)
scripts\daily_deploy.bat    # OHLCV download → intraday gen → wrangler deploy
```

Desktop shortcuts on seth1's PC:
- **CheeseStock Server** — Kiwoom login + WS server start
- **CheeseStock Daily Update** — Data refresh + Cloudflare deploy

Windows Task Scheduler: `CheeseStock_HourlyDeploy` runs `daily_deploy.bat` every hour 09:30-16:05 Mon-Fri.

### Dual-Mode Architecture

- **실시간 (WS)**: seth1's Kiwoom server ON → all users get real-time data via WS broadcast
- **파일 (file)**: seth1's server OFF → static JSON from Cloudflare CDN (직전 영업일까지)
- Mode auto-detection: `api.js` probes `wss://ws.cheesestock.co.kr/ws` (non-blocking, 3s timeout). File mode first, WS mode upgrade in background.
- Domain detection: `api.js` checks `window.location.hostname` for `cheesestock.co.kr` / `.pages.dev` → sets WSS URL automatically. localhost → `ws://localhost:8765`.
- **All features must work in both WS and file modes.** Never create server-dependent features without file-mode fallback.

## Dual Developer Setup

Two developers each run their own Kiwoom OCX server independently:
- **seth1**: Production server (Cloudflare Tunnel → `wss://ws.cheesestock.co.kr`)
- **최민규**: Local development (`ws://localhost:8765`)
- Both have independent Kiwoom accounts (동일 계정 동시 로그인 불가)
- DART API keys: each developer registers their own at https://opendart.fss.or.kr/
- Python path: set `KRX_PYTHON32` env var if not default location (see `docs/developer-setup.md`)
- Git workflow: feature branches → merge to main

## Collaboration Rules (from GUIDE.md)

- **chart.js + patternRenderer.js** = technical analysis owner
- **css/style.css + index.html** = UI/design owner
- **app.js** = shared — coordinate before editing
- Never `git add .` — stage specific files only
- Never `git push --force`
- Always `git pull` before starting work

## Color System (한국식)

Centralized in `js/colors.js` as `KRX_COLORS` frozen object. CSS variables in `:root`.

| Purpose | JS Constant | CSS Variable | Hex |
|---------|------------|-------------|-----|
| 상승/매수 | `UP` | `--up` | `#E05050` (빨강) |
| 하락/매도 | `DOWN` | `--down` | `#5086DC` (파랑) |
| 중립 | `NEUTRAL` | `--neutral` | `#ffeb3b` |
| 구조선/accent | `ACCENT` | `--accent` | `#A08830` |
| 재무 양호 | — | `--fin-good` | `#6BCB77` (초록) |
| 차트 패턴 | `PTN_BUY` | — | mint `rgba(150,220,200)` |
| 캔들 패턴 | `PTN_CANDLE` | — | purple `#B388FF` |
| 태그 배경 | `TAG_BG(alpha)` | — | `rgba(19,23,34,alpha)` |
| 패턴이탈선 | `PTN_INVALID` | — | `#FF6B35` (오렌지) |

**Rule**: 차트 좌측 = 빨강/파랑(방향), 재무 우측 = 초록/파랑(수준). 패턴 = 민트(차트)/보라(캔들). Never hardcode hex — always use `KRX_COLORS.*` or `var(--*)`.

## Academic Documents (core_data/)

16 markdown documents + README (Korean with English terms) providing mathematical foundations for the technical analysis system. These are documentation only — not loaded at runtime.

| # | File | Domain |
|---|------|--------|
| 01 | mathematics | Probability, stochastic processes, moving average theory |
| 02 | statistics | Time series, regression, Bayesian inference |
| 03 | physics | Econophysics, power laws, Hurst exponent |
| 04 | psychology | Prospect theory, herding, cognitive biases |
| 05 | finance_theory | EMH, AMH, MPT, CAPM, Black-Scholes |
| 06 | technical_analysis | Dow theory, Elliott waves, candlestick patterns, S/R |
| 07 | pattern_algorithms | Swing points, trend fitting, pattern math, quality scores, harmonics |
| 08 | references | Bibliography |
| 09 | game_theory | Nash equilibrium, signaling, auction theory |
| 10 | optimal_control | HJB, Merton portfolio, Kalman filter |
| 11/11B | reinforcement_learning | MDP, DQN, PPO, multi-agent RL |
| 12 | extreme_value_theory | GEV, GPD, tail risk |
| 13 | information_geometry | Fisher info, KL divergence, natural gradient |
| 14 | finance_management | Kelly criterion, VaR, position sizing |
| 15 | advanced_patterns | CNN/LSTM pattern recognition, backtesting math |
| 16 | pattern_reference | 42-pattern visual guide + color system |

Formulas have been verified and corrected for:
- VaR/ES formulas (EVT), Kelly criterion (continuous version), ATR normalization
- Unit clarification (sigma types, RSI units, VaR holding period, Sharpe annualization)
- Outdated theory warnings (ARIMA, CAPM, DQN, prospect theory parameters)

## Implementation Documents (pattern_impl/)

5 documents bridging academic theory to code implementation:

| # | File | Purpose |
|---|------|---------|
| 01 | theory_pattern_mapping | Academic doc → code location traceability |
| 02 | candle_patterns | 42-pattern census: implemented vs pending, algorithm definitions |
| 03 | composite_signals | Candle + indicator composite signal design (6 definitions) |
| 04 | implementation_map | Line-by-line code location mapping for all 3 engines |
| 05 | pipeline_analysis | Strengths/weaknesses analysis, improvement roadmap |

## Development

No build step. To develop:
1. `python scripts/download_ohlcv.py` (first time — downloads stock data, ~40 min)
2. Open `index.html` in a browser (or use VS Code Live Server)
3. Select **일봉** timeframe to see real data; intraday uses demo data
4. Check F12 Console for `[KRX] index.json 로드 완료: N종목` message
5. Without `data/` folder, demo mode runs automatically with simulated data

## Timezone (KST = UTC+9)

All timestamps must be KST-aware:
- **Daily candles**: `"YYYY-MM-DD"` strings — no timezone issue
- **Intraday candles**: Unix timestamps where 09:00 KST = 00:00 UTC. `generate_intraday.py` uses `calendar.timegm()` (NOT `datetime.timestamp()` which double-subtracts on KST machines)
- **chart.js `tickMarkFormatter`**: Converts UTC timestamps to KST for X-axis labels. Handles string dates, businessDay objects, and Unix timestamps with try/catch fallback.
- **chart.js `timeFormatter`**: Same KST conversion for crosshair tooltip.
- **Market hours**: 09:00-15:30 KST (pre-market 08:00, after-hours 15:30-16:00)

## Common Pitfalls

- Adding `<script>` tags out of order breaks everything — see dependency graph above
- All scripts use `defer` attribute — execution order is preserved but download is parallel
- Sub-chart labels must be **outside** chart containers (Lightweight Charts takes over container DOM)
- Markers in line chart mode must be set on `indicatorSeries._priceLine`, not `candleSeries`
- `calcEMA([])` and `calcMACD()` with empty valid data need early returns to avoid NaN propagation
- File mode candles use `"YYYY-MM-DD"` string dates (not Unix timestamps) — Lightweight Charts v4.2+ supports both. **Both `tickMarkFormatter` and `timeFormatter` must handle string dates.**
- `patternRenderer` must re-attach primitive when `candleSeries` is recreated (tracked via `_attachedSeries`)
- `analysisWorker.js` uses `importScripts()` — only loads indicators/patterns/signalEngine/backtester (no DOM-dependent files)
- `IndicatorCache` objects contain functions — they cannot be sent via `postMessage` (structured clone fails)
- **Canvas DPR**: All canvas drawing functions (financials.js) must call `ctx.setTransform(dpr,0,0,dpr,0,0)` before `ctx.scale()` to prevent DPR accumulation on repeated calls
- **Wrangler deploy**: `--commit-message` must be ASCII — Korean characters in git commit messages cause Cloudflare API `Invalid commit message` error
- **bat files**: Must use ASCII-only text — Korean in bat files breaks on Windows cmd.exe (CP949 vs UTF-8)
- **Drawing tools**: When active, `handleScroll.pressedMouseMove` AND `handleScale.axisPressedMouseMove` must be disabled, or LWC consumes click events for scrolling instead of forwarding to `subscribeClick`

## Known Bugs (from 2026-03-19 audit)

See `memory/audit_20260319.md` for full 5-agent audit. Critical items:
1. `financials.js:607,757,1257` — Canvas DPR scale accumulates (charts distort on HiDPI after stock switch)
2. `app.js:1312` — Missing `indParams` in Worker callback `updateMain()` call
3. `app.js:updateChartFull()` — Missing `_renderOverlays()` call at end
