# 14. 재무관리 --- Financial Management Applied to Investment & Trading

> 재무관리는 기업과 투자자의 자금 배분, 가치평가, 위험 관리의 학문이다.
> 기술적 분석이 "언제" 매매할지를 다룬다면, 재무관리는 "얼마나" 투자하고
> "왜" 그 가격이 적정한지를 다룬다. 두 영역의 통합이 완전한 투자 체계를 형성한다.

---

## 1. 재무관리 기초 (Financial Management Foundations)

### 1.1 화폐의 시간가치 (Time Value of Money)

Irving Fisher, *The Theory of Interest* (1930)

```
현재가치 (Present Value):
PV = FV / (1 + r)^n

FV: 미래가치 (Future Value)
r: 할인율 (discount rate)
n: 기간 (periods)

직관: 오늘의 1원은 내일의 1원보다 가치가 크다.
  이유 1) 투자 기회비용
  이유 2) 인플레이션
  이유 3) 불확실성
```

금융 적용:
- 주식의 내재가치 = 미래 현금흐름의 현재가치 합
- 기술적 분석의 가격 목표(price target)도 암묵적으로 시간가치를 반영
- 장기 투자일수록 할인율의 영향이 크므로 정확한 r 추정이 핵심

### 1.2 복리와 연속복리 (Compound & Continuous Compounding)

```
이산 복리 (Discrete Compounding):
FV = PV · (1 + r/m)^(m·n)

m: 연간 복리 횟수
n: 연수

연속 복리 (Continuous Compounding):
FV = PV · e^(r·n)

lim(m→∞) (1 + r/m)^(m·n) = e^(r·n)
```

금융 적용:
- Black-Scholes 모형은 연속복리 가정을 사용
- 로그 수익률 ln(Pₜ/Pₜ₋₁)이 연속복리 수익률에 해당
- 기술적 분석에서 로그 스케일 차트를 사용하는 수학적 근거

### 1.3 순현재가치 (NPV) 규칙

```
NPV = Σₜ₌₁ⁿ CFₜ / (1 + r)^t  -  I₀

CFₜ: t기의 현금흐름
r: 할인율 (요구수익률 또는 WACC)
I₀: 초기 투자 비용

의사결정 규칙:
  NPV > 0 → 투자 실행 (가치 창출)
  NPV = 0 → 무차별
  NPV < 0 → 투자 기각 (가치 파괴)
```

금융 적용:
- 기업의 설비 투자, M&A 의사결정의 기본 도구
- 주식 투자에서: 내재가치 - 현재 시장가격 = 투자의 NPV
- 기술적 분석과의 접점: 진입 시점의 가격이 낮을수록 NPV 증가

### 1.4 내부수익률 (IRR: Internal Rate of Return)

```
IRR = NPV가 0이 되는 할인율 r*

Σₜ₌₁ⁿ CFₜ / (1 + r*)^t  =  I₀

의사결정 규칙:
  IRR > 요구수익률 → 투자 실행
  IRR < 요구수익률 → 투자 기각
```

한계점:
- 비정상 현금흐름(부호 변경)에서 복수의 IRR 존재 가능
- 상호 배타적 프로젝트에서 NPV와 상충 가능
- 재투자율 가정의 비현실성 → 수정 IRR(MIRR)로 보완

---

## 2. 기업 가치평가 (Corporate Valuation)

### 2.1 DCF 모형 (Discounted Cash Flow Model)

Aswath Damodaran, *Investment Valuation* (1995, 3rd ed. 2012)

```
기업가치 V = Σₜ₌₁ⁿ FCFₜ / (1 + WACC)^t  +  TV / (1 + WACC)^n

FCFₜ: t기의 잉여현금흐름 (Free Cash Flow)
WACC: 가중평균자본비용
TV: 터미널 밸류 (Terminal Value)
n: 명시적 예측 기간 (보통 5~10년)
```

DCF의 3대 입력 변수:
1. FCF 추정 — 미래 현금흐름 예측
2. WACC 산출 — 적절한 할인율 결정
3. TV 계산 — 예측 기간 이후의 잔여 가치

### 2.2 잉여현금흐름 추정 (FCF Estimation)

```
FCFF (Free Cash Flow to Firm):
FCFF = EBIT(1 - T) + 감가상각비 - CAPEX - ΔNWC

EBIT: 영업이익 (Earnings Before Interest and Taxes)
T: 법인세율
CAPEX: 자본적 지출 (Capital Expenditure)
ΔNWC: 순운전자본 변동 (Change in Net Working Capital)

FCFE (Free Cash Flow to Equity):
FCFE = FCFF - 이자비용(1-T) + 순차입금 변동
```

KRX 적용:
- DART(전자공시시스템)에서 재무제표 데이터 확보
- KOSPI 상장기업 평균 FCF 마진: 약 5~8%
- 성장주(바이오, IT)는 FCF가 음수일 수 있음 → 상대가치 평가로 보완

### 2.3 WACC (Weighted Average Cost of Capital)

```
WACC = E/(E+D) · Rₑ + D/(E+D) · R_d · (1 - T)

E: 자기자본의 시장가치 (시가총액)
D: 타인자본의 시장가치 (부채)
Rₑ: 자기자본비용 (CAPM으로 추정)
R_d: 타인자본비용 (차입이자율)
T: 법인세율

자기자본비용 (CAPM 적용):
Rₑ = Rf + β · (Rm - Rf)

Rf: 무위험이자율 (한국 국고채 3년 or 10년)
β: 체계적 위험 (KRX 베타)
Rm - Rf: 시장 위험 프리미엄 (한국 약 6~8%)
```

금융 적용:
- WACC이 낮을수록 기업가치 상승 (분모 효과)
- 금리 인상기: WACC 상승 → 성장주 가치 하락 → 기술적 하락 패턴과 연계
- 금리 인하기: WACC 하락 → 성장주 가치 상승 → 기술적 상승 패턴과 연계

※ 실무 주의: WACC 계산 시 시간 정합성
  - E (시가총액): 현재 시점의 시장 가치
  - D (부채 시장가치): 현재 시점 (장부가로 근사하는 경우 많음)
  - β: 과거 36~60개월 수익률로 추정 (시간 지연 존재)
  - Rf, Rm: 현재 시점 기준
  → β의 추정 기간과 현재 시장 상태가 괴리될 수 있음
  → KRX 종목의 β는 증권사 HTS에서 확인 가능 (통상 60개월 기준)

