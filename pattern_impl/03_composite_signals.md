# 03. 캔들+지표 복합 조건 시그널 설계

> 캔들스틱 패턴 단독 시그널에서 지표 조건(MA, MACD, RSI, BB, Volume)을
> 결합하여 신뢰도를 높이는 복합 시그널(Composite Signal)을 체계적으로 정의한다.
>
> 학술 근거: core_data/07 S10 (패턴 조합과 확률), 07 S7 (다요인 품질 점수)

---

## 1. 사용 가능한 지표 조건 (indicators.js 기준)

### 현재 구현된 지표 계산 함수

| 지표 | 함수 | 파라미터 | 출력 | indicators.js 라인 |
|------|------|---------|------|-------------------|
| SMA | `calcMA(data, n)` | n=5,20,60 | 이동평균값 | L9-16 |
| EMA | `calcEMA(data, n)` | n=12,26 | 지수이동평균값 | L19-36 |
| BB | `calcBB(closes, n, mult)` | n=20, mult=2 | {upper, lower, mid} | L39-47 |
| RSI | `calcRSI(closes, period)` | period=14 | 0-100 | L50-71 |
| MACD | `calcMACD(closes, f,s,sig)` | 12,26,9 | {macdLine, signalLine, histogram} | L184-208 |
| ATR | `calcATR(candles, period)` | period=14 | 변동성 | L74-90 |
| Ichimoku | `calcIchimoku(candles)` | 9,26,52,26 | {tenkan,kijun,spanA,spanB,chikou} | L93-125 |
| Kalman | `calcKalman(closes, Q, R)` | Q=0.01, R=1.0 | 평활가격 | L128-146 |
| Hurst | `calcHurst(closes, minWindow)` | minWindow=10 | 0-1 (지수) | L149-181 |

### 지표에서 추출 가능한 조건 (Boolean)

```
MA 조건:
  MA_GOLDEN_CROSS:  MA5 > MA20 (직전에는 MA5 < MA20)
  MA_DEAD_CROSS:    MA5 < MA20 (직전에는 MA5 > MA20)
  PRICE_ABOVE_MA20: close > MA20
  PRICE_BELOW_MA20: close < MA20
  PRICE_ABOVE_MA60: close > MA60
  PRICE_BELOW_MA60: close < MA60
  MA_ALIGNMENT_UP:  MA5 > MA20 > MA60 (정배열)
  MA_ALIGNMENT_DN:  MA5 < MA20 < MA60 (역배열)

MACD 조건:
  MACD_BULL_CROSS:  MACD > Signal (직전에는 MACD < Signal)
  MACD_BEAR_CROSS:  MACD < Signal (직전에는 MACD > Signal)
  MACD_HIST_POS:    histogram > 0
  MACD_HIST_NEG:    histogram < 0
  MACD_HIST_RISING: histogram[i] > histogram[i-1] (가속)
  MACD_HIST_FALLING: histogram[i] < histogram[i-1] (감속)
  MACD_DIVERGENCE:  가격 신고가 + MACD 미달 (약세 다이버전스) 또는 역

RSI 조건:
  RSI_OVERSOLD:     RSI < 30
  RSI_OVERBOUGHT:   RSI > 70
  RSI_LEAVING_OS:   RSI[i-1] < 30 AND RSI[i] >= 30 (과매도 이탈)
  RSI_LEAVING_OB:   RSI[i-1] > 70 AND RSI[i] <= 70 (과매수 이탈)
  RSI_MIDLINE_UP:   RSI crosses above 50
  RSI_MIDLINE_DN:   RSI crosses below 50
  RSI_DIVERGENCE:   가격-RSI 다이버전스

볼린저 밴드 조건:
  BB_LOWER_TOUCH:   low <= BB_lower
  BB_UPPER_TOUCH:   high >= BB_upper
  BB_SQUEEZE:       (BB_upper - BB_lower) / BB_mid < 임계값 (수렴)
  BB_EXPANSION:     밴드 폭 급증
  BB_WALK_UP:       close가 BB_upper 근처에서 지속
  BB_WALK_DN:       close가 BB_lower 근처에서 지속

거래량 조건:
  VOL_SURGE:        volume > VMA20 * 1.5 (50% 이상 급증)
  VOL_SPIKE:        volume > VMA20 * 2.0 (100% 이상 급증)
  VOL_CLIMAX:       volume > VMA20 * 3.0 (역사적 수준)
  VOL_DRY_UP:       volume < VMA20 * 0.5 (급감)

일목균형표 조건:
  ICH_ABOVE_CLOUD:  close > max(spanA, spanB)
  ICH_BELOW_CLOUD:  close < min(spanA, spanB)
  ICH_TK_CROSS_UP:  tenkan > kijun (직전에 tenkan < kijun)
  ICH_TK_CROSS_DN:  tenkan < kijun
```

