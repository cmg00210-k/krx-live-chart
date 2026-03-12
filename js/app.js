// ══════════════════════════════════════════════════════
//  KRX LIVE — 앱 상태 관리 & UI 이벤트
// ══════════════════════════════════════════════════════

// ── 상태 ──
let currentStock = ALL_STOCKS[0];
let currentTimeframe = '1m';
let currentPeriod = 'quarter';
let currentMarket = 'all';
let activeIndicators = new Set();
let chartType = 'candle';
let patternEnabled = false;
let detectedPatterns = [];
let candles = [];
let tickTimer = null;
let _lastPatternAnalysis = 0;

// ══════════════════════════════════════════════════════
//  초기화
// ══════════════════════════════════════════════════════

async function init() {
  buildWatchlist();
  renderPastTable();

  // 차트 생성
  const mainContainer = document.getElementById('main-chart-container');
  chartManager.createMainChart(mainContainer);

  // 데이터 로드
  candles = await dataService.getCandles(currentStock, currentTimeframe);
  updateChartFull();
  updateStockInfo();
  updateTicker();

  // 실시간 틱 시작
  startTick();
}

function startTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    const updated = dataService.tick(currentStock, currentTimeframe);
    if (updated) {
      candles = updated;
      updateChartFull();
      updateStockInfo();
      updateTicker();
      updateWatchlistPrices();
    }
  }, 800);
}

// ── 전체 차트 업데이트 (지표 + 패턴) ──
function updateChartFull() {
  // 패턴 분석 (3초마다 최대 1회 실행 — 성능 최적화)
  const now = Date.now();
  if (patternEnabled && now - _lastPatternAnalysis > 3000) {
    detectedPatterns = patternEngine.analyze(candles);
    renderPatternPanel(detectedPatterns);
    _lastPatternAnalysis = now;
  } else if (!patternEnabled) {
    detectedPatterns = [];
  }

  chartManager.updateMain(candles, chartType, activeIndicators, detectedPatterns);

  // ── RSI 서브차트 ──
  if (activeIndicators.has('rsi')) {
    const rsiContainer = document.getElementById('rsi-chart-container');
    const rsiLabel = document.getElementById('rsi-label');
    rsiContainer.style.display = 'block';
    if (rsiLabel) rsiLabel.style.display = 'block';
    if (!chartManager.rsiChart) {
      chartManager.createRSIChart(rsiContainer);
    }
    chartManager.updateRSI(candles);
  } else {
    document.getElementById('rsi-chart-container').style.display = 'none';
    const rsiLabel = document.getElementById('rsi-label');
    if (rsiLabel) rsiLabel.style.display = 'none';
    chartManager.destroyRSI();
  }

  // ── MACD 서브차트 ──
  if (activeIndicators.has('macd')) {
    const macdContainer = document.getElementById('macd-chart-container');
    const macdLabel = document.getElementById('macd-label');
    macdContainer.style.display = 'block';
    if (macdLabel) macdLabel.style.display = 'block';
    if (!chartManager.macdChart) {
      chartManager.createMACDChart(macdContainer);
    }
    chartManager.updateMACD(candles);
  } else {
    document.getElementById('macd-chart-container').style.display = 'none';
    const macdLabel = document.getElementById('macd-label');
    if (macdLabel) macdLabel.style.display = 'none';
    chartManager.destroyMACD();
  }
}

// ══════════════════════════════════════════════════════
//  종목 선택 & 검색
// ══════════════════════════════════════════════════════

async function selectStock(code) {
  currentStock = ALL_STOCKS.find(s => s.code === code);
  if (!currentStock) return;

  document.querySelectorAll('.wl-item').forEach(el => {
    el.classList.toggle('active', el.dataset.code === code);
  });

  // 차트 재생성
  chartManager.destroyAll();
  const mainContainer = document.getElementById('main-chart-container');
  chartManager.createMainChart(mainContainer);

  candles = await dataService.getCandles(currentStock, currentTimeframe);
  _lastPatternAnalysis = 0; // 종목 변경 시 패턴 즉시 재분석
  updateChartFull();
  updateStockInfo();
  renderPastTable();
}

// ══════════════════════════════════════════════════════
//  관심종목 (워치리스트)
// ══════════════════════════════════════════════════════

