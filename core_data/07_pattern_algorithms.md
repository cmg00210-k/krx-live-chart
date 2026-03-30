# 07. 패턴 탐지 알고리즘 통합본 — Pattern Detection Algorithms (Unified)

> patterns.js에 구현된 각 패턴의 수학적 탐지 알고리즘,
> 고급 캔들스틱·차트 패턴의 수학적 정의, 하모닉 패턴,
> 패턴 품질 평가, 복합 패턴 탐지, 그리고 신호처리 기반 기법을 통합 정리한다.
>
> ML 기반 패턴 인식 및 백테스팅 수학은 15_advanced_patterns.md를 참조한다.

---

## Part A: 기본 패턴 탐지 알고리즘

---

## 1. 스윙 포인트 탐지 (Pivot Point Detection)

### 1.1 현재 구현 (patterns.js)

```
알고리즘: N-봉 비교법

스윙 고점 (Swing High):
  candles[i].high > candles[i-j].high  AND
  candles[i].high > candles[i+j].high
  ∀ j ∈ [1, lookback]

스윙 저점 (Swing Low):
  candles[i].low < candles[i-j].low  AND
  candles[i].low < candles[i+j].low
  ∀ j ∈ [1, lookback]

현재 lookback = 3
```

**시간복잡도**: O(n × lookback) — 선형

### 1.2 고도화: 프랙탈 피봇

Bill Williams, *Trading Chaos* (1995)

```
프랙탈 고점: 5봉 중 가운데 봉의 고가가 최대
  H[i-2] < H[i] AND H[i-1] < H[i] AND
  H[i] > H[i+1] AND H[i] > H[i+2]

프랙탈 저점: 5봉 중 가운데 봉의 저가가 최소
```

Williams의 프랙탈은 lookback=2인 스윙 포인트와 동일.
더 큰 lookback = 더 유의미한(더 드문) 피봇 포인트.

### 1.3 고도화: 적응형 피봇 (가격 변동 기반)

```
ATR 기반 필터링:
피봇 포인트를 ATR(14)의 특정 배수 이상인 경우만 유효로 간주.

significance = |pivot_price - prev_pivot_price| / ATR(14)

significance > 1.5 → 유의미한 피봇
significance < 1.0 → 노이즈, 무시
```

---

## 2. 추세선 피팅 (Trendline Fitting)

### 2.1 현재 구현

```
삼각형/쐐기 패턴: 2개의 피봇 포인트를 직선으로 연결

기울기 = (P₂ - P₁) / (idx₂ - idx₁)
```

### 2.2 고도화: 최소제곱 회귀 추세선

```
여러 피봇 포인트를 통과하는 최적 직선:

y = a + bx

b = [nΣxᵢyᵢ - (Σxᵢ)(Σyᵢ)] / [nΣxᵢ² - (Σxᵢ)²]
a = ȳ - bx̄

R² = 1 - Σ(yᵢ - ŷᵢ)² / Σ(yᵢ - ȳ)²
```

R²가 높을수록 추세선의 신뢰도가 높다.
R² > 0.9 → 매우 깔끔한 추세선

### 2.3 고도화: Theil-Sen 추정량 (로버스트 추세선)

```
b = median{(yⱼ - yᵢ)/(xⱼ - xᵢ), ∀ i < j}
a = median{yᵢ - b·xᵢ}
```

이상치(outlier)에 강건한 추세선.
급등/급락(스파이크)에 영향을 덜 받음.

### 2.4 채널 탐지

```
상승 채널:
  하단 추세선: 스윙 저점 연결 (기울기 > 0)
  상단 추세선: 하단 추세선 + 평행 이동 (최대 고가 포함)

평행도 검증:
  |기울기_상단 - 기울기_하단| / 기울기_하단 < 0.2 (20% 이내)
```

---

## 3. 캔들 패턴 탐지의 수학적 정의

### 3.1 OHLCV 튜플 표현

캔들스틱 데이터의 기본 단위를 5차원 벡터로 정의한다.

```
하나의 캔들: cₜ = (oₜ, hₜ, lₜ, cₜ, vₜ) ∈ ℝ⁵

  oₜ: 시가 (Open)
  hₜ: 고가 (High)
  lₜ: 저가 (Low)
  cₜ: 종가 (Close)
  vₜ: 거래량 (Volume)

n개 캔들 시퀀스: C = (c₁, c₂, ..., cₙ) ∈ ℝⁿˣ⁵
```

제약 조건 (항상 성립):
```
∀ t: lₜ ≤ min(oₜ, cₜ) ≤ max(oₜ, cₜ) ≤ hₜ
∀ t: vₜ ≥ 0
```

### 3.2 패턴을 함수로 정의

패턴은 캔들 시퀀스에서 특정 조건을 탐지하는 함수이다.

```
이진 탐지 함수 (Binary Detection):
  P: ℝⁿˣ⁵ → {0, 1}
  P(C) = 1  ⟺  시퀀스 C가 패턴 조건을 만족

품질 점수 함수 (Quality Scoring):
  Q: ℝⁿˣ⁵ → [0, 1]
  Q(C) ∈ [0, 1]  — 0: 패턴 아님, 1: 교과서적 이상적 패턴

복합 탐지 함수 (Detection + Quality):
  D: ℝⁿˣ⁵ → {0} ∪ (0, 1]
  D(C) = P(C) × Q(C)
```

### 3.3 캔들 구성 요소 비율

개별 캔들의 형태를 정량적으로 기술하는 비율 지표:

```
전체 범위 (Range):
  R = hₜ - lₜ

몸통 크기 (Body Size):
  body = |cₜ - oₜ|

몸통 비율 (Body Ratio):
  b = |cₜ - oₜ| / (hₜ - lₜ)
  b ∈ [0, 1]
  b → 0: 도지(Doji) 형태
  b → 1: 마루보즈(Marubozu) 형태

윗꼬리 비율 (Upper Shadow Ratio):
  us = (hₜ - max(oₜ, cₜ)) / (hₜ - lₜ)

아래꼬리 비율 (Lower Shadow Ratio):
  ls = (min(oₜ, cₜ) - lₜ) / (hₜ - lₜ)

검증: b + us + ls = 1 (항상 성립)

방향 (Direction):
  d = sign(cₜ - oₜ)
  d = +1: 양봉 (Bullish)
  d = -1: 음봉 (Bearish)
  d =  0: 도지 (Doji)
```

### 3.4 추세 맥락 정량화 (Trend Context Quantification)

패턴의 의미는 선행 추세에 의해 결정된다. 추세를 수치로 표현:

```
선형 추세 기울기 (Linear Trend Slope):
  k개 봉의 종가에 대한 최소제곱 회귀:
  slope = [kΣtᵢpᵢ - (Σtᵢ)(Σpᵢ)] / [kΣtᵢ² - (Σtᵢ)²]

정규화 추세 강도 (Normalized Trend Strength):
  T = slope / ATR(k)
  T > 0: 상승 추세
  T < 0: 하락 추세
  |T| > 1: 강한 추세

추세 일관성 (Trend Consistency):
  R²: 추세 회귀선의 결정계수
  R² > 0.7: 깔끔한 추세
  R² < 0.3: 불규칙한 움직임

복합 추세 점수:
  TrendScore = sign(slope) × |T| × R²
```

### 3.5 적삼병 (Three White Soldiers) — 현재 구현

```
조건 (i = 현재 봉, i-1 = 이전 봉, i-2 = 두 봉 전):

∀ k ∈ {i-2, i-1, i}:
  1) close[k] > open[k]              (양봉)
  2) body[k] = close[k] - open[k]
  3) body[k] / open[k] > 0.002       (유의미한 몸통 크기)

순서 조건:
  4) close[i-1] > close[i-2]         (상승)
  5) close[i] > close[i-1]           (상승)

시가 위치:
  6) open[i-1] ∈ [open[i-2], close[i-2]]  (이전 몸통 내 시가)
  7) open[i] ∈ [open[i-1], close[i-1]]

윗꼬리 제한:
  8) (high[k] - close[k]) / body[k] < 0.5  (윗꼬리 < 몸통의 50%)
```

