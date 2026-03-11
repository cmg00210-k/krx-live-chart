# 15. 고급 패턴 분석 — Advanced Pattern Analysis

> 기술적 분석에서 패턴 인식의 수학적 엄밀성을 높이고,
> 패턴 품질 평가, 복합 패턴 탐지, 기계학습 기반 분석,
> 그리고 통계적 백테스팅을 체계화한다.

---

## 1. 패턴 수학적 정의 (Mathematical Pattern Definitions)

### 1.1 OHLCV 튜플 표현

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

### 1.2 패턴을 함수로 정의

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

### 1.3 캔들 구성 요소 비율

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

### 1.4 추세 맥락 정량화 (Trend Context Quantification)

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

---

## 2. 패턴 품질 점수 (Pattern Quality Scoring)

### 2.1 다요인 품질 점수

단순한 이진 탐지를 넘어 패턴의 "이상적 형태"와의 거리를 측정한다.

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

  예: 거래량 비율이 3.0이면 → min(3.0/2.0, 1) = 1.0으로 클리핑
     (2.0 = 200% 거래량을 최대 기준으로 설정)
```

**가중치 최적화 방법**:
```
1단계: 로지스틱 회귀  — y=성공(1)/실패(0), X=[f₁,...,f₅]
2단계: 표준화 계수 추출 — wᵢ = |βᵢ| / Σ|βⱼ|
3단계: Walk-forward 검증 — 훈련(3년) → 테스트(1년) 반복
```

### 2.2 베이지안 패턴 품질

Bayes 정리를 활용하여 패턴 특성이 주어졌을 때 성공 확률을 추정한다.

```
P(success | features) = P(features | success) × P(success) / P(features)

features = (body_ratio, volume_ratio, trend_strength, rsi_position, ...)

사전확률 P(success):
  - 해당 패턴의 역사적 승률 (Bulkowski 통계 활용)
  - 예: 적삼병 승률 ≈ 0.66

우도 P(features | success):
  - 성공한 패턴들의 특성 분포 (kernel density estimation 등)

사후확률 갱신:
  새로운 시장 데이터가 들어올 때마다 베이지안 갱신으로
  패턴 신뢰도를 동적으로 조정

※ "성공"의 정의 (Success Definition):
  패턴 완성 후 N봉 이내에 목표 수익률 달성 여부

  표준 정의 (Bulkowski 기준):
    - 단기: 5봉 이내 종가 > 진입가 (적삼병 기준)
    - 중기: 10봉 이내 종가 > 진입가 + ATR(14)
    - 목표가: 패턴 높이만큼의 추가 상승/하락

  성공률은 정의에 따라 크게 달라짐:
    적삼병 5봉 기준: ~66% (Bulkowski, 2005)
    적삼병 10봉 기준: ~58% (보유 기간↑ → 외부 요인 증가)
    적삼병 목표가 기준: ~45% (높은 기준)
  → 시스템 구현 시 어떤 정의를 사용하는지 반드시 명시
```

### 2.3 ROC 곡선과 AUC (패턴 평가)

패턴 탐지 알고리즘의 전체 성능을 평가하는 프레임워크:

```
ROC (Receiver Operating Characteristic) 곡선:
  x축: FPR = FP / (FP + TN)  (위양성률)
  y축: TPR = TP / (TP + FN)  (진양성률 = 재현율)

AUC (Area Under Curve):
  AUC = ∫₀¹ TPR(FPR) dFPR
  AUC = 0.5: 무작위 수준 (패턴에 예측력 없음)
  AUC > 0.7: 보통 수준의 예측력
  AUC > 0.8: 양호한 예측력
  AUC > 0.9: 우수한 예측력
```

### 2.4 혼동 행렬 (Confusion Matrix) 기반 지표

```
                 예측: 패턴 O    예측: 패턴 X
실제: 성공(반전)    TP            FN
실제: 실패(무반전)  FP            TN

정밀도 (Precision): P = TP / (TP + FP)
  → 패턴으로 탐지했을 때 실제로 성공할 비율

재현율 (Recall):    R = TP / (TP + FN)
  → 실제 성공 사례 중 패턴으로 탐지한 비율

F1 점수:            F1 = 2PR / (P + R)
  → 정밀도와 재현율의 조화평균

Matthews Correlation Coefficient (MCC):
  MCC = (TP×TN - FP×FN) / √((TP+FP)(TP+FN)(TN+FP)(TN+FN))
  → 불균형 데이터에서 더 신뢰할 수 있는 지표
  → MCC ∈ [-1, 1], MCC > 0.3: 유의미한 패턴
```

---

## 3. 고급 캔들스틱 패턴 (Advanced Candlestick Patterns)

### 3.1 상승 삼법 (Rising Three Methods)

Nison (1991), *Japanese Candlestick Charting Techniques*

강한 상승 추세에서의 지속 패턴. 최소 5봉으로 구성.

```
수학적 정의:

봉 0: 큰 양봉 (기준봉)
  d₀ = +1,  body₀ / ATR > 0.7

봉 1, 2, 3: 소형 음봉 (되돌림)
  ∀ k ∈ {1, 2, 3}:
    d_k = -1
    body_k < body₀ × 0.5           (작은 몸통)
    l_k > l₀                        (기준봉 저가 위에 유지)
    h_k < h₀                        (기준봉 고가 아래에 유지)

봉 4: 큰 양봉 (확인봉)
  d₄ = +1
  c₄ > h₀                           (기준봉 고가 돌파)
  body₄ / ATR > 0.5

거래량 조건 (선택적):
  v₀ > avg_vol  AND  v₄ > avg_vol   (기준봉과 확인봉에서 거래량 증가)
  v₁, v₂, v₃ < avg_vol              (되돌림에서 거래량 감소)

