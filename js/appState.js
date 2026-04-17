// ══════════════════════════════════════════════════════
//  KRX LIVE — App State (전역 상태, 설정, 상수 테이블)
//
//  appWorker.js, appUI.js, app.js에서 참조하는 공유 전역 변수.
//  index.html 로드 순서: appState → appWorker → appUI → app
// ══════════════════════════════════════════════════════


// ── 상태 ──
let currentStock = ALL_STOCKS[0];
let currentTimeframe = '1d';  // 기본 일봉 (장외에서도 데이터 있음)
let activeIndicators = new Set(['vol']);  // 기본: 거래량만 (pure price chart)
let chartType = 'candle';
let patternEnabled = false;  // 기본 OFF: pure price chart → 사용자가 [분석] 클릭 시 활성화
// ppCollapsed 제거됨 — 통합 탭 패널로 전환 (<=1200px에서 C+D 통합)
let detectedPatterns = [];
let detectedSignals = [];
let signalStats = {};
let adaptiveWeights = {};

// ── 오실레이터 상호 배제 그룹 (investing.com 스타일: 최대 2 서브차트) ──
// MACD는 독립 슬롯. 아래 6개는 동시에 1개만 표시.
const OSCILLATOR_GROUP = ['rsi', 'stoch', 'cci', 'adx', 'willr', 'atr'];

// data-ind 키 → chartManager destroy 메서드 + _dom 컨테이너/라벨 매핑
const _OSC_MAP = {
  rsi:   { destroy: 'destroyRSI',         container: 'rsiContainer',   label: 'rsiLabel' },
  stoch: { destroy: 'destroyStochastic',  container: 'stochContainer', label: 'stochLabel' },
  cci:   { destroy: 'destroyCCI',         container: 'cciContainer',   label: 'cciLabel' },
  adx:   { destroy: 'destroyADX',         container: 'adxContainer',   label: 'adxLabel' },
  willr: { destroy: 'destroyWilliamsR',   container: 'willrContainer', label: 'willrLabel' },
  atr:   { destroy: 'destroyATR',         container: 'atrContainer',   label: 'atrLabel' },
};

// _deactivateOscillator() → appUI.js (DOM 조작 포함)

// ── 시각화 레이어 토글 (4카테고리) ──
var vizToggles = { candle: true, chart: true, signal: true, forecast: true };

// ── VIX→VKOSPI 프록시 스케일 상수 ──
// Doc26 §2.3 — VKOSPI ≈ VIX × 1.12 (KRX 시장, Whaley 2009)
// DEPRECATED: vkospi.json 사용 권장, 오프라인 폴백 전용
var VIX_VKOSPI_PROXY = 1.12;

// ══════════════════════════════════════════════════════
//  5-Tier Academic Verification System (2026-04-07)
//  5-agent 교차검증 기반: technical-pattern-architect, cfa-financial-analyst,
//  statistical-validation-expert, financial-theory-expert, derivatives-expert
//
//  S-Tier: 항상 렌더링 (복수 에이전트 합의, WR>55% or <45%, n>1000)
//  A-Tier: 기본 표시 (2+ 에이전트 합의, 통계적 유의미)
//  B-Tier: 비활성 — 학술 검증 후 A-달성 시 활성화 가능
//  C-Tier: 연산 전용 (렌더링 안 함, 파이프라인 입력)
//  D-Tier: 제거/숨김 (dead code 또는 중복)
// ══════════════════════════════════════════════════════

// ── S-Tier 캔들 패턴: WR≥57%, n>1000, 다에이전트 합의 ──
var _TIER_S_CANDLE = new Set([
  'gravestoneDoji',       // WR=62.0%, n=1107. Nison(1991) 상단 거부
  'shootingStar',         // WR=59.2%, n=4472. Morris(2006) 고점 매도세
  'hangingMan',           // WR=59.4%, n=5554. Nison(1991) 하방 압력 경고
  'bearishHarami',        // WR=58.7%, n=47269. Nison(1991) 모멘텀 약화
  'darkCloud',            // WR=58.5%, n=3093. Nison(1991) 낙관론 무효화
  'bearishMarubozu',      // WR=57.7%, n=41696. Nison(1991) 절대적 매도압력
  'threeBlackCrows',      // WR=57.5%, n=4812. Nison(1991) 계단식 하락
  'bearishHaramiCross',   // WR=57.5%, n=7200. Nison(1991) 추세 지속 불가
  'bearishBeltHold',      // WR=57.4%, n=3355. Morris(2006) 마루보주 완화형
  'bearishEngulfing',     // WR=57.2%, n=113066. Nison(1991) 최대표본 전일무효화
  'eveningStar',          // WR=56.7%, n=26229. Nison(1991) 3봉 고점 반전
]);

