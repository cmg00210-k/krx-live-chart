# 20. KRX 구조적 이상 — KRX Structural Anomalies

> 한국거래소(KRX)의 고유 구조가 기술적 패턴의 형성과 소멸에 미치는 영향을 분석한다.
> 가격제한, 결제제도, 투자자 구성, 서킷브레이커가 패턴 정확도를 어떻게 왜곡하는지 정량화한다.

---

## 1. KRX 시장 구조 개요 (Market Structure Overview)

한국거래소(KRX)는 KOSPI(유가증권)와 KOSDAQ(코스닥) 두 시장으로 구성된다.

| 항목 | KOSPI | KOSDAQ |
|------|-------|--------|
| 종목 수 | ~939 | ~1,785 |
| 거래 시간 | 09:00-15:30 KST | 09:00-15:30 KST |
| 가격제한폭 | ±30% | ±30% |
| 결제 주기 | T+2 | T+2 |
| 외국인 보유 | ~31-36% (2025) | ~10% (2025) |
| 개인 투자자 비중 | ~30-40% | ~60-91% |

금융 적용: `backtester.js` line 147-152의 `marketType` (KOSDAQ=1, KOSPI=0)가 LinUCB 컨텍스트에서 시장 구분을 반영한다.

---

## 2. 가격제한폭 ±30% (Price Limits)

### 2.1 마그넷 효과 (Magnet Effect)

가격이 제한폭에 근접할수록 거래가 가속화되는 현상.

```
P(limit_hit | price_near_limit) >> P(limit_hit | price_far)
```

Du, Liu & Rhee (2009) KRX 고빈도 데이터 분석:
- 제한폭 접근 시 거래량, 변동성, 주문흐름 모두 가속
- 시장가 주문 비중 증가 (대기 주문 → 시장가 전환)
- 제한폭 10-15분 전부터 기술적 패턴 왜곡 시작

### 2.2 절단 수익률 분포 (Truncated Returns)

```
r_t = max(-0.30, min(0.30, r_t*))
```

가격제한은 수익률의 꼬리를 인위적으로 절단한다:
- Hill 추정량(α)이 과대평가됨 (실제보다 가벼운 꼬리로 추정)
- ATR이 과소추정됨 (제한폭 도달 시 true range가 절단)

금융 적용: `patterns.js` line 428-436의 Hill alpha → dynamic ATR cap에서 가격제한 효과를 고려해야 한다.

### 2.3 제한폭 조정 ATR

```
ATR_adj = ATR / (1 - P(limit_hit))
```

참고문헌:
- Du, Y., Liu, Q. & Rhee, G. (2009). An Anatomy of the Magnet Effect. *International Review of Finance*, 9(1).
- Yoo, J. & Lee, J. (2023). Price Limit Expansion, Volatility Reversal, and Magnet Effect. SSRN.
- Cho, D.D. et al. (2003). The Magnet Effect of Price Limits. *JFE*, 68(3).

---

## 3. T+2 결제 제도 (Settlement System)

### 3.1 결제 유동성 갭

```
L_avail(t) = L_total - sum(V_{t-2:t} * (1 - settle_rate))
```

T+2 결제는 거래일로부터 2영업일 후 현금/증권 결제를 의미한다:
- Day 0 (거래일): 방향성 이동, 현금 미결제
- Day 1-2 (결제 대기): 기술적 패턴이 결제 압력에 의해 왜곡
- 만기일(3째 금요일) + T+2 상호작용: 추가 변동성

### 3.2 T+1 전환 논의

KCMI (2024): 미국 T+1 전환(2024.05) 이후 한국도 검토 중이나, 시스템 자동화 비용으로 즉시 전환은 불필요하다는 판단.

참고문헌:
- Kang, S.H. et al. (2024). Impacts of Shortened Settlement Cycle. KCMI Research.

---

## 4. 외국인 투자자 흐름 (Foreign Investor Flows)

### 4.1 보유 현황 (2025)

| 지표 | 수치 |
|------|------|
| KOSPI 외국인 보유 | 30.8-35.9% (2025 말) |
| 보유 금액 | 1,326.8조원 ($918.9B) |
| KOSDAQ 외국인 보유 | ~10.3% |
| 미국 투자자 비중 | 546조원 (전체 외국인의 41%) |

### 4.2 외국인 흐름 영향 회귀

```
r_t = alpha + beta_f * FF_t + beta_d * DF_t + epsilon
```

여기서 FF_t = 외국인 순매수, DF_t = 국내 순매수.

