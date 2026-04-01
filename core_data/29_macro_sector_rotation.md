# 29. 거시경제 지표와 섹터 회전 — Macroeconomic Indicators & Sector Rotation

> "The market is a discounting mechanism for the future economy, but the economy is a lagging indicator of the market."
> — Martin Zweig (1986)

---

## 1. 경기순환과 섹터 회전 이론 (Business Cycle & Sector Rotation Theory)

### 1.1 경기순환 4국면 (Four Phases of Business Cycle)

경기순환은 확장(Expansion) → 정점(Peak) → 수축(Contraction) → 저점(Trough)의 4국면으로 구성된다.

```
GDP_gap(t) = (GDP_actual - GDP_potential) / GDP_potential

Phase 판별:
  Expansion:   GDP_gap(t) > 0 AND d(GDP_gap)/dt > 0
  Peak:        GDP_gap(t) > 0 AND d(GDP_gap)/dt <= 0
  Contraction: GDP_gap(t) < 0 AND d(GDP_gap)/dt < 0
  Trough:      GDP_gap(t) < 0 AND d(GDP_gap)/dt >= 0
```

**NBER 경기판정 방법론의 한국 적용:**
- 미국 NBER: 비농업 고용, 실질 개인소득, 산업생산, 실질 제조업/도매 매출의 정점/저점
- 한국 통계청: 경기종합지수(CI) — 선행(CLI), 동행(CCI), 후행(LCI) 3종 합성지수
  - 선행지수 구성: 재고순환지표, 건설수주, 수출신용장, 코스피, 장단기 금리차 등 10개
  - 동행지수 구성: 산업생산, 서비스생산, 소매판매, 내수출하, 비농취업자 등 7개
  - 선행 → 동행 시차: 평균 6-9개월 (한국은행 연구)

한국 경기순환 이력 (통계청 공식 기준점):

| 순환 | 저점 | 정점 | 확장기(월) | 수축기(월) |
|------|------|------|-----------|-----------|
| 제11순환 | 2013.03 | 2017.09 | 54 | — |
| 제12순환 | 2020.05 | 2022.04 | 23 | 31 |
| 평균 | — | — | 33 | 19 |

### 1.2 섹터 회전 모형 (Sector Rotation Model)

Stovall (1996) "Standard & Poor's Guide to Sector Investing"의 경기순환-섹터 매핑:

```
경기 국면별 선호 섹터:

Early Expansion (초기 확장):
  → Financial (금융): 저금리 + 대출 수요 증가
  → Technology (IT): 설비투자 선행
  → Consumer Discretionary (경기소비재): 소비 회복

Late Expansion (후기 확장):
  → Energy (에너지): 원자재 수요 정점
  → Materials (소재): 생산설비 가동률 극대

Early Contraction (초기 수축):
  → Healthcare (헬스케어): 비경기적 수요
  → Utilities (유틸리티): 방어적 배당
  → Consumer Staples (필수소비재): 비탄력적 수요

Late Contraction (후기 수축):
  → Industrials (산업재): 경기 바닥 선행 매수
  → Consumer Discretionary (경기소비재): 정책 부양 수혜
```

**실증적 한계:** Stovall 모형은 미국 S&P 500 기반이며, 한국은 수출 의존도(GDP 대비 ~50%)와 반도체 편중(KOSPI 시총의 ~25%)으로 인해 직접 적용에 한계가 있다. Conover et al. (2008)은 통화정책 국면이 섹터 회전보다 설명력이 높음을 보고했다.

> **UNVALIDATED FOR KOREA:** 위 섹터 회전 모형은 미국 경기순환 기반(Stovall, 1996)이며
> KRX에서의 실증 검증이 수행되지 않았다. 한국 시장은 (1) 반도체/자동차 수출 편중으로
> 글로벌 수요 사이클에 동조하며, (2) 재벌(chaebol) 구조로 인해 섹터 간 자금 이동이
> 미국과 다른 패턴을 보이고, (3) 개인투자자 비중이 높아 KOSDAQ에서 전통적 섹터 회전이
> 작동하지 않을 수 있다. 본 모형은 분석 프레임워크로만 참고하고, KRX 실증 데이터로
> 검증 후 적용해야 한다.

