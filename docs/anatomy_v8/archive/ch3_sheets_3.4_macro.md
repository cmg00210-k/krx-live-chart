\newpage

### 3.4.1 거시-미시 신뢰도 (Macro-Micro Confidence)

**개요**

CheeseStock의 신뢰도 체인은 패턴 인식 단계에서 산출된 기본 신뢰도($C_{\text{base}}$)를
거시경제 환경과 미시 구조적 조건으로 순차 조정하는 승법적(multiplicative) 체계이다.
이 설계는 기술적 분석 단독으로는 포착할 수 없는 체계적 위험(systematic risk)과
유동성 조건을 신뢰도에 내재화한다. 예컨대 IS-LM 프레임워크(Hicks 1937)에서
확장적 통화정책은 LM 곡선을 우하향 이동시켜 금리를 낮추고 주가를 상승시키므로,
해당 국면에서 매수 패턴의 신뢰도를 상향 조정하는 것이 이론적으로 정당하다.

제2장에서 서술된 IS-LM(2.5.1절), 테일러 준칙(2.5.2절), 먼델-플레밍(2.5.3절),
Stovall 섹터 순환(2.5.5절), NSS 수익률 곡선(2.5.10절), Gilchrist-Zakrajsek
신용 스프레드(2.5.4절)의 이론적 프레임워크가 본 절에서 구체적인 조정 요인
(F1~F9, M1~M3)으로 변환된다. 각 요인은 독립적인 학술적 근거와 제한된
조정 크기(클램프)를 가지며, 승법적으로 결합되어 단일 요인의 과대 영향을
구조적으로 차단한다.

클램프 범위의 설정은 실증적 근거에 기반한다. 거시 승수의 상한 1.25는
거시 요인이 패턴 신뢰도를 최대 25%까지 상향할 수 있음을 의미하며,
하한 0.70은 극단적 거시 악화 시에도 30% 이상의 감산을 허용하지 않는다.
이 비대칭(상향 25% vs 하향 30%)은 행동재무학의 손실 회피(Kahneman and
Tversky 1979)와 일관되며, 하방 위험에 더 민감하게 반응하는 시장의
비대칭적 특성을 반영한다.

**핵심 공식**

$$C_{\text{adj}} = C_{\text{base}} \times \text{clamp}(\text{macroMult}, 0.70, 1.25) \times \text{clamp}(\text{microMult}, 0.55, 1.15)$$

$$\text{macroMult} = \prod_{k \in \{F1,F1a,F2,F3,F7,F8,F9\}} (1 + \delta_k)$$

$$\text{microMult} = \prod_{m \in \{M1,M2,M3\}} (1 + \delta_m)$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $C_{\text{base}}$ | 패턴 기본 신뢰도 | 0--100 | 본 Stage (3.2--3.3) |
| $C_{\text{adj}}$ | 거시-미시 조정 후 신뢰도 | 0--100 | 본 Stage |
| $\text{macroMult}$ | 거시 승수 (7개 요인 곱) | 무차원 (배수) | 본 Stage |
| $\text{microMult}$ | 미시 승수 (3개 요인 곱) | 무차원 (배수) | 본 Stage |
| $\delta_k$ | 제$k$ 거시 요인의 조정량 | 무차원 | 본 Stage |
| $\delta_m$ | 제$m$ 미시 요인의 조정량 | 무차원 | 본 Stage |
| $\textcolor{stageOneMarker}{\text{bok\_rate}}$ | 한국은행 기준금리 | % | **Stage 1** (ECOS) |
| $\textcolor{stageOneMarker}{\text{term\_spread}}$ | 국고 10Y--3Y 금리차 | %p | **Stage 1** (ECOS) |
| $\textcolor{stageOneMarker}{\text{vix}}$ | CBOE VIX 지수 | % | **Stage 1** (FRED) |
| $\textcolor{stageOneMarker}{\text{taylor\_gap}}$ | 테일러 갭 (실제금리 - 적정금리) | %p | **Stage 1** (파생) |
| $\textcolor{stageOneMarker}{\text{rate\_diff}}$ | 한미 금리차 | %p | **Stage 1** (파생) |
| $\textcolor{stageOneMarker}{\text{credit\_spread}}$ | 신용 스프레드 (AA-) | %p | **Stage 1** (채권) |
| $\textcolor{stageTwoMarker}{\text{IS-LM}}$ | IS-LM 균형 프레임워크 | --- | **Stage 2** (2.5.1절) |
| $\textcolor{stageTwoMarker}{\text{Taylor Rule}}$ | 테일러 준칙 | --- | **Stage 2** (2.5.2절) |
| $\textcolor{stageTwoMarker}{\text{Mundell-Fleming}}$ | 먼델-플레밍 개방경제 모형 | --- | **Stage 2** (2.5.3절) |
| $\textcolor{stageTwoMarker}{\text{Stovall}}$ | 섹터-순환 회전 이론 | --- | **Stage 2** (2.5.5절) |
| $\textcolor{stageTwoMarker}{\text{NSS}}$ | Nelson-Siegel-Svensson 수익률 곡선 | --- | **Stage 2** (2.5.10절) |
| $\textcolor{stageTwoMarker}{\text{GZ}}$ | Gilchrist-Zakrajsek 신용 스프레드 | --- | **Stage 2** (2.5.4절) |