### 2.4 터미널 밸류 (Terminal Value)

#### 고든 성장 모형 (Gordon Growth Model)

Myron Gordon (1962), *The Investment, Financing, and Valuation of the Corporation*

```
TV = FCFₙ₊₁ / (WACC - g) = FCFₙ · (1 + g) / (WACC - g)

g: 영구 성장률 (perpetuity growth rate)
조건: WACC > g (수렴 조건)

일반적 가정:
  g ≤ 명목 GDP 성장률 (한국 약 3~4%)
  g가 WACC에 근접하면 TV가 급격히 증가 → 추정 민감도 증가
```

실무 주의:
- TV는 전체 기업가치의 60~80%를 차지하는 경우가 흔함
- g의 0.5%p 변화가 기업가치에 20% 이상 영향 가능
- → DCF의 본질적 한계이자 기술적 분석이 보완해야 하는 영역

#### 출구 배수법 (Exit Multiple Method)

```
TV = EBITDAₙ × 출구 배수 (Exit Multiple)

출구 배수: 업종 평균 EV/EBITDA 적용
  → 상대가치 평가와의 결합
```

### 2.5 상대가치 평가 (Relative Valuation)

```
PER (Price-to-Earnings Ratio, 주가수익비율):
PER = 주가 / 주당순이익(EPS)
    = 시가총액 / 당기순이익

PBR (Price-to-Book Ratio, 주가순자산비율):
PBR = 주가 / 주당순자산(BPS)
    = 시가총액 / 자기자본 장부가치

EV/EBITDA:
EV/EBITDA = 기업가치 / EBITDA
EV = 시가총액 + 순차입금

PSR (Price-to-Sales Ratio, 주가매출비율):
PSR = 시가총액 / 매출액
  → 적자 기업(바이오 등)에서 유용
```

### 2.6 KRX 주식의 PER/PBR 해석

```
KOSPI 역사적 밴드:
  PER: 8~15배 (평균 약 11배)
  PBR: 0.8~1.3배 (평균 약 1.0배)

저평가 시그널:
  PER < 업종 평균 × 0.7
  PBR < 1.0 (순자산 이하 거래)

고평가 시그널:
  PER > 업종 평균 × 1.5
  PBR > 3.0 (자산 대비 프리미엄)

KOSPI vs S&P 500 PER 비교:
  KOSPI 평균 PER: 약 11배 (Korea Discount)
  S&P 500 평균 PER: 약 18~20배
  → 한국 시장의 구조적 할인 = 지배구조, 지정학적 리스크
```

금융 적용:
- 상대가치가 극단적일 때 기술적 반전 패턴과 결합하면 신호 강화
- 저PBR + 이중바닥 패턴 = 강한 매수 시그널
- 고PER + 헤드앤숄더 패턴 = 강한 매도 시그널

---

## 3. 자본구조 이론 (Capital Structure Theory)

### 3.1 모딜리아니-밀러 정리 (Modigliani-Miller Theorem)

Franco Modigliani & Merton Miller (1958),
*The Cost of Capital, Corporation Finance and the Theory of Investment*,
American Economic Review
(Modigliani: 1985 노벨 경제학상, Miller: 1990 노벨 경제학상)

#### MM 제1명제 — 무세금 (MM Proposition I, No Taxes)

```
V_L = V_U

V_L: 부채를 사용하는 기업(levered firm)의 가치
V_U: 부채를 사용하지 않는 기업(unlevered firm)의 가치

→ 완전 자본시장에서 기업가치는 자본구조와 무관하다.
→ "파이를 어떻게 자르든 파이의 크기는 변하지 않는다."
```

가정 (완전 자본시장):
1. 세금 없음
2. 거래비용 없음
3. 파산비용 없음
4. 정보 대칭
5. 동일한 차입 이자율

#### MM 제2명제 — 자기자본비용 (MM Proposition II)

```
R_E = R_A + (D/E) · (R_A - R_D)

R_E: 자기자본비용 (레버리지 적용 후)
R_A: 자산수익률 (무레버리지 자본비용)
R_D: 타인자본비용 (부채 이자율)
D/E: 부채비율

→ 레버리지가 증가하면 자기자본비용이 선형적으로 증가
→ 부채의 낮은 비용 이점이 자기자본비용 상승으로 상쇄
→ WACC는 일정하게 유지
```

### 3.2 MM 정리와 세금 (MM with Taxes)

```
법인세 존재 시:

V_L = V_U + T · D

T: 법인세율
D: 부채의 시장가치
T · D: 이자비용의 세금 절감 효과 (Tax Shield)

→ 부채 사용으로 기업가치가 증가 (세금 절감 효과)
→ 극단적 결론: 100% 부채 사용이 최적 (비현실적)
```

### 3.3 상충이론 (Trade-off Theory)

```
V_L = V_U + PV(Tax Shield) - PV(Financial Distress Costs)

최적 자본구조: 세금 절감의 한계 이익 = 파산비용의 한계 비용

세금 절감 효과 (Tax Shield):
  부채 이자의 세금 공제 → 기업가치 증가

재무적 곤경 비용 (Financial Distress Costs):
  직접 비용: 법률비용, 관리비용
  간접 비용: 고객 이탈, 투자 기회 상실, 인재 유출

→ 최적 부채비율이 존재 (업종별 상이)
```

### 3.4 자본조달 서열 이론 (Pecking Order Theory)

Stewart Myers & Nicholas Majluf (1984),
*Corporate Financing and Investment Decisions When Firms Have
Information That Investors Do Not Have*, Journal of Financial Economics

```
정보 비대칭으로 인한 자본조달 우선순위:

1순위: 내부자금 (유보이익)
2순위: 부채 발행
3순위: 주식 발행 (최후 수단)

논리:
  경영자가 기업 가치를 더 잘 안다고 가정
  → 주식이 고평가될 때 주식 발행 유인 (역선택)
  → 투자자는 주식 발행을 부정적 시그널로 해석
  → 유상증자 공시 시 주가 하락 경향 (실증적 증거)
```

금융 적용:
- 유상증자 발표 → 기술적 분석에서 약세 시그널
- 자사주 매입 발표 → 강세 시그널 (경영자가 저평가 판단)
- KRX에서 유상증자 공시 후 평균 주가 하락률: 약 -5~-10%

---

## 4. 에르고딕 경제학 — Ergodicity Economics

### 4.1 에르고딕 가설의 붕괴 (Breakdown of the Ergodic Hypothesis)

