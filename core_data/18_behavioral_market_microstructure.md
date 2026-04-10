# 18. 행동 시장 미시구조 — Behavioral Market Microstructure

> 행동재무학(04_psychology.md)과 시장 미시구조를 결합하여, 주문흐름·스프레드·유동성이
> 기술적 패턴의 형성과 신뢰도에 미치는 영향을 분석한다.

---

## 1. 카일 모형과 행동적 에이전트 (Kyle Model with Behavioral Agents)

### 1.1 원형 카일 모형

Kyle (1985): 3유형 거래자 (내부자, 잡음거래자, 시장조성자).

```
delta_P = lambda * order_flow
lambda = sigma_v / (sigma_v + sigma_u)
```

sigma_v = 정보가치 변동성, sigma_u = 잡음거래량.

### 1.2 행동적 확장

손실회피 내부자(prospect theory, 04_psychology.md §1):

```
lambda_b = lambda * (1 + k * PI(loss_aversion))
```

위험회피적 내부자는 정보를 더 빠르게 이용하여 가격 수렴 가속.

금융 적용: `backtester.js` line 18-28의 `KRX_SLIPPAGE`는 Kyle lambda의 단순화.

참고문헌:
- Kyle, A.S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6).
- Grinblatt, M. & Han, B. (2004). Disposition Effect and Momentum. NBER WP 8734.

---

## 1A. Glosten-Milgrom (1985) 순차적 거래 모형

Kyle (1985)가 시장조성자의 가격발견(price discovery)과 가격 충격(lambda)에 초점을
맞추었다면, Glosten-Milgrom (1985)은 호가 스프레드(bid-ask spread)의 정보비대칭
분해에 초점을 맞춘다. 두 모형은 시장 미시구조의 양대 축이다.

### 1A.1 모형 구조

```
시장 참여자:
  - 정보거래자 (informed trader): 비율 mu, 자산 진가 V를 관측
  - 유동성거래자 (liquidity trader): 비율 1-mu, V를 모름
  - 경쟁적 시장조성자 (competitive market maker): 호가 설정

자산 진가: V = V_H (확률 pi) 또는 V = V_L (확률 1-pi)
  delta = V_H - V_L (정보의 가치)
```

경쟁적 시장조성자는 기대 손실 = 0 조건에서 호가를 설정한다:

```
매도 호가 (ask):
  ask = E[V | 매수 주문 관측]
      = V_H * Pr(V_H | buy) + V_L * Pr(V_L | buy)

매수 호가 (bid):
  bid = E[V | 매도 주문 관측]
      = V_H * Pr(V_H | sell) + V_L * Pr(V_L | sell)
```

베이즈 정리를 적용하면:

```
Pr(V_H | buy) = Pr(buy | V_H) * pi / Pr(buy)

  Pr(buy | V_H) = mu * 1 + (1-mu) * 0.5
    → 정보거래자는 V_H이면 반드시 매수, 유동성거래자는 50% 확률 매수

  Pr(buy) = pi * [mu + (1-mu)*0.5] + (1-pi) * [(1-mu)*0.5]
```

### 1A.2 스프레드 공식

단순화된 균형 스프레드:

```
spread = ask - bid = 2 * mu * delta

  mu: 정보거래자 비율 (0 < mu < 1)
  delta: V_H - V_L (정보의 가치)

직관:
  mu = 0 (정보거래자 없음) → spread = 0 (완전 유동적)
  mu → 1 (대부분 정보거래자) → spread → 2*delta (극대화)
  delta = 0 (정보 없음) → spread = 0
```

### 1A.3 Kyle vs Glosten-Milgrom 비교

| 차원 | Kyle (1985) | Glosten-Milgrom (1985) |
|------|------------|----------------------|
| 거래 방식 | 연속(batch auction) | 순차적(sequential) |
| 내부자 | 단일, 전략적 | 다수, 경쟁적 |
| 핵심 산출물 | 가격 충격 lambda | 호가 스프레드 spread |
| 정보 반영 | 점진적 (주문흐름 누적) | 순차적 베이지안 갱신 |
| 균형 유형 | 선형 균형 (lambda 고정) | 동적 (스프레드 수렴) |

### 1A.4 KRX 적용

