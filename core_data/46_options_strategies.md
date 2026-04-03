# Doc 46: 옵션 전략 종합 — 페이오프, Greeks 동역학, 변동성 매매, KRX 실전

# Options Strategies Comprehensive — Payoffs, Greeks Dynamics, Volatility Trading & KRX Practice

> "옵션은 보험이 아니다. 옵션은 확률분포의 특정 구간을 사고파는 시장이다."
> "Options are not insurance. They are a market for buying and selling
> specific segments of the probability distribution."
> — Emanuel Derman, *My Life as a Quant* (2004)

> "The four most dangerous words in investing are: 'this time it's different.'
> But in options trading, the most dangerous words are:
> 'the premium will cover the risk.'"
> — Myron S. Scholes, Nobel Lecture (1997)

---

## 개요 (Overview)

### 문서의 위치와 목적

본 문서는 CheeseStock 코어 이론 체계에서 **옵션 전략의 구성·분석·실행**을
체계적으로 다룬다. Doc 26이 BSM, Greeks, VKOSPI, PCR, GEX의 **기초 신호 체계**를,
Doc 37이 IV 곡면·스큐의 **시장 미시구조**를, Doc 45가 CRR/Heston/Dupire의
**가격결정 모형 심화**를, Doc 34가 VRP·HAR-RV의 **변동성 예측 체계**를
각각 제공한다면, 본 문서는 그 위에 **전략의 구성 논리와 실전 적용**을 쌓는다.

### 기존 문서와의 관계

| 주제 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| BSM 공식, Greeks 정의 | Doc 26 §1 | — (참조만, 재기술 금지) |
| Delta, Gamma, Theta, Vega 공식 | Doc 26 §1.2 | 전략별 Greeks 프로파일 (조합의 동역학) |
| PCR 역발상 분석 | Doc 26 §3.1-3.2 | 전략 선택과의 연동 |
| GEX 감마 헤지 메커니즘 | Doc 26 §6 | 전략별 감마 노출과 딜러 영향 |
| IV 곡면, SVI 파라미터화 | Doc 37 §2 | 스큐를 활용한 전략 선택 |
| VRP 이론, VKOSPI-RV 스프레드 | Doc 34 §2 | VRP 수확 전략의 구조화 |
| 분산 트레이딩 | Doc 34 §6 | 분산 스왑 페이오프의 형식화 |
| CRR 이항트리, 풋-콜 패리티 | Doc 45 §1, §3 | 전략 가격의 이항트리 검증 |
| Heston ρ < 0과 스큐 | Doc 45 §5.4 | 확률변동성 하의 전략 Greeks 왜곡 |
| KOSPI200 옵션 구조 | Doc 45 §8.1-8.2 | 전략 실행 시 제약조건 |

### 핵심 주장 요약

```
1. 옵션 전략은 확률분포의 특정 영역에 대한 "구조화된 베팅"이다
   → 방향성(delta), 볼록성(gamma), 시간(theta), 변동성(vega)의
     4차원 노출을 선택적으로 조합
   → 주식의 long-only 제약을 넘어서는 자유도 확보

2. 모든 스프레드 전략은 풋-콜 패리티(Doc 45 §3)의 응용이다
   → Bull Call Spread ↔ Bull Put Spread (합성 등가)
   → 동일 페이오프를 복수 경로로 구성 → 시장 미시구조(유동성, B/A)에 따라 최적 선택

3. Gamma Scalping은 이론적으로 Θ-Γ 트레이드오프의 실현이다
   → 이산 리밸런싱에서: P/L ≈ 0.5·Γ·(ΔS)² - Θ·Δt
   → 실현변동성 > 내재변동성이면 감마 스캘핑 양수 기대 수익
   → Doc 34 §2 VRP 이론의 실전적 구현

4. 변동성 전략은 방향성 중립(delta-neutral)에서 변동성 자체를 거래한다
   → Straddle: 변동성의 절대 수준에 베팅
   → Calendar: 변동성 기간구조에 베팅
   → Butterfly: 변동성의 실현 경로(핀닝)에 베팅

5. KRX KOSPI200 옵션은 유럽형·현금결제이므로 조기행사 위험이 없다
   → 스프레드 전략의 조기행사 리스크(pin risk) 불존재
   → 합성 포지션(synthetic position) 구성이 간결
   → 단, 주물(weekly) 옵션의 세타 급등에 주의
```

### 핵심 출처

```
- Natenberg, S. (2015). Option Volatility and Pricing: Advanced Trading
  Strategies and Techniques. 2nd ed. McGraw-Hill.
- Sinclair, E. (2013). Volatility Trading. 2nd ed. Wiley.
- Hull, J.C. (2021). Options, Futures, and Other Derivatives. 11th ed. Pearson.
- Taleb, N.N. (1997). Dynamic Hedging: Managing Vanilla and Exotic Options. Wiley.
- Gatheral, J. (2006). The Volatility Surface: A Practitioner's Guide. Wiley.
- Bittman, J. (2009). Trading Options as a Professional. McGraw-Hill.
- Derman, E. & Miller, M.B. (2016). The Volatility Smile. Wiley.
- Bennett, C. (2014). Trading Volatility: Trading Volatility, Correlation,
  Term Structure and Skew. Independently published.
```

---

## 1. 바닐라 전략 페이오프 (Vanilla Strategy Payoffs)

옵션 전략의 페이오프(payoff)는 만기 시점 기초자산 가격 S_T의 함수이다.
각 전략의 손익(P/L)은 페이오프에서 초기 프리미엄 비용을 차감한 것이다.

> **표기 규약:**
> C(K): 행사가 K인 콜옵션의 프리미엄, P(K): 풋옵션의 프리미엄
> S_T: 만기 시 기초자산 가격, S_0: 현재 기초자산 가격
> Greeks 공식은 Doc 26 §1.2를 참조. 본 문서에서는 재도출하지 않는다.

### 1.1 기본 4포지션 (Four Basic Positions)

모든 옵션 전략의 기본 빌딩 블록은 4가지이다.

**Long Call (콜 매수):**

```
페이오프:  Π_LC = max(S_T - K, 0) - C
BEP:      S_T = K + C
최대 이익: 무한대 (이론적)
최대 손실: C (프리미엄)

P/L 도표:
  S_T < K:     P/L = -C         (전액 손실)
  K < S_T < K+C: P/L = S_T - K - C  (부분 손실)
  S_T = K+C:   P/L = 0          (손익분기)
  S_T > K+C:   P/L = S_T - K - C   (무한 이익)

Delta: +Δ_C = +N(d₁) ∈ (0, +1)  ← Doc 26 §1.2
Gamma: +Γ > 0  (볼록성 보유)
Theta: -Θ < 0  (시간가치 소멸)
Vega:  +ν > 0  (변동성 상승 유리)
```

**Short Call (콜 매도):**

```
페이오프:  Π_SC = C - max(S_T - K, 0) = -Π_LC
BEP:      S_T = K + C
최대 이익: C (프리미엄)
최대 손실: 무한대 (이론적)

Greeks: Long Call의 부호 반전
Delta: -N(d₁)   Gamma: -Γ   Theta: +Θ   Vega: -ν
→ 시간가치 수취(+Θ), 변동성 하락 유리(-ν)
→ Naked Short Call은 무한 손실 가능 → KRX 증거금 요구
```

**Long Put (풋 매수):**

```
페이오프:  Π_LP = max(K - S_T, 0) - P
BEP:      S_T = K - P
최대 이익: K - P (기초자산이 0까지 하락 시)
최대 손실: P (프리미엄)

Delta: +Δ_P = -(1 - N(d₁)) ∈ (-1, 0)  ← 음의 방향 노출
Gamma: +Γ > 0
Theta: -Θ < 0
Vega:  +ν > 0
```

**Short Put (풋 매도):**

```
페이오프:  Π_SP = P - max(K - S_T, 0) = -Π_LP
BEP:      S_T = K - P
최대 이익: P
최대 손실: K - P

Greeks: Long Put의 부호 반전
Delta: +(1-N(d₁))   Gamma: -Γ   Theta: +Θ   Vega: -ν
→ "현금 확보 풋 매도(Cash-Secured Put)"는 가치 투자자의 진입 전략
```

**기본 4포지션 요약:**

| 포지션 | 방향 | Δ 부호 | Γ 부호 | Θ 부호 | ν 부호 | 최대 손실 |
|--------|------|--------|--------|--------|--------|----------|
| Long Call | 강세 | + | + | - | + | C |
| Short Call | 약세 | - | - | + | - | 무한대 |
| Long Put | 약세 | - | + | - | + | P |
| Short Put | 강세 | + | - | + | - | K-P |

### 1.2 변동성 전략 — Straddle & Strangle

방향성 중립(delta-neutral)에서 변동성 자체의 크기에 베팅하는 전략이다.

**Long Straddle (스트래들 매수):**

```
구성: Long Call(K) + Long Put(K)  — 동일 행사가, 동일 만기
페이오프:  Π_straddle = |S_T - K| - (C + P)
         = max(S_T - K, 0) + max(K - S_T, 0) - (C + P)

BEP (두 점):
  상방: S_T = K + (C + P)
  하방: S_T = K - (C + P)

최대 이익: 무한대 (상방), K - (C+P) (하방)
최대 손실: C + P  (S_T = K에서 발생, 양쪽 옵션 모두 무가치)

풋-콜 패리티 검증 (Doc 45 §3.1):
  Long Straddle = Long Call + Long Put
  = Long Call + [Long Call - S·e^(-qT) + K·e^(-rT)]  (패리티 대입)
  = 2×Long Call - S·e^(-qT) + K·e^(-rT)
  → ATM에서 C ≈ P이므로 총 비용 ≈ 2C

적용:
  어닝 시즌, FOMC, BOK 금리 결정 등 이벤트 전
  → 방향은 모르지만 큰 움직임이 예상될 때
  → 이벤트 후 IV crush(변동성 급락) 위험 고려 필수
```

**Short Straddle (스트래들 매도):**

```
구성: Short Call(K) + Short Put(K)
페이오프:  Π = (C + P) - |S_T - K|

최대 이익: C + P (S_T = K 정확히)
최대 손실: 무한대
→ "핀닝(pinning)" 기대 — GEX 양수 환경에서 유리 (Doc 26 §6)
→ KRX에서 개인 투자자의 naked short straddle은 극도로 위험
```

**Long Strangle (스트랭글 매수):**

