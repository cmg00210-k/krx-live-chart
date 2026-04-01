# 12. 극단값 이론 — Extreme Value Theory in Financial Risk

> 정규분포는 "평균적인 날"을 설명한다.
> 극단값 이론(EVT)은 "최악의 날"을 수학적으로 모형화한다.
> 시장이 무너질 때, 정규분포를 믿은 자가 가장 먼저 쓰러진다.

---

## 1. 극단값 이론 기초 (EVT Foundations)

### 1.1 정규분포의 실패

금융 수익률의 가장 근본적인 "양식화된 사실(Stylized Facts)"은
정규분포가 극단적 사건의 빈도를 심각하게 과소평가한다는 것이다.

```
정규분포의 예측 vs 실제:

사건 규모        정규분포 예측 빈도        실제 관찰 빈도
±3σ             0.27%  (연 ~0.7일)       ~1-2%  (연 ~3-5일)
±4σ             0.006% (160년에 1회)      ~0.1%  (연 ~0.25일)
±5σ             0.00006% (14,000년에 1회)  금융위기 시 수차례 관찰
±10σ            10⁻²³ (우주 수명에도 불가)  1987년 블랙먼데이 실제 발생

→ 정규분포의 실패 원인: 꼬리(tail)가 지수적으로 감소
→ 실제 금융 수익률: 꼬리가 멱법칙(power law)으로 완만히 감소
```

### 1.2 금융 수익률의 양식화된 사실 (Stylized Facts)

Cont, R. (2001), *Empirical Properties of Asset Returns*, Quantitative Finance

```
1) 두꺼운 꼬리 (Fat Tails / Leptokurtosis):
   첨도 K > 3 (정규분포 K = 3)
   → KOSPI 일별 수익률 첨도: 약 5~15
   → S&P 500 일별 수익률 첨도: 약 5~10

2) 비대칭성 (Negative Skewness):
   왜도 S < 0 → 급락이 급등보다 더 극단적
   → "계단식 상승, 엘리베이터식 하락"

3) 변동성 군집 (Volatility Clustering):
   |rₜ|과 |rₜ₊ₕ|의 양의 자기상관
   → GARCH 효과: 큰 변동 뒤에 큰 변동

4) 꼬리 의존성 (Tail Dependence):
   위기 시 자산 간 상관관계 급등
   → 분산투자 효과가 가장 필요할 때 사라짐
```

### 1.3 역사적 극단 사건

```
블랙 먼데이 (1987년 10월 19일):
  다우존스 -22.6% (하루)
  → 정규분포 하 확률: ≈ 10⁻¹⁶⁰ (물리적으로 불가능)
  → EVT 프레임워크에서는 "희귀하지만 가능한" 사건

아시아 금융위기 (1997년):
  KOSPI: 1997년 6월 780 → 1998년 6월 280 (-64%)
  원/달러: 850 → 1,960 (+130%)
  → 여러 시장에서 동시 극단값 발생 (다변량 극단값 문제)

글로벌 금융위기 (2008년):
  S&P 500: 2007년 10월 1,565 → 2009년 3월 676 (-57%)
  KOSPI: 2,085 → 892 (-57%)
  → 일별 -7%~-9% 하락이 수차례 발생
  → VaR 모형의 대규모 실패 ("VaR 위반" 연속 발생)

KOSPI 서킷브레이커 발동 사례:
  2020년 3월 13일: COVID-19 → 8% 하락으로 발동
  2020년 3월 19일: 재차 발동
  → 극단 사건은 군집하여 발생 (독립이 아님)
```

Mandelbrot, B. (1963), *The Variation of Certain Speculative Prices*,
Journal of Business — 면화 가격에서 최초로 두꺼운 꼬리 발견

---

## 2. 피셔-티펫-그네덴코 정리 (Fisher-Tippett-Gnedenko Theorem)

### 2.1 블록 최대값 방법 (Block Maxima Method)

극단값 이론의 첫 번째 접근법은 데이터를 일정 기간(블록)으로 나누고,
각 블록의 최대값(또는 최소값)의 분포를 연구하는 것이다.

```
설정:
  X₁, X₂, ..., Xₙ ~ i.i.d. 확률변수 (일별 수익률)
  Mₙ = max(X₁, X₂, ..., Xₙ)  (n일 동안의 최대 수익률)

블록 구성 예:
  블록 크기 = 20 거래일 (약 1개월)
  10년 데이터 → 약 120개의 블록 최대값

질문: 적절한 정규화 후 Mₙ의 극한 분포는?
```

### 2.2 피셔-티펫-그네덴코 정리

