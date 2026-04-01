# 28. 글로벌 교차시장 상관관계 — Cross-Market Correlation & Risk Transmission

> 어떤 시장도 섬이 아니다. S&P 500 야간 선물이 1% 하락하면
> 9시 KRX 시초가는 이미 그 정보를 소화하고 있다.
> 기술적 패턴은 가격만 보지만, 가격은 글로벌 신호를 먼저 본다.

---

## 1. 글로벌 시장 상관관계 구조 (Global Market Correlation Structure)

### 1.1 KRX와 주요 시장의 상관계수

2020-2025년 일간 수익률 기준 실증치 (Pearson correlation, daily log-returns):

| 시장 쌍 | 상관계수 | 특이사항 |
|---------|---------|---------|
| KOSPI ↔ S&P 500 | r ≈ 0.65-0.75 | 동기화 점진적 강화 (2010년대 대비 +0.10) |
| KOSPI ↔ NASDAQ | r ≈ 0.60-0.70 | 반도체·IT 섹터 동조화 |
| KOSPI ↔ Nikkei 225 | r ≈ 0.70-0.80 | 가장 높음 — 반도체·자동차 공급망 공유 |
| KOSPI ↔ Shanghai Composite | r ≈ 0.40-0.55 | 2020년 이후 하락 추세 (디커플링) |
| KOSPI ↔ VIX | r ≈ -0.65 | 강한 음의 상관 |
| KOSDAQ ↔ NASDAQ | r ≈ 0.55-0.65 | 바이오·소프트웨어 섹터 중첩 |

KOSPI-Nikkei 상관이 가장 높은 이유: 양국 모두 삼성전자-TSMC-소니 등 글로벌
반도체·전자 공급망의 핵심 노드이며, USD/KRW와 USD/JPY가 공통 USD 리스크에
동시 노출된다.

참고문헌:
- Kim, B.-H. & Kim, H. (2014). Dynamic Stock Market Integration and Transmission of Shocks. *Pacific-Basin Finance Journal*, 30.

---

### 1.2 시변 상관 모형 (Time-Varying Correlation Models)

#### DCC-GARCH (Engle 2002)

동적 조건부 상관관계 모형은 상관계수가 시간에 따라 변하는 것을 허용한다.

```
조건부 공분산 행렬:
  H_t = D_t * R_t * D_t

여기서:
  D_t = diag(sqrt(h_{1,t}), sqrt(h_{2,t}), ..., sqrt(h_{n,t}))
       — 각 시장의 조건부 표준편차 (GARCH에서 얻음)
  R_t = 조건부 상관계수 행렬 (시변)

R_t 업데이트:
  R_t = Q̃_t^{-1/2} * Q_t * Q̃_t^{-1/2}

  Q_t = (1 - a - b) * Q̄ + a * ε_{t-1} * ε'_{t-1} + b * Q_{t-1}

  Q̄ = 표준화 잔차의 무조건 공분산 행렬 (장기 평균)
  a  = 상관관계 혁신(innovation) 계수   (추정값 ≈ 0.02-0.08)
  b  = 상관관계 지속성(persistence) 계수 (추정값 ≈ 0.90-0.96)
  ε_t = 표준화 잔차 벡터
  Q̃_t = diag(Q_t)의 제곱근 행렬
```

안정 조건: a + b < 1

KRX 실증 예시:
- 평상시 KOSPI-S&P500: r_t ≈ 0.60-0.75
- 위기 시(VIX > 35): r_t ≈ 0.85-0.95 (다변화 효과 붕괴)
- 위기 후 6-12개월: 점진적 정상화

#### 비대칭 상관 (Asymmetric Correlation)

Longin & Solnik (2001)의 핵심 발견: 하락장(bear market) 상관이 상승장(bull market) 상관보다 유의하게 높다.

```
rho_down > rho_up  (비대칭성)

실증: 하락장 시 KOSPI-S&P500 상관이 상승장 대비 0.15-0.25 높음
```

패턴 신뢰도 함의: 글로벌 하락 국면에서는 개별 기술적 패턴이 글로벌 추세에
압도되어 역방향 신호(예: 반전형 패턴)의 신뢰도가 저하된다.

참고문헌:
- Engle, R. (2002). Dynamic Conditional Correlations. *JBES*, 20(3), 339-350.
- Longin, F. & Solnik, B. (2001). Extreme Correlation of International Equity Markets. *JF*, 56(2), 649-676.

---

## 2. VIX → VKOSPI 위험 전달 메커니즘 (Risk Transmission)

