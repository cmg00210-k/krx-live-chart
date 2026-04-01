# 10. 최적 제어 이론 — Optimal Control Theory in Financial Markets

> 시장은 불확실성 속에서 연속적인 의사결정을 요구한다.
> 최적 제어 이론은 "시간에 따라 변화하는 시스템을 어떻게 최적으로 조종할 것인가"를 수학적으로 풀어낸다.

---

## 1. 기초 프레임워크 (Basic Framework)

### 1.1 상태 공간 표현 (State-Space Representation)

포트폴리오의 동학을 연속시간 확률 미분방정식으로 표현한다.

```
상태 변수 (State Variables):
  X(t) = 포트폴리오 가치 (wealth)
  S(t) = 자산 가격 벡터
  θ(t) = 시장 상태 (변동성, 추세 등)

제어 변수 (Control Variables):
  u(t) = (π(t), c(t))
  π(t) = 자산 배분 비중 (allocation weights)
  c(t) = 소비율 또는 거래 속도 (trading rate)
```

포트폴리오 동학의 확률 미분방정식:

```
dX(t) = X(t) · [r + π(t)·(μ - r)] dt
        + X(t) · π(t) · σ dW(t)
        - c(t) dt

X(t): 시점 t에서의 포트폴리오 가치
r: 무위험 이자율
μ: 위험자산 기대수익률
σ: 위험자산 변동성
W(t): 위너 과정 (Brownian motion)
π(t): 위험자산 배분 비율
c(t): 소비율
```

### 1.2 목적 함수 (Objective Functional)

최적 제어 문제는 목적 함수를 최대화(또는 최소화)하는 제어를 찾는 것이다.

```
일반 형태:

J(t, x; u) = E[∫ₜᵀ f(s, X(s), u(s)) ds + g(X(T)) | X(t) = x]

f(·): 순간 보상 함수 (running reward)
g(·): 최종 보상 함수 (terminal reward)
u(·): 제어 전략 (admissible control)

목표: V(t, x) = sup_u J(t, x; u)  — 가치 함수 (value function)
```

금융에서의 주요 목적 함수:

```
(1) 기대 효용 최대화 (Expected Utility Maximization):
    max_u E[U(X(T))]
    U(x) = 효용 함수 (단조증가, 오목)

(2) 평균-분산 최적화 (Mean-Variance):
    max_u {E[X(T)] - γ/2 · Var[X(T)]}
    γ = 위험 회피 계수

(3) 실행 비용 최소화 (Implementation Shortfall):
    min_u E[Σ 거래비용 + 시장충격비용]

(4) 최대 낙폭 제어 (Drawdown Control):
    max_u E[X(T)]  s.t.  P(MDD > d) ≤ ε
```

### 1.3 허용 제어 (Admissible Controls)

```
제어 u(t)의 허용 조건:
  1. 적응적 (adapted): u(t)는 시점 t까지의 정보에만 의존
  2. 가측적 (measurable): 적분 가능
  3. 제약 조건 충족: π(t) ∈ Π (허용 배분 집합)

실전 제약:
  - 공매도 금지: π(t) ≥ 0
  - 레버리지 제한: Σπᵢ(t) ≤ L
  - 거래량 제한: |du/dt| ≤ U_max
  - KRX 가격제한폭: ΔP ≤ ±30%
```

---

## 2. 해밀턴-야코비-벨만 방정식 (Hamilton-Jacobi-Bellman Equation)

### 2.1 동적 프로그래밍 원리 (Dynamic Programming Principle)

Richard Bellman (1957), *Dynamic Programming*, Princeton University Press

```
벨만의 최적성 원리 (Principle of Optimality):

"최적 정책은 다음 성질을 갖는다:
 초기 상태와 초기 결정이 무엇이든,
 나머지 결정들은 초기 결정 이후의 상태에 대해
 최적 정책을 구성해야 한다."

수학적 표현:
V(t, x) = sup_u E[∫ₜᵗ⁺ᐩᵗ f(s, X(s), u(s)) ds + V(t+Δt, X(t+Δt)) | X(t) = x]
```

