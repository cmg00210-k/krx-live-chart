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

## 8. James-Stein 수축 추정 (James-Stein Shrinkage Estimation)

### 8.1 이론적 배경

James & Stein (1961), *Estimation with Quadratic Loss*,
Proceedings of the Fourth Berkeley Symposium on Mathematical Statistics and Probability

3차원 이상의 다변량 정규분포에서 최대우도추정량(MLE)보다
전체 평균 방향으로 "수축(shrink)"시킨 추정량이 제곱 손실 하에서
**항상** 더 작은 위험(risk)을 갖는다는 비자명한 결과.

```
Stein 추정량:
  θ_JS = (1 - c / ||X||^2) * X + (c / ||X||^2) * μ_prior

  c = (p - 2) * σ^2   (p = 차원 수, σ^2 = 분산)
```

핵심 통찰: 개별 추정치를 전체 평균(또는 사전 지식)으로 끌어당기면,
극단적 추정치의 오차가 크게 줄어들어 전체적으로 더 정확해진다.
"동시 추정(simultaneous estimation)"에서의 편향-분산 교환(bias-variance tradeoff)의
가장 극적인 예시.

### 8.2 경험적 베이즈 해석

Efron & Morris (1973), *Stein's Estimation Rule and Its Competitors — An Empirical
Bayes Approach*, Journal of the American Statistical Association

James-Stein 추정량은 경험적 베이즈 사후평균과 동일한 형태:

```
사후평균 (Empirical Bayes Posterior Mean):

  θ_EB = (nEff / (nEff + k)) * θ_MLE + (k / (nEff + k)) * θ_prior

  nEff: 유효 관측 수 (effective sample size)
  k:    사전 강도 (prior strength) — 사전분포의 유효 관측 수 등가
  θ_MLE:  최대우도추정량 (관측 데이터에서 온 추정치)
  θ_prior: 사전 평균 (데이터 부족 시 수축 목표)
```

수축 비율 shrinkage = nEff / (nEff + k) 는:
- nEff >> k: shrinkage -> 1 (데이터 풍부 -> MLE 신뢰)
- nEff << k: shrinkage -> 0 (데이터 부족 -> 사전 신뢰)

### 8.3 Hurst 지수 수축 (패턴 엔진 적용)

PatternEngine에서 Hurst 지수(H)의 소표본 불안정성을 보정하기 위해
James-Stein 수축을 적용한다.

```
코드 공식 (patterns.js:230-237):

  nEff = floor(log(N/20) / log(1.5))
  shrinkage = nEff / (nEff + 20)
  hShrunk = shrinkage * H + (1 - shrinkage) * 0.5
  hurstWeight = clamp(2 * hShrunk, 0.6, 1.4)
```

각 파라미터의 의미:

1) **사전 평균 = 0.5 [A등급: 학술 불변]**
   효율적 시장 가설(EMH) 하에서 H = 0.5 = 랜덤워크.
   데이터가 충분하지 않으면 "이 종목의 추세 지속성은 모른다"로 수축.
   Fama (1970) Efficient Market Hypothesis의 정의적 값.

2) **사전 강도 k = 20 [C등급: 교정 가능]**
   "20개 유효 관측치와 동등한 사전 신뢰도"를 의미.
   Hurst R/S 분석의 부분표본(sub-sample)이 비독립적이므로
   실제 관측 수보다 유효 관측 수가 훨씬 적다는 점을 반영.
   최적값은 KRX 데이터로 교정 가능하나, 현재는 실증적 선택.

3) **nEff = floor(log(N/20) / log(1.5)) [D등급: 실증적 선택]**
   데이터 N개 증가에 대해 유효 관측치가 로그적으로 체감.
   R/S 분석에서 부분표본 간 겹침(overlap)으로 인해
   데이터가 2배 늘어도 유효 정보는 약 1.5배만 늘어나는 점을 반영.
   밑수 1.5는 학술 논문에서 특정된 값이 아닌 설계자 선택(D등급).

   nEff 값 예시:
     N = 30  (신규 상장): nEff = floor(log(1.5)/log(1.5)) = 1 -> clamp -> 2
     N = 60:  nEff = 2
     N = 200: nEff = 5
     N = 500: nEff = 7
     N = 1000: nEff = 9

   -> N=30 종목: shrinkage = 2/22 = 0.09 -> hShrunk ~= 0.5 (거의 사전)
   -> N=1000 종목: shrinkage = 9/29 = 0.31 -> hShrunk는 H와 0.5의 가중평균

4) **hurstWeight = clamp(2 * hShrunk, 0.6, 1.4)**
   hShrunk(0.3~0.7 범위)을 0.6~1.4 가중치로 선형 변환.
   승수 2와 클램프 경계는 B등급(설계자 선택).