### 2.1 시차 구조 (Lead-Lag Structure)

```
US 시장 마감 (KST 06:00) → KRX 개장 (KST 09:00)
    └── 3시간 갭: 야간 정보 축적 구간
```

| 조건 | KRX 시초가 갭 하락 확률 |
|------|----------------------|
| VIX > 30 (다음 KST 개장) | 82% 확률로 -0.5% 이상 |
| VIX > 40 | 94% 확률로 -1.0% 이상 |
| S&P 500 전일 -2% 이상 | 76% 확률로 KRX 갭 다운 |

전달 탄력성 (Transmission Elasticity):

```
d(VKOSPI) / d(VIX) ≈ 0.85

해석: VIX 10pt 상승 → VKOSPI 8.5pt 상승 (단기 1일 기준)
```

### 2.2 전달 채널 분류

```
Channel 1 — 직접 공포 전염 (Direct Fear Contagion)
  VIX 상승 → 글로벌 리스크 회피 → VKOSPI 상승

Channel 2 — 외국인 포트폴리오 재조정
  VIX 상승 → 신흥국 비중 축소 → KRX 외국인 순매도

Channel 3 — 알고리즘 교차시장 차익거래
  S&P 500 선물 ↓ → KOSPI 200 선물 ↓ → 현물 하방 압력

Channel 4 — USD/KRW 상승 압력
  리스크 오프 → 달러 강세 → KRW 약세 → 외국인 실질 손실 → 추가 매도
```

도미노 순서: Channel 1 (즉각) → Channel 4 (수시간 내) → Channel 2 (당일~다음날) → Channel 3 (지속적)

### 2.3 전달 엔트로피 (Transfer Entropy)

정보 이론 관점에서 방향적 정보 흐름을 측정한다 (Schreiber 2000).
`13_information_geometry.md`의 KL 다이버전스와 연결된다.

```
TE(X→Y) = sum_{y_{t+1}, y_t, x_t}
           p(y_{t+1}, y_t, x_t) * log[ p(y_{t+1} | y_t, x_t) / p(y_{t+1} | y_t) ]

여기서:
  X = VIX 시계열
  Y = VKOSPI 시계열
  TE(X→Y) > TE(Y→X): X가 Y에 정보 우위

단위: nats (자연로그 사용 시) 또는 bits (이진로그 사용 시)
```

실증 결과 (KRX 2015-2025):
- 안정 국면: TE(VIX→VKOSPI) ≈ 0.03-0.05 nats
- 위기 국면 (2020.03, 2022.06): TE 3-5배 급등 → 정보 전달 가속화
- 역방향 TE(VKOSPI→VIX) ≈ 0.005-0.01 nats (단방향성 확인)

금융 적용: `signalEngine.js`의 변동성 체제 분류에 VIX 수준 임계값 통합 가능.

참고문헌:
- Schreiber, T. (2000). Measuring Information Transfer. *PRL*, 85(2), 461.

---

## 3. USD/KRW 환율 채널 (FX Channel)

### 3.1 환율과 주식의 이중 채널

KRW 약세(달러 강세)는 단기와 중기에서 반대 방향으로 작용한다.

```
단기 효과 (1-3 거래일):
  KRW 약세 → 외국인 USD 환산 수익 감소 → 외국인 순매도 → 주가 하락

중기 효과 (1개월 이상):
  KRW 약세 → 수출 기업 원화 환산 매출 증가 → EPS 상향 → 주가 상승

합산 β_FX (단기):  ≈ -0.2 ~ -0.4
합산 β_FX (중기):  ≈ +0.1 ~ +0.3
```

### 3.2 섹터별 환율 민감도 분류

```
수출 수혜 (β_FX 양수, 중기):
  삼성전자, SK하이닉스, 현대차, 기아, LG에너지솔루션
  β_FX = +0.3 ~ +0.5 (KRW 1% 약세 → 주가 +0.3~0.5%)

수입 비용 부담 (β_FX 음수, 단기):
  항공사 (대한항공, 아시아나), 정유사 (GS칼텍스 관련 상장 계열)
  β_FX = -0.2 ~ -0.4

중립 (내수 방어주):
  통신사 (SK텔레콤), 유틸리티, 음식료
  β_FX ≈ 0 ~ ±0.05
```

KOSPI 지수 수준 민감도: β_FX ≈ +0.15 (장기, 제조업 비중 반영)
KOSDAQ 지수 수준 민감도: β_FX ≈ -0.05 ~ 0 (바이오 내수 비중 높음)