Fisher & Tippett (1928), Gnedenko (1943)

```
정리 (Fisher-Tippett-Gnedenko):

적절한 정규화 상수 aₙ > 0, bₙ이 존재하여
(Mₙ - bₙ) / aₙ 이 비퇴화 분포 G에 수렴하면,
G는 반드시 일반화 극단값 분포(GEV)에 속한다.

→ 중심극한정리가 합(sum)의 극한을 정규분포로 보내듯,
  이 정리는 최대값(max)의 극한을 GEV로 보낸다.
```

### 2.3 일반화 극단값 분포 (Generalized Extreme Value Distribution)

```
GEV 분포 함수:

G(x; μ, σ, ξ) = exp{-[1 + ξ(x - μ)/σ]^(-1/ξ)}

모수:
  μ ∈ ℝ     — 위치 모수 (location)
  σ > 0     — 척도 모수 (scale)
  ξ ∈ ℝ     — 형상 모수 (shape) ← 핵심 모수

조건: 1 + ξ(x - μ)/σ > 0
```

### 2.4 세 가지 유형

```
형상 모수 ξ에 따른 세 가지 극단값 분포 유형:

1) 검벨 분포 (Gumbel, Type I): ξ = 0
   G(x) = exp{-exp[-(x - μ)/σ]}
   → 꼬리가 지수적으로 감소 (얇은 꼬리)
   → 정규분포, 지수분포 등의 극단값

2) 프레셰 분포 (Fréchet, Type II): ξ > 0
   G(x) = exp{-[(x - μ)/σ]^(-1/ξ)}  (x > μ)
   → 꼬리가 멱법칙으로 감소 (두꺼운 꼬리)
   → Student-t, 파레토, 코시 분포 등의 극단값
   ★ 금융 수익률은 이 유형에 해당

3) 바이불 분포 (Weibull, Type III): ξ < 0
   G(x) = exp{-[-(x - μ)/σ]^(-1/ξ)}  (x < μ)
   → 유한 상한(finite upper endpoint) 존재
   → 균등분포, 베타분포 등의 극단값
```

### 2.5 금융 수익률과 프레셰 유형

```
실증 결과:

금융 수익률의 GEV 피팅 시 일반적으로 ξ > 0 (프레셰 유형)

  KOSPI: ξ ≈ 0.2 ~ 0.4 (연구에 따라 다름)
  S&P 500: ξ ≈ 0.2 ~ 0.3
  환율: ξ ≈ 0.1 ~ 0.3

의미:
  ξ > 0 → 꼬리가 멱법칙(power law)을 따름
  ξ 클수록 → 극단 사건이 더 빈번
  ξ = 0.25 → 4번째 적률(첨도)이 무한대

→ 정규분포(ξ = 0, 검벨)를 가정하면
  극단 사건의 확률을 수백~수천 배 과소평가
```

Coles, S. (2001), *An Introduction to Statistical Modeling of Extreme Values*,
Springer — EVT의 표준 교과서

---

## 3. 초과 임계값 방법 (Peaks Over Threshold — POT)

### 3.1 왜 POT인가?

```
블록 최대값 방법의 한계:
  - 블록 내 두 번째로 큰 값도 극단적일 수 있으나 버려짐
  - 데이터 낭비가 심함 (10년 일별 → ~120개만 사용)
  - 블록 크기 선택이 자의적

POT의 장점:
  - 임계값(threshold)을 넘는 모든 관측치 사용
  - 더 많은 극단 데이터 활용
  - 실무에서 더 널리 사용됨
```

### 3.2 일반화 파레토 분포 (Generalized Pareto Distribution)

```
임계값 u를 초과하는 값의 조건부 분포:

Y = X - u  (초과량, excess)

일반화 파레토 분포 (GPD):

H(y; σ, ξ) = 1 - (1 + ξy/σ)^(-1/ξ)    (y > 0)

모수:
  σ > 0  — 척도 모수 (scale)
  ξ ∈ ℝ  — 형상 모수 (shape)

ξ = 0인 경우 (극한):
  H(y) = 1 - exp(-y/σ)  (지수분포)

조건: y > 0,  1 + ξy/σ > 0
```

### 3.3 피컨즈-발케마-드한 정리 (Pickands-Balkema-de Haan Theorem)

Pickands (1975), Balkema & de Haan (1974)

