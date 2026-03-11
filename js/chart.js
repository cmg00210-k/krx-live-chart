// ── 차트 관련 함수 ──

let chartInstance = null;

/** 시간 라벨 생성 */
function getLabels(hist) {
  const now = new Date();
  return hist.map((_, i) => {
    const d = new Date(now - (hist.length - 1 - i) * 60000);
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0');
  });
}

/** 단순 이동평균 */
function calcMA(data, n) {
  return data.map((_, i) => {
    if (i < n - 1) return null;
    return data.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n;
  });
}

/** 볼린저 밴드 */
function calcBB(closes, n = 20, k = 2) {
  return closes.map((_, i) => {
    if (i < n - 1) return { upper: null, lower: null, mid: null };
    const sl = closes.slice(i - n + 1, i + 1);
    const mean = sl.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    return { upper: mean + k * std, lower: mean - k * std, mid: mean };
  });
}

/** 지수 이동평균 */
function calcEMA(data, n) {
  return data.reduce((acc, v, i) => {
    if (i === 0) return [v];
    const k = 2 / (n + 1);
    return [...acc, v * k + acc[i - 1] * (1 - k)];
  }, []);
}

/** 메인 차트 업데이트 */
function updateChart() {
  const hist = prices[currentStock.code].history;
  const labels = getLabels(hist);
  const closes = hist.map(h => h.c);

  const datasets = [];

  // 기본 종가 라인
  datasets.push({
    label: '종가',
    data: closes,
    borderColor: '#2962ff',
    backgroundColor: 'rgba(41,98,255,0.08)',
    borderWidth: 1.5,
    pointRadius: 0,
    tension: chartType === 'line' ? 0.3 : 0.1,
    fill: true,
    type: 'line'
  });

  // MA 인디케이터
  if (activeIndicators.has('ma')) {
    datasets.push({
      label: 'MA(20)', data: calcMA(closes, 20),
      borderColor: '#ff9800', borderWidth: 1.2,
      pointRadius: 0, tension: 0.1, type: 'line', fill: false
    });
    datasets.push({
      label: 'MA(5)', data: calcMA(closes, 5),
      borderColor: '#e91e63', borderWidth: 1.2,
      pointRadius: 0, tension: 0.1, type: 'line', fill: false
    });
  }

  // EMA 인디케이터
  if (activeIndicators.has('ema')) {
    datasets.push({
      label: 'EMA(20)', data: calcEMA(closes, 20),
      borderColor: '#00bcd4', borderWidth: 1.2,
      pointRadius: 0, tension: 0.1, type: 'line', fill: false
    });
  }

  // 볼린저 밴드
  if (activeIndicators.has('bb')) {
    const bb = calcBB(closes);
    datasets.push({
      label: 'BB상단', data: bb.map(b => b.upper),
      borderColor: 'rgba(156,39,176,.7)', borderWidth: 1,
      pointRadius: 0, type: 'line', fill: false, borderDash: [4, 2]
    });
    datasets.push({
      label: 'BB하단', data: bb.map(b => b.lower),
      borderColor: 'rgba(156,39,176,.7)', borderWidth: 1,
      pointRadius: 0, type: 'line', fill: false, borderDash: [4, 2]
    });
  }

  // 거래량
  if (activeIndicators.has('vol')) {
    datasets.push({
      label: '거래량', data: hist.map(h => h.v),
      backgroundColor: 'rgba(100,120,180,.3)',
      borderColor: 'transparent',
      type: 'bar', yAxisID: 'yVol', order: 10
    });
  }

  const chartData = { labels, datasets };

  const scales = {
    x: {
      grid: { color: 'rgba(255,255,255,.04)' },
      ticks: { color: '#555e78', maxTicksLimit: 10, font: { size: 10 } }
    },
    y: {
      position: 'right',
      grid: { color: 'rgba(255,255,255,.04)' },
      ticks: { color: '#555e78', font: { size: 10 }, callback: v => v.toLocaleString() }
    }
  };

  if (activeIndicators.has('vol')) {
    scales.yVol = {
      position: 'left',
      grid: { display: false },
      ticks: { color: '#555e78', font: { size: 9 } },
      max: Math.max(...hist.map(h => h.v)) * 4
    };
  }

  // 기존 차트가 있으면 데이터만 업데이트
  if (chartInstance) {
    chartInstance.data = chartData;
    chartInstance.options.scales = scales;
    chartInstance.update('none');
    return;
  }

  // 새 차트 생성
  const ctx = document.getElementById('mainChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(13,15,20,.95)',
          borderColor: '#1e2535', borderWidth: 1,
          titleColor: '#d1d4dc', bodyColor: '#d1d4dc',
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString()}`
          }
        }
      },
      scales
    }
  });
}