function buildWatchlist() {
  const stocks = dataService.getStocks(currentMarket).slice(0, 20);
  const el = document.getElementById('watchlist');

  el.innerHTML = stocks.map(s => `
    <div class="wl-item ${s.code === currentStock.code ? 'active' : ''}" data-code="${s.code}">
      <span class="wl-name">${s.name}</span>
      <span class="wl-price" id="wl-${s.code}">—</span>
    </div>`).join('');

  el.querySelectorAll('.wl-item').forEach(item => {
    item.addEventListener('click', () => selectStock(item.dataset.code));
  });

  updateWatchlistPrices();
}

function updateWatchlistPrices() {
  const stocks = dataService.getStocks(currentMarket).slice(0, 20);
  stocks.forEach(s => {
    const el = document.getElementById('wl-' + s.code);
    if (!el) return;

    const cached = dataService.cache[`${s.code}-${currentTimeframe}`];
    if (cached && cached.candles.length) {
      const last = cached.candles[cached.candles.length - 1];
      const first = cached.candles[0];
      const change = last.close - first.open;
      el.textContent = last.close.toLocaleString();
      el.className = 'wl-price ' + (change >= 0 ? 'up' : 'dn');
    } else {
      el.textContent = s.base.toLocaleString();
      el.className = 'wl-price';
    }
  });
}

// ══════════════════════════════════════════════════════
//  종목 정보 업데이트
// ══════════════════════════════════════════════════════

function updateStockInfo() {
  if (!candles.length) return;

  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = last.close - first.open;
  const pct = ((change / first.open) * 100).toFixed(2);
  const cls = change >= 0 ? 'up' : 'dn';
  const sign = change >= 0 ? '\u25B2' : '\u25BC';

  document.getElementById('stock-name').textContent = currentStock.name;
  document.getElementById('stock-code').textContent = currentStock.code;
  document.getElementById('stock-market').textContent = currentStock.market;
  document.getElementById('stock-price').textContent = last.close.toLocaleString();
  document.getElementById('stock-price').className = cls;
  document.getElementById('stock-change').textContent =
    `${sign} ${Math.abs(change).toLocaleString()} (${change >= 0 ? '+' : ''}${pct}%)`;
  document.getElementById('stock-change').className = cls;
}

// ══════════════════════════════════════════════════════
//  시장 티커
// ══════════════════════════════════════════════════════

let kospiBase = 2680, kosdaqBase = 810, usdBase = 1325;

function updateTicker() {
  kospiBase += (Math.random() - 0.5) * 2;
  kosdaqBase += (Math.random() - 0.5) * 1;
  usdBase += (Math.random() - 0.5) * 0.5;

  document.getElementById('t-kospi').textContent = kospiBase.toFixed(1);
  document.getElementById('t-kosdaq').textContent = kosdaqBase.toFixed(1);
  document.getElementById('t-usd').textContent = usdBase.toFixed(1);
}

// ══════════════════════════════════════════════════════
//  과거 실적 테이블
// ══════════════════════════════════════════════════════