### 1.3 KRX 섹터 분류 (GICS vs KRX)

| KRX 업종 | GICS 대응 | KOSPI 비중(2025) | 특징 |
|----------|----------|-----------------|------|
| 전기전자 | IT | ~30% | 삼성전자+SK하이닉스 지배 |
| 금융업 | Financials | ~12% | 4대 금융지주 |
| 화학 | Materials | ~8% | 정유·석화 |
| 운수장비 | Industrials | ~7% | 현대차그룹 |
| 서비스업 | Comm. Services | ~5% | 카카오, NAVER |
| 의약품 | Healthcare | ~4% | KOSDAQ 바이오 집중 |
| 철강금속 | Materials | ~3% | POSCO그룹 |
| 건설업 | Industrials | ~2% | 경기 민감 |
| 유통업 | Cons. Discretionary | ~2% | 내수 |
| 전기가스 | Utilities | ~2% | 한전 독점 |
| 음식료 | Cons. Staples | ~2% | 방어적 |

KOSDAQ 특수성 (20_krx_structural_anomalies.md §5 참조):
- 바이오/제약: KOSDAQ 시총의 ~35%, 개인투자자 편중
- IT 소프트웨어: ~15%, 성장주 성격
- 기계장비: ~10%, 수출 연동

---

## 2. 주요 거시경제 지표 (Key Macroeconomic Indicators)

### 2.1 소비자심리지수 (CSI — Consumer Sentiment Index)

한국은행 월간 소비자동향조사 (매월 둘째 주 발표):

```
CSI = (긍정 응답 비율 - 부정 응답 비율 + 100) * 가중치

기준: 100 (2003-2022 장기 평균)
  CSI > 100: 낙관 우세
  CSI < 100: 비관 우세
```

6개 하위지수: 생활형편 전망, 가계수입 전망, 소비지출 전망, 현재경기 판단, 향후경기 전망, 취업기회 전망.

**금융시장 연결:**
- CSI > 110: 소매/소비재 섹터 강세 (소비 확대 기대)
- CSI < 90: 방어 섹터 선호 (필수소비재, 유틸리티)
- 방향 전환 (3개월 연속 하락 → 상승): 경기 회복 선행 지표
  - 실증: 2020.05 CSI 70.7(저점) → 3개월 상승 → KOSPI 6개월 +42%
- CSI 변화율과 KOSPI 상관: r ≈ 0.35 (동시), r ≈ 0.42 (CSI 1개월 선행)

### 2.2 기업경기실사지수 (BSI — Business Survey Index)

한국은행 기업경기조사 (매월):

```
BSI = (호전 응답 업체 수 / 전체 응답 업체 수) × 100 + (동일 응답 × 50/전체) + ...
간이: BSI ≈ (긍정 - 부정) / 전체 × 100 + 100

BSI > 100: 경기 호전 전망 우세
BSI < 100: 경기 악화 전망 우세
```

- 제조업 BSI vs 비제조업 BSI 분리 해석
- 제조업 BSI가 선행: 설비투자 → 고용 → 소비 파급 경로
- BSI → IPI 선행 시차: 약 1-2개월

### 2.3 제조업 PMI (Purchasing Managers' Index)

S&P Global Korea Manufacturing PMI (매월 1영업일 발표):

```
PMI = 0.30 × New_Orders + 0.25 × Output + 0.20 × Employment
    + 0.15 × Supplier_Delivery + 0.10 × Inventories

임계값: 50 = 확장/수축 경계
  PMI > 50: 제조업 확장
  PMI < 50: 제조업 수축
  PMI > 55: 강한 확장 (KOSPI 상승 확률 75%+)
```

하위 구성요소의 섹터별 의미:
- 신규주문(New Orders): IT/반도체 선행 (글로벌 수요)
- 고용(Employment): 내수 소비 선행
- 재고(Inventories): 재고순환 국면 판별

GDP 선행 시차: 1-2분기. Hamilton (2011): PMI는 GDP 방향 전환의 가장 시의적절한(timely) 지표.

### 2.4 산업생산지수 (IPI — Industrial Production Index)

통계청 월간 광업·제조업 동향 (매월 말 발표):

```
IPI_growth_yoy = (IPI_t / IPI_{t-12} - 1) × 100
IPI_growth_mom = (IPI_t / IPI_{t-1} - 1) × 100 (계절조정)
```

