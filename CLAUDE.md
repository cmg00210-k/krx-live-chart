# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KRX Live Chart — a frontend-only Korean stock market (KOSPI/KOSDAQ) charting web app with technical analysis. No build system, no bundler, no backend. Open `index.html` directly in a browser.

## Architecture

**No module system.** All JS files use global variables and classes. Script load order in `index.html` is critical:

```
data.js → api.js → patterns.js → chart.js → app.js
```

Breaking this order causes reference errors (e.g., `ALL_STOCKS` from api.js is used in app.js).

### File Responsibilities

| File | Globals Exported | Role |
|------|-----------------|------|
| `js/data.js` | `PAST_DATA`, `getPastData()` | Historical financial data |
| `js/api.js` | `KRX_API_CONFIG`, `ALL_STOCKS`, `DEFAULT_STOCKS`, `TIMEFRAMES`, `dataService` | Data service layer (file/demo/KIS tri-mode, 2,700+ stocks from index.json) |
| `js/patterns.js` | `patternEngine` | PatternEngine class — 20+ candlestick/chart patterns with ATR normalization, quality scoring |
| `js/chart.js` | `chartManager`, `calcMA()`, `calcEMA()`, `calcBB()`, `calcRSI()`, `calcMACD()`, `calcATR()`, `calcIchimoku()`, `calcKalman()`, `calcHurst()` | ChartManager class using TradingView Lightweight Charts v4.2.0 |
| `js/app.js` | (none — side effects only) | State management, UI event binding, initialization |
| `css/style.css` | — | All styling |
| `index.html` | — | DOM structure, CDN script for lightweight-charts |

### Key Patterns

- **ChartManager** uses `_resizeMap` (Map) to track ResizeObservers per container, preventing memory leaks.
- **Sub-charts** (RSI, MACD) have explicit `destroyRSI()` / `destroyMACD()` methods that clean up observers and rebuild time scale sync.
- **Time scale sync** across main/RSI/MACD charts uses `_syncUnsubs` array; `_rebuildSync()` unsubscribes all before re-subscribing.
- **Pattern analysis** is throttled to 3-second intervals (`_lastPatternAnalysis` in app.js) to avoid performance issues.
- **Pattern button** uses class `.pattern-btn` and is excluded from indicator handlers via `.ind-btn:not(.pattern-btn)`.

### Data Flow

```
dataService.getCandles(stock, timeframe)
  → candles[] (OHLCV array)
    → patternEngine.analyze(candles) → patterns[]
    → chartManager.updateMain(candles, chartType, indicators, patterns)
    → chartManager.updateRSI(candles) / updateMACD(candles)
```

### Data Modes

- **file** (default): Loads real OHLCV from `data/kospi/`, `data/kosdaq/` JSON files. Daily only — intraday falls back to demo. Stock list from `data/index.json`.
- **demo**: Deterministic simulated data using stock code hash as random seed.
- **kis**: 한국투자증권 OpenAPI (requires backend CORS proxy).

`data/` folder is in `.gitignore` — generated locally by `scripts/download_ohlcv.py`.

## Collaboration Rules (from GUIDE.md)

- **chart.js** = technical analysis owner
- **css/style.css + index.html** = UI/design owner
- **app.js** = shared — coordinate before editing
- Never `git add .` — stage specific files only
- Never `git push --force`
- Always `git pull` before starting work

## Academic Documents (core_data/)

15 markdown documents (Korean with English terms) providing mathematical foundations for the technical analysis system. These are documentation only — not loaded at runtime. Formulas have been verified and corrected for:
- VaR/ES formulas (EVT), Kelly criterion (continuous version), ATR normalization
- Unit clarification (σ types, RSI units, VaR holding period, Sharpe annualization)
- Outdated theory warnings (ARIMA, CAPM, DQN, prospect theory parameters)

## Development

No build step. To develop:
1. Open `index.html` in a browser (or use VS Code Live Server)
2. Check F12 Console for errors
3. Demo mode runs automatically with simulated data

To use real KIS API data, set `KRX_API_CONFIG.mode = 'kis'` in api.js (requires backend CORS proxy).

## Common Pitfalls

- Adding `<script>` tags out of order breaks everything
- Sub-chart labels must be **outside** chart containers (Lightweight Charts takes over container DOM)
- Markers in line chart mode must be set on `indicatorSeries._priceLine`, not `candleSeries`
- `calcEMA([])` and `calcMACD()` with empty valid data need early returns to avoid NaN propagation