> **이전 Stage 데이터:** Stage 1에서 수집된 $\textcolor{stageOneMarker}{\text{bok\_rate}}$, $\textcolor{stageOneMarker}{\text{term\_spread}}$, $\textcolor{stageOneMarker}{\text{vix}}$, $\textcolor{stageOneMarker}{\text{taylor\_gap}}$, $\textcolor{stageOneMarker}{\text{rate\_diff}}$, $\textcolor{stageOneMarker}{\text{credit\_spread}}$ 등 거시 지표가 본 절에서 F1~F9 요인으로 변환된다. Stage 2의 IS-LM, 테일러 준칙, 먼델-플레밍 이론이 각 요인의 조정 방향과 크기를 결정하는 학술적 근거를 제공한다.

**CONF-계층1: 거시 신뢰도 (11개 요인)**

학술적 기반: IS-LM (Hicks 1937), 테일러 준칙 (Taylor 1993), 먼델-플레밍
(Mundell 1963), Stovall (1996), NSS 수익률 곡선 (Nelson-Siegel 1987),
Gilchrist-Zakrajsek (2012) 신용 스프레드.

| 요인 | 이론 | 논문 | 크기 | 등급 |
|------|------|------|------|------|
| F1 경기순환 | IS-LM 총수요 | Hicks (1937) | +/-6~10% | [B] |
| F1a Stovall 섹터 | 섹터-순환 민감도 | Stovall (1996) | 섹터별 * 0.5x | [C] |
| F2 수익률 곡선 | 기간구조 신호 | Harvey (1986) | +/-3~12% | [B] |
| F3 신용 국면 | 신용 스프레드 긴장 | Gilchrist-Zakrajsek (2012) | -7~-18% 매수 | [B] |
| F7 테일러 갭 | 통화정책 기조 | Taylor (1993) | +/-5% | [B] |
| F8 VRP/VIX | 변동성 위험 프리미엄 | Carr-Wu (2009) | -3~-7% | [B] |
| F9 금리차 | 먼델-플레밍 | Mundell (1963) | +/-5% | [B] |

**클램프:** [0.70, 1.25].

**CONF-계층2: 미시 신뢰도 (3개 요인)**

| 요인 | 이론 | 논문 | 크기 | 등급 |
|------|------|------|------|------|
| M1 Amihud ILLIQ | 유동성 할인 | Amihud (2002) | -15% 최대 | [A] |
| M2 HHI 보강 | 집중도 평균회귀 | Jensen-Meckling (1976) | +10% * HHI | [C] |
| M3 공매도 금지 | 가격발견 저해 | Miller (1977), D-V (1987) | -10~-30% | [B] |

**클램프:** [0.55, 1.15].

**신뢰도 체인 7계층 --- 데이터 파이프라인 참조표**

아래 표는 각 계층이 어떤 데이터 원천으로부터 수신하여 승법적 조정을
적용하는지를 추적한다. 이는 제1장 데이터 원천에서 제3장 신뢰도
산출까지의 전체 데이터 흐름을 완결한다.

