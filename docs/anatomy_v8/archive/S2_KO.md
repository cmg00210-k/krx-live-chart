# 제2장: 학술적 기반 --- 이론적 토대

> CheeseStock KRX 실시간 차트 시스템의 학술적 정합성 문서.
> 본 시스템에 구현된 모든 수식과 알고리즘은 물리학, 수학, 통계학, 경영학, 경제학,
> 금융학, 행동재무학의 학술적 기반 위에 서 있다. 본 장은 각 학문 분야의 핵심 이론이
> 어떻게 기술적 분석 시스템으로 구체화되는지를 추적한다.
> 판본: V8 (2026-04-10) | 7개 학문 67 시트

---

## 2.1 물리학적 기초: 경제물리학[^phys-1]

경제물리학(Econophysics)은 통계역학, 스케일링 이론, 임계현상(critical phenomena)의
방법론을 금융시장에 적용하는 학제간 연구 분야이다. 이 분야가 기술적 분석에서
차지하는 위상은 독특하다. 기존 금융학이 가우시안(Gaussian) 분포를 전제하여
시장의 분포적 특성을 설명하는 데 근본적 한계를 드러낸 반면, 경제물리학은
시장이 *왜* 정규분포를 따르지 않는지에 대한 가장 심층적인 설명을 제공한다.
본 시스템의 극단값 이론(EVT) 보정, 변동성 국면 분류, 허스트 지수 산출은
모두 이 물리학적 토대 위에 구축되어 있다.

\newpage

### 2.1.1 통계역학과 시장 온도 (Statistical Mechanics & Market Temperature)

**개요**

볼츠만 분포(Boltzmann, 1877)는 열적 평형 상태에 있는 물리계에서
각 미시상태(microstate)의 확률을 결정하는 근본 법칙이다. Mantegna and
Stanley (2000)가 체계화한 바와 같이, 통계역학과 금융시장 사이에는
단순한 비유를 넘어선 구조적 대응(structural correspondence)이 존재한다.

**핵심 공식**

$$P(E) = \frac{1}{Z} \exp\left(-\frac{E}{k_B T}\right)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $P(E)$ | 에너지 $E$ 상태의 확률 | 무차원 | 본 Stage |
| $Z$ | 분배함수 $\sum_i \exp(-E_i/k_BT)$ | 무차원 | 본 Stage |
| $E$ | 미시상태 에너지 → 균형 가격 이탈 | J → KRW | 본 Stage |
| $k_B$ | 볼츠만 상수 | J/K | 본 Stage |
| $T$ | 절대온도 → 시장 변동성 | K → 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{\sigma_{\text{EWMA}}}$ | EWMA 변동성 (시장 온도 조작화) | 무차원 | **Stage 1** |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\sigma_{\text{EWMA}}}$는 Stage 1 데이터 계층에서 수집된 가격 시계열로부터 산출된 EWMA 변동성이다.

**물리학-금융학 대응 관계**

| 물리학 | 금융학 | 대응 의미 |
|--------|--------|-----------|
| 에너지 $E$ | 균형 가격으로부터의 이탈 | 이탈이 클수록 고에너지 상태 |
| 온도 $T$ | 시장 변동성 | 높은 변동성 = 열적 무질서 |
| 분배함수 $Z$ | 시장 정규화 상수 | 모든 상태에 걸친 확률의 총합 |
| 열적 평형 | 효율적 시장 정상상태 | 모든 정보가 가격에 반영 |
| 상전이 | 국면 전환(regime change) | 주문 흐름의 대칭 깨짐 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 시장 온도 | `calcEWMAVol()` | 변동성 국면 분류 |
| 상전이 감지 | `signalEngine` 국면 분류기 | 국면 전환 시 패턴 신뢰도 조정 |

\newpage

### 2.1.2 이징 모형과 군집행동 (Ising Model & Herding)

**개요**

이징 모형(Ising, 1925)은 통계역학에서 협동 현상을 설명하는 최소 모형이다.
매개변수의 금융시장 사상(Bornholdt, 2001)은 군집행동과 역추세 행동의
미시적 메커니즘을 제공하며, CSAD 군집 지표의 이론적 기반이 된다.

**핵심 공식**

$$\mathcal{H} = -J \sum_{\langle i,j \rangle} s_i \cdot s_j - h \sum_i s_i$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\mathcal{H}$ | 해밀토니안 (시스템 총 에너지) | J | 본 Stage |
| $s_i = \pm 1$ | 참여자 $i$의 매수(+1)/매도(-1) | 무차원 | 본 Stage |
| $J > 0$ | 상호작용 결합 → 군집행동(herding) | J | 본 Stage |
| $J < 0$ | 역추세(contrarian) 행동 → 평균회귀 | J | 본 Stage |
| $h$ | 외부장(external field) → 뉴스/정보 강도 | J | 본 Stage |
| $\textcolor{stageOneMarker}{CSAD_t}$ | 횡단면 절대 편차 (군집 경험적 지문) | % | **Stage 1** |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{CSAD_t}$는 Stage 1에서 수집된 개별종목 수익률과 시장수익률로부터 산출된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 군집행동 감지 | `signalEngine` CSAD 지표 | 복합 신호의 행동 필터 |
| 상전이 기하 | 차트 패턴 설계 기반 | 삼각형/쐐기 돌파 해석 |

\newpage

### 2.1.3 멱법칙과 두꺼운 꼬리 (Power Law & Fat Tails)

**개요**

멱법칙(power law) 분포(Mandelbrot, 1963)는 금융 수익률이 가우시안 분포를
따르지 않는다는 결정적 증거를 제공한다. Gopikrishnan et al. (1999)의
"역세제곱 법칙" ($\alpha \approx 3$)은 극단 사건의 빈도가 정규분포의
예측보다 수천 배 높음을 보여, EVT 보정의 필요성을 정당화한다.

**핵심 공식**

$$P(x) \sim x^{-\alpha}, \quad x > x_{\min}$$

$$\log P(x) = -\alpha \cdot \log x + C$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\alpha$ | 꼬리지수(tail exponent) | 무차원 | 본 Stage |
| $x_{\min}$ | 멱법칙 하한 임계값 | KRW 또는 % | 본 Stage |
| $\textcolor{stageOneMarker}{\hat{\alpha}}$ | 힐 추정량으로 측정된 꼬리지수 | 무차원 | **Stage 1** 가격 데이터 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\hat{\alpha}}$는 Stage 1의 OHLCV 데이터로부터 힐 추정량(`Hill estimator`)으로 산출된다.

| 특성 | 가우시안 ($\alpha = \infty$) | 멱법칙 ($\alpha \approx 3$) |
|------|---------------------------|-------------------------------|
| $\pm 3\sigma$ 빈도 | 0.27% (연 1회) | 1--2% (연 3--5회) |
| $\pm 5\sigma$ 빈도 | $6 \times 10^{-7}$ | 위기 시 관측됨 |
| $\pm 10\sigma$ 빈도 | $10^{-23}$ | 1987년 블랙 먼데이 실제 발생 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| $\hat{\alpha} < 4$ → `isHeavyTail` | `patternEngine` Hill 추정 | EVT 보정 볼린저 밴드 활성화 |
| 역세제곱 법칙 | 꼬리 두께 측정 | 극단 사건 확률 보정 |

\newpage

### 2.1.4 자기조직화 임계성과 버블 감지 (SOC & Bubble Detection)

**개요**

자기조직 임계성(SOC, Bak et al., 1987)에 따르면, 시장은 외부 매개변수의
미세 조정 없이도 자연스럽게 임계 상태로 진화하며, 스케일-프리 눈사태가
발생한다. 차트 패턴(삼각형, 쐐기, 머리어깨)은 임계 전이 이전의 축적 단계에서
나타나는 기하학적 지문이며, 돌파 이후 가격 이동의 크기가 멱법칙 분포를 따른다.

**핵심 공식**

$$P(S) \sim S^{-\tau}$$

여기서 $S$는 눈사태 크기(돌파 후 가격 이동), $\tau$는 눈사태 지수이다.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $S$ | 눈사태 크기 (돌파 후 가격 이동) | % | 본 Stage |
| $\tau$ | 눈사태 지수 | 무차원 | 본 Stage |

대수주기 멱법칙(LPPL, Sornette, 2003)은 "진동을 동반하는 가속 가격
패턴이 반전에 선행한다"는 통찰을 제공한다. 두 이론 모두
CheeseStock에서 직접 계산되지는 않으나, 차트 패턴 설계의 개념적 기반이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| SOC 눈사태 | 패턴 돌파 크기 분포 | 동일 삼각형이 2% 또는 15% 유발 가능 |
| LPPL 기하학 | 쐐기/삼각형 패턴 설계 | 임계 전이 이전 지문 |

\newpage

### 2.1.5 물리학 도출 요약 (Physics Summary)

| 학술 개념 | 핵심 수식 | 적용 영역 |
|-----------|-----------|-----------|
| 볼츠만 분포 / 시장 온도 | $P(E) \propto e^{-E/k_BT}$ | 변동성 국면 분류 |
| 이징 모형 / 군집행동 | $\mathcal{H} = -J\sum s_i s_j - h\sum s_i$ | 행동 패턴 필터링 |
| 멱법칙 꼬리 ($\alpha \approx 3$) | $P(x) \sim x^{-\alpha}$ | 꼬리 두께 측정 |
| 자기조직 임계성 | $P(S) \sim S^{-\tau}$ | 차트 패턴 돌파 크기 |
| 프랙탈 스케일링 / 자기유사성 | $X(ct) \stackrel{d}{=} c^H X(t)$ | 추세 지속성 측정 |
| LPPL / 버블 시그니처 | 대수주기 멱법칙 진동 | 쐐기/삼각형 설계에 반영 |

---

\newpage

## 2.2 수학적 기초[^math-1]

수학은 모든 금융 모형이 표현되는 형식 언어(formal language)이다. 확률과정은
옵션 가격결정과 위험 관리의 근간이 되는 연속시간 모형을 생성하고,
프랙탈 수학은 금융 시계열이 시간 척도 간 자기유사성(self-similarity)을
보이는 이유를 설명한다. 이 자기유사성이야말로 기술적 분석이
모든 시간대(timeframe)에서 작동하는 근본적 이유이다.

\newpage

### 2.2.1 확률론: 콜모고로프 공리와 베이즈 정리 (Probability: Kolmogorov & Bayes)

**개요**

본 시스템의 모든 확률 계산은 Kolmogorov (1933)의 공리적 기초 위에 놓여 있다.
베이즈 정리는 다수의 패턴이 동시에 감지될 때 신뢰도를 융합하는 형식적
프레임워크를 제공하며, 마르팅게일 이론은 기술적 분석의 존재론적 전제를 정의한다.

**핵심 공식**

$$P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $P(A|B)$ | 사후확률 (패턴 관측 후 상승 확률) | 무차원 | 본 Stage |
| $P(B|A)$ | 우도 (상승 시 패턴 관측 확률) | 무차원 | 본 Stage |
| $P(A)$ | 사전확률 (기저 상승률) | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{패턴}_i}$ | Stage 1에서 감지된 캔들/차트 패턴 | 범주 | **Stage 1** |

**다중 패턴 신뢰도 융합 (나이브 베이즈)**

$$P(\text{상승} | \text{패턴}_1, \text{패턴}_2, \ldots) \propto P(\text{상승}) \cdot \prod_i P(\text{패턴}_i | \text{상승})$$

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 베이지안 사후 갱신 | `signalEngine` 복합 신호 집계 | 다중 패턴 동시 감지 시 신뢰도 융합 |
| 마르팅게일 이탈 | 패턴 분석의 존재론적 근거 | EMH 약형 경계 운영 |

\newpage

### 2.2.2 마르팅게일 이론 (Martingale Theory)

**개요**

마르팅게일은 효율적 시장 가설(EMH)의 수학적 표현이다. 기술적 분석은
본질적으로 마르팅게일 속성에 대한 내기(bet)이며, Lo and MacKinlay (1999)의
경험적 증거는 시장이 순수 마르팅게일과 일치하지 않는 자기상관 구조를 보인다는
것을 시사하여, 패턴 기반 예측의 전제를 뒷받침한다.

**핵심 공식**

$$E[X_{n+1} | X_1, X_2, \ldots, X_n] = X_n$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $X_n$ | 시점 $n$의 가격 (또는 로그가격) | KRW | 본 Stage |
| $\Phi_t$ | 시점 $t$까지의 정보 집합 | — | 본 Stage |
| $\mu$ | 상수 드리프트 (EMH 하) | %/일 | 본 Stage |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 마르팅게일 이탈 검정 | IC = 0.051 (t = 3.73) | 패턴의 예측력 통계적 유의성 |
| Jensen 부등식 | 가격 vs 수익률 패턴 구분 | 검정 설계 |

\newpage

### 2.2.3 브라운 운동과 이토 해석학 (Brownian Motion & Ito Calculus)

**개요**

기하 브라운 운동(GBM)은 Black-Scholes 모형의 토대이며, 데모 모드의 가격
시뮬레이션 모형이다. 이토 보조정리(Ito's Lemma)는 확률 해석학의 연쇄 법칙으로,
BSM PDE 도출과 로그수익률 기반 지표 계산의 이론적 기반이다.

**핵심 공식**

$$dS_t = \mu S_t \, dt + \sigma S_t \, dW_t$$

해: $S_t = S_0 \cdot \exp\left((\mu - \sigma^2/2)t + \sigma W_t\right)$

**이토 보조정리**

$$df = \left(\frac{\partial f}{\partial t} + \mu S \frac{\partial f}{\partial S} + \frac{1}{2}\sigma^2 S^2 \frac{\partial^2 f}{\partial S^2}\right) dt + \sigma S \frac{\partial f}{\partial S} \, dW$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $S_t$ | 시점 $t$의 주가 | KRW | 본 Stage |
| $\mu$ | 드리프트 (기대수익률) | 연율 % | 본 Stage |
| $\sigma$ | 확산 계수 (변동성) | 연율 무차원 | 본 Stage |
| $W_t$ | 표준 위너 과정 | $\sqrt{\text{시간}}$ | 본 Stage |
| $\textcolor{stageOneMarker}{P_t}$ | Stage 1에서 수집된 실시간/일봉 가격 | KRW | **Stage 1** |

> **시그마($\sigma$) 기호의 구별**

| 기호 | 맥락 | 단위 | 예시 |
|------|------|------|------|
| $\sigma_{\text{GBM}}$ | GBM 확산 계수 | 무차원 (연율화) | 0.30 = 연 30% |
| $\sigma_{\text{price}}$ | 가격 표준편차 (볼린저) | KRW | `calcBB()`에서 사용 |
| $\sigma_{\text{return}}$ | 수익률 표준편차 | 무차원 | 0.02 = 일 2% |

일별 변환: $\sigma_{\text{daily}} = \sigma_{\text{annual}} / \sqrt{250}$ (KRX 거래일 기준).

**점프-확산 --- Merton (1976)**

$$\frac{dS_t}{S_t} = (\mu - \lambda k) \, dt + \sigma \, dW_t + J \, dN_t$$

$N_t$: 강도 $\lambda$의 포아송 과정, $J$: 점프 크기 (로그정규).
KRX의 $\pm 30\%$ 가격제한폭이 자연적 점프 크기 절단으로 작용한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| GBM | 데모 모드 가격 시뮬레이션 | `realtimeProvider` 데모 |
| 이토 보조정리 → BSM PDE | 옵션 가격결정 이론적 토대 | 오프라인 IV 산출 |
| $\sigma^2/2$ 보정 | 로그수익률 기반 지표 | 드리프트 보정 |
| Merton 점프-확산 | 갭상승/갭하락 패턴 해석 | 캔들스틱 갭 패턴 |

\newpage

### 2.2.4 프랙탈 수학과 허스트 지수 (Fractal Mathematics & Hurst Exponent)

**개요**

프랙탈 기하학(Mandelbrot, 1963; 1982)에 따르면, 가격 시계열은 시간 척도 간
통계적 자기유사성을 보인다. 이 자기유사성은 동일한 패턴이 1분, 시간, 일, 주
차트에 나타나는 수학적 토대이다. 허스트 지수(Hurst, 1951)는 시계열의
장기 의존성을 측정하여 추세추종 vs 평균회귀 전략 선택의 근거를 제공한다.

**핵심 공식**

$$X(ct) \stackrel{d}{=} c^H \cdot X(t)$$

$$E\left[\frac{R(n)}{S(n)}\right] = C \cdot n^H$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $H$ | 허스트 지수 | 무차원 [0,1] | 본 Stage |
| $R(n)$ | 윈도우 $n$에서 누적 편차의 범위 | KRW | 본 Stage |
| $S(n)$ | 윈도우 $n$의 모집단 표준편차 ($\div n$) | KRW | 본 Stage |
| $D = 2 - H$ | 프랙탈 차원 | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{P_t}$ | Stage 1 가격 시계열 | KRW | **Stage 1** |

| $H$ 값 | 해석 | 최적 전략 유형 |
|---------|------|----------------|
| $H = 0.5$ | 랜덤워크 (독립 증분) | 우위 없음 |
| $H > 0.5$ | 지속적/추세 | 추세추종 (이동평균 교차, 돌파) |
| $H < 0.5$ | 반지속적/평균회귀 | 평균회귀 (볼린저, RSI) |

**$H$와 $\alpha$에 관한 정밀한 구별:** $H = 1/\alpha$ 관계는 레비 안정 과정에서만 성립.
금융 수익률($\alpha \approx 3$, $H \approx 0.5$--$0.6$)에서는 직교적 속성이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| R/S 분석 | `calcHurst()` | 추세 지속성 측정 → 전략 유형 선택 |
| 제임스-스타인 축소 | `patternEngine` $H$ 축소 | 소표본 허스트 안정화 |
| 자기유사성 | 다중 시간대 패턴 동일성 | 5분-일봉 패턴 동일 확률적 의미 |

\newpage

### 2.2.5 선형대수와 릿지 회귀 (Linear Algebra & Ridge Regression)

**개요**

선형대수는 회귀분석, 요인 모형, 포트폴리오 최적화의 수학적 근간을 제공한다.
릿지 회귀(Hoerl & Kennard, 1970)는 L2 정규화를 통해 다중공선성 문제를 해결하고,
GCV 기반 람다 선택(Golub, Heath & Wahba, 1979)이 최적 정규화 강도를 결정한다.

**핵심 공식**

$$\hat{\beta}_{\text{Ridge}} = (X^T W X + \lambda I)^{-1} X^T W y$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\hat{\beta}$ | 회귀 계수 벡터 | 다양 | 본 Stage |
| $X$ | 설계행렬 (피처) | 다양 | 본 Stage |
| $W$ | 가중행렬 $\text{diag}(w_1,...,w_n)$ | 무차원 | 본 Stage |
| $\lambda$ | 릿지 정규화 매개변수 (GCV 선택) | 무차원 | 본 Stage |
| $I$ | 단위행렬 | — | 본 Stage |
| $\textcolor{stageOneMarker}{y}$ | 종속변수 (패턴 수익률) | % | **Stage 1** |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{y}$는 Stage 1에서 수집된 과거 패턴 수익률 데이터이다.

역행렬 계산은 부분 피벗 가우스-요르단 소거법(`_invertMatrix()`), 고유분해는
야코비 회전 알고리즘(`_jacobiEigen()`)을 사용한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| WLS + Ridge | `calcWLSRegression()` | 패턴 수익 예측 |
| GCV 람다 선택 | `selectRidgeLambdaGCV()` | 릿지 초매개변수 |
| 야코비 고유분해 | `_jacobiEigen()` | GCV용 고유값 산출 |
| 가우스-요르단 | `_invertMatrix()` | 역행렬 계산 |

\newpage

### 2.2.6 칼만 필터와 최적 제어 (Kalman Filter & Optimal Control)

**개요**

칼만 필터(Kalman, 1960)는 선형 가우시안 시스템의 최적 상태 추정기로,
선형-이차-가우시안(LQG) 제어 문제의 해이다. CheeseStock에서는
적응형 가격 평활화에 사용되며, 과정 잡음이 변동성 국면에 비례하여
스케일링되는 확장을 적용한다.

**핵심 공식**

$$\hat{x}_t = \hat{x}_{t-1} + K_t (z_t - \hat{x}_{t-1})$$

$$K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}, \quad P_{t|t-1} = P_{t-1} + Q$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\hat{x}_t$ | 상태 추정치 (평활 가격) | KRW | 본 Stage |
| $K_t$ | 칼만 이득 (Kalman gain) | 무차원 | 본 Stage |
| $P_t$ | 추정 오차 공분산 | KRW² | 본 Stage |
| $Q$ | 과정 잡음 | KRW² | 본 Stage |
| $R$ | 관측 잡음 | KRW² | 본 Stage |
| $\textcolor{stageOneMarker}{z_t}$ | 관측 가격 | KRW | **Stage 1** |

적응형 Q 수정: Mohamed and Schwarz (1999) "Adaptive Kalman Filtering"의 통찰로,
과정 잡음 공분산이 관측 변동성 국면에 비례하여 스케일링된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 칼만 필터 | `calcKalman()` | 적응형 가격 평활화 |
| 적응형 Q | 변동성 국면 연동 | 시장 온도 개념 연결 |

\newpage

### 2.2.7 수학 도출 요약 (Mathematics Summary)

| 학술 개념 | 핵심 수식 | 적용 영역 |
|-----------|-----------|-----------|
| 확률론 (콜모고로프 공리) | $(\Omega, \mathcal{F}, P)$ | 기초적 프레임워크 |
| 베이즈 정리 | $P(A|B) \propto P(B|A)P(A)$ | 다중 패턴 신뢰도 융합 |
| 마르팅게일 이론 | $E[X_{n+1}|X_n] = X_n$ | 패턴 분석의 정당성 |
| 랜덤워크 / GBM | $dS = \mu S\,dt + \sigma S\,dW$ | 가격 시뮬레이션 |
| 이토 해석학 | 이토 보조정리 | 변동성 추정, BSM PDE |
| 프랙탈 기하학 / 허스트 | $E[R(n)/S(n)] = Cn^H$ | 추세 지속성, 전략 선택 |
| 릿지 회귀 | $(X^TWX + \lambda I)^{-1}X^TWy$ | 패턴 수익 예측 |
| 칼만 필터 (LQG) | $\hat{x}_t = \hat{x}_{t-1} + K_t(z_t - \hat{x}_{t-1})$ | 적응형 가격 평활화 |
| HJB 방정식 | 확률 최적 제어 PDE | 최적 제어 프레임워크 |

---

\newpage

## 2.3 통계학적 기초[^stat-1]

통계학은 원시 시장 데이터를 실행 가능한 측정치로 변환하는 경험적 도구를
제공한다. CheeseStock의 모든 기술적 지표는 본질적으로 통계 추정량이다.
RSI는 모멘텀 확률을, 볼린저 밴드는 신뢰구간을, 힐 추정량은 꼬리 두께를
추정한다.

\newpage

### 2.3.1 GARCH/EWMA 변동성 (GARCH/EWMA Volatility)

**개요**

GARCH(1,1)(Bollerslev, 1986)은 조건부 변동성의 시변적(time-varying) 특성을
포착하는 표준 모형이다. EWMA는 $\omega=0$, $\alpha+\beta=1$인 IGARCH 특수
경우로, 시장의 "순간 온도"를 추적한다.

**핵심 공식**

$$\sigma_t^2 = \omega + \alpha \cdot \varepsilon_{t-1}^2 + \beta \cdot \sigma_{t-1}^2$$

EWMA: $\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_{t-1}^2$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\sigma_t^2$ | 조건부 분산 | %² | 본 Stage |
| $\omega$ | 장기 분산 수준 | %² | 본 Stage |
| $\alpha$ | ARCH 계수 (충격 반응) | 무차원 | 본 Stage |
| $\beta$ | GARCH 계수 (분산 지속성) | 무차원 | 본 Stage |
| $\lambda = 0.94$ | EWMA 감쇠 (RiskMetrics 관례) | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{r_t}$ | 로그수익률 $\ln(P_t/P_{t-1})$ | 무차원 | **Stage 1** |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| EWMA 변동성 | `calcEWMAVol()` | 시장 온도 → 국면 분류 |
| GARCH 이론 | 변동성 클러스터링 해석 | 변동성 예측 프레임워크 |

\newpage

### 2.3.2 극단값 이론: GEV, GPD, Hill (Extreme Value Theory)

**개요**

극단값 이론(EVT)은 가우시안 꼬리 확률의 치명적 부적합성을 교정한다.
Fisher-Tippett-Gnedenko 정리(1928/1943)의 GEV 분포와 Pickands-Balkema-de Haan
정리의 GPD가 핵심이며, Hill 추정량이 꼬리 두께를 측정한다.

**핵심 공식**

GEV: $G(x; \mu, \sigma, \xi) = \exp\left\{-\left[1 + \xi \frac{x - \mu}{\sigma}\right]^{-1/\xi}\right\}$

GPD: $H(y; \sigma, \xi) = 1 - \left(1 + \xi \frac{y}{\sigma}\right)^{-1/\xi}$

Hill: $\hat{\alpha} = \frac{k}{\sum_{i=1}^{k} [\ln X_{(i)} - \ln X_{(k+1)}]}$

EVT VaR: $\text{VaR}_p = u + \frac{\sigma}{\xi}\left[\left(\frac{n}{N_u}(1-p)\right)^{-\xi} - 1\right]$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\xi$ | 형상 매개변수 (꼬리 유형) | 무차원 | 본 Stage |
| $\hat{\alpha}$ | 힐 꼬리지수 추정량 | 무차원 | 본 Stage |
| $k$ | 상위 순서통계량 수 | 정수 | 본 Stage |
| $u$ | POT 임계값 | % | 본 Stage |
| $\textcolor{stageOneMarker}{X_{(i)}}$ | 정렬된 절대수익률 순서통계량 | % | **Stage 1** |

금융 수익률: $\xi \approx 0.2$--$0.4$ (프레셰 유형), GPD PWM 추정(Hosking & Wallis, 1987).

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| $\hat{\alpha} < 4$ | `isHeavyTail` flag | EVT 보정 볼린저 활성화 |
| GPD VaR | 손절매 최적화 | 두꺼운 꼬리 종목 보수적 손절 |

\newpage

### 2.3.3 강건 회귀: WLS, Ridge, HC3, Theil-Sen (Robust Regression)

**개요**

금융 데이터의 이분산성과 이상치에 대응하는 강건 회귀 기법들이다.
WLS(Aitken, 1935)는 지수적 시간감쇠로 최근 패턴에 높은 가중치를 부여하며,
HC3(MacKinnon & White, 1985)은 이분산성 하에서의 유효한 추론을, Theil-Sen은
29.3% 붕괴점의 이상치 저항 추정을 제공한다.

**핵심 공식**

WLS: $\hat{\beta} = (X^T W X)^{-1} X^T W y$, $w_i = \lambda^{T-t_i}$ ($\lambda=0.995$)

Ridge: $\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$

HC3: $\text{Cov}_{\text{HC3}}(\hat{\beta}) = (X^TX)^{-1}\left[\sum_i \frac{e_i^2}{(1-h_{ii})^2} x_i x_i^T\right](X^TX)^{-1}$

Theil-Sen: $\hat{\beta}_{\text{slope}} = \text{median}\left\{\frac{y_j-y_i}{x_j-x_i}\right\}$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $W$ | 가중행렬 (지수적 시간감쇠) | 무차원 | 본 Stage |
| $\lambda_{\text{decay}} = 0.995$ | 반감기 ≈ 139 거래일 | 무차원 | 본 Stage |
| $h_{ii}$ | 지렛점 (모자행렬 대각) | 무차원 | 본 Stage |
| $e_i$ | OLS 잔차 | % | 본 Stage |

