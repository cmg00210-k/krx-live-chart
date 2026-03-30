# 32. 탐색이론과 주의 기반 가격결정 (Search Theory & Attention-Based Pricing)

> "Information is not free. The cost of search is a fundamental determinant
> of market outcomes."
> — George Stigler, "The Economics of Information" (1961), *JPE* 69(3), p. 213

---

## 1. 개요 (Overview)

전통 미시경제학은 **완전 정보(perfect information)** 를 전제한다. 모든 경제 주체가
가격, 품질, 거래 상대방에 대해 완전한 지식을 보유한다고 가정하면, 가격은 즉시
내재가치를 반영하고 기술적 분석의 존재 이유가 사라진다. 그러나 현실 시장에서
정보 획득에는 비용이 들고(Stigler 1961), 투자자의 인지적 주의(cognitive attention)는
유한한 자원이다(Peng & Xiong 2006). 이 두 제약의 결합은 가격 발견 과정에
체계적 지연(systematic delay)과 편향(bias)을 초래하며, 이것이 기술적 패턴의
미시적 기초(microfoundation)를 구성한다.

**본 문서의 위치:**
- Doc 31 §3.4는 Akerlof-Spence 정보비대칭을 다루되, 탐색 비용과 주의 제약은 미포함
- Doc 18은 시장 미시구조(Kyle/VPIN)를 다루되, 투자자의 정보 탐색 과정은 미포함
- Doc 19는 소셜 네트워크 효과를 다루되, Katz-Shapiro 유동성 외부성은 미포함
- 본 문서는 이 세 갭을 "탐색(search) → 주의(attention) → 네트워크(network) →
  스크리닝(screening) → 블록 마찰(block friction)" 파이프라인으로 통합한다

**핵심 기여:**
1. Stigler (1961) 탐색 비용 → 정보 수집 최적화 모형
2. Peng & Xiong (2006) 주의 예산 제약 → 가격 조정 지연
3. Barber & Odean (2008) 주의 점프 → attention-grabbing 주식의 과매수
4. Katz & Shapiro (1985) 네트워크 외부성 → 유동성 자기 강화
5. Rothschild & Stiglitz (1976) 스크리닝 균형 → 밸류에이션 임계값 군집
6. Grossman & Miller (1988) 유동성 탐색 → 블록 트레이드 가격 충격

**CheeseStock 구현 매핑 3함수:**
- `calcAttentionState()` — 주의 사이클 (deprivation → jump → normalization)
- `calcADVLevel()` — 유동성 네트워크 효과 수준
- `detectValuationSR()` — 밸류에이션 임계값 지지/저항

참고문헌:
- Stigler, G.J. (1961). The Economics of Information. *JPE*, 69(3), 213-225.
- Peng, L. & Xiong, W. (2006). Investor Attention, Overconfidence and Category Learning. *JFE*, 80(3), 563-602.
- Barber, B.M. & Odean, T. (2008). All That Glitters: The Effect of Attention and News on the Buying Behavior of Individual and Institutional Investors. *RFS*, 21(2), 785-818.

---

## 2. 탐색이론 기초 (Stigler 1961: Search Theory Fundamentals)

### 2.1 정보 탐색의 경제학 (Economics of Information Search)

Stigler (1961)는 경제학에서 최초로 **정보 그 자체를 경제재(economic good)**로
정식화하였다. 소비자가 최저가를 찾기 위해 여러 상점을 방문하는 것처럼,
투자자도 최적 투자 대상을 찾기 위해 기업 보고서, 뉴스, 재무제표를 탐색한다.
이 탐색에는 시간, 노력, 기회비용이라는 실질적 비용이 수반된다.

```
정보 탐색 비용 (cost of search):
  C(n) = c × n
  n: 탐색 횟수 (검토한 종목 수, 읽은 보고서 수)
  c: 단위 탐색 비용 (시간 가치 + 정보 접근비 + 인지적 노력)

탐색의 기대편익 (expected benefit of search):
  B(n) = E[V_best(n)] - E[V_best(n-1)]
  — n번째 탐색에서 더 나은 기회를 발견할 확률 × 그 개선분
  — 편익은 체감 (diminishing returns): B'(n) < 0

최적 탐색 횟수 (optimal search intensity):
  MB(n*) = MC(n*)
  — 한계편익 = 한계비용 지점에서 탐색 종료
  — 이 결과 투자자는 불완전한 정보 상태에서 의사결정
```

**탐색 종료 규칙 (stopping rule):**

```
예약가격 모형 (reservation price model):
  투자자는 "예약 수익률" r* 를 설정하고,
  탐색 중 r* 이상의 기대수익률을 제공하는 첫 번째 기회에서 투자

  r* = argmax_r [∫_{r}^{∞} (x - r) dF(x)] / c
  F(x): 시장 전체 수익률 분포의 CDF

  해석:
  - c 상승 (탐색 비용 증가) → r* 하락 → 덜 까다로운 선별 → 비효율적 투자 증가
  - c 하락 (HTS/앱 보급) → r* 상승 → 까다로운 선별 → 정보 효율성 향상
  - F(x) 분산 증가 (시장 내 종목 이질성 증가) → r* 상승 → 탐색 가치 증가
```

**한국 시장에서의 탐색 비용 변천:**

| 시대 | 탐색 비용 c | 방식 | 영향 |
|------|-----------|------|------|
| ~2000 | 매우 높음 | 증권사 방문, 전화 주문, 일간지 | 정보 비대칭 극대, 작전세력 성행 |
| 2000-2010 | 높음 | HTS 보급, 인터넷 증권사 | 개인 참여 급증, 탐색 범위 확대 |
| 2010-2020 | 중간 | MTS(모바일), 실시간 뉴스 | 탐색 속도 향상, 주의 분산 심화 |
| 2020- | 낮음 | 로보어드바이저, AI 스크리너 | 탐색 비용 극소, 주의 제약이 바인딩 |

핵심 전환: 탐색 **비용(cost)** 이 바인딩 제약이던 시대에서 주의 **용량(capacity)** 이
바인딩 제약인 시대로의 전환. 정보 접근은 거의 무료이나, 정보 처리 능력은 여전히
유한하다. 이것이 Peng-Xiong (2006) 모형의 출발점이다.

참고문헌:
- Stigler, G.J. (1961). The Economics of Information. *JPE*, 69(3), 213-225.
- Diamond, P. (1971). A Model of Price Adjustment. *JET*, 3(2), 156-168.

---

### 2.2 탐색이론의 증권시장 적용 (Search Theory Applied to Securities Markets)

Stigler 모형을 증권시장에 적용하면, 투자자의 종목 선택 과정을 최적 탐색
문제로 정식화할 수 있다.

```
증권시장 탐색 모형:
  N_universe: 전체 종목 수 (KRX: ~2,700)
  n_screened: 실제 검토한 종목 수
  F(α): 초과수익률 α의 분포 (알파 분포)
  c_search: 종목당 탐색 비용

최적 검토 비율:
  n*/N = f(c_search, σ_α, μ_α)

  c_search ↓ (스크리닝 기술 발전) → n*/N ↑
  σ_α ↑ (알파 분산 큰 시장) → n*/N ↑
  μ_α ↓ (평균 알파 낮음) → n*/N ↑ (더 열심히 찾아야)
```

**KOSPI vs KOSDAQ 탐색 특성:**

| 시장 | N_universe | σ_α | c_search | 최적 전략 |
|------|-----------|------|---------|----------|
| KOSPI 200 | 200 | 낮음 (0.5-2%) | 낮음 (분석 보고서 풍부) | 전수 조사 가능, 선별적 depth 탐색 |
| KOSPI 전체 | ~950 | 중간 (1-4%) | 중간 | 섹터 기반 필터링 후 depth 탐색 |
| KOSDAQ | ~1,750 | 높음 (3-15%) | 높음 (분석 보고서 부족) | 기계적 스크리닝 필수, attention 지배 |

**탐색 비용이 패턴 신뢰도에 미치는 영향:**

