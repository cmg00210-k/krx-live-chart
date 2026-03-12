# 02. 통계학적 방법론 — Statistical Methods

> 기술적 지표는 본질적으로 통계적 추정이다.
> RSI는 모멘텀의 비율 추정, 볼린저 밴드는 정규분포 가정 하의 신뢰구간이다.

---

## 1. 기술통계와 분포

### 1.1 수익률 분포의 특성

```
로그 수익률: rₜ = ln(Pₜ/Pₜ₋₁)

기대값: μ = E[rₜ]
분산: σ² = E[(rₜ - μ)²]
왜도: S = E[(rₜ - μ)³] / σ³
첨도: K = E[(rₜ - μ)⁴] / σ⁴
```

실증적 사실 (Stylized Facts):
1. **두꺼운 꼬리 (Fat Tails)**: K > 3 (정규분포 K=3)
   - Mandelbrot (1963) 최초 발견, 면화 가격 연구
   - 극단적 가격 변동이 정규분포 예측보다 10~100배 빈번

2. **변동성 군집 (Volatility Clustering)**: 큰 변동 뒤에 큰 변동
   - Engle (1982) ARCH 모형으로 정식화
   - "변동성은 변동한다" — 자기상관 구조

3. **비대칭성 (Skewness)**: S < 0 (좌측 꼬리가 더 두꺼움)
   - 하락이 상승보다 급격함

4. **장기 기억 (Long Memory)**: 수익률의 절대값에 느린 자기상관 감쇠

Cont, R. (2001), *Empirical Properties of Asset Returns: Stylized Facts
and Statistical Issues*, Quantitative Finance — 실증적 사실 종합 논문

### 1.2 정규분포 vs 실제 분포

```
정규분포: f(x) = (1/σ√2π) · exp(-(x-μ)²/2σ²)

Student-t 분포: 자유도 ν가 작을수록 꼬리가 두꺼움
  → 금융 수익률 피팅에 더 적합 (ν ≈ 3~5)

일반화 극단값 분포 (GEV): 극단적 사건(급등/급락) 모델링
```

볼린저 밴드의 한계: ±2σ는 정규분포 하 95.4% 신뢰구간이나,
실제 금융 수익률의 꼬리가 두꺼우므로 이탈 빈도가 4.6%보다 높다.

※ 볼린저 밴드 신뢰구간 보정:
  ±2σ 커버리지 (이론값 vs 실증값):
    정규분포:     95.4%
    Student-t(ν=5): ~93.0%
    Student-t(ν=4): ~92.0%
    실제 금융 수익률:  ~90~93% (두꺼운 꼬리)

  → ±2σ 밴드 이탈 빈도:
    이론(정규분포): 4.6%
    실제(금융 데이터): 7~10%
  → 밴드 이탈 기반 전략의 백테스트 시 이 차이를 반영해야 함

  보정 방법:
    1) 적응형 밴드 폭: Student-t 분위수 사용 (±2.13σ for ν=5, 95%)
    2) GARCH 조건부 σ: 시변 변동성 반영
    3) EVT 기반 밴드: 극단값 이론의 꼬리 분위수 사용

---

## 2. 시계열 분석 (Time Series Analysis)

### 2.1 정상성 (Stationarity)

**약한 정상성 (Weak Stationarity)**:
```
1) E[Xₜ] = μ  (평균 일정)
2) Var(Xₜ) = σ²  (분산 일정)
3) Cov(Xₜ, Xₜ₊ₕ) = γ(h)  (자기공분산이 시차 h에만 의존)
```

주가 자체는 비정상(non-stationary)이지만,
수익률(1차 차분)은 근사적으로 정상적이다.

**ADF 검정 (Augmented Dickey-Fuller Test)**:
단위근(unit root) 존재 여부 검정. H₀: 단위근 존재 (비정상)

Dickey & Fuller (1979), *Distribution of the Estimators for Autoregressive
Time Series with a Unit Root*, JASA

### 2.2 자기상관 함수 (ACF)와 편자기상관 함수 (PACF)

```
자기상관: ρ(h) = γ(h) / γ(0)

γ(h) = Cov(Xₜ, Xₜ₊ₕ)
```

금융 적용:
- ACF 분석으로 시계열의 기억 구조를 파악
- PACF로 AR(p) 모형의 차수 결정
- 수익률의 ACF ≈ 0 (EMH와 일치)
- |수익률|의 ACF > 0 (변동성 군집 = GARCH 효과)

### 2.3 ARIMA 모형

Box & Jenkins (1970), *Time Series Analysis: Forecasting and Control*

```
ARIMA(p, d, q):

AR(p): Xₜ = φ₁Xₜ₋₁ + φ₂Xₜ₋₂ + ... + φₚXₜ₋ₚ + εₜ
MA(q): Xₜ = εₜ + θ₁εₜ₋₁ + θ₂εₜ₋₂ + ... + θqεₜ₋q
I(d): d차 차분으로 정상화

결합: φ(B)(1-B)ᵈXₜ = θ(B)εₜ
```