```
KOSPI 대형주 (삼성전자, SK하이닉스):
  스프레드 ≈ 5-10 bps
  외국인 + 기관 비중 높음 → mu 상대적 높음
  그러나 경쟁적 유동성 공급 (LP 제도, HFT) → 스프레드 상쇄

KOSDAQ 소형주:
  스프레드 ≈ 50-100 bps
  개인투자자 지배 → mu 낮으나, 유동성 부족으로 스프레드 확대
  정보 비대칭보다 재고 위험(inventory risk)이 스프레드의 주 원인

패턴 분석 시사점:
  스프레드가 넓은 종목(KOSDAQ 소형)에서 패턴 신호의 실현 비용이 높음
  → backtester.js의 KRX_SLIPPAGE = 0.10%는 KOSPI 대형주 기준이므로
    KOSDAQ 소형주에서는 과소 추정 (§3.1 Amihud ILLIQ 참조)

  Glosten-Milgrom의 mu 추정은 tick-level 데이터가 필요하므로
  현재 OHLCV 기반 시스템에서는 직접 계산 불가 (§2 VPIN과 동일한 제약)
```

참고문헌:
- Glosten, L.R. & Milgrom, P.R. (1985). Bid, Ask and Transaction Prices in a
  Specialist Market with Heterogeneously Informed Traders. *JFE*, 14(1), 71-100.

---

## 2. 주문흐름 독성 측정 (Order Flow Toxicity — VPIN)

Easley, Lopez de Prado & O'Hara (2012):

```
VPIN = sum(|V_buy - V_sell|) / (n * V_bucket)
```

| VPIN 수준 | 해석 | 패턴 신뢰도 영향 |
|-----------|------|-----------------|
| < 0.70 | 정상 | 유지 |
| 0.70-0.85 | 상승 | -10% |
| 0.85-0.95 | 고독성 | -30% |
| > 0.95 | 플래시 크래시 위험 | 신호 무효 |

> **DATA REQUIREMENT WARNING:** VPIN (Easley et al., 2012)은 tick-level 거래 데이터와
> 매수/매도 분류(buy/sell classification, e.g., Lee-Ready algorithm)를 필요로 한다.
> OHLCV 데이터만으로는 계산이 불가능하며, 본 프로젝트에서는 향후 데이터 업그레이드
> (Koscom 실시간 체결 데이터 전환) 시 구현할 수 있는 목표(aspirational target)로
> 기재한다. 현재 유동성 측정은 Amihud ILLIQ(§3.1)로 대체한다.

참고문헌:
- Easley, D. et al. (2012). Flow Toxicity. *RFS*, 25(5).

---

## 3. 유동성 비대칭 (Liquidity Asymmetry)

### 3.1 Amihud 비유동성 비율

> **Canonical Definition (Amihud, 2002):**
> ILLIQ = (1/D) * sum_{d=1}^{D} |r_d| / Vol_d
> 여기서 D = 거래일수, r_d = 일간수익률, Vol_d = 일간거래대금(KRW).
> 이 정의가 본 프로젝트의 모든 ILLIQ 참조(Doc 18, Doc 31, Doc 32, Doc 22)의
> 정준적(canonical) 기준이다. 코드 구현(indicators.js)에서는 log-transformed
> 스케일을 사용하므로, Doc 22의 ILLIQ Scale Note를 참조할 것.

```
ILLIQ = (1/D) * sum(|r_t| / DVOL_t)
```

| 시장 세그먼트 | ILLIQ 범위 | 실질 슬리피지 |
|-------------|-----------|-------------|
| KOSPI 200 | 0.001-0.010 | 0.01-0.03% |
| KOSPI 중형 | 0.010-0.050 | 0.05-0.10% |
| KOSDAQ 대형 | 0.050-0.200 | 0.08-0.15% |
| KOSDAQ 소형 | 0.200-0.500+ | 0.20-0.50% |

금융 적용: `KRX_SLIPPAGE=0.10%`는 KOSPI 대형주 기준. KOSDAQ 소형주 4-10배 과소.

참고문헌:
- Amihud, Y. (2002). Illiquidity and Stock Returns. *JFM*, 5(1).

---

## 4. 미시구조 노이즈 필터링 (Microstructure Noise Filtering)

Hansen & Lunde (2006):

```
Var(observed) = Var(efficient) + 2 * Var(noise)
h_opt = (3 * sigma_noise^2) / (4 * sigma_price^2)
```

실용 권장: 5분봉(대부분), 15분봉(KOSDAQ 소형), 1분봉(HFT 전용).

커널 실현 분산:
```
KRV = sum(k(i/H) * gamma_i)
```

금융 적용: `indicators.js` `calcKalman()` adaptive Q가 노이즈 필터링의 단순화. Q_opt = sigma_noise^2 / sigma_efficient^2.

