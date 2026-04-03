# Doc 47: 신용위험 모형 — 구조적·축약형·포트폴리오 모형의 이론과 KRX 적용

# Credit Risk Models — Structural, Reduced-Form & Portfolio Models

> "The key insight of the Merton model is that equity is a call option on
> the firm's assets. This single idea unified corporate finance, option
> pricing, and credit risk into a single framework."
> -- Robert C. Merton, Nobel Lecture, *American Economic Review* (1998)

> "신용위험은 금융의 가장 오래된 문제이다. 돈을 빌려준 순간부터
> 인류는 상대방이 갚지 못할 가능성과 싸워왔다."
> -- Darrell Duffie, *Credit Risk Modeling with Affine Processes*,
>    Stanford GSB Working Paper (2003)

---

## 1. 개요

### 1.1 문서의 위치와 목적

본 문서는 CheeseStock 코어 이론 체계에서 **신용위험(credit risk) 모형의
수학적 기초**를 다룬다. Doc 35가 채권시장 신호 체계(NSS, 크레딧 스프레드 레짐,
DD 경고 시그널)에 집중했다면, 본 문서는 그 **이론적 토대**를 구축한다.

본 문서가 답하는 7가지 질문:

```
Q1. Merton (1974) 모형의 완전한 수학적 도출은?        → §2 Merton 구조적 모형
Q2. KMV는 Merton을 어떻게 확장했는가?                → §3 KMV 확장
Q3. 부도를 외생적 사건으로 모형화하면?                 → §4 축약형 모형
Q4. 신용스프레드는 어떤 요소로 분해되는가?             → §5 스프레드 분해
Q5. CDS와 채권 스프레드의 관계는?                     → §6 CDS-Bond Basis
Q6. 신용 포트폴리오의 손실분포는?                     → §7 포트폴리오 모형
Q7. KRX에 어떻게 적용하는가?                         → §8 KRX 적용
```

### 1.2 기존 문서와의 관계

| 주제 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| DD 개략적 소개, 시그널 로직 | Doc 35 §6 | 완전한 수학적 도출, Newton-Raphson 반복법 상세 |
| 크레딧 스프레드 레짐 4분류 | Doc 35 §5 | 스프레드 **구성요인** 이론 (PD, LGD, 유동성 등) |
| CAPM beta 추정 | Doc 25 §1.2 | DD는 비체계적 위험, beta는 체계적 위험 — 독립 |
| BSM 옵션 가격결정 | Doc 05 §5, Doc 45 | Merton 모형은 BSM의 기업부채 적용 |
| MM 정리, 자본구조 | Doc 43 §1-2 | 부채비율→DD 투입, 레버리지→자산변동성 관계 |
| 채권 가격결정 기초 | Doc 44 §2-6 | risky debt 가격결정 (무위험 → 신용위험 확장) |
| 채권-주식 상대가치 | Doc 41 §5 | 크레딧 사이클과 EBP의 이론적 기초 |
| 재무제표 분석 | Doc 14 §2 | DART 부채 항목→DD 투입 매핑 |

```
관계도:

Doc 44 (채권 가격 기초)
  └── 무위험 채권 가격 = FV·e^(-rT)
        ↓
Doc 47 (본 문서)
  ├── §2-3: Merton/KMV → risky debt 가격 = 무위험 - 풋옵션
  ├── §4: 축약형 → λ(t) 기반 부도 가격결정
  ├── §5: 스프레드 분해 → PD·LGD + 유동성 + 세금
  ├── §6: CDS-Bond basis → no-arbitrage 이탈
  └── §7: 포트폴리오 → Vasicek/Basel IRB
        ↓
Doc 35 §5-6 (시그널 로직)
  ├── creditRegime: AA- 스프레드 4단계 분류
  └── ddWarning: DD < 1.5 → 패턴 신뢰도 감쇠
```

**중복 방지 원칙:** Doc 35 §5의 크레딧 스프레드 **체제 분류 시그널** 로직과
Doc 35 §6의 DD **패턴 조정** 로직은 본 문서에서 재기술하지 않는다.
본 문서는 순수하게 이론적·수학적 기초를 다루며, 시그널 구현 매핑은
"→ Doc 35 §X 참조" 형태로만 포인터를 제공한다.

### 1.3 핵심 주장 요약

```
1. 기업의 자기자본은 자산가치에 대한 콜옵션이다 (Merton 1974)
   → 부채는 무위험채권 - 풋옵션으로 분해된다
   → 이 하나의 통찰이 기업재무·옵션가격결정·신용위험을 통합

2. Distance-to-Default는 신용위험의 '충분통계량'이다
   → 자산가치, 부채수준, 변동성을 단일 숫자로 압축
   → KMV의 경험적 매핑(EDF)은 이론적 N(-DD)보다 정확

3. 축약형 모형은 구조적 모형의 대안이 아니라 보완이다
   → 구조적: 자산가치 기반 (장기), 축약형: 강도 기반 (단기)
   → 한국 시장에서는 CDS 유동성 부족으로 구조적 모형이 더 실용적

4. 신용스프레드는 기대손실만으로 설명되지 않는다
   → "credit spread puzzle": PD×LGD ≈ 스프레드의 25%
   → 유동성, 세금, 체계적 위험 프리미엄이 나머지 75%

5. 포트폴리오 신용위험은 상관관계가 핵심이다
   → Gaussian copula의 편의성과 위험성 (2008 CDO 위기)
   → Basel IRB의 Vasicek 단일팩터 모형이 규제 표준
```

### 1.4 참고문헌 개관

```
[1]  Merton, R.C. (1974). "On the Pricing of Corporate Debt: The Risk
     Structure of Interest Rates." Journal of Finance, 29(2), 449-470.
[2]  Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate
     Liabilities." Journal of Political Economy, 81(3), 637-654.
[3]  Crosbie, P. & Bohn, J. (2003). "Modeling Default Risk." Moody's KMV
     Technical Report.
[4]  Bharath, S. & Shumway, T. (2008). "Forecasting Default with the
     Merton Distance to Default Model." Review of Financial Studies,
     21(3), 1339-1369.
[5]  Jarrow, R. & Turnbull, S. (1995). "Pricing Derivatives on Financial
     Securities Subject to Credit Risk." Journal of Finance, 50(1), 53-85.
[6]  Duffie, D. & Singleton, K. (1999). "Modeling Term Structures of
     Defaultable Bonds." Review of Financial Studies, 12(4), 687-720.
[7]  Elton, E., Gruber, M., Agrawal, D. & Mann, C. (2001). "Explaining
     the Rate Spread on Corporate Bonds." Journal of Finance, 56(1),
     247-277.
[8]  Longstaff, F., Mithal, S. & Neis, E. (2005). "Corporate Yield
     Spreads: Default Risk or Liquidity? New Evidence from the Credit
     Default Swap Market." Journal of Finance, 60(5), 2213-2253.
[9]  Collin-Dufresne, P., Goldstein, R. & Martin, J. (2001). "The
     Determinants of Credit Spread Changes." Journal of Finance, 56(6),
     2177-2207.
[10] Vasicek, O. (2002). "The Distribution of Loan Portfolio Value."
     Risk, 15(12), 160-162. (Originally circulated as KMV working
     paper, 1987)
[11] Li, D.X. (2000). "On Default Correlation: A Copula Function Approach."
     Journal of Fixed Income, 9(4), 43-54.
[12] Basel Committee on Banking Supervision (2006). "International
     Convergence of Capital Measurement and Capital Standards."
     Bank for International Settlements.
[13] Duffie, D. (1999). "Credit Swap Valuation." Financial Analysts
     Journal, 55(1), 73-87.
[14] Leland, H. & Toft, K. (1996). "Optimal Capital Structure,
     Endogenous Bankruptcy, and the Term Structure of Credit Spreads."
     Journal of Finance, 51(3), 987-1019.
[15] Hull, J.C. (2018). Options, Futures, and Other Derivatives, 10th
     Edition. Pearson. Ch. 24 (Credit Risk).
[16] Duffie, D. & Lando, D. (2001). "Term Structures of Credit Spreads
     with Incomplete Accounting Information." Econometrica, 69(3),
     633-664.
[17] Gilchrist, S. & Zakrajsek, E. (2012). "Credit Spreads and Business
     Cycle Fluctuations." American Economic Review, 102(4), 1692-1720.
[18] 한국신용평가 (KIS) (2024). 『2024 부도율 연감 (Annual Default Study)』.
[19] 한국은행 (2019). 『채권시장론』. 한국은행 금융시장국.
[20] 금융감독원 (2024). DART 전자공시시스템 API 명세서.
```

---

## 2. Merton 구조적 모형 (1974)

### 2.1 기본 아이디어

Merton (1974)은 기업의 자본구조(capital structure)를 옵션이론으로 재해석한
최초의 모형이다. 핵심 통찰은 다음과 같다.

```
핵심 통찰: 기업 자산 = 자기자본(콜옵션) + 부채(채권 - 풋옵션)

직관:
  - 기업은 자산(V)을 소유하고, 부채(F)를 빚지고 있다
  - 만기일(T)에 자산가치 V_T가 부채 F보다 크면:
    → 주주는 V_T - F를 가져감 (콜옵션 행사)
  - 자산가치 V_T가 부채 F보다 작으면:
    → 주주는 유한책임(limited liability)으로 0을 받음 (콜옵션 포기)
    → 채권자는 V_T만 회수 (F - V_T 만큼 손실)

따라서:
  자기자본(E) = max(V_T - F, 0) = 자산(V)에 대한 콜옵션 (행사가 F)
  부채(D)     = V - E = F·e^(-rT) - max(F - V_T, 0)
              = 무위험채권 - 풋옵션
```

이 관계를 그림으로 표현하면:

```
수익 (Payoff at T)
  │
  │         ╱ E = max(V_T - F, 0)   ← 주주 수익 (콜옵션)
  │       ╱
  │     ╱
  │   ╱
  │ ╱
──┼───────────── V_T (자산가치)
  │ F
  │
  │  D = min(V_T, F)                 ← 채권자 수익
  │  ─────────────
  │ ╱
  │╱
```

### 2.2 가정

Merton 모형의 가정은 다음과 같다:

```
가정 (Merton 1974):

A1. 자산가치 V는 기하브라운운동(GBM)을 따른다
A2. 기업은 단일 만기(T)의 무쿠폰 부채(zero-coupon debt)만 발행
A3. 부도는 만기일(T)에만 발생 (중간 부도 불가)
A4. 무위험이자율 r은 상수
A5. 시장은 마찰 없음 (거래비용, 세금, 공매도 제한 없음)
A6. 자산가치 V는 연속적으로 거래 가능 (완전시장)
A7. Modigliani-Miller 정리 성립: V는 자본구조에 독립
```

### 2.3 자산가치 동학

기업 자산가치 V의 확률과정:

```
Eq. (2.1)  dV = μ_V · V · dt + σ_V · V · dW

where:
  V    = 기업 자산가치 (firm asset value)
  μ_V  = 자산의 기대수익률 (expected return on assets)
  σ_V  = 자산의 변동성 (asset volatility)
  W    = 표준 위너 과정 (standard Wiener process)
```

이 확률미분방정식(SDE)의 해:

```
Eq. (2.2)  V_T = V_0 · exp[(μ_V - σ_V²/2)·T + σ_V·√T·Z]

where:
  Z ~ N(0,1)  (표준정규 확률변수)
  V_0 = 현재 시점(t=0)의 자산가치
```

따라서 ln(V_T)는 정규분포를 따른다:

```
Eq. (2.3)  ln(V_T) ~ N(ln(V_0) + (μ_V - σ_V²/2)·T,  σ_V²·T)
```

### 2.4 자기자본의 옵션 가치

자기자본 E의 만기 수익(payoff):

```
E_T = max(V_T - F, 0)
```

이것은 기초자산 V, 행사가 F인 유럽형 콜옵션이다.
Black-Scholes-Merton 공식을 적용하면:

```
Eq. (2.4)  E = V · N(d₁) - F · e^(-rT) · N(d₂)

where:
  d₁ = [ln(V/F) + (r + σ_V²/2) · T] / (σ_V · √T)    ...(2.5)
  d₂ = d₁ - σ_V · √T                                   ...(2.6)

  E   = 자기자본 시장가치 (= 시가총액, market cap)
  V   = 기업 자산가치 (관측 불가)
  F   = 부채 액면가 (face value of debt)
  r   = 무위험이자율
  T   = 부채 만기까지의 시간
  σ_V = 자산 변동성
  N(·)= 표준정규 누적분포함수
```

**수치 예시: 삼성전자**

```
가정 (2026년 3월 기준, 추정치):
  V   = 500조원 (시가총액 + 부채)
  F   = 100조원 (부채 총계)
  r   = 3.0% (KTB 3Y)
  T   = 1년
  σ_V = 25% (연율화 자산변동성)

d₁ = [ln(500/100) + (0.03 + 0.25²/2) · 1] / (0.25 · √1)
   = [1.6094 + 0.0613] / 0.25
   = 6.6828

d₂ = 6.6828 - 0.25 = 6.4328

N(d₁) ≈ 1.0000  (d₁이 매우 큼)
N(d₂) ≈ 1.0000

E = 500 · 1.0000 - 100 · e^(-0.03) · 1.0000
  = 500 - 97.04
  = 402.96조원

→ 삼성전자 시가총액 ≈ 400조원과 근사
→ DD가 6.68로 매우 높아 부도 확률 사실상 0
```

### 2.5 Risky Debt(위험채권)의 가격

기업 부채 D의 만기 수익:

```
D_T = min(V_T, F) = F - max(F - V_T, 0)
    = 무위험 채권 원금(F) - 풋옵션
```

따라서 risky debt의 현재 가치:

```
Eq. (2.7)  D = F · e^(-rT) - P_put

where:
  P_put = F · e^(-rT) · N(-d₂) - V · N(-d₁)    ...(BSM 풋옵션)
```

정리하면:

```
Eq. (2.8)  D = F · e^(-rT) · [N(d₂) + (V/F) · e^(rT) · N(-d₁)]

또는 동치 형태:
Eq. (2.9)  D = V · N(-d₁) + F · e^(-rT) · N(d₂)
```

**신용스프레드 도출:**

risky debt의 수익률 y_D를 다음으로 정의한다:

```
D = F · e^(-y_D · T)
```

따라서 신용스프레드(credit spread) s:

```
Eq. (2.10)  s = y_D - r = -(1/T) · ln(D / (F · e^(-rT)))

         = -(1/T) · ln[N(d₂) + (V/F) · e^(rT) · N(-d₁)]
```

**수치 예시: 신용스프레드 계산**

```
한진해운 유사 가상 기업 (고위험):
  V   = 5조원
  F   = 4조원
  r   = 3.0%
  T   = 1년
  σ_V = 40%

d₁ = [ln(5/4) + (0.03 + 0.16/2) · 1] / (0.40 · 1)
   = [0.2231 + 0.1100] / 0.40
   = 0.8328

d₂ = 0.8328 - 0.40 = 0.4328

N(d₂)  = 0.6674
N(-d₁) = 1 - N(0.8328) = 1 - 0.7975 = 0.2025

D = 5 · 0.2025 + 4 · e^(-0.03) · 0.6674
  = 1.0125 + 4 · 0.9704 · 0.6674
  = 1.0125 + 2.5904
  = 3.6029조원

s = -(1/1) · ln(3.6029 / (4 · 0.9704))
  = -ln(3.6029 / 3.8816)
  = -ln(0.9282)
  = 0.0745 = 7.45%

→ 신용스프레드 7.45%p: 투기등급(BB 이하) 수준
→ 레버리지(V/F = 1.25)와 높은 변동성(40%)이 주원인
```

### 2.6 Distance-to-Default (DD)

DD는 기업 자산가치가 부도 경계(default point)로부터 몇 표준편차
떨어져 있는지를 측정하는 단일 지표이다.

```
Eq. (2.11)  DD = [ln(V/F) + (μ_V - σ_V²/2) · T] / (σ_V · √T)
```

물리적 확률 측도(P-measure)에서의 부도 확률:

```
Eq. (2.12)  PD_physical = N(-DD)

해석:
  DD = 3.0 → PD = N(-3.0) = 0.135% (1,000개 중 ~1개 부도)
  DD = 2.0 → PD = N(-2.0) = 2.28%  (100개 중 ~2개 부도)
  DD = 1.0 → PD = N(-1.0) = 15.87% (6~7개 중 ~1개 부도)
  DD = 0.5 → PD = N(-0.5) = 30.85% (3개 중 ~1개 부도)
```

**DD와 d₂의 관계:**

```
d₂(위험중립) = [ln(V/F) + (r - σ_V²/2) · T] / (σ_V · √T)
DD(물리적)   = [ln(V/F) + (μ_V - σ_V²/2) · T] / (σ_V · √T)

차이: DD - d₂ = (μ_V - r) · T / (σ_V · √T) = (μ_V - r)·√T / σ_V

→ 위험중립 PD: N(-d₂) > N(-DD) = 물리적 PD
→ 위험중립 PD가 더 큼: 시장위험프리미엄(μ_V - r > 0) 반영
```

### 2.7 자산가치·변동성 동시추정 (V, σ_V) 반복법

Merton 모형의 실무적 핵심 난제는 자산가치 V와 자산변동성 σ_V가
직접 관측 불가능하다는 것이다. 관측 가능한 것은 자기자본(시가총액) E와
주가변동성 σ_E뿐이다. 두 연립방정식을 풀어야 한다.

**연립방정식:**

```
Eq. (2.13)  E = V · N(d₁) - F · e^(-rT) · N(d₂)       (주식 = 콜옵션)
Eq. (2.14)  σ_E = (V/E) · N(d₁) · σ_V                  (Ito의 보조정리)
```