```
정리:

X의 분포 F가 GEV의 흡인 영역(domain of attraction)에 속하면,
충분히 큰 임계값 u에 대해:

P(X - u ≤ y | X > u) ≈ H(y; σᵤ, ξ)

여기서:
  σᵤ = σ + ξ(u - μ)  (임계값에 따라 척도 모수 조정)
  ξ는 GEV의 형상 모수와 동일

→ 임계값을 넘는 초과량은 GPD를 따른다
→ GEV의 형상 모수 ξ와 GPD의 ξ가 동일
→ 이론적으로 두 방법은 동치(equivalent)
```

### 3.4 임계값 선택 (Threshold Selection)

```
평균 초과 함수 (Mean Excess Function / Mean Residual Life Plot):

e(u) = E[X - u | X > u]

GPD가 성립하면:
  e(u) = (σ + ξu) / (1 - ξ)

→ e(u)는 u의 선형 함수
→ 그래프에서 선형이 시작되는 지점 = 적절한 임계값

실무 지침:
  - u가 너무 낮으면: 비극단 데이터 포함 → 편향(bias) 증가
  - u가 너무 높으면: 표본 수 부족 → 분산(variance) 증가
  - 편향-분산 트레이드오프 (bias-variance tradeoff)
  - 일반적으로 상위 5~10% 지점 사용
  - KOSPI 일별 수익률: |rₜ| > 2~3% 수준
```

### 3.5 GPD 모수 추정

```
1) 최대우도추정 (Maximum Likelihood Estimation, MLE):

로그우도함수:
  ℓ(σ, ξ) = -N_u · ln(σ) - (1 + 1/ξ) · Σ ln(1 + ξyᵢ/σ)

  여기서 N_u = 임계값 초과 관측치 수
        yᵢ = xᵢ - u (초과량)

→ ξ > -0.5일 때 정칙 조건 충족 (금융 데이터는 ξ > 0이므로 문제 없음)

2) 확률가중적률법 (Probability Weighted Moments, PWM):

  β_r = E[X · F(X)^r]

  ξ̂ = 2 - β₀/(β₀ - 2β₁)
  σ̂ = 2β₀β₁/(β₀ - 2β₁)

→ MLE보다 소표본에서 안정적
→ ξ < 0.5일 때 유효

3) 힐 추정량 (Hill Estimator):
  → 별도 섹션에서 상세 다룸 (§5.3)
```

Embrechts, P., Klüppelberg, C. & Mikosch, T. (1997),
*Modelling Extremal Events for Insurance and Finance*, Springer
— EVT의 금융/보험 적용 바이블

---

## 4. 꼬리 위험 측정 (Tail Risk Measures)

### 4.1 VaR과 EVT

```
전통적 VaR (정규분포 가정):

VaR_p = μ + σ · Φ⁻¹(p)

  p = 신뢰수준 (예: 0.99)
  Φ⁻¹ = 표준정규분포의 분위수 함수

EVT 기반 VaR (GPD 이용):

VaR_p = u + (σ/ξ) · [((n/N_u) · (1 - p))^(-ξ) - 1]

  u = 임계값
  σ, ξ = GPD 모수
  n = 전체 관측치 수
  N_u = 임계값 초과 관측치 수

※ 주의: 위 VaR은 1일 보유기간 기준. T일 보유기간으로 환산:
  VaR_T ≈ VaR_1 × T^(1/α)  (멱법칙 꼬리)
  VaR_T ≈ VaR_1 × √T        (정규분포 근사, 과소추정 주의)

핵심 차이:
  정규분포 VaR: 꼬리가 지수적으로 감소 → 극단 분위수 과소평가
  EVT VaR: 꼬리가 멱법칙으로 감소 → 극단 분위수 정확 추정
```

### 4.2 기대 부족분 (Expected Shortfall / CVaR)

```
ES = E[X | X > VaR_p]  (VaR을 초과하는 손실의 기대값)

EVT 기반 ES:

ES_p = VaR_p / (1 - ξ) + (σ - ξ·u) / (1 - ξ)
     = [VaR_p + σ - ξ·u] / (1 - ξ)

조건: ξ < 1 (ξ ≥ 1이면 기대값 자체가 무한대)
```

### 4.3 정규분포 VaR vs EVT VaR 비교

```
KOSPI 일별 수익률 기반 비교 (예시):

신뢰수준    정규분포 VaR    EVT VaR     과소평가 비율
99%        -2.33σ         -2.5σ~-3σ    ~10-30%
99.5%      -2.58σ         -3σ~-4σ      ~20-50%
99.9%      -3.09σ         -4σ~-6σ      ~50-100%
99.97%     -3.43σ         -5σ~-8σ      ~100-200%

→ 신뢰수준이 높아질수록(더 극단적 사건) 정규분포의 과소평가가 심화
→ 99.9% VaR에서 정규분포는 실제 위험을 절반 이하로 추정

실무적 함의:
  - 99% VaR: 정규분포도 "그럭저럭" 사용 가능
  - 99.9% VaR: EVT가 반드시 필요
  - 자본 규제(바젤 III): 99.9% 수준 → EVT 없이는 부적절
```