참고문헌:
- Hansen, P.R. & Lunde, A. (2006). Microstructure Noise. *JBES*, 24(2).
- Barndorff-Nielsen, O.E. et al. (2008). Realized Kernels. *Econometrica*, 76(6).

---

## 5. 처분효과의 주문장 표현 (Disposition Effect in Order Books)

Barberis & Xiong (2009), 04_psychology.md §1 확장:

```
v(x) = x^0.88           (이익)
v(x) = -2.25*(-x)^0.88  (손실)
```

주문장 비대칭:
- 매수가(P0) 위: 이익 실현 매도 집중 → 넓은 매도 스프레드
- 매수가(P0) 아래: 손실 회피 → 좁은 매수 스프레드
- 미실현 이익 큰 종목: 후속 수익률 하락 (Frazzini 2006)

금융 적용: `signalEngine.js` `applySRProximityBoost()`가 지지/저항 근처 신호 강화.

참고문헌:
- Barberis, N. & Xiong, W. (2009). Realization Utility. *JF*, 64(4).
- Frazzini, A. (2006). Disposition Effect and Underreaction. *JF*.

---

## 6. 호가 스프레드와 군집행동 역학 (Spread Dynamics During Herding)

### 6.1 Stoll 분해

```
Spread = S_order + S_inventory + S_info + S_adverse_selection
S_herd = S_base * (1 + alpha * H_index)
```

### 6.2 스프레드별 패턴 정확도

```
Pattern_Accuracy ≈ 75% - (Spread_Width / 100) * 50%
```

| 조건 | KOSPI 스프레드 | 패턴 정확도 |
|------|-------------|-----------|
| 정상 (LSV < 0.20) | 2-5 bps | ~74% |
| 군집 (LSV > 0.40) | 10-20 bps | ~65% |
| 위기 (LSV > 0.60) | > 50 bps | ~50% (무작위) |

참고문헌:
- Stoll, H.R. (1989). Bid-Ask Spread. *JF*, 44(1).
- Hwang, S. & Salmon, M. (2004). Market Stress and Herding. *JEF*, 28(3).

---

## 7. 닻 효과 기반 지지/저항 강도 (Anchoring-Adjusted S/R)

```
R_strength = sum(V_i * w(P_anchor - P_i))
```

04_psychology.md §2.2 (닻 효과) + 시장 미시구조:
- 52주 고/저, 정수가, 전일 종가가 심리적 닻
- 호가 단위 전환 경계(1,000/5,000/10,000원)에서 인위적 저항 형성
- 20_krx_structural_anomalies.md §8.1 참조

---

## 핵심 정리

| 개념 | 학술 출처 | JS 연결 |
|------|----------|--------|
| 가격 충격 | Kyle (1985) | backtester.js 비용 |
| 호가 스프레드 분해 | Glosten-Milgrom (1985) | ILLIQ 프록시 (tick 데이터 시 직접 구현) |
| 주문흐름 독성 | Easley et al. (2012) | LinUCB 확장 후보 |
| 비유동성 | Amihud (2002) | 시장별 슬리피지 |
| 노이즈 필터링 | Hansen & Lunde (2006) | calcKalman Q |
| 처분효과 주문장 | Barberis & Xiong (2009) | applySRProximityBoost |
| 스프레드 역학 | Stoll (1989), Hwang (2004) | 패턴 신뢰도 감산 |

---

## 참고문헌

1. Kyle, A.S. (1985). Continuous Auctions. *Econometrica*, 53(6).
1A. Glosten, L.R. & Milgrom, P.R. (1985). Bid, Ask and Transaction Prices. *JFE*, 14(1).
2. Easley, D. et al. (2012). Flow Toxicity. *RFS*, 25(5).
3. Amihud, Y. (2002). Illiquidity. *JFM*, 5(1).
4. Hansen, P.R. & Lunde, A. (2006). Microstructure Noise. *JBES*, 24(2).
5. Barndorff-Nielsen, O.E. et al. (2008). Realized Kernels. *Econometrica*, 76(6).
6. Barberis, N. & Xiong, W. (2009). Realization Utility. *JF*, 64(4).
7. Frazzini, A. (2006). Disposition Effect. *JF*.
8. Grinblatt, M. & Han, B. (2004). Disposition and Momentum. NBER WP 8734.
9. Stoll, H.R. (1989). Bid-Ask Spread. *JF*, 44(1).
10. Hwang, S. & Salmon, M. (2004). Market Stress and Herding. *JEF*, 28(3).
11. Roll, R. (1984). Implicit Bid-Ask Spread. *JF*, 39(4).
12. Cont, R. et al. (2014). Price Impact. *JFE*, 12(1).
