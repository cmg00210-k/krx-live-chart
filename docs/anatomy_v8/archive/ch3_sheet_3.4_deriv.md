\newpage

### 3.4.2 파생-신용 신뢰도 (Derivatives-Credit Confidence)

**개요**

CheeseStock의 패턴 신뢰도 체계에서 CONF-계층3과 CONF-계층4는 파생상품 시장
신호와 구조적 신용위험 정보를 활용하여 캔들/차트 패턴의 신뢰도를 동적으로
조정한다. 계층3(파생상품 신뢰도)은 6개 독립 요인--- 선물 베이시스, 풋/콜 비율(PCR),
투자자 수급 정렬, ETF 레버리지 센티먼트, 공매도 비율, USD/KRW 환율---의 곱셈
결합(multiplicative combination)으로 구성된다. 각 요인은 시장 전반의 파생상품·수급
상태를 반영하며, 패턴의 매수/매도 방향과의 일치·괴리에 따라 신뢰도를 증감시킨다.
이론적 근거로 Bessembinder and Seguin (1993)의 선물-현물 정보 비대칭, Pan and
Poteshman (2006)의 옵션 시장 정보 우위, Choe, Kho, and Stulz (2005)의 외국인
투자자 정보 이점을 포괄한다.

계층4(머튼 부도거리)는 Merton (1974)의 구조적 신용위험 모형에 기반한다. 자기자본을
기업 자산에 대한 유럽식 콜옵션으로 해석하는 이 모형에서, 부도거리(Distance to
Default, DD)는 자산가치가 부채 수준에 도달하기까지의 표준편차 단위 거리를 나타낸다.
Bharath and Shumway (2008)의 단순화 버전을 채택하여, 반복적 자산가치 추정 없이도
시가총액과 부채 장부가로부터 DD를 직접 산출한다. DD가 낮을수록 부도 위험이 높으므로
매수 패턴의 신뢰도를 할인하되, 매도 패턴은 조정하지 않는다--- 신용위험 상승은 매도
신호를 무효화하지 않기 때문이다.

금융업종(은행, 보험, 증권)은 부채가 운전자산(영업부채)의 성격을 가지므로 DD 해석이
부적합하여 명시적으로 제외한다. 또한 seed 데이터(코드 해시 기반 가상 재무제표)로는
DD를 산출하지 않으며, DART 또는 hardcoded 출처의 실제 재무 데이터만 사용한다.

**핵심 공식**

파생상품 신뢰도 복합 승수(CONF-계층3):

$$\text{derivMult} = \prod_{k \in \{D1,\,D2,\,D3,\,D4,\,D5,\,D7\}} (1 + \delta_k)$$

$$\text{clamp:} \quad \text{derivMult} \in [0.70,\; 1.30]$$

머튼 부도거리(CONF-계층4):

$$DD = \frac{\ln(V/D) + (\mu - \tfrac{1}{2}\sigma_V^2)\,T}{\sigma_V \sqrt{T}}$$

자산가치 근사 (Bharath-Shumway 단순화):

$$V \approx E + D, \qquad \sigma_V \approx \sigma_E \cdot \frac{E}{E + D} + 0.05 \cdot \frac{D}{E + D}$$

기대 부도확률:

$$EDF = \Phi(-DD)$$

