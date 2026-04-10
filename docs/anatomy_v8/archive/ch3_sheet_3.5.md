\newpage

### 3.5.1 백테스팅 통계 방법론 (Backtesting Statistical Methods)

**개요**

백테스팅은 제2장에서 도출한 이론적 정합성 체인이 경험적 데이터에서 실제로 작동하는지를
검증하는 최종 게이트이다. 패턴이 감지되고, 신호가 합성되고, 신뢰도가 부여되더라도 그
수치가 미래 수익률에 대한 통계적으로 유효한 예측력을 갖추지 못한다면, 전체 분석 파이프라인은
과적합(overfitting)의 산물에 불과하다. 백테스팅 방법론은 이 진위를 가리는 경험적 심판이며,
Stage 1에서 수집한 OHLCV 가격 데이터와 Stage 2에서 도출한 통계 이론이 여기에서 합류한다.

핵심 예측 엔진은 Reschenhofer et al. (2021)에 기반한 가중최소제곱(WLS) 릿지 회귀이다.
5개 피처 --- 절편, 패턴 신뢰도, 추세 강도, 거래량비, 변동성비 --- 로 구성된 설계행렬에
시간감쇠 가중치를 적용하여, 최근 관측에 더 높은 가중을 부여하는 비정상(non-stationary)
환경 적응형 추정을 수행한다. 릿지 벌점 $\lambda$는 Golub, Heath and Wahba (1979)의 GCV
(Generalized Cross-Validation)로 자동 선택되며, HC3 이분산 강건 표준오차(MacKinnon and
White, 1985)와 Huber-IRLS 5회 반복으로 극단값에 대한 방어를 갖춘다.

예측력의 사후 검증에는 세 가지 독립적 게이트가 존재한다. 첫째, Grinold and Kahn (2000)의
정보계수(IC)는 예측 순위와 실현 순위 사이의 스피어만 상관으로 측정되어 예측의 단조성
(monotonicity)을 평가한다. 둘째, Pardo (2008)의 Walk-Forward 효율(WFE)은 표본내(IS)
대비 표본외(OOS) 성과 비율을 통해 과적합 여부를 탐지한다. 셋째, Benjamini and Hochberg
(1995)의 BH-FDR 다중검정 보정은 33개 이상의 패턴을 동시에 검정할 때 발생하는 데이터
스누핑(data snooping)을 제어한다.

이 네 축 --- WLS 예측, IC, WFE, BH-FDR --- 이 종합되어 A/B/C/D 4단계 신뢰도 등급
시스템을 구성한다. 등급은 단일 지표의 통과 여부가 아닌 복합 게이팅(compound gating)으로
판정되며, WFE < 30이면 다른 지표와 무관하게 등급 C 상한이 적용되어 과적합 의심 패턴의
의사결정 진입을 차단한다.

**핵심 공식**

WLS 릿지 회귀 --- Hoerl and Kennard (1970); Reschenhofer et al. (2021):

$$\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$$

HC3 강건 표준오차 --- MacKinnon and White (1985):

$$\hat{V}_{HC3} = (X^TWX)^{-1} \; X^TW \;\text{diag}\!\left(\frac{e_i^2}{(1-h_{ii})^2}\right) WX \; (X^TWX)^{-1}$$

정보계수 (Information Coefficient) --- Grinold and Kahn (2000):

$$IC = \text{corr}\!\bigl(\text{rank}(\hat{y}),\; \text{rank}(y)\bigr)$$

Walk-Forward 효율 --- Pardo (2008):

$$WFE = \frac{\overline{R}_{\text{OOS}}}{\overline{R}_{\text{IS}}} \times 100$$

BH-FDR 다중검정 보정 --- Benjamini and Hochberg (1995):

$$\text{Reject } H_{(i)} \;\text{ if }\; p_{(i)} \leq \frac{i}{m} \cdot q$$

보유기간별 거래비용 --- Kyle (1985) $\sqrt{h}$ 스케일링:

$$TC = \frac{0.03\% + 0.18\%}{h} + \frac{0.10\%}{\sqrt{h}} \cdot \bigl(1 + \text{ILLIQ}_{\text{adj}}\bigr)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $X$ | 설계행렬 $[1,\; \text{품질},\; \text{추세},\; \text{거래량비},\; \text{변동성비}]$ | 무차원 | 본 Stage |
| $W$ | 시간감쇠 대각가중행렬, $w_i = 0.995^{n-1-i}$ (반감기 $\approx$ 138일) | 무차원 | 본 Stage |
| $\lambda$ | 릿지 벌점 (GCV 그리드 선택) | 무차원 | 본 Stage (I-16) |
| $I$ | 단위행렬 (절편 $j=0$은 정규화 미적용) | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{y}$ | $h$-일 미래 수익률 $-$ 거래비용 | % | **Stage 1** |
| $\hat{\beta}$ | WLS 릿지 회귀 계수 벡터 | 무차원 | 본 Stage |
| $e_i$ | $i$-번째 잔차, $y_i - x_i^T\hat{\beta}$ | % | 본 Stage |
| $h_{ii}$ | 지렛점 (hat matrix 대각), $H = X(X^TWX+\lambda I)^{-1}X^TW$ | 무차원 | 본 Stage |
| $IC$ | 스피어만 정보계수, $\text{corr}(\text{rank}(\hat{y}), \text{rank}(y))$ | 무차원 ($-1 \sim +1$) | 본 Stage |
| $\overline{R}_{\text{OOS}}$ | 표본외(OOS) 평균 수익률 | % | 본 Stage |
| $\overline{R}_{\text{IS}}$ | 표본내(IS) 평균 수익률 | % | 본 Stage |
| $WFE$ | Walk-Forward 효율, $(\overline{R}_{\text{OOS}} / \overline{R}_{\text{IS}}) \times 100$ | % | 본 Stage |
| $p_{(i)}$ | 정렬된 $i$-번째 $p$-값 ($p_{(1)} \leq \cdots \leq p_{(m)}$) | 무차원 | 본 Stage |
| $m$ | 동시 검정 수 ($\geq 33$ 패턴) | 정수 | 본 Stage |
| $q$ | FDR 수준 (0.05) | 무차원 | 상수 [A] |
| $h$ | 보유기간 | 거래일 | 본 Stage |
| $\text{ILLIQ}_{\text{adj}}$ | Amihud (2002) 비유동성 적응형 슬리피지 배율 | 무차원 | 본 Stage |
| $\textcolor{stageTwoMarker}{\text{Ridge}}$ | Hoerl-Kennard (1970) 릿지 정규화 이론 | --- | **Stage 2** (2.2.5절) |
| $\textcolor{stageTwoMarker}{\text{GCV}}$ | Golub-Heath-Wahba (1979) 일반화 교차검증 | --- | **Stage 2** (2.2.5절) |
| $\textcolor{stageTwoMarker}{\text{HC3}}$ | MacKinnon-White (1985) 이분산 강건 추정 | --- | **Stage 2** (2.3절) |
| $\textcolor{stageTwoMarker}{\text{BH}}$ | Benjamini-Hochberg (1995) FDR 보정 이론 | --- | **Stage 2** (2.3절) |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{y}$ (미래 수익률)는 Stage 1에서 수집된 OHLCV 가격 변동으로 산출된다. 설계행렬의 피처 중 추세 강도, 거래량비, 변동성비 역시 Stage 1의 가격/거래량/ATR(14)에서 파생된다. $\textcolor{stageTwoMarker}{\text{Ridge}}$ 정규화, $\textcolor{stageTwoMarker}{\text{GCV}}$ 람다 선택, $\textcolor{stageTwoMarker}{\text{HC3}}$ 강건 표준오차, $\textcolor{stageTwoMarker}{\text{BH}}$-FDR 다중검정의 이론적 기초는 모두 Stage 2 (제2장 2.2.5절, 2.3절)에서 도출된다.

**WLS 설계행렬 (5열) 구성**

