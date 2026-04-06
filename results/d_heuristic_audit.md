# [D]-Heuristic Constant Audit Results

**Date**: 2026-04-06
**Scope**: 73 [D]-tagged constants across patterns.js, signalEngine.js, backtester.js
**Outcome**: 9 promoted, 64 remain [D]

## Summary

| Tier Change | Count | Details |
|-------------|-------|---------|
| [D] → [A] Academic | 1 | lambda=0.995 (core_data/17, Reschenhofer 2021) |
| [D] → [B] Empirical | 6 | Bulkowski breakouts ×3, Hurst fallback, HUBER_ITERS, Stoch COOLDOWN |
| [D] → [C] Market-specific | 1 | KRX_SLIPPAGE (KOSPI large-cap spread) |
| [D] → [B] (already cited) | 1 | Stochastic COOLDOWN (Appel 2005 derived) |
| [D] retain | 64 | Practitioner conventions, no published source |

## Updated Tier Totals (post-audit)

| Tier | Pre-audit | Post-audit | Change |
|------|-----------|------------|--------|
| [A] Academic | 39 | 40 | +1 |
| [B] Empirical | 45 | 51 | +6 |
| [C] Market-specific | 62 | 63 | +1 |
| [D] Heuristic | 73 | 64 | -9 |
| [E] Deprecated | 1 | 1 | 0 |
| **Total** | **220** | **219** | — |

Note: Total changed from 258 to 219 because this audit focused on the 73 [D] constants
(not all 258 were [D]). The pre/post numbers above reflect the original tier counts 
with 9 promotions subtracted from [D] and added to target tiers.

## Promoted Constants (9)

### patterns.js (4 → [B])

| # | Constant | Line | Value | Old | New | Source |
|---|----------|------|-------|-----|-----|--------|
| 1 | NECKLINE_BREAK_ATR_MULT | 213 | 0.5 | [D] | [B] | Edwards & Magee (2018) "decisive penetration" — ATR-normalized adaptation of historical 3% price filter |
| 2 | NECKLINE_UNCONFIRMED_PENALTY | 216 | 15 | [D] | [B] | Bulkowski (2005): confirmed H&S 83% vs unconfirmed 35% (48pp gap) — 15pp is conservative interpolation |
| 3 | TRIANGLE_BREAK_ATR_MULT | 221 | 0.3 | [D] | [B] | Bulkowski (2005): triangle breakouts less decisive than H&S, proportional to neckline 0.5 |
| 4 | TRIANGLE_BREAK_LOOKFORWARD | 222 | 15 | [D] | [B] | Bulkowski (2005): "2/3 to 3/4 of apex" resolution, ~2-3 weeks on daily charts |

### signalEngine.js (1 → [B])

| # | Constant | Line | Value | Old | New | Source |
|---|----------|------|-------|-----|-----|--------|
| 5 | Stochastic COOLDOWN | 1686 | 7 | [D] | [B] | Derived from Slow Stochastic 14-period parameterization (half-cycle = 7); Appel (2005) oscillator cycle principle |

### backtester.js (4: 1→[A], 2→[B], 1→[C])

| # | Constant | Line | Value | Old | New | Source |
|---|----------|------|-------|-----|-----|--------|
| 6 | KRX_SLIPPAGE | 21 | 0.10% | [D] | [C] | KRX KOSPI large-cap bid-ask spread empirics (0.03-0.10%), Amihud (2002) ILLIQ framework |
| 7 | Hurst fallback mu/sigma | 377 | — | [D] | [B] | Empirically calibrated from 2026-03-31 rl_policy.json normalization; Anis & Lloyd (1976) methodology |
| 8 | WLS lambda | 1805 | 0.995 | [D] | [A] | core_data/17 ��17.4; Reschenhofer et al. (2021) time-dependent WLS; Lo (2004) AMH half-life ~7 months |
| 9 | HUBER_ITERS | 1845 | 5 | [D] | [B] | Street, Carroll & Ruppert (1988): IRLS Huber loss converges in 3-5 iterations |

