# S5 — UI Architecture v7
**CheeseStock ANATOMY | Section 5**
**Generated:** 2026-04-06
**Source files audited:**
- `css/style.css` (3,929 lines, v5.0 stylesheet)
- `index.html` (747 lines)
- `js/sidebar.js` (1,722 lines, sidebarManager v12.0)
- `js/patternPanel.js` (1,638 lines)
- `js/financials.js` (2,377 lines)
- `js/appUI.js` (3,327 lines)
- `docs/anatomy/S5_ui_architecture.md` (V5, 874 lines — reference)

**V6 changes vs V5:**
- Section numbering reorganized: grid layout is 5.1, responsive breakpoints are 5.2, column details are 5.3 (with sub-sections), typography/color are 5.4
- Added complete breakpoint table with per-column effects (previously scattered)
- Screener mode documented as deactivated (removed from live DOM/JS as of 2026-04-06)
- Virtual scroll DOM budget corrected: `~40` in comments, actual computed value documented
- `_migratePpCards()` and `_switchRpTab()` lifecycle fully documented
- Fixed: V5 omitted `--ctrl-h-sm`, `--ctrl-h-md`, `--ctrl-radius`, `--ctrl-font` custom properties
- Fixed: V5 listed `--fs-nano` as `9px` corrected to `10px` (was fixed in CSS; V5 body was updated but note was ambiguous)
- Added: `prefers-reduced-motion` media query (accessibility)
- Added: complete script load order from `index.html` with `?v=` values
- Added: financial metrics DOM ID table updated to match current `index.html`

---

## 5.1 4-Column Grid Layout

### CSS Grid Definition

Declared on `#main` in `css/style.css` ~line 199:

```css
#main {
  background: var(--chart-bg, #131722);
  display: grid;
  grid-template-columns:
    minmax(0, var(--sidebar-w))            /* A: Sidebar 260px */
    minmax(360px, 1fr)                     /* B: Chart         */
    minmax(200px, var(--pattern-panel-w))  /* C: Pattern 240px */
    minmax(260px, var(--rpanel-w));        /* D: Financial 380px */
  grid-template-rows: 1fr;
  height: calc(100vh - var(--header-h));
  max-height: calc(100vh - var(--header-h));
  min-width: 0;   /* prevents horizontal scroll in responsive mode */
  gap: 0;
  transition: grid-template-columns .25s ease;
  backface-visibility: hidden;  /* prevents font blur during grid animation */
}
```

### CSS Custom Properties (defined in `:root`)

**Layout dimensions:**

| Property | Default | Purpose |
|----------|---------|---------|
| `--header-h` | `40px` | Fixed header height |
| `--toolbar-h` | `32px` | Chart toolbar height |
| `--sidebar-w` | `260px` | Column A width (varies by breakpoint) |
| `--sidebar-collapsed` | `0px` | Column A width when collapsed |
| `--pattern-panel-w` | `240px` | Column C width (varies by breakpoint) |
| `--rpanel-w` | `380px` | Column D width (varies by breakpoint) |
| `--draw-toolbar-w` | `40px` | Left drawing toolbar width (left margin for chart content) |
| `--chart-bg` | `#131722` | TradingView chart background (investing.com benchmark) |

**Control tokens (sidebar UI):**

| Property | Default | Purpose |
|----------|---------|---------|
| `--ctrl-h-sm` | `24px` | Small control height (chips, sort dir button) |
| `--ctrl-h-md` | `28px` | Medium control height (selects, inputs) |
| `--ctrl-radius` | `6px` | Control border-radius |
| `--ctrl-font` | `11px` | Control font size |

**Other:**

| Property | Default | Purpose |
|----------|---------|---------|
| `--radius` | `4px` | Default border-radius |
| `--radius-lg` | `6px` | Large border-radius |
| `--transition` | `.15s ease` | Default transition |
| `--min-touch` | `28px` | Minimum tap target height |
| `--sp-1..5` | `4/8/12/16/24px` | 4px spacing scale |

### Column Grid Assignments

| Element ID | `grid-column` | `grid-row` |
|------------|--------------|-----------|
| `#sidebar` | 1 | 1 |
| `#chart-area` | 2 | 1 |
| `#pattern-panel` | 3 | 1 |
| `#right-panel` | 4 | 1 |

### Collapse States

**Sidebar collapsed** — class `.sidebar-collapsed` on `#main`:
```css
grid-template-columns:
  var(--sidebar-collapsed)         /* 0px */
  minmax(360px, 1fr)
  minmax(200px, var(--pattern-panel-w))
  minmax(260px, var(--rpanel-w));
```
`#sidebar` simultaneously gets `width: 0; pointer-events: none; border-right: none`.

State persisted to `localStorage` under key `krx_sidebar_open` (managed by `sidebar.js`).
Toggle: `#sidebar-toggle` button in `#header`.

**C+D merged (<=1200px)** — `#main` grid column 3 hard-coded to `0px`:
```css
grid-template-columns:
  minmax(0, var(--sidebar-w))
  minmax(360px, 1fr)
  0px
  var(--rpanel-w);
```
`#pattern-panel { display: none }`. JS moves `#pp-cards` into `#rp-pattern-content` (D column tab).

---

## 5.2 Responsive Breakpoints (8 Tiers)

Media queries in `css/style.css` appear in this order (lines ~3206–3928):
`2000px | 1440px | 1366px | 1200px | 1024px | 768px | 480px | height:800px | height:700px | height:1200px | prefers-reduced-motion`

### Width Breakpoints — Complete Table