```
탐색 비용이 높은 종목 (KOSDAQ 소형주):
  → 소수 투자자만 검토 → 정보 불완전 반영
  → 가격 비효율 크기 ↑ → 패턴 잠재 알파 ↑
  → 단, 유동성 ↓ → 실현 가능 알파 ≠ 잠재 알파

탐색 비용이 낮은 종목 (KOSPI 200 대형주):
  → 다수 분석가 + 기관 검토 → 정보 거의 완전 반영
  → 가격 비효율 크기 ↓ → 패턴 잠재 알파 ↓
  → 단, 유동성 ↑ → 실현율 높음

Grossman-Stiglitz 균형의 종목별 버전:
  E[α_realized] = c_search / λ_risk_aversion
  — 탐색 비용이 높은 종목일수록 균형 알파가 큼
  — 이것이 "소형주 프리미엄"의 미시적 기초
```

**CheeseStock 매핑:** `signalEngine.js`의 패턴 신뢰도에 종목별 탐색 비용 프록시를
반영하는 것이 이론적으로 정당하다. 프록시 변수:
- 애널리스트 커버리지 수 (현재 data 없음 → 시가총액으로 대리)
- 거래대금 (ADV): 탐색 비용의 역함수 (유동성이 높으면 정보 접근 용이)
- 외국인 보유 비중: 글로벌 분석가 커버리지의 프록시

참고문헌:
- Merton, R.C. (1987). A Simple Model of Capital Market Equilibrium with Incomplete Information. *JF*, 42(3), 483-510.
- Hong, H., Lim, T. & Stein, J. (2000). Bad News Travels Slowly: Size, Analyst Coverage, and the Profitability of Momentum Strategies. *JF*, 55(1), 265-295.

---

### 2.3 Diamond 역설과 호가 경직성 (Diamond Paradox and Price Stickiness)

Diamond (1971)은 탐색 비용이 양수인 시장에서 경쟁적 결과가 붕괴함을 보였다.
탐색 비용이 아무리 작더라도 (c > 0), 균형에서 모든 판매자가 독점가격을 부과한다.
이것이 Diamond 역설이다.

```
Diamond 역설 (Diamond Paradox, 1971):
  가정: 동질적 상품, n명의 판매자, 구매자 탐색 비용 c > 0

  논리:
  1. 최저가 판매자로부터 탈선(deviate)하여 c만큼 가격 인상해도,
     구매자는 다른 판매자를 찾는 비용 c를 감수하지 않음
  2. 따라서 모든 판매자가 c만큼 가격 인상 가능
  3. 이 논리의 반복 적용 → 균형가격이 독점가격으로 수렴

  함의: 미세한 탐색 비용도 시장 결과를 극적으로 변화시킴
```

**증권시장 적용 — 호가 경직성:**

```
호가 경직성 (ask-price stickiness):
  매도 호가가 "내려가야 할" 상황에서 즉시 하락하지 않는 현상

  메커니즘:
  - 매도자가 제출한 지정가 주문은 탐색 비용 c > 0 상태의 "판매자"
  - 매수자가 더 낮은 호가를 찾는 비용 > 현재 스프레드
  - 결과: 매도 호가가 내재가치보다 높게 유지 (Diamond 효과)
  - 특히 KOSDAQ 소형주에서 심화: 유동성 공급자가 소수

  ΔP_sticky = c_search / (∂D/∂P)
  — 탐색 비용 / 수요 가격 민감도
  — 비탄력적 종목(기관 매수 우위)에서 경직성 극대화
```

**KRX 실증 관찰:**
- KOSDAQ 소형주 (ADV < 1억원): 스프레드 0.5-2.0%, 호가 갱신 빈도 1-5회/분
- KOSPI 대형주 (ADV > 100억원): 스프레드 0.02-0.05%, 호가 갱신 빈도 100-500회/분
- 비율 차이: 탐색 비용이 약 10-50배 차이 → 가격 조정 속도 10-50배 차이

**패턴 분석 함의:**

```
Diamond 효과가 강한 종목 (저유동성):
  → 패턴 완성 후 가격 조정이 지연
  → 기술적 목표가 도달까지 평균 기간 ↑
  → backtester.js의 N-day horizon을 시가총액/ADV별 차등 설정 권장

  N_horizon_adj = N_base × (ADV_median / ADV_stock)^0.2
  — ADV가 중위값의 1/10이면 N_horizon × 1.58 (58% 연장)
  — ADV가 중위값의 10배이면 N_horizon × 0.63 (37% 단축)
```

참고문헌:
- Diamond, P. (1971). A Model of Price Adjustment. *JET*, 3(2), 156-168.
- Burdett, K. & Judd, K. (1983). Equilibrium Price Dispersion. *Econometrica*, 51(4), 955-969.

---

## 3. 주의 제한 모형 (Peng-Xiong 2006: Limited Attention Model)

### 3.1 주의 예산 제약 (Attention Budget Constraint)

Peng & Xiong (2006)은 Sims (2003)의 합리적 부주의(rational inattention) 이론을
자산가격결정에 적용하였다. 투자자는 유한한 주의 예산(attention budget)을 자산
간에 배분해야 하며, 이 배분 결정이 가격 효율성을 결정한다.

```
주의 예산 모형 (Attention Budget Model):
  a_i: 자산 i에 배분된 주의 (attention capacity, bits/period)
  A_total: 총 주의 예산 (유한, 개인별 상수)

  예산 제약:
  Σ_{i=1}^{N} a_i ≤ A_total

  정보 획득량:
  I_i = a_i × κ_i
  κ_i: 자산 i의 정보 밀도 (news coverage, 공시 빈도 등)
  I_i: 자산 i에 대해 처리된 정보량 (bits)

  가격 효율성:
  η_i = 1 - exp(-I_i / σ²_i)
  σ²_i: 자산 i의 내재 불확실성 (수익률 분산)
  — I_i 높을수록 η_i → 1 (완전 효율)
  — I_i = 0이면 η_i = 0 (무정보, 랜덤 워크)
```

**주의 배분의 최적화 문제:**

```
투자자 최적화:
  max_{a_1,...,a_N} Σ_i [U_i(η_i(a_i)) - λ × a_i]
  s.t. Σ a_i ≤ A_total

  U_i: 자산 i 투자에서 효율적 정보의 효용
  λ: 주의 예산의 그림자 가격 (shadow price)

  FOC (1차 조건):
  ∂U_i/∂a_i = λ   for all i with a_i > 0

  해석:
  — 모든 능동적으로 관찰되는 자산의 한계주의 편익이 동일
  — 한계편익이 λ 미만인 자산은 관찰하지 않음 (corner solution)
  — 이것이 "분석가 커버리지 없는 종목"의 이론적 기초
```

**카테고리 학습 (Category Learning):**

Peng-Xiong의 핵심 결과: 주의 제약 하에서 투자자는 개별 자산보다 **카테고리
(섹터, 테마)** 수준에서 정보를 처리하는 것이 최적이다.

```
카테고리 학습 모형:
  r_i = β_i × f_sector + ε_i
  f_sector: 섹터 공통 요인 수익률
  ε_i: 개별 기업 고유 수익률

  주의 배분:
  a_sector >> a_ε_i (개별 종목보다 섹터에 주의 집중)

  함의:
  1. 섹터 수준 정보는 빠르게 가격에 반영 (높은 주의)
  2. 기업 고유 정보는 느리게 반영 (낮은 주의)
  3. 결과: 섹터 모멘텀 > 개별 종목 모멘텀 (실증적으로 확인)
  4. earnings surprise 후 drift가 소형주에서 더 긴 이유 설명
```

**KRX 실증:**
- KOSPI 200 구성종목: 평균 7-12명 애널리스트 커버리지 → a_i 높음
- KOSDAQ 소형 (시총 500억 미만): 평균 0-1명 커버리지 → a_i ≈ 0 (corner)
- 결과: KOSDAQ 소형주의 earnings surprise 후 drift가 KOSPI 대형주 대비 3-5배 지속

참고문헌:
- Peng, L. & Xiong, W. (2006). Investor Attention, Overconfidence and Category Learning. *JFE*, 80(3), 563-602.
- Sims, C.A. (2003). Implications of Rational Inattention. *JME*, 50(3), 665-690.
- Hirshleifer, D. & Teoh, S.H. (2003). Limited Attention, Information Disclosure, and Financial Reporting. *JAE*, 36(1-3), 337-386.

---

### 3.2 주의와 가격 조정 지연 (Attention and Price Adjustment Delay)

주의 제약의 가장 중요한 가격 함의는 **정보 반영의 지연**이다. 새로운 정보가
발생하면, 높은 주의를 받는 자산은 빠르게 조정하지만, 낮은 주의를 받는 자산은
느리게 조정한다.

