# Stage 3 -- Sections 3.4-3.6: Signal Engine Complete Catalog

> ANATOMY V5 -- Complete documentation of 48+ individual signals, 30 composite signals,
> and 12 post-processing filters from `js/signalEngine.js` (3,118 lines).
> Author: CFA Financial Analyst Agent
> Date: 2026-04-06
> Source: `js/signalEngine.js`, `js/signalRenderer.js`, `pattern_impl/03_signal_engine.md`
> Globals Exported: `COMPOSITE_SIGNAL_DEFS` (array), `signalEngine` (SignalEngine instance)
> Dependencies: `indicators.js` (IndicatorCache), `patterns.js` (patternEngine)

---

## Cross-Stage Reference Map

```
Stage 1 (API) --> Stage 2 (Theory) --> Stage 3.1-3.3 (Indicators/Patterns)
                                            |
                                   * Stage 3.4-3.6 (here) *
                                            |
                                     Stage 3.7 (Confidence) --> Stage 4 (Rendering)
```

### S1 --> here (Data Sources --> Signals)

| S1 Data File | JS Global | Signal(s) Generated |
|--------------|-----------|---------------------|
| `data/derivatives/derivatives_summary.json` | `_derivativesData` | basisContango/Backwardation, pcrFearExtreme/GreedExtreme |
| `data/derivatives/investor_summary.json` | `_investorData` | flowAlignedBuy/Sell, flowForeignBuy/Sell, flowLeadershipBuy/Sell |
| `data/vkospi.json` | `_macroLatest.vkospi` | VKOSPI regime classification (post-processing) |
| `data/derivatives/options_analytics.json` | `_optionsAnalytics` | (indirect -- impliedMove via appWorker) |
| `data/derivatives/shortselling_summary.json` | `_shortSellingData` | shortHighSIR, shortSqueeze |
| `data/derivatives/etf_summary.json` | `_etfData` | etfBullishExtreme, etfBearishExtreme |
| `data/macro/bonds_latest.json` | `_bondsLatest` | erpUndervalued/Overvalued |
| `data/macro/macro_latest.json` | `_macroLatest` | crisis severity, VIX proxy fallback |
| `data/backtest/hmm_regimes.json` | `backtester._behavioralData` | HMM regime fallback (post-processing) |

### S2 --> here (Academic Theory --> Signal Design)

| S2 Section | Theory | Signal Application |
|------------|--------|-------------------|
| S2.3 EMH/AMH | Fama (1970), Lo (2004) | Hurst regime filter, entropy damping, AMH crowding discount |
| S2.3 CAPM | Sharpe (1964) | ERP signal (E/P - KTB10Y) |
| S2.4 Behavioral | DeBondt & Thaler (1985) | Disposition effect --> S/R proximity boost |
| S2.5 Macro | Taylor Rule, IS-LM | ERP threshold calibration, crisis severity |
| S2.6 Micro | Amihud (2002) ILLIQ | ADV level multiplier, volume z-score |
| S2.7 Derivatives | BSM, Pan & Poteshman (2006) | PCR contrarian, basis signal, IV/HV discount |
| S2.8 Bond | Yield curve theory | ERP = E/P - KTB10Y threshold |

### S3.1-3.3 --> here (Indicators/Patterns --> Signals)

| Indicator Function | Signal(s) Generated |
|-------------------|---------------------|
| `calcMA(5/20/60)` | goldenCross, deadCross, maAlignment_bull/bear |
| `calcEMA(12/26)` | EMA confirmation for MA cross strength |
| `calcMACD(12,26,9)` | macdBullishCross, macdBearishCross, MACD divergences |
| `calcRSI(14)` | rsiOversold/Exit, rsiOverbought/Exit, RSI divergences |
| `calcBB(20,2)` | bbLowerBounce, bbUpperBreak, bbSqueeze |
| `calcATR(14)` | ATR gap filter, atrExpansion, normalization |
| `calcIchimoku(9,26)` | ichimokuBullishCross, ichimokuBearishCross, cloudBreakout/Breakdown |
| `calcHurst()` | hurstTrending, hurstMeanReverting, RSI-Hurst coupling |
| `calcKalman(0.1,1.0)` | kalmanUpturn, kalmanDownturn |
| `IndicatorCache.stochRsi()` | stochRsiOversold, stochRsiOverbought |
| `IndicatorCache.stochastic()` | stochasticOversold, stochasticOverbought |
| `IndicatorCache.cci()` | cciOversoldExit, cciOverboughtExit |
| `IndicatorCache.adx()` | adxBullishCross, adxBearishCross |
| `IndicatorCache.williamsR()` | williamsROversold, williamsROverbought |
| `IndicatorCache.obv()` | obvBullishDivergence, obvBearishDivergence |
| `IndicatorCache.volZScore()` | volumeBreakout, volumeSelloff, volumeExhaustion |
| `IndicatorCache.cusum()` | cusumBreak |
| `IndicatorCache.volRegime()` | volRegimeExpand, volRegimeHigh |

### here --> S3.7 (Signals --> Confidence Chain)

All signal `confidence` values feed into the multi-stage confidence adjustment pipeline
in `appWorker.js`:

```
signalEngine.analyze() confidence
    --> _applyMarketContextToPatterns()
    --> _applyMacroConfidenceToPatterns()
    --> _applyPhase8ConfidenceToPatterns()
    --> _applyRORORegimeToPatterns()
    --> _applyMicroConfidenceToPatterns()
```

### here --> S4 (Signals --> Rendering)

| Signal Type | S4 Render Element | Visual |
|-------------|-------------------|--------|
| goldenCross / deadCross | Diamond marker + vertical band | Colored diamond (size by wc) + 5-bar gradient band |
| composite (tier=1) | Star marker | 5-point star (size 12 * wc scaling) |
| macd/rsiBullishDivergence | Divergence line | Dashed line connecting swing lows |
| macd/rsiBearishDivergence | Divergence line | Dashed line connecting swing highs |
| volumeBreakout/Selloff | Volume highlight + label | ACCENT_FILL(0.7) bar color + "거래 up" label at y=73% |
| All hidden divergences | Divergence line | Same dashed lines as regular divergences |

**Density limits (signalRenderer.js):**
- MAX_DIAMONDS = 6 (sorted by confidence descending)
- MAX_STARS = 2 (sorted by confidence descending)
- MAX_DIV_LINES = 4 (MACD 2 + RSI 2)
- RECENT_BAR_LIMIT = 50 (zoom-aware: `max(50, visibleBars)`)

---

## Section 3.4: Individual Signal Engine -- Complete Catalog

The `analyze()` method (line 486) executes 24 detection functions in fixed order,
producing 48+ distinct signal types across 7 categories plus 6 derivatives/flow
categories. Each signal carries: `type`, `source`, `signal` (buy/sell/neutral),
`strength` (weak/medium/strong), `confidence` (10-95), `index`, `time`, `description`.

### Analysis Pipeline Order (signalEngine.js line 496-524)

```
1. _detectMACross()           --> goldenCross, deadCross, maAlignment_bull/bear
2. _detectMACDSignals()       --> macdBullishCross, macdBearishCross + MACD divergences
3. _detectRSISignals()        --> rsiOversold/Exit, rsiOverbought/Exit + RSI divergences
4. _detectBBSignals()         --> bbLowerBounce, bbUpperBreak, bbSqueeze
5. _detectVolumeSignals()     --> volumeBreakout, volumeSelloff, volumeExhaustion
6. _detectOBVDivergence()     --> obvBullishDivergence, obvBearishDivergence
7. _detectIchimokuSignals()   --> ichimokuBullishCross/BearishCross, cloudBreakout/Breakdown
8. _detectHurstSignal()       --> hurstTrending, hurstMeanReverting
9. _detectStochRSISignals()   --> stochRsiOversold, stochRsiOverbought
10. _detectStochasticSignals() --> stochasticOversold, stochasticOverbought
11. _detectKalmanSignals()     --> kalmanUpturn, kalmanDownturn
12. _detectCCISignals()        --> cciOversoldExit, cciOverboughtExit
13. _detectADXSignals()        --> adxBullishCross, adxBearishCross
14. _detectWilliamsRSignals()  --> williamsROversold, williamsROverbought
15. _detectATRExpansion()      --> atrExpansion
16. _detectCUSUMBreak()        --> cusumBreak
17. _detectVolRegimeChange()   --> volRegimeExpand, volRegimeHigh
18. _detectBasisSignal()       --> basisContango, basisBackwardation
19. _detectPCRSignal()         --> pcrFearExtreme, pcrGreedExtreme
20. _detectFlowSignal()        --> flowAlignedBuy/Sell, flowForeignBuy/Sell, flowLeadershipBuy/Sell
21. _detectERPSignal()         --> erpUndervalued, erpOvervalued
22. _detectETFSentiment()      --> etfBullishExtreme, etfBearishExtreme
23. _detectShortInterest()     --> shortHighSIR, shortSqueeze
```

Minimum candle requirement: 30 bars (line 487). Below this threshold, returns empty
signals with `_emptyStats()`.

---

### Category 1: MA Cross & Alignment (4 signals)

#### [SIG-01] goldenCross (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectMACross()` line 776 |
| **Trigger** | MA(5) crosses above MA(20), `prevDiff <= 0 && currDiff > 0`, with ATR gap filter `abs(currDiff) >= ATR(14) * 0.4` |
| **Strength** | `strong` if EMA(12) > EMA(26) confirmed, else `medium` |
| **Confidence** | 72 (EMA confirmed) / 60 (no EMA confirm) |
| **Weight** | +3.0 |
| **Cooldown** | None (event-driven: one per crossover) |
| **Constants** | ATR gap ratio = 0.4 [C], EMA confirm conf = 72 [D], no-confirm conf = 60 [D] |
| **Stage Ref** | S1(OHLCV) --> S2(EMH counter: Brock/Lakonishok/LeBaron 1992) --> S3.1(`calcMA`, `calcEMA`, `calcATR`) --> S4(diamond marker + vband) |
| **Academic** | Murphy (1999) Ch.9, Brock et al. (1992) |
| **JS Location** | signalEngine.js:795-816 |

#### [SIG-02] deadCross (Direction: sell)

| Field | Value |
|-------|-------|
| **Detection** | `_detectMACross()` line 776 |
| **Trigger** | MA(5) crosses below MA(20), `prevDiff >= 0 && currDiff < 0`, with ATR gap filter |
| **Strength** | `strong` if EMA(12) < EMA(26) confirmed, else `medium` |
| **Confidence** | 70 (EMA confirmed) / 58 (no confirm) -- buy-sell asymmetry -2pp |
| **Weight** | -3.0 |
| **Cooldown** | None |
| **Constants** | Same ATR gap as goldenCross; confidence -2pp asymmetry [D] |
| **Stage Ref** | S1(OHLCV) --> S2(KRX short-sale constraint) --> S3.1(`calcMA`, `calcEMA`) --> S4(diamond + vband) |
| **Academic** | Murphy (1999), KRX short-sale asymmetry |
| **JS Location** | signalEngine.js:819-837 |