여기서 $\Phi(\cdot)$은 표준정규 누적분포함수(Abramowitz and Stegun, 1964 근사)이다.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $\textcolor{stageOneMarker}{\text{basis}}$ | 선물 베이시스 (KOSPI200 선물 - 현물) | 포인트 | **Stage 1** (KRX 파생상품) |
| $\textcolor{stageOneMarker}{\text{basisPct}}$ | 정규화 베이시스 (= basis / 현물 $\times$ 100) | % | **Stage 1** |
| $\textcolor{stageOneMarker}{\text{pcr}}$ | 풋/콜 비율 (Put/Call Ratio) | 무차원 | **Stage 1** (KRX 옵션) |
| $\textcolor{stageOneMarker}{\text{foreign\_net}}$ | 외국인 순매수 금액 | 억원 | **Stage 1** (KRX 투자자) |
| $\textcolor{stageOneMarker}{\text{alignment}}$ | 외국인+기관 수급 정렬 상태 | 범주형 | **Stage 1** (investor\_summary) |
| $\textcolor{stageOneMarker}{\text{leverageSentiment}}$ | ETF 레버리지/인버스 비율 센티먼트 | 범주형 | **Stage 1** (etf\_summary) |
| $\textcolor{stageOneMarker}{\text{market\_short\_ratio}}$ | 시장 전체 공매도 비율 | % | **Stage 1** (shortselling\_summary) |
| $\textcolor{stageOneMarker}{\text{usdkrw}}$ | USD/KRW 환율 | 원/달러 | **Stage 1** (macro\_latest) |
| $\textcolor{stageTwoMarker}{DD}$ | 머튼 부도거리 (Distance to Default) | $\sigma$ 단위 | **Stage 2** (2.6.13절) |
| $\textcolor{stageTwoMarker}{V}$ | 기업 자산가치 (Asset Value) | 억원 | **Stage 2** (Merton 1974) |
| $\textcolor{stageOneMarker}{D}$ | 부채 장부가 $\times$ 0.75 (KMV Default Point) | 억원 | **Stage 1** (DART 재무제표) |
| $\textcolor{stageOneMarker}{E}$ | 자기자본 시가총액 (Market Cap) | 억원 | **Stage 1** (시가총액) |
| $\textcolor{stageTwoMarker}{\sigma_E}$ | 자기자본 변동성 (EWMA 연율화) | 무차원 | **Stage 2** (2.1.3절) |
| $\textcolor{stageTwoMarker}{\sigma_V}$ | 자산 변동성 (Bharath-Shumway 가중) | 무차원 | **Stage 2** |
| $\mu$ | 기대 수익률 $\approx r$ (무위험이자율) | 연율 | **Stage 1** (KTB 3Y) |
| $T$ | 시간 지평 (= 1년) | 년 | 본 Stage |
| $\Phi(\cdot)$ | 표준정규 CDF | 무차원 | 본 Stage |
| $\delta_{D1}$ | 베이시스 조정 계수 | $\pm$4\textasciitilde7\% | 본 Stage |
| $\delta_{D2}$ | PCR 역발상 조정 계수 | $\pm$6\% | 본 Stage |
| $\delta_{D3}$ | 투자자 정렬 조정 계수 | $\pm$8\% | 본 Stage |
| $\delta_{D4}$ | ETF 심리 역발상 조정 계수 | $\pm$4\% | 본 Stage |
| $\delta_{D5}$ | 공매도 비율 조정 계수 | +6\% (고비율) | 본 Stage |
| $\delta_{D7}$ | USD/KRW 수출주 채널 조정 계수 | $\pm$5\% | 본 Stage |
| $EDF$ | 기대 부도확률 (Expected Default Frequency) | 무차원 (0--1) | 본 Stage |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{basis}}$, $\textcolor{stageOneMarker}{\text{pcr}}$, $\textcolor{stageOneMarker}{\text{foreign\_net}}$, $\textcolor{stageOneMarker}{\text{alignment}}$, $\textcolor{stageOneMarker}{\text{leverageSentiment}}$, $\textcolor{stageOneMarker}{\text{market\_short\_ratio}}$, $\textcolor{stageOneMarker}{\text{usdkrw}}$는 Stage 1 KRX 파생상품/투자자/ETF/공매도/매크로 데이터에서 수집된다. $\textcolor{stageOneMarker}{E}$와 $\textcolor{stageOneMarker}{D}$는 Stage 1 시가총액 및 DART 재무제표에서 취득된다. $\textcolor{stageTwoMarker}{DD}$ 산출에 필요한 BSM 옵션 이론 프레임워크는 Stage 2 제2장 2.6.10절(Black-Scholes-Merton)과 2.6.13절(Merton 구조 모형)에서 도출된다. $\textcolor{stageTwoMarker}{\sigma_E}$는 Stage 2 제2장 2.1.3절 EWMA 변동성에서 산출된다.

**CONF-계층3: 파생상품 신뢰도 요인표 (D1--D5, D7)**

