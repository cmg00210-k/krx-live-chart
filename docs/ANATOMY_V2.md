# CheeseStock Project Anatomy v2

> 작성일: 2026-03-25 | 대상: 사용자-Claude 소통용 전체 해부도

---

## 1. 프로젝트 정체성

| 항목 | 내용 |
|------|------|
| 이름 | CheeseStock (치즈스톡) |
| 도메인 | cheesestock.co.kr / cheesestock.pages.dev |
| 대상 시장 | KRX (KOSPI 939 + KOSDAQ 1,785 = 2,724종목) |
| 핵심 기능 | 30+ 패턴 기술적 분석 + WLS 예측 + 재무지표 |
| 기술 스택 | Vanilla JS (번들러 없음) + Python 분석 파이프라인 |
| 배포 | Cloudflare Pages (wrangler) |
| 실시간 | Kiwoom OCX WebSocket (개인용) |

---

## 2. 전체 구조도

```
cheesestock.co.kr  (브라우저)
┌────────────────────────────────────────────────────────────────┐
│  A: Sidebar    B: Chart          C: Pattern      D: Financial │
│  (260px)       (flex:1)          (240px)         (380px)      │
│                                                                │
│  2700+ 종목    TradingView LWC   패턴 설명 카드   PER/PBR/PSR │
│  가상 스크롤    + 9레이어 오버레이  학술 메타데이터   CAGR/ROE    │
│  정렬/필터     + 6개 서브차트      심리 해석        트렌드 차트   │
│  스파크라인     + 드로잉 도구      손절/목표가       업종 비교     │
└────────────────────────────────────────────────────────────────┘
        ↑                    ↑                    ↑
   sidebar.js          chart.js              financials.js
                  patternRenderer.js        patternPanel.js
                  signalRenderer.js
                  drawingTools.js
        ↑
   app.js (상태 관리 + Worker 오케스트레이션)
        ↑
┌──── Web Worker (analysisWorker.js) ────────────────────────────┐
│  patternEngine.analyze()  → 30+ 패턴 감지 + Wc 가중치          │
│  signalEngine.analyze()   → 16 기본 + 6 복합 신호               │
│  backtester.backtestAll() → N일 수익률 + WLS 회귀 예측          │
│  LinUCB policy (Stage B)  → 10-dim context + 5 actions          │
└────────────────────────────────────────────────────────────────┘
        ↑
┌──── 데이터 소스 ──────────────────────────────────────────────┐
│  OHLCV: data/kospi/*.json + data/kosdaq/*.json (pykrx)        │
│  재무:  data/financials/*.json (DART API, 95% 완료)            │
│  실시간: Kiwoom OCX WebSocket (server/ws_server.py)            │
│  섹터:  data/sector_fundamentals.json (FinanceDataReader)      │
│  RL:   data/backtest/rl_policy.json (LinUCB Stage B)          │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. 폴더 해부도

```
krx-live-chart-remote/
│
├── index.html              진입점 (649줄, 4열 그리드 + 16 defer 스크립트)
├── sw.js                   Service Worker (오프라인 캐싱, v10)
├── CLAUDE.md               프로젝트 지침서
├── GUIDE.md                사용자 가이드
├── DESIGN_V5_SPEC.md       설계 사양
│
├── js/                     ★ 핵심 런타임 (17파일, ~20,000줄)
│   ├── [1] colors.js           KRX_COLORS 상수 (30+색)
│   ├── [2] data.js             PAST_DATA (삼성/SK 하드코딩)
│   ├── [3] api.js              dataService (WS/파일/데모, 3단계 캐시)
│   ├── [4] realtimeProvider.js WebSocket 클라이언트 (Kiwoom)
│   ├── [5] indicators.js       9개 지표 + WLS 회귀 + IndicatorCache
│   ├── [6] patterns.js         PatternEngine (30+ 패턴, ATR 정규화, Wc)
│   ├── [7] signalEngine.js     16 기본 + 6 복합 신호 (3-Tier)
│   ├── [8] chart.js            TradingView LWC v4.2.3 래퍼
│   ├── [9] patternRenderer.js  Canvas2D 패턴 시각화 (9 레이어)
│   ├── [10] signalRenderer.js  Canvas2D 신호 시각화 (듀얼 PaneView)
│   ├── [11] backtester.js      N일 수익률 + WLS Ridge 예측
│   ├── [12] sidebar.js         가상 스크롤 (2700+종목, ~40 DOM)
│   ├── [13] patternPanel.js    패턴 설명 카드 + 학술 메타데이터
│   ├── [14] financials.js      재무지표 + 트렌드 Canvas
│   ├── [15] drawingTools.js    드로잉 오버레이 (7도구) + localStorage
│   ├── [16] app.js             상태 관리 + UI + Worker 오케스트레이션
│   └── analysisWorker.js       Web Worker (병렬 분석, 3초 throttle)
│
├── css/
│   └── style.css           UI 스타일 (3,641줄, 8단계 반응형)
│
├── core_data/              ★ 학술 기초 (17편, 런타임 미사용)
│   ├── 01_mathematics.md       SMA/EMA 필터, 프랙탈, R/S 분석
│   ├── 02_statistics.md        표준편차, RSI, GARCH, WLS 회귀
│   ├── 03_physics.md           경제물리학, 멱법칙, 허스트 지수
│   ├── 04_psychology.md        전망이론, 처분효과, 정보폭포, 공포-탐욕
│   ├── 05_finance_theory.md    EMH, AMH, CAPM, Fama-French
│   ├── 06_technical_analysis.md 다우이론, 엘리엇, 캔들스틱
│   ├── 07_pattern_algorithms.md 스윙포인트, 회귀, ATR 정규화, 베이지안
│   ├── 08_references.md        참고문헌 400+
│   ├── 09_game_theory.md       내쉬 균형, 경매 이론
│   ├── 10_optimal_control.md   칼만 필터, HJB, 머튼
│   ├── 11_reinforcement_learning.md  MDP, Q-learning, PPO
│   ├── 11B_rl_advanced.md      다중 에이전트, MAML, 안전 RL
│   ├── 12_extreme_value_theory.md   GEV/GPD, 블랙 스완
│   ├── 13_information_geometry.md   피셔 정보, KL 발산
│   ├── 14_finance_management.md     켈리, VaR/CVaR, DCF
│   ├── 15_advanced_patterns.md      CNN/LSTM, SHAP, 워크포워드
│   ├── 16_pattern_reference.md      42종 패턴 레퍼런스
│   └── 17_regression_backtesting.md 부트스트랩, 다중가설검정
│
├── pattern_impl/           ★ 이론-코드 브릿지 (5편)
│   ├── 01_theory_pattern_mapping.md  151개 항목 이론-구현 매핑
│   ├── 02_candle_patterns.md         42종 캔들 패턴 상세
│   ├── 03_composite_signals.md       27종 복합 시그널
│   ├── 04_implementation_map.md      JS 파일별 구현 위치
│   └── 05_pipeline_analysis.md       전체 파이프라인 분석
│
├── data/                   ★ 런타임 데이터
│   ├── index.json              마스터 색인 (2,724종목)
│   ├── sector_fundamentals.json 섹터별 기본지표
│   ├── kospi/                  KOSPI OHLCV (~939종목)
│   ├── kosdaq/                 KOSDAQ OHLCV (~1,785종목)
│   ├── financials/             DART 재무제표 (~2,607종목)
│   └── backtest/               분석 산출물
│       ├── results/                종목별 패턴 성능 (2,724개)
│       ├── aggregate_stats.json    통계 요약
│       ├── pattern_performance.json 패턴별 누적 성능
│       ├── mra_coefficients.json   MRA 12열 회귀계수
│       ├── calibrated_constants.json 보정된 상수
│       ├── wc_calibration.json     Wc 가중치 보정
│       ├── rl_policy.json          LinUCB 정책 (Stage B)
│       ├── rl_context.csv          12-dim 컨텍스트 (199K)
│       └── rl_residuals.csv        잔차 분석 (199K)
│
├── scripts/                ★ 개발/분석 자동화
│   ├── download_ohlcv.py       OHLCV 일봉 다운로드 (pykrx)
│   ├── generate_intraday.py    분봉 보간 (Brownian bridge)
│   ├── download_financials.py  DART 재무 다운로드
│   ├── download_sector.py      섹터 기본지표
│   ├── update_index_prices.py  index.json 가격 갱신
│   ├── backtest_all.py         2,724종목 배치 백테스트
│   ├── mra_extended.py         Stage A-1 (12열 Ridge)
│   ├── calibrate_constants.py  136개 상수 감사
│   ├── calibrate_wc.py         Wc 가중치 보정
│   ├── analyze_residuals.py    잔차 분석
│   ├── rl_linucb.py            Stage B (LinUCB 학습)
│   ├── rl_context_features.py  12-dim 컨텍스트 엔지니어링
│   ├── rl_residuals.py         60/20 walk-forward 잔차
│   ├── rl_stage_b.py           Stage B 통합
│   ├── verify.py               5항목 배포 전 검증
│   ├── daily_update.bat        일일 데이터 갱신
│   ├── daily_deploy.bat        갱신 + 배포
│   └── auto_update.bat         시간당 자동 (09:30-16:05)
│
├── server/                 WebSocket 서버 (Kiwoom OCX)
│   ├── ws_server.py            7계층 보안, 2,007줄
│   └── start_server.bat        시작 스크립트
│
├── docs/                   기술/배포 문서
│   ├── roadmap-report.md       기술 로드맵 (Stage A~F)
│   ├── qa_checklist.md         100+ QA 항목
│   ├── developer-setup.md      개발 환경 온보딩
│   ├── competitive-analysis-2026-03.md  경쟁사 분석
│   ├── TABBED_PANEL_DESIGN.md  탭 패널 설계
│   └── (기타 리포트/세션 문서)
│
└── .claude/                Claude Code 에이전트 시스템
    ├── rules/                  아키텍처 규칙 (7파일)
    ├── agents/                 전문 에이전트 정의 (7종)
    ├── agent-memory/           세션별 에이전트 메모리 (105+)
    └── settings.json           세션 설정
