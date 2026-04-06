# 03 Signal Engine -- signalEngine.js 완전 참조 문서

> **파일**: `js/signalEngine.js` (3,118행)
> **전역 인스턴스**: `signalEngine` (SignalEngine), `COMPOSITE_SIGNAL_DEFS` (배열)
> **의존**: `indicators.js` (IndicatorCache, calcMA, calcEMA 등), `patterns.js` (patternEngine)
> **최종 갱신**: 2026-04-06

---

## 목차

1. [개별 시그널 (40+ 종)](#part-1-individual-signals)
2. [복합 시그널 (30종, COMPOSITE_SIGNAL_DEFS)](#part-2-composite-signals)
3. [다이버전스 감지](#part-3-divergence-detection)
4. [시장 심리 통계 (_calcStats)](#part-4-signal-statistics)
5. [후처리 필터 (ADX/CCI/OLS/CUSUM/BinSeg/IV-HV/VolRegime/HMM/Expiry/Crisis)](#part-5-post-processing-filters)
6. [보조 모듈 (ADV Level, VolRegime, S/R Proximity)](#part-6-auxiliary-modules)
7. [[D]-Tagged Constants 요약](#part-7-d-tagged-constants)

---

## Part 1: Individual Signals

### 1-1. MA Cross (골든크로스/데드크로스)

| Field | Value |
|-------|-------|
| Detection | `_detectMACross()` line 776 |
| Indicators | MA(5), MA(20), EMA(12), EMA(26), ATR(14) |

**Signal Types:**

#### goldenCross
- **Type**: `goldenCross` / Source: `indicator` / Direction: **buy**
- **Trigger**: MA5 > MA20 교차 (prevDiff <= 0 && currDiff > 0) + ATR gap filter
- **Constants**:

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| ATR gap ratio | 0.4 | [C] | minGap = ATR(14) * 0.4, KRX 횡보 잡음 필터 |
| EMA confirm conf | 72 | [D] | EMA12>EMA26 확인 시 confidence |
| No-confirm conf | 60 | [D] | EMA 미확인 시 confidence |

- **Confidence**: 60 (medium) / 72 (strong, EMA 확인)

#### deadCross
- **Type**: `deadCross` / Source: `indicator` / Direction: **sell**
- **Trigger**: MA5 < MA20 교차 + ATR gap filter
- **Confidence**: 58 (medium) / 70 (strong, EMA 확인) -- buy 대비 -2pp (KRX 공매도 비대칭)

### 1-2. MA Alignment (정배열/역배열)

| Field | Value |
|-------|-------|
| Detection | `_detectMAAlignment()` line 851 |
| Indicators | MA(5), MA(20), MA(60) |

#### maAlignment_bull
- **Type**: `maAlignment_bull` / Direction: **buy**
- **Trigger**: MA5 > MA20 > MA60 진입 시점 (이전 봉에서는 미충족)
- **Confidence**: 65 [D]
- **measuredWR**: null (백테스트 미측정)

#### maAlignment_bear
- **Type**: `maAlignment_bear` / Direction: **sell**
- **Trigger**: MA5 < MA20 < MA60 진입 시점
- **Confidence**: 63 [D]

### 1-3. MACD Signals

| Field | Value |
|-------|-------|
| Detection | `_detectMACDSignals()` line 914 |
| Indicators | MACD(12,26,9): macdLine, signalLine, histogram |

#### macdBullishCross
- **Type**: `macdBullishCross` / Direction: **buy**
- **Trigger**: MACD > Signal 교차 (prevDiff <= 0 && currDiff > 0)
- **Confidence**: 70 (0선 위, strong) / 58 (0선 아래, medium) [D]

#### macdBearishCross
- **Type**: `macdBearishCross` / Direction: **sell**
- **Trigger**: MACD < Signal 교차
- **Confidence**: 68 (0선 아래) / 56 (0선 위) [D]

> **Note**: 히스토그램 zero-cross 시그널은 제거됨 (MACD cross와 수학적으로 동일 -- 이중 카운트 방지)

### 1-4. RSI Signals

| Field | Value |
|-------|-------|
| Detection | `_detectRSISignals()` line 974 |
| Indicators | RSI(14), Hurst exponent (R/S), StochRSI |

**Hurst-RSI 연동 (C-5 CZW)**:
- H > 0.6 (추세): RSI 역행 위험 -> confidence 하향
- H < 0.4 (반지속): RSI 반전 유효 -> confidence 상향
- R^2 < 0.70: Hurst 영향 축소 (품질 게이트)

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| RSI oversold | 30 | [A] | Wilder (1978) standard |
| RSI overbought | 70 | [A] | Wilder (1978) standard |
| extremeBonus | `floor(abs(RSI-50)/10)*2` | [D] | RSI 극단도 가산 |

#### rsiOversold
- **Type**: `rsiOversold` / Direction: **neutral** (진입 관찰)
- **Trigger**: RSI crosses below 30
- **Confidence**: min(75, entryConf + extremeBonus)

#### rsiOversoldExit
- **Type**: `rsiOversoldExit` / Direction: **buy**
- **Trigger**: RSI crosses above 30 (과매도 탈출)
- **Confidence**: min(80, exitBuyConf + extremeBonus)

#### rsiOverbought
- **Type**: `rsiOverbought` / Direction: **neutral**
- **Trigger**: RSI crosses above 70
- **Confidence**: min(75, entryConf + extremeBonus)

#### rsiOverboughtExit
- **Type**: `rsiOverboughtExit` / Direction: **sell**
- **Trigger**: RSI crosses below 70
- **Confidence**: min(78, exitSellConf + extremeBonus)

### 1-5. Bollinger Band Signals

| Field | Value |
|-------|-------|
| Detection | `_detectBBSignals()` line 1074 |
| Indicators | BB(20,2) or bbEVT(20,2) with Hill alpha fat-tail correction |

#### bbLowerBounce
- **Type**: `bbLowerBounce` / Direction: **buy**
- **Trigger**: 이전 저가 <= BB하단 && 현재 종가 > BB하단 && 양봉
- **Confidence**: 60 [D]

#### bbUpperBreak
- **Type**: `bbUpperBreak` / Direction: **neutral** (강한 추세에서는 지속 신호)
- **Trigger**: 종가 > BB상단 돌파
- **Confidence**: 50 [D]

#### bbSqueeze
- **Type**: `bbSqueeze` / Direction: **buy** or **sell** (방향 판별)
- **Detection**: `_detectBBSqueeze()` line 1133
- **Trigger**: 밴드 폭 하위 10% percentile -> 2x 확산
- **Confidence**: min(90, (72 or 64) + durBoost)
  - durBoost: squeeze >= 20봉 -> +8, >= 10봉 -> +4

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| lookback | 20 | [B] | Bandwidth percentile 산출 기간 |
| pct10 | 하위 10% | [A] | Bollinger (2001) squeeze 기준 |
| durBoost 20봉 | +8 | [D] | 장기 squeeze 후 강력 breakout |

### 1-6. Volume Signals

| Field | Value |
|-------|-------|
| Detection | `_detectVolumeSignals()` line 1200 |
| Indicators | volZScore(i, 20), volRatio(i, 20), ADV level |

#### volumeBreakout
- **Type**: `volumeBreakout` / Direction: **buy**
- **Trigger**: z-score >= 2.0 && 양봉
- **Confidence**: min(80, 50 + 15*ln(z)) + advAdj [D]

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| zThreshold | 2.0 | [A] | 상위 2.28% (정규분포) |
| ADV adj lv0 | -5 | [D] | 극소형 유동성 감산 |
| ADV adj lv1 | -2 | [D] | 소형 유동성 감산 |

#### volumeSelloff
- **Type**: `volumeSelloff` / Direction: **sell**
- **Trigger**: z-score >= 2.0 && 음봉
- **Confidence**: min(78, 48 + 15*ln(z)) + advAdj

#### volumeExhaustion
- **Type**: `volumeExhaustion` / Direction: **neutral**
- **Detection**: `_detectVolumeExhaustion()` line 1266
- **Trigger**: 5봉 연속 거래량 감소
- **Confidence**: 45 [D]

### 1-7. OBV Divergence

| Field | Value |
|-------|-------|
| Detection | `_detectOBVDivergence()` line 1321 |
| Indicators | OBV (On-Balance Volume), closes, ATR(14) |
| Reference | Granville (1963), Murphy (1999) Ch.7 |

#### obvBullishDivergence
- **Type**: `obvBullishDivergence` / Direction: **buy**
- **Trigger**: 가격 lower low + OBV higher low (축적)
- **Confidence**: min(75, 50 + 12*ln(priceGapATR + 0.5))

#### obvBearishDivergence
- **Type**: `obvBearishDivergence` / Direction: **sell**
- **Trigger**: 가격 higher high + OBV lower high (분배)
- **Confidence**: min(73, 48 + 12*ln(priceGapATR + 0.5))

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| lookback | 20 | [B] | 스윙 포인트 탐색 범위 |
| swingOrder | 3 | [B] | 좌우 3봉 확인 (3-bar look-ahead) |

### 1-8. Ichimoku Signals

| Field | Value |
|-------|-------|
| Detection | `_detectIchimokuSignals()` line 1429 |
| Indicators | Ichimoku (tenkan 9, kijun 26, spanA, spanB, chikou) |
| Reference | Hosoda (1969) 삼역호전 |

#### ichimokuBullishCross
- **Type**: `ichimokuBullishCross` / Direction: **buy**
- **Trigger**: 전환선 > 기준선 교차
- **Confidence**: 72 (구름 위, strong) / 65 (구름 아래, medium) [D]

#### ichimokuBearishCross
- **Type**: `ichimokuBearishCross` / Direction: **sell**
- **Trigger**: 전환선 < 기준선 교차
- **Confidence**: 72 / 65 [D]

#### ichimokuCloudBreakout
- **Type**: `ichimokuCloudBreakout` / Direction: **buy**
- **Trigger**: 종가 > 구름 상단 돌파
- **Confidence**: 70 + chikouBoost (후행스팬 확인 시 +5) [D]

#### ichimokuCloudBreakdown
- **Type**: `ichimokuCloudBreakdown` / Direction: **sell**
- **Trigger**: 종가 < 구름 하단 이탈
- **Confidence**: 70 + chikouBoost [D]

### 1-9. Hurst Regime Filter

| Field | Value |
|-------|-------|
| Detection | `_detectHurstSignal()` line 1553 |
| Indicators | Hurst exponent (R/S analysis) |
| Reference | Mandelbrot (1963), Lo (1991) |

#### hurstTrending
- **Type**: `hurstTrending` / Direction: **neutral** (레짐 필터)
- **Trigger**: H > 0.6 && R^2 >= 0.50
- **Confidence**: round(55 * rQual) [D]

#### hurstMeanReverting
- **Type**: `hurstMeanReverting` / Direction: **neutral**
- **Trigger**: H < 0.4 && R^2 >= 0.50
- **Confidence**: round(55 * rQual) [D]

### 1-10. StochRSI Signals

| Field | Value |
|-------|-------|
| Detection | `_detectStochRSISignals()` line 1605 |
| Indicators | RSI(14), StochRSI(14,3,3,14) |
| Reference | Chande & Kroll (1994) |

RSI 40-60 중립대에서만 작동 (RSI 자체가 시그널을 내는 구간 제외 -- 이중 카운트 방지)

#### stochRsiOversold
- **Type**: `stochRsiOversold` / Direction: **buy**
- **Trigger**: RSI in [40,60] && StochRSI K < 10
- **Confidence**: min(55, 48 + extremeBonus) [D]
- **Cooldown**: 5봉 [D]

#### stochRsiOverbought
- **Type**: `stochRsiOverbought` / Direction: **sell**
- **Trigger**: RSI in [40,60] && StochRSI K > 90
- **Confidence**: min(55, 48 + extremeBonus) [D]

### 1-11. Stochastic Oscillator

| Field | Value |
|-------|-------|
| Detection | `_detectStochasticSignals()` line 1674 |
| Indicators | Slow Stochastic(14,3,3), Williams %R(14) |
| Reference | Lane (1984), Williams (1979) |

RSI와 측정 대상 상이: RSI=가격 변동폭, Stochastic=거래범위 내 종가 위치. Williams %R = -(100 - Raw %K) 수학적 동치이므로 독립 시그널이 아닌 확인 보너스(+3)만.

#### stochasticOversold
- **Type**: `stochasticOversold` / Direction: **buy**
- **Trigger**: %K > %D 상향 교차 && K < 20
- **Confidence**: min(70, 52 + extremeBonus + wrBonus) [D]

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| OVERSOLD | 20 | [A] | Lane (1984) |
| OVERBOUGHT | 80 | [A] | Lane (1984) |
| EXTREME_OS | 10 | [B] | Bulkowski (2005) |
| COOLDOWN | 7 | [B] | 14-period half-cycle |
| BASE_CONF | 52 | [D] | 기본 confidence |
| WR_BONUS | 3 | [D] | %R 컨플루언스 보너스 |

#### stochasticOverbought
- **Type**: `stochasticOverbought` / Direction: **sell**
- **Trigger**: %K < %D 하향 교차 && K > 80
- **Confidence**: min(68, 52 + extremeBonus + wrBonus) -- 매도 cap -2

### 1-12. Kalman Filter

| Field | Value |
|-------|-------|
| Detection | `_detectKalmanSignals()` line 2056 |
| Indicators | Kalman filter (Q=0.1, R=1.0) |
| Reference | Kalman (1960), A. Harvey (1989) |

Composite condition 전용 (독립 시그널 아님, weight=0). 정상상태 K~0.095, EMA(~20) 상당 반응속도.

#### kalmanUpturn
- **Type**: `kalmanUpturn` / Direction: **buy** / Confidence: 40 [D]
- **Trigger**: 칼만 필터 2차 미분 부호 변환 (d0<=0 && d1>0)

#### kalmanDownturn
- **Type**: `kalmanDownturn` / Direction: **sell** / Confidence: 40 [D]

### 1-13. CCI Signals (C-3 유휴 지표)

| Field | Value |
|-------|-------|
| Detection | `_detectCCISignals()` line 2633 |
| Indicators | CCI(20) |
| Reference | Lambert (1980) |

#### cciOversoldExit
- **Type**: `cciOversoldExit` / Direction: **buy** / Confidence: 45 [D]
- **Trigger**: CCI crosses above -100

#### cciOverboughtExit
- **Type**: `cciOverboughtExit` / Direction: **sell** / Confidence: 45 [D]
- **Trigger**: CCI crosses below +100

### 1-14. ADX Signals

| Field | Value |
|-------|-------|
| Detection | `_detectADXSignals()` line 2666 |
| Indicators | ADX(14) with +DI/-DI |
| Reference | Wilder (1978) |

#### adxBullishCross
- **Type**: `adxBullishCross` / Direction: **buy** / Confidence: 55 [D]
- **Trigger**: +DI > -DI 교차 && ADX > 25

#### adxBearishCross
- **Type**: `adxBearishCross` / Direction: **sell** / Confidence: 55 [D]
- **Trigger**: -DI > +DI 교차 && ADX > 25

### 1-15. Williams %R Signals

| Field | Value |
|-------|-------|
| Detection | `_detectWilliamsRSignals()` line 2700 |
| Indicators | Williams %R(14) |
| Reference | Williams (1979) |

#### williamsROversold
- **Type**: `williamsROversold` / Direction: **buy** / Confidence: 42 [D]
- **Trigger**: %R crosses above -80

#### williamsROverbought
- **Type**: `williamsROverbought` / Direction: **sell** / Confidence: 42 [D]
- **Trigger**: %R crosses below -20

### 1-16. ATR Expansion

| Detection | `_detectATRExpansion()` line 2733 |
|-----------|------|
| Trigger | ATR(14) / MA(ATR, 20) >= 1.5 (진입 시점) |
| Type | `atrExpansion` / Direction: **neutral** / Confidence: 50 [D] |
| Reference | Wilder (1978), Bollinger (2002) |

### 1-17. CUSUM Break

| Detection | `_detectCUSUMBreak()` line 2761 |
|-----------|------|
| Trigger | Online CUSUM breakpoint in recent 20 bars |
| Type | `cusumBreak` / Direction: **neutral** / Confidence: 52 [D] |
| Reference | Page (1954), Inclan & Tiao (1994) |

### 1-18. Volatility Regime Change

| Detection | `_detectVolRegimeChange()` line 2786 |
|-----------|------|
| Reference | Engle (1982), Cont (2001) |

#### volRegimeExpand
- Direction: **neutral** / Confidence: 48 [D]
- Trigger: EWMA vol regime low -> normal/high

#### volRegimeHigh
- Direction: **neutral** / Confidence: 55 [D]
- Trigger: regime enters 'high'

### 1-19. Derivatives/Flow Signals (Phase KRX-API, Doc36-41)

외부 JSON 데이터 기반. 데이터 미로드 시 graceful no-op.

#### basisContango / basisBackwardation
- Detection: `_detectBasisSignal()` line 2409
- Data: `_derivativesData` (derivatives_summary.json)
- Trigger: |basisPct| > 0.5% (normal) or > 2.0% (extreme)
- Reference: Doc27 S5.1, Bessembinder & Seguin (1993)
- Confidence: 55 (weak) / 62 (medium) / 72 (strong/extreme) [D]

#### pcrFearExtreme / pcrGreedExtreme
- Detection: `_detectPCRSignal()` line 2448
- Trigger: PCR > 1.3 (fear, buy) / PCR < 0.5 (greed, sell)
- Reference: Doc37 S6, Pan & Poteshman (2006)
- Confidence: 62 [D]

#### flowAlignedBuy / flowAlignedSell
- Detection: `_detectFlowSignal()` line 2472
- Trigger: 외국인+기관 동반 순매수/매도 (investor_summary.json alignment)
- Reference: Doc39 S6, Choe/Kho/Stulz (2005), LSV (1992)
- Confidence: 65 [D]

#### flowForeignBuy / flowForeignSell
- Trigger: 외국인 20일 누적 순매수/매도 > 5000억원
- Confidence: 58 [D]

#### flowLeadershipBuy / flowLeadershipSell
- Trigger: 외국인 1일 순매수/매도 > 2000억 (weak) / > 5000억 (medium)
- Reference: Kyle (1985), Doc39 S3.2
- Confidence: 62 (weak) / 68 (medium) [D]

#### erpUndervalued / erpOvervalued
- Detection: `_detectERPSignal()` line 2539
- Trigger: ERP = E/P - KTB10Y > 5.5% (buy) / < 1.0% (sell)
- Reference: Doc41 S2, Asness (2003), Damodaran
- Confidence: 60 [D]

#### etfBullishExtreme / etfBearishExtreme
- Detection: `_detectETFSentiment()` line 2573
- Trigger: leverageRatio > 3.0 (역발상 sell) / < 0.3 (역발상 buy)
- Reference: Doc38 S3, Cheng & Madhavan (2009)
- Confidence: 55 [D]

#### shortHighSIR / shortSqueeze
- Detection: `_detectShortInterest()` line 2597
- Trigger: market_short_ratio > 8% / squeeze_candidates exist
- Reference: Doc40 S4-5, Desai et al. (2002), Lamont & Thaler (2003)
- Confidence: 56 / 63 [D]

---

## Part 2: Composite Signals

`COMPOSITE_SIGNAL_DEFS` (line 15): 30개 복합 시그널 정의. 3-Tier 구조.

### Matching Algorithm

`_matchComposites()` (line 2242):
1. 지표 시그널 + 캔들 패턴 -> 통합 type-index 맵 구성
2. 각 COMPOSITE_SIGNAL_DEFS에 대해 required 시그널의 발생 인덱스 기준 윈도우 탐색
3. required 전부 윈도우 내 존재 시 매칭 성공
4. optional 개수 * optionalBonus 가산
5. Dual Confidence: display=min(95, base+bonus), prediction=_predMap 기반 calibrated
6. Platt calibration (`platt_params` from rl_policy.json) 적용 가능

### Tier 1: 강력 (3+ 조건 동시 충족)

| ID | Signal | baseConf | Grade | Required | Optional |
|----|--------|----------|-------|----------|----------|
| strongBuy_hammerRsiVolume | buy | 61 | [C-8] | hammer, rsiOversoldExit | volumeBreakout |
| strongSell_shootingMacdVol | sell | 69 | [C-8] | shootingStar, macdBearishCross | volumeSelloff |
| buy_doubleBottomNeckVol | buy | 68 | [S-5] | doubleBottom, volumeBreakout | goldenCross |
| sell_doubleTopNeckVol | sell | 75 | [E-4] | doubleTop, volumeSelloff | deadCross |
| buy_ichimokuTriple | buy | 70 | [E-4] | ichimokuCloudBreakout, ichimokuBullishCross | volumeBreakout |
| sell_ichimokuTriple | sell | 70 | [E-4] | ichimokuCloudBreakdown, ichimokuBearishCross | volumeSelloff |
| buy_goldenMarubozuVol | buy | 65 | [E-4] | goldenCross, bullishMarubozu | volumeBreakout |
| sell_deadMarubozuVol | sell | 68 | [E-4] | deadCross, bearishMarubozu | volumeSelloff |
| buy_adxGoldenTrend | buy | 67 | [D] | goldenCross, adxBullishCross | volumeBreakout |
| sell_adxDeadTrend | sell | 67 | [D] | deadCross, adxBearishCross | volumeSelloff |
| buy_shortSqueezeFlow | buy | 66 | [D] | shortSqueeze, flowForeignBuy | volumeBreakout |

### Tier 2: 중간 강도

| ID | Signal | baseConf | Grade | Required | Optional |
|----|--------|----------|-------|----------|----------|
| buy_goldenCrossRsi | buy | 58 | [C-8] | goldenCross | rsiOversoldExit, volumeBreakout |
| sell_deadCrossMacd | sell | 58 | [C-8] | deadCross | macdBearishCross, rsiOverboughtExit |
| buy_hammerBBVol | buy | 63 | [E-1] | hammer, bbLowerBounce | volumeBreakout |
| sell_shootingStarBBVol | sell | 69 | [E-1] | shootingStar, bbUpperBreak | volumeSelloff |
| buy_morningStarRsiVol | buy | 58 | [E-1] | morningStar, rsiOversoldExit | volumeBreakout |
| sell_eveningStarRsiVol | sell | 65 | [E-1] | eveningStar, rsiOverboughtExit | volumeSelloff |
| buy_engulfingMacdAlign | buy | 48 | [Audit] | bullishEngulfing, macdBullishCross | maAlignment_bull |
| sell_engulfingMacdAlign | sell | 66 | [E-4] | bearishEngulfing, macdBearishCross | maAlignment_bear |
| buy_flowPcrConvergence | buy | 63 | [D] | flowAlignedBuy | pcrFearExtreme, basisContango |
| sell_flowPcrConvergence | sell | 63 | [D] | flowAlignedSell | pcrGreedExtreme, basisBackwardation |
| buy_cciRsiDoubleOversold | buy | 58 | [D] | cciOversoldExit, rsiOversoldExit | volumeBreakout |
| sell_cciRsiDoubleOverbought | sell | 58 | [D] | cciOverboughtExit, rsiOverboughtExit | volumeSelloff |
| neutral_squeezeExpansion | neutral | 52 | [D] | bbSqueeze, atrExpansion | volumeBreakout |
| buy_cusumKalmanTurn | buy | 55 | [D] | cusumBreak, kalmanUpturn | goldenCross |
| sell_cusumKalmanTurn | sell | 55 | [D] | cusumBreak, kalmanDownturn | deadCross |
| buy_volRegimeOBVAccumulation | buy | 58 | [D] | volRegimeHigh, obvBullishDivergence | volumeBreakout |

### Tier 3: 약한 시그널

| ID | Signal | baseConf | Grade | Required | Optional |
|----|--------|----------|-------|----------|----------|
| buy_bbBounceRsi | buy | 55 | [C-8] | bbLowerBounce | rsiOversold, volumeBreakout |
| sell_bbBreakoutRsi | sell | 55 | [C-8] | bbUpperBreak | rsiOverbought, volumeSelloff |
| buy_wrStochOversold | buy | 48 | [D] | williamsROversold, stochasticOversold | rsiOversoldExit |
| sell_wrStochOverbought | sell | 48 | [D] | williamsROverbought, stochasticOverbought | rsiOverboughtExit |

### Common Constants

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| window | 5 | [D-Heuristic] | 복합 수렴 시간 (봉 수). Nison (1991): "수 세션 내 확인" |
| optionalBonus | 3-5 | [D] | optional 1개당 confidence 가산 |
| composite cap | 95 | [D] | 개별 90 대비 +5 (Bayesian updating, Grinold-Kahn IC) |

---

## Part 3: Divergence Detection

`_detectDivergence()` (line 2099): MACD, RSI 공용 범용 다이버전스 감지.

### Algorithm

1. **Swing point detection**: swingOrder=3, 좌우 3봉 대비 극값 (3-bar look-ahead)
2. **Regular bullish divergence**: 가격 new low + indicator higher low -> buy (conf 70 [D])
3. **Hidden bullish divergence**: 가격 higher low + indicator lower low -> buy (conf 62 [D])
4. **Regular bearish divergence**: 가격 new high + indicator lower high -> sell (conf 68 [D])
5. **Hidden bearish divergence**: 가격 lower high + indicator higher high -> sell (conf 60 [D])

| Constant | Value | Grade | Meaning |
|----------|-------|-------|---------|
| lookback | 40 | [B] | 스윙 탐색 범위 (20->40 확대) |
| swingOrder | 3 | [B] | 스윙 포인트 확인 봉 수 |

### Divergence Signal Types

| Type | Name | Direction | Confidence |
|------|------|-----------|------------|
| macdBullishDivergence | MACD 강세 다이버전스 | buy | 70 [D] |
| macdBearishDivergence | MACD 약세 다이버전스 | sell | 68 [D] |
| macdHiddenBullishDivergence | MACD 히든 강세 | buy | 62 [D] |
| macdHiddenBearishDivergence | MACD 히든 약세 | sell | 60 [D] |
| rsiBullishDivergence | RSI 강세 다이버전스 | buy | 70 [D] |
| rsiBearishDivergence | RSI 약세 다이버전스 | sell | 68 [D] |
| rsiHiddenBullishDivergence | RSI 히든 강세 | buy | 62 [D] |
| rsiHiddenBearishDivergence | RSI 히든 약세 | sell | 60 [D] |

> Buy-sell asymmetry: buy +2pp (KRX 공매도 제한 효과)

---

## Part 4: Signal Statistics

`_calcStats()` (line 2824): 시장 심리 지수 + 시그널 다양성 측정.

### Sentiment Index

- 최근 20봉 내 시그널만 집계 [B]
- `buyWeight += weight`, `sellWeight += |weight|`
- `sentiment = round((buyWeight - sellWeight) / totalWeight * 100)`
- Range: [-100, +100]
- Labels: >= 60 강한 매수 / >= 25 매수 우세 / > -25 중립 / > -60 매도 우세 / else 강한 매도 [D]

### Weight Map (`_weights`)

| Category | Signal | Weight | Grade |
|----------|--------|--------|-------|
| MA | goldenCross | +3 | [D] |
| MA | deadCross | -3 | [D] |
| MA | maAlignment_bull | +2 | [D] |
| MACD | macdBullishCross | +2 | [D] |
| MACD | macdBullishDivergence | +2.5 | [D] |
| RSI | rsiOversold | +1.5 | [D] |
| RSI | rsiOversoldExit | +2.5 | [D] |
| BB | bbLowerBounce | +1.5 | [D] |
| BB | bbUpperBreak | 0 | [ACC] |
| Ichimoku | ichimokuCloudBreakout | +3 | [D] |
| Stochastic | stochasticOversold | +1.5 | [D] |
| Volume | volumeBreakout | +2 | [D] |
| OBV | obvBullishDivergence | +2.5 | [D] |
| Flow | flowAlignedBuy | +2.5 | [D] |
| Derivatives | basisContango | +1.5 | [D] |
| Hurst/Kalman | hurstTrending, kalmanUpturn | 0 | [D] |

### Shannon Entropy (시그널 다양성)

- `H = -sum(p_i * log2(p_i))` over 17 categories
- `entropyNorm = H / log2(active_categories)` -> [0, 1]
- 낮은 entropy = 소수 카테고리 집중 -> confidence 감쇄 근거

### Composite Tier Weighting

| Tier | Weight | Rationale |
|------|--------|-----------|
| 1 | 1.5 | Most crowded -> lowest weight (Lo 2004 AMH) |
| 2 | 2.5 | Medium |
| 3 | 3.5 | Retain alpha -> highest weight |

### Stats Object Structure

```javascript
{
  sentiment: -100~+100,
  sentimentLabel: '강한 매수' / '매수 우세' / '중립' / '매도 우세' / '강한 매도',
  totalSignals: number,
  recentBuy: number, recentSell: number, recentNeutral: number,
  categoryCounts: { ma, macd, rsi, bb, volume, obv, ichimoku, hurst, kalman,
                    stochastic, derivatives, flow, macro, sentiment, composite, adv, volRegime },
  entropy: number, entropyNorm: number,
  advLevel: 0-3, advMultiplier: 0.75-1.10,
  volRegime: 'risk-on'/'neutral'/'risk-off', volRegimeMultiplier: 0.85-1.15,
}
```

---

## Part 5: Post-Processing Filters

`analyze()` 메서드 (line 486) 내에서 개별 시그널 감지 후 순차 적용되는 후처리 필터:

### 5-1. ADX Trend Filter (line 1915)

- 대상: `_ADX_TREND_TYPES` (10종 트렌드 추종 시그널만)
- 방법: Isotonic piecewise-linear interpolation (Barlow et al. 1972)
- Default breakpoints: [[10,-10],[15,-5],[20,0],[25,5],[30,7],[40,10],[50,10]]
- TF-adaptive period: 1m/5m->28, 15m/30m->21, 1h/1d->14 [C]
- Override: `rl_policy.adx_isotonic`

### 5-2. CCI Regime Filter (line 1952)

- 대상: 동일 `_ADX_TREND_TYPES`
- Default breakpoints: [[40,-3],[75,0],[100,0],[150,2],[200,3],[300,3]]
- ADX와 직교적 (r~0.50): 가격 이탈도 vs 방향운동
- Override: `rl_policy.cci_isotonic`

### 5-3. CUSUM Breakpoint Discount (line 1980)

- Page (1954), Roberts (1966)
- 구조적 변동점 근처 전체 시그널 할인
- Discount: 0.70 (변동점) -> 1.0 (30봉 후) 선형 회복
- Volatility-adaptive threshold: `cache.cusum(2.5, lastVolRegime)`

### 5-4. Binary Segmentation Regime Discount (line 2018)

- Bai & Perron (1998)
- 역추세 시그널만 할인 (방향별 선택적)
- Discount: 0.85 (변동점) -> 1.0 (30봉 후)
- CUSUM보다 약함 (0.85 vs 0.70)

### 5-5. OLS Trend Confirmation (line 556)

- Lo & MacKinlay (1999)
- OLS 20-bar: R^2 > 0.50 && 추세 방향 일치 -> +5 boost, cap 90

### 5-6. Cumulative Adjustment Cap (line 570)

- MAX_CUMULATIVE_ADJ = 15 [D-Heuristic]
- ADX+CCI+OLS 스택 인플레이션 방지
- 최종 범위: [10, 90]

### 5-7. Entropy Damping (line 597)

- Shannon (1948): sqrt 기반 점진적 회복
- `scale = 0.80 + 0.20 * sqrt(entropyNorm)` [D]
- entropyNorm=0 -> 0.80, 0.50 -> 0.94, 1.0 -> 1.0

### 5-8. IV/HV Ratio Discount (line 606)

- Doc26 S5.3: IV > HV -> 패턴 신뢰도 감소
- `conf_adj = conf * max(0.50, 1 - 0.20 * max(0, IV/HV - 1))` [C]

### 5-9. VKOSPI/VIX Regime Discount (line 640)

- Doc26 S2.3, Whaley (2000, 2009)
- Fallback chain: VKOSPI -> VIX * 1.12 proxy -> HMM
- Thresholds: <15 low(1.0) / 15-22 normal(0.95) / 22-30 high(0.80) / >30 crisis(0.60) [C]

### 5-10. Options Expiry Discount (line 657)

- Doc27 S4: 매월 둘째 목요일 D-2 ~ D+1
- `conf *= 0.70` [C]

### 5-11. Crisis Severity Discount (line 668)

- Doc28 S1.2, Longin & Solnik (2001)
- VKOSPI + USD/KRW + DXY 종합 -> 0~1 score
- crisis > 0.7: 반전형 패턴 `conf *= 1 - severity * 0.40` [D]

### 5-12. HMM Regime Fallback (line 682)

- VKOSPI/VIX 미가용 시에만 적용 (이중 할인 방지)
- Directional: 레짐 확인 시그널 무감산, 역방향 0.70~1.0
- 30일 staleness gate [D]

---

## Part 6: Auxiliary Modules

### ADV Level (line 2961)

| Level | ADV (억원) | Multiplier | Grade |
|-------|-----------|------------|-------|
| 0 | < 1 | 0.75 | [D] |
| 1 | 1-10 | 0.85 | [D] |
| 2 | 10-100 | 1.00 | [D] |
| 3 | >= 100 | 1.10 | [D] |

Reference: Amihud (2002) ILLIQ, Lo (2004) AMH

### VolRegime (line 3011)

- EWMA long(lambda=0.97) / short(lambda=0.86) 비율
- ratio > 1.2: risk-on (multiplier 1.15)
- ratio < 0.8: risk-off (multiplier 0.85)
- Reference: Carr & Wu (2009)
- Includes VRP calculation when calcVRP/calcHV available

### S/R Proximity Boost (line 730)

- 호출: app.js에서 S/R 가용 시 선택적 적용
- Buy-side support boost: factor=8, ATR 거리 기반 [D-Heuristic]
- Sell-side resistance boost: factor=5 (비대칭: 지지 반등 > 저항 거부)
- Cap: 90

---

## Part 7: [D]-Tagged Constants Summary

All constants tagged [D] or [D-Heuristic] -- no single published academic source.

| Location | Constant | Value | Sensitivity | Notes |
|----------|----------|-------|-------------|-------|
| MA cross | goldenCross conf | 72/60 | Medium | EMA confirm +12pp |
| MA cross | deadCross conf | 70/58 | Medium | Buy-sell asymmetry -2pp |
| MA alignment | bull conf | 65 | Low | Filter role, not standalone |
| MA alignment | bear conf | 63 | Low | |
| MACD cross | bull conf | 70/58 | Medium | 0-line boost |
| MACD cross | bear conf | 68/56 | Medium | |
| RSI | hBase neutral | 55 | High | H unavailable fallback |
| RSI | extremeBonus | floor(abs/10)*2 | Medium | |
| BB | bounce conf | 60 | Medium | |
| BB | break conf | 50 | Low | Direction neutral |
| BB squeeze | durBoost 20봉 | +8 | Low | |
| Volume | confidence log | 50+15*ln(z) | High | z-score->conf mapping |
| Volume | exhaustion conf | 45 | Low | |
| Ichimoku | TK cross conf | 72/65 | Medium | Cloud position +7pp |
| Ichimoku | cloud breakout | 70 | Medium | Chikou +5pp |
| Hurst | regime conf | 55 | Low | R^2 quality gate |
| StochRSI | conf | 48 | Low | RSI neutral zone only |
| StochRSI | cooldown | 5 | Low | Whipsaw prevention |
| Stochastic | BASE_CONF | 52 | Medium | |
| Stochastic | WR_BONUS | 3 | Low | Confluence bonus |
| Kalman | conf | 40 | Low | Composite only (wt=0) |
| CCI | conf | 45 | Low | |
| ADX signals | conf | 55 | Medium | |
| Williams %R | conf | 42 | Low | |
| ATR expansion | conf | 50 | Low | Neutral direction |
| CUSUM break | conf | 52 | Low | |
| VolRegime | conf | 48/55 | Low | |
| Composite | window | 5 | High | All composites |
| Sentiment | labels | 60/25/-25/-60 | Medium | Sentiment thresholds |
| ADV | multipliers | 0.75/0.85/1.0/1.1 | High | Liquidity scaling |
| VolRegime ratio | thresholds | 1.2/0.8 | Medium | Risk-on/off |
| VolRegime | multiplier | 0.85/1.15 | Medium | |
| OLS boost | +5 | Medium | R^2>0.50 gate |
| OLS | R^2 threshold | 0.50 | Medium | Strong trend gate |
| Cumulative adj cap | 15 | High | Stack inflation guard |
| Entropy damping | 0.80 base | Medium | sqrt recovery |
| Crisis severity | threshold | 0.7 | Medium | Reversal discount trigger |
| S/R boost | buy factor | 8 | Medium | Prospect theory |
| S/R boost | sell factor | 5 | Medium | Asymmetric |

**Total [D]-tagged constants: ~45**

Priority for calibration (high sensitivity):
1. Composite window (5) -- all 30 composites affected
2. Volume z-score->conf mapping (50+15*ln)
3. ADV multipliers (0.75/0.85/1.0/1.1)
4. RSI hBase neutral fallback (55)
5. Cumulative adjustment cap (15)
