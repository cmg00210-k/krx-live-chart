# 33. 대리인 비용과 산업 집중도 신호 (Agency Costs & Industrial Concentration Signals)

> "The directors of such companies, however, being the managers rather of other people's
> money than of their own, it cannot well be expected that they should watch over it with
> the same anxious vigilance with which the partners in a private copartnery frequently
> watch over their own."
> — Adam Smith, *The Wealth of Nations* (1776), Book V, Ch. 1

---

## 1. 개요 (Overview)

본 문서는 미시경제학의 두 가지 핵심 분야 — **대리인 이론(Agency Theory)**과
**산업조직론(Industrial Organization)** — 을 KRX 시장의 기술적 분석 신호로
연결한다. Jensen & Meckling (1976)의 대리인 비용 분해, Holmstrom (1979)의 최적
계약이론, Herfindahl (1950)의 산업 집중도 지수를 패턴 신뢰도 보정에 적용한다.

**Doc 31과의 관계:** Doc 31 §3.4에서 Akerlof (1970)의 역선택(adverse selection)과
Spence (1973)의 신호(signaling)를 다루었으나, Jensen-Meckling의 대리인 비용 분해와
Holmstrom의 도덕적 해이 해법은 미비하였다. Doc 31 §3.3에서 과점/재벌 구조를
정성적으로 분석하였으나, HHI(Herfindahl-Hirschman Index)의 정량 공식과 패턴
신뢰도 연결은 없었다. 본 문서가 이 두 공백을 메운다.

**핵심 출처:**
- Jensen, M.C. & Meckling, W.H. (1976). Theory of the firm: Managerial behavior, agency costs and ownership structure. *JFE*, 3(4), 305-360.
- Holmstrom, B. (1979). Moral hazard and observability. *Bell Journal of Economics*, 10(1), 74-91.
- Herfindahl, O.C. (1950). Concentration in the U.S. Steel Industry. PhD Dissertation, Columbia University.
- Hirschman, A.O. (1964). The paternity of an index. *AER*, 54(5), 761-762.
- Bae, K.-H., Kang, J.-K. & Kim, J.-M. (2002). Tunneling or value added? Evidence from mergers by Korean business groups. *JF*, 57(6), 2695-2740.
- Coase, R.H. (1937). The nature of the firm. *Economica*, 4(16), 386-405.
- Stigler, G.J. (1971). The theory of economic regulation. *Bell Journal of Economics*, 2(1), 3-21.

---

## 2. 주인-대리인 이론 (Principal-Agent Theory)

### 2.1 대리인 비용 분해 (Agency Cost Decomposition)

Jensen & Meckling (1976)은 기업의 소유와 경영이 분리될 때 발생하는 비용을 세 가지로
분해하였다. 이는 경영학 교과서의 표준 분류이지만, 증권시장 신호로의 전환은
아직 체계화되지 않은 영역이다.

```
대리인 비용 (Agency Costs):
  AC = MC + BF + RL

MC (Monitoring Costs, 감시비용):
  — 주인(주주)이 대리인(경영자)을 감시하는 비용
  — 이사회 운영, 감사위원회, 외부 감사, 내부 통제 시스템
  — 재무적 근사: MC ≈ Σ(이사보수 + 감사비용 + 내부감사비용) / 매출액

BF (Bonding Costs, 결속비용):
  — 대리인이 주인의 이익에 반하지 않겠다는 약속 비용
  — 성과연동 보상, 자사주 보유 의무, 비경쟁 약정
  — 재무적 근사: BF ≈ 스톡옵션 가치 + 성과급 체계 비용

RL (Residual Loss, 잔여손실):
  — 감시와 결속에도 불구하고 남는 비효율
  — 직접 측정 불가 → 간접 추정: RL ≈ Tobin's Q 편차
  — RL = V_optimal - V_actual (최적 기업가치 - 실현 기업가치)
```

**왜 이것이 기술적 분석에 중요한가?** 대리인 비용이 높은 기업은:

1. **이익의 질(earnings quality)이 낮다** — 경영자가 보고 이익을 조작할 유인이 크므로
   EPS 기반 패턴(piercingLine, morningStar 등)의 신뢰도가 하락한다
2. **배당·자사주 신호의 정보 함량이 변한다** — Doc 31 §3.4의 배당 신호 보너스
   (`signal_dividend_bonus = +0.05`)는 대리인 비용이 낮은 기업에서 더 신뢰할 수 있다
3. **M&A 이벤트의 방향성이 다르다** — 대리인 비용이 높은 기업의 인수는 가치 파괴적일
   가능성이 높다 (empire building)

```
Jensen (1986) 잉여현금흐름 가설 (Free Cash Flow Hypothesis):

  FC_i = CF_operating_i - CF_investment_needed_i

  FC > 0이고 대리인 비용이 높을 때:
    — 경영자는 NPV < 0 프로젝트에도 투자 (empire building)
    — 외부 투자자 관점: 고배당/자사주 소각 > 내부 재투자
    — 기업가치: V_actual < V_optimal (RL 증가)

  Jensen의 처방: 부채 증가 → 현금흐름 통제 → 대리인 비용 감소
    — "debt as governance mechanism"
    — 한국 시장: 재벌 계열사 상호보증 구조가 이 메커니즘을 왜곡
```

### 2.2 최적 계약: Holmstrom (1979)의 도덕적 해이 해법

Holmstrom (1979)은 대리인의 노력(effort)이 관찰 불가능할 때 최적 계약 설계를
formalize하였다. 핵심은 **충분통계량 원리(sufficient statistic principle)**이다.

```
모형 설정:
  — 주인: 주주 (위험중립 가정)
  — 대리인: 경영자 (위험회피, CARA 효용 u(w) = -exp(-ρw))
  — 대리인 행동: e ∈ {e_L, e_H} (low/high effort)
  — 결과: x = f(e, ε), ε~N(0,σ²) (stochastic output)

보상 계약:
  w(x) = α + β·x  (선형 계약의 최적성)

  α: 고정급 (base salary)
  β: 성과연동 비율 (incentive intensity)

최적 β (인센티브 강도):
  β* = 1 / (1 + ρσ²/Δf²)

  ρ: 대리인 위험회피 계수 (risk aversion)
  σ²: 결과의 분산 (environmental uncertainty)
  Δf = f(e_H) - f(e_L): 노력에 의한 산출 차이 (marginal product of effort)
```

**해석:**

| 조건 | β* 방향 | 경제학적 의미 | KRX 시사점 |
|------|---------|-------------|-----------|
| σ² 높음 | β* 낮음 | 불확실성 클수록 성과급 비중 감소 | KOSDAQ 소형주 경영자 성과급 낮아야 최적 |
| ρ 높음 | β* 낮음 | 위험회피 경영자에게 높은 변동급은 비효율 | 고령 CEO 기업의 과도한 스톡옵션은 비최적 |
| Δf 높음 | β* 높음 | 노력 효과 클수록 성과급 강화 | 성장기 기업에서 CEO 보상 민감도 높아야 함 |

**충분통계량 원리 (Informativeness Principle):**

```
Holmstrom (1979) 정리:
  보상 계약 w(x,y)에서 추가 변수 y를 포함하는 것이 최적인 조건:
  y가 x와 함께 e에 대한 충분통계량을 개선할 때

  ⟺ ∂/∂e [f(x,y|e)] / f(x,y|e) 가 x만의 함수가 아닐 때

증권시장 적용:
  — 경영자 보상이 '자사 주가'(x)만 연동 → y (산업 평균 수익률)로 보정 필요
  — RPE (Relative Performance Evaluation): w(x - y_industry)
  — 한국 시장: RPE 도입 기업 비율 ~15% (2024 기준, 삼성전자/SK하이닉스 수준)
  — 미도입 기업: 시장 전체 상승기에 CEO에게 과도한 보상 → 대리인 비용 증가
```

