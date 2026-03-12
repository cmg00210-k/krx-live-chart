# 01. 수학적 기초 — Mathematics Foundations

> 기술적 분석의 모든 지표와 패턴은 수학적 연산에 기반한다.
> 이 문서는 금융 시계열 분석에 필수적인 수학 이론을 정리한다.

---

## 1. 확률론 (Probability Theory)

### 1.1 기본 공리 — Kolmogorov 공리 체계 (1933)

Andrey Kolmogorov, *Grundbegriffe der Wahrscheinlichkeitsrechnung* (1933)

확률 공간 (Ω, F, P):
- Ω: 표본공간 (가능한 모든 결과의 집합)
- F: σ-대수 (사건들의 집합체)
- P: 확률 측도 (P(Ω) = 1)

금융 적용: 주가의 가능한 모든 미래 경로가 Ω를 구성하며,
각 경로에 확률을 부여하여 기대값, 분산 등을 계산한다.

### 1.2 조건부 확률과 베이즈 정리

```
P(A|B) = P(B|A) · P(A) / P(B)
```

금융 적용: "RSI가 30 이하일 때(B) 향후 5봉 내 반등할 확률(A)"을 계산하는 프레임워크.
사전확률 P(A)에 새로운 시장 정보 B를 반영하여 사후확률 P(A|B)를 갱신한다.

### 1.3 큰 수의 법칙 & 중심극한정리

**큰 수의 법칙 (Law of Large Numbers)**:
표본 평균은 표본 크기가 커질수록 모평균에 수렴한다.
```
lim(n→∞) (1/n) Σ Xᵢ = μ   (거의 확실하게)
```

**중심극한정리 (Central Limit Theorem)**:
독립 확률변수의 합은 정규분포에 수렴한다.
```
√n (X̄ₙ - μ) / σ  →  N(0, 1)
```

금융 적용: 볼린저 밴드가 정규분포 가정 하에 ±2σ를 사용하는 근거.
단, 금융 수익률은 두꺼운 꼬리(fat tail)를 가지므로 이 가정은 불완전하다.
→ Mandelbrot의 프랙탈 시장 가설로 보완 (§5 참조)

### 1.4 마르팅게일 이론

**마르팅게일 (Martingale)**:
```
E[Xₙ₊₁ | X₁, X₂, ..., Xₙ] = Xₙ
```
미래 가격의 기대값이 현재 가격과 같은 과정.
효율적 시장 가설(EMH)의 수학적 표현이다.

**서브마르팅게일**: E[Xₙ₊₁ | ...] ≥ Xₙ (상승 추세)
**슈퍼마르팅게일**: E[Xₙ₊₁ | ...] ≤ Xₙ (하락 추세)

금융 적용: 기술적 분석은 본질적으로 "시장이 마르팅게일이 아니다"는 가설에 기반한다.
즉, 과거 가격 패턴에서 미래 방향에 대한 정보를 추출할 수 있다는 전제.

※ 마르팅게일의 정밀한 적용:
  EMH의 주장: "로그수익률이 마르팅게일" → E[ln(Pₜ₊₁/Pₜ) | Φₜ] = μ (상수)
  가격 자체는 마르팅게일이 아님: Jensen 부등식에 의해
    E[Pₜ₊₁ | Φₜ] = Pₜ · exp(μ + σ²/2) ≠ Pₜ
  → 기술적 분석이 "가격 패턴"을 탐지하는 것은
    EMH와 직접 모순되지 않을 수 있음 (수익률 예측이 아닌 가격 수준 분석)

---

## 2. 확률과정 (Stochastic Processes)

### 2.1 랜덤워크 (Random Walk)

Louis Bachelier, *Théorie de la spéculation* (1900) — 최초의 금융 수학 논문

```
Sₜ = Sₜ₋₁ + εₜ,    εₜ ~ N(0, σ²)
```

주가가 랜덤워크를 따른다면 기술적 분석은 무용하다.
Burton Malkiel의 *A Random Walk Down Wall Street* (1973)가 이 입장을 대중화했다.