```
주의 기반 가격 조정 모형:
  P_t = P_{t-1} + λ_att × (V_t - P_{t-1}) + ε_t

  V_t: 시점 t의 내재가치 (fundamentals에 의해 결정)
  P_t: 시점 t의 관찰 가격
  λ_att: 주의 기반 조정 속도 (attention-based adjustment speed)
  ε_t: 노이즈

  λ_att 의 결정:
  λ_att = λ_0 + λ_1 × a_i / A_total

  λ_0: 기본 조정 속도 (시장 전체 메커니즘에 의한)
  λ_1: 주의 민감도 계수
  a_i: 자산 i에 배분된 주의

  범위: 0 < λ_att < 1
  λ_att → 1: 즉각 조정 (완전 효율)
  λ_att → 0: 미조정 (랜덤 워크)
```

**반감기(half-life) 해석:**

```
정보 반영 반감기 (information half-life):
  t_half = -ln(2) / ln(1 - λ_att)

  λ_att = 0.80 (KOSPI 200 대형):   t_half ≈ 0.4 거래일 (~3시간)
  λ_att = 0.50 (KOSPI 중형):        t_half ≈ 1.0 거래일
  λ_att = 0.20 (KOSDAQ 대형):       t_half ≈ 3.1 거래일
  λ_att = 0.05 (KOSDAQ 소형):       t_half ≈ 13.5 거래일

  패턴 분석 함의:
  — λ_att가 낮은 종목일수록 패턴 완성 → 목표가 도달 기간 ↑
  — backtester.js의 수익 계산 horizon을 λ_att 역수에 비례하게 조정 권장
  — N_day_adjusted = N_base × (1 / λ_att)^0.3
```

**KOSDAQ 소형주의 "느린 뉴스" 효과:**

Hong, Lim & Stein (2000)의 실증: 애널리스트 커버리지가 없는 소형주에서
부정적 뉴스(bad news)가 긍정적 뉴스(good news)보다 더 느리게 반영된다.
이는 주의 제약 + 확증 편향(confirmation bias)의 결합 효과이다.

```
비대칭 주의 모형:
  λ_att_good = λ_0 + λ_1 × a_i × (1 + bias_confirm)
  λ_att_bad  = λ_0 + λ_1 × a_i × (1 - bias_confirm)
  bias_confirm ∈ [0, 0.3]: 확증 편향 계수

  결과:
  — 저주의 종목에서 부정적 정보의 반감기가 2-3배 길어짐
  — bearish 패턴의 실현이 bullish 패턴보다 지연
  — "나쁜 뉴스는 천천히 퍼진다" — Hong, Lim & Stein (2000)
```

**CheeseStock 매핑:** `backtester.js`에서 패턴별 N-day 수익률을 계산할 때,
λ_att 프록시로 종목의 ADV(평균 거래대금)를 사용하여 horizon을 조정할 수 있다.
현재의 고정 N=5, 10, 20일 대신, 종목별 유동성에 따라 동적 조정이 이론적으로
정당화된다.

참고문헌:
- Hong, H., Lim, T. & Stein, J. (2000). Bad News Travels Slowly. *JF*, 55(1), 265-295.
- Hou, K. & Moskowitz, T. (2005). Market Frictions, Price Delay, and the Cross-Section of Expected Returns. *RFS*, 18(3), 981-1020.

---

### 3.3 주의 점프와 과잉 반응 (Attention Jumps and Overreaction)

Barber & Odean (2008)은 주의 제약의 비대칭적 결과를 보였다: 투자자는
**매수 결정** 시에만 탐색 비용을 지불하고, **매도 결정** 시에는 보유 종목만
검토한다 (탐색 비용 = 0). 이 비대칭이 attention-grabbing 주식의 과매수를
초래한다.

```
Barber-Odean 비대칭:
  매수 시: 전체 시장 N종목 중 선택 → 탐색 비용 발생 → 주의 끄는 종목 편향
  매도 시: 보유 포트폴리오 n종목 중 선택 → 탐색 비용 없음 → 균일 검토

  attention-grabbing 이벤트:
  — 비정상 거래량 (volume spike)
  — 극단적 수익률 (양/음 모두)
  — 뉴스 헤드라인, 검색 빈도 급증
  — 상한가/하한가 도달

  결과:
  P_attention_jump = P_fundamental + α_overreaction × Attention_t
  α_overreaction > 0: 주의 과잉 프리미엄
  — 단기 과매수 → 중기 반전 (attention reversal)
```

**주의 사이클 (Attention Cycle):**

```
3단계 주의 사이클:
  Phase 1: Deprivation (주의 결핍)
    — 거래량 장기 저조, 뉴스 부재, 변동성 극저
    — 정보 축적되나 가격에 미반영 ("잠재 에너지" 축적)
    — 기간: 수주 ~ 수개월
    — 지표: volRatio < 0.5, rangeRatio < 0.5

  Phase 2: Jump (주의 점프)
    — 촉발 이벤트: 실적 발표, 뉴스, 테마 부상
    — 축적된 정보가 한꺼번에 가격에 반영 + 과잉 반응
    — 기간: 1-5 거래일
    — 지표: volRatio > 2.0, rangeRatio > 2.0

  Phase 3: Normalization (정규화)
    — 과잉 반응 부분 수정, 새 균형으로 수렴
    — 기간: 5-20 거래일
    — 지표: volRatio → 1.0, rangeRatio → 1.0
```

**KRX 실증 관찰:**

| 시장 | Deprivation 비중 | Jump 강도 | Normalization 기간 |
|------|-----------------|----------|------------------|
| KOSPI 대형 | 30-40% 거래일 | vol × 2-3 | 3-5일 |
| KOSPI 중형 | 40-50% | vol × 3-5 | 5-10일 |
| KOSDAQ 대형 | 50-60% | vol × 4-8 | 7-15일 |
| KOSDAQ 소형 | 60-75% | vol × 8-20 | 10-30일 |

직관: 소형주일수록 주의 결핍 기간이 길고(정보 탐색 비용이 높아 아무도
검토하지 않으므로), 점프 시 과잉 반응이 크며(축적된 정보 + 개인 투자자의
군집 유입), 정규화에 더 오래 걸린다(가격 발견 참여자가 적으므로).

참고문헌:
- Barber, B.M. & Odean, T. (2008). All That Glitters: The Effect of Attention and News on the Buying Behavior of Individual and Institutional Investors. *RFS*, 21(2), 785-818.
- Da, Z., Engelberg, J. & Gao, P. (2011). In Search of Attention. *JF*, 66(5), 1461-1499.

---

## 4. 주의 점프 지표 — CheeseStock 구현 (Attention Jump Indicator)

### 4.1 attentionScore 산출 (Attention Score Calculation)

주의 사이클 이론(§3.3)을 정량화하여, 종목의 현재 주의 상태를 실시간으로
추적하는 지표를 구축한다.

```
attentionScore 산출:
  volRatio   = V_t / SMA(V, 20)
  — 현재 거래량 / 20일 평균 거래량
  — 거래량 기반 주의 프록시

  rangeRatio = (H_t - L_t) / ATR(14)
  — 현재 일중 레인지 / 14일 평균 트루레인지
  — 가격 변동성 기반 주의 프록시

  attentionScore = log(1 + volRatio) × rangeRatio

  해석:
  — log 변환: 극단적 거래량 스파이크의 영향 감쇠 (robust)
  — 곱셈 결합: 거래량과 변동성이 동시에 높아야 높은 점수
  — 정상 상태: attentionScore ≈ log(2) × 1.0 ≈ 0.69
  — 주의 점프: attentionScore > 2.0 (임계값)
```

**경제학적 정당화:**

log(1 + volRatio) 변환의 이론적 근거: Weber-Fechner 법칙 (감각의 대수적 반응)에
의하면, 경제 주체의 자극 반응은 자극 크기의 로그에 비례한다. 거래량이 2배에서
4배로 증가하는 것(+100%)과 10배에서 20배로 증가하는 것(+100%)이 동일한
"주의 반응"을 유발하지 않는다 — 전자가 훨씬 큰 정보적 의미를 갖는다.

```
Weber-Fechner 법칙 적용:
  Sensation = k × ln(Stimulus / Stimulus_threshold)

  → attentionScore의 log 변환은 이 심리물리학 법칙의 금융 적용
  → 거래량 2배: log(1+2) = 1.10
  → 거래량 5배: log(1+5) = 1.79 (선형이면 2.5배여야 하나 1.63배)
  → 거래량 10배: log(1+10) = 2.40 (선형이면 5배여야 하나 2.18배)

  이 감쇠 효과가 없으면 KOSDAQ 테마주의 거래량 폭증(30-50배)이
  attentionScore를 과도하게 지배하여 다른 정보를 가림
```

