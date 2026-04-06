# S5 — UI Architecture
**CheeseStock ANATOMY V5 | Section 5**
**Generated:** 2026-04-06
**Source files audited:** index.html, css/style.css, js/sidebar.js, js/patternPanel.js, js/financials.js, js/appUI.js, js/appState.js, js/appWorker.js, js/analysisWorker.js, js/app.js, sw.js, js/colors.js

---

## 5.1 4-Column Grid Layout

### CSS Grid Definition

Declared on `#main` in `css/style.css` line ~200:

```css
#main {
  display: grid;
  grid-template-columns:
    minmax(0, var(--sidebar-w))           /* A: Sidebar   */
    minmax(360px, 1fr)                    /* B: Chart     */
    minmax(200px, var(--pattern-panel-w)) /* C: Pattern   */
    minmax(260px, var(--rpanel-w));       /* D: Financial */
  grid-template-rows: 1fr;
  height: calc(100vh - var(--header-h));
  gap: 0;
  transition: grid-template-columns .25s ease;
}
```

### CSS Custom Properties (defined in `:root`)

| Property | Default | Purpose |
|----------|---------|---------|
| `--sidebar-w` | `260px` | Column A width |
| `--sidebar-collapsed` | `0px` | Column A collapsed width |
| `--pattern-panel-w` | `240px` | Column C width |
| `--rpanel-w` | `380px` | Column D width |
| `--header-h` | `40px` | Fixed header height |
| `--toolbar-h` | `32px` | Chart toolbar height |
| `--draw-toolbar-w` | `40px` | Drawing toolbar left margin |

### Column Assignments (CSS `grid-column`)

| ID | Column | Row |
|----|--------|-----|
| `#sidebar` | 1 | 1 |
| `#chart-area` | 2 | 1 |
| `#pattern-panel` | 3 | 1 |
| `#right-panel` | 4 | 1 |

### Collapse States

**Sidebar collapsed** — class `.sidebar-collapsed` on `#main`:
```css
grid-template-columns:
  var(--sidebar-collapsed)  /* 0px */
  minmax(360px, 1fr)
  minmax(200px, var(--pattern-panel-w))
  minmax(260px, var(--rpanel-w));
```

`#sidebar` gets `width: 0; pointer-events: none; border-right: none`.

**C+D merged (<=1200px)** — grid hard-codes C column to `0px`:
```css
grid-template-columns:
  minmax(0, var(--sidebar-w)) minmax(360px, 1fr) 0px var(--rpanel-w);
```
`#pattern-panel { display: none }` — JS moves `#pp-cards` into `#rp-pattern-content` tab.

---

## 5.2 Sidebar — Column A (Virtual Scroll)

### Structural Hierarchy

```
#sidebar
  .sb-controls
    .sb-search-wrap → #sb-search-input
    .sb-sort-filter-row
      .sb-sort-select#sb-sort-select    (시총/등락률/패턴/이름)
      .sb-sort-dir#sb-sort-dir          (asc/desc toggle)
      .sb-sector-select#sb-sector-select (16 sector groups)
  .sb-view-controls
    .sb-view-group#sb-view-group
      .sb-view-opt [data-view="default"] (기본)
      .sb-view-opt [data-view="analysis"] (상세)
    .sb-chip.sb-pattern-only-chip       (패턴 감지만 filter)
  .sb-body                              (overflow-y: auto, scroll parent)
    #sb-watchlist-section (즐겨찾기, hidden when empty)
    #sb-recent-section    (최근 본 종목, hidden when empty)
    .sb-section
      .sb-header           (종목 섹션 header)
      .sb-list#sb-all      (virtual scroll target)
        .sb-virtual-spacer (full-height placeholder)
        .sb-virtual-content (absolute, rendered items only)
```

### Virtual Scroll Architecture

**File:** `js/sidebar.js` — `sidebarManager` IIFE

| Constant | Value | Description |
|----------|-------|-------------|
| `VIRTUAL_ITEM_HEIGHT` | `42` | Default mode item height (px) |
| `VIRTUAL_BUFFER` | `5` | Extra items rendered above/below viewport |
| Analysis mode height | `56` | Returned by `_getItemHeight()` when `_viewMode === 'analysis'` |

**State object `_vsState`:**
```js
{ spacer, content, scrollParent, startIdx, endIdx }
```

**Scroll path:** `scroll` event on `.sb-body` → `_onVirtualScroll()` → `requestAnimationFrame` throttle → `_renderVisibleItems()`.

**DOM budget:** At any given moment, only `endIdx - startIdx` items exist in `_vsState.content`. For a typical 800px-tall sidebar with 42px items, this is approximately 19 visible + 10 buffer = ~29 DOM nodes, regardless of 2700+ total stocks.

**Height computation:**
- `spacer.style.height = totalItems * itemH + 'px'`
- `content.style.top = startIdx * itemH + 'px'`
- `elTop = el.offsetTop` accounts for the Favorites/Recent sections above `#sb-all`.

### Item Rendering Modes

| Mode class on `#sidebar` | Item height | Visible columns |
|--------------------------|-------------|-----------------|
| _(none, default)_ | 42px | Row1: name+price, Row2: code+change |
| `.sb-analysis` | 56px | Row1+Row2+Row3: adds sparkline, mcap, volume, RSI |
| `.sb-minimal` | ~28px | Row1 only (single line, hidden in current build) |

