# 11. 강화학습 — Reinforcement Learning in Financial Trading

> 에이전트가 환경(시장)과 상호작용하며 시행착오를 통해 최적의 거래 전략을 학습한다.
> 강화학습은 지도학습과 달리 정답 레이블이 필요 없으며,
> 지연된 보상(delayed reward)을 통해 장기적으로 최적인 행동을 발견한다.

---

## 1. 마르코프 결정 과정 (Markov Decision Process)

### 1.1 MDP 정의

강화학습의 수학적 프레임워크.

Bellman (1957), *Dynamic Programming*
Puterman (1994), *Markov Decision Processes: Discrete Stochastic Dynamic Programming*

```
MDP는 5-tuple로 정의된다:

M = (S, A, P, R, γ)

S  — 상태 공간 (State space)
A  — 행동 공간 (Action space)
P  — 전이 확률 (Transition probability)
     P(s'|s, a) = Pr(Sₜ₊₁ = s' | Sₜ = s, Aₜ = a)
R  — 보상 함수 (Reward function)
     R(s, a, s') → ℝ
γ  — 할인 인자 (Discount factor)
     γ ∈ [0, 1)
```

**마르코프 성질 (Markov Property)**:
```
P(Sₜ₊₁ | Sₜ, Aₜ) = P(Sₜ₊₁ | S₁, A₁, S₂, A₂, ..., Sₜ, Aₜ)

→ 미래 상태는 현재 상태와 행동에만 의존하며, 과거 이력에 독립
→ 금융 시장에서는 완전한 마르코프 성질이 성립하지 않으므로
  충분한 정보를 상태에 포함시키는 것이 핵심 설계 과제
```

### 1.2 거래를 위한 상태 공간 설계 (State Space Design)

```
상태 벡터 sₜ의 구성 요소:

1) 가격 정보:
   sₜ_price = [Oₜ, Hₜ, Lₜ, Cₜ, Vₜ]  (OHLCV)
   → 최근 n봉의 OHLCV 데이터 포함 가능

2) 기술적 지표:
   sₜ_indicators = [MA₂₀, MA₆₀, RSI₁₄, MACD, Signal, BB_upper, BB_lower, ...]

3) 포지션 정보:
   sₜ_position = [현재 포지션, 평균 매수가, 미실현 손익, 보유 기간]

4) 시장 상황:
   sₜ_market = [변동성(ATR), 거래량 변화율, 스프레드]

전체 상태:
   sₜ = [sₜ_price, sₜ_indicators, sₜ_position, sₜ_market]
```

**상태 공간의 차원 문제**:
- 차원이 너무 높으면 → 차원의 저주 (curse of dimensionality)
- 차원이 너무 낮으면 → 마르코프 성질 위반, 정보 손실
- 적절한 feature engineering이 성능을 좌우

### 1.3 행동 공간 설계 (Action Space Design)

```
이산 행동 공간 (Discrete Action Space):
  A = {매수(buy), 매도(sell), 관망(hold)}

확장된 이산 행동 공간:
  A = {강한매수, 약한매수, 관망, 약한매도, 강한매도}
  → 포지션 크기 조절 가능

연속 행동 공간 (Continuous Action Space):
  a ∈ [-1, 1]
  → -1: 최대 공매도, 0: 포지션 없음, +1: 최대 매수
  → 연속적인 포지션 비율 조절 가능

포트폴리오 할당:
  a = [w₁, w₂, ..., wₙ]  (n개 종목의 비중)
  제약 조건: Σwᵢ = 1, wᵢ ≥ 0 (공매도 불허 시)
```

### 1.4 보상 함수 설계 (Reward Function Design)

```
기본 보상 — 수익률:
  rₜ = (Pₜ₊₁ - Pₜ) / Pₜ × aₜ
  → aₜ: 행동(포지션 방향과 크기)

로그 수익률:
  rₜ = ln(Pₜ₊₁ / Pₜ) × aₜ
  → 시간 가산성(time-additivity) 보장

위험 조정 보상 — Sharpe ratio 기반:
  rₜ = (Rₜ - Rf) / σ(Rₜ)
  → Rf: 무위험 이자율
  → σ(Rₜ): 수익률의 표준편차 (이동 윈도우)

거래비용 반영:
  rₜ = 수익률 - c × |Δposition|
  → c: 거래당 비용 (수수료 + 슬리피지)
  → |Δposition|: 포지션 변화량
```

### 1.5 할인 인자의 거래 맥락 해석 (Discount Factor)

```
누적 보상:
  Gₜ = Σ_{k=0}^{∞} γᵏ · rₜ₊ₖ₊₁

γ → 1: 장기 수익 중시 → 장기 투자 전략
γ → 0: 즉각적 수익 중시 → 초단기 스캘핑
γ = 0.99: 약 100스텝 후 보상의 가치가 ~37%로 감소

거래 빈도에 따른 해석:
  일봉 기준 γ=0.99 → ~100거래일(약 5개월) 스케일
  분봉 기준 γ=0.99 → ~100분(약 1.5시간) 스케일
  → 타임프레임에 따라 γ의 의미가 달라짐
```

---

## 2. 가치 기반 방법 (Value-Based Methods)

### 2.1 가치 함수와 벨만 방정식

Bellman (1957), *Dynamic Programming*
Sutton & Barto (2018), *Reinforcement Learning: An Introduction*, 2nd ed.

```
상태 가치 함수 (State Value Function):
  V^π(s) = E_π[Gₜ | Sₜ = s]
          = E_π[Σ_{k=0}^{∞} γᵏ · rₜ₊ₖ₊₁ | Sₜ = s]

행동 가치 함수 (Action Value Function, Q-function):
  Q^π(s, a) = E_π[Gₜ | Sₜ = s, Aₜ = a]

벨만 기대 방정식 (Bellman Expectation Equation):
  V^π(s) = Σ_a π(a|s) · [R(s,a) + γ · Σ_{s'} P(s'|s,a) · V^π(s')]

벨만 최적 방정식 (Bellman Optimality Equation):
  V*(s) = max_a [R(s,a) + γ · Σ_{s'} P(s'|s,a) · V*(s')]
  Q*(s,a) = R(s,a) + γ · Σ_{s'} P(s'|s,a) · max_{a'} Q*(s',a')
```

