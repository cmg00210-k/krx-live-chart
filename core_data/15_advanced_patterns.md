# 15. ML 기반 패턴 인식 및 백테스팅 — ML-Based Pattern Recognition & Backtesting

> 기계학습 기반의 패턴 인식 기법과 패턴 백테스팅의 통계적 방법론을 다룬다.
>
> 패턴의 수학적 정의, 캔들스틱 패턴, 차트 패턴, 하모닉 패턴, 패턴 품질 점수,
> 패턴 조합 확률 등은 07_pattern_algorithms.md (통합본)으로 이관되었다.

---

## 5. 기계학습 기반 패턴 분석 (ML-Based Pattern Analysis)

### 5.1 CNN 기반 시각적 패턴 인식

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

### 5.2 LSTM/GRU 기반 순차 패턴 탐지

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

### 5.3 어텐션 메커니즘 (Attention Mechanism)

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

### 5.4 전이 학습 (Transfer Learning)

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

### 5.5 SHAP 기반 특성 중요도 분석

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

## 6. 패턴 백테스팅 수학 (Pattern Backtesting Mathematics)

### 6.1 워크포워드 분석 프레임워크 (Walk-Forward Analysis)

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

### 6.2 표본 외 검정 방법론 (Out-of-Sample Testing)

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

### 6.3 다중 가설 검정 보정 (Multiple Hypothesis Testing Correction)

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

### 6.4 부트스트랩 신뢰 구간 (Bootstrap Confidence Intervals)

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

### 6.5 생존 편향 및 선행 편향 방지

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

### 6.6 통계적 유의성 검정

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

## 7. 구현 로드맵 (Implementation Roadmap)

### Phase 1: 기계학습 기반 패턴 탐지

> 패턴 품질 점수, 고급 캔들스틱 패턴, 복합 차트 패턴 관련 로드맵은
> 07_pattern_algorithms.md의 "향후 구현 우선순위"를 참조한다.

```
목표: 데이터 기반 패턴 발견 및 분류

구현 순서:
  1. 특성 엔지니어링:
     - OHLCV 기반 비율 특성 (07 §3.3)
     - 기술적 지표 특성 (RSI, MACD, BB 위치)
     - 추세/변동성 특성

  2. 기본 ML 모델:
     - Random Forest / XGBoost 분류기
     - SHAP 분석으로 해석 (§5.5)

  3. 딥러닝 모델 (선택적):
     - LSTM/GRU 순차 모델 (§5.2)
     - CNN 이미지 기반 (§5.1)
     - 어텐션 기반 중요 봉 식별 (§5.3)

  4. 전이 학습 (§5.4):
     - 대규모 해외 데이터로 사전학습
     - KRX 데이터로 파인튜닝

난이도: 높음
주의: 과적합 방지를 위한 엄격한 검증 필수 (§6)
```

### Phase 2: 실시간 확률 추정

```
목표: 실시간 패턴 탐지 + 성공 확률 표시

구현 항목:
  1. 실시간 품질 점수 계산 (07 §7)
  2. 베이지안 성공 확률 추정 (07 §7.2)
  3. 합류 구역 자동 탐지 (07 §10.4)
  4. 백테스팅 통계 표시 (§6):
     - 해당 패턴의 역사적 승률
     - 부트스트랩 신뢰 구간
     - 효과 크기 (Cohen's d)

난이도: 중간~높음
기반 이론: 07 §7, §10; 15 §5, §6
```

---

## 구현 우선순위 요약

| Phase | 내용 | 난이도 | 기대 효과 | 기반 섹션 |
|-------|------|--------|----------|----------|
| 1 | ML 기반 패턴 탐지 | 높음 | 데이터 기반 패턴 발견 | §5 |
| 2 | 실시간 확률 추정 | 중간~높음 | 의사결정 지원 강화 | 07 §7, §10; 15 §5, §6 |

> 패턴 품질 점수, 고급 캔들스틱/차트 패턴 로드맵은 07_pattern_algorithms.md 참조.

---

## 핵심 참고문헌

| 참조 | 저자·제목 | 관련 섹션 |
|------|----------|----------|
| White (2000) | *A Reality Check for Data Snooping* | §6.3 |
| Hansen (2005) | *A Test for Superior Predictive Ability* | §6.3 |
| Lundberg & Lee (2017) | *A Unified Approach to Interpreting Model Predictions* | §5.5 |
| Vaswani et al. (2017) | *Attention Is All You Need* | §5.3 |
| Hochreiter & Schmidhuber (1997) | *Long Short-Term Memory* | §5.2 |
| Tsantekidis et al. (2017) | *Using Deep Learning for Price Prediction* | §5.1 |
| Jiang et al. (2020) | *Applications of Deep Learning in Stock Market Prediction* | §5.1 |