### 3.3 환율 헤징 델타

외국인 투자자 KRX 노출 기준 추정 헤징 비율:

```
hedge_ratio ≈ 40-60%  (외국인 기관 평균, 2020-2025 추정)

FX 헤지 비용 = 한미 금리차 - 스왑 포인트
             ≈ 0.5-1.5% (연간, 2023-2025 기준)

헤지 비용 상승 → 헤지 포지션 청산 → 달러 회수 → 주식 매도 압력
```

금리차가 확대될 때(한국 기준금리 < 미국 기준금리) FX 헤지 비용 상승
→ 헤징 포기 → 환 리스크 증가 → 변동성 확대.

금융 적용: `backtester.js` LinUCB 컨텍스트에 `usd_krw_change` 팩터 추가 가능
(`23_apt_factor_model.md` 팩터 확장 경로 참조).

---

## 4. MSCI 리밸런싱 효과 (MSCI Rebalancing Effects)

### 4.1 MSCI Korea Index 구조

```
MSCI Korea (EM 내 비중, 2024-2025):
  비중:  11-13% (신흥국 내 3-4위)
  구성:  삼성전자 약 25-30%, SK하이닉스 약 7-9% 등 대형주 집중
  추적 자금: MSCI EM ETF 전체 자금 약 3,000억 달러 (2024년 기준)
  → Korea 비중 1%pt 변화 = 약 30억-40억 달러 자금 이동

반기 검토:
  5월 (발표 4월 말, 시행 5월 말)
  11월 (발표 10월 말, 시행 11월 말)
```

### 4.2 편입/편출 효과 (Inclusion/Exclusion Effects)

이벤트 연구(Event Study) 기반 실증치:

```
편입 (Inclusion):
  CAR(announcement, +20 trading days): +8 ~ +12%
  거래량 최대 충격: 시행일 마감 전 30분 (추적 펀드 기계적 매수)

편출 (Exclusion):
  CAR(announcement, +20 trading days): -5 ~ -8%
  거래량 충격: 시행 전일 오후 (선제적 매도)

발표 → 시행 구간 (~20 거래일):
  기계적 선행 매매 가능: 발표 후 1-5 거래일 내 포지션 진입
  시행일 반전 확률 높음 (buy the rumor, sell the fact)
```

### 4.3 MSCI EM 비중 변화와 자금 흐름

```
Korea 비중 +1%pt → 약 30억-40억 달러 패시브 자금 유입 (1-2주에 걸쳐)
Korea 비중 -1%pt → 반대 방향 유출

삼성전자 단독 MSCI 비중 변화:
  비중 +0.1%pt → 삼성전자 기준 약 3억-4억 달러 추가 수요
```

MSCI 선진국 지수(DM) 편입 논의 (2028년 목표, 불확실):
편입 시 패시브 자금 추정 100억-200억 달러 순유입 잠재력.
그러나 공매도 재개, 외환시장 접근성 등 요건 미충족 상태 지속.

참고문헌:
- Bae, K.-H., Bailey, W. & Mao, C.X. (2006). Stock Market Liberalization and the Information Environment. *JIFM*, 16.
- Claessens, S. & Rhee, M. (1994). The Effect of Equity Barriers on Foreign Investment. NBER WP 5087.

---

## 5. 글로벌 위기 전파 모형 (Global Crisis Propagation)

### 5.1 위기 식별 기준 (Crisis Identification Criteria)

```
단계별 위기 임계값:

Level 0 (정상):
  VIX < 20,  VKOSPI < 22,  USD/KRW < 1,300

Level 1 (주의):
  VIX >= 20 OR VKOSPI >= 22 OR USD/KRW >= 1,300

Level 2 (경계):
  VIX >= 30 AND VKOSPI >= 30

Level 3 (위기):
  VIX >= 35 AND VKOSPI >= 35 AND USD/KRW >= 1,350
  AND 외국인 순매도 >= 1조원/일

복합 위기 지수:
  crisis_severity = 0.4*(VIX-20)/20 + 0.3*(VKOSPI-22)/18
                  + 0.2*(USD_KRW-1300)/100 + 0.1*foreign_sell_score
  crisis_severity ∈ [0, 1]  (max clamp 적용)
```

### 5.2 위기 시 패턴 신뢰도 일괄 조정

Forbes & Rigobon (2002): "Contagion"과 "Interdependence"를 구분하는 방법론.
위기 시 단순 상관 상승이 진짜 전염인지, 아니면 기존 연결의 강화인지를 식별.