품질 점수:
  Q(삼법) = w₁ × (body₀/ATR) + w₂ × (c₄ - h₀)/ATR
          + w₃ × (1 - max_penetration/range₀) + w₄ × vol_pattern
```

하락 삼법 (Falling Three Methods): 모든 조건의 대칭 역전.

### 3.2 버려진 아기 (Abandoned Baby)

매우 드문 강력한 반전 패턴. 갭을 동반한 도지형.

```
강세 버려진 아기 (Bullish Abandoned Baby):

봉 0: 큰 음봉
  d₀ = -1,  body₀ / ATR > 0.5

봉 1: 도지 + 갭다운
  b₁ < 0.05                          (도지: 시가 ≈ 종가)
  h₁ < l₀                            (완전한 하방 갭)
  → gap₁ = l₀ - h₁ > 0

봉 2: 큰 양봉 + 갭업
  d₂ = +1,  body₂ / ATR > 0.5
  l₂ > h₁                            (완전한 상방 갭)
  → gap₂ = l₂ - h₁ > 0

핵심: 도지(봉 1)가 양쪽 갭에 의해 고립 ("abandoned")
  gap₁ > 0 AND gap₂ > 0              (필수 조건)

약세 버려진 아기: 조건 대칭 역전
  봉 0: 큰 양봉, 봉 1: 갭업 도지, 봉 2: 갭다운 큰 음봉
```

참고: KRX 시장에서는 가격 제한폭(상·하한가)으로 인해 갭이 제한적일 수 있으며,
장 시작 시 갭이 주로 발생한다. 일봉 차트에서의 탐지가 가장 적합하다.

### 3.3 상승/하락 반격형 (Three Inside Up / Three Inside Down)

Harami 패턴의 확인 버전. 3봉 구조.

```
상승 반격형 (Three Inside Up):

봉 0: 큰 음봉
  d₀ = -1,  body₀ / ATR > 0.4

봉 1: 소형 양봉, 봉 0의 몸통 내에 포함 (Bullish Harami)
  d₁ = +1
  o₁ > c₀  AND  c₁ < o₀             (봉 0의 몸통 범위 내)
  → 즉, min(o₀, c₀) < o₁ AND c₁ < max(o₀, c₀)

봉 2: 양봉, 봉 0의 시가(고가 쪽) 돌파 (확인)
  d₂ = +1
  c₂ > o₀                            (봉 0의 시가 상향 돌파)

하락 반격형 (Three Inside Down): 조건 대칭 역전

품질 점수:
  Q = w₁ × (body₀/ATR)               // 기준봉 크기
    + w₂ × (1 - body₁/body₀)         // 내포봉이 작을수록 좋음
    + w₃ × (c₂ - o₀)/ATR             // 돌파 크기
    + w₄ × vol_confirmation           // 거래량 패턴
```

### 3.4 차오르는 패턴 (Kicking Pattern)

두 개의 마루보즈가 반대 방향으로 연속하는 강력한 반전 신호.

```
강세 차오르는 패턴 (Bullish Kicking):

봉 0: 음봉 마루보즈
  d₀ = -1
  us₀ < 0.02  AND  ls₀ < 0.02       (꼬리 거의 없음)
  body₀ / ATR > 0.6

봉 1: 양봉 마루보즈 + 갭업
  d₁ = +1
  us₁ < 0.02  AND  ls₁ < 0.02
  body₁ / ATR > 0.6
  o₁ > h₀                            (갭업)

약세 차오르는 패턴: 조건 대칭 역전

마루보즈 판정 완화 기준 (실전 적용):
  꼬리 허용: us, ls < 0.05 (5% 이내)
  → 실제 시장에서 완벽한 마루보즈는 매우 드묾
```

### 3.5 석별형/샛별형 도지 변형 (Evening/Morning Doji Star)

기본 석별형/샛별형에서 중간 봉이 도지인 강화 버전.

```
샛별 도지형 (Morning Doji Star):

봉 0: 큰 음봉 (하락 추세 중)
  d₀ = -1,  body₀ / ATR > 0.5
  TrendScore(prev k candles) < -0.3   (선행 하락 추세)

봉 1: 도지 + 하방 갭
  b₁ < 0.05                           (도지 조건)
  max(o₁, c₁) < c₀                    (갭다운 또는 근접)
  → gap_down = c₀ - max(o₁, c₁)

봉 2: 큰 양봉 + 상방 갭
  d₂ = +1,  body₂ / ATR > 0.4
  c₂ > (o₀ + c₀) / 2                  (봉 0 몸통의 50% 이상 회복)

석별 도지형 (Evening Doji Star): 조건 대칭 역전

일반 석별/샛별과의 차이:
  도지 변형은 b₁ < 0.05 (시가 ≈ 종가)
  일반 변형은 b₁ < 0.3 (소형 몸통)
  → 도지 변형이 더 강한 반전 신호 (불확실성 극대화)
```

### 3.6 패턴 수학적 정형화 요약표

| 패턴 | 봉수 | 핵심 수학 조건 | 유형 |
|------|------|---------------|------|
| 상승 삼법 (Rising Three Methods) | 5+ | 기준봉 내 되돌림 + 돌파 | 지속 |
| 버려진 아기 (Abandoned Baby) | 3 | gap₁ > 0 ∧ gap₂ > 0 ∧ b₁ < 0.05 | 반전 |
| 상승 반격형 (Three Inside Up) | 3 | Harami + 확인봉 돌파 | 반전 |
| 차오르는 패턴 (Kicking) | 2 | 마루보즈 반전 + 갭 | 반전 |
| 샛별 도지형 (Morning Doji Star) | 3 | 도지 + 양방향 갭 | 반전 |
| 하락 삼법 (Falling Three Methods) | 5+ | 대칭 역전 | 지속 |
| 하락 반격형 (Three Inside Down) | 3 | 대칭 역전 | 반전 |
| 석별 도지형 (Evening Doji Star) | 3 | 대칭 역전 | 반전 |

---

## 4. 복합 차트 패턴 (Complex Chart Patterns)

### 4.1 머리어깨형 수학적 탐지 (Head and Shoulders Detection)

Bulkowski (2005), *Encyclopedia of Chart Patterns*

```
구조: 3개의 피크 (왼쪽 어깨, 머리, 오른쪽 어깨) + 넥라인

