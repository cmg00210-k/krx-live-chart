# Stage 5: www.cheesestock.co.kr — The Delivery

> **Stage Color:** Warm Espresso `#3A2010`
>
> The final stage of the theoretical coherence chain: how academically-grounded,
> statistically-validated, visually-encoded analysis reaches the end user through
> a web browser at cheesestock.co.kr.

---

## 5.1 Architecture Overview

### 5.1.1 No-Build-System Philosophy

CheeseStock deliberately avoids bundlers (webpack, vite, esbuild):

| Property | Value |
|----------|-------|
| JS Files | 19 files, all loaded via `<script defer>` in index.html |
| Module System | None — all files use global variables |
| Build Step | None — edit file, save, reload browser |
| Deployment | `python scripts/stage_deploy.py` → `wrangler pages deploy deploy/` |

**Rationale:** The codebase prioritizes **transparency over tooling**. Every function,
every constant, every formula is directly readable in the browser's DevTools Sources
panel. This is a conscious choice for a financial analysis tool where formula
correctness is paramount.

### 5.1.2 Script Load Order (Critical)

The 19 JS files must load in exact order — breaking this causes ReferenceError cascades:

```
colors.js → data.js → api.js → realtimeProvider.js → indicators.js →
patterns.js → signalEngine.js → chart.js → patternRenderer.js →
signalRenderer.js → backtester.js → sidebar.js → patternPanel.js →
financials.js → drawingTools.js → appState.js → appWorker.js →
appUI.js → app.js
```

**Dependency chain maps to the 5-Stage flow:**

| Load Group | Stage | Files | Purpose |
|------------|-------|-------|---------|
| Data Layer | Stage 1 | colors, data, api, realtimeProvider | Data acquisition |
| Theory Engine | Stage 2→3 | indicators, patterns, signalEngine, backtester | Academic computation |
| Rendering | Stage 4 | chart, patternRenderer, signalRenderer, drawingTools | Visual translation |
| Application | Stage 5 | sidebar, patternPanel, financials, appState, appWorker, appUI, app | User delivery |

### 5.1.3 4-Column Grid Layout

```
┌─────────┬──────────────────────────┬─────────┬───────────┐
│    A     │           B              │    C    │     D     │
│ Sidebar  │      Main Chart          │ Pattern │ Financial │
│  260px   │       flex:1             │  240px  │   380px   │
│          │                          │  Panel  │   Panel   │
│ 2,700+   │  TradingView LWC        │         │           │
│ stocks   │  + PatternRenderer      │ Pattern │ PER/PBR   │
│ virtual  │  + SignalRenderer       │ cards   │ ROE/ROA   │
│ scroll   │  + DrawingTools         │ w/ tier │ Trend     │
│          │  + Sub-charts           │ badges  │ charts    │
└─────────┴──────────────────────────┴─────────┴───────────┘
```

---

## 5.2 Theory-to-User Translation

### 5.2.1 The Last Mile Problem

The theoretical chain produces outputs that are mathematically precise but
user-inaccessible in raw form:

| Raw Output | User Problem | Solution |
|-----------|-------------|----------|
| IC = 0.051 | "What does 0.051 mean?" | Tier system: S/A/B/C/D with color badges |
| Pattern confidence = 0.73 | "Is 73% good?" | Contextual comparison with peer patterns |
| MCS v2 = 62.4 | "What's the macro outlook?" | Regime label: "Bull" with color coding |
| Merton DD = 2.8σ | "Is this company safe?" | Distance-to-Default category display |
| WLS β = 0.032 | "Will this stock go up?" | Expected return %, win rate %, R:R ratio |

### 5.2.2 Tier System as Translation Layer

The 5-tier classification (S/A/B/C/D) translates statistical significance into
actionable categories:

| Tier | IC Threshold | Profit Factor | Min Samples | User Meaning | Badge Color |
|------|-------------|--------------|-------------|-------------|-------------|
| S | > 0.03 | > 1.5 | ≥ 100 | Statistically exceptional | — |
| A | > 0.02 | > 1.3 | ≥ 50 | Significant predictive power | Green `#2ecc71` |
| B | > 0.01 | > 1.1 | ≥ 20 | Minimal non-random signal | Blue `#3498db` |
| C | > 0.003 | — | — | Weak, needs confirmation | Amber `#f39c12` |
| D | ≤ 0.01 | ≤ 1.0 | — | No detected edge | Gray `#95a5a6` |

### 5.2.3 Toast Notifications as Complexity Reduction

Complex analysis pipelines produce simple notifications:

```
[Analysis Pipeline: 30+ indicators × 45 patterns × 10 confidence adjustments]
                            ↓
              Toast: "5개 패턴 감지됨"
```

