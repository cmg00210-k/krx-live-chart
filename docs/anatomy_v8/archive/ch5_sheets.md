\newpage

### 5.1.1 웹 전달 아키텍처 (Web Delivery Architecture)

**개요**

CheeseStock은 번들러(webpack, vite 등)를 의도적으로 배제한다. 19개 JS 파일이 `index.html`에서 `<script defer>` 태그로 직접 로드된다. 이 설계의 핵심 근거는 투명성 우선 원칙이다: 모든 함수, 상수, 공식이 브라우저 개발자도구의 소스 패널에서 직접 열람 가능하다. 금융 분석 도구에서 공식의 정확성이 도구 편의성보다 우선하며, 이는 의식적 설계 선택이다.

19개 파일의 결정론적 로드 순서는 5-Stage 이론 체인에 정확히 대응된다. 데이터 계층(colors, data, api, realtimeProvider)이 먼저 로드되어 Stage 1을 구성하고, 이론 엔진(indicators, patterns, signalEngine, backtester)이 Stage 2-3을, 렌더링 계층(chart, patternRenderer, signalRenderer, drawingTools)이 Stage 4를, 어플리케이션 계층(sidebar, patternPanel, financials, appState, appWorker, appUI, app)이 Stage 5를 담당한다. 이 순서는 전역 변수 의존성 체인이므로 위반 시 참조 오류가 발생한다.

WS/File 이중 모드는 형식적 동치 조건을 보장한다. 두 모드 모두 동일한 OHLCV 스키마를 입력으로 사용하므로 지표·패턴 연산의 입력 공간이 동일하다. 신뢰도 조정 계층의 거시·수급·파생 데이터는 JSON 파일에서 로드되며, 이 파일은 WS/File 모드와 무관하게 동일한 경로에서 동일한 내용을 참조한다. 따라서 데이터 신선도 가드가 통과하는 한 분석 결과의 모드 간 편차는 발생하지 않는다.

서비스 워커(`sw.js`)는 Cache-First 전략을 채택한다. 오프라인 상태에서도 218개 전체 공식이 가용하며(JS 내장, 서버 의존 없음), 캐시된 OHLCV 데이터에 대한 패턴 감지가 작동하고, 마지막 취득 거시데이터로 신뢰도 조정이 수행된다. 이론적 저하는 없으며 데이터 신선도만 영향을 받는다. `CACHE_NAME` 버전을 변경하면 구버전 캐시가 무효화된다.

**핵심 공식**

$$\text{Analysis}(\text{OHLCV}_{s,t},\, \text{MacroJSON}_t) \perp \text{TransportMode}$$

임의의 종목 $s$와 시점 $t$에 대해, 분석 출력은 데이터 전달 경로(WS 소켓 또는 HTTP fetch)에 무의존적이다. 이는 Stage 3의 모든 지표(I-1..I-31), 패턴(P-1..P-32), 신호(S-1..S-22), 신뢰도 조정(CONF-계층1..6)이 OHLCV 배열과 JSON 매크로 파일만을 입력으로 취하고 전달 메커니즘을 참조하지 않기 때문에 구성적으로 보장된다.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $s$ | 종목 코드 | 문자열 | Stage 1 |
| $t$ | 시점 인덱스 | 정수 | Stage 1 |
| $\text{OHLCV}_{s,t}$ | 종목 $s$의 시점 $t$ 캔들 배열 | JSON 배열 | \textcolor{stageOneMarker}{Stage 1} |
| $\text{MacroJSON}_t$ | 거시/수급/파생 JSON 파일 | JSON 객체 | \textcolor{stageTwoMarker}{Stage 2} |
| $\perp$ | 통계적 독립(무의존) | — | 형식 논리 |
| $\textcolor{stageThreeMarker}{\text{analysis}}$ | Stage 3 패턴·신호·신뢰도 결과 | JSON | \textcolor{stageThreeMarker}{Stage 3} |
| $\textcolor{stageFourMarker}{\text{chart}}$ | Stage 4 차트 렌더링 결과 | DOM Canvas | \textcolor{stageFourMarker}{Stage 4} |
| CACHE\_NAME | 서비스 워커 캐시 버전 식별자 | 문자열 | 본 Stage |
| STATIC\_ASSETS | 서비스 워커 캐시 대상 파일 목록 | 배열 | 본 Stage |
| TransportMode | WS 소켓 또는 HTTP fetch | 열거형 | 본 Stage |

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

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|----------|--------------|----------|
| 결정론적 로드 순서 (의존성 역전 원칙) | `index.html` `<script defer>` 19파일 | 전역 변수 의존성 체인 |
| 이중 모드 동치 조건 | `js/api.js` `dataService.getCandles()` | WS/File 자동 전환, 도메인 감지 |
| Cache-First 서비스 워커 | `sw.js` `CACHE_NAME`, `STATIC_ASSETS` | 오프라인 218개 공식 가용 |
| 4열 정보 아키텍처 (Rosenfeld-Morville) | `css/style.css` 4-column grid | A(탐색)/B(분석)/C(패턴)/D(재무) 열 분리 |

