# 11B. 강화학습 고급 기법 — Advanced Reinforcement Learning Techniques

> 11_reinforcement_learning.md에서 다룬 RL 기초(MDP, Q-Learning, DQN, Policy Gradient,
> A2C/A3C, PPO)를 기반으로, 금융 거래에 적용되는 고급 강화학습 기법을 다룬다.
>
> Multi-Agent RL, Inverse RL, Meta-Learning, Model-Based RL, Safe RL 등
> 최신 연구 주제와 실전 적용 방법론을 체계화한다.

---

## 1. 다중 에이전트 강화학습 (Multi-Agent RL)

```
시장 시뮬레이션을 위한 다중 에이전트 환경:

참여자 유형:
  Agent_trend    — 추세 추종 전략
  Agent_mean_rev — 평균 회귀 전략
  Agent_noise    — 노이즈 트레이더
  Agent_mm       — 마켓메이커

각 에이전트:
  aᵢ_t = πᵢ(sᵢ_t; θᵢ)

시장 가격 결정:
  Pₜ = f(a¹_t, a²_t, ..., aⁿ_t)
  → 수요-공급 균형으로 결정

Nash equilibrium 탐색:
  → 각 에이전트가 다른 에이전트의 전략을 고려하여 최적 반응
  → 진화 게임 이론(09_game_theory.md §5)과의 연결
```

Spooner et al. (2018), *Market Making via Reinforcement Learning*
→ RL 기반 마켓메이커의 최적 호가 전략 학습

---

## 2. 역강화학습 (Inverse Reinforcement Learning)

Ng & Russell (2000), *Algorithms for Inverse Reinforcement Learning*

```
역강화학습: 전문가의 행동에서 보상 함수를 추론

문제 설정:
  Given: 전문가의 거래 기록 τ* = {(sₜ, aₜ)}
  Find:  보상 함수 R*(s, a) such that
         π* = argmax_π E_π[Σ γᵗ R*(sₜ, aₜ)]이
         전문가의 행동을 설명

접근법 — Maximum Entropy IRL (Ziebart et al., 2008):
  P(τ) ∝ exp(Σ_t R_θ(sₜ, aₜ))

  → 전문가가 어떤 보상 함수를 최적화하고 있는지 역추론
  → 해당 보상 함수로 새로운 에이전트 학습

금융 적용:
  → 성공적인 트레이더의 거래 기록에서 암묵적 전략 추출
  → "전문가는 RSI를 어떤 가중치로 고려하는가?" 추론
  → 명시적으로 설명하기 어려운 거래 직관의 정량화
```

---

## 3. 메타 학습 (Meta-Learning for Market Regime Adaptation)

Finn et al. (2017), *Model-Agnostic Meta-Learning (MAML)*

```
시장 레짐 (Market Regime):
  상승장 (Bull), 하락장 (Bear), 횡보장 (Sideways)
  고변동성 (High Vol), 저변동성 (Low Vol)

문제: 레짐이 변하면 기존 정책이 무효화

MAML 적용:
  메타 목적 함수:
    min_θ Σ_{T_i ~ p(T)} L(f_{θ'_i})
    θ'_i = θ - α · ∇_θ L_T_i(f_θ)

  각 태스크 Tᵢ = 특정 시장 레짐에서의 거래

과정:
  1) 메타 파라미터 θ 학습 (다양한 시장 레짐에서)
  2) 새로운 레짐 감지 → 소수 데이터로 빠르게 적응
     θ_new = θ - α · ∇_θ L_new(f_θ)

  → "어떻게 빠르게 새 시장에 적응할 것인가"를 학습
  → 시장 구조 변화(structural break)에 대한 강건성 확보
```

---

## 4. 모델 기반 강화학습 (Model-Based RL with World Models)

Ha & Schmidhuber (2018), *World Models*

```
Model-Free vs Model-Based:

Model-Free:
  환경과 직접 상호작용하여 정책 학습
  → 금융: 실제 시장에서 거래하며 학습 (비용 막대)

Model-Based:
  환경 모델을 학습한 뒤, 모델 내에서 시뮬레이션하여 정책 학습
  → 금융: 시장 동작 모델을 학습 → 시뮬레이션 거래로 정책 개선

World Model 구조:
  1) Vision Model (V): 고차원 관측 → 잠재 표현
     zₜ = V(oₜ)

  2) Memory Model (M): 시계열 동학 모델링
     hₜ = M(hₜ₋₁, zₜ, aₜ)

  3) Controller (C): 정책
     aₜ = C(zₜ, hₜ)

금융 적용:
  V: OHLCV + 지표 → 시장 상태의 잠재 표현 압축
  M: 시장 동학의 예측 모델 (가격 변화, 변동성 변화)
  C: 거래 결정

  "꿈 속에서 학습" (Dream Learning):
  → 학습된 시장 모델 내에서 수백만 번 시뮬레이션
  → 실제 시장 데이터 없이도 정책 개선 가능
  → 단, 모델 오차(model bias)에 주의
```

---

## 5. 안전 강화학습 (Safe RL with Constraints)

Achiam et al. (2017), *Constrained Policy Optimization (CPO)*

```
제약 조건이 있는 MDP (CMDP):

max_π E[Σ γᵗ rₜ]           — 수익 극대화
s.t.  E[Σ γᵗ cᵢ(sₜ, aₜ)] ≤ dᵢ  ∀i  — 위험 제약

금융 위험 제약 예시:
  c₁: 최대 낙폭 ≤ 10%
  c₂: 일일 VaR(95%) ≤ 2%
  c₃: 포지션 집중도 ≤ 30%
  c₄: 최대 레버리지 ≤ 2×

CPO 업데이트:
  Lagrangian:
    L(θ, λ) = J(θ) - Σᵢ λᵢ · (Cᵢ(θ) - dᵢ)

  Primal: θ ← θ + α_θ · ∇_θ L
  Dual:   λᵢ ← max(0, λᵢ + α_λ · (Cᵢ(θ) - dᵢ))

  → 제약 위반 시 λᵢ 증가 → 해당 제약에 대한 패널티 강화
  → 실무 리스크 관리 규정을 학습에 직접 반영
```

---

## 참고문헌

```
[다중 에이전트]
Spooner, T. et al. (2018). Market Making via Reinforcement Learning. AAMAS-18.

[역강화학습]
Ng, A.Y. & Russell, S. (2000). Algorithms for Inverse Reinforcement Learning. ICML-00.
Ziebart, B. et al. (2008). Maximum Entropy Inverse Reinforcement Learning. AAAI-08.

[메타 학습]
Finn, C. et al. (2017). Model-Agnostic Meta-Learning for Fast Adaptation of
  Deep Networks. ICML-17.

[모델 기반 RL]
Ha, D. & Schmidhuber, J. (2018). World Models. arXiv:1803.10122.

[안전 강화학습]
Achiam, J. et al. (2017). Constrained Policy Optimization. ICML-17.
```
