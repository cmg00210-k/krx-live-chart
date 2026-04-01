# 03. 경제물리학 — Econophysics

> 물리학의 방법론을 금융 시장에 적용하는 학제간 분야.
> 통계역학, 멱법칙, 임계현상 등이 시장 행동을 설명한다.

---

## 1. 경제물리학의 탄생

### 1.1 기원과 주요 학자

경제물리학(Econophysics)이라는 용어:
H. Eugene Stanley (Boston University), 1995년 콜카타 학회에서 최초 사용

선구자:
- **Benoit Mandelbrot** (1963): 면화 가격의 안정 파레토 분포 발견
  - *The Variation of Certain Speculative Prices*, Journal of Business
- **Fischer Black** (MIT/Goldman Sachs): 변동성 미소(volatility smile) 연구
- **Per Bak** (1987): 자기조직 임계성(SOC) 이론
- **Didier Sornette** (ETH Zürich): 금융 붕괴의 로그주기 멱법칙

핵심 텍스트:
- Mantegna & Stanley, *An Introduction to Econophysics* (2000)
- Bouchaud & Potters, *Theory of Financial Risk and Derivative Pricing* (2003)
- Sornette, *Why Stock Markets Crash* (2003)

---

## 2. 통계역학과 시장 (Statistical Mechanics)

### 2.1 볼츠만 분포와 자산 분배

```
P(E) = (1/Z) · e^(-E/kT)

Z = Σ e^(-Eᵢ/kT)  (분배 함수)
```

금융 유추:
- E (에너지) → 자산 수준 또는 가격 변동 크기
- T (온도) → 시장 변동성
- Z (분배 함수) → 시장 전체의 정규화 상수

"시장 온도" 개념:
- 높은 변동성 = 높은 온도 = 무질서 (랜덤한 움직임)
- 낮은 변동성 = 낮은 온도 = 질서 (추세 형성)

### 2.2 이징 모형 (Ising Model)과 시장 참여자

Ernst Ising (1925), 원래 자성체 물리학

```
해밀토니안: H = -J Σ sᵢsⱼ - h Σ sᵢ

sᵢ = +1 (매수) 또는 -1 (매도)
J = 참여자 간 상호작용 강도
h = 외부 뉴스/정보의 영향
```

금융 해석:
- J > 0: 군중 행동 (herding) → 추세 형성
- J < 0: 역행 투자 (contrarian) → 평균 회귀
- J > Jc (임계값): 자발적 자화 = 시장 붕괴 또는 버블

※ KRX 적용 한계: KRX의 ±30% 가격제한폭은 극단적 꼬리 사건을 절단(truncation)하므로,
  Ising/percolation 임계 지수(critical exponents)를 KRX 데이터에 직접 적용하려면
  검열 조정(censoring adjustment)이 필요하다. 미조정 시 임계 지수를 과소 추정할 수 있다.

Bornholdt (2001), *Expectation Bubbles in a Spin Model of Markets*
→ 이징 모형으로 버블과 붕괴를 시뮬레이션

### 2.3 에이전트 기반 모형 (Agent-Based Models)

Santa Fe Institute의 인공 주식시장 (Arthur et al., 1997):
- 이질적 에이전트 (기술적 트레이더, 가치 투자자, 노이즈 트레이더)
- 적응적 학습 (유전 알고리즘, 강화학습)
- 창발적 현상: 버블, 붕괴, 변동성 군집 등이 자연 발생

LeBaron (2006), *Agent-based Computational Finance* 종합 서베이

---

## 3. 멱법칙 (Power Laws)

### 3.1 멱법칙 분포

```
P(x) ~ x^(-α)    (x > xₘᵢₙ)

또는 로그-로그 플롯에서 직선:
log P(x) = -α · log x + C
```