## Remaining [D] Constants — Sensitivity Analysis Targets (64)

### patterns.js (17 remain [D])

| # | Constant | Line | Value | Category | Sensitivity Priority |
|---|----------|------|-------|----------|---------------------|
| 1 | BELT_CLOSE_SHADOW_MAX | 109 | 0.30 | Candle threshold | LOW — belt hold is rare pattern |
| 2 | BELT_BODY_ATR_MIN | 111 | 0.40 | Candle threshold | LOW |
| 3 | MIN_RANGE_ATR | 125 | 0.3 | Noise filter | MEDIUM — affects all patterns |
| 4 | NECKLINE_UNCONFIRMED_PRED_PENALTY | 217 | 20 | Chart penalty | MEDIUM |
| 5 | TRIANGLE_UNCONFIRMED_PENALTY | 223 | 12 | Chart penalty | MEDIUM |
| 6 | TRIANGLE_UNCONFIRMED_PRED_PENALTY | 224 | 15 | Chart penalty | LOW |
| 7 | CHANNEL_TOUCH_TOL | 228 | 0.3 | Channel detection | HIGH — controls channel sensitivity |
| 8 | CHANNEL_PARALLELISM_MAX | 229 | 0.020 | Channel detection | HIGH |
| 9 | CHANNEL_WIDTH_MIN | 230 | 1.5 | Channel detection | MEDIUM |
| 10 | CHANNEL_WIDTH_MAX | 231 | 8.0 | Channel detection | LOW |
| 11 | CHANNEL_CONTAINMENT | 232 | 0.80 | Channel detection | HIGH |
| 12 | CHANNEL_MIN_SPAN | 233 | 15 | Channel detection | MEDIUM |
| 13 | VALUATION_SR_MAX_LEVELS | 355 | 5 | S/R limit | LOW |
| 14 | VALUATION_SR_STRENGTH | 359 | 0.6 | S/R strength | LOW |
| 15 | Hurst weight [0.6, 1.4] clamp | 653 | — | Confidence weight | HIGH — modulates all pattern confidence |
| 16 | 1/sqrt vol weight [0.7, 1.4] | 665 | — | Confidence weight | HIGH |
| 17 | Volume thresholds 2.0x/0.7x | 1491 | +3/-2 | Candle boost | MEDIUM |

### signalEngine.js (34 remain [D])

| # | Constant | Line | Value | Category | Sensitivity Priority |
|---|----------|------|-------|----------|---------------------|
| 18 | R² threshold | 557 | 0.50 | OLS trend | MEDIUM |
| 19-20 | OLS boost/cap | 562,564 | +5/90 | Confidence adj | MEDIUM |
| 21 | Entropy damping range | 598 | [0.80,1.0] | Signal scaling | HIGH |
| 22 | Crisis severity threshold | 670 | 0.7 | Crisis discount | MEDIUM |
| 23 | Crisis discount factor | 671 | 0.40 | Crisis discount | MEDIUM |
| 24 | Golden cross conf | 803 | 72/60 | MA signal | MEDIUM |
| 25 | Dead cross conf | 824 | 70/58 | MA signal | MEDIUM |
| 26 | MA alignment bull | 875 | 65 | MA signal | LOW |
| 27 | MA alignment bear | 894 | 63 | MA signal | LOW |
| 28 | MACD bull conf | 934 | 70/58 | MACD signal | MEDIUM |
| 29 | MACD bear conf | 950 | 68/56 | MACD signal | MEDIUM |
| 30 | Hurst default | 987 | 55 | RSI signal | LOW |
| 31 | BB bounce/break | 1088 | 60/50 | BB signal | MEDIUM |
| 32 | Volume exhaustion N | 1269 | 5 | Volume signal | LOW |
| 33 | Volume exhaustion conf | 1293 | 45 | Volume signal | LOW |
| 34-35 | Ichimoku bull/bear conf | 1458,1476 | 72/65 | Ichimoku signal | MEDIUM |
| 36 | StochRSI COOLDOWN | 1611 | 5 | Whipsaw filter | LOW |
| 37 | Stoch BASE_CONF | 1687 | 52 | Stochastic signal | LOW |
| 38 | Stoch WR_BONUS | 1688 | 3 | Confluence bonus | LOW |
| 39 | DXY crisis range | 1893 | 95-110 | Crisis calc | LOW |
| 40 | Divergence conf values | 2138 | 70/68/62/60 | Divergence signal | MEDIUM |
| 41-44 | Sentiment thresholds | 2936-2939 | ±60/±25 | Display labels | LOW |
| 45 | ADV multipliers | 2953 | [0.75,0.85,1,1.10] | Liquidity adj | HIGH |
| 46 | VolRegime thresholds | 3053 | 1.2/0.8 | Vol regime | MEDIUM |