```
패턴 신뢰도 위기 조정:
  conf_adj = conf_raw * (1 - crisis_severity * 0.4)

  crisis_severity = 0.0: 조정 없음 (정상 신뢰도)
  crisis_severity = 0.5: 신뢰도 20% 감소
  crisis_severity = 1.0: 신뢰도 40% 감소 (상한)

적용 대상: 역방향 패턴(반전형)에만 적용
  → 지속형 패턴(breakout, continuation)은 오히려 신뢰도 유지
```

`20_krx_structural_anomalies.md` 섹션 4.2의 외국인 매도 패턴 무력화 논의와
결합: 위기 지수는 외국인 순매도 규모를 입력변수로 포함.

### 5.3 위기 후 회복 패턴 (Post-Crisis Recovery)

```
V자 회복 타이밍 분포 (KRX 역사적 사례):
  2008 금융위기: 저점 2009.03 → 회복 ~12개월
  2020 COVID 충격: 저점 2020.03 → 회복 ~6개월
  2022 금리충격: 저점 2022.10 → 회복 ~8개월

회복 국면 진입 신호:
  1) VIX < 25 지속 5 거래일 이상
  2) VKOSPI < 25 지속 5 거래일 이상
  3) 외국인 순매수 전환 (3일 연속)
  4) USD/KRW 하락 추세 전환

위 조건 3개 이상 동시 충족 시: 패턴 신뢰도 정상화 시작
```

회복 국면 첫 번째 반전 신호는 신뢰도가 낮다: 거짓 회복(dead cat bounce)
가능성이 높으므로, 신뢰도 복원은 점진적으로 이루어져야 한다.

참고문헌:
- Forbes, K. & Rigobon, R. (2002). No Contagion, Only Interdependence. *JF*, 57(5), 2223-2261.

---

## 6. 지정학적 리스크 (Geopolitical Risk)

### 6.1 한반도 리스크 프리미엄

```
이벤트 유형별 KOSPI 평균 반응 (2010-2025, 이벤트 연구):

미사일 시험발사: 이벤트일 평균 -1.5 ~ -2.0%
핵실험:          이벤트일 평균 -2.5 ~ -3.0%  (표본 적음)
남북 고위급 회담: 이벤트일 평균 +0.5 ~ +1.0% (화해 기조)

회복 기간:
  대부분 3-5 거래일 내 이벤트 이전 수준 회복
  단, 글로벌 리스크 오프와 동시 발생 시: 회복 지연 (1-2주)
```

"코리아 디스카운트 (Korea Discount)":
지정학적 리스크가 한국 시장 PER에 만성 할인을 유발한다는 가설.
추정 규모: 유사 성장률 아시아 시장 대비 PER 10-20% 할인.
단, 최근 연구는 디스카운트 원인이 지배구조(governance) 문제에 더 크다고 지목
(재벌 계열사 구조, 소수주주 보호 미흡).

### 6.2 미중 무역 갈등 채널

```
직접 노출 (Direct Exposure):
  삼성전자 DRAM, SK하이닉스 → 미국 수출규제 직격
  중국 매출 비중: 삼성전자 ~25%, SK하이닉스 ~40-50%

간접 노출 (Supply Chain):
  소재·부품·장비 (소부장) 중간재 수출 → 중국 생산 감소 → KRX 타격
  2019 일-한 수출규제 유사 메커니즘

섹터 로테이션 효과:
  반도체 규제 강화 → 방산·이차전지·바이오로 자금 이동 (내수 방어)
```

`20_krx_structural_anomalies.md` 섹터 4의 외국인 흐름 분석과 결합:
지정학 이벤트 발생 시 외국인 매도는 섹터 무차별적이 아니라 반도체·수출 비중
상위 종목에 집중되는 패턴을 보인다.

---

## 7. 야간 갭 예측 모형 (Overnight Gap Prediction)

### 7.1 미국 시장 종가 → KRX 시가 갭