| 계층 | 학문 기반 | 데이터 출처 | 조정 범위 |
|------|----------|-----------|-------|
| 1 거시 | 경제학 | 거시 경제 지표, 채권 수익률, 통계청 데이터 | [0.70, 1.25] |
| 2 미시 | 미시경제학 | OHLCV 비유동성(런타임), HHI 집중도 상수 | [0.55, 1.15] |
| 3 파생 | 금융공학 | 파생상품 요약, 투자자 수급, 옵션 분석, ETF, 공매도 | [0.70, 1.30] |
| 4 Merton | 신용위험 | 재무제표 + OHLCV 변동성 | [0.75, 1.15] |
| 5 범위 | --- | 산출 결과 (절대 범위 제약) | [10, 100] |
| 6 RORO | 국제금융 | 거시 데이터 (VIX, DXY, 금리차, 신용, VKOSPI) | [0.92, 1.08] |
| Phase8 | 통계학/거시 | MCS 복합지수, 수급 신호 | MCS/HMM 기반 |

**핵심 설계 원칙:** 모든 계층이 null-안전(null-safe)하다. 데이터가 부재하면
해당 계층의 승수는 1.0(조정 없음)으로 폴백되어 분석이 중단되지 않는다.
이는 CAP 정리의 가용성(Availability) 우선 설계와 일치한다.

**전체 신뢰도 체인 의사코드**

```
confidence = pattern.baseConfidence          // 패턴 기본 신뢰도 (0-100)
confidence *= clamp(macroMult,  0.70, 1.25)  // 계층1: 거시
confidence *= clamp(microMult,  0.55, 1.15)  // 계층2: 미시
confidence *= clamp(derivMult,  0.70, 1.30)  // 계층3: 파생
confidence *= clamp(mertonMult, 0.75, 1.15)  // 계층4: Merton DD
confidence  = clamp(confidence, 10,   100)   // 계층5: 절대 범위
confidence *= clamp(roroMult,   0.92, 1.08)  // 계층6: RORO
confidence  = clamp(confidence, 10,   100)   // 최종 범위 제약
```

각 계층의 클램프가 순차적으로 적용되므로, 최악의 경우 기본 신뢰도 65가
65 x 0.70 x 0.55 x 0.70 x 0.75 x 0.92 = 12.4로 하한에 근접하며,
최선의 경우 65 x 1.25 x 1.15 x 1.30 x 1.15 x 1.08 = 100 상한에 도달한다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 거시 신뢰도 조정 (F1~F9) | `_applyMacroConfidenceToPatterns()` | 11개 거시 요인 승법적 적용, 클램프 [0.70, 1.25] |
| 미시 신뢰도 조정 (M1~M3) | `_applyMicroConfidenceToPatterns()` | 3개 미시 요인 승법적 적용, 클램프 [0.55, 1.15] |
| Stovall 섹터 매핑 | `STOVALL_SECTOR_MAP` (appState.js) | KSIC 대분류 -> 경기순환 4단계 민감도 |
| 테일러 갭 산출 | `taylor_gap` (macro_latest.json) | 통화정책 기조 판별: 완화/긴축 |
| 수익률 곡선 4-체제 | `yieldCurvePhase` (appState.js) | steepening/flattening/normal/inverted |
| 신용 스프레드 | `credit_spreads.aa_spread` (bonds_latest.json) | 신용 긴장 시 매수 패턴 감산 |
| Amihud ILLIQ | `calcAmihudILLIQ()` (indicators.js) | 종목별 유동성 할인 (-15% 최대) |
| HHI 집중도 | `ALL_STOCKS` 시가총액 기반 산출 | 산업 집중도 평균회귀 보상 |
| 공매도 금지 효과 | `shortSellingBanned` (appState.js) | 가격발견 저해 -> 신뢰도 감산 |

\newpage

### 3.4.3 국면 결합 신뢰도 (Regime Combination Confidence)

**개요**

CONF-계층1~4의 승법적 조정이 완료된 후, 신뢰도 체인의 최종 단계에서
거시경제 국면(regime)의 복합 판단이 적용된다. 이 단계는 두 개의 독립적인
국면 분류 체계 --- Phase 8 결합(CONF-계층5)과 RORO 국면(CONF-계층6) ---로
구성된다.

Phase 8 결합은 Hamilton(1989)의 은닉 마르코프 모형(HMM)으로 추정된
시장 국면(bull/bear/sideways)과 MCS v2 거시복합점수, 외국인 수급 방향,
옵션 내재변동성을 통합하여 패턴 신뢰도를 조정한다. HMM은 관측 불가능한
"레짐"이 관측 가능한 수익률의 통계적 특성을 결정한다고 가정하며,
Hamilton(1989)은 미국 전후 데이터에서 2개 변동성 레짐(강세: 월 수익률
+0.9%, 변동성 4.5% / 약세: -0.3%, 7.2%)을 식별한 바 있다. CheeseStock은
투자자 수급 데이터에 Baum-Welch EM 알고리즘을 적용하여 3-state 레짐을
추정하고, `REGIME_CONFIDENCE_MULT`를 통해 매수/매도 패턴에 차등 승수를
적용한다.

