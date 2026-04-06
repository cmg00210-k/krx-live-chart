# ANATOMY V5 -- Complete Constant Registry

> Wave 3 compilation: 2026-04-06
> Authority: core_data/22_learnable_constants_guide.md (grading system)
> Cross-ref: S3_ta_methods.md, S3_signal_composite_catalog.md, S3_sec37_confidence_chain.md, S3_backtest_methodology.md

---

## Grading System

- **[A]** Academic Fixed: canonical, never modify (RSI=14, MACD 12/26/9)
- **[B]** Academic Tunable: range known, learnable (Kalman Q/R, stop ATR mult)
- **[C]** KRX Adapted: market-specific calibration (tax, slippage, engulf mult)
- **[D]** Heuristic: needs validation (entropy floor, HMM vol floor)
- **[E]** Deprecated: removed from pipeline

### Learning Mechanisms

| Symbol | Mechanism | Applicable Tiers | Frequency |
|--------|-----------|------------------|-----------|
| MAN | Manual calibration | A, B | As needed |
| GS | Grid search / CV | B, C, D | Quarterly |
| GCV | Generalized Cross-Validation | B, C, D | Quarterly |
| BAY | Bayesian posterior (Beta-Binomial) | B, C, D | Daily batch |
| WLS | WLS regression refit | B, C, D | Monthly batch |
| RL | LinUCB reward update | C, D | When gate passes |

---

## 1. Indicator Constants

Core technical indicator parameters from `js/indicators.js`.

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 1 | RSI period | 14 | A | MAN | fixed | indicators.js:63 | Wilder (1978) | Doc07 | S1->S3.3->S4 |
| 2 | MACD fast | 12 | A | MAN | fixed | indicators.js:calcEMA call | Appel (1979) | Doc07 | S1->S3.3->S4 |
| 3 | MACD slow | 26 | A | MAN | fixed | indicators.js:calcEMA call | Appel (1979) | Doc07 | S1->S3.3->S4 |
| 4 | MACD signal | 9 | A | MAN | fixed | indicators.js:calcEMA call | Appel (1979) | Doc07 | S1->S3.3->S4 |
| 5 | BB period | 20 | A | MAN | fixed | indicators.js:50 | Bollinger (2001) | Doc07 | S1->S3.3->S4 |
| 6 | BB multiplier | 2 | A | MAN | fixed | indicators.js:50 | Bollinger (2001) | Doc07 | S1->S3.3->S4 |
| 7 | ATR period | 14 | A | MAN | fixed | indicators.js:87 | Wilder (1978) | Doc07 | S1->S3.2->S3.8 |
| 8 | Ichimoku tenkan | 9 | A | MAN | fixed | indicators.js:135 | Hosoda (1968) | Doc07 | S1->S3.3->S4 |
| 9 | Ichimoku kijun | 26 | A | MAN | fixed | indicators.js:135 | Hosoda (1968) | Doc07 | S1->S3.3->S4 |
| 10 | Ichimoku spanB | 52 | A | MAN | fixed | indicators.js:135 | Hosoda (1968) | Doc07 | S1->S3.3->S4 |
| 11 | Ichimoku displacement | 26 | A | MAN | fixed | indicators.js:135 | Hosoda (1968) | Doc07 | S1->S3.3->S4 |
| 12 | CCI constant | 0.015 | A | MAN | fixed | indicators.js:1158 | Lambert (1980) | Doc07 | S1->S3.3->S4 |
| 13 | CCI period | 20 | A | MAN | fixed | indicators.js:1158 | Lambert (1980) | Doc07 | S1->S3.3->S4 |
| 14 | Stochastic K period | 14 | A | MAN | [7-21] | indicators.js:1028 | Lane (1984) | Doc07 | S1->S3.3->S4 |
| 15 | Stochastic D period | 3 | A | MAN | fixed | indicators.js:1028 | Lane (1984) | Doc07 | S1->S3.3->S4 |
| 16 | Stochastic smooth | 3 | A | MAN | fixed | indicators.js:1028 | Lane (1984) | Doc07 | S1->S3.3->S4 |
| 17 | ADX period | 14 | A | MAN | fixed | indicators.js:1187 | Wilder (1978) | Doc07 | S1->S3.3->S4 |
| 18 | Williams %R period | 14 | A | MAN | fixed | indicators.js:1262 | Williams (1979) | Doc07 | S1->S3.3->S4 |
| 19 | KRX_TRADING_DAYS | 250 | A | MAN | fixed | indicators.js:10 | KRX official | -- | S3.8(annualize) |
| 20 | Kalman Q (process noise) | 0.01 | D | GS | [0.001, 0.1] | indicators.js:170 | Heuristic, Mehra (1970) | Doc07 | S1->S3.3->S3.4 |
| 21 | Kalman R (measurement noise) | 1.0 | D | GS | [0.1, 10] | indicators.js:170 | Heuristic, Mehra (1970) | Doc07 | S1->S3.3->S3.4 |
| 22 | Kalman ewmaAlpha | 0.06 | B | GS | ~2/(30+1) | indicators.js:179 | Mohamed & Schwarz (1999) | Doc07 | S3.3 adaptive Q |
| 23 | Hurst minWindow | 10 | C | GS | [5, 20] | indicators.js:212 | Di Matteo (2005) | Doc07 | S3.3->S3.4 |
| 24 | Hurst window multiplier | 1.5x | B | MAN | fixed | indicators.js:225 | Peters (1994) | Doc07 | S3.3 |
| 25 | Hill k auto-select | floor(sqrt(n)) | B | MAN | -- | indicators.js:287 | Drees & Kaufmann (1998) | Doc12 | S3.3->EVT |
| 26 | Hill isHeavyTail threshold | 4 | A | MAN | fixed | indicators.js:307 | Standard EVT | Doc12 | S3.3->EVT |
| 27 | GPD quantile | 0.99 | A | MAN | [0.95, 0.995] | indicators.js:369 | Standard VaR | Doc12 | S3.2->stop |
| 28 | GPD threshold pct | 5% | B | GS | [3%, 10%] | indicators.js:335 | core_data/12 S3.4 | Doc12 | S3.3->EVT |
| 29 | GPD min exceedances | 30 | B | MAN | [20, 50] | indicators.js:336 | Hosking & Wallis (1987) | Doc12 | S3.3 |
| 30 | GPD min observations | 500 | B | MAN | 500+ | indicators.js:324 | ~2 years daily | Doc12 | S3.3 |
| 31 | GPD xi clamp max | 0.499 | B | MAN | fixed | indicators.js:365 | Hosking & Wallis (1987) | Doc12 | S3.3 |
| 32 | CAPM beta window | 250 | C | GS | [60, 500] | indicators.js:392 | Standard practice | Doc25 | S3.8 |
| 33 | CAPM MIN_OBS | 60 | B | MAN | [30, 120] | indicators.js:395 | Scholes & Williams (1977) | Doc25 | S3.8 |
| 34 | CAPM thinTrading threshold | 10% | B | MAN | [5%, 20%] | indicators.js:~440 | Scholes & Williams (1977) | Doc25 | S3.8 |
| 35 | HV Parkinson period | 20 | B | GS | [10, 50] | indicators.js:492 | Parkinson (1980) | Doc34 | S3.3->S3.4 |
| 36 | EWMA lambda (daily) | 0.94 | B | GS | [0.90, 0.97] | indicators.js:1336 | RiskMetrics (1996) | Doc34 | S3.3->S3.4 |
| 37 | EWMA lambda (intraday) | 0.97 | B | GS | [0.94, 0.99] | signalEngine.js:3029 | RiskMetrics (1996) | Doc34 | S3.4 vol regime |
| 38 | EWMA lambda (short) | 0.86 | B | GS | [0.80, 0.94] | signalEngine.js:3030 | RiskMetrics (1996) | Doc34 | S3.4 vol regime |
| 39 | Vol regime LOW threshold | 0.75 | D | GS | [0.60, 0.85] | indicators.js:1386 | Heuristic | Doc34 | S3.3->S3.4 |
| 40 | Vol regime HIGH threshold | 1.50 | D | GS | [1.25, 2.00] | indicators.js:1387 | Heuristic | Doc34 | S3.3->S3.4 |
| 41 | Vol regime long-run alpha | 0.01 | B | GS | [0.005, 0.05] | indicators.js:1392 | ~100-bar half-life | Doc34 | S3.3 |
| 42 | Amihud ILLIQ WINDOW | 20 | B | GS | [10, 30] | indicators.js:1431 | Amihud (2002) | Doc18 | S1->S3.3->S3.7 |
| 43 | Amihud CONF_DISCOUNT | 0.85 | C | GS | [0.70, 0.95] | indicators.js:1432 | Design parameter | Doc18 | S3.7(micro) |
| 44 | Amihud LOG_HIGH | -1.0 | C | GCV | [-0.5, -2.0] | indicators.js:1435 | KRX empirical | Doc18 | S3.7(micro) |
| 45 | Amihud LOG_LOW | -3.0 | C | GCV | [-2.5, -4.0] | indicators.js:1436 | KRX empirical | Doc18 | S3.7(micro) |
| 46 | CUSUM slack (k) | 0.5 | B | MAN | fixed | indicators.js:~CUSUM | Roberts (1966) | Doc34 | S3.3->S3.4 |
| 47 | CUSUM warmup | 30 | B | MAN | [20, 50] | indicators.js:~CUSUM | Page (1954) | Doc34 | S3.3 |
| 48 | CUSUM alpha (running stats) | 2/31 | B | MAN | ~30-bar HL | indicators.js:~CUSUM | Standard EWMA | Doc34 | S3.3 |
| 49 | BinSeg minSegment | 30 | B | MAN | [20, 50] | indicators.js:~BinSeg | Bai & Perron (1998) | Doc34 | S3.3 |
| 50 | HAR-RV D/W/M periods | 1/5/22 | A | MAN | fixed | indicators.js:~HAR | Corsi (2009) | Doc34 | S3.3 |
| 51 | HAR-RV MIN_FIT | 60 | B | MAN | [30, 120] | indicators.js:2074 | OLS stability | Doc34 | S3.3 |
| 52 | OLS trend window | 20 | B | GS | [10, 50] | signalEngine.js:556 | Standard practice | -- | S3.4 |
| 53 | OLS R2 threshold (strong trend) | 0.50 | D | GS | [0.30, 0.70] | signalEngine.js:557 | Heuristic | -- | S3.4 |