### 4.4 일관된 위험 측도 (Coherent Risk Measures)

Artzner, P., Delbaen, F., Eber, J.-M. & Heath, D. (1999),
*Coherent Measures of Risk*, Mathematical Finance

```
일관된 위험 측도의 4가지 공리:

1) 단조성 (Monotonicity):
   X ≤ Y a.s. ⟹ ρ(X) ≥ ρ(Y)
   → 손실이 항상 큰 포지션은 더 높은 위험

2) 양의 동차성 (Positive Homogeneity):
   ρ(λX) = λρ(X),  λ > 0
   → 포지션 크기에 비례하여 위험 증가

3) 이전 불변성 (Translation Invariance):
   ρ(X + c) = ρ(X) - c
   → 무위험 자산 추가 시 위험 감소

4) 하위 가법성 (Sub-additivity):
   ρ(X + Y) ≤ ρ(X) + ρ(Y)
   → 분산투자 효과 반영

VaR: 하위 가법성 불충족 → 비일관적 위험 측도
  → 두 포지션 합산 VaR > 개별 VaR 합이 가능 (분산투자 역효과)

ES (CVaR): 네 가지 공리 모두 충족 → 일관된 위험 측도
  → 바젤 III에서 VaR을 ES로 대체하는 근거
```

---

## 5. 블랙 스완 모델링 (Black Swan Modeling)

### 5.1 탈레브의 프레임워크

Taleb, N.N. (2007), *The Black Swan: The Impact of the Highly Improbable*,
Random House

```
블랙 스완의 세 가지 특성:

1) 이상치(outlier): 과거 경험으로 예측 불가능
2) 극단적 영향(extreme impact): 거대한 결과 초래
3) 사후 설명(retrospective predictability): 발생 후에야 설명 가능

탈레브의 핵심 주장:
  - 정규분포(가우시안) 세계 → "평균의 나라" (Mediocristan)
  - 멱법칙(power law) 세계 → "극단의 나라" (Extremistan)
  - 금융 시장은 Extremistan에 속한다
  - 리스크 관리는 "알려진 위험"이 아닌 "알 수 없는 위험"에 집중해야
```

### 5.2 멱법칙 꼬리 (Power Law Tails)

```
멱법칙 꼬리 분포:

P(X > x) ~ L(x) · x^(-α)    (x → ∞)

  α > 0: 꼬리 지수 (tail index)
  L(x): 서서히 변하는 함수 (slowly varying function)

특성:
  α ≤ 1: 기대값 무한대
  α ≤ 2: 분산 무한대
  α ≤ n: n번째 적률 무한대

금융 시장의 꼬리 지수:
  일반적으로 α ≈ 3 ~ 5
  → 첨도(4번째 적률)가 무한대이거나 매우 큼
  → 분산(2번째 적률)은 유한 → 포트폴리오 이론 적용 가능
  → 그러나 분산 추정이 매우 불안정

※ 정밀 해석:
  α ≈ 3: 분산(2차 적률) 유한, 왜도(3차) 조건부 유한, 첨도(4차) 발산 가능
  → Markowitz 포트폴리오 이론의 분산-공분산 최적화는 적용 가능하나,
    첨도 기반 위험 측정(예: VaR의 Cornish-Fisher 확장)은 불안정
  → 이 경우 EVT 기반 위험 측정이 필수적

Mandelbrot (1963): 면화 가격 α ≈ 1.7 (안정 분포)
Gabaix et al. (2003): 주가 수익률 α ≈ 3 (역세제곱 법칙)
Cont (2001): α ≈ 3 ~ 5 (다양한 시장)
```

### 5.3 힐 추정량 (Hill Estimator)

Hill, B.M. (1975), *A Simple General Approach to Inference about
the Tail of a Distribution*, Annals of Statistics

