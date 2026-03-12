// ══════════════════════════════════════════════════════
//  패턴 시각화 렌더러 v2.0 (ISeriesPrimitive — Canvas 직접 그리기)
//
//  기존 LineSeries 방식 → Canvas2D Primitive 방식으로 전환
//  채워진 직사각형, 반투명 영역, 자유로운 도형 그리기 가능
// ══════════════════════════════════════════════════════

const patternRenderer = (() => {

  let _primitive = null;
  let _attachedSeries = null;

  // ── 색상 ──
  const BUY_COLOR  = '#E05050';
  const BUY_FILL   = 'rgba(224,80,80,0.13)';
  const SELL_COLOR  = '#5086DC';
  const SELL_FILL   = 'rgba(80,134,220,0.13)';
  const GOLD_COLOR  = '#C9A84C';
  const NEUTRAL_COLOR = '#9e9e9e';
  const MAX_PATTERNS = 3;

  // ── 패턴별 설정 ──
  const ZONE_PATTERNS = {
    threeWhiteSoldiers: { color: BUY_COLOR, fill: BUY_FILL },
    threeBlackCrows:    { color: SELL_COLOR, fill: SELL_FILL },
    bullishEngulfing:   { color: BUY_COLOR, fill: BUY_FILL },
    bearishEngulfing:   { color: SELL_COLOR, fill: SELL_FILL },
    morningStar:        { color: BUY_COLOR, fill: BUY_FILL },
    eveningStar:        { color: SELL_COLOR, fill: SELL_FILL },
    bullishHarami:      { color: BUY_COLOR, fill: BUY_FILL, useBody: true },
    bearishHarami:      { color: SELL_COLOR, fill: SELL_FILL, useBody: true },
  };

  const SINGLE_PATTERNS = {
    hammer:         { key: 'low',   color: BUY_COLOR },
    invertedHammer: { key: 'high',  color: BUY_COLOR },
    hangingMan:     { key: 'low',   color: SELL_COLOR },
    shootingStar:   { key: 'high',  color: SELL_COLOR },
    doji:           { key: 'close', color: NEUTRAL_COLOR },
  };


  // ══════════════════════════════════════════════════
  //  Renderer — Canvas2D 직접 드로잉
  // ══════════════════════════════════════════════════

  class PatternRenderer {
    constructor(data) { this._data = data; }

    draw(target) {
      target.useMediaCoordinateSpace(scope => {
        const ctx = scope.context;
        const w = scope.mediaSize.width;
        const { rects, polylines, hlines } = this._data;

        ctx.save();

        // ── 1. 채워진 직사각형 (Zone Bracket) ──
        rects.forEach(r => {
          if (r.x1 == null || r.y1 == null || r.x2 == null || r.y2 == null) return;
          const rx = Math.min(r.x1, r.x2);
          const ry = Math.min(r.y1, r.y2);
          const rw = Math.abs(r.x2 - r.x1);
          const rh = Math.abs(r.y2 - r.y1);

          // 반투명 채우기
          ctx.fillStyle = r.fill;
          ctx.fillRect(rx, ry, rw, rh);

          // 점선 테두리
          ctx.strokeStyle = r.border;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(rx, ry, rw, rh);
        });

        // ── 2. 폴리라인 (W/M, 넥라인 연장 등) ──
        polylines.forEach(pl => {
          const pts = pl.points.filter(p => p.x != null && p.y != null);
          if (pts.length < 2) return;

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);

          ctx.strokeStyle = pl.color;
          ctx.lineWidth = pl.width || 1.5;
          ctx.setLineDash(pl.dash || []);
          ctx.stroke();
        });

        // ── 3. 수평선 (손절/목표/단일캔들 수준) ──
        hlines.forEach(h => {
          if (h.y == null) return;
          const x1 = h.x1 != null ? h.x1 : 0;
          const x2 = h.x2 != null ? h.x2 : w;

          ctx.beginPath();
          ctx.moveTo(x1, h.y);
          ctx.lineTo(x2, h.y);
          ctx.strokeStyle = h.color;
          ctx.lineWidth = h.width || 1;
          ctx.setLineDash(h.dash || [4, 3]);
          ctx.stroke();

          // 라벨 대신 끝점 삼각형 마커
          if (h.marker) {
            ctx.setLineDash([]);
            ctx.fillStyle = h.color;
            ctx.beginPath();
            if (h.marker === 'stop') {
              // ▼ 아래 삼각형 (손절)
              ctx.moveTo(w - 60, h.y - 6);
              ctx.lineTo(w - 54, h.y + 2);
              ctx.lineTo(w - 66, h.y + 2);
            } else {
              // ▲ 위 삼각형 (목표)
              ctx.moveTo(w - 60, h.y + 6);
              ctx.lineTo(w - 54, h.y - 2);
              ctx.lineTo(w - 66, h.y - 2);
            }
            ctx.fill();
          }
        });

        ctx.restore();
      });
    }
  }


  // ══════════════════════════════════════════════════
  //  PaneView — 데이터 → 픽셀 좌표 변환
  // ══════════════════════════════════════════════════

  class PatternPaneView {
    constructor(source) {
      this._source = source;
      this._drawData = { rects: [], polylines: [], hlines: [] };
    }

    zOrder() { return 'normal'; }

    update() {
      const src = this._source;
      if (!src._chart || !src._series || !src._patterns) {
        this._drawData = { rects: [], polylines: [], hlines: [] };
        return;
      }

      const { candles, patterns } = src._patterns;
      const series = src._series;
      const ts = src._chart.timeScale();

      // 가격/시간 → 픽셀 좌표 변환 헬퍼
      const toXY = (time, price) => ({
        x: ts.timeToCoordinate(time),
        y: series.priceToCoordinate(price),
      });

      const rects = [];
      const polylines = [];
      const hlines = [];

      patterns.forEach(p => {
        if (ZONE_PATTERNS[p.type])    this._buildZone(candles, p, toXY, rects);
        if (SINGLE_PATTERNS[p.type])  this._buildSingle(candles, p, toXY, hlines);
        if (p.type === 'doubleBottom') this._buildDoubleBottom(candles, p, toXY, polylines);
        if (p.type === 'doubleTop')    this._buildDoubleTop(candles, p, toXY, polylines);
        if (p.type === 'headAndShoulders' || p.type === 'inverseHeadAndShoulders')
          this._buildHSExtension(candles, p, toXY, polylines);
      });

      this._buildStopTarget(patterns, series, hlines);
      this._drawData = { rects, polylines, hlines };
    }

    renderer() { return new PatternRenderer(this._drawData); }

    // ── 구간 직사각형 (채워진 Zone) ──
    _buildZone(candles, p, toXY, rects) {
      const cfg = ZONE_PATTERNS[p.type];
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      let upper, lower;
      if (cfg.useBody) {
        const m = candles[si];
        upper = Math.max(m.open, m.close);
        lower = Math.min(m.open, m.close);
      } else {
        upper = -Infinity; lower = Infinity;
        for (let i = si; i <= ei && i < candles.length; i++) {
          if (candles[i].high > upper) upper = candles[i].high;
          if (candles[i].low  < lower) lower = candles[i].low;
        }
      }
      if (!isFinite(upper) || !isFinite(lower)) return;

      const tl = toXY(candles[si].time, upper);
      const br = toXY(candles[ei].time, lower);
      rects.push({ x1: tl.x, y1: tl.y, x2: br.x, y2: br.y, fill: cfg.fill, border: cfg.color });
    }

    // ── 단일 캔들 수준 표시 ──
    _buildSingle(candles, p, toXY, hlines) {
      const cfg = SINGLE_PATTERNS[p.type];
      const idx = p.endIndex;
      if (idx == null || idx >= candles.length) return;

      const value = candles[idx][cfg.key];
      if (value == null) return;

      const li = Math.max(0, idx - 2);
      const ri = Math.min(candles.length - 1, idx + 2);
      const left = toXY(candles[li].time, value);
      const right = toXY(candles[ri].time, value);
      hlines.push({ y: left.y, x1: left.x, x2: right.x, color: cfg.color, width: 1, dash: [3, 2] });
    }

    // ── 이중 바닥 W형 + 넥라인 ──
    _buildDoubleBottom(candles, p, toXY, polylines) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      let neckline = -Infinity, neckIdx = si;
      for (let j = si; j <= ei && j < candles.length; j++) {
        if (candles[j].high > neckline) { neckline = candles[j].high; neckIdx = j; }
      }
      if (!isFinite(neckline)) return;

      // W 형태
      polylines.push({
        points: [
          toXY(candles[si].time, candles[si].low),
          toXY(candles[neckIdx].time, neckline),
          toXY(candles[ei].time, candles[ei].low),
        ],
        color: BUY_COLOR, width: 1.5, dash: [],
      });

      // 넥라인 수평 (우측 연장)
      const extIdx = Math.min(ei + 5, candles.length - 1);
      polylines.push({
        points: [toXY(candles[si].time, neckline), toXY(candles[extIdx].time, neckline)],
        color: GOLD_COLOR, width: 1.5, dash: [],
      });
    }

    // ── 이중 천장 M형 + 넥라인 ──
    _buildDoubleTop(candles, p, toXY, polylines) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      let neckline = Infinity, neckIdx = si;
      for (let j = si; j <= ei && j < candles.length; j++) {
        if (candles[j].low < neckline) { neckline = candles[j].low; neckIdx = j; }
      }
      if (!isFinite(neckline)) return;

      // M 형태
      polylines.push({
        points: [
          toXY(candles[si].time, candles[si].high),
          toXY(candles[neckIdx].time, neckline),
          toXY(candles[ei].time, candles[ei].high),
        ],
        color: SELL_COLOR, width: 1.5, dash: [],
      });

      // 넥라인 수평
      const extIdx = Math.min(ei + 5, candles.length - 1);
      polylines.push({
        points: [toXY(candles[si].time, neckline), toXY(candles[extIdx].time, neckline)],
        color: GOLD_COLOR, width: 1.5, dash: [],
      });
    }

    // ── 머리어깨 넥라인 우측 연장 ──
    _buildHSExtension(candles, p, toXY, polylines) {
      if (!p.trendlines || !p.trendlines.length) return;
      const neckTL = p.trendlines[0];
      if (!neckTL.points || neckTL.points.length < 2) return;

      const pt1 = neckTL.points[0], pt2 = neckTL.points[1];
      const i1 = candles.findIndex(c => c.time === pt1.time);
      const i2 = candles.findIndex(c => c.time === pt2.time);
      if (i1 < 0 || i2 < 0 || i1 === i2) return;

      const slope = (pt2.value - pt1.value) / (i2 - i1);
      const extIdx = Math.min(p.endIndex + 10, candles.length - 1);
      const extVal = pt2.value + slope * (extIdx - i2);

      polylines.push({
        points: [toXY(pt2.time, pt2.value), toXY(candles[extIdx].time, extVal)],
        color: GOLD_COLOR, width: 1.5, dash: [6, 3],
      });
    }

    // ── 손절/목표가 수평선 (최상위 1개) ──
    _buildStopTarget(patterns, series, hlines) {
      const top = patterns.find(p => p.stopLoss != null || p.priceTarget != null);
      if (!top) return;

      if (top.stopLoss != null) {
        hlines.push({
          y: series.priceToCoordinate(top.stopLoss),
          color: SELL_COLOR, width: 1, dash: [6, 3],
          marker: 'stop',
        });
      }
      if (top.priceTarget != null) {
        hlines.push({
          y: series.priceToCoordinate(top.priceTarget),
          color: BUY_COLOR, width: 1, dash: [6, 3],
          marker: 'target',
        });
      }
    }
  }


  // ══════════════════════════════════════════════════
  //  Primitive — ISeriesPrimitive 구현체
  // ══════════════════════════════════════════════════

  class PatternOverlayPrimitive {
    constructor() {
      this._chart = null;
      this._series = null;
      this._requestUpdate = null;
      this._view = new PatternPaneView(this);
      this._patterns = null;
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

    setPatterns(candles, patterns) {
      this._patterns = { candles, patterns };
      if (this._requestUpdate) this._requestUpdate();
    }

    clearPatterns() {
      this._patterns = null;
      if (this._requestUpdate) this._requestUpdate();
    }
  }


  // ══════════════════════════════════════════════════
  //  공개 API
  // ══════════════════════════════════════════════════

  function render(cm, candles, chartType, patterns) {
    if (!cm.mainChart || !cm.candleSeries) {
      _primitive = null;
      _attachedSeries = null;
      return;
    }

    // 차트 재생성 감지 → primitive 재연결
    if (_attachedSeries !== cm.candleSeries) {
      _primitive = new PatternOverlayPrimitive();
      cm.candleSeries.attachPrimitive(_primitive);
      _attachedSeries = cm.candleSeries;
    }

    if (!patterns || !patterns.length || !candles || !candles.length) {
      _primitive.clearPatterns();
      return;
    }

    const sorted = [...patterns].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    _primitive.setPatterns(candles, sorted.slice(0, MAX_PATTERNS));
  }

  function cleanup(cm) {
    if (_primitive && _attachedSeries) {
      try { _attachedSeries.detachPrimitive(_primitive); } catch (e) {}
    }
    _primitive = null;
    _attachedSeries = null;
  }

  return { render, cleanup };

})();
