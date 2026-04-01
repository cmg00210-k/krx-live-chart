# 캔들스틱 & 차트 패턴 레퍼런스 가이드

> 출처: StockCharts.com Dictionary, IG International, TradingView, Investing.com, ATFX, CentralCharts
> 작성일: 2026-03-15

---

## 분류 체계

패턴은 3가지 축으로 분류됩니다:

| 축 | 분류 |
|----|------|
| **구조** | 1봉(Single) · 2봉(Double) · 3봉(Triple) · 5봉+(Multi) |
| **방향** | 강세(Bullish) · 약세(Bearish) · 중립(Neutral) |
| **기능** | 반전(Reversal) · 지속(Continuation) · 불확실(Indecision) |

---

## 전체 패턴 목록 (45종) -- 41종 구현 완료 (91.1%)

> **[2026-03-26 갱신]** Phase D-H에서 13종 추가: longLeggedDoji, spinningTop, bullish/bearishMarubozu, bullish/bearishBeltHold, threeInsideUp/Down, abandonedBabyBullish/Bearish, channel, piercingLine, darkCloud, tweezerBottom/Top.
> **[2026-04-02 갱신]** 구현 현황 전수 점검: 1봉 12/12, 2봉 10/10, 3봉 8/12, 차트 11/11. symmetricTriangle, channel, cupAndHandle 차트 패턴 추가 반영.

### 1봉 패턴 (Single-Candle) -- 12종 (12종 구현, 100%)

| # | 영문명 | 한국명 | 방향 | 기능 | 구현 | 함수명 |
|---|--------|--------|------|------|------|--------|
| 1 | Hammer | 해머 | 강세 | 반전 | **O** | `detectHammer()` |
| 2 | Inverted Hammer | 역해머 | 강세 | 반전 | **O** | `detectInvertedHammer()` |
| 3 | Hanging Man | 교수형 | 약세 | 반전 | **O** | `detectHangingMan()` |
| 4 | Shooting Star | 유성형 | 약세 | 반전 | **O** | `detectShootingStar()` |
| 5 | Doji | 도지 | 중립 | 불확실 | **O** | `detectDoji()` |
| 6 | Dragonfly Doji | 잠자리 도지 | 강세 | 반전 | **O** | `detectDragonflyDoji()` |
| 7 | Gravestone Doji | 비석 도지 | 약세 | 반전 | **O** | `detectGravestoneDoji()` |
| 8 | Long-Legged Doji | 긴다리 도지 | 중립 | 불확실 | **O** | `detectLongLeggedDoji()` |
| 9 | Spinning Top | 팽이형 | 중립 | 불확실 | **O** | `detectSpinningTop()` |
| 10 | Marubozu (Bullish) | 양봉 마루보주 | 강세 | 지속 | **O** | `detectMarubozu()` |
| 11 | Marubozu (Bearish) | 음봉 마루보주 | 약세 | 지속 | **O** | `detectMarubozu()` |
| 12 | Belt Hold | 띠형 | 양방향 | 반전 | **O** | `detectBeltHold()` |

### 2봉 패턴 (Double-Candle) -- 10종 (10종 구현, 100%)

| # | 영문명 | 한국명 | 방향 | 기능 | 구현 | 함수명 |
|---|--------|--------|------|------|------|--------|
| 13 | Bullish Engulfing | 상승 장악형 | 강세 | 반전 | **O** | `detectEngulfing()` |
| 14 | Bearish Engulfing | 하락 장악형 | 약세 | 반전 | **O** | `detectEngulfing()` |
| 15 | Bullish Harami | 상승 잉태형 | 강세 | 반전 | **O** | `detectHarami()` |
| 16 | Bearish Harami | 하락 잉태형 | 약세 | 반전 | **O** | `detectHarami()` |
| 17 | Harami Cross | 잉태 십자형 | 양방향 | 반전 | **O** | `detectHaramiCross()` |
| 18 | Piercing Line | 관통형 | 강세 | 반전 | **O** | `detectPiercingLine()` |
| 19 | Dark Cloud Cover | 먹구름형 | 약세 | 반전 | **O** | `detectDarkCloud()` |
| 20 | Tweezer Top | 족집게 천장 | 약세 | 반전 | **O** | `detectTweezerTop()` |
| 21 | Tweezer Bottom | 족집게 바닥 | 강세 | 반전 | **O** | `detectTweezerBottom()` |
| 22 | Stick Sandwich | 스틱 샌드위치 | 강세 | 반전 | **O** | `detectStickSandwich()` |