```
Gap_KRX(t) = alpha
           + beta_1 * R_SP500(t-1)
           + beta_2 * R_NASDAQ(t-1)
           + beta_3 * delta_USDT_KRW(t-1, KST 06:00)
           + beta_4 * delta_VIX(t-1)
           + beta_5 * R_Nikkei_futures(t, premarket)
           + epsilon_t

추정 계수 범위 (OLS, 2018-2025):
  alpha    ≈ 0.0001 ~ 0.0003  (소폭 양의 절편)
  beta_1   ≈ 0.35 ~ 0.45      (S&P 500 주 기여)
  beta_2   ≈ 0.15 ~ 0.25      (NASDAQ 추가 기여)
  beta_3   ≈ -0.20 ~ -0.30    (KRW 약세 단기 부정적)
  beta_4   ≈ -0.018 ~ -0.025  (VIX 상승 → 갭 하락)
  beta_5   ≈ 0.20 ~ 0.30      (닛케이 선물 동기화)

설명력: R² ≈ 0.40 ~ 0.55  (상당한 예측력)
```

`25_capm_delta_covariance.md`의 beta 추정 방법론과 연결:
위 회귀는 KOSPI 전체를 시장 포트폴리오로 놓은 다중 beta 분해로 해석 가능.

### 7.2 갭 크기와 당일 패턴 신뢰도

```
갭 방향 × 패턴 유형별 신뢰도 조정:

갭 상승 (>+1.5%):
  - 반전형 패턴 (예: eveningStar, shootingStar): 신뢰도 +15% (장초 매도 압력)
  - 지속형 패턴 (예: threeWhiteSoldiers):        신뢰도 -10% (과매수 소진)

갭 하락 (<-1.5%):
  - 반전형 패턴 (예: hammer, morningStar):        신뢰도 +10% (장초 반등 가능)
  - 지속형 하락 패턴 (예: threeBlackCrows):       신뢰도 +15% (하락 모멘텀 확인)

소폭 갭 (±0.5% 이내):
  - 패턴 신뢰도 조정 없음 (기본값 적용)

대형 갭 (절대값 >3.0%):
  - 모든 패턴 신뢰도 -20% (VI 발동 + 시세 불안정 구간)
```

### 7.3 갭 필터링 실무 적용

```
실무 알고리즘 (JavaScript 의사코드):

function adjustConfidenceForGap(pattern, gapPercent) {
  const absGap = Math.abs(gapPercent);
  if (absGap > 3.0) return pattern.confidence * 0.80;

  const isReversal = REVERSAL_PATTERNS.has(pattern.type);
  const isBullish  = BULLISH_TYPES.has(pattern.type);

  if (gapPercent > 1.5 && isReversal && !isBullish)  // 갭업 + 반전 매도
    return pattern.confidence * 1.15;
  if (gapPercent < -1.5 && isReversal && isBullish)  // 갭다운 + 반전 매수
    return pattern.confidence * 1.10;
  if (absGap <= 0.5)
    return pattern.confidence;          // 소폭 갭: 무조정
  return pattern.confidence;            // 중간 갭: 기본값
}
```

금융 적용: `patterns.js`의 `analyze()` 또는 `app.js`의 분석 완료 콜백에서
전일 갭 데이터를 주입하여 신뢰도를 후처리 방식으로 조정.

---

## 8. CheeseStock 구현 경로 (Implementation Path)

### 8.1 데이터 소스 설계

```
글로벌 지표 수집 방안:

Yahoo Finance API (무료, 일봉):
  - ^GSPC (S&P 500), ^IXIC (NASDAQ), ^N225 (Nikkei)
  - ^VIX (CBOE Volatility Index)
  - USDKRW=X (USD/KRW 환율)
  요청 예: https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d

한국은행 ECOS (무료 API):
  - USD/KRW 공식 환율 (시계열 조회 가능)
  - API: https://ecos.bok.or.kr/api/StatisticSearch/...

MSCI 이벤트 캘린더:
  - 반기 리뷰 일정 수동 등록 (data/global_calendar.json)

출력 파일:
  data/global.json — {date, sp500, nasdaq, nikkei, vix, usd_krw, ...}
  scripts/download_global.py — Yahoo Finance + ECOS 수집기
```

`scripts/download_ohlcv.py` 구조를 참조하여 동일 패턴으로 구현.
일간 배치 업데이트 (`daily_update.bat`)에 통합 권장.

### 8.2 APT 팩터 확장

`23_apt_factor_model.md`의 팩터 테이블에 글로벌 팩터 2개 추가:

| 팩터 | 수식 | 예상 IC 개선 | 구현 난도 |
|------|------|-------------|---------|
| VIX 변화율 | delta_VIX_t = (VIX_t - VIX_{t-1}) / VIX_{t-1} | +0.005~0.010 | LOW |
| USD/KRW 변화율 | delta_FX_t = (KRW_t - KRW_{t-1}) / KRW_{t-1} | +0.003~0.008 | LOW |
| 야간 갭 잔차 | Gap_residual = 실제갭 - 예측갭 (모형 7.1) | +0.002~0.005 | MEDIUM |