---

## 2. 복합 시그널 정의 (27종)

### 2.1 강세 복합 시그널 (Bullish Composite) -- 14종

#### CS-B01: 적삼병 + 거래량 급증 + RSI 과매도 이탈
```
조건:
  1. detectThreeWhiteSoldiers() 감지
  2. VOL_SURGE (volume > VMA20 * 1.5)
  3. RSI_LEAVING_OS (RSI가 30 이하에서 30 이상으로)

학술 근거:
  - core_data/07 S10.2: P(반등|적삼병 AND 거래량 AND RSI<30) = 0.82
  - Bulkowski (2008): 거래량 동반 적삼병 승률 74%
  - 04 S1 전망이론: 극단 공포 후 반전 = 강한 매수 심리 전환

신뢰도 배수: x1.3 (기본 신뢰도의 130%)
실전 유용성: ★★★★★ (최고급 매수 시그널)
구현 난이도: 낮음 (모든 지표 이미 계산 가능)
```

#### CS-B02: 해머 + 볼린저 하단 터치 + 거래량 급증
```
조건:
  1. detectHammer() 감지
  2. BB_LOWER_TOUCH (low <= BB_lower)
  3. VOL_SURGE

학술 근거:
  - 06 S3.3: 해머는 매수세 회복의 시각적 표현
  - 04 S6.2: 캔들 아래꼬리 = 매수 주문 흡수력
  - 02: 볼린저 하단 = 2sigma 이격 (통계적 극단)

신뢰도 배수: x1.25
실전 유용성: ★★★★☆
구현 난이도: 낮음
```

#### CS-B03: 상승 장악형 + MACD 골든크로스 + MA 정배열
```
조건:
  1. detectEngulfing() -- bullish
  2. MACD_BULL_CROSS
  3. MA_ALIGNMENT_UP (MA5 > MA20 > MA60)

학술 근거:
  - 07 S4.1: MACD = 대역통과 필터, 교차 = 중기 모멘텀 전환
  - 06 S1.2: MA 정배열 = 다우이론 3단계 추세 정렬
  - 07 S10.4: 합류 구역 CS > 3 = 강한 합류

신뢰도 배수: x1.35
실전 유용성: ★★★★★
구현 난이도: 중간 (MA 배열 판정 로직 추가 필요)
```

#### CS-B04: 샛별형 + RSI 과매도 + 거래량 증가
```
조건:
  1. detectMorningStar() 감지
  2. RSI_OVERSOLD (RSI < 30) at pattern start
  3. VOL_SURGE on 3rd candle

학술 근거:
  - Nison (1991): 샛별형은 바닥 반전의 가장 신뢰할 수 있는 3봉 패턴
  - 07 S3.6: 과매도 후 발생 시 w5(RSI 위치) 가산

신뢰도 배수: x1.3
실전 유용성: ★★★★☆
구현 난이도: 낮음
```