### 3봉 패턴 (Triple-Candle) -- 12종 (8종 구현)

| # | 영문명 | 한국명 | 방향 | 기능 | 구현 | 함수명 |
|---|--------|--------|------|------|------|--------|
| 23 | Morning Star | 샛별형 | 강세 | 반전 | **O** | `detectMorningStar()` |
| 24 | Evening Star | 석별형 | 약세 | 반전 | **O** | `detectEveningStar()` |
| 25 | Morning Doji Star | 샛별 도지형 | 강세 | 반전 | -- | -- |
| 26 | Evening Doji Star | 석별 도지형 | 약세 | 반전 | -- | -- |
| 27 | Three White Soldiers | 적삼병 | 강세 | 반전 | **O** | `detectThreeWhiteSoldiers()` |
| 28 | Three Black Crows | 흑삼병 | 약세 | 반전 | **O** | `detectThreeBlackCrows()` |
| 29 | Bullish Abandoned Baby | 강세 버림받은 아기 | 강세 | 반전 | **O** | `detectAbandonedBaby()` |
| 30 | Bearish Abandoned Baby | 약세 버림받은 아기 | 약세 | 반전 | **O** | `detectAbandonedBaby()` |
| 31 | Three Inside Up | 상승 삼내형 | 강세 | 반전 | **O** | `detectThreeInsideUp()` |
| 32 | Three Inside Down | 하락 삼내형 | 약세 | 반전 | **O** | `detectThreeInsideDown()` |
| 33 | Upside Gap Two Crows | 갭상 쌍까마귀 | 약세 | 반전 | -- | -- |
| 34 | Upside/Downside Tasuki Gap | 타스키 갭 | 양방향 | 지속 | -- | -- |

### 차트 패턴 (Multi-Candle Structure) -- 11종 (11종 구현, 100%)

| # | 영문명 | 한국명 | 방향 | 기능 | 구현 | 함수명 |
|---|--------|--------|------|------|------|--------|
| 35 | Double Bottom (W형) | 이중 바닥 | 강세 | 반전 | **O** | `detectDoubleBottom()` |
| 36 | Double Top (M형) | 이중 천장 | 약세 | 반전 | **O** | `detectDoubleTop()` |
| 37 | Head & Shoulders | 머리어깨형 | 약세 | 반전 | **O** | `detectHeadAndShoulders()` |
| 38 | Inverse H&S | 역머리어깨형 | 강세 | 반전 | **O** | `detectInverseHeadAndShoulders()` |
| 39 | Ascending Triangle | 상승 삼각형 | 강세 | 지속 | **O** | `detectAscendingTriangle()` |
| 40 | Descending Triangle | 하락 삼각형 | 약세 | 지속 | **O** | `detectDescendingTriangle()` |
| 41 | Rising Wedge | 상승 쐐기 | 약세 | 반전 | **O** | `detectRisingWedge()` |
| 42 | Falling Wedge | 하락 쐐기 | 강세 | 반전 | **O** | `detectFallingWedge()` |
| 43 | Symmetric Triangle | 대칭 삼각형 | 중립 | 지속 | **O** | `detectSymmetricTriangle()` |
| 44 | Channel | 채널 | 양방향 | 지속 | **O** | `detectChannel()` |
| 45 | Cup and Handle | 컵앤핸들 | 강세 | 지속 | **O** | `detectCupAndHandle()` |

---

## 구현 현황 요약