반론: Andrew Lo, *A Non-Random Walk Down Wall Street* (1999)
→ 자기상관(autocorrelation)과 이분산성(heteroskedasticity)의 통계적 증거 제시

### 2.2 브라운 운동 (Brownian Motion / Wiener Process)

Robert Brown (1827, 생물학), Norbert Wiener (1923, 수학적 정식화)

```
dWₜ는 다음 성질을 만족:
1) W₀ = 0
2) 독립 증분: Wₜ - Wₛ는 (s,t) 외부 정보와 독립
3) 정규 증분: Wₜ - Wₛ ~ N(0, t-s)
4) 연속 경로
```

### 2.3 기하 브라운 운동 (Geometric Brownian Motion)

Black-Scholes 모형의 기초:
```
dSₜ = μSₜdt + σSₜdWₜ

해: Sₜ = S₀ · exp((μ - σ²/2)t + σWₜ)
```

- μ: 드리프트 (기대 수익률)
- σ: 변동성 (volatility)
- Wₜ: 위너 과정

금융 적용: 일봉/분봉 가격 시뮬레이션의 이론적 모형.
현재 시스템의 api.js의 데모 데이터 생성이 이 모형의 이산화 버전이다.

※ σ (변동성) 단위 명확화:
  본 문서에서 σ는 문맥에 따라 다른 의미를 가짐:

  (a) σ_GBM: 기하브라운운동의 확산 계수 = 연환산 수익률 변동성
      단위: 무차원 (예: 0.30 = 연 30%)
      일환산: σ_daily = σ_annual / √252

  (b) σ_price: 가격의 표준편차 (볼린저 밴드에서 사용)
      단위: 원 (KRW)
      σ_price ≠ σ_return (차원이 다름!)

  (c) σ_return: 수익률의 표준편차
      단위: 무차원 (예: 0.02 = 일 2%)

  실무 규칙: 볼린저 밴드의 σ는 (b) 가격 표준편차,
  CAPM·BSM의 σ는 (a) 또는 (c) 수익률 변동성.
  두 값을 혼용하면 계산 오류 발생.

### 2.4 점프-확산 모형 (Jump-Diffusion Model)

Robert Merton (1976), *Option pricing when underlying stock returns are discontinuous*

```
dSₜ/Sₜ = (μ - λk)dt + σdWₜ + JdNₜ
```

- Nₜ: 포아송 과정 (점프 발생)
- J: 점프 크기 (로그정규분포)
- λ: 점프 강도

금융 적용: 급등/급락(갭)을 포함한 실제 주가 모델링.
캔들 패턴의 "갭업/갭다운"이 점프에 해당한다.

---

## 3. 이동평균의 수학적 기초

### 3.1 단순 이동평균 (SMA)

```
SMA(n, t) = (1/n) Σᵢ₌₀ⁿ⁻¹ Pₜ₋ᵢ
```

- FIR(Finite Impulse Response) 필터의 일종
- 주파수 응답: H(ω) = sin(nω/2) / (n·sin(ω/2))
- 위상 지연: (n-1)/2 기간

### 3.2 지수 이동평균 (EMA)

```
EMA(t) = α · Pₜ + (1-α) · EMA(t-1)

α = 2/(n+1)  (평활 계수)
```

- IIR(Infinite Impulse Response) 필터
- 지수적 감쇠 가중치: wₖ = α(1-α)ᵏ
- SMA 대비 장점: 최근 데이터에 더 많은 가중, 위상 지연 감소

참고: Robert D. Edwards & John Magee, *Technical Analysis of Stock Trends* (1948)
→ 이동평균 교차(Golden Cross/Death Cross) 전략의 원전

### 3.3 가중 이동평균 (WMA)

```
WMA(n, t) = Σᵢ₌₀ⁿ⁻¹ (n-i) · Pₜ₋ᵢ / Σᵢ₌₀ⁿ⁻¹ (n-i)
```

선형 감소 가중치. EMA와 SMA의 중간적 특성.

### 3.4 적응형 이동평균 (Kaufman's Adaptive MA, KAMA)

Perry Kaufman, *Trading Systems and Methods* (1995)

