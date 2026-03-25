# 06. 기술적 분석 이론 — Technical Analysis Theory

> 기술적 분석의 세 가지 전제:
> 1. 시장 가격은 모든 것을 반영한다 (Market discounts everything)
> 2. 가격은 추세를 따라 움직인다 (Prices move in trends)
> 3. 역사는 반복된다 (History repeats itself)

---

## 1. 다우 이론 (Dow Theory)

### 1.1 기원

Charles H. Dow (1851-1902), Wall Street Journal 편집장
원전: WSJ 사설 (1900-1902) — 생전에 체계적 저서를 남기지 않음
체계화: William P. Hamilton, *The Stock Market Barometer* (1922)
정리: Robert Rhea, *The Dow Theory* (1932)

### 1.2 6대 원칙

```
1. 시장 평균(지수)은 모든 것을 반영한다
   → "가격에는 모든 정보가 포함되어 있다"

2. 시장에는 세 가지 추세가 있다
   → 주추세 (Primary Trend): 1년~수년
   → 중간추세 (Secondary Trend): 3주~3개월
   → 단기추세 (Minor Trend): 3주 미만

3. 주추세는 세 단계로 진행된다
   → 축적 단계 (Accumulation): 현명한 투자자의 매수
   → 참여 단계 (Public Participation): 추세 추종자 합류
   → 분배 단계 (Distribution): 현명한 투자자의 매도

4. 지수들은 서로 확인해야 한다
   → 산업지수와 운송지수가 동시에 신호 → 신뢰도 높음

5. 거래량이 추세를 확인한다
   → 상승 추세 + 거래량 증가 = 건강한 추세
   → 상승 추세 + 거래량 감소 = 추세 약화 경고

6. 추세는 명확한 반전 신호가 나올 때까지 지속된다
   → "Trend is your friend until it ends"
```

### 1.3 현대적 해석

시스템 매핑:
- 주추세 → 일봉 차트의 이동평균(MA60) 방향
- 중간추세 → 1시간봉의 추세
- 단기추세 → 1분봉의 움직임
- 거래량 확인 → vol 지표의 추세 동반 여부

---

## 2. 엘리엇 파동 이론 (Elliott Wave Theory)

### 2.1 기원

Ralph Nelson Elliott (1938), *The Wave Principle*
확장: A.J. Frost & Robert Prechter, *Elliott Wave Principle* (1978)

### 2.2 기본 구조

```
임펄스 파동 (Impulse Wave): 추세 방향 — 5파
  Wave 1: 초기 상승
  Wave 2: 되돌림 (1파의 100% 미만)
  Wave 3: 가장 강한 상승 (1파의 161.8% 이상)
  Wave 4: 되돌림 (1파의 고점 이하로 하락 불가)
  Wave 5: 최종 상승

수정 파동 (Corrective Wave): 추세 반대 — 3파 (A-B-C)
  Wave A: 초기 하락
  Wave B: 되돌림
  Wave C: 최종 하락 (A파와 비슷한 크기)

전체 사이클: 5파 상승 + 3파 하락 = 8파
```

### 2.3 피보나치 관계

```
피보나치 수열: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ...
황금비: φ = (1+√5)/2 ≈ 1.618

주요 비율:
  23.6% = 1 - 0.618²
  38.2% = 1 - 0.618
  50.0% = 중간값
  61.8% = 0.618 (황금비의 역수)
  78.6% = √0.618
  100.0%
  161.8% = 1.618
  261.8% = 1.618²
```

파동 간 비율:
- Wave 2 되돌림: 50% 또는 61.8%
- Wave 3 확장: 161.8% (가장 흔함), 261.8%
- Wave 4 되돌림: 23.6% 또는 38.2%
- Wave 5: Wave 1과 같거나 61.8%

### 2.4 비판과 한계

학문적 비판:
- 파동 카운팅이 주관적 (같은 차트를 다르게 해석 가능)
- 사후적 설명은 쉬우나 사전 예측은 어려움
- 통계적 검증이 부족

그럼에도 피보나치 되돌림/확장 수준은 실무에서 널리 사용되며,
자기실현적 예언(self-fulfilling prophecy)으로서 기능.

---

## 3. 캔들스틱 이론 (Japanese Candlestick Theory)

### 3.1 기원

혼마 무네히사(本間宗久, 1724-1803), 일본 도지마 쌀 거래소
서양 소개: Steve Nison, *Japanese Candlestick Charting Techniques* (1991)

### 3.2 기본 캔들 해부학

```
    │  ← 윗꼬리 (Upper Shadow/Wick)
   ┌┤
   │├  ← 몸통 (Body): 시가-종가 사이
   └┤
    │  ← 아래꼬리 (Lower Shadow/Wick)

양봉 (Bullish): 종가 > 시가 → 초록/흰색
음봉 (Bearish): 종가 < 시가 → 빨간/검정
```

