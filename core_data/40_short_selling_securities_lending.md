# Doc 40: 공매도와 대차거래 분석 (Short Selling & Securities Lending Analytics)

> "In a market without short sellers, the only opinions that get reflected in stock
> prices are those of optimists. The result is overpricing."
> -- Edward M. Miller, *Risk, Uncertainty, and Divergence of Opinion*,
> Journal of Finance (1977), 32(4), p. 1151

---

## 1. 개요

공매도(short selling)는 보유하지 않은 주식을 차입하여 매도한 후, 향후 저가에
재매수하여 반환함으로써 하락 시 이익을 추구하는 거래 전략이다. 이는 단순한
투기 수단을 넘어 **가격 발견(price discovery)**의 핵심 메커니즘이며, 시장
효율성(EMH, Doc 05 §1)의 필수 조건이다.

공매도가 금지되거나 제약되면, 비관적 정보가 가격에 반영되지 못하여 체계적
고평가(overpricing)가 발생한다(Miller 1977). 이는 Doc 31 §1의 수요-공급
프레임워크에서 공급곡선의 좌측 이동으로 해석된다: 매도 희망자 중 일부(차입
매도자)가 시장에서 배제되면, 균형가격 p*가 진정 가치(intrinsic value) V보다
상방으로 편향된다.

본 문서는 6가지 핵심 영역을 다룬다:

```
1. 공매도 이론적 기초     → Miller, Diamond-Verrecchia, 정보적 거래 이론
2. KRX 공매도 제도        → 한국 고유의 규제 체계, 역사적 금지 기간
3. 공매도 비율(SIR) 분석  → 공매도 잔고, Days-to-Cover, 모멘텀
4. 숏 스퀴즈 탐지         → 스퀴즈 조건, 리스크 스코어, KRX 사례
5. 대차거래 분석          → 차입 수수료, 풀 활용률, 정보 프록시
6. 공매도-주가 비선형성   → 레짐 의존적 해석, VKOSPI 교호작용
7. 제도적 이벤트 효과     → 금지/해제 전후 가격 반응, 패턴 왜곡
8. CheeseStock 구현 경로  → 데이터 파이프라인, 신호 매핑, 상수 등록
```

**기존 문서와의 관계:**

| 내용 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| 수요-공급, 가격 발견 | Doc 31 §1 | 공매도 제약이 공급곡선을 왜곡하는 메커니즘 |
| KRX 구조적 이상 | Doc 20 §1-2 | 공매도 규제의 구조적 영향 정량화 |
| EMH, 시장 효율성 | Doc 05 §1 | 공매도 제약이 효율성을 저해하는 채널 |
| Kyle 모형, 정보 비대칭 | Doc 18 §1 | 공매도자의 정보 우위 실증 근거 |
| 옵션 변동성, VKOSPI | Doc 26 §1-2 | 공매도-변동성 교호작용, 레짐 조건부 해석 |
| 공매도 금지 패턴 왜곡 | Doc 33 §8.3 | 정량적 SIR/DTC 기반 신호 체계 |
| 외국인/기관 수급 | Doc 29 §3 | 투자자 유형별 공매도 행태 차이 |
| 탐색 비용, 주의 제한 | Doc 32 §3 | 공매도 비용(cost of borrowing)과 탐색 비용의 유사성 |

**CheeseStock 구현 경로 요약:**

```
[데이터 수집]                    [분석]                    [신호 출력]
KRX 공매도 잔고 (daily)     →   SIR, DTC 계산          →  shortInterestRatio
KSD 대차잔고/수수료         →   lending utilization     →  lendingFeeSignal
가격/거래량/ATR             →   squeezeRisk score      →  squeezeAlert
VKOSPI regime (Doc 26)      →   regime-conditional     →  shortRegimeAdj
                                                           ↓
                                                    패턴 신뢰도 조정
```

---

## 2. 공매도 이론적 기초 (Theoretical Foundations of Short Selling)

### 2.1 Miller (1977): 이견의 발산과 공매도 제약

Edward Miller의 핵심 통찰은 투자자들의 의견이 이질적(heterogeneous)일 때,
공매도 제약이 체계적으로 고평가를 유발한다는 것이다.

**모형 설정:**

투자자 i는 주식의 가치에 대해 사전 평가 V_i를 가진다. V_i는 평균 μ_V,
분산 σ²_V의 분포를 따른다.

```
공매도 자유 시장:
  P* = E[V_i | all i] = μ_V
  — 모든 의견(낙관+비관)이 반영되어 진정 가치에 수렴

공매도 제약 시장:
  P_constrained = E[V_i | V_i ≥ P_constrained]
  — 비관적 투자자(V_i < P)가 매도 불가 → 낙관적 의견만 반영
  — 결과: P_constrained > μ_V (체계적 고평가)

고평가 폭 (overpricing magnitude):
  ΔP = P_constrained - μ_V
  ΔP ∝ σ²_V  (의견 분산이 클수록 고평가 심화)
  ΔP ∝ 1/float  (유통주식 적을수록 고평가 심화)
```

**실증적 함의 — KRX 맥락:**

| 조건 | 이견 분산 σ²_V | 공매도 제약 | 고평가 예측 |
|------|---------------|-----------|-----------|
| KOSDAQ 소형 바이오 | 극대 | 대부분 비적격 | 매우 심각 |
| KOSPI 200 대형주 | 소 | 적격 (금지 기간 제외) | 경미 |
| 공매도 금지 기간 전체 | 산업별 상이 | 전면 제약 | σ²_V에 비례 |
| IPO 직후 (락업 기간) | 극대 | 대주주 매도 제한 | 심각 |

Doc 33 §8.3에서 공매도 금지 기간의 패턴 신뢰도 보정 공식(bearish 0.70,
bullish 0.90)을 제시하였으나, 이 값은 Miller (1977)의 이론에 의해 종목별
σ²_V에 조건부로 정밀화할 수 있다:

```
overpricing_adj = 1 + α × σ²_V × shortBanDummy

여기서:
  α = 고평가 계수 (실증 교정 필요)
  σ²_V = 수익률 분산 (최근 60일 기준) — 의견 이질성 프록시
  shortBanDummy = 1 if 공매도 금지 기간, 0 otherwise
```

참고문헌:
- Miller, E. (1977). Risk, Uncertainty, and Divergence of Opinion. *Journal of Finance*, 32(4), 1151-1168.
- Chen, J., Hong, H. & Stein, J.C. (2002). Breadth of Ownership and Stock Returns. *JFE*, 66(2-3), 171-205.

---

### 2.2 Diamond & Verrecchia (1987): 공매도 제약과 가격 조정 속도

Diamond & Verrecchia (1987)는 합리적 기대 모형(rational expectations model)에서
공매도 제약이 가격 발견의 속도(speed of price adjustment)에 미치는 영향을 분석했다.

**핵심 결과:**

```
명제 1 (가격 발견 비대칭):
  공매도 제약이 존재하면, 부정적 정보는 가격에 느리게 반영되고
  긍정적 정보는 정상 속도로 반영된다.

  adjustment_speed(bad_news) < adjustment_speed(good_news)

명제 2 (공매도 자체의 정보성):
  합리적 시장에서, 공매도 거래가 관찰되면 이는 "정보적 거래자가
  공매도 비용을 감수할 만큼 부정적 정보를 보유"한다는 신호이다.

  E[r_{t+1} | short_volume_t > 0] < E[r_{t+1} | short_volume_t = 0]

명제 3 (공매도 부재의 정보 부재):
  공매도가 관찰되지 않는 것은 "좋은 뉴스"가 아니라
  "정보가 없음" 또는 "공매도 비용이 너무 높음"일 수 있다.
  → 공매도 부재만으로 bullish 신호 추출 불가
```

**수학적 정형화:**

정보 사건(information event) I가 발생했을 때 가격 반응 시간 τ:

```
공매도 허용:
  τ_up   = f(σ_noise, λ_Kyle)         — 상승 반응 시간
  τ_down = f(σ_noise, λ_Kyle)         — 하락 반응 시간 (대칭)

공매도 제약:
  τ_up   = f(σ_noise, λ_Kyle)         — 변동 없음
  τ_down = f(σ_noise, λ_Kyle) + Δτ    — 지연 발생

  Δτ ∝ c_borrow / |ΔV|
  여기서 c_borrow = 차입 비용, |ΔV| = 정보 가치
  — 차입 비용이 높거나 정보 가치가 작으면 지연 극대화
```

**패턴 분석 함의:**

이 비대칭성은 기술적 패턴의 형성 속도에 직접 영향을 미친다:

| 패턴 유형 | 공매도 허용 시 | 공매도 제약 시 |
|----------|-------------|-------------|
| Head & Shoulders (하락 전환) | 정상 속도 형성 | 형성 지연, 우측 어깨 비대칭 |
| Evening Star (하락 반전) | 3봉 내 완결 | 확인봉 지연 가능 |
| Double Top | 2차 고점 → 하락 정상 | 2차 고점 상방 이탈 위험 |
| Descending Triangle | 수렴 후 하방 이탈 | 이탈 지연, 삼각형 연장 |

참고문헌:
- Diamond, D.W. & Verrecchia, R.E. (1987). Constraints on Short-Selling and Asset Price Adjustment to Private Information. *JFE*, 18(2), 277-311.

