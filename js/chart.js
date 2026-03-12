// ══════════════════════════════════════════════════════
//  KRX LIVE — 차트 엔진 + 기술적 분석 지표
// ══════════════════════════════════════════════════════

let chartInstance = null;
let rsiChartInstance = null;
let macdChartInstance = null;

// ── 캔들스틱 위크(꼬리) 플러그인 ──────────────────────
const candlestickPlugin = {
  id: 'candlestick',
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets.find(d => d._isCandlestick);
    if (!dataset || !dataset._rawData) return;

    const meta = chart.getDatasetMeta(chart.data.datasets.indexOf(dataset));
    const ctx = chart.ctx;
    const yScale = chart.scales.y;
    const hist = dataset._rawData;

    meta.data.forEach((bar, i) => {
      const candle = hist[i];
      if (!candle) return;

      const x = bar.x;
      const highY = yScale.getPixelForValue(candle.h);
      const lowY = yScale.getPixelForValue(candle.l);

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = candle.c >= candle.o ? '#E05050' : '#5086DC';
      ctx.lineWidth = 1;
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      ctx.restore();
    });
  }
};

Chart.register(candlestickPlugin);

// ══════════════════════════════════════════════════════
//  기술적 지표 계산 함수
// ══════════════════════════════════════════════════════

/** 시간 라벨 */
function getLabels(hist) {
  const now = new Date();
  return hist.map((_, i) => {
    const d = new Date(now - (hist.length - 1 - i) * 60000);
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0');
  });
}

/** 단순 이동평균 (SMA) */
function calcMA(data, n) {
  return data.map((_, i) => {
    if (i < n - 1) return null;
    return data.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n;
  });
}

/** 지수 이동평균 (EMA) */
function calcEMA(data, n) {
  const k = 2 / (n + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/** 볼린저 밴드 (BB) */
function calcBB(closes, n = 20, mult = 2) {
  return closes.map((_, i) => {
    if (i < n - 1) return { upper: null, lower: null, mid: null };
    const sl = closes.slice(i - n + 1, i + 1);
    const mean = sl.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    return { upper: mean + mult * std, lower: mean - mult * std, mid: mean };
  });
}

/** RSI (Wilder 방식) */
function calcRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return rsi;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/** MACD (12, 26, 9) */
function calcMACD(closes, fast = 12, slow = 26, sig = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine = emaFast.map((v, i) => i < slow - 1 ? null : v - emaSlow[i]);
  const validMacd = macdLine.filter(v => v !== null);
  const signalEma = calcEMA(validMacd, sig);

  const signalLine = new Array(closes.length).fill(null);
  const histogram = new Array(closes.length).fill(null);
  let vi = 0;

  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null) {
      if (vi >= sig - 1) {
        signalLine[i] = signalEma[vi];
        histogram[i] = macdLine[i] - signalLine[i];
      }
      vi++;
    }
  }
  return { macdLine, signalLine, histogram };
}

// ══════════════════════════════════════════════════════
//  차트 렌더링
// ══════════════════════════════════════════════════════

/** 모든 차트 인스턴스 파괴 */
function destroyAllCharts() {
  chartInstance?.destroy();   chartInstance = null;
  rsiChartInstance?.destroy(); rsiChartInstance = null;
  macdChartInstance?.destroy(); macdChartInstance = null;
}

/** 서브차트 표시/숨김 */
function updateSubChartVisibility() {
  const rsiEl = document.getElementById('rsi-chart-container');
  const macdEl = document.getElementById('macd-chart-container');
  if (rsiEl) rsiEl.style.display = activeIndicators.has('rsi') ? 'block' : 'none';
  if (macdEl) macdEl.style.display = activeIndicators.has('macd') ? 'block' : 'none';
}

/** 공통 차트 옵션 */
function baseChartOptions(extraScales = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17,17,17,.97)',
        borderColor: '#2a2a2a', borderWidth: 1,
        titleColor: '#E8E8E8', bodyColor: '#E8E8E8'
      }
    },
    scales: extraScales
  };
}