- 전체 IPI와 반도체 생산지수의 괴리 발생 시: KOSPI는 반도체에 더 민감
- 반도체 생산지수 3개월 연속 상승 → KOSPI IT 섹터 초과수익 확률 68% (2015-2024)

### 2.5 수출입 동향 (Export/Import Trends)

관세청 수출입동향 (매월 1일 발표, 20일 속보 포함):

```
export_growth = (export_t / export_{t-12} - 1) × 100

한국 특수성: 수출 ≈ GDP × 0.50 (수출 의존 경제)
```

- **20일 속보**: 매월 21일 발표, 가장 빠른 거시 신호
  - 당월 수출 추정치: 20일 실적 × (당월 영업일수 / 20일까지 영업일수)
- 반도체 수출: KOSPI 선행 지표 중 가장 강한 상관 (r ≈ 0.55)
- 수출 → 기업이익 → 주가 파급 경로: 약 1-2개월 시차

참고문헌:
- Shin, K. & Wang, Y. (2003). Trade Integration and Business Cycle Synchronization. *Asian Economic Papers*, 2(3).

---

## 3. 금리와 통화정책 (Interest Rates & Monetary Policy)

### 3.1 한국은행 기준금리 결정

금융통화위원회(금통위): 연 8회 개최 (매월 셋째 주 목요일, 4·7·10·1월 제외).

```
기준금리 변경의 주가 영향:
  Δr = -25bp (인하): KOSPI 평균 +1.2% (당일), +3.5% (1개월)
  Δr = +25bp (인상): KOSPI 평균 -0.8% (당일), -1.5% (1개월)
  동결 (시장 예상 부합): 무반응
  동결 (시장 인하 기대 불발): -0.5% (실망 매도)
```

포워드 가이던스 해석: 2024년부터 한국은행도 점도표(dot plot) 유사 커뮤니케이션 채택. "충분히 제약적" vs "적절한" 표현의 미묘한 차이가 시장 영향.

### 3.2 금리 변동의 섹터별 영향

듀레이션 프레임워크에 기반한 주식의 금리 민감도:

```
Equity Duration (D_equity):
  D_equity ≈ 1 / (r - g)

  Growth stock (g=8%, r=10%): D ≈ 50 (극도로 민감)
  Value stock (g=2%, r=10%): D ≈ 12.5 (상대적 둔감)
```

| 민감도 | 섹터 | 메커니즘 | 금리 상승 시 |
|--------|------|----------|-------------|
| 강한 음(-) | 바이오/성장 | D_equity > 30, 장기 현금흐름 할인 | 주가 하락 |
| 강한 음(-) | REITs/건설 | 레버리지 비용 직접 증가 | 주가 하락 |
| 강한 음(-) | 고배당주 | 채권 대체재 수요 감소 | 주가 하락 |
| 강한 양(+) | 은행/보험 | NIM(순이자마진) 확대 | 주가 상승 |
| 강한 양(+) | 증권사 | 예탁금 이자수익 증가 | 주가 상승 |
| 중립 | 수출 대기업 | 환율 효과와 상쇄 | 혼재 |
| 중립 | 필수소비재 | 가격전가력(pricing power) 보유 | 방어적 |

금융 적용: 23_apt_factor_model.md의 APT 팩터 확장에서 `yield_curve_norm`을 추가 팩터로 구성 가능.

### 3.3 수익률 곡선과 경기 예측 (Yield Curve)

```
Yield_Spread = Y_10Y - Y_2Y (또는 Y_10Y - Y_3Y)

역전(inversion): Spread < 0 → 경기침체 선행 신호
  미국: 8/8 경기침체 사전 예측 (1960-2020, Estrella & Mishkin 1998)
  한국: 국고채 10년-3년 스프레드 기준, 5회 중 4회 경기침체 선행
  선행 시차: 12-18개월 (미국), 6-12개월 (한국, 짧은 사이클)
```

한국 국고채 스프레드 역전 이력:

| 역전 시기 | 스프레드(bp) | 후속 경기 | KOSPI 반응 |
|----------|-------------|----------|-----------|
| 2006.11 | -15 | 2008 금융위기 | -54% (12개월) |
| 2019.08 | -5 | 2020 COVID | -35% (6개월 후 반등) |
| 2022.10 | -25 | 2023 경기둔화 | -8% (3개월) |

