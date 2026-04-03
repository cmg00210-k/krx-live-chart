# 38. ETF 생태계와 자금흐름 분석 — ETF Ecosystem & Fund Flow Analytics

> "ETF는 가격 발견의 민주화이자, 동시에 상관관계의 전염체이다.
> 개별 종목의 기술적 패턴을 읽으려면, 먼저 그 종목을 담고 있는
> ETF의 자금흐름이 만들어내는 구조적 수급을 이해해야 한다."

---

## 1. 개요 (Overview)

### 1.1 ETF의 시장 미시구조적 의의

ETF(Exchange-Traded Fund)는 1993년 SPDR S&P 500(SPY) 출시 이후
글로벌 금융 시장의 미시구조를 근본적으로 재편한 금융 혁신이다.
전통적 뮤추얼 펀드와 달리 장중 연속 거래, 실시간 가격 발견,
설정/환매(creation/redemption) 차익 거래 메커니즘을 통해
기초자산과의 가격 괴리를 최소화한다.

ETF가 기술적 분석에 미치는 영향은 3가지 경로로 작용한다:

```
경로 1: 수급 전달 (Demand Transmission)
  ETF 매수 → AP 설정 → 기초자산 바스켓 매수 → 개별 종목 수급 영향
  → 기술적 패턴의 외생적 수급 교란

경로 2: 상관관계 증폭 (Correlation Amplification)
  ETF 보유 비중 증가 → 바스켓 거래 비중 증가 → 종목 간 상관 상승
  → 개별 종목 고유 패턴 약화, 지수 추종 패턴 강화

경로 3: 센티먼트 지표 (Sentiment Proxy)
  레버리지/인버스 ETF 거래량 비율 → 시장 심리 극단 탐지
  섹터 ETF 자금흐름 → 섹터 회전 선행 지표
```

### 1.2 기존 문서와의 관계

| 내용 | 기존 문서 | 본 문서 추가분 |
|------|----------|--------------|
| 교차시장 상관 | Doc 28 §1-2 | ETF-driven correlation amplification |
| 섹터 회전 | Doc 29 §1-2 | 섹터 ETF 자금흐름 기반 회전 신호 |
| KRX 구조 | Doc 20 §1-5 | ETF 시장 특수 구조 (LP, AP, 괴리율) |
| EMH/AMH | Doc 05 §1 | ETF 가격 발견 효율성과 비효율성 |
| 프로그램 매매 | Doc 27 §2-3 | ETF 리밸런싱과 프로그램 매매 교차 효과 |
| 변동성 | Doc 34 §2-3 | ETF 보유 비중과 변동성 증폭 |
| 미시경제학 | Doc 31 §2 | ETF 수요-공급 탄력성, 유동성 외부성 |

### 1.3 KRX ETF 시장 성장

한국 ETF 시장은 2002년 KODEX 200(삼성자산운용) 출시 이후
급속한 성장을 경험했다.

| 연도 | 상장 ETF 수 | 순자산총액(AUM) | 일평균 거래대금 |
|------|-----------|---------------|---------------|
| 2005 | 12 | ~2조 원 | ~0.1조 원 |
| 2010 | 79 | ~7조 원 | ~0.8조 원 |
| 2015 | 208 | ~24조 원 | ~2.5조 원 |
| 2020 | 450 | ~52조 원 | ~5.0조 원 |
| 2025 | 750+ | ~120조 원+ | ~8.0조 원+ |

출처: KRX ETF 시장 통계, 한국거래소 (2025).
삼성자산운용(KODEX), 미래에셋자산운용(TIGER)이 양대 브랜드이며
합산 시장점유율 ~70%.

---

## 2. ETF 가격결정 메커니즘 (ETF Pricing Mechanism)

### 2.1 이론적 기초: 설정/환매 차익 거래

ETF의 핵심 혁신은 **설정(creation)/환매(redemption) 메커니즘**에 있다.
지정참가회사(AP, Authorized Participant)만이 ETF 지분을
설정단위(Creation Unit, 통상 50,000구)로 설정·환매할 수 있으며,
이 과정에서 현물 바스켓(in-kind basket)과 ETF 지분이 교환된다.

```
설정(Creation):
  AP가 기초자산 바스켓 + 현금 → ETF 운용사에 납입
  → 운용사가 ETF 지분(CU 단위) 발행 → AP가 유통시장에서 매도

환매(Redemption):
  AP가 ETF 지분(CU 단위) → ETF 운용사에 제출
  → 운용사가 기초자산 바스켓 + 현금 인도 → AP가 유통시장에서 매도

차익 거래 메커니즘:
  ETF 시장가 > NAV (프리미엄):
    AP가 바스켓 매수(NAV) → ETF 설정 → ETF 매도(시장가) → 이익
    → ETF 공급 증가 → 시장가 하락 → NAV 수렴

  ETF 시장가 < NAV (디스카운트):
    AP가 ETF 매수(시장가) → ETF 환매 → 바스켓 매도(NAV) → 이익
    → ETF 공급 감소 → 시장가 상승 → NAV 수렴
```

이 메커니즘은 Gastineau (2001)가 "arbitrage enforcement mechanism"으로
명명한 ETF의 핵심 설계 원리이다.

참고문헌:
- Gastineau, G. (2001). An Introduction to Exchange-Traded Funds (ETFs). *Journal of Portfolio Management*, 27(3), 88-96.

### 2.2 수학적 정의: NAV, 괴리율, 추적오차

**순자산가치 (NAV, Net Asset Value):**

```
NAV_t = (Σᵢ wᵢ · Pᵢ,t + Cash_t - Expenses_t) / Shares_outstanding

wᵢ: 종목 i의 보유 수량
Pᵢ,t: 종목 i의 시점 t 가격
Cash_t: 현금 보유분 (배당금 수취, 미투자 현금)
Expenses_t: 누적 보수·비용
```

**실시간 추정 NAV (iNAV, Indicative NAV):**

KRX에서는 장중 매 10초마다 iNAV를 산출·공시한다.

```
iNAV_t = Σᵢ wᵢ · Pᵢ,t(실시간) / CU_size
```

**괴리율 (Premium/Discount):**

```
PD_t = (P_etf,t - iNAV_t) / iNAV_t × 100  (%)

프리미엄: PD_t > 0  → 매수 압력 초과 (수요 > 공급)
디스카운트: PD_t < 0 → 매도 압력 초과 (공급 > 수요)
```

**추적오차 (Tracking Error, TE):**

```
TE = σ(R_etf - R_index)   (수익률 차이의 표준편차)

R_etf,t = ln(P_etf,t / P_etf,t-1)
R_index,t = ln(I_t / I_{t-1})

연환산: TE_annual = TE_daily × √252
```

KRX 대형 ETF 기준:
- KODEX 200: TE ≈ 0.03-0.08% (일별), ~0.5-1.2% (연환산)
- KODEX 인버스: TE ≈ 0.10-0.25% (일별) — 일별 리밸런싱 비용

### 2.3 추적오차 원인 분해

Elton et al. (2002)는 ETF 추적오차의 원인을 4가지로 분해했다:

```
TE_total² ≈ TE_expense² + TE_sampling² + TE_cash² + TE_rebalance²

1. Expense Ratio (보수):
   연 0.05% (KODEX 200) ~ 0.50% (섹터/테마)
   → 확정적 음의 추적 (systematic negative drag)

2. Sampling Error (샘플링 오차):
   완전 복제(full replication) vs 표본 추출(sampling/optimization)
   → KOSPI200 ETF: 완전 복제 (200종목 전체 보유)
   → 소형주 ETF: 최적화 복제 → 높은 TE

3. Cash Drag (현금 보유 비용):
   배당금 수취 후 재투자까지 시차
   → 상승장에서 음의 추적, 하락장에서 양의 추적
   Cash_drag ≈ (Cash_weight) × (R_index - R_f)

4. Rebalancing Cost (리밸런싱 비용):
   지수 구성 변경 시 거래비용 + 시장 충격 비용
   → KOSPI200 정기 변경(6·12월): 편입/편출 종목 가격 왜곡
```

참고문헌:
- Elton, E.J., Gruber, M.J., Comer, G. & Li, K. (2002). Spiders: Where Are the Bugs? *Journal of Business*, 75(3), 453-472.

### 2.4 ETF 가격 비효율성

Petajisto (2017)는 ETF 괴리율의 체계적 비효율성을 실증했다:

```
주요 발견:
1. 괴리율 자기상관: ρ(PD_t, PD_{t-1}) > 0 — 평균회귀가 즉각적이지 않음
2. 폐장 시점 괴리율 확대: 장 마감 전 15분 괴리율 변동성 증가
3. 소규모 ETF: 괴리율 ∝ 1/AUM — 유동성과 반비례
4. 국제 ETF: 시차(time-zone) 프리미엄 — 기초시장 폐장 후에도 거래

Petajisto 회귀 모형:
|PD_t| = α + β₁ · ln(AUM) + β₂ · σ_index + β₃ · BidAsk_spread + ε
         (-)        (+)            (+)

β₁ < 0: 규모가 클수록 괴리율 작음
β₂ > 0: 변동성이 클수록 괴리율 확대
β₃ > 0: 스프레드가 넓을수록 차익 거래 비용 증가 → 괴리율 확대
```

KRX 적용:
- KODEX 200 (AUM ~10조 원): 괴리율 ±0.05% 이내
- 소형 테마 ETF (AUM ~500억 원): 괴리율 ±0.5-1.0% 빈번
- TIGER 미국S&P500 (국제 ETF): 미국 장 폐장 후 KRX 장중 괴리율 ±0.3-1.0%

참고문헌:
- Petajisto, A. (2017). Inefficiencies in the Pricing of Exchange-Traded Funds. *Financial Analysts Journal*, 73(1), 24-54.

---

## 3. 레버리지/인버스 ETF 센티먼트 (Leveraged/Inverse ETF Sentiment)

### 3.1 이론적 기초: 경로 의존성과 변동성 드래그

레버리지 ETF는 기초지수의 **일별 수익률**에 배수를 적용한다.
이는 복리(compounding) 효과로 인해 장기적으로 단순 배수와
괴리를 보이는 경로 의존성(path dependency) 문제를 야기한다.

**변동성 드래그 (Volatility Drag):**

```
레버리지 ETF의 N일 누적 수익률:
R_lev(0,N) = Πₜ₌₁ᴺ (1 + m · rₜ) - 1

여기서:
m: 레버리지 배율 (2x, -1x 등)
rₜ: 기초지수 일별 수익률

단순 배수와의 괴리:
R_lev(0,N) ≠ m · R_index(0,N)   (N > 1인 경우)

근사식 (로그수익률 기반):
E[R_lev(0,N)] ≈ m · R_index(0,N) - ½ · m · (m-1) · σ² · N

변동성 드래그 = ½ · m · (m-1) · σ² · N
  → m=2 (2x 레버리지): 드래그 = σ² · N (항상 양수 → 손실)
  → m=-1 (인버스):     드래그 = σ² · N (항상 양수 → 손실)
  → m=-2 (2x 인버스):  드래그 = 3σ² · N (가장 큰 드래그)
```

수치 예시 (KODEX 200 기준, σ_daily ≈ 1.2%):

```
연간 변동성 드래그 (252 거래일):
  KODEX 레버리지 (2x): ½ × 2 × 1 × 0.012² × 252 ≈ 3.6%
  KODEX 인버스 (-1x):  ½ × 1 × 2 × 0.012² × 252 ≈ 3.6%
  KODEX 인버스2X (-2x): ½ × 2 × 3 × 0.012² × 252 ≈ 10.9%
```

이 드래그는 기초지수가 원점 회귀하더라도 레버리지/인버스 ETF는
음의 수익률을 기록하는 구조적 문제를 만든다 — 소위 "횡보장 독"
(range-bound erosion).

### 3.2 일별 리밸런싱 메커니즘과 시장 충격

Cheng & Madhavan (2009)은 레버리지 ETF의 일별 리밸런싱이
장 마감 직전에 체계적 수급 불균형을 야기함을 실증했다:

```
일별 리밸런싱 물량:
ΔPosition = AUM × m × (m × r_t - r_t) = AUM × r_t × m × (m - 1)

예시 (KODEX 레버리지, AUM = 5조 원, m = 2):
  지수 +2% 상승 시:
    ΔPosition = 5조 × 0.02 × 2 × 1 = 2,000억 원 추가 매수
  지수 -2% 하락 시:
    ΔPosition = 5조 × (-0.02) × 2 × 1 = -2,000억 원 매도

→ 상승일: 장 마감 전 추가 매수 → 종가 부근 상방 압력 (momentum amplification)
→ 하락일: 장 마감 전 추가 매도 → 종가 부근 하방 압력 (momentum amplification)
```

이 효과는 Doc 27 §3.2의 프로그램 매매 종가 효과와 중첩되어 작용한다.

참고문헌:
- Cheng, M. & Madhavan, A. (2009). The Dynamics of Leveraged and Inverse Exchange-Traded Funds. *Journal of Investment Management*, 7(4), 43-62.

### 3.3 레버리지 비율 센티먼트 지표

레버리지/인버스 ETF의 거래량 비율은 개인 투자자 센티먼트의
강력한 프록시(proxy)로 기능한다. 특히 KRX에서는 개인투자자의
레버리지/인버스 ETF 거래 비중이 80% 이상으로, 기관/외국인 노이즈가
적어 순수 센티먼트 신호로서의 가치가 높다.

```
레버리지 비율 (Leverage Ratio, LR):
LR_t = Volume(KODEX 레버리지) / Volume(KODEX 인버스)

또는 금액 기반:
LR_t = Turnover(KODEX 레버리지) / Turnover(KODEX 인버스)

이동평균 평활화:
LR_MA(t, n) = (1/n) · Σₖ₌₀ⁿ⁻¹ LR_{t-k}   (n = 5, 10, 20)
```

**센티먼트 극단 임계 (Sentiment Extremes):**

```
극도 낙관 (Extreme Bullish):
  LR_t > 3.0 (5일 평균 기준)
  → 역발상 매도 신호 (contrarian sell)
  → 실증: LR > 3.0 후 5일 KOSPI200 평균 수익률 -0.8% (2015-2025)

극도 비관 (Extreme Bearish):
  LR_t < 0.3 (5일 평균 기준)
  → 역발상 매수 신호 (contrarian buy)
  → 실증: LR < 0.3 후 5일 KOSPI200 평균 수익률 +1.2% (2015-2025)

중립 대역:
  0.5 ≤ LR_t ≤ 2.0 → 방향성 신호 없음
```

