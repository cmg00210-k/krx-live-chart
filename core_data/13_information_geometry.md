# 13. 정보기하학 — Information Geometry in Financial Markets

> 확률분포의 공간은 곡면(다양체)을 이룬다.
> 시장 상태의 변화는 이 통계적 다양체 위의 궤적이며,
> 정보기하학은 그 궤적의 곡률, 거리, 방향을 측정하는 수학이다.

---

## 1. 정보기하학 기초 (Information Geometry Foundations)

### 1.1 통계적 다양체 (Statistical Manifold)

Shun-ichi Amari, *Differential-Geometrical Methods in Statistics* (1985)
— 통계학에 미분기하학을 체계적으로 도입한 기념비적 저작

```
확률분포의 매개변수 족:

S = { p(x; θ) | θ = (θ₁, θ₂, ..., θₙ) ∈ Θ ⊂ ℝⁿ }

여기서:
  x: 확률변수 (예: 주가 수익률)
  θ: 매개변수 벡터
  Θ: 매개변수 공간

S는 n차원 리만 다양체(Riemannian manifold)를 구성한다.
각 점 θ ∈ Θ는 하나의 확률분포에 대응한다.
```

C.R. Rao, *Information and the Accuracy Attainable in the Estimation
of Statistical Parameters* (1945)
— 피셔 정보를 리만 계량으로 해석한 최초의 논문

핵심 아이디어:
- 확률분포의 집합을 기하학적 공간으로 취급한다
- 분포 사이의 "거리"를 정의할 수 있다
- 이 거리는 분포의 구별 가능성(distinguishability)을 반영한다

금융 적용:
- 시장의 수익률 분포 = 통계적 다양체 위의 한 점
- 시장 상태의 변화 = 다양체 위의 점의 이동
- 레짐 변화(regime change) = 다양체 위에서의 급격한 점프

### 1.2 Amari의 프레임워크

Amari의 정보기하학은 세 가지 핵심 구조를 도입한다:

```
1) 리만 계량 (Riemannian Metric):
   gᵢⱼ(θ) = 피셔 정보 행렬 I(θ)ᵢⱼ
   → 다양체 위에서 거리와 각도를 정의

2) α-연결 (α-connection):
   Γᵢⱼₖ⁽α⁾ = E[∂ᵢ∂ⱼ ℓ(x;θ) · ∂ₖ ℓ(x;θ)]
              + (1-α)/2 · E[∂ᵢ ℓ · ∂ⱼ ℓ · ∂ₖ ℓ]

   여기서 ℓ(x;θ) = log p(x;θ)

   α = 1: e-연결 (지수족에 자연)
   α = -1: m-연결 (혼합족에 자연)
   α = 0: 레비-치비타 연결 (리만 기하의 표준)

3) 쌍대성 (Duality):
   α-연결과 (-α)-연결은 피셔 계량에 대해 쌍대 관계
   → 정보기하학의 가장 아름다운 구조적 특성
```

### 1.3 매개변수 족과 리만 다양체

금융에서 중요한 매개변수 족:

```
정규분포족 (2차원 다양체):
  S_norm = { N(μ, σ²) | μ ∈ ℝ, σ > 0 }
  → 쌍곡 공간 (Poincaré 상반평면)과 동형

Student-t 분포족 (3차원 다양체):
  S_t = { t(μ, σ, ν) | μ ∈ ℝ, σ > 0, ν > 2 }
  → 금융 수익률의 두꺼운 꼬리를 모형화

지수족 (Exponential Family):
  p(x; θ) = h(x) · exp(θᵀT(x) - A(θ))

  A(θ): 로그 분배 함수 (log partition function)
  T(x): 충분통계량 (sufficient statistic)
  → 지수족에서 피셔 정보 = A(θ)의 헤시안: I(θ) = ∇²A(θ)
```

Amari, S. (2016), *Information Geometry and Its Applications*, Springer
— 정보기하학의 현대적 종합 교과서

---

## 2. 피셔 정보 행렬 (Fisher Information Matrix)

### 2.1 정의

R.A. Fisher, *On the Mathematical Foundations of Theoretical Statistics* (1922)

```
피셔 정보 행렬 (Fisher Information Matrix):

I(θ)ᵢⱼ = E[ ∂log p(x;θ)/∂θᵢ · ∂log p(x;θ)/∂θⱼ ]

        = E[ sᵢ(x;θ) · sⱼ(x;θ) ]

여기서 s(x;θ) = ∇θ log p(x;θ) 는 스코어 함수 (score function)

동치 표현 (정칙 조건 하):

I(θ)ᵢⱼ = -E[ ∂²log p(x;θ) / ∂θᵢ∂θⱼ ]

→ 로그 우도의 곡률(curvature)을 측정한다
→ 곡률이 클수록 매개변수에 대한 정보가 많다
```