This is deliberate information compression — the user needs to know THAT patterns
were detected, not HOW they were detected. Details are available in the C column
pattern panel for users who want depth.

---

## 5.3 Responsive Delivery (8 Breakpoints)

The 4-column layout adapts across device sizes:

| Width | Columns Visible | Adaptation |
|-------|----------------|------------|
| > 2000px | A + B + C + D (expanded) | Wider panels for detailed display |
| ≤ 1440px | A + B + C + D (compact) | Reduced panel widths |
| ≤ 1366px | A + B + C + D (tight) | Sidebar 220px, panels compressed |
| ≤ 1200px | A + B + D | C column → slide-out panel overlay |
| ≤ 1024px | B + D | A column → fixed drawer (toggle) |
| ≤ 768px | B only | D → bottom sheet (60vh), single-column |
| ≤ 480px | B only (mobile) | Full-width chart, minimal UI |

**Key principle:** Theoretical completeness is maintained at ALL breakpoints.
The analysis pipeline runs identically regardless of screen size — only the
visual delivery adapts. A mobile user receives the same IC-validated, confidence-adjusted
pattern signals as a desktop user.

---

## 5.4 Dual-Mode Operation

### 5.4.1 Mode Selection Logic (api.js)

```javascript
// Domain detection for automatic mode selection
var _h = window.location.hostname;
if (_h === 'cheesestock.co.kr' || _h.endsWith('.pages.dev')) {
    _defaultWsUrl = 'wss://ws.cheesestock.co.kr/ws';  // Production WSS
} else {
    _defaultWsUrl = 'ws://localhost:8765';              // Local development
}
```

### 5.4.2 Mode Comparison

| Aspect | WebSocket Mode | File Mode |
|--------|---------------|-----------|
| Data Source | Kiwoom OCX real-time | Static JSON files |
| Target User | Professional traders | General users, demo |
| Latency | ~100ms tick | N/A (pre-computed) |
| OHLCV Updates | Real-time intraday | Daily batch |
| Analysis | Same pipeline | Same pipeline |
| Theory Applied | Identical | Identical |

**Critical design constraint:** Both modes produce **identical** analysis results
for the same input data. The theoretical framework (Stage 2→3) is mode-independent.
Kiwoom real-time mode does NOT use different formulas or thresholds.

---

## 5.5 Service Worker & Offline Access

### 5.5.1 Cache Architecture

```javascript
// sw.js
const CACHE_NAME = 'cheesestock-v{N}';  // Bumped when JS files change
const STATIC_ASSETS = [
    '/', '/index.html',
    '/js/colors.js', '/js/data.js', ..., '/js/app.js',
    '/css/style.css'
];
```

| Property | Value |
|----------|-------|
| Strategy | Cache-first for static assets, network-first for data |
| Version | `CACHE_NAME` bumped on every JS deployment |
| Scope | All 19 JS files + CSS + HTML |
| Offline | Full chart functionality with cached OHLCV data |

### 5.5.2 Theoretical Integrity in Offline Mode