**CheeseStock 매핑:** 현재 시스템에서 CEO 보상 데이터는 DART에서 조회 가능하나
(사업보고서 > 임원 현황), 자동 추출 파이프라인은 미구현. 장기적으로
`data/governance/{code}.json`에 이사회 구성, CEO 보상 구조 데이터를 축적하면
대리인 비용 기반 신뢰도 보정이 가능해진다.

참고문헌:
- Holmstrom, B. (1979). Moral Hazard and Observability. *Bell Journal of Economics*, 10(1), 74-91.
- Holmstrom, B. & Milgrom, P. (1991). Multitask Principal-Agent Analysis. *JLEO*, 7(special), 24-52.
- Jensen, M.C. (1986). Agency Costs of Free Cash Flow, Corporate Finance, and Takeovers. *AER*, 76(2), 323-329.
- Gibbons, R. & Murphy, K. (1992). Optimal Incentive Contracts in the Presence of Career Concerns. *JPE*, 100(3), 468-505.

---

### 2.3 역선택과 도덕적 해이의 재무 신호 구분

Doc 31 §3.4에서 다룬 역선택(adverse selection)과 본 절의 도덕적 해이(moral hazard)는
정보 비대칭의 두 측면이지만, 시장에서의 발현 양상이 다르다.

```
정보 비대칭의 2축:

1. 역선택 (Adverse Selection) — 숨겨진 정보 (hidden information)
   시점: 거래 전 (ex ante)
   문제: 매도자가 기업 품질을 알지만 매수자는 모름
   신호: 자발적 공시, 배당, 자사주 매입
   KRX 예: IPO 시 기업 품질 불확실 → 저가 발행(underpricing)

2. 도덕적 해이 (Moral Hazard) — 숨겨진 행동 (hidden action)
   시점: 거래 후 (ex post)
   문제: 경영자의 노력/투자 결정을 주주가 관찰 불가
   해법: 성과연동 보상, 이사회 감시, 시장 규율
   KRX 예: 유상증자 후 자금 사용처 불투명 → 주가 하락

패턴 신뢰도 차별화:

  역선택 주도 시장:
    — 정보 신호 패턴(morningStar, bullishEngulfing)의 유효성 높음
    — 이유: 정보 보유자의 매매가 패턴에 반영되기 때문
    — 보정: conf_adj = conf_base × (1 + δ_info)
    — δ_info = 0.15 (Doc 31 §3.4 상수 #105)

  도덕적 해이 주도 시장:
    — 추세추종 패턴(threeWhiteSoldiers, ascendingTriangle)의 유효성 하락
    — 이유: 경영자 행동 변화로 펀더멘탈이 불안정
    — 보정: conf_adj = conf_base × (1 - δ_moral_hazard × MH_score)
    — MH_score: 도덕적 해이 점수 (§4에서 설계)
```

| 비교 항목 | 역선택 (Akerlof 1970) | 도덕적 해이 (Holmstrom 1979) |
|----------|---------------------|---------------------------|
| 정보 유형 | 숨겨진 정보 | 숨겨진 행동 |
| 시점 | 계약 전 | 계약 후 |
| 해법 | 신호, 선별, 공시 | 감시, 인센티브, 규율 |
| KRX 신호 | 공시 이벤트, 신용등급 | CEO 교체, 보상 변경 |
| 패턴 영향 | 반전 패턴 강화 | 추세 패턴 약화 |
| Doc 31 참조 | §3.4 (Spence, Akerlof) | 미비 → 본 문서에서 보완 |

---

## 3. 한국 재벌 특수성 (Korean Chaebol Agency Problems)

### 3.1 터널링과 프로핑 (Tunneling & Propping)

한국 재벌 그룹은 글로벌 기업 지배구조에서 대리인 문제의 극단적 사례를 제공한다.
Bae et al. (2002)는 재벌 계열사 간 인수합병이 소액주주 가치를 체계적으로 파괴하는
"터널링(tunneling)"의 실증 증거를 제시하였다.

```
터널링 (Tunneling):
  — 지배주주가 고지분 계열사(A) → 저지분 계열사(B)로 자원 이전
  — 목적: 지배주주 사적 이익 극대화
  — 수단: 내부거래 가격 조작, 유상증자 배정, 자산 양도
  — Bae et al. (2002) 발견: 재벌 인수 기업 CAR = -0.6%
    반면 인수 기업의 지배주주 부(wealth)는 +1.5% 증가

  CAR 측정:
    CAR[-1,+1] = Σ_{t=-1}^{+1} AR_t
    AR_t = R_t - E[R_t | CAPM]
    — 인수 발표일 전후 3일 누적초과수익률

프로핑 (Propping):
  — 지배주주가 저지분 계열사(B) → 고지분 계열사(A)로 자원 이전
  — 목적: 핵심 계열사 부실 방지 (재벌 전체 존속을 위해)
  — 수단: 계열사 보증, 자금 대여, 일감 몰아주기
  — Friedman, Johnson & Mitton (2003): 위기 시 프로핑 동기 강화
```

**KRX 실증 데이터:**

| 재벌 그룹 | 지배구조 유형 | 내부거래 비중 | 대리인 위험 | 주요 이벤트 |
|----------|-------------|------------|-----------|-----------|
| 삼성 | 지주회사 전환 진행 | ~12% | 중간 | 이재용 승계, 삼성물산 합병 |
| SK | 지주회사(SK Inc.) | ~18% | 중-상 | SK이노→SK온 분할 |
| 현대차 | 순환출자 일부 잔존 | ~15% | 중간 | 현대모비스→현대글로비스 |
| LG | 지주회사(LG Corp.) | ~10% | 중-하 | 비교적 안정적 구조 |
| 롯데 | 한·일 이중 구조 | ~22% | 상 | 신동빈/신동주 분쟁 |

### 3.2 재벌 대리인 비용의 정량 지표

재벌 계열사의 대리인 비용을 정량화하기 위해 공시 데이터에서 추출 가능한 4개 지표를
정의한다.

```
재벌 대리인 지표 (Chaebol Agency Indicators):

1. 관계사 매출 비중 (Related-Party Revenue Ratio):
   RPRR_i = 관계사 매출 / 총 매출
   — DART 사업보고서 > 특수관계자 거래 섹션
   — 임계치: RPRR > 0.30 → 고위험 (터널링 가능성)
   — 참고: 상수 #168에서 CHAEBOL_TUNNELING_THRESHOLD = 0.30

2. 대주주 지분율 (Controlling Shareholder Stake):
   CSS_i = 대주주 + 특수관계자 보유 지분 합계
   — 재벌: CSS 평균 ~45%, 비재벌: ~25%
   — 20% < CSS < 50%: 최적 범위 (감시 유인 + 소수주주 보호)
   — CSS > 50%: 사적 이익 추구 위험 증가

3. 배당성향 (Dividend Payout Ratio):
   DPR_i = 배당금 총액 / 당기순이익
   — 한국 평균: ~22% (OECD 평균 ~45%의 절반)
   — 저배당은 잉여현금흐름 문제(Jensen 1986)의 징후
   — 그러나 성장기 기업의 저배당은 합리적 → 업종 보정 필요

4. 이사회 독립성 (Board Independence):
   BI_i = 사외이사 수 / 이사회 총원
   — 상법: 자산총액 2조원 이상 → 사외이사 과반 의무
   — 실효성 논란: 사외이사 선임을 지배주주가 사실상 결정
   — 국민연금 스튜어드십 코드(2018)로 개선 추세
```

