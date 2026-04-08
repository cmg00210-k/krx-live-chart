# CheeseStock
## ANATOMY V7

> **분류**: 내부 / 투자자 열람용
> **버전**: V7 (2026년 4월 7일)
> **저자**: Sunho Lee · Mingyu Choi (공동 창업자)
> **문서 시리즈**: 4개 산출물 중 제4호 (경영진 요약 / 기술 아키텍처 / 부록 / 구조 흐름)
> **대상 독자**: 기술 투자자, 시니어 엔지니어, 퀀트 리서처

---

### 5-Stage 구조 개요

| Stage | 주제 | 핵심 지표 | 설득 역할 |
|------|------------|------------|------|
| **Stage 1** | 문제 정의와 시장 기회 | 2,696종목, 19 JS, 빌드 없음 | 왜 필요한가 |
| **Stage 2** | 데이터 기반과 신뢰 체계 | 5 API, 60+ JSON, 95.3% DART | 데이터 해자 |
| **Stage 3** | 분석 엔진과 신호 체계 | 45패턴, 10-함수 체인, IC 0.051 | IP 핵심 |
| **Stage 4** | 검증과 리스크 통제 | 303,956건, 7-게이트, OOS 기각 | 정직함 = 신뢰 |
| **Stage 5** | 로드맵과 확장 전략 | MRA→RL, Koscom 전환 | 미래 방향 |

> 본 문서는 CFA 설득 프레임워크(SCQA)에 따라 구성되었다. 설득의 정점은 Stage 3(기술력)이 아닌 **Stage 4(검증의 정직성)**에 있다 — OOS 백테스트에서 과적합을 거부하고 학술적 기본값을 선택한 사실, 이것이 핵심 메시지다.

---

# Stage 1: 문제 정의와 시장 기회

> **Stage 1 / 5** | 출처: `S5_lifecycle_workers_v7.md`, `S5_ui_architecture_v7.md`, `S0_index_v7.md` | V7 (2026-04-07)

*한국의 개인·기관 투자자에게는 **검증된 신뢰 분석 도구**가 없다. 기존 도구들은 시뮬레이션 데이터를 실제로 위장하고, 학술적 근거 없는 매직 넘버에 의존한다.*

> **[핵심 요약]** 2,696개 전 종목 대상, 19개 JS 파일(빌드 시스템 없음), 45개 패턴 탐지, 10-함수 신뢰도 체인, IC = 0.051(t = 3.73). 브라우저 단독 실행 — 설치/서버 불필요, WebSocket 연결 시 자동 실시간 전환.

---

## 1.1 해결하려는 문제

한국 주식 시장(KRX)에서 기술 분석 도구를 사용하는 투자자들은 세 가지 구조적 문제에 직면한다.

**첫째, 신뢰도 결여.** 기존 차트 플랫폼은 패턴을 탐지하면 단순히 "강세" 또는 "약세" 라벨을 붙인다. 그 패턴이 현재 거시경제 환경, 신용 리스크, 유동성 조건에서 얼마나 신뢰할 수 있는지에 대한 정보는 제공하지 않는다. 투자자는 패턴의 기하학적 품질과 시장 맥락에서의 예측력을 구분할 방법이 없다.

**둘째, 데이터 투명성 결여.** 많은 플랫폼이 재무 데이터의 출처를 밝히지 않으며, 일부는 시뮬레이션 데이터를 실제 데이터로 위장한다. 투자자가 보는 PER, PBR, ROE 수치가 DART(금융감독원 전자공시시스템)에서 온 것인지, 아니면 임의로 생성된 것인지 알 수 없다.

**셋째, 학술적 근거 없는 매직 넘버.** "RSI가 70 이상이면 과매수"와 같은 고정된 임계값은 Wilder(1978)가 미국 선물 시장 14일 기준으로 제시한 수치다. 한국 주식 시장의 변동성 구조, +-30% 가격 제한, 한국 특유의 투자자 구성(외국인/기관/개인 3분법)을 반영한 적응형 기준값은 존재하지 않았다.

CheeseStock은 이 세 가지 문제를 공학적으로 해결한다.

---

## 1.2 플랫폼 정체성

CheeseStock(cheesestock.co.kr)은 한국거래소(KRX) 상장 전 종목(KOSPI + KOSDAQ, 2,696개)을 대상으로 하는 브라우저 네이티브 기술 분석 플랫폼이다. 실시간 차트, 45개 유형의 자동 패턴 탐지(Pattern Detection), 10-함수 거시-미시 신뢰도 보정 체인, K-IFRS 재무 패널을 단일 페이지 웹 애플리케이션으로 제공하며, 설치 불필요, 서버 로직 제로.

아키텍처를 정의하고 모든 후속 결정을 제약하는 세 가지 설계 선택:

1. **빌드 시스템 없음(No Build System)**: 모든 JavaScript가 브라우저에서 직접 실행된다. webpack, rollup, esbuild, 트랜스파일러가 없다. 전역 변수와 로드 순서로 모듈 시스템을 대체한다.

2. **듀얼 모드 운영(Dual-Mode Operation)**: 모든 코드 경로는 WebSocket(실시간, 키움 OCX 피드) 모드와 파일(정적 JSON) 모드 양쪽에서 동작해야 한다. 파일 모드가 기본값이며, WebSocket은 초기 렌더링을 차단하지 않는 백그라운드 업그레이드다.

3. **전진 실패 전략(Fail-Forward Degradation)**: 데이터 누락이나 지연은 분석 깊이를 줄이지만 세션을 종료하지 않는다. 신뢰도 체인은 해당 조정 인자를 조용히 건너뛰고, 차트는 줄어든 신뢰도 점수로 계속 렌더링된다.

---

## 1.3 기술 스택

### 1.3.1 무빌드(No-Build), 무프레임워크(Zero-Framework) 아키텍처

| 계층 | 기술 | 선택 근거 |
|------|------|----------|
| 런타임 | 브라우저(Chrome/Edge/Firefox) | 서버 실행 불필요 |
| JS 모듈 시스템 | 없음 -- 전역 변수, `<script defer>` | 번들러 불필요; HTML에서 로드 순서 강제 |
| CSS 프레임워크 | 없음 -- 커스텀 CSS 변수(`var(--*)`) | 완전한 제어, 특이도(specificity) 충돌 없음 |
| 차트 라이브러리 | TradingView Lightweight Charts v5.1.0 (CDN) | KRX HTS급 캔들스틱, ISeriesPrimitive API |
| 한국어 폰트 | Pretendard (jsDelivr CDN) | KS X 1001 커버리지, 한국어 줄바꿈(word-break) |
| 고정폭 폰트 | JetBrains Mono (Google Fonts) | 가격 정렬용 탭형 숫자(tabular numerals) |
| 패키지 매니저 | 없음 | `node_modules` 없음, 잠금 파일(lock file) 없음 |
| 빌드 단계 | 없음 | 소스에서 직접 배포, `stage_deploy.py`가 파일 스테이징 |
| 호스팅 | Cloudflare Pages | 글로벌 엣지 CDN, 에셋당 25MB 제한 |
| 로컬 개발 | `npx serve` 또는 VS Code Live Server | HTTP 필수(CORS가 `file://`을 차단) |

출처: `CLAUDE.md` 프로젝트 개요; `S5_ui_architecture_v7.md` sec 5.1.

### 1.3.2 CDN 의존성

| 라이브러리 | CDN | 용도 | 무결성 |
|-----------|-----|------|--------|
| LWC v5.1.0 | unpkg.com | 차트 캔버스 + ISeriesPrimitive | verify.py 5c에서 SRI 검증 |
| Pretendard | jsDelivr | 한국어 폰트(한글 렌더링) | SRI 미적용(CSS 엔드포인트) |
| JetBrains Mono | Google Fonts | 고정폭 가격 표시 | 해당 없음 |

### 1.3.3 JavaScript 파일 인벤토리(21개 파일, 32,491줄)

| 계층 | 파일 | 줄 수 | 주요 내보내기(exports) |
|------|------|------|---------------------|
| 데이터 | colors.js, data.js, api.js, realtimeProvider.js | 1,869 | `KRX_COLORS`, `dataService`, `ALL_STOCKS` |
| 분석 | indicators.js, patterns.js, signalEngine.js, backtester.js | 12,249 | `patternEngine`, `signalEngine`, `backtester`, `IndicatorCache` |
| 렌더링 | chart.js, patternRenderer.js, signalRenderer.js | 4,547 | `chartManager`, `patternRenderer`, `signalRenderer` |
| UI | sidebar.js, patternPanel.js, financials.js, drawingTools.js | 7,051 | `sidebarManager`, `renderPatternPanel()`, `updateFinancials()` |
| 오케스트레이션 | appState.js, appWorker.js, appUI.js, app.js | 6,225 | 전역 상태, Worker 생명주기, DOM 이벤트, `init()` |
| Workers | analysisWorker.js, screenerWorker.js | 667 | 별도 스레드 패턴 분석 및 종목 스크리닝 |

스크립트 로드 순서는 19개 메인 스레드 파일에서 고정이다(`CLAUDE.md` 참조). 이전 스크립트의 전역 변수를 다음 스크립트가 참조하므로, 순서를 바꾸면 참조 오류가 발생한다.

출처: `S5_ui_architecture_v7.md` lines 111-118 테이블.

---

## 1.4 규모 요약

V7 프로덕션 아나토미와 303,956 인스턴스 백테스트 코퍼스의 정확한 수치를 사용한다.

| 지표 | 값 | 출처 |
|------|---|------|
| 커버 상장 종목 수 | 2,696 | `data/index.json` (KOSPI + KOSDAQ) |
| DART 재무 데이터 커버리지 | 2,607 / 2,736 (95.3%) | `S1_api_pipeline_v7_sec5to8.md` §1.6.6 |
| 기술적 패턴(45 유형) | 45 | `S3_ta_methods_v7.md` P-01..P-45 |
| 지표(I-01..I-32) | 32 | `S3_ta_methods_v7.md` §3.1 |
| 신호 유형(기본 + 복합) | 49+ | `S3_signal_backtester_v7.md` |
| 문서화된 수식 | 218 | `S0_index_v7.md` 수식 레지스트리 |
| 등급 분류 상수 | 306+ | A(60)/B(90)/C(70)/D(85)/E(1) |
| JavaScript 소스 줄 수 | 32,491 | 21개 파일 |
| Python 스크립트 | 58 | 다운로드 13 + 연산 15 + 인프라 30 |
| 외부 API | 5 (+ OECD) | ECOS, FRED, KRX/pykrx, DART, KOSIS |
| JSON 데이터 파일(파이프라인) | 60+ | `S1_api_pipeline_v7_sec5to8.md` §1.6 |
| 백테스트 인스턴스 | 303,956 | 2,704 종목 x 패턴 유형, 2021-03~2026-03 (5년) |
| 학술 참고 문서 | 49 | `core_data/` 디렉터리 |
| ANATOMY 문서 | 19 | `docs/anatomy/` V7 스위트 |

---

## 1.5 듀얼 모드 아키텍처

### 1.5.1 설계 근거

CheeseStock은 두 가지 런타임 컨텍스트를 제공한다:

- **프로덕션 / 유료 사용자**: 도메인 `cheesestock.co.kr` -- 실시간 키움 OCX WebSocket 피드, `ws_server.py`(Python 3.9 32-bit, Windows 전용) 경유.
- **데모 / 개발 / Cloudflare Pages**: `data/` 디렉터리의 정적 JSON 파일 -- 서버 불필요, 사전 계산된 데이터로 완전한 분석 가능.

동일한 애플리케이션 코드가 `api.js initFromIndex()`의 도메인 감지를 통해 양쪽 컨텍스트를 처리한다. 파일 모드부터 렌더링한 후, WebSocket은 백그라운드에서 조용히 업그레이드된다.

### 1.5.2 모드 감지 흐름

```
DUAL-MODE DETECTION SEQUENCE
==============================

  app.js init()
       |
       v
  dataService.initFromIndex()
       |
       +-- Mode = 'file' (immediate, non-blocking)
       |
       +-- probeWsServer(wsUrl, 3000ms) -- async background
       |        |
       |        |  Domain check (api.js):
       |        |  cheesestock.co.kr / .pages.dev --> wss://...
       |        |  localhost                       --> ws://localhost:8765
       |        |
       |        +-- WS open within 3s?
       |              YES --> Mode = 'ws'  (background upgrade)
       |              NO  --> Mode = 'file' (unchanged)
       |
       +-- fetch('data/index.json')
       |      |
       |      +-- ALL_STOCKS populated (2,696 entries)
       |      +-- Console: "[KRX] index.json 로드 완료: N종목"
       |
       v
  _continueInit() -- chart renders immediately (file mode)
```

3초 프로브 타임아웃은 의도적이다: 느린 연결이나 오프라인 모드의 사용자도 대기 없이 완전한 기능의 차트를 본다. WebSocket 업그레이드는 성공하면 사용자에게 보이지 않으며, 실패해도 파일 모드 데이터가 이미 화면에 표시되어 있다.

출처: `S5_lifecycle_workers_v7.md` sec 5.5.2 "Mode Detection Flow".

### 1.5.3 모드별 데이터 흐름 비교

| 차원 | 파일 모드(정적) | WS 모드(실시간) |
|------|---------------|---------------|
| OHLCV 소스 | `data/{market}/{code}.json` | 키움 TR 구독(OCX) |
| 장중 소스 | `data/{code}_{timeframe}.json` | 실시간 체결 틱 누적 |
| 캔들 지연 | 사전 계산(일일 cron) | 틱 도착 시 서브초(sub-second) |
| 연결 요구사항 | 없음(CDN 제공) | 키움 API 로그인 + WS 서버 |
| 데모 폴백 | 있음(결정론적 시드 PRNG) | 연결 해제 시 파일 폴백 |
| 분석 파이프라인 | 동일(patternEngine / signalEngine / backtester) | 동일 |
| 신뢰도 체인 | 동일(10개 함수 전체) | 동일 |

핵심 아키텍처 불변식: **분석 파이프라인은 모드를 인지하지 않는다.** `patternEngine.analyze(candles)`는 캔들의 출처가 JSON이든 WebSocket이든, 동일한 데이터 구조를 수신한다. 모드 인식은 전적으로 `api.js`와 `realtimeProvider.js`에 캡슐화되어 있다.

출처: `CLAUDE.md` 핵심 원칙; `S5_lifecycle_workers_v7.md` sec 5.5.2.

---

### Stage 1 요약

Stage 1은 CheeseStock에 대한 다음 구조적 사실을 확립했다:

- 서버 측 비즈니스 로직이 전혀 없는, 21개 파일/32,491줄의 무빌드 브라우저 애플리케이션.
- 파일 모드를 비차단 기본값으로 하는 듀얼 모드(WebSocket / JSON 파일) 운영.
- 2,696개 종목을 가상 스크롤(~40개 DOM 노드)로 제공하는 4-컬럼 CSS Grid UI와 45개 패턴 유형.
- 무거운 연산을 메인 스레드에서 격리하는 2개의 Web Worker(분석 + 스크리너).

Stage 2에서는 이 시스템에 데이터를 공급하는 출처와 신뢰 아키텍처를 검토한다.

---

# Stage 2: 데이터 기반과 신뢰 체계

> **Stage 2 / 5** | 출처: `S1_api_pipeline_v7_sec1to4.md`, `S1_api_pipeline_v7_sec5to8.md`, `S1_api_pipeline_v7_sec9.md`, `S3_confidence_chain_v7.md` | V7 (2026-04-07)

*분석 결과를 보여주기 전에, 입력 데이터 자체가 신뢰할 수 있어야 한다. 해자(moat)는 알고리즘이 아니라 데이터 품질이다.*

> **[핵심 요약]** DART·KRX·ECOS·FRED·KOSIS 5개 공공 API → 13개 다운로드 + 15개 연산 스크립트 → 60개 JSON 파일. 3-tier 신뢰 등급(dart/hardcoded/seed)으로 시뮬레이션 데이터 원천 차단. DART 재무제표 커버리지 95.3%(2,607/2,736개 종목).

---

## 2.1 데이터 출처가 중요한 이유

기술 분석은 그 근거가 되는 데이터만큼만 신뢰할 수 있다. 한국 시장 맥락에서 세 가지 구조적 위험이 데이터 출처 관리를 복잡하게 만든다:

1. **소스 이질성**: 가격 데이터(KRX/pykrx), 거시 데이터(ECOS/FRED/KOSIS), 재무 데이터(DART), 파생상품 데이터(KRX API)는 각각 다른 업데이트 주기, 인증 체계, 실패 모드를 따른다.

2. **무성 열화(Silent Degradation)**: `daily_update.bat` 파이프라인은 전진 실패(fail-forward) 설계를 따른다 -- 초기 건강 확인 이후 모든 다운로드 단계에서 경고를 출력한 뒤 진행을 계속한다. 거시 다운로드가 완전히 실패해도 사용자에게 오류가 표시되지 않으며, 신뢰도 체인이 해당 조정 인자를 조용히 건너뛸 뿐이다.

3. **시드 데이터 오염**: DART 재무 데이터가 없는 종목에 대해 시스템은 코드 해시 기반 난수로 가상 재무 데이터를 생성한다(시드 데이터). 이를 실제 데이터로 위장하면 사용자를 중대하게 오도한다. 신뢰 체계가 렌더 계층에서 이를 방지한다.

이 Stage는 API 호출부터 JSON 파일을 거쳐 브라우저 변수에 이르는 완전한 체인, 재무 데이터에 적용되는 3-tier 신뢰 분류, 데이터 품질 실패를 감지하고 격리하는 메커니즘을 문서화한다.