// ── S-Tier 차트 패턴 ──
var _TIER_S_CHART = new Set([
  'doubleTop',            // WR=74.7%, n=1539. Edwards&Magee(2018) 전체 최고 WR
  'doubleBottom',         // WR=62.1%, n=1939. Edwards&Magee(2018) W자형 바닥
]);

// ── A-Tier 캔들 패턴: WR 55-57% 또는 복합시그널 필수 입력 ──
var _TIER_A_CANDLE = new Set([
  'tweezerTop',           // WR=56.8%, n=5994. Nison(1991) 이중 저항
  'threeInsideDown',      // WR=55.1%, n=13760. Nison(1991) 잉태형 확인
]);

// ── A-Tier 차트 패턴 ──
var _TIER_A_CHART = new Set([
  'risingWedge',          // WR=59.8%, n=1054. Bulkowski(2005) 하향 돌파 67%
  'headAndShoulders',     // WR=56.9%, n=1156. Edwards&Magee(2018) 고전적 반전
]);

// ── B-Tier 캔들 패턴: 복합시그널 입력으로 필요하나 단독 WR 약함 ──
// 학술 검증 후 A-달성 시 _TIER_A_CANDLE로 승격 가능
var _TIER_B_CANDLE = new Set([
  'hammer',               // WR=45.2%, 단독 약하나 strongBuy 핵심. 승격 조건: 복합WR>55%
  'tweezerBottom',        // WR=46.5%, 매수 거울상
  'piercingLine',         // WR=50.2%, darkCloud 대칭
  'dragonflyDoji',        // WR=45.0%, gravestoneDoji 대칭
  'threeWhiteSoldiers',   // WR=47.6%, 흑삼병 대칭
  'bullishEngulfing',     // WR=41.3%, 복합시그널 입력
  'morningStar',          // WR=40.5%, 석별형 대칭. 복합시그널 입력
  'bullishHarami',        // WR=44.1%, bearishHarami 대칭
  'threeInsideUp',        // WR=42.4%, 삼내형 대칭
  'invertedHammer',       // WR=48.9%, 해머 계열 완결
  'bullishMarubozu',      // WR=41.8%, 복합시그널 goldenMarubozuVol 입력
  'risingThreeMethods',   // 상승삼법 — 연속형(continuation), Nison(1991), WR미검증
  'fallingThreeMethods',  // 하락삼법 — 연속형(continuation), Nison(1991), WR미검증
]);

// ── B-Tier 차트 패턴 ──
var _TIER_B_CHART = new Set([
  'channel',              // WR=58.0%, n=125 (소표본)
  'descendingTriangle',   // WR=54.3%, n=503
  'inverseHeadAndShoulders', // WR=44.0%, H&S 대칭
  'cupAndHandle',         // WR=61%(Bulkowski), KRX 미검증. O'Neil(1988)
  'fallingWedge',         // WR=39.1%, risingWedge 대칭 (KRX anomaly)
  'ascendingTriangle',    // WR=39.5%, n=352
  'symmetricTriangle',    // WR=32.3%, 방향 중립
]);

// ── D-Tier (SUPPRESS): WR≈50% 또는 노이즈 ──
var _SUPPRESS_PATTERNS = new Set([
  'longLeggedDoji',      // WR 45%, neutral, 확증편향 최고위험
  'bullishHaramiCross',  // WR 46%, buy 역시그널
  'bullishBeltHold',     // WR 51.4%, p=0.17 50%과 구분불가
  'spinningTop',         // WR 43%, n=559K 노이즈
  'doji',                // WR 42%, 독립 예측력 없음
]);
// D-Tier (CONTEXT_ONLY): 표시하되 경고 배지 부착 (n 극소)
var _CONTEXT_ONLY_PATTERNS = new Set([
  'abandonedBabyBullish',  // n=137, KRX gap 희소
  'abandonedBabyBearish',  // n=71, KRX gap 희소
  'stickSandwich',         // n=420, WR 52% 50%포함
]);