---

## 2. Pattern Detection Constants

Pattern thresholds from `js/patterns.js` (PatternEngine static fields).

### 2.1 Candle Body/Shadow Ratios

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 54 | DOJI_BODY_RATIO | 0.05 | A | MAN | fixed | patterns.js:23 | Nison (1991) | Doc06 | S3.2->S4.L1 |
| 55 | SHADOW_BODY_MIN | 2.0 | A | MAN | fixed | patterns.js:26 | Morris (2006) | Doc06 | S3.2->S4.L1 |
| 56 | COUNTER_SHADOW_MAX_STRICT | 0.15 | A | MAN | fixed | patterns.js:29 | Morris (2006) | Doc06 | S3.2 |
| 57 | COUNTER_SHADOW_MAX_LOOSE | 0.30 | B | GS | [0.15, 0.40] | patterns.js:30 | Morris (2006) | Doc06 | S3.2 |
| 58 | MIN_BODY_RANGE | 0.10 | B | GS | [0.05, 0.20] | patterns.js:33 | Nison (1991) | Doc06 | S3.2 |
| 59 | MAX_BODY_RANGE_HAMMER | 0.40 | C | GS | [0.33, 0.50] | patterns.js:37 | Nison 0.33 + KRX tick | Doc06 | S3.2 |
| 60 | THREE_SOLDIER_BODY_MIN | 0.50 | B | GS | [0.3, 0.7] | patterns.js:41 | Nison (1991) "long body" | Doc06 | S3.2 |
| 61 | ENGULF_PREV_BODY_MIN | 0.20 | B | GS | [0.10, 0.30] | patterns.js:46 | Nison "visible real body" | Doc06 | S3.2 |
| 62 | ENGULF_CURR_BODY_MIN | 0.25 | B | GS | [0.15, 0.35] | patterns.js:47 | Nison (1991) | Doc06 | S3.2 |
| 63 | ENGULF_BODY_MULT | 1.50 | C | GS | [1.0, 2.0] | patterns.js:51 | Nison + KRX limit | Doc06 | S3.2 |
| 64 | HARAMI_PREV_BODY_MIN | 0.30 | B | MAN | fixed | patterns.js:54 | Nison (1991) | Doc06 | S3.2 |
| 65 | HARAMI_CURR_BODY_MAX | 0.50 | B | MAN | fixed | patterns.js:55 | Nison (1991) | Doc06 | S3.2 |
| 66 | HARAMI_CURR_BODY_MIN | 0.05 | B | MAN | fixed | patterns.js:56 | Nison (1991) | Doc06 | S3.2 |
| 67 | STAR_BODY_MAX | 0.20 | A | MAN | [0.1, 0.3] | patterns.js:60 | Nison (1991) | Doc06 | S3.2 |
| 68 | STAR_END_BODY_MIN | 0.50 | B | GS | [0.3, 0.7] | patterns.js:61 | Nison (1991) "long body" | Doc06 | S3.2 |
| 69 | PIERCING_BODY_MIN | 0.30 | B | MAN | fixed | patterns.js:64 | Nison (1991) | Doc06 | S3.2 |
| 70 | SPECIAL_DOJI_SHADOW_MIN | 0.70 | B | MAN | [0.60, 0.85] | patterns.js:67 | Nison (1991) | Doc06 | S3.2 |
| 71 | SPECIAL_DOJI_COUNTER_MAX | 0.15 | C | GS | [0.05, 0.25] | patterns.js:70 | Nison + KRX tick | Doc06 | S3.2 |
| 72 | TWEEZER_BODY_MIN | 0.25 | C | GS | [0.15, 0.35] | patterns.js:74 | Nison + KRX tick | Doc06 | S3.2 |
| 73 | TWEEZER_TOLERANCE | 0.10 | C | GS | [0.05, 0.20] | patterns.js:75 | ATR*0.1 tolerance | Doc06 | S3.2 |
| 74 | MARUBOZU_BODY_RATIO | 0.85 | A | MAN | fixed | patterns.js:78 | Nison (1991) | Doc06 | S3.2 |
| 75 | MARUBOZU_SHADOW_MAX | 0.02 | A | MAN | fixed | patterns.js:80 | Morris (2006) | Doc06 | S3.2 |
| 76 | SPINNING_BODY_MIN | 0.05 | A | MAN | fixed | patterns.js:83 | Nison (1991) | Doc06 | S3.2 |
| 77 | SPINNING_BODY_MAX | 0.30 | A | MAN | fixed | patterns.js:84 | Nison (1991) | Doc06 | S3.2 |
| 78 | SPINNING_SHADOW_RATIO | 0.75 | B | GS | [0.50, 1.00] | patterns.js:87 | Morris (2006) | Doc06 | S3.2 |
| 79 | THREE_INSIDE_CONFIRM_MIN | 0.20 | B | MAN | [0.10, 0.30] | patterns.js:90 | Nison (1991) | Doc06 | S3.2 |
| 80 | ABANDONED_BABY_DOJI_MAX | 0.15 | C | GS | [0.10, 0.20] | patterns.js:94 | Bulkowski (2008) | Doc06 | S3.2 |
| 81 | ABANDONED_BABY_GAP_MIN | 0.03 | C | GS | [0.01, 0.10] | patterns.js:97 | KRX near-gap | Doc06 | S3.2 |
| 82 | LONG_DOJI_SHADOW_MIN | 0.30 | A | MAN | fixed | patterns.js:100 | Nison (1991) | Doc06 | S3.2 |
| 83 | LONG_DOJI_RANGE_MIN | 0.80 | B | GS | [0.50, 1.00] | patterns.js:102 | Design | Doc06 | S3.2 |
| 84 | BELT_BODY_RATIO_MIN | 0.60 | B | MAN | [0.50, 0.80] | patterns.js:105 | Morris (2006) | Doc06 | S3.2 |
| 85 | BELT_OPEN_SHADOW_MAX | 0.05 | B | MAN | [0.02, 0.10] | patterns.js:107 | Morris (2006) | Doc06 | S3.2 |
| 86 | BELT_CLOSE_SHADOW_MAX | 0.30 | D | GS | [0.15, 0.40] | patterns.js:109 | No basis | Doc06 | S3.2 |
| 87 | BELT_BODY_ATR_MIN | 0.40 | D | GS | [0.25, 0.60] | patterns.js:111 | No basis | Doc06 | S3.2 |
| 88 | HARAMI_CROSS_DOJI_MAX | 0.08 | B | GS | [0.05, 0.15] | patterns.js:115 | Nison (1991) | Doc06 | S3.2 |
| 89 | STICK_SANDWICH_CLOSE_TOL | 0.05 | C | GS | [0.02, 0.10] | patterns.js:120 | Bulkowski (2008) + KRX | Doc06 | S3.2 |
| 90 | STICK_SANDWICH_MID_BODY_MIN | 0.30 | B | MAN | [0.20, 0.50] | patterns.js:122 | Bulkowski (2008) | Doc06 | S3.2 |
| 91 | MIN_RANGE_ATR | 0.30 | D | GS | [0.15, 0.50] | patterns.js:125 | No basis | Doc06 | S3.2 |