---

## 2.2 API 소스 맵

### 2.2.1 5개 외부 API

CheeseStock은 5개의 주요 외부 API와 OECD SDMX 엔드포인트(거시 파이프라인에 통합)를 연동한다. 각 API는 고유한 분석 도메인을 담당한다.

| API 소스 | 인증 | 다운로드 스크립트 | 출력 JSON 파일 | 데이터 범주 |
|----------|------|-----------------|---------------|-----------|
| **ECOS** (한국은행) | API 키 필요 | `download_macro.py` | `macro_latest.json` | 기준금리, CLI, CPI, 환율 |
| | | `download_bonds.py` | `bonds_latest.json`, `bonds_history.json` | 국고채 수익률 곡선 |
| | | `download_market_context.py` | `market_context.json` | CCSI(소비자 심리) |
| **FRED** (FRB St. Louis) | API 키 필요 | `download_macro.py` (ECOS와 통합) | `macro_latest.json`에 병합 | fed_rate, vix, us10y, dxy |
| **KRX** (pykrx v1.2.4) | 인증 불필요 | `download_ohlcv.py` | kospi/, kosdaq/ {code}.json | 종목별 OHLCV |
| | | `download_market_index.py` | market/kospi_daily.json 등 | 시장 지수 |
| **KRX OpenAPI** (옵션/선물/투자자/ETF) | 인증 불필요 | `download_derivatives.py` | `derivatives_summary.json` | 선물·옵션 요약 |
| | | `download_investors.py` | `investor_summary.json` | 투자자별 수급 |
| | | `download_etf.py` | `etf_summary.json` | ETF 자금 흐름 |
| | | `download_shortsell.py` | `shortselling_summary.json` | 공매도 비율 |
| **DART** (FSS OPENDART) | API 키 필요 | `download_financials.py` | financials/{code}.json (2,607개) | K-IFRS 연결재무제표 |
| **KOSIS** (KOSTAT) | 인증 불필요 | `download_kosis.py` | `kosis_latest.json` | CLI, ESI, IPI, CP yield, CPI |
| **OECD** SDMX | 인증 불필요 | `fetch_oecd_cli()` (macro.py 내부) | `macro_latest.json`에 병합 | korea/china/us CLI |

출처: `S1_api_pipeline_v7_sec1to4.md` §1.1-1.4.

### 2.2.2 연산 스크립트: 다운로드 후 오프라인 변환

15개 연산 스크립트(Compute Script)가 다운로드 이후에 실행되어 원시 JSON 파일을 읽고 파생 분석을 생산한다. 외부 API를 호출하지 않으며 동일 호스트에서 실행된다.

| 스크립트 | 입력 | 출력 | 방법론 |
|---------|------|------|-------|
| compute_macro_comp | macro, bonds, kosis | macro_composite.json | MCS v2, Taylor Rule |
| compute_options_anal | options, bonds, kospi200 | options_analytics.json | BSM IV, 스트래들 내재 변동 |
| compute_capm_beta | OHLCV, 지수, bonds, financials | capm_beta.json | OLS/Scholes-Williams 베타, Merton DD |
| compute_basis | derivatives, bonds | basis_analysis.json | Cost-of-carry, 초과 베이시스 |
| compute_eva | financials, capm_beta, macro | eva_scores.json | NOPAT, WACC, EVA 스프레드 |
| compute_hmm_regimes | OHLCV (시총 가중) | hmm_regimes.json | Baum-Welch EM, 2-상태 HMM |
| compute_flow_signals | 투자자, hmm_regimes | flow_signals.json | 외국인 모멘텀, 개인 역방향 |
| compute_bond_metrics | bonds_latest | bond_metrics.json | Duration, DV01, Convexity |
| compute_illiq_spread | 종목별 OHLCV | illiq_spread.json | Amihud ILLIQ, Roll 스프레드 |
| compute_survivorship_corr | pattern_performance | survivorship_correction.json | 상장/통합 delta_wr |

출처: `S1_api_pipeline_v7_sec5to8.md` §1.5.1-1.5.15.

---

\clearpage

## 2.3 데이터 신뢰 의사결정 트리

### 2.3.1 3-Tier 재무 데이터 신뢰 체계

DART 재무 데이터 커버리지는 95.3%(2,607 / 2,736 종목)이다. 나머지 4.7%와 DART 파일 조회 실패 종목에 대해 시스템은 3-tier 신뢰 체인을 통해 폴백한다. 티어가 컬럼 D(재무 패널)에서 어떤 재무 지표를 렌더링할지 결정한다.

**의사결정 흐름:** `getFinancialData(code)` 호출 시 다음 순서로 폴백한다.

| 단계 | 조건 | 결과 Tier | 다음 단계 |
|------|------|----------|----------|
| 1. 메모리 캐시 (`_financialCache`) | 캐시 히트 | 기존 tier 그대로 반환 | — |
| 2. `fetch financials/{code}.json` (10초 타임아웃) | 200 OK + `source != 'seed'` | **Tier 1: DART** | — |
| | fetch 오류 또는 404 | — | 단계 3으로 |
| | `source == 'seed'` | — | 단계 3으로 |
| 3. `getPastData(code)` | 삼성전자/SK하이닉스 (PAST_DATA에 존재) | **Tier 2: hardcoded** | — |
| | 그 외 | **Tier 3: seed** (해시 PRNG) | — |

**Tier별 표시 정책:**

| Tier | source 값 | 재무 지표 표시 | 동종 그룹 | 비고 |
|------|----------|-------------|----------|------|
| **1** | `'dart'` | PER, PBR, PSR, ROE, ROA, EVA, Merton DD 전체 표시 | 활성화 | — |
| **2** | `'hardcoded'` | 전체 표시 + 경고 배지 "하드코딩된 데이터" | 활성화 (tier 불일치 필터) | 삼성/SK하이닉스 2종목 |
| **3** | `'seed'` | **모든 지표 `'---'`로 표시** | 제외 | 시드 데이터는 실제 수치로 절대 표시하지 않음 |

출처: `.claude/rules/financial.md` 데이터 신뢰 체계; `S1_api_pipeline_v7_sec5to8.md` §1.6.6.

### 2.3.2 시드 데이터 오염 방지

시드 데이터를 실제 데이터로 표시하는 것을 금지하는 정책은 세 계층에서 집행된다:

**계층 1 -- 렌더 가드(`financials.js`)**: `source === 'seed'`일 때 `updateFinancials()` 함수는 DOM 업데이트 전에 모든 지표 필드를 `'---'`로 초기화한다. 시드에서 파생된 어떤 숫자도 `textContent`에 도달하지 않는다.

**계층 2 -- 연산 스크립트 가드**: `compute_eva.py` 및 기타 연산 스크립트는 `source in ('seed', 'demo')`인 재무 입력을 거부한다. 시드 데이터 EVA 점수가 `eva_scores.json`에 유입되지 않도록 차단한다.

**계층 3 -- 동종 그룹 필터**: `sidebarManager`의 동종 그룹(Peer Group) 계산은 시드로 태그된 종목을 업종 비교 풀에서 제외한다. 시드 종목이 업종 중위값 PER/PBR을 부풀리거나 축소할 수 없다.

이 보장이 깨지는 유일한 시나리오는 파일을 직접 변조하여 거짓 데이터에 `source: 'dart'`를 표시하는 것이다. 정상 파이프라인에서는 `download_financials.py`가 DART API 응답으로부터만 source 값을 설정하므로 이 상황은 발생하지 않는다.

---

## 2.4 JSON 파일 카탈로그 요약

파이프라인에 참여하는 60개 이상의 JSON 파일은 6개 기능 범주에 속한다. 종목별 OHLCV 파일(약 2,696개, `data/kospi/` 및 `data/kosdaq/`)은 개별 열거하지 않는다.

모든 경로는 `data/` 기준 상대 경로이다.

### 범주 1: 종목 유니버스와 가격

| 파일 | 생산자 | JS 소비자 | 필수 키 |
|------|-------|----------|---------|
| index.json | download_ohlcv / update_index_prices | `ALL_STOCKS` | `stocks` 배열 |
| {market}/{code}.json | download_ohlcv | `dataService.getCandles()` | OHLCV 배열 |
| {code}_{tf}.json | generate_intraday | `dataService.getCandles()` | 장중 OHLCV |
| market/kospi_daily.json | download_market_index | `backtester._marketIndex` | `time`, `close` |
| market/kosdaq_daily.json | download_market_index | financials.js 동종 그룹 | `time`, `close` |

### 범주 2: 거시 경제와 통화 정책

| 파일 | 생산자 | JS 변수 | 필수 키 |
|------|-------|--------|---------|
| macro/macro_latest.json | download_macro | `_macroLatest` | updated, mcs, vix, bok_rate |
| macro/bonds_latest.json | download_bonds | `_bondsLatest` | updated, yields |
| macro/kosis_latest.json | download_kosis | `_kosisLatest` | updated, source |
| macro/macro_comp.json | compute_macro_comp | `_macroComposite` | mcsV2 |
| macro/bond_metrics.json | compute_bond_metrics | `_bondMetricsCache` | benchmarks, curveShape |
| market_context.json | download_market_context | `_marketContext` | ccsi, vkospi, net_foreign_eok |

### 범주 3: 파생상품과 시장 구조

| 파일 | 생산자 | JS 변수 | 가드 |
|------|-------|--------|------|
| deriv/derivatives_summary | download_derivatives | `_derivativesData` | source != sample |
| deriv/investor_summary | download_investors | `_investorData` | source != sample |
| deriv/etf_summary | download_etf | `_etfData` | source != sample |
| deriv/shortselling_summary | download_shortselling | `_shortSellingData` | source != sample/unavailable |
| deriv/options_analytics | compute_options_anal | `_optionsAnalytics` | status != error |
| deriv/basis_analysis | compute_basis | `_derivativesData` 병합 | — |
| vkospi.json | download_vkospi | `_macroLatest.vkospi` 주입 | — |

### 범주 4: 행동 분석과 백테스트

| 파일 | 생산자 | JS 소비자 | 비고 |
|------|-------|----------|------|
| backtest/capm_beta.json | compute_capm_beta | backtester._capmBeta | CAPM 베타 + Merton DD |
| backtest/eva_scores.json | compute_eva | _evaCache | 종목별 EVA 스프레드 |
| backtest/hmm_regimes.json | compute_hmm_regimes | backtester._behavioralData | 2-상태 HMM; 30일 게이트 |
| backtest/illiq_spread.json | compute_illiq_spread | backtester._behavioralData | Amihud ILLIQ, Roll 스프레드 |
| backtest/flow_signals.json | compute_flow_signals | _flowSignals | HMM + 외국인 모멘텀 |
| backtest/survivor_corr.json | compute_survivor_corr | backtester._survivorCorr | delta_wr_median |
| backtest/rl_policy.json | compute_rl_policy (오프라인) | backtester._rlPolicy | IC < 0 게이트 기각 |

### 범주 5: 기본적 재무 데이터

| 파일 | 생산자 | JS 소비자 | 신뢰 티어 |
|------|-------|----------|----------|
| financials/{code}.json (2,607개) | download_financials (DART) | _financialCache | Tier 1(dart) / Tier 3(seed) |
| macro/ff3_factors.json | compute_ff3_factors | _ff3Cache | Fama-French 3-요인 |
| sector_fundamentals.json | download_sector | _sectorData | 동종 그룹 중위값 |

### 범주 6: 미사용 데이터 경로(감사 발견 사항)

두 개의 연산 스크립트가 JavaScript 소비자 없는 출력 파일을 생산한다. 이는 아직 브라우저 파이프라인에 연결되지 않은 분석가 작업을 나타낸다:

| 파일 | 생산자 | 상태 |
|------|-------|------|
| deriv/hedge_analytics | compute_hedge_ratio | JS 소비자 없음; 파일 부재 |
| backtest/krx_anomalies.json | compute_krx_anomalies | JS 소비자 없음; 배포 제외 |

출처: `S1_api_pipeline_v7_sec5to8.md` §1.5.13-1.5.14, §1.6.4.

---

\clearpage

## 2.5 파이프라인 신뢰성 요약

### 2.5.1 전체 건강 평가

V7 신뢰성 감사(2026-04-06 실시, `S1_api_pipeline_v7_sec9.md`에 문서화)는 18-단계 `daily_update.bat` 파이프라인을 평가하고 3개 심각도 티어에 걸쳐 17건의 발견 사항을 식별했다.

| 심각도 | 건수 | 범위 |
|--------|------|------|
| P0 위험(CRITICAL) | 4 | 무성 실패 + 오래된 캐시 벡터 |
| P1 높음(HIGH) | 5 | 하류 영향을 동반한 부분 데이터 손실 |
| P2 보통(MEDIUM) | 8 | 표시 / 정보성 차이 |

파이프라인 전체는 **전진 실패(fail-forward)** 설계를 따른다. Step 0(API 건강 확인)만이 유일한 중단점이고, Step 1-18은 경고를 출력한 뒤 진행을 계속한다. 따라서 개별 단계가 실패해도 파이프라인은 항상 종료 코드 0으로 완료된다. 부분 데이터가 데이터 부재보다 낫다는 설계 철학이나, 오래된 데이터가 조용히 사용될 수 있는 무성 열화 위험이 수반된다.

### 2.5.2 4건의 P0 위험 발견 사항

**P0-1: VKOSPI 다운로드 실패가 무성(silent)**

`download_vkospi.py`가 `daily_update.bat` Step 6에서 오류 포착 없이 호출된다. 실패 시 `data/vkospi.json`이 어떤 `WARNING` 로그 항목 없이 오래된 상태가 된다. VKOSPI 시계열은 변동성 레짐 분류(`vkospiClose > 25` = 고변동성 레짐)의 주요 입력이다. 오래된 VKOSPI는 시장을 저변동성으로 잘못 분류하여 강세 패턴의 신뢰도 점수를 부풀릴 수 있다.

**P0-2: 투자자 수급 다운로드 실패가 무성**

마찬가지로 Step 7의 `download_investor.py`에 오류 포착이 없다. 무성 실패는 `investor_summary.json`을 오래된 상태로 둔다. `appWorker.js`(lines 318-325)의 샘플 데이터 가드는 `source === 'sample'`일 때 이 변수를 무효화하지만, 실제 `source` 값을 여전히 보유한 오래된 파일은 오래된 외국인 수급 데이터를 `_applyDerivativesConfidenceToPatterns()`에 전파한다.

**P0-3: Worker 생성자 버전이 verify.py 범위 밖**

`appWorker.js`가 하드코딩된 버전 문자열로 분석 Worker를 생성한다: `new Worker('js/analysisWorker.js?v=N')`. 이 버전은 `verify.py` CHECK 5f에서 검증되지 않는다(CHECK 5f는 `analysisWorker.js` 내의 `importScripts()` 호출만 `index.html` 스크립트 태그와 비교). `appWorker.js` line 38이 `analysisWorker.js` 변경 시 업데이트되지 않으면, 캐시된 구 Worker 바이너리를 가진 브라우저가 구 분석 엔진을 조용히 실행한다.

**P0-4: 옵션 분석 null 전파**

`compute_options_anal.py`에 유효한 입력이 없을 때(Step 12 실패) `{ status: 'no_data', analytics: null }`을 기록한다. `appWorker.js`가 `_optionsAnalytics.analytics.straddleImpliedMove`를 읽을 때 null 체인 검사가 없으면 런타임에 `TypeError`를 발생시킨다. V7 감사에서 null 가드가 존재하지만 최상위 null만 커버하고 중첩 필드 접근은 완전히 가드되지 않음을 확인했다.

출처: `S1_api_pipeline_v7_sec9.md` §1.9.1-1.9.2.

### 2.5.3 파이프라인 실패 전파

아래 의존성 그래프는 개별 단계 실패가 신뢰도 체인에 어떻게 전파되는지 보여준다:

| 실패 단계 | 오래된/누락 파일 | 영향받는 JS 변수 | 신뢰도 함수 영향 | 실패 모드 |
|----------|----------------|----------------|-----------------|----------|
| Steps 1+2+3 | `macro_latest.json` | `_macroLatest` (stale) | CONF-3: 구 KTB/VIX/CPI로 조정 | 조용한 열화 |
| Steps 5+14 | `basis_analysis.json` | `_derivativesData.basis = null` | CONF-5: 베이시스 스프레드 조정 건너뜀 | 부분 건너뜀 |
| Steps 7+16 | `flow_signals.json` | `_flowSignals` (stale) | CONF-7: 구 HMM 레짐 라벨 사용 | 조용한 열화 |
| Step 15 | `macro_composite.json` | `_macroComposite.mcsV2 = null` | CONF-7: MCS 강세/약세 조정 건너뜀 | 조용한 건너뜀 |

**참고:** 어떤 실패도 `console.warn`과 선택적 세션 1회 토스트 알림 이상으로 사용자에게 전파되지 않는다.

출처: `S1_api_pipeline_v7_sec9.md` §1.9.2 JS 런타임 영향 다이어그램.

---

## 2.6 샘플 데이터 가드 패턴

### 2.6.1 가드 메커니즘

7개의 JSON 파일이 JavaScript 신뢰도 체인에서의 사용을 게이트하는 `source` 필드를 갖고 있다. 가드 패턴은 `appWorker.js`에 구현되어 있으며 모든 가드 파일에 걸쳐 일관된 구조를 따른다:

```
SAMPLE DATA GUARD PATTERN (pseudocode)
=======================================

  After fetch + JSON parse of {file}:

    if file.source === 'sample':
        variable = null          // nullify entirely
        log.warn("source=sample, skipping")

    if file.status === 'error':
        variable = null          // nullify entirely
        log.warn("status=error, skipping")

    if file.source === 'unavailable':
        variable = null          // specific to shortselling

    // Only non-null variable reaches the confidence chain.
    // Each confidence function checks variable !== null
    // before applying its adjustment factor.
```

### 2.6.2 가드 대상 파일과 실패 동작

| 파일 | 필드 | 값 | null 설정 변수 | 건너뛰는 CONF |
|------|------|---|-------------|-------------|
| investor_summary | source | sample | _investorData | CONF-5 외국인 |
| shortselling_summary | source | sample, unavailable | _shortSellingData | CONF-5 공매도 |
| derivatives_summary | source | sample, demo | _derivativesData | CONF-5 베이시스/PCR |
| flow_signals | status | error | _flowSignals | CONF-7 HMM/수급 |
| options_analytics | status | error | _optionsAnalytics | CONF-7 내재 변동 |
| macro_composite | source | sample, demo | _macroComposite.mcsV2 | CONF-7 MCS |
| market_context | source | demo | _marketContext | CONF-1 CCSI |

출처: `S1_api_pipeline_v7_sec5to8.md` §1.6.1-1.6.4; appWorker.js lines 318-325, 405-410.

### 2.6.3 `source === 'sample'`이 WARN이 아닌 FAIL인 이유

`verify.py` CHECK 6(품질 게이트 시스템의 Gate 1)은 투자자 및 공매도 파일에 대해 `source === 'sample'`을 FAIL로 처리한다. 근거:

- `appWorker.js` lines 318-325가 `source === 'sample'`일 때 `_investorData`를 무효화한다. 이는 신뢰도 체인을 조용히 열화시키는, 알려진 문서화된 코드 경로다.
- WARN은 실제 투자자 데이터 없이 파이프라인이 검증을 통과하도록 허용할 것이며 -- 패턴 신뢰도 점수를 수동으로 검사하기 전까지는 개발자에게 보이지 않는다.
- FAIL은 파이프라인을 프로덕션 준비 상태로 간주하기 전에 일일 다운로드가 성공적으로 실행되었음을 개발자가 확인하도록 강제한다.

이것은 `.claude/rules/quality-gates.md`에 기술된 5개 품질 게이트 중 하나다.

---

## 2.7 적시성 검증: verify.py CHECK 6

### 2.7.1 파이프라인 연결성 게이트

CHECK 6은 `scripts/verify.py`의 6번째 자동 검사로, `.claude/rules/quality-gates.md` Gate 1에 문서화된 파이프라인 계약을 집행하기 위해 추가되었다. 12개 JSON 파일을 4개 차원에서 검증한다:

| 차원 | 실패 모드 | 심각도 |
|------|----------|--------|
| 파일 존재 | 디스크에 파일 부재 | FAIL |
| 필수 키 존재 | JSON 파싱 후 최상위 키 누락 | WARN |
| 샘플 데이터 가드 | 가드 파일에서 `source === 'sample'` | FAIL |
| 배열 비어있지 않음 | 기대하는 배열이 빈 리스트 | WARN |
| 적시성 | `updated`/`date` 필드가 14일 이상 경과 | WARN |
| 중첩 키 경로 | `analytics.straddleImpliedMove` 경로 깨짐 | WARN |

### 2.7.2 계약 대상 12개 파일

모든 경로는 `data/` 기준 상대 경로이다.

| 파일 | 필수 키 | 형식 | 가드 |
|------|---------|------|------|
| macro/macro_latest.json | updated, mcs, vix, bok_rate | 객체 | — |
| macro/bonds_latest.json | updated | 객체 | — |
| macro/kosis_latest.json | updated, source | 객체 | — |
| macro/macro_composite.json | mcsV2 | 객체 | — |
| vkospi.json | close, time | 배열 | — |
| deriv/derivatives_summary | time | 배열 | — |
| deriv/investor_summary | date, foreign_net_1d | 객체 | FAIL if source=sample |
| deriv/etf_summary | date | 객체 | — |
| deriv/shortselling_summary | date, market_short_ratio | 객체 | FAIL if source=sample |
| deriv/basis_analysis | basis, basisPct | 배열 | — |
| backtest/flow_signals.json | stocks, hmmRegimeLabel | 객체 | FAIL if status=error |
| deriv/options_analytics | analytics.straddleImpliedMove | 중첩 | — |

### 2.7.3 CHECK 6이 기존 검사에서 발견하지 못한 것을 포착하는 방식

CHECK 6 이전에는 다음 실패 모드가 `verify.py`에서 보이지 않았다:

| 시나리오 | 기존 동작 | CHECK 6 동작 |
|---------|----------|-------------|
| KRX 다운로드 실패 후 investor_summary가 여전히 `source='sample'` | verify.py 신호 없음 | FAIL |
| 스크립트 스키마 변경 후 macro_composite.json에 `mcsV2` 누락 | verify.py 신호 없음 | WARN |
| 다운로드 실패 후 vkospi.json이 비어 있음 | verify.py 신호 없음 | WARN |
| macro_latest.json이 3주간 갱신되지 않음 | verify.py 신호 없음 | WARN(14일 임계값) |

출처: `.claude/rules/quality-gates.md` Gate 1 §CHECK 6.

---

## 2.8 3-배치 JavaScript 데이터 로더

### 2.8.1 로더 아키텍처

JavaScript 파이프라인은 `app.js init()`에서 `Promise.allSettled`를 사용하여 3개의 비동기 배치로 데이터를 로드한다. 각 배치는 5분 TTL(`_PIPELINE_LOAD_TTL = 300,000 ms`)을 가져 동일 세션 내 재조회를 방지한다.

| 배치 | 함수 | 파일 | JS 변수 | 가드 |
|------|------|------|---------|------|
| **1** | _loadMarketData | macro_latest.json | _macroLatest | — |
| | | bonds_latest.json | _bondsLatest | — |
| | | kosis_latest.json | _kosisLatest | — |
| | | vkospi.json | _macroLatest.vkospi 주입 | — |
| **2** | _loadDerivativesData | derivatives_summary.json | _derivativesData | — |
| | | investor_summary.json | _investorData | sample |
| | | etf_summary.json | _etfData | — |
| | | shortselling_summary.json | _shortSellingData | sample |
| | | basis_analysis.json | _derivativesData 병합 | — |
| **3** | _loadPhase8Data | macro_composite.json | _macroComposite | — |
| | | flow_signals.json | _flowSignals | status |
| | | options_analytics.json | _optionsAnalytics | status |

콘솔 확인: Batch 1 완료 시 `[KRX] 매크로/채권 데이터 로드 완료`, Batch 3 완료 시 `[Pipeline] Health: N/12 OK`.

각 fetch는 5초 개별 타임아웃을 갖는다. fetch 실패는 `_notifyFetchFailure()`(세션 1회 토스트)를 호출하고 계속한다 -- 배치는 부분 실패에 중단되지 않는다.

### 2.8.2 온디맨드 로더

4개의 추가 로더가 배치 시퀀스 외부에서 실행된다:

| 로더 | 파일 | 트리거 | 소비자 |
|------|------|--------|-------|
| getFinancialData(code) | financials/{code}.json | 종목 선택 | financials.js 컬럼 D |
| _loadBehavioralData | illiq_spread, hmm_regimes 등 5개 | backtester.init | CONF-8 |
| _loadCAPMBeta | backtest/capm_beta.json | backtester.init | CAPM 베타 + DD |
| _loadMarketIndex | market/kospi_daily.json | backtester.init | 베타 벤치마크 |

출처: `S1_api_pipeline_v7_sec5to8.md` §1.7.

---

## 2.9 DART 재무 데이터 파이프라인

### 2.9.1 커버리지와 폴백

DART(금융감독원 전자공시시스템)는 K-IFRS 연결재무제표의 주요 소스다. 커버리지는 DART 보고 유니버스의 95.3%:

| 범주 | 건수 |
|------|------|
| DART 재무 보유 종목(`source: 'dart'`) | 2,607 |
| 전체 DART 보고 유니버스 | 2,736 |
| 커버리지 비율 | 95.3% |
| 하드코딩 폴백(삼성전자 005930, SK하이닉스 000660) | 2 |
| 시드 생성(해시 PRNG, '---'로 표시) | 나머지 |

### 2.9.2 DART API 오류 처리

`download_financials.py`는 DART API v2 상태 코드 의미를 따른다:

| 상태 코드 | 의미 | 처리 |
|----------|------|------|
| `"000"` | 성공 | `list` 배열 파싱 |
| `"013"` | 해당 기간 데이터 없음(정상) | 해당 분기 조용히 건너뜀 |
| `"010"` | API 키 오류 | 로그 + 스크립트 중단 |
| `"011"` | 일일 할당량 초과 | 로그 + 대기 + 재시도 |
| 기타 | 예상치 못한 오류 | 로그 + 다음 종목으로 계속 |

재무 계정 매칭은 숫자 계정 코드 대신 한국어 이름 기반 매핑을 사용한다. K-IFRS가 기업별 커스텀 계정명을 허용하기 때문이다. 매핑 범위: 매출액 / 수익(매출액) / 영업수익 -> 매출; 영업이익 -> 영업이익; 당기순이익 -> 순이익; 자본총계 -> 자본총계.

### 2.9.3 단위 변환

모든 DART 원시 값의 단위는 KRW(원)이다. 표시 변환:

| 조건 | 표시 형식 |
|------|----------|
| 원시 값 \|n\| > 1,000,000 (억원 임계값) | 1e8으로 나누어 "X억원" 표시 |
| 표시 >= 10,000억 | "X.X조"로 변환 |
| 표시 >= 100억 | "X억"으로 표시 |

`data.js`의 `toEok()`이 `|n| > 1,000,000` 임계값으로 단위를 자동 감지한다. 이는 DART 공시에 나타나는 혼합 단위(일부 기업은 천원, 다른 기업은 백만원으로 보고)를 처리한다. `Math.round()`를 통한 정수 절사가 적용된다 -- 부동소수점 잔여값이 표시되지 않는다.

출처: `.claude/rules/financial.md` 단위 체계; `S1_api_pipeline_v7_sec1to4.md` §1.4 DART 섹션.

---

### Stage 2 요약

Stage 2는 다음 출처 및 신뢰 사실을 확립했다:

- 5개 외부 API(ECOS, FRED, KRX/pykrx, DART, KOSIS)가 13개 다운로드 스크립트와 15개 연산 스크립트에 데이터를 공급하여 6개 기능 범주에 걸쳐 60개 이상의 JSON 파일을 생산한다.
- 재무 데이터는 3-tier 신뢰 체계(dart / hardcoded / seed)를 따른다. 시드 데이터는 세 독립 계층에서 집행되어 반드시 `'---'`로만 표시된다.
- 파이프라인은 전진 실패 모델을 사용한다: Step 0 건강 확인만이 하드 게이트이며, 18개 데이터 단계 모두 조용히 열화한다. 4건의 P0 발견 사항이 가장 위험한 무성 실패 벡터를 문서화한다.
- 5개 JSON 파일이 샘플 또는 오류 데이터 감지 시 신뢰도 체인의 변수를 무효화하는 `source`/`status` 가드 필드를 갖는다.
- `verify.py` CHECK 6이 12개 계약 데이터 파일에 걸쳐 자동 파이프라인 연결성 검증을 제공하며, 기존 검사에서 감지하지 못한 무성 열화를 포착한다.
- DART 커버리지는 95.3%(2,607/2,736)이며, KRW 원시 값은 `toEok()`의 `|n| > 1,000,000` 자동 감지 임계값을 통해 억원으로 변환된다.

Stage 3에서는 이 데이터를 소비하는 분석 엔진과 신뢰도 보정 체인을 문서화한다.

---

# Stage 3: 분석 엔진과 신호 체계

> **Stage 3 / 5** | 출처: `S3_ta_methods_v7.md`, `S3_signal_backtester_v7.md`, `S3_confidence_chain_v7.md`, `S2_theoretical_basis_v7.md` | V7 (2026-04-07)

*핵심 IP는 패턴 탐지가 아니라 10-함수 승법적 신뢰도 체인이다. 단일 악조건이 전체 신뢰도를 지배하는 구조 — Kelly Criterion이 요구하는 보수성을 반영한다.*

> **[핵심 요약]** 32개 지표 × 45개 패턴(캔들 21 + 차트 9 + 지지/저항) × 38개 신호 → 10-함수 승법적 신뢰도 체인(거시 11-요인, Merton DD 최대 -25%, ILLIQ 유동성, HMM 레짐). 가법적이 아닌 승법적 구조로 단일 악조건이 전체 신뢰도를 지배 — Kelly Criterion 원리 적용.

---

## 3.1 3계층 탐지 아키텍처

분석 엔진은 원시 OHLCV 캔들을 3개의 순차 의존 계층을 통해 매매 신호로 변환한다. 각 계층은 수치 연산에서 의미론적 시장 해석으로 추상화 수준을 높인다.

| 계층 | 입력 | 출력 | 엔진 파일 | 개수 |
|------|------|------|----------|------|
| 1 -- 지표(Indicators) | OHLCV 캔들 | 수치 시계열, 스칼라 | indicators.js | 32 (I-01..I-32) |
| 2 -- 패턴(Patterns) | 캔들 + 지표 캐시 | 신뢰도 포함 패턴 객체 | patterns.js | 45 (P-01..P-45) |
| 3 -- 신호(Signals) | 캔들 + 지표 + 패턴 | 신호 객체, 복합, 통계 | signalEngine.js | 49+ (19 기본 + 30 복합) |

**왜 3계층인가?** 이 분리는 고전 신호처리의 3단계를 따른다: 측정(지표) → 특징 추출(패턴) → 의사결정(신호). 지표는 시장 중립적(market-agnostic) 순수 함수다; 패턴은 도메인 특화 인식을 요구하며; 신호는 다중 소스 합류(confluence)를 필요로 한다. 백테스터(`backtester.js`)는 검증 계층으로 병행 실행된다 -- 그 출력은 UI와 오프라인 교정에 공급되며 탐지 파이프라인에는 공급되지 않는다.

---

## 3.2 계층 1: 지표 요약

### 3.2.1 5개 범주

모든 지표 함수는 순수 함수(pure function)이다: 동일 입력, 동일 출력, 전역 상태 없음. 이 순수성이 IndicatorCache에서의 안전한 메모이제이션(memoization)을 가능하게 한다.

| 범주 | ID | 개수 | 대표 | 학술적 계보 |
|------|------|------|------|-----------|
| 클래식 TA | I-01..I-10 | 10 | MA, EMA, BB, RSI, ATR, OBV, MACD, Ichimoku, Kalman, Stochastic | Wilder(1978), Appel(1979), Bollinger(2001), Hosoda(1969) |
| 확장 오실레이터 | I-11..I-15 | 5 | StochRSI, CCI, ADX, Williams %R, Theil-Sen | Chande & Kroll(1994), Lambert(1980), Theil(1950) |
| 통계적 | I-16..I-22 | 7 | Hurst, Hill, GPD VaR, CAPM Beta, HV, VRP, WLS+Ridge+HC3 | Mandelbrot(1963), Hill(1975), Sharpe(1964), Hoerl & Kennard(1970) |
| 추세/레짐 | I-23..I-28 | 6 | OLS 추세, EWMA Vol, Vol 레짐, ILLIQ, CUSUM, BinSeg | Lo & MacKinlay(1999), RiskMetrics(1996), Amihud(2002), Page(1954) |
| 유틸리티 | I-29..I-32 | 4 | HAR-RV, 행렬 역변환, Jacobi 고유값, GCV 람다 | Corsi(2009), Golub-Heath-Wahba(1979) |

모든 상수는 CFA 논문 등급을 갖는다: [A] 학술적 고정(변경 시 수식 무효화), [B] 근거 있는 튜닝 가능, [C] KRX 적응, [D] 경험적(heuristic), [E] 폐기(deprecated). 현재 분포: A55/B69/C78/D63.

### 3.2.2 IndicatorCache

캐시는 이름과 매개변수로 키된 지연 접근자(lazy accessor)를 사용한다(예: `"ma_20"`, `"bbEVT_20_2"`). 첫 접근 시 계산하여 저장; 이후 접근은 즉시 반환한다. **핵심 제약**: 함수 참조를 저장하므로 `postMessage()`로 Worker 경계를 넘을 수 없다(구조화 복제가 함수를 처리하지 못함). Worker는 자체 캐시를 구축한다.

---

## 3.3 계층 2: 패턴 분류

### 3.3.1 5개 그룹

| 그룹 | ID | 개수 | 봉 수 | 탐지 방법 |
|------|------|------|-------|----------|
| 단일 캔들(Single Candle) | P-01..P-11 | 11 | 1 + 추세 컨텍스트 | 몸통/그림자 기하 비율 |
| 이중 캔들(Double Candle) | P-12..P-19 | 8 | 연속 2봉 | 캔들 간 관계 |
| 삼중 캔들(Triple Candle) | P-20..P-25 | 6 | 연속 3봉 | 시퀀스 진행 규칙 |
| 확장 캔들(Extended Candle) | P-26..P-34 | 9 | 1-5봉 | 특수 변형, 지속 패턴 |
| 차트 패턴(Chart Patterns) | P-35..P-45 | 11 | 5-120봉 | 스윙 포인트 구조 기하학 |

추가: 지지/저항 클러스터링(ATR x 0.5 허용 오차, 최소 2회 접촉, 최대 10개), 52주 고가/저가 앵커(George & Hwang 2004), BPS/EPS 기반 밸류에이션 S/R.