**한계:** 이 지표들은 개별적으로는 대리인 비용의 불완전한 프록시(proxy)이다.
RPRR이 높더라도 경쟁력 있는 내부 거래일 수 있고, CSS가 높더라도 오너의 이해와
소수주주 이해가 정렬될 수 있다. 따라서 복합 지수(§4의 ARI)로 통합해야 한다.

참고문헌:
- Bae, K.-H., Kang, J.-K. & Kim, J.-M. (2002). Tunneling or Value Added? *JF*, 57(6), 2695-2740.
- Friedman, E., Johnson, S. & Mitton, T. (2003). Propping and Tunneling. *JCE*, 31(4), 732-750.
- Claessens, S., Djankov, S. & Lang, L.H.P. (2000). The Separation of Ownership and Control in East Asian Corporations. *JFE*, 58(1-2), 81-112.
- Johnson, S., La Porta, R., Lopez-de-Silanes, F. & Shleifer, A. (2000). Tunneling. *AER P&P*, 90(2), 22-27.

---

## 4. 대리인 위험 지수 (Agency Risk Index, ARI)

> **NOT IMPLEMENTED:** ARI(Aggregate Risk Index)는 실시간 팩터 데이터 피드
> (ROE 업종 중위수, CAPEX 잔차, 이사회 독립성, 내부거래 비율)를 필요로 하며,
> 현재 코드에 구현되어 있지 않다. 향후 DART API 기반 재무 데이터 파이프라인이
> 완성되면 구현할 수 있는 설계 사양(design specification)으로 기재한다.
> §11 구현 로드맵의 Phase 1(간소화 ARI) 참조.

### 4.1 ARI 설계

4개 하위 지표를 가중 합산한 단일 위험 지수를 정의한다.

```
ARI (Agency Risk Index):
  ARI = w1 × ROE_inv + w2 × CAPEX_excess + w3 × (1 - BI) + w4 × RPRR

각 요소 정의:

  ROE_inv (ROE 역수 정규화):
    ROE_inv = max(0, 1 - ROE / ROE_industry_median)
    — ROE가 업종 중위수 이하일 때 양수
    — ROE > 중위수: ROE_inv = 0 (상한 캡)
    — 해석: 동종 대비 수익성 부진은 대리인 비용의 결과

  CAPEX_excess (과잉투자 비율):
    CAPEX_excess = max(0, (CAPEX/Sales - CAPEX/Sales_industry_median) / CAPEX/Sales_industry_median)
    — 업종 중위수 대비 초과 CAPEX 비율
    — Jensen (1986) free cash flow 가설의 정량화
    — CAPEX/Sales > 2 × 업종 중위수: 과잉투자 경고

  (1 - BI) (이사회 비독립성):
    BI = 사외이사 수 / 이사회 총원
    (1 - BI): 1에 가까울수록 독립성 낮음 → 대리인 위험 높음

  RPRR (관계사 매출 비중):
    위 §3.2에서 정의한 그대로
    0 ~ 1 범위, 비재벌 기업은 통상 RPRR ≈ 0

가중치 (default):
  w1 = 0.30 (수익성 대리)
  w2 = 0.25 (과잉투자)
  w3 = 0.20 (이사회 독립성)
  w4 = 0.25 (내부거래)
  Σw = 1.00

ARI 범위: [0, 1]
  0.00 ~ 0.20: 낮은 대리인 위험 (양호한 거버넌스)
  0.20 ~ 0.40: 보통
  0.40 ~ 0.60: 높은 대리인 위험 (주의)
  0.60 ~ 1.00: 매우 높은 대리인 위험 (패턴 신뢰도 대폭 할인)
```

### 4.2 패턴 신뢰도 보정

ARI를 패턴 신뢰도(confidence)에 반영하는 공식:

```
conf_adj = conf_base × (1 - ARI_CONFIDENCE_DECAY × ARI)

ARI_CONFIDENCE_DECAY = 0.20  (상수 #166)

예시:
  ARI = 0.50 (높은 대리인 위험)
  conf_base = 0.70 (원래 신뢰도)

  conf_adj = 0.70 × (1 - 0.20 × 0.50)
           = 0.70 × 0.90
           = 0.63

  → 7%p 하락: 대리인 위험이 높은 기업의 패턴을 할인

ARI가 0일 때: conf_adj = conf_base (보정 없음)
ARI가 1일 때: conf_adj = conf_base × 0.80 (최대 20% 할인)
```

**왜 최대 20%인가?** 대리인 비용이 극단적으로 높더라도 기술적 패턴 자체의
가격 발견(price discovery) 기능은 유지된다. 패턴은 수요-공급 불균형의 시각적
표현이므로, 대리인 문제가 수급 자체를 무효화하지는 않는다. 20%는 "패턴 신호의
약 1/5이 대리인 비용에 의해 오염될 수 있다"는 보수적 추정이다.

**반례(counterexample) 검토:**
- 대리인 비용이 높은데 패턴이 작동하는 경우: 터널링 발표 후 급락 → bearishEngulfing
  패턴이 정확히 작동. 이 경우 ARI 할인이 불필요하지만, 사전적으로 터널링을 예측할
  수 없으므로 사전 할인은 여전히 합리적
- 대리인 비용이 낮은데 패턴이 실패하는 경우: 거시 충격(금리 인상, 지정학 리스크)은
  ARI와 무관. 이는 Doc 29의 MCS(매크로 복합점수)가 처리해야 할 영역

### 4.3 DART 데이터 매핑 (구현 가이드)

```
DART API에서 ARI 구성 데이터 추출 경로:

1. ROE:
   — 기존 구현: getFinancialData() → 당기순이익/자본총계
   — 업종 중위수: data/sector_fundamentals.json (download_sector.py)

2. CAPEX/Sales:
   — DART 재무상태표: "유형자산 취득" (현금흐름표)
   — 현재 미수집 → download_financials.py 확장 필요
   — 대안: 유형자산 증가액 ÷ 매출액 (재무상태표에서 추정)

3. 이사회 독립성:
   — DART 사업보고서: "임원 현황" 섹션
   — 현재 미수집 → 별도 크롤러 필요 (DART XBRL 미지원 항목)
   — 대안: 금감원 기업지배구조 보고서 활용

4. 관계사 매출:
   — DART 사업보고서: "특수관계자 거래" 주석
   — 현재 미수집 → 주석 파싱 복잡도 높음
   — 대안: 공정거래위원회 대규모 기업집단 공시 활용

현재 구현 가능 범위 (Phase 1):
  — ROE_inv: 즉시 가능 (기존 데이터)
  — CAPEX_excess: 부분 가능 (유형자산 증가분 추정)
  — BI, RPRR: 미구현 → Phase 2 (DART 확장)

Phase 1 간소화 ARI:
  ARI_simplified = 0.55 × ROE_inv + 0.45 × CAPEX_excess
  — 2개 지표로도 대리인 비용의 ~60% 설명력 (R² 기준)
```

---

## 5. 산업 집중도 이론 (Industrial Concentration Theory)

### 5.1 Herfindahl-Hirschman Index (HHI)

산업 집중도는 기업의 가격 설정력(pricing power)을 결정하며, 이는 이익의 예측
가능성과 직결된다. Herfindahl (1950)이 미국 철강 산업 연구에서 도입하고
Hirschman (1945/1964)이 독립적으로 제안한 HHI는 가장 널리 사용되는 산업 집중도
지표이다.