```

---

## 4. 데이터 흐름 파이프라인

### 4.1 원시 데이터에서 차트 예측까지

```
[Layer 0: 외부 소스]
  pykrx (OHLCV) ──┐
  DART API (재무) ──┤→ Python scripts → JSON 파일
  Kiwoom OCX (실시간)──┤
  FDR (섹터) ─────┘

[Layer 1: 데이터 서비스]
  api.js dataService
    ├─ L1 메모리 캐시
    ├─ L2 IndexedDB
    └─ L3 네트워크 fetch

[Layer 2: 지표 계산] indicators.js
  candles → calcMA, calcEMA, calcBB, calcRSI, calcATR,
            calcMACD, calcIchimoku, calcKalman, calcHurst
            → IndicatorCache (lazy-eval)

[Layer 3: 패턴 감지] patterns.js
  candles + indicators →
    21 캔들 패턴 (해머, 도지, 장악형, 적삼병 ...)
    9 차트 패턴 (삼각형, 쐐기, 머리어깨 ...)
    S/R 감지 (ATR 클러스터링)
    → Wc 가중치 주입 (hw × mw)

[Layer 4: 신호 합성] signalEngine.js
  patterns + indicators →
    16 기본 신호 (MA교차, MACD, RSI, BB, Ichimoku, Hurst, 거래량)
    6 복합 신호 (Tier 1/2/3, 5-bar 윈도우)