```
구성: Long Put(K₁) + Long Call(K₂),  K₁ < K₂ (OTM 옵션 사용)

페이오프:
  Π_strangle = max(K₁ - S_T, 0) + max(S_T - K₂, 0) - (P(K₁) + C(K₂))

  S_T < K₁:           P/L = (K₁ - S_T) - (P + C)
  K₁ ≤ S_T ≤ K₂:     P/L = -(P + C)          (총 손실 구간)
  S_T > K₂:           P/L = (S_T - K₂) - (P + C)

BEP:
  하방: S_T = K₁ - (P + C)
  상방: S_T = K₂ + (P + C)

최대 이익: 무한대(상방), K₁ - (P+C)(하방)
최대 손실: P(K₁) + C(K₂)

Straddle 대비:
  - 비용이 저렴 (OTM 옵션 → 프리미엄 낮음)
  - BEP가 더 넓음 (더 큰 움직임 필요)
  - 최대 손실 구간이 존재 (K₁ ~ K₂)
```

**Short Strangle (스트랭글 매도):**

```
구성: Short Put(K₁) + Short Call(K₂),  K₁ < K₂
페이오프:  Π = (P + C) - max(K₁ - S_T, 0) - max(S_T - K₂, 0)

최대 이익: P(K₁) + C(K₂)   (K₁ ≤ S_T ≤ K₂에서)
최대 손실: 무한대
→ 가장 보편적인 프리미엄 수취 전략
→ VKOSPI > 25 환경에서 VRP 수확 효과 극대화 (Doc 34 §2)
```

### 1.3 방향성 스프레드 (Directional Spreads)

제한된 위험으로 방향성 뷰를 표현하는 전략이다.

**Bull Call Spread (강세 콜 스프레드):**

```
구성: Long Call(K₁) + Short Call(K₂),  K₁ < K₂

페이오프:
  Π = max(S_T - K₁, 0) - max(S_T - K₂, 0) - (C(K₁) - C(K₂))

  S_T ≤ K₁:           P/L = -(C(K₁) - C(K₂))     (최대 손실)
  K₁ < S_T < K₂:      P/L = (S_T - K₁) - net_debit
  S_T ≥ K₂:           P/L = (K₂ - K₁) - net_debit  (최대 이익)

net_debit = C(K₁) - C(K₂) > 0  (항상 순비용)

BEP: S_T = K₁ + net_debit
최대 이익: (K₂ - K₁) - net_debit
최대 손실: net_debit
R:R = 최대 이익 / 최대 손실

합성 등가: Bull Put Spread (Long Put(K₁) + Short Put(K₂))
  → 풋-콜 패리티(Doc 45 §3)에 의해 동일 페이오프
  → net_credit = P(K₂) - P(K₁) = (K₂ - K₁)·e^(-rT) - net_debit
```

**Bear Put Spread (약세 풋 스프레드):**

```
구성: Long Put(K₂) + Short Put(K₁),  K₁ < K₂

페이오프:
  Π = max(K₂ - S_T, 0) - max(K₁ - S_T, 0) - (P(K₂) - P(K₁))

  S_T ≥ K₂:           P/L = -(P(K₂) - P(K₁))     (최대 손실)
  K₁ < S_T < K₂:      P/L = (K₂ - S_T) - net_debit
  S_T ≤ K₁:           P/L = (K₂ - K₁) - net_debit  (최대 이익)

net_debit = P(K₂) - P(K₁) > 0

BEP: S_T = K₂ - net_debit
최대 이익: (K₂ - K₁) - net_debit
최대 손실: net_debit

합성 등가: Bear Call Spread (Short Call(K₁) + Long Call(K₂))
```

### 1.4 복합 스프레드 (Complex Spreads)

**Butterfly Spread (나비 스프레드):**

```
구성: Long 1×Call(K₁) + Short 2×Call(K₂) + Long 1×Call(K₃)
      K₁ < K₂ < K₃,  K₂ = (K₁ + K₃)/2 (등간격)

페이오프:
  Π = max(S_T-K₁,0) - 2·max(S_T-K₂,0) + max(S_T-K₃,0) - net_debit

  S_T ≤ K₁:           P/L = -net_debit           (최대 손실)
  K₁ < S_T ≤ K₂:      P/L = (S_T - K₁) - net_debit
  K₂ < S_T < K₃:      P/L = (K₃ - S_T) - net_debit
  S_T ≥ K₃:           P/L = -net_debit           (최대 손실)

net_debit = C(K₁) - 2C(K₂) + C(K₃) > 0
  ※ C(K)가 K에 대해 볼록(convex)이므로 항상 양수
  → 무차익 조건의 직접적 결과 (Jensen 부등식)

BEP: S_T = K₁ + net_debit  또는  S_T = K₃ - net_debit
최대 이익: (K₂ - K₁) - net_debit  (S_T = K₂ 정확히)
최대 손실: net_debit

직관: K₂ 부근에 "핀닝"될 것이라는 예측
  → GEX 양수 환경(Doc 26 §6)에서 핀닝 확률 증가
  → 비용이 저렴하므로 R:R이 유리 (5:1 ~ 10:1 가능)
```

**Iron Condor (아이언 콘도르):**

```
구성: Short Strangle(K₂, K₃) + Long Strangle(K₁, K₄)
      K₁ < K₂ < K₃ < K₄

분해:
  Bull Put Spread:  Long Put(K₁) + Short Put(K₂)
  Bear Call Spread: Short Call(K₃) + Long Call(K₄)

페이오프:
  Π = net_credit - max(K₂-S_T,0) + max(K₁-S_T,0) - max(S_T-K₃,0) + max(S_T-K₄,0)

  S_T ≤ K₁:           P/L = net_credit - (K₂ - K₁) (최대 손실)
  K₁ < S_T ≤ K₂:      P/L = net_credit - (K₂ - S_T)
  K₂ < S_T < K₃:      P/L = net_credit             (최대 이익)
  K₃ ≤ S_T < K₄:      P/L = net_credit - (S_T - K₃)
  S_T ≥ K₄:           P/L = net_credit - (K₄ - K₃) (최대 손실)

net_credit = P(K₂) + C(K₃) - P(K₁) - C(K₄)

BEP: S_T = K₂ - net_credit  또는  S_T = K₃ + net_credit
최대 이익: net_credit  (K₂ ≤ S_T ≤ K₃에서)
최대 손실: max(K₂-K₁, K₄-K₃) - net_credit
  ※ 대칭 구성 시 K₂-K₁ = K₄-K₃

Risk:Reward:
  확률적으로 이익 구간(K₂~K₃)이 넓으면 승률↑, R:R↓
  K₂~K₃ 폭이 좁으면 승률↓, R:R↑
  → KOSPI200 2.5p 간격에서 통상 양측 5-10p 간격으로 구성
```

### 1.5 캘린더 스프레드 (Calendar Spread)

```
구성: Short Near-Month Call(K, T₁) + Long Far-Month Call(K, T₂)
      T₁ < T₂,  동일 행사가 K

페이오프 (T₁ 만기 시):
  근월물 만기 시 원월물의 잔존가치가 있으므로 단순 페이오프 공식 불가
  → T₁ 만기 시점에서 원월물의 BSM 이론가로 평가

  Π ≈ C_BSM(S_{T₁}, K, T₂-T₁, σ) - max(S_{T₁}-K, 0) - net_debit

net_debit = C(K, T₂) - C(K, T₁) > 0
  (장기 옵션이 항상 비쌈 — 시간가치 단조증가)

최대 이익: S_{T₁} ≈ K 부근 (근월물 무가치 + 원월물 최대 시간가치)
최대 손실: net_debit

핵심 동역학: 근월물과 원월물의 시간가치 소멸 속도 차이
  → 근월물의 Θ가 더 크므로 (만기 근접 → Θ 가속)
  → 시간 경과 시 근월물이 더 빠르게 소멸 → 스프레드 가치 증가
  → Doc 26 §1.2의 Theta 공식에서 √T 역비례 확인

변동성 기간구조 연결 (Doc 34 §5):
  근월 IV > 원월 IV (역전 기간구조): 캘린더 스프레드 진입 유리
  근월 IV < 원월 IV (정상 기간구조): 역캘린더 스프레드 고려
```

### 1.6 기타 전략 스케치

```
Ratio Spread (비율 스프레드):
  Long 1×Call(K₁) + Short n×Call(K₂), n > 1
  → 부분적 비용 상쇄, 그러나 n > 1이므로 상방 무한 손실 가능
  → "1×2 Call Ratio": n=2, 가장 보편적

Collar (칼라):
  Long Stock + Long Put(K₁) + Short Call(K₂), K₁ < S₀ < K₂
  → 보유 주식의 하방 보호 + 상방 제한 (보험 비용 = C(K₂) - P(K₁))
  → "Zero-Cost Collar": C(K₂) = P(K₁)로 행사가 조정

Iron Butterfly (아이언 버터플라이):
  Short Straddle(K₂) + Long Strangle(K₁, K₃)
  → Iron Condor에서 K₂=K₃인 특수 사례
  → 최대 이익 폭은 좁지만 net_credit이 더 큼
```

---

## 2. 전략별 Greeks 동역학 (Strategy Greeks Dynamics)

개별 옵션의 Greeks 정의와 공식은 Doc 26 §1.2에서 완전히 도출되었다.
본 절에서는 그 **선형 조합**으로서 각 전략의 Greeks 프로파일을 분석한다.

> **핵심 원리:** Greeks는 선형 연산자이다.
> 포트폴리오의 Greek = Σ(각 포지션의 Greek × 수량 × 부호)
>
> 예: Long 1×Call(K₁) + Short 2×Call(K₂)의 Delta
>   Δ_portfolio = +1·N(d₁(K₁)) - 2·N(d₁(K₂))

### 2.1 Straddle의 Greeks

```
Long Straddle = Long Call(K) + Long Put(K)

Delta:
  Δ_straddle = Δ_C + Δ_P = N(d₁) + (N(d₁) - 1) = 2N(d₁) - 1

  ATM (S=K): d₁ ≈ 0.5σ√T ≈ 0 → Δ_straddle ≈ 0
  → ATM 스트래들은 delta-neutral (방향성 중립)
  → S가 K에서 멀어지면 Δ ≠ 0 (방향성 노출 발생)

Gamma:
  Γ_straddle = 2Γ_C = 2·N'(d₁)/(S·σ·√T)
  → 개별 옵션의 2배 → ATM에서 극대
  → 이것이 "감마 매수" 전략의 핵심 — 큰 움직임에서 이익

Theta:
  Θ_straddle = Θ_C + Θ_P < 0
  → 양쪽 옵션 모두 시간가치 소멸 → 총 Θ 소멸이 2배
  → 만기 근접 시 Θ 가속 (√T 역비례)
  → 일일 Θ = -2 × [S·N'(d₁)·σ/(2√T)] - ... (부호 항상 음)

Vega:
  ν_straddle = 2ν_C = 2·S·√T·N'(d₁)
  → ATM에서 극대, 변동성 민감도 2배
  → IV 상승 시 양쪽 옵션 모두 가치 상승 → 순이익

Gamma-Theta 트레이드오프 (BSM PDE, Doc 26 §1.2):
  0.5·σ²·S²·Γ + r·S·Δ + Θ = r·V
  ATM straddle (Δ ≈ 0):
    Θ ≈ r·V - 0.5·σ²·S²·Γ
  → Γ이 클수록 Θ 소멸도 큼 — "감마를 사면 세타를 지불한다"
```