// ── 시그널 Tier 분류 ──
var _TIER_S_SIGNALS = new Set([
  'goldenCross',          // weight=+3.0, Murphy(1999). 최고 가중치 추세 전환
  'deadCross',            // weight=-3.0
]);
var _TIER_A_SIGNALS = new Set([
  'ichimokuCloudBreakout',  // weight=+3.0, Hosoda(1969) 구름 돌파
  'ichimokuCloudBreakdown', // weight=-3.0
  'macdBullishDivergence',  // weight=+2.5, Murphy(1999) 모멘텀 고갈
  'macdBearishDivergence',  // weight=-2.5
  'rsiBullishDivergence',   // weight=+2.0, Wilder(1978) RSI와 독립
  'rsiBearishDivergence',   // weight=-2.0
  'ichimokuBullishCross',   // weight=+2.5, Hosoda(1969) TK Cross
  'ichimokuBearishCross',   // weight=-2.5
  'macdBullishCross',       // weight=+2.0, Appel(1979) MACD 교차
  'macdBearishCross',       // weight=-2.0
  'rsiOversoldExit',        // weight=+2.5, Wilder(1978) Hurst-conditioned
  'rsiOverboughtExit',      // weight=-2.5
  'bbSqueeze',              // conf=68, Bollinger(1992) 변동성 폭발
  'volumeBreakout',         // weight=+2.0, Ané-Geman(2000) z-score
  'volumeSelloff',          // weight=-2.0
]);
// B-Tier 시그널: 연산은 되나 차트 렌더링 비활성
var _TIER_B_SIGNALS = new Set([
  'maAlignment_bull', 'maAlignment_bear',
  'stochasticOversold', 'stochasticOverbought',
  'bbLowerBounce',
]);
// D-Tier 시그널: 차트 렌더링 제거 (연산은 복합시그널 입력으로 유지)
var _TIER_D_SIGNALS = new Set([
  'stochRsiOversold', 'stochRsiOverbought',  // StochRSI=Stochastic(RSI) 파생적
  'bbUpperBreak',       // neutral, weight=0
  'volumeExhaustion',   // neutral, 노이즈
]);

// ── 복합시그널 Tier 분류 ──
var _TIER_S_COMPOSITES = new Set([
  'sell_doubleTopNeckVol',     // baseConf=75, 시스템 최고 확신
  'buy_doubleBottomNeckVol',   // baseConf=72, Edwards&Magee 표준 확인
]);
var _TIER_A_COMPOSITES = new Set([
  'strongSell_shootingMacdVol',  // baseConf=69, KRX 약세 우위
  'sell_shootingStarBBVol',      // baseConf=69, BB rejection
  'sell_engulfingMacdAlign',     // baseConf=66
]);
// B-Tier 이하 복합시그널: 렌더링 비활성
var _TIER_B_COMPOSITES = new Set([
  'strongBuy_hammerRsiVolume',   // baseConf=61, hammer WR=47.9%
  'buy_ichimokuTriple', 'sell_ichimokuTriple',
  'buy_goldenMarubozuVol', 'sell_deadMarubozuVol',
  'buy_goldenCrossRsi', 'sell_deadCrossMacd',
  'buy_hammerBBVol', 'sell_eveningStarRsiVol',
  'buy_morningStarRsiVol',
]);
// D-Tier 복합시그널: 차트 렌더링 제거
var _TIER_D_COMPOSITES = new Set([
  'buy_engulfingMacdAlign',  // baseConf=48 < 손익분기
  'buy_bbBounceRsi',         // baseConf=55, 단일조건, 과대
  'sell_bbBreakoutRsi',      // baseConf=55, 단일조건
]);

// ── 통합 S+A 활성 Set (렌더링 판정용) ──
var _ACTIVE_CANDLE_TYPES = new Set([..._TIER_S_CANDLE, ..._TIER_A_CANDLE]);
var _ACTIVE_CHART_TYPES = new Set([..._TIER_S_CHART, ..._TIER_A_CHART]);
var _ACTIVE_SIGNALS = new Set([..._TIER_S_SIGNALS, ..._TIER_A_SIGNALS]);
var _ACTIVE_COMPOSITES = new Set([..._TIER_S_COMPOSITES, ..._TIER_A_COMPOSITES]);

