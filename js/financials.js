// ══════════════════════════════════════════════════════
//  KRX LIVE — 재무지표 패널 (우측 D열)
//
//  app.js에서 분리된 재무 분석 전담 모듈.
//  전역 함수로 노출 — 모듈 시스템 없음.
//
//  의존: data.js (getFinancialData), colors.js (KRX_COLORS),
//        api.js (currentStock — app.js 전역), sidebar.js (sidebarManager)
//        app.js (candles, showToast — 전역)
// ══════════════════════════════════════════════════════

// ── 추이 차트 데이터 캐시 (탭 전환용) ──
var _finTrendData = [];
var _finTrendMetric = 'revenue';

// ── 업종 비교용 최신 재무값 캐시 ──
var _latestFinOpm = 0;
var _latestFinRoe = 0;

// ══════════════════════════════════════════════════════
//  재무지표 패널 (우측 탭)
// ══════════════════════════════════════════════════════

/**
 * DART 데이터 없을 때 모든 재무 지표를 "—"로 초기화 + 캔버스 차트 클리어
 * seed 생성 가짜 데이터를 표시하지 않기 위한 헬퍼.
 */
function _clearAllFinancials() {
  // 모든 fin-* 텍스트 요소를 "—"로 설정하고 색상 클래스 제거
  var ids = [
    'fin-period', 'fin-revenue', 'fin-op', 'fin-ni',
    'fin-rev-yoy', 'fin-rev-qoq', 'fin-op-yoy', 'fin-op-qoq', 'fin-ni-yoy', 'fin-ni-qoq',
    'fin-opm', 'fin-roe', 'fin-eps', 'fin-bps',
    'fin-per', 'fin-pbr', 'fin-psr', 'fin-roa', 'fin-debt-ratio', 'fin-npm',
    'fin-rev-cagr', 'fin-ni-cagr', 'fin-score', 'fin-grade'
  ];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) {
      el.textContent = '\u2014';  // em dash
      el.className = '';
    }
  }

  // 캔버스 차트 클리어 (이전 종목의 잔류 데이터 방지)
  var canvasIds = ['opm-sparkline', 'fin-trend-canvas', 'fin-per-band'];
  for (var c = 0; c < canvasIds.length; c++) {
    var canvas = document.getElementById(canvasIds[c]);
    if (canvas) {
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // 추이 차트 데이터 캐시 초기화 (탭 전환 시 이전 종목 데이터 렌더링 방지)
  _finTrendData = [];

  // 업종 비교 / 동종업종 비교 영역 초기화
  var compareEl = document.getElementById('fin-compare');
  if (compareEl) compareEl.innerHTML = '';
  var peersEl = document.getElementById('fin-peers');
  if (peersEl) peersEl.innerHTML = '';
}

/**
 * 데이터 출처별 경고 배너 표시
 * @param {string|null} source - 'dart' | 'hardcoded' | 'seed' | null
 */
function _showDartWarning(source) {
  var el = document.getElementById('fin-seed-warning');
  if (!el) return;

  if (source === 'dart') {
    // DART 실제 데이터 — 경고 숨김
    el.style.display = 'none';
  } else if (source === 'hardcoded') {
    // 하드코딩 데이터 (삼성전자/SK하이닉스) — 일부 추정치 포함 가능
    el.style.display = 'block';
    el.textContent = '참고용 데이터 (DART 미연동 \u2014 일부 추정치 포함)';
    el.style.background = 'rgba(255,180,50,0.10)';
    el.style.borderColor = 'rgba(255,180,50,0.20)';
    el.style.color = 'rgba(255,180,50,0.65)';
  } else {
    // seed 생성 또는 알 수 없는 출처 — DART 연동 안내
    el.style.display = 'block';
    el.textContent = 'DART 데이터 미연동 \u2014 download_financials.py를 실행하세요';
    el.style.background = 'rgba(244,67,54,0.10)';
    el.style.borderColor = 'rgba(244,67,54,0.25)';
    el.style.color = 'rgba(244,67,54,0.75)';
  }
}

async function updateFinancials() {
  // [FIX] 새 종목 전환 시 이전 데이터 잔류 방지: 모든 fin-* 요소 초기화
  var _finIds = [
    'fin-period', 'fin-revenue', 'fin-op', 'fin-ni',
    'fin-rev-yoy', 'fin-rev-qoq', 'fin-op-yoy', 'fin-op-qoq', 'fin-ni-yoy', 'fin-ni-qoq',
    'fin-opm', 'fin-roe', 'fin-eps', 'fin-bps',
    'fin-per', 'fin-pbr', 'fin-psr', 'fin-roa', 'fin-debt-ratio', 'fin-npm',
    'fin-rev-cagr', 'fin-ni-cagr', 'fin-score', 'fin-grade'
  ];
  for (var _i = 0; _i < _finIds.length; _i++) {
    var _el = document.getElementById(_finIds[_i]);
    if (_el) _el.textContent = '\u2014';
  }

  var data;
  try {
    data = await getFinancialData(currentStock.code, 'quarter');
  } catch (e) {
    console.error('[KRX] 재무 데이터 로드 실패:', e);
    showToast(currentStock.name + ' 재무 데이터 로드 실패', 'error');
    _clearAllFinancials();
    return;
  }
  if (!data.length) return;
  const latest = data[0];

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  const setClass = (id, cls) => { const el = document.getElementById(id); if (el) el.className = cls; };

  // ── 데이터 출처 확인: seed 데이터는 표시하지 않음 ──
  const _cached = (typeof _financialCache !== 'undefined') ? _financialCache[currentStock.code] : null;
  const _finSource = _cached ? _cached.source : null;

  // [CLEAN-DATA] source가 'dart' 또는 'hardcoded'가 아닌 경우 (seed 생성 가짜 데이터)
  // → 모든 재무 지표를 "—"로 표시하고 캔버스 차트 초기화 후 조기 종료
  if (_finSource !== 'dart' && _finSource !== 'hardcoded') {
    _clearAllFinancials();
    _showDartWarning('seed');
    return;
  }

  // [FIX-TRUST] 데이터 출처별 경고 배너 표시
  _showDartWarning(_finSource);

  // 기간 표시
  set('fin-period', latest.p || '\u2014');

  // 주요손익지표 — 단위를 span.fin-unit으로 분리 (CSS 별도 스타일링)
  setHtml('fin-revenue', Number(latest.rev).toLocaleString() + '<span class="fin-unit">억</span>');
  setHtml('fin-op', Number(latest.op).toLocaleString() + '<span class="fin-unit">억</span>');
  setHtml('fin-ni', Number(latest.ni).toLocaleString() + '<span class="fin-unit">억</span>');

  // 영업이익 색상: 기본 흰색, 음수만 파랑
  setClass('fin-op', 'fin-row-value' + (Number(latest.op) < 0 ? ' dn' : ''));
  // 순이익 색상: 기본 흰색, 음수만 파랑
  setClass('fin-ni', 'fin-row-value' + (Number(latest.ni) < 0 ? ' dn' : ''));

  // 수익성 지표
  set('fin-opm', latest.opm);
  setClass('fin-opm', 'fin-grid-value' + (parseFloat(latest.opm) < 0 ? ' dn' : ''));
  _latestFinOpm = _parsePercent(latest.opm);
  set('fin-eps', Number(latest.eps).toLocaleString() + '원');
  setClass('fin-eps', 'fin-grid-value' + (Number(latest.eps) < 0 ? ' dn' : ''));
  const roeNum = parseFloat(latest.roe);
  set('fin-roe', isNaN(roeNum) ? '\u2014' : roeNum.toFixed(1) + '%');
  setClass('fin-roe', 'fin-grid-value' + (!isNaN(roeNum) && roeNum < 0 ? ' dn' : ''));
  _latestFinRoe = isNaN(roeNum) ? 0 : roeNum;
  // BPS: 자본총계/발행주식수 (DART 데이터에 있으면 표시)
  const bps = latest.bps || '\u2014';
  set('fin-bps', typeof bps === 'number' ? bps.toLocaleString() + '원' : bps);
  setClass('fin-bps', 'fin-grid-value' + (typeof bps === 'number' && bps < 0 ? ' dn' : ''));

  // ── Phase 1: ROA, 부채비율, NPM ──
  const rev = Number(latest.rev) || 0;
  const ni = Number(latest.ni) || 0;

  // NPM (순이익률): data.js toDisplay()에서 이미 계산, 또는 여기서 폴백
  // [FIX-3] 문자열 "14.5%" 등 파싱 안전 처리 — parseFloat 강제
  let npmVal = null;
  if (latest.npm != null) {
    npmVal = parseFloat(latest.npm) || 0;
  } else if (rev !== 0) {
    npmVal = +(ni / rev * 100).toFixed(1);
  }
  if (npmVal != null) {
    set('fin-npm', npmVal.toFixed(1) + '%');
    setClass('fin-npm', 'fin-grid-value' + (npmVal < 0 ? ' dn' : ''));
  } else {
    set('fin-npm', '\u2014');
  }

  // ROA: data.js toDisplay()에서 이미 계산, 또는 여기서 폴백
  // [FIX-2] 평균총자산 기반 ROA: (당기 + 전기 총자산) / 2 사용
  //         전분기 데이터 없으면 기말 총자산 폴백 (한계 주석 표기)
  let roaVal = null;
  if (latest.roa != null) {
    roaVal = parseFloat(latest.roa) || 0;
  } else if (latest.total_assets && Number(latest.total_assets) !== 0) {
    const curAssets = Number(latest.total_assets);
    const prevQ = data.length > 1 ? data[1] : null;
    const prevAssets = prevQ && prevQ.total_assets ? Number(prevQ.total_assets) : 0;
    // 평균총자산 = (당기 + 전기) / 2; 전기 없으면 기말잔액 폴백
    const avgAssets = prevAssets > 0 ? (curAssets + prevAssets) / 2 : curAssets;
    roaVal = +(ni / avgAssets * 100).toFixed(1);
  }
  if (roaVal != null) {
    set('fin-roa', roaVal.toFixed(1) + '%');
    setClass('fin-roa', 'fin-grid-value' + (roaVal < 0 ? ' dn' : ''));
  } else {
    set('fin-roa', '\u2014');
  }

  // 부채비율: debt_ratio (DART) 또는 total_liabilities/total_equity로 계산
  // [FIX-10] 자본총계 < 0 → "자본잠식" 표시 (부채비율 계산 불가)
  let debtRatio = null;
  const totalEquityRaw = Number(latest.total_equity) || 0;
  if (totalEquityRaw < 0) {
    set('fin-debt-ratio', '자본잠식');
    setClass('fin-debt-ratio', 'fin-grid-value dn');
  } else if (latest.debt_ratio != null) {
    debtRatio = parseFloat(latest.debt_ratio);
    set('fin-debt-ratio', debtRatio.toFixed(1) + '%');
    // 부채비율: 200% 초과 = 위험(dn), 나머지 = 기본 흰색
    setClass('fin-debt-ratio', 'fin-grid-value' + (debtRatio > 200 ? ' dn' : ''));
  } else if (latest.total_liabilities && latest.total_equity && totalEquityRaw !== 0) {
    debtRatio = +(Number(latest.total_liabilities) / totalEquityRaw * 100).toFixed(1);
    set('fin-debt-ratio', debtRatio.toFixed(1) + '%');
    setClass('fin-debt-ratio', 'fin-grid-value' + (debtRatio > 200 ? ' dn' : ''));
  } else {
    set('fin-debt-ratio', '\u2014');
  }

  // ── PER / PBR / PSR 계산 ──
  const currentPrice = candles.length ? candles[candles.length - 1].close : null;

  // 시가총액을 먼저 구함 (PER/PBR/PSR 폴백 계산에 모두 필요)
  const mcapEok = _getMarketCapEok(currentStock.code, currentPrice, latest.shares_outstanding);

  // EPS 결정: DART 직접값 → shares_outstanding 기반 계산 → 0
  // [FIX-4] shares_outstanding 단위 검증 + [FIX-9] 0 나누기 방어
  let epsNum = Number(latest.eps) || 0;
  if (!epsNum && latest.shares_outstanding && latest.shares_outstanding > 0 && ni) {
    let shares = Number(latest.shares_outstanding);
    // 단위 보정: 100 미만이면 백만주 단위로 추정 → 원래 주수로 변환
    if (shares < 100) {
      console.warn('[KRX-FIN] shares_outstanding < 100, 백만주 단위 추정:', shares, '\u2192', shares * 1000000);
      shares = shares * 1000000;
    } else if (shares > 0 && shares < 1000) {
      console.warn('[KRX-FIN] shares_outstanding 비정상 범위:', shares, '\u2014 EPS 계산 생략');
      shares = 0;
    }
    if (shares > 0) {
      // ni(억원) → 원 환산 후 주당 계산
      epsNum = Math.round(ni * 100000000 / shares);
    }
  }

  // BPS 결정: DART 직접값 → shares_outstanding 기반 계산
  // [FIX-9] shares_outstanding > 0 가드 추가 (0 나누기 방어)
  let bpsNum = typeof latest.bps === 'number' ? latest.bps : null;
  if (!bpsNum && latest.shares_outstanding && latest.shares_outstanding > 0 && latest.total_equity) {
    // total_equity(억원) → 원 환산 후 주당 계산
    bpsNum = Math.round(Number(latest.total_equity) * 100000000 / latest.shares_outstanding);
  }

  // EPS/BPS 표시 업데이트 (shares_outstanding에서 계산된 값 반영)
  if (epsNum) {
    set('fin-eps', Number(epsNum).toLocaleString() + '원');
    setClass('fin-eps', 'fin-grid-value' + (epsNum < 0 ? ' dn' : ''));
  }
  if (bpsNum) {
    set('fin-bps', Number(bpsNum).toLocaleString() + '원');
    setClass('fin-bps', 'fin-grid-value' + (bpsNum < 0 ? ' dn' : ''));
  }

  // PER 계산 우선순위:
  //   1순위: currentPrice / EPS (주당순이익 직접 or shares 기반)
  //   2순위: mcapEok / niEok   (시총/순이익 — shares 없을 때)
  // [FIX] 이중 반올림 방지: toFixed(1) 한 번만 적용
  let perVal = null;
  if (currentPrice && epsNum > 0) {
    perVal = +(currentPrice / epsNum).toFixed(1);
  } else if (!epsNum && mcapEok && ni > 0) {
    perVal = +(mcapEok / ni).toFixed(1);
  }
  if (perVal != null && perVal > 0) {
    set('fin-per', perVal + '배');
    setClass('fin-per', 'fin-grid-value');
  } else if (currentPrice && (epsNum <= 0 || ni <= 0)) {
    set('fin-per', '적자');
    setClass('fin-per', 'fin-grid-value');
  } else {
    set('fin-per', '\u2014');
  }

  // PBR 계산 우선순위:
  //   1순위: currentPrice / BPS (주당순자산 직접 or shares 기반)
  //   2순위: mcapEok / totalEquityEok (시총/자본총계 — shares 없을 때)
  let pbrVal = null;
  const totalEquityNum = Number(latest.total_equity) || 0;
  if (currentPrice && bpsNum && bpsNum > 0) {
    pbrVal = +(currentPrice / bpsNum).toFixed(2);
  } else if (!bpsNum && mcapEok && totalEquityNum > 0) {
    pbrVal = +(mcapEok / totalEquityNum).toFixed(2);
  }
  if (pbrVal != null && pbrVal > 0) {
    set('fin-pbr', pbrVal.toFixed(2) + '배');
    setClass('fin-pbr', 'fin-grid-value');
  } else {
    set('fin-pbr', '\u2014');
  }

  // PSR = 시가총액(억원) / 매출액(억원)
  let psrVal = null;
  if (mcapEok && rev > 0) {
    psrVal = +(mcapEok / rev).toFixed(2);
    set('fin-psr', psrVal.toFixed(2) + '배');
    setClass('fin-psr', 'fin-grid-value');
  } else {
    set('fin-psr', '\u2014');
  }

  // ── 성장성: 3년 CAGR 계산 ──
  const annualData = await getFinancialData(currentStock.code, 'annual');
  _calcCAGR(annualData, set, setClass);

  // ── 투자판단 점수 (0~100) ──
  _calcInvestmentScore({
    perVal, pbrVal, psrVal, roaVal, npmVal, debtRatio,
    roe: parseFloat(latest.roe) || 0,
    opm: parseFloat(latest.opm) || 0,
    annualData,
  }, set, setClass);

  // YoY/QoQ 변화율 계산
  _calcFinChanges(data);

  // 영업이익률 스파크라인
  drawOPMSparkline(data);

  // ── Phase 2: 추이 차트 (최초 로드 시 매출 탭) ──
  _finTrendData = data;
  _finTrendMetric = 'revenue';
  // 활성 탭 리셋
  const tabs = document.querySelectorAll('.fin-trend-tab');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.metric === 'revenue'));
  drawFinTrendChart(data, 'revenue');

  // ── 업종 비교 렌더링 ──
  _renderSectorComparison();

  // ── 동종업종 비교 테이블 ──
  _renderPeerGroup();

  // ── PER 밴드 차트 ──
  _drawPERBandChart();
}