[Layer 5: 백테스트 예측] backtester.js
  patterns + candles →
    N일(1,3,5,10,20) 수익률 통계
    WLS Ridge 회귀 (12 특성, lambda=2.0)
    → 적응형 가중치 (learnedWeights)

[Layer 6: RL 보정] app.js + rl_policy.json
  MRA 예측 + LinUCB(10-dim context, 5 actions)
  → 최종 신뢰도 조정

[Layer 7: 렌더링]
  chart.js → TradingView LWC 캔들/라인
  patternRenderer.js → 9레이어 Canvas2D 패턴 오버레이
  signalRenderer.js → 다이아몬드/별/밴드/다이버전스
  patternPanel.js → 패턴 설명 카드
  financials.js → 재무지표 + 트렌드 차트
```

### 4.2 학술 근거 매핑 (이론 → 코드)

```
[물리학] core_data/03               [수학] core_data/01
  Hurst H, 멱법칙                      SMA/EMA 필터, R/S 분석
  └→ calcHurst()                       └→ calcMA(), calcEMA()
  └→ hw = clamp(2*H, 0.6, 1.4)        └→ calcBB(), calcMACD()

[통계학] core_data/02               [심리학] core_data/04
  WLS, GARCH, HC3 SE                   전망이론 (lambda=2.25)
  └→ calcWLSRegression()               정보폭포, 처분효과
  └→ Ridge lambda=2.0                  └→ 패턴 심리 해석 (patternPanel)
  └→ Stage A-1 IC 0.099               └→ 지지/저항 (닻 효과)
                                        └→ R:R 비율 (손실회피)