```
45종 패턴 기준 (2026-04-02 갱신):
  구현 완료:   41종 (91.1%)
  미구현:       4종 (8.9%)

카테고리별:
  1봉 패턴: 12/12 (100.0%) -- longLeggedDoji, spinningTop, marubozu, beltHold 추가
  2봉 패턴: 10/10 (100.0%) -- haramiCross, stickSandwich 추가
  3봉 패턴:  8/12 (66.7%)  -- abandonedBaby, threeInsideUp/Down 추가
  차트 패턴: 11/11 (100.0%) -- symmetricTriangle, channel, cupAndHandle 추가

미구현 4종:
  #25 Morning Doji Star, #26 Evening Doji Star,
  #33 Upside Gap Two Crows, #34 Tasuki Gap

추가 시스템 (45종 외):
  지지/저항선:      detectSupportResistance()
  지표 시그널:      SignalEngine 16종 + 복합 6종
  백테스트:        PatternBacktester
```

---

## 시각적 표시 규칙 (디자인 가이드)

### 색상 체계 -- `js/colors.js` KRX_COLORS 참조

| 요소 | KRX_COLORS 키 | 값 | 용도 |
|------|---------------|-----|------|
| 강세 마커 | `UP` | `#E05050` | 한국식 상승 (매수 시그널) |
| 약세 마커 | `DOWN` | `#5086DC` | 한국식 하락 (매도 시그널) |
| 중립 마커 | `NEUTRAL` | `#ffeb3b` | 도지, 팽이형 등 |
| 패턴 영역 (강세) | `UP_FILL(0.08)` | `rgba(224,80,80,0.08)` | Zone 하이라이트 |
| 패턴 영역 (약세) | `DOWN_FILL(0.08)` | `rgba(80,134,220,0.08)` | Zone 하이라이트 |
| 손절선 | `DOWN_FILL(0.5)` | `rgba(80,134,220,0.5)` | 수평 점선 |
| 목표가선 | `UP_FILL(0.5)` | `rgba(224,80,80,0.5)` | 수평 점선 |
| 구조선/accent | `ACCENT` | `#C9A84C` | 넥라인, 추세선 |

### 마커 규칙

| 시그널 | 위치 | 형태 | 텍스트 |
|--------|------|------|--------|
| 매수(강세) | `belowBar` | `arrowUp` | 없음 (hover tooltip) |
| 매도(약세) | `aboveBar` | `arrowDown` | 없음 |
| 중립 | `aboveBar` | `circle` | 없음 |

### 지표 색상 체계 -- KRX_COLORS 키 매핑

| 지표 | KRX_COLORS 키 | 값 | 계열 |
|------|---------------|-----|------|
| MA 5 (단기) | `MA_SHORT` | `#FF6B6B` | 따뜻한 |
| MA 20 (중기) | `MA_MID` | `#FFD93D` | 따뜻한 |
| MA 60 (장기) | `MA_LONG` | `#6BCB77` | 차가운 |
| EMA 12 | `EMA_12` | `#C77DFF` | 보라 |
| EMA 26 | `EMA_26` | `#7B68EE` | 보라 |
| BB 상한/하한 | `BB` | `#FF8C42` | 주황 |
| BB 중심 | `BB_MID` | `rgba(255,140,66,0.4)` | 주황 |
| 일목 전환선 | `ICH_TENKAN` | `#E040FB` | 핑크 |
| 일목 기준선 | `ICH_KIJUN` | `#00BFA5` | 초록 |
| 일목 SpanA | `ICH_SPANA` | `rgba(129,199,132,0.35)` | 초록 |
| 일목 SpanB | `ICH_SPANB` | `rgba(239,154,154,0.35)` | 빨강 |
| 일목 후행스팬 | `ICH_CHIKOU` | `#78909C` | 회색 |
| 칼만 필터 | `KALMAN` | `#76FF03` | 형광 |
| RSI | `RSI` | `#ff9800` | 주황 (별도차트) |
| MACD 라인 | `MACD_LINE` | `#2962ff` | 파랑 |
| MACD 시그널 | `MACD_SIGNAL` | `#ff9800` | 주황 |

---

## 참고 문헌

- StockCharts.com Candlestick Pattern Dictionary
- Steve Nison, "Japanese Candlestick Charting Techniques" (1991)
- Thomas Bulkowski, "Encyclopedia of Candlestick Charts" (2008)
- TradingView 캔들 패턴 지원 문서
- Investing.com 캔들스틱 패턴 기술 분석
