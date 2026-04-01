# Financial Domain Rules

## Unit System
- DART raw: KRW (원). Display: 억원. Convert: `Math.round(n / 1e8)`
- `toEok()` in data.js: auto-detects via |n| > 1,000,000 threshold
- Trend charts: >= 10,000억 → "X.X조", >= 100억 → "X억"

## Valuation Metrics
| Metric | Formula | Decimals | Negative |
|--------|---------|----------|----------|
| PER | currentPrice/EPS or 시총/NI | 1 ("X.X배") | "적자" |
| PBR | currentPrice/BPS or 시총/자본총계 | 2 ("X.XX배") | "—" |
| PSR | 시총/매출액 | 2 ("X.XX배") | "—" |
| ROE | NI/자본총계*100 | 1% | negative OK |
| ROA | NI/avg(총자산)*100 | 1% | fallback: end-of-period |

## Data Trust System (3 tiers)
| source | Origin | Financial Panel |
|--------|--------|----------------|
| `'dart'` | `data/financials/{code}.json` | Full display |
| `'hardcoded'` | PAST_DATA (Samsung/SK Hynix) | Full display + warning |
| `'seed'` | Code hash PRNG | **All metrics cleared to "—"** |

Seed data must never display as real. Peer group also filters out seed.

## getFinancialData() Fallback Chain
1. Memory cache → 2. fetch `data/financials/{code}.json` (10s timeout) → 3. getPastData() (hardcoded or seed)

## DART API Rules
- Rate limit: 0.5s between calls
- Status "000"=OK, "013"=no data (normal), "010"=key error, "011"=quota
- Prefer CFS (consolidated), fallback OFS (separate)
- Account matching: Korean name-based (매출액, 수익(매출액), 영업수익 → all map to revenue)

## Canvas DPR (financials.js)
Always: `ctx.setTransform(1,0,0,1,0,0)` → `ctx.clearRect()` → `ctx.scale(dpr,dpr)`