// 전체 캔들/차트 패턴 Set (감지 대상 — B+이하도 백테스트 데이터 수집)
var _VIZ_CANDLE_TYPES = new Set([
  ..._TIER_S_CANDLE, ..._TIER_A_CANDLE, ..._TIER_B_CANDLE,
]);
var _VIZ_CHART_TYPES = new Set([
  ..._TIER_S_CHART, ..._TIER_A_CHART, ..._TIER_B_CHART,
]);

// ══════════════════════════════════════════════════════
//  Tier 승격 프로토콜 (B → A- 달성 시 활성화)
//
//  B-Tier 항목이 A-Tier로 승격되려면 다음 조건 충족 필요:
//
//  1. 학술 검증 (Academic Verification):
//     - 해당 패턴/시그널의 이론적 수식이 core_data/ 문서에 정의
//     - 구현 코드가 이론과 정합 (financial-theory-expert 검증)
//     - 학술 등급 B+ 이상
//
//  2. 실증 검증 (Empirical Verification):
//     - KRX 5년 백테스트 WR > 55% (매도) 또는 < 45% (매수 역시그널)
//     - 표본 크기 n ≥ 500
//     - BH-FDR 보정 후 통계적 유의미 (q < 0.05)
//     - Walk-Forward WFE ≥ 50%
//
//  3. 교차검증 (Cross-Validation):
//     - 최소 2개 에이전트의 ESSENTIAL 판정
//     - Reliability Tier B 이상
//
//  승격 절차:
//    _TIER_B_CANDLE.delete('patternName');
//    _TIER_A_CANDLE.add('patternName');
//    _ACTIVE_CANDLE_TYPES.add('patternName');
//    // (차트/시그널/복합시그널도 동일 패턴)
//
//  강등 절차 (A → B):
//    WR이 50% ±3% 범위 진입 시 또는 n 축적 후 유의미성 상실 시
//    _TIER_A_CANDLE.delete('patternName');
//    _TIER_B_CANDLE.add('patternName');
//    _ACTIVE_CANDLE_TYPES.delete('patternName');
// ══════════════════════════════════════════════════════

let candles = [];
let tickTimer = null;
let _lastPatternAnalysis = 0;
let _realtimeMode = false;
let _realtimeUnsub = null;
let _selectVersion = 0;
let _tfVersion = 0;            // [OPT] 타임프레임 빠른 전환 시 stale fetch 무시용
let _fallbackTimer = null;
let _prevPrice = null;       // 가격 변화 flash 감지용
let _kbNavTimer = null;      // 키보드 네비게이션 디바운스 타이머
let _sectorData = null;      // 업종 비교 데이터 (sector_fundamentals.json)
let _marketContext = null;   // [Phase I-L2] 시장 맥락 (market_context.json — CCSI/VKOSPI/flow)
var _macroLatest = null;     // 매크로 데이터 캐시 (macro_latest.json — KTB10Y/USD/CPI 등)
var _bondsLatest = null;     // 채권 데이터 캐시 (bonds_latest.json — 수익률곡선 등)
var _microContext = null;    // 미시경제 지표 캐시 (ILLIQ, HHI boost) — Phase 2-D
var _derivativesData = null; // 파생상품 요약 (derivatives_summary.json — basis, PCR, OI)
var _investorData = null;    // 투자자 수급 요약 (investor_summary.json — 외국인/기관 순매수)
var _etfData = null;         // ETF 센티먼트 요약 (etf_summary.json — 레버리지/인버스 비율)
var _shortSellingData = null;// 공매도 요약 (shortselling_summary.json — SIR, DTC)
var _kosisLatest = null;     // [FIX-H12] KOSIS 경제 지표 (kosis_latest.json — CLI/ESI/소매판매)
var _macroComposite = null;  // [Phase 8] MCS v2 복합점수 (macro_composite.json — mcsV2/taylorGap/yieldCurvePhase)
var _flowSignals = null;     // [Phase 8] 투자자 수급 신호 (flow_signals.json — foreignMomentum/HMM regime)
var _optionsAnalytics = null; // [Phase 5] 옵션 분석 (options_analytics.json — impliedMove/PCR/skew)
var _lastAdvLevel = 0;       // 최근 Worker 분석의 ADV 유동성 등급 (signalEngine.calcADVLevel)
var _lastVolRegime = 'neutral';  // [Phase0-#6] 최근 Worker 분석의 VolRegime 레짐 (signalEngine.calcVolRegime)
var _currentRORORegime = 'neutral';  // [D-2] RORO 3-체제: 'risk-on' | 'risk-off' | 'neutral'
var _roroScore = 0;                  // [D-2] RORO 복합 스코어 [-1.0, +1.0]
var _currentDD = null;               // [D-4] Merton Naive DD (비금융주 한정, Bharath & Shumway 2008)