RORO(Risk-On/Risk-Off) 국면 분류는 Baele, Bekaert, and Inghelbrecht(2010)의
주식-채권 수익률 공분산 체계에 기반한다. VKOSPI/VIX 수준, 신용 스프레드,
USD/KRW 환율, MCS v2, 투자자 정렬의 5개 요인을 가중합하여 복합 점수를
산출하고, 히스테리시스(hysteresis) 임계값을 적용하여 risk-on/neutral/risk-off
3개 체제로 분류한다. 히스테리시스 설계는 체제 전환의 과도한 빈도(whipsaw)를
방지한다. 진입 임계($\pm 0.25$)가 이탈 임계($\pm 0.10$)보다 크므로,
일단 체제에 진입하면 더 작은 변동에 의해 쉽게 이탈하지 않는다.

RORO 클램프 [0.92, 1.08]은 전체 체인에서 가장 좁은 범위로 설정되어 있다.
이는 RORO의 구성 요인(VIX, 신용스프레드)이 이미 CONF-계층1의 F3(신용 국면)과
F8(VRP/VIX)에서 반영되었기 때문이며, 이중 반영(double-counting)을 방지하기
위한 의도적 제약이다.

**핵심 공식**

$$C_{\text{final}} = \text{clamp}\!\left(C_{\text{adj}} \times \text{clamp}(\text{roroMult}, 0.92, 1.08),\; 10,\; 100\right)$$

$$\text{Phase 8}: \quad C_{\text{adj}} = C_{\text{prev}} \times m_{\text{MCS}} \times m_{\text{HMM}}(S_t, \text{dir}) \times m_{\text{flow}} \times m_{\text{IV}}$$

$$\text{RORO}: \quad \text{roroScore} = \sum_{i=1}^{5} w_i \cdot f_i \times \min\!\left(\frac{n_{\text{valid}}}{3},\; 1.0\right)$$

**Phase 8 세부 조정 로직:**

$$m_{\text{MCS}} = \begin{cases} 1.05 & \text{if } \text{MCS}_{v2} \geq 70 \text{ and signal} = \text{buy} \\ 1.05 & \text{if } \text{MCS}_{v2} \leq 30 \text{ and signal} = \text{sell} \\ 1.00 & \text{otherwise} \end{cases}$$

$$m_{\text{HMM}} = \text{REGIME\_CONFIDENCE\_MULT}[S_t][\text{dir}]$$

$$m_{\text{flow}} = \begin{cases} 1.03 & \text{if foreignMomentum aligns with signal direction} \\ 1.00 & \text{otherwise} \end{cases}$$

$$m_{\text{IV}} = \begin{cases} 0.90 & \text{if } \text{IV/HV} > 2.0 \\ 0.93 & \text{if } \text{IV/HV} > 1.5 \\ 0.93 & \text{if straddleImpliedMove} > 3.5\% \text{ (fallback)} \\ 1.00 & \text{otherwise} \end{cases}$$

**RORO 히스테리시스 체제 전환:**