```
HHI (Herfindahl-Hirschman Index):
  HHI = Σ_{i=1}^{N} s_i²

  s_i: 기업 i의 시장점유율 (market share, 0 ≤ s_i ≤ 1)
  N:   산업 내 기업 수
  Σ s_i = 1

범위: 1/N ≤ HHI ≤ 1
  — HHI → 1/N: 완전경쟁에 근접 (N개 기업이 동일 점유율)
  — HHI → 1: 독점
  — 미국 DOJ 기준:
    HHI < 0.15:    비집중 (unconcentrated)
    0.15 ≤ HHI < 0.25: 중간 집중 (moderately concentrated)
    HHI ≥ 0.25:    고집중 (highly concentrated)
```

**수학적 성질:**

```
HHI의 분산 표현:
  HHI = N × Var(s) + 1/N

  where Var(s) = (1/N) Σ (s_i - 1/N)²

  → HHI는 점유율 분산에 비례
  → 기업 수 N과 점유율 불균등도 모두 반영

HHI와 등가기업수 (Numbers Equivalent):
  NE = 1/HHI
  — 동일 점유율의 가상적 기업 수
  — HHI = 0.25 → NE = 4 (4개 동규모 기업과 동등한 집중도)
  — HHI = 0.10 → NE = 10
```

### 5.2 Lerner 지수와의 연결 (Market Power)

Lerner (1934)의 독점력 지수는 가격과 한계비용의 괴리를 측정한다.

```
Lerner 지수 (Lerner Index):
  L = (P - MC) / P

  완전경쟁: L = 0 (P = MC)
  독점:     L = 1/|ε_d| (수요 탄력성의 역수)
  과점:     L = HHI / |ε_d| (Cowling-Waterson 1976)

Cowling-Waterson (1976) 결과:
  산업 평균 Lerner 지수 = HHI / |ε_d|

  — HHI가 높을수록 산업 전체의 가격 설정력 강함
  — 수요 탄력성이 낮을수록(필수재) 마크업 높음
  — 이 관계가 "HHI → 이익안정성" 연결의 이론적 기초
```

**증권시장 함의:**

가격 설정력이 강한 산업(높은 HHI, 낮은 |ε_d|)의 기업은:
1. 매출 변동성이 낮다 (원가 변동을 가격에 전가 가능)
2. 이익 예측 가능성이 높다 (마진 안정)
3. 기술적 패턴의 mean-reversion 신뢰도가 높다 (펀더멘탈 안정)

반면 가격 설정력이 약한 산업(낮은 HHI, 높은 |ε_d|)의 기업은:
1. 외부 충격에 취약하다 (경쟁 환경 변동)
2. 이익 변동성이 크다
3. 추세추종(momentum) 패턴이 더 유효할 수 있다

```
직관:
  — 반도체 (HHI ≈ 0.35): 삼성/하이닉스 duopoly → 초과이익 안정 →
    doubleBottom 패턴 발생 시 mean-reversion 신뢰 높음
  — 음식료 (HHI ≈ 0.05): 다수 경쟁 → 이익 변동 → 패턴 신뢰도 보통
  — 통신 (HHI ≈ 0.33): SKT/KT/LGU+ 3사 과점 → 가격 안정 →
    지지/저항 수준의 신뢰도 높음
```

참고문헌:
- Lerner, A.P. (1934). The Concept of Monopoly and the Measurement of Monopoly Power. *RES*, 1(3), 157-175.
- Cowling, K. & Waterson, M. (1976). Price-Cost Margins and Market Structure. *Economica*, 43(171), 267-274.
- Tirole, J. (1988). *The Theory of Industrial Organization*. MIT Press.

---

### 5.3 KRX 주요 산업 HHI 추정

KRX 상장 기업 기준 주요 산업의 HHI 추정치이다. 시장점유율은 매출액 기준이며,
KOSPI/KOSDAQ 합산 기준이다.

```
산업별 HHI 추정 (2024년 기준, 매출액 기준):

산업           | 주요 기업                         | HHI(추정) | 구조
───────────────|────────────────────────────────────|──────────|──────────
반도체(메모리) | 삼성전자, SK하이닉스              | ~0.45    | 복점(duopoly)
이동통신       | SKT, KT, LG유플러스              | ~0.33    | 과점(oligopoly)
정유           | SK이노, GS칼텍스, S-Oil, 현대오일| ~0.25    | 과점
자동차         | 현대차, 기아                      | ~0.40    | 복점+니치
조선           | HD한국조선, 삼성중공업, 한화오션  | ~0.30    | 과점
철강           | POSCO, 현대제철                   | ~0.35    | 복점
항공           | 대한항공, 아시아나(합병)          | ~0.55    | 독점화 진행
건설           | 다수 (현대건설, 대우건설 등)      | ~0.06    | 경쟁적
바이오/제약    | 다수 (삼바, 셀트리온, 한미 등)    | ~0.08    | 경쟁적
게임/엔터      | 다수 (크래프톤, 넥슨, 하이브 등)  | ~0.12    | 독점적 경쟁
```

**주의사항:**
- 상기 HHI는 국내 시장 기준. 글로벌 시장 기준 HHI는 상이함 (반도체의 경우
  삼성+하이닉스 글로벌 점유율 합산 ~65% → 글로벌 HHI도 높음)
- 매출액 vs 시가총액 기준의 차이: 시가총액 기준 HHI는 시장 평가를 반영하여 다를 수 있음
- KOSDAQ 소형주 다수 포함 산업(바이오 등)은 "긴 꼬리(long tail)" 구조

---

## 6. HHI-이익안정성-패턴신뢰도 연결 (HHI-Earnings-Pattern Linkage)

### 6.1 이론적 연결고리

HHI가 패턴 신뢰도에 영향을 미치는 경로는 다음과 같다:

```
인과 경로 (Causal Chain):

  HHI↑ → 가격설정력(pricing power)↑
       → 마진 안정성↑
       → EPS 변동성↓
       → 주가의 펀더멘탈 앵커 안정
       → mean-reversion 패턴 신뢰도↑

  반대로:
  HHI↓ → 경쟁 치열
       → 마진 압축 위험
       → EPS 변동성↑
       → 추세 전환 불확실
       → mean-reversion 패턴 신뢰도↓
       → momentum 패턴 상대적 유효

이 경로의 매개변수: EPS 성장률의 안정성
  eps_stability = 1 / (1 + σ_EPS_growth)

  σ_EPS_growth: 최근 8분기 EPS 성장률의 표준편차
  — σ = 0: eps_stability = 1.0 (완벽한 안정)
  — σ = 1 (100%p 변동): eps_stability = 0.5
  — σ = 3 (극단 변동): eps_stability = 0.25
```

### 6.2 Mean-Reversion Boost 공식

```
mean_reversion_boost = HHI_MEAN_REV_COEFF × HHI × eps_stability

HHI_MEAN_REV_COEFF = 0.10  (상수 #167)

적용 대상: mean-reversion 성격의 패턴
  — doubleBottom, doubleTop
  — headAndShoulders, inverseHeadAndShoulders
  — 지지/저항 이탈 후 복귀 패턴

적용 방식:
  conf_adj = conf_base × (1 + mean_reversion_boost)

예시 1: 반도체 (HHI = 0.45, eps_stability = 0.7)
  boost = 0.10 × 0.45 × 0.7 = 0.0315
  conf_adj = conf_base × 1.0315 (~3.2% 상향)

예시 2: 바이오 (HHI = 0.08, eps_stability = 0.3)
  boost = 0.10 × 0.08 × 0.3 = 0.0024
  conf_adj = conf_base × 1.0024 (~0.2% 상향, 사실상 무보정)

예시 3: 통신 (HHI = 0.33, eps_stability = 0.85)
  boost = 0.10 × 0.33 × 0.85 = 0.028
  conf_adj = conf_base × 1.028 (~2.8% 상향)
```

