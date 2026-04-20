---
title: "CheeseStock ANATOMY V8: 이론적 정합성 흐름"
subtitle: "원천 데이터에서 최종 전달까지 --- KRX 기술적 분석의 학술적 계보"
author: "이선호, 최민규"
date: "2026년 4월"
version: "V8 KO"
---

# CheeseStock ANATOMY V8

## 서론 {.unlisted .unnumbered}

한국 주식시장에 KOSPI와 KOSDAQ 합산 2,700여 종목이 상장되어 있다. 매일 갱신되는 가격, 거래량, 재무제표, 거시경제 데이터의 총량은 개인의 인지 능력으로 직접 처리할 수 있는 범위를 넘어선다. 기술적 분석은 이 과부하를 체계적으로 다루기 위해 발전해 왔으며, 이동평균, 볼린저 밴드, RSI, MACD 같은 도구들은 수십 년간 투자 판단을 보조해 왔다. 각 지표의 수학적 기원은 Wilder, Bollinger, Appel 같은 학자와 실무자의 저작에 잘 기록되어 있다.

이 지표들이 하나의 분석 시스템 안에서 결합되기 시작하면, 흥미로운 질문이 떠오른다. 이동평균의 골든크로스와 MACD 다이버전스가 동시에 나타날 때, 그 복합 신호의 신뢰도는 어디에서 정당화되는가? 거시경제 국면이 바뀔 때 패턴의 신뢰도를 조정하는 계수는 어떤 이론에 기초하는가? 개별 지표의 학술적 근거는 분명하지만, 그것들을 조합하는 규칙은 대부분 경험적 관례에 머물러 있다. 지표의 기원은 학문적이되 결합의 규칙은 관습적인 것 — 이 비대칭을 해소하는 것이 기술적 분석의 다음 단계가 된다.

CheeseStock을 설계하면서 이 과제를 직접 다루게 되었다. 5개 공공 API에서 수집한 데이터가 분석 체계를 거치는 과정을 한 단계씩 추적해 나갔을 때, 하나의 구조가 드러났다. 종가 한 건에서 출발한 계산이 경제물리학의 볼츠만 분포, 프랙탈 수학의 허스트 지수, 금융학의 CAPM, 행동재무학의 군집행동 이론으로 각각 분기하며, 이 분기들은 신뢰도 조정이라는 공통 관문에서 다시 합류한다. 단일 종가가 물리학, 수학, 통계학, 금융학을 경유하여 투자 판단에 도달하는 이 경로는 — 각 전환이 학술 문헌에 의해 정당화될 수 있다는 것을 확인한 순간 — 하나의 이론적 체인으로 성립한다. 이 발견이 본 문서의 출발점이 되었다.

본 문서는 그 체인 전체를 추적한다. 원천 데이터 수집에서 최종 화면 전달까지 5개 장을 설계하되, 핵심 원칙은 하나다. 어떤 연산도 그 이전 단계의 학술적 산출물에 기초하지 않으면 존재할 수 없다는 것이다. CAPM 베타는 백테스터의 거래비용 정규화에 연계되고, Fama-French 3-팩터 분해는 종목별 재무 패널에 표시되며, Hamilton의 레짐 전환 모형은 `_staleDataSources` 게이트와 Phase 8 국면 분류의 레이블 체계로 수렴된다. 세 이론은 단일 체인으로 순차 연결되지 않고 각각 기술적 분석 파이프라인의 독립적 소비자로서 병렬 기여하되, 이들 병렬 경로가 하나의 정합적 구조를 형성한다는 점은 변하지 않는다. 7개 학문 분야(물리·수학·통계·경영·경제·금융·행동재무, Ch2.1~Ch2.7 순서)에 걸친 48개 학술 문서가 이 구조의 근거를 구성하며, 시스템이 산출하는 모든 수치에 대해 "이것은 어디에서 왔는가"라는 질문에 학술 문헌의 수준까지 추적 가능한 답을 제시하는 것이 본 문서의 목적이다.

---

\newpage

# 제1장: 데이터와 API — 원천 자료

\enlargethispage{2\baselineskip}

투자 판단에는 네 가지 층위의 질문이 있다. 이 종목의 가격 추세는 어디로 향하는가(가격), 이 기업은 벌어들이는 돈에 비해 비싼가(펀더멘털), 시장 전체의 방향은 확장인가 수축인가(거시경제), 그리고 경기 자체는 어디에 있는가(실물 선행). 각 질문에 답하려면 서로 다른 원천의 데이터가 필요하다.

CheeseStock은 이 네 층위를 5개 공공 API로 충당한다. 한국거래소(KRX), 금융감독원(DART), 한국은행(ECOS), 미국 연방준비제도(FRED), 통계청(KOSIS) — 각 기관에 사용 신청을 하여 승인받은 공식 API 접근 권한을 통해 데이터를 수집한다. 시장 루머, 비공식 소스, 유료 데이터벤더는 사용하지 않는다. 원천의 신뢰성은 각 기관의 법적 공시 의무와 감독 체계에 의해 보장된다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 1.1 | 데이터 흐름 | 수집에서 이론으로의 변환 경로 |
| 1.2 | KRX | 가격·수급·파생상품 데이터 |
| 1.3 | DART | 기업 재무제표 |
| 1.4 | ECOS | 국내 거시경제 지표 |
| 1.5 | FRED · KOSIS | 글로벌 거시와 경기 선행 |
| 1.6 | 기타 원천 | 파생·수급·환율 보조 데이터 |
| 1.7 | 종합 | 데이터에서 이론으로의 전환 |

## 1.1 데이터 흐름: 수집에서 이론으로

수집된 데이터는 그 자체로는 사실(fact)이지 판단(judgment)이 아니다. KRX가 제공하는 종가 하나가 투자 판단의 근거가 되려면, 그 숫자가 학술적 변환을 거쳐 의미 있는 구조로 재구성되어야 한다. 종가 250일치가 허스트 지수를 거치면 추세의 지속성이 드러나고, GARCH 모형을 거치면 변동성의 방향이 보이며, CAPM을 거치면 시장 전체 대비 이 종목의 위험이 측정된다. 하나의 종가가 물리학, 수학, 통계학, 금융학의 서로 다른 렌즈를 통과하며 32개 지표, 46종 패턴, 10개 계층의 신뢰도 조정으로 분화하는 것이다.

각 API의 수집 빈도와 규모는 다음과 같다.

| 원천 | 수집 빈도 | 갱신 시점 | 데이터 규모 |
|------|----------|----------|-----------|
| KRX | 일별 | 장 마감 후 자동 배치 | KOSPI·KOSDAQ 전종목 |
| DART | 분기별 | 공시일 반영 | 약 2,700개 종목 (2026-04-20 pin: 2,736) |
| ECOS | 일별~월별 | 발표 즉시 | 지표별 상이 |
| FRED | 일별 | 미국 발표 시 | 8개 핵심 변수 (DGS10·DFF·DCOILWTICO·GOLDAMGBD228NLBM·DXY·VIXCLS + dxy_fred·vix_fred Phase 1-B 추가분) |
| KOSIS | 월별 | 발표 즉시 | 5개 선행·심리 지표 |

\newpage

## 1.2 KRX — 가격·수급·파생

한국거래소(KRX)는 5개 원천 중 가장 넓은 학문적 분화를 일으키는 데이터 공급원이다. 종가 하나에서 출발한 계산이 7개 학문 분야 — 물리학, 수학, 통계학, 경영학, 경제학, 금융학, 행동재무학 — 로 각각 갈라진다.

```tree
KRX 가격·수급·파생
  물리학 (2.1)
    볼츠만 분포 (Mantegna-Stanley) → 로그수익률에서 시장 온도 사상 → 변동성 국면
  수학 (2.2)
    R/S 분석 (Mandelbrot) → 종가 궤적에서 허스트 지수 H → 추세 지속성 판단
    이토 해석학 GBM → 일봉에서 브라운 브릿지 보간 → 분봉 차트 생성
  통계학 (2.3)
    GARCH(1,1) (Bollerslev) → 로그수익률의 조건부 변동성 → 국면 분류
    HAR-RV (Corsi) → 일·주·월 3-스케일 실현 변동성 예측
    Hill 추정량 → 수익률 꼬리 지수 → 극단값 이론(EVT) 보정 임계값
    Parkinson → 고가·저가에서 역사적 변동성 → VRP 분모
  금융학 (2.6)
    CAPM (Sharpe) → 수익률에서 베타 추정 → 체계적 위험
    APT Ridge 회귀 → 5-팩터 노출도 (momentum_60d·beta_60d·value_inv_pbr·log_size·liquidity_20d) — `scripts/mra_apt_extended.py` 오프라인 배치 + `js/aptModel.js` 런타임 클라이언트 (17-col Ridge, λ=2.0, horizon=5d, n=237,977)
    Fama-French 3-팩터 → MKT·SMB·HML 프리미엄 분해
    BSM (Black-Scholes-Merton) → 옵션에서 내재변동성 추출
    VRP (Bollerslev-Tauchen-Zhou) → 내재-실현 분산 차이 ($IV^2 - HV^2$)
    보유비용 모형 → 선물 이론가 → 베이시스 괴리율 산출
    Amihud·Kyle → 유동성 팩터 + 슬리피지 모형
  경영학 (2.4)
    WACC (Modigliani-Miller) → 시가총액에서 자기자본 비중 산출
    Merton 부도거리 → 시가총액을 자산가치 프록시로 활용
    HHI 집중도 → 업종 내 시장 지배력 측정
  경제학 (2.5)
    먼델-플레밍 자본이동 → 외국인 순매수 방향과 환율 채널 연계
  행동재무학 (2.7)
    LSV 군집행동 (Bikhchandani-Hirshleifer-Welch) → 투자자 순매수에서 군집 강도
    HMM 은닉 마르코프 → 수급 국면 분류 (매수 정렬·매도 정렬·중립)
    RORO 레짐 (Baele-Bekaert) → VKOSPI에서 위험 선호·회피 분류
    PCR·공매도 역발상 (Pan-Poteshman, Desai) → 극단 시 반전 신호
```

위 분기 경로 중 일부는 다단계 변환을 거치거나 복수 API의 교차를 요구한다[^bb-3step][^vrp-cross][^amihud-chain][^merton-cross][^mf-cross].

## 1.3 DART — 기업 재무

재무제표는 과거의 기록이지만, 투자자가 묻는 질문은 미래에 관한 것이다. 금융감독원 전자공시시스템(DART)은 IFRS 기준의 연결·별도 재무제표를 제공하며[^dart-cfs], DART 데이터가 가치 평가 모형으로 들어가는 순간, 과거의 수치는 미래의 가격에 대한 이론적 주장으로 변환된다. 한 기업의 재무 수치가 가치 평가, 자본 구조, 신용 위험이라는 서로 다른 금융 이론의 입력으로 갈라진다.

```tree
DART 기업 재무
  경영학 (2.4)
    DCF 잔여이익 → 당기순이익에서 내재가치 산출
    EVA (Stern-Stewart) → 영업이익에서 경제적 부가가치
    WACC → 자본총계·이자부채에서 가중평균 자본비용
    Lintner 배당 평활화 → EPS 성장률에서 배당 시그널
    Kelly 기준 → EPS 변동성에서 수익 안정성 판단
  금융학 (2.6)
    PER·PBR·PSR → 가격 대비 재무 비율 → 상대가치 비교 (경영학 2.4 투자판단 점수에서 활용)
    ROE·ROA → 자기자본·자산 수익성 → 투자 점수 (경영학 2.4 투자판단 점수에서 활용)
    Merton 부도거리 → 부채를 부도 장벽으로 활용 → 부도확률
    Altman Z-Score → 재무비율에서 부도 위험 종합
    CAPM 자기자본비용 → Hamada 레버리지 베타 조정
    Fama-French 가치 팩터 → B/M 비율에서 HML 입력
    Modigliani-Miller → D/E 비율에서 레버리지 효과 측정 (상세: 2.4.2-2.4.3절)
```

DART의 경영학·금융학 분기 경로 중 EVA는 3단계 변환(EBIT → NOPAT → EVA)을 거치며[^eva-3step], WACC 산출은 DART·ECOS·KRX 3개 API의 교차이다[^wacc-cross]. CAPM 자기자본비용 역시 ECOS 무위험금리와 KRX 시장수익률의 교차를 요구한다[^capm-cross]. 이 중 Altman Z-Score와 Lintner 배당 평활화는 이론적 기초로서 참조되며, 런타임 코드에서 직접 계산되지 않는다.

## 1.4 ECOS — 국내 거시경제

한국은행 경제통계시스템(ECOS)은 기준금리, 채권 수익률, 물가, 통화량 등 국내 거시경제 지표를 제공한다. 수집 빈도는 지표에 따라 일별(금리·환율)에서 월별(CPI·M2)까지 다양하다. 하나의 기준금리가 IS-LM 균형, 테일러 준칙, CAPM 무위험이자율이라는 서로 다른 이론적 맥락에서 동시에 소비되는 것이 ECOS 데이터의 특징이다.

```tree
ECOS 국내 거시경제
  경제학 (2.5)
    IS-LM 모형 (Hicks) → 기준금리에서 확장적·긴축적 기조 판단
    Taylor 준칙 → 기준금리·CPI·산출량갭에서 테일러 갭 산출
    AD-AS 프레임워크 → CPI에서 총공급·총수요 균형 → 4-충격 시나리오
    NKPC 필립스곡선 → CPI에서 수요 충격 vs 산출량 집중 판별
    Fisher 효과 → CPI에서 기대 인플레이션 → 실질금리 분해
    IS-LM LM곡선 → M2에서 실질통화량 → 유동성 조건
    먼델-플레밍 금리차 → 기준금리에서 자본 유출입 방향
    MCS v2 복합지수 → M2·BSI·IPI·수출·실업률이 8개 구성요소에 포함
  금융학 (2.6)
    CAPM 무위험이자율 → 기준금리·국고채에서 $R_f$ 입력
    WACC 할인율 → 국고채에서 $R_f$ 입력
    Merton 부도거리 → 국고채에서 $R_f$ 입력
    ICAPM (Merton) → 국고채 기울기가 상태변수 → 조건부 위험 프리미엄
    수익률곡선 분석 → 10Y-3Y 기울기에서 경기 전망 판별
    Jarrow-Turnbull → 회사채 스프레드에서 위험중립 부도강도 프록시
    RORO 레짐 → 회사채 스프레드에서 신용 스트레스 입력
```

Taylor 준칙은 ECOS 기준금리·CPI와 KOSIS 경기선행지수의 교차 입력으로 완성된다[^taylor-cross]. CPI는 AD-AS와 Fisher 효과의 입력이며, GARCH 모형과는 이론적 연결이 없다[^adas-not-garch].

\newpage

## 1.5 FRED · KOSIS — 글로벌 거시와 경기 선행

FRED와 KOSIS는 한국 시장에 대한 외부 맥락을 제공한다. FRED는 미국 금리, VIX, 환율 등 글로벌 거시 변수를 통해 외생적 충격원(exogenous shock)으로 기능하고, KOSIS는 경기선행지수, 경제심리지수 등 실물 경제 선행 지표로 경기 국면을 판별한다. 두 원천 모두 일별 가격 데이터(KRX)에 비해 갱신 빈도가 낮으나, MCS v2 복합경기지수는 ECOS와 KOSIS에서 총 8개 구성요소를 수집하여[^mcs-multi] 신뢰도 조정의 핵심 입력으로 기능한다.

```tree
FRED 글로벌 거시경제
  경제학 (2.5)
    먼델-플레밍 금리차 → 한미 금리차에서 자본유출 압력
    Dornbusch 오버슈팅 → USD/KRW에서 환율 과잉반응 → 평균 회귀
    AD-AS 충격 판별 → VIX 30 초과 시 스태그플레이션 경고
  금융학 (2.6)
    국제 CAPM → 글로벌 무위험이자율, 할인율 벤치마크
    수출주 채널 → 원화 약세 시 수출 기업 이익 → 패턴 신뢰도 조정
  행동재무학 (2.7)
    RORO 레짐 (Baele-Bekaert) → VIX·DXY에서 글로벌 위험 선호·회피
```

```tree
KOSIS 경기 선행·심리
  경제학 (2.5)
    Stovall 섹터 회전 → CLI에서 4-국면 판별 → 업종별 신뢰도 승수
    MCS v2 선행 대체 구성 → CLI 0.40 · ESI 0.25 · IPI 0.20 · 소매판매 0.15 (4-component 재정규화 합 1.0; ECOS primary 14일 초과 정체 시 `mcsV2Fallback`로 전환, `scripts/compute_macro_composite.py::compute_mcs_v2_fallback()` 2026-04-20 P6-001 구현)
    AD-AS 총공급 프록시 → IPI에서 잠재 산출 간접 측정
  행동재무학 (2.7)
    CCAPM (Breeden) → CCI에서 소비 성장 간접 프록시
```

(KOSIS CLI(경기종합지수)와 OECD CLI(순환변동치)는 산출 방법론이 다르다. `kosis_latest.json`의 `cli_composite`는 전자, `macro_latest.json`의 `korea_cli`는 후자이다.)

한미 금리차가 음수이면 자본 유출 압력, 양수이면 유입 압력을 시사한다[^mf-fed-bok]. VKOSPI 데이터가 부재할 경우, VIX가 변동성 레짐 분류의 대체 프록시로 기능한다[^vix-fallback]. KOSIS의 경기선행지수는 Taylor 준칙의 산출량갭 입력으로 ECOS 기준금리·CPI와 교차한다[^taylor-cross]. CCAPM은 소비 성장을 요구하나, CCI는 월별 심리 지표여서 빈도 제약이 있다[^ccapm-freq].

\newpage

## 1.6 기타 원천

5개 공식 API 외에, 일부 데이터는 비공식 경로를 통해 보완적으로 수집된다. 이 경로는 공식 API의 기술적 제약이 발생했을 때 활성화되며, 시스템은 비공식 출처의 불확실성을 명시적으로 반영한다.

투자자별 매매동향은 2025년 12월 KRX OTP 인증 체계 개편 이후 Naver Finance를 대체 수집 경로로 활용한다. Naver는 KRX 원시 데이터를 중계하므로 수치의 정확성은 유지되나, 비공식 경로에 해당하여 시스템은 0.85 감쇠 계수를 적용한다[^inv-naver].

공매도 데이터는 동일한 KRX OTP 인증 개편으로 자동 수집이 중단된 상태이다. 시스템은 이 상태를 명시적으로 감지하여 관련 신뢰도 조정을 자동 비활성화한다[^ss-dead].

## 1.7 종합: 데이터에서 이론으로의 전환

제1장에서 확인한 것은 다음과 같다. 5개 공공 API에서 수집한 데이터는 7개 학문 분야 — 물리학, 수학, 통계학, 경영학, 경제학, 금융학, 행동재무학 — 로 분기하며, 이 분기는 자의적이 아니라 각 학문의 이론적 요구에 의해 결정된다. KRX 종가가 로그수익률로 변환되어 GARCH에 입력되는 것은 Bollerslev(1986)가 조건부 이분산성을 모형화하기 위해 수익률 시계열을 요구하기 때문이며, DART 부채총계가 Merton 모형에 입력되는 것은 Merton(1974)이 부채를 콜옵션의 행사가격으로 정의했기 때문이다.

또한 하나의 이론이 완성되기 위해 여러 API의 교차가 필요한 경우가 빈번하다. WACC는 DART, ECOS, KRX 3개 API를, MCS v2 복합지수는 ECOS와 KOSIS 2개 API를 요구한다. 이 교차 의존은 제2장의 학술적 토대가 왜 단일 데이터 원천만으로는 구축될 수 없는지를 보여준다.

제2장에서는 이 7개 학문 분야 각각의 이론적 기초를 추적한다.

[^bb-3step]: 3단계 변환: 일봉 종가 → GBM 드리프트·변동성 추정 → 브라운 브릿지 구간 보간 → 1m·5m·15m·30m·1h 분봉 시계열 생성.

[^amihud-chain]: 3단계 변환: 거래대금·절대수익률 → 20일 이동평균 ILLIQ → APT 유동성 팩터 → WLS 가중치에 반영.

[^merton-cross]: Merton 부도거리는 3개 API의 교차 입력이 필요하다: KRX 시가총액($E$) + DART 부채총계($D$) + ECOS 무위험금리($R_f$). 단일 API로 완결되지 않는다.

[^inv-naver]: 2025년 12월 KRX OTP 인증 체계 개편 이후, 투자자별 매매동향은 Naver Finance를 대체 수집 경로로 활용한다. 시스템은 이 경로에 0.85 감쇠 계수를 적용하여 비공식 출처의 불확실성을 반영한다.

[^mf-cross]: 먼델-플레밍 모형의 완전한 적용은 ECOS 기준금리와 FRED Fed Funds Rate의 교차가 필요하다.

[^vrp-cross]: VRP 산출은 두 원천의 교차이다: VKOSPI(옵션 시장에서 추출한 $\sigma_{\text{IV}}$)와 OHLCV(역사적 수익률에서 계산한 $\sigma_{\text{RV}}$).

[^ss-dead]: 2025년 12월 KRX OTP 인증 체계 개편으로 공매도 데이터 자동 수집이 중단되었다. 시스템은 이를 명시적으로 감지하여 관련 신뢰도 조정을 자동 비활성화한다.

[^dart-cfs]: 연결재무제표(CFS)를 우선 수집하고, 미제공 시 별도재무제표(OFS)로 폴백한다. IFRS 계정과목 매핑: 매출액은 '수익(매출액)', '매출액', '영업수익' 세 가지 계정명을 모두 수용한다.

[^wacc-cross]: WACC 산출은 3개 API 교차이다: DART(자본총계·이자부채) + ECOS(국고채 $R_f$) + KRX(시가총액 $E$, CAPM $\beta$).

[^eva-3step]: 3단계 변환: 영업이익(EBIT) → NOPAT = EBIT$(1-T_c)$ → IC = 자본총계+이자부채 → EVA = NOPAT $-$ WACC $\times$ IC.

[^capm-cross]: CAPM 자기자본비용은 ECOS 무위험금리($R_f$)와 KRX 시장수익률($R_m$), KRX 개별종목 수익률에서 산출한 $\beta$를 결합한다.

[^taylor-cross]: Taylor 준칙 산출은 ECOS(기준금리, CPI)와 KOSIS(CLI 산출량갭)의 교차 입력이 필요하다.

[^adas-not-garch]: CPI는 AD-AS와 Fisher 효과의 입력이다. GARCH 모형의 입력이 아님에 유의 — GARCH는 가격 수익률의 조건부 변동성을 모형화하며, 물가 수준과는 이론적 연결이 없다.

[^mf-fed-bok]: 한미 금리차 $i_{\text{BOK}} - i_{\text{Fed}}$가 음수이면 자본 유출 압력, 양수이면 유입 압력을 시사한다.

[^vix-fallback]: VKOSPI 데이터가 부재하거나 갱신되지 않은 경우, VIX가 변동성 레짐 분류의 대체 프록시로 기능한다.

[^mcs-multi]: MCS v2는 ECOS(M2, BSI, 수출, 실업률)와 KOSIS(CLI, ESI, IPI, 소매판매) 양쪽에서 총 8개 구성요소를 수집한다. 단일 API로 완결되지 않는다.

[^ccapm-freq]: CCAPM은 소비 성장을 핵심 변수로 요구하나, CCI는 월별 심리 지표에 불과하여 빈도 제약이 있다. 일별 패턴 거래에는 간접적으로만 반영된다.

\newpage

# 제2장: 학술적 기반 — 이론적 토대

제1장에서 수집된 데이터가 투자 판단의 근거로 기능하려면, 가격 시계열에서 의미 있는 구조를 추출하고 그 구조의 통계적 유의성을 검증하는 수학적·통계적 도구가 필요하다. 본 장은 CheeseStock이 사용하는 모든 수식과 알고리즘의 학술적 기원을 추적한다 — 물리학의 통계역학에서 출발하여 수학, 통계학, 경영학, 경제학, 금융학, 행동재무학까지 7개 학문 분야에 걸친 이론적 토대를 다룬다 (Ch2.1~Ch2.7 순서와 일치).

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 2.1 | 물리학적 기초 | 통계역학, 멱법칙, 프랙탈 |
| 2.2 | 수학적 기초 | 확률과정, 이토, 선형대수, 칼만 |
| 2.3 | 통계학적 기초 | GARCH, EVT, WLS, HMM, CUSUM |
| 2.4 | 경영학적 기초 | DCF, MM, WACC, 대리인, EVA, Kelly |
| 2.5 | 경제학적 기초 | IS-LM, AD-AS, MCS, HMM 레짐, HHI |
| 2.6 | 금융학적 기초 | CAPM 계보, 채권, 옵션, 신용, SDF |
| 2.7 | 행동재무학적 기초 | 전망이론, 처분효과, 군집, 반예측기 |

## 2.1 물리학적 기초: 경제물리학[^phys-1]

경제물리학(Econophysics)은 통계역학, 스케일링 이론, 임계현상(critical phenomena)의
방법론을 금융시장에 적용하는 학제간 연구 분야이다. 이 분야가 기술적 분석에서
차지하는 위상은 독특하다. 기존 금융학이 가우시안(Gaussian) 분포를 전제하여
시장의 분포적 특성을 설명하는 데 근본적 한계를 드러낸 반면, 경제물리학은
시장이 *왜* 정규분포를 따르지 않는지에 대한 가장 심층적인 설명을 제공한다.
본 시스템의 극단값 이론(EVT) 보정, 변동성 국면 분류, 허스트 지수 산출은
모두 이 물리학적 토대 위에 구축되어 있다.

이론적 흐름 (4시트): 통계역학과 시장 온도 (2.1.1) → 이징 모형과 군집행동 (2.1.2) → 멱법칙과 두꺼운 꼬리 (2.1.3) → 자기조직화 임계성과 버블 감지 (2.1.4). 균형 열역학에서 비균형 임계현상으로, 가격 분포의 물리학적 기원을 추적한다.


### 2.1.1 통계역학과 시장 온도 (Statistical Mechanics & Market Temperature)
볼츠만 분포(Boltzmann, 1877)는 열적 평형 상태에 있는 물리계에서
각 미시상태(microstate)의 확률을 결정하는 근본 법칙이다. Mantegna and
Stanley (2000)가 체계화한 바와 같이, 통계역학과 금융시장 사이에는
단순한 비유를 넘어선 구조적 대응(structural correspondence)이 존재한다.
$$P(E) = \frac{1}{Z} \exp\left(-\frac{E}{k_B T}\right)$$

| 기호 | 의미  |
|:----:|------|
| $P(E)$ | 에너지 E 상태의 확률  |
| $Z$ | 분배함수 Σi exp(-Ei/k_BT)  |
| $E$ | 미시상태 에너지 → 균형 가격 이탈  |
| $k_B$ | 볼츠만 상수  |
| $T$ | 절대온도 → 시장 변동성  |
| $\sigma_{\text{EWMA}}$ | EWMA 변동성 (시장 온도 조작화)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\sigma_{\text{EWMA}}}$는 Stage 1 데이터 계층에서 수집된 가격 시계열로부터 산출된 EWMA 변동성이다.

#### 물리학-금융학 대응 관계

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
|:----:|------|
| $\mathcal{H}$ | 해밀토니안 (시스템 총 에너지)  |
| $s_i = \pm 1$ | 참여자 i의 매수(+1)/매도(-1)  |
| $J > 0$ | 상호작용 결합 → 군집행동(herding)  |
| $J < 0$ | 역추세(contrarian) 행동 → 평균회귀  |
| $h$ | 외부장(external field) → 뉴스/정보 강도  |
| $\text{CSAD}_t$ | 횡단면 절대 편차 (군집 경험적 지문)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{CSAD_t}$는 Stage 1에서 수집된 개별종목 수익률과 시장수익률로부터 산출된다.

\newpage

### 2.1.3 멱법칙과 두꺼운 꼬리 (Power Law & Fat Tails)
멱법칙(power law) 분포(Mandelbrot, 1963)는 금융 수익률이 가우시안 분포를
따르지 않는다는 결정적 증거를 제공한다. Gopikrishnan et al. (1999)의
"역세제곱 법칙" ($\alpha \approx 3$)은 극단 사건의 빈도가 정규분포의
예측보다 수천 배 높음을 보여, EVT 보정의 필요성을 정당화한다.
$$P(x) \sim x^{-\alpha}, \quad x > x_{\min}$$

$$\log P(x) = -\alpha \cdot \log x + C$$

| 기호 | 의미  |
|:----:|------|
| $\alpha$ | 꼬리지수(tail exponent)  |
| $x_{\min}$ | 멱법칙 하한 임계값  |
| $\hat{\alpha}$ | 힐 추정량으로 측정된 꼬리지수  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\hat{\alpha}}$는 Stage 1의 OHLCV 데이터로부터 힐 추정량(`Hill estimator`)으로 산출된다.

| 특성 | 가우시안 (α = ∞) | 멱법칙 (α ≈ 3) |
|------|:-------------------------:|:-----------------------------:|
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
|:----:|------|
| $S$ | 눈사태 크기 (돌파 후 가격 이동)  |
| $\tau$ | 눈사태 지수  |

대수주기 멱법칙(LPPL, Sornette, 2003)은 "진동을 동반하는 가속 가격
패턴이 반전에 선행한다"는 통찰을 제공한다. 두 이론 모두
CheeseStock에서 직접 계산되지는 않으나, 차트 패턴 설계의 개념적 기반이다.

## 2.2 수학적 기초[^math-1]

수학은 모든 금융 모형이 표현되는 형식 언어(formal language)이다. 확률과정은
옵션 가격결정과 위험 관리의 근간이 되는 연속시간 모형을 생성하고,
프랙탈 수학은 금융 시계열이 시간 척도 간 자기유사성(self-similarity)을
보이는 이유를 설명한다. 이 자기유사성이야말로 기술적 분석이
모든 시간대(timeframe)에서 작동하는 근본적 이유이다.

이론적 흐름 (6시트): 확률론 (2.2.1) → 마팅게일 (2.2.2) → 브라운 운동 (2.2.3) → 프랙탈 수학 (2.2.4) → 선형대수와 릿지 (2.2.5) → 최적 제어 (2.2.6). 확률의 공리적 기초에서 상태 추정의 최적화까지, 금융 모형의 수학적 언어를 구축한다.


### 2.2.1 확률론: 콜모고로프 공리와 베이즈 정리 (Probability: Kolmogorov & Bayes)
본 시스템의 모든 확률 계산은 Kolmogorov (1933)의 공리적 기초 위에 놓여 있다.
베이즈 정리는 다수의 패턴이 동시에 감지될 때 신뢰도를 융합하는 형식적
프레임워크를 제공하며, 마르팅게일 이론은 기술적 분석의 존재론적 전제를 정의한다.
$$P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}$$

| 기호 | 의미  |
|:----:|------|
| $P(A \mid B)$ | 사후확률 (패턴 관측 후 상승 확률)  |
| $P(B \mid A)$ | 우도 (상승 시 패턴 관측 확률)  |
| $P(A)$ | 사전확률 (기저 상승률)  |
| $\text{패턴}_i$ | Stage 1에서 감지된 캔들/차트 패턴  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{패턴i}$은(는) Stage 1 데이터 계층에서 산출된다.


다중 패턴 신뢰도 융합 (나이브 베이즈)

$$P(\text{상승} | \text{패턴}_1, \text{패턴}_2, \ldots) \propto P(\text{상승}) \cdot \prod_i P(\text{패턴}_i | \text{상승})$$

### 2.2.2 마르팅게일 이론 (Martingale Theory)
마르팅게일은 효율적 시장 가설(EMH)의 수학적 표현이다. 기술적 분석은
본질적으로 마르팅게일 속성에 대한 내기(bet)이며, Lo and MacKinlay (1999)의
경험적 증거는 시장이 순수 마르팅게일과 일치하지 않는 자기상관 구조를 보인다는
것을 시사하여, 패턴 기반 예측의 전제를 뒷받침한다.
$$E[X_{n+1} | X_1, X_2, \ldots, X_n] = X_n$$

| 기호 | 의미  |
|:----:|------|
| $X_n$ | 시점 n의 가격 (또는 로그가격)  |
| $\Phi_t$ | 시점 t까지의 정보 집합  |
| $\mu$ | 상수 드리프트 (EMH 하)  |

### 2.2.3 브라운 운동과 이토 해석학 (Brownian Motion & Ito Calculus)
기하 브라운 운동(GBM)은 Black-Scholes 모형의 토대이며, 데모 모드의 가격
시뮬레이션 모형이다. 이토 보조정리(Ito's Lemma)는 확률 해석학의 연쇄 법칙으로,
BSM PDE 도출과 로그수익률 기반 지표 계산의 이론적 기반이다.
$$dS_t = \mu S_t \, dt + \sigma S_t \, dW_t$$

해: $S_t = S_0 \cdot \exp\left((\mu - \sigma^2/2)t + \sigma W_t\right)$

이토 보조정리

$$df = \left(\frac{\partial f}{\partial t} + \mu S \frac{\partial f}{\partial S} + \frac{1}{2}\sigma^2 S^2 \frac{\partial^2 f}{\partial S^2}\right) dt + \sigma S \frac{\partial f}{\partial S} \, dW$$

| 기호 | 의미  |
|:----:|------|
| $S_t$ | 시점 t의 주가  |
| $\mu$ | 드리프트 (기대수익률)  |
| $\sigma$ | 확산 계수 (변동성)  |
| $W_t$ | 표준 위너 과정  |
| $P_t$ | Stage 1에서 수집된 실시간/일봉 가격  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{Pt}$은(는) Stage 1 데이터 계층에서 산출된다.


> 시그마($\sigma$) 기호의 구별

| 기호 | 맥락 | 단위 | 예시 |
|:----:|------|:----:|------|
| $\sigma_{\text{GBM}}$ | GBM 확산 계수 | 무차원 (연율화) | 0.30 = 연 30% |
| $\sigma_{\text{price}}$ | 가격 표준편차 (볼린저) | KRW | `calcBB()`에서 사용 |
| $\sigma_{\text{return}}$ | 수익률 표준편차 | 무차원 | 0.02 = 일 2% |

일별 변환: $\sigma_{\text{daily}} = \sigma_{\text{annual}} / \sqrt{250}$ (KRX 거래일 기준).

점프-확산 --- Merton (1976)

$$\frac{dS_t}{S_t} = (\mu - \lambda k) \, dt + \sigma \, dW_t + J \, dN_t$$

$N_t$: 강도 $\lambda$의 포아송 과정, $J$: 점프 크기 (로그정규).
KRX의 $\pm 30\%$ 가격제한폭이 자연적 점프 크기 절단으로 작용한다.


### 2.2.4 프랙탈 수학과 허스트 지수 (Fractal Mathematics & Hurst Exponent)
프랙탈 기하학(Mandelbrot, 1963; 1982)에 따르면, 가격 시계열은 시간 척도 간
통계적 자기유사성을 보인다. 이 자기유사성은 동일한 패턴이 1분, 시간, 일, 주
차트에 나타나는 수학적 토대이다. 허스트 지수(Hurst, 1951)는 시계열의
장기 의존성을 측정하여 추세추종 vs 평균회귀 전략 선택의 근거를 제공한다.
$$X(ct) \stackrel{d}{=} c^H \cdot X(t)$$

$$E\left[\frac{R(n)}{S(n)}\right] = C \cdot n^H$$

| 기호 | 의미  |
|:----:|------|
| $H$ | 허스트 지수  |
| $R(n)$ | 윈도우 n에서 누적 편차의 범위  |
| $S(n)$ | 윈도우 n의 모집단 표준편차 (÷ n)  |
| $D = 2 - H$ | 프랙탈 차원  |
| $P_t$ | Stage 1 가격 시계열  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{Pt}$은(는) Stage 1 데이터 계층에서 산출된다.


| H 값 | 해석 | 최적 전략 유형 |
|:-------:|------|----------------|
| H = 0.5 | 랜덤워크 (독립 증분) | 우위 없음 |
| H > 0.5 | 지속적/추세 | 추세추종 (이동평균 교차, 돌파) |
| H < 0.5 | 반지속적/평균회귀 | 평균회귀 (볼린저, RSI) |

$H$와 $\alpha$에 관한 정밀한 구별: $H = 1/\alpha$ 관계는 레비 안정 과정에서만 성립.
금융 수익률($\alpha \approx 3$, $H \approx 0.5$--$0.6$)에서는 직교적 속성이다.

\newpage

### 2.2.5 선형대수와 릿지 회귀 (Linear Algebra & Ridge Regression)
선형대수는 회귀분석, 요인 모형, 포트폴리오 최적화의 수학적 근간을 제공한다.
릿지 회귀(Hoerl & Kennard, 1970)는 L2 정규화를 통해 다중공선성 문제를 해결하고,
GCV 기반 람다 선택(Golub, Heath & Wahba, 1979)이 최적 정규화 강도를 결정한다.
$$\hat{\beta}_{\text{Ridge}} = (X^T W X + \lambda I)^{-1} X^T W y$$

| 기호 | 의미  |
|:----:|------|
| $\hat{\beta}$ | 회귀 계수 벡터  |
| $X$ | 설계행렬 (피처)  |
| $W$ | 가중행렬 diag(w1,...,wn)  |
| $\lambda$ | 릿지 정규화 매개변수 (GCV 선택)  |
| $I$ | 단위행렬  |
| $y$ | 종속변수 (패턴 수익률)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{y}$는 Stage 1에서 수집된 과거 패턴 수익률 데이터이다.

역행렬 계산은 부분 피벗 가우스-요르단 소거법, 고유분해는 야코비 회전 알고리즘을 사용한다.


### 2.2.6 칼만 필터와 최적 제어 (Kalman Filter & Optimal Control)
칼만 필터(Kalman, 1960)는 선형 가우시안 시스템의 최적 상태 추정기로,
선형-이차-가우시안(LQG) 제어 문제의 해이다. CheeseStock에서는
적응형 가격 평활화에 사용되며, 과정 잡음이 변동성 국면에 비례하여
스케일링되는 확장을 적용한다.
$$\hat{x}_t = \hat{x}_{t-1} + K_t (z_t - \hat{x}_{t-1})$$

$$K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}, \quad P_{t|t-1} = P_{t-1} + Q$$

| 기호 | 의미  |
|:----:|------|
| $\hat{x}_t$ | 상태 추정치 (평활 가격)  |
| $K_t$ | 칼만 이득 (Kalman gain)  |
| $P_t$ | 추정 오차 공분산  |
| $Q$ | 과정 잡음  |
| $R$ | 관측 잡음  |
| $z_t$ | 관측 가격  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{zt}$은(는) Stage 1 데이터 계층에서 산출된다.


적응형 Q 수정: Mohamed and Schwarz (1999) "Adaptive Kalman Filtering"의 통찰로,
과정 잡음 공분산이 관측 변동성 국면에 비례하여 스케일링된다.

## 2.3 통계학적 기초[^stat-1]

통계학은 원시 시장 데이터를 실행 가능한 측정치로 변환하는 경험적 도구를
제공한다. CheeseStock의 모든 기술적 지표는 본질적으로 통계 추정량이다.
RSI는 모멘텀 확률을, 볼린저 밴드는 신뢰구간을, 힐 추정량은 꼬리 두께를
추정한다.

이론적 흐름 (7시트): GARCH/EWMA 변동성 (2.3.1) → 극단값 이론 GEV/GPD/Hill (2.3.2) → 강건 회귀 WLS/Ridge (2.3.3) → HAR-RV 변동성 예측 (2.3.4) → 최대우도추정 MLE (2.3.5) → 변화점 감지 CUSUM (2.3.6) → HMM 국면 분류 (2.3.7). 조건부 변동성에서 국면 전환까지, 시장 데이터의 통계적 구조를 해부한다.


### 2.3.1 GARCH/EWMA 변동성 (GARCH/EWMA Volatility)
GARCH(1,1)(Bollerslev, 1986)은 조건부 변동성의 시변적(time-varying) 특성을
포착하는 표준 모형이다. EWMA는 $\omega=0$, $\alpha+\beta=1$인 IGARCH 특수
경우로, 시장의 "순간 온도"를 추적한다.
$$\sigma_t^2 = \omega + \alpha \cdot \varepsilon_{t-1}^2 + \beta \cdot \sigma_{t-1}^2$$

$$\text{EWMA: } \sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_{t-1}^2$$

| 기호 | 의미  |
|:----:|------|
| $\sigma_t^2$ | 조건부 분산  |
| $\omega$ | 장기 분산 수준  |
| $\alpha$ | ARCH 계수 (충격 반응)  |
| $\beta$ | GARCH 계수 (분산 지속성)  |
| $\lambda = 0.94$ | EWMA 감쇠 (RiskMetrics 관례)  |
| $r_t$ | 로그수익률 ln(Pt/Pt₋1)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{rt}$은(는) Stage 1 데이터 계층에서 산출된다.

#### 구현 선택의 정당화: 왜 GARCH가 아닌 EWMA인가

CheeseStock는 이론적으로 완전히 일반화된 GARCH(1,1)이 존재함에도 불구하고 특수 경우인 EWMA를 채택하였다. 이 선택은 이론적 타협이 아닌 브라우저 기반 실시간 분석 환경의 연산 예산과 갱신 빈도 요구사항에 의해 결정되었다.

첫째, 계산 비용의 차이가 결정적이다. GARCH(1,1)의 매개변수 $(\omega, \alpha, \beta)$는 정규분포 또는 스튜던트-t 분포 가정 하에서 최대우도추정(MLE)을 통해 공동으로 추정되어야 하며, 이는 Broyden-Fletcher-Goldfarb-Shanno(BFGS) 준뉴턴 최적화 또는 Nelder-Mead 단체법의 반복 수렴을 필요로 한다. 연 250 거래일의 일별 수익률 시계열 기준으로 종목당 50-200밀리초가 소요되며, 2,645종목 × 100밀리초 ≈ 264초의 메인 스레드 블로킹이 발생한다(2026-04-20 pin). 이는 실시간 웹 차트의 사용자 응답성 임계(첫 렌더링 2초, 상호작용 100밀리초)를 한 자릿수 배수 초과한다. Web Worker로 분리하더라도 병렬도는 브라우저의 CPU 코어 수에 제한되어 실질 대기시간은 1-2분 수준에 머문다.

둘째, EWMA는 이러한 최적화 과정 자체를 생략한다. $\sigma_t^2 = \lambda \sigma_{t-1}^2 + (1-\lambda) r_{t-1}^2$의 재귀식은 closed-form이며, 새로운 틱이 도착할 때마다 $O(1)$ 상수 시간으로 갱신된다. 2,645종목 전체의 실시간 변동성 추적은 틱당 수십 마이크로초로 완료되며, Web Worker 분리 없이 메인 스레드에서도 부담 없이 처리된다. 이 계산 경제성은 KOSPI/KOSDAQ 전체 종목을 개별적으로 추적해야 하는 CheeseStock의 아키텍처 제약을 충족하는 유일한 현실적 경로이다.

셋째, $\lambda = 0.94$는 J.P. Morgan의 RiskMetrics Technical Document(1996)가 약 480개 글로벌 자산의 일별 수익률 시계열에서 경험적 분산예측 오차를 최소화하는 값으로 교정한 표준이다. 이는 제약식 $\omega = 0$, $\alpha = 0.06$, $\beta = 0.94$를 만족하는 IGARCH(1,1)의 특수 경우에 해당한다. 한국 KOSPI 일별 수익률에 대해서도 유사한 감쇠율이 국내 연구에서 보고되었으며,[^ewma-korea] 이는 $\lambda = 0.94$를 한국 시장에 적용하는 것이 경험적으로 근거 있음을 시사한다. 주별 데이터에서는 RiskMetrics가 $\lambda = 0.97$을 권고하나, CheeseStock의 주요 분석 빈도는 일별이므로 0.94를 일관되게 사용한다.

[^ewma-korea]: KOSPI 일별 수익률에 대한 EWMA 감쇠율 교정은 한국 선물옵션 시장 변동성 예측 연구들에서 0.92-0.96 범위로 보고된다. RiskMetrics 0.94는 이 범위의 중앙값에 위치하므로 한국 시장에 적용 시 유의한 편의가 발생하지 않는다.

| 비교 항목 | GARCH(1,1) MLE | EWMA ($\lambda = 0.94$) |
|----------|---------------|------------------------|
| 추정 방식 | BFGS/Nelder-Mead 반복 수렴 | Closed-form 재귀식 |
| 종목당 추정 시간 | 50-200 밀리초 | 1 마이크로초 미만 |
| 2,645종목 일괄 처리 (2026-04-20 pin) | 2-10분 (직렬), 1-2분 (병렬) | 수십 밀리초 |
| 실시간 틱 갱신 | 전체 재추정 필요 | $O(1)$ 상수 시간 |
| 수렴 실패 위험 | 국소 최적 수렴, 경계 해 | 없음 |
| 매개변수 수 | 3 ($\omega, \alpha, \beta$) | 1 ($\lambda$, 고정) |
| 메인 스레드 사용 | 불가 (Worker 분리 필수) | 가능 |

이 선택의 비용은 장기 평균 분산 $\omega/(1-\alpha-\beta)$로의 회귀 동학을 포기하는 것이다. EWMA는 $\alpha + \beta = 1$ 제약에 의해 비정상(non-stationary) IGARCH 프로세스가 되어 장기 평균이 정의되지 않는다. 그러나 CheeseStock의 용도는 단기 변동성 국면 분류(HMM)와 패턴 신뢰도 조정의 입력이며, 장기 예측이 아니라 최근 10-20일 변동성 수준의 추정이 핵심이다. 이 제한된 용도 내에서 EWMA와 GARCH의 예측 성능 차이는 경험적으로 유의하지 않다는 것이 Andersen et al. (2006)의 리뷰 논문에서 확인된다.

\newpage

### 2.3.2 극단값 이론: GEV, GPD, Hill (Extreme Value Theory)
극단값 이론(EVT)은 가우시안 꼬리 확률의 치명적 부적합성을 교정한다.
Fisher-Tippett-Gnedenko 정리(1928/1943)의 GEV 분포와 Pickands-Balkema-de Haan
정리의 GPD가 핵심이며, Hill 추정량이 꼬리 두께를 측정한다.
$$\text{GEV: } G(x; \mu, \sigma, \xi) = \exp\left\{-\left[1 + \xi \frac{x - \mu}{\sigma}\right]^{-1/\xi}\right\}$$

$$\text{GPD: } H(y; \sigma, \xi) = 1 - \left(1 + \xi \frac{y}{\sigma}\right)^{-1/\xi}$$

$$\text{Hill: } \hat{\alpha} = \frac{k}{\sum_{i=1}^{k} [\ln X_{(i)} - \ln X_{(k+1)}]}$$

$$\text{EVT VaR: } \text{VaR}_p = u + \frac{\sigma}{\xi}\left[\left(\frac{n}{N_u}(1-p)\right)^{-\xi} - 1\right]$$

| 기호 | 의미  |
|:----:|------|
| $\xi$ | 형상 매개변수 (꼬리 유형)  |
| $\hat{\alpha}$ | 힐 꼬리지수 추정량  |
| $k$ | 상위 순서통계량 수  |
| $u$ | POT 임계값  |
| $X_{(i)}$ | 정렬된 절대수익률 순서통계량  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{X₍i₎}$은(는) Stage 1 데이터 계층에서 산출된다.


금융 수익률: $\xi \approx 0.2$--$0.4$ (프레셰 유형), GPD PWM 추정(Hosking & Wallis, 1987).

\newpage

### 2.3.3 강건 회귀: WLS, Ridge, HC3, Theil-Sen (Robust Regression)
금융 데이터의 이분산성과 이상치에 대응하는 강건 회귀 기법들이다.
WLS(Aitken, 1935)는 지수적 시간감쇠로 최근 패턴에 높은 가중치를 부여하며,
HC3(MacKinnon & White, 1985)은 이분산성 하에서의 유효한 추론을, Theil-Sen은
29.3% 붕괴점의 이상치 저항 추정을 제공한다.
$$\text{WLS: } \hat{\beta} = (X^T W X)^{-1} X^T W y, \quad w_i = \lambda^{T-t_i} \; (\lambda=0.995)$$

$$\text{Ridge: } \hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$$

$$\text{HC3: } \text{Cov}_{\text{HC3}}(\hat{\beta}) = (X^TWX + \lambda I)^{-1} X^TW\,\text{diag}\!\left(\frac{e_i^2}{(1-h_{ii})^2}\right)\!WX\,(X^TWX + \lambda I)^{-1}$$

$$\text{Theil-Sen: } \hat{\beta}_{\text{slope}} = \text{median}\left\{\frac{y_j-y_i}{x_j-x_i}\right\}$$

| 기호 | 의미  |
|:----:|------|
| $W$ | 가중행렬 (지수적 시간감쇠)  |
| $\lambda_{\text{decay}} = 0.995$ | 반감기 ≈ 139 거래일  |
| $h_{ii}$ | 지렛점 (모자행렬 대각)  |
| $e_i$ | OLS 잔차  |

| R² | 해석 | 실무적 의의 |
|:-----:|------|-------------|
| 0.02--0.03 | 경제적으로 유의미 | 연간 수백 bp |
| 0.05+ | 매매전략 수준 | 체계적 전략 활용 |
| > 0.10 | 극히 드묾 | 과적합 의심 |

\newpage

### 2.3.4 HAR-RV 변동성 예측 (HAR-RV Model)
이질적 자기회귀 실현 변동성(HAR-RV, Corsi 2009)은 이질적 시장 가설(Muller et al.
1997)에 기반하여 일/주/월 3-스케일 변동성 분해를 수행한다.
$$RV_{t+1}^{(d)} = \beta_0 + \beta_d \cdot RV_t^{(d)} + \beta_w \cdot RV_t^{(w)} + \beta_m \cdot RV_t^{(m)} + \varepsilon_{t+1}$$

| 기호 | 의미  |
|:----:|------|
| $RV_t^{(d)} = r_t^2$ | 일별 실현 분산  |
| $RV_t^{(w)} = \frac{1}{5}\sum_{i=0}^{4} r_{t-i}^2$ | 주간 성분  |
| $RV_t^{(m)} = \frac{1}{M}\sum_{i=0}^{M-1} r_{t-i}^2$ | 월간 성분 (M=22 KRX)  |
| $r_t$ | 일별 로그수익률  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{rt}$은(는) Stage 1 데이터 계층에서 산출된다.
>
> M=22 근거: KRX 연간 거래일 약 250일/12개월 ≈ 20.8일, Corsi(2009) 원전의 NYSE 관습값 22일을 따라 `indicators.js:2072`에서 M=22로 구현(MIN_BARS = M + 60 = 82봉 최소).

### 2.3.5 최대우도추정 (Maximum Likelihood Estimation)
최대우도추정(MLE)은 GARCH 매개변수 교정, GPD 적합, HMM 전이행렬 추정의
통계학적 기반이다.
$$\hat{\theta}_{\text{MLE}} = \arg\max_{\theta} \sum_{i=1}^{n} \ln f(x_i; \theta)$$

| 기호 | 의미  |
|:----:|------|
| $\hat{\theta}$ | 매개변수 추정치  |
| $f(x;\theta)$ | 확률밀도함수  |
| $x_i$ | 관측 데이터  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{xi}$은(는) Stage 1 데이터 계층에서 산출된다.

\newpage

### 2.3.6 변화점 감지: CUSUM과 이진 세분화 (Change Point Detection)
CUSUM(Page, 1954)과 이진 세분화(Bai-Perron, 1998)는 시계열의 구조적 변화를
감지한다. CheeseStock은 변동성 국면 적응형 임계값으로 고전적 CUSUM을 확장한다.
$$S_t^+ = \max(0, S_{t-1}^+ + z_t - k), \quad S_t^- = \max(0, S_{t-1}^- - z_t - k)$$

$$\text{이진 세분화: } \text{BIC}_{\text{seg}} = n\ln(\max(\text{RSS}/n, 10^{-12})) + 2\ln(n)$$

| 기호 | 의미  |
|:----:|------|
| $z_t$ | 표준화 관측치  |
| $k$ | 슬랙 매개변수(allowance)  |
| $h$ | 임계값  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{z_t}$은(는) Stage 1에서 수집된 로그수익률을 표준화하여 산출된다.


### 2.3.7 HMM 국면 분류 (Hidden Markov Models)
HMM(Baum et al. 1970; Hamilton 1989)은 시장을 관측 불가능한 국면(강세, 약세,
횡보) 간의 마르코프 전이로 모형화한다. 바움-웰치 알고리즘(EM 특수 경우)이
전이행렬과 방출행렬을 추정한다.
$$P(S_t = j | S_{t-1} = i) = a_{ij}$$

$$P(O_t | S_t = j) = b_j(O_t)$$

| 기호 | 의미  |
|:----:|------|
| $S_t$ | 은닉 상태 (시장 국면)  |
| $a_{ij}$ | 전이확률 (i → j)  |
| $b_j(O_t)$ | 방출확률  |
| $O_t$ | 관측 수익률 시계열  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{Ot}$은(는) Stage 1 데이터 계층에서 산출된다.


HMM 국면 레이블은 오프라인 파이프라인에서 사전 계산되어 런타임에 로드된다.

매개변수 추정에는 Baum-Welch 알고리즘(Dempster, Laird & Rubin 1977의 EM 알고리즘의 HMM 특수 경우)을 사용한다. E-step에서 관측 시계열 전체를 조건으로 각 시점의 사후 상태 확률을 계산한다.
$$\gamma_t(s) = P(S_t = s \mid O_{1:T},\;\theta)$$

M-step에서는 $\gamma_t(s)$를 가중치로 사용하여 전이확률 $a_{ij}$와 방출 분포 매개변수 $(\mu_s, \sigma_s^2)$를 갱신한다. EM의 일반적 성질에 의해 관측 데이터 로그우도 $\ell(\theta) = \ln P(O_{1:T} \mid \theta)$는 각 반복에서 단조 증가하며 국소 극대에 수렴한다(Dempster, Laird & Rubin 1977). CheeseStock은 50회 반복 또는 수렴 임계값 $10^{-4}$ 중 먼저 도달하는 조건을 사용한다.

추정된 모형으로부터 최적 상태열(most probable state sequence)을 복원하는 데는 Viterbi 알고리즘(Viterbi 1967)을 적용한다.
$$\delta_t(j) = \max_{s_1,\ldots,s_{t-1}} P(s_1,\ldots,s_{t-1},\;S_t = j,\;O_{1:t})$$

이 재귀는 $\delta_t(j) = \max_i [\delta_{t-1}(i) \cdot a_{ij}] \cdot b_j(O_t)$로 효율적으로 계산되며, 역추적(backtracking)으로 전체 최적 경로를 복원한다.

모형 선택(상태 수 결정)에는 BIC(Schwarz 1978)를 기준으로 한다.
$$\text{BIC} = -2\ln L + k \ln T$$

여기서 $k$는 자유 매개변수 수, $T$는 관측 수이다. 2-state 모형은 Hamilton(1989)이 미국 GDP/산업생산 데이터에서 확립한 선례를 따르며, KOSPI 데이터에서도 3-state 대비 2-state의 BIC가 더 낮아 이를 채택한다. EM 알고리즘은 상태 라벨에 불변(label-invariant)하므로, 수렴 후 각 상태의 평균 수익률 $\mu_s$를 비교하여 $\mu$가 높은 상태를 bull, 낮은 상태를 bear로 사후 할당(post-hoc assignment)한다. 이 라벨 전환(label switching) 문제는 혼합 모형 추정의 일반적 특성이다(Redner & Walker 1984).

| 기호 | 의미  |
|:----:|------|
| $\gamma_t(s)$ | 시점 t에서 상태 s의 사후 확률 (Baum-Welch E-step)  |
| $\delta_t(j)$ | 시점 t에서 상태 j의 최적 경로 확률 (Viterbi)  |
| $k$ | 자유 매개변수 수 (BIC)  |
| $T$ | 관측 시계열 길이  |

> 참고문헌: Rabiner (1989), Hamilton (1994) Ch.22, Dempster, Laird & Rubin (1977), Viterbi (1967), Schwarz (1978).

\newpage

## 2.4 경영학적 기초: 기업재무와 가치평가[^biz-1]

경영학(기업재무론)은 기업의 본질가치(intrinsic value)를 결정하는 이론적 프레임워크를 제공한다.
CheeseStock의 재무 분석 패널(D 컬럼)은 DCF, WACC, EVA 등 기업재무 이론에 기반하여
패턴 분석과 기본적 분석의 교차검증(cross-validation)을 수행한다. 기술적 분석이 "가격이
어디로 가는가"를 묻는다면, 기업재무론은 "가격이 어디에 있어야 하는가"를 묻는다.
이 두 질문의 괴리가 투자 기회이며, 본 절은 후자의 이론적 토대를 제공한다.

이론적 흐름 (10시트): DCF 기업가치 (2.4.1) → MM 무관련성 (2.4.2) → Miller 개인세 (2.4.3) → WACC (2.4.4) → 대리인 비용 (2.4.5) → DuPont 분해 (2.4.5a) → 신호이론 (2.4.6) → EVA (2.4.7) → Kelly 기준 (2.4.8) → 기업재무론 통합 (2.4.9). MM의 완전시장 가정에서 현실적 마찰(세금, 대리인, 정보비대칭)을 하나씩 도입하며, 기업재무 이론의 역사적 발전 경로를 따른다.


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
|:----:|------|
| $V$ | 기업 총가치 (EV)  |
| $FCF_t$ | t기 잉여현금흐름  |
| $FCF_1$ | 영구 성장 단계 첫 해 FCF (≡ FCF_n(1+g))  |
| $\text{WACC}$ | 가중평균자본비용  |
| $TV$ | 터미널 밸류  |
| $g$ | 영구 성장률  |
| $T$ | 법인세율  |
| $\text{D\&A}$ | 감가상각비  |
| $\text{CAPEX}$ | 자본적 지출  |
| $\Delta \text{NWC}$ | 순운전자본 변동  |
| $\text{EBIT}$ | DART 영업이익  |
| $\text{EPS}$ | 주당순이익  |
| $\beta_{\text{KRX}}$ | KRX 베타 (CAPM 산출용)  |

> 이전 Stage 데이터: Stage 1(DART API)에서 `영업이익(EBIT)`, `EPS`, `자본총계`, `이자부채`를 수신한다. DART stat code `ifrs-full_ProfitLossFromOperatingActivities`가 EBIT에 해당하며, `download_financials.py`가 이를 `data/financials/{code}.json`에 기록한다. `compute_capm_beta.py`가 산출한 $\beta_{KRX}$는 WACC 계산의 자기자본비용($R_e$) 입력값이다.

KRX 특이사항: 자본잠식 종목(자기자본 < 납입자본금의 50%)은 계속기업(going concern) 가정을 위반하므로 DCF 모형이 무효화된다. 이 경우 청산가치(liquidation value) 또는 자산가치 기반 평가로 전환해야 하며, `financials.js`는 `자본총계 < 0` 조건을 감지하여 D 컬럼에 경고를 표시한다.

DCF, MM 정리, WACC 산출, Hamada 방정식은 이론적 기초로서 참조되며, 런타임 코드에서 직접 계산되지 않는다. 실제 런타임 밸류에이션은 PER/PBR/PSR 상대가치 비교와 투자판단 점수에 한정된다.


### 2.4.2 자본구조: MM 정리 (Capital Structure: Modigliani-Miller)
Modigliani & Miller(1958, 1963)의 자본구조 무관련 정리는 현대 기업재무론의 출발점이다. 핵심은 "완전 자본시장에서 기업가치는 자본구조와 무관하다"는 명제로, 부채와 자기자본의 조합 방식은 기업가치의 크기가 아닌 분배만을 결정한다.

1963년 수정 모형은 법인세를 도입하여 부채의 이자비용이 세전 공제됨에 따라 $T_c \cdot D$만큼의 세금절감 효과가 발생하고 기업가치가 증가함을 보였다. 그러나 100% 부채가 최적이라는 비현실적 결론에 도달하므로, 상충이론과 Miller(1977) 개인세 모형이 제안되었다.

MM 제2명제는 자기자본비용이 레버리지 증가에 따라 선형 상승하여 WACC가 일정하게 유지됨을 보인다. 제2명제는 Hamada(1972) 방정식(2.4.4절)을 통해 자본구조 변화에 따른 베타 조정의 이론적 근거를 제공한다.

한국 시장에서 MM 완전 자본시장의 5가지 가정 중 적어도 3가지가 위반된다. 재벌 지배구조에 따른 정보 비대칭, 복층 세금 구조, 재무적 곤경 비용이 대표적이다. MM 정리는 한국 시장 분석의 기준점으로 활용하되, 현실 조건의 이탈을 명시적으로 모형화해야 한다.
$$\text{MM-I (무세금, 1958):} \quad V_L = V_U$$

$$\text{MM-I (법인세, 1963):} \quad V_L = V_U + T_c \cdot D$$

$$\text{MM-II (자기자본비용):} \quad R_E = R_A + (R_A - R_D)\frac{D}{E}(1-T_c)$$

$$\text{상충이론:} \quad V_L = V_U + PV(\text{Tax Shield}) - PV(\text{Distress Cost})$$

| 기호 | 의미  |
|:----:|------|
| $V_L$ | 레버리지 기업 가치  |
| $V_U$ | 무레버리지 기업 가치  |
| $T_c$ | 법인세율  |
| $D$ | 부채 시장가치  |
| $R_E$ | 자기자본비용 (레버리지 후)  |
| $R_A$ | 자산수익률 (무레버리지)  |
| $R_D$ | 타인자본비용  |
| 자본총계 | DART 자기자본 장부가  |
| 이자부채 | DART 단·장기차입금 합계  |

> 이전 Stage 데이터: Stage 1 DART 파이프라인에서 수신한 `자본총계`와 `이자부채`로 D/E 비율을 산출한다. `자본총계`는 IFRS 기준 `ifrs-full_Equity`, `이자부채`는 `ifrs-full_Borrowings + ifrs-full_DebtSecuritiesIssued`로 매핑된다.


### 2.4.3 개인세 모형 (Miller 1977)
Merton Miller(1977)는 미국재무학회 회장 취임 연설에서 법인세만을 고려한 MM(1963) 모형이 개인세를 무시함으로써 부채의 세금 이점을 과대평가한다는 점을 지적했다. Miller의 핵심 통찰은 투자자가 이자소득과 배당소득(또는 자본이득)에 대해 서로 다른 세율로 개인세를 납부한다는 사실이다. 이자소득에 대한 개인세율($T_d$)이 높을수록 부채의 순세금 이점은 감소한다.

Miller 균형(Miller equilibrium)은 개인세율이 이질적인 투자자 집단을 도입하여 도출된다. 기업들이 부채를 늘릴수록 채권 수익률이 상승하고, 점점 더 높은 개인세율의 투자자를 유인해야 한다. 균형에서 한계 채권 투자자의 세율이 $(1-T_d^*) = (1-T_c)(1-T_s)$를 만족하면 추가적인 부채 발행의 세금 이점이 0이 되어, 경제 전체의 부채 총량은 결정되지만 개별 기업의 자본구조는 무관하게 된다.

한국 세제를 Miller 모형에 대입하면 세 가지 사례가 구분된다. Case A(배당 중심, $T_s = T_d = 15.4\%$)에서는 개인세가 상쇄되어 MM(1963)과 동일한 결론($G_L = T_c \cdot D$)이 도출된다. Case B(소액주주 자본이득 비과세, $T_s \approx 0$)에서는 부채의 세금 이점이 $0.22D$에서 $0.078D$로 대폭 축소된다. Case C(금융소득종합과세, $T_d = T_s = 40\%$)에서도 동일한 세율로 인해 역시 $G_L = T_c \cdot D$가 성립한다.

CheeseStock의 신뢰도 조정 시스템은 Miller 모형의 함의를 간접적으로 반영한다. 고배당주(소액주주 $T_s = T_d$ 조건)는 자본구조 중립 가정이 성립하는 반면, 자본이득 중심 성장주(Case B)는 부채가 많더라도 세금절감 이점이 제한적이다. 이는 같은 D/E 비율이라도 배당 정책에 따라 WACC 계산값이 달라질 수 있음을 시사한다.
$$G_L = \left[1 - \frac{(1-T_c)(1-T_s)}{1-T_d}\right] \cdot D$$

$$V_L = V_U + G_L = V_U + \left[1 - \frac{(1-T_c)(1-T_s)}{1-T_d}\right] \cdot D$$

$$\text{Miller 균형 조건:} \quad (1-T_d^*) = (1-T_c)(1-T_s) \implies G_L = 0$$

| 기호 | 의미  |
|:----:|------|
| $G_L$ | 부채의 세금 순이득  |
| $T_c$ | 법인세율 (한국 실효 ≈ 0.22)  |
| $T_d$ | 이자소득에 대한 개인세율  |
| $T_s$ | 자기자본 소득 유효 개인세율  |
| $D$ | 부채 시장가치  |
| 자본총계 | DART 자기자본  |
| 이자부채 | DART 차입금·사채 합계  |

> 이전 Stage 데이터: Stage 1에서 수신한 `자본총계`와 `이자부채`로 D 및 D/E를 산출한다. 실효세율($T_c$)은 DART `ifrs-full_IncomeTaxExpense` / `ifrs-full_ProfitLossBeforeTax`로 추정할 수 있으며, `download_financials.py`가 이를 기록한다.

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
|:----:|------|
| $E$ | 자기자본 시장가치 (시가총액)  |
| $D$ | 타인자본 시장가치  |
| $V = E + D$ | 총자본 시장가치  |
| $R_d$ | 타인자본비용 (차입이자율)  |
| $T_c$ | 법인세율  |
| $\beta_L$ | 레버리지 베타  |
| $\beta_U$ | 무레버리지 베타  |
| $R_f$ | 국고채 3Y/10Y 수익률  |
| $\beta$ | KRX CAPM 베타  |
| 실효세율 | DART 법인세비용/세전이익  |

> 이전 Stage 데이터: $R_f$는 Stage 1 ECOS API `722Y001` (국고채 3년) 및 `817Y002` (국고채 10년)에서 수신한다. $\beta$는 `compute_capm_beta.py`가 OHLCV 데이터로 산출하여 `data/derivatives/capm_beta.json`에 기록한 값을 사용한다. 실효세율은 DART `download_financials.py` 출력물에서 추출한다.

#### Hamada 3단계 절차 (peer group beta 조정)

| 단계 | 공식 | 목적 |
|:----:|------|------|
| 1. Unlever | β_(U,i) = β_(L,i) / [1+(1-T_c)(D/E)i] | 각 비교기업 자본구조 제거 |
| 2. Average | β̄_U = mean(β_(U,i)) | 산업 고유 위험 추정 |
| 3. Re-lever | β_(L,target) = β̄_U[1+(1-T_c)(D/E)_(target)] | 분석 대상에 자본구조 재적용 |

### 2.4.5 대리인 이론과 기업지배구조 (Agency Theory & Corporate Governance)
Jensen & Meckling (1976)은 기업의 소유와 경영이 분리될 때 발생하는 대리인 비용(agency costs)을 감시비용(MC), 결속비용(BF), 잔여손실(RL)의 3요소로 분해하였다. 이는 경영학 재무관리의 핵심 프레임워크이며, 대리인 비용이 높은 기업에서는 이익의 질(earnings quality)이 낮아 EPS 기반 패턴의 신뢰도가 하락하고, 배당/자사주 신호의 정보 함량이 변질된다. Holmstrom (1979)은 도덕적 해이 하의 최적 계약을 정식화하여, 인센티브 강도 $\beta^*$가 환경 불확실성($\sigma^2$), 위험회피($\rho$), 노력 효과($\Delta f$)의 함수임을 도출하였다.

한국 재벌(chaebol) 그룹은 글로벌 기업 지배구조에서 대리인 문제의 극단적 사례를 제공한다. La Porta, Lopez-de-Silanes & Shleifer (1999)와 Claessens et al. (2000)의 프레임워크에 따르면, 지배주주의 현금흐름권($C$)과 의결권($\alpha$)의 괴리도(wedge) $W = \alpha - C$가 터널링 유인을 결정한다. 한국 4대 재벌의 괴리도 비율($WR = \alpha/C$)은 삼성 ($\approx 20.6$), SK ($\approx 11.4$), 현대차 ($\approx 10.7$), LG ($\approx 9.0$)으로 동아시아 최고 수준이다 (공정거래위원회 2024). WR이 10을 초과하면 터널링 이벤트(내부거래 공시, 유상증자, 합병) 시 패턴 신뢰도를 체계적으로 하향해야 한다. Bae, Kang & Kim (2002)은 재벌 인수 기업의 CAR$[-1,+1]$이 $-0.6\%$인 반면 지배주주 부(wealth)는 $+1.5\%$ 증가함을 실증하였다.

대리인 위험의 정량화를 위해 ARI(Agency Risk Index)가 설계되었으며, 핵심 매개변수인 `eps_stability`는 V39에서 파이프라인이 복원되었다. `data.js`의 `getFinancialData()`가 DART 연간 데이터에서 `ni_history` 배열을 조립하여 `_financialCache`에 적재하고, `appWorker.js`의 HHI boost 계산에서 이익변동성 감쇠($\text{eps\_stability} = 1/(1+\sigma_{\text{NI\_growth}}/100)$)가 실데이터로 작동한다. seed 데이터에서는 fake data 방지를 위해 `ni_history = null`로 처리되어 fallback 1.0이 유지된다.
$$AC = MC + BF + RL$$

$$\beta^* = \frac{1}{1 + \rho\sigma^2 / \Delta f^2} \qquad \text{(Holmstrom 1979)}$$

$$\text{ARI} = w_1 \cdot \text{ROE\_inv} + w_2 \cdot \text{CAPEX\_excess} + w_3 \cdot (1 - BI) + w_4 \cdot \text{RPRR}$$

$$W = \alpha - C, \qquad WR = \alpha / C \qquad \text{(한국 재벌 평균 } C \approx 2\text{--}5\%, \; \alpha \approx 30\text{--}50\%\text{)}$$

| 기호 | 의미  |
|:----:|------|
| $AC$ | 총 대리인 비용  |
| $MC, BF, RL$ | 감시비용, 결속비용, 잔여손실  |
| $\beta^*$ | 최적 인센티브 강도  |
| $\rho$ | 대리인 위험회피 계수  |
| $\sigma^2$ | 산출물 분산 (환경 불확실성)  |
| $\Delta f$ | 노력에 의한 산출 차이  |
| $\text{ROE}$ | 자기자본이익률 (financials.json)  |
| $\text{NI}$ | 당기순이익  |
| $\text{RPRR}$ | 관계사 매출 비중 (tunneling proxy)  |
| $\text{BI}$ | 이사회 독립성 (사외이사/총원)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\text{ROE}}$는 `getFinancialData()`에서 당기순이익/자본총계로 산출된다. $\textcolor{stageOneMarker}{\text{NI}}$는 `eps_stability` 산출(NI 성장률 변동성)에 사용되며, V39에서 `_financialCache`에 `ni_history` 배열이 적재되어 실데이터 기반으로 작동한다.

\newpage

### 2.4.5a DuPont 분해와 수익성 진단 (DuPont Decomposition & Profitability Diagnosis)

F. Donaldson Brown(1914)이 DuPont Corporation 내부 경영도구로 고안한 DuPont System은 자기자본이익률(ROE)을 세 가지 구성요소로 분해하여 수익성의 원천을 진단한다. 이 분해의 핵심 통찰은 동일한 ROE를 기록하는 두 기업이 전혀 다른 경영 역량 조합을 가질 수 있다는 점이다. 순이익률(NPM)이 높은 기업은 가격 지배력 또는 원가 통제에서 우위를 지니고, 자산회전률(AT)이 높은 기업은 자본 배치의 효율성에서 우위를 지닌다. 자본승수(EM)는 재무 레버리지를 포착하여, 수익성이 자본구조의 산물인지 영업역량의 산물인지 분별하게 한다.

$$\text{ROE} = \underbrace{\frac{\text{당기순이익}}{\text{매출액}}}_{\text{NPM}} \times \underbrace{\frac{\text{매출액}}{\text{총자산}}}_{\text{AT}} \times \underbrace{\frac{\text{총자산}}{\text{자기자본}}}_{\text{EM}}$$

3-factor 분해의 구성요소별 시계열 속성은 Nissim & Penman(2001, *Review of Accounting Studies*)에 의해 체계적으로 분석되었다. 순이익률은 경쟁 압력과 경기순환에 의해 강한 평균회귀(mean-reverting) 특성을 보이는 반면, 자산회전률은 산업 구조와 자본집약도에 의해 결정되어 지속성(persistence)이 높다. 이 비대칭적 지속성은 밸류에이션 함의를 가진다. 일시적으로 높은 순이익률에 기반한 ROE는 미래에 하락할 가능성이 크므로 높은 PER 부여가 정당화되기 어렵고, 자산회전률 개선에 기반한 ROE 상승은 구조적 변화로서 더 큰 밸류에이션 재평가를 지지한다. Penman(2013, *Financial Statement Analysis and Security Valuation*)은 이 관계를 "수익성의 원천이 지속성을 결정하고, 지속성이 가치를 결정한다"로 요약하였다.

CFA Level I Financial Statement Analysis에서는 3-factor를 5-factor로 확장한 Extended DuPont도 다룬다.

$$\text{ROE}_{\text{5-factor}} = \underbrace{\frac{\text{NI}}{\text{EBT}}}_{\text{Tax Burden}} \times \underbrace{\frac{\text{EBT}}{\text{EBIT}}}_{\text{Interest Burden}} \times \underbrace{\frac{\text{EBIT}}{\text{Revenue}}}_{\text{EBIT Margin}} \times \underbrace{\frac{\text{Revenue}}{\text{Assets}}}_{\text{AT}} \times \underbrace{\frac{\text{Assets}}{\text{Equity}}}_{\text{EM}}$$

5-factor 확장은 세금 부담과 이자 부담을 명시적으로 분리하여, 실효세율 변동이나 이자비용 증가가 ROE에 미치는 영향을 개별적으로 추적할 수 있게 한다. 다만 K-IFRS 공시의 계정과목 세분화 수준과 DART API 데이터의 가용성을 고려하여, CheeseStock은 3-factor 분해를 채택하였다. 한국 상장사의 경우 EBT 이하 세분 계정의 분기별 일관성이 낮아 5-factor 분해의 신뢰도가 저하되는 실무적 제약도 이 선택을 뒷받침한다.

DuPont 분해와 EVA(2.4.7절)의 ROIC 분해 사이에는 구조적 유사성과 핵심 차이가 공존한다.

$$\text{ROIC} = \frac{\text{NOPAT}}{\text{IC}} = \underbrace{\frac{\text{NOPAT}}{\text{매출액}}}_{\text{세후 영업마진}} \times \underbrace{\frac{\text{매출액}}{\text{IC}}}_{\text{IC 회전율}}$$

DuPont AT의 분모는 총자산(Total Assets)이고, ROIC 회전율의 분모는 투하자본(IC = 자기자본 + 이자부채)이다. 총자산에는 비이자성 유동부채(매입채무, 미지급금 등)가 포함되므로 IC보다 크다. DuPont은 주주 관점(ROE 분해)에서, ROIC는 전체 자본 제공자 관점(주주 + 채권자)에서 수익성을 진단한다. 두 지표를 함께 분석하면 레버리지 효과의 방향과 크기를 정밀하게 파악할 수 있다. ROE가 ROIC보다 유의하게 높다면 재무 레버리지가 주주수익률을 증폭하고 있는 것이며, ROIC가 WACC를 하회하는 상황에서의 레버리지 증폭은 오히려 주주가치를 파괴하고 있음을 의미한다.

CheeseStock의 투자판단 점수(100점 만점)에서 DuPont 3-factor는 50점(전체의 50%)을 구동한다. `financials.js`의 `_calcInvestmentScore()` 함수가 이를 구현하며, 세 구성요소를 각각 업종 벤치마크 대비 상대평가한다. 업종 벤치마크는 `data/sector_fundamentals.json`에서 조회하고(`_getSectorAvg` 헬퍼), 미보유 업종은 KOSPI/KOSDAQ 시장 평균으로 폴백한다.

절대 기준이 아닌 업종 상대 기준을 채택한 이유는 DuPont 구성요소의 산업간 편차가 크기 때문이다. 반도체(삼성전자, SK하이닉스)의 NPM은 호황기 15~40%에 달하지만 유통업은 2~5%가 정상이며, 자산회전률은 유통업이 2.0 이상인 반면 유틸리티는 0.3 미만이다. 절대 임계값을 사용하면 산업 특성을 수익성 열등으로 오판하게 되고, 이는 밸류에이션 비교의 근본 원리인 "유사기업 비교(comparable analysis)"를 위반한다. 다만 자산회전률(AT)의 업종 벤치마크는 현재 `sector_fundamentals.json`에 미포함되어 절대 임계값(0.4/0.8/1.2)이 사용되고 있으며, 향후 업종별 AT 중앙값이 확보되면 상대평가로 전환할 예정이다.

현재 구현에서는 업종 영업이익률(OPM)을 NPM 벤치마크의 프록시로 사용한다. 순이익률은 비영업 항목(이자, 세금, 특별손익)을 포함하여 업종 간 비교 시 잡음이 크므로, 핵심 수익성을 반영하는 OPM이 더 안정적인 벤치마크이다.

배점 구조는 순이익률(NPM) 20점, 자산회전률(AT) 15점, 자본승수 적정성(EM) 15점이다. NPM에 최대 가중치를 부여한 것은 Nissim & Penman(2001)의 실증에서 NPM이 미래 ROE 변동을 가장 많이 설명하는 구성요소임이 확인되었기 때문이다. EM은 방향성이 아닌 적정성(1.0~3.0 구간에서 최고점)으로 평가하여, 과소 레버리지(자본 비효율)와 과다 레버리지(재무위험) 모두를 감점 처리한다.

$$\text{투자판단}_{\text{DuPont}} = \underbrace{S_{\text{NPM}}}_{\text{20점}} + \underbrace{S_{\text{AT}}}_{\text{15점}} + \underbrace{S_{\text{EM}}}_{\text{15점}} = 50\text{점}$$

$$S_{\text{NPM}} = \begin{cases} 20 & \text{if } \text{NPM} / \text{NPM}_{\text{sector}} \geq 1.5 \\ 15 & \text{if } \geq 1.0 \\ 10 & \text{if } \geq 0.5 \\ 5 & \text{if } \text{NPM} > 0 \\ 0 & \text{otherwise} \end{cases}$$

$$S_{\text{AT}} = \begin{cases} 15 & \text{if AT} \geq 1.2 \\ 12 & \text{if } \geq 0.8 \\ 8 & \text{if } \geq 0.4 \\ 4 & \text{if AT} > 0 \end{cases} \qquad S_{\text{EM}} = \begin{cases} 15 & \text{if } 1.0 \leq \text{EM} \leq 3.0 \\ 8 & \text{if } 3.0 < \text{EM} \leq 5.0 \\ 3 & \text{otherwise} \end{cases}$$

| 기호 | 의미  |
|:----:|------|
| $\text{ROE}$ | 자기자본이익률 = NI / Equity  |
| $\text{NPM}$ | 순이익률 = NI / Revenue  |
| $\text{AT}$ | 자산회전률 = Revenue / Total Assets  |
| $\text{EM}$ | 자본승수 = Total Assets / Equity  |
| $\text{NI}$ | 당기순이익 (DART 연결 기준)  |
| $\text{NPM}_{\text{sector}}$ | 업종 평균 순이익률 (`sector_fundamentals.json`)  |
| $S_{\text{NPM}}, S_{\text{AT}}, S_{\text{EM}}$ | 각 구성요소 배점  |
| $\text{ROIC}$ | 투하자본수익률 = NOPAT / IC  |
| $\text{IC}$ | 투하자본 = 자기자본 + 이자부채  |

> 이전 Stage 데이터: DuPont 3-factor의 입력 변수는 Stage 1 DART 파이프라인에서 수신한다. `getFinancialData()`가 DART 연간 데이터에서 매출액(`rev`), 총자산(`total_assets`), 자기자본(`total_equity`), 당기순이익(`ni`)을 적재하며, 업종 평균은 `sector_fundamentals.json`에서 조회한다.

\newpage

### 2.4.6 시그널링 이론 (Signaling Theory)
Spence (1973)의 직업시장 시그널링 모형은 정보 비대칭 하에서 고품질 주체가 비용이 드는 행동으로 자신의 유형을 드러내는 메커니즘을 정식화하였다. 핵심은 단일 교차 조건: 시그널 비용이 품질에 반비례($dC/d\theta < 0$)해야 분리 균형이 성립한다. Ross (1977)는 이를 기업재무로 확장하여, 파산 시 패널티 $L$이 충분히 크면 고품질 기업만이 높은 부채를 감당할 수 있어 분리 균형이 형성됨을 보였다.

Bhattacharya (1979)는 배당이 세금 비용과 외부조달 거래비용을 수반하므로 기업 품질의 신뢰할 수 있는 시그널이 됨을 보였다. Lintner (1956)의 배당 평활화 모형은 기업이 이익 변동의 30--50%만을 당기 배당에 반영($c \approx 0.3$--$0.5$)하며, 배당 삭감은 매우 강한 부정적 시그널임을 확인하였다.

Myers & Majluf (1984)는 역선택 하에서 자본조달 서열이론을 정식 모형화하였다. 고품질 기업일수록 주식 발행 시 저평가 부의 이전이 커서 발행을 꺼리므로, 내부자금 $\succ$ 부채 $\succ$ 주식의 서열이 도출된다.
$$\frac{dC}{d\theta} < 0 \qquad \text{(Spence 단일 교차 조건: 시그널 비용이 품질과 역관계)}$$

$$W = \gamma_0 + \gamma_1 V_t - L \cdot \mathbf{1}(\text{bankruptcy}) \qquad \text{(Ross 1977)}$$

$$D_t - D_{t-1} = c\bigl(\tau E_t - D_{t-1}\bigr) + u_t \qquad \text{(Lintner 1956 배당 조정)}$$

$$\text{NPV}_{\text{project}} > I \times \frac{V_{\text{true}} - V_{\text{market}}}{V_{\text{market}} + I} \qquad \text{(Myers-Majluf 1984 발행 조건)}$$

| 기호 | 의미  |
|:----:|------|
| $\theta$ | 기업 품질 유형  |
| $C(\theta)$ | 시그널 비용 함수  |
| $\gamma_0, \gamma_1$ | 경영자 고정보상, 가치연동 계수  |
| $L$ | 파산 시 경영자 패널티  |
| $D_t$ | t기 배당  |
| $\tau$ | 목표 배당성향  |
| $c$ | 배당 조정 속도  |
| $\text{DPR}$ | 배당성향  |
| $\text{EPS growth}$ | 주당순이익 성장률  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\text{DPR}}$은 DART 사업보고서에서 추출 가능하며, 배당 증가/삭감의 시그널 방향을 판별하는 핵심 입력이다. $\textcolor{stageOneMarker}{\text{EPS growth}}$는 Lintner 모형의 이익 변수 $E_t$에 대응하며, 영구적 이익 개선 여부를 판단하는 기준이 된다.

<!-- newpage -->

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
|:----:|------|
| $\text{EVA}$ | 경제적 부가가치  |
| $\text{NOPAT}$ | 세후 영업이익  |
| $\text{IC}$ | 투하자본  |
| $\text{ROIC}$ | 투하자본수익률  |
| $\text{MVA}$ | 시장부가가치  |
| $\text{NOPAT}$ | DART 영업이익 × (1-T)  |
| $\text{IC}$ | DART 자본총계 + 이자부채  |
| $\text{WACC}$ | CAPM 기반 산출 WACC  |

> 이전 Stage 데이터: Stage 1 DART 파이프라인에서 수신한 `영업이익(EBIT)`에 `(1-실효세율)`을 곱하여 NOPAT을 산출한다. IC는 `자본총계` + `이자부채`(단기차입금 + 유동성장기부채 + 사채 + 장기차입금)로 계산한다. `compute_eva.py` 스크립트가 이 계산을 수행하고 결과를 `data/backtest/eva_scores.json`에 기록한다.

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
|:----:|------|
| $f^*$ | 최적 투자 비율  |
| $b$ | 순배당률 (손익비)  |
| $p$ | 승률 (winning probability)  |
| $q = 1-p$ | 패률  |
| $G(f)$ | 기하 성장률  |
| $\mu$ | 기대 초과수익률  |
| $\sigma^2$ | 수익률 분산  |
| $\Sigma$ | 수익률 공분산 행렬  |
| $p_{\text{backtest}}$ | 패턴별 역사적 승률  |
| $b_{\text{backtest}}$ | 패턴별 역사적 손익비  |

> 이전 Stage 데이터: Stage 1 백테스트 파이프라인(`backtester.js`)은 각 패턴의 N일 수익률 통계에서 승률(`wins/n`)과 손익비(`payoffRatio`)를 산출한다. `kellyEdge = max(0, WR - wrNull)` 계산 후 `kellyRaw = (kellyEdge*(1+payoffRatio) - 1) / payoffRatio`로 Kelly 비율을 도출하고, `[0, 1.0]`으로 클램핑하여 `kellyFraction` 필드에 저장한다(라인 1599~1602). 음수 Kelly는 "베팅하지 말라"는 신호로 처리된다.

\newpage

### 2.4.9 기업재무론 통합 경로 (Business Finance Integration)

본 절(2.4)의 여덟 이론은 기술적 분석과 교차하며 신뢰도를 조정한다. DCF와 WACC(2.4.1, 2.4.4)는 내재가치 맥락을, 자본구조 이론(2.4.2, 2.4.3)은 재무 건전성의 이론적 근거를, 대리인 이론(2.4.5)과 시그널링 이론(2.4.6)은 경영 품질과 공시 해석의 프레임을 각각 제공한다. EVA(2.4.7)는 주주가치 창출 여부를, Kelly 기준(2.4.8)은 포지션 크기를 결정한다. 기술적 분석이 "가격이 어디로 가는가"를 묻는다면, 기업재무론은 "가격이 어디에 있어야 하는가"를 묻는다. 내재가치 대비 과매도 구간에서 기술적 반전 패턴이 발생할 때, 두 계층의 동시 신호가 신뢰도를 증폭한다.

제3장에서 이 이론들은 네 가지 경로로 연결된다. CONF-M2는 EVA > 0 조건에서 매수 패턴 신뢰도를 상향 조정하고, Rate Beta(Factor 10)는 WACC 변화 방향에 따른 비대칭 조정을 수행한다. Tier 한도에 Kelly ½ 비율을 적용하여 포지션을 사이징하며, PBR < 1.0과 이중바닥 패턴의 교차가 복합 매수 신호를 구성한다. 투자판단 점수는 DuPont 3-팩터 분해(50점) + 밸류에이션 업종 상대평가(30점) + 성장·안정(20점) = 100점 만점 체계이며, 등급은 A(80+), B(60--79), C(40--59), D(40 미만)로 분류된다. 가용 데이터 30점 미만 시 점수를 산출하지 않는다.

$$\text{종합 신뢰도} = \underbrace{f(\text{패턴 품질})}_{\text{기술적 분석}} \times \underbrace{g(\text{EVA, PBR, WACC})}_{\text{기업재무 조정}} \times \underbrace{h(\text{매크로 환경})}_{\text{2.5절}}$$

$$\text{포지션 크기} = \text{Tier 한도} \times \min\!\left(\frac{f^*_{\text{Kelly}}}{2},\; f^*_{\text{max}}\right)$$

| 기호 | 의미  |
|:----:|------|
| $f(\cdot)$ | 패턴 품질 점수 함수  |
| $g(\cdot)$ | 재무 조정 함수 (EVA, PBR, WACC)  |
| $h(\cdot)$ | 매크로 환경 조정 함수  |
| $f^*_{\text{Kelly}}$ | 패턴별 Kelly 비율  |
| $f^*_{\max}$ | Tier별 최대 포지션 한도  |

> 이전 Stage 데이터: $f^*_{\text{Kelly}}$는 `backtester.js kellyFraction`, EVA는 `compute_eva.py` 출력물, $R_f$는 ECOS API 국고채 수익률을 사용한다.

<!-- newpage -->

## 2.5 경제학적 기초: 거시경제와 미시경제[^econ-1]

경제학은 주식시장 행태를 지배하는 거시경제적, 미시경제적 맥락을 제공한다.
거시경제학(2.5.1-2.5.11)은 경기순환, 통화정책, 환율, 수익률 곡선 등
시장 전체에 영향을 미치는 체계적 요인을 다루며, 패턴 신뢰도의 매크로 조정에
직접 활용된다. 미시경제학(2.5.12-2.5.14)은 수요-공급 메커니즘, 산업 집중도,
정보비대칭 등 개별 종목 수준의 구조적 특성을 다루며, 종목별 미시 조정에
활용된다.

이론적 흐름 (15시트): 거시 — IS-LM 통화정책 (2.5.1) → 테일러 준칙 (2.5.2) → 먼델-플레밍 개방경제 (2.5.3) → AD-AS 총수요공급 (2.5.4) → Stovall 섹터 회전 (2.5.5) → 뉴케인지언 필립스 곡선 (2.5.6) → MCS 복합경기점수 (2.5.7) → 재정승수와 구축효과 (2.5.8) → 환율모형 PPP/IRP/도른부시 (2.5.9) → 수익률 곡선과 기간구조 (2.5.10) → HMM 거시 레짐 (2.5.11). 미시 — 수요-공급-탄력성 (2.5.12) → HHI 산업 집중도 (2.5.13) → 정보비대칭과 탐색비용 (2.5.14) → 요약 (2.5.15). 단기 균형에서 장기 구조까지, 체계적 요인을 다층적으로 포착한다.


### 2.5.1 IS-LM 모형과 통화정책 (IS-LM Model and Monetary Policy)
IS-LM 모형은 Hicks(1937)가 Keynes(1936)의 *General Theory*를 2차원 도식으로 변환한 이래 단기 거시균형 분석의 표준 프레임워크로 사용되어 왔다. IS 곡선은 재화시장의 균형(투자=저축)을, LM 곡선은 화폐시장의 균형(유동성 선호=화폐공급)을 나타내며, 두 곡선의 교차점에서 균형 산출량 $Y^*$와 균형 이자율 $r^*$가 동시에 결정된다.

한국은 GDP 대비 수출 비중이 약 50%에 달하는 소규모 개방경제이므로, 개방경제 확장(먼델-플레밍)이 IS-LM의 분석력을 완성한다. 변동환율제 하에서 통화정책이 재정정책보다 유효하다는 먼델-플레밍 결과(2.5.3절에서 후술)가 한국 주식시장에서의 BOK 기준금리 발표의 지배적 영향력을 이론적으로 뒷받침한다. 한국 파라미터 추정치로는 한계소비성향 $c_1 \approx 0.55$, 한계세율 $t \approx 0.25$, 한계수입성향 $m \approx 0.45$가 사용된다(BOK 2023, 관세청).

IS-LM 비교정학은 정책 충격의 방향과 크기를 예측하는 데 핵심이다. 통화확장($M/P$ 증가)은 $Y$ 증가와 $r$ 하락을 동시에 가져오는 "이중 호재"인 반면, 재정확장($G$ 증가)은 $Y$ 증가와 함께 $r$ 상승(구축효과)을 수반하여 성장주에 비우호적이다. 이러한 비대칭성이 CheeseStock의 `_applyMacroConfidence` 함수에서 매크로 이벤트별 패턴 신뢰도 차등 조정의 이론적 기반이 된다.
$$Y = \frac{A - b \cdot r}{1 - c_1(1-t) + m}, \qquad A = C_0 - c_1 T_0 + I_0 + G_0 + X_0 + \eta \cdot e$$

$$\text{IS}: \; r = \frac{A}{b} - \frac{1 - c_1(1-t) + m}{b} \cdot Y$$

$$\text{LM}: \; r = \frac{k}{h} \cdot Y - \frac{M/P}{h}$$

$$Y^* = \frac{h \cdot A + b \cdot (M/P)}{h \cdot s + b \cdot k}, \quad r^* = \frac{k \cdot A - s \cdot (M/P)}{h \cdot s + b \cdot k}, \quad s = 1 - c_1(1-t) + m$$

| 기호 | 의미  |
|:----:|------|
| $c_1$ | 한계소비성향(MPC)  |
| $t$ | 한계세율  |
| $m$ | 한계수입성향  |
| $b$ | 투자의 이자율 민감도  |
| $k$ | 소득의 화폐수요 민감도  |
| $h$ | 이자율의 화폐수요 민감도  |
| $i_{\text{BOK}}$ | BOK 기준금리  |
| $\text{CLI}$ | OECD 경기선행지수  |

> 이전 Stage 데이터: Stage 1에서 $i_{\text{BOK}} = 2.50\%$, $\text{CLI} = 101.65$가 수집되었으며, IS-LM 균형 판별의 입력으로 사용된다.

IS-LM 균형 방정식 자체는 런타임에서 직접 계산되지 않으며, 이론적 프레임워크로서 거시 신뢰도 조정(Factor 1 경기순환, Factor 2 수익률곡선)의 방향성 판단 근거로 참조된다.

\newpage

### 2.5.2 테일러 준칙 (Taylor Rule)
테일러 준칙은 Taylor(1993)가 제안한 통화정책 준칙으로, 중앙은행의 정책금리 설정을 인플레이션 갭과 산출량 갭의 선형함수로 정형화한다. 한국은행이 공식적으로 테일러 준칙을 따르지는 않으나, 사후적(ex post) 분석에서 금통위 결정은 테일러 준칙과 높은 정합성을 보인다. 핵심 파라미터 중 자연이자율 $r^*$은 Laubach-Williams(2003) 추정의 한국 적용 하한인 0.5%를 사용하며, 이는 `macro_composite.json`의 `taylor_r_star=0.5`과 동기화된다. 1.0%가 아닌 0.5%를 채택하는 이유는 한국의 잠재성장률 하락 추세(2020년대 2% 미만)와 인구구조 변화를 반영한 것이다.

테일러 갭(Taylor gap)은 실제 정책금리와 테일러 준칙이 시사하는 금리의 차이($i_{\text{actual}} - i_{\text{Taylor}}$)로, 갭의 부호가 통화정책 스탠스를 나타낸다. 양(+)의 갭은 과도한 긴축(hawkish)으로 성장주를 억압하고 금융주에 유리하며, 음(-)의 갭은 과도한 완화(dovish)로 성장주 부양과 자산 버블 위험을 동시에 내포한다. 현재 시스템의 테일러 갭은 $-0.65\%$p로 완화적 스탠스를 시사한다.

산출량 갭 추정에는 OECD CLI(경기선행지수 순환변동치)를 프록시로 사용한다. CLI는 100을 장기 추세로 정규화하므로, $(CLI - 100) \times 0.5$로 산출량 갭을 근사한다. BOK의 공식 산출량 갭 추정치는 연 2회(통화신용정책보고서)만 공개되므로, CLI 기반 실시간 프록시가 실용적이다.
$$i^* = r^* + \pi + a_\pi(\pi - \pi^*) + a_y(\tilde{y} - \tilde{y}^*)$$

$$\text{Taylor\_gap} = i_{\text{actual}} - i^*$$

$$\tilde{y} = (CLI - 100) \times \text{CLI\_TO\_GAP\_SCALE}, \quad \text{CLI\_TO\_GAP\_SCALE} = 0.5 \;\; (\#139)$$

| 기호 | 의미  |
|:----:|------|
| $r^*$ | 자연이자율(균형 실질이자율)  |
| $\pi$ | 현재 CPI 인플레이션율  |
| $\pi^*$ | 인플레이션 목표  |
| $a_\pi$ | 인플레 반응 계수  |
| $a_y$ | 산출량 갭 반응 계수  |
| $\pi_{\text{CPI}}$ | CPI 전년동월비  |
| $\text{Taylor\_gap}$ | 테일러 갭  |

> 이전 Stage 데이터: Stage 1에서 $\pi_{\text{CPI}} = 2.16\%$, $\text{Taylor\_gap} = -0.65\%$p가 수집되었다. 현재 BOK 기준금리(2.50%)가 테일러 시사금리(3.15%)보다 낮아 완화적 스탠스이다.

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
|:----:|------|
| $\kappa$ | 자본이동성  |
| $r^*$ | 해외이자율(Fed Funds Rate)  |
| $E[\Delta e]$ | 기대환율변동률  |
| $i_{\text{Fed}}$ | 미국 연방기금금리  |
| $e_{\text{USD/KRW}}$ | 원/달러 환율  |

> 이전 Stage 데이터: Stage 1에서 $i_{\text{Fed}} = 3.64\%$, $e_{\text{USD/KRW}} = 1{,}514$원이 수집되었다. 한미 금리차 $-1.14\%$p는 자본유출 압력을 시사한다.

---


### 2.5.4 AD-AS 프레임워크 (Aggregate Demand -- Aggregate Supply Framework)
AD-AS 모형은 IS-LM이 고정한 물가수준 $P$를 내생화하여 물가와 산출량의 동시 결정을 분석한다. 총수요(AD) 곡선은 IS-LM 균형에서 $P$를 변화시킬 때 $Y^*$의 궤적이며, 우하향한다. 우하향의 세 가지 메커니즘은 피구 효과(실질잔고 효과), 케인즈 효과(이자율 효과), 먼델-플레밍 효과(환율 효과)이며, 한국에서는 수출 비중이 높아 환율 효과가 가장 강력하다.

총공급(AS) 곡선은 학파에 따라 형태가 근본적으로 다르다. 고전학파의 LRAS는 수직($Y = Y_n$)으로 물가 변화가 실질변수에 무영향이며, 케인즈학파의 SRAS는 가격경직성으로 인해 우상향하여 수요 변화가 산출량에 영향을 미친다. 뉴케인지언 필립스 곡선(NKPC, 2.5.6절)은 이를 미시적 기초에서 도출한 현대적 AS 곡선이다.

AD-AS 프레임워크의 핵심 활용은 4가지 충격 시나리오 분석이다. 양(+)의 수요충격은 $P\uparrow, Y\uparrow$로 추세추종 패턴 신뢰도를 높이고, 음(-)의 공급충격(스태그플레이션)은 $P\uparrow, Y\downarrow$로 모든 패턴 신뢰도를 저하시킨다. 한국의 경우 2022년 상반기 러시아-우크라이나발 유가 급등이 음의 공급충격, 2023년 하반기 반도체 업턴이 양의 공급충격(골디락스 근사)에 해당한다.
$$Y_{AD}(P) = \frac{h \cdot A + b \cdot (M/P)}{D}, \quad \frac{dY_{AD}}{dP} = -\frac{bM}{D \cdot P^2} < 0$$

$$\text{SRAS}: \; P = P^e + \frac{1}{\alpha}(Y - Y_n)$$

$$\text{LRAS}: \; Y = Y_n \;\; (\text{수직, 장기 화폐중립성})$$

| 기호 | 의미  |
|:----:|------|
| $P^e$ | 기대물가수준  |
| $\alpha$ | 가격경직성 파라미터  |
| $Y_n$ | 자연산출량(잠재GDP)  |
| $D$ | IS-LM 분모 (hs + bk)  |

#### 4가지 충격 시나리오

| 시나리오 | 원인 | P | Y | 패턴 conf 조정 | KRX 사례 |
|----------|------|:---:|:---:|:--------------:|----------|
| 수요(+) | M↑, 수출 호조 | ↑ | ↑ | 추세추종 +0.08 | 2020 Q3 유동성 완화 |
| 수요(-) | 금융 긴축, 소비 위축 | ↓ | ↓ | 반전 +0.10 | 2020 Q1 COVID |
| 공급(-) | 유가 급등, 공급망 교란 | ↑ | ↓ | 전체 -0.12 | 2022 H1 스태그플레이션 |
| 공급(+) | 기술혁신, 유가 하락 | ↓ | ↑ | 전체 +0.05 | 2023 H2 반도체 슈퍼사이클 |

AD-AS 4-충격 분류기는 V38에서 `compute_macro_composite.py`에 구현되었다. CPI 전년동월비를 BOK 물가목표(2.0%)와, IPI 수준을 기준연도(100)와 각각 비교하여 4-충격을 판별한다. 결과는 `macro_composite.json`의 `adAsShock` 필드에 기록되며, `appWorker.js`에서 로깅 수준으로 소비된다. 신뢰도 조정 반영은 후속 세션에서 백테스트 검증 후 활성화 예정이다.

---


### 2.5.5 Stovall 섹터 회전 모형 (Stovall Sector Rotation Model)

Stovall(1996)은 S&P 500 데이터에 기반한 실증 연구로, AD-AS의 경기순환 이론을 섹터 투자 전략으로 변환한 최초의 체계적 프레임워크이다. 이론적 모형이 아닌 경험적 규칙성에 기반하므로, KRX 적용 시 0.5 감쇠 계수를 부여한다.

Stovall(1996)의 "Standard & Poor's Guide to Sector Investing"은 경기순환 4국면(Early Expansion, Late Expansion, Early Contraction, Late Contraction)별로 초과수익이 기대되는 섹터를 체계화한 최초의 실증 연구이다. 초기 확장기에는 금융, IT, 경기소비재가, 후기 확장기에는 에너지와 소재가, 초기 수축기에는 헬스케어, 유틸리티, 필수소비재가, 후기 수축기에는 산업재와 경기소비재가 각각 선호된다.

한국 시장 적용에는 고유한 구조적 특성이 있다. KRX는 반도체/자동차 수출 편중(KOSPI 시총의 약 30%)으로 글로벌 수요 사이클에 민감하게 동조하며, 재벌(chaebol) 구조로 섹터 간 자금 이동이 미국과 구별되는 패턴을 보인다. KOSDAQ에서는 개인투자자 비중이 높아 전통적 섹터 회전의 적용 범위를 조정할 필요가 있다. 따라서 CheeseStock에서는 Stovall 모형을 직접 적용하되, 0.5 감쇄(dampening) 계수를 적용하여 과신을 방지한다.

경기국면 판별은 OECD CLI(경기선행지수)와 PMI를 결합하여 수행한다. CLI > 100이고 상승 추세이면 Expansion, CLI > 100이고 하락 추세이면 Peak, CLI < 100이고 하락 추세이면 Contraction, CLI < 100이고 상승 추세이면 Trough로 분류한다. 현재 CLI = 101.65이고 상승 추세(delta = +0.20)이므로 Expansion 국면이며, 11개월째 지속 중이다.
$$\text{conf\_adj}_{sector} = 1 + 0.5 \times (\text{STOVALL\_MULT}_{sector,phase} - 1.0)$$

$$\text{sell\_mult} = 2.0 - \text{buy\_mult} \quad (\text{매도 패턴 대칭 역전})$$

$$\text{Phase} = f(CLI, \Delta CLI): \; \begin{cases} \text{Expansion} & CLI > 100, \Delta CLI > 0 \\ \text{Peak} & CLI > 100, \Delta CLI \leq 0 \\ \text{Contraction} & CLI < 100, \Delta CLI < 0 \\ \text{Trough} & CLI < 100, \Delta CLI \geq 0 \end{cases}$$

| 기호 | 의미  |
|:----:|------|
| $\text{STOVALL\_MULT}$ | 국면-섹터 승수  |
| $0.5$ | 감쇄 계수 (KRX 미검증 보정)  |
| $\text{CLI}$ | OECD 경기선행지수  |
| $\text{PMI}$ | 제조업 구매관리자지수  |

> 이전 Stage 데이터: Stage 1에서 $\text{CLI} = 101.65$, $\text{cycle\_phase} = \text{expansion}$(11개월)이 수집되었다.

---


### 2.5.6 뉴케인지언 필립스 곡선 (New Keynesian Phillips Curve)

AD-AS 모형이 물가수준을 내생화하였다면, 뉴케인지언 필립스 곡선은 그 공급 측면의 미시적 기초를 제공한다. 필립스 곡선의 지적 계보는 Phillips(1958)의 임금-실업 역관계에서 시작하여, Friedman(1968)과 Phelps(1967)의 기대 부가 필립스 곡선(expectations-augmented Phillips curve)을 거쳐, Lucas(1972)의 합리적 기대 혁명과 Calvo(1983)의 시차적 가격 설정(staggered pricing)으로 발전했다. 현대 거시경제학의 표준은 Gali & Gertler(1999)의 혼합형 NKPC(Hybrid New Keynesian Phillips Curve)이며, 이는 전방 기대($E_t[\pi_{t+1}]$)와 후방 관성($\pi_{t-1}$)을 모두 포함한다.

NKPC의 핵심 파라미터인 Calvo 가격경직도 $\theta$는 매 기간 가격을 조정하지 못하는 기업 비율을 나타낸다. 한국의 $\theta \approx 0.75$는 평균 4분기(1년)에 한 번 가격을 조정함을 의미하며, 미국($\theta \approx 0.66$, 평균 3분기)보다 가격경직성이 강하다. 이는 통화정책 변화가 한국에서 물가보다 실물(산출량, 고용)에 더 크게 전달됨을 시사하며, 결과적으로 BOK 금리 변경이 주가에 미치는 영향이 구조적으로 크다.

$\theta$와 $\kappa$의 추정치는 한국은행 경제연구원의 DSGE 모형 보고서에서 제시된 한국형 뉴케인지언 DSGE 추정 결과에 의존한다.[^calvo-korea] 구체적으로, 한국은행 DSGE 라인(BOK DSGE, 2012년 이래 다수 개정판)은 한국 거시 데이터에 대한 베이지안 추정에서 $\theta \in [0.70, 0.78]$ 범위, 상공회의소 기업 가격조정 설문 및 미시 CPI 품목별 분포 연구에서는 평균 가격 지속 기간 11-15개월(즉, $\theta \approx 0.73-0.80$)을 보고한다. 문서에서 채택한 $\theta = 0.75$는 이 두 계열 추정의 중앙값이며, 할인인자 $\beta = 0.99$는 분기별 실질금리 약 4%에 해당하는 표준 관례값이다. 미국 비교치 $\theta \approx 0.66$은 Smets and Wouters (2007, *American Economic Review*)의 US DSGE 추정에서 도출된다.

[^calvo-korea]: 한국 $\theta$ 추정의 1차 출처는 한국은행 경제연구원 DSGE 보고서(2012/2018 개정)와 Bils and Klenow (2004, *Journal of Political Economy*)의 방법론을 한국 CPI 미시자료에 적용한 국내 후속 연구이다. 기업 가격조정 설문 기반 추정과 CPI 품목 평균 지속기간 추정 간 약간의 괴리가 있으나 범위는 0.70-0.78로 수렴한다. CheeseStock는 중앙값 0.75를 채택한다.

주식시장 관점에서 NKPC의 기울기 $\kappa$가 작을수록(가격이 경직적일수록) 수요 충격의 산출량 효과가 크고 물가 효과가 작다. 한국의 $\kappa \approx 0.05$는 $\theta = 0.75$, $\beta = 0.99$, $\sigma + \phi \approx 2$(표준 RBC 캘리브레이션)을 $\kappa = (1-\theta)(1-\beta\theta)/\theta \cdot (\sigma + \phi)$에 대입하여 도출된 값이며, 수요 확장이 인플레이션보다 실질 성장으로 이어질 가능성이 높음을 의미한다. 이는 확장적 통화정책이 주식시장에 상대적으로 우호적인 환경을 제공하는 이론적 근거가 된다.
$$\pi_t = \gamma_f \cdot \beta \cdot E_t[\pi_{t+1}] + \gamma_b \cdot \pi_{t-1} + \kappa \cdot \tilde{y}_t$$

$$\kappa = \frac{(1-\theta)(1-\beta\theta)}{\theta} \cdot (\sigma + \phi)$$

$$\text{Calvo}: \; \theta = 0.75 \;\; (\text{한국}), \quad \beta = 0.99, \quad \kappa \approx 0.05$$

| 기호 | 의미  |
|:----:|------|
| $\theta$ | Calvo 가격경직도  |
| $\beta$ | 할인인자  |
| $\kappa$ | NKPC 기울기  |
| $\sigma$ | 기간간 대체탄력성의 역수  |
| $\varphi$ | 노동공급 탄력성의 역수  |
| $\pi_{\text{CPI}}$ | CPI 전년동월비  |

> 이전 Stage 데이터: Stage 1에서 $\pi_{\text{CPI}} = 2.16\%$이 수집되었다. BOK 인플레이션 목표(2.0%)에 근접하여 물가 안정 국면이다.

NKPC 기울기 추정과 재정승수 산출은 이론적 기초로서 참조되며, 런타임 코드에서 직접 계산되지 않는다. 거시 신뢰도 조정은 이들 이론의 정성적 함의(수요 충격의 산출량 효과 방향, 구축효과 크기)를 활용한다.

---


### 2.5.7 MCS 복합경기점수 (Macro Composite Score v2)
MCS(Macro Composite Score)는 다수의 거시경제 지표를 단일 점수로 종합하여 거시환경의 강세/약세를 판별하는 복합지수이다. 초기 MCS v1은 PMI, CSI, 수출, 수익률곡선, EPU 역수, 테일러 갭의 6요소 가중합이었으나, 현재 시스템의 권위적(authoritative) 버전은 8요소 MCS v2이다. v2는 CLI, ESI, IPI, 소비자신뢰, PMI, 수출, 실업률 역수, 금리스프레드를 포함하며, v1의 EPU(경제정책불확실성)는 VIX 프록시와의 중복으로 제거되었다.

MCS v2는 0--100 스케일로 거시 복합 데이터에 저장된다. 현재값 65.7은 "약한 강세(mild bullish)" 영역에 해당한다. MCS > 70이면 매수 패턴 +5%, MCS < 30이면 매도 패턴 +5%로 조정하며, 30--70 구간은 중립이다. 0--1 vs 0--100 스케일 가드가 적용되어 원시 MCS(0--1)와 MCS v2(0--100)가 자동 구분된다.

8개 구성요소의 가중치는 지표의 선행성과 포괄성을 반영한다. CLI에 최대 가중치(0.20)를 부여하는 이유는 CLI가 고용, 생산, 소비, 금융 등 10개 하위지표를 이미 종합한 가장 포괄적인 선행지표이기 때문이다. ESI와 IPI(각 0.15)는 심리와 실물을 각각 대리한다. 나머지 5개 지표(각 0.10)는 보조적 확인(confirmation) 역할을 한다.
$$\text{MCS}_{v2} = \sum_{j=1}^{8} w_j \cdot z_j \times 100, \quad \sum_{j=1}^{8} w_j = 1$$

$$w_{\text{CLI}}=0.20, \;\; w_{\text{ESI}}=0.15, \;\; w_{\text{IPI}}=0.15, \;\; w_{\text{소비자}}=0.10$$

$$w_{\text{PMI}}=0.10, \;\; w_{\text{수출}}=0.10, \;\; w_{\text{실업}^{-1}}=0.10, \;\; w_{\text{금리차}}=0.10$$

$$z_j = \text{clip}\!\left(\frac{x_j - x_{j,\min}}{x_{j,\max} - x_{j,\min}},\; 0,\; 1\right) \quad (\text{각 지표의 [0,1] 정규화})$$

| 기호 | 의미  |
|:----:|------|
| $w_j$ | 제j 구성요소 가중치  |
| $z_j$ | 정규화된 구성요소 값  |
| $\text{CLI}$ | OECD 경기선행지수  |
| $\text{ESI}$ | 경제심리지수  |
| $\text{IPI}$ | 산업생산지수  |
| $\text{MCS}_{v2}$ | MCS v2 복합점수  |

> 이전 Stage 데이터: Stage 1에서 $\text{MCS}_{v2} = 65.7$이 수집되었다. 8개 구성요소 중 CLI(0.904), 수출(0.839), 실업률 역수(0.775)가 강세, PMI(0.300)가 약세이다.

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
|:----:|------|
| $k_G$ | 정부지출 승수  |
| $k_T$ | 조세 승수  |
| $s$ | 한계 누출률 (1-c1(1-t)+m)  |
| $k_{BB}$ | 균형재정 승수  |
| $\text{ZLB}$ | 제로금리 하한  |

> 이전 Stage 데이터: 재정승수 산출에 필요한 한계소비성향($c_1$), 한계세율($t$), 한계수입성향($m$) 파라미터는 BOK/관세청 추정치를 상수로 적용한다.

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
|:----:|------|
| $e$ | 명목환율 (원/달러)  |
| $\bar{e}$ | 장기 균형환율  |
| $F / S$ | 선물환율 / 현물환율  |
| $\theta$ | 환율 수렴 속도  |

> 참고: 이 시트는 이론 전용(theory-only)이다. 런타임에서 환율 모형을 직접 구현하지 않으며, USD/KRW 수출채널이 간접 프록시로 작동한다. 환율은 `macro_latest.json`의 `usdkrw` 필드로 수집되어 먼델-플레밍(2.5.3절)의 입력으로 사용된다.

---


### 2.5.10 금리 기간구조와 수익률 곡선 (Term Structure and Yield Curve)
금리 기간구조(term structure of interest rates)는 만기에 따른 채권수익률의 함수이며, 수익률 곡선(yield curve)으로 시각화된다. 수익률 곡선의 형태는 경기 전망의 가장 강력한 선행지표 중 하나로, Estrella & Mishkin(1998)에 따르면 미국에서 수익률 곡선 역전은 1960-2020년 8회 중 8회 경기침체를 사전 예측했다. 한국 국고채 10년-3년 스프레드 기준으로는 5회 중 4회 경기침체를 선행했으며, 선행 시차는 미국(12-18개월)보다 짧은 6-12개월이다.

기대가설(Expectations Hypothesis)은 장기금리가 미래 단기금리의 기대값의 평균이라는 이론이다. 이에 따르면 수익률 곡선 역전은 시장이 미래 금리 인하(경기 악화)를 예상함을 의미한다. Hicks(1939)의 유동성 프리미엄 이론은 투자자가 장기 채권에 대해 추가 보상(유동성 프리미엄)을 요구하므로, 정상적 수익률 곡선은 우상향한다고 설명한다. 역전은 이 프리미엄마저 상쇄할 만큼 강한 금리 하락 기대가 존재함을 시사한다.

Nelson-Siegel-Svensson(NSS) 모형은 수익률 곡선을 Level($\beta_1$, 장기 수준), Slope($\beta_2$, 기울기), Curvature($\beta_3$, 곡률)의 3요인으로 분해한다. Level은 장기 기대 인플레이션 + 실질 균형금리를, Slope는 통화정책 스탠스를, Curvature는 중기 경기 기대와 정책 불확실성을 반영한다. 현재 한국 국고채 10년-3년 스프레드는 0.30%p(=30bp)로 양(+)이나 평탄화(flattening) 추세에 있어 경기 둔화 가능성을 시사한다.
$$y(\tau) = \beta_1 + \beta_2 \left[\frac{1-e^{-\tau/\lambda}}{\tau/\lambda}\right] + \beta_3 \left[\frac{1-e^{-\tau/\lambda}}{\tau/\lambda} - e^{-\tau/\lambda}\right]$$

$$\text{Spread} = y_{10Y} - y_{3Y}, \quad \text{역전}: \text{Spread} < 0 \implies \text{경기침체 선행 6-12개월}$$

$$\text{기대가설}: \; (1+i_{2Y})^2 = (1+i_{1Y})(1+E[i_{1Y,t+1}])$$

| 기호 | 의미  |
|:----:|------|
| $\beta_1$ | Level (장기 수준)  |
| $\beta_2$ | Slope (기울기)  |
| $\beta_3$ | Curvature (곡률)  |
| $\lambda$ | 감쇠 매개변수  |
| $y_{10Y} - y_{3Y}$ | 국고채 10Y-3Y 스프레드  |
| $\text{YC\_phase}$ | 수익률곡선 국면  |

> 이전 Stage 데이터: Stage 1에서 $\text{term\_spread} = 0.35\%$p, $\text{yieldCurvePhase} = \text{flattening}$이 수집되었다. 역전은 아니나 평탄화 추세이다.

---


### 2.5.11 HMM 레짐의 거시경제적 해석 (Macroeconomic Interpretation of HMM Regimes)
은닉 마르코프 모형(Hidden Markov Model, Hamilton 1989)은 관측 불가능한 "레짐"(regime)이 관측 가능한 수익률의 통계적 특성을 결정한다고 가정한다. 경제학적으로 레짐은 거시경제 상태(확장/수축, 저변동/고변동)에 대응하며, 전이행렬(transition matrix)이 레짐 간 전환 확률을 기술한다. Hamilton(1989)은 미국 전후 데이터에서 2개 변동성 레짐(강세: 월 수익률 +0.9%, 변동성 4.5% / 약세: -0.3%, 7.2%)을 식별했으며, 평균 레짐 지속기간은 8-10개월이었다. CheeseStock는 Hamilton의 원전 설정을 따라 2-state(Bull, Bear) 가우시안 HMM을 채택한다.

CheeseStock의 HMM 레짐 분류는 KOSPI 시가총액 가중 일별 수익률에 Baum-Welch EM 알고리즘(50회 반복)을 적용하여 Bull/Bear 2-state 레짐을 추정한다. 추정 결과는 레짐 라벨 필드에 저장되며, 레짐별 신뢰도 승수를 통해 패턴 신뢰도에 적용된다. 강세(bull) 레짐에서 매수 패턴은 $\times 1.06$, 매도 패턴은 $\times 0.92$로 조정되고, 약세(bear) 레짐에서는 역방향($\times 0.90$ / $\times 1.06$)이다.

거시경제적 해석에서 HMM 레짐은 Doc 29 §6.1의 거시 레짐 분류($2 \times 2$: Expansion/Contraction × Low/High Volatility)와 연동된다. Goldilocks(확장+저변동)에서 추세추종 패턴이, Quiet Bear(수축+저변동)에서 평균회귀 패턴이, Crisis(수축+고변동)에서 전반적 신호 축소가 적절하다. 데이터 품질 가드(`flowDataCount > 0`)가 없으면 투자자 데이터가 비어있을 때 모든 종목에 "bear"가 일괄 적용되는 위험이 있어, 품질 게이트가 필수적이다.
$$P(R_t \mid S_t = s) = \mathcal{N}(\mu_s, \sigma_s^2), \quad S_t \in \{\text{bull, bear}\}$$

$$\text{전이행렬}: \; \mathbf{P} = \begin{pmatrix} p_{BB} & p_{BR} \\ p_{RB} & p_{RR} \end{pmatrix} \approx \begin{pmatrix} 0.98 & 0.02 \\ 0.05 & 0.95 \end{pmatrix}$$

여기서 $B$=Bull, $R$=Bear이며 각 행의 합은 1이다. 상기 초기값은 Baum-Welch EM 시작점이며, 실제 추정치는 KOSPI 데이터에 수렴한다. Bull의 기대 지속기간 $1/(1-p_{BB})=1/0.02=50$ 거래일, Bear는 $1/0.05=20$ 거래일로 Hamilton(1989)의 8--10개월 스케일과 정합한다. Baum-Welch E-step($\gamma_t$)과 Viterbi 디코딩($\delta_t$)의 통계적 기초는 2.3.7절을 참조한다. 레짐별 신뢰도 승수는 역사적 이유로 횡보(sideways) 키를 보존하지만 2-state HMM에서는 활성화되지 않는 항등 승수(identity)이다.

| 기호 | 의미  |
|:----:|------|
| $S_t$ | 시점 t의 은닉 레짐  |
| $\mu_s, \sigma_s$ | 레짐 s의 평균/표준편차  |
| $a_{ij}$ | 레짐 i → j 전이확률  |
| $\text{hmmRegimeLabel}$ | HMM 레짐 라벨  |

> 이전 Stage 데이터: Stage 1에서 `hmmRegimeLabel`은 종목별로 `flow_signals.json`에 저장된다. 시장 전체 레짐은 `_flowSignals.hmmRegimeLabel`로 접근한다.

---


### 2.5.12 수요-공급-탄력성 (Demand-Supply-Elasticity)
Marshall (1890)의 부분균형 분석은 증권시장의 호가창(order book)에 직접 대응된다. 매수 호가 누적이 수요곡선 $D(p)$를, 매도 호가 누적이 공급곡선 $S(p)$를 형성하며, 시장 청산가격 $p^*$는 양자의 교차점에서 결정된다. KRX는 시가/종가 결정에 Walras (1874) 단일가 매매(call auction)를, 장중에는 Smith (1962) 연속 이중경매(continuous double auction)를 사용하는 이원 체제를 운영한다. 단일가 매매는 30분(시가) 또는 10분(종가)의 호가 축적을 통해 정보 집적 효율이 높고 종가 조작(window dressing) 내성이 강하다 (Madhavan 1992).

거래량-가격 탄력성(Volume-Price Elasticity, VPE)은 가격 1% 변동에 대한 거래량의 반응 민감도를 측정한다. KOSPI 대형주의 VPE는 2--5(중탄력, 기관 계획 매매), KOSDAQ 소형주는 8--20+(초고탄력, 개인 감정 반응)으로 시장 세그먼트 간 극단적 차이를 보인다. VPE와 Amihud (2002) ILLIQ는 수학적 역관계에 있으며, 이 연결은 수요-공급 탄력성이라는 미시경제학적 개념이 시장미시구조의 유동성 측정으로 변환되는 이론적 다리(theoretical bridge)를 구성한다. ILLIQ가 VPE의 역함수이므로, CheeseStock에서는 Amihud ILLIQ 산출(`calcAmihudILLIQ`)로 탄력성 정보를 포착하며 VPE를 별도 구현하지 않는다.

스프레드(bid-ask spread)는 Stoll (1978)의 재고위험 보상($s_{\text{inventory}}$), Glosten-Milgrom (1985)의 역선택 비용($s_{\text{adverse}}$), Roll (1984)의 주문처리 비용($s_{\text{processing}}$)으로 3요소 분해된다. KRX에는 지정 시장조성자가 사실상 부재하여, KOSDAQ 소형주에서 $s_{\text{adverse}}$가 전체 스프레드의 60--80%를 차지한다. 이는 가격제한폭(±30%) 하에서 사중손실(deadweight loss)을 유발하며, Du, Liu & Rhee (2009)가 입증한 자석 효과(magnet effect)가 이를 악화시킨다.
$$p^* = \underset{p}{\arg\max}\;\min\bigl(D(p),\;S(p)\bigr)$$

$$\varepsilon_{VP} = \frac{\Delta V / V}{|\Delta p| / p}, \qquad \text{ILLIQ} \approx \frac{k}{P \cdot |\varepsilon_{VP}|}$$

$$s = s_{\text{inventory}} + s_{\text{adverse}} + s_{\text{order\_processing}}$$

| 기호 | 의미  |
|:----:|------|
| $p^*$ | 시장 청산가격 (Walrasian equilibrium price)  |
| $D(p), S(p)$ | 누적 매수/매도 호가 곡선  |
| $\varepsilon_{VP}$ | 거래량-가격 탄력성 (VPE)  |
| $\text{OHLCV}$ | 일봉 시가-고가-저가-종가-거래량  |
| $\text{ADV}$ | 평균 일간 거래대금 (Average Daily Value)  |
| $s_{\text{adverse}}$ | 역선택 비용 (Glosten-Milgrom 1985)  |
| $k$ | ILLIQ-VPE 연결 정규화 상수  |

(Glosten-Milgrom 모형의 상세한 호가 스프레드 분해는 시장 미시구조 절을 참조한다.)

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\text{OHLCV}}$로부터 일간 수익률 $|r_t|$와 거래대금 $\text{DVOL}_t$를 산출하여 ILLIQ을 계산한다. $\textcolor{stageOneMarker}{\text{ADV}}$는 60일 평균 거래대금으로, 유동성 세그먼트 분류의 기준이 된다.


### 2.5.13 HHI 산업 집중도와 시장구조 (HHI & Market Structure)
Herfindahl (1950)이 도입하고 Hirschman (1964)이 독립적으로 제안한 HHI(Herfindahl-Hirschman Index)는 산업 내 기업 시장점유율의 제곱합으로 정의되며, 산업 집중도의 표준 측정치이다. HHI는 등가기업수(Numbers Equivalent) $NE = 1/\text{HHI}$로 직관적 해석이 가능하다. 미국 DOJ 기준에서 HHI < 0.15는 비집중, 0.15--0.25는 중간 집중, ≥0.25는 고집중으로 분류한다. KRX 주요 산업의 HHI 추정치는 반도체(메모리) ≈0.45(삼성/하이닉스 복점), 이동통신 ≈0.33(3사 과점), 자동차 ≈0.40(현대차/기아 복점), 바이오/제약 ≈0.08(다수 경쟁)으로 산업별 편차가 크다.

Lerner (1934)의 독점력 지수 $L = (P-MC)/P$와 HHI의 연결은 Cowling-Waterson (1976)에 의해 $L = \text{HHI}/|\varepsilon_d|$로 정식화되었다. 이 관계가 "HHI $\to$ 이익안정성 $\to$ 패턴 신뢰도"의 이론적 기초를 구성한다. 가격 설정력이 강한 산업(높은 HHI)의 기업은 원가 변동을 가격에 전가할 수 있어 매출 변동성이 낮고, 기술적 패턴의 mean-reversion 신뢰도가 높다. 반대로 경쟁적 산업(낮은 HHI)에서는 추세추종(momentum) 패턴이 상대적으로 유효하다.

CheeseStock에서 HHI는 학술 표준인 매출액 기준이 아닌, 데이터 가용성과 실시간성을 위해 시가총액 기준으로 산출된다. 이는 바이오 산업에서 시가총액이 매출 대비 과대평가되어 HHI가 +0.05--0.10 과대추정되는 편향을 발생시킨다. HHI 부스트에 이익변동성 감쇠를 적용하기 위한 EPS 안정성 매개변수(`eps_stability`)는 V39에서 파이프라인이 복원되어 실데이터로 작동한다. `data.js`가 DART 연간 순이익 시계열(`ni_history`)을 `_financialCache`에 적재하고, `appWorker.js`에서 NI 성장률의 표준편차를 기반으로 감쇠 계수를 산출한다.
$$\text{HHI} = \sum_{i=1}^{N} s_i^2, \qquad NE = \frac{1}{\text{HHI}}$$

$$L = \frac{\text{HHI}}{|\varepsilon_d|} \qquad \text{(Cowling-Waterson 1976)}$$

$$\text{conf\_adj} = \text{conf\_base} \times \bigl(1 + 0.10 \times \text{HHI} \times \text{eps\_stability}\bigr)$$

| 기호 | 의미  |
|:----:|------|
| $s_i$ | 기업 i의 시장점유율  |
| $NE$ | 등가기업수 (Numbers Equivalent)  |
| $L$ | Lerner 독점력 지수  |
| $\varepsilon_d$ | 시장 수요의 가격탄력성  |
| $\text{marketCap}$ | 시가총액 (ALL\_STOCKS)  |
| $\text{eps\_stability}$ | 이익변동성 감쇠 계수 = 1/(1+σ_(NI\_growth)/100)  |
| $0.10$ | HHI\_MEAN\_REV\_COEFF (\#119)  |

(eps_stability는 대리인 이론과 공유하는 매개변수이다. HHI에서는 가격설정력을 통한 이익 안정성 경로로, 대리인 이론에서는 이익의 질 경로로 각각 활용된다.)

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\text{marketCap}}$은 `ALL_STOCKS` 배열의 `marketCap` 필드에서 업종별로 추출되어 $s_i = \text{marketCap}_i / \sum \text{marketCap}$로 변환된다.


### 2.5.14 정보비대칭과 탐색비용 (Information Asymmetry & Search Costs)
전통 미시경제학의 완전 정보(perfect information) 가정이 성립하면 가격은 즉시 내재가치를 반영하고 기술적 분석의 존재 이유가 사라진다. Grossman & Stiglitz (1980)는 이 역설을 정식화하였다: 가격이 모든 정보를 완벽히 반영한다면 정보 수집 비용을 지불할 유인이 없고, 아무도 정보를 수집하지 않으므로 가격은 정보를 반영할 수 없다. 균형에서 정보 투자자의 기대초과수익은 정보 수집 비용과 정확히 일치하며, 이 잔존 비효율이 기술적 패턴의 미시적 기초(microfoundation)를 구성한다.

Stigler (1961)는 경제학에서 최초로 정보를 경제재(economic good)로 정식화하고, 투자자의 종목 탐색 과정을 최적 탐색 문제로 모형화하였다. 탐색의 한계편익(더 나은 투자 기회 발견 확률)이 한계비용(시간, 인지적 노력)과 일치하는 점에서 탐색이 종료되므로, 투자자는 불완전한 정보 상태에서 의사결정한다. 한국 시장에서 HTS/MTS 보급으로 물리적 탐색 비용은 극소화되었으나, Peng & Xiong (2006)의 주의 예산 제약($\sum a_i \leq A_{\text{total}}$)이 새로운 바인딩 제약(binding constraint)으로 부상하였다. KOSPI 200 구성종목은 평균 7--12명 애널리스트 커버리지($a_i$ 높음)를 보이는 반면, KOSDAQ 소형주(시총 500억 미만)는 0--1명($a_i \approx 0$, corner solution)으로 정보 반영 지연이 3--5배 지속된다.

Easley, Kiefer & O'Hara (1996)의 PIN(Probability of Informed Trading)은 정보 비대칭의 직접 측정치이다. KRX에서 KOSPI 대형 PIN ≈ 0.10--0.15인 반면 KOSDAQ 소형 PIN ≈ 0.30--0.50으로, 잡음 거래자 비율이 높을수록 정보 거래자의 위장이 용이해져 PIN이 역설적으로 상승한다.
$$\text{PIN} = \frac{\alpha \mu}{\alpha \mu + \varepsilon_b + \varepsilon_s}$$

$$E[R_{\text{informed}}] - E[R_{\text{uninformed}}] = \frac{c_{\text{info}}}{\rho} \qquad \text{(Grossman-Stiglitz 균형)}$$

$$\sum_{i=1}^{N} a_i \leq A_{\text{total}} \qquad \text{(Peng-Xiong 주의 예산 제약)}$$

| 기호 | 의미  |
|:----:|------|
| $\alpha$ | 정보 이벤트 발생 확률  |
| $\mu$ | 정보 거래자 도착률  |
| $\varepsilon_b, \varepsilon_s$ | 비정보 매수/매도 도착률  |
| $c_{\text{info}}$ | 정보 수집 비용  |
| $\rho$ | 위험회피 계수 (risk aversion)  |
| $a_i$ | 자산 i에 배분된 주의 용량  |
| $\text{ADV}$ | 평균 일간 거래대금 (주의 프록시)  |
| 외국인 보유비중 | 글로벌 분석가 커버리지 프록시  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\text{ADV}}$는 탐색 비용의 역함수로 기능한다. 유동성이 높으면 정보 접근이 용이하여 탐색 비용이 낮다. $\textcolor{stageOneMarker}{\text{외국인 보유비중}}$은 글로벌 분석가 커버리지의 프록시로, 높을수록 주의 배분($a_i$)이 풍부함을 시사한다.


### 2.5.15 경제학 도출 요약 (Economics Derivation Summary)

본 절은 2.5.1–2.5.14의 14개 시트에서 도출된 경제학 분석 체계를 요약하고, 후속 장(제3장)에서의 신호 구현 경로를 명시한다. 거시경제학 시트(2.5.1–2.5.11)의 핵심 기여는 세 가지이다. 첫째, IS-LM/AD-AS/먼델-플레밍 프레임워크를 통해 정책 충격이 주식시장에 전달되는 이론적 경로를 정형화했다. 둘째, 테일러 준칙, 필립스 곡선, 재정승수 등의 정량적 도구를 한국 파라미터로 교정(calibrate)하여, BOK 이벤트와 추경 발표의 비대칭적 시장 영향을 설명했다. 셋째, Stovall 섹터 회전, MCS v2, HMM 레짐 분류를 결합하여 거시환경 → 섹터 → 패턴 신뢰도의 다층 전달 체계를 구축했다.

미시경제학 시트(2.5.12–2.5.14)는 이 체계에 산업 구조와 정보 마찰을 추가하여, 종목 수준의 유동성·집중도·정보비대칭이 패턴 신뢰도에 미치는 영향을 정량화한다. 수요-공급-탄력성(2.5.12)은 Amihud ILLIQ와 세그먼트별 슬리피지를 통해, HHI(2.5.13)는 산업 집중도 기반 mean-reversion 부스트를 통해, 정보비대칭(2.5.14)은 ADV 등급 승수와 밸류에이션 S/R을 통해 구현된다.

이 체계는 제3장에서 CONF-F1a(Stovall 섹터 회전), CONF-F7(Taylor Rule Gap), CONF-F9(한미 금리차)의 세 가지 거시 신뢰도 조정 인자와 미시 신뢰도 조정 인자로 구현된다. 각 인자는 거시 및 미시 신뢰도 함수 내에서 패턴별 방향(매수/매도)과 종목의 섹터 분류에 따라 차등 적용되며, 최종 신뢰도는 다층 승수의 곱으로 결정된다(compound floor = 25으로 하한 보장; 구현 위치: `js/appWorker.js` L.338-342 inline clamp 블록).

## 2.6 금융학적 기초: 자산가격결정에서 신용위험까지[^fin-1]

금융학은 자산의 공정가치를 결정하는 이론적 체계를 제공한다. CAPM 계보는 기대수익률과 위험 프리미엄을 정의하여 기술적 분석의 기준선을 설정하고, 채권·옵션·신용위험 모형은 교차시장 신호를 생성하여 패턴 신뢰도를 다차원적으로 조정한다. 본 절은 효율적 시장에서 다요인 가격결정, 교차시장 신호까지 자산가격결정의 전체 계보를 **16개 시트 (15 본편 + 2.6.16 통합 요약)**로 추적한다.


### 2.6.1 효율적 시장 가설과 적응적 시장 가설 (EMH & AMH)
효율적 시장 가설(EMH)은 Fama(1970)가 체계화한 자산가격결정의 출발점이다. 약형 효율은 과거 가격에서, 준강형은 공개 정보에서, 강형은 내부 정보까지 포함하여 초과수익이 불가능하다고 주장한다. 수학적으로 EMH는 마르팅게일 조건으로 표현된다. Grossman-Stiglitz(1980)는 완전 효율 시장에서 정보 수집 유인이 소멸하는 역설을 지적하여, 균형에서 잔존 비효율이 필연적임을 보였다.

Lo & MacKinlay(1988)의 양의 자기상관과 Brock, Lakonishok & LeBaron(1992)의 이동평균 전략 수익성은 약형 효율을 부정하였다. Lo(2004)는 적응적 시장 가설(AMH)을 제안하여, 시장 효율성이 참여자의 경쟁과 적응에 따라 시변한다고 보았다. CheeseStock은 Hurst 지수($H$)로 현재 효율성 수준을 진단하며, $H > 0.5$(추세 지속)와 $H < 0.5$(평균 회귀)를 구분하여 패턴 신뢰도 가중에 활용한다. Jegadeesh(1990)의 단기반전과 AMH crowding 경로에 기반하여, 8개 역예측자 패턴의 반대방향 승률을 BH-FDR 보정($q = 0.10$)으로 검증하였다.

$$P_t = \frac{E[P_{t+1} \mid \Phi_t]}{1+r}, \qquad P_{t+1} - E[P_{t+1} \mid \Phi_t] = \varepsilon_{t+1}$$

$$\text{ACF}(k) = \frac{\text{Cov}(r_t, r_{t+k})}{\text{Var}(r_t)}, \qquad \text{EMH} \Rightarrow \text{ACF}(k) = 0 \;\;\forall k \geq 1$$

| 기호 | 의미  |
|:----:|------|
| $\Phi_t$ | 시점 t까지의 정보 집합  |
| $\varepsilon_{t+1}$ | 마르팅게일 차분 (예측불가 충격)  |
| $\text{ACF}(k)$ | k-차 자기상관함수  |
| $H$ | Hurst 지수 (R/S 분석, 2.2.4절 참조)  |

> 이전 Stage 데이터: Stage 1 OHLCV 종가에서 $r_t = \ln(P_t/P_{t-1})$를 산출한다. Hurst 추정에 최소 120봉이 필요하다.


### 2.6.2 현대 포트폴리오 이론 (MPT)
현대 포트폴리오 이론(MPT)은 Markowitz(1952)가 제안한 평균-분산 최적화(mean-variance optimization) 프레임워크이다. 개별 자산의 기대수익률과 위험(분산)뿐 아니라 자산 간 공분산 구조를 고려하여, 주어진 기대수익률 수준에서 포트폴리오 위험을 최소화하는 최적 가중치를 도출한다. 이 최적 포트폴리오들의 집합이 효율적 프론티어(efficient frontier)를 형성하며, 합리적 투자자는 효율적 프론티어 위의 포트폴리오만을 선택한다.

MPT의 핵심 통찰은 분산투자(diversification)가 체계적 위험(systematic risk)은 제거할 수 없지만 비체계적 위험(idiosyncratic risk)을 소멸시킨다는 것이다. KRX 전체 2,700여 종목의 포트폴리오 구성에서 완전 공분산 행렬 추정에 필요한 모수는 $N(N+3)/2 \approx 365$만 개에 달하므로, 실무에서는 Sharpe(1963) 단일지수 모형이나 팩터 모형으로 차원을 축소한다. Sharpe Ratio는 무위험 수익률 초과분 대비 위험을 측정하는 표준 성과 지표로, 효율적 프론티어 위에서 CML과의 접점(tangency portfolio)이 최대 Sharpe Ratio를 달성한다.

MPT는 "어떤 종목을 얼마나 보유할 것인가"를 결정하는 반면, 기술적 분석은 "언제 매수/매도할 것인가"를 결정한다. 양자는 상호 보완적이며, CheeseStock의 backtester는 패턴 기반 진입 시점의 위험-수익 프로파일을 MPT 프레임워크 내에서 평가한다.
$$E[R_p] = \sum_{i=1}^{N} w_i \, E[R_i], \qquad \sigma_p^2 = \sum_{i}\sum_{j} w_i w_j \sigma_{ij}$$

$$\min_{w} \; \sigma_p^2 \quad \text{s.t.} \quad E[R_p] = R^{*}, \;\; \sum w_i = 1$$

$$\text{Sharpe Ratio} = \frac{E[R_p] - R_f}{\sigma_p}$$

$$\text{Sortino Ratio} = \frac{E[R_p] - R_f}{\sigma_{\text{downside}}}$$

| 기호 | 의미  |
|:----:|------|
| $w_i$ | 종목 i의 포트폴리오 가중치  |
| $\sigma_{ij}$ | 종목 i,j 간 공분산  |
| $R^*$ | 목표 기대수익률  |
| $\sigma_{\text{downside}}$ | 하방 편차 (MAR 기준)  |
| $R_f$ | 무위험이자율 (KTB 3Y)  |

> 이전 Stage 데이터: Stage 1에서 `data/macro/bonds_latest.json`의 KTB 3년 금리가 $R_f$ 추정에 사용된다. 개별 종목 수익률은 OHLCV 일봉에서 산출하며, 시장 지수 수익률은 `data/market/kospi_daily.json`에서 제공된다.


### 2.6.3 자본자산가격결정모형 (CAPM)
자본자산 가격결정 모형(CAPM)은 Sharpe(1964), Lintner(1965), Mossin(1966)이 독립적으로 도출한 균형 자산가격결정 모형이다. Markowitz MPT의 균형 함의(equilibrium implication)로서, 모든 투자자가 동질적 기대를 갖고 무위험 이자율로 자유롭게 차입/대출할 수 있을 때, 시장 포트폴리오가 효율적 프론티어 위의 접선 포트폴리오임을 보인다. 증권시장선(SML)은 개별 자산의 기대수익률이 시장 베타($\beta_i$)에 선형적으로 비례함을 나타내며, 절편은 무위험이자율($R_f$), 기울기는 시장 위험 프리미엄($E[R_m] - R_f$)이다.

Jensen's Alpha($\alpha_i$)는 CAPM이 예측하는 기대수익률 대비 실현 초과수익으로, $\alpha_i > 0$이면 위험 조정 후에도 양의 초과수익이 존재함을 의미한다. 이는 기술적 분석 전략의 성과를 시장 위험 노출을 통제한 후 평가하는 표준 도구이다. 자본시장선(CML)은 효율적 포트폴리오 공간에서 무위험자산과 시장 포트폴리오를 잇는 직선으로, Sharpe Ratio의 상한을 정의한다.

Sharpe(1963) 단일지수 모형은 CAPM의 실증적 기반으로, $R_i = \alpha_i + \beta_i R_m + \varepsilon_i$의 시장 모형(market model)에서 베타를 추정한다. KRX 실증 결과 KOSPI 대형주의 $R^2 \approx 0.40\text{-}0.65$이나, KOSDAQ 소형주는 $R^2 \approx 0.05\text{-}0.25$로 단일 시장 팩터의 설명력이 제한적이어서, 다중 팩터 모형(APT/FF)으로의 확장이 필요하다. 이 $R^2$ 분포는 패턴 분석의 부가가치가 고유 요인 지배 영역(KOSDAQ)에서 가장 높을 가능성을 시사한다.
$$E[R_i] = R_f + \beta_i \bigl(E[R_m] - R_f\bigr) \qquad \text{(SML)}$$

$$\beta_i = \frac{\text{Cov}(R_i, R_m)}{\text{Var}(R_m)}$$

$$\alpha_i = R_i - \bigl[R_f + \beta_i(R_m - R_f)\bigr] \qquad \text{(Jensen's Alpha)}$$

$$\text{CML}: \; E[R_p] = R_f + \frac{E[R_m] - R_f}{\sigma_m} \cdot \sigma_p$$

$$R^2_i = \frac{\beta_i^2 \sigma_m^2}{\sigma_i^2} = \frac{\text{체계적 분산}}{\text{총 분산}}$$

| 기호 | 의미  |
|:----:|------|
| $\beta_i$ | 종목 i의 시장 베타 (사전 계산, `compute_capm_beta.py`)  |
| $\alpha_i$ | Jensen의 알파 (위험조정 초과수익)  |
| $E[R_m]$ | 시장 포트폴리오 기대수익률  |
| $\sigma_m$ | 시장 수익률 표준편차  |
| $R^2_i$ | 결정계수 (체계적 위험 비율)  |
| $R_f$ | 무위험이자율 (KTB 10Y)  |

> 이전 Stage 데이터: Stage 1에서 `compute_capm_beta.py`가 산출한 $\beta_i$, $\alpha_i$, $R^2$이 `data/backtest/capm_beta.json`에 저장된다. `bonds_latest.json`의 KTB 10Y 금리가 $R_f$로 사용되며, Scholes-Williams(1977) 보정이 thin trading에 대해 적용된다. 실증 결과(2,628 종목): KOSPI $\bar{\beta}=0.75$, KOSDAQ $\bar{\beta}=0.83$.


### 2.6.4 제로베타 CAPM (Black 1972)
Zero-Beta CAPM은 Black(1972)이 무위험자산의 존재를 가정하지 않고 도출한 균형 모형이다. 표준 CAPM의 가장 비현실적 가정인 "모든 투자자가 동일한 무위험이자율로 무제한 차입/대출 가능"을 제거하고, 대신 시장 포트폴리오와 공분산이 0인 Zero-Beta 포트폴리오($R_z$)를 기준점으로 삼는다. SML의 절편이 $R_f$에서 $E[R_z]$로 상승하고 기울기가 완만해지므로, 고베타 종목의 기대수익률은 표준 CAPM 대비 하락하고 저베타 종목은 상승한다.

Fama & MacBeth(1973)의 횡단면 회귀 실증은 $\hat{\gamma}_0 > R_f$, $\hat{\gamma}_1 < E[R_m] - R_f$를 확인하여 Zero-Beta CAPM과 일치하는 결과를 보고했다. Frazzini & Pedersen(2014)의 BAB(Betting Against Beta) 전략은 이 이론의 현대적 확장으로, 차입 제약이 있는 투자자가 고베타 종목을 과도하게 선호하여 체계적으로 과대평가되는 현상을 이용한다.

한국 시장은 Zero-Beta CAPM의 교과서적 적용 사례이다. 2008년 이후 누적 약 5.5년(전체의 약 30%)에 걸친 공매도 전면 금지 기간이 존재하며, 가장 최근에는 2023.11~2025.03 기간의 전면 금지가 있었다. 공매도 금지는 비관적 정보의 가격 반영을 차단하고(Miller 1977), 표준 CAPM의 무위험 차입 가정을 위배하므로 Zero-Beta CAPM이 더 적절한 균형 모형이 된다.
$$E[R_i] = E[R_z] + \beta_i \bigl(E[R_m] - E[R_z]\bigr)$$

$$\beta_z = \frac{\text{Cov}(R_z, R_m)}{\text{Var}(R_m)} = 0 \qquad \text{(정의)}$$

$$E[R_z] > R_f \quad \Rightarrow \quad \text{SML 절편 상승, 기울기 감소}$$

$$\alpha_{i,\text{ZB}} = R_i - \bigl[E[R_z] + \beta_i(R_m - E[R_z])\bigr]$$

| 기호 | 의미  |
|:----:|------|
| $E[R_z]$ | Zero-Beta 포트폴리오 기대수익률  |
| $\alpha_{i,ZB}$ | Zero-Beta 보정 알파  |
| $\beta_i$ | 시장 베타 (capm_beta.json)  |

> 이전 Stage 데이터: Stage 1의 `capm_beta.json`에서 $\beta_i < 0.1$인 종목(약 50~80개)을 추출하여 $E[R_z]$의 경험적 대리변수로 사용한다. `_SHORT_BAN_PERIODS` 배열(appWorker.js)이 공매도 금지 기간을 정의하며, 해당 기간에는 Zero-Beta CAPM 기반 조정이 활성화된다.


### 2.6.5 다기간 자본자산가격결정모형 (ICAPM)
기간간 자본자산 가격결정 모형(ICAPM)은 Merton(1973)이 연속시간 동적 최적화(continuous-time dynamic optimization)를 통해 도출한 다기간 균형 모형이다. 표준 CAPM이 단일 기간 의사결정을 가정하는 반면, ICAPM은 투자자가 현재의 부(wealth)뿐 아니라 미래의 투자 기회 집합(investment opportunity set) 변화에 대해서도 헤지(hedge)하고자 한다는 점을 포착한다. 이 "헤지 수요(hedging demand)"가 시장 베타 이외의 추가적 위험 프리미엄을 발생시킨다.

ICAPM의 가장 중요한 이론적 기여는 다중 팩터 모형에 경제적 정당성을 부여한 것이다. Fama-French의 SMB/HML이 단순한 경험적 발견에 그치지 않고, ICAPM 상태변수에 대한 경험적 대리변수(empirical proxies)로 해석될 수 있다. SMB는 경기 변동 상태변수를, HML은 이자율 상태변수를 반영하며, 이들이 가격결정 요인인 이유는 미래 투자 기회의 변화를 포착하기 때문이다. ICAPM이 동기부여(motivation)를 제공하고, APT가 형식(formalism)을 제공하고, FF가 경험적 내용(empirical content)을 채우는 구조이다.

CheeseStock의 MRA 17열 Ridge 회귀에 포함된 매크로 팩터(금리, 변동성, 환율)는 ICAPM 상태변수의 경험적 대리변수이다. momentum_60d, beta_60d, value_inv_pbr, log_size, liquidity_20d의 5개 APT 팩터가 모두 $p < 0.001$ 유의하며, 이들의 추가로 Walk-Forward IC가 0.0567에서 0.0998로 0.0430 증분을 달성했다.
$$E[R_i] - R_f = \beta_{i,M} \lambda_M + \sum_{k=1}^{K} \beta_{i,k} \lambda_k$$

$$\beta_{i,k} = \frac{\text{Cov}(R_i, \Delta s_k)}{\text{Var}(\Delta s_k)} \qquad \text{(헤지 베타)}$$

$$w_i^{*} = \underbrace{-\frac{J_W}{J_{WW}} \cdot \frac{\mu_i}{\sigma_i^2}}_{\text{mean-variance}} + \underbrace{\sum_k -\frac{J_{W s_k}}{J_{WW}} \cdot \frac{\sigma_{i,s_k}}{\sigma_i^2}}_{\text{hedging demand}}$$

| 기호 | 의미  |
|:----:|------|
| $\beta_{i,M}$ | 시장 베타 (표준 CAPM과 동일)  |
| $\beta_{i,k}$ | 상태변수 k에 대한 헤지 베타  |
| $\lambda_k$ | 상태변수 k의 위험 프리미엄  |
| $\Delta s_k$ | 상태변수 k의 혁신(innovation)  |
| $J(W,s,t)$ | Merton 간접 효용 함수  |
| $\text{BOK rate}$ | 한국은행 기준금리 (상태변수 s1)  |
| $\text{VKOSPI}$ | 변동성 지수 (상태변수 s2)  |
| $\text{USD/KRW}$ | 원/달러 환율 (글로벌 위험선호)  |

> 이전 Stage 데이터: Stage 1의 `data/macro/macro_latest.json`(BOK 기준금리, USD/KRW), `data/macro/bonds_latest.json`(국고채 3Y/10Y), `data/vkospi.json`(VKOSPI 시계열), `data/macro/ff3_factors.json`(MKT, SMB, HML)이 ICAPM 상태변수의 직접적 측정값으로 활용된다.


### 2.6.6 소비기반 자본자산가격결정모형 (CCAPM)
소비 기반 자본자산 가격결정 모형(CCAPM)은 Breeden(1979)과 Lucas(1978)가 도출한, 자산가격을 총소비 성장률(aggregate consumption growth)과의 공분산으로 결정하는 가장 "근본적인(fundamental)" 가격결정 모형이다. ICAPM에서 다중 상태변수에 대한 헤지 베타를 필요로 했던 것과 달리, CCAPM은 Breeden의 소비 베타 정리(Consumption Beta Theorem)에 의해 모든 상태변수를 단일 소비 베타($\beta_{c,i}$)로 축약한다. 이는 궁극적으로 투자자가 관심을 갖는 것이 부(wealth) 자체가 아니라 소비(consumption)라는 통찰에 기반한다.

CCAPM의 오일러 방정식 $1 = E[M_{t+1}(1+R_i)]$은 금융학에서 가장 기본적인 가격결정 방정식이다. 확률적 할인 인자(SDF) $M_{t+1} = \delta(C_{t+1}/C_t)^{-\gamma}$의 형태를 특정함으로써 모든 자산가격결정 모형이 이 방정식의 특수한 경우로 해석된다(Cochrane 2005). CAPM은 $M = a - bR_m$, APT는 $M = a - \sum b_k F_k$로 각각 SDF의 특수 형태이다.

그러나 CCAPM은 주식 프리미엄 퍼즐(Equity Premium Puzzle, Mehra & Prescott 1985)이라는 심각한 실증적 난제에 직면한다. 미국 역사적 주식 프리미엄 약 6.2%를 설명하려면 상대적 위험회피계수 $\gamma \approx 27$이 필요한데, 이는 합리적 범위(1~10)를 크게 초과한다. 이에 대한 해결 시도로 Campbell & Cochrane(1999)의 습관 형성(Habit Formation), Epstein & Zin(1989)의 재귀적 효용(Recursive Utility), Barro(2006)의 희귀 재난(Rare Disasters) 모형이 제안되었다.
$$1 = E\bigl[M_{t+1}(1 + R_{i,t+1})\bigr], \qquad M_{t+1} = \delta \left(\frac{C_{t+1}}{C_t}\right)^{-\gamma}$$

$$E[R_i] - R_f = \beta_{c,i} \cdot \lambda_c, \qquad \beta_{c,i} = \frac{\text{Cov}(R_i, \Delta c)}{\text{Var}(\Delta c)}$$

$$\gamma_{\text{EPP}} = \frac{E[R_m] - R_f}{\text{Cov}(r_m, \Delta c)} \approx 27 \qquad \text{(Mehra-Prescott)}$$

$$M_{t+1}^{\text{EZ}} = \delta^{\theta} \left(\frac{C_{t+1}}{C_t}\right)^{-\theta/\psi} R_{w,t+1}^{\theta-1}, \qquad \theta = \frac{1-\gamma}{1-1/\psi}$$

| 기호 | 의미  |
|:----:|------|
| $M_{t+1}$ | 확률적 할인 인자 (SDF)  |
| $\delta$ | 시간 할인 인자 (0 < δ < 1)  |
| $\gamma$ | 상대적 위험회피계수 (CRRA)  |
| $\Delta c$ | 로그 소비 성장률 ln(Ct₊1/Ct)  |
| $\psi$ | 시점간 대체탄력성 (EIS)  |
| $R_w$ | 부(wealth) 포트폴리오 수익률  |

> 이전 Stage 데이터: 한국 가계 소비 데이터는 KOSIS API에서 분기별로 수신하며, `data/macro/kosis_latest.json`에 소비자심리지수(CCI)가 소비 성장의 간접적 프록시로 수록되어 있다. 다만 일별/주별 패턴 거래에 직접 적용하기에는 데이터 빈도 제약이 있다.


### 2.6.7 차익거래 가격결정이론 (APT)
차익거래 가격결정 이론(APT)은 Ross(1976)가 CAPM과 근본적으로 다른 논리 구조에서 도출한 다중 팩터 가격결정 모형이다. CAPM이 투자자 효용 극대화와 동질적 기대라는 강한 가정에서 시장 균형(equilibrium)을 통해 도출되는 반면, APT는 수익률의 팩터 구조(factor structure)와 무차익 조건(no-arbitrage)이라는 약한 가정만으로 선형 가격결정에 도달한다. 이 "균형 대 무차익" 구분이 두 모형의 근본적 차이이다.

APT의 도출은 다음과 같다. $N$개 종목의 수익률이 $K$개 공통 팩터와 고유 충격으로 분해되고($R_i = E[R_i] + \sum b_{ik}F_k + \varepsilon_i$), 고유 충격이 종목 간 무상관($\text{Cov}(\varepsilon_i, \varepsilon_j) = 0$)이면, 잘 분산된 포트폴리오에서 고유 위험이 소멸한다. 이때 무비용·무팩터노출·양의기대수익인 차익거래 포트폴리오가 존재하지 않으려면, 기대수익률이 팩터 로딩의 선형 함수여야 한다: $E[R_i] = R_f + \sum b_{ik}\lambda_k$. APT의 강점이자 한계는 팩터의 수($K$)와 정체성을 사전에 특정하지 않는다는 점이다. ICAPM이 "왜" 다중 팩터가 필요한지를, FF가 "어떤" 팩터가 경험적으로 유효한지를 각각 보완한다.

CheeseStock의 MRA 파이프라인은 APT의 직접 구현이다. **오프라인**(`scripts/mra_apt_extended.py`)은 17열 Ridge 회귀의 설계행렬을 구성한다 — 열 1~12는 패턴 고유 특성(hw, vw, mw, confidence 등), 열 13~17은 APT 팩터(momentum_60d, beta_60d, value_inv_pbr, log_size, liquidity_20d)이며 결과는 `data/backtest/mra_apt_coefficients.json`로 저장된다. **클라이언트**(`js/aptModel.js`)는 이 계수를 fetch하여 `aptModel.predict(features)` API로 런타임 horizon=5d 수익률 예측을 제공한다 (V48-H4-C6 uplift, 2026-04-20). **Consumer wiring (P6-002, 2026-04-20)**: `js/backtester.js::_collectOccurrences` L.1436이 각 패턴 발생점에서 `aptModel.predict()`를 호출하여 `occ.aptPrediction`(5d 예상 수익률, %)을 저장한다. `_computeStats` L.2208은 이 예측을 실측 수익률과 비교하여 `stats.icApt` (Spearman 순위 상관계수, n≥20 가드)를 계산하고, 기존 5-col WLS 기준선(`stats.ic`)과의 델타(`stats.icAptDelta`)를 함께 기록한다. 본 링크는 Option C 설계 — 별도 `aptPrediction` 필드로만 노출되며 기존 confidence 체인(Layer 0~10)에는 결합되지 않아 회귀 위험을 제거한다. 현재 클라이언트 APT 팩터는 `momentum_60d` 외 4종이 `null`로 전달되며(financials.js의 meta 의존성 미연계 상태), 향후 Phase 7 uplift에서 종목별 meta 주입으로 전체 5-factor가 기여하도록 확장 예정이다. Walk-Forward IC = 0.0998(Phase 4-1, 237,977 samples)은 모든 5개 APT 팩터가 $p < 0.001$ 유의함을 확인했으며, 유동성($t=-27.6$)이 가장 강력한 가격결정 요인으로 Amihud(2002)의 KRX 적용을 실증한다.
$$R_i = E[R_i] + \sum_{k=1}^{K} b_{ik} F_k + \varepsilon_i, \qquad E[F_k]=0, \; \text{Cov}(\varepsilon_i, \varepsilon_j) = 0$$

$$E[R_i] = R_f + \sum_{k=1}^{K} b_{ik} \lambda_k \qquad \text{(무차익 조건)}$$

$$\text{차익거래 포트폴리오}: \quad \sum w_i = 0, \quad \sum w_i b_{ik} = 0 \;\forall k, \quad \sum w_i E[R_i] > 0 \Rightarrow \text{불가}$$

| 기호 | 의미  |
|:----:|------|
| $b_{ik}$ | 종목 i의 팩터 k 로딩  |
| $F_k$ | 팩터 k의 서프라이즈 (innovation)  |
| $\lambda_k$ | 팩터 k의 위험 프리미엄  |
| $\varepsilon_i$ | 고유 충격 (idiosyncratic shock)  |
| $K$ | 공통 팩터 수 (K ≪ N)  |
| $\text{liquidity}_{20d}$ | 20일 거래 회전율  |
| $\text{momentum}_{60d}$ | 60일 수익률  |

> 이전 Stage 데이터: Stage 1에서 `mra_apt_extended.py`가 17열 설계행렬을 구성하고 Ridge 회귀를 수행한다. 5개 APT 팩터(momentum, beta, value, size, liquidity)는 OHLCV, `index.json`(시총), `financials/*.json`(자본총계)에서 직접 계산된다.


### 2.6.8 파마-프렌치 3/5요인 모형 (Fama-French)
Fama & French(1993)의 3-Factor 모형은 CAPM의 단일 시장 팩터에 SMB(Small Minus Big, 규모 효과)와 HML(High Minus Low, 가치 효과)을 추가하여 횡단면 수익률의 설명력을 대폭 향상시켰다. CAPM이 설명하지 못하는 소형주 프리미엄(Banz 1981)과 가치주 프리미엄(Basu 1977, Rosenberg et al. 1985)을 체계적 팩터로 포착한다. 2015년에는 RMW(수익성)와 CMA(투자)를 추가한 5-Factor 모형으로 확장되었다.

FF 팩터 구성은 2x3 정렬(double sort) 방법론을 따른다. 매년 6월 말 기준 시가총액 중위수로 Small/Big을 구분하고, B/M(장부가치 대 시가총액) 비율의 30/40/30 분위로 Value/Neutral/Growth를 분류한다. SMB = (SV + SN + SG)/3 - (BV + BN + BG)/3, HML = (SV + BV)/2 - (SG + BG)/2로 시가총액 가중 포트폴리오 수익률 차이를 계산한다.

CheeseStock의 한국 FF3 팩터는 오프라인 배치 파이프라인에서 구성되며, 일별 팩터 수익률로 저장된다. 초기 실증(2025.04--2026.04): MKT\_RF Sharpe=+2.99, SMB Sharpe=-3.82, HML Sharpe=-2.80으로, 음의 SMB/HML은 해당 기간 한국 시장의 대형·성장주 프리미엄을 확인한다. FF3 팩터 구성은 Python 오프라인 스크립트에서만 수행되며, 브라우저에서는 사전 계산된 팩터 수익률을 로드한다. **Confidence wiring (P6-003, 2026-04-20)**: `js/financials.js::_renderFF3Factors`가 종목별 SMB/HML/MKT 로딩을 OLS 회귀로 산출한 후 `_ff3StockLoadings[code]` 캐시에 저장하고 `getFF3Loadings(code)` 헬퍼로 노출한다. `js/appWorker.js::_applyFF3ConfidenceToPatterns` (Layer 4b, EVA 이후·파생 이전 삽입)가 이 로딩과 `_macroComposite.mcsV2`(또는 fallback P6-001)를 결합하여 MCS≥70 강세 구간에서 SMB>0.3(소형) 매수 패턴 +5%, HML>0.3(가치) 매수 +4%를 부여하고, MCS≤30 약세 구간에서는 대형·성장 매도 패턴을 미세 조정한다. 보수적 clamp `[0.90, 1.10]` — FF3는 패턴-수익 직접 모형이 아니므로 좁은 범위로 제한된다. Chan & Chen (1991)의 size-cycle 상호작용과 Petkova & Zhang (2005)의 value premium procyclicality가 이론적 근거이며, 종목 샘플 수 $n<60$인 경우 신뢰도 게이트로 조정 생략(`getFF3Loadings` null 반환).

#### 한국 시장에서의 FF3/FF5 실증 문헌

FF3와 FF5의 한국 적용은 1990년대 후반 이래 꾸준히 연구되어 왔으며, 핵심 결과는 미국 표본과 정성적으로 유사하지만 팩터별 강도와 부호에 구조적 차이가 있다는 점이다. Kim, Shin and Stulz (2001, *Pacific-Basin Finance Journal*)는 1982-1994 KSE 표본에서 SMB와 HML이 횡단면 수익률을 유의하게 설명하되, HML 프리미엄이 SMB보다 크다고 보고하였다. 이후 Ryu, Ryu and Hwang (2017)은 1992-2014 확장 표본에서 FF5 추가 팩터(RMW, CMA)의 한국 적용성을 검토하여, RMW는 유의한 프리미엄을 생성하나 CMA는 소표본에서 안정성이 낮다고 보고한 바 있다. Liu, Stambaugh and Yuan (2019)의 중국 시장 FF3 연구도 동아시아 국가에서 표준 Fama-French 프레임워크가 작동하되 지역 조정이 필요함을 강조한다.

한국 시장의 구조적 특징이 FF 팩터 강도에 영향을 준다. 첫째, 재벌(chaebol) 순환출자 구조는 SMB 포트폴리오의 "Small" 집단 내 관계회사 비중을 증가시켜 순수 소형주 효과와 재벌 계열사 효과가 혼재되는 문제를 낳는다. 둘째, KOSDAQ 벤처기업의 B/M 비율은 R&D 자산의 회계적 표현 한계로 인해 HML 분류에서 잡음이 크다. 셋째, 한국의 높은 개인투자자 비중(특히 KOSDAQ 60-70%)은 가격 반응을 단기화하여 FF 팩터 프리미엄의 시계열 변동성을 확대한다.

| 팩터 | 미국 (Fama-French 1993/2015) | 한국 (Kim-Shin-Stulz 2001 등) | CheeseStock 실증 (2025.04-2026.04) |
|------|-----------------------------|------------------------------|-----------------------------------|
| MKT_RF | 연 평균 +6-8%, 유의 | 연 평균 +5-7%, 유의 | Sharpe +2.99 |
| SMB | 연 평균 +3%, 유의 | 유의하나 크기 미국 대비 작음 | Sharpe -3.82 (기간 특수성) |
| HML | 연 평균 +5%, 유의 | 한국에서 SMB 대비 상대적으로 강함 | Sharpe -2.80 (기간 특수성) |
| RMW | 연 평균 +3%, 유의 | 유의 (Ryu et al. 2017) | 미구현 (FF3만 현재) |
| CMA | 연 평균 +2%, 유의 | 안정성 낮음 | 미구현 (FF3만 현재) |

CheeseStock의 2025.04-2026.04 초기 실증 기간에서 SMB와 HML이 음의 Sharpe를 기록한 것은 장기 프리미엄의 반전 해가 표본에 포함되었기 때문이며, Korean market의 2022-2024 대형·성장주 집중 랠리(삼성전자·SK하이닉스 주도 반도체 사이클)의 후기 효과로 해석된다. 이는 FF 팩터 프리미엄이 장기적으로는 양(+)이지만 단기 창에서 부호가 역전될 수 있다는 Fama-French (2015)의 원전 관찰과 부합한다. 향후 FF5(+RMW, +CMA) 확장 시 한국 실증 문헌을 출처로 인용하고, 재벌·KOSDAQ 특성에 따른 팩터 구성 조정(예: 재벌 계열사 제외 서브샘플 팩터)을 선택적으로 제공할 수 있다.
$$R_i - R_f = \alpha_i + \beta_{MKT} \cdot \text{MKT\_RF} + \beta_{SMB} \cdot \text{SMB} + \beta_{HML} \cdot \text{HML} + \varepsilon_i$$

$$\text{SMB} = \frac{1}{3}(S_V + S_N + S_G) - \frac{1}{3}(B_V + B_N + B_G)$$

$$\text{HML} = \frac{1}{2}(S_V + B_V) - \frac{1}{2}(S_G + B_G)$$

$$\text{FF5}: \;\; + \; \beta_{RMW} \cdot \text{RMW} + \beta_{CMA} \cdot \text{CMA}$$

| 기호 | 의미  |
|:----:|------|
| $\text{MKT\_RF}$ | 시장 초과수익률 (Rm - R_f)  |
| $\text{SMB}$ | 소형주 프리미엄 (Small Minus Big)  |
| $\text{HML}$ | 가치주 프리미엄 (High Minus Low)  |
| $\text{RMW}$ | 수익성 프리미엄 (Robust Minus Weak)  |
| $\text{CMA}$ | 투자 프리미엄 (Conservative Minus Aggressive)  |
| $\text{B/M ratio}$ | 자본총계 / 시가총액  |
| $\text{marketCap}$ | 시가총액 (index.json)  |

> 이전 Stage 데이터: Stage 1에서 `index.json`의 시가총액(marketCap)과 `data/financials/{code}.json`의 자본총계(total_equity)로 B/M ratio를 산출한다. 무위험이자율은 CD 91일물 금리를 250 거래일(KRX 연간 거래일)로 일할계산한다. 약 2,241 종목이 seed 데이터 제외 후 유니버스를 구성한다.


### 2.6.9 채권 가격결정과 듀레이션 (Bond Pricing & Duration)

채권 수익률의 거시경제적 해석(경기 예측, 수익률 곡선 레짐)은 거시경제학 절에서 다루며, 본 절은 가격결정의 수학적 구조에 집중한다.

채권 가격은 미래 현금흐름(쿠폰 + 원금)의 현재가치 합이다. 이 단순한 원리가 모든 채권 분석의 기반이며, 듀레이션(duration)은 "채권의 베타"로서 금리 민감도를 단일 숫자로 요약한다(Fabozzi 2007). Macaulay(1938) 듀레이션은 현금흐름의 현재가치 가중 평균 만기이고, 수정 듀레이션(modified duration)은 가격의 금리 탄력성, DV01은 1bp 변동의 절대 금액 변화를 측정한다.

볼록성(convexity)은 듀레이션의 선형 근사를 2차로 보정한다. 대규모 금리 변동에서 듀레이션만으로는 가격 변화를 과소추정(금리 하락 시)하거나 과대추정(금리 상승 시)하며, 볼록성 보정이 이 오차를 줄인다. 양의 볼록성은 금리 하락 시 가격 상승 폭이 금리 상승 시 가격 하락 폭보다 큼을 의미하므로, 동일 듀레이션에서 볼록성이 큰 채권이 유리하다.

한국 채권시장은 국고채(KTB) 중심으로 구조화되어 있으며, KTB 3년/10년/30년이 벤치마크이다. CheeseStock에서 채권 데이터는 Stage 1 채권 파이프라인을 통해 수신되고, 듀레이션·DV01·볼록성이 오프라인 배치로 산출된다. 금리 기간구조(term structure)의 기울기 변화는 ICAPM 상태변수로서 주식 패턴 신뢰도 조정에 활용된다.
$$P = \sum_{t=1}^{n} \frac{C}{(1+y)^t} + \frac{F}{(1+y)^n}$$

$$D_{\text{Mac}} = \frac{1}{P} \sum_{t=1}^{n} t \cdot \frac{CF_t}{(1+y)^t}, \qquad D_{\text{mod}} = \frac{D_{\text{Mac}}}{1+y}$$

$$\text{DV01} = D_{\text{mod}} \cdot P \cdot 0.0001$$

$$\text{Convexity} = \frac{1}{P} \sum_{t=1}^{n} \frac{t(t+1) \cdot CF_t}{(1+y)^{t+2}}$$

$$\frac{\Delta P}{P} \approx -D_{\text{mod}} \cdot \Delta y + \frac{1}{2} \cdot \text{Convexity} \cdot (\Delta y)^2$$

| 기호 | 의미  |
|:----:|------|
| $P$ | 채권 가격  |
| $C$ | 기간별 쿠폰 이자  |
| $F$ | 액면가(par value)  |
| $y$ | 만기수익률 (YTM)  |
| $D_{\text{Mac}}$ | Macaulay 듀레이션  |
| $D_{\text{mod}}$ | 수정 듀레이션  |
| $\text{KTB 3Y/10Y}$ | 국고채 3년/10년 금리  |

> 이전 Stage 데이터: Stage 1의 `data/macro/bonds_latest.json`에서 KTB 3Y, 5Y, 10Y, 30Y 금리를 수신한다. 금리 기간구조의 기울기(10Y-3Y spread)는 경기 전망 상태변수이며, 역전(inversion) 시 경기 침체 신호로 해석된다. `compute_bond_metrics.py`가 듀레이션·DV01 산출을 수행한다.


### 2.6.10 BSM 옵션가격결정 (Black-Scholes-Merton)
Black-Scholes-Merton(BSM) 모형은 Black & Scholes(1973)와 Merton(1973)이 독립적으로 도출한 옵션 가격결정의 해석적 공식이다. 기초자산이 기하 브라운 운동(GBM)을 따르고, 무차익 조건 하에서 완전 헤지(delta hedging)가 가능할 때, 유럽형 콜/풋 옵션의 공정 가격을 폐쇄형(closed-form)으로 산출한다. BSM은 파생상품 가격결정의 출발점이자, 자산가격결정의 제1기본정리(FTAP)의 가장 직관적인 응용이다.

BSM의 핵심 가정은 상수 변동성($\sigma$)이지만, 현실에서 내재변동성(IV)은 행사가격에 따라 달라지는 변동성 미소(volatility smile)를 보인다. 이는 기초자산 수익률의 분포가 정규분포보다 두꺼운 꼬리를 가짐을 시사하며, Heston(1993) 확률변동성 모형, Dupire(1994) 로컬변동성 모형 등의 확장 모형이 이를 보정한다.

CheeseStock에서 BSM은 VKOSPI(KOSPI200 옵션 내재변동성 지수)의 이론적 기반을 제공한다. VKOSPI는 CBOE VIX와 동일한 방법론으로 산출되며, 일별 시계열로 저장된다. 오프라인 배치 파이프라인이 스트래들 내재 변동(straddle implied move), 풋-콜 비율(PCR), 감마 익스포저(GEX) 등을 산출한다.
$$C = S \cdot N(d_1) - K e^{-rT} \cdot N(d_2)$$

$$P = K e^{-rT} \cdot N(-d_2) - S \cdot N(-d_1)$$

$$d_1 = \frac{\ln(S/K) + (r + \sigma^2/2)T}{\sigma\sqrt{T}}, \qquad d_2 = d_1 - \sigma\sqrt{T}$$

$$C + Ke^{-rT} = P + S \qquad \text{(Put-Call Parity)}$$

| 기호 | 의미  |
|:----:|------|
| $S$ | 기초자산 현재가격  |
| $K$ | 행사가격 (strike)  |
| $T$ | 잔존만기  |
| $r$ | 무위험이자율  |
| $\sigma$ | 변동성 (연율화)  |
| $N(\cdot)$ | 표준정규분포 CDF  |
| $\sigma_{IV}$ | 내재변동성 (VKOSPI)  |

> 이전 Stage 데이터: Stage 1의 `data/vkospi.json`에서 VKOSPI 일별 시계열을 수신한다. VKOSPI는 KOSPI200 옵션의 30일 만기 ATM 내재변동성으로, BSM 역함수(Newton-Raphson)를 통해 관측된 옵션 시장가격에서 추출된다. `compute_options_analytics.py`가 straddle implied move를 산출한다.


### 2.6.11 그릭스와 내재변동성 (Greeks & IV)
Greeks는 BSM 모형에서 옵션 가격의 각 입력 변수에 대한 편미분으로 정의되는 민감도 체계이다. Delta($\Delta$)는 기초자산 가격 변화에 대한 민감도, Gamma($\Gamma$)는 Delta의 변화율(볼록성), Theta($\Theta$)는 시간 가치 감쇠, Vega($\nu$)는 변동성 민감도를 측정한다. 실무에서 시장 조성자의 감마 헤지(gamma hedging)는 기초자산의 단기 가격 변동을 증폭 또는 감쇠시키며, 이것이 감마 익스포저(GEX) 신호의 이론적 기반이다.

변동성 리스크 프리미엄(VRP)은 내재변동성($\sigma_{IV}$)과 실현변동성($\sigma_{RV}$)의 괴리로 정의된다: $\text{VRP} = \sigma_{IV}^2 - \sigma_{RV}^2$. 투자자가 변동성 위험에 대해 보험료를 지불하므로 내재변동성이 실현변동성을 체계적으로 상회하며, VRP가 양수인 것이 일반적이다. Bollerslev, Tauchen & Zhou(2009)는 VRP가 1~3개월 주식 수익률의 유의미한 예측자임을 보였다. VRP의 이론적 근거는 ICAPM의 변동성 상태변수에 대한 헤지 수요이다.

CheeseStock에서 VRP는 VKOSPI(내재변동성)와 20일 역사적 변동성의 차이로 계산된다. 양의 VRP가 급격히 확대되면 시장의 공포 수준이 높아진 것으로 해석되며, 패턴 신뢰도 조정의 추가 입력으로 활용된다.
$$\Delta = \frac{\partial C}{\partial S} = N(d_1), \qquad \Gamma = \frac{\partial^2 C}{\partial S^2} = \frac{N'(d_1)}{S\sigma\sqrt{T}}$$

$$\Theta = -\frac{S N'(d_1)\sigma}{2\sqrt{T}} - rKe^{-rT}N(d_2), \qquad \nu = S\sqrt{T}\,N'(d_1)$$

$$\text{VRP} = \sigma_{IV}^2 - \sigma_{RV}^2 \qquad \text{(Bollerslev-Tauchen-Zhou 2009)}$$

$$\text{GEX} = \sum_{\text{strikes}} \text{OI} \times \Gamma \times S^2 \times 0.01 \times 100 \qquad \text{(net gamma exposure)}$$

| 기호 | 의미  |
|:----:|------|
| $\Delta$ | 기초자산 가격 민감도  |
| $\Gamma$ | Delta의 변화율 (볼록성)  |
| $\Theta$ | 시간가치 감쇠  |
| $\nu$ | 변동성 민감도 (Vega)  |
| $N'(\cdot)$ | 표준정규분포 PDF  |
| $\sigma_{IV}$ | VKOSPI 내재변동성  |
| $\sigma_{RV}$ | 역사적 실현변동성  |

> 이전 Stage 데이터: Stage 1에서 `data/vkospi.json`의 VKOSPI가 $\sigma_{IV}$를, OHLCV에서 `calcHV()`가 산출한 20일 역사적 변동성이 $\sigma_{RV}$를 제공한다. VRP는 이 두 값의 차이로 계산되며, `signalEngine.js`에서 `calcVRP()` 호출을 통해 변동성 레짐 신호에 반영된다.


### 2.6.12 시장 미시구조 (Market Microstructure)
시장 미시구조(market microstructure)는 자산의 거래 과정에서 가격이 어떻게 형성되고, 정보가 어떻게 가격에 반영되며, 유동성이 어떻게 제공되는지를 연구하는 분야이다. 세 가지 핵심 모형이 이론적 기반을 구성한다: Kyle(1985)의 정보 기반 가격 충격 모형, Glosten-Milgrom(1985)의 호가 스프레드 분해 모형, 그리고 Amihud(2002)의 비유동성 측도이다.

Kyle(1985) 모형에서 가격 충격 계수 $\lambda = \sigma_v / (2\sigma_u)$는 내부자의 정보 가치 변동성($\sigma_v$)과 잡음 거래량($\sigma_u$)의 비율로 결정된다. $\lambda$가 높을수록 주문이 가격에 미치는 영향이 크고, 이는 정보 비대칭의 정도를 반영한다. Glosten-Milgrom(1985) 모형은 호가 스프레드(bid-ask spread)를 정보 비용($\mu\delta$)과 재고 비용으로 분해하여, 스프레드가 정보 비대칭의 직접적 함수임을 보인다: $\text{Spread} = 2\mu\delta$, 여기서 $\mu$는 정보거래자 비율, $\delta$는 정보 가치이다.

Amihud(2002)의 비유동성 측도(ILLIQ)는 $\text{ILLIQ}_t = |r_t| / \text{DVOL}_t$로 정의되며, 단위 거래금액당 가격 충격을 측정한다. 이는 Kyle $\lambda$의 실증적 대리변수로 해석되며, MRA 17열 Ridge 회귀에서 유동성 팩터($t = -27.6$)가 가장 강력한 가격결정 요인임이 확인되었다. Kyle 모형과 GM 스프레드 분해는 이론적 프레임워크로만 참조하며, 직접적 구현은 Amihud ILLIQ에 한정된다.
$$\Delta P = \lambda \cdot \text{OrderFlow}, \qquad \lambda = \frac{\sigma_v}{2\sigma_u} \qquad \text{(Kyle 1985)}$$

$$\text{ILLIQ}_t = \frac{|r_t|}{\text{DVOL}_t}, \qquad \overline{\text{ILLIQ}} = \frac{1}{T}\sum_{t=1}^{T} \text{ILLIQ}_t \qquad \text{(Amihud 2002)}$$

$$\text{Spread}_{\text{GM}} = 2\mu\delta \qquad \text{(Glosten-Milgrom 1985)}$$

| 기호 | 의미  |
|:----:|------|
| $\lambda$ | Kyle 가격 충격 계수  |
| $\sigma_v$ | 정보 가치 변동성  |
| $\sigma_u$ | 잡음 거래량 표준편차  |
| $\text{ILLIQ}_t$ | Amihud 비유동성 측도  |
| $\text{DVOL}_t$ | 거래대금 (가격 × 거래량)  |
| $\mu$ | 정보거래자 비율  |
| $r_t, \text{volume}_t$ | 일별 수익률, 거래량  |

> 이전 Stage 데이터: Stage 1의 OHLCV 데이터에서 `|r_t|`(일별 절대수익률)과 `DVOL_t`(거래대금 = close × volume)를 계산한다. `calcAmihudILLIQ()` 함수가 20일 이동평균 ILLIQ를 산출하며, 이는 APT 유동성 팩터의 직접적 입력이다.


### 2.6.13 머튼 부도거리 (Merton DD)
Merton(1974) 구조적 신용위험 모형은 "기업의 자기자본은 자산가치에 대한 콜옵션"이라는 통찰에 기반한다. 자산가치($V$)가 부채 만기($T$) 시점에 부채 수준($D$) 이하로 하락하면 부도(default)가 발생하고, 주주는 잔여 가치 $\max(V_T - D, 0)$을 수령한다. 이 구조는 BSM 콜옵션과 동형(isomorphic)이므로, 옵션 가격결정 이론이 신용위험 분석에 직접 적용된다.

부도거리(Distance-to-Default, DD)는 자산가치가 부도점(default point)에 도달하기까지의 표준편차 수를 측정한다. $\text{DD} = [\ln(V/D) + (r - 0.5\sigma_V^2)T] / (\sigma_V\sqrt{T})$. DD가 클수록 부도 확률이 낮고, 이론적 부도 확률(PD)은 $N(-\text{DD})$로 산출된다. KMV(Moody's)는 이론적 PD 대신 경험적 부도빈도(EDF)를 매핑하여 실무적 정확도를 향상시켰다.

CheeseStock에서는 Bharath & Shumway(2008)의 간편 추정법("naive DD")을 구현한다. 비상장 자산가치($V$)를 직접 관측할 수 없으므로, 시가총액을 자기자본 가치로, 부채 장부가를 부채 수준으로 대체한다. $\text{DD} < 1.5$ 시 패턴 신뢰도에 감쇠(decay)를 적용하여 재무 건전성이 약한 종목의 기술적 신호를 보수적으로 조정한다.
$$\text{DD} = \frac{\ln(V/D) + (r - 0.5\sigma_V^2)T}{\sigma_V \sqrt{T}}$$

$$\text{PD} = N(-\text{DD}) \qquad \text{(이론적 부도확률)}$$

$$E = V \cdot N(d_1) - D \cdot e^{-rT} \cdot N(d_2) \qquad \text{(주식 = 콜옵션)}$$

$$\sigma_E = \frac{V}{E} \cdot N(d_1) \cdot \sigma_V \qquad \text{(레버리지-변동성 관계)}$$

| 기호 | 의미  |
|:----:|------|
| $V$ | 기업 자산가치 (비관측)  |
| $D$ | 부채 수준 (default point)  |
| $\sigma_V$ | 자산가치 변동성  |
| $E$ | 자기자본 시장가치 (시가총액)  |
| $\text{DD}$ | 부도거리 (표준편차 수)  |
| $\text{PD}$ | 부도확률  |
| 시가총액 | index.json marketCap  |
| 부채총계 | financials/{code}.json  |

> 이전 Stage 데이터: Stage 1에서 `index.json`의 시가총액(marketCap)이 자기자본 시장가치($E$)로, `data/financials/{code}.json`의 부채총계(total_liabilities)가 부채 수준($D$)으로 사용된다. 주가 변동성($\sigma_E$)은 OHLCV에서 산출하며, Bharath-Shumway 간편법에 의해 $\sigma_V \approx \sigma_E \cdot E/(E+D)$로 근사한다.


### 2.6.14 축약형 신용위험 모형 (Reduced-Form Credit Models)
축약형(reduced-form) 신용위험 모형은 구조적 모형(Merton)과 근본적으로 다른 접근 방식을 취한다. 구조적 모형이 자산가치의 진화를 추적하여 부도를 내생적(endogenous)으로 결정하는 반면, 축약형 모형은 부도를 외생적(exogenous) 확률 과정으로 모형화한다. 부도는 위험 강도(hazard rate) $\lambda(t)$를 가진 포아송 과정으로 발생하며, $\lambda(t)$가 높을수록 단위 시간당 부도 확률이 높다.

Jarrow & Turnbull(1995)과 Duffie & Singleton(1999)이 체계화한 축약형 모형에서, 위험 채권의 가격은 부도 확률과 회수율(recovery rate)을 반영한 할인된 기대 현금흐름으로 결정된다. 생존 확률은 $Q(T) = \exp(-\int_0^T \lambda(s)\,ds)$이며, 위험 채권 가격은 $P_{\text{risky}} = P_{\text{riskfree}} \times [Q(T) + (1-Q(T)) \times R]$으로 근사된다. 여기서 $R$은 회수율이다.

축약형 모형의 실무적 장점은 CDS(Credit Default Swap) 가격에서 $\lambda(t)$를 역산(bootstrapping)할 수 있다는 점이다. 그러나 한국 시장에서는 CDS 유동성이 부족하여 구조적 모형(Merton DD)이 더 실용적이다. CheeseStock에서 축약형 모형은 이론적 참조로만 활용되며, 직접적 구현은 없다. 크레딧 스프레드 레짐 분류(Doc 35 §5)가 축약형 모형의 간접적 응용이다.
$$\lambda(t) = \lim_{\Delta t \to 0} \frac{P(\text{default in } [t, t+\Delta t] \mid \text{survival to } t)}{\Delta t}$$

$$Q(T) = \exp\!\left(-\int_0^T \lambda(s)\,ds\right) \qquad \text{(생존확률)}$$

$$P_{\text{risky}} = \sum_{t=1}^{n} \frac{C \cdot Q(t)}{(1+r)^t} + \frac{F \cdot Q(n)}{(1+r)^n} + \sum_{t=1}^{n} \frac{R \cdot F \cdot [\lambda(t)\Delta t \cdot Q(t-1)]}{(1+r)^t}$$

$$\text{CDS Spread} \approx (1-R) \cdot \bar{\lambda} \qquad \text{(간편 근사)}$$

| 기호 | 의미  |
|:----:|------|
| $\lambda(t)$ | 위험 강도 (hazard rate)  |
| $Q(T)$ | 만기 T까지 생존 확률  |
| $R$ | 부도 시 회수율 (recovery rate)  |
| $P_{\text{risky}}$ | 위험 채권 가격  |
| $\text{CDS Spread}$ | 신용부도스왑 프리미엄  |

> 이전 Stage 데이터: 한국 시장에서 CDS 유동성이 제한적이므로, Stage 1 데이터로부터 직접적인 $\lambda(t)$ 추정은 수행하지 않는다. 대신 `bonds_latest.json`의 회사채 스프레드(AA- 기준)가 축약형 모형의 간접적 프록시로 활용된다.


### 2.6.15 확률할인인자 통합 프레임워크 (SDF)
확률적 할인인자(SDF)는 모든 자산가격결정 모형을 통합하는 메타 프레임워크이다. 기본 가격결정 방정식 $1 = E[M_{t+1}(1+R_i)]$에서 $M$의 형태를 특정함에 따라 CAPM, CCAPM, APT 등이 각각 도출된다. Harrison & Kreps(1979)의 자산가격결정 제1기본정리는 무차익 조건과 양의 SDF 존재의 등가성을 증명하였다.

SDF 존재의 삼단 논증: (1) 일물일가의 법칙이 $p(x) = E[M \cdot x]$인 $M$의 존재를 보장, (2) 무차익 조건이 $M > 0$을 요구하여 위험중립 측도 $Q$의 존재와 동치, (3) 완전시장은 $M$의 유일성을 보장하나 불완전시장에서는 무한히 많은 SDF가 존재한다.

Hansen & Jagannathan(1991)의 HJ Bound는 $\sigma(M)/E[M] \geq |E[R_i]-R_f|/\sigma(R_i)$로 SDF의 최소 변동성을 설정한다. CheeseStock의 MRA 17열 Ridge 계수벡터는 암묵적 선형 SDF를 정의하며, HJ Bound 충족 여부로 모형의 적절성을 진단한다.
$$1 = E\bigl[M_{t+1}(1 + R_{i,t+1})\bigr] \qquad \text{(기본 가격결정 방정식)}$$

$$\frac{\sigma(M)}{E[M]} \geq \frac{|E[R_i] - R_f|}{\sigma(R_i)} \qquad \text{(Hansen-Jagannathan Bound)}$$

$$M > 0 \;\Longleftrightarrow\; \text{No-Arbitrage} \;\Longleftrightarrow\; \exists\, Q \text{ (위험중립 측도)}$$

| 기호 | 의미  |
|:----:|------|
| $M$ | SDF  |
| $\sigma(M)/E[M]$ | SDF 변동계수  |
| $Q$ | 위험중립 측도  |

> 이전 Stage 데이터: SDF는 순수 이론적 통합 틀이다. MRA Ridge 계수벡터가 암묵적 SDF를 정의하며, HJ Bound 검증 시 KOSPI 연환산 Sharpe Ratio(0.25--0.35)가 기준이 된다.


### 2.6.16 금융학 시트 통합 요약 (Financial Theory Integration Summary)
본 절의 15개 시트는 자산가격결정의 이론적 계보를 완전하게 구성한다. EMH/AMH(2.6.1)로 시장 효율성의 전제를 설정하고, MPT(2.6.2)→CAPM(2.6.3)→Zero-Beta(2.6.4)→ICAPM(2.6.5)→CCAPM(2.6.6)으로 이어지는 균형 자산가격결정의 진화를 추적한다. APT(2.6.7)와 FF3/5(2.6.8)는 무차익 논증과 경험적 팩터의 축을 제공하며, 채권(2.6.9), 옵션(2.6.10~11), 미시구조(2.6.12), 신용위험(2.6.13~14)은 교차시장 신호의 이론적 기반을 구성한다. SDF(2.6.15)가 이 모든 것을 $1 = E[M(1+R)]$이라는 단일 방정식으로 통합한다.

<!-- newpage -->

## 2.7 행동재무학적 기초[^behav-1]

행동재무학은 기술적 패턴이 *왜* 작동하는지에 대한 이론적 정당화를 제공한다.
체계적 인지 편향이 본질가치로부터의 예측 가능한 이탈을 생성하기 때문이다.
모든 시장참여자가 합리적 베이지안 갱신자(EMH의 가정)라면, 가격 패턴은 어떠한
예측적 정보도 담지 않을 것이다.

이론적 흐름 (7시트): 전망이론/손실회피 (2.7.1) → 처분효과 (2.7.2) → 군집행동 (2.7.3) → 인지편향 (2.7.4) → BLL 반예측기 (2.7.5) → 베타-이항 사후 (2.7.6) → 요약 (2.7.7). 인간의 체계적 비합리성이 가격 패턴을 생성하는 메커니즘을 추적하고, 이를 역으로 활용하는 반예측기/베이즈 교정으로 귀결한다.


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
|:----:|------|
| $v(x)$ | 가치함수  |
| $\lambda = 2.25$ | 손실회피 계수 (K&T 1979)  |
| $\delta = 0.25$ | KRX 보호 계수 (가격제한폭+T+2)  |
| $SL_{\text{base}}$ | 기본 손절매 수준  |
| $TP_{\text{base}}$ | 기본 목표가 수준  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{SL_(base)}$, $\textcolor{stageOneMarker}{TP_(base)}$은(는) Stage 1 데이터 계층에서 산출된다.


유도:
$$SL_{\text{adj}} = SL_{\text{base}} \times (1 + \delta(\sqrt{\lambda} - 1)), \quad \lambda=2.25: \; 1 + 0.25(1.50-1) = 1.125 \approx 1.12$$

### 2.7.2 처분효과 (Disposition Effect)

Shefrin and Statman (1985, *Journal of Finance*)이 정식화한 처분효과(disposition effect)는 투자자가 이익이 난 포지션을 너무 빨리 매도하고 손실이 난 포지션을 너무 오래 보유하는 체계적 비대칭이다. 저자들은 이 현상에 "매도 효용과 회피 효용의 체계적 비대칭"이라는 구조적 설명을 부여하였으며, 그 미시적 기초를 2.7.1절에서 서술한 전망이론의 가치함수 $v(x)$에서 직접 도출하였다.

#### 가치함수로부터의 도출

가치함수가 이득 영역에서는 오목(concave)하고 손실 영역에서는 볼록(convex)하며, 준거점에서 손실회피 계수 $\lambda = 2.25$의 꺾임(kink)을 가진다는 세 가지 특징은 처분효과의 수학적 필요조건이다. 매수 가격 $P_0$를 준거점으로 설정한 투자자가 현재 $P_t$를 관찰할 때, 매도 결정의 기대 효용은 다음으로 표현된다.

$$U_{\text{sell}}(P_t) = v(P_t - P_0) = \begin{cases} (P_t - P_0)^{0.88} & P_t \geq P_0 \text{ (실현이익)} \\ -2.25 \cdot (P_0 - P_t)^{0.88} & P_t < P_0 \text{ (실현손실)} \end{cases}$$

이득 영역의 오목성 $v''(x) < 0$은 한계효용 체감을 의미하므로, 작은 실현이익도 "확실한 이득"으로 상대적으로 높게 평가되어 매도 동기가 강화된다. 반대로 손실 영역의 볼록성 $v''(x) > 0$은 한계비용 체감을 의미하여, 손실이 깊어질수록 추가 손실의 고통이 체감되므로 "매도 = 손실 확정"의 효용 감소가 "계속 보유하며 반등 기대"의 효용 감소보다 크게 느껴진다. Shefrin-Statman의 핵심 통찰은 이 두 영역의 곡률 차이가 정합적 매매 의사결정을 왜곡하여, 투자자가 진정한 기댓값이 아닌 준거점 상대 효용을 극대화한다는 점이다.

#### Odean (1998)의 실증과 PGR/PLR

Odean (1998, *Journal of Finance*)은 미국 개인 증권 계좌 10,000개의 1987-1993 거래 기록을 분석하여 처분효과의 강력한 실증을 제공하였다. 핵심 통계량은 실현이익비율(PGR, Proportion of Gains Realized)과 실현손실비율(PLR, Proportion of Losses Realized)이다.

$$\text{PGR} = \frac{\text{realized gains}}{\text{realized gains} + \text{paper gains}}, \quad \text{PLR} = \frac{\text{realized losses}}{\text{realized losses} + \text{paper losses}}$$

Odean의 표본에서 $\text{PGR} = 0.148$, $\text{PLR} = 0.098$로 나타났으며, $\text{PGR} > \text{PLR}$은 투자자가 이익 실현을 손실 실현보다 약 51% 더 빈번하게 수행한다는 것을 의미한다. 이 패턴은 연말 세금 환급 월(12월)에서는 역전되어, 세금 유인이 가치함수 비대칭을 압도할 만큼 충분히 강할 때만 투자자가 합리적으로 손실을 실현함을 보였다.

#### 시장 수준 귀결: 52주 신고가 저항과 신저가 지지

처분효과가 시장 집합 수준에서 생성하는 가장 관측 가능한 현상은 52주 신고가와 신저가 주변의 비대칭적 거래 행동이다. 52주 신고가에서 매수한 투자자 중 다수는 주가가 매수가로 돌아오면 즉시 매도(본전 매도)하려는 경향을 보이며, 이는 저항선을 형성한다. 52주 신저가에서 매수한 투자자는 반대로 매수가 회복까지 보유를 지속하여 지지선 상단에서의 매물 출회가 지연된다. George and Hwang (2004, *Journal of Finance*)은 52주 신고가 근접도가 횡단면 수익률의 유의한 예측 변수임을 보였으며, 이는 처분효과의 집합적 발현이 기술적 분석에서 관찰되는 저항/지지 수준의 미시적 기초라는 사실을 입증한다.

#### CheeseStock의 구현 반영

처분효과는 CheeseStock의 두 시스템 요소에 직접 반영된다. 첫째, 2.7.1절의 $SL_{\text{adj}} = SL_{\text{base}} \times 1.12$와 $TP_{\text{adj}} = TP_{\text{base}} \times 0.89$ 비대칭은 손실회피 $\lambda = 2.25$의 직접적 결과이며, 이 비대칭을 적용함으로써 사용자가 처분효과에 의해 무의식적으로 취하는 "늦은 손절 + 빠른 익절"의 편향을 시스템이 반대 방향으로 교정한다. 둘째, 52주 신고가/신저가 근접 수준을 [js/patterns.js](js/patterns.js)의 지지/저항 검출 알고리즘에서 고가중치 앵커로 취급하는 것은 George-Hwang(2004)의 실증적 근거를 반영한 것이다.

#### KRX 실증 함의

한국 시장에서 처분효과는 미국 대비 더 강하게 관측된다. Chen et al. (2007, *Journal of Financial Research*)과 Kim and Nofsinger (2007)는 한국 개인투자자의 $\text{PGR} - \text{PLR}$ 격차가 Odean의 미국 표본(0.050)보다 유의하게 크다고 보고하였으며, 이는 KOSDAQ의 개인투자자 비중 60-70%가 처분효과의 집합적 발현 강도를 증폭시킨다는 관찰과 부합한다. CheeseStock의 백테스트에서 KOSDAQ 종목의 52주 신고가 근처 매도 패턴(`doubleTop`, `bearishEngulfing`)이 KOSPI 동일 패턴보다 일관되게 승률이 높게 나타나는 것은 이 구조적 차이의 직접적 귀결이다.

| 지표 | 미국 (Odean 1998) | 한국 (Kim-Nofsinger 2007) | KRX 함의 |
|------|------------------|--------------------------|---------|
| PGR | 0.148 | 0.19-0.23 | 이익 실현 빈도 높음 |
| PLR | 0.098 | 0.11-0.14 | 손실 회피 동기 강함 |
| PGR - PLR | 0.050 | 0.08-0.09 | 처분효과 강도 미국의 1.6-1.8배 |
| 52주 신고가 저항 | 유의 (George-Hwang) | 더 강함 (개인 비중 효과) | `doubleTop` KOSDAQ 승률 우세 |

### 2.7.3 군집행동과 정보폭포 (Herding & Information Cascades)
Banerjee (1992)와 Bikhchandani, Hirshleifer, Welch (1992)의 정보 폭포 이론은
개인이 사적 정보를 합리적으로 무시하고 선행자의 행동을 따르는 메커니즘을
설명한다. CSAD 감소는 군집행동의 경험적 지문이다.
$$CSAD_t = \frac{1}{N} \sum_{i=1}^{N} |R_{i,t} - R_{m,t}|$$

군집 검정: $CSAD_t = \gamma_0 + \gamma_1|R_{m,t}| + \gamma_2 R_{m,t}^2$, $\gamma_2 < 0$ 유의 시 군집 존재.

| 기호 | 의미  |
|:----:|------|
| $\text{CSAD}_t$ | 횡단면 절대 편차  |
| $R_{i,t}$ | 종목 i의 수익률  |
| $R_{m,t}$ | 시장 수익률  |
| $\gamma_2$ | 군집 계수 (음이면 군집)  |
| $R_{i,t}, R_{m,t}$ | Stage 1 수익률 데이터  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{Ri,t, Rm,t}$은(는) Stage 1 데이터 계층에서 산출된다.

### 2.7.4 인지 편향: 앵커링, 과잉확신 (Cognitive Biases)

Tversky and Kahneman (1974)의 앵커링, Daniel, Hirshleifer and Subrahmanyam (1998)의 과잉확신, 그리고 Kahneman and Tversky (1972)의 대표성 휴리스틱은 기술적 분석 패턴의 자기실현적 특성과 평균회귀 패턴의 이론적 근거를 제공한다. 세 편향은 상호 배타적이지 않으며, 개인 투자자의 매매 결정에서 동시에 작동하여 가격 시계열에 일관된 통계적 흔적을 남긴다.

**앵커링(Anchoring)**은 Tversky-Kahneman 실험에서 최초 제시된 수치가 이후 수치 판단의 기준점으로 작용하는 편향으로, 시장에서는 전고점, 전저점, 심리적 라운드 넘버($10,000원, $50,000원 등)가 앵커 역할을 수행한다. 다수 거래자가 동일한 앵커를 공유할 때 해당 가격 수준에서 자기실현적 지지와 저항이 생성된다. **대표성 휴리스틱(Representativeness)**은 현재 관찰된 가격 패턴이 기억 속 원형 패턴과 유사할수록 동일한 결과가 발생할 것이라고 판단하는 편향으로, 거래자가 소표본 빈도만으로 패턴을 확신하게 만드는 근원이다. 이를 보정하기 위해 CheeseStock는 2.7.5절에서 기술하는 반예측기 게이트를 적용한다.

#### Daniel-Hirshleifer-Subrahmanyam (1998) 과잉확신 모형

세 편향 중 가격 시계열에 가장 체계적으로 반영되는 것은 과잉확신이다. Daniel, Hirshleifer and Subrahmanyam (1998, *Journal of Finance*, 이하 DHS)은 투자자 과잉확신과 자기귀인편향이 결합할 때 시장 가격이 과잉반응과 후속 반전을 모두 생성한다는 정형 모형을 제시하였다. 이 이론 구조는 CheeseStock가 검출하는 이중천장(Double Top)과 머리어깨(Head-and-Shoulders) 같은 반전 패턴의 미시적 기초를 제공한다.

과잉확신은 투자자가 자신이 보유한 사적 정보 신호 $s_i$의 정확도를 과대평가하는 것으로 정식화된다. 진정한 신호 구조가 $s_i = \mu + \varepsilon_i$이고 오차 분산이 $\text{Var}(\varepsilon_i) = \sigma_\varepsilon^2$일 때, 과잉확신 투자자는 분산을 $\sigma_\varepsilon^2 / \theta$로 인식한다.

$$\hat{\sigma}_\varepsilon^2 = \frac{\sigma_\varepsilon^2}{\theta}, \quad \theta \geq 1$$

| 기호 | 의미 |
|------|------|
| $\theta$ | 과잉확신 계수 ($\theta = 1$: 합리적, $\theta > 1$: 과잉확신) |
| $s_i$ | 투자자 $i$의 사적 정보 신호 |
| $\mu$ | 자산의 진정한 가치 |
| $\varepsilon_i$ | 신호의 정보 오차 |
| $\sigma_\varepsilon^2$ | 진정한 오차 분산 |
| $\hat{\sigma}_\varepsilon^2$ | 투자자가 인식하는 오차 분산 |

$\theta > 1$일 때 투자자는 사적 신호의 정밀도(precision)를 과대평가하므로, 베이즈 업데이트 과정에서 공적 사전분포(public prior)를 과소 가중한다. 이는 신호가 양(+)일 때 가격을 내재가치 이상으로 밀어 올리는 과잉반응(overreaction)을 생성한다. DHS 모형에서 $t=1$ 시점의 가격 왜곡은 근사적으로 다음과 같이 표현된다.

$$P_1 = \mu + (\theta - 1) \cdot (s_i - \mu) + \eta_1$$

여기서 $\eta_1$은 시장 마찰 요인이다. $\theta = 1$이면 가격은 베이즈 효율적 추정치에 수렴하지만, $\theta > 1$에서는 $(\theta - 1)(s_i - \mu)$만큼 추가로 편향된다. 이 과잉반응은 시간이 지나 공적 정보가 추가로 공개되면 $t=2, 3, \ldots$에서 반전된다.

#### 자기귀인편향의 동태: $\theta$의 비대칭 갱신

DHS의 핵심 기여는 과잉확신 계수 $\theta$를 고정 상수가 아닌 성과에 반응하는 동태 변수로 모형화한 점이다. Bem (1972)의 자기귀인편향(self-attribution bias)을 따라 $\theta$는 성공과 실패에 비대칭적으로 반응한다.

$$\theta_{t+1} = \theta_t + \begin{cases} \Delta^+ & \text{if success} \\ 0 & \text{if failure} \end{cases}, \quad \Delta^+ > 0$$

즉, 신호에 기반한 거래가 이익을 낳으면 투자자는 이를 자신의 능력으로 귀인하여 $\theta$를 상향 조정하지만, 손실이 발생하면 외부 요인(운, 시장 소음)으로 귀인하여 $\theta$를 하향 조정하지 않는다. 이 비대칭성은 성공의 연쇄 이후 $\theta$가 단조 증가하여 과잉반응이 누적되고, 충분히 극단적인 왜곡이 공적 정보에 의해 부정될 때 비로소 반전이 발생하는 동태를 생성한다.

이 구조는 반전 패턴의 형태적 특징과 정확히 대응한다. 이중천장은 동일한 가격 수준에서의 반복적 상승 시도와 실패를 나타내며, 이는 과잉확신에 기반한 신호 주도의 상승이 공적 정보에 의해 두 번 반박되는 과정의 가격 궤적이다. 머리어깨 패턴은 더 긴 기간에 걸친 상승 과정에서 자기귀인에 의해 $\theta$가 누적 증가하다가, 마지막 시도(head)가 가장 큰 과잉반응을 생성한 뒤 연이어 반전되는 세 번의 피크로 나타난다. 두 패턴 모두 DHS 모형의 "과잉반응 → 반전" 동태의 시각적 현현이다.

#### KRX 실증 함의: KOSDAQ 개인투자자 비중의 역할

DHS 모형의 경험적 강도는 시장의 과잉확신 수준 분포에 의존한다. 한국거래소(KRX) 자료에 따르면 KOSDAQ의 일평균 거래대금에서 개인투자자 비중은 대략 60-70%로, KOSPI(30-45%)보다 현저히 높다. Kim and Nofsinger (2007)는 한국 개인투자자 표본에서 기관 대비 높은 과잉확신 수준을 보고하였으며, 이는 KOSDAQ에서 반전 패턴(이중천장, 머리어깨)의 경험적 빈도가 KOSPI 대비 높다는 관찰과 일관된다. CheeseStock의 Stage 5 백테스트에서 KOSDAQ 종목의 `doubleTop` 방향성 승률은 일관되게 KOSPI 동일 패턴보다 2-4 퍼센트포인트 높게 나타나며, 이는 시장 구성이 투자자 편향의 집합적 발현 강도를 결정한다는 이론적 예측과 부합한다.

| 현상 | DHS 예측 | KRX 관찰 |
|------|---------|---------|
| 과잉반응 강도 | $\theta > 1$ 클수록 강함 | KOSDAQ > KOSPI (개인 비중 차이) |
| 반전 패턴 빈도 | 과잉반응 누적 후 증가 | 이중천장/머리어깨 KOSDAQ 우세 |
| 패턴 승률 | 구조적 기초 존재 → 임의 추출보다 우수 | 반전 패턴 승률 55-75% |
| 자기귀인 효과 | 성공 누적 시 $\theta$ 증가 | 추세장 말기 반전 패턴 출현 집중 |

### 2.7.5 반예측기 게이트 (Anti-Predictor Gate --- BLL 1992)
Brock, Lakonishok, and LeBaron (1992)는 26개 기술적 매매 규칙의 통계적 유의성을
검증하였다. CheeseStock는 BLL 논리를 역으로 적용하여, KRX 5년 경험적 승률이
48% 미만인 패턴의 복합 신뢰도를 감액한다.

임계값: 48% (동전 던지기 50% − 거래비용 2pp).[^anti-pred-48]

[^anti-pred-48]: 48%는 CheeseStock 자체 백테스트 교정값으로,
2,645개 KRX 종목 × **245,943**개 패턴 표본(`data/backtest/aggregate_stats.json.total_patterns_detected`,
2026-04-20 pin, 5년 corpus, 2,631종목 분석완료)에서 산출된
거래비용 조정 유의성 임계이다. 과거 303,956 수치는 survivorship 미보정 또는 pre-2,645-pin corpus로 추정되며,
임계값 48% 자체는 재검증 시 유지된다. 세부 표본 구성과 거래비용 가정은
Stage 5 Phase A 실증 보고서 참조.
KRX 발견: 매도 패턴(55~74.7%) > 매수 패턴(39~62%) — 손실회피와 부합.

<!-- [V22-V25 SYNC] -->

V25 업데이트 --- Contrarian 승격: 2025-11-01 기준 OOS 시간분할 백테스트에서 방향성 승률 50% 미만으로 분류된 8개 역예측자 패턴이 1-sided binomial 검정과 Benjamini--Hochberg FDR ($q = 0.10$) 다중검정을 모두 통과(Bonferroni $\alpha = 0.05$에서도 통과)하여 반대방향 예측자(contrarian predictor)로 승격되었다. 이는 BLL (1992)의 반예측기 게이트 논리를 "음의 예측력도 동일한 증거 기준으로 예측자로 인정한다"는 방향으로 일반화한 것이며, 런타임에서는 $\textit{confidencePred} = 100 - \textit{dirWr}$로 반전 산출된다. 이론적 기반은 효율적 시장가설과 적응적 시장가설(2.6.1절, Jegadeesh 1990 단기반전 + Lo 2004 AMH)에, 구현과 8-패턴 통계표는 기술적 분석 도출 요약(3.7.1절)에 기술되어 있다.

### 2.7.6 베타-이항 사후 승률 (Beta-Binomial Posterior)

패턴 승률이 소표본($n < 50$)에서 추정될 때, 원시 승률($\theta_{\text{raw}} = \text{wins}/n$)은 표본 변동에 의해 극단값을 취하기 쉽다. 예컨대 역헤드앤숄더가 특정 종목에서 5회 중 4회 성공하면 $\theta_{\text{raw}} = 80\%$이지만, 이는 진정한 승률의 과대추정일 가능성이 높다. Efron and Morris (1975)의 경험적 베이즈 축소는 이러한 소표본 편향을 체계적으로 교정한다.

축소 추정량은 원시 승률을 범주 전체 평균($\mu_{\text{grand}}$) 방향으로 당기며, 표본 크기가 작을수록 축소 강도가 커진다. $N_0 = 35$ (구현: `js/patterns.js` L.303, Efron-Morris 1975 Empirical Bayes 명명)는 KRX 2,645종목 × 45 패턴(2026-04-20 pin)의 경험적 분산 구조에서 최적화된 축소 강도로, 패턴을 캔들(occurrence-weighted WR ~40-47% by horizon)과 차트(occurrence-weighted WR ~33-37% by horizon) 두 범주로 분리하여 범주 내 축소를 수행한다.

$$\theta_{\text{post}} = \frac{n \cdot \theta_{\text{raw}} + N_0 \cdot \mu_{\text{grand}}}{n + N_0}$$

표본이 충분히 클 때($n \gg N_0$) 사후 추정치는 원시 승률에 수렴하고, 표본이 극소일 때($n \ll N_0$) 범주 평균에 수렴한다. 이 메커니즘은 Stein(1956)이 입증한 축소 추정량 지배성의 **Efron-Morris(1975) 베타-이항 적용판**이며 (코드 주석도 이 명명을 사용), 2,645종목 × 45 패턴이라는 고차원 추정 문제에서 이론적으로 보장된 개선이다.

| 기호 | 의미  |
|:----:|------|
| $\theta_{\text{raw}}$ | 원시 승률 (wins/n)  |
| $\theta_{\text{post}}$ | 축소 사후 승률  |
| $N_0 = 35$ | 축소 강도  |
| $\mu_{\text{grand}}$ | 범주별 총평균  |
| $n$ | 패턴 관측 표본 수  |

> 이전 Stage 데이터: Stage 1 OHLCV에서 산출된 패턴별 승패 기록이 $\theta_{\text{raw}}$ 계산의 입력이다. 축소 추정은 백테스터에서 수행된다.

### 2.7.7 행동재무학 도출 요약 (Behavioral Finance Summary)

본 절의 6개 이론은 각각 패턴 신뢰도 체계의 특정 구성요소로 변환된다.

| 이론 | 학술 출처 | 신뢰도 변환 |
|------|----------|------------|
| 전망이론 손실회피 | Kahneman-Tversky (1979) | 손절 $\times 1.12$ 확대, 목표가 $\times 0.89$ 압축 |
| 처분효과 | Shefrin-Statman (1985) | 52주 신고가/신저가 지지저항 수준 |
| 군집행동 | Banerjee (1992) | CSAD 기반 군집 신뢰도 할인 |
| 앵커링·과잉확신 | Tversky-Kahneman (1974) | 자기실현적 S/R, 반전 패턴 근거 |
| 반예측기 게이트 | Brock-LeBaron (1992) | 승률 48% 미만 패턴 감액 + contrarian 승격 |
| 베타-이항 축소 | Efron-Morris (1975) | 소표본 승률의 사후 교정 ($N_0 = 35$) |

이 6개 변환은 제3장 신뢰도 체인의 행동재무학 계층을 구성하며, 전망이론(손절/목표가)과 반예측기 게이트(승률 필터)가 가장 직접적인 영향을 미친다.

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
     경제학   경영학   금융학   행동재무학  미시구조
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

*판본: V8 (2026-04-10; 2026-04-20 수치 pin) | 제2장 | 7개 학문 65 시트 (h3 실측) + 부록 2.A*


# 제3장: 기술적 분석 — 이론의 실제 적용

제2장의 이론은 그 자체로는 추상적이다. 볼츠만 분포와 GARCH 모형이 실제로 2,645개 종목(2026-04-20 pin)의 차트 위에서 작동하려면, 이론을 구체적인 지표·패턴·신호로 변환하는 과정이 필요하다. 본 장은 CheeseStock에 구현된 32개 지표, 45종 패턴(캔들 34 + 차트 11), 31개 복합 신호 각각이 어떤 학술 이론에서 출발하여 어떤 경로로 코드에 도달했는지를 추적한다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 3.1 | 기술적 지표 (Technical Indicators) | 32개 지표의 학술 출처와 수학적 정식화 |
| 3.2 | Patterns (패턴) | 캔들스틱 35종 + 차트 11종 + 지지/저항 |
| 3.3 | Signals (신호) | 31 개별 + 31 복합 신호, 3-Tier, 기본값 교정 |
| 3.4 | 감지 수학 | ATR 정규화, 틸-센, PCA 품질, 베타-이항, AMH, PCA 예산 |
| 3.5 | 신뢰도 체인 | 거시-미시, 국면 결합, 파생-신용 순차 조정 |
| 3.6 | 백테스팅 검증 | WLS 예측, IC, WFE, BH-FDR, A/B/C/D 등급 |
| 3.7 | 학문간 계보 요약 | 이론→지표→패턴→신호의 전체 도출 경로 |

\newpage

## 3.1 기술적 지표 (Technical Indicators)

32개 기술적 지표의 학술적 출처, 수학적 정식화, 구현 세부를 문서화한다.

| 절 | 지표명 | 학문 계보 |
|:---:|--------|----------|
| 3.1.1 | SMA (단순이동평균) | 통계학 — 기술통계 |
| 3.1.2 | EMA (지수이동평균) | 통계학 — 시계열 평활 |
| 3.1.3 | 볼린저 밴드 | 통계학 — 기술통계 |
| 3.1.4 | EVT 보정 볼린저 밴드 | 통계학 — 극단값 이론 |
| 3.1.5 | RSI (상대강도지수) | 기술적 분석 — Wilder |
| 3.1.6 | ATR (평균진폭) | 기술적 분석 — Wilder |
| 3.1.7 | OBV (누적거래량) | 기술적 분석 — 거래량 |
| 3.1.8 | 일목균형표 | 기술적 분석 — 일본 |
| 3.1.9 | 칼만 필터 | 수학/공학 — 최적 제어 |
| 3.1.10 | 허스트 지수 | 물리학 — 프랙탈 |
| 3.1.11 | 힐 꼬리 추정량 | 통계학 — 극단값 이론 |
| 3.1.12 | GPD 꼬리 적합 | 통계학 — 극단값 이론 |
| 3.1.13 | CAPM 베타 | 금융학 — 자산가격결정 |
| 3.1.14 | 역사적 변동성 (Parkinson) | 금융학 — 변동성 |
| 3.1.15 | VRP (분산 위험 프리미엄) | 금융학 — 변동성 |
| 3.1.16 | WLS 회귀 (릿지 포함) | 통계학 — 회귀분석 |
| 3.1.17 | HC3 강건 표준오차 | 통계학 — 회귀분석 |
| 3.1.18 | GCV 람다 선택 | 통계학 — 회귀분석 |
| 3.1.19 | OLS 추세선 | 통계학 — 회귀분석 |
| 3.1.20 | MACD (이동평균수렴확산) | 기술적 분석 — 모멘텀 |
| 3.1.21 | 스토캐스틱 오실레이터 | 기술적 분석 — 모멘텀 |
| 3.1.22 | 스토캐스틱 RSI | 기술적 분석 — 모멘텀 |
| 3.1.23 | CCI (상품채널지수) | 기술적 분석 — 모멘텀 |
| 3.1.24 | ADX / +DI / -DI | 기술적 분석 — Wilder |
| 3.1.25 | 윌리엄스 %R | 기술적 분석 — 모멘텀 |
| 3.1.26 | 틸-센 추정량 | 통계학 — 강건 추정 |
| 3.1.27 | EWMA 변동성 | 금융학 — 변동성 |
| 3.1.28 | 변동성 국면 분류 | 금융학 — 변동성 |
| 3.1.29 | Amihud 비유동성 | 시장미시구조 |
| 3.1.30 | 온라인 CUSUM | 통계학 — 품질관리 |
| 3.1.31 | 이진 세분화 | 통계학 — 구조변화 |
| 3.1.32 | HAR-RV | 금융학 — 변동성 예측 |


<!-- newpage -->

### 3.1.1 단순이동평균 (Simple Moving Average, SMA)
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
|:----:|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가  |
| $n$ | SMA 기간  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 수정종가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 산술 평균 평활 | `js/indicators.js` `calcMA(data, n)` L.15 | 가격 추세 추출 |
| 표준 기간 5/20/60 | 상수 [A] | S-1, S-2, BB 중심선 |

> 소비자: 신호 S-1 (이동평균 교차), S-2 (이동평균 정렬), 스토캐스틱 %D 평활,
CCI 평균편차, 복합 신호.

> 참조: 제2장 2.3절 (통계학적 기초).

<!-- newpage -->

### 3.1.2 지수이동평균 (Exponential Moving Average, EMA)
지수이동평균(EMA)은 통계학의 시계열 평활 이론에서 기원한다. Brown (1956)의
"Exponential Smoothing for Predicting Demand"가 지수 평활의 기초를 놓았으며,
Holt (1957)이 이를 일반화하고, Hunter (1986)가 EWMA 해석을 제시하였다.

EMA는 과거 관측치에 기하급수적으로 감소하는 가중치를 부여하여, SMA 대비
최근 가격 변화에 더 민감하게 반응한다. 이 민감성은 MACD에서 핵심적인데,
MACD는 빠른 EMA와 느린 EMA의 차이를 통해 모멘텀 이동을 감지하기 때문이다.
$$EMA_t = \alpha \cdot P_t + (1 - \alpha) \cdot EMA_{t-1}, \quad \alpha = \frac{2}{n + 1}$$

초기화:
$$EMA_0 = SMA(\text{최초 } n \text{개 관측치})$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가  |
| $\alpha$ | 평활 계수 $= 2/(n+1)$  |
| $n$ | EMA 기간  |
| $EMA_{t-1}$ | 이전 EMA 값  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 수정종가이다. null/NaN 방어를 포함한 SMA 초기화 적용 (P0-3 수정).

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 지수 평활 | `js/indicators.js` `calcEMA(data, n)` L.26 | MACD, EWMA Vol |
| MACD 기본값 | n = 12, 26 [A], sig = 9 [A] | Appel (1979) 표준 |

> 소비자: MACD, EWMA 변동성, 변동성 국면 장기 EMA.

> 참조: 제2장 2.2절 (수학적 기초).

<!-- newpage -->

### 3.1.3 볼린저 밴드 (Bollinger Bands, BB)
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
|:----:|------|
| $\textcolor{stageOneMarker}{P_i}$ | 종가 배열  |
| $n$ | SMA 기간 (20)  |
| $k$ | 시그마 배수 (2.0)  |
| $\sigma_{\text{pop}}$ | 모집단 표준편차  |
| $EVT\ \hat{\alpha}$ | Hill 꼬리지수  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{P_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 시계열이다.

> 학문 분류: 통계학(기술통계 → 정규분포 신뢰구간) + 극단값 이론(EVT 보정).
> 베셀 보정을 적용하지 않는 것은 Bollinger (2001) 원저의 의도적 선택이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 표준편차 밴드 | `js/indicators.js` `calcBB(closes, n, mult)` L.50 | 가격 외피 |
| 모집단 시그마 | n=20, mult=2.0 [A] | Bollinger (2001) 원본 |

> 소비자: 신호 S-7 (BB 반등/돌파/스퀴즈), 복합 신호
(buy_hammerBBVol, sell_shootingStarBBVol), EVT 보정 확장 (I-3E).

> 참조: 제2장 2.3절 (통계학).


<!-- newpage -->

### 3.1.4 EVT 보정 볼린저 밴드 (EVT-Adjusted Bollinger Bands)
극단값 이론(EVT)에 기반한 꼬리 보정 밴드이다. Gopikrishnan et al. (1999)의
역세제곱 법칙과 Hill (1975)의 꼬리지수 추정에 근거한다. 금융 수익률은
두꺼운 꼬리($\alpha$가 KRX 종목에서 통상 3~5)를 보인다. 표준 2시그마
밴드는 정규성을 가정하므로, EVT 보정 밴드는 실제 꼬리 확률을 반영하도록
확장되어 허위 돌파 신호를 줄인다.
$$\text{EVT\_mult} = \begin{cases} k \cdot (1 + 0.45 \cdot (4 - \hat{\alpha})) & \hat{\alpha} < 4 \text{ (두꺼운 꼬리)} \\ k & \text{그 외 (표준 볼린저)} \end{cases}$$

| 기호 | 의미  |
|:----:|------|
| $k$ | 볼린저 시그마 배수 (2.0)  |
| $\hat{\alpha}$ | 힐 꼬리지수 추정량  |
| $0.45$ | EVT 보정 계수  |

> 이전 Stage 데이터: $\hat{\alpha}$는 힐 꼬리 추정량(Hill 1975)의 산출물이며, 힐 추정량 자체는 $\textcolor{stageOneMarker}{OHLCV}$ 수익률(Stage 1)로부터 도출된다. $k$는 볼린저 밴드에서 계승한 상수이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 꼬리 보정 밴드 | `js/indicators.js` `IndicatorCache.bbEVT()` (지연 평가) | 극단 사건 필터 |
| 0.45 계수 | 상수 [D] | 정확한 분위수 매핑이 아닌 경험적 값 |

> 참조: 제2장 2.3.2절 (극단값 이론).

이상의 통계학적 기초 지표 4종(SMA, EMA, BB, EVT-BB)에 이어, 기술적 분석 실무에서 발전한 지표들을 다음에 다룬다.


<!-- newpage -->

### 3.1.5 RSI (Relative Strength Index, 상대강도지수)
RSI는 기술적 분석의 모멘텀 오실레이터 계열로, Wilder (1978)
*New Concepts in Technical Trading Systems*에서 창안되었다. RSI는 방향성
가격 움직임의 속도와 크기를 측정하여 0~100으로 진동한다. 70 이상은
과매수(매도 압력 축적), 30 이하는 과매도(매수 기회)를 나타낸다.
심리학적으로 RSI는 공포-탐욕 스펙트럼에 대응한다 (제2장 2.7절).
$$RS = \frac{AvgGain(n)}{AvgLoss(n)}, \quad RSI = 100 - \frac{100}{1 + RS}$$

와일더 평활:
$$AvgGain_t = \frac{AvgGain_{t-1} \cdot (n-1) + Gain_t}{n}$$
이는 $\alpha = 1/n$인 지수이동평균과 동치이다.

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 배열  |
| $n$ | RSI 기간 (14)  |
| $AvgGain$, $AvgLoss$ | 와일더 평활 평균  |
| $70 / 30$ | 과매수/과매도 경계  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder RSI | `js/indicators.js` `calcRSI(closes, period)` L.63 | 과매수/과매도 |
| 표준 기간 14 | period = 14 [A] | Wilder (1978) 원본 |

> 소비자: 신호 S-5 (RSI 영역), S-6 (RSI 괴리), StochRSI,
복합 신호 (strongBuy_hammerRsiVolume, buy_bbBounceRsi 등).

> 참조: 제2장 2.7절 (심리학 --- 공포/탐욕 대리변수).


<!-- newpage -->

### 3.1.6 ATR (Average True Range, 평균진폭)
ATR은 Wilder (1978) *New Concepts in Technical Trading Systems*에서 창안된
변동성 측정 지표이다. ATR은 CheeseStock의 보편적 정규화 단위이다. 모든
패턴 임계값, 손절매, 목표가를 ATR 배수로 표현함으로써 가격 수준 독립성을
달성한다. 삼성전자(60,000원)와 1,000원 소형주의 패턴이 변동성 상대적으로
동일하게 평가되는 것이다. 이것이 패턴 엔진의 가장 핵심적 설계 결정이다.
$$TR_t = \max(H_t - L_t, \, |H_t - C_{t-1}|, \, |L_t - C_{t-1}|)$$
$$ATR_t = \frac{ATR_{t-1} \cdot (n-1) + TR_t}{n}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{H_t}$ | 당일 고가  |
| $\textcolor{stageOneMarker}{L_t}$ | 당일 저가  |
| $\textcolor{stageOneMarker}{C_{t-1}}$ | 전일 종가  |
| $n$ | ATR 기간 (14)  |
| 폴백 0.02 | ATR 불가 시 대체 비율  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{H_t, L_t, C_{t-1}}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder ATR | `js/indicators.js` `calcATR(candles, period)` L.87 | 보편 정규화 단위 |
| 폴백 규칙 | `close * 0.02` [C]; `ATR_FALLBACK_BY_TF` | 시간대별 적응 |

> 소비자: 모든 패턴 감지, 모든 손절/목표 산출, 지지/저항 클러스터링 허용오차,
신뢰도 조정, OLS 추세 정규화.

> 참조: 제2장 2.3절 (통계학적 기초).


<!-- newpage -->

### 3.1.7 OBV (On-Balance Volume, 누적거래량)
OBV는 기술적 분석의 거래량 분석 계열로, Granville (1963) *New Key to Stock
Market Profits*에서 창안되었다. Murphy (1999) Ch. 7에서 재체계화되었다.
Granville의 핵심 가설은 "거래량이 가격에 선행한다"는 것이다. OBV는 가격
방향으로 거래량을 누적하여, 축적(스마트 머니 매수)이나 분배(스마트 머니
매도)가 가격 반응보다 먼저 나타나는 것을 드러낸다. OBV 추세와 가격 추세
간의 괴리(divergence)는 행동재무학 문헌에서 가장 신뢰도 높은 선행 지표
중 하나이다 (Barber-Odean 2008 관심 이론, 제2장 2.7절).
$$OBV_t = \begin{cases} OBV_{t-1} + V_t & C_t > C_{t-1} \\ OBV_{t-1} - V_t & C_t < C_{t-1} \\ OBV_{t-1} & C_t = C_{t-1} \end{cases}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{C_t}$ | 종가  |
| $\textcolor{stageOneMarker}{V_t}$ | 거래량  |
| $OBV_{t-1}$ | 이전 OBV 누적값  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{C_t, V_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 및 거래량이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Granville OBV | `js/indicators.js` `calcOBV(candles)` L.115 | 거래량 방향 분석 |
| 조정 상수 없음 | 순수 공식 | --- |

> 소비자: 신호 S-20 (OBV 괴리), 복합 신호 buy_volRegimeOBVAccumulation.

> 참조: 제2장 2.7절 (관심과 거래량 심리).


<!-- newpage -->

### 3.1.8 일목균형표 (Ichimoku Kinko Hyo)
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
|:----:|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t}$ | 고가, 저가, 종가  |
| $9, 26, 52$ | 전환선/기준선/선행B 기간  |
| $+26$ | 선행 이동 기간  |
| $-26$ | 후행 이동 기간  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{H_t, L_t, C_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 일목 5선 체계 | `js/indicators.js` `calcIchimoku(candles, conv, base, spanBPeriod, displacement)` L.135 | 추세/구름/확인 |
| 호소다 원본 상수 | conv=9, base=26, spanB=52, displacement=26 [A] | 표준 기간 |

> 소비자: 신호 S-8 (구름 돌파, TK 교차), 복합 신호
(buy_ichimokuTriple, sell_ichimokuTriple).

> 참조: 기술적 분석 전통 (제2장 범위 외). 호소다 고이치 (1969).


<!-- newpage -->

### 3.1.9 칼만 필터 (Kalman Filter)
칼만 필터는 수학/공학의 최적 제어 분야에서 발전한 상태 추정 기법이다.
Kalman (1960)이 기초를 놓았으며, Mohamed and Schwarz (1999)가 적응형 Q
확장을 INS/GPS 분야에서 제안하였다. 칼만 필터는 가우시안 잡음 가정 하에서
최적 상태 추정을 제공한다. 가격 시계열에 적용하면, 잡음-신호 비율에 따라
반응성을 자동 조절하는 평활 추정치를 산출한다. 이동평균(고정 시차)과 달리
칼만 이득 $K$가 자동 조정된다. 높은 잡음 → 낮은 이득(더 많은 평활), 낮은
잡음 → 높은 이득(더 민감한 반응). 적응형 Q 확장은 변동성 국면에 추가적
민감도를 부여한다.
$$\hat{x}_t = \hat{x}_{t-1} + K_t(z_t - \hat{x}_{t-1}), \quad K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}$$

적응형 Q:
$$Q_t = Q_{\text{base}} \times \frac{ewmaVar_t}{meanVar}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{z_t}$ | 관측값 (종가)  |
| $\hat{x}_t$ | 추정 상태 (필터링된 가격)  |
| $K_t$ | 칼만 이득  |
| $P_{t|t-1}$ | 사전 오차 공분산  |
| $Q$ | 프로세스 노이즈 (0.01)  |
| $R$ | 관측 노이즈 (1.0)  |
| $ewmaAlpha$ | EWMA 평활 계수 (0.06)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{z_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 적응형 칼만 | `js/indicators.js` `calcKalman(closes, Q, R)` L.170 | 적응 평활 |
| 프로세스/관측 노이즈 | Q=0.01, R=1.0, ewmaAlpha=0.06 [B] | 자동 조정 |

> 소비자: 신호 S-12 (칼만 전환 --- 기울기 방향 전환).

> 참조: 제2장 2.2.6절 (최적 제어).


<!-- newpage -->

### 3.1.10 허스트 지수 (Hurst Exponent, R/S Analysis)
허스트 지수는 물리학/프랙탈 분야의 장기 의존성 이론에 근거한다.
Mandelbrot (1963)이 금융시장에의 적용을 처음 제안하였으며, Peters (1994)
*Fractal Market Analysis* Ch. 4에서 체계화하였다. Mandelbrot and Wallis
(1969)가 R/S 관례를 확립하였다.

$H > 0.5$는 추세 지속성(모멘텀 국면), $H < 0.5$는 평균회귀,
$H = 0.5$는 랜덤워크를 나타낸다. 이는 현재 국면에서 추세추종 전략과
평균회귀 전략 중 어느 것이 성공할 가능성이 높은지를 직접 알려준다.
R/S는 수익률(정상 과정)로 계산해야 하며, 가격 수준(I(1))으로 계산하면
$H$가 ~0.4만큼 상향 편향된다.

$$r_t = \ln(P_{t+1} / P_t)$$

$$R/S(w) = \frac{\max(\text{cumDev}) - \min(\text{cumDev})}{S_w}$$

$$\log(R/S) = H \cdot \log(w) + c$$

가격을 로그수익률 $r_t$로 변환한 뒤, 기하급수 윈도우 $w = [minWindow,\; 1.5w,\; 2.25w,\; \ldots]$에 대해 블록별 조정 범위 $R/S$를 산출하고, $\log$-$\log$ 회귀의 기울기로 $H$를 추정한다.

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 시계열  |
| $r_t$ | 로그수익률  |
| $w$ | 윈도우 크기  |
| $R/S$ | 조정 범위 / 표준편차  |
| $H$ | 허스트 지수  |
| $minWindow$ | 최소 윈도우 (10)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다. Mandelbrot-Wallis (1969)에 따른 모집단 시그마 적용. S=0 블록 제외 (M-9 수정).

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| R/S 분석 | `js/indicators.js` `calcHurst(closes, minWindow)` L.212 | 국면 분류 |
| $R^2$ 보고 | `calcHurst()` `.rSquared` (L.264 반환) | 추정 신뢰도 |

> 소비자: 신호 S-11 (허스트 국면: H > 0.6 추세, H < 0.4 평균회귀).

> 참조: 제2장 2.2.4절 (프랙탈 수학), 2.1절 (경제물리학).


<!-- newpage -->

### 3.1.11 힐 꼬리 추정량 (Hill Tail Estimator)
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
|:----:|------|
| $\textcolor{stageOneMarker}{X_{(i)}}$ | 절대수익률 순서통계량  |
| $k$ | 상위 순서통계량 개수 $\lfloor\sqrt{n}\rfloor$  |
| $\hat{\alpha}$ | 꼬리지수 추정값  |
| $SE$ | 추정량 표준오차  |
| 최소 $n$ | 최소 관측 수 (10)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{X_{(i)}}$는 Stage 1의 OHLCV 데이터로부터 산출된 절대수익률 순서통계량이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Hill 추정 | `js/indicators.js` `calcHillEstimator(returns, k)` L.276 | 꼬리 두께 측정 |
| Drees-Kaufmann k | 최소 n=10 [A], k=floor(sqrt(n)) [A] | 자동 k 선택 |

> 소비자: I-3E (EVT 볼린저), 백테스터 꼬리위험 평가.

> 참조: 제2장 2.3.2절 (극단값 이론).


<!-- newpage -->

### 3.1.12 GPD 꼬리 적합 (Generalized Pareto Distribution)
GPD는 통계학의 극단값 이론(EVT) 중 임계값 초과(Peaks Over Threshold, POT)
접근법에 해당한다. Pickands (1975)와 Balkema-de Haan (1974)이 이론적 토대를
놓았으며, Hosking and Wallis (1987)가 확률가중적률(PWM) 추정법을 제안하였다.
GPD는 이론적으로 정당화된 극단 위험 분위수를 제공한다. 표준 VaR은 정규성을
가정하지만, GPD 기반 VaR은 KRX 수익률의 실제 꼬리 행태
($\alpha \sim 3$--$4$, 스튜던트-t 유사)를 포착한다.
임계값: $u$ = 절대수익률 상위 5%, 초과량: $y_i = |r_i| - u$

$$PWM: \quad b_0 = \bar{y}, \quad b_1 = \overline{y \cdot rank/(N_u-1)}$$

$$\hat{\xi} = 2 - \frac{b_0}{b_0 - 2b_1}, \quad \hat{\sigma} = \frac{2b_0 b_1}{b_0 - 2b_1}$$

$$VaR_p = u + \frac{\sigma}{\xi}\left[\left(\frac{n}{N_u}(1-p)\right)^{-\xi} - 1\right]$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{r_i}$ | 수익률 시계열  |
| $u$ | POT 임계값 (상위 5%)  |
| $y_i$ | 초과량  |
| $\hat{\xi}$ | 형상 모수 (< 0.499 제한)  |
| $\hat{\sigma}$ | 스케일 모수  |
| $p$ | 분위수 (0.99)  |
| 최소 $n$ | 최소 관측 수 (500)  |
| 최소 초과 | 최소 초과 관측 수 (20)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{r_i}$는 Stage 1의 OHLCV 데이터로부터 산출된 수익률 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| POT-GPD | `js/indicators.js` `calcGPDFit(returns, quantile)` L.323 | 극단 VaR |
| PWM 추정 | quantile=0.99 [A], 임계=상위 5% [B] | 꼬리 확률 산출 |

> 소비자: EVT 기반 손절매 최적화 (백테스터).

> 참조: 제2장 §2.3.2 (극단값 이론 — GEV, GPD, Hill 추정량).
> 참조: 제2장 극단값이론(EVT), 최대우도추정(MLE)


<!-- newpage -->

### 3.1.13 CAPM 베타 (Capital Asset Pricing Model Beta)
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

Scholes-Williams 보정:
$$\beta_{SW} = \frac{\beta_{-1} + \beta_0 + \beta_{+1}}{1 + 2\rho_m}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{R_i}$ | 개별 종목 수익률  |
| $\textcolor{stageOneMarker}{R_m}$ | 시장(KOSPI/KOSDAQ) 수익률  |
| $\textcolor{stageTwoMarker}{R_f}$ | 무위험 이자율  |
| $\beta$ | 체계적 위험  |
| $\alpha$ | 젠센 알파 (초과수익)  |
| $window$ | 추정 윈도우 (250)  |
| 최소 관측 | 60  |
| 비유동성 임계 | 10% 무거래일  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{R_i, R_m}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가/시장지수이다. $\textcolor{stageTwoMarker}{R_f}$는 제2장 2.6.3절 CAPM 이론의 무위험 이자율 개념이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| CAPM + S-W 보정 | `js/indicators.js` `calcCAPMBeta(stockCloses, marketCloses, window, rfAnnual)` L.391 | 체계적 위험 |
| 비유동성 보정 | 10% 무거래일 임계 [C] | Scholes-Williams 자동 적용 |

> 소비자: 백테스터 B-6 (젠센 알파), 재무 패널 표시, 베타 로드 함수.

> 참조: 제2장 2.6.3절 (CAPM).


<!-- newpage -->

### 3.1.14 역사적 변동성 (Historical Volatility, Parkinson)
Parkinson (1980)이 제안한 범위 기반 변동성 추정량이다. 종가-종가 변동성
대비 약 5배 효율적이다. 고가-저가 범위는 종가-종가 변동성이 놓치는 장중
가격 변동을 포착한다. Parkinson 추정량은 통계적으로 더 효율적(동일 표본
크기에서 낮은 분산)이어서, VRP 산출에 보다 정확한 실현 변동성
추정치를 제공한다.
$$HV_{\text{daily}} = \sqrt{\frac{1}{4n\ln 2} \sum [\ln(H_i/L_i)]^2}$$
$$HV_{\text{annual}} = HV_{\text{daily}} \times \sqrt{\text{KRX\_TRADING\_DAYS}}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{H_i, L_i}$ | 고가, 저가  |
| $n$ | 추정 기간 (20)  |
| $\sqrt{250}$ | 연율화 계수  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{H_i, L_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV의 고가/저가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Parkinson HV | `js/indicators.js` `calcHV(candles, period)` L.492 | 실현 변동성 |
| 연율화 | period=20 [B], sqrt(250) | KRX 관례 적용 |

> 소비자: VRP, 변동성 국면 분류.

> 참조: 제2장 §2.3.1 (GARCH/EWMA 변동성 — 범위 기반 추정량).


<!-- newpage -->

### 3.1.15 VRP (Variance Risk Premium, 분산 위험 프리미엄)
VRP는 금융학/파생상품 분야의 변동성 위험 프리미엄 개념이다.
Bollerslev (2009) "Expected Stock Returns and Variance Risk Premia"에서
체계화되었다. 양(+)의 VRP는 옵션 시장이 실현보다 높은 변동성을 가격에
반영한다는 것을 의미하며, 불확실성 고조와 변동성 압축(평균회귀)이 임박했을
수 있다. 음(-)의 VRP는 옵션이 저평가되어 변동성 확장이 예상된다.
$$VRP = \sigma_{IV}^2 - \sigma_{RV}^2 = (VKOSPI/100)^2 - HV_{\text{Parkinson}}^2$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{VKOSPI}$ | 내재변동성 지수  |
| $HV_{\text{Parkinson}}$ | 실현 변동성  |
| $VRP$ | 분산 위험 프리미엄  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{VKOSPI}$는 Stage 1 데이터 계층에서 수집된 VKOSPI 내재변동성 지수이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Bollerslev VRP | `js/indicators.js` `calcVRP(vkospi, hvAnnualized)` L.536 | 변동성 프리미엄 |
| 조정 상수 없음 | 단위 변환 포함 순수 공식 | --- |

> 소비자: 신뢰도 요인 F8, RORO 요인 R1 (VKOSPI 경유).

> 참조: 제2장 2.6.11절 (파생상품 이론).


<!-- newpage -->

### 3.1.16 WLS 회귀 (Weighted Least Squares with Ridge, 릿지 포함)

이하 4개 지표는 차트에 직접 표시되지 않는 백테스터 인프라 지표이다.

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
|:----:|------|
| $X$ | 설계 행렬 (품질, 추세, 거래량, 변동성)  |
| $y$ | 반응 변수 (수익률)  |
| $W$ | 대각 가중 행렬 (지수 감쇠)  |
| $\lambda$ | 릿지 벌점  |
| $\hat{\beta}$ | 회귀 계수 벡터  |
| 최소 $n$ | $p+2$ 관측  |

> 이전 Stage 데이터: $X$의 각 열은 선행 지표들의 산출물로부터 구성되며, $\textcolor{stageOneMarker}{y}$는 \textcolor{stageOneMarker}{Stage 1} 가격 데이터로부터 산출된 수익률이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 릿지 WLS | `js/indicators.js` `calcWLSRegression(X, y, weights, ridgeLambda)` L.558 | 수익 예측 |
| GCV 람다 | GCV 자동 선택 | 정규화 최적화 |

> 소비자: 백테스터 WLS 회귀 예측, OLS 추세선.

> 참조: 제2장 2.2.5절 (선형대수와 릿지 회귀), 2.3.3절 (강건 회귀).

<!-- newpage -->

### 3.1.17 HC3 강건 표준오차 (Heteroscedasticity-Consistent Standard Errors)
HC3 강건 표준오차는 통계학의 이분산-일치 추정 분야에 해당한다.
White (1980)이 원래의 HC0 추정량을 제안하였으며, MacKinnon and White (1985)가
HC3 변형을 개선하였다. HC3은 HC0(White 원본) 대비 선호되며, $(1-h_{ii})^2$
스케일링이 고지렛점 관측치에서의 오차분산 과소추정을 보정한다. 지렛점
상한: 0.99로 제한 (수치적 안정성).
$$\hat{V}_{HC3}(\hat{\beta}) = (X'WX)^{-1} \left[\sum_i w_i^2 \frac{\hat{e}_i^2}{(1 - h_{ii})^2} x_i x_i' \right] (X'WX)^{-1}$$

| 기호 | 의미  |
|:----:|------|
| $h_{ii}$ | 지렛점(hat matrix 대각 원소)  |
| $\hat{e}_i$ | 잔차  |
| $0.99$ | 지렛점 상한  |

> 이전 Stage 데이터: $h_{ii}$와 $\hat{e}_i$는 WLS 회귀의 산출물이다. WLS의 설계행렬 $X$와 가중행렬 $W$는 $\textcolor{stageOneMarker}{OHLCV}$ 기반 피처(품질, 추세, 거래량비, 변동성비)로 구성되며, 릿지 정규화의 이론적 기초는 $\textcolor{stageTwoMarker}{\text{Ridge}}$ (제2장 2.2.5절)에서 도출된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| HC3 보정 | `js/indicators.js` `calcWLSRegression()` (L.558) 내부 HC3 샌드위치 추정 | t-통계량 산출 |

> 소비자: 백테스터 WLS 계수의 t-통계량.

> 참조: 제2장 2.3.3절 (강건 회귀 — HC3 표준오차).

<!-- newpage -->

### 3.1.18 GCV 람다 선택 (Generalized Cross-Validation)
GCV는 통계학의 모형 선택 분야에서 발전한 정규화 모수 선택 기법이다.
Golub, Heath, and Wahba (1979)가 제안하였다. 릿지 회귀의 최적 벌점 $\lambda$를
데이터 주도적으로 선택하여 과적합과 과소적합 사이의 균형을 달성한다.
$$GCV(\lambda) = \frac{RSS(\lambda)/n}{(1 - tr(H_\lambda)/n)^2}, \quad \lambda^* = \arg\min_{\lambda} GCV(\lambda)$$

그리드: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0].
평탄성 검사: GCV 변동 < 1%이면 기본값 $\lambda = 1.0$.

야코비 고유분해를 사용하여 효율적 트레이스 계산.

| 기호 | 의미  |
|:----:|------|
| $RSS(\lambda)$ | 잔차 제곱합  |
| $H_\lambda$ | 영향력 행렬 (hat matrix)  |
| $\lambda$ | 릿지 벌점 후보  |
| $n$ | 관측 수  |

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| GCV 선택 | `js/indicators.js` `selectRidgeLambdaGCV(X, y, w, p)` L.826 | 최적 $\lambda$ |
| 야코비 고유분해 | GCV 내부 | 효율적 트레이스 |

> 이전 Stage 데이터: 설계행렬 $X$, 반응변수 $y$, 가중치 $w$는 Stage 1 OHLCV에서 파생된 지표 시계열로부터 구성된다.

> 소비자: WLS 회귀 최적 릿지 벌점 자동 선택, 백테스터 WLS 예측.

> 참조: 제2장 2.2.5절 (선형대수와 릿지 회귀), 2.3.3절 (강건 회귀).


<!-- newpage -->

### 3.1.19 OLS 추세선 (Ordinary Least Squares Trend)
OLS 추세선은 통계학의 회귀분석에서 가장 기본적인 추세 감지 도구이다.
Lo and MacKinlay (1999)는 $R^2 > 0.15$이면 추세가 존재하고,
$> 0.50$이면 강한 추세로 판단할 수 있다고 하였다. ATR(14) 정규화된
기울기(slopeNorm)를 사용하여 가격 수준 독립적 추세 강도를 산출한다.
$$P_t = a + bt + \varepsilon, \quad slopeNorm = b / ATR(14)$$

direction = 'up' if slopeNorm > 0.05, 'down' if < -0.05, 'flat' 그 외.

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가  |
| $b$ | 회귀 기울기  |
| $ATR(14)$ | 평균진폭 (Wilder 1978)  |
| $slopeNorm$ | 정규화 기울기  |
| $window$ | 추정 윈도우 (20)  |
| $0.05$ | 방향 판단 임계값  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| OLS 추세 | `js/indicators.js` `calcOLSTrend(closes, window, atr14Last)` L.912 | 추세 감지 |
| 방향 분류 | window=20 [B], slopeNorm 임계=0.05 [D] | up/down/flat |

> 소비자: 패턴 신뢰도 조정 (추세 국면 분류), 백테스터 정규화.

> 참조: 제2장 §2.2.5 (선형대수와 회귀), §2.3.3 (강건 회귀 — OLS는 WLS/Ridge의 기초).


<!-- newpage -->

### 3.1.20 MACD (Moving Average Convergence Divergence, 이동평균수렴확산)
MACD는 기술적 분석의 모멘텀 지표로, Appel (1979)
*The Moving Average Convergence-Divergence Trading Method*에서 창안되었다.
MACD는 두 EMA의 수렴과 발산을 통해 모멘텀을 포착한다. MACD 선이 시그널 선을
상향 교차(강세 교차)하면 모멘텀이 상승으로 전환되고, 하향 교차(약세 교차)하면
하락으로 전환된다. 히스토그램은 모멘텀 변화의 속도를 시각화한다.
$$\text{MACD Line} = EMA(12) - EMA(26)$$
$$\text{Signal Line} = EMA(9, \text{MACD Line})$$
$$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{P_t}$ | 종가 배열  |
| $fast$ | 빠른 EMA 기간 (12)  |
| $slow$ | 느린 EMA 기간 (26)  |
| $sig$ | 시그널 EMA 기간 (9)  |
| $EMA(n)$ | 지수이동평균  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{P_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가이다.

> 의존 체인: OHLCV close → calcEMA(12) → calcEMA(26) → MACD Line →
> calcEMA(9, MACD) → Signal Line → Histogram → 신호 S-3, S-4.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Appel MACD | `js/indicators.js` `calcMACD(closes, fast, slow, sig)` L.993 | 모멘텀 교차 |
| 표준 파라미터 | fast=12, slow=26, sig=9 [A] | Appel 원본 |

> 소비자: 신호 S-3 (MACD 교차), S-4 (MACD 괴리), 복합 신호.

> 참조: 기술적 분석 전통 (제2장 범위 외). Appel (1979).


<!-- newpage -->

### 3.1.21 스토캐스틱 오실레이터 (Stochastic Oscillator)
스토캐스틱 오실레이터는 기술적 분석의 모멘텀 계열로, Lane (1984)
"Lane's Stochastics"에서 창안되었다. 현재 종가의 최근 $k$ 기간
고가-저가 범위 내 상대 위치를 측정하여, 가격이 범위의 상단에서
마감하는 경향(상승 추세)과 하단에서 마감하는 경향(하락 추세)을 포착한다.
$$Raw\ \%K = \frac{Close - LL(k)}{HH(k) - LL(k)} \times 100$$
$$\%K = SMA(Raw\ \%K, smooth), \quad \%D = SMA(\%K, dPeriod)$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{Close, H, L}$ | 종가, 고가, 저가  |
| $k$ | 룩백 기간 (14)  |
| $smooth$ | %K 평활 기간 (3)  |
| $dPeriod$ | %D 기간 (3)  |
| $LL(k)$, $HH(k)$ | 최근 $k$봉 최저가/최고가  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{Close, H, L}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Lane 스토캐스틱 | `js/indicators.js` `calcStochastic(candles, kPeriod, dPeriod, smooth)` L.1028 | 상대 위치 |
| 표준 파라미터 | kPeriod=14, dPeriod=3, smooth=3 [A] | Lane 원본 |

> 소비자: 신호 S-10, 복합 buy_wrStochOversold.

> 참조: 기술적 분석 전통 (제2장 범위 외). Lane (1984).


<!-- newpage -->

### 3.1.22 스토캐스틱 RSI (Stochastic RSI)
스토캐스틱 RSI는 기술적 분석의 복합 오실레이터 계열로, Chande and Kroll
(1994) *The New Technical Trader*에서 창안되었다. RSI에 스토캐스틱 공식을
적용한 것으로, RSI의 과매수/과매도 영역 내에서도 더 세밀한 타이밍 신호를
제공한다. RSI 자체가 0~100 범위로 제한되므로, 이를 스토캐스틱으로 재정규화하면
더 민감한 극단 감지가 가능해진다.
$$StochRSI = \frac{RSI - LL(RSI, n)}{HH(RSI, n) - LL(RSI, n)}$$

| 기호 | 의미  |
|:----:|------|
| $RSI$ | 상대강도지수 (Wilder 1978)  |
| $n$ | 스토캐스틱 기간 (14)  |
| $rsiPeriod$ | RSI 기간 (14)  |
| $kPeriod$, $dPeriod$ | %K, %D 기간 (3, 3)  |

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Chande-Kroll | `js/indicators.js` `calcStochRSI(...)` L.1085 | 극단 감지 |
| 표준 파라미터 | rsiPeriod=14, kPeriod=3, dPeriod=3, stochPeriod=14 [A] | Chande-Kroll 원본 |

> 소비자: 신호 S-9 (StochRSI 과매도/과매수), RSI 중립대 보조 타이밍.

> 참조: 제2장 2.7절 (행동재무학 --- 공포/탐욕 극단 감지).


<!-- newpage -->

### 3.1.23 CCI (Commodity Channel Index, 상품채널지수)
CCI는 기술적 분석의 편차 기반 오실레이터 계열로, Lambert (1980)
"Commodity Channel Index"에서 창안되었다. 전형가(Typical Price)의
이동평균 대비 편차를 측정하며, 상수 0.015는 CCI 값의 ~70~80%가
-100~+100 사이에 위치하도록 보장한다.
$$TP = \frac{High + Low + Close}{3}, \quad CCI = \frac{TP - SMA(TP, n)}{0.015 \times MeanDev}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{High, Low, Close}$ | 고가, 저가, 종가  |
| $n$ | CCI 기간 (20)  |
| $0.015$ | 정규화 상수  |
| $TP$ | 전형가  |
| $MeanDev$ | 평균편차  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{High, Low, Close}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Lambert CCI | `js/indicators.js` `calcCCI(candles, period)` L.1158 | 편차 오실레이터 |
| 표준 파라미터 | period=20 [A], 0.015 [A] | Lambert 원본 |

> 소비자: 신호 S-13, 복합 buy_cciRsiDoubleOversold.

> 참조: 기술적 분석 전통 (제2장 범위 외). Lambert (1980).


<!-- newpage -->

### 3.1.24 ADX / +DI / -DI (Average Directional Index)
ADX는 기술적 분석의 추세 강도 측정 계열로, Wilder (1978)의 방향성 움직임
시스템(Directional Movement System)에서 창안되었다. ADX는 추세의
강도(방향이 아님)를 측정한다. ADX > 25는 강한 추세, ADX < 20은 횡보장을
나타낸다. 추세추종 패턴은 ADX > 20일 때 더 높은 신뢰도를 받는다.
$$ADX = Wilder\_Smooth(DX, n), \quad DX = \frac{|+DI - (-DI)|}{+DI + (-DI)} \times 100$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t}$ | 고가, 저가, 종가  |
| $n$ | ADX 기간 (14)  |
| $+DI$, $-DI$ | 양/음 방향지수  |
| $DX$ | 방향 지수  |
| $ADX$ | 평균 방향 지수  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{H_t, L_t, C_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Wilder DMS | `js/indicators.js` `calcADX(candles, period)` L.1187 | 추세 강도 |
| 표준 기간 14 | period=14 [A] | Wilder 원본 |

> 소비자: 신호 S-14, 복합 buy_adxGoldenTrend, sell_adxDeadTrend.

> 참조: 기술적 분석 전통 (제2장 범위 외). Wilder (1978).


<!-- newpage -->

### 3.1.25 윌리엄스 %R (Williams Percent Range)
Williams %R은 기술적 분석의 모멘텀 오실레이터 계열로, Williams (1979)
*How I Made One Million Dollars*에서 소개되었다. 범위는
-100(과매도)~0(과매수)이다. 스토캐스틱 오실레이터와 구조적으로 동일하나
스케일이 반전되어 있다.
$$\%R = \frac{HH(n) - Close}{HH(n) - LL(n)} \times (-100)$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{Close, H, L}$ | 종가, 고가, 저가  |
| $n$ | 룩백 기간 (14)  |
| $HH(n)$, $LL(n)$ | 최근 $n$봉 최고가/최저가  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{Close, H, L}$은 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Williams %R | `js/indicators.js` `calcWilliamsR(candles, period)` L.1262 | 과매도/과매수 |
| 표준 기간 14 | period=14 [A] | Williams 원본 |

> 소비자: 신호 S-15 (Williams %R 과매도/과매수), 복합 buy_wrStochOversold, sell_wrStochOverbought.

> 참조: 제2장 2.7절 (행동재무학 --- 모멘텀 오실레이터 심리적 극단).


<!-- newpage -->

### 3.1.26 틸-센 추정량 (Theil-Sen Estimator)
틸-센 추정량은 강건 통계학의 비모수 회귀 분야에서 발전한 중앙값 기울기
추정 기법이다. Theil (1950)과 Sen (1968)이 제안하였다. 29.3%의
붕괴점(breakdown point)으로, 데이터의 29.3%까지 이상치가 존재해도 추정이
파괴되지 않는다. 삼각형, 쐐기형 등의 추세선 적합에서 스파이크 캔들에 의한
OLS 왜곡을 방지한다. 캔들 목표가 교정(ATR 배수)에도 사용된다.
$$slope = \text{median}\left\{\frac{y_j - y_i}{x_j - x_i} : i < j\right\}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{y_i}$ | 가격 관측치 (고가 또는 저가)  |
| $x_i$ | 시간 인덱스  |
| $slope$ | 중앙값 기울기  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{y_i}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV의 고가 또는 저가이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 강건 중앙값 기울기 | `js/indicators.js` `calcTheilSen(xValues, yValues)` L.1287 | 추세선 적합 |
| 조정 상수 없음 | 순수 중앙값 계산 | --- |

> 소비자: 패턴 추세선 적합 (삼각형, 쐐기형, 채널), 캔들 목표가 교정.

> 참조: 제2장 2.3.3절 (강건 회귀 --- Theil 1950, Sen 1968).


<!-- newpage -->

### 3.1.27 EWMA 변동성 (Exponentially Weighted Moving Average Volatility)
EWMA 변동성은 금융학/위험 관리 분야의 조건부 변동성 모형이다. J.P. Morgan
RiskMetrics (1996)에서 실무 표준으로 확립되었으며, Bollerslev (1986)의
GARCH(1,1)와 이론적 연결을 갖는다. IGARCH의 특수 경우($\omega=0$,
$\alpha+\beta=1$)이며, 통계역학의 "시장 온도" 개념의 직접적 조작화이다.
$$\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1-\lambda) \cdot r_{t-1}^2$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률  |
| $\sigma_t^2$ | 조건부 분산  |
| $\lambda$ | 감쇠 계수 (0.94)  |
| $\textcolor{stageTwoMarker}{\text{GARCH}}$ | 일반화 조건부 이분산 모형  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다. $\textcolor{stageTwoMarker}{\text{GARCH}}$ 이론 체계는 제2장 2.3절에서 도출된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| RiskMetrics EWMA | `js/indicators.js` `calcEWMAVol(closes, lambda)` L.1336 | 조건부 변동성 |
| 감쇠 계수 | lambda=0.94 [B] | RiskMetrics 일별 기본값 |

> 소비자: 변동성 국면 분류, RORO 복합.

> 참조: 제2장 2.3.1절 (GARCH/EWMA 변동성).

<!-- newpage -->

### 3.1.28 변동성 국면 분류 (Volatility Regime Classification)
변동성 국면 분류는 금융학의 국면 전환 이론에 기반한 변동성 비율 분류기이다.
단기 EWMA 변동성과 장기 EWMA의 비율로 현재 시장 국면을 저변동/중변동/고변동으로
분류한다. 국면에 따라 패턴 신뢰도 조정, 전략 선택, 리스크 관리 파라미터가
달라진다.
$$ratio = \sigma_t / longRunEMA, \quad \text{국면} = \begin{cases} \text{'low'} & ratio < 0.75 \\ \text{'high'} & ratio > 1.50 \\ \text{'mid'} & \text{그 외} \end{cases}$$

| 기호 | 의미  |
|:----:|------|
| $\sigma_t$ | 단기 EWMA 변동성  |
| $longRunEMA$ | 장기 변동성 평활  |
| $0.75$ | 저변동성 경계  |
| $1.50$ | 고변동성 경계  |
| $\alpha$ | 장기 EMA 평활 계수 (0.01)  |

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 변동성 비율 분류 | `js/indicators.js` `classifyVolRegime(ewmaVol)` L.1385 | 국면 판별 |
| 경계값 | LOW=0.75 [D], HIGH=1.50 [D], alpha=0.01 [B] | 3-국면 체계 |

> 이전 Stage 데이터: EWMA 변동성은 Stage 1 OHLCV 로그수익률에서 산출된다(3.1.27절).

> 소비자: 패턴 신뢰도 국면 조정, CUSUM 적응형 임계값, 복합 buy_volRegimeOBVAccumulation.

> 참조: 제2장 2.3.1절 (GARCH/EWMA 변동성), 2.3.7절 (HMM 국면 분류).


<!-- newpage -->

### 3.1.29 Amihud 비유동성 (Amihud Illiquidity)
Amihud 비유동성은 시장미시구조 분야의 유동성 측정치이다. Amihud (2002)
"Illiquidity and Stock Returns"에서 제안되었다. 수익률 절대값 대비 거래금액의
비율로, 가격충격(price impact)의 대리변수이다. 높은 비유동성은 가격충격이
크다는 것을 의미하며, 패턴 신뢰도를 할인한다 (미시 요인 M1, 최대 -15%).
$$ILLIQ = \frac{1}{D} \sum_{t=1}^{D} \frac{|r_t|}{DVOL_t}$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률  |
| $\textcolor{stageOneMarker}{DVOL_t}$ | 일별 거래금액  |
| $D$ | 추정 윈도우 (20)  |
| $CONF\_DISCOUNT$ | 신뢰도 할인 하한 (0.85)  |
| $LOG\_HIGH$ | 로그 비유동성 상한 (-1.0)  |
| $LOG\_LOW$ | 로그 비유동성 하한 (-3.0)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{r_t, DVOL_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 종가 및 거래금액이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Amihud ILLIQ | `js/indicators.js` `calcAmihudILLIQ(candles, window)` L.1430 | 유동성 측정 |
| 미시 요인 M1 | window=20 [B], DISCOUNT=0.85 [C] | 신뢰도 할인 |

> 소비자: 미시 신뢰도 M1 (ILLIQ 기반 유동성 할인), 슬리피지 모형.

> 참조: 제2장 2.6.12절 (시장 미시구조), 2.5.12절 (수요-공급-탄력성).

<!-- newpage -->

### 3.1.30 온라인 CUSUM (Cumulative Sum Control Chart)
CUSUM은 통계학의 품질관리 및 순차분석 분야에서 발전한 변화점 감지 기법이다.
Page (1954)가 원래 CUSUM 차트를 제안하였으며, Roberts (1966)이 확장하였다.
CheeseStock에서는 변동성 적응형 임계값으로 확장하였다:
고변동성 → h=3.5, 저변동성 → h=1.5.
$$S_t^+ = \max(0, S_{t-1}^+ + r_t - k), \quad S_t^- = \max(0, S_{t-1}^- - r_t - k)$$

$S^+$ 또는 $S^-$가 임계 $h$를 초과하면 구조변화 감지.

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률  |
| $k$ | 여유(slack) 파라미터 (0.5)  |
| $h$ | 결정 임계값 (2.5, 적응형)  |
| $warmup$ | 워밍업 기간 (30)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 적응형 CUSUM | `js/indicators.js` `calcOnlineCUSUM(returns, threshold, volRegime)` L.1493 | 변화점 감지 |
| 변동성 적응 | threshold=2.5 [B], slack=0.5 [B], warmup=30 [B] | 국면별 임계 조정 |

> 소비자: 신호 S-17, 복합 buy_cusumKalmanTurn.

> 참조: 제2장 2.3.6절 (변화점 감지 — CUSUM과 이진 세분화).

<!-- newpage -->

### 3.1.31 이진 세분화 (Binary Segmentation)
이진 세분화는 통계학의 구조변화 감지 분야에서 발전한 BIC 기반 기법이다.
Bai and Perron (1998)이 다중 구조변화 검정의 이론적 토대를 놓았으며,
탐욕적(greedy) 이진 세분화는 이의 계산 효율적 근사이다. 수익률 시계열의
구조적 변화점(structural break)을 감지하여 국면 분류에 활용한다.
각 분할에서 BIC 감소가 최대인 지점을 선택:

$$BIC = n \cdot \ln(\hat{\sigma}^2) + k \cdot \ln(n)$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{r_t}$ | 수익률 시계열  |
| $maxBreaks$ | 최대 변화점 수 (3)  |
| $minSegment$ | 최소 세그먼트 길이 (30)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{r_t}$는 Stage 1 OHLCV 종가로부터 산출된 수익률이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 탐욕적 이진 세분화 | `js/indicators.js` `calcBinarySegmentation(returns, maxBreaks, minSegment)` L.1586 | 변화점 감지 |
| BIC 기반 | maxBreaks=3 [B], minSegment=30 [B] | 구조변화 검정 |

> 소비자: 신호 레짐 전환 할인, 국면 방향 판별.

> 참조: 제2장 2.3.6절 (변화점 감지 --- CUSUM과 이진 세분화).


<!-- newpage -->

### 3.1.32 HAR-RV (Heterogeneous Autoregressive Realized Volatility)
HAR-RV는 금융학의 변동성 예측 분야에서 발전한 이질적 시장 가설에 기반한
모형이다. Corsi (2009)가 제안하였다. 시장참여자의 이질적 시간
지평(일/주/월)에서 발생하는 다중척도 변동성 동역학을 포착한다.
$$HAR\text{-}RV = \beta_0 + \beta_1 RV_d + \beta_2 RV_w + \beta_3 RV_m$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{OHLCV}$ | 가격 시계열  |
| $RV_d$ | 일별 실현 변동성  |
| $RV_w$ | 주간 실현 변동성 (5일 평균)  |
| $RV_m$ | 월간 실현 변동성 (22일 평균)  |
| $M$ | KRX 월간 윈도우 (22)  |
| $\beta_0, \beta_1, \beta_2, \beta_3$ | HAR 계수  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{OHLCV}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 가격 시계열이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Corsi HAR-RV | `js/indicators.js` `calcHAR_RV(candles)` via `IndicatorCache.harRV(idx)` L.2213 | 다중척도 변동성 |
| KRX 월간 | $M = 22$ 거래일 | KRX 관례 |

> 소비자: 다중척도 변동성 예측, EWMA 변동성 보완 (장기 변동성 구조).

> 참조: 제2장 2.3.4절 (HAR-RV 변동성 예측 --- Corsi 2009).

---

\newpage

## 3.2 패턴 이론 (Patterns)

패턴은 지표가 산출한 수치 위에서 가격 구조의 반복적 형상을 식별하는 단계이다. CheeseStock은 46종의 패턴을 캔들스틱(35종)과 차트(11종)의 두 계통으로 분류하고, 지지·저항 수준을 별도로 산출한다. 캔들스틱 패턴은 일본 쌀 거래 전통에서 기원하여 Nison(1991), Morris(2006), Bulkowski(2008)에 의해 체계화되었고, 차트 패턴은 Edwards-Magee(1948)와 Bulkowski(2005)의 서양 기술적 분석 체계에 기반한다. 모든 패턴의 임계값은 ATR(14) 정규화(3.4.1절)를 통해 가격 수준 독립성을 보장한다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 3.2.1 | 단봉 패턴 | 시장 심리의 순간적 포착 (11종) |
| 3.2.2 | 쌍봉 패턴 | 세력 전환의 확인 (12종) |
| 3.2.3 | 삼봉·다중봉 패턴 | 추세 전환의 완성 (12종) |
| 3.2.4 | 전망이론 교정 | KRX 실증 손실회피 계수 |
| 3.2.5 | 반전 패턴 | Double Bottom/Top, Head & Shoulders |
| 3.2.6 | 지속 패턴 | Triangles, Wedges, Channels |
| 3.2.7 | 지지와 저항 | 가격 클러스터링, 밸류에이션 앵커, 52주 S/R |

### 3.2.1 단봉 패턴 (Candlestick Single-Bar Patterns)

35종의 캔들스틱 패턴(단봉 11 + 쌍봉 12 + 삼봉 8 + 다중봉 4)은 1~5봉 단위의 단기 수급 심리를 포착한다. Nison(1991)이 혼마 무네히사(18세기 오사카 도지마 미곡거래소)의 캔들 분석 체계를 서양 시장에 도입한 이래, Morris(2006)가 확인 규칙을 정교화하였다. 단봉 패턴은 한 봉의 실체(body)와 그림자(shadow) 비율로 매수-매도 심리 균형을 포착한다. 도지(doji)는 실체 극소화로 세력 균형을, 해머(hammer)와 유성(shooting star)은 긴 그림자로 방향성 거부를, 마루보즈(marubozu)는 한 방향의 강한 확신을, 팽이형(spinning top)은 높은 불확실성을 각각 나타낸다.

$$threshold_{actual} = constant \times ATR(14)$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t}$ | 시가, 고가, 저가, 종가  |
| $body$ | 실체 크기 $= |C_t - O_t|$  |
| $range$ | 캔들 범위 $= H_t - L_t$  |
| $DOJI\_BODY\_RATIO$ | 도지 실체 비율 (0.05)  |
| $SHADOW\_BODY\_MIN$ | 그림자/실체 최소 비율 (2.0)  |
| $MARUBOZU\_BODY\_RATIO$ | 마루보즈 실체 비율 (0.85)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 OHLCV 시계열이다. 모든 임계값은 ATR 정규화된다(Wilder 1978).

> 참조: 제2장 2.7절 (행동재무학), 제2장 2.1절 (통계역학).

<!-- newpage -->

### 3.2.2 쌍봉 패턴 (Two-Bar Patterns)

쌍봉 패턴은 연속 두 봉의 관계에서 매수-매도 세력의 전환을 포착한다. Morris(2006)는 확인 규칙(confirmation rules)을 정교화하여 패턴의 학술적 신뢰도를 높였다.

장악형(engulfing)은 현재 봉의 실체가 이전 봉을 완전히 감싸는 구조로, 세력 전환의 가장 직접적인 증거이다. Nison(1991)은 이를 "시장의 반전 선언"으로 해석하였다. 잉태형(harami)은 현재 봉이 이전 봉 실체 안에 위치하여 추세 에너지의 감소를 시사한다. 관통형(piercing line)과 먹구름형(dark cloud cover)은 각각 하락 후 강한 반등과 상승 후 급락을 포착한다. 족집게(tweezer) 패턴은 동일 수준의 고점 또는 저점이 반복되어 가격 거부를 확인하며, 허리띠형(belt hold)과 잉태 십자형(harami cross)이 12종을 완성한다.

$$ENGULF: body_{curr} > ENGULF\_BODY\_MULT \times body_{prev}$$

| 기호 | 의미  |
|:----:|------|
| $ENGULF\_BODY\_MULT$ | 장악형 실체 배수 (1.5)  |
| $HARAMI\_CURR\_BODY\_MAX$ | 잉태형 현재 실체 상한 (0.5)  |
| $PIERCING\_BODY\_MIN$ | 관통형 실체 하한 (0.3)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t}$는 Stage 1 데이터 계층에서 수집된 OHLCV 시계열이다.

> 참조: 제2장 2.7.1절 (전망이론), 제2장 2.7.2절 (처분효과).

### 3.2.3 삼봉·다중봉 패턴 (Three+ Bar Patterns)

삼봉 패턴은 Nison(1991)이 체계화한 일본 전통의 핵심이며, Bulkowski(2008, *Encyclopedia of Candlestick Charts*)가 20년 이상의 미국 데이터로 경험적 성과를 검증하였다.

적삼병(three white soldiers)은 연속 세 양봉으로 강한 매수 압력의 지속을, 흑삼병(three black crows)은 연속 세 음봉으로 매도 압력의 지속을 나타낸다. 샛별형(morning star)과 저녁별형(evening star)은 극소 실체의 중간 봉을 사이에 둔 3봉 반전 구조로, 세력 교체의 전 과정을 포착한다. 상승/하락 삼법과 버려진 아기(abandoned baby) 패턴이 삼봉을 확장한다.

다중봉 패턴(상승/하락 삼법 5봉형, 스틱 샌드위치)은 조정 구간 내의 추세 지속 또는 반전을 포착하며, S/R 제외 캔들 패턴 합계 35종을 구성한다.

$$THREE\_SOLDIER: body_i > THREE\_SOLDIER\_BODY\_MIN \times range_i \quad (i = 1,2,3)$$

| 기호 | 의미  |
|:----:|------|
| $THREE\_SOLDIER\_BODY\_MIN$ | 적삼병 실체 하한 (0.5)  |
| $STAR\_BODY\_MAX$ | 별형 실체 상한 (0.12)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t}$는 Stage 1 데이터 계층에서 수집된 OHLCV 시계열이다.

> 참조: 제2장 2.7.3절 (군집행동과 정보폭포).

<!-- newpage -->

### 3.2.4 전망이론 교정과 KRX 실증 (Prospect Theory Calibration & KRX Evidence)

Kahneman and Tversky(1979)의 전망이론은 투자자의 손실회피 계수 $\lambda = 2.25$를 실증하였다. 이 비대칭적 심리가 패턴 기반 투자에서 손절매와 목표가의 비대칭 설정을 정당화한다.

CheeseStock은 손절매를 $PROSPECT\_STOP\_WIDEN = 1.12$로 확대하고, 목표가를 $PROSPECT\_TARGET\_COMPRESS = 0.89$로 압축한다. 이는 투자자가 손실 구간에서 위험 추구적이고 이익 구간에서 위험 회피적인 행태를 교정하여, 조기 손절을 방지하고 합리적 이익 실현을 유도한다.

KRX 2,645종목 5년(2020--2025) 경험적 발견에서(2026-04-20 pin; `data/backtest/aggregate_stats.json` 245,943 표본), 집계 수준에서 매도 패턴이 매수 패턴을 빈도에서 약 **2.2%p** 상회한다 (bullish 48.9% vs bearish 51.1%, Δ+1,484건). 단, 패턴 군별로는 상반된 방향이 존재하며 `bullishHarami` (+33%), `doubleBottom` (+100%), `morningStar` (+19%)는 오히려 매수 우세이다. 이 완화된 비대칭은 전망이론의 손실회피 및 KRX 구조적 특징(T+2 결제, 가격제한폭, 개인투자자 주도 거래)과 정합하되, 과거 판본의 "10--15%p" 수치는 survivorship 미보정 표본 또는 raw OHLCV bearish-day 비율을 혼동한 추정으로 교정되었다.

| 기호 | 의미  |
|:----:|------|
| $\lambda$ | 손실회피 계수 (Kahneman-Tversky, 2.25)  |
| $PROSPECT\_STOP\_WIDEN$ | 전망이론 손절 확대 (1.12)  |
| $PROSPECT\_TARGET\_COMPRESS$ | 전망이론 목표 압축 (0.89)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{O_t, H_t, L_t, C_t, V_t}$는 Stage 1 데이터 계층에서 수집된 OHLCV 시계열이다. ATR 정규화(3.1.6절)를 통해 모든 임계값이 가격 수준 독립적으로 적용된다.

> 참조: 제2장 2.7.1절 (전망이론과 손실회피), 제2장 2.7.2절 (처분효과).

\newpage

**차트 패턴 (Chart Patterns).** 11종의 차트 패턴은 수십~수백 봉에 걸친 수급의 구조적 전환을 포착한다. Edwards-Magee(1948)와 Bulkowski(2005)의 서양 기술적 분석 체계에 기반하며, 측정 이동(measured move)과 돌파 확인이 핵심 방법론이다.

### 3.2.5 반전 패턴 (Reversal Patterns: Double Bottom/Top, Head & Shoulders)

Edwards and Magee(1948, *Technical Analysis of Stock Trends*)는 차트 패턴의 원형적 분류를 확립하였다. 이중바닥(double bottom)과 이중천장(double top)은 두 스윙 극점과 넥라인 돌파로 구성되며, 수급 균형의 이동을 포착한다. 머리어깨(head and shoulders)와 역머리어깨는 세 피크/트로프 구조로 더 복잡한 세력 전환을 반영한다.

Bulkowski(2005, *Encyclopedia of Chart Patterns*)는 20년 이상의 데이터에서 확인된 머리어깨 패턴의 성공률이 83%인 반면, 미확인 패턴은 35%에 불과하다고 보고하였다. CheeseStock은 미확인 패턴에 $NECKLINE\_UNCONFIRMED\_PENALTY = 15$를 적용하여 이 실증 결과를 반영한다. 목표가는 측정 이동(measured move) 방법으로 산출하되, EVT 99.5% VaR 경계와 Bulkowski P80에 의한 상한을 적용한다.

$$target = breakout\_price \pm pattern\_height$$
$$|target - entry| \leq CHART\_TARGET\_ATR\_CAP \times ATR(14)$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{H_t, L_t, C_t, V_t}$ | 고가, 저가, 종가, 거래량  |
| $pattern\_height$ | 패턴 높이 (피크-트로프)  |
| $breakout\_price$ | 돌파 가격 (넥라인)  |
| $NECKLINE\_BREAK\_ATR\_MULT$ | 넥라인 돌파 ATR 배수 (0.5)  |
| $HS\_WINDOW$ | H&S 탐색 윈도우 (120)  |
| $HS\_SHOULDER\_TOLERANCE$ | H&S 어깨 허용오차 (0.15)  |
| $NECKLINE\_UNCONFIRMED\_PENALTY$ | 미확인 감산 (15)  |
| $CHART\_TARGET\_ATR\_CAP$ | 목표가 ATR 상한 (6)  |
| $CHART\_TARGET\_RAW\_CAP$ | 목표가 비율 상한 (2.0)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{H_t, L_t, C_t, V_t}$는 Stage 1 데이터 계층에서 수집된 OHLCV 시계열이다.

> 참조: 제2장 2.7.4절 (앵커링 편향), 제2장 2.7.2절 (처분효과).

<!-- newpage -->

### 3.2.6 지속 패턴 (Continuation Patterns: Triangles, Wedges, Channels)

Edwards-Magee(1948)는 삼각형(triangle)을 추세 중 조정 국면의 수렴 구조로 정의하였다. 상승삼각형은 수평 저항선과 상승 지지선의 수렴으로 매수 압력의 점진적 우위를, 하강삼각형은 수평 지지선과 하락 저항선의 수렴으로 매도 압력의 우위를 나타낸다. 대칭삼각형은 양방향 수렴으로 돌파 방향이 미정이다.

쐐기(wedge) 패턴은 Bulkowski(2005)가 체계적으로 연구하였다. 상승쐐기는 약세 반전, 하락쐐기는 강세 반전을 시사하며, 삼각형과 달리 돌파 방향에 편향(bias)이 있다. 채널(channel)은 Murphy(1999)의 평행 추세선 분석에 기반하며, 컵앤핸들은 O'Neil(1988)이 성장주 분석에서 도입하였다. 추세선 적합에는 틸-센 강건 추정량(3.1.26절)이 사용되어, 이상치 캔들에 대한 붕괴점 저항을 보장한다.

| 기호 | 의미  |
|:----:|------|
| $TRIANGLE\_BREAK\_ATR\_MULT$ | 삼각형 돌파 ATR 배수 (0.3)  |
| $CHANNEL\_MIN\_LEN$ | 채널 최소 길이 (20)  |
| $CUP\_MIN\_LEN$ | 컵앤핸들 최소 길이 (20)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{H_t, L_t, C_t, V_t}$는 Stage 1 데이터 계층에서 수집된 OHLCV 시계열이다. 추세선 적합에 틸-센 강건 추정량(3.1.26절)을 사용한다.

> 참조: 제2장 2.3.3절 (강건 회귀), 제2장 2.2.4절 (프랙탈 수학).

### 3.2.7 지지와 저항 (Support and Resistance)

Dow, Hamilton(1922), Rhea(1932)의 다우 이론은 가격이 이전에 유의했던 수준에서 지지와 저항을 형성한다고 제안하였다. George and Hwang(2004)은 52주 신고가 근접성이 모멘텀 수익률의 70%를 앵커링 편향을 통해 설명한다는 것을 실증하였다.

CheeseStock의 지지/저항 감지는 세 가지 계층으로 구성된다. 첫째, 가격 클러스터링: ATR*0.5 허용오차 내 극점들을 군집화하여 최소 2회 접촉, 최대 10 수준을 식별한다. 둘째, 밸류에이션 지지/저항: PER/PBR 기반 목표가가 행동적 앵커로 작용하며, 강도 0.6, 범위 ±30%(KRX 일일 가격제한폭)으로 설정된다. 셋째, 52주 신고/신저 지지/저항: George-Hwang(2004)에 기반하여 강도 0.8, 가상 접촉 3으로 설정된다.

합류(confluence) 보정은 패턴의 손절/목표가가 지지/저항의 ATR 이내에 위치할 때 신뢰도를 $+3 \times strength$만큼 상향한다.

| 기호 | 의미  |
|:----:|------|
| $SR\_tolerance$ | S/R 클러스터링 허용오차 (ATR*0.5)  |
| $SR\_strength$ | 접촉 강도 (0~1.0)  |
| $confluence\_bonus$ | 합류 신뢰도 보너스 ($3 \times strength$)  |

> 이전 Stage 데이터: 가격 극점은 Stage 1 OHLCV에서 추출되며, 밸류에이션 수준은 Stage 1 DART 재무제표에서 산출된다.

> 참조: 제2장 2.7.4절 (앵커링 편향), 제2장 2.5.12절 (수요-공급-탄력성).

\newpage

## 3.3 신호 합성 (Signals)

지표(3.1절)가 수치를 산출하고 패턴(3.2절)이 가격 구조를 식별한 후, 이 두 출력을 이산적 행동 신호로 변환하는 단계가 신호 합성이다. 개별 지표나 패턴은 그 자체로 매매 판단이 되지 않으며, 복수의 독립적 증거가 동시에 수렴할 때 비로소 실행 가능한 신호가 된다. 이 설계는 Murphy(1999)의 다중 출처 확인(multi-source confirmation)과 Pring(2002)의 무게 증거(weight of evidence) 원칙에 기반한다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 3.3.1 | 개별 신호 분류 | 23개 감지 함수 (17 TA + 6 deriv) → ~42 emitted types → 31개 weighted 카테고리 |
| 3.3.2 | 복합 신호 3-Tier | 31 복합 신호, 5봉 윈도우, 필수/선택 조건 |
| 3.3.3 | 신뢰도 기본값 교정 | KRX 실증 승률 기반 기본 신뢰도 교정 |

### 3.3.1 개별 신호 분류 (Individual Signal Classification)

CheeseStock의 신호 엔진은 **23개 `_detect*` 감지 진입점** (17 TA + 6 derivatives/cross-asset)으로부터 **31개 weighted 신호 카테고리**를 도출한다. 내부적으로는 약 42개의 고유 `type:` 문자열이 방출되며 이들은 31개 weight-table 카테고리로 집계된다. TA 17종: MA (goldenCross/deadCross/maAlignment), MACD (cross + 4 divergences), RSI (oversold/overbought + 4 divergences), BB (bounce/break/squeeze), Volume (breakout/selloff/exhaustion), OBV (bullish/bearish divergence), Ichimoku (4종), Hurst, StochRSI, Stochastic, Kalman, CCI, ADX, Williams %R, ATR expansion, CUSUM break, Volatility Regime. Derivatives 6종: 선물 basis (contango/backwardation), PCR (fear/greed extremes), 투자자 수급 (aligned/foreign/leadership × buy/sell), ERP (undervalued/overvalued), ETF sentiment (extreme bull/bear), Short interest (high SIR/squeeze). 각 감지 함수는 매수/매도/중립의 이산 신호로 귀결된다.

각 감지 함수는 3.1절의 지표 산출값을 입력으로 받아, 학술적으로 정의된 임계값 조건의 충족 여부를 판정한다. 예컨대 RSI 신호는 Wilder(1978)의 과매도 탈출(RSI < 30 → 30 상향 돌파) 조건을 판정하고, MACD 신호는 Appel(1979)의 시그널선 교차를 감지한다. 다이버전스 감지는 RSI와 MACD에 대해 가격-지표 괴리를 추적하여 추세 약화를 포착한다.

| 범주 | 감지 함수 | 출력 신호 예시 | 학술 기반 |
|------|----------|-------------|----------|
| 추세 | MACD 교차 | goldenCross, deadCross | Appel (1979) |
| 모멘텀 | RSI 과매도/과매수 | rsiOversoldExit, rsiOverboughtExit | Wilder (1978) |
| 변동성 | BB 밴드 반등/돌파 | bbLowerBounce, bbUpperBreak | Bollinger (2001) |
| 거래량 | 거래량 급증/투매 | volumeBreakout, volumeSelloff | Granville (1963) |
| 균형 | 일목 구름 돌파 | ichimokuBullish, ichimokuBearish | Hosoda (1969) |
| 국면 | 허스트 지수 전환 | hurstTrendShift | Mandelbrot (1963) |
| 변화점 | CUSUM 이탈 | cusumBreak | Page (1954) |
| 파생 | 베이시스/PCR/수급 | basisContango, pcrExtreme | Bessembinder-Seguin (1993) |

> 이전 Stage 데이터: 모든 개별 신호의 입력은 Stage 1에서 수집된 OHLCV 가격·거래량과 Stage 2에서 도출된 지표 산출 공식이다. 파생상품 신호(베이시스, PCR, 수급)는 Stage 1의 KRX 파생상품 데이터에서 직접 취득된다.

### 3.3.2 복합 신호 3-Tier 구조 (Composite Signal 3-Tier Architecture)

31개 복합 신호는 개별 신호의 동시 수렴을 검증하는 구조화된 결합이다. 각 복합 신호는 필수 조건(required)과 선택 조건(optional)으로 구성되며, 필수 조건이 모두 $W = 5$봉(KRX 1거래주) 이내에 활성화되어야 복합 신호가 발동한다.

$$\text{Composite}(t) = \begin{cases} \text{active} & \text{if } \forall\, s_i,\; \exists\, t_i \in [t - W,\, t + W] \text{ s.t. } s_i(t_i) = \text{active} \\ \text{inactive} & \text{otherwise} \end{cases}$$

| Tier | 신호 수 | 필수 조건 | 확인 수준 | 예시 |
|:----:|:------:|:---------:|:---------:|------|
| 1 | 10 | 3개 이상 독립 조건 동시 충족 | 최고 | 해머 + RSI 과매도 탈출 + 거래량 급증 |
| 2 | 17 | 2개 조건 | 보통 | 골든크로스 + RSI/거래량 보조 확인 |
| 3 | 4 | 1개 핵심 + 보조 확인 | 약함 | 단일 패턴 + 선택 조건 |

Tier 1 복합 신호(10개)는 3개 이상의 독립 기술적 조건이 동시 충족되는 최고 확인 수준으로, `strongBuy` 또는 `strongSell` 강도를 갖는다. Tier 2(17개)는 2개 조건의 보통 수준이며, 캔들 패턴과 지표 신호의 교차 확인(Nison 1991 + Bollinger 2001 + Murphy 1999)을 포함한다. Tier 3(4개)는 단일 핵심 조건에 보조 확인이 붙는 약한 수준이다.

| 기호 | 의미  |
|:----:|------|
| $W$ | 동시 발생 윈도우 = 5봉 (KRX 1거래주)  |
| $s_i$ | 제 $i$번 필수 조건 신호  |
| $o_j$ | 제 $j$번 선택 조건 신호  |
| $\Delta_{\text{opt}}$ | 선택 조건 보너스 (3--5점)  |
| $C_{\text{composite}}$ | 복합 신호 신뢰도  |

<!-- newpage -->

### 3.3.3 신뢰도 기본값 교정 (Base Confidence Calibration)

$$C_{\text{composite}} = C_{\text{base}} + \sum_{j=1}^{m} \mathbb{1}[o_j \text{ active in } W] \cdot \Delta_{\text{opt}}$$

활성화된 복합 신호의 기본 신뢰도($C_{\text{base}}$)는 KRX 5개년 실증 승률로 교정된다. 선택 조건 보너스($\Delta_{\text{opt}} = 3$--$5$)가 가산되어 최종 복합 신뢰도가 산출된다. 이 기본 신뢰도는 이후 감지 수학(3.4절)의 품질 보정, 신뢰도 체인(3.5절)의 거시-미시-파생 조정, 백테스팅(3.6절)의 통계적 검증을 순차적으로 거치며, 최종 신뢰도로 전환된다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 다중 출처 확인 | `js/signalEngine.js` `COMPOSITE_SIGNAL_DEFS` | 31개 복합 신호 정의 |
| 무게 증거 원칙 | `js/signalEngine.js` `_matchCompositeSignals()` | 필수+선택 조건 결합 |
| 16 지표 감지 함수 | `js/signalEngine.js` `_detectMACDSignals()` 외 15개 | 개별 신호 생성 |
| 4 파생 감지 함수 | `js/signalEngine.js` `_detectBasisSignal()` 외 3개 | 교차자산 신호 |
| 5봉 동시 발생 윈도우 | `COMPOSITE_SIGNAL_DEFS[].window = 5` | Nison (1991) "수 세션 내 확인" |
| KRX 실증 승률 교정 | `COMPOSITE_SIGNAL_DEFS[].baseConfidence` | composite_calibration.json 기반 |
| 선택 조건 보너스 | `optionalBonus: 3--5` | 추가 확인 시 가산점 |

\newpage

## 3.4 감지 수학 (Detection Mathematics)

패턴 감지 시스템의 수학적 기반은 여섯 가지 핵심 기법으로 구성된다. (1) ATR 정규화를 통한 가격 수준 독립성, (2) 틸-센 강건 추세선 적합, (3) PCA 가중 품질 점수, (4) 베타-이항 사후 승률 추정, (5) AMH 시간 감쇠, (6) PCA 효과량 예산. 이들은 각각 독립적 학술 기반을 가지면서도 패턴 엔진 내에서 유기적으로 통합되어 작동한다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 3.4.1 | ATR 정규화 | Wilder (1978), 가격 수준 독립성 보장 |
| 3.4.2 | 틸-센 추세선 적합 | Theil-Sen 강건 추정, 이상치 저항 |
| 3.4.3 | PCA 품질 가중 | 5요인 품질 점수, PC1 body 0.30 |
| 3.4.4 | 베타-이항 사후 승률 | Efron-Morris (1975), 총평균 축소 |
| 3.4.5 | AMH 시간 감쇠 | Lo (2004), 시장별 반감기 적용 |
| 3.4.6 | PCA 효과량 예산 | Longin-Solnik (2001), Kish 유효표본 |

### 3.4.1 ATR 정규화 (Wilder 1978)

Wilder(1978)의 평균진폭(ATR)은 모든 패턴 임계값의 정규화 기준이다. ATR(14)는 Wilder 평활법으로 산출되며, 고가-저가, 고가-전일종가, 저가-전일종가의 세 범위 중 최대값을 진폭(True Range)으로 정의한다.

$$ATR_t = \frac{(n-1) \cdot ATR_{t-1} + TR_t}{n}, \quad n = 14$$

데이터가 불충분할 경우 $close \times 0.02$로 폴백한다. 이 비율은 KRX 대형주의 중앙값 일별 ATR/종가 비율(~2.1%)에서 도출되었다. ATR 정규화를 통해 삼성전자(~60,000원)와 소형주(~1,000원)에 동일한 감지 민감도가 보장된다.

### 3.4.2 틸-센 추세선 적합 (Theil 1950, Sen 1968)

Theil(1950)이 제안하고 Sen(1968)이 일반화한 비모수 강건 추정량이다. 모든 점 쌍 $(i, j)$의 기울기 $\beta_{ij} = (y_j - y_i) / (x_j - x_i)$의 중앙값을 기울기 추정치로 사용한다.

$$\hat{\beta}_{\text{Theil-Sen}} = \text{median}_{i < j}\!\left\{\frac{y_j - y_i}{x_j - x_i}\right\}$$

붕괴점(breakdown point)이 29.3%로, 데이터의 약 1/3이 이상치여도 추정이 안정적이다. 차트 패턴의 추세선 적합(삼각형, 쐐기, 채널)에서 급등/급락 캔들에 의한 왜곡을 방지한다.

### 3.4.3 품질 점수 PCA 가중 (V6-FIX 교정)

패턴 품질 점수는 5개 요인의 가중합으로 산출된다. 가중치는 KRX 데이터에 대한 PCA 분산설명과 로지스틱 회귀에서 도출되었다. body가 PC1 최대 적재(0.30)인 것은 Nison(1991)의 "실체가 가장 중요한 요소"라는 경험 법칙을 통계적으로 확인한 결과이다.

$$Q = 0.30 \times body + 0.22 \times volume + 0.21 \times trend + 0.15 \times shadow + 0.12 \times extra$$

적응형 품질 보정(`_adaptiveQuality`)은 런타임 백테스트 $R^2 > 0.3$일 때 학습된 가중치와 PCA 가중치를 $\alpha = 0.3$ 비율로 혼합하여 시장 적응성을 확보한다.

### 3.4.4 베타-이항 사후 승률 (Efron-Morris 1975)

경험적 베이즈(Efron and Morris 1975)의 총평균 축소를 패턴 승률에 적용한다. 관측 수가 적은 패턴의 원시 승률 $\theta_{\text{raw}}$를 전체 패턴 평균 $\mu_{\text{grand}}$ 방향으로 축소하여 과대 추정을 방지한다.

$$\theta_{\text{post}} = \frac{n \cdot \theta_{\text{raw}} + N_0 \cdot \mu_{\text{grand}}}{n + N_0}$$

사전 강도 $N_0 = 35$는 KRX 545,000건 패턴의 경험적 분산으로 결정되었다. 캔들 패턴($\mu_{\text{grand}} = 0.43$)과 차트 패턴($\mu_{\text{grand}} = 0.45$)에 별도의 총평균을 적용한다.

### 3.4.5 AMH 시간 감쇠 (Lo 2004, McLean-Pontiff 2016)

Lo(2004)의 적응적 시장 가설(AMH)에 따르면, 알파는 시간이 경과하면서 시장 참여자의 학습에 의해 감쇠한다. McLean and Pontiff(2016)는 학술 논문 발표 후 이상수익률이 58% 감소함을 보였다.

$$decay = \exp(-\lambda \cdot daysSince), \quad t_{1/2} = \frac{\ln 2}{\lambda}$$

KOSDAQ($\lambda = 0.00367$, 반감기 189일)은 KOSPI($\lambda = 0.00183$, 반감기 378일)보다 감쇠가 빠르다. 소형주 시장의 정보 효율성이 더 빠르게 개선되기 때문이다.

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{OHLCV}$ | 가격/거래량 시계열  |
| $ATR(14)$ | 평균진폭 (Wilder 1978), 폴백 $0.02$  |
| $N_0$ | 경험적 베이즈 사전 강도 (35)  |
| $\textcolor{stageTwoMarker}{\lambda}$ | 시장별 감쇠율 (KOSDAQ 0.00367, KOSPI 0.00183)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{OHLCV}$는 Stage 1 데이터 계층(KRX pykrx)에서 수집된 가격/거래량 시계열이다. $\textcolor{stageTwoMarker}{\lambda}$ 감쇠율은 제2장의 적응적 시장 가설(Lo 2004)에서 도출된 시장별 알파 반감기이다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| ATR 정규화 | `PatternEngine._getATR()`, 폴백 0.02 [C] | 모든 패턴 임계값 |
| 틸-센 적합 | `calcTheilSen()` | 삼각형/쐐기 추세선 |
| PCA 품질 점수 | `_quality()` + `_adaptiveQuality()` | 패턴 신뢰도 산출 |
| 베타-이항 축소 | `_betaBinomialPosterior()` | 사후 승률 추정 |
| AMH 감쇠 | `_temporalDecayFactor()` | 시간 경과 신뢰도 조정 |
| 시장별 람다 | KOSDAQ=0.00367, KOSPI=0.00183 | 시장 구조 반영 |

### 3.4.6 PCA 효과량 예산 (Longin--Solnik 2001 + Kish 1965, V23)

다수의 독립 요인을 승법 결합할 때, 요인 간 무상관 가정은 극단 구간에서 위반된다. Longin and Solnik (2001)은 하락 극단(1% 분위)에서 상관계수가 정상 구간의 두 배 이상으로 치솟음을 보였다. KRX 2018--2024 4×4 요인 상관행렬 $\Sigma_F$에 Kish (1965) 유효표본크기 공식을 적용하여 동시발동 요인의 실효 자유도 $N_{\text{eff}}$를 산출한다.

$$N_{\text{eff}} = \frac{\left(\sum_{i} \lambda_i\right)^2}{\sum_{i} \lambda_i^2}, \qquad \lambda_i = \text{eig}(\Sigma_F)_i$$

비대칭 예산은 Longin--Solnik의 하락장 상관 급등을 반영하여 상·하방을 비대칭으로 설정한다.

$$\text{DownsideFloor} = \exp\!\left(-0.10 \sqrt{N_{\text{eff}}}\right), \qquad \text{UpsideCeiling} = \exp\!\left(+0.12 \sqrt{N_{\text{eff}}}\right)$$

예: 3개 요인 동시 발동 시 $N_{\text{eff}} \approx 1.3$, 하한 floor $= 0.892$ (독립 가정 대비 $+12$%p 완화). PCA 예산 함수가 Worker result, fallback, drag 3개 체인에 모두 적용되어 10-Layer 체인을 구성한다.

| 기호 | 의미 |
|:----:|------|
| $\Sigma_F$ | 4×4 요인 상관행렬 (KRX 2018--2024) |
| $\lambda_i$ | $\Sigma_F$의 $i$-번째 고유값 |
| $N_{\text{eff}}$ | Kish 유효표본크기 |

\newpage

## 3.5 신뢰도 체인 (Confidence Chain)

패턴이 감지되고 복합 신호가 합성된 후, 기본 신뢰도($C_{\text{base}}$)는 세 계층의 순차적 승법 조정을 거친다: (1) 거시경제·미시 구조 조건(3.5.1절), (2) HMM 국면과 RORO 레짐 결합(3.5.2절), (3) 파생상품·신용위험 요인(3.5.3절). 각 계층은 독립적 학술 기반 위에 설계되어 있으며, 이중계산 방지 가드와 PCA 효과량 예산(3.4.6절)에 의해 과대 조정이 구조적으로 차단된다. 10개 계층의 전체 신뢰도 체인 의사코드와 데이터 파이프라인 참조표는 3.5.1절에 수록되어 있다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 3.5.1 | 거시-미시 신뢰도 | IS-LM, AD-AS, Fisher, Amihud 기반 승법 조정 |
| 3.5.2 | 국면 결합 신뢰도 | HMM 2-state + RORO 레짐 + IV/HV 매트릭스 |
| 3.5.3 | 파생-신용 신뢰도 | 선물 베이시스, PCR, 공매도, Merton DD |

### 3.5.1 거시-미시 신뢰도 (Macro-Micro Confidence)

패턴 기본 신뢰도($C_{\text{base}}$)는 거시경제 환경(7개 요인)과 미시 구조 조건(3개 요인)으로 순차 조정된다. IS-LM(Hicks 1937), 테일러 준칙(Taylor 1993), 먼델-플레밍(Mundell 1963), Stovall 섹터 순환(1996), NSS 수익률 곡선(Nelson-Siegel 1987), Gilchrist-Zakrajsek 신용 스프레드(2012)가 각 요인의 이론적 근거를 제공한다. 거시 클램프 [0.70, 1.30]은 대칭 설계이며, 미시 클램프 [0.55, 1.15]의 비대칭은 유동성 충격(Amihud ILLIQ)의 하방 편중을 반영한다.

$$C_{\text{adj}} = C_{\text{base}} \times \text{clamp}(\text{macroMult}, 0.70, 1.30) \times \text{clamp}(\text{microMult}, 0.55, 1.15)$$

$$\text{macroMult} = \prod_{k \in \{F1,F1a,F2,F3,F7,F8,F9\}} (1 + \delta_k)$$

$$\text{microMult} = \prod_{m \in \{M1,M2,M3\}} (1 + \delta_m)$$

| 기호 | 의미  |
|:----:|------|
| $C_{\text{base}}$ | 패턴 기본 신뢰도  |
| $C_{\text{adj}}$ | 거시-미시 조정 후 신뢰도  |
| $\delta_k$ | 제$k$ 거시 요인 조정량  |
| $\delta_m$ | 제$m$ 미시 요인 조정량  |
| $\textcolor{stageOneMarker}{\text{bok\_rate}}$ | 한국은행 기준금리  |
| $\textcolor{stageOneMarker}{\text{term\_spread}}$ | 국고 10Y--3Y 금리차  |
| $\textcolor{stageOneMarker}{\text{vix}}$ | CBOE VIX 지수  |
| $\textcolor{stageOneMarker}{\text{taylor\_gap}}$ | 테일러 갭  |
| $\textcolor{stageOneMarker}{\text{credit\_spread}}$ | 신용 스프레드 (AA-)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\text{bok\_rate}}$, $\textcolor{stageOneMarker}{\text{vix}}$, $\textcolor{stageOneMarker}{\text{taylor\_gap}}$, $\textcolor{stageOneMarker}{\text{credit\_spread}}$ 등은 Stage 1에서 수집된다. Stage 2의 IS-LM, 테일러 준칙, 먼델-플레밍 이론이 각 요인의 조정 방향과 크기를 결정한다.

#### 거시 신뢰도 요인표 (7개 요인)

| 요인 | 이론 (논문) | 조정 크기 | 등급 |
|------|-----------|:------:|:----:|
| F1 경기순환 | IS-LM 총수요 (Hicks 1937) | $\pm 6$~$10$% | [B] |
| F1a Stovall 섹터 | 섹터-순환 민감도 (Stovall 1996) | 섹터별 $\times 0.5$ | [C] |
| F2 수익률 곡선 | 기간구조 신호 (Harvey 1986) | $\pm 3$~$12$% | [B] |
| F3 신용 국면 | 신용 스프레드 (Gilchrist-Zakrajsek 2012) | $-7$~$-18$% | [B] |
| F7 테일러 갭 | 통화정책 기조 (Taylor 1993) | $\pm 5$% | [B] |
| F8 VRP/VIX | 변동성 위험 프리미엄 (Carr-Wu 2009) | $-3$~$-7$% | [B] |
| F9 금리차 | 먼델-플레밍 (Mundell 1963) | $\pm 5$% | [B] |

> F4--F6: 코드 내부 예약 인덱스, 현재 미사용.

#### 미시 신뢰도 요인표 (3개 요인)

| 요인 | 이론 (논문) | 조정 크기 | 등급 |
|------|-----------|:------:|:----:|
| M1 Amihud ILLIQ | 유동성 할인 (Amihud 2002) | $-15$% 최대 | [A] |
| M2 HHI 보강 | 집중도 평균회귀 (Jensen-Meckling 1976) | $+10$% $\times$HHI | [C] |
| M3 공매도 금지 | 가격발견 저해 (Miller 1977) | $-10$~$-30$% | [B] |

#### 10-계층 파이프라인 참조표

실행 순서는 정보 계층 원칙(information hierarchy principle)에 따라 시장 전체 맥락에서 종목 고유 요인 방향으로 진행된다. 모든 계층이 null-안전하며, 데이터 부재 시 승수 1.0으로 폴백된다.

| 계층 | 학문 기반 | 데이터 출처 | 조정 범위 |
|:----:|----------|-----------|:-----:|
| 0 시장맥락 | 행동재무학 | CCSI, 외국인 순매수, 어닝시즌 | 가변 |
| 1--2 RORO | 국제금융 | VKOSPI/VIX, 신용, USD/KRW, MCS, 수급 | [0.92, 1.08] |
| 3 거시 | 경제학 | 거시 지표, 채권, 통계청 (7팩터) | [0.70, 1.30] |
| 4 미시 | 미시경제학 | OHLCV 비유동성, HHI 집중도 | [0.55, 1.15] |
| 5 파생 | 금융공학 | 파생상품, 투자자 수급, 옵션, ETF, 공매도 | [0.70, 1.30] |
| 6 Merton | 신용위험 | 재무제표 + OHLCV 변동성 (Bharath-Shumway) | [0.75, 1.15] |
| 7 Phase8 | 통계학/거시 | MCS v2, HMM 레짐, 외국인, IV/HV | 가변 |
| 8 생존편향 | 통계학 | 매수 패턴 Winsorized 할인 | [0.92, 1.0] |
| 9 PCA예산 | 다변량통계 | Kish $N_{\text{eff}}$ + Longin-Solnik | 가변 |
| Floor | 통계학 (Tukey 1977) | 복합 하한 | 하한 25 |

#### 전체 신뢰도 체인 의사코드

> **V48 Phase 2.5 아키텍처 주석**: 아래 pseudo-code 중 **Layer 3 (macroMult)** 및 **Layer 7 (applyPhase8)** 은 IP 보호·공지예외(§30) 목적으로 서버 RPC (`functions/api/confidence/macro.js`, `functions/api/confidence/phase8.js`)로 이관되었다. 클라이언트 함수 `_applyMacroConfidenceToPatterns` / `_applyPhase8ConfidenceToPatterns`는 `throw new Error('[V48-Phase2.5] removed')` stub이며 실제 multiplier 계산·staleness filter (`_staleDataSources`)·clamp는 서버측에서 수행된다. 본 장의 이론적 해설은 서버 구현의 사양(specification)으로 기능하고, V47 이전 git history에서 원본 client 구현을 확인할 수 있다.

```
confidence = pattern.baseConfidence
_confBefore = confidence
confidence = applyMarketContext(confidence)        // Layer 0   [client]
confidence *= clamp(roroMult,   0.92, 1.08)        // Layer 1-2 [client]
markFactorsAfterRORO()                              // 10-key Set 이중계산 방지
confidence *= clamp(macroMult,  0.70, 1.30)        // Layer 3   [SERVER RPC /api/confidence/macro]
confidence *= clamp(microMult,  0.55, 1.15)        // Layer 4   [client]
confidence *= clamp(derivMult,  0.70, 1.30)        // Layer 5   [client]
confidence *= clamp(mertonMult, 0.75, 1.15)        // Layer 6   [client]
confidence = applyPhase8(confidence)                // Layer 7   [SERVER RPC /api/confidence/phase8]
confidence = applySurvivorshipAdj(confidence)       // Layer 8   [client]
confidence = applyPCABudget(confidence, _confBefore)// Layer 9   [client]
confidence = clamp(max(confidence, 25), 10, 100)    // Floor + 범위 [client inline L.338-342]
```

RORO가 거시(Layer 3)보다 앞에 실행되는 이유는 시장 전체의 위험선호 체제가 후속 거시 팩터의 해석 맥락을 설정하기 때문이다. V22-B의 `_appliedFactors` 10-key Set 가드가 RORO와 거시 체인 사이의 이중 적용을 차단한다. V22-B의 동적 cap은 ATR(14) 252일 분위수(p25/p75)로 고/중/저 3국면을 분류하여 국면별 신뢰도 범위를 조정한다(고변동성 [25, 75], 저변동성 [5, 95]).

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 거시 신뢰도 | `_applyMacroConfidenceToPatterns()` | F1~F9 승법 적용 |
| 미시 신뢰도 | `_applyMicroConfidenceToPatterns()` | M1~M3 승법 적용 |
| RORO 분류 | `_classifyRORORegime()` | 5요인 가중합 + 히스테리시스 |
| 시장 맥락 | `_applyMarketContextToPatterns()` | CCSI, 외국인, 어닝시즌 |
| 동적 cap | `getDynamicCap(factor, volRegime)` | 국면별 범위 반환 |
| 이중계산 방지 | `_appliedFactors` 10-key Set | 요인 중복 적용 차단 |
| PCA 예산 | `_applyPCABudgetCap()` | Kish $N_{\text{eff}}$ cap |


### 3.5.2 국면 결합 신뢰도 (Regime Combination Confidence)

Layer 0~6의 승법적 조정 이후, 거시경제 국면 복합 판단이 적용된다. Phase 8(Layer 7)은 Hamilton(1989)의 HMM 2-state 레짐(bull/bear), MCS v2 거시복합점수, 외국인 수급 방향, 옵션 내재변동성의 4개 신호를 통합한다. RORO(Layer 1--2)는 Baele, Bekaert, and Inghelbrecht(2010)의 체계에 따라 5개 요인의 가중합으로 risk-on/neutral/risk-off 3체제를 분류하며, 히스테리시스(진입 $\pm 0.25$, 이탈 $\pm 0.10$)로 whipsaw를 방지한다.

$$\text{Phase 8}: \quad C_{\text{adj}} = C_{\text{prev}} \times m_{\text{MCS}} \times m_{\text{HMM}}(S_t, \text{dir}) \times m_{\text{flow}} \times m_{\text{IV}}$$

$$\text{RORO}: \quad \text{roroScore} = \sum_{i=1}^{5} w_i \cdot f_i \times \min\!\left(\frac{n_{\text{valid}}}{3},\; 1.0\right)$$

| 기호 | 의미  |
|:----:|------|
| $S_t$ | HMM 은닉 레짐  |
| $\textcolor{stageOneMarker}{\text{hmmRegimeLabel}}$ | HMM 레짐 라벨 (flow\_signals.json)  |
| $\textcolor{stageOneMarker}{\text{MCS}_{v2}}$ | MCS v2 복합점수 (macro\_composite.json)  |
| $\textcolor{stageOneMarker}{\text{foreignMomentum}}$ | 외국인 순매수 모멘텀  |
| $m_{\text{MCS}}$ | MCS 조정 승수 (MCS $\geq 70$: 1.05, $\leq 30$: 1.05)  |
| $m_{\text{HMM}}$ | HMM 레짐 승수  |
| $m_{\text{flow}}$ | 외국인 방향 일치 보너스 (1.03)  |
| $m_{\text{IV}}$ | IV/HV 할인 ($> 2.0$: 0.90, $> 1.5$: 0.93)  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\text{hmmRegimeLabel}}$은 `flow_signals.json`에서, $\textcolor{stageOneMarker}{\text{MCS}_{v2}}$는 `macro_composite.json`에서 수집된다. RORO 5요인($\textcolor{stageOneMarker}{\text{VKOSPI}}$, $\textcolor{stageOneMarker}{\text{aa\_spread}}$, $\textcolor{stageOneMarker}{\text{usdkrw}}$, $\textcolor{stageOneMarker}{\text{MCS}_{v2}}$, $\textcolor{stageOneMarker}{\text{alignment}}$)은 모두 Stage 1에서 수집된다.

#### HMM 레짐별 신뢰도 승수

| 레짐 | 매수 | 매도 | 비고 |
|:----:|:----:|:----:|------|
| bull | $1.06$ | $0.92$ | Ang-Bekaert (2002) 베이지안 축소 교정 |
| bear | $0.90$ | $1.06$ | IC $0.02$--$0.04$ 과대추정 보정 후 현행값 |
| null | $1.00$ | $1.00$ | 미분류 시 중립 폴백 |

#### RORO 5요인 구성

| 요인 | 가중치 | 임계값 체계 |
|------|:------:|------------|
| R1 VKOSPI/VIX | 0.30 | $> 30$: $-1.0$, $> 22$: $-0.5$, $< 15$: $+0.5$ |
| R2 신용스프레드 | 0.15 | AA $> 1.5$: $-1.0$, HY $> 5.0$: $-1.0$ |
| R3 USD/KRW | 0.20 | $> 1450$: $-1.0$, $< 1100$: $+1.0$ |
| R4 MCS v2 | 0.15 | $(mcs - 0.5) \times 2$ 선형 변환 |
| R5 투자자 정렬 | 0.15 | aligned\_buy: $+0.8$, aligned\_sell: $-0.8$ |

RORO 체제별 조정: risk-on($\times 1.06$ 매수, $\times 0.94$ 매도), risk-off($\times 0.92$ 매수, $\times 1.08$ 매도), neutral(변동 없음). 클램프: [0.92, 1.08].

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| Phase 8 결합 | `_applyPhase8ConfidenceToPatterns()` | MCS + HMM + 외국인 + IV/HV |
| HMM 레짐 승수 | `REGIME_CONFIDENCE_MULT` | 2-state Bull/Bear |
| RORO 분류 | `_classifyRORORegime()` | 5요인 가중합 + 히스테리시스 |
| IV/HV 정확도 | Simon-Wiggins (2001) | IV/HV $> 1.5$: 신뢰도 $-7$~$-10$% |
| 외국인 정보거래 | Kang-Stulz (1997) | 방향 일치 시 $+3$% |


### 3.5.3 파생-신용 신뢰도 (Derivatives-Credit Confidence)

CONF-계층3(파생상품; 구현: `js/appWorker.js:882` `_applyDerivativesConfidenceToPatterns`, Layer 5)은 선물 베이시스, PCR, 투자자 수급, ETF 센티먼트, 공매도 비율, USD/KRW의 6개 요인을 승법 결합한다(Bessembinder-Seguin 1993, Pan-Poteshman 2006, Choe-Kho-Stulz 2005). CONF-계층4(머튼 DD; 구현: `js/appWorker.js:1108` `_applyMertonDDToPatterns`, Layer 6; `_calcNaiveDD` L.1035)는 Merton(1974)의 구조적 신용위험 모형을 Bharath-Shumway(2008) 간편법으로 구현하여 매수 패턴의 신뢰도를 부도 위험에 비례해 할인한다. 금융업종과 seed 데이터는 DD 산출에서 제외된다.

$$\text{derivMult} = \prod_{k \in \{D1,\,D2,\,D3,\,D4,\,D5,\,D7\}} (1 + \delta_k), \quad \text{clamp } [0.70,\; 1.30]$$

$$DD = \frac{\ln(V/D) + (\mu - \tfrac{1}{2}\sigma_V^2)\,T}{\sigma_V \sqrt{T}}, \quad V \approx E + D, \quad EDF = \Phi(-DD)$$

| 기호 | 의미  |
|:----:|------|
| $\textcolor{stageOneMarker}{\text{basis}}$ | 선물 베이시스 (KOSPI200)  |
| $\textcolor{stageOneMarker}{\text{pcr}}$ | 풋/콜 비율  |
| $\textcolor{stageOneMarker}{\text{alignment}}$ | 외국인+기관 수급 정렬  |
| $\textcolor{stageTwoMarker}{DD}$ | 머튼 부도거리  |
| $\textcolor{stageOneMarker}{E}$ | 시가총액, $\textcolor{stageOneMarker}{D}$: 부채 $\times$ 0.75  |
| $\textcolor{stageTwoMarker}{\sigma_V}$ | $\sigma_E \cdot (E/V) + 0.05 \cdot (D/V)$  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{\text{basis}}$, $\textcolor{stageOneMarker}{\text{pcr}}$, $\textcolor{stageOneMarker}{\text{alignment}}$ 등은 Stage 1 KRX 파생상품/투자자/ETF/공매도 데이터에서 수집된다. $\textcolor{stageTwoMarker}{DD}$ 산출은 Stage 2의 BSM(2.6.10절)과 Merton 구조 모형(2.6.13절)에서 도출된다.

#### 파생상품 신뢰도 요인표 (6개 요인)

| 요인 | 이론 (논문) | 조건 | 매수 | 매도 | 등급 |
|------|----------|------|:----:|:----:|:----:|
| D1 베이시스 | Bessembinder-Seguin (1993) | contango $\geq 0.5$% | $+4$~$7$% | $-4$~$7$% | [B] |
| D2 PCR | Pan-Poteshman (2006) | PCR $> 1.2$ (공포) | $+6$% | $-6$% | [B] |
| D3 투자자 정렬 | Choe-Kho-Stulz (2005) | aligned\_buy | $+8$% | $-7$% | [C] |
| D4 ETF 심리 | Cheng-Madhavan (2009) | 극단 낙관 | $-4$% | $+4$% | [C] |
| D5 공매도 | Desai et al. (2002) | $> 10$% | $+6$% | $-6$% | [C] |
| D7 환율 | Mundell-Fleming | KRW 약세, 수출주 | $+5$% | $-5$% | [B] |

> D3: KRX OTP 변경(2025.12) 이후 Naver Finance 스크래핑 대체, 0.85 감쇠. D5: 공매도 데이터 수집 중단, 비활성. D6(ERP): 독립 시그널 처리로 제외(의도적 결번).

#### 머튼 DD 범위별 조정표

| DD 범위 | 등급 | 매수 | 매도 |
|---------|:----:|:----:|:----:|
| $< 1.0$ | 매우 위험 | $\times 0.75$ | $\times 1.15$ |
| $1.0$--$1.5$ | 위험 | $\times 0.82$ | $\times 1.12$ |
| $1.5$--$2.0$ | 경계 | $\times 0.95$ | $\times 1.02$ |
| $\geq 2.0$ | 정상/안전 | 변동 없음 | 변동 없음 |

클램프: [0.75, 1.15]. 금융주(`financial`) 및 seed 데이터 제외. 무위험이자율: KTB 3Y → `_bondsLatest` → fallback 3.5%.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| 파생상품 복합 | `_applyDerivativesConfidenceToPatterns()` | D1--D7 승법 결합 |
| Merton DD | `_calcNaiveDD()` → `_currentDD` | Bharath-Shumway 간편법 |
| DD 매수 할인 | `_applyMertonDDToPatterns()` | 5단계 구간별 |
| Compound floor | `confidence < 25 → 25` | Tukey (1977) 윈저화 |

\newpage

## 3.6 백테스팅 검증 (Backtesting Validation)

백테스팅은 제2장의 이론적 정합성 체인이 경험적 데이터에서 작동하는지 검증하는 최종 게이트이다. WLS 릿지 회귀(Reschenhofer et al. 2021)로 5-피처 설계행렬에서 수익률을 예측하고, IC(Grinold and Kahn 2000), WFE(Pardo 2008), BH-FDR(Benjamini and Hochberg 1995)의 세 독립 게이트로 예측력을 검증한다. 네 축이 종합되어 A/B/C/D 4단계 신뢰도 등급을 구성하며, WFE < 30이면 등급 C 상한이 적용된다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 3.6.1 | WLS 설계행렬 | 5열 피처, 시간감쇠 가중, GCV 릿지 선택 |
| 3.6.2 | IC 임계값 해석 | Grinold-Kahn (2000) 정보계수 |
| 3.6.3 | WFE 범위 해석 | Pardo (2008) Walk-Forward 효율 |

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

| 기호 | 의미  |
|:----:|------|
| $X$ | 설계행렬 $[1,\; \text{품질},\; \text{추세},\; \text{거래량비},\; \text{변동성비}]$  |
| $W$ | 시간감쇠 대각가중행렬, $w_i = 0.995^{n-1-i}$ (반감기 $\approx$ 138일)  |
| $\lambda$ | 릿지 벌점 (GCV 그리드 선택)  |
| $\textcolor{stageOneMarker}{y}$ | $h$-일 미래 수익률 $-$ 거래비용  |
| $\hat{\beta}$ | WLS 릿지 회귀 계수 벡터  |
| $e_i$ | $i$-번째 잔차, $y_i - x_i^T\hat{\beta}$  |
| $h_{ii}$ | 지렛점 (hat matrix 대각), $H = X(X^TWX+\lambda I)^{-1}X^TW$  |
| $m$ | 동시 검정 수 ($\geq 33$ 패턴)  |
| $q$ | FDR 수준 (0.05)  |
| $h$ | 보유기간  |
| $\text{ILLIQ}_{\text{adj}}$ | Amihud (2002) 비유동성 적응형 슬리피지 배율  |

> 이전 Stage 데이터: $\textcolor{stageOneMarker}{y}$ (미래 수익률)는 Stage 1에서 수집된 OHLCV 가격 변동으로 산출된다. 설계행렬의 피처 중 추세 강도, 거래량비, 변동성비 역시 Stage 1의 가격/거래량/ATR(14)에서 파생된다. $\textcolor{stageTwoMarker}{\text{Ridge}}$ 정규화, $\textcolor{stageTwoMarker}{\text{GCV}}$ 람다 선택, $\textcolor{stageTwoMarker}{\text{HC3}}$ 강건 표준오차, $\textcolor{stageTwoMarker}{\text{BH}}$-FDR 다중검정의 이론적 기초는 모두 Stage 2 (제2장 2.2.5절, 2.3절)에서 도출된다.

### 3.6.1 WLS 설계행렬 (5열) 구성

| # | 변수 | 공식 | 단위 | 데이터 출처 |
|:--:|------|------|------|-----------|
| 0 | 절편 | 1 (상수) | --- | --- |
| 1 | 신뢰도 | confidencePred / 100 | 무차원 (0--1) | 패턴 분석 신뢰도 |
| 2 | 추세강도 | $\lvert slope_{OLS}\rvert / ATR$ (10봉 회귀) | 무차원 | $\textcolor{stageOneMarker}{\text{OHLCV 종가}}$ + ATR(14) |
| 3 | 거래량비 | $\ln(\max(V_t / VMA_{20},\; 0.1))$ | 무차원 (로그) | $\textcolor{stageOneMarker}{\text{OHLCV 거래량}}$ + MA(20) |
| 4 | 변동성비 | $ATR_{14} / close$ | 무차원 (비율) | ATR(14) + $\textcolor{stageOneMarker}{\text{OHLCV 종가}}$ |

종속변수 (y): $h$-일 전진 수익률(%) $-$ 거래비용.

WLS 가중치: $w_i = 0.995^{n-1-i}$ (최근 $\to$ 1.0, 최원 $\to$ 감쇠). 반감기 $\approx 138$일.

릿지 $\lambda$: GCV 그리드 $[0.01,\; 0.05,\; 0.1,\; 0.25,\; 0.5,\; 1.0,\; 2.0,\; 5.0,\; 10.0]$. Jacobi 고유분해 기반. 절편($j=0$)은 정규화 미적용.

강건화: Huber-IRLS ($\delta = 5.8$, KRX 5일 MAD 기반, 5회 반복). HC3 표준오차: WLS 모자행렬 $h_{ii} \to (1-h_{ii})^2$ 스케일링 $\to$ 샌드위치 추정.

### 3.6.2 IC 임계값 해석

| IC 범위 | 해석 | 학술 근거 |
|:-------:|------|-----------|
| $IC > 0.10$ | 강한 예측력 | Grinold and Kahn (2000) |
| $0.05 < IC \leq 0.10$ | 운용적으로 유의 | Qian, Hua, and Sorensen (2007) |
| $0.02 < IC \leq 0.05$ | 최소 비자명적 예측력 | Qian et al. (2007) |
| $IC \leq 0.02$ | 예측력 불충분 | --- |

최소 5쌍의 예측--실현 쌍이 필요. IC가 null (데이터 부족)인 경우 등급 판정에서 IC 조건은 통과로 처리.

### 3.6.3 WFE 범위 해석

| WFE 범위 | 해석 | 등급 영향 |
|:--------:|------|-----------|
| $WFE \geq 50$ | 강건 --- IS/OOS 성과 일관 | A/B 등급 허용 |
| $30 \leq WFE < 50$ | 한계 --- 약한 일반화 | B 등급 상한 |
| $WFE < 30$ | 과적합 의심 | **등급 C 강제 상한** (다른 지표 무관) |

확장 윈도우, 4--6 폴드. 제거 갭(purge gap) = $2 \times$ 수평 (AR(1) 반감기 방어) --- Bailey and Lopez de Prado (2014).

BH-FDR 다중검정 보정

Benjamini and Hochberg (1995). 33개 이상의 패턴을 동시에 검정할 때 데이터 스누핑(data snooping)을 방지한다. $p$-값을 오름차순 정렬 후 $p_{(i)} \leq (i/m) \cdot q$ 조건으로 기각 여부를 판정. $q = 0.05$ (FDR 5% 수준).

2,645종목 동시 스캔 환경에서는(2026-04-20 pin) 패턴 내 다중비교(33+ 패턴 $\times$ 5 수평)에 더하여 종목 간 다중비교 문제가 발생한다. Harvey, Liu, and Zhu(2016)의 교차자산 보정을 적용하여 $q_{\text{cross}} = q / \sqrt{N_{\text{stocks}}} \approx 0.05 / \sqrt{2645} \approx 0.000972$으로 조정한다. 이 엄격한 임계값은 `backtester.js`의 `_applyBHFDR()` 후단에서 적용된다.

생존편향 보정

Elton, Gruber, and Blake (1996). 상장폐지 종목이 백테스트 유니버스에서 누락되면 승률이 체계적으로 과대추정된다. `survivorship_correction.json`에서 패턴/수평별 경험적 $\Delta_{WR}$을 로드하여 승률을 하향 보정한다. 보정된 승률: $WR_{\text{corrected}} = WR_{\text{raw}} - \Delta_{WR}$.

거래비용 모형

Kyle (1985) $\sqrt{h}$ 미끄러짐 스케일링에 기반한 보유기간별 비용 분해:

| 비용 항목 | 공식 | 값 (기본) | 근거 |
|-----------|------|:---------:|------|
| 수수료 (편도 $\times$ 2) | $(0.03\%) / h$ | 0.03% | KRX 온라인 수수료 |
| 세금 | $(0.18\%) / h$ | 0.18% | KOSPI 0.03%+농특세0.15% / KOSDAQ 0.18% (2025 통일) |
| 슬리피지 (대형주) | $0.10\% / \sqrt{h}$ | 0.10% | Amihud (2002) ILLIQ 대형주 기준 |
| ILLIQ 적응형 | $\text{슬리피지} \times (1 + \text{ILLIQ}_{\text{adj}})$ | 종목별 | KOSDAQ 소형주 2--5$\times$ 상향 |

$h=1$: 0.31%, $h=5$: 0.087%, $h=20$: 0.033%. 기존 고정비용(0.07%) 대비 $h=1$에서 112% 과대계상이 수정됨.

신뢰도 등급 시스템 (A/B/C/D)

IC, WFE, BH-FDR, 표본 크기, 알파, 수익비를 종합하는 복합 게이팅:

| 등급 | IC | 알파 | 표본($n$) | 수익비(PF) | WFE | BH-FDR | 해석 |
|:----:|:---:|:----:|:---------:|:---------:|:---:|:------:|------|
| A | $> 0.02$ | $\geq 5$pp | $\geq 100$ | $\geq 1.3$ | $\geq 50$ | 통과 | 강건, 실행 가능 |
| B | $> 0.01$ | $\geq 3$pp | $\geq 30$ | --- | $\geq 30$ | 통과 | 보통 수준 증거 |
| C | --- | $> 0$ | $\geq 30$ | --- | --- | --- | 약한 증거, 탐색적 |
| D | --- | --- | $< 10$ | --- | --- | --- | 통계적 증거 불충분 |

$WFE < 30$이면 다른 지표와 무관하게 등급 C 상한 (과적합 의심). Hansen (2005) SPA 검정 미통과 시에도 A/B $\to$ C 강등.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|---------------|-----------|
| WLS 릿지 회귀 + GCV 선택 | `indicators.js` `calcWLSRegression()`, `selectRidgeLambdaGCV()` | 5-피처 설계행렬 $\to$ 수익 예측, $\lambda$ 자동 선택 |
| HC3 + Huber-IRLS 강건 추정 | `indicators.js` `calcWLSRegression()` 내부 | 이분산·극단값 방어 (5회 반복, $\delta=5.8$) |
| 스피어만 IC | `backtester.js` `_spearmanCorr()` | 예측--실현 순위상관 측정 |
| Walk-Forward 검증 | `backtester.js` `walkForwardTest()` | 4--6 폴드 확장 윈도우 OOS 검증 |
| BH-FDR 보정 | `backtester.js` `_applyBHFDR()` | 33+ 패턴 동시검정 FDR 제어 |
| 등급 판정 (A/B/C/D) | `backtester.js` `backtestAll()`, `reliabilityTier` | IC+WFE+BH+$n$+$\alpha$+PF 복합 게이팅 |
| 거래비용 + ILLIQ 적응 | `backtester.js` `_horizonCost()`, `_getAdaptiveSlippage()` | $h$-일 비용 차감 + 종목별 슬리피지 |
| 생존편향 보정 | `backtester.js` `_survivorshipCorr`, `survivorship_correction.json` | 패턴/수평별 $\Delta_{WR}$ 하향 보정 |

V22-B에서 2025-11-01 기준 시간 분할(Lo 2002)이 적용되어 train:test = 50:50 대칭 OOS 검증이 가능해졌다. V25에서 8개 bullish 패턴(doubleBottom, inverseHeadAndShoulders, ascendingTriangle, cupAndHandle, morningStar, tweezerBottom, bullishMarubozu, bullishEngulfing)이 BH-FDR 검정($q = 0.10$)을 통과하여 contrarian 승격되었으며, 런타임에서 $\textit{confidencePred} = 100 - \textit{dirWr}$로 반전된다.

\newpage

## 3.7 기술적 분석 도출 요약 (Technical Analysis Derivation Summary)

제3장은 제2장의 7개 학문 분야에서 도출된 이론을 32개 지표, 46종 패턴(캔들 35 + 차트 11), 31개 개별 신호, 31개 복합 신호, 10계층 신뢰도 체인, 그리고 다중 통계 검증 체계로 변환하는 과정을 문서화하였다. 이 변환 과정에서 기술적 분석(Dow-Hamilton-Rhea, Nison, Edwards-Magee), 계량경제학(WLS, Ridge, HC3), 베이지안 통계학(베타-이항 사후 축소), 금융공학(다요인 신뢰도 체인), 실험설계(Walk-Forward, BH-FDR)의 5개 분야가 추가로 관여한다.

제2장에서 제3장으로의 연결은 양방향이다. 이론이 구현으로 흐르는 순방향 경로와, 경험적 발견(KRX 매도 편향, AMH 감쇠율)이 이론적 예측을 검증하는 역방향 경로가 공존하며, 이 양방향 정합성이 시스템의 학술적 신뢰성을 보장한다.

### 제2장에서 제3장으로의 완전한 연결 고리

```
[제2장 2.5: 경제학]
  IS-LM -----------> 테일러 갭 ---------> CONF-F7
  먼델-플레밍 -----> 금리차 -----------> CONF-F9
  Stovall ---------> 섹터 회전 ---------> CONF-F1a
  HHI -------------> 평균회귀 보강 -----> CONF-M2

[제2장 2.6: 금융학]
  CAPM ------------> calcCAPMBeta() ----> 베타, 알파
  머튼 DD ---------> _calcNaiveDD() ---> CONF-계층4
  VRP -------------> calcVRP() --------> VRP
  BSM IV ----------> VKOSPI 국면 ------> S-28
  보유비용 --------> 베이시스 신호 -----> S-21
  카일 람다 -------> 수평 비용 --------> B-10
  아미후드 ILLIQ ---> calcAmihudILLIQ() -> Amihud ILLIQ, CONF-M1
  RORO ------------> 5요인 복합 -------> Layer 1-2 (RORO 조정)

[제2장 2.7: 행동재무학]
  전망이론 --------> 손절/목표 --------> PROSPECT_STOP_WIDEN
  처분효과 --------> 52주 지지/저항 ----> SR_52W_STRENGTH
  반예측기 --------> 승률 게이트 ------> PATTERN_WR_KRX
  군집행동 --------> CSAD 데이터 ------> (향후 능동 사용)
  손실회피 --------> KRX 매도 편향 ----> 경험적 WR 비대칭

[제3장: 내부]
  Wilder (1978) ----> ATR 정규화 ------> 모든 패턴
  Nison (1991) -----> 35 캔들 패턴 -----> 단일11+이중12+삼중8+오봉4
  Edwards-Magee ----> 11 차트 패턴 ----> 이중/삼각/쐐기/H&S/채널/컵
  Hosoda (1969) ----> 일목 신호 -------> S-8
  Appel (1979) -----> MACD 신호 -------> S-3, S-4
  Bollinger (2001) -> BB 신호 ---------> S-7
  Mandelbrot (1963) -> 허스트 국면 ----> S-11
  Page (1954) ------> CUSUM 이탈 -----> S-17
  Grinold-Kahn ----> 스피어만 IC -----> B-1
  Pardo (2008) -----> Walk-Forward ----> B-3
  BH (1995) --------> FDR 보정 -------> B-4
```

### 종합 요약 테이블

| 절 | 핵심 구현체 | 학문 기반 (제2장) | 산출물 |
|:----:|-----------|-----------------|--------|
| 3.1 기술적 지표 | 32개 지표 (3.1.1~3.1.32절) | 통계학, 물리학, 금융학, 수학 | 가격 파생 수치 |
| 3.2 Patterns | 45종 패턴 (캔들 34 + 차트 11) + S/R | 행동재무학, 기술적 분석 | 패턴 감지 + 품질 점수 |
| 3.3 Signals | 31 개별 + 31 복합 신호, 3-Tier | 다중 출처 확인 (Murphy, Pring) | 행동 신호 + 기본 신뢰도 |
| 3.4 감지 수학 | ATR 정규화, 틸-센, PCA, 베타-이항, AMH | 통계학, 베이지안 | 보정된 임계값/승률 |
| 3.5 신뢰도 체인 | CONF-계층1~4 개념 그룹 (계층1 거시 / 계층2 미시 / 계층3 파생 / 계층4 머튼 DD) — 구현상 Layer 3·4·5·6에 각각 대응, Layer 0~9 전체 체인의 일부 (국면 HMM/MCS는 Layer 7 applyPhase8) | 경제학, 금융학, 금융공학 | macroMult~mertonMult |
| 3.6 백테스팅 | WLS Ridge, IC, WFE, BH-FDR | 계량경제학, 실험설계 | A/B/C/D 등급 |

| 학술 개념 | 구현 모듈 | 적용 영역 |
|-----------|----------|-----------|
| 32 지표 산출 | `js/indicators.js` `calcMA()`~`calcHAR_RV()` + `IndicatorCache` | 가격→수치 변환 |
| 45종 패턴 감지 | `js/patterns.js` `patternEngine.analyze()` | OHLCV→패턴 식별 |
| 62 신호 생성 | `js/signalEngine.js` `signalEngine.analyze()` | 지표+패턴→행동 신호 |
| 10 Layer 신뢰도 조정 (Layer 0~9) | `js/appWorker.js` 10개 `_apply*()` 함수 체인 | 다요인 신뢰도 조정 |
| 통계 검증 | `js/backtester.js` `backtestAll()` | WLS+IC+WFE+BH-FDR |
| Worker 오프로드 | `js/analysisWorker.js` `self.onmessage` (L.203) | 메인 스레드 비차단 |

---

## 부록 3.I: 상수 분류 요약

| 등급 | 제3장 개수 | 예시 |
|:----:|:---------:|------|
| [A] 학술적 고정 | ~40 | DOJI_BODY=0.05, RSI=14, MACD 12/26/9, BB k=2, Ichimoku 9/26/52 등 |
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

다음 10개 이론은 제2장에서 학술적 기반으로 서술되나, 제3장에서 직접적으로 구현되지 않는다: SOC 자기조직임계성(2.1.4), 대리인 이론(2.4.5), 시그널링 이론(2.4.6), 필립스 곡선(2.5.6), 재정승수(2.5.8), MPT(2.6.2), Zero-Beta CAPM(2.6.4), ICAPM(2.6.5), CCAPM(2.6.6), SDF(2.6.15). 이들은 시스템의 이론적 맥락을 제공하거나, 제4장(재무 패널: DCF, WACC, EVA, Kelly) 또는 오프라인 스크립트(브라운 운동)에서 활용된다.

*본 문서는 CheeseStock 기술적 분석 계층에 구현된 모든 지표, 패턴, 신호,
신뢰도 조정, 백테스팅 기법의 완전한 학술적 계보를 제공한다. 각 수식은
제2장의 학술적 기반으로부터 역추적되며, 구현으로 전방 연결된다.*

\newpage


# 제4장: 시각적 변환 — 렌더링과 인지 설계

분석 결과가 투자자에게 한눈에 읽히는 형태로 전달될 때 비로소 의사결정 가치가 실현된다. 본 장은 제3장의 지표·패턴·신호가 차트 위의 색상, 형태, 계층으로 변환되는 과정을 다룬다 — 9개 렌더링 계층의 설계 근거는 인지심리학, 금융 시각화 관례, 정보이론에 기초한다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 4.1 | 렌더링 아키텍처 | 9개 그리기 계층, 재연결 프로토콜, 밀도 제한 |
| 4.2 | 시각화 도출 요약 | Stage 3 출력에서 시각 부호로의 매핑 |
| 4.3 | 색채 이론 | 적/청 방향색, 민트/보라 패턴색, 문화적 부호 |
| 4.4 | 인지 부하와 밀도 | 최대 패턴 수, 연산-표시 분리, 타이포그래피 |

## 4.1 렌더링 아키텍처와 계층 체계
CheeseStock은 2,700개 이상의 KRX 종목에 대해 9개 패턴 계층과 신호·서브차트 오버레이를 동시 렌더링한다. 렌더링 엔진으로 Canvas2D 기반의 TradingView Lightweight Charts(LWC) v5.1.0을 채택한 근거는 성능과 API 간결성이다. SVG는 O(n) DOM 노드 비용으로 1,000개 이상의 요소에서 성능이 급격히 저하되고, WebGL은 GPU 셰이더 파이프라인이 2D 금융 차트에 과잉 복잡성을 초래한다. Canvas2D는 래스터화 속도, 간결한 드로잉 API, DPR(장치 픽셀 비율) 제어의 세 요건을 동시에 충족한다. 히트 테스팅 불가와 수동 텍스트 레이아웃이라는 단점은 수용 가능한 트레이드오프이다.

9계층 아키텍처는 화가 알고리즘(Painter's Algorithm)을 따른다: 후순위 계층이 선순위 위에 그려진다. 계층 1(글로우)이 가장 먼저 그려져 배경에 놓이고, 계층 9(연장선)이 마지막으로 그려져 전경에 위치한다. 이 순서는 게슈탈트 원리의 시각 위계(visual hierarchy)를 반영한다: 단일 캔들 강조(계층 1-2)는 미묘하게, 예측 구간(계층 8)은 명료하게 표시된다. 각 계층은 제3장의 특정 출력 유형(캔들 패턴, 차트 패턴, S/R 수준, 신뢰도 점수)을 시각화하는 책임이 분리되어 있어, 특정 계층만 선택적으로 렌더링하거나 비활성화할 수 있다.

LWC의 ISeriesPrimitive API는 차트 캔버스 위에 직접 그리기를 허용하며, 이것이 패턴·신호·예측 구간 렌더링의 기반이다. 그러나 종목 변경이나 차트 유형 전환(캔들 $\leftrightarrow$ 라인) 시 캔들 시리즈가 재생성되므로, 기존 프리미티브가 파괴된 시리즈에 부착된 채로 남으면 렌더링이 중단된다. 이를 방지하기 위해 ISeriesPrimitive 재연결 프로토콜이 필수적이며, 패턴 렌더러, 신호 렌더러, 그리기 도구 세 모듈이 동일한 프로토콜을 공유한다.

고해상도 디스플레이(Retina, 4K)에서의 DPR 누적은 미묘하지만 치명적인 버그를 유발한다. 매 리드로우마다 Canvas2D 스케일을 반복 호출하면 좌표가 기하급수적으로 증가(2배 $\to$ 4배 $\to$ 8배...)하여 그리기 요소가 화면 밖으로 이탈하거나 보이지 않게 된다. 이를 방지하려면 스케일링 전에 반드시 변환 행렬을 항등행렬로 초기화해야 한다. 신호 렌더러는 이중 PaneView 아키텍처를 사용하여 골든/데드 크로스 영역(배경, zOrder=bottom)과 다이아몬드·별 마커(전경, zOrder=top)를 분리 렌더링함으로써, 영역 신호가 캔들스틱 패턴을 가리는 문제를 해결한다.
$$\text{DPR 초기화:} \quad \texttt{ctx.setTransform}(1,0,0,1,0,0); \quad \texttt{ctx.scale}(dpr,\, dpr)$$

$$\text{라벨 충돌:} \quad \mathrm{bbox}(l_i) \cap \mathrm{bbox}(l_j) \neq \emptyset \;\Rightarrow\; y_j \leftarrow y_j \pm 18\,\text{px} \quad (\text{6회 반복})$$

| 기호 | 의미  |
|:----:|------|
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

> 이전 Stage 데이터: $\textcolor{stageThreeMarker}{\text{patterns}}$, $\textcolor{stageThreeMarker}{\text{confidence}}$, $\textcolor{stageThreeMarker}{\text{priceTarget}}$, $\textcolor{stageThreeMarker}{\text{stopLoss}}$는 Stage 3 (제3장 3.2–3.5절)에서 산출된 패턴 감지 결과 및 10 Layer 신뢰도 조정(Layer 0~9) 점수이다. 본 Stage(제4장)는 이 값들을 소비하여 시각 부호로 변환하며, 수정하지 않는다.

### 4.1.1 렌더링 엔진 비교 (Rendering Engine Comparison)

| 엔진 | 장점 | 단점 | 판정 |
|:----:|------|------|:----:|
| SVG | DOM 접근 가능, CSS 스타일링 | O(n) DOM 노드 → 1,000개 이상에서 성능 저하 | 기각 |
| WebGL | GPU 가속, 대량 처리 | 셰이더 파이프라인 복잡, 2D 차트에 과잉 | 기각 |
| Canvas2D | 빠른 래스터화, 간결한 API, DPR 제어 | 히트 테스팅 불가, 수동 텍스트 레이아웃 | **채택** |

<!-- newpage -->

### 4.1.2 9개 그리기 계층 상세 (Nine Draw Layers)

| 순서 | 계층명 | 시각 요소 | 제3장 출력 | 색상 (fill $\alpha$ / stroke $\alpha$) |
|:----:|--------|----------|-----------|--------------------------------------|
| 1 | 글로우(Glows) | 개별 캔들 수직 줄무늬 (폭 16px) | 단일 캔들스틱 패턴 | \#B388FF fill=0.06 / stroke=0.25 |
| 2 | 브래킷(Brackets) | 2–3개 캔들 둥근 사각형 (r=4) | 이중/삼중 패턴 | \#B388FF fill=0.06 / stroke=0.25 |
| 3 | 추세영역(TrendAreas) | 그라데이션 다각형 + 피벗 마커 | 삼각형/쐐기형 차트 패턴 | \#96DCC8 fill=0.12 |
| 4 | 폴리라인(Polylines) | 피벗점 연결선 (W/M/넥라인) | 이중바닥/천정 | `PTN_BUY` rgba 내장 $\alpha$=0.65, 선폭 1.5 |
| 5 | 수평선(Hlines) | 지지/저항, 손절/목표 수평선 | S/R 클러스터링, 패턴 목표가 | 은색/\#FF6B35/민트 점선 [5,3] |
| 6 | 커넥터(Connectors) | H\&S 빈 원 + 어깨 연결선 | 머리어깨 피벗점 | 민트 globalAlpha=0.5, 점선 [2,3] |
| 7 | 라벨(Labels) | 알약형 배지 (Pretendard 12px 700) | 모든 감지 패턴 | 흰색 텍스트 / rgba(19,23,34,0.88) 배경 |
| 8 | 예측구간(ForecastZones) | 목표/손절 그라데이션 + R:R 바 | 패턴 목표가/손절가 | 민트 목표 / 오렌지 손절 |
| 9 | 연장선(ExtendedLines) | 화면 밖 구조선 연장 | 추세선/넥라인 | `KRX_COLORS.ACCENT` globalAlpha=0.35, 점선 [8,4] |

### 4.1.3 계층 활성화 조건 (Layer Activation Conditions)

| 패턴 분류 | 활성화 계층 | 라우팅 기준 |
|-----------|:---------:|-----------|
| 단일 캔들 (도지, 해머 등 13종) | 1 → 7 → 8 | 단일 패턴 사전 멤버 |
| 이중/삼중/오봉 캔들 (장악형, 적삼병 등 35종) | 2 → 7 → 8 | 영역 패턴 사전 멤버 |
| 이중바닥/천정 | 4 → 5 → 7 → 8 | W/M 폴리라인 + 넥라인 수평선 |
| 삼각형/쐐기 (5종) | 3 → 5 → 7 → 8 | 추세 영역 다각형 + 돌파선 |
| 머리어깨/역머리어깨 | 4 → 5 → 6 → 7 → 8 | 피벗 폴리라인 + 넥라인 + 어깨 커넥터 |
| 지지/저항 | 5 | 수평선만 (라벨 없음) |
| 모든 패턴 (조건부) | 9 | 화면 밖 구조선이 존재할 때만 |

Layer 8 (forecastZones) 활성화 조건: 패턴에 `priceTarget` 또는 `stopLoss` 중 **최소 하나**가 존재하면 렌더링된다 (`js/patternRenderer.js` L.1801 가드). **Risk-Reward 비율 바**는 별개로 둘 모두 존재할 때만 표시된다 (L.1925). 승률 조건부 착색: 승률 > 60% → 민트, 40–60% → 노랑(`#ffeb3b`), < 40% → 청색.

### 4.1.4 줌 적응형 밀도 제어 (Zoom-Adaptive Density Control)

| 가시 봉 수 | 유효 최대 패턴 | 근거 |
|-----------|:------------:|------|
| $\leq$ 50봉 (고배율 줌인) | 1 | 좁은 시야 → 정보 밀도 감소 필수 |
| 51–200봉 (표준 뷰) | 2 | 중간 맥락 |
| > 200봉 (축소 뷰) | 3 (기본값) | 넓은 맥락에서 다수 패턴 수용 가능 |

정렬 우선순위: (1) 활성 패턴(`priceTarget`/`stopLoss` 보유) 우선, (2) 동순위 시 신뢰도 내림차순. 연장선도 동일한 신뢰도 정렬 후 MAX\_EXTENDED\_LINES=5로 절삭.

### 4.1.5 ISeriesPrimitive 재연결 (Primitive Reconnection)

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

라인 모드에서 가격선 참조가 null일 수 있으므로 반드시 null 가드가 필요하다. 패턴 렌더러, 신호 렌더러, 그리기 도구 세 모듈이 동일한 프로토콜을 사용한다.

### 4.1.6 신호 렌더러 이중 PaneView (Dual PaneView Architecture)

| 패인 | zOrder | 시각 요소 | 근거 |
|:----:|:------:|----------|------|
| **배경** | `'bottom'` | 수직 밴드 (골든/데드 크로스 영역) | 맥락 신호가 가격 동작을 가리지 않아야 함 |
| **전경** | `'top'` | 다이아몬드, 별, 다이버전스선, 거래량 라벨 | 고신뢰 신호는 가격 위에 반드시 노출 |

골든/데드 크로스 영역은 다수 봉에 걸쳐 확장되어 전경에 렌더링하면 캔들스틱 패턴을 완전히 가릴 수 있다. 반면 다이아몬드/별 마커는 특정 봉의 점(point) 신호로, 캔들과 공존할 수 있을 만큼 작다.

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 9계층 렌더링 (화가 알고리즘) | `js/patternRenderer.js` `PatternRenderer.draw()` | 글로우→연장선 9단계 고정 순서 |
| 신호 렌더링 이중 패인 | `js/signalRenderer.js` dual PaneView | 배경 밴드(`zOrder='bottom'`) / 전경 마커(`zOrder='top'`) |
| DPR 안전성 초기화 | `js/financials.js` `drawFinTrendChart()` | `ctx.setTransform(1,0,0,1,0,0)` 선행 |
| 라벨 충돌 회피 | `js/patternRenderer.js` Layer 7 인라인 충돌 루프 | 6회 반복 수직 재배치, 실패 시 생략 |
| ISeriesPrimitive 재연결 | patternRenderer / signalRenderer / drawingTools `render()` | 종목 변경·차트 유형 전환 시 detach→reattach |
| 줌 적응 밀도 | `js/patternRenderer.js` effectiveMax 계산 | 가시 봉 수 기반 MAX\_PATTERNS 동적 조정 |
| Miller(1956) 인지 부하 | MAX\_PATTERNS=3 (`patternRenderer.js`), RECENT\_BAR\_LIMIT=50 (`signalRenderer.js`) | 시각 요소 수 상한 설계 |

## 4.2 시각화 도출 요약
제3장(기술적 분석)의 수학적 출력은 제4장(차트 시각화)에서 시각 부호로 변환된다. 이 변환은 일대다 매핑이다: 하나의 수치(예: 신뢰도 점수)가 라벨 불투명도, 티어 배지 색상, 예측 구간 가시성 등 여러 시각 채널에 동시에 영향을 미친다. 매핑 설계의 핵심 원칙은 정보이론적 채널 분리이다: 가격 방향(상승/하락)은 적색/청색으로, 분석 유형(차트/캔들 패턴)은 민트/보라로, 재무 품질은 녹색/청색으로 인코딩되어 세 채널이 독립적으로 디코딩 가능하다.

시각화 토글은 렌더링 시점에 필터링을 수행하므로, 제3장의 분석은 토글 상태와 무관하게 항상 완전히 실행된다. 이 연산-표시 분리 원칙은 패턴 감지 정확도가 사용자의 표시 설정에 독립적임을 보장하며, 백테스트 결과가 시각화 상태와 독립적으로 유지되도록 한다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 4.2.1 | Stage 3→시각 부호 매핑 | 7개 출력 유형의 시각 채널 배정 |
| 4.2.2 | 시각화 파이프라인 | 8단계 렌더링 흐름 |

### 4.2.1 제3장 출력에서 시각 부호로의 매핑 (Stage 3 to Visual Encoding)

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

> 이전 Stage 데이터: 위 표의 모든 Stage 3 출력 유형은 `js/patterns.js` (`patternEngine.analyze()`), `js/signalEngine.js` (`signalEngine.analyze()`), `js/backtester.js` (`backtester.backtestAll()`)에서 산출된다. 본 Stage(제4장)는 이 값들을 소비하는 종단점이며, 역방향 의존성이 없다.

<!-- newpage -->

### 4.2.2 시각화 파이프라인 전체 흐름 (Visualization Pipeline)

| 단계 | 위치 | 역할 |
|:----:|------|------|
| 1. 패턴 감지 | `js/patterns.js` `patternEngine.analyze()` | ATR 정규화, 품질 점수, S/R 클러스터링 |
| 2. 신호 생성 | `js/signalEngine.js` `signalEngine.analyze()` | 16개 지표 신호 + 6개 복합 신호 |
| 3. 백테스트 | `js/backtester.js` `backtester.backtestAll()` | 패턴별 N일 수익률 통계 |
| 4. 시각 필터 | `appUI.js` `_filterPatternsForViz()` | 4범주 토글 기반 렌더 시점 필터링 |
| 5. 패턴 렌더링 | `js/patternRenderer.js` `patternRenderer.render()` | 9계층 Canvas2D 드로잉 |
| 6. 신호 렌더링 | `js/signalRenderer.js` `signalRenderer.render()` | 이중 PaneView (배경/전경) |
| 7. 패널 표시 | `js/patternPanel.js` `renderPatternPanel()` | C열 카드: 승률, 평균 수익률, 학술 메타데이터 |

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 정보이론 채널 분리 | `js/colors.js` KRX\_COLORS | 방향(UP/DOWN) · 유형(PTN\_BUY/CANDLE) · 품질(fin-good) 독립 채널 |
| Miller(1956) 인지 부하 한계 | MAX\_PATTERNS=3, MAX\_DIAMONDS=6 | 계층별 밀도 상한으로 시각 포화 방지 |
| 화가 알고리즘 | `PatternRenderer.draw()` 9단계 고정 순서 | 글로우(배경) → 연장선(전경) 계층 위계 |
| 연산-표시 분리 원칙 | `_filterPatternsForViz()` 렌더 시점 필터 | 분석 완전성 보존, 토글 상태 독립성 |
| Tufte(1983) 데이터-잉크 비율 | $\alpha$=0.06–1.0 불투명도 차등 | 신뢰도 높을수록 불투명, 낮을수록 투명 |
| 한국 시장 색상 관례 | KRX\_COLORS.UP=\#E05050, DOWN=\#5086DC | 적색=상승, 청색=하락 (서양과 반대) |
| 패턴 방향 중립성 | PTN\_BUY = PTN\_SELL = 민트 | 방향 정보는 라벨 텍스트·위치로만 전달 |


## 4.3 색채 이론과 문화적 부호
동아시아 색상 기호학에서 적색은 번영과 길조를 상징하며, 청색은 안정과 보수적 태도를 나타낸다. 한국 주식시장(KRX)은 이 문화적 맥락에 따라 서양과 반대의 색상 관례를 채택한다: 상승·매수는 적색(`#E05050`), 하락·매도는 청색(`#5086DC`)으로 표시한다. 삼성증권, 미래에셋, NH투자증권, 키움증권 등 국내 모든 트레이딩 플랫폼이 동일한 관례를 따르며, CheeseStock도 사용자의 학습된 기대와 일치시킨다. 이 선택은 미적 선호가 아닌 문화적 인지 관례의 준수이다.

Shannon(1948) 정보이론의 채널 용량 공식은 색상 설계에 직접 적용된다: 하나의 색상 채널이 복수의 의미를 동시에 전달하면 수신자(트레이더)의 정보 해석 오류 확률이 증가한다. CheeseStock은 이를 방지하기 위해 3개 열에 완전히 독립적인 색상 의미 체계를 부여한다. B열(차트)은 적색·청색으로 가격 방향만을, C열(패턴)은 민트·보라로 분석 유형만을, D열(재무)은 녹색·청색으로 재무 품질만을 부호화한다. 각 채널은 상호 직교(orthogonal)하여 의미 혼선이 발생하지 않는다.

패턴 색상의 경우, 매수 패턴과 매도 패턴 모두 동일한 민트 색상(rgba 150, 220, 200, 불투명도 0.65)을 사용한다. 이는 Bloomberg Terminal 및 TradingView의 전문가 표준을 따른 설계 결정이다. 패턴 감지는 중립적 분석 관찰이지 방향적 추천이 아니기 때문이다. 예를 들어, 해머 패턴은 지지선에서 출현하면 강세 신호이지만 저항선에서 출현하면 신뢰도가 낮다. 패턴 자체에 방향적 색상을 부여하면 이론이 뒷받침하지 않는 인지적 편향을 유발한다. 방향 정보는 색상이 아닌 라벨 텍스트와 수직 위치(가격 위/아래)로 전달된다.

캔들 패턴은 차트 패턴과 구별하기 위해 별도의 연보라 색상(`#B388FF`)을 사용한다. 캔들 패턴(해머, 도지 등)은 1-3봉 단위의 단기 신호이고, 차트 패턴(삼각형, 이중바닥 등)은 수십 봉에 걸친 구조적 패턴이다. 두 유형은 서로 다른 분석 계층에 속하므로, 색상으로도 명확히 구분된다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 4.3.1 | 패턴 색상 통일 규칙 | 매수·매도 동일 민트, 캔들 보라 구분 |

Shannon 채널 용량:
$$C = B \log_2\!\left(1 + \frac{S}{N}\right)$$

3채널 직교 색상 독립성:
$$\text{방향 채널} \perp \text{유형 채널} \perp \text{품질 채널}$$

단일 채널에 복수 의미 부여 시 정보 오류율:
$$P_e > 0 \quad \Leftrightarrow \quad H(\text{의미} \mid \text{색상}) > 0$$

| 기호 | 의미  |
|:----:|------|
| `#E05050` (UP) | 상승/매수 적색  |
| `#5086DC` (DOWN) | 하락/매도 청색  |
| `#ffeb3b` (NEUTRAL) | 중립 노랑  |
| `#A08830` (ACCENT) | 강조 금색 (구조선, 연장선)  |
| `#B388FF` (PTN_CANDLE) | 캔들 패턴 연보라 (계층 1-2)  |
| `rgba(150,220,200,0.65)` (PTN_BUY = PTN_SELL) | 차트 패턴 민트 (매수/매도 통일, 계층 3-6)  |
| `rgba(255,107,53,*)` (PTN_STOP / FZ_STOP) | 손절가·예측구간 오렌지 계열  |
| `rgba(150,220,200,*)` (PTN_TARGET / FZ_TARGET) | 목표가·예측구간 민트 계열  |
| `#131722` (CHART_BG) | 차트 배경 (KNOWSTOCK 테마)  |
| `#2ecc71` / `#3498db` / `#f39c12` / `#95a5a6` | 신뢰도 Tier A/B/C/D 배지  |
| $B$ | Shannon 채널 대역폭  |
| $S/N$ | 신호 대 잡음비  |

지표별 개별 색상(MA, EMA, BB, 일목, RSI, MACD 등 20여 항목)과 채우기/그라데이션 변형은 `js/colors.js`의 `KRX_COLORS` 객체에서 확인할 수 있다.

> 이전 Stage 데이터: 제3장(패턴 감지)에서 출력된 `direction` 필드(bullish/bearish/neutral)는 B열에서는 적색/청색으로, C열에서는 색상이 아닌 라벨 위치(가격 위/아래)로 표현된다. 동일한 `direction` 값이 열에 따라 서로 다른 시각 채널로 부호화된다.

| 방향 | 한국 (KRX) | 서양 (NYSE) | 근거 |
|:----:|-----------|------------|------|
| 상승/매수 | **적색** `#E05050` | 녹색 | 동아시아 문화에서 적색은 번영과 길조를 상징 |
| 하락/매도 | **청색** `#5086DC` | 적색 | 청색은 안정과 보수적 태도를 상징 |

| 열 | 영역 | 색상 체계 | 의미 |
|:--:|------|----------|------|
| B (차트) | 가격 움직임, 지표 | 적색/청색 | 가격 **방향** (상승/하락) |
| C (패턴) | 패턴 주석 | 민트/보라 | 분석 **유형** (차트/캔들) |
| D (재무) | 펀더멘털 지표 | 녹색/청색 | 재무 **품질** (양호/부진) |

### 4.3.1 패턴 색상 통일 규칙 (Pattern Color Unification)

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

## 4.4 인지 부하와 밀도 제어
George Miller(1956)의 "마법의 숫자 7, ±2"는 인간의 작업 기억(working memory)이 동시에 처리할 수 있는 정보 청크(chunk)의 수를 7±2개로 한정한다는 실험적 발견이다. 이 한계를 초과하면 인지 부하가 포화 상태에 이르며, 추가 정보는 처리되지 못하고 오히려 기존 정보의 해석 정확도를 저하시킨다. 차트 시각화에서 이 한계를 무시하면 더 많은 패턴을 표시할수록 오히려 의사결정 품질이 하락하는 역효과가 발생한다.

최대 패턴 표시 수 3은 Miller(1956) 이론에서 직접 도출된 설계 상수이다. 패턴 1개는 약 5개의 시각 요소(글로우/브래킷 배경 + 폴리라인/추세영역 + 라벨 배지 + 수평선 + 예측구간)를 생성한다. 패턴 3개 × 5 = 15개 시각 요소에 캔들스틱 봉, 이동평균선, 볼린저밴드, 축 라벨을 더하면 전체 시각 원소 총량은 인지 용량의 포화점에 도달한다. 패턴을 4개 이상 표시하면 Miller 한계를 초과하며, 트레이더는 가장 중요한 신호를 식별하지 못하게 된다. 분석 완전성은 제3장(패턴 감지)에서 보존되며, 제4장의 필터링은 분석 정확도가 아닌 인지적 표시 한계만을 관리한다.

연산-표시 분리 원칙(Computation-Display Separation)은 시각화 토글 아키텍처의 핵심이다. 사용자가 캔들/차트/신호/예측 토글을 켜고 끄더라도 제3장의 패턴 분석과 백테스트 연산은 항상 완전하게 실행된다. 필터링은 렌더링 시점에서만 적용된다. 이 분리로 인해 사용자는 재분석 없이 표시 설정을 전환할 수 있으며, 백테스트 결과는 시각화 상태와 무관하게 신뢰할 수 있다.

타이포그래피 설계는 이중 서체 체계를 채택한다. Pretendard(한국어 최적화 가변 폰트)는 12px 700 굵기에서도 일관된 자폭을 유지하여 패턴 라벨과 한국어 텍스트에 사용된다. JetBrains Mono는 OpenType `tnum`(tabular numbers) 기능으로 소수점 정렬을 보장하며, 가격 라벨과 종목코드에 적용된다. 가격 데이터에 비례폭 폰트를 사용하면 자릿수에 따라 열 너비가 변동하여 시각적 비교가 어려워진다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 4.4.1 | 타이포그래피 스케일 | Pretendard + JetBrains Mono 이중 서체 |
| 4.4.2 | 밀도 제한 상수 | MAX_PATTERNS=3 등 6개 상한 |
| 4.4.3 | 시각화 토글 4범주 | 캔들/차트/신호/예측 독립 필터 |

Miller(1956) 작업 기억 한계:
$$\text{작업 기억 용량} = 7 \pm 2 \quad \text{[정보 청크]}$$

차트 시각 원소 총량:
$$E_{\text{total}} = |\mathcal{P}_{\text{vis}}| \times \bar{e}_{\text{per\_pattern}} + E_{\text{base}}$$

밀도 제한 조건:
$$|\mathcal{P}_{\text{vis}}| \leq 3 \quad \Rightarrow \quad E_{\text{total}} \approx 15 + E_{\text{base}} \quad \text{(인지 포화 임계에 도달)}$$

| 기호 | 의미  |
|:----:|------|
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

> 이전 Stage 데이터: 제3장에서 산출된 `patterns[]` 배열 전체는 Worker 분석 캐시(`_analyzeCache`)에 보존된다. 제4장의 밀도 제한은 `patternRenderer.render()` 호출 시점에 적용되며, 원본 분석 결과를 변경하지 않는다. `backtester.backtestAll()` 역시 표시 여부와 무관하게 전체 패턴에 대해 실행된다.

### 4.4.1 타이포그래피 스케일 (Typography Scale)

| 폰트 | 용도 | 선정 근거 |
|------|------|----------|
| **Pretendard** 12px 700 | 패턴 라벨, 한국어 텍스트 | 한국어 최적화 가변 폰트, 12px에서도 일관된 자폭 유지 |
| **JetBrains Mono** | 가격 라벨, 종목코드 | 표 형식 숫자(`tnum`)로 소수점 정렬 보장 |

### 4.4.2 밀도 제한 상수 (Density Limit Constants)

| 상수 | 값 | 근거 |
|------|:--:|------|
| MAX_PATTERNS | 3 | Miller(1956) 7±2: 3패턴 × 5요소 = 15, 인지 한계 |
| MAX_EXTENDED_LINES | 5 | 다수 역사적 패턴의 선 어수선함 방지 |
| MAX_DIAMONDS | 6 | 최근 신호에 집중 |
| MAX_STARS | 2 | 고신뢰 복합 신호 — 설계상 희소 |
| MAX_DIV_LINES | 4 | RSI/MACD 다이버전스선 — 구조적, 비과밀 |
| RECENT_BAR_LIMIT | 50 | 시간적 집중: 최근 ~50봉의 분석만 렌더링 |

### 4.4.3 시각화 토글 4범주 (Visualization Toggle Categories)

| 범주 | 대상 패턴 유형 | 토글 끔 시 효과 |
|:----:|--------------|---------------|
| 캔들 | 캔들스틱 패턴 35종 (해머, 도지 등) | 글로우/브래킷 미표시, 분석은 유지 |
| 차트 | 차트 패턴 11종 (삼각형, 이중바닥 등) | 추세영역/폴리라인 미표시, 분석은 유지 |
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


# 제5장: 서비스 전달 — 아키텍처에서 화면으로

데이터를 수집하고, 이론으로 분석하고, 차트 위에 시각화한 결과는 최종적으로 사용자의 브라우저에 도달해야 한다. 본 장은 이 전달 과정의 아키텍처를 다룬다 — 19개 파일의 로드 순서, 이중 모드(실시간/정적) 설계, 서비스 워커를 통한 오프라인 지원, 그리고 캐싱 전략까지, 분석 결과가 화면에 나타나기까지의 전 경로를 기술한다.

| 절 | 주제 | 핵심 내용 |
|:--:|------|----------|
| 5.1 | 웹 전달 아키텍처 | 19개 파일 로드 순서, WS/File 이중 모드, 캐시 전략 |
| 5.2 | 사용자 전달 | 티어 시스템, 토스트 알림, 반응형 10분기점 |
| 5.3 | 추적 경로와 요약 | 이론에서 화면까지의 종단간 추적 |

## 5.1 웹 전달 아키텍처
CheeseStock은 번들러(webpack, vite 등)를 의도적으로 배제한다. 19개 JS 파일이 HTML에서 defer 속성의 스크립트 태그로 직접 로드된다. 이 설계의 핵심 근거는 투명성 우선 원칙이다: 모든 함수, 상수, 공식이 브라우저 개발자도구의 소스 패널에서 직접 열람 가능하다. 금융 분석 도구에서 공식의 정확성이 도구 편의성보다 우선하며, 이는 의식적 설계 선택이다.

19개 파일의 결정론적 로드 순서는 5-Stage 이론 체인에 정확히 대응된다. 데이터 계층(colors, data, api, realtimeProvider)이 먼저 로드되어 Stage 1을 구성하고, 이론 엔진(indicators, patterns, signalEngine, backtester)이 Stage 2-3을, 렌더링 계층(chart, patternRenderer, signalRenderer, drawingTools)이 Stage 4를, 어플리케이션 계층(sidebar, patternPanel, financials, appState, appWorker, appUI, app)이 Stage 5를 담당한다. 이 순서는 전역 변수 의존성 체인이므로 위반 시 참조 오류가 발생한다.

WS/File 이중 모드는 형식적 동치 조건을 보장한다. 두 모드 모두 동일한 OHLCV 스키마를 입력으로 사용하므로 지표·패턴 연산의 입력 공간이 동일하다. 신뢰도 조정 계층의 거시·수급·파생 데이터는 JSON 파일에서 로드되며, 이 파일은 WS/File 모드와 무관하게 동일한 경로에서 동일한 내용을 참조한다. 따라서 데이터 신선도 가드가 통과하는 한 분석 결과의 모드 간 편차는 발생하지 않는다.

서비스 워커는 Cache-First 전략을 채택한다. 오프라인 상태에서도 전체 지표·패턴·신호 공식이 JS에 내장되어 가용하며(서버 의존 없음), 캐시된 OHLCV 데이터에 대한 패턴 감지가 작동하고, 마지막 취득 거시데이터로 신뢰도 조정이 수행된다. 이론적 저하는 없으며 데이터 신선도만 영향을 받는다. 캐시 이름 버전을 변경하면 구버전 캐시가 무효화된다.
$$\text{Analysis}(\text{OHLCV}_{s,t},\, \text{MacroJSON}_t) \perp \text{TransportMode}$$

임의의 종목 $s$와 시점 $t$에 대해, 분석 출력은 데이터 전달 경로(WS 소켓 또는 HTTP fetch)에 무의존적이다. 이는 Stage 3의 모든 지표(32개), 패턴(45종), 신호(31개 복합), 신뢰도 조정(Layer 0~9, 총 10 Layer)이 OHLCV 배열과 JSON 매크로 파일만을 입력으로 취하고 전달 메커니즘을 참조하지 않기 때문에 구성적으로 보장된다.

| 기호 | 의미  |
|:----:|------|
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

> 이전 Stage 데이터: $\textcolor{stageFourMarker}{\text{chart}}$는 Stage 4에서 렌더링된 차트 캔버스이다 — PatternRenderer, SignalRenderer, DrawingTools가 ISeriesPrimitive Canvas2D 계층을 통해 생성한 픽셀 출력. $\textcolor{stageThreeMarker}{\text{analysis}}$는 Stage 3에서 산출된 패턴·신호·신뢰도 결과로서 Worker 스레드가 postMessage로 메인 스레드에 전달한 JSON 객체이다.

### 5.1.1 로드 그룹과 의존성 체인 (Load Groups and Dependency Chain)

| 로드 그룹 | Stage | 파일 | 역할 |
|-----------|:-----:|------|------|
| 데이터 계층 | 제1장 | colors, data, api, realtimeProvider | 데이터 취득 |
| 이론 엔진 | 제2-3장 | indicators, patterns, signalEngine | 학술적 연산 |
| 렌더링 | 제4장 | chart, patternRenderer, signalRenderer | 시각적 변환 |
| 이론+렌더링 교차 | 제3-4장 | backtester, drawingTools | 전역 변수 의존 체인이 로드 순서를 결정 |
| 어플리케이션 | 제5장 | sidebar, patternPanel, financials, appState, appWorker, appUI, app | 사용자 전달 |

### 5.1.2 4열 그리드 레이아웃 (Four-Column Grid Layout)

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

### 5.1.3 이중 모드 동치 (Dual-Mode Equivalence)

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
| Cache-First 서비스 워커 | `sw.js` `CACHE_NAME`, `STATIC_ASSETS` | 오프라인에서도 전체 분석 공식 가용 |
| 4열 정보 아키텍처 (Rosenfeld-Morville) | `css/style.css` 4-column grid | A(탐색)/B(분석)/C(패턴)/D(재무) 열 분리 |

### 5.1.4 Staleness 방어 (Runtime Staleness Guard)

정적 JSON 파일 전달 아키텍처에서 가장 조용히 누적되는 실패 모드는 최신화 중단이다. ECOS API 호출 실패, DART 키 만료, 배치 스크립트 중단 같은 원인으로 거시 데이터 파일이 갱신되지 않는 상태에서도 브라우저는 과거 버전을 성공적으로 읽어 들이며, 이론 공식은 변함없이 `macroMult=1.05`, `flowMult=1.03` 같은 승수를 패턴 신뢰도에 곱한다. 사용자는 3주 전의 거시 상황으로 평가된 오늘의 패턴을 실시간 시그널로 인식한다. 이를 Cosma Shalizi의 분류를 빌려 표현하면, 시스템은 정지(silent failure)가 아니라 마치 정상 작동하는 것처럼 행동하는 위장 실패(masked failure) 상태에 들어간다.

CheeseStock의 1차 방어선은 배포 전 정적 검증이다. `scripts/verify.py`의 Gate 1(CHECK 6 pipeline)은 배포 디렉터리에 있는 거시 데이터 파일의 `updated` 필드가 현재 시각 대비 14일 이상 경과한 경우 경고를 발생시키고, 30일 이상이면 실패로 처리하여 `wrangler pages deploy`를 중단한다. 그러나 이 검증은 CLI에서 사람이 실행할 때만 작동하며, 브라우저로 이미 전달된 사이트의 사용자는 해당 방어의 혜택을 받지 못한다.

2차 방어선으로 도입된 런타임 staleness 가드는 `js/appWorker.js`의 `_checkDataStaleness()` 함수가 로드 직후 `macro_latest`, `bonds_latest`, `kosis_latest`, `derivatives_summary`, `investor_summary`, `etf_summary`, `shortselling_summary`, `flow_signals`, `options_analytics`의 9개 소스 각각에 대해 `updated`/`date`/`generated`/`time` 필드를 파싱하여 경과 일수를 계산한다. 경과 일수가 14일을 초과한 소스는 `_staleDataSources` 집합에 등록되고, `[STALE] {소스명}: {경과일수}일 경과 -- 신뢰도 승수 1.0 클램프` 형식의 경고가 브라우저 콘솔에 출력되며, 토스트 알림이 사용자에게 degraded 운영 상태를 알린다.

클램프의 실제 동작은 승수 계산 경로의 분기 조건으로 구현된다. `_applyMacroConfidenceToPatterns()`는 진입부에서 `_staleDataSources.has('macro_latest')`가 참이면 지역 변수 `macro`를 `null`로 고정하고, 동일한 규칙을 `bonds_latest`에도 적용한다. 이후의 모든 승수 계산(`phase`, `slope`, `aaSpread`, `fSignal`, `taylorGap`)은 `null`에서 추출된 속성이 `null`이 되어 각 `if` 조건문에서 기각되며, 누적된 `adj` 변수는 초기값 `1.0`을 유지한다. 결과적으로 `p.confidence = Math.round(p.confidence * adj) = p.confidence`가 되어 해당 패턴의 신뢰도는 원래 값 그대로 보존된다. 동일한 패턴이 `_applyPhase8ConfidenceToPatterns()`의 `flow_signals`, `options_analytics` 블록에도 적용되어, stale 소스에서 유래하는 모든 승수 경로가 차단된다.

| 소스 | 재생성 스크립트 | 갱신 주기 | 14일 근거 |
|------|--------------|----------|----------|
| `macro_latest.json` | `scripts/download_macro_ecos.py` | 일별 | 한국은행 ECOS 월별 지표 갱신 2-3주 × 2배 안전 마진 |
| `bonds_latest.json` | `scripts/download_bonds_ecos.py` | 일별 | 채권 수익률곡선 슬로프 일변동 < 5bp, 2주 누적 편차 유의 |
| `flow_signals.json` | `scripts/run_flow_analysis.py` | 일별 | HMM 국면 전이 평균 잔류기간 7-10일 × 2배 |
| `options_analytics.json` | `scripts/download_options.py` | 일별 | ATM IV 자기상관 반감기 약 10일, 2주 경과 시 예측력 소실 |

14일 임계값은 한국은행 ECOS의 월별 거시지표 발표 사이클(통상 2-3주)에 2배의 안전 마진을 적용한 값이다. 정상 운영에서는 `scripts/auto_update.bat`이 평일 09:30-16:05에 시간당 1회 실행되므로 모든 데이터 소스의 경과 일수는 1일 이하로 유지된다. 14일 경계는 배치 실패가 1-2회 누적되어도 경고가 발생하지 않는 완충 구간이면서, 동시에 월별 지표가 두 번의 발표 사이클을 건너뛴 상황을 명확히 감지할 수 있는 지점이다.

Degraded 동작의 철학은 *조용한 실패는 거짓된 확신보다 나쁘다*로 요약된다. 14일 경계를 넘긴 시스템은 여전히 작동하지만 관련 신뢰도 조정을 비활성화하여 이론 공식이 stale 입력에 기반한 허위 정밀도를 생성하지 않도록 한다. 패턴의 기본 신뢰도(기술적 분석, 백테스트 승률)는 보존되며, 거시·수급·옵션 관련 이차 조정만이 제거된다. 이는 Nassim Taleb의 *fragility removal*—최대 가치 제공보다 극단적 실패 방지를 우선하는 설계 원칙—을 시스템 수준에서 구현한 것이다.

### 5.1.5 교차-API Cascade 실패 방어 (Cross-API Cascade Failure Guard)

5.1.4절의 staleness 가드가 **소스별 개별 경과**를 포착하는 반면, 현실 운영에서는 **상위 API 자체의 중단**이 여러 소스에 동시에 영향을 미치는 cascade 실패가 더 위협적이다. 예를 들어 한국은행 ECOS 인증키 만료 또는 API 스펙 변경은 `macro_latest`, `bonds_latest`, 그리고 파생된 `macro_composite` 세 소스를 동시에 최신화 중단시키며, 개별 staleness 검사는 이 공통 원인을 인식하지 못한 채 세 개의 독립 경고만 발생시킨다. 더 큰 위험은 세 소스 중 일부만 stale이고 일부는 "정상 갱신이지만 잘못된 값"인 경우, 부분 데이터 기반의 매크로 조정이 **허위 정밀도(spurious precision)** 를 생성하여 실제로는 정보 내용이 없는 승수를 적용한다는 점이다.

CheeseStock는 12개 데이터 소스를 상위 API에 따라 3개 그룹으로 분류한다. **ECOS 그룹**(한국은행)은 `macro_latest`·`bonds_latest`·`macro_composite`(파생)의 3소스를 포함하며 거시경제·채권 분석의 입력이다. **KOSIS 그룹**(통계청)은 `kosis_latest` 단일 소스이며 산업·고용·소비 통계의 입력이다. **KRX 그룹**(거래소)은 `vkospi`·`derivatives`·`investor`·`etf`·`shortselling`·`basis`(파생)·`flow_signals`(파생 HMM)·`options_analytics`의 8소스를 포함하며 수급·파생·변동성 분석의 입력이다.

| API 그룹 | 소속 소스 수 | 상위 API | 다운 시 비활성화 대상 |
|---------|-----------|---------|---------------------|
| ECOS | 3 (`macro_latest`, `bonds_latest`, `macro_composite`) | 한국은행 API | `_applyMacroConfidenceToPatterns` 전체 |
| KOSIS | 1 (`kosis_latest`) | 통계청 OpenAPI | Stovall 섹터 mapping의 산업구조 조정(영향 제한적) |
| KRX | 8 (`vkospi`·`derivatives`·`investor`·`etf`·`shortselling`·`basis`·`flow_signals`·`options_analytics`) | 거래소 OpenData/DART | `_applyPhase8`의 Flow·Options·Investor 블록 |

`js/appState.js`의 `_getApiGroupHealth(apiName)` 함수는 각 그룹의 상태를 `healthy` / `degraded` / `down`의 3단계로 집계한다. 판별 규칙은 다음과 같다. 그룹 내 소스 중 `ok`·`aging`·`naver`(대체 소스) 상태인 것을 정상으로, `stale`·`sample`을 약화로, `missing`·`rejected`·`empty`·`error`를 실패로 분류한다. 실패 소스가 그룹 전체의 과반이면 `down`, 실패와 약화의 합이 과반이면 `degraded`, 그 외에는 `healthy`이다. 예컨대 ECOS 그룹에서 `macro_latest`와 `bonds_latest`가 모두 `missing`이면 실패 2/3 > 1.5로 `down` 판정이 내려진다.

Cascade 실패가 감지되면 신뢰도 조정 함수의 진입부에서 **전체 스킵**이 수행된다. `_applyMacroConfidenceToPatterns()`는 ECOS 그룹이 `down`이면 함수 전체를 조기 반환하여 개별 소스 staleness 체크에 도달하기 전에 차단된다. `_applyPhase8ConfidenceToPatterns()`는 KRX 그룹이 `down`이면 MCS 블록(ECOS 소속)은 유지하되 Flow·Options·Investor 블록 전체를 비활성화한다. 이 계층적 구조는 **소스별 가드(Layer 1)** → **그룹별 cascade 가드(Layer 2)** 의 이중 방어를 형성하여, 단일 소스 실패는 Layer 1이, 상위 API 실패는 Layer 2가 담당한다.

사용자 알림은 `_runPipelineStalenessCheck()`의 말미에서 한 차례 집계되어 제공된다. Staleness 가드가 개별 소스 경과를 나열한다면, cascade 가드는 `ECOS/KRX API 다운 -- 관련 신뢰도 조정 전면 비활성화` 형식의 상위 수준 메시지를 토스트로 표시한다. 콘솔에는 `[CROSS-API]` 접두어로 구분되어 기록되며, 개발자가 배치 스크립트 실패 원인을 진단할 때 상위 API 수준의 중단인지, 개별 소스의 시의적 실패인지 즉시 구분할 수 있다.

이 설계의 이론적 기반은 Nancy Leveson (1995)의 *Safeware*와 Charles Perrow (1984)의 *Normal Accidents* 문헌이 강조하는 **공통원인 실패(common-cause failure)** 분석이다. 안전-중요 시스템에서 독립 소스의 개별 모니터링만으로는 상위 공통 원인(upstream common cause)에서 비롯된 동시 실패를 포착하지 못하며, 이를 위해 **의존성 그룹 수준의 집계 지표**가 별도로 요구된다. CheeseStock의 12개 데이터 소스는 3개 상위 API에 의존하므로, 개별 소스 staleness 12개 지표 외에 API 그룹 건강도 3개 지표를 추가로 모니터링함으로써 cascade 실패의 시그니처를 조기 포착할 수 있다.


## 5.2 사용자 전달과 반응형 설계
최종 전달 문제(Last Mile Problem)는 수학적으로 정밀한 이론 출력을 사용자 행동으로 연결하는 과제이다. IC = 0.051, DD = 2.8σ, MCS v2 = 62.4와 같은 원시 출력은 그 자체로는 사용자에게 직관적이지 않다. CheeseStock의 Stage 5는 이 격차를 티어 시스템, 토스트 알림, 반응형 레이아웃의 세 가지 메커니즘으로 해소한다.

5단계 티어 시스템(S/A/B/C/D)은 통계적 유의성을 실행 가능한 범주로 변환한다. 각 티어는 IC(정보계수) 임계값, 수익률비, 최소 표본 수의 세 기준을 복합적으로 적용하여 백테스터의 신뢰도 등급 판정 함수에서 산출된다. 색상 배지(녹색/청색/호박색/회색)는 KRX 색상 규약과 독립적으로, 패턴의 통계적 품질 수준만을 시각화한다.

정보 병목(Information Bottleneck) 이론에 의하면 복잡한 입력 분포에서 과업 관련 정보만을 추출하는 최적 압축 표현이 존재한다. 토스트 알림 "N개 패턴 감지됨"은 이 원리를 구현한다: 32 지표 × 46 패턴 × 10 신뢰도 조정의 복합 파이프라인 출력을 단일 행동 유도 문구로 압축한다. 사용자가 추가 정보를 원할 경우 C열 패턴 패널에서 상세 정보를 확인할 수 있다.

반응형 10분기점 설계의 핵심 원칙은 이론적 완전성이 모든 화면 크기에서 유지된다는 것이다. 분석 파이프라인은 화면 크기와 무관하게 동일하게 실행되며, 모바일 사용자도 데스크톱 사용자와 동일한 IC 검증, 신뢰도 조정, 패턴 신호를 수신한다. 화면 크기에 따라 변화하는 것은 정보의 표시 방식이며, 정보의 내용 자체는 동일하게 보존된다.
$$\text{Toast} = f_{\text{compress}}\!\left(\bigcup_{i=1}^{45} \text{Pattern}_i \times \prod_{k=0}^{9} \text{CONF}_k\right) \to \text{"N개 패턴 감지됨"}$$

여기서 $f_{\text{compress}}$는 정보 병목 원리에 의한 손실 압축 함수이다. 45개 패턴의 합집합에 6개 신뢰도 계층의 곱을 적용한 전체 결과가 토스트 단일 문구로 압축된다.

| 기호 | 의미  |
|:----:|------|
| $f_{\text{compress}}$ | 정보 병목 압축 함수  |
| $\text{Pattern}_i$ | 제 $i$번 패턴 (i = 1..46)  |
| $\text{CONF}_k$ | 제 $k$번 신뢰도 조정 계층 (k = 0..9)  |
| S 티어 | IC > 0.03, 수익률비 > 1.5, n ≥ 100  |
| A 티어 `#2ecc71` | IC > 0.02, 수익률비 > 1.3, n ≥ 50  |
| B 티어 `#3498db` | IC > 0.01, 수익률비 > 1.1, n ≥ 20  |
| C 티어 `#f39c12` | IC > 0.003  |
| D 티어 `#95a5a6` | IC ≤ 0.01, 수익률비 ≤ 1.0  |
| IC | 정보계수 (Information Coefficient)  |

> 이전 Stage 데이터: $\text{Pattern}_i$는 Stage 3 `patternEngine.analyze()`의 출력이다. $\text{CONF}_k$는 Stage 3 신뢰도 조정 계층(거시/수급/파생/Merton DD/변동성/행동)이 적용한 승산 계수이다.

### 5.2.1 원시 출력에서 사용자 전달로의 변환 (Raw Output to User Delivery)

| 원시 출력 | 사용자 문제 | 해결 방안 |
|----------|-----------|----------|
| IC = 0.051 | "0.051이 무엇을 의미하는가?" | 티어 시스템: S/A/B/C/D + 색상 배지 |
| 패턴 신뢰도 = 0.73 | "73%가 좋은 것인가?" | 동종 패턴 대비 문맥적 비교 |
| MCS v2 = 62.4 | "거시 전망이 어떤가?" | 체제 라벨: "강세" + 색상 부호화 |
| Merton DD = 2.8σ | "이 기업이 안전한가?" | 부도거리 범주 표시 |
| WLS β = 0.032 | "주가가 오를 것인가?" | 기대수익률 %, 승률 %, 위험/보상 비율 |

등급 체계 (이중 구조)

본 시스템은 두 가지 독립적 등급 체계를 운용한다. 첫째, 백테스터의 신뢰도 등급(A/B/C/D)은 IC, 수익률비(profitFactor), 조정 알파의 복합 게이팅으로 패턴의 통계적 예측력을 판정한다. 둘째, 전역 상태의 승률 등급(S/A/B/C/D)은 KRX 5개년 실증 방향성 승률(Win Rate) 구간에 따라 패턴을 분류하며, S등급(WR $\geq$ 55%)부터 D등급(WR < 45%)까지 5단계로 구성된다. 두 등급은 상호 독립적이며, 신뢰도 등급이 패턴의 예측 정밀도를, 승률 등급이 패턴의 방향성 적중률을 각각 평가한다. 최종 사용자에게는 두 등급 중 더 보수적인 값이 색상 배지로 표시된다.

### 5.2.2 신뢰도 등급 체계 (Confidence Tier System)

| 등급 | IC 임계값 | 수익률비 | 최소 표본 | 사용자 의미 | 배지 색상 |
|:----:|:--------:|:-------:|:--------:|-----------|----------|
| A | > 0.02 | > 1.3 | ≥ 50 | 유의미한 예측력 | 녹색 `#2ecc71` |
| B | > 0.01 | > 1.1 | ≥ 20 | 최소 비무���위 신호 | 청색 `#3498db` |
| C | > 0.003 | — | — | 약함, 확인 필요 | 호박�� `#f39c12` |
| D | ≤ 0.01 | ≤ 1.0 | — | 감���된 우위 없음 | 회색 `#95a5a6` |

### 5.2.3 반응형 10분기점 설계 (Responsive Breakpoint Design)

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
| 티어 시스템 (통계적 유의성 범주화) | `js/backtester.js` 인라인 `reliabilityTier` 판정 (`backtestAll()` 내부) | S/A/B/C/D 분류, IC·수익률비·표본수 기준 |
| 토스트 알림 (정보 병목 압축) | `js/appUI.js` `showToast()` | 32 지표 × 46 패턴 파이프라인 → 단일 문구 전달 |
| 반응형 10분기점 (Rosenfeld-Morville IA) | `css/style.css` 10개 `@media` 쿼리 (너비 7 + 높이 3) | 모든 화면 폭에서 이론적 완전성 유지 |
| 최종 전달 문제 (Nielsen HCI 10휴리스틱) | `js/appUI.js` 온보딩·툴팁 | 시스템 상태 가시성, 오류 방지 |


## 5.3 추적 경로와 전달 도출 요약
이론적 정합성 체인의 최종 검증은 5개 대표 추적 경로를 통해 수행된다. 각 경로는 Stage 1(데이터 취득)에서 Stage 5(사용자 확인)까지 완전히 관통하며, 중간 단계 어느 곳도 생략되지 않음을 증명한다. 이 추적 가능성(traceability)은 금융 분석 도구의 핵심 신뢰 요건이다: 사용자가 화면에서 보는 모든 신호는 검증 가능한 학술 이론과 코드 함수로 역추적될 수 있어야 한다.

5개 추적 경로는 CheeseStock이 다루는 데이터 원천의 다양성을 대표한다: OHLCV 기술 분석(추적 1), DART 재무제표 기반 신용위험(추적 2), ECOS 거시경제 데이터(추적 3), KRX 수급 데이터(추적 4), VKOSPI 변동성 지수(추적 5). 각 경로가 독립적인 데이터 원천을 출발점으로 삼으면서도 동일한 신뢰도 조정 체인과 시각화 계층을 거쳐 사용자에게 전달된다는 사실이 아키텍처의 모듈성을 입증한다.

사용자 여정 10단계는 인지적 설계 원칙에 따라 구성된다. 초기 3단계(데이터 로드, Worker 초기화, 종목 선택)는 시스템 상태의 가시성을 확보하고, 중간 4단계(차트 렌더링, 거시 데이터 로드, 패턴 분석, 신뢰도 조정)는 백그라운드에서 진행되며, 최종 3단계(시각 오버레이, 패턴 패널, 재무 패널)가 사용자에게 최종 출력을 제시한다. 이 순서는 지각된 응답 시간을 최소화하면서 분석의 완전성을 보장한다.

### 5.3.1 추적 경로: OHLCV에서 매수 신호까지 (Trace: OHLCV to Buy Signal)

```
제1장: pykrx가 삼성전자(005930) OHLCV 캔들 다운로드
       → data/kospi/005930.json 저장
제2장: 2.2절 시계열분석 — EMA를 지수평활로 정의
       α = 2/(n+1), EMA_t = α·P_t + (1-α)·EMA_{t-1}
제3장: calcEMA(종가, 12)와 calcEMA(종가, 26) 산출 (EMA)
       signalEngine이 EMA_12 > EMA_26 상향 교차 감지 (골든크로스, S-1)
       복합 신호: "buy_goldenCrossRsi" (신뢰도 58%)
제4장: SignalRenderer가 교차 봉에 다이아몬드 마커 렌더링
       배경 수직 밴드가 골든크로스 구간 표시
제5장: 사용자는 차트 위 금색 다이아몬드 + 토스트 "1개 신호 감지됨" 확인
```

### 5.3.2 추적 경로: DART에서 신용위험 표시까지 (Trace: DART to Credit Risk)

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

### 5.3.3 추적 경로: ECOS에서 패턴 불투명도까지 (Trace: ECOS to Pattern Opacity)

```
제1장: ECOS API가 기준금리, 국고채 수익률, CPI 반환
       → data/macro/macro_latest.json 저장
제2장: 2.5.1-2.5.7절 거시경제학 — IS-LM 모형, 테일러 준칙 갭,
       수익률곡선 기울기, MCS v2 복합점수
제3장: MCS v2 복합점수(0-100) 산출
       _applyPhase8ConfidenceToPatterns()가 MCS 점수(±5%)와
       HMM 레짐 승수(REGIME_CONFIDENCE_MULT)를 순차 적용
       강세 레짐: 매수 패턴 × 1.06, 매도 패턴 × 0.92 (HMM 기반)
제4장: 패턴 라벨 불투명도가 조정된 신뢰도 반영 (높을수록 진하게)
제5장: 사용자는 거시 체제에 따라 달라지는 패턴 시각적 강조를 확인
```

### 5.3.4 추적 경로: KRX 수급에서 복합 신호까지 (Trace: Investor Flow to Composite Signal)

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

### 5.3.5 추적 경로: VKOSPI에서 신뢰도 조정까지 (Trace: VKOSPI to Confidence Adjustment)

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

### 5.3.6 사용자 여정 10단계 (Ten-Step User Journey)

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

### 5.3.7 종합 도출 요약 (Delivery Derivation Summary)

| Stage | 장 | 핵심 변환 | 학문 기반 |
|:-----:|:--:|----------|---------|
| 1 (데이터) | 제1장 | 원천 → 정제 OHLCV/재무/거시 | 정보과학, 데이터 공학 |
| 2 (이론) | 제2장 | 원시 수치 → 이론적 모형 | 물리·수학·통계·경영·경제·금융·행동 |
| 3 (분석) | 제3장 | 이론 → 지표·패턴·신호·신뢰도 구현 | 기술적 분석, 계량경제, 금융공학 |
| 4 (시각화) | 제4장 | 수치 → 시각적 부호 (색·형·위치) | 인지심리, 정보이론, 컴퓨터 그래픽스 |
| 5 (전달) | 제5장 | 부호 → 사용자 인지·행동 | 소프트웨어공학, HCI, 웹공학 |
| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|----------|--------------|----------|
| 전 Stage 추적 가능성 | `js/appWorker.js` `_loadMarketData()` | 5개 데이터 원천 → 신뢰도 체인 |
| OHLCV → 기술 신호 (추적 1) | `js/signalEngine.js` `goldenCross` (S-1) | EMA 교차 감지 → 다이아몬드 마커 |
| DART → Merton DD (추적 2) | `js/appWorker.js` `_applyMertonDDToPatterns()` | 재무제표 → 패턴 신뢰도 조정 |
| ECOS → MCS v2 (추적 3) | `js/appWorker.js` `_applyPhase8ConfidenceToPatterns()` | 거시 체제 → 패턴 불투명도 |
| KRX 수급 → 복합 신호 (추적 4) | `js/appWorker.js` `_loadMarketData()` investor | 기관 수급 → 신호 증폭 |
| VKOSPI → 변동성 체제 (추적 5) | `js/appWorker.js` `_macroLatest.vkospi` | 내재변동성 → 신뢰도 상하 조정 |
| 사용자 여정 10단계 | `js/app.js` `init()` → `appWorker.js` → `appUI.js` | 전체 5-Stage 파이프라인 순서화 |

\newpage


# 부록 A: 주요 용어 대조표

| 한국어 | 영어 원어 | 약어 |
|------------|------|:----:|
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
| 위험선호/회피 전환 | Risk-On/Risk-Off | RORO |
| 누적합 관리도 | Cumulative Sum Control Chart | CUSUM |
| 주성분분석 | Principal Component Analysis | PCA |
| 전진검증 효율 | Walk-Forward Efficiency | WFE |
| 다중검정 보정 | Benjamini-Hochberg False Discovery Rate | BH-FDR |
| 섹터 순환 | Stovall Sector Rotation | --- |
| 지수가중이동평균 | Exponentially Weighted Moving Average | EWMA |
| 이진 세분화 | Binary Segmentation | --- |
| 일반화 교차검증 | Generalized Cross-Validation | GCV |
| 이질적 자기회귀 실현변동성 | Heterogeneous Autoregressive Realized Volatility | HAR-RV |

---


\newpage


# 부록 B: 전체 변수 일람표

> 본 시스템에서 사용되는 모든 핵심 변수의 정의와 단위를 일괄 정리한다.
> 각 변수는 제1~5장의 해당 절로 역추적 가능하다.

\small

### B.1 가격·거래 변수 (OHLCV 파생)

| 변수 | 정의 | 단위 |
|------|------|:----:|
| Pt (close) | 종가 | 원 (KRW) |
| Ht (high) | 고가 | 원 |
| Lt (low) | 저가 | 원 |
| Ot (open) | 시가 | 원 |
| Vt (volume) | 거래량 | 주 |
| rt | 일별 수익률 (Pt - Pt₋1)/Pt₋1 | 무차원 |
| ln rt | 로그수익률 ln(Pt/Pt₋1) | 무차원 |
| DVOLt | 일별 거래대금 Pt × Vt | 원 |

### B.2 지표 변수

| 변수 | 정의 | 단위 |
|------|------|:----:|
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

### B.3 거시경제 변수

| 변수 | 정의 | 단위 | CONF 요인 |
|------|------|:----:|:--------:|
| bok_rate | 한국은행 기준금리 | % (연율) | F7, F9 |
| fed_rate | 미국 Fed Funds Rate | % (연율) | F9 |
| cpi_yoy | 소비자물가 전년비 | % (YoY) | 테일러 준칙 |
| korea_cli | OECD 경기선행지수 | 지수 (100 기준) | F1, MCS |
| vix | CBOE VIX | % | F8, RORO |
| taylor_gap | 테일러 갭 | %p | F7 |
| mcs | MCS v2 복합점수 | 0-100 (백분위) | F6 |
| rate_diff | 한미 금리차 | %p | F9 |
| cycle_phase | 경기순환 국면 | 범주형 | F1 |

### B.4 채권 변수

| 변수 | 정의 | 단위 | CONF 요인 |
|------|------|:----:|:--------:|
| slope_10y3y | 수익률 곡선 경사 | %p | F2 |
| curve_inverted | 곡선 역전 여부 | boolean | F2 |
| aa_spread | AA- 신용 스프레드 | %p | F3 |
| credit_regime | 신용 국면 | 범주형 | F3 |

### B.5 파생상품 변수

| 변수 | 정의 | 단위 | CONF 요인 |
|------|------|:----:|:--------:|
| basis | 선물 베이시스 | 포인트 | D1 |
| basisPct | 베이시스 비율 | % | D1 |
| pcr | 풋/콜 비율 | 무차원 (비율) | D2 |
| VKOSPI | 변동성지수 | % | S-28, RORO |
| foreign_net_1d | 외국인 순매수 | 억원 | D3 |
| market_short_ratio | 공매도 비율 | % | D5 |

### B.6 재무 변수

| 변수 | 정의 | 단위 | 용도 |
|------|------|:----:|------|
| revenue | 매출액 | 원 (KRW) | PSR, CAGR |
| net_income | 당기순이익 | 원 | PER, ROE |
| total_assets | 자산총계 | 원 | ROA, Merton V |
| total_liabilities | 부채총계 | 원 | Merton D |
| equity | 자본총계 | 원 | PBR, ROE |
| eps | 주당순이익 | 원/주 | PER |
| marketCap | 시가총액 | 원 | Merton E, PER |

### B.7 신뢰도 체인 출력 변수

| 변수 | 정의 | 단위 | 클램프 범위 |
|------|------|:----:|-----------|
| macroMult | 거시 승수 | 무차원 (배수) | [0.70, 1.30] |
| microMult | 미시 승수 | 무차원 (배수) | [0.55, 1.15] |
| derivMult | 파생 승수 | 무차원 (배수) | [0.70, 1.30] |
| mertonMult | Merton DD 승수 | 무차원 (배수) | [0.75, 1.15] |
| roroMult | RORO 승수 | 무차원 (배수) | [0.92, 1.08] |
| confidence | 최종 신뢰도 | 0-100 (점수) | [10, 100] 최종; ATR 3단계 동적 cap 별도 |
| _currentDD | Merton 부도거리 산출 결과 | 객체 (dd, pd, tier) | — |
| IC | 정보계수 | 무차원 (-1~+1) | — |
| WFE | Walk-Forward 효율 | % (정수 백분율) | — |
| reliabilityTier | 패턴별 통계 신뢰도 등급 | A/B/C/D (문자열) | — |

### B.8 V38-V39 신규 변수 (EVA·DuPont·eps_stability)

| 변수 | 정의 | 파일 (라인) | 용도 |
|------|------|-----------|------|
| _evaScoresData | EVA 점수 데이터 캐시 (종목별 ROIC-WACC) | appWorker.js:60 | CONF-M2 매수 패턴 부스트 원천 |
| evaSpread | EVA 스프레드 (ROIC − WACC) | appWorker.js:1909 | 가치 창출 기업 판별 (>0 → 부스트) |
| adAsShock | AD-AS 4-충격 분류 (macro_composite.adAsShock) | appWorker.js:725 | 거시 충격 유형 로깅 (범주형) |
| adAsDetail | AD-AS 충격 상세 (description 포함) | appWorker.js:727 | 충격 분류 설명 텍스트 |
| kellyFraction | Kelly 분율 (f*), [0, 1] 클램프 | backtester.js:1643 | Kelly ½ 비중 표시 (patternPanel) |
| _applyEVAConfidenceToPatterns() | EVA 기반 CONF-M2 신뢰도 조정 함수 | appWorker.js:1900 | Layer 4(미시) 직후 매수 패턴 0~15% 상향 |
| ni_history | 순이익 이력 배열 (annual NI, 최소 3기) | data.js:187 | eps_stability 산출 원천 |
| eps_stability | EPS 안정성 계수 1/(1+σ_NI/100) | appWorker.js:1807 | HHI 부스트 감쇠 (Jensen-Meckling 1976) |
| _calcInvestmentScore() | DuPont 3-Factor 투자판단 점수 (0~100) | financials.js:1022 | D열 투자판단 배지 (50+30+20 배점) |
| _getSectorAvg() | 업종 평균 조회 헬퍼 (PER/PBR/ROE/OPM) | financials.js:992 | DuPont 업종 상대평가 벤치마크 |

---

\normalsize

*총 변수 수: 68개. 본 일람표는 시스템 전체 변수의 정의-단위-원천을 단일 참조점으로 제공한다.*

---

*CheeseStock ANATOMY V8 --- 이론적 정합성 흐름 (한국어판)*
*작성일: 2026년 4월*