금융 해석:
- V*(s): 상태 s에서 최적 전략을 따랐을 때의 기대 누적 수익
- Q*(s,a): 상태 s에서 행동 a를 취한 후 최적 전략을 따를 때의 기대 누적 수익
- 최적 정책: π*(s) = argmax_a Q*(s,a)

### 2.2 Q-Learning

Watkins (1989), *Learning from Delayed Rewards*, PhD thesis
Watkins & Dayan (1992), *Q-Learning*, Machine Learning

```
Q-Learning 업데이트 규칙:

Q(s,a) ← Q(s,a) + α · [r + γ · max_{a'} Q(s',a') - Q(s,a)]
                        \_________  TD target  _________/
                                          \_ TD error _/

α: 학습률 (learning rate), 0 < α ≤ 1
r: 즉시 보상
γ: 할인 인자
s': 다음 상태
max_{a'} Q(s',a'): 다음 상태에서의 최대 Q값

수렴 조건 (Watkins & Dayan, 1992):
  모든 (s,a) 쌍을 무한히 방문하고
  학습률이 조건 Σα = ∞, Σα² < ∞ 를 만족하면
  Q → Q*로 확률 1로 수렴
```

**거래 적용 예시**:
```
상태: s = [RSI=25, MACD=음, 포지션=없음]
행동: a = 매수
보상: r = +0.02 (2% 수익)
다음 상태: s' = [RSI=45, MACD=양, 포지션=매수]

Q(s, 매수) ← Q(s, 매수) + α · [0.02 + γ · max_a' Q(s', a') - Q(s, 매수)]

→ RSI가 과매도 구간에서 매수했을 때 양의 보상을 받으면
  Q(s, 매수) 값이 증가 → 유사 상황에서 매수 확률 상승
```

### 2.3 Deep Q-Network (DQN)

Mnih et al. (2015), *Human-Level Control through Deep Reinforcement Learning*, Nature

```
테이블 기반 Q-Learning의 한계:
  → 연속 상태 공간에서 모든 (s,a) 테이블 저장 불가능
  → 해결: Q 함수를 신경망으로 근사

Q(s, a; θ) ≈ Q*(s, a)

θ: 신경망 파라미터

손실 함수:
  L(θ) = E[(yₜ - Q(sₜ, aₜ; θ))²]

TD 타겟:
  yₜ = rₜ + γ · max_{a'} Q(sₜ₊₁, a'; θ⁻)

θ⁻: 타겟 네트워크 파라미터 (주기적으로 θ에서 복사)
```

**DQN의 두 가지 핵심 기법**:

```
1) 경험 재생 (Experience Replay):
   - 전이 (sₜ, aₜ, rₜ, sₜ₊₁)을 리플레이 버퍼 D에 저장
   - 학습 시 D에서 무작위 미니배치 샘플링
   - 장점: 데이터 상관성 제거, 데이터 효율성 향상
   - 금융 적용: 과거 거래 경험의 효율적 재활용

2) 타겟 네트워크 (Target Network):
   - 학습 네트워크(θ)와 별도의 타겟 네트워크(θ⁻) 사용
   - θ⁻는 매 C 스텝마다 θ로 업데이트
   - 장점: 학습 안정성 향상
```

※ DQN의 현대적 위치 (2020+ 기준):
  DQN (2015)은 기초선(baseline) 모형으로 분류됨.
  현대 표준 알고리즘:
  - Rainbow DQN (2017): 6가지 개선의 통합
  - SAC (Soft Actor-Critic, 2018): 연속 행동 공간에 최적
  - Decision Transformer (2021): 시퀀스 모델링 접근
  - MuZero (2020): 모델 기반 + 트리 탐색

  금융 적용 시 DQN보다 PPO 또는 SAC가 일반적으로 선호됨
  (연속적 포지션 크기 조절 필요 시 SAC 권장)

### 2.4 DQN 변형들

**Double DQN** — van Hasselt et al. (2016), *Deep Reinforcement Learning with Double Q-Learning*

```
DQN의 문제: max 연산으로 인한 Q값 과대추정 (overestimation)

해결: 행동 선택과 가치 평가를 분리

yₜ = rₜ + γ · Q(sₜ₊₁, argmax_{a'} Q(sₜ₊₁, a'; θ); θ⁻)
                    \___ 행동 선택: 학습 네트워크 ___/
           \_____ 가치 평가: 타겟 네트워크 _____/

→ 거래에서 과대추정은 과도한 매매(overtrading)를 유발
→ Double DQN으로 보수적 신호 생성 가능
```

**Dueling DQN** — Wang et al. (2016), *Dueling Network Architectures for Deep RL*

```
Q 함수를 상태 가치(V)와 이점 함수(A)로 분리:

Q(s, a; θ) = V(s; θ_V) + A(s, a; θ_A) - mean_a A(s, a; θ_A)

V(s): 상태 자체의 가치 (현재 시장 상황의 유리함)
A(s,a): 특정 행동의 추가 이점 (매수/매도/관망의 상대적 가치)

금융 해석:
  V(s) = "현재 시장이 전반적으로 유리한가?"
  A(s,a) = "이 시점에서 어떤 행동이 추가적으로 유리한가?"
```

**우선순위 경험 재생 (Prioritized Experience Replay)** — Schaul et al. (2016)

```
TD 오차가 큰 전이를 더 자주 샘플링:

P(i) ∝ |δᵢ|^α + ε

δᵢ: TD 오차 = |rₜ + γ · max_{a'} Q(s', a') - Q(s, a)|
α: 우선순위 지수 (0=균등 샘플링, 1=완전 우선순위)
ε: 작은 양수 (0 확률 방지)

중요도 가중치 (Importance Sampling):
  wᵢ = (1 / (N · P(i)))^β

금융 적용:
  → 큰 손실/이익이 발생한 거래를 더 자주 학습
  → 희귀하지만 중요한 시장 이벤트(급등, 급락)에서의 경험 중시
```

