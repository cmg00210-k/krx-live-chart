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
  const BUY_FILL    = KRX_COLORS.UP_FILL(0.10);
  const SELL_COLOR   = KRX_COLORS.DOWN;
  const SELL_FILL    = KRX_COLORS.DOWN_FILL(0.10);

  // 최근 N봉 이내 시그널만 표시 (차트 혼잡 방지)
  const RECENT_BAR_LIMIT = 50;

  // ── 밀도 제한 (시각 혼잡 방지) ──
  const MAX_DIAMONDS = 6;     // MA/EMA 크로스 다이아몬드 최대 표시 수
  const MAX_STARS = 2;        // Tier 1 복합 시그널 별 최대 표시 수
  const MAX_DIV_LINES = 4;   // 다이버전스 라인 최대 표시 수 (MACD 2 + RSI 2)


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
        const { vbands, diamonds, stars, divLines, volLabels } = this._data;

        // 빈 데이터면 즉시 반환
        const hasVolLabels = volLabels && volLabels.length;
        if (!vbands.length && !diamonds.length && !stars.length && !divLines.length && !hasVolLabels) return;

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
            ctx.setLineDash(dl.dash || [5, 3]);
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
            const half = (d.size || 10) / 2;
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

        // ── 5. 거래량 급증 라벨 ("거래↑") ──
        if (hasVolLabels) {
          const labelText = '거래\u2191';
          ctx.font = '600 10px "JetBrains Mono", monospace';
          const textMetrics = ctx.measureText(labelText);
          const textW = textMetrics.width;
          const padH = 3;   // 좌우 패딩
          const padV = 2;   // 상하 패딩
          const boxW = textW + padH * 2;
          const boxH = 12 + padV * 2;  // 10px 폰트 + 패딩
          const labelY = h * 0.80;     // 차트 높이의 80% 위치 (볼륨 히스토그램 상단)
          const MIN_LABEL_GAP = 30;    // 라벨 간 최소 간격 (px)

          let prevLabelX = -Infinity;

          volLabels.forEach(vl => {
            if (vl.x == null) return;
            // 겹침 방지: 직전 라벨과 30px 이상 떨어져야 표시
            if (vl.x - prevLabelX < MIN_LABEL_GAP) return;

            const bx = vl.x - boxW / 2;
            const by = labelY - boxH / 2;

            // 배경 (반투명 다크)
            ctx.fillStyle = KRX_COLORS.TAG_BG(0.85);
            ctx.beginPath();
            _roundRect(ctx, bx, by, boxW, boxH, 3);
            ctx.fill();

            // 텍스트 (금색)
            ctx.fillStyle = KRX_COLORS.ACCENT;
            ctx.globalAlpha = 0.95;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, vl.x, labelY);
            ctx.globalAlpha = 1;

            prevLabelX = vl.x;
          });
        }

        ctx.restore();
      });
    }
  }


  // ══════════════════════════════════════════════════
  //  roundRect 유틸리티 (브라우저 호환 — patternRenderer.js와 동일 패턴)
  // ══════════════════════════════════════════════════

  function _roundRect(ctx, x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    const [tl, tr, br, bl] = r;
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
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
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }


  // ══════════════════════════════════════════════════
  //  Background PaneView — 수직 Band (zOrder 'bottom')
  // ══════════════════════════════════════════════════

  class SignalBgPaneView {
    constructor(source) {
      this._source = source;
      this._drawData = { vbands: [], diamonds: [], stars: [], divLines: [], volLabels: [] };
    }

    zOrder() { return 'bottom'; }

    update() {
      const src = this._source;
      if (!src._chart || !src._series || !src._signals) {
        this._drawData = { vbands: [], diamonds: [], stars: [], divLines: [], volLabels: [] };
        return;
      }

      const { candles, signals } = src._signals;
      const series = src._series;
      const ts = src._chart.timeScale();
      const lastIdx = candles.length - 1;
      // [Phase3-A] Zoom-aware cutoff: 줌인 시 visible 범위 전체 포함
      const effectiveLimit = Math.max(RECENT_BAR_LIMIT, src._visibleBars || 0);
      const cutoff = lastIdx - effectiveLimit;

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

      this._drawData = { vbands, diamonds: [], stars: [], divLines: [], volLabels: [] };
    }

    renderer() { return new SignalCanvasRenderer(this._drawData); }
  }


  // ══════════════════════════════════════════════════
  //  Foreground PaneView — 다이아몬드, 별, 다이버전스 (zOrder 'top')
  // ══════════════════════════════════════════════════

  class SignalFgPaneView {
    constructor(source) {
      this._source = source;
      this._drawData = { vbands: [], diamonds: [], stars: [], divLines: [], volLabels: [] };
    }

    zOrder() { return 'top'; }

    update() {
      const src = this._source;
      if (!src._chart || !src._series || !src._signals) {
        this._drawData = { vbands: [], diamonds: [], stars: [], divLines: [], volLabels: [] };
        return;
      }

      const { candles, signals } = src._signals;
      const series = src._series;
      const ts = src._chart.timeScale();
      const lastIdx = candles.length - 1;
      // [Phase3-A] Zoom-aware cutoff: 줌인 시 visible 범위 전체 포함
      const effectiveLimit = Math.max(RECENT_BAR_LIMIT, src._visibleBars || 0);
      const cutoff = lastIdx - effectiveLimit;

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
            size: (s.strength === 'strong' ? 10 : 8) * (s.wc != null ? Math.max(0.7, Math.min(s.wc, 1.5)) : 1),
            confidence: s.confidence || 0,
            wc: s.wc || 1,
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
            size: 12 * (s.wc != null ? Math.max(0.7, Math.min(s.wc, 1.5)) : 1),
            confidence: s.confidence || 0,
            wc: s.wc || 1,
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
        if (s.type === 'macdHiddenBullishDivergence' || s.type === 'rsiHiddenBullishDivergence') {
          // 히든 강세 다이버전스: 가격 저점 상승 + 지표 저점 하락
          _buildDivergenceLine(s, candles, ts, series, cutoff, 'low', BUY_COLOR, divLines);
        }
        if (s.type === 'macdHiddenBearishDivergence' || s.type === 'rsiHiddenBearishDivergence') {
          // 히든 약세 다이버전스: 가격 고점 하락 + 지표 고점 상승
          _buildDivergenceLine(s, candles, ts, series, cutoff, 'high', SELL_COLOR, divLines);
        }
      });

      // ── 밀도 제한: confidence 내림차순 정렬 후 상위 N개만 유지 ──
      if (diamonds.length > MAX_DIAMONDS) {
        diamonds.sort((a, b) => b.confidence - a.confidence);
        diamonds.length = MAX_DIAMONDS;
      }
      if (stars.length > MAX_STARS) {
        stars.sort((a, b) => b.confidence - a.confidence);
        stars.length = MAX_STARS;
      }
      if (divLines.length > MAX_DIV_LINES) {
        divLines.length = MAX_DIV_LINES;
      }

      // ── 거래량 급증 라벨 좌표 계산 ──
      const volLabels = [];
      const breakoutLabels = src._volBreakoutLabels;
      if (breakoutLabels && breakoutLabels.length) {
        breakoutLabels.forEach(bl => {
          const x = ts.timeToCoordinate(bl.time);
          if (x == null) return;
          volLabels.push({ x });
        });
        // x좌표 오름차순 정렬 (겹침 방지 로직에 필요)
        volLabels.sort((a, b) => a.x - b.x);
      }

      this._drawData = { vbands: [], diamonds, stars, divLines, volLabels };
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
      dash: [5, 3],
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
      this._volBreakoutLabels = [];  // _highlightVolume()에서 수집한 breakout 봉 위치
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

    setSignals(candles, signals, visibleBars) {
      this._signals = { candles, signals };
      this._visibleBars = visibleBars || 0;
      if (this._requestUpdate) this._requestUpdate();
    }

    clearSignals() {
      this._signals = null;
      this._volBreakoutLabels = [];
      if (this._requestUpdate) this._requestUpdate();
    }
  }


  // ══════════════════════════════════════════════════
  //  거래량 강조 (volumeSeries 색상 변경)
  //  [FIX] breakout 봉만 개별 update()로 색상 오버라이드
  //  chart.js updateMain()의 동적 투명도 볼륨 색상을 기본으로 유지하고
  //  breakout 봉만 accent 색상으로 덮어씀 (setData() 전체 덮어쓰기 제거)
  // ══════════════════════════════════════════════════

  function _highlightVolume(cm, candles, signals) {
    if (!cm.volumeSeries || !candles || !candles.length) return;

    const lastIdx = candles.length - 1;
    // [Phase3-A] Zoom-aware cutoff
    const vbLimit = (_primitive && _primitive._visibleBars) ? Math.max(RECENT_BAR_LIMIT, _primitive._visibleBars) : RECENT_BAR_LIMIT;
    const cutoff = lastIdx - vbLimit;

    // 거래량 급증 인덱스 수집
    const volBreakoutSet = new Set();
    signals.forEach(s => {
      if (s.index <= cutoff) return;
      if (s.type === 'volumeBreakout' || s.type === 'volumeSelloff') {
        volBreakoutSet.add(s.index);
      }
    });

    // primitive에 breakout 라벨 데이터 저장 (봉이 0개여도 빈 배열로 초기화)
    const breakoutLabels = [];
    volBreakoutSet.forEach(function(idx) {
      if (idx < 0 || idx >= candles.length) return;
      breakoutLabels.push({ time: candles[idx].time, index: idx });
    });
    if (_primitive) {
      _primitive._volBreakoutLabels = breakoutLabels;
      if (_primitive._requestUpdate) _primitive._requestUpdate();
    }

    if (volBreakoutSet.size === 0) return;

    // [FIX] breakout 봉만 개별 update()로 accent 색상 오버라이드
    // chart.js updateMain()의 동적 투명도 색상(0.15/0.25/0.45)을 보존하면서
    // breakout 봉만 ACCENT_FILL(0.7)로 강조
    volBreakoutSet.forEach(function(idx) {
      if (idx < 0 || idx >= candles.length) return;
      var c = candles[idx];
      try {
        cm.volumeSeries.update({
          time: c.time,
          value: c.volume || 0,
          color: KRX_COLORS.ACCENT_FILL(0.7),
        });
      } catch (e) { /* LWC: time outside displayed range */ }
    });
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
    // [FIX-6] 라인 모드 _priceLine null 안전 처리
    const ct = (opts && opts.chartType) || 'candle';
    const targetSeries = (ct === 'line' && cm.indicatorSeries._priceLine)
      ? cm.indicatorSeries._priceLine : cm.candleSeries;
    if (!targetSeries) return;
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

    // [Phase3-A] visible range에서 봉 수 계산 → zoom-aware cutoff
    var visibleBars = 0;
    var vr = cm.mainChart.timeScale().getVisibleLogicalRange();
    if (vr) visibleBars = Math.ceil(vr.to - vr.from);

    // primitive에 시그널 데이터 설정
    _primitive.setSignals(candles, signals, visibleBars);

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