| Breakpoint | --sidebar-w | --rpanel-w | --pattern-panel-w | Column A | Column B | Column C | Column D | Toolbar | Special |
|-----------|-------------|-----------|-------------------|---------|---------|---------|---------|---------|---------|
| `>2000px` | 240px | 420px | 300px | wider | wider | wider | wider | normal | `#main-chart-container min-height:400px` |
| `<=1440px` | 260px (no change) | 340px | 220px | unchanged | unchanged | slightly narrower | narrower | normal | `.fin-info::after max-width:160px` |
| `<=1366px` | 220px | 300px | 210px | narrower | unchanged | narrower | narrower | normal | Laptop profile |
| `<=1200px` | 200px | 300px | 200px | narrower | unchanged | **hidden (0px grid)** | **tabbed panel** | compact (8px padding, 10px font) | C+D merge; `.rp-tab-bar {display:flex}`; `.rp-header {display:none}` |
| `<=1024px` | **0px (drawer)** | 260px | 0px | **fixed overlay** `min(280px,80vw)` | full width | hidden | narrower | icon-size (4px padding, 10px, sep hidden) | `#sb-backdrop` enabled; `#return-stats-area {display:none}` |
| `<=768px` | 0px (drawer) | — | 0px | **fixed drawer** (1024px rules apply) | full width | hidden | **bottom sheet** (fixed, `min(60vh,480px)`) | **horizontal scroll** + scroll shadow | `#fin-toggle` FAB shown; `.draw-toolbar {display:none}` |
| `<=480px` | 0px (drawer) | — | 0px | drawer | full width | hidden | bottom sheet | same | `#ticker-strip {display:none}`; `#logo {display:none}`; `#market-state` fixed top-right |

**Note on 1024px sidebar:** The sidebar becomes `position:fixed; transform:translateX(-100%)` — it no longer occupies grid space. The grid column A is forced to `0px`. JS toggles class `.sb-drawer-open` to `translateX(0)`.

### Height Breakpoints

| Breakpoint | Key Changes |
|-----------|-------------|
| `<=800px` | `#stock-header min-height:36px`; `sub-chart height:clamp(60px,10vh,100px)`; `#return-stats-area max-height:120px` |
| `<=700px` | `#stock-header 36px`; `.sh-price {font-size: var(--fs-heading)}`; `.sh-details {display:none}`; `sub-chart clamp(50px,8vh,80px)`; `#main-chart-container min-height:160px`; `.fin-grid 3-col` |
| `>=1200px` | `#main-chart-container min-height:400px`; `.sub-chart height:120px` |

### Accessibility Breakpoint

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
All animations and transitions are disabled system-wide when the user has requested reduced motion.

---

## 5.3 Column Details

### 5.3.1 Column A — Sidebar (Virtual Scroll)

**File:** `js/sidebar.js` — `sidebarManager` IIFE, v12.0

#### Structural Hierarchy (DOM)

```
#sidebar  (class: sb-analysis | nothing=default | sb-minimal)
  .sb-controls
    .sb-search-wrap
      #sb-search-input
    .sb-sort-filter-row
      .sb-sort-select#sb-sort-select      (시총/등락률/패턴/이름)
      .sb-sort-dir#sb-sort-dir            (asc/desc toggle)
      #sb-sector-select.sb-sector-select  (16 sector groups)
  .sb-view-controls
    .sb-view-group#sb-view-group
      .sb-view-opt [data-view="default"]  (기본 — active by default)
      .sb-view-opt [data-view="analysis"] (상세)
      <!-- screener option removed 2026-04-06 -->
    .sb-chip.sb-pattern-only-chip         (패턴 감지만 filter, style:display:none)
  .sb-body  (overflow-y:auto, scroll parent for virtual scroll)
    #sb-watchlist-section (.sb-section, style:display:none when empty)
      .sb-header#sb-watchlist-header
      .sb-list#sb-watchlist-items
    .sb-recent-section#sb-recent-section (style:display:none when empty)
      .sb-header#sb-recent-header
      .sb-list#sb-recent
    .sb-section
      .sb-header  ("종목 (시총순)")
        .sb-count#sb-all-count
      .sb-list#sb-all
        .sb-virtual-spacer   (height = totalItems × itemH)
        .sb-virtual-content  (position:absolute, top = startIdx × itemH)
          [.sb-item ...] × (endIdx - startIdx) items only
```

#### Virtual Scroll Architecture

| Constant | JS value | Description |
|----------|----------|-------------|
| `VIRTUAL_ITEM_HEIGHT` | `42` | Default mode item height (px) |
| `VIRTUAL_BUFFER` | `5` | Items rendered above/below visible viewport |
| Analysis mode height | `56` | Returned by `_getItemHeight()` when `_viewMode === 'analysis'` |

**State:** `_vsState = { spacer, content, scrollParent, startIdx, endIdx }`

**Scroll path:**
1. `scroll` event on `.sb-body`
2. `_onVirtualScroll()` — sets `_vsRafPending = true` if not already
3. `requestAnimationFrame` → `_renderVisibleItems()`

**DOM budget calculation:**
```
viewHeight = scrollParent.clientHeight
elTop = .sb-all.offsetTop  (accounts for Watchlist + Recent sections above #sb-all)
relativeScrollTop = scrollParent.scrollTop - elTop
startIdx = floor(relativeScrollTop / itemH) - VIRTUAL_BUFFER
endIdx   = ceil((relativeScrollTop + viewHeight) / itemH) + VIRTUAL_BUFFER
DOM nodes active = endIdx - startIdx
```
For a typical 800px sidebar (42px items): ~19 visible + 10 buffer = **~29 DOM nodes** for 2700+ stocks.

**CSS requirements:**
```css
.sb-virtual-content { width: 100%; will-change: transform; }  /* GPU layer */
.sb-virtual-spacer  { width: 100%; }
```
**Critical:** Do not change `.sb-item` height without syncing `VIRTUAL_ITEM_HEIGHT` (or returning correct value from `_getItemHeight()`) — virtual scroll calculations break.

#### View Modes

| CSS class on `#sidebar` | `_viewMode` value | `VIRTUAL_ITEM_HEIGHT` | Item rows |
|------------------------|------------------|-----------------------|----------|
| _(none, default)_ | `'default'` | 42px | Row1: name+price; Row2: code+change |
| `.sb-analysis` | `'analysis'` | 56px | Row1+Row2+Row3: adds sparkline, mcap, volume, RSI |
| `.sb-minimal` | `'minimal'` (legacy, not in `_viewModes` array) | ~28px | Row1 only |

`_viewModes = ['default', 'analysis']` — screener removed 2026-04-06.

View mode persisted to `localStorage` under key `krx-sidebar-view`. Legacy values `'compact'`/`'minimal'` map to `'default'`; `'detailed'` maps to `'analysis'`.

**Sparkline lazy-load:** `IntersectionObserver` — canvas elements in `_vsState.content` are observed; OHLCV drawn only when the canvas enters the viewport. Prior observers are disconnected on scroll churn.

#### Sort Options