### 2.2 리만 계량 텐서로서의 피셔 정보

Rao (1945)의 핵심 통찰:

```
통계적 다양체 S 위에서 두 인접한 분포 사이의 거리:

ds² = Σᵢⱼ gᵢⱼ(θ) dθᵢ dθⱼ

여기서 gᵢⱼ(θ) = I(θ)ᵢⱼ (피셔 정보 행렬)

→ 피셔 정보 행렬은 통계적 다양체의 리만 계량 텐서이다

Čencov 정리 (1982):
피셔 정보 계량은 충분통계량에 의한 사상에 불변인
유일한 리만 계량이다 (상수 배 제외).
→ 피셔 계량의 정보기하학적 유일성을 보장
```

금융 적용:
- 시장 수익률 분포의 변화량을 "기하학적 거리"로 측정
- 변화 속도 = 다양체 위 경로의 속력
- 정보가 풍부한 시기 = 곡률이 큰 영역에 위치

### 2.3 크라메르-라오 하한 (Cramér-Rao Lower Bound)

```
추정량 θ̂의 분산에 대한 하한:

Var(θ̂) ≥ I(θ)⁻¹

→ 어떤 불편 추정량도 피셔 정보의 역수보다
  작은 분산을 가질 수 없다

다변량 버전:
Cov(θ̂) ≥ I(θ)⁻¹  (행렬 부등식, 뢰브너 순서)
```

Cramér, H. (1946), *Mathematical Methods of Statistics*
Rao, C.R. (1945), 위 논문에서 독립적으로 유도

금융 적용:
- 변동성(σ) 추정의 정밀도 한계를 결정
- 관측 데이터가 n개일 때: Var(σ̂) ≥ σ²/2n (정규분포 가정)
- 기술적 분석 지표의 추정 오차에 대한 이론적 하한 제공

### 2.4 금융 분포에 대한 피셔 정보

```
(1) 정규분포 N(μ, σ²):

I(μ, σ²) = [ 1/σ²       0        ]
            [   0     1/(2σ⁴)     ]

→ 리만 계량: ds² = dμ²/σ² + dσ²/(2σ⁴)
→ 변동성이 작을수록 평균에 대한 정보가 더 풍부하다

(2) Student-t 분포 t(μ, σ, ν):

I_μμ = ν / ((ν+1)σ²) · (ν+1)/(ν+3)
I_σσ = 2ν / ((ν+3)σ²)

→ 자유도 ν가 작을수록(꼬리가 두꺼울수록) 위치 추정이 어렵다
→ 금융 수익률에서 ν ≈ 3~5: 평균 추정이 본질적으로 어려운 이유

(3) 일반화 쌍곡분포 (Generalized Hyperbolic Distribution):
  Barndorff-Nielsen (1977)
  → 금융 수익률 모형화에 활용
  → 피셔 정보가 매개변수의 복잡한 함수 → 수치적 계산 필요

(4) GARCH(1,1) 과정:
  rₜ = σₜεₜ,  σₜ² = ω + αrₜ₋₁² + βσₜ₋₁²

  피셔 정보는 (ω, α, β)에 대한 3×3 행렬
  → 변동성 군집 강도에 대한 추정 정밀도를 결정
```

---

## 3. 자연 경사법 (Natural Gradient)

### 3.1 표준 경사 vs 자연 경사

Amari, S. (1998), *Natural Gradient Works Efficiently in Learning*,
Neural Computation

```
표준 경사 하강법:
  θₜ₊₁ = θₜ - η · ∇θ L(θ)

문제: 유클리드 좌표계에 의존한다
→ 매개변수 재표현(reparametrization)에 따라 학습 경로가 변한다
→ 통계적으로 비효율적

자연 경사 하강법:
  θₜ₊₁ = θₜ - η · I(θ)⁻¹ · ∇θ L(θ)

  자연 경사: θ̃ = I(θ)⁻¹ · ∇θ L(θ)

→ 피셔 정보 행렬로 경사를 보정
→ 매개변수 재표현에 불변 (invariant)
→ 통계적 다양체의 고유한 "최급강하 방향"을 따른다
```

### 3.2 기하학적 해석