### 2.5 거래 신호 생성에의 적용

```
DQN 기반 거래 시스템 아키텍처:

입력 (State):
  [최근 60봉 OHLCV, RSI₁₄, MACD, BB, 포지션 정보]
  → shape: (60, feature_dim)

네트워크:
  CNN/LSTM → FC layers → Q values

출력 (Q values):
  Q(s, 매수), Q(s, 매도), Q(s, 관망)

거래 결정:
  a* = argmax_a Q(s, a)

  Q(s, 매수) = 1.5
  Q(s, 관망) = 0.8    → 매수 신호 발생
  Q(s, 매도) = -0.3

신뢰도:
  confidence = Q(s, a*) - second_max Q(s, a)
  → 값이 클수록 명확한 신호
```

---

## 3. 정책 기반 방법 (Policy-Based Methods)

### 3.1 정책 경사 정리 (Policy Gradient Theorem)

Sutton et al. (1999), *Policy Gradient Methods for Reinforcement Learning with Function Approximation*

```
정책 (Policy):
  π(a|s; θ) = P(Aₜ = a | Sₜ = s; θ)
  → 상태 s에서 행동 a를 선택할 확률 (파라미터 θ)

목적 함수:
  J(θ) = E_π[Σ_{t=0}^{T} γᵗ · rₜ]
  → 정책 π를 따랐을 때의 기대 누적 보상

정책 경사 정리 (Policy Gradient Theorem):
  ∇_θ J(θ) = E_π[∇_θ log π(a|s; θ) · Q^π(s, a)]

  ∇_θ log π(a|s; θ)  — 스코어 함수 (score function)
  Q^π(s, a)           — 행동 가치 함수

의미:
  → 높은 Q값을 가진 행동의 확률을 증가시키는 방향으로 θ 업데이트
  → 좋은 거래 결정의 확률은 높이고, 나쁜 거래의 확률은 낮춤
```

**가치 기반 vs 정책 기반 비교**:
```
가치 기반 (DQN 등):
  + 데이터 효율적 (off-policy 가능)
  + 이산 행동 공간에 적합
  - 연속 행동 공간 처리 어려움
  - 결정적 정책만 학습

정책 기반:
  + 연속 행동 공간 자연스러운 처리
  + 확률적 정책 학습 가능 → 탐험 내장
  + 포트폴리오 가중치 직접 출력 가능
  - 데이터 비효율적 (on-policy)
  - 높은 분산
```

### 3.2 REINFORCE 알고리즘

Williams (1992), *Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning*

```
REINFORCE (Monte Carlo Policy Gradient):

1) 정책 πθ로 에피소드 생성:
   τ = (s₀, a₀, r₁, s₁, a₁, r₂, ..., sₜ)

2) 각 스텝의 수익(return) 계산:
   Gₜ = Σ_{k=t}^{T} γ^(k-t) · rₖ

3) 파라미터 업데이트:
   θ ← θ + α · Σ_{t=0}^{T} ∇_θ log π(aₜ|sₜ; θ) · Gₜ

베이스라인을 사용한 분산 감소:
   θ ← θ + α · Σ_{t=0}^{T} ∇_θ log π(aₜ|sₜ; θ) · (Gₜ - b(sₜ))

   b(sₜ): 베이스라인 (보통 V(sₜ)의 추정치)
   → 분산을 줄여 학습 안정화
```

**거래 적용**:
```
1 에피소드 = 1 거래일 (또는 특정 기간)

각 스텝에서:
  상태: sₜ = 현재 시장 정보
  행동: aₜ ~ π(·|sₜ; θ)  (확률적으로 행동 선택)
  보상: rₜ = 해당 스텝의 수익

에피소드 종료 후:
  수익이 양이었던 행동의 확률 증가
  수익이 음이었던 행동의 확률 감소
```

### 3.3 Actor-Critic 방법

Konda & Tsitsiklis (2000), *Actor-Critic Algorithms*

```
Actor-Critic 구조:

Actor (정책 네트워크):
  π(a|s; θ) → 행동 선택
  업데이트: θ ← θ + α_θ · ∇_θ log π(aₜ|sₜ; θ) · δₜ

Critic (가치 네트워크):
  V(s; w) → 상태 가치 추정
  업데이트: w ← w + α_w · δₜ · ∇_w V(sₜ; w)

TD 오차 (Advantage 추정):
  δₜ = rₜ + γ · V(sₜ₊₁; w) - V(sₜ; w)

장점:
  - REINFORCE보다 낮은 분산 (에피소드 끝까지 기다릴 필요 없음)
  - 매 스텝 업데이트 가능 (온라인 학습)
```

**A2C (Advantage Actor-Critic)**:
```
이점 함수 (Advantage Function):
  A(s, a) = Q(s, a) - V(s)
          ≈ rₜ + γ · V(sₜ₊₁) - V(sₜ)  (1-step 추정)

정책 경사:
  ∇_θ J(θ) = E[∇_θ log π(a|s; θ) · A(s, a)]

A(s,a) > 0: 행동 a가 평균보다 좋음 → 확률 증가
A(s,a) < 0: 행동 a가 평균보다 나쁨 → 확률 감소
```

**A3C (Asynchronous Advantage Actor-Critic)** — Mnih et al. (2016)
```
여러 에이전트가 병렬로 독립된 환경에서 학습:

Worker 1: 환경 1 → 경사(gradient) 계산 → 글로벌 네트워크 업데이트
Worker 2: 환경 2 → 경사 계산 → 글로벌 네트워크 업데이트
  ...
Worker N: 환경 N → 경사 계산 → 글로벌 네트워크 업데이트

금융 적용:
  각 Worker가 다른 시장/종목/기간에서 동시 학습
  → 학습 속도 향상 및 일반화 성능 개선
```

### 3.4 PPO (Proximal Policy Optimization)

Schulman et al. (2017), *Proximal Policy Optimization Algorithms*

