# Phase 8 MVP Observation Pin

**Purpose**: Record real-device MVP 5/5 gate observation from `window.lastBacktestResults._aptMeta.mvpGate` after Phase 8 deployment.

**Status**: **PENDING USER OBSERVATION** — stub created 2026-04-21.

---

## 1. How to observe (user action)

1. Deploy Phase 8 branch: `wrangler pages deploy deploy ...` (after commit+stage)
2. Open `https://cheesestock.co.kr` in Chrome incognito (bypass SW cache; confirm `sw-updated v88` in Console)
3. Select a stock via sidebar — 3 suggested samples:
   - KOSPI large-cap: `005930` (Samsung Electronics)
   - KOSDAQ mid-cap: any from `data/kosdaq/` with > 500 bars
   - Small-cap: any with marketCap < 1000억
4. Wait 10-15s for backtest completion (toast "N개 패턴 감지됨")
5. DevTools Console:
   ```js
   window.lastBacktestResults._aptMeta.mvpGate
   ```
6. Record `{ status, passCount, gates, betaAvailable, effectiveFactorCount }` per stock below.

---

## 2. Observed results

### Sample 1 — KOSPI `<code>`

```
status: <GO|HOLD|NOGO>
passCount: <N>/5
betaAvailable: <true|false>
effectiveFactorCount: <4|5>
gates: {
  icirAnn: <bool>       (threshold: >= 0.3)
  icLift: <bool>        (threshold: >= +0.015 vs 5-col WLS)
  ci95Lower: <bool>     (threshold: Fisher CI lower > 0 at h=5)
  fullRatio: <bool>     (threshold: fullFactorRatio >= 0.5)
  signConsistent: <bool>(threshold: sign sign[3]=sign[5]=sign[10], non-zero)
}
```

### Sample 2 — KOSDAQ `<code>`

```
(same fields)
```

### Sample 3 — Small-cap `<code>`

```
(same fields)
```

---

## 3. Interpretation gates

| passCount | betaAvailable | Status | Next action |
|-----------|--------------|--------|-------------|
| 5/5 | true  | GO  | Declare Phase 7 complete; proceed to Phase 9 (beta wiring) is optional |
| 4/5 | false | HOLD-expected | Phase 8 documented limitation — `fullRatio` gate measures 4-of-5 completeness. Treat as **effective-GO** if other 4 gates PASS |
| 3-4/5 | true  | HOLD | Activate Phase 8 L6 block bootstrap + L7 factor decomposition |
| < 3/5 | any   | NOGO | Offline aptModel retune — review `scripts/mra_apt_extended.py` coefficients |

**Note**: Since `betaAvailable` is currently always `false` (Phase 9 backlog), `fullRatio` will typically report ratio < 0.5 because no occurrence has all 5 factors non-null. The MVP 5/5 gate should be interpreted against `effectiveFactorCount = 4`, i.e. require 4/4 of the non-beta gates (icirAnn, icLift, ci95Lower, signConsistent) + acknowledge `fullRatio` as structural fail until Phase 9.

---

## 4. Phase 9 trigger criteria (for later planning)

Beta60d wiring becomes priority-1 Phase 9 work if any of:
- Samples consistently show `icirAnn < 0.3` AND `icLift < 0.015` (other 4 factors insufficient)
- `signConsistent = false` on > 50% of observed stocks (beta may stabilize sign)
- User explicitly requests 5-of-5 "true" gate rather than effective-4-of-4

Phase 9 implementation outline (not in Phase 8 scope):
- Main thread caches KOSPI/KOSDAQ daily index candles at `dataService` layer
- `_getStockMetaForApt()` returns `{..., marketCandlesAligned: [...] }` slicing to match stock's candles dates
- `aptModel.computeFactors()` accepts `marketCandlesAligned`, computes per-occurrence rolling beta at each `idx`
- Trading-day alignment: match by date string, fill null for stock-only or index-only days

---

*Pin owner: Phase 8 completion report. Update when Sample 1-3 observations are available.*