Ole Peters (2019), *The Ergodicity Problem in Economics*, Nature Physics, 15, 1216-1221
— 현대 금융학의 근본 가정에 의문을 제기한 논문

**앙상블 평균(ensemble average)과 시간 평균(time average)은 같은가?**

```
에르고딕 시스템 (Ergodic system):
  앙상블 평균 = 시간 평균
  예: 이상 기체 분자의 운동 에너지

비에르고딕 시스템 (Non-ergodic system):
  앙상블 평균 ≠ 시간 평균
  예: 곱셈적(multiplicative) 과정 — 금융 수익률의 복리

금융 수익률은 곱셈적(compounding)이므로 비에르고딕이다:

앙상블 평균 (N명의 투자자, 횡단면):
  <R> = (1/N) × Σ R_i  (cross-sectional average)

시간 평균 (1명의 투자자, T기간):
  r̄ = lim(T→∞) (1/T) × Σ log(1 + r_t)  (기하 성장률)

핵심 차이:
  <R> = μ              (산술 평균)
  r̄  = μ - σ²/2        (변동성 드래그!)

→ 산술 평균이 양수여도 시간 평균은 음수일 수 있다
→ "평균적으로 이긴다"는 것이 "장기적으로 이긴다"를 의미하지 않는다
```

### 4.2 변동성 드래그 (Volatility Drag)

```
곱셈적 성장에서:

기대 최종 자산 (앙상블):
  E[W_T] = W_0 × (1 + μ)^T  (증가)

전형적 최종 자산 (시간 경로):
  W_T* = W_0 × exp((μ - σ²/2) × T)  (축소할 수 있음!)

σ²/2 = "변동성 드래그" 또는 "분산 드레인(variance drain)"
```

수치 예시:

```
사례 1 (고변동성):
  μ = 10%, σ = 40%
  r̄ = 10% - (40%)²/2 = 10% - 8% = 2%
  → 기대수익 10%이지만 전형적 성장률은 2%에 불과

사례 2 (저변동성):
  μ = 10%, σ = 20%
  r̄ = 10% - (20%)²/2 = 10% - 2% = 8%
  → 변동성이 절반이면 전형적 성장률이 4배

사례 3 (극단적 변동성):
  μ = 10%, σ = 50%
  r̄ = 10% - (50%)²/2 = 10% - 12.5% = -2.5%
  → 양의 기대수익에도 불구하고 장기적으로 파산!
```

CheeseStock 패턴 분석에의 함의:
- σ를 줄이는 패턴(정밀한 손절)은 μ가 불변이어도 r̄을 개선한다
- 위험 관리는 단순한 "보호"가 아니라 "수익 향상" 수단이다
- backtester.js의 패턴별 수익률 분석에서 산술 평균뿐 아니라 기하 평균을 함께 보아야 하는 근거

### 4.3 시간 평균 최적화와 켈리 기준 (Time-Average Optimization & Kelly)

켈리 기준(Kelly 1956)은 시간 평균 성장률을 최대화하는 **정확한 해**이다:

```
f* = argmax E[log(1 + f × r)]

이것은 r̄을 최대화하는 비율이다 — <R>을 최대화하는 것이 아니다.

두 가지 도출 경로:
  1) 정보이론적 도출 (Shannon): 채널 용량 최적화
  2) 에르고딕 도출 (Peters): 시간 평균 성장률 최대화

두 경로 모두 동일한 공식에 도달한다:
  f* = (b·p - q) / b  (이진 결과)
  f* = μ / σ²          (연속 수익률)

→ 켈리 공식의 강건성(robustness)을 확인
→ 에르고딕 경제학은 "왜 켈리가 옳은가"에 대한 근본적 설명을 제공
```

§5.1 켈리 기준과의 연결:
- §5.1의 실무적 공식 도출은 정보이론에 기반
- 본 절의 에르고딕 도출은 동일 결과에 대한 물리학적/역학적 근거
- 분할 켈리(§5.2)의 보수적 접근도 에르고딕 관점에서 정당화됨:
  추정 오차가 있을 때 과대 투자(over-Kelly)의 파괴적 결과를 회피

### 4.4 포트폴리오 레버리지와 에르고딕 파산 (Leverage & Ergodic Ruin)

```
레버리지 L을 적용한 시간 평균 성장률:

  r̄_leveraged = L × μ - (L² × σ²) / 2

최적 레버리지:
  L* = μ / σ²  (켈리 비율과 동일)

과대 레버리지 (L > 2L*):
  → 유한 시간 내 확실한 파산 (ergodic ruin)
  → 앙상블 평균으로는 수익이 나지만, 시간 경로에서는 파멸
```

KRX 적용 (20_krx_structural_anomalies.md §5 연결):

```
KOSDAQ 주식 (고변동성):
  σ ≈ 40-60% → L* ≈ μ/σ² ≈ 0.5-1.0
  → 분할 켈리(fractional Kelly) 권장
  → 레버리지 사용 시 극도의 주의 필요

KOSPI 대형주 (저변동성):
  σ ≈ 20-30% → L* ≈ μ/σ² ≈ 1.0-2.0
  → 풀 켈리 또는 소폭 레버리지 가능

실무 가이드:
  L = 0.5 × L*가 변동성 대비 최적 균형 (Half-Kelly 레버리지)
  L > L*는 성장률이 감소하기 시작
  L > 2L*는 장기적으로 확실한 파산
```

### 4.5 비에르고딕 세계의 의사결정 (Decision-Making in Non-Ergodic World)

기대효용이론(von Neumann-Morgenstern)은 앙상블 평균이 중요하다고 가정한다.
에르고딕 경제학은 시간 평균이 중요하다고 주장한다.

```
화해(Reconciliation):

  로그 효용 U(W) = log(W)를 사용하면
  기대효용 최대화 = 시간 평균 성장률 최대화

  → 로그 효용이 "특별한" 이유:
    에르고딕성을 존중하는(ergodicity-respecting) 유일한 효용 함수

  Bernoulli (1738)의 직관:
    "효용은 부의 로그에 비례한다"
    → 에르고딕 경제학은 이 직관에 300년 만의 역학적 근거를 제공
```

전망이론(Prospect Theory)과의 연결 (04_psychology.md):