#### CS-B05: 이중 바닥 + 넥라인 돌파 + 거래량 급증
```
조건:
  1. detectDoubleBottom() 감지
  2. close > neckline (넥라인 돌파)
  3. VOL_SPIKE on breakout candle

학술 근거:
  - Bulkowski (2005): 이중바닥 넥라인 돌파 시 목표 달성률 66%
  - 06 S4.1: 목표가 = 넥라인 + 패턴 높이
  - 04 S2.2: 이중바닥 = 닻 효과의 집단적 확인

신뢰도 배수: x1.4
실전 유용성: ★★★★★
구현 난이도: 중간 (돌파 시점 판별 로직 추가)
```

#### CS-B06: 하락 쐐기 + MACD 히스토그램 양전환
```
조건:
  1. detectFallingWedge() 감지
  2. MACD_HIST_POS (히스토그램 0 돌파)
  3. PRICE_ABOVE_MA20

학술 근거:
  - 06 S4.2: 하락 쐐기는 하락 피로 패턴
  - 07 S3.8: 수렴 패턴은 에너지 축적

신뢰도 배수: x1.2
실전 유용성: ★★★★☆
구현 난이도: 중간
```

#### CS-B07: 역머리어깨 + 넥라인 돌파 + MA 지지
```
조건:
  1. detectInverseHeadAndShoulders() 감지
  2. close > neckline
  3. PRICE_ABOVE_MA20 (MA20이 지지선 역할)
  4. VOL_SURGE

학술 근거:
  - Bulkowski (2005): 역머리어깨 성공률 약 70%
  - 06 S4.1: 목표가 = 넥라인 + (넥라인 - 머리 저점)

신뢰도 배수: x1.4
실전 유용성: ★★★★★
구현 난이도: 중간
```

#### CS-B08: 도지 + 하락 추세 + BB 하단 + RSI < 35
```
조건:
  1. detectDoji() at downtrend
  2. BB_LOWER_TOUCH
  3. RSI < 35
  4. 다음 봉 양봉 확인 (confirmation)

학술 근거:
  - 06 S3.3: 도지 = 매수/매도 균형, 추세 전환 가능
  - 04 S4.1: 감정 사이클의 "낙담" 단계

신뢰도 배수: x1.15 (확인 전), x1.35 (양봉 확인 후)
실전 유용성: ★★★☆☆ (확인 필요)
구현 난이도: 중간 (다음 봉 확인 로직)
```

#### CS-B09: 상승 삼각형 + 볼린저 수렴 + 거래량 감소 후 급증
```
조건:
  1. detectAscendingTriangle() 감지
  2. BB_SQUEEZE (밴드 수렴)
  3. VOL_DRY_UP 이후 VOL_SURGE (볼륨 확산)

학술 근거:
  - 06 S4.2: 삼각형 내부 = 에너지 축적, 돌파 시 방출
  - Bollinger (1983): 스퀴즈 후 확장 = 변동성 사이클

신뢰도 배수: x1.3
실전 유용성: ★★★★☆
구현 난이도: 중간 (BB 스퀴즈 감지 로직)
```

#### CS-B10: 일목균형표 삼역호전 (가격+전환선+후행)
```
조건:
  1. ICH_ABOVE_CLOUD (가격이 구름 위)
  2. ICH_TK_CROSS_UP (전환선 > 기준선)
  3. chikou > 26일 전 가격

학술 근거:
  - 06 S7.3: 일목 삼역호전 = 가장 강한 매수 시그널
  - 호소다 고이치 (1968): 3개 조건 동시 충족 시 강한 상승 전망

신뢰도 배수: x1.4
실전 유용성: ★★★★☆ (일봉 기준)
구현 난이도: 중간 (Ichimoku 데이터 활용)
```