> **UNVALIDATED FOR KOREA:** 위 임계값(3.0, 0.3)은 미국 레버리지 ETF 연구
> (Trainor, 2010)에서 차용한 것이며, KRX에서의 정확한 백테스트 기반 최적
> 임계는 아직 검증되지 않았다. KODEX 레버리지/인버스의 거래량 특성은
> 미국 TQQQ/SQQQ와 투자자 구성(개인 80%+)이 크게 달라 별도 교정이 필요하다.

### 3.4 확장: 개별종목 vs 지수 레버리지 비율

```
시장 전체: LR_market = Vol(KODEX 레버리지) / Vol(KODEX 인버스)
섹터:     LR_sector = Vol(TIGER 200 IT 레버리지) / Vol(TIGER 200 IT 인버스)
개별:     종목 레버리지 ETF 미출시 → inapplicable

→ 시장-섹터 간 LR 괴리 = 섹터 상대 심리
  LR_sector / LR_market > 1.5: 해당 섹터 과열 경고
  LR_sector / LR_market < 0.5: 해당 섹터 과도 비관
```

참고문헌:
- Trainor, W.J. (2010). Do Leveraged ETFs Increase Volatility? *Technology and Investment*, 1(3), 215-220.
- Charupat, N. & Miu, P. (2011). The Pricing and Performance of Leveraged Exchange-Traded Funds. *Journal of Banking & Finance*, 35(4), 966-977.

---

## 4. ETF 자금흐름 분석 (ETF Fund Flow Analytics)

### 4.1 이론적 기초: 자금흐름과 수익률 예측

ETF 자금흐름(fund flow)은 설정/환매를 통한 순유입(net creation)으로
측정되며, 이는 투자자의 집합적 자산배분 의사결정을 반영한다.

**자금흐름 산출:**

```
순설정액 (Net Creation):
NC_t = (Shares_outstanding,t - Shares_outstanding,t-1) × NAV_t

또는 변동률 기반:
Flow_t = (AUM_t - AUM_{t-1} × (1 + R_etf,t)) / AUM_{t-1}

→ Flow_t > 0: 순유입 (net inflow)
→ Flow_t < 0: 순유출 (net outflow)
```

Edelen & Warner (2001)은 뮤추얼 펀드 자금흐름이 당일 수익률과
양의 상관을 보이나, 익일 수익률과는 약한 음의 상관(반전)을
보임을 실증했다. ETF에서는 이 관계가 더 즉각적으로 나타난다.

```
당일 관계:   Corr(Flow_t, R_t) > 0  (동시 효과, price pressure)
익일 예측:   Corr(Flow_t, R_{t+1}) < 0  (약한 반전, 과잉 반응 교정)
주간 예측:   Corr(Flow_5d_cumul, R_5d_forward) ≈ 0  (예측력 미약)
```

참고문헌:
- Edelen, R.M. & Warner, J.B. (2001). Aggregate Price Effects of Institutional Trading: A Study of Mutual Fund Flow and Market Returns. *Journal of Financial Economics*, 59(2), 195-220.

### 4.2 ETF 보유와 주식 변동성

Ben-David, Franzoni & Moussawi (2018)는 ETF 보유 비중이 높은 종목의
변동성이 유의하게 높아지는 현상을 발견했다:

```
핵심 회귀:
σᵢ,t = α + β₁ · ETF_ownership_i,t + β₂ · Size_i + β₃ · Volume_i + ε

발견:
β₁ > 0 (유의, t > 3.0)
→ ETF 보유 비중 10%p 증가 시 일별 변동성 ~16% 증가

메커니즘:
1. Non-fundamental trading: ETF 설정/환매가 기초자산 거래를 유발
   → 종목 자체 펀더멘탈과 무관한 가격 변동
2. Liquidity transformation mismatch:
   ETF는 장중 연속 거래 가능 vs 기초자산 일부는 비유동적
   → 유동성 불일치로 인한 가격 충격 증폭
3. Arbitrage-induced volatility:
   AP 차익 거래 자체가 추가 거래를 발생시킴
```

**KRX 적용:**

```
KOSPI200 내 ETF 보유 비중 분포 (추정, 2025):
  상위 10 종목 (삼성전자, SK하이닉스 등): ETF 보유 비중 5-8%
  하위 50 종목 (소형주): ETF 보유 비중 15-30%

→ 역설: 소형주일수록 ETF 보유 비중이 높아 (지수 가중 대비 ETF 비중 과대)
  비펀더멘탈 거래에 더 취약하다.
→ 패턴 신뢰도 함의: ETF 보유 비중이 높은 종목의 기술적 패턴은
  ETF 리밸런싱 노이즈에 오염될 가능성이 있다.
```

참고문헌:
- Ben-David, I., Franzoni, F. & Moussawi, R. (2018). Do ETFs Increase Volatility? *Journal of Finance*, 73(6), 2471-2535.

### 4.3 섹터 ETF 자금흐름과 섹터 회전

섹터 ETF 순유입은 Doc 29 §1.2의 Stovall (1996) 섹터 회전 모형에 대한
실시간 검증 수단이자 선행 지표로 기능한다.

```
섹터별 순설정 비율:
SectorFlow_s,t = NC_s,t / AUM_s,t-1   (섹터 s, 일자 t)

5일 누적 자금흐름 모멘텀:
FlowMomentum_s(t) = Σₖ₌₀⁴ SectorFlow_s,t-k

섹터 회전 신호:
  FlowMomentum_s > 0.02 (2%): 해당 섹터 유입 가속 → 선호 섹터
  FlowMomentum_s < -0.02 (-2%): 해당 섹터 유출 가속 → 비선호 섹터
```

**KRX 섹터 ETF 유니버스 (주요):**

| 섹터 | 대표 ETF | 코드 | AUM 규모(억 원) |
|------|---------|------|---------------|
| IT/반도체 | TIGER 반도체 | 091230 | ~8,000 |
| 금융 | KODEX 은행 | 091170 | ~3,000 |
| 헬스케어 | TIGER 헬스케어 | 143860 | ~2,500 |
| 에너지/화학 | KODEX 에너지화학 | 117460 | ~1,500 |
| 자동차 | TIGER 200 중공업 | 139220 | ~1,200 |
| 2차전지 | TIGER 2차전지테마 | 305540 | ~15,000 |
| 소비재 | KODEX 필수소비재 | 266390 | ~500 |

**교차 확인:**

```
섹터 ETF 자금흐름 vs 경기순환 국면:
  Early Expansion: IT/금융 ETF 유입 + 에너지 유출 → 일치 시 신호 강화
  Late Expansion:  에너지/소재 ETF 유입 + IT 유출 → 일치 시 신호 강화
  (Doc 29 §1.2 Stovall 모형과 교차 검증)
```

### 4.4 총량 자금흐름과 시장 방향

```
총 ETF 순설정 (주식형만):
AggFlow_t = Σₛ NC_s,t   (모든 주식형 ETF의 순설정 합산)

20일 누적 총량 흐름:
AggFlow_20d(t) = Σₖ₌₀¹⁹ AggFlow_{t-k}

시장 방향 신호:
  AggFlow_20d > 0: 시장 전반 순유입 → 강세 편향
  AggFlow_20d < 0: 시장 전반 순유출 → 약세 편향
  |AggFlow_20d| > 2σ(AggFlow_20d): 극단 → 역발상 경계
```

---