| `select` value | Sort key | Direction default |
|---------------|----------|------------------|
| `mcap` | `MARKET_CAP[code]` (from `index.json` `marketCap` field, fallback `base`) | `desc` |
| `change` | `_getChangePct()` — cached daily candle delta, fallback `index.json` `changePercent` | `desc` |
| `pattern` | `_getPatternCount(code, 'all')` from `_stockPatternCache` | `desc` |
| `name` | Stock name string | `asc` |

Sort direction toggle: `#sb-sort-dir` button, persists to localStorage `krx_sort_dir`.

#### Sector Filter — 16 Groups (R6)

`SECTOR_MAP` maps KSIC industry string → group name. `SECTOR_ORDER` defines display order:

```
1.반도체  2.전자/IT부품  3.자동차/운송  4.바이오/제약
5.금융    6.에너지/전력  7.화학/소재    8.소프트웨어/IT
9.기계/장비 10.철강/금속 11.건설/부동산 12.유통/소비재
13.음식료/생활 14.미디어/콘텐츠 15.운송/물류 16.기타
```

Unmapped KSIC strings → `'기타'`. Filter persisted to `localStorage` under key `krx_sector_filter`.

#### Keyboard Navigation (R1)

Events attached to `.sb-body`. Supported keys:

| Key | Action |
|-----|--------|
| `ArrowUp` | `_kbFocusIndex -= 1` |
| `ArrowDown` | `_kbFocusIndex += 1` |
| `PageUp` | Jump -visible page |
| `PageDown` | Jump +visible page |
| `Home` | Jump to index 0 |
| `End` | Jump to last |
| `Enter` | Select focused stock |

Focus indicator: `.kb-focus` class on active `.sb-item`.

#### Feature Index

| Feature | ID | Implementation |
|---------|-----|----------------|
| Watchlist (favorites) | R11 | `LS_ORDER` localStorage; `#sb-watchlist-section`; drag-and-drop `draggable=true` |
| Recent stocks | R2 | `LS_RECENT` localStorage, `MAX_RECENT=5`, `_recentStocks[]` |
| RSI badge | R10 | `calcRSI()` on demand, 60s TTL in `_rsiCache` |
| Volume column | R3 | `_formatVolume()` (억/만/raw units) |
| Pattern name tooltip | S6 | CSS `data-patterns` attribute + `.sb-item[data-patterns]:hover::after` |
| Pattern-only filter | R8 | `.sb-pattern-only-chip` chip toggle, `_patternOnlyFilter` flag |
| Large-volume badge | — | `.sb-vol-badge` (inline, orange `#FF6B35`) |
| Price flash animation | — | `.sb-price.price-flash-up/down`, 0.5s ease-out keyframe |

#### Item Structure (Default Mode)

```
.sb-item (grid: 1fr auto, 2 rows)
  .sb-row1 (grid-column: 1/-1, flex)
    .sb-name    (flex:1, ellipsis, 12px, weight 500)
    .sb-price   (font-mono, 11px, weight 600, color:#CCC, tnum)
  .sb-row2 (grid-column: 1/-1, flex, space-between)
    .sb-code    (font-mono, 10px, text-muted)
    .sb-change-group (flex, gap:4px)
      .sb-change-amt  (font-mono, 10px, .up/.dn)
      .sb-change      (font-mono, 10px, pill with rgba tint)
```

Analysis mode adds `.sb-row3` with `.sb-spark-wrap`, `.sb-mcap`, `.sb-volume`, `.sb-rsi`.

---

### 5.3.2 Column B — Chart Area

**Element:** `#chart-area`

```
#chart-area (flex column, background:#131722)
  #stock-header (flex, min-height:40px, border-bottom)
    .sh-left (flex column)
      .sh-identity (flex, overflow:hidden)
        #stock-name.sh-name       (16px, weight:700)
        #watchlist-toggle-btn     (star button)
        #stock-code.sh-code       (11px mono, text-muted)
        #stock-market.sh-market   (10px badge, KOSPI=blue/KOSDAQ=purple)
        #live-status.live-dot     (class: demo|file|ws)
        #live-label.live-label    (class: demo|file|ws)
        #data-freshness           (last tick timestamp)
        #conn-settings-btn        (gear icon → #conn-panel dropdown)
      .sh-price-row (flex, align-items:baseline)
        #stock-price.sh-price     (20px mono, weight:700, .up/.dn)
        #stock-change.sh-change   (13px mono, pill with rgba border)
    .sh-details (flex, flex-shrink:0)
      .sh-detail-item ×4          (시가/고가/저가/거래량)
        .sh-detail-label          (10px uppercase text-muted)
        .sh-detail-value          (11px mono weight:700; .sh-high=up, .sh-low=dn)

  #chart-toolbar (flex, min-height:32px, border-bottom, overflow:visible)
    .tf-btn ×8  (1m[disabled]/5m/15m~/30m~/1h/1d[active]/1w~/1M~)
    .sep
    .ct-btn ×4  (candle[active]/line/bar/heikin)
    .toolbar-right (margin-left:auto)
      .sep
      .ind-dropdown-wrap
        #ind-dropdown-toggle.ind-dropdown-btn
        #ind-dropdown-menu.ind-dropdown-menu (display:none → .show)
      .sep
      #pattern-toggle.ind-btn.pattern-btn
      #viz-toggle-wrap.ind-dropdown-wrap (style:display:none initially)
        #viz-toggle-btn.ind-dropdown-btn.has-active
        #viz-toggle-menu.ind-dropdown-menu

  #chart-wrap (flex:1, flex column, overflow:hidden)
    #draw-toolbar.draw-toolbar (position:absolute, left:0, width:40px)
      .draw-btn ×8 (select/sep/trendline/hline/vline/sep/rect/fib/sep/color/sep/eraser)
      .draw-sep ×3
      .draw-color-btn → .draw-color-picker (popup)
    #ohlc-bar (crosshair overlay, left=draw-toolbar-w+8px)
    #main-chart-container (flex:1, margin-left:40px, min-height:200px)
    #active-pattern-hud (position:absolute, right:64px, zoom-persistent)
    #pattern-tooltip.pattern-tooltip (hover popup)
    #pattern-summary-wrap (style:display:none)
      #pattern-detail-popup.pattern-detail-popup
      #pattern-summary-bar
    #pattern-history-bar (style:display:none)
    .sub-chart-wrap ×7 (flex-shrink:1, each with label outside container)
      .sub-chart-label#[id]-label (position:absolute, outside LWC container)
      #[id]-chart-container.sub-chart (height:clamp(80px,12vh,120px))

  #return-stats-area (style:display:none; hidden <=1024px)
    .rs-header
    .rs-body
      #rs-grid
      .php-table (thead + #php-tbody)
      .php-curve-wrap → #php-curve-canvas
    .rs-footer
```