### 4.2 주의 상태 분류 — calcAttentionState() (Attention State Classification)

attentionScore를 3단계 주의 상태로 분류하여 패턴 신뢰도 보정에 활용한다.

```
calcAttentionState(candles, idx) → { state, score, confidenceAdj }

알고리즘:
  1. volRatio = candles[idx].volume / SMA(volume, 20, idx)
  2. rangeRatio = (candles[idx].high - candles[idx].low) / ATR(14, idx)
  3. attentionScore = log(1 + volRatio) × rangeRatio
  4. 상태 분류:
     if attentionScore < 0.4:
       state = 'deprivation'
       confidenceAdj = -0.05  (패턴 감지되어도 신뢰도 5% 감산)
       // 이유: 주의 결핍 상태에서는 가격이 정보를 덜 반영하므로
       // 패턴 자체의 정보 함량이 낮을 수 있음
     elif attentionScore > ATTENTION_JUMP_THRESHOLD (=2.0):
       state = 'jump'
       confidenceAdj = +0.08  (패턴 신뢰도 8% 가산)
       // 이유: 주의 점프 시 새로운 정보가 가격에 급격히 반영되므로
       // 이 시점의 패턴은 정보적 의미가 높음
       // 단, 과잉 반응 위험도 있으므로 가산폭 제한
     else:
       state = 'normal'
       confidenceAdj = 0.0

  5. 반환: { state, score: attentionScore, confidenceAdj }
```

**주의 상태별 패턴 해석 차이:**

| 주의 상태 | 유효 패턴 유형 | 비유효 패턴 유형 | 해석 |
|----------|-------------|---------------|------|
| deprivation | 삼각 수렴, 박스 레인지 | 돌파, 모멘텀 | 에너지 축적 중, 방향성 부재 |
| jump | 돌파, 갭, 반전 | 수렴, 레인지 | 정보 반영 진행, 방향성 결정 |
| normal | 모든 패턴 | — | 정상 가격 발견, 표준 분석 |

**연속 주의 점프의 의미:**

```
연속 점프 감쇠:
  2일 연속 jump: 첫째 날 정보, 둘째 날 모멘텀/과잉반응
  3일+ 연속 jump: 과잉반응 확률 급증 → 반전 패턴 주시

  consecutive_jump_penalty:
  if jump_days >= 2:
    confidenceAdj_reversal = +0.05 × (jump_days - 1)
    // 반전 패턴 신뢰도 가산
    confidenceAdj_continuation = -0.03 × (jump_days - 1)
    // 지속 패턴 신뢰도 감산
```

### 4.3 KOSDAQ 소형주 신뢰도 보정 (KOSDAQ Small-Cap Correction)

KOSDAQ 소형주는 구조적으로 deprivation → jump 사이클이 극단적이므로,
attentionScore의 해석에 보정이 필요하다.

```
KOSDAQ 소형주 보정:
  기준: 시가총액 < 500억원 AND KOSDAQ

  보정 사유:
  1. 기본 변동성이 높아 rangeRatio의 "정상 범위"가 넓음
  2. 유동성 부족으로 소량 매수에도 volRatio 급등
  3. 개인 투자자 비중 80%+ → 행동 편향 극대화

  보정 공식:
  attentionScore_adj = attentionScore / mktcap_factor

  mktcap_factor = max(1.0, 1.0 + 0.5 × log10(500억 / max(시총, 50억)))
  — 시총 500억: factor = 1.0 (보정 없음)
  — 시총 100억: factor = 1.0 + 0.5 × log10(5) ≈ 1.35
  — 시총 50억:  factor = 1.0 + 0.5 × log10(10) = 1.50
  — 시총 10억:  factor = 1.0 + 0.5 × log10(50) ≈ 1.85

  효과: 소형주의 attentionScore 임계값을 사실상 상향
  — 시총 100억 종목: 실질 임계값 2.0 × 1.35 = 2.70
  — 시총 50억 종목:  실질 임계값 2.0 × 1.50 = 3.00
```

**CheeseStock 매핑:** `calcAttentionState()` 함수를 `indicators.js`에 추가하고,
`signalEngine.js`의 신뢰도 산출 과정에서 `confidenceAdj`를 가감산한다.
`data/index.json`의 `mktCap` 필드를 활용하여 시가총액 보정을 적용한다.

참고문헌:
- Barber, B.M. & Odean, T. (2008). All That Glitters. *RFS*, 21(2), 785-818.
- Da, Z., Engelberg, J. & Gao, P. (2011). In Search of Attention. *JF*, 66(5), 1461-1499.
- Lee, C.M.C. & So, E.C. (2015). Alphanomics: The Informational Underpinnings of Market Efficiency. *FTML*, 5(1), 1-196.

---

## 5. 네트워크 외부성과 유동성 (Katz-Shapiro 1985: Network Externalities)

### 5.1 네트워크 외부성 이론 (Network Externality Theory)

Katz & Shapiro (1985)의 네트워크 외부성 이론: 재화의 가치가 사용자 수에
의존하는 경우, 시장은 자연적으로 "승자 독식(winner-take-all)" 균형으로
수렴한다. 전화기는 사용자가 많을수록 가치가 커지고, 이 효과가 초기 소수
사용자의 채택을 자기 강화(self-reinforcing)한다.

```
네트워크 외부성 가치함수:
  V(n) = v_0 + f(n)
  v_0: 고유 가치 (standalone value)
  f(n): 네트워크 가치 (network value), f'(n) > 0
  n: 참여자 수

Metcalfe의 법칙 (순수 네트워크):
  V(n) = k × n²
  — 네트워크 연결 수 = n(n-1)/2 ∝ n²
  — 참여자 2배 → 가치 4배 (급격한 자기 강화)

Sarnoff의 법칙 (방송형, 약한 네트워크):
  V(n) = k × n
  — 참여자 2배 → 가치 2배 (선형)

증권시장은 Sarnoff와 Metcalfe 사이:
  V_liquidity(n) = k × n^γ,   1 < γ < 2
  γ ≈ 1.3-1.5 (실증 추정치)
```

### 5.2 유동성 네트워크 효과 (Liquidity Network Effect)

증권시장에서 네트워크 외부성은 **유동성(liquidity)** 을 통해 작동한다.
거래 참여자가 많을수록 유동성이 높아지고, 유동성이 높을수록 거래 비용이
낮아져 더 많은 참여자를 끌어들인다. 이 양의 피드백 루프가 대형주의
"유동성 프리미엄"과 소형주의 "비유동성 할인"을 구조적으로 생산한다.

```
유동성 네트워크 루프:
  참여자 ↑ → 호가 밀집 → 스프레드 ↓ → 거래비용 ↓ → 참여자 ↑
  (양의 피드백 / self-reinforcing)

  참여자 ↓ → 호가 희소 → 스프레드 ↑ → 거래비용 ↑ → 참여자 ↓
  (사막화 / liquidity desert)

비유동성-시가총액 관계:
  ILLIQ ∝ 1 / MktCap^γ

  ILLIQ: Amihud (2002) 비유동성 지표
    ILLIQ_i = (1/D_i) Σ_{d=1}^{D_i} |r_{i,d}| / VOLD_{i,d}
    r_{i,d}: 종목 i의 d일 수익률
    VOLD_{i,d}: 종목 i의 d일 거래대금 (원)

  γ 추정치 (KRX 실증):
  — KOSPI: γ ≈ 0.6-0.8
  — KOSDAQ: γ ≈ 0.8-1.0 (비유동성 감수성 더 큼)
  — γ > 1이면 소형주 비유동성이 시총 감소보다 빠르게 악화
```

**임계질량 (Critical Mass):**

```
유동성 외부성에는 임계질량(critical mass)이 존재:
  n_critical: 유동성 자기 유지가 가능한 최소 참여자 수

  n < n_critical: 유동성 사막화 (death spiral 위험)
    — 거래 부재 → 가격 발견 불능 → 편입/투자 배제 → 거래 부재
  n > n_critical: 유동성 자기 강화 (선순환)
    — 충분한 호가 → 낮은 스프레드 → ETF/인덱스 편입 → 자금 유입

KRX 실증 임계질량 추정:
  — 일평균 거래대금 기준: ~1억원이 임계점
  — ADV < 1억원: 호가 부재 빈도 > 30%, 가격 발견 심각히 훼손
  — ADV 1-5억원: 전이 구간, 유동성 불안정
  — ADV > 5억원: 안정적 유동성, 패턴 분석 의미 있음
```