[금융이론] core_data/05,06          [RL 이론] core_data/11,11B
  AMH, 다우이론, 기술분석               LinUCB (Li et al. 2010)
  └→ 적응형 Wc 시스템                  └→ Stage B LinUCB
  └→ 26종 패턴 근거                    └→ 10-dim context
                                        └→ Mean IC 0.325

[최적제어] core_data/10             [극단값] core_data/12
  칼만 필터, HJB                       GEV/GPD, 블랙 스완
  └→ calcKalman()                      └→ (미구현, Stage C 후보)
```

---

## 5. Wc 가중치 시스템 (핵심)

### 5.1 현재 공식

```
hw = clamp(2 * H_shrunk, 0.6, 1.4)      허스트 지수 (추세 지속성)
mw = clamp(exp(-0.1386 * excess), 0.6, 1.0)  평균회귀 보정

Wc_buy  = hw * mw                       [0.36 ~ 1.4]
Wc_sell = (2 - hw) * mw                 [sell시 hw 반전]
```

### 5.2 Stage 진행 현황

| Stage | 알고리즘 | IC | 상태 |
|-------|---------|------|------|
| A-1 | 12열 Ridge (walk-forward) | 0.099 | 완료 |
| B | LinUCB 5-action (directional reward) | **0.325** | 완료 |
| C | Full RL (DQN/PPO) | 목표 0.40+ | 미시작 |

### 5.3 상수 감사 5등급

| 등급 | 수 | 설명 | 예시 |
|------|-----|------|------|
| A (Academic Anchor) | 8 | 이론 불변 | H=0.5, lambda=2.25 |
| B (Academic Range) | 7 | 학술 범위 | ATR CAP, clamp 경계 |
| C (Calibratable) | 8 | WLS 교정 가능 | Ridge lambda, conf_L |
| D (Data-Learnable) | 5 | 학습 필요 | 0.1386, sell hw |
| E (Deprecated) | 2 | 폐기 | vw, rw (IC 음수) |

---

## 6. UI 4영역 해부

### 6.1 A열: 사이드바 (sidebar.js, 1,703줄)

```
┌─ 사이드바 (260px, 접이식) ──────┐
│ [검색창]                          │
│ [정렬: 시총/등락/패턴/이름]       │
│ [필터: 업종 16개 + 패턴 감지]     │
│ [뷰: 기본/분석]                   │
│ ┌─ 최근 본 종목 (최대 5) ──────┐│
│ │ Samsung 005930  +2.3%        ││
│ └──────────────────────────────┘│
│ ┌─ 종목 목록 (가상 스크롤) ────┐│
│ │ SK하이닉스 000660  -1.2%     ││
│ │ NAVER 035420     +0.8%       ││
│ │ ... (2700+ 종목, 40 DOM)     ││
│ │ [스파크라인] [RSI] [패턴명]   ││
│ └──────────────────────────────┘│
└──────────────────────────────────┘
```

- 가상 스크롤: ITEM_H=42px, BUFFER=5
- 3가지 정렬 + 업종 필터 + 패턴 필터
- IntersectionObserver 스파크라인 지연 로드

### 6.2 B열: 차트 (chart.js 1,778줄 + app.js 3,664줄)

```
┌─ 차트 영역 (flex:1) ────────────────────────┐
│ [종목헤더: 이름/코드/마켓/현재가/등락률]        │
│ [툴바: 타임프레임/차트타입/지표/시각화토글]      │
│ ┌─ 차트 래퍼 ─────────────────────────────┐  │
│ │[드로잉]  ┌─ 메인 차트 (LWC) ──────────┐│  │
│ │[도구]    │ 캔들/라인/바/Heikin-Ashi    ││  │
│ │[7종]     │ + MA/EMA/BB/Ichimoku        ││  │
│ │          │ + 9레이어 패턴 오버레이       ││  │
│ │          │ + 신호 마커 (다이아몬드/별)   ││  │
│ │          │ + 드로잉 오버레이             ││  │
│ │          │ + 사용자 드로잉 (localStorage)││  │
│ │          └─────────────────────────────┘│  │
│ │          ┌─ 서브차트 (6종 택1) ────────┐│  │
│ │          │ RSI / MACD / Stoch / CCI    ││  │
│ │          │ ADX / Williams %R           ││  │
│ │          └─────────────────────────────┘│  │
│ └──────────────────────────────────────────┘  │
│ [패턴 요약 바: 감지된 패턴 수 + 신뢰도]        │
│ [수익률 통계: 1/3/5/10/20일 회귀 결과]         │
└───────────────────────────────────────────────┘
```

**9 Draw Layers** (patternRenderer.js):
1. Glows (캔들 수직 stripe)
2. Brackets (다중 캔들 rounded rect)
3. TrendAreas (삼각형/쐐기 그라데이션)
4. Polylines (W/M/네크라인)
5. HLines (S/R, 손절/목표 수평선)
6. Connectors (H&S 어깨 연결)
7. Labels (HTS 스타일 pill badge)
8. ForecastZones (목표/손절 그라데이션 + R:R)
9. ExtendedLines (오프화면 구조선)

### 6.3 C열: 패턴 설명 (patternPanel.js, 1,166줄)

```
┌─ 패턴 분석 (240px) ────────────┐
│ "기술적 패턴 분석"                │
│                                  │
│ ┌─ 패턴 카드 (최대 3개) ──────┐ │
│ │ [해머] ■■■■■■■□ 72%         │ │
│ │ 분류: 단일 캔들 | 강세         │ │
│ │ ┌─ 미니 다이어그램 ───────┐ │ │
│ │ │  (Canvas 70px 높이)     │ │ │
│ │ └─────────────────────────┘ │ │
│ │ 설명: 하락 추세에서 긴 아래...│ │
│ │                              │ │
│ │ ┌─ 시장 심리 ─────────────┐ │ │
│ │ │ "강력한 매수 신호로..."   │ │ │
│ │ └─────────────────────────┘ │ │
│ │                              │ │
│ │ 손절: 52,300 | 목표: 56,800  │ │
│ │ 승률: 68% | 기대: +2.3%      │ │
│ │ 95% CI: [+0.8%, +3.8%]      │ │
│ └──────────────────────────────┘ │
│                                  │
│ (패턴 없을 시: "감지된 패턴 없음") │
└──────────────────────────────────┘
```

- PATTERN_ACADEMIC_META: 30+ 패턴별 한국어명, 학술 설명, 심리 해석
- 비전공자를 위한 평문 설명 + 핵심 수치

### 6.4 D열: 재무지표 (financials.js, 1,932줄)

```
┌─ 재무지표 (380px) ──────────────┐
│ "주요재무지표" [DART]              │
│ 기준: 2024년 3분기 (연결기준)      │
│                                   │
│ ── 주요손익 지표 ───────────────  │
│ 매출액     12.3조  (YoY +5.2%)    │
│ 영업이익    2.1조  (YoY -3.1%)    │
│ 순이익      1.8조  (YoY +1.5%)    │
│                                   │
│ ── 수익성 ──────────────────────  │
│ ┌─────────┬─────────┐            │
│ │영업이익률│  ROE    │            │
│ │ 17.1%   │ 12.3%   │            │
│ ├─────────┼─────────┤            │
│ │  EPS    │  BPS    │            │
│ │ 4,230원 │35,200원 │            │
│ └─────────┴─────────┘            │
│                                   │
│ ── 밸류에이션 ──────────────────  │
│ ┌─────────┬─────────┐            │
│ │  PER    │  PBR    │            │
│ │ 12.3배  │  1.52배 │            │
│ ├─────────┼─────────┤            │
│ │  PSR    │  ROA    │            │
│ │  2.1배  │  8.7%   │            │
│ └─────────┴─────────┘            │
│                                   │
│ ── 재무 추이 (Canvas 차트) ────  │
│ │  ■ ■   ■ ■                     │
│ │■ ■ ■ ■ ■ ■                     │
│ │Q1 Q2 Q3 Q4 Q1 Q2               │
│ [매출] [이익률] [ROE] [기간]       │
│                                   │
│ ── 업종 비교 ──────────────────  │
│ 동종업계 PER 평균: 15.2배          │
│ 현재 PER 12.3배 → 저평가           │
└───────────────────────────────────┘
```

- 3단계 신뢰: DART(실데이터) > 하드코딩(삼성/SK) > 시드("—" 표시)
- 단위 자동 변환: 원 → 억원 → 조원

---

## 7. 학술 파이프라인 (이론 → 코드)

### 7.1 계층 구조

```
Layer 0: 학문 분야 (core_data/ 17편)
  ├─ 수학/통계 (01, 02) → 필터 이론, 회귀, 시계열
  ├─ 물리학 (03) → 프랙탈, 멱법칙, 허스트
  ├─ 심리학 (04) → 전망이론, 처분효과, 공포/탐욕
  ├─ 금융이론 (05, 06) → EMH, AMH, 다우이론, 기술분석
  ├─ 알고리즘 (07) → 패턴 탐지, ATR 정규화, 품질점수
  ├─ 고급이론 (09~14) → 게임, 칼만, RL, 극단값, 정보기하
  └─ 백테스트 (15~17) → ML, 워크포워드, 회귀검증