```
꼬리 지수 α의 추정:

X₍₁₎ ≥ X₍₂₎ ≥ ... ≥ X₍ₙ₎  (내림차순 순서통계량)

힐 추정량:
  Ĥₖ = (1/k) · Σᵢ₌₁ᵏ [ln X₍ᵢ₎ - ln X₍ₖ₊₁₎]

  α̂ = 1/Ĥₖ  (꼬리 지수 추정)

k: 사용하는 상위 순서통계량 개수

k 선택의 딜레마 (임계값 선택과 동일한 문제):
  k 너무 작음 → 분산 큼 (데이터 부족)
  k 너무 큼 → 편향 큼 (비꼬리 데이터 포함)

힐 플롯 (Hill Plot):
  k 값에 대해 α̂(k) 그래프
  → 안정 구간(plateau) = 적절한 k

최적 k 선택 방법론:
  - Hill plot 안정 구간 방법 (시각적, 주관적)
  - Danielsson et al. (2001), "Using a Bootstrap Method to Choose the
    Sample Fraction in Tail Index Estimation" — 데이터 기반 최적 k 선택.
    Bootstrap 반복으로 MSE를 최소화하는 k를 추정.
  - k = √n 규칙은 편의적 경험칙(rule-of-thumb)이며 특정 저자 귀속 불가.
    표본 크기에 따라 과소/과대 추정 위험이 있으므로 데이터 적응적 방법 권장.
```

**대안 추정량: Dekkers-Einmahl-de Haan (DEH, 1989) 모멘트 추정량:**

```
DEH 모멘트 추정량:
  M⁽¹⁾ = (1/k) Σᵢ₌₁ᵏ [ln X₍ᵢ₎ - ln X₍ₖ₊₁₎]
  M⁽²⁾ = (1/k) Σᵢ₌₁ᵏ [ln X₍ᵢ₎ - ln X₍ₖ₊₁₎]²

  ξ̂_DEH = M⁽¹⁾ + 1 - (1/2) / (1 - (M⁽¹⁾)² / M⁽²⁾)

장점: Hill 추정량(ξ > 0에서만 유효)과 달리 ξ ≤ 0에도 적용 가능.
      얇은 꼬리(thin tail) 분포에서 보다 강건.
단점: 두꺼운 꼬리에서는 Hill 추정량 대비 분산이 높음.
```

Dekkers, A.L.M., Einmahl, J.H.J. & de Haan, L. (1989),
"A Moment Estimator for the Index of an Extreme-Value Distribution",
Annals of Statistics, 17(4), 1833-1855.

### 5.4 ξ와 α의 관계

```
GEV/GPD의 형상 모수 ξ와 멱법칙 꼬리 지수 α:

α = 1/ξ

ξ = 0.2  →  α = 5  (상대적으로 얇은 꼬리)
ξ = 0.25 →  α = 4  (첨도 무한대 경계)
ξ = 0.33 →  α = 3  (역세제곱 법칙)
ξ = 0.5  →  α = 2  (분산 무한대 경계)
ξ = 1.0  →  α = 1  (기대값 무한대 경계, 코시 분포)

금융 시장 실증:
  ξ ≈ 0.2 ~ 0.33  (α ≈ 3 ~ 5)
  → 분산은 유한하지만 불안정
  → 첨도는 무한대이거나 극도로 큼
  → 정규분포 기반 모형(VaR, 볼린저 밴드)의 이론적 한계
```

### 5.5 멱법칙의 생성 메커니즘

```
금융 시장에서 멱법칙 꼬리가 나타나는 원인:

1) 이질적 투자자 (Heterogeneous Agents):
   → 다양한 시간 수평(horizon)의 참여자
   → Lux & Marchesi (1999): 에이전트 모형에서 멱법칙 발생

2) 자기강화 메커니즘 (Self-Reinforcing):
   → 가격 하락 → 마진콜 → 강제 매도 → 추가 하락
   → 정보 폭포 (Information Cascade): 흑삼병의 메커니즘

3) 경제 규모의 분포:
   Gabaix (2009): 기업 규모가 멱법칙 → 시장 충격도 멱법칙
   → "잘게 쪼개지지 않은(granular)" 경제 구조

4) 변동성의 확률적 성질:
   → 확률적 변동성(stochastic volatility) + 정규 혁신(innovation)
   → 혼합 분포(mixture) → 무조건부 분포의 꼬리가 두꺼워짐
```

---

## 6. 다변량 극단값 (Multivariate Extremes)

### 6.1 꼬리 의존성 (Tail Dependence)

```
꼬리 의존성 계수:

상측 꼬리 의존성:
  λᵤ = lim_{q→1⁻} P(X > F_X⁻¹(q) | Y > F_Y⁻¹(q))

하측 꼬리 의존성:
  λₗ = lim_{q→0⁺} P(X ≤ F_X⁻¹(q) | Y ≤ F_Y⁻¹(q))

해석:
  λ = 0: 점근적 독립 (asymptotic independence)
  λ > 0: 점근적 의존 (asymptotic dependence)

금융 실증:
  정상 시장: 상관계수 ρ ≈ 0.3 ~ 0.6
  위기 시장: λₗ ≈ 0.3 ~ 0.5 (하측 꼬리 의존성 존재)

→ 상관계수만으로는 위기 시 공동 급락 위험을 포착하지 못함
→ 꼬리 의존성 모형화 필요
```