지정학적 이벤트 시 외국인 매도가 기술적 패턴을 무력화한다:
- 2026.03.04: KOSPI -12% (2008 이후 최대 일일 하락)
- 외국인 매도 시 기술적 패턴 정확도 40% 하락

금융 적용: `backtester.js`의 LinUCB 컨텍스트에 외국인 순매수 차원 추가 가능.

참고문헌:
- Kang, J.-K. & Stulz, R. (1997). Why Is There a Home Bias? *JFE*, 46(1).
- Choe, H., Kho, B.-C. & Stulz, R. (1999). Do Foreign Investors Destabilize Stock Markets? *JFE*, 54(2).

---

## 5. KOSDAQ 개인투자자 집중 (Retail Concentration)

### 5.1 개인 투자자 특성

KOSDAQ 거래대금의 60-91%가 개인 투자자:
- 2025.01-10: 개인 순매수 6.2조원
- 기관 순매도 1.4조원, 외국인 순매도 1.8조원
- 한국 인구의 30%가 주식 거래 참여 (약 1,500만 명)

### 5.2 소매 투자자 증폭 인자

```
A = (1 + phi * retail_fraction)
```

여기서 phi = 군집행동 계수 (한국 ~0.35-0.45, 미국 ~0.10-0.15).

개인 지배 시장의 기술적 패턴 특성:
- 정수 가격대 지지/저항 강화 (닻 효과)
- 처분효과로 인한 비대칭 매도 압력
- 기술적 지표 추종 → 자기실현적 패턴 → 패턴 반감기 단축

참고문헌:
- Park, J., Kang, J. & Lee, S. (2025). Retail Investor Heterogeneity in Korean Stock Market. SSRN.

---

## 6. 서킷브레이커와 사이드카 (Circuit Breakers)

### 6.1 현행 규칙 (2026년 기준)

| 유형 | 발동 조건 | 조치 |
|------|----------|------|
| 매도 사이드카 | KOSPI200 선물 -5% (1분 지속) | 프로그램매매 5분 중단 |
| 서킷브레이커 1단계 | KOSPI -8% (1분 지속) | 20분 거래 중단 |
| 서킷브레이커 2단계 | KOSPI -15% | 20분 거래 중단 |
| 서킷브레이커 3단계 | KOSPI -20% | 당일 거래 종료 |
| 변동성 완화장치 (VI) | ±2-6% (종목별) | 2분 단일가 매매 |

### 6.2 서킷브레이커 갭 모형

```
P_reopen = P_halt * (1 + gamma * sgn(excess_demand))
```

20분 중단은 기술적 모멘텀을 완전히 리셋한다:
- 재개 시 갭 이동으로 이전 기술적 신호 무효화
- 거래량 지표(OBV 등) 인위적 불연속
- 이동평균이 갭에 의해 왜곡

최근 발동: 2026.03.09 서킷브레이커 + KOSDAQ 사이드카 동시 발동.

참고문헌:
- Subrahmanyam, A. (1994). Circuit Breakers and Market Volatility. *JF*, 49(1).
- Wong, D. & Kong, A. (2020). The Magnet Effect of Circuit Breakers. *Pacific-Basin Finance Journal*.

---

## 7. 공시 타이밍 효과 (Disclosure Timing)

### 7.1 비정상 수익률

```
AR_t = r_t - E[r_t | market_model]
CAR = sum(AR_t)   (이벤트 윈도우 내 누적)
```

KRX 장중(09:00-15:30) 공시는 즉각적 가격 반응을 유발:
- 장 전 공시: 시초가 갭
- 장중 공시: VI 발동 후 조정
- 장 후 공시: 익일 시초가 갭

기술적 패턴은 갭 없는 연속 가격을 가정하므로, 공시 갭으로 주 2-3회 패턴 무효화.

---

## 8. 시장 미시구조 (Market Microstructure)

### 8.1 호가 단위 (Tick Size)

| 가격대 | 호가 단위 |
|--------|----------|
| ≤1,000원 | 1원 |
| 1,000-5,000원 | 5원 |
| 5,000-10,000원 | 10원 |
| 10,000-50,000원 | 50원 |
| 50,000-100,000원 | 100원 |
| 100,000-500,000원 | 500원 |
| ≥500,000원 | 1,000원 |

호가 단위 변화는 정수 가격대에서 인위적 지지/저항을 생성한다.

### 8.2 무작위종료(RE) 메커니즘

Eom et al. (2021): 조건부 무작위종료가 시가에서 가격 안정화를 촉진하나, 종가에서 가격 과사(overshooting)를 유발.