```
전망이론의 손실 회피 (λ ≈ 2.25):
  "비합리적" 편향으로 간주되어 왔으나...

에르고딕 관점에서의 재해석:
  큰 손실 회피 = 기하 성장 경로의 보존
  → 50% 손실은 복구에 100% 수익이 필요 (비대칭!)
  → 손실 회피는 비에르고딕 세계에서 "합리적"일 수 있음

  Peters & Gell-Mann (2016):
    행동경제학의 "비합리적" 편향 다수가
    에르고딕 관점에서는 최적(ergodically optimal)일 수 있음
```

교차 참조:
- 본 문서 §5: 켈리 기준의 실무적 공식 도출
- 04_psychology.md: 전망이론 — 에르고딕 합리성으로서의 손실 회피
- 12_extreme_value_theory.md: 꼬리 위험 — 에르고딕 파산 위험
- 20_krx_structural_anomalies.md §5: KOSDAQ 고변동성의 레버리지 함의
- 25_capm_delta_covariance.md: 포트폴리오 수준의 위험 분해

참고문헌:
- Peters, O. (2019), *The Ergodicity Problem in Economics*, Nature Physics, 15, 1216-1221
- Peters, O. & Gell-Mann, M. (2016), *Evaluating Gambles Using Dynamics*, Chaos, 26, 023103
- Kelly, J.L. (1956), *A New Interpretation of Information Rate*, Bell System Technical Journal, 35(4), 917-926
- Bernoulli, D. (1738/1954), *Exposition of a New Theory on the Measurement of Risk*, Econometrica, 22(1), 23-36

---

## 5. 자금 관리와 포지션 사이징 (Money Management & Position Sizing)

### 5.1 켈리 기준 (Kelly Criterion)

John L. Kelly Jr. (1956),
*A New Interpretation of Information Rate*, Bell System Technical Journal

```
f* = (b·p - q) / b = edge / odds

f*: 최적 투자 비율 (자본 대비)
b: 순 배당률 (odds) — 이기면 b원 획득
p: 승률 (winning probability)
q: 패률 (q = 1 - p)

edge = b·p - q (기대 이익)
odds = b (배당률)

예시:
  승률 p = 0.55, 손익비 b = 2
  f* = (2 × 0.55 - 0.45) / 2 = 0.65/2 = 0.325
  → 자본의 32.5%를 투자
```

**연속 수익률 Kelly (주식 시장 적용)**:

이진 결과(승/패)가 아닌 연속 수익률 분포에 대한 Kelly:

```
f* = μ / σ²

μ: 기대 초과수익률 (E[R] - Rf)
σ²: 수익률의 분산

예시:
  일간 기대 초과수익률 μ = 0.05% (연 12.6%)
  일간 변동성 σ = 2% (연 31.7%)
  f* = 0.0005 / 0.0004 = 1.25 → 레버리지 1.25배

※ 주의: 이진 Kelly와 연속 Kelly의 차이
  - 이진 Kelly: 도박, 고정 배당 상황에 적합
  - 연속 Kelly: 주식, 연속 수익률 분포에 적합
  - 실전에서는 Half-Kelly (f*/2)가 표준 (추정 오차 반영)
```

수학적 근거 (기하 성장률 최대화):

```
G = p · ln(1 + f·b) + q · ln(1 - f)

dG/df = 0  →  f* = (b·p - q) / b

G(f*) = p · ln(1 + f*·b) + q · ln(1 - f*)
```

Kelly의 핵심 통찰:
- 산술 평균이 아닌 **기하 평균**을 최대화
- 복리 효과 하에서 장기 자산 성장을 극대화하는 유일한 비율
- 과소 투자 → 느린 성장, 과대 투자 → 파산 위험 증가

### 5.2 분할 켈리 (Fractional Kelly)

Edward O. Thorp, *The Kelly Criterion in Blackjack, Sports Betting, and the
Stock Market* (2006)

```
실무 적용 비율:
  풀 켈리 (Full Kelly): f* → 기하 성장률 최대화, 변동성 극대
  하프 켈리 (Half Kelly): f*/2 → 성장률 75% 유지, 변동성 50% 감소
  쿼터 켈리 (Quarter Kelly): f*/4 → 성장률 약 44% 유지, 변동성 대폭 감소

풀 켈리의 문제:
  - 기대 최대 낙폭(MDD)이 매우 큼
  - 매개변수 추정 오류에 극도로 민감
  - 연속적 손실 시 심리적 압박

하프 켈리의 장점:
  - 성장률 = 풀 켈리의 75%
  - 분산 = 풀 켈리의 25% (= 변동성 50%)
  - 실전에서 가장 널리 사용되는 비율

일반적 권장: 0.2f* ~ 0.5f* (켈리의 20~50%)
```

### 5.3 고정 비율 포지션 사이징 (Fixed Fractional Position Sizing)

Ralph Vince, *Portfolio Management Formulas* (1990)

```
포지션 크기 = (계좌 잔고 × 위험 비율) / 거래당 최대 손실

예시:
  계좌: 1,000만원
  위험 비율: 2% (거래당 최대 손실 비율)
  손절 폭: 5%

  포지션 크기 = (10,000,000 × 0.02) / 0.05
             = 200,000 / 0.05
             = 4,000,000원 (계좌의 40%)

위험 비율 가이드라인:
  보수적: 0.5~1.0%
  중간: 1.0~2.0%
  공격적: 2.0~5.0%
  프로 트레이더 다수: 1~2%
```

### 5.4 파산 리스크 (Risk of Ruin)

```
파산 확률 (간이 공식):
R = ((1 - edge) / (1 + edge))^(capital_units)

edge = p·(W/L) - q  (기대 수익률)
W/L: 평균 이익 / 평균 손실 비율
capital_units: 최대 손실 단위 수 (자본 / 거래당 위험)

더 정밀한 공식:
R = [(q/p)^(n) - (q/p)^(N)] / [1 - (q/p)^(N)]

n: 현재 자본 단위
N: 목표 자본 단위

파산 확률 ≤ 1%를 유지하는 것이 전문 트레이더의 기준
```

### 5.5 최대 낙폭 제약 (Maximum Drawdown Constraints)

```
MDD 목표: 최대 허용 낙폭을 사전에 설정

일반적 기준:
  개인 투자자: MDD ≤ 20%
  헤지펀드: MDD ≤ 10~15%
  시스템 트레이딩: MDD ≤ 25%

MDD 기반 포지션 조정:
  현재 낙폭이 MDD 한계의 50% 도달 → 포지션 50% 축소
  현재 낙폭이 MDD 한계의 75% 도달 → 포지션 75% 축소
  현재 낙폭이 MDD 한계에 도달 → 전량 청산 후 재평가
```