---

### 2.3 Boehmer, Jones & Zhang (2008): 공매도의 정보 함량

Boehmer, Jones & Zhang (2008)는 NYSE 종목 수준 공매도 데이터를 분석하여,
공매도 거래가 정보적 거래(informed trading)임을 실증적으로 입증하였다.

**핵심 발견:**

```
실증 결과 (NYSE 2000-2004):
  1. 공매도 비중이 높은 종목은 향후 20일 수익률이 유의하게 낮음
     E[r_{t,t+20} | high_short_volume_t] = -1.16% (월간, 위험조정 후)

  2. 공매도자는 기관투자자보다 정보 우위:
     — 기관 공매도: 향후 수익률 예측력 높음
     — 개인 공매도: 예측력 불분명 (잡음 or 역정보)

  3. 공매도 흐름은 유동성이 아닌 정보에 의해 주도:
     — 스프레드와 공매도의 상관관계 낮음
     — 실적 발표, M&A 루머 시기 공매도 급증
```

**정보적 공매도 비율 (Informed Short Ratio):**

```
ISR_t = shortVolume_t / totalVolume_t

ISR 해석 기준 (미국 시장 기준, KRX 보정 필요):
  ISR < 0.15: 정상 수준 (유동성 공매도 포함)
  0.15 ≤ ISR < 0.25: 경계 (정보적 공매도 가능)
  0.25 ≤ ISR < 0.40: 높음 (부정적 정보 반영 중)
  ISR ≥ 0.40: 극단적 (매우 강한 하방 신호)
```

**KRX 특수성:**

한국 시장에서 공매도의 정보 함량은 미국과 구조적으로 다르다:

```
KRX 공매도 참여자 구조:
  외국인: ~60-70% (주로 정보적 거래)
  기관: ~25-30% (헤지 + 정보적)
  개인: ~3-5% (2025년 부분 해제 후, 제한적)

→ KRX에서 공매도는 "외국인 + 기관의 정보적 거래"로 해석 가능
→ 미국보다 공매도 1단위당 정보 함량이 높을 가능성
   (비용과 규제가 높으므로, 진입 장벽이 비정보 거래를 필터링)
```

참고문헌:
- Boehmer, E., Jones, C.M. & Zhang, X. (2008). Which Shorts Are Informed? *JF*, 63(2), 491-527.
- Diether, K.B., Lee, K.-H. & Werner, I.M. (2009). Short-Sale Strategies and Return Predictability. *RFS*, 22(2), 575-607.

---

### 2.4 Bris, Goetzmann & Zhu (2007): 공매도 효율성의 국제 비교

Bris, Goetzmann & Zhu (2007)는 46개국의 공매도 규제와 시장 효율성의 관계를
분석하여, 공매도가 가능한 시장이 더 효율적임을 보였다.

```
핵심 결과 (46개국, 1990-2001):
  1. 공매도가 가능하고 실행되는 시장:
     — 부정적 정보가 더 빠르게 가격에 반영
     — 수익률 분포의 음의 왜도(negative skewness)가 낮음

  2. 공매도 금지 시장:
     — 가격 발견 지연 → 충격 시 급락 위험 축적
     — 음의 왜도 증가 (꼬리 위험 축적)

  3. 한국(KRX)은 "공매도 가능하나 실행이 제한적" 그룹:
     — 제도적으로 허용되나 높은 비용, 적격 종목 제한
     — "반쪽짜리 효율성" 문제
```

**효율성 지표 — 가격 발견 속도 비교:**

```
delay(p) = 1 - (R²_p / R²_q)

여기서:
  R²_p = 개별 종목 수익률의 시장 수익률에 대한 설명력 (즉시 반응)
  R²_q = 시차 시장 수익률 포함 시 설명력 (지연 반응 포함)

  delay → 0: 가격 발견 빠름 (효율적)
  delay → 1: 가격 발견 느림 (비효율적)

국가별 delay 비교:
  미국 (공매도 자유):     delay ≈ 0.15
  일본 (부분 제약):       delay ≈ 0.22
  한국 (높은 제약):       delay ≈ 0.28
  중국 (강한 제약):       delay ≈ 0.35
```

참고문헌:
- Bris, A., Goetzmann, W.N. & Zhu, N. (2007). Efficiency and the Bear: Short Sales and Markets Around the World. *JF*, 62(3), 1029-1079.

---

### 2.5 Hong, Li, Ni & Scheinkman (2015): Days-to-Cover와 주식 수익률

Hong et al. (2015)는 Days-to-Cover(DTC)가 공매도 잔고(short interest) 자체보다
더 강력한 수익률 예측 변수임을 보였다.

```
이론적 근거:
  DTC = shortBalance / avgDailyVolume

  DTC는 두 가지 정보를 동시에 포착:
  1. shortBalance: 시장의 비관적 견해 규모
  2. avgDailyVolume: 해당 정보가 해소(커버)되는 데 걸리는 시간

  DTC가 높다 = 비관적 포지션이 크고 + 청산이 어려움
            = 더 강한 하방 신호

실증 결과:
  Long-Short portfolio (Low DTC - High DTC):
  월간 초과수익률 = 1.07% (t-stat = 3.12)
  — SIR 단독 기반 포트폴리오보다 예측력 우수

  DTC 분위수별 향후 1개월 수익률:
  Q1 (DTC < 1):    +0.82%
  Q2 (1-3):        +0.45%
  Q3 (3-5):        -0.12%
  Q4 (5-10):       -0.68%
  Q5 (DTC > 10):   -1.24%
```

참고문헌:
- Hong, H., Li, W., Ni, S.X. & Scheinkman, J.A. (2015). Days to Cover and Stock Returns. *NBER Working Paper* No. 21166.
- Rapach, D.E., Ringgenberg, M.C. & Zhou, G. (2016). Short Interest and Aggregate Stock Returns. *JFE*, 121(1), 46-65.

---

## 3. KRX 공매도 제도 (KRX Short Selling Regulatory Framework)

### 3.1 법적 체계

한국의 공매도 규제는 자본시장법(자본시장과 금융투자업에 관한 법률) 제180조에
근거하며, 금융위원회(FSC)와 금융감독원(FSS)이 규제 및 감독을 담당한다.

```
핵심 규제 원칙:
  1. 차입 공매도(covered short)만 허용
     — 무차입 공매도(naked short selling) 전면 금지
     — 매도 시점에 차입 사실 증명 필요

  2. 공매도 호가 제한 (uptick rule 한국판):
     — 직전 체결가 이하 공매도 호가 금지 (2021년 이후 적용)
     — 하락 가속 방지 목적

  3. 공시 의무 (disclosure requirement):
     — 순공매도 포지션 ≥ 상장주식 총수의 0.01%: 거래소 보고
     — 순공매도 포지션 ≥ 0.5%: 공시 (일반 투자자 열람 가능)

  4. 적격 종목 제한:
     — 모든 상장 종목에서 공매도 가능하지 않음
     — KOSPI200, KOSDAQ150 구성종목 + 일부 추가 지정 종목
     — 소형주, 관리종목 등은 비적격
```

**공매도 유형 분류:**

| 유형 | 설명 | 허용 여부 | 비고 |
|------|------|----------|------|
| 차입 공매도 (covered short) | 증권 차입 후 매도 | 허용 | 차입 증빙 필요 |
| 무차입 공매도 (naked short) | 차입 없이 매도 | 금지 | 형사처벌 대상 |
| 시장조성 공매도 | LP/MM의 유동성 공급 | 허용 | 별도 규정 |
| 차익거래 공매도 | 선물-현물 차익거래 | 조건부 허용 | 프로그램 매매 규정 |

### 3.2 역사적 공매도 금지 기간 (Historical Short Selling Bans)

한국은 글로벌 위기 시마다 공매도를 전면 금지하는 정책을 반복하였다:

```
금지 기간 일람:

1차 금지 (GFC):
  기간: 2008.10.01 ~ 2009.05.31 (8개월)
  대상: 전체 상장종목
  배경: 글로벌 금융위기, KOSPI 1000 이탈 방어
  결과: 금지 해제 후 일시적 하락 → 정상화

2차 금지 (COVID-19):
  기간: 2020.03.16 ~ 2021.05.02 (14개월)
  대상: 전체 상장종목
  배경: COVID-19 팬데믹, KOSPI 1400대 급락
  결과: 금지 기간 중 KOSPI 3300 돌파 (역사적 고점)
       해제 후 조정 국면 진입

3차 금지 (불법 공매도):
  기간: 2023.11.06 ~ 2025.03.30 (17개월)
  대상: 전체 상장종목
  배경: 외국계 투자은행의 무차입 공매도 적발
       (글로벌 IB 4곳 과징금 부과)
  결과: 제도 개선 후 부분 재개
       개인투자자 공매도 접근성 확대 (2025.03.31~)

4차 부분 재개 (2025~):
  기간: 2025.03.31~
  대상: KOSPI200 + KOSDAQ150 구성종목 (약 350개)
  변경: 전산 시스템 기반 차입 확인 의무화
       개인투자자 공매도 참여 확대
       공매도 잔고 일별 공시 강화
```