**Buy-Sell Asymmetry Note:** Dead cross confidence is 2pp below golden cross at each
tier. This reflects the empirical observation that KRX short-sale constraints make
sell signals slightly less reliable than buy signals. The same -2pp asymmetry appears
throughout the signal engine.

#### [SIG-03] maAlignment_bull (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectMAAlignment()` line 851 |
| **Trigger** | MA(5) > MA(20) > MA(60) entry moment (not true on prior bar) |
| **Confidence** | 65 [D] |
| **Weight** | +2.0 |
| **measuredWR** | null (backtest pending) |
| **Stage Ref** | S1(OHLCV) --> S2(Murphy 1999: trend confirmation) --> S3.1(`calcMA`) --> S4(no direct render; composite input) |
| **Academic** | Murphy (1999) Ch.9 |
| **JS Location** | signalEngine.js:868-883 |

#### [SIG-04] maAlignment_bear (Direction: sell)

| Field | Value |
|-------|-------|
| **Detection** | `_detectMAAlignment()` line 851 |
| **Trigger** | MA(5) < MA(20) < MA(60) entry moment |
| **Confidence** | 63 [D] |
| **Weight** | -2.0 |
| **measuredWR** | null (backtest pending) |
| **Stage Ref** | Same as SIG-03 (sell direction) |
| **Academic** | Murphy (1999) |
| **JS Location** | signalEngine.js:887-903 |

---

### Category 2: MACD Signals (2 cross + 8 divergence = 10 signals)

#### [SIG-05] macdBullishCross (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectMACDSignals()` line 914 |
| **Trigger** | MACD line crosses above signal line: `prevDiff <= 0 && currDiff > 0` |
| **Strength** | `strong` if above zero line, else `medium` |
| **Confidence** | 70 (above 0-line) / 58 (below 0-line) [D] |
| **Weight** | +2.0 |
| **Stage Ref** | S1(OHLCV) --> S2(Appel 1979) --> S3.1(`calcMACD(12,26,9)`) --> S4(no direct render; composite input) |
| **Academic** | Appel (1979), Murphy (1999) Ch.10 |
| **JS Location** | signalEngine.js:926-938 |

**Note:** Histogram zero-cross signal was explicitly removed (line 957-958) because
`histogram = MACD - Signal`, making histogram zero-cross mathematically identical to
MACD/Signal cross. This prevents double-counting.

#### [SIG-06] macdBearishCross (Direction: sell)

| Field | Value |
|-------|-------|
| **Detection** | `_detectMACDSignals()` line 914 |
| **Trigger** | MACD line crosses below signal line |
| **Strength** | `strong` if below zero line, else `medium` |
| **Confidence** | 68 (below 0-line) / 56 (above 0-line) [D] |
| **Weight** | -2.0 |
| **JS Location** | signalEngine.js:942-954 |

#### [SIG-07] macdBullishDivergence (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectDivergence()` line 2099, called at line 962 with `name='macd'`, `lookback=40` |
| **Trigger** | Price makes lower low, MACD makes higher low (swing order = 3 bars each side) |
| **Confidence** | 70 [D] |
| **Weight** | +2.5 |
| **Constants** | lookback = 40 [B], swingOrder = 3 [B] |
| **Stage Ref** | S1(OHLCV) --> S2(Murphy 1999 Ch.10) --> S3.1(`calcMACD`) --> S4(divergence dashed line, BUY_COLOR) |
| **Academic** | Murphy (1999) Ch.10 |
| **JS Location** | signalEngine.js:2128-2152 |

#### [SIG-08] macdBearishDivergence (Direction: sell)

| Field | Value |
|-------|-------|
| **Detection** | `_detectDivergence()` line 2099 |
| **Trigger** | Price makes higher high, MACD makes lower high |
| **Confidence** | 68 [D] -- buy-sell asymmetry -2pp |
| **Weight** | -2.5 |
| **JS Location** | signalEngine.js:2173-2193 |

#### [SIG-09] macdHiddenBullishDivergence (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectDivergence()` line 2099 |
| **Trigger** | Price makes higher low, MACD makes lower low (trend continuation) |
| **Confidence** | 62 [D] |
| **Weight** | +2.0 |
| **Stage Ref** | S4(divergence line, BUY_COLOR) |
| **Academic** | Murphy (1999), Cardwell (1997) hidden divergence concept |
| **JS Location** | signalEngine.js:2155-2168 |

#### [SIG-10] macdHiddenBearishDivergence (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Price makes lower high, MACD makes higher high |
| **Confidence** | 60 [D] |
| **Weight** | -2.0 |
| **JS Location** | signalEngine.js:2197-2210 |

#### [SIG-11 through SIG-14] RSI Divergences (4 signals)

The same `_detectDivergence()` is called at line 1062 with `name='rsi'`, `lookback=40`.
Produces 4 signal types following identical logic:

| Signal Type | Direction | Confidence | Weight |
|-------------|-----------|------------|--------|
| rsiBullishDivergence | buy | 70 [D] | +2.0 |
| rsiBearishDivergence | sell | 68 [D] | -2.0 |
| rsiHiddenBullishDivergence | buy | 62 [D] | +1.5 |
| rsiHiddenBearishDivergence | sell | 60 [D] | -1.5 |

**Note on Divergence Look-Ahead:** Swing point detection uses `swingOrder=3`, requiring
`candles[i+1..i+3]` future data. This is acceptable for chart display but introduces
a 3-bar lag for real-time trading. Documented as `[H-2]` in codebase comments.

---

### Category 3: RSI Signals (4 direct signals)

All RSI signals use **Hurst-RSI coupling** (C-5 CZW pattern):

```
H > 0.6 (trending):  RSI reversal less reliable --> confidence DOWN
H < 0.4 (mean-rev):  RSI reversal more reliable --> confidence UP
R^2 < 0.70:          Hurst influence reduced (quality gate)

hBase = round((65 - 20 * clamp((H-0.4)/0.2)) * hurstQuality + 55 * (1-hurstQuality))
  where hurstQuality = min(1, R^2/0.70)
  H=0.4 --> hBase=65, H=0.5 --> 55, H=0.6 --> 45 (R^2>=0.70)
```

#### [SIG-15] rsiOversold (Direction: neutral)

| Field | Value |
|-------|-------|
| **Detection** | `_detectRSISignals()` line 974 |
| **Trigger** | RSI(14) crosses below 30 (from above) |
| **Confidence** | min(75, entryConf + extremeBonus), where `entryConf = max(40, hBase-10)` |
| **Weight** | +1.5 (observation, not actionable) |
| **Constants** | RSI oversold = 30 [A] Wilder (1978), extremeBonus = `floor(abs(RSI-50)/10)*2` [D] |
| **Stage Ref** | S1(OHLCV) --> S2(Wilder 1978, Mandelbrot/Hurst coupling) --> S3.1(`calcRSI`, `calcHurst`) --> S4(no direct render) |
| **Academic** | Wilder (1978) "New Concepts in Technical Trading Systems" |
| **JS Location** | signalEngine.js:1000-1013 |

#### [SIG-16] rsiOversoldExit (Direction: buy)

| Field | Value |
|-------|-------|
| **Trigger** | RSI(14) crosses above 30 (from below) |
| **Confidence** | min(80, exitBuyConf + extremeBonus), where `exitBuyConf = max(50, hBase)` |
| **Weight** | +2.5 |
| **JS Location** | signalEngine.js:1015-1028 |

#### [SIG-17] rsiOverbought (Direction: neutral)

| Field | Value |
|-------|-------|
| **Trigger** | RSI(14) crosses above 70 |
| **Confidence** | min(75, entryConf + extremeBonus) |
| **Weight** | -1.5 |
| **JS Location** | signalEngine.js:1030-1043 |

#### [SIG-18] rsiOverboughtExit (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | RSI(14) crosses below 70 |
| **Confidence** | min(78, exitSellConf + extremeBonus), where `exitSellConf = max(48, hBase-2)` |
| **Weight** | -2.5 |
| **JS Location** | signalEngine.js:1046-1058 |

---

### Category 4: Bollinger Band Signals (3 signals)

#### [SIG-19] bbLowerBounce (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectBBSignals()` line 1074 |
| **Trigger** | Previous low <= BB lower AND current close > BB lower AND bullish candle (close > open) |
| **Confidence** | 60 [D] |
| **Weight** | +1.5 |
| **Stage Ref** | S1(OHLCV) --> S2(Bollinger 2001) --> S3.1(`calcBB(20,2)` or `bbEVT` with Hill alpha fat-tail) --> S4(no direct render) |
| **Academic** | Bollinger (2001) "Bollinger on Bollinger Bands" |
| **JS Location** | signalEngine.js:1090-1103 |

**EVT-aware BB:** When `cache.bbEVT()` is available (Gopikrishnan 1999), Hill alpha < 4
(heavy tail) automatically widens bands, reducing false breakout signals.

#### [SIG-20] bbUpperBreak (Direction: neutral)

| Field | Value |
|-------|-------|
| **Detection** | `_detectBBSignals()` line 1074 |
| **Trigger** | Close > BB upper AND previous close <= BB upper |
| **Confidence** | 50 [D] |
| **Weight** | 0 (neutral -- direction determined by composite) |
| **Note** | Changed from `sell` to `neutral` [ACC]: strong trends show sustained BB upper breaks |
| **JS Location** | signalEngine.js:1108-1121 |

#### [SIG-21] bbSqueeze (Direction: buy or sell)

| Field | Value |
|-------|-------|
| **Detection** | `_detectBBSqueeze()` line 1133 |
| **Trigger** | Previous bandwidth <= 10th percentile of 20-bar lookback, current bandwidth >= 2x that percentile |
| **Direction** | `buy` if close > BB upper or bullish candle; `sell` otherwise |
| **Confidence** | min(90, (72 or 64) + durBoost), where durBoost: >=20 bars squeeze = +8, >=10 bars = +4 |
| **Weight** | 0 (direction varies) |
| **Constants** | lookback=20 [B], pct10 percentile [A] Bollinger (2001), durBoost 20-bar=+8 [D] |
| **Academic** | Bollinger (2001) "headfake" squeeze-breakout pattern |
| **JS Location** | signalEngine.js:1133-1192 |

---

### Category 5: Volume Signals (3 signals)