## 5. ETF와 기초자산 피드백 루프 (ETF-Underlying Feedback Loop)

### 5.1 이론적 기초: ETF 동조화 효과

Wurgler (2011)는 ETF(과 인덱스 펀드)가 기초자산 종목들의
상관관계를 체계적으로 증가시키는 "index inclusion effect"를 분석했다.

```
지수 편입 효과:
종목 i가 지수(예: KOSPI200)에 편입되면:
  β_i,index 상승 (지수에 대한 베타 증가)
  ρ(i,j) 상승    (같은 지수 내 다른 종목과의 상관 증가)
  R²_i 상승      (시장 요인 설명력 증가, 고유 분산 감소)

Barberis, Shleifer & Wurgler (2005) 실증:
  S&P 500 편입 후:
    시장 베타: +0.15 (편입 전 대비)
    동일 지수 내 상관: +0.08
    비편입 종목과 상관: 변화 없음

메커니즘: "habitat" 이론 — 동일 ETF/인덱스에 속한 종목들은
  공통 투자자 풀(habitat)을 공유하여 비펀더멘탈 공변동이 발생
```

**KRX 적용 (동조화 강도 추정):**

```
KOSPI200 편입/편출 이벤트 효과 (정기 변경, 6월/12월):
  편입 종목:
    편입 공시일(D-10) → 편입일(D) 구간:
    초과 수익률: +3-8% (anticipation trading)
    편입 후 60일: 베타 증가 ~0.10-0.20
    편입 후 60일: 지수 내 상관 증가 ~0.05-0.12

  편출 종목:
    편출 공시일(D-10) → 편출일(D) 구간:
    초과 수익률: -5-12% (anticipation selling)
    편출 후 60일: 베타 감소 ~0.10-0.15
```

이 효과는 ETF AUM 증가에 비례하여 강화되는 추세에 있다.
2010년대 이후 KRX ETF AUM 10배 증가 → 편입/편출 가격 효과 증폭.

참고문헌:
- Wurgler, J. (2011). On the Economic Consequences of Index-Linked Investing. In *Challenges to Business in the Twenty-First Century*, NBER.
- Barberis, N., Shleifer, A. & Wurgler, J. (2005). Comovement. *Journal of Financial Economics*, 75(2), 283-317.

### 5.2 정보 효율성에 대한 이중 효과

Israeli, Lee & Sridharan (2017)은 ETF 보유가 정보 효율성에 미치는
이중적 효과를 실증했다:

```
효율성 향상 경로 (Positive):
  ETF → 유동성 증가 → 거래비용 감소 → 정보 거래 촉진
  → 가격이 정보를 더 빠르게 반영

효율성 저하 경로 (Negative, 지배적):
  ETF → 비정보 거래(uninformed trading) 증가
  → 가격의 노이즈 증가 → 정보 비율(FERC) 저하

실증 결과:
  ETF 보유 비중 1σ 증가 시:
    미래 이익 반응계수(FERC) ~9% 감소
    주가 동조성(stock return synchronicity) 증가
    애널리스트 예측 오차 증가
```

기술적 분석 함의:

```
ETF 보유 비중이 높은 종목:
  → 펀더멘탈 기반 패턴(예: 실적 발표 후 추세) 신뢰도 저하
  → 수급 기반 패턴(예: 거래량 돌파) 신뢰도 상대적 유지
  → 지수 전체 기술적 패턴에 동조하는 경향 증가

패턴 신뢰도 보정 (제안):
confidence_adj = confidence_base × (1 - α_etf × ETF_ownership_i)
α_etf ≈ 0.3-0.5 (교정 필요)

→ ETF 보유 비중 20%인 종목: 신뢰도 6-10% 할인
→ ETF 보유 비중 5%인 종목: 신뢰도 1.5-2.5% 할인
```

참고문헌:
- Israeli, D., Lee, C.M.C. & Sridharan, S.A. (2017). Is There a Dark Side to Exchange Traded Funds? An Information Perspective. *Review of Accounting Studies*, 22(3), 1048-1083.

### 5.3 리밸런싱 구동 수요와 지수 재구성 효과

```
KOSPI200 정기 변경 일정:
  공시: 6월/12월 첫째 영업일 (한국거래소)
  적용: 공시 후 약 2주 (6월/12월 둘째 금요일 이후 첫 영업일)

예상 매매 패턴 (지수 추종 ETF + 인덱스 펀드):
  공시일 ~ 적용일 (10 영업일):
    편입 예정 종목: 점진적 매수 압력 → 상방 드리프트
    편출 예정 종목: 점진적 매도 압력 → 하방 드리프트

  적용일 당일 (D-day):
    거래량 급증 (평소 대비 3-10배)
    종가 부근 최종 포지션 조정 → 종가 왜곡

  적용일 이후 (D+1 ~ D+5):
    편입 종목: 초과 수익 반전 (price reversal)
    편출 종목: 과잉 하락 반등 (mean reversion)

이 효과는 Doc 27 §4.4의 만기일 효과와 리밸런싱이 동월에 겹칠 때
(6월/12월) 증폭된다.
```

---

## 6. ETF 괴리율 신호 (Premium/Discount Signal)

### 6.1 이론적 기초: 괴리율의 정보 함량

ETF 괴리율은 단순한 차익 거래 기회 지표를 넘어,
투자자의 수급 압력과 기대 방향성에 대한 정보를 담고 있다.

```
괴리율 분해:
PD_t = PD_arb,t + PD_info,t + PD_noise,t

PD_arb,t:  차익 거래 마찰 (거래비용, 공매도 제약)
PD_info,t: 정보 기반 거래 (ETF 가격이 NAV보다 먼저 반응)
PD_noise,t: 노이즈 트레이더 수급 불균형
```

### 6.2 지속적 프리미엄/디스카운트 신호

괴리율의 방향과 지속 기간은 수급 방향의 강도를 나타낸다:

```
지속적 프리미엄 (Persistent Premium):
  PD_MA5 > threshold (예: 0.3%) → 3일 이상 연속
  해석: 매수 수요 > AP 설정 능력 → 강한 유입 신호
  → 기초자산 바스켓 매수 압력 예상 → 개별 종목 상방 요인

지속적 디스카운트 (Persistent Discount):
  PD_MA5 < -threshold (예: -0.3%) → 3일 이상 연속
  해석: 매도 압력 > AP 환매 능력 → 강한 유출 신호
  → 기초자산 바스켓 매도 압력 예상 → 개별 종목 하방 요인

평균회귀 (Mean Reversion):
  |PD_t| > 2σ(PD) → 이후 5일 내 80%+ 확률로 축소
  → 극단 괴리율은 차익 거래 유인을 강화하여 자동 교정
```

**일중 괴리율 패턴 (Intraday Premium Dynamics):**

```
09:00-09:30: 괴리율 변동성 최대 (개장 가격 발견)
09:30-14:30: 괴리율 안정 (AP 차익 거래 활발)
14:30-15:30: 괴리율 확대 (장 마감 리밸런싱 + 유동성 감소)

→ 패턴 분석 시 종가 기반 괴리율이 장중 평균보다 절대값이 클 수 있음
→ 일별 괴리율 데이터 사용 시 종가 바이어스에 주의
```

### 6.3 동일 기초자산 괴리율 수렴 전략

