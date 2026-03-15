// ══════════════════════════════════════════════════════
//  KRX LIVE — 차트 엔진 (TradingView Lightweight Charts)
//  지표 계산은 indicators.js에 분리
//  이 파일은 ChartManager 클래스만 포함
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

    // 가격선 참조 (현재가/고가/저가)
    this._currentPriceLine = null;
    this._highPriceLine = null;
    this._lowPriceLine = null;

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
      },
      localization: {
        locale: 'ko-KR',
        priceFormatter: (price) => Math.round(price).toLocaleString('ko-KR'),
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
        scaleMargins: { top: 0.12, bottom: 0.20 },
        autoScale: true,
        alignLabels: true,
        entireTextOnly: true,               // 잘린 가격 라벨 방지
      },
      timeScale: {
        borderColor: KRX_COLORS.CHART_BORDER,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,                     // 우측 여백 확대 (현재가 라벨 가독성)
        // KNOWSTOCK: c_width = max(2, min(15, int(x_step * 0.70)))
        // x_step(캔들 간격)의 70%가 캔들 몸통 → barSpacing 10px이면 몸통 7px
        // 증권사 HTS 기본값(8-10px 간격)에 맞춤
        barSpacing: 10,                     // 캔들 간격 (12→10: 더 많은 봉 표시)
        minBarSpacing: 3,                   // 최소 캔들 간격 (4→3: 축소 시 더 많은 봉)
        fixLeftEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      // ── 줌 비활성화: 드래그 스크롤만 허용 (KNOWSTOCK 참고) ──
      // KNOWSTOCK chart_widget.py는 _zoom + _offset 기반이지만
      // Lightweight Charts는 handleScale/handleScroll로 제어
      handleScale: {
        mouseWheel: false,             // 마우스 휠 줌 비활성화
        pinch: false,                  // 핀치 줌 비활성화
        axisPressedMouseMove: false,   // 축 드래그 줌 비활성화
      },
      handleScroll: {
        mouseWheel: false,             // 휠 스크롤도 비활성화
        pressedMouseMove: true,        // 마우스 드래그 스크롤 허용
        horzTouchDrag: true,           // 터치 수평 드래그 허용
        vertTouchDrag: false,          // 수직 터치 비활성화
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
            this._ohlcCallback({ open: data.open, high: data.high, low: data.low, close: data.close, volume: null, type: 'crosshair' });
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
  updateMain(candles, chartType, activeIndicators, patterns) {
    if (!this.mainChart || !candles || !candles.length) return;

    const times = candles.map(c => c.time);
    const closes = candles.map(c => c.close);

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

    // ── 거래량 ──
    if (activeIndicators.has('vol')) {
      this.volumeSeries.setData(candles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? KRX_COLORS.UP_FILL(0.45) : KRX_COLORS.DOWN_FILL(0.45),
      })));
    } else {
      this.volumeSeries.setData([]);
    }

    // ── 이동평균 (MA) — 충돌 방지 팔레트 ──
    this._updateIndicatorLine('ma5', activeIndicators.has('ma'),
      times, calcMA(closes, 5), KRX_COLORS.MA_SHORT, 1);    // 코랄 (단기)
    this._updateIndicatorLine('ma20', activeIndicators.has('ma'),
      times, calcMA(closes, 20), KRX_COLORS.MA_MID, 1);   // 골드 (중기)
    this._updateIndicatorLine('ma60', activeIndicators.has('ma'),
      times, calcMA(closes, 60), KRX_COLORS.MA_LONG, 1);   // 민트 (장기)

    // ── EMA — 보라 계열 (MA와 구분) ──
    this._updateIndicatorLine('ema12', activeIndicators.has('ema'),
      times, calcEMA(closes, 12), KRX_COLORS.EMA_12, 1);  // 라벤더
    this._updateIndicatorLine('ema26', activeIndicators.has('ema'),
      times, calcEMA(closes, 26), KRX_COLORS.EMA_26, 1);  // 슬레이트블루

    // ── 일목균형표 — 각 요소 고유색 ──
    if (activeIndicators.has('ich')) {
      const ich = calcIchimoku(candles);
      this._updateIndicatorLine('ichTenkan', true, times,
        ich.tenkan, KRX_COLORS.ICH_TENKAN, 1);                  // 마젠타
      this._updateIndicatorLine('ichKijun', true, times,
        ich.kijun, KRX_COLORS.ICH_KIJUN, 1);                   // 틸그린
      this._updateIndicatorLine('ichSpanA', true, times,
        ich.spanA, KRX_COLORS.ICH_SPANA, 1);    // 연초록
      this._updateIndicatorLine('ichSpanB', true, times,
        ich.spanB, KRX_COLORS.ICH_SPANB, 1);    // 연빨강
      this._updateIndicatorLine('ichChikou', true, times,
        ich.chikou, KRX_COLORS.ICH_CHIKOU, 1);                  // 블루그레이
    } else {
      ['ichTenkan', 'ichKijun', 'ichSpanA', 'ichSpanB', 'ichChikou'].forEach(k =>
        this._removeIndicatorLine(k));
    }

    // ── 칼만 필터 ──
    if (activeIndicators.has('kalman')) {
      const kalman = calcKalman(closes);
      this._updateIndicatorLine('kalman', true, times, kalman, KRX_COLORS.KALMAN, 2);  // 라임
    } else {
      this._removeIndicatorLine('kalman');
    }

    // ── 볼린저 밴드 ──
    if (activeIndicators.has('bb')) {
      const bb = calcBB(closes);
      this._updateIndicatorLine('bbUpper', true,
        times, bb.map(b => b.upper), KRX_COLORS.BB, 1);              // 다크오렌지
      this._updateIndicatorLine('bbMid', true,
        times, bb.map(b => b.mid), KRX_COLORS.BB_MID, 1);   // 다크오렌지 40%
      this._updateIndicatorLine('bbLower', true,
        times, bb.map(b => b.lower), KRX_COLORS.BB, 1);              // 다크오렌지
    } else {
      this._removeIndicatorLine('bbUpper');
      this._removeIndicatorLine('bbMid');
      this._removeIndicatorLine('bbLower');
    }

    // ── 패턴 마커 & 추세선 ──
    this._drawPatterns(candles, chartType, patterns);
    if (typeof patternRenderer !== 'undefined') patternRenderer.render(this, candles, chartType, patterns);

    // ── 초기 표시 범위: 동적 barSpacing (컨테이너폭/17) 기반 ──
    // 약 12개 캔들 + rightOffset 5칸 표시
    // 최근 데이터를 우측에 배치하고 좌측으로 드래그하여 과거 탐색
    if (candles.length > 0 && this._shouldSetInitialRange) {
      this.mainChart.timeScale().scrollToPosition(3, false);
      this._shouldSetInitialRange = false;
    }
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

    // ── 마커 설정 (TradingView 스타일: 화살표만, 텍스트 없음) ──
    const markerMap = new Map();
    patterns.filter(p => p.marker).forEach(p => {
      const key = `${p.marker.time}-${p.marker.position}`;
      const existing = markerMap.get(key);
      if (!existing || (p.confidence || 0) > (existing._conf || 0)) {
        markerMap.set(key, { ...p.marker, _conf: p.confidence || 0 });
      }
    });
    const markers = [...markerMap.values()]
      .map(m => ({
        time: m.time,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text || '',
        size: 1,
      }))
      .sort((a, b) => typeof a.time === 'string' ? a.time.localeCompare(b.time) : a.time - b.time);

    markerSeries.setMarkers(markers);

    // ── 추세선 (삼각형, 쐐기 패턴) — 시리즈 풀링 ──
    // 필요한 추세선 데이터 수집
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

    // 부족분 생성 + 기존분 재활용
    trendlineData.forEach((tl, i) => {
      const color = tl.color || KRX_COLORS.PTN_STRUCT;
      const lineStyle = tl.style === 'dashed' ? 2 : 0;
      const data = tl.points.map(pt => ({ time: pt.time, value: pt.value }));

      if (i < existing) {
        // 기존 시리즈 재활용: 옵션 갱신 + 데이터 설정
        this.trendlineSeries[i].applyOptions({ color, lineStyle });
        this.trendlineSeries[i].setData(data);
      } else {
        // 새 시리즈 생성
        const series = this.mainChart.addLineSeries({
          color,
          lineWidth: 1.5,
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

    const isMainChart = (chart === this.mainChart);
    let rafId = null;
    const ro = new ResizeObserver(entries => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            try {
              const applyOpts = { width, height };
              // 메인 차트: 리사이즈 시 barSpacing 재계산 (약 12개 캔들 유지)
              if (isMainChart) {
                applyOpts.timeScale = {
                  barSpacing: Math.max(6, Math.floor(width / 17)),
                };
              }
              chart.applyOptions(applyOpts);
            } catch (e) {}
          }
        }
      });
    });
    ro.observe(container);
    this._resizeMap.set(container, { observer: ro, chart });
  }

  destroyAll() {
    // renderer cleanup (stale 참조 방지)
    if (typeof patternRenderer !== 'undefined' && patternRenderer.cleanup) patternRenderer.cleanup();
    if (typeof signalRenderer !== 'undefined' && signalRenderer.cleanup) signalRenderer.cleanup();

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
    this._currentPriceLine = null;
    this._highPriceLine = null;
    this._lowPriceLine = null;
    this._ohlcCallback = null;
    this._tooltipCallback = null;
    this._hoverPatterns = [];
    this._hoverSignals = [];
    this._hoverCandles = [];
    this._shouldSetInitialRange = false;
    // 주의: _visibleRangeCallback은 유지 — init()에서 한 번만 등록하며
    // destroyAll() → createMainChart() 후에도 _subscribeVisibleRange()에서
    // 기존 콜백을 자동으로 새 차트에 재연결함
    // this._visibleRangeCallback = null;  // 의도적으로 보존
  }

  /** 현재가/고가/저가 가격선 업데이트 */
  updatePriceLines(currentPrice, dayHigh, dayLow, prevClose) {
    if (!this.candleSeries) return;

    // 기존 가격선 제거
    if (this._currentPriceLine) {
      try { this.candleSeries.removePriceLine(this._currentPriceLine); } catch (e) {}
    }
    if (this._highPriceLine) {
      try { this.candleSeries.removePriceLine(this._highPriceLine); } catch (e) {}
    }
    if (this._lowPriceLine) {
      try { this.candleSeries.removePriceLine(this._lowPriceLine); } catch (e) {}
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

    // 고가 라인 (점선)
    if (dayHigh && dayHigh !== currentPrice) {
      this._highPriceLine = this.candleSeries.createPriceLine({
        price: dayHigh,
        color: KRX_COLORS.UP_FILL(0.4),
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: '고',
      });
    }

    // 저가 라인 (점선)
    if (dayLow && dayLow !== currentPrice) {
      this._lowPriceLine = this.candleSeries.createPriceLine({
        price: dayLow,
        color: KRX_COLORS.DOWN_FILL(0.4),
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: '저',
      });
    }
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
    const crossIdx = candles.findIndex(c => c.time === crosshairTime);
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