### 2.2 Trend/Quality/Target Constants

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 92 | TREND_THRESHOLD | 0.30 | D | GS | [0.10, 0.50] | patterns.js:130 | Brock et al. (1992) | Doc07 | S3.2 trend |
| 93 | Q_WEIGHT.body | 0.25 | D | WLS | [0.10, 0.40] | patterns.js:134 | Nison qualitative | Doc06 | S3.2 quality |
| 94 | Q_WEIGHT.volume | 0.25 | D | WLS | [0.10, 0.40] | patterns.js:134 | Nison qualitative | Doc06 | S3.2 quality |
| 95 | Q_WEIGHT.trend | 0.20 | D | WLS | [0.10, 0.30] | patterns.js:134 | Nison qualitative | Doc06 | S3.2 quality |
| 96 | Q_WEIGHT.shadow | 0.15 | D | WLS | [0.05, 0.25] | patterns.js:134 | Nison qualitative | Doc06 | S3.2 quality |
| 97 | Q_WEIGHT.extra | 0.15 | D | WLS | [0.05, 0.25] | patterns.js:134 | Nison qualitative | Doc06 | S3.2 quality |
| 98 | STOP_LOSS_ATR_MULT | 2.0 | B | GS | [1.5, 3.0] | patterns.js:138 | Wilder (1978) | Doc07 | S3.2->S4.L8 |
| 99 | ATR_FALLBACK_PCT | 0.02 | D | GS | [0.01, 0.04] | patterns.js:143 | KRX median ATR/close | -- | S3.2 fallback |
| 100 | CANDLE_TARGET_ATR.strong | 1.88 | C | BAY | [1.0, 3.0] | patterns.js:190 | Theil-Sen calibrated | Doc22 | S3.2->S4.L8 |
| 101 | CANDLE_TARGET_ATR.medium | 2.31 | C | BAY | [1.5, 3.5] | patterns.js:190 | Theil-Sen calibrated | Doc22 | S3.2->S4.L8 |
| 102 | CANDLE_TARGET_ATR.weak | 2.18 | C | BAY | [1.5, 3.5] | patterns.js:190 | Theil-Sen calibrated | Doc22 | S3.2->S4.L8 |
| 103 | CHART_TARGET_ATR_CAP | 6 | B | GS | [4, 8] | patterns.js:193 | EVT 99.5% VaR | Doc12 | S3.2->S4.L8 |
| 104 | CHART_TARGET_RAW_CAP | 2.0 | B | GS | [1.5, 3.0] | patterns.js:196 | Bulkowski P80 | Doc06 | S3.2->S4.L8 |
| 105 | PROSPECT_STOP_WIDEN | 1.15 | D | GS | [1.00, 1.50] | patterns.js:202 | KT (1979) dampened | Doc23 | S3.2->S4.L8 |
| 106 | PROSPECT_TARGET_COMPRESS | 0.87 | C | GS | [0.70, 1.00] | patterns.js:204 | 1/PROSPECT_STOP_WIDEN | Doc23 | S3.2->S4.L8 |

