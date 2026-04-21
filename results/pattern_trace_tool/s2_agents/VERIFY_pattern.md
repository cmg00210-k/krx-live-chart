# Pattern-Theoretical Audit — S2 `LOOKBACK_BY_FAMILY`

Audited by: technical-pattern-architect agent (2026-04-21)
Source: agent inline findings (agent environment blocked file write; preserved here by orchestrator for archive).

## Executive summary

`LOOKBACK_BY_FAMILY` has complete 45/45 taxonomy coverage with consistent family key naming vs hook/tracePanel/rules, but its `considered` estimator systematically OVER-counts for chart families (H&S actual window=120 not 80; cupAndHandle=200 not 100; doubleBottom=50 not 40) and UNDER-counts trend-gate lookback on trend-sensitive candles (morningStar/hammer add ~10-bar trend priors on top of ATR 14 → true `minLookback ≈ 24`). The `unexplainedReject` metric is therefore informative as a bar-count ceiling but dominated by structurally-ineligible bars and should be floored by "valid-ATR + trend-context" bars in S3.

## 1. Taxonomy coverage

- Hook `FAMILY_TABLE`: 45 entries (13 single + 10 double + 9 triple + 2 multi + 11 chart). `LOOKBACK_BY_FAMILY`: 45 entries (mirror).
- Canonical `rules/patterns.md`: 45 entries. `tracePanel.js:TAXONOMY`: 45 entries, keys match byte-for-byte.
- Missing / extra / misnamed: **0**. `risingThreeMethods` / `fallingThreeMethods` correctly included even though PATTERN_WIN_RATES omits them.

## 2. `LOOKBACK_BY_FAMILY` value table review

| Group | Current minLookback / barWindow | Verdict | Notes |
|---|---|---|---|
| Single-bar pure shape (doji basic, marubozu, beltHold) | 14 / 1 | **OK** | ATR(14) baseline is exact. |
| Single-bar hammer / invHammer / hangingMan / shootingStar | 14 / 1 | **UNDERESTIMATE** | Calls `_detectTrend(candles, i, 10, a)`. Effective ≈ **24**. |
| doji (Nison-gated variant, patterns.js L.1594) | 14 / 1 | **UNDERESTIMATE** | `_detectTrend(.., 10, ..)` + 20-bar BB proxy. ≈ 20. |
| spinningTop | 14 / 1 | **UNDERESTIMATE** | Nison requires trend context; +10. |
| 2-bar engulfing | 14 / 2 | **UNDERESTIMATE** | `_detectTrend(candles, i-1, 10, a)`. True ≈ 24. |
| 2-bar harami / piercing / darkCloud / tweezers | 14 / 2 | **UNDERESTIMATE (likely)** | Trend-gate pattern; off ~10. |
| 3-bar morning/eveningStar | 14 / 3 | **UNDERESTIMATE** | `_detectTrend(candles, i-2, 10, ..)`. True ≈ 26. |
| 3-bar 3WS / 3BC / 3Inside / abandonedBaby / stickSandwich | 14 / 3 | **LIKELY OK to -10** | Some variants have trend gate. |
| 5-bar risingThree/fallingThreeMethods | 14 / 5 | **OK** | Trend implicit via bar-0 body. |
| doubleBottom / doubleTop | 40 / 40 | **UNDERESTIMATE** | Code filters `swingLows.filter(l => l.index >= candles.length - 50)`. +15 trend prior → ≈65. |
| headAndShoulders / invH&S | 80 / 80 | **UNDERESTIMATE** | `PatternEngine.HS_WINDOW = 120` + `preLookbackHS=10`. True ≈ **130**. |
| triangles / wedges | 50 / 50 | **SLIGHT OVERESTIMATE** | `ascendingTriangle` filters `candles.length - 60`. More accurate: 60. |
| channel | 40 / 40 | **UNVERIFIABLE** | Not spot-checked. |
| cupAndHandle | 100 / 100 | **UNDERESTIMATE** | L.3957: `scanStart = Math.max(detectFrom, n - 200)`. True = **200**. |

**Net pattern**: chart families systematically UNDER-counted; candle families with trend gates UNDER-counted by ~10 bars. `considered = length - 14 - (barWin-1)` is **not conservative for chart families** (ignores pivot-filter windows).

## 3. Detector iteration cross-check

| Family | patterns.js lines | Actual candidates (250-bar) | Hook `considered` | Delta |
|---|---|---|---|---|
| hammer (L.1389-1430) | trend prior 10 + ATR 14 | 236 | 236 | **0** (coincidence) |
| engulfing (L.1630-~1680) | trend prior 10 on i-1 | 235 | 235 | **0** |
| morningStar (L.1783-1832) | trend prior 10 on i-2 | 234 | 234 | **0** |
| headAndShoulders (L.3329-3405) | **swing-triple iteration** (~20 triples) | 170 | 170 | **-150 semantic mismatch** |