#### [SIG-22] volumeBreakout (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectVolumeSignals()` line 1200 |
| **Trigger** | Volume z-score >= 2.0 AND bullish candle (close > open) |
| **Confidence** | max(40, min(80, 50 + 15*ln(z)) + advAdj) [D] |
| **Weight** | +2.0 |
| **Constants** | zThreshold=2.0 [A] (upper 2.28% of normal distribution), ADV adj: lv0=-5 [D], lv1=-2 [D] |
| **Stage Ref** | S1(OHLCV) --> S2(Ane & Geman 2000, log-normal volume) --> S3.1(`volZScore(i,20)`) --> S4(volume accent color + "거래 up" label) |
| **Academic** | Ane & Geman (2000), Karpoff (1987) price-volume relationship |
| **JS Location** | signalEngine.js:1227-1239 |

#### [SIG-23] volumeSelloff (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Volume z-score >= 2.0 AND bearish candle |
| **Confidence** | max(40, min(78, 48 + 15*ln(z)) + advAdj) |
| **Weight** | -2.0 |
| **JS Location** | signalEngine.js:1242-1254 |

#### [SIG-24] volumeExhaustion (Direction: neutral)

| Field | Value |
|-------|-------|
| **Detection** | `_detectVolumeExhaustion()` line 1266 |
| **Trigger** | 5 consecutive bars of declining volume |
| **Confidence** | 45 [D] |
| **Weight** | 0 |
| **Constants** | consecutiveRequired=5 [D] |
| **Note** | Duplicate prevention: if prior signal at i-1, replaces it (keeps only latest) |
| **JS Location** | signalEngine.js:1266-1302 |

---

### Category 6: OBV Divergence (2 signals)

#### [SIG-25] obvBullishDivergence (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectOBVDivergence()` line 1321 |
| **Trigger** | Price lower low + OBV higher low (accumulation), within 20-bar lookback, swingOrder=3 |
| **Confidence** | min(75, 50 + 12*ln(priceGapATR + 0.5)) [D] |
| **Weight** | +2.5 |
| **Constants** | lookback=20 [B], swingOrder=3 [B] |
| **Stage Ref** | S1(OHLCV) --> S2(Granville 1963 "volume leads price") --> S3.1(`IndicatorCache.obv()`) --> S4(no direct render) |
| **Academic** | Granville (1963) "New Key to Stock Market Profits", Murphy (1999) Ch.7 |
| **JS Location** | signalEngine.js:1351-1377 |

**Note on OBV Look-Ahead:** OBV swing detection uses `candles[i+1..i+swingOrder]`
(3-bar future data). Signal index is at the swing point, not the confirmation bar.
Consistent with `_detectDivergence()` behavior.

#### [SIG-26] obvBearishDivergence (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Price higher high + OBV lower high (distribution) |
| **Confidence** | min(73, 48 + 12*ln(priceGapATR + 0.5)) |
| **Weight** | -2.5 |
| **JS Location** | signalEngine.js:1381-1407 |

---

### Category 7: Ichimoku Signals (4 signals)

#### [SIG-27] ichimokuBullishCross (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectIchimokuSignals()` line 1429 |
| **Trigger** | Tenkan-sen (9) crosses above Kijun-sen (26) |
| **Strength** | `strong` if price above cloud, else `medium` |
| **Confidence** | 72 (above cloud) / 65 (below cloud) [D] |
| **Weight** | +2.5 |
| **Stage Ref** | S1(OHLCV) --> S2(Hosoda 1969 Ichimoku Kinko Hyo) --> S3.1(`calcIchimoku`) --> S4(no direct render; composite input) |
| **Academic** | Hosoda (1969) |
| **JS Location** | signalEngine.js:1447-1462 |

#### [SIG-28] ichimokuBearishCross (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Tenkan-sen crosses below Kijun-sen |
| **Strength** | `strong` if price below cloud, else `medium` |
| **Confidence** | 72 (below cloud) / 65 (above cloud) [D] |
| **Weight** | -2.5 |
| **JS Location** | signalEngine.js:1465-1481 |

#### [SIG-29] ichimokuCloudBreakout (Direction: buy)

| Field | Value |
|-------|-------|
| **Trigger** | Close crosses above cloud top (previous close <= cloud top) |
| **Confidence** | 70 + chikouBoost (chikou > close[i-26] --> +5) [D] |
| **Weight** | +3.0 |
| **Constants** | chikouBoost=5 [D] (Hosoda: chikou confirmation = sanryaku completion) |
| **Academic** | Hosoda (1969) three-line confirmation (sanryaku hoten) |
| **JS Location** | signalEngine.js:1500-1512 |

#### [SIG-30] ichimokuCloudBreakdown (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Close crosses below cloud bottom |
| **Confidence** | 70 + chikouBoost [D] |
| **Weight** | -3.0 |
| **JS Location** | signalEngine.js:1516-1528 |

---

### Category 8: Hurst Regime Filter (2 signals)

#### [SIG-31] hurstTrending (Direction: neutral)

| Field | Value |
|-------|-------|
| **Detection** | `_detectHurstSignal()` line 1553 |
| **Trigger** | Hurst exponent H > 0.6 AND R^2 >= 0.50 (quality gate) |
| **Confidence** | round(55 * rQual) where rQual = min(1, R^2/0.70) [D] |
| **Weight** | 0 (regime filter, not directional) |
| **Stage Ref** | S1(OHLCV) --> S2(Mandelbrot 1963, Lo 1991 R/S analysis) --> S3.1(`calcHurst`) --> S4(no render) |
| **Academic** | Mandelbrot (1963), Lo (1991) |
| **JS Location** | signalEngine.js:1569-1580 |

#### [SIG-32] hurstMeanReverting (Direction: neutral)

| Field | Value |
|-------|-------|
| **Trigger** | H < 0.4 AND R^2 >= 0.50 |
| **Confidence** | round(55 * rQual) [D] |
| **Weight** | 0 |
| **JS Location** | signalEngine.js:1581-1592 |

**Note:** Hurst signals are placed at `lastIdx` (end of series) as they summarize
the entire time series regime, not a specific bar event.

---

### Category 9: StochRSI Signals (2 signals)

#### [SIG-33] stochRsiOversold (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectStochRSISignals()` line 1605 |
| **Trigger** | RSI in [40, 60] neutral zone AND StochRSI %K < 10 |
| **Confidence** | min(55, 48 + extremeBonus) where extremeBonus = floor((10-K)/2) [D] |
| **Weight** | +1.0 |
| **Cooldown** | 5 bars [D] (whipsaw prevention) |
| **Note** | Only fires in RSI neutral zone [40,60] to prevent double-counting with RSI oversold/overbought signals |
| **Stage Ref** | S1(OHLCV) --> S2(Chande & Kroll 1994) --> S3.1(`IndicatorCache.stochRsi(14,3,3,14)`) --> S4(no render) |
| **Academic** | Chande & Kroll (1994) |
| **JS Location** | signalEngine.js:1622-1636 |

#### [SIG-34] stochRsiOverbought (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | RSI in [40, 60] AND StochRSI %K > 90 |
| **Confidence** | min(55, 48 + extremeBonus) where extremeBonus = floor((K-90)/2) [D] |
| **Weight** | -1.0 |
| **JS Location** | signalEngine.js:1639-1653 |

---

### Category 10: Stochastic Oscillator Signals (2 signals)

#### [SIG-35] stochasticOversold (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectStochasticSignals()` line 1674 |
| **Trigger** | Slow %K crosses above %D AND K < 20 (oversold zone) |
| **Confidence** | min(maxConf, 52 + extremeBonus + wrBonus), maxConf=70 (extreme K<10) / 65 (normal) |
| **Weight** | +1.5 |
| **Cooldown** | 7 bars [B] (half-cycle of 14-period oscillator) |
| **Constants** | OVERSOLD=20 [A] Lane (1984), EXTREME_OS=10 [B] Bulkowski (2005), BASE_CONF=52 [D], WR_BONUS=3 [D] |
| **Williams %R** | Confluence bonus +3 if %R < -80 (mathematically equivalent; bonus only, not independent signal) |
| **Stage Ref** | S1(OHLCV) --> S2(Lane 1984, Williams 1979) --> S3.1(`stochastic(14,3,3)`, `williamsR(14)`) --> S4(no render) |
| **Academic** | Lane (1984), Appel (2005) oscillator cycle principle |
| **JS Location** | signalEngine.js:1698-1718 |

#### [SIG-36] stochasticOverbought (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Slow %K crosses below %D AND K > 80 |
| **Confidence** | min(maxConf, 52 + extremeBonus + wrBonus), maxConf=68 (extreme) / 63 (normal) -- sell cap -2pp |
| **Weight** | -1.5 |
| **JS Location** | signalEngine.js:1722-1743 |

---

### Category 11: Kalman Filter (2 signals)

#### [SIG-37] kalmanUpturn (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectKalmanSignals()` line 2056 |
| **Trigger** | Kalman 2nd derivative sign change: d0 <= 0 AND d1 > 0 |
| **Confidence** | 40 [D] |
| **Weight** | 0 (composite condition only, not independent) |
| **Stage Ref** | S1(OHLCV) --> S2(Kalman 1960, A. Harvey 1989) --> S3.1(`calcKalman(Q=0.1, R=1.0)`) --> S4(no render) |
| **Note** | Steady-state K ~= 0.095, equivalent to ~EMA(20) response speed |
| **Academic** | Kalman (1960), Harvey (1989) structural time series |
| **JS Location** | signalEngine.js:2068-2074 |

#### [SIG-38] kalmanDownturn (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | d0 >= 0 AND d1 < 0 |
| **Confidence** | 40 [D] |
| **Weight** | 0 |
| **JS Location** | signalEngine.js:2075-2081 |

---

### Category 12: CCI Signals (2 signals) -- [C-3] idle indicator activation

#### [SIG-39] cciOversoldExit (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectCCISignals()` line 2633 |
| **Trigger** | CCI(20) crosses above -100 (from below) |
| **Confidence** | 45 [D] |
| **Weight** | +1.5 |
| **Stage Ref** | S1(OHLCV) --> S2(Lambert 1980) --> S3.1(`IndicatorCache.cci(20)`) --> S4(no render) |
| **Academic** | Lambert (1980) "Commodity Channel Index" |
| **JS Location** | signalEngine.js:2641-2648 |

#### [SIG-40] cciOverboughtExit (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | CCI(20) crosses below +100 (from above) |
| **Confidence** | 45 [D] |
| **Weight** | -1.5 |
| **JS Location** | signalEngine.js:2650-2657 |

---

### Category 13: ADX Signals (2 signals)