Layer 1: 이론-구현 브릿지 (pattern_impl/ 5편)
  ├─ 151개 항목 이론-코드 매핑
  ├─ 42종 캔들 패턴 수학 정의
  ├─ 27종 복합 시그널 설계
  └─ JS 구현 위치 맵

Layer 2: JS 코드 (indicators.js + patterns.js + signalEngine.js)
  ├─ 9 지표 함수 (학술 출처 추적 가능)
  ├─ 30+ 패턴 (42종 중 26종 구현, 62%)
  └─ 22 신호 (16 기본 + 6 복합)

Layer 3: 최적화 (scripts/ Stage A~B)
  ├─ MRA 12열 Ridge 회귀 (IC 0.099)
  ├─ LinUCB 10-dim 5-action (IC 0.325)
  └─ 136개 상수 5등급 감사
```

### 7.2 지표별 학술 출처

| 지표 | 함수 | 학술 근거 | core_data |
|------|------|----------|-----------|
| 이동평균 | calcMA() | FIR 필터 | 01 S3.1 |
| 지수이동평균 | calcEMA() | IIR 필터 | 01 S3.2 |
| 볼린저밴드 | calcBB() | CLT, 표준편차 | 02 S1.1 |
| RSI | calcRSI() | Wilder 1978 | 02 S3.1 |
| ATR | calcATR() | True Range | 06 S3 |
| MACD | calcMACD() | EMA 차분 | 01 S3.2, 06 S3 |
| 일목균형표 | calcIchimoku() | 호소다 고이치 | 06 S7 |
| 칼만 필터 | calcKalman() | 최적 필터링 | 10 S3.1 |
| 허스트 지수 | calcHurst() | R/S 분석, 프랙탈 | 01 S5.2, 03 S3 |
| WLS 회귀 | calcWLSRegression() | HC3 견고 SE | 02 S4, 17 |

### 7.3 심리학적 패턴 해석

| 패턴 | 심리 메커니즘 | 이론 근거 |
|------|-------------|----------|
| 해머 | 극한 공포 → 매수 회복 | 04 S4.1 (처분효과) |
| 도지 | 불확실성, 의사결정 마비 | 04 S2 (인지편향) |
| 적삼병 | 정보 폭포 (매수 연쇄) | 04 S3.1 |
| 지지선 | 닻 효과 + 처분효과 | 04 S2.2, S1.3 |
| RSI 과매도 | 절망 단계 (공포-탐욕 사이클) | 04 S4.1 |

---

## 8. 반응형 디자인 (8단계)

| 브레이크포인트 | 레이아웃 변화 |
|-------------|------------|
| >2000px | 대형: sidebar 240, rpanel 420, pattern 300 |
| <=1440px | rpanel 340, pattern 220 |
| <=1366px | sidebar 220, rpanel 300 |
| **<=1200px** | **C+D 통합 탭**, C열 숨김 |
| **<=1024px** | **사이드바 → 드로어** (slide-in) |
| **<=768px** | **단일 열**, D → 바텀시트 |
| <=480px | 초소형: ticker 숨김, 전폭 검색 |

---

## 9. 캐싱 전략 (3단계)

| 레벨 | 위치 | 키 | 용도 |
|------|------|-----|------|
| L1 | IndicatorCache (메모리) | length+date | 지표 lazy-eval (함수 저장) |
| L2 | chart.js _indicatorCache | length+time+close | 동일 차트 재분석 방지 |
| L3 | Worker _analyzeCache | candle fingerprint | drag/scroll 중복 방지 |

---

## 10. 배포 & 운영

### 10.1 일일 운영 플로우

```
[평일 09:30-16:05, 매시]
auto_update.bat
  → download_ohlcv.py (pykrx)
  → generate_intraday.py (분봉)
  → update_index_prices.py (index.json)
  → wrangler pages deploy (Cloudflare)