- p: AR 차수 (PACF에서 결정)
- d: 차분 차수 (ADF 검정)
- q: MA 차수 (ACF에서 결정)

※ 현대적 위치 (2020+ 기준):
  ARIMA는 교육용으로는 여전히 가치 있으나, 실전 고빈도 트레이딩에서는:
  - 선형 관계 가정: 시장의 비선형 동학을 포착하지 못함
  - 변동성 무시: GARCH 효과를 모형화하지 않음
  - 현대 대안: GARCH/EGARCH (변동성 모형), 레짐 전환 모형,
    LSTM/Transformer (딥러닝 시계열 예측)
  그러나 기초 개념(차분, 자기상관, 정상성)은 모든 시계열 분석의 토대

### 2.4 GARCH 모형

Bollerslev (1986), *Generalized Autoregressive Conditional Heteroskedasticity*

```
GARCH(1,1):
rₜ = μ + εₜ,  εₜ = σₜ · zₜ,  zₜ ~ N(0,1)
σₜ² = ω + α·εₜ₋₁² + β·σₜ₋₁²
```

- α: 직전 충격의 영향 (ARCH 효과)
- β: 이전 변동성의 지속 (GARCH 효과)
- α + β < 1: 안정 조건
- α + β ≈ 1: 변동성 지속성 높음 (IGARCH)

금융 적용: 볼린저 밴드의 σ를 고정 기간 표준편차 대신
GARCH 조건부 변동성으로 대체하면 적응형 밴드 구현 가능.

※ GARCH(1,1) 구현 주의사항:
  1) 초기값 설정:
     σ₁² = 표본 분산 (전체 데이터 또는 첫 n기간의 분산)
     → 초기값 선택에 따라 처음 ~30봉의 σ가 달라짐

  2) 양수 보장:
     이론적으로 ω > 0, α ≥ 0, β ≥ 0이면 σₜ² > 0
     실제 수치 계산에서 부동소수점 오차로 음수 가능
     → max(σₜ², 1e-8) 등의 안전 장치 필요

  3) 정상성 조건: α + β < 1
     α + β ≥ 1이면 IGARCH (분산이 무한대로 발산)
     → 파라미터 추정 시 α + β < 0.999 제약 권장

Robert Engle (2003 노벨 경제학상), *Autoregressive Conditional
Heteroskedasticity with Estimates of the Variance of United Kingdom
Inflation*, Econometrica (1982) — ARCH 모형 원전

---

## 3. 모멘텀과 RSI의 통계적 기초

### 3.1 RSI의 통계적 해석

J. Welles Wilder, *New Concepts in Technical Trading Systems* (1978)

```
RS = 평균 상승폭 / 평균 하락폭
RSI = 100 - 100/(1 + RS)

Wilder 평활:
avgGain(t) = [avgGain(t-1) · (n-1) + gain(t)] / n
avgLoss(t) = [avgLoss(t-1) · (n-1) + loss(t)] / n
```

통계적 해석:
- RSI = 상승 확률의 추정치 × 100
- RSI 50 = 상승/하락 확률 동일
- RSI 70+ = 상승 빈도가 하락의 2.3배 이상
- RSI 30- = 하락 빈도가 상승의 2.3배 이상

※ RSI 구현 시 주의사항:
  1) 0으로 나누기 방지:
     avgGain = 0 이고 avgLoss = 0 (가격 변동 없음) → RS 정의 불가
     → RSI = 50으로 설정 (중립)

  2) 단위: Wilder 원본(1978)은 절대 가격 변화(원) 사용.
     현대 구현은 퍼센트 수익률(%) 사용이 일반적.
     → 절대값 사용 시: 가격 수준이 다른 종목 간 RSI 비교 불가
     → 퍼센트 사용 시: 종목 간 비교 가능 (권장)

  3) 첫 계산 방법:
     처음 n기간: 단순 평균(SMA)으로 avgGain, avgLoss 계산
     이후: 지수 평활(EMA 방식)으로 갱신
     → 플랫폼마다 차이 발생 (TradingView vs MT5: 첫 14봉에서 3~5pt 차이)

### 3.2 모멘텀의 자기상관 구조

Jegadeesh & Titman (1993), *Returns to Buying Winners and Selling Losers:
Implications for Stock Market Efficiency*, Journal of Finance

- 3~12개월 수익률에 양의 자기상관 (모멘텀 효과)
- 12개월 이상에서 음의 자기상관 (평균 회귀)
- → RSI, MACD 등 모멘텀 지표의 실증적 근거

---

## 4. 회귀분석 (Regression Analysis)

### 4.1 최소제곱법 (OLS)

Carl Friedrich Gauss (1809)

```
y = β₀ + β₁x + ε

β₁ = Σ(xᵢ - x̄)(yᵢ - ȳ) / Σ(xᵢ - x̄)²
β₀ = ȳ - β₁x̄
```

금융 적용: 추세선(trendline)의 수학적 정의.
스윙 고점/저점을 통과하는 최적 직선 = OLS 회귀선.