| $R^2$ | 해석 | 실무적 의의 |
|-------|------|-------------|
| 0.02--0.03 | 경제적으로 유의미 | 연간 수백 bp |
| 0.05+ | 매매전략 수준 | 체계적 전략 활용 |
| $> 0.10$ | 극히 드묾 | 과적합 의심 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| WLS + Ridge | `calcWLSRegression()` | 패턴 수익 예측 (17-col) |
| HC3 | 강건 표준오차 | 이분산성 하 유효 추론 |
| Theil-Sen | 추세선 적합 | 이상치 저항 추세 감지 |
| VIF | `calcVIF()` | 다중공선성 진단 |

\newpage

### 2.3.4 HAR-RV 변동성 예측 (HAR-RV Model)

**개요**

이질적 자기회귀 실현 변동성(HAR-RV, Corsi 2009)은 이질적 시장 가설(Muller et al.
1997)에 기반하여 일/주/월 3-스케일 변동성 분해를 수행한다.

**핵심 공식**

$$RV_{t+1}^{(d)} = \beta_0 + \beta_d \cdot RV_t^{(d)} + \beta_w \cdot RV_t^{(w)} + \beta_m \cdot RV_t^{(m)} + \varepsilon_{t+1}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $RV_t^{(d)} = r_t^2$ | 일별 실현 분산 | %² | 본 Stage |
| $RV_t^{(w)} = \frac{1}{5}\sum_{i=0}^{4} r_{t-i}^2$ | 주간 성분 | %² | 본 Stage |
| $RV_t^{(m)} = \frac{1}{M}\sum_{i=0}^{M-1} r_{t-i}^2$ | 월간 성분 ($M=21$ KRX) | %² | 본 Stage |
| $\textcolor{stageOneMarker}{r_t}$ | 일별 로그수익률 | 무차원 | **Stage 1** |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| HAR-RV 3-스케일 | 변동성 예측 | 다중척도 변동성 폭포 포착 |

\newpage

### 2.3.5 최대우도추정 (Maximum Likelihood Estimation)

**개요**

최대우도추정(MLE)은 GARCH 매개변수 교정, GPD 적합, HMM 전이행렬 추정의
통계학적 기반이다.

**핵심 공식**

$$\hat{\theta}_{\text{MLE}} = \arg\max_{\theta} \sum_{i=1}^{n} \ln f(x_i; \theta)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\hat{\theta}$ | 매개변수 추정치 | 다양 | 본 Stage |
| $f(x;\theta)$ | 확률밀도함수 | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{x_i}$ | 관측 데이터 | 다양 | **Stage 1** |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| MLE | GARCH 교정, GPD 적합 | 매개변수 추정 |
| EM (바움-웰치) | HMM 전이행렬 추정 | 국면 분류 |

\newpage

### 2.3.6 변화점 감지: CUSUM과 이진 세분화 (Change Point Detection)

**개요**

CUSUM(Page, 1954)과 이진 세분화(Bai-Perron, 1998)는 시계열의 구조적 변화를
감지한다. CheeseStock은 변동성 국면 적응형 임계값으로 고전적 CUSUM을 확장한다.

**핵심 공식**

$$S_t^+ = \max(0, S_{t-1}^+ + z_t - k), \quad S_t^- = \max(0, S_{t-1}^- - z_t - k)$$

이진 세분화: $\text{BIC}_{\text{seg}} = n\ln(\max(\text{RSS}/n, 10^{-12})) + 2\ln(n)$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $z_t$ | 표준화 관측치 | 무차원 | 본 Stage |
| $k$ | 슬랙 매개변수(allowance) | 무차원 | 본 Stage |
| $h$ | 임계값 | 무차원 | 본 Stage |

| 변동성 국면 | 임계값 $h$ | 근거 |
|-------------|-----------|------|
| 고변동성 | $\max(h, 3.5)$ | 거짓 경보 감소 |
| 중간 | 기본값 ($h = 2.5$) | 표준 민감도 |
| 저변동성 | $\min(h, 1.5)$ | 민감도 증가 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| CUSUM | 변화점 감지 알고리즘 | 국면 전환 실시간 감지 |
| Bai-Perron BIC | 이진 세분화 | 구조적 변화점 분할 |

\newpage

### 2.3.7 HMM 국면 분류 (Hidden Markov Models)

**개요**

HMM(Baum et al. 1970; Hamilton 1989)은 시장을 관측 불가능한 국면(강세, 약세,
횡보) 간의 마르코프 전이로 모형화한다. 바움-웰치 알고리즘(EM 특수 경우)이
전이행렬과 방출행렬을 추정한다.

**핵심 공식**

$$P(S_t = j | S_{t-1} = i) = a_{ij}$$

$$P(O_t | S_t = j) = b_j(O_t)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $S_t$ | 은닉 상태 (시장 국면) | 범주 | 본 Stage |
| $a_{ij}$ | 전이확률 ($i \to j$) | 무차원 | 본 Stage |
| $b_j(O_t)$ | 방출확률 | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{O_t}$ | 관측 수익률 시계열 | % | **Stage 1** |

HMM 국면 레이블은 오프라인 파이프라인에서 사전 계산되어 런타임에 로드된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| HMM 2-state | `_flowSignals.hmmRegimeLabel` | 시장 국면 분류 |
| 바움-웰치 | 오프라인 EM 추정 | 전이행렬 교정 |

\newpage

### 2.3.8 통계학 도출 요약 (Statistics Summary)

| 학술 개념 | 핵심 수식 | 적용 영역 |
|-----------|-----------|-----------|
| GARCH / EWMA | $\sigma_t^2 = \lambda\sigma_{t-1}^2 + (1-\lambda)r_{t-1}^2$ | 조건부 변동성 |
| 힐 꼬리지수 | $\hat\alpha = k / \sum[\ln X_{(i)} - \ln X_{(k+1)}]$ | 두꺼운 꼬리 감지 |
| GPD 꼬리 적합 | Pickands-Balkema-de Haan POT | EVT 기반 VaR |
| WLS + 릿지 회귀 | $(X^TWX + \lambda I)^{-1}X^TWy$ | 패턴 수익 예측 |
| HC3 강건 표준오차 | $(1-h_{ii})^2$ 보정 | 이분산성 보정 |
| 틸-센 강건 추정 | $\hat\beta = \text{median}(y_j-y_i)/(x_j-x_i)$ | 이상치 저항 추세선 |
| HMM (바움-웰치) | Hamilton (1989) 2상태 마르코프 | 시장 국면 분류 |
| HAR-RV | $RV_{t+1}^{(d)} = \beta_0 + \beta_d RV_t^{(d)} + \beta_w RV_t^{(w)} + \beta_m RV_t^{(m)}$ | 다중척도 변동성 예측 |
| CUSUM | Page (1954) 누적합 관리도 | 변화점 감지 |
| BH-FDR | Benjamini-Hochberg (1995) | 다중 검정 보정 |

---

\newpage

## 2.4 경영학적 기초: 기업재무와 가치평가[^biz-1]

경영학(기업재무론)은 기업의 본질가치(intrinsic value)를 결정하는 이론적 프레임워크를 제공한다.
CheeseStock의 재무 분석 패널(D 컬럼)은 DCF, WACC, EVA 등 기업재무 이론에 기반하여
패턴 분석과 기본적 분석의 교차검증(cross-validation)을 수행한다. 기술적 분석이 "가격이
어디로 가는가"를 묻는다면, 기업재무론은 "가격이 어디에 있어야 하는가"를 묻는다.
이 두 질문의 괴리가 투자 기회이며, 본 절은 후자의 이론적 토대를 제공한다.

\newpage

### 2.4.1 DCF 기업가치 평가 (Discounted Cash Flow Valuation)

**개요**

현금흐름할인법(DCF)은 기업가치를 미래 잉여현금흐름(FCF)의 현재가치 합으로 정의한다. Damodaran(1995, 2012)이 체계화한 이 방법론은 금융경제학의 화폐시간가치(TVM) 원리에서 직접 도출된다. 기업이 창출할 모든 미래 현금흐름을 적절한 할인율(WACC)로 현재시점으로 환원하면, 이것이 곧 기업의 이론적 내재가치다. 시장가격이 내재가치보다 낮을 때 투자 기회가 존재하고, 반대로 높을 때는 매도 기회가 된다.

DCF의 3대 입력 변수는 FCF 추정, WACC 산출, 그리고 터미널 밸류(TV) 계산이다. 실무에서 TV는 전체 기업가치의 60~80%를 차지하는 경우가 흔하다. 이는 DCF의 본질적 한계이자 기술적 분석이 보완해야 하는 영역으로, 가격이 이론가치 범위 안에 있는지 확인하는 크로스체크(cross-check) 역할이 중요하다.

잉여현금흐름은 기업 현금흐름(FCFF)과 자기자본 현금흐름(FCFE)으로 구분된다. FCFF는 부채 보유자와 주주 모두에게 귀속되는 현금흐름이며, 영업이익에서 세금·재투자비용을 차감하여 산출한다. KRX 상장기업은 DART 전자공시시스템을 통해 재무제표 데이터를 확보할 수 있으며, 성장주(바이오, IT)는 FCF가 음수인 경우도 있어 상대가치 평가로 보완한다.

민감도 분석은 DCF의 필수 부속 작업이다. Gordon 성장 모형에서 WACC와 성장률(g)에 대한 편미분은 절댓값이 동일하므로, WACC 상승 1bp와 g 하락 1bp는 TV에 대칭적 충격을 준다. 이 비선형성이 분석가 간 가치 추정 편차의 주요 원인이다. WACC 추정 오차 ±1%p, g 추정 오차 ±0.5%p를 가정하면 TV 불확실성은 ±20~35%에 달한다.

**핵심 공식**

$$V = \sum_{t=1}^{n} \frac{FCF_t}{(1+WACC)^t} + \frac{TV}{(1+WACC)^n}$$

$$FCFF = EBIT(1-T) + D\&A - CAPEX - \Delta NWC$$

$$TV_{\text{Gordon}} = \frac{FCF_{n+1}}{WACC - g} = \frac{FCF_n(1+g)}{WACC - g}$$

$$TV_{\text{exit}} = EBITDA_n \times \text{Exit Multiple}$$

$$\frac{\partial TV}{\partial g} = \frac{FCF_1}{(WACC-g)^2} > 0 \qquad \frac{\partial TV}{\partial WACC} = -\frac{FCF_1}{(WACC-g)^2} < 0$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $V$ | 기업 총가치 (EV) | 원(KRW) | 본 Stage |
| $FCF_t$ | t기 잉여현금흐름 | 원 | 본 Stage |
| $WACC$ | 가중평균자본비용 | % | 본 Stage |
| $TV$ | 터미널 밸류 | 원 | 본 Stage |
| $g$ | 영구 성장률 | % | 본 Stage |
| $T$ | 법인세율 | % | 본 Stage |
| $D\&A$ | 감가상각비 | 원 | 본 Stage |
| $CAPEX$ | 자본적 지출 | 원 | 본 Stage |
| $\Delta NWC$ | 순운전자본 변동 | 원 | 본 Stage |
| $\textcolor{stageOneMarker}{EBIT}$ | DART 영업이익 | 원 | **Stage 1** |
| $\textcolor{stageOneMarker}{EPS}$ | 주당순이익 | 원/주 | **Stage 1** |
| $\textcolor{stageOneMarker}{\beta_{KRX}}$ | KRX 베타 (CAPM 산출용) | 무차원 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1(DART API)에서 `영업이익(EBIT)`, `EPS`, `자본총계`, `이자부채`를 수신한다. DART stat code `ifrs-full_ProfitLossFromOperatingActivities`가 EBIT에 해당하며, `download_financials.py`가 이를 `data/financials/{code}.json`에 기록한다. `compute_capm_beta.py`가 산출한 $\beta_{KRX}$는 WACC 계산의 자기자본비용($R_e$) 입력값이다.

**KRX 특이사항:** 자본잠식 종목(자기자본 < 납입자본금의 50%)은 계속기업(going concern) 가정을 위반하므로 DCF 모형이 무효화된다. 이 경우 청산가치(liquidation value) 또는 자산가치 기반 평가로 전환해야 하며, `financials.js`는 `자본총계 < 0` 조건을 감지하여 D 컬럼에 경고를 표시한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| DCF 내재가치 역산 | `getFinancialData()` → `updateFinancials()` | PER/PBR로 내재가치 범위 추정 |
| TV 민감도 분석 | `drawFinTrendChart()` 추세 시각화 | 이익 성장 추이로 g 추정 보조 |
| FCFF 산출 | `compute_eva.py` NOPAT 계산 | EVA 계산의 중간 단계 공유 |
| 저PBR + 패턴 결합 | `signalEngine.js` composite 신호 | 내재가치 이하 가격 + 기술적 반전 신호 강화 |

\newpage

### 2.4.2 자본구조: MM 정리 (Capital Structure: Modigliani-Miller)

**개요**

Modigliani & Miller(1958, 1963)의 자본구조 무관련 정리(MM theorem)는 현대 기업재무론의 출발점이다. 두 저자는 각각 1985년과 1990년 노벨 경제학상을 수상했다. 정리의 핵심은 "완전 자본시장에서 기업가치는 자본구조와 무관하다"는 명제로, 부채와 자기자본의 조합 방식은 기업가치의 파이 크기가 아닌 분배 방식만을 결정한다는 직관을 담고 있다.

1963년 수정 모형은 법인세(corporate tax)를 도입하여 부채의 이자비용이 세전 공제됨에 따라 $T_c \cdot D$만큼의 세금절감(tax shield) 효과가 발생하고 기업가치가 증가함을 보였다. 그러나 이 결론을 그대로 따르면 100% 부채가 최적이라는 비현실적 결론에 도달한다. 현실에서 KOSPI 대형주의 평균 부채비율은 40~60%에 불과하며, 이 괴리를 설명하기 위해 상충이론(trade-off theory)과 Miller(1977) 개인세 모형이 제안되었다.

MM 제2명제는 자기자본비용이 레버리지 증가에 따라 선형적으로 상승함을 보인다. 부채의 낮은 조달비용 이점이 자기자본비용 상승으로 정확히 상쇄되므로 WACC는 일정하게 유지된다. 이것이 MM의 핵심 역설이다. 제2명제는 Hamada(1972) 방정식(2.4.4절)을 통해 자본구조 변화에 따른 베타 조정의 이론적 근거를 제공한다.

한국 시장에서 MM 완전 자본시장의 5가지 가정 중 적어도 3가지가 현실에서 위반된다. 재벌 지배구조에 따른 정보 비대칭, 법인세·배당소득세·이자소득세의 복층 세금 구조, 그리고 금융위기 시 관찰되는 재무적 곤경 비용(financial distress cost)이 대표적 위반 사례다. 따라서 MM 정리는 한국 시장 분석의 기준점(null hypothesis)으로 활용하되, 현실 조건의 이탈 방향을 명시적으로 모형화해야 한다.

**핵심 공식**

$$\text{MM-I (무세금, 1958):} \quad V_L = V_U$$

$$\text{MM-I (법인세, 1963):} \quad V_L = V_U + T_c \cdot D$$

$$\text{MM-II (자기자본비용):} \quad R_E = R_A + (R_A - R_D)\frac{D}{E}(1-T_c)$$

$$\text{상충이론:} \quad V_L = V_U + PV(\text{Tax Shield}) - PV(\text{Distress Cost})$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $V_L$ | 레버리지 기업 가치 | 원 | 본 Stage |
| $V_U$ | 무레버리지 기업 가치 | 원 | 본 Stage |
| $T_c$ | 법인세율 | % | 본 Stage (한국 실효세율 ≈ 22%) |
| $D$ | 부채 시장가치 | 원 | 본 Stage |
| $R_E$ | 자기자본비용 (레버리지 후) | % | 본 Stage |
| $R_A$ | 자산수익률 (무레버리지) | % | 본 Stage |
| $R_D$ | 타인자본비용 | % | 본 Stage |
| $\textcolor{stageOneMarker}{\text{자본총계}}$ | DART 자기자본 장부가 | 원 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{이자부채}}$ | DART 단·장기차입금 합계 | 원 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1 DART 파이프라인에서 수신한 `자본총계`와 `이자부채`로 D/E 비율을 산출한다. `자본총계`는 IFRS 기준 `ifrs-full_Equity`, `이자부채`는 `ifrs-full_Borrowings + ifrs-full_DebtSecuritiesIssued`로 매핑된다.

**MM 완전 자본시장 5가지 가정과 KRX 위반 현황**

| 가정 | 내용 | KRX 위반 여부 |
|------|------|--------------|
| 1. 세금 없음 | 법인세·소득세 부재 | 위반: 법인세 9~24%, 배당·이자소득세 15.4% |
| 2. 거래비용 없음 | 매매 수수료·스프레드 없음 | 부분 위반: 증권거래세 0.18%, HTS 수수료 |
| 3. 파산비용 없음 | 부도 시 비용 발생 안 함 | 위반: 회생절차 직·간접 비용 |
| 4. 정보 대칭 | 내부·외부 정보 동일 | 위반: 재벌 오너 정보 우위, DART 공시 지연 |
| 5. 동일 차입금리 | 기업·개인 동일 금리 | 위반: 신용등급별 스프레드 차이 존재 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| MM-I 세금절감($T_c \cdot D$) | `compute_eva.py` IC 산출 | EVA 계산의 투하자본(IC) 분모 |
| D/E 비율 | `financials.js updateFinancials()` | PBR·ROE 표시 보조 지표 |
| 상충이론 곡선 | 향후 `compute_wacc.py` 연동 예정 | 최적 자본구조 추정 |

\newpage

### 2.4.3 Miller (1977) 개인세 모형 (Miller's Personal Tax Model)

**개요**

Merton Miller(1977)는 미국재무학회 회장 취임 연설에서 법인세만을 고려한 MM(1963) 모형이 개인세를 무시함으로써 부채의 세금 이점을 과대평가한다는 점을 지적했다. Miller의 핵심 통찰은 투자자가 이자소득과 배당소득(또는 자본이득)에 대해 서로 다른 세율로 개인세를 납부한다는 사실이다. 이자소득에 대한 개인세율($T_d$)이 높을수록 부채의 순세금 이점은 감소한다.

Miller 균형(Miller equilibrium)은 개인세율이 이질적인 투자자 집단을 도입하여 도출된다. 기업들이 부채를 늘릴수록 채권 수익률이 상승하고, 점점 더 높은 개인세율의 투자자를 유인해야 한다. 균형에서 한계 채권 투자자의 세율이 $(1-T_d^*) = (1-T_c)(1-T_s)$를 만족하면 추가적인 부채 발행의 세금 이점이 0이 되어, 경제 전체의 부채 총량은 결정되지만 개별 기업의 자본구조는 무관하게 된다.

한국 세제를 Miller 모형에 대입하면 세 가지 사례가 구분된다. Case A(배당 중심, $T_s = T_d = 15.4\%$)에서는 개인세가 상쇄되어 MM(1963)과 동일한 결론($G_L = T_c \cdot D$)이 도출된다. Case B(소액주주 자본이득 비과세, $T_s \approx 0$)에서는 부채의 세금 이점이 $0.22D$에서 $0.078D$로 대폭 축소된다. Case C(금융소득종합과세, $T_d = T_s = 40\%$)에서도 동일한 세율로 인해 역시 $G_L = T_c \cdot D$가 성립한다.

CheeseStock의 신뢰도 조정 시스템은 Miller 모형의 함의를 간접적으로 반영한다. 고배당주(소액주주 $T_s = T_d$ 조건)는 자본구조 중립 가정이 성립하는 반면, 자본이득 중심 성장주(Case B)는 부채가 많더라도 세금절감 이점이 제한적이다. 이는 같은 D/E 비율이라도 배당 정책에 따라 WACC 계산값이 달라질 수 있음을 시사한다.

**핵심 공식**

$$G_L = \left[1 - \frac{(1-T_c)(1-T_s)}{1-T_d}\right] \cdot D$$

$$V_L = V_U + G_L = V_U + \left[1 - \frac{(1-T_c)(1-T_s)}{1-T_d}\right] \cdot D$$

$$\text{Miller 균형 조건:} \quad (1-T_d^*) = (1-T_c)(1-T_s) \implies G_L = 0$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $G_L$ | 부채의 세금 순이득 | 원 | 본 Stage |
| $T_c$ | 법인세율 (한국 실효 ≈ 0.22) | % | 본 Stage 상수 |
| $T_d$ | 이자소득에 대한 개인세율 | % | 본 Stage (한국 0.154) |
| $T_s$ | 자기자본 소득 유효 개인세율 | % | 본 Stage (Case B: ≈ 0) |
| $D$ | 부채 시장가치 | 원 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{자본총계}}$ | DART 자기자본 | 원 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{이자부채}}$ | DART 차입금·사채 합계 | 원 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 수신한 `자본총계`와 `이자부채`로 D 및 D/E를 산출한다. 실효세율($T_c$)은 DART `ifrs-full_IncomeTaxExpense` / `ifrs-full_ProfitLossBeforeTax`로 추정할 수 있으며, `download_financials.py`가 이를 기록한다.

**한국 세제별 Miller 모형 결과 비교**

| 사례 | $T_c$ | $T_d$ | $T_s$ | $G_L$ | 비고 |
|------|--------|--------|--------|--------|------|
| Case A: 배당 중심 | 0.22 | 0.154 | 0.154 | $0.22D$ | MM(1963)과 동일 |
| Case B: 소액주주 자본이득 비과세 | 0.22 | 0.154 | 0 | $0.078D$ | 세금이점 64% 감소 |
| Case C: 금융소득종합과세 | 0.22 | 0.40 | 0.40 | $0.22D$ | Case A와 동일 |
| Miller 균형 이론값 | 임의 | $T_d^*$ | 임의 | $0$ | 개별기업 자본구조 무관 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Case B ($G_L = 0.078D$) | 향후 WACC 정교화 시 참조 | 소액주주 비과세 가정 하 WACC 보정 |
| Miller 균형 판단 | `financials.js` D/E·배당성향 표시 | 자본구조 최적화 여부 체크 |
| 세율 파라미터 | `appState.js` 경제 파라미터 테이블 | Stovall/KSIC 신뢰도 조정 참조 |

\newpage

### 2.4.4 WACC와 최적 자본비용 (WACC & Optimal Capital Cost)

**개요**

가중평균자본비용(WACC)은 기업이 자본을 조달하는 데 지불해야 하는 총비용의 가중평균이다. DCF 분석에서 분모에 위치하므로 WACC의 작은 변화가 기업가치에 대단히 큰 영향을 미친다. WACC는 자기자본비용($R_e$)과 세후 타인자본비용($R_d(1-T_c)$)을 시장가치 기준 비중으로 가중한다. 자기자본비용은 통상 CAPM으로 산출하며, 이때 KRX 종목의 베타($\beta$)와 무위험이자율($R_f$), 시장위험프리미엄(ERP)이 핵심 입력값이 된다.

Hamada(1972) 방정식은 자본구조 변화에 따른 레버리지 베타($\beta_L$)와 무레버리지 베타($\beta_U$) 간의 관계를 정량화한다. 비교 대상 기업(peer group)의 베타를 활용하거나 자본구조 변경 시나리오를 분석할 때 필수적으로 사용되는 3단계 절차가 있다: 각 비교 기업의 $\beta_L$을 $\beta_U$로 언레버(unlever)하고, 평균을 내며, 분석 대상 기업의 D/E로 다시 레버(re-lever)하는 것이다. Hamada 방정식은 MM(1963) 법인세 모형을 기반으로 하므로 파산비용과 개인세를 반영하지 않는다는 한계가 있다.

최적 자본구조는 세금절감 효과의 현재가치와 재무적 곤경 비용의 현재가치가 균형을 이루는 점에서 결정된다. 부채 증가에 따른 세금절감 이익의 한계효과가 체감하는 반면, 파산 확률과 관련 비용의 한계치는 체증한다. 이 상충관계가 업종별·기업규모별로 서로 다른 최적 자본구조를 만든다. KOSPI 대형 제조업체는 통상 D/E 0.8~1.2, KOSDAQ 기술 성장주는 0.3~0.6 수준을 유지한다.

KRX 적용 시 무위험이자율 선택에 주의가 필요하다. 패턴 매매(단기 트레이딩) 관점에서는 국고채 3년 수익률이 적절하고, DCF를 통한 기업가치 평가(장기 투자) 관점에서는 국고채 10년 수익률이 적합하다. 2025년 현재 한국 국고채 3년 수익률은 약 2.8~3.2%, 10년 수익률은 약 3.0~3.5% 수준이다.

**핵심 공식**

$$WACC = \frac{E}{V}R_e + \frac{D}{V}R_d(1-T_c)$$

$$R_e = R_f + \beta_L(R_m - R_f) \quad \text{(CAPM)}$$

$$\beta_L = \beta_U \left[1 + (1-T_c)\frac{D}{E}\right] \quad \text{(Hamada, 1972)}$$

$$\beta_U = \frac{\beta_L}{1 + (1-T_c)(D/E)}$$

