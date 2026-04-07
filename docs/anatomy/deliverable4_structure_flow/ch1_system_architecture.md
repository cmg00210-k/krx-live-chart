# Chapter 1: System Architecture Overview

> **Deliverable 4 — Structure Flow | Chapter 1 of 4**
> **Version**: V7 (2026-04-07)
> **Source authority**: `S5_lifecycle_workers_v7.md`, `S5_ui_architecture_v7.md`,
> `S0_index_v7.md`, `deliverable1_executive/P0_executive_summary.md`
> **Tone**: CFA paper grade — precise, quantitative, citation-backed

---

## 1.1 Platform Identity

CheeseStock (cheesestock.co.kr) is a browser-native technical analysis platform
covering all 2,696 listed securities on the Korea Exchange (KRX: KOSPI and KOSDAQ).
The platform provides real-time charting, automated detection of 45 pattern types
(패턴 탐지), a 10-function macro-to-microstructure confidence chain, and a complete
K-IFRS financial panel — all within a single-page web application that requires no
installation and carries zero server-side business logic.

Three design choices define the architecture and constrain every subsequent decision:

1. **No build system**: All JavaScript executes directly in the browser. There is no
   webpack, rollup, esbuild, or transpiler. Global variables in load-order sequence
   replace module imports.

2. **Dual-mode operation**: Every code path must function in both WebSocket (실시간,
   live Kiwoom OCX feed) and file (정적 JSON, static data) modes. File mode is the
   default; WebSocket is a background upgrade that never blocks the initial render.

3. **Fail-forward degradation**: Missing or stale data reduces analytical depth but
   never terminates the session. The confidence chain (신뢰도 보정 체인) drops factors
   silently; the chart continues rendering with reduced confidence scores.

---

## 1.2 Hero Pipeline Diagram

The following swim-lane diagram shows the five production stages and their primary
data and control flows. Width is 75 characters.

```
CHEESESTOCK 5-STAGE PRODUCTION PIPELINE
========================================

  STAGE 1          STAGE 2         STAGE 3         STAGE 4       STAGE 5
  API PIPELINE     SCRIPTS         BROWSER         RENDERING     UI LAYOUT
  ============     =======         ANALYSIS        =========     =========

  +----------+     +-----------+   +-----------+   +---------+   +-------+
  | ECOS     |---->| download_ |   |           |   | LWC     |   | Col A |
  | (BOK)    |     | macro.py  |-->|  data/    |   | v5.1.0  |   | Side- |
  +----------+     +-----------+   |  macro/   |   | Canvas2D|   | bar   |
                                   |  *.json   |   | 9+4     |   | 260px |
  +----------+     +-----------+   |           |   | layers  |   +-------+
  | FRED     |---->| download_ |-->|  data/    |   +---------+   +-------+
  | (FRB St  |     | macro.py  |   |  deriv/   |        ^        | Col B |
  | Louis)   |     +-----------+   |  *.json   |        |        | Chart |
  +----------+           |         |           |        |        | flex:1|
                   +-----------+   |  data/    |   +---------+   +-------+
  +----------+     | compute_  |-->|  backtest/|-->| pattern |   +-------+
  | KRX      |---->| *.py      |   |  *.json   |   | Renderer|   | Col C |
  | (pykrx/  |     | (15 scripts)  |           |   | signal  |   | Patt  |
  |  FDR)    |     +-----------+   |  data/    |   | Renderer|   | Panel |
  +----------+           |         |  market/  |   +---------+   | 240px |
                   +-----------+   |  *.json   |        ^        +-------+
  +----------+     | download_ |-->|           |        |        +-------+
  | DART     |---->| financial |   |  data/    |   +---------+   | Col D |
  | (FSS)    |     | s.py      |   |  financi/ |   | 10-func |   | Fin   |
  +----------+     +-----------+   |  *.json   |   | confid  |   | Panel |
                         |         |           |   | chain   |   | 380px |
  +----------+     +-----------+   +-----------+   +---------+   +-------+
  | KOSIS    |---->| download_ |        |
  | (KOSTAT) |     | kosis.py  |        v
  +----------+     +-----------+   +-------------------+
                                   | analysisWorker.js |
  +----------+                     | patternEngine     |
  | OECD CLI |---->merged into      | signalEngine      |
  | (SDMX)   |     macro.py        | backtester        |
  +----------+                     +-------------------+

  KEY:
  --> data flow   | vertical flow
  ^ returned result to rendering layer
```

Source: `S0_index_v7.md` lines 19-30; `S1_api_pipeline_v7_sec1to4.md` sec 1.1-1.5;
`S5_lifecycle_workers_v7.md` sec 5.5.2-5.5.3.

---

## 1.3 Technology Stack