```
동일 기초지수를 추종하는 복수 ETF 간 괴리율 차이:
ΔPD_t = PD_A,t - PD_B,t   (A, B는 동일 기초지수 ETF)

예: KODEX 200 vs TIGER 200
  통상: |ΔPD_t| < 0.1% (경쟁 LP 활동으로 수렴)
  이탈: |ΔPD_t| > 0.3% → 수렴 예상 → 상대가치 거래(pairs trade)
    Long: 디스카운트가 큰 ETF, Short: 프리미엄이 큰 ETF

수렴 속도:
  ΔPD_t 반감기 ≈ 0.5-2 거래일 (대형 ETF 간)
  ΔPD_t 반감기 ≈ 3-10 거래일 (소형 ETF 간)
```

### 6.4 국제 ETF 프리미엄과 환율 센티먼트

KRX에 상장된 해외 지수 추종 ETF의 괴리율은 환율 기대를 내포한다:

```
TIGER 미국S&P500 괴리율 분해:
PD_intl,t = PD_pure,t + PD_fx,t

PD_pure,t: 순수 괴리율 (기초지수 NAV 대비)
PD_fx,t:   환율 기대 프리미엄

시차 효과:
  미국 시장 폐장 (KST 06:00) → KRX 개장 (KST 09:00)
  3시간 갭 동안의 정보 → iNAV에 반영 불가 → 괴리율 확대

해석:
  PD_intl > 1.0%: 원화 약세(달러 강세) 기대 + 미국 시장 강세 기대
  PD_intl < -1.0%: 원화 강세(달러 약세) 기대 + 미국 시장 약세 기대

→ Doc 28 §4.1의 USD/KRW 센티먼트 지표와 교차 검증 가능
```

---

## 7. KRX ETF 시장 구조 (KRX ETF Market Structure)

### 7.1 유동성 공급자 (LP, Liquidity Provider)

KRX ETF 시장의 유동성은 지정유동성공급자(LP) 제도에 의해 보장된다:

```
LP 의무:
1. 호가 의무: 양방향 호가(매수+매도) 상시 제시
   → 호가 스프레드 상한: ETF별 차등 (통상 최우선호가 기준 ±50bp 이내)
   → 호가 수량: 최소 1 CU 이상

2. 응답 의무: iNAV 대비 괴리율이 임계 초과 시 호가 제시
   → 괴리율 > 1.0%: 30초 이내 대응

3. 시간 의무: 거래시간의 80% 이상 호가 유지
   → 시초가 결정 시간(09:00-09:05)과 장 마감 전(15:20-15:30) 포함

LP 인센티브:
  KRX 수수료 감면 + 시장조성 보조금
  연간 보조금: ETF당 ~2,000만-5,000만 원 (AUM·거래량에 따라 차등)
```

**LP 스프레드와 패턴 신호:**

```
스프레드 확대 = 불확실성 증가 또는 유동성 감소
  → ETF 괴리율 확대와 동시 발생
  → 기초자산 개별 종목의 유동성도 간접적으로 감소

스프레드 급등 이벤트 (LP 호가 철회):
  극단적 변동성 (장중 ±5% 이상)
  해외 기초자산 시장 폐장 (국제 ETF)
  → 괴리율 급등 → 차익 거래 기능 일시 정지
```

### 7.2 AP (지정참가회사) 구조

```
KRX 지정참가회사 자격:
  증권회사 (한국투자, 미래에셋, 삼성 등 대형사)
  설정/환매 주체: AP만 가능 (일반 투자자는 유통시장에서만 거래)

AP 제약:
  설정단위(CU): 통상 50,000구 (KODEX 200 기준 약 20-25억 원)
  → 소규모 차익 거래 불가 → 소형 ETF 괴리율이 대형 대비 큰 이유
  현물 바스켓 구성: 기초지수 전 종목 또는 최적화 바스켓
  → KOSPI200 완전 복제: 200종목 동시 매매 필요 → 시장 충격
```

### 7.3 ETF vs ETN vs ELW 비교

| 특성 | ETF | ETN | ELW |
|------|-----|-----|-----|
| 발행자 | 자산운용사 | 증권회사 | 증권회사 |
| 기초자산 보유 | O (실물 보유) | X (신용 위험) | X (헤지 거래) |
| 신용 위험 | 없음 (분리 보관) | 있음 (발행사 부도 시 손실) | 있음 |
| 만기 | 없음 (영구) | 있음 (1-20년) | 있음 (1-3년) |
| 추적오차 | 있음 | 없음 (확정 수익구조) | N/A |
| 괴리율 | 있음 | 있음 (더 큼) | N/A (내재변동성 반영) |
| 세금 | 매매차익 비과세* | 매매차익 과세 | 매매차익 비과세* |
| 개인 적합성 | 높음 | 중간 | 낮음 (고위험) |

*국내 주식형 ETF에 한함. 해외·채권·파생형 ETF는 과세 대상.

### 7.4 액티브 ETF의 등장과 가격 발견 변화

2023년 이후 KRX에서 액티브 ETF가 급성장:

```
패시브 ETF:
  지수 복제 → 추적오차 최소화 → 가격 발견 기여 낮음
  → 기초자산 동조화 강화

액티브 ETF:
  펀드매니저 재량 → 종목 선택 + 비중 조절
  → 가격 발견 기여 높음
  → 기초자산 동조화 약화 (지수와 다른 구성)

KRX 액티브 ETF 규모 (2025):
  상장 수: ~80+ (2023년 20개 → 2년간 4배 증가)
  AUM: ~5조 원+ (전체 ETF 대비 ~4%)
  주요 유형: 배당, 가치, 성장, AI, 반도체

기술적 분석 함의:
  액티브 ETF의 재량적 종목 선택 → 특정 종목에 비체계적 수급
  → 패턴의 외생적 교란원이 패시브 ETF보다 예측하기 어려움
```

---

## 8. ETF 센티먼트 레짐 분류 (ETF Sentiment Regime Classification)

### 8.1 복합 센티먼트 지수 (Composite ETF Sentiment Index)

단일 지표(레버리지 비율, 자금흐름, 괴리율)를 결합한
복합 센티먼트 지수를 구성한다:

```
CESI_t = w₁ · Z(LR_t) + w₂ · Z(AggFlow_20d,t) + w₃ · Z(PD_avg,t)

Z(X) = (X - μ_X) / σ_X   (표준화)

가중치 (이론적 제안):
w₁ = 0.40  (레버리지 비율 — 센티먼트 직접 반영)
w₂ = 0.35  (총량 자금흐름 — 실제 자금 이동)
w₃ = 0.25  (괴리율 평균 — 수급 불균형 즉시성)

Σwᵢ = 1.0
```

> **UNVALIDATED FOR KOREA:** 위 가중치(0.40, 0.35, 0.25)는 이론적 중요도에
> 기반한 초기 제안이며, KRX 실증 데이터에 대한 최적화 결과가 아니다.
> IC(Information Coefficient) 기반 가중치 교정이 필요하다.

### 8.2 4-레짐 분류