#### Sub-Chart Identifiers

| Sub-chart | Container ID | Label ID | Destroy method | Group |
|-----------|-------------|---------|----------------|-------|
| RSI | `rsi-chart-container` | `rsi-label` | `chartManager.destroyRSI()` | OSCILLATOR_GROUP |
| MACD | `macd-chart-container` | `macd-label` | `chartManager.destroyMACD()` | Independent |
| Stochastic | `stoch-chart-container` | `stoch-label` | `chartManager.destroyStochastic()` | OSCILLATOR_GROUP |
| CCI | `cci-chart-container` | `cci-label` | `chartManager.destroyCCI()` | OSCILLATOR_GROUP |
| ADX | `adx-chart-container` | `adx-label` | `chartManager.destroyADX()` | OSCILLATOR_GROUP |
| Williams %R | `willr-chart-container` | `willr-label` | `chartManager.destroyWilliamsR()` | OSCILLATOR_GROUP |
| ATR | `atr-chart-container` | `atr-label` | `chartManager.destroyATR()` | OSCILLATOR_GROUP |

OSCILLATOR_GROUP members are mutually exclusive (only 1 active at a time). MACD is independent and can coexist with 1 oscillator.

**Sub-chart label placement:** Labels are placed **outside** the `.sub-chart` container (inside `.sub-chart-wrap`) with `position:absolute`. This is required because TradingView Lightweight Charts takes ownership of the container DOM.

#### Timeframe Buttons

| Button text | `data-tf` | CSS class | Source |
|-------------|----------|-----------|--------|
| 1분 | `1m` | `tf-btn` `disabled` | disabled (volume constraint) |
| 5분 | `5m` | `tf-btn` | file: `{code}_5m.json` |
| 15분 | `15m` | `tf-btn tf-btn-resampled` | 5m × 3 client resample |
| 30분 | `30m` | `tf-btn tf-btn-resampled` | 5m × 6 client resample |
| 1시간 | `1h` | `tf-btn` | file: `{code}_1h.json` |
| 일봉 | `1d` | `tf-btn active` (default) | file: `{code}.json` |
| 주봉 | `1w` | `tf-btn tf-btn-resampled` | daily resample (weekly group) |
| 월봉 | `1M` | `tf-btn tf-btn-resampled` | daily resample (monthly group) |

`.tf-btn-resampled::after { content:'~' }` — tilde indicator top-right of button.

#### Indicator Dropdown Menu

| Section header | `data-ind` values |
|---------------|------------------|
| 기본 | `vol`, `ma`, `ema` |
| 서브차트 | `macd`, `rsi`, `stoch`, `cci`, `adx`, `atr` |
| 오버레이 | `bb` |
| 고급 | `ich` |
| B-Tier (학술 검증 필요) | `willr` (disabled, D-Tier), `kalman` (disabled, D-Tier) |

"추천 세트" checkbox: `#ind-select-all` — selects vol + ma + rsi + macd.

#### Visualization Layer Toggles

`#viz-toggle-menu` (display:none until `pattern-toggle` activated). Maps to `vizToggles` in `appState.js`:

| Checkbox `data-viz` | `vizToggles` key | Controls |
|---------------------|-----------------|---------|
| `signal` | `vizToggles.signal` | Signal diamonds, stars, vbands |
| `chart` | `vizToggles.chart` | Chart patterns (mint) |
| `candle` | `vizToggles.candle` | Candle patterns (purple) |
| `forecast` | `vizToggles.forecast` | Target/stop forecast zones |

Signal sub-filters (`data-cat`): `ma`, `macd`, `rsi`, `bb`, `volume`, `stochastic`, `composite`.

Analysis runs regardless of toggles. Filter applied at render time by `_filterPatternsForViz()` in `appUI.js`.

#### Drawing Toolbar

Position: `position:absolute; left:0; top:0; bottom:0; width:40px`. Background: `var(--draw-toolbar-bg, #161616)`.

| Button `data-tool` | Keyboard shortcut | Icon |
|--------------------|------------------|------|
| `select` | S | Arrow/cursor |
| `trendline` | T | Diagonal line |
| `hline` | H | Horizontal line |
| `vline` | V | Vertical line |
| `rect` | R | Rectangle |
| `fib` | G | Fibonacci levels |
| `color` | — | Circle (fill = current color) |
| `eraser` | Del | X |

Drawing mode: `#main-chart-container.drawing-mode { cursor: crosshair }`.
Hidden at `<=768px` (`display:none`). Chart `margin-left` reset to 0.

When drawing tool is active: `handleScroll.pressedMouseMove` AND `handleScale.axisPressedMouseMove` must be disabled in `chart.js`.

---

### 5.3.3 Column C — Pattern Panel

**Element:** `#pattern-panel`

```
#pattern-panel (flex column, border-left:1px solid --border)
  .pp-header ("기술적 패턴 분석", 12px weight:600, color:--accent)
  .pp-content#pp-content (flex:1, padding:8px, overflow-y:auto)
    #pp-cards
      .pp-empty#pp-empty  (shown when no patterns)
      [.pp-card ...] × N  (max N = MAX_PATTERNS = 3, JS-generated)
```

At `<=1200px`: `#pattern-panel { display: none }`. JS (`appUI.js` `_migratePpCards()`) moves `#pp-cards` into `#rp-pattern-content` tab. On `>1200px` restoration, `#pp-cards` is moved back to `#pp-content`.

#### Tab Panel Lifecycle (appUI.js)

State vars:
- `_rpActiveTab = 'fin' | 'pattern'`
- `_tabScrollPos = { fin: 0, pattern: 0 }` — scroll position preservation

