# 21. 적응형 패턴 모델링 — Adaptive Pattern Modeling

> 기술적 패턴의 유효성은 시간에 따라 변한다. 패턴이 무효화되는 시점을 탐지하고
> 전략을 전환하는 방법을 다룬다. AMH, HMM, 전략 반감기, 온라인 학습을 종합한다.

---

## 1. 적응적 시장 가설 (Adaptive Market Hypothesis — AMH)

### 1.1 핵심 주장

Lo (2004, 2005, 2012):
1. 시장 효율성은 **시변적**(time-varying)이다
2. 전략에는 **수명 주기**가 있다: 탄생 → 성장 → 성숙 → 쇠퇴
3. **진화적 역학**이 전략 수익성을 지배한다
4. 이상현상(손실회피, 과잉반응)은 변화하는 환경에 대한 **합리적 적응**

### 1.2 실증 증거

Lo (2004): S&P 500 월별 수익률의 1차 자기상관 롤링 분석 (1871-2003):
- 시장 효율성이 시기에 따라 **순환**: 1950년대가 1990년대 초보다 효율적
- 기술적 패턴은 비효율 기간에 유효, 효율 기간에 무효

```
Efficiency_t = f(Competition_t, Information_t, Technology_t) in [0, 1]
rho_t = corr(R_t, R_{t-1} | rolling_window)
```

금융 적용:
- `indicators.js` `calcHurst()`: 레짐 변화 실시간 감지
- `backtester.js` WLS lambda=0.995: 최신 데이터 가중 (레짐 적응)
- `backtester.js` LinUCB: 탐색-활용 균형으로 시장 효율성 변화 적응

참고문헌:
- Lo, A.W. (2004). The Adaptive Markets Hypothesis. *JPM*, 30(5).
- Lo, A.W. (2012). Adaptive Markets and the New World Order. *FAJ*, 68(2).

---

## 2. HMM 레짐 전환 모형 (Hidden Markov Model Regime Switching)

### 2.1 Hamilton (1989) 기본 모형

관측 수익률이 숨겨진 레짐에 의존:

```
P(R_t | State_t = s) = N(mu_s, sigma_s^2)
State_t in {Bull, Bear, Sideways}
```

### 2.2 전이 행렬

2-state (강세/약세):
```
P = | p_BB  1-p_BB |
    | 1-p_RB  p_RB |
```

Hamilton (1989) 결과: 미국 전후 데이터에서 2개 변동성 레짐 식별.
- 강세: 월 수익률 +0.9%, 변동성 4.5%
- 약세: 월 수익률 -0.3%, 변동성 7.2%
- 레짐 지속 기간: 평균 8-10개월

### 2.3 Baum-Welch EM 알고리즘

```
E-step: gamma_t(s) = P(S_t = s | R_1:T, theta)
M-step:
  mu_s = sum(gamma_t(s) * R_t) / sum(gamma_t(s))
  sigma_s^2 = sum(gamma_t(s) * (R_t - mu_s)^2) / sum(gamma_t(s))
  p_ij = sum(P(S_t=i, S_{t+1}=j | R)) / sum(P(S_t=i | R))
```

### 2.4 Viterbi 디코딩

최적 레짐 경로 추정:
```
delta_t(j) = max_i [delta_{t-1}(i) * a_ij] * b_j(o_t)
```

금융 적용:
- `patterns.js` line 403-424 Jeffrey divergence → HMM으로 대체 가능
- `signalEngine.js` Hurst 레짐 탐지 → HMM이 더 엄밀

참고문헌:
- Hamilton, J.D. (1989). Nonstationary Time Series. *Econometrica*, 57(2).
- Kim, C.J. & Nelson, C.R. (1999). State-Space Models with Regime Switching. MIT Press.

---

## 3. 전략 반감기 추정 (Strategy Half-Life)

### 3.1 McLean & Pontiff (2016)

97개 주식시장 이상현상 분석:
- **출판 후 감쇠**: 5년 내 알파의 ~50% 소멸 (58% 수익률 하락)
- 메커니즘: 차익거래 자본 유입 + 과적합 편향

```
alpha_post = alpha_pre * exp(-lambda * t)
반감기 = ln(2) / lambda
```

### 3.2 기술적 전략 감쇠 타임라인

| 기간 | 감쇠율 | 메커니즘 |
|------|--------|---------|
| 0년 (출판 전) | 0% | 순수 수익 |
| 1년 | 15-25% | 초기 채택 (헤지펀드) |
| 2-3년 | 30-45% | 개인 인지, ETF 출시 |
| 4-5년 | 45-58% | 군집 효과 최대 |
| 5년+ | 50-80% | 전략 상품화 |

### 3.3 평균회귀 속도에서의 반감기

AR(1) 모형: delta_r_t = theta * r_{t-1} + epsilon
```
반감기 h = -ln(2) / ln(1 + theta)    (theta < 0 일 때)
```

금융 적용: `backtester.js` WLS lambda=0.995 → 반감기 ~139일. 이 선택의 이론적 근거.

