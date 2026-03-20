// ══════════════════════════════════════════════════════
//  KRX LIVE — 차트 엔진 (TradingView Lightweight Charts)
//  지표 계산은 indicators.js에 분리
//  이 파일은 ChartManager 클래스만 포함
// ══════════════════════════════════════════════════════

// ── HighLowPrimitive: visible 고/저점 캔들 → 우측 축까지 점선 ──
// ISeriesPrimitive 패턴 (patternRenderer.js 참조)
// createPriceLine(lineVisible:false)로 축 태그만 표시하고,
// 이 primitive가 해당 캔들 x좌표 → 차트 우측 끝까지 점선을 그림
class _HighLowPaneView {
  constructor(source) {
    this._source = source;
    this._drawItems = [];
  }

  zOrder() { return 'bottom'; }

  update() {
    this._drawItems = [];
    const src = this._source;
    if (!src._chart || !src._series) return;
    if (src._highPrice == null && src._lowPrice == null) return;

    const ts = src._chart.timeScale();
    const series = src._series;

    // 점선 끝점: 마지막 캔들 x좌표 (여백에 점선 안 그림)
    var endX = null;
    if (src._lastCandleTime != null) {
      endX = ts.timeToCoordinate(src._lastCandleTime);
    }

    // 고점 점선 데이터
    if (src._highPrice != null && src._highTime != null) {
      const x = ts.timeToCoordinate(src._highTime);
      const y = series.priceToCoordinate(src._highPrice);
      if (x != null && y != null) {
        this._drawItems.push({
          x: x, y: y, isHigh: true,
          color: KRX_COLORS.UP_FILL(0.6),
          endX: endX,
        });
      }
    }

    // 저점 점선 데이터
    if (src._lowPrice != null && src._lowTime != null) {
      const x = ts.timeToCoordinate(src._lowTime);
      const y = series.priceToCoordinate(src._lowPrice);
      if (x != null && y != null) {
        this._drawItems.push({
          x: x, y: y, isHigh: false,
          color: KRX_COLORS.VIS_LOW_FILL(0.6),
          endX: endX,
        });
      }
    }
  }

  renderer() { return new _HighLowRenderer(this._drawItems); }
}

class _HighLowRenderer {
  constructor(items) { this._items = items; }