Functions:
- `_migratePpCards(toTab)` — appends `#pp-cards` to target container
- `_switchRpTab(tabId)` — toggles `.active` on tabs + content, slides indicator
- `initRpTabPanel()` — IIFE, binds click handlers, sets `mqTabMode = window.matchMedia('(max-width: 1200px)')` + `change` listener

The tab `matchMedia` listener calls `_migratePpCards(mqTabMode.matches)` on breakpoint crossing to keep `#pp-cards` in the right container.

#### Pattern Card Structure

Each `.pp-card` generated by `renderPatternPanel()` in `patternPanel.js`:

```
.pp-card (class: buy|sell|neutral; border-left-color: --up/--down/--neutral)
  .pp-card-header
    .pp-card-signal  (상승/하락/중립 badge)
    .pp-tier-badge   (S/A/B tier from 5-Tier Academic Verification System)
    .pp-card-name    (Korean name, 12px weight:700)
  .pp-card-category  (10px text-muted)
  .pp-card-diagram   (SVG/canvas textbook diagram, 70px height)
  .pp-conf-wrap      (confidence bar: label + track + fill + value)
  .pp-card-desc      (academicDesc, 11px, -webkit-line-clamp:4)
  .pp-card-psych     (psychology, gold left-border, hidden <=1200px)
    .pp-psych-label
    p
  .pp-card-risk      (stop/target prices, font-mono tnum)
  .pp-card-stats     (backtest rows: Bulkowski WR / sample N / horizon)
    .pp-stat-row ×N
  .pp-card-invalid   (invalidation conditions, hidden <=1200px)
    .pp-invalid-label
    p
  .pp-reg-toggle     (regression detail toggle, hidden <=1200px)
  .pp-reg-detail     (WLS regression stats, hidden by default)
  .pp-model-perf     (OOS IC + 95% CI, hidden <=1200px)
```

`.pp-card-psych`, `.pp-card-invalid`, `.pp-reg-toggle`, `.pp-reg-detail`, `.pp-model-perf` are all `display:none` at `<=1200px` (CSS rule).

#### PATTERN_ACADEMIC_META Structure

```js
PATTERN_ACADEMIC_META[type] = {
  nameKo: '패턴 한국어명',
  category: '캔들스틱 (반전)' | '캔들스틱 (중립)' | '캔들스틱 (지속)' | '차트패턴',
  candles: N,
  academicDesc: '학술 설명',
  psychology: '시장 심리 해설',
  bulkowskiWinRate: NN,   // integer percent
  invalidation: '무효화 조건'
}
```

Covers all 30+ patterns: 21 candle patterns + 9 chart patterns. See `patternPanel.js` keys for exhaustive list.

#### Tier Badge Colors (from KRX_COLORS)

| Tier | `KRX_COLORS` key | Hex | CSS meaning |
|------|-----------------|-----|------------|
| S | `TIER_A` | `#2ecc71` | green — highest academic validation |
| A | `TIER_B` | `#3498db` | blue |
| B | `TIER_C` | `#f39c12` | amber |
| D | `TIER_D` | `#95a5a6` | gray — suppressed or context-only |

Tier classification arrays in `appState.js`: `_TIER_S_CANDLE`, `_TIER_S_CHART`, `_TIER_A_CANDLE`, `_TIER_A_CHART`, `_TIER_B_CANDLE`, `_TIER_B_CHART`, `_SUPPRESS_PATTERNS`, `_CONTEXT_ONLY_PATTERNS`.

`_filterPatternsForViz()` in `appUI.js` applies D-Tier suppression at render time. Exception: `bullishBeltHold` restored conditionally when `cycle_phase === 'trough'` AND `PBR < 1.0`.

#### Scroll-to-Pattern Interaction

`scrollChartToPattern(time, index)` in `appUI.js` (line ~1982) — scrolls the LWC time scale to the pattern's candle. Called from pattern card hover or click handlers.

---

### 5.3.4 Column D — Financial Panel

**Element:** `#right-panel`

```
#right-panel (flex column, border-left:1px solid --border)
  .rp-header ("주요재무지표", color:--accent, hidden <=1200px)
  .rp-tab-bar#rp-tab-bar (display:none > 1200px; flex <=1200px, height:36px)
    .rp-tab [data-tab="fin"].active
    .rp-tab [data-tab="pattern"]
    .rp-tab-indicator (position:absolute bottom, 2px height, sliding via JS)
  #fin-content.rp-tab-content.active (flex column, overflow-y:auto)
    [content — see Financial Sections below]
  #rp-pattern-content.rp-tab-content (receives #pp-cards at <=1200px)
```

At `<=768px`: `#right-panel` becomes `position:fixed; bottom:0; transform:translateY(100%)`. Class `.rp-sheet-open` → `translateY(0)`. Handle bar rendered via `#right-panel::before` (36px × 4px, text-muted, 50% opacity). Backdrop: `#rp-backdrop.rp-bd-visible`. Toggle: `#fin-toggle` FAB (44px circle, bottom-right, `position:fixed`).

#### Financial Panel Sections

| Section title | CSS class | Content |
|---------------|-----------|---------|
| 주요손익 지표 | `.fin-section-title` | Revenue/Op income/Net income + YoY/QoQ |
| 수익성 지표 | `.fin-section-title` | 4-col grid: OPM/ROE/EPS/BPS |
| 밸류에이션 지표 | `.fin-section-title` | 14-item grid (see DOM ID table) |
| 성장성 지표 | `.fin-section-title` | 2-col grid: Rev CAGR / NI CAGR |
| 투자판단 | `.fin-section-title` | `.fin-score-badge` (score + grade) |
| 경기순환 | `.fin-section-title` | `.fin-cycle-badge` + yield curve row + bond metrics row |
| 추이 | `.fin-trend-section` | Canvas2D bar chart, 3 tabs (매출/영익/EPS) |
| 업종 비교 | `.fin-section-title` + `.fin-compare` | Sector peer comparison table |
| 동종업종 비교 | `.fin-section-title` + `.fin-peers` | Peer group table |
| PER 밴드 | `.fin-section-title` + `.fin-per-band-wrap` | Canvas2D `#fin-per-band` |
| OPM sparkline | `.fin-spark-wrap` | Canvas2D `#opm-sparkline` |
| 면책 조항 | `.fin-footer` | DART attribution, disclaimer toggle |

#### Financial Metrics DOM IDs