```
PPO-Clip 목적 함수:

L^CLIP(θ) = E[min(rₜ(θ) · Aₜ, clip(rₜ(θ), 1-ε, 1+ε) · Aₜ)]

rₜ(θ) = π(aₜ|sₜ; θ) / π(aₜ|sₜ; θ_old)  — 확률 비율
Aₜ — 이점 함수 추정
ε — 클리핑 범위 (보통 0.1~0.3)

핵심 아이디어:
  → 정책 업데이트의 크기를 제한 (trust region의 근사)
  → rₜ(θ)가 [1-ε, 1+ε] 범위를 벗어나면 클리핑
  → 급격한 정책 변화 방지 → 안정적 학습

금융에서 PPO가 인기 있는 이유:
  1) 구현 단순 (TRPO 대비)
  2) 하이퍼파라미터 튜닝 용이
  3) 연속 행동 공간 지원 → 포지션 크기 연속 조절
  4) 안정적 학습 → 금융 데이터의 비정상성(nonstationarity)에 강건
```

※ 주의: PPO의 비정상성 강건성은 과장된 주장
  - PPO는 정상(stationary) 환경(로보틱스)을 위해 설계됨
  - 금융 시장의 비정상성(레짐 전환, 구조 변화)에 대한 내재적 강건성 없음
  - 실전 대응:
    1) 주기적 재학습 (예: 월 1회 최근 데이터로 파인튜닝)
    2) 온라인 학습: 새 데이터에 지속적 적응 (경험 리플레이 갱신)
    3) 메타러닝: MAML 등으로 빠른 적응 능력 사전 학습
    4) 앙상블: 여러 시기에 학습된 에이전트의 투표

**PPO 의사 코드 (거래 시스템)**:
```
for iteration = 1, 2, ... do
    # 1. 데이터 수집
    for t = 1 to T do
        상태 sₜ 관측 (시장 데이터 + 지표)
        행동 aₜ ~ π(·|sₜ; θ_old) (포지션 결정)
        보상 rₜ 관측 (수익 - 거래비용)
    end

    # 2. 이점 추정 (GAE)
    Aₜ = Σ_{l=0}^{T-t} (γλ)^l · δₜ₊ₗ
    δₜ = rₜ + γV(sₜ₊₁) - V(sₜ)

    # 3. PPO 업데이트 (여러 에폭)
    for epoch = 1 to K do
        L = min(rₜ(θ)Aₜ, clip(rₜ(θ), 1-ε, 1+ε)Aₜ)
        θ ← θ + α · ∇_θ L
    end
end
```

### 3.5 포트폴리오 할당에의 적용

Jiang et al. (2017), *Deep Reinforcement Learning for Portfolio Management*

```
포트폴리오 관리 문제:

상태: sₜ = 최근 n일간의 자산별 가격 변화율 텐서
행동: wₜ = [w₁, w₂, ..., wₘ, w_cash]  (m개 자산 + 현금 비중)
      제약: Σwᵢ = 1, wᵢ ≥ 0

포트폴리오 가치 변화:
  pₜ₊₁/pₜ = wₜᵀ · yₜ - c · |wₜ - wₜ₋₁|₁

  yₜ: 자산별 수익률 벡터 (close_t+1 / close_t)
  c: 거래 비용률
  |·|₁: L1 노름 (회전율, turnover)

정책 네트워크 출력층: softmax → 자연스럽게 비중 합 = 1

EIIE (Ensemble of Identical Independent Evaluators):
  각 자산을 독립적으로 평가 → softmax로 종합
  → 자산 수가 변해도 네트워크 구조 유지 가능
```

---

## 4. 보상 설계 (Reward Shaping)

### 4.1 희소 vs 밀집 보상 (Sparse vs Dense Rewards)

```
희소 보상 (Sparse Reward):
  에피소드 종료 시에만 보상
  rₜ = 0 (t < T)
  r_T = 최종 수익

  장점: 실제 거래 성과를 직접 반영
  단점: 학습이 매우 느림 (credit assignment 문제)

밀집 보상 (Dense Reward):
  매 스텝 보상
  rₜ = (Pₜ₊₁ - Pₜ)/Pₜ × positionₜ

  장점: 빠른 학습
  단점: 근시안적 행동 유도 가능 (보상 해킹)

하이브리드 접근:
  rₜ = α · step_reward + (1-α) · shaped_reward
  → 밀집 보상으로 학습을 유도하되, 최종 목표 반영
```

### 4.2 위험 조정 보상 (Risk-Adjusted Rewards)

```
Sharpe Ratio 기반 보상:
  Sharpe = E[Rₜ - Rf] / σ(Rₜ)

  미분 가능 Sharpe ratio (Moody & Saffell, 2001):
    Dₜ = (B_{t-1} · ΔAₜ - A_{t-1} · ΔBₜ) / (B_{t-1})^(3/2)

    Aₜ = Aₜ₋₁ + η · (Rₜ - Aₜ₋₁)       — 수익률의 EMA
    Bₜ = Bₜ₋₁ + η · (Rₜ² - Bₜ₋₁)       — 수익률 제곱의 EMA

Sortino Ratio 기반 보상:
  Sortino = E[Rₜ - Rf] / σ_d(Rₜ)
  → σ_d: 하방 편차 (downside deviation)만 고려
  → 상승 변동성은 패널티 없음 → 비대칭 위험 선호 반영

Calmar Ratio 기반 보상:
  Calmar = 연환산 수익률 / 최대 낙폭 (MDD)
  → 최대 손실 제어에 집중
```

### 4.3 거래비용 패널티 (Transaction Cost Penalization)

```
거래비용 모형:

1) 고정 비율:
   cost = c × |Δposition|
   c ≈ 0.015% × 2 (KRX 주식 매수+매도 수수료)
     + 0.18% (매도 시 증권거래세, 2025년 기준 KOSPI)
     + 0.15% (농어촌특별세, 증권거래세법 §8 + 농특세법 §5)
   왕복 합계: 0.03% + 0.18% + 0.15% = 0.36%
   (이전 기록: 2024년 기준 거래세 0.20% — 2025년 0.18%로 인하)

2) 슬리피지 모형:
   slippage = k × σ × |Δposition| / ADV
   k: 상수
   σ: 변동성
   ADV: 평균 일일 거래량

3) 시장 충격 (Market Impact):
   impact = η × (|Δposition| / ADV)^β
   η, β: 시장 충격 파라미터
   → 대량 주문일수록 비선형적으로 비용 증가

통합 보상:
  rₜ = return_t - (commission + slippage + impact)
```

