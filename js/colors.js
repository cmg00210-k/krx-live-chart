// ══════════════════════════════════════════════════════
//  KRX LIVE — 색상 상수 중앙 관리
//  모든 JS에서 하드코딩 대신 KRX_COLORS 참조
// ══════════════════════════════════════════════════════

const KRX_COLORS = Object.freeze({
  UP: '#E05050', DOWN: '#5086DC', ACCENT: '#C9A84C', NEUTRAL: '#ffeb3b',
  UP_FILL: (a) => `rgba(224,80,80,${a})`,
  DOWN_FILL: (a) => `rgba(80,134,220,${a})`,
  ACCENT_FILL: (a) => `rgba(201,168,76,${a})`,
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
  CHART_GRID_VERT: 'rgba(42,46,57,0.25)',
  CHART_GRID_HORZ: 'rgba(42,46,57,0.40)',
  CHART_WATERMARK: 'rgba(255,255,255,0.04)',
  CHART_ZERO_LINE: 'rgba(255,255,255,0.15)',
  LINE_PRICE: '#2962ff',

  // ── 패턴 전용 색상 (패턴이 주인공 — 캔들은 배경) ──
  // 드래그 기반 UX에서 패턴이 즉시 눈에 들어와야 하므로
  // 기존 은은한 스타일 → 더 선명한 강조 스타일로 전환
  // 매수 패턴: 민트/시안 계열 (강조)
  PTN_BUY:       'rgba(150,220,200,0.65)',    // 민트 반투명 테두리
  PTN_BUY_FILL:  'rgba(150,220,200,0.12)',    // 민트 영역 (0.06→0.12 강화)
  // 매도 패턴: 라벤더/퍼플 계열 (강조)
  PTN_SELL:      'rgba(190,170,220,0.65)',    // 라벤더 반투명 테두리
  PTN_SELL_FILL: 'rgba(190,170,220,0.12)',    // 라벤더 영역 (0.06→0.12 강화)
  // 중립/도지: 실버 (약간 강조)
  PTN_NEUTRAL:   'rgba(200,200,200,0.55)',    // 실버 (0.45→0.55)
  // 패턴 구조선 (넥라인, 손절/목표)
  PTN_STRUCT:    'rgba(200,200,200,0.45)',    // 회색 구조선 (0.35→0.45)
  PTN_STOP:      'rgba(190,170,220,0.55)',    // 손절: 라벤더 (0.45→0.55)
  PTN_TARGET:    'rgba(150,220,200,0.55)',    // 목표: 민트 (0.45→0.55)
  // 마커 화살표 (가장 진하게 — 핵심 포인트)
  PTN_MARKER_BUY:  'rgba(130,210,185,0.8)',   // 민트 마커 (0.7→0.8)
  PTN_MARKER_SELL: 'rgba(175,155,210,0.8)',   // 라벤더 마커 (0.7→0.8)
});