\newpage

### 5.2.1 사용자 전달과 반응형 설계 (User Delivery & Responsive Design)

**개요**

최종 전달 문제(Last Mile Problem)는 수학적으로 정밀한 이론 출력을 사용자 행동으로 연결하는 과제이다. IC = 0.051, DD = 2.8σ, MCS v2 = 62.4와 같은 원시 출력은 그 자체로는 사용자에게 직관적이지 않다. CheeseStock의 Stage 5는 이 격차를 티어 시스템, 토스트 알림, 반응형 레이아웃의 세 가지 메커니즘으로 해소한다.

5단계 티어 시스템(S/A/B/C/D)은 통계적 유의성을 실행 가능한 범주로 변환한다. 각 티어는 IC(정보계수) 임계값, 수익률비, 최소 표본 수의 세 기준을 복합적으로 적용하여 `backtester.js`의 `_assignGrade()` 함수에서 산출된다. 색상 배지(녹색/청색/호박색/회색)는 KRX 색상 규약과 독립적으로, 패턴의 통계적 품질 수준만을 시각화한다.

정보 병목(Information Bottleneck) 이론에 의하면 복잡한 입력 분포에서 과업 관련 정보만을 추출하는 최적 압축 표현이 존재한다. 토스트 알림 "N개 패턴 감지됨"은 이 원리를 구현한다: 30+ 지표 × 45 패턴 × 10 신뢰도 조정의 복합 파이프라인 출력을 단일 행동 유도 문구로 압축한다. 사용자가 추가 정보를 원할 경우 C열 패턴 패널에서 상세 정보를 확인할 수 있다.

반응형 8분기점 설계의 핵심 원칙은 이론적 완전성이 모든 화면 크기에서 유지된다는 것이다. 분석 파이프라인은 화면 크기와 무관하게 동일하게 실행되며, 모바일 사용자도 데스크톱 사용자와 동일한 IC 검증, 신뢰도 조정, 패턴 신호를 수신한다. 화면 크기에 따라 변화하는 것은 정보의 표시 방식이지 정보의 내용이 아니다.

**핵심 공식**

$$\text{Toast} = f_{\text{compress}}\!\left(\bigcup_{i=1}^{45} \text{Pattern}_i \times \prod_{k=1}^{6} \text{CONF}_k\right) \to \text{"N개 패턴 감지됨"}$$

여기서 $f_{\text{compress}}$는 정보 병목 원리에 의한 손실 압축 함수이다. 45개 패턴의 합집합에 6개 신뢰도 계층의 곱을 적용한 전체 결과가 토스트 단일 문구로 압축된다.

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $f_{\text{compress}}$ | 정보 병목 압축 함수 | — | 정보이론 |
| $\text{Pattern}_i$ | 제 $i$번 패턴 (i = 1..45) | 신뢰도 스칼라 | \textcolor{stageThreeMarker}{Stage 3} |
| $\text{CONF}_k$ | 제 $k$번 신뢰도 조정 계층 (k = 1..6) | 승산 계수 | \textcolor{stageThreeMarker}{Stage 3} |
| S 티어 | IC > 0.03, 수익률비 > 1.5, n ≥ 100 | — | 본 Stage |
| A 티어 `#2ecc71` | IC > 0.02, 수익률비 > 1.3, n ≥ 50 | RGB hex (녹색) | 본 Stage |
| B 티어 `#3498db` | IC > 0.01, 수익률비 > 1.1, n ≥ 20 | RGB hex (청색) | 본 Stage |
| C 티어 `#f39c12` | IC > 0.003 | RGB hex (호박색) | 본 Stage |
| D 티어 `#95a5a6` | IC ≤ 0.01, 수익률비 ≤ 1.0 | RGB hex (회색) | 본 Stage |
| IC | 정보계수 (Information Coefficient) | 무차원 | \textcolor{stageThreeMarker}{Stage 3} |

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

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|----------|--------------|----------|
| 티어 시스템 (통계적 유의성 범주화) | `js/backtester.js` `_assignGrade()` | S/A/B/C/D 분류, IC·수익률비·표본수 기준 |
| 토스트 알림 (정보 병목 압축) | `js/appUI.js` `showToast()` | 30+ 지표 파이프라인 → 단일 문구 전달 |
| 반응형 8분기점 (Rosenfeld-Morville IA) | `css/style.css` 8개 `@media` 쿼리 | 모든 화면 폭에서 이론적 완전성 유지 |
| 최종 전달 문제 (Nielsen HCI 10휴리스틱) | `js/appUI.js` 온보딩·툴팁 | 시스템 상태 가시성, 오류 방지 |

\newpage

### 5.3.1 추적 경로와 전달 도출 요약 (Traceability & Delivery Summary)

**개요**

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

**CheeseStock 적용**

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