$$V_L = V_U + PV(\text{Tax Shield}) - PV(\text{Distress Cost}) \quad \text{(Trade-off)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $E$ | 자기자본 시장가치 (시가총액) | 원 | 본 Stage |
| $D$ | 타인자본 시장가치 | 원 | 본 Stage |
| $V = E + D$ | 총자본 시장가치 | 원 | 본 Stage |
| $R_d$ | 타인자본비용 (차입이자율) | % | 본 Stage |
| $T_c$ | 법인세율 | % | 본 Stage |
| $\beta_L$ | 레버리지 베타 | 무차원 | 본 Stage |
| $\beta_U$ | 무레버리지 베타 | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{R_f}$ | 국고채 3Y/10Y 수익률 | % | **Stage 1** (ECOS API) |
| $\textcolor{stageOneMarker}{\beta}$ | KRX CAPM 베타 | 무차원 | **Stage 1** (`compute_capm_beta.py`) |
| $\textcolor{stageOneMarker}{\text{실효세율}}$ | DART 법인세비용/세전이익 | % | **Stage 1** |

> **이전 Stage 데이터:** $R_f$는 Stage 1 ECOS API `722Y001` (국고채 3년) 및 `817Y002` (국고채 10년)에서 수신한다. $\beta$는 `compute_capm_beta.py`가 OHLCV 데이터로 산출하여 `data/derivatives/capm_beta.json`에 기록한 값을 사용한다. 실효세율은 DART `download_financials.py` 출력물에서 추출한다.

**Hamada 3단계 절차 (peer group beta 조정)**

| 단계 | 공식 | 목적 |
|------|------|------|
| 1. Unlever | $\beta_{U,i} = \beta_{L,i} / [1+(1-T_c)(D/E)_i]$ | 각 비교기업 자본구조 제거 |
| 2. Average | $\bar{\beta}_U = \text{mean}(\beta_{U,i})$ | 산업 고유 위험 추정 |
| 3. Re-lever | $\beta_{L,\text{target}} = \bar{\beta}_U[1+(1-T_c)(D/E)_{\text{target}}]$ | 분석 대상에 자본구조 재적용 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| WACC 계산 | `compute_eva.py` WACC 산출 루틴 | EVA 분모 자본비용 금액 |
| Hamada unlever/re-lever | `compute_capm_beta.py` 베타 조정 | 섹터 평균 베타 비교 |
| $R_f$ 국고채 | `_macroLatest.bok_rate` 참조 | 신뢰도 조정의 금리 환경 판단 |
| WACC↑ → 성장주 하락 | `_applyPhase8ConfidenceToPatterns()` | 금리 상승 국면 패턴 신뢰도 하향 조정 |

\newpage

### 2.4.5 대리인 이론과 기업지배구조 (Agency Theory & Corporate Governance)

**개요**

Jensen & Meckling (1976)은 기업의 소유와 경영이 분리될 때 발생하는 대리인 비용(agency costs)을 감시비용(MC), 결속비용(BF), 잔여손실(RL)의 3요소로 분해하였다. 이는 경영학 재무관리의 핵심 프레임워크이며, 대리인 비용이 높은 기업에서는 이익의 질(earnings quality)이 낮아 EPS 기반 패턴의 신뢰도가 하락하고, 배당/자사주 신호의 정보 함량이 변질된다. Holmstrom (1979)은 도덕적 해이 하의 최적 계약을 정식화하여, 인센티브 강도 $\beta^*$가 환경 불확실성($\sigma^2$), 위험회피($\rho$), 노력 효과($\Delta f$)의 함수임을 도출하였다.

한국 재벌(chaebol) 그룹은 글로벌 기업 지배구조에서 대리인 문제의 극단적 사례를 제공한다. La Porta, Lopez-de-Silanes & Shleifer (1999)와 Claessens et al. (2000)의 프레임워크에 따르면, 지배주주의 현금흐름권($C$)과 의결권($\alpha$)의 괴리도(wedge) $W = \alpha - C$가 터널링 유인을 결정한다. 한국 4대 재벌의 괴리도 비율(WR $= \alpha/C$)은 삼성 $\approx$20.6, SK $\approx$11.4, 현대차 $\approx$10.7, LG $\approx$9.0으로 동아시아 최고 수준이다 (공정거래위원회 2024). WR이 10을 초과하면 터널링 이벤트(내부거래 공시, 유상증자, 합병) 시 패턴 신뢰도를 체계적으로 하향해야 한다. Bae, Kang & Kim (2002)은 재벌 인수 기업의 CAR$[-1,+1]$이 $-0.6$%인 반면 지배주주 부(wealth)는 $+1.5$% 증가함을 실증하였다.

대리인 위험의 정량화를 위해 ARI(Agency Risk Index)가 설계되었으나, 현재 구현 상태는 사양(design specification) 수준에 머물러 있다. 특히 `eps_stability`가 `ni_history` 미적재로 fallback 1.0으로 작동하여, HHI boost에 이익변동성 감쇠가 적용되지 않는 점은 대리인 비용 기반 보정 전체에 영향을 미친다 (P0-3, MIC-02).

**핵심 공식**

$$AC = MC + BF + RL$$

$$\beta^* = \frac{1}{1 + \rho\sigma^2 / \Delta f^2} \qquad \text{(Holmstrom 1979)}$$

$$\text{ARI} = w_1 \cdot \text{ROE\_inv} + w_2 \cdot \text{CAPEX\_excess} + w_3 \cdot (1 - BI) + w_4 \cdot \text{RPRR}$$

$$W = \alpha - C, \qquad WR = \alpha / C \qquad \text{(한국 재벌 평균 } C \approx 2\text{--}5\%, \; \alpha \approx 30\text{--}50\%\text{)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $AC$ | 총 대리인 비용 | KRW | 본 Stage |
| $MC,\,BF,\,RL$ | 감시비용, 결속비용, 잔여손실 | KRW | 본 Stage |
| $\beta^*$ | 최적 인센티브 강도 | 무차원 | 본 Stage |
| $\rho$ | 대리인 위험회피 계수 | 무차원 | 본 Stage |
| $\sigma^2$ | 산출물 분산 (환경 불확실성) | -- | 본 Stage |
| $\Delta f$ | 노력에 의한 산출 차이 | -- | 본 Stage |
| $\textcolor{stageOneMarker}{\text{ROE}}$ | 자기자본이익률 (financials.json) | % | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{NI}}$ | 당기순이익 | 억원 | **Stage 1** |
| $\text{RPRR}$ | 관계사 매출 비중 (tunneling proxy) | 무차원 | 본 Stage |
| $BI$ | 이사회 독립성 (사외이사/총원) | 무차원 | 본 Stage |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{ROE}}$는 `getFinancialData()`에서 당기순이익/자본총계로 산출된다. $\textcolor{stageOneMarker}{\text{NI}}$는 `eps_stability` 산출(NI 성장률 변동성)에 필요하나, 현재 `_financialCache`에 `ni_history` 배열이 적재되지 않아 활용 불가 상태이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| HHI $\times$ eps\_stability 보정 | `_applyMicroConfidenceToPatterns()` appWorker.js:1601 | Mean-reversion 패턴에 HHI boost 적용. 단, ARI는 설계 사양만 존재 (미구현). 현재 대리인 비용은 `eps_stability` fallback 1.0으로 중립화됨 |
| 투자 점수 (investment score) | `updateFinancials()` financials.js | ROE, 이익성장률, 밸류에이션 등급 합산으로 간접적 대리인 비용 반영 |
| ARI 설계 사양 | Doc 33 SS4.1--4.2 | $w_1=0.30,\,w_2=0.25,\,w_3=0.20,\,w_4=0.25$; ARI\_CONFIDENCE\_DECAY $= 0.20$ (\#166). Phase 1 간소화: ROE\_inv $+$ CAPEX\_excess만으로 $R^2 \approx 0.60$ |
| 재벌 괴리도 할인 | Doc 33 SS3.3 설계 사양 | wedge\_discount $= \min(0.15,\; 0.01 \times WR)$. WR $= 10$: $-10$%, WR $= 15$: $-15$% (cap) |

\newpage

### 2.4.6 시그널링 이론 (Signaling Theory)

**개요**

Spence (1973)의 직업시장 시그널링 모형은 정보 비대칭 하에서 고품질 주체가 비용이 드는 행동(costly signal)으로 자신의 유형을 드러내는 메커니즘을 정식화하였다. 핵심은 단일 교차 조건(single-crossing condition): 시그널 비용이 품질에 반비례($dC/d\theta < 0$)해야 분리 균형(separating equilibrium)이 성립한다. Ross (1977)는 이를 기업재무로 확장하여 부채 수준이 기업 품질의 신호가 됨을 보였다. 경영자의 보상 함수 $W = \gamma_0 + \gamma_1 V_t - L \cdot \mathbf{1}(\text{bankruptcy})$에서, 파산 시 패널티 $L$이 충분히 크면 고품질 기업만이 높은 부채를 감당할 수 있어 분리 균형이 형성된다.

Bhattacharya (1979)는 배당이 세금 비용과 외부조달 거래비용을 수반하므로 기업 품질의 신뢰할 수 있는 시그널이 됨을 보였다. 그러나 한국에서는 배당소득세($T_s$) $\approx$ 이자소득세($T_d$) $= 15.4$%로 배당의 세금 비용이 상대적으로 낮아 시그널의 credibility가 약화될 수 있으며, 자사주 매입이 더 강한 시그널로 기능할 가능성이 있다. Lintner (1956)의 배당 평활화 모형은 실증적으로 기업이 이익 변동의 30--50%만을 당기 배당에 반영($c \approx 0.3$--$0.5$)하며, 배당 삭감은 경영자도 더 이상 유지 불가하다는 매우 강한 부정적 시그널임을 확인하였다. 한국 기업의 조정 속도는 $c \approx 0.2$--$0.4$로 미국보다 느리며, 재벌 계열사는 내부유보 선호로 $c$가 더 낮다.

Myers & Majluf (1984)는 역선택 하에서 자본조달 서열이론(pecking order theory)을 정식 모형화하였다. 경영자가 기존 주주의 이익을 대리할 때, 자산 가치가 높은(고품질) 기업일수록 주식 발행 시 저평가로 인한 부의 이전이 커서 발행을 꺼린다. 따라서 $\text{NPV}_{\text{project}} > I \times (V_{\text{true}} - V_{\text{market}}) / (V_{\text{market}} + I)$일 때만 발행이 정당화되며, 내부자금 $\succ$ 부채 $\succ$ 주식의 서열이 도출된다.

**핵심 공식**

$$\frac{dC}{d\theta} < 0 \qquad \text{(Spence 단일 교차 조건: 시그널 비용이 품질과 역관계)}$$

$$W = \gamma_0 + \gamma_1 V_t - L \cdot \mathbf{1}(\text{bankruptcy}) \qquad \text{(Ross 1977)}$$

$$D_t - D_{t-1} = c\bigl(\tau E_t - D_{t-1}\bigr) + u_t \qquad \text{(Lintner 1956 배당 조정)}$$

$$\text{NPV}_{\text{project}} > I \times \frac{V_{\text{true}} - V_{\text{market}}}{V_{\text{market}} + I} \qquad \text{(Myers-Majluf 1984 발행 조건)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\theta$ | 기업 품질 유형 (private information) | -- | 본 Stage |
| $C(\theta)$ | 시그널 비용 함수 | KRW | 본 Stage |
| $\gamma_0,\,\gamma_1$ | 경영자 고정보상, 가치연동 계수 | KRW, 무차원 | 본 Stage |
| $L$ | 파산 시 경영자 패널티 | KRW | 본 Stage |
| $D_t$ | $t$기 배당 | KRW/주 | 본 Stage |
| $\tau$ | 목표 배당성향 (target payout ratio) | 무차원 | 본 Stage |
| $c$ | 배당 조정 속도 (speed of adjustment) | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{DPR}}$ | 배당성향 (배당금/순이익) | % | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{EPS growth}}$ | 주당순이익 성장률 (DART) | % | **Stage 1** |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{DPR}}$은 DART 사업보고서에서 추출 가능하며, 배당 증가/삭감의 시그널 방향을 판별하는 핵심 입력이다. $\textcolor{stageOneMarker}{\text{EPS growth}}$는 Lintner 모형의 이익 변수 $E_t$에 대응하며, 영구적 이익 개선 여부를 판단하는 기준이 된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 배당 증가 시그널 | `signal_dividend_bonus = +0.05` (\#106, Doc 31 SS3.4) | 설계 상수만 존재 (D등급). 공시 이벤트 신호는 향후 통합 예정 |
| 자사주 매입 시그널 | `signal_buyback_bonus = +0.08` (\#107, Doc 31 SS3.4) | 설계 상수만 존재 (D등급). 한국 시장에서 배당보다 강한 시그널로 이론적 타당성 높음 |
| Myers-Majluf 역선택 | 유상증자 이벤트 감지 (미구현) | 유상증자 공시 시 약세 패턴 신뢰도 강화의 이론적 근거 |
| Lintner 배당 평활화 | `updateFinancials()` financials.js | 배당성향 표시 및 투자 점수 산출에 간접 반영. 배당 삭감 이벤트의 패턴 연동은 미구현 |

### 2.4.7 EVA 경제적 부가가치 (Economic Value Added)

**개요**

경제적 부가가치(EVA)는 G. Bennett Stewart III(1991)가 Stern Stewart & Co.를 통해 상용화한 기업 성과 측정 지표로, 회계적 이익이 자기자본의 기회비용을 반영하지 않는다는 한계를 보완한다. EVA는 세후 영업이익(NOPAT)에서 투하자본(IC)의 자본비용 금액(WACC × IC)을 차감한다. ROE가 양수이더라도 자기자본비용($R_e$)보다 낮다면 회사는 회계적 흑자지만 경제적 적자를 내고 있는 것이다.

ROIC 분해는 EVA 양부의 원천을 진단하는 도구다. ROIC = NOPAT / IC를 세후 영업마진(NOPAT/매출액) × 투하자본 회전율(매출액/IC)로 분해하면, 가치 창출 또는 파괴의 근원이 수익성 문제인지 자산효율성 문제인지 식별할 수 있다. 한국 섹터별로 보면 반도체(삼성전자, SK하이닉스) 호황기 ROIC 10~30%는 WACC 8~10%를 크게 상회하여 강한 EVA 양수를 기록하고, 유틸리티·규제산업은 ROIC 4~7%로 WACC(6~7%)에 근접한 박리(thin margin) 구조다.

MVA(Market Value Added)는 미래 EVA 스트림의 현재가치 합으로 정의되며, 주가에는 이미 미래 EVA 기대가 반영되어 있다. 따라서 EVA 개선 공시나 ROIC 상승 전환은 강한 주가 상승 촉매로 작용한다. CheeseStock의 패턴 신호 신뢰도 조정은 이 관계를 활용하여 EVA 양수·ROIC > WACC 종목에서 매수 패턴의 신뢰도를 상향한다.

EVA 실무 계산에서 투하자본(IC) 산출에는 두 가지 방법이 있다. 자산 접근법은 총자산에서 비이자성 유동부채(매입채무, 미지급금 등)를 차감하고, 자본 접근법은 자기자본에 이자부채를 가산한다. 두 방법은 이론적으로 동일한 결과를 내지만 실무 데이터의 분류 방식에 따라 소폭 차이가 발생할 수 있다.

**핵심 공식**

$$EVA = NOPAT - WACC \times IC$$

$$NOPAT = EBIT \times (1 - T_c)$$

$$IC = \text{자기자본} + \text{이자부채} \quad \text{(자본 접근법)}$$

$$ROIC = \frac{NOPAT}{IC} = \underbrace{\frac{NOPAT}{\text{매출액}}}_{\text{세후 영업마진}} \times \underbrace{\frac{\text{매출액}}{IC}}_{\text{투하자본 회전율}}$$

$$EVA = IC \times (ROIC - WACC)$$

$$MVA = \sum_{t=1}^{\infty} \frac{EVA_t}{(1+WACC)^t}$$

$$EVA > 0 \iff ROIC > WACC$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $EVA$ | 경제적 부가가치 | 원 | 본 Stage |
| $NOPAT$ | 세후 영업이익 | 원 | 본 Stage |
| $IC$ | 투하자본 | 원 | 본 Stage |
| $ROIC$ | 투하자본수익률 | % | 본 Stage |
| $MVA$ | 시장부가가치 | 원 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{NOPAT}}$ | DART 영업이익 × (1-T) | 원 | **Stage 1** |
| $\textcolor{stageOneMarker}{IC}$ | DART 자본총계 + 이자부채 | 원 | **Stage 1** |
| $\textcolor{stageOneMarker}{WACC}$ | CAPM 기반 산출 WACC | % | **Stage 1** (`compute_capm_beta.py`) |

> **이전 Stage 데이터:** Stage 1 DART 파이프라인에서 수신한 `영업이익(EBIT)`에 `(1-실효세율)`을 곱하여 NOPAT을 산출한다. IC는 `자본총계` + `이자부채`(단기차입금 + 유동성장기부채 + 사채 + 장기차입금)로 계산한다. `compute_eva.py` 스크립트가 이 계산을 수행하고 결과를 `data/financials/{code}.json`의 `eva` 필드에 기록한다.

**한국 섹터별 ROIC vs WACC**

| 섹터 | ROIC 범위 | WACC | EVA 판정 |
|------|-----------|------|---------|
| 반도체 (호황기) | 10~30% | 8~10% | 강한 양수 |
| 자동차 | 5~12% | 8~9% | 주기적 양/음 |
| 유틸리티 | 4~7% | 6~7% | 박리 균형 |
| 바이오/플랫폼 (성장기) | 음수 | 12~15% | 음수 (정상) |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| EVA 계산 | `compute_eva.py` | `data/financials/{code}.json` eva 필드 생성 |
| EVA 표시 | `financials.js` EVA 행 (green/red) | D 컬럼 재무패널 EVA 녹색/적색 표시 |
| ROIC > WACC 판단 | `financials.js updateFinancials()` | 주주가치 창출/파괴 시각화 |
| MVA 근사 | PBR − 1 (장부가 초과 프리미엄) | 시장이 미래 EVA를 얼마나 할인하는지 간접 추정 |

\newpage

### 2.4.8 Kelly 기준과 포지션 사이징 (Kelly Criterion & Position Sizing)

**개요**

John L. Kelly Jr.(1956)는 Bell System Technical Journal에 발표한 논문에서 정보이론을 활용하여 장기 자산 기하 성장률을 최대화하는 최적 베팅 비율($f^*$)을 도출했다. Kelly 기준의 핵심 통찰은 산술 평균이 아닌 기하 평균을 최대화한다는 점이다. 복리 효과 하에서 과도한 베팅은 단기 기대수익을 높이지만 장기적으로 파산 위험을 폭발적으로 증가시킨다. Kelly 비율의 두 배($2f^*$) 이상을 투자하면 유한 시간 내에 파산이 확실해진다는 에르고딕 파산(ergodic ruin) 결과가 이를 뒷받침한다(Peters, 2019).

CheeseStock의 백테스트 시스템은 각 패턴의 역사적 승률($p$)과 손익비($b$)를 `backtester.js`에서 산출하여 Kelly 비율을 계산한다. 실무에서는 매개변수 추정 오차를 반영하여 Half-Kelly($0.5f^*$)를 표준으로 사용한다. Thorp(2006)에 따르면 Half-Kelly는 Full Kelly 대비 성장률을 75% 수준으로 유지하면서 변동성을 50% 감소시켜, 추정 오차에 대한 충분한 버퍼를 제공한다.

다자산 Kelly 기준은 단일 자산 공식을 N개 자산으로 확장한 것으로, 최적 비중 벡터가 수익률 공분산 행렬의 역행렬과 기대 초과수익 벡터의 곱으로 표현된다. 이는 수학적으로 Markowitz 접선 포트폴리오와 동치다. 로그 효용함수($U(W) = \ln W$) 하에서 기대효용 최대화와 기하 성장률 최대화가 일치하는 유일한 함수라는 점이 Kelly 기준의 이론적 정당성이다.

Peters(2019)의 에르고딕 경제학은 Kelly 기준에 역학(mechanics) 기반 근거를 제공한다. 금융 수익률은 곱셈적(multiplicative) 과정으로 비에르고딕이므로, 앙상블 평균($\mu$)이 아닌 시간 평균($\mu - \sigma^2/2$)이 실제 투자자가 경험하는 성장률이다. Kelly 기준은 이 시간 평균 성장률을 정확히 최대화한다. 손실 회피(loss aversion)가 행동경제학에서 "비합리적" 편향으로 분류되어 왔으나, 에르고딕 관점에서는 비에르고딕 세계에서의 최적 전략임이 재해석된다.

**핵심 공식**

$$f^* = \frac{bp - q}{b} = \frac{\text{edge}}{\text{odds}} \quad \text{(이진 Kelly)}$$

$$f^* = \frac{\mu}{\sigma^2} \quad \text{(연속 Kelly, 주식 시장 적용)}$$

$$G(f) = p \cdot \ln(1 + bf) + q \cdot \ln(1-f) \quad \text{(기하 성장률)}$$

$$\frac{dG}{df} = 0 \implies f^* = \frac{bp - q}{b}$$

$$\mathbf{f}^* = \Sigma^{-1} \boldsymbol{\mu} \quad \text{(다자산 Kelly)}$$

$$\bar{r} = \mu - \frac{\sigma^2}{2} \quad \text{(시간 평균 성장률, Peters 2019)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $f^*$ | 최적 투자 비율 | 무차원 (0~1) | 본 Stage |
| $b$ | 순배당률 (손익비) | 무차원 | 본 Stage |
| $p$ | 승률 (winning probability) | 확률 | 본 Stage |
| $q = 1-p$ | 패률 | 확률 | 본 Stage |
| $G(f)$ | 기하 성장률 | log-return | 본 Stage |
| $\mu$ | 기대 초과수익률 | % | 본 Stage |
| $\sigma^2$ | 수익률 분산 | %² | 본 Stage |
| $\Sigma$ | 수익률 공분산 행렬 | — | 본 Stage |
| $\textcolor{stageOneMarker}{p_{\text{backtest}}}$ | 패턴별 역사적 승률 | 확률 | **Stage 1** (`backtester.js`) |
| $\textcolor{stageOneMarker}{b_{\text{backtest}}}$ | 패턴별 역사적 손익비 | 무차원 | **Stage 1** (`backtester.js`) |

> **이전 Stage 데이터:** Stage 1 백테스트 파이프라인(`backtester.js`)은 각 패턴의 N일 수익률 통계에서 승률(`wins/n`)과 손익비(`payoffRatio`)를 산출한다. `kellyEdge = max(0, WR - wrNull)` 계산 후 `kellyRaw = (kellyEdge*(1+payoffRatio) - 1) / payoffRatio`로 Kelly 비율을 도출하고, `[0, 1.0]`으로 클램핑하여 `kellyFraction` 필드에 저장한다(라인 1599~1602). 음수 Kelly는 "베팅하지 말라"는 신호로 처리된다.

**에르고딕 관점: 앙상블 평균 vs 시간 평균**

| 구분 | 수식 | 의미 |
|------|------|------|
| 앙상블 평균 | $\langle R \rangle = \mu$ | N명 투자자의 횡단면 평균 수익 |
| 시간 평균 | $\bar{r} = \mu - \sigma^2/2$ | 1명 투자자의 장기 기하 성장률 |
| 변동성 드래그 | $\sigma^2/2$ | Kelly가 제거하는 비에르고딕 손실 |
| Half-Kelly 이점 | 성장률 75%, 분산 25% | 추정 오차 버퍼 + 심리 안정 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 이진 Kelly $f^*$ | `backtester.js:1599-1602` `kellyFraction` | 패턴별 최적 포지션 비율 산출 |
| Half-Kelly 권장 | `appState.js` Tier 포지션 설정 | Tier별 Kelly 비율 × 0.5 포지션 상한 |
| 에르고딕 파산 방지 | `kellyFraction` 상한 1.0 클램핑 | 레버리지 방지: Full Kelly 초과 불허 |
| 다자산 Kelly | 향후 포트폴리오 최적화 예정 | 멀티 패턴 동시 보유 시 최적 비중 |

\newpage

### 2.4.9 경영학 도출 요약 (Business Finance Summary)

**개요**

본 절(2.4)은 기업재무론의 핵심 이론 여덟 가지가 CheeseStock의 분석 파이프라인에 어떻게 통합되는지를 정리한다. DCF와 WACC(2.4.1, 2.4.4)는 패턴 신호가 발생한 종목의 내재가치 맥락을 제공하고, 자본구조 이론(2.4.2, 2.4.3)은 종목의 재무 건전성과 세후 자본비용 추정의 이론적 근거가 된다. 대리인 이론(2.4.5)은 경영진 인센티브 구조를 통한 신뢰도 조정에, 시그널링 이론(2.4.6)은 공시 이벤트 해석에 각각 활용된다. EVA(2.4.7)는 D 컬럼 재무패널의 주주가치 창출 여부 판단 기준이 되고, Kelly 기준(2.4.8)은 백테스트 결과를 포지션 크기로 변환하는 수학적 다리 역할을 한다.

기술적 분석과 기업재무론은 상호 보완적이다. 기술적 분석이 "가격이 어디로 가는가(방향)"를 묻는다면, 기업재무론은 "가격이 어디에 있어야 하는가(수준)"를 묻는다. 이 두 질문이 교차하는 지점, 즉 내재가치 대비 과매도·과매수 구간에서 발생하는 기술적 반전 패턴이 CheeseStock의 핵심 투자 기회 식별 논리다. 저PBR(내재가치 이하)에서 이중바닥 패턴이 발생하거나, EVA 흑자 전환 시점에 골든크로스가 나타날 때 두 분석 계층이 동시에 신호를 발생시켜 신뢰도가 증폭된다.

앞으로의 활용 계층화를 위해, 제3장에서 EVA는 종목 신뢰도 조정(CONF-M2 채널), Kelly 기준은 Tier별 포지션 크기 결정에 각각 적용된다. CONF-M2는 EVA > 0 조건에서 패턴 신뢰도를 0~15% 상향 조정하는 메커니즘으로 설계될 예정이며, Kelly 비율은 `backtester.js`의 `kellyFraction` 필드로 이미 구현되어 있다.

**핵심 공식**

$$\text{종합 신뢰도} = \underbrace{f(\text{패턴 품질})}_{\text{기술적 분석}} \times \underbrace{g(\text{EVA, PBR, WACC})}_{\text{기업재무 조정}} \times \underbrace{h(\text{매크로 환경})}_{\text{2.5절}}$$

$$\text{포지션 크기} = \text{Tier 한도} \times \min\!\left(\frac{f^*_{\text{Kelly}}}{2},\; f^*_{\text{max}}\right)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $f(\cdot)$ | 패턴 품질 점수 함수 | 0~1 | 본 Stage |
| $g(\cdot)$ | 재무 조정 함수 (EVA, PBR, WACC) | 0~1 | 본 Stage |
| $h(\cdot)$ | 매크로 환경 조정 함수 | 0~1 | **2.5절** |
| $f^*_{\text{Kelly}}$ | 패턴별 Kelly 비율 | 0~1 | **Stage 1** |
| $f^*_{\text{max}}$ | Tier별 최대 포지션 한도 | 0~1 | 본 Stage |

> **이전 Stage 데이터:** 통합 신뢰도 계산의 각 입력값은 Stage 1에서 수신된 데이터에 기반한다. $f^*_{\text{Kelly}}$는 `backtester.js kellyFraction`, EVA는 `compute_eva.py` 출력물, $R_f$(매크로)는 ECOS API 국고채 수익률을 사용한다.

**2.4절 핵심 학술 개념 통합 요약**

| 절 | 학술 개념 | 핵심 수식 | 적용 영역 |
|----|-----------|-----------|-----------|
| 2.4.1 | DCF (Damodaran 1995) | $V = \sum FCF_t/(1+WACC)^t + TV$ | `updateFinancials()` PER/PBR 역산 |
| 2.4.2 | MM 정리 (1958/1963) | $V_L = V_U + T_c D$ | D/E → WACC 계산, IC 분모 |
| 2.4.3 | Miller 개인세 (1977) | $G_L = [1-(1-T_c)(1-T_s)/(1-T_d)]D$ | 소액주주 비과세 Case B WACC 보정 |
| 2.4.4 | WACC + Hamada (1972) | $\beta_L = \beta_U[1+(1-T_c)D/E]$ | `compute_eva.py`, `compute_capm_beta.py` |
| 2.4.5 | 대리인이론 (Jensen-Meckling 1976) | $AC = MC + BF + RL$ | `_applyMicroConfidence()` 대리인 비용 프록시 |
| 2.4.6 | Ross 재무 시그널링 (1977) | $V^*(D) > V^*(D')$ if $D > D'$ | 향후 통합 예정: 공시 이벤트 신호 |
| 2.4.7 | EVA (Stewart 1991) | $EVA = NOPAT - WACC \times IC$ | `compute_eva.py`, `financials.js` EVA 행 |
| 2.4.8 | Kelly 기준 (Kelly 1956) | $f^* = (bp-q)/b$ | `backtester.js:1599-1602` `kellyFraction` |

**제3장 적용 예고**

제3장에서 본 절의 이론들이 다음과 같이 직접 연결된다.

- **CONF-M2**: EVA > 0 ∧ ROIC > WACC 조건에서 매수 패턴 신뢰도 +5~15% 상향
- **CONF-M3**: WACC 변화 방향(금리 환경)에 따라 성장주·가치주 패턴 신뢰도 비대칭 조정
- **Tier 포지션**: `appState.js` Tier 한도 × `kellyFraction × 0.5` = 실행 포지션 비율
- **DCF 크로스체크**: PBR < 1.0(내재가치 이하) + 이중바닥 패턴 = 복합 매수 신호

---

\newpage

## 2.5 경제학적 기초: 거시경제와 미시경제[^econ-1]

경제학은 주식시장 행태를 지배하는 거시경제적, 미시경제적 맥락을 제공한다.
거시경제학(2.5.1-2.5.11)은 경기순환, 통화정책, 환율, 수익률 곡선 등
시장 전체에 영향을 미치는 체계적 요인을 다루며, 패턴 신뢰도의 매크로 조정에
직접 활용된다. 미시경제학(2.5.12-2.5.14)은 수요-공급 메커니즘, 산업 집중도,
정보비대칭 등 개별 종목 수준의 구조적 특성을 다루며, 종목별 미시 조정에
활용된다.

### 2.5.1 IS-LM 모형과 통화정책 (IS-LM Model and Monetary Policy)

**개요**

IS-LM 모형은 Hicks(1937)가 Keynes(1936)의 *General Theory*를 2차원 도식으로 변환한 이래 단기 거시균형 분석의 표준 프레임워크로 사용되어 왔다. IS 곡선은 재화시장의 균형(투자=저축)을, LM 곡선은 화폐시장의 균형(유동성 선호=화폐공급)을 나타내며, 두 곡선의 교차점에서 균형 산출량 $Y^*$와 균형 이자율 $r^*$가 동시에 결정된다.

한국은 GDP 대비 수출 비중이 약 50%에 달하는 소규모 개방경제이므로, 폐쇄경제 IS-LM만으로는 분석이 불완전하다. 변동환율제 하에서 통화정책이 재정정책보다 유효하다는 먼델-플레밍 결과(2.5.3절에서 후술)가 한국 주식시장에서의 BOK 기준금리 발표의 지배적 영향력을 이론적으로 뒷받침한다. 한국 파라미터 추정치로는 한계소비성향 $c_1 \approx 0.55$, 한계세율 $t \approx 0.25$, 한계수입성향 $m \approx 0.45$가 사용된다(BOK 2023, 관세청).

IS-LM 비교정학은 정책 충격의 방향과 크기를 예측하는 데 핵심이다. 통화확장($M/P$ 증가)은 $Y$ 증가와 $r$ 하락을 동시에 가져오는 "이중 호재"인 반면, 재정확장($G$ 증가)은 $Y$ 증가와 함께 $r$ 상승(구축효과)을 수반하여 성장주에 비우호적이다. 이러한 비대칭성이 CheeseStock의 `_applyMacroConfidence` 함수에서 매크로 이벤트별 패턴 신뢰도 차등 조정의 이론적 기반이 된다.

**핵심 공식**

$$Y = \frac{A - b \cdot r}{1 - c_1(1-t) + m}, \qquad A = C_0 - c_1 T_0 + I_0 + G_0 + X_0 + \eta \cdot e$$

$$\text{IS}: \; r = \frac{A}{b} - \frac{1 - c_1(1-t) + m}{b} \cdot Y$$

$$\text{LM}: \; r = \frac{k}{h} \cdot Y - \frac{M/P}{h}$$

$$Y^* = \frac{h \cdot A + b \cdot (M/P)}{h \cdot s + b \cdot k}, \quad r^* = \frac{k \cdot A - s \cdot (M/P)}{h \cdot s + b \cdot k}, \quad s = 1 - c_1(1-t) + m$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $c_1$ | 한계소비성향(MPC) | 무차원 | BOK 국민계정 |
| $t$ | 한계세율 | 무차원 | 국세통계연보 |
| $m$ | 한계수입성향 | 무차원 | 관세청 수출입동향 |
| $b$ | 투자의 이자율 민감도 | 십억원/%p | Kim & Park(2016) |
| $k$ | 소득의 화폐수요 민감도 | 무차원 | BOK M2/GDP |
| $h$ | 이자율의 화폐수요 민감도 | 십억원/%p | Kim & Park(2016) |
| $\textcolor{stageOneMarker}{i_{\text{BOK}}}$ | BOK 기준금리 | %p | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{CLI}}$ | OECD 경기선행지수 | 지수(100=추세) | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 $i_{\text{BOK}} = 2.50\%$, $\text{CLI} = 101.65$가 수집되었으며, IS-LM 균형 판별의 입력으로 사용된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| IS-LM 비교정학 (통화/재정 비대칭) | `_applyMacroConfidenceToPatterns()` | 매크로 이벤트별 패턴 신뢰도 차등 조정 |
| 유동성 함정 판별 ($h \to \infty$) | `MCS_THRESHOLDS`, BOK 기준금리 0.75% 이하 | 통화정책 이벤트 트레이딩 신호 감쇠 |
| 구축효과 (재정확장 시 $r$ 상승) | `conf_fiscal = 1.03` (Doc30 \S1.4) | 추경 발표 시 제한적 conf 조정 |

---

\newpage

### 2.5.2 테일러 준칙 (Taylor Rule)

**개요**

테일러 준칙은 Taylor(1993)가 제안한 통화정책 준칙으로, 중앙은행의 정책금리 설정을 인플레이션 갭과 산출량 갭의 선형함수로 정형화한다. 한국은행이 공식적으로 테일러 준칙을 따르지는 않으나, 사후적(ex post) 분석에서 금통위 결정은 테일러 준칙과 높은 정합성을 보인다. 핵심 파라미터 중 자연이자율 $r^*$은 Laubach-Williams(2003) 추정의 한국 적용 하한인 0.5%를 사용하며, 이는 `macro_composite.json`의 `taylor_r_star=0.5`과 동기화된다. 1.0%가 아닌 0.5%를 채택하는 이유는 한국의 잠재성장률 하락 추세(2020년대 2% 미만)와 인구구조 변화를 반영한 것이다.

테일러 갭(Taylor gap)은 실제 정책금리와 테일러 준칙이 시사하는 금리의 차이($i_{\text{actual}} - i_{\text{Taylor}}$)로, 갭의 부호가 통화정책 스탠스를 나타낸다. 양(+)의 갭은 과도한 긴축(hawkish)으로 성장주를 억압하고 금융주에 유리하며, 음(-)의 갭은 과도한 완화(dovish)로 성장주 부양과 자산 버블 위험을 동시에 내포한다. 현재 시스템의 테일러 갭은 $-0.65\%$p로 완화적 스탠스를 시사한다.

산출량 갭 추정에는 OECD CLI(경기선행지수 순환변동치)를 프록시로 사용한다. CLI는 100을 장기 추세로 정규화하므로, $(CLI - 100) \times 0.5$로 산출량 갭을 근사한다. BOK의 공식 산출량 갭 추정치는 연 2회(통화신용정책보고서)만 공개되므로, CLI 기반 실시간 프록시가 실용적이다.

**핵심 공식**

$$i^* = r^* + \pi + a_\pi(\pi - \pi^*) + a_y(\tilde{y} - \tilde{y}^*)$$

$$\text{Taylor\_gap} = i_{\text{actual}} - i^*$$

$$\tilde{y} = (CLI - 100) \times \text{CLI\_TO\_GAP\_SCALE}, \quad \text{CLI\_TO\_GAP\_SCALE} = 0.5 \;\; (\#139)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $r^*$ | 자연이자율(균형 실질이자율) | %p | Laubach-Williams(2003) |
| $\pi$ | 현재 CPI 인플레이션율 | %YoY | 통계청 |
| $\pi^*$ | 인플레이션 목표 | %p | BOK 공식(2.0%) |
| $a_\pi$ | 인플레 반응 계수 | 무차원 | Taylor(1993): 0.50 |
| $a_y$ | 산출량 갭 반응 계수 | 무차원 | Taylor(1993): 0.50 |
| $\textcolor{stageOneMarker}{\pi_{\text{CPI}}}$ | CPI 전년동월비 | %YoY | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{Taylor\_gap}}$ | 테일러 갭 | %p | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 $\pi_{\text{CPI}} = 2.16\%$, $\text{Taylor\_gap} = -0.65\%$p가 수집되었다. 현재 BOK 기준금리(2.50%)가 테일러 시사금리(3.15%)보다 낮아 완화적 스탠스이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Taylor gap $\to$ 금리 방향 프록시 | CONF-F7, `_applyMacroConfidenceToPatterns()` L1271-1295 | dovish: 매수 부스트, hawkish: 매도 부스트 |
| Dead band $\lvert gap \rvert < 0.5\%$p | 상수 #141 = 0.25 (정규화) | 미약한 갭에서 불필요한 조정 억제 |
| Gap 정규화 $[-2, +2] \to [-1, +1]$ | `tgNorm = clamp(taylorGap/2, -1, 1)` | 극단 갭에서 과도한 승수 방지 |

---

\newpage

### 2.5.3 먼델-플레밍 모형 (Mundell-Fleming Model)

**개요**

먼델-플레밍 모형은 Mundell(1963)과 Fleming(1962)이 IS-LM을 개방경제로 확장한 것으로, 국제수지(BP) 곡선을 추가하여 환율-이자율-산출량의 삼원 균형을 분석한다. 핵심 결론인 "삼위일체 불가능성(Trilemma)"에 의하면, 자유로운 자본이동, 독립적 통화정책, 고정환율제를 동시에 달성할 수 없다. 한국은 1997년 외환위기 이후 변동환율제를 채택하여 자본이동의 자유와 통화정책 독립성을 선택했다(단, de facto 관리변동에 가까움).

변동환율제 하에서 먼델-플레밍의 핵심 결과는 통화정책이 재정정책보다 유효하다는 것이다. BOK 기준금리 인하 시 내외금리차 축소 $\to$ 자본유출 $\to$ KRW 약세 $\to$ 순수출 증가로 산출량이 크게 증가한다. 반면 재정확장은 금리 상승 $\to$ 자본유입 $\to$ KRW 강세 $\to$ 순수출 감소로 효과가 상쇄된다. 실증적으로 BOK -25bp 인하는 당일 KOSPI +1.2%를 유발하는 반면, 추경 10조원은 당일 +0.3%에 그친다.

한미 금리차($i_{\text{BOK}} - i_{\text{Fed}}$)는 자본유출입 압력의 핵심 변수이다. 현재 한미 금리차는 $-1.14\%$p로, 미국 금리가 한국보다 높아 구조적 자본유출 압력이 존재한다. 이는 원화 약세($1,514$원/달러)와 외국인 순매도 경향으로 관측되며, 수출주 실적에는 호재이나 외국인 수급에는 악재인 이중적 효과를 나타낸다.

**핵심 공식**

$$BP = NX(Y, e) + KA(r - r^*, E[\Delta e]) = 0$$

$$r = r^* + E[\Delta e] + \frac{m}{\kappa} \cdot Y - \frac{X_0 + \eta \cdot e}{\kappa}$$

$$\text{통화확장}(M\uparrow): \; r\downarrow \to \text{자본유출} \to e\downarrow \to NX\uparrow \to Y\uparrow \quad (\text{Strong})$$

$$\text{재정확장}(G\uparrow): \; r\uparrow \to \text{자본유입} \to e\uparrow \to NX\downarrow \to Y \approx 0 \quad (\text{Weak})$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\kappa$ | 자본이동성 | 십억원/%p | Lane & Milesi-Ferretti(2007) |
| $r^*$ | 해외이자율(Fed Funds Rate) | %p | FRED |
| $E[\Delta e]$ | 기대환율변동률 | %YoY | 시장 컨센서스 |
| $\textcolor{stageOneMarker}{i_{\text{Fed}}}$ | 미국 연방기금금리 | %p | **Stage 1** |
| $\textcolor{stageOneMarker}{e_{\text{USD/KRW}}}$ | 원/달러 환율 | 원/달러 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 $i_{\text{Fed}} = 3.64\%$, $e_{\text{USD/KRW}} = 1{,}514$원이 수집되었다. 한미 금리차 $-1.14\%$p는 자본유출 압력을 시사한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 한미 금리차 $\to$ 자본유출입 | CONF-F9, `rate_diff` in `macro_latest.json` | 외국인 수급 방향 보정 |
| 환율 $\to$ 수출채널 | `_applyMacroConfidenceToPatterns()` | 수출주 패턴 신뢰도 환율 연동 |
| BOK vs 추경 비대칭성 | `conf_bok=1.08` vs `conf_fiscal=1.03` | 이벤트 유형별 conf 차등 |

---

\newpage

### 2.5.4 AD-AS 프레임워크 (Aggregate Demand -- Aggregate Supply Framework)

**개요**

AD-AS 모형은 IS-LM이 고정한 물가수준 $P$를 내생화하여 물가와 산출량의 동시 결정을 분석한다. 총수요(AD) 곡선은 IS-LM 균형에서 $P$를 변화시킬 때 $Y^*$의 궤적이며, 우하향한다. 우하향의 세 가지 메커니즘은 피구 효과(실질잔고 효과), 케인즈 효과(이자율 효과), 먼델-플레밍 효과(환율 효과)이며, 한국에서는 수출 비중이 높아 환율 효과가 가장 강력하다.

총공급(AS) 곡선은 학파에 따라 형태가 근본적으로 다르다. 고전학파의 LRAS는 수직($Y = Y_n$)으로 물가 변화가 실질변수에 무영향이며, 케인즈학파의 SRAS는 가격경직성으로 인해 우상향하여 수요 변화가 산출량에 영향을 미친다. 뉴케인지언 필립스 곡선(NKPC, 2.5.7절)은 이를 미시적 기초에서 도출한 현대적 AS 곡선이다.

AD-AS 프레임워크의 핵심 활용은 4가지 충격 시나리오 분석이다. 양(+)의 수요충격은 $P\uparrow, Y\uparrow$로 추세추종 패턴 신뢰도를 높이고, 음(-)의 공급충격(스태그플레이션)은 $P\uparrow, Y\downarrow$로 모든 패턴 신뢰도를 저하시킨다. 한국의 경우 2022년 상반기 러시아-우크라이나발 유가 급등이 음의 공급충격, 2023년 하반기 반도체 업턴이 양의 공급충격(골디락스 근사)에 해당한다.

**핵심 공식**

$$Y_{AD}(P) = \frac{h \cdot A + b \cdot (M/P)}{D}, \quad \frac{dY_{AD}}{dP} = -\frac{bM}{D \cdot P^2} < 0$$

$$\text{SRAS}: \; P = P^e + \frac{1}{\alpha}(Y - Y_n)$$

$$\text{LRAS}: \; Y = Y_n \;\; (\text{수직, 장기 화폐중립성})$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $P^e$ | 기대물가수준 | 지수 | 임금계약 시 설정 |
| $\alpha$ | 가격경직성 파라미터 | 무차원 | Blanchard & Fischer(1989): 1.20 |
| $Y_n$ | 자연산출량(잠재GDP) | 십억원 | BOK 추정 |
| $D$ | IS-LM 분모 ($hs + bk$) | 무차원 | 균형해 도출 |

**4가지 충격 시나리오**

| 시나리오 | 원인 | $P$ | $Y$ | 패턴 conf 조정 | KRX 사례 |
|----------|------|-----|-----|----------------|----------|
| 수요(+) | M$\uparrow$, 수출 호조 | $\uparrow$ | $\uparrow$ | 추세추종 +0.08 | 2020 Q3 유동성 완화 |
| 수요(-) | 금융 긴축, 소비 위축 | $\downarrow$ | $\downarrow$ | 반전 +0.10 | 2020 Q1 COVID |
| 공급(-) | 유가 급등, 공급망 교란 | $\uparrow$ | $\downarrow$ | 전체 -0.12 | 2022 H1 스태그플레이션 |
| 공급(+) | 기술혁신, 유가 하락 | $\downarrow$ | $\uparrow$ | 전체 +0.05 | 2023 H2 반도체 슈퍼사이클 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 4-충격 시나리오 | `_applyMacroConfidenceToPatterns()` conf_adj | 레짐별 패턴 유형 차등 조정 |
| AD 이동 요인 (해외 수요 지배) | MCS v2 수출 가중치 0.10 | 글로벌 경기가 한국 AD 지배 |
| SRAS 좌측이동 = 스태그플레이션 | VIX > 30 + 원자재 급등 복합 판단 | 전 패턴 신뢰도 감산 |

---

\newpage

### 2.5.5 Stovall 섹터 회전 모형 (Stovall Sector Rotation Model)

**개요**

Stovall(1996)의 "Standard & Poor's Guide to Sector Investing"은 경기순환 4국면(Early Expansion, Late Expansion, Early Contraction, Late Contraction)별로 초과수익이 기대되는 섹터를 체계화한 최초의 실증 연구이다. 초기 확장기에는 금융, IT, 경기소비재가, 후기 확장기에는 에너지와 소재가, 초기 수축기에는 헬스케어, 유틸리티, 필수소비재가, 후기 수축기에는 산업재와 경기소비재가 각각 선호된다.

한국 시장 적용에는 구조적 한계가 존재한다. KRX는 반도체/자동차 수출 편중(KOSPI 시총의 약 30%)으로 글로벌 수요 사이클에 동조하며, 재벌(chaebol) 구조로 섹터 간 자금 이동이 미국과 다른 패턴을 보인다. KOSDAQ에서는 개인투자자 비중이 높아 전통적 섹터 회전이 작동하지 않을 수 있다. 따라서 CheeseStock에서는 Stovall 모형을 직접 적용하되, 0.5 감쇄(dampening) 계수를 적용하여 과신을 방지한다.

경기국면 판별은 OECD CLI(경기선행지수)와 PMI를 결합하여 수행한다. CLI > 100이고 상승 추세이면 Expansion, CLI > 100이고 하락 추세이면 Peak, CLI < 100이고 하락 추세이면 Contraction, CLI < 100이고 상승 추세이면 Trough로 분류한다. 현재 CLI = 101.65이고 상승 추세(delta = +0.20)이므로 Expansion 국면이며, 11개월째 지속 중이다.

**핵심 공식**

$$\text{conf\_adj}_{sector} = 1 + 0.5 \times (\text{STOVALL\_MULT}_{sector,phase} - 1.0)$$

$$\text{sell\_mult} = 2.0 - \text{buy\_mult} \quad (\text{매도 패턴 대칭 역전})$$

$$\text{Phase} = f(CLI, \Delta CLI): \; \begin{cases} \text{Expansion} & CLI > 100, \Delta CLI > 0 \\ \text{Peak} & CLI > 100, \Delta CLI \leq 0 \\ \text{Contraction} & CLI < 100, \Delta CLI < 0 \\ \text{Trough} & CLI < 100, \Delta CLI \geq 0 \end{cases}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| STOVALL_MULT | 국면-섹터 승수 | 무차원 | Stovall(1996) |
| 0.5 | 감쇄 계수 (KRX 미검증 보정) | 무차원 | 설계값 |
| $\textcolor{stageOneMarker}{\text{CLI}}$ | OECD 경기선행지수 | 지수(100=추세) | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{PMI}}$ | 제조업 구매관리자지수 | 지수(50=확장/수축) | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 $\text{CLI} = 101.65$, $\text{cycle\_phase} = \text{expansion}$(11개월)이 수집되었다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 경기국면-섹터 승수 매핑 | `_STOVALL_CYCLE` (appState.js L416) | 12섹터 $\times$ 4국면 신뢰도 승수 |
| KSIC $\to$ GICS-like 매핑 | `_getStovallSector()` (appState.js L489) | KSIC 137개 세분류 $\to$ 11개 대분류 |
| 감쇄 적용 | CONF-F1a, `_applyMacroConfidenceToPatterns()` | 미검증 모형의 과신 방지 |

---

\newpage

### 2.5.6 MCS 복합경기점수 (Macro Composite Score v2)

**개요**

MCS(Macro Composite Score)는 다수의 거시경제 지표를 단일 점수로 종합하여 거시환경의 강세/약세를 판별하는 복합지수이다. 초기 MCS v1은 PMI, CSI, 수출, 금리스프레드, EPU 역수의 5요소 가중합이었으나, 현재 시스템의 권위적(authoritative) 버전은 8요소 MCS v2이다. v2는 CLI, ESI, IPI, 소비자신뢰, PMI, 수출, 실업률 역수, 금리스프레드를 포함하며, v1의 EPU(경제정책불확실성)는 VIX 프록시와의 중복으로 제거되었다.

MCS v2는 0-100 스케일로 `macro_composite.json`의 `mcsV2` 필드에 저장된다. 현재값 65.7은 "약한 강세(mild bullish)" 영역에 해당한다. MCS > 70이면 매수 패턴 +5%, MCS < 30이면 매도 패턴 +5%로 조정하며, 30-70 구간은 중립이다. `appWorker.js`에서는 0-1 vs 0-100 스케일 가드가 적용되어 `macro_latest.json`의 mcs(0-1)와 `macro_composite.json`의 mcsV2(0-100)가 자동 구분된다.

8개 구성요소의 가중치는 지표의 선행성과 포괄성을 반영한다. CLI에 최대 가중치(0.20)를 부여하는 이유는 CLI가 고용, 생산, 소비, 금융 등 10개 하위지표를 이미 종합한 가장 포괄적인 선행지표이기 때문이다. ESI와 IPI(각 0.15)는 심리와 실물을 각각 대리한다. 나머지 5개 지표(각 0.10)는 보조적 확인(confirmation) 역할을 한다.

**핵심 공식**

$$\text{MCS}_{v2} = \sum_{j=1}^{8} w_j \cdot z_j \times 100, \quad \sum_{j=1}^{8} w_j = 1$$

$$\text{가중치}: \; w_{\text{CLI}}=0.20, \; w_{\text{ESI}}=0.15, \; w_{\text{IPI}}=0.15, \; w_{\text{소비자}}=0.10, \; w_{\text{PMI}}=0.10, \; w_{\text{수출}}=0.10, \; w_{\text{실업}^{-1}}=0.10, \; w_{\text{금리차}}=0.10$$

$$z_j = \text{clip}\!\left(\frac{x_j - x_{j,\min}}{x_{j,\max} - x_{j,\min}},\; 0,\; 1\right) \quad (\text{각 지표의 [0,1] 정규화})$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $w_j$ | 제$j$ 구성요소 가중치 | 무차원 | 설계값, [C][L:GCV] |
| $z_j$ | 정규화된 구성요소 값 | [0,1] | 각 API 소스 |
| CLI | OECD 경기선행지수 | 지수 | OECD Stats |
| ESI | 경제심리지수 | 지수 | KOSIS |
| IPI | 산업생산지수 | 지수 | 통계청 |
| $\textcolor{stageOneMarker}{\text{MCS}_{v2}}$ | MCS v2 복합점수 | 0-100 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 $\text{MCS}_{v2} = 65.7$이 수집되었다. 8개 구성요소 중 CLI(0.904), 수출(0.839), 실업률 역수(0.775)가 강세, PMI(0.300)가 약세이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| MCS v2 $\to$ 패턴 신뢰도 조정 | `_applyPhase8ConfidenceToPatterns()` L569 | MCS>70: 매수 +5%, MCS<30: 매도 +5% |
| MCS 임계값 | `MCS_THRESHOLDS` (appState.js L405) | strong_bull:70, bull:55, bear:45, strong_bear:30 |
| 0-1/0-100 스케일 가드 | `if (mcs > 0 && mcs <= 1.0) mcs *= 100` | macro_latest vs macro_composite 호환 |

---

\newpage

### 2.5.7 뉴케인지언 필립스 곡선 (New Keynesian Phillips Curve)

**개요**

필립스 곡선의 지적 계보는 Phillips(1958)의 임금-실업 역관계에서 시작하여, Friedman(1968)과 Phelps(1967)의 기대 부가 필립스 곡선(expectations-augmented Phillips curve)을 거쳐, Lucas(1972)의 합리적 기대 혁명과 Calvo(1983)의 시차적 가격 설정(staggered pricing)으로 발전했다. 현대 거시경제학의 표준은 Gali & Gertler(1999)의 혼합형 NKPC(Hybrid New Keynesian Phillips Curve)이며, 이는 전방 기대($E_t[\pi_{t+1}]$)와 후방 관성($\pi_{t-1}$)을 모두 포함한다.

NKPC의 핵심 파라미터인 Calvo 가격경직도 $\theta$는 매 기간 가격을 조정하지 못하는 기업 비율을 나타낸다. 한국의 $\theta \approx 0.75$는 평균 4분기(1년)에 한 번 가격을 조정함을 의미하며, 미국($\theta \approx 0.66$, 평균 3분기)보다 가격경직성이 강하다. 이는 통화정책 변화가 한국에서 물가보다 실물(산출량, 고용)에 더 크게 전달됨을 시사하며, 결과적으로 BOK 금리 변경이 주가에 미치는 영향이 구조적으로 크다.

주식시장 관점에서 NKPC의 기울기 $\kappa$가 작을수록(가격이 경직적일수록) 수요 충격의 산출량 효과가 크고 물가 효과가 작다. 한국의 $\kappa \approx 0.05$는 수요 확장이 인플레이션보다 실질 성장으로 이어질 가능성이 높음을 의미하며, 이는 확장적 통화정책이 주식시장에 상대적으로 우호적인 환경을 제공한다.

**핵심 공식**

$$\pi_t = \gamma_f \cdot \beta \cdot E_t[\pi_{t+1}] + \gamma_b \cdot \pi_{t-1} + \kappa \cdot \tilde{y}_t$$

$$\kappa = \frac{(1-\theta)(1-\beta\theta)}{\theta} \cdot (\sigma + \phi)$$

$$\text{Calvo}: \; \theta = 0.75 \;\; (\text{한국}), \quad \beta = 0.99, \quad \kappa \approx 0.05$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\theta$ | Calvo 가격경직도 | 무차원 | Kim & Park(2016): 0.75 |
| $\beta$ | 할인인자 | 무차원 | 표준: 0.99 |
| $\kappa$ | NKPC 기울기 | 무차원 | Gali & Gertler(1999): 0.05 |
| $\sigma$ | 기간간 대체탄력성의 역수 | 무차원 | 표준 RBC 파라미터 |
| $\phi$ | 노동공급 탄력성의 역수 | 무차원 | 표준 RBC 파라미터 |
| $\textcolor{stageOneMarker}{\pi_{\text{CPI}}}$ | CPI 전년동월비 | %YoY | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 $\pi_{\text{CPI}} = 2.16\%$이 수집되었다. BOK 인플레이션 목표(2.0%)에 근접하여 물가 안정 국면이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| $\theta$ 높음 $\to$ 통화정책 실물 전달 강화 | BOK 이벤트 conf_adj = 1.08 (재정 1.03 대비 강) | IS-LM 비교정학과 결합하여 이벤트 비대칭 설명 |
| $\kappa$ 작음 $\to$ 수요충격이 Y에 집중 | MCS v2 확장기 판별 시 주가 반응 크기 근거 | 확장적 정책 $\to$ 성장주 부양 이론적 기반 |
| Hybrid NKPC 관성 ($\gamma_b$) | 현재 미구현 -- 이론적 참조만 | 인플레이션 지속성 판단의 학술 근거 |

---

\newpage

### 2.5.8 재정승수와 구축효과 (Fiscal Multiplier and Crowding-Out Effect)

**개요**

재정승수(fiscal multiplier)는 정부지출 1단위 증가가 GDP를 얼마나 증가시키는지를 측정한다. 단순 케인즈 승수 $k_G = 1/(1-c_1(1-t))$는 폐쇄경제 + LM 수평(금리 고정) 가정 하에서 도출되며, 한국의 경우 약 1.70이다. 그러나 개방경제로 확장하면 한계수입성향 $m = 0.45$에 의한 수입 누출이 극도로 커서, 개방경제 승수 $k_{G,\text{open}} = 1/(1 - c_1(1-t) + m) \approx 0.96$으로 1 미만이 된다. 정부지출 1원이 GDP를 1원조차 증가시키지 못하는 것이다.

IS-LM 승수(구축효과 포함)는 $k_{G,\text{ISLM}} = h/D \approx 0.86$으로 더 낮아진다. 정부지출 증가 $\to$ IS 우측이동 $\to$ $r$ 상승 $\to$ 민간투자 감소(구축효과)가 추가되기 때문이다. 국제 비교에서 한국(0.86-1.04)은 미국(1.50-2.00)이나 일본(1.10-1.50)보다 현저히 낮은데, 이는 한국의 높은 수입 의존도($m=0.45$ vs 미국 $m=0.15$)에 기인한다.

리카도 대등정리(Ricardian Equivalence, Barro 1974)는 합리적 기대 하에서 국채 발행 재원의 재정확대가 GDP에 무영향이라는 강한 결론이다. 소비자가 미래 증세를 예상하여 저축을 늘리면 현재 소비가 변하지 않는다. 완전한 리카도 대등은 비현실적이나(유동성 제약, 유한 수명, 비합리적 기대), 재정정책의 한계를 이론적으로 설명하는 데 유용하다. 한국에서는 가계부채/GDP 비율이 약 105%로 세계 상위권이어서, 추가 재정확대의 소비 자극 효과가 구조적으로 제한된다.

**핵심 공식**

$$k_G = \frac{1}{1 - c_1(1-t)}, \quad k_{G,\text{open}} = \frac{1}{1 - c_1(1-t) + m}, \quad k_{G,\text{ISLM}} = \frac{h}{h \cdot s + b \cdot k}$$

$$k_T = \frac{-c_1}{1 - c_1(1-t) + m} \approx -0.53 \quad (\lvert k_T \rvert < k_G: \text{조세 승수 < 지출 승수})$$

$$k_{BB} = k_G + k_T \approx 0.43 \quad (\text{균형재정 승수})$$

$$\text{ZLB}: \; h \to \infty \implies k_{G,\text{ZLB}} = \frac{1}{s} \approx 0.96 \;\;(\text{구축효과 소멸, 한국})$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $k_G$ | 정부지출 승수 | 무차원 | Blanchard & Perotti(2002) |
| $k_T$ | 조세 승수 | 무차원 | 도출값 |
| $s$ | 한계 누출률 ($1-c_1(1-t)+m$) | 무차원 | 도출값: 1.0375 |
| $k_{BB}$ | 균형재정 승수 | 무차원 | Haavelmo(1945) 정리 |
| ZLB | 제로금리 하한 | %p | $r \leq 0.75\%$ (한국) |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| $k_{G,\text{open}} < 1$ $\to$ 재정정책 미약 | `conf_fiscal = 1.03` (Doc30 \S1.4) | 추경 뉴스에 제한적 conf 조정 |
| ZLB 승수 증폭 ($k_{\text{zlb\_mult}} = 1.50$) | 상수 #97: `r_zlb = 0.75%` | ZLB 환경 시 추경 conf 상향 가능 |
| $\lvert k_T \rvert < k_G$ | 현재 미구현 -- 이론적 참조 | 감세 뉴스의 conf < 추경 conf 근거 |

---

\newpage

### 2.5.9 환율모형: PPP, IRP, 도른부시 오버슈팅 (Exchange Rate Models: PPP, IRP, Dornbusch Overshooting)

**개요**

환율 결정이론은 장기 균형(PPP), 차익거래 조건(IRP), 동태적 조정(도른부시 오버슈팅)의 세 층위로 구성된다. 절대적 구매력평가(Absolute PPP, Cassel 1918)는 환율이 양국 물가수준의 비율로 결정된다고 주장하나, 비교역재, 운송비용, 관세 등으로 인해 단기에서는 대규모 괴리가 발생한다. 상대적 PPP는 환율 변화율이 인플레이션 차이와 일치한다는 약한 형태로, 장기 추세 분석에만 유효하다.

금리평가(Interest Rate Parity)는 커버드(CIP)와 언커버드(UIP)로 구분된다. CIP는 선물환 프리미엄이 내외금리차와 일치하는 차익거래 조건으로 거의 항상 성립한다. UIP는 기대환율변동률이 금리차와 일치한다는 가설이나, 실증적으로 "forward premium puzzle"(Fama 1984)이 존재하여 고금리 통화가 예측과 반대로 절상되는 경향이 있다. 현재 한미 금리차 $-1.14\%$p 하에서 UIP는 원화 절상을 예측하나, 실제로는 지정학 리스크와 무역 불확실성으로 원화 약세가 지속되고 있다.

도른부시(Dornbusch 1976)의 오버슈팅 모형은 통화정책 충격 시 환율이 장기 균형을 초과하여 반응(overshooting)한 후 점진적으로 수렴하는 동태를 설명한다. 이는 재화시장의 가격경직성(점진 조정)과 금융시장의 가격신축성(즉시 조정)의 속도 차이에 기인한다. 이 모형은 BOK 기준금리 변경 직후 USD/KRW의 과잉반응과 후속 mean reversion을 이해하는 이론적 기반을 제공한다.

**핵심 공식**

$$\text{Absolute PPP}: \; e = \frac{P}{P^*}$$

$$\text{CIP}: \; \frac{F}{S} = \frac{1 + i_d}{1 + i_f}$$

$$\text{UIP}: \; E[\Delta e] = i_d - i_f$$

$$\text{Dornbusch}: \; e(t) = \bar{e} + (e_0 - \bar{e}) \cdot \exp(-\theta t), \quad \theta = \frac{\delta(\sigma + \phi)}{\sigma + \phi + \delta\kappa}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $e$ | 명목환율 (원/달러) | 원/달러 | 시장가 |
| $\bar{e}$ | 장기 균형환율 | 원/달러 | PPP 추정 |
| $F$ / $S$ | 선물환율 / 현물환율 | 원/달러 | 외환시장 |
| $\theta$ | 환율 수렴 속도 | 1/기간 | Dornbusch(1976) |

> **참고:** 이 시트는 이론 전용(theory-only)이다. 런타임에서 환율 모형을 직접 구현하지 않으며, USD/KRW 수출채널이 간접 프록시로 작동한다. 환율은 `macro_latest.json`의 `usdkrw` 필드로 수집되어 먼델-플레밍(2.5.3절)의 입력으로 사용된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| UIP/금리차 $\to$ 환율 방향 | `rate_diff` in `macro_latest.json` | 자본유출입 압력 프록시 |
| 오버슈팅 $\to$ 환율 mean reversion | 현재 미구현 | BOK 이벤트 후 수출주 반전 패턴 해석 |
| PPP 장기 균형 | 현재 미구현 | 구조적 원화 가치 평가 참조 |

---

\newpage

### 2.5.10 금리 기간구조와 수익률 곡선 (Term Structure and Yield Curve)

**개요**

금리 기간구조(term structure of interest rates)는 만기에 따른 채권수익률의 함수이며, 수익률 곡선(yield curve)으로 시각화된다. 수익률 곡선의 형태는 경기 전망의 가장 강력한 선행지표 중 하나로, Estrella & Mishkin(1998)에 따르면 미국에서 수익률 곡선 역전은 1960-2020년 8회 중 8회 경기침체를 사전 예측했다. 한국 국고채 10년-3년 스프레드 기준으로는 5회 중 4회 경기침체를 선행했으며, 선행 시차는 미국(12-18개월)보다 짧은 6-12개월이다.

기대가설(Expectations Hypothesis)은 장기금리가 미래 단기금리의 기대값의 평균이라는 이론이다. 이에 따르면 수익률 곡선 역전은 시장이 미래 금리 인하(경기 악화)를 예상함을 의미한다. Hicks(1939)의 유동성 프리미엄 이론은 투자자가 장기 채권에 대해 추가 보상(유동성 프리미엄)을 요구하므로, 정상적 수익률 곡선은 우상향한다고 설명한다. 역전은 이 프리미엄마저 상쇄할 만큼 강한 금리 하락 기대가 존재함을 시사한다.

Nelson-Siegel-Svensson(NSS) 모형은 수익률 곡선을 Level($\beta_1$, 장기 수준), Slope($\beta_2$, 기울기), Curvature($\beta_3$, 곡률)의 3요인으로 분해한다. Level은 장기 기대 인플레이션 + 실질 균형금리를, Slope는 통화정책 스탠스를, Curvature는 중기 경기 기대와 정책 불확실성을 반영한다. 현재 한국 국고채 10년-3년 스프레드는 0.30%p(=30bp)로 양(+)이나 평탄화(flattening) 추세에 있어 경기 둔화 가능성을 시사한다.

**핵심 공식**

$$y(\tau) = \beta_1 + \beta_2 \left[\frac{1-e^{-\tau/\lambda}}{\tau/\lambda}\right] + \beta_3 \left[\frac{1-e^{-\tau/\lambda}}{\tau/\lambda} - e^{-\tau/\lambda}\right]$$

$$\text{Spread} = y_{10Y} - y_{3Y}, \quad \text{역전}: \text{Spread} < 0 \implies \text{경기침체 선행 6-12개월}$$

$$\text{기대가설}: \; (1+i_{2Y})^2 = (1+i_{1Y})(1+E[i_{1Y,t+1}])$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\beta_1$ | Level (장기 수준) | %p | NSS 추정: 2.5-4.5%(한국) |
| $\beta_2$ | Slope (기울기) | %p | $\beta_2 > 0$: 역전 |
| $\beta_3$ | Curvature (곡률) | %p | 중기 경기 기대 |
| $\lambda$ | 감쇠 매개변수 | 년 | NSS 모형 파라미터 |
| $\textcolor{stageOneMarker}{y_{10Y}-y_{3Y}}$ | 국고채 10Y-3Y 스프레드 | %p | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{YC\_phase}}$ | 수익률곡선 국면 | 범주형 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 $\text{term\_spread} = 0.35\%$p, $\text{yieldCurvePhase} = \text{flattening}$이 수집되었다. 역전은 아니나 평탄화 추세이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 수익률곡선 4-체제 분류 | `_applyMacroConfidenceToPatterns()` L1158-1190 | Bull-Steep/Flat, Bear-Steep/Flat 체제별 conf 조정 |
| 역전 $\to$ 최강 매수 억제 | `slope < 0: adj *= 0.88` (매수), `1.12` (매도) | 경기침체 선행 12-18개월 |
| Taylor gap $\to$ Bull/Bear 판별 | `taylorGap < 0: Bull` (dovish) | 수익률곡선 방향 프록시 |