```
유클리드 공간에서의 최급강하 방향:
  argmin ||d||₂=ε  L(θ + d) ≈ argmin  ∇L · d
  → d ∝ -∇L

리만 다양체에서의 최급강하 방향:
  argmin ||d||_g=ε  L(θ + d) ≈ argmin  ∇L · d
  여기서 ||d||²_g = dᵀI(θ)d

  → d ∝ -I(θ)⁻¹∇L  (자연 경사)

→ 자연 경사는 통계적 다양체의 곡률을 고려한
  진정한 최급강하 방향이다
```

### 3.3 피셔 효율적 추정 (Fisher Efficiency)

```
자연 경사 학습은 Fisher-efficient하다:

온라인 학습에서 자연 경사를 사용하면:

  n · E[(θ̂ₙ - θ*)(θ̂ₙ - θ*)ᵀ] → I(θ*)⁻¹   (n → ∞)

→ 크라메르-라오 하한을 점근적으로 달성한다
→ 통계적으로 최적의 학습률을 자동으로 결정한다
```

### 3.4 포트폴리오 최적화에의 적용

```
포트폴리오 가중치 w = (w₁, w₂, ..., wₖ)는
자산 수익률의 혼합 분포를 결정한다:

  p(r; w) = Σᵢ wᵢ · p(r | asset i)

→ 포트폴리오 공간은 통계적 다양체의 부분다양체이다

자연 경사를 이용한 포트폴리오 최적화:
  wₜ₊₁ = wₜ - η · I(w)⁻¹ · ∇w Risk(w)

장점:
  - 자산 간 상관관계의 비선형 구조를 포착
  - 변동성 표면의 곡률을 반영
  - 매개변수 재표현(예: 로그 가중치)에 불변

Pascanu & Bengio (2013), *Revisiting Natural Gradient for Deep Networks*
→ 대규모 계산에서의 근사 기법 (K-FAC 등)
```

---

## 4. 쿨백-라이블러 발산과 시장 상태 (KL Divergence and Market States)

### 4.1 쿨백-라이블러 발산 (Kullback-Leibler Divergence)

Kullback, S. & Leibler, R.A. (1951), *On Information and Sufficiency*,
Annals of Mathematical Statistics

```
KL 발산 (연속 분포):

D_KL(P || Q) = ∫ p(x) · log(p(x) / q(x)) dx

            = E_P[ log(p(x) / q(x)) ]

성질:
  - D_KL(P || Q) ≥ 0  (기브스 부등식)
  - D_KL(P || Q) = 0  ⟺  P = Q  (거의 어디서나)
  - 비대칭: D_KL(P || Q) ≠ D_KL(Q || P) (거리가 아님)

정보기하학적 해석:
  D_KL(P || Q)는 통계적 다양체 위에서
  P에서 Q로의 "편향된 거리"이다.
  무한소 이동 시:
    D_KL(p(x;θ) || p(x;θ+dθ)) ≈ ½ dθᵀ I(θ) dθ
  → 피셔 정보 행렬이 KL 발산의 2차 근사이다
```

### 4.2 레짐 변화 탐지 (Regime Change Detection)

```
시장 레짐 탐지 알고리즘:

1) 두 시간 구간의 수익률 분포 추정:
   P: 기준 구간 (예: 과거 60일)의 수익률 분포
   Q: 최근 구간 (예: 최근 20일)의 수익률 분포

2) KL 발산 계산:
   D_KL(Q || P) = Σᵢ q(rᵢ) · log(q(rᵢ) / p(rᵢ))

3) 임계값 비교:
   D_KL(Q || P) > τ  →  레짐 변화 신호

실용적 구현:
  - 커널 밀도 추정(KDE)으로 p, q 추정
  - 또는 정규분포 가정 하 해석적 계산:
    D_KL(N(μ₁,σ₁²) || N(μ₂,σ₂²))
    = log(σ₂/σ₁) + (σ₁² + (μ₁-μ₂)²) / (2σ₂²) - ½
```

금융 적용:
- 횡보 → 추세 전환의 조기 감지
- 위기(crisis) 발생 시 분포 형태의 급변 포착
- 변동성 레짐 전환 (저변동→고변동)의 정량화

### 4.3 대칭 KL 발산 (Jeffrey's Divergence)

```
KL 발산의 비대칭성 문제를 해결:

D_J(P, Q) = D_KL(P || Q) + D_KL(Q || P)
           = ∫ (p(x) - q(x)) · log(p(x)/q(x)) dx

성질:
  - D_J(P, Q) = D_J(Q, P)  (대칭)
  - D_J(P, Q) ≥ 0
  - D_J(P, Q) = 0 ⟺ P = Q

정규분포 간의 Jeffrey's 발산:
D_J(N(μ₁,σ₁²), N(μ₂,σ₂²))
  = ½(σ₁²/σ₂² + σ₂²/σ₁² - 2) + ½(μ₁-μ₂)²(1/σ₁² + 1/σ₂²)
```