시장 심리 해석:
  데이터가 부족한 종목(신규 상장, IPO 직후)에서는 Hurst 추정치가
  불안정하므로 hw가 0.5 방향(중립)으로 수축되어 과신(overconfidence)을 방지.
  데이터가 풍부한 종목에서는 관측된 H값이 더 큰 비중을 차지한다.

참고문헌:
  James, W. & Stein, C. (1961), *Estimation with Quadratic Loss*,
    Proc. Fourth Berkeley Symp. on Math. Stat. and Prob., Vol. 1, pp. 361-379
  Efron, B. & Morris, C. (1973), *Stein's Estimation Rule and Its Competitors*,
    JASA, Vol. 68, No. 341, pp. 117-130
  Efron, B. & Morris, C. (1975), *Data Analysis Using Stein's Estimator and
    Its Generalizations*, JASA, Vol. 70, No. 350, pp. 311-319

코드 매핑: patterns.js:230-237 (hw 계산 블록)

---

## 9. 평균 회귀 지수 감쇠 모델 (Mean Reversion Exponential Decay)

### 9.1 이론적 배경: 과잉반응과 평균 회귀

DeBondt & Thaler (1985), *Does the Stock Market Overreact?*,
Journal of Finance, Vol. 40, No. 3, pp. 793-805

과거 3-5년간 극단적 수익률을 기록한 "패자(Loser)" 포트폴리오가
"승자(Winner)" 포트폴리오를 유의하게 초과 수익:
- 36개월 기준 패자-승자 CAR = +24.6%
- 시장 효율성의 과잉반응 가설(Overreaction Hypothesis) 제시

Poterba & Summers (1988), *Mean Reversion in Stock Prices: Evidence and
Implications*, Journal of Financial Economics, Vol. 22, pp. 27-59

- 주식 수익률의 분산비(variance ratio) 검정으로 평균 회귀 확인
- 장기(3-5년) 수익률에서 음의 자기상관 = 평균 회귀 증거
- 평균 회귀 반감기는 시장/기간에 따라 3-5년(월간 수익률 기준)

### 9.2 Ornstein-Uhlenbeck 과정과 반감기

연속 시간 평균 회귀의 표준 모형:

```
Ornstein-Uhlenbeck (OU) 과정:

  dX(t) = kappa * (mu - X(t)) * dt + sigma * dW(t)

  kappa: 평균 회귀 속도 (mean reversion speed)
  mu:    장기 평균 (long-run mean)
  sigma: 확산 계수 (diffusion coefficient)

반감기 (half-life):
  t_half = ln(2) / kappa

  -> 현재 이격이 50%로 줄어드는 데 걸리는 시간
  -> kappa가 클수록 빠른 평균 회귀
```

이산 시간 근사:

```
가중치 감쇠:
  w(excess) = exp(-kappa * excess)

반감기가 H일 때:
  kappa = ln(2) / H
  -> excess = H 시점에서 w = 0.5
```

### 9.3 패턴 엔진 적용: 이격도 기반 가중치 감쇠

```
코드 공식 (patterns.js:245-250):

  moveATR = |close - MA50| / ATR14    (ATR 정규화 이격도)
  excess = max(0, moveATR - 3)
  meanRevWeight = clamp(exp(-0.1386 * excess), 0.6, 1.0)
```

각 파라미터의 의미:

1) **0.1386 = ln(2) / 5 [D등급: 실증적 선택]**
   "5 ATR 초과 이격에서 가중치 50% 감소"를 의미하는 반감기 설정.
   즉 MA50에서 8 ATR 이격 시(excess=5) mw = 0.5.
   이 반감기 5(ATR 단위)는 학술 최적 도출이 아닌 실증적 선택.
   calibrate_constants.py에서 C등급(Calibratable)으로 분류됨.
   KRX 2,704종목 데이터에서 mw IC = +0.028 (양의 상관, A- 등급)으로
   방향은 정확하나 최적화 여지가 있음.