---

## 6. 위험 관리 체계 (Risk Management Framework)

### 6.1 전사적 위험관리 (Enterprise Risk Management, ERM)

COSO ERM Framework (2004, 2017 개정)

```
위험 유형 분류:

시장 위험 (Market Risk):
  - 가격 위험: 주가, 금리, 환율, 원자재 가격 변동
  - 변동성 위험: 내재변동성 변화
  - 상관관계 위험: 자산 간 상관관계 구조 변화

신용 위험 (Credit Risk):
  - 거래상대방 부도 위험
  - 회사채 스프레드 변동
  - KRX 결제 위험 (T+2 결제)

운영 위험 (Operational Risk):
  - 시스템 장애, 인적 오류
  - 알고리즘 오류 (fat finger, flash crash)
  - 법적/규제 위험

유동성 위험 (Liquidity Risk):
  - 시장 유동성: 매도 시 가격 충격
  - 자금 유동성: 마진콜 대응 능력
  - KRX 소형주의 유동성 프리미엄
```

### 6.2 VaR 한도와 포지션 한도 (VaR Limits & Position Limits)

```
VaR 기반 위험 관리:

일일 VaR 한도:
  전체 포트폴리오 VaR₉₅% ≤ 자본의 X%
  개별 전략 VaR₉₅% ≤ 배분 자본의 Y%

포지션 한도 설정:
  종목당 한도: 포트폴리오의 최대 10~20%
  섹터당 한도: 포트폴리오의 최대 30~40%
  방향성 한도: 순 롱/숏 비율 관리

한도 위반 시 프로토콜:
  Level 1 (경고): 한도의 80% 도달 → 신규 포지션 제한
  Level 2 (주의): 한도의 100% 도달 → 포지션 축소 시작
  Level 3 (위기): 한도의 120% 초과 → 강제 청산
```

### 6.3 스트레스 테스트와 시나리오 분석

```
역사적 시나리오:
  1997 외환위기: KOSPI -72% (고점 대비)
  2000 IT 버블: KOSDAQ -88%
  2008 금융위기: KOSPI -55%
  2020 COVID: KOSPI -35% (1개월 내)

가상 시나리오 설계:
  금리 충격: +200bp 일시 상승
  환율 충격: USD/KRW +20% 급등
  변동성 충격: VIX 2배 증가
  유동성 위기: 매수호가 90% 소멸

스트레스 VaR:
  위기 기간의 시장 데이터를 적용한 VaR 재계산
  바젤 III 기준: 250거래일 중 최악의 시나리오
```

### 6.4 위험 예산 배분 (Risk Budgeting)

```
위험 기여도 (Risk Contribution):

RC_i = w_i · ∂σₚ/∂w_i

Σ RC_i = σₚ (포트폴리오 총 위험)

위험 균등 배분 (Risk Parity):
  RC₁ = RC₂ = ... = RCₙ = σₚ/n
  → 각 자산이 동일한 위험을 기여

Ray Dalio, Bridgewater All-Weather Fund:
  위험 균형 전략의 대표적 사례
```

전략별 위험 예산 배분 예시:
```
총 위험 예산: VaR₉₅% = 자본의 5%
  추세 추종 전략: 40% (VaR 2.0%)
  평균 회귀 전략: 30% (VaR 1.5%)
  이벤트 드리븐: 20% (VaR 1.0%)
  현금 보유: 10% (VaR 0.5%)
```

---

## 7. 성과 측정 (Performance Measurement)

### 7.1 샤프 비율 (Sharpe Ratio)

William Sharpe (1966), *Mutual Fund Performance*,
Journal of Business (1990 노벨 경제학상)

```
SR = (Rₚ - Rf) / σₚ

Rₚ: 포트폴리오 수익률
Rf: 무위험 수익률
σₚ: 포트폴리오 수익률의 표준편차

해석 기준:
  SR < 0: 무위험 자산보다 열등
  0 < SR < 1: 양호
  1 < SR < 2: 우수
  2 < SR < 3: 매우 우수 (탑 헤지펀드 수준)
  SR > 3: 의심스러울 정도로 높음 (데이터 오류 또는 사기 의심)

연간화: SR_annual = SR_daily × √252
  (252 = 연간 거래일수)
```

※ 주의: √252 스케일링은 수익률이 i.i.d.(독립동일분포)일 때만 정확.
  자기상관이 존재하면 보정 필요:
  SR_annual = SR_daily × √(252 · (1 + 2·Σₖ₌₁ᴷ ρₖ))

  양의 자기상관 (모멘텀): 실제 연환산 SR > √252 보정 SR
  음의 자기상관 (평균회귀): 실제 연환산 SR < √252 보정 SR
  → √252 단순 스케일링은 SR을 10~30% 과대/과소추정 가능

샤프 비율의 한계:
- 상승 변동성과 하락 변동성을 동일하게 취급
- 정규분포를 가정 (실제 수익률은 비대칭, 첨도 존재)
- 레버리지에 의해 조작 가능

### 7.2 소르티노 비율 (Sortino Ratio)

Frank Sortino & Robert van der Meer (1991),
*Downside Risk*, Journal of Portfolio Management

```
Sortino Ratio = (Rₚ - Rf) / σ_downside

σ_downside = √[Σ min(Rₜ - MAR, 0)² / n]

MAR: Minimum Acceptable Return (보통 Rf 또는 0)

→ 하방 변동성만 위험으로 측정
→ 투자자의 실제 위험 인식에 더 부합
```

### 7.3 정보 비율 (Information Ratio)

```
IR = α / σ(α)

α: 벤치마크 대비 초과 수익 (Jensen's Alpha)
σ(α): 추적 오차 (Tracking Error)

해석:
  IR > 0.5: 우수한 액티브 운용
  IR > 1.0: 최상위 수준

펀더멘탈 법칙 (Fundamental Law of Active Management):
  Grinold (1989):
  IR ≈ IC × √BR

  IC: Information Coefficient (예측 능력, 상관계수)
  BR: Breadth (독립적인 투자 결정 횟수)
  → 높은 IR = 높은 예측력 × 많은 독립적 기회
```

### 7.4 칼마 비율 (Calmar Ratio)

Terry W. Young (1991), *Calmar Ratio: A Smoother Tool*