### 2.3 Chart Pattern Constants

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 107 | NECKLINE_BREAK_LOOKFORWARD | 20 | B | GS | [10, 30] | patterns.js:209 | Bulkowski (2005) | Doc06 | S3.2 |
| 108 | NECKLINE_BREAK_ATR_MULT | 0.50 | B | GS | [0.25, 1.00] | patterns.js:213 | Edwards & Magee (2018) | Doc06 | S3.2 |
| 109 | NECKLINE_UNCONFIRMED_PENALTY | 15 | B | GS | [10, 25] | patterns.js:216 | Bulkowski (2005) | Doc06 | S3.2 |
| 110 | NECKLINE_UNCONFIRMED_PRED_PENALTY | 20 | D | GS | [10, 30] | patterns.js:217 | No basis | Doc06 | S3.2 |
| 111 | TRIANGLE_BREAK_ATR_MULT | 0.30 | B | GS | [0.15, 0.50] | patterns.js:221 | Bulkowski (2005) | Doc06 | S3.2 |
| 112 | TRIANGLE_BREAK_LOOKFORWARD | 15 | B | GS | [10, 25] | patterns.js:222 | Bulkowski (2005) | Doc06 | S3.2 |
| 113 | TRIANGLE_UNCONFIRMED_PENALTY | 12 | D | GS | [8, 20] | patterns.js:223 | No basis | Doc06 | S3.2 |
| 114 | TRIANGLE_UNCONFIRMED_PRED_PENALTY | 15 | D | GS | [10, 25] | patterns.js:224 | No basis | Doc06 | S3.2 |
| 115 | CHANNEL_TOUCH_TOL | 0.30 | D | GS | [0.15, 0.50] | patterns.js:228 | No basis | Doc06 | S3.2 |
| 116 | CHANNEL_PARALLELISM_MAX | 0.020 | D | GS | [0.010, 0.040] | patterns.js:229 | No basis | Doc06 | S3.2 |
| 117 | CHANNEL_WIDTH_MIN | 1.50 | D | GS | [0.50, 2.50] | patterns.js:230 | No basis | Doc06 | S3.2 |
| 118 | CHANNEL_WIDTH_MAX | 8.0 | D | GS | [5.0, 12.0] | patterns.js:231 | No basis | Doc06 | S3.2 |
| 119 | CHANNEL_CONTAINMENT | 0.80 | D | GS | [0.70, 0.90] | patterns.js:232 | No basis | Doc06 | S3.2 |
| 120 | CHANNEL_MIN_SPAN | 15 | D | GS | [10, 25] | patterns.js:233 | No basis | Doc06 | S3.2 |
| 121 | CHANNEL_MIN_TOUCHES | 3 | B | MAN | [2, 5] | patterns.js:234 | Murphy (1999) | Doc06 | S3.2 |
| 122 | HS_WINDOW | 120 | C | GS | [60, 150] | patterns.js:238 | Bulkowski P75=85 + KRX | Doc06 | S3.2 |
| 123 | HS_SHOULDER_TOLERANCE | 0.15 | B | GS | [0.05, 0.20] | patterns.js:242 | Bulkowski (2005) | Doc06 | S3.2 |

### 2.4 Win Rate / Shrinkage Constants

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 124 | N0 (shrinkage denom) | 35 | D | GS | [20, 50] | patterns.js:299 | Efron & Morris (1975) EB | Doc22 | S3.8 |
| 125 | VALUATION_SR_RANGE | 0.30 | C | MAN | [0.20, 0.50] | patterns.js:352 | KRX daily limit 30% | Doc06 | S3.2->S3.7 |
| 126 | VALUATION_SR_MAX_LEVELS | 5 | D | MAN | [3, 10] | patterns.js:355 | Design | -- | S3.2 |
| 127 | VALUATION_SR_STRENGTH | 0.60 | D | GS | [0.30, 0.90] | patterns.js:359 | Design | -- | S3.2 |

### 2.5 AMH (Adaptive Markets Hypothesis) Constants

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 128 | AMH_LAMBDA.KOSDAQ | 0.00367 | C | BAY | [0.002, 0.006] | patterns.js:363 | Lo (2004), Doc20 S10 | Doc20 | S3.8 decay |
| 129 | AMH_LAMBDA.KOSPI | 0.00183 | C | BAY | [0.001, 0.004] | patterns.js:364 | Lo (2004), Doc20 S10 | Doc20 | S3.8 decay |
| 130 | AMH_LAMBDA.DEFAULT | 0.00275 | C | BAY | [0.001, 0.005] | patterns.js:365 | Lo (2004) | Doc20 | S3.8 decay |

---

## 3. Signal Constants

Signal weights, cooldowns, and thresholds from `js/signalEngine.js`.

### 3.1 Signal Weights (SignalEngine._weights)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 131 | goldenCross weight | +3.0 | B | BAY | [2, 4] | signalEngine.js:428 | Murphy (1999) | Doc07 | S3.4->S3.5 |
| 132 | deadCross weight | -3.0 | B | BAY | [-4, -2] | signalEngine.js:428 | Murphy (1999) | Doc07 | S3.4->S3.5 |
| 133 | maAlignment_bull weight | +2.0 | B | BAY | [1, 3] | signalEngine.js:429 | Murphy (1999) | Doc07 | S3.4 |
| 134 | macdBullishCross weight | +2.0 | B | BAY | [1, 3] | signalEngine.js:431 | Appel (1979) | Doc07 | S3.4 |
| 135 | macdDivergence weight | +/-2.5 | B | BAY | [1.5, 3.5] | signalEngine.js:432 | Murphy (1999) | Doc07 | S3.4 |
| 136 | rsiOversold weight | +1.5 | B | BAY | [1, 2.5] | signalEngine.js:435 | Wilder (1978) | Doc07 | S3.4 |
| 137 | rsiOversoldExit weight | +2.5 | B | BAY | [1.5, 3.5] | signalEngine.js:435 | Wilder (1978) | Doc07 | S3.4 |
| 138 | bbLowerBounce weight | +1.5 | B | BAY | [0.5, 2.5] | signalEngine.js:440 | Bollinger (2001) | Doc07 | S3.4 |
| 139 | ichimokuCloudBreakout weight | +3.0 | B | BAY | [2, 4] | signalEngine.js:444 | Hosoda (1968) | Doc07 | S3.4 |
| 140 | volumeBreakout weight | +2.0 | B | BAY | [1, 3] | signalEngine.js:460 | Caginalp (1998) | Doc07 | S3.4 |
| 141 | adxBullishCross weight | +2.0 | B | BAY | [1, 3] | signalEngine.js:455 | Wilder (1978) | Doc07 | S3.4 |
| 142 | cciOversoldExit weight | +1.5 | B | BAY | [0.5, 2.5] | signalEngine.js:454 | Lambert (1980) | Doc07 | S3.4 |
| 143 | williamsROversold weight | +1.0 | B | BAY | [0.5, 2.0] | signalEngine.js:456 | Williams (1979) | Doc07 | S3.4 |
| 144 | obvDivergence weight | +/-2.5 | B | BAY | [1.5, 3.5] | signalEngine.js:462 | Granville (1963) | Doc07 | S3.4 |
| 145 | flowAlignedBuy weight | +2.5 | C | BAY | [1.5, 3.5] | signalEngine.js:466 | Doc39 S6 | Doc39 | S3.4 |
| 146 | shortSqueeze weight | +2.5 | C | BAY | [1.5, 3.5] | signalEngine.js:470 | Doc40 S4-5 | Doc40 | S3.4 |
| 147 | _VIX_PROXY (VIX->VKOSPI) | 1.12 | C | MAN | [1.0, 1.3] | signalEngine.js:12 | Whaley (2009) | Doc26 | S3.4 |

