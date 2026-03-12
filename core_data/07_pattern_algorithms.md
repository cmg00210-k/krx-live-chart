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

가중치: w₁=0.25, w₂=0.15, w₃=0.2, w₄=0.2, w₅=0.2
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
