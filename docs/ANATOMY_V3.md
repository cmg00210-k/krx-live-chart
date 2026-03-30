# CheeseStock Project Anatomy v3

> 작성일: 2026-03-26 | 대상: 사용자-Claude 소통용 전체 해부도
> v2 (2026-03-25) 대비 변경: Phase E~H 반영, 39패턴/34신호/20지표 정밀 인벤토리, core_data 갭 매트릭스, rl_policy 스키마

---

## 1. 프로젝트 정체성

| 항목 | 내용 |
|------|------|
| 이름 | CheeseStock (치즈스톡) |
| 도메인 | cheesestock.co.kr / cheesestock.pages.dev |
| 대상 시장 | KRX (KOSPI 939 + KOSDAQ 1,785 = 2,724종목) |
| 핵심 기능 | **39종 패턴** 기술적 분석 + WLS Ridge 예측 + BH-FDR + Platt + LinUCB |
| 기술 스택 | Vanilla JS (번들러 없음, 22,748줄) + Python 분석 파이프라인 |
| 배포 | Cloudflare Pages (wrangler) |
| 실시간 | Kiwoom OCX WebSocket (개인용) |
| 학술 인용 | 42건, 26명 저자 (Nison, Bulkowski, Wilder, Murphy 등) |

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
│  patternEngine.analyze()  → 39종 패턴 감지 + Wc 가중치          │
│  signalEngine.analyze()   → 34 기본 + 18 복합 신호              │
│  backtester.backtestAll() → N일 수익률 + WLS Ridge + BH-FDR    │
│  LinUCB policy            → 7-dim context + 5 actions (gated)  │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. 폴더 해부도

```
krx-live-chart-remote/
│
├── index.html              진입점 (16 defer 스크립트)
├── sw.js                   Service Worker (see line 8 for CACHE_NAME)
├── CLAUDE.md               프로젝트 지침서
│
├── js/                     ★ 핵심 런타임 (17파일, 22,748줄)
│   ├── [1]  colors.js           84줄   KRX_COLORS 상수 (30+색)
│   ├── [2]  data.js            206줄   PAST_DATA (삼성/SK 하드코딩)
│   ├── [3]  api.js             843줄   dataService (ws/file/demo, 3단계 캐시)
│   ├── [4]  realtimeProvider   423줄   WebSocket 클라이언트 (Kiwoom)
│   ├── [5]  indicators.js    1,091줄   20개 지표 함수 + IndicatorCache
│   ├── [6]  patterns.js     2,873줄   PatternEngine (39종, ATR 정규화, Wc)
│   ├── [7]  signalEngine.js  1,667줄   34 기본 + 18 복합 신호 (3-Tier)
│   ├── [8]  chart.js         1,778줄   TradingView LWC v5.1.0 래퍼
│   ├── [9]  patternRenderer  1,893줄   Canvas2D 패턴 시각화 (9 레이어)
│   ├── [10] signalRenderer     598줄   Canvas2D 신호 시각화 (듀얼 PaneView)
│   ├── [11] backtester.js      934줄   WLS Ridge + BH-FDR + LinUCB
│   ├── [12] sidebar.js       1,703줄   가상 스크롤 (2700+종목, ~40 DOM)
│   ├── [13] patternPanel.js  1,471줄   패턴 설명 카드 + 학술 메타데이터
│   ├── [14] financials.js    1,945줄   재무지표 + 트렌드 Canvas
│   ├── [15] drawingTools.js  1,308줄   드로잉 오버레이 (7도구) + localStorage
│   ├── [16] app.js           3,679줄   상태 관리 + UI + Worker 오케스트레이션
│   └── analysisWorker.js       252줄   Web Worker (병렬 분석, 3초 throttle)
│
├── css/style.css          3,739줄   UI 스타일 (8단계 반응형)
│
├── core_data/             ★ 학술 기초 (17편+README, 런타임 미사용)
│   ├── 01~17_*.md             수학/통계/물리/심리/금융/TA/알고리즘/RL/EVT/정보기하
│   └── README.md              10단계 학습 경로
│
├── pattern_impl/          ★ 이론-코드 브릿지 (5편+README)
│   ├── 01_theory_pattern_mapping.md   151개 항목 이론-구현 매핑
│   └── 02~05_*.md                     42종 패턴/27종 신호/구현맵/파이프라인
│
├── data/                  ★ 런타임 데이터
│   ├── index.json              마스터 색인 (2,724종목)
│   ├── kospi/                  KOSPI OHLCV (6,741 JSON)
│   ├── kosdaq/                 KOSDAQ OHLCV (8,745 JSON)
│   ├── financials/             DART 재무제표 (2,736 JSON)
│   └── backtest/
│       └── rl_policy.json      LinUCB + WR + Platt + isotonic + sigmoid
│
├── scripts/               ★ 자동화 (22 Python + 8 Batch)
│   ├── download_*.py          OHLCV/재무/섹터 다운로드
│   ├── generate_intraday.py   분봉 보간 (Brownian bridge)
│   ├── mra_*.py / rl_*.py     Ridge MRA + LinUCB 학습
│   ├── calibrate_*.py         상수/Wc/복합신호 교정
│   ├── update_win_rates.py    Beta-Binomial 사후분포 갱신
│   └── verify.py              5항목 배포 전 검증
│
└── .claude/               Claude Code 에이전트 시스템
    ├── rules/ (7파일)         아키텍처/색상/렌더링/패턴/재무/스크립트/UI 규칙
    └── agents/ (8파일)        전문 에이전트 정의
```