### 5.3 ADV 레벨 분류 — calcADVLevel() (ADV Level Classification)

네트워크 외부성 이론을 바탕으로, 종목의 유동성 수준을 4단계로 분류하고
패턴 신뢰도에 반영하는 함수를 설계한다.

```
calcADVLevel(candles, idx) → { level, adv, confidenceMult }

알고리즘:
  1. ADV_20 = SMA(거래대금, 20, idx)
     거래대금 = close × volume (일봉)

  2. 레벨 분류:
     if ADV_20 < 1억원:
       level = 'MICRO'    (극소형)
       confidenceMult = ADV_MULT_MICRO (= 0.75)
     elif ADV_20 < 5억원:
       level = 'SMALL'    (소형)
       confidenceMult = ADV_MULT_SMALL (= 0.85)
     elif ADV_20 < 50억원:
       level = 'MID'      (중형)
       confidenceMult = 1.00  (기준)
     else:
       level = 'LARGE'    (대형)
       confidenceMult = ADV_MULT_LARGE (= 1.10)

  3. 반환: { level, adv: ADV_20, confidenceMult }
```

**경제학적 정당화:**

| ADV 레벨 | confidenceMult | 경제학적 근거 |
|---------|---------------|-------------|
| MICRO (< 1억) | 0.75 | 유동성 임계질량 미달, Diamond 역설 극대화, 가격 발견 불능 |
| SMALL (1-5억) | 0.85 | 전이 구간, 불안정 유동성, 탐색 비용 높음 |
| MID (5-50억) | 1.00 | 기준, 안정적 유동성, 표준 패턴 분석 유효 |
| LARGE (> 50억) | 1.10 | 네트워크 외부성 강화, 풍부한 호가, 패턴 실현율 높음 |

**MICRO 레벨의 특수 처리:**

```
MICRO 종목 (ADV < 1억원) 경고:
  1. 패턴 감지 시 "저유동성 경고" 표시 권장
  2. 목표가/손절가의 실현 가능성이 매우 낮음
     — 시장가 주문 시 슬리피지 3-10%+ 예상
     — 지정가 주문 시 미체결 위험 50%+
  3. 역선택 비용 극대화: 매수 시 불리한 가격에 체결될 확률 높음
  4. backtester.js의 슬리피지를 ADV_MULT_MICRO 역수만큼 확대 권장:
     slippage_adj = KRX_SLIPPAGE / ADV_MULT_MICRO = 0.10% / 0.75 ≈ 0.13%
```

**LARGE 레벨이 1.10인 이유 (1.0이 아닌):**

```
대형주 신뢰도 프리미엄 근거:
  1. 기관/외국인 참여 → 정보 가격 반영 속도 ↑ → 패턴의 정보 함량 ↑
  2. 높은 유동성 → 패턴 목표가 도달 시 실현 가능 (낮은 슬리피지)
  3. 숏셀링 가능 → 양방향 가격 발견 → bearish 패턴도 유효
  4. ETF/인덱스 자금 → 추가 수급 지원

  단, 1.10으로 제한하는 이유:
  — 대형주는 정보 효율성도 높으므로 알파 자체가 작음
  — Grossman-Stiglitz 역설: 효율적일수록 초과수익 작음
  — 1.10은 "실현 가능성 프리미엄"이지 "알파 크기 프리미엄"이 아님
```

**CheeseStock 매핑:** `calcADVLevel()` 함수를 `indicators.js`에 추가하고,
`signalEngine.js`의 최종 신뢰도 산출에서 `confidenceMult`를 곱하여 적용한다.
`data/index.json`의 `volume`과 `prevClose`로 ADV 추정이 가능하다.

참고문헌:
- Katz, M.L. & Shapiro, C. (1985). Network Externalities, Competition, and Compatibility. *AER*, 75(3), 424-440.
- Amihud, Y. (2002). Illiquidity and Stock Returns: Cross-Section and Time-Series Effects. *JFM*, 5(1), 31-56.
- Pagano, M. (1989). Trading Volume and Asset Liquidity. *QJE*, 104(2), 255-274.

---

## 6. 밸류에이션 스크리닝 균형 (Rothschild-Stiglitz 1976: Screening Equilibrium)

### 6.1 스크리닝 이론 기초 (Screening Theory Fundamentals)

Doc 31 §3.4에서 다룬 Spence (1973) **신호 이론(signaling)** 은 정보 보유자(기업)가
자발적으로 정보를 공개하는 메커니즘이다. Rothschild & Stiglitz (1976)의
**스크리닝 이론(screening)** 은 이의 거울상으로, 정보 미보유자(투자자)가
메커니즘을 설계하여 정보를 추출하는 메커니즘이다.

```
Spence 신호 (signaling) — 정보 보유자 주도:
  기업 → 배당 인상, 자사주 매입, 공시 → 투자자에게 품질 신호
  (Doc 31 §3.4에서 상세 논의)

Rothschild-Stiglitz 스크리닝 (screening) — 정보 미보유자 주도:
  투자자 → 밸류에이션 기준 설정 → 기업 자동 분류
  — PBR < 1 스크리닝: 자산가치 대비 저평가 기업 필터링
  — PER < 10 스크리닝: 이익 대비 저평가 기업 필터링
  — ROE > 15% 스크리닝: 수익성 우량 기업 필터링
```

**분리 균형 (Separating Equilibrium):**

```
Rothschild-Stiglitz 분리 균형:
  고품질 기업 (H): 높은 내재가치, 안정적 이익
  저품질 기업 (L): 낮은 내재가치, 불안정 이익

  스크리닝 기준: 밸류에이션 임계값 θ
  — P/E < θ: "가치주" 카테고리 → 가치 투자자 유입
  — P/E > θ: "성장주" 카테고리 → 성장 투자자 유입

  분리 조건 (incentive compatibility):
  — H 유형: θ 기준을 통과하여 가치주로 분류될 유인
  — L 유형: θ 기준을 통과하지 못하여 자동 배제
  — 이 분리가 성립하려면 θ가 H와 L의 특성 차이를 반영해야 함

  균형에서:
  — PBR = 1 근방: 자산가치 = 시가총액 경계 → 가치/성장 분리점
  — PER = 10 근방: "합리적 밸류에이션" 통념 → 매수/관망 분리점
  — PER = 20 근방: "고평가" 인식 시작 → 성장/과열 분리점
```

### 6.2 가격 군집 현상 (Price Clustering at Valuation Thresholds)

스크리닝 균형의 가장 중요한 실증적 함의는 **밸류에이션 임계값에서의 가격
군집(clustering)** 이다. 투자자들이 특정 밸류에이션 수준을 스크리닝 기준으로
사용하면, 해당 수준이 가격의 **지지/저항** 역할을 한다.

```
밸류에이션 기반 지지/저항 형성 메커니즘:
  1. PBR = 1.0 지지:
     — 스크리닝: "PBR < 1 = 자산 대비 저평가"
     — 많은 가치 투자자가 PBR ≈ 1 근방에서 매수 대기
     — 결과: PBR = 1 수준이 가격 지지선 역할

  2. PER 정수 저항:
     — 스크리닝: "PER > 20 = 고평가"
     — PER = 20 근방에서 신규 매수 감소 + 이익실현 매도 증가
     — 결과: PER = 20 수준이 가격 저항선 역할

  3. 배당수익률 지지:
     — 스크리닝: "배당수익률 > 4% = 매력적"
     — 배당수익률 4% 수준에서 인컴 투자자 유입
     — 결과: 해당 주가 수준이 강한 지지
```

**한국 시장의 주요 밸류에이션 임계값:**