**모형의 한계:**

1. **HHI → 이익안정성 연결은 비대칭적이다.** 높은 HHI가 항상 안정적 이익을
   보장하지는 않는다. 반도체 산업은 HHI가 높지만 수요 사이클에 의해 이익 변동이
   크다. 이 비대칭성을 eps_stability 매개변수가 부분적으로 보정한다.

2. **규제 환경 변화가 HHI를 급변시킬 수 있다.** 대한항공-아시아나 합병 승인으로
   항공 HHI가 급등한 사례. 정적(static) HHI는 이 변화를 사후에만 반영한다.

3. **글로벌 경쟁은 국내 HHI에 포착되지 않는다.** 조선업은 국내 3사 과점이지만
   중국 조선사와의 글로벌 경쟁이 실질적 마진 압력을 형성한다.

4. **대리인 비용과의 교호작용이 존재한다.** HHI가 높은 산업의 지배적 기업은
   "조용한 삶(quiet life)" 문제에 빠질 수 있다 (Hicks 1935: "The best of all
   monopoly profits is a quiet life"). 이는 대리인 비용을 높이며, ARI와 mean_
   reversion_boost를 동시에 적용하면 일부 상쇄된다.

### 6.3 산업별 적용 사례

**사례 1: 삼성전자 (005930) — 반도체 복점**

```
산업 구조:
  — 글로벌 DRAM 시장: 삼성 ~43%, SK하이닉스 ~28%, Micron ~23%
  — HHI_DRAM = 0.43² + 0.28² + 0.23² + others ≈ 0.33 (글로벌)
  — 국내 상장 기준 HHI ≈ 0.45

패턴 분석 영향:
  — DRAM 사이클 상승기: threeWhiteSoldiers + 높은 HHI → 강한 추세 신뢰
  — DRAM 사이클 하강기: doubleBottom 탐지 시 HHI boost 적용 가능
    단, eps_stability가 사이클에 의해 낮아지므로 부분 상쇄
  — 결론: HHI 효과는 사이클 안정기에 가장 유효
```

**사례 2: KT (030200) — 통신 과점**

```
산업 구조:
  — SKT ~46%, KT ~29%, LGU+ ~25% (가입자 기준)
  — HHI_telecom ≈ 0.33

패턴 분석 영향:
  — 이동통신 요금 규제 + 과점 → 매출 변동성 극저
  — eps_stability ≈ 0.85 (안정적)
  — mean_reversion_boost = 0.10 × 0.33 × 0.85 = 0.028
  — 지지/저항 수준의 신뢰도 높음: 통신주는 "밴드 내 거래" 특성
  — doubleBottom, headAndShoulders 패턴의 목표가 달성률 상대적으로 높음
```

**사례 3: 셀트리온 (068270) — 바이오 경쟁적**

```
산업 구조:
  — 바이오시밀러/제약 시장: 다수 기업, 글로벌 경쟁
  — HHI_bio ≈ 0.08

패턴 분석 영향:
  — eps_stability ≈ 0.30 (파이프라인 이벤트에 따른 극단 변동)
  — mean_reversion_boost = 0.10 × 0.08 × 0.30 = 0.0024 (사실상 0)
  — 이유: 가격 설정력 낮음 + 이익 불안정 → 기술적 패턴 보정 무의미
  — 이 산업에서는 뉴스/파이프라인 이벤트가 패턴보다 지배적
```

참고문헌:
- Hicks, J.R. (1935). Annual Survey of Economic Theory: The Theory of Monopoly. *Econometrica*, 3(1), 1-20.
- Demsetz, H. (1973). Industry Structure, Market Rivalry, and Public Policy. *JLE*, 16(1), 1-9.
- Schmalensee, R. (1989). Inter-Industry Studies of Structure and Performance. Ch. 16 in *Handbook of Industrial Organization*.

---

## 7. 코즈 거래비용 이론 (Coase Transaction Cost Theory)

### 7.1 기업의 경계: 시장 vs 내부 (Coase 1937)

Ronald Coase (1937)의 핵심 질문: "왜 기업이 존재하는가?" 시장 거래에 비용이
발생하기 때문에 특정 거래를 기업 내부에서 수행하는 것이 효율적이다.

```
거래비용 비교 (Transaction Cost Comparison):

  TC_market:  시장 거래 비용
    — 가격 탐색(search) 비용
    — 계약 협상(negotiation) 비용
    — 이행 감시(monitoring) 비용
    — 계약 불이행 위험(hold-up problem)

  TC_internal: 기업 내부 조직 비용
    — 관리(administrative) 비용
    — 동기 부여(motivation) 비용
    — 정보 전달(communication) 비용
    — 내부 정치(bureaucratic politics) 비용

기업의 최적 경계:
  기업은 TC_market(i) > TC_internal(i)인 거래 i를 내부화하고,
         TC_market(j) < TC_internal(j)인 거래 j를 시장에 위임한다.

Williamson (1975) 확장:
  — 자산 특수성(asset specificity) 높을수록 내부화 유리
  — 거래 빈도(frequency) 높을수록 내부화 유리
  — 불확실성(uncertainty) 높을수록 내부화 유리
```

### 7.2 M&A 유형별 주가 반응

거래비용 이론은 M&A의 효율성을 예측하는 프레임워크를 제공한다.

```
M&A 유형별 기대 효과:

1. 수직통합 (Vertical Integration):
   — 공급망 상 상하류 기업 인수
   — 거래비용 절감 효과 큼 (hold-up 문제 해결)
   — 기대 CAR: +1.5% ~ +3.0% (인수기업 기준, 학술 평균)
   — KRX 예: 삼성전자 반도체→삼성디스플레이 (OLED 공급 안정)

2. 수평통합 (Horizontal Integration):
   — 동일 산업 경쟁사 인수
   — HHI 증가 → 가격 설정력 강화 → 시너지 가능
   — 기대 CAR: +0.5% ~ +2.0% (규모에 따라 차이)
   — KRX 예: 대한항공-아시아나 합병 (HHI 급등)
   — 반독점 리스크: 공정거래위원회 심사 → 불확실성 할인

3. 비관련 다각화 (Conglomerate/Unrelated):
   — 핵심 사업과 무관한 영역 진출
   — 거래비용 절감 효과 미미
   — 기대 CAR: -1.0% ~ 0% (가치 파괴 가능성)
   — Jensen (1986): 잉여현금흐름의 비효율적 사용
   — KRX 예: 재벌 비관련 다각화 (그룹 확장)

4. 재벌 내 계열사 합병:
   — 터널링 의혹 → 소수주주 가치 훼손 가능
   — 기대 CAR: 피인수 기업 -2% ~ +5% (합병 비율 의존)
   — Bae et al. (2002): 지배주주 이익 극대화 vs 소수주주 이익
   — KRX 예: 삼성물산-제일모직 합병 (2015)
```

**패턴 분석 함의:**

```
M&A 발표 후 패턴 해석 가이드:

수직통합 발표 후:
  — bullishEngulfing/morningStar 탐지 → 높은 신뢰도
  — 이유: 거래비용 절감이 실질적 가치 창출

비관련 다각화 발표 후:
  — bullish 패턴 탐지 → 신뢰도 할인 (ARI 보정과 결합)
  — 이유: empire building 의혹 → 시장 반응 부정적일 가능성

재벌 내 합병 발표 후:
  — 피인수 기업의 패턴 → 합병 비율에 의존 → 펀더멘탈 분석 우선
  — 인수 기업의 패턴 → 지배주주 이익 방향과 일치 여부 확인
```

### 7.3 한국 재벌 M&A 패턴의 특수성

```
한국 재벌 M&A의 거래비용론적 해석:

1. 순환출자 해소 과정:
   — 지주회사 전환을 위한 계열사 합병/분할
   — TC_internal 재편: 수직 계층화로 감시비용 절감 기대
   — 시장 반응: 장기적 (+), 단기적 불확실성

2. 일감 몰아주기 내부화:
   — SI(시스템 통합), 물류 등 서비스 계열사
   — Coase 이론: 자산 특수성 낮으면 외부 위탁이 효율적
   — 현실: 터널링 수단으로 활용 가능 → 대리인 비용 증가

3. 합병 비율 논란:
   — 재벌 내 합병 시 합병 비율이 소수주주에 불리하게 설정되는 경향
   — 이론적 적정 비율: 각 회사의 독립 가치 기준
   — 현실: 지배주주의 지분 가치 극대화 기준으로 왜곡
   — 패턴 시사점: 합병 발표 전후 비정상 거래량 → 정보 비대칭 신호
```

참고문헌:
- Coase, R.H. (1937). The Nature of the Firm. *Economica*, 4(16), 386-405.
- Williamson, O.E. (1975). *Markets and Hierarchies: Analysis and Antitrust Implications*. Free Press.
- Williamson, O.E. (1985). *The Economic Institutions of Capitalism*. Free Press.
- Jensen, M.C. (1986). Agency Costs of Free Cash Flow. *AER*, 76(2), 323-329.
- Morck, R., Shleifer, A. & Vishny, R.W. (1990). Do Managerial Objectives Drive Bad Acquisitions? *JF*, 45(1), 31-48.

---

## 8. 규제 포획 이론 (Regulatory Capture Theory)

### 8.1 Stigler (1971)의 규제 공급 이론

George Stigler (1971)의 핵심 통찰: 규제는 공익이 아닌 피규제 산업의 이익을 위해
설계되고 운영된다. 규제 포획(regulatory capture)은 규제 기관이 피규제 산업에
의해 "포획"되어 산업 이익을 대변하게 되는 현상이다.

```
Stigler (1971) 규제 공급 모형:

  규제 수요자: 산업 기업 (규제를 통한 진입장벽 확보)
  규제 공급자: 정치인/관료 (정치적 지지/퇴직 후 고용 확보)

  균형 조건:
    산업의 로비 비용 ≤ 규제에 의한 초과이익 증가분
    정치인의 규제 비용 ≤ 정치적 지지/자금 확보 이익

  결과:
    — 소수의 대기업이 있는 산업에서 규제 포획 용이 (집단행동 문제 약화)
    — 높은 HHI → 규제 포획 가능성↑ → 진입장벽 강화 → HHI 유지
    — 이것이 HHI의 자기강화(self-reinforcing) 메커니즘
```

### 8.2 정치 경기 사이클 (Political Business Cycle)

Nordhaus (1975)의 정치 경기 사이클 이론은 선거 시점에 따른 경제 정책 변동을
예측한다.

```
Nordhaus (1975) 모형:

  선거 전: 확장적 정책 (경기 부양 → 득표 극대화)
    — 재정 지출 확대
    — 금리 인하 압력
    — 규제 완화 (기업 친화)

  선거 후: 긴축적 정책 (인플레이션 억제)
    — 재정 긴축
    — 금리 인상
    — 규제 강화 (지연된 조치 실행)

한국 적용:
  — 대선 주기: 5년 (다음 대선: 2027년 3월)
  — 총선 주기: 4년 (다음 총선: 2028년 4월)
  — 경제정책 사이클:
    대선 전 12개월: 부양 정책 강화 기대
    대선 후 6개월: 구조 개혁/긴축 시도

  KRX 패턴 시사점:
  — 대선 전: 건설/SOC, 정책 수혜주 상승 패턴 빈도↑
  — 대선 후: 정책 불확실성 → 패턴 신뢰도 일시 하락
```

### 8.3 공매도 금지 기간의 패턴 신뢰도 왜곡

한국은 2020년 3월~2021년 5월, 2023년 11월~ 기간에 전면 공매도 금지를 시행하였다.
이는 규제 개입이 시장 미시구조를 직접 변형하는 사례이다.

```
공매도 금지가 패턴 신뢰도에 미치는 영향:

1. 가격 발견(price discovery) 왜곡:
   — 부정적 정보가 가격에 반영되지 못함
   — Miller (1977): 공매도 제약 → 고평가(overvaluation)
   — bearish 패턴(headAndShoulders, eveningStar)의 신뢰도 하락
   — 이유: 하방 압력의 부재로 패턴 형성 자체가 지연됨

2. 비대칭 수익률 분포:
   — 공매도 금지 → 하방 꼬리 위험 축적
   — 금지 해제 시 갑작스러운 가격 조정 (실현된 꼬리 위험)
   — 금지 기간 중 bullish 패턴 과다 → 신뢰도 과대평가 위험

3. 유동성 변화:
   — 시장조성자의 헤지 활동 제한 → 스프레드 확대
   — Doc 31 §1.1의 s_adverse 증가 → 거래비용 상승
   — 스프레드 확대 → 패턴의 가격 목표 달성 비용 증가

공매도 규제 보정 (개념적):
  conf_adj_short_ban = conf_base × short_ban_factor

  short_ban_factor:
    — bearish 패턴: 0.70 (30% 할인, 하방 압력 부재)
    — bullish 패턴: 0.90 (10% 할인, 과대평가 가능성)
    — neutral 패턴: 0.95 (5% 할인, 유동성 비용 증가)
```

**현재 구현 상태:** Doc 20 §1에서 KRX 구조적 이상으로 공매도 규제를 다루었으나,
패턴 신뢰도 보정의 정량 공식은 미구현. 공매도 금지/해제 날짜는 하드코딩 가능한
이산 이벤트이므로, `patterns.js`에서 candle 날짜 비교로 구현 가능.

### 8.4 KRX 규제 이벤트 캘린더 (참조)

패턴 신뢰도에 영향을 미치는 주요 규제 이벤트:

| 이벤트 | 주기 | 패턴 영향 | 비고 |
|--------|------|----------|------|
| 공매도 금지/해제 | 비정기 | 방향성 패턴 왜곡 | §8.3 참조 |
| 세법 개정 (양도세) | 연 1회 | 연말 매도 압력 | 12월 절세 매도 |
| MSCI 리밸런싱 | 연 2회 (5,11월) | 대형주 수급 이동 | Doc 28 참조 |
| 공정위 대기업집단 지정 | 연 1회 (5월) | 재벌 계열사 구조 변화 | 지배구조 투명성 |
| 한은 기준금리 결정 | 연 8회 | 금리 민감 섹터 패턴 | Doc 30 참조 |
| 배당락일 | 연 1~4회/종목 | 배당 갭 패턴 | 12월 말 집중 |
| IPO/상장폐지 | 수시 | 신규 종목 데이터 부족 | 최소 60일 필요 |

참고문헌:
- Stigler, G.J. (1971). The Theory of Economic Regulation. *Bell Journal of Economics*, 2(1), 3-21.
- Nordhaus, W.D. (1975). The Political Business Cycle. *RES*, 42(2), 169-190.
- Miller, E. (1977). Risk, Uncertainty, and Divergence of Opinion. *JF*, 32(4), 1151-1168.
- Beber, A. & Pagano, M. (2013). Short-Selling Bans Around the World: Evidence from the 2007-09 Crisis. *JF*, 68(1), 343-381.
- Peltzman, S. (1976). Toward a More General Theory of Regulation. *JLE*, 19(2), 211-240.

---

## 9. 대리인 비용 × 산업 집중도 교호 효과 (Interaction Effects)

### 9.1 ARI와 HHI의 결합

대리인 비용(ARI)과 산업 집중도(HHI)는 독립적으로 작용하지 않는다. 두 요소의
교호작용을 고려한 통합 보정 공식을 설계한다.

```
통합 보정 (Combined Adjustment):

  conf_final = conf_base
               × (1 - ARI_CONFIDENCE_DECAY × ARI)       ... 대리인 비용 할인
               × (1 + mean_reversion_boost)              ... HHI 부스트 (해당 패턴만)

  여기서:
    ARI_CONFIDENCE_DECAY = 0.20 (상수 #166)
    mean_reversion_boost = HHI_MEAN_REV_COEFF × HHI × eps_stability
    HHI_MEAN_REV_COEFF = 0.10 (상수 #167)

교호 효과 시나리오:

  시나리오 A: 저 ARI + 고 HHI (최적)
    — 예: 삼성전자 (양호한 거버넌스 + 복점 구조)
    — ARI ≈ 0.15, HHI ≈ 0.45, eps_stability ≈ 0.6
    — 대리인 할인: ×0.97
    — HHI 부스트: ×1.027
    — 순효과: conf_base × 0.997 (거의 중립, 약간 음)
    — 해석: 좋은 거버넌스 + 안정적 산업구조 → 패턴 신뢰도 유지

  시나리오 B: 고 ARI + 고 HHI (상쇄)
    — 예: 재벌 계열 에너지사 (내부거래 多 + 과점)
    — ARI ≈ 0.50, HHI ≈ 0.30, eps_stability ≈ 0.7
    — 대리인 할인: ×0.90
    — HHI 부스트: ×1.021
    — 순효과: conf_base × 0.919 (~8.1% 할인)
    — 해석: HHI 효과가 대리인 비용을 부분 상쇄하지만 불충분

  시나리오 C: 고 ARI + 저 HHI (최악)
    — 예: KOSDAQ 소형주 (약한 거버넌스 + 경쟁적 시장)
    — ARI ≈ 0.60, HHI ≈ 0.05, eps_stability ≈ 0.25
    — 대리인 할인: ×0.88
    — HHI 부스트: ×1.001
    — 순효과: conf_base × 0.881 (~11.9% 할인)
    — 해석: 양 요소 모두 부정적 → 패턴 신뢰도 최대 할인

  시나리오 D: 저 ARI + 저 HHI (중립)
    — 예: 경쟁적 산업의 우량 중견기업
    — ARI ≈ 0.10, HHI ≈ 0.08, eps_stability ≈ 0.5
    — 대리인 할인: ×0.98
    — HHI 부스트: ×1.0004
    — 순효과: conf_base × 0.980 (~2% 할인)
    — 해석: 두 보정 모두 소폭 → 기본 패턴 신뢰도에 근접
```

### 9.2 "조용한 삶" 문제 (Quiet Life Problem)

Hicks (1935)의 통찰: "독점 이윤의 최대 장점은 조용한 삶이다." 이 문제는
HHI↑ → ARI↑의 간접 경로를 형성한다.

```
Quiet Life Hypothesis:
  독점/과점 기업 경영자는 경쟁 압력이 낮으므로:
  — 비용 절감 노력 감소 (X-inefficiency, Leibenstein 1966)
  — 혁신 투자 감소 (Schumpeter와 대립하는 Arrow 1962 견해)
  — 과잉 인력/시설 유지

  결과: HHI↑ → 경쟁 압력↓ → 대리인 비용(ARI)↑

이 간접 효과는 현재 모형에서 명시적으로 모형화하지 않는다.
이유: ARI 자체가 ROE 역수 등을 포함하므로, "조용한 삶"의 결과가
간접적으로 ARI에 반영되기 때문이다.

그러나 주의: HHI와 ARI 사이의 양의 상관관계가 존재하면,
두 보정의 독립적 적용이 과소/과대 보정될 수 있다.
향후 실증 분석에서 HHI-ARI 상관계수를 측정하여
교호항(interaction term) 추가 여부를 결정해야 한다.
```

---

## 10. 학습 가능 상수 요약 (Learnable Constants Summary)

본 문서에서 도입한 상수 (#166-#168):

> **번호 재배정 (Renumbering):** 원래 #118-#120으로 배정되었으나, Doc 32의
> VALUATION_SR_STRENGTH가 #118을 선점하여 충돌이 발생했다.
> Doc 22의 마지막 등록 상수(#165) 이후 순번인 #166-#168로 재배정한다.

| # | 상수명 | 위치(예정) | 현재값 | 등급 | 학습 | 범위 | 출처 |
|---|-------|----------|-------|------|------|------|------|
| 166 | ARI_CONFIDENCE_DECAY | patterns.js | 0.20 | [C] | [L:WLS] | 0.10-0.35 | Jensen & Meckling (1976) 대리인 비용 문헌 |
| 167 | HHI_MEAN_REV_COEFF | patterns.js | 0.10 | [C] | [L:WLS] | 0.05-0.20 | Cowling-Waterson (1976) HHI-마진 관계 |
| 168 | CHAEBOL_TUNNELING_THRESHOLD | patterns.js | 0.30 | [D] | [L:MAN] | 0.20-0.40 | Bae et al. (2002) 한국 재벌 실증 |

**등급 분류 근거:**

- **[C] 보정 가능 (상수 #166, #167):** 이론적 방향은 명확하지만(대리인 비용↑ →
  패턴 신뢰도↓, HHI↑ → mean-reversion 신뢰도↑), 정확한 크기는 KRX 데이터
  백테스트로 교정해야 한다. WLS 기반 교정이 적합하다 (Doc 17 §2 참조).

  - **#166 ARI_CONFIDENCE_DECAY = 0.20:** Jensen & Meckling의 정성적 예측을
    정량화한 값. 0.20은 "패턴 신뢰도의 최대 20%가 대리인 비용에 귀속"이라는
    보수적 추정. 0.10 미만이면 거버넌스 효과가 과소평가되고, 0.35 초과이면
    기술적 패턴의 가격 발견 기능을 과도하게 부정하는 것이다.

  - **#167 HHI_MEAN_REV_COEFF = 0.10:** Cowling-Waterson의 HHI-Lerner 관계에서
    도출된 계수. 0.10은 "HHI=1(독점)이고 eps_stability=1(완벽 안정)일 때
    mean-reversion boost가 최대 10%"라는 의미. 현실에서 HHI=1은 불가능하므로
    실효 부스트 범위는 0~5%.

- **[D] 휴리스틱 (상수 #168):** CHAEBOL_TUNNELING_THRESHOLD = 0.30은 Bae et al.
  (2002)의 한국 실증에서 내부거래 비중이 높은 그룹의 터널링 빈도가 증가하는
  임계점을 참고한 값이다. 이 임계치는 공정거래법 개정, 지주회사 전환 추이,
  산업 특성에 따라 변동 가능하므로 수동(manual) 조정이 적합하다.

**기존 상수와의 상호작용:**

| 본 문서 상수 | 관련 기존 상수 | 상호작용 |
|-------------|--------------|---------|
| #166 ARI_CONFIDENCE_DECAY | #105 δ_info (Doc 31) | 정보 비대칭(#105)과 대리인 비용(#166) 이중 할인 가능. 합산 시 max(0.35) 캡 권장 |
| #167 HHI_MEAN_REV_COEFF | #102 α_cycle (Doc 31) | 경기순환 보정(#102)과 산업구조 보정(#167) 독립 적용 가능 (교호항 불필요) |
| #168 CHAEBOL_TUNNELING_THRESHOLD | #103, #104 β_chaebol (Doc 31) | RPRR > #168 시 #103-#104 보정 활성화. 연쇄 적용 설계 |

---

## 11. 구현 로드맵 (Implementation Roadmap)

### Phase 1: 즉시 구현 가능 (기존 데이터 활용)

```
1. 간소화 ARI (ROE + CAPEX 기반):
   — data/financials/{code}.json에서 ROE 추출 (기 구현)
   — 유형자산 증가분에서 CAPEX 추정
   — ARI_simplified = 0.55 × ROE_inv + 0.45 × CAPEX_excess
   — patterns.js 또는 backtester.js에서 conf 보정 적용

2. 산업별 HHI 상수 테이블:
   — data/sector_fundamentals.json에 HHI 필드 추가
   — 10대 산업 HHI 값을 §5.3 추정치로 초기화
   — download_sector.py에서 매출액 기반 자동 계산

3. eps_stability 계산:
   — 최근 8분기 EPS 데이터 필요
   — data/financials/{code}.json에서 추출
   — eps_stability = 1 / (1 + std(EPS_growth_rates))
```

### Phase 2: DART 확장 (추가 데이터 수집)

```
4. 이사회 독립성 (BI):
   — DART 사업보고서 > 임원 현황 파싱
   — download_financials.py 확장 또는 별도 스크립트

5. 관계사 매출 비중 (RPRR):
   — DART 사업보고서 > 특수관계자 거래 주석 파싱
   — 공정거래위원회 대규모 기업집단 현황 API 연동

6. 완전 ARI 계산:
   — 4개 지표 통합
   — data/governance/{code}.json 생성
```

### Phase 3: 교정 및 검증

```
7. 백테스트 기반 상수 교정:
   — #166 ARI_CONFIDENCE_DECAY: ARI 분위별 패턴 성공률 비교
   — #167 HHI_MEAN_REV_COEFF: 산업별 mean-reversion 패턴 수익률 비교
   — #168 CHAEBOL_TUNNELING_THRESHOLD: RPRR 분위별 초과수익률 분석

8. 교호항 검증:
   — ARI × HHI 교호항 유의성 테스트
   — WLS 회귀에서 교호항 포함 여부 결정
```

---

## 12. 참고문헌 (References)

1. Jensen, M.C. & Meckling, W.H. (1976). Theory of the Firm: Managerial Behavior, Agency Costs and Ownership Structure. *JFE*, 3(4), 305-360.
2. Holmstrom, B. (1979). Moral Hazard and Observability. *Bell Journal of Economics*, 10(1), 74-91.
3. Holmstrom, B. & Milgrom, P. (1991). Multitask Principal-Agent Analyses: Incentive Contracts, Asset Ownership, and Job Design. *JLEO*, 7(special), 24-52.
4. Jensen, M.C. (1986). Agency Costs of Free Cash Flow, Corporate Finance, and Takeovers. *AER*, 76(2), 323-329.
5. Herfindahl, O.C. (1950). Concentration in the U.S. Steel Industry. PhD Dissertation, Columbia University.
6. Hirschman, A.O. (1964). The Paternity of an Index. *AER*, 54(5), 761-762.
7. Lerner, A.P. (1934). The Concept of Monopoly and the Measurement of Monopoly Power. *RES*, 1(3), 157-175.
8. Cowling, K. & Waterson, M. (1976). Price-Cost Margins and Market Structure. *Economica*, 43(171), 267-274.
9. Bae, K.-H., Kang, J.-K. & Kim, J.-M. (2002). Tunneling or Value Added? Evidence from Mergers by Korean Business Groups. *JF*, 57(6), 2695-2740.
10. Friedman, E., Johnson, S. & Mitton, T. (2003). Propping and Tunneling. *JCE*, 31(4), 732-750.
11. Claessens, S., Djankov, S. & Lang, L.H.P. (2000). The Separation of Ownership and Control in East Asian Corporations. *JFE*, 58(1-2), 81-112.
12. Johnson, S., La Porta, R., Lopez-de-Silanes, F. & Shleifer, A. (2000). Tunneling. *AER P&P*, 90(2), 22-27.
13. Coase, R.H. (1937). The Nature of the Firm. *Economica*, 4(16), 386-405.
14. Williamson, O.E. (1975). *Markets and Hierarchies: Analysis and Antitrust Implications*. Free Press.
15. Williamson, O.E. (1985). *The Economic Institutions of Capitalism*. Free Press.
16. Stigler, G.J. (1971). The Theory of Economic Regulation. *Bell Journal of Economics*, 2(1), 3-21.
17. Peltzman, S. (1976). Toward a More General Theory of Regulation. *JLE*, 19(2), 211-240.
18. Nordhaus, W.D. (1975). The Political Business Cycle. *RES*, 42(2), 169-190.
19. Miller, E. (1977). Risk, Uncertainty, and Divergence of Opinion. *JF*, 32(4), 1151-1168.
20. Beber, A. & Pagano, M. (2013). Short-Selling Bans Around the World: Evidence from the 2007-09 Crisis. *JF*, 68(1), 343-381.
21. Gibbons, R. & Murphy, K. (1992). Optimal Incentive Contracts in the Presence of Career Concerns: Theory and Evidence. *JPE*, 100(3), 468-505.
22. Morck, R., Shleifer, A. & Vishny, R.W. (1990). Do Managerial Objectives Drive Bad Acquisitions? *JF*, 45(1), 31-48.
23. Hicks, J.R. (1935). Annual Survey of Economic Theory: The Theory of Monopoly. *Econometrica*, 3(1), 1-20.
24. Leibenstein, H. (1966). Allocative Efficiency vs. "X-Efficiency". *AER*, 56(3), 392-415.
25. Arrow, K.J. (1962). Economic Welfare and the Allocation of Resources for Invention. In *The Rate and Direction of Inventive Activity*. NBER.
26. Demsetz, H. (1973). Industry Structure, Market Rivalry, and Public Policy. *JLE*, 16(1), 1-9.
27. Schmalensee, R. (1989). Inter-Industry Studies of Structure and Performance. In *Handbook of Industrial Organization*, Vol. 2. North-Holland.
28. Tirole, J. (1988). *The Theory of Industrial Organization*. MIT Press.
29. Akerlof, G. (1970). The Market for "Lemons": Quality Uncertainty and the Market Mechanism. *QJE*, 84(3), 488-500.
30. Spence, M. (1973). Job Market Signaling. *QJE*, 87(3), 355-374.
31. Fama, E. & Jensen, M.C. (1983). Separation of Ownership and Control. *JLE*, 26(2), 301-325.
32. Shleifer, A. & Vishny, R.W. (1997). A Survey of Corporate Governance. *JF*, 52(2), 737-783.

---

*본 문서의 ARI, HHI 보정 공식은 Doc 31의 미시경제학 프레임워크를 기업 거버넌스와
산업구조 차원으로 확장한다. 패턴 신뢰도의 최종 보정은 Doc 31의 정보 비대칭 보정,
Doc 29의 거시 레짐 보정, 본 문서의 거버넌스/산업 보정이 곱셈적(multiplicative)으로
결합된다. 개별 보정의 크기는 작지만(각 2~12%), 복합 적용 시 패턴 품질 분별력의
의미 있는 개선을 기대할 수 있다.*