정의:
  P₁ = (idx₁, price₁): 왼쪽 어깨 (Left Shoulder)
  P₂ = (idx₂, price₂): 머리 (Head)
  P₃ = (idx₃, price₃): 오른쪽 어깨 (Right Shoulder)
  T₁ = (tidx₁, tprice₁): 어깨-머리 사이 저점
  T₂ = (tidx₂, tprice₂): 머리-어깨 사이 저점

탐지 조건:
  1) 순서: idx₁ < idx₂ < idx₃
  2) 머리가 최고: price₂ > price₁ AND price₂ > price₃
  3) 어깨 대칭성: |price₁ - price₃| / price₂ < ε₁  (ε₁ ≈ 0.03)
  4) 넥라인: tprice₁과 tprice₂를 연결하는 직선
     neckline(idx) = tprice₁ + (tprice₂ - tprice₁) × (idx - tidx₁) / (tidx₂ - tidx₁)
  5) 넥라인 기울기: |slope_neckline| < ε₂ (과도한 기울기 제외)
  6) 시간 대칭성: |( idx₂ - idx₁) - (idx₃ - idx₂)| / (idx₃ - idx₁) < ε₃ (ε₃ ≈ 0.4)

목표가 (Price Target):
  target = neckline(breakpoint) - (price₂ - neckline(idx₂))

돌파 확인:
  close[t] < neckline(t) for t > idx₃ → 하방 돌파 확인

역머리어깨형 (Inverse Head and Shoulders): 모든 부등호 반전
```

### 4.2 컵앤핸들 수학적 탐지 (Cup and Handle Detection)

William O'Neil (1988), *How to Make Money in Stocks*

```
컵 (Cup): U자형 곡선 — 2차 함수 피팅

  price(t) ≈ a(t - t_center)² + price_min

  피팅 과정:
  1) 구간 [t_start, t_end]에서 최소가 price_min 위치 t_center 탐색
  2) 최소제곱법으로 2차 함수 계수 a 추정:
     a = Σ(pᵢ - price_min)(tᵢ - t_center)² / Σ(tᵢ - t_center)⁴
  3) 피팅 품질 검증: R² > 0.6

  컵 조건:
  - a > 0 (U자형, 위로 볼록하지 않음)
  - 깊이: (price_rim - price_min) / price_rim ∈ [0.12, 0.35]
  - 기간: 7주 ~ 65주 (일봉 기준 35 ~ 325봉)
  - 좌우 림 높이 근사: |price_left_rim - price_right_rim| / price_rim < 0.05

핸들 (Handle): 짧은 하방 되돌림
  1) 컵 오른쪽 림 이후 소폭 하락 구간 탐색
  2) handle_depth < cup_depth × 0.5
  3) handle_duration < cup_duration × 0.3
  4) 핸들 기울기: slope ≤ 0 (하방 또는 수평)

돌파:
  close > price_right_rim → 매수 신호
  목표가 = price_right_rim + cup_depth
```

### 4.3 엘리엇 파동 자동 카운팅 (Automated Elliott Wave Counting)

Frost & Prechter (1978), *Elliott Wave Principle*

```
파동 규칙을 수학적 제약 조건으로 변환:

임펄스 파동 (5파) 제약 조건:
  R1) Wave 2는 Wave 1의 시작점 아래로 하락 불가
      low(W2) > start(W1)

  R2) Wave 3는 Wave 1, 3, 5 중 가장 짧을 수 없음
      |W3| ≥ |W1| OR |W3| ≥ |W5|
      (실무적으로 |W3| > |W1| × 1.0)

  R3) Wave 4는 Wave 1의 가격 영역에 겹치지 않음
      low(W4) > high(W1)

피보나치 가이드라인 (엄격한 규칙은 아님):
  G1) |W2| ∈ [0.382, 0.786] × |W1|    (되돌림)
  G2) |W3| ∈ [1.618, 2.618] × |W1|    (확장)
  G3) |W4| ∈ [0.236, 0.500] × |W3|    (되돌림)
  G4) |W5| ∈ [0.618, 1.618] × |W1|    (확장)

탐색 알고리즘 (Exhaustive Search with Pruning):
  1) 스윙 포인트 집합 S = {s₁, s₂, ..., sₘ} 탐색
  2) 5개 포인트의 가능한 조합 C(m, 5) 생성
  3) 각 조합에 대해 R1, R2, R3 검증 → 위반 시 가지치기
  4) G1~G4 적합도 점수 계산
  5) 최고 점수 조합 선택

시간복잡도: O(m⁵) 최악, 가지치기로 실제 O(m²~m³)
```

### 4.4 하모닉 패턴 (Harmonic Patterns)

Scott Carney (1999), *The Harmonic Trader*

피보나치 비율의 기하학적 조합으로 정의되는 가격 패턴.

```
기본 구조: X-A-B-C-D 5점 패턴
  X → A: 초기 움직임 (Leg XA)
  A → B: 되돌림 (Leg AB)
  B → C: 확장 (Leg BC)
  C → D: 최종 (Leg CD)