#### [SIG-41] adxBullishCross (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectADXSignals()` line 2666 |
| **Trigger** | +DI crosses above -DI AND ADX > 25 (trend confirmed) |
| **Confidence** | 55 [D] |
| **Weight** | +2.0 |
| **Stage Ref** | S1(OHLCV) --> S2(Wilder 1978 DMI) --> S3.1(`IndicatorCache.adx(14)`) --> S4(no render) |
| **Academic** | Wilder (1978) "New Concepts in Technical Trading Systems" |
| **JS Location** | signalEngine.js:2675-2681 |

#### [SIG-42] adxBearishCross (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | -DI crosses above +DI AND ADX > 25 |
| **Confidence** | 55 [D] |
| **Weight** | -2.0 |
| **JS Location** | signalEngine.js:2684-2690 |

---

### Category 14: Williams %R Signals (2 signals)

#### [SIG-43] williamsROversold (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectWilliamsRSignals()` line 2700 |
| **Trigger** | %R crosses above -80 (from below) |
| **Confidence** | 42 [D] |
| **Weight** | +1.0 |
| **Stage Ref** | S1(OHLCV) --> S2(Williams 1979) --> S3.1(`IndicatorCache.williamsR(14)`) --> S4(no render) |
| **Academic** | Williams (1979) |
| **JS Location** | signalEngine.js:2708-2714 |

#### [SIG-44] williamsROverbought (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | %R crosses below -20 (from above) |
| **Confidence** | 42 [D] |
| **Weight** | -1.0 |
| **JS Location** | signalEngine.js:2717-2723 |

---

### Category 15: ATR Expansion (1 signal)

#### [SIG-45] atrExpansion (Direction: neutral)

| Field | Value |
|-------|-------|
| **Detection** | `_detectATRExpansion()` line 2733 |
| **Trigger** | ATR(14) / MA(ATR, 20) >= 1.5, at entry moment (prior bar ratio < 1.5) |
| **Confidence** | 50 [D] |
| **Weight** | 0 (neutral direction) |
| **Stage Ref** | S1(OHLCV) --> S2(Wilder 1978, Bollinger 2002) --> S3.1(`calcATR(14)`, `calcMA`) --> S4(no render) |
| **Academic** | Wilder (1978), Bollinger (2002) |
| **JS Location** | signalEngine.js:2733-2754 |

---

### Category 16: CUSUM Break (1 signal)

#### [SIG-46] cusumBreak (Direction: neutral)

| Field | Value |
|-------|-------|
| **Detection** | `_detectCUSUMBreak()` line 2761 |
| **Trigger** | Online CUSUM breakpoint detected within recent 20 bars |
| **Confidence** | 52 [D] |
| **Weight** | 0 (neutral) |
| **Stage Ref** | S1(OHLCV) --> S2(Page 1954, Inclan & Tiao 1994) --> S3.1(`IndicatorCache.onlineCUSUM()`) --> S4(no render) |
| **Academic** | Page (1954), Inclan & Tiao (1994) |
| **JS Location** | signalEngine.js:2761-2779 |

---

### Category 17: Volatility Regime Change (2 signals)

#### [SIG-47] volRegimeExpand (Direction: neutral)

| Field | Value |
|-------|-------|
| **Detection** | `_detectVolRegimeChange()` line 2786 |
| **Trigger** | Vol regime transitions from `low` to `normal` or `high` |
| **Confidence** | 48 [D] |
| **Weight** | 0 |
| **Stage Ref** | S1(OHLCV) --> S2(Engle 1982 ARCH, Cont 2001) --> S3.1(`IndicatorCache.volRegime()`) --> S4(no render) |
| **Academic** | Engle (1982), Cont (2001) |
| **JS Location** | signalEngine.js:2794-2801 |

#### [SIG-48] volRegimeHigh (Direction: neutral)

| Field | Value |
|-------|-------|
| **Trigger** | Vol regime transitions to `high` (from non-high) |
| **Confidence** | 55 [D] |
| **Weight** | -0.5 (weak bearish bias: high vol = risk) |
| **JS Location** | signalEngine.js:2803-2810 |

---

### Category 18: Derivatives/Basis Signals (2 signals)

#### [SIG-49] basisContango (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectBasisSignal()` line 2409 |
| **Data Source** | `_derivativesData` (derivatives_summary.json, last element if array) |
| **Trigger** | basisPct > 0.5% (normal) or > 2.0% (extreme) |
| **Confidence** | 55 (weak) / 62 (medium) / 72 (strong/extreme) [D] |
| **Weight** | +1.5 |
| **Stage Ref** | S1(derivatives_summary.json) --> S2.7(Bessembinder & Seguin 1993, Doc27 S5.1) --> S4(no render) |
| **Academic** | Bessembinder & Seguin (1993), Hull (2020) futures pricing |
| **JS Location** | signalEngine.js:2409-2441 |

#### [SIG-50] basisBackwardation (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | basisPct < -0.5% |
| **Confidence** | Same tiers as contango |
| **Weight** | -1.5 |
| **JS Location** | signalEngine.js:2438-2441 |

---

### Category 19: PCR Contrarian Signals (2 signals)

#### [SIG-51] pcrFearExtreme (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectPCRSignal()` line 2448 |
| **Data Source** | `_derivativesData.pcr` |
| **Trigger** | Put-Call Ratio > 1.3 (extreme fear --> contrarian buy) |
| **Confidence** | 62 [D] |
| **Weight** | +2.0 |
| **Stage Ref** | S1(derivatives_summary.json) --> S2.7(Pan & Poteshman 2006, Doc37 S6) --> S4(no render) |
| **Academic** | Pan & Poteshman (2006) |
| **JS Location** | signalEngine.js:2455-2458 |

#### [SIG-52] pcrGreedExtreme (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | PCR < 0.5 (extreme greed --> contrarian sell) |
| **Confidence** | 62 [D] |
| **Weight** | -2.0 |
| **JS Location** | signalEngine.js:2459-2462 |

---

### Category 20: Investor Flow Signals (6 signals)

#### [SIG-53] flowAlignedBuy (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectFlowSignal()` line 2472 |
| **Data Source** | `_investorData.alignment` (signal_1d or string) |
| **Trigger** | Foreign + institutional aligned buy |
| **Confidence** | 65 [D] |
| **Weight** | +2.5 |
| **Stage Ref** | S1(investor_summary.json) --> S2.6(Choe/Kho/Stulz 2005, LSV 1992, Doc39 S6) --> S4(no render) |
| **Academic** | Choe, Kho & Stulz (2005), Lakonishok, Shleifer & Vishny (1992) |
| **JS Location** | signalEngine.js:2481-2484 |

#### [SIG-54] flowAlignedSell (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Foreign + institutional aligned sell |
| **Confidence** | 65 [D] |
| **Weight** | -2.5 |
| **JS Location** | signalEngine.js:2485-2488 |

#### [SIG-55] flowForeignBuy (Direction: buy)

| Field | Value |
|-------|-------|
| **Trigger** | Foreign 20-day cumulative net buy > 5,000 billion KRW |
| **Confidence** | 58 [D] |
| **Weight** | +1.5 |
| **JS Location** | signalEngine.js:2495-2498 |

#### [SIG-56] flowForeignSell (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Foreign 20-day cumulative net sell > 5,000 billion KRW |
| **Confidence** | 58 [D] |
| **Weight** | -1.5 |
| **JS Location** | signalEngine.js:2499-2502 |

#### [SIG-57] flowLeadershipBuy (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectFlowSignal()` line 2472 |
| **Trigger** | Foreign 1-day net buy > 2,000 billion (weak) or > 5,000 billion (medium) |
| **Confidence** | 62 (weak) / 68 (medium) [D] |
| **Weight** | Not in `_weights` map (see Finding F-01) |
| **Stage Ref** | S1(investor_summary.json) --> S2.6(Kyle 1985, Doc39 S3.2) --> S4(no render) |
| **Academic** | Kyle (1985) informed trader model |
| **JS Location** | signalEngine.js:2513-2521 |

#### [SIG-58] flowLeadershipSell (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | Foreign 1-day net sell > 2,000 billion (weak) or > 5,000 billion (medium) |
| **Confidence** | 62 / 68 [D] |
| **Weight** | Not in `_weights` map (see Finding F-01) |
| **JS Location** | signalEngine.js:2522-2529 |

---

### Category 21: ERP (Equity Risk Premium) Signals (2 signals)

#### [SIG-59] erpUndervalued (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectERPSignal()` line 2539 |
| **Data Source** | `_bondsLatest.yields.ktb_10y`, `_sectorData` or `_macroLatest.market_per` |
| **Trigger** | ERP = (1/PER)*100 - KTB10Y > 5.5% |
| **Confidence** | 60 [D] |
| **Weight** | +2.0 |
| **Stage Ref** | S1(bonds_latest.json, sector_fundamentals.json) --> S2.3(Asness 2003, Damodaran ERP) --> S4(no render) |
| **Academic** | Asness (2003), Damodaran implied ERP methodology |
| **JS Location** | signalEngine.js:2556-2559 |

#### [SIG-60] erpOvervalued (Direction: sell)

| Field | Value |
|-------|-------|
| **Trigger** | ERP < 1.0% |
| **Confidence** | 60 [D] |
| **Weight** | -2.0 |
| **JS Location** | signalEngine.js:2560-2563 |

---

### Category 22: ETF Sentiment (2 signals)

#### [SIG-61] etfBullishExtreme (Direction: sell -- contrarian)

| Field | Value |
|-------|-------|
| **Detection** | `_detectETFSentiment()` line 2573 |
| **Data Source** | `_etfData.leverageSentiment` |
| **Trigger** | sentiment='strong_bullish' AND leverageRatio > 3.0 (retail euphoria) |
| **Confidence** | 55 [D] |
| **Weight** | -1.0 (contrarian: bullish extreme = sell) |
| **Stage Ref** | S1(etf_summary.json) --> S2.4(Behavioral: herding, Cheng & Madhavan 2009, Doc38 S3) --> S4(no render) |
| **Academic** | Cheng & Madhavan (2009) ETF ecosystem effects |
| **JS Location** | signalEngine.js:2580-2583 |

#### [SIG-62] etfBearishExtreme (Direction: buy -- contrarian)

| Field | Value |
|-------|-------|
| **Trigger** | sentiment='strong_bearish' AND leverageRatio < 0.3 |
| **Confidence** | 55 [D] |
| **Weight** | +1.0 (contrarian: bearish extreme = buy) |
| **JS Location** | signalEngine.js:2584-2587 |

---

### Category 23: Short Selling Signals (2 signals)

#### [SIG-63] shortHighSIR (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectShortInterest()` line 2597 |
| **Data Source** | `_shortSellingData.market_short_ratio` or `.marketTrend[-1].shortRatio` |
| **Trigger** | Market short ratio > 8% |
| **Confidence** | 56 [D] |
| **Weight** | +1.5 |
| **Stage Ref** | S1(shortselling_summary.json) --> S2.7(Desai et al. 2002, Doc40 S4) --> S4(no render) |
| **Academic** | Desai, Ramesh, Thiagarajan & Balachandran (2002) |
| **JS Location** | signalEngine.js:2608-2611 |