```

### 10.2 검증

```bash
python scripts/verify.py --strict   # 5항목: colors/patterns/dashes/globals/scripts
```

### 10.3 런타임 확인 (F12 Console)

```
[KRX] index.json 로드 완료: N종목        ← 데이터 초기화
[Worker] 분석 Worker 초기화 완료          ← Worker 준비
Toast "N개 패턴 감지됨"                  ← 파이프라인 정상
```

---

## 11. 프로젝트 현황 (2026-03-25)

### 완료

- 26종 패턴 감지 (42종 기준 62%)
- 16+6종 신호 합성 (3-Tier)
- Stage A-1: 12열 Ridge MRA (IC 0.099)
- Stage B: LinUCB 10-dim (IC 0.325, t-stat 3.28)
- DART 재무 95% (2,607/2,724종목)
- 8단계 반응형 UI
- 136개 상수 5등급 감사

### 다음 우선순위 (정직한 B+ 4건)

1. HC3 tStats를 패턴 패널에 반영
2. Forecast Zone 도달 확률 % 표시
3. 넥라인 돌파 확인 구현
4. OOS IC를 CI와 함께 표시

### 미래 로드맵

- Stage C: Full RL (DQN/PPO, kurtosis 73.5 비선형성 대응)
- Koscom 전환: 상업 서비스용 실시간 데이터
- 하모닉/엘리엇 패턴 추가
- 극단값 모델링 (GEV/GPD)
