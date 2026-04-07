# Deliverable 4: Structure Flow
## CheeseStock Production Anatomy V7

> **Classification**: Internal / Investor-Ready
> **Version**: V7 (2026-04-07)
> **Document Series**: Deliverable 4 of 4 (Executive / Technical / Appendix / Structure Flow)
> **Target Reader**: Technical investor, senior engineer, quant researcher
> **Depth**: Intermediate (between D1 Executive 10p and D2 Technical 93p)

---

## Table of Contents

- [How to Read This Document](#how-to-read-this-document)
- [Chapter 1: System Architecture Overview](#chapter-1-system-architecture-overview)
  - [1.1 Platform Identity](#11-platform-identity)
  - [1.2 Hero Pipeline Diagram](#12-hero-pipeline-diagram)
  - [1.3 Technology Stack](#13-technology-stack)
  - [1.4 Scale Summary](#14-scale-summary)
  - [1.5 Dual-Mode Architecture](#15-dual-mode-architecture)
  - [1.6 Initialization Lifecycle](#16-initialization-lifecycle)
  - [1.7 Four-Column UI Grid](#17-four-column-ui-grid)
  - [1.8 Web Worker Architecture](#18-web-worker-architecture)
- [Chapter 2: Data Provenance and Trust Architecture](#chapter-2-data-provenance-and-trust-architecture)
  - [2.1 Introduction: Why Data Provenance Matters](#21-introduction-why-data-provenance-matters)
  - [2.2 API Source Map](#22-api-source-map)
  - [2.3 Data Trust Decision Tree](#23-data-trust-decision-tree)
  - [2.4 JSON File Catalog Summary](#24-json-file-catalog-summary)
  - [2.5 Pipeline Reliability Summary](#25-pipeline-reliability-summary)
  - [2.6 Sample Data Guard Pattern](#26-sample-data-guard-pattern)
  - [2.7 Staleness Detection: verify.py CHECK 6](#27-staleness-detection-verifypy-check-6)
  - [2.8 Three-Batch JavaScript Data Loader](#28-three-batch-javascript-data-loader)
  - [2.9 DART Financial Data Pipeline](#29-dart-financial-data-pipeline)
- [Chapter 3: Analysis Engine -- Detection](#chapter-3-analysis-engine----detection)
  - [3.1 Three-Layer Detection Architecture](#31-three-layer-detection-architecture)
  - [3.2 Layer 1: Indicator Summary](#32-layer-1-indicator-summary)
  - [3.3 Layer 2: Pattern Classification](#33-layer-2-pattern-classification)
  - [3.4 ATR Normalization Philosophy](#34-atr-normalization-philosophy)
  - [3.5 Layer 3: Signal Flow](#35-layer-3-signal-flow)
  - [3.6 Backtester Summary](#36-backtester-summary)
  - [3.7 Worker Protocol](#37-worker-protocol)
  - [3.8 End-to-End Flow](#38-end-to-end-flow)
- [Chapter 4: Confidence Pipeline -- The Core Moat](#chapter-4-confidence-pipeline----the-core-moat)
  - [4.1 Pipeline Overview](#41-pipeline-overview)
  - [4.2 Confidence Waterfall](#42-confidence-waterfall)
  - [4.3 Function-by-Function Summary](#43-function-by-function-summary)
  - [4.4 Data Dependency Map](#44-data-dependency-map)
  - [4.5 Null-Safety Architecture](#45-null-safety-architecture)
  - [4.6 Interaction Effects](#46-interaction-effects)
  - [4.7 D-Grade Constant Audit: Honest Disclosure](#47-d-grade-constant-audit-honest-disclosure)
  - [4.8 Sensitivity Ranking](#48-sensitivity-ranking)
  - [4.9 Chapter Summary](#49-chapter-summary)
- [Chapter 5: Classification and Rendering](#chapter-5-classification--rendering)
  - [5.1 The Rendering Problem](#51-the-rendering-problem)
  - [5.2 Five-Tier Classification Matrix](#52-five-tier-classification-matrix)
  - [5.3 The 9+4 Layer Rendering Stack](#53-the-94-layer-rendering-stack)
  - [5.4 Density Control](#54-density-control)
  - [5.5 Color System](#55-color-system)
  - [5.6 ISeriesPrimitive Reconnection](#56-iseriesprimitive-reconnection)
  - [5.7 Detection-to-Display Funnel](#57-detection-to-display-funnel)
- [Chapter 6: Risk Controls and Validation](#chapter-6-risk-controls--validation)
  - [6.1 The Validation Problem](#61-the-validation-problem)
  - [6.2 Seven-Gate Validation Stack](#62-seven-gate-validation-stack)
  - [6.3 Validation Gate Flow](#63-validation-gate-flow)
  - [6.4 Information Coefficient: Honest Disclosure](#64-information-coefficient-honest-disclosure)
  - [6.5 Formula-Code Fidelity](#65-formula-code-fidelity)
  - [6.6 End-to-End Pipeline Traces](#66-end-to-end-pipeline-traces)
  - [6.7 Deployment Quality Gates](#67-deployment-quality-gates)
  - [6.8 Honest Limitations](#68-honest-limitations)
  - [6.9 Summary](#69-summary)
- [Appendix A: Cross-Reference Index](#appendix-a-cross-reference-index)
- [Appendix B: Terminology Glossary](#appendix-b-terminology-glossary)

---

## How to Read This Document

This document is organized in three logical groups, each addressing a different dimension of the CheeseStock production system.

**Chapters 1-2: Infrastructure**
These chapters answer the question "what is the system built on, and where does its data come from?" Chapter 1 establishes the platform identity, no-build architecture, dual-mode operation, and initialization lifecycle. Chapter 2 documents the complete data provenance chain: five external APIs, 13 download scripts, 15 compute scripts, 60+ JSON files, and the three-tier financial data trust system. Readers primarily interested in deployment architecture, data reliability, or the pipeline should focus here.

**Chapters 3-4: Analytical Core**
These chapters address the analytical differentiation of the system. Chapter 3 documents the three-layer detection architecture (32 indicators, 45 pattern types, 38+ signal definitions) and the backtester's statistical methodology (WLS, HC3, BCa, BH-FDR, Hansen SPA). Chapter 4 documents the 10-function multiplicative confidence adjustment chain -- the "core moat" that transforms raw pattern geometry scores into market-context-aware probability estimates. Quant researchers and technical investors should prioritize these chapters.

**Chapters 5-6: Output Layer**
These chapters cover how detected patterns reach the user and how the system controls for statistical pitfalls. Chapter 5 documents the five-tier classification matrix, the 9+4 canvas layer rendering stack, density controls, the Korean color convention, and ISeriesPrimitive reconnection mechanics. Chapter 6 documents the seven-gate validation stack, IC of 0.051, formula-code fidelity audit (12/15 exact, 0 errors), pipeline traces, deployment quality gates, and honest disclosure of acknowledged limitations.

Readers reviewing a single chapter should note that the appendices provide bidirectional cross-references to D1 (executive summary) and D2 (full technical documentation).

---

# Chapter 1: System Architecture Overview

> **Deliverable 4 -- Structure Flow | Chapter 1 of 4**
> **Version**: V7 (2026-04-07)
> **Source authority**: `S5_lifecycle_workers_v7.md`, `S5_ui_architecture_v7.md`,
> `S0_index_v7.md`, `deliverable1_executive/P0_executive_summary.md`
> **Tone**: CFA paper grade -- precise, quantitative, citation-backed

---

## 1.1 Platform Identity

CheeseStock (cheesestock.co.kr) is a browser-native technical analysis platform
covering all 2,696 listed securities on the Korea Exchange (KRX: KOSPI and KOSDAQ).
The platform provides real-time charting, automated detection of 45 pattern types
(패턴 탐지), a 10-function macro-to-microstructure confidence chain, and a complete
K-IFRS financial panel -- all within a single-page web application that requires no
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
| JS module system | None -- global variables, `<script defer>` | No bundler needed; load order enforced by HTML |
| CSS framework | None -- custom CSS variables (`var(--*)`) | Full control, no specificity conflicts |
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
| Signal types (base + composite) | 49+ | `S3_signal_backtester_v7.md` |
| Documented formulas | 218 | `S0_index_v7.md` Formula Registry |
| Graded constants | 306+ | A(60)/B(90)/C(70)/D(85)/E(1) |
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

- **Production / paid users**: Domain `cheesestock.co.kr` -- real-time Kiwoom
  OCX WebSocket feed via `ws_server.py` (Python 3.9 32-bit, Windows-only).
- **Demo / development / Cloudflare Pages**: Static JSON files in `data/` --
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

### Phase 1 -- Data Layer (Steps 1-4)

| Step | Action | File | Console Checkpoint |
|------|--------|------|-------------------|
| 1 | Restore localStorage preferences | appUI.js | -- |
| 2 | Resolve initial stock (`currentStock`) | app.js | -- |
| 3 | Restore timeframe, chart type, pattern toggles | app.js | -- |
| 4 | Toast: N stocks loaded | appUI.js | "N개 종목 데이터 로드 완료" |

Phase 1 guarantees `ALL_STOCKS`, `currentStock`, and all user preferences are
established before any rendering begins.

### Phase 2 -- Worker & Sidebar (Steps 5-8)

| Step | Action | File | Console Checkpoint |
|------|--------|------|-------------------|
| 5 | Cache DOM element references (`_cacheDom`) | appUI.js | -- |
| 6 | Start 30-second market state timer | appUI.js | -- |
| 7 | Create Analysis Worker (`_initAnalysisWorker`) | appWorker.js | "[Worker] 분석 Worker 초기화 완료" |
| 8 | Initialize virtual-scroll sidebar | sidebar.js | -- |

Step 7 is the critical ordering constraint: the Worker must be ready before the
first candle data loads (Step 18), or the pattern analysis request queues with no
receiver.

### Phase 3 -- Macro Batch (Steps 9-13, fire-and-forget)

| Step | Action | File | Console Checkpoint |
|------|--------|------|-------------------|
| 9 | fetch sector_fundamentals.json | app.js | -- |
| 10 | fetch market_context.json | app.js | -- |
| 11 | `_loadMarketData()` (async) | appWorker.js | "[KRX] 매크로/채권 데이터 로드 완료" |
| 12 | `_loadDerivativesData()` (async) | appWorker.js | "[KRX] 파생상품/수급 데이터 로드 완료" |
| 13 | `_loadPhase8Data()` (async) | appWorker.js | "[KRX] Phase 8 데이터 로드 완료" |

Steps 11-13 are fire-and-forget: they complete asynchronously and inject market
context into the Worker via `_sendMarketContextToWorker()` when each batch finishes.
The chart renders at Step 19 regardless of whether these batches have completed;
the confidence chain simply applies fewer adjustments until the data arrives.

### Phase 4 -- First Stock Render (Steps 14-36)

| Step | Action | File | Console Checkpoint |
|------|--------|------|-------------------|
| 17 | Create LWC chart (`chartManager.createMainChart`) | chart.js | -- |
| 18 | Load candles for initial stock | api.js | "[KRX] 캔들 로드 완료" |
| 19 | `updateChartFull()` -- first full render | appUI.js | Toast: "N개 패턴 감지됨" |
| 22 | Hide loading overlay | appUI.js | (overlay removed) |
| 23 | `updateFinancials()` -- K-IFRS panel | financials.js | -- |
| 36 | `showOnboarding()` -- first-visit tutorial | appUI.js | -- |

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

---

# Chapter 2: Data Provenance and Trust Architecture

> **Deliverable 4 -- Structure Flow | Chapter 2 of 4**
> **Version**: V7 (2026-04-07)
> **Source authority**: `S1_api_pipeline_v7_sec1to4.md`, `S1_api_pipeline_v7_sec5to8.md`,
> `S1_api_pipeline_v7_sec9.md`, `S3_confidence_chain_v7.md`, `.claude/rules/financial.md`
> **Tone**: CFA paper grade -- precise, quantitative, citation-backed

---

## 2.1 Introduction: Why Data Provenance Matters

Technical analysis is only as reliable as the data underlying it. In the Korean
market context, three structural risks make data provenance non-trivial:

1. **Source heterogeneity**: Price data (KRX/pykrx), macro data (ECOS/FRED/KOSIS),
   fundamental data (DART), and derivatives data (KRX API) follow different update
   schedules, authentication schemes, and failure modes.

2. **Silent degradation**: The `daily_update.bat` pipeline uses a fail-forward model --
   every download step after the initial health check emits a WARNING and continues.
   A complete failure of the macro download produces no user-visible error; only the
   confidence chain silently drops that adjustment factor.

3. **Seed data contamination**: For stocks without DART financial data, the system
   generates deterministic pseudo-random financials from a code hash (seed data).
   Displaying seed data as real would materially mislead users. The trust system
   prevents this at the render layer.

This chapter documents the complete chain from API call through JSON file to browser
variable, the three-tier trust classification applied to financial data, and the
mechanisms that detect and contain data quality failures.

---

## 2.2 API Source Map

### 2.2.1 Five External APIs

CheeseStock integrates five primary external APIs plus the OECD SDMX endpoint (merged
into the macro pipeline). Each API serves a distinct analytical domain.

```
API SOURCE MAP: 5 EXTERNAL APIS -> SCRIPTS -> JSON FILES
=========================================================

  +----------+   download_macro.py      +------------------+
  | ECOS     |------------------------->| macro_latest.json|
  | (BOK)    |   download_bonds.py      | bonds_latest.json|
  | free API |------------------------->| bonds_history.json|
  | key reqd |   download_market_       | market_context.  |
  +----------+   context.py------------>|   json (CCSI)    |
                                        +------------------+
  +----------+   download_macro.py      +------------------+
  | FRED     |------------------------->| macro_latest.json|
  | (FRB St  |   (merged with ECOS      |  (fed_rate, vix, |
  | Louis)   |    in same script)       |   us10y, dxy...) |
  | free key |                          +------------------+
  +----------+

  +----------+   download_ohlcv.py      +------------------+
  | KRX      |------------------------->| data/kospi/      |
  | (pykrx   |                          |   {code}.json    |
  |  v1.2.4) |   download_market_       | data/kosdaq/     |
  | no auth  |   index.py-------------->|   {code}.json    |
  +----------+                          | market/kospi_    |
                                        |   daily.json ... |
  +----------+   download_              +------------------+
  | KRX      |   derivatives.py         +------------------+
  | OpenAPI  |------------------------->| derivatives_     |
  | (options |   download_investors.py  |   summary.json   |
  |  futures |   download_etf.py        | investor_summary |
  |  investor|   download_shortsell.py  | etf_summary.json |
  |  ETF)    |                          | shortselling_    |
  +----------+                          |   summary.json   |
                                        | options_daily,   |
                                        |   futures_daily  |
                                        +------------------+
  +----------+   download_              +------------------+
  | DART     |   financials.py          | data/financials/ |
  | (FSS     |------------------------->|   {code}.json    |
  | OPENDART)|   DART API v2            | (2,607 files)    |
  | free key |   0101000/연결/분기      +------------------+
  +----------+

  +----------+   download_kosis.py      +------------------+
  | KOSIS    |------------------------->| kosis_latest.json|
  | (KOSTAT) |                          | (CLI, ESI, IPI,  |
  | no auth  |                          |  CP yield, CPI)  |
  +----------+                          +------------------+

  +----------+   fetch_oecd_cli()       (merged into
  | OECD     |   inside download_        macro_latest.json:
  | SDMX     |   macro.py               korea_cli,
  | CLI data |-------------------------> china_cli,
  | no auth  |                           us_cli)
  +----------+
```

Source: `S1_api_pipeline_v7_sec1to4.md` §1.1-1.4.

### 2.2.2 Compute Scripts: Post-Download Offline Transforms

Fifteen compute scripts run after the download phase, reading raw JSON files and
producing derived analytics. They hit no external APIs and run on the same host.

| Script | Inputs | Output | Key Methods |
|--------|--------|--------|-------------|
| compute_macro_composite.py | macro_latest, bonds_latest, kosis_latest | macro_composite.json | MCS v2 (8-factor, 0-100), Taylor Rule |
| compute_options_analytics.py | options_latest, bonds_latest, kospi200_daily | options_analytics.json | BSM IV (Newton-Raphson), straddle implied move |
| compute_capm_beta.py | OHLCV, market index, bonds_latest, financials | capm_beta.json | OLS beta, Scholes-Williams, Merton DD |
| compute_basis.py | derivatives_summary, bonds_latest | basis_analysis.json | Cost-of-carry, excess basis z-score |
| compute_eva.py | financials, capm_beta, macro_latest | eva_scores.json | NOPAT, WACC, EVA spread, EVA momentum |
| compute_hmm_regimes.py | OHLCV (cap-weighted proxy) | hmm_regimes.json | Baum-Welch EM, 2-state Gaussian HMM |
| compute_flow_signals.py | investor per-stock, hmm_regimes | flow_signals.json | Foreign momentum (20d MA), retail contrarian |
| compute_bond_metrics.py | bonds_latest | bond_metrics.json | Macaulay/Modified Duration, DV01, Convexity |
| compute_illiq_spread.py | OHLCV per-stock | illiq_spread.json | Amihud ILLIQ, Roll (1984) spread |
| compute_survivorship_correction.py | pattern_performance (listed + delisted) | survivorship_correction.json | delta_wr between listed and combined |

Source: `S1_api_pipeline_v7_sec5to8.md` §1.5.1-1.5.15.

---

## 2.3 Data Trust Decision Tree

### 2.3.1 Three-Tier Financial Data Trust System

DART financial data coverage is 95.3% (2,607 / 2,736 stocks). For the remaining
4.7%, and for any stock whose DART file fails to fetch, the system falls back through
a three-tier trust chain. The tier determines which financial metrics are rendered in
Column D (재무 패널).

```
FINANCIAL DATA TRUST DECISION TREE
=====================================

  getFinancialData(code)
       |
       v
  +-------------------+
  | 1. Memory cache   |---(hit)---> return cached result
  |    _financialCache|            (any tier, already resolved)
  +-------------------+
       | miss
       v
  +-------------------+
  | 2. fetch data/    |---(200 OK + source != 'seed')---> TIER 1: DART
  |    financials/    |
  |    {code}.json    |---(fetch error or 404)----------> try tier 3
  |    (10s timeout)  |
  +-------------------+
       | source == 'seed'
       v
  +---------------------------------------------+
  | 3. getPastData(code)                        |
  |                                             |
  |    is code in PAST_DATA (Samsung/SK Hynix)?|
  |      YES --> TIER 2: hardcoded              |
  |      NO  --> TIER 3: seed (PRNG from hash) |
  +---------------------------------------------+

  TIER 1 (source: 'dart')
    --> All financial metrics displayed in full
    --> PER, PBR, PSR, ROE, ROA, EVA, Merton DD
    --> Peer group comparison enabled

  TIER 2 (source: 'hardcoded')
    --> All financial metrics displayed in full
    --> Warning badge shown in UI: "하드코딩된 데이터"
    --> Peer group enabled (filtered for tier mismatch)

  TIER 3 (source: 'seed')
    --> ALL financial metrics displayed as '---'
    --> Seed data NEVER shown as real numbers
    --> Peer group EXCLUDES seed stocks
```

Source: `.claude/rules/financial.md` Data Trust System; `S1_api_pipeline_v7_sec5to8.md` §1.6.6.

### 2.3.2 Seed Data Contamination Prevention

The prohibition against displaying seed data as real is enforced at three layers:

**Layer 1 -- Render guard (`financials.js`)**: When `source === 'seed'`, the function
`updateFinancials()` clears all metric fields to `'---'` before DOM update. No
seed-derived number ever reaches `textContent`.

**Layer 2 -- Compute script guard**: `compute_eva.py` and other compute scripts reject
financial inputs where `source in ('seed', 'demo')`. This prevents seed-data EVA
scores from appearing in `eva_scores.json`.

**Layer 3 -- Peer group filter**: `sidebarManager`'s peer group calculation excludes
stocks tagged as seed from the sector comparison pool. A seed stock cannot inflate
or deflate the sector median PER/PBR.

The only failure vector for this guarantee is if a `data/financials/{code}.json`
file incorrectly carries `source: 'dart'` while containing fabricated data. This
cannot happen through the normal pipeline (`download_financials.py` sets `source`
only from the DART API response status), but would require manual file corruption.

---

## 2.4 JSON File Catalog Summary

The 60+ JSON files that participate in the pipeline fall into six functional
categories. Per-stock OHLCV files (approximately 2,696 files in `data/kospi/` and
`data/kosdaq/`) are not enumerated individually.

### Category 1: Stock Universe and Prices

| File | Producer | JS Consumer | Critical Keys |
|------|----------|-------------|---------------|
| `data/index.json` | download_ohlcv.py / update_index_prices.py | `ALL_STOCKS` (api.js) | `stocks` array |
| `data/{market}/{code}.json` | download_ohlcv.py | `dataService.getCandles()` | OHLCV candle array |
| `data/{code}_{tf}.json` | generate_intraday.py | `dataService.getCandles()` | Intraday OHLCV |
| `data/market/kospi_daily.json` | download_market_index.py | `backtester._marketIndex` | `time`, `close` array |
| `data/market/kosdaq_daily.json` | download_market_index.py | `financials.js` peer context | `time`, `close` array |

### Category 2: Macro and Monetary Policy

| File | Producer | JS Consumer Variable | Required Keys |
|------|----------|---------------------|---------------|
| `data/macro/macro_latest.json` | download_macro.py | `_macroLatest` | `updated`, `mcs`, `vix`, `bok_rate` |
| `data/macro/bonds_latest.json` | download_bonds.py | `_bondsLatest` | `updated`, `yields` |
| `data/macro/kosis_latest.json` | download_kosis.py | `_kosisLatest` | `updated`, `source` |
| `data/macro/macro_composite.json` | compute_macro_composite.py | `_macroComposite` | `mcsV2` |
| `data/macro/bond_metrics.json` | compute_bond_metrics.py | `_bondMetricsCache` | `benchmarks`, `curveShape` |
| `data/market_context.json` | download_market_context.py | `_marketContext` | `ccsi`, `vkospi`, `net_foreign_eok` |

### Category 3: Derivatives and Market Structure

| File | Producer | JS Consumer Variable | Sample Guard |
|------|----------|---------------------|-------------|
| `data/derivatives/derivatives_summary.json` | download_derivatives.py | `_derivativesData` | source != 'sample' |
| `data/derivatives/investor_summary.json` | download_investors.py | `_investorData` | source != 'sample' |
| `data/derivatives/etf_summary.json` | download_etf.py | `_etfData` | source != 'sample' |
| `data/derivatives/shortselling_summary.json` | download_shortselling.py | `_shortSellingData` | source != 'sample'/'unavailable' |
| `data/derivatives/options_analytics.json` | compute_options_analytics.py | `_optionsAnalytics` | status != 'error' |
| `data/derivatives/basis_analysis.json` | compute_basis.py | merged into `_derivativesData` | none |
| `data/vkospi.json` | download_vkospi.py | injected into `_macroLatest.vkospi` | none |

### Category 4: Behavioral and Backtest Analytics

| File | Producer | JS Consumer | Note |
|------|----------|-------------|------|
| `data/backtest/capm_beta.json` | compute_capm_beta.py | `backtester._capmBeta`, `financials.js` | CAPM beta + Merton DD |
| `data/backtest/eva_scores.json` | compute_eva.py | `_evaCache` (financials.js) | EVA spread per stock |
| `data/backtest/hmm_regimes.json` | compute_hmm_regimes.py | `backtester._behavioralData` | 2-state HMM; 30-day staleness gate |
| `data/backtest/illiq_spread.json` | compute_illiq_spread.py | `backtester._behavioralData` | Amihud ILLIQ, Roll spread |
| `data/backtest/flow_signals.json` | compute_flow_signals.py | `_flowSignals` | HMM label + foreign momentum |
| `data/backtest/survivorship_correction.json` | compute_survivorship_correction.py | `backtester._survivorshipCorr` | delta_wr_median |
| `data/backtest/rl_policy.json` | compute_rl_policy.py (offline) | `backtester._rlPolicy` | IC < 0 gate rejects |

### Category 5: Fundamental Financial Data

| File Pattern | Producer | JS Consumer | Trust Tier |
|-------------|----------|-------------|-----------|
| `data/financials/{code}.json` (2,607 files) | download_financials.py (DART) | `_financialCache` via `getFinancialData()` | Tier 1 (dart) / Tier 3 (seed filtered) |
| `data/macro/ff3_factors.json` | compute_ff3_factors.py | `_ff3Cache` (financials.js) | Fama-French 3-factor |
| `data/sector_fundamentals.json` | download_sector.py | `_sectorData` (app.js) | Peer group PER/PBR/PSR medians |

### Category 6: Dead Data Paths (Audit Findings)

Two compute scripts produce output files with no JavaScript consumer. These represent
analyst work that has not yet been wired into the browser pipeline:

| File | Producer | Status |
|------|----------|--------|
| `data/derivatives/hedge_analytics.json` | compute_hedge_ratio.py | No JS consumer; file absent from disk |
| `data/backtest/krx_anomalies.json` | compute_krx_anomalies.py | No JS consumer; excluded from deploy (.cfignore) |

Source: `S1_api_pipeline_v7_sec5to8.md` §1.5.13-1.5.14, §1.6.4.

---

## 2.5 Pipeline Reliability Summary

### 2.5.1 Overall Health Assessment

The V7 reliability audit (conducted 2026-04-06, documented in
`S1_api_pipeline_v7_sec9.md`) evaluated the 18-step `daily_update.bat` pipeline
and identified 17 findings across three severity tiers.

| Severity | Count | Scope |
|----------|-------|-------|
| P0 CRITICAL | 4 | Silent failure + stale-cache vectors |
| P1 HIGH | 5 | Partial data loss with downstream impact |
| P2 MEDIUM | 8 | Cosmetic / informational gaps |

The pipeline's overall architecture is **fail-forward by design**: Step 0 (API
health check) is the sole hard-abort gate. Steps 1-18 all emit `WARNING` and
continue, meaning the pipeline always exits with code 0 regardless of individual
step failures. This is an intentional resilience choice -- partial data is considered
better than no data -- but creates silent degradation risks.

### 2.5.2 Four P0 Critical Findings

**P0-1: VKOSPI download failure is silent**

`download_vkospi.py` is called without error capture in `daily_update.bat` Step 6.
If it fails, `data/vkospi.json` becomes stale without any `WARNING` log entry.
The VKOSPI time series is the primary input for volatility regime classification
(`vkospiClose > 25` = high-vol regime). A stale VKOSPI may incorrectly classify
the market as low-vol, inflating confidence scores on bullish patterns.

**P0-2: Investor flow download failure is silent**

Similarly, `download_investor.py` in Step 7 has no error capture. A silent failure
leaves `investor_summary.json` stale. The sample-data guard in `appWorker.js`
(lines 318-325) nullifies this variable if `source === 'sample'`, but a stale file
that still carries a real `source` value will propagate stale foreign flow data into
`_applyDerivativesConfidenceToPatterns()`.

**P0-3: Worker constructor version not covered by verify.py**

`appWorker.js` spawns the Analysis Worker with a hardcoded version string:
`new Worker('js/analysisWorker.js?v=N')`. This version is not validated by
`verify.py` CHECK 5f, which only checks the `importScripts()` calls inside
`analysisWorker.js` against `index.html` script tags. If `appWorker.js` line 38
is not updated when `analysisWorker.js` changes, browsers with a cached old Worker
binary will silently run the old analysis engine.

**P0-4: Options analytics null propagation**

When `compute_options_analytics.py` has no valid input (Step 12 failure), it writes
`{ status: 'no_data', analytics: null }`. `appWorker.js` then reads
`_optionsAnalytics.analytics.straddleImpliedMove` and throws a `TypeError` at
runtime if the null-chain check is absent. The V7 audit confirmed the null guard
exists but only covers the top-level null; nested field access is not fully guarded.

Source: `S1_api_pipeline_v7_sec9.md` §1.9.1-1.9.2.

### 2.5.3 Pipeline Failure Propagation

The dependency graph below shows how individual step failures cascade to the
confidence chain:

```
PIPELINE FAILURE -> CONFIDENCE CHAIN IMPACT
=============================================

  [Steps 1+2+3] fail
       |
       v
  macro_latest.json stale
       |
       v
  _macroLatest stale --> _applyMacroConfidenceToPatterns()
                         uses old KTB/VIX/CPI
                         (CONF-3 adjustment silent)

  [Steps 5+14] fail
       |
       v
  basis_analysis.json stale/missing
       |
       v
  _derivativesData.basis = null
       --> _applyDerivativesConfidenceToPatterns()
           skips basis spread adjustment
           (CONF-5 partial skip)

  [Steps 7+16] fail
       |
       v
  flow_signals.json stale
       |
       v
  _flowSignals stale --> _applyPhase8ConfidenceToPatterns()
                         uses old HMM regime labels
                         (CONF-7 adjustment silent)

  [Step 15] fails
       |
       v
  macro_composite.json stale / mcsV2 = null
       |
       v
  _macroComposite.mcsV2 = null
       --> _applyPhase8ConfidenceToPatterns()
           skips MCS bull/bear adjustment
           (CONF-7 silent skip)

  NOTE: No failure propagates to the user beyond console.warn
  and an optional session-once toast notification.
```

Source: `S1_api_pipeline_v7_sec9.md` §1.9.2 JS Runtime Impact diagram.

---

## 2.6 Sample Data Guard Pattern

### 2.6.1 The Guard Mechanism

Five JSON files carry a `source` field that gates their use in the JavaScript
confidence chain. The guard pattern is implemented in `appWorker.js` and follows
a consistent structure across all guarded files:

```
SAMPLE DATA GUARD PATTERN (pseudocode)
=======================================

  After fetch + JSON parse of {file}:

    if file.source === 'sample':
        variable = null          // nullify entirely
        log.warn("source=sample, skipping")

    if file.status === 'error':
        variable = null          // nullify entirely
        log.warn("status=error, skipping")

    if file.source === 'unavailable':
        variable = null          // specific to shortselling

    // Only non-null variable reaches the confidence chain.
    // Each confidence function checks variable !== null
    // before applying its adjustment factor.
```

### 2.6.2 Guarded Files and Failure Behavior

| File | Guard Field | Guard Value | Failure Behavior |
|------|------------|-------------|-----------------|
| `investor_summary.json` | `source` | `'sample'` | `_investorData = null`; CONF-5 skips foreign flow |
| `shortselling_summary.json` | `source` | `'sample'`, `'unavailable'` | `_shortSellingData = null`; CONF-5 skips short ratio |
| `derivatives_summary.json` | `source` | `'sample'`, `'demo'` | `_derivativesData = null`; CONF-5 skips basis/PCR |
| `flow_signals.json` | `status` | `'error'` | `_flowSignals = null`; CONF-7 skips HMM/flow bonuses |
| `options_analytics.json` | `status` | `'error'` | `_optionsAnalytics = null`; CONF-7 skips implied move |
| `macro_composite.json` | `source` | `'sample'`, `'demo'` | `_macroComposite.mcsV2 = null`; MCS adjustment skips |
| `market_context.json` | `source` | `'demo'` | `_marketContext` context reset; CCSI adjustment skips |

Source: `S1_api_pipeline_v7_sec5to8.md` §1.6.1-1.6.4; appWorker.js lines 318-325, 405-410.

### 2.6.3 Why `source === 'sample'` is a FAIL, Not a WARN

The `verify.py` CHECK 6 (Gate 1 of the quality gates system) treats `source ===
'sample'` as a FAIL for investor and shortselling files. The rationale:

- `appWorker.js` lines 318-325 null out `_investorData` when `source === 'sample'`.
  This is a known, documented code path that silently degrades the confidence chain.
- A WARN would allow the pipeline to pass verification while running without real
  investor data -- invisible to the developer until pattern confidence scores are
  manually inspected.
- A FAIL forces the developer to confirm that the daily download ran successfully
  before the pipeline is considered production-ready.

This is one of five quality gates described in `.claude/rules/quality-gates.md`.

---

## 2.7 Staleness Detection: verify.py CHECK 6

### 2.7.1 The Pipeline Connectivity Gate

CHECK 6 is the sixth automated check in `scripts/verify.py`, added to enforce the
pipeline contract documented in `.claude/rules/quality-gates.md` Gate 1. It validates
12 JSON files across four dimensions:

| Dimension | Failure Mode | Severity |
|-----------|-------------|---------|
| File existence | File absent from disk | FAIL |
| Required key presence | Top-level key missing after JSON parse | WARN |
| Sample-data guard | `source === 'sample'` on guarded files | FAIL |
| Array non-empty | Expected array is empty list | WARN |
| Staleness | `updated`/`date` field older than 14 calendar days | WARN |
| Nested key path | `analytics.straddleImpliedMove` path broken | WARN |

### 2.7.2 The 12 Files Under Contract

```
CHECK 6 PIPELINE CONTRACT (12 files)
======================================

  File                                   Keys Required
  ---------------------------------------------------
  data/macro/macro_latest.json           updated, mcs, vix, bok_rate
  data/macro/bonds_latest.json           updated
  data/macro/kosis_latest.json           updated, source
  data/macro/macro_composite.json        mcsV2
  data/vkospi.json                       [array] close, time
  data/derivatives/derivatives_summary   [array] time
  data/derivatives/investor_summary      date, foreign_net_1d
                                         [FAIL if source=sample]
  data/derivatives/etf_summary           date
  data/derivatives/shortselling_summary  date, market_short_ratio
                                         [FAIL if source=sample]
  data/derivatives/basis_analysis        [array] basis, basisPct
  data/backtest/flow_signals             stocks, hmmRegimeLabel
                                         [FAIL if status=error]
  data/derivatives/options_analytics     analytics.straddleImpliedMove
```

### 2.7.3 What CHECK 6 Catches That No Prior Check Caught

Prior to CHECK 6, the following failure modes were invisible to `verify.py`:

| Scenario | Prior behavior | CHECK 6 behavior |
|----------|---------------|-----------------|
| investor_summary still has `source='sample'` after failed KRX download | No verify.py signal | FAIL |
| macro_composite.json missing `mcsV2` after schema change | No verify.py signal | WARN |
| vkospi.json is empty after download failure | No verify.py signal | WARN |
| macro_latest.json not refreshed in 3 weeks | No verify.py signal | WARN (14-day threshold) |

Source: `.claude/rules/quality-gates.md` Gate 1 §CHECK 6.

---

## 2.8 Three-Batch JavaScript Data Loader

### 2.8.1 Loader Architecture

The JavaScript pipeline loads data in three asynchronous batches, called from
`app.js init()` using `Promise.allSettled`. Each batch has a 5-minute TTL
(`_PIPELINE_LOAD_TTL = 300,000 ms`) to prevent re-fetching within the same session.

```
THREE-BATCH JS DATA LOADER
============================

  app.js init()
       |
       +-- _loadMarketData()     [Batch 1]
       |     |
       |     +-- macro_latest.json    --> _macroLatest
       |     +-- bonds_latest.json    --> _bondsLatest
       |     +-- kosis_latest.json    --> _kosisLatest
       |     +-- vkospi.json          --> injected into _macroLatest.vkospi
       |     |
       |     +-- _sendMarketContextToWorker()
       |     +-- Console: "[KRX] 매크로/채권 데이터 로드 완료"
       |
       +-- _loadDerivativesData() [Batch 2]
       |     |
       |     +-- derivatives_summary  --> _derivativesData
       |     +-- investor_summary     --> _investorData  (sample guard)
       |     +-- etf_summary          --> _etfData
       |     +-- shortselling_summary --> _shortSellingData (sample guard)
       |     +-- basis_analysis       --> merged into _derivativesData
       |     |
       |     +-- Console: "[KRX] 파생상품/수급 데이터 로드 완료 (N/4)"
       |
       +-- _loadPhase8Data()     [Batch 3]
             |
             +-- macro_composite      --> _macroComposite
             +-- flow_signals         --> _flowSignals
             +-- options_analytics    --> _optionsAnalytics
             |
             +-- _getPipelineHealth()
             |     Console: "[Pipeline] Health: N/12 OK"
             +-- Console: "[KRX] Phase 8 데이터 로드 완료 (N/3)"
```

Each fetch has a 5-second individual timeout. A fetch failure calls
`_notifyFetchFailure()` (session-once toast) and continues -- the batch does not
abort on partial failure.

### 2.8.2 On-Demand Loaders

Four additional loaders fire outside the batch sequence:

| Loader | File | Trigger | Consumer |
|--------|------|---------|---------|
| `getFinancialData(code)` | `data/financials/{code}.json` | Stock selection | `financials.js` Column D |
| `_loadBehavioralData()` | `illiq_spread`, `hmm_regimes`, `csad_herding`, `disposition_proxy`, `survivorship_correction` | `backtester.init()` | Confidence chain CONF-8 |
| `_loadCAPMBeta()` | `data/backtest/capm_beta.json` | `backtester.init()` | CAPM beta + Merton DD display |
| `_loadMarketIndex()` | `data/market/kospi_daily.json` | `backtester.init()` | Beta regression benchmark |

Source: `S1_api_pipeline_v7_sec5to8.md` §1.7.

---

## 2.9 DART Financial Data Pipeline

### 2.9.1 Coverage and Fallback

DART (금융감독원 전자공시시스템) is the primary source for K-IFRS consolidated
financial statements (연결재무제표). Coverage is 95.3% of the DART-reporting universe:

| Category | Count |
|----------|-------|
| Stocks with DART financials (`source: 'dart'`) | 2,607 |
| Total DART-reporting universe | 2,736 |
| Coverage rate | 95.3% |
| Hardcoded fallback (Samsung 005930, SK Hynix 000660) | 2 |
| Seed-generated (hash PRNG, displayed as '---') | Remainder |

### 2.9.2 DART API Error Handling

`download_financials.py` follows the DART API v2 status code semantics:

| Status Code | Meaning | Handling |
|-------------|---------|---------|
| `"000"` | Success | Parse `list` array |
| `"013"` | No data for period (normal) | Skip quarter silently |
| `"010"` | API key error | Log + abort script |
| `"011"` | Daily quota exceeded | Log + sleep + retry |
| Other | Unexpected error | Log + continue to next stock |

Financial account matching uses Korean name-based mapping rather than numeric
account codes, because K-IFRS allows companies to use custom account names. The
mapping covers: 매출액 / 수익(매출액) / 영업수익 -> revenue; 영업이익 ->
operating income; 당기순이익 -> net income; 자본총계 -> total equity.

### 2.9.3 Unit Conversion

All raw DART values are denominated in KRW (원). Display conversion:

| Condition | Display format |
|-----------|---------------|
| Raw value |n| > 1,000,000 (억원 threshold) | Divide by 1e8, display as "X억원" |
| Display >= 10,000억 | Convert to "X.X조" |
| Display >= 100억 | Display as "X억" |

`toEok()` in `data.js` auto-detects the unit via the `|n| > 1,000,000` threshold.
This handles the mixed units that appear in DART filings (some companies report in
thousands of KRW, others in millions). Integer truncation via `Math.round()` is
applied -- no floating-point residuals are shown.

Source: `.claude/rules/financial.md` Unit System; `S1_api_pipeline_v7_sec1to4.md` §1.4 DART section.

---

## Summary

Chapter 2 has established the following provenance and trust facts:

- Five external APIs (ECOS, FRED, KRX/pykrx, DART, KOSIS) feed 13 download scripts
  and 15 compute scripts, producing 60+ JSON files across six functional categories.
- Financial data follows a three-tier trust system (dart / hardcoded / seed). Seed
  data is displayed exclusively as `'---'`, enforced at three independent layers.
- The pipeline uses a fail-forward model: only the Step 0 health check is a hard
  gate; all 18 data steps degrade silently. Four P0 findings document the highest-risk
  silent failure vectors.
- Five JSON files carry `source`/`status` guard fields that nullify variables in the
  confidence chain when sample or error data is detected.
- `verify.py` CHECK 6 provides automated pipeline connectivity validation across
  12 contracted data files, catching silent degradation that no prior check detected.
- DART coverage is 95.3% (2,607/2,736), with KRW-denominated raw values converted
  to 억원 via the `|n| > 1,000,000` auto-detection threshold in `toEok()`.

Chapter 3 will document the confidence adjustment chain -- the 10-function sequential
pipeline that transforms raw pattern detections into market-context-aware confidence
scores.

---

# Chapter 3: Analysis Engine -- Detection

> **Deliverable 4** | Structure Flow Document
> **Source**: S3_ta_methods_v7.md, S3_signal_backtester_v7.md, S2_theoretical_basis_v7.md
> **Cross-ref**: D2/P5 Theory Summary Cards (Card 1: Mathematics, Card 2: Finance)

---

## 3.1 Three-Layer Detection Architecture

The analysis engine transforms raw OHLCV candles into trading signals through
three sequentially dependent layers, each raising the abstraction level from
numerical computation to semantic market interpretation.

| Layer | Input | Output | Engine File | Count |
|-------|-------|--------|-------------|-------|
| 1 -- Indicators | OHLCV candles | Numerical series, scalars | indicators.js | 32 (I-01..I-32) |
| 2 -- Patterns | Candles + indicator cache | Pattern objects with confidence | patterns.js | 45 (P-01..P-45) |
| 3 -- Signals | Candles + indicators + patterns | Signal objects, composites, stats | signalEngine.js | 49+ (19 base + 30 composite) |

**Why three layers?** The separation follows classical signal processing:
measurement (indicators), feature extraction (patterns), and decision
(signals). Indicators are market-agnostic pure functions; patterns require
domain-specific recognition; signals require multi-source confluence. The
backtester (`backtester.js`) runs alongside as a validation layer -- its
output feeds the UI and offline calibration, not the detection pipeline.

> D2 source: S3_ta_methods_v7.md SS 3.1, 3.2; S3_signal_backtester_v7.md SS 3.3-3.5.

---

## 3.2 Layer 1: Indicator Summary

### 3.2.1 Five Categories

Every indicator function is pure: same input, same output, no global state.
This purity enables safe memoization in the IndicatorCache.

| Category | IDs | Count | Representatives | Lineage |
|----------|-----|-------|-----------------|---------|
| Classic TA | I-01..I-10 | 10 | MA, EMA, BB, RSI, ATR, OBV, MACD, Ichimoku, Kalman, Stochastic | Wilder (1978), Appel (1979), Bollinger (2001), Hosoda (1969) |
| Extended Oscillators | I-11..I-15 | 5 | StochRSI, CCI, ADX, Williams %R, Theil-Sen | Chande & Kroll (1994), Lambert (1980), Theil (1950) |
| Statistical | I-16..I-22 | 7 | Hurst, Hill, GPD VaR, CAPM Beta, HV, VRP, WLS+Ridge+HC3 | Mandelbrot (1963), Hill (1975), Sharpe (1964), Hoerl & Kennard (1970) |
| Trend / Regime | I-23..I-28 | 6 | OLS Trend, EWMA Vol, Vol Regime, ILLIQ, CUSUM, BinSeg | Lo & MacKinlay (1999), RiskMetrics (1996), Amihud (2002), Page (1954) |
| Utilities | I-29..I-32 | 4 | HAR-RV, Matrix Inversion, Jacobi Eigen, GCV Lambda | Corsi (2009), Golub-Heath-Wahba (1979) |

Every constant carries a CFA-paper grade: [A] academic-fixed (change
invalidates formula), [B] tunable with basis, [C] KRX-adapted, [D]
heuristic, [E] deprecated. Current distribution: A55/B69/C78/D63.

### 3.2.2 IndicatorCache

The cache uses lazy accessors keyed by name and parameters (e.g., `"ma_20"`,
`"bbEVT_20_2"`). First access computes and stores; subsequent accesses return
instantly. **Critical constraint**: the cache stores function references for
lazy-eval, so it cannot cross the Worker boundary via `postMessage()`
(structured clone fails on functions). The Worker builds its own cache.

> D2 source: S3_ta_methods_v7.md SS 3.1.1-3.1.6.

---

## 3.3 Layer 2: Pattern Classification

### 3.3.1 Five Groups

| Group | IDs | Count | Bars | Detection Method |
|-------|-----|-------|------|-----------------|
| Single Candle | P-01..P-11 | 11 | 1 + trend context | Body/shadow geometry ratios |
| Double Candle | P-12..P-19 | 8 | 2 consecutive | Inter-candle relationship |
| Triple Candle | P-20..P-25 | 6 | 3 consecutive | Sequence progression rules |
| Extended Candle | P-26..P-34 | 9 | 1-5 bars | Specialized variants, continuations |
| Chart Patterns | P-35..P-45 | 11 | 5-120 bars | Swing-point structural geometry |

Additionally: S/R clustering (ATR x 0.5 tolerance, min 2 touches, max 10),
52-week high/low anchors (George & Hwang 2004), valuation S/R from BPS/EPS.

### 3.3.2 Dual Confidence Schema

Every pattern carries two confidence scores: `confidence` (0-100, display)
and `confidencePred` (0-95, model input). The separation exists because
visual distinctiveness does not correlate with predictive power -- a
visually striking hammer (high display confidence) may have only 45% win
rate. Chart patterns additionally carry `neckline`, `breakoutConfirmed`,
`trendlines`, and `_swingLookback` (look-ahead bias offset for backtesting).

### 3.3.3 Candle vs Chart Detection

Candle patterns follow a three-step flow: geometry test (body/shadow ratios
vs ATR-normalized thresholds), context test (preceding trend, volume ratio),
and confidence scoring (base + volume boost + Hurst regime adjustment).

Chart patterns operate at structural scale: swing-point identification,
geometric constraint matching (e.g., double bottom = two lows within
ATR x 0.5), trendline fitting (least-squares for triangles/wedges),
breakout confirmation (20-bar lookforward, ATR-scaled penetration), and
volume profile scoring. Unconfirmed patterns receive a 12-15 point penalty
per Bulkowski (2005): confirmed breakouts have ~2.4x the success rate.

> D2 source: S3_ta_methods_v7.md SS 3.2.1-3.2.6.

---

## 3.4 ATR Normalization Philosophy

### 3.4.1 The Problem

KRX stocks range from Samsung Electronics (~60,000 KRW) to KOSDAQ penny
stocks (~1,000 KRW). A "long body" of 1,200 KRW is 2% on Samsung but 120%
on a 1,000 KRW stock. Percentage normalization (body/close) partially solves
this but fails when volatility regimes differ: 2% on a 5% daily ATR stock
is unremarkable, while 2% on a 0.5% ATR stock is extraordinary.

ATR(14) captures each stock's recent volatility regime, making it the natural
denominator. The fallback (`close * 0.02`) handles cold-start when fewer
than 14 candles exist, approximating median KOSPI large-cap ATR/close.

### 3.4.2 Application

```
ATR NORMALIZATION FLOW
======================

   body = abs(close - open)     atr = ATR(14) or
   range = high - low              close * 0.02
   shadows = high/low offsets      (fallback)
        |                       |
        +----------+------------+
                   |
                   v
   bodyRatio = body / atr
   rangeRatio = range / atr
   S/R cluster tolerance = 0.5 * atr
                   |
                   v
   Compare vs thresholds (all ATR-relative):
     SHADOW_BODY_MIN = 2.0
     ENGULF_BODY_MULT = 1.5
     TRIANGLE_BREAK = 0.3 * atr
     S/R confluence within 1.0 * atr
       --> confidence + 3 * S/R strength

```

S/R confluence: when a pattern's stopLoss or priceTarget falls within one ATR
of an existing S/R level, confidence gains `+3 * strength` (normalized touch
count 0-1), rewarding alignment with independently identified structural
levels.

> D2 source: S3_ta_methods_v7.md SS 3.2.1 constants; .claude/rules/patterns.md.

---

## 3.5 Layer 3: Signal Flow

```
SIGNAL ENGINE PIPELINE
======================

   Indicators (cache)    Patterns (Layer 2)
        |                       |
        v                       v
   +-----------------------------------+
   | STAGE A: Base Signal Detection    |
   | 19 detectors (SIG-01..SIG-19)    |
   | 7 indicator categories + deriv   |
   | Each emits 1-4 signal types      |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE B: Composite Matching       |
   | 30 definitions in 3 tiers        |
   | Required + Optional in 5-bar win |
   | Anti-predictor WR gate (BLL 92)  |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE C: Post-Filters (12)       |
   | Additive: ADX/CCI/OLS (cap +15) |
   | Multiplicative: Entropy, IV/HV,  |
   |   VKOSPI, Expiry, Crisis, HMM   |
   | Floor: max(10, result)           |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE D: Sentiment & Statistics   |
   | Weight-avg sentiment [-100,+100] |
   | Shannon entropy (diversity)      |
   +-----------------------------------+

```

**Base signals** (19 detectors): MA cross/alignment, MACD cross, RSI/StochRSI/
Stochastic momentum, BB bounce/squeeze, volume z-score/OBV divergence,
Ichimoku TK/cloud, regime filters (Hurst/Kalman/CUSUM/ATR/VolRegime), and
derivatives/flow signals (basis/PCR/foreign/ERP/ETF/short). Regime filters
carry zero directional weight -- they feed composites and post-filters only.

**Composites** (30 definitions, 3 tiers): Tier 1 (11, strong, 2-3 required
conditions, baseConf 61-75), Tier 2 (16, medium, 1-2 required + optional,
baseConf 48-69), Tier 3 (3, weak, 1 required + optional, baseConf 48-55).
The Anti-Predictor WR Gate (BLL 1992) hard-caps composite confidence when
any required pattern has KRX 5-year win rate below 48% (anti-predictor
threshold, accounting for ~2% round-trip cost). Five buy-side composites
are currently capped by this gate.

**Post-filters** (12 sequential): PF-1..PF-3 additive (ADX/CCI/OLS, max
+/-15 cumulative), PF-6 cap, PF-7..PF-12 multiplicative (entropy 0.80-1.0,
IV/HV 0.50-1.0, VKOSPI regime 0.60-1.0, expiry 0.70, crisis 0.60-1.0,
HMM fallback 0.70-1.0). Worst case: base 70 reduced to ~8, floored at 10.
This aggressive compounding is deliberate: five simultaneous independent
risk factors truly indicate minimal predictive value.

> D2 source: S3_signal_backtester_v7.md SS 3.3.1-3.3.5.

---

## 3.6 Backtester Summary

### 3.6.1 Methodology Stack

The backtester produces 43 metrics per pattern-horizon combination across
303,956 pattern instances (2,768 stocks, 5 years, 2021-03 to 2026-03).

| Framework | Purpose | Key Reference |
|-----------|---------|---------------|
| WLS + Ridge | Return prediction; 5-feature design matrix, lambda=0.995 exponential decay (half-life ~7 months, Lo 2004 AMH), GCV-auto Ridge | Reschenhofer (2021), Hoerl & Kennard (1970), Golub-Heath-Wahba (1979) |
| Huber-IRLS | Fat-tail robustness; delta=5.8 (1.345 * KRX MAD), handles +/-30% limit moves | Huber (1964) |
| HC3 Errors | Heteroskedasticity-consistent inference, jackknife correction for n=30-300 | MacKinnon & White (1985) |
| BCa Bootstrap | Calendar-time block bootstrap (B=500), bias-corrected accelerated CIs | Efron (1987), Fama & French (2010) |
| BH-FDR | Multiple testing correction at q=0.05 across 225 tests (45 patterns x 5 horizons) | Benjamini & Hochberg (1995) |
| Hansen SPA | Data snooping test: does the best strategy genuinely beat random entry? B=500 | Hansen (2005) |

**Design rationale**: WLS over OLS because regime shifts make recent
observations more representative (AMH). Ridge over plain WLS because
n/k=6 at minimum threshold is underpowered. Huber-IRLS because KRX
+/-30% limit moves create extreme kurtosis that inflates OLS coefficients.

### 3.6.2 Walk-Forward Evaluation (WFE)

Expanding-window cross-validation: 4 folds (6 if candles >= 500), 20% OOS
per fold, purge gap = 2 x horizon bars (Bailey & Lopez de Prado 2014).
WFE = round(avgOOS / avgIS x 100). Robust >= 50%, marginal 30-50%,
overfit < 30%. Tier A/B patterns with WFE < 30% demoted to C.

### 3.6.3 Reliability Tiers

| Tier | Statistical | Economic | Predictive |
|------|------------|----------|------------|
| A | BH-FDR sig | wrAlpha >= 5%, n >= 100, PF >= 1.3, expectancy > 0 | OOS IC > 0.02 |
| B | BH-FDR sig | wrAlpha >= 3%, n >= 30, expectancy > 0 | OOS IC > 0.01 |
| C | -- | wrAlpha > 0%, n >= 30 | -- |
| D | -- | default | -- |

Triple-gating prevents false promotion: BH-FDR (multiple testing), WFE
(overfitting), SPA (data snooping). Each addresses a distinct failure mode
-- a pattern can pass BH-FDR yet fail WFE.

> D2 source: S3_signal_backtester_v7.md SS 3.4.2, 3.5.2-3.5.6;
> D2/P5 Card 1 (S-4 BCa, S-5 BH-FDR).

---

## 3.7 Worker Protocol

### 3.7.1 Offload Rationale

A single analysis pass (32 indicators + 45 detectors + 19 signal generators +
backtester) takes 50-200ms. Running on the main thread would block UI
rendering, causing dropped frames during chart interaction.

### 3.7.2 Message Protocol and Safeguards

```
WORKER MESSAGE PROTOCOL
========================

   Main Thread                  Worker Thread
        |                            |
        |--{ type: 'analyze',   ---->|
        |   candles: [...],          |
        |   realtimeMode: bool,      | importScripts: colors,
        |   version: N }             |   indicators, patterns,
        |                            |   signalEngine, backtester
        |                            |
        |                            | Build IndicatorCache
        |                            | Run L1 -> L2 -> L3
        |                            |
        |<---{ type: 'result',  -----|
        |     patterns: [...],       |
        |     signals: [...],        |
        |     stats: {...},          |
        |     version: N }           |
        |                            |
        | if version < current:      |
        |   discard (stale)          |

```

**Version stamping**: Monotonic counter incremented on stock selection.
Results from a previous stock are discarded if a newer request has been sent.

**3-second throttle**: `_lastPatternAnalysis` timestamp enforces minimum
interval between dispatches. Shorter (500ms) would queue overlapping
analyses; longer (10s) would feel stale during volatile moves. The 3s value
reflects observed 95th-percentile completion time plus buffer.

**Cache fingerprinting**: Worker-side `_analyzeCache` keyed by candle length +
last timestamp + last close. Re-selecting an unchanged stock returns the
cached result without re-running the pipeline.

**IndicatorCache isolation**: Because the cache contains function references
(lazy-eval), it cannot be serialized via structured clone. The Worker
constructs its own independent cache from the raw candle data passed in the
message. This duplication is the cost of thread safety.

> D2 source: .claude/rules/patterns.md (Worker Protocol);
> S3_signal_backtester_v7.md SS 3.4.

---

## 3.8 End-to-End Flow

```
END-TO-END ANALYSIS ENGINE
===========================

  dataService.getCandles(stock, tf)
         |
  =======|======= Worker Boundary =====
         |
         v
  +----------------------------------------+
  | L1: INDICATORS (32)                    |
  |  Classic(10) Oscillators(5) Stats(7)   |
  |  Trend/Regime(6) Utilities(4)          |
  |  --> IndicatorCache (lazy, keyed)      |
  +------------------+---------------------+
                     |
                     v
  +----------------------------------------+
  | L2: PATTERNS (45)                      |
  |  Single(11) Double(8) Triple(6)        |
  |  Extended(9) Chart(11) + S/R           |
  |  ATR(14) norm, dual confidence         |
  +-----+-----------------------+----------+
        |                       |
        v                       v
  +-----------------+  +-------------------+
  | L3: SIGNALS     |  | BACKTESTER        |
  | 19 base detect  |  | WLS/Ridge/HC3     |
  | 30 composites   |  | Huber-IRLS        |
  | WR gate, 12 PF  |  | BCa/BH-FDR/SPA   |
  | Sentiment idx   |  | WFE, A/B/C/D tier |
  +--------+--------+  +--------+----------+
           |                     |
  =========|=====================|==========
           v                     v
  +----------------------------------------+
  | UI: patternRenderer, signalRenderer,   |
  |     patternPanel, reliability badges   |
  +----------------------------------------+

```

Backtest empirical basis: 303,956 pattern instances, 2,768 stocks, 5 years.
KRX trading days: 250. BH-FDR q: 0.05. Bootstrap: 500 replicates. WFE
robust threshold: >= 50%. WLS lambda: 0.995. Ridge: GCV auto. ATR period: 14.

---

# Chapter 4: Confidence Pipeline -- The Core Moat

> **Cross-Reference:** S3_confidence_chain_v7.md (1,117 lines) | D1 P0 Section 1.1
> **Scope:** 10-function multiplicative chain, CONF-1 through CONF-10
> **Source Authority:** `js/appWorker.js` lines 105-1679

---

## 4.1 Pipeline Overview

### What Makes This the Core Moat

The confidence adjustment chain is CheeseStock's central integration point
and its primary differentiator from conventional charting platforms. While
most technical analysis tools display pattern detections at face value,
CheeseStock subjects every detected pattern to a gauntlet of 10
sequential adjustment functions that incorporate macroeconomic regime,
credit risk, derivatives flow, liquidity conditions, and survivorship
bias before the pattern reaches the user's screen.

The result: a pattern's displayed confidence is not merely a measure of
geometric quality -- it is a market-context-aware probability estimate
that degrades appropriately under adverse conditions and strengthens
when multiple independent data sources confirm the pattern's thesis.

### Why Multiplicative, Not Additive

All adjustments use the multiplicative form:

```
   confidence_final = confidence_raw
                      * adj_1 * adj_2 * ... * adj_8
```

An additive model (confidence += delta) would allow a single large
delta to dominate regardless of other factors. Multiplicative
compounding ensures that each factor independently scales confidence,
and adverse factors compound naturally: a pattern in a risk-off,
illiquid, credit-stressed environment faces compounding discounts
that correctly reflect the simultaneous degradation of multiple
independent predictability assumptions.

Each function clamps its own adjustment factor to a function-specific
range before application. After all 8 pattern functions complete,
confidence is clamped to the absolute range:

| Field | Absolute Range | Purpose |
|-------|---------------|---------|
| `confidence` | [10, 100] | Pattern display and rendering priority |
| `confidencePred` | [10, 95] | Prediction confidence (conservative ceiling) |

The 95% ceiling on `confidencePred` embodies a deliberate epistemic
humility: no technical pattern, regardless of how many confirming
factors align, should claim near-certainty about future price
movements.

### Three Identical Call Sites

The chain is invoked identically in three code paths to ensure
consistency regardless of execution context:

| Path | Trigger | When Used |
|------|---------|-----------|
| Worker result | `msg.type === 'result'` | Normal: Worker completes analysis |
| Main thread fallback | `_analyzeOnMainThread()` | Worker unavailable or crashed |
| Drag fallback | `_analyzeDragOnMainThread()` | User drags chart without Worker |

This triple invocation guarantees that a pattern displayed via
Worker analysis, main-thread fallback, or drag-triggered reanalysis
receives identical confidence adjustments -- preventing inconsistent
user experiences between execution paths.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.1

---

## 4.2 Confidence Waterfall

The following diagram traces a hypothetical buy pattern (raw
confidence 65) through the full chain under a risk-off,
low-liquidity, inverted-yield scenario -- the most informative
stress case for demonstrating the chain's behavior.

```
CONFIDENCE WATERFALL
====================
Buy Pattern in Risk-Off / Low-Liquidity Scenario

  Raw (patterns.js quality scoring)
  |
  |  65.0  ##########################################
  |
  |  CONF-1: Market Context (earnings season)
  |  60.5  #####################################  x0.93
  |
  |  CONF-2: RORO Regime (risk-off, buy penalized)
  |  55.6  ##################################  x0.92
  |
  |  CONF-3: Macro (yield slope inverted)
  |  53.9  ################################  x0.97
  |
  |  CONF-4: Micro (high ILLIQ, low liquidity)
  |  45.8  ###########################  x0.85
  |            *** LARGEST SINGLE ADJ ***
  |
  |  CONF-5: Derivatives (basis slightly positive)
  |  47.6  ############################  x1.04
  |
  |  CONF-6: Merton DD (elevated default risk)
  |  45.3  ##########################  x0.95
  |
  |  CONF-7: Phase 8 (MCS neutral, flow weak+)
  |  46.2  ###########################  x1.02
  |
  |  CONF-8: Survivorship (-2% standard)
  |  45.3  ##########################  x0.98
  |
  |  FINAL: 45.3 (clamped to [10, 100])
  |
  |  Effective discount: 65.0 -> 45.3 = -30.3%
  |  Dominant factor: CONF-4 Micro (ILLIQ) -15%

```

**Interpretation:** Under this adverse scenario, the pattern loses
nearly one-third of its raw confidence. The largest single
contributor is CONF-4 (Amihud ILLIQ), reflecting the empirical
reality that illiquid Korean stocks exhibit wider bid-ask spreads
and less reliable pattern signals (Amihud, 2002). CONF-5
(derivatives) provides a modest offset via contango basis, but
the overall chain correctly penalizes buy patterns in an
unfavorable macro environment.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.3

---

## 4.3 Function-by-Function Summary

The following table provides a condensed reference for each of
the 10 confidence functions. Full factor-by-factor documentation
with line numbers and edge cases is available in S3_confidence_chain_v7.md
Sections 3.6.2 through 3.6.11.

| CONF | Function Name | Data Source(s) | Academic Basis | Adj Range | Direction | Grade Mix |
|------|--------------|----------------|----------------|-----------|-----------|-----------|
| 1 | Market Context | market_context.json | Lemmon & Portniaguina (2006), Richards (2005) | [0.55, 1.35] | Buy-focused | 4[D] |
| 2 | RORO Regime | 5-factor composite (macro, bonds, investor) | Baele, Bekaert & Inghelbrecht (2010) | [0.92, 1.08] | Directional | 6[C], 6[D] |
| 3 | Macro 11-Factor | macro_latest, bonds_latest, kosis_latest, macro_composite | IS-LM, Taylor (1993), Stovall (1996), Gilchrist & Zakrajsek (2012) | [0.70, 1.25] | Both | 24[B-C], 21[D] |
| 4 | Micro (ILLIQ/HHI) | Candles (OHLCV), ALL_STOCKS | Amihud (2002), Kyle (1985) | [0.80, 1.15] | Both | 5[B-C] |
| 5 | Derivatives 6-Factor | derivatives, investor, etf, shortselling, basis | Bessembinder & Seguin (1993), Pan & Poteshman (2006) | [0.70, 1.30] | Directional | 6[B-C], 8[D] |
| 6 | Merton DD | Candles, financials, market cap, bonds | Merton (1974), Bharath & Shumway (2008) | [0.75, 1.15] | Directional | 3[A-B], 5[D] |
| 7 | Phase 8 (MCS/HMM/IV) | macro_composite, flow_signals, options_analytics | MCS Doc30, HMM Doc46, Simon & Wiggins (2001) | Final [10,100] | Both | 4[B-C], 4[D] |
| 8 | Survivorship | backtester._survivorshipCorr | Elton, Gruber & Blake (1996) | [0.92, 1.00] | Buy only | 3[C-D] |
| 9 | Signal Macro | macro_latest, bonds_latest (signals path) | Same as CONF-3 | [0.70, 1.25] | Composite-specific | Inherited |
| 10 | Wc Injection | patterns avg wc | Metadata only | No change | Both | N/A |

### Key Design Rationale per Function

**CONF-1 Market Context** applies consumer sentiment (CCSI) and
institutional flow thresholds. CCSI below 85 triggers a 12%
buy-pattern discount, reflecting Lemmon & Portniaguina's finding
that consumer sentiment extremes predict equity returns. The
earnings season flag applies a blanket 7% discount to all patterns
during reporting periods when corporate news dominates price action.

**CONF-2 RORO Regime** classifies a 3-state regime (risk-on /
neutral / risk-off) from a 5-factor weighted composite: VKOSPI/VIX
(0.30), AA- credit spread (0.10), US HY spread (0.10), USD/KRW
(0.20), MCS (0.15), and investor alignment (0.15). Hysteresis
(entry +/-0.25, exit +/-0.10) prevents regime chatter. The clamp
[0.92, 1.08] is deliberately narrow -- see Section 4.6 on
interaction effects.

**CONF-3 Macro 11-Factor** is the most complex function (258 lines,
11 independent factors): business cycle + Stovall sector rotation,
yield curve 4-regime, credit regime (Gilchrist & Zakrajsek 2012),
foreign investor signal, pattern-specific overrides, MCS v1
(with v2 double-application guard), Taylor Rule gap, VRP,
KR-US rate differential, rate beta x interest rate direction
(Damodaran 2012, 12 sectors), and KOSIS CLI-CCI gap.

**CONF-4 Micro** uses Amihud ILLIQ (2002) to discount illiquid
stocks (max 15% discount) and HHI to boost mean-reversion patterns
in concentrated industries (max 10% boost). This addresses the
Samsung 60,000 KRW vs. penny stock 1,000 KRW problem: a pattern
on a highly illiquid micro-cap deserves less confidence than the
same pattern on a liquid large-cap.

**CONF-5 Derivatives 6-Factor** integrates futures basis
(contango/backwardation, using excess basis when available),
PCR contrarian (Pan & Poteshman 2006), investor alignment,
ETF leverage sentiment (contrarian), short selling ratio, and
USD/KRW export channel. Factor 6 (ERP) was removed to prevent
double-application with signalEngine.

**CONF-6 Merton DD** applies the Bharath & Shumway (2008) naive
Distance-to-Default model. Financial sector stocks are excluded
(bank liabilities are operating assets). DD below 1.0 triggers
a 25% buy discount -- the largest single-factor penalty in the
chain. Uses EWMA volatility (lambda=0.94, RiskMetrics 1996)
and the KMV default point convention (0.75 x total liabilities).

**CONF-7 Phase 8** integrates MCS v2 (macro composite score with
double-application guard vs. CONF-3 Factor 6), HMM 3-state regime
classification (quality-gated: requires flowDataCount > 0), per-stock
foreign momentum alignment, and options IV/HV ratio (Simon & Wiggins
2001: when IV exceeds HV by 50%+, pattern accuracy drops 15-20%).

**CONF-8 Survivorship** applies a buy-only discount based on
Elton, Gruber & Blake (1996). With 308 delisted stocks excluded
from the OHLCV dataset, buy-pattern win rates are systematically
inflated. The correction (typically 1-3%, max 8%) is modest but
directionally correct and applies uniformly.

**CONF-9 Signal Macro** targets 5 specific high-conviction
composite signals with macro-conditional adjustments. Notable:
all 5 targets are sell-dominant, reflecting the empirical finding
that Korean bearish patterns have stronger directional
predictability (WR 57-75% vs. bullish 40-47%).

**CONF-10 Wc Injection** injects the average Wc (adaptive weight)
from patterns into signals as metadata. No confidence modification.

> **D2 Source:** S3_confidence_chain_v7.md Sections 3.6.2-3.6.11

---

## 4.4 Data Dependency Map

The following diagram maps which JSON data files feed which CONF
functions. This reveals critical dependency concentrations: the
loss of a single file can degrade multiple confidence functions
simultaneously.

```
DATA DEPENDENCY: JSON Files -> CONF Functions
=============================================

  macro_latest.json ----+-> CONF-2 (VIX, MCS, USD/KRW)
                        +-> CONF-3 (Taylor gap, yield)
                        +-> CONF-9 (Signal macro)

  bonds_latest.json ----+-> CONF-2 (AA- credit spread)
                        +-> CONF-3 (yield levels)
                        +-> CONF-6 (risk-free rate)
                        +-> CONF-9 (Signal macro)

  kosis_latest.json ----+-> CONF-3 (CLI, IPI, CCSI)

  market_context.json --+-> CONF-1 (CCSI, flow, earnings)

  macro_composite.json -+-> CONF-7 (MCS v2)

  investor_summary -----+-> CONF-2 (investor alignment)
                        +-> CONF-5 (foreign/inst flow)

  derivatives_summary --+-> CONF-5 (basis, PCR)

  etf_summary.json -----+-> CONF-5 (leverage ratio)

  shortselling_summary -+-> CONF-5 (short ratio)

  basis_analysis.json --+-> CONF-5 (basis z-score)

  options_analytics ----+-> CONF-7 (implied move, GEX)

  flow_signals.json ----+-> CONF-7 (flow, HMM regime)

  candles (OHLCV) ------+-> CONF-4 (ILLIQ calc)
                        +-> CONF-6 (equity vol calc)

  financials cache -----+-> CONF-6 (debt ratio)

  IMPACT ANALYSIS:
  bonds_latest.json missing -> 4 functions degraded
  macro_latest.json missing -> 3 functions degraded
  investor_summary  missing -> 2 functions degraded

```

**Critical Dependency:** `bonds_latest.json` feeds 4 CONF
functions (CONF-2, CONF-3, CONF-6, CONF-9) -- the highest
fan-out of any single data file. Its absence degrades RORO
regime classification (missing credit spread), macro adjustment
(missing yield levels), Merton DD (missing risk-free rate fallback
used for discounting), and signal-level macro conditioning.

This dependency concentration motivates the pipeline reliability
checks described in Chapter 2 (Section 2.5): verify.py CHECK 6
specifically validates the presence and freshness of each data
file in the pipeline contract.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.4

---

## 4.5 Null-Safety Architecture

Every function in the chain is designed for graceful degradation.
When a data source is unavailable, the function either returns
immediately (no-op) or skips the individual factor, ensuring
that missing data never causes a crash or produces undefined
behavior.

### Guard Strategy by Function

| CONF | Guard Condition | Behavior |
|------|----------------|----------|
| 1 | `_marketContext === null` or `source === 'demo'` | Immediate return |
| 2 | All 5 factors null (`count === 0`) | Regime = neutral, no-op |
| 2 | Fewer than 3 factors available | Score proportionally discounted |
| 3 | `!macro && !bonds` | Immediate return |
| 3 | Individual factor null | That specific factor skipped (11 checks) |
| 4 | `candles.length < 21` | `_microContext = null`, no-op |
| 5 | All derivatives sources null | Immediate return |
| 6 | Financial sector stock | DD computation skipped (meaningless) |
| 6 | Seed financial data | DD computation blocked |
| 7 | `mcsV2 === null` | MCS sub-function skipped |
| 7 | `flowDataCount === 0` | HMM + flow section skipped |
| 8 | `_survivorshipCorr` undefined | Immediate return |

### Loader-Level Source Guards

Before data reaches the chain, the data loaders apply source
guards that nullify unreliable data at the entry point:

| Data | Guard | Effect |
|------|-------|--------|
| `_investorData` | `source === 'sample'` | Set to null |
| `_shortSellingData` | `source === 'sample'` or `'unavailable'` | Set to null |
| `_macroComposite` | `status === 'error'` or sample/demo | Set to null |
| `_optionsAnalytics` | `status === 'error'` or sample/demo | Set to null |

This two-layer guard architecture (loader-level + function-level)
ensures that neither fake data nor missing data can corrupt
confidence adjustments.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.4

---

## 4.6 Interaction Effects

### Deliberate Narrow Clamping (RORO)

CONF-2 (RORO) uses a deliberately narrow clamp of [0.92, 1.08]
-- the tightest in the chain. This is not a limitation but a
design decision to prevent double-counting.

The RORO composite score incorporates VIX (via VKOSPI proxy),
credit spreads, and MCS -- the same variables that appear
individually in CONF-3 (macro) and CONF-7 (Phase 8). Without
the narrow clamp, a VIX spike would be counted three times:
once in RORO factor scoring, once in CONF-3 Factor 8 (VRP),
and once in CONF-7 (MCS v2, which uses VIX as an input).

The narrow clamp ensures RORO provides a directional regime
signal (buy vs. sell bias) without amplifying the magnitude
beyond what the individual factors already contribute.

### MCS Double-Application Guard

MCS (Macro Composite Score) appears in two forms:
- **MCS v1** (simple): CONF-3 Factor 6, applied when v2 unavailable
- **MCS v2** (8-component): CONF-7, applied when available

An explicit guard (CONF-3 line 1218) skips MCS v1 when
`_macroComposite.mcsV2` is available, ensuring MCS is applied
exactly once in the chain -- either v1 or v2, never both.

### Historical Bug Fix: DD Double-Application

Previously, CONF-7 (Phase 8) applied a DD penalty (x0.90 for
DD < 2) on top of CONF-6's Merton DD adjustment (x0.82 for
DD < 1.5). The compound effect was 0.90 x 0.82 = 0.738 -- an
excessive 26% discount that could suppress creditworthy patterns.
This was fixed by removing DD from CONF-7 entirely, ensuring
credit risk is assessed in exactly one place (CONF-6).

### Compound Range Analysis

| Scenario | Compound Effect | Final on Base 50 |
|----------|----------------|-------------------|
| Normal market (1-3 factors) | 0.90 to 1.10 | 45 to 55 |
| Macro stress (contraction + inverted + VIX>30) | ~0.70-0.80 buy | ~35-40 |
| Strong bull (expansion + steep + aligned + MCS) | ~1.15-1.25 buy | ~58-63 |
| Crisis (DD<1.0 + bear + credit stress) | Buy -> floor 10 | 10 |

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.3

---

## 4.7 D-Grade Constant Audit: Honest Disclosure

Approximately 40% of the confidence chain's multiplier constants
are graded [D] -- meaning their magnitudes lack empirical
calibration against forward returns. This section provides an
honest accounting of what is and is not validated.

### What D-Grade Means

A [D]-grade constant has two properties:

1. **Direction is academically grounded.** The sign of the
   adjustment (which variables move confidence up vs. down) is
   supported by peer-reviewed research. For example, that credit
   stress should reduce buy-pattern confidence is supported by
   Gilchrist & Zakrajsek (2012).

2. **Magnitude is heuristic.** The specific multiplier value
   (e.g., x0.82 for credit stress) was set by domain judgment
   rather than optimized against historical data. The true
   optimal value could be x0.75 or x0.90 -- we do not know.

### High-Sensitivity D-Grade Constants

| Constant | Value | Function | Impact | Academic Direction |
|----------|-------|----------|--------|--------------------|
| REGIME_MULT bull buy | 1.10 | CONF-7 | +10% all buy | HMM regime (Doc46) |
| REGIME_MULT bear buy | 0.85 | CONF-7 | -15% all buy | HMM regime (Doc46) |
| CCSI_BEAR_MULT | 0.88 | CONF-1 | -12% buy | Lemmon & Portniaguina (2006) |
| CREDIT_STRESS_MULT | 0.82 | CONF-3 | -18% buy | Gilchrist & Zakrajsek (2012) |
| PCR_MULT | +/-0.08 | CONF-5 | +/-8% | Pan & Poteshman (2006) |
| DD_DANGER_BUY | 0.82 | CONF-6 | -18% buy | Merton (1974), B&S (2008) |
| DD_CRITICAL_BUY | 0.75 | CONF-6 | -25% buy | Merton (1974), B&S (2008) |

### Why This Is Acceptable (and Why It Matters)

The [D]-grade status does not invalidate the confidence pipeline.
It means:

1. **Factor directions are correct.** Illiquid stocks, credit-
   stressed firms, and risk-off regimes genuinely degrade pattern
   predictability. The academic literature is unambiguous on
   direction.

2. **Magnitudes are conservative.** The heuristic multipliers
   were set to be individually small (most < 15%) and compound
   slowly. The chain's multiplicative structure ensures that no
   single factor dominates, and the absolute clamp [10, 100]
   prevents runaway compounding.

3. **The alternative is worse.** Not adjusting for macro/credit/
   liquidity conditions (i.e., displaying raw pattern confidence)
   is demonstrably less accurate. A miscalibrated adjustment in
   the correct direction is better than no adjustment at all.

4. **Calibration path exists.** Each [D]-grade constant has a
   defined calibration procedure: cross-sectional IC testing
   against N-day forward returns, using the existing 303,956
   pattern instance backtest dataset. The infrastructure for
   Walk-Forward Evaluation and BH-FDR multiple testing correction
   (Chapter 6) is already in production.

### Calibration Priority Ranking

| Priority | Target | Rationale |
|----------|--------|-----------|
| 1 | REGIME_CONFIDENCE_MULT (CONF-7) | Applies to ALL patterns; miscalibration = systematic bias |
| 2 | CCSI / Credit / PCR (CONF-1,3,5) | Macro-level, >5% impact per factor |
| 3 | DD tier thresholds (CONF-6) | Step function; jump from 0.95 to 0.82 needs validation |
| 4 | Taylor / FX / CLI (CONF-3) | Small adjustments (<5%), lower priority |
| 5 | Hysteresis thresholds (CONF-2) | Regime switch timing, time-series backtest needed |

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.6

---

## 4.8 Sensitivity Ranking

The following table ranks all 8 pattern-affecting functions by
their maximum single-factor impact, providing a quick reference
for understanding which functions drive the largest confidence
movements.

| Rank | Function | Max Impact | Trigger Frequency |
|------|----------|-----------|-------------------|
| 1 | CONF-6 Merton DD | -25% buy | Rare (credit-impaired only) |
| 2 | CONF-3 Macro 11-Factor | [0.70, 1.25] | Always (if macro data loaded) |
| 3 | CONF-5 Derivatives | [0.70, 1.30] | When derivatives data available |
| 4 | CONF-7 Phase 8 HMM | +/-15% regime | When flow_signals has data |
| 5 | CONF-1 Market Context | -12% to +8% | When market_context loaded |
| 6 | CONF-4 Micro ILLIQ | -15% to +10% | Always (computed from candles) |
| 7 | CONF-2 RORO Regime | -8% to +6% | Always (>=1 factor available) |
| 8 | CONF-8 Survivorship | -8% max | When backtester loaded |

**Notable asymmetry:** The buy-side penalty maximum (-25% from
Merton DD) significantly exceeds the sell-side penalty maximum.
This reflects the deliberate design philosophy that the system
should be more cautious about buy signals than sell signals --
consistent with the empirical finding that buy-pattern win rates
are more fragile under adverse conditions than sell-pattern win
rates in the Korean market.

> **D2 Source:** S3_confidence_chain_v7.md Section 3.6.3

---

## 4.9 Chapter Summary

The confidence adjustment chain transforms raw pattern detections
into market-context-aware confidence scores through 10 sequential
multiplicative functions. Its key properties are:

1. **Multiplicative compounding** ensures independent factor
   contributions without single-factor dominance.

2. **Graceful degradation** via comprehensive null-safety means
   missing data produces neutral adjustments, never crashes.

3. **Narrow RORO clamping** prevents double-counting of shared
   variables (VIX, credit, MCS) across functions.

4. **Academic grounding** for all factor directions, with honest
   disclosure of [D]-grade magnitude heuristics.

5. **Triple call-site consistency** guarantees identical user
   experience across Worker, main-thread, and drag execution paths.

6. **Data dependency concentration** (bonds_latest.json feeds 4
   functions) motivates the pipeline reliability checks described
   in Chapter 2.

The chain's current IC of 0.051 (Chapter 6) confirms modest but
statistically significant predictive value -- appropriate for
short-horizon technical analysis and consistent with the system's
philosophy of honest, calibration-aware confidence reporting.

---

| D4 Section | D2 Source | D1 Source |
|------------|----------|----------|
| 4.1 Pipeline overview | S3_confidence_chain_v7.md 3.6.1 | P0 Section 1.1 |
| 4.2 Waterfall | S3_confidence_chain_v7.md 3.6.3 | -- |
| 4.3 Function table | S3_confidence_chain_v7.md 3.6.2-3.6.11 | P0 Section 2.3 |
| 4.4 Data dependency | S3_confidence_chain_v7.md 3.6.4 | -- |
| 4.5 Null safety | S3_confidence_chain_v7.md 3.6.4 | -- |
| 4.6 Interaction effects | S3_confidence_chain_v7.md 3.6.3 | -- |
| 4.7 D-grade audit | S3_confidence_chain_v7.md 3.6.6 | P0 Section 5.1 |
| 4.8 Sensitivity ranking | S3_confidence_chain_v7.md 3.6.3 | -- |

---

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

---

# Chapter 6: Risk Controls & Validation

> **D4 Structure Flow** -- CheeseStock / KRX Live Chart
> **Author**: statistical-validation-expert
> **Source Date**: 2026-04-07 (ANATOMY V7 production state)

---

## 6.1 The Validation Problem

A system detecting 30+ patterns across 2,700+ stocks and 5 return horizons
evaluates up to 607,500 (pattern, horizon, stock) triples. Without
statistical controls, random chance produces thousands of apparently
significant results. This chapter describes the seven gates every pattern
must survive, the empirical results, and the acknowledged limitations.

Cross-reference: D2 `P3_validation_risk.md` Sections 3.1--3.7.

## 6.2 Seven-Gate Validation Stack

Each pattern type passes through seven sequential gates. Failure at any
gate triggers tier demotion or rejection. Gates are ordered from
estimation through multiple-testing correction to survivorship adjustment.

| Gate | Method | Failure Mode Addressed | Academic Basis |
|------|--------|------------------------|----------------|
| 1 | WLS Regression (Ridge + HC3) | Heteroscedasticity in KRX returns | Hoerl & Kennard (1970); MacKinnon & White (1985) |
| 2 | Walk-Forward Evaluation | Overfitting to single train/test split | Pardo (2008); Bailey & Lopez de Prado (2014) |
| 3 | BH-FDR (q=0.05, 45 hypotheses) | False discoveries from multiple testing | Benjamini & Hochberg (1995) |
| 4 | Hansen SPA (B=500) | Data snooping across pattern universe | Hansen (2005) |
| 5 | BCa Bootstrap CI (500 rep) | Non-normal return distributions | Efron (1987); Fama & French (2010) |
| 6 | Rolling OOS IC | In-sample IC inflation | Grinold & Kahn (2000) |
| 7 | Survivorship Correction | Delisted-stock bias (308 stocks) | Elton, Gruber & Blake (1996) |

**Gates 1--2: Estimation and overfitting control.** Ridge-penalized WLS
with GCV-selected lambda provides stable coefficients; HC3 standard
errors (sandwich estimator with Ridge-penalized inverse) produce valid
inference under the heteroscedastic returns caused by KRX's +-30% daily
price limit. Walk-Forward Evaluation (4--6 expanding-window folds,
2x-horizon purge gap) measures out-of-sample retention: WFE < 30%
demotes to Tier C regardless of in-sample statistics.

**Gates 3--4: Multiple testing and data snooping.** BH-FDR controls the
false discovery proportion at 5% across 45 per-stock hypotheses --
substantially more powerful than Bonferroni while maintaining statistical
rigor. Hansen SPA tests whether the best pattern genuinely outperforms a
random-entry benchmark; SPA failure demotes all Tier A/B patterns to C.

**Gate 5: Distribution robustness.** Calendar-time block bootstrap
(resampling whole months) preserves within-month dependence. BCa
correction provides second-order accurate coverage for KRX's skewed,
leptokurtic returns. Winsorization at 1st/99th percentile bounds CI width.

**Gate 6: Predictive power.** Spearman rank IC on non-overlapping OOS
windows gates tier promotion: IC > 0.02 for Tier A, IC > 0.01 for B.

**Gate 7: Survivorship.** Three-tier lookup corrects buy-pattern WR
inflation from 308 missing delisted stocks. Adjustment clamped [0.92, 1.0].

Cross-reference: D2 `P3_validation_risk.md` Sec 3.1--3.4;
`S3_signal_backtester_v7.md` BT-01 through BT-28.

---

## 6.3 Validation Gate Flow

```
   VALIDATION GATE FLOW (per pattern type)
   ========================================

   Raw Pattern Occurrences (303,956 instances)
          |
          v
   [Gate 1] WLS Regression (Ridge + HC3)
          |  HC3 SEs for heteroscedasticity
          v
   [Gate 2] Walk-Forward Evaluation
          |  4-6 folds, purge = 2 x horizon
          |  WFE < 30% --> demote to C
          v
   [Gate 3] BH-FDR (q=0.05, 45 hypotheses)
          |  Reject where p_(k) <= k * q / m
          v
   [Gate 4] Hansen SPA (B=500)
          |  H0 not rejected --> A/B to C
          v
   [Gate 5] BCa Bootstrap CI (500 rep)
          |  Calendar-time block resampling
          v
   [Gate 6] Rolling OOS IC (Spearman)
          |  IC > 0.02: A | IC > 0.01: B
          v
   [Gate 7] Survivorship Correction
          |  308 delisted, Elton et al. (1996)
          |  Buy WR adjusted down 0.1-1.1pp
          v
   Tier Assignment: A / B / C / D
```

---

## 6.4 Information Coefficient: Honest Disclosure

The system-wide IC (Huber-IRLS, post-upgrade) is **0.051**. Published
equity factor ICs range from 0.03 to 0.10 (Grinold & Kahn 2000). At
0.051 the system sits in the lower-middle of this range -- modest but
non-trivial for short-horizon single-stock TA on a mid-tier emerging
market. The system does not claim alpha-generating performance.

Pre-upgrade OLS IC was ~0.013 (near-random). The gain comes from robust
down-weighting of outlier returns at KRX's +-30% price limit (Huber
1964, delta = 1.345 x sigma, sigma = 4.3% from 5-day MAD).

**Known limitation.** Regression coefficients in the IC calculation path
are fitted on the full training set, not refitted per OOS fold. True
recursive OOS IC (available in the WFE path, Gate 2) would be lower.
Flagged as Warning W-4 in the backtester.

Cross-reference: D2 `P3_validation_risk.md` Section 3.1.2--3.1.3.

---

## 6.5 Formula-Code Fidelity

An independent audit spot-checked 15 key formulas from ANATOMY
documentation against production JS/Python, symbol-by-symbol.

| Verdict | Count | Interpretation |
|---------|-------|----------------|
| MATCH | 12 | Exact correspondence between doc and code |
| MINOR_DIFF | 3 | Documentation precision issues; no code errors |
| DISCREPANCY | 0 | None found |

**Overall grade: A.** The three MINOR_DIFF items are documentation-level:
(1) BND-9/BND-10 label swap in a cross-reference table -- code implements
Bharath-Shumway (2008) naive DD correctly as BND-10; (2) MCS v2 consumer
confidence normalization range undocumented for BSI fallback [50,120] vs
ESI primary [60,130]; (3) JS live beta omits Blume (1975) adjustment by
design, but the documentation provenance chain does not note this.

Ten cross-file consistency checks confirmed Python and JS share identical
constants for risk-free rate, minimum observations, trading days (250),
thin-trading thresholds, and Scholes-Williams denominator guards.

Cross-reference: D2 `S0_formula_fidelity_v7.md` (full audit).

---

## 6.6 End-to-End Pipeline Traces

Five pipelines traced from external API through scripts, JSON storage,
and JS runtime to browser rendering. All passed without broken links.

| # | Pipeline | Source | Destination | Status |
|---|----------|--------|-------------|--------|
| 1 | KTB 10Y Bond | ECOS API (817Y002) | financials.js | PASS |
| 2 | Investor Flow | KRX OTP auth | Confidence chain | PASS |
| 3 | Hurst Exponent | OHLCV candles | Price target | PASS |
| 4 | Hammer Signal | patterns.js | signalRenderer | PASS |
| 5 | Backtest Tier | backtester.js | patternPanel badge | PASS |

Each trace verified: (a) API endpoint and schema, (b) sample-data guards
preventing synthetic data from entering the confidence chain, (c) JSON
intermediate schema, and (d) rendered output matching computed value.

Cross-reference: D2 `S0_cross_stage_verification_v7.md` Section 0.1.

---

## 6.7 Deployment Quality Gates

Five formal gates protect correctness across sessions, multi-agent runs,
and deploys.

| Gate | Name | Type | Trigger |
|------|------|------|---------|
| 1 | CHECK 6: Pipeline Connectivity | Automated | Every `verify.py` run |
| 2 | Browser Smoke Test | Manual, 10 items | After multi-file change |
| 3 | Change Contract | Document template | 6+ agents or 3+ JS files |
| 4 | ANATOMY-First Workflow | Read-then-write | 3+ JS files touched |
| 5 | Session Start/End Protocol | Checklists | Every session |

**Gate 1** validates 12 JSON data sources against a schema contract: file
existence, required keys, sample-data guards, array non-emptiness, and
14-day staleness. Catches silent failures where API scripts exit
successfully but produce stale output.

**Gate 2** covers initialization (index load, Worker startup, console
errors), data pipeline (chart render, macro load), pattern pipeline
(detection toast, panel cards), UI integrity (vizToggles, responsive
layout), and deploy integrity (no 404s, Service Worker).

**Gates 3--5** prevent multi-agent drift: Change Contract enforces file
ownership; ANATOMY-First ensures docs update before code; Session
Protocol requires `verify.py --strict` pass at session start and end.

Cross-reference: `.claude/rules/quality-gates.md`.

---

## 6.8 Honest Limitations

The following gaps are disclosed to prevent overclaiming.

**1. No true real-time OOS validation.** All validation runs on historical
OHLCV data. No paper-trading or live-fill loop exists to verify that
confidence scores predict forward returns in deployment conditions.

**2. Execution quality is unmeasured.** The backtester assumes next-candle-
open entry and 0.265% round-trip cost. Actual slippage, market impact
(especially small-cap KOSDAQ), and routing latency are not captured.

**3. Regime robustness is backward-looking.** HMM regime labels lag during
transitions (BOK surprises, circuit breakers). Confidence adjustments may
be directionally wrong until re-classification completes.

**4. D-grade constant sensitivity.** ~73 constants lack published source or
calibration. Highest-impact: regime multipliers (CONF-7, +-10-15% on all
patterns). A 255,000+ pattern recalibration with 70/30 split produced
worse OOS IC than academic defaults -- current heuristics remain in force.

**5. Cross-stock MTC absent.** BH-FDR is per-stock only. The 2,700 x 225
= 607,500 effective test count has no portfolio-level correction.

**6. Survivorship correction is statistical, not data reconstitution.**
The 308-stock delta adjusts win rates but does not include actual
delisted return series. Tail risk from bankruptcies is not in bootstraps.

Cross-reference: D2 `P3_validation_risk.md` Section 3.8.

---

## 6.9 Summary

Seven sequential gates applied to 303,956 pattern instances produce
IC = 0.051 (modest by factor standards). Formula fidelity: 12/15 exact,
3 minor doc issues, 0 code errors. Five pipeline traces: all PASS. Five
deployment gates protect production. The system discloses what it does
not validate: real-time OOS, execution quality, regime transitions,
D-grade magnitudes, cross-stock MTC, and delisted tail risk.

---

# Appendix A: Cross-Reference Index

The following table maps every D4 section to its primary D2 source document and D1 section where applicable. D2 documents are located in `docs/anatomy/`. D1 is `docs/anatomy/deliverable1_executive/P0_executive_summary.md`.

## A.1 Chapter 1: System Architecture

| D4 Section | D2 Source Document | D1 Section |
|------------|-------------------|------------|
| 1.1 Platform Identity | `S0_index_v7.md` (lines 1-30) | P0 Sections 2.1, 2.3 |
| 1.2 Hero Pipeline Diagram | `S0_index_v7.md` (lines 19-30), `S1_api_pipeline_v7_sec1to4.md` (sec 1.1-1.5) | P0 Section 2.1 |
| 1.3 Technology Stack | `S5_ui_architecture_v7.md` (sec 5.1) | P0 Section 2.3 |
| 1.4 Scale Summary | `S0_index_v7.md` Formula Registry, `S1_api_pipeline_v7_sec5to8.md` (sec 1.6.6), `S3_ta_methods_v7.md` | P0 Section 2.1 |
| 1.5 Dual-Mode Architecture | `S5_lifecycle_workers_v7.md` (sec 5.5.2) | P0 Section 2.3 |
| 1.6 Initialization Lifecycle | `S5_lifecycle_workers_v7.md` (sec 5.5.3, 5.5.5) | P0 Section 2.3 |
| 1.7 Four-Column UI Grid | `S5_ui_architecture_v7.md` (sec 5.1) | P0 Section 2.3 |
| 1.8 Web Worker Architecture | `S5_lifecycle_workers_v7.md` (sec 5.6.1-5.6.2) | P0 Section 2.3 |

## A.2 Chapter 2: Data Provenance

| D4 Section | D2 Source Document | D1 Section |
|------------|-------------------|------------|
| 2.2 API Source Map | `S1_api_pipeline_v7_sec1to4.md` (sec 1.1-1.4) | P0 Section 2.1 |
| 2.2.2 Compute Scripts | `S1_api_pipeline_v7_sec5to8.md` (sec 1.5.1-1.5.15) | P0 Section 4.1 |
| 2.3 Data Trust Decision Tree | `.claude/rules/financial.md`, `S1_api_pipeline_v7_sec5to8.md` (sec 1.6.6) | P0 Section 5.1 |
| 2.4 JSON File Catalog | `S1_api_pipeline_v7_sec5to8.md` (sec 1.5.13-1.5.14, 1.6.4) | P0 Section 2.1 |
| 2.5 Pipeline Reliability | `S1_api_pipeline_v7_sec9.md` (sec 1.9.1-1.9.2) | P0 Section 4.1 |
| 2.6 Sample Data Guard | `S1_api_pipeline_v7_sec5to8.md` (sec 1.6.1-1.6.4) | P0 Section 5.1 |
| 2.7 CHECK 6 Staleness | `.claude/rules/quality-gates.md` Gate 1 | P0 Section 4.1 |
| 2.8 Three-Batch Loader | `S1_api_pipeline_v7_sec5to8.md` (sec 1.7) | P0 Section 2.1 |
| 2.9 DART Pipeline | `S1_api_pipeline_v7_sec1to4.md` (sec 1.4), `.claude/rules/financial.md` | P0 Section 4.1 |

## A.3 Chapter 3: Analysis Engine

| D4 Section | D2 Source Document | D1 Section |
|------------|-------------------|------------|
| 3.1 Three-Layer Architecture | `S3_ta_methods_v7.md` (sec 3.1-3.2), `S3_signal_backtester_v7.md` (sec 3.3-3.5) | P0 Section 1.1 |
| 3.2 Layer 1 Indicators | `S3_ta_methods_v7.md` (sec 3.1.1-3.1.6) | P0 Section 1.1 |
| 3.3 Layer 2 Patterns | `S3_ta_methods_v7.md` (sec 3.2.1-3.2.6) | P0 Section 1.3 |
| 3.4 ATR Normalization | `S3_ta_methods_v7.md` (sec 3.2.1), `.claude/rules/patterns.md` | P0 Section 1.3 |
| 3.5 Layer 3 Signal Flow | `S3_signal_backtester_v7.md` (sec 3.3.1-3.3.5) | P0 Section 1.1 |
| 3.6 Backtester Summary | `S3_signal_backtester_v7.md` (sec 3.4.2, 3.5.2-3.5.6) | P0 Section 5.2 |
| 3.7 Worker Protocol | `.claude/rules/patterns.md`, `S3_signal_backtester_v7.md` (sec 3.4) | P0 Section 1.1 |
| 3.8 End-to-End Flow | `S3_ta_methods_v7.md`, `S3_signal_backtester_v7.md` | P0 Section 1.1 |

## A.4 Chapter 4: Confidence Pipeline

| D4 Section | D2 Source Document | D1 Section |
|------------|-------------------|------------|
| 4.1 Pipeline Overview | `S3_confidence_chain_v7.md` (sec 3.6.1) | P0 Section 1.1 |
| 4.2 Confidence Waterfall | `S3_confidence_chain_v7.md` (sec 3.6.3) | -- |
| 4.3 Function-by-Function | `S3_confidence_chain_v7.md` (sec 3.6.2-3.6.11) | P0 Section 2.3 |
| 4.4 Data Dependency Map | `S3_confidence_chain_v7.md` (sec 3.6.4) | -- |
| 4.5 Null-Safety Architecture | `S3_confidence_chain_v7.md` (sec 3.6.4) | -- |
| 4.6 Interaction Effects | `S3_confidence_chain_v7.md` (sec 3.6.3) | -- |
| 4.7 D-Grade Constant Audit | `S3_confidence_chain_v7.md` (sec 3.6.6), `S2_sec25_v7.md`, `S2_sec27_v7.md` | P0 Section 5.1 |
| 4.8 Sensitivity Ranking | `S3_confidence_chain_v7.md` (sec 3.6.3) | -- |
| 4.9 Chapter Summary | `S3_confidence_chain_v7.md` | P0 Sections 1.1, 2.3, 5.1 |

## A.5 Chapter 5: Classification and Rendering

| D4 Section | D2 Source Document | D1 Section |
|------------|-------------------|------------|
| 5.2 Five-Tier Matrix | `S4_chart_rendering_v7.md` (sec 4.2-4.3), `S3_signal_backtester_v7.md` (sec 3.5.6) | P0 Section 5.3 |
| 5.3 9+4 Layer Stack | `S4_chart_rendering_v7.md` (sec 4.2.2-4.2.13, 4.3.1-4.3.6), `.claude/rules/rendering.md` | P0 Section 5.3 |
| 5.4 Density Control | `S4_chart_rendering_v7.md` (sec 4.2.3), `.claude/rules/rendering.md` | P0 Section 5.3 |
| 5.5 Color System | `.claude/rules/colors.md`, `S4_chart_rendering_v7.md` (sec 4.2.5-4.2.13) | P0 Section 5.3 |
| 5.6 ISeriesPrimitive Reconnection | `S4_chart_rendering_v7.md` (sec 4.2.1, 4.1.6), `.claude/rules/rendering.md` | P0 Section 5.3 |
| 5.7 Detection-to-Display Funnel | `S4_chart_rendering_v7.md`, `S3_signal_backtester_v7.md` | P0 Section 5.3 |

## A.6 Chapter 6: Risk Controls

| D4 Section | D2 Source Document | D1 Section |
|------------|-------------------|------------|
| 6.2 Seven-Gate Stack | `P3_validation_risk.md` (sec 3.1-3.4), `S3_signal_backtester_v7.md` (BT-01..BT-28) | P0 Section 5.2 |
| 6.3 Gate Flow | `P3_validation_risk.md` (sec 3.1-3.4) | P0 Section 5.2 |
| 6.4 IC Disclosure | `P3_validation_risk.md` (sec 3.1.2-3.1.3) | P0 Section 5.2 |
| 6.5 Formula-Code Fidelity | `S0_formula_fidelity_v7.md` | P0 Section 5.2 |
| 6.6 Pipeline Traces | `S0_cross_stage_verification_v7.md` (sec 0.1) | P0 Section 5.2 |
| 6.7 Deployment Quality Gates | `.claude/rules/quality-gates.md` | -- |
| 6.8 Honest Limitations | `P3_validation_risk.md` (sec 3.8) | P0 Section 5.2 |

---

# Appendix B: Terminology Glossary

One-line definitions for 35 terms used throughout this document. Academic references in parentheses indicate the source that defines or popularizes the term in the context used here.

**ATR** -- Average True Range: a 14-period measure of intraday price volatility, used throughout CheeseStock as the normalization denominator for all pattern geometry thresholds (Wilder 1978).

**BCa** -- Bias-Corrected and Accelerated bootstrap: a second-order accurate bootstrap confidence interval method that corrects for both bias and skewness in the sampling distribution (Efron 1987).

**BH-FDR** -- Benjamini-Hochberg False Discovery Rate: a multiple testing correction that controls the expected proportion of false discoveries at level q=0.05, applied across 45 pattern hypotheses per stock (Benjamini & Hochberg 1995).

**CCSI** -- Consumer Confidence Survey Index: a monthly Korean consumer sentiment index published by the Bank of Korea (BOK); used in CONF-1 to gate buy-pattern confidence when sentiment falls below 85.

**CONF-N** -- Confidence function N in the 10-function multiplicative adjustment chain; CONF-1 through CONF-10 refer to the sequential functions applied to every detected pattern's confidence score in `appWorker.js`.

**DART** -- Data Analysis, Retrieval and Transfer system: the Korean Financial Supervisory Service (FSS) open disclosure platform for K-IFRS financial statements (opendart.fss.or.kr).

**DD** -- Distance-to-Default: a Merton (1974) model-derived measure of how many standard deviations of asset value separate a firm from its default point; implemented via Bharath & Shumway (2008) naive approximation in CONF-6.

**DRV** -- Derivatives: collective term for futures, options, and related instruments traded on the KRX derivatives market; used loosely to describe the derivatives data pipeline feeding CONF-5.

**ECOS** -- Economic Statistics System: the Bank of Korea's open API for macroeconomic data including KTB yields, monetary aggregates, and credit spreads (ecos.bok.or.kr).

**EDF** -- Empirical Distribution Function: the sample-based cumulative distribution function used in non-parametric bootstrap procedures; referenced in the BCa CI computation.

**EVA** -- Economic Value Added: a measure of economic profit computed as NOPAT minus the WACC-based capital charge on invested capital; displayed in the Column D financial panel from `data/backtest/eva_scores.json`.

**GCV** -- Generalized Cross-Validation: a computationally efficient leave-one-out cross-validation approximation used to select the Ridge regularization parameter lambda automatically (Golub, Heath & Wahba 1979).

**GEX** -- Gamma Exposure: the aggregate options market-maker delta-hedging demand derived from outstanding options positions; used in CONF-7 as an input to options analytics from `options_analytics.json`.

**HC3** -- Heteroskedasticity-Consistent standard errors with jackknife correction: a sandwich estimator that provides valid inference under unknown heteroskedasticity in small to moderate samples (MacKinnon & White 1985).

**HHI** -- Herfindahl-Hirschman Index: a measure of market concentration calculated as the sum of squared market share fractions across firms in an industry; used in CONF-4 to boost mean-reversion patterns in concentrated sectors.

**HMM** -- Hidden Markov Model: a probabilistic regime-switching model estimated via Baum-Welch EM; used in `compute_hmm_regimes.py` to classify the market into 2-3 latent regimes that feed CONF-7.

**IC** -- Information Coefficient: Spearman rank correlation between predicted confidence scores and subsequent N-day returns; the primary out-of-sample predictive power metric, currently 0.051 system-wide.

**ILLIQ** -- Amihud Illiquidity Ratio: daily absolute return divided by daily KRW trading volume, averaged over a lookback period; measures price impact per unit of trading volume (Amihud 2002).

**ISeriesPrimitive** -- TradingView Lightweight Charts v5.1.0 interface for custom Canvas2D overlays attached to a specific chart series; the mechanism through which PatternRenderer and SignalRenderer draw all pattern and signal annotations.

**K-IFRS** -- Korean International Financial Reporting Standards: the Korean adoption of IFRS used by all KRX-listed companies for financial statement preparation; the source standard for DART-reported financial data.

**KRX** -- Korea Exchange: the unified exchange operating KOSPI (large-cap) and KOSDAQ (growth/tech) markets in South Korea; the primary data source for all OHLCV price data.

**KSIC** -- Korean Standard Industry Classification: the official industry taxonomy used for sector-rotation analysis in CONF-3 and peer group comparisons in the financial panel.

**LWC** -- TradingView Lightweight Charts: the open-source charting library (v5.1.0) used for all price chart rendering; provides candlestick, line, and area series with ISeriesPrimitive custom overlay support.

**MAC** -- Moving Average Cross: a signal generated when two moving averages of different periods cross; detected by the MA cross detector (SIG-01) in the signal engine.

**MCS** -- Macro Composite Score: an 8-factor composite score (0-100) computed by `compute_macro_composite.py` from ECOS, FRED, and KOSIS inputs; v1 (simple) used in CONF-3, v2 (full) used in CONF-7.

**MIC** -- Maximal Information Coefficient: a non-parametric measure of dependence between two variables; referenced in the theoretical basis for non-linear factor relationships.

**OHLCV** -- Open, High, Low, Close, Volume: the standard five-field candlestick data format used throughout the system; stored in per-stock JSON files and passed to the analysis pipeline.

**OOS** -- Out-of-Sample: data held out from model training and used exclusively for evaluation; the fundamental distinction between in-sample (IS) fitting and OOS generalization testing.

**PCR** -- Put-Call Ratio: the ratio of put option open interest to call option open interest; used as a contrarian sentiment indicator in CONF-5 (Pan & Poteshman 2006).

**RORO** -- Risk-On / Risk-Off: a market regime classification describing investor risk appetite; CONF-2 classifies the market into 3 states (risk-on / neutral / risk-off) from a 5-factor composite including VKOSPI, credit spreads, and USD/KRW.

**SPA** -- Superior Predictive Ability test: a bootstrap test (B=500 replicates) that evaluates whether the best strategy in a universe genuinely outperforms a random-entry benchmark, guarding against data snooping (Hansen 2005).

**VRP** -- Variance Risk Premium: the spread between implied volatility (from options) and realized volatility (from OHLCV); represents compensation demanded by sellers of volatility insurance; used in CONF-3 Factor 8.

**Wc** -- Adaptive weight coefficient: a composite confidence-weighted factor derived from pattern characteristics; injected into signals as metadata by CONF-10 and used to modulate forecast zone opacity and diamond marker size in the rendering layer.

**WFE** -- Walk-Forward Evaluation: an expanding-window backtesting protocol that measures the ratio of OOS performance to IS performance across multiple folds; WFE >= 50% is "robust", < 30% triggers tier demotion to C.

**WLS** -- Weighted Least Squares: a regression variant that applies exponentially decaying weights (lambda=0.995, half-life ~7 months) to recent observations, implementing the Adaptive Markets Hypothesis principle that recent data is more regime-representative (Lo 2004).

---

End of Deliverable 4: Structure Flow / CheeseStock Production Anatomy V7 / Generated: 2026-04-07