**금지 기간 시장 영향 비교:**

| 지표 | 1차 (2008-09) | 2차 (2020-21) | 3차 (2023-25) |
|------|-------------|-------------|-------------|
| 금지 직전 KOSPI | ~1,100 | ~1,450 | ~2,400 |
| 금지 기간 중 최고점 | ~1,450 (+32%) | ~3,300 (+128%) | ~2,900 (+21%) |
| 해제 후 1개월 | -5.2% | -3.8% | (데이터 수집 중) |
| 변동성(VKOSPI) 변화 | 60→25 | 50→18 | 22→18 |
| 고평가 지표(PER 중앙값) | 12→15 | 15→28 | 14→16 |

### 3.3 T+2 결제와 Fail-to-Deliver (FTD)

```
공매도의 결제 타임라인:
  T+0: 공매도 체결 (차입 증빙 확인)
  T+1: 결제 준비 (차입 주식 확보)
  T+2: 결제 완료 (주식 인도)

FTD (Fail-to-Deliver):
  결제일까지 주식을 인도하지 못하는 경우
  — 무차입 공매도의 간접 증거
  — KRX FTD 기준: T+2 결제 실패 시 T+3에 강제 매수(buy-in)
  — FTD 비율 = 결제 실패 건수 / 전체 공매도 결제 건수

  FTD 해석:
    FTD < 0.1%: 정상
    0.1-0.5%:   경계 (시스템 오류 or 일시적 품귀)
    > 0.5%:     비정상 (무차입 공매도 의심)
```

### 3.4 서킷브레이커와 사이드카의 공매도 영향

Doc 20 §2에서 다룬 서킷브레이커(CB)와 사이드카는 공매도에 추가 제약을 부과한다:

```
서킷브레이커 발동 시:
  — 전 종목 매매 일시 정지 (20분)
  — 공매도 포지션 청산 불가 (강제 대기)
  — CB 해제 후 가격 갭 위험 → 공매도 숏커버 쇄도 가능

사이드카 발동 시 (KOSPI200 선물 ±5%):
  — 프로그램 매매 5분 중단
  — 차익거래 기반 공매도(index arb short) 불가
  — 순수 정보적 공매도만 잔존

공매도 전략에 대한 영향:
  CB/사이드카 빈도가 높은 시기 = 공매도 위험 프리미엄 상승
  → DTC 동일 수준에서도 공매도자의 요구 수익률 증가
  → 정보적 공매도만 잔존하므로 공매도 신호의 정보 함량 증가
```

참고문헌:
- 금융위원회 (2023). 불법 공매도 근절 방안. 보도자료 2023.11.05.
- 한국거래소 (2025). 공매도 제도 개선 시행 안내. KRX Notice 2025-037.
- Beber, A. & Pagano, M. (2013). Short-Selling Bans Around the World. *JF*, 68(1), 343-381.
- Battalio, R. & Schultz, P. (2011). Regulatory Uncertainty and Market Liquidity: The 2008 Short Sale Ban's Impact. *JF*, 66(6), 2013-2053.

---

## 4. 공매도 비율 (Short Interest Ratio) 분석

### 4.1 이론적 기초

Short Interest Ratio(SIR)와 Days-to-Cover(DTC)는 공매도 분석의 핵심 지표이다.
Desai et al. (2002)는 NASDAQ 종목을 대상으로 SIR이 미래 수익률의 강력한
음(-)의 예측 변수임을 보였다.

**기본 정의:**

```
SIR (Short Interest Ratio):
  SIR_t = shortBalance_t / listedShares_t × 100

  여기서:
    shortBalance_t = 시점 t의 공매도 잔고 (주식 수)
    listedShares_t = 상장주식 총수

  SIR 해석:
    SIR < 1%:   낮음 — 비관적 견해 미미
    1-3%:       보통 — 정상적 헤지/차익거래 수준
    3-5%:       높음 — 정보적 공매도 가능성
    5-10%:      매우 높음 — 강한 하방 신호 or 숏스퀴즈 위험
    > 10%:      극단 — 숏스퀴즈 임박 가능성


DTC (Days-to-Cover):
  DTC_t = shortBalance_t / avgDailyVolume(t-20, t)

  여기서:
    avgDailyVolume(t-20, t) = 최근 20거래일 평균 거래량

  DTC 해석:
    DTC < 1:    쉽게 커버 가능 → 낮은 압력
    1-3:        보통 → 경계 수준
    3-5:        높음 → 상당한 커버 압력
    5-10:       매우 높음 → 숏스퀴즈 위험 증가
    > 10:       극단 → 커버에 2주 이상 소요


Short Momentum (공매도 변화율):
  shortMomentum_t = (SIR_t - SIR_{t-20}) / SIR_{t-20} × 100

  shortMomentum 해석:
    > +30%:     급증 → 새로운 부정적 정보 유입
    +10~+30%:   증가 → 비관적 견해 확대
    -10~+10%:   횡보 → 공매도 상태 안정
    < -10%:     감소 → 숏커버 or 비관론 완화
    < -30%:     급감 → 대규모 숏커버 진행
```

### 4.2 Desai et al. (2002): SIR과 미래 수익률

```
Desai et al. (2002) 실증 결과 (NASDAQ, 1988-1994):

  SIR 분위수별 향후 수익률 (월간, 위험조정):
    Q1 (SIR < 0.5%):    +0.42%
    Q2 (0.5-1.5%):      +0.18%
    Q3 (1.5-3.0%):      -0.15%
    Q4 (3.0-5.0%):      -0.54%
    Q5 (SIR > 5.0%):    -0.76%

  Long-Short (Q1 - Q5):  +1.18%/월 (t-stat = 4.21)
  — Fama-French 3-factor 조정 후에도 유의

  SIR의 수익률 예측 기간:
    — 1개월: 강한 예측력 (가장 유의)
    — 3개월: 여전히 유의하나 감쇠
    — 6개월: 미약
    — 12개월: 소멸 → 정보의 반감기 약 3-6개월
```

### 4.3 수학적 정형화 — 공매도 종합 스코어

```
Short Selling Composite Score (SSCS):

  SSCS_t = w₁ × norm(SIR_t) + w₂ × norm(DTC_t) + w₃ × norm(shortMomentum_t)

  여기서:
    norm(x) = (x - μ_x) / σ_x  (z-score 정규화)
    w₁ = 0.35  (SIR 수준)
    w₂ = 0.40  (DTC — 예측력 최강, Hong et al. 2015)
    w₃ = 0.25  (모멘텀 — 변화 방향)

  SSCS 해석:
    SSCS > +1.5:  매우 비관적 (bearish 패턴 신뢰도 ↑)
    +0.5 ~ +1.5:  비관적 (경계)
    -0.5 ~ +0.5:  중립
    -1.5 ~ -0.5:  낙관적 (숏커버 진행)
    SSCS < -1.5:  매우 낙관적 (bullish 패턴 신뢰도 ↑)

SSCS → 패턴 신뢰도 조정:
  shortSellMult = 1 + β × SSCS × directionSign

  여기서:
    β = 0.05 (기본 감도 계수)
    directionSign = +1 (bearish 패턴), -1 (bullish 패턴)

  예: SSCS = +2.0 (매우 비관적)
    bearish 패턴: shortSellMult = 1 + 0.05 × 2.0 × (+1) = 1.10 (+10%)
    bullish 패턴: shortSellMult = 1 + 0.05 × 2.0 × (-1) = 0.90 (-10%)
```

### 4.4 KRX 공매도 데이터 구조

```
KRX 공매도 통계 제공 항목:

1. 일별 공매도 거래량/거래대금:
   — 종목별 공매도 체결 수량
   — 전체 거래량 대비 공매도 비율
   — 제공 시간: 당일 장 마감 후

2. 공매도 잔고 (biweekly → daily, 2025 이후):
   — shortBalance: 미결제 공매도 수량
   — 잔고 비율 = shortBalance / listedShares
   — 이전: 2주 1회 공시 → 2025년: 일별 공시로 전환

3. 투자자 유형별 공매도:
   — 외국인 / 기관 / 개인 분리
   — 외국인 공매도 비중 = 정보적 거래 프록시

데이터 소스:
  — KRX 정보데이터시스템 (data.krx.co.kr)
  — 한국예탁결제원 (KSD) 대차거래 통계
  — 금융감독원 전자공시시스템 (DART) 대량 공매도 보고
```

참고문헌:
- Desai, H., Ramesh, K., Thiagarajan, S.R. & Balachandran, B. (2002). An Investigation of the Informational Role of Short Interest in the Nasdaq Market. *JF*, 57(5), 2263-2287.
- Asquith, P., Pathak, P.A. & Ritter, J.R. (2005). Short Interest, Institutional Ownership, and Stock Returns. *JFE*, 78(2), 243-276.
- Dechow, P.M., Hutton, A.P., Meulbroek, L. & Sloan, R.G. (2001). Short-Sellers, Fundamental Analysis, and Stock Returns. *JFE*, 61(1), 77-106.

---

## 5. 숏 스퀴즈 탐지 (Short Squeeze Detection)

### 5.1 이론적 기초