---

## 4. 데이터 흐름 파이프라인

### 4.1 Layer 0 → 7 전체 흐름

```
[Layer 0: 외부 소스]
  pykrx         OHLCV 일봉 ──────────────────────┐
  DART API      재무제표 (연/반기, CFS우선) ───────┤→ JSON 파일
  Kiwoom OCX    실시간 체결 (WebSocket) ──────────┤
  FDR           섹터 기본지표 ───────────────────┘

[Layer 1: 데이터 서비스]  api.js — dataService
  ├─ L1 메모리 캐시   (Map, process 수명)
  ├─ L2 IndexedDB    _idb (krx_cache, key="code-tf")
  └─ L3 네트워크     fetch data/{market}/{code}[_{tf}].json

[Layer 2: 지표 계산]  indicators.js  (20 함수 + IndicatorCache)
  기본: calcMA, calcEMA, calcBB, calcMACD, calcMomentum
  오실레이터: calcRSI, calcStochastic, calcStochRSI, calcCCI, calcWilliamsR, calcADX
  변동성/구조: calcATR, calcIchimoku, calcKalman, calcAwesomeOscillator
  고급: calcHurst, calcHillEstimator, calcWLSRegression, calcOLSTrend, _invertMatrix

[Layer 3: 패턴 감지]  patterns.js — 35 detect 메서드 → 39 type keys
  캔들 29종 (단일 14 + 이중 8 + 삼중 7)
  차트 10종 (삼각형 3 + 쐐기 2 + 이중 2 + H&S 2 + 채널 1)
  S/R (ATR×0.5 클러스터링, 최대 10)
  승률: LIVE(Beta-Binomial) > SHRUNK(James-Stein N0=35) > RAW(5년 545K건)

[Layer 4: 신호 합성]  signalEngine.js
  기본 34종 (26 타입 + 8 다이버전스)
  복합 18종 (Tier 1: 8, Tier 2: 8, Tier 3: 2)
  필터: ADX isotonic + CCI isotonic + OLS trend + 누적 ±15 + entropy sqrt

[Layer 5: 백테스트 예측]  backtester.js
  WLS Ridge (5열, λ=2.0, decay=0.995)
  BH-FDR (q=0.05, 39패턴×5기간=195 검정)
  Walk-Forward (4-fold expanding, purge=2×horizon)
  비용: KRX_COST=0.31%/√h (Kyle 1985)

[Layer 6: RL 보정]  rl_policy.json
  LinUCB (7-dim, 5 actions) — t_stat_delta < 2.0 → 현재 비활성
  Platt scaling (18 복합, A=4.0 B=-2.0 초기값)
  ADX/CCI isotonic breakpoints
  Sigmoid R:R Bayesian (max_pen=15, k=8, rr_mid=2.375)
  Composite windows (per-signal 4~7봉)

[Layer 7: 렌더링]
  patternRenderer: 9 레이어 (glows→brackets→trendAreas→polylines→hlines→connectors→labels→forecast→extended)
  signalRenderer: 듀얼 PaneView (bottom: 밴드 / top: 다이아몬드, 별, 다이버전스)
```