### 4.4 낙폭 패널티 (Drawdown Penalty)

```
현재 낙폭 (Current Drawdown):
  DDₜ = (peak_t - value_t) / peak_t
  peak_t = max_{τ≤t} value_τ

낙폭 패널티 보상:
  rₜ = return_t - λ_DD · max(DDₜ - DD_threshold, 0)

  λ_DD: 패널티 강도
  DD_threshold: 허용 낙폭 (예: 5%)

  → DDₜ > 5% 이면 추가 패널티 부여
  → 에이전트가 낙폭 제한 학습
```

### 4.5 다목적 보상 함수 (Multi-Objective Reward)

```
다목적 보상:
  rₜ = w₁ · return_t          — 수익 극대화
     + w₂ · (-|Δposition|)    — 거래 빈도 최소화
     + w₃ · (-DD_t)           — 낙폭 최소화
     + w₄ · (-σ_t)            — 변동성 최소화

가중치 설계 예시:
  공격적 전략: w = [0.7, 0.1, 0.1, 0.1]
  보수적 전략: w = [0.3, 0.1, 0.3, 0.3]
  균형 전략:   w = [0.4, 0.2, 0.2, 0.2]

→ 가중치 조합으로 다양한 투자 성향의 에이전트 학습 가능
→ 파레토 최적(Pareto optimal) 솔루션 집합 탐색
```

---

## 5. 상태 표현 (State Representation)

### 5.1 원시 가격 데이터 vs 기술적 지표

```
접근법 1 — 원시 데이터 (Raw Data):
  sₜ = [O_{t-n:t}, H_{t-n:t}, L_{t-n:t}, C_{t-n:t}, V_{t-n:t}]

  장점: 정보 손실 없음, 네트워크가 자동으로 특징 추출
  단점: 학습 느림, 비정상 시계열(non-stationary) 문제

접근법 2 — 기술적 지표 (Technical Indicators):
  sₜ = [RSI, MACD, Signal, BB_%B, ADX, OBV, ...]

  장점: 도메인 지식 활용, 정규화된 값 (RSI: 0~100)
  단점: 정보 손실 가능, 지표 선택 편향

접근법 3 — 하이브리드:
  sₜ = [정규화된 OHLCV, 기술적 지표, 포지션 정보]

  → 실무에서 가장 흔한 접근법
  → 원시 데이터에서 놓칠 수 있는 패턴을 지표가 보완
```

### 5.2 특징 공학 (Feature Engineering)

```
OHLCV 파생 특징:
  수익률: rₜ = (Cₜ - Cₜ₋₁) / Cₜ₋₁
  로그 수익률: lr_t = ln(Cₜ / Cₜ₋₁)
  고저 비율: HL_t = (Hₜ - Lₜ) / Cₜ
  시가 대비: OC_t = (Cₜ - Oₜ) / Oₜ
  거래량 변화: ΔV_t = (Vₜ - Vₜ₋₁) / Vₜ₋₁

이동 평균 (Moving Average):
  MA_n(t) = (1/n) Σ_{i=0}^{n-1} Cₜ₋ᵢ
  EMA_n(t) = α·Cₜ + (1-α)·EMA_n(t-1),  α = 2/(n+1)

  파생: MA_ratio = Cₜ / MA_n(t) - 1  (가격의 MA 대비 편차)

RSI (Relative Strength Index), Wilder (1978):
  RSI = 100 - 100/(1 + RS)
  RS = EMA(gains, 14) / EMA(losses, 14)

MACD (Moving Average Convergence Divergence):
  MACD = EMA₁₂ - EMA₂₆
  Signal = EMA₉(MACD)
  Histogram = MACD - Signal

볼린저 밴드 (Bollinger Bands), Bollinger (1983):
  Middle = MA₂₀
  Upper = MA₂₀ + 2σ₂₀
  Lower = MA₂₀ - 2σ₂₀
  %B = (Cₜ - Lower) / (Upper - Lower)  ← 상태 특징으로 유용
```

### 5.3 정규화 기법 (Normalization Techniques)

```
금융 데이터 정규화의 중요성:
  → 가격 수준이 종목/시기마다 크게 다름
  → 신경망은 입력 스케일에 민감

1) Z-score 정규화:
   x_norm = (x - μ) / σ
   이동 윈도우 사용: μ, σ를 최근 n봉에서 계산
   → 단순하지만 이상치에 민감

2) Min-Max 정규화:
   x_norm = (x - x_min) / (x_max - x_min)
   → [0, 1] 범위로 변환
   → 미래 min/max를 모르므로 이동 윈도우 사용

3) 수익률 변환:
   rₜ = Cₜ / Cₜ₋₁ - 1  또는  rₜ = ln(Cₜ / Cₜ₋₁)
   → 가격 수준에 무관한 상대적 변화로 변환
   → 가장 권장되는 방법

4) 로버스트 정규화:
   x_norm = (x - median) / IQR
   → 이상치에 강건
   → 금융 데이터의 두꺼운 꼬리(fat tail)에 적합
```

### 5.4 관측 윈도우 설계 (Observation Window Design)

```
윈도우 크기의 트레이드오프:

짧은 윈도우 (n ≈ 5~20):
  + 빠른 반응, 낮은 차원
  - 장기 추세 포착 불가, 노이즈 민감

긴 윈도우 (n ≈ 60~200):
  + 장기 추세/패턴 포착, 노이즈에 강건
  - 높은 차원, 느린 반응, 계산 비용

다중 윈도우 접근:
  sₜ = [단기(5봉), 중기(20봉), 장기(60봉)] 특징 결합
  → 다우이론의 3가지 추세를 반영

다중 타임프레임:
  sₜ = [1분봉 특징, 5분봉 특징, 일봉 특징]
  → 다른 시간 척도의 시장 구조 동시 포착
  → Temporal Convolutional Network (TCN)으로 처리 적합
```