### 6.2 극단값 코풀라 (Extreme Value Copulas)

```
코풀라 (Copula):
  다변량 분포의 의존 구조만 분리하는 함수

스클라 정리 (Sklar's Theorem):
  F(x, y) = C(F_X(x), F_Y(y))
  → 결합분포 = 코풀라(주변분포₁, 주변분포₂)

극단값 코풀라:
  C(u^t, v^t) = C(u, v)^t  ∀t > 0

  → 극단값의 의존 구조에 적합

대표적 극단값 코풀라:

1) 구스타프손 코풀라 (Gumbel Copula):
   C(u, v) = exp{-[(-ln u)^θ + (-ln v)^θ]^(1/θ)}
   θ ≥ 1, θ = 1이면 독립
   → 상측 꼬리 의존성 존재, 하측 없음

2) 갈람보스 코풀라 (Galambos Copula):
   → 유연한 꼬리 의존 구조

3) 스튜던트-t 코풀라 (Student-t Copula):
   → 대칭적 꼬리 의존성 (상·하측 동일)
   → 자유도 ν가 작을수록 꼬리 의존성 강함
   → 금융 실무에서 광범위하게 사용
```

### 6.3 전염 모델링 (Contagion Modeling)

```
위기 전염 메커니즘:

1) 상관 변화 모형:
   정상기: ρ_normal ≈ 0.3
   위기 시: ρ_crisis ≈ 0.7 ~ 0.9

   Forbes & Rigobon (2002): 분산 증가로 인한 상관 편향 보정 필요

2) 점프 전파 모형:
   시장 A 급락 → 시장 B 동반 급락
   조건부 점프 강도: λ_B|A(t)

3) 극단값 의존 구조:
   χ(u) = 2 - log C(u, u) / log u   (u → 1)

   χ = 0: 극단 사건 독립
   χ > 0: 극단 사건 동시 발생 경향

금융 적용:
  1997년: 태국 바트화 위기 → 한국 원화, 인도네시아 루피아 전염
  2008년: 미국 서브프라임 → 전 세계 동시 급락
  → 다변량 EVT로 시스템 위험 정량화
```

### 6.4 시스템 위험 측정 (Systemic Risk Measurement)

```
시스템 위험 지표:

1) CoVaR (Conditional VaR):
   Adrian & Brunnermeier (2016)
   CoVaR_q^{시스템|기관i} = VaR of system | 기관 i가 VaR 수준

   ΔCoVaR = CoVaR^{위기시} - CoVaR^{정상시}
   → 개별 기관이 시스템에 미치는 위험 기여도

2) MES (Marginal Expected Shortfall):
   Acharya et al. (2017)
   MES_i = E[R_i | R_market < VaR_market]
   → 시장 급락 시 개별 자산의 기대 손실

3) SRISK (Systemic Risk Index):
   Brownlees & Engle (2017)
   → 위기 시 개별 기관의 자본 부족 예상액
   → 뉴욕대 Stern V-Lab에서 실시간 발표
```

McNeil, A.J., Frey, R. & Embrechts, P. (2015),
*Quantitative Risk Management: Concepts, Techniques and Tools*,
Princeton University Press — 계량적 위험관리의 표준 교과서

---

## 7. 기술적 분석과의 연결 (Connection to Technical Analysis)

### 7.1 볼린저 밴드 폭과 꼬리 위험

```
표준 볼린저 밴드:
  상단 = MA₂₀ + 2σ₂₀
  하단 = MA₂₀ - 2σ₂₀

정규분포 가정: ±2σ 이탈 확률 = 4.6%
실제 (ξ ≈ 0.25): ±2σ 이탈 확률 ≈ 7~10%

EVT 보정 볼린저 밴드:
  확률 p에 대응하는 실제 밴드폭 = σ · q_GPD(p)

  여기서 q_GPD(p)는 GPD 분위수

  99% 신뢰구간:
    정규분포: ±2.58σ
    EVT (ξ=0.25): ±3.2σ ~ ±3.8σ

→ 볼린저 밴드 이탈을 "극단 사건"으로 해석할 때
  EVT 보정이 필요
→ 밴드 이탈 빈도가 정규분포 예측보다 높은 것이 "이상"이 아님
  → 두꺼운 꼬리의 자연스러운 결과
```

