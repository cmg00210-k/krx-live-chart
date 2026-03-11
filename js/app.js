// ── 앱 상태 ──
let currentStock = STOCKS[0];
let currentPeriod = 'quarter';
let activeIndicators = new Set();
let chartType = 'candle';
let prices = {};

// ── 가격 시뮬레이션 초기화 ──
STOCKS.forEach(s => {
  prices[s.code] = { price: s.base, change: 0, pct: 0, history: [] };
  let p = s.base;
  for (let i = 0; i < 60; i++) {
    const o = p;
    const c = p + Math.round((Math.random() - .48) * p * 0.003);
    const h = Math.max(o, c) + Math.round(Math.random() * p * 0.002);
    const l = Math.min(o, c) - Math.round(Math.random() * p * 0.002);
    prices[s.code].history.push({ o, h, l, c, v: Math.round(50000 + Math.random() * 200000) });
    p = c;
  }
  prices[s.code].price = p;
  prices[s.code].change = p - s.base;
  prices[s.code].pct = ((p - s.base) / s.base * 100).toFixed(2);
});

// ── 가격 틱 ──
function tickPrices() {
  STOCKS.forEach(s => {
    const d = prices[s.code];
    const last = d.history[d.history.length - 1];
    const newC = Math.max(1000, last.c + Math.round((Math.random() - .49) * last.c * 0.002));
    const newH = Math.max(last.h, newC);
    const newL = Math.min(last.l, newC);
    d.history[d.history.length - 1] = { ...last, c: newC, h: newH, l: newL, v: last.v + Math.round(Math.random() * 1000) };

    if (Math.random() < 0.1) {
      d.history.push({ o: newC, h: newC, l: newC, c: newC, v: 0 });
      if (d.history.length > 120) d.history.shift();
    }
    d.price = newC;
    d.change = newC - s.base;
    d.pct = ((newC - s.base) / s.base * 100).toFixed(2);
  });

  updateTicker();
  updateStockInfo();
  updateWatchlist();
  updateChart();
}

// ── 관심종목 ──
function buildWatchlist() {
  const el = document.getElementById('watchlist');
  el.innerHTML = STOCKS.map(s => `
    <div class="wl-item ${s.code === currentStock.code ? 'active' : ''}" data-code="${s.code}">
      <span>${s.name}</span>
      <span class="wl-price ${prices[s.code].change >= 0 ? 'up' : 'dn'}" id="wl-${s.code}">
        ${prices[s.code].price.toLocaleString()}
      </span>
    </div>`).join('');

  el.querySelectorAll('.wl-item').forEach(item => {
    item.addEventListener('click', () => selectStock(item.dataset.code));
  });
}

function updateWatchlist() {
  STOCKS.forEach(s => {
    const el = document.getElementById('wl-' + s.code);
    if (!el) return;
    el.textContent = prices[s.code].price.toLocaleString();
    el.className = 'wl-price ' + (prices[s.code].change >= 0 ? 'up' : 'dn');
  });
}

function selectStock(code) {
  currentStock = STOCKS.find(s => s.code === code);
  document.querySelectorAll('.wl-item').forEach(el => {
    el.classList.toggle('active', el.dataset.code === code);
  });
  updateStockInfo();
  chartInstance?.destroy();
  chartInstance = null;
  updateChart();
  renderPastTable();
}

// ── 종목 정보 ──
function updateStockInfo() {
  const d = prices[currentStock.code];
  const cls = d.change >= 0 ? 'up' : 'dn';
  const sign = d.change >= 0 ? '\u25B2' : '\u25BC';
  document.getElementById('stock-name').textContent = currentStock.name;
  document.getElementById('stock-price').textContent = d.price.toLocaleString();
  document.getElementById('stock-price').className = cls;
  document.getElementById('stock-change').textContent =
    `${sign} ${Math.abs(d.change).toLocaleString()} (${d.change >= 0 ? '+' : ''}${d.pct}%)`;
  document.getElementById('stock-change').className = cls;
}

// ── 시장 티커 ──
function updateTicker() {
  const kospi = 2680 + Math.round((Math.random() - .5) * 10);
  const kosdaq = 810 + Math.round((Math.random() - .5) * 5);
  const usd = 1325 + Math.round((Math.random() - .5) * 3);
  document.getElementById('t-kospi').textContent = kospi.toLocaleString();
  document.getElementById('t-kosdaq').textContent = kosdaq.toLocaleString();
  document.getElementById('t-usd').textContent = usd.toLocaleString();
}

// ── 과거 실적 테이블 ──
function renderPastTable() {
  const data = getPastData(currentStock.code, currentPeriod);
  const tb = document.getElementById('past-tbody');
  tb.innerHTML = data.map(r => {
    const opCls = parseFloat(r.op) >= 0 ? 'up' : 'dn';
    const niCls = parseFloat(r.ni) >= 0 ? 'up' : 'dn';
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

// ── 검색 ──
const searchInput = document.getElementById('search-input');
const dropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { dropdown.classList.remove('show'); return; }

  const matches = STOCKS.filter(s => s.name.includes(q) || s.code.includes(q));
  dropdown.innerHTML = matches.map(s => `
    <div class="search-item" data-code="${s.code}">
      <span>${s.name}</span><span class="code">${s.code}</span>
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

// ── 툴바 버튼 이벤트 ──
document.querySelectorAll('.ct-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ct-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartType = btn.dataset.ct;
    chartInstance?.destroy();
    chartInstance = null;
    updateChart();
  });
});

document.querySelectorAll('.ind-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const ind = btn.dataset.ind;
    if (activeIndicators.has(ind)) {
      activeIndicators.delete(ind);
      btn.classList.remove('active');
    } else {
      activeIndicators.add(ind);
      btn.classList.add('active');
    }
    chartInstance?.destroy();
    chartInstance = null;
    updateChart();
  });
});

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.p;
    renderPastTable();
  });
});

// ── 초기화 ──
buildWatchlist();
updateStockInfo();
updateTicker();
updateChart();
renderPastTable();
setInterval(tickPrices, 800);