```
※ 개선 권장: 가격 수준 독립적 임계값
  현재: body[k] / open[k] > 0.002 (가격 수준에 의존)
  권장: body[k] / ATR(14) > 0.3 (변동성 정규화)

  이유: 5,000원 주식의 0.2% = 10원 (의미 있는 봉)
       500,000원 주식의 0.2% = 1,000원 (틱 1~2개 수준)
  → ATR 기반 정규화로 모든 가격대에서 일관된 패턴 탐지
```

### 3.6 고도화: 패턴 품질 점수

```
quality_score(적삼병) =
  w₁ × (평균 몸통 크기 / ATR) +          // 몸통 크기 비율
  w₂ × (1 - 평균 윗꼬리 비율) +          // 윗꼬리가 짧을수록 높음
  w₃ × (거래량 증가 비율) +              // 동반 거래량 증가
  w₄ × (이전 하락 추세 강도) +           // 반전 맥락
  w₅ × (RSI 위치)                       // 과매도 후 발생 시 가산

가중치 (현행, 2026-03-23 calibration 반영):
  w₁(body)=0.25, w₂(volume)=0.25, w₃(trend)=0.20, w₄(shadow)=0.15, w₅(extra)=0.15
  변경 이유: Nison/Morris 원칙 + KRX 2,704종목 백테스트에서
  거래량(volume)이 shadow보다 패턴 성공률과 높은 상관(r=0.31 vs 0.18)을 보여
  volume 0.20→0.25, shadow 0.20→0.15로 조정. extra(RSI 위치 등)는 0.20→0.15.
  (이전 초안: w₁=0.25, w₂=0.15, w₃=0.2, w₄=0.2, w₅=0.2)

Q_WEIGHT 요인 정의 (patterns.js:84-86, _quality():158-162):

  body (0.25):    캔들 몸통 크기의 적정성.
                  각 패턴별로 의미가 다름:
                  - 적삼병: 3봉 몸통 크기의 일관성 (CV 낮을수록 높음)
                  - 장악형: 장악봉 몸통 / 이전봉 몸통 비율
                  - 도지: 몸통이 작을수록 높음 (1 - bodyRatio)
                  0.0 = 부적합, 1.0 = 이상적 형태

  volume (0.25):  거래량 확인 수준.
                  패턴 구간의 평균 거래량 / VMA(20) 비율.
                  1.0 이상 = 거래량 증가 동반 (Wyckoff "노력" 확인)
                  0.5 미만 = 거래량 감소 (낮은 확신)
                  _volumeRatio() 메서드로 계산.

  trend (0.20):   선행 추세와의 정합성.
                  반전 패턴: 이전 추세가 강하고 방향이 반대일수록 높음
                  지속 패턴: 이전 추세 방향과 일치할수록 높음
                  _detectTrend() → trend.direction, trend.strength 사용.

  shadow (0.15):  꼬리(그림자)의 적정성.
                  패턴별 이상적 꼬리 형태와의 거리:
                  - 해머: 긴 아래꼬리 / 짧은 윗꼬리가 이상적 → shadow 높음
                  - 마루보즈: 꼬리 없음이 이상적
                  - 적삼병: 윗꼬리가 짧을수록 높음

  extra (0.15):   부가 확인 요인.
                  RSI 과매수/과매도 위치, 볼린저 밴드 위치,
                  지지/저항 합류(confluence) 등 패턴 외부 요인.
                  기본값 0.3 (확인 부재 시 보수적 평가,
                  Nison/Morris: "단독 패턴은 항상 확인이 필요").

  코드 매핑: patterns.js:84-86 (Q_WEIGHT), 158-162 (_quality)
```

```
※ 가중치 캘리브레이션 방법:
  1) 초기값: 균등 가중 (w₁ = w₂ = ... = 1/n)
  2) 백테스팅: 과거 데이터에서 패턴 성공률과 각 요소의 상관 분석
  3) 로지스틱 회귀: 성공/실패를 종속변수로, 각 요소를 독립변수로 회귀
  4) 최적화: 가중치 = 로지스틱 회귀의 표준화된 계수

  예시 (KOSPI 200 종목, 일봉, 2020-2024 백테스팅 기반):
    w₁(봉 크기/ATR) = 0.30, w₂(그림자 비율) = 0.15,
    w₃(거래량 확인) = 0.25, w₄(추세 정합) = 0.20, w₅(RSI 위치) = 0.10
  → 이 값은 시장·시간프레임에 따라 재캘리브레이션 필요
```

### 3.7 상승 삼각형 (Ascending Triangle) — 현재 구현

```
탐지 알고리즘:

1) 스윙 고점 H₁, H₂ 탐색 (최근 40봉)
2) |H₁.price - H₂.price| / H₁.price < 0.015  (수평 저항)
3) 해당 구간의 스윙 저점 L₁, L₂, ... 탐색
4) L[k].price > L[k-1].price ∀ k  (상승 지지)
5) endIdx < candles.length  (경계 검증)

시각화:
  저항선: 수평 직선 (H₁, H₂ 평균 가격)
  지지선: L₁ → Lₙ 연결 직선
  마커: endIdx 위치에 상승 화살표
```

```
※ 개선 권장: ATR 기반 수평선 허용치
  현재: |H₁ - H₂| / H₁ < 0.015 (1.5%, 임의 값)
  권장: |H₁ - H₂| < 0.5 × ATR(14) (변동성 적응형)

  근거: Bulkowski (2005)는 패턴별 다른 허용치를 사용.
  ATR 기반은 시장 변동성에 자동 적응하여 저변동기에는 엄격,
  고변동기에는 유연한 기준을 적용.
```

### 3.8 쐐기형 (Wedge) — 현재 구현

```
상승 쐐기 (Rising Wedge):

1) 스윙 고점 H₁, H₂와 저점 L₁, L₂ 탐색
2) H₂.price > H₁.price  AND  L₂.price > L₁.price  (양쪽 상승)
3) 고점 기울기 < 저점 기울기  (수렴)
   slopeH = (H₂ - H₁) / (idx₂ - idx₁)
   slopeL = (L₂ - L₁) / (idx₂ - idx₁)
   slopeH < slopeL
4) 패턴 폭 ≥ 8봉

하락 쐐기 (Falling Wedge): 조건 대칭 역전
```

```
※ 개선 권장: 정규화된 기울기 비교
  현재: slopeH, slopeL = raw 가격 기울기 (원/봉)
  권장: slopeH_norm = slopeH / ATR(14) (ATR 단위 기울기)

  이유: raw 기울기는 가격 단위(원)에 의존하여 종목 간 비교 불가.
  ATR 정규화된 기울기는 무차원 수(dimensionless)로
  모든 종목·시간프레임에서 동일한 패턴 품질 기준 적용 가능.
```

---

## 4. 고도화 알고리즘: 신호처리 기반

### 4.1 이동평균 수렴/발산 (MACD)의 신호처리 해석

```
MACD = EMA(12) - EMA(26)

주파수 영역 해석:
- EMA(12): 차단주파수 ≈ 1/(2π×12) ≈ 0.013 cycles/period
- EMA(26): 차단주파수 ≈ 1/(2π×26) ≈ 0.006 cycles/period
- MACD = 대역통과 필터 (bandpass filter)
  → 12~26 기간 사이의 주파수 성분 추출

MACD 히스토그램 = MACD의 미분 (변화율)
  → 추세 가속/감속 감지
```

### 4.2 볼린저 밴드의 적응형 대안

```
Keltner Channel:
  중간선 = EMA(20)
  상단 = EMA(20) + 2 × ATR(10)
  하단 = EMA(20) - 2 × ATR(10)

Donchian Channel:
  상단 = n기간 최고가
  하단 = n기간 최저가

ATR 기반 vs σ 기반:
  ATR은 변동성의 비모수적 추정
  σ는 정규분포 가정 하의 모수적 추정
  → 두꺼운 꼬리 분포에서는 ATR이 더 로버스트
```

### 4.3 칼만 필터 (Kalman Filter)

Rudolf Kálmán (1960)

```
상태 방정식:   xₜ = F·xₜ₋₁ + B·uₜ + wₜ
관측 방정식:   zₜ = H·xₜ + vₜ

예측:
  x̂ₜ|ₜ₋₁ = F·x̂ₜ₋₁
  Pₜ|ₜ₋₁ = F·Pₜ₋₁·F' + Q

갱신:
  Kₜ = Pₜ|ₜ₋₁·H' · (H·Pₜ|ₜ₋₁·H' + R)⁻¹
  x̂ₜ = x̂ₜ|ₜ₋₁ + Kₜ·(zₜ - H·x̂ₜ|ₜ₋₁)
  Pₜ = (I - Kₜ·H)·Pₜ|ₜ₋₁
```