### 3.2 Detection Thresholds

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 148 | MA cross ATR gap filter | 0.40 | C | GS | [0.2, 0.6] | signalEngine.js:792 | KRX noise filter | -- | S3.4 |
| 149 | RSI overbought level | 70 | A | MAN | fixed | signalEngine.js:~1001 | Wilder (1978) | Doc07 | S3.4 |
| 150 | RSI oversold level | 30 | A | MAN | fixed | signalEngine.js:~1001 | Wilder (1978) | Doc07 | S3.4 |
| 151 | Vol z-score threshold | 2.0 | A | MAN | fixed | signalEngine.js:1204 | Normal distribution 2.28% | Doc07 | S3.4 |
| 152 | StochRSI COOLDOWN | 5 | D | GS | [3, 10] | signalEngine.js:1611 | Heuristic | Doc22 | S3.4 |
| 153 | Stochastic COOLDOWN | 7 | B | GS | [5, 12] | signalEngine.js:1686 | Appel (2005) half-cycle | Doc07 | S3.4 |
| 154 | BB squeeze lookback | 20 | B | MAN | [15, 30] | signalEngine.js:1135 | Bollinger (2001) | Doc07 | S3.4 |
| 155 | BB squeeze percentile | 10% | B | GS | [5%, 20%] | signalEngine.js:1154 | Bollinger (2001) | Doc07 | S3.4 |
| 156 | ADX TF period (daily) | 14 | A | MAN | fixed | signalEngine.js:1775 | Wilder (1978) | Doc07 | S3.4 |
| 157 | ADX TF period (5m/1m) | 28 | C | GS | [21, 42] | signalEngine.js:1775 | 2x daily for noise | -- | S3.4 |

### 3.3 Confidence Adjustment Constants (in signalEngine.analyze)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 158 | MAX_CUMULATIVE_ADJ | 15 | D | GS | [10, 20] | signalEngine.js:572 | Heuristic | Doc22 | S3.4 |
| 159 | Entropy damping floor | 0.80 | D | GS | [0.70, 0.90] | signalEngine.js:598 | Shannon (1948) concept | Doc22 | S3.4 |
| 160 | IV/HV discount alpha | 0.20 | C | GCV | [0.1, 0.3] | signalEngine.js:622 | Doc26 S5.3 | Doc26 | S3.4 |
| 161 | IV/HV discount floor | 0.50 | C | MAN | [0.30, 0.70] | signalEngine.js:623 | Design | Doc26 | S3.4 |
| 162 | Expiry discount D-2~D+1 | 0.70 | C | MAN | [0.60, 0.85] | signalEngine.js:662 | Doc27 S4 | Doc27 | S3.4 |
| 163 | Crisis severity threshold | 0.70 | D | GS | [0.50, 0.90] | signalEngine.js:670 | Heuristic | -- | S3.4 |
| 164 | Crisis severity discount slope | 0.40 | D | GS | [0.20, 0.60] | signalEngine.js:671 | Heuristic | -- | S3.4 |
| 165 | HMM counter-trend floor | 0.70 | D | GS | [0.50, 0.85] | signalEngine.js:692 | Hamilton (1989) | Doc22 | S3.4 |
| 166 | S/R buy proximity factor | 8 | D | GS | [4, 12] | signalEngine.js:747 | Heuristic | -- | S3.4 |
| 167 | S/R sell proximity factor | 5 | D | GS | [3, 8] | signalEngine.js:762 | Heuristic | -- | S3.4 |
| 168 | OLS boost (+5) cap | 90 | D | MAN | [85, 95] | signalEngine.js:563 | Design | -- | S3.4 |
| 169 | Signal confidence global floor | 10 | A | MAN | fixed | signalEngine.js:582 | Design minimum | -- | S3.4 |
| 170 | Signal confidence global cap | 90 | B | MAN | [85, 95] | signalEngine.js:582 | Design | -- | S3.4 |

---

## 4. Composite Signal Constants

Base confidence values for `COMPOSITE_SIGNAL_DEFS` in `js/signalEngine.js`.

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 171 | strongBuy_hammerRsiVolume baseConf | 61 | C | BAY | [45, 75] | signalEngine.js:23 | calibrated (WR=47.9%) | Doc22 | S3.5->S4 |
| 172 | strongSell_shootingMacdVol baseConf | 69 | C | BAY | [55, 80] | signalEngine.js:36 | calibrated (WR=56.0%) | Doc22 | S3.5->S4 |
| 173 | buy_goldenCrossRsi baseConf | 58 | C | BAY | [45, 72] | signalEngine.js:52 | calibrated | Doc22 | S3.5->S4 |
| 174 | sell_deadCrossMacd baseConf | 58 | C | BAY | [45, 72] | signalEngine.js:64 | calibrated | Doc22 | S3.5->S4 |
| 175 | buy_hammerBBVol baseConf | 63 | C | BAY | [50, 75] | signalEngine.js:79 | KRX WR x1.25 | Doc22 | S3.5->S4 |
| 176 | sell_shootingStarBBVol baseConf | 69 | C | BAY | [55, 80] | signalEngine.js:92 | WR=56% x1.25 | Doc22 | S3.5->S4 |
| 177 | buy_morningStarRsiVol baseConf | 58 | C | BAY | [40, 70] | signalEngine.js:105 | WR=42.9% | Doc22 | S3.5->S4 |
| 178 | sell_eveningStarRsiVol baseConf | 65 | C | BAY | [50, 78] | signalEngine.js:118 | WR=53.3% | Doc22 | S3.5->S4 |
| 179 | buy_engulfingMacdAlign baseConf | 48 | C | BAY | [35, 65] | signalEngine.js:133 | WR=41.3% | Doc22 | S3.5->S4 |
| 180 | sell_engulfingMacdAlign baseConf | 66 | C | BAY | [50, 78] | signalEngine.js:147 | WR=56.4% | Doc22 | S3.5->S4 |
| 181 | buy_doubleBottomNeckVol baseConf | 68 | C | BAY | [55, 80] | signalEngine.js:159 | WR=62.1% + vol | Doc22 | S3.5->S4 |
| 182 | sell_doubleTopNeckVol baseConf | 75 | C | BAY | [60, 85] | signalEngine.js:172 | WR=73.0% | Doc22 | S3.5->S4 |
| 183 | buy_ichimokuTriple baseConf | 70 | C | BAY | [55, 80] | signalEngine.js:185 | Hosoda WR=65-75% est | Doc22 | S3.5->S4 |
| 184 | buy_adxGoldenTrend baseConf | 67 | C | BAY | [50, 78] | signalEngine.js:314 | Wilder (1978) | Doc22 | S3.5->S4 |
| 185 | composite window (all) | 5 | C | GS | [3, 7] | signalEngine.js:27 | 1 KRX trading week | Doc22 | S3.5 |
| 186 | optionalBonus (Tier 1) | 5 | D | GS | [3, 8] | signalEngine.js:27 | Heuristic | -- | S3.5 |
| 187 | optionalBonus (Tier 2) | 4 | D | GS | [2, 6] | signalEngine.js:55 | Heuristic | -- | S3.5 |
| 188 | optionalBonus (Tier 3) | 3 | D | GS | [1, 5] | signalEngine.js:248 | Heuristic | -- | S3.5 |

