# Statistical Validation Audit — S2

**Scope**: `debug/pattern-trace-hook.js` (744 LOC) and `debug/tracePanel.js` (885 LOC). Session 2 introduced Wilson CI, EB shrinkage with slider, BH-FDR badge, Cohen power rule, anti-predictor rule, and n<5 asterisk. Production code untouched.

## Summary

- **PASS: 4 / AT-RISK: 3 / FAIL: 1**
- **Top 3 recommendations** (priority order):
  1. **Rename `bhFdrThreshold` constant or correct the docstring** — `9.62e-4` is `q/√N_stocks` (cross-stock Harvey-Liu-Zhu heuristic, N_stocks≈2700), NOT `q/√N_tests` as claimed in `tracePanel.js:27`. The plan's "N_tests=2631" derivation is arithmetically wrong (would yield 9.75e-4). This misleads any reviewer reading the panel docstring.
  2. **Rethink the 48 cutoff** — with candle grand_mean = 46.4% and N₀=35, any candle pattern with N<<35 (none today, but potential future additions) collapses to ~46.4% and always fires the anti-predictor. Meanwhile chart grand_mean = 49.9% means chart small-N never fires. Asymmetry is structural, not signal.
  3. **Surface DF assumption in Cohen power fallback** — the 5pp bullet threshold is unsourced and the `n_min=10/p` rule-of-thumb is being applied to a per-family WR test where "p" is a p-value, not a proportion, which reverses the semantics Cohen intended.

---

## Per-question verdict