금융 적용:
- 가격에서 노이즈를 제거한 "실제 가치" 추정
- 이동평균보다 적응적이고 수학적으로 최적
- 추세와 변동성을 동시에 추정 가능

---

## 5. 고도화 알고리즘: 머신러닝 기반 (개요)

> 상세한 ML/DL 기반 패턴 인식은 15_advanced_patterns.md §5~6을 참조한다.
> 여기서는 기존 개요 수준을 유지한다.

---

*아래 5.1~5.4는 개요이며, 상세 아키텍처·학습 방법론은 15에서 다룬다.*

### 5.1 SVM (Support Vector Machine) 패턴 분류

```
입력 특성 벡터 (패턴 후보에서 추출):
x = [body_ratio, wick_ratio, volume_change, rsi, macd_hist,
     prev_trend_slope, atr_ratio, ...]

분류: y ∈ {매수 신호, 매도 신호, 무시호}

커널: RBF (Radial Basis Function)
K(x, x') = exp(-γ|x - x'|²)
```

참고: Kara et al. (2011), *Predicting Direction of Stock Price Index
Movement Using Artificial Neural Networks and SVMs*

### 5.2 LSTM (Long Short-Term Memory) 시퀀스 패턴

```
fₜ = σ(Wf · [hₜ₋₁, xₜ] + bf)     (망각 게이트)
iₜ = σ(Wi · [hₜ₋₁, xₜ] + bi)     (입력 게이트)
C̃ₜ = tanh(Wc · [hₜ₋₁, xₜ] + bc)  (후보 셀 상태)
Cₜ = fₜ ⊙ Cₜ₋₁ + iₜ ⊙ C̃ₜ        (셀 상태 갱신)
oₜ = σ(Wo · [hₜ₋₁, xₜ] + bo)     (출력 게이트)
hₜ = oₜ ⊙ tanh(Cₜ)               (은닉 상태)
```

금융 적용:
- OHLCV 시퀀스를 입력으로 패턴 분류
- 사람이 정의한 규칙 대신 데이터에서 패턴 학습
- 한계: 과적합 위험, 해석 불가능성

### 5.3 DTW (Dynamic Time Warping) 패턴 매칭

```
DTW(X, Y) = min Σ d(xᵢ, yⱼ) along warping path

동적 프로그래밍:
D(i,j) = d(xᵢ, yⱼ) + min{D(i-1,j), D(i,j-1), D(i-1,j-1)}
```

금융 적용:
- 템플릿 패턴(교과서적 적삼병 등)을 정의
- 실시간 캔들 시퀀스와 DTW 거리 계산
- 거리가 임계값 이하면 패턴 감지
- 시간 축이 신축 가능 → 다양한 속도의 패턴 인식

Berndt & Clifford (1994), *Using Dynamic Time Warping to Find
Patterns in Time Series* — DTW 기반 패턴 매칭 원전

### 5.4 CNN (Convolutional Neural Network) 차트 이미지 분석

```
입력: 캔들스틱 차트 이미지 (픽셀)
Conv2D → Pool → Conv2D → Pool → Dense → Softmax

출력 클래스: {적삼병, 흑삼병, 삼각형, 쐐기, ...}
```

Tsantekidis et al. (2017), *Using Deep Learning for Price Prediction
by Exploiting Stationary Limit Order Book Features*

Jiang et al. (2020), *Applications of Deep Learning in Stock Market
Prediction*: CNN이 전통적 규칙 기반보다 높은 정확도 달성

---

## 6. 패턴 유효성 검증 방법

### 6.1 백테스팅 프레임워크

```
for each pattern_occurrence:
  entry_price = candles[pattern.endIndex + 1].open
  hold_period = N봉

  exit_price = candles[pattern.endIndex + 1 + N].close
  return = (exit_price - entry_price) / entry_price × 100

통계:
  승률 = count(return > 0) / total_count
  평균 수익 = mean(return)
  리스크 보상 = mean(positive_returns) / |mean(negative_returns)|
  t-검정: H₀: 평균 수익 = 0 → p-value
```

### 6.2 부트스트랩 유의성 검정

```
1) 원본 데이터에서 패턴 전략 수익 계산: R_actual
2) N = 10,000번 반복:
   a) 수익률 시계열을 무작위 셔플 (시간 구조 파괴)
   b) 같은 전략 적용: R_random(i)
3) p-value = count(R_random > R_actual) / N

p < 0.05 → 패턴이 통계적으로 유의
```

### 6.3 Walk-Forward 최적화

```
전체 기간: [───────────────────────]
          │← 학습 →│← 검증 →│
                    │← 학습 →│← 검증 →│
                              │← 학습 →│← 검증 →│

각 창(window)에서 최적 매개변수를 학습하고
다음 창에서 성과를 검증 → 과적합 방지
```

---

---

## Part B: 패턴 품질 평가 체계 (15에서 통합)

---

## 7. 다요인 패턴 품질 점수 (Multi-Factor Pattern Quality Scoring)

단순한 이진 탐지를 넘어 패턴의 "이상적 형태"와의 거리를 측정한다.

### 7.1 일반 품질 점수 프레임워크

```
Q = Σᵢ wᵢ · fᵢ(pattern),    Σ wᵢ = 1

여기서 fᵢ: 개별 품질 요인, wᵢ: 가중치

요인 1 — 몸통 크기 일관성 (Body Consistency):
  f₁ = 1 - σ(body₁, body₂, ..., bodyₙ) / μ(body₁, ..., bodyₙ)
  → 변동계수(CV)가 낮을수록 일관적

요인 2 — 거래량 확인 (Volume Confirmation):
  f₂ = (패턴 구간 평균 거래량) / (이전 k봉 평균 거래량)
  → f₂ > 1: 거래량 증가 동반

요인 3 — 추세 정렬 (Trend Alignment):
  f₃ = |TrendScore| × alignment_sign
  반전 패턴: 이전 추세가 강할수록 높은 점수
  지속 패턴: 이전 추세 방향과 일치할수록 높은 점수

요인 4 — 갭 존재 (Gap Presence):
  f₄ = 1  if 패턴에 갭 포함 (명중성, 석별형 등)
  f₄ = 0  otherwise
  (일부 패턴에만 적용)

요인 5 — RSI/과매수과매도 위치:
  f₅ = max(0, (70 - RSI) / 40)  for 매도 패턴 (과매수 시 가산)
  f₅ = max(0, (RSI - 30) / 40)  for 매수 패턴 (과매도 시 가산)
```

**기본 가중치 (Default Weights)**:
```
w₁ (봉 크기 일관성) = 0.25
w₂ (거래량 확인)    = 0.25
w₃ (추세 정합성)    = 0.20
w₄ (갭 존재)        = 0.15
w₅ (RSI/MACD 확인)  = 0.15

※ 각 fᵢ는 [0, 1] 범위로 정규화 필수:
  fᵢ_norm = min(max(fᵢ, 0), 1)
```

**가중치 최적화 방법**:
```
1단계: 로지스틱 회귀  — y=성공(1)/실패(0), X=[f₁,...,f₅]
2단계: 표준화 계수 추출 — wᵢ = |βᵢ| / Σ|βⱼ|
3단계: Walk-forward 검증 — 훈련(3년) → 테스트(1년) 반복
```

### 7.2 베이지안 패턴 품질

```
P(success | features) = P(features | success) × P(success) / P(features)

사전확률 P(success): 역사적 승률 (Bulkowski 통계 활용)
우도 P(features | success): 성공 패턴의 특성 분포 (KDE 등)

※ "성공"의 정의:
  적삼병 5봉 기준: ~66% (Bulkowski, 2005)
  적삼병 10봉 기준: ~58%
  적삼병 목표가 기준: ~45%
  → 시스템 구현 시 정의를 반드시 명시
```

### 7.3 ROC 곡선과 AUC (패턴 평가)

```
AUC = ∫₀¹ TPR(FPR) dFPR
AUC = 0.5: 무작위, AUC > 0.7: 보통, AUC > 0.8: 양호, AUC > 0.9: 우수

혼동 행렬 기반 지표:
  정밀도: P = TP / (TP + FP)
  재현율: R = TP / (TP + FN)
  F1 = 2PR / (P + R)
  MCC = (TP×TN - FP×FN) / √((TP+FP)(TP+FN)(TN+FP)(TN+FN))
```