When offline, the Service Worker serves cached JS files. This means:
- All 218 formulas are available (they're in JS, not server-side)
- Pattern detection works on cached OHLCV data
- Macro confidence adjustments use last-fetched data (with staleness warnings)
- No theoretical degradation — only data freshness is affected

---

## 5.6 Deployment Pipeline

```
Developer edits JS/CSS
        │
        ▼
python scripts/stage_deploy.py     ← Copies files to deploy/
        │                             Excludes: large data files, core_data, docs
        ▼
wrangler pages deploy deploy/      ← Uploads to Cloudflare Pages
        │
        ▼
CDN distribution to edge nodes     ← Global availability
        │
        ▼
User at cheesestock.co.kr          ← Receives latest analysis engine
```

**Constraint:** Cloudflare Pages has a 25MB per-file limit. The `stage_deploy.py`
script is the sole gatekeeper ensuring oversized files are excluded.
ASCII-only commit messages (Korean characters cause Cloudflare API errors).

---

## 5.7 Virtual Scroll (Sidebar — 2,700+ Stocks)

The sidebar displays 2,700+ stocks using virtual scrolling:

| Property | Value |
|----------|-------|
| DOM Elements | ~40 (regardless of stock count) |
| Item Height | Fixed `ITEM_H` (must sync between CSS `.sb-item` and JS) |
| Performance | `will-change: transform` on `.sb-virtual-content` |
| Search | Real-time filtering across all stocks |

This is a performance-critical component. Without virtual scrolling, 2,700+ DOM
nodes would cause significant rendering lag during scroll.

---

## 5.8 Complete Pipeline Traces — End-to-End

Five complete traces from raw data to user-visible output, demonstrating the
full 5-stage theoretical coherence chain:

### Trace 1: OHLCV → Golden Cross → Buy Signal

```
Stage 1: pykrx downloads OHLCV candles for stock 005930 (Samsung)
Stage 2: Time Series Analysis (doc 02) — EMA as exponential smoothing
Stage 3: calcEMA(closes, 12) and calcEMA(closes, 26) compute fast/slow EMAs
         signalEngine detects EMA_12 crosses above EMA_26 (golden cross)
         Composite signal: "buy_goldenCrossRsi" (confidence 58%)
Stage 4: SignalRenderer draws diamond marker at crossover bar
         Background vertical band marks the golden cross zone
Stage 5: User sees gold diamond on chart + toast "1개 신호 감지됨"
```

### Trace 2: DART → Merton DD → Credit Risk Display

```
Stage 1: DART API returns financial statements (총자산, 부채, 자본)
Stage 2: Credit Risk Theory (doc 47) — Merton (1974) structural model
Stage 3: DD = (ln(A/D) + (r - σ²/2)T) / (σ√T)
         _applyMertonDD() adjusts pattern confidence based on DD level
Stage 4: Financial panel (D column) displays Distance-to-Default
Stage 5: User sees DD value with risk interpretation in financial panel
```

### Trace 3: ECOS → MCS v2 → Macro Confidence → Pattern Opacity

```
Stage 1: ECOS API returns BOK rate, KTB yields, CPI
Stage 2: Macroeconomics (doc 29-30) — Taylor Rule gap, yield curve slope
Stage 3: MCS v2 composite score (0-100)
         _applyPhase8Confidence() multiplies pattern confidence by regime factor
         Bull regime: buy patterns × 1.06, sell patterns × 0.92
Stage 4: Pattern label opacity reflects adjusted confidence (higher = more opaque)
Stage 5: User sees patterns with varying visual prominence based on macro regime
```

### Trace 4: KRX Flow → Investor Signal → Composite Signal

```
Stage 1: KRX API returns foreign/institutional/retail net buying data
Stage 2: Kyle (1985) informed trader model (doc 39), LSV herding (doc 24)
Stage 3: Investor flow signal: foreign net buy > threshold → bullish confirmation
         Composite: "strongBuy_hammerRsiVolume" amplified by institutional buying
Stage 4: Star marker (high confidence) rendered at signal bar
Stage 5: User sees star marker on chart + pattern card in C column
```

### Trace 5: VKOSPI → Vol Regime → Confidence Adjustment

```
Stage 1: data/vkospi.json loaded (download_vkospi.py)
Stage 2: BSM (doc 26) — implied volatility as market fear gauge
         VRP (doc 34) — variance risk premium = IV² - HV²
Stage 3: Vol regime classification:
         VKOSPI < 15: low vol → patterns more reliable (tighter range)
         VKOSPI 15-22: normal → baseline confidence
         VKOSPI 22-30: elevated → caution, wider stops
         VKOSPI > 30: crisis → reduced confidence, defensive posture
Stage 4: CUSUM threshold adapts (high vol → threshold 3.5, low → 1.5)
Stage 5: User's pattern signals are silently adjusted for volatility regime
```

---

## 5.9 User Journey Summary

```
Landing at cheesestock.co.kr
    │
    ├── [1] index.json loads → "2,700+ 종목" (Stage 1 data ready)
    ├── [2] Worker initializes → "분석 Worker 초기화 완료" (Stage 3 engine ready)
    ├── [3] User selects stock from sidebar (virtual scroll)
    │
    ├── [4] OHLCV candles render → chart appears in < 2s (Stage 4 active)
    ├── [5] Macro/bond data loads in background (Stage 2 context)
    │
    ├── [6] Pattern analysis runs (Worker thread) → "5개 패턴 감지됨"
    │       (Stage 3: indicators → patterns → signals → backtest)
    │
    ├── [7] Confidence adjustments apply (macro, micro, derivatives, Merton DD)
    │       (Stage 2 → Stage 3 confidence chain)
    │
    ├── [8] Visual overlays render on chart (Stage 4: 9 layers)
    ├── [9] Pattern panel populates (C column — Stage 5 UI)
    └── [10] Financial panel updates (D column — DART data)
```

---

*Stage 5 completes the theoretical coherence chain. Every pixel rendered at
cheesestock.co.kr traces back through chart visualization (Stage 4), technical
analysis formulas (Stage 3), academic foundations (Stage 2), to raw data (Stage 1).
The chain is unbroken: data → theory → computation → visualization → delivery.*