**Sparkline lazy-load:** `IntersectionObserver` — canvas elements within `_vsState.content` are observed; OHLCV data is drawn only when the canvas enters the viewport. On scroll churn (fast virtual re-render), prior observers are disconnected.

### Sort Options

| Value | Sort key |
|-------|----------|
| `mcap` | `MARKET_CAP[code]` (from `index.json` `marketCap` field, fallback `base`) |
| `change` | `_getChangePct()` — cached daily candle delta, fallback `index.json` `changePercent` |
| `pattern` | `_getPatternCount(code, 'all')` from `_stockPatternCache` |
| `name` | Stock name string |

### Sector Filter — 16 Groups

KSIC industry string → group mapping (`SECTOR_MAP`) with display order (`SECTOR_ORDER`):

1. 반도체 / 2. 전자/IT부품 / 3. 자동차/운송 / 4. 바이오/제약
5. 금융 / 6. 에너지/전력 / 7. 화학/소재 / 8. 소프트웨어/IT
9. 기계/장비 / 10. 철강/금속 / 11. 건설/부동산 / 12. 유통/소비재
13. 음식료/생활 / 14. 미디어/콘텐츠 / 15. 운송/물류 / 16. 기타

Unmapped KSIC strings fall to `'기타'`.

### Keyboard Navigation (R1)

Events attached to `.sb-body` (scroll parent). Supported keys:
- `ArrowUp` / `ArrowDown` — move `_kbFocusIndex` ± 1
- `PageUp` / `PageDown` — jump ± visible page
- `Home` / `End` — jump to first/last
- `Enter` — select focused stock

Focus indicator: `.kb-focus` class on active `.sb-item`.

### Other Features

| Feature | Implementation |
|---------|----------------|
| Recent stocks (R2) | `LS_RECENT` localStorage, max 5, `_recentStocks[]` |
| Favorites | `LS_ORDER` localStorage; `#sb-watchlist-section` |
| Drag-and-drop reorder (R11) | `draggable=true`, `dragstart/dragover/drop` handlers, `_customOrder` persisted |
| RSI badge (R10) | `calcRSI()` called on demand, 60s TTL cache in `_rsiCache` |
| Volume column (R3) | Formatted by `_formatVolume()` (억/만/원본 units) |
| Pattern name tooltip (S6) | CSS `data-patterns` attribute + `::after` pseudo-element |

---

## 5.3 Chart Panel — Column B

### Structural Hierarchy (inside `#chart-area`)

```
#chart-area
  #stock-header
    .sh-left
      .sh-identity
        #stock-name, #watchlist-toggle-btn (star), #stock-code, #stock-market
        #live-status (live-dot demo/file/ws), #live-label
        #data-freshness (last tick timestamp)
        #conn-settings-btn → #conn-panel (dropdown)
      .sh-price-row: #stock-price, #stock-change
    .sh-details (OHLCV): #sh-open, #sh-high, #sh-low, #sh-volume
  #chart-toolbar
    .tf-btn x8   (1m[disabled], 5m, 15m*, 30m*, 1h, 1d[default], 1w*, 1M*)
    .ct-btn x4   (candle[active], line, bar, HA)
    .toolbar-right
      .ind-dropdown-wrap → #ind-dropdown-menu (지표 체크박스)
      #pattern-toggle   (패턴 on/off)
      #viz-toggle-wrap → #viz-toggle-menu (표시 레이어 + 시그널 필터)
  #chart-wrap
    .draw-toolbar (40px left strip, 8 tool buttons + separator)
    #ohlc-bar    (O/H/L/C/Vol crosshair overlay)
    #main-chart-container   (TradingView LWC mount point)
    #active-pattern-hud     (zoom-persistent pattern overlay)
    #pattern-tooltip        (.pattern-tooltip, hover popup)
    #pattern-summary-wrap   (summary bar + detail popup)
    #pattern-history-bar    (pattern return history bar)
    .sub-chart-wrap x7      (RSI, MACD, Stoch, CCI, ADX, WilliamsR, ATR)
  #return-stats-area
    .rs-header (5d/10d/20d period tabs)
    .rs-body (#rs-grid, .php-table backtest results, #php-curve-canvas)
```

### Sub-chart Identifiers

| Sub-chart | Container ID | Label ID | Destroy method |
|-----------|-------------|---------|----------------|
| RSI | `rsi-chart-container` | `rsi-label` | `chartManager.destroyRSI()` |
| MACD | `macd-chart-container` | `macd-label` | `chartManager.destroyMACD()` |
| Stochastic | `stoch-chart-container` | `stoch-label` | `chartManager.destroyStochastic()` |
| CCI | `cci-chart-container` | `cci-label` | `chartManager.destroyCCI()` |
| ADX | `adx-chart-container` | `adx-label` | `chartManager.destroyADX()` |
| Williams %R | `willr-chart-container` | `willr-label` | `chartManager.destroyWilliamsR()` |
| ATR | `atr-chart-container` | `atr-label` | `chartManager.destroyATR()` |

Sub-charts are in `OSCILLATOR_GROUP` (appState.js). MACD is independent; the remaining 6 are mutually exclusive (only 1 active at a time).

### Timeframe Buttons