---

> 고급 기법(Multi-Agent RL, Inverse RL, Meta-Learning, Model-Based RL, Safe RL)은
> 11B_rl_advanced.md로 분리되었다.

---

## 7. 기술적 분석과의 연결 (Connection to Technical Analysis)

### 7.1 RL 에이전트의 기술적 분석 규칙 학습

```
전통적 규칙 기반 시스템:
  IF RSI < 30 AND MACD > Signal THEN 매수
  IF RSI > 70 AND MACD < Signal THEN 매도

RL 에이전트:
  상태에 RSI, MACD를 포함 → 에이전트가 자체적으로 규칙 발견

흥미로운 발견 (연구 결과들):
  → 충분한 학습 후 에이전트의 행동이 전통적 규칙과 유사해지는 경향
  → 그러나 더 미묘한 조건 조합을 학습 (예: "RSI < 30이면서
     거래량이 20일 평균의 1.5배 이상이고 MACD 히스토그램이
     증가 추세일 때만 매수")
  → 규칙의 파라미터를 시장 상황에 맞게 동적 조절
```

### 7.2 패턴 인식의 상태 특징 활용

```
캔들스틱 패턴을 상태 특징으로 인코딩:

pattern_features = [
    is_three_white_soldiers,    — 적삼병 감지 여부 (0/1)
    is_three_black_crows,       — 흑삼병 감지 여부 (0/1)
    is_hammer,                  — 망치형 (0/1)
    is_doji,                    — 도지 (0/1)
    is_engulfing_bullish,       — 상승 장악형 (0/1)
    is_engulfing_bearish,       — 하락 장악형 (0/1)
    ...
]

차트 패턴 인코딩:
pattern_chart = [
    ascending_triangle_score,   — 상승 삼각형 강도 (0~1)
    head_shoulders_score,       — 머리어깨형 강도 (0~1)
    double_bottom_score,        — 이중 바닥 강도 (0~1)
    support_distance,           — 지지선까지 거리 (%)
    resistance_distance,        — 저항선까지 거리 (%)
    ...
]

→ 07_pattern_algorithms.md의 패턴 탐지 결과를 RL 상태에 직접 통합
→ 에이전트가 어떤 패턴이 어떤 상황에서 유효한지 학습
```

### 7.3 지표 기반 상태 표현과 규칙 기반 시스템 비교

```
규칙 기반 시스템 (Rule-Based):
  장점: 해석 가능, 백테스트 용이, 도메인 지식 직접 반영
  단점: 규칙 조합 폭발, 파라미터 최적화 어려움, 시장 변화 비적응

RL 기반 시스템:
  장점: 자동 규칙 발견, 시장 변화 적응, 비선형 관계 포착
  단점: 블랙박스, 과적합 위험, 학습 불안정

하이브리드 접근법:
  1) 기술적 분석 규칙을 초기 정책으로 사용 (warm start)
     → 학습 시간 단축, 합리적 초기 행동 보장

  2) RL로 규칙의 파라미터 최적화
     → "RSI < x AND MA_short > MA_long" 에서 x, short, long 자동 탐색

  3) 규칙 기반 행동을 보상에 반영 (reward shaping)
     → 기술적 분석 전문가 지식을 학습 유도에 활용

  4) RL 에이전트의 행동을 사후 분석하여 새로운 규칙 추출
     → 설명 가능 AI (XAI) 기법으로 학습된 정책 해석
```

### 7.4 RL과 기술적 분석 지표의 정보론적 관점

```
기술적 지표의 정보 가치 (Information Value):

상호 정보량 (Mutual Information):
  I(indicator; future_return) = Σ p(x,y) log [p(x,y) / (p(x)p(y))]

RL 에이전트의 암묵적 특징 선택:
  → 학습 과정에서 유용한 지표에 높은 가중치 부여
  → Gradient 분석으로 각 지표의 기여도 측정 가능

  ∂Q(s, a*) / ∂RSI     → RSI의 거래 결정 기여도
  ∂Q(s, a*) / ∂MACD    → MACD의 거래 결정 기여도

  → 기술적 지표의 상대적 중요도를 데이터 기반으로 평가
  → 06_technical_analysis.md의 지표들의 실증적 유용성 검증
```

---

## 핵심 정리: 강화학습과 기술적 분석의 통합

| RL 구성 요소 | 기술적 분석 대응 | 설명 |
|-------------|-----------------|------|
| 상태 (State) | 차트 + 지표 | OHLCV, RSI, MACD, BB 등을 상태 벡터로 인코딩 |
| 행동 (Action) | 매매 신호 | 매수/매도/관망 또는 연속적 포지션 크기 |
| 보상 (Reward) | 수익 + 리스크 | 위험 조정 수익률, 거래비용 반영 |
| 정책 (Policy) | 매매 규칙 | "RSI<30이면 매수" 류의 규칙을 자동 학습 |
| 가치 함수 (Value) | 시장 상황 평가 | 현재 시장 상태의 수익 잠재력 정량화 |
| 환경 (Environment) | 시장 자체 | 가격 변동, 거래량, 호가 등 시장 동학 |
| 에피소드 (Episode) | 거래 기간 | 하나의 완결된 거래 시뮬레이션 |

---

## 주요 알고리즘 요약 비교

| 알고리즘 | 유형 | 행동 공간 | 데이터 효율 | 안정성 | 거래 적용 |
|---------|------|----------|------------|--------|----------|
| Q-Learning | 가치 기반 | 이산 | 높음 | 낮음 | 단순 매매 신호 |
| DQN | 가치 기반 | 이산 | 중간 | 중간 | 매매 신호 생성 |
| Double DQN | 가치 기반 | 이산 | 중간 | 높음 | 보수적 신호 |
| REINFORCE | 정책 기반 | 이산/연속 | 낮음 | 낮음 | 학습 기준선 |
| A2C/A3C | Actor-Critic | 이산/연속 | 중간 | 중간 | 범용 거래 |
| PPO | Actor-Critic | 이산/연속 | 중간 | 높음 | 포트폴리오 관리 |
| SAC | Actor-Critic | 연속 | 높음 | 높음 | 연속 포지션 조절 |