/**
 * 시가총액 (억원) 산출 — sidebarManager.MARKET_CAP 또는 shares_outstanding 기반
 */
function _getMarketCapEok(code, currentPrice, sharesOutstanding) {
  // 1. sidebarManager.MARKET_CAP (하드코딩 — IIFE에서 public으로 노출)
  if (typeof sidebarManager !== 'undefined' && sidebarManager.MARKET_CAP) {
    const mcap = sidebarManager.MARKET_CAP[code];
    if (mcap) return mcap;
  }
  // 2. shares_outstanding * currentPrice (원→억원)
  if (sharesOutstanding && currentPrice) {
    return +(sharesOutstanding * currentPrice / 100000000).toFixed(0);
  }
  return null;
}

/**
 * 3년 CAGR (연평균 성장률) 계산
 * CAGR = (V_end / V_start)^(1/n) - 1
 */
function _calcCAGR(annualData, set, setClass) {
  if (!annualData || annualData.length < 2) {
    set('fin-rev-cagr', '\u2014');
    set('fin-ni-cagr', '\u2014');
    return;
  }

  const newest = annualData[0];
  const oldest = annualData.length >= 4 ? annualData[3] : annualData[annualData.length - 1];
  const years = annualData.length >= 4 ? 3 : (annualData.length - 1);

  if (years <= 0) {
    set('fin-rev-cagr', '\u2014');
    set('fin-ni-cagr', '\u2014');
    return;
  }

  // 매출 CAGR
  const revEnd = Number(newest.rev) || 0;
  const revStart = Number(oldest.rev) || 0;
  if (revStart > 0 && revEnd > 0) {
    const revCagr = (Math.pow(revEnd / revStart, 1 / years) - 1) * 100;
    set('fin-rev-cagr', (revCagr >= 0 ? '+' : '') + revCagr.toFixed(1) + '%');
    setClass('fin-rev-cagr', 'fin-grid-value ' + (revCagr >= 0 ? 'up' : 'dn'));
  } else {
    set('fin-rev-cagr', '\u2014');
  }

  // 순이익 CAGR
  const niEnd = Number(newest.ni) || 0;
  const niStart = Number(oldest.ni) || 0;
  if (niStart > 0 && niEnd > 0) {
    const niCagr = (Math.pow(niEnd / niStart, 1 / years) - 1) * 100;
    set('fin-ni-cagr', (niCagr >= 0 ? '+' : '') + niCagr.toFixed(1) + '%');
    setClass('fin-ni-cagr', 'fin-grid-value ' + (niCagr >= 0 ? 'up' : 'dn'));
  } else if (niStart < 0 && niEnd > 0) {
    set('fin-ni-cagr', '흑자전환');
    setClass('fin-ni-cagr', 'fin-grid-value up');
  } else if (niStart > 0 && niEnd < 0) {
    set('fin-ni-cagr', '적자전환');
    setClass('fin-ni-cagr', 'fin-grid-value dn');
  } else {
    set('fin-ni-cagr', '\u2014');
  }
}

