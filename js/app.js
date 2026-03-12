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
  destroyAllCharts();
  updateChart();
  renderPastTable();
  renderPatternPanel();
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
    destroyAllCharts();
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
    destroyAllCharts();
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

// ── 패턴 감지 ──
function detectPatterns(hist, closes) {
  const patterns = [];
  const n = hist.length;
  if (n < 3) return patterns;

  const last = hist[n - 1];
  const prev = hist[n - 2];

  const body = Math.abs(last.c - last.o);
  const range = last.h - last.l;
  const upperWick = last.h - Math.max(last.o, last.c);
  const lowerWick = Math.min(last.o, last.c) - last.l;

  // 도지
  if (range > 0 && body / range < 0.1) {
    patterns.push({
      name: '도지 (Doji)', signal: 'neutral', strength: '중',
      conf: Math.round(68 + Math.random() * 12),
      desc: '몸통이 거의 없어 매수·매도 세력이 균형을 이룹니다.',
      entry: null, stop: null, target: null
    });
  }

  // 망치형
  if (body > 0 && lowerWick >= body * 2 && upperWick <= body * 0.5) {
    const ratio = (lowerWick / body).toFixed(1);
    patterns.push({
      name: '망치형 (Hammer)', signal: 'buy', strength: lowerWick > body * 3 ? '강' : '중',
      conf: Math.min(Math.round(75 + Math.min(lowerWick / body * 3, 18)), 95),
      desc: `아래 꼬리가 몸통의 ${ratio}배로 강한 지지를 시사합니다.`,
      entry: last.c,
      stop: Math.round(last.l * 0.998),
      target: Math.round(last.c + (last.c - last.l) * 2)
    });
  }

  // 유성형 (Shooting Star)
  if (body > 0 && upperWick >= body * 2 && lowerWick <= body * 0.5) {
    const ratio = (upperWick / body).toFixed(1);
    patterns.push({
      name: '유성형 (Shooting Star)', signal: 'sell', strength: upperWick > body * 3 ? '강' : '중',
      conf: Math.min(Math.round(73 + Math.min(upperWick / body * 3, 17)), 93),
      desc: `위 꼬리가 몸통의 ${ratio}배로 강한 저항을 시사합니다.`,
      entry: last.c,
      stop: Math.round(last.h * 1.002),
      target: Math.round(last.c - (last.h - last.c) * 2)
    });
  }

  // 강세 장악형
  if (prev.c < prev.o && last.c > last.o && last.o < prev.c && last.c > prev.o) {
    patterns.push({
      name: '강세 장악형', signal: 'buy', strength: '강',
      conf: Math.round(78 + Math.random() * 10),
      desc: '양봉이 전 음봉을 완전히 포함, 매수 전환 신호입니다.',
      entry: last.c,
      stop: Math.round(last.o * 0.997),
      target: Math.round(last.c + (last.c - last.o) * 2)
    });
  }

  // 약세 장악형
  if (prev.c > prev.o && last.c < last.o && last.o > prev.c && last.c < prev.o) {
    patterns.push({
      name: '약세 장악형', signal: 'sell', strength: '강',
      conf: Math.round(78 + Math.random() * 10),
      desc: '음봉이 전 양봉을 완전히 포함, 매도 전환 신호입니다.',
      entry: last.c,
      stop: Math.round(last.o * 1.003),
      target: Math.round(last.c - (last.o - last.c) * 2)
    });
  }

  // RSI 신호
  const rsiVals = calcRSI(closes, 14);
  const rsi = rsiVals[n - 1];
  if (rsi !== null) {
    if (rsi < 30) {
      patterns.push({
        name: `RSI 과매도 (${rsi.toFixed(1)})`, signal: 'buy', strength: rsi < 20 ? '강' : '중',
        conf: Math.round(80 - rsi),
        desc: `RSI ${rsi.toFixed(1)}로 과매도 구간, 기술적 반등 가능성이 있습니다.`,
        entry: null, stop: null, target: null
      });
    } else if (rsi > 70) {
      patterns.push({
        name: `RSI 과매수 (${rsi.toFixed(1)})`, signal: 'sell', strength: rsi > 80 ? '강' : '중',
        conf: Math.round(rsi - 20),
        desc: `RSI ${rsi.toFixed(1)}로 과매수 구간, 조정 가능성이 있습니다.`,
        entry: null, stop: null, target: null
      });
    }
  }

  // MACD 크로스
  const { macdLine, signalLine } = calcMACD(closes);
  const mCurr = macdLine[n - 1], mPrev = macdLine[n - 2];
  const sCurr = signalLine[n - 1], sPrev = signalLine[n - 2];
  if (mCurr !== null && mPrev !== null && sCurr !== null && sPrev !== null) {
    if (mPrev < sPrev && mCurr > sCurr) {
      patterns.push({
        name: 'MACD 골든크로스', signal: 'buy', strength: '중',
        conf: Math.round(72 + Math.random() * 10),
        desc: 'MACD선이 시그널선을 상향 돌파, 상승 모멘텀 신호입니다.',
        entry: null, stop: null, target: null
      });
    } else if (mPrev > sPrev && mCurr < sCurr) {
      patterns.push({
        name: 'MACD 데드크로스', signal: 'sell', strength: '중',
        conf: Math.round(72 + Math.random() * 10),
        desc: 'MACD선이 시그널선을 하향 돌파, 하락 모멘텀 신호입니다.',
        entry: null, stop: null, target: null
      });
    }
  }

  return patterns;
}

function renderPatternPanel() {
  const list = document.getElementById('pattern-list');
  if (!list) return;

  const hist = prices[currentStock.code].history;
  const closes = hist.map(h => h.c);
  const patterns = detectPatterns(hist, closes);

  if (patterns.length === 0) {
    list.innerHTML = '<div class="pattern-empty">감지된 패턴 없음</div>';
    return;
  }

  list.innerHTML = patterns.map(p => `
    <div class="pattern-item ${p.signal}">
      <div class="pattern-header">
        <span class="pattern-name">${p.name}</span>
        <span class="pattern-strength">${p.strength}</span>
      </div>
      <div class="pattern-desc">${p.desc}</div>
    </div>`).join('');
}

// ── 초기화 ──
buildWatchlist();
updateStockInfo();
updateTicker();
updateChart();
renderPastTable();
renderPatternPanel();
setInterval(tickPrices, 800);
setInterval(renderPatternPanel, 5000);