#### [SIG-64] shortSqueeze (Direction: buy)

| Field | Value |
|-------|-------|
| **Detection** | `_detectShortInterest()` line 2597 |
| **Trigger** | `squeeze_candidates` array is non-empty |
| **Confidence** | 63 [D] |
| **Weight** | +2.5 |
| **Stage Ref** | S1(shortselling_summary.json) --> S2.7(Lamont & Thaler 2003, Doc40 S5) --> S4(no render) |
| **Academic** | Lamont & Thaler (2003) |
| **JS Location** | signalEngine.js:2615-2618 |

---

### Sentiment Weight Map (Complete)

The `_weights` object (line 426-473) maps each signal type to a directional weight
used in the `_calcStats()` sentiment calculation. Weight = 0 means the signal is
directionally neutral or composite-only.

| Category | Signal | Weight | Academic Basis |
|----------|--------|--------|---------------|
| MA | goldenCross | +3 | Murphy (1999) |
| MA | deadCross | -3 | Murphy (1999) |
| MA | maAlignment_bull | +2 | Murphy (1999) |
| MA | maAlignment_bear | -2 | Murphy (1999) |
| MACD | macdBullishCross | +2 | Appel (1979) |
| MACD | macdBearishCross | -2 | Appel (1979) |
| MACD | macdBullishDivergence | +2.5 | Murphy (1999) |
| MACD | macdBearishDivergence | -2.5 | Murphy (1999) |
| MACD | macdHiddenBullishDivergence | +2.0 | Cardwell (1997) |
| MACD | macdHiddenBearishDivergence | -2.0 | Cardwell (1997) |
| RSI | rsiOversold | +1.5 | Wilder (1978) |
| RSI | rsiOversoldExit | +2.5 | Wilder (1978) |
| RSI | rsiOverbought | -1.5 | Wilder (1978) |
| RSI | rsiOverboughtExit | -2.5 | Wilder (1978) |
| RSI | rsiBullishDivergence | +2.0 | Murphy (1999) |
| RSI | rsiBearishDivergence | -2.0 | Murphy (1999) |
| RSI | rsiHiddenBullishDivergence | +1.5 | Cardwell (1997) |
| RSI | rsiHiddenBearishDivergence | -1.5 | Cardwell (1997) |
| BB | bbLowerBounce | +1.5 | Bollinger (2001) |
| BB | bbUpperBreak | 0 | Neutral [ACC] |
| BB | bbSqueeze | 0 | Neutral |
| Ichimoku | ichimokuBullishCross | +2.5 | Hosoda (1969) |
| Ichimoku | ichimokuBearishCross | -2.5 | Hosoda (1969) |
| Ichimoku | ichimokuCloudBreakout | +3 | Hosoda (1969) |
| Ichimoku | ichimokuCloudBreakdown | -3 | Hosoda (1969) |
| StochRSI | stochRsiOversold | +1.0 | Chande & Kroll (1994) |
| StochRSI | stochRsiOverbought | -1.0 | Chande & Kroll (1994) |
| Stochastic | stochasticOversold | +1.5 | Lane (1984) |
| Stochastic | stochasticOverbought | -1.5 | Lane (1984) |
| Hurst | hurstTrending | 0 | Neutral regime |
| Hurst | hurstMeanReverting | 0 | Neutral regime |
| Kalman | kalmanUpturn | 0 | Composite-only |
| Kalman | kalmanDownturn | 0 | Composite-only |
| CCI | cciOversoldExit | +1.5 | Lambert (1980) |
| CCI | cciOverboughtExit | -1.5 | Lambert (1980) |
| ADX | adxBullishCross | +2.0 | Wilder (1978) |
| ADX | adxBearishCross | -2.0 | Wilder (1978) |
| Williams | williamsROversold | +1.0 | Williams (1979) |
| Williams | williamsROverbought | -1.0 | Williams (1979) |
| ATR | atrExpansion | 0 | Neutral direction |
| CUSUM | cusumBreak | 0 | Neutral direction |
| VolRegime | volRegimeExpand | 0 | Neutral |
| VolRegime | volRegimeHigh | -0.5 | Weak bearish bias |
| Volume | volumeBreakout | +2 | Karpoff (1987) |
| Volume | volumeSelloff | -2 | Karpoff (1987) |
| Volume | volumeExhaustion | 0 | Neutral |
| OBV | obvBullishDivergence | +2.5 | Granville (1963) |
| OBV | obvBearishDivergence | -2.5 | Granville (1963) |
| Derivatives | basisContango | +1.5 | Bessembinder & Seguin (1993) |
| Derivatives | basisBackwardation | -1.5 | Bessembinder & Seguin (1993) |
| Derivatives | pcrFearExtreme | +2.0 | Pan & Poteshman (2006) |
| Derivatives | pcrGreedExtreme | -2.0 | Pan & Poteshman (2006) |
| Flow | flowAlignedBuy | +2.5 | Choe/Kho/Stulz (2005) |
| Flow | flowAlignedSell | -2.5 | Choe/Kho/Stulz (2005) |
| Flow | flowForeignBuy | +1.5 | Doc39 |
| Flow | flowForeignSell | -1.5 | Doc39 |
| ERP | erpUndervalued | +2.0 | Asness (2003) |
| ERP | erpOvervalued | -2.0 | Asness (2003) |
| ETF | etfBullishExtreme | -1.0 | Contrarian |
| ETF | etfBearishExtreme | +1.0 | Contrarian |
| Short | shortHighSIR | +1.5 | Desai et al. (2002) |
| Short | shortSqueeze | +2.5 | Lamont & Thaler (2003) |

---

## Section 3.5: Composite Signals -- Complete Catalog (30 composites)

### Matching Algorithm

`_matchComposites()` (line 2242) implements a window-based multi-signal convergence
detector:

1. **Signal Map Construction**: Merge indicator signals + candle pattern type-index maps
   into a unified `allMap: Map<type, Array<index>>`
2. **Window Scan**: For each `COMPOSITE_SIGNAL_DEFS` entry, check if all `required`
   signal types have at least one occurrence within a `+-window` bar range around any
   occurrence of the first required signal
3. **Optional Bonus**: Count optional signals present in window, add `optionalBonus` per match
4. **Dual Confidence**:
   - Display: `min(95, baseConfidence + optionalCount * optionalBonus)`
   - Prediction: `min(90, _predMap[id] + optionalCount * round(optionalBonus * 0.6))`
5. **Platt Calibration**: If `rl_policy.platt_params[id]` exists, applies sigmoid:
   `P = 1 / (1 + exp(-(a*x + b)))` where x = confidencePred/100
6. **Per-signal Window Override**: `rl_policy.composite_windows[id]` can override the
   default window=5 for speed-specific tuning
7. **Deduplication**: Same compositeId within +-window bars is suppressed

**Composite Cap Justification (95 vs Individual 90):**
Bayesian updating: independent confirming signals monotonically increase posterior probability.
Grinold-Kahn IC aggregation: `IR_composite ~= IC * sqrt(N * (1 + (N-1)*rho)^(-1))`, rho < 1
improves IR. The 5-point differential accounts for shared noise in OHLCV-based indicators.
**Limitation (M-4):** reliabilityTier from backtester is not available at composite
matching time (backtester runs after signalEngine). D-tier discount must be applied
downstream.

---

### Tier 1: Strong Composites (11 composites)

#### [COMP-01] strongBuy_hammerRsiVolume

| Field | Value |
|-------|-------|
| **ID** | `strongBuy_hammerRsiVolume` |
| **Direction** | buy |
| **Tier** | 1 (strong) |
| **Required** | hammer (candle), rsiOversoldExit |
| **Optional** | volumeBreakout (+5) |
| **Base Confidence** | 61 [C-8] (calibrated from hammer WR=47.9%) |
| **Window** | 5 bars [D-Heuristic] |
| **Stage Ref** | S2.4(Nison 1991 candle confirmation) + S3.1(calcRSI) + S3.4(SIG-16) + S4(star marker) |
| **JS Location** | signalEngine.js:17-29 |

#### [COMP-02] strongSell_shootingMacdVol

| Field | Value |
|-------|-------|
| **Direction** | sell |
| **Tier** | 1 |
| **Required** | shootingStar (candle), macdBearishCross |
| **Optional** | volumeSelloff (+5) |
| **Base Confidence** | 69 [C-8] (shootingStar WR=56.0%) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:30-42 |

#### [COMP-03] buy_doubleBottomNeckVol

| Field | Value |
|-------|-------|
| **Direction** | buy |
| **Tier** | 1 |
| **Required** | doubleBottom (chart pattern), volumeBreakout |
| **Optional** | goldenCross (+5) |
| **Base Confidence** | 68 [S-5] (doubleBottom WR=62.1% + vol conditional ~68%) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:155-166 |

#### [COMP-04] sell_doubleTopNeckVol

| Field | Value |
|-------|-------|
| **Direction** | sell |
| **Tier** | 1 |
| **Required** | doubleTop (chart pattern), volumeSelloff |
| **Optional** | deadCross (+5) |
| **Base Confidence** | 75 [E-4] (doubleTop WR=73.0%) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:167-178 |

#### [COMP-05] buy_ichimokuTriple

| Field | Value |
|-------|-------|
| **Direction** | buy |
| **Tier** | 1 |
| **Required** | ichimokuCloudBreakout, ichimokuBullishCross |
| **Optional** | volumeBreakout (+4) |
| **Base Confidence** | 70 [E-4] (Hosoda sanryaku hoten, WR=65-75% theoretical) |
| **measuredWR** | null (backtest pending) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:179-194 |

#### [COMP-06] sell_ichimokuTriple

| Field | Value |
|-------|-------|
| **Direction** | sell |
| **Tier** | 1 |
| **Required** | ichimokuCloudBreakdown, ichimokuBearishCross |
| **Optional** | volumeSelloff (+4) |
| **Base Confidence** | 70 [E-4] |
| **measuredWR** | null |
| **Window** | 5 |
| **JS Location** | signalEngine.js:195-209 |

#### [COMP-07] buy_goldenMarubozuVol

| Field | Value |
|-------|-------|
| **Direction** | buy |
| **Tier** | 1 |
| **Required** | goldenCross, bullishMarubozu (candle) |
| **Optional** | volumeBreakout (+5) |
| **Base Confidence** | 65 [E-4] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:211-222 |

#### [COMP-08] sell_deadMarubozuVol

| Field | Value |
|-------|-------|
| **Direction** | sell |
| **Tier** | 1 |
| **Required** | deadCross, bearishMarubozu (candle) |
| **Optional** | volumeSelloff (+5) |
| **Base Confidence** | 68 [E-4] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:224-236 |