### 7.2 RSI 극단값과 꼬리 사건

```
RSI 극단 영역:
  RSI > 80 또는 RSI < 20: 극단 영역
  RSI > 90 또는 RSI < 10: 초극단 영역

EVT 관점:
  초극단 RSI는 수익률 분포의 꼬리에 대응
  → GPD로 초극단 RSI의 지속 기간·반전 폭 모형화 가능

실증 패턴:
  RSI < 10 도달 후 반등 폭의 분포 ≈ GPD
  → 반등 폭의 기대값을 EVT로 추정

  RSI < 10 빈도:
    정규분포 수익률 가정 → 매우 희귀
    실제 → 두꺼운 꼬리로 인해 예상보다 빈번
```

### 7.3 갭 분석과 극단적 가격 이동

```
갭(Gap) = 전일 종가와 금일 시가의 차이

갭의 크기 분포:
  소규모 갭: 정규분포로 적합
  대규모 갭 (|갭| > 2σ): GPD가 적합

  P(갭 > x | 갭 > u) ≈ GPD(x - u; σ, ξ)

실무 활용:
  - 갭 크기별 충전(gap fill) 확률 추정
  - 대형 갭 후 추가 이동 폭 예측
  - 야간 리스크(overnight risk) 정량화
```

### 7.4 서킷브레이커와 EVT

```
KRX 서킷브레이커 규칙:
  1단계: KOSPI가 전일 대비 8% 이상 하락 + 1분 지속 → 20분 중단
  2단계: 15% 이상 하락 → 20분 중단
  3단계: 20% 이상 하락 → 당일 거래 중지

EVT로 서킷브레이커 발동 확률 추정:

  P(일별 하락 > 8%) = GPD 꼬리 확률

  정규분포 (σ ≈ 1.5%):
    P(하락 > 8%) ≈ P(Z > 5.3) ≈ 6 × 10⁻⁸ (극히 희박)

  EVT (ξ ≈ 0.25, σ_GPD ≈ 0.8%, u = 3%):
    P(하락 > 8%) ≈ 0.01 ~ 0.05%
    → 0.01%: 10,000 거래일 중 1회 ≈ 약 40년에 1회
    → 0.05%: 2,000 거래일 중 1회 ≈ 약 8년에 1회
    → 실제 KRX 역사와 대체로 일치 (1997 외환위기, 2008 금융위기, 2020 코로나)

→ EVT가 훨씬 현실적인 추정 제공
→ 가격제한폭(±30%)도 EVT로 적정성 평가 가능
```

### 7.5 패턴 실패와 블랙 스완

```
기술적 패턴의 성공률 (일반적 시장 vs 극단 시장):

패턴           정상 시장 성공률    블랙 스완 시 성공률
적삼병         ~65-70%           ~30-40%
이중바닥       ~60-65%           ~25-35%
헤드앤숄더     ~60-65%           ~20-30%
지지선 반등    ~55-60%           ~15-25%

원인:
  - 극단 사건 시 시장 미시구조(market microstructure) 변화
  - 유동성 증발: 호가창 급격히 축소
  - 정보 폭포: 기술적 수준 무시하고 매도 연쇄
  - 마진콜 강제 청산: 의사결정과 무관한 매도

대응 전략:
  - 포지션 사이징에 EVT VaR 적용
  - 극단 시장 감지 시 패턴 신뢰도 하향 조정
  - 꼬리 의존성 고려한 포트폴리오 구성
```

### 7.6 손절매 최적화와 EVT

```
전통적 손절매 설정:
  고정 비율: -2%, -3% 등
  ATR 기반: 2 × ATR(14)
  볼린저 밴드 하단

EVT 기반 손절매 최적화:

  최적 손절매 수준 = GPD 분위수

  목표: P(손실 > 손절매 수준) = 허용 확률

  예: 일별 1% 확률로 손절매에 도달
    → 손절매 = VaR(99%, GPD)
    → VaR_0.99 = u + (σ/ξ)·[(n/N_u · 0.01)^(-ξ) - 1]

장점:
  - 시장 상태(변동성 수준)에 적응적
  - 꼬리 위험을 정확히 반영
  - 정규분포 가정의 과소평가 방지

주의:
  - 손절매가 극단 사건에서 실행되지 않을 수 있음 (갭 리스크)
  - 슬리피지(slippage)도 GPD로 모형화 가능
```

---

## 핵심 정리: EVT 개념과 기술적 분석의 매핑