### 1.3.1 No-Build, Zero-Framework Architecture

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Browser (Chrome/Edge/Firefox) | No server execution required |
| JS module system | None — global variables, `<script defer>` | No bundler needed; load order enforced by HTML |
| CSS framework | None — custom CSS variables (`var(--*)`) | Full control, no specificity conflicts |
| Chart library | TradingView Lightweight Charts v5.1.0 (CDN) | KRX HTS-matching candlestick, ISeriesPrimitive API |
| Korean font | Pretendard (jsDelivr CDN) | KS X 1001 coverage, Korean word-break |
| Mono font | JetBrains Mono (Google Fonts) | Tabular numerals for price alignment |
| Package manager | None | No `node_modules`, no lock file |
| Build step | None | Deploy from source, `stage_deploy.py` stages files |
| Hosting | Cloudflare Pages | CDN global edge, 25MB file limit per asset |
| Local dev | `npx serve` or VS Code Live Server | HTTP required (CORS blocks `file://`) |

Source: `CLAUDE.md` project overview; `S5_ui_architecture_v7.md` sec 5.1.

### 1.3.2 CDN Dependencies

| Library | CDN | Purpose | Integrity |
|---------|-----|---------|-----------|
| LWC v5.1.0 | unpkg.com | Chart canvas + ISeriesPrimitive | SRI checked by verify.py 5c |
| Pretendard | jsDelivr | Korean font (Hangul rendering) | No SRI (CSS endpoint) |
| JetBrains Mono | Google Fonts | Monospace price display | Not applicable |

### 1.3.3 JavaScript File Inventory (21 files, 32,491 lines)

| Layer | Files | Lines | Primary Exports |
|-------|-------|-------|----------------|
| Data | colors.js, data.js, api.js, realtimeProvider.js | 1,869 | `KRX_COLORS`, `dataService`, `ALL_STOCKS` |
| Analysis | indicators.js, patterns.js, signalEngine.js, backtester.js | 12,249 | `patternEngine`, `signalEngine`, `backtester`, `IndicatorCache` |
| Rendering | chart.js, patternRenderer.js, signalRenderer.js | 4,547 | `chartManager`, `patternRenderer`, `signalRenderer` |
| UI | sidebar.js, patternPanel.js, financials.js, drawingTools.js | 7,051 | `sidebarManager`, `renderPatternPanel()`, `updateFinancials()` |
| Orchestration | appState.js, appWorker.js, appUI.js, app.js | 6,225 | global state, Worker lifecycle, DOM events, `init()` |
| Workers | analysisWorker.js, screenerWorker.js | 667 | Off-thread pattern analysis and stock screening |

Script load order is fixed across all 19 main-thread files (see `CLAUDE.md`
architecture section). Changing the order causes reference errors because earlier
scripts export globals that later scripts consume.

Source: `S5_ui_architecture_v7.md` table at lines 111-118.

---

## 1.4 Scale Summary

The following table uses exact figures from the V7 production anatomy and the
303,956-instance backtest corpus.

| Metric | Value | Source |
|--------|-------|--------|
| Total listed stocks covered | 2,696 | `data/index.json` (KOSPI + KOSDAQ) |
| DART financial data coverage | 2,607 / 2,736 (95.3%) | `S1_api_pipeline_v7_sec5to8.md` §1.6.6 |
| Technical patterns (45 types) | 45 | `S3_ta_methods_v7.md` P-01..P-45 |
| Indicators (I-01..I-32) | 32 | `S3_ta_methods_v7.md` §3.1 |
| Signal types (base + composite) | 38+ | `S3_signal_backtester_v7.md` |
| Documented formulas | 218 | `S0_index_v7.md` Formula Registry |
| Graded constants | 306+ | A(60)/B(90)/C(70)/D(80)/E(6) |
| JavaScript source lines | 32,491 | 21 files |
| Python scripts | 58 | 13 download + 15 compute + 30 infra |
| External APIs | 5 (+ OECD) | ECOS, FRED, KRX/pykrx, DART, KOSIS |
| JSON data files (pipeline) | 60+ | `S1_api_pipeline_v7_sec5to8.md` §1.6 |
| Backtest instances | 303,956 | 2,704 stocks x pattern types, 2023-2025 |
| Academic reference documents | 49 | `core_data/` directory |
| ANATOMY documents | 19 | `docs/anatomy/` V7 suite |

---

## 1.5 Dual-Mode Architecture

### 1.5.1 Design Rationale

CheeseStock serves two distinct runtime contexts:

- **Production / paid users**: Domain `cheesestock.co.kr` — real-time Kiwoom
  OCX WebSocket feed via `ws_server.py` (Python 3.9 32-bit, Windows-only).
- **Demo / development / Cloudflare Pages**: Static JSON files in `data/` —
  no server required, full analytical capability on pre-computed data.