숏 스퀴즈(short squeeze)는 공매도 포지션이 과도하게 축적된 상태에서, 가격 상승이
공매도자의 강제 매수(short covering)를 유발하고, 이것이 다시 가격을 상승시키는
양의 피드백 루프(positive feedback loop)이다.

```
숏 스퀴즈 메커니즘 (positive feedback loop):

  1. 높은 공매도 잔고 (SIR↑, DTC↑)
     ↓
  2. 예기치 못한 긍정적 충격 (실적, 뉴스, 수급)
     ↓
  3. 가격 상승 → 공매도자 손실 확대
     ↓
  4. 마진콜 or 손절 → 강제 매수 (short covering)
     ↓
  5. 매수 압력 → 추가 가격 상승
     ↓
  6. 더 많은 공매도자 손절 → 연쇄 매수
     ↓
  → 3-6 반복 (양의 피드백 루프)
     ↓
  7. 공매도 잔고 소진 → 매수 압력 소멸 → 가격 정상화
```

### 5.2 Lamont & Thaler (2003): 차익거래의 한계

Lamont & Thaler (2003)는 공매도 비용이 차익거래(arbitrage)를 제한하여
가격 괴리가 장기간 지속될 수 있음을 보였다. 이는 숏 스퀴즈가 발생하는
근본 원인을 설명한다.

```
차익거래의 한계 (Limits of Arbitrage):

  차익거래자의 의사결정:
    if |mispricing| > c_borrow + c_margin + c_risk:
      → 공매도 실행 (차익거래 수행)
    else:
      → 공매도 포기 (가격 괴리 지속)

  c_borrow:  주식 차입 비용 (lending fee)
  c_margin:  증거금 유지 비용 (margin requirement)
  c_risk:    숏 스퀴즈 위험 프리미엄

  숏 스퀴즈 위험 프리미엄:
    c_risk ∝ SIR × σ_price × (1/float_ratio)
    — 공매도 잔고가 높을수록
    — 가격 변동성이 클수록
    — 유통주식 비율이 낮을수록
    → 숏 스퀴즈 위험 프리미엄 증가
```

### 5.3 숏 스퀴즈 리스크 스코어

공매도 잔고, 가격 변화, 거래량 변화를 결합한 숏 스퀴즈 리스크 지표를 정의한다:

```
Squeeze Risk Score (SRS):

  SRS_t = f(DTC, priceChange, volumeRatio)

  구성요소:
    dtcFactor    = min(DTC_t / DTC_threshold, 3.0)
    priceFactor  = max(priceChange%_t / price_threshold, 0)
    volumeFactor = max(volumeRatio_t / volume_threshold, 0)

  SRS_t = dtcFactor × priceFactor × volumeFactor

  기본 임계값 (KRX 보정):
    DTC_threshold   = 5일     (미국 대비 보수적, KRX 유동성 낮음)
    price_threshold = 3%      (일간 가격 상승률)
    volume_threshold = 2.0    (평균 대비 거래량 비율)

  SRS 해석:
    SRS < 0.5:   LOW    — 스퀴즈 가능성 낮음
    0.5-1.0:     MEDIUM — 스퀴즈 조건 일부 충족
    1.0-2.0:     HIGH   — 스퀴즈 임박 가능
    > 2.0:       EXTREME — 스퀴즈 진행 중일 가능성

  경보 조건:
    if SRS > 1.0 AND priceChange% > 0:
      squeezeAlert = 'HIGH'
      bearish_pattern_confidence *= 0.70  (하방 패턴 할인)
      bullish_pattern_confidence *= 1.15  (상방 패턴 가산)

    if SRS > 2.0 AND volume > 3 × avgVolume:
      squeezeAlert = 'EXTREME'
      bearish_pattern_confidence *= 0.50  (하방 패턴 대폭 할인)
```

### 5.4 KRX 숏 스퀴즈 조건의 특수성

한국 시장의 숏 스퀴즈는 미국과 구조적으로 다른 특성을 보인다:

```
KRX vs 미국 숏 스퀴즈 비교:

| 요소 | 미국 (NYSE/NASDAQ) | 한국 (KRX) |
|------|-------------------|-----------|
| 공매도 참여자 | 다양 (HF, retail 등) | 외국인/기관 중심 |
| 옵션 감마 스퀴즈 | 빈번 (GME 사례) | 제한적 (개별주 옵션 미발달) |
| 소셜미디어 조직화 | Reddit/WSB | 네이버 종토방, 개미 커뮤니티 |
| 가격제한폭 | 없음 | ±30% (Doc 20 §2) |
| 서킷브레이커 | 시장 전체 (7/13/20%) | 종목별 + 시장 전체 |
| 마진콜 기준 | 브로커별 상이 | 보증금률 통일 (30-40%) |

KRX 숏 스퀴즈 특수 조건:
  1. 가격제한폭(±30%): 일간 스퀴즈 폭 제한
     — 하루 최대 +30% → 미국형 ∞ 스퀴즈 불가
     — 대신 다일(multi-day) 스퀴즈 발생 (연속 상한가)

  2. 외국인 공매도 집중:
     — 외국인 공매도 비중 ~65%
     — 외국인 순매도 전환 + 공매도 잔고 감소 = 스퀴즈 신호
     — Doc 29 §3의 외국인 수급 데이터와 결합 분석 필요

  3. 개별주 옵션 부재:
     — 감마 스퀴즈(gamma squeeze) 메커니즘 약함
     — 순수 주식 수급 기반 스퀴즈에 한정
     — KOSPI200 옵션으로 간접적 영향 가능 (Doc 26)
```

### 5.5 역사적 KRX 숏 스퀴즈 사례

```
사례 1: HMM (011200) — 2020-2021
  배경: 해운 업황 회복 + 공매도 금지(2020.03)
  SIR (금지 전): 4.8%
  주가: 4,500원 → 49,000원 (11배)
  특징: 공매도 금지 + 업황 반전 = 극단적 상승
       공매도 재개 후에도 추가 상승 (실적 지지)

사례 2: 에코프로비엠 (247540) — 2023
  배경: 2차전지 테마 + 높은 공매도 잔고
  SIR (피크): ~6.2%
  주가: 120,000원 → 380,000원 (3.2배)
  특징: 개인 투자자 조직적 매수 + 외국인 공매도 숏커버

사례 3: 셀트리온 (068270) — 2018
  배경: 바이오시밀러 성장 기대 vs 회계 의혹 공매도
  SIR (피크): ~5.5%
  주가: 260,000원 → 380,000원 (46%)
  특징: 실적으로 회의론 해소 → 숏커버 주도 상승
```

참고문헌:
- Lamont, O.A. & Thaler, R.H. (2003). Can the Market Add and Subtract? Mispricing in Tech Stock Carve-outs. *JPE*, 111(2), 227-268.
- Engelberg, J.E., Reed, A.V. & Ringgenberg, M.C. (2012). How Are Shorts Informed? Short Sellers, News, and Information Processing. *JFE*, 105(2), 260-278.
- Jones, C.M. & Lamont, O.A. (2002). Short-Sale Constraints and Stock Returns. *JFE*, 66(2-3), 207-239.

---

## 6. 대차거래 (Securities Lending) 분석

### 6.1 이론적 기초

대차거래(securities lending)는 공매도의 선행 조건이다. 주식을 빌리지 않으면
차입 공매도(covered short)가 불가능하므로, 대차시장의 가격(차입 수수료)과
수량(차입 가능 물량)은 공매도 의도의 선행 지표로 기능한다.

**D'Avolio (2002)의 핵심 발견:**

```
D'Avolio (2002) — The Market for Borrowing Stock

  핵심 발견 (미국, 2000-2001):
    1. 대부분 종목(~91%)은 "쉽게 빌릴 수 있음" (general collateral, GC)
       — 차입 수수료 < 1% 연율
    2. 소수 종목(~9%)이 "빌리기 어려움" (special, on special)
       — 차입 수수료 1-50%+ 연율
    3. "Special" 종목의 특성:
       — 소형주, 높은 변동성, 낮은 기관 보유
       — 향후 수익률 유의하게 낮음 (정보적 거래자의 비관적 견해 반영)

  수수료 결정 모형:
    fee = f(demand_borrow, supply_lend)

    demand_borrow ∝ |negative_info| × trader_conviction
    supply_lend ∝ institutional_holding × lending_program_participation

    균형 수수료:
      fee* where demand_borrow(fee*) = supply_lend(fee*)
```

### 6.2 차입 수수료의 정보 함량

```
차입 수수료 (Lending Fee) 해석:

  fee_annualized = (lending_rate) × 365/holding_days

  수수료 수준별 해석:
    fee < 0.5%:     GC (General Collateral) — 정상, 정보 미미
    0.5-2.0%:       Warm — 차입 수요 증가, 경계
    2.0-5.0%:       Special — 높은 차입 수요, 강한 비관적 신호
    5.0-10.0%:      Very Special — 극단적 수요, 스퀴즈 or 강한 하방 압력
    > 10.0%:        Extreme — 사실상 공매도 불가 수준

  수수료 → 미래 수익률 관계:
    E[r_{t+1}] ≈ α - β₁ × fee_t - β₂ × Δfee_t

    fee_t:   수수료 수준 (높을수록 비관적)
    Δfee_t:  수수료 변화율 (급등 = 새로운 부정적 정보)
```