### 4.4 α-발산과 f-발산 (α-Divergence and f-Divergence)

```
α-발산 (Amari, 1985):

D_α(P || Q) = (4 / (1-α²)) · (1 - ∫ p(x)^((1+α)/2) · q(x)^((1-α)/2) dx)

특수한 경우:
  α → 1:  D_KL(P || Q)
  α → -1: D_KL(Q || P)
  α = 0:  2(1 - ∫√(p·q) dx) = 2(1 - BC(P,Q))
           → 바타차리야 거리(Bhattacharyya distance)와 관련

f-발산 (Csiszár, 1967; Ali & Silvey, 1966):

D_f(P || Q) = ∫ q(x) · f(p(x)/q(x)) dx

여기서 f: [0,∞) → ℝ는 볼록 함수, f(1) = 0

KL: f(t) = t·log(t)
역KL: f(t) = -log(t)
헬링거: f(t) = (√t - 1)²
χ²: f(t) = (t-1)²
TV: f(t) = ½|t-1| (총 변동 거리)
```

금융 적용:
- α-발산 패밀리로 시장 분기(divergence)의 다양한 측면을 포착
- α > 0: 꼬리(tail) 차이에 민감 → 극단 사건 탐지
- α < 0: 모드(mode) 차이에 민감 → 중심 이동 탐지
- 실무에서는 KL 발산(α→1)과 바타차리야 거리(α=0) 병행 사용

---

## 5. 시장 상태 추적 (Market State Tracking)

### 5.1 시장 수익률 분포의 다양체 표현

```
시점 t에서의 시장 상태:

  θ(t) = (μ(t), σ(t), ν(t), γ(t), ...)

여기서:
  μ(t): 기대수익률 (위치)
  σ(t): 변동성 (스케일)
  ν(t): 꼬리 두께 (자유도, 첨도 관련)
  γ(t): 비대칭성 (왜도)

→ θ(t)는 통계적 다양체 S 위의 한 점
→ 시간에 따라 θ(t)는 S 위의 곡선(curve)을 그린다
→ 이 곡선이 "시장 상태 궤적(market state trajectory)"이다
```

### 5.2 측지선 거리 (Geodesic Distance)

```
통계적 다양체 위 두 점 θ₁, θ₂ 사이의 측지선 거리:

d_g(θ₁, θ₂) = inf_γ ∫₀¹ √(γ̇(t)ᵀ · I(γ(t)) · γ̇(t)) dt

여기서 γ: [0,1] → S 는 θ₁과 θ₂를 잇는 곡선

정규분포 다양체에서의 해석적 결과:

d_g(N(μ₁,σ₁), N(μ₂,σ₂))
  = √(2) · arccosh(1 + ((μ₁-μ₂)² + 2(σ₁-σ₂)²) / (4σ₁σ₂))

→ Poincaré 상반평면의 측지선 거리와 동일
→ 변동성이 낮은 영역에서는 작은 μ 변화도 큰 거리를 만든다
  (저변동성 시장에서의 평균 이동이 더 "유의미"하다)
```

### 5.3 레짐 변화 = 큰 측지선 이동

```
레짐 변화 탐지 기준:

속도 (속력):
  v(t) = ||θ̇(t)||_g = √(θ̇(t)ᵀ · I(θ(t)) · θ̇(t))

가속도:
  a(t) = d/dt v(t)

레짐 변화 판정:
  v(t) > v_threshold  또는  a(t) > a_threshold

→ 시장 상태가 다양체 위에서 빠르게 이동하면 레짐 변화
→ 가속도가 크면 급격한 전환 (위기, 버블 형성 등)

비유:
  정상 시장: 다양체 위의 느린 산책 (random walk)
  추세 형성: 다양체 위의 측지선을 따른 이동
  위기 발생: 다양체 위의 점프 (curvature spike)
```

### 5.4 슬라이딩 윈도우 실시간 추적

```
실시간 구현 알고리즘:

입력: 수익률 시계열 {r₁, r₂, ..., rₜ}
윈도우 크기: W (예: 60 거래일)

for each t = W, W+1, W+2, ...:

  1) 현재 윈도우: R_t = {rₜ₋ᵂ₊₁, ..., rₜ}
  2) 매개변수 추정: θ̂(t) = MLE(R_t)
     (예: μ̂, σ̂, ν̂ for Student-t fitting)
  3) 피셔 정보 계산: I(θ̂(t))
  4) 측지선 거리 계산: d(t) = d_g(θ̂(t), θ̂(t-1))
  5) 속도 계산: v(t) = d(t) / Δt
  6) 신호 발생: v(t) > τ 이면 "레짐 변화 경보"

다중 윈도우 전략:
  - 단기 (W=20): 단기 분포 변화 포착
  - 중기 (W=60): 레짐 전환 탐지
  - 장기 (W=120): 구조적 변화 감지
  → 다중 시간 스케일 분석 = 기술적 분석의 다중 이동평균과 유사
```