// ── 파이프라인 상태 추적 (12개 데이터 소스 건강도) ──
// appWorker.js 로더 함수에서 각 fetch 성공/실패 시 상태 갱신
// 상태: 'ok' (정상 로드), 'stale' (오래된 데이터), 'missing' (미로드/실패), 'sample' (샘플 데이터)
var _pipelineStatus = {
  macro_latest: 'missing',
  bonds_latest: 'missing',
  kosis_latest: 'missing',
  macro_composite: 'missing',
  vkospi: 'missing',
  derivatives: 'missing',
  investor: 'missing',
  etf: 'missing',
  shortselling: 'missing',
  basis: 'missing',
  flow_signals: 'missing',
  options_analytics: 'missing'
};

function _getPipelineHealth() {
  var counts = { ok: 0, stale: 0, missing: 0, sample: 0 };
  var keys = Object.keys(_pipelineStatus);
  for (var i = 0; i < keys.length; i++) {
    var v = _pipelineStatus[keys[i]];
    counts[v] = (counts[v] || 0) + 1;
  }
  counts.total = keys.length;
  return counts;
}

// ── [V47-B2] 교차-API cascade failure 가드 ──
// 12개 소스는 3대 상위 API에서 파생된다. 한 API 전체가 실패하면
// 해당 API 의존 신뢰도 조정을 일괄 비활성화하여 부분 데이터 기반의
// 가짜 정밀도(spurious precision) 생성을 차단한다.
//
// 그룹 매핑:
//   ECOS (한국은행): macro_latest, bonds_latest, macro_composite(파생)
//   KOSIS (통계청):  kosis_latest
//   KRX  (거래소):   vkospi, derivatives, investor, etf, shortselling,
//                    basis(파생), flow_signals(파생), options_analytics
var _API_GROUPS = {
  ECOS: ['macro_latest', 'bonds_latest', 'macro_composite'],
  KOSIS: ['kosis_latest'],
  KRX: ['vkospi', 'derivatives', 'investor', 'etf', 'shortselling',
        'basis', 'flow_signals', 'options_analytics']
};

// API 그룹 건강도 반환: 'healthy' | 'degraded' | 'down'
// healthy: 모든 필수 소스 'ok'
// degraded: 1~2개 소스 missing/sample이지만 과반 'ok'
// down: 과반 소스 missing — 해당 API 의존 조정 전면 비활성화
function _getApiGroupHealth(apiName) {
  var sources = _API_GROUPS[apiName];
  if (!sources) return 'unknown';
  var ok = 0, degraded = 0, down = 0;
  for (var i = 0; i < sources.length; i++) {
    var status = _pipelineStatus[sources[i]];
    if (status === 'ok' || status === 'aging' || status === 'naver') ok++;
    else if (status === 'stale' || status === 'sample') degraded++;
    else down++;  // 'missing', 'rejected', 'empty', 'error'
  }
  var total = sources.length;
  if (down > total / 2) return 'down';
  if (down + degraded > total / 2) return 'degraded';
  return 'healthy';
}

// 교차-API cascade 실패 감지: 한 API가 'down' 상태면 콘솔 경고 출력
// _applyMacroConfidenceToPatterns 등에서 이 값을 참조하여 전면 스킵 결정
function _reportCrossApiStatus() {
  var statuses = {
    ECOS: _getApiGroupHealth('ECOS'),
    KOSIS: _getApiGroupHealth('KOSIS'),
    KRX: _getApiGroupHealth('KRX')
  };
  var downApis = [];
  Object.keys(statuses).forEach(function(api) {
    if (statuses[api] === 'down') downApis.push(api);
  });
  if (downApis.length > 0) {
    console.warn('[CROSS-API] ' + downApis.join(', ') +
      ' API 그룹 다운 — 관련 신뢰도 조정 전면 비활성화');
  }
  return statuses;
}