### 6.3 대차 풀 활용률

```
Lending Pool Utilization Rate (LPUR):

  LPUR_t = borrowedShares_t / lendableShares_t × 100

  여기서:
    borrowedShares_t = 대차 잔고 (현재 차입 중인 주식 수)
    lendableShares_t = 대차 가능 물량 (기관이 대여 프로그램에 등록한 주식)

  LPUR 해석:
    LPUR < 20%:   여유 — 추가 공매도 여력 충분
    20-50%:       보통 — 정상적 차입 활동
    50-80%:       높음 — 차입 수요 상당, 수수료 상승 압력
    80-95%:       극히 높음 — 추가 차입 어려움, 스퀴즈 위험
    > 95%:        고갈 — 사실상 차입 불가, 공매도 중단 임박

  LPUR과 SIR의 관계:
    LPUR = SIR × (listedShares / lendableShares)
    — LPUR은 SIR보다 공급 측면을 반영하므로 더 정밀한 지표
    — 동일 SIR이라도 lendableShares가 적으면 LPUR이 높음
      → 스퀴즈 위험 더 큼
```

### 6.4 KRX 대차거래 시스템

```
KRX/KSD 대차거래 제도:

  1. 한국예탁결제원(KSD) 중앙 대차 시스템:
     — 기관 간 대차: KSD 중개
     — 표준 대차 계약: 최소 1개월, 연장 가능
     — 수수료: 연 0.5-3.0% (종목별, 수급별)

  2. 대차거래 참여자:
     — 공급자(Lender): 국민연금, 보험사, ETF 운용사
       → 장기 보유 목적이므로 대차 수수료 = 추가 수익
     — 수요자(Borrower): 외국인 헤지펀드, 증권사 자기매매
       → 공매도 또는 마켓메이킹 목적

  3. KRX 대차거래 공시:
     — 일별 대차거래 체결/상환 수량
     — 대차 잔고 (종목별)
     — 투자자 유형별 대차 내역
     — 출처: KRX 정보데이터시스템, KSD 증권정보포털

  4. 국민연금의 대차 정책:
     — 2020년 공매도 금지 시 대차 제공 중단
     — 2025년 재개 후 대차 가능 종목 선별적 제공
     — 국민연금 대차 제공 종목 = 사실상 "대형 우량주 리스트"
```

### 6.5 대차-공매도 선행 관계

```
시간 순서 (대차 → 공매도 → 가격 반응):

  t-3 ~ t-1:  대차 체결 증가 (차입 수요 확인)
  t:          공매도 체결 (매도 압력)
  t+1 ~ t+5:  가격 하락 (정보 반영)
  t+5 ~ t+20: 추가 하락 or 반전 (정보 해소)

  선행성 측정:
    Granger_causality(lending_flow → short_volume):
      lag 1-3일에서 유의 (p < 0.05)

    Granger_causality(short_volume → returns):
      lag 1-5일에서 유의 (p < 0.01)

  → 대차 체결 증가는 공매도의 선행 지표
  → 공매도 거래량은 수익률의 선행 지표
  → 대차 체결은 가격 하락의 2단계 선행 지표
```

참고문헌:
- D'Avolio, G. (2002). The Market for Borrowing Stock. *JFE*, 66(2-3), 271-306.
- Kolasinski, A.C., Reed, A.V. & Ringgenberg, M.C. (2013). A Multiple Lender Approach to Understanding Supply and Search in the Equity Lending Market. *JF*, 68(2), 559-595.
- Saffi, P.A.C. & Sigurdsson, K. (2011). Price Efficiency and Short Selling. *RFS*, 24(3), 821-852.

---

## 7. 공매도-주가 관계의 비선형성 (Non-linearity in Short Selling-Price Relationship)

### 7.1 이론적 기초: 임계 효과 (Threshold Effects)

공매도 비율과 미래 수익률의 관계는 선형이 아니다. 낮은 수준의 공매도는 정보적
하방 신호이지만, 극단적으로 높은 수준의 공매도는 오히려 숏 스퀴즈 위험으로
전환된다. 이는 Doc 12 (극단값 이론)의 꼬리 위험 분석과 연결된다.

```
공매도-수익률 관계의 비선형성:

  E[r_{t+20}] = f(SIR_t)

  구간별 관계:
    SIR < 1%:   E[r] ≈ 0 (무관)
    1-3%:       E[r] < 0 (약한 음의 관계, 정보적)
    3-5%:       E[r] << 0 (강한 음의 관계, 강한 정보)
    5-8%:       E[r] ≈ 0 (음→양 전환점, 숏 스퀴즈 위험 상쇄)
    > 8%:       E[r] > 0 (양의 관계, 숏 스퀴즈 지배)

  수학적 모형 (2차 다항식 근사):
    E[r_{t+20}] = α + β₁ × SIR_t + β₂ × SIR_t² + ε

    β₁ < 0: 정보 효과 (SIR 증가 → 수익률 하락)
    β₂ > 0: 스퀴즈 효과 (SIR² 증가 → 수익률 반등)

    전환점 (inflection point):
      SIR* = -β₁ / (2 × β₂)
      — SIR < SIR*: 정보 효과 지배
      — SIR > SIR*: 스퀴즈 효과 지배
```

### 7.2 레짐 의존적 해석 (Regime-Dependent Interpretation)

공매도 신호의 해석은 시장 레짐(Doc 26 §2.3의 VKOSPI 기반)에 따라 달라진다:

```
레짐별 공매도 해석 매트릭스:

┌──────────────────┬────────────────────┬────────────────────┐
│                  │  VKOSPI < 18       │  VKOSPI > 25       │
│                  │  (Low Vol Regime)  │  (High Vol Regime) │
├──────────────────┼────────────────────┼────────────────────┤
│ SIR < 3%         │  중립: 정상 수준    │  중립: 위기 시      │
│ (Low Short)      │  → 신호 없음        │  공매도 불가 반영   │
│                  │  shortMult = 1.00  │  shortMult = 1.00  │
├──────────────────┼────────────────────┼────────────────────┤
│ SIR 3-5%         │  Bearish: 정보적    │  Contrarian Bull:  │
│ (Moderate Short) │  공매도 활발         │  공포 극대 + 공매도 │
│                  │  shortMult = 0.90  │  = 반등 가능성      │
│                  │  (bearish 가산)    │  shortMult = 1.05  │
│                  │                    │  (bullish 가산)     │
├──────────────────┼────────────────────┼────────────────────┤
│ SIR > 5%         │  Squeeze Risk:     │  Capitulation:     │
│ (High Short)     │  스퀴즈 위험 증가   │  극단적 비관론      │
│                  │  shortMult = 1.10  │  = 바닥 신호 가능   │
│                  │  (bullish squeeze) │  shortMult = 1.15  │
│                  │                    │  (contrarian bull)  │
└──────────────────┴────────────────────┴────────────────────┘

VKOSPI 레짐 분류 (Doc 26 §2.3 참조):
  Low Vol:   VKOSPI < 18  — 안정기, 정보적 거래 지배
  Normal:    18-25        — 혼합 (위 매트릭스의 중간 적용)
  High Vol:  VKOSPI > 25  — 위기/공포, 역발상 가능성

레짐 조건부 shortMult 공식:
  if vkospi < 18:
    shortMult = 1 - 0.05 × max(0, (SIR - 3) / 2)  (bearish tilt)
  elif vkospi > 25:
    shortMult = 1 + 0.05 × max(0, (SIR - 3) / 2)  (contrarian tilt)
  else:
    shortMult = 1.00 (neutral)
```

### 7.3 투자자 유형 교호작용

KRX의 3자 투자자 구조(외국인/기관/개인)는 공매도 해석에 추가 차원을 부여한다:

```
투자자 유형별 공매도 정보 함량:

  외국인 공매도:
    — 정보적 거래 비중 높음 (Boehmer et al. 2008의 기관 공매도에 해당)
    — 향후 수익률 예측력: 강함
    — weight_foreign = 1.5 (정보 가중치)

  기관 공매도:
    — 헤지 + 정보적 혼합
    — 프로그램 매매(차익거래) 공매도 분리 필요
    — weight_institutional = 1.0

  개인 공매도:
    — 2025년 재개 후 초기 단계
    — 정보 함량 불확실 (잡음 거래 가능성)
    — weight_individual = 0.5

  투자자 가중 SIR:
    SIR_weighted = (w_f × SIR_foreign + w_i × SIR_inst + w_p × SIR_ind)
                   / (w_f + w_i + w_p)

    여기서 w_f = 1.5, w_i = 1.0, w_p = 0.5
```

### 7.4 공매도-유동성 교호작용

Doc 18 §3의 Amihud ILLIQ 지표와 공매도의 교호작용:

```
유동성과 공매도의 교호 효과:

  유동성 높은 종목 (ILLIQ 낮음):
    — 공매도 비용 낮음 → 정보적 + 비정보적 공매도 혼재
    — SIR의 정보 함량 희석
    — 숏 스퀴즈 위험 낮음 (커버 용이)

  유동성 낮은 종목 (ILLIQ 높음):
    — 공매도 비용 높음 → 정보적 공매도만 진입
    — SIR의 정보 함량 증가 (비용 필터링 효과)
    — 숏 스퀴즈 위험 높음 (커버 어려움)
    — 가격 영향(price impact) 극대

  교호작용 보정:
    infoContent = SIR × (1 + γ × log(ILLIQ / ILLIQ_median))
    squeezeRisk = SRS × (1 + δ × log(ILLIQ / ILLIQ_median))

    γ = 0.3  (정보 함량 유동성 보정 계수)
    δ = 0.5  (스퀴즈 위험 유동성 보정 계수)
```