  draw(target) {
    if (!this._items || !this._items.length) return;

    target.useMediaCoordinateSpace(scope => {
      const ctx = scope.context;
      const w = scope.mediaSize.width;

      ctx.save();

      this._items.forEach(item => {
        if (item.x == null || item.y == null) return;
        // 캔들이 화면 오른쪽 밖이면 스킵
        if (item.x > w + 10) return;

        // ── 점선: 캔들 x → 마지막 캔들 x (여백에는 절대 안 그림) ──
        // endX가 null이면 (마지막 캔들이 visible 밖) 점선 생략
        if (item.endX != null && item.endX > item.x) {
          ctx.beginPath();
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          const startX = Math.max(0, item.x);
          const lineEndX = Math.min(item.endX + 12, w);
          ctx.moveTo(startX, item.y);
          ctx.lineTo(lineEndX, item.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // ── 마커: 고점 ▲, 저점 ▼ (작은 삼각형 4px) ──
        if (item.x >= -10 && item.x <= w + 10) {
          ctx.fillStyle = item.color;
          ctx.beginPath();
          if (item.isHigh) {
            // ▲ 고점 위쪽 삼각형 (캔들 바로 위)
            ctx.moveTo(item.x, item.y - 6);
            ctx.lineTo(item.x - 4, item.y - 1);
            ctx.lineTo(item.x + 4, item.y - 1);
          } else {
            // ▼ 저점 아래쪽 삼각형 (캔들 바로 아래)
            ctx.moveTo(item.x, item.y + 6);
            ctx.lineTo(item.x - 4, item.y + 1);
            ctx.lineTo(item.x + 4, item.y + 1);
          }
          ctx.closePath();
          ctx.fill();
        }
      });

      ctx.restore();
    });
  }
}

class _HighLowPrimitive {
  constructor() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._view = new _HighLowPaneView(this);
    // 데이터
    this._highPrice = null;
    this._highTime = null;
    this._lowPrice = null;
    this._lowTime = null;
    this._lastCandleTime = null;  // 점선 끝점 제한용
  }

  attached(param) {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  updateAllViews() { this._view.update(); }
  paneViews() { return [this._view]; }

  setHighLow(highPrice, highTime, lowPrice, lowTime, lastCandleTime) {
    this._highPrice = highPrice;
    this._highTime = highTime;
    this._lowPrice = lowPrice;
    this._lowTime = lowTime;
    this._lastCandleTime = lastCandleTime || null;
    if (this._requestUpdate) this._requestUpdate();
  }

  clear() {
    this._highPrice = null;
    this._highTime = null;
    this._lowPrice = null;
    this._lowTime = null;
    this._lastCandleTime = null;
    if (this._requestUpdate) this._requestUpdate();
  }
}


class ChartManager {
  constructor() {
    this.mainChart = null;
    this.rsiChart = null;
    this.macdChart = null;
    // [NEW] 5개 추가 서브차트
    this.stochChart = null;
    this.cciChart = null;
    this.adxChart = null;
    this.willrChart = null;
    this.atrChart = null;

    // Series 참조
    this.candleSeries = null;
    this.volumeSeries = null;
    this.indicatorSeries = {};   // { 'ma5': series, 'ema12': series, ... }
    this.trendlineSeries = [];   // 패턴 추세선

    this.rsiSeries = null;
    this.rsiPriceLines = [];
    // [NEW] 추가 지표 시리즈
    this.stochKSeries = null; this.stochDSeries = null;
    this.cciSeries = null;
    this.adxSeries = null; this.adxPlusDISeries = null; this.adxMinusDISeries = null;
    this.willrSeries = null;
    this.atrSeries = null;

    this.macdLineSeries = null;
    this.macdSignalSeries = null;
    this.macdHistSeries = null;

    // 리사이즈 옵저버: Map<container, { observer, chart }>
    this._resizeMap = new Map();

    // 시간축 동기화 구독 해제 함수들
    this._syncUnsubs = [];
    this._syncing = false;
    this._syncScheduled = false;  // [OPT] 마이크로태스크 디바운스 플래그

    // 가격선 참조 (현재가만 — 고/저점은 visible 기준으로 별도 관리)
    this._currentPriceLine = null;

    // visible range 기준 고/저점 (축 라벨 전용 priceLine + ISeriesPrimitive 점선)
    this._visHighLine = null;      // createPriceLine (lineVisible:false, 축 태그만)
    this._visLowLine = null;
    this._visHighLowPrimitive = null;  // ISeriesPrimitive (캔들→우측 점선)
    this._visHighIdx = -1;         // 고점 캔들 인덱스 (primitive용)
    this._visLowIdx = -1;          // 저점 캔들 인덱스

    // visible range 기준 고/저점 캐시 (불필요한 업데이트 스킵용)
    this._lastVisibleHigh = null;
    this._lastVisibleLow = null;

    // 볼륨 20일 이동평균 시리즈
    this._volMaSeries = null;

    // OHLC 크로스헤어 콜백
    this._ohlcCallback = null;

    // 패턴/시그널 호버 툴팁 콜백
    this._tooltipCallback = null;
    // 패턴/시그널 데이터 (호버 감지용)
    this._hoverPatterns = [];
    this._hoverSignals = [];
    this._hoverCandles = [];

    // 초기 표시 범위 플래그 (차트 생성 시 true, 한 번 적용 후 false)
    this._shouldSetInitialRange = false;

    // [PERF] 지표 데이터 캐싱 — 동일 데이터 setData() 중복 호출 방지
    this._lastDataKey = {};
    // [PERF] 지표 계산 결과 캐싱 — 캔들 변경 시에만 재계산
    // key: candles.length + '_' + lastCandle.time, results: { ma5, ma20, ... }
    this._indicatorCache = { key: null, results: {} };
    // [UX] RSI/MACD 최근 계산값 저장 (크로스헤어 툴팁용)
    this._lastRsiValues = null;
    this._lastMacdValues = null;

    // ── 보이는 구간 변경 시 패턴 즉시 감지 (드래그 기반 UX) ──
    // KNOWSTOCK의 _offset 변경 → repaint 패턴과 유사:
    //   사용자가 드래그할 때마다 보이는 캔들 구간이 바뀌면
    //   콜백을 호출하여 해당 구간의 패턴을 즉시 분석/표시
    this._visibleRangeUnsub = null;       // subscribeVisibleLogicalRangeChange 구독 해제 함수
    this._visibleRangeCallback = null;    // 외부에서 등록하는 콜백 (app.js)
    this._visibleRangeDebounce = null;    // 디바운스 타이머
    this._lastVisibleFrom = null;         // 이전 범위 (중복 호출 방지)
    this._lastVisibleTo = null;
  }

  // ── 공통 차트 옵션 ─────────────────────────────────
  // KNOWSTOCK chart_widget.py 참고:
  //   - bg_panel: #1e222d, text_primary: #d1d4dc, text_axis: #787b86
  //   - grid_major: 실선, grid_minor: 점선 [1,4] 패턴
  //   - 현재가 태그: cur_price_tag_bg (#2962ff) + 좌측 화살표 포인터
  _baseOptions() {
    return {
      layout: {
        background: { type: 'solid', color: KRX_COLORS.CHART_BG },
        textColor: KRX_COLORS.CHART_TEXT,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Pretendard', monospace",
        attributionLogo: false,  // TradingView 로고 제거 (푸터 링크로 대체)
      },
      localization: {
        locale: 'ko-KR',
        dateFormat: 'yyyy-MM-dd',  // 한국식 연-월-일
        priceFormatter: (price) => Math.round(price).toLocaleString('ko-KR'),
        timeFormatter: (t) => {
          try {
            if (typeof t === 'string') return t;  // "YYYY-MM-DD" 그대로
            if (typeof t === 'object' && t && t.year) {
              return t.year + '-' + String(t.month).padStart(2, '0') + '-' + String(t.day).padStart(2, '0');
            }
            if (typeof t !== 'number' || !isFinite(t)) return '';
            var d = new Date(t * 1000);
            var h = d.getUTCHours() + 9, m = d.getUTCMinutes();
            if (h >= 24) h -= 24;
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
          } catch (e) { return ''; }
        },
      },
      grid: {
        vertLines: { color: KRX_COLORS.CHART_GRID_VERT },
        horzLines: { color: KRX_COLORS.CHART_GRID_HORZ },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: KRX_COLORS.CHART_CROSSHAIR,
          width: 1,
          style: 2,          // LightweightCharts.LineStyle.Dashed
          labelBackgroundColor: KRX_COLORS.CHART_CROSSHAIR_LABEL,
        },
        horzLine: {
          color: KRX_COLORS.CHART_CROSSHAIR,
          width: 1,
          style: 2,
          labelBackgroundColor: KRX_COLORS.CHART_CROSSHAIR_LABEL,
        },
      },
      rightPriceScale: {
        borderColor: KRX_COLORS.CHART_BORDER,
        scaleMargins: { top: 0.15, bottom: 0.20 },
        autoScale: true,
        alignLabels: true,
        entireTextOnly: true,               // 잘린 가격 라벨 방지
      },
      timeScale: {
        borderColor: KRX_COLORS.CHART_BORDER,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
        barSpacing: 10,
        minBarSpacing: 3,
        fixLeftEdge: true,
        fixRightEdge: true,   // 마지막 캔들이 우측 축에 고정 — 우측 빈 여백 없음
        lockVisibleTimeRangeOnResize: true,
        // [FIX] X축 라벨을 KST(UTC+9)로 표시
        tickMarkFormatter: function(time, tickMarkType) {
          try {
            if (typeof time === 'string') {
              var p = time.split('-');
              if (p.length === 3) return p[1] + '/' + p[2];
              return time;
            }
            if (typeof time === 'object' && time && time.year) {
              if (tickMarkType <= 1) return String(time.year);
              return (time.month < 10 ? '0' : '') + time.month + '/' + (time.day < 10 ? '0' : '') + time.day;
            }
            if (typeof time !== 'number' || !isFinite(time)) return '';
            var d = new Date(time * 1000);
            var h = d.getUTCHours() + 9, m = d.getUTCMinutes();
            if (h >= 24) h -= 24;
            if (tickMarkType >= 3) {
              return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
            }
            // [FIX] KST 변환은 Date 객체로 — 월 경계 롤오버 자동 처리 (1/32 버그 수정)
            var kstDate = new Date((time + 9 * 3600) * 1000);
            return (kstDate.getUTCMonth() + 1) + '/' + kstDate.getUTCDate();
          } catch (e) { return ''; }
        },
      },
      // ── 줌/스크롤 자유 허용 (증권사 HTS / TradingView 스타일) ──
      handleScale: {
        mouseWheel: true,              // 마우스 휠 줌 허용
        pinch: true,                   // 핀치 줌 허용
        axisPressedMouseMove: true,    // 축 드래그 줌 허용
      },
      handleScroll: {
        mouseWheel: true,              // 휠 스크롤 허용
        pressedMouseMove: true,        // 마우스 드래그 스크롤 허용
        horzTouchDrag: true,           // 터치 수평 드래그 허용
        vertTouchDrag: true,           // 수직 터치 드래그 허용
      },
    };
  }

  // ══════════════════════════════════════════════════
  //  메인 차트 생성
  // ══════════════════════════════════════════════════
  createMainChart(container) {
    if (this.mainChart) this.destroyAll();

    const opts = this._baseOptions();

    // ── 동적 barSpacing: 컨테이너 너비 기반으로 약 12개 캔들 표시 ──
    // investing.com 스타일: 화면에 적절한 수의 캔들이 보이도록 자동 계산
    const containerWidth = container.clientWidth || 800;
    const dynamicBarSpacing = Math.max(6, Math.floor(containerWidth / 17));
    opts.timeScale.barSpacing = dynamicBarSpacing;

    this.mainChart = LightweightCharts.createChart(container, opts);

    // 캔들스틱 시리즈 (원화: 소수점 없음)
    // borderVisible: false → investing.com 스타일 깔끔한 캔들 (테두리 없음)
    this.candleSeries = this.mainChart.addCandlestickSeries({
      upColor: KRX_COLORS.UP,
      downColor: KRX_COLORS.DOWN,
      borderVisible: false,
      wickUpColor: KRX_COLORS.UP,
      wickDownColor: KRX_COLORS.DOWN,
      lastValueVisible: true,
      priceLineVisible: false,
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    // 거래량 히스토그램
    this.volumeSeries = this.mainChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      lastValueVisible: false,              // 우측 가격축에 거래량 태그 숨김
      priceLineVisible: false,              // 거래량 수평 가격선 숨김
    });
    this.mainChart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    this._observeResize(container, this.mainChart);

    // 초기 표시 범위 플래그 켜기 (다음 updateMain에서 최근 20봉으로 제한)
    this._shouldSetInitialRange = true;

    // 크로스헤어 이동 시 OHLC + 패턴 호버 콜백
    this.mainChart.subscribeCrosshairMove(param => {
      // OHLC 콜백
      if (this._ohlcCallback) {
        if (param.time && param.seriesData) {
          const data = param.seriesData.get(this.candleSeries);
          if (data && data.open != null) {
            // [UX] _idx 추가: 크로스헤어 위치의 캔들 인덱스 (지표값 조회용)
            // [FIX] _idx: Math.round()로 float 타임스탬프 비교 안정화
            let _idx = null;
            if (this._hoverCandles.length && param.time != null) {
              const pt = typeof param.time === 'number' ? Math.round(param.time) : param.time;
              for (let ci = this._hoverCandles.length - 1; ci >= 0; ci--) {
                const ct = typeof this._hoverCandles[ci].time === 'number' ? Math.round(this._hoverCandles[ci].time) : this._hoverCandles[ci].time;
                if (ct === pt || String(ct) === String(pt)) { _idx = ci; break; }
              }
            }
            this._ohlcCallback({ open: data.open, high: data.high, low: data.low, close: data.close, volume: null, type: 'crosshair', _idx });
          } else {
            this._ohlcCallback(null);
          }
        } else {
          this._ohlcCallback(null);
        }
      }

      // 패턴/시그널 호버 감지
      this._handlePatternHover(param);
    });

    // ── 보이는 구간 변경 시 패턴 즉시 감지 구독 ──
    // KNOWSTOCK의 mouseMoveEvent → _offset 변경 → _schedule_repaint 패턴 참고:
    //   드래그하면 _offset이 바뀌고 → repaint에서 _visible_slice()로 보이는 캔들 추출 → 패턴 표시
    //   여기서는 Lightweight Charts의 subscribeVisibleLogicalRangeChange가 같은 역할
    this._subscribeVisibleRange();

    return this.mainChart;
  }

  // ══════════════════════════════════════════════════
  //  RSI 서브차트 생성
  // ══════════════════════════════════════════════════
  createRSIChart(container) {
    this.destroyRSI();

    const opts = this._baseOptions();
    opts.timeScale = { ...opts.timeScale, visible: false };
    opts.rightPriceScale.scaleMargins = { top: 0.08, bottom: 0.08 };

    this.rsiChart = LightweightCharts.createChart(container, opts);

    this.rsiSeries = this.rsiChart.addLineSeries({
      color: KRX_COLORS.RSI,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    this.rsiPriceLines = [
      this.rsiSeries.createPriceLine({ price: 70, color: KRX_COLORS.UP_FILL(0.4), lineWidth: 1, lineStyle: 2, axisLabelVisible: true }),
      this.rsiSeries.createPriceLine({ price: 50, color: KRX_COLORS.CHART_ZERO_LINE, lineWidth: 1, lineStyle: 2, axisLabelVisible: false }),
      this.rsiSeries.createPriceLine({ price: 30, color: KRX_COLORS.DOWN_FILL(0.4), lineWidth: 1, lineStyle: 2, axisLabelVisible: true }),
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
    opts.rightPriceScale.scaleMargins = { top: 0.1, bottom: 0.1 };

    this.macdChart = LightweightCharts.createChart(container, opts);

    this.macdHistSeries = this.macdChart.addHistogramSeries({
      priceLineVisible: false,
      lastValueVisible: false,
    });

    this.macdLineSeries = this.macdChart.addLineSeries({
      color: KRX_COLORS.MACD_LINE,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    this.macdSignalSeries = this.macdChart.addLineSeries({
      color: KRX_COLORS.MACD_SIGNAL,
      lineWidth: 1.2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    this.macdHistSeries.createPriceLine({
      price: 0,
      color: KRX_COLORS.CHART_ZERO_LINE,
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
  updateMain(candles, chartType, activeIndicators, patterns, params) {
    if (!this.mainChart || !candles || !candles.length) return;

    // [FIX] 가격선 정리는 updatePriceLines()에서만 관리 — 여기서 제거하면
    // updateMain() 단독 호출 시 가격선이 사라지는 버그 발생

    // params: 지표 파라미터 (커스텀 기간 등), 없으면 기본값 사용
    const _p = params || {};

    const times = candles.map(c => c.time);
    const closes = candles.map(c => c.close);

    // [PERF] 지표 계산 캐시: 캔들 길이 + 마지막 캔들 시간 + 마지막 종가로 변경 감지
    // 동일 캔들이면 calcMA/calcEMA/calcBB 등 고비용 계산을 건너뜀
    var _cacheKey = candles.length + '_' + candles[candles.length - 1].time + '_' + candles[candles.length - 1].close;
    if (this._indicatorCache.key !== _cacheKey) {
      this._indicatorCache = { key: _cacheKey, results: {} };
    }
    var _ic = this._indicatorCache.results;

    // ── 가격 데이터 ──
    if (chartType === 'line') {
      this.candleSeries.setData([]);
      if (!this.indicatorSeries._priceLine) {
        this.indicatorSeries._priceLine = this.mainChart.addLineSeries({
          color: KRX_COLORS.LINE_PRICE,
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          priceFormat: { type: 'price', precision: 0, minMove: 1 },
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

      // Heikin Ashi 변환
      let displayCandles = candles;
      if (chartType === 'heikin') {
        displayCandles = this._convertToHeikinAshi(candles);
      }

      this.candleSeries.setData(displayCandles.map(c => ({
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
          borderVisible: true,
          borderUpColor: KRX_COLORS.UP,
          borderDownColor: KRX_COLORS.DOWN,
        });
      } else {
        this.candleSeries.applyOptions({
          upColor: KRX_COLORS.UP,
          downColor: KRX_COLORS.DOWN,
          borderVisible: false,
        });
      }
    }

    // ── 거래량 (동적 투명도: 20일 평균 대비 비율) ──
    if (activeIndicators.has('vol')) {
      // 20봉 평균 거래량 계산
      var volSum = 0, volCount = 0;
      var startIdx = Math.max(0, candles.length - 20);
      for (var vi = startIdx; vi < candles.length; vi++) {
        volSum += (candles[vi].volume || 0);
        volCount++;
      }
      var avgVol = volCount > 0 ? volSum / volCount : 1;

      this.volumeSeries.setData(candles.map(function(c) {
        var ratio = avgVol > 0 ? (c.volume || 0) / avgVol : 1;
        // 동적 투명도: 1x미만=0.15, 1~2x=0.25, 2x+=0.45
        var alpha;
        if (ratio < 1) alpha = 0.15;
        else if (ratio < 2) alpha = 0.25;
        else alpha = 0.45;

        return {
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? KRX_COLORS.UP_FILL(alpha) : KRX_COLORS.DOWN_FILL(alpha),
        };
      }));
      // [FIX] 거래량 활성 시 프라이스 스케일 복원 (비활성→활성 전환 대응)
      this.mainChart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      // ── 20일 평균 거래량선 (점선) ──
      if (!this._volMaSeries) {
        this._volMaSeries = this.mainChart.addLineSeries({
          priceScaleId: 'vol',
          color: KRX_COLORS.MA_MID,
          lineWidth: 1,
          lineStyle: 2,                          // Dashed (점선)
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'Vol MA20',
          crosshairMarkerVisible: false,
        });
      }
      var volMaValues = calcMA(candles.map(function(c) { return c.volume || 0; }), 20);
      this._volMaSeries.setData(
        volMaValues.map(function(v, i) {
          return v !== null ? { time: candles[i].time, value: v } : null;
        }).filter(Boolean)
      );
    } else {
      this.volumeSeries.setData([]);
      // 볼륨 비활성 시 MA 시리즈도 제거
      if (this._volMaSeries) {
        try { this.mainChart.removeSeries(this._volMaSeries); } catch (e) {}
        this._volMaSeries = null;
      }
      // [FIX] 거래량 비활성 시 volume 프라이스 스케일을 0 높이로 축소
      // — scaleMargins top:0.8 이 데이터 없어도 20% 공간을 점유하는 버그 수정
      this.mainChart.priceScale('vol').applyOptions({ scaleMargins: { top: 1, bottom: 0 } });
    }

    // ── 이동평균 (MA) — 커스텀 기간 지원 + 계산 캐싱 ──
    const maP = (_p.ma || { p1: 5, p2: 20, p3: 60 });
    var _maK1 = 'ma_' + maP.p1, _maK2 = 'ma_' + maP.p2, _maK3 = 'ma_' + maP.p3;
    this._updateIndicatorLine('ma5', activeIndicators.has('ma'),
      times, _ic[_maK1] || (_ic[_maK1] = calcMA(closes, maP.p1)), KRX_COLORS.MA_SHORT, 1);
    this._updateIndicatorLine('ma20', activeIndicators.has('ma'),
      times, _ic[_maK2] || (_ic[_maK2] = calcMA(closes, maP.p2)), KRX_COLORS.MA_MID, 1);
    this._updateIndicatorLine('ma60', activeIndicators.has('ma'),
      times, _ic[_maK3] || (_ic[_maK3] = calcMA(closes, maP.p3)), KRX_COLORS.MA_LONG, 1);

    // ── EMA — 커스텀 기간 지원 + 계산 캐싱 ──
    const emaP = (_p.ema || { p1: 12, p2: 26 });
    var _emaK1 = 'ema_' + emaP.p1, _emaK2 = 'ema_' + emaP.p2;
    this._updateIndicatorLine('ema12', activeIndicators.has('ema'),
      times, _ic[_emaK1] || (_ic[_emaK1] = calcEMA(closes, emaP.p1)), KRX_COLORS.EMA_12, 1);
    this._updateIndicatorLine('ema26', activeIndicators.has('ema'),
      times, _ic[_emaK2] || (_ic[_emaK2] = calcEMA(closes, emaP.p2)), KRX_COLORS.EMA_26, 1);

    // ── 일목균형표 — 커스텀 기간 지원 + 계산 캐싱 ──
    if (activeIndicators.has('ich')) {
      const ichP = (_p.ich || { tenkan: 9, kijun: 26, senkou: 52 });
      var _ichK = 'ich_' + ichP.tenkan + '_' + ichP.kijun + '_' + ichP.senkou;
      var ich = _ic[_ichK] || (_ic[_ichK] = calcIchimoku(candles, ichP.tenkan, ichP.kijun, ichP.senkou));
      this._updateIndicatorLine('ichTenkan', true, times,
        ich.tenkan, KRX_COLORS.ICH_TENKAN, 1);
      this._updateIndicatorLine('ichKijun', true, times,
        ich.kijun, KRX_COLORS.ICH_KIJUN, 1);
      this._updateIndicatorLine('ichSpanA', true, times,
        ich.spanA, KRX_COLORS.ICH_SPANA, 1);
      this._updateIndicatorLine('ichSpanB', true, times,
        ich.spanB, KRX_COLORS.ICH_SPANB, 1);
      this._updateIndicatorLine('ichChikou', true, times,
        ich.chikou, KRX_COLORS.ICH_CHIKOU, 1);
    } else {
      ['ichTenkan', 'ichKijun', 'ichSpanA', 'ichSpanB', 'ichChikou'].forEach(k =>
        this._removeIndicatorLine(k));
    }

    // ── 칼만 필터 + 계산 캐싱 ──
    if (activeIndicators.has('kalman')) {
      var kalman = _ic['kalman'] || (_ic['kalman'] = calcKalman(closes));
      this._updateIndicatorLine('kalman', true, times, kalman, KRX_COLORS.KALMAN, 2);
    } else {
      this._removeIndicatorLine('kalman');
    }

    // ── 볼린저 밴드 — 커스텀 파라미터 지원 + 계산 캐싱 ──
    if (activeIndicators.has('bb')) {
      const bbP = (_p.bb || { period: 20, stdDev: 2 });
      var _bbK = 'bb_' + bbP.period + '_' + bbP.stdDev;
      var bb = _ic[_bbK] || (_ic[_bbK] = calcBB(closes, bbP.period, bbP.stdDev));
      // BB 파생 배열도 캐싱 (map 재실행 방지)
      var bbUp = _ic[_bbK + '_u'] || (_ic[_bbK + '_u'] = bb.map(b => b.upper));
      var bbMid = _ic[_bbK + '_m'] || (_ic[_bbK + '_m'] = bb.map(b => b.mid));
      var bbLow = _ic[_bbK + '_l'] || (_ic[_bbK + '_l'] = bb.map(b => b.lower));
      this._updateIndicatorLine('bbUpper', true, times, bbUp, KRX_COLORS.BB, 1);
      this._updateIndicatorLine('bbMid', true, times, bbMid, KRX_COLORS.BB_MID, 1);
      this._updateIndicatorLine('bbLower', true, times, bbLow, KRX_COLORS.BB, 1);
    } else {
      this._removeIndicatorLine('bbUpper');
      this._removeIndicatorLine('bbMid');
      this._removeIndicatorLine('bbLower');
    }

    // ── 패턴 마커 & 추세선 ──
    this._drawPatterns(candles, chartType, patterns);
    // [FIX] patternRenderer.render()는 app.js _renderOverlays()에서 단일 호출
    // 여기서 중복 호출하면 한 프레임에 2회 Canvas 렌더 → 제거

    // ── 초기 표시 범위: 동적 barSpacing (컨테이너폭/17) 기반 ──
    // 약 12개 캔들 + rightOffset 5칸 표시
    // 최근 데이터를 우측에 배치하고 좌측으로 드래그하여 과거 탐색
    if (candles.length > 0 && this._shouldSetInitialRange) {
      this.mainChart.timeScale().scrollToPosition(0, false);
      this._shouldSetInitialRange = false;
    }
  }

  /** RSI 업데이트 — params로 커스텀 기간 지원 */
  updateRSI(candles, params) {
    if (!this.rsiChart || !this.rsiSeries) return;

    const rsiP = (params && params.rsi) ? params.rsi : { period: 14 };
    const closes = candles.map(c => c.close);
    const rsi = calcRSI(closes, rsiP.period || 14);
    this._lastRsiValues = rsi;  // [UX] 크로스헤어 툴팁용 저장

    this.rsiSeries.setData(
      rsi.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null)
         .filter(Boolean)
    );
  }

  /** MACD 업데이트 — params로 커스텀 파라미터 지원 */
  updateMACD(candles, params) {
    if (!this.macdChart) return;

    const macdP = (params && params.macd) ? params.macd : { fast: 12, slow: 26, signal: 9 };
    const closes = candles.map(c => c.close);
    const { macdLine, signalLine, histogram } = calcMACD(closes, macdP.fast || 12, macdP.slow || 26, macdP.signal || 9);
    this._lastMacdValues = { macdLine, signalLine, histogram };  // [UX] 크로스헤어 툴팁용 저장

    this.macdHistSeries.setData(
      histogram.map((v, i) => v !== null ? {
        time: candles[i].time,
        value: v,
        color: v >= 0 ? KRX_COLORS.UP_FILL(0.5) : KRX_COLORS.DOWN_FILL(0.5),
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
    // 마커를 설정할 시리즈 결정 (라인 모드일 때는 priceLine 시리즈 사용)
    const markerSeries = (chartType === 'line' && this.indicatorSeries._priceLine)
      ? this.indicatorSeries._priceLine
      : this.candleSeries;

    if (!patterns || !patterns.length) {
      markerSeries.setMarkers([]);
      // 미사용 추세선 시리즈 정리
      this.trendlineSeries.forEach(s => {
        try { this.mainChart.removeSeries(s); } catch (e) {}
      });
      this.trendlineSeries = [];
      return;
    }

    // ── 마커 비활성화: patternRenderer v3가 Canvas로 전문 시각화 처리 ──
    // 기존 투박한 화살표 마커 대신 Canvas 글로우/브래킷/라벨 사용
    markerSeries.setMarkers([]);

    // ── 추세선 (삼각형, 쐐기 패턴) — 데이터 공간 LineSeries ──
    // Canvas 오버레이와 함께 LineSeries도 유지 (줌/팬 시 정확한 스케일링)
    const trendlineData = [];
    patterns.forEach(p => {
      if (!p.trendlines) return;
      p.trendlines.forEach(tl => {
        if (!tl.points || tl.points.length < 2) return;
        trendlineData.push(tl);
      });
    });

    const needed = trendlineData.length;
    const existing = this.trendlineSeries.length;

    // 초과분 제거
    if (existing > needed) {
      for (let i = needed; i < existing; i++) {
        try { this.mainChart.removeSeries(this.trendlineSeries[i]); } catch (e) {}
      }
      this.trendlineSeries.length = needed;
    }

    // 부족분 생성 + 기존분 재활용 (은은한 스타일)
    trendlineData.forEach((tl, i) => {
      const color = tl.color || KRX_COLORS.PTN_STRUCT;
      const lineStyle = tl.style === 'dashed' ? 2 : 0;
      const data = tl.points.map(pt => ({ time: pt.time, value: pt.value }));

      if (i < existing) {
        this.trendlineSeries[i].applyOptions({ color, lineStyle, lineWidth: 1 });
        this.trendlineSeries[i].setData(data);
      } else {
        const series = this.mainChart.addLineSeries({
          color,
          lineWidth: 1,
          lineStyle,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        series.setData(data);
        this.trendlineSeries.push(series);
      }
    });
  }

  // ══════════════════════════════════════════════════
  //  보이는 구간 변경 → 패턴 즉시 감지 (드래그 기반 UX)
  //
  //  KNOWSTOCK chart_widget.py 참고:
  //    mouseMoveEvent → dx로 _offset 계산 → _schedule_repaint (100ms 디바운스)
  //    paintEvent에서 _visible_slice()로 보이는 캔들만 추출하여 렌더링
  //
  //  여기서는 LightweightCharts의 subscribeVisibleLogicalRangeChange가
  //  KNOWSTOCK의 _offset 변경 이벤트와 동일한 역할을 수행.
  //  150ms 디바운스로 연속 드래그 중 과도한 패턴 분석을 방지.
  // ══════════════════════════════════════════════════

  /** 보이는 구간 변경 콜백 등록 (app.js에서 호출) */
  onVisibleRangeChange(callback) {
    this._visibleRangeCallback = callback;
  }

  /** 현재 보이는 논리적 범위를 반환 { from, to } */
  getVisibleLogicalRange() {
    if (!this.mainChart) return null;
    return this.mainChart.timeScale().getVisibleLogicalRange();
  }

  /** 내부: subscribeVisibleLogicalRangeChange 구독 설정 */
  _subscribeVisibleRange() {
    // 기존 구독 해제
    if (this._visibleRangeUnsub) {
      try { this._visibleRangeUnsub(); } catch (e) {}
      this._visibleRangeUnsub = null;
    }

    if (!this.mainChart) return;

    this._visibleRangeUnsub = this.mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range || !this._visibleRangeCallback) return;

      const from = Math.floor(range.from);
      const to = Math.ceil(range.to);

      // 범위가 실질적으로 바뀌지 않았으면 스킵 (중복 호출 방지)
      if (from === this._lastVisibleFrom && to === this._lastVisibleTo) return;
      this._lastVisibleFrom = from;
      this._lastVisibleTo = to;

      // 150ms 디바운스 — KNOWSTOCK의 _repaint_timer(100ms) 참고
      // 연속 드래그 중 매 프레임 분석하면 성능 저하 → 멈추면 즉시 분석
      if (this._visibleRangeDebounce) clearTimeout(this._visibleRangeDebounce);
      this._visibleRangeDebounce = setTimeout(() => {
        this._visibleRangeDebounce = null;
        this._visibleRangeCallback(from, to);
      }, 150);
    });
  }

  // ══════════════════════════════════════════════════
  //  지표 라인 유틸리티
  // ══════════════════════════════════════════════════
  _updateIndicatorLine(key, show, times, values, color, lineWidth) {
    if (!show) {
      this._removeIndicatorLine(key);
      delete this._lastDataKey[key];
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

    // [PERF] 동일 데이터 setData() 중복 호출 방지
    const dataKey = key + '_' + values.length + '_' + (values[0] || 0) + '_' + (values[values.length - 1] || 0);
    if (this._lastDataKey[key] === dataKey) return;
    this._lastDataKey[key] = dataKey;

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
  //  [OPT] 디바운스: 여러 서브차트가 연속 생성/파괴될 때 한 번만 실행
  // ══════════════════════════════════════════════════
  _rebuildSync() {
    // [OPT] 연속 호출 시 마지막 호출만 실행 (마이크로태스크 디바운스)
    // 7개 서브차트 생성 시 7회 → 1회로 축소
    if (this._syncScheduled) return;
    this._syncScheduled = true;
    Promise.resolve().then(() => {
      this._syncScheduled = false;
      this._doRebuildSync();
    });
  }

  _doRebuildSync() {
    // 기존 구독 모두 해제
    this._syncUnsubs.forEach(fn => { try { fn(); } catch (e) {} });
    this._syncUnsubs = [];

    if (!this.mainChart) return;

    const charts = [this.mainChart, this.rsiChart, this.macdChart,
      this.stochChart, this.cciChart, this.adxChart, this.willrChart, this.atrChart].filter(Boolean);
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
  //  [NEW] Stochastic 서브차트
  // ══════════════════════════════════════════════════
  createStochasticChart(container) {
    this.destroyStochastic();
    const opts = this._baseOptions();
    opts.timeScale = { ...opts.timeScale, visible: false };
    opts.rightPriceScale.scaleMargins = { top: 0.1, bottom: 0.1 };
    this.stochChart = LightweightCharts.createChart(container, opts);
    this.stochKSeries = this.stochChart.addLineSeries({ color: KRX_COLORS.STOCH_K, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
    this.stochDSeries = this.stochChart.addLineSeries({ color: KRX_COLORS.STOCH_D, lineWidth: 1.2, priceLineVisible: false, lastValueVisible: true });
    // [FIX] 하드코딩 rgba → KRX_COLORS 참조 (RSI 서브차트와 통일)
    this.stochKSeries.createPriceLine({ price: 80, color: KRX_COLORS.UP_FILL(0.4), lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
    this.stochKSeries.createPriceLine({ price: 20, color: KRX_COLORS.DOWN_FILL(0.4), lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
    this._observeResize(container, this.stochChart);
    this._rebuildSync();
    return this.stochChart;
  }
  updateStochastic(candles) {
    if (!this.stochChart || !this.stochKSeries) return;
    const { k, d } = calcStochastic(candles);
    this.stochKSeries.setData(k.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null).filter(Boolean));
    this.stochDSeries.setData(d.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null).filter(Boolean));
  }
  destroyStochastic() {
    if (this.stochChart) {
      this._resizeMap.forEach((e, c) => { if (e.chart === this.stochChart) { e.observer.disconnect(); this._resizeMap.delete(c); } });
      this.stochChart.remove(); this.stochChart = null; this.stochKSeries = null; this.stochDSeries = null; this._rebuildSync();
    }
  }

  // ══════════════════════════════════════════════════
  //  [NEW] CCI 서브차트
  // ══════════════════════════════════════════════════
  createCCIChart(container) {
    this.destroyCCI();
    const opts = this._baseOptions();
    opts.timeScale = { ...opts.timeScale, visible: false };
    opts.rightPriceScale.scaleMargins = { top: 0.1, bottom: 0.1 };
    this.cciChart = LightweightCharts.createChart(container, opts);
    this.cciSeries = this.cciChart.addLineSeries({ color: KRX_COLORS.CCI, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
    // [FIX] 하드코딩 rgba → KRX_COLORS 참조 (RSI 서브차트와 통일)
    this.cciSeries.createPriceLine({ price: 100, color: KRX_COLORS.UP_FILL(0.4), lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
    this.cciSeries.createPriceLine({ price: -100, color: KRX_COLORS.DOWN_FILL(0.4), lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
    this._observeResize(container, this.cciChart);
    this._rebuildSync();
    return this.cciChart;
  }
  updateCCI(candles) {
    if (!this.cciChart || !this.cciSeries) return;
    const cci = calcCCI(candles);
    this.cciSeries.setData(cci.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null).filter(Boolean));
  }
  destroyCCI() {
    if (this.cciChart) {
      this._resizeMap.forEach((e, c) => { if (e.chart === this.cciChart) { e.observer.disconnect(); this._resizeMap.delete(c); } });
      this.cciChart.remove(); this.cciChart = null; this.cciSeries = null; this._rebuildSync();
    }
  }

  // ══════════════════════════════════════════════════
  //  [NEW] ADX 서브차트 (+DI/-DI)
  // ══════════════════════════════════════════════════
  createADXChart(container) {
    this.destroyADX();
    const opts = this._baseOptions();
    opts.timeScale = { ...opts.timeScale, visible: false };
    opts.rightPriceScale.scaleMargins = { top: 0.1, bottom: 0.1 };
    this.adxChart = LightweightCharts.createChart(container, opts);
    this.adxSeries = this.adxChart.addLineSeries({ color: KRX_COLORS.ADX, lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    this.adxPlusDISeries = this.adxChart.addLineSeries({ color: KRX_COLORS.UP, lineWidth: 1.2, priceLineVisible: false, lastValueVisible: false });
    this.adxMinusDISeries = this.adxChart.addLineSeries({ color: KRX_COLORS.DOWN, lineWidth: 1.2, priceLineVisible: false, lastValueVisible: false });
    // ADX 25선: rgba(255,255,255,0.2) — KRX_COLORS에 정확한 대응 없음, 유지
    this.adxSeries.createPriceLine({ price: 25, color: 'rgba(255,255,255,0.2)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
    this._observeResize(container, this.adxChart);
    this._rebuildSync();
    return this.adxChart;
  }
  updateADX(candles) {
    if (!this.adxChart || !this.adxSeries) return;
    const { adx, plusDI, minusDI } = calcADX(candles);
    this.adxSeries.setData(adx.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null).filter(Boolean));
    this.adxPlusDISeries.setData(plusDI.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null).filter(Boolean));
    this.adxMinusDISeries.setData(minusDI.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null).filter(Boolean));
  }
  destroyADX() {
    if (this.adxChart) {
      this._resizeMap.forEach((e, c) => { if (e.chart === this.adxChart) { e.observer.disconnect(); this._resizeMap.delete(c); } });
      this.adxChart.remove(); this.adxChart = null; this.adxSeries = null; this.adxPlusDISeries = null; this.adxMinusDISeries = null; this._rebuildSync();
    }
  }

  // ══════════════════════════════════════════════════
  //  [NEW] Williams %R 서브차트
  // ══════════════════════════════════════════════════
  createWilliamsRChart(container) {
    this.destroyWilliamsR();
    const opts = this._baseOptions();
    opts.timeScale = { ...opts.timeScale, visible: false };
    opts.rightPriceScale.scaleMargins = { top: 0.1, bottom: 0.1 };
    this.willrChart = LightweightCharts.createChart(container, opts);
    this.willrSeries = this.willrChart.addLineSeries({ color: KRX_COLORS.WILLR, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
    // [FIX] 하드코딩 rgba → KRX_COLORS 참조 (RSI 서브차트와 통일)
    this.willrSeries.createPriceLine({ price: -20, color: KRX_COLORS.UP_FILL(0.4), lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
    this.willrSeries.createPriceLine({ price: -80, color: KRX_COLORS.DOWN_FILL(0.4), lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
    this._observeResize(container, this.willrChart);
    this._rebuildSync();
    return this.willrChart;
  }
  updateWilliamsR(candles) {
    if (!this.willrChart || !this.willrSeries) return;
    const willr = calcWilliamsR(candles);
    this.willrSeries.setData(willr.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null).filter(Boolean));
  }
  destroyWilliamsR() {
    if (this.willrChart) {
      this._resizeMap.forEach((e, c) => { if (e.chart === this.willrChart) { e.observer.disconnect(); this._resizeMap.delete(c); } });
      this.willrChart.remove(); this.willrChart = null; this.willrSeries = null; this._rebuildSync();
    }
  }

  // ══════════════════════════════════════════════════
  //  [NEW] ATR 서브차트
  // ══════════════════════════════════════════════════
  createATRChart(container) {
    this.destroyATR();
    const opts = this._baseOptions();
    opts.timeScale = { ...opts.timeScale, visible: false };
    opts.rightPriceScale.scaleMargins = { top: 0.1, bottom: 0.1 };
    this.atrChart = LightweightCharts.createChart(container, opts);
    this.atrSeries = this.atrChart.addLineSeries({ color: KRX_COLORS.ATR_LINE, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
    this._observeResize(container, this.atrChart);
    this._rebuildSync();
    return this.atrChart;
  }
  updateATR(candles) {
    if (!this.atrChart || !this.atrSeries) return;
    const atrVals = calcATR(candles);
    this.atrSeries.setData(atrVals.map((v, i) => v !== null ? { time: candles[i].time, value: v } : null).filter(Boolean));
  }
  destroyATR() {
    if (this.atrChart) {
      this._resizeMap.forEach((e, c) => { if (e.chart === this.atrChart) { e.observer.disconnect(); this._resizeMap.delete(c); } });
      this.atrChart.remove(); this.atrChart = null; this.atrSeries = null; this._rebuildSync();
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

    const isMainChart = (chart === this.mainChart);
    let rafId = null;
    let _lastResizeWidth = 0;  // [FIX] 실제 리사이즈 vs 줌 제스처 구분용
    const ro = new ResizeObserver(entries => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            try {
              const applyOpts = { width, height };
              // [FIX] barSpacing은 실제 컨테이너 크기 변경(>10px) 시에만 재계산
              // 줌 제스처 중 ResizeObserver가 발동해도 barSpacing을 건드리지 않음
              // → 줌 리셋 버그 방지 (Lightweight Charts가 줌 중 applyOptions 호출 시 뷰 리셋)
              let savedRange = null;
              if (isMainChart && Math.abs(width - _lastResizeWidth) > 10) {
                // [FIX] 전체화면 전환 시 visible range 보존 → 줌 레벨 점프 방지
                try { savedRange = chart.timeScale().getVisibleLogicalRange(); } catch(e2) {}
                applyOpts.timeScale = {
                  barSpacing: Math.max(6, Math.floor(width / 17)),
                };
              }
              _lastResizeWidth = width;
              chart.applyOptions(applyOpts);
              // barSpacing 변경 후 이전 visible range 복원
              if (savedRange) {
                try { chart.timeScale().setVisibleLogicalRange(savedRange); } catch(e2) {}
              }
            } catch (e) {}
          }
        }
      });
    });
    ro.observe(container);
    this._resizeMap.set(container, { observer: ro, chart });
  }

  /** Heikin Ashi 캔들 변환 */
  _convertToHeikinAshi(candles) {
    if (!candles || !candles.length) return [];
    const ha = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i === 0
        ? (c.open + c.close) / 2
        : (ha[i - 1].open + ha[i - 1].close) / 2;
      ha.push({
        time: c.time,
        open: Math.round(haOpen),
        high: Math.round(Math.max(c.high, haOpen, haClose)),
        low: Math.round(Math.min(c.low, haOpen, haClose)),
        close: Math.round(haClose),
        volume: c.volume,
      });
    }
    return ha;
  }

  destroyAll() {
    // renderer cleanup (stale 참조 방지)
    if (typeof patternRenderer !== 'undefined' && patternRenderer.cleanup) patternRenderer.cleanup();
    if (typeof signalRenderer !== 'undefined' && signalRenderer.cleanup) signalRenderer.cleanup();
    if (typeof drawingTools !== 'undefined' && drawingTools.cleanup) drawingTools.cleanup();

    // 보이는 구간 구독 해제
    if (this._visibleRangeUnsub) {
      try { this._visibleRangeUnsub(); } catch (e) {}
      this._visibleRangeUnsub = null;
    }
    if (this._visibleRangeDebounce) {
      clearTimeout(this._visibleRangeDebounce);
      this._visibleRangeDebounce = null;
    }
    this._lastVisibleFrom = null;
    this._lastVisibleTo = null;

    // 동기화 구독 해제
    this._syncUnsubs.forEach(fn => { try { fn(); } catch (e) {} });
    this._syncUnsubs = [];
    this._syncScheduled = false;  // [OPT] 디바운스 플래그 리셋

    // 리사이즈 옵저버 해제
    this._resizeMap.forEach(entry => entry.observer.disconnect());
    this._resizeMap.clear();

    // visible 고/저점 primitive 정리 (chart.remove() 전에 detach)
    if (this._visHighLowPrimitive && this.candleSeries) {
      try { this.candleSeries.detachPrimitive(this._visHighLowPrimitive); } catch (e) {}
    }
    this._visHighLine = null;
    this._visLowLine = null;
    this._visHighLowPrimitive = null;
    this._visHighIdx = -1;
    this._visLowIdx = -1;

    // 차트 제거
    if (this.mainChart) { this.mainChart.remove(); this.mainChart = null; }
    if (this.rsiChart) { this.rsiChart.remove(); this.rsiChart = null; }
    if (this.macdChart) { this.macdChart.remove(); this.macdChart = null; }
    if (this.stochChart) { this.stochChart.remove(); this.stochChart = null; }
    if (this.cciChart) { this.cciChart.remove(); this.cciChart = null; }
    if (this.adxChart) { this.adxChart.remove(); this.adxChart = null; }
    if (this.willrChart) { this.willrChart.remove(); this.willrChart = null; }
    if (this.atrChart) { this.atrChart.remove(); this.atrChart = null; }

    // 참조 초기화
    this.candleSeries = null;
    this.volumeSeries = null;
    this.indicatorSeries = {};
    this.trendlineSeries = [];
    this.rsiSeries = null;
    this.rsiPriceLines = [];
    this.stochKSeries = null; this.stochDSeries = null;
    this.cciSeries = null;
    this.adxSeries = null; this.adxPlusDISeries = null; this.adxMinusDISeries = null;
    this.willrSeries = null;
    this.atrSeries = null;
    this.macdLineSeries = null;
    this.macdSignalSeries = null;
    this.macdHistSeries = null;
    this._currentPriceLine = null;
    this._lastVisibleHigh = null;
    this._lastVisibleLow = null;
    this._volMaSeries = null;
    this._ohlcCallback = null;
    this._tooltipCallback = null;
    this._hoverPatterns = [];
    this._hoverSignals = [];
    this._hoverCandles = [];
    this._shouldSetInitialRange = false;
    this._indicatorCache = { key: null, results: {} };
    this._lastDataKey = {};
    this._lastRsiValues = null;
    this._lastMacdValues = null;
    // 주의: _visibleRangeCallback은 유지 — init()에서 한 번만 등록하며
    // destroyAll() → createMainChart() 후에도 _subscribeVisibleRange()에서
    // 기존 콜백을 자동으로 새 차트에 재연결함
    // this._visibleRangeCallback = null;  // 의도적으로 보존
  }

  /** 현재가 가격선 업데이트 (고/저점은 updateVisibleHighLow에서 관리) */
  updatePriceLines(currentPrice, dayHigh, dayLow, prevClose) {
    if (!this.candleSeries) return;

    // [FIX] 기존 현재가 가격선 제거 + null 초기화 (중복 라벨 방지)
    if (this._currentPriceLine) {
      try { this.candleSeries.removePriceLine(this._currentPriceLine); } catch (e) {}
      this._currentPriceLine = null;
    }

    const isUp = currentPrice >= (prevClose || currentPrice);

    // 현재가 라인 (실선)
    this._currentPriceLine = this.candleSeries.createPriceLine({
      price: currentPrice,
      color: isUp ? KRX_COLORS.UP : KRX_COLORS.DOWN,
      lineWidth: 1,
      lineStyle: 0,
      axisLabelVisible: true,
      title: '',
    });
    // dayHigh/dayLow 인자는 시그니처 호환을 위해 유지하나 내부 미사용
    // → visible range 기반 고/저점은 updateVisibleHighLow()가 전담
  }

  /**
   * visible range 기준 고/저점 — 축 태그 + 캔들→우측 점선
   * 방법 D: createPriceLine(lineVisible:false) → 축 태그만 표시
   *         ISeriesPrimitive(_HighLowPrimitive) → 캔들 x → 우측 끝 점선
   * — _subscribeVisibleRange() 콜백 내에서 호출되도록 설계
   * — 실제 연결은 app.js가 담당
   * @param {Array} candles — 전체 candles 배열
   */
  updateVisibleHighLow(candles) {
    if (!this.mainChart || !this.candleSeries || !candles || !candles.length) return;

    var range = this.mainChart.timeScale().getVisibleLogicalRange();
    if (!range) return;

    var from = Math.max(0, Math.floor(range.from));
    var to = Math.min(candles.length - 1, Math.ceil(range.to));
    if (from > to) return;

    // visible 구간에서 최고가/최저가 + 해당 인덱스 계산
    var visHigh = -Infinity, visLow = Infinity;
    var highIdx = from, lowIdx = from;
    for (var i = from; i <= to; i++) {
      if (candles[i].high > visHigh) { visHigh = candles[i].high; highIdx = i; }
      if (candles[i].low < visLow) { visLow = candles[i].low; lowIdx = i; }
    }

    if (!isFinite(visHigh) || !isFinite(visLow)) return;

    // 이전 고/저점과 동일하면 불필요한 업데이트 스킵 (가격+캔들 인덱스 모두 비교)
    if (visHigh === this._lastVisibleHigh && visLow === this._lastVisibleLow
        && highIdx === this._visHighIdx && lowIdx === this._visLowIdx) return;
    this._lastVisibleHigh = visHigh;
    this._lastVisibleLow = visLow;
    this._visHighIdx = highIdx;
    this._visLowIdx = lowIdx;

    // ── 기존 축 태그 가격선 제거 ──
    if (this._visHighLine) {
      try { this.candleSeries.removePriceLine(this._visHighLine); } catch (e) {}
      this._visHighLine = null;
    }
    if (this._visLowLine) {
      try { this.candleSeries.removePriceLine(this._visLowLine); } catch (e) {}
      this._visLowLine = null;
    }

    // 현재가와 동일하면 라인 생략 (현재가 라인과 겹침 방지)
    var lastClose = candles[candles.length - 1].close;

    // ── 고점: 축 태그만 (lineVisible:false) ──
    var highTime = null;
    if (visHigh !== lastClose) {
      this._visHighLine = this.candleSeries.createPriceLine({
        price: visHigh,
        color: 'rgba(0,0,0,0)',             // 투명 — 실선 안 보이게
        lineWidth: 1,
        lineStyle: 2,
        lineVisible: false,
        axisLabelVisible: true,
        axisLabelColor: KRX_COLORS.UP_FILL(0.8),
        axisLabelTextColor: '#ffffff',
        title: '',
      });
      highTime = candles[highIdx].time;
    }

    // ── 저점: 축 태그만 (lineVisible:false) — 밝은 하늘색 (볼륨과 구분) ──
    var lowTime = null;
    if (visLow !== lastClose) {
      this._visLowLine = this.candleSeries.createPriceLine({
        price: visLow,
        color: 'rgba(0,0,0,0)',             // 투명 — 실선 안 보이게
        lineWidth: 1,
        lineStyle: 2,
        lineVisible: false,
        axisLabelVisible: true,
        axisLabelColor: KRX_COLORS.VIS_LOW_FILL(0.8),
        axisLabelTextColor: '#ffffff',
        title: '',
      });
      lowTime = candles[lowIdx].time;
    }

    // ── ISeriesPrimitive: 캔들→우측 점선 ──
    // primitive가 없으면 생성 + attach
    if (!this._visHighLowPrimitive) {
      this._visHighLowPrimitive = new _HighLowPrimitive();
      this.candleSeries.attachPrimitive(this._visHighLowPrimitive);
    }

    // 데이터 갱신 → requestUpdate (마지막 캔들 time 전달 → 점선 끝점 제한)
    var lastCandleTime = candles[candles.length - 1].time;
    this._visHighLowPrimitive.setHighLow(
      visHigh !== lastClose ? visHigh : null, highTime,
      visLow !== lastClose ? visLow : null, lowTime,
      lastCandleTime
    );
  }

  /** 워터마크 설정 (종목명 배경 표시) */
  setWatermark(text) {
    if (!this.mainChart) return;
    this.mainChart.applyOptions({
      watermark: {
        visible: true,
        fontSize: 48,
        horzAlign: 'center',
        vertAlign: 'center',
        color: KRX_COLORS.CHART_WATERMARK,
        text: text,
      },
    });
  }

  /** OHLC 크로스헤어 콜백 등록 */
  onCrosshairMove(callback) {
    this._ohlcCallback = callback;
  }

  /** 패턴/시그널 호버 툴팁 콜백 등록 */
  onPatternHover(callback) {
    this._tooltipCallback = callback;
  }

  /** 호버 감지용 패턴/시그널 데이터 설정 */
  setHoverData(candles, patterns, signals) {
    this._hoverCandles = candles || [];
    this._hoverPatterns = patterns || [];
    this._hoverSignals = signals || [];
  }

  /**
   * 크로스헤어 위치에서 패턴/시그널 호버 감지
   * param.time과 각 패턴의 startIndex~endIndex 범위를 비교
   */
  _handlePatternHover(param) {
    if (!this._tooltipCallback) return;
    if (!param.time || !this._hoverCandles.length) {
      this._tooltipCallback(null);
      return;
    }

    const crosshairTime = param.time;
    const candles = this._hoverCandles;

    // crosshairTime에 해당하는 candle index 찾기
    // [FIX] String 변환으로 비교 — 캔들 time이 문자열("2026-03-12")이고
    // crosshairTime이 다른 타입일 때 strict === 실패하는 버그 수정
    const crossIdx = candles.findIndex(c => String(c.time) === String(crosshairTime));
    if (crossIdx < 0) {
      this._tooltipCallback(null);
      return;
    }

    // +-1봉 여유를 두고 패턴/시그널 탐색
    const tolerance = 1;
    const matches = [];

    // 패턴 매칭
    for (const p of this._hoverPatterns) {
      const si = p.startIndex != null ? p.startIndex : 0;
      const ei = p.endIndex != null ? p.endIndex : si;
      if (crossIdx >= si - tolerance && crossIdx <= ei + tolerance) {
        // 진입가: 패턴 완성 봉(endIndex)의 종가
        const entryIdx = Math.min(ei, candles.length - 1);
        const entryPrice = candles[entryIdx] ? candles[entryIdx].close : null;
        matches.push({
          source: 'pattern',
          type: p.type,
          name: p.nameShort || p.type,
          signal: p.signal || 'neutral',
          confidence: p.confidence,
          strength: p.strength,
          description: p.description || '',
          stopLoss: p.stopLoss,
          priceTarget: p.priceTarget,
          entryPrice: entryPrice,
          confluence: p.confluence,
        });
      }
    }

    // 시그널 매칭 (index 기반)
    for (const s of this._hoverSignals) {
      if (s.index >= crossIdx - tolerance && s.index <= crossIdx + tolerance) {
        matches.push({
          source: s.source || 'indicator',
          name: s.nameShort || s.type,
          signal: s.signal || 'neutral',
          confidence: s.confidence,
          strength: s.strength,
          description: s.description || '',
          tier: s.tier,
        });
      }
    }

    if (matches.length === 0) {
      this._tooltipCallback(null);
      return;
    }

    // 최고 신뢰도 항목 선택 (최대 2개 표시)
    matches.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const topMatches = matches.slice(0, 2);

    // 마우스 좌표 추정: param.point가 있으면 사용
    const point = param.point || null;

    this._tooltipCallback({
      items: topMatches,
      point: point,
      time: crosshairTime,
    });
  }
}

// 글로벌 인스턴스
const chartManager = new ChartManager();