※ 멱법칙 검증 주의: 시각적 로그-로그 직선성만으로는 멱법칙을 확인할 수 없다.
  Clauset, Shalizi & Newman (2009), "Power-Law Distributions in Empirical Data",
  SIAM Review — KS 검정 + MLE + 우도비 검정을 통한 정식 검증이 필요하다.

금융 시장에서의 멱법칙:
1. **수익률 분포의 꼬리**: α ≈ 3 (inverse cubic law)
   - Gopikrishnan et al. (1999), *Scaling of the Distribution of
     Fluctuations of Financial Market Indices*, Physical Review E
   - 모든 선진국 시장에서 보편적으로 관찰

2. **거래량**: P(V > v) ~ v^(-α), α ≈ 1.5
3. **변동성 군집 지속시간**: 멱법칙 감쇠
4. **기업 규모 (시가총액)**: Zipf 법칙에 근사

### 3.2 자기유사성과 스케일링

```
X(ct) ≡ c^H · X(t)    (분포 의미에서)

H = 허스트 지수 (프랙탈 스케일링)

※ H = 1/α 관계의 범위: Lévy stable 과정에서는 H = 1/α가 성립하나,
  일반적인 확률 과정에서 H와 α의 관계는 보다 복잡하다.
  (Samorodnitsky & Taqqu, 1994, *Stable Non-Gaussian Random Processes*)
```

시간 스케일을 변경해도 통계적 구조가 보존됨:
- 1분봉의 수익률 분포 형태 ≈ 일봉의 수익률 분포 형태
- 이것이 기술적 분석이 모든 타임프레임에서 작동하는 근거

---

## 4. 임계현상과 상전이 (Critical Phenomena & Phase Transitions)

### 4.1 시장의 상전이

물리학의 상전이:
- 물 → 얼음 (1차 상전이)
- 강자성 → 상자성 (2차 상전이)

시장의 상전이:
- 안정 → 버블 → 붕괴
- 추세 → 횡보 → 반전

임계점 부근의 특성:
```
상관거리: ξ ~ |T - Tc|^(-ν)   (발산)
감수율:   χ ~ |T - Tc|^(-γ)   (발산)
```

금융 해석:
- 시장이 임계점에 접근하면 종목 간 상관관계가 급증
- 변동성이 발산하며 극단적 사건 빈도 증가
- 적삼병/흑삼병 같은 패턴이 이 전이 구간에서 출현

### 4.2 자기조직 임계성 (Self-Organized Criticality, SOC)

Per Bak, Chao Tang, Kurt Wiesenfeld (1987), BTW 모래더미 모형

```
시스템이 자연적으로 임계 상태로 진화하며,
외부 매개변수 조절 없이 멱법칙 분포와 눈사태(avalanche)를 생성.
```

금융 적용:
- 시장은 자연적으로 임계 상태를 유지
- 작은 뉴스가 큰 가격 변동(눈사태)을 유발할 수 있음
- 급등/급락의 크기 분포가 멱법칙을 따름

### 4.3 로그주기 멱법칙 (Log-Periodic Power Law, LPPL)

Didier Sornette, ETH Zürich

```
ln p(t) = A + B(tc - t)^m + C(tc - t)^m · cos(ω·ln(tc - t) + φ)

tc: 붕괴 임계 시점
m: 멱법칙 지수 (0 < m < 1)
ω: 로그주기 주파수
```

금융 적용: 버블 붕괴 시점을 사전 예측하는 모형.
가격이 멱법칙적으로 가속 상승하면서 로그주기 진동을 보이면
임계 시점 tc 근처에서 붕괴.

Sornette & Johansen (1997), *Large Financial Crashes*,
Physica A — 1929년, 1987년, 1997년 붕괴 예측 사후 분석

