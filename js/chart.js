// ══════════════════════════════════════════════════════
//  KRX LIVE — 차트 엔진 (TradingView Lightweight Charts)
//  기술적 분석 지표 + 패턴 시각화
// ══════════════════════════════════════════════════════

// ── 기술적 지표 계산 함수 ──────────────────────────────

/** 단순 이동평균 (SMA) */
function calcMA(data, n) {
  return data.map((_, i) => {
    if (i < n - 1) return null;
    let sum = 0;
    for (let j = i - n + 1; j <= i; j++) sum += data[j];
    return sum / n;
  });
}

/** 지수 이동평균 (EMA) */
function calcEMA(data, n) {
  if (!data.length) return [];
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
    if (diff >= 0) gains += diff; else losses -= diff;
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

/** ATR (Average True Range) */
function calcATR(candles, period = 14) {
  const atr = new Array(candles.length).fill(null);
  if (candles.length < 2) return atr;
  const tr = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  if (candles.length < period) return atr;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr[period - 1] = sum / period;
  for (let i = period; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

/** 일목균형표 (Ichimoku Cloud) */
function calcIchimoku(candles, conv = 9, base = 26, spanBPeriod = 52, displacement = 26) {
  const len = candles.length;
  const midHL = (arr, start, end) => {
    let hi = -Infinity, lo = Infinity;
    for (let i = start; i <= end; i++) {
      if (arr[i].high > hi) hi = arr[i].high;
      if (arr[i].low < lo) lo = arr[i].low;
    }
    return (hi + lo) / 2;
  };

  const tenkan = new Array(len).fill(null);   // 전환선
  const kijun = new Array(len).fill(null);    // 기준선
  const spanA = new Array(len).fill(null);    // 선행스팬A
  const spanB = new Array(len).fill(null);    // 선행스팬B
  const chikou = new Array(len).fill(null);   // 후행스팬

  for (let i = 0; i < len; i++) {
    if (i >= conv - 1) tenkan[i] = midHL(candles, i - conv + 1, i);
    if (i >= base - 1) kijun[i] = midHL(candles, i - base + 1, i);
    if (i >= base - 1 && tenkan[i] !== null && kijun[i] !== null) {
      const futIdx = i + displacement;
      if (futIdx < len) spanA[futIdx] = (tenkan[i] + kijun[i]) / 2;
    }
    if (i >= spanBPeriod - 1) {
      const futIdx = i + displacement;
      if (futIdx < len) spanB[futIdx] = midHL(candles, i - spanBPeriod + 1, i);
    }
    // 후행스팬: 현재 종가를 displacement 전에 표시
    if (i >= displacement) chikou[i - displacement] = candles[i].close;
  }
  return { tenkan, kijun, spanA, spanB, chikou };
}

/** 칼만 필터 (Kalman Filter) 가격 평활 */
function calcKalman(closes, Q = 0.01, R = 1.0) {
  if (!closes.length) return [];
  const result = new Array(closes.length).fill(null);
  let x = closes[0];   // 상태 추정
  let P = 1.0;          // 추정 오차
  result[0] = x;

  for (let i = 1; i < closes.length; i++) {
    // 예측
    const xPred = x;
    const PPred = P + Q;
    // 갱신
    const K = PPred / (PPred + R);
    x = xPred + K * (closes[i] - xPred);
    P = (1 - K) * PPred;
    result[i] = x;
  }
  return result;
}

/** 허스트 지수 (Hurst Exponent) — R/S 분석 */
function calcHurst(closes, minWindow = 10) {
  if (closes.length < minWindow * 4) return null;

  const logRS = [];
  const logN = [];

  for (let w = minWindow; w <= Math.floor(closes.length / 2); w = Math.floor(w * 1.5)) {
    const numBlocks = Math.floor(closes.length / w);
    let rsSum = 0;
    for (let b = 0; b < numBlocks; b++) {
      const block = closes.slice(b * w, (b + 1) * w);
      const mean = block.reduce((a, v) => a + v, 0) / w;
      const devs = block.map(v => v - mean);
      const cumDevs = [];
      let cum = 0;
      for (const d of devs) { cum += d; cumDevs.push(cum); }
      const R = Math.max(...cumDevs) - Math.min(...cumDevs);
      const S = Math.sqrt(devs.reduce((a, d) => a + d * d, 0) / w);
      if (S > 0) rsSum += R / S;
    }
    logRS.push(Math.log(rsSum / numBlocks));
    logN.push(Math.log(w));
  }

  if (logRS.length < 2) return null;
  // 선형 회귀로 기울기(H) 추정
  const n = logRS.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += logN[i]; sy += logRS[i]; sxy += logN[i] * logRS[i]; sx2 += logN[i] * logN[i];
  }
  return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
}

/** MACD (12, 26, 9) */
function calcMACD(closes, fast = 12, slow = 26, sig = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine = emaFast.map((v, i) => i < slow - 1 ? null : v - emaSlow[i]);
  const validMacd = macdLine.filter(v => v !== null);
  if (!validMacd.length) return { macdLine, signalLine: macdLine.map(() => null), histogram: macdLine.map(() => null) };

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
//  차트 매니저 (Lightweight Charts)
// ══════════════════════════════════════════════════════

class ChartManager {
  constructor() {
    this.mainChart = null;
    this.rsiChart = null;
    this.macdChart = null;

    // Series 참조
    this.candleSeries = null;
    this.volumeSeries = null;
    this.indicatorSeries = {};   // { 'ma5': series, 'ema12': series, ... }
    this.trendlineSeries = [];   // 패턴 추세선

    this.rsiSeries = null;
    this.rsiPriceLines = [];

    this.macdLineSeries = null;
    this.macdSignalSeries = null;
    this.macdHistSeries = null;

    // 리사이즈 옵저버: Map<container, { observer, chart }>
    this._resizeMap = new Map();

    // 시간축 동기화 구독 해제 함수들
    this._syncUnsubs = [];
    this._syncing = false;
  }

  // ── 공통 차트 옵션 ─────────────────────────────────
  _baseOptions() {
    return {
      layout: {
        background: { type: 'solid', color: '#161616' },
        textColor: '#d1d4dc',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.07)' },
        horzLines: { color: 'rgba(255,255,255,0.07)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 2 },
        horzLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#252525',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: '#252525',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
      },
      handleScroll: { vertTouchDrag: false },
    };
  }

  // ══════════════════════════════════════════════════
  //  메인 차트 생성
  // ══════════════════════════════════════════════════
  createMainChart(container) {
    if (this.mainChart) this.destroyAll();

    const opts = this._baseOptions();
    this.mainChart = LightweightCharts.createChart(container, opts);

    // 캔들스틱 시리즈
    this.candleSeries = this.mainChart.addCandlestickSeries({
      upColor: '#E05050',
      downColor: '#5086DC',
      borderUpColor: '#E05050',
      borderDownColor: '#5086DC',
      wickUpColor: '#E05050',
      wickDownColor: '#5086DC',
    });

    // 거래량 히스토그램
    this.volumeSeries = this.mainChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    this.mainChart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    this._observeResize(container, this.mainChart);

    return this.mainChart;
  }

  // ══════════════════════════════════════════════════
  //  RSI 서브차트 생성
  // ══════════════════════════════════════════════════
  createRSIChart(container) {
    this.destroyRSI();

    const opts = this._baseOptions();
    opts.timeScale = { ...opts.timeScale, visible: false };
    opts.rightPriceScale.scaleMargins = { top: 0.1, bottom: 0.1 };

    this.rsiChart = LightweightCharts.createChart(container, opts);

    this.rsiSeries = this.rsiChart.addLineSeries({
      color: '#ff9800',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    this.rsiPriceLines = [
      this.rsiSeries.createPriceLine({ price: 70, color: 'rgba(224,80,80,0.4)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true }),
      this.rsiSeries.createPriceLine({ price: 50, color: 'rgba(255,255,255,0.15)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false }),
      this.rsiSeries.createPriceLine({ price: 30, color: 'rgba(80,134,220,0.4)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true }),
    ];

    this._observeResize(container, this.rsiChart);
    this._rebuildSync();

    return this.rsiChart;
  }

  // ══════════════════════════════════════════════════
  //  MACD 서브차트 생성
  // ══════════════════════════════════════════════════
  createMACDChart(container) {
    this.destroyMACD();

    const opts = this._baseOptions();
    opts.timeScale = { ...opts.timeScale, visible: false };
    opts.rightPriceScale.scaleMargins = { top: 0.15, bottom: 0.15 };

    this.macdChart = LightweightCharts.createChart(container, opts);

    this.macdHistSeries = this.macdChart.addHistogramSeries({
      priceLineVisible: false,
      lastValueVisible: false,
    });

    this.macdLineSeries = this.macdChart.addLineSeries({
      color: '#2962ff',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    this.macdSignalSeries = this.macdChart.addLineSeries({
      color: '#ff9800',
      lineWidth: 1.2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    this.macdHistSeries.createPriceLine({
      price: 0,
      color: 'rgba(255,255,255,0.15)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
    });

    this._observeResize(container, this.macdChart);
    this._rebuildSync();

    return this.macdChart;
  }

  // ══════════════════════════════════════════════════
  //  차트 데이터 업데이트
  // ══════════════════════════════════════════════════
  updateMain(candles, chartType, activeIndicators, patterns) {
    if (!this.mainChart || !candles || !candles.length) return;

    const times = candles.map(c => c.time);
    const closes = candles.map(c => c.close);

    // ── 가격 데이터 ──
    if (chartType === 'line') {
      this.candleSeries.setData([]);
      if (!this.indicatorSeries._priceLine) {
        this.indicatorSeries._priceLine = this.mainChart.addLineSeries({
          color: '#2962ff',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
        });
      }
      this.indicatorSeries._priceLine.setData(
        candles.map(c => ({ time: c.time, value: c.close }))
      );
    } else {
      if (this.indicatorSeries._priceLine) {
        this.mainChart.removeSeries(this.indicatorSeries._priceLine);
        delete this.indicatorSeries._priceLine;
      }
      this.candleSeries.setData(candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));

      if (chartType === 'bar') {
        this.candleSeries.applyOptions({
          upColor: 'transparent',
          downColor: 'transparent',
          borderUpColor: '#E05050',
          borderDownColor: '#5086DC',
        });
      } else {
        this.candleSeries.applyOptions({
          upColor: '#E05050',
          downColor: '#5086DC',
          borderUpColor: '#E05050',
          borderDownColor: '#5086DC',
        });
      }
    }

    // ── 거래량 ──
    if (activeIndicators.has('vol')) {
      this.volumeSeries.setData(candles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(224,80,80,0.3)' : 'rgba(80,134,220,0.3)',
      })));
    } else {
      this.volumeSeries.setData([]);
    }

    // ── 이동평균 (MA) ──
    this._updateIndicatorLine('ma5', activeIndicators.has('ma'),
      times, calcMA(closes, 5), '#e91e63', 1);
    this._updateIndicatorLine('ma20', activeIndicators.has('ma'),
      times, calcMA(closes, 20), '#ff9800', 1);
    this._updateIndicatorLine('ma60', activeIndicators.has('ma'),
      times, calcMA(closes, 60), '#4caf50', 1);

    // ── EMA ──
    this._updateIndicatorLine('ema12', activeIndicators.has('ema'),
      times, calcEMA(closes, 12), '#00bcd4', 1);
    this._updateIndicatorLine('ema26', activeIndicators.has('ema'),
      times, calcEMA(closes, 26), '#8bc34a', 1);

    // ── 일목균형표 ──
    if (activeIndicators.has('ich')) {
      const ich = calcIchimoku(candles);
      this._updateIndicatorLine('ichTenkan', true, times,
        ich.tenkan, '#2196f3', 1);
      this._updateIndicatorLine('ichKijun', true, times,
        ich.kijun, '#ef5350', 1);
      this._updateIndicatorLine('ichSpanA', true, times,
        ich.spanA, 'rgba(76,175,80,0.5)', 1);
      this._updateIndicatorLine('ichSpanB', true, times,
        ich.spanB, 'rgba(244,67,54,0.5)', 1);
      this._updateIndicatorLine('ichChikou', true, times,
        ich.chikou, '#9c27b0', 1);
    } else {
      ['ichTenkan', 'ichKijun', 'ichSpanA', 'ichSpanB', 'ichChikou'].forEach(k =>
        this._removeIndicatorLine(k));
    }

    // ── 칼만 필터 ──
    if (activeIndicators.has('kalman')) {
      const kalman = calcKalman(closes);
      this._updateIndicatorLine('kalman', true, times, kalman, '#00e5ff', 2);
    } else {
      this._removeIndicatorLine('kalman');
    }

    // ── 볼린저 밴드 ──
    if (activeIndicators.has('bb')) {
      const bb = calcBB(closes);
      this._updateIndicatorLine('bbUpper', true,
        times, bb.map(b => b.upper), 'rgba(156,39,176,0.7)', 1);
      this._updateIndicatorLine('bbMid', true,
        times, bb.map(b => b.mid), 'rgba(156,39,176,0.4)', 1);
      this._updateIndicatorLine('bbLower', true,
        times, bb.map(b => b.lower), 'rgba(156,39,176,0.7)', 1);
    } else {
      this._removeIndicatorLine('bbUpper');
      this._removeIndicatorLine('bbMid');
      this._removeIndicatorLine('bbLower');
    }

    // ── 패턴 마커 & 추세선 ──
    this._drawPatterns(candles, chartType, patterns);
    if (typeof patternRenderer !== 'undefined') patternRenderer.render(this, candles, chartType, patterns);
  }

  /** RSI 업데이트 */
  updateRSI(candles) {
    if (!this.rsiChart || !this.rsiSeries) return;

    const closes = candles.map(c => c.close);
    const rsi = calcRSI(closes, 14);

    this.rsiSeries.setData(
      rsi.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null)
         .filter(Boolean)
    );
  }

  /** MACD 업데이트 */
  updateMACD(candles) {
    if (!this.macdChart) return;

    const closes = candles.map(c => c.close);
    const { macdLine, signalLine, histogram } = calcMACD(closes);

    this.macdHistSeries.setData(
      histogram.map((v, i) => v !== null ? {
        time: candles[i].time,
        value: v,
        color: v >= 0 ? 'rgba(224,80,80,0.5)' : 'rgba(80,134,220,0.5)',
      } : null).filter(Boolean)
    );

    this.macdLineSeries.setData(
      macdLine.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null)
              .filter(Boolean)
    );

    this.macdSignalSeries.setData(
      signalLine.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null)
                .filter(Boolean)
    );
  }

  // ══════════════════════════════════════════════════
  //  패턴 시각화
  // ══════════════════════════════════════════════════
  _drawPatterns(candles, chartType, patterns) {
    // 기존 추세선 제거
    this.trendlineSeries.forEach(s => {
      try { this.mainChart.removeSeries(s); } catch (e) {}
    });
    this.trendlineSeries = [];

    // 마커를 설정할 시리즈 결정 (라인 모드일 때는 priceLine 시리즈 사용)
    const markerSeries = (chartType === 'line' && this.indicatorSeries._priceLine)
      ? this.indicatorSeries._priceLine
      : this.candleSeries;

    if (!patterns || !patterns.length) {
      markerSeries.setMarkers([]);
      return;
    }

    // ── 마커 설정 ──
    const markers = patterns
      .filter(p => p.marker)
      .map(p => ({
        time: p.marker.time,
        position: p.marker.position,
        color: p.marker.color,
        shape: p.marker.shape,
        text: p.marker.text,
        size: 2,
      }))
      .sort((a, b) => typeof a.time === 'string' ? a.time.localeCompare(b.time) : a.time - b.time);

    markerSeries.setMarkers(markers);

    // ── 추세선 (삼각형, 쐐기 패턴) ──
    patterns.forEach(p => {
      if (!p.trendlines) return;

      p.trendlines.forEach(tl => {
        if (!tl.points || tl.points.length < 2) return;

        const series = this.mainChart.addLineSeries({
          color: tl.color || '#C9A84C',
          lineWidth: 2,
          lineStyle: tl.style === 'dashed' ? 2 : 0,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        series.setData(tl.points.map(pt => ({
          time: pt.time,
          value: pt.value,
        })));

        this.trendlineSeries.push(series);
      });
    });
  }

  // ══════════════════════════════════════════════════
  //  지표 라인 유틸리티
  // ══════════════════════════════════════════════════
  _updateIndicatorLine(key, show, times, values, color, lineWidth) {
    if (!show) {
      this._removeIndicatorLine(key);
      return;
    }

    if (!this.indicatorSeries[key]) {
      this.indicatorSeries[key] = this.mainChart.addLineSeries({
        color: color,
        lineWidth: lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    }

    const data = values
      .map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter(Boolean);

    this.indicatorSeries[key].setData(data);
  }

  _removeIndicatorLine(key) {
    if (this.indicatorSeries[key]) {
      try { this.mainChart.removeSeries(this.indicatorSeries[key]); } catch (e) {}
      delete this.indicatorSeries[key];
    }
  }

  // ══════════════════════════════════════════════════
  //  시간축 동기화 (구독 해제 → 재구독)
  // ══════════════════════════════════════════════════
  _rebuildSync() {
    // 기존 구독 모두 해제
    this._syncUnsubs.forEach(fn => { try { fn(); } catch (e) {} });
    this._syncUnsubs = [];

    if (!this.mainChart) return;

    const charts = [this.mainChart, this.rsiChart, this.macdChart].filter(Boolean);
    if (charts.length < 2) return;

    charts.forEach(source => {
      const targets = charts.filter(c => c !== source);
      const unsub = source.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (this._syncing || !range) return;
        this._syncing = true;
        targets.forEach(t => {
          try { t.timeScale().setVisibleLogicalRange(range); } catch (e) {}
        });
        this._syncing = false;
      });
      this._syncUnsubs.push(unsub);
    });
  }

  // ══════════════════════════════════════════════════
  //  개별 서브차트 파괴
  // ══════════════════════════════════════════════════
  destroyRSI() {
    if (this.rsiChart) {
      // 리사이즈 옵저버 해제
      this._resizeMap.forEach((entry, container) => {
        if (entry.chart === this.rsiChart) {
          entry.observer.disconnect();
          this._resizeMap.delete(container);
        }
      });
      this.rsiChart.remove();
      this.rsiChart = null;
      this.rsiSeries = null;
      this.rsiPriceLines = [];
      this._rebuildSync();
    }
  }

  destroyMACD() {
    if (this.macdChart) {
      this._resizeMap.forEach((entry, container) => {
        if (entry.chart === this.macdChart) {
          entry.observer.disconnect();
          this._resizeMap.delete(container);
        }
      });
      this.macdChart.remove();
      this.macdChart = null;
      this.macdLineSeries = null;
      this.macdSignalSeries = null;
      this.macdHistSeries = null;
      this._rebuildSync();
    }
  }

  // ══════════════════════════════════════════════════
  //  리사이즈 & 전체 파괴
  // ══════════════════════════════════════════════════
  _observeResize(container, chart) {
    // 기존 옵저버가 있으면 해제
    if (this._resizeMap.has(container)) {
      this._resizeMap.get(container).observer.disconnect();
    }

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          try { chart.applyOptions({ width, height }); } catch (e) {}
        }
      }
    });
    ro.observe(container);
    this._resizeMap.set(container, { observer: ro, chart });
  }

  destroyAll() {
    // 동기화 구독 해제
    this._syncUnsubs.forEach(fn => { try { fn(); } catch (e) {} });
    this._syncUnsubs = [];

    // 리사이즈 옵저버 해제
    this._resizeMap.forEach(entry => entry.observer.disconnect());
    this._resizeMap.clear();

    // 차트 제거
    if (this.mainChart) { this.mainChart.remove(); this.mainChart = null; }
    if (this.rsiChart) { this.rsiChart.remove(); this.rsiChart = null; }
    if (this.macdChart) { this.macdChart.remove(); this.macdChart = null; }

    // 참조 초기화
    this.candleSeries = null;
    this.volumeSeries = null;
    this.indicatorSeries = {};
    this.trendlineSeries = [];
    this.rsiSeries = null;
    this.rsiPriceLines = [];
    this.macdLineSeries = null;
    this.macdSignalSeries = null;
    this.macdHistSeries = null;
  }
}

// 글로벌 인스턴스
const chartManager = new ChartManager();