| Button | data-tf | Status |
|--------|---------|--------|
| 1분 | `1m` | `disabled` (data volume constraint) |
| 5분 | `5m` | Active |
| 15분 | `15m` | Resampled (5m × 3), `.tf-btn-resampled` |
| 30분 | `30m` | Resampled (5m × 6), `.tf-btn-resampled` |
| 1시간 | `1h` | Active |
| 일봉 | `1d` | Default active |
| 주봉 | `1w` | Resampled, `.tf-btn-resampled` |
| 월봉 | `1M` | Resampled, `.tf-btn-resampled` |

### Chart Type Buttons

`candle` (default), `line`, `bar`, `heikin` (Heikin-Ashi).

### Drawing Toolbar

Left vertical strip, 40px wide. Keyboard shortcuts in `title` attributes:
`select (S)` / `trendline (T)` / `hline (H)` / `vline (V)` / `rect (R)` / `fib (G)` / `color` / `eraser (Del)`.

Hidden at `<=768px` (`css/style.css` line ~3363).

### Indicator Dropdown Menu (`#ind-dropdown-menu`)

Categories: 기본 (vol, ma, ema), 서브차트 (macd, rsi, stoch, cci, adx, atr), 오버레이 (bb), 고급 (ich), B-Tier disabled (willr, kalman).

### Visualization Layer Toggles (`#viz-toggle-menu`)

Maps to `vizToggles` object in `appState.js`:

| Checkbox data-viz | vizToggles key | Controls |
|-------------------|---------------|---------|
| `signal` | `vizToggles.signal` | Signal diamonds/stars |
| `chart` | `vizToggles.chart` | Chart patterns (mint) |
| `candle` | `vizToggles.candle` | Candle patterns (purple) |
| `forecast` | `vizToggles.forecast` | Target/stop forecast zones |

Signal sub-filters: `ma`, `macd`, `rsi`, `bb`, `volume`, `stochastic`, `composite`.

Analysis runs regardless of toggles. Filtering applied at render time by `_filterPatternsForViz()` in `appUI.js`.

---

## 5.4 Pattern Panel — Column C

### Structural Hierarchy

```
#pattern-panel
  .pp-header  ("기술적 패턴 분석")
  .pp-content#pp-content
    #pp-cards
      .pp-empty#pp-empty  (shown when no patterns detected)
      [.pp-card x N]      (JS-generated, max 3 = MAX_PATTERNS)
```

At `<=1200px`, `#pattern-panel` is hidden. JS moves `#pp-cards` into `#rp-pattern-content` (D column tab).

### Pattern Card Structure (generated by `renderPatternPanel()`)

Each `.pp-card` contains:
- Pattern name (Korean) + English type
- Direction badge (상승/하락/중립) with tier color
- Tier badge (S/A/B) from 5-Tier Academic Verification System
- Confidence score (0-100)
- `.pp-card-desc` — `academicDesc` from `PATTERN_ACADEMIC_META`
- `.pp-card-psych` — `psychology` text (hidden at `<=1200px`)
- `.pp-card-invalid` — `invalidation` conditions (hidden at `<=1200px`)
- Bulkowski win rate: `bulkowskiWinRate` field
- Backtest stats: WR%, sample N, horizon (from `backtester` results)

### PATTERN_ACADEMIC_META Structure

```js
PATTERN_ACADEMIC_META[type] = {
  nameKo: '패턴 한국어명',
  category: '캔들스틱 (반전)' | '캔들스틱 (중립)' | '차트패턴',
  candles: N,                  // candle count
  academicDesc: '...',
  psychology: '...',
  bulkowskiWinRate: NN,        // percent integer
  invalidation: '...'
}
```

Patterns covered: 30+ (21 candle + 9 chart) — see `PATTERN_ACADEMIC_META` keys in `patternPanel.js`.

### Tier Badge Colors (from KRX_COLORS)

| Tier | Color constant | Hex |
|------|---------------|-----|
| S | `KRX_COLORS.TIER_A` (alias) | `#2ecc71` (green) |
| A | `KRX_COLORS.TIER_B` (alias) | `#3498db` (blue) |
| B | `KRX_COLORS.TIER_C` (alias) | `#f39c12` (amber) |
| D | `KRX_COLORS.TIER_D` | `#95a5a6` (gray) |

Tier classification defined in `appState.js`: `_TIER_S_CANDLE`, `_TIER_S_CHART`, `_TIER_A_CANDLE`, `_TIER_A_CHART`, `_TIER_B_CANDLE`, `_TIER_B_CHART`, `_SUPPRESS_PATTERNS`, `_CONTEXT_ONLY_PATTERNS`.

---

## 5.5 Financial Panel — Column D

### Structural Hierarchy

```
#right-panel
  .rp-header   ("주요재무지표", >1200px only)
  .rp-tab-bar  (<=1200px only: [재무] [패턴] tabs)
  #fin-content.rp-tab-content.active
    #fin-seed-warning   (seed data warning banner)
    .fin-period-row     (#fin-period label)
    [손익 section]       매출/영업이익/순이익 + YoY/QoQ
    [수익성 section]     OPM, ROE, EPS, BPS (.fin-grid 4-col)
    [밸류에이션 section]  PER, PBR, PSR, YieldGap,
                         CAPM β, 부도거리(DD), 보정β, Alpha유의성,
                         SMB, HML, EVA Spread, ROA, 부채비율, NPM
    [성장성 section]     매출 CAGR, 순이익 CAGR (.fin-grid-2col)
    [투자판단 section]   .fin-score-badge (score + grade)
    [경기순환 section]   cycle phase + yield curve + bond metrics
    .fin-trend-section  (Canvas2D trend chart: 매출/영익/EPS tabs)
    .fin-compare        (업종 비교)
    .fin-peers          (동종업종 비교)
    .fin-per-band-wrap  (PER band canvas)
    .fin-spark-wrap     (OPM sparkline canvas)
    .fin-footer         (DART attribution + disclaimer)
  #rp-pattern-content.rp-tab-content  (pattern cards at <=1200px)
```