$$\text{regime}_{t} = \begin{cases} \text{risk-on} & \text{if } \text{prev} = \text{neutral and score} \geq 0.25 \\ \text{risk-off} & \text{if } \text{prev} = \text{neutral and score} \leq -0.25 \\ \text{neutral} & \text{if } \text{prev} = \text{risk-on and score} \leq 0.10 \\ \text{neutral} & \text{if } \text{prev} = \text{risk-off and score} \geq -0.10 \end{cases}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $C_{\text{adj}}$ | 계층1~4 조정 후 신뢰도 | 0--100 | 본 Stage (3.4.1) |
| $C_{\text{final}}$ | 최종 신뢰도 | 0--100 | 본 Stage |
| $S_t$ | 시점 $t$의 HMM 은닉 레짐 | bull/bear/sideways | **Stage 1** (flow\_signals.json) |
| $\textcolor{stageOneMarker}{\text{hmmRegimeLabel}}$ | HMM 레짐 라벨 | 범주형 | **Stage 1** (Baum-Welch) |
| $\textcolor{stageOneMarker}{\text{MCS}_{v2}}$ | MCS v2 복합점수 | 0--100 | **Stage 1** (macro\_composite.json) |
| $\textcolor{stageOneMarker}{\text{foreignMomentum}}$ | 외국인 순매수 모멘텀 | buy/sell/null | **Stage 1** (flow\_signals.json) |
| $\textcolor{stageOneMarker}{\text{VKOSPI}}$ | 한국 변동성지수 | % | **Stage 1** (vkospi.json) |
| $\textcolor{stageOneMarker}{\text{vix}}$ | CBOE VIX | % | **Stage 1** (FRED) |
| $\textcolor{stageOneMarker}{\text{aa\_spread}}$ | AA- 신용 스프레드 | %p | **Stage 1** (bonds\_latest.json) |
| $\textcolor{stageOneMarker}{\text{us\_hy\_spread}}$ | 미국 하이일드 스프레드 | %p | **Stage 1** (macro\_latest.json) |
| $\textcolor{stageOneMarker}{\text{usdkrw}}$ | USD/KRW 환율 | 원 | **Stage 1** (yfinance) |
| $\textcolor{stageOneMarker}{\text{alignment}}$ | 투자자 정렬 신호 | aligned\_buy/sell/null | **Stage 1** (investor\_summary.json) |
| $\textcolor{stageTwoMarker}{\text{Hamilton HMM}}$ | 은닉 마르코프 모형 | --- | **Stage 2** (2.5.11절) |
| $\textcolor{stageTwoMarker}{\text{Baele-Bekaert}}$ | RORO 공분산 체계 | --- | **Stage 2** (2.6절) |
| $\textcolor{stageTwoMarker}{\text{Kang-Stulz}}$ | 외국인 투자자 행태 | --- | **Stage 2** (2.7절) |
| $\textcolor{stageTwoMarker}{\text{Simon-Wiggins}}$ | IV/HV 비율과 패턴 정확도 | --- | **Stage 2** (2.6.11절) |
| $m_{\text{MCS}}$ | MCS 기반 조정 승수 | 무차원 | 본 Stage |
| $m_{\text{HMM}}$ | HMM 레짐 기반 조정 승수 | 무차원 | 본 Stage |
| $m_{\text{flow}}$ | 외국인 방향 일치 보너스 | 무차원 | 본 Stage |
| $m_{\text{IV}}$ | 내재변동성 할인 승수 | 무차원 | 본 Stage |
| $\text{roroScore}$ | RORO 복합 점수 | [-1, +1] | 본 Stage |
| $w_i$ | 제$i$ RORO 요인 가중치 | 무차원 | 본 Stage |
| $f_i$ | 제$i$ RORO 요인 점수 | [-1, +1] | 본 Stage |
| $n_{\text{valid}}$ | 유효 입력 요인 수 | 개 | 본 Stage |

> **이전 Stage 데이터:** Stage 1에서 $\textcolor{stageOneMarker}{\text{hmmRegimeLabel}}$은 종목별로 `flow_signals.json`에 저장된다. $\textcolor{stageOneMarker}{\text{MCS}_{v2}} = 65.7$은 `macro_composite.json`의 `mcsV2` 필드에서 수집되었다. RORO 5요인의 입력 데이터($\textcolor{stageOneMarker}{\text{VKOSPI}}$, $\textcolor{stageOneMarker}{\text{aa\_spread}}$, $\textcolor{stageOneMarker}{\text{usdkrw}}$, $\textcolor{stageOneMarker}{\text{MCS}_{v2}}$, $\textcolor{stageOneMarker}{\text{alignment}}$)는 모두 Stage 1 데이터 계층에서 수집된다.

**HMM 레짐별 신뢰도 승수 (REGIME_CONFIDENCE_MULT)**

| 레짐 | 매수 승수 | 매도 승수 | 비고 |
|------|-----------|-----------|------|
| bull | 1.06 | 0.92 | 강세: 매수 +6%, 매도 -8% |
| bear | 0.90 | 1.06 | 약세: 매수 -10%, 매도 +6% |
| sideways | 1.00 | 1.00 | 횡보: 중립 |
| null | 1.00 | 1.00 | 데이터 없음: 중립 |