### 4.2 학술 인용 인벤토리 (42건, 26명 저자)

| 저자 | 연도 | 인용 수 | 주요 파일 | 카테고리 |
|------|------|--------|----------|---------|
| Bulkowski | 2005-12 | 10 | patterns.js | 패턴 통계, 승률 |
| Nison | 1991 | 8 | patterns.js | 캔들스틱 이론 |
| Wilder | 1978 | 4 | signalEngine.js | RSI, ADX |
| Murphy | 1999 | 4 | patterns.js, patternPanel | 추세, 채널 |
| Lambert | 1980 | 4 | signalEngine.js | CCI 레짐 |
| Edwards & Magee | 2018 | 4 | patterns.js | 돌파, 넥라인 |
| Bailey & LdP | 2014 | 3 | backtester.js | Walk-Forward |
| Hill | 1975 | 3 | indicators.js, patterns.js | 극단값 테일 |
| Morris | 2006 | 3 | patterns.js | 캔들 기준 |
| BH | 1995 | 2 | backtester.js | FDR 다중비교 |
| Shannon | 1948 | 2 | signalEngine.js | 엔트로피 |
| Kalman | 1960 | 1 | signalEngine.js | 필터링 |
| Platt | 1999 | 1 | signalEngine.js | 시그모이드 |
| Efron & Morris | 1975 | 1 | patterns.js | James-Stein |
| Barlow et al. | 1972 | 1 | signalEngine.js | isotonic 회귀 |

**core_data 직접 참조**: 12_extreme_value_theory (3회), 13_information_geometry (1회)

---

## 5. Wc 가중치 시스템

### 5.1 8단계 파이프라인

```
[1] OHLCV → [2] ATR_14/50, MA_50, Hurst → [3] hw, vw, mw, rw + Hill cap
→ [4] 39종 패턴 + Dual Confidence + R:R sigmoid
→ [5] WLS Ridge (5열, λ=2.0)
→ [6] LinUCB 7-dim (gated)
→ [7] BH-FDR (q=0.05)
→ [8] ADX/CCI isotonic + OLS + entropy
```

### 5.2 가중치 공식

```
hw = clamp(2 × H_shrunk, 0.6, 1.4)            허스트 (Efron & Morris 1975)
vw = clamp(1/√(ATR14/ATR50), 0.7, 1.4)        변동성 (E등급, 비활성)
mw = clamp(exp(-0.1386 × excess), 0.6, 1.0)   평균회귀 (OU 반감기 5)
rw = clamp(1 - D_J×0.15, 0.7, 1.0)            레짐 (Jeffrey 발산)

Wc_buy  = hw × mw            [0.36 ~ 1.4]
Wc_sell = (2 - hw) × mw      [sell시 hw 반전]
```

### 5.3 Phase IC 체인

| Phase | 날짜 | 내용 | IC Delta | 누적 |
|-------|------|------|----------|------|
| A-1 | 03-24 | 12열 Ridge MRA | baseline | 0.054-0.066 |
| B | 03-24 | LinUCB 7-dim | (training 0.325, OOS gated) | — |
| 8 (정직 기준) | 03-25 | P0 5건 수정, 정직 메트릭 | **baseline** | **0.054-0.066** |
| Phase B | 03-26 | 넥라인/삼각형 돌파 확인 | +0.016-0.035 | 0.070-0.101 |
| Phase C | 03-26 | StochRSI + ADX + H&S + Bayesian WR | +0.030-0.080 | 0.100-0.181 |
| Phase D | 03-26 | ATR split + DualConf + 5종 패턴(7키) | +0.030-0.060 | 0.130-0.241 |
| Phase E | 03-26 | 12 복합신호 + Kalman + CCI | +0.038-0.082 | 0.168-0.343 |
| Phase F/F+ | 03-26 | WIN_RATES + 채널 + Hill/OLS/엔트로피 + WF | +0.052 | 0.220-0.405 |
| Phase G | 03-26 | BH-FDR + Beta-Binomial + Platt | +0.030-0.060 | 0.250-0.465 |
| **Phase H** | **03-26** | **5년 교정, N0=35, 신뢰도 캡, R:R 시그모이드** | +est | **0.280-0.500** |