### Financial Metrics by Element ID

| ID | Metric | Formula |
|----|--------|---------|
| `fin-revenue` | 매출액 | 억원 |
| `fin-op` | 영업이익 | 억원 |
| `fin-ni` | 순이익 | 억원 |
| `fin-opm` | 영업이익률 | OPM% |
| `fin-roe` | ROE | NI / 자본총계 × 100 |
| `fin-eps` | EPS | 원/주 |
| `fin-bps` | BPS | 원/주 |
| `fin-per` | PER | price / EPS |
| `fin-pbr` | PBR | price / BPS |
| `fin-psr` | PSR | 시총 / 매출액 |
| `fin-yield-gap` | Yield Gap | E/P − KTB10Y |
| `fin-beta` | CAPM β | Scholes-Williams (1977) |
| `fin-dd` | 부도거리 | Merton (1974) DD |
| `fin-blume-beta` | 보정 β | Blume (1975): 0.67×β + 0.33 |
| `fin-alpha-sig` | Alpha 유의성 | Jensen (1968), t-stat |
| `fin-smb` | SMB | FF3 factor loading |
| `fin-hml` | HML | FF3 factor loading |
| `fin-eva-spread` | EVA Spread | ROIC − WACC |
| `fin-roa` | ROA | NI / avg(총자산) |
| `fin-debt-ratio` | 부채비율 | 부채/자본 |
| `fin-npm` | NPM | NI / 매출액 |
| `fin-rev-cagr` | 매출 CAGR | 3yr CAGR |
| `fin-ni-cagr` | 순이익 CAGR | 3yr CAGR |
| `fin-score` | 투자판단 점수 | 0-100 composite |
| `fin-grade` | 투자판단 등급 | A/B/C/D |

### Data Trust System (3 Tiers)

| source field | Origin | Display behavior |
|---|---|---|
| `'dart'` | `data/financials/{code}.json` | Full display |
| `'hardcoded'` | `PAST_DATA` (Samsung/SK Hynix) | Full + warning badge |
| `'seed'` | Code hash PRNG | All metrics cleared to `"—"` |

`#fin-seed-warning` banner shown only for `source === 'seed'`.

### getFinancialData() Fallback Chain

1. Memory cache (session)
2. `fetch('data/financials/{code}.json')` (10s timeout)
3. `getPastData()` → hardcoded constants or seed PRNG

### Canvas Trend Charts

All canvas elements in `financials.js` follow DPR safety:
```js
ctx.setTransform(1,0,0,1,0,0);  // reset accumulation
ctx.clearRect(0, 0, w, h);
ctx.scale(dpr, dpr);
```

Canvas elements: `#fin-trend-canvas` (trend bars), `#fin-per-band` (PER band), `#opm-sparkline` (OPM trend).

### Macro Data Fetched in financials.js

| Variable | Source file | Usage |
|----------|------------|-------|
| `_macroData` | `data/macro/macro_latest.json` | KTB10Y rate for CAPM Rf |
| `_bondsLatest` | `data/macro/bonds_latest.json` | Fallback KTB10Y |
| `_capmBetaJson` | `data/backtest/capm_beta.json` | Pre-computed DD, Blume β, Alpha |
| `_ff3FactorData` | (from appWorker global) | FF3 factor loadings |
| `_evaScores` | `data/backtest/eva_scores.json` | EVA spread |

### Sector Label Lookup

`SEGMENT_OVERRIDE` (code-level override) → `KSIC_SHORT_LABEL` (KSIC string map) → empty string fallback. Used for peer group display.

---

## 5.6 Responsive Design — 8-Tier Breakpoints

### Width Breakpoints

| Breakpoint | CSS changes | Layout effect |
|-----------|-------------|---------------|
| `>2000px` | `--sidebar-w:240px`, `--rpanel-w:420px`, `--pattern-panel-w:300px` | Ultrawide expansion |
| `<=1440px` | `--rpanel-w:340px`, `--pattern-panel-w:220px` | D+C shrink |
| `<=1366px` | `--sidebar-w:220px`, `--pattern-panel-w:210px`, `--rpanel-w:300px` | Laptop profile |
| `<=1200px` | `--sidebar-w:200px`, C column = 0px, C panel hidden, D tabs active | C+D merge into tabbed panel |
| `<=1024px` | `--rpanel-w:260px`, `#sidebar` → fixed drawer overlay (min(280px,80vw)), `#sb-backdrop` enabled | Sidebar drawer mode |
| `<=768px` | Single column grid (1fr), `#right-panel` → bottom sheet (60vh), `#fin-toggle` FAB shown | Mobile layout |
| `<=480px` | Logo hidden, ticker strip hidden, market-state badge fixed top-right | Ultra-small mobile |

### Height Breakpoints