### 2.2 HJB 방정식 유도

동적 프로그래밍 원리에서 Δt → 0 극한을 취한다.

```
단계 1: 벨만 방정식 전개

V(t, x) = sup_u {f(t, x, u)·Δt + E[V(t+Δt, X(t+Δt))] + O(Δt²)}

단계 2: 이토 보조정리 (Itô's Lemma) 적용

dV = ∂V/∂t · dt + ∂V/∂x · dX + ½ · ∂²V/∂x² · (dX)²

여기서 (dX)² = σ²(x, u)² dt  (이토 계산법)

단계 3: 기대값 계산

E[dV] = [∂V/∂t + μ(x,u) · ∂V/∂x + ½σ²(x,u) · ∂²V/∂x²] dt

단계 4: Δt로 나누고 Δt → 0

0 = ∂V/∂t + sup_u [f(t,x,u) + μ(x,u) · ∂V/∂x + ½σ²(x,u) · ∂²V/∂x²]
```

### 2.3 HJB 방정식의 표준 형태

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ∂V/∂t + max_u [f(x,u) + μ(x,u)·∂V/∂x + ½σ²(x,u)·∂²V/∂x²]  │
│                           = 0                                    │
│                                                                  │
│  경계 조건: V(T, x) = g(x)  (최종 시점 조건)                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

V(t, x): 가치 함수 (value function)
u: 제어 변수
f: 순간 보상
μ: 드리프트 (상태 변화율)
σ: 확산 계수 (변동성)
g: 최종 보상
```

**HJB 일반 형태와 선형-이차 특수 경우:**

```
일반 HJB:
  0 = min_u {L·V(x) + r(x, u)}

  L: 상태 과정의 무한소 생성자 (infinitesimal generator)
     L·V = μ(x,u)·∂V/∂x + ½σ²(x,u)·∂²V/∂x²
  r(x, u): 순간 비용 함수

선형-이차(LQ) 특수 경우:
  상태 동학: dx = (Ax + Bu)dt + σ dW       (선형)
  비용 함수: r(x,u) = x'Qx + u'Ru          (이차)

  가치 함수가 이차 형태를 가짐:
    V(x) = x'Px + c

  P는 대수 Riccati 방정식을 만족:
    A'P + PA - PBR⁻¹B'P + Q = 0

  최적 제어:
    u* = -R⁻¹B'Px

  → LQ 문제는 해석적 해가 존재하는 유일한 비자명 사례
  → 금융에서 평균-분산 최적화는 LQ 문제의 특수 경우
```

### 2.4 검증 정리 (Verification Theorem)

Fleming & Rishel (1975), *Deterministic and Stochastic Optimal Control*

```
검증 정리:

만약 함수 W(t, x)가 다음을 만족하면:

(i)   W ∈ C^{1,2}([0,T] × ℝ)  (충분히 매끄러움)

(ii)  ∂W/∂t + max_u [f(x,u) + μ(x,u)·∂W/∂x + ½σ²(x,u)·∂²W/∂x²] = 0

(iii) W(T, x) = g(x)

(iv)  최대화를 달성하는 u*(t,x)가 존재

그러면:
  (a) W(t, x) = V(t, x)  (W는 가치 함수와 일치)
  (b) u*(t, x)는 최적 제어이다
```

이 정리는 HJB 방정식의 해가 실제로 최적 제어 문제의 해임을 보장한다.
후보 해를 검증하는 데 사용된다.

### 2.5 확률적 최적 제어와의 연결

```
결정론적 제어:     ẋ = f(x, u)
확률적 제어:       dX = μ(X, u)dt + σ(X, u)dW

결정론적 HJB:     ∂V/∂t + max_u [f·∂V/∂x] = 0
확률적 HJB:       ∂V/∂t + max_u [μ·∂V/∂x + ½σ²·∂²V/∂x²] = 0
                                               ↑
                          불확실성(확산)이 추가하는 2차 편미분항