2) **임계 3 ATR [C등급: 교정 가능]**
   정규분포 가정 시 +-3sigma = 99.7% 범위.
   이 범위를 초과하는 이격은 "비정상적(extreme)"으로 간주.
   moveATR <= 3이면 excess = 0, mw = 1.0 (보정 없음).
   대부분의 종목/시점에서 moveATR < 3이므로 mw의 약 75%가 1.0.
   -> 극단적 이격 상황에서만 활성화되는 안전 장치.

   **Phase 3 M16 Calibration 검증 (2026-03-25)**:

   Calibration 상태: 미검증
   데이터 근거: 없음. calibrate_constants.py의 5개 교정 대상(C-1, C-2, D-1, D-2, D-3)에
     mw excess 임계값(3 ATR)이 포함되지 않음. wc_return_pairs.csv에 moveATR 컬럼이
     없어 임계값 grid search 자체가 실행되지 않았음.
   현재 등급: C등급 유지
   근거 출처: 정규분포 3σ(99.7%) 직관. KRX 실측 moveATR 분포와의 일치 여부 미확인.
   향후 검증 방법:
     1) wc_return_pairs.csv에 moveATR 컬럼 추가 후 임계값 1~5 ATR grid search 실행
     2) 구간별 mean(mw-adjusted ret_5) vs mean(unadjusted ret_5) 비교
     3) KRX 2,704종목 moveATR 분포의 97~99 퍼센타일이 실제 3 ATR 근방인지 확인
   권장 조치: 다음 calibration 사이클에서 moveATR 컬럼 포함 재실행

3) **클램프 [0.6, 1.0] [B등급: 설계자 선택]**
   하한 0.6: 어떤 극단적 이격에서도 패턴을 완전히 무효화하지 않음
   (최소 60% 신뢰도 유지).
   상한 1.0: 평균 회귀 보정은 감소 방향으로만 작용 (증가 없음).

시장 심리 해석:
  MA50에서 극단적으로 이격된 종목에서 나타난 패턴 신호의 신뢰도를
  자동으로 감소시킨다. 급등 직후의 "추격 매수" 신호나
  급락 직후의 "패닉 매도" 신호가 과도하게 신뢰되는 것을 방지.
  DeBondt & Thaler의 과잉반응 가설에 부합하는 설계:
  극단적 움직임 이후에는 반전 확률이 높으므로
  추세 연장형 패턴의 가중치를 낮춘다.

참고문헌:
  DeBondt, W. & Thaler, R. (1985), *Does the Stock Market Overreact?*,
    Journal of Finance, Vol. 40, No. 3, pp. 793-805
  Poterba, J. & Summers, L. (1988), *Mean Reversion in Stock Prices*,
    Journal of Financial Economics, Vol. 22, pp. 27-59
  Uhlenbeck, G.E. & Ornstein, L.S. (1930), *On the Theory of Brownian
    Motion*, Physical Review, Vol. 36, pp. 823-841

코드 매핑: patterns.js:245-250 (mw 계산 블록)

---

## 10. Cornish-Fisher 전개와 Abramowitz-Stegun 근사

> 상세한 수식과 계수는 17_regression_backtesting.md §17.11에 기술.
> 여기서는 통계학적 맥락에서의 위치를 정리한다.

### 10.1 문제: JavaScript에서 t-분포 역함수

Holm-Bonferroni 다중비교 보정(17 §17.11)에서 가변 유의수준 alpha에 대응하는
t-분포 임계값이 필요하다. Python의 scipy.stats.t.ppf()와 달리
JavaScript에는 내장 t-분포 함수가 없으므로 수치 근사를 사용한다.

### 10.2 2단계 근사

**Step 1: 정규 분위수 근사 (Abramowitz & Stegun Eq.26.2.23)**

Abramowitz, M. & Stegun, I.A. (1972). *Handbook of Mathematical Functions*.
  NBS Applied Mathematics Series 55.

유리 근사(rational approximation)로 표준정규 분포의 역함수 Phi^{-1}(p)를
근사한다. Hastings (1955)의 계수를 사용하며 오차 < 4.5e-4.
금융 공학에서 가장 널리 사용되는 정규 분위수 근사.

**Step 2: Cornish-Fisher 전개 (정규→t 변환)**

Cornish, E.A. & Fisher, R.A. (1937). "Moments and Cumulants in the
  Specification of Distributions." Revue de l'Institut International
  de Statistique, 5(4), 307-320.

분포의 큐뮬런트(cumulant)를 이용하여 정규 분위수를 비정규 분위수로
변환하는 급수 전개. t-분포의 경우 자유도 df의 함수로 보정항이 결정된다.

```
t_df ≈ z + (z^3 + z)/(4*df) + (5*z^5 + 16*z^3 + 3*z)/(96*df^2) + ...

여기서 z = Phi^{-1}(1 - alpha/2)  (양측 검정)
```

정확도: df >= 10에서 오차 < 0.01, df >= 30에서 오차 < 0.001.
패턴 백테스트에서 n >= 30 (df >= 29)이므로 충분한 정확도.

등급: **B등급** (학술 표준 근사. 계수 자체는 A등급이나, 2차 항까지만
사용하여 df < 5에서 정확도 저하가 존재.)

코드 매핑: backtester.js:334-370 (_tCriticalForAlpha)