---

## 6. 정보 기하학적 시장 분석 (Information Geometric Market Analysis)

### 6.1 변동성 표면을 다양체로 (Volatility Surface as Manifold)

```
옵션 시장의 내재변동성 표면:

  σ_impl(K, T) = BS⁻¹(C_market(K, T))

여기서:
  K: 행사가격 (strike)
  T: 만기 (maturity)

이 표면을 통계적 다양체로 해석:
  - 각 (K,T) 점에서의 내재 위험중립 분포 → 다양체 위의 점
  - 변동성 스마일의 변화 = 다양체 위의 이동
  - 스큐(skew)의 급변 = 큰 측지선 거리 → 위기 조기 경보

Gatheral, J. (2006), *The Volatility Surface: A Practitioner's Guide*

다양체 위 곡률 해석:
  - 양의 곡률 영역: 시장이 평균 회귀(mean-reverting) 상태
  - 음의 곡률 영역: 시장이 발산(diverging) 상태
  - 곡률 급변: 시장 구조 전환 신호
```

### 6.2 수익률 곡선 동학 (Yield Curve Dynamics)

```
채권 시장의 수익률 곡선:
  y(τ) = 만기 τ에서의 수익률

Nelson-Siegel 모형:
  y(τ; β) = β₁ + β₂(1 - e^(-τ/λ))/(τ/λ)
           + β₃((1 - e^(-τ/λ))/(τ/λ) - e^(-τ/λ))

β = (β₁, β₂, β₃, λ): 수준, 기울기, 곡률, 감쇠

→ 수익률 곡선 공간 = 4차원 통계적 다양체
→ 수익률 곡선 이동(평행이동, 기울기 변화, 곡률 변화)을
  다양체 위의 측지선으로 해석

국채 수익률 곡선 역전 (inversion):
  → 다양체 위에서 특정 부분다양체를 횡단하는 사건
  → 역전 전후의 측지선 거리가 경기 침체 예측력에 대응
```

### 6.3 횡단면 수익률 분포 진화 (Cross-Sectional Return Distribution)

```
KOSPI 전 종목의 일간 수익률 분포:

  시점 t: p_t(r) = 전 종목 수익률의 경험적 분포

시간에 따른 분포 진화:
  t₁ → t₂ → t₃ → ... → tₙ

정보 기하학적 분석:
  1) 분산(변동성) 축: 시장 전체의 위험 수준
  2) 왜도 축: 상승/하락 비대칭
  3) 첨도 축: 극단 이벤트 빈도

→ 횡단면 분포의 측지선 거리 시계열 = "시장 스트레스 지수"
→ 2008 금융위기, 2020 코로나 충격 시 큰 측지선 거리 관측
```

### 6.4 이상 탐지 (Anomaly Detection via Manifold Distance)

```
이상 탐지 알고리즘:

기준 분포: P_ref (정상 시장 상태, 장기 평균)
현재 분포: P_now (최근 관측)

이상 점수 (anomaly score):
  A(t) = d_g(P_ref, P_now)

또는 마할라노비스 거리의 정보기하학적 일반화:
  A(t) = √((θ_now - θ_ref)ᵀ · I(θ_ref) · (θ_now - θ_ref))

판정 기준:
  A(t) > μ_A + 3σ_A  →  이상 상태 (시장 이상 경보)

→ 전통적 VaR(Value at Risk)보다 분포 형태 변화에 민감
→ "검은 백조" 사건의 전조 포착 가능성
```

Ay, N., Jost, J., Lê, H.V. & Schwachhöfer, L. (2017),
*Information Geometry*, Springer
— 정보기하학의 수학적으로 가장 엄밀한 현대 교과서

---

## 7. 기술적 분석과의 연결 (Connection to Technical Analysis)

### 7.1 이동평균 수렴·발산 = 측지선 추적

```
이동평균 (MA)의 정보기하학적 해석:

MA(n)는 수익률 분포의 위치 매개변수 μ를 추정한다.

단기 MA: μ̂_short = 최근 분포의 위치
장기 MA: μ̂_long = 기준 분포의 위치

MA 교차:
  μ̂_short ≈ μ̂_long  →  두 분포가 다양체 위에서 가까움
  μ̂_short ≫ μ̂_long  →  단기 분포가 다양체 위에서 이동

MACD = MA_short - MA_long
     ≈ 다양체 위 위치 매개변수의 측지선 거리의 1차원 투영

골든크로스/데드크로스:
  → 시장 상태가 다양체 위에서 방향 전환한 순간에 대응
```