**주의**: IC 범위는 공학적 추정이며, Walk-Forward 검증 기준은 Phase 8의 0.054-0.066.

### 5.4 rl_policy.json 스키마 (9개 섹션)

| 섹션 | 내용 | 크기 |
|------|------|------|
| `thetas` | LinUCB 가중치 행렬 [5×8] | 5 actions × (bias + 7 context) |
| `normalization` | z-score 파라미터 (ewma_vol, raw_hurst, pred_std) | 5 entries |
| `win_rates_live` | Beta-Binomial 사후 파라미터 (alpha, beta) | 39 patterns |
| `platt_params` | Platt sigmoid [A, B] per composite | 18 composites |
| `adx_isotonic` | ADX breakpoints [[val, adj], ...] | 7 points |
| `cci_isotonic` | CCI breakpoints [[val, adj], ...] | 6 points |
| `rr_bayesian` | Sigmoid params {max_pen, k, rr_mid} | 3 params |
| `composite_windows` | Per-signal window override | 18 entries |

---

## 6. UI 4영역 해부

(V2와 동일 — §6.1 사이드바, §6.2 차트 9레이어, §6.3 패턴 카드, §6.4 재무지표)

---

## 7. 학술 파이프라인 (이론 → 코드)

### 7.1 지표 인벤토리 (20 함수)

| # | 함수 | 학술 근거 | core_data |
|---|------|----------|-----------|
| 1 | calcMA | SMA (교과서) | 06 §2 |
| 2 | calcEMA | IIR 필터, SMA seed | 06 §2 |
| 3 | calcBB | Bollinger (1992) ±2σ | 06 §3 |
| 4 | calcRSI | Wilder (1978) | 06 §4 |
| 5 | calcATR | Wilder (1978) True Range | 06 §4 |
| 6 | calcIchimoku | Hosoda (1969) 5선 | 06 §6 |
| 7 | calcKalman | Kalman (1960), 적응 Q: Mehra (1970) | 10 §3 |
| 8 | calcHurst | Hurst (1951) R/S 분석 | 03 §6 |
| 9 | calcHillEstimator | Hill (1975) 테일 지수 | 12 §4.3 |
| 10 | calcWLSRegression | Reschenhofer (2021) + Ridge | 17 §2 |
| 11 | calcOLSTrend | Lo & MacKinlay (1999) | 02 §3 |
| 12 | calcMACD | Appel (1979) EMA 차분 | 06 §5 |
| 13 | calcStochastic | Lane (1984) %K/%D | 06 §4 |
| 14 | calcStochRSI | Chande & Kroll (1994) | 06 §4 |
| 15 | calcCCI | Lambert (1980) | 06 §4 |
| 16 | calcADX | Wilder (1978) ADX/DI | 06 §4 |
| 17 | calcWilliamsR | Williams (1979) | 06 §4 |
| 18 | calcMomentum | Murphy (1999) raw | 06 §2 |
| 19 | calcAwesomeOscillator | Williams (1995) | 06 §5 |
| 20 | _invertMatrix | Gauss-Jordan (수치해석) | 01 §2 |

**유휴 지표** (3종): calcWilliamsR, calcMomentum, calcAwesomeOscillator — 차트 오버레이용, signalEngine 미소비.

### 7.2 패턴 인벤토리 (35 메서드 → 39 type keys)

**캔들 (24 메서드 → 29 keys)**:
- 단일 11 → 14 keys: doji, hammer, invertedHammer, hangingMan, shootingStar, dragonflyDoji, gravestoneDoji, bullish/bearishMarubozu, spinningTop, longLeggedDoji, bullish/bearishBeltHold
- 이중 6 → 8 keys: bullish/bearishEngulfing, bullish/bearishHarami, piercingLine, darkCloud, tweezerBottom, tweezerTop
- 삼중 7 → 7 keys: threeWhiteSoldiers, threeBlackCrows, morningStar, eveningStar, threeInsideUp, threeInsideDown, abandonedBabyBullish/Bearish

**차트 (10 메서드 → 10 keys)**: doubleBottom, doubleTop, headAndShoulders, inverseH&S, ascending/descending/symmetricTriangle, rising/fallingWedge, channel

**S/R**: ATR×0.5 클러스터링, 최소 2터치, 최대 10

### 7.3 신호 인벤토리