/**
 * 투자판단 점수 (0~100) 산출
 *
 * 항목별 배점:
 *   수익성 (30점): ROE(15) + OPM(15)
 *   밸류에이션 (30점): PER(15) + PBR(15)
 *   성장성 (20점): 매출 CAGR 기반
 *   안정성 (20점): 부채비율 기반
 */
function _calcInvestmentScore(params, set, setClass) {
  const { perVal, pbrVal, debtRatio, roe, opm, annualData } = params;
  let score = 0;
  // [FIX-1] 활성화된 항목의 최대 배점을 동적 합산 (하드코딩 제거)
  let maxPossible = 0;

  // ── 수익성 (30점): ROE 15점 + OPM 15점 ──
  if (roe != null && !isNaN(roe)) {
    maxPossible += 15;
    if (roe >= 15) score += 15;
    else if (roe >= 10) score += 12;
    else if (roe >= 5) score += 8;
    else if (roe >= 0) score += 4;
  }
  if (opm != null && !isNaN(opm)) {
    maxPossible += 15;
    if (opm >= 20) score += 15;
    else if (opm >= 10) score += 12;
    else if (opm >= 5) score += 8;
    else if (opm >= 0) score += 4;
  }

  // ── 밸류에이션 (30점): PER 15점 + PBR 15점 ──
  if (perVal != null && perVal > 0) {
    maxPossible += 15;
    if (perVal < 10) score += 15;
    else if (perVal <= 15) score += 12;
    else if (perVal <= 25) score += 8;
    else if (perVal <= 40) score += 4;
  }
  if (pbrVal != null && pbrVal > 0) {
    maxPossible += 15;
    if (pbrVal < 0.7) score += 15;
    else if (pbrVal <= 1.0) score += 12;
    else if (pbrVal <= 2.0) score += 8;
    else if (pbrVal <= 3.0) score += 4;
  }

  // ── 성장성 (20점): 매출 CAGR ──
  if (annualData && annualData.length >= 2) {
    const newest = annualData[0];
    const oldest = annualData.length >= 4 ? annualData[3] : annualData[annualData.length - 1];
    const yrs = annualData.length >= 4 ? 3 : (annualData.length - 1);
    const rEnd = Number(newest.rev) || 0;
    const rStart = Number(oldest.rev) || 0;
    if (rStart > 0 && rEnd > 0 && yrs > 0) {
      maxPossible += 20;
      const cagr = (Math.pow(rEnd / rStart, 1 / yrs) - 1) * 100;
      if (cagr >= 20) score += 20;
      else if (cagr >= 10) score += 16;
      else if (cagr >= 5) score += 12;
      else if (cagr >= 0) score += 6;
    }
  }

  // ── 안정성 (20점): 부채비율 ──
  if (debtRatio != null && !isNaN(debtRatio)) {
    maxPossible += 20;
    if (debtRatio < 50) score += 20;
    else if (debtRatio <= 100) score += 16;
    else if (debtRatio <= 200) score += 10;
    else if (debtRatio <= 300) score += 4;
  }

  // 최소 2개 항목 활성 필요 (최소 maxPossible >= 30)
  if (maxPossible < 30) {
    set('fin-score', '\u2014');
    set('fin-grade', '\u2014');
    return;
  }

  // [FIX-1] 활성 항목의 실제 최대 배점 기준으로 정규화
  const normalizedScore = Math.round(score / maxPossible * 100);
  const finalScore = Math.min(100, Math.max(0, normalizedScore));

  set('fin-score', finalScore);
  if (finalScore >= 70) {
    setClass('fin-score', 'fin-grid-value fin-score score-high');
  } else if (finalScore >= 40) {
    setClass('fin-score', 'fin-grid-value fin-score score-mid');
  } else {
    setClass('fin-score', 'fin-grid-value fin-score score-low');
  }

  // 등급: A (80+), B (60~79), C (40~59), D (<40)
  let grade, gradeCls;
  if (finalScore >= 80) { grade = 'A'; gradeCls = 'fin-grade-a'; }
  else if (finalScore >= 60) { grade = 'B'; gradeCls = 'fin-grade-b'; }
  else if (finalScore >= 40) { grade = 'C'; gradeCls = 'fin-grade-c'; }
  else { grade = 'D'; gradeCls = 'fin-grade-d'; }

  set('fin-grade', grade);
  setClass('fin-grade', 'fin-grid-value ' + gradeCls);
}