### 3.3.2 이중 신뢰도 스키마(Dual Confidence Schema)

모든 패턴은 두 개의 신뢰도 점수를 갖는다: `confidence`(0-100, 표시용)와 `confidencePred`(0-95, 모델 입력용). 이 분리는 시각적 뚜렷함이 예측력과 상관하지 않기 때문이다 -- 시각적으로 인상적인 해머(높은 표시 신뢰도)의 승률은 45%에 불과할 수 있다. 차트 패턴은 추가로 `neckline`, `breakoutConfirmed`, `trendlines`, `_swingLookback`(백테스팅용 선행 편향 오프셋)을 갖는다.

### 3.3.3 캔들 vs 차트 탐지

캔들 패턴은 3단계 흐름을 따른다: 기하 테스트(ATR 정규화 임계값 대비 몸통/그림자 비율), 컨텍스트 테스트(선행 추세, 거래량 비율), 신뢰도 채점(기본 + 거래량 부스트 + Hurst 레짐 조정).

차트 패턴은 구조적 규모에서 작동한다: 스윙 포인트 식별, 기하 제약 매칭(예: 이중 바닥 = ATR x 0.5 이내의 두 저점), 추세선 적합(삼각형/쐐기형의 최소 자승법), 돌파 확인(20봉 전방 참조, ATR 스케일 관통), 거래량 프로필 채점. 미확인 패턴은 Bulkowski(2005)에 따라 12-15점 감점: 확인된 돌파의 성공률이 ~2.4배 높다.

---

## 3.4 ATR 정규화 철학

### 3.4.1 문제

KRX 종목은 삼성전자(~60,000 KRW)부터 코스닥 동전주(~1,000 KRW)까지 가격 범위가 다양하다. 1,200 KRW의 "긴 몸통"은 삼성에서는 2%지만 1,000 KRW 종목에서는 120%다. 퍼센트 정규화(body/close)는 이를 부분적으로 해결하지만, 변동성 레짐이 다를 때 실패한다: 일일 ATR 5% 종목에서의 2%는 평범하지만, ATR 0.5% 종목에서의 2%는 비범하다.

ATR(14)은 각 종목의 최근 변동성 레짐을 포착하여 자연스러운 분모가 된다. 폴백(`close * 0.02`)은 14봉 미만의 콜드 스타트를 처리하며, KOSPI 대형주 중위 ATR/close를 근사한다.

### 3.4.2 적용

```
ATR NORMALIZATION FLOW
======================

   body = abs(close - open)     atr = ATR(14) or
   range = high - low              close * 0.02
   shadows = high/low offsets      (fallback)
        |                       |
        +----------+------------+
                   |
                   v
   bodyRatio = body / atr
   rangeRatio = range / atr
   S/R cluster tolerance = 0.5 * atr
                   |
                   v
   Compare vs thresholds (all ATR-relative):
     SHADOW_BODY_MIN = 2.0
     ENGULF_BODY_MULT = 1.5
     TRIANGLE_BREAK = 0.3 * atr
     S/R confluence within 1.0 * atr
       --> confidence + 3 * S/R strength

```

지지/저항 합류(S/R Confluence): 패턴의 손절가(stopLoss) 또는 목표가(priceTarget)가 기존 S/R 수준의 1 ATR 이내에 있을 때, 신뢰도가 `+3 * strength`(정규화된 접촉 횟수 0-1)를 얻으며, 독립적으로 식별된 구조적 수준과의 정렬에 보상을 준다.

---

## 3.5 계층 3: 신호 흐름

```
SIGNAL ENGINE PIPELINE
======================

   Indicators (cache)    Patterns (Layer 2)
        |                       |
        v                       v
   +-----------------------------------+
   | STAGE A: Base Signal Detection    |
   | 19 detectors (SIG-01..SIG-19)    |
   | 7 indicator categories + deriv   |
   | Each emits 1-4 signal types      |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE B: Composite Matching       |
   | 30 definitions in 3 tiers        |
   | Required + Optional in 5-bar win |
   | Anti-predictor WR gate (BLL 92)  |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE C: Post-Filters (12)       |
   | Additive: ADX/CCI/OLS (cap +15) |
   | Multiplicative: Entropy, IV/HV,  |
   |   VKOSPI, Expiry, Crisis, HMM   |
   | Floor: max(10, result)           |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE D: Sentiment & Statistics   |
   | Weight-avg sentiment [-100,+100] |
   | Shannon entropy (diversity)      |
   +-----------------------------------+

```

**기본 신호**(19개 탐지기): MA 크로스/정렬, MACD 크로스, RSI/StochRSI/Stochastic 모멘텀, BB 바운스/스퀴즈, 거래량 z-score/OBV 다이버전스, Ichimoku TK/클라우드, 레짐 필터(Hurst/Kalman/CUSUM/ATR/VolRegime), 파생/수급 신호(베이시스/PCR/외국인/ERP/ETF/공매도). 레짐 필터는 방향성 가중치가 0이다 -- 복합 신호와 사후 필터에만 공급된다.

**복합 신호**(30개 정의, 3 티어): Tier 1(11개, 강, 2-3 필수 조건, baseConf 61-75), Tier 2(16개, 중, 1-2 필수 + 선택, baseConf 48-69), Tier 3(3개, 약, 1 필수 + 선택, baseConf 48-55). 반예측자 WR 게이트(Anti-Predictor WR Gate, BLL 1992)는 필수 패턴의 KRX 5년 승률이 48% 미만일 때(~2% 왕복 비용 감안 반예측자 임계값) 복합 신뢰도를 하드 캡한다. 5개 매수 측 복합 신호가 현재 이 게이트에 의해 캡된다.

**사후 필터**(12개 순차): PF-1..PF-3 가법적(ADX/CCI/OLS, 누적 최대 +/-15), PF-6 캡, PF-7..PF-12 승법적(엔트로피 0.80-1.0, IV/HV 0.50-1.0, VKOSPI 레짐 0.60-1.0, 만기 0.70, 위기 0.60-1.0, HMM 폴백 0.70-1.0). 최악의 경우: 기본 70이 ~8까지 감소, 10에서 바닥(floor). 이 공격적 복합은 의도적이다: 5개의 동시 독립적 리스크 요인은 진정으로 최소한의 예측력을 나타낸다.

---

## 3.6 백테스터 요약

### 3.6.1 방법론 스택

백테스터는 303,956 패턴 인스턴스(2,768 종목, 5년, 2021-03~2026-03)에 대해 패턴-기간 조합당 43개 지표를 생산한다.

| 프레임워크 | 목적 | 핵심 참고 문헌 |
|----------|------|-------------|
| WLS + Ridge | 수익률 예측; 5-피처 설계 행렬, lambda=0.995 지수 감쇠(반감기 ~7개월, Lo 2004 AMH), GCV 자동 Ridge | Reschenhofer(2021), Hoerl & Kennard(1970), Golub-Heath-Wahba(1979) |
| Huber-IRLS | 두꺼운 꼬리 강건성; delta=5.8(1.345 * KRX MAD), +/-30% 가격 제한 처리 | Huber(1964) |
| HC3 오류 | 이분산성 일관 추론, n=30-300에서의 잭나이프 보정 | MacKinnon & White(1985) |
| BCa 부트스트랩 | 달력시간 블록 부트스트랩(B=500), 편향 보정 가속 CI | Efron(1987), Fama & French(2010) |
| BH-FDR | 225건 테스트(45패턴 x 5기간)에 q=0.05 다중 검정 보정 | Benjamini & Hochberg(1995) |
| Hansen SPA | 데이터 스누핑 검정: 최고 전략이 무작위 진입을 진정으로 이기는가? B=500 | Hansen(2005) |

**설계 근거**: 레짐 전환이 최근 관측치를 더 대표적으로 만들어 WLS가 OLS보다 우월(AMH). 최소 임계값에서 n/k=6으로 검정력이 부족하여 Ridge가 plain WLS보다 우월. KRX +/-30% 가격 제한이 극단적 첨도(kurtosis)를 만들어 OLS 계수를 부풀리므로 Huber-IRLS.

### 3.6.2 워크 포워드 평가(WFE, Walk-Forward Evaluation)

확장 윈도우 교차 검증: 4-fold(캔들 >= 500이면 6-fold), fold당 20% OOS, 퍼지 갭(purge gap) = 2 x 기간 봉(Bailey & Lopez de Prado 2014). WFE = round(avgOOS / avgIS x 100). 강건 >= 50%, 한계 30-50%, 과적합 < 30%. WFE < 30%인 Tier A/B 패턴은 C로 강등.

### 3.6.3 신뢰성 티어

| 티어 | 통계적 | 경제적 | 예측적 |
|------|--------|--------|--------|
| A | BH-FDR 유의 | wrAlpha >= 5%, n >= 100, PF >= 1.3, 기대값 > 0 | OOS IC > 0.02 |
| B | BH-FDR 유의 | wrAlpha >= 3%, n >= 30, 기대값 > 0 | OOS IC > 0.01 |
| C | -- | wrAlpha > 0%, n >= 30 | -- |
| D | -- | 기본값 | -- |

3중 게이팅(Triple-gating)이 허위 승격을 방지한다: BH-FDR(다중 검정), WFE(과적합), SPA(데이터 스누핑). 각각 다른 실패 모드를 처리한다 -- 패턴이 BH-FDR을 통과해도 WFE에서 실패할 수 있다.

---

## 3.7 Worker 프로토콜

### 3.7.1 오프로드 근거

단일 분석 패스(32 지표 + 45 탐지기 + 19 신호 생성기 + 백테스터)는 50-200ms가 소요된다. 메인 스레드에서 실행하면 UI 렌더링이 차단되어 차트 인터랙션 시 프레임 드롭이 발생한다.

### 3.7.2 메시지 프로토콜과 안전장치

```
WORKER MESSAGE PROTOCOL
========================

   Main Thread                  Worker Thread
        |                            |
        |--{ type: 'analyze',   ---->|
        |   candles: [...],          |
        |   realtimeMode: bool,      | importScripts: colors,
        |   version: N }             |   indicators, patterns,
        |                            |   signalEngine, backtester
        |                            |
        |                            | Build IndicatorCache
        |                            | Run L1 -> L2 -> L3
        |                            |
        |<---{ type: 'result',  -----|
        |     patterns: [...],       |
        |     signals: [...],        |
        |     stats: {...},          |
        |     version: N }           |
        |                            |
        | if version < current:      |
        |   discard (stale)          |

```

**버전 스탬핑**: 종목 선택 시 단조 증가 카운터. 새 요청이 전송된 후 이전 종목의 결과가 도착하면 폐기한다.

**3초 스로틀**: `_lastPatternAnalysis` 타임스탬프가 디스패치 간 최소 간격을 강제한다. 더 짧으면(500ms) 중첩 분석이 큐에 쌓이고, 더 길면(10s) 변동성 장에서 오래된 느낌을 준다. 3초 값은 관측된 95번째 백분위수 완료 시간 + 버퍼를 반영한다.

**캐시 핑거프린팅**: Worker 측 `_analyzeCache`가 캔들 길이 + 마지막 타임스탬프 + 마지막 종가로 키를 만든다. 변경되지 않은 종목을 다시 선택하면 파이프라인을 재실행하지 않고 캐시된 결과를 반환한다.

**IndicatorCache 격리**: 캐시가 함수 참조(지연 평가)를 포함하므로 구조화 복제를 통해 직렬화할 수 없다. Worker는 메시지로 전달된 원시 캔들 데이터에서 자체 독립 캐시를 구축한다. 이 중복은 스레드 안전성의 비용이다.

---

## 3.8 종단간 흐름도

```
END-TO-END ANALYSIS ENGINE
===========================

  dataService.getCandles(stock, tf)
         |
  =======|======= Worker Boundary =====
         |
         v
  +----------------------------------------+
  | L1: INDICATORS (32)                    |
  |  Classic(10) Oscillators(5) Stats(7)   |
  |  Trend/Regime(6) Utilities(4)          |
  |  --> IndicatorCache (lazy, keyed)      |
  +------------------+---------------------+
                     |
                     v
  +----------------------------------------+
  | L2: PATTERNS (45)                      |
  |  Single(11) Double(8) Triple(6)        |
  |  Extended(9) Chart(11) + S/R           |
  |  ATR(14) norm, dual confidence         |
  +-----+-----------------------+----------+
        |                       |
        v                       v
  +-----------------+  +-------------------+
  | L3: SIGNALS     |  | BACKTESTER        |
  | 19 base detect  |  | WLS/Ridge/HC3     |
  | 30 composites   |  | Huber-IRLS        |
  | WR gate, 12 PF  |  | BCa/BH-FDR/SPA   |
  | Sentiment idx   |  | WFE, A/B/C/D tier |
  +--------+--------+  +--------+----------+
           |                     |
  =========|=====================|==========
           v                     v
  +----------------------------------------+
  | UI: patternRenderer, signalRenderer,   |
  |     patternPanel, reliability badges   |
  +----------------------------------------+

```

백테스트 실증 기반: 303,956 패턴 인스턴스, 2,768 종목, 5년. KRX 거래일: 250. BH-FDR q: 0.05. 부트스트랩: 500 복제. WFE 강건 임계값: >= 50%. WLS 람다: 0.995. Ridge: GCV 자동. ATR 기간: 14.

---

## 3.9 신뢰도 보정 파이프라인 개요

### 핵심 해자(Core Moat)인 이유

신뢰도 조정 체인은 CheeseStock의 중앙 통합 지점이자 기존 차트 플랫폼과의 주요 차별점이다. 대부분의 기술 분석 도구가 패턴 탐지 결과를 액면가 그대로 표시하는 반면, CheeseStock은 탐지된 모든 패턴을 10개의 순차 조정 함수로 구성된 관문에 통과시킨다. 이 함수들은 거시경제 레짐, 신용 리스크, 파생상품 수급, 유동성 조건, 생존자 편향을 패턴이 사용자 화면에 도달하기 전에 반영한다.

결과: 패턴의 표시 신뢰도는 단순한 기하학적 품질 측정이 아니다 -- 불리한 조건에서는 적절히 하락하고, 다수의 독립 데이터 소스가 패턴의 논지를 확인할 때 강화되는 시장 맥락 인식 확률 추정치다.

### 왜 승법적(Multiplicative)인가, 가법적(Additive)이 아닌가

모든 조정은 승법적 형태를 사용한다:

```
   confidence_final = confidence_raw
                      * adj_1 * adj_2 * ... * adj_8
```

가법적 모델(confidence += delta)은 단일 큰 delta가 다른 요인과 관계없이 지배하도록 허용한다. 승법적 복합(compounding)은 각 요인이 독립적으로 신뢰도를 스케일링하며, 불리한 요인이 자연스럽게 복합되도록 보장한다: 리스크 오프, 비유동성, 신용 스트레스 환경의 패턴은 다수의 독립적 예측력 가정의 동시 열화를 정확히 반영하는 복합 할인에 직면한다.

각 함수는 적용 전에 자체 조정 인자를 함수별 범위로 클램핑한다. 8개 패턴 함수가 모두 완료된 후, 신뢰도는 절대 범위로 클램핑된다:

| 필드 | 절대 범위 | 용도 |
|------|----------|------|
| `confidence` | [10, 100] | 패턴 표시 및 렌더링 우선순위 |
| `confidencePred` | [10, 95] | 예측 신뢰도(보수적 상한) |

`confidencePred`의 95% 상한은 의도적 인식론적 겸양(epistemic humility)을 구현한다: 얼마나 많은 확인 요인이 정렬되더라도 어떤 기술적 패턴도 미래 가격 움직임에 대해 거의 확실하다고 주장해서는 안 된다.

### 3개의 동일한 호출 지점

체인은 실행 컨텍스트와 무관한 일관성을 보장하기 위해 3개의 코드 경로에서 동일하게 호출된다:

| 경로 | 트리거 | 사용 시점 |
|------|--------|---------|
| Worker 결과 | `msg.type === 'result'` | 정상: Worker가 분석 완료 |
| 메인 스레드 폴백 | `_analyzeOnMainThread()` | Worker 불가용 또는 크래시 |
| 드래그 폴백 | `_analyzeDragOnMainThread()` | 사용자가 Worker 없이 차트 드래그 |

이 3중 호출은 Worker 분석, 메인 스레드 폴백, 드래그 트리거 재분석을 통해 표시되는 패턴이 동일한 신뢰도 조정을 받도록 보장한다 -- 실행 경로 간 불일치한 사용자 경험을 방지한다.

> **D2 출처:** S3_confidence_chain_v7.md Section 3.6.1

---

## 3.10 신뢰도 폭포 다이어그램

아래 다이어그램은 가상의 매수 패턴(원시 신뢰도 65)이 리스크 오프, 저유동성, 역수익률 시나리오 -- 체인의 동작을 보여주는 가장 유익한 스트레스 케이스 -- 에서 전체 체인을 통과하는 과정을 추적한다.