| Breakpoint | Changes |
|-----------|---------|
| `<=800px` | `#stock-header` compact (36px min-height), sub-chart heights reduced |
| `<=700px` | Header price downsized, `.sh-details` hidden, sub-charts minimized (50px min), fin-grid 3-col |
| `>=1200px` | `#main-chart-container` min-height 400px, sub-chart 120px |

### Mobile-Specific Behaviors

**Sidebar (<=1024px):** Fixed overlay drawer, `transform: translateX(-100%)` default, `.sb-drawer-open` → `translateX(0)`. Backdrop: `#sb-backdrop` with 40% black overlay.

**Financial panel (<=768px):** `#right-panel` fixed bottom overlay, `transform: translateY(100%)` default, `.rp-sheet-open` → `translateY(0)`. Toggle: `#fin-toggle` FAB (bottom-right, 44px circle). Backdrop: `#rp-backdrop`.

**Toolbar (<=768px):** `overflow: auto hidden; flex-wrap: nowrap` — horizontal scroll with Lea Verou scroll-shadow technique. `-webkit-overflow-scrolling: touch`. Scrollbar hidden.

**Drawing toolbar (<=768px):** `display: none`. Chart left margin reset to 0.

**Sub-charts (<=768px):** `height: clamp(60px, 10vh, 90px)`.

### Tablet Behavior (<=1200px, C+D merged)

- `#pattern-panel { display: none }` — panel removed from grid
- `.rp-tab-bar { display: flex }` — two tabs appear: `재무` and `패턴`
- `.rp-header { display: none }` — original header removed
- JS (appUI.js) moves `#pp-cards` into `#rp-pattern-content` on tab switch

---

## 5.7 Typography

### Font Stack

| Purpose | Font | Fallback |
|---------|------|---------|
| UI / Korean | Pretendard v1.3.9 (jsDelivr CDN) | `'Segoe UI', sans-serif` |
| Prices / Codes | JetBrains Mono (Google Fonts) | `monospace` |

Both loaded via `<link rel="preconnect">` + stylesheet in `<head>`. Pretendard uses dynamic-subset (Korean subset on demand).

### Type Scale (CSS custom properties)

| Property | Value | Usage |
|----------|-------|-------|
| `--fs-hero` | `28px` | Stock price (main) |
| `--fs-display` | `20px` | Large price on mobile |
| `--fs-heading` | `16px` | Section headings |
| `--fs-title` | `14px` | Logo, stock name |
| `--fs-body` | `12px` | Default text, sidebar items |
| `--fs-caption` | `11px` | Section headers, badges |
| `--fs-micro` | `10px` | Codes, metadata |
| `--fs-nano` | `10px` | Smallest labels (min readability floor, fixed from 9px) |

### Font Rendering

```css
html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
```

### Tabular Numerics

Applied via `font-feature-settings: "tnum"` and `font-variant-numeric: tabular-nums` on:
- `.sb-index-val`, `.sb-price`, `.sb-change`, `.sb-change-amt`, `.sb-volume`, `.sb-rsi`, `.sb-mcap`
- All `.ticker-val`, `#stock-price`, price columns in financial panel

### Korean Text

`word-break: keep-all` applied where Korean prose appears (pattern descriptions, financial panel labels).

---

## 5.8 Color System

### KRX_COLORS Frozen Object (js/colors.js)

**Direction colors (Korean convention: up=red, down=blue):**

| Key | Value | CSS var | Usage |
|-----|-------|---------|-------|
| `UP` | `#E05050` | `--up` | 상승, 매수, up-change |
| `DOWN` | `#5086DC` | `--down` | 하락, 매도, down-change |
| `NEUTRAL` | `#ffeb3b` | `--neutral` | 횡보, market pre/after state |
| `ACCENT` | `#A08830` | `--accent` | Gold accent (logo, active state) |

**Pattern colors (direction-independent):**

| Key | Value | Usage |
|-----|-------|-------|
| `PTN_BUY` / `PTN_SELL` | `rgba(150,220,200,0.65)` | Chart pattern border (unified mint) |
| `PTN_BUY_FILL` / `PTN_SELL_FILL` | `rgba(150,220,200,0.12)` | Chart pattern fill (unified mint) |
| `PTN_CANDLE` | `#B388FF` | Candle pattern color (purple) |
| `PTN_STOP` | `rgba(255,107,53,0.55)` | Stop loss line |
| `PTN_TARGET` | `rgba(150,220,200,0.55)` | Price target line |
| `PTN_STRUCT` | `rgba(200,200,200,0.45)` | Structure lines (necklines) |
| `PTN_NEUTRAL` | `rgba(200,200,200,0.55)` | Neutral pattern, doji glow |
| `PTN_INVALID` | `#FF6B35` | Invalidation zone |

**Forecast zone colors:**

| Key | Value | Usage |
|-----|-------|-------|
| `FZ_TARGET_NEAR` | `rgba(150,220,200,0.22)` | Target gradient (near side) |
| `FZ_TARGET_FAR` | `rgba(150,220,200,0.05)` | Target gradient (far side) |
| `FZ_TARGET_BORDER` | `rgba(150,220,200,0.45)` | Target dashed border |
| `FZ_STOP_NEAR` | `rgba(255,107,53,0.15)` | Stop gradient (near side) |
| `FZ_STOP_FAR` | `rgba(255,107,53,0.03)` | Stop gradient (far side) |
| `FZ_STOP_BORDER` | `rgba(255,107,53,0.25)` | Stop dashed border |

