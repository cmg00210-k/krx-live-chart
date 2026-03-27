# Architecture Reference

## File Responsibilities (16 JS + 1 Worker)

| File | Globals Exported | Role |
|------|-----------------|------|
| `js/colors.js` | `KRX_COLORS` | Frozen color constants (30+) |
| `js/data.js` | `PAST_DATA`, `getPastData()`, `getFinancialData()` | Financial data with 3-tier fallback (DART→hardcoded→seed) |
| `js/api.js` | `_idb`, `KRX_API_CONFIG`, `ALL_STOCKS`, `DEFAULT_STOCKS`, `TIMEFRAMES`, `dataService` | Data service (ws/file/demo/koscom), L1 memory + L2 IndexedDB + L3 network caching |
| `js/realtimeProvider.js` | `realtimeProvider` | WebSocket client for Kiwoom OCX, demo fallback |
| `js/indicators.js` | `calcMA()`, `calcEMA()`, `calcBB()`, `calcRSI()`, `calcMACD()`, `calcATR()`, `calcIchimoku()`, `calcKalman()`, `calcHurst()`, `calcWLSRegression()`, `_invertMatrix()`, `IndicatorCache` | 9 indicators + WLS regression + lazy-eval cache |
| `js/patterns.js` | `patternEngine` | PatternEngine — 30+ patterns (21 candle + 9 chart + S/R), ATR normalization, quality scoring |
| `js/signalEngine.js` | `COMPOSITE_SIGNAL_DEFS`, `signalEngine` | 16 indicator signals + 6 composite signals (3 tiers, 5-bar window) + divergence |
| `js/chart.js` | `chartManager` | TradingView Lightweight Charts v5.1.0 wrapper |
| `js/patternRenderer.js` | `patternRenderer` | ISeriesPrimitive Canvas2D pattern viz, 9 draw layers, MAX_PATTERNS=3 |
| `js/signalRenderer.js` | `signalRenderer` | ISeriesPrimitive signal viz (diamonds, stars, vbands, divlines) |
| `js/backtester.js` | `backtester` | Per-pattern N-day return stats + WLS regression prediction |
| `js/analysisWorker.js` | (Web Worker) | Offloads analysis; importScripts: colors, indicators, patterns, signalEngine, backtester |
| `js/sidebar.js` | `sidebarManager` | Virtual scroll (2700+ stocks, ~40 DOM) |
| `js/patternPanel.js` | `PATTERN_ACADEMIC_META`, `renderPatternPanel()` | 30+ pattern academic metadata + UI panel |
| `js/financials.js` | `updateFinancials()`, `drawFinTrendChart()` | Financial panel (D column): PER/PBR/PSR, CAGR, investment score |
| `js/drawingTools.js` | `drawingTools` | Drawing overlay (trendline, hline, vline, rect, fib, eraser) + localStorage |
| `js/app.js` | (side effects) | State management, UI events, initialization, Worker orchestration |

## Data Flow

```
app.js init() → dataService.initFromIndex() → loads data/index.json → populates ALL_STOCKS

dataService.getCandles(stock, timeframe)
  → file mode: fetch data/{market}/{code}.json (daily) or {code}_{timeframe}.json (intraday)
  → ws mode: Kiwoom TR subscribe (file fallback if disconnected)
  → demo mode: deterministic seed-based simulation

Analysis (main thread or Web Worker):
  patternEngine.analyze(candles) → patterns[]
  signalEngine.analyze(candles, patterns) → { signals[], cache, stats }
  backtester.backtestAll(candles) → backtestResults[]

Rendering:
  chartManager.updateMain() → _renderOverlays()
    → _filterPatternsForViz() (vizToggles filter at render time)
    → patternRenderer.render() + signalRenderer.render()
```
