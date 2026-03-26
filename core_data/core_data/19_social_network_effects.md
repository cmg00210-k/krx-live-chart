# 19. 소셜 네트워크 효과 — Social Network Effects

> 한국 개인투자자 네트워크를 통한 정보 확산이 가격 발견과 기술적 패턴에 미치는 영향.
> 정보 폭포, 한국어 감성분석, 군집행동 측정, 네트워크 토폴로지를 다룬다.

---

## 1. 정보 폭포 이론 (Information Cascade Theory)

### 1.1 Bikhchandani-Hirshleifer-Welch 모형

Bikhchandani et al. (1992): 순차적 의사결정에서 공공 정보가 사적 신호를 압도할 때 폭포 형성.

```
폭포 조건: |Public_Evidence| > |Private_Signal_Precision|
```

폭포는 **2-3명의 에이전트**가 동일 행동을 취하면 시작되며, 이후 에이전트는 사적 정보를 무시.

### 1.2 금융 시장 폭포

04_psychology.md §3.1 (정보 폭포) 확장:
- 매수 폭포: 연속 상승 + 거래량 급증 → 적삼병 패턴 형성
- 매도 폭포: 패닉 → 흑삼병 패턴 형성
- 폭포 내 학습 속도 극도로 느림 → 잘못된 합의에 장기 고착 가능

```
V_cascade(t) = V_base * exp(gamma * N_informed(t))
```

참고문헌:
- Bikhchandani, S. et al. (1992). Informational Cascades. *JPE*, 100(5).
- Banerjee, A. (1992). A Simple Model of Herd Behavior. *QJE*, 107(3).

---

## 2. 한국 온라인 투자자 생태계 (Korean Retail Ecosystem)

### 2.1 주요 플랫폼

| 플랫폼 | 유형 | 영향력 | 학술 증거 |
|--------|------|--------|----------|
| 네이버 금융 | 공개 포럼 | 최대 규모, AICA 측정 가능 | Yoon & Oh (2022) |
| 카카오톡 주식방 | 비공개 그룹 | 10만+ 그룹, 규제 사각 | — |
| YouTube 주식 채널 | 콘텐츠 소비 | 3PRO TV 157만 구독 | Jang (2024) |

### 2.2 소셜 미디어 영향 정량화

Jang (2024): YouTube 조회수가 개인 투자자 매수 행동과 익일 수익률에 유의한 양의 영향.
- 효과 크기: 소형주에서 더 강함 (정보 비대칭 높음)
- 2026.03.23: 개인 단일 세션 7조원 매수 (소셜 미디어 폭포 증거)

참고문헌:
- Yoon, J. & Oh, G. (2022). Investor Herding in Social Media Sentiment. *Frontiers in Physics*.
- Jang, J. (2024). YouTube View Count and Stock Returns. *JBF*.

---

## 3. 한국어 감성분석 (Korean NLP Sentiment)

### 3.1 KR-FinBERT

서울대 NLP 연구실(snunlp): KoBERT 기반 금융 도메인 사전학습.
- 학습 코퍼스: 72개 언론사 + 16개 증권사 리포트
- 정확도: ~97% (금융 감성 분류)

### 3.2 감성 점수 집계

```
S_t = alpha * KR_FinBERT(Text_t) + (1-alpha) * Historical_Sentiment
Predicted_Return_{t+1} = gamma * S_t + epsilon
```

R² 개선 (1일 horizon):
- 기준 (감성 없음): R² ≈ 0.02-0.05
- 감성 추가: R² ≈ 0.08-0.15 (+0.05-0.10)

금융 적용: `signalEngine.js` 감정 집계(lines 1616-1649)에 소셜 감성 차원 추가 후보.

참고문헌:
- Araci, D. (2019). FinBERT. arXiv:1908.10063.
- Choi, D. & Shin, S. (2023). KR-FinBERT. *Korean J. Applied Statistics*.

---

## 4. 사회적 학습 모형 (Social Learning Models)

### 4.1 DeGroot (1974) 합의 모형

```
b_i(t+1) = sum_j T_ij * b_j(t)
수렴: b_i(∞) = sum_k alpha_k * b_k(0)
```

T = 신뢰/인접 행렬 (행확률적), alpha = 네트워크 중심성 가중치.
수렴 속도 = lambda_2 (T의 두 번째 최대 고유값) 지수적 감쇠.

### 4.2 베이지안 사회적 학습

```
Posterior_i(t) ∝ Likelihood(Private_Signal) × Prior × Product(Neighbor_Likelihoods)
```

수렴 실패 조건: 네트워크가 "확장" 토폴로지를 갖지 않을 때 잘못된 합의에 수렴 가능.

금융 적용: CheeseStock의 다중 지표 조합(MA, BB, RSI)은 다양한 "사적 신호" 역할 → 군집행동 방어.

참고문헌:
- DeGroot, M.H. (1974). Reaching a Consensus. *JASA*, 69(345).
- Golub, B. & Jackson, M.O. (2010). Naive Learning in Social Networks. *AEJ: Micro*, 2(1).

---

## 5. 군집행동 측정 (Herd Behavior Measurement)

### 5.1 LSV 지수

Lakonishok, Shleifer & Vishny (1992):

```
H_i,t = |BUY / (BUY + SELL) - E[p]| - sigma(p)
```

### 5.2 CCK CSAD 모형

Chang, Cheng & Khorana (2000):

```
CSAD_t = (1/N) * sum(|R_i,t - R_m,t|)
CSAD_t = alpha + beta_1*|R_m| + beta_2*(R_m)^2 + epsilon

EMH: beta_2 ≈ 0 (분산 선형 증가)
군집: beta_2 < 0 (극단 시장에서 분산 감소)
```

### 5.3 한국 시장 실증