```
CESI_t 기반 레짐 분류:

  탐욕 (Greed):       CESI_t > 1.5σ
    → 역발상 매도 경계, 기술적 매수 신호 신뢰도 ×0.85
    → 레버리지 비율 극도 낙관, 자금 과유입

  낙관 (Optimism):    0 < CESI_t ≤ 1.5σ
    → 추세 추종 유효, 매수 패턴 신뢰도 ×1.05
    → 자금흐름 양호, 순설정 지속

  비관 (Pessimism):   -1.5σ ≤ CESI_t < 0
    → 약세 편향, 매도 패턴 신뢰도 ×1.05
    → 자금 순유출, 인버스 거래량 증가

  공포 (Fear):        CESI_t < -1.5σ
    → 역발상 매수 기회, 기술적 매도 신호 신뢰도 ×0.85
    → 인버스 거래 극단, 자금 대량 유출

패턴 신뢰도 조정:
confidence_etf = confidence_base × etfRegimeMult

etfRegimeMult:
  Greed  → 0.85 (매수 신호에 적용)
  Greed  → 1.10 (매도 신호에 적용)
  Fear   → 1.10 (매수 신호에 적용)
  Fear   → 0.85 (매도 신호에 적용)
  Optimism/Pessimism → 1.00-1.05 (추세 방향과 동일한 신호에 적용)
```

### 8.3 레짐 전환 감지

```
CUSUM 기반 전환 감지 (Doc 21 §2 CUSUM 참조):
S_t⁺ = max(0, S_{t-1}⁺ + CESI_t - k)   (상향 이탈)
S_t⁻ = min(0, S_{t-1}⁻ + CESI_t + k)   (하향 이탈)

h = 4σ(CESI), k = 0.5σ(CESI)

|S_t⁺| > h 또는 |S_t⁻| > h → 레짐 전환 탐지
→ 전환 직후 3-5일은 패턴 신뢰도 추가 할인 (×0.90)
   (레짐 전환 과도기의 불확실성 반영)
```

---

## 9. ETF 보유 비중과 개별 종목 패턴 신뢰도 (ETF Ownership & Pattern Reliability)

### 9.1 이론적 기초: 공변동과 고유 변동 분해

ETF 보유가 개별 종목의 수익률을 시장 요인(공변동)과
고유 요인(개별 변동)으로 분해하는 구조에 미치는 영향:

```
종목 i의 수익률 분해:
r_i,t = α_i + β_i · r_m,t + ε_i,t

R²_i = β_i² · Var(r_m) / Var(r_i)   (시장 설명 비율)

ETF 보유 효과:
  ETF_ownership ↑ → β_i ↑ → R²_i ↑ → Var(ε_i) ↓
  → 고유 변동(idiosyncratic volatility) 감소
  → 종목 고유 패턴의 신호 대 잡음 비율(SNR) 변화

SNR_pattern = signal_i / noise_i
  signal_i = 패턴이 포착하는 고유 가격 변동
  noise_i = ETF 리밸런싱 등 비펀더멘탈 가격 변동

ETF 보유 비중 증가 시:
  고유 signal_i 감소 (시장 동조 증가로 고유 패턴 약화)
  비펀더멘탈 noise_i 증가 (ETF 수급 교란)
  → SNR_pattern 이중 악화
```

### 9.2 ETF 보유 비중별 패턴 신뢰도 등급

```
등급 분류 (ETF 보유 비중 기준):

ETF_ownership < 5%:  Grade A — 고유 패턴 우세
  → 패턴 신뢰도 보정: ×1.00 (보정 불필요)
  → 대형주 중 ETF 비포함 종목, 또는 KOSPI200 외 중소형주

5% ≤ ETF_ownership < 15%:  Grade B — 혼합 영향
  → 패턴 신뢰도 보정: ×0.95
  → KOSPI200 주요 구성종목 (삼성전자 ~6%, SK하이닉스 ~8%)

15% ≤ ETF_ownership < 30%:  Grade C — ETF 수급 우세
  → 패턴 신뢰도 보정: ×0.85
  → KOSPI200 하위 종목 중 ETF 편중 종목

ETF_ownership ≥ 30%:  Grade D — 패턴 의미 저하
  → 패턴 신뢰도 보정: ×0.70
  → 극단적 경우 (소형 지수 종목이 대형 테마 ETF에 편입)
```

> **주의:** ETF 보유 비중 데이터는 DART 또는 KRX 공시를 통해
> 분기/반기 단위로만 확인 가능하며, 실시간 데이터가 아니다.
> 분기 지연(quarter-lag) 바이어스에 유의해야 한다.

### 9.3 교차 효과: ETF 보유 × 시장 레짐

```
ETF 보유 비중의 패턴 신뢰도 영향은 시장 레짐에 따라 비대칭적:

위기 레짐 (VIX > 30 / VKOSPI > 30):
  ETF 환매 급증 → 바스켓 매도 → 무차별 하락
  → ETF 보유 비중이 높은 종목일수록 비펀더멘탈 하락 폭 증가
  → 매수 패턴 신뢰도 추가 할인: ×0.80 (Grade C) / ×0.60 (Grade D)
  (Ben-David et al. (2018) §6의 위기 시 ETF 증폭 효과)

안정 레짐 (VIX < 20 / VKOSPI < 20):
  ETF 수급 안정 → 차익 거래 정상 작동
  → ETF 보유 비중 효과 약화
  → 패턴 신뢰도 보정 완화: Grade B → ×0.98, Grade C → ×0.90
```

---

## 10. ETF 자금흐름과 거시 지표 교차 분석

### 10.1 ETF 자금흐름 - 금리 관계

```
금리 상승기 (BOK 인상 사이클):
  채권 ETF 순유출 + 주식 ETF 순유입 (전통적 자산배분)
  단, KRX 특수성: 개인투자자 비중이 높아 자산배분 효과 약함
  기관/외국인 ETF 자금흐름이 금리에 더 민감

금리 하락기 (BOK 인하 사이클):
  채권 ETF 순유입 + 주식 ETF 순유입 (유동성 효과)
  → 주식·채권 동반 유입은 유동성 과잉 신호

교차 신호:
  주식 ETF 유입 + 채권 ETF 유출 = risk-on (Doc 35 §9 채권-주식 상관 참조)
  주식 ETF 유출 + 채권 ETF 유입 = risk-off (안전자산 선호)
  주식 ETF 유출 + 채권 ETF 유출 = 현금 선호 (극도의 불확실성)
  주식 ETF 유입 + 채권 ETF 유입 = 유동성 과잉 (정책 완화기)
```

### 10.2 ETF 자금흐름 - 환율 관계

```
외국인 ETF 순매수 vs USD/KRW:
  외국인 KRX ETF 순매수 → 달러 매도/원화 매수 → USD/KRW 하락 압력
  외국인 KRX ETF 순매도 → 달러 매수/원화 매도 → USD/KRW 상승 압력

TIGER 미국S&P500 / KODEX 미국나스닥100 순설정:
  순설정 급증 → 원화→달러 환전 수요 → USD/KRW 간접 상승 압력
  순환매 급증 → 달러→원화 환전 수요 → USD/KRW 간접 하락 압력

→ Doc 28 §4.1의 USD/KRW 채널과 상호 참조
```

### 10.3 ETF 자금흐름 - 경기순환 관계

```
경기순환 국면별 ETF 자금흐름 패턴 (이론적):

  초기 확장: 주식 ETF 순유입 시작, 레버리지 비율 상승 개시
  후기 확장: 테마/레버리지 ETF 유입 가속, 괴리율 프리미엄 확대
  초기 수축: 인버스 ETF 유입 급증, 주식 ETF 순유출 개시
  후기 수축: 안전자산(금, 채권) ETF 유입, 주식 ETF 유출 감속

→ Doc 29 §1.1의 경기순환 4국면과 교차 검증
→ ETF 자금흐름이 경기순환 전환을 선행하는지는 실증 검증 필요
```