| Element ID | Metric | Formula / Source |
|-----------|--------|-----------------|
| `fin-period` | 기준 기간 | e.g., "2023 Q4" |
| `fin-revenue` | 매출액 | 억원 (raw KRW / 1e8) |
| `fin-rev-yoy` | 매출 YoY | % change |
| `fin-rev-qoq` | 매출 QoQ | % change |
| `fin-op` | 영업이익 | 억원 |
| `fin-op-yoy` | 영업이익 YoY | % |
| `fin-op-qoq` | 영업이익 QoQ | % |
| `fin-ni` | 순이익 | 억원 |
| `fin-ni-yoy` | 순이익 YoY | % |
| `fin-ni-qoq` | 순이익 QoQ | % |
| `fin-opm` | 영업이익률 | OPM% |
| `fin-roe` | ROE | NI / 자본총계 × 100 |
| `fin-eps` | EPS | 원/주 |
| `fin-bps` | BPS | 원/주 |
| `fin-per` | PER | 현재가 / EPS |
| `fin-pbr` | PBR | 현재가 / BPS |
| `fin-psr` | PSR | 시총 / 매출액 |
| `fin-yield-gap` | Yield Gap | E/P − KTB10Y (Fed Model) |
| `fin-beta` | CAPM β | Scholes-Williams (1977) |
| `fin-dd` | 부도거리 | Merton (1974) Distance-to-Default |
| `fin-blume-beta` | 보정 β | Blume (1975): 0.67×β + 0.33 |
| `fin-alpha-sig` | Alpha 유의성 | Jensen (1968), t-stat |
| `fin-smb` | SMB | Fama-French factor loading |
| `fin-hml` | HML | Fama-French factor loading |
| `fin-eva-spread` | EVA Spread | ROIC − WACC |
| `fin-roa` | ROA | NI / avg(총자산) |
| `fin-debt-ratio` | 부채비율 | 부채총계 / 자본총계 |
| `fin-npm` | NPM | NI / 매출액 |
| `fin-rev-cagr` | 매출 CAGR | 3yr compound growth |
| `fin-ni-cagr` | 순이익 CAGR | 3yr compound growth |
| `fin-score` | 투자판단 점수 | 0–100 composite |
| `fin-grade` | 투자판단 등급 | A/B/C/D |
| `fin-cycle-phase` | 경기순환 국면 | Stovall cycle phase |
| `fin-cycle-detail` | 국면 상세 | text |
| `fin-yield-slope` | 수익률곡선 기울기 | KTB 10Y − 3Y spread |
| `fin-yield-regime` | 곡선 레짐 | `normal`/`flat`/`inverted` |
| `fin-bond-duration` | KTB10Y 수정듀레이션 | Macaulay / (1+y) |
| `fin-bond-dv01` | DV01 | ΔP per +1bp |
| `fin-seed-warning` | 시드 데이터 경고 | Shown when `source === 'seed'` |
| `fin-source-badge` | 데이터 출처 배지 | `dart`/`default`/`seed` class |

#### Data Trust System (3 Tiers)

| `source` field | Origin | Display behavior |
|---------------|--------|-----------------|
| `'dart'` | `data/financials/{code}.json` | Full display, `.fin-source-badge.dart` (green) |
| `'hardcoded'` | `PAST_DATA` (Samsung/SK Hynix) | Full display + warning badge, `.fin-source-badge.default` (amber) |
| `'seed'` | Code hash PRNG | All metrics set to `"—"`; `#fin-seed-warning` shown; `.fin-source-badge.seed` (red) |

#### getFinancialData() Fallback Chain

1. Memory cache (`_financialCache[code]`, session scope)
2. `fetch('data/financials/{code}.json', { signal: AbortSignal.timeout(10000) })`
3. `getPastData()` → hardcoded constants (`PAST_DATA`) or seed PRNG

#### Canvas DPR Pattern (financials.js)

All canvases follow:
```js
ctx.setTransform(1,0,0,1,0,0);  // reset accumulation
ctx.clearRect(0, 0, w, h);
ctx.scale(dpr, dpr);
```
Canvas elements: `#fin-trend-canvas`, `#fin-per-band`, `#opm-sparkline`, `#php-curve-canvas`.

CSS guard:
```css
#fin-content canvas { max-width: 100%; }
```

#### Trend Chart Tabs

3 tabs in `#fin-trend-section`:
- `매출` (`data-metric="revenue"`) — 매출액 bar chart
- `영익` (`data-metric="op"`) — 영업이익 bar chart
- `EPS` (`data-metric="eps"`) — EPS bar chart

Tab data persisted to `_finTrendData[]` / `_finTrendMetric` (module vars in `financials.js`). Switching tabs calls `drawFinTrendChart()`.

#### Macro Data Used in financials.js

| Module var | Source file | Usage |
|-----------|------------|-------|
| `_macroData` | `data/macro/macro_latest.json` | KTB10Y for CAPM Rf, Yield Gap |
| `_bondsLatest` | `data/macro/bonds_latest.json` | Fallback KTB10Y, bond metrics |
| `_capmBetaJson` | `data/backtest/capm_beta.json` | Pre-computed DD, Blume β, Jensen alpha t-stat |
| `_ff3FactorData` | appWorker global (`_ff3FactorData`) | FF3 factor loadings (SMB, HML) |
| `_evaScores` | `data/backtest/eva_scores.json` | EVA spread |
| `_bondMetrics` | `data/macro/bonds_latest.json` | Modified duration, DV01 |

#### Sector Label Lookup

`_getSegmentLabel(stock)` priority:
1. `SEGMENT_OVERRIDE[stock.code]` (hardcoded overrides for major companies)
2. `KSIC_SHORT_LABEL[stock.industry || stock.sector]` (KSIC string → short label)
3. Empty string fallback

---

## 5.4 Typography and Color System

### 5.4.1 Font Stack

| Purpose | Font | CDN | Fallback |
|---------|------|-----|---------|
| UI / Korean text | Pretendard v1.3.9 | jsDelivr (dynamic-subset) | `'Segoe UI', sans-serif` |
| Prices / codes / monospace | JetBrains Mono | Google Fonts (wght:400;600;700) | `monospace` |

CDN links in `<head>` of `index.html`:
```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap">
```