※ LPPL 예측력에 대한 학술적 논쟁:
  지지: Sornette & Johansen (1997, 2001) — 사후적으로 주요 붕괴 설명
  비판: Bree & Joseph (2013) — 사전 예측 정확도 ~30%, 높은 거짓 양성률
        Fantazzini (2016) — "tc 추정의 불안정성이 실시간 예측을 무의미하게 만듦"

  실전 주의사항:
  - 과거 데이터 피팅은 용이 (과적합 위험)
  - 실시간 tc 추정은 매우 불안정 (신뢰구간 ±수개월)
  - 보조 지표로만 사용, 단독 매매 시그널로 부적합

---

## 5. 엔트로피와 정보물리학

### 5.1 Tsallis 엔트로피 (비가법적 엔트로피)

Constantino Tsallis (1988), 브라질 물리학자

```
Sq = (1 - Σ pᵢ^q) / (q - 1)

q = 1: 볼츠만-깁스-섀넌 엔트로피로 수렴
q ≠ 1: 멱법칙 꼬리를 자연스럽게 생성
```

금융 적용:
- q-가우시안 분포가 금융 수익률 분포를 잘 피팅
- Borland (2002), *A Theory of Non-Gaussian Option Pricing*
- q ≈ 1.4~1.5에서 실제 시장 데이터와 부합

※ 에르고딕성 가정 주의: Shannon 엔트로피와 Tsallis 엔트로피 모두 앙상블 평균에 기반하나,
  금융 수익률에서는 시간 평균 ≠ 앙상블 평균일 수 있다 (비에르고딕 과정).
  Peters (2019), *Ergodicity Economics*, Nature Physics — 개별 종목, 특히 KRX 소형주에서
  에르고딕성 위배가 심각할 수 있으며, 이 경우 엔트로피 기반 측도의 해석에 주의가 필요하다.

### 5.2 전이 엔트로피 (Transfer Entropy)

```
TE(X→Y) = Σ p(yₜ₊₁, yₜ, xₜ) · log [p(yₜ₊₁|yₜ,xₜ)/p(yₜ₊₁|yₜ)]
```

인과적 정보 흐름의 방향과 크기를 측정.

금융 적용: 섹터 간 선행-후행 관계 발견.
"반도체 섹터 → 전자 섹터" 정보 흐름 = 반도체가 선행 지표.

Schreiber (2000), *Measuring Information Transfer*, Physical Review Letters

---

## 6. 네트워크 물리학과 금융

### 6.1 금융 네트워크

```
상관행렬: Cᵢⱼ = Corr(rᵢ, rⱼ)
거리 행렬: dᵢⱼ = √(2(1 - Cᵢⱼ))
최소 신장 트리 (MST): Prim/Kruskal 알고리즘으로 구축
```

Mantegna (1999), *Hierarchical Structure in Financial Markets*

금융 적용:
- KOSPI 종목들의 상관관계 네트워크 구축
- 허브(hub) 종목 = 시장 전체에 영향력이 큰 종목
- 위기 시 네트워크 구조 변화 = 조기 경보 신호

### 6.2 스몰 월드 네트워크

Watts & Strogatz (1998), *Collective Dynamics of Small-World Networks*

금융 시장은 소수의 허브(대형주)가 다수의 소형주와 연결된
스케일-프리 네트워크 구조.
삼성전자의 가격 변동이 수많은 관련주에 전파되는 구조.

---

## 7. 복잡계 이론 요약

### 시장 = 복잡 적응 시스템 (Complex Adaptive System)

John Holland, *Hidden Order: How Adaptation Builds Complexity* (1995)

특성:
1. **다수의 상호작용 에이전트** (투자자, 알고리즘, 기관)
2. **비선형 피드백** (가격 변동 → 심리 변화 → 행동 변화 → 가격 변동)
3. **창발** (개별 행동의 합이 예측 불가능한 집단 패턴 생성)
4. **적응** (시장 참여자가 학습하고 전략을 변경)
5. **멱법칙 분포** (극단적 사건의 빈번한 발생)

기술적 분석은 이 복잡 시스템의 창발적 패턴을 탐지하는 도구이다.