---

## Part C: 고급 캔들스틱 패턴 (15에서 통합)

---

## 8. 고급 캔들스틱 패턴 (Advanced Candlestick Patterns)

### 8.1 상승 삼법 (Rising Three Methods)

Nison (1991), *Japanese Candlestick Charting Techniques*

```
봉 0: 큰 양봉 (기준봉), body₀/ATR > 0.7
봉 1~3: 소형 음봉, 기준봉 범위 내 유지
봉 4: 큰 양봉 (확인봉), c₄ > h₀

품질 점수:
  Q = w₁×(body₀/ATR) + w₂×(c₄-h₀)/ATR
    + w₃×(1-max_penetration/range₀) + w₄×vol_pattern
```

하락 삼법: 조건 대칭 역전.

### 8.2 버려진 아기 (Abandoned Baby)

```
봉 0: 큰 음봉, 봉 1: 갭다운 도지(b₁<0.05), 봉 2: 갭업 큰 양봉
핵심: gap₁ > 0 AND gap₂ > 0 (도지가 양쪽 갭에 의해 고립)
```

KRX: 가격 제한폭으로 갭 제한적, 일봉에서 탐지 적합.

### 8.3 상승/하락 반격형 (Three Inside Up/Down)

```
봉 0: 큰 음봉, 봉 1: Harami(몸통 내 소형 양봉), 봉 2: 돌파 양봉(c₂>o₀)
품질: Q = w₁×(body₀/ATR) + w₂×(1-body₁/body₀) + w₃×(c₂-o₀)/ATR + w₄×vol
```

### 8.4 차오르는 패턴 (Kicking)

```
봉 0: 음봉 마루보즈(us,ls<0.02), 봉 1: 양봉 마루보즈+갭업(o₁>h₀)
실전: 꼬리 허용 us,ls < 0.05
```

### 8.5 석별형/샛별형 도지 변형

```
샛별 도지형: 봉 0 큰 음봉, 봉 1 도지(b₁<0.05)+갭다운, 봉 2 큰 양봉
일반 변형 b₁<0.3 vs 도지 변형 b₁<0.05 → 도지가 더 강한 반전 신호
```

### 8.6 패턴 요약표

| 패턴 | 봉수 | 핵심 조건 | 유형 |
|------|------|----------|------|
| 상승 삼법 | 5+ | 기준봉 내 되돌림+돌파 | 지속 |
| 버려진 아기 | 3 | 양방향 갭+도지 | 반전 |
| 반격형 | 3 | Harami+돌파 | 반전 |
| 차오르는 패턴 | 2 | 마루보즈 반전+갭 | 반전 |
| 도지 별형 | 3 | 도지+갭 | 반전 |

---

## Part D: 복합 차트 패턴 (15에서 통합)

---

## 9. 복합 차트 패턴 (Complex Chart Patterns)

### 9.1 머리어깨형 (Head and Shoulders)

Bulkowski (2005)

```
3개 피크(왼쪽 어깨, 머리, 오른쪽 어깨) + 넥라인
조건: 머리 최고, 어깨 대칭(|P₁-P₃|/P₂<0.03), 시간 대칭(<0.4)
> **[2026-03-26 갱신]** 코드 HS_SHOULDER_TOLERANCE = 0.15 (15%). Bulkowski (2005): 유효 H&S의 40%가 5% 이상 비대칭. Phase 1-A에서 조정.
넥라인: T₁, T₂ 연결 직선
목표가: neckline - (머리 높이 - neckline)
역머리어깨형: 부등호 반전
```

### 9.2 컵앤핸들 (Cup and Handle)

O'Neil (1988)

```
컵: 2차 함수 피팅 price(t) ≈ a(t-t_center)² + price_min
  a>0, 깊이 12~35%, R²>0.6
핸들: handle_depth < cup_depth×0.5, slope≤0
돌파: close > price_right_rim, 목표가 = rim + cup_depth
```

### 9.3 엘리엇 파동 자동 카운팅

Frost & Prechter (1978)

```
5파 제약: W2>start(W1), |W3|≥|W1|or|W5|, low(W4)>high(W1)
피보나치 가이드라인: W2∈[0.382,0.786]×W1, W3∈[1.618,2.618]×W1
탐색: 스윙 포인트에서 5점 조합 + 가지치기
```

### 9.4 하모닉 패턴 (Harmonic Patterns)

Scott Carney (1999), *The Harmonic Trader*

```
X-A-B-C-D 5점 패턴, 피보나치 비율 기반

가틀리: AB=0.618×XA, AD=0.786×XA
나비:   AB=0.786×XA, AD=1.272~1.618×XA
박쥐:   AB∈[0.382,0.500]×XA, AD=0.886×XA
게:     AB∈[0.382,0.618]×XA, AD=1.618×XA

적합도: fit(ratio,target) = 1 - |ratio-target|/target
집계: 기하평균 방식 권장 — (Π fit_i)^(1/n)
```

| 패턴 | AB/XA | BC/AB | CD/BC | AD/XA |
|------|-------|-------|-------|-------|
| Gartley | 0.618 | 0.382~0.886 | 1.272~1.618 | 0.786 |
| Butterfly | 0.786 | 0.382~0.886 | 1.618~2.618 | 1.272~1.618 |
| Bat | 0.382~0.500 | 0.382~0.886 | 1.618~2.618 | 0.886 |
| Crab | 0.382~0.618 | 0.382~0.886 | 2.240~3.618 | 1.618 |

---

## Part E: 패턴 조합과 확률 (15에서 통합)

---

## 10. 패턴 조합과 확률 (Pattern Combinations and Probability)

### 10.1 복합 신호의 결합 확률

```
독립 가정: P(A∩B) = P(A)×P(B)
의존 구조: P(A∩B) = P(A)×P(B|A) 또는 코풀라 기반 결합
```

### 10.2 조건부 확률과 다중 확인

```
실전 수치 (Bulkowski 기반):
  P(반등|적삼병) ≈ 0.66
  P(반등|적삼병∩거래량↑) ≈ 0.74
  P(반등|적삼병∩거래량↑∩RSI<30) ≈ 0.82
→ 확인 신호 추가 시 조건부 확률 상승
```

### 10.3 순차 패턴 분석: 마르코프 체인

```
전이 확률 행렬 P(Sₜ₊₁=j|Sₜ=i) = pᵢⱼ
n-step 전이: [Pⁿ]ᵢⱼ (행렬 거듭제곱)
정상 분포: πP = π, Σπᵢ = 1
```

### 10.4 패턴 합류 구역 (Confluence Zones)

```
CS(price_level) = Σᵢ wᵢ × 1(|signal_i - price_level| < δ)
CS > 3: 강한 합류, CS = 2: 보통, CS = 1: 단일 신호
```

### 10.5 정보 내용: 조합의 정보 이득

```
상호 정보량: I(X;Y) = H(Y) - H(Y|X)
시너지: Syn(X₁,X₂;Y) = I(X₁,X₂;Y) - I(X₁;Y) - I(X₂;Y) + I(X₁;X₂)
Syn > 0 → 조합이 개별 합보다 더 많은 정보 제공
```

---

## 10. 적응형 패턴 가중치 시스템 (Wc — Adaptive Pattern Weighting)

### 10.1 이론적 근거: 적응적 시장 가설

Lo, A. (2004), *The Adaptive Markets Hypothesis: Market Efficiency from an
Evolutionary Perspective*, Journal of Portfolio Management, Vol. 30, pp. 15-29

효율적 시장 가설(EMH)이 시장 효율성을 시간 불변의 고정 상태로 가정하는
반면, 적응적 시장 가설(AMH)은 시장 효율성이 시간에 따라 변화한다고
주장한다. 시장 참여자들이 진화적으로 적응하면서 기존의 비효율이
사라지기도 하고, 새로운 비효율이 생성되기도 한다.

이 관점에서 기술적 패턴의 신뢰도는 고정값이 아니라,
해당 종목의 시장 미시구조(추세 지속성, 이격도, 변동성 레짐)에 따라
적응적으로 조정되어야 한다. Wc 가중치 시스템이 이 적응을 구현한다.