```

금융에서는 시장의 본질적 불확실성으로 인해 확률적 최적 제어가 필수적이다.
이토 미적분학과 편미분방정식(PDE)의 결합이 핵심 도구가 된다.

---

## 3. 머튼의 포트폴리오 문제 (Merton's Portfolio Problem)

### 3.1 배경

Robert C. Merton (1969), *Lifetime Portfolio Selection under Uncertainty:
The Continuous-Time Case*, Review of Economics and Statistics

Robert C. Merton (1971), *Optimum Consumption and Portfolio Rules in a
Continuous-Time Model*, Journal of Economic Theory

(1997 노벨 경제학상 — Black-Scholes-Merton 모형 공동)

### 3.2 문제 설정

```
시장 구조:
  무위험 자산: dB = r·B dt       (이자율 r)
  위험 자산:   dS = μ·S dt + σ·S dW  (기하 브라운 운동)

투자자의 부(wealth):
  dX = X·[r + π(μ-r)] dt + X·π·σ dW - c dt

  π(t): 위험 자산 배분 비율
  c(t): 소비율

목적 함수:
  max_{π, c} E[∫₀ᵀ e^{-ρt} U(c(t)) dt + e^{-ρT} B(X(T))]

  ρ: 주관적 할인율 (시간 선호)
  U(c): 소비 효용 함수
  B(X): 유산(bequest) 함수
```

### 3.3 CRRA 효용 해 (Constant Relative Risk Aversion)

```
CRRA 효용 함수:
  U(c) = c^{1-γ} / (1-γ),   γ > 0, γ ≠ 1

  γ: 상대 위험 회피 계수 (relative risk aversion)
  γ = 1일 때 U(c) = ln(c)  (로그 효용)
```

HJB 방정식에 CRRA 효용을 대입하여 풀면:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  최적 자산 배분 (Optimal Allocation):                     │
│                                                         │
│         μ - r                                           │
│  π* = ─────────                                         │
│         γ · σ²                                          │
│                                                         │
│  μ - r : 초과 수익률 (risk premium)                      │
│  γ     : 위험 회피 계수                                  │
│  σ²    : 분산 (위험)                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

이 공식의 의미:
- 초과수익(μ-r)이 클수록 → 위험자산 비중 증가
- 위험회피(γ)가 클수록 → 위험자산 비중 감소
- 변동성(σ²)이 클수록 → 위험자산 비중 감소
- **최적 배분은 시간에 독립적** (근시안적 최적성, myopic optimality)

### 3.4 로그 효용 특수 경우 (Log Utility, γ = 1)

```
U(c) = ln(c)

최적 배분:
  π* = (μ - r) / σ²

최적 소비:
  c* = ρ · X(t)  (부의 일정 비율 소비)

가치 함수:
  V(t, x) = [ln(x) + A(t)] / ρ

  A(t) = (1/ρ)·{(r + (μ-r)²/(2σ²))·(T-t) + ln(ρ) - ...}
```

로그 효용의 특수 성질:
- 성장률 최대화 (Kelly 기준과 동일)
- 포트폴리오 보험이 불필요
- 분리 정리 (separation theorem) 성립

### 3.5 다자산 확장

```
n개 위험 자산으로 확장:

  dSᵢ = Sᵢ · (μᵢ dt + Σⱼ σᵢⱼ dWⱼ),  i = 1, ..., n

최적 배분 벡터:
  π* = (1/γ) · Σ⁻¹ · (μ - r·1)

  Σ = σσᵀ  (공분산 행렬)
  μ - r·1 = 초과수익률 벡터