/**
 * 재무지표 YoY/QoQ 변화율 계산
 * YoY: 전년 동기 대비 (index 4 = 4분기 전)
 * QoQ: 전분기 대비 (index 1)
 */
function _calcFinChanges(data) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  // [FIX-5] 흑자전환/적자전환 마커도 색상 반영
  const setChangeClass = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (val === '__흑자전환__') { el.className = 'fin-change up'; return; }
    if (val === '__적자전환__') { el.className = 'fin-change dn'; return; }
    el.className = 'fin-change' + (val > 0 ? ' up' : val < 0 ? ' dn' : '');
  };

  const latest = data[0];
  const prevQ = data.length > 1 ? data[1] : null;   // 전분기
  const prevY = data.length > 4 ? data[4] : null;    // 전년 동기

  // [FIX-5] prev=0 → 흑자전환/적자전환 특수 마커 반환
  const TURNAROUND_POS = '__흑자전환__';
  const TURNAROUND_NEG = '__적자전환__';
  const calcPct = (cur, prev) => {
    if (prev == null) return null;
    if (prev === 0) {
      if (cur > 0) return TURNAROUND_POS;
      if (cur < 0) return TURNAROUND_NEG;
      return null; // 0→0: 변화 없음
    }
    return ((cur - prev) / Math.abs(prev) * 100);
  };

  const fmtPct = (label, pct) => {
    if (pct == null) return label + ' \u2014';
    if (pct === TURNAROUND_POS) return label + ' 흑자전환';
    if (pct === TURNAROUND_NEG) return label + ' 적자전환';
    const sign = pct >= 0 ? '+' : '';
    return label + ' ' + sign + pct.toFixed(1) + '%';
  };

  // 매출액
  const revYoY = prevY ? calcPct(Number(latest.rev), Number(prevY.rev)) : null;
  const revQoQ = prevQ ? calcPct(Number(latest.rev), Number(prevQ.rev)) : null;
  set('fin-rev-yoy', fmtPct('YoY', revYoY));
  set('fin-rev-qoq', fmtPct('QoQ', revQoQ));
  setChangeClass('fin-rev-yoy', revYoY);
  setChangeClass('fin-rev-qoq', revQoQ);

  // 영업이익
  const opYoY = prevY ? calcPct(Number(latest.op), Number(prevY.op)) : null;
  const opQoQ = prevQ ? calcPct(Number(latest.op), Number(prevQ.op)) : null;
  set('fin-op-yoy', fmtPct('YoY', opYoY));
  set('fin-op-qoq', fmtPct('QoQ', opQoQ));
  setChangeClass('fin-op-yoy', opYoY);
  setChangeClass('fin-op-qoq', opQoQ);

  // 순이익
  const niYoY = prevY ? calcPct(Number(latest.ni), Number(prevY.ni)) : null;
  const niQoQ = prevQ ? calcPct(Number(latest.ni), Number(prevQ.ni)) : null;
  set('fin-ni-yoy', fmtPct('YoY', niYoY));
  set('fin-ni-qoq', fmtPct('QoQ', niQoQ));
  setChangeClass('fin-ni-yoy', niYoY);
  setChangeClass('fin-ni-qoq', niQoQ);
}

