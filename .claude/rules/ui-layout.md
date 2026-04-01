# UI Layout Rules

## 4-Column Grid
```
A (sidebar 260px) | B (chart, flex:1) | C (pattern 240px) | D (financial 380px)
```
Collapsible: `.sidebar-collapsed` (A=0), `.pp-col-collapsed` (C=0)

## Responsive Breakpoints (8 tiers)
| Width | Changes |
|-------|---------|
| >2000px | sidebar 240, rpanel 420, pattern 300 |
| <=1440px | rpanel 340, pattern 220 |
| <=1366px | sidebar 220, rpanel 300 |
| <=1200px | C column → fixed slide panel, toolbar shrinks |
| <=1024px | A column → fixed drawer (280px/80vw) |
| <=768px | Single column, D → bottom sheet (60vh), drawing toolbar hidden |
| <=480px | Ticker/logo hidden, full-width search |

Height: <=800px (compact headers), <=700px (hide details), >=1200px (expanded)

## Typography
- Sans: Pretendard (Korean) + Segoe UI fallback
- Mono: JetBrains Mono (prices, codes)
- Scale: 28/20/16/14/12/11/10px (hero→nano)
- Tabular nums: `font-feature-settings: "tnum"` for aligned columns
- Korean: `word-break: keep-all`

## Sub-chart Labels
Place labels **outside** chart containers (LWC takes over container DOM).
Drawing toolbar margin: `margin-left: var(--draw-toolbar-w)` (40px).

## Virtual Scroll (sidebar.js)
~40 DOM elements for 2700+ stocks. Do not change `.sb-item` height without syncing `ITEM_H` in JS.
Do not remove `will-change: transform` from `.sb-virtual-content`.