**기본 34종** (26 타입 + 8 다이버전스):
MA교차(4) + MACD(2) + RSI(4) + BB(3) + 거래량(3) + 일목(4) + Hurst(2) + StochRSI(2) + Kalman(2) + MACD 발산(4) + RSI 발산(4)

**복합 18종**: Tier 1(8), Tier 2(8), Tier 3(2) — COMPOSITE_SIGNAL_DEFS

**필터 5종**: ADX isotonic, CCI isotonic, OLS trend, 누적 cap ±15, entropy sqrt decay

### 7.4 core_data ↔ JS 갭 매트릭스

| # | core_data | 구현율 | 핵심 미구현 | 추천 에이전트 | IC |
|---|-----------|--------|-----------|------------|-----|
| 01 | mathematics | 40% | Fourier/Wavelet, Chaos | quantitative | +0.01-0.03 |
| 02 | statistics | 65% | ARIMA, GARCH, Bootstrap | quantitative | +0.02-0.05 |
| 03 | physics | 35% | Ising herding, power-law fitting | quantitative | +0.01-0.02 |
| 04 | psychology | 25% | 명시적 utility function | behavioral | +0.005-0.015 |
| 05 | finance_theory | 45% | CAPM beta, Black-Scholes IV | financial-theory | +0.01-0.03 |
| 06 | technical_analysis | **75%** | Elliott Wave auto-detect | technical-pattern | +0.02-0.04 |
| 07 | pattern_algorithms | **70%** | Harmonic(Gartley/Butterfly), Markov | technical-pattern | +0.03-0.06 |
| 09 | game_theory | 5% | Nash, 경매, crowding 모델 | quantitative | +0.005-0.02 |
| 10 | optimal_control | 20% | HJB, Merton, 최적 실행 | quantitative | +0.01-0.03 |
| 11 | reinforcement_learning | 30% | DQN/PPO (Stage C) | rl-engineer | +0.03-0.08 |
| 11B | rl_advanced | 0% | MAML, 안전 RL, 다중 에이전트 | rl-engineer | +0.02-0.05 |
| 12 | extreme_value_theory | 30% | GEV/GPD, VaR/CVaR | quantitative | +0.01-0.03 |
| 13 | information_geometry | 20% | Fisher 행렬, 자연경사 | quantitative | +0.01-0.02 |
| 14 | finance_management | 50% | Kelly exact, DCF, WACC | financial-systems | +0.01-0.02 |
| 15 | advanced_patterns | 25% | CNN/LSTM (TF.js) | ml-engineer | +0.05-0.15 |
| 16 | pattern_reference | **85%** | 잔여 9종 (cup&handle 등) | technical-pattern | +0.01-0.02 |
| 17 | regression_backtesting | **90%** | Bootstrap CI, 치환 검정 | quantitative | +0.005-0.01 |

**전체 구현율**: ~55% (V2 작성 시 ~42%)

---

## 8. 반응형 디자인 (8단계)

(V2와 동일)

---

## 9. 캐싱 전략 (3단계)

| 레벨 | 위치 | 키 | 용도 |
|------|------|-----|------|
| L1 | IndicatorCache (메모리) | length+date | 지표 lazy-eval |
| L2 | chart.js _indicatorCache | length+time+close | 동일 차트 재분석 방지 |
| L3 | Worker _analyzeCache | candle fingerprint | drag/scroll 중복 방지 |

---

## 10. 배포 & 운영

(V2와 동일 — auto_update.bat 시간당, verify.py --strict)

---

## 11. 현재 상태 (2026-03-26)

### 11.1 버전 매트릭스

Current `?v=N` values: see `index.html` lines 633-648 and `js/analysisWorker.js` lines 57-61.
SW `CACHE_NAME`: see `sw.js` line 8.
These are the single sources of truth -- do not duplicate version numbers here.

### 11.2 기능 카운트

| 카테고리 | 수 |
|----------|---:|
| 캔들 패턴 | 29 |
| 차트 패턴 | 10 |
| **전체 패턴** | **39** |
| 기본 신호 | 34 |
| 복합 신호 | 18 |
| 지표 함수 | 20 |
| rl_policy 섹션 | 9 |
| 학술 인용 | 42 |

### 11.3 교차 파일 정합성