The same application code handles both contexts through domain detection in
`api.js initFromIndex()`. File mode renders first; WebSocket upgrades in the
background without blocking the user.

### 1.5.2 Mode Detection Flow

```
DUAL-MODE DETECTION SEQUENCE
==============================

  app.js init()
       |
       v
  dataService.initFromIndex()
       |
       +-- Mode = 'file' (immediate, non-blocking)
       |
       +-- probeWsServer(wsUrl, 3000ms) -- async background
       |        |
       |        |  Domain check (api.js):
       |        |  cheesestock.co.kr / .pages.dev --> wss://...
       |        |  localhost                       --> ws://localhost:8765
       |        |
       |        +-- WS open within 3s?
       |              YES --> Mode = 'ws'  (background upgrade)
       |              NO  --> Mode = 'file' (unchanged)
       |
       +-- fetch('data/index.json')
       |      |
       |      +-- ALL_STOCKS populated (2,696 entries)
       |      +-- Console: "[KRX] index.json 로드 완료: N종목"
       |
       v
  _continueInit() -- chart renders immediately (file mode)
```

The 3-second probe timeout is intentional: users on slow connections or in
offline mode see a fully functional chart without waiting. The WebSocket upgrade
is invisible to the user if it succeeds; if it fails, file mode data is already
on screen.

Source: `S5_lifecycle_workers_v7.md` sec 5.5.2 "Mode Detection Flow".

### 1.5.3 Per-Mode Data Flow Comparison

| Dimension | File Mode (정적) | WS Mode (실시간) |
|-----------|----------------|-----------------|
| OHLCV source | `data/{market}/{code}.json` | Kiwoom TR subscribe (OCX) |
| Intraday source | `data/{code}_{timeframe}.json` | 실시간 체결 tick accumulation |
| Candle latency | Pre-computed (daily cron) | Sub-second on tick arrival |
| Connectivity req. | None (CDN-served) | Kiwoom API login + WS server |
| Demo fallback | Yes (deterministic seed PRNG) | File fallback if disconnected |
| Analysis pipeline | Identical (patternEngine / signalEngine / backtester) | Identical |
| Confidence chain | Identical (all 10 functions) | Identical |

The key architectural invariant: **the analysis pipeline has no knowledge of mode**.
`patternEngine.analyze(candles)` receives the same data structure regardless of
whether candles came from a JSON file or a live WebSocket tick stream. Mode awareness
is encapsulated entirely in `api.js` and `realtimeProvider.js`.

Source: `CLAUDE.md` core principles; `S5_lifecycle_workers_v7.md` sec 5.5.2.

---

## 1.6 Initialization Lifecycle

The 36-step initialization sequence in `app.js / _continueInit()` is partitioned into
four logical phases. Steps are numbered per `S5_lifecycle_workers_v7.md` sec 5.5.3.

### Phase 1 — Data Layer (Steps 1-4)

| Step | Action | File | Console Checkpoint |
|------|--------|------|-------------------|
| 1 | Restore localStorage preferences | appUI.js | — |
| 2 | Resolve initial stock (`currentStock`) | app.js | — |
| 3 | Restore timeframe, chart type, pattern toggles | app.js | — |
| 4 | Toast: N stocks loaded | appUI.js | "N개 종목 데이터 로드 완료" |

Phase 1 guarantees `ALL_STOCKS`, `currentStock`, and all user preferences are
established before any rendering begins.

### Phase 2 — Worker & Sidebar (Steps 5-8)

| Step | Action | File | Console Checkpoint |
|------|--------|------|-------------------|
| 5 | Cache DOM element references (`_cacheDom`) | appUI.js | — |
| 6 | Start 30-second market state timer | appUI.js | — |
| 7 | Create Analysis Worker (`_initAnalysisWorker`) | appWorker.js | "[Worker] 분석 Worker 초기화 완료" |
| 8 | Initialize virtual-scroll sidebar | sidebar.js | — |

Step 7 is the critical ordering constraint: the Worker must be ready before the
first candle data loads (Step 18), or the pattern analysis request queues with no
receiver.

### Phase 3 — Macro Batch (Steps 9-13, fire-and-forget)

| Step | Action | File | Console Checkpoint |
|------|--------|------|-------------------|
| 9 | fetch sector_fundamentals.json | app.js | — |
| 10 | fetch market_context.json | app.js | — |
| 11 | `_loadMarketData()` (async) | appWorker.js | "[KRX] 매크로/채권 데이터 로드 완료" |
| 12 | `_loadDerivativesData()` (async) | appWorker.js | "[KRX] 파생상품/수급 데이터 로드 완료" |
| 13 | `_loadPhase8Data()` (async) | appWorker.js | "[KRX] Phase 8 데이터 로드 완료" |