금융 적용: 장 시작 5분 + 마지막 30분은 기술적 신호 신뢰도 저하.

참고문헌:
- Eom, K.S. et al. (2021). Effectiveness of the Conditional Random-End Trading Mechanism at KRX. *Journal of Financial Markets*, 49.

---

## 9. 달력 효과 (Calendar Anomalies)

### 9.1 월말 효과 (Turn-of-Month)

Park & Byun (2022): KOSDAQ에서 유의한 TOM 효과 확인.
- 월말 3일 + 월초 2일: 비정상 수익률 5-7배
- **핵심**: 개인/기관이 아닌 **외국인 순매수**가 주도

### 9.2 연초 효과 (January Effect)

20개 시장 비교 연구: 13개 시장에서 1월 효과 소멸 (2010년대 이후).
학술 공개 → 차익거래 → 이상현상 소멸의 전형적 사례.

### 9.3 만기일 효과

Park et al. (2004): 일별 데이터에서는 만기일 효과 미미하나, **분별 데이터**에서 유의한 효과:
- 최후 10분: KOSPI200 구성종목 비정상 거래량 급증
- 익일: 통계적으로 유의한 가격 반전

---

## 10. 기술적 패턴에 미치는 종합 영향 (Impact on Patterns)

| KRX 구조 | 패턴 왜곡 | 신뢰도 조정 |
|----------|----------|-----------|
| 가격제한 ±30% | 마그넷 효과로 거짓 돌파 | 제한폭 15분 전 신호 비활성화 |
| T+2 결제 | Day 2 반전 패턴 생성 | 결제일 인근 신뢰도 감소 |
| 외국인 매도 | 기술적 패턴 무력화 | 지정학 이벤트 시 -40% 신뢰도 |
| KOSDAQ 개인 집중 | 자기실현적 패턴 + 빠른 소멸 | 패턴 반감기 1-2년 |
| 서킷브레이커 | 모멘텀 리셋, 갭 무효화 | 발동 후 모든 신호 무효 |
| RE 메커니즘 | 시초가/종가 과사 | 장 중간(10:00-15:00)만 신뢰 |
| 만기일 | 최후 30분 비정상 거래량 | 3째 금요일 마지막 30분 신호 비활성화 |

---

## 핵심 정리: KRX 구조와 기술적 분석의 매핑

| 이론/구조 | KRX 적용 | JS 코드 연결 |
|----------|---------|-------------|
| 마그넷 효과 | 가격제한 접근 시 거짓 돌파 | `patterns.js` ATR cap 조정 |
| 결제 유동성 | T+2 정산 압력 | `backtester.js` 비용 모델 |
| 외국인 흐름 | 지정학 리스크 | LinUCB 컨텍스트 확장 후보 |
| 소매 집중 | 군집행동 증폭 | `signalEngine.js` 감정 가중치 |
| 서킷브레이커 | 모멘텀 단절 | 발동 시 패턴 무효화 로직 |
| 호가 단위 | 정수가 지지/저항 | `patterns.js` S/R 탐지 |
| 달력 효과 | TOM 외국인 주도 | 월말 신뢰도 조정 |

---

## 참고문헌

1. Du, Y., Liu, Q. & Rhee, G. (2009). An Anatomy of the Magnet Effect. *IRF*, 9(1).
2. Yoo, J. & Lee, J. (2023). Price Limit Expansion. SSRN:4545501.
3. Cho, D.D. et al. (2003). The Magnet Effect of Price Limits. *JFE*, 68(3).
4. Kang, S.H. et al. (2024). Shortened Settlement Cycle Impacts. KCMI.
5. Kang, J.-K. & Stulz, R. (1997). Why Is There a Home Bias? *JFE*, 46(1).
6. Choe, H. et al. (1999). Foreign Investors. *JFE*, 54(2).
7. Park, J. et al. (2025). Retail Investor Heterogeneity. SSRN.
8. Subrahmanyam, A. (1994). Circuit Breakers. *JF*, 49(1).
9. Wong, D. & Kong, A. (2020). Magnet Effect of Circuit Breakers. *PBFJ*.
10. Eom, K.S. et al. (2021). Random-End Trading at KRX. *JFM*, 49.
11. Park, S. & Byun, S.J. (2022). Turn-of-Month in KOSDAQ. *JDQS*, 30(4).
12. Park, C.G. et al. (2004). Expiration Day Effect. *KDI Journal*.
13. Kim, K.A. & Rhee, S.G. (1997). Price Limit Performance. *JF*, 52(2).
14. Yildiz, S. et al. (2018). KRX Price Limit Effects. arXiv:1805.04728.