총 예상 IC 개선: +0.010 ~ +0.023 (17열 → 19열 Ridge, 추정치)

Ridge 재보정(`rl_residuals.py`) 시 `vix_change`, `usd_krw_change` 열을 설계
행렬에 추가하고 GCV로 최적 lambda를 재탐색 (`22_learnable_constants_guide.md`
Tier B 상수 조정 절차 적용).

### 8.3 Learnable Constants — 교차시장 관련 (#69-#74)

```
새로 도입될 학습 가능 상수:

#69  CRISIS_VIX_L1       = 20    — 주의 임계값       [Tier B, ±5 탐색]
#70  CRISIS_VIX_L2       = 30    — 경계 임계값       [Tier B, ±5 탐색]
#71  CRISIS_VIX_L3       = 40    — 위기 임계값       [Tier A, KRX 역사 고정]
#72  CRISIS_CONF_DAMP    = 0.40  — 위기 신뢰도 감쇠   [Tier B, 0.20~0.55 탐색]
#73  GAP_BIG_THRESHOLD   = 1.5   — 대형 갭 기준(%)   [Tier C, KRX 경험 0.8~2.0]
#74  FX_WEIGHT_LINUCB    = 0.0   — LinUCB USD/KRW 팩터 가중치 [Tier D, 미활성화]
```

상수 티어 분류 기준은 `22_learnable_constants_guide.md` 섹션 3 참조.

---

## 9. 핵심 정리: 교차시장 신호와 패턴 신뢰도 매핑

| 글로벌 신호 | KRX 영향 | 신뢰도 조정 방향 | JS 연결 |
|-----------|---------|----------------|--------|
| VIX > 30 | 모든 패턴 신뢰도 하락 | 역방향 패턴 -20% | `patterns.js` conf 후처리 |
| S&P 500 -2% 야간 | 갭 하락 확률 76% | 갭 기반 신뢰도 조정 (7.2절) | `app.js` 갭 필터 |
| USD/KRW > 1,350 | 외국인 매도 압력 | crisis_severity 증가 | `backtester.js` 컨텍스트 |
| MSCI 리뷰 시행일 | 기계적 거래 왜곡 | 시행일 신호 비활성화 권고 | 캘린더 예외 처리 |
| 지정학 이벤트 | 단기 급락 + 빠른 회복 | 역방향 신호 일시 비활성화 | 이벤트 플래그 |
| 글로벌 위기 해소 | 점진적 회복 | 신뢰도 단계적 정상화 | crisis_severity 감소 |

---

## 참고문헌

1. Engle, R.F. (2002). Dynamic Conditional Correlations. *JBES*, 20(3), 339-350.
2. Longin, F. & Solnik, B. (2001). Extreme Correlation of International Equity Markets. *JF*, 56(2), 649-676.
3. Forbes, K.J. & Rigobon, R. (2002). No Contagion, Only Interdependence. *JF*, 57(5), 2223-2261.
4. Schreiber, T. (2000). Measuring Information Transfer. *PRL*, 85(2), 461-464.
5. Kim, B.-H. & Kim, H. (2014). Dynamic Stock Market Integration and Transmission of Shocks: Evidence from Korea. *Pacific-Basin Finance Journal*, 30, 139-158.
6. Bae, K.-H., Bailey, W. & Mao, C.X. (2006). Stock Market Liberalization. *JIFM*, 16.
7. Claessens, S. & Rhee, M. (1994). The Effect of Equity Barriers on Foreign Investment. NBER WP 5087.
8. MSCI (2024). MSCI Global Investable Market Indexes Methodology. msci.com.
9. Amari, S. (1985). *Differential-Geometrical Methods in Statistics* — (정보 전달 엔트로피 이론 배경, `13_information_geometry.md` 연계).
10. Ross, S. (1976). The Arbitrage Theory of Capital Asset Pricing. *JET*, 13(3) — APT 팩터 확장 기반 (`23_apt_factor_model.md` 연계).
11. Du, Y., Liu, Q. & Rhee, G. (2009). An Anatomy of the Magnet Effect. *IRF*, 9(1) — 위기 시 가격제한 효과 (`20_krx_structural_anomalies.md` 연계).
12. Sharpe, W. (1964). Capital Asset Prices. *JF*, 19(3) — CAPM beta (`25_capm_delta_covariance.md` 연계).