verify.py --strict: **ALL CHECKS PASSED**
- 39 CANONICAL_PATTERNS 7개 등록 위치 전부 일치
- 18 COMPOSITE_SIGNAL_DEFS ID = platt_params = composite_windows
- index.html ?v= = Worker importScripts ?v= (5/5)

---

## 12. Phase A~H 변경 이력

| Phase | 커밋 | 핵심 변경 | 학술 근거 |
|-------|------|----------|----------|
| A-1 | 4ac2cd5 | 12열 Ridge MRA | Ridge (Hoerl 1970) |
| B | fc90eeb + 4건 | LinUCB 7-dim, HC3 | Li et al. (2010) |
| 4 | 42bb25a + 3건 | APT 17열 → Platt calibration → UI | Ross (1976), Platt (1999) |
| 5 | 573bbfc | James-Stein shrinkage | Efron & Morris (1975) |
| 6 | 8b6ff68 | Look-ahead 제거, 정직 감사 | Harvey (2016) p-hacking |
| 8 | fe2de2b | P0 5건 (WLS bias, KRX tax) | Kyle (1985) |
| B (패턴) | 55729563 | 넥라인/삼각형 돌파 확인 | Bulkowski (2005) |
| C | 6470f53 | StochRSI + ADX + Bayesian WR | Chande (1994), Wilder (1978) |
| D | 4546d92 | 5종 패턴(7키) + DualConf | Nison (1991), Morris (2006) |
| E | 55ed396 | 12 복합신호 + Kalman + CCI | Kalman (1960), Lambert (1980) |
| F/F+ | 6e6d02b + 3건 | WIN_RATES + 채널 + Hill/OLS/엔트로피 | Hill (1975), Shannon (1948) |
| G | be27600 | BH-FDR + Beta-Binomial + Platt | BH (1995), Platt (1999) |
| **H** | **9266446** | **5년 교정, N0=35, R:R sigmoid, isotonic** | **Barlow (1972), Gelman (2013)** |

---

## 13. 에이전트 활용 개선 로드맵

### Tier 1: 높은 임팩트 + 낮은 노력

| # | 항목 | 에이전트 | core_data | IC |
|---|------|---------|-----------|-----|
| A | Harmonic 3종 (Gartley, Butterfly, Crab) | technical-pattern-architect | 07 §9 | +0.03-0.06 |
| B | Elliott Wave 5-3 auto-detect | technical-pattern-architect | 06 §2 | +0.015-0.030 |
| C | Kelly criterion 포지션 사이징 | financial-theory-expert | 14 §2.5 | UI 개선 |
| D | VaR/CVaR 꼬리 위험 표시 | financial-systems-architect | 12 §4 | UI 개선 |
| E | Bootstrap CI (백테스트 신뢰구간) | financial-theory-expert | 17 §3 | +0.005-0.01 |

### Tier 2: 높은 임팩트 + 중간 노력

| # | 항목 | 에이전트 | core_data | IC |
|---|------|---------|-----------|-----|
| F | GARCH 변동성 클러스터링 | financial-systems-architect | 02 §2.2 | +0.02-0.04 |
| G | HMM 레짐 감지 (bull/bear/sideways) | financial-theory-expert | 05, 13 | +0.015-0.030 |
| H | 잔여 9종 패턴 (cupAndHandle 등) | technical-pattern-architect | 16 | +0.01-0.02 |

### Tier 3: 높은 임팩트 + 높은 노력 (Stage C 급)

| # | 항목 | core_data |
|---|------|-----------|
| I | DQN/PPO full RL | 11, 11B |
| J | CNN 캔들스틱 인식 (TensorFlow.js) | 15 §1-3 |
| K | Multi-agent 시장 시뮬레이션 | 09, 11B §1 |

---

## 14. 알려진 제약/참고사항

1. **LinUCB 비활성**: t_stat_delta=1.46 < 2.0 → 런타임 영향 0
2. **Platt 미캘리브레이션**: 18종 모두 A=4.0, B=-2.0 (identity-like)
3. **vw, rw E등급**: IC 음수, Wc에서 제외 (hw×mw만 사용)
4. **유휴 지표 3종**: calcWilliamsR, calcMomentum, calcAwesomeOscillator
5. **RSI 다이버전스 _weights 미등록**: 의도적 (MACD 대비 약한 신호)