| # | 변수 | 공식 | 단위 | 데이터 출처 |
|---|------|------|------|-----------|
| 0 | 절편 | 1 (상수) | --- | --- |
| 1 | 신뢰도 | confidencePred / 100 | 무차원 (0--1) | 패턴 분석 신뢰도 |
| 2 | 추세강도 | $\lvert slope_{OLS}\rvert / ATR$ (10봉 회귀) | 무차원 | $\textcolor{stageOneMarker}{\text{OHLCV 종가}}$ + ATR(14) |
| 3 | 거래량비 | $\ln(\max(V_t / VMA_{20},\; 0.1))$ | 무차원 (로그) | $\textcolor{stageOneMarker}{\text{OHLCV 거래량}}$ + MA(20) |
| 4 | 변동성비 | $ATR_{14} / close$ | 무차원 (비율) | ATR(14) + $\textcolor{stageOneMarker}{\text{OHLCV 종가}}$ |

종속변수 (y): $h$-일 전진 수익률(%) $-$ 거래비용.

WLS 가중치: $w_i = 0.995^{n-1-i}$ (최근 $\to$ 1.0, 최원 $\to$ 감쇠). 반감기 $\approx 138$일.

릿지 $\lambda$: GCV 그리드 $[0.01,\; 0.05,\; 0.1,\; 0.25,\; 0.5,\; 1.0,\; 2.0,\; 5.0,\; 10.0]$. Jacobi 고유분해 기반. 절편($j=0$)은 정규화 미적용.

강건화: Huber-IRLS ($\delta = 5.8$, KRX 5일 MAD 기반, 5회 반복). HC3 표준오차: WLS 모자행렬 $h_{ii} \to (1-h_{ii})^2$ 스케일링 $\to$ 샌드위치 추정.

**IC 임계값 해석**

| IC 범위 | 해석 | 학술 근거 |
|---------|------|-----------|
| $IC > 0.10$ | 강한 예측력 | Grinold and Kahn (2000) |
| $0.05 < IC \leq 0.10$ | 운용적으로 유의 | Qian, Hua, and Sorensen (2007) |
| $0.02 < IC \leq 0.05$ | 최소 비자명적 예측력 | Qian et al. (2007) |
| $IC \leq 0.02$ | 예측력 불충분 | --- |

최소 5쌍의 예측--실현 쌍이 필요. IC가 null (데이터 부족)인 경우 등급 판정에서 IC 조건은 통과로 처리.

**WFE 범위 해석**

| WFE 범위 | 해석 | 등급 영향 |
|----------|------|-----------|
| $WFE \geq 50$ | 강건 --- IS/OOS 성과 일관 | A/B 등급 허용 |
| $30 \leq WFE < 50$ | 한계 --- 약한 일반화 | B 등급 상한 |
| $WFE < 30$ | 과적합 의심 | **등급 C 강제 상한** (다른 지표 무관) |

확장 윈도우, 4--6 폴드. 제거 갭(purge gap) = $2 \times$ 수평 (AR(1) 반감기 방어) --- Bailey and Lopez de Prado (2014).

**BH-FDR 다중검정 보정**

Benjamini and Hochberg (1995). 33개 이상의 패턴을 동시에 검정할 때 데이터 스누핑(data snooping)을 방지한다. $p$-값을 오름차순 정렬 후 $p_{(i)} \leq (i/m) \cdot q$ 조건으로 기각 여부를 판정. $q = 0.05$ (FDR 5% 수준).

**생존편향 보정**

Elton, Gruber, and Blake (1996). 상장폐지 종목이 백테스트 유니버스에서 누락되면 승률이 체계적으로 과대추정된다. `survivorship_correction.json`에서 패턴/수평별 경험적 $\Delta_{WR}$을 로드하여 승률을 하향 보정한다. 보정된 승률: $WR_{\text{corrected}} = WR_{\text{raw}} - \Delta_{WR}$.

**거래비용 모형**

Kyle (1985) $\sqrt{h}$ 미끄러짐 스케일링에 기반한 보유기간별 비용 분해:

| 비용 항목 | 공식 | 값 (기본) | 근거 |
|-----------|------|-----------|------|
| 수수료 (편도 $\times$ 2) | $(0.03\%) / h$ | 0.03% | KRX 온라인 수수료 |
| 세금 | $(0.18\%) / h$ | 0.18% | KOSPI 0.03%+농특세0.15% / KOSDAQ 0.18% (2025 통일) |
| 슬리피지 (대형주) | $0.10\% / \sqrt{h}$ | 0.10% | Amihud (2002) ILLIQ 대형주 기준 |
| ILLIQ 적응형 | $\text{슬리피지} \times (1 + \text{ILLIQ}_{\text{adj}})$ | 종목별 | KOSDAQ 소형주 2--5$\times$ 상향 |

$h=1$: 0.31%, $h=5$: 0.087%, $h=20$: 0.033%. 기존 고정비용(0.07%) 대비 $h=1$에서 112% 과대계상이 수정됨.

**신뢰도 등급 시스템 (A/B/C/D)**

IC, WFE, BH-FDR, 표본 크기, 알파, 수익비를 종합하는 복합 게이팅:

| 등급 | IC | 알파 | 표본($n$) | 수익비(PF) | WFE | BH-FDR | 해석 |
|------|-----|------|-----------|-----------|-----|--------|------|
| A | $> 0.02$ | $\geq 5$pp | $\geq 100$ | $\geq 1.3$ | $\geq 50$ | 통과 | 강건, 실행 가능 |
| B | $> 0.01$ | $\geq 3$pp | $\geq 30$ | --- | $\geq 30$ | 통과 | 보통 수준 증거 |
| C | --- | $> 0$ | $\geq 10$ | --- | --- | --- | 약한 증거, 탐색적 |
| D | --- | --- | $< 10$ | --- | --- | --- | 통계적 증거 불충분 |

$WFE < 30$이면 다른 지표와 무관하게 **등급 C 상한** (과적합 의심). Hansen (2005) SPA 검정 미통과 시에도 A/B $\to$ C 강등.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| WLS 릿지 회귀 | `indicators.js` `calcWLSRegression()`, `selectRidgeLambdaGCV()` | 피처 $\to$ 수익 예측 계수 추정 |
| 5-피처 설계행렬 | `backtester.js` L1819--1857 (Phase C WLS 다중회귀) | 절편/품질/추세/거래량비/변동성비 구성 |
| Huber-IRLS 강건화 | `backtester.js` L1881 `calcWLSRegression()` 재호출 | 극단값 가중치 하향 (5회 반복, $\delta=5.8$) |
| 스피어만 IC | `backtester.js` `_spearmanCorr()` | 예측--실현 순위상관 측정 |
| Walk-Forward 검증 | `backtester.js` `walkForwardTest()` | 4--6 폴드 확장 윈도우 OOS 검증 |
| BH-FDR 보정 | `backtester.js` `_applyBHFDR()` | 33+ 패턴 동시검정 FDR 제어 |
| 등급 판정 (A/B/C/D) | `backtester.js` `backtestAll()` L541--601, `reliabilityTier` | IC+WFE+BH+$n$+$\alpha$+PF 복합 게이팅 |
| 거래비용 | `backtester.js` `_horizonCost()` | $h$-일 보유기간별 비용 차감 |
| 생존편향 보정 | `backtester.js` `_survivorshipCorr`, `survivorship_correction.json` | 패턴/수평별 $\Delta_{WR}$ 하향 보정 |
| ILLIQ 슬리피지 | `backtester.js` `_getStockSlippage()` | 종목별 Amihud ILLIQ 기반 슬리피지 조정 |
| GCV 람다 선택 | `indicators.js` `selectRidgeLambdaGCV()` | 9-그리드 $\lambda$ 자동 선택 |
| HC3 표준오차 | `indicators.js` `calcWLSRegression()` 내부 | 샌드위치 추정 $(1-h_{ii})^2$ 스케일링 |

\newpage