---

## 8. vw = 1/sqrt(ATR14/ATR50) 반증 기록

### 8.1 원래 의도와 이론적 배경

vw(변동성 가중치)는 "시장 온도"(§2.1) 비유에 기반한다.
단기 변동성(ATR14)과 장기 변동성(ATR50)의 비율로 변동성 레짐을 포착하여
패턴 신뢰도에 반영하고자 했다.

```
vw = clamp(1 / sqrt(ATR14 / ATR50), 0.7, 1.4)

의도:
  ATR14 < ATR50 (저변동 레짐): vw > 1 → 패턴 신뢰도 상향
  ATR14 > ATR50 (고변동 레짐): vw < 1 → 패턴 신뢰도 하향
  ATR14 = ATR50 (중립):        vw = 1 → 보정 없음
```

이론적 뿌리:
- Engle (1982), *Autoregressive Conditional Heteroskedasticity with Estimates
  of the Variance of United Kingdom Inflation*, Econometrica, 50(4), 987-1007
  -- ARCH 모형: 변동성이 과거 오차항의 크기에 의존 (변동성 클러스터링)
- Bollerslev (1986), *Generalized Autoregressive Conditional Heteroskedasticity*,
  Journal of Econometrics, 31(3), 307-327
  -- GARCH(1,1): sigma_t^2 = omega + alpha * epsilon_{t-1}^2 + beta * sigma_{t-1}^2
  -- 단기/장기 변동성 비율이 레짐 정보를 담고 있다는 실증적 근거

### 8.2 1/sqrt(x) 함수 선택의 문제

1/sqrt(x)는 경험적 선택이며, 이론적 도출이 없었다.

```
후보 함수들 비교 (x = ATR14/ATR50):
  1/x       — 과격한 역수 (x=2이면 0.5, 극단적)
  1/sqrt(x) — 중간 강도의 역수 (x=2이면 0.707)
  1/log(x)  — 완만한 역수
  exp(-x)   — 지수 감쇠
```

1/sqrt(x)를 선택한 이유는 "중간 강도"라는 직관뿐이었으며,
멱법칙 지수 -0.5의 물리학적/통계학적 최적성은 입증되지 않았다.
이는 D등급(학술 근거 없는 매직넘버)에 해당한다.

### 8.3 KRX 실증 결과 — 반증

Stage A-1 (2704종목 2026년 실증):
```
  IC(vw) = -0.083  (음의 정보계수)

  해석:
    vw를 곱하면 예측 정확도가 오히려 악화
    vw = 1 (미적용)보다 vw를 적용한 경우가 더 나쁨
    → 가설 기각: ATR14/ATR50 비율의 역제곱근은 패턴 신뢰도와 무관하거나 역방향
```

원인 분석:
- ATR14/ATR50 비율이 높은 구간(고변동 진입)에서 vw가 과도하게 감쇠시킴
- KRX 시장의 변동성 돌파(breakout) 패턴에서는 고변동 = 유효 신호인 경우가 많음
- 변동성 클러스터링 자체는 실재하나(GARCH 이론 유효),
  이를 패턴 가중치로 변환하는 함수 형태가 부적절했음

### 8.4 현재 상태

vw는 Stage A-1 상수 감사(Constant Audit)에서 **E등급 Deprecated**로 분류되었다.

- 코드에서 계산은 유지됨 (patterns.js:243), 그러나 Wc 가중합에 포함되지 않음
- ctx.volWeight에 저장되나 이후 Wc 산출 경로에서 참조되지 않음
- 제거하지 않는 이유: 차후 대안 함수(예: GARCH 기반 조건부 분산 비율) 실험을 위한 플레이스홀더

코드 매핑: `js/patterns.js:238-243` (calcATR 호출 + volWeight 계산)
엔진 적용 효과: 제외함으로써 IC +0.083 상당의 노이즈 제거, 전체 Wc 예측력 개선