### Q1 — Wilson 95% CI formula — **PASS**
`tracePanel.js:150-157` `_wilsonCI(p,n)` implements the textbook Wilson score interval exactly: center `(p + z²/2n)/(1+z²/n)`, margin `(z/(1+z²/n))·√(p(1-p)/n + z²/4n²)`. Using z=1.96 (vs 1.959964) introduces ≤0.02% error at 3-dp display — immaterial. Edge cases: `n<1` returns `null`; `p=0` or `p=1` yields non-degenerate Wilson interval (that's the whole point of Wilson over normal-approx). `p=NaN` produces NaN·NaN — caller `_wilsonStr` guards on `rawPct==null || n==null` but not NaN. Low-risk since upstream `wrFor` returns typed values. Clamping `[0,1]` via `Math.max/Math.min` after `center±margin` is the correct order. **Units**: `_wilsonStr` calls `_wilsonCI(shrunk/100, n)` (line 167) — shrunk is in percent, conversion to probability is correct.

### Q2 — Empirical Bayes shrinkage — **PASS**
`tracePanel.js:159-162` `_shrink(rawPct, n, n0, grandMean) = (n·rawPct + n0·grand)/(n+n0)`. This is the Beta-Binomial conjugate posterior mean under Beta(n₀·π, n₀·(1-π)) prior where π=grandMean — exactly matching `patterns.js:291-302` commentary. Arithmetic correct: raw and grand both in percent units, ratio percent-invariant. **N₀ semantics**: slider [5,200] default 35. At N₀=5, morningStar (N=29,550) unchanged; at N₀=200, only 0.7% shift — large-N patterns robust. Small-N patterns (cupAndHandle N=125, channel N=125, abandonedBabyBearish N=71, abandonedBabyBullish N=137) are the sensitive ones, which is semantically appropriate. **Grand-mean separation** (candle vs chart) is academically justified — chart patterns have different base rates (chart gm=49.9% vs candle gm=46.4%) and pooling would bias chart-pattern shrinkage downward. **Missing patterns**: hook `wrFor()` returns `null` when raw WR missing (risingThreeMethods, fallingThreeMethods). `_shrink` never called with null because `_wilsonStr` guards at line 165. Graceful.

### Q3 — BH-FDR threshold derivation — **FAIL**
Claim in `tracePanel.js:27,48` and `pattern-trace-hook.js:332`: `9.62e-4 = q/√N_tests`, q=0.05, N_tests=2631.

**Arithmetic**: `0.05 / √2631 = 9.7479e-4`, **not** 9.62e-4. The actual value 9.62e-4 corresponds to `0.05 / √2700 = 9.6225e-4` — the constant is derived from **N_stocks** (ALL_STOCKS.length fallback 2700 in `backtester.js:1321`), **not N_tests**. The code in `backtester._applyBHFDR` is self-consistent (`crossQ = ALPHA / sqrtN` where N=ALL_STOCKS.length), but the S2 plan/docstring labels it as an `N_tests` correction which is a different statistical concept.

**More critically**: `backtester.js:1321-1333` computes `crossStockSignificant` using `p ≤ (k+1)·crossQ / m` where m=number_of_tests_for_this_stock. That's a BH step-up with a reduced Q, which is a Harvey-Liu-Zhu 2016 heuristic for cross-stock multiple testing, not a naive `q/√n` threshold. The trace viewer's single-number `bhFdrThreshold=9.62e-4` approximation loses this structure and will over-reject patterns at rank 1 (panel shows `pVal ≤ 9.62e-4` as PASS but backtester's actual cutoff grows with rank).

**BH vs BY**: `_applyBHFDR` uses Benjamini-Hochberg, which assumes PRDS (positive regression dependence on subsets). Pattern families on the same candle series have substantial overlap (bullishEngulfing, morningStar, threeInsideUp often share bars). Strictly, Benjamini-Yekutieli (divides by Σ1/i ≈ ln(m)) is more conservative and dependence-robust. Not a fail, but the hook displays the panel threshold without flagging assumption.

**Remediation**: (a) correct docstrings to `q/√N_stocks`; (b) display rank-aware threshold instead of single scalar; (c) note PRDS assumption in tooltip.

### Q4 — Cohen sample-power rule — **AT-RISK**
`tracePanel.js:404-419`. `n_min = 10/p` is applied where `p` is a **p-value** (from `_approxPValue`). Cohen's original rule-of-thumb `n_min ≈ 10/p` refers to detecting a **proportion difference from a null proportion** with α=0.05, power≥80% for a large effect — `p` is the null proportion, not a p-value. The semantic is inverted: a small p-value (strong signal) demands larger n by this formula, which reverses Cohen's intent (small proportions need larger n to detect).

If the plan's citation "n_min ≈ 5000 for H&S p≈0.002" means H&S has an observed p-value of 0.002 and therefore needs `10/0.002=5000` samples, that's not a recognized power calculation. Correct interpretation would use observed proportion (WR≈56.9%) and ask "what n is needed to reject p=50% at α=0.05, 80% power?" — giving `n ≈ 16/(effect_size²)` ≈ 1500 for a 0.2 effect size.

**5pp bullet fallback**: `_shrink`-delta > 5pp → show bullet. No citation. Bulkowski 2005 uses 3pp for "meaningful" pattern edge; 5pp is arbitrary. Acceptable for a debug visualization, but label it "• = |shrunk−grand| > 5pp, heuristic only" in tooltip instead of implying Cohen.

**Remediation**: Either (a) rename "Pwr" column to "Detectability" with explicit note this is a diagnostic heuristic; or (b) replace with proper post-hoc power calculation `n · effect_size² · z_α_power`.

### Q5 — Anti-predictor threshold 48 — **FAIL**
`pattern-trace-hook.js:341-347` and `tracePanel.js:421-430, 550-557`. `antiPredictor = EB-shrunk WR < 48`. **48 is not sourced**; plan admits "no academic basis, trace-only".

**Empirical distribution check** (computed from `patterns.js` PATTERN_WIN_RATES + SAMPLE_SIZES):
- **candle grand_mean = 46.4%** (total N=1,189,219)
- **chart grand_mean = 49.9%** (total N=13,006)

Consequences at default N₀=35:
- Any future candle pattern with N<<35 → shrunk ≈ 46.4% → **always** anti-predictor
- Any future chart pattern with N<<35 → shrunk ≈ 49.9% → **never** anti-predictor
- Current 43 shrunk values: **17/43 (40%) below 48** (13/33 candle, 4/10 chart)

This is a structural asymmetry caused by the 48 cutoff sitting between the two grand means. Either (a) move threshold to max(candle_gm, chart_gm) − small_margin = ~47% and document; (b) use per-family Δ test (shrunk significantly below family's own historical mean) rather than absolute threshold; (c) drop the rule entirely from viewer pending A-Full session.

Additionally, the panel requires `finalConfidence > 50 AND inverted === false` — but hook always sets `inverted: null` (line 460 comment "not currently set by any detector"), so the panel's strict `inv === false` check **never fires** with current production data. Anti-predictor cards will always be empty in Section 8. This is a latent no-op bug camouflaged as a conservative safety check.

### Q6 — Wilson n<5 asterisk — **PASS**
`tracePanel.js:172-173`: `if (n<5) str += '*'`. The stricter Yates/modern convention is `np ≥ 5 AND n(1-p) ≥ 5` — for p≈0.5 that's n≥10. `n<5` asterisk is **less conservative** than textbook (catches fewer ambiguous cases) but is defensible for a debug viewer where the CI value itself is still shown. At n=5, p=0.5: Wilson [0.22, 0.78] — interval spans 56pp, essentially non-informative even with asterisk. Consider upgrading cutoff to n<10 for alignment with np≥5 when p near 0.5, but current implementation is not wrong.

### Q7 — pValue source and DF — **AT-RISK**
`pattern-trace-hook.js:356-382` uses `backtester._approxPValue(absT, n-1)` where n is horizon=5 sample count. DF = n-1. The `_approxPValue` (backtester.js:1523) uses Abramowitz & Stegun 26.2.17 normal approximation with `z = absT · (1-1/(4·df))/√(1+t²/(2·df))` — this **uses DF**, so small-N is properly penalized (df=3 underestimates vs exact t-dist by ≤1%). Good.

**Determinism**: `backtester.backtestAll(candles)` is deterministic given same candles (confirmed — no Math.random or time-seeded code in the tstat path). 500ms cache safe.

**2/45 always-null** (risingThreeMethods, fallingThreeMethods): hook gracefully skips; panel renders "—" and the BH-FDR row for those families is muted, not mis-scored. Correct.

### Q8 — Aggregate rejection invariant — **AT-RISK**
`pattern-trace-hook.js:495-561`. Invariant `considered >= detected + nearMiss + unexplainedReject` is enforced with clamp-to-0 fallback. At A-Mid, nearMiss=0 always, so `unexplained = considered − detected`. For `headAndShoulders` (minLookback=80, barWindow=80) on 250 bars: considered = 250 − 80 − 79 = 91; detected usually 0 or 1; unexplained ≈ 90. **Is "considered" semantically meaningful?** 

`computeConsidered` assumes each eligible bar position is a *distinct detection opportunity*. `patterns.js:detectHeadAndShoulders` (by spec) scans pivots, not every bar — many `considered` positions are **not actually iterated** because pivot detection skips non-pivot bars. So `considered` is an **upper bound** on detector iteration count, and `unexplainedReject` systematically **overcounts** for chart patterns vs candle patterns (candle detectors DO iterate every bar). The A1 summary flags this (gap #5). The invariant still holds (considered ≥ everything), but the viewer's "미설명 기각 90" headline for chart patterns is misleading — looks like 90 rejections when reality is ~10-20 pivot-checks. Label this with a tooltip acknowledging the upper-bound nature at A-Mid; the source='aggregate' tag already hints at this but should be explicit.

---

## BH-FDR constant arithmetic check

| Quantity | Value |
|---|---|
| Computed `0.05 / √2631` | **9.7479e-4** |
| Computed `0.05 / √2700` | **9.6225e-4** |
| Code constant `BH_FDR_CROSS` | `9.62e-4` |
| Discrepancy vs N_tests=2631 claim | **+1.3% (9.62 vs 9.75)** |
| Matches N_stocks=2700 claim | **Yes (≤0.1%)** |
| Source of truth | `backtester.js:1321` `N_STOCKS = ALL_STOCKS.length \|\| 2700`; `crossQ = ALPHA/sqrtN` — **stock count, not test count** |

Plan docstring needs correction: "q/√N_tests ≈ 9.62e-4" → "q/√N_stocks ≈ 9.62e-4 (Harvey-Liu-Zhu 2016 cross-stock heuristic)". `aggregate_stats.json` reports `analyzed: 2631` (stocks, not tests) — if that is the canonical N, the threshold should be 9.75e-4, not 9.62e-4. Pick one number and name it correctly.

---

## Grand-mean sensitivity for anti-predictor

Empirical from `patterns.js` PATTERN_WIN_RATES (43 patterns):

| Segment | Grand mean | Total N | Fires at small-N? |
|---|---|---|---|
| candle (33 patterns) | **46.4%** | 1,189,219 | **yes** (gm < 48) |
| chart (10 patterns) | **49.9%** | 13,006 | **no** (gm > 48) |

At default N₀=35 with typical small-N detection (N≈50-200):
- **13/33 (39%) candle patterns** currently have shrunk WR<48 → anti-predictor fires
- **4/10 (40%) chart patterns** currently have shrunk WR<48 → anti-predictor fires
- **Overall 17/43 ≈ 40%** of families trigger

40% trigger rate is too high for a "warning" classifier. Bonferroni intuition: if 40% of patterns always raise a red card, the card provides no discrimination. Combined with the latent `inverted !== false` bug (Q5), the Section 8 anti-predictor list will be empty on production data, but the Section 4 family-row icons will be plastered across nearly half the families.

**Recommended action**: set cutoff to `max(candle_gm, chart_gm) + 2pp ≈ 52%` so only patterns materially below either base rate fire, and normalize per family segment (candle vs chart) separately.

---

## Recommendations for Session 3

1. **[BH-FDR docstring fix]** Replace all `q/√N_tests=2631→9.62e-4` references with `q/√N_stocks≈2700→9.62e-4` (Harvey-Liu-Zhu cross-stock heuristic). Affected: `pattern-trace-hook.js:332`, `tracePanel.js:27,48`. Or change the constant to 9.75e-4 if N=2631 is the canonical choice. Add PRDS assumption note.
2. **[Anti-predictor threshold]** Move from fixed 48 to `segment_grand_mean + margin` (candle vs chart). Current 48 creates structural candle/chart asymmetry. Also remove or relax the `inverted === false` gate — current `inverted: null` production state silently suppresses all Section 8 cards (dead code path).
3. **[Cohen power renaming]** The "Pwr" column conflates p-value with proportion. Rename to "Detectability" with an explicit "heuristic diagnostic" tooltip, OR replace with post-hoc power calculation using observed effect size. The 5pp bullet threshold needs citation (Bulkowski 3pp) or relabel as arbitrary.
4. **[Aggregate considered semantics]** Tooltip for "미설명 기각" should distinguish candle (exact per-bar) from chart (upper bound from pivot-scan window) — currently both counted identically. Session 3 helper-observer can replace chart `considered` with actual pivot-scan iteration count.
5. **[Wilson small-n cutoff]** Consider upgrading from `n<5` to `n<10` (aligning with np≥5 rule at p≈0.5) for the asterisk. Current behavior is defensible but under-flags.
6. **[`inverted` semantics]** Pattern engine currently never sets `p.inverted`. Either (a) implement inversion flag in `patterns.js` (e.g., bullishHarami after downtrend vs uptrend) or (b) drop the field from l3 schema until Session 3 can populate it, so the panel's `inverted===false` check stops being dead code.
7. **[DF in `_approxPValue`]** Verify behavior for df=1 and df=2 — current code returns `p=1` when df<1 but no special handling for df=1,2 where normal approximation degrades. For 5-day horizon backtests this is unlikely but worth a note.
8. **[N_tests source single truth]** `aggregate_stats.json.analyzed=2631` vs `backtester.js` fallback 2700 disagree. Pin the canonical value and derive both the BH-FDR constant and the badge label from one source.

Total words: ~1450.