참고문헌:
- Estrella, A. & Mishkin, F. (1998). Predicting U.S. Recessions. *Review of Economics and Statistics*, 80(1).
- 한국은행 (2023). 수익률 곡선의 경기예측력 분석. *BOK 이슈노트*.

---

## 4. 인구통계와 구조적 섹터 테마 (Demographics & Structural Themes)

### 4.1 한국 인구 구조 특수성

```
인구 구조 핵심 지표 (통계청 2026):
  합계출산율: 0.72 (세계 최저)
  65세 이상 비율: 18.6% (2026), 25%+ (2030s 전망)
  베이비붐 세대(1955-1963) 은퇴 정점: 2023-2030
  생산가능인구 감소율: -0.5%/년
  1인 가구 비율: 34.5% (2025)
```

인구 구조는 5-20년 주기의 구조적 테마를 형성하며, 단기 경기순환과 독립적이다. 이는 기술적 패턴의 장기 방향성 편향(directional bias)으로 작용한다.

### 4.2 고령화 수혜 섹터

- **헬스케어/바이오**: 국민건강보험 지출 연 8%+ 성장 (2020-2025)
- **실버산업**: 요양, 보조기기, 시니어 주거 — 직접 수요 증가
- **역모기지/금융**: 퇴직연금, 자산관리 — 은퇴 자산 운용 수요
- 패턴 신뢰도 보정: 구조적 순풍(tailwind)과 일치하는 매수 패턴 → 신뢰도 +5~10%

### 4.3 저출산 피해 섹터

- **교육**: 학령인구 감소 → 매출 역성장 구조화
- **주거/건설**: 중장기 수요 감소 (단기는 1인 가구 증가로 상쇄)
- **내수 소비재**: 경제활동인구 감소 → 소비 총량 축소

### 4.4 디지털 전환 테마

- **AI/반도체**: HBM, AI 가속기 구조적 수요 (TSMC, 삼성, SK하이닉스)
- **Cloud/SaaS**: 기업 디지털 전환 지속
- **EV/배터리**: 운송 전동화 (LG에너지, 삼성SDI)
- MSCI 글로벌 테마 지수와의 연결: MSCI ACWI IMI Disruptive Technology 등

---

## 5. 사회문화적 보조 지표 (Socio-Cultural Supplementary Indicators)

### 5.1 검색량 기반 지표 (Search Volume Indicators)

**네이버 DataLab** (상대 검색 트렌드 0-100):

```
검색량 → 시장 반응 Granger 인과:
  search_volume → trading_volume: 강한 인과 (p < 0.01, 1-3일 선행)
  search_volume → returns: 약한 인과 (p < 0.10, 동시적)

금융 키워드별 의미:
  "주식": 일반적 관심 → 신규 진입 proxy
  "코스피": 시장 전체 관심 → 거래량 선행
  "공매도": 공포/불안 proxy → 변동성 확대 신호
  "급등주": 탐욕 proxy → 과열 경고 (19_social_network_effects.md §2.2)
```

**Google Trends** (글로벌 관심 측정):
- "KOSPI", "Samsung stock", "반도체" 등 영문 키워드
- 외국인 투자자 관심 proxy → MSCI 흐름 예측 보조
- Da et al. (2011): Google SVI(Search Volume Index)가 IPO 첫날 수익률과 개인투자자 수요를 유의하게 예측

### 5.2 정책 불확실성 지수 (EPU — Economic Policy Uncertainty)

Baker, Bloom & Davis (2016) 방법론:

```
EPU = (1/3) × Newspaper_Uncertainty + (1/3) × Tax_Code_Expiration
    + (1/3) × Forecast_Dispersion

한국 EPU (NBER 공개 데이터):
  Newspaper component: 경향신문, 한국경제, 동아일보 등 5개지
  키워드: "불확실", "경제정책", "규제", "세금", "한국은행"
```