function renderPastTable() {
  const data = getPastData(currentStock.code, currentPeriod);
  const tb = document.getElementById('past-tbody');
  tb.innerHTML = data.map(r => {
    const opVal = typeof r.op === 'string' ? parseFloat(r.op) : r.op;
    const niVal = typeof r.ni === 'string' ? parseFloat(r.ni) : r.ni;
    const opCls = opVal >= 0 ? 'up' : 'dn';
    const niCls = niVal >= 0 ? 'up' : 'dn';
    return `<tr>
      <td>${r.p}</td>
      <td>${Number(r.rev).toLocaleString()}</td>
      <td class="${opCls}">${Number(r.op).toLocaleString()}</td>
      <td class="${niCls}">${Number(r.ni).toLocaleString()}</td>
      <td class="${opCls}">${r.opm}</td>
      <td>${Number(r.eps).toLocaleString()}</td>
      <td>${r.roe}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
//  패턴 분석 패널
// ══════════════════════════════════════════════════════

function renderPatternPanel(patterns) {
  const panel = document.getElementById('pattern-list');
  if (!panel) return;

  if (!patterns.length) {
    panel.innerHTML = '<div class="pattern-empty">감지된 패턴이 없습니다</div>';
    return;
  }

  panel.innerHTML = patterns.map(p => {
    const signalClass = p.signal === 'buy' ? 'buy' : p.signal === 'sell' ? 'sell' : 'neutral';
    const signalText = p.signal === 'buy' ? '매수' : p.signal === 'sell' ? '매도' : '중립';
    const strengthText = p.strength === 'strong' ? '강' : p.strength === 'medium' ? '중' : '약';
    const confBar = p.confidence != null
      ? `<span class="pattern-conf" style="color:${p.confidence >= 60 ? '#4caf50' : p.confidence >= 40 ? '#ff9800' : '#ef5350'}">${p.confidence}%</span>` : '';
    const riskInfo = (p.stopLoss || p.priceTarget)
      ? `<div class="pattern-risk">` +
        (p.stopLoss ? `<span>손절 ${p.stopLoss.toLocaleString()}</span>` : '') +
        (p.priceTarget ? `<span>목표 ${p.priceTarget.toLocaleString()}</span>` : '') +
        (p.confluence ? `<span class="confluence-badge">합류</span>` : '') +
        `</div>` : '';

    return `
      <div class="pattern-item ${signalClass}">
        <div class="pattern-header">
          <span class="pattern-name">${p.nameShort}</span>
          ${confBar}
          <span class="pattern-signal ${signalClass}">${signalText}</span>
          <span class="pattern-strength">${strengthText}</span>
        </div>
        <div class="pattern-desc">${p.description}</div>
        ${riskInfo}
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
//  검색 이벤트
// ══════════════════════════════════════════════════════

const searchInput = document.getElementById('search-input');
const dropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (!q) { dropdown.classList.remove('show'); return; }

  const matches = dataService.searchStocks(q).slice(0, 10);
  dropdown.innerHTML = matches.map(s => `
    <div class="search-item" data-code="${s.code}">
      <span>${s.name}</span>
      <span class="code">${s.code}</span>
      <span class="market-tag ${s.market.toLowerCase()}">${s.market}</span>
    </div>`).join('') || '<div class="search-item" style="color:#555e78">검색 결과 없음</div>';

  dropdown.classList.add('show');
  dropdown.querySelectorAll('.search-item[data-code]').forEach(el => {
    el.addEventListener('click', () => {
      selectStock(el.dataset.code);
      searchInput.value = '';
      dropdown.classList.remove('show');
    });
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('#search-wrap')) dropdown.classList.remove('show');
});

// ══════════════════════════════════════════════════════
//  툴바 이벤트
// ══════════════════════════════════════════════════════

// ── 차트 타입 ──
document.querySelectorAll('.ct-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ct-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartType = btn.dataset.ct;
    chartManager.destroyAll();
    chartManager.createMainChart(document.getElementById('main-chart-container'));
    updateChartFull();
  });
});

// ── 타임프레임 ──
document.querySelectorAll('.tf-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTimeframe = btn.dataset.tf;

    chartManager.destroyAll();
    chartManager.createMainChart(document.getElementById('main-chart-container'));

    candles = await dataService.getCandles(currentStock, currentTimeframe);
    _lastPatternAnalysis = 0;
    updateChartFull();
    startTick();
  });
});

// ── 지표 토글 (패턴 버튼 제외) ──
document.querySelectorAll('.ind-btn:not(.pattern-btn)').forEach(btn => {
  btn.addEventListener('click', () => {
    const ind = btn.dataset.ind;
    if (activeIndicators.has(ind)) {
      activeIndicators.delete(ind);
      btn.classList.remove('active');
    } else {
      activeIndicators.add(ind);
      btn.classList.add('active');
    }
    updateChartFull();
  });
});

// ── 패턴 토글 (별도 핸들러) ──
const patternBtn = document.getElementById('pattern-toggle');
if (patternBtn) {
  patternBtn.addEventListener('click', () => {
    patternEnabled = !patternEnabled;
    patternBtn.classList.toggle('active', patternEnabled);
    document.getElementById('right-panel').classList.toggle('pattern-active', patternEnabled);

    if (!patternEnabled) {
      detectedPatterns = [];
      renderPatternPanel([]);
    } else {
      _lastPatternAnalysis = 0; // 즉시 분석
    }
    updateChartFull();
  });
}

// ── 시장 필터 ──
document.querySelectorAll('.market-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMarket = btn.dataset.market;
    buildWatchlist();
  });
});

// ── 실적 기간 ──
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.p;
    renderPastTable();
  });
});

// ══════════════════════════════════════════════════════
//  시작
// ══════════════════════════════════════════════════════
init();