#### CS-B11: 골든크로스 (MA5/MA20) + 양봉 마루보주
```
조건:
  1. MA_GOLDEN_CROSS (MA5가 MA20 상방 돌파)
  2. 당일봉이 양봉 마루보주 (꼬리 < body*0.02)
  3. VOL_SURGE

학술 근거:
  - Murphy (1999): 골든크로스 = 단기/중기 모멘텀 동시 전환
  - Nison (1991): 마루보주 = 극도의 매수/매도 압력

신뢰도 배수: x1.25
실전 유용성: ★★★★☆
구현 난이도: 낮음 (마루보주 탐지 + MA 교차 감지)
```

#### CS-B12: 칼만 필터 상향 전환 + 해머
```
조건:
  1. Kalman[i] > Kalman[i-1] (칼만 상향 전환)
  2. Kalman[i-1] < Kalman[i-2] (직전 하향)
  3. detectHammer() 감지

학술 근거:
  - 10 S4.3: 칼만 필터 = 최적 노이즈 제거 추정기
  - 이동평균보다 적응적이고 수학적으로 최적

신뢰도 배수: x1.15
실전 유용성: ★★★☆☆ (실험적)
구현 난이도: 낮음
```

#### CS-B13: 허스트 지수 > 0.6 + 추세 상승 + 적삼병
```
조건:
  1. Hurst > 0.6 (추세 지속 가능성 높음)
  2. _detectTrend() direction = 'up'
  3. detectThreeWhiteSoldiers()

학술 근거:
  - 03: H > 0.5 = 추세 지속(영속성), H < 0.5 = 평균 회귀
  - 적삼병이 추세 지속 구간에서 발생하면 신뢰도 상승

신뢰도 배수: x1.2
실전 유용성: ★★★☆☆ (연구 가치)
구현 난이도: 낮음 (calcHurst 이미 존재)
```

#### CS-B14: RSI 다이버전스 + 장악형
```
조건:
  1. 가격이 신저가 갱신 BUT RSI는 이전 저점보다 높음 (강세 다이버전스)
  2. detectEngulfing() -- bullish

학술 근거:
  - Wilder (1978): RSI 다이버전스 = 가격-모멘텀 괴리
  - Murphy (1999): 다이버전스 = 추세 약화의 선행 지표

신뢰도 배수: x1.35
실전 유용성: ★★★★★
구현 난이도: 높음 (다이버전스 알고리즘 구현 필요)
```

---

### 2.2 약세 복합 시그널 (Bearish Composite) -- 13종

> 강세 시그널의 대칭 구조. 핵심 차이점만 기술한다.

#### CS-S01: 흑삼병 + 거래량 급증 + RSI 과매수 이탈
```
조건: 흑삼병 + VOL_SURGE + RSI_LEAVING_OB
학술 근거: CS-B01의 대칭. 07 S10.2: 조건부 확률 상승
신뢰도 배수: x1.3, 실전: ★★★★★, 난이도: 낮음
```

#### CS-S02: 유성형 + 볼린저 상단 터치 + 거래량 급증
```
조건: 유성형 + BB_UPPER_TOUCH + VOL_SURGE
학술 근거: CS-B02의 대칭
신뢰도 배수: x1.25, 실전: ★★★★☆, 난이도: 낮음
```

#### CS-S03: 하락 장악형 + MACD 데드크로스 + MA 역배열
```
조건: Bearish Engulfing + MACD_BEAR_CROSS + MA_ALIGNMENT_DN
신뢰도 배수: x1.35, 실전: ★★★★★, 난이도: 중간
```

#### CS-S04: 석별형 + RSI 과매수 + 거래량 증가
```
조건: Evening Star + RSI > 70 + VOL_SURGE (3rd candle)
신뢰도 배수: x1.3, 실전: ★★★★☆, 난이도: 낮음
```

#### CS-S05: 이중 천장 + 넥라인 하향 돌파 + 거래량 급증
```
조건: Double Top + close < neckline + VOL_SPIKE
신뢰도 배수: x1.4, 실전: ★★★★★, 난이도: 중간
```

