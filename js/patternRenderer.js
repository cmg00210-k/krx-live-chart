// ══════════════════════════════════════════════════════
//  패턴 시각화 렌더러 v2.0 (ISeriesPrimitive — Canvas 직접 그리기)
//
//  기존 LineSeries 방식 → Canvas2D Primitive 방식으로 전환
//  채워진 직사각형, 반투명 영역, 자유로운 도형 그리기 가능
// ══════════════════════════════════════════════════════

const patternRenderer = (() => {

  let _primitive = null;
  let _attachedSeries = null;

  // ── 색상 (패턴 전용 — 은은한 민트/라벤더 계열) ──
  const BUY_COLOR  = KRX_COLORS.PTN_BUY;
  const BUY_FILL   = KRX_COLORS.PTN_BUY_FILL;
  const SELL_COLOR  = KRX_COLORS.PTN_SELL;
  const SELL_FILL   = KRX_COLORS.PTN_SELL_FILL;
  const GOLD_COLOR  = KRX_COLORS.PTN_STRUCT;
  const NEUTRAL_COLOR = KRX_COLORS.PTN_NEUTRAL;
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
    piercingLine:       { color: BUY_COLOR, fill: BUY_FILL },
    darkCloud:          { color: SELL_COLOR, fill: SELL_FILL },
    tweezerBottom:      { color: BUY_COLOR, fill: BUY_FILL },
    tweezerTop:         { color: SELL_COLOR, fill: SELL_FILL },
  };

  const SINGLE_PATTERNS = {
    hammer:         { key: 'low',   color: BUY_COLOR },
    invertedHammer: { key: 'high',  color: BUY_COLOR },
    hangingMan:     { key: 'low',   color: SELL_COLOR },
    shootingStar:   { key: 'high',  color: SELL_COLOR },
    doji:           { key: 'close', color: NEUTRAL_COLOR },
    dragonflyDoji:  { key: 'low',   color: BUY_COLOR },
    gravestoneDoji: { key: 'high',  color: SELL_COLOR },
  };

  // ── 패턴 한글 이름 매핑 (33종: 실제 감지 27종 + 향후 확장 6종) ──
  const PATTERN_NAMES_KO = {
    // 단일 캔들 패턴 (7종)
    hammer:                   '망치형',
    invertedHammer:           '역망치',
    hangingMan:               '교수형',
    shootingStar:             '유성형',
    doji:                     '도지',
    dragonflyDoji:            '잠자리도지',
    gravestoneDoji:           '비석도지',
    // 2봉 패턴 (8종)
    bullishEngulfing:         '상승장악',
    bearishEngulfing:         '하락장악',
    bullishHarami:            '상승잉태',
    bearishHarami:            '하락잉태',
    piercingLine:             '관통형',
    darkCloud:                '먹구름',
    tweezerBottom:            '족집게바닥',
    tweezerTop:               '족집게천장',
    // 3봉 패턴 (4종)
    morningStar:              '샛별형',
    eveningStar:              '석별형',
    threeWhiteSoldiers:       '적삼병',
    threeBlackCrows:          '흑삼병',
    // 차트 패턴 (8종)
    doubleBottom:             '이중바닥',
    doubleTop:                '이중천장',
    headAndShoulders:         '머리어깨',
    inverseHeadAndShoulders:  '역머리어깨',
    ascendingTriangle:        '상승삼각',
    descendingTriangle:       '하락삼각',
    risingWedge:              '상승쐐기',
    fallingWedge:             '하락쐐기',
    // 향후 확장용 (6종 — 아직 미감지)
    symmetricTriangle:        '대칭삼각',
    bullishFlag:              '상승깃발',
    bearishFlag:              '하락깃발',
    cupAndHandle:             '컵핸들',
    channel:                  '채널',
    rectangle:                '박스권',
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
        const h = scope.mediaSize.height;
        const { rects, polylines, hlines, labels } = this._data;

        // 빈 데이터면 즉시 반환 (불필요한 save/restore 방지)
        if (!rects.length && !polylines.length && !hlines.length && !(labels && labels.length)) return;

        ctx.save();

        // ── 1. 채워진 직사각형 (Zone Bracket) ──
        if (rects.length) {
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1;
          rects.forEach(r => {
            if (r.x1 == null || r.y1 == null || r.x2 == null || r.y2 == null) return;
            const rx = Math.min(r.x1, r.x2);
            const ry = Math.min(r.y1, r.y2);
            const rw = Math.abs(r.x2 - r.x1);
            const rh = Math.abs(r.y2 - r.y1);

            ctx.fillStyle = r.fill;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = r.border;
            ctx.strokeRect(rx, ry, rw, rh);
          });
        }

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
        hlines.forEach(hl => {
          if (hl.y == null) return;
          const x1 = hl.x1 != null ? hl.x1 : 0;
          const x2 = hl.x2 != null ? hl.x2 : w;

          ctx.beginPath();
          ctx.moveTo(x1, hl.y);
          ctx.lineTo(x2, hl.y);
          ctx.strokeStyle = hl.color;
          ctx.lineWidth = hl.width || 1;
          ctx.setLineDash(hl.dash || [4, 3]);
          ctx.stroke();

          // 라벨 대신 끝점 삼각형 마커
          if (hl.marker) {
            ctx.setLineDash([]);
            ctx.fillStyle = hl.color;
            ctx.beginPath();
            if (hl.marker === 'stop') {
              ctx.moveTo(w - 60, hl.y - 6);
              ctx.lineTo(w - 54, hl.y + 2);
              ctx.lineTo(w - 66, hl.y + 2);
            } else {
              ctx.moveTo(w - 60, hl.y + 6);
              ctx.lineTo(w - 54, hl.y - 2);
              ctx.lineTo(w - 66, hl.y - 2);
            }
            ctx.fill();
          }
        });

        // ── 4. 패턴 라벨 (한글 이름 + 배경 roundRect) ──
        // 차트 하단 마진(bottom 20%)에 매수 라벨, 상단 마진(top 12%)에 매도 라벨
        if (labels && labels.length) {
          ctx.setLineDash([]);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fontSize = 10;
          ctx.font = `600 ${fontSize}px 'Pretendard', sans-serif`;

          // 라벨 간 겹침 방지를 위한 y오프셋 카운터
          let bottomSlot = 0;
          let topSlot = 0;

          labels.forEach(lb => {
            if (lb.x == null) return;

            // y좌표 계산: placement 기반
            let labelY;
            if (lb.placement === 'bottom') {
              // 하단 마진: 캔들 영역 끝(h * 0.80)에서부터 아래로
              // scaleMargins.bottom = 0.20이므로 h * 0.82 ~ h * 0.96 영역 사용
              labelY = h * 0.84 + bottomSlot * 16;
              bottomSlot++;
              if (labelY > h - 10) labelY = h - 10;  // 하단 넘침 방지
            } else if (lb.placement === 'top') {
              // 상단 마진: scaleMargins.top = 0.12이므로 h * 0.02 ~ h * 0.10 영역
              labelY = h * 0.04 + topSlot * 16;
              topSlot++;
              if (labelY < 8) labelY = 8;  // 상단 넘침 방지
            } else if (lb.y != null) {
              labelY = lb.y;  // 기존 방식 폴백
            } else {
              return;
            }

            const text = lb.text;
            const metrics = ctx.measureText(text);
            const padH = 5;    // 좌우 패딩
            const padV = 3;    // 상하 패딩
            const boxW = metrics.width + padH * 2;
            const boxH = fontSize + padV * 2;
            const boxX = lb.x - boxW / 2;
            const boxY = labelY - boxH / 2;
            const radius = 3;

            // 배경 roundRect
            ctx.fillStyle = lb.bgColor || 'rgba(19,23,34,0.85)';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(boxX, boxY, boxW, boxH, radius);
            } else {
              // roundRect 미지원 브라우저 폴백
              ctx.moveTo(boxX + radius, boxY);
              ctx.lineTo(boxX + boxW - radius, boxY);
              ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
              ctx.lineTo(boxX + boxW, boxY + boxH - radius);
              ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
              ctx.lineTo(boxX + radius, boxY + boxH);
              ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
              ctx.lineTo(boxX, boxY + radius);
              ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
            }
            ctx.fill();

            // 배경 테두리
            ctx.strokeStyle = lb.borderColor || lb.color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 텍스트
            ctx.fillStyle = lb.color;
            ctx.fillText(text, lb.x, labelY);
          });
        }

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
      this._drawData = { rects: [], polylines: [], hlines: [], labels: [] };
    }

    zOrder() { return 'normal'; }

    update() {
      const src = this._source;
      if (!src._chart || !src._series || !src._patterns) {
        this._drawData = { rects: [], polylines: [], hlines: [], labels: [] };
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
      const labels = [];

      patterns.forEach(p => {
        if (ZONE_PATTERNS[p.type])    this._buildZone(candles, p, toXY, rects);
        if (SINGLE_PATTERNS[p.type])  this._buildSingle(candles, p, toXY, hlines);
        if (p.type === 'doubleBottom') this._buildDoubleBottom(candles, p, toXY, polylines);
        if (p.type === 'doubleTop')    this._buildDoubleTop(candles, p, toXY, polylines);
        if (p.type === 'headAndShoulders' || p.type === 'inverseHeadAndShoulders')
          this._buildHSExtension(candles, p, toXY, polylines);

        // ── 패턴 라벨 생성 ──
        this._buildLabel(candles, p, toXY, labels);
      });

      this._buildStopTarget(patterns, series, hlines);
      this._drawData = { rects, polylines, hlines, labels };
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

    // ── 패턴 라벨 (한글 이름, 차트 하단 마진 영역에 표시) ──
    // 매수 패턴: 캔들 아래 하단 마진에 빨강 텍스트
    // 매도 패턴: 캔들 위 상단에 파랑 텍스트
    _buildLabel(candles, p, toXY, labels) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      const name = PATTERN_NAMES_KO[p.type] || p.type;

      // 라벨 위치: 패턴 중앙 X
      const midIdx = Math.round((si + ei) / 2);
      const midTime = candles[Math.min(midIdx, candles.length - 1)].time;
      const coordX = toXY(midTime, 0);
      if (coordX.x == null) return;

      // 매수(bullish) 판별 — 실제 감지되는 패턴 전체 포함
      const isBullish = p.signal === 'buy' || p.direction === 'bullish' ||
        ['hammer', 'invertedHammer', 'bullishEngulfing', 'bullishHarami',
         'morningStar', 'threeWhiteSoldiers', 'doubleBottom',
         'inverseHeadAndShoulders', 'fallingWedge', 'bullishFlag',
         'ascendingTriangle', 'cupAndHandle',
         'piercingLine', 'dragonflyDoji', 'tweezerBottom'].includes(p.type);

      const isBearish = p.signal === 'sell' || p.direction === 'bearish' ||
        ['hangingMan', 'shootingStar', 'bearishEngulfing', 'bearishHarami',
         'eveningStar', 'threeBlackCrows', 'doubleTop', 'headAndShoulders',
         'risingWedge', 'bearishFlag', 'descendingTriangle',
         'darkCloud', 'gravestoneDoji', 'tweezerTop'].includes(p.type);

      // 패턴 방향에 따른 색상 (한국식)
      // 매수 패턴 → 빨강 (#E05050), 매도 패턴 → 파랑 (#5086DC)
      const color = isBullish ? KRX_COLORS.UP : (isBearish ? KRX_COLORS.DOWN : NEUTRAL_COLOR);

      // y좌표는 'bottom' 또는 'top' 키워드로 설정
      // Canvas 렌더러에서 실제 height 기반으로 계산
      labels.push({
        x: coordX.x,
        y: null,                        // Canvas 렌더러에서 계산
        placement: isBullish ? 'bottom' : 'top',  // 매수→하단, 매도→상단
        text: name,
        color: color,
        bgColor: 'rgba(19,23,34,0.85)',
        borderColor: color,
      });
    }

    // ── 손절/목표가 수평선 (최상위 1개) ──
    _buildStopTarget(patterns, series, hlines) {
      const top = patterns.find(p => p.stopLoss != null || p.priceTarget != null);
      if (!top) return;

      if (top.stopLoss != null) {
        hlines.push({
          y: series.priceToCoordinate(top.stopLoss),
          color: KRX_COLORS.PTN_STOP, width: 1, dash: [6, 3],
          marker: 'stop',
        });
      }
      if (top.priceTarget != null) {
        hlines.push({
          y: series.priceToCoordinate(top.priceTarget),
          color: KRX_COLORS.PTN_TARGET, width: 1, dash: [6, 3],
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

    // 차트 재생성 감지 → primitive 재연결 (라인 모드: _priceLine 시리즈 사용)
    const targetSeries = (chartType === 'line' && cm.indicatorSeries._priceLine)
      ? cm.indicatorSeries._priceLine : cm.candleSeries;
    if (_attachedSeries !== targetSeries) {
      if (_primitive && _attachedSeries) {
        try { _attachedSeries.detachPrimitive(_primitive); } catch (e) {}
      }
      _primitive = new PatternOverlayPrimitive();
      targetSeries.attachPrimitive(_primitive);
      _attachedSeries = targetSeries;
    }

    if (!patterns || !patterns.length || !candles || !candles.length) {
      _primitive.clearPatterns();
      return;
    }

    const sorted = [...patterns].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    _primitive.setPatterns(candles, sorted.slice(0, MAX_PATTERNS));
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
