// ══════════════════════════════════════════════════════
//  KRX LIVE — 색상 상수 중앙 관리
//  모든 JS에서 하드코딩 대신 KRX_COLORS 참조
// ══════════════════════════════════════════════════════

const KRX_COLORS = Object.freeze({
  UP: '#E05050', DOWN: '#5086DC', ACCENT: '#A08830', NEUTRAL: '#ffeb3b',
  UP_FILL: (a) => `rgba(224,80,80,${a})`,
  DOWN_FILL: (a) => `rgba(80,134,220,${a})`,
  ACCENT_FILL: (a) => `rgba(160,136,48,${a})`,
  MA_SHORT: '#FF6B6B', MA_MID: '#FFD93D', MA_LONG: '#6BCB77',
  EMA_12: '#C77DFF', EMA_26: '#7B68EE',
  BB: '#FF8C42', BB_MID: 'rgba(255,140,66,0.4)',
  ICH_TENKAN: '#E040FB', ICH_KIJUN: '#00BFA5',
  ICH_SPANA: 'rgba(129,199,132,0.35)', ICH_SPANB: 'rgba(239,154,154,0.35)',
  ICH_CHIKOU: '#78909C',
  KALMAN: '#76FF03', RSI: '#ff9800', VOL_MA: '#B0BEC5',  // Volume MA: 청회색 (Price MA와 구분)
  MACD_LINE: '#2962ff', MACD_SIGNAL: '#ff9800',

  // ── 추가 서브차트 지표 색상 ──
  STOCH_K: '#7CB342', STOCH_D: '#e91e63',  // STOCH_K: 연초록 (#ff9800→#7CB342, RSI와 구분)
  CCI: '#26C6DA',
  ADX: '#AB47BC',
  WILLR: '#FF7043',
  ATR_LINE: '#FFA726',

  // ── chart.js 중앙화 색상 (하드코딩 제거) ──
  ICH_BULL_FILL: 'rgba(129,199,132,0.10)',   // Ichimoku 양운 영역
  ICH_BEAR_FILL: 'rgba(239,154,154,0.10)',   // Ichimoku 음운 영역
  BB_FILL:       'rgba(255,140,66,0.06)',     // Bollinger band 영역
  ADX_REF_LINE:  'rgba(255,255,255,0.2)',     // ADX 25 기준선

  // ── 캔들 패턴 전용 색상 (연보라 — 차트 패턴 민트와 구분) ──
  PTN_CANDLE: '#B388FF',
  PTN_CANDLE_FILL: function(a) { return 'rgba(179,136,255,' + (a || 0.15) + ')'; },

  // ── 패턴 무효화/태그 배경 ──
  PTN_INVALID: '#FF6B35',
  TAG_BG: (a) => `rgba(19,23,34,${a || 0.88})`,

  // ── 차트 레이아웃 색상 (KNOWSTOCK 기반 테마) ──
  CHART_BG: '#131722',
  CHART_TEXT: '#d1d4dc',
  CHART_BORDER: '#2a2e39',
  CHART_CROSSHAIR: 'rgba(149,152,161,0.4)',
  CHART_CROSSHAIR_LABEL: '#363a45',
  CHART_GRID_VERT: 'rgba(42,46,57,0.12)',
  CHART_GRID_HORZ: 'rgba(42,46,57,0.20)',
  CHART_WATERMARK: 'rgba(255,255,255,0.04)',
  CHART_ZERO_LINE: 'rgba(255,255,255,0.15)',
  LINE_PRICE: '#2962ff',

  // ── 패턴 전용 색상 (민트 통일 — TradingView/Bloomberg 단색 패턴 표준) ──
  // 매수/매도 구분은 라벨 텍스트 + 위치로 전달, 색상은 "패턴 감지됨" 의미만 담당
  PTN_BUY:       'rgba(150,220,200,0.65)',    // 민트 테두리
  PTN_BUY_FILL:  'rgba(150,220,200,0.12)',    // 민트 영역
  PTN_SELL:      'rgba(150,220,200,0.65)',    // [통일] 매도도 민트 (라벤더→민트)
  PTN_SELL_FILL: 'rgba(150,220,200,0.12)',    // [통일] 매도 영역도 민트
  PTN_NEUTRAL:   'rgba(200,200,200,0.55)',    // 중립/도지: 실버
  PTN_NEUTRAL_FILL: function(a) { return 'rgba(200,200,200,' + (a || 0.12) + ')'; },  // 중립 영역 (glow, trendArea)
  PTN_STRUCT:    'rgba(200,200,200,0.45)',    // 구조선 (넥라인 등)
  PTN_STOP:      'rgba(255,107,53,0.55)',     // 손절: 오렌지 (PTN_INVALID 계열 — 목표 민트와 시각 구분)
  PTN_TARGET:    'rgba(150,220,200,0.55)',    // 목표: 민트

  // ── Forecast Zone 색상 (patternRenderer에서 참조) ──
  FZ_TARGET_NEAR:   'rgba(150,220,200,0.22)',  // 목표 그라데이션 (진입점 쪽)
  FZ_TARGET_FAR:    'rgba(150,220,200,0.05)',  // 목표 그라데이션 (목표가 쪽)
  FZ_TARGET_BORDER: 'rgba(150,220,200,0.45)',  // 목표가 점선
  FZ_STOP_NEAR:     'rgba(255,107,53,0.15)',   // 손절 그라데이션 (진입점 쪽)
  FZ_STOP_FAR:      'rgba(255,107,53,0.03)',   // 손절 그라데이션 (손절가 쪽)
  FZ_STOP_BORDER:   'rgba(255,107,53,0.25)',   // 손절가 점선
  PTN_MARKER_BUY:  'rgba(130,210,185,0.8)',   // 민트 마커
  PTN_MARKER_SELL: 'rgba(130,210,185,0.8)',   // [통일] 매도 마커도 민트

  // ── 드로잉 도구 색상 ──
  DRAW_GOLD:   '#C9A84C',     // 추세선 기본
  DRAW_GRAY:   '#787B86',     // 수평/수직선/피보나치 기본
  DRAW_BLUE:   '#2962FF',     // TradingView 관례
  DRAW_CYAN:   '#26C6DA',     // 선택 핸들

  // ── Visible 고/저점 색상 ──
  VIS_HIGH_FILL: (a) => `rgba(224,80,80,${a})`,      // 고점 (빨강 계열)
  VIS_LOW_FILL:  (a) => `rgba(100,200,255,${a})`,    // 저점 (하늘색 — 볼륨 파랑과 구분)
});