```
Calmar Ratio = 연간 수익률 / |최대 낙폭(MDD)|

예시:
  연간 수익률: 25%
  MDD: -15%
  Calmar = 25/15 ≈ 1.67

해석:
  Calmar > 1: 양호
  Calmar > 2: 우수
  Calmar > 3: 매우 우수
```

트레이더에게 가장 직관적인 지표:
"1%의 최대 고통(drawdown)당 몇 %의 수익을 얻는가"

### 7.5 트레이너 비율 (Treynor Ratio)

Jack Treynor (1965), *How to Rate Management of Investment Funds*,
Harvard Business Review

```
Treynor Ratio = (Rₚ - Rf) / βₚ

βₚ: 포트폴리오 베타 (시장 위험에 대한 민감도)

→ 체계적 위험(β) 단위당 초과 수익
→ 잘 분산된 포트폴리오에서 적합
→ 비체계적 위험이 크면 샤프 비율과 괴리
```

### 7.6 성과 귀인 분석 (Performance Attribution — Brinson Model)

Gary Brinson, L. Randolph Hood & Gilbert Beebower (1986),
*Determinants of Portfolio Performance*, Financial Analysts Journal

```
초과 수익 분해:

총 초과수익 = 배분 효과 + 선택 효과 + 상호작용 효과

배분 효과 (Allocation Effect):
  AA = Σᵢ (wₚᵢ - wᵦᵢ) · (Rᵦᵢ - Rᵦ)
  → 섹터/자산 배분의 기여

선택 효과 (Selection Effect):
  SS = Σᵢ wᵦᵢ · (Rₚᵢ - Rᵦᵢ)
  → 종목 선택의 기여

상호작용 효과 (Interaction Effect):
  INT = Σᵢ (wₚᵢ - wᵦᵢ) · (Rₚᵢ - Rᵦᵢ)

wₚᵢ: 포트폴리오의 섹터 i 비중
wᵦᵢ: 벤치마크의 섹터 i 비중
Rₚᵢ: 포트폴리오의 섹터 i 수익률
Rᵦᵢ: 벤치마크의 섹터 i 수익률
```

금융 적용:
- 기술적 분석 전략의 초과수익이 타이밍에서 오는지, 종목 선택에서 오는지 분해
- 추세 추종 전략: 주로 배분 효과(시장 노출 조절)에서 초과수익
- 패턴 매매 전략: 주로 선택 효과(종목 선별)에서 초과수익

---

## 8. 기술적 분석과의 연결 (Connection to Technical Analysis)

### 8.1 DCF 가치평가 vs 기술적 가격 목표

```
펀더멘탈 가격 목표:
  V_intrinsic = Σ FCFₜ/(1+WACC)^t + TV/(1+WACC)^n
  → 내재가치에서 목표가 도출

기술적 가격 목표:
  피보나치 확장: 전 파동의 61.8%, 100%, 161.8% 확장
  이중바닥 측정치: 저점에서 네크라인까지 높이만큼 상승 목표
  추세선 투사: 기존 채널의 연장

통합 접근법:
  1) DCF로 내재가치 범위 설정 (예: 50,000~65,000원)
  2) 기술적 목표가와 비교 (예: 피보나치 61.8% = 58,000원)
  3) 두 목표가가 수렴하는 영역 = 높은 확신의 목표가
  4) 괴리가 크면 → 추가 분석 필요
```

### 8.2 켈리 기준과 패턴 승률의 결합

```
패턴별 켈리 비율 산출:

적삼병 (Three White Soldiers):
  역사적 승률 p = 0.65, 평균 손익비 b = 1.8
  f* = (1.8 × 0.65 - 0.35) / 1.8 = 0.82/1.8 = 0.456
  하프 켈리: 0.228 (자본의 약 23%)

이중바닥 (Double Bottom):
  역사적 승률 p = 0.60, 평균 손익비 b = 2.2
  f* = (2.2 × 0.60 - 0.40) / 2.2 = 0.92/2.2 = 0.418
  하프 켈리: 0.209 (자본의 약 21%)

데스크로스 후 숏 (Death Cross Short):
  역사적 승률 p = 0.52, 평균 손익비 b = 1.5
  f* = (1.5 × 0.52 - 0.48) / 1.5 = 0.30/1.5 = 0.200
  하프 켈리: 0.100 (자본의 약 10%)

→ 패턴의 신뢰도에 따라 포지션 크기가 자동 조절
→ 백테스트 결과를 켈리에 직접 입력 가능
```

### 8.3 기술적 신호와 위험 관리의 통합

```
진입-퇴출 프레임워크:

1단계: 기술적 진입 시그널 확인
  → RSI 과매도 + 양봉 반전 + 거래량 증가

2단계: 재무관리 기반 포지션 크기 결정
  계좌 잔고: 10,000,000원
  위험 비율: 2% (= 200,000원 최대 손실)
  손절가: 진입가 대비 -3%
  포지션 = 200,000 / 0.03 = 6,666,667원

3단계: VaR 한도 확인
  기존 포지션의 VaR + 신규 포지션의 VaR ≤ 총 VaR 한도
  초과 시 → 포지션 축소 또는 기존 포지션 일부 청산

4단계: 성과 측정
  거래 종료 후 → 샤프/소르티노/칼마 비율 갱신
  성과 저하 시 → 전략 재검토 또는 위험 비율 하향
```

### 8.4 손절 설정의 재무관리적 관점

```
손절(Stop-Loss)의 재무관리 원칙:

원칙 1: 총 자본 보존
  단일 거래 손실 ≤ 총 자본의 1~2%
  → 50연패해도 자본의 36~64% 잔존 (생존 보장)

원칙 2: 기대값 양수 유지
  손절폭 × 패율 < 이익폭 × 승률
  → E[R] = p·W - q·L > 0

원칙 3: 켈리 최적화와의 정합
  손절폭이 곧 b(배당률)의 분모
  손절이 좁을수록 b 증가 → 켈리 비율 증가 → 큰 포지션
  손절이 넓을수록 b 감소 → 켈리 비율 감소 → 작은 포지션

기술적 손절 방법의 재무관리 해석:
  ATR 기반 손절: ATR × 2~3 → 변동성 정규화된 손절
  지지선 하방 손절: 구조적 수준 → 패턴 무효화 지점
  고정 비율 손절: 3~5% → 단순하지만 변동성 무시
```

### 8.5 기술적 전략의 성과 귀인