#### [COMP-09] buy_adxGoldenTrend

| Field | Value |
|-------|-------|
| **Direction** | buy |
| **Tier** | 1 |
| **Required** | goldenCross, adxBullishCross |
| **Optional** | volumeBreakout (+5) |
| **Base Confidence** | 67 [D] |
| **Window** | 5 |
| **Stage Ref** | S2(Wilder 1978 ADX trend-following) + S3.4(SIG-01, SIG-41) |
| **JS Location** | signalEngine.js:310-318 |

#### [COMP-10] sell_adxDeadTrend

| Field | Value |
|-------|-------|
| **Direction** | sell |
| **Tier** | 1 |
| **Required** | deadCross, adxBearishCross |
| **Optional** | volumeSelloff (+5) |
| **Base Confidence** | 67 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:320-329 |

#### [COMP-11] buy_shortSqueezeFlow

| Field | Value |
|-------|-------|
| **Direction** | buy |
| **Tier** | 1 |
| **Required** | shortSqueeze, flowForeignBuy |
| **Optional** | volumeBreakout (+5) |
| **Base Confidence** | 66 [D] |
| **Window** | 5 |
| **Stage Ref** | S1(shortselling/investor data) + S2.7(Lamont & Thaler 2003) |
| **JS Location** | signalEngine.js:293-305 |

---

### Tier 2: Medium Composites (15 composites)

#### [COMP-12] buy_goldenCrossRsi

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 2 |
| **Required** | goldenCross |
| **Optional** | rsiOversoldExit (+4), volumeBreakout (+4) |
| **Base Confidence** | 58 [C-8] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:44-57 |

#### [COMP-13] sell_deadCrossMacd

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 2 |
| **Required** | deadCross |
| **Optional** | macdBearishCross (+4), rsiOverboughtExit (+4) |
| **Base Confidence** | 58 [C-8] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:58-70 |

#### [COMP-14] buy_hammerBBVol

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 2 |
| **Required** | hammer (candle), bbLowerBounce |
| **Optional** | volumeBreakout (+5) |
| **Base Confidence** | 63 [E-1] (KRX measured WR x 1.25 conditional multiplier) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:73-85 |

#### [COMP-15] sell_shootingStarBBVol

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 2 |
| **Required** | shootingStar (candle), bbUpperBreak |
| **Optional** | volumeSelloff (+5) |
| **Base Confidence** | 69 [E-1] (shootingStar WR=56% x 1.25) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:86-98 |

#### [COMP-16] buy_morningStarRsiVol

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 2 |
| **Required** | morningStar (candle), rsiOversoldExit |
| **Optional** | volumeBreakout (+4) |
| **Base Confidence** | 58 [E-1] (morningStar WR=42.9% but 3-bar structural strength) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:99-111 |

#### [COMP-17] sell_eveningStarRsiVol

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 2 |
| **Required** | eveningStar (candle), rsiOverboughtExit |
| **Optional** | volumeSelloff (+4) |
| **Base Confidence** | 65 [E-1] (eveningStar WR=53.3% x KRX bearish pattern advantage) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:112-124 |

#### [COMP-18] buy_engulfingMacdAlign

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 2 |
| **Required** | bullishEngulfing (candle), macdBullishCross |
| **Optional** | maAlignment_bull (+4) |
| **Base Confidence** | 48 [Audit] (bullishEngulfing WR=41.3%, MACD conditional ~48%) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:128-139 |

#### [COMP-19] sell_engulfingMacdAlign

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 2 |
| **Required** | bearishEngulfing (candle), macdBearishCross |
| **Optional** | maAlignment_bear (+4) |
| **Base Confidence** | 66 [E-4] (bearishEngulfing WR=56.4% + MACD conditional) |
| **Window** | 5 |
| **JS Location** | signalEngine.js:140-152 |

#### [COMP-20] buy_flowPcrConvergence

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 2 |
| **Required** | flowAlignedBuy |
| **Optional** | pcrFearExtreme (+5), basisContango (+5) |
| **Base Confidence** | 63 [D] |
| **Window** | 5 |
| **Stage Ref** | S1(derivatives + investor data) + S2.7(multiple) |
| **JS Location** | signalEngine.js:267-278 |

#### [COMP-21] sell_flowPcrConvergence

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 2 |
| **Required** | flowAlignedSell |
| **Optional** | pcrGreedExtreme (+5), basisBackwardation (+5) |
| **Base Confidence** | 63 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:279-291 |

#### [COMP-22] buy_cciRsiDoubleOversold

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 2 |
| **Required** | cciOversoldExit, rsiOversoldExit |
| **Optional** | volumeBreakout (+4) |
| **Base Confidence** | 58 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:332-341 |

#### [COMP-23] sell_cciRsiDoubleOverbought

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 2 |
| **Required** | cciOverboughtExit, rsiOverboughtExit |
| **Optional** | volumeSelloff (+4) |
| **Base Confidence** | 58 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:343-352 |

#### [COMP-24] neutral_squeezeExpansion

| Field | Value |
|-------|-------|
| **Direction** | neutral | **Tier** | 2 |
| **Required** | bbSqueeze, atrExpansion |
| **Optional** | volumeBreakout (+4) |
| **Base Confidence** | 52 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:354-363 |

#### [COMP-25] buy_cusumKalmanTurn

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 2 |
| **Required** | cusumBreak, kalmanUpturn |
| **Optional** | goldenCross (+4) |
| **Base Confidence** | 55 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:387-396 |

#### [COMP-26] sell_cusumKalmanTurn

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 2 |
| **Required** | cusumBreak, kalmanDownturn |
| **Optional** | deadCross (+4) |
| **Base Confidence** | 55 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:398-407 |

#### [COMP-27] buy_volRegimeOBVAccumulation

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 2 |
| **Required** | volRegimeHigh, obvBullishDivergence |
| **Optional** | volumeBreakout (+4) |
| **Base Confidence** | 58 [D] |
| **Window** | 5 |
| **Stage Ref** | S2.6(Cont 2001) + S2(Granville 1963) -- "smart money inflow during fear" |
| **JS Location** | signalEngine.js:409-418 |

---

### Tier 3: Weak Composites (4 composites)

#### [COMP-28] buy_bbBounceRsi

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 3 |
| **Required** | bbLowerBounce |
| **Optional** | rsiOversold (+3), volumeBreakout (+3) |
| **Base Confidence** | 55 [C-8] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:239-251 |

#### [COMP-29] sell_bbBreakoutRsi

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 3 |
| **Required** | bbUpperBreak |
| **Optional** | rsiOverbought (+3), volumeSelloff (+3) |
| **Base Confidence** | 55 [C-8] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:252-264 |

#### [COMP-30] buy_wrStochOversold

| Field | Value |
|-------|-------|
| **Direction** | buy | **Tier** | 3 |
| **Required** | williamsROversold, stochasticOversold |
| **Optional** | rsiOversoldExit (+3) |
| **Base Confidence** | 48 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:365-374 |

#### [COMP-31] sell_wrStochOverbought

| Field | Value |
|-------|-------|
| **Direction** | sell | **Tier** | 3 |
| **Required** | williamsROverbought, stochasticOverbought |
| **Optional** | rsiOverboughtExit (+3) |
| **Base Confidence** | 48 [D] |
| **Window** | 5 |
| **JS Location** | signalEngine.js:376-385 |

---

### Composite Signal Summary Table

| Tier | Buy Count | Sell Count | Neutral Count | Total |
|------|-----------|------------|---------------|-------|
| 1 | 7 | 4 | 0 | 11 |
| 2 | 8 | 6 | 1 | 15 |
| 3 | 2 | 2 | 0 | 4 |
| **Total** | **17** | **12** | **1** | **30** |

### Common Composite Constants

| Constant | Value | Grade | Justification |
|----------|-------|-------|---------------|
| window | 5 (all composites) | [D-Heuristic] | Nison (1991): "confirmation within several sessions" |
| optionalBonus | 3-5 per composite | [D] | Higher for Tier 1 (more confident) |
| composite cap | 95 | [D] | Bayesian updating, Grinold-Kahn IC aggregation |
| _predMap cap | 90 | [D] | Conservative prediction ceiling |

### Composite Tier Weighting (Sentiment)

AMH crowding discount (Lo 2004, Pedersen 2009): popular patterns lose alpha faster.

| Tier | Sentiment Weight | Rationale |
|------|-----------------|-----------|
| 1 | 1.5 | Most crowded --> lowest weight (alpha decay) |
| 2 | 2.5 | Medium crowding |
| 3 | 3.5 | Least crowded --> highest weight (alpha retained) |

---

## Section 3.6: Post-Processing Filters

After individual signal detection (Section 3.4) and composite matching (Section 3.5),
the `analyze()` method applies 12 sequential post-processing filters that modulate
signal confidence. These filters are applied in strict order; each operates on the
already-modified confidence from the previous filter.

### Filter Pipeline Order (signalEngine.js analyze() method)

```
Individual signals detected (SIG-01 through SIG-64)
    |
[F3.6-01] ADX Trend Filter          -- line 543
[F3.6-02] CCI Regime Filter         -- line 545
[F3.6-03] CUSUM Breakpoint Discount -- line 548
[F3.6-04] BinSeg Regime Discount    -- line 551
[F3.6-05] OLS Trend Confirmation    -- line 556
[F3.6-06] Cumulative Adj Cap        -- line 572
[F3.6-07] Entropy Damping           -- line 597
[F3.6-08] IV/HV Ratio Discount      -- line 606
[F3.6-09] VKOSPI/VIX Regime         -- line 640
[F3.6-10] Expiry Discount           -- line 657
[F3.6-11] Crisis Severity           -- line 668
[F3.6-12] HMM Regime Fallback       -- line 682
    |
S/R Proximity Boost (optional, called externally by app.js)
    |
ADV Level Multiplier + VolRegime (stats calculation)
```

---

### [F3.6-01] ADX Trend Filter

| Field | Value |
|-------|-------|
| **Location** | `_applyADXFilter()` line 1915 |
| **Target** | `_ADX_TREND_TYPES` only (10 types): goldenCross, deadCross, maAlignment_bull/bear, macdBullishCross/BearishCross, ichimokuBullishCross/BearishCross, ichimokuCloudBreakout/Breakdown |
| **Method** | Isotonic piecewise-linear interpolation (Barlow et al. 1972) |
| **Breakpoints** | Default: [[10,-10],[15,-5],[20,0],[25,5],[30,7],[40,10],[50,10]] |
| **Override** | `rl_policy.adx_isotonic` |
| **Effect** | ADX=10 --> -10 conf, ADX=25 --> +5, ADX=50 --> +10 |
| **Clamp** | [30, 90] |
| **TF-adaptive** | 1m/5m --> period 28, 15m/30m --> 21, 1h+ --> 14 [C] |
| **Academic** | Wilder (1978) ADX as trend quality filter |
| **Stage Ref** | S2(Wilder 1978) --> S3.1(`IndicatorCache.adx()`) |
| **Constants** | Breakpoints [D], TF periods [C] Kaufman (2013) |