```
CONFIDENCE WATERFALL
====================
Buy Pattern in Risk-Off / Low-Liquidity Scenario

  Raw (patterns.js quality scoring)
  |
  |  65.0  ##########################################
  |
  |  CONF-1: Market Context (earnings season)
  |  60.5  #####################################  x0.93
  |
  |  CONF-2: RORO Regime (risk-off, buy penalized)
  |  55.6  ##################################  x0.92
  |
  |  CONF-3: Macro (yield slope inverted)
  |  53.9  ################################  x0.97
  |
  |  CONF-4: Micro (high ILLIQ, low liquidity)
  |  45.8  ###########################  x0.85
  |            *** LARGEST SINGLE ADJ ***
  |
  |  CONF-5: Derivatives (basis slightly positive)
  |  47.6  ############################  x1.04
  |
  |  CONF-6: Merton DD (elevated default risk)
  |  45.3  ##########################  x0.95
  |
  |  CONF-7: Phase 8 (MCS neutral, flow weak+)
  |  46.2  ###########################  x1.02
  |
  |  CONF-8: Survivorship (-2% standard)
  |  45.3  ##########################  x0.98
  |
  |  FINAL: 45.3 (clamped to [10, 100])
  |
  |  Effective discount: 65.0 -> 45.3 = -30.3%
  |  Dominant factor: CONF-4 Micro (ILLIQ) -15%

```

**해석:** 이 불리한 시나리오에서 패턴은 원시 신뢰도의 거의 1/3을 상실한다. 가장 큰 단일 기여자는 CONF-4(Amihud ILLIQ)로, 비유동적 한국 종목이 더 넓은 호가 스프레드와 덜 신뢰할 수 있는 패턴 신호를 보인다는 실증적 현실을 반영한다(Amihud, 2002). CONF-5(파생상품)가 콘탱고 베이시스를 통해 소폭 상쇄하지만, 전체 체인은 불리한 거시 환경에서 매수 패턴을 올바르게 감점한다.

> **D2 출처:** S3_confidence_chain_v7.md Section 3.6.3

---

## 3.11 함수별 상세 요약

10개 신뢰도 함수의 요약 참고표다. 줄 번호와 엣지 케이스를 포함한 전체 요인별 문서는 S3_confidence_chain_v7.md Section 3.6.2~3.6.11에 있다.

| CONF | 함수명 | 소스 | 근거 | 범위 | 방향 |
|------|--------|------|------|------|------|
| 1 | Market Context | market_context | Lemmon(2006) | [0.55, 1.35] | 매수 중심 |
| 2 | RORO Regime | 5-요인 복합 | Baele(2010) | [0.92, 1.08] | 방향성 |
| 3 | Macro 11-Factor | macro, bonds, kosis | Taylor(1993), Stovall, G&Z(2012) | [0.70, 1.25] | 양방향 |
| 4 | Micro(ILLIQ/HHI) | OHLCV, ALL_STOCKS | Amihud(2002), Kyle(1985) | [0.80, 1.15] | 양방향 |
| 5 | Derivatives 6-Factor | deriv, investor, etf, basis | Pan & Poteshman(2006) | [0.70, 1.30] | 방향성 |
| 6 | Merton DD | financials, bonds | Merton(1974), B&S(2008) | [0.75, 1.15] | 방향성 |
| 7 | Phase 8(MCS/HMM/IV) | macro_comp, flow, options | HMM Doc46, S&W(2001) | [10, 100] | 양방향 |
| 8 | Survivorship | survivorship_corr | Elton(1996) | [0.92, 1.00] | 매수만 |
| 9 | Signal Macro | macro, bonds (신호) | CONF-3 동일 | [0.70, 1.25] | 복합 특정 |
| 10 | Wc Injection | patterns wc | 메타데이터 전용 | 변경 없음 | 양방향 |

### 함수별 핵심 설계 근거

**CONF-1 Market Context**는 소비자 심리(CCSI)와 기관 수급 임계값을 적용한다. CCSI가 85 미만이면 12% 매수 패턴 할인이 발동하며, 이는 소비자 심리 극단이 주식 수익률을 예측한다는 Lemmon & Portniaguina의 발견을 반영한다. 실적 시즌 플래그는 기업 뉴스가 가격 행동을 지배하는 보고 기간 동안 모든 패턴에 일괄 7% 할인을 적용한다.

**CONF-2 RORO Regime**는 5-요인 가중 복합에서 3-상태 레짐(리스크 온 / 중립 / 리스크 오프)을 분류한다: VKOSPI/VIX(0.30), AA- 신용 스프레드(0.10), US HY 스프레드(0.10), USD/KRW(0.20), MCS(0.15), 투자자 정렬(0.15). 히스테리시스 완충(진입 ±0.25, 이탈 ±0.10)으로 레짐 변동을 완화한다. 클램프 [0.92, 1.08]은 의도적으로 좁다 -- Section 3.14의 상호작용 효과 참조.

**CONF-3 Macro 11-Factor**는 가장 복잡한 함수(258줄, 11개 독립 요인)다: 경기 순환 + Stovall 업종 순환, 수익률 곡선 4-레짐, 신용 레짐(Gilchrist & Zakrajsek 2012), 외국인 투자자 신호, 패턴별 오버라이드, MCS v1(v2 이중 적용 가드 포함), Taylor Rule 갭, VRP, 한미 금리 차, 금리 베타 x 금리 방향(Damodaran 2012, 12개 업종), KOSIS CLI-CCI 갭.

**CONF-4 Micro**는 Amihud ILLIQ(2002)을 사용하여 비유동 종목을 할인(최대 15% 할인)하고, HHI로 집중 업종의 평균 회귀 패턴을 부스트(최대 10% 부스트)한다. 이는 삼성 60,000 KRW vs. 동전주 1,000 KRW 문제를 해결한다: 고도로 비유동적인 소형주의 패턴은 유동성 높은 대형주의 동일 패턴보다 신뢰도가 낮아야 한다.

**CONF-5 Derivatives 6-Factor**는 선물 베이시스(콘탱고/백워데이션, 가용 시 초과 베이시스 사용), PCR 역방향(Pan & Poteshman 2006), 투자자 정렬, ETF 레버리지 심리(역방향), 공매도 비율, USD/KRW 수출 채널을 통합한다. Factor 6(ERP)은 signalEngine과의 이중 적용 방지를 위해 제거되었다.

**CONF-6 Merton DD**는 Bharath & Shumway(2008) 단순화 부도거리(Distance-to-Default) 모델을 적용한다. 금융 업종은 제외된다(은행 부채는 영업 자산). DD 1.0 미만 시 25% 매수 할인 발동 -- 체인에서 가장 큰 단일 요인 감점. EWMA 변동성(lambda=0.94, RiskMetrics 1996)과 KMV 부도점 관례(총부채 x 0.75)를 사용한다.

**CONF-7 Phase 8**은 MCS v2(CONF-3 Factor 6과의 이중 적용 가드 포함 거시 복합 점수), HMM 3-상태 레짐 분류(품질 게이팅: flowDataCount > 0 요구), 종목별 외국인 모멘텀 정렬, 옵션 IV/HV 비율(Simon & Wiggins 2001: IV가 HV를 50% 이상 초과 시 패턴 정확도 15-20% 하락)을 통합한다.

**CONF-8 Survivorship**는 Elton, Gruber & Blake(1996)에 기반한 매수 전용 할인을 적용한다. OHLCV 데이터셋에서 308개 상장폐지 종목이 제외되어 매수 패턴 승률이 체계적으로 부풀려진다. 보정(통상 1-3%, 최대 8%)은 소폭이지만 방향적으로 정확하며 균일하게 적용된다.

**CONF-9 Signal Macro**는 5개 특정 고확신 복합 신호에 거시 조건부 조정을 타겟한다. 주목할 점: 5개 타겟 모두 매도 우위로, 한국 약세 패턴이 더 강한 방향성 예측력(WR 57-75% vs. 강세 40-47%)을 갖는다는 실증적 발견을 반영한다.

**CONF-10 Wc Injection**은 패턴의 평균 Wc(적응형 가중치)를 메타데이터로 신호에 주입한다. 신뢰도 수정 없음.

> **D2 출처:** S3_confidence_chain_v7.md Sections 3.6.2-3.6.11

---

## 3.12 데이터 의존성 맵

아래 다이어그램은 어떤 JSON 데이터 파일이 어떤 CONF 함수에 공급되는지 매핑한다. 이는 핵심 의존성 집중을 드러낸다: 단일 파일의 손실이 여러 신뢰도 함수를 동시에 열화시킬 수 있다.

| 데이터 소스 | CONF-1 | CONF-2 | CONF-3 | CONF-4 | CONF-5 | CONF-6 | CONF-7 | CONF-9 | 팬아웃 |
|------------|--------|--------|--------|--------|--------|--------|--------|--------|-------|
| `macro_latest.json` | | VIX, MCS, USD/KRW | Taylor gap, yield | | | | | Signal macro | **3** |
| `bonds_latest.json` | | AA- credit spread | yield levels | | | risk-free rate | | Signal macro | **4** |
| `kosis_latest.json` | | | CLI, IPI, CCSI | | | | | | 1 |
| market_context | CCSI, flow | | | | | | | | 1 |
| `macro_composite.json` | | | | | | | MCS v2 | | 1 |
| `investor_summary.json` | | investor alignment | | | foreign/inst flow | | | | 2 |
| `derivatives_summary.json` | | | | | basis, PCR | | | | 1 |
| `etf_summary.json` | | | | | leverage ratio | | | | 1 |
| `shortselling_summary.json` | | | | | short ratio | | | | 1 |
| `basis_analysis.json` | | | | | basis z-score | | | | 1 |
| `options_analytics.json` | | | | | | | implied move, GEX | | 1 |
| `flow_signals.json` | | | | | | | flow, HMM regime | | 1 |
| candles (OHLCV) | | | | ILLIQ calc | | equity vol calc | | | 2 |
| financials cache | | | | | | debt ratio | | | 1 |

**영향 분석:** `bonds_latest.json` 부재 시 4개 함수 열화(최고 팬아웃), `macro_latest.json` 부재 시 3개 함수 열화, `investor_summary` 부재 시 2개 함수 열화.

**핵심 의존성:** `bonds_latest.json`이 4개 CONF 함수(CONF-2, CONF-3, CONF-6, CONF-9)에 공급 -- 단일 데이터 파일 중 가장 높은 팬아웃(fan-out). 부재 시 RORO 레짐 분류(신용 스프레드 누락), 거시 조정(수익률 수준 누락), Merton DD(할인에 사용되는 무위험 이자율 폴백 누락), 신호 수준 거시 조건화가 열화한다.

이 의존성 집중이 Stage 2(Section 2.5)에 기술된 파이프라인 신뢰성 검사를 동기부여한다: verify.py CHECK 6이 파이프라인 계약의 각 데이터 파일의 존재와 적시성을 구체적으로 검증한다.

> **D2 출처:** S3_confidence_chain_v7.md Section 3.6.4

---

## 3.13 Null 안전 아키텍처

체인의 모든 함수는 우아한 열화(graceful degradation)를 위해 설계되었다. 데이터 소스가 불가용할 때 함수는 즉시 반환(no-op)하거나 개별 요인을 건너뛰어, 누락 데이터가 크래시를 일으키거나 정의되지 않은 동작을 생성하지 않도록 보장한다.

### 함수별 가드 전략

| CONF | 가드 조건 | 동작 |
|------|----------|------|
| 1 | `_marketContext === null` 또는 `source === 'demo'` | 즉시 반환 |
| 2 | 5개 요인 모두 null(`count === 0`) | 레짐 = 중립, no-op |
| 2 | 3개 미만 요인 가용 | 점수 비례 할인 |
| 3 | `!macro && !bonds` | 즉시 반환 |
| 3 | 개별 요인 null | 해당 요인 건너뜀(11개 검사) |
| 4 | `candles.length < 21` | `_microContext = null`, no-op |
| 5 | 모든 파생상품 소스 null | 즉시 반환 |
| 6 | 금융 업종 종목 | DD 계산 건너뜀(무의미) |
| 6 | 시드 재무 데이터 | DD 계산 차단 |
| 7 | `mcsV2 === null` | MCS 서브 함수 건너뜀 |
| 7 | `flowDataCount === 0` | HMM + 수급 섹션 건너뜀 |
| 8 | `_survivorshipCorr` undefined | 즉시 반환 |

### 로더 수준 소스 가드

데이터가 체인에 도달하기 전에, 데이터 로더가 진입점에서 신뢰할 수 없는 데이터를 무효화하는 소스 가드를 적용한다:

| 데이터 | 가드 | 효과 |
|--------|------|------|
| `_investorData` | `source === 'sample'` | null 설정 |
| `_shortSellingData` | `source === 'sample'` 또는 `'unavailable'` | null 설정 |
| `_macroComposite` | `status === 'error'` 또는 sample/demo | null 설정 |
| `_optionsAnalytics` | `status === 'error'` 또는 sample/demo | null 설정 |

이 2중 가드 아키텍처(로더 수준 + 함수 수준)는 가짜 데이터든 누락 데이터든 신뢰도 조정을 손상시킬 수 없도록 보장한다.

> **D2 출처:** S3_confidence_chain_v7.md Section 3.6.4

---

## 3.14 상호작용 효과

### 의도적 좁은 클램핑(RORO)

CONF-2(RORO)는 의도적으로 좁은 클램프 [0.92, 1.08]을 사용한다 -- 체인에서 가장 타이트. 이는 한계가 아니라 이중 집계 방지를 위한 설계 결정이다.

RORO 복합 점수는 VIX(VKOSPI 프록시), 신용 스프레드, MCS를 포함한다 -- CONF-3(거시)와 CONF-7(Phase 8)에 개별적으로 나타나는 동일 변수들이다. 좁은 클램프 없이는 VIX 급등이 세 번 집계될 것이다: RORO 요인 채점 한 번, CONF-3 Factor 8(VRP) 한 번, CONF-7(VIX를 입력으로 사용하는 MCS v2) 한 번.

좁은 클램프는 RORO가 개별 요인들이 이미 기여하는 규모를 넘어서 증폭하지 않으면서 방향성 레짐 신호(매수 vs. 매도 편향)를 제공하도록 보장한다.

### MCS 이중 적용 가드

MCS(Macro Composite Score)는 두 형태로 나타난다:
- **MCS v1**(단순): CONF-3 Factor 6, v2 불가용 시 적용
- **MCS v2**(8-요인): CONF-7, 가용 시 적용

명시적 가드(CONF-3 line 1218)가 `_macroComposite.mcsV2`가 가용할 때 MCS v1을 건너뛰어, MCS가 체인에서 정확히 한 번 적용되도록 보장한다 -- v1 또는 v2, 절대 둘 다가 아니다.

### 역사적 버그 수정: DD 이중 적용

이전에 CONF-7(Phase 8)이 CONF-6의 Merton DD 조정(DD < 1.5에서 x0.82) 위에 DD 감점(DD < 2에서 x0.90)을 적용했다. 복합 효과는 0.90 x 0.82 = 0.738 -- 신용이 건전한 패턴까지 억제하는 과도한 26% 할인. CONF-7에서 DD를 완전히 제거하여 수정했으며, 신용 리스크가 정확히 한 곳(CONF-6)에서만 평가되도록 보장한다.

### 복합 범위 분석

| 시나리오 | 복합 효과 | 기본 50에서의 최종값 |
|---------|----------|-------------------|
| 정상 시장(1-3 요인) | 0.90~1.10 | 45~55 |
| 거시 스트레스(수축 + 역전 + VIX>30) | ~0.70-0.80 매수 | ~35-40 |
| 강세장(확장 + 가파른 + 정렬 + MCS) | ~1.15-1.25 매수 | ~58-63 |
| 위기(DD<1.0 + 약세 + 신용 스트레스) | 매수 -> 바닥 10 | 10 |

> **D2 출처:** S3_confidence_chain_v7.md Section 3.6.3

---

## 3.15 D등급 상수 감사: 정직한 공시

신뢰도 체인 승수 상수의 약 40%가 [D] 등급이다 -- 그 규모가 순방향 수익률에 대해 실증적으로 교정되지 않았다는 의미다. 이 섹션은 검증된 것과 그렇지 않은 것에 대한 정직한 회계를 제공한다.

### D등급이 의미하는 바

[D] 등급 상수는 두 가지 속성을 갖는다:

1. **방향은 학술적 근거가 있다.** 조정의 부호(어떤 변수가 신뢰도를 올리고 내리는지)는 동료 심사 연구에 의해 뒷받침된다. 예를 들어 신용 스트레스가 매수 패턴 신뢰도를 낮춰야 한다는 것은 Gilchrist & Zakrajsek(2012)에 의해 뒷받침된다.

2. **규모는 경험적이다.** 특정 승수 값(예: 신용 스트레스에 x0.82)은 과거 데이터에 대한 최적화가 아닌 도메인 판단으로 설정되었다. 진정한 최적값은 x0.75 또는 x0.90일 수 있다 -- 우리는 모른다.

### 고민감도 D등급 상수

| 상수 | 값 | 함수 | 영향 | 학술적 방향 |
|------|---|------|------|-----------|
| REGIME_MULT bull buy | 1.10 | CONF-7 | +10% 전체 매수 | HMM 레짐(Doc46) |
| REGIME_MULT bear buy | 0.85 | CONF-7 | -15% 전체 매수 | HMM 레짐(Doc46) |
| CCSI_BEAR_MULT | 0.88 | CONF-1 | -12% 매수 | Lemmon & Portniaguina(2006) |
| CREDIT_STRESS_MULT | 0.82 | CONF-3 | -18% 매수 | Gilchrist & Zakrajsek(2012) |
| PCR_MULT | +/-0.08 | CONF-5 | +/-8% | Pan & Poteshman(2006) |
| DD_DANGER_BUY | 0.82 | CONF-6 | -18% 매수 | Merton(1974), B&S(2008) |
| DD_CRITICAL_BUY | 0.75 | CONF-6 | -25% 매수 | Merton(1974), B&S(2008) |

\clearpage

### 왜 수용 가능한가 — 그 의미

[D] 등급 상태가 신뢰도 파이프라인을 무효화하지 않는다. 의미하는 바:

1. **요인 방향은 정확하다.** 비유동 종목, 신용 스트레스 기업, 리스크 오프 레짐은 패턴 예측력을 진정으로 열화시킨다. 학술 문헌은 방향에 대해 모호하지 않다.

2. **규모는 보수적이다.** 경험적 승수는 개별적으로 작게(대부분 < 15%) 설정되어 천천히 복합된다. 체인의 승법적 구조는 단일 요인이 지배하지 못하도록 보장하며, 절대 클램프 [10, 100]이 폭주 복합을 방지한다.

3. **대안이 더 나쁘다.** 거시/신용/유동성 조건을 조정하지 않는 것(즉, 원시 패턴 신뢰도 표시)은 입증 가능하게 덜 정확하다. 올바른 방향의 잘못 교정된 조정이 조정하지 않는 것보다 낫다.

4. **교정 경로가 존재한다.** 각 [D] 등급 상수는 정의된 교정 절차를 갖는다: 기존 303,956 패턴 인스턴스 백테스트 데이터셋을 사용하여 N일 순방향 수익률에 대한 횡단면 IC 테스트. 워크 포워드 평가 및 BH-FDR 다중 검정 보정(Stage 4) 인프라가 이미 프로덕션에 있다.

### 교정 우선순위 순위

| 우선순위 | 대상 | 근거 |
|---------|------|------|
| 1 | REGIME_CONFIDENCE_MULT(CONF-7) | 모든 패턴에 적용; 잘못 교정 = 체계적 편향 |
| 2 | CCSI / Credit / PCR(CONF-1,3,5) | 거시 수준, 요인당 >5% 영향 |
| 3 | DD 티어 임계값(CONF-6) | 계단 함수; 0.95에서 0.82로의 점프에 검증 필요 |
| 4 | Taylor / FX / CLI(CONF-3) | 소규모 조정(<5%), 낮은 우선순위 |
| 5 | 히스테리시스 임계값(CONF-2) | 레짐 전환 타이밍, 시계열 백테스트 필요 |

> **D2 출처:** S3_confidence_chain_v7.md Section 3.6.6

---

## 3.16 민감도 순위

8개 패턴 영향 함수를 최대 단일 요인 영향으로 순위 매긴 표로, 어떤 함수가 가장 큰 신뢰도 변동을 주도하는지 빠르게 참고할 수 있다.

| 순위 | 함수 | 최대 영향 | 트리거 빈도 |
|------|------|---------|-----------|
| 1 | CONF-6 Merton DD | -25% 매수 | 희소 발생(신용 악화 종목) |
| 2 | CONF-3 Macro 11-Factor | [0.70, 1.25] | 항상(거시 데이터 로드 시) |
| 3 | CONF-5 Derivatives | [0.70, 1.30] | 파생상품 데이터 가용 시 |
| 4 | CONF-7 Phase 8 HMM | +/-15% 레짐 | flow_signals 데이터 있을 때 |
| 5 | CONF-1 Market Context | -12%~+8% | market_context 로드 시 |
| 6 | CONF-4 Micro ILLIQ | -15%~+10% | 항상(캔들에서 계산) |
| 7 | CONF-2 RORO Regime | -8%~+6% | 항상(>=1 요인 가용) |
| 8 | CONF-8 Survivorship | 최대 -8% | 백테스터 로드 시 |

**주목할 비대칭:** 매수 측 감점 최대(-25%, Merton DD)가 매도 측 감점 최대를 크게 초과한다. 이는 시스템이 매도 신호보다 매수 신호에 더 신중해야 한다는 의도적 설계 철학을 반영한다 -- 한국 시장에서 매수 패턴 승률이 불리한 조건에서 매도 패턴 승률보다 더 취약하다는 실증적 발견과 일치한다.

> **D2 출처:** S3_confidence_chain_v7.md Section 3.6.3

---

### Stage 3 요약

신뢰도 조정 체인은 원시 패턴 탐지를 10개 순차 승법적 함수를 통해 시장 맥락 인식 신뢰도 점수로 변환한다. 핵심 속성:

1. **승법적 복합**이 단일 요인 지배 없이 독립적 요인 기여를 보장.
2. **우아한 열화**가 포괄적 null 안전을 통해 누락 데이터가 중립 조정을 생산하며 크래시를 방지.
3. **좁은 RORO 클램핑**이 함수 간 공유 변수(VIX, 신용, MCS)의 이중 집계를 방지.
4. **학술적 근거**가 모든 요인 방향에 있으며, [D] 등급 규모 경험치의 정직한 공시.
5. **3중 호출 지점 일관성**이 Worker, 메인 스레드, 드래그 실행 경로 간 동일한 사용자 경험을 보장.
6. **데이터 의존성 집중**(bonds_latest.json이 4개 함수에 공급)이 Stage 2에 기술된 파이프라인 신뢰성 검사를 동기부여.

체인의 현재 IC 0.051(Stage 4)은 소폭이지만 통계적으로 유의한 예측력을 확인 -- 단기 기술 분석에 적절하며, 정직한 교정 인식 신뢰도 보고라는 시스템 철학과 일치한다.

---

# Stage 4: 검증과 리스크 통제

> **Stage 4 / 5** | 출처: `S4_chart_rendering_v7.md`, `S3_signal_backtester_v7.md`, `P3_validation_risk.md`, `.claude/rules/quality-gates.md` | V7 (2026-04-07)

*"두 차례 OOS 교정 모두 기각되었다. 우리는 제대로 작동한 것처럼 위장하는 대신 학술적 기본값을 선택했다." 정직함이 신뢰를 만든다.*

> **[핵심 요약]** 303,956건 패턴 백테스트, 7-게이트 검증(다중검정 BH-FDR, Hansen SPA, WFE ≥ 0.3 게이팅). IC = 0.051 (95% BCa CI: [0.024, 0.078], t = 3.73, p < 0.001) — 업계 기준 하위-중간이나 단기 TA에는 통계적 유의. **두 차례 OOS 교정 모두 기각 → 학술적 기본값 채택. 이것이 과적합 회피의 증거.**

---

## 4.1 5-Tier 분류 매트릭스

### 4.1.1 티어 정의

```
5-TIER CLASSIFICATION MATRIX
==============================

   Tier | Criteria                       | Display Treatment
   -----+--------------------------------+---------------------------
    S   | Multi-agent consensus          | Always rendered. Full
        | WR>55%(sell) or <45%(buy)      | visual: glow/bracket +
        | n>1,000; BH-FDR significant   | label + forecast zone.
   -----+--------------------------------+---------------------------
    A   | 2+ agent consensus             | Rendered by default.
        | Statistically significant      | Full visual, behind S
        | WR 55-57% or composite-key     | in density priority.
   -----+--------------------------------+---------------------------
    B   | Required by composites or      | Detection runs; canvas
        | mirrors an S/A-tier pattern    | rendering inactive.
        | WR typically 40-55%            | Panel list only.
   -----+--------------------------------+---------------------------
    C   | Context-only. n<500 or         | Computed for pipeline.
        | WR CI includes 50%             | Warning badge if shown.
   -----+--------------------------------+---------------------------
    D   | WR~50%, noise, or redundant    | Suppressed entirely.
        | No independent predictive power| No detect, no render.
   -----+--------------------------------+---------------------------

   Backtester Gate (orthogonal):
     reliabilityTier A: BH-FDR sig, wrAlpha>=5%, n>=100, WFE>=50%
     reliabilityTier B: BH-FDR sig, wrAlpha>=3%, n>=30,  WFE>=30%
     A/B demoted to C if WFE<30% or Hansen SPA rejects
```

분류(S/A/B/C/D)가 캔버스 가시성을 제어한다. 백테스터의 신뢰성 티어(A/B/C/D)가 신뢰도 배지 스타일링을 제어한다. 패턴이 분류에서 S-tier이면서 백테스팅에서 신뢰성-C(WFE < 30%)일 수 있다.

### 4.1.2 현재 인구

| 티어 | 캔들 | 차트 | 신호 | 복합 | 합계 |
|------|------|------|------|------|------|
| S | 11 | 2 | 2 | 2 | 17 |
| A | 2 | 2 | 15 | 3 | 22 |
| B | 13 | 7 | 5 | 11 | 36 |
| C | 3 | -- | -- | -- | 3 |
| D | 5 | -- | 4 | 3 | 12 |

S + A = 39개 활성 렌더링 요소. B-tier 탐지는 여전히 실행되는데, 해당 패턴이 복합 신호의 필수 입력으로 사용되기 때문이다(예: 해머 WR = 45.2%는 B-tier이지만, S-tier 복합 `strongBuy_hammerRsiVolume`에서 필수).

---

## 4.2 렌더링 스택 요약

2개의 ISeriesPrimitive 구현이 단일 애니메이션 프레임에서 모든 오버레이를 그린다. PatternRenderer가 패턴 기하학을 위한 9개 레이어를 담당하고, SignalRenderer가 지표 파생 마커를 위한 4개 레이어를 담당한다.

| 렌더러 | 레이어 | 주요 기능 |
|--------|--------|---------|
| PatternRenderer L1-L9 | glows, brackets, trendAreas, polylines, hlines, connectors, labels, forecastZones, extendedLines | 캔들/차트 패턴 시각화, HTS 스타일 라벨, 예측 구간 |
| SignalRenderer S-L1~S-L4 | vBands(배경), divLines, diamonds, stars + vLabels(전경) | 골든/데드 크로스, 다이버전스, MA 크로스 마커, Tier-1 복합 |

**밀도 예산(Density Budget)**: 패턴 최대 3개, 확장선 최대 5개, 다이아몬드 최대 6개, 별 최대 2개, 다이버전스 선 최대 4개, 최근 50봉만.

**줌 적응형 패턴 제한**: 가시 봉 <= 50이면 패턴 1개, 51-200이면 2개, > 200이면 3개, > 800이면 라벨 숨김.

**3단계 가시성 필터**: (1) VizToggle(4범주 사용자 토글, 분석은 항상 실행, 렌더 시점 필터링), (2) 티어 필터(S+A만 캔버스, B는 패널만), (3) 가시 범위 필터(화면 밖 캔들 패턴 건너뜀).

**색상 체계**: 한국 관례: 상승은 빨강(`#E05050`), 하락은 파랑(`#5086DC`). 패턴 오버레이는 방향 색상을 사용하지 않음(민트/보라/은색/금색). 대시 패턴으로 확인 상태 인코딩(실선=확인, `[5,3]`=미확인).

---

## 4.3 검증 문제의 본질

30개 이상 패턴을 2,700개 이상 종목과 5개 수익률 기간에 걸쳐 탐지하는 시스템은 최대 607,500(패턴, 기간, 종목) 삼중 조합(triple)을 평가한다. 통계적 통제 없이는 순수 우연이 수천 건의 겉보기에 유의한 결과를 생산한다. 이 섹션은 모든 패턴이 통과해야 하는 7개 게이트, 실증 결과, 인정된 한계를 기술한다.

교차 참조: D2 `P3_validation_risk.md` Sections 3.1--3.7.

---

\clearpage

## 4.4 7-게이트 검증 스택

각 패턴 유형은 7개의 순차 게이트를 통과한다. 어떤 게이트에서든 실패하면 티어 강등 또는 기각이 발동한다. 게이트는 추정에서 다중 검정 보정, 생존자 조정 순서로 정렬된다.

| 게이트 | 방법 | 해결하는 실패 모드 | 학술적 근거 |
|--------|------|------------------|-----------|
| 1 | WLS 회귀(Ridge + HC3) | KRX 수익률의 이분산성 | Hoerl & Kennard(1970); MacKinnon & White(1985) |
| 2 | 워크 포워드 평가(WFE) | 단일 훈련/검증 분할 과적합 | Pardo(2008); Bailey & Lopez de Prado(2014) |
| 3 | BH-FDR(q=0.05, 45개 가설) | 다중 검정에서의 허위 발견 | Benjamini & Hochberg(1995) |
| 4 | Hansen SPA(B=500) | 패턴 유니버스 전체 데이터 스누핑 | Hansen(2005) |
| 5 | BCa 부트스트랩 CI(500 복제) | 비정규 수익률 분포 | Efron(1987); Fama & French(2010) |
| 6 | 롤링 OOS IC | 표본 내 IC 부풀림 | Grinold & Kahn(2000) |
| 7 | 생존자 보정 | 상장폐지 종목 편향(308 종목) | Elton, Gruber & Blake(1996) |

**게이트 1-2: 추정 및 과적합 통제.** GCV 선택 람다를 가진 Ridge 패널티 WLS가 안정적 계수를 제공; HC3 표준 오차(Ridge 패널티 역행렬을 사용한 샌드위치 추정량)가 KRX +/-30% 일일 가격 제한으로 인한 이분산적 수익률에서 유효한 추론을 생산. 워크 포워드 평가(4-6 확장 윈도우 폴드, 2x-기간 퍼지 갭)가 표본 외 보존을 측정: WFE < 30%이면 표본 내 통계와 무관하게 Tier C로 강등.

**게이트 3-4: 다중 검정 및 데이터 스누핑.** BH-FDR이 종목당 45개 가설에 걸쳐 5% 수준의 허위 발견 비율을 통제 -- Bonferroni보다 상당히 강력하면서 통계적 엄밀성 유지. Hansen SPA가 최고 패턴이 무작위 진입 벤치마크를 진정으로 능가하는지 검정; SPA 실패는 모든 Tier A/B 패턴을 C로 강등.

**게이트 5: 분포 강건성.** 달력시간 블록 부트스트랩(전체 월 재샘플링)이 월 내 의존성 보존. BCa 보정이 KRX의 왜도가 높고 첨도가 높은 수익률에 대해 2차 정확한 커버리지 제공. 1번째/99번째 백분위수 윈저화가 CI 폭을 제한.

**게이트 6: 예측력.** 비중첩 OOS 윈도우에서의 Spearman 순위 IC가 티어 승격을 게이팅: IC > 0.02이면 Tier A, IC > 0.01이면 B.

**게이트 7: 생존자.** 3-tier 조회가 308개 누락 상장폐지 종목에서의 매수 패턴 WR 부풀림을 보정. 조정은 [0.92, 1.0]으로 클램핑.

교차 참조: D2 `P3_validation_risk.md` Sec 3.1--3.4; `S3_signal_backtester_v7.md` BT-01~BT-28.

---

## 4.5 검증 게이트 흐름도

```
   VALIDATION GATE FLOW (per pattern type)
   ========================================

   Raw Pattern Occurrences (303,956 instances)
          |
          v
   [Gate 1] WLS Regression (Ridge + HC3)
          |  HC3 SEs for heteroscedasticity
          v
   [Gate 2] Walk-Forward Evaluation
          |  4-6 folds, purge = 2 x horizon
          |  WFE < 30% --> demote to C
          v
   [Gate 3] BH-FDR (q=0.05, 45 hypotheses)
          |  Reject where p_(k) <= k * q / m
          v
   [Gate 4] Hansen SPA (B=500)
          |  H0 not rejected --> A/B to C
          v
   [Gate 5] BCa Bootstrap CI (500 rep)
          |  Calendar-time block resampling
          v
   [Gate 6] Rolling OOS IC (Spearman)
          |  IC > 0.02: A | IC > 0.01: B
          v
   [Gate 7] Survivorship Correction
          |  308 delisted, Elton et al. (1996)
          |  Buy WR adjusted down 0.1-1.1pp
          v
   Tier Assignment: A / B / C / D
```

---

## 4.6 정보 계수: 정직한 공시

시스템 전체 IC(Huber-IRLS, 업그레이드 후)는 **0.051**이다. 공표된 주식 요인 IC 범위는 0.03~0.10이다(Grinold & Kahn 2000). 0.051에서 시스템은 이 범위의 하위-중간에 위치한다 -- 중위 신흥 시장의 단기 단일 종목 TA에 대해 소폭이지만 비사소적(non-trivial). 시스템은 알파 생성 성과를 주장하지 않는다.

업그레이드 전 OLS IC는 ~0.013(거의 무작위)이었다. 이득은 KRX +/-30% 가격 제한에서의 이상치 수익률 강건적 하향 가중에서 온다(Huber 1964, delta = 1.345 x sigma, sigma = 5일 MAD에서 4.3%).

**알려진 한계.** IC 계산 경로의 회귀 계수는 전체 훈련 세트에서 적합되며, OOS 폴드별로 재적합되지 않는다. 재귀적 OOS IC(WFE 경로, Gate 2 가용)는 이보다 낮을 가능성이 크다. 백테스터에서 Warning W-4로 표시됨.

교차 참조: D2 `P3_validation_risk.md` Section 3.1.2--3.1.3.

---

## 4.7 수식-코드 일치도

독립 감사가 ANATOMY 문서의 15개 핵심 수식을 프로덕션 JS/Python 코드와 기호별로 대조 검사했다.

| 판정 | 건수 | 해석 |
|------|------|------|
| MATCH | 12 | 문서와 코드 간 정확한 대응 |
| MINOR_DIFF | 3 | 문서 정밀도 문제; 코드 오류 없음 |
| DISCREPANCY | 0 | 발견 없음 |

**전체 등급: A.** 3건의 MINOR_DIFF는 문서 수준이다: (1) 교차 참조 테이블의 BND-9/BND-10 라벨 뒤바뀜 -- 코드는 Bharath-Shumway(2008) 단순 DD를 BND-10으로 정확히 구현; (2) MCS v2 소비자 심리 정규화 범위가 BSI 폴백 [50,120] vs ESI 주 경로 [60,130]에 대해 미문서화; (3) JS 라이브 베타가 설계에 의해 Blume(1975) 조정을 생략하지만, 문서 출처 체인에 이 점이 기록되지 않음.