**Chart layout colors:**

| Key | Value | Usage |
|-----|-------|-------|
| `CHART_BG` | `#131722` | TradingView chart background |
| `CHART_TEXT` | `#d1d4dc` | Chart axis text |
| `CHART_BORDER` | `#2a2e39` | Grid borders |

**Reliability tier colors:**

| Key | Value | Tier |
|-----|-------|------|
| `TIER_A` | `#2ecc71` | A/S — green |
| `TIER_B` | `#3498db` | B — blue |
| `TIER_C` | `#f39c12` | C — amber |
| `TIER_D` | `#95a5a6` | D — gray |

### Zone Rules

| Zone | Colors allowed | Rationale |
|------|---------------|-----------|
| B column (chart) | `UP` (red), `DOWN` (blue) | Price direction convention |
| C column (pattern) | Mint (`PTN_BUY`/`PTN_SELL`), Purple (`PTN_CANDLE`) | Pattern detection (no direction implication in color) |
| D column (financial) | `--fin-good` (green), `--up` (red for negative), `--text-sub` | Quality/risk level |
| Signals | `KRX_COLORS.NEUTRAL` (gold/yellow bands) | Cross-signal highlighting |

**Rule:** Never use `UP`/`DOWN` colors for chart patterns. Pattern color carries the semantic "pattern detected here," not a directional prediction. Direction is communicated through label text and position.

### CSS Custom Property Mapping

```css
:root {
  --up:       #E05050;   /* = KRX_COLORS.UP */
  --down:     #5086DC;   /* = KRX_COLORS.DOWN */
  --neutral:  #ffeb3b;   /* = KRX_COLORS.NEUTRAL */
  --accent:   #A08830;   /* = KRX_COLORS.ACCENT */
  --fin-good: #6BCB77;   /* Financial panel positive */
}
```

Background layers (`--bg`, `--panel`, `--bg-element`, `--bg-elevated`) are not in `KRX_COLORS` — CSS-only, not used in Canvas2D.

---

## 5.9 Web Worker Communication

### Worker Initialization

**File:** `js/appWorker.js`, function `_initAnalysisWorker()`

```js
_analysisWorker = new Worker('js/analysisWorker.js?v=61');
```

Worker script: `js/analysisWorker.js` — imports dependencies via `importScripts`:

```js
importScripts(
  'colors.js?v=13',
  'indicators.js?v=27',
  'patterns.js?v=45',
  'signalEngine.js?v=42',
  'backtester.js?v=40'
);
```