| 시장 | 군집 계수 (beta_2) | 조건 |
|------|-------------------|------|
| 한국 (정상) | -0.0008 ~ -0.0015 | 하락장에서 유의 |
| 한국 (위기) | > -0.0030 | 극단적 군집 |
| 미국 | -0.0002 ~ -0.0005 | 한국의 1/3 수준 |

Yoon & Oh (2022): AICA(비정상 정보생산활동)가 개인 군집행동을 1-3일 선행.

참고문헌:
- Lakonishok, J. et al. (1992). Institutional Trading Impact. *JFE*, 32(1).
- Chang, E.C. et al. (2000). Herd Behavior in Equity Markets. *JFQA*.
- Park et al. (2025). Retail Investors and Herding in Korea. *Applied Economics*.

---

## 6. 소셜 미디어와 주가 예측 (Social Media & Returns)

### 6.1 Bollen et al. (2011) Twitter 감성

9.8M 트윗 분석, GPOMS 6차원 감성:
- 예측 정확도: 87.6% (DJIA 방향)
- 최강 예측자: "Calm" 차원 (음의 상관)
- 선행-후행: 트위터 감성이 시장을 1-3일 선행

### 6.2 Antweiler & Frank (2004) 게시판 분석

1.5M+ Yahoo Finance 메시지:
- 수익률 예측: R² +0.01-0.02 (약함)
- **변동성 예측: R² +0.03-0.05 (중간)**
- **거래량 예측: R² +0.10-0.15 (강함)**

핵심: 소셜 미디어 감성은 수익률보다 **변동성과 거래량** 예측에 유용.

참고문헌:
- Bollen, J. et al. (2011). Twitter Mood Predicts Stock Market. *JOCS*, 2(1).
- Antweiler, W. & Frank, M.Z. (2004). Is All That Talk Just Noise? *JF*, 59(3).

---

## 7. 네트워크 토폴로지와 가격 영향 (Network Topology)

### 7.1 금융 네트워크 유형

| 유형 | 특성 | 금융 영향 |
|------|------|----------|
| 척도 없는 (Scale-Free) | 멱법칙 차수 분포 P(k)∝k^(-gamma) | 허브 주도 폭포, 66.98% 주식 시장 |
| 좁은 세상 (Small-World) | 짧은 경로 + 높은 클러스터링 | 정보 급속 확산, 시스템 리스크 |
| 랜덤 (Erdos-Renyi) | 균일 차수 | 분산된 가격 발견 |

### 7.2 가격 영향 모형

```
delta_P = theta * Q * sqrt(Degree_Centrality / Network_Density) + epsilon
```

척도 없는 네트워크에서 허브(인플루언서)의 거래가 불균형적 가격 영향 유발.

참고문헌:
- Liu, C. et al. (2019). Cascade Behavior and Network Topology. *Computational Economics*.
- MDPI Entropy (2021). Investor Networks and Financial Crises. *Entropy*, 23(4).

---

## 8. 기술적 분석과의 연결 (Connection to Technical Analysis)

### 8.1 Granger 인과 검정

```
r_t = alpha + sum(beta_j * r_{t-j}) + sum(gamma_j * S_{t-j}) + epsilon
H0: gamma_j = 0 (감성→수익률 인과관계 없음)
```

### 8.2 CheeseStock 통합 구조

```
[개인 투자자] → [소셜 네트워크] → [감성 집계] → [폭포 형성?]
     ↓                                              ↓
[사적 신호]         [KR-FinBERT]              [AICA 탐지]
                        ↓                         ↓
              [LinUCB 컨텍스트 확장]     [패턴 신뢰도 조정]
```

---

## 핵심 정리

| 개념 | 학술 출처 | JS 연결 |
|------|----------|--------|
| 정보 폭포 | Bikhchandani (1992) | 신호 합치 시 신뢰도 증폭 |
| 한국 소매 생태계 | Yoon (2022), Jang (2024) | 감정 가중치 |
| KR-FinBERT | snunlp (2023) | 감성 입력 후보 |
| DeGroot 합의 | DeGroot (1974) | 다중 지표 = 다양한 사적 신호 |
| LSV/CSAD 군집 | Chang (2000), Park (2025) | 극단 시장 신뢰도 감산 |
| 소셜 감성 예측 | Bollen (2011), Antweiler (2004) | 변동성/거래량 예측 우수 |
| 네트워크 토폴로지 | Liu (2019) | 허브 주도 폭포 탐지 |

---

## 참고문헌

1. Bikhchandani, S. et al. (1992). Informational Cascades. *JPE*, 100(5).
2. Banerjee, A. (1992). Herd Behavior. *QJE*, 107(3).
3. DeGroot, M.H. (1974). Reaching a Consensus. *JASA*, 69(345).
4. Golub, B. & Jackson, M.O. (2010). Naive Learning. *AEJ: Micro*, 2(1).
5. Bollen, J. et al. (2011). Twitter Mood. *JOCS*, 2(1).
6. Antweiler, W. & Frank, M.Z. (2004). Internet Stock Message Boards. *JF*, 59(3).
7. Lakonishok, J. et al. (1992). Institutional Trading. *JFE*, 32(1).
8. Chang, E.C. et al. (2000). Herd Behavior. *JFQA*.
9. Yoon, J. & Oh, G. (2022). Investor Herding. *Frontiers in Physics*.
10. Park, J. et al. (2025). Retail Investors Korea. *Applied Economics*.
11. Jang, J. (2024). YouTube and Stock Returns. *JBF*.
12. Liu, C. et al. (2019). Cascade Behavior. *Computational Economics*.
13. Araci, D. (2019). FinBERT. arXiv:1908.10063.
14. Chen, H. et al. (2014). Wisdom of Crowds. *RFS*, 27(5).