---

## 11. 볼린저 밴드 표준편차: 모집단 분산 (/n) 사용

> 코드 매핑: indicators.js:39-47 (calcBB)

### 구현 확인

```
코드 (indicators.js:44):
  const std = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / n);

분모: /n  (모집단 표준편차, population standard deviation)
NOT: /(n-1)  (표본 표준편차, sample standard deviation)
```

### 학술 근거

Bollinger, J. (2002). *Bollinger on Bollinger Bands*. McGraw-Hill. Ch.3.

Bollinger는 원전에서 모집단 표준편차(/n)를 사용한다고 명시:
  "20일 이동평균과 20일 표준편차를 사용하되, 표준편차는 이동평균과
  동일한 데이터에 대해 계산한다."

이는 이동 윈도우 내에서 표준편차를 "기술 통계(descriptive statistic)"로
사용하기 때문이다. 즉, 모집단을 추정하는 것이 아니라 해당 20봉의 산포를
기술하는 것이다.

실무 플랫폼 조사:
```
  TradingView:    /n  (모집단)  — Bollinger 원전 준수
  MetaTrader 4/5: /n  (모집단)
  Bloomberg:      /n  (모집단)
  키움 HTS:       /n  (모집단)
  일부 학술 논문:  /(n-1) (표본) 사용 — 통계적 관행과의 혼동
```

/n과 /(n-1)의 차이:
  n=20일 때: sqrt(20/19) ≈ 1.026 → 약 2.6% 차이
  실무적으로 밴드 폭에 미미한 영향이나, 플랫폼 간 일관성을 위해
  Bollinger 원전(/n)을 따르는 것이 표준.

등급: **A등급** (Bollinger 원전과 일치, 주요 플랫폼과 동일)

---

## 12. Hurst 지수 z-score 정규화 상수

> 코드 매핑: backtester.js:128 (LinUCB context 차원 9)

### 코드

```
rawHurst = Math.max(-3, Math.min(3, (hVal - 0.946613) / 0.075216));
```

### 상수의 출처

| 상수 | 값 | 의미 |
|------|-----|------|
| 0.946613 | 평균 | KRX 전종목 Hurst R/S 추정치의 표본 평균 |
| 0.075216 | 표준편차 | KRX 전종목 Hurst R/S 추정치의 표본 표준편차 |

이 값들은 **학술 불변 상수가 아닌 데이터 종속 파라미터**이다.

### 산출 맥락

Stage A-1에서 KRX 2,704종목의 일봉 데이터(80봉 윈도우)에 대해
calcHurst()를 실행한 결과의 기술 통계:
```
  mean(H) = 0.946613
  std(H)  = 0.075216
  min(H)  ≈ 0.65
  max(H)  ≈ 1.20
```

이론적 Hurst 기대값(H = 0.5, 랜덤워크)보다 0.946이 크게 높은 이유:

1. **R/S 분석의 유한표본 편향**: R/S 분석은 유한 표본에서 H를 상향 편향
   추정하는 것이 알려져 있다.
   Anis, A.A. & Lloyd, E.H. (1976). "The Expected Value of the Adjusted
   Rescaled Hurst Range." Biometrika, 63(1), 111-116.
   — E[R/S] 보정 공식 제시. N=80에서 약 +0.3~0.4 편향.

2. **80봉 윈도우 제한**: 윈도우가 짧을수록 R/S 추정치의 편향이 커진다.

3. **KRX 시장 특성**: 개인투자자 군집행동으로 단기 추세 지속성이 높을 수 있으나,
   편향의 대부분은 R/S 방법론 자체의 유한표본 문제로 설명됨.

### z-score 정규화 목적

LinUCB contextual bandit의 입력 차원으로 사용되므로,
원시 Hurst 값을 표준화(z-score)하여 다른 차원과 스케일을 맞춘다.

```
  z = (H - mu) / sigma

  H = 0.946613 (평균) → z = 0  (전형적 종목)
  H = 1.10            → z ≈ 2.0 (강한 추세 지속)
  H = 0.80            → z ≈ -2.0 (평균 회귀 경향)
```

클램프 [-3, +3]은 극단 이상치(outlier) 억제를 위한 표준적 처리.

### 갱신 필요성

데이터 기간이 변경되거나, calcHurst 알고리즘이 수정되거나,
시장 체제가 장기적으로 변화하면 mu/sigma를 재계산해야 한다.
calibrate_constants.py 또는 Stage B 학습 파이프라인에서
주기적 재추정을 고려.

등급: **C등급** (데이터 종속 파라미터, 합리적이나 갱신 필요.
학술 불변 상수가 아닌 점을 반드시 인지해야 함.)

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