---

## 5. Confidence Chain Constants

10-function sequential pipeline in `js/appWorker.js`, config in `js/appState.js`.

### 5.1 Market Context (CC-01)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 189 | CCSI low threshold | 85 | C | MAN | [80, 90] | appWorker.js:1031 | Lemmon & Portniaguina (2006) | Doc30 | S3.7 CC-01 |
| 190 | CCSI low discount (buy) | 0.88 | C | GS | [0.80, 0.95] | appWorker.js:1031 | Lemmon & Portniaguina (2006) | Doc30 | S3.7 CC-01 |
| 191 | CCSI high threshold | 108 | C | MAN | [100, 115] | appWorker.js:1032 | Lemmon & Portniaguina (2006) | Doc30 | S3.7 CC-01 |
| 192 | CCSI high boost (buy) | 1.06 | C | GS | [1.02, 1.10] | appWorker.js:1032 | Lemmon & Portniaguina (2006) | Doc30 | S3.7 CC-01 |
| 193 | Net foreign threshold | 1000 eok | C | MAN | [500, 2000] | appWorker.js:1036 | Richards (2005) ~$75M | Doc28 | S3.7 CC-01 |
| 194 | Net foreign boost (buy) | 1.08 | C | GS | [1.03, 1.15] | appWorker.js:1036 | Richards (2005) | Doc28 | S3.7 CC-01 |
| 195 | Earning season discount | 0.93 | C | MAN | [0.85, 0.97] | appWorker.js:1039 | Design | -- | S3.7 CC-01 |

### 5.2 RORO Regime (CC-02)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 196 | RORO ENTER_ON threshold | 0.25 | D | GS | [0.15, 0.40] | appWorker.js:1430 | Heuristic | -- | S3.7 CC-02 |
| 197 | RORO ENTER_OFF threshold | -0.25 | D | GS | [-0.40, -0.15] | appWorker.js:1430 | Heuristic | -- | S3.7 CC-02 |
| 198 | RORO risk-on buy adj | 1.06 | D | GS | [1.02, 1.12] | appWorker.js:1461 | Heuristic | -- | S3.7 CC-02 |
| 199 | RORO risk-off buy adj | 0.92 | D | GS | [0.85, 0.98] | appWorker.js:1463 | Heuristic | -- | S3.7 CC-02 |
| 200 | RORO clamp | [0.92, 1.08] | D | MAN | -- | appWorker.js:1471 | Heuristic | -- | S3.7 CC-02 |

### 5.3 Macro 11-Factor (CC-03)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 201 | Expansion buy mult | 1.06 | C | MAN | [1.02, 1.12] | appWorker.js:1107 | IS-LM (Doc30) | Doc30 | S3.7 CC-03 |
| 202 | Contraction buy mult | 0.92 | C | MAN | [0.85, 0.98] | appWorker.js:1111 | IS-LM (Doc30) | Doc30 | S3.7 CC-03 |
| 203 | Yield curve inverted buy | 0.88 | C | MAN | [0.80, 0.95] | appWorker.js:1125 | Doc35 S3 | Doc35 | S3.7 CC-03 |
| 204 | Credit stress discount | 0.85 | C | MAN | [0.75, 0.92] | appWorker.js:1156 | Doc35 S4 | Doc35 | S3.7 CC-03 |
| 205 | Credit elevated buy | 0.93 | C | MAN | [0.85, 0.97] | appWorker.js:1158 | Doc35 S4 | Doc35 | S3.7 CC-03 |
| 206 | Foreigner signal threshold | 0.30 | C | GS | [0.15, 0.50] | appWorker.js:1167 | Mundell-Fleming Doc28 | Doc28 | S3.7 CC-03 |
| 207 | Taylor gap dead band | 0.25 | D | GS | [0.10, 0.50] | appWorker.js:1244 | Rudebusch (2002) | Doc30 | S3.7 CC-03 |
| 208 | Taylor gap max adj | 5% | D | GS | [2%, 10%] | appWorker.js:1246 | Design | Doc30 | S3.7 CC-03 |
| 209 | MCS bull threshold | 0.60 | C | GS | [0.55, 0.70] | appWorker.js:1219 | Doc30 S4.3 | Doc30 | S3.7 CC-03 |
| 210 | MCS bear threshold | 0.40 | C | GS | [0.30, 0.45] | appWorker.js:1222 | Doc30 S4.3 | Doc30 | S3.7 CC-03 |
| 211 | Macro clamp | [0.70, 1.25] | C | MAN | -- | appWorker.js:1046 | Design | -- | S3.7 CC-03 |

### 5.4 Micro ILLIQ/HHI (CC-04)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 212 | HHI_MEAN_REV_COEFF | 0.10 | D | GS | [0.05, 0.20] | appWorker.js:1507 | Doc33 S6.2 | Doc33 | S3.7 CC-04 |
| 213 | Micro clamp | [0.80, 1.15] | C | MAN | -- | appWorker.js:1547 | Design | -- | S3.7 CC-04 |

### 5.5 Derivatives 7-Factor (CC-05)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 214 | USD/KRW weak threshold | 1400 | C | MAN | [1350, 1500] | appWorker.js:732 | Doc28 S3 | Doc28 | S3.7 CC-05 |
| 215 | USD/KRW strong threshold | 1300 | C | MAN | [1200, 1350] | appWorker.js:733 | Doc28 S3 | Doc28 | S3.7 CC-05 |
| 216 | Derivatives clamp | [0.70, 1.30] | C | MAN | -- | appWorker.js:~770 | Design | -- | S3.7 CC-05 |

### 5.6 Merton DD (CC-06)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 217 | DD safe threshold | 2.0 | B | MAN | [1.5, 3.0] | appWorker.js:926 | Bharath & Shumway (2008) | Doc35 | S3.7 CC-06 |
| 218 | DD caution threshold | 1.5 | B | MAN | [1.0, 2.0] | appWorker.js:933 | Bharath & Shumway (2008) | Doc35 | S3.7 CC-06 |
| 219 | DD danger threshold | 1.0 | B | MAN | [0.5, 1.5] | appWorker.js:936 | Bharath & Shumway (2008) | Doc35 | S3.7 CC-06 |
| 220 | DD caution buy adj | 0.95 | C | GS | [0.88, 0.98] | appWorker.js:935 | Doc35 S6.4 | Doc35 | S3.7 CC-06 |
| 221 | DD danger buy adj | 0.82 | C | GS | [0.70, 0.90] | appWorker.js:938 | Doc35 S6.4 | Doc35 | S3.7 CC-06 |
| 222 | DD extreme buy adj | 0.75 | C | GS | [0.60, 0.85] | appWorker.js:941 | Doc35 S6.4 | Doc35 | S3.7 CC-06 |
| 223 | DD clamp | [0.75, 1.15] | C | MAN | -- | appWorker.js:945 | Design | -- | S3.7 CC-06 |
| 224 | DD default point factor | 0.75 | B | MAN | [0.5, 1.0] | appWorker.js:880 | KMV convention | Doc35 | S3.7 CC-06 |
| 225 | DD fallback r (KTB 3Y) | 0.035 | B | MAN | [0.01, 0.07] | appWorker.js:893 | ECOS KTB 3Y | Doc35 | S3.7 CC-06 |