### 2.2 Strangle의 Greeks

```
Long Strangle = Long Put(K₁) + Long Call(K₂),  K₁ < K₂

Delta:
  Δ_strangle = Δ_P(K₁) + Δ_C(K₂)
             = (N(d₁(K₁)) - 1) + N(d₁(K₂))
  OTM 옵션 사용 시: |Δ_P| < 0.5, Δ_C < 0.5
  → 대칭 구성이면 Δ ≈ 0 (근사적 delta-neutral)

Gamma:
  Γ_strangle = Γ(K₁) + Γ(K₂) < Γ_straddle
  → OTM 옵션의 Γ < ATM 옵션의 Γ → 스트래들보다 감마가 작음

Theta:
  |Θ_strangle| < |Θ_straddle|
  → OTM 옵션의 시간가치가 적으므로 소멸도 적음

Vega:
  ν_strangle = ν(K₁) + ν(K₂)
  → ATM이 아니므로 ν_strangle < ν_straddle
  → 그러나 비용 대비 변동성 노출(ν/cost)은 유사하거나 더 효율적일 수 있음
```

### 2.3 Bull Call Spread의 Greeks

```
Bull Call Spread = Long Call(K₁) + Short Call(K₂),  K₁ < K₂

Delta:
  Δ_bull = N(d₁(K₁)) - N(d₁(K₂)) > 0
  → 항상 양수 (강세 방향)
  → K₁ ATM, K₂ OTM이면 Δ ≈ 0.5 - 0.2 = 0.3 (부분적 강세 노출)

Gamma:
  Γ_bull = Γ(K₁) - Γ(K₂)
  → S < K₁: Γ > 0 (long gamma 우세)
  → S ≈ K₂: Γ < 0 (short gamma 우세)
  → S ≈ (K₁+K₂)/2: Γ ≈ 0 (감마 중립 근처)
  → 수익 구간에서 감마 부호 전환 — butterfly와 유사한 동역학

Theta:
  Θ_bull = Θ_long(K₁) + Θ_short(K₂)
  → Short leg이 Θ 수입 → Long leg의 Θ 손실 부분 상쇄
  → 순 Theta 효과: 일반적으로 약한 음수 (ATM 근처에서)

Vega:
  ν_bull = ν(K₁) - ν(K₂)
  → K₁ < K₂이고 ATM 근처에서 ν 극대이므로:
    K₁ < ATM < K₂: ν > 0 (장기 vega)
    K₁, K₂ 모두 ITM: ν < 0 (단기 vega)
  → IV skew에 따라 부호 변동 (Doc 37 §3)
```

### 2.4 Bear Put Spread의 Greeks

```
Bear Put Spread = Long Put(K₂) + Short Put(K₁),  K₁ < K₂

Delta:
  Δ_bear = Δ_P(K₂) - Δ_P(K₁)
         = (N(d₁(K₂))-1) - (N(d₁(K₁))-1)
         = N(d₁(K₂)) - N(d₁(K₁)) < 0
  → 항상 음수 (약세 방향)

Gamma, Theta, Vega:
  Bull Call Spread와 대칭적 구조
  Γ_bear = Γ(K₂) - Γ(K₁)  — 부호 전환점 위치만 다름
  Θ_bear: 부분 상쇄
  ν_bear: skew 영향에 따라 부호 변동
```

### 2.5 Butterfly의 Greeks

```
Butterfly = Long Call(K₁) + Short 2×Call(K₂) + Long Call(K₃)

Delta:
  Δ_bf = N(d₁(K₁)) - 2N(d₁(K₂)) + N(d₁(K₃))
  → S = K₂: Δ ≈ 0 (ATM 중심에서 delta-neutral)
  → K₁ < S < K₂: Δ > 0 (좌측에서 강세)
  → K₂ < S < K₃: Δ < 0 (우측에서 약세)

Gamma:
  Γ_bf = Γ(K₁) - 2Γ(K₂) + Γ(K₃)
  → S = K₂: Γ < 0 (음의 감마 — 핀닝 이익)
  → 핵심: "감마를 판다" → 기초자산이 K₂에 머무르면 이익
  → GEX 양수 환경(Doc 26 §6)에서 핀닝 경향 강화 → 나비 전략 유리

Theta:
  Θ_bf = Θ(K₁) - 2Θ(K₂) + Θ(K₃)
  → S = K₂: Θ > 0 (양의 세타 — 시간 경과가 유리)
  → 만기 근접 시 K₂의 Θ가 극대화 → 나비 가치 상승

Vega:
  ν_bf = ν(K₁) - 2ν(K₂) + ν(K₃)
  → S = K₂: ν < 0 (음의 베가 — 변동성 하락이 유리)
  → 본질적으로 "변동성 매도" 포지션
  → VKOSPI 하락 시 유리 (Doc 34 §2 VRP 양수 환경)
```

### 2.6 Iron Condor의 Greeks

```
Iron Condor = Bull Put Spread(K₁,K₂) + Bear Call Spread(K₃,K₄)

Delta:
  Δ_IC = Δ_bull_put + Δ_bear_call
  → 대칭 구성 시: Δ ≈ 0 (delta-neutral)
  → 비대칭 시: Δ_IC ≠ 0 → directional bias

Gamma:
  Γ_IC < 0 (중앙 수익 구간에서)
  → Short Strangle 감마 + Long Strangle 감마(부분 상쇄)
  → 순 음의 감마: 큰 움직임에 취약

Theta:
  Θ_IC > 0 (중앙 구간에서)
  → 시간 경과 = 이익 (프리미엄 시간가치 소멸 수취)

Vega:
  ν_IC < 0
  → IV 하락 시 유리 → VRP 양수 환경에서 기대 이익 (Doc 34 §2)
  → 어닝 후 IV crush에서 수익
```

### 2.7 Calendar Spread의 Greeks

```
Calendar = Short Call(K, T₁) + Long Call(K, T₂),  T₁ < T₂

Delta:
  Δ_cal = N(d₁(K,T₂)) - N(d₁(K,T₁))
  → ATM: T₂ > T₁이므로 d₁(T₂) > d₁(T₁) → Δ_cal > 0 (약간 양수)
  → 근사적 delta-neutral

Gamma:
  Γ_cal = Γ(K,T₂) - Γ(K,T₁)
  → 근월물 Γ(T₁) > 원월물 Γ(T₂)  (만기 근접 시 Γ 증가)
  → Γ_cal < 0 (순 음의 감마)
  → 기초자산 변동 최소화가 유리 (K 근처 유지)

Theta:
  Θ_cal = Θ_long(T₂) - Θ_short(T₁)
  → 근월물 Θ가 더 크므로 short leg의 Θ 수입 > long leg의 Θ 지출
  → Θ_cal > 0 (양의 세타 — 시간 경과가 유리)
  → 이것이 캘린더 스프레드의 핵심 수익원

Vega:
  ν_cal = ν(K,T₂) - ν(K,T₁)
  → 원월물 ν(T₂) > 근월물 ν(T₁)  (장기 옵션 = 더 큰 vega)
  → ν_cal > 0 (양의 베가 — IV 상승 시 유리)
  → 변동성 기간구조(Doc 34 §5) 정상화 → 캘린더 가치 상승
```

### 2.8 Greeks 부호 종합표

모든 전략의 Greeks 부호를 하나의 매트릭스로 정리한다.
부호는 ATM 또는 중앙 수익 구간(sweet spot) 기준이다.

```
┌─────────────────┬────────┬────────┬────────┬────────┐
│ 전략            │ Δ      │ Γ      │ Θ      │ ν      │
├─────────────────┼────────┼────────┼────────┼────────┤
│ Long Straddle   │ ≈ 0    │ ++     │ --     │ ++     │
│ Short Straddle  │ ≈ 0    │ --     │ ++     │ --     │
│ Long Strangle   │ ≈ 0    │ +      │ -      │ +      │
│ Short Strangle  │ ≈ 0    │ -      │ +      │ -      │
│ Bull Call Spread │ +      │ ±      │ ±      │ ±      │
│ Bear Put Spread │ -      │ ±      │ ±      │ ±      │
│ Butterfly       │ ≈ 0    │ -      │ +      │ -      │
│ Iron Condor     │ ≈ 0    │ -      │ +      │ -      │
│ Calendar Spread │ ≈ 0    │ -      │ +      │ +      │
└─────────────────┴────────┴────────┴────────┴────────┘

범례: ++ 강한 양수, + 양수, - 음수, -- 강한 음수, ± 조건부, ≈0 근사 영

해석 지침:
  Γ+ / Θ- 전략 (straddle/strangle): "감마 매수" = 큰 움직임에서 이익, 시간 비용
  Γ- / Θ+ 전략 (butterfly/condor/calendar): "감마 매도" = 안정에서 이익, 급변 손실
  ν+ 전략 (straddle/strangle/calendar): IV 상승 유리
  ν- 전략 (butterfly/condor): IV 하락 유리
```

### 2.9 Greeks 기간구조 — 만기까지의 진화

전략의 Greeks는 잔존 만기에 따라 동적으로 변화한다.

```
Long Straddle의 Greeks 시간 진화 (ATM 가정):

  T = 30일:  Δ ≈ 0,  Γ = 중간,  Θ = -중간,  ν = 높음
  T = 10일:  Δ ≈ 0,  Γ = 높음,  Θ = -높음,  ν = 중간
  T =  3일:  Δ ≈ 0,  Γ = 극대,  Θ = -극대,  ν = 낮음
  T =  0일:  Δ = ±1,  Γ → ∞(이론),  Θ → -∞,  ν = 0

직관:
  만기 근접 → Γ 폭발 → 작은 움직임도 큰 P/L 변화
  만기 근접 → Θ 가속 → 시간가치 급감
  만기 근접 → ν 소멸 → IV 변화의 영향력 감소

→ Gamma Scalping은 DTE 10-15일 구간이 최적
   (Γ 충분히 크고 Θ 비용이 아직 폭발하지 않은 영역)
→ DTE < 5일: "감마 복권" — 저비용 고레버리지 (KRX weekly 옵션 활용)
```