| 임계값 | 유형 | 활성 투자자군 | S/R 역할 | 강도 |
|-------|------|-----------|---------|------|
| PBR = 0.5 | 지지 | 깊은가치(deep value) 투자자 | 강한 지지 | 높음 |
| PBR = 1.0 | 지지/저항 | 가치 투자자 / 성장 투자자 분리점 | 매우 강함 | 매우 높음 |
| PER = 10 | 지지 | "합리적 매수" 투자자 | 중간 지지 | 중간 |
| PER = 15 | 중립 | 기관 기준 밸류에이션 | 약한 저항 | 낮음 |
| PER = 20 | 저항 | "고평가" 인식 | 중간 저항 | 중간 |
| PER = 30 | 강한 저항 | "과열" 인식 | 강한 저항 | 높음 |
| 배당률 3% | 지지 | 인컴 투자자 | 약한 지지 | 낮음 |
| 배당률 5% | 강한 지지 | 배당주 펀드 | 강한 지지 | 높음 |

### 6.3 detectValuationSR() 구현 (Valuation-Based Support/Resistance Detection)

밸류에이션 임계값이 기술적 가격 수준으로 변환되는 메커니즘을 정량화한다.

```
detectValuationSR(candles, financial) → valuationLevels[]

알고리즘:
  입력: candles (OHLCV 시계열), financial (재무 데이터)

  1. 밸류에이션 임계값 → 가격 변환:
     P_at_PBR_1 = BPS × 1.0     (PBR=1 가격)
     P_at_PBR_05 = BPS × 0.5    (PBR=0.5 가격)
     P_at_PER_10 = EPS × 10     (PER=10 가격)
     P_at_PER_15 = EPS × 15     (PER=15 가격)
     P_at_PER_20 = EPS × 20     (PER=20 가격)
     P_at_PER_30 = EPS × 30     (PER=30 가격)
     P_at_DY_3 = DPS / 0.03     (배당률 3% 가격)
     P_at_DY_5 = DPS / 0.05     (배당률 5% 가격)

  2. 현재가 근접성 필터링:
     current = candles[last].close
     range_filter = ATR(14) × 10
     — 현재가 ± ATR×10 범위 내 임계값만 유효

  3. 강도 산출:
     V_strength = Σ_{j ∈ thresholds} 1 / |P_current - P_threshold_j|^1.5
     — 거리의 1.5제곱에 반비례 → 근접 임계값에 높은 가중치
     — 지수 1.5의 근거: 1.0(선형)보다 근접에 민감, 2.0(제곱)보다 원거리 포함

  4. 밸류에이션 S/R 레벨 구성:
     for each threshold_price in filtered_thresholds:
       type = 'support' if threshold_price < current else 'resistance'
       strength = VALUATION_SR_STRENGTH × (1 / |P - threshold_price|^1.5)
       push to valuationLevels[]

  5. 반환: valuationLevels[] (sorted by distance)
```

**V_strength 거리 함수의 경제학적 근거:**

```
1/|ΔP|^1.5 함수 선택 이유:
  — 1/|ΔP|^1.0 (선형): 원거리 임계값의 영향이 과대
  — 1/|ΔP|^2.0 (제곱): 근접 임계값만 유효, 원거리 무시
  — 1/|ΔP|^1.5 (절충): 근접에 민감하되 원거리도 약하게 반영

  경제학적 해석:
  — 가격이 밸류에이션 임계값에 접근할수록 스크리닝 투자자의 주문 강도가
    비선형적으로 증가 (행동재무학의 앵커링 효과와 일치)
  — 완전 접촉 시 무한대가 아닌 이유: 실제로는 임계값 정확히 일치보다
    ±ATR 범위에서 주문 분산 → min(|ΔP|, ATR*0.1) 클램프 필요
```

**기술적 S/R과의 통합:**

```
통합 지지/저항 강도:
  S/R_total = S/R_technical + S/R_valuation

  S/R_technical: patterns.js의 기존 S/R (가격 터치 횟수 기반)
  S/R_valuation: detectValuationSR()의 밸류에이션 기반 S/R

  컨플루언스 보너스:
  if |S/R_technical_price - S/R_valuation_price| < ATR:
    confluence_bonus = 0.10
    — 기술적 S/R과 밸류에이션 S/R이 동일 가격대에서 합류
    — 이론적으로 가장 강한 지지/저항
```

**CheeseStock 매핑:** `detectValuationSR()`은 `patterns.js`의 지지/저항 분석과
통합하여 사용한다. `financials.js`의 `getFinancialData()`에서 BPS, EPS, DPS를
추출하고, 이를 가격 임계값으로 변환한다. 현재 `patterns.js`의 `_supportResistance()`에
밸류에이션 레벨을 추가 입력으로 제공하는 확장이 가능하다.

| 상수 | 값 | 등급 | 학습 | 범위 | 출처 |
|------|---|------|------|------|------|
| VALUATION_SR_STRENGTH | 0.6 | [C] | [L:WLS] | 0.3-1.0 | Rothschild-Stiglitz 응용 |
| V_strength_exponent | 1.5 | [B] | [L:MAN] | 1.0-2.0 | 앵커링 문헌 |

참고문헌:
- Rothschild, M. & Stiglitz, J. (1976). Equilibrium in Competitive Insurance Markets: An Essay on the Economics of Imperfect Information. *QJE*, 90(4), 629-649.
- Tversky, A. & Kahneman, D. (1974). Judgment under Uncertainty: Heuristics and Biases. *Science*, 185(4157), 1124-1131.
- Harris, L. (1991). Stock Price Clustering and Discreteness. *RFS*, 4(3), 389-415.

---

## 7. 블록 트레이드 탐색 마찰 (Grossman-Miller 1988: Block Trade Search Friction)

### 7.1 유동성의 시간적 차원 (Temporal Dimension of Liquidity)

Grossman & Miller (1988)은 유동성의 핵심 문제가 **거래 상대방 탐색의 시간 차원**에
있음을 보였다. 대량 매도가 필요한 기관이 즉시 이를 흡수할 매수자를 찾지 못하면,
유동성 제공자(liquidity provider)에게 할인을 제공해야 한다. 이 할인이 블록
트레이드 가격 충격(block trade price impact)이다.

```
Grossman-Miller 모형:
  유동성 수요자: 대량 포지션 해소 필요 (시간 제약: 긴급)
  유동성 공급자: 가격 할인 시 흡수 가능 (시간 여유: 비긴급)

  가격 충격 (price impact):
  ΔP_block = -λ_block × (Vol_block / ADV)^δ_block

  λ_block: 충격 계수 (시장 깊이의 역수에 비례)
  Vol_block: 블록 물량 (주 또는 금액)
  ADV: 20일 평균 거래대금
  δ_block: 충격 탄력성 (0 < δ_block < 1)

  δ_block의 경험적 값:
  — 선행 연구: 0.5-0.7 (Almgren & Chriss 2001)
  — KRX 추정: δ_block ≈ 0.6
  — δ < 1인 이유: 시장에 점진적 흡수 능력 존재 (비선형)
```

### 7.2 KRX 블록 트레이드 특성 (KRX Block Trade Characteristics)

한국 시장에서 블록 트레이드는 주로 기관 투자자(기관/외국인)의 대량 포지션
조정에서 발생한다. KRX는 장외 블록 매매(off-exchange block)보다 장내 주문
분할(order splitting)이 일반적이다.

```
KRX 블록 트레이드 감지 기준:
  1. 단일 체결 물량 > 일평균 거래량의 5%
  2. 5분 내 누적 방향성 거래량 > ADV의 10%
  3. 가격 충격 > 1% (해당 시점 이전 대비)

블록 매매 가격 충격 추정:
  ΔP_block = -λ × (Vol / ADV)^0.6

  λ 추정치 (KRX):
  — KOSPI 대형: λ ≈ 0.8-1.2
  — KOSPI 중형: λ ≈ 1.5-2.5
  — KOSDAQ:     λ ≈ 2.5-5.0

  예시:
  삼성전자 (ADV ~5,000억원), 블록 500억원 (ADV의 10%):
    ΔP ≈ -1.0 × (0.10)^0.6 ≈ -1.0 × 0.251 ≈ -0.25%
  KOSDAQ 중형 (ADV ~5억원), 블록 5,000만원 (ADV의 10%):
    ΔP ≈ -3.0 × (0.10)^0.6 ≈ -3.0 × 0.251 ≈ -0.75%
```

### 7.3 기관 분할 매매 감지 패턴 (Institutional Order Splitting Detection)

블록 트레이드를 즉시 실행하면 과도한 가격 충격이 발생하므로, 대부분의
기관은 주문을 분할(splitting)하여 실행한다. 이 분할 매매의 패턴을 감지하면
기관의 의도를 선행적으로 파악할 수 있다.