### 4.2 선형 추세 채널

```
가격 추세선: P(t) = a + bt
상단 채널: P(t) + kσ_residual
하단 채널: P(t) - kσ_residual
```

현재 시스템의 쐐기형/삼각형 패턴 탐지가
본질적으로 두 회귀선의 기울기 비교이다.

### 4.3 로지스틱 회귀 (Logistic Regression)

```
P(상승) = 1 / (1 + e^(-(β₀ + β₁x₁ + β₂x₂ + ...)))
```

금융 적용: 여러 기술적 지표(RSI, MACD, 볼린저 위치 등)를
입력으로 하여 상승/하락 확률을 추정하는 분류 모형.

---

## 5. 베이지안 추론 (Bayesian Inference)

### 5.1 베이지안 업데이트

Thomas Bayes (1763), *An Essay towards solving a Problem in the
Doctrine of Chances*

```
사후 ∝ 가능도 × 사전

P(θ|D) ∝ P(D|θ) · P(θ)
```

금융 적용: 기술적 패턴을 "새로운 데이터"로 보고
추세 방향에 대한 신념(belief)을 갱신하는 프레임워크.

예시:
- 사전: P(상승추세) = 0.5
- 적삼병 관측: P(적삼병|상승추세) = 0.7, P(적삼병|하락추세) = 0.1
- 사후: P(상승추세|적삼병) = 0.7×0.5 / (0.7×0.5 + 0.1×0.5) = 0.875

### 5.2 다중 패턴의 베이지안 결합

여러 패턴이 동시에 나타날 때:
```
P(상승|패턴₁, 패턴₂, ...) ∝ P(상승) · Π P(패턴ᵢ|상승)
```

(나이브 베이즈 가정 — 패턴 간 조건부 독립)

금융 적용: PatternEngine이 여러 패턴을 동시 감지할 때,
각 패턴의 신호를 베이지안으로 결합하면
단일 패턴보다 정확한 방향 추정 가능.

---

## 6. 몬테카를로 시뮬레이션 (Monte Carlo)

### 6.1 기본 원리

Stanislaw Ulam & John von Neumann (1946), 맨해튼 프로젝트

```
1) 모형 정의: dS = μSdt + σSdW (GBM 등)
2) 다수의 경로 생성: N = 10,000+ 시뮬레이션
3) 통계량 추정: 평균, 분위수, 꼬리 확률 등
```

### 6.2 금융 적용

1. **VaR (Value at Risk) 추정**:
   ```
   VaR(95%) = -Q₀.₀₅(수익률 분포)
   ```
   "95% 확률로 최대 손실이 VaR 이하"

2. **전략 백테스팅**:
   과거 데이터 기반 + 합성 데이터 생성으로
   기술적 분석 전략의 기대수익·리스크 추정

3. **부트스트랩 (Bootstrap)**:
   Efron (1979), 표본 재추출로 통계량의 신뢰구간 추정
   → 기술적 지표의 유의성 검정에 활용

※ 금융 시계열의 부트스트랩:
  표준 부트스트랩은 i.i.d. 가정 → 금융 데이터에 부적합 (자기상관 존재)

  권장: 블록 부트스트랩 (Block Bootstrap)
    - 연속 블록(길이 l)을 단위로 복원 추출
    - 블록 크기: l ≈ T^(1/3) (Lahiri, 2003)
    - 예: T = 1000거래일 → l ≈ 10일
    → 자기상관, 변동성 클러스터링 구조 보존

---

## 7. 비모수 통계 (Non-parametric Statistics)

### 7.1 순위 기반 검정

분포 가정 없이 사용 가능:
- **Mann-Whitney U 검정**: 두 집단의 중앙값 비교
- **Wilcoxon 부호순위 검정**: 대응표본 비교
- **Spearman 순위 상관계수**: 비선형 단조 관계

금융 적용: 패턴 발생 전후의 수익률 비교에 적합.
"적삼병 이후 5봉 수익률 > 무작위 5봉 수익률" 검정.

### 7.2 커널 밀도 추정 (KDE)

```
f̂(x) = (1/nh) Σ K((x - xᵢ)/h)
```

금융 적용: 수익률 분포를 비모수적으로 추정.
히스토그램보다 매끄럽고, 정규분포 가정이 불필요.

---

## 핵심 통계량 요약

| 통계량 | 공식 | 기술적 분석 대응 |
|--------|------|-----------------|
| 이동 평균 | (1/n)ΣP | SMA (MA) |
| 지수 평활 | αP + (1-α)EMA' | EMA |
| 표준편차 | √[(1/n)Σ(P-μ)²] | 볼린저 밴드 폭 |
| 상대강도 비율 | avgGain/avgLoss | RSI |
| 두 EMA의 차 | EMA(fast) - EMA(slow) | MACD |
| 자기상관 | γ(h)/γ(0) | 추세 지속성 판단 |
| 조건부 분산 | ω + αε² + βσ² | GARCH 변동성 |