### 3.3 단일 캔들 패턴

```
┌ 해머 (Hammer): 하락 추세 말기
│ - 작은 몸통 + 긴 아래꼬리 (몸통의 2배+)
│ - 심리: 매도세가 밀어냈으나 매수세가 회복
│ - 신호: 반전 가능 (확인 필요)
│
├ 역해머 (Inverted Hammer): 하락 추세 말기
│ - 작은 몸통 + 긴 윗꼬리
│ - 심리: 매수 시도가 있었으나 아직 완전하지 않음
│
├ 유성형 (Shooting Star): 상승 추세 말기
│ - 역해머의 거울상 → 하락 반전
│
├ 도지 (Doji): 시가 ≈ 종가
│ - 심리: 매수/매도 균형 → 불확실성
│ - 추세 전환 가능성 → 다음 봉으로 확인
│
├ 마루보즈 (Marubozu): 꼬리 없는 큰 몸통
│ - 양봉 마루보즈: 극도의 매수 압력
│ - 음봉 마루보즈: 극도의 매도 압력
│
└ 스피닝 탑 (Spinning Top): 작은 몸통 + 양쪽 꼬리
  - 도지와 유사하나 약간의 몸통 존재
  - 우유부단, 추세 약화
```

### 3.4 다중 캔들 패턴 (시스템 구현 매핑)

**반전 패턴 (Reversal)**:

| 패턴 | 봉수 | 신호 | 시스템 함수 |
|------|------|------|------------|
| 적삼병 (Three White Soldiers) | 3 | 강한 매수 | detectThreeWhiteSoldiers() |
| 흑삼병 (Three Black Crows) | 3 | 강한 매도 | detectThreeBlackCrows() |
| 장악형 (Engulfing) | 2 | 강한 반전 | detectEngulfing() |
| 샛별형 (Morning Star) | 3 | 매수 | detectMorningStar() |
| 석별형 (Evening Star) | 3 | 매도 | detectEveningStar() |
| 관통형 (Piercing Line) | 2 | 매수 | 미구현 |
| 먹구름형 (Dark Cloud Cover) | 2 | 매도 | 미구현 |
| 집게형 (Tweezer Top/Bottom) | 2 | 반전 | 미구현 |

**지속 패턴 (Continuation)**:
| 패턴 | 의미 |
|------|------|
| 상승/하락 삼법 (Rising/Falling Three Methods) | 추세 지속 확인 |
| 나란히 선 양봉/음봉 (Side-by-Side Lines) | 추세 지속 |
| 분리선 (Separating Lines) | 추세 재개 |

### 3.5 캔들스틱의 통계적 검증

Caginalp & Laurent (1998), *The Predictive Power of Price Patterns*:
캔들스틱 패턴이 통계적으로 유의한 예측력을 가짐을 실증

Morris (2006), *Candlestick Charting Explained*:
패턴별 승률과 기대수익 통계 제공

---

## 4. 차트 패턴 (Chart Patterns)

### 4.1 반전 패턴

```
머리어깨형 (Head and Shoulders):
  ┌─┐
  │ │     ← 머리 (Head)
┌─┘ └─┐
│      │  ← 어깨 (Shoulders)
└──────┘
  넥라인 (Neckline)

목표가 = 넥라인 - (머리높이 - 넥라인)
성공률: 약 70% (Bulkowski 연구)

이중 바닥 (Double Bottom, W형):
      ┌─┐
      │ │
──┐ ┌─┘ └──
  │ │
  └─┘

이중 천장 (Double Top, M형):
  ┌─┐
  │ │
──┘ └─┐ ┌──
      │ │
      └─┘
```

### 4.2 지속 패턴

```
상승 삼각형 (Ascending Triangle):
──────── 저항선 (수평)
  /
 /   지지선 (상승)
/

→ 상방 돌파 확률: 약 64% (Bulkowski)

대칭 삼각형 (Symmetrical Triangle):
\
 \   /
  \/

→ 기존 추세 방향으로 돌파 확률: 약 54%

깃발형 (Flag):
급등 후 하향 채널 → 이전 추세 지속
기대 목표가 = 깃대 길이

쐐기형 (Wedge):
상승 쐐기 (Rising Wedge): 하락 반전
하락 쐐기 (Falling Wedge): 상승 반전
```

참고: Thomas Bulkowski, *Encyclopedia of Chart Patterns* (2005)
→ 700+ 페이지, 53종 패턴의 통계적 성과 분석

---

## 5. 지지와 저항 (Support & Resistance)

### 5.1 이론적 기반