가틀리 (Gartley) 패턴:
  AB = 0.618 × XA          (허용: ±ε, ε ≈ 0.02)
  BC ∈ [0.382, 0.886] × AB
  CD = 1.272 × BC  또는  CD = 1.618 × BC
  AD = 0.786 × XA          (D점 결정 조건)

나비 (Butterfly) 패턴:
  AB = 0.786 × XA
  BC ∈ [0.382, 0.886] × AB
  CD ∈ [1.618, 2.618] × BC
  AD = 1.272 × XA  또는  AD = 1.618 × XA

박쥐 (Bat) 패턴:
  AB ∈ [0.382, 0.500] × XA
  BC ∈ [0.382, 0.886] × AB
  CD ∈ [1.618, 2.618] × BC
  AD = 0.886 × XA

게 (Crab) 패턴:
  AB ∈ [0.382, 0.618] × XA
  BC ∈ [0.382, 0.886] × AB
  CD ∈ [2.240, 3.618] × BC
  AD = 1.618 × XA

허용 범위 (Tolerance):
  각 비율 조건에 ε = 0.02~0.05의 허용 범위 적용
  비율 적합도 점수:
    fit(ratio, target) = 1 - |ratio - target| / target

  적합도 집계 (Fitness Aggregation):

    곱 방식 (엄격): overall_fit = Π fit_i
      → 하나의 비율이 부적합하면 전체 점수 급락 (과도하게 엄격)

    기하평균 방식 (권장): overall_fit = (Π fit_i)^(1/n)
      → 개별 부적합의 영향을 완화하면서도 전체 균형 반영

    가중 기하평균 (고급): overall_fit = Π fit_i^(wᵢ)
      → 핵심 비율(XA, AB)에 높은 가중치 부여 가능
      예: w_XA = 0.3, w_AB = 0.25, w_BC = 0.2, w_CD = 0.25
```

**하모닉 패턴 비율 요약표**:

| 패턴 | AB/XA | BC/AB | CD/BC | AD/XA |
|------|-------|-------|-------|-------|
| Gartley | 0.618 | 0.382~0.886 | 1.272~1.618 | 0.786 |
| Butterfly | 0.786 | 0.382~0.886 | 1.618~2.618 | 1.272~1.618 |
| Bat | 0.382~0.500 | 0.382~0.886 | 1.618~2.618 | 0.886 |
| Crab | 0.382~0.618 | 0.382~0.886 | 2.240~3.618 | 1.618 |

---

## 5. 패턴 조합과 확률 (Pattern Combinations and Probability)

### 5.1 복합 신호의 결합 확률

여러 독립적 패턴/지표가 동시에 발생할 때의 확률:

```
독립 가정 하 결합 확률:
  P(A ∩ B) = P(A) × P(B)

그러나 기술적 지표는 일반적으로 독립이 아니다.
→ 의존 구조를 반영:

상관 조건부 결합:
  P(A ∩ B) = P(A) × P(B|A)

코풀라(Copula) 기반 결합:
  C(u, v; θ) = P(F_A⁻¹(u), F_B⁻¹(v))
  u = F_A(a), v = F_B(b)
  θ: 의존성 파라미터

예시:
  A = "적삼병 탐지",  P(A) = 0.03 (발생 빈도)
  B = "RSI < 30",     P(B) = 0.10
  상관계수 ρ(A,B) = 0.35  (양의 상관: 과매도에서 적삼병 더 자주 발생)
  P(A ∩ B) ≈ 0.03 × 0.10 + ρ × √(P(A)(1-P(A)) × P(B)(1-P(B)))
```

### 5.2 조건부 확률과 다중 확인

```
다중 신호 확인의 조건부 확률:

P(success | pattern ∩ volume_up ∩ trend_aligned)

베이즈 정리 적용:
  = P(pattern ∩ vol ∩ trend | success) × P(success)
    ─────────────────────────────────────────────────
                   P(pattern ∩ vol ∩ trend)

나이브 베이즈 근사 (조건부 독립 가정):
  P(success | f₁, f₂, ..., fₙ) ∝ P(success) × Π P(fᵢ | success)

실전 수치 예시 (Bulkowski 통계 기반):
  P(반등 | 적삼병) ≈ 0.66
  P(반등 | 적삼병 ∩ 거래량↑) ≈ 0.74
  P(반등 | 적삼병 ∩ 거래량↑ ∩ RSI<30) ≈ 0.82
  → 확인 신호가 추가될수록 조건부 확률 상승
```

### 5.3 순차 패턴 분석: 마르코프 체인

캔들스틱 패턴의 순서적 전이 확률을 모델링한다.

```
상태 정의:
  S = {양봉, 음봉, 도지, 해머, 유성형, 장악형, ...}

전이 확률 행렬:
  P(Sₜ₊₁ = j | Sₜ = i) = pᵢⱼ

  예시 (KRX 데이터 기반 추정):
       양봉  음봉  도지
  양봉  0.52  0.38  0.10
  음봉  0.40  0.48  0.12
  도지  0.45  0.40  0.15

n-step 전이:
  P(Sₜ₊ₙ = j | Sₜ = i) = [Pⁿ]ᵢⱼ  (행렬 거듭제곱)

정상 분포 (Stationary Distribution):
  πP = π,  Σπᵢ = 1
  → 장기적으로 각 패턴의 출현 빈도
```

### 5.4 패턴 합류 구역 (Confluence Zones)

```
합류 구역: 여러 독립적 분석 기법이 같은 가격대를 가리키는 영역

합류 점수 (Confluence Score):
  CS(price_level) = Σᵢ wᵢ × 1(|signal_i - price_level| < δ)

  signal_i: 개별 분석 결과 (피보나치 수준, 지지/저항, 추세선 등)
  δ: 허용 범위 (일반적으로 ATR × 0.1)
  wᵢ: 각 신호의 가중치

  CS > 3: 강한 합류 → 높은 신뢰도
  CS = 2: 보통 합류
  CS = 1: 단일 신호 → 낮은 신뢰도