```
효율 비율: ER = |Pₜ - Pₜ₋ₙ| / Σᵢ₌₁ⁿ |Pₜ₋ᵢ₊₁ - Pₜ₋ᵢ|

평활 상수: SC = [ER · (fast - slow) + slow]²
  fast = 2/(2+1),  slow = 2/(30+1)

KAMA(t) = KAMA(t-1) + SC · (Pₜ - KAMA(t-1))
```

추세 구간에서는 빠르게, 횡보 구간에서는 느리게 반응하는 적응형 필터.

---

## 4. 푸리에 분석과 웨이블릿 (Fourier & Wavelet Analysis)

### 4.1 이산 푸리에 변환 (DFT)

Jean-Baptiste Joseph Fourier (1807)

```
X(k) = Σₙ₌₀ᴺ⁻¹ x(n) · e^(-j2πkn/N)
```

금융 적용: 가격 시계열을 주파수 성분으로 분해.
- 저주파 = 장기 추세
- 고주파 = 단기 노이즈
- 특정 주파수의 우세 = 주기성 (cycle)

한계: 시간 정보가 상실됨. "언제" 주파수가 변했는지 알 수 없음.

### 4.2 웨이블릿 변환 (Wavelet Transform)

Ingrid Daubechies, *Ten Lectures on Wavelets* (1992)

```
W(a, b) = (1/√a) ∫ x(t) · ψ*((t-b)/a) dt
```

- a: 스케일 (주파수 대역)
- b: 위치 (시간)
- ψ: 모 웨이블릿 (Morlet, Daubechies 등)

금융 적용:
- 다중 시간프레임 분석의 수학적 정당화
- 추세와 노이즈의 분리 (denoising)
- 1분봉과 일봉의 동시 분석 = 서로 다른 스케일의 웨이블릿 계수

Ramsey & Lampart (1998), *The Decomposition of Economic Relationships by
Time Scale Using Wavelets* — 경제 시계열의 웨이블릿 분해 선구 논문

### 4.3 힐버트-황 변환 (HHT / Empirical Mode Decomposition)

Norden Huang et al. (1998), NASA

비선형·비정상 시계열 분석:
1. EMD로 내재 모드 함수(IMF) 추출
2. 힐버트 변환으로 순시 주파수 계산

금융 적용: 비정상(non-stationary) 주가 시계열에 푸리에보다 적합.
추세 변환 시점을 정밀하게 포착 가능.

---

## 5. 프랙탈 기하학 (Fractal Geometry)

### 5.1 자기유사성과 프랙탈 차원

Benoit Mandelbrot, *The Fractal Geometry of Nature* (1982)

```
프랙탈 차원 D:
N(ε) ~ ε^(-D)

여기서 N(ε)은 크기 ε으로 대상을 덮는 데 필요한 상자의 수.
```

금융 적용: 주가 차트는 시간 스케일에 무관하게 유사한 패턴을 보인다.
1분봉, 1시간봉, 일봉의 패턴이 통계적으로 유사 = 자기유사성.

### 5.2 허스트 지수 (Hurst Exponent)

Harold Edwin Hurst (1951), 나일강 범람 연구에서 발견

```
R/S 분석:
E[R(n)/S(n)] = C · n^H

H = 허스트 지수 (0 < H < 1)
```

- H = 0.5: 랜덤워크 (독립적)
- H > 0.5: 지속성 (trending) — 추세 추종 전략 유효
- H < 0.5: 반지속성 (mean-reverting) — 역추세 전략 유효

금융 적용:
- H > 0.5인 종목 → MA 교차, 추세 추종 전략 적용
- H < 0.5인 종목 → 볼린저 밴드, RSI 역추세 전략 적용
- H 값에 따라 최적 전략 유형을 결정할 수 있음