Paths are relative to `js/` (the Worker file's location).

On successful load: `self.postMessage({ type: 'ready' })`. Logged as `[Worker] 분석 Worker 초기화 완료`.

On failure: `self.postMessage({ type: 'error', message, version: -1 })`.

### Message Protocol

**Main → Worker:**

| type | Direction | Payload | Response |
|------|-----------|---------|---------|
| `analyze` | Main → Worker | `{ type, candles, realtimeMode, version, source?, timeframe?, market? }` | `result` |
| `backtest` | Main → Worker | `{ type, candles, version }` | `backtestResult` |
| `marketContext` | Main → Worker | `{ type, vkospi, pcr, basis, leverageRatio, foreignAlignment }` | none (one-way) |

**Worker → Main:**

| type | Payload | Consumed by |
|------|---------|-------------|
| `ready` | — | `appWorker.js` — sets `_workerReady = true` |
| `result` | `{ patterns, signals, stats, version, source, srLevels? }` | `appWorker.js` → `detectedPatterns`, `detectedSignals` |
| `backtestResult` | `{ results, learnedWeights, backtestEpochMs, candleLength, version }` | `appWorker.js` → pattern WR enrichment |
| `error` | `{ message, version }` | `appWorker.js` — logs warning, may restart worker |

### Version Field (Stale Result Rejection)

Every `analyze` request carries a `version` integer (incrementing counter). Worker echoes it back in `result`. If `msg.version !== _currentAnalysisVersion`, the result is discarded. This prevents stale analysis from a prior stock overwriting the current display.

Drag analysis uses a separate `_dragVersion` counter.

### Worker Result Cache (`_analyzeCache`)

Cache key:
```js
(timeframe || '') + '_' + candles.length + '_' + last.time + '_' + last.open + '_' + last.close + '_' + (realtimeMode ? 'rt' : 'file')
```

- Includes `last.open` to reduce cross-stock collision probability (codes with same length + last candle)
- Includes `realtimeMode` to prevent file-mode stale cache being returned after WS reconnect

### Main Thread Fallback

When `typeof Worker === 'undefined'` or Worker fails: `patternEngine.analyze()`, `signalEngine.analyze()`, `backtester.backtestAll()` called synchronously on main thread. Logged as `[Worker] Web Worker 미지원 — 메인 스레드 폴백`.

### 3-Second Throttle

`_lastPatternAnalysis` timestamp in `appWorker.js`/`appUI.js`. Analysis requests are gated: if last run was < 3000ms ago and data has not changed, the request is skipped. Prevents excessive Worker dispatches during rapid UI interactions.

### Worker Globals for Market Context

In `analysisWorker.js`, the following `var` declarations at Worker global scope receive `marketContext` data:

```js
var _marketContext     = null;
var _derivativesData   = null;
var _investorData      = null;
var _etfData           = null;
var _shortSellingData  = null;
```

`signalEngine` within the Worker references these via `typeof _marketContext` checks.

---

## 5.10 Service Worker and Offline

### Cache Configuration

**File:** `sw.js`

```js
const CACHE_NAME = 'cheesestock-v66';
```

**Version bump rule:** Bump `CACHE_NAME` version integer on every deployment that changes any cached file. Currently at `v66`.

### Static Assets Cached on Install

All 24 entries in `STATIC_ASSETS` array (sw.js lines 11-38):

```
/, /index.html, /favicon.svg, /css/style.css
/js/colors.js, /js/data.js, /js/api.js, /js/indicators.js,
/js/patterns.js, /js/signalEngine.js, /js/chart.js,
/js/patternRenderer.js, /js/signalRenderer.js, /js/backtester.js,
/js/sidebar.js, /js/patternPanel.js, /js/financials.js,
/js/drawingTools.js, /js/realtimeProvider.js,
/js/analysisWorker.js, /js/screenerWorker.js,
/js/appState.js, /js/appWorker.js, /js/appUI.js, /js/app.js,
/lib/lightweight-charts.standalone.production.js
```

Install uses `Promise.allSettled` — individual cache failures are logged as warnings but do not abort the SW install.

### Caching Strategies

| Request type | Strategy | Behavior |
|---|---|---|
| External CDN (fonts, LWC unpkg) | Cache-First + background revalidate (SWR) | Cached version returned immediately; network response updates cache |
| `/data/*.json` | Network-First | Network response always attempted; cache fallback on failure |
| Local HTML/CSS/JS | Stale-While-Revalidate | `caches.match(request, {ignoreSearch: true})` — `?v=N` query ignored for matching pre-cached URLs |

### `?v=N` Version Sync

Three locations must agree for each JS file:

| Location | Example | Check |
|----------|---------|-------|
| `index.html` `<script>` | `js/colors.js?v=13` | Primary |
| `analysisWorker.js` `importScripts` | `colors.js?v=13` | Must match index.html |
| `sw.js` `CACHE_NAME` | `cheesestock-v66` | Bumped when any JS changes |

`verify.py --check scripts` (CHECK 5f) catches version mismatches between index.html and analysisWorker.js.

### Current Script Version Table (from index.html as of 2026-04-06)

| File | Version |
|------|---------|
| colors.js | v13 |
| data.js | v12 |
| api.js | v15 |
| realtimeProvider.js | v10 |
| indicators.js | v27 |
| patterns.js | v45 |
| signalEngine.js | v42 |
| chart.js | v12 |
| patternRenderer.js | v24 |
| signalRenderer.js | v12 |
| backtester.js | v40 |
| sidebar.js | v12 |
| patternPanel.js | v22 |
| financials.js | v16 |
| drawingTools.js | v11 |
| appState.js | v2 |
| appWorker.js | v7 |
| appUI.js | v1 |
| app.js | v35 |
| style.css | v15 |
| analysisWorker.js (Worker init) | v61 |

**Note:** `analysisWorker.js` is loaded by `new Worker('js/analysisWorker.js?v=61')` in `appWorker.js`. This version (`v61`) is NOT present in `index.html` as a `<script>` tag (Workers are loaded dynamically). Verify against `sw.js` STATIC_ASSETS which lists `/js/analysisWorker.js` without version (SW uses `ignoreSearch: true` matching).

---

## UI Findings

The following issues were identified during audit. Severity levels: CRITICAL (production bug), HIGH (functional gap), MEDIUM (UX/code quality), LOW (minor inconsistency).

---

### FINDING-01 | MEDIUM | Worker version mismatch risk

**Location:** `js/appWorker.js` line 38 vs `index.html` script tags

`appWorker.js` instantiates the Worker as `'js/analysisWorker.js?v=61'`. This version string is embedded inside `appWorker.js` itself. When `appWorker.js` is deployed with a bumped version (e.g., `v8`), the embedded `?v=61` reference to `analysisWorker.js` remains unchanged unless the developer also edits the string inside `appWorker.js`.

There is no automated check that verifies the Worker instantiation string matches the SW cache entry. `verify.py` CHECK 5f validates `index.html` `<script>` tags vs `importScripts()` calls inside `analysisWorker.js`, but does NOT validate the `new Worker('...?v=N')` string in `appWorker.js`.

**Risk:** After bumping `analysisWorker.js` to a new version in `index.html` and `sw.js`, if `appWorker.js` is not also updated, the Worker may load a stale cached version.

**Recommendation:** Add a CHECK to `verify.py` that reads `new Worker('js/analysisWorker.js?v=N')` from `appWorker.js` and verifies N matches the SW STATIC_ASSETS version or the `importScripts` self-references inside `analysisWorker.js`.

---

### FINDING-02 | MEDIUM | Virtual scroll height mismatch potential

**Location:** `js/sidebar.js` `_getItemHeight()` vs `css/style.css` sidebar item heights

`_getItemHeight()` returns hardcoded `42` (default mode) and `56` (analysis mode). The CSS `min-height: 38px` on `.sb-item` and `padding: 6px 10px` are the actual item sizes. If CSS changes item height (e.g., padding adjustment), the hardcoded JS values will produce incorrect scroll positioning — items will drift from their spacer-calculated positions.

**Current state:** CSS `.sb-item { min-height: 38px }` with 6px top/6px bottom padding = 50px rendered height for a two-row item, versus the JS constant of 42. The discrepancy is mitigated in practice because items are rendered by `innerHTML` insertion and positioned by `top` offset — the spacer height is the primary risk.

**Recommendation:** Add a comment in both `sidebar.js` and `style.css` cross-referencing these values. Consider a runtime measurement fallback:
```js
function _getItemHeight() {
  // SYNC with css/style.css .sb-item padding and row heights
  if (_viewMode === 'analysis') return 56;
  return 42;
}
```

---

### FINDING-03 | LOW | Screener disabled but SW still caches screenerWorker.js

**Location:** `sw.js` STATIC_ASSETS line ~33, `js/sidebar.js` comment (2026-04-06 disable note)

`screenerWorker.js` is listed in `sw.js` STATIC_ASSETS but the screener feature was disabled in `sidebar.js` (2026-04-06). The HTML comment also removes the screener panel. The Worker file is still being cached on install, consuming SW cache quota unnecessarily.

**Risk:** Low — file is small and caching it does not break anything. If `screenerWorker.js` is deleted from disk, the `Promise.allSettled` will log a warning but not break the SW install.

**Recommendation:** If `screenerWorker.js` is permanently removed from the build, remove it from `sw.js` STATIC_ASSETS.

---

### FINDING-04 | MEDIUM | Accessibility gaps — no ARIA roles on key interactive regions

**Location:** `index.html` sidebar, pattern panel, financial panel

Identified gaps:
1. `#sb-all` virtual scroll container has no `role="listbox"` or `role="list"` and no `aria-label`.
2. `.sb-item` elements have no `role="option"` or `role="listitem"` — keyboard focus via `.kb-focus` class is visually indicated but not announced to screen readers.
3. `#pattern-panel` has no landmark role (`role="complementary"` or `<aside>`).
4. `#right-panel` (financial panel) has no landmark role.
5. `#ind-dropdown-menu` and `#viz-toggle-menu` use `<div>` with no `role="menu"` or `role="dialog"`.
6. `#conn-panel` (connection settings dropdown) has no `role="dialog"` and no focus trap.
7. Toast container `#toast-container` has no `aria-live="polite"` region — screen readers will not announce new toasts.

**Recommendation for highest-impact fixes (in order):**
1. Add `aria-live="polite"` to `#toast-container`.
2. Add `role="listbox"` + `aria-label="종목 목록"` to `#sb-all`.
3. Add `role="option"` and `aria-selected` to `.sb-item` (requires dynamic update on active state).
4. Add `<aside aria-label="패턴 분석">` wrapper around `#pattern-panel`.

---

### FINDING-05 | LOW | Breakpoint gap between UI rules doc and CSS implementation

**Location:** `.claude/rules/ui-layout.md` vs `css/style.css`

The UI layout rules doc states: "<=1200px: C column → fixed slide panel." The actual implementation (CSS line 3249) merges C into D as a tab panel — C is not a "fixed slide panel" but is entirely removed from the grid (`0px`) and its content moved by JS into D's tab. The "slide panel" description is inaccurate and could mislead future agents editing the C column behavior.

**Recommendation:** Update `.claude/rules/ui-layout.md` to read: "<=1200px: C column → grid width set to 0px, `#pattern-panel` hidden, `#pp-cards` moved by JS into `#rp-pattern-content` tab within D column."

---

### FINDING-06 | LOW | `--fs-nano` and `--fs-micro` are both `10px`

**Location:** `css/style.css` `:root` lines 43-44

`--fs-micro: 10px` and `--fs-nano: 10px` (nano was fixed from 9px for readability). Both tokens now resolve to the same value, making the semantic distinction meaningless. Any element using `--fs-nano` expecting to be smaller than `--fs-micro` will be the same size.

**Impact:** Minor — the distinction is preserved in intent and naming, and both are acceptable at 10px. If a future design iteration wants to restore the nano/micro distinction, `--fs-nano` can be set to `9px` again.

---

### FINDING-07 | HIGH | No keyboard shortcut for pattern toggle / viz toggle

**Location:** `index.html` `#pattern-toggle`, `#viz-toggle-btn`

The drawing toolbar buttons have keyboard shortcuts documented in `title` attributes (S, T, H, V, R, G, Del). However, `#pattern-toggle` (패턴 분석 on/off) and `#viz-toggle-btn` (표시 layer toggle) have no keyboard shortcut. For a chart-heavy workflow, requiring mouse interaction to toggle the pattern analysis pipeline adds friction.

**Recommendation:** Register keyboard shortcuts (e.g., `P` for pattern toggle) in the existing `keydown` handler in `appUI.js`.

---

### FINDING-08 | LOW | Mobile toolbar scroll indicator may not show on all Safari versions

**Location:** `css/style.css` lines ~3467-3476

The Lea Verou scroll-shadow technique (using `local` + `scroll` background attachment) relies on `background-attachment: local` support. Safari `<14` had inconsistent support. The existing comment acknowledges Safari `<14` concerns for `clamp()` on sub-charts, but not for the toolbar scroll shadow.

**Impact:** On very old Safari, the scroll shadow may not appear, but the toolbar remains functional (horizontal scroll still works).

---

*End of S5 UI Architecture*