---

### [F3.6-02] CCI Regime Filter

| Field | Value |
|-------|-------|
| **Location** | `_applyCCIFilter()` line 1952 |
| **Target** | Same `_ADX_TREND_TYPES` (10 types) |
| **Method** | Isotonic interpolation on |CCI| (absolute value, direction-agnostic) |
| **Breakpoints** | Default: [[40,-3],[75,0],[100,0],[150,2],[200,3],[300,3]] |
| **Override** | `rl_policy.cci_isotonic` |
| **Effect** | |CCI|=40 --> -3, |CCI|=150 --> +2, |CCI|=300 --> +3 |
| **Clamp** | [30, 90] |
| **Orthogonality** | CCI measures price deviation from statistical mean (r ~= 0.50 with ADX). ADX measures directional movement. Both contribute independent information. |
| **Academic** | Lambert (1980), Colby (2003) |
| **Constants** | Breakpoints [D], KRX thresholds adjusted (150/75 vs standard 100/50) |

---

### [F3.6-03] CUSUM Breakpoint Discount

| Field | Value |
|-------|-------|
| **Location** | `_applyCUSUMDiscount()` line 1980 |
| **Target** | All signals (non-selective) |
| **Condition** | CUSUM breakpoint is recent (within 30 bars) |
| **Discount** | Linear recovery: 0.70 at breakpoint --> 1.0 after 30 bars |
| **Formula** | `discount = 0.70 + 0.30 * (barsSince / 30)` |
| **Floor** | conf >= 10 |
| **Volatility-adaptive** | Threshold adapts via `cache.cusum(2.5, lastVolRegime)` |
| **Academic** | Page (1954), Roberts (1966) |
| **Constants** | Initial discount 0.70 [D], recovery 30 bars [D], threshold 2.5 [B] |

**Rationale:** Structural breakpoints invalidate pre-breakpoint statistical relationships.
The 30-bar linear recovery reflects the time needed for new regime parameters to
stabilize sufficiently for pattern reliability.

---

### [F3.6-04] Binary Segmentation Regime Discount

| Field | Value |
|-------|-------|
| **Location** | `_applyBinSegDiscount()` line 2018 |
| **Target** | Counter-trend signals only (selective by direction) |
| **Condition** | BinSeg breakpoint within 30 bars |
| **Discount** | `0.85 + 0.15 * (barsSince / 30)` -- weaker than CUSUM (0.85 vs 0.70) |
| **Direction logic** | rightMean > leftMean = upward regime --> sell signals discounted; vice versa |
| **Academic** | Bai & Perron (1998) |
| **Constants** | Initial discount 0.85 [D], recovery 30 bars [D], min segments 3 [D], min length 30 [D] |

---

### [F3.6-05] OLS Trend Confirmation

| Field | Value |
|-------|-------|
| **Location** | analyze() line 556 |
| **Condition** | 20-bar OLS trend has R^2 > 0.50 |
| **Effect** | +5 confidence to trend-aligned signals (buy in uptrend, sell in downtrend) |
| **Clamp** | 90 |
| **Academic** | Lo & MacKinlay (1999) |
| **Constants** | OLS window 20 [B], R^2 threshold 0.50 [D], boost +5 [D] |

---

### [F3.6-06] Cumulative Adjustment Cap

| Field | Value |
|-------|-------|
| **Location** | analyze() line 572 |
| **Rule** | Total ADX + CCI + OLS adjustment cannot exceed +/-15 from base confidence |
| **Formula** | `if (delta > 15) conf = baseConf + 15; if (delta < -15) conf = baseConf - 15` |
| **Final clamp** | [10, 90] |
| **Academic** | Stack inflation prevention -- ADX/CCI/OLS share partial correlation as trend measures |
| **Constants** | MAX_CUMULATIVE_ADJ = 15 [D-Heuristic] |

---

### [F3.6-07] Entropy Damping

| Field | Value |
|-------|-------|
| **Location** | analyze() line 597 |
| **Condition** | signals.length > 2 AND entropyNorm < 1.0 |
| **Formula** | `scale = 0.80 + 0.20 * sqrt(max(0, entropyNorm))` [D] |
| **Effect** | entropyNorm=0 --> 0.80x, 0.25 --> 0.90x, 0.50 --> 0.94x, 1.0 --> 1.0x (no damping) |
| **Academic** | Shannon (1948) information entropy |
| **Rationale** | Low entropy = signals concentrated in few categories = redundant information = confidence should be dampened. sqrt recovery ensures fast relaxation as diversity increases. |
| **Constants** | Base scale 0.80 [D], sqrt exponent [D] |

---

### [F3.6-08] IV/HV Ratio Discount

| Field | Value |
|-------|-------|
| **Location** | analyze() line 606 |
| **Data Source** | `_marketContext.vkospi` or `_macroLatest.vkospi` or `_macroLatest.vix * 1.12` (proxy) |
| **Condition** | IV (VKOSPI/100) > HV (Parkinson 20-bar) |
| **Formula** | `discount = max(0.50, 1 - 0.20 * max(0, IV/HV - 1))` [C] |
| **Floor** | 50% of original confidence (maximum damping) |
| **Academic** | Doc26 S5.3, Black-Scholes implied vs realized volatility |
| **Constants** | alpha = 0.20 [C] (range [0.1, 0.3]) |

**Rationale:** When market expects higher volatility (IV > HV), option pricing implies
greater uncertainty. Pattern-based predictions become less reliable in such regimes.

---

### [F3.6-09] VKOSPI/VIX Regime Discount

| Field | Value |
|-------|-------|
| **Location** | `_classifyVolRegimeFromVKOSPI()` line 1789, `_volRegimeDiscount()` line 1845 |
| **Fallback Chain** | 1) VKOSPI (real) --> 2) VIX * 1.12 proxy [DEPRECATED] --> 3) null |
| **Thresholds** | < 15 = low (1.0), 15-22 = normal (0.95), 22-30 = high (0.80), > 30 = crisis (0.60) [C] |
| **Academic** | Whaley (2000, 2009) VIX as "investor fear gauge", Doc26 S2.3 |
| **Constants** | All thresholds [C] (KRX-calibrated from Doc26) |

---

### [F3.6-10] Options Expiry Discount

| Field | Value |
|-------|-------|
| **Location** | `_isNearExpiry()` line 1822 |
| **Condition** | Last candle date falls within D-2 to D+1 of monthly options expiry (second Thursday) |
| **Discount** | `conf *= 0.70` [C] |
| **Academic** | Doc27 S4 -- options/futures expiry creates abnormal price dynamics |
| **Constants** | Discount factor 0.70 [C], expiry = 2nd Thursday [A] (KRX rule) |

---

### [F3.6-11] Crisis Severity Discount

| Field | Value |
|-------|-------|
| **Location** | `_calcCrisisSeverity()` line 1862 |
| **Components** | VKOSPI (15-40 range), USD/KRW (1200-1500 range), DXY (95-110 range) |
| **Score** | Average of available components, range [0, 1] |
| **Condition** | severity > 0.7 |
| **Formula** | `crisisScale = 1 - severity * 0.40` (severity=1.0 --> 0.60x) [D] |
| **Target** | Reversal-type signals only (continuation signals unaffected) |
| **Academic** | Longin & Solnik (2001) correlation breakdown during crises, Doc28 S1.2 |
| **Constants** | Severity threshold 0.7 [D], scale factor 0.40 [D], VKOSPI range 15-40 [C], USD/KRW 1200-1500 [C], DXY 95-110 [D] |

---

### [F3.6-12] HMM Regime Fallback

| Field | Value |
|-------|-------|
| **Location** | analyze() line 682 |
| **Condition** | Only applies when VKOSPI/VIX regime (F3.6-09) was NOT applied (prevents double discount) |
| **Data Source** | `backtester._behavioralData['hmm_regimes'].daily` |
| **Method** | Directional discount: regime-confirming signals unpenalized, counter-trend discounted |
| **Formula** | Bullish regime (bull_prob > 0.5): sell signals `scale = 0.70 + 0.30 * (1 - bull_prob)` |
| | Bearish regime: buy signals `scale = 0.70 + 0.30 * bull_prob` |
| **Academic** | Hamilton (1989) regime-switching, Ang & Bekaert (2002) |
| **Constants** | Base discount 0.70 [D], 30-day staleness gate [D] |

---

### [F3.6-EXT] S/R Proximity Boost (External, called by app.js)

| Field | Value |
|-------|-------|
| **Location** | `applySRProximityBoost()` line 730 |
| **Not in analyze() pipeline** | Called separately by app.js when S/R levels available |
| **Buy-side** | Support proximity: `boost = round(8 * max(0, 1-dist) * min(strength, 2) / 2)` where dist = abs(price - S/R) / ATR |
| **Sell-side** | Resistance proximity: `boost = round(5 * max(0, 1-dist) * min(strength, 2) / 2)` |
| **Asymmetry** | Buy factor=8, Sell factor=5 -- support bounces are stronger reversal signals |
| **Clamp** | 90 |
| **Academic** | Prospect theory (Kahneman & Tversky 1979): loss aversion at support levels |
| **Constants** | Buy factor 8 [D-Heuristic], Sell factor 5 [D-Heuristic], ATR distance < 1.0 [D] |

---

### [F3.6-AUX] Auxiliary Modules

#### ADV Level Multiplier (line 2961)

| Level | ADV (billion KRW) | Multiplier | Grade |
|-------|-----------|------------|-------|
| 0 | < 1 | 0.75 | [D] |
| 1 | 1-10 | 0.85 | [D] |
| 2 | 10-100 | 1.00 | [D] |
| 3 | >= 100 | 1.10 | [D] |

Reference: Amihud (2002) ILLIQ, Lo (2004) AMH. Asymmetric penalty: thin stock
penalty (-25%) > thick bonus (+10%). Computed in `calcADVLevel()` with 60-bar lookback.
Stored in `stats.advLevel` / `stats.advMultiplier`.

#### VolRegime Signal (line 3011)

| Regime | EWMA Ratio | Multiplier | Grade |
|--------|-----------|------------|-------|
| risk-on | long/short > 1.2 | 1.15 | [D] |
| neutral | 0.8-1.2 | 1.00 | [D] |
| risk-off | < 0.8 | 0.85 | [D] |