### 10.2 Wc 정의와 수식

```
Wc 가중치 시스템 (patterns.js:320-328):

  매수(buy) 신호:
    effectiveHw = hurstWeight                (hw 그대로)
    wc = effectiveHw * meanRevWeight         (wc = hw * mw)

  매도(sell) 신호:
    effectiveHw = 2 - hurstWeight            (hw 반전)
    wc = effectiveHw * meanRevWeight         (wc = (2-hw) * mw)

  구성 요소:
    hw (hurstWeight):   Hurst 지수 기반 추세 지속성 가중치 [0.6, 1.4]
    mw (meanRevWeight): 이격도 기반 평균 회귀 보정 [0.6, 1.0]

  Wc 값 범위:
    최소: 0.6 * 0.6 = 0.36  (약한 추세 + 극단적 이격)
    최대: 1.4 * 1.0 = 1.40  (강한 추세 + 정상 이격)
```

### 10.3 매수/매도 비대칭: sell hw = (2 - hw)

```
hw 값에 따른 effectiveHw:

  hw = 1.4 (H > 0.5, 추세 지속):
    buy:  effectiveHw = 1.4  (매수 신호 강화)
    sell: effectiveHw = 0.6  (매도 신호 약화)

  hw = 0.6 (H < 0.5, 평균 회귀):
    buy:  effectiveHw = 0.6  (매수 신호 약화)
    sell: effectiveHw = 1.4  (매도 신호 강화)

  hw = 1.0 (H = 0.5, 랜덤워크):
    buy:  effectiveHw = 1.0  (중립)
    sell: effectiveHw = 1.0  (중립)
```

이론적 근거:

Chordia, T. & Shivakumar, L. (2002), *Momentum, Business Cycles, and
Time-Varying Expected Returns*, Journal of Finance, Vol. 57, pp. 985-1019

모멘텀(추세 지속) 환경에서는 매수 신호의 후속 수익률이 높고
매도 신호의 후속 수익률(하락폭)은 상대적으로 작다.
반대로 평균 회귀 환경에서는 매도(반전) 신호가 더 유효하다.
sell hw = (2 - hw) 반전은 이 비대칭을 포착한다.

[D등급 표시] 반전축 2와 기울기 -1은 학술 논문에서
특정된 값이 아닌 설계자의 선형 근사. 실증적으로
KRX Phase A IC 분석에서 sell IC = +0.041(역방향)로
현행 sell hw 반전의 방향성에 의문이 제기되었으며,
WLS 회귀로 교정 가능한 D등급 상수이다.

### 10.4 구성 요소 상세

```
구성 요소 4개 (설계 시점) -> 현행 2개 (실증 검증 후):

  hw (hurstWeight):  James-Stein 수축 Hurst 가중치
    -> 02_statistics.md §8 참조
    -> IC = +0.030, KRX 2,704종목 실증 양의 상관

  vw (volWeight):    변동성 레짐 보정
    -> 설계: 1/sqrt(ATR14/ATR50), IC = -0.083 (역방향)
    -> 현재 Wc 곱셈에서 제외 (wc = hw * mw, vw 미포함)
    -> BMF 대체 설계 존재하나 미적용

  mw (meanRevWeight): 이격도 기반 평균 회귀 감쇠
    -> 02_statistics.md §9 참조
    -> IC = +0.028, 4개 성분 중 최강 양의 상관

  rw (regimeWeight): Jeffrey 발산 기반 레짐 변화 보정
    -> 13_information_geometry.md §4.3 참조
    -> IC = -0.010, 유의하지 않아 현재 Wc 곱셈에서 제외
    -> 패턴 객체에 rw 값은 기록되나 wc 계산에 미참여
```

### 10.5 상수 분류 체계 (5등급)

Wc 시스템의 모든 상수는 학술 근거의 강도에 따라 5등급으로 분류된다:

```
A등급 (학술 불변): 정의적으로 고정된 값
  - H 수축 중심 0.5 (EMH 정의)

B등급 (설계자 선택): 합리적이나 유일하지 않은 경계값
  - hw 클램프 [0.6, 1.4]  ← Phase 3 M17: 미검증, B등급 유지 (§10.9 참조)
  - mw 클램프 [0.6, 1.0]
  - Hurst 선형 변환 밑수 1.5

C등급 (교정 가능): 데이터 기반 최적화 가능한 상수
  - hw 승수 2 (hShrunk -> hurstWeight 변환)
  - 사전 강도 k = 20 (James-Stein prior strength)
  - mw 임계 excess = 3 ATR  ← Phase 3 M16: 미검증, C등급 유지 (02 §9.3 참조)
  - 손절가 ATR 배수 STOP_LOSS_ATR_MULT = 2

D등급 (학습 필요): 학술 근거 없는 매직 넘버, WLS/RL 교정 대상
  - mw 감쇠 계수 0.1386 (반감기 5 ATR, ln(2)/5)
  - CANDLE_TARGET_ATR {strong:1.0, medium:0.7, weak:0.5}  ← 교정 완료 §10.10 참조
  - sell hw 반전축 2, 기울기 -1

E등급 (비활성): 현재 사용되지 않거나 폐기 예정
  - rw 감쇠 계수 0.15 (13_information_geometry.md 부록 참조)
```

### 10.6 MRA 회귀와의 연결

Stage A-1에서 Wc는 다중 회귀 분석(MRA)의 설계행렬에 포함된다:

```
WLS 설계행렬 (backtester.js):
  [1, confidence, trend, lnVol, atrNorm, wc]

  wc가 독립변수로 포함되어 패턴 수익률에 대한 설명력을 갖는다.
  Stage A-1 결과: wc 계수의 t-stat = 9.02, IC = 0.030
  -> Wc가 패턴 수익률의 유의한 예측 변수임을 확인
```

### 10.7 효과 요약

```
Wc 적용 전: confidence 고정 (패턴 형태만 반영)
Wc 적용 후: confidence * wc (시장 미시구조 반영)

효과:
  1. 추세 지속성 높은 종목 (H>0.5): 매수 신호 강화, 매도 약화
  2. 평균 회귀 종목 (H<0.5): 매도 신호 강화, 매수 약화
  3. 극단적 이격 종목: 모든 신호 감소 (추격 매수/패닉 매도 방지)
  4. 신규 상장 종목: hw->0.5 수축으로 과신 방지
```

참고문헌:
  Lo, A. (2004), *The Adaptive Markets Hypothesis*, Journal of Portfolio
    Management, Vol. 30, No. 5, pp. 15-29
  Chordia, T. & Shivakumar, L. (2002), *Momentum, Business Cycles, and
    Time-Varying Expected Returns*, Journal of Finance, Vol. 57, pp. 985-1019
  Fama, E. (1970), *Efficient Capital Markets: A Review of Theory and
    Empirical Work*, Journal of Finance, Vol. 25, No. 2, pp. 383-417

코드 매핑: patterns.js:220-335 (analyze() 내 hw/vw/mw/rw 계산 + wc 주입)

### 10.8 sell hw 반전 (2-hw): 크로스 참조

sell 조건에서 effectiveHw = 2 - hurstWeight 반전에 대한 상세한 이론적 근거,
KRX Phase A IC 분석, 그리고 반전 방향성 의문은 위 §10.3에 기술되어 있다.

> 크로스 참조: §10.3 "매수/매도 비대칭: sell hw = (2 - hw)"
> Chordia & Shivakumar (2002) 이론적 근거
> Phase A IC: sell IC = +0.041(역방향 MISMATCH) → D등급 상수

---

## 10A. R:R 검증 게이트 (Risk-Reward Gate)

> 코드 매핑: patterns.js:1929-1946 (_applyRRGate)

### 구현

```
_applyRRGate(patterns, candles):
  for each pattern:
    reward = |priceTarget - entry|
    risk   = |entry - stopLoss|
    rr     = reward / risk

    if rr < 1.0:   confidence -= 15   (하한 10)
    if 1.0 <= rr < 1.5:  confidence -= 5   (하한 10)
    if rr >= 1.5:  변경 없음
```

### 이론적 배경: 전망이론과 R:R

Kahneman, D. & Tversky, A. (1979). "Prospect Theory: An Analysis of Decision
  under Risk." Econometrica, 47(2), 263-291.