---

## 참고문헌 (Key References)

```
[기초 이론]
Bellman, R. (1957). Dynamic Programming. Princeton University Press.
Sutton, R.S. & Barto, A.G. (2018). Reinforcement Learning: An Introduction,
  2nd ed. MIT Press.
Puterman, M.L. (1994). Markov Decision Processes. Wiley.

[핵심 알고리즘]
Watkins, C.J.C.H. & Dayan, P. (1992). Q-Learning. Machine Learning 8:279-292.
Williams, R.J. (1992). Simple Statistical Gradient-Following Algorithms for
  Connectionist Reinforcement Learning. Machine Learning 8:229-256.
Mnih, V. et al. (2015). Human-Level Control through Deep Reinforcement Learning.
  Nature 518:529-533.
Silver, D. et al. (2016). Mastering the Game of Go with Deep Neural Networks and
  Tree Search. Nature 529:484-489.
Schulman, J. et al. (2017). Proximal Policy Optimization Algorithms.
  arXiv:1707.06347.

[DQN 변형]
van Hasselt, H. et al. (2016). Deep Reinforcement Learning with Double
  Q-Learning. AAAI-16.
Wang, Z. et al. (2016). Dueling Network Architectures for Deep Reinforcement
  Learning. ICML-16.
Schaul, T. et al. (2016). Prioritized Experience Replay. ICLR-16.

[금융 적용]
Moody, J. & Saffell, M. (2001). Learning to Trade via Direct Reinforcement.
  IEEE Trans. Neural Networks 12(4):875-889.
Deng, Y. et al. (2017). Deep Direct Reinforcement Learning for Financial Signal
  Representation and Trading. IEEE Trans. Neural Networks 28(3):653-664.
Jiang, Z. et al. (2017). A Deep Reinforcement Learning Framework for the
  Financial Portfolio Management Problem. arXiv:1706.10059.
Spooner, T. et al. (2018). Market Making via Reinforcement Learning.
  AAMAS-18.

[고급 기법]
Ng, A.Y. & Russell, S. (2000). Algorithms for Inverse Reinforcement Learning.
  ICML-00.
Finn, C. et al. (2017). Model-Agnostic Meta-Learning for Fast Adaptation of
  Deep Networks. ICML-17.
Ha, D. & Schmidhuber, J. (2018). World Models. arXiv:1803.10122.
Achiam, J. et al. (2017). Constrained Policy Optimization. ICML-17.
Ziebart, B. et al. (2008). Maximum Entropy Inverse Reinforcement Learning.
  AAAI-08.
```

---

## §13. LinUCB 실전 적용 (Stage B — CheeseStock MRA 보정기)

> 이 섹션은 §7(컨텍스트 밴딧)의 이론을 CheeseStock의 구체적 구현에 매핑한다.
> 코드 매핑: backtester.js:60-158, scripts/rl_linucb.py, scripts/rl_context_features.py

---

### §13.1 알고리즘 기반 — Li et al. (2010) LinUCB

Li, L., Chu, W., Langford, J., & Schapire, R. E. (2010).
"A Contextual-Bandit Approach to Personalized News Article Recommendation."
Proc. 19th International World Wide Web Conference (WWW 2010), pp. 661-670.

LinUCB는 컨텍스트(문맥) 정보를 활용하는 Multi-Armed Bandit 알고리즘이다.
각 행동(arm) a에 대해 선형 보상 모델을 가정한다:

```
E[r | x, a] = theta_a^T x

x : context vector (d-dim)
theta_a : arm a의 파라미터 벡터 (학습됨)
r : reward
```

**UCB 기반 행동 선택 규칙:**

```
a* = argmax_a [ theta_a^T x  +  alpha * sqrt(x^T A_a^{-1} x) ]
              |___탐색(exploit)___| |_______탐험(explore)_________|

theta_a  = A_a^{-1} b_a             -- 최소제곱 추정치
A_a      = X_a^T X_a + I            -- context 외적합 + Ridge 항
b_a      = X_a^T r_a                -- 보상 가중 context 합
alpha    = exploration 파라미터 (학습 초기 높음 → 수렴 후 낮춤)
```

**Sherman-Morrison 점진 업데이트 (O(d^2) per step):**

```
관측 (x, a, r) 수신 시:
  A_a_new^{-1} = A_a_old^{-1}
                 - (A_a_old^{-1} x x^T A_a_old^{-1})
                   / (1 + x^T A_a_old^{-1} x)
  b_a_new = b_a_old + r * x
```

행렬 역행렬을 매번 재계산(O(d^3))하지 않고 O(d^2)로 유지.
수치 안정성을 위해 500 업데이트마다 A_a를 재역행렬 계산(backtester.js에서는
JS 환경 상 _applyLinUCB에서 theta 직접 저장 방식으로 단순화됨).

코드 매핑: scripts/rl_linucb.py:76-175 (LinUCB 클래스), backtester.js:146-158 (_applyLinUCB)

---

### §13.2 5개 행동 공간 설계

CheeseStock Stage B는 MRA(Multiple Regression Analysis) 예측값을 "얼마나 신뢰할 것인가"를
5개 이산 행동으로 표현한다:

```
행동 인덱스  이름             factor  의미
─────────────────────────────────────────────────────────────
0           strong_dampen    0.3    MRA 예측을 70% 억제 (과신 차단)
1           slight_dampen    0.7    MRA 예측을 30% 축소 (보수 조정)
2           trust_mra        1.0    MRA 예측 원본 사용 (기본값)
3           slight_boost     1.3    MRA 예측을 30% 증폭 (과소추정 보정)
4           reverse         -0.5    MRA 예측 방향 반전 + 절반 크기
─────────────────────────────────────────────────────────────
```