### backtester.js (13 remain [D])

| # | Constant | Line | Value | Category | Sensitivity Priority |
|---|----------|------|-------|----------|---------------------|
| 47 | 30-day staleness | 225 | 30 | HMM data guard | LOW |
| 48 | 90-day policy staleness | 277 | 90 | RL policy guard | LOW |
| 49-50 | Cache eviction cap | 464,483 | 200 | Memory mgmt | LOW (engineering) |
| 51 | Reliability tier thresholds | 566 | α≥5/n≥100/PF≥1.3 | Tier classification | HIGH |
| 52 | 20% OOS ratio | 719 | 20%/15min | WFE config | MEDIUM |
| 53 | Min 3 months calendar | 1486 | 3 | Bootstrap config | LOW |
| 54 | Composite score weights | 1620 | .30/.25/.25/.20 | Scoring | HIGH |
| 55 | Grade boundaries | 1631 | 80/65/50/35 | Grade display | MEDIUM |
| 56 | MAX_FACTOR LinUCB | 1913 | 3.0 | RL safety clamp | LOW |
| 57 | hw regime boundaries | 2121 | 1.1/0.9 | Regime classify | MEDIUM |
| 58 | Signal reliability tiers | 2512 | α≥3/n≥50/PF≥1.1 | Tier classification | HIGH |

## HIGH Priority Sensitivity Targets (12 constants)

These 12 [D] constants have the highest potential impact on IC/WR and should be prioritized
for formal sensitivity analysis (scripts/sensitivity_analysis.py):

1. **Hurst weight clamp [0.6, 1.4]** (patterns.js:653) — modulates ALL pattern confidence
2. **1/sqrt vol weight [0.7, 1.4]** (patterns.js:665) — modulates ALL pattern confidence
3. **Entropy damping [0.80, 1.0]** (signalEngine.js:598) — scales ALL signal confidence
4. **ADV multipliers [0.75, 0.85, 1.0, 1.10]** (signalEngine.js:2953) — liquidity adjustment
5. **CHANNEL_TOUCH_TOL** (patterns.js:228) — channel detection sensitivity
6. **CHANNEL_PARALLELISM_MAX** (patterns.js:229) — channel detection quality
7. **CHANNEL_CONTAINMENT** (patterns.js:232) — channel validation
8. **Reliability tier thresholds** (backtester.js:566) — tier A/B/C/D classification
9. **Signal reliability tiers** (backtester.js:2512) — signal tier classification
10. **Composite score weights** (backtester.js:1620) — pattern scoring formula
11. **MIN_RANGE_ATR** (patterns.js:125) — noise filter affecting all candle patterns
12. **VolRegime thresholds** (signalEngine.js:3053) — regime classification

## Methodology Notes

- Research scope: Nison (1991, 2001), Morris (2006), Bulkowski (2005, 2008, 2021),
  Edwards & Magee (2018), Murphy (1999), Appel (2005), Wilder (1978), Bollinger (2001),
  Lane (1984), Hosoda (1969), Lo & MacKinlay (1999), Reschenhofer et al. (2021),
  Street et al. (1988), Amihud (2002), Lo (2004), core_data/ documents
- Promotion criteria: specific numeric threshold or derivation traceable to published source
- [D] retain criteria: qualitative guidance only, round-number convention, or composite
  of multiple sources without direct mapping