---

\newpage

### 2.5.11 HMM 레짐의 거시경제적 해석 (Macroeconomic Interpretation of HMM Regimes)

**개요**

은닉 마르코프 모형(Hidden Markov Model, Hamilton 1989)은 관측 불가능한 "레짐"(regime)이 관측 가능한 수익률의 통계적 특성을 결정한다고 가정한다. 경제학적으로 레짐은 거시경제 상태(확장/수축, 저변동/고변동)에 대응하며, 전이행렬(transition matrix)이 레짐 간 전환 확률을 기술한다. Hamilton(1989)은 미국 전후 데이터에서 2개 변동성 레짐(강세: 월 수익률 +0.9%, 변동성 4.5% / 약세: -0.3%, 7.2%)을 식별했으며, 평균 레짐 지속기간은 8-10개월이었다.

CheeseStock의 HMM 레짐 분류는 `compute_hmm_regimes.py`에서 종목별 투자자 수급 데이터에 Baum-Welch EM 알고리즘을 적용하여 3-state(bull, bear, sideways) 레짐을 추정한다. 추정 결과는 `flow_signals.json`의 `hmmRegimeLabel` 필드에 저장되며, `REGIME_CONFIDENCE_MULT`를 통해 패턴 신뢰도에 승수로 적용된다. 강세(bull) 레짐에서 매수 패턴은 $\times 1.06$, 매도 패턴은 $\times 0.92$로 조정되고, 약세(bear) 레짐에서는 역방향이다.