→ Markowitz의 평균-분산 최적화와 연결
→ CAPM의 미시적 기초를 제공
```

---

## 4. 최적 실행 전략 (Optimal Execution)

### 4.1 Almgren-Chriss 모형

Robert Almgren & Neil Chriss (2001), *Optimal Execution of Portfolio
Transactions*, Journal of Risk

대량 주문의 최적 실행 문제: 시장 충격을 최소화하면서 목표 수량을 거래

```
문제 설정:

  Q: 총 거래 수량 (예: 100만주 매도)
  T: 거래 완료 시한
  q(t): 시점 t에서의 잔여 수량
  v(t) = -dq/dt: 거래 속도 (trading rate)

  초기 조건: q(0) = Q
  종료 조건: q(T) = 0
```

### 4.2 시장 충격 모형 (Market Impact Model)

```
가격 동학:

  S(t) = S₀ + σW(t) - g(v(t)) - h(q(t))

  S₀: 초기 가격
  σW(t): 가격의 무작위 변동

  일시적 충격 (Temporary Impact):
    g(v) = η · v(t)
    η: 일시적 충격 계수
    → 빠르게 거래하면 불리한 가격에 체결

  영구적 충격 (Permanent Impact):
    h(q) = γ_p · (Q - q(t))
    γ_p: 영구적 충격 계수
    → 거래가 정보를 전달하여 가격 영구 변동
```

### 4.3 Almgren-Chriss 최적 해

```
목적 함수 (Implementation Shortfall 최소화):

  min_v E[비용] + λ · Var[비용]

  λ: 위험 회피 파라미터

최적 거래 궤적:

  q*(t) = Q · sinh[κ(T-t)] / sinh[κT]

  κ = √(λσ² / η)

  → 쌍곡사인 함수(sinh) 형태의 해
```

### 4.4 특수 경우: TWAP과 VWAP

```
TWAP (Time-Weighted Average Price):
  λ → 0 (위험 중립)일 때:
  q*(t) = Q · (1 - t/T)
  v*(t) = Q/T  (균일 거래 속도)
  → 시간에 따라 균등하게 분할 매매

VWAP (Volume-Weighted Average Price):
  거래 속도를 시장 거래량에 비례시킴:
  v*(t) = Q · f(t) / ∫₀ᵀ f(s) ds
  f(t) = 시점 t의 시장 거래량 프로파일
  → U자형 (장 초반·후반에 집중)

Almgren-Chriss 해:
  λ 작음 → TWAP에 접근
  λ 큼   → 전반부 집중 실행 (front-loaded)
  → TWAP과 즉시 실행(block trade) 사이의 최적 타협
```

### 4.5 실전 확장

```
적응적 실행 (Adaptive Execution):
  시장 상태에 따라 실시간으로 전략 조정

  - 유동성 양호 → 거래 속도 증가
  - 유동성 부족 → 거래 속도 감소
  - 가격 역행 → 공격적 실행
  - 가격 순행 → 보수적 실행 (이익 확보)

KRX 적용:
  - KOSPI 200 구성종목: 유동성 높음 → κ 작음 → TWAP 유사
  - 소형주: 유동성 낮음 → κ 큼 → 전반부 집중
  - 동시호가 시간대 활용: 시장충격 없이 대량 거래 가능
```

---

## 5. 확률적 제어와 필터링 (Stochastic Control and Filtering)

### 5.1 칼만 필터 (Kalman Filter)

Rudolf Kalman (1960), *A New Approach to Linear Filtering and Prediction
Problems*, Journal of Basic Engineering

관측 불가능한 상태를 추정하는 최적 선형 필터:

```
상태 방정식 (State Equation):
  xₜ₊₁ = A · xₜ + B · uₜ + wₜ    (wₜ ~ N(0, Q))

관측 방정식 (Observation Equation):
  yₜ = C · xₜ + vₜ               (vₜ ~ N(0, R))