적용 결과: y_adj = y_mra * action_factor

이 5개 행동은 "연속적 포지션 크기" 행동 공간을 이산화한 것으로,
Grinold (1989) "The Fundamental Law of Active Management"의
신호-포지션 비례 원칙을 구현한다.

코드 매핑: backtester.js:65-66 (_rlTier1, _rlTier3), scripts/rl_linucb.py:39-47

---

### §13.3 보상 함수 — Directional IC 정렬

**설계 근거:**

초기 구현(Stage B-1)은 MSE 기반 보상을 사용했다:
  r_mse = -(y_adj - y_actual)^2

이 설계는 strong_dampen(factor=0.3) 행동이 49% 선택율을 차지하는
degenerate 정책을 유발했다. MSE는 예측값의 크기를 줄이는 방향으로
편향되어 있기 때문이다.

**수정된 방향성 보상 (Grinold 1989 기반):**

Grinold, R. C. (1989). "The Fundamental Law of Active Management."
Journal of Portfolio Management, 15(3), 30-37.

```
r_raw = y_adj * y_actual - y_mra * y_actual
      = y_mra * y_actual * (action_factor - 1)

의미: action이 MRA 원본 대비 y_actual과의 방향성 정렬을 얼마나 개선했는가?
  - action_factor > 1 이고 y_mra*y_actual > 0 : 양의 보상 (올바른 방향 증폭)
  - action_factor < 1 이고 y_mra*y_actual > 0 : 음의 보상 (올바른 방향 억제)
  - reverse (factor=-0.5) 이고 y_mra*y_actual < 0 : 양의 보상 (잘못된 방향 반전)
```

**로그 압축 (kurtosis 안정화):**

KRX 수익률 분포의 첨도(kurtosis)가 73.5로 극단값이 빈번하다.
Mnih et al. (2015) DQN의 Huber loss와 유사한 원리로 로그 압축을 적용:

```
r_final = sign(r_raw) * log(1 + |r_raw|)
```

코드 매핑: scripts/rl_linucb.py:56-69 (compute_reward)

---

### §13.4 10-차원 컨텍스트 벡터 설계

각 차원의 학술적 의미와 엔진 내 역할:

```
그룹 A — 잔차 이력 (Lo 2004 AMH 기반: 잔차 자기상관 = 시장 비효율 지표)
  dim 0: resid_sign     직전 잔차의 부호 {-1, 0, +1}
                        → 예측 오류가 지속되는지 감지
  dim 1: resid_mag_z    |직전 잔차| / rolling_std(20), clamped [0,3]
                        → 예측 오류의 크기 (과신 여부 판단)
  dim 2: resid_run_len  같은 부호 잔차의 연속 길이 / 5.0
                        → 체계적 편향(systematic bias) 감지
  ※ dims 0-2는 학습(Python) 시에만 사용. 런타임(JS)에서는 0으로 설정.
     이유: JS 엔진은 단일 종목 실시간 컨텍스트만 보유하므로 롤링 이력 부재.

그룹 B — 체제(Regime) 변수 (Bollerslev 1986 GARCH / RiskMetrics 1996)
  dim 3: ewma_vol       EWMA 변동성 (lambda=0.94), z-score 정규화
                        → 변동성 체제 위치 (고변동성 = 보수적 행동 유도)
  dim 4: pred_magnitude |y_pred| / global_std(y_pred), clamped [0,3]
                        → 예측 신뢰도 (극단 예측일수록 검증 필요)

그룹 C — 범주형 시장 변수
  dim 5: signal_dir     +1(buy), -1(sell), 0(neutral)
                        → 신호 방향: 매수/매도에 따른 차별 전략 가능
  dim 6: market_type    1(KOSDAQ), 0(KOSPI)
                        → KOSDAQ은 변동성·유동성 특성이 KOSPI와 다름

그룹 D — 패턴 품질 (Bulkowski 2005/2012 패턴 통계 기반)
  dim 7: pattern_tier   Tier1→-1, Tier2→0, Tier3→+1
                        → Tier1 패턴(doubleBottom 등)은 과밀화(crowding) 위험
                           자동 감쇠로 alpha decay 방지
  dim 8: confidence_norm confidence / 100 ∈ [0,1]
                        → 패턴 완성도 신뢰도

그룹 E — OHLCV 체제 (Hurst 1951 R/S 분석)
  dim 9: raw_hurst      R/S 분석 기반 Hurst 지수, z-score 정규화
                        → H > 0.5: 추세 지속성 (momentum regime)
                           H < 0.5: 평균 회귀 (mean-reversion regime)
```

Lo, A. (2004). "The Adaptive Markets Hypothesis." Journal of Portfolio Management, 30(5), 15-29.
Hurst, H. E. (1951). "Long-term storage capacity of reservoirs." Trans. American Society of Civil Engineers, 116, 770-799.

코드 매핑: backtester.js:96-143 (_buildRLContext), scripts/rl_context_features.py:10-37

---

### §13.5 Stage B 성과 요약 (KRX 2,704종목, 전진보행 검증)

```
지표                   Stage A (MRA only)   Stage B (MRA + LinUCB)
─────────────────────────────────────────────────────────────────
Mean IC (전체)          0.099                0.325   (+228%)
Tier-1 IC              -0.017               +0.253  (음→양 반전)
Tier-3 IC               0.211                0.184   (소폭 감소)
strong_dampen 선택율    (MSE 기반: 49%)       12%     (degenerate 탈출)
trust_mra 선택율        —                    41%     (다양한 행동)
```

엔진 적용 효과 요약:
- MRA의 선형 예측을 컨텍스트에 따라 비선형적으로 보정
- Tier-1 패턴(doubleBottom, risingWedge 등) 과밀 상황에서 자동 감쇠
  → crowding으로 인한 alpha decay 방지
- 고변동성 체제(dim 3 높음)에서 strong_dampen 우선 선택
  → 변동성 클러스터링(GARCH 효과) 대응

코드 매핑: backtester.js:60-158 전체 LinUCB 블록