/** ── 메인 차트 업데이트 ── */
function updateChart() {
  const hist = prices[currentStock.code].history;
  const labels = getLabels(hist);
  const closes = hist.map(h => h.c);

  updateSubChartVisibility();

  const datasets = [];

  // ── 가격 데이터셋 ──
  if (chartType === 'candle') {
    datasets.push({
      label: 'OHLC',
      data: hist.map(h => [Math.min(h.o, h.c), Math.max(h.o, h.c)]),
      backgroundColor: hist.map(h => h.c >= h.o ? 'rgba(224,80,80,0.9)' : 'rgba(80,134,220,0.9)'),
      borderColor: hist.map(h => h.c >= h.o ? '#E05050' : '#5086DC'),
      borderWidth: 1,
      type: 'bar',
      barPercentage: 0.6,
      categoryPercentage: 0.9,
      _isCandlestick: true,
      _rawData: hist,
      order: 1
    });
  } else if (chartType === 'bar') {
    datasets.push({
      label: 'OHLC',
      data: hist.map(h => [Math.min(h.o, h.c), Math.max(h.o, h.c)]),
      backgroundColor: hist.map(h => h.c >= h.o ? 'rgba(224,80,80,0.7)' : 'rgba(80,134,220,0.7)'),
      borderColor: hist.map(h => h.c >= h.o ? '#E05050' : '#5086DC'),
      borderWidth: 1,
      type: 'bar',
      barPercentage: 0.3,
      _isCandlestick: true,
      _rawData: hist,
      order: 1
    });
  } else {
    datasets.push({
      label: '종가',
      data: closes,
      borderColor: '#2962ff',
      backgroundColor: 'rgba(41,98,255,0.08)',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: true,
      type: 'line',
      order: 0
    });
  }

  // ── MA ──
  if (activeIndicators.has('ma')) {
    datasets.push({
      label: 'MA(5)', data: calcMA(closes, 5),
      borderColor: '#e91e63', borderWidth: 1.2,
      pointRadius: 0, tension: 0.1, type: 'line', fill: false, order: 0
    });
    datasets.push({
      label: 'MA(20)', data: calcMA(closes, 20),
      borderColor: '#ff9800', borderWidth: 1.2,
      pointRadius: 0, tension: 0.1, type: 'line', fill: false, order: 0
    });
    datasets.push({
      label: 'MA(60)', data: calcMA(closes, 60),
      borderColor: '#4caf50', borderWidth: 1.2,
      pointRadius: 0, tension: 0.1, type: 'line', fill: false, order: 0
    });
  }

  // ── EMA ──
  if (activeIndicators.has('ema')) {
    datasets.push({
      label: 'EMA(12)', data: calcEMA(closes, 12),
      borderColor: '#00bcd4', borderWidth: 1.2,
      pointRadius: 0, tension: 0.1, type: 'line', fill: false, order: 0
    });
    datasets.push({
      label: 'EMA(26)', data: calcEMA(closes, 26),
      borderColor: '#8bc34a', borderWidth: 1.2,
      pointRadius: 0, tension: 0.1, type: 'line', fill: false, order: 0
    });
  }

  // ── 볼린저 밴드 ──
  if (activeIndicators.has('bb')) {
    const bb = calcBB(closes);
    datasets.push({
      label: 'BB상단', data: bb.map(b => b.upper),
      borderColor: 'rgba(156,39,176,.7)', borderWidth: 1,
      pointRadius: 0, type: 'line', fill: false, borderDash: [4, 2], order: 0
    });
    datasets.push({
      label: 'BB중간', data: bb.map(b => b.mid),
      borderColor: 'rgba(156,39,176,.4)', borderWidth: 1,
      pointRadius: 0, type: 'line', fill: false, borderDash: [2, 2], order: 0
    });
    datasets.push({
      label: 'BB하단', data: bb.map(b => b.lower),
      borderColor: 'rgba(156,39,176,.7)', borderWidth: 1,
      pointRadius: 0, type: 'line', fill: false, borderDash: [4, 2], order: 0
    });
  }

  // ── 거래량 (상승=초록, 하락=빨강) ──
  if (activeIndicators.has('vol')) {
    datasets.push({
      label: '거래량', data: hist.map(h => h.v),
      backgroundColor: hist.map(h => h.c >= h.o ? 'rgba(224,80,80,0.3)' : 'rgba(80,134,220,0.3)'),
      borderColor: 'transparent',
      type: 'bar', yAxisID: 'yVol', order: 10
    });
  }

  // ── Y축: high/low 범위 보장 ──
  const allHighs = hist.map(h => h.h);
  const allLows = hist.map(h => h.l);
  const yMin = Math.min(...allLows) * 0.999;
  const yMax = Math.max(...allHighs) * 1.001;

  const scales = {
    x: {
      grid: { color: 'rgba(255,255,255,.04)' },
      ticks: { color: '#888888', maxTicksLimit: 10, font: { size: 10 } }
    },
    y: {
      position: 'right',
      min: yMin, max: yMax,
      grid: { color: 'rgba(255,255,255,.04)' },
      ticks: { color: '#888888', font: { size: 10 }, callback: v => v.toLocaleString() }
    }
  };

  if (activeIndicators.has('vol')) {
    scales.yVol = {
      position: 'left',
      grid: { display: false },
      ticks: { display: false },
      max: Math.max(...hist.map(h => h.v)) * 4
    };
  }

  // 툴팁 커스텀
  const tooltipCallbacks = {
    label: ctx => {
      if (ctx.dataset._isCandlestick) {
        const h = ctx.dataset._rawData[ctx.dataIndex];
        return `O ${h.o.toLocaleString()}  H ${h.h.toLocaleString()}  L ${h.l.toLocaleString()}  C ${h.c.toLocaleString()}`;
      }
      if (ctx.dataset.yAxisID === 'yVol') {
        return `거래량: ${Number(ctx.parsed.y).toLocaleString()}`;
      }
      return `${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString()}`;
    }
  };

  if (chartInstance) {
    chartInstance.data = { labels, datasets };
    chartInstance.options.scales = scales;
    chartInstance.update('none');
  } else {
    const ctx = document.getElementById('mainChart').getContext('2d');
    const opts = baseChartOptions(scales);
    opts.plugins.tooltip.callbacks = tooltipCallbacks;
    chartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: opts });
  }

  // ── 서브차트 ──
  if (activeIndicators.has('rsi')) updateRSIChart(labels, closes);
  else { rsiChartInstance?.destroy(); rsiChartInstance = null; }

  if (activeIndicators.has('macd')) updateMACDChart(labels, closes);
  else { macdChartInstance?.destroy(); macdChartInstance = null; }
}