EWMA parameters: long lambda=0.97 (half-life ~23d), short lambda=0.86 (half-life ~4.6d).
Reference: Carr & Wu (2009) volatility risk premium.
Includes VRP calculation when `calcVRP`/`calcHV` available.

#### Shannon Entropy (Sentiment Stats)

```
H = -SUM(p_i * log2(p_i))  over 17 categories
entropyNorm = H / log2(active_categories)  --> [0, 1]
```

17 categories: ma, macd, rsi, bb, volume, obv, ichimoku, hurst, kalman, stochastic,
derivatives, flow, macro, sentiment, composite, adv, volRegime.

Sentiment calculation: weighted sum of recent 20-bar signals using `_weights` map.
`sentiment = round((buyWeight - sellWeight) / totalWeight * 100)`, range [-100, +100].

Labels: >= 60 "강한 매수", >= 25 "매수 우세", > -25 "중립", > -60 "매도 우세", else "강한 매도" [D].

---

## Signal Findings

### [F-01] flowLeadershipBuy/Sell Missing from Weight Map

**Severity:** Low
**Location:** `_weights` (line 426-473) vs `_detectFlowSignal()` (line 2506-2529)

`flowLeadershipBuy` and `flowLeadershipSell` signal types are generated in
`_detectFlowSignal()` but are not listed in the `_weights` map. In `_calcStats()`,
these signals fall through to the default `return 'ma'` in `_signalCategory()` (line
2929) and receive weight 0 from `this._weights[s.type] || 0`. They contribute to
composite matching (if any composite required them -- currently none do) but have zero
effect on the sentiment index.

**Recommendation:** Add to `_weights`: `flowLeadershipBuy: 2.0, flowLeadershipSell: -2.0`.
Add to `_signalCategory()` with proper flow/leadership category routing.

### [F-02] COMP-18 buy_engulfingMacdAlign Low baseConfidence

**Severity:** Informational
**Location:** COMPOSITE_SIGNAL_DEFS line 128

`baseConfidence=48` is the lowest among all Tier 2 composites. The audit note explains
the previous value of 60 was a +18.7pp overestimate relative to bullishEngulfing WR=41.3%.
This is correctly calibrated, but raises the question of whether this composite should
be demoted to Tier 3 (where other 48-confidence composites reside: COMP-30 and COMP-31).

**Recommendation:** Consider demoting to Tier 3 for consistency, or validate that MACD
conditional probability genuinely adds 6.7pp above base WR.

### [F-03] Buy-Sell Composite Count Imbalance (17 vs 12)

**Severity:** Informational

17 buy-side composites vs 12 sell-side + 1 neutral = 30 total. This reflects KRX
short-sale constraints and academic literature bias toward buy-side reversal patterns.
Not necessarily a defect, but should be documented in any trading strategy that assumes
signal symmetry.

### [F-04] flowLeadershipBuy/Sell Not Used in Any Composite

**Severity:** Low
**Location:** COMPOSITE_SIGNAL_DEFS search for `flowLeadership`

Neither `flowLeadershipBuy` nor `flowLeadershipSell` appears as `required` or `optional`
in any composite signal definition. These signals are generated but only contribute to
the individual signal list and (with Finding F-01) have zero sentiment weight.

**Recommendation:** Consider adding a composite like `buy_foreignLeadershipGolden`
with required=[flowLeadershipBuy, goldenCross] to leverage the Kyle (1985) informed
trader lead signal.

### [F-05] Composite measuredWR null for 4 composites

**Severity:** Low

The following composites have `measuredWR: null` (backtest data not yet collected):
- COMP-05 buy_ichimokuTriple
- COMP-06 sell_ichimokuTriple

And the following individual signals:
- SIG-03 maAlignment_bull
- SIG-04 maAlignment_bear

These use theoretical baseConfidence values that should be re-calibrated once KRX
empirical win rates are available.

### [F-06] Post-Processing Filter Ordering May Cause Compounding

**Severity:** Medium

The 12 post-processing filters apply sequentially, each modifying the already-adjusted
confidence. In worst case, a signal near a CUSUM breakpoint (0.70x) during a crisis
(0.60x) near expiry (0.70x) in high IV/HV (0.50x) could see:

```
Original 70 --> CUSUM(0.70) = 49 --> Crisis(0.60) = 29 --> Expiry(0.70) = 20 --> IV/HV(0.50) = 10
```

This cascading discount is bounded by the floor of 10 (line 650, 662, etc.), but the
intermediate compounding is aggressive. The cumulative adjustment cap (F3.6-06) only
covers ADX+CCI+OLS, not the later multiplicative filters.

**Recommendation:** Consider implementing a global multiplicative floor (e.g., final
confidence >= 0.25 * original confidence) to prevent extreme cascading.

### [F-07] _signalCategory Fallback to 'ma'

**Severity:** Low
**Location:** `_signalCategory()` line 2929

The fallback `return 'ma'` catches any signal type not matching the prefix-based
classification. Currently, this silently misclassifies `flowLeadershipBuy/Sell` (should
be 'flow') and any future signal types. This is a maintenance risk.

**Recommendation:** Add explicit handling for `flowLeadership*` prefix, and change
fallback to `return 'other'` with a corresponding `categoryCounts.other` field.

---

## Appendix: Signal Type Quick Reference

| # | Signal Type | Dir | Conf Range | Weight | Category |
|---|-------------|-----|------------|--------|----------|
| 01 | goldenCross | buy | 60-72 | +3.0 | ma |
| 02 | deadCross | sell | 58-70 | -3.0 | ma |
| 03 | maAlignment_bull | buy | 65 | +2.0 | ma |
| 04 | maAlignment_bear | sell | 63 | -2.0 | ma |
| 05 | macdBullishCross | buy | 58-70 | +2.0 | macd |
| 06 | macdBearishCross | sell | 56-68 | -2.0 | macd |
| 07 | macdBullishDivergence | buy | 70 | +2.5 | macd |
| 08 | macdBearishDivergence | sell | 68 | -2.5 | macd |
| 09 | macdHiddenBullishDiv | buy | 62 | +2.0 | macd |
| 10 | macdHiddenBearishDiv | sell | 60 | -2.0 | macd |
| 11 | rsiBullishDivergence | buy | 70 | +2.0 | rsi |
| 12 | rsiBearishDivergence | sell | 68 | -2.0 | rsi |
| 13 | rsiHiddenBullishDiv | buy | 62 | +1.5 | rsi |
| 14 | rsiHiddenBearishDiv | sell | 60 | -1.5 | rsi |
| 15 | rsiOversold | neutral | 40-75 | +1.5 | rsi |
| 16 | rsiOversoldExit | buy | 50-80 | +2.5 | rsi |
| 17 | rsiOverbought | neutral | 40-75 | -1.5 | rsi |
| 18 | rsiOverboughtExit | sell | 48-78 | -2.5 | rsi |
| 19 | bbLowerBounce | buy | 60 | +1.5 | bb |
| 20 | bbUpperBreak | neutral | 50 | 0 | bb |
| 21 | bbSqueeze | buy/sell | 64-90 | 0 | bb |
| 22 | volumeBreakout | buy | 40-80 | +2.0 | volume |
| 23 | volumeSelloff | sell | 40-78 | -2.0 | volume |
| 24 | volumeExhaustion | neutral | 45 | 0 | volume |
| 25 | obvBullishDivergence | buy | 50-75 | +2.5 | obv |
| 26 | obvBearishDivergence | sell | 48-73 | -2.5 | obv |
| 27 | ichimokuBullishCross | buy | 65-72 | +2.5 | ichimoku |
| 28 | ichimokuBearishCross | sell | 65-72 | -2.5 | ichimoku |
| 29 | ichimokuCloudBreakout | buy | 70-75 | +3.0 | ichimoku |
| 30 | ichimokuCloudBreakdown | sell | 70-75 | -3.0 | ichimoku |
| 31 | hurstTrending | neutral | 0-55 | 0 | hurst |
| 32 | hurstMeanReverting | neutral | 0-55 | 0 | hurst |
| 33 | stochRsiOversold | buy | 48-55 | +1.0 | rsi |
| 34 | stochRsiOverbought | sell | 48-55 | -1.0 | rsi |
| 35 | stochasticOversold | buy | 52-70 | +1.5 | stochastic |
| 36 | stochasticOverbought | sell | 52-68 | -1.5 | stochastic |
| 37 | kalmanUpturn | buy | 40 | 0 | kalman |
| 38 | kalmanDownturn | sell | 40 | 0 | kalman |
| 39 | cciOversoldExit | buy | 45 | +1.5 | rsi* |
| 40 | cciOverboughtExit | sell | 45 | -1.5 | rsi* |
| 41 | adxBullishCross | buy | 55 | +2.0 | ma* |
| 42 | adxBearishCross | sell | 55 | -2.0 | ma* |
| 43 | williamsROversold | buy | 42 | +1.0 | ma* |
| 44 | williamsROverbought | sell | 42 | -1.0 | ma* |
| 45 | atrExpansion | neutral | 50 | 0 | ma* |
| 46 | cusumBreak | neutral | 52 | 0 | ma* |
| 47 | volRegimeExpand | neutral | 48 | 0 | ma* |
| 48 | volRegimeHigh | neutral | 55 | -0.5 | ma* |
| 49 | basisContango | buy | 55-72 | +1.5 | derivatives |
| 50 | basisBackwardation | sell | 55-72 | -1.5 | derivatives |
| 51 | pcrFearExtreme | buy | 62 | +2.0 | derivatives |
| 52 | pcrGreedExtreme | sell | 62 | -2.0 | derivatives |
| 53 | flowAlignedBuy | buy | 65 | +2.5 | flow |
| 54 | flowAlignedSell | sell | 65 | -2.5 | flow |
| 55 | flowForeignBuy | buy | 58 | +1.5 | flow |
| 56 | flowForeignSell | sell | 58 | -1.5 | flow |
| 57 | flowLeadershipBuy | buy | 62-68 | 0** | ma* |
| 58 | flowLeadershipSell | sell | 62-68 | 0** | ma* |
| 59 | erpUndervalued | buy | 60 | +2.0 | macro |
| 60 | erpOvervalued | sell | 60 | -2.0 | macro |
| 61 | etfBullishExtreme | sell | 55 | -1.0 | sentiment |
| 62 | etfBearishExtreme | buy | 55 | +1.0 | sentiment |
| 63 | shortHighSIR | buy | 56 | +1.5 | flow |
| 64 | shortSqueeze | buy | 63 | +2.5 | flow |

*Category marked with `*` indicates the signal falls through to `_signalCategory()`
fallback rules rather than having a dedicated prefix match. See Finding [F-07].

**Weight marked with `**` indicates the signal type is missing from `_weights` map.
See Finding [F-01].

---

*End of Stage 3 Sections 3.4-3.6*