EPU와 기술적 패턴의 상호작용:
- 고 EPU (> 1 표준편차): 변동성 확대 → 돌파(breakout) 패턴 신뢰도 상승
- 저 EPU (< -1 표준편차): 레인지 바운드 → 평균회귀 패턴 신뢰도 상승
- 21_adaptive_pattern_modeling.md §HMM 레짐 분류와 연동: EPU 레벨이 레짐 전환 확률에 영향

참고문헌:
- Baker, S., Bloom, N. & Davis, S. (2016). Measuring Economic Policy Uncertainty. *QJE*, 131(4).
- Da, Z. et al. (2011). In Search of Attention. *JF*, 66(5).

### 5.3 소셜 미디어 감성 (Social Media Sentiment)

19_social_network_effects.md §3 (한국어 감성분석)과의 연결:

| 측정 방법 | 데이터 소스 | 처리 | 실시간 가능 |
|----------|-----------|------|-----------|
| 네이버 금융 게시판 감성 | 공개 데이터 크롤링 | 빈도 기반 | Yes (ws_server.py 확장) |
| KR-FinBERT 추론 | 뉴스/게시판 텍스트 | Python 서버 필요 | Batch only |
| YouTube 금융 콘텐츠량 | API | 조회수/구독자 추이 | Daily batch |

아키텍처 제약: CheeseStock은 브라우저 전용 JS → 감성 데이터는 `ws_server.py` 확장 또는 사전 배치 처리 후 `data/sentiment.json`으로 제공.

### 5.4 가계부채/신용 지표 (Household Debt/Credit)

```
한국 가계부채 핵심 지표:
  가계부채/GDP 비율: ~105% (2025, 세계 상위권)
  신용카드 사용 증가율: 소비 선행 proxy
  신용거래융자 잔고(KRX): 증시 레버리지 수준 측정
```

- 신용거래융자 잔고 + 가격 고점 근접 = 취약성 지표 (vulnerability indicator)
  - 2021.06 신용융자 잔고 25조원 + KOSPI 3,300 → 이후 -25% 하락
- 신용융자/시가총액 비율 > 1.5%: 경계 수준 (과거 3회 중 2회 조정 선행)

참고문헌:
- Mian, A. & Sufi, A. (2014). *House of Debt*. University of Chicago Press.

---

## 6. 복합 거시-기술 신호 체계 (Composite Macro-Technical Signal System)

### 6.1 거시 레짐 분류 (Macro Regime Classification)

Hamilton (1989) Markov-Switching 모형의 간이 적용 (21_adaptive_pattern_modeling.md §HMM 참조):

```
레짐 분류 (2×2 매트릭스):

              Low Volatility          High Volatility
           ┌─────────────────────┬─────────────────────┐
Expansion  │ Regime 1: Goldilocks│ Regime 2: Hot       │
           │ 추세추종 패턴 선호   │ 모멘텀 + 넓은 손절   │
           │ conf × 1.05         │ ATR multiplier × 1.3 │
           ├─────────────────────┼─────────────────────┤
Contraction│ Regime 3: Quiet Bear│ Regime 4: Crisis    │
           │ 평균회귀 패턴 선호   │ 현금/방어, 신호 축소 │
           │ 평균회귀 conf × 1.05│ 전체 conf × 0.80    │
           └─────────────────────┴─────────────────────┘

분류 기준:
  Expansion/Contraction: PMI > 50 (3개월 이동평균) 또는 CLI 방향
  Low/High Volatility: VKOSPI < 20 (Low) vs VKOSPI > 25 (High)
```

### 6.2 거시 컨텍스트 점수 (Macro Context Score)