#### CS-S06: 상승 쐐기 + MACD 히스토그램 음전환
```
조건: Rising Wedge + MACD_HIST_NEG
신뢰도 배수: x1.2, 실전: ★★★★☆, 난이도: 중간
```

#### CS-S07: 머리어깨 + 넥라인 하향 돌파 + MA 하회
```
조건: H&S + close < neckline + PRICE_BELOW_MA20
신뢰도 배수: x1.4, 실전: ★★★★★, 난이도: 중간
```

#### CS-S08: 도지 + 상승 추세 + BB 상단 + RSI > 65
```
조건: Doji at uptrend + BB_UPPER_TOUCH + RSI > 65
신뢰도 배수: x1.15/x1.35, 실전: ★★★☆☆, 난이도: 중간
```

#### CS-S09: 하락 삼각형 + 볼린저 수렴 + 거래량 급증
```
조건: Descending Triangle + BB_SQUEEZE then VOL_SURGE
신뢰도 배수: x1.3, 실전: ★★★★☆, 난이도: 중간
```

#### CS-S10: 일목균형표 삼역역전 (가격+전환선+후행)
```
조건: ICH_BELOW_CLOUD + ICH_TK_CROSS_DN + chikou < 26일 전 가격
신뢰도 배수: x1.4, 실전: ★★★★☆, 난이도: 중간
```

#### CS-S11: 데드크로스 (MA5/MA20) + 음봉 마루보주
```
조건: MA_DEAD_CROSS + Bearish Marubozu + VOL_SURGE
신뢰도 배수: x1.25, 실전: ★★★★☆, 난이도: 낮음
```

#### CS-S12: 칼만 필터 하향 전환 + 유성형
```
조건: Kalman 하향 전환 + Shooting Star
신뢰도 배수: x1.15, 실전: ★★★☆☆, 난이도: 낮음
```

#### CS-S13: RSI 약세 다이버전스 + 하락 장악형
```
조건: 가격 신고가 BUT RSI 미갱신 + Bearish Engulfing
신뢰도 배수: x1.35, 실전: ★★★★★, 난이도: 높음
```

---

## 3. 복합 시그널 구현 우선순위

### 우선순위 A -- 즉시 구현 (기존 코드만으로 가능)

| # | 시그널 | 필요 추가 코드 | 효과 |
|---|--------|-------------|------|
| CS-B01 | 적삼병+Volume+RSI | RSI 계산을 analyze()에 추가 | 최고급 |
| CS-S01 | 흑삼병+Volume+RSI | 위와 동일 | 최고급 |
| CS-B02 | 해머+BB+Volume | BB 계산을 analyze()에 추가 | 높음 |
| CS-S02 | 유성형+BB+Volume | 위와 동일 | 높음 |
| CS-B04 | 샛별형+RSI+Volume | RSI 참조 | 높음 |
| CS-S04 | 석별형+RSI+Volume | RSI 참조 | 높음 |

**구현 방법**: `analyze()` 함수에서 지표를 미리 계산하여 `ctx` 객체에 추가:
```javascript
// analyze() 내부
const closes = candles.map(c => c.close);
const ctx = {
  atr: this._calcATR(candles),
  vma: this._calcVolumeMA(candles),
  rsi: calcRSI(closes),           // 추가
  bb: calcBB(closes),             // 추가
  macd: calcMACD(closes),         // 추가
  ma5: calcMA(closes, 5),         // 추가
  ma20: calcMA(closes, 20),       // 추가
  ma60: calcMA(closes, 60),       // 추가
};
```

### 우선순위 B -- 단기 구현 (조건 판별 함수 추가 필요)

| # | 시그널 | 필요 추가 코드 |
|---|--------|-------------|
| CS-B03/S03 | 장악형+MACD+MA정/역배열 | MA 배열 판정, MACD 교차 감지 |
| CS-B05/S05 | 이중바닥/천장+넥라인돌파 | 돌파 시점 판별 |
| CS-B10/S10 | 일목 삼역호전/역전 | Ichimoku 데이터를 ctx에 추가 |
| CS-B11/S11 | 골든/데드크로스+마루보주 | MA 교차 감지, 마루보주 판별 |