10건의 파일 간 일관성 검사에서 Python과 JS가 무위험 이자율, 최소 관측수, 거래일(250), 소량 거래 임계값, Scholes-Williams 분모 가드에 대해 동일한 상수를 공유함을 확인.

교차 참조: D2 `S0_formula_fidelity_v7.md`(전체 감사).

---

## 4.8 종단간 파이프라인 추적

외부 API에서 스크립트, JSON 저장, JS 런타임을 거쳐 브라우저 렌더링까지 5개 파이프라인을 추적했다. 모두 끊어진 링크 없이 통과.

| # | 파이프라인 | 소스 | 도착지 | 상태 |
|---|----------|------|--------|------|
| 1 | KTB 10년 채권 | ECOS API (817Y002) | financials.js | PASS |
| 2 | 투자자 수급 | KRX OTP auth | 신뢰도 체인 | PASS |
| 3 | Hurst 지수 | OHLCV 캔들 | 목표가 | PASS |
| 4 | 해머 신호 | patterns.js | signalRenderer | PASS |
| 5 | 백테스트 티어 | backtester.js | patternPanel 배지 | PASS |

각 추적에서 검증: (a) API 엔드포인트와 스키마, (b) 합성 데이터가 신뢰도 체인에 진입하는 것을 방지하는 샘플 데이터 가드, (c) JSON 중간 스키마, (d) 렌더링된 출력이 계산된 값과 일치.

교차 참조: D2 `S0_cross_stage_verification_v7.md` Section 0.1.

---

## 4.9 배포 품질 게이트

5개 공식 게이트가 세션, 다중 에이전트 실행, 배포에 걸쳐 정확성을 보호한다.

| 게이트 | 이름 | 유형 | 트리거 |
|--------|------|------|--------|
| 1 | CHECK 6: 파이프라인 연결성 | 자동 | 모든 `verify.py` 실행 |
| 2 | 브라우저 스모크 테스트 | 수동, 10항목 | 다중 파일 변경 후 |
| 3 | 변경 계약(Change Contract) | 문서 템플릿 | 6+ 에이전트 또는 3+ JS 파일 |
| 4 | ANATOMY 우선 워크플로우 | 읽기-후-쓰기 | 3+ JS 파일 터치 |
| 5 | 세션 시작/종료 프로토콜 | 체크리스트 | 매 세션 |

**Gate 1**은 12개 JSON 데이터 소스를 스키마 계약 대비 검증: 파일 존재, 필수 키, 샘플 데이터 가드, 배열 비어있지 않음, 14일 적시성. API 스크립트가 성공적으로 종료하지만 오래된 출력을 생산하는 무성 실패를 포착.

**Gate 2**는 초기화(인덱스 로드, Worker 시작, 콘솔 오류), 데이터 파이프라인(차트 렌더, 거시 로드), 패턴 파이프라인(탐지 토스트, 패널 카드), UI 무결성(vizToggles, 반응형 레이아웃), 배포 무결성(404 없음, Service Worker)을 커버.

**Gates 3-5**는 다중 에이전트 드리프트를 방지: 변경 계약이 파일 소유권 강제; ANATOMY 우선이 코드 전에 문서 업데이트 보장; 세션 프로토콜이 세션 시작과 종료 시 `verify.py --strict` 통과를 요구.

교차 참조: `.claude/rules/quality-gates.md`.

---

## 4.10 정직한 한계 공시

다음 격차를 과대 주장 방지를 위해 공시한다.

**1. 실시간 OOS 검증 부재.** 모든 검증은 과거 OHLCV 데이터 대상이다. 배포 후 신뢰도 점수가 향후 수익률을 실제로 예측하는지 확인하는 페이퍼 트레이딩이나 라이브 거래 검증이 없다.

**2. 실행 품질 미측정.** 백테스터는 다음 봉 시가 진입과 0.265% 왕복 비용을 가정. 실제 슬리피지, 시장 충격(특히 소형 코스닥), 라우팅 지연은 포착되지 않음.

**3. 레짐 강건성이 후방 참조적.** HMM 레짐 라벨은 전환 시(한은 서프라이즈, 서킷 브레이커) 지연. 재분류 완료까지 신뢰도 조정이 방향적으로 틀릴 수 있음.

**4. D등급 상수 민감도.** ~73개 상수가 공표된 출처나 교정을 결여. 최고 영향: 레짐 승수(CONF-7, 모든 패턴에 +/-10-15%). 255,000+ 패턴으로 70/30 분할 재교정한 결과 학술적 기본값보다 나쁜 OOS IC를 생산 -- 현재 경험치가 유지됨.

**5. 종목 간 MTC 부재 (중대 한계).** BH-FDR은 종목별로만 적용. 2,700 x 225 = 607,500 유효 검정 건수에 포트폴리오 수준 보정 없음. 한국 주식의 높은 종목 간 상관관계(특히 위기 시)를 감안하면 유효 독립 검정 수는 ~11,700건(Harvey, Liu & Zhu, 2016 기준)으로 추정되며, 이는 다수의 BH-FDR 기각을 약화시킬 수 있다. **S/A 티어 분류는 포트폴리오 수준 FDR 구현 전까지 잠정적(provisional)이다.**

**6. 생존자 보정이 통계적이지, 데이터 복원이 아님.** 308개 종목 델타가 승률을 조정하지만 실제 상장폐지 수익률 시계열은 포함하지 않음. 파산 꼬리 리스크가 부트스트랩에 포함되지 않음.

교차 참조: D2 `P3_validation_risk.md` Section 3.8.

---

## 4.11 벤치마크 분석: 시스템 vs KOSPI 200

Grinold(1989)의 기본 법칙에 따르면, 정보비율(IR)은 IC와 전략 폭의 함수다: $IR = IC \times \sqrt{BR}$. CheeseStock의 현재 매개변수로 추정하면:

| 지표 | 값 | 산출 근거 |
|------|-----|----------|
| IC | 0.051 | Huber-IRLS, 303,956건 |
| BR (연간 독립 베팅 수) | ~250 | S-tier 패턴 x 일별 종목 |
| 추정 IR | ~0.81 | $0.051 \times \sqrt{250}$ |
| 추정 연간 alpha | ~3.2% | IR x 추적오차 4% 가정 |
| 거래비용 차감 후 alpha | ~1.5-2.0% | 왕복 0.265% x 연간 ~50회 교체 |

> **[핵심 요약]** 거래비용 차감 후 추정 alpha는 연 1.5-2.0% 수준으로, "뛰어난 수익"보다는 "통계적으로 유의한 비용 대비 우위"에 해당한다. 이는 IC = 0.051의 정직한 함의이며, 과대 주장을 경계하는 본 문서의 기조와 일치한다.

**거래비용 주석**: 백테스터 y-벡터는 0.36%(소형 코스닥 시장 충격 포함)를 사용하고, 위 표의 0.265%는 증권거래세 0.18% + 수수료 0.015% x 2 기준 최소 비용이다. 실제 포트폴리오 성과는 두 값 사이에 위치한다.

---

## 4.12 리스크 예산 개요

현재 시스템은 패턴별·종목별 신뢰도 점수를 제공하지만, **포트폴리오 수준의 리스크 예산(VaR/CVaR, MDD)은 아직 구현되지 않았다.** 이는 의도적 설계 범위 제한이다 — CheeseStock은 분석 도구이지 자동매매 시스템이 아니며, 포지션 사이징은 사용자의 영역이다.

향후 로드맵(Stage C: 적응형 신뢰도 조정)에서 포트폴리오 수준 리스크 지표를 추가할 계획이며, 이는 Wc 가중치 시스템의 $m_w$(Market Weight)를 통해 시장 레짐별 위험 한도를 동적 조정하는 방식으로 구현된다.

교차 참조: Section 5.2 MRA→RL 로드맵, Section 5.5 Wc 가중치 시스템.

---

### Stage 4 요약

303,956 패턴 인스턴스에 적용된 7개 순차 게이트가 IC = 0.051(요인 기준 소폭)을 생산. 수식 일치도: 15건 중 12건 정확, 3건 문서 소수점 문제, 코드 오류 0건. 5개 파이프라인 추적: 모두 PASS. 5개 배포 게이트가 프로덕션 보호. 시스템은 검증하지 않는 것을 공시: 실시간 OOS, 실행 품질, 레짐 전환, D등급 규모, 종목 간 MTC, 상장폐지 꼬리 리스크.

**두 차례 OOS 교정 모두 기각되었다. 우리는 학술적 기본값을 선택했다.** 이것이 CheeseStock의 차별점이다 -- 제대로 작동한 것처럼 위장하는 대신 정직하게 한계를 인정한다.

---

# Stage 5: 로드맵과 확장 전략

> **Stage 5 / 5** | 출처: 프로젝트 메모리, `.claude/rules/quality-gates.md`, `CLAUDE.md` | V7 (2026-04-07)

*한계를 숨기지 않는다. 각 한계에는 MRA → RL, Kiwoom → Koscom 등 구체적 전환 경로가 수립되어 있다.*

> **[핵심 요약]** 6개 알려진 한계 각각에 구체적 개선 경로 수립. MRA → RL 3단계 로드맵(A: 22-col CSV, B: 18-col IC 0.147, C: RL warm-start). Kiwoom OCX → Koscom Open API 31-endpoint 전환 설계 완료. Cloudflare Pages 배포(19,104→13,540 파일 최적화).

---

## 5.1 기술적 한계와 개선 경로

Stage 4에서 공시한 6가지 한계 각각에 대해 구체적 개선 계획이 존재한다.

| 한계 | 현재 상태 | 개선 경로 | 우선순위 |
|------|---------|----------|---------|
| 실시간 OOS 검증 없음 | 과거 데이터만 사용 | Koscom API 전환 후 페이퍼 트레이딩 루프 구축 | P1 |
| 실행 품질 미측정 | 0.265% 고정 비용 가정 | 실시간 호가 데이터에서 슬리피지 모델 추정, 시가총액별 임팩트 함수 | P2 |
| 레짐 지연 | HMM 후방 참조 | CUSUM 온라인 변점 탐지 + HMM 결합(이미 I-27로 구현, 미연결) | P1 |
| D등급 상수 73개 | 학술적 기본값 유지 | MRA Stage B-C에서 RL 기반 적응형 교정(아래 5.2 참조) | P0 |
| 종목 간 MTC 부재 | 종목별 BH-FDR | 포트폴리오 수준 FDR 프레임워크 설계(Harvey et al. 2016) | P2 |
| 생존자 통계 보정 | 308개 종목 델타 | KRX 상장폐지 데이터 수집 + 실제 수익률 시계열 재구성 | P3 |

---

\clearpage

## 5.2 MRA에서 RL로: 하이브리드 로드맵

다중 회귀 분석(MRA, Multi-Regression Analysis)에서 강화 학습(RL, Reinforcement Learning)으로의 전환은 3단계로 계획되어 있다.

### Stage A: MRA 기반 교정 (완료)

18-28 컬럼 CSV를 생산하는 특징 행렬을 구축했다. IC 0.147(표본 내)을 달성했으나 잔차 첨도(kurtosis) 55.88이 과적합 징후를 보였다. OOS 검증에서 IC가 급격히 하락하여 학술적 기본값을 유지하는 결정으로 귀결되었다.

### Stage B: RL 웜 스타트 (진행 중)

MRA Stage A의 특징 행렬을 RL 에이전트의 상태 공간(state space)으로 재사용한다. 핵심 설계 결정:

- **보상 함수(Reward Function)**: 평가 지표(IC)와 정확히 일치하는 보상 함수 사용. 승률 기반이 아닌 순위 상관 기반.
- **IC 게이트**: `compute_rl_policy.py`가 OOS IC < 0인 정책을 자동 기각. `backtester._rlPolicy`에서 IC 게이트 통과 시에만 활성화.
- **상태 공간**: 거시 레짐(HMM 상태), 유동성(ILLIQ), 변동성(ATR/HV), 수급(외국인 순매수), 기술적(패턴 신뢰도) -- 이미 CONF-1~CONF-8이 사용하는 변수들.
- **행동 공간(Action Space)**: CONF 함수의 승수 범위 [0.70, 1.30] 내 연속 값 조정.

### Stage C: 적응형 신뢰도 조정 (계획)

RL 에이전트가 실시간 시장 상태를 관찰하고 CONF 함수의 승수를 적응적으로 조정한다. 단, 학술적 방향 제약(매수 패턴은 리스크 오프에서 할인)은 하드 제약으로 유지한다. 규모만 데이터에서 학습한다.

**핵심 안전 장치**: RL 정책이 학술적 기본값보다 나쁜 OOS IC를 생산하면 자동으로 학술적 기본값으로 폴백한다. "교정하지 않는 것이 잘못된 교정보다 낫다"는 원칙.

---

## 5.3 API 전환: Kiwoom에서 Koscom으로

### 현재 상태: Kiwoom OCX

현재 실시간 데이터는 키움증권 OCX(Open API+)를 통해 공급된다. 이 아키텍처의 구조적 제약:

- **Windows 전용**: OCX 컨트롤은 Windows 32-bit COM 객체. Python 3.9 32-bit + pywin32 필수.
- **단일 동시 연결**: 키움 API는 계정당 1개 동시 연결만 허용. `server\ws_server.py`의 7-계층 보호 체계가 이 제한을 관리.
- **비상업적 사용**: 키움 API는 개인 거래 목적으로 설계. 서비스로의 재배포에 대한 법적 불확실성.

### 목표 상태: Koscom API

Koscom(한국거래소 시장정보 자회사)은 상업적 재배포가 허용된 정보 공급 API를 제공한다:

- **플랫폼 독립**: REST API 기반, OS 무관.
- **상업적 라이선스**: 데이터 재배포 계약 가능.
- **엔드포인트 커버리지**: OHLCV, 실시간 체결, 투자자별 매매동향, 파생상품 시세.

전환 시 `api.js`와 `realtimeProvider.js`만 수정하면 된다 -- Stage 1에서 확립한 "분석 파이프라인은 모드를 인지하지 않는다"는 아키텍처 불변식 덕분이다.

---

## 5.4 인프라와 배포 전략

### Cloudflare Pages 배포

현재 프로덕션은 Cloudflare Pages(`cheesestock.pages.dev`)에 배포된다. `cheesestock.co.kr` 도메인이 이 배포에 연결되어 있다.

핵심 제약과 해결:

| 제약 | 해결 |
|------|------|
| 에셋당 25MB 제한 | `stage_deploy.py`가 파일 선별하여 `deploy/` 디렉터리에 스테이징 |
| wrangler 한국어 커밋 메시지 불가 | ASCII-only 커밋 메시지 강제 |
| 파일 제외 메커니즘 없음 | `stage_deploy.py`가 유일한 배포 게이트키퍼 |
| 최대 20,000 파일 | 15m/30m 장중 데이터 제외(13,540 파일로 축소) |

### Service Worker 캐시 전략

`sw.js`의 `CACHE_NAME`(예: `cheesestock-vN`)이 오프라인 캐시를 관리한다. JS 파일 변경 시 `CACHE_NAME` 버전을 반드시 올려야 하며(E4 게이트), `STATIC_ASSETS` 배열에 파일 추가/제거를 반영해야 한다(E6 게이트).

### 일일 자동화

`Task Scheduler`의 `CheeseStock_HourlyDeploy`가 월-금 09:30-16:05에 매시간 실행:
- OHLCV 다운로드 + 장중 생성 + 인덱스 가격 업데이트
- wrangler pages deploy

---

## 5.5 Wc 적응형 가중치 시스템 진화

Wc(Adaptive Weight Coefficient)는 OHLCV에서 적응형 가중치까지 8단계 수식 체인을 통해 계산되는 패턴 품질 메타데이터다. 현재 7-Stage 로드맵 중 초기 단계에 있다:

### 5.5.1 수식 체인 요약

| 가중치 | 수식 | 범위† | 학술 근거 |
| ------ | ---- | ----- | -------- |
| $h_w$ | $2 \cdot H_{\text{shrunk}}$ | [0.6, 1.4] | James-Stein 수축 |
| $v_w$ | $1 / \sqrt{ATR_{14}/ATR_{50}}$ | [0.7, 1.4] | RiskMetrics(1996) |
| $m_w$ | $\exp(-0.14 \cdot \text{excess})$ | [0.6, 1.0] | Lo(2004) AMH |
| $W_c$ | $\alpha h_w + \beta v_w + \gamma m_w$ | 합성 | Ridge 회귀 계수 |

†범위는 `clamp()` 적용 후 값.

$H_{\text{shrunk}}$는 패턴 유형별 역사적 승률의 James-Stein 수축 추정치이며, $\text{excess}$는 시장 종합 점수(MCS)의 중립 레짐 초과분이다.

Wc는 현재 CONF-10에서 메타데이터로 주입되며 신뢰도를 직접 수정하지 않는다. 향후 Stage에서 렌더링 우선순위(예측 구간 투명도, 다이아몬드 크기)와 복합 신호 가중에 직접 반영될 예정이다.

출처: `project_wc_formula_chain.md`, `backtester.js` lines 1820-1860.

---

## 5.6 핵심 논지 재확인

CheeseStock은 다음 네 가지 원칙 위에 구축되었다:

1. **데이터 투명성**: 모든 데이터의 출처를 밝히고, 시드 데이터를 절대 실제 데이터로 표시하지 않는다. 3-tier 신뢰 체계가 이를 보장한다.

2. **학술적 근거**: 306개 이상의 상수 각각에 CFA 논문 등급(A/B/C/D/E)을 부여하고, 방향의 학술적 근거와 규모의 한계를 명시한다.