---

## 3. 손익분기점 & P/L 곡면 분석 (Break-Even & P/L Surface)

### 3.1 2D P/L 도표 — 만기 시 페이오프

만기 시점의 P/L은 S_T의 단일 변수 함수로서 가장 기본적인 분석 도구이다.

```
2D P/L 도표 구성법:

  X축: S_T (만기 시 기초자산 가격)
  Y축: P/L (순손익, 원 단위)

  각 전략별 구간 함수(piecewise linear):
    Long Call:       기울기 0 (S_T<K) → 기울기 +1 (S_T>K), y절편 = -C
    Long Put:        기울기 -1 (S_T<K) → 기울기 0 (S_T>K), y절편 = K-P
    Bull Call Spread: 기울기 0 → +1 → 0, 상하한 있음
    Butterfly:       기울기 0 → +1 → -1 → 0, 텐트 형태

  필수 표시 요소:
    ✓ BEP 점(Break-Even Points): P/L = 0인 S_T 값
    ✓ 최대 이익(Max Profit) 수평선
    ✓ 최대 손실(Max Loss) 수평선
    ✓ 현재가 S₀ 수직선 (진입 시점 기준)
    ✓ Risk:Reward 비율 표기
```

### 3.2 3D P/L 곡면 — 시간가치 포함

만기 전 임의 시점의 P/L은 (S_T, t) 2차원 변수의 함수이다.
이를 3D 곡면으로 시각화하면 시간가치 소멸의 동역학을 직관적으로 파악할 수 있다.

```
3D P/L 곡면:
  X축: S (기초자산 가격)
  Y축: t (잔존 만기, 일 수)
  Z축: P/L (순손익)

  산출: 각 (S, t) 격자점에서 BSM 이론가로 포트폴리오 가치 평가
  V(S, t) = Σ [w_i × BSM(S, K_i, t, σ_i, r)] - initial_cost
  w_i = 각 leg의 부호와 수량

  곡면의 특성:
  - t 감소(만기 접근) → 곡면이 만기 시 piecewise-linear로 수렴
  - 중앙(ATM) 영역: 시간가치 소멸 효과 최대 (Θ 극대)
  - 양쪽 날개(deep ITM/OTM): 시간가치 미미 (내재가치 수렴)

Long Straddle 곡면 특성:
  t = 30: 완만한 V자 → 넓은 BEP 간격 + 높은 시간가치
  t = 10: 중간 V자 → BEP 좁아짐 + 시간가치 감소
  t =  0: 날카로운 V자 → BEP = K±(C+P)의 정확한 점

Butterfly 곡면 특성:
  t = 30: 거의 평탄 (시간가치가 크므로 모든 위치에서 -net_debit)
  t = 10: 텐트 형태 출현 (K₂ 근처에서 양의 P/L 시작)
  t =  0: 완전한 텐트 → K₂에서 최대 이익
```

### 3.3 BEP 공식 종합표

```
┌─────────────────┬──────────────────────────────────────┬────────┐
│ 전략            │ BEP 공식                             │ BEP 수 │
├─────────────────┼──────────────────────────────────────┼────────┤
│ Long Call       │ K + C                                │ 1      │
│ Long Put        │ K - P                                │ 1      │
│ Long Straddle   │ K ± (C + P)                          │ 2      │
│ Long Strangle   │ K₁ - (P+C), K₂ + (P+C)              │ 2      │
│ Bull Call Spread│ K₁ + net_debit                       │ 1      │
│ Bear Put Spread │ K₂ - net_debit                       │ 1      │
│ Butterfly       │ K₁ + net_debit, K₃ - net_debit       │ 2      │
│ Iron Condor     │ K₂ - net_credit, K₃ + net_credit     │ 2      │
│ Calendar Spread │ 비해석적 (BSM 수치 해)                │ 2*     │
└─────────────────┴──────────────────────────────────────┴────────┘

* Calendar Spread의 BEP는 근월물 만기 시 원월물의 잔존가치에 의존하므로
  해석적 공식이 존재하지 않는다. Newton-Raphson 수치 해로 구한다.
```

### 3.4 최대 손익 & Risk:Reward 종합표

```
┌─────────────────┬─────────────────┬──────────────────┬──────────┐
│ 전략            │ 최대 이익       │ 최대 손실         │ R:R 범위 │
├─────────────────┼─────────────────┼──────────────────┼──────────┤
│ Long Call       │ 무한대          │ C                 │ ∞        │
│ Short Call      │ C               │ 무한대            │ 0        │
│ Long Put        │ K - P           │ P                 │ 유한     │
│ Short Put       │ P               │ K - P             │ 유한     │
│ Long Straddle   │ 무한대          │ C + P             │ ∞        │
│ Short Straddle  │ C + P           │ 무한대            │ 0        │
│ Long Strangle   │ 무한대          │ P + C (OTM)       │ ∞        │
│ Short Strangle  │ P + C (OTM)     │ 무한대            │ 0        │
│ Bull Call Spread│ K₂-K₁-nd        │ nd                │ 1~5      │
│ Bear Put Spread │ K₂-K₁-nd        │ nd                │ 1~5      │
│ Butterfly       │ K₂-K₁-nd        │ nd                │ 5~20     │
│ Iron Condor     │ nc              │ wing_width-nc     │ 0.2~1    │
│ Calendar Spread │ 비해석적        │ nd                │ 1~5      │
└─────────────────┴─────────────────┴──────────────────┴──────────┘

nd = net_debit, nc = net_credit

Risk:Reward 해석:
  R:R > 3:   저확률-고수익 전략 (Long Straddle, Butterfly)
  R:R ≈ 1:   균형 전략 (Vertical Spreads)
  R:R < 1:   고확률-저수익 전략 (Short Straddle, Iron Condor)
  → 기대값 = 확률 × R:R → 전략 우위는 R:R가 아닌 기대값으로 판단
```

### 3.5 감응도 분석 — P/L의 IV 의존성

```
IV 변화에 따른 P/L 등고선 (isoprofit contours):

  3D 곡면의 IV 차원 슬라이스:
  P/L(S, σ) at fixed t

  Long Straddle:
    σ ↑ 5%p: 전체 P/L 곡면 상방 이동 (ν > 0)
    σ ↓ 5%p: 전체 P/L 곡면 하방 이동
    → "IV crush" 효과의 정량화

  Iron Condor:
    σ ↑ 5%p: 중앙 이익 구간 축소 + 날개 손실 확대 (ν < 0)
    σ ↓ 5%p: 중앙 이익 구간 확대 + 날개 손실 축소
    → 어닝 후 IV crush = Iron Condor 수익 촉진

실무 시사점:
  IV surface의 term structure(Doc 34 §5)와 skew(Doc 37 §3)가
  단순 평행 이동(parallel shift)이 아닌 비대칭적 변형을 유발
  → ν만으로는 불충분, Vanna/Volga 고차 Greeks 고려 필요
  → Doc 26 §1.2 고차 Greeks 참조
```

---

## 4. 변동성 매매 (Volatility Trading)

방향성(directional) 매매가 "S가 오를 것인가 내릴 것인가"에 베팅한다면,
변동성(volatility) 매매는 "S가 얼마나 많이 움직일 것인가"에 베팅한다.
이는 옵션 시장만이 제공하는 고유한 투자 차원이다.

### 4.1 Gamma Scalping (감마 스캘핑)

**이론적 기초:**

감마 스캘핑은 BSM PDE의 Θ-Γ 트레이드오프를 이산적으로 실현하는 전략이다.

```
연속 시간 BSM PDE (Doc 26 §1.2):
  0.5·σ²·S²·Γ + r·S·Δ + Θ = r·V

Delta-neutral 포트폴리오 (Π = V - Δ·S):
  dΠ = 0.5·Γ·(dS)² + Θ·dt + 고차항
     = 0.5·Γ·S²·σ²_realized·dt + Θ·dt  (연속 시간)

기대 P/L (dt 구간):
  E[dΠ] = 0.5·Γ·S²·(σ²_realized - σ²_implied)·dt

→ σ_realized > σ_implied (RV > IV): 감마 이익 > 세타 비용 → 순이익
→ σ_realized < σ_implied (RV < IV): 감마 이익 < 세타 비용 → 순손실
→ VRP = IV - RV > 0 (Doc 34 §2)이면 감마 매수 기대 손실
→ VRP < 0이면 감마 매수 기대 이익
```

**이산 리밸런싱 P/L:**

실무에서는 연속 헤지가 불가능하므로 이산적(discrete) 리밸런싱을 수행한다.

```
이산 감마 스캘핑 P/L (단일 리밸런싱 구간):
  P/L_rebal = 0.5·Γ·(ΔS)² - Θ·Δt

  ΔS = S_{t+Δt} - S_t  (리밸런싱 구간 동안의 가격 변화)
  Δt = 리밸런싱 간격 (일 단위)

  감마 이익: 0.5·Γ·(ΔS)² — 양의 볼록성(convexity)에서 발생
    → ΔS²에 비례 → 큰 움직임에서 가속적 이익
    → 방향 무관 (ΔS의 부호와 무관하게 (ΔS)² > 0)

  세타 비용: Θ·Δt — 시간가치 소멸
    → Δt에 비례 → 시간이 지날수록 비용 누적

  N회 리밸런싱 후 총 P/L:
    P/L_total = Σᵢ₌₁ᴺ [0.5·Γᵢ·(ΔSᵢ)² - Θᵢ·Δtᵢ]
```

**리밸런싱 빈도의 최적화:**

```
리밸런싱 빈도 트레이드오프:

  빈번한 리밸런싱 (Δt 작음):
    + 델타 헤지 정밀도 향상
    + 감마 이익의 연속적 포착
    - 거래비용 증가 (KRX: 수수료 + 슬리피지)
    - 매 리밸런싱의 감마 이익 미소(ΔS 작음 → (ΔS)² 미소)

  드문 리밸런싱 (Δt 큼):
    + 거래비용 절감
    + 큰 움직임 시 감마 이익 극대
    - 델타 노출 누적 → 방향성 위험
    - 오버나이트 갭 위험 (KRX: 야간 미국 시장 영향)

  최적 빈도 결정:
    Zakamouline & Koekebakker (2009):
    Δt_opt ∝ (cost_per_trade / (Γ·S²·σ²))^(1/3)

    KRX 실무:
    일일 1회 종가 리밸런싱 (가장 보편적)
    또는 |Δ 변화| > 임계값 시 이벤트 기반 리밸런싱
    임계값: |ΔΔ| > 0.10 (ATR 기반 동적 조정 가능)
```