### 우선순위 C -- 중기 구현 (새 알고리즘 필요)

| # | 시그널 | 필요 추가 코드 |
|---|--------|-------------|
| CS-B14/S13 | RSI 다이버전스 | 스윙포인트 간 가격-RSI 비교 |
| CS-B09/S09 | BB 스퀴즈 감지 | 밴드 폭 추적, 임계값 설정 |
| CS-B06/S06 | 쐐기+MACD 히스토그램 | 차트 패턴+시계열 조합 |

---

## 4. 신뢰도 보정 수식

### 현재 시스템의 품질 점수 (patterns.js L73-76)
```javascript
_quality({ body, volume, trend, shadow, extra }) {
  const raw = 0.25*body + 0.25*volume + 0.20*trend + 0.15*shadow + 0.15*extra;
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}
```

### 제안: 복합 시그널 보정 (Composite Boost)
```javascript
_compositeBoost(baseConfidence, indicators) {
  let boost = 0;

  // RSI 위치 보정
  if (indicators.rsiOversold && signal === 'buy')  boost += 8;
  if (indicators.rsiOverbought && signal === 'sell') boost += 8;

  // MACD 교차 보정
  if (indicators.macdBullCross && signal === 'buy')  boost += 10;
  if (indicators.macdBearCross && signal === 'sell') boost += 10;

  // 볼린저 밴드 위치 보정
  if (indicators.bbLowerTouch && signal === 'buy')  boost += 6;
  if (indicators.bbUpperTouch && signal === 'sell') boost += 6;

  // MA 정/역배열 보정
  if (indicators.maAlignmentUp && signal === 'buy')   boost += 7;
  if (indicators.maAlignmentDown && signal === 'sell') boost += 7;

  // 거래량 급증 보정
  if (indicators.volumeSurge) boost += 5;
  if (indicators.volumeSpike) boost += 8;

  // 다이버전스 보정 (최고 가산)
  if (indicators.rsiDivergence) boost += 12;

  return Math.min(100, baseConfidence + boost);
}
```

학술 근거: core_data/07 S10.2
- P(반등|적삼병) = 0.66
- P(반등|적삼병+거래량) = 0.74 -> +8% boost
- P(반등|적삼병+거래량+RSI<30) = 0.82 -> +8% 추가 boost
- 총 +16% -> 연속적 조건부 확률 상승의 선형 근사

---

## 5. KRX 시장 특수 조건

### 가격제한폭 (서킷브레이커)
```
KOSPI/KOSDAQ: +/-30% 일일 가격제한
영향:
  - 갭 패턴(버림받은 아기, 타스키 갭) 발생 빈도 감소
  - 마루보주 상한가/하한가 도달 시 특수 처리 필요
  - 상한가/하한가 도달 봉은 일반 패턴 분석에서 제외 권장
```

### 장 시간 구조
```
정규장: 09:00-15:30
동시호가: 08:30-09:00, 15:20-15:30
영향:
  - 시가와 종가에 동시호가 효과 반영
  - 분봉 패턴에서 09:00 첫 봉과 15:20 마지막 봉 특수 처리
  - 일봉 기준 분석이 가장 안정적
```

### 한국 시장 심리 특성
```
개인 투자자 비중 높음:
  - 처분효과가 더 강하게 나타남 (04 S1.3)
  - 심리적 가격대(만원 단위, 5,000원 단위) 지지/저항 강도 높음
  - 테마주/작전주에서 패턴 신뢰도 하락 (학술 근거: 04 S3.3)

권장:
  - 시가총액 상위 종목에서 패턴 신뢰도 높음
  - 거래량 < VMA20*0.3인 저유동성 종목 필터링
  - KOSPI 200 종목 기준 백테스팅 후 파라미터 캘리브레이션
```