function drawOPMSparkline(data) {
  const canvas = document.getElementById('opm-sparkline');
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // 레이아웃: 상단 값 라벨 + 차트 영역 + 하단 분기 라벨
  const topLabelH = 14;   // 퍼센트 값 표시 영역
  const bottomLabelH = 14; // 분기 라벨 영역
  const paddingL = 16;     // 좌측 여백 (첫 라벨 잘림 방지)
  const paddingR = 16;     // 우측 여백

  // [FIX] 부모 크기에 맞게 동적 계산 — 최소 100px 보장
  const w = Math.max((canvas.parentElement ? canvas.parentElement.clientWidth - 8 : 200), 100);
  const h = Math.max(50, Math.min(80, Math.round(w * 0.28)));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  // [FIX] setTransform으로 변환 행렬 초기화 후 재스케일 (DPR 누적 방지)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  // 차트 그리기 영역 (상단/하단 라벨 제외)
  const chartTop = topLabelH;
  const chartH = h - topLabelH - bottomLabelH;
  const chartW = w - paddingL - paddingR;

  const values = data.map(d => parseFloat(d.opm) || 0).reverse();
  const labels = data.map(d => _sparklineLabel(d.p)).reverse();
  if (values.length < 2) return;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const pad = 4; // 상하 내부 패딩

  // 좌표 계산 헬퍼
  const ptX = (i) => paddingL + (i / (values.length - 1)) * chartW;
  const ptY = (v) => chartTop + pad + ((maxVal - v) / range) * (chartH - 2 * pad);

  // 포인트 배열 미리 계산
  var points = [];
  for (var i = 0; i < values.length; i++) {
    points.push({ x: ptX(i), y: ptY(values[i]) });
  }

  // 0% 기준선의 Y 좌표 (영역 채우기 기준점으로도 사용)
  var baseY = chartTop + chartH; // 기본: 차트 하단
  var hasZeroLine = minVal < 0 && maxVal > 0;
  var zeroY = hasZeroLine ? ptY(0) : baseY;

  // ── 1) 영역 채우기 (그라디언트) ──
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  // 아래로 닫기: 0% 기준선 또는 차트 하단까지
  ctx.lineTo(points[points.length - 1].x, baseY);
  ctx.lineTo(points[0].x, baseY);
  ctx.closePath();
  var gradient = ctx.createLinearGradient(0, chartTop, 0, chartTop + chartH);
  gradient.addColorStop(0, 'rgba(160,136,48,0.20)');
  gradient.addColorStop(1, 'rgba(160,136,48,0.02)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // ── 2) 0% 기준선 (양수/음수 혼재 시) ──
  if (hasZeroLine) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingL, zeroY);
    ctx.lineTo(w - paddingR, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // "0%" 라벨
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0%', paddingL - 3, zeroY);
  }

  // ── 3) 라인 ──
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = KRX_COLORS.ACCENT;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── 4) 원형 마커 (각 데이터 포인트) ──
  for (i = 0; i < points.length; i++) {
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, 3, 0, Math.PI * 2);
    ctx.fillStyle = values[i] >= 0 ? KRX_COLORS.ACCENT : KRX_COLORS.DOWN;
    ctx.fill();
  }

  // ── 5) 퍼센트 값 텍스트 (마커 위) ──
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  // 라벨 표시 간격: 6개 이하면 모두, 아니면 짝수 인덱스 + 마지막
  var showAll = values.length <= 6;
  for (i = 0; i < points.length; i++) {
    if (!showAll && i % 2 !== 0 && i !== points.length - 1) continue;
    ctx.fillStyle = values[i] >= 0
      ? KRX_COLORS.CHART_TEXT || 'rgba(255,255,255,0.7)'
      : KRX_COLORS.DOWN;
    ctx.fillText(values[i].toFixed(1) + '%', points[i].x, points[i].y - 6);
  }

  // ── 6) X축 분기 라벨 (하단) ──
  ctx.font = "10px 'Pretendard', sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  var maxLabels = 6;
  var step = values.length <= maxLabels ? 1 : Math.ceil(values.length / maxLabels);
  for (i = 0; i < points.length; i++) {
    if (i % step !== 0 && i !== points.length - 1) continue;
    ctx.fillText(labels[i] || '', points[i].x, chartTop + chartH + 2);
  }
}

/**
 * 분기 라벨 축약: "2025 Q3" -> "Q3'25", "2024" -> "'24"
 */
function _sparklineLabel(p) {
  if (!p) return '';
  const qm = p.match(/^(\d{4})\s*Q(\d)$/);
  if (qm) return `Q${qm[2]}'${qm[1].slice(2)}`;
  const ym = p.match(/^(\d{4})$/);
  if (ym) return `'${ym[1].slice(2)}`;
  return p;
}

// ══════════════════════════════════════════════════════
//  추이 차트 (Phase 2 — 매출/영익 바차트 + EPS 라인차트)
// ══════════════════════════════════════════════════════

/**
 * 추이 차트 그리기 (매출/영익: 바차트, EPS: 라인차트)
 * drawOPMSparkline()과 동일한 패턴.
 * @param {Array} data - 재무 데이터 배열 (최신순)
 * @param {string} metric - 'revenue' | 'op' | 'eps'
 */