※ H와 α의 관계 — 정밀한 구분:
  H = 1/α 는 Lévy flight (안정 분포)에서만 성립.

  금융 시장의 수익률 분포 (멱법칙 꼬리, α ≈ 3):
    H ≈ 0.5~0.6 (실증값, Lo 1991)
    1/α = 1/3 ≈ 0.33 (Lévy 관계)
    → 불일치! 금융 수익률은 순수 Lévy가 아님

  올바른 해석:
    - α: 분포의 꼬리 두께 (정적 속성)
    - H: 시계열의 장기 기억 (동적 속성)
    - 두 속성은 독립적으로 측정해야 함
    - H는 R/S 분석 또는 DFA로, α는 Hill 추정량으로 각각 추정

### 5.3 프랙탈 시장 가설 (Fractal Market Hypothesis)

Edgar Peters, *Fractal Market Analysis* (1994)

정규분포 가정(EMH)의 대안:
- 시장 수익률은 안정 레비 분포(Lévy stable distribution)를 따름
- 꼬리가 두꺼움(fat tails) → 극단적 사건이 정규분포 예측보다 빈번
- 변동성 군집(volatility clustering) → GARCH 모형과 연결

```
안정 분포 특성 함수:
φ(t) = exp(iμt - |ct|^α · (1 - iβ·sign(t)·tan(πα/2)))

α = 특성 지수 (α < 2이면 무한 분산)
β = 비대칭 매개변수
```

---

## 6. 카오스 이론 (Chaos Theory)

### 6.1 결정론적 카오스

Edward Lorenz (1963), MIT — 기상학 연구에서 발견

```
로렌츠 시스템:
dx/dt = σ(y - x)
dy/dt = x(ρ - z) - y
dz/dt = xy - βz
```

초기조건에 민감한 의존성 (나비효과):
결정론적 시스템도 장기 예측이 불가능할 수 있다.

### 6.2 리아푸노프 지수 (Lyapunov Exponent)

```
λ = lim(t→∞) (1/t) ln |δx(t)/δx(0)|
```

- λ > 0: 카오스적 (궤적이 지수적으로 발산)
- λ = 0: 주기적
- λ < 0: 안정적 (수렴)

금융 적용: 주가 시계열의 리아푸노프 지수가 양수이면
단기 예측은 가능하나 장기 예측은 불가능.
→ 기술적 분석이 "단기" 전략에 유효한 이론적 근거

### 6.3 로지스틱 맵과 분기

```
xₙ₊₁ = r · xₙ · (1 - xₙ)

r < 3: 안정 고정점
r ≈ 3.57: 카오스 시작
r = 4: 완전한 카오스
```

금융 적용: 시장의 안정 → 불안정 → 카오스 전환이
로지스틱 맵의 분기 구조와 유사하다는 연구.

---

## 7. 정보이론 (Information Theory)

### 7.1 섀넌 엔트로피

Claude Shannon, *A Mathematical Theory of Communication* (1948)

```
H(X) = -Σ p(xᵢ) · log₂ p(xᵢ)
```

금융 적용:
- 수익률 분포의 엔트로피 = 시장의 불확실성 수준
- 엔트로피 증가 → 방향성 감소 → 횡보 구간
- 엔트로피 감소 → 방향성 증가 → 추세 구간

### 7.2 상호정보량 (Mutual Information)

```
I(X;Y) = Σ Σ p(x,y) · log₂ [p(x,y) / (p(x)·p(y))]
```

금융 적용: 두 지표(RSI와 MACD 등) 사이의 비선형적 의존성을 측정.
상관계수(Pearson)보다 일반적인 의존성 측도.

---

## 핵심 공식 요약 (시스템 구현 매핑)

| 공식 | 시스템 구현 | 파일 |
|------|------------|------|
| SMA = (1/n)ΣP | calcMA() | chart.js |
| EMA = αP + (1-α)EMA' | calcEMA() | chart.js |
| BB = SMA ± kσ | calcBB() | chart.js |
| RSI = 100 - 100/(1+RS) | calcRSI() | chart.js |
| MACD = EMA(12) - EMA(26) | calcMACD() | chart.js |
| 허스트 지수 H (R/S 분석) | 미구현 (향후 추가 권장) | — |
| 웨이블릿 디노이징 | 미구현 (고도화 후보) | — |
| 섀넌 엔트로피 | 미구현 (고도화 후보) | — |
