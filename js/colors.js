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
  KALMAN: '#76FF03', RSI: '#ff9800',
  MACD_LINE: '#2962ff', MACD_SIGNAL: '#ff9800',

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
  PTN_STRUCT:    'rgba(200,200,200,0.45)',    // 구조선 (넥라인 등)
  PTN_STOP:      'rgba(150,220,200,0.55)',    // [통일] 손절: 민트 (라벨로 구분)
  PTN_TARGET:    'rgba(150,220,200,0.55)',    // 목표: 민트
  PTN_MARKER_BUY:  'rgba(130,210,185,0.8)',   // 민트 마커
  PTN_MARKER_SELL: 'rgba(130,210,185,0.8)',   // [통일] 매도 마커도 민트
});
