// ══════════════════════════════════════════════════════
//  시그널 시각화 렌더러 (ISeriesPrimitive — Canvas 직접 그리기)
//
//  signalEngine.analyze() 결과를 Canvas2D로 메인 차트 위에 표시
//  - MA/EMA 크로스: 다이아몬드 마커 + 수직 Band
//  - Tier 1 복합 시그널: 별(★) 마커
//  - 다이버전스: 가격 고/저점 연결 점선
//  - 거래량 급증: volumeSeries 색상 강조
//
//  patternRenderer.js와 동일한 ISeriesPrimitive 패턴 사용
// ══════════════════════════════════════════════════════

const signalRenderer = (() => {

  let _primitive = null;
  let _attachedSeries = null;

  // ── 색상 (KRX_COLORS 참조) ──
  const BUY_COLOR   = KRX_COLORS.UP;
  const BUY_FILL    = KRX_COLORS.UP_FILL(0.06);
  const SELL_COLOR   = KRX_COLORS.DOWN;
  const SELL_FILL    = KRX_COLORS.DOWN_FILL(0.06);

  // 최근 N봉 이내 시그널만 표시 (차트 혼잡 방지)
  const RECENT_BAR_LIMIT = 50;


  // ══════════════════════════════════════════════════
  //  Renderer — Canvas2D 직접 드로잉
  // ══════════════════════════════════════════════════

  class SignalCanvasRenderer {
    constructor(data) { this._data = data; }

    draw(target) {
      target.useMediaCoordinateSpace(scope => {
        const ctx = scope.context;
        const w = scope.mediaSize.width;
        const h = scope.mediaSize.height;
        const { vbands, diamonds, stars, divLines } = this._data;

        // 빈 데이터면 즉시 반환
        if (!vbands.length && !diamonds.length && !stars.length && !divLines.length) return;

        ctx.save();

        // ── 1. 수직 Band (크로스 이벤트 배경) ──
        vbands.forEach(b => {
          if (b.x1 == null || b.x2 == null) return;
          const bx = Math.min(b.x1, b.x2);
          const bw = Math.abs(b.x2 - b.x1);
          ctx.fillStyle = b.fill;
          ctx.fillRect(bx, 0, Math.max(bw, 2), h);
        });

        // ── 2. 다이버전스 라인 (점선) ──
        if (divLines.length) {
          ctx.globalAlpha = 0.7;
          divLines.forEach(dl => {
            if (dl.x1 == null || dl.y1 == null || dl.x2 == null || dl.y2 == null) return;
            ctx.beginPath();
            ctx.moveTo(dl.x1, dl.y1);
            ctx.lineTo(dl.x2, dl.y2);
            ctx.strokeStyle = dl.color;
            ctx.lineWidth = dl.width || 1.5;
            ctx.setLineDash(dl.dash || [6, 3]);
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
        }

        // ── 3. 다이아몬드 마커 (MA/EMA 크로스) ──
        // 회전 변환을 save/restore 대신 수동 좌표 계산으로 최적화
        if (diamonds.length) {
          ctx.lineWidth = 1;
          diamonds.forEach(d => {
            if (d.x == null || d.y == null) return;
            const half = (d.size || 8) / 2;
            // 45도 회전된 정사각형 = 다이아몬드 (꼭짓점 좌표 직접 계산)
            ctx.beginPath();
            ctx.moveTo(d.x, d.y - half);       // 위
            ctx.lineTo(d.x + half, d.y);       // 오른쪽
            ctx.lineTo(d.x, d.y + half);       // 아래
            ctx.lineTo(d.x - half, d.y);       // 왼쪽
            ctx.closePath();
            ctx.fillStyle = d.color;
            ctx.globalAlpha = 0.85;
            ctx.fill();
            ctx.strokeStyle = d.color;
            ctx.globalAlpha = 1;
            ctx.stroke();
          });
        }

        // ── 4. 별 마커 (Tier 1 복합 시그널) ──
        stars.forEach(s => {
          if (s.x == null || s.y == null) return;
          _drawStar(ctx, s.x, s.y, s.size || 8, s.color);
        });

        ctx.restore();
      });
    }
  }


  // ══════════════════════════════════════════════════
  //  별(5각) 그리기 유틸리티
  // ══════════════════════════════════════════════════

  function _drawStar(ctx, x, y, r, color) {
    const outerR = r;
    const innerR = r * 0.4;
    const spikes = 5;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const radius = i % 2 === 0 ? outerR : innerR;
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();

    // 채우기 + 테두리
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.strokeStyle = KRX_COLORS.CHART_TEXT;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }


  // ══════════════════════════════════════════════════
  //  Background PaneView — 수직 Band (zOrder 'bottom')
  // ══════════════════════════════════════════════════

  class SignalBgPaneView {
    constructor(source) {
      this._source = source;
      this._drawData = { vbands: [], diamonds: [], stars: [], divLines: [] };
    }

    zOrder() { return 'bottom'; }

    update() {
      const src = this._source;
      if (!src._chart || !src._series || !src._signals) {
        this._drawData = { vbands: [], diamonds: [], stars: [], divLines: [] };
        return;
      }

      const { candles, signals } = src._signals;
      const series = src._series;
      const ts = src._chart.timeScale();
      const lastIdx = candles.length - 1;
      const cutoff = lastIdx - RECENT_BAR_LIMIT;

      const vbands = [];

      // MA/EMA 크로스 수직 Band
      signals.forEach(s => {
        if (s.index <= cutoff) return;
        if (s.type !== 'goldenCross' && s.type !== 'deadCross') return;

        const isBuy = s.type === 'goldenCross';
        const ci = s.index;
        // +-2봉 범위
        const li = Math.max(0, ci - 2);
        const ri = Math.min(lastIdx, ci + 2);

        const x1 = ts.timeToCoordinate(candles[li].time);
        const x2 = ts.timeToCoordinate(candles[ri].time);
        if (x1 == null || x2 == null) return;

        vbands.push({
          x1, x2,
          fill: isBuy ? BUY_FILL : SELL_FILL,
        });
      });

      this._drawData = { vbands, diamonds: [], stars: [], divLines: [] };
    }

    renderer() { return new SignalCanvasRenderer(this._drawData); }
  }


  // ══════════════════════════════════════════════════
  //  Foreground PaneView — 다이아몬드, 별, 다이버전스 (zOrder 'top')
  // ══════════════════════════════════════════════════

  class SignalFgPaneView {
    constructor(source) {
      this._source = source;
      this._drawData = { vbands: [], diamonds: [], stars: [], divLines: [] };
    }

    zOrder() { return 'top'; }

    update() {
      const src = this._source;
      if (!src._chart || !src._series || !src._signals) {
        this._drawData = { vbands: [], diamonds: [], stars: [], divLines: [] };
        return;
      }

      const { candles, signals } = src._signals;
      const series = src._series;
      const ts = src._chart.timeScale();
      const lastIdx = candles.length - 1;
      const cutoff = lastIdx - RECENT_BAR_LIMIT;

      const diamonds = [];
      const stars = [];
      const divLines = [];

      signals.forEach(s => {
        if (s.index <= cutoff || s.index >= candles.length) return;

        const c = candles[s.index];

        // ── 다이아몬드: MA/EMA 크로스 ──
        if (s.type === 'goldenCross' || s.type === 'deadCross') {
          const isBuy = s.type === 'goldenCross';
          // 교차 지점 가격 (MA5와 MA20의 평균 부근 = close 사용)
          const price = isBuy ? c.low : c.high;
          const offset = isBuy ? (c.high - c.low) * 0.3 : -(c.high - c.low) * 0.3;
          const x = ts.timeToCoordinate(c.time);
          const y = series.priceToCoordinate(price - offset * (isBuy ? 1 : -1));
          if (x == null || y == null) return;

          diamonds.push({
            x, y,
            color: isBuy ? BUY_COLOR : SELL_COLOR,
            size: s.strength === 'strong' ? 10 : 8,
          });
        }

        // ── 별: Tier 1 복합 시그널 ──
        if (s.type === 'composite' && s.tier === 1) {
          const isBuy = s.signal === 'buy';
          const price = isBuy ? c.low : c.high;
          // 봉 바깥으로 충분히 오프셋
          const bodyRange = Math.abs(c.high - c.low) || 1;
          const offsetPrice = isBuy
            ? price - bodyRange * 0.5
            : price + bodyRange * 0.5;

          const x = ts.timeToCoordinate(c.time);
          const y = series.priceToCoordinate(offsetPrice);
          if (x == null || y == null) return;

          stars.push({
            x, y,
            color: isBuy ? BUY_COLOR : SELL_COLOR,
            size: 10,
          });
        }

        // ── 다이버전스 라인: 가격 위에 점선 ──
        if (s.type === 'macdBullishDivergence' || s.type === 'rsiBullishDivergence') {
          // 강세 다이버전스: 가격 저점 두 개를 잇는 하락선
          _buildDivergenceLine(s, candles, ts, series, cutoff, 'low', BUY_COLOR, divLines);
        }
        if (s.type === 'macdBearishDivergence' || s.type === 'rsiBearishDivergence') {
          // 약세 다이버전스: 가격 고점 두 개를 잇는 상승선
          _buildDivergenceLine(s, candles, ts, series, cutoff, 'high', SELL_COLOR, divLines);
        }
      });

      this._drawData = { vbands: [], diamonds, stars, divLines };
    }

    renderer() { return new SignalCanvasRenderer(this._drawData); }
  }


  // ══════════════════════════════════════════════════
  //  다이버전스 라인 빌더
  //  signalEngine._detectDivergence에서 스윙 포인트 간 비교하므로
  //  현재 시그널의 index를 기준으로 이전 스윙 포인트를 역추적
  // ══════════════════════════════════════════════════

  function _buildDivergenceLine(signal, candles, ts, series, cutoff, priceKey, color, divLines) {
    const currIdx = signal.index;
    if (currIdx >= candles.length) return;

    // 이전 스윙 포인트 역추적: 같은 방향 스윙을 최근 20봉 내 찾기
    const lookback = 20;
    const swingOrder = 3;
    let prevSwingIdx = -1;

    const compareFn = priceKey === 'low'
      ? (a, b) => a <= b    // 저점: 주변보다 낮은 봉
      : (a, b) => a >= b;   // 고점: 주변보다 높은 봉

    for (let i = currIdx - 1; i >= Math.max(0, currIdx - lookback); i--) {
      let isSwing = true;
      for (let j = 1; j <= swingOrder; j++) {
        if (i - j < 0 || i + j >= candles.length) { isSwing = false; break; }
        if (!compareFn(candles[i][priceKey], candles[i - j][priceKey]) ||
            !compareFn(candles[i][priceKey], candles[i + j][priceKey])) {
          isSwing = false;
          break;
        }
      }
      if (isSwing) {
        prevSwingIdx = i;
        break;
      }
    }

    if (prevSwingIdx < 0 || prevSwingIdx <= cutoff) return;

    const x1 = ts.timeToCoordinate(candles[prevSwingIdx].time);
    const y1 = series.priceToCoordinate(candles[prevSwingIdx][priceKey]);
    const x2 = ts.timeToCoordinate(candles[currIdx].time);
    const y2 = series.priceToCoordinate(candles[currIdx][priceKey]);

    if (x1 == null || y1 == null || x2 == null || y2 == null) return;

    divLines.push({
      x1, y1, x2, y2,
      color,
      width: 1.5,
      dash: [6, 3],
    });
  }


  // ══════════════════════════════════════════════════
  //  Primitive — ISeriesPrimitive 구현체
  // ══════════════════════════════════════════════════

  class SignalOverlayPrimitive {
    constructor() {
      this._chart = null;
      this._series = null;
      this._requestUpdate = null;
      this._bgView = new SignalBgPaneView(this);
      this._fgView = new SignalFgPaneView(this);
      this._signals = null;
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

    updateAllViews() {
      this._bgView.update();
      this._fgView.update();
    }

    paneViews() { return [this._bgView, this._fgView]; }

    setSignals(candles, signals) {
      this._signals = { candles, signals };
      if (this._requestUpdate) this._requestUpdate();
    }

    clearSignals() {
      this._signals = null;
      if (this._requestUpdate) this._requestUpdate();
    }
  }


  // ══════════════════════════════════════════════════
  //  거래량 강조 (volumeSeries 색상 변경)
  //  별도 primitive 없이 chart.js의 volumeSeries 데이터 색상을 변경
  // ══════════════════════════════════════════════════

  function _highlightVolume(cm, candles, signals) {
    if (!cm.volumeSeries || !candles || !candles.length) return;

    const lastIdx = candles.length - 1;
    const cutoff = lastIdx - RECENT_BAR_LIMIT;

    // 거래량 급증 인덱스 수집
    const volBreakoutSet = new Set();
    signals.forEach(s => {
      if (s.index <= cutoff) return;
      if (s.type === 'volumeBreakout' || s.type === 'volumeSelloff') {
        volBreakoutSet.add(s.index);
      }
    });

    if (volBreakoutSet.size === 0) return;

    // 현재 volumeSeries 데이터를 재설정 (강조 색상 적용)
    const volData = candles.map((c, i) => {
      let color;
      if (volBreakoutSet.has(i)) {
        // 금색 테두리 효과: 밝은 금색으로 표시
        color = KRX_COLORS.ACCENT_FILL(0.7);
      } else {
        color = c.close >= c.open ? KRX_COLORS.UP_FILL(0.45) : KRX_COLORS.DOWN_FILL(0.45);
      }
      return { time: c.time, value: c.volume, color };
    });

    cm.volumeSeries.setData(volData);
  }


  // ══════════════════════════════════════════════════
  //  공개 API
  // ══════════════════════════════════════════════════

  /**
   * @param {ChartManager} cm — chartManager 인스턴스
   * @param {Array} candles — OHLCV 배열
   * @param {Array} signals — signalEngine.analyze() 결과의 signals 배열
   * @param {Object} [opts] — 옵션
   * @param {boolean} [opts.volumeActive] — 거래량 지표 활성화 여부
   */
  function render(cm, candles, signals, opts) {
    if (!cm.mainChart || !cm.candleSeries) {
      _primitive = null;
      _attachedSeries = null;
      return;
    }

    // 시리즈 재생성 감지 → primitive 재연결 (라인 모드: _priceLine 시리즈 사용)
    const ct = (opts && opts.chartType) || 'candle';
    const targetSeries = (ct === 'line' && cm.indicatorSeries._priceLine)
      ? cm.indicatorSeries._priceLine : cm.candleSeries;
    if (_attachedSeries !== targetSeries) {
      if (_primitive && _attachedSeries) {
        try { _attachedSeries.detachPrimitive(_primitive); } catch (e) {}
      }
      _primitive = new SignalOverlayPrimitive();
      targetSeries.attachPrimitive(_primitive);
      _attachedSeries = targetSeries;
    }

    if (!signals || !signals.length || !candles || !candles.length) {
      _primitive.clearSignals();
      return;
    }

    // primitive에 시그널 데이터 설정
    _primitive.setSignals(candles, signals);

    // 거래량 급증 강조 (volumeSeries 색상 변경 — vol 지표 활성 시에만)
    if (opts && opts.volumeActive) {
      _highlightVolume(cm, candles, signals);
    }
  }

  function cleanup() {
    if (_primitive && _attachedSeries) {
      try { _attachedSeries.detachPrimitive(_primitive); } catch (e) {}
    }
    _primitive = null;
    _attachedSeries = null;
  }

  return { render, cleanup };

})();