Eq. (2.14)는 Ito의 보조정리(Ito's Lemma)에서 도출된다:

```
도출:
  E = f(V, t) where f는 BSM 콜옵션 가치

  dE = (∂E/∂V)·dV + ... (dt 항 + 2차 항)

  σ_E·E = (∂E/∂V) · σ_V · V   (확산 계수 비교)

  ∂E/∂V = N(d₁)   (콜옵션의 델타)

  ∴ σ_E · E = N(d₁) · σ_V · V

  ∴ σ_E = (V/E) · N(d₁) · σ_V    ...Eq. (2.14)
```

**Newton-Raphson 반복법:**

```
알고리즘: (V, σ_V) 동시 추정

입력:
  E     = 시가총액 (관측)
  σ_E   = 주가 변동성, 연율화 (관측)
  F     = 부채 액면가 (DART 재무제표)
  r     = 무위험이자율 (KTB 3Y)
  T     = 시간 수평 (1년)
  tol   = 수렴 허용오차 (1e-6)
  maxIter = 최대 반복 횟수 (100)

초기값:
  V⁰ = E + F                              (장부가 기준 총자산)
  σ_V⁰ = σ_E · E / (E + F)               (레버리지 조정)

반복 (k = 0, 1, 2, ...):

  Step 1: 현재 (Vᵏ, σ_Vᵏ)로 d₁, d₂ 계산
    d₁ᵏ = [ln(Vᵏ/F) + (r + (σ_Vᵏ)²/2)·T] / (σ_Vᵏ·√T)
    d₂ᵏ = d₁ᵏ - σ_Vᵏ·√T

  Step 2: 잔차(residuals) 계산
    f₁(Vᵏ, σ_Vᵏ) = Vᵏ·N(d₁ᵏ) - F·e^(-rT)·N(d₂ᵏ) - E       = 0?
    f₂(Vᵏ, σ_Vᵏ) = (Vᵏ/E)·N(d₁ᵏ)·σ_Vᵏ - σ_E               = 0?

  Step 3: 야코비안 행렬(Jacobian) 계산
    J = [ ∂f₁/∂V   ∂f₁/∂σ_V ]
        [ ∂f₂/∂V   ∂f₂/∂σ_V ]

    ∂f₁/∂V   = N(d₁ᵏ)
    ∂f₁/∂σ_V = Vᵏ · n(d₁ᵏ) · √T     (n = 표준정규 밀도함수)
    ∂f₂/∂V   = N(d₁ᵏ) · σ_Vᵏ / E
    ∂f₂/∂σ_V = Vᵏ · N(d₁ᵏ) / E + Vᵏ · n(d₁ᵏ) · (∂d₁/∂σ_V) · σ_Vᵏ / E

  Step 4: Newton-Raphson 업데이트
    [ΔV   ]     -1   [f₁]
    [Δσ_V ] = -J   · [f₂]

    Vᵏ⁺¹   = Vᵏ + ΔV
    σ_Vᵏ⁺¹ = σ_Vᵏ + Δσ_V

  Step 5: 수렴 판정
    if |f₁| < tol AND |f₂| < tol:
      → 수렴. 최종 (V*, σ_V*) 반환
    if k > maxIter:
      → 미수렴. 간편법(Bharath-Shumway) 사용

반환: V*, σ_V*, DD, PD
```

**야코비안의 편미분 상세:**

```
n(x) = (1/√(2π)) · exp(-x²/2)   (표준정규 밀도함수)

∂d₁/∂V   = 1 / (V · σ_V · √T)
∂d₁/∂σ_V = [-ln(V/F) + (r - σ_V²/2)·T] / (σ_V² · √T)
          = -(d₂) / σ_V     (간편 형태)

∂f₁/∂V   = N(d₁) + V · n(d₁) · ∂d₁/∂V - F·e^(-rT) · n(d₂) · ∂d₁/∂V
          = N(d₁)            (∵ V·n(d₁)·(∂d₁/∂V) = F·e^(-rT)·n(d₂)·(∂d₁/∂V))
            ← BSM 콜옵션 델타의 성질

∂f₁/∂σ_V = V · n(d₁) · (∂d₁/∂σ_V) - F·e^(-rT) · n(d₂) · (∂d₂/∂σ_V)
          = V · n(d₁) · √T   (BSM vega)
```

### 2.8 Bharath-Shumway (2008) 간편법

반복법이 수렴하지 않거나 계산 리소스가 제한된 경우, Bharath & Shumway
(2008)의 간편 추정법("naive" estimator)을 사용할 수 있다.

```
Eq. (2.15)  σ_V ≈ σ_E · [E/(E+F)] + 0.05 · [F/(E+F)]

Eq. (2.16)  V ≈ E + F

Eq. (2.17)  DD_naive = [ln(V/F) + (μ_V - σ_V²/2)·T] / (σ_V · √T)

where:
  μ_V = 전년도 주식 수익률 (실무적 근사)
  또는 μ_V = r + λ·σ_V (시장가격 of risk 사용)
```

Bharath & Shumway (2008)의 실증 결과:

```
DD_naive vs DD_iterative:
  - 단면 상관계수: r > 0.90
  - 부도 예측력(AUC): DD_naive ≈ DD_iterative (통계적 차이 미미)
  - 결론: "the naïve DD is as good as the iterative DD for
    predicting defaults"

→ 대규모 크로스섹션(2,700+ 종목) 스크리닝에 적합
→ 개별 종목 정밀 분석에는 반복법 권장
```

### 2.9 Merton 모형의 한계

```
한계 1: 단일 만기 부채 (Single Maturity)
  - 현실 기업은 다양한 만기의 부채를 보유
  - 해결: Leland & Toft (1996) — 연속적 부채 만기 구조
  - 해결: Geske (1977) — 복합 옵션(compound option) 접근

한계 2: 만기일에만 부도 (European-style Default)
  - 현실: 부도는 이자 미지급, 재무약정(covenant) 위반 등으로 수시 발생
  - 해결: Black & Cox (1976) — 최초 통과 시간(first passage time) 모형
    → V_t가 하방 경계 B(t)에 최초 도달하는 시점이 부도

한계 3: 상수 무위험이자율
  - 현실: 금리는 확률적으로 변동
  - 해결: Longstaff & Schwartz (1995) — 확률적 금리 + 자산 과정

한계 4: 자산가치 관측 불가
  - V는 직접 관측 불가능 → 추정 오차 불가피
  - 주가(E)로부터 역산하는 과정에서 순환논리(circularity) 발생 가능
  - 해결: Duffie & Lando (2001) — 불완전 정보 하의 구조적 모형

한계 5: 자산의 GBM 가정
  - 현실: 자산가치에 점프(jump)가 발생 (M&A, 소송, 규제 변경)
  - 해결: Zhou (2001) — jump-diffusion 구조적 모형
  - 점프를 포함하면 단기 스프레드가 0이 아닌 값을 가질 수 있음
    (Merton 원 모형에서는 T→0일 때 s→0인 문제가 있음)
```

---

## 3. KMV 확장 (Moody's KMV)

### 3.1 Merton에서 KMV로

KMV Corporation (현 Moody's Analytics)은 Merton 모형을 실무에
적용할 수 있도록 세 가지 핵심 수정을 가했다 (Crosbie & Bohn, 2003).

```
수정 1: Default Point 재정의
  Merton: F = 부채 액면 총액
  KMV:    DP = STD + 0.5 × LTD

  where:
    STD = Short-Term Debt (유동부채 중 차입금)
    LTD = Long-Term Debt (비유동 차입금)

  근거: 장기부채는 만기 전 상환 압력이 낮음
        단기부채 전액 + 장기부채 50%가 1년 내 상환 부담의 근사

수정 2: 자산변동성 추정 정밀화
  - Merton: 연립방정식 반복법
  - KMV: 주가 일별 수익률 → 반복법 + EWMA(지수가중이동평균) 결합
  - 더 안정적인 σ_V 추정을 위해 1-3년 데이터 사용

수정 3: EDF 경험적 매핑
  - Merton: PD = N(-DD) (이론적, 정규분포 가정)
  - KMV: EDF = 경험적 데이터베이스에서 DD → 실제 부도율 매핑
  - 비정규(fat tail) 분포를 경험적으로 반영
```

### 3.2 Expected Default Frequency (EDF)

EDF는 DD를 Moody's의 방대한 부도 데이터베이스(1970년대~현재,
수만 개 기업)와 매핑하여 산출한 부도확률이다.

```
이론적 PD vs 경험적 EDF:

┌──────────────────────────────────────────────────────────┐
│   DD   │  N(-DD)  (이론적) │  EDF (경험적) │  차이 요인    │
├──────────────────────────────────────────────────────────┤
│   4.0  │     0.003%        │   0.04%       │  fat tail    │
│   3.0  │     0.13%         │   0.35%       │  fat tail    │
│   2.0  │     2.28%         │   3.10%       │  fat tail    │
│   1.5  │     6.68%         │   8.50%       │  regime      │
│   1.0  │    15.87%         │  16.50%       │  수렴        │
│   0.5  │    30.85%         │  28.00%       │  표본 절단    │
│   0.0  │    50.00%         │  35.00%       │  표본 편향    │
└──────────────────────────────────────────────────────────┘

핵심 관찰:
  1. DD > 2에서 EDF >> N(-DD): 꼬리 위험이 정규분포보다 두꺼움
  2. DD < 1에서 EDF ≈ N(-DD): 부도 임박 시 수렴
  3. DD ≈ 0에서 EDF < N(-DD): 부도 직전 기업 중 일부는 회생/인수
```

EDF의 경험적 매핑 함수:

```
Eq. (3.1)  EDF = f(DD)

where f(·)는 비모수적(non-parametric) 매핑:
  - DD → 버킷(bucket) 분류 (예: DD ∈ [1.9, 2.1])
  - 해당 버킷에서의 1년 실제 부도율 = EDF

준모수적(semi-parametric) 근사:
  EDF ≈ 1 / (1 + exp(a + b·DD))   (로지스틱 함수)

  한국 데이터 기반 추정 (KIS 부도율 연감 2024 참조):
  a ≈ -3.5, b ≈ 1.8  (추정치, 정확한 값은 비공개)
```

### 3.3 DD의 통계적 속성

DD의 단면(cross-sectional) 분포와 신용등급과의 관계:

```
┌─────────────────────────────────────────────────────────────┐
│  신용등급  │  DD 중앙값  │  DD 범위 (10-90 pctl) │  EDF 중앙값  │
├─────────────────────────────────────────────────────────────┤
│  AAA      │   7.5      │   5.5 ~ 10.0+         │   0.01%     │
│  AA       │   5.5      │   4.0 ~ 8.0           │   0.03%     │
│  A        │   4.0      │   2.8 ~ 6.0           │   0.08%     │
│  BBB      │   2.8      │   1.8 ~ 4.5           │   0.30%     │
│  BB       │   1.8      │   1.0 ~ 3.0           │   1.50%     │
│  B        │   1.2      │   0.5 ~ 2.0           │   5.00%     │
│  CCC/C    │   0.5      │   -0.5 ~ 1.5          │  20.00%     │
└─────────────────────────────────────────────────────────────┘

출처: Crosbie & Bohn (2003), Moody's KMV 글로벌 데이터
주의: 한국 기업의 DD 분포는 글로벌 대비 약간 다를 수 있음
      (재벌 그룹 효과, 정부 지원 기대 등)
```

DD의 시간적 속성:

```
1. DD의 평균 회귀(mean reversion):
   - 자산가치 성장 + 부채 상환 → DD 상승 압력
   - 경기 하강 + 부채 증가 → DD 하락 압력
   - 반감기(half-life) ≈ 1-2년 (등급별 차이)

2. DD의 경기순환성:
   - 경기 확장기: DD 분포 우측 이동 (전반적 개선)
   - 경기 수축기: DD 분포 좌측 이동 + 좌측 꼬리 두꺼워짐
   - 좌측 꼬리의 두꺼워짐 → 부도 클러스터링(default clustering)

3. DD의 자기상관:
   - ACF(1) ≈ 0.95 (연간): 높은 지속성(persistence)
   - DD 변화(ΔDD)가 수준(DD)보다 새로운 정보를 담음
   - → ΔDD < -0.5 (3개월 기준): 신용 악화 가속 신호
     (→ Doc 35 §6.4 참조: 패턴 신뢰도 조정에 사용)
```

### 3.4 한국 적용: DART 재무제표 매핑

```
DART → KMV Default Point 매핑:

이상적 매핑 (세부 항목 가용 시):
  STD = 유동성장기부채 + 단기차입금 + 유동사채
  LTD = 비유동차입금 + 비유동사채
  DP = STD + 0.5 × LTD

실용적 매핑 (DART "부채총계"만 가용 시):
  부채총계 = 유동부채 + 비유동부채
  근사 1: DP ≈ 유동부채 + 0.5 × 비유동부채
  근사 2: DP ≈ 부채총계 × 0.75 (보수적)

한국 특수성:
  - DART 연결재무제표(CFS) 기준 사용 (별도(OFS) 대비 정확)
  - IFRS 적용 기업: 리스부채(lease liability) 포함 여부 확인
  - 금융업 제외: 은행/보험/증권은 부채=영업자산 → DD 적합도 매우 낮음
```

### 3.5 V 추정: 시가총액 + 부채 초기값

```
초기 추정:
  V₀ = E + D_book

  where:
    E = 시가총액 (data/index.json의 marketCap 또는 lastClose × 발행주식수)
    D_book = 부채 총계 (DART 재무제표)

한계:
  - D_book ≠ D_market: 부채의 시장가치는 장부가와 다를 수 있음
  - 특히 고위험 기업에서 D_market < D_book (할인 거래)
  - 그러나 한국 회사채 시장의 유동성 부족으로 D_market 관측 곤란
  - 실무적으로 V₀ = E + D_book을 초기값으로 사용하고
    반복법으로 정밀화하는 것이 표준 관행

σ_V 초기 추정:
  σ_V₀ = σ_E × E / (E + D_book)

  where:
    σ_E = 일별 수익률의 표준편차 × √252 (연율화)
    일별 수익률: r_t = ln(close_t / close_{t-1})
    관측 기간: 최근 1년 (252 거래일)
```

---

## 4. 축약형 모형 (Reduced-Form Models)

### 4.1 개요

축약형 모형은 구조적 모형과 근본적으로 다른 접근법을 취한다.

```
구조적 모형: "부도는 왜 발생하는가?"
  → 자산가치 < 부채 → 부도 (내생적, endogenous)

축약형 모형: "부도는 언제 발생하는가?"
  → 부도를 외생적 사건(exogenous event)으로 모형화
  → 부도 시점은 Poisson 과정(확률 과정)으로 도착
  → 자산가치를 관측할 필요 없음
```

### 4.2 Jarrow-Turnbull (1995)

Jarrow & Turnbull (1995)은 축약형 모형의 효시적 연구이다.

**부도 강도(Default Intensity):**

```
Eq. (4.1)  λ(t) = 부도 강도 (hazard rate, default intensity)

해석: 시점 t에서 dt 동안의 조건부 부도 확률
  P(t < τ ≤ t+dt | τ > t) = λ(t) · dt

where:
  τ = 부도 시점 (random stopping time)
  λ(t) ≥ 0
```

**생존확률(Survival Probability):**

```
Eq. (4.2)  Q(t, T) = P(τ > T | τ > t) = exp(-∫_t^T λ(s) ds)

상수 λ인 경우:
  Q(t, T) = e^(-λ(T-t))

예시: λ = 0.02 (연간 2% 부도 강도)
  1년 생존확률: Q = e^(-0.02) = 0.9802 (98.02%)
  5년 생존확률: Q = e^(-0.10) = 0.9048 (90.48%)
  10년 생존확률: Q = e^(-0.20) = 0.8187 (81.87%)
```

**부도 확률의 기간구조:**

```
Eq. (4.3)  PD(t, T) = 1 - Q(t, T) = 1 - exp(-∫_t^T λ(s) ds)

한계 부도 확률 (marginal default probability):
  f(s) = λ(s) · Q(t, s)
  해석: 시점 s에서 정확히 부도가 발생할 밀도
```

**부도채권(Defaultable Bond) 가격:**

```
Eq. (4.4)  D(t, T) = F · e^(-r(T-t)) · [Q(t,T) + (1 - Q(t,T)) · R]
                    = F · e^(-r(T-t)) · [Q + (1-Q) · R]

where:
  D(t,T) = 시점 t에서의 부도채권 가격
  F      = 액면가
  r      = 무위험이자율 (상수 가정)
  Q      = Q(t,T) = 생존확률
  R      = 회수율 (recovery rate, 부도 시 원금 대비 회수 비율)
  1-R    = LGD (Loss Given Default, 부도시 손실률)

해석:
  부도채권 가격 = 무위험채권 가격 × [생존 시 원금 + 부도 시 회수액]
```

**수치 예시:**

```
조건:
  F = 10,000원, r = 3%, T-t = 3년
  λ = 0.01 (연간 1% 부도 강도), R = 40%

Q = e^(-0.01×3) = 0.9704

D = 10,000 · e^(-0.03×3) · [0.9704 + (1-0.9704)·0.40]
  = 10,000 · 0.9139 · [0.9704 + 0.0119]
  = 10,000 · 0.9139 · 0.9822
  = 8,976원

무위험 채권: 10,000 · e^(-0.03×3) = 9,139원

신용할인: 9,139 - 8,976 = 163원 (1.78%)
→ 신용스프레드 ≈ 0.60%p (3년)
```

**신용스프레드 도출:**

```
Eq. (4.5)  s = -(1/(T-t)) · ln[Q + (1-Q)·R]

상수 λ인 경우:
  s ≈ λ · (1 - R)    (1차 근사, T-t가 작을 때)

예시:
  λ = 0.01, R = 0.40
  s ≈ 0.01 × 0.60 = 0.006 = 0.60%p

→ 직관: 스프레드 ≈ 부도 강도 × 손실률
→ 이 관계가 "credit triangle"로 불림
```

### 4.3 Duffie-Singleton (1999)

Duffie & Singleton (1999)은 Jarrow-Turnbull을 일반화하여
**할인조정법(adjusted short rate)**을 제안했다.

**핵심 아이디어:**

```
Eq. (4.6)  r̃(t) = r(t) + λ(t) · (1 - R(t))
                 = r(t) + λ(t) · LGD(t)

해석:
  부도채권을 평가할 때, 무위험이자율에 부도손실 요인을 더한
  "조정 할인율"로 할인하면 된다.
```

**부도채권 가격 (Duffie-Singleton):**

```
Eq. (4.7)  D(t, T) = E^Q[F · exp(-∫_t^T r̃(s) ds)]

상수 r, λ, R인 경우:
  D(t, T) = F · exp(-r̃ · (T-t))
           = F · exp(-(r + λ·LGD) · (T-t))
```

**JT vs DS 비교:**

```
Jarrow-Turnbull:
  D = F · e^(-rT) · [Q + (1-Q)·R]
  → 부도와 비부도 시나리오를 명시적으로 분리

Duffie-Singleton:
  D = F · e^(-r̃T) where r̃ = r + λ·LGD
  → "as if" 할인: 부도채권을 마치 무부도채권처럼 취급하되
    할인율을 조정

동치성:
  1차 근사에서 두 모형은 동일한 가격을 산출
  정확한 동치성: R이 시점 t에 의존하지 않을 때 (fractional recovery of
  face value, RFV assumption)
```

### 4.4 부도 강도의 모형화

축약형 모형에서 λ(t)는 다양한 확률과정으로 모형화할 수 있다.

```
모형 1: 상수 강도
  λ(t) = λ₀ (상수)
  → 가장 단순, 신용등급이 변하지 않는 기업에 적합

모형 2: 결정적 함수
  λ(t) = a + b·t + c·t²
  → 기간구조를 반영, CDS 기간구조 피팅에 사용

모형 3: CIR 과정 (Cox-Ingersoll-Ross)
  dλ = κ(θ - λ)dt + σ_λ√λ dW

  where:
    κ = 평균회귀 속도 (speed of mean reversion)
    θ = 장기 평균 강도 (long-run mean)
    σ_λ = 강도 변동성 (volatility of intensity)

  성질:
    λ(t) ≥ 0 보장 (2κθ ≥ σ_λ² 조건, Feller condition)
    평균회귀: 장기적으로 λ → θ
    해석적 채권가격 가능 (affine 구조)

모형 4: 점프-확산 (Jump-Diffusion)
  dλ = κ(θ - λ)dt + σ_λ√λ dW + J dN

  where:
    N = Poisson 과정 (강도 자체의 점프)
    J = 점프 크기 (양수, 신용 사건)

  → 갑작스런 신용 악화 (예: 분식 회계 발각, 소송) 모형화
```

### 4.5 구조적 vs 축약형 비교

```
┌──────────────────────────────────────────────────────────────────────┐
│  차원            │  구조적 (Merton/KMV)      │  축약형 (JT/DS)        │
├──────────────────────────────────────────────────────────────────────┤
│  정보 가정       │  자산가치 V 관측 (또는 추정) │  부도시점 τ 외생        │
│  부도 메커니즘   │  V_T < F (경제적 원인)      │  λ(t) 도착 (확률적)     │
│  부도 예측성     │  부도 시점 사전에 예측 가능   │  부도는 "놀라움"         │
│  입력 데이터     │  주가, 부채, σ_E            │  CDS, 채권 스프레드      │
│  캘리브레이션    │  연립방정식 반복법           │  스프레드 부트스트래핑    │
│  장점            │  경제적 직관, 조기 경보       │  시장가격 일관성, 유연    │
│  단점            │  단일 만기 부채, V 관측불가    │  경제적 원인 불명         │
│  예측 수평       │  장기 (1-5년)               │  단기 (< 1년)           │
│  실무 용도       │  KMV/CreditMetrics, 은행     │  CDS 가격결정, 트레이딩  │
│  한국 적용성     │  ★★★★ (DART+시가총액 가용)   │  ★★☆ (CDS 시장 비유동적) │
└──────────────────────────────────────────────────────────────────────┘
```

**한국 시장 시사점:**

```
한국에서 축약형 모형의 적용:

1. CDS 시장: 한국 기업의 CDS는 일부 대기업(삼성전자, SK하이닉스,
   현대차 등)과 소버린(대한민국 정부)에만 유동적으로 거래.
   중소형주의 CDS는 사실상 부재.

2. 대안적 λ(t) 추정:
   - KIS/한신평/나이스 신용등급 전이행렬(transition matrix)에서 추출
   - 회사채 유통수익률과 국고채 수익률 차이에서 역산:
     λ ≈ s / (1 - R) where s = 관측 스프레드, R = 가정 회수율

3. 회수율(R) 가정:
   - 한국 시장 평균 회수율 ≈ 25-40% (미국 대비 낮음)
   - KIS 부도율 연감: 부도 후 3년 기준 유보가치율(recovery rate)
   - 담보유무, 선순위/후순위에 따라 R 차이 큼

4. 신용등급 전이행렬에서 λ(t) 추정:
   1년 전이행렬 M = [m_ij]에서
   λ_i ≈ 1 - m_ii (등급 i에서 1년 내 등급 변화/부도 확률)
   더 정밀: Generator matrix Q에서
     M = e^Q, Q의 마지막 행(부도 흡수상태 행)에서 λ 추출
```

### 4.6 신용등급 전이행렬

```
한국 신용등급 1년 전이행렬 (연평균, KIS 2015-2024, 단위: %)

        AAA    AA     A     BBB    BB이하   부도
AAA   [ 92.5   6.5   0.8   0.2    0.0    0.00 ]
AA    [  1.2  90.5   7.0   1.0    0.3    0.01 ]
A     [  0.1   3.5  89.0   5.5    1.5    0.04 ]
BBB   [  0.0   0.5   5.0  87.0    5.5    0.20 ]
BB이하 [  0.0   0.1   0.5   4.0   85.0    2.50 ]

주의: 상기 수치는 공개 자료 기반 추정치이며, 정확한 전이행렬은
한국신용평가(KIS), 한국기업평가(KR), NICE신용평가에서 매년 발표

λ 추출:
  λ(AAA) ≈ 0.0000 (사실상 0)
  λ(AA)  ≈ 0.0001
  λ(A)   ≈ 0.0004
  λ(BBB) ≈ 0.0020
  λ(BB)  ≈ 0.0250
```

---

## 5. 신용스프레드 분해 (Credit Spread Decomposition)

### 5.1 개요

신용스프레드는 단순히 부도 위험에 대한 보상이 아니다. 여러 요소의
복합체이다. 이 절에서는 스프레드의 **구성요인**(constituent components)을
이론적으로 분해한다.

**참고:** 크레딧 스프레드의 **체제 분류**(regime classification)와
**패턴 신뢰도 연동** 시그널은 Doc 35 §5에서 다룬다. 본 절은 그 시그널의
**이론적 토대**를 제공하는 것이 목적이다.

### 5.2 스프레드 분해 프레임워크

```
Eq. (5.1)  CS = PD × LGD + LP + TW + SRP + OC

where:
  CS  = Credit Spread (관측된 신용스프레드)
  PD  = 부도확률 (Probability of Default)
  LGD = 부도시 손실률 (Loss Given Default, = 1 - Recovery Rate)
  LP  = 유동성 프리미엄 (Liquidity Premium)
  TW  = 세금 차이 (Tax Wedge)
  SRP = 체계적 위험 프리미엄 (Systematic Risk Premium)
  OC  = 옵션 요소 (Option Component, callable/puttable bonds)

각 요소의 추정 비중 (Elton et al. 2001, Longstaff et al. 2005):

┌──────────────────────────────────────────────────────────────┐
│  요소      │  비중 (AA)  │  비중 (BBB) │  비중 (B)   │  참고    │
├──────────────────────────────────────────────────────────────┤
│  PD × LGD  │    5-10%    │   15-25%    │   40-60%   │  Elton   │
│  LP        │   20-30%    │   15-25%    │   10-20%   │  Longst. │
│  TW        │   10-20%    │   10-15%    │    5-10%   │  Elton   │
│  SRP       │   30-40%    │   25-35%    │   15-25%   │  C-D     │
│  OC        │    0-5%     │    0-5%     │    0-5%    │  -       │
└──────────────────────────────────────────────────────────────┘

핵심 관찰:
  - 고등급(AA): 기대손실(PD×LGD)은 스프레드의 10% 미만
  - 저등급(B): 기대손실 비중이 40-60%로 상승
  - 모든 등급에서 "기대손실 이외의 요인"이 상당 부분을 차지
  → 이것이 "credit spread puzzle"
```

### 5.3 기대 손실 요소 (PD × LGD)

```
Eq. (5.2)  기대손실 스프레드 ≈ λ · (1 - R)

where:
  λ = 부도 강도 (축약형 모형)
  R = 회수율

한국 등급별 기대손실 (KIS 부도율 연감 기반 추정):

  AA-: PD ≈ 0.01%, LGD ≈ 60% (R=40%)
       → PD×LGD ≈ 0.006%p
       → 관측 스프레드 ≈ 0.50%p
       → 기대손실 비중 ≈ 1.2%   ★ 극히 미미

  BBB-: PD ≈ 0.20%, LGD ≈ 65% (R=35%)
        → PD×LGD ≈ 0.13%p
        → 관측 스프레드 ≈ 4.50%p
        → 기대손실 비중 ≈ 2.9%   ★ 여전히 미미

→ 한국에서도 기대손실은 스프레드의 매우 작은 부분
→ "credit spread puzzle"은 한국 시장에서도 강하게 관찰됨
```

### 5.4 유동성 프리미엄 (Liquidity Premium)

```
정의: 유동성이 부족한 자산이 요구하는 추가 수익률

측정 방법:

방법 1: Bid-Ask Spread 기반
  LP ∝ (ask yield - bid yield) / 2
  → 한국 회사채: 호가 스프레드가 넓을수록 유동성 프리미엄 ↑

방법 2: CDS-Bond Basis (Longstaff et al. 2005)
  LP ≈ Bond Spread - CDS Spread
  → CDS는 유동성 프리미엄이 없다고 가정 (이 자체가 논쟁적)
  → 한국 적용 제한: CDS 시장 유동성 부족

방법 3: On-the-run vs Off-the-run 스프레드
  LP ≈ y(off-the-run) - y(on-the-run)
  → 국고채에서도 관측: 직전발행물(최신) vs 이전발행물 수익률 차이
  → 한국 국고채 on/off 스프레드: ~2-5bp (정상), ~10-20bp (위기)

한국 회사채 유동성 특성:
  - AAA/AA급: 거래 활발, LP 상대적 작음 (5-20bp)
  - A급: 거래 간헐적, LP 중간 (20-50bp)
  - BBB급 이하: 거래 매우 희소, LP 매우 큼 (50-200bp)
  - "유동성 절벽": A-/BBB+ 경계에서 LP 급등
  - 위기 시 유동성 프리미엄 폭발적 확대 (2008 GFC, 2022 레고랜드 사태)
```

### 5.5 세금 차이 (Tax Wedge)

```
Elton et al. (2001)의 핵심 논점:

미국:
  - 국채(Treasury): 주정부세(state tax) 면제
  - 회사채(corporate): 주정부세 과세
  → 세후 수익률을 맞추려면 회사채가 더 높은 세전 수익률 필요
  → 이 세금 차이가 스프레드의 일부를 설명

한국:
  - 국고채: 이자소득세 14% + 지방소득세 1.4% = 15.4%
  - 회사채: 이자소득세 14% + 지방소득세 1.4% = 15.4%
  → 세율 동일: 미국과 달리 세금 차이(TW)는 무시 가능

그러나:
  - 국고채: 비과세 대상 가능 (일부 연기금, 외국인 조세조약)
  - 회사채: 비과세 적용 범위 제한
  → 제한적이나마 세금 차이 존재 가능

추정:
  한국 TW ≈ 0-10bp (미미함)
  미국 TW ≈ 30-50bp (투자등급 기준, Elton et al. 2001)
```

### 5.6 체계적 위험 프리미엄 (Systematic Risk Premium)

```
Collin-Dufresne, Goldstein & Martin (2001)의 핵심 발견:

분석:
  - 회사채 스프레드 변화의 결정요인을 회귀분석
  - 구조적 변수 (주가, 금리, 변동성, 레버리지)로 설명력 ≈ 25%
  - 나머지 75%는 공통 요인(common factor)에 의해 설명
  → "credit spread puzzle": 관측 가능한 구조적 변수만으로는
    스프레드 변동의 대부분을 설명할 수 없음

해석:
  - 공통 요인 = 체계적 위험에 대한 보상
  - 부도는 경기 하강 시 집중 발생 → 체계적 위험
  - 투자자는 "나쁜 시기에 손실을 입을" 위험에 대해 추가 보상 요구
  - 이 보상이 체계적 위험 프리미엄(SRP)

수학적 표현:
  Eq. (5.3)  SRP = β_credit · λ_market

  where:
    β_credit = 신용스프레드의 시장 위험 베타
    λ_market = 시장 위험의 가격 (market price of risk)

Gilchrist & Zakrajsek (2012)의 Excess Bond Premium (EBP):

  Eq. (5.4)  EBP_i = CS_i - PD_i × LGD_i

  → 개별 채권의 스프레드에서 기대손실을 뺀 나머지
  → EBP를 전체 시장에 대해 평균: 거시 신용 여건의 지표
  → EBP↑: 신용 긴축 → 실물 경기 둔화 선행 (6-12개월)
  → 한국 적용: KIS 등급별 부도율 + KOFIA 스프레드로 EBP 근사 가능
```

### 5.7 "Credit Spread Puzzle" 요약

```
┌──────────────────────────────────────────────────────────────────┐
│  연구                      │  핵심 발견                          │
├──────────────────────────────────────────────────────────────────┤
│  Elton et al. (2001)       │  기대손실 ≈ 스프레드의 25%          │
│                            │  나머지 = 세금 + 체계적 위험         │
│  Longstaff et al. (2005)   │  CDS-Bond basis로 유동성 분리       │
│                            │  유동성 ≈ 스프레드의 ~50% (BBB)     │
│  Collin-Dufresne (2001)    │  구조적 변수 설명력 ≈ 25%           │
│                            │  공통요인(체계적 위험)이 지배         │
│  Gilchrist-Zakrajsek (2012)│  EBP = 거시 신용 여건 요약 지표     │
│                            │  EBP가 GDP 성장률 6-12개월 선행      │
│  Huang & Huang (2012)      │  구조적 모형(Merton 류) 정교화해도   │
│                            │  투자등급 스프레드의 20-30%만 설명    │
└──────────────────────────────────────────────────────────────────┘

함의:
  1. 스프레드 ≠ 부도위험: 스프레드를 PD의 대용지표로 쓸 때 주의
  2. 유동성 관리: 스프레드 확대 ≠ 반드시 신용 악화, 유동성 악화일 수 있음
  3. 거시 정보: EBP 유형의 "잔여 스프레드"가 경기 선행 정보를 담음
     (→ Doc 41 §5 크레딧 사이클과의 관계 참조)
```

---

## 6. CDS-Bond Basis

### 6.1 CDS 기본 구조

Credit Default Swap(CDS)은 기초자산의 부도 위험을 이전하는 파생상품이다.

```
CDS 구조:

  보장매수자                            보장매도자
  (Protection    ────── CDS 프리미엄 ──────→  (Protection
   Buyer)         (연율, bp, 분기별 지급)        Seller)
                                                  │
     ↑                                            │
     │←── 부도 시: (1-R)×F 지급 ──────────────────┘

where:
  CDS 프리미엄(spread) = s_CDS (연율, bp 단위)
  F = 명목금액 (notional)
  R = 회수율 (recovery rate)
```

**CDS 스프레드의 이론적 결정:**

```
Eq. (6.1)  s_CDS · RPV01 = (1-R) · Σ Q(t_i-1, t_i)의 현가 조정

간략화 (상수 λ, 연속 시간):

Eq. (6.2)  s_CDS ≈ λ · (1-R)

해석:
  CDS 스프레드 ≈ 부도강도 × 손실률
  → Jarrow-Turnbull 모형의 신용스프레드와 동일한 1차 근사
```

**RPV01 (Risky PV01):**

```
Eq. (6.3)  RPV01 = Σ_{i=1}^{n} δ_i · D(0, t_i) · Q(0, t_i)

where:
  δ_i    = 쿠폰 기간의 길이 (day count fraction)
  D(0,t) = 무위험 할인인자
  Q(0,t) = 생존확률

→ CDS 프리미엄 1bp 변동에 대한 CDS의 현재가치 변화
→ 채권의 DV01에 대응하는 CDS의 금리 민감도
```

### 6.2 이론적 무차익거래 관계

Duffie (1999)는 CDS 스프레드와 채권 스프레드 사이의 이론적
동치(no-arbitrage equivalence)를 증명했다.

```
Eq. (6.4)  s_CDS ≈ s_bond = y_corp - y_risk-free

이론적 근거:
  - CDS 매수 + 리스키 채권 매수 → 합성 무위험 포지션
  - 무차익거래: CDS 스프레드 = 채권 스프레드
  → 이것이 성립하지 않으면 차익거래 기회 존재
```

**차익거래 전략:**

```
양의 베이시스 (s_CDS > s_bond):
  → "Negative basis trade" (역의 이름 주의):
    매수: 리스키 채권 + CDS 보장매수
    → 합성 무위험 수익률 > 실제 무위험 수익률
    → 양의 초과수익

음의 베이시스 (s_CDS < s_bond):
  → "Positive basis trade":
    매도: 리스키 채권 공매도 + CDS 보장매도
    → 이론상 양의 초과수익
    → 그러나 채권 공매도의 현실적 제약이 큼
```

### 6.3 CDS-Bond Basis 정의와 결정요인

```
Eq. (6.5)  Basis = s_CDS - s_bond

양의 베이시스 (Basis > 0, CDS > Bond):

  원인 1: 카운터파티 리스크 (counterparty risk)
    → CDS 보장매도자의 부도 위험 → CDS 프리미엄 ↑

  원인 2: 자금조달 제약 (funding constraints)
    → 채권 매수에 자금 필요 vs CDS는 명목금액만 거래
    → 자금조달 비용이 높을수록 채권 매력 ↓ → s_bond 하방 압력

  원인 3: 채권 공매도 비용 (short-selling costs)
    → 채권 빌려서 공매도하는 비용 → 차익거래 제한
    → 한국: 채권 대차 시장 미발달 → 비효율 지속

  원인 4: 딜리버리 옵션 (cheapest-to-deliver, CTD)
    → CDS 보장매수자는 부도 시 가장 싼 채권을 인도
    → CDS 보장매수의 옵션 가치 → s_CDS ↑

음의 베이시스 (Basis < 0, CDS < Bond):

  원인 1: 채권 유동성 프리미엄
    → 채권 스프레드에 유동성 프리미엄 포함 → s_bond ↑

  원인 2: 시장 분단 (market segmentation)
    → CDS 시장과 채권 시장 참여자 구성 차이

  원인 3: Funding arbitrage 해소
    → 위기 시 자금조달 비용 급등 → basis 확대
```

### 6.4 위기 시 베이시스 확대

```
2008 금융위기 사례:

  시기       │ IG Basis │ HY Basis │ 주요 사건
  ─────────────────────────────────────────────
  2007 Q2   │  -10bp   │  -30bp   │ 서브프라임 초기
  2007 Q4   │  -40bp   │ -100bp   │ 베어스턴스 헤지펀드
  2008 Q1   │  -80bp   │ -200bp   │ 베어스턴스 구제
  2008 Q3   │ -200bp   │ -500bp   │ 리먼브라더스 파산
  2008 Q4   │ -250bp   │ -700bp   │ TARP, 양적완화 시작
  2009 Q2   │  -60bp   │ -150bp   │ 회복 시작

교훈:
  1. 위기 시 음의 베이시스 폭발적 확대
  2. 원인: 자금조달 제약(deleveraging) + 채권 투매(fire sale)
  3. 차익거래자의 자본 부족 → 비효율 해소 불가
  4. "차익거래의 한계" (Limits of Arbitrage, Shleifer & Vishny 1997)
```

### 6.5 한국 시장의 CDS-Bond Basis

```
한국 시장 특수성:

1. CDS 시장 규모:
   - Korea sovereign CDS: 유동적 (5Y CDS가 벤치마크)
   - 대기업 CDS (삼성, SK 등): 제한적 유동성
   - 중소기업 CDS: 사실상 부재
   → 기업 차원의 basis 분석은 대기업에 한정

2. Korea Sovereign CDS:
   - 2008 GFC: 600bp+ (극단적 확대)
   - 2012-2019: 30-80bp (안정)
   - 2020 COVID: 40-60bp (일시 확대)
   - 2022-2025: 25-45bp (정상)
   → USD/KRW 환율과 높은 상관: r ≈ +0.75

3. 대안 지표:
   - CDS 대신 KTB 대비 회사채 스프레드가 주요 모니터링 대상
   - KOFIA 시가평가 기준수익률: AA-/BBB- 스프레드 일별 제공
   → CheeseStock은 이 데이터를 활용 (→ Doc 35 §5 참조)

4. Korea CDS-USD/KRW 상관관계:
   - CDS ↑ → KRW 약세 (외국인 위험 인식 반영)
   - CDS 변화는 외국인 채권자금 유출입과 연관
   - 실증: Δ(CDS) → Δ(USD/KRW), 2-5영업일 선행

   Eq. (6.6)  Δ(USD/KRW)_t = α + β₁·Δ(CDS)_{t-1} + β₂·Δ(VIX)_{t-1} + ε_t
              β₁ ≈ 0.15-0.25 (통계적으로 유의)
```

---

## 7. 신용 포트폴리오 모형 (Credit Portfolio Models)

### 7.1 개요

개별 기업의 부도 확률을 추정하는 것만으로는 불충분하다.
포트폴리오 관점에서는 **여러 기업의 동시 부도 가능성**과
**손실분포**를 파악해야 한다.

```
핵심 질문:
  Q1. 100개 대출 포트폴리오에서 n개 이상 부도가 날 확률은?
  Q2. 99% 신뢰수준에서의 최대 손실(Credit VaR)은?
  Q3. 부도 간 상관관계는 어떻게 모형화하는가?
```

### 7.2 Vasicek 단일팩터 모형 (1987/2002)

Vasicek (1987, 2002 공식 출판)은 신용 포트폴리오 손실분포의
해석적 해를 제공한 최초의 모형이다.

**모형 구조:**

```
Eq. (7.1)  X_i = √ρ · Z + √(1-ρ) · ε_i

where:
  X_i  = 기업 i의 잠재변수 (latent variable, "자산수익률")
  Z    ~ N(0,1): 체계적 팩터 (systematic factor, 공통 경기 요인)
  ε_i  ~ N(0,1): 개별 팩터 (idiosyncratic factor, 기업 고유)
  ρ    = 자산상관 (asset correlation, 0 ≤ ρ ≤ 1)

Z, ε₁, ε₂, ..., ε_n은 모두 독립

X_i ~ N(0,1)  (∵ ρ·1 + (1-ρ)·1 = 1)

기업 i의 부도 조건:
  X_i < c_i = N^(-1)(PD_i)    (부도 경계)
```

**관계:**

```
Merton 모형과의 연결:
  X_i ↔ 자산수익률: [ln(V_{i,T}/V_{i,0}) - (μ_i - σ_Vi²/2)T] / (σ_Vi√T)
  c_i ↔ -DD_i
  Z   ↔ 시장 공통 충격 (경기, 금리 등)
  ε_i ↔ 기업 고유 충격 (경영, 소송 등)
  ρ   ↔ 자산수익률 간의 평균 상관계수

→ Vasicek 모형은 Merton 모형의 포트폴리오 확장
```

### 7.3 조건부 부도확률

체계적 팩터 Z의 실현값이 주어졌을 때의 조건부 부도확률:

```
Eq. (7.2)  PD_i(Z) = P(X_i < c_i | Z)
                    = P(√ρ·Z + √(1-ρ)·ε_i < c_i | Z)
                    = P(ε_i < (c_i - √ρ·Z) / √(1-ρ))
                    = N((c_i - √ρ·Z) / √(1-ρ))

동질적(homogeneous) 포트폴리오 (PD_i = PD ∀i):
  c = N^(-1)(PD)
  PD(Z) = N((N^(-1)(PD) - √ρ·Z) / √(1-ρ))

해석:
  Z < 0 (나쁜 경기) → PD(Z) > PD (부도확률 상승)
  Z > 0 (좋은 경기) → PD(Z) < PD (부도확률 하락)
  ρ ↑ → Z의 영향력 ↑ → 부도 동시 발생 가능성 ↑
```

**수치 예시:**

```
PD = 1% (BBB 등급), ρ = 0.15 (Basel 표준)

c = N^(-1)(0.01) = -2.326

경기 나쁨 (Z = -2):
  PD(Z=-2) = N((-2.326 - √0.15·(-2)) / √0.85)
           = N((-2.326 + 0.775) / 0.922)
           = N(-1.683)
           = 4.62%   (← 평상시의 4.6배!)

경기 매우 나쁨 (Z = -3):
  PD(Z=-3) = N((-2.326 + 1.162) / 0.922)
           = N(-1.262)
           = 10.35%  (← 평상시의 10.3배!)

경기 좋음 (Z = +2):
  PD(Z=+2) = N((-2.326 - 0.775) / 0.922)
           = N(-3.362)
           = 0.04%   (← 평상시의 1/25)

→ ρ = 0.15라는 '적은' 상관이 극단적 시나리오에서는
  부도확률을 10배 이상 증폭시킴
→ 이것이 "default clustering"의 수학적 원인
```

### 7.4 무한세분화 포트폴리오의 손실분포

동질적이고 무한히 세분화된(infinitely granular) 포트폴리오를 가정하면,
대수의 법칙에 의해 조건부 손실률은:

```
Eq. (7.3)  L(Z) = PD(Z) · LGD
                 = N((N^(-1)(PD) - √ρ·Z) / √(1-ρ)) · LGD

→ 개별 리스크(ε_i)는 분산에 의해 사라지고,
  오직 체계적 리스크(Z)만 남음
```

무조건부 손실분포:

```
Eq. (7.4)  P(L ≤ x) = N((√(1-ρ) · N^(-1)(x/LGD) - N^(-1)(PD)) / √ρ)

이것이 Vasicek 분포(Vasicek distribution)이다.
특성:
  - 우측 꼬리가 두꺼운 비대칭 분포
  - 기대 손실: E[L] = PD · LGD
  - ρ ↑ → 분포의 꼬리가 두꺼워짐 → Credit VaR ↑
```

### 7.5 Credit VaR

```
Eq. (7.5)  VaR_α = N[(N^(-1)(PD) + √ρ · N^(-1)(α)) / √(1-ρ)] · LGD

where:
  α   = 신뢰수준 (예: 99%, 99.9%)
  PD  = 무조건부 부도확률
  ρ   = 자산상관
  LGD = 부도시 손실률

수치 예시 (Basel 표준):

PD = 1%, ρ = 0.15, LGD = 45%, α = 99.9%

VaR_{99.9%}
  = N[(N^(-1)(0.01) + √0.15 · N^(-1)(0.999)) / √0.85] · 0.45
  = N[(-2.326 + 0.387 · 3.090) / 0.922] · 0.45
  = N[(-2.326 + 1.196) / 0.922] · 0.45
  = N[-1.225] · 0.45
  = 0.1103 · 0.45
  = 4.96%

→ 99.9% 신뢰수준에서 최대 손실률 = 4.96%
→ 기대손실 = 1% × 45% = 0.45%
→ 비기대손실(Unexpected Loss) = 4.96% - 0.45% = 4.51%
→ 이것이 경제적 자본(economic capital) 소요량
```

### 7.6 Basel IRB 공식

Basel II/III의 내부등급법(Internal Ratings-Based, IRB)은
Vasicek 모형에 기반한 규제자본 공식을 사용한다.

```
Eq. (7.6)  K = LGD · [N((N^(-1)(PD) + √ρ·N^(-1)(0.999)) / √(1-ρ)) - PD]
              × (1 + (M-2.5)·b) / (1 - 1.5·b)

where:
  K   = 소요자본 (단위 명목금액 대비, %)
  PD  = 1년 부도확률
  LGD = 부도시 손실률
  ρ   = 자산상관 (PD의 함수)
  M   = 유효 만기 (Effective Maturity)
  b   = 만기 조정 계수 = [0.11852 - 0.05478·ln(PD)]²

자산상관 ρ의 결정 (기업 익스포저):

Eq. (7.7)  ρ = 0.12 · (1-e^(-50·PD)) / (1-e^(-50))
              + 0.24 · [1 - (1-e^(-50·PD)) / (1-e^(-50))]

해석:
  PD → 0:  ρ → 0.24 (고등급 기업은 체계적 위험 비중 ↑)
  PD → 1:  ρ → 0.12 (저등급 기업은 개별 위험 비중 ↑)

→ 직관: 부도 확률이 낮은 기업은 주로 거시 충격에 의해 부도
  → 높은 상관. 부도 확률이 높은 기업은 개별적 원인으로 부도
  → 낮은 상관
```

**수치 예시: Basel IRB 소요자본**

```
PD = 0.50%, LGD = 45%, M = 2.5년 (표준)

ρ = 0.12·(1-e^(-25))/(1-e^(-50)) + 0.24·[1-(1-e^(-25))/(1-e^(-50))]
  ≈ 0.12·1.0 + 0.24·0.0   (∵ e^(-25) ≈ 0, e^(-50) ≈ 0)
  ≈ 0.12 + 0.24·0.0
  
실제 계산:
  (1-e^(-50·0.005)) = (1-e^(-0.25)) = 1 - 0.7788 = 0.2212
  (1-e^(-50))       ≈ 1.0000
  
  ρ = 0.12·0.2212 + 0.24·(1-0.2212)
    = 0.0265 + 0.1869
    = 0.2135

b = [0.11852 - 0.05478·ln(0.005)]²
  = [0.11852 - 0.05478·(-5.298)]²
  = [0.11852 + 0.2902]²
  = [0.4087]²
  = 0.1671

K = 0.45 · [N((N^(-1)(0.005) + √0.2135·N^(-1)(0.999)) / √(1-0.2135)) - 0.005]
  × (1 + (2.5-2.5)·0.1671) / (1 - 1.5·0.1671)

  = 0.45 · [N((-2.576 + 0.462·3.090) / 0.887) - 0.005] · 1/(0.7493)

  = 0.45 · [N((-2.576 + 1.428) / 0.887) - 0.005] · 1.335

  = 0.45 · [N(-1.294) - 0.005] · 1.335

  = 0.45 · [0.0978 - 0.005] · 1.335

  = 0.45 · 0.0928 · 1.335

  = 0.0557 = 5.57%

→ 명목 100원당 5.57원의 규제자본 필요
→ 위험가중자산(RWA) = K / 0.08 × EAD = 69.6% × EAD
```

### 7.7 Gaussian Copula와 CDO 가격결정

**Copula 접근법:**

```
정의: Copula C는 다변량 분포함수를 주변분포와 종속구조로 분리하는 함수

Sklar의 정리 (1959):
  모든 다변량 분포 H(x₁, ..., x_n)에 대해
  H(x₁, ..., x_n) = C(F₁(x₁), ..., F_n(x_n))
  
  where F_i = 주변 분포(marginal distribution)
        C   = 종속구조(dependence structure)

→ 주변분포(개별 부도확률)와 종속구조(부도 상관)를 분리하여 모형화
```

**Gaussian Copula (Li, 2000):**

```
Li (2000)의 접근:

Step 1: 각 기업의 부도시점 τ_i를 연속 확률변수로 변환
  U_i = F_i(τ_i) ~ Uniform(0,1)

Step 2: 표준정규 변환
  Z_i = N^(-1)(U_i) ~ N(0,1)

Step 3: 다변량 정규 종속구조 부여
  (Z₁, Z₂, ..., Z_n) ~ N(0, Σ)
  
  where Σ = 상관행렬, Σ_ij = ρ_ij

Eq. (7.8)  C_Gaussian(u₁, ..., u_n; Σ)
           = Φ_n(N^(-1)(u₁), ..., N^(-1)(u_n); Σ)

where:
  Φ_n = n변량 표준정규 분포함수
```

**CDO 가격결정에서의 사용:**

```
Collateralized Debt Obligation (CDO):
  - 기초자산: 100-200개 기업의 채권/대출 풀(pool)
  - 트렌치(tranche): 손실 흡수 순서에 따른 분할

  Equity Tranche:   0-3% 손실 흡수 (첫 번째 손실, 최고 수익률)
  Mezzanine:        3-7% 손실 흡수
  Senior:           7-15% 손실 흡수
  Super Senior:     15-100% (이론상 최안전, 실제로 2008년 폭발)

Gaussian Copula로 각 트렌치의 기대손실을 산출:
  1. 개별 PD_i 확정 (Merton DD 또는 신용등급 기반)
  2. 상관행렬 Σ 또는 단일 상관 ρ 지정
  3. 몬테카를로 시뮬레이션 또는 semi-analytic:
     - Z 추출 → 조건부 PD 계산 → 손실 합산 → 트렌치별 배분
  4. 각 트렌치의 기대 손실에서 fair spread 도출
```

### 7.8 Gaussian Copula의 한계와 2008 CDO 위기

```
Li (2000)의 Gaussian Copula는 2008년 금융위기에서 핵심 역할을 했다.
Sam Jones (2009, FT)가 "the formula that killed Wall Street",
Felix Salmon (2009, Wired)이 "Recipe for Disaster"로 명명.

핵심 문제:

문제 1: 꼬리 종속성 부재 (Tail Dependence = 0)
  Gaussian copula:
    lim_{q→0} P(U₂ < q | U₁ < q) = 0

  → 극단적 사건의 동시 발생 확률을 과소평가
  → 현실: 위기 시 동시 부도 급증 (default clustering)
  → Student-t copula (tail dependence > 0)가 대안이나,
    당시 실무에서 채택되지 않음

문제 2: 단일 상관 파라미터
  - 전체 포트폴리오를 하나의 ρ로 요약
  - 현실: 산업, 지역, 규모에 따라 상관 다름
  - "implied correlation": 시장 트렌치 가격에서 역산 → 트렌치마다 다른 ρ
    → "correlation smile/skew" → 모형 부정합 신호

문제 3: 상관의 시간 변동
  - 평상시 ρ ≈ 0.15-0.25
  - 위기 시 ρ → 0.50-0.80 (극단적 수렴)
  - 상수 ρ 가정은 위기 시 손실을 심각하게 과소평가

문제 4: 회수율의 확률적 변동
  - 모형: R = 40% (상수 가정)
  - 현실: 경기 침체 시 R 급락 (20% 이하)
  - PD ↑ + R ↓ → 이중 타격 (double hit)

교훈:
  1. 모형의 가정을 이해하지 못한 채 사용하면 재앙
  2. 상관관계는 정상(normal) 시기와 위기(stress) 시기에 다름
  3. 꼬리 위험(tail risk)은 별도로 모형화해야 함
  4. "모형은 유용하나 위험하다" (Box: "All models are wrong,
     some are useful")
```

### 7.9 대안적 포트폴리오 모형

```
1. CreditMetrics (J.P. Morgan, 1997):
   - 신용등급 전이에 기반한 시뮬레이션
   - 각 시나리오에서 포트폴리오의 시장가치 변화 계산
   - Vasicek보다 유연하지만 계산 비용 높음

2. CreditRisk+ (Credit Suisse, 1997):
   - 보험수리적(actuarial) 접근: 부도를 Poisson 과정으로
   - 부도 건수의 확률분포 → 손실분포
   - 해석적 해 존재, 계산 효율적
   - 부도 상관을 "sector factor"로 반영

3. Student-t Copula:
   - Gaussian copula의 꼬리 종속성 부재를 해결
   - 자유도(ν)가 추가 파라미터: ν ↓ → 꼬리 두꺼움
   - ν = ∞ → Gaussian copula로 수렴
   - 실증: ν ≈ 5-10이 CDO 가격에 더 적합

4. Marshall-Olkin Copula:
   - 동시 부도(simultaneous default)를 직접 모형화
   - 공통 충격(common shock) 모형과 연결
   - CDO mezzanine 트렌치에 적합

비교:
┌──────────────────────────────────────────────────────────────┐
│  모형          │  꼬리종속 │  계산    │  캘리브레이션 │  실무   │
├──────────────────────────────────────────────────────────────┤
│  Gaussian Cop. │  없음     │  빠름    │  쉬움        │  표준   │
│  Student-t     │  있음     │  중간    │  중간        │  증가   │
│  Vasicek 1F    │  제한적   │  해석적  │  쉬움        │  Basel  │
│  CreditMetrics │  제한적   │  MC 시뮬 │  복잡        │  은행   │
│  CreditRisk+   │  없음     │  해석적  │  중간        │  보험   │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. KRX 적용: CheeseStock 구현 경로

### 8.1 개요

본 절은 앞선 이론 전체를 CheeseStock의 기존 데이터 인프라에
어떻게 연결하는지를 설계한다. **구현 코드를 포함하지 않으며**,
데이터 경로와 설계 원칙만 기술한다.

```
현재 가용 데이터:
  1. 시가총액(E): data/index.json → marketCap 또는 lastClose × shares
  2. 주가 변동성(σ_E): OHLCV → 일별 수익률 → 연율화 표준편차
  3. 부채 정보(F): data/financials/{code}.json → DART 연결재무제표
  4. 무위험이자율(r): data/macro/bonds_latest.json → KTB 3Y
  5. 시장 수익률: KOSPI 인덱스 (compute_capm_beta.py에서 이미 사용)

현재 미가용 데이터:
  1. CDS 스프레드: 한국 기업 CDS 실시간 데이터 없음
  2. 회사채 유통수익률: KOFIA API 연동 시 가용
  3. DART 유동/비유동 부채 세부 분류: 현재 부채총계만 활용
```

### 8.2 Merton DD 산출 파이프라인

```
설계: compute_capm_beta.py에 DD 필드 추가

기존 출력 (data/beta/{code}.json):
{
  "beta": 1.15,
  "alpha": 0.0003,
  "rSquared": 0.42,
  ...
}

추가 필드:
{
  "distanceToDefault": 4.23,      // DD
  "probDefault": 0.0012,          // N(-DD) = 0.12%
  "ddGrade": "safe",              // safe/caution/warning
  "assetValue": 450000000000000,  // V (원)
  "assetVolatility": 0.22,        // σ_V (연율화)
  "defaultPoint": 95000000000000, // F = 유동부채 + 0.5*비유동부채 (원)
  "method": "bharath_shumway",    // 또는 "newton_raphson"
  "ddTimestamp": "2026-04-03"
}
```

**산출 알고리즘 (Python 의사코드):**

```
def compute_dd(code, financial_data, ohlcv_data, risk_free_rate):
    """
    Merton Distance-to-Default 산출

    Parameters:
        code: 종목코드
        financial_data: DART 재무제표
        ohlcv_data: 일별 OHLCV
        risk_free_rate: KTB 3Y (소수점)

    Returns:
        dict with DD, PD, grade, etc.
    """

    # Step 1: 입력 데이터 추출
    E = market_cap(code)                    # 시가총액
    total_debt = financial_data['부채총계']  # DART
    current_liab = financial_data.get('유동부채', total_debt * 0.6)
    noncurrent_liab = financial_data.get('비유동부채', total_debt * 0.4)

    # Step 2: Default Point (KMV 관행)
    F = current_liab + 0.5 * noncurrent_liab
    if F <= 0:
        return {'ddGrade': 'safe', 'distanceToDefault': 99.0, ...}

    # Step 3: 주가 변동성 (연율화)
    daily_returns = log_returns(ohlcv_data['close'], 252)
    sigma_E = np.std(daily_returns) * np.sqrt(252)

    # Step 4: 자산가치·변동성 추정
    r = risk_free_rate
    T = 1.0  # 1년

    # Bharath-Shumway 간편법 (기본)
    V = E + total_debt
    sigma_V = sigma_E * (E / V) + 0.05 * (total_debt / V)
    mu_V = r  # 근사: 자산기대수익률 ≈ 무위험이자율

    # Step 5: DD 계산
    DD = (np.log(V / F) + (mu_V - sigma_V**2 / 2) * T) / (sigma_V * np.sqrt(T))
    PD = norm.cdf(-DD)

    # Step 6: 등급 분류
    if DD > 3.0:
        grade = 'safe'        # 초록 (--fin-good)
    elif DD >= 2.0:
        grade = 'caution'     # 노랑 (--neutral)
    else:
        grade = 'warning'     # 빨강 (--up)

    return {
        'distanceToDefault': round(DD, 2),
        'probDefault': round(PD, 6),
        'ddGrade': grade,
        'assetValue': int(V),
        'assetVolatility': round(sigma_V, 4),
        'defaultPoint': int(F),
        'method': 'bharath_shumway'
    }
```

### 8.3 DD 등급 분류 기준

```
DD 위험등급 (CheeseStock 표준):

┌──────────────────────────────────────────────────────────────┐
│  등급      │  DD 범위    │  PD 범위      │  색상           │  해석          │
├──────────────────────────────────────────────────────────────┤
│  safe      │  DD > 3.0   │  PD < 0.13%   │  초록 (fin-good)│  안전          │
│  caution   │  2.0 ≤ DD   │  0.13-2.28%   │  노랑 (neutral) │  주의          │
│  warning   │  DD < 2.0   │  PD > 2.28%   │  빨강 (up)      │  경고          │
└──────────────────────────────────────────────────────────────┘

색상 선택 근거 (→ .claude/rules/colors.md 참조):
  - safe: --fin-good (#6BCB77) — 재무 건전성 양호
  - caution: --neutral (#ffeb3b) — 주의 필요
  - warning: --up (#E05050) — 위험 경고 (한국 관례 빨강 = 상승이지만
    여기서는 "위험 상승"의 의미로 사용)

임계값 선택 근거:
  DD = 3.0: 정규분포 3σ → PD ≈ 0.13%, 투자등급/투기등급 경계
  DD = 2.0: 정규분포 2σ → PD ≈ 2.28%, KMV "speculative" 진입
  (→ Doc 35 §6.2의 MERTON_DD_WARNING = 1.5와의 관계:
     1.5는 "강한 경고", 2.0은 "초기 경고"로 2-tier 체계)
```

### 8.4 financials.js 표시 설계

```
기존 _renderCAPMBeta(stock) 패턴을 따라 DD 정보를 표시:

표시 위치: Financial Panel (D column), CAPM Beta 행 아래
표시 형식:

  DD 위험등급   4.23 (0.001%)  ● safe

  ├── "DD 위험등급" = 라벨 (Pretendard 12px)
  ├── "4.23" = DD 값 (JetBrains Mono, tabular nums)
  ├── "(0.001%)" = PD 값 (괄호, 회색)
  └── "● safe" = 등급 인디케이터 (색상 점 + 등급명)

경고 시 추가 표시:
  DD < 2.0 → 빨간 배경 하이라이트
  DD < 1.5 (MERTON_DD_WARNING) → 강조 경고 아이콘
  → 패턴 신뢰도 감쇠 적용 여부 표시
     (→ Doc 35 §6.4 시그널 로직 참조)
```

### 8.5 업종별 DD 적용 주의사항

```
업종 필터:

1. 적용 적합 업종 (DD 유효):
   - 제조업 (전자, 자동차, 화학, 철강)
   - 건설업
   - 유통/서비스업
   - 운송업 (항공, 해운)

2. 적용 부적합 업종 (DD 무효 → 별도 처리 필요):
   - 은행: 부채 = 예금(영업자산), 레버리지 20x 이상
     → DD 계산 시 V/F ≈ 1.05 → DD ≈ 0.5 (부적절한 "경고")
     → 은행은 BIS 비율, NPL 비율 등 별도 지표 사용
   - 보험: 보험부채(보험계약준비금) ≠ 일반 금융부채
   - 증권: 자기매매 포지션의 시가평가 변동
   - 지주회사: 연결재무제표 기준 부채가 자회사 부채 합산
     → 개별 실체의 위험을 정확히 반영하지 못함

KSIC 기반 필터:
  K(금융보험업) → DD 계산 건너뛰기, ddGrade = 'excluded'
  L(부동산업) → 주의 (부동산 PF 부채 특성 다름)

  → appState.js의 KSIC 업종 분류 테이블과 연동
```

### 8.6 수치 예시: 주요 종목 DD 추정

```
가상 추정 (2026년 3월 기준, DART 공시 기반 추정치)

┌──────────────────────────────────────────────────────────────────────┐
│  종목          │  E (조원) │  F (조원) │  σ_E   │  DD    │  PD     │  등급     │
├──────────────────────────────────────────────────────────────────────┤
│  삼성전자       │  400     │   75     │  28%   │  6.68  │  <0.01% │  safe    │
│  SK하이닉스     │  120     │   42     │  45%   │  3.12  │   0.09% │  safe    │
│  현대자동차     │   45     │   55     │  30%   │  2.45  │   0.71% │  caution │
│  LG에너지솔루션 │   85     │   25     │  42%   │  4.01  │   0.003%│  safe    │
│  대한항공       │   12     │   18     │  38%   │  1.82  │   3.44% │  warning │
│  (가상)고위험기업│    2     │    5     │  55%   │  0.45  │  32.64% │  warning │
└──────────────────────────────────────────────────────────────────────┘

주의: 상기 수치는 모형 설명을 위한 가상 추정치임.
      실제 DD는 최신 DART 재무제표와 시장 데이터로 산출해야 함.

해석:
  - 삼성전자: 현금보유량 과다, 부채비율 극히 낮음 → DD 매우 높음
  - SK하이닉스: 반도체 경기변동 → σ_E 높지만 시가총액 대비 부채 적정
  - 현대자동차: 제조업 특성상 차입금 비중 높음 → DD "caution" 영역
  - 대한항공: 항공업 고정비 + 고레버리지 → DD "warning" 영역
  - 고위험기업: 자산대비 부채 과다 + 고변동성 → DD 극히 낮음
```

### 8.7 DD와 기존 시그널의 관계

```
DD는 CheeseStock의 기존 분석 체계에서 다음과 같이 연결된다:

1. 패턴 신뢰도 조정 (→ Doc 35 §6.4):
   DD < MERTON_DD_WARNING (1.5) → 매수 패턴 감쇠, 매도 패턴 보강
   → 본 문서는 DD의 수학적 기초를 제공, 시그널 로직은 Doc 35 참조

2. CAPM Beta와의 독립성 (→ Doc 25 §1):
   DD = 비체계적 위험(idiosyncratic, 개별 기업 신용위험)
   β  = 체계적 위험(systematic, 시장 공통 위험)
   → 두 지표는 서로 다른 차원의 위험을 측정
   → DD 낮음 + β 높음 = 최고 위험 (체계적+비체계적 모두 위험)
   → DD 높음 + β 낮음 = 방어적 안전주

3. 크레딧 스프레드와의 관계 (→ Doc 35 §5):
   - 시장 전체 크레딧 스프레드: 거시 신용 환경 (creditRegime)
   - 개별 종목 DD: 미시 신용 위험 (ddWarning)
   → 두 지표의 조합:
     creditRegime = 'stress' AND DD < 2.0 → 강한 신용 위험 신호
     creditRegime = 'compressed' AND DD > 4.0 → 양호한 환경

4. 크레딧 사이클과의 관계 (→ Doc 41 §5):
   - DD 분포의 좌측 이동 = 크레딧 사이클 하강기
   - DD 분포의 우측 이동 = 크레딧 사이클 상승기
   - 시장 전체 DD 중앙값 추적 → 크레딧 사이클 위치 파악
```

### 8.8 향후 확장 경로

```
Phase 1 (현재 설계): Bharath-Shumway 간편법
  - 입력: DART 부채총계 + 시가총액 + 주가변동성 + KTB 3Y
  - 출력: DD, PD, ddGrade
  - compute_capm_beta.py에 통합
  - financials.js에 표시

Phase 2 (향후): Newton-Raphson 반복법
  - 입력: DART 유동/비유동부채 세부 + 시가총액 + 주가변동성
  - KMV Default Point 정밀 산출
  - 반복법 수렴 보장 (초기값 = Bharath-Shumway, fallback 포함)

Phase 3 (향후): 시계열 DD 추적
  - 분기별 DART 업데이트마다 DD 재산출
  - DD 변화(ΔDD) 모니터링 → 신용 추세 감지
  - ΔDD < -0.5 (3개월) → 신용 악화 가속 경고

Phase 4 (장기): 크레딧 스프레드 모형 통합
  - KOFIA 민평금리 API 연동 시
  - 실제 스프레드 vs Merton 내재 스프레드 비교
  - 괴리 = mispricing 또는 유동성/체계적 위험 프리미엄
  → 크레딧 상대가치(credit relative value) 시그널 가능
```

---

## 부록 A: 수학적 보충

### A.1 BSM 풋-콜 패리티와 Merton 모형

```
BSM 풋-콜 패리티:
  C - P = S - K·e^(-rT)

Merton 모형에서:
  S → V (기업 자산), K → F (부채 액면), C → E (자기자본), P → 풋

  E - P = V - F·e^(-rT)

  ∴ V = E + F·e^(-rT) - P
       = E + D

  where D = F·e^(-rT) - P = 부채의 시장가치
  → 자산 = 자기자본 + 부채 (Modigliani-Miller 정리의 옵션 표현)
```

### A.2 Ito의 보조정리 상세 도출

```
E = f(V, t)에 Ito의 보조정리 적용:

dE = (∂f/∂t)dt + (∂f/∂V)dV + (1/2)(∂²f/∂V²)(dV)²

dV = μ_V·V·dt + σ_V·V·dW 이므로:
(dV)² = σ_V²·V²·dt  (dt² = 0, dt·dW = 0, dW² = dt)

∴ dE = (∂f/∂t + μ_V·V·∂f/∂V + σ_V²·V²/2·∂²f/∂V²)dt
       + σ_V·V·(∂f/∂V)·dW

확산 계수(diffusion coefficient) 비교:
  σ_E·E = σ_V·V·(∂E/∂V)

BSM 콜옵션에서:
  ∂E/∂V = N(d₁)   (콜옵션 델타)
  ∂²E/∂V² = n(d₁)/(V·σ_V·√T)   (콜옵션 감마)

∴ σ_E = σ_V · V · N(d₁) / E
```

### A.3 표준정규 분포 함수 참조표

```
DD에서 자주 사용되는 N(-DD) 값:

│  DD    │  N(-DD)    │  해석                  │
├────────┼────────────┼────────────────────────┤
│  0.0   │  50.000%   │  부도 확률 50%          │
│  0.5   │  30.854%   │                        │
│  1.0   │  15.866%   │                        │
│  1.5   │   6.681%   │  MERTON_DD_WARNING     │
│  2.0   │   2.275%   │  "caution" 경계        │
│  2.5   │   0.621%   │                        │
│  3.0   │   0.135%   │  "safe" 경계           │
│  3.5   │   0.023%   │                        │
│  4.0   │   0.003%   │                        │
│  5.0   │   0.00003% │                        │
│  6.0   │   0.0000001%│ 삼성전자급             │
```

### A.4 회수율(Recovery Rate) 참고자료

```
글로벌 회수율 통계 (Moody's, 2024):

  선순위 담보대출(Senior Secured Loan):     R ≈ 65-75%
  선순위 무담보채권(Senior Unsecured Bond): R ≈ 35-45%
  후순위 채권(Subordinated Bond):          R ≈ 20-30%
  주식(Equity):                           R ≈ 0-5%

한국 회수율 통계 (KIS, 2024 추정):

  - 평균 회수율(무담보 기준): R ≈ 25-35% (글로벌 대비 낮음)
  - 원인: 법정관리(회생) 절차의 긴 기간, 우선변제권 구조
  - 재벌 계열 기업: R 상대적 높음 (그룹 차원 지원 가능성)
  - 독립 기업: R 상대적 낮음

CheeseStock 기본값:
  R = 0.35 (35%) — 한국 무담보 기준
  → compute_dd()에서 PD 계산에 직접 사용되지는 않으나,
    스프레드 분해 분석 시 필요 (향후 Phase 4)
```

---

## 부록 B: 핵심 공식 요약

```
═══════════════════════════════════════════════════════════
              Doc 47 핵심 공식 요약
═══════════════════════════════════════════════════════════

[자산가치 동학]
  dV = μ_V · V · dt + σ_V · V · dW                ...(2.1)

[자기자본 = 콜옵션]
  E = V·N(d₁) - F·e^(-rT)·N(d₂)                  ...(2.4)
  d₁ = [ln(V/F) + (r + σ_V²/2)T] / (σ_V√T)       ...(2.5)
  d₂ = d₁ - σ_V√T                                  ...(2.6)

[Risky Debt]
  D = V·N(-d₁) + F·e^(-rT)·N(d₂)                 ...(2.9)

[Merton 신용스프레드]
  s = -(1/T)·ln[N(d₂) + (V/F)·e^(rT)·N(-d₁)]    ...(2.10)

[Distance-to-Default]
  DD = [ln(V/F) + (μ - σ_V²/2)T] / (σ_V√T)       ...(2.11)
  PD = N(-DD)                                       ...(2.12)

[σ_V 연립방정식]
  E = V·N(d₁) - F·e^(-rT)·N(d₂)                  ...(2.13)
  σ_E = (V/E)·N(d₁)·σ_V                           ...(2.14)

[Bharath-Shumway 간편법]
  σ_V ≈ σ_E·[E/(E+F)] + 0.05·[F/(E+F)]           ...(2.15)
  V ≈ E + F                                        ...(2.16)

[생존확률]
  Q(t,T) = exp(-∫_t^T λ(s)ds)                     ...(4.2)

[부도채권 가격 (JT)]
  D = F·e^(-rT)·[Q + (1-Q)·R]                     ...(4.4)

[부도채권 가격 (DS)]
  D = F·exp(-r̃·T), r̃ = r + λ·(1-R)              ...(4.6-4.7)

[Credit Triangle]
  s ≈ λ·(1-R)                                      ...(4.5 1차근사)

[스프레드 분해]
  CS = PD×LGD + LP + TW + SRP + OC                ...(5.1)

[CDS-Bond Basis]
  Basis = s_CDS - s_bond                           ...(6.5)

[Vasicek 단일팩터]
  X_i = √ρ·Z + √(1-ρ)·ε_i                        ...(7.1)

[조건부 부도확률]
  PD(Z) = N((N⁻¹(PD) - √ρ·Z) / √(1-ρ))          ...(7.2)

[Credit VaR (Vasicek)]
  VaR_α = N[(N⁻¹(PD) + √ρ·N⁻¹(α))/√(1-ρ)]·LGD  ...(7.5)

[Basel IRB 자산상관]
  ρ = 0.12·f(PD) + 0.24·[1-f(PD)]                 ...(7.7)
  f(PD) = (1-e^(-50·PD))/(1-e^(-50))

═══════════════════════════════════════════════════════════
```

---

## 부록 C: 교차참조 맵

```
본 문서(Doc 47)에서 참조하는 기존 문서:

Doc 05 §5     ← BSM 옵션 가격결정 기초
Doc 14 §2     ← DART 재무제표 부채비율
Doc 25 §1.2   ← CAPM beta (DD와 독립적 리스크 측정)
Doc 35 §5     ← 크레딧 스프레드 레짐 시그널 (본 문서 §5의 이론에 기반)
Doc 35 §6     ← DD warning 시그널 (본 문서 §2-3의 이론에 기반)
Doc 41 §5     ← 크레딧 사이클 (본 문서 §5.6 EBP와 연결)
Doc 43 §1-2   ← MM 정리, 자본구조 (본 문서 §2 Merton의 이론적 배경)
Doc 44 §2-6   ← 무위험 채권 가격결정 (본 문서 §2.5 risky debt의 기반)
Doc 45        ← 옵션 가격결정 심화 (BSM, 그리스)

본 문서(Doc 47)를 참조해야 하는 문서:

Doc 35 §5     → §5 스프레드 분해의 이론적 근거
Doc 35 §6     → §2-3 Merton DD의 완전한 도출
Doc 41 §5     → §5.6 EBP의 이론적 기반
```

---

## 부록 D: 용어 사전 (Glossary)

```
가나다 순:

경험적 부도빈도 (EDF, Expected Default Frequency)
  — KMV에서 DD를 경험적 부도 데이터베이스에 매핑한 부도확률

구조적 모형 (Structural Model)
  — 자산가치 과정에서 부도를 내생적으로 도출하는 모형 (Merton, KMV)

기대부도확률 (PD, Probability of Default)
  — 특정 기간 내 부도가 발생할 확률

내부등급법 (IRB, Internal Ratings-Based approach)
  — Basel II/III에서 은행이 자체 PD/LGD 추정으로 소요자본을 산출하는 방법

부도강도 (Default Intensity, Hazard Rate)
  — 축약형 모형에서 순간적 조건부 부도 확률 λ(t)

부도경계 (Default Point, DP)
  — KMV에서 부도가 발생하는 자산가치 수준. DP = STD + 0.5×LTD

부도시 손실률 (LGD, Loss Given Default)
  — 부도 발생 시 손실 비율. LGD = 1 - R (회수율)

신용스프레드 (Credit Spread)
  — 동일 만기 무위험채권 대비 위험채권의 수익률 차이

신용위험프리미엄 (Credit Risk Premium)
  — 부도 위험에 대한 보상으로 요구되는 추가 수익률

야코비안 (Jacobian)
  — 다변량 함수의 편미분 행렬. Newton-Raphson 반복법에 사용

자산가치 (Firm Asset Value, V)
  — 기업 총자산의 시장가치. 직접 관측 불가, 주가에서 역산

자산변동성 (Asset Volatility, σ_V)
  — 자산가치의 변동성. σ_E (주가변동성)에서 역산

자산상관 (Asset Correlation, ρ)
  — Vasicek 모형에서 기업 간 잠재변수의 상관. 동시부도의 핵심 결정요인

전이행렬 (Transition Matrix)
  — 신용등급 간 1년(또는 n년) 이동 확률의 행렬

조정할인율 (Adjusted Short Rate, r̃)
  — Duffie-Singleton 모형에서 r̃ = r + λ(1-R)

축약형 모형 (Reduced-Form Model)
  — 부도를 외생적 Poisson 과정으로 모형화하는 접근 (JT, DS)

코플라 (Copula)
  — 주변분포와 종속구조를 분리하여 다변량 분포를 모형화하는 함수

풋-콜 패리티 (Put-Call Parity)
  — C - P = S - K·e^(-rT). Merton 모형에서 V = E + D의 근거

회수율 (Recovery Rate, R)
  — 부도 발생 시 원금 대비 회수 비율 (0 ≤ R ≤ 1)
```

---

*본 문서의 내용은 학술 이론과 모형 해설이며, 특정 종목에 대한
투자 권유가 아닙니다. 실제 투자 의사결정에는 별도의 전문가
상담과 종합적 분석이 필요합니다. 모형의 수치 예시는 설명
목적이며 실제 시장 데이터와 다를 수 있습니다.*

---

**Document Metadata:**
```
문서 번호: 47
제목: 신용위험 모형 (Credit Risk Models)
작성일: 2026-04-03
버전: 1.0
총 라인: ~2,250
섹션: 8 (본문 7 + 부록 4)
수식: 30+ (번호 부여)
수치 예시: 6 (삼성전자, 고위험 가상, 채권가격 등)
교차참조: Doc 05, 14, 25, 35, 41, 43, 44, 45
핵심 키워드: Merton, KMV, DD, EDF, Jarrow-Turnbull, Duffie-Singleton,
            Vasicek, Basel IRB, Gaussian Copula, CDS-Bond Basis
```