참고문헌:
- Diether, K.B., Lee, K.-H. & Werner, I.M. (2009). It's SHO Time! Short-Sale Price Tests and Market Quality. *JF*, 64(1), 37-73.
- Boehmer, E. & Wu, J.J. (2013). Short Selling and the Price Discovery Process. *RFS*, 26(2), 287-322.
- Chang, E.C., Cheng, J.W. & Yu, Y. (2007). Short-Sales Constraints and Price Discovery: Evidence from the Hong Kong Market. *JF*, 62(5), 2097-2121.

---

## 8. 제도적 이벤트 효과: 공매도 금지/해제 전후 분석

### 8.1 금지 효과의 이론적 예측

Miller (1977)과 Diamond & Verrecchia (1987)를 결합하면, 공매도 금지의
예측 가능한 효과는 다음과 같다:

```
공매도 금지 효과 예측:

  단기 (금지 직후, 1-5일):
    1. 가격 상승 (비관적 매도 차단)
    2. 스프레드 확대 (유동성 공급 감소)
    3. 변동성 일시 하락 (하방 거래 차단)
    4. 거래량 감소 (차익거래 참여자 이탈)

  중기 (금지 중, 1-12개월):
    1. 고평가 축적 (Miller 1977)
    2. 변동성 불규칙 — 단방향(상방) 거래로 왜곡
    3. 꼬리 위험 축적 (음의 왜도 증가, Bris et al. 2007)
    4. 기술적 패턴의 비대칭 왜곡 (§2.2 참조)

  해제 시 (금지 해제, 1-20일):
    1. 가격 하락 (억제된 부정적 정보 반영)
    2. 거래량 급증 (공매도 재진입)
    3. 변동성 상승 (양방향 거래 복원)
    4. 기술적 패턴 정상화 (5-20일 소요)
```

### 8.2 실증적 검증 — Beber & Pagano (2013)

```
Beber & Pagano (2013) — 30개국 공매도 금지 분석:

  핵심 결과:
    1. 공매도 금지는 가격 발견을 악화시킴
       — 가격 효율성 지표 delay 증가 (11개국 평균 +28%)
    2. 공매도 금지는 유동성을 악화시킴
       — 스프레드 확대: 평균 +36 bps (대형주), +89 bps (소형주)
    3. 공매도 금지는 가격 하락을 막지 못함
       — 금지 기간 중 시장 하락 지속 (8개국/10개국)
    4. 금지 해제 후 일시적 추가 하락
       — 평균 -2.3% (해제 후 5일)

  한국 데이터 (2008-09 금지):
    — 스프레드 확대: +45 bps (KOSPI), +120 bps (KOSDAQ)
    — KOSPI는 금지 기간 중에도 18% 추가 하락
    — 해제 후 5일: -3.8%
    — 해제 후 20일: +2.1% (정상화)
```

### 8.3 패턴 분석 보정 — 금지 기간 vs 정상 기간

Doc 33 §8.3에서 개념적 보정 공식을 제시하였으나, 본 문서에서 이를 정량화한다:

```
공매도 레짐 판별:
  shortRegime = 'BAN'     if 공매도 전면 금지 기간
              = 'PARTIAL' if 적격종목 제한적 공매도 허용
              = 'NORMAL'  if 정상 운영

패턴 유형별 보정 승수 (shortBanMult):

  shortRegime = 'BAN':
    bearish 패턴: shortBanMult = 0.65  (35% 할인 — 하방 메커니즘 부재)
    bullish 패턴: shortBanMult = 0.85  (15% 할인 — 고평가 가능성)
    neutral 패턴: shortBanMult = 0.92  (8% 할인 — 유동성 비용)

  shortRegime = 'PARTIAL':
    bearish 패턴: shortBanMult = 0.85
    bullish 패턴: shortBanMult = 0.95
    neutral 패턴: shortBanMult = 0.98

  shortRegime = 'NORMAL':
    모든 패턴: shortBanMult = 1.00 (보정 없음)

최종 패턴 신뢰도:
  conf_adjusted = conf_base × shortBanMult × shortSellMult × shortMult(regime)

  여기서:
    shortBanMult:  금지 여부 보정 (본 절)
    shortSellMult: SIR/DTC 기반 정보적 보정 (§4.3)
    shortMult:     VKOSPI 레짐 조건부 보정 (§7.2)
```

### 8.4 금지/해제 이벤트 캘린더 — 하드코딩 레퍼런스

```
SHORT_BAN_PERIODS = [
  { start: '2008-10-01', end: '2009-05-31', type: 'FULL_BAN' },
  { start: '2020-03-16', end: '2021-05-02', type: 'FULL_BAN' },
  { start: '2023-11-06', end: '2025-03-30', type: 'FULL_BAN' },
]

SHORT_PARTIAL_PERIODS = [
  { start: '2025-03-31', end: null, type: 'PARTIAL',
    eligibleList: 'KOSPI200 + KOSDAQ150' },
]

함수: isShortBan(dateStr)
  for each period in SHORT_BAN_PERIODS:
    if dateStr >= period.start AND dateStr <= period.end:
      return 'BAN'
  for each period in SHORT_PARTIAL_PERIODS:
    if dateStr >= period.start AND (period.end === null OR dateStr <= period.end):
      return 'PARTIAL'
  return 'NORMAL'
```

참고문헌:
- Beber, A. & Pagano, M. (2013). Short-Selling Bans Around the World: Evidence from the 2007-09 Crisis. *JF*, 68(1), 343-381.
- Battalio, R. & Schultz, P. (2011). Regulatory Uncertainty and Market Liquidity. *JF*, 66(6), 2013-2053.
- Marsh, I.W. & Payne, R. (2012). Banning Short Sales and Market Quality: The UK's Experience. *JBF*, 36(7), 1975-1986.
- Helmes, U., Henker, J. & Henker, T. (2017). Effect of the Ban on Short Selling on Market Prices and Volatility. *ABR*, 47(2), 145-184.

---

## 9. CheeseStock 구현 경로

### 9.1 데이터 파이프라인

```
신규 스크립트: scripts/download_shortselling.py

  데이터 소스:
    — KRX 정보데이터시스템 API (data.krx.co.kr)
    — 또는 pykrx 라이브러리 (stock.get_shorting_* 계열)

  수집 항목:
    1. 일별 공매도 거래량: stock.get_shorting_volume_by_date(ticker, start, end)
    2. 공매도 잔고: stock.get_shorting_balance_by_date(ticker, start, end)
    3. 대차거래 체결/상환: KSD 데이터 (API 또는 크롤링)

  출력 파일:
    data/shortselling/{code}.json
    형식:
    {
      "code": "005930",
      "name": "삼성전자",
      "data": [
        {
          "date": "2025-04-01",
          "shortVolume": 1234567,
          "totalVolume": 45678900,
          "shortBalance": 9876543,
          "listedShares": 5969782550,
          "lendingBalance": 8765432,
          "lendingNew": 234567,
          "lendingReturn": 198765
        }
      ]
    }

  실행:
    python scripts/download_shortselling.py              # 전 종목
    python scripts/download_shortselling.py --code 005930 # 특정 종목
    python scripts/download_shortselling.py --days 60     # 최근 60일
```

### 9.2 지표 계산 — indicators.js 확장

```
신규 함수 (indicators.js):

/**
 * calcShortMetrics(shortData, priceData)
 *
 * @param shortData  공매도 데이터 배열 [{date, shortVolume, shortBalance, ...}]
 * @param priceData  가격 데이터 배열 [{date, close, volume}]
 * @returns {
 *   sir:     number[],  // Short Interest Ratio (%)
 *   dtc:     number[],  // Days to Cover
 *   sMom:    number[],  // Short Momentum (20일 변화율)
 *   sscs:    number[],  // Short Selling Composite Score
 *   srs:     number[],  // Squeeze Risk Score
 *   lpur:    number[],  // Lending Pool Utilization Rate (%)
 * }
 */

알고리즘:
  for each bar t:
    sir[t] = shortBalance[t] / listedShares[t] × 100
    dtc[t] = shortBalance[t] / avgVolume(t-20, t)
    sMom[t] = (sir[t] - sir[t-20]) / sir[t-20] × 100
    sscs[t] = 0.35 × zscore(sir[t]) + 0.40 × zscore(dtc[t]) + 0.25 × zscore(sMom[t])
    srs[t] = (dtc[t]/5) × max(priceChange%/3, 0) × max(volRatio/2, 0)
    lpur[t] = lendingBalance[t] / lendableShares[t] × 100

캐싱:
  IndicatorCache에 'short' 키로 등록
  cache key = `short_${length}_${lastTime}_${lastClose}`
  Worker에서 사용 시 결과만 전송 (함수 불가, Doc patterns.md §Worker Protocol)
```