참고문헌:
- McLean, R.D. & Pontiff, J. (2016). Does Academic Research Destroy Predictability? *JF*, 71(5).
- Poterba, J.M. & Summers, L.H. (1988). Mean Reversion in Stock Prices. *JFE*, 22(1).

---

## 4. 구조적 변화점 탐지 (Structural Breakpoint Detection)

### 4.1 CUSUM 검정 (Page 1954)

```
CUSUM_t = sum_{i=1}^{t} (y_i - y_bar)
D_t = max_{0<=s<t} |CUSUM_t - CUSUM_s|
기각: D_t > c_alpha (임계값)
```

특성: 점진적 파라미터 이동 탐지, O(n) 계산, 이분산에 민감.

### 4.2 Bai-Perron 다중 구조 변화 검정 (1998)

```
min sum_{j=0}^{m} sum_{t in regime_j} (y_t - alpha_j)^2
```

O(T^2) 동적 프로그래밍으로 최적 변화점 (tau_1, ..., tau_m) 추정.

### 4.3 실시간 적용

- 역방향 CUSUM: 음수 시 리셋 → 긴 lookback 방지
- 롤링 Bai-Perron: 252일 윈도우, 20일마다 검정
- 하이브리드: CUSUM으로 빠른 경고, Bai-Perron으로 확인

금융 적용: 패턴 수익률 시계열에 Bai-Perron 적용 → "레짐 민감" 패턴 표시.

참고문헌:
- Page, E.S. (1954). Continuous Inspection Schemes. *Biometrika*, 41(1/2).
- Bai, J. & Perron, P. (1998). Multiple Structural Changes. *Econometrica*, 66(1).

---

## 5. 온라인 학습 (Online Learning for Trading)

### 5.1 밴딧 알고리즘 비교

| 알고리즘 | 탐색 방식 | 리그렛 | 최적 조건 |
|---------|----------|--------|----------|
| Thompson Sampling | 사후분포 샘플링 | O(sqrt(T)) | 정상 환경, 이산 행동 |
| **LinUCB** | 신뢰 상한 (낙관주의) | O(sqrt(TdK)) | **선형 컨텍스트** |
| EXP3 | 확률 매칭 | O(sqrt(TK log K)) | 적대적 환경 |

### 5.2 LinUCB (현재 CheeseStock 구현)

Li et al. (2010):
```
a_t = argmax_a [theta_a^T x_t + alpha * sqrt(x_t^T A_a^{-1} x_t)]
```

Sherman-Morrison 증분 업데이트 (O(d^2)):
```
A_a^{-1} ← A_a^{-1} - (A_a^{-1} x x^T A_a^{-1}) / (1 + x^T A_a^{-1} x)
```

현재 구현: `backtester.js` lines 119-193, 7-dim 컨텍스트, 5 행동.

### 5.3 Thompson Sampling (대안)

```
theta_a ~ Beta(alpha_a, beta_a)
a_t = argmax_a theta_a^(t)
```

이진 보상 (패턴 수익 여부)에 자연적 적합. 불확실성을 명시적으로 반영.

금융 적용: LinUCB가 CheeseStock의 WLS 회귀 프레임워크와 가장 자연스러운 일치 — 선형 컨텍스트 모형.

참고문헌:
- Li, L. et al. (2010). LinUCB. *WWW 2010*.
- Thompson, W.R. (1933). On the Likelihood. *Biometrika*, 25(3/4).

---

## 6. 베이지안 모형 평균 (Bayesian Model Averaging)

### 6.1 레짐 불확실성 하 예측 혼합

```
y_hat_t = sum_s P(M_s | data) * y_hat_{t,s}
```

### 6.2 BIC 근사

```
log P(data | M_s) ≈ ell_s - (k_s / 2) * log(n)
P(M_s | data) ∝ exp(BIC_s / 2)
```

### 6.3 예측 구간 (모형 불확실성 포함)

```
SE(y_hat) = sqrt(sum_s P(M_s) * [sigma_{s,t}^2 + (y_hat_{t,s} - y_hat_t)^2])
```

금융 적용: 레짐별 WLS 모형 훈련 후 BMA로 혼합 → 단일 모형 대비 강건한 예측.

참고문헌:
- Raftery, A.E. et al. (1997). Bayesian Model Averaging. *JASA*, 92(437).
- Avramov, D. (2002). Stock Return Predictability and Model Uncertainty. *JFE*, 64(3).

---

## 7. 패턴 유효성 추적 (Pattern Validity Tracking)

### 7.1 롤링 유의성 검정

```
t_t = R_bar_t / (sigma_t / sqrt(N_t))
```

| t_t 값 | 판정 |
|--------|------|
| > 1.96 | 유의하게 수익성 (유효) |
| -1.96 ~ 1.96 | 중립 (감쇠 중) |
| < -1.96 | 유의하게 비수익 (무효) |

### 7.2 감쇠 점수

```
Decay_Score = 0.4*(1-WR) + 0.3*(1-IC/0.1) + 0.3*max(0, -Sharpe/2)
```