거시경제적 해석에서 HMM 레짐은 Doc 29 \S6.1의 거시 레짐 분류(2$\times$2: Expansion/Contraction $\times$ Low/High Volatility)와 연동된다. Goldilocks(확장+저변동)에서 추세추종 패턴이, Quiet Bear(수축+저변동)에서 평균회귀 패턴이, Crisis(수축+고변동)에서 전반적 신호 축소가 적절하다. 데이터 품질 가드(`flowDataCount > 0`)가 없으면 투자자 데이터가 비어있을 때 모든 종목에 "bear"가 일괄 적용되는 위험이 있어, 품질 게이트가 필수적이다.

**핵심 공식**

$$P(R_t \mid S_t = s) = \mathcal{N}(\mu_s, \sigma_s^2), \quad S_t \in \{\text{bull, bear, sideways}\}$$

$$\text{전이행렬}: \; \mathbf{P} = \begin{pmatrix} p_{BB} & 1-p_{BB} \\ 1-p_{RB} & p_{RB} \end{pmatrix}$$

$$\text{Baum-Welch E-step}: \; \gamma_t(s) = P(S_t = s \mid R_{1:T}, \theta)$$

$$\text{Viterbi}: \; \delta_t(j) = \max_i [\delta_{t-1}(i) \cdot a_{ij}] \cdot b_j(o_t)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $S_t$ | 시점 $t$의 은닉 레짐 | 범주형 | Hamilton(1989) |
| $\mu_s$, $\sigma_s$ | 레짐 $s$의 평균/표준편차 | % | Baum-Welch 추정 |
| $a_{ij}$ | 레짐 $i \to j$ 전이확률 | 무차원 | 전이행렬 |
| $\gamma_t(s)$ | 사후 레짐 확률 | [0,1] | EM E-step |
| $\textcolor{stageOneMarker}{\text{hmmRegimeLabel}}$ | HMM 레짐 라벨 | bull/bear/sideways | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 `hmmRegimeLabel`은 종목별로 `flow_signals.json`에 저장된다. 시장 전체 레짐은 `_flowSignals.hmmRegimeLabel`로 접근한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 3-state 레짐 승수 | `REGIME_CONFIDENCE_MULT` (appState.js L394) | bull: buy$\times$1.06/sell$\times$0.92, bear: 역방향 |
| 데이터 품질 가드 | `flowDataCount > 0` 체크 (appWorker.js L593) | 빈 데이터 시 레짐 승수 무력화 |
| 레짐-변동성 2$\times$2 매트릭스 | Doc29 \S6.1 + VKOSPI 20/25 임계 | Goldilocks/Hot/Quiet Bear/Crisis 분류 |

---

\newpage

### 2.5.12 수요-공급-탄력성 (Demand-Supply-Elasticity)

**개요**

Marshall (1890)의 부분균형 분석은 증권시장의 호가창(order book)에 직접 대응된다. 매수 호가 누적이 수요곡선 $D(p)$를, 매도 호가 누적이 공급곡선 $S(p)$를 형성하며, 시장 청산가격 $p^*$는 양자의 교차점에서 결정된다. KRX는 시가/종가 결정에 Walras (1874) 단일가 매매(call auction)를, 장중에는 Smith (1962) 연속 이중경매(continuous double auction)를 사용하는 이원 체제를 운영한다. 단일가 매매는 30분(시가) 또는 10분(종가)의 호가 축적을 통해 정보 집적 효율이 높고 종가 조작(window dressing) 내성이 강하다 (Madhavan 1992).

거래량-가격 탄력성(Volume-Price Elasticity, VPE)은 가격 1% 변동에 대한 거래량의 반응 민감도를 측정한다. KOSPI 대형주의 VPE는 2--5(중탄력, 기관 계획 매매), KOSDAQ 소형주는 8--20+(초고탄력, 개인 감정 반응)으로 시장 세그먼트 간 극단적 차이를 보인다. VPE와 Amihud (2002) ILLIQ는 수학적 역관계에 있으며, 이 연결은 수요-공급 탄력성이라는 미시경제학적 개념이 시장미시구조의 유동성 측정으로 변환되는 이론적 다리(theoretical bridge)를 구성한다.

스프레드(bid-ask spread)는 Stoll (1978)의 재고위험 보상($s_{\text{inventory}}$), Glosten-Milgrom (1985)의 역선택 비용($s_{\text{adverse}}$), Roll (1984)의 주문처리 비용($s_{\text{processing}}$)으로 3요소 분해된다. KRX에는 지정 시장조성자가 사실상 부재하여, KOSDAQ 소형주에서 $s_{\text{adverse}}$가 전체 스프레드의 60--80%를 차지한다. 이는 가격제한폭($\pm$30%) 하에서 사중손실(deadweight loss)을 유발하며, Du, Liu & Rhee (2009)가 입증한 자석 효과(magnet effect)가 이를 악화시킨다.

**핵심 공식**

$$p^* = \underset{p}{\arg\max}\;\min\bigl(D(p),\;S(p)\bigr)$$

$$\varepsilon_{VP} = \frac{\Delta V / V}{|\Delta p| / p}, \qquad \text{ILLIQ} \approx \frac{k}{P \cdot |\varepsilon_{VP}|}$$

$$s = s_{\text{inventory}} + s_{\text{adverse}} + s_{\text{order\_processing}}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $p^*$ | 시장 청산가격 (Walrasian equilibrium price) | KRW | 본 Stage |
| $D(p),\,S(p)$ | 누적 매수/매도 호가 곡선 | 주 | 본 Stage |
| $\varepsilon_{VP}$ | 거래량-가격 탄력성 (VPE) | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{OHLCV}}$ | 일봉 시가-고가-저가-종가-거래량 | KRW, 주 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{ADV}}$ | 평균 일간 거래대금 (Average Daily Value) | 억원 | **Stage 1** |
| $s_{\text{adverse}}$ | 역선택 비용 (Glosten-Milgrom 1985) | % | 본 Stage |
| $k$ | ILLIQ-VPE 연결 정규화 상수 | -- | 본 Stage |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{OHLCV}}$로부터 일간 수익률 $|r_t|$와 거래대금 $\text{DVOL}_t$를 산출하여 ILLIQ을 계산한다. $\textcolor{stageOneMarker}{\text{ADV}}$는 60일 평균 거래대금으로, 유동성 세그먼트 분류의 기준이 된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Amihud ILLIQ = $(1/T)\sum|r_t|/\text{DVOL}_t$ | `calcAmihudILLIQ()` indicators.js:1430 | ILLIQ dual-path: LOG\_LOW=$-3$, LOG\_HIGH=$-1$로 유동성 세그먼트 분류 후 `confDiscount` 산출 |
| VPE-ILLIQ 역관계 | `_getAdaptiveSlippage()` backtester.js:27 | 세그먼트별 슬리피지 차등: kospi\_large 0.04%, kosdaq\_small 0.35% |
| 스프레드 3요소 분해 | `KRX_SLIPPAGE=0.10%` backtester.js | KOSPI 중형 기준 고정값; WS 모드 확장 시 실시간 $s_{\text{adverse}}$ 추정 가능 |
| 단일가 매매 (Walras) vs 접속매매 (Smith DA) | `generate_intraday.py` 09:00 시가 = 일봉 open | 시가/종가의 정보 집적 효율이 장중 가격보다 높음 |

\newpage

### 2.5.13 HHI 산업 집중도와 시장구조 (HHI & Market Structure)

**개요**

Herfindahl (1950)이 도입하고 Hirschman (1964)이 독립적으로 제안한 HHI(Herfindahl-Hirschman Index)는 산업 내 기업 시장점유율의 제곱합으로 정의되며, 산업 집중도의 표준 측정치이다. HHI는 등가기업수(Numbers Equivalent) $NE = 1/\text{HHI}$로 직관적 해석이 가능하다. 미국 DOJ 기준에서 HHI < 0.15는 비집중, 0.15--0.25는 중간 집중, $\geq$0.25는 고집중으로 분류한다. KRX 주요 산업의 HHI 추정치는 반도체(메모리) $\approx$0.45(삼성/하이닉스 복점), 이동통신 $\approx$0.33(3사 과점), 자동차 $\approx$0.40(현대차/기아 복점), 바이오/제약 $\approx$0.08(다수 경쟁)으로 산업별 편차가 크다.

Lerner (1934)의 독점력 지수 $L = (P-MC)/P$와 HHI의 연결은 Cowling-Waterson (1976)에 의해 $L = \text{HHI}/|\varepsilon_d|$로 정식화되었다. 이 관계가 "HHI $\to$ 이익안정성 $\to$ 패턴 신뢰도"의 이론적 기초를 구성한다. 가격 설정력이 강한 산업(높은 HHI)의 기업은 원가 변동을 가격에 전가할 수 있어 매출 변동성이 낮고, 기술적 패턴의 mean-reversion 신뢰도가 높다. 반대로 경쟁적 산업(낮은 HHI)에서는 추세추종(momentum) 패턴이 상대적으로 유효하다.

CheeseStock에서 HHI는 학술 표준인 매출액 기준이 아닌, 데이터 가용성과 실시간성을 위해 **시가총액 기준**으로 산출된다. 이는 바이오 산업에서 시가총액이 매출 대비 과대평가되어 HHI가 +0.05--0.10 과대추정되는 편향을 발생시킨다 (core\_data/33 참조). 또한 HHI 부스트에 이익변동성 감쇠를 적용하기 위한 `eps_stability` 매개변수가 설계되었으나, `ni_history`가 `_financialCache`에 적재되지 않아 항상 fallback 1.0으로 작동하는 사실상의 dead code이다 (P0-3, MIC-02).

**핵심 공식**

$$\text{HHI} = \sum_{i=1}^{N} s_i^2, \qquad NE = \frac{1}{\text{HHI}}$$

$$L = \frac{\text{HHI}}{|\varepsilon_d|} \qquad \text{(Cowling-Waterson 1976)}$$