---

## 11. 고급 주제: ETF 생태계의 체계적 위험 (Systemic Risk)

### 11.1 유동성 불일치 위험 (Liquidity Mismatch Risk)

```
유동성 전환 문제:
  ETF: 장중 연속 거래 가능 → 즉시 유동성
  기초자산: 일부 비유동적 (소형주, 채권, 신흥국 주식)
  → ETF 유동성 > 기초자산 유동성

위기 시 전개:
  투자자 ETF 대량 매도 → ETF 가격 급락
  → AP 환매 → 기초자산 바스켓 매도 시도
  → 기초자산 유동성 부족 → 실제 매도 불가 또는 대폭 할인 매도
  → ETF 디스카운트 급등 → 추가 매도 압력 → 피드백 루프

실증:
  2020년 3월 코로나 위기 시:
    HY 채권 ETF (미국 HYG): 디스카운트 -5% 이상
    KRX 해외주식 ETF: 디스카운트 -3% 이상 (시차 + 유동성)
```

Ramaswamy (2011)는 BIS 보고서에서 이 유동성 불일치를
ETF의 가장 중요한 체계적 위험 요인으로 지목했다.

참고문헌:
- Ramaswamy, S. (2011). Market Structures and Systemic Risks of Exchange-Traded Funds. *BIS Working Paper No. 343*.

### 11.2 Flash Crash와 ETF 연쇄 효과

```
2010.05.06 Flash Crash:
  ETF가 전체 거래 취소(broken trade)의 70% 차지
  → ETF 호가 철회 → 기초자산 유동성 소멸 → 가격 붕괴 → 피드백 루프

2015.08.24 Mini Flash Crash:
  ETF 순간 괴리율 -20% 이상 (iShares Core S&P 500: -20%)
  → AP 호가 제시 지연 → 괴리율 폭발 → 서킷브레이커 발동

KRX 방어 메커니즘:
  사이드카: 선물 5% 이상 변동 + 1분 지속 → 프로그램 매매 5분 중단
  서킷브레이커: KOSPI 8%/15%/20% 하락 → 20분/20분/종일 정지
  ETF 변동성 완화장치: 전일 종가 대비 ±6% 이상 → 2분 단일가 매매
  → Doc 20 §6 서킷브레이커와 연계 작동
```

### 11.3 ETF 집중도 위험

```
KRX ETF 시장의 HHI (Herfindahl-Hirschman Index):
  브랜드 기준: KODEX + TIGER ≈ 70% → HHI ≈ 2,500+
  → 고집중 시장 (Doc 33 §2.2 HHI 분류 기준)

집중도 위험:
  운용사 리스크: 주요 운용사의 운영 장애 → 설정/환매 중단
  LP 집중: 대형 증권사 2-3곳이 대부분의 LP 역할
  → LP 동시 호가 철회 시 유동성 소멸 위험
```

---

## 12. CheeseStock 구현 경로 (Implementation Path)

### 12.1 데이터 파이프라인

```
[데이터 수집]
scripts/download_etf.py (신규)
  → KRX ETF 일별 시세 + 설정/환매 + 괴리율
  → data/derivatives/etf_daily.json

구조 (제안):
{
  "lastUpdate": "2026-04-02",
  "etfs": {
    "069500": {  // KODEX 200
      "name": "KODEX 200",
      "underlying": "KOSPI200",
      "type": "passive",
      "aum": 105000,  // 억원
      "nav": 35250,    // 원
      "price": 35280,  // 원
      "premium": 0.085, // %
      "volume": 5230000,
      "netCreation": 1500000, // 구수
      "holdings": [  // 상위 10 종목
        {"code": "005930", "weight": 0.302},
        {"code": "000660", "weight": 0.098},
        ...
      ]
    },
    "122630": {  // KODEX 레버리지
      "name": "KODEX 레버리지",
      "underlying": "KOSPI200",
      "type": "leverage_2x",
      "volume": 18500000,
      ...
    },
    "114800": {  // KODEX 인버스
      "name": "KODEX 인버스",
      "underlying": "KOSPI200",
      "type": "inverse_1x",
      "volume": 12300000,
      ...
    },
    ...
  },
  "leverageRatio": {
    "kospi200": {
      "current": 1.50,
      "ma5": 1.62,
      "ma20": 1.45,
      "regime": "optimism"  // greed/optimism/pessimism/fear
    }
  },
  "sectorFlows": {
    "IT": { "flow5d": 0.015, "flow20d": 0.032 },
    "금융": { "flow5d": -0.008, "flow20d": -0.012 },
    ...
  },
  "aggregateFlow": {
    "flow5d": 1200,   // 억원
    "flow20d": 5800,  // 억원
    "regime": "inflow"
  }
}
```

### 12.2 신호 매핑

```
signalEngine.js 통합 신호:

1. etfSentiment (ETF 센티먼트):
   입력: leverageRatio.kospi200
   출력: { direction: 'contrarian_sell'|'contrarian_buy'|'neutral',
           strength: 0.0-1.0,
           regime: 'greed'|'optimism'|'pessimism'|'fear' }

2. etfFlow (ETF 자금흐름):
   입력: aggregateFlow + sectorFlows
   출력: { marketFlow: 'inflow'|'outflow'|'extreme_in'|'extreme_out',
           sectorRotation: { leading: ['IT','금융'], lagging: ['에너지'] },
           strength: 0.0-1.0 }

3. etfPremium (ETF 괴리율):
   입력: 대표 ETF 괴리율 (KODEX 200, TIGER 200)
   출력: { direction: 'demand_pressure'|'supply_pressure'|'neutral',
           premium_pct: float,
           persistence: int (연속일수) }

4. etfOwnership (ETF 보유 영향, 종목별):
   입력: 개별 종목의 ETF 보유 비중
   출력: { grade: 'A'|'B'|'C'|'D',
           reliabilityMult: 0.70-1.00 }
```

### 12.3 패턴 신뢰도 통합

```
기존 패턴 신뢰도 체계 (Doc 35 §10 참조)에 ETF 요인 추가:

confidence_final = confidence_base
                 × ycRegimeMult      (yield curve: 0.85~1.05, Doc 35)
                 × creditMult        (credit: 0.85~1.02, Doc 35)
                 × ddMult            (DD: 0.70~1.15, Doc 35)
                 × rateBetaMult      (rate beta: 0.90~1.05, Doc 35)
                 × etfRegimeMult     (ETF regime: 0.85~1.10, 본 문서 §8.2)
                 × etfOwnershipMult  (ETF ownership: 0.70~1.00, 본 문서 §9.2)

합산 범위 (극단):
  최소: 0.85 × 0.85 × 0.70 × 0.90 × 0.85 × 0.70 ≈ 0.22
  최대: 1.05 × 1.02 × 1.15 × 1.05 × 1.10 × 1.00 ≈ 1.44

→ 6가지 곱셈 보정의 극단 범위가 과도할 수 있으므로
  전체 보정 하한: max(0.50, confidence_final)
  전체 보정 상한: min(1.30, confidence_final)
  → 클램핑으로 극단 조합 방지
```

### 12.4 backtester.js 통합