전망이론의 손실 회피 계수 lambda ≈ 2.25:
  투자자는 1,000원 손실의 심리적 고통이 1,000원 이득의 기쁨보다
  2.25배 크다고 느낀다.

이를 R:R 관점으로 해석하면:
```
  기대 심리 가치 = reward - lambda * risk
  손익분기:  reward = lambda * risk
  → R:R_breakeven = lambda = 2.25

  실무적 완화:
    승률 50%에서 Kelly 기준 최소 R:R ≥ 2.0
    승률 60%에서 Kelly 기준 최소 R:R ≈ 1.5
    → R:R ≥ 1.5를 "심리적으로 공정한 거래"로 간주
```

### -15/-5 수치의 등급 판정

R:R < 1.0 → -15, R:R < 1.5 → -5 의 감산폭은 학술적으로 도출된 것이 아니다.

전망이론에서 도출 가능한 것은 "R:R이 낮을수록 신뢰도를 낮추어야 한다"는
방향성뿐이며, -15와 -5라는 특정 수치는 설계자의 경험적 선택이다.

```
  -15의 의도: R:R < 1.0인 패턴은 "손실 > 이익" 상황이므로
              confidence를 의미 있게 감소 (약 1등급 하향에 해당)
  -5의 의도:  1.0 <= R:R < 1.5는 "미흡하나 허용 가능" 구간이므로
              경미한 페널티

  대안 (향후 고려):
    - 연속 함수: penalty = -20 * max(0, 1 - rr/1.5)
    - 로그 스케일: penalty = -10 * log(1.5/rr)  (rr < 1.5)
    → 현재 계단 함수보다 매끄러운 전환
```

등급: **D등급** (-15/-5 수치는 학술 도출이 아닌 경험적 선택.
  R:R 기반 페널티의 방향성은 전망이론(A등급)에서 지지됨.)

참고문헌:
  Kahneman, D. & Tversky, A. (1979). Econometrica, 47(2), 263-291.
  04_psychology.md §1.2 (전망이론 상세)

---

## 10B. 목표가 3중 Cap 구조 (Triple Price Target Cap)

> 코드 매핑: patterns.js:88-101 (STOP_LOSS_ATR_MULT, CANDLE_TARGET_ATR,
>   CHART_TARGET_ATR_CAP, CHART_TARGET_RAW_CAP)

### 설계 의도

패턴 기반 목표가가 비현실적으로 과대추정되는 것을 방지하기 위해
3중 상한(cap) 시스템을 적용한다.

### Cap 구조

```
차트 패턴 목표가 계산:
  1) raw_target = 패턴 높이 * 배율         (패턴 유형별 Bulkowski 배율)
  2) cap_1: raw_target = min(raw_target, 패턴높이 * CHART_TARGET_RAW_CAP)
     → 패턴 높이의 2.0배 초과 방지
  3) cap_2: target_atr = min(raw_target / ATR, CHART_TARGET_ATR_CAP)
     → ATR 6배 초과 방지
  4) 최종 목표가 = entry ± min(cap_1, cap_2 * ATR)

캔들스틱 패턴 목표가:
  CANDLE_TARGET_ATR = { strong: 1.0, medium: 0.7, weak: 0.5 }
  → ATR 배수로 직접 계산, raw_cap 불필요
```

### 각 Cap의 학술 근거

**Cap 1: CHART_TARGET_RAW_CAP = 2.0 (패턴 높이 배율 상한)**

Bulkowski, T. (2005). *Encyclopedia of Chart Patterns*, 2nd Ed. Wiley.
  Bulkowski의 패턴별 목표가 도달률 분포:
```
  목표가 배율    도달률 (Bulkowski 통계)
    1.0배:       ~50-60% (중앙값 근처)
    1.5배:       ~30-40%
    2.0배:       ~20-25% (P80 경계)
    3.0배:       ~10% 미만
```
  → 2.0배를 상한으로 설정 = "상위 20%의 극단적 성과"를 배제.
    보수적 목표가 설정으로 과대 기대를 방지.

등급: **B등급** (Bulkowski P80 기반, 정확한 분위수 연구에서 도출)

**Cap 2: CHART_TARGET_ATR_CAP = 6 (ATR 6배 상한)**

12_extreme_value_theory.md §4.3:
```
  EVT 99.5% VaR 경계: -3σ ~ -4σ
  ATR ≈ 1.2~1.5σ (경험적 관계)
  → 6 ATR ≈ 4~5σ ≈ 99.5% VaR 경계 이상

  즉, 6 ATR 초과의 가격 변동은 EVT 관점에서 극단적 사건(tail event)에 해당.
  목표가를 이 수준 이상으로 설정하는 것은 비현실적.
```

등급: **B등급** (EVT 이론에 근거한 합리적 경계,
  정확한 수치는 σ-ATR 관계의 경험적 추정에 의존)

**Cap 3: CANDLE_TARGET_ATR = { strong:1.0, medium:0.7, weak:0.5 }**

캔들스틱 패턴의 기대 수익률은 차트 패턴보다 작다:
```
  Bulkowski (2012) 캔들스틱 패턴 5일 평균 수익률:
    강한 패턴 (적삼병, 장악형): ~2-3%
    중간 패턴 (해머, 유성형):   ~1-2%
    약한 패턴 (도지, 스피닝탑): ~0.5-1%

  KRX 일봉 ATR(14) 평균: ~2-3%
  → strong 1.0 ATR ≈ 2-3% = 강한 캔들 패턴의 기대 수익
    medium 0.7 ATR ≈ 1.5-2%
    weak   0.5 ATR ≈ 1-1.5%
```

등급: **D등급** (방향은 Bulkowski에 부합하나, 1.0/0.7/0.5 수치는
  정밀한 학술 도출이 아닌 근사적 매핑)

### 3중 Cap의 종합 효과

```
  단일 cap만 사용할 경우의 문제:
    - ATR cap만: 저변동성 종목에서 raw 배율이 5배 이상 허용
    - Raw cap만: 고변동성 종목에서 ATR 10배 이상의 비현실적 목표 가능

  3중 cap은 "패턴 크기 기준"과 "변동성 기준"을 교차 검증하여
  어느 쪽이든 비현실적 목표가를 억제한다.
```

코드 매핑: patterns.js:88-101 (상수 정의)

---

## 11. 시그널 가중치 체계 (Signal Sentiment Weighting)

### 11.1 이론적 근거: 기술적 시그널의 강도 계층

기술적 분석에서 모든 시그널이 동일한 신뢰도를 갖지 않는다.
Murphy (1999), *Technical Analysis of the Financial Markets*에서는
추세 확인(trend confirmation) 시그널이 모멘텀 시그널보다,
모멘텀 시그널이 단순 과매수/과매도 시그널보다 강력하다고 분류한다.

시그널 가중치는 이 계층적 강도 차이를 수치화하여,
다중 시그널 동시 발생 시 단순 다수결이 아닌
강도 기반 종합 판단(weighted sentiment)을 가능하게 한다.

### 11.2 가중치 테이블

```
시그널 가중치 (signalEngine.js:101-127):

카테고리 1: 이동평균 크로스 (MA Cross)
  goldenCross:       +3    (추세 확인, 강력 매수)
  deadCross:         -3    (추세 확인, 강력 매도)
  maAlignment_bull:  +2    (추세 정렬, 중간 매수)
  maAlignment_bear:  -2    (추세 정렬, 중간 매도)

카테고리 2: MACD
  macdBullishCross:           +2    (모멘텀 전환, 중간)
  macdBearishCross:           -2    (모멘텀 전환, 중간)
  macdBullishDivergence:      +2.5  (다이버전스, 강력)
  macdBearishDivergence:      -2.5  (다이버전스, 강력)
  macdHiddenBullishDivergence:  +2.0  (숨은 다이버전스, 중간)
  macdHiddenBearishDivergence:  -2.0  (숨은 다이버전스, 중간)

카테고리 3: RSI
  rsiOversold:              +1.5  (과매도 진입, 약한 매수)
  rsiOversoldExit:          +2.5  (과매도 탈출, 강력 매수)
  rsiOverbought:            -1.5  (과매수 진입, 약한 매도)
  rsiOverboughtExit:        -2.5  (과매수 탈출, 강력 매도)
  rsiBullishDivergence:     +2    (RSI 다이버전스, 중간)
  rsiBearishDivergence:     -2    (RSI 다이버전스, 중간)
  rsiHiddenBullishDivergence:  +1.5  (숨은 다이버전스, 약한)
  rsiHiddenBearishDivergence:  -1.5  (숨은 다이버전스, 약한)

카테고리 4: 볼린저 밴드
  bbLowerBounce:  +1.5  (하단 반등, 약한 매수)
  bbUpperBreak:    0    (상단 돌파, 중립 — 방향은 복합 시그널이 판단)
  bbSqueeze:       0    (스퀴즈, 방향 중립)

카테고리 5: 일목균형표
  ichimokuBullishCross:    +2.5  (전환/기준 크로스, 강력)
  ichimokuBearishCross:    -2.5  (전환/기준 크로스, 강력)
  ichimokuCloudBreakout:   +3    (구름 돌파, 최강력 매수)
  ichimokuCloudBreakdown:  -3    (구름 붕괴, 최강력 매도)

카테고리 6: Hurst 지수
  hurstTrending:       0  (레짐 필터, 방향 중립)
  hurstMeanReverting:  0  (레짐 필터, 방향 중립)

카테고리 7: 거래량
  volumeBreakout:     +2  (거래량 급증, 중간 매수)
  volumeSelloff:      -2  (투매, 중간 매도)
  volumeExhaustion:    0  (거래량 소진, 방향 중립)
```

