# 04 Backtester -- backtester.js 완전 참조 문서

> **파일**: `js/backtester.js` (2,539행)
> **전역 인스턴스**: `backtester` (PatternBacktester)
> **의존**: `patterns.js` (patternEngine.analyze), `indicators.js` (calcATR, calcMA, calcWLSRegression), `signalEngine.js` (signalEngine.analyze -- for signal backtest)
> **최종 갱신**: 2026-04-06

---

## 목차

1. [N-Day Horizon Statistics](#part-1-n-day-horizon-statistics)
2. [KRX Cost Structure](#part-2-krx-cost-structure)
3. [WLS Regression Pipeline](#part-3-wls-regression-pipeline)
4. [LinUCB Adaptive Adjustment](#part-4-linucb-adaptive-adjustment)
5. [Reliability Tier System](#part-5-reliability-tier-system)
6. [Walk-Forward Efficiency (WFE)](#part-6-walk-forward-efficiency)
7. [Composite Score and Grade](#part-7-composite-score-and-grade)
8. [Wc Weight System](#part-8-wc-weight-system)
9. [_META Object](#part-9-meta-object)
10. [Statistical Testing](#part-10-statistical-testing)
11. [External Data Loading](#part-11-external-data-loading)
12. [Signal Backtesting](#part-12-signal-backtesting)

---

## Part 1: N-Day Horizon Statistics

### Horizons

```javascript
this.HORIZONS = [1, 3, 5, 10, 20]; // [B] standard holding period horizons
```

Line 16. Grade: [B] -- standard in empirical finance literature.

### Return Calculation

`_computeStats()` (line 1270):

1. **Entry price**: 패턴 다음 캔들 시가 (`candles[occ.idx + 1].open`) -- look-ahead bias 제거
2. **Exit price**: `candles[occ.idx + h].close`
3. **Return**: `(exitPrice - entryPrice) / entryPrice * 100 - _horizonCost(h)`

### Statistical Measures (per horizon)

| Measure | Formula | Line | Reference |
|---------|---------|------|-----------|
| mean | arithmetic mean | 1381 | -- |
| median | sorted middle | 1382 | -- |
| stdDev | sample std (Bessel, n-1) | 1387 | -- |
| winRate | direction-adjusted win % | 1404 | -- |
| wrNull | unconditional base rate | 1417 | Sullivan et al. (1999) |
| wrAlpha | winRate - wrNull | 1419 | -- |
| correctedWR | winRate - survivorshipDelta | 1424 | Elton, Gruber & Blake (1996) |
| winRateCI | BCa bootstrap [2.5%, 97.5%] | 1457-1549 | Efron (1987) |
| maxLoss / maxGain | sorted extremes | 1553 | -- |
| avgWin / avgLoss | avg of positive/negative returns | 1558 | -- |
| riskReward | avgWin / avgLoss | 1561 | -- |
| expectancy | WR*avgWin - (1-WR)*avgLoss | 1565 | Kelly (1956) |
| profitFactor | grossProfit / grossLoss | 1568 | -- |
| kellyFraction | clamped [0, 1.0] | 1582 | Kelly (1956), Thorp (2006) |
| tStat | mean / (std/sqrt(n)) | 1586 | -- |
| significant | abs(tStat) > tCritFatTail | 1589 | Cont (2001) |
| hlzSignificant | abs(tStat) > 3.0 | 1592 | Harvey, Liu & Zhu (2016) |
| mde | tCrit * std / sqrt(n) | 1598 | Cohen (1988) |
| cohensH | 2*arcsin(sqrt(p_obs)) - 2*arcsin(sqrt(p_null)) | 1431 | Cohen (1988) |
| informationRatio | exMean / TE * sqrt(250/h) | 1448 | Grinold & Kahn (2000) |
| sortinoRatio | mean / downsideDev * sqrt(250/h) | 1400 | Sortino & van der Meer (1991) |
| medianMAE | path min return (median) | 1346 | Sweeney (1997) |
| mae5 | 5th percentile MAE | 1353 | Hyndman & Fan (1996) Type 7 |
| medianMFE | path max return (median) | 1347 | -- |
| mfe95 | 95th percentile MFE | 1358 | -- |
| maxDrawdown | peak-to-trough cumulative | 1365 | CFA Level III |
| cvar5 | Expected Shortfall 5% | 1374 | Basel Committee |
| regimeWR | {trending, reverting, neutral} | 1451 | Lo (2004) AMH |
| directionalAccuracy | winRate alias | 1608 | -- |
| targetHitRate | priceTarget reach % | 1611 | -- |
| predictionMAE | abs(predicted - actual) mean | 1614 | -- |
| patternScore | composite 0-100 | 1627 | -- |
| patternGrade | A/B/C/D/F | 1632 | -- |
| mzRegression | Mincer-Zarnowitz slope/intercept/R^2 | 1642 | Mincer & Zarnowitz (1969) |
| calibrationCoverage | OOS prediction interval % | 1682 | Gneiting & Raftery (2007) |
| jensensAlpha | market-adjusted excess return | 1750 | Doc25 S1.3, CAPM |
| regression | WLS coefficients, R^2, HC3 tStats | 1873 | -- |
| expectedReturn | WLS predicted return | 1900 | -- |
| ci95Lower/Upper | fat-tail corrected CI | 1937 | Cont (2001) |
| ic | Spearman rank IC (OOS rolling) | 1963 | Grinold & Kahn (2000) |
| icir | IC / std(IC) | 1983 | -- |

### Bootstrap CI

- **Method**: Calendar-time block bootstrap (line 1468)
  - Daily: resample whole months (YYYY-MM), min 3 months [D]
  - Intraday fallback: index-based block, blockSize = sqrt(n) -- Kunsch (1989)
- **BCa correction**: Efron (1987), jackknife leave-one-out for acceleration
- **B**: 500 replicates [B] -- Efron & Tibshirani (1993)
- **Winsorization**: 1st/99th percentile -- Wilcox (2005), KRX +/-30% limit-up/down

---

## Part 2: KRX Cost Structure

### Static Costs

| Cost | Value (%) | Grade | Source |
|------|-----------|-------|--------|
| Commission (round-trip) | 0.03 | [C] | 편도 0.015% x 2 |
| Tax (sell-side) | 0.18 | [C] | KOSPI 0.03%+농특세0.15% / KOSDAQ 0.18% (2025) |
| Slippage (round-trip) | 0.10 | [C] | KOSPI 대형 기준, Amihud (2002) |
| **Total** | **0.31** | | |

Line 19-22.

### Horizon-Scaled Cost

`_horizonCost(h)` (line 44):

```
fixedCost = (commission + tax) / h      -- 왕복 1회 발생, horizon 비례 분할
variableCost = slippage / sqrt(h)       -- Kyle (1985) sqrt-time scaling
total = fixedCost + variableCost
```

| Horizon | Cost (%) | Old Fixed |
|---------|----------|-----------|
| h=1 | 0.31 | 0.31 |
| h=5 | 0.087 | 0.07 (was 112% 과대계상) |
| h=20 | 0.033 | 0.07 |

### Adaptive Slippage

`_getAdaptiveSlippage(code)` (line 27): Amihud (2002) ILLIQ 기반 종목별 슬리피지.

| Segment | Slippage (%) | Grade |
|---------|-------------|-------|
| kospi_large | 0.04 | [C] |
| kospi_mid | 0.10 | [C] |
| kosdaq_large | 0.15 | [C] |
| kosdaq_small | 0.25 | [C] |

Data: `data/backtest/illiq_spread.json` from `compute_illiq_spread.py`

---

## Part 3: WLS Regression Pipeline

`_computeStats()` line 1800: 5-column WLS regression for expected return prediction.

### Design Matrix (5 features)

```
X = [intercept, confidence, trendStrength, ln(volumeRatio), atrNorm]
```

| Column | Description | Scale |
|--------|-------------|-------|
| 0: intercept | 1 | fixed |
| 1: confidence | (confidencePred or confidence) / 100 | [0, 1] |
| 2: trendStrength | abs(slope) / ATR (10-bar OLS) | [0, ~5] |
| 3: ln(volumeRatio) | ln(max(volume/VMA20, 0.1)) | [-2.3, ~3] |
| 4: atrNorm | ATR(14) / close | [0, ~0.1] |

> wc and momentum60 removed in Phase 7 C-1 (look-ahead bias, parsimony)

### Feature Normalization

Column-wise std normalization (line 1819): Hoerl & Kennard (1970) requirement for Ridge.
Without this, atrNorm (~0.02) receives ~278x stronger penalty than confidence (~0.5).

```javascript
for (sj = 1; sj < 5; sj++) {
    scales[sj] = std(X[:, sj]);
    X[:, sj] /= scales[sj];
}
```

### Exponential Decay Weights

```javascript
lambda = 0.995; // [A] core_data/17 S17.4; Lo (2004) AMH half-life ~7mo
weights[i] = lambda^(n-1-i);  // most recent pattern gets weight 1.0
```

Reference: Reschenhofer et al. (2021)

### Ridge Lambda Selection (GCV)

```javascript
var optLambda = selectRidgeLambdaGCV(X, returns, weights, 5);
```

- Golub, Heath & Wahba (1979): Generalized Cross-Validation
- Jacobi eigendecomposition for efficient GCV computation
- Fallback: lambda = 1.0
- Grade: [C][L:GCV]

### Huber-IRLS Robust Estimation

Line 1839: Addresses KRX fat-tail returns (5-day kurtosis from +/-30% limit).

```javascript
HUBER_DELTA = 5.8;  // [C] 1.345*sigma, Huber (1964) 95% efficiency; sigma~4.3 from KRX MAD
HUBER_ITERS = 5;    // [B] Street, Carroll & Ruppert (1988): converges in 3-5 iterations
```

Algorithm:
1. Initial WLS regression with Ridge lambda
2. For each iteration:
   - Compute residuals
   - Huber weights: `hw = abs(resid) > delta ? delta/abs(resid) : 1.0`
   - Combined weights: `huberWeights[i] = hw * exponentialWeights[i]`
   - Re-fit WLS with combined weights
3. Early stop if no residual exceeds delta

### Reverse Transform

Line 1868: De-standardize coefficients back to original scale.
```javascript
reg.coeffs[j] /= scales[j]; // Hastie, Tibshirani & Friedman (2009)
```

### HC3 Standard Errors

From `calcWLSRegression()` in `indicators.js`:
- White (1980) heteroskedasticity-consistent SEs
- HC3 with (1-h_ii)^2 jackknife correction -- optimal for n=30-300 (Long & Ervin 2000)
- `reg.hcTStats` returned as array

### Prediction and Confidence Interval

Line 1886:
```javascript
predicted = sum(xNew[j] * reg.coeffs[j])
```

95% CI (line 1923):
```javascript
se = sqrt(sigmaHat2 * (1 + x' * invXtWX * x))
tCrit = _tCritFatTail(df, returns, 0.05)  // Cont (2001) kurtosis-adjusted
ci95 = [predicted - tCrit*se, predicted + tCrit*se]
```

### Spearman Rank IC

`_spearmanCorr()` (line 617): Pearson-of-ranks with tied rank handling (Kendall & Gibbons 1990).

`_rollingOOSIC()` (line 667): Out-of-sample IC via expanding window.
- minWindow = 12 pairs
- Non-overlapping OOS windows
- Falls back to full-sample when n < 24
- Jacknife SE for ICIR

Reference: Grinold & Kahn (2000), Lo (2002), Qian, Hua & Sorensen (2007)

---

## Part 4: LinUCB Adaptive Adjustment

### Overview

Contextual bandit (Li et al. 2010) -- single-step, NOT MDP.
Policy loaded from `data/backtest/rl_policy.json`.

### Feature Vector (7-dim)

`_buildRLContext()` (line 348):

| Dim | Feature | Description | Normalization |
|-----|---------|-------------|---------------|
| 0 | ewma_vol | EWMA volatility (lambda=0.94) | z-scored (mean~0.027, std~0.018) |
| 1 | pred_magnitude | abs(WLS predicted) / pred_std | clamped [0, 3] |
| 2 | signal_dir | buy=1, sell=-1, neutral=0 | discrete |
| 3 | market_type | KOSDAQ=1, KOSPI=0 | binary |
| 4 | pattern_tier | Tier1=-1, Tier2=0, Tier3=1 | discrete |
| 5 | confidence_norm | confidencePred / 100 | [0, 1] |
| 6 | raw_hurst | R/S Hurst exponent | z-scored (mean~0.612, std~0.133) |

Normalization params from `rl_policy.normalization`. Staleness guard: price-level H (mean>0.80) rejected.

### Action Space (5 actions)

```javascript
K = 5;  // action_factors from rl_policy.json
// Typical: [0.5, 0.75, 1.0, 1.25, 1.5] (multiply expected return)
```

### UCB Formula (Greedy)

`_applyLinUCBGreedy()` (line 413):
```javascript
for (a = 0; a < K; a++) {
    score = thetas[a][0]; // bias
    for (j = 0; j < d; j++)
        score += thetas[a][j+1] * context[j];
    if (score > bestScore) { bestA = a; }
}
return { action: bestA, factor: action_factors[bestA] };
```

> Exploration term (alpha*sqrt(x'A^-1*x)) dropped in JS; full UCB in `rl_linucb.py`.

### Safety Gates

| Gate | Condition | Action |
|------|-----------|--------|
| IC threshold | `mean_ic_adjusted < 0` | Reject policy (anti-predictive) |
| Staleness | `trained_date > 90 days` | Warn [D] |
| Dimension mismatch | `policy.d != feature_dim` | Warn |
| t_stat_delta | `< 2.0` | Skip LinUCB, Ridge-only |
| Safety clamp | `abs(factor) > 3.0` | Clamp to +/-3.0 [D] |

### Beta-Binomial Posterior (G-2)

Even when LinUCB policy rejected, `win_rates_live` from rl_policy.json injected into PatternEngine:
```javascript
PatternEngine.PATTERN_WIN_RATES_LIVE = {
    patternType: alpha/(alpha+beta) * 100  // posterior mean
};
```

### Known Misalignment (C-8)

RL reward (per-sample return) != evaluation metric (Spearman IC) -- see Doc11 S13.3.

---

## Part 5: Reliability Tier System

### Pattern Tier (backtestAll, line 540)

| Tier | Criteria | IC Gate |
|------|----------|---------|
| **A** | adjustedSig + wrAlpha>=5 + n>=100 + expectancy>0 + PF>=1.3 | IC>0.02 |
| **B** | adjustedSig + wrAlpha>=3 + n>=30 + expectancy>0 | IC>0.01 |
| **C** | wrAlpha>0 + n>=30 | -- |
| **D** | default (none of above) | -- |

Grade: [D] Heuristic -- practitioner conventions (CFA sample-size guidance + quant thresholds).

### Signal Tier (backtestAllSignals, line 2493)

Relaxed thresholds vs pattern tiers (smaller samples, shorter lookback):

| Tier | Criteria | IC Gate |
|------|----------|---------|
| **A** | adjustedSig + wrAlpha>=3 + n>=50 + exp>0 + PF>=1.1 | IC>0.02 |
| **B** | adjustedSig + wrAlpha>=2 + n>=20 + exp>0 | IC>0.01 |
| **C** | wrAlpha>0 + n>=20 | -- |
| **D** | default | -- |

### WFE Gating

```javascript
if (wfe != null && wfe < 30 && (tier === 'A' || tier === 'B')) {
    tier = 'C';  // overfit -> cap at C
}
```

Reference: Pardo (2008). Threshold 30% [B].

### Hansen SPA Gating

```javascript
if (!results._spaTest.rejected) {
    // 최고 전략도 데이터 스누핑 위험
    if (tier === 'A' || tier === 'B') tier = 'C';
}
```

Reference: Hansen (2005).

---

## Part 6: Walk-Forward Efficiency

`walkForwardTest()` (line 710):

### Algorithm

1. Expanding window, K folds (4 default, 6 if candles >= 500)
2. OOS block size: `max(15, floor(len * 0.20 / folds))` [D]
3. Purge gap: `2 * horizon` -- Bailey & Lopez de Prado (2014), AR(1) half-life 6.5 bars > horizon(5)
4. Per fold: IS backtest on training, OOS backtest on test
5. Clear `_resultCache` per fold to prevent cross-fold contamination [H-4 FIX]
6. WFE = `round((avgOOS / avgIS) * 100)`

### WFE Labels

| WFE | Label |
|-----|-------|
| >= 50% | robust |
| 30-50% | marginal |
| < 30% | overfit |
| both negative | negative (strategically useless) |

### Constants

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| default folds | 4 (6 if n>=500) | [B] | Bailey-Lopez de Prado (2014) |
| OOS ratio | 20% | [D] | Practitioner convention |
| min OOS bars | 15 | [D] | |
| minTrain | 60 | [D] | |
| purge | 2*horizon | [B] | AR(1) contamination guard |
| minISEdge | 0.3 | [C] | ~KRX round-trip cost 0.25%+0.015% |

---

## Part 7: Composite Score and Grade

`_computeStats()` line 1618:

### Score Formula

```
patternScore = max(0, min(100,
    DA * 0.30 +
    targetHitRate * 0.25 +
    (100 - MAE*10) * 0.25 +
    min(PF*20, 100) * 0.20
))
```

| Component | Weight | Scale | Fallback |
|-----------|--------|-------|----------|
| Directional Accuracy | 0.30 | 0-100% | -- |
| Target Hit Rate | 0.25 | 0-100% | DA if null |
| MAE inverse | 0.25 | 100-MAE*10 | 50 if null |
| Profit Factor | 0.20 | min(PF*20, 100) | -- |

Grade: [D] Heuristic -- weights and scaling factors are practitioner-designed.

### Grade Cutoffs

| Grade | Score |
|-------|-------|
| A | >= 80 |
| B | >= 65 |
| C | >= 50 |
| D | >= 35 |
| F | < 35 |

Grade: [D] Heuristic.

---

## Part 8: Wc Weight System

Wc weights are computed per-pattern in `patternEngine.analyze()` and passed through to backtester via `_collectOccurrences()`.

### Components

| Weight | Formula | Source | Usage in Backtester |
|--------|---------|--------|---------------------|
| hw (Hurst weight) | From PatternEngine | core_data/10 | Regime classification: hw>1.1=trending, <0.9=reverting |
| mw (mean-reversion weight) | From PatternEngine | core_data/10 | Combined in wc |
| wc | hw * mw (approximate) | patterns.js | Stored per occurrence; used in cumulative curve |

### Regime-Conditioned WR

`_computeRegimeWR()` (line 2104):

```javascript
var hw = occ.hw || 1.0;
var bucket = hw > 1.1 ? 'trending' : hw < 0.9 ? 'reverting' : 'neutral';
```

| Boundary | Value | Grade |
|----------|-------|-------|
| trending | hw > 1.1 | [D] Heuristic -- +/-10% from neutral |
| reverting | hw < 0.9 | [D] |
| neutral | 0.9-1.1 | |

- Minimum 30 observations per bucket (CLT)
- Returns: `{ trending: {wr, n}, reverting: {wr, n}, neutral: {wr, n} }`

### stockWc in Backtest Result

```javascript
result.stockWc = occurrences[0].wc; // first occurrence's wc
```

Displayed in pattern panel for user reference.

---

## Part 9: _META Object

`this._META` (line 52): 45 pattern entries mapping type -> {name, signal}.

### Complete Listing

| Type | Name (한국어) | Signal |
|------|-------------|--------|
| threeWhiteSoldiers | 적삼병 | buy |
| threeBlackCrows | 흑삼병 | sell |
| hammer | 해머 | buy |
| hangingMan | 교수형 | sell |
| shootingStar | 유성형 | sell |
| bullishEngulfing | 상승장악형 | buy |
| bearishEngulfing | 하락장악형 | sell |
| morningStar | 샛별형 | buy |
| eveningStar | 석별형 | sell |
| ascendingTriangle | 상승삼각형 | buy |
| descendingTriangle | 하락삼각형 | sell |
| risingWedge | 상승쐐기 | sell |
| fallingWedge | 하락쐐기 | buy |
| symmetricTriangle | 대칭삼각형 | neutral |
| doubleBottom | 이중바닥 | buy |
| doubleTop | 이중천장 | sell |
| headAndShoulders | 머리어깨형 | sell |
| inverseHeadAndShoulders | 역머리어깨형 | buy |
| piercingLine | 관통형 | buy |
| darkCloud | 먹구름형 | sell |
| dragonflyDoji | 잠자리도지 | buy |
| gravestoneDoji | 비석도지 | sell |
| tweezerBottom | 족집게바닥 | buy |
| tweezerTop | 족집게천장 | sell |
| bullishMarubozu | 양봉마루보주 | buy |
| bearishMarubozu | 음봉마루보주 | sell |
| longLeggedDoji | 긴다리도지 | neutral |
| bullishBeltHold | 강세띠두름 | buy |
| bearishBeltHold | 약세띠두름 | sell |
| bullishHaramiCross | 강세잉태십자 | buy |
| bearishHaramiCross | 약세잉태십자 | sell |
| stickSandwich | 스틱샌드위치 | buy |
| abandonedBabyBullish | 강세버림받은아기 | buy |
| abandonedBabyBearish | 약세버림받은아기 | sell |
| invertedHammer | 역해머 | buy |
| doji | 도지 | neutral |
| bullishHarami | 상승잉태형 | buy |
| bearishHarami | 하락잉태형 | sell |
| spinningTop | 팽이형 | neutral |
| threeInsideUp | 상승삼내형 | buy |
| threeInsideDown | 하락삼내형 | sell |
| channel | 채널 | neutral |
| cupAndHandle | 컵앤핸들 | buy |
| risingThreeMethods | 상승삼법 | buy |
| fallingThreeMethods | 하락삼법 | sell |

### Fields per Entry

```javascript
{ name: '한국어명', signal: 'buy'|'sell'|'neutral' }
```

The _META object feeds:
- `backtest()` -> patternType lookup for name/signal
- `backtestAll()` -> iterates all keys for batch backtest
- `backtestAllSignals()` -> pattern-independent (uses KNOWN_DIR map instead)

---

## Part 10: Statistical Testing

### Benjamini-Hochberg FDR

`_applyBHFDR()` (line 806):
- Replaces Holm step-down (FWER) -- BH step-up (FDR) has better power for exploratory analysis
- FDR level q = 0.05 [A]
- p-value via `_approxPValue()` (Abramowitz & Stegun 26.7.5 normal approximation)
- Reference: Benjamini & Hochberg (1995), JRSS-B 57(1):289-300

### Fat-Tail t-Critical

`_tCritFatTail()` (line 1004):
- Excess kurtosis K_e > 0.5 -> effective df = min(df, 4 + 6/K_e)
- Reference: Cont (2001) "Stylized Facts of Asset Returns"

### Cornish-Fisher t-Critical

`_tCriticalForAlpha()` (line 956):
- Rational approximation for standard normal quantile (Abramowitz & Stegun 26.2.23)
- 1st + 2nd order Cornish-Fisher expansion for t-distribution
- Accurate ~0.01 for df >= 3

### Hansen SPA Test

`_hansenSPA()` (line 868):
- H0: no strategy beats benchmark (random entry)
- Test statistic: T_SPA = max_k(sqrt(n) * d_k / sigma_k)
- Bootstrap: B=500 [B] (Politis & Romano 1994)
- Hansen (2005) improvement: negative-mean strategies zeroed (less conservative than White RC)
- p-value < 0.05 -> H0 rejected -> significant strategy exists

### BCa Bootstrap CI

`_bcaCI()` (line 1102):
- Efron (1987) bias-corrected and accelerated
- Bias correction z0 from proportion below thetaHat
- Acceleration a-hat from jackknife third moment
- Min 50 bootstrap replicates

### Null Win Rate

`_computeNullWR()` (line 2030):
- Sullivan, Timmermann & White (1999): unconditional base rate as null
- Computes % of random h-day entries yielding positive (buy null) or negative (sell null) returns
- Transaction cost deducted
- Cached by candle length + horizon + last close (KRX integer prices)

### Null Mean Return

`_computeNullMeanReturn()` (line 2073):
- Grinold & Kahn (2000): benchmark must be independent of strategy
- Mean h-day return across all candle windows
- Used for Information Ratio excess return calculation

---

## Part 11: External Data Loading

All data loaded asynchronously at construction time. Missing files = graceful fallback.

### Data Files

| Field | File | Purpose | Fallback |
|-------|------|---------|----------|
| `_rlPolicy` | `data/backtest/rl_policy.json` | LinUCB thetas, action_factors, win_rates_live | null (no RL adjustment) |
| `_behavioralData.illiq_spread` | `data/backtest/illiq_spread.json` | ILLIQ-based adaptive slippage | default KRX_SLIPPAGE |
| `_behavioralData.hmm_regimes` | `data/backtest/hmm_regimes.json` | HMM regime for VKOSPI fallback | no HMM discount |
| `_behavioralData.disposition_proxy` | `data/backtest/disposition_proxy.json` | Doc24 S3 (future use) | unused |
| `_behavioralData.csad_herding` | `data/backtest/csad_herding.json` | Chang et al. (2000) herding | unused |
| `_survivorshipCorr` | `data/backtest/survivorship_correction.json` | Elton et al. (1996) delta_wr | 0 (no correction) |
| `_capmBeta` | `data/backtest/capm_beta.json` | CAPM beta per stock | no Jensen's Alpha |
| `_marketIndex` | `data/market/kospi_daily.json` | Market returns for Jensen's Alpha | no Jensen's Alpha |
| calibrated_constants | `data/backtest/calibrated_constants.json` | D1 candle_target_atr | hardcoded PatternEngine values |

### Worker Path Resolution

```javascript
var isWorker = (typeof WorkerGlobalScope !== 'undefined');
var prefix = isWorker ? '../data/backtest/' : 'data/backtest/';
```

### HMM Staleness Check

```javascript
if (daysSince > 30) {
    loaded['hmm_regimes'] = null; // [D] 30-day staleness cutoff
}
```

### RL Policy Staleness

```javascript
if (age > 90) console.warn('[RL] Policy stale'); // [D] 90-day quarterly regime cycle
```

---

## Part 12: Signal Backtesting

### Signal Occurrence Collection

`_collectSignalOccurrences()` (line 2257):
1. Runs `signalEngine.analyze(candles, patterns)` once
2. Indexes all signals by type (individual) or compositeId (composite)
3. Extracts WLS features: confidence, volumeRatio, atrNorm
4. Cached by `candles.length + lastTime`

### backtestSignal()

Line 2355: Per-signal-type backtest using same `_computeStats()` engine as patterns.

### backtestAllSignals()

Line 2439: Batch signal backtest.

**Default backtest signals (16 core)**:
```
goldenCross, deadCross, macdBullishCross, macdBearishCross,
rsiOversoldExit, rsiOverboughtExit, bbLowerBounce, bbSqueeze,
volumeBreakout, volumeSelloff, ichimokuBullishCross, ichimokuBearishCross,
ichimokuCloudBreakout, ichimokuCloudBreakdown, stochasticOversold, stochasticOverbought
```

Plus: auto-discovered composite signals (buy_*/sell_*/strong* prefix).

Signal reliability tier uses relaxed thresholds (see Part 5).

---

## Appendix: [D]-Tagged Constants Summary

| Location | Constant | Value | Sensitivity |
|----------|----------|-------|-------------|
| Constructor | HORIZONS | [1,3,5,10,20] | Low (standard) |
| _horizonCost | KRX_SLIPPAGE | 0.10% | Medium |
| _getAdaptiveSlippage | segment-based | 0.04-0.25% | Medium |
| walkForwardTest | OOS ratio | 20% | Medium |
| walkForwardTest | min OOS bars | 15 | Low |
| walkForwardTest | minTrain | 60 | Low |
| walkForwardTest | folds | 4/6 | Low |
| _computeStats | lambda | 0.995 | High |
| _computeStats | HUBER_DELTA | 5.8 | High |
| _computeStats | HUBER_ITERS | 5 | Low |
| _computeStats | composite weights | 0.30/0.25/0.25/0.20 | High |
| _computeStats | grade boundaries | 80/65/50/35 | Medium |
| _computeStats | calendar min months | 3 | Low |
| reliabilityTier | A thresholds | alpha>=5, n>=100, PF>=1.3 | High |
| reliabilityTier | B thresholds | alpha>=3, n>=30 | High |
| reliabilityTier | WFE gate | 30% | Medium |
| _regimeWR | hw boundaries | 1.1/0.9 | Medium |
| LinUCB | MAX_FACTOR | 3.0 | Medium |
| LinUCB | t_stat_delta gate | 2.0 | High |
| RL policy | staleness | 90 days | Low |
| HMM | staleness | 30 days | Low |
| _resultCache | eviction cap | 200 | Low |
| _hansenSPA | bootstrap B | 500 | Low |
| sentiment labels (signal tier) | thresholds | varies | Medium |

**Total [D]-tagged constants: ~25**

Priority for calibration (high sensitivity):
1. WLS lambda (0.995) -- exponential decay rate
2. HUBER_DELTA (5.8) -- robust estimation cutoff
3. Composite score weights (0.30/0.25/0.25/0.20) -- grade determination
4. Reliability tier thresholds (alpha, n, PF) -- A/B/C/D classification
5. LinUCB t_stat_delta gate (2.0) -- RL activation threshold