교정 근거: Ang and Bekaert (2002), Lunde and Timmermann (2004)의 베이지안
축소(Bayesian shrinkage) 교정. 초기값(bull buy 1.10/sell 0.85)은 IC 0.02--0.04
수준에서 과대 추정이었으며, 현행 값으로 축소되었다.

**MCS 임계값 (MCS_THRESHOLDS)**

| 구간 | 임계값 | 조정 |
|------|--------|------|
| strong_bull | MCS $\geq$ 70 | 매수 패턴 $\times$ 1.05 |
| bull | MCS $\geq$ 55 | 중립 |
| bear | MCS $\leq$ 45 | 중립 |
| strong_bear | MCS $\leq$ 30 | 매도 패턴 $\times$ 1.05 |

**RORO 5요인 구성**

| 요인 | 가중치 | 입력 변수 | 임계값 체계 |
|------|--------|-----------|------------|
| R1 VKOSPI/VIX | 0.30 | VKOSPI (VIX x proxy 폴백) | >30: -1.0 (crisis), >22: -0.5, <15: +0.5 |
| R2 신용스프레드 | 0.05 + 0.10 | AA- 스프레드 + US HY 스프레드 | AA >1.5: -1.0, HY >5.0: -1.0 |
| R3 USD/KRW | 0.20 | 환율 | >1450: -1.0, >1350: -0.5, <1200: +0.5, <1100: +1.0 |
| R4 MCS v2 | 0.15 | MCS 복합점수 (0--1 스케일) | (mcs - 0.5) x 2 선형 변환 |
| R5 투자자 정렬 | 0.15 | 외국인+기관 정렬 | aligned_buy: +0.8, aligned_sell: -0.8 |

정규화: 유효 입력이 3개 미만일 경우 $\min(n_{\text{valid}}/3,\; 1.0)$으로 비례 할인한다.

R2 신용스프레드의 AA- 가중치는 0.10에서 0.05로 축소되었다(RX-06).
이는 CONF-계층1 F3(신용 국면)과의 이중 반영을 완화하기 위함이다.
stress 시 복합 효과가 -24.6%에서 -22.1%로 -2.5pp 완화되었다.

**RORO 체제별 조정량**

| 체제 | 매수 조정 | 매도 조정 |
|------|-----------|-----------|
| risk-on | $\times$ 1.06 | $\times$ 0.94 |
| risk-off | $\times$ 0.92 | $\times$ 1.08 |
| neutral | 조정 없음 | 조정 없음 |

**클램프:** [0.92, 1.08]. 최종 범위 제약: [10, 100].

**데이터 품질 가드**

| 가드 | 조건 | 효과 |
|------|------|------|
| flowDataCount | `_flowSignals.flowDataCount > 0` | 0이면 HMM 레짐 승수 무력화 |
| per-stock flow | `foreignMomentum != null` | null이면 외국인 보너스 생략 |
| MCS 스케일 | mcs > 0 and mcs $\leq$ 1.0 | 0--1 스케일 자동 감지 -> 0--100 정규화 |
| RORO 유효 입력 | count $\geq$ 3 | 미만 시 비례 할인 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Phase 8 결합 | `_applyPhase8ConfidenceToPatterns()` (appWorker.js L563) | MCS + HMM + 외국인 수급 + IV/HV 통합 조정 |
| MCS v2 임계값 | `MCS_THRESHOLDS` (appState.js L405) | strong_bull:70, bull:55, bear:45, strong_bear:30 |
| HMM 레짐 승수 | `REGIME_CONFIDENCE_MULT` (appState.js L394) | bull/bear/sideways/null 4개 레짐 |
| RORO 국면 분류 | `_classifyRORORegime()` (appWorker.js L1381) | 5요인 가중합 + 히스테리시스 |
| RORO 패턴 적용 | `_applyRORORegimeToPatterns()` (appWorker.js L1500) | risk-on/off/neutral 체제별 차등 |
| 레짐-변동성 매트릭스 | Doc29 &sect;6.1 + VKOSPI 20/25 임계 | Goldilocks/Hot/Quiet Bear/Crisis 2x2 분류 |
| IV/HV 패턴 정확도 | Simon and Wiggins (2001) | IV/HV > 1.5: 패턴 신뢰도 -7~-10% |
| 외국인 정보거래 | Kang and Stulz (1997) | 방향 일치 시 +3% 보너스 |

\newpage