let _chartPatternStructLines = [];  // 전체 분석에서 감지된 차트 패턴의 구조선 보존 (드래그 시 소실 방지)
let _lastActivePattern = null;     // [Fix-1] 전체 분석의 active 패턴 보존 (드래그 시 HUD 소실 방지)

// ── 데이터 수신 시각 추적 상태 ──
var _lastDataTime = 0;
var _freshnessTimer = null;

// ── DOM 캐시 (빈번 조회 요소) ──
const _dom = {};

// ── 시그널 카테고리 필터 상태 ──
let activeSignalCategories = new Set(['ma', 'macd', 'rsi', 'bb', 'volume', 'composite', 'ichimoku', 'hurst', 'kalman', 'stochastic']);

// ── Web Worker 상태 (Phase 9) ──
let _analysisWorker = null;
let _workerReady = false;
let _workerVersion = 0;       // 종목/타임프레임 변경 시 증가, stale 결과 무시용
let _workerPending = false;    // Worker에 분석 요청 진행 중 여부
let _prevPatternCount = -1;    // 패턴 toast 중복 방지용
let _dragVersion = 0;          // 드래그 분석 stale 결과 무시용
let _dragDebounceTimer = null;  // 드래그 분석 150ms 디바운스
let _dragClampFrom = 0;        // 드래그 분석 인덱스 오프셋 (Worker 결과 보정용)
let _activePriceLines = [];    // [Phase1-B] 목표가/손절가 PriceLine 참조 (줌 무관 우측 축 앵커)
let _ohlcRafId = 0;            // [FIX] crosshair OHLC 바 RAF 디바운스 ID
let _workerRestartCount = 0;   // [FIX] Worker 에러 시 재시작 카운터 (최대 3회)
let _lastBacktestVersion = -1; // 백테스트 결과 중복 처리 방지 — version 추적
let _lastBacktestLen = -1;     // 백테스트 결과 중복 처리 방지 — candleLength 추적
var _signalBacktestResults = null; // [Signal Backtest] 시그널 백테스트 결과 저장 (Worker → app)

// 차트 패턴 구조선 보존 대상 타입 (이중바닥, 삼각형 등 넓은 구간에 걸치는 패턴)
const _CHART_PATTERN_TYPES = new Set([
  'doubleBottom', 'doubleTop',
  'headAndShoulders', 'inverseHeadAndShoulders',
  'ascendingTriangle', 'descendingTriangle', 'symmetricTriangle',
  'risingWedge', 'fallingWedge', 'channel',
]);

// ── 즐겨찾기 (워치리스트) ──
var WATCHLIST_KEY = 'krx_watchlist';
function _getWatchlist() {
  try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || []; } catch (e) { return []; }
}
function _saveWatchlist(list) { try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); } catch(e) {} }
function _toggleWatchlist(code) {
  var list = _getWatchlist();
  var idx = list.indexOf(code);
  if (idx >= 0) list.splice(idx, 1); else list.push(code);
  _saveWatchlist(list);
  return idx < 0; // true=추가됨
}
// _updateStarBtn() → appUI.js (DOM 조작 포함)