| 요인 | 이론적 근거 | 조건 | 매수 조정 | 매도 조정 | 크기 |
|------|-------------|------|-----------|-----------|------|
| D1 선물 베이시스 | 보유비용 모형, Bessembinder and Seguin (1993) | contango ($\text{basisPct} \geq 0.5\%$) | $\times(1+\delta)$ | $\times(1-\delta)$ | normal $\pm$4\%, extreme($\geq$2\%) $\pm$7\% |
| D1 (역) | 동일 | backwardation ($\text{basisPct} \leq -0.5\%$) | $\times(1-\delta)$ | $\times(1+\delta)$ | 동일 |
| D2 PCR 역발상 | Pan and Poteshman (2006) | PCR $> 1.2$ (극단적 공포) | $\times 1.06$ | $\times 0.94$ | $\pm$6\% |
| D2 (역) | 동일 | PCR $< 0.6$ (극단적 탐욕) | $\times 0.94$ | $\times 1.06$ | $\pm$6\% |
| D3 투자자 정렬 | Choe, Kho, and Stulz (2005) | aligned\_buy (외국인+기관 동반 매수) | $\times 1.08$ | $\times 0.93$ | +8\% / $-$7\% |
| D3 (역) | 동일 | aligned\_sell (외국인+기관 동반 매도) | $\times 0.93$ | $\times 1.08$ | $-$7\% / +8\% |
| D4 ETF 심리 | Cheng and Madhavan (2009) | strong\_bullish (극단적 낙관) | $\times 0.96$ | $\times 1.04$ | $\pm$4\% (역발상) |
| D4 (역) | 동일 | strong\_bearish (극단적 비관) | $\times 1.04$ | $\times 0.96$ | $\pm$4\% (역발상) |
| D5 공매도 비율 | Desai et al. (2002) | market\_short\_ratio $> 10\%$ | $\times 1.06$ | $\times 0.94$ | +6\% (숏커버 랠리) |
| D5 (비활성) | Miller (1977) | market\_short\_ratio $< 2\%$ | (비활성)[^d5-note] | (비활성) | --- |
| D7 USD/KRW | Mundell-Fleming, $\beta_{FX}$ 채널 | KRW 약세 ($> 1400$), 수출업종 | $\times 1.05$ | $\times 0.95$ | $\pm$5\% |
| D7 (역) | 동일 | KRW 강세 ($< 1300$), 수출업종 | $\times 0.95$ | $\times 1.05$ | $\pm$5\% |

[^d5-note]: D5 저비율 분기(market\_short\_ratio $< 2\%$)는 2023.11--2025.03 공매도 금지 기간 및 이후 데이터 미비로 비활성화. 개별종목 공매도 데이터 정상화 시 재활성 예정 (Miller 1977: 낮은 공매도 = 규제 제약, 센티먼트 아님).

**D6(ERP) 처리:** D6 주식위험프리미엄(Equity Risk Premium, Damodaran 2002)은 원래 파생상품 신뢰도 요인에 포함되었으나, `signalEngine._detectERPSignal()`에서 독립 시그널로 처리됨에 따라 이중 적용 방지를 위해 CONF-계층3에서 제외되었다(C-6 FIX). 요인 번호 D6은 의도적으로 결번이다.

**수출업종 판정:** D7 환율 채널은 Stovall 업종 분류에서 `semiconductor`, `tech`, `cons_disc`, `industrial`에 해당하는 종목에만 적용된다.

**CONF-계층3 클램프:** $\text{derivMult} \in [0.70,\; 1.30]$. 최종 적용: $\text{confidence} = \text{round}(\text{confidence} \times \text{derivMult})$, 범위 $[10, 100]$.

---

**CONF-계층4: 머튼 부도거리 DD 범위별 조정표**

| DD 범위 | 위험 등급 | 매수 조정 | 매도 조정 | 해석 |
|---------|-----------|-----------|-----------|------|
| $DD < 1.0$ | 매우 위험 | $\times 0.75$ | $\times 1.15$ | 부도 임박, 매수 최대 할인 |
| $1.0 \leq DD < 1.5$ | 위험 | $\times 0.82$ | $\times 1.12$ | 신용 경고, 매수 강한 할인 |
| $1.5 \leq DD < 2.0$ | 경계 | $\times 0.95$ | $\times 1.02$ | 감시 구간, 매수 소폭 할인 |
| $2.0 \leq DD < 3.0$ | 정상 | 변동 없음 | 변동 없음 | 안전 구간 |
| $DD \geq 3.0$ | 안전 | 변동 없음 | 변동 없음 | 부도 위험 미미 |

**CONF-계층4 클램프:** $[0.75,\; 1.15]$. 하한 0.75는 DD $< 1.0$ 매수 tier의 최대 할인과 일치한다.

**Naive DD 산출 절차:**

1. **금융주 제외:** Stovall 업종 = `financial` → DD 산출 건너뜀
2. **재무 데이터 검증:** source가 `dart` 또는 `hardcoded`인 경우만 허용, `seed` 제외
3. **입력 변수 수집:**
   - $E$: 시가총액 (억원, `sidebarManager.MARKET_CAP` 또는 `currentStock.marketCap`)
   - $D$: `total_liabilities` $\times$ 0.75 (KMV Default Point 관행, Doc35 \S6.5)
   - $\sigma_E$: EWMA 일간 변동성 $\times \sqrt{250}$ (KRX 연간 거래일 기준 연율화)
   - $r$: KTB 3Y 금리 (bonds\_latest → macro\_latest → fallback 3.5\%)