function drawFinTrendChart(data, metric) {
  const canvas = document.getElementById('fin-trend-canvas');
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const labelHeight = 14;
  // [FIX] 부모 크기에 맞게 동적 계산
  const w = Math.max((canvas.parentElement ? canvas.parentElement.clientWidth - 8 : 190), 100);
  const h = Math.max(44, Math.min(70, Math.round(w * 0.25)));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  // [FIX] setTransform으로 변환 행렬 초기화 후 재스케일 (DPR 누적 방지)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const chartH = h - labelHeight;

  // 최근 8분기, 과거→최신 순서로 정렬
  const sliced = data.slice(0, 8).reverse();
  const labels = sliced.map(d => _sparklineLabel(d.p));

  // 메트릭에 따른 값 추출
  const keyMap = { revenue: 'rev', op: 'op', eps: 'eps' };
  const key = keyMap[metric] || 'rev';
  const values = sliced.map(d => Number(d[key]) || 0);

  if (values.length < 1) return;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const absMax = Math.max(Math.abs(max), Math.abs(min)) || 1;

  // 0선 위치 (양수/음수 공존 시)
  const hasNeg = min < 0;
  const zeroY = hasNeg
    ? chartH * (absMax / (absMax * 2))  // 중간에 0선
    : chartH;  // 양수만: 바닥이 0

  if (metric === 'eps') {
    // ── EPS: 라인차트 + 점 ──
    const range = max - min || 1;
    const pad = 4;

    // 영역 채우기
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = pad + ((max - v) / range) * (chartH - 2 * pad);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(w, chartH);
    ctx.lineTo(0, chartH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(160,136,48,0.08)';
    ctx.fill();

    // 라인
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = pad + ((max - v) / range) * (chartH - 2 * pad);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = KRX_COLORS.ACCENT;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 데이터 포인트
    values.forEach((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = pad + ((max - v) / range) * (chartH - 2 * pad);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = v >= 0 ? KRX_COLORS.UP : KRX_COLORS.DOWN;
      ctx.fill();
    });

  } else {
    // ── 매출/영익: 바차트 ──
    const barCount = values.length;
    const gap = 3;
    const barW = Math.max(4, (w - gap * (barCount + 1)) / barCount);

    values.forEach((v, i) => {
      const x = gap + i * (barW + gap);
      const barH = (Math.abs(v) / absMax) * (hasNeg ? chartH / 2 : chartH - 2);

      ctx.fillStyle = v >= 0
        ? 'rgba(224, 80, 80, 0.65)'   // 양수: 빨강
        : 'rgba(80, 134, 220, 0.65)'; // 음수: 파랑

      if (v >= 0) {
        ctx.fillRect(x, zeroY - barH, barW, barH);
      } else {
        ctx.fillRect(x, zeroY, barW, barH);
      }
    });

    // 0선 (음수가 있을 때만)
    if (hasNeg) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(w, zeroY);
      ctx.stroke();
    }

    // 바 위에 값 표시 (억원 → 조/억 단위) — 겹침 방지 thinning
    ctx.fillStyle = '#A0A0A0';
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    var prevLabelX = null;
    values.forEach((v, i) => {
      var barX = gap + i * (barW + gap);
      var barH = (Math.abs(v) / absMax) * (hasNeg ? chartH / 2 : chartH - 2);
      var text = '';
      if (Math.abs(v) >= 10000) {         // 1조 이상 (값은 억원 단위)
        text = (v / 10000).toFixed(1) + '조';
      } else if (Math.abs(v) >= 100) {     // 100억 이상
        text = Math.round(v) + '억';
      }
      if (text) {
        var centerX = barX + barW / 2;
        var labelWidth = ctx.measureText(text).width;
        // 이전 라벨과 너무 가까우면 건너뜀 (겹침 방지)
        if (prevLabelX != null && Math.abs(centerX - prevLabelX) < labelWidth + 4) {
          return; // skip this label
        }
        if (v >= 0) {
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, centerX, zeroY - barH - 2);
        } else {
          ctx.textBaseline = 'top';
          ctx.fillText(text, centerX, zeroY + barH + 2);
        }
        prevLabelX = centerX;
      }
    });
  }

  // ── 분기 라벨 (x축 하단) ──
  ctx.font = "10px 'Pretendard', sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const maxLabels = 6;
  const step = values.length <= maxLabels ? 1 : Math.ceil(values.length / maxLabels);

  if (metric === 'eps') {
    values.forEach((v, i) => {
      if (i % step !== 0 && i !== values.length - 1) return;
      const x = (i / Math.max(values.length - 1, 1)) * w;
      ctx.fillText(labels[i] || '', x, chartH + 2);
    });
  } else {
    const barCount = values.length;
    const gap = 3;
    const barW = Math.max(4, (w - gap * (barCount + 1)) / barCount);
    values.forEach((v, i) => {
      if (i % step !== 0 && i !== values.length - 1) return;
      const x = gap + i * (barW + gap) + barW / 2;
      ctx.fillText(labels[i] || '', x, chartH + 2);
    });
  }
}

// ══════════════════════════════════════════════════════
//  업종 비교 (P1 — FnGuide 스타일 3열 비교 테이블)
// ══════════════════════════════════════════════════════

/**
 * 퍼센트 문자열 파싱: "14.1%" → 14.1, 숫자 → 그대로
 */