$$\text{conf\_adj} = \text{conf\_base} \times \bigl(1 + 0.10 \times \text{HHI} \times \text{eps\_stability}\bigr)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $s_i$ | 기업 $i$의 시장점유율 | 무차원 | 본 Stage |
| $NE$ | 등가기업수 (Numbers Equivalent) | 개 | 본 Stage |
| $L$ | Lerner 독점력 지수 | 무차원 | 본 Stage |
| $\varepsilon_d$ | 시장 수요의 가격탄력성 | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{marketCap}}$ | 시가총액 (ALL\_STOCKS) | 억원 | **Stage 1** |
| $\text{eps\_stability}$ | 이익변동성 감쇠 계수 $= 1/(1+\sigma_{\text{NI\_growth}}/100)$ | 무차원 | 본 Stage |
| 0.10 | HHI\_MEAN\_REV\_COEFF (\#119) | 무차원 | Doc 33 SS6.2 |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{marketCap}}$은 `ALL_STOCKS` 배열의 `marketCap` 필드에서 업종별로 추출되어 $s_i = \text{marketCap}_i / \sum \text{marketCap}$로 변환된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| $\text{HHI} = \sum s_i^2$ (시가총액 기준) | `_updateMicroContext()` appWorker.js:1544--1577 | 동일 `industry` 종목의 `marketCap` 제곱합으로 실시간 HHI 산출 |
| HHI Mean-Reversion Boost | `_applyMicroConfidenceToPatterns()` appWorker.js:1601 | `MEAN_REV_TYPES` 패턴(doubleBottom, headAndShoulders 등)에 $1 + 0.10 \times \text{HHI} \times \text{eps\_stability}$ 승수 적용 |
| $\text{eps\_stability}$ 감쇠 | appWorker.js:1553--1570 | 현재 `eps_stability`는 `ni_history` 미적재로 fallback 1.0 작동 중 (MIC-02). HHI boost가 이익변동성 감쇠 없이 적용됨 |
| Lerner-HHI 연결 | 설계 사양 (미구현) | 향후 섹터별 마크업 안정성 프록시로 활용 가능 |

\newpage

### 2.5.14 정보비대칭과 탐색비용 (Information Asymmetry & Search Costs)

**개요**

전통 미시경제학의 완전 정보(perfect information) 가정이 성립하면 가격은 즉시 내재가치를 반영하고 기술적 분석의 존재 이유가 사라진다. Grossman & Stiglitz (1980)는 이 역설을 정식화하였다: 가격이 모든 정보를 완벽히 반영한다면 정보 수집 비용을 지불할 유인이 없고, 아무도 정보를 수집하지 않으므로 가격은 정보를 반영할 수 없다. 균형에서 정보 투자자의 기대초과수익은 정보 수집 비용과 정확히 일치하며, 이 잔존 비효율이 기술적 패턴의 미시적 기초(microfoundation)를 구성한다.

Stigler (1961)는 경제학에서 최초로 정보를 경제재(economic good)로 정식화하고, 투자자의 종목 탐색 과정을 최적 탐색 문제로 모형화하였다. 탐색의 한계편익(더 나은 투자 기회 발견 확률)이 한계비용(시간, 인지적 노력)과 일치하는 점에서 탐색이 종료되므로, 투자자는 불완전한 정보 상태에서 의사결정한다. 한국 시장에서 HTS/MTS 보급으로 물리적 탐색 비용은 극소화되었으나, Peng & Xiong (2006)의 주의 예산 제약($\sum a_i \leq A_{\text{total}}$)이 새로운 바인딩 제약(binding constraint)으로 부상하였다. KOSPI 200 구성종목은 평균 7--12명 애널리스트 커버리지($a_i$ 높음)를 보이는 반면, KOSDAQ 소형주(시총 500억 미만)는 0--1명($a_i \approx 0$, corner solution)으로 정보 반영 지연이 3--5배 지속된다.

Easley, Kiefer & O'Hara (1996)의 PIN(Probability of Informed Trading)은 정보 비대칭의 직접 측정치이다. KRX에서 KOSPI 대형 PIN $\approx$ 0.10--0.15인 반면 KOSDAQ 소형 PIN $\approx$ 0.30--0.50으로, 잡음 거래자 비율이 높을수록 정보 거래자의 위장이 용이해져 PIN이 역설적으로 상승한다.

**핵심 공식**

$$\text{PIN} = \frac{\alpha \mu}{\alpha \mu + \varepsilon_b + \varepsilon_s}$$

$$E[R_{\text{informed}}] - E[R_{\text{uninformed}}] = \frac{c_{\text{info}}}{\rho} \qquad \text{(Grossman-Stiglitz 균형)}$$

$$\sum_{i=1}^{N} a_i \leq A_{\text{total}} \qquad \text{(Peng-Xiong 주의 예산 제약)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\alpha$ | 정보 이벤트 발생 확률 | 무차원 | 본 Stage |
| $\mu$ | 정보 거래자 도착률 | 건/일 | 본 Stage |
| $\varepsilon_b,\,\varepsilon_s$ | 비정보 매수/매도 도착률 | 건/일 | 본 Stage |
| $c_{\text{info}}$ | 정보 수집 비용 | KRW | 본 Stage |
| $\rho$ | 위험회피 계수 (risk aversion) | 무차원 | 본 Stage |
| $a_i$ | 자산 $i$에 배분된 주의 용량 | bits/기간 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{ADV}}$ | 평균 일간 거래대금 (주의 프록시) | 억원 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{외국인 보유비중}}$ | 글로벌 분석가 커버리지 프록시 | % | **Stage 1** |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{ADV}}$는 탐색 비용의 역함수로 기능한다. 유동성이 높으면 정보 접근이 용이하여 탐색 비용이 낮다. $\textcolor{stageOneMarker}{\text{외국인 보유비중}}$은 글로벌 분석가 커버리지의 프록시로, 높을수록 주의 배분($a_i$)이 풍부함을 시사한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| ADV 수준별 유동성 등급 (Katz-Shapiro 1985 네트워크 외부성) | `calcADVLevel()` signalEngine.js:3014 | 4등급 분류: 0=$<$1억, 1=$<$10억, 2=$<$100억, 3=$\geq$100억. 등급별 패턴 신뢰도 승수(`ADV_MULTIPLIERS`) 적용 |
| 밸류에이션 지지/저항 (Rothschild-Stiglitz 1976 스크리닝 균형) | `detectValuationSR()` patterns.js:3561 | BPS/EPS 배수 임계값이 투자자 스크리닝의 focal point로 기능하여 S/R 수준 형성 |
| Grossman-Stiglitz 잔존 비효율 | AMH 감쇠 메커니즘 (signalEngine.js) | 패턴 알파가 $c_{\text{info}}$ 수준으로 수렴하는 과정을 모형화 |
| PIN 정보비대칭 보정 | $\delta_{\text{info}} = 0.15$ (\#105, Doc 31 SS3.4) | 내부자 매매 방향과 패턴 방향 정렬 시 $\text{conf} \times 1.15$, 역행 시 $\times 0.85$ |

\newpage

### 2.5.15 거시경제학 도출 요약 (Macroeconomics Derivation Summary)

**개요**

본 절은 2.5.1-2.5.11의 11개 시트에서 도출된 거시경제학적 분석 체계를 요약하고, 후속 장(제3장)에서의 신호 구현 경로를 명시한다. 거시경제학 시트의 핵심 기여는 세 가지이다. 첫째, IS-LM/AD-AS/먼델-플레밍 프레임워크를 통해 정책 충격이 주식시장에 전달되는 이론적 경로를 정형화했다. 둘째, 테일러 준칙, 필립스 곡선, 재정승수 등의 정량적 도구를 한국 파라미터로 교정(calibrate)하여, BOK 이벤트와 추경 발표의 비대칭적 시장 영향을 설명했다. 셋째, Stovall 섹터 회전, MCS v2, HMM 레짐 분류를 결합하여 거시환경 $\to$ 섹터 $\to$ 패턴 신뢰도의 다층 전달 체계를 구축했다.

이 체계는 제3장에서 CONF-F1a(Stovall 섹터 회전), CONF-F7(Taylor Rule Gap), CONF-F9(한미 금리차)의 세 가지 신뢰도 조정 인자로 구현된다. 각 인자는 `_applyMacroConfidenceToPatterns()` 함수 내에서 패턴별 방향(매수/매도)과 종목의 섹터 분류에 따라 차등 적용되며, 최종 신뢰도는 다층 승수의 곱으로 결정된다(compound floor = 25으로 하한 보장).

**11개 시트 종합 요약표**

| 시트 | 핵심 모형 | 주요 학술 출처 | KRX 전달 경로 | 구현 상태 |
|------|-----------|---------------|---------------|-----------|
| 2.5.1 IS-LM | Hicks(1937) IS-LM 균형 | Hicks(1937), Hansen(1953) | 비교정학 $\to$ 이벤트별 conf 차등 | `_applyMacroConfidence` |
| 2.5.2 Taylor Rule | Taylor(1993) 준칙 + gap | Taylor(1993), Rudebusch(2002) | Taylor gap $\to$ CONF-F7 | 구현 완료 |
| 2.5.3 Mundell-Fleming | IS-LM-BP 개방경제 | Mundell(1963), Fleming(1962) | 한미 금리차 $\to$ CONF-F9 | 구현 완료 |
| 2.5.4 AD-AS | 총수요-총공급 4충격 | Blanchard(2017) | 레짐별 패턴 유형 차등 | `conf_adj` 테이블 |
| 2.5.5 Stovall | 섹터 회전 4국면 | Stovall(1996) | 국면-섹터 승수 $\to$ CONF-F1a | `_STOVALL_CYCLE` |
| 2.5.6 MCS v2 | 8요소 복합점수 | 설계값 + OECD/KOSIS | MCS $\to$ Phase 8 conf | `_applyPhase8Confidence` |
| 2.5.7 NKPC | Calvo 가격경직성 | Calvo(1983), Gali-Gertler(1999) | $\theta$ $\to$ 통화정책 전달 크기 | 이론적 기반 |
| 2.5.8 재정승수 | 케인즈 승수 + 구축효과 | Blanchard-Perotti(2002), Barro(1974) | $k_G < 1$ $\to$ 재정 conf 제한 | `conf_fiscal=1.03` |
| 2.5.9 환율모형 | PPP/IRP/Dornbusch | Dornbusch(1976), Fama(1984) | USD/KRW 수출채널 간접 프록시 | 이론 전용 |
| 2.5.10 수익률곡선 | NSS + 기대가설 | Nelson-Siegel(1987), Estrella-Mishkin(1998) | 4-체제 + 역전 경보 | 구현 완료 |
| 2.5.11 HMM 레짐 | Hamilton 마르코프 전환 | Hamilton(1989), Kim-Nelson(1999) | 3-state 레짐 승수 | `REGIME_CONFIDENCE_MULT` |

**Stage 1 데이터 활용 현황**

| Stage 1 변수 | 현재값 | 소비 시트 | 구현 함수 |
|-------------|--------|-----------|-----------|
| $i_{\text{BOK}}$ (bok_rate) | 2.50% | 2.5.1, 2.5.2, 2.5.3 | `macro_latest.json` |
| CLI (korea_cli) | 101.65 | 2.5.1, 2.5.2, 2.5.5 | `cycle_phase`, `_STOVALL_CYCLE` |
| $\pi_{\text{CPI}}$ (cpi_yoy) | 2.16% | 2.5.2, 2.5.7 | `taylorDetail` |
| Taylor_gap | $-0.65\%$p | 2.5.2, 2.5.10 | CONF-F7 |
| $i_{\text{Fed}}$ (fed_rate) | 3.64% | 2.5.3 | CONF-F9 |
| $e_{\text{USD/KRW}}$ (usdkrw) | 1,514 | 2.5.3, 2.5.9 | 수출채널 프록시 |
| $y_{10Y}-y_{3Y}$ (term_spread) | 0.35%p | 2.5.10 | 4-체제 분류 |
| YC_phase | flattening | 2.5.10 | `yieldCurvePhase` |
| $\text{MCS}_{v2}$ | 65.7 | 2.5.6 | Phase 8 conf |
| hmmRegimeLabel | (종목별) | 2.5.11 | `REGIME_CONFIDENCE_MULT` |
| PMI (bsi_mfg) | 71.0 | 2.5.5, 2.5.6 | MCS 구성요소 |

> **제3장 전방 참조:** 거시경제학 분석 체계는 제3장에서 CONF-F1a(Stovall 섹터 회전, 2.5.5), CONF-F7(Taylor Rule Gap, 2.5.2), CONF-F9(한미 금리차, 2.5.3)로 구현된다. 이 세 인자는 `_applyMacroConfidenceToPatterns()` 내에서 9개 매크로 신뢰도 조정 인자(Factor 1-9)의 일부로 작동하며, 패턴별 방향과 섹터에 따라 [0.70, 1.25] 범위의 승수를 생성한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 거시 $\to$ 패턴 다층 전달 | `_applyMacroConfidenceToPatterns()` (9 factors) | Factor 1-9 순차 적용 |
| Phase 8 통합 조정 | `_applyPhase8ConfidenceToPatterns()` | MCS + HMM + 수급 + 옵션 |
| Compound floor = 25 | appWorker.js L125-126 | 다층 승수 곱의 과도한 감산 방지 |


## 2.6 금융학적 기초: 자산가격결정에서 신용위험까지[^fin-1]

금융학은 자산의 공정가치를 결정하는 이론적 체계를 제공한다.
CAPM 계보(CAPM→Zero-Beta→ICAPM→CCAPM→APT)는 기대수익률과 위험 프리미엄을 정의하여
기술적 분석의 benchmark를 설정한다. 채권/옵션/신용위험 모형은 교차시장 신호를 생성하여
패턴 신뢰도를 다차원적으로 조정한다.

\newpage

### 2.6.1 EMH & AMH (Efficient Market Hypothesis & Adaptive Markets Hypothesis)

**개요**

효율적 시장 가설(EMH)은 Fama(1970)가 체계화한 자산가격결정의 출발점이다. 약형 효율(weak-form)은 과거 가격 정보가 이미 현재 가격에 반영되어 있으므로 기술적 분석이 초과수익을 창출할 수 없다고 주장한다. 준강형 효율(semi-strong form)은 모든 공개 정보를 포함하며, 강형 효율(strong form)은 내부 정보까지 반영된 가격을 상정한다. 수학적으로 EMH는 마르팅게일(martingale) 조건으로 표현된다: 가격의 기대 변화가 요구수익률을 초과하지 않으므로, 초과수익은 예측 불가능한 충격($\varepsilon_{t+1}$)에서만 발생한다.

Lo & MacKinlay(1988)는 주간 수익률의 양의 자기상관을 발견하여 약형 효율을 부정했고, Brock, Lakonishok & LeBaron(1992)은 이동평균·지지/저항 전략의 유의미한 수익을 보고했다. 이러한 반증에 대한 이론적 대안으로 Lo(2004)는 적응적 시장 가설(AMH)을 제안했다. AMH는 시장 효율성이 고정된 상태가 아닌 진화하는 생태계로, 시장 참여자의 경쟁·적응·자연선택 과정에 따라 효율성의 정도가 시변(time-varying)한다고 본다. 기술적 분석의 수익성은 특정 시장 레짐에서 존재하다가 참여자 적응에 의해 소멸하고, 새로운 비효율이 다시 발생하는 순환 구조를 따른다.

CheeseStock은 Hurst 지수($H$)를 통해 시장의 현재 효율성 수준을 정량적으로 진단한다. $H = 0.5$는 순수 랜덤워크(EMH 일치), $H > 0.5$는 추세 지속(모멘텀 전략 유효), $H < 0.5$는 평균 회귀(반전 전략 유효)를 시사한다. 이는 AMH의 레짐 전환을 실시간으로 포착하는 실증적 도구이며, 패턴 신뢰도 가중에 활용된다.

**핵심 공식**

$$P_t = \frac{E[P_{t+1} \mid \Phi_t]}{1+r}, \qquad P_{t+1} - E[P_{t+1} \mid \Phi_t] = \varepsilon_{t+1}$$

$$\text{ACF}(k) = \frac{\text{Cov}(r_t, r_{t+k})}{\text{Var}(r_t)}, \qquad \text{EMH} \Rightarrow \text{ACF}(k) = 0 \;\;\forall k \geq 1$$

$$H = \frac{\log(R/S)}{\log(n)}, \qquad R/S = \frac{\max_{1 \leq k \leq n} X_k - \min_{1 \leq k \leq n} X_k}{S_n}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\Phi_t$ | 시점 $t$까지의 정보 집합 | — | 본 Stage |
| $\varepsilon_{t+1}$ | 마르팅게일 차분 (예측불가 충격) | KRW | 본 Stage |
| $\text{ACF}(k)$ | $k$-차 자기상관함수 | 무차원 | 본 Stage |
| $H$ | Hurst 지수 | 무차원 | 본 Stage |
| $R/S$ | 재조정 범위 통계량 | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{r_t}$ | 일별 로그수익률 | % | **Stage 1** |

> **이전 Stage 데이터:** Stage 1(OHLCV 일봉)에서 종가 시계열을 수신한다. `data/{market}/{code}.json`의 close 배열이 $r_t = \ln(P_t/P_{t-1})$ 계산의 입력이며, `calcHurst()`는 최소 120봉 이상의 데이터를 요구한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Hurst 지수 ($H$) 추정 | `calcHurst()` indicators.js:212 | 시장 레짐 진단: $H>0.55$ 추세, $H<0.45$ 회귀 |
| AMH 감쇠 계수 | `_AMH_DECAY` appState.js | 패턴 유효 기간의 레짐 적응 조정 |
| ACF 기반 시계열 검증 | `calcWLSRegression()` 잔차 진단 | 회귀 잔차의 자기상관 검정으로 모형 적합성 확인 |

\newpage

### 2.6.2 MPT (Modern Portfolio Theory)

**개요**

현대 포트폴리오 이론(MPT)은 Markowitz(1952)가 제안한 평균-분산 최적화(mean-variance optimization) 프레임워크이다. 개별 자산의 기대수익률과 위험(분산)뿐 아니라 자산 간 공분산 구조를 고려하여, 주어진 기대수익률 수준에서 포트폴리오 위험을 최소화하는 최적 가중치를 도출한다. 이 최적 포트폴리오들의 집합이 효율적 프론티어(efficient frontier)를 형성하며, 합리적 투자자는 효율적 프론티어 위의 포트폴리오만을 선택한다.

MPT의 핵심 통찰은 분산투자(diversification)가 체계적 위험(systematic risk)은 제거할 수 없지만 비체계적 위험(idiosyncratic risk)을 소멸시킨다는 것이다. KRX 전체 2,700여 종목의 포트폴리오 구성에서 완전 공분산 행렬 추정에 필요한 모수는 $N(N+3)/2 \approx 365$만 개에 달하므로, 실무에서는 Sharpe(1963) 단일지수 모형이나 팩터 모형으로 차원을 축소한다. Sharpe Ratio는 무위험 수익률 초과분 대비 위험을 측정하는 표준 성과 지표로, 효율적 프론티어 위에서 CML과의 접점(tangency portfolio)이 최대 Sharpe Ratio를 달성한다.

MPT는 "어떤 종목을 얼마나 보유할 것인가"를 결정하는 반면, 기술적 분석은 "언제 매수/매도할 것인가"를 결정한다. 양자는 상호 보완적이며, CheeseStock의 backtester는 패턴 기반 진입 시점의 위험-수익 프로파일을 MPT 프레임워크 내에서 평가한다.

**핵심 공식**

$$E[R_p] = \sum_{i=1}^{N} w_i \, E[R_i], \qquad \sigma_p^2 = \sum_{i}\sum_{j} w_i w_j \sigma_{ij}$$

$$\min_{w} \; \sigma_p^2 \quad \text{s.t.} \quad E[R_p] = R^{*}, \;\; \sum w_i = 1$$

$$\text{Sharpe Ratio} = \frac{E[R_p] - R_f}{\sigma_p}$$

$$\text{Sortino Ratio} = \frac{E[R_p] - R_f}{\sigma_{\text{downside}}}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $w_i$ | 종목 $i$의 포트폴리오 가중치 | 무차원 | 본 Stage |
| $\sigma_{ij}$ | 종목 $i,j$ 간 공분산 | $\%^2$ | 본 Stage |
| $R^{*}$ | 목표 기대수익률 | % | 본 Stage |
| $\sigma_{\text{downside}}$ | 하방 편차 (MAR 기준) | % | 본 Stage |
| $\textcolor{stageOneMarker}{R_f}$ | 무위험이자율 (KTB 3Y) | %/yr | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 `data/macro/bonds_latest.json`의 KTB 3년 금리가 $R_f$ 추정에 사용된다. 개별 종목 수익률은 OHLCV 일봉에서 산출하며, 시장 지수 수익률은 `data/market/kospi_index.json`에서 제공된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Sharpe/Sortino Ratio | `backtester.js` 위험 통계량 | 패턴별 N-day 수익 분포의 위험 조정 성과 평가 |
| 포트폴리오 분산 분해 | `calcCAPMBeta()` R-squared | 체계적 vs 비체계적 위험 비율 산출 |
| Maximum Drawdown | `backtester.js` MDD 계산 | 패턴 진입 후 최대 손실 폭 측정 |

\newpage

### 2.6.3 CAPM (Capital Asset Pricing Model)

**개요**

자본자산 가격결정 모형(CAPM)은 Sharpe(1964), Lintner(1965), Mossin(1966)이 독립적으로 도출한 균형 자산가격결정 모형이다. Markowitz MPT의 균형 함의(equilibrium implication)로서, 모든 투자자가 동질적 기대를 갖고 무위험 이자율로 자유롭게 차입/대출할 수 있을 때, 시장 포트폴리오가 효율적 프론티어 위의 접선 포트폴리오임을 보인다. 증권시장선(SML)은 개별 자산의 기대수익률이 시장 베타($\beta_i$)에 선형적으로 비례함을 나타내며, 절편은 무위험이자율($R_f$), 기울기는 시장 위험 프리미엄($E[R_m] - R_f$)이다.

Jensen's Alpha($\alpha_i$)는 CAPM이 예측하는 기대수익률 대비 실현 초과수익으로, $\alpha_i > 0$이면 위험 조정 후에도 양의 초과수익이 존재함을 의미한다. 이는 기술적 분석 전략의 성과를 시장 위험 노출을 통제한 후 평가하는 표준 도구이다. 자본시장선(CML)은 효율적 포트폴리오 공간에서 무위험자산과 시장 포트폴리오를 잇는 직선으로, Sharpe Ratio의 상한을 정의한다.

Sharpe(1963) 단일지수 모형은 CAPM의 실증적 기반으로, $R_i = \alpha_i + \beta_i R_m + \varepsilon_i$의 시장 모형(market model)에서 베타를 추정한다. KRX 실증 결과 KOSPI 대형주의 $R^2 \approx 0.40\text{-}0.65$이나, KOSDAQ 소형주는 $R^2 \approx 0.05\text{-}0.25$로 단일 시장 팩터의 설명력이 제한적이어서, 다중 팩터 모형(APT/FF)으로의 확장이 필요하다. 이 $R^2$ 분포는 패턴 분석의 부가가치가 고유 요인 지배 영역(KOSDAQ)에서 가장 높을 가능성을 시사한다.

**핵심 공식**

$$E[R_i] = R_f + \beta_i \bigl(E[R_m] - R_f\bigr) \qquad \text{(SML)}$$

$$\beta_i = \frac{\text{Cov}(R_i, R_m)}{\text{Var}(R_m)}$$

$$\alpha_i = R_i - \bigl[R_f + \beta_i(R_m - R_f)\bigr] \qquad \text{(Jensen's Alpha)}$$

$$\text{CML}: \; E[R_p] = R_f + \frac{E[R_m] - R_f}{\sigma_m} \cdot \sigma_p$$

$$R^2_i = \frac{\beta_i^2 \sigma_m^2}{\sigma_i^2} = \frac{\text{체계적 분산}}{\text{총 분산}}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\beta_i$ | 종목 $i$의 시장 베타 | 무차원 | 본 Stage |
| $\alpha_i$ | Jensen의 알파 (위험조정 초과수익) | %/일 | 본 Stage |
| $E[R_m]$ | 시장 포트폴리오 기대수익률 | % | 본 Stage |
| $\sigma_m$ | 시장 수익률 표준편차 | % | 본 Stage |
| $R^2_i$ | 결정계수 (체계적 위험 비율) | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{R_f}$ | 무위험이자율 (KTB 10Y) | %/yr | **Stage 1** |
| $\textcolor{stageOneMarker}{\beta_i}$ | CAPM 베타 (사전 계산) | 무차원 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 `compute_capm_beta.py`가 산출한 $\beta_i$, $\alpha_i$, $R^2$이 `data/backtest/capm_beta.json`에 저장된다. `bonds_latest.json`의 KTB 10Y 금리가 $R_f$로 사용되며, Scholes-Williams(1977) 보정이 thin trading에 대해 적용된다. 실증 결과(2,628 종목): KOSPI $\bar{\beta}=0.75$, KOSDAQ $\bar{\beta}=0.83$.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| CAPM $\beta$ 추정 (OLS/Scholes-Williams) | `calcCAPMBeta()` indicators.js:391 | 종목 위험 분류: 방어적($\beta<0.8$) vs 공격적($\beta>1.2$) |
| Jensen's Alpha | `compute_capm_beta.py` → `capm_beta.json` | 패턴-신호 alpha의 시장 위험 통제 후 평가 |
| $R^2$ 기반 패턴 부가가치 | `financials.js` 베타 표시 | 고유 요인 지배 종목에서 패턴 신뢰도 가중 |

\newpage

### 2.6.4 Zero-Beta CAPM (Black 1972)

**개요**

Zero-Beta CAPM은 Black(1972)이 무위험자산의 존재를 가정하지 않고 도출한 균형 모형이다. 표준 CAPM의 가장 비현실적 가정인 "모든 투자자가 동일한 무위험이자율로 무제한 차입/대출 가능"을 제거하고, 대신 시장 포트폴리오와 공분산이 0인 Zero-Beta 포트폴리오($R_z$)를 기준점으로 삼는다. SML의 절편이 $R_f$에서 $E[R_z]$로 상승하고 기울기가 완만해지므로, 고베타 종목의 기대수익률은 표준 CAPM 대비 하락하고 저베타 종목은 상승한다.

Fama & MacBeth(1973)의 횡단면 회귀 실증은 $\hat{\gamma}_0 > R_f$, $\hat{\gamma}_1 < E[R_m] - R_f$를 확인하여 Zero-Beta CAPM과 일치하는 결과를 보고했다. Frazzini & Pedersen(2014)의 BAB(Betting Against Beta) 전략은 이 이론의 현대적 확장으로, 차입 제약이 있는 투자자가 고베타 종목을 과도하게 선호하여 체계적으로 과대평가되는 현상을 이용한다.

한국 시장은 Zero-Beta CAPM의 교과서적 적용 사례이다. 2008년 이후 누적 약 5.5년(전체의 약 30%)에 걸친 공매도 전면 금지 기간이 존재하며, 가장 최근에는 2023.11~2025.03 기간의 전면 금지가 있었다. 공매도 금지는 비관적 정보의 가격 반영을 차단하고(Miller 1977), 표준 CAPM의 무위험 차입 가정을 위배하므로 Zero-Beta CAPM이 더 적절한 균형 모형이 된다.

**핵심 공식**

$$E[R_i] = E[R_z] + \beta_i \bigl(E[R_m] - E[R_z]\bigr)$$

$$\beta_z = \frac{\text{Cov}(R_z, R_m)}{\text{Var}(R_m)} = 0 \qquad \text{(정의)}$$

$$E[R_z] > R_f \quad \Rightarrow \quad \text{SML 절편 상승, 기울기 감소}$$

$$\alpha_{i,\text{ZB}} = R_i - \bigl[E[R_z] + \beta_i(R_m - E[R_z])\bigr]$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $E[R_z]$ | Zero-Beta 포트폴리오 기대수익률 | % | 본 Stage |
| $\alpha_{i,\text{ZB}}$ | Zero-Beta 보정 알파 | % | 본 Stage |
| $\textcolor{stageOneMarker}{\beta_i}$ | 시장 베타 (capm_beta.json) | 무차원 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1의 `capm_beta.json`에서 $\beta_i < 0.1$인 종목(약 50~80개)을 추출하여 $E[R_z]$의 경험적 대리변수로 사용한다. `_SHORT_BAN_PERIODS` 배열(appWorker.js:1589)이 공매도 금지 기간을 정의하며, 해당 기간에는 Zero-Beta CAPM 기반 조정이 활성화된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 공매도 금지 기간 감지 | `_SHORT_BAN_PERIODS` appWorker.js:1589 | 레짐별 벤치마크 모형 자동 전환 |
| BAB 이상 현상 반영 | `calcCAPMBeta()` + 베타 범주 분류 | 공매도 금지 시 저베타 종목 프리미엄 강화 |
| $E[R_z]$ 경험적 추정 | `capm_beta.json` $\beta<0.1$ 필터 | 횡단면 alpha 계산의 대안 벤치마크 |

\newpage

### 2.6.5 ICAPM (Intertemporal Capital Asset Pricing Model)

**개요**

기간간 자본자산 가격결정 모형(ICAPM)은 Merton(1973)이 연속시간 동적 최적화(continuous-time dynamic optimization)를 통해 도출한 다기간 균형 모형이다. 표준 CAPM이 단일 기간 의사결정을 가정하는 반면, ICAPM은 투자자가 현재의 부(wealth)뿐 아니라 미래의 투자 기회 집합(investment opportunity set) 변화에 대해서도 헤지(hedge)하고자 한다는 점을 포착한다. 이 "헤지 수요(hedging demand)"가 시장 베타 이외의 추가적 위험 프리미엄을 발생시킨다.

ICAPM의 가장 중요한 이론적 기여는 다중 팩터 모형에 경제적 정당성을 부여한 것이다. Fama-French의 SMB/HML이 단순한 경험적 발견에 그치지 않고, ICAPM 상태변수에 대한 경험적 대리변수(empirical proxies)로 해석될 수 있다. SMB는 경기 변동 상태변수를, HML은 이자율 상태변수를 반영하며, 이들이 가격결정 요인인 이유는 미래 투자 기회의 변화를 포착하기 때문이다. ICAPM이 동기부여(motivation)를 제공하고, APT가 형식(formalism)을 제공하고, FF가 경험적 내용(empirical content)을 채우는 구조이다.

CheeseStock의 MRA 17열 Ridge 회귀에 포함된 매크로 팩터(금리, 변동성, 환율)는 ICAPM 상태변수의 경험적 대리변수이다. momentum_60d, beta_60d, value_inv_pbr, log_size, liquidity_20d의 5개 APT 팩터가 모두 $p < 0.001$ 유의하며, 이들의 추가로 Walk-Forward IC가 0.0567에서 0.0998로 0.0430 증분을 달성했다.

**핵심 공식**

$$E[R_i] - R_f = \beta_{i,M} \lambda_M + \sum_{k=1}^{K} \beta_{i,k} \lambda_k$$

$$\beta_{i,k} = \frac{\text{Cov}(R_i, \Delta s_k)}{\text{Var}(\Delta s_k)} \qquad \text{(헤지 베타)}$$

$$w_i^{*} = \underbrace{-\frac{J_W}{J_{WW}} \cdot \frac{\mu_i}{\sigma_i^2}}_{\text{mean-variance}} + \underbrace{\sum_k -\frac{J_{W s_k}}{J_{WW}} \cdot \frac{\sigma_{i,s_k}}{\sigma_i^2}}_{\text{hedging demand}}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\beta_{i,M}$ | 시장 베타 (표준 CAPM과 동일) | 무차원 | 본 Stage |
| $\beta_{i,k}$ | 상태변수 $k$에 대한 헤지 베타 | 무차원 | 본 Stage |
| $\lambda_k$ | 상태변수 $k$의 위험 프리미엄 | %/yr | 본 Stage |
| $\Delta s_k$ | 상태변수 $k$의 혁신(innovation) | 변수별 상이 | 본 Stage |
| $J(W,s,t)$ | Merton 간접 효용 함수 | — | 본 Stage |
| $\textcolor{stageOneMarker}{\text{BOK rate}}$ | 한국은행 기준금리 (상태변수 $s_1$) | % | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{VKOSPI}}$ | 변동성 지수 (상태변수 $s_2$) | % | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{USD/KRW}}$ | 원/달러 환율 (글로벌 위험선호) | 원 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1의 `data/macro/macro_latest.json`(BOK 기준금리, USD/KRW), `data/macro/bonds_latest.json`(국고채 3Y/10Y), `data/vkospi.json`(VKOSPI 시계열), `data/macro/ff3_factors.json`(MKT, SMB, HML)이 ICAPM 상태변수의 직접적 측정값으로 활용된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 상태변수 기반 패턴 신뢰도 | `_applyPhase8ConfidenceToPatterns()` appWorker.js | 매크로 상태 변화에 따른 패턴 confidence 조정 |
| 매크로 데이터 로드 | `data/macro/*.json` → `_macroLatest` | 금리·환율·변동성의 일별 상태변수 업데이트 |
| 헤지 베타 실증 (17열 Ridge) | `mra_apt_extended.py` IC=0.0998 | 5개 APT 팩터의 IC 증분 +0.0430 검증 |

\newpage

### 2.6.6 CCAPM (Consumption-Based CAPM)

**개요**

소비 기반 자본자산 가격결정 모형(CCAPM)은 Breeden(1979)과 Lucas(1978)가 도출한, 자산가격을 총소비 성장률(aggregate consumption growth)과의 공분산으로 결정하는 가장 "근본적인(fundamental)" 가격결정 모형이다. ICAPM에서 다중 상태변수에 대한 헤지 베타를 필요로 했던 것과 달리, CCAPM은 Breeden의 소비 베타 정리(Consumption Beta Theorem)에 의해 모든 상태변수를 단일 소비 베타($\beta_{c,i}$)로 축약한다. 이는 궁극적으로 투자자가 관심을 갖는 것이 부(wealth) 자체가 아니라 소비(consumption)라는 통찰에 기반한다.

CCAPM의 오일러 방정식 $1 = E[M_{t+1}(1+R_i)]$은 금융학에서 가장 기본적인 가격결정 방정식이다. 확률적 할인 인자(SDF) $M_{t+1} = \delta(C_{t+1}/C_t)^{-\gamma}$의 형태를 특정함으로써 모든 자산가격결정 모형이 이 방정식의 특수한 경우로 해석된다(Cochrane 2005). CAPM은 $M = a - bR_m$, APT는 $M = a - \sum b_k F_k$로 각각 SDF의 특수 형태이다.

그러나 CCAPM은 주식 프리미엄 퍼즐(Equity Premium Puzzle, Mehra & Prescott 1985)이라는 심각한 실증적 난제에 직면한다. 미국 역사적 주식 프리미엄 약 6.2%를 설명하려면 상대적 위험회피계수 $\gamma \approx 27$이 필요한데, 이는 합리적 범위(1~10)를 크게 초과한다. 이에 대한 해결 시도로 Campbell & Cochrane(1999)의 습관 형성(Habit Formation), Epstein & Zin(1989)의 재귀적 효용(Recursive Utility), Barro(2006)의 희귀 재난(Rare Disasters) 모형이 제안되었다.

**핵심 공식**

$$1 = E\bigl[M_{t+1}(1 + R_{i,t+1})\bigr], \qquad M_{t+1} = \delta \left(\frac{C_{t+1}}{C_t}\right)^{-\gamma}$$

$$E[R_i] - R_f = \beta_{c,i} \cdot \lambda_c, \qquad \beta_{c,i} = \frac{\text{Cov}(R_i, \Delta c)}{\text{Var}(\Delta c)}$$

$$\gamma_{\text{EPP}} = \frac{E[R_m] - R_f}{\text{Cov}(r_m, \Delta c)} \approx 27 \qquad \text{(Mehra-Prescott)}$$

$$M_{t+1}^{\text{EZ}} = \delta^{\theta} \left(\frac{C_{t+1}}{C_t}\right)^{-\theta/\psi} R_{w,t+1}^{\theta-1}, \qquad \theta = \frac{1-\gamma}{1-1/\psi}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $M_{t+1}$ | 확률적 할인 인자 (SDF) | 무차원 | 본 Stage |
| $\delta$ | 시간 할인 인자 ($0 < \delta < 1$) | 무차원 | 본 Stage |
| $\gamma$ | 상대적 위험회피계수 (CRRA) | 무차원 | 본 Stage |
| $\Delta c$ | 로그 소비 성장률 $\ln(C_{t+1}/C_t)$ | 무차원 | 본 Stage |
| $\psi$ | 시점간 대체탄력성 (EIS) | 무차원 | 본 Stage |
| $R_w$ | 부(wealth) 포트폴리오 수익률 | % | 본 Stage |

> **이전 Stage 데이터:** 한국 가계 소비 데이터는 KOSIS API에서 분기별로 수신하며, `data/macro/kosis_latest.json`에 소비자심리지수(CCI)가 소비 성장의 간접적 프록시로 수록되어 있다. 다만 일별/주별 패턴 거래에 직접 적용하기에는 데이터 빈도 제약이 있다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 오일러 방정식 (SDF 통합) | 이론적 프레임워크 (직접 구현 없음) | 모든 자산가격결정 모형의 통합 해석 기반 |
| CCI 간접 프록시 | `kosis_latest.json` → `_kosisLatest` | 소비 심리 → 매크로 상태 간접 반영 |
| EPP 해석 | 이론적 배경지식 | KRX Sharpe Ratio(0.25~0.35)의 SDF 일관 해석 |

\newpage

### 2.6.7 APT (Arbitrage Pricing Theory)

**개요**

차익거래 가격결정 이론(APT)은 Ross(1976)가 CAPM과 근본적으로 다른 논리 구조에서 도출한 다중 팩터 가격결정 모형이다. CAPM이 투자자 효용 극대화와 동질적 기대라는 강한 가정에서 시장 균형(equilibrium)을 통해 도출되는 반면, APT는 수익률의 팩터 구조(factor structure)와 무차익 조건(no-arbitrage)이라는 약한 가정만으로 선형 가격결정에 도달한다. 이 "균형 대 무차익" 구분이 두 모형의 근본적 차이이다.

APT의 도출은 다음과 같다. $N$개 종목의 수익률이 $K$개 공통 팩터와 고유 충격으로 분해되고($R_i = E[R_i] + \sum b_{ik}F_k + \varepsilon_i$), 고유 충격이 종목 간 무상관($\text{Cov}(\varepsilon_i, \varepsilon_j) = 0$)이면, 잘 분산된 포트폴리오에서 고유 위험이 소멸한다. 이때 무비용·무팩터노출·양의기대수익인 차익거래 포트폴리오가 존재하지 않으려면, 기대수익률이 팩터 로딩의 선형 함수여야 한다: $E[R_i] = R_f + \sum b_{ik}\lambda_k$. APT의 강점이자 한계는 팩터의 수($K$)와 정체성을 사전에 특정하지 않는다는 점이다. ICAPM이 "왜" 다중 팩터가 필요한지를, FF가 "어떤" 팩터가 경험적으로 유효한지를 각각 보완한다.

CheeseStock의 MRA 파이프라인은 사실상 APT의 구현이다. 17열 Ridge 회귀의 설계행렬에서 열 1~12는 패턴 고유 특성(hw, vw, mw, confidence 등)이고, 열 13~17은 APT 팩터(momentum, beta, value, size, liquidity)이다. Walk-Forward IC = 0.0998(Phase 4-1, 297K samples)은 모든 5개 APT 팩터가 $p < 0.001$ 유의함을 확인했으며, 유동성($t=-27.6$)이 가장 강력한 가격결정 요인으로 Amihud(2002)의 KRX 적용을 실증한다.

**핵심 공식**

$$R_i = E[R_i] + \sum_{k=1}^{K} b_{ik} F_k + \varepsilon_i, \qquad E[F_k]=0, \; \text{Cov}(\varepsilon_i, \varepsilon_j) = 0$$

$$E[R_i] = R_f + \sum_{k=1}^{K} b_{ik} \lambda_k \qquad \text{(무차익 조건)}$$

$$\text{차익거래 포트폴리오}: \quad \sum w_i = 0, \quad \sum w_i b_{ik} = 0 \;\forall k, \quad \sum w_i E[R_i] > 0 \Rightarrow \text{불가}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $b_{ik}$ | 종목 $i$의 팩터 $k$ 로딩 | 무차원 | 본 Stage |
| $F_k$ | 팩터 $k$의 서프라이즈 (innovation) | 변수별 상이 | 본 Stage |
| $\lambda_k$ | 팩터 $k$의 위험 프리미엄 | %/yr | 본 Stage |
| $\varepsilon_i$ | 고유 충격 (idiosyncratic shock) | % | 본 Stage |
| $K$ | 공통 팩터 수 ($K \ll N$) | 정수 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{liquidity}_{20d}}$ | 20일 거래 회전율 | 무차원 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{momentum}_{60d}}$ | 60일 수익률 | % | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 `mra_apt_extended.py`가 17열 설계행렬을 구성하고 Ridge 회귀를 수행한다. 5개 APT 팩터(momentum, beta, value, size, liquidity)는 OHLCV, `index.json`(시총), `financials/*.json`(자본총계)에서 직접 계산된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| APT 17열 Ridge 회귀 | `mra_apt_extended.py` WF IC=0.0998 | 패턴 N-day 수익 예측의 핵심 모형 |
| 무차익 가격결정 | `calcWLSRegression()` indicators.js | JS-side 실시간 회귀 예측 |
| 팩터별 IC 기여 | `mra_apt_coefficients.json` | 유동성(t=-27.6) > 규모(+20.0) > 가치(-14.6) > 베타(+11.9) > 모멘텀(-6.0) |