```
ETF 센티먼트를 시장 전체 오버레이 신호로 활용:

backtester.js 확장:
  marketOverlay = {
    etfSentiment: etfSentimentSignal,  // greed/optimism/pessimism/fear
    etfFlow: etfFlowSignal,            // inflow/outflow
    etfPremium: etfPremiumSignal       // demand/supply/neutral
  }

  패턴별 백테스트 시:
    전체 기간 수익률 vs ETF 레짐별 수익률 비교
    → 특정 패턴이 ETF 탐욕 레짐에서 실패율 증가 → 해당 레짐에서 신뢰도 할인

  섹터 ETF 흐름 오버레이:
    섹터별 패턴 신뢰도 = base × sectorFlowMult
    sectorFlowMult = 1.0 + clip(FlowMomentum_sector, -0.10, 0.10)
    → 섹터 유입 가속 시 매수 패턴 강화, 유출 가속 시 매도 패턴 강화
```

### 12.5 구현 로드맵

```
Phase 1: 데이터 수집 (download_etf.py)
  → KRX 크롤링 or pykrx 확장
  → data/derivatives/etf_daily.json 생성
  → daily_update.bat 통합

Phase 2: 센티먼트 지표 계산
  → indicators.js: calcLeverageRatio(), calcETFFlow()
  → signalEngine.js: etfSentiment, etfFlow, etfPremium 신호 추가

Phase 3: 패턴 신뢰도 통합
  → backtester.js: 시장 오버레이 신호 반영
  → patternRenderer.js: ETF 레짐 표시 (HUD 또는 배지)

Phase 4: 종목별 ETF 보유 비중 반영
  → data/etf_ownership.json (분기 갱신)
  → 종목별 Grade A-D 분류
  → 패턴 신뢰도 × etfOwnershipMult 적용
```

---

## 13. 참고문헌 종합 (References)

### 핵심 논문 (Core Papers)

1. Gastineau, G. (2001). An Introduction to Exchange-Traded Funds (ETFs). *Journal of Portfolio Management*, 27(3), 88-96.

2. Elton, E.J., Gruber, M.J., Comer, G. & Li, K. (2002). Spiders: Where Are the Bugs? *Journal of Business*, 75(3), 453-472.

3. Barberis, N., Shleifer, A. & Wurgler, J. (2005). Comovement. *Journal of Financial Economics*, 75(2), 283-317.

4. Cheng, M. & Madhavan, A. (2009). The Dynamics of Leveraged and Inverse Exchange-Traded Funds. *Journal of Investment Management*, 7(4), 43-62.

5. Trainor, W.J. (2010). Do Leveraged ETFs Increase Volatility? *Technology and Investment*, 1(3), 215-220.

6. Charupat, N. & Miu, P. (2011). The Pricing and Performance of Leveraged Exchange-Traded Funds. *Journal of Banking & Finance*, 35(4), 966-977.

7. Ramaswamy, S. (2011). Market Structures and Systemic Risks of Exchange-Traded Funds. *BIS Working Paper No. 343*.

8. Wurgler, J. (2011). On the Economic Consequences of Index-Linked Investing. In *Challenges to Business in the Twenty-First Century*, NBER.

9. Petajisto, A. (2017). Inefficiencies in the Pricing of Exchange-Traded Funds. *Financial Analysts Journal*, 73(1), 24-54.

10. Israeli, D., Lee, C.M.C. & Sridharan, S.A. (2017). Is There a Dark Side to Exchange Traded Funds? An Information Perspective. *Review of Accounting Studies*, 22(3), 1048-1083.

11. Ben-David, I., Franzoni, F. & Moussawi, R. (2018). Do ETFs Increase Volatility? *Journal of Finance*, 73(6), 2471-2535.

### 보조 참고문헌 (Supporting References)

12. Edelen, R.M. & Warner, J.B. (2001). Aggregate Price Effects of Institutional Trading. *Journal of Financial Economics*, 59(2), 195-220.

13. Madhavan, A. (2016). *Exchange-Traded Funds and the New Dynamics of Investing*. Oxford University Press.

14. Lettau, M. & Madhavan, A. (2018). Exchange-Traded Funds 101 for Economists. *Journal of Economic Perspectives*, 32(1), 135-154.

15. Pan, K. & Zeng, Y. (2017). ETF Arbitrage Under Liquidity Mismatch. *ESRB Working Paper*.

16. Glosten, L., Nallareddy, S. & Zou, Y. (2021). ETF Activity and Informational Efficiency of Underlying Securities. *Management Science*, 67(1), 22-47.

17. KRX (한국거래소). (2025). ETF 시장 통계 및 제도 안내. https://www.krx.co.kr

---

## 14. 통합 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ETF 생태계 신호 → 패턴 분석 통합                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [데이터 수집]              [분석 엔진]              [신호 출력]       │
│                                                                     │
│  KRX ETF 시세             레버리지 비율              etfSentiment    │
│  (pykrx / 크롤링)         Vol(Lev)/Vol(Inv)         greed~fear 4레짐│
│  → etf_daily.json         MA5/MA20 평활             역발상 신호     │
│  ↓                                                                  │
│  ETF 설정/환매            순설정액 흐름              etfFlow         │
│  Shares_out 변동          5d/20d 누적               inflow/outflow  │
│  → netCreation            총량 + 섹터별             섹터 회전 연동   │
│  ↓                                                                  │
│  iNAV / 괴리율            프리미엄/디스카운트         etfPremium      │
│  KRX 10초 공시            지속성 + 수렴성            수급 방향 신호   │
│  → premium_pct            교차 ETF 비교             국제 FX 프록시  │
│  ↓                                                                  │
│  ETF 보유 비중            Grade A/B/C/D             etfOwnership    │
│  (DART 분기 공시)         보유비중별 분류            reliabilityMult │
│  → etf_ownership.json     R² 분해                  per-stock       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │  패턴 신뢰도 = base                                       │      │
│  │              × ycRegimeMult     (Doc 35: 0.85~1.05)       │      │
│  │              × creditMult       (Doc 35: 0.85~1.02)       │      │
│  │              × ddMult           (Doc 35: 0.70~1.15)       │      │
│  │              × rateBetaMult     (Doc 35: 0.90~1.05)       │      │
│  │              × etfRegimeMult    (본 문서: 0.85~1.10)       │      │
│  │              × etfOwnershipMult (본 문서: 0.70~1.00)       │      │
│  │  합산 범위: clamp(0.50, 1.30)                              │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
│  보조 교차 분석:                                                      │
│  - 레버리지 리밸런싱 종가 효과 (§3.2 → Doc 27 §3.2 교차)             │
│  - 지수 편입/편출 이벤트 효과 (§5.3 → Doc 20 §4 교차)                │
│  - 국제 ETF FX 센티먼트 (§6.4 → Doc 28 §4.1 교차)                   │
│  - 섹터 ETF 흐름-경기순환 (§10.3 → Doc 29 §1.2 교차)                 │
│  - ETF 유동성 불일치 (§11.1 → Doc 34 §2 VRP 교차)                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

*본 문서는 CheeseStock 프로젝트의 ETF 생태계 분석 이론적 기반을 제공한다.*
*Doc 28(교차시장), Doc 29(섹터 회전), Doc 20(KRX 구조), Doc 27(선물/프로그램 매매)의*
*ETF 관련 내용을 심화·확장하며, 레버리지 비율 센티먼트, 자금흐름 분석, 괴리율 신호,*
*ETF 보유 비중별 패턴 신뢰도 보정이 개별 종목 기술적 분석에*
*어떻게 매핑되는지를 명시한다.*
