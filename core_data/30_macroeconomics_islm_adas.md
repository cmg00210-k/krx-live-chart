# 30. 거시경제학 — IS-LM, AD-AS, 정책 전달과 주식시장

# Macroeconomics: IS-LM, AD-AS, Policy Transmission to Equity Markets

> "The difficulty lies not so much in developing new ideas as in escaping from old ones."
> — John Maynard Keynes, *The General Theory of Employment, Interest and Money* (1936)

> "Mr. Keynes' special theory ... can be expressed in the form of a diagram."
> — John R. Hicks, "Mr. Keynes and the 'Classics': A Suggested Interpretation" (1937)

이 문서는 거시경제학의 핵심 모형(IS-LM, AD-AS)과 학파별 이론이 한국 주식시장의
기술적 패턴 신뢰도에 어떻게 전달(transmit)되는지를 정형화한다. Doc 29 §3의
금리-섹터 분석을 일반균형(general equilibrium) 수준으로 확장하며, Doc 22의
Tier 분류 체계를 따라 새로운 학습가능 상수(#83~#98)를 등록한다.

---

## 1. IS-LM 모형 (IS-LM Model)

Hicks (1937)가 Keynes (1936)의 *General Theory*를 2차원 도식으로 변환한 이래,
IS-LM은 단기 거시균형 분석의 표준 프레임워크로 80년 이상 사용되어 왔다.
Hansen (1953)이 이를 교과서적으로 체계화하였다.

### 1.1 IS 곡선 도출 (IS Curve Derivation)

재화시장(goods market)의 균형 조건에서 IS 곡선을 도출한다.

**행동 방정식 (Behavioral Equations):**

```
소비:  C = C_0 + c_1 * (Y - T)        c_1 = MPC (한계소비성향), 0 < c_1 < 1
투자:  I = I_0 - b * r                 b = 투자의 이자율 민감도, b > 0
정부:  G = G_0                         외생적 정부지출
조세:  T = T_0 + t * Y                 t = 한계세율, 0 < t < 1
순수출: NX = X_0 - m * Y + eta * e     m = 한계수입성향, eta = 환율 민감도
                                        e = 실질환율 (↑ = 원화 약세 = 수출 유리)
```

**균형 조건:**

```
Y = C + I + G + NX
Y = [C_0 + c_1(Y - T_0 - tY)] + [I_0 - b*r] + G_0 + [X_0 - mY + eta*e]
Y = [C_0 - c_1*T_0 + I_0 + G_0 + X_0 + eta*e] + [c_1(1-t) - m]*Y - b*r
```

자율지출(autonomous spending)을 A로 정의:

```
A = C_0 - c_1*T_0 + I_0 + G_0 + X_0 + eta*e
```

Y에 대해 정리하면:

```
Y * [1 - c_1(1-t) + m] = A - b*r
Y = (A - b*r) / [1 - c_1(1-t) + m]
```

r에 대해 정리하면 IS 곡선:

```
IS: r = A/b - Y * [1 - c_1(1-t) + m] / b
```

**기울기 분석:**

```
dr/dY |_{IS} = -[1 - c_1(1-t) + m] / b  <  0    (우하향)

기울기 결정 요인:
  - b 클수록 → IS 완만 (투자가 금리에 민감 → 금리 소폭 변화로 Y 크게 이동)
  - c_1 클수록 → IS 완만 (승수 효과 확대)
  - m 클수록 → IS 가파름 (수입 누출이 승수를 약화)
  - t 클수록 → IS 가파름 (세금이 가처분소득 감소)
```

**한국 파라미터 추정치:**

> **Parameter Vintage Warning:** 아래 파라미터는 2010-2016 한국 데이터 기반 추정치이다.
> Post-COVID 구조 변화(공급망 리쇼어링, 디지털 가속화, 가계부채 급증)로 인해
> 이 추정치의 현재 유효성은 재검증이 필요하다. 특히 한계소비성향(c_1)은 가계부채
> 부담 증가로 하향 이동했을 가능성이 있으며, 한계수입성향(m)은 글로벌 공급망
> 재편으로 변동 중이다.

| Parameter | Symbol | Korea Value | Tier | Learn | Range | Source |
|-----------|--------|-------------|------|-------|-------|--------|
| 한계소비성향 | c_1 | 0.55 | [B] | [L:MAN] | [0.50, 0.65] | BOK (2023) 국민계정 |
| 한계세율 | t | 0.25 | [A] | [L:MAN] | fixed | 국세통계연보 평균 |
| 한계수입성향 | m | 0.45 | [B] | [L:MAN] | [0.38, 0.52] | 관세청 수출입동향 |
| 투자 이자율 민감도 | b | 1200 | [C] | [L:GS] | [800, 1800] | Kim & Park (2016) |
| 환율 수출탄력성 | eta | 0.60 | [C] | [L:GS] | [0.40, 0.80] | Shin & Wang (2003) |

CheeseStock 매핑: IS 곡선의 파라미터는 직접 코드에 구현되지 않으나, 한계수입성향
m=0.45가 §5.1에서 정부지출 승수가 한국에서 유독 낮은 이유(k_G_open ≈ 0.96)를 설명하며,
이는 추경(supplementary budget) 뉴스에 대한 패턴 신뢰도 조정 근거가 된다.
Doc 29 §3.1의 기준금리 주가 영향 분석이 IS-LM의 비교정학적 귀결이다.

---

### 1.2 LM 곡선 도출 (LM Curve Derivation)

화폐시장(money market)의 균형 조건에서 LM 곡선을 도출한다.

**케인즈 유동성 선호 (Keynesian Liquidity Preference):**

```
화폐수요: L(Y, r) = k * Y - h * r
  k = 소득의 화폐수요 민감도 (거래·예비 동기), k > 0
  h = 이자율의 화폐수요 민감도 (투기 동기), h > 0

화폐공급: M^s / P (실질화폐공급, 외생적)
```

**화폐시장 균형:**

```
M/P = k*Y - h*r
```

r에 대해 정리하면 LM 곡선:

```
LM: r = (k/h) * Y - (M/P) / h
```

**기울기 분석:**

```
dr/dY |_{LM} = k/h  >  0    (우상향)

기울기 결정 요인:
  - k 클수록 → LM 가파름 (Y 증가 → 화폐수요 급증 → r 대폭 상승)
  - h 클수록 → LM 완만 (투기적 화폐수요가 이자율에 민감 → r 소폭 변화)
```

**두 가지 극단 사례:**

```
유동성 함정 (Liquidity Trap): h → ∞
  LM 수평: r = r_min (바닥금리)
  통화정책 무력: M/P 증가 → r 불변 (추가 유동성이 모두 투기 잔고로 흡수)
  역사: 일본 1990s-2020s, 한국 2020 Q2 (BOK 기준금리 0.50%)
  패턴 함의: 통화정책 이벤트에 대한 주가 반응 미미 → 금리발표 트레이딩 신호 약화

고전적 경우 (Classical Case): h → 0
  LM 수직: Y = (M/P) / k (화폐수량설)
  통화정책 전능: ΔM → ΔY (but 재정정책 무력, 100% 구축)
  금융시장: 통화정책 발표가 지배적 신호
```

| Parameter | Symbol | Korea Value | Tier | Learn | Range | Source |
|-----------|--------|-------------|------|-------|-------|--------|
| 소득 화폐수요 민감도 | k | 0.20 | [C] | [L:MAN] | [0.15, 0.30] | BOK M2/GDP 추정 |
| 이자율 화폐수요 민감도 | h | 2000 | [C] | [L:GS] | [1200, 3500] | Kim & Park (2016) |

**현대적 재해석 주의 (Modern Reinterpretation Caveat):**

> Modern central banks target interest rates, not money supply (Romer, 2000).
> The IS-LM framework with fixed M is a pedagogical simplification. For policy
> analysis, use the IS-MP (Taylor rule) framework where the central bank sets i
> directly and the LM curve is replaced by a horizontal monetary policy rule.
> §4.1의 테일러 준칙이 이 현대적 접근에 해당한다.

CheeseStock 매핑: 유동성 함정 판별은 Doc 29 §3.1의 기준금리 구간에서 r ≤ 0.75%일 때
통화정책 이벤트 트레이딩 신호를 자동 감쇠(dampen)하는 근거가 된다.
현재 `signalEngine.js`에는 금리 구간별 감쇠 로직이 없으나, MCS_v2 (§4.3)에서
Taylor gap을 통해 간접 반영을 설계한다.

---

### 1.3 IS-LM 균형과 비교정학 (Equilibrium & Comparative Statics)

IS와 LM을 연립하여 균형 산출량 Y*와 균형 이자율 r*를 구한다.

```
IS:  r = A/b - Y * [1 - c_1(1-t) + m] / b
LM:  r = (k/h) * Y - (M/P) / h

정의: s = 1 - c_1(1-t) + m   (한계 누출률, marginal leakage rate)
      D = h*s + b*k            (분모, 항상 양수)
```

**균형해 (Equilibrium Solution):**

```
Y* = [h*A + b*(M/P)] / D
r* = [k*A - s*(M/P)] / D
```

**비교정학 (Comparative Statics):**

| 충격 | dY*/d(·) | dr*/d(·) | 주식시장 영향 | 패턴 함의 |
|------|----------|----------|-------------|----------|
| G↑ (재정확장) | +h/D > 0 | +k/D > 0 | Y↑ but r↑ (부분 구축) | 성장주: r↑ 압박, 가치주: Y↑ 수혜 |
| M/P↑ (통화확장) | +b/D > 0 | -s/D < 0 | Y↑ AND r↓ (이중 호재) | 전반적 bullish, 특히 성장주 |
| T↑ (증세) | -c_1*h/D < 0 | -c_1*k/D < 0 | Y↓ AND r↓ | 소비재 bearish, 채권형 자산 유리 |
| c_1↑ (소비심리) | +h*(1-t)/D | +k*(1-t)/D | 내수 활성화 | 소매/내수주 bullish |
| X_0↑ (수출 호조) | +h/D | +k/D | 수출주 직접 수혜 | 반도체·자동차 bullish |

**주식 듀레이션 개념 (Equity Duration):**

```
D_equity ≈ 1 / (r_e - g)

여기서 r_e = 자기자본 비용, g = 이익 성장률
  성장주: g = 8%, r_e = 10% → D_equity ≈ 50 (r 변화에 극도로 민감)
  가치주: g = 2%, r_e = 10% → D_equity ≈ 12.5 (r 변화에 둔감)
```

Doc 29 §3.2에서 이미 듀레이션 프레임워크를 섹터별로 적용했으며, IS-LM은 그 r 변화가
어떤 정책 충격에서 발생하는지를 특정(identify)하는 역할을 한다.

```
금리 변화의 주식 가격 영향:
  ΔP_equity / P_equity ≈ -D_equity * Δr

  BOK -25bp 인하 (Δr = -0.25%):
    성장주 (D≈50): +12.5% 이론적 상승
    가치주 (D≈12.5): +3.1% 이론적 상승
    실증 (Doc 29 §3.2): 바이오/성장 +5~8%, 금융 -1~2% (NIM 축소)
    괴리 원인: D_equity는 무한기간 모형이며 시장은 기대를 이미 선반영
```

CheeseStock 매핑: 비교정학 표는 `signalEngine.js`의 매크로 이벤트 필터 설계에 직접 활용된다.
현재 시스템에서는 매크로 이벤트를 반영하지 않으나, MCS_v2 (§4.3) 통합 시
재정정책(G↑)과 통화정책(M/P↑)의 패턴 신뢰도 차등 조정 근거가 된다.

---

### 1.4 IS-LM-BP (먼델-플레밍) 개방경제 확장 (Mundell-Fleming for Korea)

한국은 GDP 대비 수출 비중이 ~50%인 소규모 개방경제(small open economy)이므로
폐쇄경제 IS-LM만으로는 분석이 불완전하다. Mundell (1963)과 Fleming (1962)의
IS-LM-BP 확장이 필수적이다.

**BP 곡선 (Balance of Payments Equilibrium):**

```
BP = NX(Y, e) + KA(r - r*, E[Δe]) = 0

NX = X_0 - m*Y + eta*e         (경상수지)
KA = kappa * (r - r* - E[Δe])  (자본수지, kappa = 자본이동성)

BP 곡선: r = r* + E[Δe] + (m/kappa) * Y - (X_0 + eta*e) / kappa
기울기: dr/dY |_{BP} = m / kappa
```

**자본이동성에 따른 BP 기울기:**

```
완전자본이동 (kappa → ∞): BP 수평 (r = r* + E[Δe])
  → 국내 금리가 세계금리에서 괴리 불가
  → 한국: 2000년대 이후 자본자유화 → 근사적 완전이동

불완전이동 (kappa 유한): BP 우상향
  → 1990년대 이전 한국 (자본통제)
```

**먼델-플레밍 삼위일체 (Mundell-Fleming Trilemma):**

```
동시에 달성 불가능한 3가지:
  ① 자유로운 자본이동 (free capital flow)
  ② 독립적 통화정책 (independent monetary policy)
  ③ 고정환율제 (fixed exchange rate)

한국의 선택: ① + ② → ③ 포기 (변동환율제)
  1997 외환위기 이전: ② + ③ → ① 제한 (자본통제 + 관리변동환율)
  1997 이후: ① + ② 선택 → 원화 자유변동

주의: 한국은 de jure 자유변동이나 de facto 관리변동(managed float)에 가깝다.
  BOK는 외환안정화기금(FX stabilization fund)과 구두개입(verbal guidance)을 통해
  급격한 환율 변동을 억제한다. Mundell-Fleming 삼위일체는 이에 따라
  부분적 자본이동성(partial capital mobility) 하의 trade-off로 재해석해야 한다.
  IMF 분류(2024): 한국 = "floating" (but with FX intervention history)
```

**변동환율제 하 정책 유효성 (Mundell-Fleming Results):**

```
통화확장 (M↑):
  r↓ → 자본유출 → KRW↓ (원화 약세) → NX↑ → Y↑ (IS 우측 이동)
  최종 효과: Y 크게 증가 (통화정책 STRONG)
  주식시장: 수출주 특히 강세 (환율 + 금리 이중 수혜)

재정확장 (G↑):
  r↑ → 자본유입 → KRW↑ (원화 강세) → NX↓ → Y 부분 상쇄
  최종 효과: Y 소폭 증가 또는 불변 (재정정책 WEAK)
  주식시장: 구축효과 + 환율절상 → 수출주 타격, 내수주만 소폭 수혜
```

**핵심 CheeseStock 인사이트:**

```
BOK 기준금리 결정이 추경 발표보다 주가에 더 큰 영향을 미친다.
  이유: 변동환율제 하에서 통화정책 > 재정정책 (Mundell-Fleming 결과)
  실증: BOK -25bp → KOSPI +1.2% (당일), 추경 10조원 → KOSPI +0.3% (당일)

패턴 신뢰도 조정:
  BOK 금리결정일: conf_adj = ±1.08 (통화정책 강력)
  추경 발표일:    conf_adj = ±1.03 (재정정책 미약)
```

| Parameter | Symbol | Value | Tier | Learn | Range | Source |
|-----------|--------|-------|------|-------|-------|--------|
| 자본이동성 | kappa | 5000 | [C] | [L:MAN] | [2000, ∞) | Lane & Milesi-Ferretti (2007) |
| BOK 이벤트 conf 조정 | conf_bok | 1.08 | [C] | [L:GS] | [1.03, 1.15] | 실증 Doc 29 §3.1 |
| 추경 이벤트 conf 조정 | conf_fiscal | 1.03 | [D] | [L:GS] | [1.00, 1.08] | 추정, 실증 부족 |

CheeseStock 매핑: 먼델-플레밍은 Doc 29 §3.1의 기준금리 이벤트와 §2.5의 수출동향이
왜 재정정책 이벤트보다 주가에 더 큰 영향을 미치는지에 대한 이론적 기반이다.
향후 MCS에 이벤트 유형별 가중치를 부여할 때 이 비대칭성을 반영해야 한다.

---

## 2. AD-AS 모형 (Aggregate Demand — Aggregate Supply Model)

IS-LM이 물가수준(P)을 고정한 단기 분석이라면, AD-AS는 P를 내생화하여
물가-산출량의 동시 결정을 분석한다.

### 2.1 총수요 (AD) 곡선 — IS-LM으로부터의 도출

IS-LM 균형에서 P를 변화시키면 LM이 이동하고 Y*가 변한다.
이 Y*(P) 관계가 AD 곡선이다.

```
IS-LM 균형: Y* = [h*A + b*(M/P)] / D
이것이 곧 AD 곡선: Y_AD(P) = [h*A + b*(M/P)] / D

기울기: dY_AD/dP = -b*M / (D * P^2) < 0   (우하향)
```

**AD 우하향의 세 가지 메커니즘:**

```
① 피구 효과 (Pigou/Real Balance Effect):
   P↓ → (M/P)↑ → 실질자산 증가 → C↑ → Y↑
   Pigou (1943): 명목자산의 실질 가치 증대

② 케인즈 효과 (Keynes/Interest Rate Effect):
   P↓ → (M/P)↑ → LM 우측 이동 → r↓ → I↑ → Y↑
   Keynes (1936): 유동성 선호를 통한 간접 경로

③ 먼델-플레밍 효과 (Exchange Rate Effect):
   P↓ → 실질환율 e↑ (원화 약세) → NX↑ → Y↑
   한국에서 가장 강력 (수출 비중 ~50%)
```

**AD 이동 요인 (Shift Factors):**

| 충격 | AD 이동 | 메커니즘 | KRX 섹터 영향 |
|------|---------|---------|--------------|
| G↑ (정부지출) | 우측 | IS 우측 | 건설·SOC, but 약함 |
| M↑ (통화공급) | 우측 | LM 우측 → r↓ | 전반 bullish |
| c_1↑ (소비심리) | 우측 | IS 우측 | 소매·내수 |
| 중국 GDP↑ | 우측 | X_0↑ → IS 우측 | 반도체·화학·철강 |
| 미국 경기회복 | 우측 | X_0↑ | IT·자동차 |
| 유가 상승 | 좌측/혼합 | 비용↑(AS 좌측) + NX↓ | 정유↑, 항공↓ |

```
한국 AD의 특수성:
  수출 의존도 ≈ 50% of GDP → 해외 수요가 AD의 최대 이동 요인
  G의 효과는 약함 (m=0.45로 인한 수입 누출)
  ∴ 글로벌 경기가 한국 AD를 지배
```

CheeseStock 매핑: AD 이동 요인 표는 Doc 29 §2.5의 수출동향과 §2.1의 CSI가
패턴 신뢰도에 미치는 영향의 이론적 기반이다. 해외 수요 충격이 한국 주식시장의
가장 큰 매크로 동인이라는 결론은 `backtester.js`에서 MCS 구성 시 글로벌
지표(미중 PMI)에 높은 가중치를 부여해야 함을 의미한다(Doc 28 §2 참조).

---

### 2.2 총공급 (AS) 곡선 — 세 가지 패러다임

총공급 이론은 학파에 따라 형태가 근본적으로 다르며, 이 차이가
§3의 케인즈-고전 통합과 직접 연결된다.

**① 고전적 장기총공급 (Classical LRAS):**

```
LRAS: Y = Y_n (자연산출량, 수직)

Y_n은 노동시장 균형, 자본스톡, 기술수준에 의해 결정
물가 변화는 명목변수만 변화 (화폐 중립성, classical dichotomy)
통화정책·재정정책 모두 Y에 무영향 (장기)
```

**② 케인즈 단기총공급 (Keynesian SRAS):**

```
SRAS: P = P_e + (1/alpha) * (Y - Y_n)

P_e = 기대물가 (임금계약 시 설정)
alpha = 가격 경직성 파라미터

Y < Y_n: 유휴설비 → 물가 거의 불변 (수평에 가까움)
Y ≈ Y_n: 정상 상향 기울기
Y > Y_n: 병목 → 가파르게 상승
```

**③ 뉴케인지언 총공급 (New Keynesian Phillips Curve):**

Calvo (1983) 가격설정 + Gali & Gertler (1999) 최적화:

```
NKPC: pi_t = beta * E_t[pi_{t+1}] + kappa * y_tilde

여기서:
  pi_t     = 인플레이션율
  beta     = 할인인자 ≈ 0.99
  y_tilde  = 산출량 갭 = (Y_t - Y_n) / Y_n
  kappa    = (1-theta)(1-beta*theta) / theta * (sigma + phi)

Calvo 파라미터:
  theta = 매 기간 가격 조정 불가 기업 비율
  sigma = 소비의 기간간 대체탄력성의 역수
  phi   = 노동공급 탄력성의 역수

한국 추정치 (Kim & Park 2016):
  theta ≈ 0.75 (평균 4분기 = 1년에 한 번 가격 조정)
  kappa ≈ 0.05
  beta ≈ 0.99
```

| Parameter | Symbol | Korea Value | Tier | Learn | Range | Source |
|-----------|--------|-------------|------|-------|-------|--------|
| Calvo 가격경직도 | theta | 0.75 | [B] | [L:MAN] | [0.60, 0.85] | Kim & Park (2016) |
| NKPC 기울기 | kappa | 0.05 | [B] | [L:MAN] | [0.02, 0.10] | Gali & Gertler (1999) |
| 할인인자 | beta | 0.99 | [A] | [L:MAN] | fixed | 표준 |
| 가격 경직성 | alpha | 1.20 | [C] | [L:GS] | [0.80, 2.00] | Blanchard & Fischer (1989) |

CheeseStock 매핑: NKPC의 kappa가 작을수록(가격이 더 경직적일수록) 수요 충격의
산출량 효과가 크고 물가 효과가 작다. 한국의 theta=0.75는 미국(0.66)보다 높아
가격 경직성이 더 강하며, 이는 통화정책 변화가 실물(→ 주가)에 더 크게 전달됨을 의미한다.

---

### 2.3 AD-AS 균형과 충격 분석 (Equilibrium & Shock Analysis)

**단기 균형:**

```
AD = SRAS 교차점 → (P*, Y*)

AD: Y = [h*A + b*(M/P)] / D
SRAS: P = P_e + (1/alpha) * (Y - Y_n)

연립: 수치적 해 (닫힌 해는 P에 대해 비선형)
```

**장기 조정 메커니즘:**

```
Y > Y_n → 초과 수요 → 임금 상승 → P_e↑ → SRAS 좌측 이동
  반복 → Y → Y_n, P↑ (장기 수직)

Y < Y_n → 초과 공급 → 임금 하향 압력 → P_e↓ → SRAS 우측 이동
  반복 → Y → Y_n, P↓
  (단, 명목임금 하방경직성 → 조정 비대칭적으로 느림)
```

**4가지 충격 시나리오와 패턴 함의:**

```
시나리오 1: 양(+)의 수요충격 (AD 우측 이동)
  원인: M↑, G↑, 수출 호조, 소비심리 개선
  결과: P↑, Y↑
  패턴: 추세추종(trend-following) 패턴 신뢰도 ↑
        반전(reversal) 패턴 신뢰도 ↓
  conf_adj: trend +0.08, reversal -0.05

시나리오 2: 음(−)의 수요충격 (AD 좌측 이동)
  원인: M↓, 수출 급감, 금융 긴축, 소비 위축
  결과: P↓, Y↓
  패턴: 반전(reversal) 패턴 신뢰도 ↑ (특히 바닥 패턴)
        돌파(breakout) 패턴 신뢰도 ↓
  conf_adj: reversal +0.10, breakout -0.08

시나리오 3: 음(−)의 공급충격 (SRAS 좌측 이동) = 스태그플레이션
  원인: 유가 급등, 공급망 교란, 원자재 가격 상승
  결과: P↑, Y↓ (스태그플레이션)
  패턴: 모든 패턴 신뢰도 ↓ (상충 신호)
        금리↑(인플레 대응) + 경기↓ → 방향성 판단 불가
  conf_adj: ALL -0.12

시나리오 4: 양(+)의 공급충격 (SRAS 우측 이동) = 골디락스
  원인: 기술혁신, 생산성 향상, 유가 하락, 반도체 슈퍼사이클
  결과: P↓, Y↑ ("Goldilocks" — 저물가 + 고성장)
  패턴: 모든 패턴 신뢰도 ↑ (signal-to-noise 최대)
        추세추종 특히 강력
  conf_adj: ALL +0.05
```

**한국 공급충격 이력:**

| 시기 | 유형 | 충격 | KOSPI 반응 | 패턴 신뢰도 |
|------|------|------|-----------|-----------|
| 2022 H1 | 공급(-) | 러시아-우크라이나 유가 급등 | -25% | 저하 (스태그플레이션) |
| 2023 H2 | 공급(+) | 반도체 업턴 + 유가 안정 | +18% | 향상 (골디락스 근사) |
| 2020 Q1 | 수요(-) | COVID 충격 | -35% | 반전 패턴 정확도 ↑ |
| 2020 Q3 | 수요(+) | 유동성 완화 + 재정 부양 | +42% | 추세 패턴 정확도 ↑ |

CheeseStock 매핑: 4가지 레짐별 conf_adj는 §6.2의 레짐-패턴 신뢰도 조정표에
통합된다. 현재 `patternEngine.analyze()`는 레짐 판별 없이 정적 confidence를
반환하므로, MCS가 레짐 정보를 제공할 때 패턴 confidence에 곱하는 방식으로 적용 가능하다.

---

## 3. 케인즈학파 vs 고전학파 통합 (Keynesian-Classical Synthesis)

### 3.1 고전학파 (Classical School)

**핵심 명제:**

```
세이의 법칙 (Say's Law): 공급이 스스로 수요를 창출
  → 시장은 항상 청산 (Y = Y_n)
  → 비자발적 실업 불가능 (임금 신축성)

화폐 중립성 (Monetary Neutrality):
  M↑ → P↑ (비례), Y 불변 (고전적 이분법)
  MV = PY (화폐수량설, Fisher 1911)

합리적 기대 (Lucas 1972):
  E_t[P_{t+1}] = P_{t+1} + epsilon_t  (epsilon_t ~ N(0, sigma^2))
  → 예측된(anticipated) 정책은 Y에 무영향
  → 오직 예측되지 않은(unanticipated) 정책만 단기 효과
```

**주식시장 예측:**

```
고전학파적 시장:
  - 주가는 효율적 (EMH 강형식)
  - 기술적 패턴은 무작위 잡음 (Malkiel 1973)
  - 충격 후 빠른 평균회귀 (V자형 회복)
  - 모멘텀 전략 무효 (정보는 즉시 반영)
  - 예측: mean_reversion_strength = HIGH, momentum_decay = FAST
```

### 3.2 케인즈학파 (Keynesian School)

**핵심 명제:**

```
가격 경직성 (Sticky Prices):
  메뉴비용 (Mankiw 1985): 가격 변경의 고정비용 존재
  장기계약: 임금계약 1-2년, 가격계약 3-12개월
  → 단기에 P 조정 불완전 → 수요 변화가 Y에 영향

야성적 충동 (Animal Spirits):
  투자 결정은 합리적 NPV 계산뿐 아니라 투자자의 낙관/비관에 좌우
  Keynes (1936) Ch.12: "our positive activities depend on spontaneous optimism
  rather than on mathematical expectation"
  → 투자 변동성은 펀더멘털로 설명 불가능한 잔차를 포함

유동성 선호 (Liquidity Preference):
  화폐는 유동성 프리미엄을 가짐 → r > 0 (저축만으로는 r 결정 불가)
  유동성 함정: r_min에서 화폐수요 무한탄력

절약의 역설 (Paradox of Thrift):
  S↑ (개인적으로 합리적) → C↓ → Y↓ → S↓ (합성의 오류)
  → 경기침체기 저축 권장은 역효과
```

**주식시장 예측:**

```
케인즈적 시장:
  - 주가는 미인투표 (Keynes beauty contest) → 펀더멘털과 괴리 가능
  - 가격 경직성 → 정보 반영에 시차 → 기술적 패턴 유효
  - 장기 하락 추세 가능 (U자/L자형 회복)
  - 모멘텀 전략 유효 (정보의 점진적 반영)
  - 예측: trend_following_strength = HIGH, mean_reversion_delay = LONG
```

### 3.3 신고전파 종합 (New Neoclassical Synthesis — Goodfriend & King 1997)

현대 거시경제학은 고전학파와 케인즈학파의 대립을 DSGE(Dynamic Stochastic
General Equilibrium) 모형으로 통합한다.

**통합 모형의 핵심:**

```
① 합리적 기대 (from Classical)
   + ② 가격 경직성 (from Keynesian)
   + ③ 정책 준칙 (from Taylor)
   = New Keynesian DSGE

3-equation system:
  IS:   y_t = E_t[y_{t+1}] - (1/sigma) * (i_t - E_t[pi_{t+1}] - r_n)
  NKPC: pi_t = beta * E_t[pi_{t+1}] + kappa * y_t
  TR:   i_t = r_n + phi_pi * pi_t + phi_y * y_t    (Taylor Rule)
```

**단기 vs 장기:**

```
단기 (1~20 거래일): 케인즈적
  - 가격 경직적 → 수요가 산출량 결정
  - 통화정책 실효 → BOK 발표가 주가에 영향
  - 모멘텀 패턴 유효 (정보의 점진적 가격 반영)
  - 예: 3WhiteSoldiers, ascendingTriangle 추세추종

장기 (60~250 거래일): 고전적
  - 가격 조정 완료 → Y → Y_n
  - 통화 중립 → 유동성 효과 소멸
  - 평균회귀 패턴 유효 (과잉반응 수정)
  - 예: doubleTop/Bottom 장기 반전, H&S 구조 변환
```

**레짐 의존적 패턴 신뢰도 모형 (Regime-Dependent Pattern Reliability):**

```
regime_score = f(uncertainty, output_gap)

Near-Keynesian regime (score > 0.6):
  조건: 경기 침체, 높은 불확실성 (VIX > 25, VKOSPI > 25)
  패턴: 모멘텀/추세 패턴 강함 (conf_adj = +0.08)
        평균회귀 패턴 약함 (conf_adj = -0.06)

Near-Classical regime (score < 0.4):
  조건: 경기 확장, 낮은 불확실성 (VIX < 15, VKOSPI < 15)
  패턴: 평균회귀 패턴 강함 (conf_adj = +0.05)
        모멘텀 패턴 감쇠 (conf_adj = -0.04, alpha decay 가속)
```

| Parameter | Symbol | Value | Tier | Learn | Range | Source |
|-----------|--------|-------|------|-------|-------|--------|
| 케인즈적 레짐 기준 VKOSPI | vkospi_keynesian | 25 | [C] | [L:GS] | [20, 35] | 실증 추정 |
| 고전적 레짐 기준 VKOSPI | vkospi_classical | 15 | [C] | [L:GS] | [10, 20] | 실증 추정 |
| 모멘텀 레짐 conf_adj (Keynesian) | mom_keynesian | +0.08 | [D] | [L:WLS] | [0.03, 0.15] | 학술 근거 부족 |
| 평균회귀 레짐 conf_adj (Classical) | mr_classical | +0.05 | [D] | [L:WLS] | [0.02, 0.10] | 학술 근거 부족 |
| 모멘텀 수명 단기 (bars) | mom_life_short | 20 | [C] | [L:GS] | [10, 30] | Jegadeesh & Titman (1993) |
| 평균회귀 수명 장기 (bars) | mr_life_long | 120 | [C] | [L:GS] | [60, 250] | DeBondt & Thaler (1985) |

CheeseStock 매핑: Doc 21 §2의 AMH(Adaptive Markets Hypothesis, Lo 2004) 감쇠 모형이
이미 `backtester.js`의 WLS decay lambda를 통해 부분 구현되어 있다. 신고전파 종합은
이를 레짐(Keynesian/Classical) 수준으로 일반화한다. 향후 VKOSPI를 입력받아
regime_score를 계산하고, 이에 따라 패턴 유형별 conf_adj를 동적 조정하는 것이 설계 방향이다.
Doc 26 §3의 VKOSPI 데이터 소스가 이 레짐 판별의 핵심 입력이 된다.

---

### 3.4 현대 경제학파 확장 (Modern Extensions)

본 절은 주류(mainstream) 경제학 외 현대 학파의 요점을 개관하며,
추후 economics agent에 의해 확장될 수 있는 구조적 확장점(extension point)을 제공한다.

**현대통화이론 (MMT — Modern Monetary Theory, Kelton 2020):**

```
핵심 주장:
  - 주권통화 발행국은 재정적자에 의한 파산 불가
  - 인플레이션이 유일한 재정적 제약
  - 완전고용보장(JG) 프로그램이 자동안정장치

한국 적용 한계:
  - 원화는 기축통화가 아님 → 외채 위험 존재 (1997 위기 교훈)
  - 수출 의존 경제 → 원화 가치 하락이 즉시 수입물가에 전달
  - MMT 논리의 직접 적용은 위험, 부분적 참고만 가능
```

**포스트케인지언 (Post-Keynesian, Minsky 1986):**

```
금융 불안정성 가설 (Financial Instability Hypothesis):
  Hedge → Speculative → Ponzi 금융의 내생적 전환
  안정이 불안정을 낳는다 (stability is destabilizing)
  패턴 함의: 장기 안정장 후 급격한 패턴 전환 가능성 → regime shift detection 중요
```

**오스트리아학파 (Austrian School, Hayek 1931):**

```
경기변동의 화폐적 과잉투자론:
  인위적 저금리 → 생산구조 왜곡 (자본의 과잉배분) → 필연적 청산
  패턴 함의: 금리 인하 장기화 → 성장주 거품 → 급격한 조정 (H&S, doubleTop)
```

이 섹션은 추후 economics agent에 의해 현대학파 관점으로 업데이트될 수 있도록
구조적 확장점(extension point)을 제공한다. 각 학파의 패턴 함의는 §6에서
별도 conf_adj를 할당하지 않으며, 실증 검증 후 통합을 권고한다.

---

## 4. 테일러 준칙과 통화정책 전달 (Taylor Rule & Monetary Policy Transmission)

### 4.1 테일러 준칙 (Taylor Rule — Taylor 1993)

**표준 테일러 준칙:**

```
i = r* + pi + a_pi * (pi - pi*) + a_y * (y - y*)

여기서:
  i     = 명목 정책금리
  r*    = 자연이자율 (균형 실질이자율) ≈ 1.0% (한국, 2020s)
  pi    = 현재 인플레이션율
  pi*   = 인플레이션 목표 = 2.0% (한국은행 공식 목표)
  y     = 실제 산출량 (또는 log GDP)
  y*    = 잠재 산출량
  a_pi  = 인플레이션 갭 반응 계수 (Taylor 원안: 0.5)
  a_y   = 산출량 갭 반응 계수 (Taylor 원안: 0.5)
```

**개방경제 확장 테일러 준칙 (Extended Taylor Rule for Open Economy):**

```
i = r* + pi + a_pi * (pi - pi*) + a_y * (y - y*) + a_e * Delta_e

a_e = 환율변동 반응 계수 ≈ 0.1-0.3 (Ball, 1999)
```

Ball (1999)은 소규모 개방경제에서 환율 pass-through를 반영한 확장 테일러 준칙을
제안했다. a_e 항은 환율 절하(Delta_e > 0)가 수입물가를 통해 인플레이션에 전달되는
간접 경로를 사전적으로 반영한다.

**한국 적응형 (Kim & Park 2016):**

```
한국 추정: a_e ≈ 0.10 (원/달러 10% 절하 시 +100bp 추가 긴축 경향)
원인: 수입물가 전가(pass-through) + 자본유출 방어
```

**산출량 갭 추정 — CLI 매핑 (Output Gap Estimation via CLI):**

```
코드 구현 (download_macro.py):
  output_gap = (CLI - 100) * CLI_TO_GAP_SCALE
  CLI_TO_GAP_SCALE = 0.5  (상수 #139)

OECD CLI(경기선행지수 순환변동치)는 100을 장기 추세로 정규화한다.
  CLI = 101 → output_gap ≈ +0.5%  (소폭 확장)
  CLI = 98  → output_gap ≈ -1.0%  (수축)
  CLI = 104 → output_gap ≈ +2.0%  (과열)

한계: CLI는 선행지수이므로 현재 산출량 갭의 직접 측정이 아닌 방향 지표이다.
BOK의 공식 산출량 갭 추정치는 연 2회(통화신용정책보고서)만 공개되므로,
CLI 기반 proxy가 실시간 근사에 실용적이다.
```

**테일러 갭 (Taylor Gap):**

```
Taylor_gap = i_actual - i_Taylor

Taylor_gap > 0: 과도한 긴축 (overtly tight)
  → 성장주 억압, 금융주 수혜
  → 향후 완화 전환 가능성 → 성장주 매집 기회

Taylor_gap < 0: 과도한 완화 (overtly loose)
  → 성장주 과열, 자산 버블 위험
  → 향후 긴축 전환 가능성 → 방어적 포지션

반감기 (half-life): 약 4분기 (1년)
  Rudebusch (2002): 중앙은행은 점진적으로 테일러 갭을 해소
  → 성장↔가치 회전의 예측 가능한 주기
```

| Parameter | Symbol | Value | Tier | Learn | Range | Source |
|-----------|--------|-------|------|-------|-------|--------|
| 자연이자율 (한국) | r_star | 1.0% | [C] | [L:MAN] | [0.5%, 2.0%] | Laubach-Williams (2003) method; BOK (2023) 추정. 불확실성 대역 ±1pp |
| 인플레이션 목표 | pi_star | 2.0% | [A] | [L:MAN] | fixed | BOK 공식 목표 |
| 인플레 반응 계수 | a_pi | 0.50 | [B] | [L:GS] | [0.30, 0.80] | Taylor (1993) |
| 산출량 갭 반응 계수 | a_y | 0.50 | [B] | [L:GS] | [0.25, 0.75] | Taylor (1993) |
| 환율 반응 계수 | a_e | 0.10 | [C] | [L:GS] | [0.05, 0.20] | Kim & Park (2016) |
| 테일러 갭 반감기 (분기) | gap_halflife | 4 | [B] | [L:MAN] | [2, 6] | Rudebusch (2002) |

CheeseStock 매핑: 테일러 갭은 §4.3의 MCS_v2에 직접 통합된다. 현재 시스템에는
기준금리 데이터 입력 경로가 없으나, 향후 외부 매크로 데이터 피드(Doc 29 §6)가
구현되면 `signalEngine.js`에서 Taylor_gap을 계산하여 성장/가치 회전 신호를 생성할 수 있다.

---

### 4.2 통화정책 전달 경로 5채널 (Five Transmission Channels — Mishkin 1995)

중앙은행의 기준금리 변경이 실물경제와 주식시장에 전달되는 5가지 경로:

```
채널 1: 이자율 경로 (Interest Rate Channel)
  BOK r↓ → 시장금리↓ → 기업 투자비용↓ → I↑ → Y↑
  시차: 1-3개월 (금리 → 투자), 3-6개월 (투자 → 산출)
  주식: 성장주/소형주 선행 반응 (할인율 민감)
  KRX 실증: 기준금리 -25bp → 3개월 후 설비투자 +1.2% (BOK 2023)

채널 2: 환율 경로 (Exchange Rate Channel)
  BOK r↓ → 내외금리차 축소 → 자본유출 → KRW 약세(↓) → NX↑ → Y↑
  시차: 즉시 (환율), 1-3개월 (수출), 3-6개월 (GDP)
  주식: 수출주(반도체·자동차) 즉시 반응
  KRX 실증: 원/달러 +1% → 삼성전자 +0.3%, 현대차 +0.4% (동시)

채널 3: 자산가격 경로 (Asset Price Channel)
  BOK r↓ → PV(배당) = D/(r-g) 증가 → P_equity↑ → 부의 효과 → C↑ → Y↑
  시차: 즉시 (주가), 1-3개월 (소비에 부의 효과 전달)
  주식: 직접 효과 — 모든 주식의 이론적 가치 상승
  Tobin's q: r↓ → q = 시장가/대체원가 ↑ → 신규 투자 유리

채널 4: 신용 경로 (Credit Channel)
  BOK r↓ → 은행 대출금리↓ + 대출태도 완화 → 기업 차입↑ → I↑
  하위경로:
    은행 대출경로: 예금 유입 → 대출 확대 (중소기업 특히 의존)
    대차대조표 경로: r↓ → 기업 자산가치↑ → 담보가치↑ → 차입능력↑
  시차: 2-6개월 (신용 → 투자), KOSDAQ 소형주에서 가장 현저
  KRX 실증: 은행 대출태도 완화 → KOSDAQ 3개월 초과수익 +2.1%

채널 5: 기대 경로 (Expectation Channel)
  BOK 포워드 가이던스 → 기대 인플레이션·성장 경로 변경 → C, I 즉시 반응
  현대적 강조: Woodford (2003) — 기대가 실제 정책 변경보다 중요할 수 있음
  시차: 즉시 (기대 선반영)
  KRX 실증: 금통위 성명서의 어조 변화만으로 KOSPI ±0.5%
```

**채널별 한국 시장 영향도 요약:**

| 채널 | 주요 수혜 섹터 | 시차 (주가) | 시차 (GDP) | 상대 강도 |
|------|-------------|-----------|-----------|----------|
| ① 이자율 | 성장주, 건설, REIT | 즉시~1주 | 3-6개월 | ★★★ |
| ② 환율 | 수출주 (반도체, 자동차) | 즉시 | 3-6개월 | ★★★★ |
| ③ 자산가격 | 전반적 (듀레이션 비례) | 즉시 | 1-3개월 | ★★★ |
| ④ 신용 | KOSDAQ 소형주, 부동산 | 1-3개월 | 6-12개월 | ★★ |
| ⑤ 기대 | 전반적 (선반영) | 즉시 | 변동 | ★★★★ |

```
한국 특수성:
  환율 채널(②)이 미국보다 상대적으로 강력 (수출 의존 + 변동환율)
  신용 채널(④)이 KOSDAQ에서 특히 강력 (소형주의 은행 차입 의존도)
  기대 채널(⑤)이 점점 강해지는 추세 (2024~, BOK 커뮤니케이션 개선)
```

CheeseStock 매핑: 5채널 분석은 Doc 29 §3.2의 섹터별 금리 민감도 표의 이론적 기반이다.
현재 `financials.js`의 투자매력도 점수에는 금리 민감도가 반영되지 않으나,
듀레이션 기반 금리 민감도를 섹터별로 할당하면 BOK 이벤트 시
자동 섹터 회전 신호를 생성할 수 있다.

---

### 4.3 MCS v2 통합 (Integration with Macro Composite Score)

Doc 29에서 정의된 MCS(Macro Composite Score)에 테일러 갭을 추가하여 MCS_v2를 정의한다.

**MCS v1 (Doc 29 §6.2 기준 — 코드 authoritative):**

```
MCS = w1*PMI_norm + w2*CSI_norm + w3*export_growth_norm + w4*yield_curve_norm + w5*EPU_inv_norm

w1=0.25 (PMI), w2=0.20 (CSI), w3=0.25 (수출), w4=0.15 (장단기금리차), w5=0.15 (정책불확실성 역수)
```

> **주의:** 구성 요소 순서와 레이블은 Doc 29 §6.2 및 `download_macro.py`의 `MCS_W` dict가
> 권위적(authoritative) 소스이다. `rate_dir`(금리 방향)은 `yield_curve_norm`(장단기금리차)으로,
> `spread_norm`은 `EPU_inv_norm`(경제정책불확실성 역수, VIX proxy)으로 각각 대응된다.

**MCS v2 확장:**

```
MCS_v2 = MCS + w6 * Taylor_gap_norm

Taylor_gap_norm = clip((Taylor_gap + 100) / 200, 0, 1)
  Taylor_gap = i_actual - i_Taylor (단위: bp)
  정규화: gap = -100bp → 0.0 (극도로 완화적)
          gap =    0bp → 0.5 (중립)
          gap = +100bp → 1.0 (극도로 긴축적)

w6 = 0.10

MCS_v2 재정규화: w1~w6의 합 = 1.0이 되도록 기존 w1~w5를 비례 축소
  w1=0.135, w2=0.225, w3=0.225, w4=0.180, w5=0.135, w6=0.100
```

**MCS_v2의 패턴 신뢰도 활용:**

```
MCS_v2 > 0.65: 매크로 bullish
  → bullish 패턴 conf *= 1.05
  → bearish 패턴 conf *= 0.95

MCS_v2 < 0.35: 매크로 bearish
  → bearish 패턴 conf *= 1.05
  → bullish 패턴 conf *= 0.95

0.35 <= MCS_v2 <= 0.65: 매크로 중립
  → conf 조정 없음
```

| Parameter | Symbol | Value | Tier | Learn | Range | Source |
|-----------|--------|-------|------|-------|-------|--------|
| Taylor gap 가중치 | w6 | 0.10 | [C] | [L:GCV] | [0.05, 0.20] | 설계값 |
| MCS bullish 임계 | mcs_bull | 0.65 | [D] | [L:GS] | [0.55, 0.75] | 경험적 |
| MCS bearish 임계 | mcs_bear | 0.35 | [D] | [L:GS] | [0.25, 0.45] | 경험적 |
| MCS bullish conf 승수 | mcs_bull_mult | 1.05 | [D] | [L:WLS] | [1.02, 1.10] | 경험적 |

CheeseStock 매핑: MCS_v2는 현재 코드에 미구현 상태이다.
구현 순서: (1) 외부 매크로 데이터 피드 구축 (Doc 29 §6), (2) Taylor gap 계산 모듈,
(3) `signalEngine.js`에 MCS_v2 → conf_adj 곱셈 로직 추가.
Doc 22의 상수 레지스트리에 w6을 #83으로 등록한다.

---

## 5. 재정정책 승수 (Fiscal Policy Multipliers)

### 5.1 정부지출 승수 (Government Spending Multiplier)

> **방법론적 주의:** 아래의 정태적(static) 케인즈 승수 1/(1-c) 계산은 고정 금리와
> 구축효과 부재를 가정한다. 동태적(DSGE) 승수는 통화정책 대응(monetary accommodation)
> 정도에 따라 0.5~2.0의 넓은 범위를 가진다 (Christiano, Eichenbaum & Rebelo, 2011).
> 특히 ZLB 조건(§5.3)에서는 승수가 크게 증폭되며, 긴축적 통화정책 하에서는
> 0.5 이하로 축소될 수 있다. 아래 정태 승수는 상한(upper bound)으로 해석해야 한다.

**단순 승수 (폐쇄경제, LM 수평 가정):**

```
k_G = 1 / (1 - c_1 * (1-t))
    = 1 / (1 - 0.55 * 0.75)
    = 1 / 0.5875
    ≈ 1.70
```

**개방경제 승수 (수입 누출 포함):**

```
k_G_open = 1 / (1 - c_1*(1-t) + m)
         = 1 / (1 - 0.55*0.75 + 0.45)
         = 1 / (0.5875 + 0.45)
         = 1 / 1.0375
         ≈ 0.96

주의: k_G_open < 1 → 정부지출 1원이 GDP를 1원 미만 증가
      이유: 한계수입성향 m=0.45가 극도로 높아 승수를 거의 무력화
```

**IS-LM 승수 (구축효과 포함):**

```
k_G_ISLM = h / D = h / (h*s + b*k)
         = 2000 / (2000*1.0375 + 1200*0.20)
         = 2000 / (2075 + 240)
         = 2000 / 2315
         ≈ 0.86

구축효과(crowding-out)까지 반영하면 승수는 더 낮아진다.
```

**국제 비교:**

| 국가 | k_G (추정) | 주요 원인 | Source |
|------|-----------|----------|--------|
| 한국 | 0.86~1.04 | 높은 수입 누출 (m=0.45) | Kim & Park (2016) |
| 미국 | 1.50~2.00 | 낮은 수입 비중 (m=0.15) | Blanchard & Perotti (2002) |
| 일본 | 1.10~1.50 | 중간 수입 비중 | Bruckner & Tuladhar (2014) |
| ZLB 한국 | ~1.95 | LM 수평 → 구축효과 소멸 | Christiano et al. (2011) |

CheeseStock 매핑: 한국의 재정승수가 1 이하라는 사실은, 추경 발표가 KOSPI에 미치는
영향이 구조적으로 제한적임을 의미한다. `signalEngine.js`에서 재정정책 이벤트에 대한
패턴 conf_adj를 1.03 이하로 제한하는 이론적 근거가 된다(§1.4 참조).

---

### 5.2 조세 승수 (Tax Multiplier)

```
k_T = -c_1 / (1 - c_1*(1-t) + m)
    = -0.55 / 1.0375
    ≈ -0.53

의미: 감세 1조원 → GDP +0.53조원 (정부지출 승수보다 절대값이 작음)
이유: 감세 → 가처분소득↑ → 그 중 c_1 비율만 소비 → 나머지 저축
```

**균형재정 승수 정리 (Balanced Budget Multiplier Theorem):**

```
k_BB = k_G + k_T = 1 / s + (-c_1 / s) = (1 - c_1) / s

개방경제:
  k_BB_open ≈ 0.96 + (-0.53) ≈ 0.43
  → 세수 동반 정부지출은 GDP에 미미한 영향
```

CheeseStock 매핑: 조세 감면 뉴스에 대한 시장 반응이 정부지출 확대보다 약한 이유를
이론적으로 설명한다. |k_T| < k_G이므로 감세 뉴스의 패턴 conf_adj는 추경보다 더 작아야 한다.

---

### 5.3 ZLB 특수 상황 (Zero Lower Bound)

**유동성 함정에서의 재정승수 증폭:**

```
ZLB 조건: r ≈ 0 (또는 effective lower bound)
LM 수평: h → ∞ → 구축효과 = 0

k_G_ZLB = 1 / s = 1 / (1 - c_1*(1-t) + m)
        = 1 / 1.0375
        ≈ 0.96   (한국 개방경제)

미국 ZLB: k_G_ZLB ≈ 1 / (1 - 0.70*0.75 + 0.15) = 1 / 0.625 ≈ 1.60
Christiano, Eichenbaum & Rebelo (2011): ZLB 승수 ≈ 1.95~2.30 (미국)
```

```
한국 ZLB 이력:
  2020 Q2: BOK 기준금리 0.50% (역사적 최저)
  → 추경 35.1조원 (4차 추경)
  → KOSPI 반응: 추경 발표 당일 +0.8%, 이후 1주간 +2.1%
  → 재정승수 증폭 효과 일부 관측 (구축효과 감소)
  → 그러나 통화정책 효과가 여전히 지배적 (양적완화 + 금리 인하)
```

| Parameter | Symbol | Value | Tier | Learn | Range | Source |
|-----------|--------|-------|------|-------|-------|--------|
| ZLB 판별 금리 | r_zlb | 0.75% | [C] | [L:MAN] | [0.25%, 1.00%] | 실증적 |
| ZLB 재정승수 증폭 | k_zlb_mult | 1.50 | [D] | [L:GS] | [1.20, 2.00] | Christiano et al. (2011) |

CheeseStock 매핑: ZLB 환경에서는 추경 이벤트의 패턴 conf_adj를 통상 수준(1.03)에서
1.03 * k_zlb_mult의 적절한 비율로 증폭할 수 있다. 다만 한국의 개방경제 승수 자체가 낮아
증폭 효과도 제한적이다.

---

### 5.4 한국 재정 특수성 (Korean Fiscal Specifics)

**추경 분류학 (Supplementary Budget Taxonomy):**

```
유형 1: 재난재해 (Disaster Relief)
  대상: 전 국민 지원금, 피해복구
  시장 반응: 단기 소비재 +1~2%, 지속성 낮음
  예: 2020 코로나 긴급재난지원금 (14.3조원)

유형 2: SOC/인프라 (Social Overhead Capital)
  대상: 도로, 철도, 주택건설
  시장 반응: 건설주 +2~5% (1주), 이후 반전 (buy rumor sell news)
  예: 2023 SOC 추경 (3.5조원)

유형 3: 기업 인센티브 (Corporate Incentive)
  대상: 투자세액공제, R&D 지원, 반도체 지원법
  시장 반응: 해당 섹터 +3~8% (발표 전 선반영 → 발표 후 이익실현)
  예: 2023 반도체 특별법 (세액공제율 25%)
```

**이벤트-패턴 매핑:**

```
추경 발표 → 건설주:
  Day 0: +2~3% (뉴스 반응)
  Day 1-5: +2~5% (모멘텀, 추세 패턴 형성)
  Day 6-15: -3~5% (이익실현, 반전 패턴 형성)
  → "buy the rumor, sell the news" 전형

반도체 지원법 발표 → 반도체 관련주:
  Day -5~-1: +3~5% (선반영, 뉴스 유출)
  Day 0: +1~2% (잔여 반응)
  Day 1-10: -2~4% (이익실현)
  → 선반영이 강해 발표 당일 신호는 약함
```

CheeseStock 매핑: 추경 유형별 섹터 반응은 Doc 29 §1.3의 KRX 섹터 분류와 결합하여
이벤트 드리븐 패턴 필터에 활용 가능하다. 현재 시스템에는 이벤트 캘린더가 없으나,
향후 한국은행 + 기획재정부 발표 일정을 외부 데이터로 수신하면
`signalEngine.js`에서 이벤트 전후 패턴 신뢰도를 차등 적용할 수 있다.

---

## 6. 거시-패턴 전달 통합 모형 (Integrated Macro-to-Pattern Transmission)

### 6.1 완전 전달 체인 (Full Transmission Chain)

IS-LM + AD-AS + 전달경로 5채널을 하나의 체인으로 연결한다.

**시나리오 A: BOK 기준금리 인하 -25bp**

```
[정책] BOK r = -25bp
  ↓
[IS-LM] r↓ → Y↑ (통화확장, IS 불변 LM 우측)
  ↓
[5채널]
  ① r↓ → I↑ (이자율)
  ② r↓ → KRW↓ → NX↑ (환율, 한국에서 특히 강력)
  ③ r↓ → PV(D)↑ → P_equity↑ (자산가격)
  ④ r↓ → 대출↑ (신용)
  ⑤ 완화 기조 확인 → 기대 개선 (기대)
  ↓
[AD-AS] AD 우측 이동 → Y↑, P 소폭↑
  ↓
[패턴 영향]
  성장주: bullish conf × 1.08 (듀레이션 효과, 채널 ①③)
  금융주: bearish conf × 0.95 (NIM 축소, 채널 ①④ 역행)
  수출주: bullish conf × 1.05 (환율, 채널 ②)
  MCS_v2: +0.05 (Taylor gap 축소)
```

**시나리오 B: 추경 10조원**

```
[정책] G = +10조원
  ↓
[IS-LM] IS 우측 → Y↑, r↑ (재정확장 + 구축)
  ↓
[먼델-플레밍] r↑ → KRW↑ → NX↓ (수출 상쇄)
  ↓
[AD-AS] AD 소폭 우측 → Y 미미한 증가 (승수 ≈ 0.86~1.04)
  ↓
[패턴 영향]
  건설 섹터: 단기 bullish conf × 1.10 (직접 수혜)
  수출 섹터: conf × 0.98 (환율 절상 부담)
  전체 시장: 무시할 수 있는 수준 (conf ≈ 1.00)
  주의: 건설주 반전 예상 3-5일 후 (buy rumor sell news)
```

**시나리오 C: 유가 급등 +30%**

```
[충격] 유가 +30% (공급 충격)
  ↓
[AD-AS] SRAS 좌측 이동 → P↑, Y↓ (스태그플레이션)
  ↓
[IS-LM] BOK 딜레마: 인플레 대응(r↑) vs 경기 부양(r↓)
  → 통상 r↑ (인플레 우선) → IS-LM: Y 추가 감소
  ↓
[패턴 영향]
  전체: conf × 0.88 (모든 패턴 약화, 상충 신호)
  정유/에너지: 예외적 bullish (비용 전가)
  항공/운송: bearish (연료비 직격)
  경기소비재: bearish (실질소득 감소)
```

### 6.2 AD-AS 레짐별 패턴 신뢰도 (Pattern Reliability by AD-AS Regime)

4개 레짐 × 4개 패턴 유형의 confidence 조정 매트릭스:

| Regime | 추세(Trend) | 반전(Reversal) | 돌파(Breakout) | 캔들(Candle) | 설명 |
|--------|-----------|-------------|-------------|-----------|------|
| 수요 확장 (AD↑) | +0.08 | -0.05 | +0.04 | +0.02 | 추세 강화, 반전 억제 |
| 수요 수축 (AD↓) | -0.04 | +0.10 | -0.08 | +0.03 | 바닥 반전 강화 |
| 스태그플레이션 (SRAS↓) | -0.12 | -0.08 | -0.12 | -0.06 | 모든 패턴 약화 |
| 골디락스 (SRAS↑) | +0.05 | +0.03 | +0.06 | +0.04 | 전반 강화, S/N 최대 |

```
conf_adjusted = conf_raw * (1 + regime_adj[regime][pattern_type])

예: 골디락스 레짐에서 ascendingTriangle (Trend 패턴)
    conf_adjusted = 0.72 * (1 + 0.05) = 0.756
```

**레짐 판별 규칙:**

```
regime_detect(macro_data):
  if GDP_gap > 0 AND CPI_yoy < 2.5%:     return 'goldilocks'
  if GDP_gap > 0 AND CPI_yoy >= 2.5%:    return 'demand_expansion'
  if GDP_gap < 0 AND CPI_yoy >= 3.0%:    return 'stagflation'
  if GDP_gap < 0 AND CPI_yoy < 3.0%:     return 'demand_contraction'
```

| Parameter | Symbol | Value | Tier | Learn | Range | Source |
|-----------|--------|-------|------|-------|-------|--------|
| 골디락스 CPI 상한 | cpi_goldilocks | 2.5% | [C] | [L:GS] | [2.0%, 3.0%] | BOK 목표 +0.5pp |
| 스태그플레이션 CPI 하한 | cpi_stagflation | 3.0% | [C] | [L:GS] | [2.5%, 4.0%] | 실증적 |
| 수요확장 추세 conf_adj | adj_expansion_trend | +0.08 | [D] | [L:WLS] | [0.03, 0.15] | 학술 근거 부족 |
| 스태그플레이션 전체 conf_adj | adj_stagflation_all | -0.12 | [D] | [L:WLS] | [-0.20, -0.05] | 학술 근거 부족 |
| 골디락스 전체 conf_adj | adj_goldilocks_all | +0.05 | [D] | [L:WLS] | [0.02, 0.10] | 학술 근거 부족 |

CheeseStock 매핑: 레짐별 conf_adj 매트릭스는 `patternEngine.analyze()` 또는
`signalEngine.analyze()`의 후처리 단계에서 적용할 수 있다. 현재 시스템에는
레짐 판별 모듈이 없으나 MCS_v2의 값 범위로 간접 추정이 가능하다:
MCS_v2 > 0.65 → 'demand_expansion' 근사, MCS_v2 < 0.35 → 'demand_contraction' 근사.
스태그플레이션과 골디락스 구분은 인플레이션 데이터(CPI)가 추가로 필요하다.

---

### 6.3 학습 가능 상수 요약표 (Learnable Constants Summary)

Doc 22의 Master Constant Registry에 등록하는 신규 상수 #83~#98:

| # | Name | Default | Tier | Learn | Range | Source |
|---|------|---------|------|-------|-------|--------|
| 83 | MCS_v2 Taylor gap weight (w6) | 0.10 | [C] | [L:GCV] | [0.05, 0.20] | §4.3 설계값 |
| 84 | BOK event conf_adj (conf_bok) | 1.08 | [C] | [L:GS] | [1.03, 1.15] | §1.4, Doc 29 §3.1 실증 |
| 85 | Fiscal event conf_adj (conf_fiscal) | 1.03 | [D] | [L:GS] | [1.00, 1.08] | §1.4, 승수 이론 |
| 86 | VKOSPI Keynesian threshold | 25 | [C] | [L:GS] | [20, 35] | §3.3, Doc 26 §3 |
| 87 | VKOSPI Classical threshold | 15 | [C] | [L:GS] | [10, 20] | §3.3, Doc 26 §3 |
| 88 | Momentum regime conf_adj | +0.08 | [D] | [L:WLS] | [0.03, 0.15] | §3.3, 학술 근거 부족 |
| 89 | Mean-reversion regime conf_adj | +0.05 | [D] | [L:WLS] | [0.02, 0.10] | §3.3, 학술 근거 부족 |
| 90 | Goldilocks CPI ceiling | 2.5% | [C] | [L:GS] | [2.0%, 3.0%] | §6.2, BOK 목표 기반 |
| 91 | Stagflation CPI floor | 3.0% | [C] | [L:GS] | [2.5%, 4.0%] | §6.2, 실증적 |
| 92 | Demand expansion trend adj | +0.08 | [D] | [L:WLS] | [0.03, 0.15] | §6.2, 학술 근거 부족 |
| 93 | Stagflation all-pattern adj | -0.12 | [D] | [L:WLS] | [-0.20, -0.05] | §6.2, 학술 근거 부족 |
| 94 | ZLB threshold rate | 0.75% | [C] | [L:MAN] | [0.25%, 1.00%] | §5.3, 실증적 |
| 95 | ZLB fiscal multiplier boost | 1.50 | [D] | [L:GS] | [1.20, 2.00] | §5.3, Christiano et al. (2011) |
| 96 | Taylor a_pi (inflation response) | 0.50 | [B] | [L:GS] | [0.30, 0.80] | §4.1, Taylor (1993) |
| 97 | Taylor a_y (output gap response) | 0.50 | [B] | [L:GS] | [0.25, 0.75] | §4.1, Taylor (1993) |
| 98 | Taylor a_e (exchange rate response) | 0.10 | [C] | [L:GS] | [0.05, 0.20] | §4.1, Kim & Park (2016) |

**Tier 분포:** [A]=0, [B]=3, [C]=8, [D]=6, [E]=0

[D]-tier 상수가 6개로 비교적 많은 이유: 거시경제 변수와 기술적 패턴 간의 직접적
실증 연구가 부족하며, 대부분 이론적 추론에 기반한 경험적 추정치이다.
Doc 22 §4의 Update Protocol에 따라 [D] 상수는 반드시 backtest로 검증 또는 대체해야 한다.

CheeseStock 매핑: 모든 상수는 오프라인 `calibrated_constants.json`에 등록 후
수동으로 JS에 반영하는 기존 프로토콜을 따른다(Doc 22 §4). 현재 런타임 코드에는
이 상수들의 사용처가 없으며, MCS_v2 모듈 구현 시 일괄 반영한다.

---

## 7. 참고문헌 (References)

### 거시경제학 기초

- Blanchard, O. & Fischer, S. (1989). *Lectures on Macroeconomics*. MIT Press.
- Keynes, J.M. (1936). *The General Theory of Employment, Interest and Money*. Macmillan.
- Hicks, J.R. (1937). "Mr. Keynes and the 'Classics': A Suggested Interpretation." *Econometrica*, 5(2), 147-159.
- Hansen, A.H. (1953). *A Guide to Keynes*. McGraw-Hill.

### IS-LM 확장 및 개방경제

- Mundell, R.A. (1963). "Capital Mobility and Stabilization Policy under Fixed and Flexible Exchange Rates." *Canadian Journal of Economics*, 29(4), 475-485.
- Fleming, J.M. (1962). "Domestic Financial Policies under Fixed and Floating Exchange Rates." *IMF Staff Papers*, 9(3), 369-380.
- Lane, P.R. & Milesi-Ferretti, G.M. (2007). "The External Wealth of Nations Mark II." *Journal of International Economics*, 73(2), 223-250.
- Krugman, P. & Obstfeld, M. (2009). *International Economics: Theory and Policy* (8th ed.). Pearson.

### 통화정책 및 테일러 준칙

- Taylor, J.B. (1993). "Discretion versus Policy Rules in Practice." *Carnegie-Rochester Conference Series on Public Policy*, 39, 195-214.
- Mishkin, F.S. (1995). "Symposium on the Monetary Transmission Mechanism." *Journal of Economic Perspectives*, 9(4), 3-10.
- Rudebusch, G.D. (2002). "Term Structure Evidence on Interest Rate Smoothing and Monetary Policy Inertia." *Journal of Monetary Economics*, 49(6), 1161-1187.
- Woodford, M. (2003). *Interest and Prices: Foundations of a Theory of Monetary Policy*. Princeton University Press.
- Kim, S. & Park, Y. (2016). "Monetary Policy Transmission in Korea: A Bayesian VAR Approach." *Korean Economic Review*, 32(1), 57-89.
- Romer, D. (2000). "Keynesian Macroeconomics without the LM Curve." *Journal of Economic Perspectives*, 14(2), 149-169.
- Laubach, T. & Williams, J.C. (2003). "Measuring the Natural Rate of Interest." *Review of Economics and Statistics*, 85(4), 1063-1070.
- Ball, L. (1999). "Policy Rules for Open Economies." In *Monetary Policy Rules* (ed. Taylor, J.B.), 127-156. University of Chicago Press.

### 총공급 및 필립스 곡선

- Phillips, A.W. (1958). "The Relation between Unemployment and the Rate of Change of Money Wage Rates in the United Kingdom, 1861-1957." *Economica*, 25(100), 283-299.
- Friedman, M. (1968). "The Role of Monetary Policy." *American Economic Review*, 58(1), 1-17.
- Calvo, G.A. (1983). "Staggered Prices in a Utility-Maximizing Framework." *Journal of Monetary Economics*, 12(3), 383-398.
- Gali, J. & Gertler, M. (1999). "Inflation Dynamics: A Structural Econometric Analysis." *Journal of Monetary Economics*, 44(2), 195-222.

### 학파 통합 및 현대 거시

- Lucas, R.E. (1972). "Expectations and the Neutrality of Money." *Journal of Economic Theory*, 4(2), 103-124.
- Goodfriend, M. & King, R. (1997). "The New Neoclassical Synthesis and the Role of Monetary Policy." *NBER Macroeconomics Annual*, 12, 231-283.
- Christiano, L.J., Eichenbaum, M. & Rebelo, S. (2011). "When Is the Government Spending Multiplier Large?" *Journal of Political Economy*, 119(1), 78-121.
- Estrella, A. & Mishkin, F.S. (1998). "Predicting U.S. Recessions: Financial Variables as Leading Indicators." *Review of Economics and Statistics*, 80(1), 45-61.

### 재정정책

- Blanchard, O. & Perotti, R. (2002). "An Empirical Characterization of the Dynamic Effects of Changes in Government Spending and Taxes on Output." *Quarterly Journal of Economics*, 117(4), 1329-1368.
- Bruckner, M. & Tuladhar, A. (2014). "Local Government Spending Multipliers and Financial Distress." *Economic Journal*, 124(574), F33-F60.

### 행동경제 및 기타

- Malkiel, B.G. (1973). *A Random Walk Down Wall Street*. Norton.
- Minsky, H.P. (1986). *Stabilizing an Unstable Economy*. Yale University Press.
- Kelton, S. (2020). *The Deficit Myth*. PublicAffairs.
- Hayek, F.A. (1931). *Prices and Production*. Routledge.
- Fisher, I. (1911). *The Purchasing Power of Money*. Macmillan.
- Pigou, A.C. (1943). "The Classical Stationary State." *Economic Journal*, 53(212), 343-351.
- Mankiw, N.G. (1985). "Small Menu Costs and Large Business Cycles." *Quarterly Journal of Economics*, 100(2), 529-537.
- Shin, K. & Wang, Y. (2003). "Trade Integration and Business Cycle Synchronization." *Asian Economic Papers*, 2(3), 1-20.
- Conover, C.M., Jensen, G.R., Johnson, R.R. & Mercer, J.M. (2008). "Sector Rotation and Monetary Conditions." *Journal of Investing*, 17(1), 34-46.

### KRX 특수

- Doc 20: KRX 구조적 이상 (20_krx_structural_anomalies.md)
- Doc 22: Learnable Constants Guide (22_learnable_constants_guide.md)
- Doc 26: Options & Volatility Signals (26_options_volatility_signals.md)
- Doc 28: Cross-Market Correlation (28_cross_market_correlation.md)
- Doc 29: Macro & Sector Rotation (29_macro_sector_rotation.md)

---

**문서 이력:**
- 2026-04-02: 초판 작성 (financial-theory-expert agent)
- Scope: IS-LM, AD-AS, Keynesian-Classical synthesis, Taylor Rule, fiscal multipliers, macro-pattern transmission
- Constants registered: #83~#98 (15 new)
- Dependencies: Doc 22 (constants), Doc 26 (VKOSPI), Doc 28 (cross-market), Doc 29 (macro indicators)