**감마 스캘핑의 P/L 분포:**

```
감마 스캘핑 P/L의 통계적 특성:

  E[P/L_daily] = 0.5·Γ·S²·(σ²_R - σ²_I) / 252
    → σ_R = 실현변동성(연율), σ_I = 내재변동성(연율)
    → E[P/L] > 0 ⟺ RV > IV

  Var[P/L_daily] = 2·(0.5·Γ·S²·σ²_R/252)²
    → P/L 분산은 Γ²에 비례 → 높은 감마 = 높은 P/L 변동성

  P/L 분포의 비대칭성:
    실현변동성이 정규분포를 따르더라도,
    (ΔS)² 항에 의해 P/L은 양의 편향(positive skew)
    → 감마 매수: 좌측 제한(-Θ×T), 우측 무한 (유리한 비대칭)
    → 감마 매도: 반대 비대칭 (불리한 꼬리 위험)
```

### 4.2 Vega 헤지와 변동성 노출 관리

변동성 수준(σ)에 대한 포트폴리오의 민감도를 관리하는 기법이다.

```
Vega-Neutral 포트폴리오 구성:

  목표: Σ(wᵢ × νᵢ) = 0
  → 변동성 수준의 평행 이동에 면역

  구성법:
  (1) 기존 포지션의 총 vega 산출: ν_total = Σ νᵢ
  (2) 반대 vega 제공하는 옵션 추가
      예: ν_total = +500이면, ν = -500인 옵션 포지션 추가
  (3) 추가 포지션이 delta 왜곡 유발 → delta 재헤지

  실무적 한계:
    - "vega-neutral"은 IV의 평행 이동(parallel shift)에만 면역
    - IV surface의 비평행 변동(tilt, twist)에는 노출 잔존
    - 완전 면역: 행사가별·만기별 vega bucket hedging 필요
    → Doc 37 §2 SVI 파라미터의 변화로 모델링
```

**Vega Bucket Hedging:**

```
IV surface를 행사가-만기 격자로 분할하여 각 격자의 vega를 독립 관리:

  ν(K_i, T_j) = ∂V/∂σ(K_i, T_j)

  K₁(0.9×F)  K₂(0.95×F)  K₃(F)  K₄(1.05×F)  K₅(1.1×F)
  ─────────────────────────────────────────────────────
  T₁(1w)  ν₁₁       ν₁₂       ν₁₃    ν₁₄        ν₁₅
  T₂(1m)  ν₂₁       ν₂₂       ν₂₃    ν₂₄        ν₂₅
  T₃(3m)  ν₃₁       ν₃₂       ν₃₃    ν₃₄        ν₃₅

  → 5×3 = 15개 vega bucket
  → 각 bucket을 해당 행사가·만기의 옵션으로 개별 헤지
  → 완전 헤지에는 bucket 수만큼의 헤지 도구 필요 (실무적으로 비현실적)
  → 주성분 분석(PCA)으로 차원 축소: 3-5개 주성분이 IV surface 변동의 ~95% 설명
```

### 4.3 분산 스왑 (Variance Swap)

변동성을 직접 거래하는 가장 순수한 도구이다.

```
분산 스왑 (Variance Swap):

  교환 구조:
    만기 T에서 교환하는 현금흐름:
    Payoff = (σ²_realized - K_var) × Notional

    σ²_realized: 만기까지의 실현 분산 (연율화)
    K_var:       계약 시 합의된 분산 행사가 (strike variance)
    Notional:    명목금액 (분산 금액, vega notional과 구별)

  공정 가치 (No-Arbitrage Strike):
    K_var = E^Q[σ²_realized]
          = (2/T) × ∫₀^∞ [C(K)/K² + P(K)/K²] × (e^(rT)/K²) dK

    Demeterfi, Derman, Kamal & Zou (1999):
    이 적분은 옵션 가격의 연속 행사가 스펙트럼(log-strike)으로 복제 가능
    → "옵션 포트폴리오로 분산을 복제한다"

  이산 근사 (실무):
    K_var ≈ (2/T) × Σᵢ [(ΔKᵢ/K²ᵢ) × e^(rT) × V(Kᵢ)]
    V(Kᵢ) = 행사가 Kᵢ의 OTM 옵션 가격 (K < F이면 풋, K > F이면 콜)
    ΔKᵢ = 인접 행사가 간격

  VKOSPI와의 관계 (Doc 26 §2.3):
    VKOSPI² ≈ K_var (30일 분산 스왑 행사가의 근사)
    → VKOSPI는 본질적으로 30일 분산 스왑의 가격을 지수화한 것
```

**분산 스왑 매매 전략:**

```
VRP 수확 (Variance Risk Premium Harvest):
  Doc 34 §2에서 확인한 VRP > 0 (정상 상태):
    IV² > E[RV²] → K_var > E[σ²_realized]

  전략: 분산 스왑 매도 (Short Variance)
    → K_var 수취 - σ²_realized 지급
    → VRP > 0이면 기대 양수 수익
    → "보험 매도" 전략 — 정상 시 안정적 수익, 위기 시 대규모 손실

  역사적 수익률 (글로벌 실증):
    Carr & Wu (2009): S&P500 분산 스왑 매도
      연 평균 수익률: +3-5% (Sharpe ≈ 0.4)
      최대 손실: -30% (2008년 금융위기)
      → 꼬리 위험(tail risk) 관리 필수

  KRX 적용:
    장외(OTC) 분산 스왑 → 기관 투자자 한정
    대리 전략: Short Straddle + Delta Hedge ≈ Short Variance (근사)
    → §4.1 감마 스캘핑의 역방향 = 분산 매도
```

### 4.4 변동성 기간구조 매매 (Volatility Term Structure Trading)

변동성의 기간구조(term structure)는 잔존 만기에 따른 IV의 패턴이다.
Doc 34 §5에서 이론적 기초를 제공했으며, 본 절에서는 구체적 매매 전략을 다룬다.

```
변동성 기간구조 형태 (Doc 34 §5 참조):

  정상(Contango): IV(T₁) < IV(T₂),  T₁ < T₂
    → 장기 옵션이 더 비쌈 (통상적)
    → 시장이 장기 불확실성을 더 크게 평가

  역전(Backwardation): IV(T₁) > IV(T₂)
    → 단기 옵션이 더 비쌈 (비통상적)
    → 단기 이벤트 위험 반영 (어닝, FOMC, 위기)
    → 급격한 역전 = 시장 스트레스 신호

전략 매핑:

  정상 기간구조 → 역전 기대:
    Long Calendar Spread (§1.5)
    → 근월 매도(높은 Θ 수취) + 원월 매수
    → 기간구조 정상화(역전 해소) 시 원월물 가치 상승

  역전 기간구조 → 정상화 기대:
    Short Calendar Spread (역캘린더)
    → 근월 매수(높은 IV 매수) + 원월 매도
    → 위기 고조 시 근월 IV 급등 → 추가 이익

  기간구조 스프레드 트레이딩:
    cv_ratio = IV(근월) / IV(원월)  (Doc 34 §5의 정의)
    cv_ratio > 1.2: 과도한 역전 → Long Calendar (평균 회귀 베팅)
    cv_ratio < 0.85: 과도한 정상 → Short Calendar (역전 베팅)

    ※ 임계값은 KRX KOSPI200 옵션 역사적 분포 기반 [C][L:GCV]
```

### 4.5 변동성 스큐 매매 (Volatility Skew Trading)

IV surface의 행사가(strike) 차원, 즉 스큐(skew)를 활용한 매매이다.
Doc 37 §3-4에서 스큐 동역학과 신호 체계를 다루었다.

```
스큐 측정 (Doc 37 §4 참조):
  25δ Risk Reversal (RR) = IV(25δ Call) - IV(25δ Put)
  25δ Butterfly (BF) = 0.5×[IV(25δ Call) + IV(25δ Put)] - IV(ATM)

스큐 매매 전략:

  (1) Risk Reversal (리스크 리버설):
    구성: Long OTM Call + Short OTM Put (또는 반대)
    → 스큐의 방향에 베팅
    → RR < -5%p (풋 스큐 과도): Long Risk Reversal
      = Short Put(25δ) + Long Call(25δ)
      → 풋 스큐 정상화 시 이익

  (2) 스큐를 활용한 수직 스프레드 최적화:
    IV skew가 급경사이면:
      OTM 풋의 IV가 ATM보다 높음 → 풋 스프레드 매도가 유리
      (높은 IV의 풋을 매도 → 프리미엄 수취 극대화)

    IV skew가 완만하면:
      풋과 콜의 IV 차이 작음 → 스트래들/스트랭글이 효율적

  (3) Volatility Butterfly 매매:
    BF 수치가 역사적 극단이면 → 평균 회귀 베팅
    높은 BF (볼록한 스마일): Iron Butterfly 매도
    낮은 BF (평탄한 스마일): Iron Butterfly 매수
```

### 4.6 변동성 전략 선택 의사결정 트리

```
변동성 매매 의사결정 (IV vs RV + 기간구조 + 스큐):

  Step 1: IV vs RV 판단 (Doc 34 §2 VRP)
    ├─ IV >> RV (VRP > 5%p): 변동성 과대 → 매도 전략 유리
    │   ├─ 스큐 급경사: Short Risk Reversal / OTM Put 매도
    │   ├─ 기간구조 역전: Long Calendar
    │   └─ 평탄: Short Straddle / Iron Condor
    │
    ├─ IV ≈ RV (|VRP| < 3%p): 균형 → 방향성 전략 또는 대기
    │   └─ 이벤트 임박: Long Straddle/Strangle (이벤트 프리미엄 없을 때)
    │
    └─ IV << RV (VRP < -3%p): 변동성 과소 → 매수 전략 유리
        ├─ 스큐 완만: Long Straddle
        ├─ 기간구조 정상: Short Calendar + Delta Hedge
        └─ 단기 급등 기대: Weekly Option Long Strangle

  Step 2: Greeks 조합 확인 (§2.8 매트릭스)
    → 선택한 전략의 Δ, Γ, Θ, ν 부호가 시장 뷰와 일치하는지 검증

  Step 3: 비용-효율성 평가
    → ν/cost (단위 비용당 vega 노출)
    → Γ/Θ (감마 대비 세타 효율)
    → BEP 도달 확률 (IV에서 암시된 이동 범위와 비교)
```