\newpage

### 2.6.8 Fama-French 3/5-Factor Model

**개요**

Fama & French(1993)의 3-Factor 모형은 CAPM의 단일 시장 팩터에 SMB(Small Minus Big, 규모 효과)와 HML(High Minus Low, 가치 효과)을 추가하여 횡단면 수익률의 설명력을 대폭 향상시켰다. CAPM이 설명하지 못하는 소형주 프리미엄(Banz 1981)과 가치주 프리미엄(Basu 1977, Rosenberg et al. 1985)을 체계적 팩터로 포착한다. 2015년에는 RMW(수익성)와 CMA(투자)를 추가한 5-Factor 모형으로 확장되었다.

FF 팩터 구성은 2x3 정렬(double sort) 방법론을 따른다. 매년 6월 말 기준 시가총액 중위수로 Small/Big을 구분하고, B/M(장부가치 대 시가총액) 비율의 30/40/30 분위로 Value/Neutral/Growth를 분류한다. SMB = (SV + SN + SG)/3 - (BV + BN + BG)/3, HML = (SV + BV)/2 - (SG + BG)/2로 시가총액 가중 포트폴리오 수익률 차이를 계산한다.

CheeseStock의 한국 FF3 팩터는 `download_macro.py`의 `build_ff3_factors()` 함수에서 구성되며, 결과가 `data/macro/ff3_factors.json`에 일별 팩터 수익률로 저장된다. 초기 실증(2025.04~2026.04): MKT_RF Sharpe=+2.99, SMB Sharpe=-3.82, HML Sharpe=-2.80으로, 음의 SMB/HML은 해당 기간 한국 시장의 대형·성장주 프리미엄을 확인한다. **중요 사항:** FF3 팩터 구성은 Python 오프라인 스크립트(`compute_ff3.py`, `download_macro.py`)에서만 수행되며, JS-side에는 `calcFF3()` 함수가 존재하지 않는다. 브라우저에서는 사전 계산된 팩터 수익률을 로드하여 표시만 한다.

**핵심 공식**

$$R_i - R_f = \alpha_i + \beta_{MKT} \cdot \text{MKT\_RF} + \beta_{SMB} \cdot \text{SMB} + \beta_{HML} \cdot \text{HML} + \varepsilon_i$$

$$\text{SMB} = \frac{1}{3}(S_V + S_N + S_G) - \frac{1}{3}(B_V + B_N + B_G)$$

$$\text{HML} = \frac{1}{2}(S_V + B_V) - \frac{1}{2}(S_G + B_G)$$

$$\text{FF5}: \;\; + \; \beta_{RMW} \cdot \text{RMW} + \beta_{CMA} \cdot \text{CMA}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| MKT\_RF | 시장 초과수익률 ($R_m - R_f$) | % | 본 Stage |
| SMB | 소형주 프리미엄 (Small Minus Big) | % | 본 Stage |
| HML | 가치주 프리미엄 (High Minus Low) | % | 본 Stage |
| RMW | 수익성 프리미엄 (Robust Minus Weak) | % | 본 Stage |
| CMA | 투자 프리미엄 (Conservative Minus Aggressive) | % | 본 Stage |
| $\textcolor{stageOneMarker}{\text{B/M ratio}}$ | 자본총계 / 시가총액 | 무차원 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{marketCap}}$ | 시가총액 (index.json) | 억원 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 `index.json`의 시가총액(marketCap)과 `data/financials/{code}.json`의 자본총계(total_equity)로 B/M ratio를 산출한다. 무위험이자율은 CD 91일물 금리를 252 거래일로 일할계산한다. 약 2,241 종목이 seed 데이터 제외 후 유니버스를 구성한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 한국 FF3 팩터 구성 | `build_ff3_factors()` download_macro.py | 일별 SMB/HML/MKT_RF 산출 (Python-only) |
| FF3 일별 수익률 표시 | `data/macro/ff3_factors.json` → JS 로드 | 팩터 노출 시각화 (계수 테이블) |
| 2x3 정렬 방법론 (상수 #168-171) | download_macro.py 모듈 상수 | 50/50 규모, 30/40/30 가치 분위 |

\newpage

### 2.6.9 Bond Pricing & Duration (채권 가격결정)

**개요**

채권 가격은 미래 현금흐름(쿠폰 + 원금)의 현재가치 합이다. 이 단순한 원리가 모든 채권 분석의 기반이며, 듀레이션(duration)은 "채권의 베타"로서 금리 민감도를 단일 숫자로 요약한다(Fabozzi 2007). Macaulay(1938) 듀레이션은 현금흐름의 현재가치 가중 평균 만기이고, 수정 듀레이션(modified duration)은 가격의 금리 탄력성, DV01은 1bp 변동의 절대 금액 변화를 측정한다.

볼록성(convexity)은 듀레이션의 선형 근사를 2차로 보정한다. 대규모 금리 변동에서 듀레이션만으로는 가격 변화를 과소추정(금리 하락 시)하거나 과대추정(금리 상승 시)하며, 볼록성 보정이 이 오차를 줄인다. 양의 볼록성은 금리 하락 시 가격 상승 폭이 금리 상승 시 가격 하락 폭보다 큼을 의미하므로, 동일 듀레이션에서 볼록성이 큰 채권이 유리하다.

한국 채권시장은 국고채(KTB) 중심으로 구조화되어 있으며, KTB 3년/10년/30년이 벤치마크이다. CheeseStock에서 채권 데이터는 `bonds_latest.json`을 통해 수신되고, `compute_bond_metrics.py`가 듀레이션·DV01·볼록성을 산출한다. 금리 기간구조(term structure)의 기울기 변화는 ICAPM 상태변수로서 주식 패턴 신뢰도 조정에 활용된다.

**핵심 공식**

$$P = \sum_{t=1}^{n} \frac{C}{(1+y)^t} + \frac{F}{(1+y)^n}$$

$$D_{\text{Mac}} = \frac{1}{P} \sum_{t=1}^{n} t \cdot \frac{CF_t}{(1+y)^t}, \qquad D_{\text{mod}} = \frac{D_{\text{Mac}}}{1+y}$$

$$\text{DV01} = D_{\text{mod}} \cdot P \cdot 0.0001$$

$$\text{Convexity} = \frac{1}{P} \sum_{t=1}^{n} \frac{t(t+1) \cdot CF_t}{(1+y)^{t+2}}$$

$$\frac{\Delta P}{P} \approx -D_{\text{mod}} \cdot \Delta y + \frac{1}{2} \cdot \text{Convexity} \cdot (\Delta y)^2$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $P$ | 채권 가격 | 원(KRW) | 본 Stage |
| $C$ | 기간별 쿠폰 이자 | 원 | 본 Stage |
| $F$ | 액면가(par value) | 원 | 본 Stage |
| $y$ | 만기수익률 (YTM) | %/기간 | 본 Stage |
| $D_{\text{Mac}}$ | Macaulay 듀레이션 | 년 | 본 Stage |
| $D_{\text{mod}}$ | 수정 듀레이션 | 년 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{KTB 3Y/10Y}}$ | 국고채 3년/10년 금리 | %/yr | **Stage 1** |

> **이전 Stage 데이터:** Stage 1의 `data/macro/bonds_latest.json`에서 KTB 3Y, 5Y, 10Y, 30Y 금리를 수신한다. 금리 기간구조의 기울기(10Y-3Y spread)는 경기 전망 상태변수이며, 역전(inversion) 시 경기 침체 신호로 해석된다. `compute_bond_metrics.py`가 듀레이션·DV01 산출을 수행한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 채권 DV01/듀레이션 산출 | `compute_bond_metrics.py` | 섹터별 금리 민감도 분석 |
| 금리 기간구조 기울기 | `bonds_latest.json` 10Y-3Y spread | ICAPM 상태변수 → 패턴 신뢰도 조정 |
| 금리 변화 시 주식 영향 | `_applyPhase8ConfidenceToPatterns()` | 금리 급변 시 패턴 confidence 감쇠 |

\newpage

### 2.6.10 BSM (Black-Scholes-Merton Option Pricing)

**개요**

Black-Scholes-Merton(BSM) 모형은 Black & Scholes(1973)와 Merton(1973)이 독립적으로 도출한 옵션 가격결정의 해석적 공식이다. 기초자산이 기하 브라운 운동(GBM)을 따르고, 무차익 조건 하에서 완전 헤지(delta hedging)가 가능할 때, 유럽형 콜/풋 옵션의 공정 가격을 폐쇄형(closed-form)으로 산출한다. BSM은 파생상품 가격결정의 출발점이자, 자산가격결정의 제1기본정리(FTAP)의 가장 직관적인 응용이다.

BSM의 핵심 가정은 상수 변동성($\sigma$)이지만, 현실에서 내재변동성(IV)은 행사가격에 따라 달라지는 변동성 미소(volatility smile)를 보인다. 이는 기초자산 수익률의 분포가 정규분포보다 두꺼운 꼬리를 가짐을 시사하며, Heston(1993) 확률변동성 모형, Dupire(1994) 로컬변동성 모형 등의 확장 모형이 이를 보정한다.

CheeseStock에서 BSM은 VKOSPI(KOSPI200 옵션 내재변동성 지수)의 이론적 기반을 제공한다. VKOSPI는 CBOE VIX와 동일한 방법론으로 산출되며, `data/vkospi.json`에 일별 시계열로 저장된다. `compute_options_analytics.py`가 스트래들 내재 변동(straddle implied move), 풋-콜 비율(PCR), 감마 익스포저(GEX) 등을 산출한다.

**핵심 공식**

$$C = S \cdot N(d_1) - K e^{-rT} \cdot N(d_2)$$

$$P = K e^{-rT} \cdot N(-d_2) - S \cdot N(-d_1)$$

$$d_1 = \frac{\ln(S/K) + (r + \sigma^2/2)T}{\sigma\sqrt{T}}, \qquad d_2 = d_1 - \sigma\sqrt{T}$$