xₜ: 숨겨진 상태 (예: 실제 추세, 진정한 변동성)
yₜ: 관측값 (예: 관측 가격, 거래량)
wₜ: 과정 잡음 (process noise)
vₜ: 관측 잡음 (measurement noise)
```

칼만 필터 재귀 알고리즘:

```
예측 단계 (Prediction):
  x̂ₜ|ₜ₋₁ = A · x̂ₜ₋₁|ₜ₋₁
  Pₜ|ₜ₋₁ = A · Pₜ₋₁|ₜ₋₁ · Aᵀ + Q

갱신 단계 (Update):
  Kₜ = Pₜ|ₜ₋₁ · Cᵀ · (C · Pₜ|ₜ₋₁ · Cᵀ + R)⁻¹   — 칼만 이득
  x̂ₜ|ₜ = x̂ₜ|ₜ₋₁ + Kₜ · (yₜ - C · x̂ₜ|ₜ₋₁)       — 상태 갱신
  Pₜ|ₜ = (I - Kₜ · C) · Pₜ|ₜ₋₁                    — 오차 공분산 갱신

Kₜ: 칼만 이득 (Kalman gain)
  → 예측 오차에 대한 관측의 기여도
  → 0에 가까우면: 모형 예측 신뢰
  → 1에 가까우면: 관측값 신뢰
```

금융 적용:
- 가격의 잡음을 제거하여 "진짜 추세" 추정
- 이동평균은 칼만 필터의 특수 경우로 해석 가능
- 시변 베타(β) 추정, 시변 변동성 추정

**적응적 과정 잡음 Q (Adaptive Process Noise):**

표준 칼만 필터는 Q를 상수로 가정하나, 금융 시계열에서는
변동성 레짐 전환으로 인해 Q가 시변해야 최적 추적이 가능하다.

```
Mohamed & Schwarz (1999), "Adaptive Kalman Filtering for INS/GPS":

  Q_k = α · ε_k · ε_k' + (1 - α) · Q_{k-1}

  ε_k = y_k - C · x̂_{k|k-1}    (혁신 시퀀스, innovation sequence)
  α: 적응 학습률 (forgetting factor)

금융 데이터 적용:
  α ∈ [0.01, 0.1] for 일봉 데이터
    α 작음 (0.01): 느린 적응, 안정적 추정 (장기 추세 추적)
    α 큼  (0.10): 빠른 적응, 레짐 전환에 민감 (단기 변동 추적)

  수렴 조건: ε_k가 정상(stationary)이고 α < 1이면
    Q_k는 실제 과정 잡음의 이동 평균으로 수렴 (Mohamed & Schwarz 1999).

  KRX 적용: indicators.js calcKalman()의 Q = 0.01 (고정)을
    적응적 Q_k로 대체하면 변동성 레짐 전환 시 추적 성능 개선 기대.
    단, Q_k 업데이트는 계산 비용이 낮아 실시간 적용 가능.
```

Tier 분류: Kalman Q 고정값은 [D][L:GS] (Doc22 #36), 적응적 α는 추가 시 [C][L:GCV].

### 5.2 은닉 마르코프 모형 (Hidden Markov Model, HMM)

```
시장 국면 전환 (Regime Switching):

  은닉 상태 sₜ ∈ {1, 2, ..., K}  — K개의 시장 국면

전이 확률:
  P(sₜ₊₁ = j | sₜ = i) = aᵢⱼ  — 전이 행렬 A

관측 모형:
  P(yₜ | sₜ = k) = N(μₖ, σₖ²)  — 국면별 수익률 분포

예시 (2-국면 모형):
  국면 1 (상승장): μ₁ = +0.05%/일, σ₁ = 1.0%
  국면 2 (하락장): μ₂ = -0.10%/일, σ₂ = 2.5%

  전이 행렬: A = [0.98  0.02]
                  [0.05  0.95]
  → 상승장 평균 지속: 1/0.02 = 50일
  → 하락장 평균 지속: 1/0.05 = 20일
```

HMM 알고리즘:
```
전방 알고리즘 (Forward Algorithm):
  αₜ(j) = P(y₁,...,yₜ, sₜ = j)  — 필터링
  → 현재 국면 확률 실시간 추정