### 5.7 MCS+HMM+Flow+Options (CC-07)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 226 | MCS_THRESHOLDS.strong_bull | 70 | C | GS | [60, 80] | appState.js:403 | Doc30 S4.3 | Doc30 | S3.7 CC-07 |
| 227 | MCS_THRESHOLDS.strong_bear | 30 | C | GS | [20, 40] | appState.js:403 | Doc30 S4.3 | Doc30 | S3.7 CC-07 |
| 228 | MCS strong_bull buy boost | 1.05 | C | GS | [1.02, 1.10] | appWorker.js:566 | Doc30 | Doc30 | S3.7 CC-07 |
| 229 | REGIME_CONFIDENCE_MULT bull buy | 1.10 | C | GS | [1.03, 1.20] | appState.js:395 | HMM regime | Doc22 | S3.7 CC-07 |
| 230 | REGIME_CONFIDENCE_MULT bear sell | 1.10 | C | GS | [1.03, 1.20] | appState.js:396 | HMM regime | Doc22 | S3.7 CC-07 |
| 231 | Foreign alignment bonus | 1.03 | C | GS | [1.01, 1.08] | appWorker.js:604 | Doc39 S6 | Doc39 | S3.7 CC-07 |
| 232 | Implied Move event threshold | 3.0% | C | GS | [2.0, 5.0] | appWorker.js:616 | Doc46 | Doc46 | S3.7 CC-07 |
| 233 | Implied Move event discount | 0.95 | C | GS | [0.85, 0.98] | appWorker.js:620 | Doc46 | Doc46 | S3.7 CC-07 |
| 234 | Phase8 conf clamp | [10, 100] | A | MAN | fixed | appWorker.js:631 | Standard | -- | S3.7 CC-07 |
| 235 | Phase8 confPred clamp | [10, 95] | B | MAN | [10, 95] | appWorker.js:634 | Design (5% headroom) | -- | S3.7 CC-07 |

### 5.8 Survivorship Bias (CC-08)

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 236 | Survivorship adj clamp | [0.92, 1.0] | C | MAN | -- | appWorker.js:969 | Elton, Gruber & Blake (1996) | Doc22 | S3.7 CC-08 |
| 237 | Survivorship threshold (delta>1pp) | 1.0 | B | MAN | [0.5, 2.0] | appWorker.js:965 | Design | -- | S3.7 CC-08 |
| 238 | Survivorship adj formula | 1-(delta/200) | B | MAN | -- | appWorker.js:969 | EGB (1996) | -- | S3.7 CC-08 |

---

## 6. Backtest Constants

Cost, regression, and reliability from `js/backtester.js`.

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 239 | HORIZONS | [1,3,5,10,20] | B | MAN | standard | backtester.js:16 | Empirical finance | -- | S3.8 |
| 240 | KRX_COMMISSION | 0.03% | A | MAN | fixed | backtester.js:19 | KRX regulation | -- | S3.8 cost |
| 241 | KRX_TAX | 0.18% | C | MAN | [0.15, 0.30] | backtester.js:20 | KRX regulation (2025) | -- | S3.8 cost |
| 242 | KRX_SLIPPAGE | 0.10% | C | BAY | [0.04, 0.50] | backtester.js:21 | Amihud (2002) | Doc18 | S3.8 cost |
| 243 | Adaptive slippage kospi_large | 0.04% | C | BAY | [0.02, 0.08] | backtester.js:33 | ILLIQ calibrated | Doc18 | S3.8 cost |
| 244 | Adaptive slippage kospi_mid | 0.10% | C | BAY | [0.06, 0.15] | backtester.js:34 | ILLIQ calibrated | Doc18 | S3.8 cost |
| 245 | Adaptive slippage kosdaq_large | 0.15% | C | BAY | [0.08, 0.25] | backtester.js:35 | ILLIQ calibrated | Doc18 | S3.8 cost |
| 246 | Adaptive slippage kosdaq_small | 0.25% | C | BAY | [0.15, 0.50] | backtester.js:36 | ILLIQ calibrated | Doc18 | S3.8 cost |
| 247 | Ridge lambda | GCV auto | B | GCV | [0.1, 50] | backtester.js | Golub et al. (1979) | Doc22 | S3.8 regression |
| 248 | WLS decay lambda | 0.995 | C | GS | [0.990, 0.999] | backtester.js | Lo (2004) AMH | Doc20 | S3.8 regression |
| 249 | BH FDR q | 0.05 | A | MAN | fixed | backtester.js | Benjamini & Hochberg (1995) | Doc22 | S3.8 |
| 250 | Result cache eviction cap | 200 | D | MAN | [100, 500] | backtester.js:464 | Memory guard | -- | S3.8 |
| 251 | RL policy staleness | 90 days | D | MAN | [60, 180] | backtester.js:278 | ~1 quarterly cycle | -- | S3.8 RL |
| 252 | HMM staleness cutoff | 30 days | D | MAN | [14, 60] | backtester.js:233 | Heuristic | -- | S3.8 |
| 253 | EWMA vol lambda (RL context) | 0.94 | B | MAN | [0.90, 0.97] | backtester.js:360 | RiskMetrics (1996) | Doc34 | S3.8 RL |

---

## 7. Rendering Constants

Density limits and display parameters from `js/patternRenderer.js` and `js/signalRenderer.js`.

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 254 | MAX_PATTERNS | 3 | D | MAN | [2, 5] | patternRenderer.js:39 | UX limit | -- | S4.L7 |
| 255 | MAX_EXTENDED_LINES | 5 | D | MAN | [3, 8] | patternRenderer.js:40 | UX limit | -- | S4.L9 |
| 256 | RECENT_BAR_LIMIT | 50 | D | MAN | [30, 100] | signalRenderer.js:25 | UX limit | -- | S4 |
| 257 | MAX_DIAMONDS | 6 | D | MAN | [4, 10] | signalRenderer.js:28 | UX limit | -- | S4 |
| 258 | MAX_STARS | 2 | D | MAN | [1, 4] | signalRenderer.js:29 | UX limit | -- | S4 |
| 259 | MAX_DIV_LINES | 4 | D | MAN | [2, 6] | signalRenderer.js:30 | UX limit | -- | S4 |
| 260 | Pill label font | Pretendard 12px 700 | A | MAN | fixed | patternRenderer.js | Brand spec | -- | S4.L7 |

---

## 8. UI / Infrastructure Constants

Breakpoints, virtual scroll, pipeline from `js/appState.js` and `js/appWorker.js`.