### 7.2 볼린저 밴드 폭 = 국소 곡률 지표

```
볼린저 밴드:
  상한 = MA(20) + 2σ₂₀
  하한 = MA(20) - 2σ₂₀
  폭 = 4σ₂₀

정보기하학적 해석:
  σ₂₀ = 다양체 위 현재 점에서의 스케일 매개변수
  피셔 정보 I_μμ = 1/σ² (정규분포 가정)

  밴드 폭 ∝ σ ∝ 1/√I_μμ

  → 밴드가 좁음 (σ 작음): I_μμ 큼 → 곡률이 큰 영역
     → 작은 가격 변화도 통계적으로 유의미
     → "스퀴즈" = 다양체의 고곡률 영역에서의 체류

  → 밴드가 넓음 (σ 큼): I_μμ 작음 → 곡률이 작은 영역
     → 큰 가격 변화도 통계적으로 무의미할 수 있음

볼린저 밴드 스퀴즈 후 확장:
  = 다양체 위 고곡률 영역에서 저곡률 영역으로의 전이
  = 정보 기하학적 "상전이(phase transition)"
```

### 7.3 RSI = 1차원 다양체 투영

```
RSI (Relative Strength Index):

RSI = 100 × U / (U + D)

여기서:
  U = 상승 평균 (average gain)
  D = 하락 평균 (average loss)

정보기하학적 해석:
  수익률 분포 p(r)를 r > 0 (상승)과 r < 0 (하락)으로 분할

  P(r > 0) = ∫₀^∞ p(r) dr
  P(r < 0) = ∫₋∞^0 p(r) dr

  RSI ≈ P(r > 0)의 크기 가중 버전

→ 다변량 수익률 분포를 1차원 [0, 100] 구간으로 투영
→ 이 투영은 분포의 비대칭성(왜도) 정보를 보존
→ RSI 과매수/과매도 = 분포가 다양체의 경계 영역에 도달

Fisher 변환을 통한 개선:
  RSI_Fisher = 0.5 · ln((1 + RSI')/(1 - RSI'))
  여기서 RSI' = 2(RSI/100) - 1

→ 정규 분포에 근사하는 변환 = 다양체 위 좌표 정규화
→ J.F. Ehlers의 Fisher Transform과 동일한 아이디어
```

### 7.4 거래량 프로파일 = 경험적 분포 형태

```
가격별 거래량 프로파일 (Volume Profile):

  V(p) = 가격 p에서의 누적 거래량

→ V(p)/ΣV를 정규화하면 가격의 경험적 확률밀도함수가 된다
→ 이것은 통계적 다양체 위의 한 점이다

정보기하학적 분석:
  - POC (Point of Control) = 분포의 최빈값(mode)
  - VA (Value Area) = 분포의 68% 신뢰구간
  - HVN (High Volume Node) = 분포의 봉우리(peak)
  - LVN (Low Volume Node) = 분포의 골짜기(valley)

  거래량 분포의 시간 변화:
    d_g(V_t, V_{t+1}) = 가격별 거래 패턴의 변화 정도

  → 거래량 분포의 갑작스런 형태 변화
     = 다양체 위 큰 측지선 이동
     = 시장 참여자 구성의 변화 신호
```

### 7.5 패턴 전이 = 다양체 궤적

```
기술적 패턴의 정보기하학적 모형:

각 캔들스틱 패턴은 수익률 분포의 특정 상태에 대응:

  적삼병(Three White Soldiers):
    θ(t₁) → θ(t₂) → θ(t₃)
    μ 증가, σ 감소 → 다양체 위 특정 방향의 측지선 이동

  흑삼병(Three Black Crows):
    μ 감소, σ 증가 → 반대 방향의 측지선 이동

  도지(Doji):
    Δθ ≈ 0 → 다양체 위 정지 (stationary point)
    → 방향 전환의 전조 (측지선 곡률 극대)

  헤드앤숄더:
    다양체 위 "U턴" 궤적
    → 왼쪽 어깨: 한 방향 이동
    → 머리: 최대 이동 후 반전
    → 오른쪽 어깨: 약화된 재시도
    → 네크라인 붕괴: 반대 방향 측지선 진입

패턴 인식 = 다양체 위 궤적의 형태 매칭 (trajectory shape matching)
→ 단순한 가격 패턴 매칭보다 분포 전체의 변화를 포착
→ 노이즈에 더 강건한 패턴 인식 가능
```