```

### 5.5 정보 내용: 조합의 정보 이득

```
개별 신호의 정보량 (Shannon Entropy):
  H(X) = -Σ P(xᵢ) log₂ P(xᵢ)

조건부 엔트로피:
  H(Y|X) = -Σₓ P(x) Σᵧ P(y|x) log₂ P(y|x)

상호 정보량 (Mutual Information):
  I(X; Y) = H(Y) - H(Y|X)
  → X를 알았을 때 Y의 불확실성 감소량

복합 신호의 정보 이득:
  I(X₁, X₂, ..., Xₙ; Y) ≥ max{I(Xᵢ; Y)}
  → 복합 신호의 정보량은 개별 신호 중 최대값 이상

그러나 중복(redundancy) 존재:
  I(X₁, X₂; Y) ≤ I(X₁; Y) + I(X₂; Y)
  → 상관된 신호의 결합은 단순 합보다 작음

시너지(Synergy):
  Syn(X₁, X₂; Y) = I(X₁, X₂; Y) - I(X₁; Y) - I(X₂; Y) + I(X₁; X₂)
  Syn > 0: 두 신호의 조합이 개별 신호의 합보다 더 많은 정보 제공
```

---

## 6. 기계학습 기반 패턴 분석 (ML-Based Pattern Analysis)

### 6.1 CNN 기반 시각적 패턴 인식

Tsantekidis et al. (2017); Jiang et al. (2020)

```
접근법: 캔들스틱 차트를 이미지로 변환 → CNN 분류

입력: 차트 이미지 I ∈ ℝᵂˣᴴˣ³ (W×H 픽셀, RGB 3채널)

아키텍처:
  Layer 1: Conv2D(32, 3×3) → ReLU → MaxPool(2×2)
  Layer 2: Conv2D(64, 3×3) → ReLU → MaxPool(2×2)
  Layer 3: Conv2D(128, 3×3) → ReLU → MaxPool(2×2)
  Layer 4: Flatten → Dense(256) → Dropout(0.5)
  Layer 5: Dense(K) → Softmax

  K: 분류할 패턴 수 (예: 적삼병, 흑삼병, 삼각형, 쐐기, ...)

출력: ŷ = argmax softmax(Wx + b)
  P(class_k | image) = softmax_k

손실 함수: Categorical Cross-Entropy
  L = -Σₖ yₖ log ŷₖ

장점:
  - 인간과 유사한 시각적 인식 방식
  - 명시적 규칙 정의 불필요
  - 복합 패턴(머리어깨, 컵앤핸들) 탐지에 유리

한계:
  - 대량의 레이블 데이터 필요 (최소 수천 장)
  - 차트 스케일, 시간축에 민감
  - 해석 불가능성 (Black Box)
```

### 6.2 LSTM/GRU 기반 순차 패턴 탐지

Hochreiter & Schmidhuber (1997); Cho et al. (2014)

```
접근법: OHLCV 시계열을 순차적으로 처리

LSTM 셀 구조:
  fₜ = σ(Wf · [hₜ₋₁, xₜ] + bf)       (망각 게이트)
  iₜ = σ(Wi · [hₜ₋₁, xₜ] + bi)       (입력 게이트)
  C̃ₜ = tanh(Wc · [hₜ₋₁, xₜ] + bc)    (후보 셀)
  Cₜ = fₜ ⊙ Cₜ₋₁ + iₜ ⊙ C̃ₜ          (셀 갱신)
  oₜ = σ(Wo · [hₜ₋₁, xₜ] + bo)       (출력 게이트)
  hₜ = oₜ ⊙ tanh(Cₜ)                 (은닉 상태)

GRU 셀 (간소화 버전):
  zₜ = σ(Wz · [hₜ₋₁, xₜ])            (갱신 게이트)
  rₜ = σ(Wr · [hₜ₋₁, xₜ])            (리셋 게이트)
  h̃ₜ = tanh(W · [rₜ ⊙ hₜ₋₁, xₜ])     (후보)
  hₜ = (1 - zₜ) ⊙ hₜ₋₁ + zₜ ⊙ h̃ₜ    (은닉 갱신)

입력: xₜ = (oₜ, hₜ, lₜ, cₜ, vₜ, rsi_t, macd_t, ...) ∈ ℝᵈ
  d: 특성 차원 (OHLCV + 기술적 지표)

윈도우 방식:
  입력 시퀀스: (xₜ₋ₙ, xₜ₋ₙ₊₁, ..., xₜ)  — n봉 윈도우
  출력: P(pattern_class | sequence)

양방향 LSTM (Bidirectional LSTM):
  → 패턴 탐지에 유리 (미래 봉 정보도 활용)
  h_forward = LSTM_forward(x₁, ..., xₜ)
  h_backward = LSTM_backward(xₜ, ..., x₁)
  h_combined = [h_forward; h_backward]
```

### 6.3 어텐션 메커니즘 (Attention Mechanism)

Vaswani et al. (2017), *Attention Is All You Need*

```
캔들스틱 패턴에서 핵심 봉을 자동으로 식별:

Scaled Dot-Product Attention:
  Attention(Q, K, V) = softmax(QKᵀ / √dₖ) V

  Q = XWq  (Query: "어떤 봉이 중요한가?")
  K = XWk  (Key: "각 봉의 특성")
  V = XWv  (Value: "각 봉의 정보")

Multi-Head Attention:
  MultiHead(Q, K, V) = Concat(head₁, ..., headₕ) Wo
  headᵢ = Attention(QWᵢq, KWᵢk, VWᵢv)

