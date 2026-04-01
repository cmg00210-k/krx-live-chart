# Color System (KRX_COLORS)

All colors centralized in `js/colors.js` as frozen object. CSS variables in `:root`.
**Rule: Always use `KRX_COLORS.*` (JS) or `var(--*)` (CSS). Never hardcode hex.**

## Direction Colors (Korean convention: up=red, down=blue)

| Purpose | JS | CSS | Value |
|---------|-----|-----|-------|
| Up/Buy | `UP` | `--up` | `#E05050` |
| Down/Sell | `DOWN` | `--down` | `#5086DC` |
| Neutral | `NEUTRAL` | `--neutral` | `#ffeb3b` |
| Accent | `ACCENT` | `--accent` | `#A08830` |
| Financial Good | — | `--fin-good` | `#6BCB77` |

## Pattern Colors (direction-independent)

| Purpose | JS | Value |
|---------|-----|-------|
| Chart patterns | `PTN_BUY`/`PTN_SELL` (unified) | mint `rgba(150,220,200,0.65)` |
| Candle patterns | `PTN_CANDLE` | purple `#B388FF` |
| Stop loss | `PTN_STOP` | orange `rgba(255,107,53,0.55)` |
| Target | `PTN_TARGET` | mint `rgba(150,220,200,0.55)` |
| Invalidation | `PTN_INVALID` | `#FF6B35` |
| Structure (neckline) | `PTN_STRUCT` | silver `rgba(200,200,200,0.45)` |

Forecast zones: `FZ_TARGET_*` (mint gradient), `FZ_STOP_*` (orange gradient).
Markers: `PTN_MARKER_BUY`/`PTN_MARKER_SELL` both mint (unified).

## Zone Rules
- Chart left (B column): red/blue (price direction)
- Financial right (D column): green/blue (quality level)
- Patterns (C column): mint (chart) / purple (candle) — never use UP/DOWN colors
- Dash tiers: `[2,3]` fine, `[5,3]` standard, `[8,4]` long