| # | Name | Value | Grade | Learn | Range | JS File:Line | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|-------------|----------------|---------------|-----------|
| 261 | VIX_VKOSPI_PROXY | 1.12 | C | MAN | [1.0, 1.3] | appState.js:43 | Whaley (2009) | Doc26 | S3.4/S3.7 |
| 262 | PIPELINE_LOAD_TTL | 5 min | D | MAN | [2, 15] min | appWorker.js:10 | Design | -- | S1->S3.7 |
| 263 | Worker restart max | 3 | D | MAN | [1, 5] | appState.js:324 | Design | -- | infra |
| 264 | Pattern analysis throttle | 3s | D | MAN | [1, 10] s | appState.js:244 | Design | -- | S3.2 throttle |
| 265 | Stale data cutoff (pipeline) | 30 days | D | MAN | [14, 60] | appWorker.js:269 | Heuristic | -- | S1 |
| 266 | Stale data warn threshold | 14 days | D | MAN | [7, 30] | appWorker.js:273 | Heuristic | -- | S1 |
| 267 | VKOSPI staleness warn | 7 days | D | MAN | [3, 14] | appWorker.js:370 | Design | -- | S1 |

### 8.1 Stovall Sector Cycle Multipliers (appState.js:414-432)

12 sectors x 4 phases = 48 constants, all **[C]** grade, **MAN** learning.
Range: [0.88, 1.14]. Source: Stovall (1996) "Sector Investing".
Stage ref: S3.7 CC-03 (Factor 1).

### 8.2 Rate Beta Sector Table (appState.js:472-485)

12 sectors, range [-0.08, +0.05]. All **[C]** grade, **MAN** learning.
Source: Damodaran (2012). Stage ref: S3.7 CC-03 (Factor 2/7).

### 8.3 Default Indicator Parameters (appState.js:354-365)

Standard indicator defaults (MA 5/20/60, EMA 12/26, BB 20/2, RSI 14, MACD 12/26/9,
Ichimoku 9/26/52, Stochastic 14/3/3, CCI 20, ADX 14, Williams %R 14, ATR 14).
All **[A]** grade academic fixed values per their respective originators.

---

## 9. Macro / Taylor Rule Constants (Python scripts)

These constants live in `scripts/download_macro.py`, not JS, but affect JS via JSON output.

| # | Name | Value | Grade | Learn | Range | Script | Academic Source | core_data Doc | Stage Ref |
|---|------|-------|-------|-------|-------|--------|----------------|---------------|-----------|
| 268 | TAYLOR_R_STAR | 1.0% | C | MAN | [0.5, 2.0] | download_macro.py | BOK (2023) | Doc30 | S1->S3.7 |
| 269 | TAYLOR_PI_STAR | 2.0% | A | MAN | fixed | download_macro.py | BOK official target | Doc30 | S1->S3.7 |
| 270 | TAYLOR_A_PI | 0.50 | B | GS | [0.25, 1.00] | download_macro.py | Taylor (1993) | Doc30 | S1->S3.7 |
| 271 | TAYLOR_A_Y | 0.50 | B | GS | [0.25, 1.00] | download_macro.py | Taylor (1993) | Doc30 | S1->S3.7 |
| 272 | CLI_TO_GAP_SCALE | 0.50 | C | GS | [0.20, 0.80] | download_macro.py | Empirical | Doc30 | S1 |
| 273 | TAYLOR_GAP_CONF_MAX_ADJ | 0.05 | D | GS | [0.02, 0.10] | download_macro.py | Design | Doc30 | S1 |
| 274 | TAYLOR_GAP_DEAD_BAND | 0.25 | D | GS | [0.10, 0.50] | download_macro.py | Rudebusch (2002) | Doc30 | S1 |
| 275 | MCS_V2_TAYLOR_WEIGHT | 0.10 | C | GCV | [0.05, 0.20] | download_macro.py | Doc30 S4.3 | Doc30 | S1 |
| 276 | MCS_PMI_NORM_LOW | 35 | C | GS | [30, 40] | download_macro.py | PMI contraction | Doc30 | S1 |
| 277 | MCS_PMI_NORM_RANGE | 30 | C | GS | [25, 35] | download_macro.py | PMI expansion | Doc30 | S1 |

---

## Registry Findings

### Summary Statistics

| Tier | Count | % | Learnable? |
|------|-------|---|------------|
| A (Fixed) | 41 | 14.8% | No |
| B (Tunable) | 80 | 28.9% | Yes (GS, BAY) |
| C (KRX) | 91 | 32.9% | Yes (all) |
| D (Heuristic) | 65 | 23.5% | Must validate |
| E (Deprecated) | 0 | 0% | Remove |
| **Total** | **277** | 100% | |

### Finding 1: D-Grade Constants Without Validation Plan (18 items)

The following [D]-grade constants have no documented validation methodology:

1. **#86 BELT_CLOSE_SHADOW_MAX** (0.30) -- no academic basis
2. **#87 BELT_BODY_ATR_MIN** (0.40) -- no academic basis
3. **#91 MIN_RANGE_ATR** (0.30) -- no academic basis
4. **#92 TREND_THRESHOLD** (0.30) -- loosely from Brock et al. (1992)
5. **#93-97 Q_WEIGHT** (5 values) -- Nison qualitative only, WLS refit pending
6. **#99 ATR_FALLBACK_PCT** (0.02) -- median check recommended
7. **#105 PROSPECT_STOP_WIDEN** (1.15) -- sqrt(lambda) has no formal derivation
8. **#110, 113-114** Unconfirmed penalties -- no basis for specific penalty values
9. **#115-120** Channel detection -- all 6 parameters are D-grade without validation
10. **#196-200** RORO hysteresis thresholds -- pure heuristic

### Finding 2: Constants with No core_data Documentation (11 items)

The following constants reference no core_data document:

- #99 ATR_FALLBACK_PCT, #148 MA cross gap, #163-164 Crisis severity,
- #166-167 S/R proximity factors, #168 OLS cap, #186-188 optionalBonus values,
- #196-200 RORO thresholds, #262-267 Infrastructure constants

### Finding 3: Value Mismatches vs Doc22

| Constant | Doc22 Value | Code Value | Status |
|----------|-------------|------------|--------|
| COUNTER_SHADOW_MAX_STRICT | [A] 0.15 (Morris) | 0.15 | Match |
| COUNTER_SHADOW_MAX_LOOSE | [D] | [B] in code | **Grade mismatch**: Doc22 says D, code comment says B |
| N0 (shrinkage) | 35 (Doc22 #49) | 35 | Match |
| EWMA lambda | 0.94 (Doc22 #36) | 0.94 | Match |
| All other sampled | -- | -- | Match |

### Finding 4: Channel Pattern Constants Cluster

6 D-grade constants (#115-120) control the channel pattern detector.
Channel has n=125 (smallest chart pattern sample), WR=58.0%.
Recommendation: Promote to [C] via grid search against the 125 samples,
or demote channel to C-Tier if validation fails.

### Finding 5: Composite Signal baseConfidence Audit Trail

All 30 composite signal baseConfidence values were calibrated from
`composite_calibration.json` using measured WR x conditional multiplier.
Documentation trail exists in code comments (e.g., `[C-8]`, `[E-1]`, `[E-4]`).
No orphan values detected -- all 30 have calibration annotations.