금융 적용:
  - 적삼병 패턴에서 어텐션 → 첫 번째 양봉(추세 전환 시작)에 높은 가중치
  - 석별형에서 어텐션 → 도지 봉에 높은 가중치
  - 어텐션 가중치 시각화 → 패턴의 해석 가능성(interpretability) 향상
```

### 6.4 전이 학습 (Transfer Learning)

다른 시장/시간프레임에서 학습한 패턴 지식을 KRX 데이터에 적용:

```
전이 학습 전략:

Source Domain: 대규모 해외 시장 데이터 (S&P 500, NASDAQ)
  → 풍부한 데이터로 일반적 패턴 특성 학습

Target Domain: KRX 개별 종목
  → 데이터 부족 문제 해결

방법론:
  1) Source에서 기본 모델 M_source 학습
  2) M_source의 하위 레이어(특성 추출기) 동결
  3) 상위 레이어만 KRX 데이터로 파인튜닝

Domain Adaptation Loss:
  L_total = L_task + λ × L_domain
  L_domain: Maximum Mean Discrepancy (MMD) 또는 DANN

시간프레임 전이:
  일봉에서 학습한 패턴 → 분봉에 적용
  (패턴의 프랙탈 자기유사성 활용)

※ 주의: 프랙탈 자기유사성의 한계
  - 금융 데이터의 프랙탈 특성은 통계적 속성(분포 형태)에 대한 것이며,
    개별 패턴의 형태적 유사성을 보장하지 않음
  - 일봉 적삼병과 분봉 적삼병은 동일한 형태이나,
    매매 주체(기관 vs 개인), 거래량 프로필, 시장 미시구조가 상이
  - 실증 연구 결과: 시간프레임 전이 성과는 혼재
    (일봉→주봉: 양호, 일봉→1분봉: 저조)
  - 권장: 전이 학습 시 목표 시간프레임에서의 파인튜닝 필수
```

### 6.5 SHAP 기반 특성 중요도 분석

Lundberg & Lee (2017), *A Unified Approach to Interpreting Model Predictions*

```
SHAP (SHapley Additive exPlanations):

  ϕᵢ(f, x) = Σ_{S⊆N\{i}} |S|!(|N|-|S|-1)! / |N|! × [f(S∪{i}) - f(S)]

  ϕᵢ: 특성 i의 SHAP 값 (예측에 대한 기여도)
  N: 전체 특성 집합
  S: 특성 i를 제외한 부분집합

패턴 분석 적용:
  특성: (body_ratio, upper_shadow, lower_shadow, volume_change,
         rsi, macd_hist, trend_slope, atr_ratio, gap_size, ...)

  SHAP 분석 결과 예시:
    적삼병 탐지 모델:
      body_ratio:      ϕ = +0.25 (가장 중요)
      lower_shadow:    ϕ = -0.08 (아래꼬리 없을수록 좋음)
      volume_change:   ϕ = +0.15
      trend_slope:     ϕ = -0.12 (이전 하락이 클수록 유리)

  → 모델의 "논리"가 전통적 패턴 정의와 일치하는지 검증 가능
```

---

## 7. 패턴 백테스팅 수학 (Pattern Backtesting Mathematics)

### 7.1 워크포워드 분석 프레임워크 (Walk-Forward Analysis)

```
전체 데이터: [t₀ ─────────────────────────── tₙ]

윈도우 k=1: [──── Train₁ ────][── Test₁ ──]
윈도우 k=2:      [──── Train₂ ────][── Test₂ ──]
윈도우 k=3:           [──── Train₃ ────][── Test₃ ──]
   ...

각 윈도우에서:
  1) Train 기간: 패턴 파라미터 최적화 (임계값 조정 등)
  2) Test 기간: 최적화된 파라미터로 성과 측정

최종 성과 = 모든 Test 구간 성과의 합산/평균

Walk-Forward Efficiency (WFE):
  WFE = (Test 성과 / Train 성과) × 100%
  WFE > 50%: 전략이 과적합되지 않았음을 시사
  WFE < 30%: 과적합 의심
```

### 7.2 표본 외 검정 방법론 (Out-of-Sample Testing)

```
데이터 분할:
  In-Sample (IS):    70%  — 모델 학습/파라미터 최적화
  Out-of-Sample (OOS): 30%  — 성과 검증

시간 순서 보존 (Time Series Split):
  IS:  [t₀ ──────── t_split]
  OOS: [t_split ──── tₙ]
  → 미래 데이터로 과거 모델 검증 (무작위 분할 금지)

K-Fold 시계열 교차검증:
  Fold 1: Train [1] → Test [2]
  Fold 2: Train [1,2] → Test [3]
  Fold 3: Train [1,2,3] → Test [4]
  ...
  → 학습 데이터는 항상 테스트 데이터보다 시간적으로 선행

성과 지표:
  OOS Return: 표본 외 기간의 총 수익률
  OOS Sharpe: 표본 외 샤프 비율
  IS/OOS Ratio: IS 성과 대비 OOS 성과 비율
```

### 7.3 다중 가설 검정 보정 (Multiple Hypothesis Testing Correction)

수많은 패턴을 동시에 검정할 때 우연한 발견(data snooping) 방지:

```
문제:
  m개의 패턴을 α = 0.05 수준으로 각각 검정
  → 하나 이상 거짓 양성 확률: 1 - (1-α)ᵐ
  → m = 20이면: 1 - 0.95²⁰ ≈ 0.64 (64%!)

본페로니 보정 (Bonferroni Correction):
  조정된 유의 수준: α* = α / m
  m = 20, α = 0.05 → α* = 0.0025
  → 보수적 (검정력 손실)