---

## 핵심 정리: 정보기하학과 기술적 분석의 대응

| 정보기하학 개념 | 기술적 분석 대응 | 수학적 관계 |
|----------------|-----------------|-------------|
| 통계적 다양체 | 시장 상태 공간 | 각 시점의 분포 = 다양체 위 한 점 |
| 피셔 정보 행렬 | 시장 정보량 / 불확실성 | I(θ) 큼 = 낮은 변동성, 높은 예측력 |
| 리만 계량 | 시장 변화의 척도 | ds² = dθᵀI(θ)dθ |
| 측지선 거리 | 레짐 간 차이 | 시장 상태 변화의 크기 |
| 자연 경사 | 최적 포트폴리오 조정 | I(θ)⁻¹∇L = 곡률 보정 방향 |
| KL 발산 | 레짐 변화 탐지 | D_KL > τ 이면 레짐 전환 |
| α-발산 | 다양한 시장 발산 측정 | α에 따라 꼬리/중심 민감도 조절 |
| 다양체 곡률 | 볼린저 밴드 폭 | 곡률 ∝ 1/σ² ∝ 1/밴드폭² |
| 측지선 경로 | MA 교차 / 추세선 | 다양체 위 최단 경로 |
| 1차원 투영 | RSI, 스토캐스틱 | 다변량 분포 → 스칼라 요약 |
| 경험적 분포 | 거래량 프로파일 | V(p)/ΣV = 가격의 경험적 pdf |
| 궤적 형태 매칭 | 캔들스틱 패턴 인식 | 다양체 위 궤적의 기하학적 분류 |

---

## 참고문헌 (References)

### 핵심 문헌

- Amari, S. (1985), *Differential-Geometrical Methods in Statistics*, Lecture Notes in Statistics, Springer
- Amari, S. (1998), *Natural Gradient Works Efficiently in Learning*, Neural Computation, 10(2), 251-276
- Amari, S. (2016), *Information Geometry and Its Applications*, Springer
- Amari, S. & Nagaoka, H. (2000), *Methods of Information Geometry*, Translations of Mathematical Monographs, AMS/Oxford
- Ay, N., Jost, J., Lê, H.V. & Schwachhöfer, L. (2017), *Information Geometry*, Springer
- Rao, C.R. (1945), *Information and the Accuracy Attainable in the Estimation of Statistical Parameters*, Bulletin of the Calcutta Mathematical Society, 37, 81-91
- Fisher, R.A. (1922), *On the Mathematical Foundations of Theoretical Statistics*, Philosophical Transactions of the Royal Society A, 222, 309-368

---

## 부록: Jeffrey 발산 0.15 감쇠 계수 반증 기록 (§4.3 보강)

### A.1 코드 구현과 0.15의 의미

§4.3에서 정의한 정규분포 간 Jeffrey 발산 공식이 `patterns.js:252-270`에 구현되어 있다.
rw(레짐 가중치)는 D_J를 기반으로 패턴 신뢰도를 감쇠시키는 보정 인자이다.

```
구현 (patterns.js:270):
  regimeWeight = clamp(1 - D_J * 0.15, 0.7, 1.0)

윈도우 설계:
  P = 수익률 분포 (60일 윈도우: closes[t-80] ~ closes[t-20])
  Q = 수익률 분포 (20일 윈도우: closes[t-20] ~ closes[t-1])
  → 최근 20일과 과거 60일의 분포 차이로 레짐 변화 탐지

D_J와 regimeWeight의 관계:
  D_J = 0:    rw = 1.0   (레짐 변화 없음, 감쇠 없음)
  D_J = 1:    rw = 0.85  (약한 레짐 변화)
  D_J = 2:    rw = 0.70  (최대 감쇠, 하한 도달)
  D_J >= 2:   rw = 0.70  (하한 클램프)
```

### A.2 0.15 감쇠 계수의 근거

0.15는 D_J = 6.67에서 rw = 0이 되는 비율(1/6.67 = 0.15)에서 역산한 값이다.
하한 클램프(0.7)가 있으므로 실질적으로 D_J >= 2에서 최대 감쇠가 적용된다.

```
이론적 최적화 부재:
  - 0.15는 "D_J = 2 정도에서 30% 감쇠"라는 직관적 설정
  - 교차 검증이나 최적화를 통해 도출된 값이 아님
  - D등급 매직넘버에 해당
```