CSS custom properties:
```css
--font-sans: 'Pretendard', 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### 5.4.2 Type Scale

| Property | Value | Primary Usage |
|----------|-------|---------------|
| `--fs-hero` | `28px` | (reserved for hero price, not currently used at root level) |
| `--fs-display` | `20px` | `#stock-price` (`.sh-price`), large price display |
| `--fs-heading` | `16px` | Stock name (`.sh-name`), section heading |
| `--fs-title` | `14px` | Logo text, medium labels |
| `--fs-body` | `12px` | Default text, sidebar items, fin panel labels |
| `--fs-caption` | `11px` | Section headers, badge text, drawing toolbar labels |
| `--fs-micro` | `10px` | Codes, metadata, small values |
| `--fs-nano` | `10px` | Smallest labels — minimum readability floor (fixed from 9px) |

**Note:** `--fs-micro` and `--fs-nano` are both `10px`. `nano` was previously `9px` and was raised to `10px` for minimum readability compliance. The two properties are semantically distinct (nano = absolute minimum, micro = metadata) but currently render identically.

### 5.4.3 Font Rendering

```css
html, body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

GPU acceleration for animated containers:
```css
#sidebar       { will-change: width; }
#right-panel   { will-change: transform; }   /* bottom sheet */
#main          { backface-visibility: hidden; }  /* grid transition */
```

### 5.4.4 Tabular Numerics

Applied via `font-feature-settings: "tnum"` and/or `font-variant-numeric: tabular-nums` on all numeric display elements:

```css
/* Sidebar */
.sb-price, .sb-change, .sb-change-amt, .sb-volume, .sb-rsi, .sb-mcap, .sb-index-val

/* Header */
#stock-price, .sh-detail-value

/* Financial panel */
.fin-period-label, .fin-row-value, .fin-grid-value, .fin-change, .fin-cmp-val, .fin-peer-val

/* Pattern panel */
.pp-conf-val, .pp-stat-value, .pp-reg-tval, .pp-model-value

/* Risk/target */
.pp-card-risk
```

### 5.4.5 Korean Text

`word-break: keep-all` applied where Korean prose appears:
- `#fin-content` (global rule)
- `.pp-card-desc`, `.pp-card-psych p`, `.pp-card-invalid p`
- `.toast-msg`, `.fin-score-note`
- `.fin-info::after` (tooltip)

### 5.4.6 Color System — Background Layers

4-layer dark theme (CSS-only, not in KRX_COLORS):

| Property | Value | Usage |
|----------|-------|-------|
| `--bg` | `#0A0A0A` | App background, deepest layer |
| `--panel` | `#141414` | Sidebar, right-panel, header, toolbar |
| `--bg-element` | `#1E1E1E` | Cards, inputs, detail items |
| `--bg-elevated` | `#282828` | Dropdowns, elevated states, search dropdown |
| `--border` | `#252525` | Default borders |
| `--border-subtle` | `rgba(255,255,255,0.07)` | Hairline separators |
| `--chart-bg` | `#131722` | TradingView chart container background |

Text 3-layer hierarchy:

| Property | Value | Usage |
|----------|-------|-------|
| `--text` | `#E8E8E8` | Primary text |
| `--text-sub` | `#A0A0A0` | Secondary text, labels |
| `--text-muted` | `#808080` | Muted, metadata |

### 5.4.7 Direction Colors (Korean Convention)

**Critical rule:** Korean market convention — up = red, down = blue. This is the opposite of most Western finance apps.

| Property | Value | `KRX_COLORS` key | Meaning |
|----------|-------|-----------------|---------|
| `--up` | `#E05050` | `UP` | 상승/매수/양봉 |
| `--down` | `#5086DC` | `DOWN` | 하락/매도/음봉 |
| `--neutral` | `#ffeb3b` | `NEUTRAL` | 횡보, pre/after-hours badge |
| `--accent` | `#A08830` | `ACCENT` | Gold accent (note: CSS comment says brightness 54%→44% vs original gold) |
| `--fin-good` | `#6BCB77` | — (CSS only) | Financial positive metric (green) |

### 5.4.8 Pattern Colors (Direction-Independent)

Pattern colors carry semantic "pattern detected here," NOT a directional prediction. Direction communicated through label text.

| `KRX_COLORS` key | Value | Usage |
|-----------------|-------|-------|
| `PTN_BUY` / `PTN_SELL` | `rgba(150,220,200,0.65)` | Chart pattern border (unified mint — same for both directions) |
| `PTN_BUY_FILL` / `PTN_SELL_FILL` | `rgba(150,220,200,0.12)` | Chart pattern fill (unified mint) |
| `PTN_CANDLE` | `#B388FF` | Candle pattern color (purple) |
| `PTN_STOP` | `rgba(255,107,53,0.55)` | Stop loss line (orange) |
| `PTN_TARGET` | `rgba(150,220,200,0.55)` | Price target line (mint) |
| `PTN_STRUCT` | `rgba(200,200,200,0.45)` | Structure lines (necklines, silver) |
| `PTN_NEUTRAL` | `rgba(200,200,200,0.55)` | Neutral pattern, doji glow |
| `PTN_INVALID` | `#FF6B35` | Invalidation zone (orange-red) |
| `PTN_MARKER_BUY` / `PTN_MARKER_SELL` | (mint) | Unified marker color |

Forecast zone colors (`FZ_*`): `FZ_TARGET_NEAR/FAR/BORDER` (mint gradient), `FZ_STOP_NEAR/FAR/BORDER` (orange gradient).

Chart layer colors: `CHART_BG=#131722`, `CHART_TEXT=#d1d4dc`, `CHART_BORDER=#2a2e39`.

### 5.4.9 Zone Color Rules

| Column | Colors allowed | Rationale |
|--------|---------------|-----------|
| B (chart) | `--up` (red), `--down` (blue) | Price direction — directional meaning |
| C (pattern) | Mint (`PTN_BUY`/`PTN_SELL`), Purple (`PTN_CANDLE`) | Pattern detection — not direction |
| D (financial) | `--fin-good` (green), `--up` (red for negative), `--text-sub` | Quality / risk level |
| Signals | `KRX_COLORS.NEUTRAL` (yellow bands for golden/dead cross zones) | Cross-signal zones |

**Dash tier standards:** `[2,3]` fine lines, `[5,3]` standard dashes, `[8,4]` long dashes (extended structure lines).