---

## 5. KRX 실전 (KRX Practical Application)

### 5.1 KOSPI200 옵션 체인 구조

KOSPI200 옵션의 상세 구조는 Doc 45 §8.1-8.2에서 정의되었다.
본 절에서는 **전략 실행 관점에서의** 구조적 특성을 다룬다.

```
행사가 간격과 전략 구성:

  KOSPI200 수준 ~380 (2026년 기준 가정):
    행사가 간격: 2.5p
    → 1p = 250,000원 (일반), 50,000원 (미니)
    → 2.5p 간격 = 625,000원 (일반), 125,000원 (미니)

  전략별 최소 거래 단위:
    Bull Call Spread (K₁=377.5, K₂=380.0):
      순비용 ≈ 1.5p (예시) = 375,000원 (일반) / 75,000원 (미니)
      최대 이익: 2.5 - 1.5 = 1.0p = 250,000원 / 50,000원

    Butterfly (5p 폭: K₁=375, K₂=380, K₃=385):
      순비용 ≈ 0.5p (예시) = 125,000원 / 25,000원
      최대 이익: 5.0 - 0.5 = 4.5p = 1,125,000원 / 225,000원
      R:R = 4.5/0.5 = 9:1

    Iron Condor (K₁=370, K₂=375, K₃=385, K₄=390):
      순수취 ≈ 2.0p (예시) = 500,000원 / 100,000원
      최대 손실: 5.0 - 2.0 = 3.0p = 750,000원 / 150,000원

월물 구조와 전략 선택:
  주물(Weekly): DTE 0-7 → 감마 극대, 세타 극대 → 단기 이벤트 전략
  월물(Monthly): DTE 15-45 → 균형적 Greeks → 대부분의 스프레드 전략
  분기물(Quarterly): DTE 60-180 → 장기 캘린더, 장기 방향성 전략

시장 조성자 의무 (Doc 45 §8.1):
  양방향 호가 제시 의무: ATM ± 5 행사가 (10개 행사가)
  스프레드 상한: ATM 옵션 이론가의 일정 비율
  → 유동성 보장 구간 = ATM ± 12.5p (5 × 2.5p)
  → 이 구간 밖의 deep OTM/ITM 옵션은 유동성 부족 주의
```

### 5.2 VKOSPI와 전략 선택

VKOSPI 레짐(Doc 26 §2.3)에 따른 전략 선택 가이드라인이다.

```
VKOSPI 레짐별 전략 적합도:

  ┌──────────┬─────────────┬────────────────────────────────┐
  │ VKOSPI   │ 시장 상태    │ 유리한 전략                    │
  ├──────────┼─────────────┼────────────────────────────────┤
  │ < 15     │ 극저변동성   │ Long Straddle/Strangle        │
  │          │ (안일)       │ → 프리미엄 저렴, 돌파 기대    │
  │          │              │ Long Calendar (기간구조 매수)  │
  ├──────────┼─────────────┼────────────────────────────────┤
  │ 15-20    │ 정상         │ 방향성 스프레드 (Bull/Bear)    │
  │          │              │ → Greeks 균형, 적정 비용       │
  │          │              │ Butterfly (핀닝 기대)          │
  ├──────────┼─────────────┼────────────────────────────────┤
  │ 20-25    │ 경계         │ Iron Condor (프리미엄 수취)    │
  │          │              │ Short Strangle (VRP 수확)      │
  │          │              │ → IV 과대 가격에서 매도        │
  ├──────────┼─────────────┼────────────────────────────────┤
  │ 25-35    │ 공포         │ Short Straddle (VRP 극대)      │
  │          │              │ → 반드시 위험 관리 필수        │
  │          │              │ Bull Put Spread (crash 후 반등)│
  ├──────────┼─────────────┼────────────────────────────────┤
  │ > 35     │ 극단 공포    │ Long Put (보호 유지)           │
  │          │              │ 신규 매도 전략 진입 자제       │
  │          │              │ → VRP 극대이나 꼬리 위험도 극대│
  └──────────┴─────────────┴────────────────────────────────┘

  ※ VKOSPI > 35에서의 Short Volatility는 2020년 3월 사태 참고
    KOSPI200: 310 → 200 (35% 하락, 2주)
    VKOSPI: 20 → 85 (320% 급등)
    → Short Straddle 만기 손실: 100p × 250,000 = 25,000,000원/계약
    → 절대 위험 관리 없는 naked short 금지

VKOSPI 시계열 패턴과 전략 타이밍:
  VKOSPI 평균 회귀 반감기 ≈ 22 영업일 (Doc 34 §2.3)
  → VKOSPI 급등 후 1개월 내 평균 회귀 확률 ~70%
  → Short Volatility 진입은 VKOSPI 급등 후 5-10일 안정화 확인 후
```

### 5.3 PCR 연동 전략 선택

Doc 26 §3.1-3.2의 PCR 역발상 분석을 전략 선택에 연동한다.

```
PCR-전략 매핑 (Doc 26 §3 역발상 해석 적용):

  PCR > 1.2 (극단 공포):
    역발상: 매수 신호
    전략: Bull Call Spread, Cash-Secured Put (할인 매수)
    → 풋 OI 극대 → 시장 조성자 숏풋 헤지 → 풋 IV 고점 = 풋 매도 유리

  PCR 0.8-1.2 (중립):
    방향 중립: Iron Condor, Butterfly
    → 뚜렷한 방향 신호 없음 → 레인지 바운드 전략

  PCR < 0.6 (극단 낙관):
    역발상: 매도 신호
    전략: Bear Put Spread, Protective Put (보유 주식 보호)
    → 콜 OI 극대 → 콜 IV 고점 → 콜 매도 유리

  PCR + VKOSPI 이중 확인 (Doc 26 §3.2):
    PCR > 1.2 AND VKOSPI > 25: 강한 역발상 매수
    → Bull Put Spread (높은 IV에서 풋 매도 = 프리미엄 극대)
    PCR < 0.6 AND VKOSPI < 15: 강한 역발상 매도
    → Bear Call Spread (콜 매도 = 방향성 + 시간가치)

  5일 이동평균 PCR 사용:
    Doc 26 §3.1에서 PCR_5d = MA(5, PCR_daily) 정의
    → 일중 노이즈 제거 후 전략 신호 발생
```

### 5.4 GEX 연동 전략 선택

Doc 26 §6의 GEX(감마 익스포저) 분석을 전략 선택에 연동한다.

```
GEX-전략 매핑 (Doc 26 §6 메커니즘 적용):

  Positive GEX (GEX > 0):
    딜러 역방향 헤지 → 평균 회귀 → 레인지 바운드
    유리한 전략:
      ✓ Short Straddle/Strangle (변동성 매도)
      ✓ Iron Condor (레인지 이익)
      ✓ Butterfly (핀닝 이익)
      ✗ Long Straddle (변동성 매수 → 불리)

  Negative GEX (GEX < 0):
    딜러 순방향 헤지 → 모멘텀 강화 → 추세 환경
    유리한 전략:
      ✓ Long Straddle/Strangle (변동성 매수)
      ✓ 방향성 스프레드 (Bull/Bear) — 추세 방향 판단 시
      ✗ Short Straddle (급변 손실 위험)
      ✗ Iron Condor (돌파 확률 높음)

  GEX Flip Level (Doc 26 §6.1):
    현재 KOSPI200 수준이 flip level 위/아래인지 확인
    → 전략의 Greeks 부호와 시장 레짐의 정합성 검증

  GEX + VKOSPI 교차 신호:
    ┌──────────────┬──────────────┬────────────────────┐
    │              │ VKOSPI < 20  │ VKOSPI > 25        │
    ├──────────────┼──────────────┼────────────────────┤
    │ GEX > 0      │ 안정-저변동  │ 고VRP+핀닝        │
    │ (mean-rev)   │ Butterfly    │ Short Straddle     │
    │              │ Calendar     │ Iron Condor        │
    ├──────────────┼──────────────┼────────────────────┤
    │ GEX < 0      │ 잠재적 돌파  │ 위기 모드         │
    │ (momentum)   │ Long Strangle│ Protective Put     │
    │              │ Bull/Bear Sp.│ Long Put + Delta   │
    └──────────────┴──────────────┴────────────────────┘
```

### 5.5 스트래들 암묵적 이동 (Straddle Implied Move)

ATM 스트래들 가격으로부터 시장이 암묵적으로 가격 책정한
만기까지의 예상 이동 폭(expected move)을 추정한다.

```
Straddle Implied Move (SIM):

  정의:
    SIM = ATM_Straddle_Price / Underlying_Price × 100 (%)

  이론적 기초:
    ATM straddle의 BSM 근사 (Brenner & Subrahmanyam 1988):
      Straddle ≈ 2 × S × N'(0) × σ × √T
               = 2 × S × (1/√(2π)) × σ × √T
               ≈ 0.7979 × S × σ × √T

    따라서:
      SIM ≈ 0.7979 × σ × √T × 100 (%)

    역산:
      σ_implied ≈ SIM / (0.7979 × √T × 100)

  KRX 실무 적용:

    KOSPI200 = 380, ATM Straddle (월물, T=30일) = 12p일 때:
      SIM = 12 / 380 × 100 = 3.16%
      → "시장은 만기까지 KOSPI200이 ±3.16% (약 ±12p) 이동할 것으로 가격 책정"

    역산 IV:
      T = 30/365 = 0.0822
      σ_implied ≈ 3.16 / (0.7979 × √0.0822 × 100) ≈ 13.8% (연율화)
      → VKOSPI ≈ 13.8% 확인 (정합성 체크)

  이벤트 SIM (Event Implied Move):
    특정 이벤트(어닝, FOMC, BOK)를 포괄하는 만기의 SIM에서
    나머지 기간의 "정상" 분산을 차감하여 이벤트 고유 변동성 추출:

    σ²_event × t_event = σ²_total × T - σ²_normal × (T - t_event)

    σ²_event = [σ²_total × T - σ²_normal × (T - t_event)] / t_event

    Event_IM = σ_event × √t_event × 0.7979 × S

    예: 월간 SIM = 3.16%, 이벤트(BOK 금리) = 5일 후, 정상 σ = 12%
      σ²_total = (0.1316)² = 0.01732
      σ²_normal = (0.12)² = 0.0144
      σ²_event = [0.01732 × (30/365) - 0.0144 × (25/365)] / (5/365)
               = [0.001423 - 0.000986] / 0.01370
               = 0.0319
      σ_event = 17.9%
      Event_IM = 0.7979 × 0.179 × √(5/365) × 380 ≈ 6.3p (1.66%)
      → "시장은 BOK 금리 결정에 KOSPI200 ±6.3p (~±1.66%) 변동 기대"

  SIM 활용 전략:
    SIM이 역사적 실현 이동(historical realized move)보다:
      큰 경우 → Short Straddle (이벤트 후 IV crush 수익)
      작은 경우 → Long Straddle (과소 가격된 이벤트 위험 매수)

    판단 기준:
      SIM / Historical_avg_move > 1.2 → Short (과대 가격)
      SIM / Historical_avg_move < 0.8 → Long (과소 가격)
```

