# pattern_impl/ -- Academic Theory to Code Implementation Bridge

> Maps the flow: Academic theory (core_data/) -> Pattern definition (pattern_impl/) -> Code (js/)

**Regenerated:** 2026-04-06, post D-heuristic constant audit (commit 05ceed1a2)

---

## Document Structure

| # | File | Scope | Lines |
|---|------|-------|-------|
| 1 | [01_candle_patterns.md](01_candle_patterns.md) | 33 candle patterns: detection, constants, ATR normalization, quality scoring | 1,028 |
| 2 | [02_chart_patterns.md](02_chart_patterns.md) | 11 chart patterns + S/R detection: swing points, necklines, breakouts | 694 |
| 3 | [03_signal_engine.md](03_signal_engine.md) | 40+ signals, 30 composites, 12 post-filters, divergence, stats | 783 |
| 4 | [04_backtester.md](04_backtester.md) | WLS/Ridge/HC3, LinUCB, WFE, 45-pattern _META, Wc weights | 721 |
| 5 | [05_confidence_chain.md](05_confidence_chain.md) | 10-function macro/micro/derivatives confidence adjustment chain | 1,063 |

### Superseded (kept for reference)

| File | Replaced By | Date |
|------|-------------|------|
| 01_theory_pattern_mapping.md | 01_candle_patterns.md + 02_chart_patterns.md | 2026-04-06 |
| 02_candle_patterns.md (old) | 01_candle_patterns.md (expanded) | 2026-04-06 |
| 03_composite_signals.md | 03_signal_engine.md | 2026-04-06 |
| 04_implementation_map.md | 04_backtester.md | 2026-04-06 |
| 05_pipeline_analysis.md | 05_confidence_chain.md | 2026-04-06 |

---

## Constant Grade Tags

Each constant in the bridge documents carries a grade tag:

| Grade | Meaning | Count (post-audit) |
|-------|---------|-------------------|
| [A] Academic | Direct academic citation | 40 |
| [B] Empirical | Backtest/statistical validation | 51 |
| [C] Market-specific | KRX market characteristic | 63 |
| [D] Heuristic | No formal basis yet | 64 |
| [E] Deprecated | Disabled | 1 |

---

## Data Flow

```
[Stage 1] Academic Theory (core_data/ -- 47 documents)
    Doc 01-04: Math, Statistics, Behavioral, Psychology
    Doc 05-09: Finance theory, TA, Pattern algorithms
    Doc 10-14: Kalman, EVT, Risk, Finance management
    Doc 17:    Regression & Backtesting
    Doc 25:    Volatility, CAPM extensions
    Doc 42-47: FF3, EVA, Bond pricing, Options, Credit
         |
         v
[Stage 2] Bridge Documents (pattern_impl/ -- 5 documents, 4,289 lines)
    01: Candle pattern theory -> detection code
    02: Chart pattern theory -> detection code
    03: Signal engine theory -> signal/composite code
    04: Backtester theory -> WLS/RL/WFE code
    05: Confidence chain -> macro/micro adjustment code
         |
         v
[Stage 3] Code Implementation (js/ -- 19 files)
    patterns.js (4,200L) -- 45 patterns (34 candle + 11 chart)
    signalEngine.js (3,117L) -- 40+ signals, 30 composites
    backtester.js (2,538L) -- WLS, LinUCB, reliability tiers
    appWorker.js (1,763L) -- 10-function confidence chain
    indicators.js (2,357L) -- 9 indicators + WLS regression
    + 14 more files (chart, renderer, sidebar, UI, etc.)
```

---

## Script Load Order (index.html, 19 files)

```
colors.js -> data.js -> api.js -> realtimeProvider.js -> indicators.js
-> patterns.js -> signalEngine.js -> chart.js
-> patternRenderer.js -> signalRenderer.js -> backtester.js
-> sidebar.js -> patternPanel.js -> financials.js -> drawingTools.js
-> appState.js -> appWorker.js -> appUI.js -> app.js
```

---

## Current System Summary

- **PatternEngine** (patterns.js): 45 patterns (34 candle + 11 chart + S/R)
- **SignalEngine** (signalEngine.js): 40+ individual + 30 composite signals
- **Backtester** (backtester.js): WLS Ridge regression, LinUCB RL, BH-FDR, WFE
- **Confidence Chain** (appWorker.js): 10-function macro/micro/derivatives adjustment
- **IndicatorCache** (indicators.js): 20+ indicators, lazy evaluation
- **Academic Documents**: 47 (core_data/)
- **Target Market**: KRX (KOSPI/KOSDAQ), ~2,733 stocks
- **Constants**: 219 graded ([A] 40, [B] 51, [C] 63, [D] 64, [E] 1)