벤자미니-호흐베르크 (Benjamini-Hochberg FDR):
  1) m개의 p-value를 오름차순 정렬: p₍₁₎ ≤ p₍₂₎ ≤ ... ≤ p₍ₘ₎
  2) k = max{i : p₍ᵢ₎ ≤ i/m × α}
  3) p₍₁₎, ..., p₍ₖ₎ 에 대응하는 패턴만 유의
  → False Discovery Rate ≤ α
  → 본페로니보다 검정력이 높음

White의 Reality Check (2000):
  부트스트랩 기반으로 최우수 전략의 유의성 검정
  → 데이터 마이닝 편향 직접 통제

Hansen의 SPA 검정 (2005):
  White의 Reality Check 개선 — 검정력 향상
```

### 7.4 부트스트랩 신뢰 구간 (Bootstrap Confidence Intervals)

```
패턴 수익률의 신뢰 구간을 비모수적으로 추정:

알고리즘:
  원본 데이터: X = {x₁, x₂, ..., xₙ}  (패턴 발생 후 수익률)
  θ̂ = 통계량(X)  (예: 평균 수익률, 승률)

  B = 10,000번 반복:
    1) X에서 복원추출로 크기 n의 표본 X*_b 생성
    2) θ̂*_b = 통계량(X*_b) 계산

  부트스트랩 분포: {θ̂*₁, θ̂*₂, ..., θ̂*_B}

퍼센타일 신뢰 구간:
  95% CI: [θ̂*_(0.025B), θ̂*_(0.975B)]

BCa 신뢰 구간 (Bias-Corrected and Accelerated):
  편향과 왜도를 보정 → 더 정확한 커버리지

예시:
  적삼병 후 5봉 수익률 부트스트랩 결과:
  평균 수익률: 0.82%
  95% CI: [0.35%, 1.28%]
  → 0%를 포함하지 않으므로 통계적으로 유의

※ 금융 시계열 부트스트랩 주의사항:

  표준 부트스트랩 (i.i.d. 가정):
    개별 수익률을 무작위 복원 추출 → 자기상관 구조 파괴
    → 변동성 클러스터링, 모멘텀 효과가 사라짐
    → 신뢰구간이 과도하게 넓거나 좁을 수 있음

  블록 부트스트랩 (Block Bootstrap, 권장):
    연속 블록(예: 20거래일)을 단위로 복원 추출
    → 자기상관 구조 보존
    블록 크기 선택: l = T^(1/3) (Lahiri, 2003)
    예: T=1000일 → l ≈ 10일 블록

  정상 블록 부트스트랩 (Stationary Block Bootstrap):
    블록 크기를 기하분포에서 랜덤 추출 (Politis & Romano, 1994)
    → 블록 경계의 인위적 효과 제거
```

### 7.5 생존 편향 및 선행 편향 방지

```
생존 편향 (Survivorship Bias):
  문제: 상장폐지된 종목을 제외하면 결과가 상향 편향
  방지:
    - 과거 시점의 전체 종목 목록 사용 (상폐 종목 포함)
    - KRX 과거 구성종목 데이터 확보 필수
    - "지금 살아있는 종목"만 분석 → 위험!

선행 편향 (Look-Ahead Bias):
  문제: 미래 데이터를 현재 시점 의사결정에 사용
  방지:
    - 패턴 탐지 시 t 시점에서 t+1 이후 데이터 참조 금지
    - 가격 조정(배당, 액면분할) 시 해당 시점 기준 적용
    - Point-in-Time 데이터 사용
    - 코드 검증: 미래 인덱스 참조 자동 검출

데이터 스누핑 편향 (Data Snooping Bias):
  문제: 같은 데이터로 다수 전략 탐색 → 우연한 "최적" 전략 발견
  방지:
    - §7.3의 다중 가설 검정 보정 적용
    - 독립된 표본 외 데이터로 최종 검증
    - White (2000), Hansen (2005)의 검정 적용
```

### 7.6 통계적 유의성 검정

```
단일 표본 t-검정 (패턴 수익률 ≠ 0 검정):
  H₀: μ = 0  (패턴이 예측력 없음)
  H₁: μ ≠ 0  (패턴이 유의한 수익 제공)

  t = (x̄ - 0) / (s / √n)
  df = n - 1
  p-value = 2 × P(T > |t|)

  결과 해석:
    p < 0.05: 유의 수준 5%에서 기각 → 패턴 유효
    p < 0.01: 강한 증거
    p > 0.10: 증거 불충분

Wilcoxon 부호 순위 검정 (비모수적 대안):
  → 수익률 분포가 정규분포를 따르지 않을 때 사용
  → 금융 수익률의 두꺼운 꼬리(fat tail)에 적합

  H₀: 수익률 분포가 0에 대해 대칭
  검정 통계량: W = Σ sign(xᵢ) × rank(|xᵢ|)

이표본 검정 (패턴 발생 vs 비발생 비교):
  t-검정 또는 Mann-Whitney U 검정:
  H₀: μ_pattern = μ_no_pattern
  → 패턴 발생 후 수익률이 랜덤 시점보다 유의하게 높은가?

효과 크기 (Effect Size):
  Cohen's d = (x̄_pattern - x̄_no_pattern) / s_pooled
  d > 0.2: 작은 효과
  d > 0.5: 중간 효과
  d > 0.8: 큰 효과
  → p-value만으로는 실전적 의미를 판단할 수 없으므로
    효과 크기와 함께 보고할 것
```

---

## 8. 구현 로드맵 (Implementation Roadmap)

### Phase 1: 현행 패턴 품질 강화

```
목표: 기존 패턴 탐지(patterns.js)에 품질 점수 추가

구현 항목:
  ✦ 각 패턴에 quality_score ∈ [0, 1] 반환
  ✦ 몸통 비율, 꼬리 비율, 거래량 비교 기반 점수
  ✦ 추세 맥락 반영 (TrendScore)
  ✦ 점수 임계값으로 오탐 필터링 (quality > 0.5만 표시)