Steps 11-13 are fire-and-forget: they complete asynchronously and inject market
context into the Worker via `_sendMarketContextToWorker()` when each batch finishes.
The chart renders at Step 19 regardless of whether these batches have completed;
the confidence chain simply applies fewer adjustments until the data arrives.

### Phase 4 — First Stock Render (Steps 14-36)

| Step | Action | File | Console Checkpoint |
|------|--------|------|-------------------|
| 17 | Create LWC chart (`chartManager.createMainChart`) | chart.js | — |
| 18 | Load candles for initial stock | api.js | "[KRX] 캔들 로드 완료" |
| 19 | `updateChartFull()` — first full render | appUI.js | Toast: "N개 패턴 감지됨" |
| 22 | Hide loading overlay | appUI.js | (overlay removed) |
| 23 | `updateFinancials()` — K-IFRS panel | financials.js | — |
| 36 | `showOnboarding()` — first-visit tutorial | appUI.js | — |

Step 17 must precede Step 18 (chart instance required before series can be created).
Step 23 must follow Step 18 (candles array needed for PER/PBR current-price calculation).

The end-to-end wall clock time from page load to first pattern toast is approximately
3-5 seconds on a 50 Mbps connection, dominated by the JSON data fetch and Worker
analysis round-trip.

Source: `S5_lifecycle_workers_v7.md` sec 5.5.3 table, sec 5.5.5 console checkpoints.

---

## 1.7 Four-Column UI Grid

The rendered interface uses a CSS Grid layout with four columns and no gaps.

```
4-COLUMN RESPONSIVE GRID (default breakpoint, > 1366px)
=========================================================

  +------------+------------------+----------+-----------+
  | Col A      | Col B            | Col C    | Col D     |
  | Sidebar    | Chart            | Pattern  | Financial |
  | 260px      | flex: 1          | Panel    | Panel     |
  |            | min: 360px       | 240px    | 380px     |
  |            |                  |          |           |
  | Virtual    | TradingView LWC  | 30+ card | K-IFRS    |
  | scroll     | v5.1.0           | pattern  | DART      |
  | 2,696      | ISeriesPrimitive | list     | PER/PBR   |
  | stocks     | 9+4 draw layers  | quality  | ROE/EVA   |
  | ~40 DOM    | Sub-charts:      | scores   | Merton DD |
  | nodes      |   RSI / MACD     | Academic | Bond DV01 |
  |            | 7 drawing tools  | metadata | FF3 alpha |
  +------------+------------------+----------+-----------+

  Collapsed states:
  .sidebar-collapsed   --> Col A = 0px (icon bar only)
  .pp-col-collapsed    --> Col C = 0px (slide panel at 1200px)
```

At 8 responsive breakpoints, columns A (sidebar) and C (pattern panel) transition
from inline columns to fixed overlay drawers or bottom sheets. Column B (chart)
retains the flex residual at all breakpoints. Column D collapses to a bottom sheet
at <= 768px.

Source: `S5_ui_architecture_v7.md` sec 5.1 CSS Grid Definition; `.claude/rules/ui-layout.md`.

---

## 1.8 Web Worker Architecture

Two workers offload computation from the main thread:

**Analysis Worker (analysisWorker.js)**

- Spawned at Step 7. Receives candles via `postMessage`.
- Imports: colors.js, indicators.js, patterns.js, signalEngine.js, backtester.js.
- `IndicatorCache` contains closures and cannot be `postMessage`d (structured-clone
  limitation); each Worker call re-evaluates indicators from the candle array.
- Result message: `{ type: 'result', patterns, signals, stats, version }`.
- `version` field allows the main thread to discard results from stale requests
  (e.g., user changed stock while analysis was in flight).
- Auto-restarts up to 3 times on uncaught error (`[Worker] 치명적 에러`).
- Throttled to 3-second intervals via `_lastPatternAnalysis` in appWorker.js.

**Screener Worker (screenerWorker.js)**

- Spawned on-demand when the screener panel is opened.
- Iterates all 2,696 stocks in parallel with pattern/signal detection.
- Does not share state with the Analysis Worker.

Source: `S5_lifecycle_workers_v7.md` sec 5.6.1-5.6.2; `.claude/rules/patterns.md` Worker Protocol.

---

## Summary

Chapter 1 has established the following structural facts about CheeseStock:

- A no-build, 21-file, 32,491-line browser application with zero server-side business logic.
- Dual-mode (WebSocket / JSON file) operation with file mode as the non-blocking default.
- A 36-step, 4-phase initialization sequence with strict ordering constraints at steps 7 and 17.
- A 4-column CSS Grid UI serving 2,696 stocks with virtual scroll (~40 DOM nodes) and 45 pattern types.
- Two Web Workers (analysis + screener) isolating heavy computation from the main thread.

Chapter 2 examines the data provenance and trust architecture that feeds this system.