Baum-Welch 알고리즘 (EM):
  파라미터 (A, μ, σ) 추정

Viterbi 알고리즘:
  가장 확률 높은 국면 경로 추정
  → 사후적 추세/횡보 구간 식별
```

### 5.3 부분 관측 마르코프 결정 과정 (POMDP)

```
POMDP = (S, A, T, R, Ω, O, γ)

S: 상태 공간 (시장 국면 — 직접 관측 불가)
A: 행동 공간 (매수, 매도, 관망)
T: 전이 함수 T(s'|s, a)
R: 보상 함수 R(s, a)
Ω: 관측 공간 (가격, 거래량 등)
O: 관측 함수 O(o|s', a)
γ: 할인 인자

핵심 개념:
  b(s) = P(sₜ = s | 관측 이력)  — 신념 상태 (belief state)

  → POMDP를 신념 공간의 연속 상태 MDP로 변환
  → 가치 함수: V(b) = max_a [R(b, a) + γ Σ V(b')]
```

금융 적용:
- 시장 국면(상승/하락/횡보)을 직접 관측할 수 없음
- 가격, 거래량, 기술적 지표를 통해 국면을 추론
- 추론된 국면(신념 상태)에 기반하여 최적 매매 결정

---

## 6. 폰트랴긴 최대 원리 (Pontryagin's Maximum Principle)

### 6.1 배경

Lev Pontryagin et al. (1962), *The Mathematical Theory of Optimal
Processes*, Interscience Publishers

HJB 방정식과 함께 최적 제어의 두 가지 핵심 접근법 중 하나.

### 6.2 해밀턴 함수 (Hamiltonian)

```
상태 방정식: ẋ = f(t, x, u)

해밀턴 함수:
  H(t, x, u, p) = f(t, x, u) · p + L(t, x, u)

  x: 상태 변수
  u: 제어 변수
  p: 수반 변수 (adjoint variable / costate variable)
  L: 순간 보상 (Lagrangian)
```

### 6.3 최적성의 필요 조건

```
폰트랴긴 최대 원리:

최적 제어 u*(t)에 대해 다음이 성립한다:

(1) 상태 방정식 (State Equation):
    ẋ* = ∂H/∂p = f(t, x*, u*)

(2) 수반 방정식 (Adjoint/Costate Equation):
    ṗ = -∂H/∂x

(3) 최대화 조건 (Maximum Condition):
    H(t, x*, u*, p) ≥ H(t, x*, u, p)   ∀u ∈ U

    즉, u* = argmax_u H(t, x, u, p)
```

### 6.4 횡단 조건 (Transversality Conditions)

```
자유 최종 상태 (Free Terminal State):
  p(T) = ∂g/∂x |_{x=x*(T)}

고정 최종 상태 (Fixed Terminal State):
  x*(T) = x_T  (주어진 값)
  p(T): 자유 (제약의 라그랑주 승수로 결정)

자유 최종 시간 (Free Terminal Time):
  H(T, x*(T), u*(T), p(T)) = 0

무한 지평선 (Infinite Horizon):
  lim_{t→∞} p(t) · x*(t) = 0  (횡단 조건)
```

### 6.5 확률적 최대 원리

```
확률적 상태 방정식:
  dX = μ(t, X, u) dt + σ(t, X, u) dW

확률적 수반 방정식 (Backward SDE):
  dp = -∂H/∂x dt + q dW

  q: 수반 확산 과정

확률적 해밀턴 함수:
  H(t, x, u, p, q) = μ(t, x, u)·p + σ(t, x, u)·q + L(t, x, u)
```

### 6.6 HJB 방정식과의 비교

```
┌──────────────────┬──────────────────────┬──────────────────────┐
│                  │ HJB 방정식            │ 최대 원리             │
├──────────────────┼──────────────────────┼──────────────────────┤
│ 접근 방식        │ 편미분방정식 (PDE)     │ 상미분방정식 (ODE)    │
│ 핵심 함수        │ 가치 함수 V(t,x)      │ 해밀턴 함수 H         │
│ 조건 종류        │ 충분 조건 (검증 정리)   │ 필요 조건             │
│ 차원의 저주      │ 상태 차원 증가 시 심각  │ 상대적으로 유연        │
│ 피드백 제어      │ u*(t,x) 직접 도출     │ 개루프 제어 u*(t)     │
│ 수치적 접근      │ 유한차분법, FEM       │ 슈팅법, 공동상태법     │
│ 확률 문제        │ 확률적 PDE            │ 후진 SDE             │
│ 금융 활용        │ 옵션 가격, 포트폴리오  │ 최적 실행, 헤징       │
└──────────────────┴──────────────────────┴──────────────────────┘

→ 두 접근법은 충분히 매끄러운 문제에서는 동치
→ 금융에서는 HJB가 더 널리 사용 (피드백 제어의 편리성)
→ 고차원 문제에서는 최대 원리가 계산상 유리할 수 있음
```

---

## 7. 기술적 분석과의 연결 (Connection to Technical Analysis)

### 7.1 이동평균 = 최적 필터

```
특정 가정 하에서 이동평균은 칼만 필터의 특수 경우:

가정: 가격 = 추세 + 백색잡음
  yₜ = μₜ + εₜ,  μₜ = μₜ₋₁ + ηₜ

칼만 필터 해:
  μ̂ₜ = (1 - K) · μ̂ₜ₋₁ + K · yₜ

이것은 지수이동평균(EMA)과 동일한 형태:
  EMA_t = α · P_t + (1 - α) · EMA_{t-1}

  K = α = 칼만 이득 = 2/(N+1)

→ EMA의 기간(N)은 신호 대 잡음비(SNR)에 의해 결정되는 최적 파라미터
→ SNR 높음 (추세 강함): K 큼 → 짧은 EMA → 빠른 반응
→ SNR 낮음 (잡음 많음): K 작음 → 긴 EMA → 잡음 제거 우선
```

### 7.2 RSI/MACD = 제어 신호 (Control Signals)

```
최적 제어 관점에서의 기술적 지표:

RSI (Relative Strength Index):
  제어 변수 해석:
    RSI > 70 → 과매수 → π* 감소 (위험자산 배분 축소)
    RSI < 30 → 과매도 → π* 증가 (위험자산 배분 확대)

  HJB 연결:
    RSI ∝ 상태 변수의 추정치
    과매수/과매도 = 가치 함수 V(x)의 기울기 ∂V/∂x 변화

MACD (Moving Average Convergence Divergence):
  신호 해석:
    MACD 라인: 추세의 칼만 필터 추정 (빠른 EMA - 느린 EMA)
    시그널 라인: 추세 추정치의 평활화
    히스토그램: 추세 변화의 가속도

  최적 제어 대응:
    MACD > 0 & 증가: 상태가 호전 → 제어 u 증가 (포지션 확대)
    MACD < 0 & 감소: 상태가 악화 → 제어 u 감소 (포지션 축소)
    MACD 교차: 국면 전환 신호 → 제어 전략 전환점
```

### 7.3 손절매 = 최적 정지 문제 (Optimal Stopping Problem)

```
최적 정지 문제:

  V(x) = sup_τ E[e^{-rτ} g(X(τ)) | X(0) = x]

  τ: 정지 시점 (stopping time)
  g(x): 정지 시 보상 (payoff at stopping)

자유 경계 문제 (Free Boundary Problem):
  상태 공간이 두 영역으로 분할:
    - 계속 영역 (Continuation Region): 포지션 유지
    - 정지 영역 (Stopping Region): 포지션 청산

  경계에서의 조건:
    V(x*) = g(x*)           — 가치 매칭 (value matching)
    V'(x*) = g'(x*)         — 매끄러운 접합 (smooth pasting)

손절매(Stop-Loss)의 최적 제어 해석:
  - 손절 수준 = 최적 정지 경계 x*
  - 수학적으로는 미국형 풋옵션의 조기행사 문제와 동일 구조
  - 최적 손절 수준은 변동성, 추세, 거래비용의 함수

  최적 손절 수준 (근사):
    x* ≈ x₀ · exp(-k · σ · √(Δt))
    k: 위험 선호에 따른 상수 (통상 1.5~3.0)
```

### 7.4 포지션 사이징 = 최적 제어

```
Kelly 기준과 머튼 해의 관계:

연속 시간 최적 배분 (머튼, γ=1):
  f* = π* = (μ - r) / σ²

→ 머튼의 로그 효용 해 = Kelly 기준의 연속시간 버전
→ Kelly 기준 = γ=1인 최적 제어의 해

켈리 기준의 상세 유도 및 실전 확장(이산 Kelly, Half Kelly,
분수 Kelly, 다자산 Kelly 등)은 14_finance_management.md §3.1을 참조.
```

### 7.5 기술적 분석 도구와 최적 제어 개념의 매핑

```
┌────────────────────────┬─────────────────────────────────────────┐
│ 최적 제어 개념          │ 기술적 분석 도구                         │
├────────────────────────┼─────────────────────────────────────────┤
│ 상태 추정 (칼만 필터)   │ 이동평균 (SMA, EMA)                     │
│ 국면 탐지 (HMM)        │ 볼린저 밴드 폭, ADX                     │
│ 최적 배분 (π*)         │ 포지션 사이징, Kelly 기준                │
│ 최적 정지 (정지 경계)   │ 손절매 (Stop-Loss), 이익실현             │
│ 제어 신호              │ RSI, MACD, 스토캐스틱                   │
│ 시장 충격 최소화       │ TWAP/VWAP 분할 매매                     │
│ 동적 프로그래밍        │ 추세 추종 + 역추세 전환 전략             │
│ HJB 가치 함수          │ 기대 수익 대비 위험 (Risk-Reward Ratio)  │
│ 수반 변수 (costate)    │ 기회비용 — 대안 포지션의 가치            │
│ 횡단 조건              │ 투자 기간 종료 시 포지션 청산 규칙       │
│ 폰트랴긴 최대 원리     │ 시점별 최적 행동 결정 (진입/청산 타이밍)  │
│ 확률적 제어            │ 불확실성 하의 적응적 전략 조정            │
└────────────────────────┴─────────────────────────────────────────┘
```

---

## 주요 참고 문헌

```
[1] Merton, R.C. (1969), "Lifetime Portfolio Selection under Uncertainty:
    The Continuous-Time Case", Review of Economics and Statistics, 51(3).

[2] Merton, R.C. (1971), "Optimum Consumption and Portfolio Rules in a
    Continuous-Time Model", Journal of Economic Theory, 3(4).

[3] Almgren, R. & Chriss, N. (2001), "Optimal Execution of Portfolio
    Transactions", Journal of Risk, 3(2).

[4] Fleming, W.H. & Rishel, R.W. (1975), Deterministic and Stochastic
    Optimal Control, Springer-Verlag.

[5] Pham, H. (2009), Continuous-time Stochastic Control and Optimization
    with Financial Applications, Springer.

[6] Bellman, R. (1957), Dynamic Programming, Princeton University Press.

[7] Pontryagin, L.S. et al. (1962), The Mathematical Theory of Optimal
    Processes, Interscience Publishers.

[8] Kalman, R.E. (1960), "A New Approach to Linear Filtering and
    Prediction Problems", Journal of Basic Engineering, 82(1).

[9] Kelly, J.L. (1956), "A New Interpretation of Information Rate",
    Bell System Technical Journal, 35(4).

[10] Bertsimas, D. & Lo, A.W. (1998), "Optimal Control of Execution
     Costs", Journal of Financial Markets, 1(1).
```