// ══════════════════════════════════════════════════════
//  RSI 서브차트
// ══════════════════════════════════════════════════════

const rsiZonePlugin = {
  id: 'rsiZones',
  beforeDraw(chart) {
    const ctx = chart.ctx;
    const yScale = chart.scales.y;
    const area = chart.chartArea;
    if (!area) return;

    // 과매수 영역 (70~100)
    const y70 = yScale.getPixelForValue(70);
    const y100 = yScale.getPixelForValue(100);
    ctx.fillStyle = 'rgba(239,83,80,0.06)';
    ctx.fillRect(area.left, y100, area.width, y70 - y100);

    // 과매도 영역 (0~30)
    const y0 = yScale.getPixelForValue(0);
    const y30 = yScale.getPixelForValue(30);
    ctx.fillStyle = 'rgba(38,166,154,0.06)';
    ctx.fillRect(area.left, y30, area.width, y0 - y30);

    // 기준선 (30, 50, 70)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    [30, 50, 70].forEach(v => {
      const y = yScale.getPixelForValue(v);
      ctx.beginPath();
      ctx.moveTo(area.left, y);
      ctx.lineTo(area.right, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }
};

function updateRSIChart(labels, closes) {
  const rsi = calcRSI(closes, 14);
  const data = {
    labels,
    datasets: [{
      label: 'RSI(14)',
      data: rsi,
      borderColor: '#ff9800',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.1,
      fill: false
    }]
  };

  const scales = {
    x: { display: false },
    y: {
      position: 'right',
      min: 0, max: 100,
      grid: { color: 'rgba(255,255,255,.04)' },
      ticks: {
        color: '#555e78', font: { size: 9 }, stepSize: 10,
        callback: v => [30, 50, 70].includes(v) ? v : ''
      }
    }
  };

  if (rsiChartInstance) {
    rsiChartInstance.data = data;
    rsiChartInstance.update('none');
  } else {
    const canvas = document.getElementById('rsiChart');
    if (!canvas) return;
    const opts = baseChartOptions(scales);
    opts.plugins.tooltip.callbacks = { label: ctx => `RSI: ${ctx.parsed.y?.toFixed(1)}` };
    rsiChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line', data, plugins: [rsiZonePlugin], options: opts
    });
  }
}

// ══════════════════════════════════════════════════════
//  MACD 서브차트
// ══════════════════════════════════════════════════════

const macdZeroPlugin = {
  id: 'macdZero',
  beforeDraw(chart) {
    const ctx = chart.ctx;
    const yScale = chart.scales.y;
    const area = chart.chartArea;
    if (!area) return;

    const y0 = yScale.getPixelForValue(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(area.left, y0);
    ctx.lineTo(area.right, y0);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};

function updateMACDChart(labels, closes) {
  const { macdLine, signalLine, histogram } = calcMACD(closes);
  const data = {
    labels,
    datasets: [
      {
        label: 'Histogram',
        data: histogram,
        backgroundColor: histogram.map(v =>
          v === null ? 'transparent' : v >= 0 ? 'rgba(224,80,80,0.5)' : 'rgba(80,134,220,0.5)'
        ),
        borderColor: 'transparent',
        type: 'bar',
        order: 2
      },
      {
        label: 'MACD',
        data: macdLine,
        borderColor: '#2962ff',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.1,
        type: 'line',
        fill: false,
        order: 1
      },
      {
        label: 'Signal',
        data: signalLine,
        borderColor: '#ff9800',
        borderWidth: 1.2,
        pointRadius: 0,
        tension: 0.1,
        type: 'line',
        fill: false,
        order: 1
      }
    ]
  };

  const scales = {
    x: { display: false },
    y: {
      position: 'right',
      grid: { color: 'rgba(255,255,255,.04)' },
      ticks: { color: '#888888', font: { size: 9 } }
    }
  };

  if (macdChartInstance) {
    macdChartInstance.data = data;
    macdChartInstance.update('none');
  } else {
    const canvas = document.getElementById('macdChart');
    if (!canvas) return;
    const opts = baseChartOptions(scales);
    opts.plugins.tooltip.callbacks = {
      label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(0)}`
    };
    macdChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'bar', data, plugins: [macdZeroPlugin], options: opts
    });
  }
}
