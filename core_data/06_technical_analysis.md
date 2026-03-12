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