### 11.3 가중치 설계 원칙

```
강도 계층 (Murphy 1999 + Nison 2001 기반):

  가중치 3 (최강): 추세 확인 시그널
    -> 골든/데드크로스, 일목 구름 돌파
    -> 이유: 주가와 이동평균의 크로스는 추세 방향의 가장 직접적 확인

  가중치 2~2.5 (강): 모멘텀 전환 + 다이버전스
    -> MACD 크로스, RSI 과매도 탈출, 다이버전스
    -> 이유: 모멘텀 변화는 추세 전환의 선행 지표
    -> 다이버전스(가격-지표 괴리)는 Nison의 "confirmation"보다
       강력한 반전 신호 (Bulkowski 2008: 다이버전스 성공률 ~65%)

  가중치 1.5 (중): 과매수/과매도 진입
    -> RSI 30 이하 진입, BB 하단 반등
    -> 이유: 극단 영역 진입만으로는 반전 확정 불가,
       추가 확인(탈출, 다이버전스)이 필요

  가중치 0 (중립): 방향 미결정 시그널
    -> BB 상단 돌파, 스퀴즈, Hurst 레짐, 거래량 소진
    -> 이유: 방향 자체를 특정할 수 없거나,
       복합 시그널 레벨에서 판단해야 하는 조건
```

Nison, S. (2001), *Japanese Candlestick Charting Techniques*, 2nd Ed.
- 단일봉 < 이중봉 < 삼중봉의 신뢰도 계층 제시
- 캔들스틱과 서양 기술적 지표의 "confirmation" 결합 강조

Bulkowski, T. (2008), *Encyclopedia of Candlestick Charts*
- 103종 캔들스틱 패턴의 통계적 성공률 제시
- 다이버전스 동반 시 성공률 10-15%p 상승

### 11.4 시장 심리 계산 (Sentiment)

```
심리 계산 (signalEngine.js:1072-1131):

  최근 20봉 내 시그널을 대상으로:

  개별 시그널:
    w > 0 -> buyWeight += w
    w < 0 -> sellWeight += |w|

  복합 시그널 (tier별 증폭):
    Tier 1 (강력): tierWeight = 4
    Tier 2 (중간): tierWeight = 2.5
    Tier 3 (약한): tierWeight = 1.5

  종합 심리:
    sentiment = round((buyWeight - sellWeight) / (buyWeight + sellWeight) * 100)
    범위: [-100, +100]
    +100: 완전 강세 (매수 시그널만 존재)
    -100: 완전 약세 (매도 시그널만 존재)
       0: 중립 (매수/매도 균형 또는 시그널 없음)
```

이 방식은 나이브 베이즈(Naive Bayes) 결합(02_statistics.md §5.2)과 달리
가중 합산(weighted sum) 방식이다. 나이브 베이즈는 시그널 간
조건부 독립을 가정하나, 기술적 시그널들은 공통 가격 데이터에서
파생되므로 강한 상관(비독립)을 가진다. 가중 합산은 이 비독립성에
대해 나이브 베이즈보다 견고하다.

### 11.5 복합 시그널 3-Tier 구조

```
COMPOSITE_SIGNAL_DEFS (signalEngine.js:10-94):

Tier 1 (강력, baseConfidence 80-82):
  strongBuy:  해머 + RSI 과매도 탈출 + [거래량 급증]
  strongSell: 유성형 + MACD 데드크로스 + [투매 거래량]
  -> 3개 조건 동시 충족 (2필수 + 1선택)

Tier 2 (중간, baseConfidence 70-72):
  buy:  골든크로스 + [RSI 과매도 탈출 | 거래량]
  sell: 데드크로스 + [MACD 데드크로스 | RSI 과매수 탈출]
  -> 1 필수 + 1-2 선택

Tier 3 (약한, baseConfidence 58-60):
  buy:  BB 하단 반등 + [RSI 과매도 | 거래량]
  sell: BB 상단 돌파 + [RSI 과매수 | 투매]
  -> 1 필수 + 0-2 선택

수렴 윈도우: 5봉 (window=5)
  모든 필수/선택 조건이 최근 5봉 이내에 동시 발생해야 매칭.
  선택 조건 충족 시 optionalBonus (3-5점) 가산.
```

Murphy, J. (1999), *Technical Analysis of the Financial Markets*
- "다중 기법 확인(multiple technique confirmation)" 원칙:
  하나의 시그널만으로 매매 결정하지 않고,
  서로 다른 계열의 지표가 동일 방향을 가리킬 때 신뢰도 상승
- 추세(MA), 모멘텀(RSI/MACD), 캔들(패턴), 거래량의
  4가지 독립 차원에서의 수렴을 권장

참고문헌:
  Murphy, J. (1999), *Technical Analysis of the Financial Markets*,
    New York Institute of Finance
  Nison, S. (2001), *Japanese Candlestick Charting Techniques*, 2nd Ed.,
    Prentice Hall
  Bulkowski, T. (2008), *Encyclopedia of Candlestick Charts*,
    John Wiley & Sons
  Appel, G. (2005), *Technical Analysis: Power Tools for Active Investors*,
    FT Press

코드 매핑: signalEngine.js:101-127 (가중치 테이블), 1072-1131 (심리 계산),
           10-94 (복합 시그널 정의)

---

## 향후 구현 우선순위

| 순위 | 알고리즘 | 난이도 | 기대 효과 |
|------|---------|--------|----------|
| 1 | 패턴 품질 점수 (§3.6, §7) | 낮음 | 오탐 감소 |
| 2 | 거래량 확인 통합 (§7.1) | 낮음 | 신뢰도 향상 |
| 3 | 로버스트 추세선 (§2.3) | 낮음 | 추세선 정확도 향상 |
| 4 | ATR 기반 필터링 (§1.3) | 낮음 | 유의미한 피봇만 선별 |
| 5 | 고급 캔들스틱 패턴 (§8) | 낮음~중간 | 패턴 커버리지 확대 |
| 6 | 피보나치 되돌림/확장 | 중간 | 목표가 제시 |
| 7 | 머리어깨형 (§9.1) | 중간 | 복합 패턴 탐지 |
| 8 | 하모닉 패턴 (§9.4) | 중간 | 피보나치 기반 반전 |
| 9 | 칼만 필터 평활 (§4.3) | 중간 | 노이즈 제거 |
| 10 | DTW 패턴 매칭 (§5.3) | 중간 | 유연한 패턴 인식 |
| 11 | 일목균형표 (06 §7) | 중간 | 종합 지표 추가 |
| 12 | LSTM 패턴 분류 (§5.2) | 높음 | 데이터 기반 패턴 발견 |

---

## 핵심 참고문헌