```
MCS = w1 * PMI_norm + w2 * CSI_norm + w3 * export_growth_norm
    + w4 * yield_curve_norm + w5 * EPU_inv_norm

가중치: w1=0.25, w2=0.20, w3=0.25, w4=0.15, w5=0.15

정규화:
  PMI_norm = (PMI - 35) / (65 - 35)       [0,1] 클리핑
  # 코드 구현: (BSI/2 - 35) / 30, 상수 #143=35(low), #144=30(range)
  # 한국 BSI 기반 PMI는 미국 ISM PMI보다 범위가 좁아 (35,65) 정규화 사용
  CSI_norm = (CSI - 80) / (120 - 80)       [0,1] 클리핑
  export_growth_norm = (exp_g + 20) / 40   [0,1] 클리핑 (YoY%)
  yield_curve_norm = (spread + 50) / 150   [0,1] 클리핑 (bp)
  EPU_inv_norm = 1 - (EPU - 50) / (200 - 50) [0,1] 클리핑
  # 코드 구현: VIX를 EPU proxy로 사용 — 1 - (VIX - 12) / 28, clipped [0,1]
  # 변수명은 epu_inv이나 실제 입력은 VIX (FRED VIXCLS). EPU 직접 데이터가
  # 확보되면 원래 공식으로 전환 예정. download_macro.py §5 참조.

MCS 해석:
  MCS > 0.6: 거시 강세 → 매수 패턴 신뢰도 × 1.05~1.10
  MCS < 0.4: 거시 약세 → 매도 패턴 신뢰도 × 1.05~1.10
  0.4 <= MCS <= 0.6: 중립 → 조정 없음
  MCS와 패턴 방향 불일치: 조정 없음 (충돌 시 기술적 신호 우선)
```

MCS 가중치는 22_learnable_constants_guide.md의 [C][L:GCV] 범주에 해당: 교차검증으로 최적화 가능하나, 초기값은 학술 문헌의 예측력 순서에 기반.

### 6.3 이벤트 캘린더 통합

거시 이벤트 발생 시 기술적 패턴의 신뢰도가 급격히 저하된다 (20_krx_structural_anomalies.md §7 공시 타이밍 효과 참조):

```
이벤트별 패턴 억제 규칙:

| 이벤트 | 억제 범위 | 근거 |
|--------|----------|------|
| 금통위 기준금리 결정 | 발표 전후 1시간 | 변동성 급등 |
| MSCI 리밸런싱 | 발효일 전후 1일 | 패시브 흐름 왜곡 |
| 옵션/선물 만기 | 만기일 최후 30분 | (20_krx_structural_anomalies §9.3) |
| GDP/고용 발표 | 발표 후 1시간 | 매크로 서프라이즈 |
| 20일 수출 속보 | 발표 후 30분 | 한국 특수 선행지표 |

억제 방식: 해당 시간대 패턴 신뢰도 × 0.70 (완전 비활성화 아닌 감산)
```

---

## 7. CheeseStock 구현 경로

### 7.1 데이터 소스 우선순위

| 데이터 | 소스 | API 형식 | 빈도 | 우선순위 |
|--------|------|---------|------|---------|
| CSI (소비자심리) | 한국은행 ECOS | REST JSON | 월간 | P1 |
| PMI (제조업) | S&P Global | 공개 발표 | 월간 | P1 |
| 수출 데이터 | 관세청 | 공개 | 월간/20일 속보 | P1 |
| 기준금리 | 한국은행 ECOS | REST JSON | 연 8회 | P1 |
| EPU | NBER | CSV 다운로드 | 월간 | P2 |
| 검색량 | 네이버 DataLab | API | 일간 | P2 |
| 인구통계 | 통계청 KOSIS | REST API | 연간 | P3 |

### 7.2 파일 구조

```
scripts/download_macro.py → data/macro.json

data/macro.json 스키마:
{
  "updated": "2026-03-30",
  "csi": { "value": 98.2, "date": "2026-02", "mom_change": -1.3 },
  "bsi": { "manufacturing": 95, "non_manufacturing": 92, "date": "2026-03" },
  "pmi": { "value": 51.2, "date": "2026-02" },
  "exports": {
    "total_yoy": 8.5, "semi_yoy": 15.2,
    "prelim_20d": 12.3, "date": "2026-03"
  },
  "base_rate": { "value": 2.75, "last_change": "2026-01-16", "direction": "cut" },
  "yield_spread": { "10y_3y_bp": 25, "10y_2y_bp": 18, "date": "2026-03-28" },
  "epu": { "value": 132.5, "date": "2026-02" }
}

갱신 주기: 월간 배치 (daily_update.bat에 추가, 매월 1-15일 사이 실행)
```

### 7.3 APT 확장

23_apt_factor_model.md의 기존 17열 회귀에 거시 팩터 추가:

```
기존: 17열 (hw, mw, confidence, signal_dir, market_type, ...)
확장: 19-20열에 PMI_norm, yield_curve_norm 추가

기대 IC 기여: +0.003~0.010 (한계적이나 레짐 전환기에 집중)

섹터별 차등 팩터 로딩:
  beta_PMI(금융) ≈ +0.15 (PMI 상승 → 금융 강세)
  beta_PMI(바이오) ≈ -0.05 (PMI 둔감, 역방향 약간)
  beta_yield(은행) ≈ +0.20 (금리 상승 → NIM 확대)
  beta_yield(성장) ≈ -0.25 (금리 상승 → 할인율 증가)
```

### 7.4 Learnable Constants (#75-#82)

22_learnable_constants_guide.md 체계에 따른 분류:

| # | 상수명 | 현재값 | 등급 | 학습 방법 |
|---|--------|-------|------|----------|
| 75 | MCS_w1 (PMI weight) | 0.25 | [C] | [L:GCV] |
| 76 | MCS_w2 (CSI weight) | 0.20 | [C] | [L:GCV] |
| 77 | MCS_w3 (export weight) | 0.25 | [C] | [L:GCV] |
| 78 | MCS_w4 (yield weight) | 0.15 | [C] | [L:GCV] |
| 79 | MCS_w5 (EPU weight) | 0.15 | [C] | [L:GCV] |
| 80 | regime_vol_threshold | 22.5 | [C] | [L:Manual] |
| 81 | sector_PMI_beta | 섹터별 | [B] | [L:WLS] |
| 82 | event_suppress_factor | 0.70 | [C] | [L:Manual] |

---

## 8. 핵심 정리

| 개념 | 학술 출처 | KRX 적용 | JS 연결 |
|------|----------|---------|--------|
| 경기순환 4국면 | NBER, 통계청 CLI | 섹터 회전 타이밍 | macro.json → MCS 계산 |
| Stovall 섹터 회전 | Stovall (1996) | KRX 11섹터 매핑 | 섹터별 패턴 신뢰도 조정 |
| PMI/CSI 선행성 | Hamilton (2011) | 1-2분기 GDP 선행 | PMI_norm 팩터 |
| 수익률 곡선 역전 | Estrella & Mishkin (1998) | 국고채 10Y-3Y | yield_curve_norm 팩터 |
| 금리 민감도 | Equity duration 이론 | 섹터별 차등 영향 | APT beta_yield 확장 |
| 인구 구조 | 통계청 | 초저출산 구조적 테마 | 장기 방향성 편향 |
| EPU | Baker et al. (2016) | 레짐 전환 보조 | EPU_inv_norm 팩터 |
| 검색량 선행 | Da et al. (2011) | 네이버 DataLab | 거래량 예측 보조 |
| 가계부채 | Mian & Sufi (2014) | 신용융자 취약성 | 시장 과열 경보 |
| 거시 레짐 | Hamilton (1989) | 2×2 매트릭스 | MCS + VKOSPI 분류 |

---

## 참고문헌

1. Stovall, R. (1996). *Standard & Poor's Guide to Sector Investing*. McGraw-Hill.
2. Baker, S., Bloom, N. & Davis, S. (2016). Measuring Economic Policy Uncertainty. *QJE*, 131(4).
3. Fama, E. & French, K. (1989). Business Conditions and Expected Returns on Stocks and Bonds. *JFE*, 25(1).
4. Hamilton, J.D. (1989). A New Approach to the Economic Analysis of Nonstationary Time Series. *Econometrica*, 57(2).
5. Hamilton, J.D. (2011). Calling Recessions in Real Time. *International Journal of Forecasting*, 27(4).
6. Estrella, A. & Mishkin, F. (1998). Predicting U.S. Recessions. *Review of Economics and Statistics*, 80(1).
7. Conover, C.M. et al. (2008). Is Fed Policy Still Relevant for Investors? *FAJ*, 64(1).
8. Da, Z., Engelberg, J. & Gao, P. (2011). In Search of Attention. *JF*, 66(5).
9. Mian, A. & Sufi, A. (2014). *House of Debt*. University of Chicago Press.
10. Shin, K. & Wang, Y. (2003). Trade Integration and Business Cycle. *Asian Economic Papers*, 2(3).
11. 한국은행 (2023). 수익률 곡선의 경기예측력 분석. *BOK 이슈노트*.
12. 통계청. 경기종합지수 작성 방법론. *통계청 공식 가이드*.