function _parsePercent(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  var s = String(val).replace('%', '').trim();
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * 업종 비교 테이블 렌더링
 * 현재 종목의 ROE/OPM을 업종 평균, 시장 평균과 비교
 */
function _renderSectorComparison() {
  var container = document.getElementById('fin-compare');
  if (!container) return;

  // 전역 변수 존재 여부 확인
  if (typeof currentStock === 'undefined' || !currentStock ||
      typeof ALL_STOCKS === 'undefined' ||
      typeof _sectorData === 'undefined' || !_sectorData) {
    container.innerHTML = '<div class="fin-compare-placeholder">업종 데이터 없음</div>';
    return;
  }

  // 현재 종목의 섹터 찾기
  var stockInfo = ALL_STOCKS.find(function(s) { return s.code === currentStock.code; });
  var sectorName = stockInfo ? (stockInfo.sector || '') : '';

  if (!sectorName || !_sectorData.sectors || !_sectorData.sectors[sectorName]) {
    container.innerHTML = '<div class="fin-compare-placeholder">업종 데이터 없음</div>';
    return;
  }

  var sectorAvg = _sectorData.sectors[sectorName];
  var marketAvg = (currentStock.market === 'KOSDAQ')
    ? (_sectorData.kosdaqAvg || {})
    : (_sectorData.kospiAvg || {});

  // 현재 종목의 ROE/OPM (updateFinancials에서 캐시된 값)
  var myRoe = _latestFinRoe;
  var myOpm = _latestFinOpm;

  // FnGuide 스타일 3열 비교 테이블
  var html = '<div class="fin-compare-header">' +
    '<span class="fin-compare-sector">' + sectorName + '</span>' +
    '<span class="fin-compare-count">' + (sectorAvg.count || 0) + '개 종목</span>' +
  '</div>';

  html += '<table class="fin-compare-table">' +
    '<thead><tr>' +
      '<th></th><th>기업</th><th>업종평균</th><th>' + (currentStock.market || 'KOSPI') + '</th>' +
    '</tr></thead><tbody>';

  // ROE 비교 (높을수록 양호)
  html += _compareRow('ROE', myRoe, sectorAvg.avgRoe, marketAvg.roe, '%', true);

  // OPM 비교 (높을수록 양호)
  html += _compareRow('영업이익률', myOpm, sectorAvg.avgOpm, marketAvg.opm, '%', true);

  html += '</tbody></table>';

  container.innerHTML = html;
}

/**
 * 비교 테이블 행 생성
 * @param {string} label - 지표명
 * @param {number} myVal - 기업 값
 * @param {number} sectorVal - 업종 평균
 * @param {number} marketVal - 시장 평균
 * @param {string} unit - 단위 (%, 배 등)
 * @param {boolean} higherIsBetter - true면 높을수록 양호
 */
function _compareRow(label, myVal, sectorVal, marketVal, unit, higherIsBetter) {
  var fmt = function(v) {
    if (v == null || v === 0) return '-';
    return (typeof v === 'number') ? v.toFixed(1) + unit : String(v);
  };

  // 색상: 기업이 업종평균보다 좋으면 초록, 나쁘면 톤다운 빨강
  var myClass = '';
  if (myVal && sectorVal && sectorVal > 0) {
    if (higherIsBetter) {
      myClass = myVal >= sectorVal ? 'fin-cmp-good' : 'fin-cmp-bad';
    } else {
      myClass = myVal <= sectorVal ? 'fin-cmp-good' : 'fin-cmp-bad';
    }
  }

  return '<tr>' +
    '<td class="fin-cmp-label">' + label + '</td>' +
    '<td class="fin-cmp-val ' + myClass + '">' + fmt(myVal) + '</td>' +
    '<td class="fin-cmp-val">' + fmt(sectorVal) + '</td>' +
    '<td class="fin-cmp-val">' + fmt(marketVal) + '</td>' +
  '</tr>';
}

// ══════════════════════════════════════════════════════
//  동종업종 비교 (Peer Group — FnGuide/Seeking Alpha 스타일)
// ══════════════════════════════════════════════════════

var _peerPreloading = false;

/**
 * 퍼센트 값 포맷: 0 또는 null → '-', 그 외 → '3.0%'
 */
function _fmtPct(val) {
  if (val == null || val === 0) return '-';
  return val.toFixed(1) + '%';
}

/**
 * peer 종목의 재무 데이터를 _financialCache에서 동기적으로 가져오기
 * @param {string} code - 종목코드
 * @returns {{roe: number, opm: number, debtRatio: number}}
 */
function _getPeerFinancials(code) {
  var result = { roe: 0, opm: 0, debtRatio: 0 };

  try {
    // data.js의 _financialCache는 전역 const — 직접 접근 가능
    if (typeof _financialCache !== 'undefined' && _financialCache[code]) {
      var cached = _financialCache[code];
      // [CLEAN-DATA] seed 생성 가짜 데이터는 peer 비교에서도 표시하지 않음
      if (cached.source !== 'dart' && cached.source !== 'hardcoded') return result;
      var q = cached.quarterly || [];
      if (q.length > 0) {
        var latest = q[0]; // 최신순 정렬 (getFinancialData에서 sort)
        result.roe = typeof latest.roe === 'number' ? latest.roe : _parsePercent(latest.roe);
        result.opm = _parsePercent(latest.opm);
        result.debtRatio = latest.debt_ratio != null ? parseFloat(latest.debt_ratio) : 0;
      }
    }
  } catch (e) {
    console.debug('[PeerGroup] 재무 데이터 접근 실패:', code, e.message);
  }

  return result;
}

/**
 * peer 종목의 재무 데이터 비동기 프리로드
 * getFinancialData()는 내부적으로 _financialCache에 저장하므로
 * 프리로드 후 _renderPeerGroup() 재호출 시 캐시에서 즉시 사용 가능.
 * @param {Array} peers - ALL_STOCKS 항목 배열
 */
async function _preloadPeerFinancials(peers) {
  var loaded = 0;
  for (var i = 0; i < peers.length; i++) {
    if (typeof _financialCache !== 'undefined' && _financialCache[peers[i].code]) continue;
    if (typeof getFinancialData === 'function') {
      try {
        await getFinancialData(peers[i].code, 'quarter');
        loaded++;
      } catch (e) {
        // 개별 종목 실패는 무시 — 테이블에 '-'로 표시
      }
    }
  }
  // 프리로드 후 테이블 재렌더링
  if (loaded > 0) _renderPeerGroup();
}

/**
 * 동종업종 비교 테이블 렌더링
 * 현재 종목과 같은 업종(sector)의 시총 상위 5개 종목 비교.
 * 종목명 클릭 시 해당 종목으로 전환.
 */
function _renderPeerGroup() {
  var container = document.getElementById('fin-peers');
  if (!container) return;

  if (typeof currentStock === 'undefined' || !currentStock ||
      typeof ALL_STOCKS === 'undefined') {
    container.innerHTML = '<div class="fin-compare-placeholder">데이터 없음</div>';
    return;
  }

  // 현재 종목의 업종 찾기
  var myStock = ALL_STOCKS.find(function(s) { return s.code === currentStock.code; });
  var mySector = myStock ? (myStock.sector || '') : '';

  if (!mySector) {
    container.innerHTML = '<div class="fin-compare-placeholder">업종 정보 없음</div>';
    return;
  }

  // 같은 업종 종목 필터 → 시총 내림차순 → 상위 4개
  var peers = ALL_STOCKS
    .filter(function(s) { return s.sector === mySector && s.code !== currentStock.code; })
    .sort(function(a, b) { return (b.marketCap || 0) - (a.marketCap || 0); })
    .slice(0, 4);  // 현재 종목 + 4개 = 총 5개

  // 현재 종목을 맨 앞에 추가
  peers.unshift(myStock);

  // 재무 데이터 프리로드 필요 여부 확인
  var needsPreload = peers.some(function(p) {
    return typeof _financialCache === 'undefined' || !_financialCache[p.code];
  });
  if (needsPreload && !_peerPreloading) {
    _peerPreloading = true;
    _preloadPeerFinancials(peers).then(function() { _peerPreloading = false; });
  }

  // 테이블 생성 — 현재 캐시된 데이터로 렌더링
  var html = '<table class="fin-peer-table"><thead><tr>' +
    '<th class="fin-peer-name">종목</th>' +
    '<th>ROE</th><th>OPM</th><th>부채</th><th>시총</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < peers.length; i++) {
    var p = peers[i];
    var isCurrent = (p.code === currentStock.code);
    var rowClass = isCurrent ? ' class="fin-peer-current"' : '';
    var prefix = isCurrent ? '\u25B8' : '';  // ▸

    // 재무 데이터 (캐시 또는 빈 값)
    var finData = _getPeerFinancials(p.code);

    // 시총 포맷 (억원 → 조/억 표시)
    var mcap = p.marketCap || 0;
    var mcapText = '-';
    if (mcap >= 10000) {
      mcapText = Math.round(mcap / 10000).toLocaleString() + '조';
    } else if (mcap > 0) {
      mcapText = mcap.toLocaleString() + '억';
    }

    // 종목명: 현재 종목은 강조, 나머지는 클릭 가능
    var nameHtml = isCurrent
      ? '<span class="fin-peer-me">' + prefix + p.name + '</span>'
      : '<a class="fin-peer-link" data-code="' + p.code + '">' + p.name + '</a>';

    html += '<tr' + rowClass + '>' +
      '<td class="fin-peer-name">' + nameHtml + '</td>' +
      '<td class="fin-peer-val">' + _fmtPct(finData.roe) + '</td>' +
      '<td class="fin-peer-val">' + _fmtPct(finData.opm) + '</td>' +
      '<td class="fin-peer-val">' + _fmtPct(finData.debtRatio) + '</td>' +
      '<td class="fin-peer-val fin-peer-mcap">' + mcapText + '</td>' +
    '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;

  // 종목 클릭 이벤트 — innerHTML 교체 시 기존 리스너 자동 제거되므로 중복 없음
  container.onclick = function(e) {
    var link = e.target.closest('.fin-peer-link');
    if (link && typeof selectStock === 'function') {
      selectStock(link.dataset.code);
    }
  };
}

// ══════════════════════════════════════════════════════
//  PER 밴드 차트 (FnGuide/Bloomberg 스타일)
//
//  과거 주가 위에 PER 배수 라인(8x, 12x, 16x, 20x)을
//  오버레이하여 현재 밸류에이션 구간 시각화.
//
//  데이터: dataService.cache 일봉 종가 + _financialCache EPS
// ══════════════════════════════════════════════════════

/**
 * 최근 EPS 추출 (연환산)
 * 우선순위:
 *   1. _financialCache quarterly 최신 분기의 eps 필드
 *   2. 순이익(ni) / 발행주식수 추정 × 4 (연환산)
 * @returns {number} 연환산 EPS (원). 산출 불가 시 0
 */
function _getLatestEPS() {
  if (!currentStock) return 0;

  if (typeof _financialCache !== 'undefined' && _financialCache[currentStock.code]) {
    var data = _financialCache[currentStock.code];
    // [CLEAN-DATA] seed 생성 가짜 데이터의 EPS는 사용하지 않음
    if (data.source !== 'dart' && data.source !== 'hardcoded') return 0;
    var q = data.quarterly || [];
    if (q.length > 0) {
      var latest = q[0]; // 최신순 정렬 (getFinancialData에서 sort)

      // 1순위: eps 필드 직접 사용 (연환산 × 4)
      if (latest.eps && Number(latest.eps) > 0) {
        // 분기 EPS → 연환산 (최근 4분기 합산 시도)
        if (q.length >= 4) {
          var sum = 0;
          for (var i = 0; i < 4; i++) sum += Number(q[i].eps) || 0;
          if (sum > 0) return sum;
        }
        return Number(latest.eps) * 4;
      }

      // 2순위: 순이익 / 발행주식수 추정
      var ni = Number(latest.ni) || 0;
      if (ni > 0 && typeof ALL_STOCKS !== 'undefined') {
        var stockInfo = ALL_STOCKS.find(function(s) { return s.code === currentStock.code; });
        if (stockInfo && stockInfo.base > 0 && stockInfo.marketCap > 0) {
          // marketCap(억원) → 원, / base(원) = 주식수
          var stockCount = (stockInfo.marketCap * 100000000) / stockInfo.base;
          if (stockCount > 0) {
            // ni(억원) → 원, / 주식수 = 분기 EPS → × 4 연환산
            return (ni * 100000000 / stockCount) * 4;
          }
        }
      }
    }
  }
  return 0;
}

/**
 * PER 밴드 차트 렌더링
 * Canvas에 주가 라인 + PER 배수(8x/12x/16x/20x) 수평 밴드 라인을 그린다.
 */
var _perBandRetries = 0;  // 재시도 횟수 제한용

function _drawPERBandChart() {
  var canvas = document.getElementById('fin-per-band');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;

  // [FIX] 캔버스 크기 동적 계산 — 패널 미표시/레이아웃 전 안전 처리
  var rawW = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  if (rawW <= 0) {
    // 패널이 아직 레이아웃되지 않음 — 최대 5회 재시도 (50ms 간격)
    if (_perBandRetries < 5) {
      _perBandRetries++;
      setTimeout(_drawPERBandChart, 50);
    }
    return;
  }
  _perBandRetries = 0;  // 성공 시 카운터 리셋
  var parentW = Math.max(rawW - 8, 100);  // 최소 100px 보장
  var h = Math.max(80, Math.min(120, Math.round(parentW * 0.40)));
  canvas.width = parentW * dpr;
  canvas.height = h * dpr;
  canvas.style.width = parentW + 'px';
  canvas.style.height = h + 'px';
  // [FIX] setTransform으로 변환 행렬 초기화 후 재스케일 (DPR 누적 방지)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  // 데이터: 일봉 캔들에서 종가 추출
  if (!currentStock || typeof dataService === 'undefined') return;
  var cacheKey = currentStock.code + '-1d';
  var cached = dataService.cache[cacheKey];
  if (!cached || !cached.candles || cached.candles.length < 10) return;

  var candles_data = cached.candles;
  var closes = candles_data.map(function(c) { return c.close; });

  // EPS 추출 (재무 데이터에서)
  var eps = _getLatestEPS();
  if (!eps || eps <= 0) {
    ctx.fillStyle = '#808080';
    ctx.font = "11px 'Pretendard', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EPS 데이터 없음', parentW / 2, h / 2);
    return;
  }

  // PER 배수 라인 정의 (저평가→고평가)
  var bands = [
    { per: 8,  color: 'rgba(80,134,220,0.5)',  label: '8x' },   // 파랑 (저평가)
    { per: 12, color: 'rgba(107,203,119,0.5)',  label: '12x' },  // 초록
    { per: 16, color: 'rgba(160,136,48,0.5)',   label: '16x' },  // 금색
    { per: 20, color: 'rgba(224,80,80,0.5)',    label: '20x' },  // 빨강 (고평가)
  ];

  // 가격 범위 계산 (주가 + 모든 밴드 포함)
  var allPrices = closes.slice();
  bands.forEach(function(b) { allPrices.push(eps * b.per); });
  var minP = Math.min.apply(null, allPrices) * 0.95;
  var maxP = Math.max.apply(null, allPrices) * 1.05;
  var rangeP = maxP - minP;
  if (rangeP <= 0) return;

  var padL = 8, padR = 30, padT = 8, padB = 16;
  var chartW = parentW - padL - padR;
  var chartH = h - padT - padB;

  var toX = function(i) { return padL + (i / (closes.length - 1)) * chartW; };
  var toY = function(p) { return padT + (1 - (p - minP) / rangeP) * chartH; };

  // ── 1) 밴드 사이 영역 채우기 (반투명 그라디언트) ──
  for (var bi = 0; bi < bands.length - 1; bi++) {
    var yTop = toY(eps * bands[bi + 1].per);
    var yBot = toY(eps * bands[bi].per);
    ctx.fillStyle = bands[bi].color.replace('0.5', '0.06');
    ctx.fillRect(padL, yTop, chartW, yBot - yTop);
  }

  // ── 2) PER 밴드 점선 ──
  bands.forEach(function(b) {
    var bandPrice = eps * b.per;
    var y = toY(bandPrice);

    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 라벨 (우측)
    ctx.fillStyle = b.color.replace('0.5', '0.9');
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, padL + chartW + 3, y);
  });

  // ── 3) 주가 라인 (그라디언트 영역 + 실선) ──
  // 영역 채우기
  ctx.beginPath();
  for (var i = 0; i < closes.length; i++) {
    var x = toX(i);
    var y = toY(closes[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(toX(closes.length - 1), padT + chartH);
  ctx.lineTo(toX(0), padT + chartH);
  ctx.closePath();
  var grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(232,232,232,0.12)');
  grad.addColorStop(1, 'rgba(232,232,232,0.01)');
  ctx.fillStyle = grad;
  ctx.fill();

  // 실선
  ctx.strokeStyle = '#E8E8E8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (var j = 0; j < closes.length; j++) {
    var px = toX(j);
    var py = toY(closes[j]);
    if (j === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // ── 4) 현재가 점 ──
  var lastX = toX(closes.length - 1);
  var lastY = toY(closes[closes.length - 1]);
  ctx.fillStyle = '#E8E8E8';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fill();

  // ── 5) 현재 PER 표시 ──
  var currentPER = closes[closes.length - 1] / eps;
  ctx.fillStyle = KRX_COLORS.ACCENT;
  ctx.font = "10px 'Pretendard', sans-serif";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('현재 ' + currentPER.toFixed(1) + 'x', padL + chartW - 2, padT + 2);
}