| 참조 | 저자·제목 | 관련 섹션 |
|------|----------|----------|
| Bulkowski (2005) | *Encyclopedia of Chart Patterns*, 2nd Ed. | §9.1, §9.2 |
| Bulkowski (2012) | *Encyclopedia of Candlestick Charts* | §8 전체 |
| Murphy (1999) | *Technical Analysis of the Financial Markets* | §3.4, §9 전체 |
| Nison (1991) | *Japanese Candlestick Charting Techniques* | §8.1, §8.5 |
| Carney (1999) | *The Harmonic Trader* | §9.4 |
| Frost & Prechter (1978) | *Elliott Wave Principle* | §9.3 |
| O'Neil (1988) | *How to Make Money in Stocks* | §9.2 |
| Kara et al. (2011) | *Predicting Direction of Stock Price Index Movement* | §5.1 |
| Berndt & Clifford (1994) | *Using DTW to Find Patterns in Time Series* | §5.3 |
| Lo (2004) | *The Adaptive Markets Hypothesis* | §10.1 |
| Chordia & Shivakumar (2002) | *Momentum, Business Cycles, and Time-Varying Expected Returns* | §10.3 |
| James & Stein (1961) | *Estimation with Quadratic Loss* | §10.4, 02 §8 |
| DeBondt & Thaler (1985) | *Does the Stock Market Overreact?* | §10.4, 02 §9 |
| Appel (2005) | *Technical Analysis: Power Tools for Active Investors* | §11 |

---

## Phase 3 Calibration 검증 기록 (2026-03-25)

---

### 10.8 M15: R:R 페널티 -15/-5 최적성 검증

**대상 코드**: `patterns.js:1940-1944`

```javascript
// 현재 구현
if (rr < 1.0)       confidence -= 15;   // low 페널티
else if (rr < 1.5)  confidence -= 5;    // high 페널티
```

**Calibration 상태**: 부분 검증 (교정값 산출됨, 코드 미적용)

**데이터 근거** (`calibrated_constants.json` D3_rr_penalty):

```
C-1 교정 임계값: [2.25, 2.5]  (현재 코드: [1.0, 1.5])
D-3 교정 페널티:
  현재:   low=15, high=5
  교정값: low=12.0, high=24.9

방법론:
  - C-1 임계값으로 3구간 분할: below(<2.25), mid([2.25,2.5)), above(≥2.5)
  - Cohen's d (above vs below) = 0.3984, p = 2.8482e-92  → low 페널티 유의
  - Cohen's d (above vs mid)   = 0.8284, p = 1.8340e-21  → high 페널티 유의
  - 페널티 = |d| × PENALTY_SCALE(30)
    -> penalty_low  = 0.398 × 30 = 11.9 ≈ 12.0
    -> penalty_high = 0.828 × 30 = 24.9

구간별 평균 5일 수익률:
  below (<2.25, n=153,865): +0.003%
  mid   ([2.25,2.5), n=146):  -4.912%   ← 중간 R:R이 오히려 최악
  above (≥2.50, n=3,862):  +3.442%
```

**핵심 발견**:
1. 현재 임계값 [1.0, 1.5]는 실제 수익률 차별화 임계값 [2.25, 2.5]보다 훨씬 낮음.
   → KRX에서 R:R 1.5 이하 패턴이 거의 없어 페널티가 거의 발동하지 않는 구조였음.
2. R:R [2.25, 2.5) mid 구간이 below보다 수익률이 낮은 역전 현상 발견.
   이는 소수 표본(n=146)에 의한 통계적 노이즈일 가능성이 높음.
3. high 페널티의 Cohen's d(0.828)가 low(0.398)보다 2배 크므로,
   중간 R:R 구간이 오히려 더 강한 차별화 신호임.

**현재 등급**: D등급 (교정값 산출됨, 코드 미반영)

**권장 조치**: 재calibration 필요
- 임계값을 [1.0, 1.5] → [2.25, 2.5]로, 페널티를 [-15,-5] → [-12,-25]로 변경 검토.
- 단, mid 구간 n=146은 과소 표본이므로 임계값 쌍의 신뢰도를 추가 검증 권장.

---

### 10.9 M17: hw 클램프 [0.6, 1.4] 경계 검증

**대상 코드**: `patterns.js:236`

```javascript
hurstWeight = Math.max(0.6, Math.min(2 * hShrunk, 1.4));
// hShrunk ∈ [0, 1] → 2*hShrunk ∈ [0, 2]
// 클램프 후: hurstWeight ∈ [0.6, 1.4]
```

**Calibration 상태**: 미검증

**데이터 근거**: `calibrated_constants.json`에 hw 클램프 경계 관련 교정 항목 없음.
`calibrate_constants.py`의 5개 교정 대상(C-1, C-2, D-1, D-2, D-3)에 hw 클램프가
포함되지 않았음.

**현재 등급**: B등급 (설계자 선택)

**경계값 설계 근거**:
```
H = 0.3 (극단적 평균 회귀): hShrunk ≈ 0.3, 2×0.3 = 0.6 → 하한 클램프 활성
H = 0.7 (극단적 추세 지속): hShrunk ≈ 0.7, 2×0.7 = 1.4 → 상한 클램프 활성
H = 0.5 (랜덤워크 중립):    hShrunk ≈ 0.5, 2×0.5 = 1.0 → 클램프 비활성

설계 원칙:
  - 중심 1.0 대칭: hurstWeight의 기대값 ≈ 1.0 (중립)
  - 하한 0.6: 패턴 완전 무력화 방지 (최소 60% 신뢰도 유지)
  - 상한 1.4: 과도한 추세 강화 방지 (최대 140%)
```

**향후 검증 방법**:
- `wc_return_pairs.csv`에서 hw 분포의 실제 1~99 퍼센타일 확인
- 클램프 활성 빈도(hw=0.6 또는 1.4 비율) 측정
- 클램프 경계를 [0.5, 1.5] 등으로 변경했을 때 IC 변화 측정 (A/B test)

**권장 조치**: 유지 (calibration 데이터 부재, 설계 근거는 합리적)

---

### 10.10 M19: CANDLE_TARGET_ATR {1.0, 0.7, 0.5} 검증

**대상 코드**: `patterns.js:95`

```javascript
static CANDLE_TARGET_ATR = { strong: 1.0, medium: 0.7, weak: 0.5 };
// Bulkowski 5일 수익률 기반이라 주석됨
```

**Calibration 상태**: 검증됨 (교정값 산출, 코드 미적용)

**데이터 근거** (`calibrated_constants.json` D1_candle_target_atr):

```
방법론:
  - KRX ATR_NORM = 0.025 (평균 ATR/종가 = 2.5%)
  - ATR 배수 = mean(|5일 수익률|%) / (0.025 × 100)
  - Kruskal-Wallis H검정 (비모수적 tier 간 분산 비교)

결과:
  tier    현재값  교정값  n        mean|ret5|  95% CI
  strong  1.0x    1.92x   73,734   4.81%       [1.904, 1.946]
  medium  0.7x    2.21x   28,426   5.52%       [2.177, 2.241]
  weak    0.5x    1.92x   181,925  4.80%       [1.909, 1.933]

Kruskal-Wallis: H=638.19, p=2.63e-139 (tier 간 분포 유의미하게 상이)
```

**핵심 발견**:
1. 현재값(0.5~1.0x)이 실측치(1.92~2.21x)보다 약 2~4배 과소평가됨.
   → Bulkowski 원서의 수치가 KRX 현실과 상이하거나, 목표가 보수적 설정이었음.
2. strong과 weak의 교정값이 동일(1.92x): KRX에서는 강도 tier 간
   5일 절대수익률 차이가 미미함 (4.80% vs 4.81%).
3. medium이 strong보다 높은 이유(2.21x vs 1.92x): medium 패턴(hammer,
   shootingStar, harami 등)이 KRX에서 반전 이후 더 큰 움직임을 보이는 경향.
4. 패턴이 발생한 이후 5일 내 실제 도달 가능한 목표가가 현재 설정의 약 2배임을
   의미하므로, 현재 목표가가 보수적으로 설정되어 있다.

**현재 등급**: D등급 (교정값 산출됨, 코드 미반영)

**권장 조치**: 재calibration 필요
- {strong:1.92, medium:2.21, weak:1.92}로 업데이트 검토.
- 단, 목표가 상향이 패턴 R:R 계산에 연쇄 영향을 주므로 (R:R 상승 → C-1/D-3도
  재교정 필요), 단독 적용 전 전체 파이프라인 영향도 분석 필요.
- 코드 적용 시: `PatternEngine.CANDLE_TARGET_ATR` 정적 상수 수정 후
  `calibrated_constants.json` 코드 반영 여부 플래그 업데이트.