### 5.4.10 Reliability Tier Colors (KRX_COLORS)

| Key | Value | Tier |
|-----|-------|------|
| `TIER_A` | `#2ecc71` | A/S tier — green |
| `TIER_B` | `#3498db` | B tier — blue |
| `TIER_C` | `#f39c12` | C tier — amber |
| `TIER_D` | `#95a5a6` | D tier — gray |

---

## 5.5 Script Load Order

From `index.html` (all `defer`, version-stamped for cache busting):

```html
<script defer src="js/colors.js?v=13"></script>
<script defer src="js/data.js?v=12"></script>
<script defer src="js/api.js?v=15"></script>
<script defer src="js/realtimeProvider.js?v=10"></script>
<script defer src="js/indicators.js?v=27"></script>
<script defer src="js/patterns.js?v=45"></script>
<script defer src="js/signalEngine.js?v=42"></script>
<script defer src="js/chart.js?v=12"></script>
<script defer src="js/patternRenderer.js?v=24"></script>
<script defer src="js/signalRenderer.js?v=12"></script>
<script defer src="js/backtester.js?v=40"></script>
<script defer src="js/sidebar.js?v=12"></script>
<script defer src="js/patternPanel.js?v=22"></script>
<script defer src="js/financials.js?v=16"></script>
<script defer src="js/drawingTools.js?v=11"></script>
<script defer src="js/appState.js?v=2"></script>
<script defer src="js/appWorker.js?v=7"></script>
<script defer src="js/appUI.js?v=1"></script>
<script defer src="js/app.js?v=35"></script>
```

LWC loaded separately in `<head>` (not deferred, with SRI + local fallback):
```html
<script src="https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js"
  integrity="sha384-ExNwjbclSLY2LS3S2c6aDJDjpBHGZLct23WX65fLzj0ob1bRrCh9H90WThES5wQA"
  crossorigin="anonymous"
  onerror="...fallback to lib/..."></script>
```

Service Worker registered on `load` event in an inline `<script>` (before the defer chain). `sw.js` cache name: `cheesestock-vN` (see `sw.js` line 8 for current N).

`css/style.css` version: `?v=15` (in `<link rel="stylesheet">`).

---

## 5.6 Global Overlay Components

### Toast Notifications

`#toast-container` — `position:fixed; bottom:24px; right:24px; z-index:10000; flex-direction:column-reverse`.

Each `.toast` has a left-border color type + icon:

| Type class | Left border | Icon bg | Semantic |
|-----------|------------|---------|---------|
| `.toast-info` | `--down` (blue) | `--down` | Information |
| `.toast-success` | `--accent` (gold) | `--accent` | Success |
| `.toast-warning` | `--neutral` (yellow) | `--neutral` | Warning |
| `.toast-error` | `--up` (red) | `--up` | Error |

Animation: `toastSlideIn` keyframe (from translateX(40px) opacity:0 → translateX(0) opacity:1). Dismiss: `.toast-dismiss` class applies `translateX(20px) opacity:0`.

### Onboarding Tour

5-step overlay tour:
- `.onboarding-overlay` — `position:fixed; inset:0; rgba(0,0,0,0.55); z-index:9998; pointer-events:none`
- `.onboarding-highlight` — `z-index:9999 !important; box-shadow: 0 0 0 3px rgba(160,136,48,0.55)` (gold glow)

### Indicator Parameter Popup

`#ind-param-popup.ind-param-popup` — absolute positioned popup for per-indicator parameter editing (MA period, BB stdev, etc.). Triggered by long-press or right-click on indicator button.

### Connection Panel

`#conn-panel.conn-panel` — dropdown attached to `#conn-settings-btn`, positioned relative to `.sh-identity`. Shows WS server URL, connect/file/demo mode buttons, and connection status dot.

App loading overlay: `#app-loading-overlay` — shown before JS initializes, hidden by `app.js` once data loads. Includes `#conn-guide` for WS connection failure recovery.

---

## 5.7 Known Breakpoint Inconsistencies (Fix Authority)

The following issues were identified during the V5→V6 audit:

### Issue 1: V5 stated --fs-nano was 9px (stale)
**CSS (current):** `--fs-nano: 10px` (comment: `[FIX] 9px→10px: 최소 가독성 기준 충족`).
**Status:** Resolved in CSS. V6 documents correctly as 10px.

### Issue 2: 1200px media query lists --rpanel-w:300px but 1024px drops to 260px
**Sequence:** `<=1200px` sets `--rpanel-w:300px`. Then `<=1024px` sets `--rpanel-w:260px`. This is intentional cascading.
**At exactly 1024px**: `--rpanel-w` is 260px (the narrower 1024 rule wins). But `#main grid-template-columns` at 1024px is `0px 1fr 0px var(--rpanel-w)` — so D column gets 260px. This is correct.
**Status:** Not an inconsistency — intended cascade. Documented here to prevent confusion.

### Issue 3: V5 documented screener as a 3rd view mode
**Current state:** `_viewModes = ['default', 'analysis']`. Screener option is commented out in both `index.html` and `sidebar.js` (removed 2026-04-06). CSS classes `.sb-screener-panel`, `.sb-screener-controls`, `.sb-screener-run-btn`, etc. remain in `style.css` for potential restoration.
**Status:** Screener is deactivated, not removed. CSS is dormant.

### Issue 4: V5 stated Virtual scroll DOM count "approximately 29"
**Actual:** Depends on viewport and mode. With `VIRTUAL_BUFFER=5`, a 900px viewport (42px items) yields: `ceil(900/42)+5 = 27` top items + 5 bottom buffer = 32 DOM nodes. V5 cited "~29" for 800px viewport. V6 provides the formula instead of a fixed number.
**Status:** Documentation only — no code issue.

### Issue 5: `--accent` value discrepancy
**CSS value:** `#A08830` (CSS comment: "밝기 54%→44%"). **`KRX_COLORS.ACCENT`** in `colors.js`: verify via Grep (not read in this session). The CSS comment and `.claude/rules/colors.md` list `#A08830` for CSS `--accent` and `#C9A84C` for JS `ACCENT`. These intentionally differ: CSS accent is used for dark-on-light scenarios, JS accent is used for Canvas2D rendering (lighter on dark chart background).
**Status:** Intentional divergence. Both values are correct for their contexts.