### 9.3 신호 매핑 — signalEngine.js 확장

```
신규 신호 정의 (COMPOSITE_SIGNAL_DEFS 확장):

{
  name: 'shortInterestBearish',
  type: 'short_selling',
  tier: 2,
  condition: (cache) => cache.short && cache.short.sscs[last] > 1.5,
  direction: 'bearish',
  strength: (cache) => Math.min(cache.short.sscs[last] / 3.0, 1.0),
  description: '공매도 종합 스코어 높음 → 하방 압력'
},
{
  name: 'squeezeAlert',
  type: 'short_selling',
  tier: 1,
  condition: (cache) => cache.short && cache.short.srs[last] > 1.0,
  direction: 'bullish',
  strength: (cache) => Math.min(cache.short.srs[last] / 3.0, 1.0),
  description: '숏 스퀴즈 위험 → 상방 압력 가능'
},
{
  name: 'shortCovering',
  type: 'short_selling',
  tier: 2,
  condition: (cache) => cache.short && cache.short.sMom[last] < -30,
  direction: 'bullish',
  strength: (cache) => Math.min(Math.abs(cache.short.sMom[last]) / 60, 1.0),
  description: '공매도 잔고 급감 → 숏커버 진행'
},
{
  name: 'lendingFeeSpike',
  type: 'short_selling',
  tier: 3,
  condition: (cache) => cache.short && cache.short.lpur[last] > 80,
  direction: 'bearish',
  strength: (cache) => Math.min((cache.short.lpur[last] - 80) / 20, 1.0),
  description: '대차 풀 활용률 극히 높음 → 비관적 수요 극대'
}
```

### 9.4 backtester.js 통합

```
신규 _META 항목:

shortInterestBearish: {
  name: '공매도 비관 신호',
  category: 'short_selling',
  academic: 'Desai et al. (2002), Hong et al. (2015)',
  expectedReturn: { 5: -0.8, 10: -1.2, 20: -1.8 },
  hitRate: { 5: 0.55, 10: 0.58, 20: 0.60 },
  sampleReq: 30
},
squeezeAlert: {
  name: '숏 스퀴즈 경보',
  category: 'short_selling',
  academic: 'Lamont & Thaler (2003)',
  expectedReturn: { 5: 2.5, 10: 4.0, 20: 3.5 },
  hitRate: { 5: 0.52, 10: 0.55, 20: 0.53 },
  sampleReq: 15
}
```

### 9.5 레짐 조건부 해석 통합

```
signalEngine.js에서의 레짐 조건부 공매도 신호 해석:

analyzeShortSignals(candles, shortData, vkospi, regime) {
  const metrics = calcShortMetrics(shortData, candles);
  const shortRegime = isShortBan(candles[last].date);

  // 1. 금지 기간 보정 (§8.3)
  if (shortRegime === 'BAN') {
    return {
      signals: [],  // 공매도 데이터 자체가 없으므로 신호 없음
      shortBanMult: { bearish: 0.65, bullish: 0.85, neutral: 0.92 }
    };
  }

  // 2. VKOSPI 레짐 조건부 해석 (§7.2)
  let shortMult = 1.0;
  if (vkospi < 18) {
    shortMult = 1 - 0.05 * Math.max(0, (metrics.sir[last] - 3) / 2);
  } else if (vkospi > 25) {
    shortMult = 1 + 0.05 * Math.max(0, (metrics.sir[last] - 3) / 2);
  }

  // 3. SSCS 기반 방향성 보정 (§4.3)
  const beta = 0.05;
  const sscs = metrics.sscs[last];
  const shortSellMult_bearish = 1 + beta * sscs;
  const shortSellMult_bullish = 1 - beta * sscs;

  // 4. 스퀴즈 경보 (§5.3)
  const squeezeAlert = metrics.srs[last] > 1.0 ? 'HIGH' :
                       metrics.srs[last] > 2.0 ? 'EXTREME' : 'LOW';

  return {
    metrics,
    shortMult,
    shortSellMult: { bearish: shortSellMult_bearish, bullish: shortSellMult_bullish },
    squeezeAlert,
    shortBanMult: { bearish: 1.0, bullish: 1.0, neutral: 1.0 }
  };
}
```

### 9.6 상수 매핑 — 22_learnable_constants_guide.md 등록

```
신규 상수 등록 (#140~#149):

| # | Constant | Value | Tier | Learn | Range | Source |
|---|----------|-------|------|-------|-------|--------|
| 140 | SHORT_SIR_LOW | 1.0 | C | GCV | [0.5, 2.0] | §4.1 SIR 하한 |
| 141 | SHORT_SIR_HIGH | 5.0 | C | GCV | [3.0, 8.0] | §4.1 SIR 상한 |
| 142 | SHORT_DTC_THRESHOLD | 5.0 | C | GCV | [3.0, 8.0] | §5.3 DTC 기준 |
| 143 | SHORT_SQUEEZE_THRESHOLD | 1.0 | B | FIX | [0.5, 2.0] | §5.3 SRS 경보 |
| 144 | SHORT_SSCS_W_SIR | 0.35 | C | GCV | [0.2, 0.5] | §4.3 SIR 가중치 |
| 145 | SHORT_SSCS_W_DTC | 0.40 | C | GCV | [0.25, 0.55] | §4.3 DTC 가중치 |
| 146 | SHORT_SSCS_W_MOM | 0.25 | C | GCV | [0.1, 0.4] | §4.3 모멘텀 가중치 |
| 147 | SHORT_BAN_MULT_BEAR | 0.65 | B | FIX | [0.50, 0.80] | §8.3 금지 시 bearish |
| 148 | SHORT_BAN_MULT_BULL | 0.85 | B | FIX | [0.75, 0.95] | §8.3 금지 시 bullish |
| 149 | SHORT_REGIME_BETA | 0.05 | C | GCV | [0.02, 0.10] | §7.2 레짐 감도 |

Tier 분류 근거:
  Tier B (FIX): SHORT_SQUEEZE_THRESHOLD, SHORT_BAN_MULT_*
    → 제도적/구조적 상수로 학습보다 이론적 근거에 의한 설정이 적절
    → 공매도 금지 보정은 이벤트 기반이므로 데이터 기반 학습 부적합

  Tier C (GCV): 나머지
    → KRX 시장 데이터에 의한 교차검증(GCV) 가능
    → 시장 레짐, 유동성 환경에 따라 최적값 변동
```

### 9.7 UI 표시 — patternPanel.js 확장

```
공매도 지표 UI 표시 (D열 하단 또는 C열 통합):

1. SIR 게이지:
   — 색상: SIR < 1% → KRX_COLORS.NEUTRAL
           1-3% → 회색
           3-5% → KRX_COLORS.DOWN (파랑, 하방 신호)
           > 5% → KRX_COLORS.UP (빨강, 스퀴즈 위험)
   — 표시: "SIR 3.2% (DTC 4.1일)"

2. 숏 스퀴즈 경보:
   — squeezeAlert = 'HIGH': 노란 배경 + "숏 스퀴즈 경계"
   — squeezeAlert = 'EXTREME': 빨간 배경 + "숏 스퀴즈 경보"

3. 공매도 금지 표시:
   — shortRegime = 'BAN': 회색 음영 + "공매도 금지 기간"
   — shortRegime = 'PARTIAL': 연한 회색 + "부분 공매도 허용"

4. 대차잔고 표시:
   — LPUR 바차트: 0-100% 범위
   — > 80% 시 경고색
```

---

## 10. 통합 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│  공매도 분석 파이프라인 (Short Selling Analytics Pipeline)           │
│                                                                     │
│  [데이터 수집]              [지표 계산]            [신호 생성]       │
│  download_shortselling.py   indicators.js          signalEngine.js  │
│  → shortselling/{code}.json → calcShortMetrics()   → analyzeShort() │
│                                                                     │
│  ┌──────────────────────┐  ┌────────────────────┐  ┌──────────────┐│
│  │ KRX 공매도 거래량     │→│ SIR (%)            │→│ shortInterest ││
│  │ KRX 공매도 잔고       │→│ DTC (일)           │→│  Bearish      ││
│  │ KSD 대차 체결/상환    │→│ Short Momentum (%) │→│ squeezeAlert  ││
│  │ KSD 대차 잔고/수수료  │→│ SSCS (composite)   │→│ shortCovering ││
│  │                      │→│ SRS (squeeze risk)  │→│ lendingFee    ││
│  │                      │→│ LPUR (%)           │→│  Spike        ││
│  └──────────────────────┘  └────────────────────┘  └──────────────┘│
│                                                         ↓          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  레짐 조건부 보정 (Regime-Conditional Adjustment)             │  │
│  │                                                              │  │
│  │  Input:                                                      │  │
│  │  — VKOSPI regime (Doc 26 §2.3): Low/Normal/High Vol         │  │
│  │  — Short regime: BAN/PARTIAL/NORMAL (§8.4)                  │  │
│  │  — Investor type: foreign/inst/individual (§7.3)            │  │
│  │  — Liquidity: ILLIQ (Doc 18 §3.1) (§7.4)                   │  │
│  │                                                              │  │
│  │  Output:                                                     │  │
│  │  — shortBanMult    (금지 보정: 0.65~1.00)                    │  │
│  │  — shortSellMult   (SIR 정보적 보정: 0.85~1.15)             │  │
│  │  — shortMult       (VKOSPI 레짐 보정: 0.90~1.15)            │  │
│  │  — squeezeAlert    (스퀴즈 경보: LOW/HIGH/EXTREME)           │  │
│  │                                                              │  │
│  │  합산:                                                       │  │
│  │  conf_final = conf_base × shortBanMult × shortSellMult      │  │
│  │              × shortMult(regime) × liquidityAdj              │  │
│  │  합산 범위 (극단): 0.50 ~ 1.32                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  연관 이론:                                                          │
│  — Miller (1977): 공매도 제약 → 고평가 (§2.1)                       │
│  — Diamond-Verrecchia (1987): 가격 조정 비대칭 (§2.2)               │
│  — Boehmer et al. (2008): 정보적 공매도 (§2.3)                      │
│  — Lamont-Thaler (2003): 차익거래 한계 → 스퀴즈 (§5.2)              │
│  — D'Avolio (2002): 대차시장 구조 (§6.1)                            │
│  — Beber-Pagano (2013): 금지 효과 실증 (§8.2)                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 11. 한계와 유의사항