### 5.6 증거금 요구사항 & 위험 관리

```
KRX KOSPI200 옵션 증거금 (2026년 기준, 일반):

  옵션 매수: 프리미엄 100% 선납 (추가 증거금 없음)
  옵션 매도: SPAN 방식 증거금 (Standard Portfolio Analysis of Risk)

  SPAN 증거금 산출 개요:
    16가지 시나리오 (기초자산 ±7 수준 × 변동성 ±2 수준)
    → 최악 시나리오의 손실 = 증거금 요구액

  대략적 증거금 수준 (예시):
    ATM Naked Short Call/Put: 프리미엄 + (15-20% × 기초자산가치)
    Spread (defined risk): max(양 leg 간 행사가 차이 × 승수 - 수취 프리미엄, 0)
    Iron Condor: max(wing_width × 승수 - net_credit, 0) per side

    수치 예 (KOSPI200 = 380):
    Naked Short Call 380:
      증거금 ≈ 12p + 0.15 × 380 = 69p ≈ 17,250,000원 (일반)
    Iron Condor (5p width):
      증거금 ≈ 5p - 2p(credit) = 3p ≈ 750,000원 (일반)
      → Naked 대비 1/23 수준 → 자본 효율 극대

위험 관리 핵심:
  (1) 포지션 사이징:
      단일 전략 최대 손실 ≤ 계좌의 2-5%
      예: 계좌 50,000,000원 → Iron Condor 최대 손실 750,000원
      → 1.5% 배분 → 허용 범위

  (2) 조기 청산 규칙:
      • 손실이 최대 손실의 50%에 도달 시 1/2 청산 검토
      • 최대 손실의 75%에 도달 시 전량 청산
      • BEP 도달 시 stop-loss 트리거 설정

  (3) 만기 위험 (Pin Risk):
      KOSPI200 옵션은 유럽형·현금결제 → pin risk 없음
      (미국형 개별 주식 옵션에서만 pin risk 존재)
      단, 만기 당일 15:20까지 최종결제가격 확정 불확실성 존재

  (4) 유동성 위험:
      ATM ± 12.5p (시장조성자 호가 범위) 밖은 호가 스프레드 확대
      → 전략 구성 시 유동성 구간 내 행사가 사용 권장
      → deep OTM 옵션 사용 시 슬리피지 10-30% 예상
```

### 5.7 compute_options_analytics.py 출력 구조 설계

전략 분석을 자동화하기 위한 Python 파이프라인의 출력 구조를 정의한다.

```
compute_options_analytics.py 출력 설계:

입력:
  - data/derivatives/options_chain_{date}.json  (행사가별 OI, Volume, 최종가)
  - data/derivatives/vkospi_daily.json           (VKOSPI 시계열)
  - data/macro/kospi200_daily.json               (KOSPI200 OHLCV)

출력 파일: data/derivatives/options_analytics_{date}.json

{
  "date": "2026-04-04",
  "underlying": {
    "symbol": "KOSPI200",
    "price": 380.05,
    "change_pct": -0.32
  },

  "vkospi": {
    "current": 18.5,
    "percentile_1y": 42,
    "regime": "normal",           // low/normal/elevated/high/extreme
    "mean_reversion_signal": 0.3  // [-1, 1]
  },

  "pcr": {
    "volume": 0.92,
    "oi": 1.05,
    "pcr_5d": 0.98,
    "signal": "neutral",          // extreme_fear/fear/neutral/greed/extreme_greed
    "contrarian_direction": null   // "buy"/"sell"/null
  },

  "gex": {
    "total_gex": 12500000000,     // 원 단위
    "gex_sign": "positive",       // positive/negative
    "flip_level": 375.0,
    "regime": "mean_reversion"    // mean_reversion/momentum
  },

  "straddle_implied_move": {
    "atm_straddle_price": 12.3,   // KOSPI200 포인트
    "sim_pct": 3.24,              // %
    "sim_points": 12.3,           // 포인트
    "implied_vol": 14.2,          // % (연율화)
    "event_im": {                 // 가장 가까운 이벤트
      "event": "BOK_rate",
      "date": "2026-04-10",
      "event_im_pct": 1.8,
      "event_im_points": 6.8
    }
  },

  "strategy_signals": {
    "straddle_sell": {
      "score": 0.72,              // [0, 1]
      "factors": ["vkospi_elevated", "gex_positive", "vrp_positive"]
    },
    "iron_condor": {
      "score": 0.68,
      "factors": ["gex_positive", "pcr_neutral", "vkospi_normal"]
    },
    "long_straddle": {
      "score": 0.25,
      "factors": ["vkospi_low_contra"]
    },
    "butterfly": {
      "score": 0.61,
      "factors": ["gex_positive", "pinning_probability"]
    },
    "bull_call_spread": {
      "score": 0.55,
      "factors": ["pcr_fear_contrarian", "delta_positive"]
    }
  },

  "greeks_surface": {
    "strikes": [370.0, 372.5, 375.0, 377.5, 380.0, 382.5, 385.0, 387.5, 390.0],
    "expiries": ["2026-04-10", "2026-05-14", "2026-06-11"],
    "iv_matrix": [[...], [...], [...]],       // strike × expiry
    "delta_matrix": [[...], [...], [...]],
    "gamma_matrix": [[...], [...], [...]]
  },

  "metadata": {
    "computed_at": "2026-04-04T15:45:00+09:00",
    "data_source": "krx_derivatives",
    "model": "bsm_european"
  }
}
```

### 5.8 CheeseStock 매핑 테이블

옵션 분석 결과가 CheeseStock의 각 JS 모듈에 어떻게 연결되는지 정의한다.

```
┌─────────────────────────┬────────────────────┬─────────────────────────┐
│ 옵션 분석 메트릭        │ JS 모듈            │ 용도                    │
├─────────────────────────┼────────────────────┼─────────────────────────┤
│ vkospi.regime           │ appWorker.js       │ macroConfidence 산출    │
│                         │ (derivativesTier)  │ 4-tier 레짐 분류       │
├─────────────────────────┼────────────────────┼─────────────────────────┤
│ vkospi.current          │ appState.js        │ _macroLatest.vkospi    │
│                         │                    │ 전역 상태 저장          │
├─────────────────────────┼────────────────────┼─────────────────────────┤
│ pcr.signal              │ appWorker.js       │ derivativesTier 1-2    │
│ pcr.contrarian_direction│ signalEngine.js    │ PCR 역발상 신호         │
├─────────────────────────┼────────────────────┼─────────────────────────┤
│ gex.regime              │ appWorker.js       │ 패턴 신뢰도 조정       │
│ gex.flip_level          │ patternRenderer.js │ 구조적 지지/저항선 표시 │
├─────────────────────────┼────────────────────┼─────────────────────────┤
│ straddle_implied_move   │ appUI.js           │ 예상 이동폭 HUD 표시   │
│ sim_pct                 │ chart.js           │ 이동 범위 밴드 오버레이 │
├─────────────────────────┼────────────────────┼─────────────────────────┤
│ strategy_signals.*      │ appWorker.js       │ 전략 추천 패널 (미래)  │
│                         │ patternPanel.js    │ 전략 적합도 점수 표시   │
├─────────────────────────┼────────────────────┼─────────────────────────┤
│ greeks_surface          │ chart.js           │ IV 곡면 3D 시각화      │
│                         │ (향후 sub-chart)   │ Greeks 히트맵           │
├─────────────────────────┼────────────────────┼─────────────────────────┤
│ iv_matrix               │ indicators.js      │ IV 곡면 보간 캐시      │
│                         │ IndicatorCache     │ BSM 역산 결과 재사용    │
└─────────────────────────┴────────────────────┴─────────────────────────┘

데이터 흐름:
  compute_options_analytics.py (오프라인)
    → data/derivatives/options_analytics_{date}.json
    → dataService.getDerivativesData() (api.js)
    → appWorker.js _loadMarketData() (Worker 또는 메인 스레드)
    → 각 모듈로 분배

갱신 주기:
  일별 1회 (장 마감 후 16:00 KST)
  → KRX 옵션 데이터 공시 후 산출
  → VKOSPI 실시간은 별도 WebSocket 경로 (향후)
```

### 5.9 전략 선택 통합 스코어카드

모든 신호를 종합하여 각 전략의 적합도를 점수화하는 체계이다.

```
전략 적합도 스코어카드 (Strategy Fitness Scorecard):

  입력 변수:
    V = VKOSPI percentile (0-100)
    P = PCR signal (-1=extreme_greed, 0=neutral, +1=extreme_fear)
    G = GEX sign (+1=positive, -1=negative)
    R = VRP sign (+1=positive, -1=negative, 0=neutral)
    S = Skew steepness (z-score, Doc 37 §4)

  전략별 스코어 함수:

    Short Straddle:
      score = 0.30·norm(V, 60, 20) + 0.25·(G>0 ? 1:0) + 0.25·(R>0 ? 1:0)
            + 0.10·|P| + 0.10·(1-|S|/3)
      → VKOSPI 높고, GEX 양수, VRP 양수일 때 최고

    Iron Condor:
      score = 0.25·norm(V, 50, 25) + 0.30·(G>0 ? 1:0) + 0.20·(R>0 ? 1:0)
            + 0.15·(|P|<0.5 ? 1:0) + 0.10·(1-|S|/3)
      → GEX 양수, PCR 중립, 적당한 VKOSPI일 때 최고

    Long Straddle:
      score = 0.30·norm(V, 20, 15) + 0.25·(G<0 ? 1:0) + 0.25·(R<0 ? 1:0)
            + 0.10·(1-|P|) + 0.10·(|S|/3)
      → VKOSPI 낮고, GEX 음수, VRP 음수일 때 최고

    Butterfly:
      score = 0.20·norm(V, 40, 20) + 0.35·(G>0 ? 1:0) + 0.15·(R>0 ? 1:0)
            + 0.15·(|P|<0.5 ? 1:0) + 0.15·(1-|S|/3)
      → GEX 양수(핀닝) 환경에서 지배적

    Bull Call Spread:
      score = 0.20·norm(V, 40, 25) + 0.15·(G ? 0.5:0.5)
            + 0.30·max(P, 0) + 0.20·(R>0 ? 1:0) + 0.15·(S>0 ? 0.5+S/6:0.5)
      → PCR 공포(역발상 매수) + 양의 VRP일 때 최고

  norm(x, μ, σ) = exp(-(x-μ)²/(2σ²))  — 정규분포 커널

  스코어 해석:
    > 0.70: 강한 추천  (Strong)
    0.50-0.70: 보통 추천 (Moderate)
    0.30-0.50: 약한 추천 (Weak)
    < 0.30: 비추천     (Avoid)

  Tier 분류: [C][L:GCV] — 가중치와 커널 파라미터는 KRX 경험적 추정,
  워크포워드 교차검증(GCV)으로 최적화 대상
```