```
기술적 전략 성과 분해 (확장 Brinson 모형):

총 초과수익 = 타이밍 효과 + 종목 선택 효과 + 크기 조절 효과

타이밍 효과 (Timing Effect):
  매수/매도 시점이 벤치마크 대비 가져온 초과수익
  → 이동평균 교차, RSI 시그널의 기여

종목 선택 효과 (Selection Effect):
  시그널이 발생한 종목 선별의 기여
  → 패턴 인식(적삼병, 이중바닥)의 기여

크기 조절 효과 (Sizing Effect):
  켈리/고정비율 포지션 사이징의 기여
  → 확신도에 따른 포지션 크기 조절의 부가가치
```

---

## 핵심 정리: 재무관리 개념과 기술적 분석 도구의 매핑

| 재무관리 개념 | 기술적 분석 대응 | 통합 적용 |
|--------------|-----------------|----------|
| DCF 내재가치 | 피보나치/패턴 목표가 | 목표가 수렴 영역 확인 |
| WACC/할인율 | 금리 환경 분석 | 금리 추세와 성장주 방향성 |
| PER/PBR 밴드 | 지지/저항 밴드 | 가치 영역 + 기술적 반전 |
| 켈리 기준 | 패턴 승률/손익비 | 신호 강도별 포지션 크기 |
| 고정비율 사이징 | ATR 기반 손절 | 변동성 정규화된 위험 관리 |
| VaR 한도 | 포트폴리오 노출 관리 | 기술적 신호의 위험 필터 |
| 샤프 비율 | 전략 백테스트 평가 | 기술적 전략의 위험조정 성과 |
| 소르티노 비율 | 하방 위험 중심 평가 | MDD 민감 전략의 평가 |
| 칼마 비율 | MDD 대비 수익 | 트레이더 실전 성과 지표 |
| 성과 귀인 | 타이밍/선택 분해 | 기술적 전략 개선 방향 도출 |
| 자본구조 (D/E) | 유상증자/자사주 공시 | 재무 이벤트와 기술적 패턴 결합 |
| 파산 확률 | 연속 손실 시뮬레이션 | 전략의 생존 가능성 사전 검증 |

---

## 참고문헌

### 교과서 및 단행본
- Brealey, R., Myers, S. & Allen, F. — *Principles of Corporate Finance* (13th ed., 2020)
- Damodaran, A. — *Investment Valuation* (3rd ed., 2012)
- Damodaran, A. — *Damodaran on Valuation* (2nd ed., 2006)
- Vince, R. — *Portfolio Management Formulas* (1990)
- Thorp, E.O. — *A Man for All Markets* (2017)

### 핵심 논문
- Modigliani, F. & Miller, M.H. (1958) — *The Cost of Capital, Corporation Finance and the Theory of Investment*, American Economic Review, 48(3), 261-297
- Myers, S.C. & Majluf, N.S. (1984) — *Corporate Financing and Investment Decisions When Firms Have Information That Investors Do Not Have*, Journal of Financial Economics, 13(2), 187-221
- Kelly, J.L. (1956) — *A New Interpretation of Information Rate*, Bell System Technical Journal, 35(4), 917-926
- Sharpe, W.F. (1966) — *Mutual Fund Performance*, Journal of Business, 39(1), 119-138
- Sortino, F.A. & van der Meer, R. (1991) — *Downside Risk*, Journal of Portfolio Management, 17(4), 27-31
- Brinson, G.P., Hood, L.R. & Beebower, G.L. (1986) — *Determinants of Portfolio Performance*, Financial Analysts Journal, 42(4), 39-44
- Grinold, R.C. (1989) — *The Fundamental Law of Active Management*, Journal of Portfolio Management, 15(3), 30-37
- Gordon, M.J. (1962) — *The Investment, Financing, and Valuation of the Corporation*, Irwin

### 노벨 경제학상 수상 관련
- 1985: Franco Modigliani — 자본구조 이론
- 1990: Harry Markowitz, Merton Miller, William Sharpe — 포트폴리오 이론, 자본구조, CAPM
- 2013: Eugene Fama — 효율적 시장 가설 (자산 가격의 실증적 분석)

---

## 9. 투자 점수 배점 체계 (Investment Score System)

> `financials.js`의 `_calcInvestmentScore()` 함수가 산출하는 종합 투자 등급(A~D).
> 비전공자에게 재무 지표를 하나의 점수로 요약하여 의사결정을 보조한다.

### 9.1 배점 구조 (총 110점 만점, 정규화하여 100점)

```
수익성 (40점):
  ROE    15점   — 자기자본이익률
  OPM    15점   — 영업이익률
  ROA     5점   — 총자산이익률 (연속, max at ROA >= 10%)
  NPM     5점   — 순이익률 (연속, max at NPM >= 15%)

밸류에이션 (30점):
  PER    15점   — 주가수익비율
  PBR    15점   — 주가순자산비율

성장성 (20점):
  매출 CAGR  20점  — 연평균 매출 성장률 (최대 4년)

안정성 (20점):
  부채비율   20점  — 부채총계 / 자본총계 * 100
```

활성 항목이 2개 미만(maxPossible < 30)이면 점수를 산출하지 않고 "---"을 표시한다.
정규화: `finalScore = round(score / maxPossible * 100)` (활성 항목 기준)

등급 산출:
```
  A: finalScore >= 80
  B: finalScore >= 60
  C: finalScore >= 40
  D: finalScore < 40
```

### 9.2 각 임계값의 근거

#### ROE 임계값

| 구간 | 점수 | 근거 |
|------|------|------|
| >= 15% | 15 (만점) | KOSPI 상위 약 25% 수준 (한국은행 기업경영분석 2023). DuPont 분해에서 높은 ROE는 수익성/효율성/레버리지의 양호한 조합을 의미. |
| >= 10% | 12 | KOSPI 전체 중위수 근처. 자본비용(Cost of Equity) 8-10%를 상회하므로 가치 창출 기업. |
| >= 5% | 8 | 자본비용을 약간 하회하나 양(+)의 이익 유지. |
| >= 0% | 4 | 흑자 유지의 최소 기준. |
| < 0% | 0 (미배점) | 적자 기업은 수익성 점수 없음. |

학술 근거: DuPont Identity — ROE = (NI/Sales) * (Sales/Assets) * (Assets/Equity)
실무 기준: 한국은행 기업경영분석, KRX 시장 실무 관행

#### OPM (영업이익률) 임계값