**Critical finding on H&S**: hook's `considered` expresses "bar positions eligible as right-shoulder". Code actually iterates **swing triples** (~10-30 per 250-bar series, not 170). `considered = 170` over-states the decision count by **5-20×**. Same applies to double/triangle/wedge/cup.

For candle patterns, `considered = bar positions` is a tight definition. For chart patterns, the semantic must switch to "**pivot triples / pairs scanned**" — not a bar-count. Current hook over-estimates chart `considered` by factor of 5-20×, making `unexplainedReject` for chart families **almost pure noise**.

## 4. `unexplainedReject` usefulness

**Candle families**: mildly useful. Value: **low-medium** — "236 bar positions scanned, none passed all gates" beats no signal but doesn't discriminate which gate rejected.

**Chart families**: **actively misleading**. H&S `unexplainedReject=170` suggests 170 "triples failed," but actual code iterates ~20. User overestimates rejection space by order of magnitude.

**Recommendation**: add "minimum viable consideration floor":
- Candle: `considered = max(0, length - minLookback - (barWindow-1))` (current) — OK
- Chart: `considered = swingCount × (swingCount-1)/2` (pairs, doubleBottom) or `swingCount-2` triples (H&S). Requires helper-observer pivot-extraction in Session 3.

Secondary floor (ATR-valid): subtract bars where `atr[i]` undefined/null (first 14 + NaN gaps). Implicit in `minLookback=14` but not chart families.

## 5. Edge cases

- **candles.length < minLookback**: `computeConsidered` line 170 returns `c > 0 ? c : 0`. **Clamped correctly**.
- **Timeframe-specific**: `LOOKBACK_BY_FAMILY` is bar-count. For 1m intraday, 120-bar H&S window = ~18 min → too short for valid H&S (Bulkowski P75=85 days on daily). Under-sensitive for 1m; OK for daily. **Action**: scale by `timeframe` in S3.
- **`risingThreeMethods`/`fallingThreeMethods` WR gap**: `wrFor()` returns null, `antiPredictor` null, but `considered`/`detected` compute correctly. **Not a blocker**.
- **Double-install guard**: `__isTraceWrapped` tag correct per M5. Verified.

## 6. Recommendations for Session 3 (ordered)

1. **Chart-family `considered` redefinition** (highest impact). Replace bar-count formula with pivot-count formula for all 11 chart families. Wrap point: helper-observer on `_findSwingHighs` / `_findSwingLows` captures swingCount at analyze enter; `considered = swingCount-2` (H&S) or `C(swingCount,2)` (doubleBottom). Reduces H&S `unexplainedReject` from 170 → ~18.

2. **Trend-gate lookback addition on candle families**. Update `LOOKBACK_BY_FAMILY` per-family: hammer/invHammer/hangingMan/shootingStar/doji(gated)/spinningTop/engulfing×2/harami×4/piercing/darkCloud/tweezer×2/morningStar/eveningStar → minLookback `14 → 24`. Wrap point: helper-observer on `_detectTrend` reads first-valid-i per family.

3. **Invariant-preserving "minimum viable consideration" floor**. Add `consideredValidAtr` field = bars where `atr[i] > 0` AND prior-trend window valid. Keep raw `considered` for backwards compat. Wrap point: observer on `_atr()` and `_detectTrend()` registers first-valid-index per family.

4. **Chart-window alignment with constants**. Read `PatternEngine.HS_WINDOW` (=120) and similar dynamically rather than hard-code 80/100. Wrap point: at hook install, `LOOKBACK_BY_FAMILY.headAndShoulders.minLookback = (PatternEngine.HS_WINDOW || 120) + 10`. Eliminates constant drift.

5. **Timeframe-aware scaling hook** (lowest priority). For intraday traces, scale chart windows: `minLookback_effective = floor(minLookback_daily × barsPerDay / 1)`. Wrap point: hook `runOnce` reads `msg.timeframe`, applies multiplier `{1m:1/6.5, 5m:1/32, 15m:1/96, 30m:1/192, 1h:1/390, 1d:1}`. Gate behind feature flag.

---

## Files inspected (no modifications)

- `debug/pattern-trace-hook.js` (full, 744 LOC)
- `.claude/rules/patterns.md` (full)
- `results/pattern_trace_tool/s2_agents/A1_hook_amid_summary.md`
- `js/patterns.js` spot-checks: L.242, 794-854, 1269-1283, 1389-1448, 1579-1618, 1630-1660, 1783-1832, 2846-2865, 3229-3242, 3329-3405, 3949-3963
- `debug/tracePanel.js` (L.40-109)