| 점수 | 단계 | 조치 |
|------|------|------|
| 0-0.3 | 녹색 (유효) | 전체 가중치 (factor=1.0) |
| 0.3-0.5 | 황색 (감쇠) | 주의 (factor=0.8) |
| 0.5-0.7 | 주황 (소멸) | 최소 사용 (factor=0.5) |
| 0.7-1.0 | 적색 (무효) | 패턴 건너뛰기 |

### 7.3 CUSUM 패턴 수익률 모니터링

```
CUSUM_t = sum(R_i - E[R_i])

CUSUM > +2.5sigma → 지속적 초과 수익 (유효)
|CUSUM| < 0.5sigma → 효과 소멸 (감쇠)
CUSUM < -2.5sigma → 지속적 손실 (폐기)
```

금융 적용: `backtester.js` winRate + Bootstrap CI(Phase I)가 기초 인프라. 감쇠 점수는 Tier 승격/강등 자동화 후보.

---

## 8. 진화적 전략 경쟁 (Evolutionary Strategy Competition)

09_game_theory.md §5 (진화적 게임이론) 확장:

복제자 역학:
```
dx_i/dt = x_i * [f_i(x) - f_bar(x)]
```

x_i = 전략 i의 인구 비율, f_i = 전략 적합도.
- 추세추종 전략: 추세장에서 적합도 높음
- 역추세 전략: 횡보장에서 적합도 높음
- 시장은 추세(3-6개월) ↔ 횡보(2-4개월) 교대
- 단일 전략이 영구 지배하지 않음

금융 적용: LinUCB의 5-action 구조가 전략 혼합의 단순화.

---

## 9. 메타-전략 프레임워크 (Meta-Strategy Framework)

### 9.1 통합 파이프라인

```
[1] OHLCV → [2] 레짐 탐지 (Hurst + EWMA vol + HMM)
           → [3] 패턴 인식 (레짐별 신뢰도 조정)
           → [4] WLS 예측 (레짐별 계수)
           → [5] LinUCB 행동 선택 (컨텍스트 = 레짐 포함)
           → [6] 감쇠 모니터링 (CUSUM + 롤링 t-검정)
           → [7] 패턴 Tier 자동 승강
```

### 9.2 적응 루프

```
T=0:  패턴 배치 (신뢰도 C0)
T=20: 감쇠 탐지 (S > 0.5) → C *= 0.9, LinUCB 댐핑 선호
T=40: 비수익 (WR < 0.48) → Tier 강등, 탐색 증가
T=60: 레짐 전환 (Hurst 0.5 횡단) → HMM 재추정, BMA 가중치 갱신
      → 패턴 재활성화 가능 (새 레짐에서 유리 시)
```

---

## 핵심 정리

| 이론 | 학술 출처 | JS 연결 |
|------|----------|--------|
| AMH 시변 효율성 | Lo (2004) | WLS lambda=0.995, Hurst 롤링 |
| HMM 레짐 전환 | Hamilton (1989) | Jeffrey div → HMM 대체 후보 |
| 전략 반감기 | McLean & Pontiff (2016) | 패턴 감쇠 모니터링 |
| CUSUM 변화점 | Page (1954) | 패턴 수익률 감시 |
| Bai-Perron 다중 변화 | Bai & Perron (1998) | 레짐 변화 확인 |
| LinUCB 온라인 학습 | Li et al. (2010) | backtester.js 구현 |
| BMA 레짐 혼합 | Raftery et al. (1997) | 레짐별 WLS 앙상블 |
| 패턴 유효성 | 본 문서 §7 | 감쇠 점수, Tier 자동화 |

---

## 참고문헌

1. Lo, A.W. (2004). The Adaptive Markets Hypothesis. *JPM*, 30(5).
2. Lo, A.W. (2012). Adaptive Markets. *FAJ*, 68(2).
3. Hamilton, J.D. (1989). Nonstationary Time Series. *Econometrica*, 57(2).
4. Kim, C.J. & Nelson, C.R. (1999). State-Space Models. MIT Press.
5. McLean, R.D. & Pontiff, J. (2016). Academic Research and Predictability. *JF*, 71(5).
6. Page, E.S. (1954). Continuous Inspection. *Biometrika*, 41(1/2).
7. Bai, J. & Perron, P. (1998). Multiple Structural Changes. *Econometrica*, 66(1).
8. Li, L. et al. (2010). LinUCB. *WWW 2010*.
9. Thompson, W.R. (1933). On the Likelihood. *Biometrika*, 25(3/4).
10. Raftery, A.E. et al. (1997). Bayesian Model Averaging. *JASA*, 92(437).
11. Avramov, D. (2002). Predictability and Model Uncertainty. *JFE*, 64(3).
12. Poterba, J.M. & Summers, L.H. (1988). Mean Reversion. *JFE*, 22(1).
13. Brock, W.A. & Hommes, C.H. (1998). Heterogeneous Beliefs. *JED*, 1(1).
14. Farmer, J.D. & Lo, A.W. (1999). Frontiers of Finance. *PNAS*, 96(18).
15. Ang, A. & Bekaert, G. (2002). Regime Switches. *JBF*, 26(6).