| EVT 개념 | 기술적 분석 대응 | 실무 활용 |
|---------|-----------------|---------|
| GEV 분포 (ξ > 0) | 볼린저 밴드 이탈 빈도 | 밴드 이탈 ≠ 반드시 반전, 두꺼운 꼬리의 자연 현상 |
| GPD / POT | RSI 극단 영역 (>80, <20) | 극단 RSI의 지속 기간·반전 폭 예측 |
| VaR (EVT) | 손절매 수준 설정 | 꼬리 위험 반영 손절가 = GPD 분위수 |
| ES / CVaR | 최대 손실 시나리오 | 손절 실패 시 기대 손실 규모 |
| 꼬리 지수 α | 급등/급락 규모 분포 | α < 4이면 첨도 무한 → 변동성 과소추정 주의 |
| 멱법칙 | 갭(Gap) 크기 분포 | 대형 갭 발생 확률의 현실적 추정 |
| 꼬리 의존성 | 섹터 간 동반 급락 | 위기 시 분산투자 효과 감소 경고 |
| 블랙 스완 | 패턴 실패 | 극단 시장에서 기술적 패턴 신뢰도 하락 |
| 서킷브레이커 | 가격 제한/거래 중단 | EVT로 발동 확률 추정, 인위적 지지선 형성 |
| 다변량 EVT | 상관관계 급등 | 위기 시 개별 종목 분석의 한계 인식 |

---

## 참고 문헌

```
[핵심 교과서]

Embrechts, P., Klüppelberg, C. & Mikosch, T. (1997).
  Modelling Extremal Events for Insurance and Finance.
  Springer. — EVT 금융 적용의 바이블

McNeil, A.J., Frey, R. & Embrechts, P. (2015).
  Quantitative Risk Management: Concepts, Techniques and Tools.
  2nd ed. Princeton University Press. — 계량적 위험관리 표준 교과서

Coles, S. (2001).
  An Introduction to Statistical Modeling of Extreme Values.
  Springer. — EVT 통계 모형의 입문서

[블랙 스완과 멱법칙]

Taleb, N.N. (2007).
  The Black Swan: The Impact of the Highly Improbable.
  Random House. — 극단 사건의 철학적·실무적 프레임워크

Mandelbrot, B. (1963).
  The Variation of Certain Speculative Prices.
  Journal of Business, 36(4), 394-419.
  — 금융 수익률 두꺼운 꼬리의 최초 실증 연구

Mandelbrot, B. & Hudson, R.L. (2004).
  The (Mis)Behavior of Markets.
  Basic Books. — 프랙탈 금융 이론의 대중적 소개

[이론적 기초]

Fisher, R.A. & Tippett, L.H.C. (1928).
  Limiting Forms of the Frequency Distribution of the Largest
  or Smallest Member of a Sample.
  Proceedings of the Cambridge Philosophical Society, 24, 180-190.

Gnedenko, B. (1943).
  Sur la distribution limite du terme maximum d'une série aléatoire.
  Annals of Mathematics, 44(3), 423-453.

Pickands, J. (1975).
  Statistical Inference Using Extreme Order Statistics.
  Annals of Statistics, 3(1), 119-131.

Balkema, A.A. & de Haan, L. (1974).
  Residual Life Time at Great Age.
  Annals of Probability, 2(5), 792-804.

Hill, B.M. (1975).
  A Simple General Approach to Inference about the Tail
  of a Distribution.
  Annals of Statistics, 3(5), 1163-1174.

[위험 측도와 금융 실증]

Artzner, P., Delbaen, F., Eber, J.-M. & Heath, D. (1999).
  Coherent Measures of Risk.
  Mathematical Finance, 9(3), 203-228.

Cont, R. (2001).
  Empirical Properties of Asset Returns: Stylized Facts
  and Statistical Issues.
  Quantitative Finance, 1(2), 223-236.

Gabaix, X., Gopikrishnan, P., Plerou, V. & Stanley, H.E. (2003).
  A Theory of Power-Law Distributions in Financial Market Fluctuations.
  Nature, 423, 267-270.

Adrian, T. & Brunnermeier, M.K. (2016).
  CoVaR. American Economic Review, 106(7), 1705-1741.

[시스템 위험]

Acharya, V., Pedersen, L., Philippon, T. & Richardson, M. (2017).
  Measuring Systemic Risk.
  Review of Financial Studies, 30(1), 2-47.

Brownlees, C. & Engle, R.F. (2017).
  SRISK: A Conditional Capital Shortfall Measure of Systemic Risk.
  Review of Financial Studies, 30(1), 48-79.
```
