---
title: "CheeseStock ANATOMY V8: 이론적 정합성 흐름"
subtitle: "원천 데이터에서 최종 전달까지 --- KRX 기술적 분석의 학술적 계보"
author: "이선호, 최민규"
date: "2026년 4월"
version: "V8 KO"
---

# CheeseStock ANATOMY V8

---

## 서론 {.unlisted .unnumbered}

기술적 분석(technical analysis)은 Fama(1970)의 효율적 시장 가설이 지배하던 시기에 학술적 정당성을 인정받기 어려웠으나, Lo(2004)의 적응적 시장 가설과 Brock, Lakonishok & LeBaron(1992)의 이동평균 규칙 수익성 실증은 가격 패턴에 내재된 정보적 가치를 재조명하였다. 그러나 개별 지표가 학술적 근거를 갖추더라도, 그것이 다른 지표·밸류에이션 모형·거시경제 변수와 결합되는 과정에서 이론적 정합성(theoretical coherence)이 단절되면 시스템 전체의 신뢰성은 보장될 수 없다. 대부분의 기술적 분석 시스템은 지표의 수학적 기원, 패턴 인식의 통계적 검정력, 그리고 최종 신호가 투자 의사결정에 이르는 경로를 명시적으로 추적하지 않는다. 본 문서는 이 문제에 대한 체계적 응답이다.

CheeseStock은 한국거래소(KRX) 상장 2,700여 종목을 대상으로 31개 기술적 지표, 32종의 가격 패턴, 31개 개별 신호 및 30개 복합 신호를 산출하는 분석 체계이다. 이 체계가 여타 도구와 구별되는 핵심은 이론적 추적 가능성(theoretical traceability)에 있다. 원천 데이터 수집에서 최종 시각화에 이르기까지, 각 연산 단계는 금융학, 통계학, 물리학, 수학, 경제학, 심리학 등 6개 학문 분야에 걸친 48개 학술 문서에 의해 그 정당성이 뒷받침된다. CAPM의 $\beta$ 추정(Sharpe, 1964)이 Fama-French 3-팩터 모형(1993)으로 확장되고, 이것이 거시경제 레짐 분류(Hamilton, 1989)와 결합하여 패턴 신뢰도를 조정하는 과정은 각 이론이 독립적으로 존재하는 것이 아니라 하나의 정합적 체인을 구성함을 보여준다.

본 문서는 5단계 구조---데이터 수집(제1장), 이론적 토대(제2장), 기술적 분석(제3장), 시각적 변환(제4장), 최종 전달(제5장)---를 통해 이 체인 전체를 추적하되, 각 단계가 반드시 이전 단계의 이론적 산출물 위에 구축되도록 설계하였다. 이를 통해 두 가지를 보장한다. 첫째, 시스템이 산출하는 모든 수치는 검증 가능한 학술 이론에 기반하며 그 기원이 명시적으로 추적 가능하다는 점이다. 둘째, 이론 간 연결이 단절되거나 학술적 근거 없이 존재하는 연산은 허용되지 않는다는 점이다.

---


\newpage


# 제1장: 데이터와 API — 원천 자료

## 1.0 이론적 프레이밍

모든 재무 모형은 입력 데이터의 품질에 의해 그 정확성의 상한이 결정된다. CAPM이 시장 위험 프리미엄을 추정하든, GARCH가 변동성 클러스터를 포착하든, Merton 모형이 부도확률을 산출하든, 이론적으로 아무리 정교한 모형이라도 원천 데이터가 부정확하거나 불완전하면 그 출력은 신뢰할 수 없다. 예컨대, CAPM(제2장 2.5.1절)이 정확한 $\beta$를 산출하려면 액면분할과 유상증자를 반영한 수정주가(adjusted OHLCV)가 필수적이며, 수정하지 않은 원시 가격은 허위 수익률과 왜곡된 위험 추정치를 생산한다.

본 장은 이러한 이론적 전제조건을 충족시키기 위해 시스템이 어떤 데이터를 왜 수집하며, 어떻게 품질을 보장하는지를 기술한다. 아래 표는 주요 재무 이론이 요구하는 데이터를 범주별로 정리한 것이다.

| 이론적 전제 | 데이터 유형 | 출처 |
|------------|-----------|------|
| 자산가격결정 (CAPM, FF3) | 수정주가·수익률 | KRX |
| 변동성 모형 (GARCH, 허스트) | 가격 시계열 | KRX (pykrx) |
| 신용위험 (Merton DD) | 재무제표 | DART |
| 거시환경 (IS-LM, 테일러) | 경제지표 | ECOS, FRED |
| 옵션가격결정 (BSM) | 파생상품 거래 | KRX Open API |
| 행동재무학 (군집행동) | 투자자 수급 | KRX OTP |

## 학문적 토대: 데이터 계층

본 장은 데이터 수집·저장·전달 계층을 다루며, 다음 학문 분야의 원리가 적용된다.

| 학문 분야 | 적용 대상 | 핵심 원칙 |
|----------|----------|----------|
| **정보과학** (Information Science) | 데이터 출처 추적, 메타데이터 | 데이터 계보(lineage) 추적, 신뢰도 등급 체계 |
| **데이터 공학** (Data Engineering) | ETL 파이프라인, 캐싱 | 3-Tier 캐시, TTL 정책, 증분 수집 |
| **도서관학** (Library Science) | 데이터 분류·색인 | 시장/종목/타임프레임 계층적 네이밍 |
| **신호처리** (Signal Processing) | 브라운 브릿지 보간 | 일봉에서 분봉으로의 확률적 보간법 |
| **분산시스템** (Distributed Systems) | 이중 모드, 서비스 워커 | CAP 정리 — 가용성 우선(AP) 설계 |

이 학문 분야들은 제2장의 순수 학술 이론이 작동하기 위한 **데이터 전제조건**을 보장한다.

---

## 데이터 원천 → 이론 활용 연결표

아래 표는 각 데이터 범주가 **어떤 학술 이론(제2장)과 기술적 구현(제3장)에 의해 소비되는지**를 역추적한다.

| 데이터 범주 | 학술적 근거 (제2장) | 활용 계층 (제3장) |
|-----------|-------------------|-----------------|
| 가격·수익률 (OHLCV) | 모든 기술적 분석, GARCH, 허스트 지수, CAPM β | 지표 I-01~I-31, 패턴 P-01~P-32 |
| 재무제표 (DART) | DCF, Merton DD, PER/PBR/EVA | 재무 패널, CONF-DD1 |
| 거시 환경 (금리·물가·생산) | IS-LM, 테일러 준칙, MCS v2 경기판단 | CONF-F1~F9, CONF-Phase8 |
| 채권·금리기간구조 | NSS 수익률곡선, 듀레이션, CAPM 무위험이자율 R_f | CONF-F2, F3 |
| 투자자 수급 | 행동재무학, 군집행동, 정보거래자 이론 | CONF-D3 |
| 파생상품·옵션 | BSM, 보유비용모형, Greeks | CONF-D1, D2 |
| 변동성 지수 (VKOSPI) | VRP, Whaley (2009) 내재변동성 | CONF-S28, I-14 |
| 국면 판단 (MCS, HMM) | Hamilton (1989) HMM, Fama-French (1993) | CONF-Phase8 |

---

## 1.1 데이터 수집 개요

CheeseStock은 5개 공공 데이터 원천과 1개 증권사 실시간 피드로부터 데이터를 수집한다. 아래 표는 각 원천에서 수집하는 핵심 데이터 항목과 해당 데이터가 투입되는 이론적 모형을 요약한다.

### API 데이터 원천

| 원천 | 수집 데이터 | 이론적 활용처 |
|------|-----------|-------------|
| KRX (한국거래소) | 전종목 수정주가(OHLCV), 시가총액, 투자자유형별 순매수, 선물·옵션, VKOSPI, 공매도 | CAPM β, GARCH σ², 허스트 H, 전 패턴·지표 |
| DART (전자공시) | 연결·별도 재무제표 (매출액, 영업이익, 순이익, 자산·부채·자본, EPS) | DCF, Merton DD, PER/PBR/EVA |
| BOK ECOS (한국은행) | 기준금리, 국고채 3Y·10Y, M2, CPI, BSI, IPI, 수출액, 실업률 | IS-LM, 테일러 준칙, MCS v2 |
| FRED (미국 연준) | Fed Funds Rate, US 10Y Treasury, VIX | 글로벌 금리환경, 변동성 대리변수 |
| KOSIS (통계청) | 경기선행지수(CLI), 경제심리지수(ESI), 산업생산지수(IPI) | MCS v2 구성요인 |

### 보조 API 및 실시간 원천

| 원천 | 수집 데이터 | 이론적 활용처 |
|------|-----------|-------------|
| OECD SDMX | 한국·미국·중국 경기선행지수(CLI) | MCS v1 교차검증 |
| yfinance | USD/KRW, DXY 환율 | 환율 레짐 판단, 수출주 민감도 |
| 키움증권 OpenAPI+ | 장중 실시간 체결가·체결량·호가 | 실시간 지표·패턴 재계산 |

### API 외 데이터

| 구분 | 성격 |
|------|------|
| 분봉 데이터 (1m~1h) | 일봉 기반 브라운 브릿지 확률적 보간으로 생성한 통계적 산출물 |
| BSM 파생 산출물 | 원시 옵션 거래 데이터로부터 Newton-Raphson으로 산출한 내재변동성·스큐·최대고통 |
| HMM 레짐 분류 | 투자자 순매수 데이터로부터 Hamilton (1989) 2상태 가우시안 HMM으로 산출 |

---

## 1.2 데이터 원천 상세

### 1.2.1 OHLCV — KRX

모든 기술적 분석 지표는 가격 시계열을 입력으로 요구한다. CAPM의 $\beta$, GARCH의 $\sigma^2$, 허스트 지수의 $H$ 모두 수정주가(adjusted OHLCV)를 전제한다.

**원천:** 한국거래소(KRX)의 수정주가를 수집한다. 액면분할·병합을 반영한 수정주가를 사용하여 허위 수익률과 왜곡된 패턴을 방지한다.

**수집 항목:** 전종목 약 2,700개의 일별 시가·고가·저가·종가·거래량(OHLCV)과 시가총액. 분봉은 1분·5분·15분·30분·1시간 5종으로, 일봉을 기반으로 브라운 브릿지 확률적 보간을 적용하여 생성한다.

**이론적 소비:** CAPM $\beta$(2.5.1절), GARCH 변동성(2.1절), 허스트 지수(2.1절), 전체 기술적 지표 및 패턴(제3장)

### 1.2.2 재무제표 — DART

기업가치 평가(DCF, Merton DD)와 투자지표(PER/PBR/EVA)는 재무제표 데이터를 필수 입력으로 요구한다.

**원천:** 금융감독원 전자공시시스템(DART) API를 통해 수집한다. 연결재무제표(CFS)를 우선 사용하며, 미제공 종목은 별도재무제표(OFS)로 대체한다. 매출액·수익(매출액)·영업수익 등 동일 항목의 계정과목명 차이는 통일하여 처리한다.

**수집 항목:** 매출액, 영업이익, 당기순이익, 자산총계, 부채총계, 자본총계, EPS (분기·연간)

**이론적 소비:** DCF(2.5절), Merton DD(2.5.3절), PER/PBR/EVA(2.5.2절), ROE/ROA(2.5.2절)

### 1.2.3 거시경제 — ECOS / FRED / KOSIS / OECD / yfinance

거시경제 환경은 자산가격에 체계적 영향을 미친다. IS-LM 모형의 금리-산출 관계, 테일러 준칙의 통화정책 경로가 시장 수익률의 조건부 기대치를 변동시킨다.

**원천:** 5개 외부 API에서 거시경제 지표를 수집한다.

| API | 주요 지표 |
|-----|----------|
| BOK ECOS | 기준금리, 국고채 3Y·10Y, M2, CPI, CLI, BSI, 수출액, IPI |
| FRED | Fed Funds Rate, US 10Y Treasury, VIX |
| KOSIS | 경기선행지수(CLI), 경제심리지수(ESI), 산업생산지수(IPI) |
| OECD SDMX | 한국·미국·중국 경기선행지수(CLI) |
| yfinance | USD/KRW, DXY 환율 |

수집된 지표는 MCS v2(거시경제 복합점수, 0-100 퍼센타일)로 종합된다.

**MCS v2 구성요인 (8요인)**

| 요인 | 가중치 | 데이터 출처 | 정규화 방식 |
|------|-------|---------|--------|
| CLI (선행지수) | 0.20 | KOSIS | range(80,130) |
| ESI (경제심리) | 0.15 | KOSIS | range(60,120) |
| IPI (산업생산) | 0.15 | KOSIS | range(70,130) |
| 소비자신뢰 | 0.10 | KOSIS (ESI 대리) | range(60,130) |
| PMI (BSI 제조업) | 0.10 | ECOS | range(50,120) |
| 수출 YoY | 0.10 | ECOS | range(-30,40) |
| 실업률 역수 | 0.10 | ECOS | 1-range(2,6) |
| 금리스프레드 | 0.10 | 파생 (국고10Y-국고3Y) | range(-1,3) |

**정규화:** range\_norm(low, high) = clamp((value - low) / (high - low), 0, 1). 누락 지표는 제외하고 가중치를 비례 재분배한다. 최종 점수 = 가중합 × 100 (0-100).

**설계 주의사항:** 소비자신뢰와 ESI가 동일 KOSIS 원천을 사용한다. KOSIS 가용 시 ESI의 실질 가중치는 0.25(0.15+0.10)로 의도보다 크다. 향후 독립적 소비자신뢰 원천 분리가 필요하다.

**이론적 소비:** IS-LM(2.5.1절), 테일러 준칙(2.5.2절), MCS v2 신뢰도 조정(제3장). MCS v2 ≥ 70이면 매수 패턴 신뢰도 상향, ≤ 30이면 매도 패턴 신뢰도 상향.

### 1.2.4 투자자 수급 — KRX

행동재무학에서 투자자 유형별 수급 불균형은 가격 발견 과정의 정보 비대칭을 반영한다. 외국인 순매수 모멘텀은 정보거래자(informed trader) 활동의 대리변수로 활용된다.

**원천:** KRX 정보데이터시스템에서 투자자유형별 거래실적을 수집한다.

**수집 항목:** 외국인·기관·개인 등 12개 유형별 순매수 (KOSPI·KOSDAQ 일별)

**파생 산출물:** 순매수 누적 시그널, Hamilton (1989) 2상태 가우시안 HMM 레짐 분류. 샘플 데이터로 판별된 경우 분석에서 제외한다.

**이론적 소비:** 행동재무학 군집행동(2.6절), 정보거래자 이론, 신뢰도 조정(제3장)

### 1.2.5 파생상품 — KRX

옵션시장은 Black-Scholes-Merton 모형을 통해 내재변동성(IV)이라는 전방향적(forward-looking) 위험 측정치를 제공한다. 선물 베이시스는 보유비용모형의 실증적 검정 수단이다.

**원천:** KRX Open API에서 선물·옵션 거래 데이터를 수집한다.

**수집 항목:** 선물 베이시스·미결제약정, 옵션 거래 데이터, 공매도 잔고(SIR)

**파생 산출물:** Newton-Raphson BSM 내재변동성, ATM straddle 내재이동폭, P/C Ratio, 25-delta 스큐, 최대고통 행사가

**이론적 소비:** BSM 옵션가격결정(2.6.10절), 보유비용모형, VRP(2.6.11절), Greeks(2.6.11절)

### 1.2.6 실시간 시세 — 키움증권

장중 실시간 가격 갱신은 기술적 분석의 시의성을 보장한다. 장 마감 후 정적 데이터가 전일 종가까지만 반영하는 반면, 실시간 모드는 체결 즉시 지표와 패턴을 재계산할 수 있다.

**원천:** 키움증권 OpenAPI+를 통해 실시간 체결 데이터를 수신한다. 초당 4회 이하의 요청 제한과 단일 계정 동시 접속 1개 제약이 적용된다. 실시간 연결이 불가능한 경우 정적 데이터 모드를 유지한다.

**수집 항목:** 체결가·체결량·호가 실시간 스트림

**이론적 소비:** 장중 기술적 지표·패턴 실시간 재계산(제3장 전체)

---


\newpage


# 제2장: 학술적 기반 --- 이론적 토대

> CheeseStock KRX 실시간 차트 시스템의 학술적 정합성 문서.
> 본 시스템에 구현된 모든 수식과 알고리즘은 물리학, 수학, 통계학, 경영학, 경제학,
> 금융학, 행동재무학의 학술적 기반 위에 서 있다. 본 장은 각 학문 분야의 핵심 이론이
> 어떻게 기술적 분석 시스템으로 구체화되는지를 추적한다.
> 판본: V8 (2026-04-10) | 7개 학문 67 시트

---

## 2.1 물리학적 기초: 경제물리학[^phys-1]

경제물리학(Econophysics)은 통계역학, 스케일링 이론, 임계현상(critical phenomena)의
방법론을 금융시장에 적용하는 학제간 연구 분야이다. 이 분야가 기술적 분석에서
차지하는 위상은 독특하다. 기존 금융학이 가우시안(Gaussian) 분포를 전제하여
시장의 분포적 특성을 설명하는 데 근본적 한계를 드러낸 반면, 경제물리학은
시장이 *왜* 정규분포를 따르지 않는지에 대한 가장 심층적인 설명을 제공한다.
본 시스템의 극단값 이론(EVT) 보정, 변동성 국면 분류, 허스트 지수 산출은
모두 이 물리학적 토대 위에 구축되어 있다.

**이론적 흐름 (3시트):** 통계역학과 시장 온도 (2.1.1) → 멱법칙과 두꺼운 꼬리 (2.1.2) → 자기유사성과 프랙탈 (2.1.3). 균형 열역학에서 비균형 임계현상으로, 가격 분포의 물리학적 기원을 추적한다.


### 2.1.1 통계역학과 시장 온도 (Statistical Mechanics & Market Temperature)
볼츠만 분포(Boltzmann, 1877)는 열적 평형 상태에 있는 물리계에서
각 미시상태(microstate)의 확률을 결정하는 근본 법칙이다. Mantegna and
Stanley (2000)가 체계화한 바와 같이, 통계역학과 금융시장 사이에는
단순한 비유를 넘어선 구조적 대응(structural correspondence)이 존재한다.
$$P(E) = \frac{1}{Z} \exp\left(-\frac{E}{k_B T}\right)$$

| 기호 | 의미  |
|------|------|
| P(E) | 에너지 E 상태의 확률  |
| Z | 분배함수 Σi exp(-Ei/k_BT)  |
| E | 미시상태 에너지 → 균형 가격 이탈  |
| k_B | 볼츠만 상수  |
| T | 절대온도 → 시장 변동성  |
| σ_(EWMA) | EWMA 변동성 (시장 온도 조작화)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\sigma_{\text{EWMA}}}$는 Stage 1 데이터 계층에서 수집된 가격 시계열로부터 산출된 EWMA 변동성이다.

**물리학-금융학 대응 관계**

| 물리학 | 금융학 | 대응 의미 |
|--------|--------|-----------|
| 에너지 E | 균형 가격으로부터의 이탈 | 이탈이 클수록 고에너지 상태 |
| 온도 T | 시장 변동성 | 높은 변동성 = 열적 무질서 |
| 분배함수 Z | 시장 정규화 상수 | 모든 상태에 걸친 확률의 총합 |
| 열적 평형 | 효율적 시장 정상상태 | 모든 정보가 가격에 반영 |
| 상전이 | 국면 전환(regime change) | 주문 흐름의 대칭 깨짐 |

### 2.1.2 이징 모형과 군집행동 (Ising Model & Herding)
이징 모형(Ising, 1925)은 통계역학에서 협동 현상을 설명하는 최소 모형이다.
매개변수의 금융시장 사상(Bornholdt, 2001)은 군집행동과 역추세 행동의
미시적 메커니즘을 제공하며, CSAD 군집 지표의 이론적 기반이 된다.
$$\mathcal{H} = -J \sum_{\langle i,j \rangle} s_i \cdot s_j - h \sum_i s_i$$

| 기호 | 의미  |
|------|------|
| H | 해밀토니안 (시스템 총 에너지)  |
| si = ± 1 | 참여자 i의 매수(+1)/매도(-1)  |
| J > 0 | 상호작용 결합 → 군집행동(herding)  |
| J < 0 | 역추세(contrarian) 행동 → 평균회귀  |
| h | 외부장(external field) → 뉴스/정보 강도  |
| CSADt | 횡단면 절대 편차 (군집 경험적 지문)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{CSAD_t}$는 Stage 1에서 수집된 개별종목 수익률과 시장수익률로부터 산출된다.

### 2.1.3 멱법칙과 두꺼운 꼬리 (Power Law & Fat Tails)
멱법칙(power law) 분포(Mandelbrot, 1963)는 금융 수익률이 가우시안 분포를
따르지 않는다는 결정적 증거를 제공한다. Gopikrishnan et al. (1999)의
"역세제곱 법칙" ($\alpha \approx 3$)은 극단 사건의 빈도가 정규분포의
예측보다 수천 배 높음을 보여, EVT 보정의 필요성을 정당화한다.
$$P(x) \sim x^{-\alpha}, \quad x > x_{\min}$$

$$\log P(x) = -\alpha \cdot \log x + C$$

| 기호 | 의미  |
|------|------|
| α | 꼬리지수(tail exponent)  |
| x_(min) | 멱법칙 하한 임계값  |
| α̂ | 힐 추정량으로 측정된 꼬리지수  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\hat{\alpha}}$는 Stage 1의 OHLCV 데이터로부터 힐 추정량(`Hill estimator`)으로 산출된다.

| 특성 | 가우시안 (α = ∞) | 멱법칙 (α ≈ 3) |
|------|---------------------------|-------------------------------|
| ± 3σ 빈도 | 0.27% (연 1회) | 1--2% (연 3--5회) |
| ± 5σ 빈도 | 6 × 10⁻⁷ | 위기 시 관측됨 |
| ± 10σ 빈도 | 10⁻²³ | 1987년 블랙 먼데이 실제 발생 |

### 2.1.4 자기조직화 임계성과 버블 감지 (SOC & Bubble Detection)
자기조직 임계성(SOC, Bak et al., 1987)에 따르면, 시장은 외부 매개변수의
미세 조정 없이도 자연스럽게 임계 상태로 진화하며, 스케일-프리 눈사태가
발생한다. 차트 패턴(삼각형, 쐐기, 머리어깨)은 임계 전이 이전의 축적 단계에서
나타나는 기하학적 지문이며, 돌파 이후 가격 이동의 크기가 멱법칙 분포를 따른다.
$$P(S) \sim S^{-\tau}$$

여기서 $S$는 눈사태 크기(돌파 후 가격 이동), $\tau$는 눈사태 지수이다.

| 기호 | 의미  |
|------|------|
| S | 눈사태 크기 (돌파 후 가격 이동)  |
| τ | 눈사태 지수  |

대수주기 멱법칙(LPPL, Sornette, 2003)은 "진동을 동반하는 가속 가격
패턴이 반전에 선행한다"는 통찰을 제공한다. 두 이론 모두
CheeseStock에서 직접 계산되지는 않으나, 차트 패턴 설계의 개념적 기반이다.

### 2.1.5 물리학 도출 요약 (Physics Summary)

## §2.1 물리학적 기초 — 시트별 요약

경제물리학의 4개 시트는 서로 다른 구현 심도를 보인다. 통계역학(2.1.1)과 멱법칙(2.1.3)은 `calcEWMAVol()`, `classifyVolRegime()`, `calcHillEstimator()` 함수로 완전 구현되어 있으며, 이징 모형(2.1.2)의 CSAD 군집 지표는 `patterns.js`에 직접 소비 코드가 존재한다. 자기조직화 임계성(2.1.4)은 삼각형·쐐기 패턴 설계의 개념적 토대로만 반영되어 있다.

| 시트 | 핵심 모형 | 주요 학술 출처 | KRX 전달 경로 | 구현 상태 |
|---------------|--------------------|--------------------|------------------------------|---------------|
| 2.1.1 통계역학과 시장 온도 | 볼츠만 분포 P(E) ∝ e^(−E/k_BT); 시장 온도 = EWMA 변동성 σ_EWMA | Mantegna & Stanley (2000); RiskMetrics (1996) | OHLCV 종가 → `calcEWMAVol(λ=0.94)` → `classifyVolRegime()` → `signalEngine` 국면 분류기 → 패턴 신뢰도 보정 | ✅ 구현 완료 |
| 2.1.2 이징 모형과 군집행동 | 해밀토니안 H = −JΣs_is_j − hΣs_i; J>0 군집·J<0 역추세 | Bornholdt (2001); Chang, Cheng & Khorana (2000) | 시장 수익률 → CSAD 일별 지표(`csad_herding.daily`) → 3일 이동 평균 `herdingFlag` → `patterns.js` 신뢰도 ±보정 | 🔧 부분 구현 |
| 2.1.3 멱법칙과 두꺼운 꼬리 | P(x) ∼ x^(−α), α ≈ 3 (역세제곱); Hill 추정량 α̂ | Mandelbrot (1963); Gopikrishnan et al. (1999); Hill (1975) | OHLCV 수익률 배열 → `calcHillEstimator()` → `isHeavyTail`(α<4) → EVT-보정 볼린저 밴드 자동 확대 + ATR cap 동적화 | ✅ 구현 완료 |
| 2.1.4 자기조직화 임계성과 버블 감지 | P(S) ∼ S^(−τ) SOC 눈사태; LPPL 대수주기 멱법칙 진동 | Bak et al. (1987); Sornette (2003) | 임계 전이 기하학 → 삼각형·쐐기 패턴 설계 (`detectRisingWedge` 등) → 돌파 후 목표가 분포 | 📐 설계 기반 |

---

## 2.2 수학적 기초[^math-1]

수학은 모든 금융 모형이 표현되는 형식 언어(formal language)이다. 확률과정은
옵션 가격결정과 위험 관리의 근간이 되는 연속시간 모형을 생성하고,
프랙탈 수학은 금융 시계열이 시간 척도 간 자기유사성(self-similarity)을
보이는 이유를 설명한다. 이 자기유사성이야말로 기술적 분석이
모든 시간대(timeframe)에서 작동하는 근본적 이유이다.

**이론적 흐름 (6시트):** 확률론 (2.2.1) → 마팅게일 (2.2.2) → 브라운 운동 (2.2.3) → 프랙탈 수학 (2.2.4) → 선형대수와 릿지 (2.2.5) → 최적 제어 (2.2.6). 확률의 공리적 기초에서 상태 추정의 최적화까지, 금융 모형의 수학적 언어를 구축한다.


### 2.2.1 확률론: 콜모고로프 공리와 베이즈 정리 (Probability: Kolmogorov & Bayes)
본 시스템의 모든 확률 계산은 Kolmogorov (1933)의 공리적 기초 위에 놓여 있다.
베이즈 정리는 다수의 패턴이 동시에 감지될 때 신뢰도를 융합하는 형식적
프레임워크를 제공하며, 마르팅게일 이론은 기술적 분석의 존재론적 전제를 정의한다.
$$P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}$$

| 기호 | 의미  |
|------|------|
| P(A|B) | 사후확률 (패턴 관측 후 상승 확률)  |
| P(B|A) | 우도 (상승 시 패턴 관측 확률)  |
| P(A) | 사전확률 (기저 상승률)  |
| 패턴i | Stage 1에서 감지된 캔들/차트 패턴  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{패턴i}$은(는) Stage 1 데이터 계층에서 산출된다.


**다중 패턴 신뢰도 융합 (나이브 베이즈)**

$$P(\text{상승} | \text{패턴}_1, \text{패턴}_2, \ldots) \propto P(\text{상승}) \cdot \prod_i P(\text{패턴}_i | \text{상승})$$

### 2.2.2 마르팅게일 이론 (Martingale Theory)
마르팅게일은 효율적 시장 가설(EMH)의 수학적 표현이다. 기술적 분석은
본질적으로 마르팅게일 속성에 대한 내기(bet)이며, Lo and MacKinlay (1999)의
경험적 증거는 시장이 순수 마르팅게일과 일치하지 않는 자기상관 구조를 보인다는
것을 시사하여, 패턴 기반 예측의 전제를 뒷받침한다.
$$E[X_{n+1} | X_1, X_2, \ldots, X_n] = X_n$$

| 기호 | 의미  |
|------|------|
| Xn | 시점 n의 가격 (또는 로그가격)  |
| Φt | 시점 t까지의 정보 집합  |
| μ | 상수 드리프트 (EMH 하)  |

### 2.2.3 브라운 운동과 이토 해석학 (Brownian Motion & Ito Calculus)
기하 브라운 운동(GBM)은 Black-Scholes 모형의 토대이며, 데모 모드의 가격
시뮬레이션 모형이다. 이토 보조정리(Ito's Lemma)는 확률 해석학의 연쇄 법칙으로,
BSM PDE 도출과 로그수익률 기반 지표 계산의 이론적 기반이다.
$$dS_t = \mu S_t \, dt + \sigma S_t \, dW_t$$

해: $S_t = S_0 \cdot \exp\left((\mu - \sigma^2/2)t + \sigma W_t\right)$

**이토 보조정리**

$$df = \left(\frac{\partial f}{\partial t} + \mu S \frac{\partial f}{\partial S} + \frac{1}{2}\sigma^2 S^2 \frac{\partial^2 f}{\partial S^2}\right) dt + \sigma S \frac{\partial f}{\partial S} \, dW$$

| 기호 | 의미  |
|------|------|
| St | 시점 t의 주가  |
| μ | 드리프트 (기대수익률)  |
| σ | 확산 계수 (변동성)  |
| Wt | 표준 위너 과정  |
| Pt | Stage 1에서 수집된 실시간/일봉 가격  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{Pt}$은(는) Stage 1 데이터 계층에서 산출된다.


> **시그마($\sigma$) 기호의 구별**

| 기호 | 맥락 | 단위 | 예시 |
|------|------|------|------|
| σ_(GBM) | GBM 확산 계수 | 무차원 (연율화) | 0.30 = 연 30% |
| σ_(price) | 가격 표준편차 (볼린저) | KRW | `calcBB()`에서 사용 |
| σreturn | 수익률 표준편차 | 무차원 | 0.02 = 일 2% |

일별 변환: $\sigma_{\text{daily}} = \sigma_{\text{annual}} / \sqrt{250}$ (KRX 거래일 기준).

**점프-확산 --- Merton (1976)**

$$\frac{dS_t}{S_t} = (\mu - \lambda k) \, dt + \sigma \, dW_t + J \, dN_t$$

$N_t$: 강도 $\lambda$의 포아송 과정, $J$: 점프 크기 (로그정규).
KRX의 $\pm 30\%$ 가격제한폭이 자연적 점프 크기 절단으로 작용한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| GBM | 데모 모드 가격 시뮬레이션 | `realtimeProvider` 데모 |
| 이토 보조정리 → BSM PDE | 옵션 가격결정 이론적 토대 | 오프라인 IV 산출 |
| σ²/2 보정 | 로그수익률 기반 지표 | 드리프트 보정 |
| Merton 점프-확산 | 갭상승/갭하락 패턴 해석 | 캔들스틱 갭 패턴 |


### 2.2.4 프랙탈 수학과 허스트 지수 (Fractal Mathematics & Hurst Exponent)
프랙탈 기하학(Mandelbrot, 1963; 1982)에 따르면, 가격 시계열은 시간 척도 간
통계적 자기유사성을 보인다. 이 자기유사성은 동일한 패턴이 1분, 시간, 일, 주
차트에 나타나는 수학적 토대이다. 허스트 지수(Hurst, 1951)는 시계열의
장기 의존성을 측정하여 추세추종 vs 평균회귀 전략 선택의 근거를 제공한다.
$$X(ct) \stackrel{d}{=} c^H \cdot X(t)$$

$$E\left[\frac{R(n)}{S(n)}\right] = C \cdot n^H$$

| 기호 | 의미  |
|------|------|
| H | 허스트 지수  |
| R(n) | 윈도우 n에서 누적 편차의 범위  |
| S(n) | 윈도우 n의 모집단 표준편차 (÷ n)  |
| D = 2 - H | 프랙탈 차원  |
| Pt | Stage 1 가격 시계열  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{Pt}$은(는) Stage 1 데이터 계층에서 산출된다.


| H 값 | 해석 | 최적 전략 유형 |
|---------|------|----------------|
| H = 0.5 | 랜덤워크 (독립 증분) | 우위 없음 |
| H > 0.5 | 지속적/추세 | 추세추종 (이동평균 교차, 돌파) |
| H < 0.5 | 반지속적/평균회귀 | 평균회귀 (볼린저, RSI) |

**$H$와 $\alpha$에 관한 정밀한 구별:** $H = 1/\alpha$ 관계는 레비 안정 과정에서만 성립.
금융 수익률($\alpha \approx 3$, $H \approx 0.5$--$0.6$)에서는 직교적 속성이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| R/S 분석 | `calcHurst()` | 추세 지속성 측정 → 전략 유형 선택 |
| 제임스-스타인 축소 | `patternEngine` H 축소 | 소표본 허스트 안정화 |
| 자기유사성 | 다중 시간대 패턴 동일성 | 5분-일봉 패턴 동일 확률적 의미 |


### 2.2.5 선형대수와 릿지 회귀 (Linear Algebra & Ridge Regression)
선형대수는 회귀분석, 요인 모형, 포트폴리오 최적화의 수학적 근간을 제공한다.
릿지 회귀(Hoerl & Kennard, 1970)는 L2 정규화를 통해 다중공선성 문제를 해결하고,
GCV 기반 람다 선택(Golub, Heath & Wahba, 1979)이 최적 정규화 강도를 결정한다.
$$\hat{\beta}_{\text{Ridge}} = (X^T W X + \lambda I)^{-1} X^T W y$$

| 기호 | 의미  |
|------|------|
| β̂ | 회귀 계수 벡터  |
| X | 설계행렬 (피처)  |
| W | 가중행렬 diag(w1,...,wn)  |
| λ | 릿지 정규화 매개변수 (GCV 선택)  |
| I | 단위행렬  |
| y | 종속변수 (패턴 수익률)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{y}$는 Stage 1에서 수집된 과거 패턴 수익률 데이터이다.

역행렬 계산은 부분 피벗 가우스-요르단 소거법(`_invertMatrix()`), 고유분해는
야코비 회전 알고리즘(`_jacobiEigen()`)을 사용한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| WLS + Ridge | `calcWLSRegression()` | 패턴 수익 예측 |
| GCV 람다 선택 | `selectRidgeLambdaGCV()` | 릿지 초매개변수 |
| 야코비 고유분해 | `_jacobiEigen()` | GCV용 고유값 산출 |
| 가우스-요르단 | `_invertMatrix()` | 역행렬 계산 |


### 2.2.6 칼만 필터와 최적 제어 (Kalman Filter & Optimal Control)
칼만 필터(Kalman, 1960)는 선형 가우시안 시스템의 최적 상태 추정기로,
선형-이차-가우시안(LQG) 제어 문제의 해이다. CheeseStock에서는
적응형 가격 평활화에 사용되며, 과정 잡음이 변동성 국면에 비례하여
스케일링되는 확장을 적용한다.
$$\hat{x}_t = \hat{x}_{t-1} + K_t (z_t - \hat{x}_{t-1})$$

$$K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}, \quad P_{t|t-1} = P_{t-1} + Q$$

| 기호 | 의미  |
|------|------|
| x̂t | 상태 추정치 (평활 가격)  |
| Kt | 칼만 이득 (Kalman gain)  |
| Pt | 추정 오차 공분산  |
| Q | 과정 잡음  |
| R | 관측 잡음  |
| zt | 관측 가격  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{zt}$은(는) Stage 1 데이터 계층에서 산출된다.


적응형 Q 수정: Mohamed and Schwarz (1999) "Adaptive Kalman Filtering"의 통찰로,
과정 잡음 공분산이 관측 변동성 국면에 비례하여 스케일링된다.

### 2.2.7 수학 도출 요약 (Mathematics Summary)

## §2.2 수학적 기초 — 시트별 요약

§2.2는 확률의 공리적 기초(2.2.1)에서 출발하여 마팅게일(2.2.2) → 브라운 운동/이토 해석학(2.2.3) → 프랙탈/허스트(2.2.4) → 선형대수/릿지 회귀(2.2.5) → 칼만 필터(2.2.6)로 이어지는 6단계 수학 계층을 구성한다. 각 시트의 핵심 모형·학술 출처·KRX 전달 경로·구현 상태는 아래 표와 같다.

| 시트 | 핵심 모형 | 주요 학술 출처 | KRX 전달 경로 | 구현 상태 |
|---------------|--------------------|--------------------|------------------------------|---------------|
| 2.2.1 확률론: 콜모고로프 공리와 베이즈 정리 | 나이브 베이즈 다중 패턴 신뢰도 융합: $P(\text{상승}\|\text{패턴}_1,\ldots) \propto P(\text{상승})\cdot\prod_i P(\text{패턴}_i\|\text{상승})$ | Kolmogorov (1933) *Grundbegriffe*; Bayes (1763) | `patternEngine` 개별 신뢰도 → `signalEngine` 복합 신호 집계(`_matchComposites`) → 최종 composite confidence | 🔧 부분 구현 (신뢰도 곱셈 대신 가중합 집계; Bayesian 프레임은 설계 토대) |
| 2.2.2 마르팅게일 이론 | $E[X_{n+1}\|X_1,\ldots,X_n]=X_n$ — EMH 약형 경계; 마르팅게일 이탈로 패턴 예측력 정당화 | Lo & MacKinlay (1999) *A Non-Random Walk*; Fama (1970) | 마르팅게일 이탈 통계 IC = 0.051 (t = 3.73)[^mart-ic] → `backtester` 수익률 유의성 검증 → 패턴 분석의 존재론적 근거 | 📐 설계 기반 (이탈 검정 결과는 패턴 선별 근거로 사용; 런타임 함수 없음) |
| 2.2.3 브라운 운동과 이토 해석학 | GBM: $dS_t = \mu S_t\,dt + \sigma S_t\,dW_t$; 이토 보조정리 → BSM PDE; Merton (1976) 점프-확산 | Black & Scholes (1973); Ito (1944); Merton (1976) | GBM → `realtimeProvider` 데모 모드 시뮬레이션; $\sigma^2/2$ 보정 → 로그수익률 기반 지표 계산; Merton 점프 → KRX ±30% 갭 패턴 해석 | 🔧 부분 구현 (`realtimeProvider` 데모 틱은 정적 파일 모드로 대체됨; BSM PDE는 오프라인 IV 산출 이론 토대) |
| 2.2.4 프랙탈 수학과 허스트 지수 | R/S 분석: $E[R(n)/S(n)] = C\cdot n^H$; 자기유사성 $X(ct)\stackrel{d}{=}c^H X(t)$; James-Stein 축소 안정화 | Mandelbrot (1963, 1982); Hurst (1951); James & Stein (1961) | 가격 시계열 → `calcHurst()` R/S 계산 → $H$ 값 → `patternEngine` 제임스-스타인 축소 → 추세추종/평균회귀 전략 분기 | ✅ 구현 완료 (`calcHurst()` in `js/indicators.js` line 212; `patternEngine` H 축소 적용) |
| 2.2.5 선형대수와 릿지 회귀 | $\hat{\beta}_{\text{Ridge}} = (X^TWX + \lambda I)^{-1}X^TWy$; GCV 람다 선택; 부분 피벗 가우스-요르단 역행렬; 야코비 고유분해 | Hoerl & Kennard (1970); Golub, Heath & Wahba (1979) | 패턴 수익률 데이터 → `_invertMatrix()` 역행렬 + `_jacobiEigen()` 고유분해 → `selectRidgeLambdaGCV()` 람다 선택 → `calcWLSRegression()` 회귀 예측 → `backtester` 수익 예측치 | ✅ 구현 완료 — `js/indicators.js`: `calcWLSRegression()`, `_invertMatrix()`, `_jacobiEigen()`, `selectRidgeLambdaGCV()` |
| 2.2.6 칼만 필터와 최적 제어 | $\hat{x}_t = \hat{x}_{t-1} + K_t(z_t - \hat{x}_{t-1})$; $K_t = P_{t\|t-1}/(P_{t\|t-1}+R)$; 적응형 Q (변동성 국면 비례 스케일링) | Kalman (1960); Mohamed & Schwarz (1999) *Adaptive Kalman Filtering* | 관측 가격 $z_t$ → `calcKalman()` 적응형 평활화 → 평활 가격 시계열 → `signalEngine` 복합 신호 조건 평가 (칼만 신호는 독립 시그널 아님) | ✅ 구현 완료 (`calcKalman()` in `js/indicators.js` line 170; 적응형 Q 변동성 연동 포함) |

[^mart-ic]: IC = 0.051, t = 3.73은 CheeseStock 자체 백테스트 결과로,
    Stage 5 Phase A에서 2,704개 KRX 종목 × 303,956개 패턴 표본에 대해
    N-day 수익률의 Information Coefficient를 산출한 값이다. 데이터 범위,
    표본 구성, 유의성 검정 세부는 `memory/project_stage5_phaseA_findings.md`
    메모리 참조.

---

\newpage

## 2.3 통계학적 기초[^stat-1]

통계학은 원시 시장 데이터를 실행 가능한 측정치로 변환하는 경험적 도구를
제공한다. CheeseStock의 모든 기술적 지표는 본질적으로 통계 추정량이다.
RSI는 모멘텀 확률을, 볼린저 밴드는 신뢰구간을, 힐 추정량은 꼬리 두께를
추정한다.

**이론적 흐름 (8시트):** GARCH/EWMA 변동성 (2.3.1) → 극단값 이론 GEV/GPD/Hill (2.3.2) → 강건 회귀 WLS/Ridge (2.3.3) → HAR-RV 변동성 예측 (2.3.4) → 최대우도추정 MLE (2.3.5) → 변화점 감지 CUSUM (2.3.6) → HMM 국면 분류 (2.3.7) → 요약 (2.3.8). 조건부 변동성에서 국면 전환까지, 시장 데이터의 통계적 구조를 해부한다.


### 2.3.1 GARCH/EWMA 변동성 (GARCH/EWMA Volatility)
GARCH(1,1)(Bollerslev, 1986)은 조건부 변동성의 시변적(time-varying) 특성을
포착하는 표준 모형이다. EWMA는 $\omega=0$, $\alpha+\beta=1$인 IGARCH 특수
경우로, 시장의 "순간 온도"를 추적한다.
$$\sigma_t^2 = \omega + \alpha \cdot \varepsilon_{t-1}^2 + \beta \cdot \sigma_{t-1}^2$$

EWMA: $\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_{t-1}^2$

| 기호 | 의미  |
|------|------|
| σt² | 조건부 분산  |
| ω | 장기 분산 수준  |
| α | ARCH 계수 (충격 반응)  |
| β | GARCH 계수 (분산 지속성)  |
| λ = 0.94 | EWMA 감쇠 (RiskMetrics 관례)  |
| rt | 로그수익률 ln(Pt/Pt₋1)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{rt}$은(는) Stage 1 데이터 계층에서 산출된다.

### 2.3.2 극단값 이론: GEV, GPD, Hill (Extreme Value Theory)
극단값 이론(EVT)은 가우시안 꼬리 확률의 치명적 부적합성을 교정한다.
Fisher-Tippett-Gnedenko 정리(1928/1943)의 GEV 분포와 Pickands-Balkema-de Haan
정리의 GPD가 핵심이며, Hill 추정량이 꼬리 두께를 측정한다.
GEV: $G(x; \mu, \sigma, \xi) = \exp\left\{-\left[1 + \xi \frac{x - \mu}{\sigma}\right]^{-1/\xi}\right\}$

GPD: $H(y; \sigma, \xi) = 1 - \left(1 + \xi \frac{y}{\sigma}\right)^{-1/\xi}$

Hill: $\hat{\alpha} = \frac{k}{\sum_{i=1}^{k} [\ln X_{(i)} - \ln X_{(k+1)}]}$

EVT VaR: $\text{VaR}_p = u + \frac{\sigma}{\xi}\left[\left(\frac{n}{N_u}(1-p)\right)^{-\xi} - 1\right]$

| 기호 | 의미  |
|------|------|
| ξ | 형상 매개변수 (꼬리 유형)  |
| α̂ | 힐 꼬리지수 추정량  |
| k | 상위 순서통계량 수  |
| u | POT 임계값  |
| X₍i₎ | 정렬된 절대수익률 순서통계량  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{X₍i₎}$은(는) Stage 1 데이터 계층에서 산출된다.


금융 수익률: $\xi \approx 0.2$--$0.4$ (프레셰 유형), GPD PWM 추정(Hosking & Wallis, 1987).

### 2.3.3 강건 회귀: WLS, Ridge, HC3, Theil-Sen (Robust Regression)
금융 데이터의 이분산성과 이상치에 대응하는 강건 회귀 기법들이다.
WLS(Aitken, 1935)는 지수적 시간감쇠로 최근 패턴에 높은 가중치를 부여하며,
HC3(MacKinnon & White, 1985)은 이분산성 하에서의 유효한 추론을, Theil-Sen은
29.3% 붕괴점의 이상치 저항 추정을 제공한다.
WLS: $\hat{\beta} = (X^T W X)^{-1} X^T W y$, $w_i = \lambda^{T-t_i}$ ($\lambda=0.995$)

Ridge: $\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$

HC3 (WLS+Ridge 결합): $\text{Cov}_{\text{HC3}}(\hat{\beta}) = (X^TWX + \lambda I)^{-1} X^TW\,\text{diag}\!\left(\frac{e_i^2}{(1-h_{ii})^2}\right)\!WX\,(X^TWX + \lambda I)^{-1}$

Theil-Sen: $\hat{\beta}_{\text{slope}} = \text{median}\left\{\frac{y_j-y_i}{x_j-x_i}\right\}$

| 기호 | 의미  |
|------|------|
| W | 가중행렬 (지수적 시간감쇠)  |
| λ_(decay) = 0.995 | 반감기 ≈ 139 거래일  |
| hii | 지렛점 (모자행렬 대각)  |
| ei | OLS 잔차  |

| R² | 해석 | 실무적 의의 |
|-------|------|-------------|
| 0.02--0.03 | 경제적으로 유의미 | 연간 수백 bp |
| 0.05+ | 매매전략 수준 | 체계적 전략 활용 |
| > 0.10 | 극히 드묾 | 과적합 의심 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| WLS + Ridge | `calcWLSRegression()` | 패턴 수익 예측 (17-col) |
| HC3 | 강건 표준오차 | 이분산성 하 유효 추론 |
| Theil-Sen | 추세선 적합 | 이상치 저항 추세 감지 |
| VIF | `calcVIF()` | 다중공선성 진단 |


### 2.3.4 HAR-RV 변동성 예측 (HAR-RV Model)
이질적 자기회귀 실현 변동성(HAR-RV, Corsi 2009)은 이질적 시장 가설(Muller et al.
1997)에 기반하여 일/주/월 3-스케일 변동성 분해를 수행한다.
$$RV_{t+1}^{(d)} = \beta_0 + \beta_d \cdot RV_t^{(d)} + \beta_w \cdot RV_t^{(w)} + \beta_m \cdot RV_t^{(m)} + \varepsilon_{t+1}$$

| 기호 | 의미  |
|------|------|
| RVt^((d)) = rt² | 일별 실현 분산  |
| RVt^((w)) = 1/5Σi₌0⁴ rt₋i² | 주간 성분  |
| RVt^((m)) = 1/MΣi₌0^(M-1) rt₋i² | 월간 성분 (M=22 KRX)  |
| rt | 일별 로그수익률  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{rt}$은(는) Stage 1 데이터 계층에서 산출된다.
>
> **M=22 근거:** KRX 연간 거래일 약 250일/12개월 ≈ 20.8일, Corsi(2009) 원전의 NYSE 관습값 22일을 따라 `indicators.js:2072`에서 M=22로 구현(MIN_BARS = M + 60 = 82봉 최소).

### 2.3.5 최대우도추정 (Maximum Likelihood Estimation)
최대우도추정(MLE)은 GARCH 매개변수 교정, GPD 적합, HMM 전이행렬 추정의
통계학적 기반이다.
$$\hat{\theta}_{\text{MLE}} = \arg\max_{\theta} \sum_{i=1}^{n} \ln f(x_i; \theta)$$

| 기호 | 의미  |
|------|------|
| θ̂ | 매개변수 추정치  |
| f(x;θ) | 확률밀도함수  |
| xi | 관측 데이터  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{xi}$은(는) Stage 1 데이터 계층에서 산출된다.

### 2.3.6 변화점 감지: CUSUM과 이진 세분화 (Change Point Detection)
CUSUM(Page, 1954)과 이진 세분화(Bai-Perron, 1998)는 시계열의 구조적 변화를
감지한다. CheeseStock은 변동성 국면 적응형 임계값으로 고전적 CUSUM을 확장한다.
$$S_t^+ = \max(0, S_{t-1}^+ + z_t - k), \quad S_t^- = \max(0, S_{t-1}^- - z_t - k)$$

이진 세분화: $\text{BIC}_{\text{seg}} = n\ln(\max(\text{RSS}/n, 10^{-12})) + 2\ln(n)$

| 기호 | 의미  |
|------|------|
| zt | 표준화 관측치  |
| k | 슬랙 매개변수(allowance)  |
| h | 임계값  |

| 변동성 국면 | 임계값 h | 근거 |
|-------------|-----------|------|
| 고변동성 | max(h, 3.5) | 거짓 경보 감소 |
| 중간 | 기본값 (h = 2.5) | 표준 민감도 |
| 저변동성 | min(h, 1.5) | 민감도 증가 |

<!-- [V22-V25 SYNC] -->

적응형 임계값은 본래 V22-B 설계에 포함되었으나, `signalEngine._detectCUSUMBreak()` 초기 구현의 메서드명·데이터구조 TypeError로 V23까지 정적 $h = 2.5$로 비활성 상태였다.[^cusum-v24] V24에서 3줄 수정(`cache.cusum()` 메서드명 정정, `breakpoint.index` 명시 접근, `volRegime` passthrough 추가)으로 활성화되었고, V25-B는 추가로 returns-space 인덱스 $\to$ candle-space 교정(`bp.index + 1`)과 방향 전파(`neutral` $\to$ `bp.direction` 기반 buy/sell)의 정합성 수정을 가하여 고변동성 국면에서 $h = 3.5$가 실제로 적용되도록 하였다. V25-B는 이 수정 위에 2,646 종목 전수 백테스트 재실행을 수행하였다 (§3.3.1, §3.5.1).

[^cusum-v24]: `signalEngine._detectCUSUMBreak()` 버그 이력. (1) V22-B 설계 시 호출문이 `cache.onlineCUSUM()`이었으나 실제 `IndicatorCache` API는 `cache.cusum()`로 정의되어 `TypeError: onlineCUSUM is not a function`이 발생하였다 (V24 commit `4c63ddb5a`에서 정정). (2) 반환된 breakpoint 객체는 `{index, direction}` 구조인데 숫자 인덱스로 오인하여 산술 연산이 실패하였다 (V24에서 `bp.index` 명시 접근으로 정정). (3) off-by-one 오차로 시그널이 1봉 일찍 배치되어 5봉 동시발생 윈도우에 흡수되었다 (V25-B commit `115ca2547`에서 `bp.index + 1` 교정). (4) `volRegime` 정보가 호출 체인에서 누락되어 저/고변동성 적응 임계값이 항상 $h = 2.5$로 고정되었다 (V25-B에서 직전 비-null 레짐을 `cache.cusum(2.5, volRegime)`에 전달로 정정). (5) 시그널 방향이 `neutral`로 고정되어 cusumKalmanTurn 복합 신호에서 Kalman이 단독으로 방향을 결정하고 있었다 (V25-B에서 `bp.direction` 전파로 정정). 상세는 `signalEngine.js` L2821 부근 및 해당 커밋을 참조.

### 2.3.7 HMM 국면 분류 (Hidden Markov Models)
HMM(Baum et al. 1970; Hamilton 1989)은 시장을 관측 불가능한 국면(강세, 약세,
횡보) 간의 마르코프 전이로 모형화한다. 바움-웰치 알고리즘(EM 특수 경우)이
전이행렬과 방출행렬을 추정한다.
$$P(S_t = j | S_{t-1} = i) = a_{ij}$$

$$P(O_t | S_t = j) = b_j(O_t)$$

| 기호 | 의미  |
|------|------|
| St | 은닉 상태 (시장 국면)  |
| aij | 전이확률 (i → j)  |
| bj(Ot) | 방출확률  |
| Ot | 관측 수익률 시계열  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{Ot}$은(는) Stage 1 데이터 계층에서 산출된다.


HMM 국면 레이블은 오프라인 파이프라인에서 사전 계산되어 런타임에 로드된다.
***

### 2.3.8 통계학 도출 요약 (Statistics Summary)

| 시트 | 핵심 모형 | 주요 학술 출처 | KRX 전달 경로 | 구현 상태 |
|---------------|--------------------|--------------------|------------------------------|---------------|
| 2.3.1 GARCH/EWMA 변동성 | EWMA: σ²_t = λσ²_{t-1} + (1-λ)r²_{t-1} (λ=0.94); GARCH(1,1): σ²_t = ω + αε²_{t-1} + βσ²_{t-1} | Bollerslev (1986); J.P. Morgan RiskMetrics (1996) | 일봉 종가 → `calcEWMAVol()` → `classifyVolRegime()` → 패턴 ATR 임계값 적응, `signalEngine` VolRegime 레짐, `backtester` RL 특성벡터 dim-3 | ✅ 구현 완료 |
| 2.3.2 극단값 이론: GEV, GPD, Hill | Hill: α̂ = k / Σ[ln X₍ᵢ₎ - ln X₍ₖ₊₁₎]; GPD VaR: u + (σ/ξ)[(n/N_u·(1-p))^{-ξ}-1] | Fisher-Tippett-Gnedenko (1928/1943); Pickands-Balkema-de Haan; Hosking & Wallis (1987) | 수익률 배열 → `calcHillEstimator()` (isHeavyTail flag) / `calcGPDFit()` → `IndicatorCache.bbEVT()` 볼린저 자동 확대 + `patterns.js` GPD 손절 최적화 | ✅ 구현 완료 |
| 2.3.3 강건 회귀: WLS, Ridge, HC3, Theil-Sen | WLS+Ridge: β̂ = (X⊤WX + λI)⁻¹X⊤Wy (λ=GCV); HC3: Cov에 (1-hᵢᵢ)² 보정; Theil-Sen: median{(yⱼ-yᵢ)/(xⱼ-xᵢ)} | Aitken (1935); MacKinnon & White (1985); Long & Ervin (2000); Golub et al. (1979 GCV) | 패턴 수익 배열(n≥30) → `calcWLSRegression()` + `selectRidgeLambdaGCV()` + HC3 t통계량 → `backtester` 17-col 예측 → `calcTheilSen()` 추세선 피벗 감지 | ✅ 구현 완료 |
| 2.3.4 HAR-RV 변동성 예측 | RV^{(d)}_{t+1} = β₀ + β_d·RV^{(d)}_t + β_w·RV^{(w)}_t + β_m·RV^{(m)}_t + ε; M=22 (KRX, Corsi 2009 관습값) | Corsi (2009); Muller et al. (1997) 이질적 시장 가설 | 일봉 종가 → `calcHAR_RV()` / `IndicatorCache.harRV()` → 다중척도 변동성 예측값 산출 (appWorker/signalEngine 연결 미완) | 🔧 부분 구현 |
| 2.3.5 최대우도추정 | θ̂_MLE = argmax Σ ln f(xᵢ; θ); EM (Baum-Welch): GARCH/GPD/HMM 매개변수 교정 | Fisher (1922); Dempster et al. (1977) EM | 로그수익률 → MLE 기반 GPD PWM 추정 (`calcGPDFit` 내부 Hosking-Wallis), HMM 바움-웰치 오프라인 파이프라인 → `hmm_regimes.json` → 런타임 로드 | 📐 설계 기반 |
| 2.3.6 변화점 감지: CUSUM과 이진 세분화 | S⁺_t = max(0, S⁺_{t-1}+z_t-k); BIC_seg = n·ln(RSS/n) + 2ln(n); 변동성 국면별 h 적응 (1.5/2.5/3.5) | Page (1954); Roberts (1966); Bai & Perron (1998) | 로그수익률 → `calcOnlineCUSUM()` / `IndicatorCache.cusum()` + `binarySegmentation()` → `signalEngine._detectCUSUMBreak()` 신호 + `_applyCUSUMDiscount()` 패턴 신뢰도 감산 | ✅ 구현 완료 |
| 2.3.7 HMM 국면 분류 | P(S_t=j\|S_{t-1}=i) = aᵢⱼ; P(O_t\|S_t=j) = bⱼ(O_t); 바움-웰치 EM 전이행렬 추정 | Baum et al. (1970); Hamilton (1989) | 오프라인 `compute_hmm_regimes.py` → `hmm_regimes.json` + `flow_signals.json` → `_flowSignals.hmmRegimeLabel` → `appWorker._applyPhase8Confidence()` REGIME_CONFIDENCE_MULT 패턴 승수 | ✅ 구현 완료 |

---

\newpage

## 2.4 경영학적 기초: 기업재무와 가치평가[^biz-1]

경영학(기업재무론)은 기업의 본질가치(intrinsic value)를 결정하는 이론적 프레임워크를 제공한다.
CheeseStock의 재무 분석 패널(D 컬럼)은 DCF, WACC, EVA 등 기업재무 이론에 기반하여
패턴 분석과 기본적 분석의 교차검증(cross-validation)을 수행한다. 기술적 분석이 "가격이
어디로 가는가"를 묻는다면, 기업재무론은 "가격이 어디에 있어야 하는가"를 묻는다.
이 두 질문의 괴리가 투자 기회이며, 본 절은 후자의 이론적 토대를 제공한다.

**이론적 흐름 (8시트):** DCF 기업가치 (2.4.1) → MM 무관련성 (2.4.2) → Miller 개인세 (2.4.3) → WACC (2.4.4) → 대리인 비용 (2.4.5) → 신호이론 (2.4.6) → EVA (2.4.7) → Kelly 기준 (2.4.8). MM의 완전시장 가정에서 현실적 마찰(세금, 대리인, 정보비대칭)을 하나씩 도입하며, 기업재무 이론의 역사적 발전 경로를 따른다.


### 2.4.1 DCF 기업가치 평가 (Discounted Cash Flow Valuation)
현금흐름할인법(DCF)은 기업가치를 미래 잉여현금흐름(FCF)의 현재가치 합으로 정의한다. Damodaran(1995, 2012)이 체계화한 이 방법론은 금융경제학의 화폐시간가치(TVM) 원리에서 직접 도출된다. 기업이 창출할 모든 미래 현금흐름을 적절한 할인율(WACC)로 현재시점으로 환원하면, 이것이 곧 기업의 이론적 내재가치다. 시장가격이 내재가치보다 낮을 때 투자 기회가 존재하고, 반대로 높을 때는 매도 기회가 된다.

DCF의 3대 입력 변수는 FCF 추정, WACC 산출, 그리고 터미널 밸류(TV) 계산이다. 실무에서 TV는 전체 기업가치의 60~80%를 차지하는 경우가 흔하다. 이는 DCF의 본질적 한계이자 기술적 분석이 보완해야 하는 영역으로, 가격이 이론가치 범위 안에 있는지 확인하는 크로스체크(cross-check) 역할이 중요하다.

잉여현금흐름은 기업 현금흐름(FCFF)과 자기자본 현금흐름(FCFE)으로 구분된다. FCFF는 부채 보유자와 주주 모두에게 귀속되는 현금흐름이며, 영업이익에서 세금·재투자비용을 차감하여 산출한다. KRX 상장기업은 DART 전자공시시스템을 통해 재무제표 데이터를 확보할 수 있으며, 성장주(바이오, IT)는 FCF가 음수인 경우도 있어 상대가치 평가로 보완한다.

민감도 분석은 DCF의 필수 부속 작업이다. Gordon 성장 모형에서 WACC와 성장률(g)에 대한 편미분은 절댓값이 동일하므로, WACC 상승 1bp와 g 하락 1bp는 TV에 대칭적 충격을 준다. 이 비선형성이 분석가 간 가치 추정 편차의 주요 원인이다. WACC 추정 오차 ±1%p, g 추정 오차 ±0.5%p를 가정하면 TV 불확실성은 ±20~35%에 달한다.
$$V = \sum_{t=1}^{n} \frac{FCF_t}{(1+WACC)^t} + \frac{TV}{(1+WACC)^n}$$

$$FCFF = EBIT(1-T) + D\&A - CAPEX - \Delta NWC$$

$$TV_{\text{Gordon}} = \frac{FCF_1}{WACC - g} = \frac{FCF_n(1+g)}{WACC - g}$$

$$TV_{\text{exit}} = EBITDA_n \times \text{Exit Multiple}$$

$$\frac{\partial TV}{\partial g} = \frac{FCF_1}{(WACC-g)^2} > 0 \qquad \frac{\partial TV}{\partial WACC} = -\frac{FCF_1}{(WACC-g)^2} < 0$$

| 기호 | 의미  |
|------|------|
| V | 기업 총가치 (EV)  |
| FCFt | t기 잉여현금흐름  |
| FCF_1 | 영구 성장 단계 첫 해 FCF (≡ FCF_n(1+g))  |
| WACC | 가중평균자본비용  |
| TV | 터미널 밸류  |
| g | 영구 성장률  |
| T | 법인세율  |
| D\&A | 감가상각비  |
| CAPEX | 자본적 지출  |
| Δ NWC | 순운전자본 변동  |
| EBIT | DART 영업이익  |
| EPS | 주당순이익  |
| β_(KRX) | KRX 베타 (CAPM 산출용)  |

> **이전 Stage 데이터:** Stage 1(DART API)에서 `영업이익(EBIT)`, `EPS`, `자본총계`, `이자부채`를 수신한다. DART stat code `ifrs-full_ProfitLossFromOperatingActivities`가 EBIT에 해당하며, `download_financials.py`가 이를 `data/financials/{code}.json`에 기록한다. `compute_capm_beta.py`가 산출한 $\beta_{KRX}$는 WACC 계산의 자기자본비용($R_e$) 입력값이다.

**KRX 특이사항:** 자본잠식 종목(자기자본 < 납입자본금의 50%)은 계속기업(going concern) 가정을 위반하므로 DCF 모형이 무효화된다. 이 경우 청산가치(liquidation value) 또는 자산가치 기반 평가로 전환해야 하며, `financials.js`는 `자본총계 < 0` 조건을 감지하여 D 컬럼에 경고를 표시한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| DCF 내재가치 역산 | `getFinancialData()` → `updateFinancials()` | PER/PBR로 내재가치 범위 추정 |
| TV 민감도 분석 | `drawFinTrendChart()` 추세 시각화 | 이익 성장 추이로 g 추정 보조 |
| FCFF 산출 | `compute_eva.py` NOPAT 계산 | EVA 계산의 중간 단계 공유 |
| 저PBR + 패턴 결합 | `signalEngine.js` composite 신호 | 내재가치 이하 가격 + 기술적 반전 신호 강화 |


### 2.4.2 자본구조: MM 정리 (Capital Structure: Modigliani-Miller)
Modigliani & Miller(1958, 1963)의 자본구조 무관련 정리(MM theorem)는 현대 기업재무론의 출발점이다. 두 저자는 각각 1985년과 1990년 노벨 경제학상을 수상했다. 정리의 핵심은 "완전 자본시장에서 기업가치는 자본구조와 무관하다"는 명제로, 부채와 자기자본의 조합 방식은 기업가치의 파이 크기가 아닌 분배 방식만을 결정한다는 직관을 담고 있다.

1963년 수정 모형은 법인세(corporate tax)를 도입하여 부채의 이자비용이 세전 공제됨에 따라 $T_c \cdot D$만큼의 세금절감(tax shield) 효과가 발생하고 기업가치가 증가함을 보였다. 그러나 이 결론을 그대로 따르면 100% 부채가 최적이라는 비현실적 결론에 도달한다. 현실에서 KOSPI 대형주의 평균 부채비율은 40~60%에 불과하며, 이 괴리를 설명하기 위해 상충이론(trade-off theory)과 Miller(1977) 개인세 모형이 제안되었다.

MM 제2명제는 자기자본비용이 레버리지 증가에 따라 선형적으로 상승함을 보인다. 부채의 낮은 조달비용 이점이 자기자본비용 상승으로 정확히 상쇄되므로 WACC는 일정하게 유지된다. 이것이 MM의 핵심 역설이다. 제2명제는 Hamada(1972) 방정식(2.4.4절)을 통해 자본구조 변화에 따른 베타 조정의 이론적 근거를 제공한다.

한국 시장에서 MM 완전 자본시장의 5가지 가정 중 적어도 3가지가 현실에서 위반된다. 재벌 지배구조에 따른 정보 비대칭, 법인세·배당소득세·이자소득세의 복층 세금 구조, 그리고 금융위기 시 관찰되는 재무적 곤경 비용(financial distress cost)이 대표적 위반 사례다. 따라서 MM 정리는 한국 시장 분석의 기준점(null hypothesis)으로 활용하되, 현실 조건의 이탈 방향을 명시적으로 모형화해야 한다.
$$\text{MM-I (무세금, 1958):} \quad V_L = V_U$$

$$\text{MM-I (법인세, 1963):} \quad V_L = V_U + T_c \cdot D$$

$$\text{MM-II (자기자본비용):} \quad R_E = R_A + (R_A - R_D)\frac{D}{E}(1-T_c)$$

$$\text{상충이론:} \quad V_L = V_U + PV(\text{Tax Shield}) - PV(\text{Distress Cost})$$

| 기호 | 의미  |
|------|------|
| V_L | 레버리지 기업 가치  |
| V_U | 무레버리지 기업 가치  |
| T_c | 법인세율  |
| D | 부채 시장가치  |
| R_E | 자기자본비용 (레버리지 후)  |
| R_A | 자산수익률 (무레버리지)  |
| R_D | 타인자본비용  |
| 자본총계 | DART 자기자본 장부가  |
| 이자부채 | DART 단·장기차입금 합계  |

> **이전 Stage 데이터:** Stage 1 DART 파이프라인에서 수신한 `자본총계`와 `이자부채`로 D/E 비율을 산출한다. `자본총계`는 IFRS 기준 `ifrs-full_Equity`, `이자부채`는 `ifrs-full_Borrowings + ifrs-full_DebtSecuritiesIssued`로 매핑된다.

**MM 완전 자본시장 5가지 가정과 KRX 위반 현황**

| 가정 | 내용 | KRX 위반 여부 |
|------|------|--------------|
| 1. 세금 없음 | 법인세·소득세 부재 | 위반: 법인세 9~24%, 배당·이자소득세 15.4% |
| 2. 거래비용 없음 | 매매 수수료·스프레드 없음 | 부분 위반: 증권거래세 0.18%, HTS 수수료 |
| 3. 파산비용 없음 | 부도 시 비용 발생 안 함 | 위반: 회생절차 직·간접 비용 |
| 4. 정보 대칭 | 내부·외부 정보 동일 | 위반: 재벌 오너 정보 우위, DART 공시 지연 |
| 5. 동일 차입금리 | 기업·개인 동일 금리 | 위반: 신용등급별 스프레드 차이 존재 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| MM-I 세금절감(T_c · D) | `compute_eva.py` IC 산출 | EVA 계산의 투하자본(IC) 분모 |
| D/E 비율 | `financials.js updateFinancials()` | PBR·ROE 표시 보조 지표 |
| 상충이론 곡선 | 향후 `compute_wacc.py` 연동 예정 | 최적 자본구조 추정 |


### 2.4.3 Miller (1977) 개인세 모형 (Miller's Personal Tax Model)
Merton Miller(1977)는 미국재무학회 회장 취임 연설에서 법인세만을 고려한 MM(1963) 모형이 개인세를 무시함으로써 부채의 세금 이점을 과대평가한다는 점을 지적했다. Miller의 핵심 통찰은 투자자가 이자소득과 배당소득(또는 자본이득)에 대해 서로 다른 세율로 개인세를 납부한다는 사실이다. 이자소득에 대한 개인세율($T_d$)이 높을수록 부채의 순세금 이점은 감소한다.

Miller 균형(Miller equilibrium)은 개인세율이 이질적인 투자자 집단을 도입하여 도출된다. 기업들이 부채를 늘릴수록 채권 수익률이 상승하고, 점점 더 높은 개인세율의 투자자를 유인해야 한다. 균형에서 한계 채권 투자자의 세율이 $(1-T_d^*) = (1-T_c)(1-T_s)$를 만족하면 추가적인 부채 발행의 세금 이점이 0이 되어, 경제 전체의 부채 총량은 결정되지만 개별 기업의 자본구조는 무관하게 된다.

한국 세제를 Miller 모형에 대입하면 세 가지 사례가 구분된다. Case A(배당 중심, $T_s = T_d = 15.4\%$)에서는 개인세가 상쇄되어 MM(1963)과 동일한 결론($G_L = T_c \cdot D$)이 도출된다. Case B(소액주주 자본이득 비과세, $T_s \approx 0$)에서는 부채의 세금 이점이 $0.22D$에서 $0.078D$로 대폭 축소된다. Case C(금융소득종합과세, $T_d = T_s = 40\%$)에서도 동일한 세율로 인해 역시 $G_L = T_c \cdot D$가 성립한다.

CheeseStock의 신뢰도 조정 시스템은 Miller 모형의 함의를 간접적으로 반영한다. 고배당주(소액주주 $T_s = T_d$ 조건)는 자본구조 중립 가정이 성립하는 반면, 자본이득 중심 성장주(Case B)는 부채가 많더라도 세금절감 이점이 제한적이다. 이는 같은 D/E 비율이라도 배당 정책에 따라 WACC 계산값이 달라질 수 있음을 시사한다.
$$G_L = \left[1 - \frac{(1-T_c)(1-T_s)}{1-T_d}\right] \cdot D$$

$$V_L = V_U + G_L = V_U + \left[1 - \frac{(1-T_c)(1-T_s)}{1-T_d}\right] \cdot D$$

$$\text{Miller 균형 조건:} \quad (1-T_d^*) = (1-T_c)(1-T_s) \implies G_L = 0$$

| 기호 | 의미  |
|------|------|
| G_L | 부채의 세금 순이득  |
| T_c | 법인세율 (한국 실효 ≈ 0.22)  |
| T_d | 이자소득에 대한 개인세율  |
| Ts | 자기자본 소득 유효 개인세율  |
| D | 부채 시장가치  |
| 자본총계 | DART 자기자본  |
| 이자부채 | DART 차입금·사채 합계  |

> **이전 Stage 데이터:** Stage 1에서 수신한 `자본총계`와 `이자부채`로 D 및 D/E를 산출한다. 실효세율($T_c$)은 DART `ifrs-full_IncomeTaxExpense` / `ifrs-full_ProfitLossBeforeTax`로 추정할 수 있으며, `download_financials.py`가 이를 기록한다.

**한국 세제별 Miller 모형 결과 비교**

| 사례 | T_c | T_d | Ts | G_L | 비고 |
|------|--------|--------|--------|--------|------|
| Case A: 배당 중심 | 0.22 | 0.154 | 0.154 | 0.22D | MM(1963)과 동일 |
| Case B: 소액주주 자본이득 비과세 | 0.22 | 0.154 | 0 | 0.078D | 세금이점 64% 감소 |
| Case C: 금융소득종합과세 | 0.22 | 0.40 | 0.40 | 0.22D | Case A와 동일 |
| Miller 균형 이론값 | 임의 | T_d* | 임의 | 0 | 개별기업 자본구조 무관 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Case B (G_L = 0.078D) | 향후 WACC 정교화 시 참조 | 소액주주 비과세 가정 하 WACC 보정 |
| Miller 균형 판단 | `financials.js` D/E·배당성향 표시 | 자본구조 최적화 여부 체크 |
| 세율 파라미터 | `appState.js` 경제 파라미터 테이블 | Stovall/KSIC 신뢰도 조정 참조 |


### 2.4.4 WACC와 최적 자본비용 (WACC & Optimal Capital Cost)
가중평균자본비용(WACC)은 기업이 자본을 조달하는 데 지불해야 하는 총비용의 가중평균이다. DCF 분석에서 분모에 위치하므로 WACC의 작은 변화가 기업가치에 대단히 큰 영향을 미친다. WACC는 자기자본비용($R_e$)과 세후 타인자본비용($R_d(1-T_c)$)을 시장가치 기준 비중으로 가중한다. 자기자본비용은 통상 CAPM으로 산출하며, 이때 KRX 종목의 베타($\beta$)와 무위험이자율($R_f$), 시장위험프리미엄(ERP)이 핵심 입력값이 된다.

Hamada(1972) 방정식은 자본구조 변화에 따른 레버리지 베타($\beta_L$)와 무레버리지 베타($\beta_U$) 간의 관계를 정량화한다. 비교 대상 기업(peer group)의 베타를 활용하거나 자본구조 변경 시나리오를 분석할 때 필수적으로 사용되는 3단계 절차가 있다: 각 비교 기업의 $\beta_L$을 $\beta_U$로 언레버(unlever)하고, 평균을 내며, 분석 대상 기업의 D/E로 다시 레버(re-lever)하는 것이다. Hamada 방정식은 MM(1963) 법인세 모형을 기반으로 하므로 파산비용과 개인세를 반영하지 않는다는 한계가 있다.

최적 자본구조는 세금절감 효과의 현재가치와 재무적 곤경 비용의 현재가치가 균형을 이루는 점에서 결정된다. 부채 증가에 따른 세금절감 이익의 한계효과가 체감하는 반면, 파산 확률과 관련 비용의 한계치는 체증한다. 이 상충관계가 업종별·기업규모별로 서로 다른 최적 자본구조를 만든다. KOSPI 대형 제조업체는 통상 D/E 0.8~1.2, KOSDAQ 기술 성장주는 0.3~0.6 수준을 유지한다.

KRX 적용 시 무위험이자율 선택에 주의가 필요하다. 패턴 매매(단기 트레이딩) 관점에서는 국고채 3년 수익률이 적절하고, DCF를 통한 기업가치 평가(장기 투자) 관점에서는 국고채 10년 수익률이 적합하다. 2025년 현재 한국 국고채 3년 수익률은 약 2.8~3.2%, 10년 수익률은 약 3.0~3.5% 수준이다.
$$WACC = \frac{E}{V}R_e + \frac{D}{V}R_d(1-T_c)$$

$$R_e = R_f + \beta_L(R_m - R_f) \quad \text{(CAPM)}$$

$$\beta_L = \beta_U \left[1 + (1-T_c)\frac{D}{E}\right] \quad \text{(Hamada, 1972)}$$

$$\beta_U = \frac{\beta_L}{1 + (1-T_c)(D/E)}$$

$$V_L = V_U + PV(\text{Tax Shield}) - PV(\text{Distress Cost}) \quad \text{(Trade-off)}$$

| 기호 | 의미  |
|------|------|
| E | 자기자본 시장가치 (시가총액)  |
| D | 타인자본 시장가치  |
| V = E + D | 총자본 시장가치  |
| R_d | 타인자본비용 (차입이자율)  |
| T_c | 법인세율  |
| β_L | 레버리지 베타  |
| β_U | 무레버리지 베타  |
| R_f | 국고채 3Y/10Y 수익률  |
| β | KRX CAPM 베타  |
| 실효세율 | DART 법인세비용/세전이익  |

> **이전 Stage 데이터:** $R_f$는 Stage 1 ECOS API `722Y001` (국고채 3년) 및 `817Y002` (국고채 10년)에서 수신한다. $\beta$는 `compute_capm_beta.py`가 OHLCV 데이터로 산출하여 `data/derivatives/capm_beta.json`에 기록한 값을 사용한다. 실효세율은 DART `download_financials.py` 출력물에서 추출한다.

**Hamada 3단계 절차 (peer group beta 조정)**

| 단계 | 공식 | 목적 |
|------|------|------|
| 1. Unlever | β_(U,i) = β_(L,i) / [1+(1-T_c)(D/E)i] | 각 비교기업 자본구조 제거 |
| 2. Average | β̄_U = mean(β_(U,i)) | 산업 고유 위험 추정 |
| 3. Re-lever | β_(L,target) = β̄_U[1+(1-T_c)(D/E)_(target)] | 분석 대상에 자본구조 재적용 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| WACC 계산 | `compute_eva.py` WACC 산출 루틴 | EVA 분모 자본비용 금액 |
| Hamada unlever/re-lever | `compute_capm_beta.py` 베타 조정 | 섹터 평균 베타 비교 |
| R_f 국고채 | `_macroLatest.bok_rate` 참조 | 신뢰도 조정의 금리 환경 판단 |
| WACC↑ → 성장주 하락 | `_applyPhase8ConfidenceToPatterns()` | 금리 상승 국면 패턴 신뢰도 하향 조정 |


### 2.4.5 대리인 이론과 기업지배구조 (Agency Theory & Corporate Governance)
Jensen & Meckling (1976)은 기업의 소유와 경영이 분리될 때 발생하는 대리인 비용(agency costs)을 감시비용(MC), 결속비용(BF), 잔여손실(RL)의 3요소로 분해하였다. 이는 경영학 재무관리의 핵심 프레임워크이며, 대리인 비용이 높은 기업에서는 이익의 질(earnings quality)이 낮아 EPS 기반 패턴의 신뢰도가 하락하고, 배당/자사주 신호의 정보 함량이 변질된다. Holmstrom (1979)은 도덕적 해이 하의 최적 계약을 정식화하여, 인센티브 강도 $\beta^*$가 환경 불확실성($\sigma^2$), 위험회피($\rho$), 노력 효과($\Delta f$)의 함수임을 도출하였다.

한국 재벌(chaebol) 그룹은 글로벌 기업 지배구조에서 대리인 문제의 극단적 사례를 제공한다. La Porta, Lopez-de-Silanes & Shleifer (1999)와 Claessens et al. (2000)의 프레임워크에 따르면, 지배주주의 현금흐름권($C$)과 의결권($\alpha$)의 괴리도(wedge) $W = \alpha - C$가 터널링 유인을 결정한다. 한국 4대 재벌의 괴리도 비율($WR = \alpha/C$)은 삼성 ($\approx 20.6$), SK ($\approx 11.4$), 현대차 ($\approx 10.7$), LG ($\approx 9.0$)으로 동아시아 최고 수준이다 (공정거래위원회 2024). WR이 10을 초과하면 터널링 이벤트(내부거래 공시, 유상증자, 합병) 시 패턴 신뢰도를 체계적으로 하향해야 한다. Bae, Kang & Kim (2002)은 재벌 인수 기업의 CAR$[-1,+1]$이 $-0.6\%$인 반면 지배주주 부(wealth)는 $+1.5\%$ 증가함을 실증하였다.

대리인 위험의 정량화를 위해 ARI(Agency Risk Index)가 설계되었으나, 현재 구현 상태는 사양(design specification) 수준에 머물러 있다. 특히 `eps_stability`가 `ni_history` 미적재로 fallback 1.0으로 작동하여, HHI boost에 이익변동성 감쇠가 적용되지 않는 점은 대리인 비용 기반 보정 전체에 영향을 미친다 (P0-3, MIC-02).
$$AC = MC + BF + RL$$

$$\beta^* = \frac{1}{1 + \rho\sigma^2 / \Delta f^2} \qquad \text{(Holmstrom 1979)}$$

$$\text{ARI} = w_1 \cdot \text{ROE\_inv} + w_2 \cdot \text{CAPEX\_excess} + w_3 \cdot (1 - BI) + w_4 \cdot \text{RPRR}$$

$$W = \alpha - C, \qquad WR = \alpha / C \qquad \text{(한국 재벌 평균 } C \approx 2\text{--}5\%, \; \alpha \approx 30\text{--}50\%\text{)}$$

| 기호 | 의미  |
|------|------|
| AC | 총 대리인 비용  |
| MC, BF, RL | 감시비용, 결속비용, 잔여손실  |
| β* | 최적 인센티브 강도  |
| ρ | 대리인 위험회피 계수  |
| σ² | 산출물 분산 (환경 불확실성)  |
| Δ f | 노력에 의한 산출 차이  |
| ROE | 자기자본이익률 (financials.json)  |
| NI | 당기순이익  |
| RPRR | 관계사 매출 비중 (tunneling proxy)  |
| BI | 이사회 독립성 (사외이사/총원)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{ROE}}$는 `getFinancialData()`에서 당기순이익/자본총계로 산출된다. $\textcolor{stageOneMarker}{\text{NI}}$는 `eps_stability` 산출(NI 성장률 변동성)에 필요하나, 현재 `_financialCache`에 `ni_history` 배열이 적재되지 않아 활용 불가 상태이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| HHI × eps\_stability 보정 | `_applyMicroConfidenceToPatterns()` appWorker.js:1601 | Mean-reversion 패턴에 HHI boost 적용. 단, ARI는 설계 사양만 존재 (미구현). 현재 대리인 비용은 `eps_stability` fallback 1.0으로 중립화됨 |
| 투자 점수 (investment score) | `updateFinancials()` financials.js | ROE, 이익성장률, 밸류에이션 등급 합산으로 간접적 대리인 비용 반영 |
| ARI 설계 사양 | Doc 33 SS4.1--4.2 | w1=0.30, w2=0.25, w3=0.20, w4=0.25; ARI\_CONFIDENCE\_DECAY = 0.20 (\#166). Phase 1 간소화: ROE\_inv + CAPEX\_excess만으로 R² ≈ 0.60 |
| 재벌 괴리도 할인 | Doc 33 SS3.3 설계 사양 | wedge\_discount = min(0.15,  0.01 × WR). WR = 10: -10%, WR = 15: -15% (cap) |


### 2.4.6 시그널링 이론 (Signaling Theory)
Spence (1973)의 직업시장 시그널링 모형은 정보 비대칭 하에서 고품질 주체가 비용이 드는 행동(costly signal)으로 자신의 유형을 드러내는 메커니즘을 정식화하였다. 핵심은 단일 교차 조건(single-crossing condition): 시그널 비용이 품질에 반비례($dC/d\theta < 0$)해야 분리 균형(separating equilibrium)이 성립한다. Ross (1977)는 이를 기업재무로 확장하여 부채 수준이 기업 품질의 신호가 됨을 보였다. 경영자의 보상 함수 $W = \gamma_0 + \gamma_1 V_t - L \cdot \mathbf{1}(\text{bankruptcy})$에서, 파산 시 패널티 $L$이 충분히 크면 고품질 기업만이 높은 부채를 감당할 수 있어 분리 균형이 형성된다.

Bhattacharya (1979)는 배당이 세금 비용과 외부조달 거래비용을 수반하므로 기업 품질의 신뢰할 수 있는 시그널이 됨을 보였다. 그러나 한국에서는 배당소득세($T_s$) ≈ 이자소득세($T_d$) $= 15.4$%로 배당의 세금 비용이 상대적으로 낮아 시그널의 credibility가 약화될 수 있으며, 자사주 매입이 더 강한 시그널로 기능할 가능성이 있다. Lintner (1956)의 배당 평활화 모형은 실증적으로 기업이 이익 변동의 30--50%만을 당기 배당에 반영($c \approx 0.3$--$0.5$)하며, 배당 삭감은 경영자도 더 이상 유지 불가하다는 매우 강한 부정적 시그널임을 확인하였다. 한국 기업의 조정 속도는 $c \approx 0.2$--$0.4$로 미국보다 느리며, 재벌 계열사는 내부유보 선호로 $c$가 더 낮다.

Myers & Majluf (1984)는 역선택 하에서 자본조달 서열이론(pecking order theory)을 정식 모형화하였다. 경영자가 기존 주주의 이익을 대리할 때, 자산 가치가 높은(고품질) 기업일수록 주식 발행 시 저평가로 인한 부의 이전이 커서 발행을 꺼린다. 따라서 $\text{NPV}_{\text{project}} > I \times (V_{\text{true}} - V_{\text{market}}) / (V_{\text{market}} + I)$일 때만 발행이 정당화되며, 내부자금 $\succ$ 부채 $\succ$ 주식의 서열이 도출된다.
$$\frac{dC}{d\theta} < 0 \qquad \text{(Spence 단일 교차 조건: 시그널 비용이 품질과 역관계)}$$

$$W = \gamma_0 + \gamma_1 V_t - L \cdot \mathbf{1}(\text{bankruptcy}) \qquad \text{(Ross 1977)}$$

$$D_t - D_{t-1} = c\bigl(\tau E_t - D_{t-1}\bigr) + u_t \qquad \text{(Lintner 1956 배당 조정)}$$

$$\text{NPV}_{\text{project}} > I \times \frac{V_{\text{true}} - V_{\text{market}}}{V_{\text{market}} + I} \qquad \text{(Myers-Majluf 1984 발행 조건)}$$

| 기호 | 의미  |
|------|------|
| θ | 기업 품질 유형 (private information)  |
| C(θ) | 시그널 비용 함수  |
| γ0, γ1 | 경영자 고정보상, 가치연동 계수  |
| L | 파산 시 경영자 패널티  |
| Dt | t기 배당  |
| τ | 목표 배당성향 (target payout ratio)  |
| c | 배당 조정 속도 (speed of adjustment)  |
| DPR | 배당성향 (배당금/순이익)  |
| EPS growth | 주당순이익 성장률 (DART)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{DPR}}$은 DART 사업보고서에서 추출 가능하며, 배당 증가/삭감의 시그널 방향을 판별하는 핵심 입력이다. $\textcolor{stageOneMarker}{\text{EPS growth}}$는 Lintner 모형의 이익 변수 $E_t$에 대응하며, 영구적 이익 개선 여부를 판단하는 기준이 된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 배당 증가 시그널 | `signal_dividend_bonus = +0.05` (\#106, Doc 31 SS3.4) | 설계 상수만 존재 (D등급). 공시 이벤트 신호는 향후 통합 예정 |
| 자사주 매입 시그널 | `signal_buyback_bonus = +0.08` (\#107, Doc 31 SS3.4) | 설계 상수만 존재 (D등급). 한국 시장에서 배당보다 강한 시그널로 이론적 타당성 높음 |
| Myers-Majluf 역선택 | 유상증자 이벤트 감지 (미구현) | 유상증자 공시 시 약세 패턴 신뢰도 강화의 이론적 근거 |
| Lintner 배당 평활화 | `updateFinancials()` financials.js | 배당성향 표시 및 투자 점수 산출에 간접 반영. 배당 삭감 이벤트의 패턴 연동은 미구현 |

### 2.4.7 EVA 경제적 부가가치 (Economic Value Added)
경제적 부가가치(EVA)는 G. Bennett Stewart III(1991)가 Stern Stewart & Co.를 통해 상용화한 기업 성과 측정 지표로, 회계적 이익이 자기자본의 기회비용을 반영하지 않는다는 한계를 보완한다. EVA는 세후 영업이익(NOPAT)에서 투하자본(IC)의 자본비용 금액(WACC × IC)을 차감한다. ROE가 양수이더라도 자기자본비용($R_e$)보다 낮다면 회사는 회계적 흑자지만 경제적 적자를 내고 있는 것이다.

ROIC 분해는 EVA 양부의 원천을 진단하는 도구다. ROIC = NOPAT / IC를 세후 영업마진(NOPAT/매출액) × 투하자본 회전율(매출액/IC)로 분해하면, 가치 창출 또는 파괴의 근원이 수익성 문제인지 자산효율성 문제인지 식별할 수 있다. 한국 섹터별로 보면 반도체(삼성전자, SK하이닉스) 호황기 ROIC 10~30%는 WACC 8~10%를 크게 상회하여 강한 EVA 양수를 기록하고, 유틸리티·규제산업은 ROIC 4~7%로 WACC(6~7%)에 근접한 박리(thin margin) 구조다.

MVA(Market Value Added)는 미래 EVA 스트림의 현재가치 합으로 정의되며, 주가에는 이미 미래 EVA 기대가 반영되어 있다. 따라서 EVA 개선 공시나 ROIC 상승 전환은 강한 주가 상승 촉매로 작용한다. CheeseStock의 패턴 신호 신뢰도 조정은 이 관계를 활용하여 EVA 양수·ROIC > WACC 종목에서 매수 패턴의 신뢰도를 상향한다.

EVA 실무 계산에서 투하자본(IC) 산출에는 두 가지 방법이 있다. 자산 접근법은 총자산에서 비이자성 유동부채(매입채무, 미지급금 등)를 차감하고, 자본 접근법은 자기자본에 이자부채를 가산한다. 두 방법은 이론적으로 동일한 결과를 내지만 실무 데이터의 분류 방식에 따라 소폭 차이가 발생할 수 있다.
$$EVA = NOPAT - WACC \times IC$$

$$NOPAT = EBIT \times (1 - T_c)$$

$$IC = \text{자기자본} + \text{이자부채} \quad \text{(자본 접근법)}$$

$$ROIC = \frac{NOPAT}{IC} = \underbrace{\frac{NOPAT}{\text{매출액}}}_{\text{세후 영업마진}} \times \underbrace{\frac{\text{매출액}}{IC}}_{\text{투하자본 회전율}}$$

$$EVA = IC \times (ROIC - WACC)$$

$$MVA = \sum_{t=1}^{\infty} \frac{EVA_t}{(1+WACC)^t}$$

$$EVA > 0 \iff ROIC > WACC$$

| 기호 | 의미  |
|------|------|
| EVA | 경제적 부가가치  |
| NOPAT | 세후 영업이익  |
| IC | 투하자본  |
| ROIC | 투하자본수익률  |
| MVA | 시장부가가치  |
| NOPAT | DART 영업이익 × (1-T)  |
| IC | DART 자본총계 + 이자부채  |
| WACC | CAPM 기반 산출 WACC  |

> **이전 Stage 데이터:** Stage 1 DART 파이프라인에서 수신한 `영업이익(EBIT)`에 `(1-실효세율)`을 곱하여 NOPAT을 산출한다. IC는 `자본총계` + `이자부채`(단기차입금 + 유동성장기부채 + 사채 + 장기차입금)로 계산한다. `compute_eva.py` 스크립트가 이 계산을 수행하고 결과를 `data/financials/{code}.json`의 `eva` 필드에 기록한다.

**한국 섹터별 ROIC vs WACC**

| 섹터 | ROIC 범위 | WACC | EVA 판정 |
|------|-----------|------|---------|
| 반도체 (호황기) | 10~30% | 8~10% | 강한 양수 |
| 자동차 | 5~12% | 8~9% | 주기적 양/음 |
| 유틸리티 | 4~7% | 6~7% | 박리 균형 |
| 바이오/플랫폼 (성장기) | 음수 | 12~15% | 음수 (정상) |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| EVA 계산 | `compute_eva.py` | `data/financials/{code}.json` eva 필드 생성 |
| EVA 표시 | `financials.js` EVA 행 (green/red) | D 컬럼 재무패널 EVA 녹색/적색 표시 |
| ROIC > WACC 판단 | `financials.js updateFinancials()` | 주주가치 창출/파괴 시각화 |
| MVA 근사 | PBR − 1 (장부가 초과 프리미엄) | 시장이 미래 EVA를 얼마나 할인하는지 간접 추정 |


### 2.4.8 Kelly 기준과 포지션 사이징 (Kelly Criterion & Position Sizing)
John L. Kelly Jr.(1956)는 Bell System Technical Journal에 발표한 논문에서 정보이론을 활용하여 장기 자산 기하 성장률을 최대화하는 최적 베팅 비율($f^*$)을 도출했다. Kelly 기준의 핵심 통찰은 산술 평균이 아닌 기하 평균을 최대화한다는 점이다. 복리 효과 하에서 과도한 베팅은 단기 기대수익을 높이지만 장기적으로 파산 위험을 폭발적으로 증가시킨다. Kelly 비율의 두 배($2f^*$) 이상을 투자하면 유한 시간 내에 파산이 확실해진다는 에르고딕 파산(ergodic ruin) 결과가 이를 뒷받침한다(Peters, 2019).

CheeseStock의 백테스트 시스템은 각 패턴의 역사적 승률($p$)과 손익비($b$)를 `backtester.js`에서 산출하여 Kelly 비율을 계산한다. 실무에서는 매개변수 추정 오차를 반영하여 Half-Kelly($0.5f^*$)를 표준으로 사용한다. Thorp(2006)에 따르면 Half-Kelly는 Full Kelly 대비 성장률을 75% 수준으로 유지하면서 변동성을 50% 감소시켜, 추정 오차에 대한 충분한 버퍼를 제공한다.

다자산 Kelly 기준은 단일 자산 공식을 N개 자산으로 확장한 것으로, 최적 비중 벡터가 수익률 공분산 행렬의 역행렬과 기대 초과수익 벡터의 곱으로 표현된다. 이는 수학적으로 Markowitz 접선 포트폴리오와 동치다. 로그 효용함수($U(W) = \ln W$) 하에서 기대효용 최대화와 기하 성장률 최대화가 일치하는 유일한 함수라는 점이 Kelly 기준의 이론적 정당성이다.

Peters(2019)의 에르고딕 경제학은 Kelly 기준에 역학(mechanics) 기반 근거를 제공한다. 금융 수익률은 곱셈적(multiplicative) 과정으로 비에르고딕이므로, 앙상블 평균($\mu$)이 아닌 시간 평균($\mu - \sigma^2/2$)이 실제 투자자가 경험하는 성장률이다. Kelly 기준은 이 시간 평균 성장률을 정확히 최대화한다. 손실 회피(loss aversion)가 행동경제학에서 "비합리적" 편향으로 분류되어 왔으나, 에르고딕 관점에서는 비에르고딕 세계에서의 최적 전략임이 재해석된다.
$$f^* = \frac{bp - q}{b} = \frac{\text{edge}}{\text{odds}} \quad \text{(이진 Kelly)}$$

$$f^* = \frac{\mu}{\sigma^2} \quad \text{(연속 Kelly, 주식 시장 적용)}$$

$$G(f) = p \cdot \ln(1 + bf) + q \cdot \ln(1-f) \quad \text{(기하 성장률)}$$

$$\frac{dG}{df} = 0 \implies f^* = \frac{bp - q}{b}$$

$$\mathbf{f}^* = \Sigma^{-1} \boldsymbol{\mu} \quad \text{(다자산 Kelly)}$$

$$\bar{r} = \mu - \frac{\sigma^2}{2} \quad \text{(시간 평균 성장률, Peters 2019)}$$

| 기호 | 의미  |
|------|------|
| f* | 최적 투자 비율  |
| b | 순배당률 (손익비)  |
| p | 승률 (winning probability)  |
| q = 1-p | 패률  |
| G(f) | 기하 성장률  |
| μ | 기대 초과수익률  |
| σ² | 수익률 분산  |
| Σ | 수익률 공분산 행렬  |
| p_(backtest) | 패턴별 역사적 승률  |
| b_(backtest) | 패턴별 역사적 손익비  |

> **이전 Stage 데이터:** Stage 1 백테스트 파이프라인(`backtester.js`)은 각 패턴의 N일 수익률 통계에서 승률(`wins/n`)과 손익비(`payoffRatio`)를 산출한다. `kellyEdge = max(0, WR - wrNull)` 계산 후 `kellyRaw = (kellyEdge*(1+payoffRatio) - 1) / payoffRatio`로 Kelly 비율을 도출하고, `[0, 1.0]`으로 클램핑하여 `kellyFraction` 필드에 저장한다(라인 1599~1602). 음수 Kelly는 "베팅하지 말라"는 신호로 처리된다.

**에르고딕 관점: 앙상블 평균 vs 시간 평균**

| 구분 | 수식 | 의미 |
|------|------|------|
| 앙상블 평균 | ⟨ R ⟩ = μ | N명 투자자의 횡단면 평균 수익 |
| 시간 평균 | r̄ = μ - σ²/2 | 1명 투자자의 장기 기하 성장률 |
| 변동성 드래그 | σ²/2 | Kelly가 제거하는 비에르고딕 손실 |
| Half-Kelly 이점 | 성장률 75%, 분산 25% | 추정 오차 버퍼 + 심리 안정 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 이진 Kelly f* | `backtester.js:1599-1602` `kellyFraction` | 패턴별 최적 포지션 비율 산출 |
| Half-Kelly 권장 | `appState.js` Tier 포지션 설정 | Tier별 Kelly 비율 × 0.5 포지션 상한 |
| 에르고딕 파산 방지 | `kellyFraction` 상한 1.0 클램핑 | 레버리지 방지: Full Kelly 초과 불허 |
| 다자산 Kelly | 향후 포트폴리오 최적화 예정 | 멀티 패턴 동시 보유 시 최적 비중 |


### 2.4.9 경영학 도출 요약 (Business Finance Summary)
본 절(2.4)은 기업재무론의 핵심 이론 여덟 가지가 CheeseStock의 분석 파이프라인에 어떻게 통합되는지를 정리한다. DCF와 WACC(2.4.1, 2.4.4)는 패턴 신호가 발생한 종목의 내재가치 맥락을 제공하고, 자본구조 이론(2.4.2, 2.4.3)은 종목의 재무 건전성과 세후 자본비용 추정의 이론적 근거가 된다. 대리인 이론(2.4.5)은 경영진 인센티브 구조를 통한 신뢰도 조정에, 시그널링 이론(2.4.6)은 공시 이벤트 해석에 각각 활용된다. EVA(2.4.7)는 D 컬럼 재무패널의 주주가치 창출 여부 판단 기준이 되고, Kelly 기준(2.4.8)은 백테스트 결과를 포지션 크기로 변환하는 수학적 다리 역할을 한다.

기술적 분석과 기업재무론은 상호 보완적이다. 기술적 분석이 "가격이 어디로 가는가(방향)"를 묻는다면, 기업재무론은 "가격이 어디에 있어야 하는가(수준)"를 묻는다. 이 두 질문이 교차하는 지점, 즉 내재가치 대비 과매도·과매수 구간에서 발생하는 기술적 반전 패턴이 CheeseStock의 핵심 투자 기회 식별 논리다. 저PBR(내재가치 이하)에서 이중바닥 패턴이 발생하거나, EVA 흑자 전환 시점에 골든크로스가 나타날 때 두 분석 계층이 동시에 신호를 발생시켜 신뢰도가 증폭된다.

앞으로의 활용 계층화를 위해, 제3장에서 EVA는 종목 신뢰도 조정(CONF-M2 채널), Kelly 기준은 Tier별 포지션 크기 결정에 각각 적용된다. CONF-M2는 EVA > 0 조건에서 패턴 신뢰도를 0~15% 상향 조정하는 메커니즘으로 설계될 예정이며, Kelly 비율은 `backtester.js`의 `kellyFraction` 필드로 이미 구현되어 있다.
$$\text{종합 신뢰도} = \underbrace{f(\text{패턴 품질})}_{\text{기술적 분석}} \times \underbrace{g(\text{EVA, PBR, WACC})}_{\text{기업재무 조정}} \times \underbrace{h(\text{매크로 환경})}_{\text{2.5절}}$$

$$\text{포지션 크기} = \text{Tier 한도} \times \min\!\left(\frac{f^*_{\text{Kelly}}}{2},\; f^*_{\text{max}}\right)$$

| 기호 | 의미  |
|------|------|
| f(·) | 패턴 품질 점수 함수  |
| g(·) | 재무 조정 함수 (EVA, PBR, WACC)  |
| h(·) | 매크로 환경 조정 함수  |
| f*_(Kelly) | 패턴별 Kelly 비율  |
| f*max | Tier별 최대 포지션 한도  |

> **이전 Stage 데이터:** 통합 신뢰도 계산의 각 입력값은 Stage 1에서 수신된 데이터에 기반한다. $f^*_{\text{Kelly}}$는 `backtester.js kellyFraction`, EVA는 `compute_eva.py` 출력물, $R_f$(매크로)는 ECOS API 국고채 수익률을 사용한다.

**제3장 적용 예고**

제3장에서 본 절의 이론들이 다음과 같이 직접 연결된다.

- **CONF-M2**: EVA > 0 ∧ ROIC > WACC 조건에서 매수 패턴 신뢰도 +5~15% 상향
- **CONF-M3**: WACC 변화 방향(금리 환경)에 따라 성장주·가치주 패턴 신뢰도 비대칭 조정
- **Tier 포지션**: `appState.js` Tier 한도 × `kellyFraction × 0.5` = 실행 포지션 비율
- **DCF 크로스체크**: PBR < 1.0(내재가치 이하) + 이중바닥 패턴 = 복합 매수 신호

<!-- newpage -->

## §2.4 경영학 (기업재무) — 5열 요약표

| 시트 | 핵심 모형 | 주요 학술 출처 | KRX 전달 경로 | 구현 상태 |
|---------------|--------------------|--------------------|------------------------------|---------------|
| 2.4.1 DCF 기업가치 평가 | DCF: V = Σ FCFt/(1+WACC)^t + TV; TV\_Gordon = FCF_1/(WACC−g) | Damodaran (1995, 2012) | DART 영업이익/EPS → `getFinancialData()` → `updateFinancials()` → PER/PBR 역산으로 내재가치 범위 추정; 추세 시각화: `drawFinTrendChart()` | 🔧 부분 구현 (PER/PBR 구현, FCFF 직접 계산 미구현) |
| 2.4.2 자본구조: MM 정리 | MM-I: V\_L = V\_U + T\_c·D; MM-II: R\_E = R\_A + (R\_A−R\_D)(D/E)(1−T\_c) | Modigliani & Miller (1958, 1963) | DART `자본총계`·`이자부채` → `updateFinancials()` 부채비율(`debtRatio`) 표시; `compute_eva.py` IC 분모 산출 | 🔧 부분 구현 (D/E·부채비율 표시 구현, 상충이론 최적화 미구현) |
| 2.4.3 Miller 개인세 모형 | G\_L = [1−(1−T\_c)(1−T\_s)/(1−T\_d)]·D; Case B(소액주주): G\_L ≈ 0.078D | Miller (1977) | `appWorker.js:1587,1631` 공매도 제한 조정(Miller 1977 인용); DART `자본총계`·`이자부채` → D/E → WACC 보정 이론 기반 제공 | 📐 설계 기반 (공매도 제한 조정만 구현, WACC 개인세 보정 미구현) |
| 2.4.4 WACC와 최적 자본비용 | WACC = (E/V)R\_e + (D/V)R\_d(1−T\_c); β\_L = β\_U[1+(1−T\_c)D/E] (Hamada) | Hamada (1972); CAPM | ECOS `R_f`(국고채 3/10년) + `compute_capm_beta.py`(β) → `compute_eva.py` WACC 산출 → `_applyPhase8ConfidenceToPatterns()` 금리 환경 패턴 신뢰도 조정 | 🔧 부분 구현 (`compute_eva.py` WACC 산출 구현, JS 실시간 WACC 계산 미구현) |
| 2.4.5 대리인 이론과 기업지배구조 | AC = MC + BF + RL; β\* = 1/[1+ρσ²/Δf²] (Holmstrom); ARI = Σ w\_i · 지표\_i | Jensen & Meckling (1976); Holmstrom (1979); Claessens et al. (2000) | DART ROE → `getFinancialData()` → `_applyMicroConfidenceToPatterns()` HHI×eps\_stability 신뢰도 조정(appWorker.js:1601); `updateFinancials()` 투자점수 ROE 항목 반영 | 🔧 부분 구현 (HHI 부스트 구현, ARI 설계 사양만 존재·eps\_stability fallback 1.0) |
| 2.4.6 시그널링 이론 | dC/dθ < 0 (Spence 단일교차); W = γ₀+γ₁V\_t−L·1(파산) (Ross); D\_t−D\_{t-1} = c(τE\_t−D\_{t-1}) (Lintner) | Spence (1973); Ross (1977); Bhattacharya (1979); Lintner (1956); Myers & Majluf (1984) | DART DPR·EPS growth → `updateFinancials()` 배당성향 간접 표시; `signal_dividend_bonus`(+0.05)·`signal_buyback_bonus`(+0.08) 상수는 설계만 존재 | 📐 설계 기반 (배당성향 표시 구현, 공시 이벤트 신호 연동 미구현) |
| 2.4.7 EVA 경제적 부가가치 | EVA = NOPAT − WACC×IC; NOPAT = EBIT×(1−T\_c); ROIC = NOPAT/IC; MVA = Σ EVA\_t/(1+WACC)^t | Stewart (1991) — Stern Stewart & Co. | DART EBIT·자본총계·이자부채 → `compute_eva.py` → `data/financials/{code}.json` eva 필드 → `_renderEVA()` (financials.js:466) → D 컬럼 EVA Spread 녹색/적색 표시 | ✅ 구현 완료 (`_renderEVA()`, `compute_eva.py`, `updateFinancials()` ROIC>WACC 판단 모두 구현) |
| 2.4.8 Kelly 기준과 포지션 사이징 | f\* = (bp−q)/b (이진 Kelly); f\* = μ/σ² (연속); G(f) = p·ln(1+bf)+q·ln(1−f); r̄ = μ−σ²/2 (Peters) | Kelly (1956); Thorp (2006); Peters (2019) | 패턴 백테스트 승률(p)·손익비(b) → `backtester.js:1599–1602` `kellyFraction` 산출 → `appState.js` Tier 포지션 한도 × kellyFraction × 0.5 = 실행 포지션 비율 | ✅ 구현 완료 (`backtester.js` kellyFraction, Half-Kelly 클램핑 구현) |

---

## 2.5 경제학적 기초: 거시경제와 미시경제[^econ-1]

경제학은 주식시장 행태를 지배하는 거시경제적, 미시경제적 맥락을 제공한다.
거시경제학(2.5.1-2.5.11)은 경기순환, 통화정책, 환율, 수익률 곡선 등
시장 전체에 영향을 미치는 체계적 요인을 다루며, 패턴 신뢰도의 매크로 조정에
직접 활용된다. 미시경제학(2.5.12-2.5.14)은 수요-공급 메커니즘, 산업 집중도,
정보비대칭 등 개별 종목 수준의 구조적 특성을 다루며, 종목별 미시 조정에
활용된다.

**이론적 흐름 (15시트):** 거시 — IS-LM 통화정책 (2.5.1) → 테일러 준칙 (2.5.2) → 먼델-플레밍 개방경제 (2.5.3) → AD-AS 총수요공급 (2.5.4) → Stovall 섹터 회전 (2.5.5) → MCS 복합경기점수 (2.5.6) → 뉴케인지언 필립스 곡선 (2.5.7) → 재정승수와 구축효과 (2.5.8) → 환율모형 PPP/IRP/도른부시 (2.5.9) → 수익률 곡선과 기간구조 (2.5.10) → HMM 거시 레짐 (2.5.11). 미시 — 수요-공급-탄력성 (2.5.12) → HHI 산업 집중도 (2.5.13) → 정보비대칭과 탐색비용 (2.5.14) → 요약 (2.5.15). 단기 균형에서 장기 구조까지, 체계적 요인을 다층적으로 포착한다.


### 2.5.1 IS-LM 모형과 통화정책 (IS-LM Model and Monetary Policy)
IS-LM 모형은 Hicks(1937)가 Keynes(1936)의 *General Theory*를 2차원 도식으로 변환한 이래 단기 거시균형 분석의 표준 프레임워크로 사용되어 왔다. IS 곡선은 재화시장의 균형(투자=저축)을, LM 곡선은 화폐시장의 균형(유동성 선호=화폐공급)을 나타내며, 두 곡선의 교차점에서 균형 산출량 $Y^*$와 균형 이자율 $r^*$가 동시에 결정된다.

한국은 GDP 대비 수출 비중이 약 50%에 달하는 소규모 개방경제이므로, 폐쇄경제 IS-LM만으로는 분석이 불완전하다. 변동환율제 하에서 통화정책이 재정정책보다 유효하다는 먼델-플레밍 결과(2.5.3절에서 후술)가 한국 주식시장에서의 BOK 기준금리 발표의 지배적 영향력을 이론적으로 뒷받침한다. 한국 파라미터 추정치로는 한계소비성향 $c_1 \approx 0.55$, 한계세율 $t \approx 0.25$, 한계수입성향 $m \approx 0.45$가 사용된다(BOK 2023, 관세청).

IS-LM 비교정학은 정책 충격의 방향과 크기를 예측하는 데 핵심이다. 통화확장($M/P$ 증가)은 $Y$ 증가와 $r$ 하락을 동시에 가져오는 "이중 호재"인 반면, 재정확장($G$ 증가)은 $Y$ 증가와 함께 $r$ 상승(구축효과)을 수반하여 성장주에 비우호적이다. 이러한 비대칭성이 CheeseStock의 `_applyMacroConfidence` 함수에서 매크로 이벤트별 패턴 신뢰도 차등 조정의 이론적 기반이 된다.
$$Y = \frac{A - b \cdot r}{1 - c_1(1-t) + m}, \qquad A = C_0 - c_1 T_0 + I_0 + G_0 + X_0 + \eta \cdot e$$

$$\text{IS}: \; r = \frac{A}{b} - \frac{1 - c_1(1-t) + m}{b} \cdot Y$$

$$\text{LM}: \; r = \frac{k}{h} \cdot Y - \frac{M/P}{h}$$

$$Y^* = \frac{h \cdot A + b \cdot (M/P)}{h \cdot s + b \cdot k}, \quad r^* = \frac{k \cdot A - s \cdot (M/P)}{h \cdot s + b \cdot k}, \quad s = 1 - c_1(1-t) + m$$

| 기호 | 의미  |
|------|------|
| c1 | 한계소비성향(MPC)  |
| t | 한계세율  |
| m | 한계수입성향  |
| b | 투자의 이자율 민감도  |
| k | 소득의 화폐수요 민감도  |
| h | 이자율의 화폐수요 민감도  |
| i_(BOK) | BOK 기준금리  |
| CLI | OECD 경기선행지수  |

> **이전 Stage 데이터:** Stage 1에서 $i_{\text{BOK}} = 2.50\%$, $\text{CLI} = 101.65$가 수집되었으며, IS-LM 균형 판별의 입력으로 사용된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| IS-LM 비교정학 (통화/재정 비대칭) | `_applyMacroConfidenceToPatterns()` | 매크로 이벤트별 패턴 신뢰도 차등 조정 |
| 유동성 함정 판별 (h → ∞) | `MCS_THRESHOLDS`, BOK 기준금리 0.75% 이하 | 통화정책 이벤트 트레이딩 신호 감쇠 |
| 구축효과 (재정확장 시 r 상승) | `conf_fiscal = 1.03` (Doc30 §1.4) | 추경 발표 시 제한적 conf 조정 |

---


### 2.5.2 테일러 준칙 (Taylor Rule)
테일러 준칙은 Taylor(1993)가 제안한 통화정책 준칙으로, 중앙은행의 정책금리 설정을 인플레이션 갭과 산출량 갭의 선형함수로 정형화한다. 한국은행이 공식적으로 테일러 준칙을 따르지는 않으나, 사후적(ex post) 분석에서 금통위 결정은 테일러 준칙과 높은 정합성을 보인다. 핵심 파라미터 중 자연이자율 $r^*$은 Laubach-Williams(2003) 추정의 한국 적용 하한인 0.5%를 사용하며, 이는 `macro_composite.json`의 `taylor_r_star=0.5`과 동기화된다. 1.0%가 아닌 0.5%를 채택하는 이유는 한국의 잠재성장률 하락 추세(2020년대 2% 미만)와 인구구조 변화를 반영한 것이다.

테일러 갭(Taylor gap)은 실제 정책금리와 테일러 준칙이 시사하는 금리의 차이($i_{\text{actual}} - i_{\text{Taylor}}$)로, 갭의 부호가 통화정책 스탠스를 나타낸다. 양(+)의 갭은 과도한 긴축(hawkish)으로 성장주를 억압하고 금융주에 유리하며, 음(-)의 갭은 과도한 완화(dovish)로 성장주 부양과 자산 버블 위험을 동시에 내포한다. 현재 시스템의 테일러 갭은 $-0.65\%$p로 완화적 스탠스를 시사한다.

산출량 갭 추정에는 OECD CLI(경기선행지수 순환변동치)를 프록시로 사용한다. CLI는 100을 장기 추세로 정규화하므로, $(CLI - 100) \times 0.5$로 산출량 갭을 근사한다. BOK의 공식 산출량 갭 추정치는 연 2회(통화신용정책보고서)만 공개되므로, CLI 기반 실시간 프록시가 실용적이다.
$$i^* = r^* + \pi + a_\pi(\pi - \pi^*) + a_y(\tilde{y} - \tilde{y}^*)$$

$$\text{Taylor\_gap} = i_{\text{actual}} - i^*$$

$$\tilde{y} = (CLI - 100) \times \text{CLI\_TO\_GAP\_SCALE}, \quad \text{CLI\_TO\_GAP\_SCALE} = 0.5 \;\; (\#139)$$

| 기호 | 의미  |
|------|------|
| r* | 자연이자율(균형 실질이자율)  |
| π | 현재 CPI 인플레이션율  |
| π* | 인플레이션 목표  |
| a_π | 인플레 반응 계수  |
| a_y | 산출량 갭 반응 계수  |
| π_(CPI) | CPI 전년동월비  |
| Taylor\_gap | 테일러 갭  |

> **이전 Stage 데이터:** Stage 1에서 $\pi_{\text{CPI}} = 2.16\%$, $\text{Taylor\_gap} = -0.65\%$p가 수집되었다. 현재 BOK 기준금리(2.50%)가 테일러 시사금리(3.15%)보다 낮아 완화적 스탠스이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Taylor gap → 금리 방향 프록시 | CONF-F7, `_applyMacroConfidenceToPatterns()` L1271-1295 | dovish: 매수 부스트, hawkish: 매도 부스트 |
| Dead band | gap | < 0.5\%p | 상수 #141 = 0.25 (정규화) | 미약한 갭에서 불필요한 조정 억제 |
| Gap 정규화 [-2, +2] → [-1, +1] | `tgNorm = clamp(taylorGap/2, -1, 1)` | 극단 갭에서 과도한 승수 방지 |

---


### 2.5.3 먼델-플레밍 모형 (Mundell-Fleming Model)
먼델-플레밍 모형은 Mundell(1963)과 Fleming(1962)이 IS-LM을 개방경제로 확장한 것으로, 국제수지(BP) 곡선을 추가하여 환율-이자율-산출량의 삼원 균형을 분석한다. 핵심 결론인 "삼위일체 불가능성(Trilemma)"에 의하면, 자유로운 자본이동, 독립적 통화정책, 고정환율제를 동시에 달성할 수 없다. 한국은 1997년 외환위기 이후 변동환율제를 채택하여 자본이동의 자유와 통화정책 독립성을 선택했다(단, de facto 관리변동에 가까움).

변동환율제 하에서 먼델-플레밍의 핵심 결과는 통화정책이 재정정책보다 유효하다는 것이다. BOK 기준금리 인하 시 내외금리차 축소 $\to$ 자본유출 $\to$ KRW 약세 $\to$ 순수출 증가로 산출량이 크게 증가한다. 반면 재정확장은 금리 상승 $\to$ 자본유입 $\to$ KRW 강세 $\to$ 순수출 감소로 효과가 상쇄된다. 실증적으로 BOK -25bp 인하는 당일 KOSPI +1.2%를 유발하는 반면, 추경 10조원은 당일 +0.3%에 그친다.

한미 금리차($i_{\text{BOK}} - i_{\text{Fed}}$)는 자본유출입 압력의 핵심 변수이다. 현재 한미 금리차는 $-1.14\%$p로, 미국 금리가 한국보다 높아 구조적 자본유출 압력이 존재한다. 이는 원화 약세($1,514$원/달러)와 외국인 순매도 경향으로 관측되며, 수출주 실적에는 호재이나 외국인 수급에는 악재인 이중적 효과를 나타낸다.
$$BP = NX(Y, e) + KA(r - r^*, E[\Delta e]) = 0$$

$$r = r^* + E[\Delta e] + \frac{m}{\kappa} \cdot Y - \frac{X_0 + \eta \cdot e}{\kappa}$$

$$\text{통화확장}(M\uparrow): \; r\downarrow \to \text{자본유출} \to e\downarrow \to NX\uparrow \to Y\uparrow \quad (\text{Strong})$$

$$\text{재정확장}(G\uparrow): \; r\uparrow \to \text{자본유입} \to e\uparrow \to NX\downarrow \to Y \approx 0 \quad (\text{Weak})$$

| 기호 | 의미  |
|------|------|
| κ | 자본이동성  |
| r* | 해외이자율(Fed Funds Rate)  |
| E[Δ e] | 기대환율변동률  |
| i_(Fed) | 미국 연방기금금리  |
| e_(USD/KRW) | 원/달러 환율  |

> **이전 Stage 데이터:** Stage 1에서 $i_{\text{Fed}} = 3.64\%$, $e_{\text{USD/KRW}} = 1{,}514$원이 수집되었다. 한미 금리차 $-1.14\%$p는 자본유출 압력을 시사한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 한미 금리차 → 자본유출입 | CONF-F9, `rate_diff` in `macro_latest.json` | 외국인 수급 방향 보정 |
| 환율 → 수출채널 | `_applyMacroConfidenceToPatterns()` | 수출주 패턴 신뢰도 환율 연동 |
| BOK vs 추경 비대칭성 | `conf_bok=1.08` vs `conf_fiscal=1.03` | 이벤트 유형별 conf 차등 |

---


### 2.5.4 AD-AS 프레임워크 (Aggregate Demand -- Aggregate Supply Framework)
AD-AS 모형은 IS-LM이 고정한 물가수준 $P$를 내생화하여 물가와 산출량의 동시 결정을 분석한다. 총수요(AD) 곡선은 IS-LM 균형에서 $P$를 변화시킬 때 $Y^*$의 궤적이며, 우하향한다. 우하향의 세 가지 메커니즘은 피구 효과(실질잔고 효과), 케인즈 효과(이자율 효과), 먼델-플레밍 효과(환율 효과)이며, 한국에서는 수출 비중이 높아 환율 효과가 가장 강력하다.

총공급(AS) 곡선은 학파에 따라 형태가 근본적으로 다르다. 고전학파의 LRAS는 수직($Y = Y_n$)으로 물가 변화가 실질변수에 무영향이며, 케인즈학파의 SRAS는 가격경직성으로 인해 우상향하여 수요 변화가 산출량에 영향을 미친다. 뉴케인지언 필립스 곡선(NKPC, 2.5.7절)은 이를 미시적 기초에서 도출한 현대적 AS 곡선이다.

AD-AS 프레임워크의 핵심 활용은 4가지 충격 시나리오 분석이다. 양(+)의 수요충격은 $P\uparrow, Y\uparrow$로 추세추종 패턴 신뢰도를 높이고, 음(-)의 공급충격(스태그플레이션)은 $P\uparrow, Y\downarrow$로 모든 패턴 신뢰도를 저하시킨다. 한국의 경우 2022년 상반기 러시아-우크라이나발 유가 급등이 음의 공급충격, 2023년 하반기 반도체 업턴이 양의 공급충격(골디락스 근사)에 해당한다.
$$Y_{AD}(P) = \frac{h \cdot A + b \cdot (M/P)}{D}, \quad \frac{dY_{AD}}{dP} = -\frac{bM}{D \cdot P^2} < 0$$

$$\text{SRAS}: \; P = P^e + \frac{1}{\alpha}(Y - Y_n)$$

$$\text{LRAS}: \; Y = Y_n \;\; (\text{수직, 장기 화폐중립성})$$

| 기호 | 의미  |
|------|------|
| P^e | 기대물가수준  |
| α | 가격경직성 파라미터  |
| Yn | 자연산출량(잠재GDP)  |
| D | IS-LM 분모 (hs + bk)  |

**4가지 충격 시나리오**

| 시나리오 | 원인 | P | Y | 패턴 conf 조정 | KRX 사례 |
|----------|------|-----|-----|----------------|----------|
| 수요(+) | M↑, 수출 호조 | ↑ | ↑ | 추세추종 +0.08 | 2020 Q3 유동성 완화 |
| 수요(-) | 금융 긴축, 소비 위축 | ↓ | ↓ | 반전 +0.10 | 2020 Q1 COVID |
| 공급(-) | 유가 급등, 공급망 교란 | ↑ | ↓ | 전체 -0.12 | 2022 H1 스태그플레이션 |
| 공급(+) | 기술혁신, 유가 하락 | ↓ | ↑ | 전체 +0.05 | 2023 H2 반도체 슈퍼사이클 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 4-충격 시나리오 | `_applyMacroConfidenceToPatterns()` conf_adj | 레짐별 패턴 유형 차등 조정 |
| AD 이동 요인 (해외 수요 지배) | MCS v2 수출 가중치 0.10 | 글로벌 경기가 한국 AD 지배 |
| SRAS 좌측이동 = 스태그플레이션 | VIX > 30 + 원자재 급등 복합 판단 | 전 패턴 신뢰도 감산 |

---


### 2.5.5 Stovall 섹터 회전 모형 (Stovall Sector Rotation Model)
Stovall(1996)의 "Standard & Poor's Guide to Sector Investing"은 경기순환 4국면(Early Expansion, Late Expansion, Early Contraction, Late Contraction)별로 초과수익이 기대되는 섹터를 체계화한 최초의 실증 연구이다. 초기 확장기에는 금융, IT, 경기소비재가, 후기 확장기에는 에너지와 소재가, 초기 수축기에는 헬스케어, 유틸리티, 필수소비재가, 후기 수축기에는 산업재와 경기소비재가 각각 선호된다.

한국 시장 적용에는 구조적 한계가 존재한다. KRX는 반도체/자동차 수출 편중(KOSPI 시총의 약 30%)으로 글로벌 수요 사이클에 동조하며, 재벌(chaebol) 구조로 섹터 간 자금 이동이 미국과 다른 패턴을 보인다. KOSDAQ에서는 개인투자자 비중이 높아 전통적 섹터 회전이 작동하지 않을 수 있다. 따라서 CheeseStock에서는 Stovall 모형을 직접 적용하되, 0.5 감쇄(dampening) 계수를 적용하여 과신을 방지한다.

경기국면 판별은 OECD CLI(경기선행지수)와 PMI를 결합하여 수행한다. CLI > 100이고 상승 추세이면 Expansion, CLI > 100이고 하락 추세이면 Peak, CLI < 100이고 하락 추세이면 Contraction, CLI < 100이고 상승 추세이면 Trough로 분류한다. 현재 CLI = 101.65이고 상승 추세(delta = +0.20)이므로 Expansion 국면이며, 11개월째 지속 중이다.
$$\text{conf\_adj}_{sector} = 1 + 0.5 \times (\text{STOVALL\_MULT}_{sector,phase} - 1.0)$$

$$\text{sell\_mult} = 2.0 - \text{buy\_mult} \quad (\text{매도 패턴 대칭 역전})$$

$$\text{Phase} = f(CLI, \Delta CLI): \; \begin{cases} \text{Expansion} & CLI > 100, \Delta CLI > 0 \\ \text{Peak} & CLI > 100, \Delta CLI \leq 0 \\ \text{Contraction} & CLI < 100, \Delta CLI < 0 \\ \text{Trough} & CLI < 100, \Delta CLI \geq 0 \end{cases}$$

| 기호 | 의미  |
|------|------|
| STOVALL_MULT | 국면-섹터 승수  |
| 0.5 | 감쇄 계수 (KRX 미검증 보정)  |
| CLI | OECD 경기선행지수  |
| PMI | 제조업 구매관리자지수  |

> **이전 Stage 데이터:** Stage 1에서 $\text{CLI} = 101.65$, $\text{cycle\_phase} = \text{expansion}$(11개월)이 수집되었다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 경기국면-섹터 승수 매핑 | `_STOVALL_CYCLE` (appState.js L416) | 12섹터 × 4국면 신뢰도 승수 |
| KSIC → GICS-like 매핑 | `_getStovallSector()` (appState.js L489) | KSIC 137개 세분류 → 11개 대분류 |
| 감쇄 적용 | CONF-F1a, `_applyMacroConfidenceToPatterns()` | 미검증 모형의 과신 방지 |

---


### 2.5.6 MCS 복합경기점수 (Macro Composite Score v2)
MCS(Macro Composite Score)는 다수의 거시경제 지표를 단일 점수로 종합하여 거시환경의 강세/약세를 판별하는 복합지수이다. 초기 MCS v1은 PMI, CSI, 수출, 금리스프레드, EPU 역수의 5요소 가중합이었으나, 현재 시스템의 권위적(authoritative) 버전은 8요소 MCS v2이다. v2는 CLI, ESI, IPI, 소비자신뢰, PMI, 수출, 실업률 역수, 금리스프레드를 포함하며, v1의 EPU(경제정책불확실성)는 VIX 프록시와의 중복으로 제거되었다.

MCS v2는 0-100 스케일로 `macro_composite.json`의 `mcsV2` 필드에 저장된다. 현재값 65.7은 "약한 강세(mild bullish)" 영역에 해당한다. MCS > 70이면 매수 패턴 +5%, MCS < 30이면 매도 패턴 +5%로 조정하며, 30-70 구간은 중립이다. `appWorker.js`에서는 0-1 vs 0-100 스케일 가드가 적용되어 `macro_latest.json`의 mcs(0-1)와 `macro_composite.json`의 mcsV2(0-100)가 자동 구분된다.

8개 구성요소의 가중치는 지표의 선행성과 포괄성을 반영한다. CLI에 최대 가중치(0.20)를 부여하는 이유는 CLI가 고용, 생산, 소비, 금융 등 10개 하위지표를 이미 종합한 가장 포괄적인 선행지표이기 때문이다. ESI와 IPI(각 0.15)는 심리와 실물을 각각 대리한다. 나머지 5개 지표(각 0.10)는 보조적 확인(confirmation) 역할을 한다.
$$\text{MCS}_{v2} = \sum_{j=1}^{8} w_j \cdot z_j \times 100, \quad \sum_{j=1}^{8} w_j = 1$$

$$\text{가중치}: \; w_{\text{CLI}}=0.20, \; w_{\text{ESI}}=0.15, \; w_{\text{IPI}}=0.15, \; w_{\text{소비자}}=0.10, \; w_{\text{PMI}}=0.10, \; w_{\text{수출}}=0.10, \; w_{\text{실업}^{-1}}=0.10, \; w_{\text{금리차}}=0.10$$

$$z_j = \text{clip}\!\left(\frac{x_j - x_{j,\min}}{x_{j,\max} - x_{j,\min}},\; 0,\; 1\right) \quad (\text{각 지표의 [0,1] 정규화})$$

| 기호 | 의미  |
|------|------|
| wj | 제j 구성요소 가중치  |
| zj | 정규화된 구성요소 값  |
| CLI | OECD 경기선행지수  |
| ESI | 경제심리지수  |
| IPI | 산업생산지수  |
| MCSv2 | MCS v2 복합점수  |

> **이전 Stage 데이터:** Stage 1에서 $\text{MCS}_{v2} = 65.7$이 수집되었다. 8개 구성요소 중 CLI(0.904), 수출(0.839), 실업률 역수(0.775)가 강세, PMI(0.300)가 약세이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| MCS v2 → 패턴 신뢰도 조정 | `_applyPhase8ConfidenceToPatterns()` L569 | MCS>70: 매수 +5%, MCS<30: 매도 +5% |
| MCS 임계값 | `MCS_THRESHOLDS` (appState.js L405) | strong_bull:70, bull:55, bear:45, strong_bear:30 |
| 0-1/0-100 스케일 가드 | `if (mcs > 0 && mcs <= 1.0) mcs *= 100` | macro_latest vs macro_composite 호환 |

---


### 2.5.7 뉴케인지언 필립스 곡선 (New Keynesian Phillips Curve)
필립스 곡선의 지적 계보는 Phillips(1958)의 임금-실업 역관계에서 시작하여, Friedman(1968)과 Phelps(1967)의 기대 부가 필립스 곡선(expectations-augmented Phillips curve)을 거쳐, Lucas(1972)의 합리적 기대 혁명과 Calvo(1983)의 시차적 가격 설정(staggered pricing)으로 발전했다. 현대 거시경제학의 표준은 Gali & Gertler(1999)의 혼합형 NKPC(Hybrid New Keynesian Phillips Curve)이며, 이는 전방 기대($E_t[\pi_{t+1}]$)와 후방 관성($\pi_{t-1}$)을 모두 포함한다.

NKPC의 핵심 파라미터인 Calvo 가격경직도 $\theta$는 매 기간 가격을 조정하지 못하는 기업 비율을 나타낸다. 한국의 $\theta \approx 0.75$는 평균 4분기(1년)에 한 번 가격을 조정함을 의미하며, 미국($\theta \approx 0.66$, 평균 3분기)보다 가격경직성이 강하다. 이는 통화정책 변화가 한국에서 물가보다 실물(산출량, 고용)에 더 크게 전달됨을 시사하며, 결과적으로 BOK 금리 변경이 주가에 미치는 영향이 구조적으로 크다.

주식시장 관점에서 NKPC의 기울기 $\kappa$가 작을수록(가격이 경직적일수록) 수요 충격의 산출량 효과가 크고 물가 효과가 작다. 한국의 $\kappa \approx 0.05$는 수요 확장이 인플레이션보다 실질 성장으로 이어질 가능성이 높음을 의미하며, 이는 확장적 통화정책이 주식시장에 상대적으로 우호적인 환경을 제공한다.
$$\pi_t = \gamma_f \cdot \beta \cdot E_t[\pi_{t+1}] + \gamma_b \cdot \pi_{t-1} + \kappa \cdot \tilde{y}_t$$

$$\kappa = \frac{(1-\theta)(1-\beta\theta)}{\theta} \cdot (\sigma + \phi)$$

$$\text{Calvo}: \; \theta = 0.75 \;\; (\text{한국}), \quad \beta = 0.99, \quad \kappa \approx 0.05$$

| 기호 | 의미  |
|------|------|
| θ | Calvo 가격경직도  |
| β | 할인인자  |
| κ | NKPC 기울기  |
| σ | 기간간 대체탄력성의 역수  |
| φ | 노동공급 탄력성의 역수  |
| π_(CPI) | CPI 전년동월비  |

> **이전 Stage 데이터:** Stage 1에서 $\pi_{\text{CPI}} = 2.16\%$이 수집되었다. BOK 인플레이션 목표(2.0%)에 근접하여 물가 안정 국면이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| θ 높음 → 통화정책 실물 전달 강화 | BOK 이벤트 conf_adj = 1.08 (재정 1.03 대비 강) | IS-LM 비교정학과 결합하여 이벤트 비대칭 설명 |
| κ 작음 → 수요충격이 Y에 집중 | MCS v2 확장기 판별 시 주가 반응 크기 근거 | 확장적 정책 → 성장주 부양 이론적 기반 |
| Hybrid NKPC 관성 (γ_b) | 현재 미구현 -- 이론적 참조만 | 인플레이션 지속성 판단의 학술 근거 |

---


### 2.5.8 재정승수와 구축효과 (Fiscal Multiplier and Crowding-Out Effect)
재정승수(fiscal multiplier)는 정부지출 1단위 증가가 GDP를 얼마나 증가시키는지를 측정한다. 단순 케인즈 승수 $k_G = 1/(1-c_1(1-t))$는 폐쇄경제 + LM 수평(금리 고정) 가정 하에서 도출되며, 한국의 경우 약 1.70이다. 그러나 개방경제로 확장하면 한계수입성향 $m = 0.45$에 의한 수입 누출이 극도로 커서, 개방경제 승수 $k_{G,\text{open}} = 1/(1 - c_1(1-t) + m) \approx 0.96$으로 1 미만이 된다. 정부지출 1원이 GDP를 1원조차 증가시키지 못하는 것이다.

IS-LM 승수(구축효과 포함)는 $k_{G,\text{ISLM}} = h/D \approx 0.86$으로 더 낮아진다. 정부지출 증가 $\to$ IS 우측이동 $\to$ $r$ 상승 $\to$ 민간투자 감소(구축효과)가 추가되기 때문이다. 국제 비교에서 한국(0.86-1.04)은 미국(1.50-2.00)이나 일본(1.10-1.50)보다 현저히 낮은데, 이는 한국의 높은 수입 의존도($m=0.45$ vs 미국 $m=0.15$)에 기인한다.

리카도 대등정리(Ricardian Equivalence, Barro 1974)는 합리적 기대 하에서 국채 발행 재원의 재정확대가 GDP에 무영향이라는 강한 결론이다. 소비자가 미래 증세를 예상하여 저축을 늘리면 현재 소비가 변하지 않는다. 완전한 리카도 대등은 비현실적이나(유동성 제약, 유한 수명, 비합리적 기대), 재정정책의 한계를 이론적으로 설명하는 데 유용하다. 한국에서는 가계부채/GDP 비율이 약 105%로 세계 상위권이어서, 추가 재정확대의 소비 자극 효과가 구조적으로 제한된다.
$$k_G = \frac{1}{1 - c_1(1-t)}, \quad k_{G,\text{open}} = \frac{1}{1 - c_1(1-t) + m}, \quad k_{G,\text{ISLM}} = \frac{h}{h \cdot s + b \cdot k}$$

$$k_T = \frac{-c_1}{1 - c_1(1-t) + m} \approx -0.53 \quad (\lvert k_T \rvert < k_G: \text{조세 승수 < 지출 승수})$$

$$k_{BB} = k_G + k_T \approx 0.43 \quad (\text{균형재정 승수})$$

$$\text{ZLB}: \; h \to \infty \implies k_{G,\text{ZLB}} = \frac{1}{s} \approx 0.96 \;\;(\text{구축효과 소멸, 한국})$$

| 기호 | 의미  |
|------|------|
| k_G | 정부지출 승수  |
| k_T | 조세 승수  |
| s | 한계 누출률 (1-c1(1-t)+m)  |
| k_(BB) | 균형재정 승수  |
| ZLB | 제로금리 하한  |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| k_(G,open) < 1 → 재정정책 미약 | `conf_fiscal = 1.03` (Doc30 §1.4) | 추경 뉴스에 제한적 conf 조정 |
| ZLB 승수 증폭 (k_mult = 1.50) | 상수 #97: `r_zlb = 0.75%` | ZLB 환경 시 추경 conf 상향 가능 |
| | k_T | < k_G | 현재 미구현 -- 이론적 참조 | 감세 뉴스의 conf < 추경 conf 근거 |

---


### 2.5.9 환율모형: PPP, IRP, 도른부시 오버슈팅 (Exchange Rate Models: PPP, IRP, Dornbusch Overshooting)
환율 결정이론은 장기 균형(PPP), 차익거래 조건(IRP), 동태적 조정(도른부시 오버슈팅)의 세 층위로 구성된다. 절대적 구매력평가(Absolute PPP, Cassel 1918)는 환율이 양국 물가수준의 비율로 결정된다고 주장하나, 비교역재, 운송비용, 관세 등으로 인해 단기에서는 대규모 괴리가 발생한다. 상대적 PPP는 환율 변화율이 인플레이션 차이와 일치한다는 약한 형태로, 장기 추세 분석에만 유효하다.

금리평가(Interest Rate Parity)는 커버드(CIP)와 언커버드(UIP)로 구분된다. CIP는 선물환 프리미엄이 내외금리차와 일치하는 차익거래 조건으로 거의 항상 성립한다. UIP는 기대환율변동률이 금리차와 일치한다는 가설이나, 실증적으로 "forward premium puzzle"(Fama 1984)이 존재하여 고금리 통화가 예측과 반대로 절상되는 경향이 있다. 현재 한미 금리차 $-1.14\%$p 하에서 UIP는 원화 절상을 예측하나, 실제로는 지정학 리스크와 무역 불확실성으로 원화 약세가 지속되고 있다.

도른부시(Dornbusch 1976)의 오버슈팅 모형은 통화정책 충격 시 환율이 장기 균형을 초과하여 반응(overshooting)한 후 점진적으로 수렴하는 동태를 설명한다. 이는 재화시장의 가격경직성(점진 조정)과 금융시장의 가격신축성(즉시 조정)의 속도 차이에 기인한다. 이 모형은 BOK 기준금리 변경 직후 USD/KRW의 과잉반응과 후속 mean reversion을 이해하는 이론적 기반을 제공한다.
$$\text{Absolute PPP}: \; e = \frac{P}{P^*}$$

$$\text{CIP}: \; \frac{F}{S} = \frac{1 + i_d}{1 + i_f}$$

$$\text{UIP}: \; E[\Delta e] = i_d - i_f$$

$$\text{Dornbusch}: \; e(t) = \bar{e} + (e_0 - \bar{e}) \cdot \exp(-\theta t), \quad \theta = \frac{\delta(\sigma + \phi)}{\sigma + \phi + \delta\kappa}$$

| 기호 | 의미  |
|------|------|
| e | 명목환율 (원/달러)  |
| ē | 장기 균형환율  |
| F / S | 선물환율 / 현물환율  |
| θ | 환율 수렴 속도  |

> **참고:** 이 시트는 이론 전용(theory-only)이다. 런타임에서 환율 모형을 직접 구현하지 않으며, USD/KRW 수출채널이 간접 프록시로 작동한다. 환율은 `macro_latest.json`의 `usdkrw` 필드로 수집되어 먼델-플레밍(2.5.3절)의 입력으로 사용된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| UIP/금리차 → 환율 방향 | `rate_diff` in `macro_latest.json` | 자본유출입 압력 프록시 |
| 오버슈팅 → 환율 mean reversion | 현재 미구현 | BOK 이벤트 후 수출주 반전 패턴 해석 |
| PPP 장기 균형 | 현재 미구현 | 구조적 원화 가치 평가 참조 |

---


### 2.5.10 금리 기간구조와 수익률 곡선 (Term Structure and Yield Curve)
금리 기간구조(term structure of interest rates)는 만기에 따른 채권수익률의 함수이며, 수익률 곡선(yield curve)으로 시각화된다. 수익률 곡선의 형태는 경기 전망의 가장 강력한 선행지표 중 하나로, Estrella & Mishkin(1998)에 따르면 미국에서 수익률 곡선 역전은 1960-2020년 8회 중 8회 경기침체를 사전 예측했다. 한국 국고채 10년-3년 스프레드 기준으로는 5회 중 4회 경기침체를 선행했으며, 선행 시차는 미국(12-18개월)보다 짧은 6-12개월이다.

기대가설(Expectations Hypothesis)은 장기금리가 미래 단기금리의 기대값의 평균이라는 이론이다. 이에 따르면 수익률 곡선 역전은 시장이 미래 금리 인하(경기 악화)를 예상함을 의미한다. Hicks(1939)의 유동성 프리미엄 이론은 투자자가 장기 채권에 대해 추가 보상(유동성 프리미엄)을 요구하므로, 정상적 수익률 곡선은 우상향한다고 설명한다. 역전은 이 프리미엄마저 상쇄할 만큼 강한 금리 하락 기대가 존재함을 시사한다.

Nelson-Siegel-Svensson(NSS) 모형은 수익률 곡선을 Level($\beta_1$, 장기 수준), Slope($\beta_2$, 기울기), Curvature($\beta_3$, 곡률)의 3요인으로 분해한다. Level은 장기 기대 인플레이션 + 실질 균형금리를, Slope는 통화정책 스탠스를, Curvature는 중기 경기 기대와 정책 불확실성을 반영한다. 현재 한국 국고채 10년-3년 스프레드는 0.30%p(=30bp)로 양(+)이나 평탄화(flattening) 추세에 있어 경기 둔화 가능성을 시사한다.
$$y(\tau) = \beta_1 + \beta_2 \left[\frac{1-e^{-\tau/\lambda}}{\tau/\lambda}\right] + \beta_3 \left[\frac{1-e^{-\tau/\lambda}}{\tau/\lambda} - e^{-\tau/\lambda}\right]$$

$$\text{Spread} = y_{10Y} - y_{3Y}, \quad \text{역전}: \text{Spread} < 0 \implies \text{경기침체 선행 6-12개월}$$

$$\text{기대가설}: \; (1+i_{2Y})^2 = (1+i_{1Y})(1+E[i_{1Y,t+1}])$$

| 기호 | 의미  |
|------|------|
| β1 | Level (장기 수준)  |
| β2 | Slope (기울기)  |
| β3 | Curvature (곡률)  |
| λ | 감쇠 매개변수  |
| y_(10Y-y_{3Y)} | 국고채 10Y-3Y 스프레드  |
| YC_phase | 수익률곡선 국면  |

> **이전 Stage 데이터:** Stage 1에서 $\text{term\_spread} = 0.35\%$p, $\text{yieldCurvePhase} = \text{flattening}$이 수집되었다. 역전은 아니나 평탄화 추세이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 수익률곡선 4-체제 분류 | `_applyMacroConfidenceToPatterns()` L1158-1190 | Bull-Steep/Flat, Bear-Steep/Flat 체제별 conf 조정 |
| 역전 → 최강 매수 억제 | `slope < 0: adj *= 0.88` (매수), `1.12` (매도) | 경기침체 선행 12-18개월 |
| Taylor gap → Bull/Bear 판별 | `taylorGap < 0: Bull` (dovish) | 수익률곡선 방향 프록시 |

---


### 2.5.11 HMM 레짐의 거시경제적 해석 (Macroeconomic Interpretation of HMM Regimes)
은닉 마르코프 모형(Hidden Markov Model, Hamilton 1989)은 관측 불가능한 "레짐"(regime)이 관측 가능한 수익률의 통계적 특성을 결정한다고 가정한다. 경제학적으로 레짐은 거시경제 상태(확장/수축, 저변동/고변동)에 대응하며, 전이행렬(transition matrix)이 레짐 간 전환 확률을 기술한다. Hamilton(1989)은 미국 전후 데이터에서 2개 변동성 레짐(강세: 월 수익률 +0.9%, 변동성 4.5% / 약세: -0.3%, 7.2%)을 식별했으며, 평균 레짐 지속기간은 8-10개월이었다. CheeseStock는 Hamilton의 원전 설정을 따라 2-state(Bull, Bear) 가우시안 HMM을 채택한다.

CheeseStock의 HMM 레짐 분류는 `compute_hmm_regimes.py`의 `fit_hmm_2state()` 함수에서 KOSPI 시가총액 가중 일별 수익률에 Baum-Welch EM 알고리즘(50회 반복)을 적용하여 Bull/Bear 2-state 레짐을 추정한다. 추정 결과는 `hmm_regimes.json`과 `flow_signals.json`의 `hmmRegimeLabel` 필드에 저장되며, `REGIME_CONFIDENCE_MULT`(appState.js L394)를 통해 패턴 신뢰도에 승수로 적용된다. 강세(bull) 레짐에서 매수 패턴은 $\times 1.06$, 매도 패턴은 $\times 0.92$로 조정되고, 약세(bear) 레짐에서는 역방향($\times 0.90$ / $\times 1.06$)이다.

거시경제적 해석에서 HMM 레짐은 Doc 29 §6.1의 거시 레짐 분류($2 \times 2$: Expansion/Contraction × Low/High Volatility)와 연동된다. Goldilocks(확장+저변동)에서 추세추종 패턴이, Quiet Bear(수축+저변동)에서 평균회귀 패턴이, Crisis(수축+고변동)에서 전반적 신호 축소가 적절하다. 데이터 품질 가드(`flowDataCount > 0`)가 없으면 투자자 데이터가 비어있을 때 모든 종목에 "bear"가 일괄 적용되는 위험이 있어, 품질 게이트가 필수적이다.
$$P(R_t \mid S_t = s) = \mathcal{N}(\mu_s, \sigma_s^2), \quad S_t \in \{\text{bull, bear}\}$$

$$\text{전이행렬}: \; \mathbf{P} = \begin{pmatrix} p_{BB} & p_{BR} \\ p_{RB} & p_{RR} \end{pmatrix} \approx \begin{pmatrix} 0.98 & 0.02 \\ 0.05 & 0.95 \end{pmatrix}$$

여기서 $B$=Bull, $R$=Bear이며 각 행의 합은 1이다. 상기 초기값은 `compute_hmm_regimes.py:98`의 Baum-Welch EM 시작점이며, 실제 추정치는 KOSPI 데이터에 수렴한다. Bull의 기대 지속기간 $1/(1-p_{BB})=1/0.02=50$ 거래일, Bear는 $1/0.05=20$ 거래일로 Hamilton(1989)의 8--10개월 스케일과 정합한다. `REGIME_CONFIDENCE_MULT`(appState.js L394)는 역사적 이유로 `sideways` 키를 보존하지만 2-state HMM에서는 활성화되지 않는 항등 승수(identity)이다.

$$\text{Baum-Welch E-step}: \; \gamma_t(s) = P(S_t = s \mid R_{1:T}, \theta)$$

$$\text{Viterbi}: \; \delta_t(j) = \max_i [\delta_{t-1}(i) \cdot a_{ij}] \cdot b_j(o_t)$$

| 기호 | 의미  |
|------|------|
| St | 시점 t의 은닉 레짐  |
| μs, σs | 레짐 s의 평균/표준편차  |
| aij | 레짐 i → j 전이확률  |
| γt(s) | 사후 레짐 확률  |
| hmmRegimeLabel | HMM 레짐 라벨  |

> **이전 Stage 데이터:** Stage 1에서 `hmmRegimeLabel`은 종목별로 `flow_signals.json`에 저장된다. 시장 전체 레짐은 `_flowSignals.hmmRegimeLabel`로 접근한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 2-state 레짐 승수 | `REGIME_CONFIDENCE_MULT` (appState.js L394) | bull: buy×1.06/sell×0.92, bear: buy×0.90/sell×1.06 |
| 데이터 품질 가드 | `flowDataCount > 0` 체크 (appWorker.js L593) | 빈 데이터 시 레짐 승수 무력화 |
| 레짐-변동성 2 × 2 매트릭스 | Doc29 §6.1 + VKOSPI 20/25 임계 | Goldilocks/Hot/Quiet Bear/Crisis 분류 |

---


### 2.5.12 수요-공급-탄력성 (Demand-Supply-Elasticity)
Marshall (1890)의 부분균형 분석은 증권시장의 호가창(order book)에 직접 대응된다. 매수 호가 누적이 수요곡선 $D(p)$를, 매도 호가 누적이 공급곡선 $S(p)$를 형성하며, 시장 청산가격 $p^*$는 양자의 교차점에서 결정된다. KRX는 시가/종가 결정에 Walras (1874) 단일가 매매(call auction)를, 장중에는 Smith (1962) 연속 이중경매(continuous double auction)를 사용하는 이원 체제를 운영한다. 단일가 매매는 30분(시가) 또는 10분(종가)의 호가 축적을 통해 정보 집적 효율이 높고 종가 조작(window dressing) 내성이 강하다 (Madhavan 1992).

거래량-가격 탄력성(Volume-Price Elasticity, VPE)은 가격 1% 변동에 대한 거래량의 반응 민감도를 측정한다. KOSPI 대형주의 VPE는 2--5(중탄력, 기관 계획 매매), KOSDAQ 소형주는 8--20+(초고탄력, 개인 감정 반응)으로 시장 세그먼트 간 극단적 차이를 보인다. VPE와 Amihud (2002) ILLIQ는 수학적 역관계에 있으며, 이 연결은 수요-공급 탄력성이라는 미시경제학적 개념이 시장미시구조의 유동성 측정으로 변환되는 이론적 다리(theoretical bridge)를 구성한다.

스프레드(bid-ask spread)는 Stoll (1978)의 재고위험 보상($s_{\text{inventory}}$), Glosten-Milgrom (1985)의 역선택 비용($s_{\text{adverse}}$), Roll (1984)의 주문처리 비용($s_{\text{processing}}$)으로 3요소 분해된다. KRX에는 지정 시장조성자가 사실상 부재하여, KOSDAQ 소형주에서 $s_{\text{adverse}}$가 전체 스프레드의 60--80%를 차지한다. 이는 가격제한폭(±30%) 하에서 사중손실(deadweight loss)을 유발하며, Du, Liu & Rhee (2009)가 입증한 자석 효과(magnet effect)가 이를 악화시킨다.
$$p^* = \underset{p}{\arg\max}\;\min\bigl(D(p),\;S(p)\bigr)$$

$$\varepsilon_{VP} = \frac{\Delta V / V}{|\Delta p| / p}, \qquad \text{ILLIQ} \approx \frac{k}{P \cdot |\varepsilon_{VP}|}$$

$$s = s_{\text{inventory}} + s_{\text{adverse}} + s_{\text{order\_processing}}$$

| 기호 | 의미  |
|------|------|
| p* | 시장 청산가격 (Walrasian equilibrium price)  |
| D(p), S(p) | 누적 매수/매도 호가 곡선  |
| ε_(VP) | 거래량-가격 탄력성 (VPE)  |
| OHLCV | 일봉 시가-고가-저가-종가-거래량  |
| ADV | 평균 일간 거래대금 (Average Daily Value)  |
| s_(adverse) | 역선택 비용 (Glosten-Milgrom 1985)  |
| k | ILLIQ-VPE 연결 정규화 상수  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{OHLCV}}$로부터 일간 수익률 $|r_t|$와 거래대금 $\text{DVOL}_t$를 산출하여 ILLIQ을 계산한다. $\textcolor{stageOneMarker}{\text{ADV}}$는 60일 평균 거래대금으로, 유동성 세그먼트 분류의 기준이 된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Amihud ILLIQ = (1/T)Σ|rt|/DVOLt | `calcAmihudILLIQ()` indicators.js:1430 | ILLIQ dual-path: LOG\_LOW=-3, LOG\_HIGH=-1로 유동성 세그먼트 분류 후 `confDiscount` 산출 |
| VPE-ILLIQ 역관계 | `_getAdaptiveSlippage()` backtester.js:27 | 세그먼트별 슬리피지 차등: kospi\_large 0.04%, kosdaq\_small 0.35% |
| 스프레드 3요소 분해 | `KRX_SLIPPAGE=0.10%` backtester.js | KOSPI 중형 기준 고정값; WS 모드 확장 시 실시간 s_(adverse) 추정 가능 |
| 단일가 매매 (Walras) vs 접속매매 (Smith DA) | `generate_intraday.py` 09:00 시가 = 일봉 open | 시가/종가의 정보 집적 효율이 장중 가격보다 높음 |


### 2.5.13 HHI 산업 집중도와 시장구조 (HHI & Market Structure)
Herfindahl (1950)이 도입하고 Hirschman (1964)이 독립적으로 제안한 HHI(Herfindahl-Hirschman Index)는 산업 내 기업 시장점유율의 제곱합으로 정의되며, 산업 집중도의 표준 측정치이다. HHI는 등가기업수(Numbers Equivalent) $NE = 1/\text{HHI}$로 직관적 해석이 가능하다. 미국 DOJ 기준에서 HHI < 0.15는 비집중, 0.15--0.25는 중간 집중, ≥0.25는 고집중으로 분류한다. KRX 주요 산업의 HHI 추정치는 반도체(메모리) ≈0.45(삼성/하이닉스 복점), 이동통신 ≈0.33(3사 과점), 자동차 ≈0.40(현대차/기아 복점), 바이오/제약 ≈0.08(다수 경쟁)으로 산업별 편차가 크다.

Lerner (1934)의 독점력 지수 $L = (P-MC)/P$와 HHI의 연결은 Cowling-Waterson (1976)에 의해 $L = \text{HHI}/|\varepsilon_d|$로 정식화되었다. 이 관계가 "HHI $\to$ 이익안정성 $\to$ 패턴 신뢰도"의 이론적 기초를 구성한다. 가격 설정력이 강한 산업(높은 HHI)의 기업은 원가 변동을 가격에 전가할 수 있어 매출 변동성이 낮고, 기술적 패턴의 mean-reversion 신뢰도가 높다. 반대로 경쟁적 산업(낮은 HHI)에서는 추세추종(momentum) 패턴이 상대적으로 유효하다.

CheeseStock에서 HHI는 학술 표준인 매출액 기준이 아닌, 데이터 가용성과 실시간성을 위해 **시가총액 기준**으로 산출된다. 이는 바이오 산업에서 시가총액이 매출 대비 과대평가되어 HHI가 +0.05--0.10 과대추정되는 편향을 발생시킨다 (core\_data/33 참조). 또한 HHI 부스트에 이익변동성 감쇠를 적용하기 위한 `eps_stability` 매개변수가 설계되었으나, `ni_history`가 `_financialCache`에 적재되지 않아 항상 fallback 1.0으로 작동하는 사실상의 dead code이다 (P0-3, MIC-02).
$$\text{HHI} = \sum_{i=1}^{N} s_i^2, \qquad NE = \frac{1}{\text{HHI}}$$

$$L = \frac{\text{HHI}}{|\varepsilon_d|} \qquad \text{(Cowling-Waterson 1976)}$$

$$\text{conf\_adj} = \text{conf\_base} \times \bigl(1 + 0.10 \times \text{HHI} \times \text{eps\_stability}\bigr)$$

| 기호 | 의미  |
|------|------|
| si | 기업 i의 시장점유율  |
| NE | 등가기업수 (Numbers Equivalent)  |
| L | Lerner 독점력 지수  |
| ε_d | 시장 수요의 가격탄력성  |
| marketCap | 시가총액 (ALL\_STOCKS)  |
| eps_stability | 이익변동성 감쇠 계수 = 1/(1+σ_(NI\_growth)/100)  |
| 0.10 | HHI\_MEAN\_REV\_COEFF (\#119)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{marketCap}}$은 `ALL_STOCKS` 배열의 `marketCap` 필드에서 업종별로 추출되어 $s_i = \text{marketCap}_i / \sum \text{marketCap}$로 변환된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| HHI = Σ si² (시가총액 기준) | `_updateMicroContext()` appWorker.js:1544--1577 | 동일 `industry` 종목의 `marketCap` 제곱합으로 실시간 HHI 산출 |
| HHI Mean-Reversion Boost | `_applyMicroConfidenceToPatterns()` appWorker.js:1601 | `MEAN_REV_TYPES` 패턴(doubleBottom, headAndShoulders 등)에 1 + 0.10 × HHI × eps_stability 승수 적용 |
| eps_stability 감쇠 | appWorker.js:1553--1570 | 현재 `eps_stability`는 `ni_history` 미적재로 fallback 1.0 작동 중 (MIC-02). HHI boost가 이익변동성 감쇠 없이 적용됨 |
| Lerner-HHI 연결 | 설계 사양 (미구현) | 향후 섹터별 마크업 안정성 프록시로 활용 가능 |


### 2.5.14 정보비대칭과 탐색비용 (Information Asymmetry & Search Costs)
전통 미시경제학의 완전 정보(perfect information) 가정이 성립하면 가격은 즉시 내재가치를 반영하고 기술적 분석의 존재 이유가 사라진다. Grossman & Stiglitz (1980)는 이 역설을 정식화하였다: 가격이 모든 정보를 완벽히 반영한다면 정보 수집 비용을 지불할 유인이 없고, 아무도 정보를 수집하지 않으므로 가격은 정보를 반영할 수 없다. 균형에서 정보 투자자의 기대초과수익은 정보 수집 비용과 정확히 일치하며, 이 잔존 비효율이 기술적 패턴의 미시적 기초(microfoundation)를 구성한다.

Stigler (1961)는 경제학에서 최초로 정보를 경제재(economic good)로 정식화하고, 투자자의 종목 탐색 과정을 최적 탐색 문제로 모형화하였다. 탐색의 한계편익(더 나은 투자 기회 발견 확률)이 한계비용(시간, 인지적 노력)과 일치하는 점에서 탐색이 종료되므로, 투자자는 불완전한 정보 상태에서 의사결정한다. 한국 시장에서 HTS/MTS 보급으로 물리적 탐색 비용은 극소화되었으나, Peng & Xiong (2006)의 주의 예산 제약($\sum a_i \leq A_{\text{total}}$)이 새로운 바인딩 제약(binding constraint)으로 부상하였다. KOSPI 200 구성종목은 평균 7--12명 애널리스트 커버리지($a_i$ 높음)를 보이는 반면, KOSDAQ 소형주(시총 500억 미만)는 0--1명($a_i \approx 0$, corner solution)으로 정보 반영 지연이 3--5배 지속된다.

Easley, Kiefer & O'Hara (1996)의 PIN(Probability of Informed Trading)은 정보 비대칭의 직접 측정치이다. KRX에서 KOSPI 대형 PIN ≈ 0.10--0.15인 반면 KOSDAQ 소형 PIN ≈ 0.30--0.50으로, 잡음 거래자 비율이 높을수록 정보 거래자의 위장이 용이해져 PIN이 역설적으로 상승한다.
$$\text{PIN} = \frac{\alpha \mu}{\alpha \mu + \varepsilon_b + \varepsilon_s}$$

$$E[R_{\text{informed}}] - E[R_{\text{uninformed}}] = \frac{c_{\text{info}}}{\rho} \qquad \text{(Grossman-Stiglitz 균형)}$$

$$\sum_{i=1}^{N} a_i \leq A_{\text{total}} \qquad \text{(Peng-Xiong 주의 예산 제약)}$$

| 기호 | 의미  |
|------|------|
| α | 정보 이벤트 발생 확률  |
| μ | 정보 거래자 도착률  |
| ε_b, εs | 비정보 매수/매도 도착률  |
| c_(info) | 정보 수집 비용  |
| ρ | 위험회피 계수 (risk aversion)  |
| ai | 자산 i에 배분된 주의 용량  |
| ADV | 평균 일간 거래대금 (주의 프록시)  |
| 외국인 보유비중 | 글로벌 분석가 커버리지 프록시  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{ADV}}$는 탐색 비용의 역함수로 기능한다. 유동성이 높으면 정보 접근이 용이하여 탐색 비용이 낮다. $\textcolor{stageOneMarker}{\text{외국인 보유비중}}$은 글로벌 분석가 커버리지의 프록시로, 높을수록 주의 배분($a_i$)이 풍부함을 시사한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| ADV 수준별 유동성 등급 (Katz-Shapiro 1985 네트워크 외부성) | `calcADVLevel()` signalEngine.js:3014 | 4등급 분류: 0=<1억, 1=<10억, 2=<100억, 3=≥100억. 등급별 패턴 신뢰도 승수(`ADV_MULTIPLIERS`) 적용 |
| 밸류에이션 지지/저항 (Rothschild-Stiglitz 1976 스크리닝 균형) | `detectValuationSR()` patterns.js:3561 | BPS/EPS 배수 임계값이 투자자 스크리닝의 focal point로 기능하여 S/R 수준 형성 |
| Grossman-Stiglitz 잔존 비효율 | AMH 감쇠 메커니즘 (signalEngine.js) | 패턴 알파가 c_(info) 수준으로 수렴하는 과정을 모형화 |
| PIN 정보비대칭 보정 | δ_(info) = 0.15 (\#105, Doc 31 SS3.4) | 내부자 매매 방향과 패턴 방향 정렬 시 conf × 1.15, 역행 시 × 0.85 |


### 2.5.15 경제학 도출 요약 (Economics Derivation Summary)

본 절은 2.5.1–2.5.14의 14개 시트에서 도출된 경제학 분석 체계를 요약하고, 후속 장(제3장)에서의 신호 구현 경로를 명시한다. 거시경제학 시트(2.5.1–2.5.11)의 핵심 기여는 세 가지이다. 첫째, IS-LM/AD-AS/먼델-플레밍 프레임워크를 통해 정책 충격이 주식시장에 전달되는 이론적 경로를 정형화했다. 둘째, 테일러 준칙, 필립스 곡선, 재정승수 등의 정량적 도구를 한국 파라미터로 교정(calibrate)하여, BOK 이벤트와 추경 발표의 비대칭적 시장 영향을 설명했다. 셋째, Stovall 섹터 회전, MCS v2, HMM 레짐 분류를 결합하여 거시환경 → 섹터 → 패턴 신뢰도의 다층 전달 체계를 구축했다.

미시경제학 시트(2.5.12–2.5.14)는 이 체계에 산업 구조와 정보 마찰을 추가하여, 종목 수준의 유동성·집중도·정보비대칭이 패턴 신뢰도에 미치는 영향을 정량화한다. 수요-공급-탄력성(2.5.12)은 Amihud ILLIQ와 세그먼트별 슬리피지를 통해, HHI(2.5.13)는 산업 집중도 기반 mean-reversion 부스트를 통해, 정보비대칭(2.5.14)은 ADV 등급 승수와 밸류에이션 S/R을 통해 구현된다.

이 체계는 제3장에서 CONF-F1a(Stovall 섹터 회전), CONF-F7(Taylor Rule Gap), CONF-F9(한미 금리차)의 세 가지 거시 신뢰도 조정 인자와, `_applyMicroConfidenceToPatterns()`의 미시 인자로 구현된다. 각 인자는 `_applyMacroConfidenceToPatterns()` 및 `_applyMicroConfidenceToPatterns()` 함수 내에서 패턴별 방향(매수/매도)과 종목의 섹터 분류에 따라 차등 적용되며, 최종 신뢰도는 다층 승수의 곱으로 결정된다(compound floor = 25으로 하한 보장).

## §2.5 경제학 (거시·미시) — 5열 요약표

| 시트 | 핵심 모형 | 주요 학술 출처 | KRX 전달 경로 | 구현 상태 |
|---------------|--------------------|--------------------|------------------------------|---------------|
| 2.5.1 IS-LM | Hicks(1937) IS-LM 균형 | Hicks(1937), Hansen(1953) | 비교정학 → 이벤트별 conf 차등 | ✅ 구현 완료 (`_applyMacroConfidenceToPatterns`) |
| 2.5.2 Taylor Rule | Taylor(1993) 준칙 + gap | Taylor(1993), Rudebusch(2002) | Taylor gap → CONF-F7 (`taylorGap` appWorker.js:1122) | ✅ 구현 완료 |
| 2.5.3 Mundell-Fleming | IS-LM-BP 개방경제 | Mundell(1963), Fleming(1962) | 한미 금리차 → CONF-F9 (appWorker.js:1323) | ✅ 구현 완료 |
| 2.5.4 AD-AS | 총수요-총공급 4충격 | Blanchard(2017) | 레짐별 패턴 유형 차등 | 📐 설계 기반 (`conf_adj` 테이블) |
| 2.5.5 Stovall | 섹터 회전 4국면 | Stovall(1996) | 국면-섹터 승수 → CONF-F1a | ✅ 구현 완료 (`_STOVALL_CYCLE` appState.js:416) |
| 2.5.6 MCS v2 | 8요소 복합점수 | 설계값 + OECD/KOSIS | MCS → Phase 8 conf | ✅ 구현 완료 (`_applyPhase8ConfidenceToPatterns` appWorker.js:563) |
| 2.5.7 NKPC | Calvo 가격경직성 | Calvo(1983), Gali-Gertler(1999) | θ → 통화정책 전달 크기 | 📐 설계 기반 (이론적 기반; 직접 승수 없음) |
| 2.5.8 재정승수 | 케인즈 승수 + 구축효과 | Blanchard-Perotti(2002), Barro(1974) | k_G < 1 → 재정 conf 제한 | 🔧 부분 구현 (`×1.03` appWorker.js:619,621; `conf_fiscal` 상수 미선언) |
| 2.5.9 환율모형 | PPP/IRP/Dornbusch | Dornbusch(1976), Fama(1984) | USD/KRW 수출채널 간접 프록시 | 📐 설계 기반 (이론 전용; 직접 conf 경로 없음) |
| 2.5.10 수익률곡선 | NSS + 기대가설 | Nelson-Siegel(1987), Estrella-Mishkin(1998) | 4-체제 + 역전 경보 (`slope_10y3y` appWorker.js:1117, 1158–1190) | ✅ 구현 완료 |
| 2.5.11 HMM 레짐 | Hamilton 마르코프 전환 (2-state Bull/Bear) | Hamilton(1989), Kim-Nelson(1999) | `compute_hmm_regimes.py` `fit_hmm_2state()` → `hmm_regimes.json` → `flow_signals.json.hmmRegimeLabel` → `REGIME_CONFIDENCE_MULT` (appState.js:394) | ✅ 구현 완료 |
| 2.5.12 수요-공급-탄력성 | Marshall 부분균형 + Amihud ILLIQ | Marshall(1890), Amihud(2002), Glosten-Milgrom(1985) | ILLIQ → confDiscount; ADV → 슬리피지 차등 (`calcAmihudILLIQ` indicators.js:1430, `_getAdaptiveSlippage` backtester.js:27) | ✅ 구현 완료 |
| 2.5.13 HHI 산업 집중도 | Herfindahl-Hirschman + Lerner 독점력 | Herfindahl(1950), Cowling-Waterson(1976) | HHI → mean-reversion 부스트 (`_updateMicroContext` appWorker.js:1544, `_applyMicroConfidenceToPatterns` appWorker.js:1601) | 🔧 부분 구현 (HHI 계산·부스트 작동; `eps_stability` dead code — MIC-02) |
| 2.5.14 정보비대칭·탐색비용 | Grossman-Stiglitz + PIN + Peng-Xiong | Grossman-Stiglitz(1980), Easley et al.(1996), Peng-Xiong(2006) | ADV 등급 승수 (`calcADVLevel` signalEngine.js:3014); 밸류에이션 S/R (`detectValuationSR` patterns.js:3561) | 🔧 부분 구현 (ADV/valSR 구현; PIN δ=0.15 설계 완료, 직접 적용 미구현) |

**구현 상태 범례**

| 기호 | 의미 |
|------|------|
| ✅ 구현 완료 | JS 함수/상수 존재 + 파이프라인 호출 확인 |
| 🔧 부분 구현 | 핵심 로직 존재하나 일부 파라미터·경로 미완성 |
| 📐 설계 기반 | 이론적 프레임워크만 반영; 직접 conf 승수 없음 |
| ⏳ 향후 예정 | 설계 사양 작성됨; 코드 미구현 |

---

**Stage 1 데이터 활용 현황**

| Stage 1 변수 | 현재값 | 소비 시트 | 구현 함수 |
|-------------|--------|-----------|-----------|
| i_(BOK) (bok_rate) | 2.50% | 2.5.1, 2.5.2, 2.5.3 | `macro_latest.json` |
| CLI (korea_cli) | 101.65 | 2.5.1, 2.5.2, 2.5.5 | `cycle_phase`, `_STOVALL_CYCLE` |
| π_(CPI) (cpi_yoy) | 2.16% | 2.5.2, 2.5.7 | `taylorGap` (appWorker.js:1122) |
| Taylor_gap | -0.65%p | 2.5.2, 2.5.10 | CONF-F7 (appWorker.js:1167) |
| i_(Fed) (fed_rate) | 3.64% | 2.5.3 | CONF-F9 (appWorker.js:1323) |
| e_(USD/KRW) (usdkrw) | 1,514 | 2.5.3, 2.5.9 | 수출채널 프록시 |
| y_(10Y)-y_(3Y) (term_spread) | 0.35%p | 2.5.10 | 4-체제 분류 (`slope_10y3y` appWorker.js:1117) |
| YC_phase | flattening | 2.5.10 | `_macroComposite.yieldCurvePhase` (appState.js:262) |
| MCSv2 | 65.7 | 2.5.6 | Phase 8 conf (`_applyPhase8ConfidenceToPatterns`) |
| hmmRegimeLabel | (종목별) | 2.5.11 | `REGIME_CONFIDENCE_MULT` (appState.js:394) |
| PMI (bsi_mfg) | 71.0 | 2.5.5, 2.5.6 | MCS 구성요소 |
| OHLCV (일봉) | (종목별) | 2.5.12 | `calcAmihudILLIQ` → confDiscount |
| ADV (60일 평균 거래대금) | (종목별) | 2.5.12, 2.5.14 | `calcADVLevel` → `ADV_MULTIPLIERS` (signalEngine.js:3006) |
| marketCap (ALL_STOCKS) | (업종별) | 2.5.13 | `_updateMicroContext` → HHI 산출 (appWorker.js:1544) |

> **제3장 전방 참조:** 경제학 분석 체계는 제3장에서 CONF-F1a(Stovall 섹터 회전, 2.5.5), CONF-F7(Taylor Rule Gap, 2.5.2), CONF-F9(한미 금리차, 2.5.3)로 구현된다. 이 세 인자는 `_applyMacroConfidenceToPatterns()` 내에서 9개 매크로 신뢰도 조정 인자(Factor 1-9)의 일부로 작동하며, 패턴별 방향과 섹터에 따라 [0.70, 1.25] 범위의 승수를 생성한다. 미시 인자는 `_applyMicroConfidenceToPatterns()`에서 ILLIQ confDiscount, HHI mean-reversion 부스트, ADV 등급 승수로 추가 적용된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 거시 → 패턴 다층 전달 | `_applyMacroConfidenceToPatterns()` (9 factors) | Factor 1-9 순차 적용 |
| Phase 8 통합 조정 | `_applyPhase8ConfidenceToPatterns()` | MCS + HMM + 수급 + 옵션 |
| 미시 → 패턴 전달 | `_applyMicroConfidenceToPatterns()` (appWorker.js:1601) | ILLIQ + HHI + ADV 승수 |
| Compound floor = 25 | appWorker.js L125–126 | 다층 승수 곱의 과도한 감산 방지 |

---

\newpage

## 2.6 금융학적 기초: 자산가격결정에서 신용위험까지[^fin-1]

금융학은 자산의 공정가치를 결정하는 이론적 체계를 제공한다.
CAPM 계보(CAPM→Zero-Beta→ICAPM→CCAPM→APT)는 기대수익률과 위험 프리미엄을 정의하여
기술적 분석의 benchmark를 설정한다. 채권/옵션/신용위험 모형은 교차시장 신호를 생성하여
패턴 신뢰도를 다차원적으로 조정한다.

**이론적 흐름 (16시트):** EMH/AMH (2.6.1) → MPT (2.6.2) → CAPM (2.6.3) → Zero-Beta CAPM (2.6.4) → ICAPM (2.6.5) → CCAPM (2.6.6) → APT (2.6.7) → Fama-French 3/5 요인 (2.6.8) → 채권 가격결정과 듀레이션 (2.6.9) → BSM 옵션 가격결정 (2.6.10) → Greeks & IV 체계 (2.6.11) → 시장 미시구조 (2.6.12) → Merton DD 구조형 신용 (2.6.13) → 축약형 신용위험 & GZ 스프레드 (2.6.14) → SDF 통합 프레임워크 (2.6.15) → 금융학 요약 (2.6.16). 효율적 시장에서 다요인 가격결정, 교차시장 신호까지 자산가격결정의 전체 계보를 추적한다.


### 2.6.1 EMH & AMH (Efficient Market Hypothesis & Adaptive Markets Hypothesis)
효율적 시장 가설(EMH)은 Fama(1970)가 체계화한 자산가격결정의 출발점이다. 약형 효율(weak-form)은 과거 가격 정보가 이미 현재 가격에 반영되어 있으므로 기술적 분석이 초과수익을 창출할 수 없다고 주장한다. 준강형 효율(semi-strong form)은 모든 공개 정보를 포함하며, 강형 효율(strong form)은 내부 정보까지 반영된 가격을 상정한다. 수학적으로 EMH는 마르팅게일(martingale) 조건으로 표현된다: 가격의 기대 변화가 요구수익률을 초과하지 않으므로, 초과수익은 예측 불가능한 충격($\varepsilon_{t+1}$)에서만 발생한다.

Lo & MacKinlay(1988)는 주간 수익률의 양의 자기상관을 발견하여 약형 효율을 부정했고, Brock, Lakonishok & LeBaron(1992)은 이동평균·지지/저항 전략의 유의미한 수익을 보고했다. 이러한 반증에 대한 이론적 대안으로 Lo(2004)는 적응적 시장 가설(AMH)을 제안했다. AMH는 시장 효율성이 고정된 상태가 아닌 진화하는 생태계로, 시장 참여자의 경쟁·적응·자연선택 과정에 따라 효율성의 정도가 시변(time-varying)한다고 본다. 기술적 분석의 수익성은 특정 시장 레짐에서 존재하다가 참여자 적응에 의해 소멸하고, 새로운 비효율이 다시 발생하는 순환 구조를 따른다.

CheeseStock은 Hurst 지수($H$)를 통해 시장의 현재 효율성 수준을 정량적으로 진단한다. $H = 0.5$는 순수 랜덤워크(EMH 일치), $H > 0.5$는 추세 지속(모멘텀 전략 유효), $H < 0.5$는 평균 회귀(반전 전략 유효)를 시사한다. 이는 AMH의 레짐 전환을 실시간으로 포착하는 실증적 도구이며, 패턴 신뢰도 가중에 활용된다.

<!-- [V22-V25 SYNC] -->

**Jegadeesh (1990) 단기반전과 AMH의 crowding 포화 경로.** Jegadeesh (1990)는 1개월 개별주식 수익률에서 $-0.06 \sim -0.09$ 수준의 1차 자기상관을 미국 주식시장 1934--1987 데이터에서 체계적으로 입증하였고, 이는 Lo & MacKinlay (1988)가 보인 주간 **양의** 자기상관(momentum)과 시간축을 달리하는 상호 보완적 비효율이다. Lo (2004)의 AMH는 이러한 단기반전과 중기모멘텀의 시변적 공존을 생태적 경쟁 과정으로 해석한다. 특정 패턴이 일정 기간 유효한 초과수익을 생성하면 참여자들이 군집적으로 해당 패턴을 모방(crowding)하고, 포지션 혼잡이 임계점을 넘으면 반대방향 움직임이 체계화되어 원래의 신호가 **음의** 예측력으로 반전된다. 이는 단순한 잡음이 아니라 시장 미시구조의 피드백 루프로 설명 가능한 체계적 비효율이다.

CheeseStock은 이 이론적 주장을 실증적으로 검증하기 위해 V25 세션에서 8개 `ANTI_PREDICTOR` 패턴(`doubleBottom`, `inverseHeadAndShoulders`, `ascendingTriangle`, `cupAndHandle`, `morningStar`, `tweezerBottom`, `bullishMarubozu`, `bullishEngulfing`)의 반대방향 승률에 1-sided binomial 검정을 적용하고, Benjamini and Hochberg (1995)의 FDR 보정($q = 0.10$)으로 다중검정 편향을 제어하였다. 8개 패턴 전원이 통과하였고 (Bonferroni $\alpha = 0.05$에서도 통과), 각 패턴에 `contrarian: true` 플래그가 부여되어 런타임 신뢰도가 $\textit{confidencePred} = 100 - \textit{dirWr}$로 반전 산출된다. 이는 EMH의 약형 가설을 보존하되 AMH의 시변 비효율성을 계량적으로 흡수하는 방식이며, 본래 "bullish 패턴"의 과도한 매수 집중이 반대방향 움직임으로 직접 관측되는 crowding 포화의 실증 증거로 해석할 수 있다. 상세한 8-패턴 통계표와 구현은 §3.5.1, BLL (1992) 반예측기 게이트와의 연결은 §2.7.5를 참조한다.

$$P_t = \frac{E[P_{t+1} \mid \Phi_t]}{1+r}, \qquad P_{t+1} - E[P_{t+1} \mid \Phi_t] = \varepsilon_{t+1}$$

$$\text{ACF}(k) = \frac{\text{Cov}(r_t, r_{t+k})}{\text{Var}(r_t)}, \qquad \text{EMH} \Rightarrow \text{ACF}(k) = 0 \;\;\forall k \geq 1$$

$$H = \frac{\log(R/S)}{\log(n)}, \qquad R/S = \frac{\max_{1 \leq k \leq n} X_k - \min_{1 \leq k \leq n} X_k}{S_n}$$

| 기호 | 의미  |
|------|------|
| Φt | 시점 t까지의 정보 집합  |
| εt₊1 | 마르팅게일 차분 (예측불가 충격)  |
| ACF(k) | k-차 자기상관함수  |
| H | Hurst 지수  |
| R/S | 재조정 범위 통계량  |
| rt | 일별 로그수익률  |

> **이전 Stage 데이터:** Stage 1(OHLCV 일봉)에서 종가 시계열을 수신한다. `data/{market}/{code}.json`의 close 배열이 $r_t = \ln(P_t/P_{t-1})$ 계산의 입력이며, `calcHurst()`는 최소 120봉 이상의 데이터를 요구한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Hurst 지수 (H) 추정 | `calcHurst()` indicators.js:212 | 시장 레짐 진단: H>0.55 추세, H<0.45 회귀 |
| AMH 감쇠 계수 | `_AMH_DECAY` appState.js | 패턴 유효 기간의 레짐 적응 조정 |
| ACF 기반 시계열 검증 | `calcWLSRegression()` 잔차 진단 | 회귀 잔차의 자기상관 검정으로 모형 적합성 확인 |


### 2.6.2 MPT (Modern Portfolio Theory)
현대 포트폴리오 이론(MPT)은 Markowitz(1952)가 제안한 평균-분산 최적화(mean-variance optimization) 프레임워크이다. 개별 자산의 기대수익률과 위험(분산)뿐 아니라 자산 간 공분산 구조를 고려하여, 주어진 기대수익률 수준에서 포트폴리오 위험을 최소화하는 최적 가중치를 도출한다. 이 최적 포트폴리오들의 집합이 효율적 프론티어(efficient frontier)를 형성하며, 합리적 투자자는 효율적 프론티어 위의 포트폴리오만을 선택한다.

MPT의 핵심 통찰은 분산투자(diversification)가 체계적 위험(systematic risk)은 제거할 수 없지만 비체계적 위험(idiosyncratic risk)을 소멸시킨다는 것이다. KRX 전체 2,700여 종목의 포트폴리오 구성에서 완전 공분산 행렬 추정에 필요한 모수는 $N(N+3)/2 \approx 365$만 개에 달하므로, 실무에서는 Sharpe(1963) 단일지수 모형이나 팩터 모형으로 차원을 축소한다. Sharpe Ratio는 무위험 수익률 초과분 대비 위험을 측정하는 표준 성과 지표로, 효율적 프론티어 위에서 CML과의 접점(tangency portfolio)이 최대 Sharpe Ratio를 달성한다.

MPT는 "어떤 종목을 얼마나 보유할 것인가"를 결정하는 반면, 기술적 분석은 "언제 매수/매도할 것인가"를 결정한다. 양자는 상호 보완적이며, CheeseStock의 backtester는 패턴 기반 진입 시점의 위험-수익 프로파일을 MPT 프레임워크 내에서 평가한다.
$$E[R_p] = \sum_{i=1}^{N} w_i \, E[R_i], \qquad \sigma_p^2 = \sum_{i}\sum_{j} w_i w_j \sigma_{ij}$$

$$\min_{w} \; \sigma_p^2 \quad \text{s.t.} \quad E[R_p] = R^{*}, \;\; \sum w_i = 1$$

$$\text{Sharpe Ratio} = \frac{E[R_p] - R_f}{\sigma_p}$$

$$\text{Sortino Ratio} = \frac{E[R_p] - R_f}{\sigma_{\text{downside}}}$$

| 기호 | 의미  |
|------|------|
| wi | 종목 i의 포트폴리오 가중치  |
| σij | 종목 i,j 간 공분산  |
| R* | 목표 기대수익률  |
| σ_(downside) | 하방 편차 (MAR 기준)  |
| R_f | 무위험이자율 (KTB 3Y)  |

> **이전 Stage 데이터:** Stage 1에서 `data/macro/bonds_latest.json`의 KTB 3년 금리가 $R_f$ 추정에 사용된다. 개별 종목 수익률은 OHLCV 일봉에서 산출하며, 시장 지수 수익률은 `data/market/kospi_index.json`에서 제공된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Sharpe/Sortino Ratio | `backtester.js` 위험 통계량 | 패턴별 N-day 수익 분포의 위험 조정 성과 평가 |
| 포트폴리오 분산 분해 | `calcCAPMBeta()` R-squared | 체계적 vs 비체계적 위험 비율 산출 |
| Maximum Drawdown | `backtester.js` MDD 계산 | 패턴 진입 후 최대 손실 폭 측정 |


### 2.6.3 CAPM (Capital Asset Pricing Model)
자본자산 가격결정 모형(CAPM)은 Sharpe(1964), Lintner(1965), Mossin(1966)이 독립적으로 도출한 균형 자산가격결정 모형이다. Markowitz MPT의 균형 함의(equilibrium implication)로서, 모든 투자자가 동질적 기대를 갖고 무위험 이자율로 자유롭게 차입/대출할 수 있을 때, 시장 포트폴리오가 효율적 프론티어 위의 접선 포트폴리오임을 보인다. 증권시장선(SML)은 개별 자산의 기대수익률이 시장 베타($\beta_i$)에 선형적으로 비례함을 나타내며, 절편은 무위험이자율($R_f$), 기울기는 시장 위험 프리미엄($E[R_m] - R_f$)이다.

Jensen's Alpha($\alpha_i$)는 CAPM이 예측하는 기대수익률 대비 실현 초과수익으로, $\alpha_i > 0$이면 위험 조정 후에도 양의 초과수익이 존재함을 의미한다. 이는 기술적 분석 전략의 성과를 시장 위험 노출을 통제한 후 평가하는 표준 도구이다. 자본시장선(CML)은 효율적 포트폴리오 공간에서 무위험자산과 시장 포트폴리오를 잇는 직선으로, Sharpe Ratio의 상한을 정의한다.

Sharpe(1963) 단일지수 모형은 CAPM의 실증적 기반으로, $R_i = \alpha_i + \beta_i R_m + \varepsilon_i$의 시장 모형(market model)에서 베타를 추정한다. KRX 실증 결과 KOSPI 대형주의 $R^2 \approx 0.40\text{-}0.65$이나, KOSDAQ 소형주는 $R^2 \approx 0.05\text{-}0.25$로 단일 시장 팩터의 설명력이 제한적이어서, 다중 팩터 모형(APT/FF)으로의 확장이 필요하다. 이 $R^2$ 분포는 패턴 분석의 부가가치가 고유 요인 지배 영역(KOSDAQ)에서 가장 높을 가능성을 시사한다.
$$E[R_i] = R_f + \beta_i \bigl(E[R_m] - R_f\bigr) \qquad \text{(SML)}$$

$$\beta_i = \frac{\text{Cov}(R_i, R_m)}{\text{Var}(R_m)}$$

$$\alpha_i = R_i - \bigl[R_f + \beta_i(R_m - R_f)\bigr] \qquad \text{(Jensen's Alpha)}$$

$$\text{CML}: \; E[R_p] = R_f + \frac{E[R_m] - R_f}{\sigma_m} \cdot \sigma_p$$

$$R^2_i = \frac{\beta_i^2 \sigma_m^2}{\sigma_i^2} = \frac{\text{체계적 분산}}{\text{총 분산}}$$

| 기호 | 의미  |
|------|------|
| βi | 종목 i의 시장 베타  |
| αi | Jensen의 알파 (위험조정 초과수익)  |
| E[Rm] | 시장 포트폴리오 기대수익률  |
| σm | 시장 수익률 표준편차  |
| R²i | 결정계수 (체계적 위험 비율)  |
| R_f | 무위험이자율 (KTB 10Y)  |
| βi | CAPM 베타 (사전 계산)  |

> **이전 Stage 데이터:** Stage 1에서 `compute_capm_beta.py`가 산출한 $\beta_i$, $\alpha_i$, $R^2$이 `data/backtest/capm_beta.json`에 저장된다. `bonds_latest.json`의 KTB 10Y 금리가 $R_f$로 사용되며, Scholes-Williams(1977) 보정이 thin trading에 대해 적용된다. 실증 결과(2,628 종목): KOSPI $\bar{\beta}=0.75$, KOSDAQ $\bar{\beta}=0.83$.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| CAPM β 추정 (OLS/Scholes-Williams) | `calcCAPMBeta()` indicators.js:391 | 종목 위험 분류: 방어적(β<0.8) vs 공격적(β>1.2) |
| Jensen's Alpha | `compute_capm_beta.py` → `capm_beta.json` | 패턴-신호 alpha의 시장 위험 통제 후 평가 |
| R² 기반 패턴 부가가치 | `financials.js` 베타 표시 | 고유 요인 지배 종목에서 패턴 신뢰도 가중 |


### 2.6.4 Zero-Beta CAPM (Black 1972)
Zero-Beta CAPM은 Black(1972)이 무위험자산의 존재를 가정하지 않고 도출한 균형 모형이다. 표준 CAPM의 가장 비현실적 가정인 "모든 투자자가 동일한 무위험이자율로 무제한 차입/대출 가능"을 제거하고, 대신 시장 포트폴리오와 공분산이 0인 Zero-Beta 포트폴리오($R_z$)를 기준점으로 삼는다. SML의 절편이 $R_f$에서 $E[R_z]$로 상승하고 기울기가 완만해지므로, 고베타 종목의 기대수익률은 표준 CAPM 대비 하락하고 저베타 종목은 상승한다.

Fama & MacBeth(1973)의 횡단면 회귀 실증은 $\hat{\gamma}_0 > R_f$, $\hat{\gamma}_1 < E[R_m] - R_f$를 확인하여 Zero-Beta CAPM과 일치하는 결과를 보고했다. Frazzini & Pedersen(2014)의 BAB(Betting Against Beta) 전략은 이 이론의 현대적 확장으로, 차입 제약이 있는 투자자가 고베타 종목을 과도하게 선호하여 체계적으로 과대평가되는 현상을 이용한다.

한국 시장은 Zero-Beta CAPM의 교과서적 적용 사례이다. 2008년 이후 누적 약 5.5년(전체의 약 30%)에 걸친 공매도 전면 금지 기간이 존재하며, 가장 최근에는 2023.11~2025.03 기간의 전면 금지가 있었다. 공매도 금지는 비관적 정보의 가격 반영을 차단하고(Miller 1977), 표준 CAPM의 무위험 차입 가정을 위배하므로 Zero-Beta CAPM이 더 적절한 균형 모형이 된다.
$$E[R_i] = E[R_z] + \beta_i \bigl(E[R_m] - E[R_z]\bigr)$$

$$\beta_z = \frac{\text{Cov}(R_z, R_m)}{\text{Var}(R_m)} = 0 \qquad \text{(정의)}$$

$$E[R_z] > R_f \quad \Rightarrow \quad \text{SML 절편 상승, 기울기 감소}$$

$$\alpha_{i,\text{ZB}} = R_i - \bigl[E[R_z] + \beta_i(R_m - E[R_z])\bigr]$$

| 기호 | 의미  |
|------|------|
| E[R_z] | Zero-Beta 포트폴리오 기대수익률  |
| α_(i,ZB) | Zero-Beta 보정 알파  |
| βi | 시장 베타 (capm_beta.json)  |

> **이전 Stage 데이터:** Stage 1의 `capm_beta.json`에서 $\beta_i < 0.1$인 종목(약 50~80개)을 추출하여 $E[R_z]$의 경험적 대리변수로 사용한다. `_SHORT_BAN_PERIODS` 배열(appWorker.js:1589)이 공매도 금지 기간을 정의하며, 해당 기간에는 Zero-Beta CAPM 기반 조정이 활성화된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 공매도 금지 기간 감지 | `_SHORT_BAN_PERIODS` appWorker.js:1589 | 레짐별 벤치마크 모형 자동 전환 |
| BAB 이상 현상 반영 | `calcCAPMBeta()` + 베타 범주 분류 | 공매도 금지 시 저베타 종목 프리미엄 강화 |
| E[R_z] 경험적 추정 | `capm_beta.json` β<0.1 필터 | 횡단면 alpha 계산의 대안 벤치마크 |


### 2.6.5 ICAPM (Intertemporal Capital Asset Pricing Model)
기간간 자본자산 가격결정 모형(ICAPM)은 Merton(1973)이 연속시간 동적 최적화(continuous-time dynamic optimization)를 통해 도출한 다기간 균형 모형이다. 표준 CAPM이 단일 기간 의사결정을 가정하는 반면, ICAPM은 투자자가 현재의 부(wealth)뿐 아니라 미래의 투자 기회 집합(investment opportunity set) 변화에 대해서도 헤지(hedge)하고자 한다는 점을 포착한다. 이 "헤지 수요(hedging demand)"가 시장 베타 이외의 추가적 위험 프리미엄을 발생시킨다.

ICAPM의 가장 중요한 이론적 기여는 다중 팩터 모형에 경제적 정당성을 부여한 것이다. Fama-French의 SMB/HML이 단순한 경험적 발견에 그치지 않고, ICAPM 상태변수에 대한 경험적 대리변수(empirical proxies)로 해석될 수 있다. SMB는 경기 변동 상태변수를, HML은 이자율 상태변수를 반영하며, 이들이 가격결정 요인인 이유는 미래 투자 기회의 변화를 포착하기 때문이다. ICAPM이 동기부여(motivation)를 제공하고, APT가 형식(formalism)을 제공하고, FF가 경험적 내용(empirical content)을 채우는 구조이다.

CheeseStock의 MRA 17열 Ridge 회귀에 포함된 매크로 팩터(금리, 변동성, 환율)는 ICAPM 상태변수의 경험적 대리변수이다. momentum_60d, beta_60d, value_inv_pbr, log_size, liquidity_20d의 5개 APT 팩터가 모두 $p < 0.001$ 유의하며, 이들의 추가로 Walk-Forward IC가 0.0567에서 0.0998로 0.0430 증분을 달성했다.
$$E[R_i] - R_f = \beta_{i,M} \lambda_M + \sum_{k=1}^{K} \beta_{i,k} \lambda_k$$

$$\beta_{i,k} = \frac{\text{Cov}(R_i, \Delta s_k)}{\text{Var}(\Delta s_k)} \qquad \text{(헤지 베타)}$$

$$w_i^{*} = \underbrace{-\frac{J_W}{J_{WW}} \cdot \frac{\mu_i}{\sigma_i^2}}_{\text{mean-variance}} + \underbrace{\sum_k -\frac{J_{W s_k}}{J_{WW}} \cdot \frac{\sigma_{i,s_k}}{\sigma_i^2}}_{\text{hedging demand}}$$

| 기호 | 의미  |
|------|------|
| β_(i,M) | 시장 베타 (표준 CAPM과 동일)  |
| βi,k | 상태변수 k에 대한 헤지 베타  |
| λk | 상태변수 k의 위험 프리미엄  |
| Δ sk | 상태변수 k의 혁신(innovation)  |
| J(W,s,t) | Merton 간접 효용 함수  |
| BOK rate | 한국은행 기준금리 (상태변수 s1)  |
| VKOSPI | 변동성 지수 (상태변수 s2)  |
| USD/KRW | 원/달러 환율 (글로벌 위험선호)  |

> **이전 Stage 데이터:** Stage 1의 `data/macro/macro_latest.json`(BOK 기준금리, USD/KRW), `data/macro/bonds_latest.json`(국고채 3Y/10Y), `data/vkospi.json`(VKOSPI 시계열), `data/macro/ff3_factors.json`(MKT, SMB, HML)이 ICAPM 상태변수의 직접적 측정값으로 활용된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 상태변수 기반 패턴 신뢰도 | `_applyPhase8ConfidenceToPatterns()` appWorker.js | 매크로 상태 변화에 따른 패턴 confidence 조정 |
| 매크로 데이터 로드 | `data/macro/*.json` → `_macroLatest` | 금리·환율·변동성의 일별 상태변수 업데이트 |
| 헤지 베타 실증 (17열 Ridge) | `mra_apt_extended.py` IC=0.0998 | 5개 APT 팩터의 IC 증분 +0.0430 검증 |


### 2.6.6 CCAPM (Consumption-Based CAPM)
소비 기반 자본자산 가격결정 모형(CCAPM)은 Breeden(1979)과 Lucas(1978)가 도출한, 자산가격을 총소비 성장률(aggregate consumption growth)과의 공분산으로 결정하는 가장 "근본적인(fundamental)" 가격결정 모형이다. ICAPM에서 다중 상태변수에 대한 헤지 베타를 필요로 했던 것과 달리, CCAPM은 Breeden의 소비 베타 정리(Consumption Beta Theorem)에 의해 모든 상태변수를 단일 소비 베타($\beta_{c,i}$)로 축약한다. 이는 궁극적으로 투자자가 관심을 갖는 것이 부(wealth) 자체가 아니라 소비(consumption)라는 통찰에 기반한다.

CCAPM의 오일러 방정식 $1 = E[M_{t+1}(1+R_i)]$은 금융학에서 가장 기본적인 가격결정 방정식이다. 확률적 할인 인자(SDF) $M_{t+1} = \delta(C_{t+1}/C_t)^{-\gamma}$의 형태를 특정함으로써 모든 자산가격결정 모형이 이 방정식의 특수한 경우로 해석된다(Cochrane 2005). CAPM은 $M = a - bR_m$, APT는 $M = a - \sum b_k F_k$로 각각 SDF의 특수 형태이다.

그러나 CCAPM은 주식 프리미엄 퍼즐(Equity Premium Puzzle, Mehra & Prescott 1985)이라는 심각한 실증적 난제에 직면한다. 미국 역사적 주식 프리미엄 약 6.2%를 설명하려면 상대적 위험회피계수 $\gamma \approx 27$이 필요한데, 이는 합리적 범위(1~10)를 크게 초과한다. 이에 대한 해결 시도로 Campbell & Cochrane(1999)의 습관 형성(Habit Formation), Epstein & Zin(1989)의 재귀적 효용(Recursive Utility), Barro(2006)의 희귀 재난(Rare Disasters) 모형이 제안되었다.
$$1 = E\bigl[M_{t+1}(1 + R_{i,t+1})\bigr], \qquad M_{t+1} = \delta \left(\frac{C_{t+1}}{C_t}\right)^{-\gamma}$$

$$E[R_i] - R_f = \beta_{c,i} \cdot \lambda_c, \qquad \beta_{c,i} = \frac{\text{Cov}(R_i, \Delta c)}{\text{Var}(\Delta c)}$$

$$\gamma_{\text{EPP}} = \frac{E[R_m] - R_f}{\text{Cov}(r_m, \Delta c)} \approx 27 \qquad \text{(Mehra-Prescott)}$$

$$M_{t+1}^{\text{EZ}} = \delta^{\theta} \left(\frac{C_{t+1}}{C_t}\right)^{-\theta/\psi} R_{w,t+1}^{\theta-1}, \qquad \theta = \frac{1-\gamma}{1-1/\psi}$$

| 기호 | 의미  |
|------|------|
| Mt₊1 | 확률적 할인 인자 (SDF)  |
| δ | 시간 할인 인자 (0 < δ < 1)  |
| γ | 상대적 위험회피계수 (CRRA)  |
| Δ c | 로그 소비 성장률 ln(Ct₊1/Ct)  |
| ψ | 시점간 대체탄력성 (EIS)  |
| R_w | 부(wealth) 포트폴리오 수익률  |

> **이전 Stage 데이터:** 한국 가계 소비 데이터는 KOSIS API에서 분기별로 수신하며, `data/macro/kosis_latest.json`에 소비자심리지수(CCI)가 소비 성장의 간접적 프록시로 수록되어 있다. 다만 일별/주별 패턴 거래에 직접 적용하기에는 데이터 빈도 제약이 있다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 오일러 방정식 (SDF 통합) | 이론적 프레임워크 (직접 구현 없음) | 모든 자산가격결정 모형의 통합 해석 기반 |
| CCI 간접 프록시 | `kosis_latest.json` → `_kosisLatest` | 소비 심리 → 매크로 상태 간접 반영 |
| EPP 해석 | 이론적 배경지식 | KRX Sharpe Ratio(0.25~0.35)의 SDF 일관 해석 |


### 2.6.7 APT (Arbitrage Pricing Theory)
차익거래 가격결정 이론(APT)은 Ross(1976)가 CAPM과 근본적으로 다른 논리 구조에서 도출한 다중 팩터 가격결정 모형이다. CAPM이 투자자 효용 극대화와 동질적 기대라는 강한 가정에서 시장 균형(equilibrium)을 통해 도출되는 반면, APT는 수익률의 팩터 구조(factor structure)와 무차익 조건(no-arbitrage)이라는 약한 가정만으로 선형 가격결정에 도달한다. 이 "균형 대 무차익" 구분이 두 모형의 근본적 차이이다.

APT의 도출은 다음과 같다. $N$개 종목의 수익률이 $K$개 공통 팩터와 고유 충격으로 분해되고($R_i = E[R_i] + \sum b_{ik}F_k + \varepsilon_i$), 고유 충격이 종목 간 무상관($\text{Cov}(\varepsilon_i, \varepsilon_j) = 0$)이면, 잘 분산된 포트폴리오에서 고유 위험이 소멸한다. 이때 무비용·무팩터노출·양의기대수익인 차익거래 포트폴리오가 존재하지 않으려면, 기대수익률이 팩터 로딩의 선형 함수여야 한다: $E[R_i] = R_f + \sum b_{ik}\lambda_k$. APT의 강점이자 한계는 팩터의 수($K$)와 정체성을 사전에 특정하지 않는다는 점이다. ICAPM이 "왜" 다중 팩터가 필요한지를, FF가 "어떤" 팩터가 경험적으로 유효한지를 각각 보완한다.

CheeseStock의 MRA 파이프라인은 사실상 APT의 구현이다. 17열 Ridge 회귀의 설계행렬에서 열 1~12는 패턴 고유 특성(hw, vw, mw, confidence 등)이고, 열 13~17은 APT 팩터(momentum, beta, value, size, liquidity)이다. Walk-Forward IC = 0.0998(Phase 4-1, 297K samples)은 모든 5개 APT 팩터가 $p < 0.001$ 유의함을 확인했으며, 유동성($t=-27.6$)이 가장 강력한 가격결정 요인으로 Amihud(2002)의 KRX 적용을 실증한다.
$$R_i = E[R_i] + \sum_{k=1}^{K} b_{ik} F_k + \varepsilon_i, \qquad E[F_k]=0, \; \text{Cov}(\varepsilon_i, \varepsilon_j) = 0$$

$$E[R_i] = R_f + \sum_{k=1}^{K} b_{ik} \lambda_k \qquad \text{(무차익 조건)}$$

$$\text{차익거래 포트폴리오}: \quad \sum w_i = 0, \quad \sum w_i b_{ik} = 0 \;\forall k, \quad \sum w_i E[R_i] > 0 \Rightarrow \text{불가}$$

| 기호 | 의미  |
|------|------|
| bik | 종목 i의 팩터 k 로딩  |
| Fk | 팩터 k의 서프라이즈 (innovation)  |
| λk | 팩터 k의 위험 프리미엄  |
| εi | 고유 충격 (idiosyncratic shock)  |
| K | 공통 팩터 수 (K ≪ N)  |
| liquidity_(20d) | 20일 거래 회전율  |
| momentum_(60d) | 60일 수익률  |

> **이전 Stage 데이터:** Stage 1에서 `mra_apt_extended.py`가 17열 설계행렬을 구성하고 Ridge 회귀를 수행한다. 5개 APT 팩터(momentum, beta, value, size, liquidity)는 OHLCV, `index.json`(시총), `financials/*.json`(자본총계)에서 직접 계산된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| APT 17열 Ridge 회귀 | `mra_apt_extended.py` WF IC=0.0998 | 패턴 N-day 수익 예측의 핵심 모형 |
| 무차익 가격결정 | `calcWLSRegression()` indicators.js | JS-side 실시간 회귀 예측 |
| 팩터별 IC 기여 | `mra_apt_coefficients.json` | 유동성(t=-27.6) > 규모(+20.0) > 가치(-14.6) > 베타(+11.9) > 모멘텀(-6.0) |


### 2.6.8 Fama-French 3/5-Factor Model
Fama & French(1993)의 3-Factor 모형은 CAPM의 단일 시장 팩터에 SMB(Small Minus Big, 규모 효과)와 HML(High Minus Low, 가치 효과)을 추가하여 횡단면 수익률의 설명력을 대폭 향상시켰다. CAPM이 설명하지 못하는 소형주 프리미엄(Banz 1981)과 가치주 프리미엄(Basu 1977, Rosenberg et al. 1985)을 체계적 팩터로 포착한다. 2015년에는 RMW(수익성)와 CMA(투자)를 추가한 5-Factor 모형으로 확장되었다.

FF 팩터 구성은 2x3 정렬(double sort) 방법론을 따른다. 매년 6월 말 기준 시가총액 중위수로 Small/Big을 구분하고, B/M(장부가치 대 시가총액) 비율의 30/40/30 분위로 Value/Neutral/Growth를 분류한다. SMB = (SV + SN + SG)/3 - (BV + BN + BG)/3, HML = (SV + BV)/2 - (SG + BG)/2로 시가총액 가중 포트폴리오 수익률 차이를 계산한다.

CheeseStock의 한국 FF3 팩터는 `download_macro.py`의 `build_ff3_factors()` 함수에서 구성되며, 결과가 `data/macro/ff3_factors.json`에 일별 팩터 수익률로 저장된다. 초기 실증(2025.04~2026.04): MKT_RF Sharpe=+2.99, SMB Sharpe=-3.82, HML Sharpe=-2.80으로, 음의 SMB/HML은 해당 기간 한국 시장의 대형·성장주 프리미엄을 확인한다. **중요 사항:** FF3 팩터 구성은 Python 오프라인 스크립트(`compute_ff3.py`, `download_macro.py`)에서만 수행되며, JS-side에는 `calcFF3()` 함수가 존재하지 않는다. 브라우저에서는 사전 계산된 팩터 수익률을 로드하여 표시만 한다.
$$R_i - R_f = \alpha_i + \beta_{MKT} \cdot \text{MKT\_RF} + \beta_{SMB} \cdot \text{SMB} + \beta_{HML} \cdot \text{HML} + \varepsilon_i$$

$$\text{SMB} = \frac{1}{3}(S_V + S_N + S_G) - \frac{1}{3}(B_V + B_N + B_G)$$

$$\text{HML} = \frac{1}{2}(S_V + B_V) - \frac{1}{2}(S_G + B_G)$$

$$\text{FF5}: \;\; + \; \beta_{RMW} \cdot \text{RMW} + \beta_{CMA} \cdot \text{CMA}$$

| 기호 | 의미  |
|------|------|
| MKT\_RF | 시장 초과수익률 (Rm - R_f)  |
| SMB | 소형주 프리미엄 (Small Minus Big)  |
| HML | 가치주 프리미엄 (High Minus Low)  |
| RMW | 수익성 프리미엄 (Robust Minus Weak)  |
| CMA | 투자 프리미엄 (Conservative Minus Aggressive)  |
| B/M ratio | 자본총계 / 시가총액  |
| marketCap | 시가총액 (index.json)  |

> **이전 Stage 데이터:** Stage 1에서 `index.json`의 시가총액(marketCap)과 `data/financials/{code}.json`의 자본총계(total_equity)로 B/M ratio를 산출한다. 무위험이자율은 CD 91일물 금리를 252 거래일로 일할계산한다. 약 2,241 종목이 seed 데이터 제외 후 유니버스를 구성한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 한국 FF3 팩터 구성 | `build_ff3_factors()` download_macro.py | 일별 SMB/HML/MKT_RF 산출 (Python-only) |
| FF3 일별 수익률 표시 | `data/macro/ff3_factors.json` → JS 로드 | 팩터 노출 시각화 (계수 테이블) |
| 2x3 정렬 방법론 (상수 #168-171) | download_macro.py 모듈 상수 | 50/50 규모, 30/40/30 가치 분위 |


### 2.6.9 Bond Pricing & Duration (채권 가격결정)
채권 가격은 미래 현금흐름(쿠폰 + 원금)의 현재가치 합이다. 이 단순한 원리가 모든 채권 분석의 기반이며, 듀레이션(duration)은 "채권의 베타"로서 금리 민감도를 단일 숫자로 요약한다(Fabozzi 2007). Macaulay(1938) 듀레이션은 현금흐름의 현재가치 가중 평균 만기이고, 수정 듀레이션(modified duration)은 가격의 금리 탄력성, DV01은 1bp 변동의 절대 금액 변화를 측정한다.

볼록성(convexity)은 듀레이션의 선형 근사를 2차로 보정한다. 대규모 금리 변동에서 듀레이션만으로는 가격 변화를 과소추정(금리 하락 시)하거나 과대추정(금리 상승 시)하며, 볼록성 보정이 이 오차를 줄인다. 양의 볼록성은 금리 하락 시 가격 상승 폭이 금리 상승 시 가격 하락 폭보다 큼을 의미하므로, 동일 듀레이션에서 볼록성이 큰 채권이 유리하다.

한국 채권시장은 국고채(KTB) 중심으로 구조화되어 있으며, KTB 3년/10년/30년이 벤치마크이다. CheeseStock에서 채권 데이터는 `bonds_latest.json`을 통해 수신되고, `compute_bond_metrics.py`가 듀레이션·DV01·볼록성을 산출한다. 금리 기간구조(term structure)의 기울기 변화는 ICAPM 상태변수로서 주식 패턴 신뢰도 조정에 활용된다.
$$P = \sum_{t=1}^{n} \frac{C}{(1+y)^t} + \frac{F}{(1+y)^n}$$

$$D_{\text{Mac}} = \frac{1}{P} \sum_{t=1}^{n} t \cdot \frac{CF_t}{(1+y)^t}, \qquad D_{\text{mod}} = \frac{D_{\text{Mac}}}{1+y}$$

$$\text{DV01} = D_{\text{mod}} \cdot P \cdot 0.0001$$

$$\text{Convexity} = \frac{1}{P} \sum_{t=1}^{n} \frac{t(t+1) \cdot CF_t}{(1+y)^{t+2}}$$

$$\frac{\Delta P}{P} \approx -D_{\text{mod}} \cdot \Delta y + \frac{1}{2} \cdot \text{Convexity} \cdot (\Delta y)^2$$

| 기호 | 의미  |
|------|------|
| P | 채권 가격  |
| C | 기간별 쿠폰 이자  |
| F | 액면가(par value)  |
| y | 만기수익률 (YTM)  |
| D_(Mac) | Macaulay 듀레이션  |
| D_(mod) | 수정 듀레이션  |
| KTB 3Y/10Y | 국고채 3년/10년 금리  |

> **이전 Stage 데이터:** Stage 1의 `data/macro/bonds_latest.json`에서 KTB 3Y, 5Y, 10Y, 30Y 금리를 수신한다. 금리 기간구조의 기울기(10Y-3Y spread)는 경기 전망 상태변수이며, 역전(inversion) 시 경기 침체 신호로 해석된다. `compute_bond_metrics.py`가 듀레이션·DV01 산출을 수행한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 채권 DV01/듀레이션 산출 | `compute_bond_metrics.py` | 섹터별 금리 민감도 분석 |
| 금리 기간구조 기울기 | `bonds_latest.json` 10Y-3Y spread | ICAPM 상태변수 → 패턴 신뢰도 조정 |
| 금리 변화 시 주식 영향 | `_applyPhase8ConfidenceToPatterns()` | 금리 급변 시 패턴 confidence 감쇠 |


### 2.6.10 BSM (Black-Scholes-Merton Option Pricing)
Black-Scholes-Merton(BSM) 모형은 Black & Scholes(1973)와 Merton(1973)이 독립적으로 도출한 옵션 가격결정의 해석적 공식이다. 기초자산이 기하 브라운 운동(GBM)을 따르고, 무차익 조건 하에서 완전 헤지(delta hedging)가 가능할 때, 유럽형 콜/풋 옵션의 공정 가격을 폐쇄형(closed-form)으로 산출한다. BSM은 파생상품 가격결정의 출발점이자, 자산가격결정의 제1기본정리(FTAP)의 가장 직관적인 응용이다.

BSM의 핵심 가정은 상수 변동성($\sigma$)이지만, 현실에서 내재변동성(IV)은 행사가격에 따라 달라지는 변동성 미소(volatility smile)를 보인다. 이는 기초자산 수익률의 분포가 정규분포보다 두꺼운 꼬리를 가짐을 시사하며, Heston(1993) 확률변동성 모형, Dupire(1994) 로컬변동성 모형 등의 확장 모형이 이를 보정한다.

CheeseStock에서 BSM은 VKOSPI(KOSPI200 옵션 내재변동성 지수)의 이론적 기반을 제공한다. VKOSPI는 CBOE VIX와 동일한 방법론으로 산출되며, `data/vkospi.json`에 일별 시계열로 저장된다. `compute_options_analytics.py`가 스트래들 내재 변동(straddle implied move), 풋-콜 비율(PCR), 감마 익스포저(GEX) 등을 산출한다.
$$C = S \cdot N(d_1) - K e^{-rT} \cdot N(d_2)$$

$$P = K e^{-rT} \cdot N(-d_2) - S \cdot N(-d_1)$$

$$d_1 = \frac{\ln(S/K) + (r + \sigma^2/2)T}{\sigma\sqrt{T}}, \qquad d_2 = d_1 - \sigma\sqrt{T}$$

$$C + Ke^{-rT} = P + S \qquad \text{(Put-Call Parity)}$$

| 기호 | 의미  |
|------|------|
| S | 기초자산 현재가격  |
| K | 행사가격 (strike)  |
| T | 잔존만기  |
| r | 무위험이자율  |
| σ | 변동성 (연율화)  |
| N(·) | 표준정규분포 CDF  |
| σ_(IV) | 내재변동성 (VKOSPI)  |

> **이전 Stage 데이터:** Stage 1의 `data/vkospi.json`에서 VKOSPI 일별 시계열을 수신한다. VKOSPI는 KOSPI200 옵션의 30일 만기 ATM 내재변동성으로, BSM 역함수(Newton-Raphson)를 통해 관측된 옵션 시장가격에서 추출된다. `compute_options_analytics.py`가 straddle implied move를 산출한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| VKOSPI 레짐 분류 | `options_analytics.json` analytics | 변동성 레짐(안정/불안/공포)별 패턴 조정 |
| Straddle implied move | `compute_options_analytics.py` | 시장 기대 변동폭의 정량화 |
| BSM 이론 변동성 vs 실현 변동성 | `calcVRP()` indicators.js:536 | VRP 산출의 이론적 기반 (2.6.11절 연결) |


### 2.6.11 Greeks & IV (Greeks 체계 및 변동성 리스크 프리미엄)
Greeks는 BSM 모형에서 옵션 가격의 각 입력 변수에 대한 편미분으로 정의되는 민감도 체계이다. Delta($\Delta$)는 기초자산 가격 변화에 대한 민감도, Gamma($\Gamma$)는 Delta의 변화율(볼록성), Theta($\Theta$)는 시간 가치 감쇠, Vega($\nu$)는 변동성 민감도를 측정한다. 실무에서 시장 조성자의 감마 헤지(gamma hedging)는 기초자산의 단기 가격 변동을 증폭 또는 감쇠시키며, 이것이 감마 익스포저(GEX) 신호의 이론적 기반이다.

변동성 리스크 프리미엄(VRP)은 내재변동성($\sigma_{IV}$)과 실현변동성($\sigma_{RV}$)의 괴리로 정의된다: $\text{VRP} = \sigma_{IV}^2 - \sigma_{RV}^2$. 투자자가 변동성 위험에 대해 보험료를 지불하므로 내재변동성이 실현변동성을 체계적으로 상회하며, VRP가 양수인 것이 일반적이다. Bollerslev, Tauchen & Zhou(2009)는 VRP가 1~3개월 주식 수익률의 유의미한 예측자임을 보였다. VRP의 이론적 근거는 ICAPM의 변동성 상태변수에 대한 헤지 수요이다.

CheeseStock에서 `calcVRP()` 함수는 VKOSPI(내재변동성)와 `calcHV()` 함수가 산출한 역사적 변동성의 차이로 VRP를 계산한다. 양의 VRP가 급격히 확대되면 시장의 공포 수준이 높아진 것으로 해석되며, 패턴 신뢰도 조정의 추가 입력으로 활용된다.
$$\Delta = \frac{\partial C}{\partial S} = N(d_1), \qquad \Gamma = \frac{\partial^2 C}{\partial S^2} = \frac{N'(d_1)}{S\sigma\sqrt{T}}$$

$$\Theta = -\frac{S N'(d_1)\sigma}{2\sqrt{T}} - rKe^{-rT}N(d_2), \qquad \nu = S\sqrt{T}\,N'(d_1)$$

$$\text{VRP} = \sigma_{IV}^2 - \sigma_{RV}^2 \qquad \text{(Bollerslev-Tauchen-Zhou 2009)}$$

$$\text{GEX} = \sum_{\text{strikes}} \text{OI} \times \Gamma \times S^2 \times 0.01 \times 100 \qquad \text{(net gamma exposure)}$$

| 기호 | 의미  |
|------|------|
| Δ | 기초자산 가격 민감도  |
| Γ | Delta의 변화율 (볼록성)  |
| Θ | 시간가치 감쇠  |
| ν | 변동성 민감도 (Vega)  |
| N'(·) | 표준정규분포 PDF  |
| σ_(IV) | VKOSPI 내재변동성  |
| σ_(RV) | 역사적 실현변동성  |

> **이전 Stage 데이터:** Stage 1에서 `data/vkospi.json`의 VKOSPI가 $\sigma_{IV}$를, OHLCV에서 `calcHV()`가 산출한 20일 역사적 변동성이 $\sigma_{RV}$를 제공한다. VRP는 이 두 값의 차이로 계산되며, `signalEngine.js`에서 `calcVRP()` 호출을 통해 변동성 레짐 신호에 반영된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| VRP 산출 | `calcVRP()` indicators.js:536 | IV-RV 스프레드 기반 변동성 레짐 신호 |
| GEX 감마 익스포저 | `options_analytics.json` GEX | 감마 양/음 레짐에 따른 가격 변동 증폭/감쇠 판단 |
| HV 연율화 (252일 기준) | `calcHV()` indicators.js | σ_(RV) = σ_d × √{252} |


### 2.6.12 Market Microstructure (시장 미시구조)
시장 미시구조(market microstructure)는 자산의 거래 과정에서 가격이 어떻게 형성되고, 정보가 어떻게 가격에 반영되며, 유동성이 어떻게 제공되는지를 연구하는 분야이다. 세 가지 핵심 모형이 이론적 기반을 구성한다: Kyle(1985)의 정보 기반 가격 충격 모형, Glosten-Milgrom(1985)의 호가 스프레드 분해 모형, 그리고 Amihud(2002)의 비유동성 측도이다.

Kyle(1985) 모형에서 가격 충격 계수 $\lambda = \sigma_v / (2\sigma_u)$는 내부자의 정보 가치 변동성($\sigma_v$)과 잡음 거래량($\sigma_u$)의 비율로 결정된다. $\lambda$가 높을수록 주문이 가격에 미치는 영향이 크고, 이는 정보 비대칭의 정도를 반영한다. Glosten-Milgrom(1985) 모형은 호가 스프레드(bid-ask spread)를 정보 비용($\mu\delta$)과 재고 비용으로 분해하여, 스프레드가 정보 비대칭의 직접적 함수임을 보인다: $\text{Spread} = 2\mu\delta$, 여기서 $\mu$는 정보거래자 비율, $\delta$는 정보 가치이다.

Amihud(2002)의 비유동성 측도(ILLIQ)는 $\text{ILLIQ}_t = |r_t| / \text{DVOL}_t$로 정의되며, 단위 거래금액당 가격 충격을 측정한다. 이는 Kyle $\lambda$의 실증적 대리변수로 해석되며, MRA 17열 Ridge 회귀에서 유동성 팩터($t = -27.6$)가 가장 강력한 가격결정 요인임이 확인되었다. Kyle 모형과 GM 스프레드 분해는 이론적 프레임워크로만 참조하며, 직접적 구현은 Amihud ILLIQ에 한정된다.
$$\Delta P = \lambda \cdot \text{OrderFlow}, \qquad \lambda = \frac{\sigma_v}{2\sigma_u} \qquad \text{(Kyle 1985)}$$

$$\text{ILLIQ}_t = \frac{|r_t|}{\text{DVOL}_t}, \qquad \overline{\text{ILLIQ}} = \frac{1}{T}\sum_{t=1}^{T} \text{ILLIQ}_t \qquad \text{(Amihud 2002)}$$

$$\text{Spread}_{\text{GM}} = 2\mu\delta \qquad \text{(Glosten-Milgrom 1985)}$$

| 기호 | 의미  |
|------|------|
| λ | Kyle 가격 충격 계수  |
| σv | 정보 가치 변동성  |
| σu | 잡음 거래량 표준편차  |
| ILLIQt | Amihud 비유동성 측도  |
| DVOLt | 거래대금 (가격 × 거래량)  |
| μ | 정보거래자 비율  |
| rt, volumet | 일별 수익률, 거래량  |

> **이전 Stage 데이터:** Stage 1의 OHLCV 데이터에서 `|r_t|`(일별 절대수익률)과 `DVOL_t`(거래대금 = close × volume)를 계산한다. `calcAmihudILLIQ()` 함수가 20일 이동평균 ILLIQ를 산출하며, 이는 APT 유동성 팩터의 직접적 입력이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Amihud ILLIQ | `calcAmihudILLIQ()` indicators.js:1430 | 비유동성 측도 → APT 유동성 팩터 (t=-27.6) |
| Kyle λ 근사 | `KRX_SLIPPAGE` backtester.js | 슬리피지 추정의 이론적 기반 |
| GM 스프레드 해석 | 이론 참조만 (직접 구현 없음) | 호가 스프레드의 정보 비대칭 분해 해석 |


### 2.6.13 Merton DD (Distance-to-Default)
Merton(1974) 구조적 신용위험 모형은 "기업의 자기자본은 자산가치에 대한 콜옵션"이라는 통찰에 기반한다. 자산가치($V$)가 부채 만기($T$) 시점에 부채 수준($D$) 이하로 하락하면 부도(default)가 발생하고, 주주는 잔여 가치 $\max(V_T - D, 0)$을 수령한다. 이 구조는 BSM 콜옵션과 동형(isomorphic)이므로, 옵션 가격결정 이론이 신용위험 분석에 직접 적용된다.

부도거리(Distance-to-Default, DD)는 자산가치가 부도점(default point)에 도달하기까지의 표준편차 수를 측정한다. $\text{DD} = [\ln(V/D) + (r - 0.5\sigma_V^2)T] / (\sigma_V\sqrt{T})$. DD가 클수록 부도 확률이 낮고, 이론적 부도 확률(PD)은 $N(-\text{DD})$로 산출된다. KMV(Moody's)는 이론적 PD 대신 경험적 부도빈도(EDF)를 매핑하여 실무적 정확도를 향상시켰다.

CheeseStock에서는 Bharath & Shumway(2008)의 간편 추정법("naive DD")을 구현한다. 비상장 자산가치($V$)를 직접 관측할 수 없으므로, 시가총액을 자기자본 가치로, 부채 장부가를 부채 수준으로 대체한다. `_calcNaiveDD()` 함수(appWorker.js:884)가 이를 수행하며, $\text{DD} < 1.5$ 시 패턴 신뢰도에 감쇠(decay)를 적용하여 재무 건전성이 약한 종목의 기술적 신호를 보수적으로 조정한다.
$$\text{DD} = \frac{\ln(V/D) + (r - 0.5\sigma_V^2)T}{\sigma_V \sqrt{T}}$$

$$\text{PD} = N(-\text{DD}) \qquad \text{(이론적 부도확률)}$$

$$E = V \cdot N(d_1) - D \cdot e^{-rT} \cdot N(d_2) \qquad \text{(주식 = 콜옵션)}$$

$$\sigma_E = \frac{V}{E} \cdot N(d_1) \cdot \sigma_V \qquad \text{(레버리지-변동성 관계)}$$

| 기호 | 의미  |
|------|------|
| V | 기업 자산가치 (비관측)  |
| D | 부채 수준 (default point)  |
| σ_V | 자산가치 변동성  |
| E | 자기자본 시장가치 (시가총액)  |
| DD | 부도거리 (표준편차 수)  |
| PD | 부도확률  |
| 시가총액 | index.json marketCap  |
| 부채총계 | financials/{code}.json  |

> **이전 Stage 데이터:** Stage 1에서 `index.json`의 시가총액(marketCap)이 자기자본 시장가치($E$)로, `data/financials/{code}.json`의 부채총계(total_liabilities)가 부채 수준($D$)으로 사용된다. 주가 변동성($\sigma_E$)은 OHLCV에서 산출하며, Bharath-Shumway 간편법에 의해 $\sigma_V \approx \sigma_E \cdot E/(E+D)$로 근사한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Naive DD 계산 (Bharath-Shumway) | `_calcNaiveDD()` appWorker.js:884 | 종목별 부도거리 산출 |
| DD 기반 패턴 감쇠 | DD < 1.5 → 패턴 confidence 감쇠 | 재무 건전성 약한 종목의 보수적 신호 조정 |
| Merton 콜옵션 해석 | `compute_capm_beta.py` DD 산출 | 레버리지-변동성 관계를 통한 자산변동성 역산 |


### 2.6.14 Reduced-Form Credit Models (축약형 신용위험 모형)
축약형(reduced-form) 신용위험 모형은 구조적 모형(Merton)과 근본적으로 다른 접근 방식을 취한다. 구조적 모형이 자산가치의 진화를 추적하여 부도를 내생적(endogenous)으로 결정하는 반면, 축약형 모형은 부도를 외생적(exogenous) 확률 과정으로 모형화한다. 부도는 위험 강도(hazard rate) $\lambda(t)$를 가진 포아송 과정으로 발생하며, $\lambda(t)$가 높을수록 단위 시간당 부도 확률이 높다.

Jarrow & Turnbull(1995)과 Duffie & Singleton(1999)이 체계화한 축약형 모형에서, 위험 채권의 가격은 부도 확률과 회수율(recovery rate)을 반영한 할인된 기대 현금흐름으로 결정된다. 생존 확률은 $Q(T) = \exp(-\int_0^T \lambda(s)\,ds)$이며, 위험 채권 가격은 $P_{\text{risky}} = P_{\text{riskfree}} \times [Q(T) + (1-Q(T)) \times R]$으로 근사된다. 여기서 $R$은 회수율이다.

축약형 모형의 실무적 장점은 CDS(Credit Default Swap) 가격에서 $\lambda(t)$를 역산(bootstrapping)할 수 있다는 점이다. 그러나 한국 시장에서는 CDS 유동성이 부족하여 구조적 모형(Merton DD)이 더 실용적이다. CheeseStock에서 축약형 모형은 이론적 참조로만 활용되며, 직접적 구현은 없다. 크레딧 스프레드 레짐 분류(Doc 35 §5)가 축약형 모형의 간접적 응용이다.
$$\lambda(t) = \lim_{\Delta t \to 0} \frac{P(\text{default in } [t, t+\Delta t] \mid \text{survival to } t)}{\Delta t}$$

$$Q(T) = \exp\!\left(-\int_0^T \lambda(s)\,ds\right) \qquad \text{(생존확률)}$$

$$P_{\text{risky}} = \sum_{t=1}^{n} \frac{C \cdot Q(t)}{(1+r)^t} + \frac{F \cdot Q(n)}{(1+r)^n} + \sum_{t=1}^{n} \frac{R \cdot F \cdot [\lambda(t)\Delta t \cdot Q(t-1)]}{(1+r)^t}$$

$$\text{CDS Spread} \approx (1-R) \cdot \bar{\lambda} \qquad \text{(간편 근사)}$$

| 기호 | 의미  |
|------|------|
| λ(t) | 위험 강도 (hazard rate)  |
| Q(T) | 만기 T까지 생존 확률  |
| R | 부도 시 회수율 (recovery rate)  |
| P_(risky) | 위험 채권 가격  |
| CDS Spread | 신용부도스왑 프리미엄  |

> **이전 Stage 데이터:** 한국 시장에서 CDS 유동성이 제한적이므로, Stage 1 데이터로부터 직접적인 $\lambda(t)$ 추정은 수행하지 않는다. 대신 `bonds_latest.json`의 회사채 스프레드(AA- 기준)가 축약형 모형의 간접적 프록시로 활용된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 축약형 모형 | 구현 없음 (이론 참조만) | Merton DD의 이론적 보완 프레임워크 |
| 크레딧 스프레드 레짐 | `bonds_latest.json` AA- 스프레드 | 4단계 신용 레짐 분류 (Doc 35 §5 연결) |
| CDS-채권 기저 해석 | 이론 참조만 | 크레딧 시장 이상 징후 해석의 이론적 기반 |


### 2.6.15 SDF (Stochastic Discount Factor) 통합 프레임워크
확률적 할인 인자(SDF, Stochastic Discount Factor)는 모든 자산가격결정 모형을 통합하는 메타 프레임워크이다. 기본 가격결정 방정식 $1 = E[M_{t+1}(1+R_i)]$에서 $M$의 형태를 특정함에 따라 CAPM, CCAPM, APT 등이 각각 도출된다. SDF는 pricing kernel, state-price density와 동의어이며, Harrison & Kreps(1979)의 자산가격결정 제1기본정리(First Fundamental Theorem of Asset Pricing)는 무차익 조건과 양의 SDF 존재의 등가성을 증명하여 파생상품 가격결정과 자산가격결정을 수학적으로 통합하였다.

SDF 존재의 삼단 논증은 다음과 같다. (1) 일물일가의 법칙(LOOP)은 가격결정 함수의 선형성을 보장하여 $p(x) = E[M \cdot x]$인 $M$이 존재함을 보인다. (2) 무차익 조건은 $M > 0$ (양수성)을 요구하며, 이는 위험중립 측도 $Q$의 존재와 동치이다. (3) 완전시장은 $M$의 유일성을 보장하지만, 불완전 시장에서는 무한히 많은 SDF가 존재한다.

Hansen & Jagannathan(1991)의 HJ Bound는 SDF의 최소 변동성 조건을 설정한다: $\sigma(M)/E[M] \geq |E[R_i]-R_f|/\sigma(R_i)$. 우변은 자산 $i$의 Sharpe Ratio이므로, SDF의 변동계수는 시장에서 관찰되는 최대 Sharpe Ratio 이상이어야 한다. Equity Premium Puzzle은 소비 기반 SDF가 이 경계를 충족하려면 비현실적으로 높은 $\gamma$가 필요하다는 문제이며, Epstein-Zin 재귀적 효용이 이를 완화한다. CheeseStock의 MRA 17열 Ridge 계수벡터는 암묵적 선형 SDF $M_{CS} = a - \sum b_k X_k$를 정의하며, HJ Bound 충족 여부로 모형의 적절성을 진단할 수 있다.
$$1 = E\bigl[M_{t+1}(1 + R_{i,t+1})\bigr] \qquad \text{(기본 가격결정 방정식)}$$

$$\frac{\sigma(M)}{E[M]} \geq \frac{|E[R_i] - R_f|}{\sigma(R_i)} \qquad \text{(Hansen-Jagannathan Bound)}$$

$$M > 0 \;\Longleftrightarrow\; \text{No-Arbitrage} \;\Longleftrightarrow\; \exists\, Q \text{ (위험중립 측도)}$$

**SDF 특수 형태별 모형 도출:**

| 모형 | SDF 형태 M | 비고 |
|------|-------------|------|
| CAPM | a - b · Rm | Sharpe(1964) |
| FF3 | a - b · MKT - s · SMB - h · HML | Fama-French(1993) |
| CCAPM | δ(Ct₊1/Ct)^(-γ) | Breeden(1979) |
| Epstein-Zin | δ^θ(Ct₊1/Ct)^(-θ/ψ) R_w^(θ-1) | Epstein-Zin(1989) |
| APT | a - Σ bk Fk | Ross(1976) |
| 기호 | 의미  |
|------|------|
| M | SDF (pricing kernel)  |
| σ(M)/E[M] | SDF 변동계수  |
| Q | 위험중립 측도  |
| LOOP | 일물일가의 법칙  |
| FTAP | 자산가격결정 제1기본정리  |

> **이전 Stage 데이터:** SDF 프레임워크는 순수 이론적 통합 틀이므로 Stage 1 데이터에 직접 의존하지 않는다. 다만 MRA Ridge 계수벡터가 암묵적 SDF를 정의하므로, `mra_apt_coefficients.json`의 17개 계수가 SDF 가격 벡터에 대응한다. HJ Bound 검증 시 KOSPI 연환산 Sharpe Ratio(0.25~0.35)가 기준이 된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 암묵적 SDF (M_(CS)) | MRA 17열 Ridge 계수 | M_(CS) = a - Σ bk Xk로 모형 일관성 진단 |
| HJ Bound 검증 | 이론적 프레임워크 (구현 예정) | SDF 변동계수 vs KOSPI Sharpe Ratio 비교 |
| FTAP (무차익 ↔ SDF > 0) | BSM/VRP/APT의 이론적 통합 | 옵션 가격결정과 자산가격결정의 일관성 보장 |


### 2.6.16 Summary: 금융학 시트 통합 요약
본 절의 15개 시트는 자산가격결정의 이론적 계보를 완전하게 구성한다. EMH/AMH(2.6.1)로 시장 효율성의 전제를 설정하고, MPT(2.6.2)→CAPM(2.6.3)→Zero-Beta(2.6.4)→ICAPM(2.6.5)→CCAPM(2.6.6)으로 이어지는 균형 자산가격결정의 진화를 추적한다. APT(2.6.7)와 FF3/5(2.6.8)는 무차익 논증과 경험적 팩터의 축을 제공하며, 채권(2.6.9), 옵션(2.6.10~11), 미시구조(2.6.12), 신용위험(2.6.13~14)은 교차시장 신호의 이론적 기반을 구성한다. SDF(2.6.15)가 이 모든 것을 $1 = E[M(1+R)]$이라는 단일 방정식으로 통합한다.

## §2.6 금융학 5-열 요약표

| 시트 | 핵심 모형 | 주요 학술 출처 | KRX 전달 경로 | 구현 상태 |
|---------------|--------------------|--------------------|------------------------------|---------------|
| 2.6.1 EMH & AMH | Hurst 지수 (R/S 분석), AMH 시변 효율성 | Fama(1970), Lo(2004), Lo & MacKinlay(1988) | 종가 시계열 → `calcHurst()` → H>0.55 추세 / H<0.45 평균회귀 레짐 → `_AMH_DECAY` 패턴 감쇠 | ✅ 구현 완료 |
| 2.6.2 MPT | 평균-분산 최적화, Sharpe/Sortino Ratio, 효율적 프론티어 | Markowitz(1952), Sharpe(1963) | OHLCV 수익률 분포 → `backtester.js` 위험 통계 (Sharpe·Sortino·MDD) → 패턴별 위험-수익 프로파일 평가 | ✅ 구현 완료 |
| 2.6.3 CAPM | SML(β), Jensen's Alpha, R² 체계적/비체계적 위험 분해 | Sharpe(1964), Lintner(1965), Scholes-Williams(1977) | `compute_capm_beta.py` → `capm_beta.json` → `calcCAPMBeta()` indicators.js:391 + `_calcJensensAlpha()` backtester.js:499 → D열 베타 표시 & 패턴 alpha 평가 | ✅ 구현 완료 |
| 2.6.4 Zero-Beta CAPM | Zero-Beta 포트폴리오 E[Rz], BAB 이상 현상, 공매도 금지 레짐 | Black(1972), Fama-MacBeth(1973), Frazzini-Pedersen(2014) | `_SHORT_BAN_PERIODS` appWorker.js:1589 → 공매도 금지 기간 감지 → 저베타 종목 프리미엄 강화 → `capm_beta.json` β<0.1 필터로 E[Rz] 근사 | 🔧 부분 구현 |
| 2.6.5 ICAPM | 다중 상태변수 헤지 베타 (금리·변동성·환율), 헤지 수요 프리미엄 | Merton(1973), Baele-Bekaert-Inghelbrecht(2010) | `macro_latest.json`+`bonds_latest.json`+`vkospi.json` → `_applyPhase8ConfidenceToPatterns()` appWorker.js → 10-Factor 매크로 조정 → 패턴 confidence 가중 | ✅ 구현 완료 |
| 2.6.6 CCAPM | 소비 베타 정리, SDF 오일러 방정식, Equity Premium Puzzle | Breeden(1979), Lucas(1978), Mehra-Prescott(1985), Epstein-Zin(1989) | `kosis_latest.json` CCI → `_kosisLatest` 소비 심리 간접 프록시 → 이론적 SDF 통합 해석 기반 (직접 구현 없음) | 📐 설계 기반 |
| 2.6.7 APT | 17열 Ridge 회귀 (무차익 가격결정), 5개 KRX 팩터 (IC=0.0998) | Ross(1976), Amihud(2002), Jegadeesh-Titman(1993) | OHLCV + `index.json`(시총) + `financials/*.json` → `mra_apt_extended.py` → `mra_apt_coefficients.json` → `calcWLSRegression()` 실시간 예측 | ✅ 구현 완료 |
| 2.6.8 Fama-French 3/5-Factor | SMB(규모), HML(가치), RMW(수익성), CMA(투자) 2×3 정렬 | Fama-French(1993, 2015) | `index.json` 시총 + `financials/{code}.json` B/M → `build_ff3_factors()` Python → `ff3_factors.json` → `_renderFF3Factors()` financials.js:295 → D열 팩터 노출 표시 | ✅ 구현 완료 |
| 2.6.9 Bond Pricing & Duration | Macaulay/수정 듀레이션, DV01, 볼록성(Convexity), 금리 기간구조 | Fabozzi(2007), Macaulay(1938) | `bonds_latest.json` KTB 3Y/5Y/10Y/30Y → `compute_bond_metrics.py` Duration·DV01 산출 → `_renderBondMetrics()` financials.js:487 + 10Y-3Y slope → `_applyPhase8ConfidenceToPatterns()` 금리 민감도 조정 | ✅ 구현 완료 |
| 2.6.10 BSM Option Pricing | BSM 콜/풋 공식, Put-Call Parity, 내재변동성(VKOSPI) | Black-Scholes(1973), Merton(1973) | 옵션 IV → `compute_options_analytics.py` → `options_analytics.json` → `_applyPhase8ConfidenceToPatterns()` 변동성 레짐 조정 | ✅ 구현 완료 |
| 2.6.11 Greeks & IV | Delta·Gamma·Theta·Vega, VRP = σ²_IV - σ²_RV, GEX 감마 익스포저 | Bollerslev-Tauchen-Zhou(2009), Carr-Wu(2009) | `vkospi.json` σ_IV + OHLCV → `calcHV()` σ_RV → `calcVRP()` indicators.js:536 → `signalEngine.js` 변동성 레짐 신호 + `options_analytics.json` GEX → 패턴 confidence 조정 | ✅ 구현 완료 |
| 2.6.12 Market Microstructure | Amihud ILLIQ = \|r\|/DVOL, Kyle λ 가격 충격, Glosten-Milgrom 스프레드 분해 | Kyle(1985), Glosten-Milgrom(1985), Amihud(2002) | OHLCV |r_t|·DVOL → `calcAmihudILLIQ()` indicators.js:1430 → APT 유동성 팩터(t=-27.6) + `KRX_SLIPPAGE` backtester.js Kyle λ 근사 → 슬리피지 보정 | 🔧 부분 구현 |
| 2.6.13 Merton DD | Distance-to-Default (Naive DD), 주식=콜옵션, PD=N(-DD) | Merton(1974), Bharath-Shumway(2008) | `index.json` 시총(E) + `financials/{code}.json` 부채총계(D) + OHLCV σ_E → `_calcNaiveDD()` appWorker.js:884 → `_applyMertonDDToPatterns()` DD<1.5 confidence 감쇠 | ✅ 구현 완료 |
| 2.6.14 Reduced-Form Credit | 위험 강도(hazard rate λ), 생존확률 Q(T)=exp(-∫λ), CDS 스프레드 근사 | Jarrow-Turnbull(1995), Duffie-Singleton(1999) | `bonds_latest.json` AA- 크레딧 스프레드 → `_applyPhase8ConfidenceToPatterns()` aa_spread 4단계 신용 레짐 분류 (직접 hazard rate 추정 없음) | 📐 설계 기반 |
| 2.6.15 SDF 통합 | 기본 가격결정 방정식 1=E[M(1+R)], Hansen-Jagannathan Bound, FTAP | Cochrane(2005), Harrison-Kreps(1979), Hansen-Jagannathan(1991) | MRA Ridge 17열 계수벡터 (`mra_apt_coefficients.json`) → 암묵적 선형 SDF M_CS=a-Σb_kX_k → HJ Bound 검증 (예정) → 모든 하위 모형(CAPM/APT/CCAPM)의 수학적 통합 해석 | ⏳ 향후 예정 |

**SDF 통합 계보도**

| 통합 관계 | 수학적 표현 |
|-----------|------------|
| CAPM ⊂ ICAPM | ICAPM에서 상태변수 = 0이면 CAPM |
| CAPM ⊂ APT (K=1) | APT에서 단일 시장 팩터이면 CAPM |
| FF3 ⊂ APT (K=3) | APT에서 3개 특정 팩터이면 FF3 |
| CCAPM ⊂ ICAPM | 소비 = 유일한 상태변수이면 CCAPM |
| ICAPM ≈ APT | 수학적 형태 동일, 해석(균형 vs 무차익) 상이 |
| 모든 모형 → SDF | M의 형태 특정에 따라 각 모형 도출 |

> **3장 연결:** 본 절의 금융학적 기초는 3장(기술적 분석 이론 및 구현)에서 패턴·신호·백테스트의 벤치마크로 활용된다. Jensen's Alpha(2.6.3)는 패턴 전략의 위험 조정 성과를 평가하고, APT 팩터(2.6.7)는 MRA 회귀의 설명변수를, VRP(2.6.11)와 DD(2.6.13)는 패턴 신뢰도 조정의 교차시장 입력을 각각 제공한다. SDF(2.6.15)의 무차익 조건은 패턴의 존재와 소멸을 AMH(2.6.1)의 적응적 진화 관점에서 해석하는 이론적 뼈대이다.

## 2.7 행동재무학적 기초[^behav-1]

행동재무학은 기술적 패턴이 *왜* 작동하는지에 대한 이론적 정당화를 제공한다.
체계적 인지 편향이 본질가치로부터의 예측 가능한 이탈을 생성하기 때문이다.
모든 시장참여자가 합리적 베이지안 갱신자(EMH의 가정)라면, 가격 패턴은 어떠한
예측적 정보도 담지 않을 것이다.

**이론적 흐름 (7시트):** 전망이론/손실회피 (2.7.1) → 처분효과 (2.7.2) → 군집행동 (2.7.3) → 인지편향 (2.7.4) → BLL 반예측기 (2.7.5) → 베타-이항 사후 (2.7.6) → 요약 (2.7.7). 인간의 체계적 비합리성이 가격 패턴을 생성하는 메커니즘을 추적하고, 이를 역으로 활용하는 반예측기/베이즈 교정으로 귀결한다.


### 2.7.1 전망이론과 손실회피 (Prospect Theory & Loss Aversion)
Kahneman and Tversky (1979)의 원전 전망이론과 Tversky and Kahneman (1992)의
누적 전망이론(Cumulative Prospect Theory, CPT)은 행동재무학의 기초를 구성한다.
1979년 원전이 준거점 의존·손실회피·민감도 체감·확률 가중의 4대 축을 제시했고,
1992년 누적 버전은 순위 의존 확률 가중(rank-dependent weighting)을 도입하여
복권 선택의 1차 확률 지배(FOSD) 위배 문제를 해소했다. CheeseStock는 두 판본의
공통 핵심인 손실회피($\lambda = 2.25$)를 패턴 분석 엔진의 손절매/목표가
비대칭 산출에 직접 반영한다.
$$v(x) = \begin{cases} x^{0.88} & x \geq 0 \text{ (이득)} \\ -2.25 \cdot (-x)^{0.88} & x < 0 \text{ (손실)} \end{cases}$$

$$SL_{\text{adj}} = SL_{\text{base}} \times 1.12, \quad TP_{\text{adj}} = TP_{\text{base}} \times 0.89$$

| 기호 | 의미  |
|------|------|
| v(x) | 가치함수  |
| λ = 2.25 | 손실회피 계수 (K&T 1979)  |
| δ = 0.25 | KRX 보호 계수 (가격제한폭+T+2)  |
| SL_(base) | 기본 손절매 수준  |
| TP_(base) | 기본 목표가 수준  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{SL_(base)}$, $\textcolor{stageOneMarker}{TP_(base)}$은(는) Stage 1 데이터 계층에서 산출된다.


유도: $SL_{\text{adj}} = SL_{\text{base}} \times (1 + \delta(\sqrt{\lambda} - 1))$,
$\lambda=2.25$: $1 + 0.25(1.50-1) = 1.125 \approx 1.12$.

### 2.7.2 처분효과 (Disposition Effect)
Shefrin and Statman (1985)가 문서화한 처분효과는 투자자가 수익 포지션을
조기 매도하고 손실 포지션을 과도하게 보유하는 체계적 경향이다. 이는
전망이론 가치함수의 형상에서 직접 귀결되며, 52주 신고가/신저가
지지저항 수준과 연결된다.
PGR (실현 이익 비율) > PLR (실현 손실 비율) — Odean (1998) 10,000 계좌 확인.

George and Hwang (2004): 52주 신고가 근접성이 모멘텀 수익률의 70% 설명.

### 2.7.3 군집행동과 정보폭포 (Herding & Information Cascades)
Banerjee (1992)와 Bikhchandani, Hirshleifer, Welch (1992)의 정보 폭포 이론은
개인이 사적 정보를 합리적으로 무시하고 선행자의 행동을 따르는 메커니즘을
설명한다. CSAD 감소는 군집행동의 경험적 지문이다.
$$CSAD_t = \frac{1}{N} \sum_{i=1}^{N} |R_{i,t} - R_{m,t}|$$

군집 검정: $CSAD_t = \gamma_0 + \gamma_1|R_{m,t}| + \gamma_2 R_{m,t}^2$, $\gamma_2 < 0$ 유의 시 군집 존재.

| 기호 | 의미  |
|------|------|
| CSADt | 횡단면 절대 편차  |
| Ri,t | 종목 i의 수익률  |
| Rm,t | 시장 수익률  |
| γ2 | 군집 계수 (음이면 군집)  |
| Ri,t, Rm,t | Stage 1 수익률 데이터  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{Ri,t, Rm,t}$은(는) Stage 1 데이터 계층에서 산출된다.

### 2.7.4 인지 편향: 앵커링, 과잉확신 (Cognitive Biases)
Tversky and Kahneman (1974)의 앵커링, Daniel et al. (1998)의 과잉확신,
대표성 편향은 기술적 분석 패턴의 자기실현적 특성과 평균회귀 패턴의
이론적 근거를 제공한다.

- **앵커링**: 현저한 가격 수준에 앵커링 → 자기실현적 지지/저항
- **과잉확신**: 과잉반응 후 반전 → 이중천장, 머리어깨 패턴
- **대표성**: 원형 유사성 기반 판단 → 반예측기 게이트 필요

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 앵커링 → 지지/저항 | `patternEngine` S/R 수준 | 정수, 52주 신고가 |
| 과잉확신 → 반전 | 평균회귀 패턴 설계 | 이중천장/머리어깨 |
| 대표성 → 반예측기 | `PATTERN_WR_KRX` 48% 임계 | 승률 미달 패턴 감액 |

***

### 2.7.5 반예측기 게이트 (Anti-Predictor Gate --- BLL 1992)
Brock, Lakonishok, and LeBaron (1992)는 26개 기술적 매매 규칙의 통계적 유의성을
검증하였다. CheeseStock는 BLL 논리를 역으로 적용하여, KRX 5년 경험적 승률이
48% 미만인 패턴의 복합 신뢰도를 감액한다.

임계값: 48% (동전 던지기 50% − 거래비용 2pp).[^anti-pred-48]

[^anti-pred-48]: 48%는 CheeseStock 자체 백테스트 교정값으로,
2,704개 KRX 종목 × 303,956개 패턴 표본(Stage 5 Phase A)에서 산출된
거래비용 조정 유의성 임계이다. 세부 표본 구성과 거래비용 가정은
`memory/project_stage5_phaseA_findings.md` 참조.
KRX 발견: 매도 패턴(55~74.7%) > 매수 패턴(39~62%) — 손실회피와 부합.

<!-- [V22-V25 SYNC] -->

**V25 업데이트 --- Contrarian 승격**: 2025-11-01 기준 OOS 시간분할 백테스트(`data/backtest/pattern_winrates_oos.json`)에서 `dirWr < 50`으로 분류된 8개 `ANTI_PREDICTOR` 패턴이 1-sided binomial 검정과 Benjamini--Hochberg FDR ($q = 0.10$) 다중검정을 모두 통과(Bonferroni $\alpha = 0.05$에서도 통과)하여 **반대방향 예측자**(contrarian predictor)로 승격되었다. 이는 BLL (1992)의 반예측기 게이트 논리를 "음의 예측력도 동일한 증거 기준으로 예측자로 인정한다"는 방향으로 일반화한 것이며, 런타임에서는 $\textit{confidencePred} = 100 - \textit{dirWr}$로 반전 산출된다. 이론적 기반은 §2.6.1 (Jegadeesh 1990 단기반전 + Lo 2004 AMH)에, 구현과 8-패턴 통계표는 §3.5.1에 기술되어 있다.

### 2.7.6 베타-이항 사후 승률 (Beta-Binomial Posterior)
소표본 패턴 승률의 과대/과소 추정을 교정하기 위해 경험적 베이즈 축소
(Efron-Morris, 1975)를 적용한다.
$$\theta_{\text{post}} = \frac{n \cdot \theta_{\text{raw}} + N_0 \cdot \mu_{\text{grand}}}{n + N_0}$$

| 기호 | 의미  |
|------|------|
| θ_(raw) | 원시 승률  |
| N0 = 35 | 축소 강도 (경험적 베이즈 최적)  |
| μ_(grand) | 범주별 총평균 (캔들 ~43%, 차트 ~45%)  |

### 2.7.7 행동재무학 도출 요약 (Behavioral Finance Summary)

| 시트 | 핵심 모형 | 주요 학술 출처 | KRX 전달 경로 | 구현 상태 |
|---------------|--------------------|--------------------|------------------------------|---------------|
| 2.7.1 전망이론과 손실회피 | 가치함수 v(x): 이득 x^0.88, 손실 −2.25(−x)^0.88; SL 확대 ×1.12, TP 압축 ×0.89 | Kahneman & Tversky (1979) | 전망이론 λ=2.25 → `_stopLoss()` PROSPECT_STOP_WIDEN=1.12 → `_priceTarget()` PROSPECT_TARGET_COMPRESS=0.89 → 손절/목표 비대칭 출력 | ✅ 구현 완료 (`patterns.js` L205-207, L611, L632) |
| 2.7.2 처분효과 | PGR > PLR 비대칭; 52주 신고가 근접성이 모멘텀 수익률 70% 설명 | Shefrin & Statman (1985); Odean (1998); George & Hwang (2004) | 처분효과 이론 → `_stopLoss()` PROSPECT_TARGET_COMPRESS 보수적 목표가 → `_srLevels` 52주 신고가 지지/저항 → 패턴 신뢰도 조정 | 🔧 부분 구현 (`disposition_proxy` 로드 완료, 신뢰도 직접 할인은 미적용; `backtester.js` L211) |
| 2.7.3 군집행동과 정보폭포 | CSAD_t = (1/N)Σ\|R_i,t − R_m,t\|; γ2 < 0 검정 | Banerjee (1992); Bikhchandani et al. (1992); Chang, Cheng & Khorana (2000) | CSAD 일별 데이터 → `csad_herding` 파일 로드 → `_applyHerdingContext()` 3일 평균 herdingFlag ≥ 1.67 → 매수/매도 패턴 신뢰도 ±10점 조정 | ✅ 구현 완료 (`patterns.js` L973-1064, `backtester.js` L212) |
| 2.7.4 인지 편향 (앵커링, 과잉확신) | 앵커링 → 자기실현적 지지/저항; 과잉확신 → 과잉반응 후 반전; 대표성 → 패턴 매칭 편향 | Tversky & Kahneman (1974); Daniel et al. (1998) | 앵커링 이론 → `patternEngine._detectSR()` 정수·52주 신고가 클러스터링 → `_srLevels` → `signalEngine.applySRProximityBoost()` 신호 가중; 과잉확신 cap=90 (`patterns.js` L2254) | 🔧 부분 구현 (앵커링 S/R ✅; 과잉확신 cap 설계 기반 ✅; 과잉반응 반전 패턴은 설계 기반) |
| 2.7.5 반예측기 게이트 | BLL 승률 임계 48% (동전던지기 50% − 거래비용 2pp); WR < 48% → 복합 신뢰도 감액 | Brock, Lakonishok & LeBaron (1992) | KRX 5년 545,307건 실증 → `PATTERN_WR_KRX` 룩업 테이블 → `ANTI_PREDICTOR_THRESHOLD=48` → 복합 신호 `_wrCap` 적용 → 신뢰도 상한 캡핑 | ✅ 구현 완료 (`signalEngine.js` L427-448, L2354-2363) |
| 2.7.6 베타-이항 사후 승률 | θ_post = (n·θ_raw + N0·μ_grand) / (n + N0); N0=35 (경험적 베이즈 최적, N0_hat=34.5) | Efron & Morris (1975); James-Stein (이항 비율 적용) | 원시 KRX 승률 + 표본 크기 → `PATTERN_WIN_RATES_SHRUNK` IIFE (N0=35, 캔들 μ≈43%, 차트 μ≈45%) → `analyze()` L914 패턴별 사후 승률 적용 → 소표본 과추정 교정 | ✅ 구현 완료 (`patterns.js` L291-334) |

---

\newpage

## 부록 2.A: 학문 의존성 구조

```text
                     [L0]
                   물리학 (2.1)

                     |
              통계역학, 멱법칙, SOC

                     |
         +-----------+-----------+

         |                       |
       [L1]                    [L1]
     수학 (2.2)              물리 응용

         |                       |
    확률과정, 이토                |
    프랙탈, 선형대수              |

         |                       |
       [L2]                      |
     통계학 (2.3)                |

         |                       |
    GARCH, EVT, HMM              |
    WLS, Ridge, HAR-RV           |

         |                       |
         +-------+-------+-------+-------+

         |       |       |       |       |
       [L3]    [L3]    [L3]    [L3]    [L3]
     경제학   경영학   금융학   심리학  미시구조
     (2.5)   (2.4)   (2.6)   (2.7)  (금융 2.6)

         |       |       |
    IS-LM    DCF/MM   CAPM계보
    Taylor   WACC     BSM/Greeks
    MF/ADAS  EVA/Kelly 채권/신용
    MCS/HMM  대리인    SDF통합

         |       |       |
         +-------+-------+

                 |
                 v
    +----------------------------------------------+

    |  제3장: 기술적 분석 구현                       |
    |  패턴 + 신호 + 신뢰도 + 백테스트              |
    +----------------------------------------------+
```

[^phys-1]: 학문 계층 L0. 통계역학, 멱법칙, 자기조직 임계성. 모든 확률 모형의 분포적 전제.
[^math-1]: 학문 계층 L1. 확률과정, 이토 해석학, 프랙탈 기하, 선형대수. 모든 금융 모형의 형식 언어.
[^stat-1]: 학문 계층 L2. GARCH, EVT, HMM, WLS, HAR-RV. 시계열 분석과 강건 추정의 도구 계층.
[^biz-1]: 학문 계층 L3. 기업재무, DCF, 자본구조, EVA, 포지션 사이징. 금융학(2.6절)과 쌍방향 의존: CAPM ↔ WACC.
[^econ-1]: 학문 계층 L3. 거시경제학, 미시경제학, 섹터 회전, 환율, 재정.
[^fin-1]: 학문 계층 L3. 자산가격결정, 채권, 파생상품, 시장미시구조, 신용위험. SDF가 통합 프레임워크.
[^behav-1]: 학문 계층 L3. 전망이론, 처분효과, 군집행동, 인지 편향. 시장 비효율성의 행동적 원천.

*판본: V8 (2026-04-10) | 제2장 | 7개 학문 67 시트*


# 제3장: 기술적 분석 --- 이론의 실제 적용

> CheeseStock KRX 실시간 차트 시스템의 기술적 분석 계보 문서.
> 본 시스템에 구현된 모든 지표, 패턴, 신호, 신뢰도 조정은 제2장의 학술적
> 기반으로부터 도출된다. 본 장은 각 구현체의 학술적 계보(lineage)를
> 추적하고, 이론에서 코드로의 변환 과정을 문서화한다.
> Stage 색상: Emerald Teal #1A3D35 | 판본: V8 (2026-04-10) | 시트 형식 변환

---

## Sheet 1: 3.1 지표 계보 종합

`js/indicators.js`에 구현된 31개 지표는 학술적 출처, 수학적 정식화, 구현 세부,
그리고 하류 소비자(downstream consumer)와 함께 문서화된다. 각 지표 카드는
학문적 계보, 핵심 공식, 기호 주석, CheeseStock 적용을 체계적으로 기술한다.

**학문적 토대 분류**

| 학문 분야 | 지표 ID | 해당 지표 |
|-----------|---------|-----------|
| 통계학 (기술통계) | I-01, I-03 | SMA, 볼린저 밴드 |
| 통계학 (시계열 평활) | I-02 | EMA |
| 통계학 (극단값 이론) | I-03E, I-10, I-11 | EVT BB, 힐 추정량, GPD |
| 통계학 (회귀분석) | I-15, I-15a, I-16, I-17 | WLS, HC3, GCV, OLS 추세 |
| 통계학 (강건 추정) | I-25 | 틸-센 추정량 |
| 통계학 (품질관리) | I-29 | 온라인 CUSUM |
| 통계학 (구조변화) | I-30 | 이진 세분화 |
| 기술적 분석 (Wilder) | I-04, I-05, I-23 | RSI, ATR, ADX |
| 기술적 분석 (모멘텀) | I-19, I-20, I-21, I-22, I-24 | MACD, 스토캐스틱, StochRSI, CCI, Williams %R |
| 기술적 분석 (거래량) | I-06 | OBV |
| 기술적 분석 (일본) | I-07 | 일목균형표 |
| 수학/공학 (최적 제어) | I-08 | 칼만 필터 |
| 물리학/프랙탈 | I-09 | 허스트 지수 |
| 금융학 (자산가격결정) | I-12 | CAPM 베타 |
| 금융학 (변동성) | I-13, I-14, I-26, I-27 | HV Parkinson, VRP, EWMA Vol, Vol Regime |
| 금융학 (변동성 예측) | I-31 | HAR-RV |
| 시장미시구조 | I-28 | Amihud 비유동성 |


### I-01: 단순이동평균 (Simple Moving Average, SMA)
단순이동평균(SMA)은 수학적 기초통계학의 산술평균 개념에서 출발하여, Donchian
(1960년대)과 Murphy (1999)에 의해 시장 분석에 대중화된 가장 기본적인 기술적
지표이다. 단일 창시자가 없는 기초적 통계 개념으로, 모든 이동평균 파생 지표의
근간이 된다.

SMA는 가격 잡음을 평활화하여 기저 추세 방향을 드러낸다. 저역 통과
필터(low-pass filter)로서 고주파 변동을 제거하는 동시에 지배적 추세를
보존한다. 기간 $n$의 선택이 차단 주파수(cutoff frequency)를 결정한다.
단기(5, 10)는 최근 모멘텀을, 장기(50, 200)는 장기 추세를 추적한다.
$$SMA(n) = \frac{1}{n} \sum_{i=0}^{n-1} P_{t-i}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가  |
| $n$ | SMA 기간  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 수정종가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 산술 평균 평활 | `js/indicators.js` `calcMA(data, n)` L.15 | 가격 추세 추출 |
| 표준 기간 5/20/60 | 상수 [A] | S-1, S-2, BB 중심선 |

**소비자:** 신호 S-1 (이동평균 교차), S-2 (이동평균 정렬), 스토캐스틱 %D 평활,
CCI 평균편차, 복합 신호.

**참조:** 제2장 2.3절 (통계학적 기초).


### I-02: 지수이동평균 (Exponential Moving Average, EMA)
지수이동평균(EMA)은 통계학의 시계열 평활 이론에서 기원한다. Brown (1956)의
"Exponential Smoothing for Predicting Demand"가 지수 평활의 기초를 놓았으며,
Holt (1957)이 이를 일반화하고, Hunter (1986)가 EWMA 해석을 제시하였다.

EMA는 과거 관측치에 기하급수적으로 감소하는 가중치를 부여하여, SMA 대비
최근 가격 변화에 더 민감하게 반응한다. 이 민감성은 MACD (I-19)에서 핵심적인데,
MACD는 빠른 EMA와 느린 EMA의 차이를 통해 모멘텀 이동을 감지하기 때문이다.
$$EMA_t = \alpha \cdot P_t + (1 - \alpha) \cdot EMA_{t-1}, \quad \alpha = \frac{2}{n + 1}$$

초기화: $EMA_0 = SMA(\text{최초 } n \text{개 관측치})$.

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가  |
| $\alpha$ | 평활 계수 $= 2/(n+1)$  |
| $n$ | EMA 기간  |
| $EMA_{t-1}$ | 이전 EMA 값  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 수정종가이다. null/NaN 방어를 포함한 SMA 초기화 적용 (P0-3 수정).

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 지수 평활 | `js/indicators.js` `calcEMA(data, n)` L.26 | MACD, EWMA Vol |
| MACD 기본값 | n = 12, 26 [A], sig = 9 [A] | Appel (1979) 표준 |

**소비자:** MACD (I-19), EWMA 변동성 (I-26), 변동성 국면 장기 EMA.

**참조:** 제2장 2.2절 (수학적 기초).


### I-03: 볼린저 밴드 (Bollinger Bands, BB)
볼린저 밴드는 통계학의 기술통계 분야에서 발전한 표준편차 밴드 지표이다.
Bollinger (2001) *Bollinger on Bollinger Bands*에서 공식화하였다. 주목할 점은
모집단 시그마($\div n$)를 사용하며, 베셀 보정 표본 시그마($\div(n-1)$)가
아니라는 것이다. 이는 원저의 의도적 선택이다.

볼린저 밴드는 2시그마 가격 외피(envelope)를 포착하여 과매수(상단 밴드)와
과매도(하단 밴드) 조건을 식별한다. 밴드 수축(squeeze)은 변동성 확장에
선행하며, 이는 핵심적 국면 전환 신호이다.
$$\text{Middle} = SMA(n)$$
$$\text{Upper} = SMA(n) + k \cdot \sigma_{\text{pop}}(n)$$
$$\text{Lower} = SMA(n) - k \cdot \sigma_{\text{pop}}(n)$$
$$\sigma_{\text{pop}} = \sqrt{\frac{1}{n} \sum_{i} (P_i - SMA)^2}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{P_i}$ | 종가 배열  |
| $n$ | SMA 기간 (20)  |
| $k$ | 시그마 배수 (2.0)  |
| $\sigma_{\text{pop}}$ | 모집단 표준편차  |
| $EVT\ \hat{\alpha}$ | Hill 꼬리지수  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 시계열이다.

> **학문 분류:** 통계학(기술통계 → 정규분포 신뢰구간) + 극단값 이론(EVT 보정).
> 베셀 보정을 적용하지 않는 것은 Bollinger (2001) 원저의 의도적 선택이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 표준편차 밴드 | `js/indicators.js` `calcBB(closes, n, mult)` L.50 | 가격 외피 |
| 모집단 시그마 | n=20, mult=2.0 [A] | Bollinger (2001) 원본 |

**소비자:** 신호 S-7 (BB 반등/돌파/스퀴즈), 복합 신호
(buy_hammerBBVol, sell_shootingStarBBVol), EVT 보정 확장 (I-3E).

**참조:** 제2장 2.3절 (통계학).


### I-03E: EVT 보정 볼린저 밴드 (EVT-Adjusted Bollinger Bands)
극단값 이론(EVT)에 기반한 꼬리 보정 밴드이다. Gopikrishnan et al. (1999)의
역세제곱 법칙과 Hill (1975)의 꼬리지수 추정에 근거한다. 금융 수익률은
두꺼운 꼬리($\alpha$가 KRX 종목에서 통상 3~5)를 보인다. 표준 2시그마
밴드는 정규성을 가정하므로, EVT 보정 밴드는 실제 꼬리 확률을 반영하도록
확장되어 허위 돌파 신호를 줄인다.
$$\text{EVT\_mult} = \begin{cases} k \cdot (1 + 0.45 \cdot (4 - \hat{\alpha})) & \hat{\alpha} < 4 \text{ (두꺼운 꼬리)} \\ k & \text{그 외 (표준 볼린저)} \end{cases}$$

| 기호 | 의미  |
|------|------|
| $k$ | 볼린저 시그마 배수 (2.0)  |
| $\hat{\alpha}$ | 힐 꼬리지수 추정량  |
| $0.45$ | EVT 보정 계수  |

> **이전 Stage 데이터:** $\hat{\alpha}$는 본 Stage I-10 (힐 추정량)의 산출물이며, I-10 자체는 $\textcolor{stageOneMarker}{OHLCV}$ 수익률(Stage 1)로부터 도출된다. $k$는 I-03에서 계승한 상수이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 꼬리 보정 밴드 | `js/indicators.js` `IndicatorCache.bbEVT()` (지연 평가) | 극단 사건 필터 |
| 0.45 계수 | 상수 [D] | 정확한 분위수 매핑이 아닌 경험적 값 |

**참조:** 제2장 2.3.2절 (극단값 이론).


### I-04: RSI (Relative Strength Index, 상대강도지수)
RSI는 기술적 분석의 모멘텀 오실레이터 계열로, Wilder (1978)
*New Concepts in Technical Trading Systems*에서 창안되었다. RSI는 방향성
가격 움직임의 속도와 크기를 측정하여 0~100으로 진동한다. 70 이상은
과매수(매도 압력 축적), 30 이하는 과매도(매수 기회)를 나타낸다.
심리학적으로 RSI는 공포-탐욕 스펙트럼에 대응한다 (제2장 2.7절).
$$RS = \frac{AvgGain(n)}{AvgLoss(n)}, \quad RSI = 100 - \frac{100}{1 + RS}$$

와일더 평활: $AvgGain_t = (AvgGain_{t-1} \cdot (n-1) + Gain_t) / n$.
이는 $\alpha = 1/n$인 지수이동평균과 동치이다.

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 배열  |
| $n$ | RSI 기간 (14)  |
| $AvgGain$, $AvgLoss$ | 와일더 평활 평균  |
| $70 / 30$ | 과매수/과매도 경계  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder RSI | `js/indicators.js` `calcRSI(closes, period)` L.63 | 과매수/과매도 |
| 표준 기간 14 | period = 14 [A] | Wilder (1978) 원본 |

**소비자:** 신호 S-5 (RSI 영역), S-6 (RSI 괴리), StochRSI (I-21),
복합 신호 (strongBuy_hammerRsiVolume, buy_bbBounceRsi 등).

**참조:** 제2장 2.7절 (심리학 --- 공포/탐욕 대리변수).


### I-05: ATR (Average True Range, 평균진폭)
ATR은 Wilder (1978) *New Concepts in Technical Trading Systems*에서 창안된
변동성 측정 지표이다. ATR은 CheeseStock의 보편적 정규화 단위이다. 모든
패턴 임계값, 손절매, 목표가를 ATR 배수로 표현함으로써 가격 수준 독립성을
달성한다. 삼성전자(60,000원)와 1,000원 소형주의 패턴이 변동성 상대적으로
동일하게 평가되는 것이다. 이것이 패턴 엔진의 가장 핵심적 설계 결정이다.
$$TR_t = \max(H_t - L_t, \, |H_t - C_{t-1}|, \, |L_t - C_{t-1}|)$$
$$ATR_t = \frac{ATR_{t-1} \cdot (n-1) + TR_t}{n}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{H_t}$ | 당일 고가  |
| $\textcolor{stageOneMarker}{L_t}$ | 당일 저가  |
| $\textcolor{stageOneMarker}{C_{t-1}}$ | 전일 종가  |
| $n$ | ATR 기간 (14)  |
| 폴백 0.02 | ATR 불가 시 대체 비율  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_t, L_t, C_{t-1}}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder ATR | `js/indicators.js` `calcATR(candles, period)` L.87 | 보편 정규화 단위 |
| 폴백 규칙 | `close * 0.02` [C]; `ATR_FALLBACK_BY_TF` | 시간대별 적응 |

**소비자:** 모든 패턴 감지, 모든 손절/목표 산출, 지지/저항 클러스터링 허용오차,
신뢰도 조정, OLS 추세 정규화.

**참조:** 제2장 2.3절 (통계학적 기초).


### I-06: OBV (On-Balance Volume, 누적거래량)
OBV는 기술적 분석의 거래량 분석 계열로, Granville (1963) *New Key to Stock
Market Profits*에서 창안되었다. Murphy (1999) Ch. 7에서 재체계화되었다.
Granville의 핵심 가설은 "거래량이 가격에 선행한다"는 것이다. OBV는 가격
방향으로 거래량을 누적하여, 축적(스마트 머니 매수)이나 분배(스마트 머니
매도)가 가격 반응보다 먼저 나타나는 것을 드러낸다. OBV 추세와 가격 추세
간의 괴리(divergence)는 행동재무학 문헌에서 가장 신뢰도 높은 선행 지표
중 하나이다 (Barber-Odean 2008 관심 이론, 제2장 2.7절).
$$OBV_t = \begin{cases} OBV_{t-1} + V_t & C_t > C_{t-1} \\ OBV_{t-1} - V_t & C_t < C_{t-1} \\ OBV_{t-1} & C_t = C_{t-1} \end{cases}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{C_t}$ | 종가  |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량  |
| $OBV_{t-1}$ | 이전 OBV 누적값  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{C_t, V_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 및 거래량이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Granville OBV | `js/indicators.js` `calcOBV(candles)` L.115 | 거래량 방향 분석 |
| 조정 상수 없음 | 순수 공식 | --- |

**소비자:** 신호 S-20 (OBV 괴리), 복합 신호 buy_volRegimeOBVAccumulation.

**참조:** 제2장 2.7절 (관심과 거래량 심리).


### I-07: 일목균형표 (Ichimoku Kinko Hyo)
일목균형표는 일본식 기술적 분석의 대표 지표로, 호소다 고이치(Hosoda Goichi,
1969)가 *일목균형표*에서 체계화하였다 (필명 일목산인, Ichimoku Sanjin).
일목균형표는 5개 데이터 포인트를 동시에 제공한다. 추세 방향(전환선/기준선
관계), 모멘텀(구름 위치), 지지/저항(구름 경계), 확인(후행스팬 대 가격).
"삼역호전(saneki-hoten)" --- 가격이 구름 위에 있고, 전환선이 기준선을
상향 교차하며, 후행스팬이 26기간 전 가격 위에 있는 조건 --- 은 일본 기술적
분석 전통에서 강력한 매수 신호로 간주된다.
$$\text{전환선(Tenkan-sen)} = \frac{highest\_high(9) + lowest\_low(9)}{2}$$
$$\text{기준선(Kijun-sen)} = \frac{highest\_high(26) + lowest\_low(26)}{2}$$
$$\text{선행스팬 A} = \frac{\text{전환선} + \text{기준선}}{2}, \quad \text{+26 선행}$$
$$\text{선행스팬 B} = \frac{highest\_high(52) + lowest\_low(52)}{2}, \quad \text{+26 선행}$$
$$\text{후행스팬(Chikou)} = \text{종가}, \quad \text{-26 후행}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t}$ | 고가, 저가, 종가  |
| $9, 26, 52$ | 전환선/기준선/선행B 기간  |
| $+26$ | 선행 이동 기간  |
| $-26$ | 후행 이동 기간  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_t, L_t, C_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 일목 5선 체계 | `js/indicators.js` `calcIchimoku(candles, conv, base, spanBPeriod, displacement)` L.135 | 추세/구름/확인 |
| 호소다 원본 상수 | conv=9, base=26, spanB=52, displacement=26 [A] | 표준 기간 |

**소비자:** 신호 S-8 (구름 돌파, TK 교차), 복합 신호
(buy_ichimokuTriple, sell_ichimokuTriple).

**참조:** 기술적 분석 전통 (제2장 범위 외). 호소다 고이치 (1969).


### I-08: 칼만 필터 (Kalman Filter)
칼만 필터는 수학/공학의 최적 제어 분야에서 발전한 상태 추정 기법이다.
Kalman (1960)이 기초를 놓았으며, Mohamed and Schwarz (1999)가 적응형 Q
확장을 INS/GPS 분야에서 제안하였다. 칼만 필터는 가우시안 잡음 가정 하에서
최적 상태 추정을 제공한다. 가격 시계열에 적용하면, 잡음-신호 비율에 따라
반응성을 자동 조절하는 평활 추정치를 산출한다. 이동평균(고정 시차)과 달리
칼만 이득 $K$가 자동 조정된다. 높은 잡음 → 낮은 이득(더 많은 평활), 낮은
잡음 → 높은 이득(더 민감한 반응). 적응형 Q 확장은 변동성 국면에 추가적
민감도를 부여한다.
$$\hat{x}_t = \hat{x}_{t-1} + K_t(z_t - \hat{x}_{t-1}), \quad K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}$$

적응형 Q: $Q_t = Q_{\text{base}} \times (ewmaVar_t / meanVar)$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{z_t}$ | 관측값 (종가)  |
| $\hat{x}_t$ | 추정 상태 (필터링된 가격)  |
| $K_t$ | 칼만 이득  |
| $P_{t|t-1}$ | 사전 오차 공분산  |
| $Q$ | 프로세스 노이즈 (0.01)  |
| $R$ | 관측 노이즈 (1.0)  |
| $ewmaAlpha$ | EWMA 평활 계수 (0.06)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{z_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 적응형 칼만 | `js/indicators.js` `calcKalman(closes, Q, R)` L.170 | 적응 평활 |
| 프로세스/관측 노이즈 | Q=0.01, R=1.0, ewmaAlpha=0.06 [B] | 자동 조정 |

**소비자:** 신호 S-12 (칼만 전환 --- 기울기 방향 전환).

**참조:** 제2장 2.2.6절 (최적 제어).


### I-09: 허스트 지수 (Hurst Exponent, R/S Analysis)
허스트 지수는 물리학/프랙탈 분야의 장기 의존성 이론에 근거한다.
Mandelbrot (1963)이 금융시장에의 적용을 처음 제안하였으며, Peters (1994)
*Fractal Market Analysis* Ch. 4에서 체계화하였다. Mandelbrot and Wallis
(1969)가 R/S 관례를 확립하였다.

$H > 0.5$는 추세 지속성(모멘텀 국면), $H < 0.5$는 평균회귀,
$H = 0.5$는 랜덤워크를 나타낸다. 이는 현재 국면에서 추세추종 전략과
평균회귀 전략 중 어느 것이 성공할 가능성이 높은지를 직접 알려준다.
R/S는 수익률(정상 과정)로 계산해야 하며, 가격 수준(I(1))으로 계산하면
$H$가 ~0.4만큼 상향 편향된다.
1. 가격을 로그수익률로 변환: $r_t = \ln(P_{t+1}/P_t)$
2. 윈도우 크기 $w = [minWindow, 1.5w, 2.25w, \ldots]$에 대해:
   블록별 $R/S = (\max(\text{cumDev}) - \min(\text{cumDev})) / S$ 계산
3. 회귀: $\log(R/S) = H \cdot \log(w) + c$, $H$ = 회귀 기울기

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 시계열  |
| $r_t$ | 로그수익률  |
| $w$ | 윈도우 크기  |
| $R/S$ | 조정 범위 / 표준편차  |
| $H$ | 허스트 지수  |
| $minWindow$ | 최소 윈도우 (10)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다. Mandelbrot-Wallis (1969)에 따른 모집단 시그마 적용. S=0 블록 제외 (M-9 수정).

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| R/S 분석 | `js/indicators.js` `calcHurst(closes, minWindow)` L.212 | 국면 분류 |
| $R^2$ 보고 | `calcHurst()` `.rSquared` (L.264 반환) | 추정 신뢰도 |

**소비자:** 신호 S-11 (허스트 국면: H > 0.6 추세, H < 0.4 평균회귀).

**참조:** 제2장 2.2.4절 (프랙탈 수학), 2.1절 (경제물리학).


### I-10: 힐 꼬리 추정량 (Hill Tail Estimator)
힐 추정량은 통계학의 극단값 이론(EVT) 분야에서 발전한 꼬리지수 추정 도구이다.
Hill (1975)이 원래 추정량을 제안하였으며, Drees and Kaufmann (1998)이
자동 $k$-선택 기법을 제공하였다. $\hat{\alpha} < 4$이면 수익률 분포의
꼬리가 두꺼워(멱법칙 감쇠) 정규분포의 제4적률(첨도)이 이론적으로 무한이다.
이 경우 표준 볼린저 밴드의 신뢰구간이 과소추정되므로 EVT 보정 밴드가
활성화된다.
$$\hat{\alpha} = \frac{k}{\sum_{i=1}^{k} [\ln X_{(i)} - \ln X_{(k+1)}]}, \quad SE = \frac{\hat{\alpha}}{\sqrt{k}}$$

여기서 $X_{(i)}$는 순서통계량(절대수익률, 내림차순),
$k = \lfloor\sqrt{n}\rfloor$ (Drees-Kaufmann 규칙).

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{X_{(i)}}$ | 절대수익률 순서통계량  |
| $k$ | 상위 순서통계량 개수 $\lfloor\sqrt{n}\rfloor$  |
| $\hat{\alpha}$ | 꼬리지수 추정값  |
| $SE$ | 추정량 표준오차  |
| 최소 $n$ | 최소 관측 수 (10)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{X_{(i)}}$는 Stage 1의 OHLCV 데이터로부터 산출된 절대수익률 순서통계량이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Hill 추정 | `js/indicators.js` `calcHillEstimator(returns, k)` L.276 | 꼬리 두께 측정 |
| Drees-Kaufmann k | 최소 n=10 [A], k=floor(sqrt(n)) [A] | 자동 k 선택 |

**소비자:** I-3E (EVT 볼린저), 백테스터 꼬리위험 평가.

**참조:** 제2장 2.3.2절 (극단값 이론).


### I-11: GPD 꼬리 적합 (Generalized Pareto Distribution)
GPD는 통계학의 극단값 이론(EVT) 중 임계값 초과(Peaks Over Threshold, POT)
접근법에 해당한다. Pickands (1975)와 Balkema-de Haan (1974)이 이론적 토대를
놓았으며, Hosking and Wallis (1987)가 확률가중적률(PWM) 추정법을 제안하였다.
GPD는 이론적으로 정당화된 극단 위험 분위수를 제공한다. 표준 VaR은 정규성을
가정하지만, GPD 기반 VaR은 KRX 수익률의 실제 꼬리 행태
($\alpha \sim 3$--$4$, 스튜던트-t 유사)를 포착한다.
임계값: $u$ = 절대수익률 상위 5%, 초과량: $y_i = |r_i| - u$

PWM: $b_0 = \bar{y}$, $b_1 = \bar{y \cdot rank/(N_u-1)}$

$\hat{\xi} = 2 - b_0/(b_0 - 2b_1)$, $\hat{\sigma} = 2b_0 b_1/(b_0 - 2b_1)$

$VaR_p = u + (\sigma/\xi)[((n/N_u)(1-p))^{-\xi} - 1]$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{r_i}$ | 수익률 시계열  |
| $u$ | POT 임계값 (상위 5%)  |
| $y_i$ | 초과량  |
| $\hat{\xi}$ | 형상 모수 (< 0.499 제한)  |
| $\hat{\sigma}$ | 스케일 모수  |
| $p$ | 분위수 (0.99)  |
| 최소 $n$ | 최소 관측 수 (500)  |
| 최소 초과 | 최소 초과 관측 수 (20)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_i}$는 Stage 1의 OHLCV 데이터로부터 산출된 수익률 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| POT-GPD | `js/indicators.js` `calcGPDFit(returns, quantile)` L.323 | 극단 VaR |
| PWM 추정 | quantile=0.99 [A], 임계=상위 5% [B] | 꼬리 확률 산출 |

**소비자:** EVT 기반 손절매 최적화 (백테스터).

**참조:** 제2장 §2.3.2 (극단값 이론 — GEV, GPD, Hill 추정량).


### I-12: CAPM 베타 (Capital Asset Pricing Model Beta)
CAPM 베타는 금융학의 자산가격결정 이론에서 도출된 체계적 위험 측정치이다.
Sharpe (1964), Lintner (1965)가 이론을 체계화하였으며, Fama-MacBeth (1973)가
횡단면 검증 방법론을 확립하였다. Scholes-Williams (1977)는 비유동성 보정
방법을 제안하였다.

베타는 체계적 위험, 즉 시장 전체 움직임에 대한 민감도를 측정한다.
$\beta = 1.5$이면 시장이 1% 움직일 때 해당 종목은 1.5% 움직인다.
젠센 알파(연율화 초과수익)는 베타를 감안한 후의 성과를 측정한다.
백테스터(B-6)에서 패턴 수익을 체계적(베타) 성분과 고유(알파) 성분으로
분해하는 데 사용된다.
$$\beta = \frac{Cov(R_i - R_f, R_m - R_f)}{Var(R_m - R_f)}$$
$$\alpha = \overline{(R_i - R_f)} - \beta \cdot \overline{(R_m - R_f)}$$

Scholes-Williams 보정: $\beta_{SW} = (\beta_{-1} + \beta_0 + \beta_{+1}) / (1 + 2\rho_m)$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{R_i}$ | 개별 종목 수익률  |
| $\textcolor{stageOneMarker}{R_m}$ | 시장(KOSPI/KOSDAQ) 수익률  |
| $\textcolor{stageTwoMarker}{R_f}$ | 무위험 이자율  |
| $\beta$ | 체계적 위험  |
| $\alpha$ | 젠센 알파 (초과수익)  |
| $window$ | 추정 윈도우 (250)  |
| 최소 관측 | 60  |
| 비유동성 임계 | 10% 무거래일  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{R_i, R_m}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가/시장지수이다. $\textcolor{stageTwoMarker}{R_f}$는 제2장 2.6.3절 CAPM 이론의 무위험 이자율 개념이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| CAPM + S-W 보정 | `js/indicators.js` `calcCAPMBeta(stockCloses, marketCloses, window, rfAnnual)` L.391 | 체계적 위험 |
| 비유동성 보정 | 10% 무거래일 임계 [C] | Scholes-Williams 자동 적용 |

**소비자:** 백테스터 B-6 (젠센 알파), 재무 패널 표시, 베타 로드 함수.

**참조:** 제2장 2.6.3절 (CAPM).


### I-13: 역사적 변동성 (Historical Volatility, Parkinson)
Parkinson (1980)이 제안한 범위 기반 변동성 추정량이다. 종가-종가 변동성
대비 약 5배 효율적이다. 고가-저가 범위는 종가-종가 변동성이 놓치는 장중
가격 변동을 포착한다. Parkinson 추정량은 통계적으로 더 효율적(동일 표본
크기에서 낮은 분산)이어서, VRP (I-14) 산출에 보다 정확한 실현 변동성
추정치를 제공한다.
$$HV_{\text{daily}} = \sqrt{\frac{1}{4n\ln 2} \sum [\ln(H_i/L_i)]^2}$$
$$HV_{\text{annual}} = HV_{\text{daily}} \times \sqrt{\text{KRX\_TRADING\_DAYS}}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{H_i, L_i}$ | 고가, 저가  |
| $n$ | 추정 기간 (20)  |
| $\sqrt{250}$ | 연율화 계수  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_i, L_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV의 고가/저가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Parkinson HV | `js/indicators.js` `calcHV(candles, period)` L.492 | 실현 변동성 |
| 연율화 | period=20 [B], sqrt(250) | KRX 관례 적용 |

**소비자:** VRP (I-14), 변동성 국면 분류.

**참조:** 제2장 §2.3.1 (GARCH/EWMA 변동성 — 범위 기반 추정량).


### I-14: VRP (Variance Risk Premium, 분산 위험 프리미엄)
VRP는 금융학/파생상품 분야의 변동성 위험 프리미엄 개념이다.
Bollerslev (2009) "Expected Stock Returns and Variance Risk Premia"에서
체계화되었다. 양(+)의 VRP는 옵션 시장이 실현보다 높은 변동성을 가격에
반영한다는 것을 의미하며, 불확실성 고조와 변동성 압축(평균회귀)이 임박했을
수 있다. 음(-)의 VRP는 옵션이 저평가되어 변동성 확장이 예상된다.
$$VRP = \sigma_{IV}^2 - \sigma_{RV}^2 = (VKOSPI/100)^2 - HV_{\text{Parkinson}}^2$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{VKOSPI}$ | 내재변동성 지수  |
| $HV_{\text{Parkinson}}$ | 실현 변동성 (I-13)  |
| $VRP$ | 분산 위험 프리미엄  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{VKOSPI}$는 Stage 1 데이터 계층에서 수집된 VKOSPI 내재변동성 지수이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Bollerslev VRP | `js/indicators.js` `calcVRP(vkospi, hvAnnualized)` L.536 | 변동성 프리미엄 |
| 조정 상수 없음 | 단위 변환 포함 순수 공식 | --- |

**소비자:** 신뢰도 요인 F8, RORO 요인 R1 (VKOSPI 경유).

**참조:** 제2장 2.6.11절 (파생상품 이론).


### I-15: WLS 회귀 (Weighted Least Squares with Ridge, 릿지 포함)
WLS 회귀는 통계학의 회귀분석, 구체적으로 일반화 최소제곱(GLS) 분야에
해당한다. Aitken (1935)이 GLS를, Hoerl and Kennard (1970)이 릿지 회귀를,
Reschenhofer et al. (2021)이 시간의존 WLS를 제안하였다.

지수적 감쇠 가중치를 갖는 WLS는 최근 관측치에 더 큰 영향력을 부여하여
시변적(time-varying) 관계를 포착한다. 릿지 정규화는 예측변수(품질, 추세,
거래량, 변동성)가 상관될 때 다중공선성으로 인한 불안정성을 방지한다.
Reschenhofer et al. (2021)은 WLS가 주식수익률 예측에서 OLS를 유의하게
능가한다는 것을 입증하였다.
$$\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$$

$W = \text{diag}(\text{weights})$, $\lambda$ = 릿지 벌점 (절편 면제).

| 기호 | 의미  |
|------|------|
| $X$ | 설계 행렬 (품질, 추세, 거래량, 변동성)  |
| $y$ | 반응 변수 (수익률)  |
| $W$ | 대각 가중 행렬 (지수 감쇠)  |
| $\lambda$ | 릿지 벌점  |
| $\hat{\beta}$ | 회귀 계수 벡터  |
| 최소 $n$ | $p+2$ 관측  |

> **이전 Stage 데이터:** $X$의 각 열은 I-01~I-28의 지표 산출물로부터 구성되며, $\textcolor{stageOneMarker}{y}$는 \textcolor{stageOneMarker}{Stage 1} 가격 데이터로부터 산출된 수익률이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 릿지 WLS | `js/indicators.js` `calcWLSRegression(X, y, weights, ridgeLambda)` L.558 | 수익 예측 |
| GCV 람다 | I-16 자동 선택 | 정규화 최적화 |

**소비자:** 백테스터 WLS 회귀 예측, OLS 추세 (I-17).


### I-15a: HC3 강건 표준오차 (Heteroscedasticity-Consistent Standard Errors)
HC3 강건 표준오차는 통계학의 이분산-일치 추정 분야에 해당한다.
White (1980)이 원래의 HC0 추정량을 제안하였으며, MacKinnon and White (1985)가
HC3 변형을 개선하였다. HC3은 HC0(White 원본) 대비 선호되며, $(1-h_{ii})^2$
스케일링이 고지렛점 관측치에서의 오차분산 과소추정을 보정한다. 지렛점
상한: 0.99로 제한 (수치적 안정성).
$$\hat{V}_{HC3}(\hat{\beta}) = (X'WX)^{-1} \left[\sum_i w_i^2 \frac{\hat{e}_i^2}{(1 - h_{ii})^2} x_i x_i' \right] (X'WX)^{-1}$$

| 기호 | 의미  |
|------|------|
| $h_{ii}$ | 지렛점(hat matrix 대각 원소)  |
| $\hat{e}_i$ | 잔차  |
| $0.99$ | 지렛점 상한  |

> **이전 Stage 데이터:** $h_{ii}$와 $\hat{e}_i$는 I-15 WLS 회귀의 산출물이다. WLS의 설계행렬 $X$와 가중행렬 $W$는 $\textcolor{stageOneMarker}{OHLCV}$ 기반 피처(품질, 추세, 거래량비, 변동성비)로 구성되며, 릿지 정규화의 이론적 기초는 $\textcolor{stageTwoMarker}{\text{Ridge}}$ (제2장 2.2.5절)에서 도출된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| HC3 보정 | `js/indicators.js` `calcWLSRegression()` (L.558) 내부 HC3 샌드위치 추정 | t-통계량 산출 |

**소비자:** 백테스터 WLS 계수의 t-통계량.


### I-16: GCV 람다 선택 (Generalized Cross-Validation)
GCV는 통계학의 모형 선택 분야에서 발전한 정규화 모수 선택 기법이다.
Golub, Heath, and Wahba (1979)가 제안하였다. 릿지 회귀의 최적 벌점 $\lambda$를
데이터 주도적으로 선택하여 과적합과 과소적합 사이의 균형을 달성한다.
$$GCV(\lambda) = \frac{RSS(\lambda)/n}{(1 - tr(H_\lambda)/n)^2}, \quad \lambda^* = \arg\min_{\lambda} GCV(\lambda)$$

그리드: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0].
평탄성 검사: GCV 변동 < 1%이면 기본값 $\lambda = 1.0$.

야코비 고유분해(I-16a)를 사용하여 효율적 트레이스 계산.

| 기호 | 의미  |
|------|------|
| $RSS(\lambda)$ | 잔차 제곱합  |
| $H_\lambda$ | 영향력 행렬 (hat matrix)  |
| $\lambda$ | 릿지 벌점 후보  |
| $n$ | 관측 수  |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| GCV 선택 | `js/indicators.js` `selectRidgeLambdaGCV(X, y, w, p)` L.826 | 최적 $\lambda$ |
| 야코비 고유분해 | I-16a 내부 | 효율적 트레이스 |

**소비자:** WLS 회귀 (I-15) 최적 릿지 벌점 자동 선택, 백테스터 WLS 예측.

**참조:** 제2장 2.2.5절 (선형대수와 릿지 회귀), 2.3.3절 (강건 회귀).


### I-17: OLS 추세선 (Ordinary Least Squares Trend)
OLS 추세선은 통계학의 회귀분석에서 가장 기본적인 추세 감지 도구이다.
Lo and MacKinlay (1999)는 $R^2 > 0.15$이면 추세가 존재하고,
$> 0.50$이면 강한 추세로 판단할 수 있다고 하였다. ATR(14) 정규화된
기울기(slopeNorm)를 사용하여 가격 수준 독립적 추세 강도를 산출한다.
$$P_t = a + bt + \varepsilon, \quad slopeNorm = b / ATR(14)$$

direction = 'up' if slopeNorm > 0.05, 'down' if < -0.05, 'flat' 그 외.

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가  |
| $b$ | 회귀 기울기  |
| $ATR(14)$ | 평균진폭 (I-05)  |
| $slopeNorm$ | 정규화 기울기  |
| $window$ | 추정 윈도우 (20)  |
| $0.05$ | 방향 판단 임계값  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| OLS 추세 | `js/indicators.js` `calcOLSTrend(closes, window, atr14Last)` L.912 | 추세 감지 |
| 방향 분류 | window=20 [B], slopeNorm 임계=0.05 [D] | up/down/flat |

**소비자:** 패턴 신뢰도 조정 (추세 국면 분류), 백테스터 정규화.

**참조:** 제2장 §2.2.5 (선형대수와 회귀), §2.3.3 (강건 회귀 — OLS는 WLS/Ridge의 기초).

> **주:** I-18은 의도적 결번이다. 초기 설계에서 예약되었으나 최종 구현에 포함되지 않았으며, 기존 ID 체계의 연속성을 유지하기 위해 재배정하지 않았다.


### I-19: MACD (Moving Average Convergence Divergence, 이동평균수렴확산)
MACD는 기술적 분석의 모멘텀 지표로, Appel (1979)
*The Moving Average Convergence-Divergence Trading Method*에서 창안되었다.
MACD는 두 EMA의 수렴과 발산을 통해 모멘텀을 포착한다. MACD 선이 시그널 선을
상향 교차(강세 교차)하면 모멘텀이 상승으로 전환되고, 하향 교차(약세 교차)하면
하락으로 전환된다. 히스토그램은 모멘텀 변화의 속도를 시각화한다.
$$\text{MACD Line} = EMA(12) - EMA(26)$$
$$\text{Signal Line} = EMA(9, \text{MACD Line})$$
$$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 배열  |
| $fast$ | 빠른 EMA 기간 (12)  |
| $slow$ | 느린 EMA 기간 (26)  |
| $sig$ | 시그널 EMA 기간 (9)  |
| $EMA(n)$ | 지수이동평균  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

> **의존 체인:** OHLCV close → calcEMA(12) → calcEMA(26) → MACD Line →
> calcEMA(9, MACD) → Signal Line → Histogram → 신호 S-3, S-4.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Appel MACD | `js/indicators.js` `calcMACD(closes, fast, slow, sig)` L.993 | 모멘텀 교차 |
| 표준 파라미터 | fast=12, slow=26, sig=9 [A] | Appel 원본 |

**소비자:** 신호 S-3 (MACD 교차), S-4 (MACD 괴리), 복합 신호.

**참조:** 기술적 분석 전통 (제2장 범위 외). Appel (1979).


### I-20: 스토캐스틱 오실레이터 (Stochastic Oscillator)
스토캐스틱 오실레이터는 기술적 분석의 모멘텀 계열로, Lane (1984)
"Lane's Stochastics"에서 창안되었다. 현재 종가의 최근 $k$ 기간
고가-저가 범위 내 상대 위치를 측정하여, 가격이 범위의 상단에서
마감하는 경향(상승 추세)과 하단에서 마감하는 경향(하락 추세)을 포착한다.
$$Raw\ \%K = \frac{Close - LL(k)}{HH(k) - LL(k)} \times 100$$
$$\%K = SMA(Raw\ \%K, smooth), \quad \%D = SMA(\%K, dPeriod)$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{Close, H, L}$ | 종가, 고가, 저가  |
| $k$ | 룩백 기간 (14)  |
| $smooth$ | %K 평활 기간 (3)  |
| $dPeriod$ | %D 기간 (3)  |
| $LL(k)$, $HH(k)$ | 최근 $k$봉 최저가/최고가  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{Close, H, L}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Lane 스토캐스틱 | `js/indicators.js` `calcStochastic(candles, kPeriod, dPeriod, smooth)` L.1028 | 상대 위치 |
| 표준 파라미터 | kPeriod=14, dPeriod=3, smooth=3 [A] | Lane 원본 |

**소비자:** 신호 S-10, 복합 buy_wrStochOversold.

**참조:** 기술적 분석 전통 (제2장 범위 외). Lane (1984).


### I-21: 스토캐스틱 RSI (Stochastic RSI)
스토캐스틱 RSI는 기술적 분석의 복합 오실레이터 계열로, Chande and Kroll
(1994) *The New Technical Trader*에서 창안되었다. RSI에 스토캐스틱 공식을
적용한 것으로, RSI의 과매수/과매도 영역 내에서도 더 세밀한 타이밍 신호를
제공한다. RSI 자체가 0~100 범위로 제한되므로, 이를 스토캐스틱으로 재정규화하면
더 민감한 극단 감지가 가능해진다.
$$StochRSI = \frac{RSI - LL(RSI, n)}{HH(RSI, n) - LL(RSI, n)}$$

| 기호 | 의미  |
|------|------|
| $RSI$ | 상대강도지수 (I-04)  |
| $n$ | 스토캐스틱 기간 (14)  |
| $rsiPeriod$ | RSI 기간 (14)  |
| $kPeriod$, $dPeriod$ | %K, %D 기간 (3, 3)  |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Chande-Kroll | `js/indicators.js` `calcStochRSI(...)` L.1085 | 극단 감지 |
| 표준 파라미터 | rsiPeriod=14, kPeriod=3, dPeriod=3, stochPeriod=14 [A] | Chande-Kroll 원본 |

**소비자:** 신호 S-9 (StochRSI 과매도/과매수), RSI 중립대 보조 타이밍.

**참조:** 제2장 2.7절 (행동재무학 --- 공포/탐욕 극단 감지).


### I-22: CCI (Commodity Channel Index, 상품채널지수)
CCI는 기술적 분석의 편차 기반 오실레이터 계열로, Lambert (1980)
"Commodity Channel Index"에서 창안되었다. 전형가(Typical Price)의
이동평균 대비 편차를 측정하며, 상수 0.015는 CCI 값의 ~70~80%가
-100~+100 사이에 위치하도록 보장한다.
$$TP = \frac{High + Low + Close}{3}, \quad CCI = \frac{TP - SMA(TP, n)}{0.015 \times MeanDev}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{High, Low, Close}$ | 고가, 저가, 종가  |
| $n$ | CCI 기간 (20)  |
| $0.015$ | 정규화 상수  |
| $TP$ | 전형가  |
| $MeanDev$ | 평균편차  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{High, Low, Close}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Lambert CCI | `js/indicators.js` `calcCCI(candles, period)` L.1158 | 편차 오실레이터 |
| 표준 파라미터 | period=20 [A], 0.015 [A] | Lambert 원본 |

**소비자:** 신호 S-13, 복합 buy_cciRsiDoubleOversold.

**참조:** 기술적 분석 전통 (제2장 범위 외). Lambert (1980).


### I-23: ADX / +DI / -DI (Average Directional Index)
ADX는 기술적 분석의 추세 강도 측정 계열로, Wilder (1978)의 방향성 움직임
시스템(Directional Movement System)에서 창안되었다. ADX는 추세의
강도(방향이 아님)를 측정한다. ADX > 25는 강한 추세, ADX < 20은 횡보장을
나타낸다. 추세추종 패턴은 ADX > 20일 때 더 높은 신뢰도를 받는다.
$$ADX = Wilder\_Smooth(DX, n), \quad DX = \frac{|+DI - (-DI)|}{+DI + (-DI)} \times 100$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t}$ | 고가, 저가, 종가  |
| $n$ | ADX 기간 (14)  |
| $+DI$, $-DI$ | 양/음 방향지수  |
| $DX$ | 방향 지수  |
| $ADX$ | 평균 방향 지수  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_t, L_t, C_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder DMS | `js/indicators.js` `calcADX(candles, period)` L.1187 | 추세 강도 |
| 표준 기간 14 | period=14 [A] | Wilder 원본 |

**소비자:** 신호 S-14, 복합 buy_adxGoldenTrend, sell_adxDeadTrend.

**참조:** 기술적 분석 전통 (제2장 범위 외). Wilder (1978).


### I-24: Williams %R
Williams %R은 기술적 분석의 모멘텀 오실레이터 계열로, Williams (1979)
*How I Made One Million Dollars*에서 소개되었다. 범위는
-100(과매도)~0(과매수)이다. 스토캐스틱 오실레이터와 구조적으로 동일하나
스케일이 반전되어 있다.
$$\%R = \frac{HH(n) - Close}{HH(n) - LL(n)} \times (-100)$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{Close, H, L}$ | 종가, 고가, 저가  |
| $n$ | 룩백 기간 (14)  |
| $HH(n)$, $LL(n)$ | 최근 $n$봉 최고가/최저가  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{Close, H, L}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Williams %R | `js/indicators.js` `calcWilliamsR(candles, period)` L.1262 | 과매도/과매수 |
| 표준 기간 14 | period=14 [A] | Williams 원본 |

**소비자:** 신호 S-15 (Williams %R 과매도/과매수), 복합 buy_wrStochOversold, sell_wrStochOverbought.

**참조:** 제2장 2.7절 (행동재무학 --- 모멘텀 오실레이터 심리적 극단).


### I-25: 틸-센 추정량 (Theil-Sen Estimator)
틸-센 추정량은 강건 통계학의 비모수 회귀 분야에서 발전한 중앙값 기울기
추정 기법이다. Theil (1950)과 Sen (1968)이 제안하였다. 29.3%의
붕괴점(breakdown point)으로, 데이터의 29.3%까지 이상치가 존재해도 추정이
파괴되지 않는다. 삼각형, 쐐기형 등의 추세선 적합에서 스파이크 캔들에 의한
OLS 왜곡을 방지한다. 캔들 목표가 교정(ATR 배수)에도 사용된다.
$$slope = \text{median}\left\{\frac{y_j - y_i}{x_j - x_i} : i < j\right\}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{y_i}$ | 가격 관측치 (고가 또는 저가)  |
| $x_i$ | 시간 인덱스  |
| $slope$ | 중앙값 기울기  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{y_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV의 고가 또는 저가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 강건 중앙값 기울기 | `js/indicators.js` `calcTheilSen(xValues, yValues)` L.1287 | 추세선 적합 |
| 조정 상수 없음 | 순수 중앙값 계산 | --- |

**소비자:** 패턴 추세선 적합 (삼각형, 쐐기형, 채널), 캔들 목표가 교정.

**참조:** 제2장 2.3.3절 (강건 회귀 --- Theil 1950, Sen 1968).


### I-26: EWMA 변동성 (Exponentially Weighted Moving Average Volatility)
EWMA 변동성은 금융학/위험 관리 분야의 조건부 변동성 모형이다. J.P. Morgan
RiskMetrics (1996)에서 실무 표준으로 확립되었으며, Bollerslev (1986)의
GARCH(1,1)와 이론적 연결을 갖는다. IGARCH의 특수 경우($\omega=0$,
$\alpha+\beta=1$)이며, 통계역학의 "시장 온도" 개념의 직접적 조작화이다.
$$\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_{t-1}^2$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률  |
| $\sigma_t^2$ | 조건부 분산  |
| $\lambda$ | 감쇠 계수 (0.94)  |
| $\textcolor{stageTwoMarker}{\text{GARCH}}$ | 일반화 조건부 이분산 모형  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다. $\textcolor{stageTwoMarker}{\text{GARCH}}$ 이론 체계는 제2장 2.3절에서 도출된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| RiskMetrics EWMA | `js/indicators.js` `calcEWMAVol(closes, lambda)` L.1336 | 조건부 변동성 |
| 감쇠 계수 | lambda=0.94 [B] | RiskMetrics 일별 기본값 |

**소비자:** 변동성 국면 분류 (I-27), RORO 복합.


### I-27: 변동성 국면 분류 (Volatility Regime Classification)
변동성 국면 분류는 금융학의 국면 전환 이론에 기반한 변동성 비율 분류기이다.
단기 EWMA 변동성과 장기 EWMA의 비율로 현재 시장 국면을 저변동/중변동/고변동으로
분류한다. 국면에 따라 패턴 신뢰도 조정, 전략 선택, 리스크 관리 파라미터가
달라진다.
$$ratio = \sigma_t / longRunEMA, \quad \text{국면} = \begin{cases} \text{'low'} & ratio < 0.75 \\ \text{'high'} & ratio > 1.50 \\ \text{'mid'} & \text{그 외} \end{cases}$$

| 기호 | 의미  |
|------|------|
| $\sigma_t$ | 단기 EWMA 변동성 (I-26)  |
| $longRunEMA$ | 장기 변동성 평활  |
| $0.75$ | 저변동성 경계  |
| $1.50$ | 고변동성 경계  |
| $\alpha$ | 장기 EMA 평활 계수 (0.01)  |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 변동성 비율 분류 | `js/indicators.js` `classifyVolRegime(ewmaVol)` L.1385 | 국면 판별 |
| 경계값 | LOW=0.75 [D], HIGH=1.50 [D], alpha=0.01 [B] | 3-국면 체계 |

**소비자:** 패턴 신뢰도 국면 조정, CUSUM 적응형 임계값, 복합 buy_volRegimeOBVAccumulation.

**참조:** 제2장 2.3.1절 (GARCH/EWMA 변동성), 2.3.7절 (HMM 국면 분류).


### I-28: Amihud 비유동성 (Amihud Illiquidity)
Amihud 비유동성은 시장미시구조 분야의 유동성 측정치이다. Amihud (2002)
"Illiquidity and Stock Returns"에서 제안되었다. 수익률 절대값 대비 거래금액의
비율로, 가격충격(price impact)의 대리변수이다. 높은 비유동성은 가격충격이
크다는 것을 의미하며, 패턴 신뢰도를 할인한다 (미시 요인 M1, 최대 -15%).
$$ILLIQ = \frac{1}{D} \sum_{t=1}^{D} \frac{|r_t|}{DVOL_t}$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률  |
| $\textcolor{stageOneMarker}{DVOL_t}$ | 일별 거래금액  |
| $D$ | 추정 윈도우 (20)  |
| $CONF\_DISCOUNT$ | 신뢰도 할인 하한 (0.85)  |
| $LOG\_HIGH$ | 로그 비유동성 상한 (-1.0)  |
| $LOG\_LOW$ | 로그 비유동성 하한 (-3.0)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_t, DVOL_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 및 거래금액이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Amihud ILLIQ | `js/indicators.js` `calcAmihudILLIQ(candles, window)` L.1430 | 유동성 측정 |
| 미시 요인 M1 | window=20 [B], DISCOUNT=0.85 [C] | 신뢰도 할인 |


### I-29: 온라인 CUSUM (Cumulative Sum Control Chart)
CUSUM은 통계학의 품질관리 및 순차분석 분야에서 발전한 변화점 감지 기법이다.
Page (1954)가 원래 CUSUM 차트를 제안하였으며, Roberts (1966)이 확장하였다.
CheeseStock에서는 변동성 적응형 임계값으로 확장하였다:
고변동성 → h=3.5, 저변동성 → h=1.5.
$$S_t^+ = \max(0, S_{t-1}^+ + r_t - k), \quad S_t^- = \max(0, S_{t-1}^- - r_t - k)$$

$S^+$ 또는 $S^-$가 임계 $h$를 초과하면 구조변화 감지.

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률  |
| $k$ | 여유(slack) 파라미터 (0.5)  |
| $h$ | 결정 임계값 (2.5, 적응형)  |
| $warmup$ | 워밍업 기간 (30)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 적응형 CUSUM | `js/indicators.js` `calcOnlineCUSUM(returns, threshold, volRegime)` L.1493 | 변화점 감지 |
| 변동성 적응 | threshold=2.5 [B], slack=0.5 [B], warmup=30 [B] | 국면별 임계 조정 |

**소비자:** 신호 S-17, 복합 buy_cusumKalmanTurn.


### I-30: 이진 세분화 (Binary Segmentation)
이진 세분화는 통계학의 구조변화 감지 분야에서 발전한 BIC 기반 기법이다.
Bai and Perron (1998)이 다중 구조변화 검정의 이론적 토대를 놓았으며,
탐욕적(greedy) 이진 세분화는 이의 계산 효율적 근사이다. 수익률 시계열의
구조적 변화점(structural break)을 감지하여 국면 분류에 활용한다.
각 분할에서 BIC 감소가 최대인 지점을 선택:

$$BIC = n \cdot \ln(\hat{\sigma}^2) + k \cdot \ln(n)$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률 시계열  |
| $maxBreaks$ | 최대 변화점 수 (3)  |
| $minSegment$ | 최소 세그먼트 길이 (30)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 탐욕적 이진 세분화 | `js/indicators.js` `calcBinarySegmentation(returns, maxBreaks, minSegment)` L.1586 | 변화점 감지 |
| BIC 기반 | maxBreaks=3 [B], minSegment=30 [B] | 구조변화 검정 |

**소비자:** 신호 레짐 전환 할인 (`_applyBinSegDiscount`), 국면 방향 판별.

**참조:** 제2장 2.3.6절 (변화점 감지 --- CUSUM과 이진 세분화).


### I-31: HAR-RV (Heterogeneous Autoregressive Realized Volatility)
HAR-RV는 금융학의 변동성 예측 분야에서 발전한 이질적 시장 가설에 기반한
모형이다. Corsi (2009)가 제안하였다. 시장참여자의 이질적 시간
지평(일/주/월)에서 발생하는 다중척도 변동성 동역학을 포착한다.
$$HAR\text{-}RV = \beta_0 + \beta_1 RV_d + \beta_2 RV_w + \beta_3 RV_m$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{OHLCV}$ | 가격 시계열  |
| $RV_d$ | 일별 실현 변동성  |
| $RV_w$ | 주간 실현 변동성 (5일 평균)  |
| $RV_m$ | 월간 실현 변동성 (21일 평균)  |
| $M$ | KRX 월간 윈도우 (21)  |
| $\beta_0, \beta_1, \beta_2, \beta_3$ | HAR 계수  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{OHLCV}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 가격 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Corsi HAR-RV | `js/indicators.js` `calcHAR_RV(candles)` via `IndicatorCache.harRV(idx)` L.2213 | 다중척도 변동성 |
| KRX 월간 | $M = 21$ 거래일 | KRX 관례 |

**소비자:** 다중척도 변동성 예측, EWMA 변동성 (I-26) 보완 (장기 변동성 구조).

**참조:** 제2장 2.3.4절 (HAR-RV 변동성 예측 --- Corsi 2009).

---

\newpage

## Sheet 2: 3.2.1 캔들스틱 패턴 이론

### 3.2.1 일본 캔들스틱 전통 (Nison 1991, Morris 2006, Bulkowski 2008)
`js/patterns.js`에 구현된 21개 이상의 캔들스틱 패턴은 일본 쌀 거래
전통에서 기원한다. 혼마 무네히사(Homma Munehisa, 18세기)가 오사카 도지마
미곡 거래소에서 발전시킨 캔들 차트 기법이 현대 기술적 분석의 기초가 되었으며,
다음의 저서에 의해 체계화되었다.

- **Nison (1991)** *Japanese Candlestick Charting Techniques* --- 캔들스틱 분석을
  서양 시장에 도입한 기념비적 영문 저서. 패턴의 심리학적 해석 체계 확립.
- **Morris (2006)** *Candlestick Charting Explained* --- 추가 패턴 상세 및
  확인 규칙(confirmation rules) 정교화.
- **Bulkowski (2008)** *Encyclopedia of Candlestick Charts* --- 20년 이상
  미국 주식 데이터에 대한 경험적 성과 통계 (승률, 기대 수익률).

모든 임계값은 ATR 정규화된다 (Wilder 1978): `actual_threshold = constant * ATR(14)`.
이로써 가격 수준 독립성이 보장된다.

*승률 데이터: KOSPI+KOSDAQ 2,704종목, 2020--2025, n=545,307건.*
$$threshold_{actual} = constant \times ATR(14)$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t}$ | 시가, 고가, 저가, 종가  |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량  |
| $ATR(14)$ | 평균진폭 (I-05)  |
| $body$ | 실체 크기 $= |C_t - O_t|$  |
| $range$ | 캔들 범위 $= H_t - L_t$  |
| $upperShadow$ | 윗그림자  |
| $lowerShadow$ | 아래그림자  |
| $DOJI\_BODY\_RATIO$ | 도지 실체 비율 (0.05)  |
| $SHADOW\_BODY\_MIN$ | 그림자/실체 최소 비율 (2.0)  |
| $MARUBOZU\_BODY\_RATIO$ | 마루보즈 실체 비율 (0.85)  |
| $SPECIAL\_DOJI\_SHADOW\_MIN$ | 특수 도지 그림자 비율 (0.70)  |
| $ENGULF\_BODY\_MULT$ | 장악형 실체 배수 (1.5)  |
| $HARAMI\_CURR\_BODY\_MAX$ | 잉태형 현재 실체 상한 (0.5)  |
| $PIERCING\_BODY\_MIN$ | 관통형 실체 하한 (0.3)  |
| $THREE\_SOLDIER\_BODY\_MIN$ | 적삼병 실체 하한 (0.5)  |
| $STAR\_BODY\_MAX$ | 별형 실체 상한 (0.12)  |
| $PROSPECT\_STOP\_WIDEN$ | 전망이론 손절 확대 (1.12)  |
| $PROSPECT\_TARGET\_COMPRESS$ | 전망이론 목표 압축 (0.89)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t, V_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

> **전망이론 통합 (제2장 2.7절):** 손절매는 $PROSPECT\_STOP\_WIDEN = 1.12$
> (Kahneman-Tversky 1979, 손실회피 $\lambda=2.25$)로 확대하고, 목표가는
> $PROSPECT\_TARGET\_COMPRESS = 0.89$ (민감도 체감)로 압축한다. 이는 투자자의
> 비대칭적 손실회피 행태를 반영한 교정이다.

#### 단봉 패턴 (9종)

| 패턴 | 학술 근거 | 핵심 임계값 | ATR 역할 | KRX 5년 승률 |
|------|-----------|-------------|----------|-------------|
| 도지 (P-1) | Nison (1991) | DOJI_BODY_RATIO=0.05 [A] | 범위 유의성 | 42.0% |
| 해머 (P-2) | Morris (2006) | SHADOW_BODY_MIN=2.0 [A] | ATR 정규화 | 45.2% |
| 역해머 (P-3) | Morris (2006) | 동일 | 동일 | 48.9% |
| 교수형 (P-4) | Nison (1991) | 동일 + 추세 맥락 | 동일 | 59.4% |
| 유성 (P-5) | Morris (2006) | 동일 + 추세 | 동일 | 59.2% |
| 잠자리형 도지 (P-6) | Nison (1991) | SPECIAL_DOJI_SHADOW_MIN=0.70 [B] | 동일 | 45.0% |
| 비석형 도지 (P-7) | Nison (1991) | 동일 | 동일 | 62.0% |
| 강세 마루보즈 (P-8) | Nison (1991) | MARUBOZU_BODY_RATIO=0.85 [A] | 동일 | 41.8% |
| 약세 마루보즈 (P-9) | 동일 | 동일 | 동일 | 57.7% |

#### 쌍봉 패턴 (6종)

| 패턴 | 학술 근거 | 핵심 상수 | KRX 5년 승률 |
|------|-----------|-----------|-------------|
| 강세 장악형 (P-10) | Nison (1991) | ENGULF_BODY_MULT=1.5 [C] | 41.3% |
| 약세 장악형 (P-11) | 동일 | 동일 | 57.2% |
| 강세 잉태형 (P-12) | Nison (1991) | HARAMI_CURR_BODY_MAX=0.5 [B] | 44.1% |
| 약세 잉태형 (P-13) | 동일 | 동일 | 58.7% |
| 관통형 (P-14) | Nison (1991) | PIERCING_BODY_MIN=0.3 [B] | 50.2% |
| 먹구름형 (P-15) | Nison (1991) | 동일 | 58.5% |

#### 삼봉 패턴 (4종 이상)

| 패턴 | 학술 근거 | 핵심 상수 | KRX 5년 승률 |
|------|-----------|-----------|-------------|
| 적삼병 (P-16) | Nison (1991) | THREE_SOLDIER_BODY_MIN=0.5 [B] | 47.6% |
| 흑삼병 (P-17) | 동일 | 동일 | 57.5% |
| 샛별형 (P-18) | Nison (1991) | STAR_BODY_MAX=0.12 [A] | 40.5% |
| 저녁별형 (P-19) | 동일 | 동일 | 56.7% |

**KRX 경험적 발견**: 매도 패턴이 매수 패턴을 승률에서 10~15%p 지속적으로
상회한다. 이 매도 편향은 전망이론의 손실회피(제2장 2.7절) 및 KRX 구조적
특징(T+2 결제, 가격제한폭, 개인투자자 주도 거래)과 부합한다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 21종 캔들 감지 | `js/patterns.js` `_detectSingleCandle()`, `_detectDoubleCandle()`, `_detectTripleCandle()` | 패턴 엔진 |
| ATR 정규화 | `PatternEngine._getATR()` | 임계값 보정 |
| 전망이론 교정 | PROSPECT_STOP_WIDEN=1.12, PROSPECT_TARGET_COMPRESS=0.89 | 손절/목표 조정 |
| 품질 점수 | `_calcCandleQuality()` PCA 가중 | 신뢰도 산출 |

---

\newpage

## Sheet 3: 3.2.2 차트 패턴 이론

### 3.2.2 서양 차트 패턴 이론 (Edwards-Magee 1948, Bulkowski 2005)
9개 이상의 차트 패턴은 서양 기술적 분석의 두 기념비적 저서로부터 도출된다.

- **Edwards and Magee (1948)** *Technical Analysis of Stock Trends* --- 원래의 차트
  패턴 분류. 이중바닥/천장, 삼각형, 지지/저항의 원형적 정의.
- **Bulkowski (2005)** *Encyclopedia of Chart Patterns* --- 20년 이상 데이터의
  경험적 성과 통계. 패턴별 성공률, 측정 이동(measured move) 검증.

차트 패턴은 수십~수백 봉에 걸쳐 형성되는 거시적 가격 구조물이다. 캔들스틱
패턴이 시장 심리의 순간적 포착이라면, 차트 패턴은 수급의 구조적 전환을
포착한다. 형성 과정에서의 거래량 변화가 확인 요소로서 핵심적이다.

**3.2.3 다우 이론: 지지와 저항** (Dow, Hamilton 1922, Rhea 1932)

가격은 이전에 유의했던 가격 수준에서 지지(매수 관심)와 저항(매도 관심)을
형성하는 경향이 있다. George and Hwang (2004)은 52주 신고가 근접성이
모멘텀 수익률의 70%를 앵커링 편향을 통해 설명한다는 것을 보였다.
$$target = breakout\_price \pm pattern\_height$$

상한 제한:
$$|target - entry| \leq CHART\_TARGET\_ATR\_CAP \times ATR(14)$$
$$|target - entry| / entry \leq CHART\_TARGET\_RAW\_CAP$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t}$ | 고가, 저가, 종가  |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량  |
| $ATR(14)$ | 평균진폭 (I-05)  |
| $pattern\_height$ | 패턴 높이 (피크-트로프)  |
| $breakout\_price$ | 돌파 가격 (넥라인)  |
| $neckline$ | 넥라인 수준  |
| $NECKLINE\_BREAK\_ATR\_MULT$ | 넥라인 돌파 ATR 배수 (0.5)  |
| $TRIANGLE\_BREAK\_ATR\_MULT$ | 삼각형 돌파 ATR 배수 (0.3)  |
| $HS\_WINDOW$ | H&S 탐색 윈도우 (120)  |
| $HS\_SHOULDER\_TOLERANCE$ | H&S 어깨 허용오차 (0.15)  |
| $NECKLINE\_UNCONFIRMED\_PENALTY$ | 미확인 패턴 감산 (15)  |
| $CHART\_TARGET\_ATR\_CAP$ | 목표가 ATR 상한 (6)  |
| $CHART\_TARGET\_RAW\_CAP$ | 목표가 비율 상한 (2.0)  |
| $SR\_tolerance$ | S/R 클러스터링 허용오차  |
| $SR\_strength$ | 접촉 강도  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{H_t, L_t, C_t, V_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

#### 차트 패턴 목록 (9종)

| 패턴 | 학술 근거 | 감지 방법 | 핵심 상수 |
|------|-----------|-----------|-----------|
| 이중바닥 (P-20) | Edwards-Magee (1948) | 두 스윙 저점 + 넥라인 돌파 | NECKLINE_BREAK_ATR_MULT=0.5 [B] |
| 이중천장 (P-21) | 동일 | 두 스윙 고점 + 넥라인 돌파 | 동일 |
| 머리어깨 (P-22) | Bulkowski (2005) | 좌측 어깨 + 머리 + 우측 어깨 | HS_WINDOW=120 [C], HS_SHOULDER_TOLERANCE=0.15 [B] |
| 역머리어깨 (P-23) | 동일 (반전) | 동일 (반전) | 동일 |
| 상승삼각형 (P-24) | Edwards-Magee (1948) | 수평 저항 + 상승 지지 | TRIANGLE_BREAK_ATR_MULT=0.3 [B] |
| 하강삼각형 (P-25) | 동일 | 수평 지지 + 하락 저항 | 동일 |
| 대칭삼각형 (P-26) | 동일 | 수렴 추세선 | 동일 |
| 상승쐐기 (P-27) | Bulkowski (2005) | 수렴 상향 추세선 | 동일 |
| 하락쐐기 (P-28) | 동일 | 수렴 하향 추세선 | 동일 |

**돌파 확인**: Bulkowski (2005)는 확인된 머리어깨 패턴의 성공률이 83%인 반면,
미확인 패턴은 35%에 불과하다고 문서화하였다. CheeseStock는 미확인 패턴에
$NECKLINE\_UNCONFIRMED\_PENALTY = 15$ [B]를 적용한다.

**목표가 산출**: 차트 패턴 목표가는 측정 이동(measured move) 방법을 사용한다:
$target = breakout\_price \pm pattern\_height$. 상한은 다음으로 제한된다.
- $CHART\_TARGET\_ATR\_CAP = 6$ [B] --- EVT 99.5% VaR 경계 (Doc 12)
- $CHART\_TARGET\_RAW\_CAP = 2.0$ [B] --- Bulkowski P80

#### 지지와 저항 (S/R)

1. **가격 클러스터링**: ATR*0.5 허용오차, 최소 2회 접촉, 최대 10 수준
2. **접촉 강도**: 더 많은 접촉 → 높은 강도 (0~1.0 척도)
3. **합류(confluence)**: 패턴 손절/목표가 지지/저항의 ATR 이내 →
   신뢰도 +3*strength

**밸류에이션 지지/저항**: 기본적 분석 밸류에이션 임계(PER/PBR 기반 목표가)가
행동적 앵커로 작용. 강도 = 0.6, 범위 = +/-30% (KRX 일일 가격제한폭 일치).

**52주 신고/신저 지지/저항** (George-Hwang 2004): 강도 = 0.8, 가상 접촉 = 3.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 9종 차트 패턴 감지 | `js/patterns.js` `_detectDoubleBottom()`, `_detectDoubleTop()`, `_detectHS()`, `_detectInvHS()`, `_detectTriangle()`, `_detectWedge()` | 패턴 엔진 |
| 측정 이동 목표가 | `_doubleBottom_target()`, `_hs_target()`, `_triangle_target()` 등 | 목표가 산출 |
| S/R 클러스터링 | `_detectSR()` | 지지/저항 수준 |
| 밸류에이션 S/R | PER/PBR 기반 | 행동적 앵커 |
| 52주 S/R | George-Hwang (2004) | 앵커링 편향 |

---

\newpage

## Sheet 4: 3.2.4 패턴 감지의 수학적 기법

### 3.2.4 패턴 감지 수학 (ATR 정규화, 틸-센, 품질 점수, 베타-이항, AMH)
패턴 감지 시스템의 수학적 기반은 다섯 가지 핵심 기법으로 구성된다.
(1) ATR 정규화를 통한 가격 수준 독립성, (2) 틸-센 강건 추세선 적합,
(3) PCA 가중 품질 점수, (4) 베타-이항 사후 승률 추정, (5) AMH 시간 감쇠.
이들은 각각 독립적 학술 기반을 가지면서도 패턴 엔진 내에서 유기적으로
통합되어 작동한다.

#### ATR 정규화 (Wilder 1978)

모든 임계값이 ATR(14) 배수로 표현된다.
폴백: $close \times 0.02$ (KRX 대형주 중앙값 일별 ATR/종가 비율).

#### 틸-센 추세선 적합 (Theil 1950, Sen 1968)

이상치 캔들에 대한 붕괴점 저항으로, 차트 패턴 추세선 적합(삼각형, 쐐기, 채널)에 사용.

#### 품질 점수 PCA 가중 (V6-FIX 교정)
$$Q = 0.30 \times body + 0.22 \times volume + 0.21 \times trend + 0.15 \times shadow + 0.12 \times extra$$

#### 베타-이항 사후 승률 (Efron-Morris 1975)
$$\theta_{\text{post}} = \frac{n \cdot \theta_{\text{raw}} + N_0 \cdot \mu_{\text{grand}}}{n + N_0}$$

#### AMH 시간 감쇠 (Lo 2004, McLean-Pontiff 2016)
$$decay = \exp(-\lambda \cdot daysSince)$$

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{OHLCV}$ | 가격/거래량 시계열  |
| $ATR(14)$ | 평균진폭 (I-05)  |
| $0.02$ | ATR 폴백 비율  |
| $Q$ | 품질 점수  |
| $0.30$ | body 가중치 (PC1)  |
| $0.22$ | volume 가중치  |
| $0.21$ | trend 가중치  |
| $0.15$ | shadow 가중치  |
| $0.12$ | extra 가중치  |
| $\theta_{\text{post}}$ | 사후 승률  |
| $\theta_{\text{raw}}$ | 원시 승률  |
| $\mu_{\text{grand}}$ | 총평균 승률  |
| $N_0$ | 경험적 베이즈 사전 강도 (35)  |
| $n$ | 해당 패턴 관측 수  |
| $\textcolor{stageTwoMarker}{\lambda_{\text{KOSDAQ}}}$ | KOSDAQ 감쇠율 (0.00367)  |
| $\textcolor{stageTwoMarker}{\lambda_{\text{KOSPI}}}$ | KOSPI 감쇠율 (0.00183)  |
| $daysSince$ | 패턴 감지 후 경과일  |
| $decay$ | 시간 감쇠 배수  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{OHLCV}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 가격/거래량 시계열이다. $\textcolor{stageTwoMarker}{\lambda}$ 감쇠율은 제2장의 적응적 시장 가설(Adaptive Market Hypothesis, Lo 2004)에서 도출된 시장별 알파 반감기이다.

> **학문 분류:** 품질 점수의 가중치는 PCA 분산설명 + KRX 데이터에 대한 로지스틱 회귀에서 도출되었다. Nison (1991)은 "실체(real body)가 가장 중요한 요소"라 하였으며, body = PC1 최대 적재로 이를 통계적으로 확인하였다.

> **시장별 감쇠 차이:** KOSDAQ 반감기 189일, KOSPI 반감기 378일. McLean-Pontiff (2016)이 보인 바와 같이 소형주 시장에서 알파 감쇠가 더 빠르다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| ATR 정규화 | `PatternEngine._getATR()`, 폴백 0.02 [C] | 모든 패턴 임계값 |
| 틸-센 적합 | `calcTheilSen()` (I-25) | 삼각형/쐐기 추세선 |
| PCA 품질 점수 | `_calcCandleQuality()` | 패턴 신뢰도 산출 |
| 베타-이항 축소 | `_betaBinomialPosterior()` | 사후 승률 추정 |
| AMH 감쇠 | `_applyAMHDecay()` | 시간 경과 신뢰도 조정 |
| 시장별 람다 | KOSDAQ=0.00367, KOSPI=0.00183 | 시장 구조 반영 |

<!-- [V22-V25 SYNC] -->

#### PCA 효과량 예산 (Longin--Solnik 2001 + Kish 1965, V23)

패턴 신뢰도 체인이 다수의 **독립** 요인(거시 F1\~F9, 미시 M1\~M3, 파생 D1\~D3, Merton, RORO)을 순차적으로 승법 결합할 때, 각 요인이 무상관이라는 가정은 극단 구간에서 체계적으로 위반된다. Longin and Solnik (2001)은 국제 주식시장 월별 데이터에서 하락 극단(1% 분위)의 상관계수가 정상 구간의 두 배 이상으로 치솟음을 보였고 (asymmetric extreme correlation), 이는 하락장에서 여러 팩터가 한 방향으로 함께 움직여 **과대 감산**을 야기함을 의미한다.

V23은 KRX 2018--2024 월별 데이터에서 추정한 4×4 요인 상관행렬 $\Sigma_F$ (VOL--CREDIT $= 0.72$, VOL--FX $= 0.65$, CREDIT--FX $= 0.58$, FLOW는 역부호)를 `_FACTOR_CORR` 상수로 고정하고, Kish (1965)의 유효표본크기 공식을 변환하여 동시발동 요인의 **실효 자유도** $N_{\text{eff}}$를 산출한다.

$$N_{\text{eff}} = \frac{\left(\sum_{i} \lambda_i\right)^2}{\sum_{i} \lambda_i^2}, \qquad \lambda_i = \text{eig}(\Sigma_F)_i$$

비대칭 예산은 Longin--Solnik의 하락장 상관 급등을 반영하여 상·하방을 비대칭으로 설정한다.

$$\text{DownsideFloor} = \exp\!\left(-0.10 \sqrt{N_{\text{eff}}}\right), \qquad \text{UpsideCeiling} = \exp\!\left(+0.12 \sqrt{N_{\text{eff}}}\right)$$

예: VOL + CREDIT + FX 3개 요인이 동시 발동하여 $\Sigma_F$의 고유값이 $(2.3,\, 0.9,\, 0.8)$일 때 $N_{\text{eff}} \approx 1.3$, 하한 floor $= 0.892$ (기존 독립 가정 하의 0.795 대비 $+12$\%p 완화)에 해당한다. `_applyPCABudgetCap()`가 Worker result, fallback, drag의 3개 신뢰도 체인에 모두 적용되며, 이로써 기존 9-Layer 신뢰도 체인(V22-B 이전)은 **10-Layer**로 확장된다 (§3.4.1 참조).

| 기호 | 의미 |
|------|------|
| $\Sigma_F$ | 4×4 요인 상관행렬 (KRX 2018--2024) |
| $\lambda_i$ | $\Sigma_F$의 $i$-번째 고유값 |
| $N_{\text{eff}}$ | Kish 유효표본크기 |
| $\textcolor{stageTwoMarker}{\text{Longin-Solnik}}$ | 극단상관 비대칭성 이론 (2001) |
| $\textcolor{stageTwoMarker}{\text{Kish}}$ | 유효표본크기 공식 (1965) |

***

### 3.3.1 신호 체계 (Signal System)
기술적 지표의 수학적 출력은 그 자체로는 매매 의사결정에 직접 사용될 수 없다.
RSI가 28을 기록하거나 MACD 히스토그램이 음에서 양으로 전환되는 것은 숫자에 불과하다.
이를 '매수', '매도', '중립'이라는 이산적 행동 신호(discrete action signal)로 변환하는
규칙 체계가 필요하며, 이 변환 과정에서 각 임계값의 학술적 정당성이 확보되어야 한다.
본 절은 CheeseStock 시스템이 20개 이상의 기술적 지표와 11개 파생상품/교차자산
데이터 원천으로부터 총 31개의 독립 신호를 도출하고, 이를 다시 31개의 복합 신호로
결합하는 전체 신호 계보(signal genealogy)를 기술한다.

개별 신호에서 복합 신호로의 결합은 다중 출처 확인(multi-source confirmation)의
원칙에 기반한다. Murphy (1999, Ch.1)는 "단일 지표만으로는 시장의 복잡성을 포착할 수
없으며, 서로 다른 지표군(추세, 오실레이터, 거래량)의 동시 확인이 신호의 신뢰도를
기하급수적으로 증가시킨다"고 강조하였다. Pring (2002)은 이를 '무게 증거(weight of
evidence)' 접근법으로 체계화하였으며, 독립적 지표 2개가 동일 방향을 확인할 때
위양성(false positive) 확률이 개별 지표 대비 제곱에 비례하여 감소함을 실증하였다.

본 시스템의 신호 체계는 3-Tier 구조를 취한다. Tier 1 복합(10개)은 3개 이상의 독립
조건이 동시 충족되는 가장 강한 확인 수준이며, Tier 2 복합(17개)은 2개 조건의 보통
수준 확인, Tier 3 복합(4개)은 단일 핵심 조건에 보조 확인이 붙는 약한 수준이다.
모든 복합 신호는 window=$W$=5봉(KRX 1거래주) 이내의 동시 발생(coincidence)을
요구하며, 이는 Nison (1991)의 "수 봉 내 확인" 원칙과 KRX 거래 주기에 부합한다.
개별 신호는 각 지표의 임계값 규칙에 따라 이산적으로 발생한다. 대표적 변환 규칙은
다음과 같다.

$$s_{\text{RSI}}(t) = \begin{cases} \text{buy} & \text{if } \text{RSI}(t-1) < 30 \text{ and } \text{RSI}(t) \geq 30 \\ \text{sell} & \text{if } \text{RSI}(t-1) > 70 \text{ and } \text{RSI}(t) \leq 70 \\ \text{inactive} & \text{otherwise} \end{cases}$$

복합 신호는 윈도우 내 동시 발생 방식으로 다수의 개별 신호를 결합한다. $n$개의
필수(required) 조건 $\{s_1, s_2, \ldots, s_n\}$과 $m$개의 선택(optional) 조건
$\{o_1, o_2, \ldots, o_m\}$에 대해:

$$\text{Composite}(t) = \begin{cases} \text{active} & \text{if } \forall\, s_i,\; \exists\, t_i \in [t - W,\, t + W] \text{ s.t. } s_i(t_i) = \text{active} \\ \text{inactive} & \text{otherwise} \end{cases}$$

활성화된 복합 신호의 기본 신뢰도(base confidence)에 선택 조건 보너스가 가산된다:

$$C_{\text{composite}} = C_{\text{base}} + \sum_{j=1}^{m} \mathbb{1}[o_j \text{ active in } W] \cdot \Delta_{\text{opt}}$$

여기서 $\Delta_{\text{opt}}$는 각 복합 정의의 `optionalBonus` 값(3--5)이다.

| 기호 | 의미  |
|------|------|
| $s_i(t)$ | 개별 신호 $i$의 시점 $t$ 상태  |
| $W$ | 동시발생 윈도우  |
| $C_{\text{base}}$ | 복합 신호 기본 신뢰도  |
| $\Delta_{\text{opt}}$ | 선택 조건 보너스  |
| $\textcolor{stageOneMarker}{P_{\text{close}}}$ | 종가  |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량  |
| $\textcolor{stageOneMarker}{\text{VKOSPI}}$ | 변동성 지수  |
| $\textcolor{stageOneMarker}{\text{투자자수급}}$ | 외국인/기관 순매수  |
| $\textcolor{stageTwoMarker}{\text{RSI}(n)}$ | 상대강도지수  |
| $\textcolor{stageTwoMarker}{\text{MACD}}$ | 이동평균 수렴확산  |
| $\textcolor{stageTwoMarker}{\text{BB}(\mu,\sigma)}$ | 볼린저 밴드  |
| $\textcolor{stageTwoMarker}{H}$ | 허스트 지수  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{P_{\text{close}}}$, $\textcolor{stageOneMarker}{V_t}$, $\textcolor{stageOneMarker}{\text{VKOSPI}}$, $\textcolor{stageOneMarker}{\text{투자자수급}}$ 등은 Stage 1(Ch1) 데이터 계층에서 수집된 원시 시계열이다. $\textcolor{stageTwoMarker}{\text{RSI}}$, $\textcolor{stageTwoMarker}{\text{MACD}}$, $\textcolor{stageTwoMarker}{\text{BB}}$, $\textcolor{stageTwoMarker}{H}$ 등은 Stage 2(Ch2) 이론 계층에서 정의된 수학적 지표 산출 함수이다. 본 Stage에서는 이 지표 출력을 이산 신호로 변환하고, 복합 신호로 결합한다.

---

#### 추세 신호

| 신호 ID | 명칭 | 지표 | 규칙 | 학술 근거 |
|---------|------|------|------|-----------|
| S-1 | 이동평균 교차 | MA(5), MA(20) | MA(5)가 MA(20)을 교차 | Murphy (1999) Ch.9 |
| S-2 | 이동평균 정렬 | MA(5/20/60) | MA5>MA20>MA60 또는 역순 | 다중 이동평균 확인 |
| S-3 | MACD 교차 | MACD, 시그널 | MACD가 시그널을 교차 | Appel (1979) |
| S-4 | MACD 괴리 | MACD, 가격 | 가격 신고가 + MACD 낮은 고점 | Murphy (1999) Ch.10 |
| S-8 | 일목 신호 | 구름, TK | 가격 구름 돌파; TK 교차 | Hosoda (1969) 삼역호전/역전 |
| S-14 | ADX 교차 | +DI, -DI, ADX | ADX>20일 때 +DI가 -DI 교차 | Wilder (1978) |
| S-17 | CUSUM 이탈 | 수익률 | CUSUM이 적응형 임계 초과 | Page (1954), Roberts (1966) |
| S-18 | 변동성 국면 전환 | EWMA 변동성 | 국면 전이 감지 | RiskMetrics (1996) |

#### 오실레이터 신호

| 신호 ID | 명칭 | 지표 | 규칙 | 학술 근거 |
|---------|------|------|------|-----------|
| S-5 | RSI 영역 | RSI(14) | RSI <30 이탈(매수) 또는 >70(매도) | Wilder (1978) |
| S-6 | RSI 괴리 | RSI, 가격 | 가격-RSI 괴리 | Murphy (1999) |
| S-9 | StochRSI | StochRSI(14) | K가 과매도/과매수 이탈 | Chande-Kroll (1994) |
| S-10 | 스토캐스틱 | %K, %D | 극단에서 %K가 %D 교차 | Lane (1984) |
| S-13 | CCI 이탈 | CCI(20) | CCI <-100 이탈(매수) 또는 >100 | Lambert (1980) |
| S-15 | Williams %R | %R(14) | %R < -80 (과매도) | Williams (1979) |

#### 변동성 및 거래량 신호

| 신호 ID | 명칭 | 지표 | 규칙 | 학술 근거 |
|---------|------|------|------|-----------|
| S-7 | BB 신호 | BB(20,2) | 하단 반등 / 상단 돌파 / 스퀴즈 | Bollinger (2001) |
| S-11 | 허스트 국면 | Hurst(R/S) | H>0.6 추세, H<0.4 평균회귀 | Mandelbrot (1963), Peters (1994) |
| S-12 | 칼만 전환 | 칼만 필터 | 기울기 방향 전환 | Kalman (1960) |
| S-16 | ATR 확장 | ATR(14) | ATR 비율 > 1.5 vs 20봉 EMA | Wilder (1978) |
| S-19 | 거래량 돌파 | 거래량, MA(20) | Volume/MA > 임계 | Granville (1963) |
| S-20 | OBV 괴리 | OBV, 가격 | 가격-OBV 괴리 | Granville (1963), Murphy (1999) |

#### 파생상품 및 교차자산 신호

| 신호 ID | 명칭 | 트리거 조건 | 신뢰도 | 학술 근거 |
|---------|------|-----------|--------|-----------|
| S-21 | 베이시스 | 베이시스율 절대값 > 0.5% (보통), > 2.0% (극단) | 55--72 | Working (1949) |
| S-22 | PCR 역발상 | PCR > 1.2 (공포 $\to$ 매수), < 0.6 (탐욕 $\to$ 매도) | 62 | Pan-Poteshman (2006) |
| S-23 | 수급 정렬 | 매수/매도 정렬 + 외국인 순매수 ±5000억 | 58--68 | Choe-Kho-Stulz (2005) |
| S-24 | ETF 심리 | 강세 심리 + 레버리지 비율 > 3.0 $\to$ 역발상 매도 | 55 | Cheng-Madhavan (2009) |
| S-25 | 공매도 비율 | 시장 공매도 비율 > 8% $\to$ 숏커버 랠리 (매수) | 56--63 | Desai et al. (2002) |
| S-26 | ERP | ERP = $(1/\text{PER}) \times 100 - \text{KTB10Y}$; > 5.5% $\to$ 매수 | 60 | Fed 모형, Asness (2003) |
| S-27 | VKOSPI 국면 | > 30 위기(0.60$\times$), 22--30 고위(0.80$\times$) | 할인 배수 | Whaley (2009) |
| S-28 | HMM 레짐 | 강세/약세/횡보 + 외국인 모멘텀 | Phase8 적용 | Hamilton (1989) |
| S-29 | CUSUM 변화점 | 최근 20봉 내 변화점 감지 | 52 | Page (1954) |
| S-30 | 이진 세분화 | 역추세 신호 할인 (0.85$\times$) | 할인 배수 | Bai-Perron (1998) |
| S-31 | HAR-RV | **지표만 구현, 신호 미구현** | N/A | Corsi (2009) |

> **데이터 흐름 주의사항:**
> - S-29, S-30, S-31은 외부 데이터 파일을 사용하지 않고 $\textcolor{stageOneMarker}{\text{OHLCV}}$ 캔들에서 직접 산출된다.
> - S-21의 베이시스 데이터는 파생상품 요약(`derivatives_summary.json`)과 베이시스 분석(`basis_analysis.json`) 두 데이터 원천에서 병합된다.
> - 표본 데이터(`source == "sample"`)인 경우 투자자 수급 및 공매도 데이터를 분석에서 제외한다. 오류 상태(`status == "error"`)인 경우 옵션 분석 데이터를 폐기한다.
> - **V24 이후 활성화:** S-17 (`cusumBreak`), S-29 (CUSUM 변화점), 그리고 Tier 2 복합 `buy_cusumKalmanTurn` / `sell_cusumKalmanTurn`는 V24 세션에서 `signalEngine._detectCUSUMBreak()`의 메서드명·`breakpoint.index` 접근 TypeError가 수정되기 전까지 실제로는 발화하지 않았다.[^cusum-v24] V25-B는 이 경로에 off-by-one 인덱스 교정, `volRegime` passthrough, 방향 전파의 3개 추가 정합성 수정을 가하여 고변동성 국면에서 $h = 3.5$ 적응형 임계값이 정상 작동하도록 하였다 (§2.3.6).

---

#### Tier 1 복합 (10개 정의 --- 가장 강한 확인)

Tier 1은 3개 이상의 독립적 조건(캔들 패턴 + 지표 신호 + 거래량/추세 확인)이
동시에 충족되는 최고 신뢰 수준의 복합 신호군이다. 각 복합의 기본 신뢰도는
KRX 5개년 실증 승률(Win Rate)에 조건부 배수를 적용하여 교정(calibration)한
값이며, 학술적 연결 고리는 두 개 이상의 독립 학파에서 비롯된다.

| ID | 구성 요소 | 학술적 연결 고리 | 기본 신뢰도 |
|----|-----------|------------------|-------------|
| strongBuy\_hammerRsiVolume | 해머 + RSI 과매도 이탈 | Nison (1991) + Wilder (1978) | 61 |
| strongSell\_shootingMacdVol | 유성 + MACD 약세 | Nison (1991) + Appel (1979) | 69 |
| buy\_doubleBottomNeckVol | 이중바닥 + 거래량 돌파 | Edwards-Magee (1948) + Granville (1963) | 68 |
| sell\_doubleTopNeckVol | 이중천장 + 거래량 매도 | Edwards-Magee (1948) | 75 |
| buy\_ichimokuTriple | 구름 돌파 + TK 교차 | Hosoda (1969) 삼역호전 | 60 |
| sell\_ichimokuTriple | 구름 하향 + TK 교차 | Hosoda (1969) 삼역역전 | 60 |
| buy\_goldenMarubozuVol | 골든크로스 + 마루보즈 | Murphy (1999) + Nison (1991) | 65 |
| sell\_deadMarubozuVol | 데드크로스 + 마루보즈 | Murphy (1999) + Nison (1991) | 68 |
| buy\_adxGoldenTrend | 골든크로스 + ADX 강세 | Murphy (1999) + Wilder (1978) | 67 |
| sell\_adxDeadTrend | 데드크로스 + ADX 약세 | Murphy (1999) + Wilder (1978) | 67 |

#### Tier 2 복합 (17개 정의 --- 보통 수준 확인)

Tier 2는 2개의 필수 조건이 윈도우 내에서 동시 충족되는 중간 신뢰 수준의
복합 신호군이다. 패턴+지표, 오실레이터+오실레이터, 교차자산+수급 등 다양한
조합 방식이 포함되며, 캘리브레이션 기반 신뢰도 또는 이론 추정치를 사용한다.

| ID | 구성 요소 | 학술적 연결 고리 |
|----|-----------|------------------|
| buy\_goldenCrossRsi | 골든크로스 + RSI 과매도 | Murphy (1999) + Wilder (1978) |
| sell\_deadCrossMacd | 데드크로스 + MACD 약세 | Murphy (1999) + Appel (1979) |
| buy\_hammerBBVol | 해머 + BB 하단 반등 | Nison + Bollinger |
| sell\_shootingStarBBVol | 유성 + BB 상단 돌파 | Nison + Bollinger |
| buy\_morningStarRsiVol | 샛별 + RSI 과매도 | Nison + Wilder |
| sell\_eveningStarRsiVol | 석별 + RSI 과매수 | Nison + Wilder |
| buy\_engulfingMacdAlign | 장악형 + MACD 교차 | Nison + Appel |
| sell\_engulfingMacdAlign | 역장악형 + MACD 약세 | Nison + Appel |
| buy\_cciRsiDoubleOversold | CCI 이탈 + RSI 이탈 | Lambert + Wilder |
| sell\_cciRsiDoubleOverbought | CCI 과매수 + RSI 과매수 | Lambert + Wilder |
| neutral\_squeezeExpansion | BB 스퀴즈 + ATR 확장 | Bollinger (2001) |
| buy\_cusumKalmanTurn | CUSUM 이탈 + 칼만 상승 | Page (1954) + Kalman (1960) |
| sell\_cusumKalmanTurn | CUSUM 이탈 + 칼만 하향 | Page (1954) + Kalman (1960) |
| buy\_volRegimeOBVAccumulation | 변동성 고국면 + OBV 괴리 | RiskMetrics + Granville |
| buy\_flowPcrConvergence | 수급 정렬 매수 + PCR/베이시스 | Choe-Kho-Stulz + Pan-Poteshman |
| sell\_flowPcrConvergence | 수급 정렬 매도 + PCR/베이시스 | Choe-Kho-Stulz + Pan-Poteshman |
| buy\_shortSqueezeFlow | 공매도 스퀴즈 + 외국인 수급 | Lamont-Thaler + Kang-Stulz |

#### Tier 3 복합 (4개 정의 --- 약한 확인)

Tier 3은 단일 핵심 조건에 보조 오실레이터 확인이 부가되는 약한 수준의 복합
신호이다. 단독으로 높은 신뢰도를 부여하기 어려우나, 상위 Tier 신호와의
수렴(convergence) 판정 시 보조 근거로 활용된다.

| ID | 구성 요소 | 학술적 연결 고리 | 기본 신뢰도 |
|----|-----------|------------------|-------------|
| buy\_bbBounceRsi | BB 하단 반등 + RSI 과매도 | Bollinger (2001) + Wilder (1978) | 55 |
| sell\_bbBreakoutRsi | BB 상단 돌파 + RSI 과매수 | Bollinger (2001) + Wilder (1978) | 55 |
| buy\_wrStochOversold | Williams %R + 스토캐스틱 과매도 | Williams (1979) + Lane (1984) | 48 |
| sell\_wrStochOverbought | Williams %R + 스토캐스틱 과매수 | Williams (1979) + Lane (1984) | 48 |

---

**윈도우 매개변수**: 모든 복합은 window=$W$=5봉 [D 경험적]을 사용한다.
Nison (1991)의 "수 봉 내 확인" 원칙에 따른 것으로, 5봉(KRX 1거래주)은
신호 수렴에 충분하되 과도하지 않은 시간을 제공한다. 다만, RL 정책 오버라이드
(`backtester._rlPolicy.composite_windows`)가 존재할 경우, 시그널 속도 특성별
최적 윈도우(빠른 신호 3--4봉, 느린 신호 6--7봉)로 동적 대체된다.

**Anti-predictor WR Gate**: Brock-Lakonishok-LeBaron (1992)의 기술적 거래 규칙
수익성 검정에 기반하여, KRX 5개년 실증 방향성 승률(Win Rate)이 48% 미만인
캔들/차트 패턴은 역예측자(anti-predictor)로 분류된다. 48% 임계치는 50% 귀무가설에서
호가 스프레드 및 거래 비용 2pp를 차감한 값이다. 역예측자가 복합 신호의 구성 요소로
포함될 경우, 해당 복합의 신뢰도가 체계적으로 할인된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 개별 신호 생성 (7카테고리) | `signalEngine.analyze()` 내 `_detectMACross`, `_detectMACDSignals`, `_detectRSISignals`, `_detectBBSignals`, `_detectVolumeSignals`, `_detectIchimokuSignals`, `_detectHurstSignal` 등 16개 감지 함수 | 31개 독립 신호 |
| 파생상품/교차자산 신호 | `_detectBasisSignal`, `_detectPCRSignal`, `_detectFlowSignal`, `_detectERPSignal`, `_detectETFSentiment`, `_detectShortInterest` | S-21~S-26 외부 데이터 기반 |
| 캔들 패턴 $\to$ 신호 맵 | `_buildCandleSignalMap(candlePatterns)` | 패턴 $\to$ 신호 타입 인덱스 매핑 |
| 복합 신호 결합 | `_matchComposites()` + `COMPOSITE_SIGNAL_DEFS` (31개) | 3-Tier 복합 신호 매칭 |
| 동시발생 윈도우 | `COMPOSITE_SIGNAL_DEFS[*].window = 5` | Nison 원칙 기반 5봉 |
| RL 정책 윈도우 오버라이드 | `backtester._rlPolicy.composite_windows` | 시그널 속도별 동적 윈도우 |
| 선택 조건 보너스 | `COMPOSITE_SIGNAL_DEFS[*].optionalBonus` (3--5) | $C_{\text{composite}}$ 가산 |
| 역예측자 게이트 | `PATTERN_WR_KRX` + 48% 임계 | Brock-LeBaron 기반 WR 필터 |
| 신뢰도 기본값 | `baseConfidence` 필드 | Tier 1: 58--75, Tier 2: 48--69, Tier 3: 48--55 |
| VIX $\to$ VKOSPI 프록시 | `_VIX_PROXY = 1.12` [C] | Whaley (2009) KRX 스케일 |


### 3.4.1 거시-미시 신뢰도 (Macro-Micro Confidence)
CheeseStock의 신뢰도 체인은 패턴 인식 단계에서 산출된 기본 신뢰도($C_{\text{base}}$)를
거시경제 환경과 미시 구조적 조건으로 순차 조정하는 승법적(multiplicative) 체계이다.
이 설계는 기술적 분석 단독으로는 포착할 수 없는 체계적 위험(systematic risk)과
유동성 조건을 신뢰도에 내재화한다. 예컨대 IS-LM 프레임워크(Hicks 1937)에서
확장적 통화정책은 LM 곡선을 우하향 이동시켜 금리를 낮추고 주가를 상승시키므로,
해당 국면에서 매수 패턴의 신뢰도를 상향 조정하는 것이 이론적으로 정당하다.

제2장에서 서술된 IS-LM(2.5.1절), 테일러 준칙(2.5.2절), 먼델-플레밍(2.5.3절),
Stovall 섹터 순환(2.5.5절), NSS 수익률 곡선(2.5.10절), Gilchrist-Zakrajsek
신용 스프레드(2.6.14절)의 이론적 프레임워크가 본 절에서 구체적인 조정 요인
(F1~F9, M1~M3)으로 변환된다. 각 요인은 독립적인 학술적 근거와 제한된
조정 크기(클램프)를 가지며, 승법적으로 결합되어 단일 요인의 과대 영향을
구조적으로 차단한다.

클램프 범위의 설정은 실증적 근거에 기반한다. 거시 승수의 상한 1.25는
거시 요인이 패턴 신뢰도를 최대 25%까지 상향할 수 있음을 의미하며,
하한 0.70은 극단적 거시 악화 시에도 30% 이상의 감산을 허용하지 않는다.
이 비대칭(상향 25% vs 하향 30%)은 행동재무학의 손실 회피(Kahneman and
Tversky 1979)와 일관되며, 하방 위험에 더 민감하게 반응하는 시장의
비대칭적 특성을 반영한다.
$$C_{\text{adj}} = C_{\text{base}} \times \text{clamp}(\text{macroMult}, 0.70, 1.25) \times \text{clamp}(\text{microMult}, 0.55, 1.15)$$

$$\text{macroMult} = \prod_{k \in \{F1,F1a,F2,F3,F7,F8,F9\}} (1 + \delta_k)$$

$$\text{microMult} = \prod_{m \in \{M1,M2,M3\}} (1 + \delta_m)$$

| 기호 | 의미  |
|------|------|
| $C_{\text{base}}$ | 패턴 기본 신뢰도  |
| $C_{\text{adj}}$ | 거시-미시 조정 후 신뢰도  |
| $\text{macroMult}$ | 거시 승수 (7개 요인 곱)  |
| $\text{microMult}$ | 미시 승수 (3개 요인 곱)  |
| $\delta_k$ | 제$k$ 거시 요인의 조정량  |
| $\delta_m$ | 제$m$ 미시 요인의 조정량  |
| $\textcolor{stageOneMarker}{\text{bok\_rate}}$ | 한국은행 기준금리  |
| $\textcolor{stageOneMarker}{\text{term\_spread}}$ | 국고 10Y--3Y 금리차  |
| $\textcolor{stageOneMarker}{\text{vix}}$ | CBOE VIX 지수  |
| $\textcolor{stageOneMarker}{\text{taylor\_gap}}$ | 테일러 갭 (실제금리 - 적정금리)  |
| $\textcolor{stageOneMarker}{\text{rate\_diff}}$ | 한미 금리차  |
| $\textcolor{stageOneMarker}{\text{credit\_spread}}$ | 신용 스프레드 (AA-)  |
| $\textcolor{stageTwoMarker}{\text{IS-LM}}$ | IS-LM 균형 프레임워크  |
| $\textcolor{stageTwoMarker}{\text{Taylor Rule}}$ | 테일러 준칙  |
| $\textcolor{stageTwoMarker}{\text{Mundell-Fleming}}$ | 먼델-플레밍 개방경제 모형  |
| $\textcolor{stageTwoMarker}{\text{Stovall}}$ | 섹터-순환 회전 이론  |
| $\textcolor{stageTwoMarker}{\text{NSS}}$ | Nelson-Siegel-Svensson 수익률 곡선  |
| $\textcolor{stageTwoMarker}{\text{GZ}}$ | Gilchrist-Zakrajsek 신용 스프레드  |

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

<!-- [V22-V25 SYNC] -->

**V22-B 동적 적응: 변동성 국면 인식 cap**

기존 승법적 신뢰도 체인은 변동성 국면과 무관하게 정적 cap `[10, 95]`를 12곳에서 하드코딩하여 사용하였다. V22-B부터 `classifyAtrVolRegime(atr14Series)` 함수가 ATR(14)의 252-day 분위수 p25/p75로 시장을 고/중/저 3국면으로 분류하고, `getDynamicCap(factor, volRegime)`가 각 신뢰도 축(`confidence`, `macro`, `pred`)마다 국면별 cap을 반환한다. 고변동성 국면에서는 범위가 `[25, 75]`로 **수축**되어 극단 신뢰도의 드로다운 증폭을 억제하고, 저변동성 국면에서는 `[5, 95]`로 **확장**되어 미세 시그널의 수용폭을 넓힌다. 이 비직관적 방향(고변동성에서 cap 축소)은 KRX 2018--2024 실증 드로다운 경로에서 도출된 것으로, 기존 정적 cap이 단일 국면 가정 하에서 과적합되어 있었음을 시사한다.

아울러 V22-B는 `_appliedFactors` 10-key Set 가드를 도입하여 동일 요인(`RISK_VOL_EQUITY`, `RISK_CREDIT`, `MACRO_TAYLOR_GAP`, `MACRO_COMPOSITE`, `REGIME_HMM`, `RISK_FX`, `RISK_LIQUIDITY`, `FLOW_FOREIGN`, `FLOW_OPTIONS`, `CREDIT_DISTANCE_DEFAULT`)이 `macroMult` 체인과 `roroMult` 체인에서 **이중 적용**되는 구조적 double-counting을 차단한다. `_markFactorsAfterRORO()`와 `_markFactorsAfterMacro()` 헬퍼가 각 요인 적용 직후 Set에 등록하며, 후속 체인이 Set hit 시 해당 요인을 skip 한다. V23은 이 구조 위에 Kish--Longin-Solnik PCA 효과량 예산(§3.2.4)을 얹어 잔여 독립성 위반을 추가 교정하며, 이로써 신뢰도 체인은 9-Layer에서 **10-Layer**로 확장된다. 상세 수식과 백테스트 결과는 §3.5.1의 V22--V25 개정 하위절에 기술되어 있다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| ATR 국면 분류 (V22-B) | `classifyAtrVolRegime()` (indicators.js) | ATR(14) p25/p75 3-구간 분류 |
| 동적 cap 조회 (V22-B) | `getDynamicCap(factor, volRegime)` | 국면별 `confidence`/`macro`/`pred` 범위 반환 |
| 이중계산 방지 (V22-B) | `_appliedFactors` 10-key Set (appWorker.js) | `macroMult` \& `roroMult` 이중 적용 차단 |
| PCA 효과량 예산 (V23) | `_applyPCABudgetCap()` (appWorker.js) | Kish $N_{\text{eff}}$ + Longin-Solnik 비대칭 cap |


### 3.4.3 국면 결합 신뢰도 (Regime Combination Confidence)
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

| 기호 | 의미  |
|------|------|
| $C_{\text{adj}}$ | 계층1~4 조정 후 신뢰도  |
| $C_{\text{final}}$ | 최종 신뢰도  |
| $S_t$ | 시점 $t$의 HMM 은닉 레짐  |
| $\textcolor{stageOneMarker}{\text{hmmRegimeLabel}}$ | HMM 레짐 라벨  |
| $\textcolor{stageOneMarker}{\text{MCS}_{v2}}$ | MCS v2 복합점수  |
| $\textcolor{stageOneMarker}{\text{foreignMomentum}}$ | 외국인 순매수 모멘텀  |
| $\textcolor{stageOneMarker}{\text{VKOSPI}}$ | 한국 변동성지수  |
| $\textcolor{stageOneMarker}{\text{vix}}$ | CBOE VIX  |
| $\textcolor{stageOneMarker}{\text{aa\_spread}}$ | AA- 신용 스프레드  |
| $\textcolor{stageOneMarker}{\text{us\_hy\_spread}}$ | 미국 하이일드 스프레드  |
| $\textcolor{stageOneMarker}{\text{usdkrw}}$ | USD/KRW 환율  |
| $\textcolor{stageOneMarker}{\text{alignment}}$ | 투자자 정렬 신호  |
| $\textcolor{stageTwoMarker}{\text{Hamilton HMM}}$ | 은닉 마르코프 모형  |
| $\textcolor{stageTwoMarker}{\text{Baele-Bekaert}}$ | RORO 공분산 체계  |
| $\textcolor{stageTwoMarker}{\text{Kang-Stulz}}$ | 외국인 투자자 행태  |
| $\textcolor{stageTwoMarker}{\text{Simon-Wiggins}}$ | IV/HV 비율과 패턴 정확도  |
| $m_{\text{MCS}}$ | MCS 기반 조정 승수  |
| $m_{\text{HMM}}$ | HMM 레짐 기반 조정 승수  |
| $m_{\text{flow}}$ | 외국인 방향 일치 보너스  |
| $m_{\text{IV}}$ | 내재변동성 할인 승수  |
| $\text{roroScore}$ | RORO 복합 점수  |
| $w_i$ | 제$i$ RORO 요인 가중치  |
| $f_i$ | 제$i$ RORO 요인 점수  |
| $n_{\text{valid}}$ | 유효 입력 요인 수  |

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
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Phase 8 결합 | `_applyPhase8ConfidenceToPatterns()` (appWorker.js L563) | MCS + HMM + 외국인 수급 + IV/HV 통합 조정 |
| MCS v2 임계값 | `MCS_THRESHOLDS` (appState.js L405) | strong_bull:70, bull:55, bear:45, strong_bear:30 |
| HMM 레짐 승수 | `REGIME_CONFIDENCE_MULT` (appState.js L394) | 2-state Bull/Bear + null fallback |
| RORO 국면 분류 | `_classifyRORORegime()` (appWorker.js L1381) | 5요인 가중합 + 히스테리시스 |
| RORO 패턴 적용 | `_applyRORORegimeToPatterns()` (appWorker.js L1500) | risk-on/off/neutral 체제별 차등 |
| 레짐-변동성 매트릭스 | Doc29 &sect;6.1 + VKOSPI 20/25 임계 | Goldilocks/Hot/Quiet Bear/Crisis 2x2 분류 |
| IV/HV 패턴 정확도 | Simon and Wiggins (2001) | IV/HV > 1.5: 패턴 신뢰도 -7~-10% |
| 외국인 정보거래 | Kang and Stulz (1997) | 방향 일치 시 +3% 보너스 |


### 3.4.2 파생-신용 신뢰도 (Derivatives-Credit Confidence)
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

| 기호 | 의미  |
|------|------|
| $\textcolor{stageOneMarker}{\text{basis}}$ | 선물 베이시스 (KOSPI200 선물 - 현물)  |
| $\textcolor{stageOneMarker}{\text{basisPct}}$ | 정규화 베이시스 (= basis / 현물 $\times$ 100)  |
| $\textcolor{stageOneMarker}{\text{pcr}}$ | 풋/콜 비율 (Put/Call Ratio)  |
| $\textcolor{stageOneMarker}{\text{foreign\_net}}$ | 외국인 순매수 금액  |
| $\textcolor{stageOneMarker}{\text{alignment}}$ | 외국인+기관 수급 정렬 상태  |
| $\textcolor{stageOneMarker}{\text{leverageSentiment}}$ | ETF 레버리지/인버스 비율 센티먼트  |
| $\textcolor{stageOneMarker}{\text{market\_short\_ratio}}$ | 시장 전체 공매도 비율  |
| $\textcolor{stageOneMarker}{\text{usdkrw}}$ | USD/KRW 환율  |
| $\textcolor{stageTwoMarker}{DD}$ | 머튼 부도거리 (Distance to Default)  |
| $\textcolor{stageTwoMarker}{V}$ | 기업 자산가치 (Asset Value)  |
| $\textcolor{stageOneMarker}{D}$ | 부채 장부가 $\times$ 0.75 (KMV Default Point)  |
| $\textcolor{stageOneMarker}{E}$ | 자기자본 시가총액 (Market Cap)  |
| $\textcolor{stageTwoMarker}{\sigma_E}$ | 자기자본 변동성 (EWMA 연율화)  |
| $\textcolor{stageTwoMarker}{\sigma_V}$ | 자산 변동성 (Bharath-Shumway 가중)  |
| $\mu$ | 기대 수익률 $\approx r$ (무위험이자율)  |
| $T$ | 시간 지평 (= 1년)  |
| $\Phi(\cdot)$ | 표준정규 CDF  |
| $\delta_{D1}$ | 베이시스 조정 계수  |
| $\delta_{D2}$ | PCR 역발상 조정 계수  |
| $\delta_{D3}$ | 투자자 정렬 조정 계수  |
| $\delta_{D4}$ | ETF 심리 역발상 조정 계수  |
| $\delta_{D5}$ | 공매도 비율 조정 계수  |
| $\delta_{D7}$ | USD/KRW 수출주 채널 조정 계수  |
| $EDF$ | 기대 부도확률 (Expected Default Frequency)  |

> **이전 Stage 데이터:** $\textcolor{stageOneMarker}{\text{basis}}$, $\textcolor{stageOneMarker}{\text{pcr}}$, $\textcolor{stageOneMarker}{\text{foreign\_net}}$, $\textcolor{stageOneMarker}{\text{alignment}}$, $\textcolor{stageOneMarker}{\text{leverageSentiment}}$, $\textcolor{stageOneMarker}{\text{market\_short\_ratio}}$, $\textcolor{stageOneMarker}{\text{usdkrw}}$는 Stage 1 KRX 파생상품/투자자/ETF/공매도/매크로 데이터에서 수집된다. $\textcolor{stageOneMarker}{E}$와 $\textcolor{stageOneMarker}{D}$는 Stage 1 시가총액 및 DART 재무제표에서 취득된다. $\textcolor{stageTwoMarker}{DD}$ 산출에 필요한 BSM 옵션 이론 프레임워크는 Stage 2 제2장 2.6.10절(Black-Scholes-Merton)과 2.6.13절(Merton 구조 모형)에서 도출된다. $\textcolor{stageTwoMarker}{\sigma_E}$는 Stage 2 제2장 2.3.1절 EWMA 변동성에서 산출된다.

**CONF-계층3: 파생상품 신뢰도 요인표 (D1--D5, D7)**

| 요인 | 이론적 근거 | 조건 | 매수 조정 | 매도 조정 | 크기 |
|------|-------------|------|-----------|-----------|------|
| D1 선물 베이시스 | 보유비용 모형, Bessembinder and Seguin (1993) | contango ($\text{basisPct} \geq 0.5\%$) | $\times(1+\delta)$ | $\times(1-\delta)$ | normal ±4\%, extreme($\geq 2$\%) ±7\% |
| D1 (역) | 동일 | backwardation ($\text{basisPct} \leq -0.5\%$) | $\times(1-\delta)$ | $\times(1+\delta)$ | 동일 |
| D2 PCR 역발상 | Pan and Poteshman (2006) | PCR $> 1.2$ (극단적 공포) | $\times 1.06$ | $\times 0.94$ | ±6\% |
| D2 (역) | 동일 | PCR $< 0.6$ (극단적 탐욕) | $\times 0.94$ | $\times 1.06$ | ±6\% |
| D3 투자자 정렬 | Choe, Kho, and Stulz (2005) | aligned\_buy (외국인+기관 동반 매수) | $\times 1.08$ | $\times 0.93$ | +8\% / $-$7\% |
| D3 (역) | 동일 | aligned\_sell (외국인+기관 동반 매도) | $\times 0.93$ | $\times 1.08$ | $-$7\% / +8\% |
| D4 ETF 심리 | Cheng and Madhavan (2009) | strong\_bullish (극단적 낙관) | $\times 0.96$ | $\times 1.04$ | ±4\% (역발상) |
| D4 (역) | 동일 | strong\_bearish (극단적 비관) | $\times 1.04$ | $\times 0.96$ | ±4\% (역발상) |
| D5 공매도 비율 | Desai et al. (2002) | market\_short\_ratio $> 10\%$ | $\times 1.06$ | $\times 0.94$ | +6\% (숏커버 랠리) |
| D5 (비활성) | Miller (1977) | market\_short\_ratio $< 2\%$ | (비활성)[^d5-note] | (비활성) | --- |
| D7 USD/KRW | Mundell-Fleming, $\beta_{FX}$ 채널 | KRW 약세 ($> 1400$), 수출업종 | $\times 1.05$ | $\times 0.95$ | ±5\% |
| D7 (역) | 동일 | KRW 강세 ($< 1300$), 수출업종 | $\times 0.95$ | $\times 1.05$ | ±5\% |

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
| Default Point | `total_liabilities * 0.75` | KMV 관행: STD + $0.5 \times \text{LTD}$ 근사 |
| 자산변동성 가중 | `sigmaE * (E/V) + 0.05 * (D/V)` | Bharath-Shumway 부채 변동성 5\% 가정 |
| 금융주 DD 제외 | `_getStovallSector() === 'financial'` | 은행/보험/증권 부채 = 영업자산 |
| 무위험이자율 폴백 | KTB 3Y → `_bondsLatest` → `_macroLatest` → 3.5\% | DD 산출 $\mu$ 입력 |
| Compound floor | `confidence < 25 → 25` | Tukey (1977) 윈저화: 8계층 연쇄 곱셈 바닥 방지 |


### 3.5.1 백테스팅 통계 방법론 (Backtesting Statistical Methods)
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

| 기호 | 의미  |
|------|------|
| $X$ | 설계행렬 $[1,\; \text{품질},\; \text{추세},\; \text{거래량비},\; \text{변동성비}]$  |
| $W$ | 시간감쇠 대각가중행렬, $w_i = 0.995^{n-1-i}$ (반감기 $\approx$ 138일)  |
| $\lambda$ | 릿지 벌점 (GCV 그리드 선택)  |
| $I$ | 단위행렬 (절편 $j=0$은 정규화 미적용)  |
| $\textcolor{stageOneMarker}{y}$ | $h$-일 미래 수익률 $-$ 거래비용  |
| $\hat{\beta}$ | WLS 릿지 회귀 계수 벡터  |
| $e_i$ | $i$-번째 잔차, $y_i - x_i^T\hat{\beta}$  |
| $h_{ii}$ | 지렛점 (hat matrix 대각), $H = X(X^TWX+\lambda I)^{-1}X^TW$  |
| $IC$ | 스피어만 정보계수, $\text{corr}(\text{rank}(\hat{y}), \text{rank}(y))$  |
| $\overline{R}_{\text{OOS}}$ | 표본외(OOS) 평균 수익률  |
| $\overline{R}_{\text{IS}}$ | 표본내(IS) 평균 수익률  |
| $WFE$ | Walk-Forward 효율, $(\overline{R}_{\text{OOS}} / \overline{R}_{\text{IS}}) \times 100$  |
| $p_{(i)}$ | 정렬된 $i$-번째 $p$-값 ($p_{(1)} \leq \cdots \leq p_{(m)}$)  |
| $m$ | 동시 검정 수 ($\geq 33$ 패턴)  |
| $q$ | FDR 수준 (0.05)  |
| $h$ | 보유기간  |
| $\text{ILLIQ}_{\text{adj}}$ | Amihud (2002) 비유동성 적응형 슬리피지 배율  |
| $\textcolor{stageTwoMarker}{\text{Ridge}}$ | Hoerl-Kennard (1970) 릿지 정규화 이론  |
| $\textcolor{stageTwoMarker}{\text{GCV}}$ | Golub-Heath-Wahba (1979) 일반화 교차검증  |
| $\textcolor{stageTwoMarker}{\text{HC3}}$ | MacKinnon-White (1985) 이분산 강건 추정  |
| $\textcolor{stageTwoMarker}{\text{BH}}$ | Benjamini-Hochberg (1995) FDR 보정 이론  |

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

<!-- [V22-V25 SYNC] -->

#### V22--V25 백테스트 방법론 개정

V21 이후 4차례의 세션(V22-B, V23, V24, V25)에서 백테스트 파이프라인의 측정 기반이 재설계되었다. 본 하위절은 기존 WLS/IC/WFE/BH-FDR 구조를 유지하면서, 동적 변동성 적응·PCA 효과량 예산·OOS 시간 분할·Contrarian 승격이라는 4개의 개정 축을 추가한다.

**(1) OOS 시간 분할 (V22-B)** --- 기존 랜덤 hold-out 방식은 KRX 상승장 편향을 제거하지 못하여 과적합 위험이 상존했다. V22-B부터 `scripts/compute_oos_winrates.py`가 2025-11-01 기준 시간 분할(Lo 2002)을 강제한다. Train 구간 2025-04-11 \~ 2025-10-31 ($N_{\text{train}} = 41{,}778$), test 구간 2025-11-03 \~ 2026-04-03 ($N_{\text{test}} = 41{,}232$)로 train:test $= 50.3 : 49.7$ 대칭이다. `pattern_winrates_oos.json`에는 패턴별 `oos_wr`, `wr_oos_shrunk`, `oos_wr_95ci`, `oos_wr_p_value_vs_50`이 기록되며, 런타임은 `OOS $\to$ LIVE $\to$ SHRUNK` 우선순위로 승률을 주입한다.

**(2) 변동성 국면 동적 적응 (V22-B)** --- 하드코딩 cap `[10, 95]` 12곳이 `getDynamicCap(factor, volRegime)`으로 교체되었다. `classifyAtrVolRegime(atr14Series)`가 ATR(14)의 252-day 분위수 p25/p75로 시장을 고/중/저 국면으로 분류하고, 고변동성 국면에서는 cap이 `[25, 75]`로 **수축**되어 극단 신뢰도 드로다운 증폭을 억제한다. 저변동성 국면에서는 `[5, 95]`로 **확장**되어 미세 시그널 수용폭을 넓힌다. 이 비직관적 방향은 KRX 2018--2024 실증 드로다운 경로에서 도출된 것으로, 기존 정적 cap이 단일 국면 가정 하에서 과적합되어 있었음을 시사한다.

**(3) PCA 효과량 예산 (V23)** --- 제3.2.4절에서 서술된 Longin--Solnik (2001) 비대칭 극단상관과 Kish (1965) 유효표본크기 프레임워크가 신뢰도 체인에 반영되었다. `_applyPCABudgetCap()`가 Worker result / fallback / drag의 3개 체인에 모두 적용되며, downside floor $= \exp(-0.10\sqrt{N_{\text{eff}}})$, upside ceiling $= \exp(+0.12\sqrt{N_{\text{eff}}})$의 비대칭 예산으로 동시발동 요인의 복합 cap을 교정한다. V22-B 이전의 9-Layer 체인은 이 단계 추가로 **10-Layer**가 된다.

**(4) Contrarian 승격 --- $\textit{confidencePred} = 100 - \textit{dirWr}$ (V25)** --- V22-B 초기 OOS 분석에서 8개 bullish 패턴이 일관되게 $\textit{dirWr} < 50$을 기록하였고, V23은 이를 `confidencePred = null`로 배제하여 `direction_accuracy` 메트릭 오염을 방지하였다. V25는 1-sided binomial 검정과 Benjamini--Hochberg FDR ($q = 0.10$)으로 이 8개 패턴의 **반대방향** 예측력을 재검정하였고, 전원 통과(Bonferroni $\alpha = 0.05$에서도 통과)에 따라 `contrarian: true` 플래그를 부여하였다. 런타임에서 해당 패턴의 예측 신뢰도는 $\textit{confidencePred} = 100 - \textit{dirWr}$로 반전되며, 동일 품질 스케일링·cap·페널티 체인을 그대로 상속한다. 이론적 기반은 Lo (2004) AMH의 crowding 포화 경로와 Jegadeesh (1990) 1개월 단기반전이다 (§2.6.1).

**8개 Contrarian 승격 패턴** (출처: `data/backtest/pattern_winrates_oos.json`, 2026-04-10)

| 패턴 | OOS $\widehat{WR}$ | Contrarian Pred | 95% CI | $n_{\text{test}}$ | $p$-값 | 분류 |
|------|---|---|---|---|---|---|
| doubleBottom            | 33.16% | 66.84% | [26.95, 40.02] | 196  | $1 \!\times\! 10^{-6}$     | chart  |
| inverseHeadAndShoulders | 35.60% | 64.40% | [32.25, 39.09] | 750  | $< \!10^{-15}$             | chart  |
| ascendingTriangle       | 38.56% | 61.44% | [33.93, 43.40] | 402  | $3 \!\times\! 10^{-6}$     | chart  |
| cupAndHandle            | 39.95% | 60.05% | [37.55, 42.40] | 1562 | $< \!10^{-15}$             | chart  |
| morningStar             | 41.16% | 58.84% | [35.52, 47.03] | 277  | $1.9 \!\times\! 10^{-3}$   | candle |
| tweezerBottom           | 43.06% | 56.94% | [39.24, 46.97] | 627  | $2.9 \!\times\! 10^{-4}$   | candle |
| bullishMarubozu         | 44.03% | 55.97% | [41.85, 46.23] | 1976 | $6 \!\times\! 10^{-8}$     | candle |
| bullishEngulfing        | 45.74% | 54.26% | [43.94, 47.56] | 2901 | $2 \!\times\! 10^{-6}$     | candle |

**유의사항:** `bullishEngulfing`의 Cohen's $g \approx 0.04$는 trivial effect에 해당하여 실무적 유의성이 제한적이다. `morningStar`는 marginally powered ($n_{\text{test}} = 277$)이며 차기 OOS 사이클에서 재평가 대상이다. 3개 차트 패턴(`doubleBottom`, `inverseHeadAndShoulders`, `ascendingTriangle`)은 IS 표본이 $n_{\text{IS}} \leq 4$로 극소하여 IS-OOS 델타 검정이 무의미하고, OOS 유의성에만 근거한다.

**(5) V25-B cusumBreak 3-수정 + 전수 재실행** --- V24에서 `_detectCUSUMBreak()`의 TypeError 수정[^cusum-v24]으로 비로소 활성화된 cusumBreak 시그널은 V25-B에서 3개의 추가 정합성 수정을 받았다: ① returns-space 인덱스 $\to$ candle-space 교정 (`bp.index + 1`), ② `volRegime` 파라미터 passthrough로 $h = 3.5$ 적응형 임계값 활성화, ③ 방향 전파 (`neutral` $\to$ `bp.direction` 기반 buy/sell). 2,646 종목 전수 재실행(245,103 패턴 표본)에서 `direction_accuracy = 0.4928`로 baseline 대비 거의 변화가 없었는데, 이는 batch 런타임의 시그널 방향이 contrarian 반전(런타임 전용)의 영향을 받지 않기 때문이며, contrarian 승격의 실질 효과는 차기 OOS 사이클에서 측정된다.

\newpage

## 3.6 학문간 계보 요약

### 3.6.1 기술적 분석 도출 요약 (Technical Analysis Derivation Summary)
제3장은 제2장의 7개 학문 분야에서 도출된 이론을 31개 지표, 32종 패턴, 31개 개별 신호, 31개 복합 신호, 7계층 신뢰도 체인, 그리고 다중 통계 검증 체계로 변환하는 과정을 문서화하였다. 이 변환 과정에서 5개 학문 분야가 추가적으로 관여한다: 기술적 분석(Dow-Hamilton-Rhea, Nison, Edwards-Magee), 계량경제학(WLS, Ridge, HC3), 베이지안 통계학(베타-이항 사후 축소), 금융공학(다요인 신뢰도 체인), 실험설계(Walk-Forward, BH-FDR).

제2장에서 제3장으로의 연결은 단방향이 아니다. 제2장의 이론이 제3장의 구현으로 흐르는 순방향 경로와, 제3장의 경험적 발견(KRX 매도 편향, AMH 감쇠율)이 제2장의 이론적 예측을 검증하는 역방향 경로가 공존한다. 이 양방향 정합성이 시스템 전체의 학술적 신뢰성을 보장한다.

**제2장에서 제3장으로의 완전한 연결 고리**

```
[제2장 2.5: 경제학]
  IS-LM -----------> 테일러 갭 ---------> CONF-F7
  먼델-플레밍 -----> 금리차 -----------> CONF-F9
  Stovall ---------> 섹터 회전 ---------> CONF-F1a
  HHI -------------> 평균회귀 보강 -----> CONF-M2

[제2장 2.6: 금융학]
  CAPM ------------> calcCAPMBeta() ----> 베타, 알파 (I-12)
  머튼 DD ---------> _calcNaiveDD() ---> CONF-계층4
  VRP -------------> calcVRP() --------> I-14
  BSM IV ----------> VKOSPI 국면 ------> S-28
  보유비용 --------> 베이시스 신호 -----> S-21
  카일 람다 -------> 수평 비용 --------> B-10
  아미후드 ILLIQ ---> calcAmihudILLIQ() -> I-28, CONF-M1
  RORO ------------> 5요인 복합 -------> CONF-계층6

[제2장 2.7: 행동재무학]
  전망이론 --------> 손절/목표 --------> PROSPECT_STOP_WIDEN
  처분효과 --------> 52주 지지/저항 ----> SR_52W_STRENGTH
  반예측기 --------> 승률 게이트 ------> PATTERN_WR_KRX
  군집행동 --------> CSAD 데이터 ------> (향후 능동 사용)
  손실회피 --------> KRX 매도 편향 ----> 경험적 WR 비대칭

[제3장: 내부]
  Wilder (1978) ----> ATR 정규화 ------> 모든 패턴
  Nison (1991) -----> 21+ 캔들 패턴 ----> P-1~P-19
  Edwards-Magee ----> 9 차트 패턴 -----> P-20~P-28
  Hosoda (1969) ----> 일목 신호 -------> S-8
  Appel (1979) -----> MACD 신호 -------> S-3, S-4
  Bollinger (2001) -> BB 신호 ---------> S-7
  Mandelbrot (1963) -> 허스트 국면 ----> S-11
  Page (1954) ------> CUSUM 이탈 -----> S-17
  Grinold-Kahn ----> 스피어만 IC -----> B-1
  Pardo (2008) -----> Walk-Forward ----> B-3
  BH (1995) --------> FDR 보정 -------> B-4
```

**종합 요약 테이블**

| 시트 | 핵심 구현체 | 학문 기반 (제2장) | 산출물 |
|------|-----------|-----------------|--------|
| 3.1 지표 계보 | 31개 지표 (I-01~I-31) | 통계학, 물리학, 금융학, 수학 | 가격 파생 수치 |
| 3.2.1 캔들스틱 | 21개 캔들 패턴 (P-1~P-19+) | 행동재무학 (전망이론, 처분효과) | 패턴 감지 + 품질 점수 |
| 3.2.2 차트 패턴 | 9개 차트 패턴 (P-20~P-28) + S/R | 기술적 분석 (Dow, Edwards-Magee) | 구조 패턴 + 목표가/손절가 |
| 3.2.3 패턴 수학 | ATR 정규화, 틸-센, PCA, 베타-이항 | 통계학, 베이지안 | 보정된 임계값/승률 |
| 3.3 신호 체계 | 31개별 + 31복합 신호 | 다중 출처 확인 이론 | 매매 행동 신호 |
| 3.4.1 거시-미시 | CONF-계층1 (11요인) + 계층2 (3요인) | 경제학 (IS-LM, 테일러, 먼델-플레밍) | macroMult, microMult |
| 3.4.2 파생-신용 | CONF-계층3 (7요인) + 계층4 (DD) | 금융학 (BSM, Merton, 보유비용) | derivMult, mertonMult |
| 3.4.3 국면 결합 | CONF-계층5 (Phase8) + 계층6 (RORO) | 통계학 (HMM), 금융학 (RORO) | roroMult, 최종 신뢰도 |
| 3.5 백테스팅 | WLS Ridge, IC, WFE, BH-FDR | 계량경제학, 실험설계 | A/B/C/D 등급 |
| 학술 개념 | 구현 모듈 | 적용 영역 |
|-----------|----------|-----------|
| 31 지표 산출 | `js/indicators.js` `calcMA()`~`calcHAR_RV()` + `IndicatorCache` | 가격→수치 변환 |
| 32 패턴 감지 | `js/patterns.js` `patternEngine.analyze()` | OHLCV→패턴 식별 |
| 62 신호 생성 | `js/signalEngine.js` `signalEngine.analyze()` | 지표+패턴→행동 신호 |
| 7계층 신뢰도 | `js/appWorker.js` 6개 `_apply*Confidence*()` | 다요인 신뢰도 조정 |
| 통계 검증 | `js/backtester.js` `backtestAll()` | WLS+IC+WFE+BH-FDR |
| Worker 오프로드 | `js/analysisWorker.js` `self.onmessage` (L.203) | 메인 스레드 비차단 |

---

## 부록 3.I: 상수 분류 요약

| 등급 | 제3장 개수 | 예시 |
|------|-----------|------|
| [A] 학술적 고정 | ~40 | DOJI_BODY_RATIO=0.05, RSI period=14, MACD 12/26/9, BB n=20/k=2, Ichimoku 9/26/52, Hurst minW=10 |
| [B] 학술적 조정 가능 | ~35 | SHADOW_BODY_MIN=2.0, ATR period=14, Kalman Q=0.01 |
| [C] 교정 가능 | ~30 | ENGULF_BODY_MULT=1.5, ILLIQ 임계, CUSUM threshold=2.5 |
| [D] 경험적 | ~20 | 변동성 국면 기준, 복합 window=5, slopeNorm 임계 |
| [E] 폐기 | 0 | 현재 없음 |

## 부록 3.II: KRX 특수 적응

| 적응 사항 | 표준 | KRX 수정 | 근거 |
|-----------|------|----------|------|
| KRX_TRADING_DAYS | 252 (NYSE) | 250 | KRX 공휴일 차이 |
| VIX_VKOSPI_PROXY | --- | 1.12 | VKOSPI ~= VIX * 1.12 (Whaley 2009) |
| Stovall 감쇠 | 1.0x | 0.5x | US S&P 경험적, KRX 미검증 |
| KRX_COST | ~0.10% (US) | 0.31% | 높은 세금 0.18% + 넓은 스프레드 |
| 공매도 금지 기간 | N/A | 2020-03, 2023-11 | Miller (1977) 금지 시 과대평가 |
| ATR 일봉 폴백 | close * 0.015 | close * 0.020 | KRX 중앙값 ATR/종가 ~2.1% |
| $N_0$ (EB 축소) | --- | 35 | 545K KRX 패턴의 경험적 베이즈 |
| AMH $\lambda$ KOSDAQ | --- | 0.00367 | 소형주 시장 빠른 알파 감쇠 |
| AMH $\lambda$ KOSPI | --- | 0.00183 | 대형주 시장 느린 알파 감쇠 |

---

*본 문서는 CheeseStock 기술적 분석 계층에 구현된 모든 지표, 패턴, 신호,
신뢰도 조정, 백테스팅 기법의 완전한 학술적 계보를 제공한다. 각 수식은
제2장의 학술적 기반으로부터 역추적되며, 구현으로 전방 연결된다.*

\newpage


# 제4장: 차트 — 시각적 변환

> 본 장은 제3장에서 산출된 이론적 계산 결과가 어떻게 차트 위의 시각 요소로
> 변환되는지를 논증한다. 색상, 형태, 계층, 밀도 제한의 설계 근거는
> 인지심리학, 금융 관례, 정보이론에 기초한다.

### 4.1.1 렌더링 아키텍처와 계층 체계 (Rendering Architecture & Layer System)
CheeseStock은 2,700개 이상의 KRX 종목에 대해 9개 패턴 계층과 신호·서브차트 오버레이를 동시 렌더링한다. 렌더링 엔진으로 Canvas2D 기반의 TradingView Lightweight Charts(LWC) v5.1.0을 채택한 근거는 성능과 API 간결성이다. SVG는 O(n) DOM 노드 비용으로 1,000개 이상의 요소에서 성능이 급격히 저하되고, WebGL은 GPU 셰이더 파이프라인이 2D 금융 차트에 과잉 복잡성을 초래한다. Canvas2D는 래스터화 속도, 간결한 드로잉 API, DPR(장치 픽셀 비율) 제어의 세 요건을 동시에 충족한다. 히트 테스팅 불가와 수동 텍스트 레이아웃이라는 단점은 수용 가능한 트레이드오프이다.

9계층 아키텍처는 화가 알고리즘(Painter's Algorithm)을 따른다: 후순위 계층이 선순위 위에 그려진다. 계층 1(글로우)이 가장 먼저 그려져 배경에 놓이고, 계층 9(연장선)이 마지막으로 그려져 전경에 위치한다. 이 순서는 게슈탈트 원리의 시각 위계(visual hierarchy)를 반영한다: 단일 캔들 강조(계층 1-2)는 미묘하게, 예측 구간(계층 8)은 명료하게 표시된다. 각 계층은 제3장의 특정 출력 유형(캔들 패턴, 차트 패턴, S/R 수준, 신뢰도 점수)을 시각화하는 책임이 분리되어 있어, 특정 계층만 선택적으로 렌더링하거나 비활성화할 수 있다.

LWC의 `ISeriesPrimitive` API는 차트 캔버스 위에 직접 그리기를 허용하며, 이것이 패턴·신호·예측 구간 렌더링의 기반이다. 그러나 종목 변경이나 차트 유형 전환(캔들 $\leftrightarrow$ 라인) 시 `candleSeries`가 재생성되므로, 기존 프리미티브가 파괴된 시리즈에 부착된 채로 남으면 렌더링이 중단된다. 이를 방지하기 위해 ISeriesPrimitive 재연결 프로토콜이 필수적이며, `patternRenderer`, `signalRenderer`, `drawingTools` 세 모듈이 동일한 프로토콜을 공유한다.

고해상도 디스플레이(Retina, 4K)에서의 DPR 누적은 미묘하지만 치명적인 버그를 유발한다. 매 리드로우마다 `ctx.scale(dpr, dpr)`을 반복 호출하면 좌표가 기하급수적으로 증가(2배 $\to$ 4배 $\to$ 8배...)하여 그리기 요소가 화면 밖으로 이탈하거나 보이지 않게 된다. 이를 방지하려면 스케일링 전에 반드시 변환 행렬을 항등행렬로 초기화해야 한다. 신호 렌더러는 이중 PaneView 아키텍처를 사용하여 골든/데드 크로스 영역(배경, `zOrder='bottom'`)과 다이아몬드·별 마커(전경, `zOrder='top'`)를 분리 렌더링함으로써, 영역 신호가 캔들스틱 패턴을 가리는 문제를 해결한다.
$$\text{DPR 초기화:} \quad \texttt{ctx.setTransform}(1,0,0,1,0,0); \quad \texttt{ctx.scale}(dpr,\, dpr)$$

$$\text{라벨 충돌:} \quad \mathrm{bbox}(l_i) \cap \mathrm{bbox}(l_j) \neq \emptyset \;\Rightarrow\; y_j \leftarrow y_j \pm 18\,\text{px} \quad (\text{6회 반복})$$

| 기호 | 의미  |
|------|------|
| $dpr$ | 장치 픽셀 비율 (Device Pixel Ratio)  |
| $\alpha$ | 계층 불투명도  |
| $\textcolor{stageThreeMarker}{\text{patterns}}$ | 감지된 패턴 배열  |
| $\textcolor{stageThreeMarker}{\text{confidence}}$ | 패턴 신뢰도 점수  |
| $\textcolor{stageThreeMarker}{\text{priceTarget}}$ | 패턴 목표가  |
| $\textcolor{stageThreeMarker}{\text{stopLoss}}$ | 패턴 손절가  |
| $\mathrm{bbox}(l_i)$ | 라벨 $i$의 바운딩 박스  |
| MAX\_PATTERNS | 최대 패턴 표시 수  |
| MAX\_EXTENDED\_LINES | 최대 연장선 수  |
| MAX\_DIAMONDS | 최대 다이아몬드 신호 수  |
| MAX\_STARS | 최대 별 신호 수  |
| MAX\_DIV\_LINES | 최대 다이버전스선 수  |
| RECENT\_BAR\_LIMIT | 렌더링 대상 최근 봉 수  |

> **이전 Stage 데이터:** $\textcolor{stageThreeMarker}{\text{patterns}}$, $\textcolor{stageThreeMarker}{\text{confidence}}$, $\textcolor{stageThreeMarker}{\text{priceTarget}}$, $\textcolor{stageThreeMarker}{\text{stopLoss}}$는 Stage 3 (제3장 3.2–3.4절)에서 산출된 패턴 감지 결과 및 7계층 신뢰도 조정 점수이다. 본 Stage(제4장)는 이 값들을 소비하여 시각 부호로 변환하며, 수정하지 않는다.

**렌더링 엔진 비교**

| 엔진 | 장점 | 단점 | 판정 |
|------|------|------|------|
| SVG | DOM 접근 가능, CSS 스타일링 | O(n) DOM 노드 → 1,000개 이상에서 성능 저하 | 기각 |
| WebGL | GPU 가속, 대량 처리 | 셰이더 파이프라인 복잡, 2D 차트에 과잉 | 기각 |
| Canvas2D | 빠른 래스터화, 간결한 API, DPR 제어 | 히트 테스팅 불가, 수동 텍스트 레이아웃 | **채택** |

**9개 그리기 계층 상세**

| 순서 | 계층명 | 시각 요소 | 제3장 출력 | 색상 (fill $\alpha$ / stroke $\alpha$) |
|------|--------|----------|-----------|--------------------------------------|
| 1 | 글로우(Glows) | 개별 캔들 수직 줄무늬 (폭 16px) | 단일 캔들스틱 패턴 | \#B388FF fill=0.06 / stroke=0.25 |
| 2 | 브래킷(Brackets) | 2–3개 캔들 둥근 사각형 (r=4) | 이중/삼중 패턴 | \#B388FF fill=0.06 / stroke=0.25 |
| 3 | 추세영역(TrendAreas) | 그라데이션 다각형 + 피벗 마커 | 삼각형/쐐기형 차트 패턴 | \#96DCC8 fill=0.04 |
| 4 | 폴리라인(Polylines) | 피벗점 연결선 (W/M/넥라인) | 이중바닥/천정 | `PTN_BUY` rgba 내장 $\alpha$=0.65, 선폭 1.5 |
| 5 | 수평선(Hlines) | 지지/저항, 손절/목표 수평선 | S/R 클러스터링, 패턴 목표가 | 은색/\#FF6B35/민트 점선 [5,3] |
| 6 | 커넥터(Connectors) | H\&S 빈 원 + 어깨 연결선 | 머리어깨 피벗점 | 민트 globalAlpha=0.5, 점선 [2,3] |
| 7 | 라벨(Labels) | 알약형 배지 (Pretendard 12px 700) | 모든 감지 패턴 | 흰색 텍스트 / \#1A1A2E 배경 |
| 8 | 예측구간(ForecastZones) | 목표/손절 그라데이션 + R:R 바 | 패턴 목표가/손절가 | 민트 목표 / 오렌지 손절 |
| 9 | 연장선(ExtendedLines) | 화면 밖 구조선 연장 | 추세선/넥라인 | `KRX_COLORS.ACCENT` globalAlpha=0.35, 점선 [8,4] |

**계층 활성화 조건**

| 패턴 분류 | 활성화 계층 | 라우팅 기준 |
|-----------|-----------|-----------|
| 단일 캔들 (도지, 해머 등 13종) | 1 → 7 → 8 | 단일 패턴 사전 멤버 |
| 이중/삼중 캔들 (장악형, 적삼병 등 20종) | 2 → 7 → 8 | 영역 패턴 사전 멤버 |
| 이중바닥/천정 | 4 → 5 → 7 → 8 | W/M 폴리라인 + 넥라인 수평선 |
| 삼각형/쐐기 (5종) | 3 → 5 → 7 → 8 | 추세 영역 다각형 + 돌파선 |
| 머리어깨/역머리어깨 | 4 → 5 → 6 → 7 → 8 | 피벗 폴리라인 + 넥라인 + 어깨 커넥터 |
| 지지/저항 | 5 | 수평선만 (라벨 없음) |
| 모든 패턴 (조건부) | 9 | 화면 밖 구조선이 존재할 때만 |

계층 8 활성화 조건: 예측 구간은 패턴에 `priceTarget`과 `stopLoss`가 모두 존재할 때만 렌더링된다. 승률 조건부 착색: 승률 > 60% → 민트, 40–60% → 노랑(`#ffeb3b`), < 40% → 청색.

**줌 적응형 밀도 제어**

| 가시 봉 수 | 유효 최대 패턴 | 근거 |
|-----------|--------------|------|
| $\leq$ 50봉 (고배율 줌인) | 1 | 좁은 시야 → 정보 밀도 감소 필수 |
| 51–200봉 (표준 뷰) | 2 | 중간 맥락 |
| > 200봉 (축소 뷰) | 3 (기본값) | 넓은 맥락에서 다수 패턴 수용 가능 |

정렬 우선순위: (1) 활성 패턴(`priceTarget`/`stopLoss` 보유) 우선, (2) 동순위 시 신뢰도 내림차순. 연장선도 동일한 신뢰도 정렬 후 MAX\_EXTENDED\_LINES=5로 절삭.

**ISeriesPrimitive 재연결 시퀀스**

```
1. 대상 시리즈 결정:
   chartType == 'line' → cm.indicatorSeries._priceLine (null 방어)
   그 외              → cm.candleSeries

2. 시리즈 변경 감지:
   _attachedSeries !== targetSeries ?

3. 예 → 분리(detach):
   try { _attachedSeries.detachPrimitive(_primitive); } catch(e) {}
   // try-catch: 이미 파괴된 시리즈에서의 분리 실패를 방어

4. 새 프리미티브 생성 및 부착:
   _primitive = new PatternOverlayPrimitive();
   targetSeries.attachPrimitive(_primitive);
   _attachedSeries = targetSeries;
```

라인 모드에서 `_priceLine`이 `null`일 수 있으므로 반드시 null 가드가 필요하다. `patternRenderer`, `signalRenderer`, `drawingTools` 세 모듈이 동일한 프로토콜을 사용한다.

**신호 렌더러 이중 PaneView**

| 패인 | zOrder | 시각 요소 | 근거 |
|------|--------|----------|------|
| **배경** | `'bottom'` | 수직 밴드 (골든/데드 크로스 영역) | 맥락 신호가 가격 동작을 가리지 않아야 함 |
| **전경** | `'top'` | 다이아몬드, 별, 다이버전스선, 거래량 라벨 | 고신뢰 신호는 가격 위에 반드시 노출 |

골든/데드 크로스 영역은 다수 봉에 걸쳐 확장되어 전경에 렌더링하면 캔들스틱 패턴을 완전히 가릴 수 있다. 반면 다이아몬드/별 마커는 특정 봉의 점(point) 신호로, 캔들과 공존할 수 있을 만큼 작다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 9계층 렌더링 (화가 알고리즘) | `js/patternRenderer.js` `_drawFn()` | 글로우→연장선 9단계 고정 순서 |
| 신호 렌더링 이중 패인 | `js/signalRenderer.js` dual PaneView | 배경 밴드(`zOrder='bottom'`) / 전경 마커(`zOrder='top'`) |
| DPR 안전성 초기화 | `js/financials.js` `drawFinTrendChart()` | `ctx.setTransform(1,0,0,1,0,0)` 선행 |
| 라벨 충돌 회피 | `js/patternRenderer.js` `_labelCollision()` | 6회 반복 수직 재배치, 실패 시 생략 |
| ISeriesPrimitive 재연결 | `js/patternRenderer.js` `render()` / `js/signalRenderer.js` `render()` / `js/drawingTools.js` `render()` | 종목 변경·차트 유형 전환 시 detach→reattach |
| 줌 적응 밀도 | `js/patternRenderer.js` effectiveMax 계산 | 가시 봉 수 기반 MAX\_PATTERNS 동적 조정 |
| Miller(1956) 인지 부하 | MAX\_PATTERNS=3, RECENT\_BAR\_LIMIT=50 | 시각 요소 수 상한 설계 |

### 4.4.1 시각화 도출 요약 (Visualization Derivation Summary)
제3장(기술적 분석)의 수학적 출력은 제4장(차트 시각화)에서 시각 부호로 변환된다. 이 변환은 일대다 매핑이다: 하나의 수치(예: 신뢰도 점수)가 라벨 불투명도, 티어 배지 색상, 예측 구간 가시성 등 여러 시각 채널에 동시에 영향을 미친다. 매핑 설계의 핵심 원칙은 정보이론적 채널 분리이다: 가격 방향(상승/하락)은 적색/청색으로, 분석 유형(차트/캔들 패턴)은 민트/보라로, 재무 품질은 녹색/청색으로 인코딩되어 세 채널이 독립적으로 디코딩 가능하다.

시각화 토글(`vizToggles`)은 렌더링 시점에 `_filterPatternsForViz()`로 필터링을 수행하므로, 제3장의 분석은 토글 상태와 무관하게 항상 완전히 실행된다. 이 연산-표시 분리 원칙은 패턴 감지 정확도가 사용자의 표시 설정에 독립적임을 보장하며, 백테스트 결과가 시각화 상태에 오염되지 않게 한다.

**제3장 출력 → 제4장 시각 부호 종합 매핑**

| $\textcolor{stageThreeMarker}{\text{Stage 3 출력 유형}}$ | 제4장 계층 | 시각적 부호화 | 예시 |
|----------------------------------------------------------|-----------|-------------|------|
| $\textcolor{stageThreeMarker}{\text{지표값 (MA, BB)}}$ | 차트 오버레이 | 색상 선 | MA5 = 적색 선 |
| $\textcolor{stageThreeMarker}{\text{캔들 패턴}}$ | 계층 1–2 + 계층 7 | 보라 하이라이트 + 배지 | "해머" 배지 |
| $\textcolor{stageThreeMarker}{\text{차트 패턴}}$ | 계층 3–6 | 민트 다각형 + 선 | 삼각형 채우기 |
| $\textcolor{stageThreeMarker}{\text{S/R 수준}}$ | 계층 5 | 은색 수평선 + 가격 라벨 | 50,000원 지지선 |
| $\textcolor{stageThreeMarker}{\text{신호}}$ | 신호 렌더러 전경 | 다이아몬드(중) 또는 별(강) | 골든크로스 다이아몬드 |
| $\textcolor{stageThreeMarker}{\text{예측 구간}}$ | 계층 8 | 민트/오렌지 그라데이션 | 목표/손절 투영 |
| $\textcolor{stageThreeMarker}{\text{신뢰도 점수}}$ | 라벨 불투명도 + 티어 배지 | $\alpha$ 0.4–1.0 + A/B/C/D 색상 | Tier A = 녹색 배지 |
| $\textcolor{stageThreeMarker}{\text{백테스트 결과}}$ | 패턴 패널 카드 (C열) | 승률 %, 평균 수익률 % | "승률 62%" 텍스트 |

> **이전 Stage 데이터:** 위 표의 모든 Stage 3 출력 유형은 `js/patterns.js` (`patternEngine.analyze()`), `js/signalEngine.js` (`signalEngine.analyze()`), `js/backtester.js` (`backtester.backtestAll()`)에서 산출된다. 본 Stage(제4장)는 이 값들을 소비하는 종단점이며, 역방향 의존성이 없다.

**시각화 파이프라인 전체 흐름**

| 단계 | 위치 | 역할 |
|------|------|------|
| 1. 패턴 감지 | `js/patterns.js` `patternEngine.analyze()` | ATR 정규화, 품질 점수, S/R 클러스터링 |
| 2. 신호 생성 | `js/signalEngine.js` `signalEngine.analyze()` | 16개 지표 신호 + 6개 복합 신호 |
| 3. 백테스트 | `js/backtester.js` `backtester.backtestAll()` | 패턴별 N일 수익률 통계 |
| 4. 시각 필터 | `appUI.js` `_filterPatternsForViz()` | 4범주 토글 기반 렌더 시점 필터링 |
| 5. 패턴 렌더링 | `js/patternRenderer.js` `patternRenderer.render()` | 9계층 Canvas2D 드로잉 |
| 6. 신호 렌더링 | `js/signalRenderer.js` `signalRenderer.render()` | 이중 PaneView (배경/전경) |
| 7. 패널 표시 | `js/patternPanel.js` `renderPatternPanel()` | C열 카드: 승률, 평균 수익률, 학술 메타데이터 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 정보이론 채널 분리 (Shannon 1948) | `js/colors.js` KRX\_COLORS | 방향(UP/DOWN) · 유형(PTN\_BUY/CANDLE) · 품질(fin-good) 독립 채널 |
| Miller(1956) 인지 부하 한계 | MAX\_PATTERNS=3, MAX\_DIAMONDS=6 | 계층별 밀도 상한으로 시각 포화 방지 |
| 화가 알고리즘 | `patternRenderer._drawFn()` 9단계 고정 순서 | 글로우(배경) → 연장선(전경) 계층 위계 |
| 연산-표시 분리 원칙 | `_filterPatternsForViz()` 렌더 시점 필터 | 분석 완전성 보존, 토글 상태 독립성 |
| Tufte(1983) 데이터-잉크 비율 | $\alpha$=0.06–1.0 불투명도 차등 | 신뢰도 높을수록 불투명, 낮을수록 투명 |
| 한국 시장 색상 관례 | KRX\_COLORS.UP=\#E05050, DOWN=\#5086DC | 적색=상승, 청색=하락 (서양과 반대) |
| 패턴 방향 중립성 | PTN\_BUY = PTN\_SELL = 민트 | 방향 정보는 라벨 텍스트·위치로만 전달 |


### 4.2.1 색채 이론과 문화적 부호 (Color Theory & Cultural Encoding)
동아시아 색상 기호학에서 적색은 번영과 길조를 상징하며, 청색은 안정과 보수적 태도를 나타낸다. 한국 주식시장(KRX)은 이 문화적 맥락에 따라 서양과 반대의 색상 관례를 채택한다: 상승·매수는 적색(`#E05050`), 하락·매도는 청색(`#5086DC`)으로 표시한다. 삼성증권, 미래에셋, NH투자증권, 키움증권 등 국내 모든 트레이딩 플랫폼이 동일한 관례를 따르며, CheeseStock도 사용자의 학습된 기대와 일치시킨다. 이 선택은 미적 선호가 아닌 **문화적 인지 관례**의 준수이다.

Shannon(1948) 정보이론의 채널 용량 공식은 색상 설계에 직접 적용된다: 하나의 색상 채널이 복수의 의미를 동시에 전달하면 수신자(트레이더)의 정보 해석 오류 확률이 증가한다. CheeseStock은 이를 방지하기 위해 3개 열에 완전히 독립적인 색상 의미 체계를 부여한다. B열(차트)은 적색·청색으로 **가격 방향**만을, C열(패턴)은 민트·보라로 **분석 유형**만을, D열(재무)은 녹색·청색으로 **재무 품질**만을 부호화한다. 각 채널은 상호 직교(orthogonal)하여 의미 혼선이 발생하지 않는다.

패턴 색상의 경우, 매수 패턴과 매도 패턴 모두 동일한 민트 색상(`rgba(150,220,200,0.65)`)을 사용한다. 이는 Bloomberg Terminal 및 TradingView의 전문가 표준을 따른 설계 결정이다. 패턴 감지는 **중립적 분석 관찰**이지 방향적 추천이 아니기 때문이다. 예를 들어, 해머 패턴은 지지선에서 출현하면 강세 신호이지만 저항선에서 출현하면 신뢰도가 낮다. 패턴 자체에 방향적 색상을 부여하면 이론이 뒷받침하지 않는 인지적 편향을 유발한다. 방향 정보는 색상이 아닌 **라벨 텍스트**와 **수직 위치**(가격 위/아래)로 전달된다.

캔들 패턴은 차트 패턴과 구별하기 위해 별도의 연보라 색상(`#B388FF`)을 사용한다. 캔들 패턴(해머, 도지 등)은 1-3봉 단위의 단기 신호이고, 차트 패턴(삼각형, 이중바닥 등)은 수십 봉에 걸친 구조적 패턴이다. 두 유형은 서로 다른 분석 계층에 속하므로, 색상으로도 명확히 구분된다.
Shannon 채널 용량:
$$C = B \log_2\!\left(1 + \frac{S}{N}\right)$$

3채널 직교 색상 독립성:
$$\text{방향 채널} \perp \text{유형 채널} \perp \text{품질 채널}$$

단일 채널에 복수 의미 부여 시 정보 오류율:
$$P_e > 0 \quad \Leftrightarrow \quad H(\text{의미} \mid \text{색상}) > 0$$

| 기호 | 의미  |
|------|------|
| `#E05050` (UP) | 상승/매수 적색  |
| `#5086DC` (DOWN) | 하락/매도 청색  |
| `#ffeb3b` (NEUTRAL) | 중립 노랑  |
| `#A08830` (ACCENT) | 강조 금색 (구조선)  |
| `rgba(224,80,80,a)` (UP_FILL) | 상승 반투명 채우기  |
| `rgba(80,134,220,a)` (DOWN_FILL) | 하락 반투명 채우기  |
| `rgba(160,136,48,a)` (ACCENT_FILL) | 강조 반투명 채우기  |
| `#FF6B6B` (MA_SHORT) | 단기 이동평균선  |
| `#FFD93D` (MA_MID) | 중기 이동평균선  |
| `#6BCB77` (MA_LONG) | 장기 이동평균선 / 재무 양호  |
| `#C77DFF` (EMA_12) | EMA 12 지수이동평균  |
| `#7B68EE` (EMA_26) | EMA 26 지수이동평균  |
| `#FF8C42` (BB) | 볼린저밴드 상/하단  |
| `rgba(255,140,66,0.4)` (BB_MID) | 볼린저밴드 중심선  |
| `#E040FB` (ICH_TENKAN) | 일목균형 전환선  |
| `#00BFA5` (ICH_KIJUN) | 일목균형 기준선  |
| `rgba(129,199,132,0.35)` (ICH_SPANA) | 일목균형 선행스팬A (양운)  |
| `rgba(239,154,154,0.35)` (ICH_SPANB) | 일목균형 선행스팬B (음운)  |
| `#78909C` (ICH_CHIKOU) | 일목균형 후행스팬  |
| `#76FF03` (KALMAN) | 칼만 필터 추세선  |
| `#ff9800` (RSI) | RSI 오실레이터  |
| `#B0BEC5` (VOL_MA) | 거래량 이동평균 (청회색)  |
| `#2962ff` (MACD_LINE) | MACD 선  |
| `#ff9800` (MACD_SIGNAL) | MACD 시그널선  |
| `#7CB342` (STOCH_K) | 스토캐스틱 %K  |
| `#e91e63` (STOCH_D) | 스토캐스틱 %D  |
| `#26C6DA` (CCI) | 상품채널지수  |
| `#AB47BC` (ADX) | 평균방향성지수  |
| `#FF7043` (WILLR) | 윌리엄스 %R  |
| `#FFA726` (ATR_LINE) | ATR 변동성선  |
| `#B388FF` (PTN_CANDLE) | 캔들 패턴 연보라  |
| `rgba(179,136,255,a)` (PTN_CANDLE_FILL) | 캔들 패턴 채우기  |
| `#FF6B35` (PTN_INVALID) | 패턴 무효화 오렌지  |
| `rgba(150,220,200,0.65)` (PTN_BUY) | 차트 패턴 민트 테두리 (매수 통일)  |
| `rgba(150,220,200,0.12)` (PTN_BUY_FILL) | 차트 패턴 민트 채우기  |
| `rgba(150,220,200,0.65)` (PTN_SELL) | 차트 패턴 민트 테두리 (매도 통일)  |
| `rgba(150,220,200,0.12)` (PTN_SELL_FILL) | 차트 패턴 민트 채우기 (매도 통일)  |
| `rgba(200,200,200,0.55)` (PTN_NEUTRAL) | 중립 패턴 실버 (도지 등)  |
| `rgba(200,200,200,a)` (PTN_NEUTRAL_FILL) | 중립 패턴 채우기 (글로우, 추세영역)  |
| `rgba(200,200,200,0.45)` (PTN_STRUCT) | 구조선 실버 (넥라인 등)  |
| `rgba(255,107,53,0.55)` (PTN_STOP) | 손절가 오렌지  |
| `rgba(150,220,200,0.55)` (PTN_TARGET) | 목표가 민트  |
| `rgba(150,220,200,0.22)` (FZ_TARGET_NEAR) | 예측구간 목표 그라데이션 근단  |
| `rgba(150,220,200,0.05)` (FZ_TARGET_FAR) | 예측구간 목표 그라데이션 원단  |
| `rgba(150,220,200,0.45)` (FZ_TARGET_BORDER) | 목표가 점선  |
| `rgba(255,107,53,0.15)` (FZ_STOP_NEAR) | 예측구간 손절 그라데이션 근단  |
| `rgba(255,107,53,0.03)` (FZ_STOP_FAR) | 예측구간 손절 그라데이션 원단  |
| `rgba(255,107,53,0.25)` (FZ_STOP_BORDER) | 손절가 점선  |
| `rgba(130,210,185,0.8)` (PTN_MARKER_BUY) | 매수 패턴 마커 민트  |
| `rgba(130,210,185,0.8)` (PTN_MARKER_SELL) | 매도 패턴 마커 민트 (통일)  |
| `#131722` (CHART_BG) | 차트 배경 (KNOWSTOCK 테마)  |
| `#d1d4dc` (CHART_TEXT) | 차트 텍스트  |
| `#2a2e39` (CHART_BORDER) | 차트 테두리  |
| `#C9A84C` (DRAW_GOLD) | 드로잉 추세선 기본 금색  |
| `#787B86` (DRAW_GRAY) | 드로잉 수평/수직/피보나치 기본  |
| `#2962FF` (DRAW_BLUE) | 드로잉 파랑 (TradingView 관례)  |
| `#2962ff` (LINE_PRICE) | 라인 차트 가격선 (캔들 → 라인 전환 시)  |
| `#26C6DA` (DRAW_CYAN) | 드로잉 선택 핸들  |
| `#2ecc71` (TIER_A) | 신뢰도 Tier A 배지 (고신뢰)  |
| `#3498db` (TIER_B) | 신뢰도 Tier B 배지 (중신뢰)  |
| `#f39c12` (TIER_C) | 신뢰도 Tier C 배지 (저신뢰)  |
| `#95a5a6` (TIER_D) | 신뢰도 Tier D 배지 (데이터 부족)  |
| $B$ | Shannon 채널 대역폭  |
| $S/N$ | 신호 대 잡음비  |

> **이전 Stage 데이터:** 제3장(패턴 감지)에서 출력된 `direction` 필드(bullish/bearish/neutral)는 B열에서는 적색/청색으로, C열에서는 색상이 아닌 라벨 위치(가격 위/아래)로 표현된다. 동일한 `direction` 값이 열에 따라 서로 다른 시각 채널로 부호화된다.

| 방향 | 한국 (KRX) | 서양 (NYSE) | 근거 |
|------|-----------|------------|------|
| 상승/매수 | **적색** `#E05050` | 녹색 | 동아시아 문화에서 적색은 번영과 길조를 상징 |
| 하락/매도 | **청색** `#5086DC` | 적색 | 청색은 안정과 보수적 태도를 상징 |

| 열 | 영역 | 색상 체계 | 의미 |
|----|------|----------|------|
| B (차트) | 가격 움직임, 지표 | 적색/청색 | 가격 **방향** (상승/하락) |
| C (패턴) | 패턴 주석 | 민트/보라 | 분석 **유형** (차트/캔들) |
| D (재무) | 펀더멘털 지표 | 녹색/청색 | 재무 **품질** (양호/부진) |

**패턴 색상 통일 규칙:**

```javascript
PTN_BUY:  'rgba(150,220,200,0.65)',   // 민트
PTN_SELL: 'rgba(150,220,200,0.65)',   // [통일] 매도도 민트
```

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 문화적 색상 관례 (동아시아 적/청) | `js/colors.js` `KRX_COLORS.UP` / `KRX_COLORS.DOWN` | B열 차트 방향 표시 |
| Shannon 채널 독립성 (3채널 직교) | `css/style.css` `var(--up)` / `var(--down)` / `var(--fin-good)` | 전체 UI 색상 체계 |
| 패턴 색상 통일 (Bloomberg 표준) | `js/colors.js` `KRX_COLORS.PTN_BUY` = `KRX_COLORS.PTN_SELL` | C열 패턴 렌더러 |
| 캔들/차트 패턴 유형 구분 | `js/colors.js` `KRX_COLORS.PTN_CANDLE` (`#B388FF`) vs `PTN_BUY` (민트) | C열 계층 1-2 vs 3-6 |
| 재무 품질 색상 (방향과 독립) | `css/style.css` `var(--fin-good)` = `#6BCB77` | D열 재무 패널 |
| 신뢰도 Tier 배지 | `js/colors.js` `KRX_COLORS.TIER_A/B/C/D` | 패턴 라벨 배지 |
| 예측구간 색상 (손절/목표 구분) | `js/colors.js` `FZ_STOP_*` (오렌지) vs `FZ_TARGET_*` (민트) | C열 계층 8 |

### 4.3.1 인지 부하와 밀도 제어 (Cognitive Load & Density Control)
George Miller(1956)의 "마법의 숫자 7, ±2"는 인간의 작업 기억(working memory)이 동시에 처리할 수 있는 정보 청크(chunk)의 수를 7±2개로 한정한다는 실험적 발견이다. 이 한계를 초과하면 인지 부하가 포화 상태에 이르며, 추가 정보는 처리되지 못하고 오히려 기존 정보의 해석 정확도를 저하시킨다. 차트 시각화에서 이 한계를 무시하면 더 많은 패턴을 표시할수록 오히려 의사결정 품질이 하락하는 역효과가 발생한다.

`MAX_PATTERNS = 3`은 Miller(1956) 이론에서 직접 도출된 설계 상수이다. 패턴 1개는 약 5개의 시각 요소(글로우/브래킷 배경 + 폴리라인/추세영역 + 라벨 배지 + 수평선 + 예측구간)를 생성한다. 패턴 3개 × 5 = 15개 시각 요소에 캔들스틱 봉, 이동평균선, 볼린저밴드, 축 라벨을 더하면 전체 시각 원소 총량은 인지 용량의 포화점에 도달한다. 패턴을 4개 이상 표시하면 Miller 한계를 초과하며, 트레이더는 가장 중요한 신호를 식별하지 못하게 된다. 분석 완전성은 제3장(패턴 감지)에서 보존되며, 제4장의 필터링은 분석 정확도가 아닌 **인지적 표시 한계**만을 관리한다.

연산-표시 분리 원칙(Computation-Display Separation)은 vizToggles 아키텍처의 핵심이다. 사용자가 캔들/차트/신호/예측 토글을 켜고 끄더라도 제3장의 패턴 분석과 백테스트 연산은 항상 완전하게 실행된다. `_filterPatternsForViz()`는 렌더링 시점에서만 필터를 적용한다. 이 분리로 인해 사용자는 재분석 없이 표시 설정을 전환할 수 있으며, 백테스트 결과는 시각화 상태와 무관하게 신뢰할 수 있다.

타이포그래피 설계는 이중 서체 체계를 채택한다. Pretendard(한국어 최적화 가변 폰트)는 12px 700 굵기에서도 일관된 자폭을 유지하여 패턴 라벨과 한국어 텍스트에 사용된다. JetBrains Mono는 OpenType `tnum`(tabular numbers) 기능으로 소수점 정렬을 보장하며, 가격 라벨과 종목코드에 적용된다. 가격 데이터에 비례폭 폰트를 사용하면 자릿수에 따라 열 너비가 변동하여 시각적 비교가 어려워진다.
Miller(1956) 작업 기억 한계:
$$\text{작업 기억 용량} = 7 \pm 2 \quad \text{[정보 청크]}$$

차트 시각 원소 총량:
$$E_{\text{total}} = |\mathcal{P}_{\text{vis}}| \times \bar{e}_{\text{per\_pattern}} + E_{\text{base}}$$

밀도 제한 조건:
$$|\mathcal{P}_{\text{vis}}| \leq 3 \quad \Rightarrow \quad E_{\text{total}} \approx 15 + E_{\text{base}} \quad \text{(인지 포화 임계에 도달)}$$

| 기호 | 의미  |
|------|------|
| MAX_PATTERNS | 최대 패턴 표시 수  |
| MAX_EXTENDED_LINES | 최대 구조 연장선 표시 수  |
| MAX_DIAMONDS | 최대 다이아몬드 신호 표시 수  |
| MAX_STARS | 최대 별(고신뢰 복합) 신호 표시 수  |
| MAX_DIV_LINES | 최대 다이버전스선 표시 수  |
| RECENT_BAR_LIMIT | 렌더링 대상 최근 봉 수  |
| $\mathcal{P}_{\text{vis}}$ | 현재 표시 중인 패턴 집합  |
| $\bar{e}_{\text{per\_pattern}}$ | 패턴 1개당 평균 시각 요소 수  |
| $E_{\text{base}}$ | 기본 차트 요소 수 (캔들+지표+축)  |
| vizToggles | 4범주 시각화 토글 상태  |
| `_filterPatternsForViz()` | 렌더링 시점 패턴 필터 함수  |

> **이전 Stage 데이터:** 제3장에서 산출된 `patterns[]` 배열 전체는 Worker 분석 캐시(`_analyzeCache`)에 보존된다. 제4장의 밀도 제한은 `patternRenderer.render()` 호출 시점에 적용되며, 원본 분석 결과를 변경하지 않는다. `backtester.backtestAll()` 역시 표시 여부와 무관하게 전체 패턴에 대해 실행된다.

**타이포그래피 스케일**

| 폰트 | 용도 | 선정 근거 |
|------|------|----------|
| **Pretendard** 12px 700 | 패턴 라벨, 한국어 텍스트 | 한국어 최적화 가변 폰트, 12px에서도 일관된 자폭 유지 |
| **JetBrains Mono** | 가격 라벨, 종목코드 | 표 형식 숫자(`tnum`)로 소수점 정렬 보장 |

**밀도 제한 상수**

| 상수 | 값 | 근거 |
|------|---|------|
| MAX_PATTERNS | 3 | Miller(1956): 작업 기억 7±2 항목. 패턴 3개 × 5 시각요소 = 15개, 이미 인지 한계 |
| MAX_EXTENDED_LINES | 5 | 다수 역사적 패턴의 선 어수선함 방지 |
| MAX_DIAMONDS | 6 | 최근 신호에 집중 |
| MAX_STARS | 2 | 고신뢰 복합 신호 — 설계상 희소 |
| MAX_DIV_LINES | 4 | RSI/MACD 다이버전스선 — 구조적, 비과밀 |
| RECENT_BAR_LIMIT | 50 | 시간적 집중: 최근 ~50봉의 분석만 렌더링 |

**vizToggles 4범주**

| 범주 | 대상 패턴 유형 | 토글 끔 시 효과 |
|------|--------------|---------------|
| 캔들 | 캔들스틱 패턴 21종 (해머, 도지 등) | 글로우/브래킷 미표시, 분석은 유지 |
| 차트 | 차트 패턴 9종 (삼각형, 이중바닥 등) | 추세영역/폴리라인 미표시, 분석은 유지 |
| 신호 | 복합 신호 (다이아몬드, 별) | 신호 마커 미표시, 분석은 유지 |
| 예측 | 예측구간 (Forecast Zone) | 목표/손절 그라데이션 미표시, 분석은 유지 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| Miller(1956) 작업 기억 한계 (7±2) | `js/patternRenderer.js` `MAX_PATTERNS = 3` | C열 패턴 최대 표시 수 |
| 시각 원소 밀도 상한 | `js/patternRenderer.js` `MAX_EXTENDED_LINES = 5`; `js/signalRenderer.js` `MAX_DIAMONDS = 6` | 계층 9, SignalRenderer |
| 고신뢰 신호 희소성 설계 | `js/signalRenderer.js` `MAX_STARS = 2`, `MAX_DIV_LINES = 4` | SignalRenderer 별/괴리선 마커 |
| 시간적 집중 (최근 봉 우선) | `js/signalRenderer.js` `RECENT_BAR_LIMIT = 50` | SignalRenderer 렌더 파이프라인 |
| 연산-표시 분리 원칙 | `js/appState.js` `vizToggles` + `js/appUI.js` `_filterPatternsForViz()` | 4범주 렌더 필터 |
| 한국어 가변폰트 (자폭 안정성) | `css/style.css` Pretendard CDN | C열 패턴 라벨 배지 |
| Tabular numbers (소수점 정렬) | `css/style.css` `font-feature-settings: "tnum"` + JetBrains Mono | B열 가격 라벨 |
| 라벨 충돌 회피 | `js/patternRenderer.js` 계층 7 수직 오프셋 알고리즘 | 패턴 라벨 위치 조정 |

\newpage


# 제5장: www.cheesestock.co.kr — 최종 전달

> 이론적 정합성 체인의 최종 단계이다. 학술적으로 기초를 갖추고,
> 통계적으로 검증되며, 시각적으로 부호화된 분석이 웹 브라우저를 통해
> 최종 사용자에게 어떻게 전달되는지를 논증한다.


### 5.1.1 웹 전달 아키텍처 (Web Delivery Architecture)
CheeseStock은 번들러(webpack, vite 등)를 의도적으로 배제한다. 19개 JS 파일이 `index.html`에서 `<script defer>` 태그로 직접 로드된다. 이 설계의 핵심 근거는 투명성 우선 원칙이다: 모든 함수, 상수, 공식이 브라우저 개발자도구의 소스 패널에서 직접 열람 가능하다. 금융 분석 도구에서 공식의 정확성이 도구 편의성보다 우선하며, 이는 의식적 설계 선택이다.

19개 파일의 결정론적 로드 순서는 5-Stage 이론 체인에 정확히 대응된다. 데이터 계층(colors, data, api, realtimeProvider)이 먼저 로드되어 Stage 1을 구성하고, 이론 엔진(indicators, patterns, signalEngine, backtester)이 Stage 2-3을, 렌더링 계층(chart, patternRenderer, signalRenderer, drawingTools)이 Stage 4를, 어플리케이션 계층(sidebar, patternPanel, financials, appState, appWorker, appUI, app)이 Stage 5를 담당한다. 이 순서는 전역 변수 의존성 체인이므로 위반 시 참조 오류가 발생한다.

WS/File 이중 모드는 형식적 동치 조건을 보장한다. 두 모드 모두 동일한 OHLCV 스키마를 입력으로 사용하므로 지표·패턴 연산의 입력 공간이 동일하다. 신뢰도 조정 계층의 거시·수급·파생 데이터는 JSON 파일에서 로드되며, 이 파일은 WS/File 모드와 무관하게 동일한 경로에서 동일한 내용을 참조한다. 따라서 데이터 신선도 가드가 통과하는 한 분석 결과의 모드 간 편차는 발생하지 않는다.

서비스 워커(`sw.js`)는 Cache-First 전략을 채택한다. 오프라인 상태에서도 218개 전체 공식이 가용하며(JS 내장, 서버 의존 없음), 캐시된 OHLCV 데이터에 대한 패턴 감지가 작동하고, 마지막 취득 거시데이터로 신뢰도 조정이 수행된다. 이론적 저하는 없으며 데이터 신선도만 영향을 받는다. `CACHE_NAME` 버전을 변경하면 구버전 캐시가 무효화된다.
$$\text{Analysis}(\text{OHLCV}_{s,t},\, \text{MacroJSON}_t) \perp \text{TransportMode}$$

임의의 종목 $s$와 시점 $t$에 대해, 분석 출력은 데이터 전달 경로(WS 소켓 또는 HTTP fetch)에 무의존적이다. 이는 Stage 3의 모든 지표(I-1..I-31), 패턴(P-1..P-32), 신호(S-1..S-22), 신뢰도 조정(CONF-계층1..6)이 OHLCV 배열과 JSON 매크로 파일만을 입력으로 취하고 전달 메커니즘을 참조하지 않기 때문에 구성적으로 보장된다.

| 기호 | 의미  |
|------|------|
| $s$ | 종목 코드  |
| $t$ | 시점 인덱스  |
| $\text{OHLCV}_{s,t}$ | 종목 $s$의 시점 $t$ 캔들 배열  |
| $\text{MacroJSON}_t$ | 거시/수급/파생 JSON 파일  |
| $\perp$ | 통계적 독립(무의존)  |
| $\textcolor{stageThreeMarker}{\text{analysis}}$ | Stage 3 패턴·신호·신뢰도 결과  |
| $\textcolor{stageFourMarker}{\text{chart}}$ | Stage 4 차트 렌더링 결과  |
| CACHE\_NAME | 서비스 워커 캐시 버전 식별자  |
| STATIC\_ASSETS | 서비스 워커 캐시 대상 파일 목록  |
| TransportMode | WS 소켓 또는 HTTP fetch  |

> **이전 Stage 데이터:** $\textcolor{stageFourMarker}{\text{chart}}$는 Stage 4에서 렌더링된 차트 캔버스이다 — PatternRenderer, SignalRenderer, DrawingTools가 ISeriesPrimitive Canvas2D 계층을 통해 생성한 픽셀 출력. $\textcolor{stageThreeMarker}{\text{analysis}}$는 Stage 3에서 산출된 패턴·신호·신뢰도 결과로서 Worker 스레드가 postMessage로 메인 스레드에 전달한 JSON 객체이다.

**로드 그룹 테이블**

| 로드 그룹 | Stage | 파일 | 역할 |
|-----------|-------|------|------|
| 데이터 계층 | 제1장 | colors, data, api, realtimeProvider | 데이터 취득 |
| 이론 엔진 | 제2-3장 | indicators, patterns, signalEngine, backtester | 학술적 연산 |
| 렌더링 | 제4장 | chart, patternRenderer, signalRenderer, drawingTools | 시각적 변환 |
| 어플리케이션 | 제5장 | sidebar, patternPanel, financials, appState, appWorker, appUI, app | 사용자 전달 |

**4열 그리드 레이아웃**

```
┌──────────┬──────────────────────────┬──────────┬────────────┐
│    A열    │          B열             │   C열    │    D열     │
│ 사이드바   │       메인 차트           │ 패턴     │ 재무       │
│  260px   │       flex:1             │  패널    │   패널     │
│          │                          │  240px   │   380px    │
│ 2,700+   │  TradingView LWC        │         │            │
│ 종목     │  + PatternRenderer      │ 패턴    │ PER/PBR    │
│ 가상     │  + SignalRenderer       │ 카드    │ ROE/ROA    │
│ 스크롤   │  + DrawingTools         │ 티어    │ 추세       │
│          │  + 서브차트              │ 배지    │ 차트       │
└──────────┴──────────────────────────┴──────────┴────────────┘
```

**이중 모드 테이블**

| 측면 | WebSocket 모드 | 파일 모드 |
|------|---------------|----------|
| 데이터 원천 | 키움증권 OCX 실시간 | 정적 JSON 파일 |
| 대상 사용자 | 전문 트레이더 | 일반 사용자, 데모 |
| 지연 | ~100ms 틱 | 해당 없음 (사전 연산) |
| 분석 | 동일한 파이프라인 | 동일한 파이프라인 |
| 적용 이론 | **동일** | **동일** |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|----------|--------------|----------|
| 결정론적 로드 순서 (의존성 역전 원칙) | `index.html` `<script defer>` 19파일 | 전역 변수 의존성 체인 |
| 이중 모드 동치 조건 | `js/api.js` `dataService.getCandles()` | WS/File 자동 전환, 도메인 감지 |
| Cache-First 서비스 워커 | `sw.js` `CACHE_NAME`, `STATIC_ASSETS` | 오프라인 218개 공식 가용 |
| 4열 정보 아키텍처 (Rosenfeld-Morville) | `css/style.css` 4-column grid | A(탐색)/B(분석)/C(패턴)/D(재무) 열 분리 |


### 5.2.1 사용자 전달과 반응형 설계 (User Delivery & Responsive Design)
최종 전달 문제(Last Mile Problem)는 수학적으로 정밀한 이론 출력을 사용자 행동으로 연결하는 과제이다. IC = 0.051, DD = 2.8σ, MCS v2 = 62.4와 같은 원시 출력은 그 자체로는 사용자에게 직관적이지 않다. CheeseStock의 Stage 5는 이 격차를 티어 시스템, 토스트 알림, 반응형 레이아웃의 세 가지 메커니즘으로 해소한다.

5단계 티어 시스템(S/A/B/C/D)은 통계적 유의성을 실행 가능한 범주로 변환한다. 각 티어는 IC(정보계수) 임계값, 수익률비, 최소 표본 수의 세 기준을 복합적으로 적용하여 `backtester.js`의 `_assignGrade()` 함수에서 산출된다. 색상 배지(녹색/청색/호박색/회색)는 KRX 색상 규약과 독립적으로, 패턴의 통계적 품질 수준만을 시각화한다.

정보 병목(Information Bottleneck) 이론에 의하면 복잡한 입력 분포에서 과업 관련 정보만을 추출하는 최적 압축 표현이 존재한다. 토스트 알림 "N개 패턴 감지됨"은 이 원리를 구현한다: 30+ 지표 × 45 패턴 × 10 신뢰도 조정의 복합 파이프라인 출력을 단일 행동 유도 문구로 압축한다. 사용자가 추가 정보를 원할 경우 C열 패턴 패널에서 상세 정보를 확인할 수 있다.

반응형 8분기점 설계의 핵심 원칙은 이론적 완전성이 모든 화면 크기에서 유지된다는 것이다. 분석 파이프라인은 화면 크기와 무관하게 동일하게 실행되며, 모바일 사용자도 데스크톱 사용자와 동일한 IC 검증, 신뢰도 조정, 패턴 신호를 수신한다. 화면 크기에 따라 변화하는 것은 정보의 표시 방식이지 정보의 내용이 아니다.
$$\text{Toast} = f_{\text{compress}}\!\left(\bigcup_{i=1}^{45} \text{Pattern}_i \times \prod_{k=1}^{6} \text{CONF}_k\right) \to \text{"N개 패턴 감지됨"}$$

여기서 $f_{\text{compress}}$는 정보 병목 원리에 의한 손실 압축 함수이다. 45개 패턴의 합집합에 6개 신뢰도 계층의 곱을 적용한 전체 결과가 토스트 단일 문구로 압축된다.

| 기호 | 의미  |
|------|------|
| $f_{\text{compress}}$ | 정보 병목 압축 함수  |
| $\text{Pattern}_i$ | 제 $i$번 패턴 (i = 1..45)  |
| $\text{CONF}_k$ | 제 $k$번 신뢰도 조정 계층 (k = 1..6)  |
| S 티어 | IC > 0.03, 수익률비 > 1.5, n ≥ 100  |
| A 티어 `#2ecc71` | IC > 0.02, 수익률비 > 1.3, n ≥ 50  |
| B 티어 `#3498db` | IC > 0.01, 수익률비 > 1.1, n ≥ 20  |
| C 티어 `#f39c12` | IC > 0.003  |
| D 티어 `#95a5a6` | IC ≤ 0.01, 수익률비 ≤ 1.0  |
| IC | 정보계수 (Information Coefficient)  |

> **이전 Stage 데이터:** $\text{Pattern}_i$는 Stage 3 `patternEngine.analyze()`의 출력이다. $\text{CONF}_k$는 Stage 3 신뢰도 조정 계층(거시/수급/파생/Merton DD/변동성/행동)이 적용한 승산 계수이다.

**원시 출력 → 해결 방안 테이블**

| 원시 출력 | 사용자 문제 | 해결 방안 |
|----------|-----------|----------|
| IC = 0.051 | "0.051이 무엇을 의미하는가?" | 티어 시스템: S/A/B/C/D + 색상 배지 |
| 패턴 신뢰도 = 0.73 | "73%가 좋은 것인가?" | 동종 패턴 대비 문맥적 비교 |
| MCS v2 = 62.4 | "거시 전망이 어떤가?" | 체제 라벨: "강세" + 색상 부호화 |
| Merton DD = 2.8σ | "이 기업이 안전한가?" | 부도거리 범주 표시 |
| WLS β = 0.032 | "주가가 오를 것인가?" | 기대수익률 %, 승률 %, 위험/보상 비율 |

**티어 시스템 테이블**

| 티어 | IC 임계값 | 수익률비 | 최소 표본 | 사용자 의미 | 배지 색상 |
|------|----------|---------|----------|-----------|----------|
| S | > 0.03 | > 1.5 | ≥ 100 | 통계적으로 탁월 | — |
| A | > 0.02 | > 1.3 | ≥ 50 | 유의미한 예측력 | 녹색 `#2ecc71` |
| B | > 0.01 | > 1.1 | ≥ 20 | 최소 비무작위 신호 | 청색 `#3498db` |
| C | > 0.003 | — | — | 약함, 확인 필요 | 호박색 `#f39c12` |
| D | ≤ 0.01 | ≤ 1.0 | — | 감지된 우위 없음 | 회색 `#95a5a6` |

**반응형 8분기점 테이블**

| 화면 폭 | 표시 열 | 적응 방식 |
|---------|--------|----------|
| > 2000px | A + B + C + D (확장) | 넓은 패널, 상세 표시 |
| ≤ 1440px | A + B + C + D (축소) | 패널 폭 축소 |
| ≤ 1366px | A + B + C + D (추가 축소) | sidebar 220px, rpanel 300px |
| ≤ 1200px | A + B + D | C열 → 슬라이드아웃 오버레이 |
| ≤ 1024px | B + D | A열 → 고정 서랍 (토글) |
| ≤ 768px | B만 | D열 → 하단 시트 (60vh), 단일 열 |
| ≤ 480px | B만 (모바일) | 전체 폭 차트, 최소 UI |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|----------|--------------|----------|
| 티어 시스템 (통계적 유의성 범주화) | `js/backtester.js` `_assignGrade()` | S/A/B/C/D 분류, IC·수익률비·표본수 기준 |
| 토스트 알림 (정보 병목 압축) | `js/appUI.js` `showToast()` | 30+ 지표 파이프라인 → 단일 문구 전달 |
| 반응형 8분기점 (Rosenfeld-Morville IA) | `css/style.css` 8개 `@media` 쿼리 | 모든 화면 폭에서 이론적 완전성 유지 |
| 최종 전달 문제 (Nielsen HCI 10휴리스틱) | `js/appUI.js` 온보딩·툴팁 | 시스템 상태 가시성, 오류 방지 |


### 5.3.1 추적 경로와 전달 도출 요약 (Traceability & Delivery Summary)
이론적 정합성 체인의 최종 검증은 5개 대표 추적 경로를 통해 수행된다. 각 경로는 Stage 1(데이터 취득)에서 Stage 5(사용자 확인)까지 완전히 관통하며, 중간 단계 어느 곳도 생략되지 않음을 증명한다. 이 추적 가능성(traceability)은 금융 분석 도구의 핵심 신뢰 요건이다: 사용자가 화면에서 보는 모든 신호는 검증 가능한 학술 이론과 코드 함수로 역추적될 수 있어야 한다.

5개 추적 경로는 CheeseStock이 다루는 데이터 원천의 다양성을 대표한다: OHLCV 기술 분석(추적 1), DART 재무제표 기반 신용위험(추적 2), ECOS 거시경제 데이터(추적 3), KRX 수급 데이터(추적 4), VKOSPI 변동성 지수(추적 5). 각 경로가 독립적인 데이터 원천을 출발점으로 삼으면서도 동일한 신뢰도 조정 체인과 시각화 계층을 거쳐 사용자에게 전달된다는 사실이 아키텍처의 모듈성을 입증한다.

사용자 여정 10단계는 인지적 설계 원칙에 따라 구성된다. 초기 3단계(데이터 로드, Worker 초기화, 종목 선택)는 시스템 상태의 가시성을 확보하고, 중간 4단계(차트 렌더링, 거시 데이터 로드, 패턴 분석, 신뢰도 조정)는 백그라운드에서 진행되며, 최종 3단계(시각 오버레이, 패턴 패널, 재무 패널)가 사용자에게 최종 출력을 제시한다. 이 순서는 지각된 응답 시간을 최소화하면서 분석의 완전성을 보장한다.

**추적 경로 1: OHLCV → 골든크로스 → 매수 신호**

```
제1장: pykrx가 삼성전자(005930) OHLCV 캔들 다운로드
       → data/kospi/005930.json 저장
제2장: 2.2절 시계열분석 — EMA를 지수평활로 정의
       α = 2/(n+1), EMA_t = α·P_t + (1-α)·EMA_{t-1}
제3장: calcEMA(종가, 12)와 calcEMA(종가, 26) 산출 (I-02)
       signalEngine이 EMA_12 > EMA_26 상향 교차 감지 (골든크로스, S-1)
       복합 신호: "buy_goldenCrossRsi" (신뢰도 58%)
제4장: SignalRenderer가 교차 봉에 다이아몬드 마커 렌더링
       배경 수직 밴드가 골든크로스 구간 표시
제5장: 사용자는 차트 위 금색 다이아몬드 + 토스트 "1개 신호 감지됨" 확인
```

**추적 경로 2: DART → Merton 부도거리 → 신용위험 표시**

```
제1장: DART API가 재무제표 반환 (총자산, 부채, 자본)
       → data/financials/{code}.json 저장
제2장: 2.6.13절 신용위험이론 — Merton(1974) 구조적 모형
       기업 자산가치 A가 기하 브라운 운동 추종
제3장: DD = (ln(A/D) + (r - σ²/2)T) / (σ√T)
       _applyMertonDD()가 DD 수준에 따라 패턴 신뢰도 조정
제4장: 재무 패널(D열)에 부도거리 표시 (색상 범주 부호화)
제5장: 사용자는 DD 값과 위험 해석을 재무 패널에서 확인
```

**추적 경로 3: ECOS → MCS v2 → 거시 신뢰도 → 패턴 불투명도**

```
제1장: ECOS API가 기준금리, 국고채 수익률, CPI 반환
       → data/macro/macro_latest.json 저장
제2장: 2.5.1-2.5.6절 거시경제학 — IS-LM 모형, 테일러 준칙 갭,
       수익률곡선 기울기, MCS v2 복합점수
제3장: MCS v2 복합점수(0-100) 산출
       _applyPhase8Confidence()가 체제 계수로 패턴 신뢰도 승산
       강세 체제: 매수 패턴 × 1.06, 매도 패턴 × 0.92
제4장: 패턴 라벨 불투명도가 조정된 신뢰도 반영 (높을수록 진하게)
제5장: 사용자는 거시 체제에 따라 달라지는 패턴 시각적 강조를 확인
```

**추적 경로 4: KRX 수급 → 투자자 신호 → 복합 신호**

```
제1장: KRX API가 외국인/기관/개인 순매수 데이터 반환
       → data/derivatives/investor_summary.json 저장
제2장: 2.7.3절 LSV 군집행동 모형, 2.6.12절 Kyle(1985) 정보거래자 모형
       외국인·기관 수급이 가격 발견 과정에 미치는 영향
제3장: 투자자 수급 신호: 외국인 순매수 > 임계값 → 강세 확인
       복합 신호: "strongBuy_hammerRsiVolume"이 기관 매수로 증폭
제4장: 별 마커(고신뢰)가 신호 봉에 렌더링
제5장: 사용자는 차트 위 별 마커 + C열 패턴 카드 확인
```

**추적 경로 5: VKOSPI → 변동성 체제 → 신뢰도 조정**

```
제1장: data/vkospi.json 로드 (download_vkospi.py 오프라인 수집)
제2장: 2.6.10절 BSM — 내재변동성이 시장 공포의 척도
       2.6.11절 VRP — 분산위험프리미엄 = IV² - HV²
제3장: 변동성 체제 분류:
       VKOSPI < 15: 저변동 → 패턴 신뢰도 상승 (좁은 범위)
       VKOSPI 15-22: 정상 → 기준 신뢰도
       VKOSPI 22-30: 상승 → 주의, 넓은 손절
       VKOSPI > 30: 위기 → 신뢰도 감소, 방어적 자세
제4장: CUSUM 임계값 적응 (고변동 → 3.5, 저변동 → 1.5)
제5장: 사용자의 패턴 신호가 변동성 체제에 따라 묵시적으로 조정
```

**사용자 여정 10단계**

```
cheesestock.co.kr 접속
    │
    ├── [1] index.json 로드 → "2,700+ 종목" (제1장 데이터 준비)
    ├── [2] Worker 초기화 → "분석 Worker 초기화 완료" (제3장 엔진 준비)
    ├── [3] 사용자가 사이드바에서 종목 선택 (가상 스크롤)
    │
    ├── [4] OHLCV 캔들 렌더링 → 차트 2초 내 표시 (제4장 활성)
    ├── [5] 거시/채권 데이터 백그라운드 로드 (제2장 맥락)
    │
    ├── [6] 패턴 분석 실행 (Worker 스레드) → "5개 패턴 감지됨"
    │       (제3장: 지표 → 패턴 → 신호 → 백테스트)
    │
    ├── [7] 신뢰도 조정 적용 (거시, 미시, 파생, Merton DD)
    │       (제2장 → 제3장 신뢰도 체인)
    │
    ├── [8] 시각 오버레이 렌더링 (제4장: 9개 계층)
    ├── [9] 패턴 패널 채우기 (C열 — 제5장 UI)
    └── [10] 재무 패널 갱신 (D열 — DART 데이터)
```

**종합 도출 요약 테이블**

| Stage | 장 | 핵심 변환 | 학문 기반 |
|-------|----|----------|---------|
| 1 (데이터) | 제1장 | 원천 → 정제 OHLCV/재무/거시 | 정보과학, 데이터 공학 |
| 2 (이론) | 제2장 | 원시 수치 → 이론적 모형 | 물리·수학·통계·경영·경제·금융·행동 |
| 3 (분석) | 제3장 | 이론 → 지표·패턴·신호·신뢰도 구현 | 기술적 분석, 계량경제, 금융공학 |
| 4 (시각화) | 제4장 | 수치 → 시각적 부호 (색·형·위치) | 인지심리, 정보이론, 컴퓨터 그래픽스 |
| 5 (전달) | 제5장 | 부호 → 사용자 인지·행동 | 소프트웨어공학, HCI, 웹공학 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|----------|--------------|----------|
| 전 Stage 추적 가능성 | `js/appWorker.js` `_loadMarketData()` | 5개 데이터 원천 → 신뢰도 체인 |
| OHLCV → 기술 신호 (추적 1) | `js/signalEngine.js` `goldenCross` (S-1) | EMA 교차 감지 → 다이아몬드 마커 |
| DART → Merton DD (추적 2) | `js/appWorker.js` `_applyMertonDD()` | 재무제표 → 패턴 신뢰도 조정 |
| ECOS → MCS v2 (추적 3) | `js/appWorker.js` `_applyPhase8ConfidenceToPatterns()` | 거시 체제 → 패턴 불투명도 |
| KRX 수급 → 복합 신호 (추적 4) | `js/appWorker.js` `_loadMarketData()` investor | 기관 수급 → 신호 증폭 |
| VKOSPI → 변동성 체제 (추적 5) | `js/appWorker.js` `_macroLatest.vkospi` | 내재변동성 → 신뢰도 상하 조정 |
| 사용자 여정 10단계 | `js/app.js` `init()` → `appWorker.js` → `appUI.js` | 전체 5-Stage 파이프라인 순서화 |

\newpage


# 부록 A: 주요 용어 대조표

| 한국어 | 영어 원어 | 약어 |
|------------|------|------|
| 자본자산가격결정모형 | Capital Asset Pricing Model | CAPM |
| 차익거래가격결정이론 | Arbitrage Pricing Theory | APT |
| 효율적 시장가설 | Efficient Market Hypothesis | EMH |
| 정보계수 | Information Coefficient | IC |
| 이분산성 | Heteroskedasticity | --- |
| 극단값이론 | Extreme Value Theory | EVT |
| 내재변동성 | Implied Volatility | IV |
| 분산위험프리미엄 | Variance Risk Premium | VRP |
| 부도거리 | Distance-to-Default | DD |
| 전망이론 | Prospect Theory | --- |
| 군집행동 | Herding Behavior | --- |
| 처분효과 | Disposition Effect | --- |
| 허스트지수 | Hurst Exponent | H |
| 칼만필터 | Kalman Filter | --- |
| 은닉마르코프모형 | Hidden Markov Model | HMM |
| 가중최소제곱법 | Weighted Least Squares | WLS |
| 경제물리학 | Econophysics | --- |
| 이징모형 | Ising Model | --- |
| 멱법칙 | Power Law | --- |
| 자기조직임계성 | Self-Organized Criticality | SOC |
| 볼린저밴드 | Bollinger Bands | BB |
| 상대강도지수 | Relative Strength Index | RSI |
| 이동평균수렴확산 | Moving Average Convergence Divergence | MACD |
| 평균진폭 | Average True Range | ATR |
| 거래량누적지표 | On-Balance Volume | OBV |
| 수익률곡선 | Yield Curve | --- |
| 섹터로테이션 | Sector Rotation | --- |
| 시장미시구조 | Market Microstructure | --- |

---


\newpage


# 부록 B: 전체 변수 일람표

> 본 시스템에서 사용되는 모든 핵심 변수의 정의와 단위를 일괄 정리한다.
> 각 변수는 제1~5장의 해당 절로 역추적 가능하다.

\small

## B.1 가격·거래 변수 (OHLCV 파생)

| 변수 | 정의 | 단위 |
|------|------|------|
| Pt (close) | 종가 | 원 (KRW) |
| Ht (high) | 고가 | 원 |
| Lt (low) | 저가 | 원 |
| Ot (open) | 시가 | 원 |
| Vt (volume) | 거래량 | 주 |
| rt | 일별 수익률 (Pt - Pt₋1)/Pt₋1 | 무차원 |
| ln rt | 로그수익률 ln(Pt/Pt₋1) | 무차원 |
| DVOLt | 일별 거래대금 Pt × Vt | 원 |

## B.2 지표 변수

| 변수 | 정의 | 단위 |
|------|------|------|
| SMA(n) | 단순이동평균 (n=5/20/60) | 원 |
| EMA(n) | 지수이동평균 (n=12/26/9) | 원 |
| BB upper/lower | 볼린저 밴드 (n=20, k=2) | 원 |
| RSI | 상대강도지수 (n=14) | 0-100 (무차원) |
| ATR | 평균진폭 (n=14) | 원 |
| OBV | 누적거래량 | 주 (누적) |
| 전환선/기준선 | 일목균형표 (9/26/52) | 원 |
| H | 허스트 지수 (minW=10) | 무차원 (0-1) |
| MACD line | EMA(12)−EMA(26), 시그널 EMA(9) | 원 |
| σ_(EWMA)² | EWMA 조건부 분산 (λ=0.94) | 무차원 (일별²) |
| HV_(Park) | 파킨슨 실현변동성 (n=20) | 무차원 (연율) |
| VRP | 분산위험프리미엄 | 무차원 (연율²) |
| ILLIQ | 아미후드 비유동성 (n=20) | 원⁻¹ |
| x̂t | 칼만 필터 추정가 (Q=0.01, R=1.0) | 원 |

## B.3 거시경제 변수

| 변수 | 정의 | 단위 | CONF 요인 |
|------|------|------|----------|
| bok_rate | 한국은행 기준금리 | % (연율) | F7, F9 |
| fed_rate | 미국 Fed Funds Rate | % (연율) | F9 |
| cpi_yoy | 소비자물가 전년비 | % (YoY) | 테일러 준칙 |
| korea_cli | OECD 경기선행지수 | 지수 (100 기준) | F1, MCS |
| vix | CBOE VIX | % | F8, RORO |
| taylor_gap | 테일러 갭 | %p | F7 |
| mcs | MCS v2 복합점수 | 0-100 (백분위) | F6 |
| rate_diff | 한미 금리차 | %p | F9 |
| cycle_phase | 경기순환 국면 | 범주형 | F1 |

## B.4 채권 변수

| 변수 | 정의 | 단위 | CONF 요인 |
|------|------|------|----------|
| slope_10y3y | 수익률 곡선 경사 | %p | F2 |
| curve_inverted | 곡선 역전 여부 | boolean | F2 |
| aa_spread | AA- 신용 스프레드 | %p | F3 |
| credit_regime | 신용 국면 | 범주형 | F3 |

## B.5 파생상품 변수

| 변수 | 정의 | 단위 | CONF 요인 |
|------|------|------|----------|
| basis | 선물 베이시스 | 포인트 | D1 |
| basisPct | 베이시스 비율 | % | D1 |
| pcr | 풋/콜 비율 | 무차원 (비율) | D2 |
| VKOSPI | 변동성지수 | % | S-28, RORO |
| foreign_net_1d | 외국인 순매수 | 억원 | D3 |
| market_short_ratio | 공매도 비율 | % | D5 |

## B.6 재무 변수

| 변수 | 정의 | 단위 | 용도 |
|------|------|------|------|
| revenue | 매출액 | 원 (KRW) | PSR, CAGR |
| net_income | 당기순이익 | 원 | PER, ROE |
| total_assets | 자산총계 | 원 | ROA, Merton V |
| total_liabilities | 부채총계 | 원 | Merton D |
| equity | 자본총계 | 원 | PBR, ROE |
| eps | 주당순이익 | 원/주 | PER |
| marketCap | 시가총액 | 원 | Merton E, PER |

## B.7 신뢰도 체인 출력 변수

| 변수 | 정의 | 단위 | 클램프 범위 |
|------|------|------|-----------|
| macroMult | 거시 승수 | 무차원 (배수) | [0.70, 1.25] |
| microMult | 미시 승수 | 무차원 (배수) | [0.55, 1.15] |
| derivMult | 파생 승수 | 무차원 (배수) | [0.70, 1.30] |
| mertonMult | Merton DD 승수 | 무차원 (배수) | [0.75, 1.15] |
| roroMult | RORO 승수 | 무차원 (배수) | [0.92, 1.08] |
| confidence | 최종 신뢰도 | 0-100 (점수) | [10, 100] |
| IC | 정보계수 | 무차원 (-1~+1) | — |
| WFE | Walk-Forward 효율 | % (비율) | — |

---

\normalsize

*총 변수 수: 58개. 본 일람표는 시스템 전체 변수의 정의-단위-원천을 단일 참조점으로 제공한다.*

---

*CheeseStock ANATOMY V8 --- 이론적 정합성 흐름 (한국어판)*
*작성일: 2026년 4월*