$$C + Ke^{-rT} = P + S \qquad \text{(Put-Call Parity)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $S$ | 기초자산 현재가격 | 원 | 본 Stage |
| $K$ | 행사가격 (strike) | 원 | 본 Stage |
| $T$ | 잔존만기 | 년 | 본 Stage |
| $r$ | 무위험이자율 | %/yr | 본 Stage |
| $\sigma$ | 변동성 (연율화) | %/yr | 본 Stage |
| $N(\cdot)$ | 표준정규분포 CDF | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{\sigma_{IV}}$ | 내재변동성 (VKOSPI) | %/yr | **Stage 1** |

> **이전 Stage 데이터:** Stage 1의 `data/vkospi.json`에서 VKOSPI 일별 시계열을 수신한다. VKOSPI는 KOSPI200 옵션의 30일 만기 ATM 내재변동성으로, BSM 역함수(Newton-Raphson)를 통해 관측된 옵션 시장가격에서 추출된다. `compute_options_analytics.py`가 straddle implied move를 산출한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| VKOSPI 레짐 분류 | `options_analytics.json` analytics | 변동성 레짐(안정/불안/공포)별 패턴 조정 |
| Straddle implied move | `compute_options_analytics.py` | 시장 기대 변동폭의 정량화 |
| BSM 이론 변동성 vs 실현 변동성 | `calcVRP()` indicators.js:536 | VRP 산출의 이론적 기반 (2.6.11절 연결) |

\newpage

### 2.6.11 Greeks & IV (Greeks 체계 및 변동성 리스크 프리미엄)

**개요**

Greeks는 BSM 모형에서 옵션 가격의 각 입력 변수에 대한 편미분으로 정의되는 민감도 체계이다. Delta($\Delta$)는 기초자산 가격 변화에 대한 민감도, Gamma($\Gamma$)는 Delta의 변화율(볼록성), Theta($\Theta$)는 시간 가치 감쇠, Vega($\nu$)는 변동성 민감도를 측정한다. 실무에서 시장 조성자의 감마 헤지(gamma hedging)는 기초자산의 단기 가격 변동을 증폭 또는 감쇠시키며, 이것이 감마 익스포저(GEX) 신호의 이론적 기반이다.

변동성 리스크 프리미엄(VRP)은 내재변동성($\sigma_{IV}$)과 실현변동성($\sigma_{RV}$)의 괴리로 정의된다: $\text{VRP} = \sigma_{IV}^2 - \sigma_{RV}^2$. 투자자가 변동성 위험에 대해 보험료를 지불하므로 내재변동성이 실현변동성을 체계적으로 상회하며, VRP가 양수인 것이 일반적이다. Bollerslev, Tauchen & Zhou(2009)는 VRP가 1~3개월 주식 수익률의 유의미한 예측자임을 보였다. VRP의 이론적 근거는 ICAPM의 변동성 상태변수에 대한 헤지 수요이다.

CheeseStock에서 `calcVRP()` 함수는 VKOSPI(내재변동성)와 `calcHV()` 함수가 산출한 역사적 변동성의 차이로 VRP를 계산한다. 양의 VRP가 급격히 확대되면 시장의 공포 수준이 높아진 것으로 해석되며, 패턴 신뢰도 조정의 추가 입력으로 활용된다.

**핵심 공식**

$$\Delta = \frac{\partial C}{\partial S} = N(d_1), \qquad \Gamma = \frac{\partial^2 C}{\partial S^2} = \frac{N'(d_1)}{S\sigma\sqrt{T}}$$

$$\Theta = -\frac{S N'(d_1)\sigma}{2\sqrt{T}} - rKe^{-rT}N(d_2), \qquad \nu = S\sqrt{T}\,N'(d_1)$$

$$\text{VRP} = \sigma_{IV}^2 - \sigma_{RV}^2 \qquad \text{(Bollerslev-Tauchen-Zhou 2009)}$$

$$\text{GEX} = \sum_{\text{strikes}} \text{OI} \times \Gamma \times S^2 \times 0.01 \times 100 \qquad \text{(net gamma exposure)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\Delta$ | 기초자산 가격 민감도 | 무차원 | 본 Stage |
| $\Gamma$ | Delta의 변화율 (볼록성) | $1/\text{원}$ | 본 Stage |
| $\Theta$ | 시간가치 감쇠 | 원/일 | 본 Stage |
| $\nu$ | 변동성 민감도 (Vega) | 원/% | 본 Stage |
| $N'(\cdot)$ | 표준정규분포 PDF | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{\sigma_{IV}}$ | VKOSPI 내재변동성 | %/yr | **Stage 1** |
| $\textcolor{stageOneMarker}{\sigma_{RV}}$ | 역사적 실현변동성 | %/yr | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 `data/vkospi.json`의 VKOSPI가 $\sigma_{IV}$를, OHLCV에서 `calcHV()`가 산출한 20일 역사적 변동성이 $\sigma_{RV}$를 제공한다. VRP는 이 두 값의 차이로 계산되며, `signalEngine.js`에서 `calcVRP()` 호출을 통해 변동성 레짐 신호에 반영된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| VRP 산출 | `calcVRP()` indicators.js:536 | IV-RV 스프레드 기반 변동성 레짐 신호 |
| GEX 감마 익스포저 | `options_analytics.json` GEX | 감마 양/음 레짐에 따른 가격 변동 증폭/감쇠 판단 |
| HV 연율화 (252일 기준) | `calcHV()` indicators.js | $\sigma_{RV} = \sigma_d \times \sqrt{252}$ |

\newpage

### 2.6.12 Market Microstructure (시장 미시구조)

**개요**

시장 미시구조(market microstructure)는 자산의 거래 과정에서 가격이 어떻게 형성되고, 정보가 어떻게 가격에 반영되며, 유동성이 어떻게 제공되는지를 연구하는 분야이다. 세 가지 핵심 모형이 이론적 기반을 구성한다: Kyle(1985)의 정보 기반 가격 충격 모형, Glosten-Milgrom(1985)의 호가 스프레드 분해 모형, 그리고 Amihud(2002)의 비유동성 측도이다.

Kyle(1985) 모형에서 가격 충격 계수 $\lambda = \sigma_v / (2\sigma_u)$는 내부자의 정보 가치 변동성($\sigma_v$)과 잡음 거래량($\sigma_u$)의 비율로 결정된다. $\lambda$가 높을수록 주문이 가격에 미치는 영향이 크고, 이는 정보 비대칭의 정도를 반영한다. Glosten-Milgrom(1985) 모형은 호가 스프레드(bid-ask spread)를 정보 비용($\mu\delta$)과 재고 비용으로 분해하여, 스프레드가 정보 비대칭의 직접적 함수임을 보인다: $\text{Spread} = 2\mu\delta$, 여기서 $\mu$는 정보거래자 비율, $\delta$는 정보 가치이다.

Amihud(2002)의 비유동성 측도(ILLIQ)는 $\text{ILLIQ}_t = |r_t| / \text{DVOL}_t$로 정의되며, 단위 거래금액당 가격 충격을 측정한다. 이는 Kyle $\lambda$의 실증적 대리변수로 해석되며, MRA 17열 Ridge 회귀에서 유동성 팩터($t = -27.6$)가 가장 강력한 가격결정 요인임이 확인되었다. Kyle 모형과 GM 스프레드 분해는 이론적 프레임워크로만 참조하며, 직접적 구현은 Amihud ILLIQ에 한정된다.

**핵심 공식**

$$\Delta P = \lambda \cdot \text{OrderFlow}, \qquad \lambda = \frac{\sigma_v}{2\sigma_u} \qquad \text{(Kyle 1985)}$$

$$\text{ILLIQ}_t = \frac{|r_t|}{\text{DVOL}_t}, \qquad \overline{\text{ILLIQ}} = \frac{1}{T}\sum_{t=1}^{T} \text{ILLIQ}_t \qquad \text{(Amihud 2002)}$$

$$\text{Spread}_{\text{GM}} = 2\mu\delta \qquad \text{(Glosten-Milgrom 1985)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\lambda$ | Kyle 가격 충격 계수 | 원/주 | 본 Stage |
| $\sigma_v$ | 정보 가치 변동성 | 원 | 본 Stage |
| $\sigma_u$ | 잡음 거래량 표준편차 | 주 | 본 Stage |
| $\text{ILLIQ}_t$ | Amihud 비유동성 측도 | 1/원 | 본 Stage |
| $\text{DVOL}_t$ | 거래대금 (가격 $\times$ 거래량) | 원 | 본 Stage |
| $\mu$ | 정보거래자 비율 | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{r_t, \text{volume}_t}$ | 일별 수익률, 거래량 | %, 주 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1의 OHLCV 데이터에서 `|r_t|`(일별 절대수익률)과 `DVOL_t`(거래대금 = close $\times$ volume)를 계산한다. `calcAmihudILLIQ()` 함수가 20일 이동평균 ILLIQ를 산출하며, 이는 APT 유동성 팩터의 직접적 입력이다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Amihud ILLIQ | `calcAmihudILLIQ()` indicators.js:1430 | 비유동성 측도 → APT 유동성 팩터 (t=-27.6) |
| Kyle $\lambda$ 근사 | `KRX_SLIPPAGE` backtester.js | 슬리피지 추정의 이론적 기반 |
| GM 스프레드 해석 | 이론 참조만 (직접 구현 없음) | 호가 스프레드의 정보 비대칭 분해 해석 |

\newpage

### 2.6.13 Merton DD (Distance-to-Default)

**개요**

Merton(1974) 구조적 신용위험 모형은 "기업의 자기자본은 자산가치에 대한 콜옵션"이라는 통찰에 기반한다. 자산가치($V$)가 부채 만기($T$) 시점에 부채 수준($D$) 이하로 하락하면 부도(default)가 발생하고, 주주는 잔여 가치 $\max(V_T - D, 0)$을 수령한다. 이 구조는 BSM 콜옵션과 동형(isomorphic)이므로, 옵션 가격결정 이론이 신용위험 분석에 직접 적용된다.

부도거리(Distance-to-Default, DD)는 자산가치가 부도점(default point)에 도달하기까지의 표준편차 수를 측정한다. $\text{DD} = [\ln(V/D) + (r - 0.5\sigma_V^2)T] / (\sigma_V\sqrt{T})$. DD가 클수록 부도 확률이 낮고, 이론적 부도 확률(PD)은 $N(-\text{DD})$로 산출된다. KMV(Moody's)는 이론적 PD 대신 경험적 부도빈도(EDF)를 매핑하여 실무적 정확도를 향상시켰다.

CheeseStock에서는 Bharath & Shumway(2008)의 간편 추정법("naive DD")을 구현한다. 비상장 자산가치($V$)를 직접 관측할 수 없으므로, 시가총액을 자기자본 가치로, 부채 장부가를 부채 수준으로 대체한다. `_calcNaiveDD()` 함수(appWorker.js:884)가 이를 수행하며, $\text{DD} < 1.5$ 시 패턴 신뢰도에 감쇠(decay)를 적용하여 재무 건전성이 약한 종목의 기술적 신호를 보수적으로 조정한다.

**핵심 공식**

$$\text{DD} = \frac{\ln(V/D) + (r - 0.5\sigma_V^2)T}{\sigma_V \sqrt{T}}$$

$$\text{PD} = N(-\text{DD}) \qquad \text{(이론적 부도확률)}$$

$$E = V \cdot N(d_1) - D \cdot e^{-rT} \cdot N(d_2) \qquad \text{(주식 = 콜옵션)}$$

$$\sigma_E = \frac{V}{E} \cdot N(d_1) \cdot \sigma_V \qquad \text{(레버리지-변동성 관계)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $V$ | 기업 자산가치 (비관측) | 원 | 본 Stage |
| $D$ | 부채 수준 (default point) | 원 | 본 Stage |
| $\sigma_V$ | 자산가치 변동성 | %/yr | 본 Stage |
| $E$ | 자기자본 시장가치 (시가총액) | 원 | 본 Stage |
| DD | 부도거리 (표준편차 수) | 무차원 | 본 Stage |
| PD | 부도확률 | % | 본 Stage |
| $\textcolor{stageOneMarker}{\text{시가총액}}$ | index.json marketCap | 억원 | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{부채총계}}$ | financials/{code}.json | 원 | **Stage 1** |

> **이전 Stage 데이터:** Stage 1에서 `index.json`의 시가총액(marketCap)이 자기자본 시장가치($E$)로, `data/financials/{code}.json`의 부채총계(total_liabilities)가 부채 수준($D$)으로 사용된다. 주가 변동성($\sigma_E$)은 OHLCV에서 산출하며, Bharath-Shumway 간편법에 의해 $\sigma_V \approx \sigma_E \cdot E/(E+D)$로 근사한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Naive DD 계산 (Bharath-Shumway) | `_calcNaiveDD()` appWorker.js:884 | 종목별 부도거리 산출 |
| DD 기반 패턴 감쇠 | DD < 1.5 → 패턴 confidence 감쇠 | 재무 건전성 약한 종목의 보수적 신호 조정 |
| Merton 콜옵션 해석 | `compute_capm_beta.py` DD 산출 | 레버리지-변동성 관계를 통한 자산변동성 역산 |

\newpage

### 2.6.14 Reduced-Form Credit Models (축약형 신용위험 모형)

**개요**

축약형(reduced-form) 신용위험 모형은 구조적 모형(Merton)과 근본적으로 다른 접근 방식을 취한다. 구조적 모형이 자산가치의 진화를 추적하여 부도를 내생적(endogenous)으로 결정하는 반면, 축약형 모형은 부도를 외생적(exogenous) 확률 과정으로 모형화한다. 부도는 위험 강도(hazard rate) $\lambda(t)$를 가진 포아송 과정으로 발생하며, $\lambda(t)$가 높을수록 단위 시간당 부도 확률이 높다.

Jarrow & Turnbull(1995)과 Duffie & Singleton(1999)이 체계화한 축약형 모형에서, 위험 채권의 가격은 부도 확률과 회수율(recovery rate)을 반영한 할인된 기대 현금흐름으로 결정된다. 생존 확률은 $Q(T) = \exp(-\int_0^T \lambda(s)\,ds)$이며, 위험 채권 가격은 $P_{\text{risky}} = P_{\text{riskfree}} \times [Q(T) + (1-Q(T)) \times R]$으로 근사된다. 여기서 $R$은 회수율이다.

축약형 모형의 실무적 장점은 CDS(Credit Default Swap) 가격에서 $\lambda(t)$를 역산(bootstrapping)할 수 있다는 점이다. 그러나 한국 시장에서는 CDS 유동성이 부족하여 구조적 모형(Merton DD)이 더 실용적이다. CheeseStock에서 축약형 모형은 이론적 참조로만 활용되며, 직접적 구현은 없다. 크레딧 스프레드 레짐 분류(Doc 35 §5)가 축약형 모형의 간접적 응용이다.

**핵심 공식**

$$\lambda(t) = \lim_{\Delta t \to 0} \frac{P(\text{default in } [t, t+\Delta t] \mid \text{survival to } t)}{\Delta t}$$

$$Q(T) = \exp\!\left(-\int_0^T \lambda(s)\,ds\right) \qquad \text{(생존확률)}$$

$$P_{\text{risky}} = \sum_{t=1}^{n} \frac{C \cdot Q(t)}{(1+r)^t} + \frac{F \cdot Q(n)}{(1+r)^n} + \sum_{t=1}^{n} \frac{R \cdot F \cdot [\lambda(t)\Delta t \cdot Q(t-1)]}{(1+r)^t}$$

$$\text{CDS Spread} \approx (1-R) \cdot \bar{\lambda} \qquad \text{(간편 근사)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\lambda(t)$ | 위험 강도 (hazard rate) | 1/yr | 본 Stage |
| $Q(T)$ | 만기 $T$까지 생존 확률 | 무차원 | 본 Stage |
| $R$ | 부도 시 회수율 (recovery rate) | 무차원 | 본 Stage |
| $P_{\text{risky}}$ | 위험 채권 가격 | 원 | 본 Stage |
| CDS Spread | 신용부도스왑 프리미엄 | bp | 본 Stage |

> **이전 Stage 데이터:** 한국 시장에서 CDS 유동성이 제한적이므로, Stage 1 데이터로부터 직접적인 $\lambda(t)$ 추정은 수행하지 않는다. 대신 `bonds_latest.json`의 회사채 스프레드(AA- 기준)가 축약형 모형의 간접적 프록시로 활용된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 축약형 모형 | 구현 없음 (이론 참조만) | Merton DD의 이론적 보완 프레임워크 |
| 크레딧 스프레드 레짐 | `bonds_latest.json` AA- 스프레드 | 4단계 신용 레짐 분류 (Doc 35 §5 연결) |
| CDS-채권 기저 해석 | 이론 참조만 | 크레딧 시장 이상 징후 해석의 이론적 기반 |

\newpage

### 2.6.15 SDF (Stochastic Discount Factor) 통합 프레임워크

**개요**

확률적 할인 인자(SDF, Stochastic Discount Factor)는 모든 자산가격결정 모형을 통합하는 메타 프레임워크이다. 기본 가격결정 방정식 $1 = E[M_{t+1}(1+R_i)]$에서 $M$의 형태를 특정함에 따라 CAPM, CCAPM, APT 등이 각각 도출된다. SDF는 pricing kernel, state-price density와 동의어이며, Harrison & Kreps(1979)의 자산가격결정 제1기본정리(First Fundamental Theorem of Asset Pricing)는 무차익 조건과 양의 SDF 존재의 등가성을 증명하여 파생상품 가격결정과 자산가격결정을 수학적으로 통합하였다.

SDF 존재의 삼단 논증은 다음과 같다. (1) 일물일가의 법칙(LOOP)은 가격결정 함수의 선형성을 보장하여 $p(x) = E[M \cdot x]$인 $M$이 존재함을 보인다. (2) 무차익 조건은 $M > 0$ (양수성)을 요구하며, 이는 위험중립 측도 $Q$의 존재와 동치이다. (3) 완전시장은 $M$의 유일성을 보장하지만, 불완전 시장에서는 무한히 많은 SDF가 존재한다.

Hansen & Jagannathan(1991)의 HJ Bound는 SDF의 최소 변동성 조건을 설정한다: $\sigma(M)/E[M] \geq |E[R_i]-R_f|/\sigma(R_i)$. 우변은 자산 $i$의 Sharpe Ratio이므로, SDF의 변동계수는 시장에서 관찰되는 최대 Sharpe Ratio 이상이어야 한다. Equity Premium Puzzle은 소비 기반 SDF가 이 경계를 충족하려면 비현실적으로 높은 $\gamma$가 필요하다는 문제이며, Epstein-Zin 재귀적 효용이 이를 완화한다. CheeseStock의 MRA 17열 Ridge 계수벡터는 암묵적 선형 SDF $M_{CS} = a - \sum b_k X_k$를 정의하며, HJ Bound 충족 여부로 모형의 적절성을 진단할 수 있다.

**핵심 공식**

$$1 = E\bigl[M_{t+1}(1 + R_{i,t+1})\bigr] \qquad \text{(기본 가격결정 방정식)}$$

$$\frac{\sigma(M)}{E[M]} \geq \frac{|E[R_i] - R_f|}{\sigma(R_i)} \qquad \text{(Hansen-Jagannathan Bound)}$$

$$M > 0 \;\Longleftrightarrow\; \text{No-Arbitrage} \;\Longleftrightarrow\; \exists\, Q \text{ (위험중립 측도)}$$

**SDF 특수 형태별 모형 도출:**

| 모형 | SDF 형태 $M$ | 비고 |
|------|-------------|------|
| CAPM | $a - b \cdot R_m$ | Sharpe(1964) |
| FF3 | $a - b \cdot \text{MKT} - s \cdot \text{SMB} - h \cdot \text{HML}$ | Fama-French(1993) |
| CCAPM | $\delta(C_{t+1}/C_t)^{-\gamma}$ | Breeden(1979) |
| Epstein-Zin | $\delta^\theta(C_{t+1}/C_t)^{-\theta/\psi} R_w^{\theta-1}$ | Epstein-Zin(1989) |
| APT | $a - \sum b_k F_k$ | Ross(1976) |

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $M$ | SDF (pricing kernel) | 무차원 | 본 Stage |
| $\sigma(M)/E[M]$ | SDF 변동계수 | 무차원 | 본 Stage |
| $Q$ | 위험중립 측도 | — | 본 Stage |
| LOOP | 일물일가의 법칙 | — | 본 Stage |
| FTAP | 자산가격결정 제1기본정리 | — | 본 Stage |

> **이전 Stage 데이터:** SDF 프레임워크는 순수 이론적 통합 틀이므로 Stage 1 데이터에 직접 의존하지 않는다. 다만 MRA Ridge 계수벡터가 암묵적 SDF를 정의하므로, `mra_apt_coefficients.json`의 17개 계수가 SDF 가격 벡터에 대응한다. HJ Bound 검증 시 KOSPI 연환산 Sharpe Ratio(0.25~0.35)가 기준이 된다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 암묵적 SDF ($M_{CS}$) | MRA 17열 Ridge 계수 | $M_{CS} = a - \sum b_k X_k$로 모형 일관성 진단 |
| HJ Bound 검증 | 이론적 프레임워크 (구현 예정) | SDF 변동계수 vs KOSPI Sharpe Ratio 비교 |
| FTAP (무차익 ↔ SDF > 0) | BSM/VRP/APT의 이론적 통합 | 옵션 가격결정과 자산가격결정의 일관성 보장 |

\newpage

### 2.6.16 Summary: 금융학 시트 통합 요약

**개요**

본 절의 15개 시트는 자산가격결정의 이론적 계보를 완전하게 구성한다. EMH/AMH(2.6.1)로 시장 효율성의 전제를 설정하고, MPT(2.6.2)→CAPM(2.6.3)→Zero-Beta(2.6.4)→ICAPM(2.6.5)→CCAPM(2.6.6)으로 이어지는 균형 자산가격결정의 진화를 추적한다. APT(2.6.7)와 FF3/5(2.6.8)는 무차익 논증과 경험적 팩터의 축을 제공하며, 채권(2.6.9), 옵션(2.6.10~11), 미시구조(2.6.12), 신용위험(2.6.13~14)은 교차시장 신호의 이론적 기반을 구성한다. SDF(2.6.15)가 이 모든 것을 $1 = E[M(1+R)]$이라는 단일 방정식으로 통합한다.

**15개 시트 종합표**

| 시트 | 핵심 모형 | 핵심 공식 | CheeseStock 구현 | 구현 수준 |
|------|-----------|-----------|------------------|-----------|
| 2.6.1 | EMH & AMH | $H = \log(R/S)/\log(n)$ | `calcHurst()` | 완전 구현 |
| 2.6.2 | MPT | $\text{SR} = (E[R_p]-R_f)/\sigma_p$ | `backtester.js` 위험 통계 | 완전 구현 |
| 2.6.3 | CAPM | $E[R_i] = R_f + \beta_i(E[R_m]-R_f)$ | `calcCAPMBeta()` | 완전 구현 |
| 2.6.4 | Zero-Beta | $E[R_i] = E[R_z]+\beta_i(E[R_m]-E[R_z])$ | `_SHORT_BAN_PERIODS` | 부분 구현 |
| 2.6.5 | ICAPM | $E[R_i]-R_f = \beta_M\lambda_M+\Sigma\beta_k\lambda_k$ | `_applyPhase8Confidence` | 완전 구현 |
| 2.6.6 | CCAPM | $1 = E[M_{t+1}(1+R_i)]$ | 이론 참조만 | 미구현 |
| 2.6.7 | APT | $E[R_i] = R_f + \sum b_{ik}\lambda_k$ | `mra_apt_extended.py` | 완전 구현 |
| 2.6.8 | FF3/5 | $R_i-R_f = \alpha+\beta\text{MKT}+s\text{SMB}+h\text{HML}$ | `build_ff3_factors()` (Python) | 완전 구현 |
| 2.6.9 | Bond Pricing | $P = \sum C/(1+y)^t + F/(1+y)^n$ | `compute_bond_metrics.py` | 완전 구현 |
| 2.6.10 | BSM | $C = SN(d_1)-Ke^{-rT}N(d_2)$ | `compute_options_analytics.py` | 완전 구현 |
| 2.6.11 | Greeks/VRP | $\text{VRP} = \sigma_{IV}^2 - \sigma_{RV}^2$ | `calcVRP()` | 완전 구현 |
| 2.6.12 | Microstructure | $\text{ILLIQ} = |r|/\text{DVOL}$ | `calcAmihudILLIQ()` | 부분 구현 |
| 2.6.13 | Merton DD | $\text{DD} = [\ln(V/D)+(r-0.5\sigma^2)T]/(\sigma\sqrt{T})$ | `_calcNaiveDD()` | 완전 구현 |
| 2.6.14 | Reduced-Form | $\lambda(t)$ hazard rate | 구현 없음 | 미구현 |
| 2.6.15 | SDF | $1 = E[M(1+R)]$ | MRA Ridge 계수 (암묵적) | 이론적 해석 |

**SDF 통합 계보도**

| 통합 관계 | 수학적 표현 |
|-----------|------------|
| CAPM $\subset$ ICAPM | ICAPM에서 상태변수 = 0이면 CAPM |
| CAPM $\subset$ APT ($K=1$) | APT에서 단일 시장 팩터이면 CAPM |
| FF3 $\subset$ APT ($K=3$) | APT에서 3개 특정 팩터이면 FF3 |
| CCAPM $\subset$ ICAPM | 소비 = 유일한 상태변수이면 CCAPM |
| ICAPM $\approx$ APT | 수학적 형태 동일, 해석(균형 vs 무차익) 상이 |
| 모든 모형 $\rightarrow$ SDF | $M$의 형태 특정에 따라 각 모형 도출 |

> **3장 연결:** 본 절의 금융학적 기초는 3장(기술적 분석 이론 및 구현)에서 패턴·신호·백테스트의 벤치마크로 활용된다. Jensen's Alpha(2.6.3)는 패턴 전략의 위험 조정 성과를 평가하고, APT 팩터(2.6.7)는 MRA 회귀의 설명변수를, VRP(2.6.11)와 DD(2.6.13)는 패턴 신뢰도 조정의 교차시장 입력을 각각 제공한다. SDF(2.6.15)의 무차익 조건은 패턴의 존재와 소멸을 AMH(2.6.1)의 적응적 진화 관점에서 해석하는 이론적 뼈대이다.

## 2.7 행동재무학적 기초[^behav-1]

행동재무학은 기술적 패턴이 *왜* 작동하는지에 대한 이론적 정당화를 제공한다.
체계적 인지 편향이 본질가치로부터의 예측 가능한 이탈을 생성하기 때문이다.
모든 시장참여자가 합리적 베이지안 갱신자(EMH의 가정)라면, 가격 패턴은 어떠한
예측적 정보도 담지 않을 것이다.

\newpage

### 2.7.1 전망이론과 손실회피 (Prospect Theory & Loss Aversion)

**개요**

Kahneman and Tversky (1979)의 전망이론은 행동재무학의 기초이다.
준거점 의존, 손실회피($\lambda = 2.25$), 민감도 체감, 확률 가중의 4대 이탈이
패턴 분석 엔진의 손절매/목표가 비대칭 산출에 직접 반영된다.

**핵심 공식**

$$v(x) = \begin{cases} x^{0.88} & x \geq 0 \text{ (이득)} \\ -2.25 \cdot (-x)^{0.88} & x < 0 \text{ (손실)} \end{cases}$$

$$SL_{\text{adj}} = SL_{\text{base}} \times 1.12, \quad TP_{\text{adj}} = TP_{\text{base}} \times 0.89$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $v(x)$ | 가치함수 | 효용 단위 | 본 Stage |
| $\lambda = 2.25$ | 손실회피 계수 (K&T 1979) | 무차원 | 본 Stage |
| $\delta = 0.25$ | KRX 보호 계수 (가격제한폭+T+2) | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{SL_{\text{base}}}$ | 기본 손절매 수준 | KRW | **Stage 1** |
| $\textcolor{stageOneMarker}{TP_{\text{base}}}$ | 기본 목표가 수준 | KRW | **Stage 1** |

유도: $SL_{\text{adj}} = SL_{\text{base}} \times (1 + \delta(\sqrt{\lambda} - 1))$,
$\lambda=2.25$: $1 + 0.25(1.50-1) = 1.125 \approx 1.12$.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 손실회피 SL 확대 | `PROSPECT_STOP_WIDEN = 1.12` | 손절매 12% 확대 |
| 이익 TP 압축 | `PROSPECT_TARGET_COMPRESS = 0.89` | 목표가 11% 압축 |

\newpage

### 2.7.2 처분효과 (Disposition Effect)

**개요**

Shefrin and Statman (1985)가 문서화한 처분효과는 투자자가 수익 포지션을
조기 매도하고 손실 포지션을 과도하게 보유하는 체계적 경향이다. 이는
전망이론 가치함수의 형상에서 직접 귀결되며, 52주 신고가/신저가
지지저항 수준과 연결된다.

**핵심 공식**

PGR (실현 이익 비율) > PLR (실현 손실 비율) — Odean (1998) 10,000 계좌 확인.

George and Hwang (2004): 52주 신고가 근접성이 모멘텀 수익률의 70% 설명.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 매입가 앵커링 | 지지/저항 수준 | 52주 신고가 기반 모멘텀 |
| 처분효과 비대칭 | 매도 패턴 > 매수 패턴 승률 | KRX 경험적 발견 |

\newpage

### 2.7.3 군집행동과 정보폭포 (Herding & Information Cascades)

**개요**

Banerjee (1992)와 Bikhchandani, Hirshleifer, Welch (1992)의 정보 폭포 이론은
개인이 사적 정보를 합리적으로 무시하고 선행자의 행동을 따르는 메커니즘을
설명한다. CSAD 감소는 군집행동의 경험적 지문이다.

**핵심 공식**

$$CSAD_t = \frac{1}{N} \sum_{i=1}^{N} |R_{i,t} - R_{m,t}|$$

군집 검정: $CSAD_t = \gamma_0 + \gamma_1|R_{m,t}| + \gamma_2 R_{m,t}^2$, $\gamma_2 < 0$ 유의 시 군집 존재.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $CSAD_t$ | 횡단면 절대 편차 | % | 본 Stage |
| $R_{i,t}$ | 종목 $i$의 수익률 | % | 본 Stage |
| $R_{m,t}$ | 시장 수익률 | % | 본 Stage |
| $\gamma_2$ | 군집 계수 (음이면 군집) | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{R_{i,t}, R_{m,t}}$ | Stage 1 수익률 데이터 | % | **Stage 1** |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| CSAD 군집 감지 | `signalEngine` | 극단 군중 → 역발상 신호 |

\newpage

### 2.7.4 인지 편향: 앵커링, 과잉확신 (Cognitive Biases)

**개요**

Tversky and Kahneman (1974)의 앵커링, Daniel et al. (1998)의 과잉확신,
대표성 편향은 기술적 분석 패턴의 자기실현적 특성과 평균회귀 패턴의
이론적 근거를 제공한다.

- **앵커링**: 현저한 가격 수준에 앵커링 → 자기실현적 지지/저항
- **과잉확신**: 과잉반응 후 반전 → 이중천장, 머리어깨 패턴
- **대표성**: 원형 유사성 기반 판단 → 반예측기 게이트 필요

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 앵커링 → 지지/저항 | `patternEngine` S/R 수준 | 정수, 52주 신고가 |
| 과잉확신 → 반전 | 평균회귀 패턴 설계 | 이중천장/머리어깨 |
| 대표성 → 반예측기 | `PATTERN_WR_KRX` 48% 임계 | 승률 미달 패턴 감액 |

\newpage

### 2.7.5 반예측기 게이트 (Anti-Predictor Gate --- BLL 1992)

**개요**

Brock, Lakonishok, and LeBaron (1992)는 26개 기술적 매매 규칙의 통계적 유의성을
검증하였다. CheeseStock는 BLL 논리를 역으로 적용하여, KRX 5년 경험적 승률이
48% 미만인 패턴의 복합 신뢰도를 감액한다.

임계값: 48% (동전 던지기 50% - 거래비용 2pp).
KRX 발견: 매도 패턴(55~74.7%) > 매수 패턴(39~62%) — 손실회피와 부합.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| BLL 반예측기 | `PATTERN_WR_KRX` 545,307건 | WR < 48% → 신뢰도 감액 |

\newpage

### 2.7.6 베타-이항 사후 승률 (Beta-Binomial Posterior)

**개요**

소표본 패턴 승률의 과대/과소 추정을 교정하기 위해 경험적 베이즈 축소
(Efron-Morris, 1975)를 적용한다.

**핵심 공식**

$$\theta_{\text{post}} = \frac{n \cdot \theta_{\text{raw}} + N_0 \cdot \mu_{\text{grand}}}{n + N_0}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\theta_{\text{raw}}$ | 원시 승률 | 무차원 | 본 Stage |
| $N_0 = 35$ | 축소 강도 (경험적 베이즈 최적) | 건수 | 본 Stage |
| $\mu_{\text{grand}}$ | 범주별 총평균 (캔들 ~43%, 차트 ~45%) | 무차원 | 본 Stage |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 베타-이항 축소 | `PATTERN_WIN_RATES_SHRUNK` | 소표본 승률 안정화 |

\newpage

### 2.7.7 행동재무학 도출 요약 (Behavioral Finance Summary)

| 학술 개념 | 핵심 수식 | 적용 영역 |
|-----------|-----------|-----------|
| 전망이론 | $v(x) = x^{0.88}$ (이득), $-2.25(-x)^{0.88}$ (손실) | 손절/목표 비대칭 |
| 처분효과 | Shefrin-Statman (1985) PGR > PLR | 매입가 앵커링 |
| 과잉확신 | Daniel et al. (1998) | 과잉반응 → 평균회귀 |
| 정보 폭포 | BHW (1992) 순차적 모방 | 군중 행동 감지 |
| 반예측기 게이트 | BLL (1992) 승률 임계 48% | WR < 48% → 감액 |
| 손실회피 $\lambda$ | K&T (1979), $\lambda=2.25$ | 손절매 확대 |
| 앵커링 편향 | Tversky-Kahneman (1974) | 지지/저항 수준 |
| CSAD 군집 | Chang et al. (2000) $\gamma_2 < 0$ | 극단 군중 → 역발상 |
| 베타-이항 사후 | $\theta_{post} = (n\theta_{raw}+N_0\mu)/(n+N_0)$ | 승률 축소 |

---

\newpage

## 부록 2.A: 학문 의존성 구조

```text
                     [L0]
                   물리학 (2.1)
                     |
              통계역학, 멱법칙, SOC
                     |
         +-----------+-----------+
         |                       |
       [L1]                    [L1]
     수학 (2.2)              물리 응용
         |                       |
    확률과정, 이토                |
    프랙탈, 선형대수              |
         |                       |
       [L2]                      |
     통계학 (2.3)                |
         |                       |
    GARCH, EVT, HMM              |
    WLS, Ridge, HAR-RV           |
         |                       |
         +-------+-------+-------+-------+
         |       |       |       |       |
       [L3]    [L3]    [L3]    [L3]    [L3]
     경제학   경영학   금융학   심리학  미시구조
     (2.5)   (2.4)   (2.6)   (2.7)  (금융 2.6)
         |       |       |
    IS-LM    DCF/MM   CAPM계보
    Taylor   WACC     BSM/Greeks
    MF/ADAS  EVA/Kelly 채권/신용
    MCS/HMM  대리인    SDF통합
         |       |       |
         +-------+-------+
                 |
                 v
    +----------------------------------------------+
    |  제3장: 기술적 분석 구현                       |
    |  패턴 + 신호 + 신뢰도 + 백테스트              |
    +----------------------------------------------+
```

[^phys-1]: 학문 계층 L0. 통계역학, 멱법칙, 자기조직 임계성. 모든 확률 모형의 분포적 전제.
[^math-1]: 학문 계층 L1. 확률과정, 이토 해석학, 프랙탈 기하, 선형대수. 모든 금융 모형의 형식 언어.
[^stat-1]: 학문 계층 L2. GARCH, EVT, HMM, WLS, HAR-RV. 시계열 분석과 강건 추정의 도구 계층.
[^biz-1]: 학문 계층 L3. 기업재무, DCF, 자본구조, EVA, 포지션 사이징. 금융학(2.6절)과 쌍방향 의존: CAPM ↔ WACC.
[^econ-1]: 학문 계층 L3. 거시경제학, 미시경제학, 섹터 회전, 환율, 재정.
[^fin-1]: 학문 계층 L3. 자산가격결정, 채권, 파생상품, 시장미시구조, 신용위험. SDF가 통합 프레임워크.
[^behav-1]: 학문 계층 L3. 전망이론, 처분효과, 군집행동, 인지 편향. 시장 비효율성의 행동적 원천.

*판본: V8 (2026-04-10) | 제2장 | 7개 학문 67 시트*