```
지지선 (Support): 매수 압력이 매도 압력을 초과하는 가격대
  → 수요 집중 → 가격 하락 저지

저항선 (Resistance): 매도 압력이 매수 압력을 초과하는 가격대
  → 공급 집중 → 가격 상승 저지

역할 전환 원칙:
  돌파된 지지선 → 저항선으로 전환
  돌파된 저항선 → 지지선으로 전환
```

### 5.2 심리적 근거

- 닻 효과: 과거 가격이 미래 의사결정의 참조점
- 처분효과: 과거 매수가 부근에서 "본전 심리" 매도
- 집단 기억: 시장 참여자들이 특정 가격대를 기억

### 5.3 수학적 탐지 방법

```
방법 1: 스윙 포인트
  - 현재 시스템: findSwingHighs(), findSwingLows()
  - N개 봉 전후보다 높은/낮은 가격 = 피봇 포인트

방법 2: 거래량 프로파일 (Volume Profile)
  - 가격 구간별 거래량 히스토그램
  - 거래량 최대 구간 = 가장 강한 지지/저항 (POC)

방법 3: 클러스터링
  - 유사한 가격의 피봇 포인트를 군집화
  - DBSCAN 또는 K-means 알고리즘 활용
```

---

## 6. 추세 이론 (Trend Theory)

### 6.1 추세의 정의

```
상승 추세: 점진적으로 높아지는 고점과 저점
  HH > HH' (Higher High)
  HL > HL' (Higher Low)

하락 추세: 점진적으로 낮아지는 고점과 저점
  LH < LH' (Lower High)
  LL < LL' (Lower Low)

횡보 (Range): 고점과 저점이 수평
```

### 6.2 추세 강도 측정

**ADX (Average Directional Index)**:
J. Welles Wilder (1978)

```
+DI = 100 × EMA(+DM) / ATR
-DI = 100 × EMA(-DM) / ATR
DX = 100 × |+DI - -DI| / (+DI + -DI)
ADX = EMA(DX, 14)

ADX < 20: 추세 없음 (횡보)
ADX 20-40: 추세 존재
ADX > 40: 강한 추세
ADX > 60: 매우 강한 추세
```

**Aroon 지표**:
Tushar Chande (1995)

```
Aroon Up = 100 × (n - 최근 n봉 내 최고가까지의 거리) / n
Aroon Down = 100 × (n - 최근 n봉 내 최저가까지의 거리) / n
```

---

## 7. 일목균형표 (Ichimoku Kinko Hyo)

### 7.1 기원

호소다 고이치(細田悟一, 1898-1982), 필명: 一目山人
1936년 고안, 1968년 출판 *一目均衡表*

### 7.2 5개 구성요소

```
전환선 (Tenkan-sen) = (9일 최고 + 9일 최저) / 2
기준선 (Kijun-sen) = (26일 최고 + 26일 최저) / 2
선행스팬A (Senkou Span A) = (전환선 + 기준선) / 2  → 26일 미래 시프트
선행스팬B (Senkou Span B) = (52일 최고 + 52일 최저) / 2  → 26일 미래 시프트
후행스팬 (Chikou Span) = 현재 종가  → 26일 과거 시프트

구름 (Kumo) = 선행스팬A와 선행스팬B 사이의 영역
```

### 7.3 매매 신호

```
기본 신호:
  가격 > 구름: 강세
  가격 < 구름: 약세
  가격 ∈ 구름: 중립

교차 신호:
  전환선 > 기준선: 매수 (TK Cross)
  전환선 < 기준선: 매도

구름 색상:
  선행A > 선행B: 강세 구름 (초록)
  선행A < 선행B: 약세 구름 (빨강)

후행스팬:
  후행 > 26일 전 가격: 강세 확인
```

구현 난이도: 중간. 향후 chart.js에 추가 가능한 고도화 후보.

---

## 핵심 정리: 기술적 분석 이론 계보

```
1900 다우 이론 (Charles Dow)
 │
1930 엘리엇 파동 이론 (R.N. Elliott)
 │
1936 일목균형표 (호소다 고이치)
 │
1948 기술적 분석의 체계화 (Edwards & Magee)
 │
1978 RSI, ATR, ADX, 파라볼릭 SAR (J.W. Wilder)
 │
1980 MACD (Gerald Appel)
 │
1983 볼린저 밴드 (John Bollinger)
 │
1991 캔들스틱 서양 도입 (Steve Nison)
 │
2000 자동 패턴 인식 (Lo, Mamaysky & Wang)
 │
현재 머신러닝 기반 패턴 인식 + 경제물리학 결합
```

---

## 8. 보조 오실레이터 지표 6종 (Sub-Chart Indicators)

> 시스템에 구현된 6종의 보조 지표에 대한 학술 근거와 수식.
> 기존 지표(MA, EMA, BB, RSI, ATR, ADX, MACD, Ichimoku)는 §1-7에 기술.