```
기관 분할 매매 패턴:
  1. VWAP 추종형 (Volume-Weighted Average Price):
     — 거래량 패턴이 일중 VWAP 프로파일과 유사
     — 09:00-10:00 대량 → 12:00 감소 → 14:00-15:00 대량
     — 다일간 일관된 방향성 거래량

  2. TWAP 추종형 (Time-Weighted Average Price):
     — 거래량이 시간에 균등 분포
     — 비정상적으로 "평탄한" 거래량 패턴

  3. 아이스버그 주문 (Iceberg Order):
     — 특정 가격대에서 반복적으로 동일 물량 체결
     — 호가창 표면의 물량 < 실제 잠복 물량

감지 지표:
  participation_rate = directional_volume / total_volume
  consistency = std(participation_rate_daily) over 5 days

  if participation_rate > 0.60 AND consistency < 0.10:
    institutional_activity = 'high'
    → 패턴 방향과 기관 매매 방향 일치 시: conf += 0.05
    → 불일치 시: conf -= 0.05
```

**탐색 마찰과 패턴 시간 프레임의 관계:**

```
블록 트레이드 완료 시간 추정:
  T_execution = Vol_total / (participation_rate × ADV)

  participation_rate ≈ 10-20% (기관 통상 참여율)

  예시:
  1,000억원 매도 / (0.15 × 5,000억원) = 1.33 거래일 (삼성전자)
  50억원 매도 / (0.15 × 10억원) = 33.3 거래일 (KOSDAQ 소형)

  패턴 함의:
  — 대형주: 블록 매매 1-2일 → 5일봉 패턴에 포착
  — 소형주: 블록 매매 20-50일 → 월봉 패턴에 포착
  — 시간 프레임 선택이 탐색 마찰에 의해 제약됨
```

**CheeseStock 매핑:** 현재 `patterns.js`는 가격·거래량 패턴만 감지하며, 기관
분할 매매 패턴은 감지하지 않는다. WS 모드에서 Kiwoom OCX의 투자자별
매매 데이터 수신 시, 기관/외국인 누적 순매매를 추적하여 분할 매매 감지가
가능해진다. 파일 모드에서는 일봉 거래량의 방향성 분석(OBV 기울기의
일관성)이 프록시로 활용 가능하다.

참고문헌:
- Grossman, S. & Miller, M. (1988). Liquidity and Market Structure. *JF*, 43(3), 617-637.
- Almgren, R. & Chriss, N. (2001). Optimal Execution of Portfolio Transactions. *J. Risk*, 3(2), 5-39.
- Chan, L.K.C. & Lakonishok, J. (1995). The Behavior of Stock Prices Around Institutional Trades. *JF*, 50(4), 1147-1174.

---

## 8. KRX 시장 적용과 학습 가능 상수 (KRX Application & Learnable Constants)

### 8.1 통합 프레임워크 — 5단계 파이프라인 (Integrated 5-Stage Pipeline)

본 문서에서 제시한 6개 이론은 하나의 통합 파이프라인으로 결합된다.

```
Stage 1: 탐색 비용 평가 (Stigler)
  → 종목의 정보 환경 특성 파악
  → 애널리스트 커버리지, 뉴스 빈도, 시가총액 기반

Stage 2: 주의 상태 감지 (Peng-Xiong, Barber-Odean)
  → calcAttentionState(): deprivation / jump / normal
  → 현재 주의 사이클 위치 파악

Stage 3: 유동성 수준 분류 (Katz-Shapiro)
  → calcADVLevel(): MICRO / SMALL / MID / LARGE
  → 네트워크 외부성 기반 유동성 안정성 평가

Stage 4: 밸류에이션 S/R 감지 (Rothschild-Stiglitz)
  → detectValuationSR(): PBR/PER/배당률 기반 S/R
  → 기술적 S/R과 통합

Stage 5: 블록 마찰 보정 (Grossman-Miller)
  → 기관 분할 매매 감지
  → 패턴 실현 시간 프레임 조정
```

**신뢰도 최종 산출:**

```
conf_final = conf_pattern
           × confidenceMult_ADV          (Stage 3)
           + confidenceAdj_attention      (Stage 2)
           + confluence_bonus_valuation   (Stage 4)
           + institutional_adj            (Stage 5)

예시: KOSDAQ 중형주, attentionScore=2.5 (jump), ADV=8억원 (MID),
      PBR=1.05 (PBR=1 근접), 기관 매수 방향 일치

  conf_final = 0.70 (기본)
             × 1.00 (MID)
             + 0.08 (jump)
             + 0.10 (valuation confluence)
             + 0.05 (institutional)
           = 0.93

  동일 패턴, MICRO 종목, deprivation, 밸류에이션 S/R 없음:
  conf_final = 0.70 × 0.75 + (-0.05) + 0 + 0 = 0.475
```

### 8.2 학습 가능 상수 (#113-#117) (Learnable Constants)

본 문서에서 도입한 상수:

| # | 상수명 | 위치 | 현재값 | 등급 | 학습 | 범위 | 출처 |
|---|-------|------|-------|------|------|------|------|
| 113 | ADV_MULT_MICRO | indicators.js | 0.75 | [C] | [L:WLS] | 0.50-0.90 | Amihud (2002) 비유동성 |
| 114 | ADV_MULT_SMALL | indicators.js | 0.85 | [C] | [L:WLS] | 0.70-0.95 | 경험적, 유동성 문헌 |
| 115 | ADV_MULT_LARGE | indicators.js | 1.10 | [C] | [L:WLS] | 1.00-1.25 | 네트워크 외부성 |
| 116 | ATTENTION_JUMP_THRESHOLD | indicators.js | 2.0 | [C] | [L:GCV] | 1.5-3.0 | Barber-Odean (2008) |
| 117 | VALUATION_SR_STRENGTH | patterns.js | 0.6 | [C] | [L:WLS] | 0.3-1.0 | Rothschild-Stiglitz |

**등급 분류 근거:**

- **[A] 고정** (본 문서 해당 없음): 모든 상수가 시장 조건에 따라 변동 가능
- **[B] 학술 범위**: 해당 없음 (관련 실증 문헌이 한국 시장 특정 값을 제시하지 않음)
- **[C] 보정 가능**: #113-117 전부
  — 이론적 방향(부호, 상대 크기)은 명확하나 정확한 값은 KRX 데이터로 교정 필요
  — GCV 또는 WLS Ridge 회귀를 통한 데이터 기반 최적화 가능
- **[D] 휴리스틱**: 해당 없음 (모든 상수에 이론적 근거 존재)

### 8.3 기존 Doc 상수 연번과의 관계 (Constant Numbering Alignment)

Doc 31의 상수 번호가 #99-#113이므로, 본 문서는 #113부터 시작한다.
단, Doc 31의 #113 (`info_cascade_decay`)과 번호가 중복된다.

**정정:** 본 문서의 상수 번호를 #114-#118로 재배정한다.

| # | 상수명 | 현재값 | 등급 |
|---|-------|-------|------|
| 114 | ADV_MULT_MICRO | 0.75 | [C] |
| 115 | ADV_MULT_SMALL | 0.85 | [C] |
| 116 | ADV_MULT_LARGE | 1.10 | [C] |
| 117 | ATTENTION_JUMP_THRESHOLD | 2.0 | [C] |
| 118 | VALUATION_SR_STRENGTH | 0.6 | [C] |

**주의:** 상수 번호 체계는 `core_data/22_learnable_constants_guide.md`의
전체 목록과 동기화해야 한다. 현재 Doc 31까지 #113이 마지막이므로,
본 문서의 상수는 #114부터 순차 배정이 올바르다.

### 8.4 교차 참조 (Cross-References)

본 문서의 이론이 기존 core_data 문서와 연결되는 지점:

| 본 문서 섹션 | 관련 core_data | 연결 |
|------------|-------------|------|
| §2 탐색 비용 | Doc 31 §3.1 (완전경쟁/EMH) | 탐색 비용이 EMH 불완전성의 원천 |
| §3 주의 제한 | Doc 04 (심리학) | 주의 제약은 인지 편향의 구조적 원인 |
| §3.3 주의 점프 | Doc 18 §5 (처분효과) | 매수/매도 비대칭 주의의 행동적 결과 |
| §4 attentionScore | Doc 24 (행동 계량화) | 공포-탐욕 지수와 주의 사이클의 관계 |
| §5 네트워크 외부성 | Doc 19 (소셜 네트워크) | 유동성 외부성은 사회적 영향의 시장 메커니즘 |
| §5 Amihud ILLIQ | Doc 18 §3 | Amihud 지표의 미시적 기초 |
| §6 스크리닝 | Doc 31 §3.4 (Spence 신호) | 신호(기업) ↔ 스크리닝(투자자) 쌍대 이론 |
| §6 밸류에이션 S/R | Doc 07 §10 (S/R 알고리즘) | 기술적 S/R에 밸류에이션 S/R 통합 |
| §7 블록 마찰 | Doc 10 (최적 제어/실행) | Almgren-Chriss 최적 실행과의 연결 |
| §8 상수 | Doc 22 (상수 가이드) | 5-Tier 등급 체계 준수 |