학술적으로 Jeffrey 발산의 감쇠 함수 변환에 대한 표준은 없다.
Kullback (1959), *Information Theory and Statistics*에서 KL 발산의
통계적 검정 이론을 제시하지만, 가중치 감쇠 비율에 대한 처방은 없다.

### A.3 KRX 실증 결과 — 반증

Stage A-1 (2704종목 2026년 실증):
```
  IC(rw) = -0.010  (거의 무상관, 약한 음수)

  해석:
    레짐 변화 탐지 자체는 유효할 수 있으나
    0.15 선형 감쇠로 패턴 가중치에 변환하는 과정에서 정보가 손실
    → 노이즈와 구별 불가
```

### A.4 현재 상태

rw는 Stage A-1 상수 감사에서 **E등급 Deprecated**로 분류되었다.

- 코드에서 계산은 유지됨 (patterns.js:252-271), Wc 가중합에 미포함
- ctx.regimeWeight에 저장되나 이후 Wc 산출 경로에서 참조되지 않음
- Jeffrey 발산 자체의 레짐 탐지 유효성은 부정되지 않았음 (IC가 거의 0)
- 감쇠 함수의 비선형 대안(예: sigmoid(D_J - threshold)) 실험 여지가 있음

코드 매핑: `js/patterns.js:252-271` (returns60/20 윈도우 + D_J 계산 + regimeWeight)
엔진 적용 효과: 제외함으로써 미미한 노이즈 제거 (IC 개선폭 0.010)

### A.5 Phase 3 M18 Calibration 검증 (2026-03-25)

**대상**: `patterns.js:270` `regimeWeight = Math.max(0.7, Math.min(1.0, 1 - dj * 0.15))`
**파라미터**: 감쇠 계수 0.15 + 하한 클램프 0.7

**Calibration 상태**: 미검증 (교정 불필요 — 비활성 상태)

**데이터 근거**: 없음.
- `calibrated_constants.json` 5개 항목(C-1, C-2, D-1, D-2, D-3) 중 rw 관련 항목 없음.
- `mra_coefficients.json`에서 rw 계수 = +3.039이나, 이는 rw가 Wc에 포함된
  경우의 회귀 결과이며 현재 rw는 Wc 곱셈에서 제외된 상태임.
- rw가 Wc에 미포함이므로 0.15 감쇠나 [0.7, 1.0] 경계의 실증적 최적화 실익 없음.

**현재 등급**: E등급 (비활성, Wc 곱셈에서 제외)

```
비활성 확인 경로 (patterns.js):
  Line 274: ctx = { ..., regimeWeight }   ← ctx에는 저장됨
  Line 320: wc = effectiveHw * mw          ← rw 미포함 (hw×mw만)

mra_coefficients.json rw 계수 해석 주의:
  rw 계수 = +3.040은 12열 MRA에서 rw를 독립변수로 포함한 회귀 결과.
  현행 Wc = hw × mw이며 rw는 Wc 산출에 참여하지 않음.
  계수의 양수 부호는 rw가 활성화될 경우 수익률 예측에 기여할 수 있음을
  시사하나, IC = -0.010으로 실증 유효성은 확인되지 않음.
```

**권장 조치**: 반증 기록 유지. 재활성화 조건:
- 비선형 변환(sigmoid, tanh) 후 IC 재측정에서 |IC| > 0.03 달성 시
- 레짐 탐지 윈도우 최적화(현재 60/20일 → 다른 비율) 실험 후 성과 개선 시

### 금융 적용 관련

- Kullback, S. & Leibler, R.A. (1951), *On Information and Sufficiency*, Annals of Mathematical Statistics, 22(1), 79-86
- Čencov, N.N. (1982), *Statistical Decision Rules and Optimal Inference*, Translations of Mathematical Monographs, AMS
- Cramér, H. (1946), *Mathematical Methods of Statistics*, Princeton University Press
- Barndorff-Nielsen, O.E. (1977), *Exponentially Decreasing Distributions for the Logarithm of Particle Size*, Proceedings of the Royal Society A
- Gatheral, J. (2006), *The Volatility Surface: A Practitioner's Guide*, Wiley
- Cont, R. (2001), *Empirical Properties of Asset Returns: Stylized Facts and Statistical Issues*, Quantitative Finance, 1(2), 223-236

### 계산 및 알고리즘

- Pascanu, R. & Bengio, Y. (2013), *Revisiting Natural Gradient for Deep Networks*, arXiv:1301.3584
- Martens, J. (2020), *New Insights and Perspectives on the Natural Gradient Method*, JMLR, 21(146), 1-76
- Nielsen, F. & Garcia, V. (2009), *Statistical Exponential Families: A Digest with Flash Cards*, arXiv:0911.4863
