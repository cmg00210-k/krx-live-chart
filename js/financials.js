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

// ══════════════════════════════════════════════════════
//  재무지표 패널 (우측 탭)
// ══════════════════════════════════════════════════════

async function updateFinancials() {
  var data;
  try {
    data = await getFinancialData(currentStock.code, 'quarter');
  } catch (e) {
    console.error('[KRX] 재무 데이터 로드 실패:', e);
    showToast(currentStock.name + ' 재무 데이터 로드 실패', 'error');
    return;
  }
  if (!data.length) return;
  const latest = data[0];

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  const setClass = (id, cls) => { const el = document.getElementById(id); if (el) el.className = cls; };

  // 기간 표시
  set('fin-period', latest.p || '—');

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
  set('fin-eps', Number(latest.eps).toLocaleString() + '원');
  setClass('fin-eps', 'fin-grid-value' + (Number(latest.eps) < 0 ? ' dn' : ''));
  const roeNum = parseFloat(latest.roe);
  set('fin-roe', isNaN(roeNum) ? '—' : roeNum.toFixed(1) + '%');
  setClass('fin-roe', 'fin-grid-value' + (!isNaN(roeNum) && roeNum < 0 ? ' dn' : ''));
  // BPS: 자본총계/발행주식수 (DART 데이터에 있으면 표시)
  const bps = latest.bps || '—';
  set('fin-bps', typeof bps === 'number' ? bps.toLocaleString() + '원' : bps);
  setClass('fin-bps', 'fin-grid-value' + (typeof bps === 'number' && bps < 0 ? ' dn' : ''));

  // ── Phase 1: ROA, 부채비율, NPM ──
  const rev = Number(latest.rev) || 0;
  const ni = Number(latest.ni) || 0;

  // NPM (순이익률): data.js toDisplay()에서 이미 계산, 또는 여기서 폴백
  let npmVal = null;
  if (latest.npm != null) {
    npmVal = latest.npm;
  } else if (rev !== 0) {
    npmVal = +(ni / rev * 100).toFixed(1);
  }
  if (npmVal != null) {
    set('fin-npm', npmVal.toFixed(1) + '%');
    setClass('fin-npm', 'fin-grid-value' + (npmVal < 0 ? ' dn' : ''));
  } else {
    set('fin-npm', '—');
  }

  // ROA: data.js toDisplay()에서 이미 계산, 또는 여기서 폴백
  let roaVal = null;
  if (latest.roa != null) {
    roaVal = latest.roa;
  } else if (latest.total_assets && Number(latest.total_assets) !== 0) {
    roaVal = +(ni / Number(latest.total_assets) * 100).toFixed(1);
  }
  if (roaVal != null) {
    set('fin-roa', roaVal.toFixed(1) + '%');
    setClass('fin-roa', 'fin-grid-value' + (roaVal < 0 ? ' dn' : ''));
  } else {
    set('fin-roa', '—');
  }

  // 부채비율: debt_ratio (DART) 또는 total_liabilities/total_equity로 계산
  let debtRatio = null;
  if (latest.debt_ratio != null) {
    debtRatio = parseFloat(latest.debt_ratio);
  } else if (latest.total_liabilities && latest.total_equity && Number(latest.total_equity) !== 0) {
    debtRatio = +(Number(latest.total_liabilities) / Number(latest.total_equity) * 100).toFixed(1);
  }
  if (debtRatio != null) {
    set('fin-debt-ratio', debtRatio.toFixed(1) + '%');
    // 부채비율: 200% 초과 = 위험(dn), 나머지 = 기본 흰색
    setClass('fin-debt-ratio', 'fin-grid-value' + (debtRatio > 200 ? ' dn' : ''));
  } else {
    set('fin-debt-ratio', '—');
  }

  // ── PER / PBR / PSR 계산 ──
  const currentPrice = candles.length ? candles[candles.length - 1].close : null;

  // 시가총액을 먼저 구함 (PER/PBR/PSR 폴백 계산에 모두 필요)
  const mcapEok = _getMarketCapEok(currentStock.code, currentPrice, latest.shares_outstanding);

  // EPS 결정: DART 직접값 → shares_outstanding 기반 계산 → 0
  let epsNum = Number(latest.eps) || 0;
  if (!epsNum && latest.shares_outstanding && ni) {
    // ni(억원) → 원 환산 후 주당 계산
    epsNum = Math.round(ni * 100000000 / latest.shares_outstanding);
  }

  // BPS 결정: DART 직접값 → shares_outstanding 기반 계산
  let bpsNum = typeof latest.bps === 'number' ? latest.bps : null;
  if (!bpsNum && latest.shares_outstanding && latest.total_equity) {
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
  let perVal = null;
  if (currentPrice && epsNum > 0) {
    perVal = +(currentPrice / epsNum).toFixed(2);
  } else if (!epsNum && mcapEok && ni > 0) {
    perVal = +(mcapEok / ni).toFixed(2);
  }
  if (perVal != null && perVal > 0) {
    set('fin-per', perVal.toFixed(1) + '배');
    setClass('fin-per', 'fin-grid-value');
  } else if (currentPrice && (epsNum <= 0 || ni <= 0)) {
    set('fin-per', '적자');
    setClass('fin-per', 'fin-grid-value');
  } else {
    set('fin-per', '—');
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
    set('fin-pbr', '—');
  }

  // PSR = 시가총액(억원) / 매출액(억원)
  let psrVal = null;
  if (mcapEok && rev > 0) {
    psrVal = +(mcapEok / rev).toFixed(2);
    set('fin-psr', psrVal.toFixed(2) + '배');
    setClass('fin-psr', 'fin-grid-value');
  } else {
    set('fin-psr', '—');
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
    set('fin-rev-cagr', '—');
    set('fin-ni-cagr', '—');
    return;
  }

  const newest = annualData[0];
  const oldest = annualData.length >= 4 ? annualData[3] : annualData[annualData.length - 1];
  const years = annualData.length >= 4 ? 3 : (annualData.length - 1);

  if (years <= 0) {
    set('fin-rev-cagr', '—');
    set('fin-ni-cagr', '—');
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
    set('fin-rev-cagr', '—');
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
    set('fin-ni-cagr', '—');
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
  let factors = 0;

  // ── 수익성 (30점) ──
  if (roe != null && !isNaN(roe)) {
    factors++;
    if (roe >= 15) score += 15;
    else if (roe >= 10) score += 12;
    else if (roe >= 5) score += 8;
    else if (roe >= 0) score += 4;
  }
  if (opm != null && !isNaN(opm)) {
    factors++;
    if (opm >= 20) score += 15;
    else if (opm >= 10) score += 12;
    else if (opm >= 5) score += 8;
    else if (opm >= 0) score += 4;
  }

  // ── 밸류에이션 (30점) ──
  if (perVal != null && perVal > 0) {
    factors++;
    if (perVal < 10) score += 15;
    else if (perVal <= 15) score += 12;
    else if (perVal <= 25) score += 8;
    else if (perVal <= 40) score += 4;
  }
  if (pbrVal != null && pbrVal > 0) {
    factors++;
    if (pbrVal < 0.7) score += 15;
    else if (pbrVal <= 1.0) score += 12;
    else if (pbrVal <= 2.0) score += 8;
    else if (pbrVal <= 3.0) score += 4;
  }

  // ── 성장성 (20점) ──
  if (annualData && annualData.length >= 2) {
    const newest = annualData[0];
    const oldest = annualData.length >= 4 ? annualData[3] : annualData[annualData.length - 1];
    const yrs = annualData.length >= 4 ? 3 : (annualData.length - 1);
    const rEnd = Number(newest.rev) || 0;
    const rStart = Number(oldest.rev) || 0;
    if (rStart > 0 && rEnd > 0 && yrs > 0) {
      factors++;
      const cagr = (Math.pow(rEnd / rStart, 1 / yrs) - 1) * 100;
      if (cagr >= 20) score += 20;
      else if (cagr >= 10) score += 16;
      else if (cagr >= 5) score += 12;
      else if (cagr >= 0) score += 6;
    }
  }

  // ── 안정성 (20점) ──
  if (debtRatio != null && !isNaN(debtRatio)) {
    factors++;
    if (debtRatio < 50) score += 20;
    else if (debtRatio <= 100) score += 16;
    else if (debtRatio <= 200) score += 10;
    else if (debtRatio <= 300) score += 4;
  }

  if (factors < 2) {
    set('fin-score', '—');
    set('fin-grade', '—');
    return;
  }

  // 비례 보정: 활성 항목 기준 최대 점수로 환산
  const maxPossible = factors <= 2 ? 30 : factors <= 4 ? 60 : 100;
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
  const setChangeClass = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'fin-change' + (val > 0 ? ' up' : val < 0 ? ' dn' : '');
  };

  const latest = data[0];
  const prevQ = data.length > 1 ? data[1] : null;   // 전분기
  const prevY = data.length > 4 ? data[4] : null;    // 전년 동기

  const calcPct = (cur, prev) => {
    if (prev == null || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev) * 100);
  };

  const fmtPct = (label, pct) => {
    if (pct == null) return label + ' —';
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

  // 하단 날짜 라벨 영역 확보 (12px)
  const labelHeight = 14;
  const w = 200, h = 36 + labelHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // 라벨을 제외한 차트 영역 높이
  const chartH = h - labelHeight;

  const values = data.map(d => parseFloat(d.opm) || 0).reverse();
  // 분기 라벨도 역순으로 (과거 → 최신)
  const labels = data.map(d => _sparklineLabel(d.p)).reverse();
  if (values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;

  // 영역 채우기
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = pad + ((max - v) / range) * (chartH - 2 * pad);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(w, chartH);
  ctx.lineTo(0, chartH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(201,168,76,0.1)';
  ctx.fill();

  // 라인
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = pad + ((max - v) / range) * (chartH - 2 * pad);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = KRX_COLORS.ACCENT;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── 분기 라벨 (x축 하단) ──
  ctx.font = '9px Pretendard, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // 라벨이 너무 많으면 간격 조절 (최대 6개 표시)
  const maxLabels = 6;
  const step = values.length <= maxLabels ? 1 : Math.ceil(values.length / maxLabels);

  values.forEach((v, i) => {
    if (i % step !== 0 && i !== values.length - 1) return;
    const x = (i / (values.length - 1)) * w;
    ctx.fillText(labels[i] || '', x, chartH + 2);
  });
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
  const w = canvas.parentElement ? canvas.parentElement.clientWidth - 8 : 190;
  const h = 70;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

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
    ctx.fillStyle = 'rgba(201,168,76,0.08)';
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
  }

  // ── 분기 라벨 (x축 하단) ──
  ctx.font = '9px Pretendard, sans-serif';
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