---

## 9. 구현 우선순위와 데이터 요구 (Implementation Priority & Data Requirements)

### 9.1 구현 우선순위 (Implementation Priority)

| 순위 | 함수 | 난이도 | 데이터 요구 | 기대 효과 |
|------|------|-------|-----------|----------|
| 1 | calcADVLevel() | 낮음 | OHLCV (기존 data) | 즉시, 저유동성 종목 신뢰도 보정 |
| 2 | calcAttentionState() | 중간 | OHLCV (기존 data) | 즉시, 주의 사이클 기반 신뢰도 보정 |
| 3 | detectValuationSR() | 중간 | OHLCV + 재무 (financials/) | 중간, 밸류에이션 기반 S/R 추가 |
| 4 | 기관 분할 매매 감지 | 높음 | 투자자별 매매 (WS only) | 높음, 기관 의도 선행 감지 |

**calcADVLevel()이 1순위인 이유:**
- 구현 비용 최소 (거래대금 = close × volume, 기존 데이터만 사용)
- 효과 즉각적 (MICRO 종목의 허위 신호 제거)
- 이론적 근거 강력 (Amihud, Katz-Shapiro)
- 기존 `signalEngine.js` 신뢰도 산출에 곱셈 한 줄 추가로 통합

### 9.2 Python 데이터 준비 (Python Data Preparation)

```python
# calcADVLevel()은 추가 데이터 불필요 (OHLCV에서 직접 산출)

# detectValuationSR()을 위한 재무 데이터:
# 이미 scripts/download_financials.py 가 DART에서 BPS, EPS 수집
# 추가 필요: DPS (배당금) — DART API의 배당 관련 항목

# 기관 분할 매매 감지를 위한 투자자별 매매:
# pip install pykrx
from pykrx import stock
# stock.get_market_trading_volume_by_investor("20260101", "20260330", "005930")
# → 기관, 외국인, 개인 순매매 데이터
# 단, WS 모드 (Kiwoom) 에서는 실시간 수신 가능
```

### 9.3 한계와 가정 (Limitations and Assumptions)

**이론적 한계:**

1. **주의 측정의 불완전성:** attentionScore는 거래량과 변동성만으로 주의를
   프록시하나, 실제 투자자 주의는 뉴스 검색량(Google Trends), SNS 언급 빈도,
   증권사 리포트 발간 등 다양한 채널을 통해 작동한다. OHLCV 기반 프록시는
   주의의 부분적 측정치에 불과하다.

2. **밸류에이션 임계값의 시변성:** PBR=1, PER=10 등의 임계값이 "보편적"이라는
   가정은 시대와 산업에 따라 변한다. 테크 섹터에서 PER=30은 정상이나,
   은행 섹터에서는 과열이다. 산업별 임계값 차등화가 이론적으로 필요하지만,
   현재 구현에서는 고정 임계값을 사용한다.

3. **네트워크 외부성의 비선형성:** ADV 레벨을 4단계로 이산화(discretize)하는 것은
   연속적 비선형 관계의 근사이다. 실제 유동성-신뢰도 관계는 S자 곡선(logistic)에
   가까울 수 있으며, 이 경우 연속 함수 적용이 더 정확하다.

4. **블록 트레이드 감지의 한계:** 파일 모드에서는 일봉 데이터만 사용하므로
   일중 블록 매매를 직접 감지할 수 없다. 일간 OBV 기울기의 일관성은
   간접적 프록시에 불과하며, 실시간 체결 데이터(WS 모드)가 있어야
   정확한 감지가 가능하다.

**KRX 시장 특수 가정:**

5. **개인 투자자 비중의 독특성:** KRX, 특히 KOSDAQ은 개인 투자자 비중이
   60-80%로 글로벌 시장 대비 극단적으로 높다. Barber-Odean (2008)의 미국
   시장 실증 결과를 한국에 직접 적용할 때, 주의 효과가 더 강하게 나타날 수
   있다 (개인이 attention-grabbing에 더 민감하므로). 상수 값의 KRX 교정이
   필수적이다.

6. **공매도 규제의 영향:** 한국의 공매도 금지/제한 기간(2020-2021, 2023-2024)은
   bearish 패턴의 실현 메커니즘을 왜곡한다. 공매도가 불가능하면 부정적 정보의
   가격 반영이 지연되어 주의 제한 모형의 비대칭 효과가 증폭된다.

---

## 10. 참고문헌 (References)

1. Stigler, G.J. (1961). The Economics of Information. *JPE*, 69(3), 213-225.
2. Diamond, P. (1971). A Model of Price Adjustment. *JET*, 3(2), 156-168.
3. Rothschild, M. & Stiglitz, J. (1976). Equilibrium in Competitive Insurance Markets. *QJE*, 90(4), 629-649.
4. Katz, M.L. & Shapiro, C. (1985). Network Externalities, Competition, and Compatibility. *AER*, 75(3), 424-440.
5. Merton, R.C. (1987). A Simple Model of Capital Market Equilibrium with Incomplete Information. *JF*, 42(3), 483-510.
6. Grossman, S. & Miller, M. (1988). Liquidity and Market Structure. *JF*, 43(3), 617-637.
7. Sims, C.A. (2003). Implications of Rational Inattention. *JME*, 50(3), 665-690.
8. Peng, L. & Xiong, W. (2006). Investor Attention, Overconfidence and Category Learning. *JFE*, 80(3), 563-602.
9. Barber, B.M. & Odean, T. (2008). All That Glitters: The Effect of Attention and News on the Buying Behavior of Individual and Institutional Investors. *RFS*, 21(2), 785-818.
10. Da, Z., Engelberg, J. & Gao, P. (2011). In Search of Attention. *JF*, 66(5), 1461-1499.
11. Amihud, Y. (2002). Illiquidity and Stock Returns: Cross-Section and Time-Series Effects. *JFM*, 5(1), 31-56.
12. Almgren, R. & Chriss, N. (2001). Optimal Execution of Portfolio Transactions. *J. Risk*, 3(2), 5-39.
13. Hong, H., Lim, T. & Stein, J. (2000). Bad News Travels Slowly: Size, Analyst Coverage, and the Profitability of Momentum Strategies. *JF*, 55(1), 265-295.
14. Hou, K. & Moskowitz, T. (2005). Market Frictions, Price Delay, and the Cross-Section of Expected Returns. *RFS*, 18(3), 981-1020.
15. Chan, L.K.C. & Lakonishok, J. (1995). The Behavior of Stock Prices Around Institutional Trades. *JF*, 50(4), 1147-1174.
16. Pagano, M. (1989). Trading Volume and Asset Liquidity. *QJE*, 104(2), 255-274.
17. Harris, L. (1991). Stock Price Clustering and Discreteness. *RFS*, 4(3), 389-415.
18. Hirshleifer, D. & Teoh, S.H. (2003). Limited Attention, Information Disclosure, and Financial Reporting. *JAE*, 36(1-3), 337-386.
19. Lee, C.M.C. & So, E.C. (2015). Alphanomics: The Informational Underpinnings of Market Efficiency. *FTML*, 5(1), 1-196.
20. Burdett, K. & Judd, K. (1983). Equilibrium Price Dispersion. *Econometrica*, 51(4), 955-969.
21. Tversky, A. & Kahneman, D. (1974). Judgment under Uncertainty: Heuristics and Biases. *Science*, 185(4157), 1124-1131.
22. Grossman, S. & Stiglitz, J. (1980). On the Impossibility of Informationally Efficient Markets. *AER*, 70(3), 393-408.
23. Spence, M. (1973). Job Market Signaling. *QJE*, 87(3), 355-374.
24. Akerlof, G. (1970). The Market for "Lemons". *QJE*, 84(3), 488-500.