---

## 부록 A. 전략 페이오프 연습 문제

KRX KOSPI200 옵션 (2026년 4월 만기, 기초자산 380.0)을 가정한다.

```
문제 1: Bull Call Spread
  Long Call 377.5 @ 5.2p, Short Call 382.5 @ 2.8p
  (a) net_debit = ?
  (b) BEP = ?
  (c) 최대 이익 = ?  최대 손실 = ?
  (d) Risk:Reward = ?

  풀이:
  (a) net_debit = 5.2 - 2.8 = 2.4p = 600,000원 (일반)
  (b) BEP = 377.5 + 2.4 = 379.9
  (c) 최대 이익 = (382.5 - 377.5) - 2.4 = 2.6p = 650,000원
      최대 손실 = 2.4p = 600,000원
  (d) R:R = 2.6/2.4 = 1.08:1

문제 2: Iron Condor
  Bull Put: Long Put 370.0 @ 1.5p, Short Put 375.0 @ 3.0p
  Bear Call: Short Call 385.0 @ 2.5p, Long Call 390.0 @ 0.8p
  (a) net_credit = ?
  (b) 최대 이익 구간 = ?
  (c) BEP (양쪽) = ?
  (d) 최대 손실 = ?

  풀이:
  (a) net_credit = (3.0 - 1.5) + (2.5 - 0.8) = 1.5 + 1.7 = 3.2p
  (b) 최대 이익 구간: 375.0 ≤ S_T ≤ 385.0 → 이익 = 3.2p = 800,000원
  (c) 하방 BEP = 375.0 - 3.2 = 371.8
      상방 BEP = 385.0 + 3.2 = 388.2
  (d) 최대 손실 = 5.0 - 3.2 = 1.8p = 450,000원 (한 쪽만 관통 시)

문제 3: Straddle Implied Move
  ATM Straddle (380.0) = 11.5p
  (a) SIM = ?
  (b) 암묵적 연율화 IV = ? (T = 22 영업일)
  (c) 역사적 평균 월간 이동 = 3.5%일 때, 매수 vs 매도 판단은?

  풀이:
  (a) SIM = 11.5 / 380.0 × 100 = 3.03%
  (b) T = 22/252 = 0.0873
      σ = 3.03 / (0.7979 × √0.0873 × 100) = 3.03 / 23.57 = 12.85% (연율화)
  (c) SIM/Historical = 3.03/3.50 = 0.866 < 1.0
      → 시장이 이동폭을 과소 가격 → Long Straddle 유리
      (0.8 < 0.866 < 1.0: 약한 매수 신호)
```

---

## 부록 B. 전략 Greeks 수치 예

KOSPI200 = 380, σ = 15%, r = 3.5%, T = 30/365, q = 2.0%

```
BSM Greeks (Doc 26 §1.2 공식 적용):

  Call(380): C = 7.12p, Δ = 0.512, Γ = 0.0367, Θ = -0.0391, ν = 0.454
  Put(380):  P = 6.70p, Δ = -0.488, Γ = 0.0367, Θ = -0.0358, ν = 0.454

  Call(377.5): C = 8.52p, Δ = 0.575, Γ = 0.0356, Θ = -0.0395, ν = 0.451
  Put(377.5):  P = 5.60p, Δ = -0.425, Γ = 0.0356, Θ = -0.0345, ν = 0.451

  Call(382.5): C = 5.88p, Δ = 0.448, Γ = 0.0372, Θ = -0.0383, ν = 0.453
  Put(382.5):  P = 7.96p, Δ = -0.552, Γ = 0.0372, Θ = -0.0367, ν = 0.453

전략별 Greeks:

  Long Straddle(380):
    Δ = 0.512 + (-0.488) = +0.024 (≈ 0)
    Γ = 0.0367 + 0.0367 = 0.0734
    Θ = (-0.0391) + (-0.0358) = -0.0749 p/일 = -18,725원/일 (일반)
    ν = 0.454 + 0.454 = 0.908 p/%
    비용 = 7.12 + 6.70 = 13.82p = 3,455,000원 (일반)
    BEP: 380 ± 13.82 → [366.18, 393.82]

  Bull Call Spread(377.5, 382.5):
    Δ = 0.575 - 0.448 = +0.127
    Γ = 0.0356 - 0.0372 = -0.0016 (≈ 0)
    Θ = (-0.0395) - (-0.0383) = -0.0012 p/일 = -300원/일
    ν = 0.451 - 0.453 = -0.002 p/% (≈ 0)
    비용 = 8.52 - 5.88 = 2.64p = 660,000원

  Butterfly(375, 380, 385):
    (Call375 = 10.10p, Call385 = 4.50p 가정)
    Δ = Δ(375) - 2×Δ(380) + Δ(385) ≈ 0.64 - 2×0.512 + 0.38 = -0.004
    Γ = Γ(375) - 2×Γ(380) + Γ(385) ≈ 0.034 - 0.0734 + 0.035 = -0.004
    Θ ≈ +0.003 p/일 (양의 세타)
    ν ≈ -0.01 p/% (음의 베가)
    비용 = 10.10 - 2×7.12 + 4.50 = 0.36p = 90,000원
    최대 이익: 5.0 - 0.36 = 4.64p = 1,160,000원
    R:R = 4.64/0.36 = 12.9:1

  ※ 수치는 BSM 가정 하의 이론값. 실시장에서는 IV skew(Doc 37),
    B/A 스프레드, 유동성에 따라 ±5-15% 괴리 가능.
```

---

## 부록 C. 핵심 공식 요약표

```
┌──────────────────────┬────────────────────────────────────────────┐
│ 개념                 │ 핵심 공식                                  │
├──────────────────────┼────────────────────────────────────────────┤
│ Long Call Payoff     │ max(S_T - K, 0) - C                       │
│ Long Put Payoff      │ max(K - S_T, 0) - P                       │
│ Straddle Payoff      │ |S_T - K| - (C + P)                       │
│ Straddle BEP         │ K ± (C + P)                               │
│ Bull Spread Payoff   │ max(S_T-K₁,0) - max(S_T-K₂,0) - nd      │
│ Butterfly Payoff     │ max(S_T-K₁,0)-2max(S_T-K₂,0)+max(S_T-K₃,0)-nd│
│ Iron Condor Credit   │ P(K₂)+C(K₃)-P(K₁)-C(K₄)                 │
│ Gamma Scalp P/L      │ 0.5·Γ·(ΔS)² - Θ·Δt                      │
│ Expected Gamma P/L   │ 0.5·Γ·S²·(σ²_R - σ²_I)·dt               │
│ Variance Swap Payoff │ (σ²_realized - K_var) × Notional          │
│ SIM                  │ ATM_Straddle / S × 100 (%)                │
│ SIM → IV             │ σ ≈ SIM / (0.7979 × √T × 100)            │
│ Calendar Theta       │ Θ_short(T₁) - Θ_long(T₂) > 0             │
│ Portfolio Greek      │ Σ(wᵢ × Greekᵢ)                            │
└──────────────────────┴────────────────────────────────────────────┘
```

---

## 참고문헌

```
[1]  Natenberg, S. (2015). Option Volatility and Pricing: Advanced Trading
     Strategies and Techniques. 2nd ed. McGraw-Hill.
[2]  Sinclair, E. (2013). Volatility Trading. 2nd ed. Wiley.
[3]  Hull, J.C. (2021). Options, Futures, and Other Derivatives. 11th ed. Pearson.
[4]  Taleb, N.N. (1997). Dynamic Hedging: Managing Vanilla and Exotic Options. Wiley.
[5]  Gatheral, J. (2006). The Volatility Surface: A Practitioner's Guide. Wiley.
[6]  Bittman, J. (2009). Trading Options as a Professional. McGraw-Hill.
[7]  Derman, E. & Miller, M.B. (2016). The Volatility Smile. Wiley.
[8]  Bennett, C. (2014). Trading Volatility. Independently published.
[9]  Brenner, M. & Subrahmanyam, M.G. (1988). A simple formula to compute
     the implied standard deviation. Financial Analysts Journal, 44(5), 80-83.
[10] Demeterfi, K., Derman, E., Kamal, M. & Zou, J. (1999). More than you
     ever wanted to know about volatility swaps. Goldman Sachs QS Notes.
[11] Carr, P. & Wu, L. (2009). Variance risk premiums. Review of Financial
     Studies, 22(3), 1311-1341.
[12] Zakamouline, V. & Koekebakker, S. (2009). Portfolio performance evaluation
     with generalized Sharpe ratios. Journal of Banking & Finance, 33(7), 1242-1254.
[13] Bollerslev, T., Tauchen, G. & Zhou, H. (2009). Expected stock returns and
     variance risk premia. Review of Financial Studies, 22(11), 4463-4492.
[14] Bekaert, G. & Hoerova, M. (2014). The VIX, the variance premium and stock
     market volatility. Journal of Econometrics, 183(2), 181-192.
[15] Black, F. & Scholes, M. (1973). The pricing of options and corporate liabilities.
     Journal of Political Economy, 81(3), 637-654.
[16] Cox, J.C., Ross, S.A. & Rubinstein, M. (1979). Option pricing: A simplified
     approach. Journal of Financial Economics, 7(3), 229-263.
[17] 한국거래소 (2026). KOSPI200 옵션 상품설명서. KRX.
[18] 한국거래소 (2026). 파생상품 증거금 규정. KRX.
```

---

> **문서 이력**
> - 2026-04-04: 초판 작성 (Doc 46)
> - 전략 페이오프, Greeks 동역학, 변동성 매매, KRX 실전 적용
> - 교차 참조: Doc 26 (Greeks, PCR, GEX), Doc 34 (VRP), Doc 37 (IV 곡면), Doc 45 (가격결정)