3. **정직한 검증**: IC = 0.051, 수식-코드 일치 12/15, OOS 교정 기각 사실을 숨기지 않고 공시한다. "두 차례 OOS 교정 모두 기각되었다. 우리는 학술적 기본값을 선택했다."

4. **우아한 열화**: 데이터 누락은 기능 중단이 아닌 분석 깊이 감소를 의미한다. 10-함수 신뢰도 체인의 각 함수가 독립적으로 null 안전하며, 파이프라인은 부분 데이터로도 가치 있는 분석을 제공한다.

이 네 가지 원칙이 한국 주식 시장 기술 분석의 새로운 기준을 제시한다.

---

# 부록 A: 교차 참조 색인

D4의 모든 섹션을 D2 소스 문서 및 해당되는 경우 D1 섹션과 매핑하는 표이다. D2 문서는 `docs/anatomy/`에 위치한다. D1은 `docs/anatomy/deliverable1_executive/P0_executive_summary.md`이다.

## A.1 Stage 1: 문제 정의와 시장 기회

| D4 섹션 | D2 소스 문서 | D1 섹션 |
|---------|------------|--------|
| 1.2 플랫폼 정체성 | `S0_index_v7.md` (lines 1-30) | P0 Sections 2.1, 2.3 |
| 1.3 기술 스택 | `S5_ui_architecture_v7.md` (sec 5.1) | P0 Section 2.3 |
| 1.4 규모 요약 | `S0_index_v7.md` Formula Registry, `S1_api_pipeline_v7_sec5to8.md` (sec 1.6.6), `S3_ta_methods_v7.md` | P0 Section 2.1 |
| 1.5 듀얼 모드 아키텍처 | `S5_lifecycle_workers_v7.md` (sec 5.5.2) | P0 Section 2.3 |

## A.2 Stage 2: 데이터 기반과 신뢰 체계

| D4 섹션 | D2 소스 문서 | D1 섹션 |
|---------|------------|--------|
| 2.2 API 소스 맵 | `S1_api_pipeline_v7_sec1to4.md` (sec 1.1-1.4) | P0 Section 2.1 |
| 2.2.2 연산 스크립트 | `S1_api_pipeline_v7_sec5to8.md` (sec 1.5.1-1.5.15) | P0 Section 4.1 |
| 2.3 데이터 신뢰 의사결정 트리 | `.claude/rules/financial.md`, `S1_api_pipeline_v7_sec5to8.md` (sec 1.6.6) | P0 Section 5.1 |
| 2.4 JSON 파일 카탈로그 | `S1_api_pipeline_v7_sec5to8.md` (sec 1.5.13-1.5.14, 1.6.4) | P0 Section 2.1 |
| 2.5 파이프라인 신뢰성 | `S1_api_pipeline_v7_sec9.md` (sec 1.9.1-1.9.2) | P0 Section 4.1 |
| 2.6 샘플 데이터 가드 | `S1_api_pipeline_v7_sec5to8.md` (sec 1.6.1-1.6.4) | P0 Section 5.1 |
| 2.7 CHECK 6 적시성 | `.claude/rules/quality-gates.md` Gate 1 | P0 Section 4.1 |
| 2.8 3-배치 로더 | `S1_api_pipeline_v7_sec5to8.md` (sec 1.7) | P0 Section 2.1 |
| 2.9 DART 파이프라인 | `S1_api_pipeline_v7_sec1to4.md` (sec 1.4), `.claude/rules/financial.md` | P0 Section 4.1 |

## A.3 Stage 3: 분석 엔진과 신호 체계

| D4 섹션 | D2 소스 문서 | D1 섹션 |
|---------|------------|--------|
| 3.1 3계층 아키텍처 | `S3_ta_methods_v7.md` (sec 3.1-3.2), `S3_signal_backtester_v7.md` (sec 3.3-3.5) | P0 Section 1.1 |
| 3.2 계층 1 지표 | `S3_ta_methods_v7.md` (sec 3.1.1-3.1.6) | P0 Section 1.1 |
| 3.3 계층 2 패턴 | `S3_ta_methods_v7.md` (sec 3.2.1-3.2.6) | P0 Section 1.3 |
| 3.4 ATR 정규화 | `S3_ta_methods_v7.md` (sec 3.2.1), `.claude/rules/patterns.md` | P0 Section 1.3 |
| 3.5 계층 3 신호 흐름 | `S3_signal_backtester_v7.md` (sec 3.3.1-3.3.5) | P0 Section 1.1 |
| 3.6 백테스터 요약 | `S3_signal_backtester_v7.md` (sec 3.4.2, 3.5.2-3.5.6) | P0 Section 5.2 |
| 3.7 Worker 프로토콜 | `.claude/rules/patterns.md`, `S3_signal_backtester_v7.md` (sec 3.4) | P0 Section 1.1 |
| 3.8 종단간 흐름 | `S3_ta_methods_v7.md`, `S3_signal_backtester_v7.md` | P0 Section 1.1 |
| 3.9 신뢰도 파이프라인 개요 | `S3_confidence_chain_v7.md` (sec 3.6.1) | P0 Section 1.1 |
| 3.10 신뢰도 폭포 | `S3_confidence_chain_v7.md` (sec 3.6.3) | -- |
| 3.11 함수별 요약 | `S3_confidence_chain_v7.md` (sec 3.6.2-3.6.11) | P0 Section 2.3 |
| 3.12 데이터 의존성 맵 | `S3_confidence_chain_v7.md` (sec 3.6.4) | -- |
| 3.13 Null 안전 | `S3_confidence_chain_v7.md` (sec 3.6.4) | -- |
| 3.14 상호작용 효과 | `S3_confidence_chain_v7.md` (sec 3.6.3) | -- |
| 3.15 D등급 감사 | `S3_confidence_chain_v7.md` (sec 3.6.6), `S2_sec25_v7.md`, `S2_sec27_v7.md` | P0 Section 5.1 |
| 3.16 민감도 순위 | `S3_confidence_chain_v7.md` (sec 3.6.3) | -- |

## A.4 Stage 4: 검증과 리스크 통제

| D4 섹션 | D2 소스 문서 | D1 섹션 |
|---------|------------|--------|
| 4.1 5-Tier 매트릭스 | `S4_chart_rendering_v7.md` (sec 4.2-4.3), `S3_signal_backtester_v7.md` (sec 3.5.6) | P0 Section 5.3 |
| 4.2 렌더링 스택 요약 | `S4_chart_rendering_v7.md` (sec 4.2.2-4.2.13, 4.3.1-4.3.6), `.claude/rules/rendering.md` | P0 Section 5.3 |
| 4.4 7-게이트 스택 | `P3_validation_risk.md` (sec 3.1-3.4), `S3_signal_backtester_v7.md` (BT-01..BT-28) | P0 Section 5.2 |
| 4.5 게이트 흐름 | `P3_validation_risk.md` (sec 3.1-3.4) | P0 Section 5.2 |
| 4.6 IC 공시 | `P3_validation_risk.md` (sec 3.1.2-3.1.3) | P0 Section 5.2 |
| 4.7 수식-코드 일치도 | `S0_formula_fidelity_v7.md` | P0 Section 5.2 |
| 4.8 파이프라인 추적 | `S0_cross_stage_verification_v7.md` (sec 0.1) | P0 Section 5.2 |
| 4.9 배포 품질 게이트 | `.claude/rules/quality-gates.md` | -- |
| 4.10 정직한 한계 | `P3_validation_risk.md` (sec 3.8) | P0 Section 5.2 |

## A.5 Stage 5: 로드맵과 확장 전략

| D4 섹션 | 출처 |
|---------|------|
| 5.2 MRA→RL 로드맵 | 프로젝트 메모리 `project_mra_rl_roadmap.md`, `session_0403_mra_stage_b.md`, `session_0403_mra_stage_c1.md` |
| 5.3 Kiwoom→Koscom 전환 | `project_commercialization_blockers.md`, `CLAUDE.md` WebSocket 서버 섹션 |
| 5.4 인프라/배포 | `project_cloudflare_deploy_strategy.md`, `.claude/rules/scripts.md` |
| 5.5 Wc 시스템 | `project_wc_weight_system.md`, `project_wc_formula_chain.md` |

---

# 부록 B: 용어 사전

이 문서에서 사용되는 35개 용어의 한 줄 정의. 괄호 안의 학술 참고 문헌은 해당 용어가 사용된 맥락에서 이를 정의하거나 대중화한 출처를 나타낸다.

**ATR** -- 평균 진정 범위(Average True Range): 14기간 장중 가격 변동성 측정치로, CheeseStock 전체에서 모든 패턴 기하 임계값의 정규화 분모로 사용(Wilder 1978).

**BCa** -- 편향 보정 가속 부트스트랩(Bias-Corrected and Accelerated bootstrap): 표본 분포의 편향과 왜도 모두를 보정하는 2차 정확도 부트스트랩 신뢰 구간 방법(Efron 1987).

**BH-FDR** -- Benjamini-Hochberg 허위 발견률(False Discovery Rate): 종목당 45개 패턴 가설에 걸쳐 q=0.05 수준에서 허위 발견 비율을 통제하는 다중 검정 보정(Benjamini & Hochberg 1995).

**CCSI** -- 소비자 심리 지수(Consumer Confidence Survey Index): 한국은행(BOK)이 발표하는 월간 한국 소비자 심리 지수; CONF-1에서 심리가 85 미만일 때 매수 패턴 신뢰도를 게이트하는 데 사용.

**CONF-N** -- 10-함수 승법적 조정 체인의 N번째 신뢰도 함수; CONF-1부터 CONF-10은 `appWorker.js`에서 탐지된 모든 패턴의 신뢰도 점수에 순차 적용되는 함수를 지칭.

**DART** -- 전자공시시스템(Data Analysis, Retrieval and Transfer system): K-IFRS 재무제표를 위한 금융감독원(FSS) 공개 플랫폼(opendart.fss.or.kr).

**DD** -- 부도거리(Distance-to-Default): 기업의 자산 가치가 부도점으로부터 몇 표준편차 떨어져 있는지를 나타내는 Merton(1974) 모델 파생 측정치; CONF-6에서 Bharath & Shumway(2008) 단순화 근사로 구현.

**DRV** -- 파생상품(Derivatives): 선물, 옵션 및 KRX 파생상품 시장에서 거래되는 관련 상품의 총칭; CONF-5에 공급되는 파생상품 데이터 파이프라인을 느슨하게 지칭.

**ECOS** -- 경제통계시스템(Economic Statistics System): 한국은행의 KTB 수익률, 통화량, 신용 스프레드 등 거시경제 데이터를 위한 공개 API(ecos.bok.or.kr).

**EDF** -- 경험적 분포 함수(Empirical Distribution Function): 비모수 부트스트랩 절차에서 사용되는 표본 기반 누적 분포 함수; BCa CI 계산에서 참조.

**EVA** -- 경제적 부가가치(Economic Value Added): NOPAT에서 투자 자본의 WACC 기반 자본 비용을 차감하여 계산한 경제적 이익; `data/backtest/eva_scores.json`에서 컬럼 D 재무 패널에 표시.

**GCV** -- 일반화 교차 검증(Generalized Cross-Validation): Ridge 정규화 매개변수 lambda를 자동 선택하는 데 사용되는 계산 효율적 LOO 교차 검증 근사(Golub, Heath & Wahba 1979).

**GEX** -- 감마 노출(Gamma Exposure): 미결제 옵션 포지션에서 파생된 옵션 시장 조성자의 총 델타 헤지 수요; CONF-7에서 `options_analytics.json`의 입력으로 사용.

**HC3** -- 이분산성 일관 표준 오차 + 잭나이프 보정(Heteroskedasticity-Consistent standard errors): 미지의 이분산성 하에서 소~중간 표본에서 유효한 추론을 제공하는 샌드위치 추정량(MacKinnon & White 1985).

**HHI** -- 허핀달-허시만 지수(Herfindahl-Hirschman Index): 산업 내 기업 시장 점유율 제곱합으로 계산되는 시장 집중도 측정치; CONF-4에서 집중 업종의 평균 회귀 패턴을 부스트하는 데 사용.

**HMM** -- 은닉 마르코프 모델(Hidden Markov Model): Baum-Welch EM을 통해 추정되는 확률적 레짐 전환 모델; `compute_hmm_regimes.py`에서 시장을 2-3개 잠재 레짐으로 분류하며 CONF-7에 공급.

**IC** -- 정보 계수(Information Coefficient): 예측된 신뢰도 점수와 후속 N일 수익률 간의 Spearman 순위 상관; 주요 표본 외 예측력 지표로 현재 시스템 전체 0.051.

**ILLIQ** -- Amihud 비유동성 비율(Amihud Illiquidity Ratio): 일일 절대 수익률을 일일 KRW 거래대금으로 나눈 값의 룩백 기간 평균; 거래 단위당 가격 충격을 측정(Amihud 2002).

**ISeriesPrimitive** -- TradingView Lightweight Charts v5.1.0의 특정 차트 시리즈에 부착되는 커스텀 Canvas2D 오버레이 인터페이스; PatternRenderer와 SignalRenderer가 모든 패턴 및 신호 주석을 그리는 메커니즘.

**K-IFRS** -- 한국 채택 국제회계기준(Korean International Financial Reporting Standards): 모든 KRX 상장 기업의 재무제표 작성에 사용되는 한국의 IFRS 채택; DART 보고 재무 데이터의 원천 기준.

**KRX** -- 한국거래소(Korea Exchange): KOSPI(대형주)와 KOSDAQ(성장/기술) 시장을 운영하는 통합 거래소; 모든 OHLCV 가격 데이터의 주요 소스.

**KSIC** -- 한국 표준 산업 분류(Korean Standard Industry Classification): CONF-3의 업종 순환 분석과 재무 패널의 동종 그룹 비교에 사용되는 공식 산업 분류.

**LWC** -- TradingView Lightweight Charts: 모든 가격 차트 렌더링에 사용되는 오픈소스 차트 라이브러리(v5.1.0); 캔들스틱, 라인, 영역 시리즈와 ISeriesPrimitive 커스텀 오버레이 지원.

**MAC** -- 이동 평균 크로스(Moving Average Cross): 서로 다른 기간의 두 이동 평균이 교차할 때 생성되는 신호; 신호 엔진의 MA 크로스 탐지기(SIG-01)에서 탐지.

**MCS** -- 거시 복합 점수(Macro Composite Score): ECOS, FRED, KOSIS 입력에서 `compute_macro_comp.py`가 계산하는 8-요인 복합 점수(0-100); v1(단순)은 CONF-3에서, v2(전체)는 CONF-7에서 사용.

**MIC** -- 최대 정보 계수(Maximal Information Coefficient): 두 변수 간 비모수적 의존도 측정; 비선형 요인 관계의 이론적 기반에서 참조.

**OHLCV** -- 시가(Open), 고가(High), 저가(Low), 종가(Close), 거래량(Volume): 시스템 전체에서 사용되는 표준 5-필드 캔들스틱 데이터 형식; 종목별 JSON 파일에 저장되어 분석 파이프라인에 전달.

**OOS** -- 표본 외(Out-of-Sample): 모델 훈련에서 제외되고 평가에만 사용되는 데이터; 표본 내(IS) 적합과 OOS 일반화 검증 간의 근본적 구분.

**PCR** -- 풋콜 비율(Put-Call Ratio): 풋 옵션 미결제 약정 대 콜 옵션 미결제 약정의 비율; CONF-5에서 역방향 심리 지표로 사용(Pan & Poteshman 2006).

**RORO** -- 리스크 온 / 리스크 오프(Risk-On / Risk-Off): 투자자 위험 선호를 기술하는 시장 레짐 분류; CONF-2가 VKOSPI, 신용 스프레드, USD/KRW를 포함한 5-요인 복합에서 시장을 3-상태(리스크 온 / 중립 / 리스크 오프)로 분류.

**SPA** -- 우월 예측 능력 검정(Superior Predictive Ability test): 유니버스 내 최고 전략이 무작위 진입 벤치마크를 진정으로 능가하는지 평가하는 부트스트랩 검정(B=500 복제), 데이터 스누핑 방지(Hansen 2005).

**VRP** -- 분산 리스크 프리미엄(Variance Risk Premium): 내재 변동성(옵션)과 실현 변동성(OHLCV) 간의 스프레드; 변동성 보험 매도자가 요구하는 보상을 나타냄; CONF-3 Factor 8에서 사용.

**Wc** -- 적응형 가중 계수(Adaptive Weight Coefficient): 패턴 특성에서 파생된 신뢰도 가중 복합 요인; CONF-10에서 메타데이터로 신호에 주입되며, 렌더링 레이어에서 예측 구간 투명도와 다이아몬드 마커 크기를 조절하는 데 사용.

**WFE** -- 워크 포워드 평가(Walk-Forward Evaluation): 다수 폴드에 걸쳐 OOS 성과 대 IS 성과 비율을 측정하는 확장 윈도우 백테스팅 프로토콜; WFE >= 50%는 "강건", < 30%이면 Tier C로 강등 발동.

**WLS** -- 가중 최소 자승법(Weighted Least Squares): 최근 관측치에 지수 감쇠 가중(lambda=0.995, 반감기 ~7개월)을 적용하는 회귀 변형, 최근 데이터가 더 레짐 대표적이라는 적응형 시장 가설(Adaptive Markets Hypothesis) 원리를 구현(Lo 2004).

---

산출물 4 끝: 구조 흐름 / CheeseStock 프로덕션 아나토미 V7 / 생성일: 2026-04-07