4. **자산가치 근사:** $V = E + D$
5. **자산변동성 근사:** $\sigma_V = \sigma_E \cdot (E/V) + 0.05 \cdot (D/V)$
6. **DD 산출:** $DD = [\ln(V/D) + (r - \sigma_V^2/2) \cdot T] \;/\; (\sigma_V \sqrt{T})$, $T = 1$
7. **EDF 산출:** $EDF = \Phi(-DD)$ (Abramowitz-Stegun 근사, $|\varepsilon| < 7.5 \times 10^{-8}$)

**MASTER 원문 CONF-계층3 요약 (보존)**

| 요인 | 이론 | 크기 |
|------|------|------|
| D1 선물 베이시스 | 보유비용 심리 | +/-4~7% |
| D2 PCR 역발상 | 풋/콜 극단 | +/-6% |
| D3 투자자 정렬 | 외국인+기관 | +/-8% |
| D4 ETF 심리 | 레버리지 비율 | +/-4% |
| D5 공매도 비율 | 시장 공매도 국면 | +6% 고비율 |
| D7 USD/KRW | 환율-수출 민감도 | +/-5% |

**MASTER 원문 CONF-계층4 요약 (보존)**

| DD 범위 | 매수 조정 | 매도 조정 |
|---------|-----------|-----------|
| DD < 1.0 | x0.75 | 변동 없음 |
| DD 1.0~1.5 | x0.82 | 변동 없음 |
| DD 1.5~2.0 | x0.90 | 변동 없음 |
| DD 2.0~3.0 | x0.95 | 변동 없음 |
| DD > 3.0 | 변동 없음 | 변동 없음 |

금융업종 제외 (부채 = 운전자산). **클램프:** [0.75, 1.15].

> **참고:** MASTER 원문에서 CONF-계층4의 "매도 조정"은 모두 "변동 없음"으로 기술되어 있으나, 실제 구현(`_applyMertonDDToPatterns()`)에서는 DD $< 1.5$ 구간에서 매도 부스트($\times 1.02$\textasciitilde$\times 1.15$)가 적용된다. 또한 MASTER 원문의 DD 1.5\textasciitilde2.0 매수 조정(x0.90)과 DD 2.0\textasciitilde3.0 매수 조정(x0.95)은 구현에서 각각 0.95와 1.0(무조정)으로 상이하다. 위 확장 테이블은 실제 코드를 반영한 것이며, MASTER 원문은 원형 그대로 보존한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 파생상품 복합 신뢰도 | `_applyDerivativesConfidenceToPatterns()` | D1--D5, D7 6개 요인 곱셈 결합, 클램프 [0.70, 1.30] |
| 선물 베이시스 정보 | `deriv.excessBasisPct`, `deriv.basisPct`, `deriv.basis` | D1: contango/backwardation 방향 판별 |
| PCR 역발상 | `deriv.pcr` 임계값 1.2/0.6 | D2: Pan-Poteshman 극단값 반전 |
| 투자자 수급 정렬 | `investor.alignment.signal_1d` | D3: Choe-Kho-Stulz 정보 이점 |
| ETF 센티먼트 | `etf.leverageSentiment.sentiment` | D4: Cheng-Madhavan 역발상 |
| 공매도 레짐 | `shorts.market_short_ratio` 임계값 10\% | D5: Desai 숏커버 랠리 |
| 환율-수출 채널 | `_macroLatest.usdkrw` 임계값 1400/1300 | D7: $\beta_{FX}$ 수출업종 한정 |
| Merton 부도거리 | `_calcNaiveDD()` → `_currentDD` | Bharath-Shumway Naive DD 산출 |
| DD 기반 매수 할인 | `_applyMertonDDToPatterns()` | DD 5단계 구간별 매수 할인 / 매도 부스트 |
| 표준정규 CDF 근사 | `_normalCDF()` | Abramowitz-Stegun 다항식 근사 |
| Default Point | `total_liabilities * 0.75` | KMV 관행: STD + 0.5$\times$LTD 근사 |
| 자산변동성 가중 | `sigmaE * (E/V) + 0.05 * (D/V)` | Bharath-Shumway 부채 변동성 5\% 가정 |
| 금융주 DD 제외 | `_getStovallSector() === 'financial'` | 은행/보험/증권 부채 = 영업자산 |
| 무위험이자율 폴백 | KTB 3Y → `_bondsLatest` → `_macroLatest` → 3.5\% | DD 산출 $\mu$ 입력 |
| Compound floor | `confidence < 25 → 25` | Tukey (1977) 윈저화: 8계층 연쇄 곱셈 바닥 방지 |

\newpage