// ── 지표 파라미터 (우클릭 커스터마이징) ──
var DEFAULT_IND_PARAMS = {
  ma: { p1: 5, p2: 20, p3: 60 },
  ema: { p1: 12, p2: 26 },
  bb: { period: 20, stdDev: 2 },
  rsi: { period: 14 },
  macd: { fast: 12, slow: 26, signal: 9 },
  ich: { tenkan: 9, kijun: 26, senkou: 52 },
  stoch: { kPeriod: 14, dPeriod: 3, smooth: 3 },
  cci: { period: 20 },
  adx: { period: 14 },
  willr: { period: 14 },
  atr: { period: 14 },
};
var _PARAM_LABELS = {
  p1: '단기', p2: '중기', p3: '장기', period: '기간', stdDev: '표준편차',
  fast: '빠른선', slow: '느린선', signal: '시그널', tenkan: '전환선', kijun: '기준선', senkou: '선행스팬',
  kPeriod: 'K 기간', dPeriod: 'D 기간', smooth: 'Smooth',
};
function _loadIndParams() {
  try {
    var s = JSON.parse(localStorage.getItem('krx_ind_params'));
    if (s) {
      var merged = JSON.parse(JSON.stringify(DEFAULT_IND_PARAMS));
      for (var k in s) {
        if (merged[k]) Object.assign(merged[k], s[k]);
        else merged[k] = s[k];
      }
      return merged;
    }
    return JSON.parse(JSON.stringify(DEFAULT_IND_PARAMS));
  } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_IND_PARAMS)); }
}
function _saveIndParams(p) { try { localStorage.setItem('krx_ind_params', JSON.stringify(p)); } catch(e) {} }
var indParams = _loadIndParams();
var _activeParamInd = null;

// ══════════════════════════════════════════════════════════════
// [V48-Phase2.5] _STOVALL_CYCLE / _RATE_BETA / REGIME_CONFIDENCE_MULT /
// MCS_THRESHOLDS removed — moved to functions/_lib/macro_tables.mjs.
// _KSIC_MACRO_SECTOR_MAP + _getStovallSector() retained: still consumed by
// _applyDerivativesConfidenceToPatterns / _classifyRORORegime / financials.js.
// ══════════════════════════════════════════════════════════════

// KSIC 세분류 → 대분류 매핑 (키워드 기반, 순서 중요: 먼저 매칭되면 확정)
var _KSIC_MACRO_SECTOR_MAP = [
  // Semiconductor
  { keywords: ['반도체'], sector: 'semiconductor' },
  // Technology
  { keywords: ['소프트웨어', '자료처리', '호스팅', '포털', '인터넷', '게임', '통신 및 방송 장비',
               '컴퓨터', '정보서비스', '프로그래밍'], sector: 'tech' },
  // Financial
  { keywords: ['은행', '보험', '금융', '증권', '신탁', '저축', '여신', '투자'], sector: 'financial' },
  // Healthcare
  { keywords: ['의약', '의료', '바이오', '제약'], sector: 'healthcare' },
  // Energy
  { keywords: ['석유', '가스', '석탄', '원유', '에너지'], sector: 'energy' },
  // Utilities
  { keywords: ['전기업', '가스 공급', '수도', '폐기물'], sector: 'utility' },
  // Consumer Discretionary
  { keywords: ['자동차', '의류', '호텔', '여행', '게임', '엔터테인', '방송', '영화',
               '광고', '교육', '가전', '가구'], sector: 'cons_disc' },
  // Consumer Staples
  { keywords: ['식품', '음료', '담배', '농업', '축산', '수산', '낙농'], sector: 'cons_staple' },
  // Materials
  { keywords: ['철강', '비철금속', '화학', '시멘트', '유리', '세라믹', '종이', '고무', '플라스틱',
               '섬유', '가죽'], sector: 'material' },
  // Industrials
  { keywords: ['기계', '건설', '조선', '항공', '운송', '물류', '항만', '전자부품', '전동기',
               '선박', '중공업', '전지'], sector: 'industrial' },
  // Real Estate
  { keywords: ['부동산'], sector: 'realestate' },
  // Telecom
  { keywords: ['통신', '전화'], sector: 'telecom' },
];

function _getStovallSector(industryName) {
  if (!industryName) return null;
  for (var i = 0; i < _KSIC_MACRO_SECTOR_MAP.length; i++) {
    var entry = _KSIC_MACRO_SECTOR_MAP[i];
    for (var k = 0; k < entry.keywords.length; k++) {
      if (industryName.indexOf(entry.keywords[k]) !== -1) return entry.sector;
    }
  }
  return null;  // 매핑 실패 → 기본 cycle_phase 적용 (차등 없음)
}

// [V22-B Phase 3] ATR_DYNAMIC_CAPS / classifyVolRegime / getDynamicCap는
// Worker 스코프(analysisWorker.js importScripts)에서도 접근 가능해야 하므로
// js/indicators.js 파일 끝에 정의되어 있다. appState.js는 main-thread 전용이라
// 이 위치에 두면 Worker가 ReferenceError로 실패함.