| 구간 | 점수 | 근거 |
|------|------|------|
| >= 20% | 15 | 높은 경쟁 우위 (pricing power) 보유 기업. Porter (1985) 경쟁우위 이론. |
| >= 10% | 12 | KOSPI 제조업 중위수 수준. |
| >= 5% | 8 | 양호한 원가 관리. |
| >= 0% | 4 | 영업 흑자 유지. |

#### PER 임계값

| 구간 | 점수 | 근거 |
|------|------|------|
| < 10 | 15 (만점) | KOSPI 역사적 중위수 하단 (FnGuide 2015-2023 통계에서 KOSPI PER 중위수 약 10-12배). Graham (1949)의 "10배 미만은 저평가" 기준과 부합. |
| <= 15 | 12 | 적정 밸류에이션 영역. |
| <= 25 | 8 | 성장 프리미엄 포함 영역. |
| <= 40 | 4 | 고평가 영역이나 고성장 기대 반영. |
| > 40 | 0 | 과도한 프리미엄. |

학술 근거: Graham, B. & Dodd, D. (1934), *Security Analysis*, McGraw-Hill
— "이익의 10배 이하에서 매수" 원칙의 원전

#### PBR 임계값

| 구간 | 점수 | 근거 |
|------|------|------|
| < 0.7 | 15 (만점) | 순자산 가치 대비 30% 할인. Graham (1949), *The Intelligent Investor* — "순유동자산 이하 매수" 전략의 현대적 변형. Fama & French (1992) 가치 프리미엄(value premium) 실증. |
| <= 1.0 | 12 | 장부가 이하, 전통적 가치주 기준. |
| <= 2.0 | 8 | 적정 범위. |
| <= 3.0 | 4 | 성장 프리미엄 포함. |
| > 3.0 | 0 | 고평가. |

학술 근거:
- Fama, E.F. & French, K.R. (1992), *The Cross-Section of Expected Stock Returns*,
  Journal of Finance, 47(2), 427-465 — 낮은 PBR(Book-to-Market)이 초과수익과 연관
- Lakonishok, J., Shleifer, A. & Vishny, R.W. (1994), *Contrarian Investment,
  Extrapolation, and Risk*, Journal of Finance, 49(5), 1541-1578

#### 매출 CAGR 임계값

| 구간 | 점수 | 근거 |
|------|------|------|
| >= 20% | 20 (만점) | 고성장 기업. |
| >= 10% | 16 | 양호한 성장. |
| >= 5% | 12 | GDP 성장률 상회. |
| >= 0% | 6 | 매출 유지. |
| < 0% | 0 | 매출 역성장. |

CAGR 계산: `CAGR = (Rev_end / Rev_start)^(1/years) - 1`
임계값은 KRX 시장 실무 관행에 기반한다. 20% 이상 매출 성장은
"고성장주"로 분류되는 업계 관행(증권사 리서치 보고서 분류 기준)이다.

#### 부채비율 임계값

| 구간 | 점수 | 근거 |
|------|------|------|
| < 50% | 20 (만점) | 재무 건전성 우량. 신용평가사 관행에서 AA급 이상 기업의 일반적 수준. |
| <= 100% | 16 | 양호한 재무구조. |
| <= 200% | 10 | 업종 평균 수준 (제조업 기준). |
| <= 300% | 4 | 재무 레버리지 과다 경고 구간. |
| > 300% | 0 | 재무 위험 높음. |

학술 근거:
- MM Proposition (§3.1 참조) — 이론적으로 자본구조는 무관하나,
  현실에서는 파산비용과 대리인비용으로 인해 최적 부채비율이 존재
- Trade-off Theory (§3.3 참조) — 세금 절감 효과와 재무적 곤경 비용의 균형
- 한국 신용평가 3사(한신평/한기평/나이스) 관행: 부채비율 50% 미만을 재무 건전성 우량으로 분류

### 9.3 관련 학술 체계

#### Piotroski (2000) F-Score

Joseph D. Piotroski (2000), *Value Investing: The Use of Historical Financial
Statement Information to Separate Winners from Losers*,
Journal of Accounting Research, 38(Supplement), 1-41

```
F-Score (0~9점): 9개 이진 변수의 합
  수익성 (4점): ROA > 0, CFO > 0, delta_ROA > 0, Accrual < 0
  레버리지/유동성 (3점): delta_Leverage < 0, delta_Liquidity > 0, EQ_OFFER = 0
  운영효율 (2점): delta_Margin > 0, delta_Turnover > 0

비교: F-Score는 이진(0/1) 변수만 사용하여 단순명료
      본 시스템은 연속적 임계값 구간으로 세분화된 점수 부여
```

#### Greenblatt (2006) Magic Formula

Joel Greenblatt (2006), *The Little Book That Beats the Market*,
John Wiley & Sons

```
Magic Formula 순위:
  1) 이익수익률 (Earnings Yield = EBIT / EV) 순위
  2) 투하자본수익률 (ROIC = EBIT / (Net Working Capital + Net Fixed Assets)) 순위
  3) 두 순위의 합이 가장 낮은 기업 = 최우선 투자 대상

비교: Magic Formula는 2개 지표의 순위 합산
      본 시스템은 6개 범주의 가중 합산으로 더 포괄적
```

### 9.4 임계값의 한계와 정직한 고백

배점 체계의 각 임계값(ROE 15%, PER 10, PBR 0.7 등)은 단일 논문에서
엄밀히 최적화된 값이 아니다. 이들은 다음의 조합에서 도출되었다:

```
1) 학술 원칙: Graham-Dodd 가치 투자 철학, Fama-French 가치 프리미엄
2) 시장 통계: KOSPI 장기 분포 (FnGuide, 한국은행 기업경영분석)
3) 업계 관행: 증권사 리서치, 신용평가사 기준
4) 경험적 조정: KRX 시장 특성에 맞춘 미세 조정
```

구간 경계(예: ROE 5/10/15, PER 10/15/25/40)의 정확한 수치는
D등급(학술적 최적화 부재)에 가깝다. 다만 Graham (1949), Fama & French (1992),
Piotroski (2000) 등의 방향성(저PER/저PBR/고ROE 선호)은 학술적으로 확립된 원칙이다.

코드 매핑: `js/financials.js:536-646` (`_calcInvestmentScore()`)
엔진 적용 효과: 비전공자에게 종합 투자 등급(A~D)을 제공하여 의사결정 보조.
6개 재무 지표를 하나의 점수로 집약함으로써 정보 과부하(information overload)를 해소.