### 8.1 스토캐스틱 오실레이터 (Stochastic Oscillator)

**창시자**: George C. Lane (1950s), 시카고 선물 트레이더

Lane의 핵심 통찰: "스토캐스틱은 가격 자체가 아니라 모멘텀을 추적한다.
가격이 반전하기 전에 모멘텀이 먼저 방향을 바꾼다."
(Lane, G.C. (1984), *Lane's Stochastics*, Technical Analysis of Stocks & Commodities, 2(3), 87-90)

```
수식:
  Raw %K = (Close - Lowest_Low(n)) / (Highest_High(n) - Lowest_Low(n)) * 100
  %K = SMA(Raw %K, smooth)     (smooth=3: Slow Stochastic, smooth=1: Fast)
  %D = SMA(%K, dPeriod)        (dPeriod=3)

매개변수 기본값:
  n = 14 (룩백 기간)
  smooth = 3 (Slow Stochastic)
  dPeriod = 3

해석:
  %K > 80: 과매수 (overbought)
  %K < 20: 과매도 (oversold)
  %K가 %D 상향 교차: 매수 신호
  %K가 %D 하향 교차: 매도 신호
```

이론적 근거:
- 상승 추세에서 종가는 거래 범위의 상단에, 하락 추세에서는 하단에 위치하는 경향
- 이 경향이 약해지는 것이 추세 전환의 선행 신호
- Murphy (1999), *Technical Analysis of the Financial Markets*, pp. 246-258

코드 매핑: `js/indicators.js:411-456` (`calcStochastic()`)
엔진 적용 효과: 서브차트로 모멘텀 과매수/과매도 상태를 시각화, 추세 전환 선행 탐지

파라미터 원전 일치 확인 (M10):
```
  코드 기본값:  kPeriod=14, dPeriod=3, smooth=3  (Slow Stochastic)
  Lane 원전:    n=14, %D smooth=3

  Lane (1984), Technical Analysis of Stocks & Commodities, 2(3):
    Lane이 사용한 표준 설정은 14일 룩백 + 3일 평활이다.
    Fast Stochastic (smooth=1)은 노이즈가 과도하여 실무에서 Slow를 권장.

  Murphy (1999), p.248: "대부분의 트레이더는 Slow Stochastic을 사용하며,
    %K 기간은 보통 14일, %D는 3일 평활이다."

  등급: B등급 (원전 기본값과 정확히 일치)
```

### 8.2 스토캐스틱 RSI (Stochastic RSI)

**창시자**: Tushar S. Chande & Stanley Kroll (1994)
*The New Technical Trader*, John Wiley & Sons

RSI에 스토캐스틱 공식을 적용하여 RSI의 민감도를 극대화한 지표.

```
수식:
  StochRSI = (RSI - min(RSI, stochPeriod)) / (max(RSI, stochPeriod) - min(RSI, stochPeriod))
  K = SMA(StochRSI * 100, kPeriod)
  D = SMA(K, dPeriod)

매개변수 기본값:
  rsiPeriod = 14
  stochPeriod = 14
  kPeriod = 3
  dPeriod = 3

해석:
  StochRSI는 0~100 범위에서 RSI보다 빠르게 반응
  RSI가 40~60 범위에 머물 때도 StochRSI는 0 또는 100에 도달 가능
  → RSI 단독으로는 포착하기 어려운 미세 모멘텀 변화 탐지
```

학술적 배경:
- Chande (1997), *Beyond Technical Analysis*, John Wiley & Sons
  -- 적응형 지표 설계 철학: "지표의 지표"로 2차 파생 정보 추출
- RSI 자체는 Wilder (1978)가 고안. StochRSI는 RSI의 상대적 위치를 정규화함으로써
  횡보 구간에서도 신호 생성이 가능하도록 개선

코드 매핑: `js/indicators.js:468-532` (`calcStochRSI()`)

파라미터 원전 일치 확인 (M10):
```
  코드 기본값:  rsiPeriod=14, stochPeriod=14, kPeriod=3, dPeriod=3
  Chande & Kroll (1994) 원전: RSI 14, Stoch 14, K=3, D=3

  Chande의 원전 설정과 정확히 일치.
  등급: B등급 (원전 기본값 일치)
```
엔진 적용 효과: RSI가 중립 구간에 머물 때도 과매수/과매도 탐지 가능, 횡보 장세 대응력 강화

### 8.3 CCI (Commodity Channel Index)

**창시자**: Donald R. Lambert (1980)
*Commodity Channel Index: Tools for Trading Cyclical Trends*,
Commodities (현 Futures) Magazine, October 1980

원래 상품 선물의 주기적 추세를 탐지하기 위해 설계되었으나,
현재는 주식, 외환 등 모든 자산에 범용 적용.

```
수식:
  Typical Price (TP) = (High + Low + Close) / 3
  SMA_TP = SMA(TP, period)
  Mean Deviation = (1/period) * SUM(|TP_i - SMA_TP|)  (i = 1..period)
  CCI = (TP - SMA_TP) / (0.015 * Mean Deviation)

매개변수 기본값:
  period = 20

0.015 상수의 근거:
  Lambert는 CCI 값의 약 70-80%가 +/-100 범위에 들어오도록 설계.
  정규분포 가정 하에서 Mean Deviation ≈ 0.7979 * sigma 이므로,
  CCI = (TP - mu) / (0.015 * 0.7979 * sigma) ≈ (TP - mu) / (0.01197 * sigma)
  즉 CCI ≈ 83.5 * z-score. |z| < 1.2 (약 77%)일 때 |CCI| < 100.
  → 0.015는 원저자 Lambert가 의도적으로 설계한 스케일링 상수.

0.015 등급 평가:
  Lambert (1980), Commodities Magazine, October 1980 원전:
    "이 상수(0.015)는 CCI 값의 약 70-80%가 -100에서 +100 사이에
    위치하도록 선택되었다."
  → 원저자의 설계 의도가 명확하고, 수학적 근사 정당화가 존재.
  → 모든 주요 플랫폼(TradingView, Bloomberg, 키움HTS)이 0.015를 사용.
  등급: B등급 (원저자 설계 의도가 명확한 관행적 표준.
  D등급이 아닌 B등급인 이유: 근사적이지만 합리적 도출 과정이 존재하며,
  업계 전체가 동일 상수를 사용하는 사실상의 표준.)
```

해석:
- CCI > +100: 강한 상승 추세 진입
- CCI < -100: 강한 하락 추세 진입
- +100에서 0으로 하락: 추세 약화

참고: Colby (2003), *The Encyclopedia of Technical Market Indicators*, 2nd ed., pp. 155-160

코드 매핑: `js/indicators.js:541-562` (`calcCCI()`)
엔진 적용 효과: 평균 가격 이탈도의 정규화 지표, 추세 진입/이탈 시점 판별 보조

### 8.4 윌리엄스 %R (Williams %R)

**창시자**: Larry R. Williams (1973)
*How I Made One Million Dollars Last Year Trading Commodities*, Windsor Books

1987년 세계 선물 트레이딩 챔피언십에서 11,376% 수익률로 우승한 실전 트레이더.

```
수식:
  %R = ((Highest_High(n) - Close) / (Highest_High(n) - Lowest_Low(n))) * -100

매개변수 기본값:
  n = 14

범위: -100 ~ 0
  %R > -20: 과매수
  %R < -80: 과매도
```

스토캐스틱과의 관계:
```
  %R = -(100 - Raw %K)    (음수 스케일의 역전된 스토캐스틱)
```
수학적으로 Raw %K의 보수(complement)를 음수로 표현한 것이다.
스토캐스틱이 저점 대비 위치를 보는 반면, %R은 고점 대비 위치를 본다.
해석의 직관이 다르므로 별도 지표로 유지된다.

참고: Williams, L. (1999), *Long-Term Secrets to Short-Term Trading*, John Wiley & Sons

코드 매핑: `js/indicators.js:645-660` (`calcWilliamsR()`)
엔진 적용 효과: 고점 대비 현재 위치를 음수 스케일로 직관적 표시, 과매수/과매도 보조 판별

### 8.5 모멘텀 (Momentum / Rate of Change)

**기원**: 기술적 분석의 가장 오래된 개념 중 하나. 단순 가격 차분.

```
수식:
  Momentum = Close(t) - Close(t - period)

매개변수 기본값:
  period = 10

변형 (ROC):
  ROC = (Close(t) - Close(t - period)) / Close(t - period) * 100
```

이론적 근거:
- 뉴턴 역학의 관성 법칙 유추: 가격에도 "관성"이 존재
- Jegadeesh & Titman (1993), *Returns to Buying Winners and Selling Losers:
  Implications for Stock Market Efficiency*, Journal of Finance, 48(1), 65-91
  -- 3-12개월 모멘텀 전략의 초과수익을 실증 (모멘텀 효과의 학술적 근거)
- Carhart (1997), *On Persistence in Mutual Fund Performance*,
  Journal of Finance, 52(1), 57-82
  -- Fama-French 3요인에 모멘텀을 추가한 4요인 모형

단순하지만 Jegadeesh-Titman 이후 학술적으로 가장 잘 검증된 이상현상(anomaly) 중 하나.

코드 매핑: `js/indicators.js:668-677` (`calcMomentum()`)
엔진 적용 효과: 가격 변화의 절대 크기를 시각화, 추세 강도 및 가속/감속 판별

### 8.6 어썸 오실레이터 (Awesome Oscillator, AO)

**창시자**: Bill Williams (1995)
*Trading Chaos*, John Wiley & Sons

Bill Williams의 "Trading Chaos" 시스템의 핵심 구성요소.
시장의 "구동력(driving force)"을 측정한다고 주장.

```
수식:
  Median Price = (High + Low) / 2
  AO = SMA(Median, 5) - SMA(Median, 34)

매개변수:
  shortPeriod = 5
  longPeriod = 34
```

MACD와의 비교:
```
  MACD: EMA(Close, 12) - EMA(Close, 26)     — 종가 기반, 지수 이동평균
  AO:   SMA(Median, 5)  - SMA(Median, 34)   — 중간가 기반, 단순 이동평균

  차이점:
  1) 중간가(Median) 사용 → 고가/저가 정보 반영 (MACD는 종가만)
  2) SMA 사용 → EMA보다 최근 데이터 편향이 적음
  3) 5/34 기간 → 12/26보다 단기 반응성 강조
```

Bill Williams의 신호 체계:
- 제로 라인 교차 (Zero Line Cross): AO가 0을 교차할 때
- 접시형 (Saucer): AO가 양수 영역에서 음→양 전환
- 쌍봉 (Twin Peaks): AO의 두 고점/저점 비교로 다이버전스 탐지

학술적 위치: Bill Williams의 체계는 전통 학술계의 엄밀한 검증을 거치지 않았으나,
실무 트레이더 커뮤니티에서 광범위하게 사용된다.
AO 자체는 이중 이동평균 차분(dual MA difference)의 변형으로,
이동평균 교차 시스템의 학술적 근거(Brock, Lakonishok & LeBaron (1992),
*Simple Technical Trading Rules and the Stochastic Properties of Stock Returns*,
Journal of Finance, 47(5), 1731-1764)에 간접적으로 뒷받침된다.

코드 매핑: `js/indicators.js:687-701` (`calcAwesomeOscillator()`)
엔진 적용 효과: MACD와 상이한 관점(중간가+SMA)의 모멘텀 지표, 다중 확인(confirmation) 체계 구축

### 8.7 종합: 서브차트 6종 확장의 의의

기존 서브차트(RSI, MACD)에 6종을 추가함으로써 사용자에게 다양한 관점을 제공:

| 지표 | 측정 대상 | 고유 관점 |
|------|----------|----------|
| Stochastic | 거래 범위 내 종가 위치 | 과매수/과매도 (Lane 방식) |
| StochRSI | RSI의 상대적 위치 | RSI 중립 구간에서도 신호 생성 |
| CCI | 평균 가격 이탈도 | 추세 진입/이탈 (Lambert 정규화) |
| Williams %R | 고점 대비 종가 위치 | 과매수/과매도 (음수 스케일) |
| Momentum | 가격 차분 | 추세 강도의 절대 크기 |
| AO | 이중 SMA(중간가) 차분 | MACD 대안 (고가/저가 반영) |

6종 모두 단독으로는 노이즈가 높으나, 복수 지표의 합의(confluence)를 통해
신호 신뢰도를 향상시키는 것이 다중 확인 분석의 핵심이다.
Murphy (1999), *Technical Analysis of the Financial Markets*, Ch.10
"The Importance of Multiple Confirmations"

---

## 9. 시그널 엔진 임계값의 학술 근거

> signalEngine.js에 구현된 개별 시그널의 수치적 임계값에 대한 근거 기술.
> 지표 수식은 §1-8에 기술되어 있으며, 여기서는 시그널 판정 기준에 집중한다.

### 9.1 거래량 급증 임계값 2.0배 (Volume Spike Threshold)

> 코드 매핑: signalEngine.js:555-577 (_detectVolumeSignals)

```
구현:
  volRatioThreshold = 2.0    (VMA(20) 대비 2배 이상 = "급증")
  strength = ratio >= 3.0 ? 'strong' : 'medium'
  confidence = min(75, 55 + floor(ratio * 5))
```

**이론적 근거: Wyckoff + Karpoff**

Richard D. Wyckoff (1931), *The Richard D. Wyckoff Method of Trading and
  Investing in Stocks* — "노력과 결과(Effort vs Result)" 원칙:
  가격 변동이 거래량(노력)의 뒷받침 없이 일어나면 신뢰할 수 없고,
  거래량이 급증하면서 가격이 움직이면 진정한 돌파.

Karpoff, J.M. (1987). "The Relation Between Price Changes and Trading Volume:
  A Survey." Journal of Financial and Quantitative Analysis, 22(1), 109-126.
  — 가격 변화의 절대값과 거래량 사이에 양의 상관관계를 실증.
  "거래량은 정보 비대칭의 해소 과정을 반영한다."

2.0배 기준의 실무 근거:
```
  VMA(20) 대비 배율과 의미:
    < 1.5배:  정상 범위 (일상적 거래량 변동)
    2.0배:    "급증" — 이례적 거래 활동의 시작점
    3.0배:    "강한 급증" — 뉴스/이벤트 동반 가능성 높음
    5.0배+:   극단적 급증 — 급등/급락, M&A 공시 등
```

Murphy (1999), Ch.7 "Volume and Open Interest":
  "평균 거래량의 2배 이상은 유의미한 거래량 사건으로 간주한다."
  (정확한 수치는 실무 관행이며, 학술 논문에서 2.0의 최적성을 증명한 것은 아님)

**Confidence 선형 공식 평가**:
```
  confidence = min(75, 55 + floor(ratio * 5))

  ratio=2.0 → confidence=65,  ratio=3.0 → 70,  ratio=4.0 → 75 (cap)
```

55 기본점은 "경고 수준" 시그널의 기저 신뢰도.
floor(ratio * 5)는 거래량 비율에 비례하는 선형 가산으로,
학술적 최적 도출이 아닌 직관적 스케일링. 비선형(로그) 스케일링이
더 적절할 수 있으나, 75 상한(cap)이 극단값을 억제.

등급: **D등급** (2.0배 기준은 실무 관행, confidence 선형 공식은 비학술적)

### 9.2 RSI 신뢰도 상수 (RSI Confidence Values)

> 코드 매핑: signalEngine.js:376-429 (_detectRSISignals)

```
RSI 시그널별 confidence 값:
  rsiOversold      (진입):  55   (경고, 아직 매수 아님)
  rsiOversoldExit  (탈출):  65   (반등 확인, 매수)
  rsiOverbought    (진입):  55   (경고, 아직 매도 아님)
  rsiOverboughtExit(탈출):  63   (반전 확인, 매도)
```

**RSI 30/70 임계값의 학술 근거**:

Wilder, J.W. (1978). *New Concepts in Technical Trading Systems*.
  Wilder가 RSI를 고안하면서 30/70을 과매도/과매수 경계로 제안.

통계적 해석 (§3.1 참조):
  RSI 30 = 하락 빈도가 상승의 2.3배 이상
  RSI 70 = 상승 빈도가 하락의 2.3배 이상
  → 30/70은 "극단적 불균형"의 합리적 경계

**Confidence=55 분석**:

55 = 기본 50(중립) + 5(검증된 지표 가산).
과매도/과매수 "진입" 시점은 반전의 경고이지 확정이 아니므로,
confidence를 낮게 설정(55)하여 단독 매매 결정을 방지.

Wilder 원전에서도 RSI 과매수/과매도 진입은 "경고 신호(alert)"이며,
30을 다시 상향 돌파하는 시점(탈출)이 매수 시점이라고 기술.
이에 따라 탈출(exit) 신뢰도를 65/63으로 높임.

매수(65) > 매도(63) 비대칭은 KRX 시장 특성 반영:
  개인투자자 비중 60-70%인 KRX에서 과매수 탈출(고점 매도)은
  과매도 탈출(저점 매수)보다 노이즈가 높음 (처분효과, 04 §1.3).

등급: **D등급** (55, 65, 63 수치는 학술 도출이 아닌 경험적 조정.
  30/70 경계 자체는 Wilder 원전으로 B등급.)

### 9.3 골든크로스 ATR 이격 0.4배 (Whipsaw Filter)

> 코드 매핑: signalEngine.js:197-199

```
구현:
  // [ACC] ATR 대비 최소 이격도 0.3→0.4 상향: 횡보장 허위 크로스 감소
  const minGap = atr[i] * 0.4;
  if (prevDiff <= 0 && currDiff > 0 && Math.abs(currDiff) >= minGap) { ... }
```

MA 교차의 근본적 문제: **whipsaw (허위 신호)**

Murphy, J.J. (1999). *Technical Analysis of the Financial Markets*, Ch.9
  "Moving Averages" — "이동평균 교차 시스템의 가장 큰 약점은 횡보장에서의
  잦은 허위 신호(whipsaw)이다. 필터를 적용하여 유의미하지 않은 교차를
  걸러내야 한다."

필터 유형:
```
  가격 필터: |MA5 - MA20| > close * X%   (고정 비율)
  시간 필터: 교차 후 N봉 동안 유지 확인
  ATR 필터: |MA5 - MA20| > ATR * 0.4     (코드 채택)
```

ATR 필터의 장점:
  - 변동성 적응형: 고변동성 종목에서는 큰 이격 요구, 저변동성에서는 작은 이격
  - 가격 수준 독립: 5,000원 종목과 500,000원 종목에 동일 기준

0.4배 수치의 근거:
  원래 0.3으로 설정했으나, KRX 횡보장(ADX < 20)에서 허위 크로스가
  여전히 빈번하여 0.4로 상향 조정 (코드 [ACC] 주석 기록).
  0.4 ATR = 일별 변동폭의 약 40% → "의미 있는 이격"의 합리적 하한.

```
  ATR 이격 배수와 의미 (경험적):
    < 0.2 ATR:  노이즈 수준 (필터링 대상)
    0.3 ATR:    약한 교차 (이전 설정, 허위 신호 포함)
    0.4 ATR:    유의미한 교차 (현재 설정)
    0.7+ ATR:   강한 교차 (추세 확정)
```

등급: **D등급** (0.4는 KRX 경험적 조정값. ATR 필터 접근 자체는 Murphy 등의
  실무 문헌에서 권장하나, 최적 배수의 학술적 도출은 없음.)

### 9.4 ADX 추세 강도 측정 상세

> 코드 매핑: indicators.js:570-637 (calcADX)

Wilder, J.W. (1978). *New Concepts in Technical Trading Systems*.
  — ADX 원전. +DI, -DI, DX, ADX 4단계 계산.

구현의 핵심은 **Wilder 평활 방식**:

```
알고리즘:

1단계: 방향 움직임 (Directional Movement)
  +DM = high[t] - high[t-1]  (>0 이고 -DM보다 클 때만)
  -DM = low[t-1] - low[t]    (>0 이고 +DM보다 클 때만)

2단계: True Range
  TR = max(high-low, |high-prevClose|, |low-prevClose|)

3단계: Wilder 평활 (= 기간 N의 특수 EMA)
  smoothed_TR[t] = smoothed_TR[t-1] - smoothed_TR[t-1]/N + TR[t]
  smoothed_+DM[t] = smoothed_+DM[t-1] - smoothed_+DM[t-1]/N + +DM[t]
  smoothed_-DM[t] = smoothed_-DM[t-1] - smoothed_-DM[t-1]/N + -DM[t]

  수학적으로: EMA 감쇠 계수 alpha = 1/N과 동일
  Wilder가 이를 "smoothing"이라 명명했으나,
  실질적으로 alpha=1/14 ≈ 0.0714인 EMA.

4단계: 방향 지표 (Directional Indicators)
  +DI = 100 * smoothed_+DM / smoothed_TR
  -DI = 100 * smoothed_-DM / smoothed_TR

5단계: DX (Directional Index)
  DX = 100 * |+DI - -DI| / (+DI + -DI)

6단계: ADX = Wilder 평활(DX, N)
  초기 ADX = 첫 N개 DX의 SMA (인덱스 2*N에서 시작)
  이후: ADX[t] = (ADX[t-1] * (N-1) + DX[t]) / N
```

기본 파라미터: N = 14 (Wilder 원전 권장, B등급)

ADX 해석 (Wilder + 실무 확장):
```
  ADX < 20:  추세 없음 (횡보) — 교차 시그널 필터링 대상
  ADX 20-25: 약한 추세 개시
  ADX 25-40: 건강한 추세
  ADX > 40:  강한 추세 (드문 상황)
  ADX > 60:  매우 강한 추세 (극단적)
```

등급: **A등급** (Wilder 원전 알고리즘 충실 구현, 파라미터 14도 원전 기본값)

### 9.5 MA 이격도 — 패턴 엔진의 moveATR 기반 보정

> 코드 매핑: patterns.js:245-250 (moveATR 계산), 02_statistics.md §9 상세

별도의 "MA 이격률 시그널"은 구현되어 있지 않으나,
패턴 엔진의 meanRevWeight(mw)가 MA 이격도 기반 보정을 수행한다:

```
moveATR = |close - MA50| / ATR14
excess = max(0, moveATR - 3)
mw = clamp(exp(-0.1386 * excess), 0.6, 1.0)
```

전통적 이격률 (한국 실무):
```
  이격도(%) = (종가 / MA) * 100

  MA20 이격도:
    105% 이상: 단기 과열 경고
    95% 이하:  단기 과매도 경고

  MA60 이격도:
    110% 이상: 중기 과열
    90% 이하:  중기 과매도

  → 한국 HTS(키움, 삼성)에서 기본 제공 지표
```

코드에서 이격도를 퍼센트 대신 ATR 단위로 정규화한 이유:
  퍼센트 이격도는 변동성이 다른 종목 간 비교가 불가능.
  ATR 정규화(moveATR)는 변동성을 고려한 무차원 이격도로,
  삼성전자(일 변동 1-2%)와 KOSDAQ 소형주(일 변동 5-10%)에
  동일한 임계값(3 ATR)을 적용할 수 있다.

등급: **C등급** (ATR 정규화 접근은 합리적이나, 3 ATR 임계와 감쇠 계수는
  교정 가능한 실증적 파라미터. 상세는 02 §9 참조.)