### 11.1 데이터 한계

```
현재 CheeseStock 데이터 환경의 제약:

1. 공매도 잔고 데이터 주기:
   — 2025년 이전: 2주 1회 공시 → DTC 계산의 시간 해상도 부족
   — 2025년 이후: 일별 공시로 개선되었으나, 역사적 데이터 희소

2. 대차 수수료 비공개:
   — KSD 대차 수수료는 기관 간 개별 협상 → 공개 데이터 미존재
   — lending fee 기반 분석은 이론적 프레임워크만 제공, 실측 불가
   — 대안: LPUR(풀 활용률)로 간접 추정

3. 투자자 유형별 공매도:
   — KRX에서 외국인/기관/개인 분리 제공
   — 그러나 "외국인" 내부의 이질성(헤지펀드 vs 패시브 펀드) 미구분
   — 정보적 거래자 식별의 한계

4. 공매도 금지 기간 (2008-09, 2020-21, 2023-25):
   — 해당 기간 공매도 데이터 자체가 존재하지 않음
   — 백테스트 시 해당 구간은 신호 비활성화 필요
```

### 11.2 이론적 한계

```
1. Miller (1977)의 가정:
   — 동질적 정보 환경에서의 의견 분산 → 현실은 이질적 정보
   — 무한 기간 모형 → 실제로는 공매도 비용이 시간에 따라 변동

2. 비선형성의 불안정성:
   — §7.1의 전환점 SIR*는 시장 환경에 따라 이동
   — 2차 다항식은 근사이며, 실제 관계는 더 복잡할 수 있음

3. 역인과 문제:
   — 높은 SIR → 가격 하락 (정보적) vs 가격 하락 → 높은 SIR (기계적)
   — 인과 방향 구분을 위해 도구변수(IV) 접근 필요
   — KRX에서의 IV 후보: 공매도 규제 변경 (외생적 충격)

4. 숏 스퀴즈 예측의 근본적 한계:
   — 스퀴즈는 자기충족적(self-fulfilling) 현상
   — "스퀴즈가 올 것"이라는 예측 자체가 스퀴즈를 촉발
   — 정확한 타이밍 예측은 원리적으로 불가능
```

### 11.3 KRX 특수 유의사항

```
1. 개인투자자 공매도 (2025~):
   — 2025년 3월 재개 후 초기 데이터
   — 개인 공매도의 정보 함량은 미확인 (기존 학술 연구 부재)
   — 초기에는 잡음(noise) 가능성 높음 → weight_individual = 0.5 보수적 설정

2. 무차입 공매도 위험:
   — 2023년 대규모 적발 사건이 제도적 공매도 금지를 유발
   — FTD 데이터로 간접 모니터링 가능하나, 공개 데이터 제한적

3. 프로그램 매매와의 구분:
   — 차익거래 기반 공매도(index arb)는 정보적 신호가 아님
   — KOSPI200 선물-현물 괴리에 의한 기계적 공매도
   — 프로그램 매매 공매도 분리가 정확한 분석의 전제 조건

4. 재벌 구조의 영향:
   — 재벌 그룹 지배주주의 보유 지분은 대차시장에 공급되지 않음
   — 유통주식(free float) 기준 SIR이 상장주식 기준보다 정확
   — float-adjusted SIR = shortBalance / freeFloatShares
```

---

## 12. 종합 참고문헌

### 12.1 핵심 논문 (Core References)

1. Miller, E. (1977). Risk, Uncertainty, and Divergence of Opinion. *Journal of Finance*, 32(4), 1151-1168.
2. Diamond, D.W. & Verrecchia, R.E. (1987). Constraints on Short-Selling and Asset Price Adjustment to Private Information. *JFE*, 18(2), 277-311.
3. D'Avolio, G. (2002). The Market for Borrowing Stock. *JFE*, 66(2-3), 271-306.
4. Desai, H., Ramesh, K., Thiagarajan, S.R. & Balachandran, B. (2002). An Investigation of the Informational Role of Short Interest in the Nasdaq Market. *JF*, 57(5), 2263-2287.
5. Lamont, O.A. & Thaler, R.H. (2003). Can the Market Add and Subtract? *JPE*, 111(2), 227-268.
6. Bris, A., Goetzmann, W.N. & Zhu, N. (2007). Efficiency and the Bear: Short Sales and Markets Around the World. *JF*, 62(3), 1029-1079.
7. Boehmer, E., Jones, C.M. & Zhang, X. (2008). Which Shorts Are Informed? *JF*, 63(2), 491-527.
8. Beber, A. & Pagano, M. (2013). Short-Selling Bans Around the World: Evidence from the 2007-09 Crisis. *JF*, 68(1), 343-381.
9. Hong, H., Li, W., Ni, S.X. & Scheinkman, J.A. (2015). Days to Cover and Stock Returns. *NBER WP* No. 21166.

### 12.2 보조 논문 (Supporting References)

10. Chen, J., Hong, H. & Stein, J.C. (2002). Breadth of Ownership and Stock Returns. *JFE*, 66(2-3), 171-205.
11. Asquith, P., Pathak, P.A. & Ritter, J.R. (2005). Short Interest, Institutional Ownership, and Stock Returns. *JFE*, 78(2), 243-276.
12. Dechow, P.M., Hutton, A.P., Meulbroek, L. & Sloan, R.G. (2001). Short-Sellers, Fundamental Analysis, and Stock Returns. *JFE*, 61(1), 77-106.
13. Diether, K.B., Lee, K.-H. & Werner, I.M. (2009). Short-Sale Strategies and Return Predictability. *RFS*, 22(2), 575-607.
14. Rapach, D.E., Ringgenberg, M.C. & Zhou, G. (2016). Short Interest and Aggregate Stock Returns. *JFE*, 121(1), 46-65.
15. Engelberg, J.E., Reed, A.V. & Ringgenberg, M.C. (2012). How Are Shorts Informed? *JFE*, 105(2), 260-278.
16. Jones, C.M. & Lamont, O.A. (2002). Short-Sale Constraints and Stock Returns. *JFE*, 66(2-3), 207-239.
17. Kolasinski, A.C., Reed, A.V. & Ringgenberg, M.C. (2013). A Multiple Lender Approach. *JF*, 68(2), 559-595.
18. Saffi, P.A.C. & Sigurdsson, K. (2011). Price Efficiency and Short Selling. *RFS*, 24(3), 821-852.
19. Battalio, R. & Schultz, P. (2011). Regulatory Uncertainty and Market Liquidity. *JF*, 66(6), 2013-2053.
20. Chang, E.C., Cheng, J.W. & Yu, Y. (2007). Short-Sales Constraints and Price Discovery. *JF*, 62(5), 2097-2121.
21. Boehmer, E. & Wu, J.J. (2013). Short Selling and the Price Discovery Process. *RFS*, 26(2), 287-322.
22. Marsh, I.W. & Payne, R. (2012). Banning Short Sales and Market Quality. *JBF*, 36(7), 1975-1986.
23. Helmes, U., Henker, J. & Henker, T. (2017). Effect of the Ban on Short Selling. *ABR*, 47(2), 145-184.

### 12.3 한국 시장 참고자료

24. 금융위원회 (2023). 불법 공매도 근절 방안. 보도자료 2023.11.05.
25. 한국거래소 (2025). 공매도 제도 개선 시행 안내. KRX Notice 2025-037.
26. 자본시장연구원 (KCMI) (2024). 공매도 제도 개선 방안 연구.
27. 한국예탁결제원 (KSD) (2025). 증권 대차거래 통계.

---

*본 문서는 CheeseStock 프로젝트의 공매도 및 대차거래 분석 이론적 기반을 제공한다.*
*Doc 31(미시경제학), Doc 20(KRX 구조), Doc 33(공매도 금지 패턴 왜곡)의 관련 내용을*
*심화하며, SIR/DTC/SSCS 기반 정량적 신호 체계와 레짐 조건부 해석 프레임워크를 통해*
*개별 종목 패턴 분석의 정밀도를 향상시키는 것을 목표로 한다.*