기대 효과:
  - 오탐률 30~50% 감소
  - 사용자에게 패턴 신뢰도 시각적 표시

난이도: 낮음
기반 이론: §2.1 다요인 품질 점수
```

### Phase 2: 고급 캔들스틱 패턴

```
목표: 새로운 캔들스틱 패턴 추가

구현 순서 (기대효과/난이도 순):
  1. Three Inside Up/Down (§3.3): Harami 확인 → 신뢰도 높음
  2. Rising/Falling Three Methods (§3.1): 지속 패턴 보강
  3. Morning/Evening Doji Star (§3.5): 기존 별형의 강화 버전
  4. Kicking Pattern (§3.4): 마루보즈 반전
  5. Abandoned Baby (§3.2): 갭 기반 (KRX 적용 시 주의)

각 패턴에 §2 품질 점수 내장

난이도: 낮음~중간
기반 이론: §3 전체
```

### Phase 3: 복합 차트 패턴

```
목표: 다봉 구조의 복합 차트 패턴 자동 탐지

구현 순서:
  1. Head and Shoulders (§4.1):
     - 스윙 포인트 기반 탐지
     - 넥라인 자동 그리기
     - 목표가 계산

  2. Harmonic Patterns (§4.4):
     - Gartley, Butterfly 우선
     - 피보나치 비율 검증 + 허용 범위
     - PRZ (Potential Reversal Zone) 표시

  3. Cup and Handle (§4.2):
     - 2차 함수 피팅
     - R² 기반 품질 검증

  4. Elliott Wave (§4.3):
     - 규칙 기반 자동 카운팅
     - 피보나치 가이드라인 점수

난이도: 중간~높음
기반 이론: §4 전체
```

### Phase 4: 기계학습 기반 패턴 탐지

```
목표: 데이터 기반 패턴 발견 및 분류

구현 순서:
  1. 특성 엔지니어링:
     - OHLCV 기반 비율 특성 (§1.3)
     - 기술적 지표 특성 (RSI, MACD, BB 위치)
     - 추세/변동성 특성

  2. 기본 ML 모델:
     - Random Forest / XGBoost 분류기
     - SHAP 분석으로 해석 (§6.5)

  3. 딥러닝 모델 (선택적):
     - LSTM/GRU 순차 모델 (§6.2)
     - CNN 이미지 기반 (§6.1)
     - 어텐션 기반 중요 봉 식별 (§6.3)

  4. 전이 학습 (§6.4):
     - 대규모 해외 데이터로 사전학습
     - KRX 데이터로 파인튜닝

난이도: 높음
주의: 과적합 방지를 위한 엄격한 검증 필수 (§7)
```

### Phase 5: 실시간 품질 점수 및 확률 추정

```
목표: 실시간 패턴 탐지 + 성공 확률 표시

구현 항목:
  1. 실시간 품질 점수 계산 (§2)
  2. 베이지안 성공 확률 추정 (§2.2, §5.2)
  3. 합류 구역 자동 탐지 (§5.4)
  4. 백테스팅 통계 표시 (§7):
     - 해당 패턴의 역사적 승률
     - 부트스트랩 신뢰 구간
     - 효과 크기 (Cohen's d)

  5. 대시보드 시각화:
     - 패턴 품질: 색상 그라데이션 (빨강~초록)
     - 성공 확률: 퍼센트 표시
     - 합류 점수: 아이콘 중첩

난이도: 중간~높음
기반 이론: §2, §5, §7
```

---

## 구현 우선순위 요약

| Phase | 내용 | 난이도 | 기대 효과 | 기반 섹션 |
|-------|------|--------|----------|----------|
| 1 | 패턴 품질 점수 | 낮음 | 오탐 감소, 신뢰도 표시 | §2 |
| 2 | 고급 캔들스틱 패턴 | 낮음~중간 | 패턴 커버리지 확대 | §3 |
| 3 | 복합 차트 패턴 | 중간~높음 | 머리어깨, 하모닉 등 | §4 |
| 4 | ML 기반 패턴 | 높음 | 데이터 기반 패턴 발견 | §6 |
| 5 | 실시간 확률 추정 | 중간~높음 | 의사결정 지원 강화 | §2, §5, §7 |

---

## 핵심 참고문헌

| 참조 | 저자·제목 | 관련 섹션 |
|------|----------|----------|
| Bulkowski (2005) | *Encyclopedia of Chart Patterns*, 2nd Ed. | §4.1, §4.2, §5.2 |
| Bulkowski (2012) | *Encyclopedia of Candlestick Charts* | §3 전체, §7 |
| Murphy (1999) | *Technical Analysis of the Financial Markets* | §1.4, §4 전체 |
| Nison (1991) | *Japanese Candlestick Charting Techniques* | §3.1, §3.5 |
| Nison (2003) | *The Candlestick Course* | §3 전체 |
| Kirkpatrick & Dahlquist (2010) | *Technical Analysis*, 2nd Ed. | §1, §2, §4, §7 |
| Carney (1999) | *The Harmonic Trader* | §4.4 |
| Frost & Prechter (1978) | *Elliott Wave Principle* | §4.3 |
| O'Neil (1988) | *How to Make Money in Stocks* | §4.2 |
| White (2000) | *A Reality Check for Data Snooping* | §7.3 |
| Hansen (2005) | *A Test for Superior Predictive Ability* | §7.3 |
| Lundberg & Lee (2017) | *A Unified Approach to Interpreting Model Predictions* | §6.5 |
| Vaswani et al. (2017) | *Attention Is All You Need* | §6.3 |
| Hochreiter & Schmidhuber (1997) | *Long Short-Term Memory* | §6.2 |
