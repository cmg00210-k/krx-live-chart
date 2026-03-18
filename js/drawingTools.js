// ══════════════════════════════════════════════════════
//  KRX LIVE — 드로잉 도구 v1.0
//  좌측 수직 툴바 + ISeriesPrimitive 기반 캔버스 렌더링
//
//  도구 목록 (Phase 1):
//    1. 추세선 (trendline) — 2점 클릭
//    2. 수평선 (hline) — 1점 클릭
//    3. 수직선 (vline) — 1점 클릭
//    4. 사각형 (rect) — 2점 클릭 (대각선 꼭짓점)
//    5. 피보나치 되돌림 (fib) — 2점 클릭 (고/저)
//    6. 삭제 (eraser) — 클릭한 드로잉 제거
//
//  렌더링: ISeriesPrimitive (patternRenderer.js 와 동일 패턴)
//  저장: localStorage (종목별)
//  단축키: T=추세선, H=수평선, V=수직선, R=사각형, G=피보나치, Del=삭제, Esc=해제
// ══════════════════════════════════════════════════════

const drawingTools = (() => {
  'use strict';

  // ── 상태 ──
  let _activeTool = null;       // 현재 선택된 도구 (null이면 비활성)
  let _drawings = [];           // 모든 드로잉 목록
  let _clickPoints = [];        // 현재 도구의 클릭 포인트 수집 중
  let _primitive = null;        // ISeriesPrimitive 인스턴스
  let _attachedSeries = null;   // primitive가 부착된 시리즈
  let _chartRef = null;         // chartManager 참조 (좌표 변환용)
  let _currentStockCode = null; // 현재 종목 코드 (필터링용)

  // 임시 프리뷰 상태 (마우스 이동 중 미완성 드로잉 미리보기)
  let _previewPoint = null;     // { price, time } — 마우스 추적 좌표

  // localStorage 키
  const STORAGE_KEY = 'krx_drawings_v1';

  // 피보나치 레벨
  const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const FIB_LABELS = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%'];

  // 드로잉 색상
  const COLORS = {
    trendline: '#A08830',     // 금색 (accent, 어두운 톤)
    hline:     '#787B86',     // 회색
    vline:     '#787B86',     // 회색
    rect:      'rgba(41,98,255,0.25)',   // 파란색 반투명
    rectBorder:'#2962ff',
    fib:       '#787B86',     // 회색 (레벨 선)
    fibFill:   'rgba(41,98,255,0.06)',   // 레벨 간 채우기
    eraser:    '#E05050',     // 빨강 (삭제 모드 표시용)
    preview:   'rgba(160,136,48,0.5)',   // 프리뷰 (반투명 금색)
  };


  // ══════════════════════════════════════════════════
  //  localStorage 저장/로드
  // ══════════════════════════════════════════════════

  function _loadDrawings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[DrawingTools] localStorage 로드 실패:', e);
      return [];
    }
  }

  function _saveDrawings() {
    try {
      // 직렬화 가능한 필드만 저장
      const serializable = _drawings.map(d => ({
        id: d.id,
        type: d.type,
        points: d.points,
        stockCode: d.stockCode,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.warn('[DrawingTools] localStorage 저장 실패:', e);
    }
  }

  /** 고유 ID 생성 */
  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }


  // ══════════════════════════════════════════════════
  //  PaneView — Canvas2D 렌더링 (모든 드로잉 타입)
  // ══════════════════════════════════════════════════

  class DrawingPaneView {
    constructor(source) {
      this._source = source;
    }

    zOrder() { return 'top'; }

    update() {
      // update는 매 프레임마다 호출됨 — 실제 렌더링은 renderer()에서 수행
    }

    renderer() {
      const src = this._source;
      return {
        draw(target) {
          target.useMediaCoordinateSpace(scope => {
            const ctx = scope.context;
            const w = scope.mediaSize.width;
            const h = scope.mediaSize.height;

            if (!src._chart || !src._series) return;

            const chart = src._chart;
            const series = src._series;
            const ts = chart.timeScale();

            // 가격/시간 → 미디어 좌표 헬퍼
            const toX = (time) => ts.timeToCoordinate(time);
            const toY = (price) => series.priceToCoordinate(price);

            // 현재 종목의 드로잉만 필터링
            const drawings = src._getVisibleDrawings();

            ctx.save();

            // ── 기존 드로잉 렌더링 ──
            drawings.forEach(d => {
              _renderOneDrawing(ctx, d, toX, toY, w, h, false);
            });

            // ── 프리뷰 렌더링 (미완성 드로잉 미리보기) ──
            const preview = src._getPreviewDrawing();
            if (preview) {
              _renderOneDrawing(ctx, preview, toX, toY, w, h, true);
            }

            ctx.restore();
          });
        }
      };
    }
  }


  // ══════════════════════════════════════════════════
  //  개별 드로잉 렌더링 함수
  // ══════════════════════════════════════════════════

  function _renderOneDrawing(ctx, d, toX, toY, canvasW, canvasH, isPreview) {
    const alpha = isPreview ? 0.5 : 1.0;

    if (d.type === 'hline' && d.points.length >= 1) {
      _drawHLine(ctx, d, toX, toY, canvasW, alpha);
    } else if (d.type === 'vline' && d.points.length >= 1) {
      _drawVLine(ctx, d, toX, toY, canvasH, alpha);
    } else if (d.type === 'trendline' && d.points.length >= 2) {
      _drawTrendline(ctx, d, toX, toY, canvasW, alpha);
    } else if (d.type === 'rect' && d.points.length >= 2) {
      _drawRect(ctx, d, toX, toY, alpha);
    } else if (d.type === 'fib' && d.points.length >= 2) {
      _drawFib(ctx, d, toX, toY, canvasW, alpha);
    }
  }

  /** 수평선 렌더링 */
  function _drawHLine(ctx, d, toX, toY, canvasW, alpha) {
    const y = toY(d.points[0].price);
    if (y == null || isNaN(y)) return;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.hline;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 가격 라벨
    const priceText = Math.round(d.points[0].price).toLocaleString('ko-KR');
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillStyle = COLORS.hline;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(priceText, 4, y - 3);
    ctx.globalAlpha = 1;
  }

  /** 수직선 렌더링 */
  function _drawVLine(ctx, d, toX, toY, canvasH, alpha) {
    const x = toX(d.points[0].time);
    if (x == null || isNaN(x)) return;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.vline;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /** 추세선 렌더링 (양방향 무한 연장) */
  function _drawTrendline(ctx, d, toX, toY, canvasW, alpha) {
    const x1 = toX(d.points[0].time);
    const y1 = toY(d.points[0].price);
    const x2 = toX(d.points[1].time);
    const y2 = toY(d.points[1].price);

    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.trendline;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    // 두 점 사이 직선 + 양방향 연장
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

    // 캔버스 가장자리까지 연장
    let extLeft, extRight;
    if (Math.abs(dx) > 0.01) {
      const slope = dy / dx;
      const yAtLeft = y1 + slope * (0 - x1);
      const yAtRight = y1 + slope * (canvasW - x1);
      extLeft = { x: 0, y: yAtLeft };
      extRight = { x: canvasW, y: yAtRight };
    } else {
      // 수직에 가까운 경우
      extLeft = { x: x1, y: 0 };
      extRight = { x: x1, y: 9999 };
    }

    ctx.beginPath();
    ctx.moveTo(extLeft.x, extLeft.y);
    ctx.lineTo(extRight.x, extRight.y);
    ctx.stroke();

    // 두 앵커 포인트에 작은 원 표시
    [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.trendline;
      ctx.fill();
    });

    ctx.globalAlpha = 1;
  }

  /** 사각형 렌더링 */
  function _drawRect(ctx, d, toX, toY, alpha) {
    const x1 = toX(d.points[0].time);
    const y1 = toY(d.points[0].price);
    const x2 = toX(d.points[1].time);
    const y2 = toY(d.points[1].price);

    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1);
    const rh = Math.abs(y2 - y1);

    ctx.globalAlpha = alpha;

    // 채우기
    ctx.fillStyle = COLORS.rect;
    ctx.fillRect(rx, ry, rw, rh);

    // 테두리
    ctx.strokeStyle = COLORS.rectBorder;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.globalAlpha = 1;
  }

  /** 피보나치 되돌림 렌더링 */
  function _drawFib(ctx, d, toX, toY, canvasW, alpha) {
    const price1 = d.points[0].price;
    const price2 = d.points[1].price;
    const x1 = toX(d.points[0].time);
    const x2 = toX(d.points[1].time);

    if (x1 == null || x2 == null) return;

    // 고/저 판별 (어느 쪽이든 작동)
    const highPrice = Math.max(price1, price2);
    const lowPrice = Math.min(price1, price2);
    const range = highPrice - lowPrice;
    if (range <= 0) return;

    ctx.globalAlpha = alpha;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textBaseline = 'middle';

    for (let i = 0; i < FIB_LEVELS.length; i++) {
      const level = FIB_LEVELS[i];
      const price = highPrice - range * level;
      const y = toY(price);
      if (y == null || isNaN(y)) continue;

      // 레벨 간 채우기 (짝수 인덱스만)
      if (i < FIB_LEVELS.length - 1 && i % 2 === 0) {
        const nextPrice = highPrice - range * FIB_LEVELS[i + 1];
        const nextY = toY(nextPrice);
        if (nextY != null && !isNaN(nextY)) {
          ctx.fillStyle = COLORS.fibFill;
          ctx.fillRect(0, Math.min(y, nextY), canvasW, Math.abs(nextY - y));
        }
      }

      // 수평선
      const lineAlpha = (level === 0 || level === 0.5 || level === 1) ? 0.8 : 0.4;
      ctx.strokeStyle = COLORS.fib;
      ctx.lineWidth = (level === 0.5) ? 1.2 : 0.8;
      ctx.setLineDash((level === 0 || level === 1) ? [] : [4, 3]);
      ctx.globalAlpha = alpha * lineAlpha;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();

      // 라벨 (좌측)
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.fib;
      ctx.textAlign = 'left';
      const label = FIB_LABELS[i] + '  ' + Math.round(price).toLocaleString('ko-KR');
      ctx.fillText(label, 4, y);
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }


  // ══════════════════════════════════════════════════
  //  ISeriesPrimitive 구현체
  // ══════════════════════════════════════════════════

  class DrawingOverlayPrimitive {
    constructor() {
      this._chart = null;
      this._series = null;
      this._requestUpdate = null;
      this._view = new DrawingPaneView(this);
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
      this._view.update();
    }

    requestUpdate() {
      if (this._requestUpdate) this._requestUpdate();
    }

    paneViews() {
      return [this._view];
    }

    /** 현재 종목에 해당하는 드로잉 반환 */
    _getVisibleDrawings() {
      if (!_currentStockCode) return _drawings;
      return _drawings.filter(d => d.stockCode === _currentStockCode);
    }

    /** 미완성 프리뷰 드로잉 생성 */
    _getPreviewDrawing() {
      if (!_activeTool || !_clickPoints.length || !_previewPoint) return null;
      if (_activeTool === 'hline' || _activeTool === 'vline' || _activeTool === 'eraser') return null;

      // 첫 번째 클릭 포인트 + 현재 마우스 위치로 프리뷰 생성
      return {
        type: _activeTool,
        points: [..._clickPoints, _previewPoint],
        stockCode: _currentStockCode,
      };
    }
  }


  // ══════════════════════════════════════════════════
  //  히트 테스트 — 삭제 도구용 (가장 가까운 드로잉 찾기)
  // ══════════════════════════════════════════════════

  /**
   * 마우스 좌표에서 가장 가까운 드로잉을 찾아 삭제
   * @param {number} price - 클릭한 가격
   * @param {string} time  - 클릭한 시간
   * @returns {boolean} 삭제 성공 여부
   */
  function _removeNearestDrawing(price, time) {
    if (!_chartRef || !_chartRef.mainChart || !_chartRef.candleSeries) return false;

    const ts = _chartRef.mainChart.timeScale();
    const series = _chartRef.candleSeries;
    const clickX = ts.timeToCoordinate(time);
    const clickY = series.priceToCoordinate(price);
    if (clickX == null || clickY == null) return false;

    const visibleDrawings = _drawings.filter(d => d.stockCode === _currentStockCode);
    if (!visibleDrawings.length) return false;

    let bestDist = Infinity;
    let bestIdx = -1;

    visibleDrawings.forEach((d, vi) => {
      const dist = _distToDrawing(d, clickX, clickY, ts, series);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = vi;
      }
    });

    // 20px 이내만 삭제
    if (bestIdx >= 0 && bestDist < 20) {
      const target = visibleDrawings[bestIdx];
      const globalIdx = _drawings.indexOf(target);
      if (globalIdx >= 0) {
        _drawings.splice(globalIdx, 1);
        _saveDrawings();
        _refresh();
        return true;
      }
    }
    return false;
  }

  /** 클릭 좌표에서 드로잉까지 거리 계산 (픽셀) */
  function _distToDrawing(d, clickX, clickY, ts, series) {
    if (d.type === 'hline' && d.points.length >= 1) {
      const y = series.priceToCoordinate(d.points[0].price);
      return y != null ? Math.abs(clickY - y) : Infinity;
    }

    if (d.type === 'vline' && d.points.length >= 1) {
      const x = ts.timeToCoordinate(d.points[0].time);
      return x != null ? Math.abs(clickX - x) : Infinity;
    }

    if (d.type === 'trendline' && d.points.length >= 2) {
      const x1 = ts.timeToCoordinate(d.points[0].time);
      const y1 = series.priceToCoordinate(d.points[0].price);
      const x2 = ts.timeToCoordinate(d.points[1].time);
      const y2 = series.priceToCoordinate(d.points[1].price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return Infinity;
      return _distPointToLine(clickX, clickY, x1, y1, x2, y2);
    }

    if (d.type === 'rect' && d.points.length >= 2) {
      const x1 = ts.timeToCoordinate(d.points[0].time);
      const y1 = series.priceToCoordinate(d.points[0].price);
      const x2 = ts.timeToCoordinate(d.points[1].time);
      const y2 = series.priceToCoordinate(d.points[1].price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return Infinity;
      const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
      const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
      // 사각형 내부 또는 변까지 거리
      if (clickX >= rx && clickX <= rx + rw && clickY >= ry && clickY <= ry + rh) return 0;
      // 가장 가까운 변까지 거리
      const dLeft = Math.abs(clickX - rx);
      const dRight = Math.abs(clickX - (rx + rw));
      const dTop = Math.abs(clickY - ry);
      const dBottom = Math.abs(clickY - (ry + rh));
      return Math.min(dLeft, dRight, dTop, dBottom);
    }

    if (d.type === 'fib' && d.points.length >= 2) {
      // 피보나치: 가장 가까운 레벨 선까지 거리
      const highPrice = Math.max(d.points[0].price, d.points[1].price);
      const lowPrice = Math.min(d.points[0].price, d.points[1].price);
      const range = highPrice - lowPrice;
      let minDist = Infinity;
      FIB_LEVELS.forEach(level => {
        const price = highPrice - range * level;
        const y = series.priceToCoordinate(price);
        if (y != null) minDist = Math.min(minDist, Math.abs(clickY - y));
      });
      return minDist;
    }

    return Infinity;
  }

  /** 점에서 직선(무한 연장)까지 거리 */
  function _distPointToLine(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.001) return Math.hypot(px - x1, py - y1);
    // 무한 직선까지 수직 거리
    return Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / Math.sqrt(lenSq);
  }


  // ══════════════════════════════════════════════════
  //  Primitive 갱신
  // ══════════════════════════════════════════════════

  function _refresh() {
    if (_primitive) {
      _primitive.requestUpdate();
    }
  }


  // ══════════════════════════════════════════════════
  //  공개 API
  // ══════════════════════════════════════════════════

  /**
   * 도구 선택/해제 토글
   * @param {string} toolName - 'trendline' | 'hline' | 'vline' | 'rect' | 'fib' | 'eraser'
   */
  function setTool(toolName) {
    // 같은 도구 다시 클릭 → 해제
    _activeTool = (_activeTool === toolName) ? null : toolName;
    _clickPoints = [];
    _previewPoint = null;

    // 버튼 활성화 상태 갱신
    document.querySelectorAll('.draw-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === _activeTool);
    });

    // 차트 커서 모드 전환
    const mc = document.getElementById('main-chart-container');
    if (mc) mc.classList.toggle('drawing-mode', !!_activeTool);

    _refresh();
  }

  /** 현재 활성 도구 반환 */
  function getActiveTool() {
    return _activeTool;
  }

  /**
   * 차트 클릭 이벤트 처리 (app.js에서 호출)
   * @param {number} price - 클릭한 가격 좌표
   * @param {string} time  - 클릭한 시간 좌표
   */
  function handleChartClick(price, time) {
    if (!_activeTool) return;

    // ── 삭제 도구 ──
    if (_activeTool === 'eraser') {
      const removed = _removeNearestDrawing(price, time);
      if (!removed && typeof showToast === 'function') {
        showToast('삭제할 드로잉이 없습니다', 'info');
      }
      return;
    }

    // ── 1클릭 완성 도구: 수평선, 수직선 ──
    if (_activeTool === 'hline') {
      _drawings.push({
        id: _genId(),
        type: 'hline',
        points: [{ price, time }],
        stockCode: _currentStockCode,
      });
      _saveDrawings();
      _refresh();
      return;
    }

    if (_activeTool === 'vline') {
      _drawings.push({
        id: _genId(),
        type: 'vline',
        points: [{ price, time }],
        stockCode: _currentStockCode,
      });
      _saveDrawings();
      _refresh();
      return;
    }

    // ── 2클릭 완성 도구: 추세선, 사각형, 피보나치 ──
    _clickPoints.push({ price, time });

    if (_clickPoints.length >= 2) {
      _drawings.push({
        id: _genId(),
        type: _activeTool,
        points: _clickPoints.slice(),
        stockCode: _currentStockCode,
      });
      _clickPoints = [];
      _previewPoint = null;
      _saveDrawings();
      _refresh();
    }
  }

  /**
   * 차트 마우스 이동 이벤트 처리 (프리뷰용)
   * @param {number} price - 현재 마우스 가격 좌표
   * @param {string} time  - 현재 마우스 시간 좌표
   */
  function handleChartMouseMove(price, time) {
    if (!_activeTool || !_clickPoints.length) {
      if (_previewPoint) {
        _previewPoint = null;
        _refresh();
      }
      return;
    }

    _previewPoint = { price, time };
    _refresh();
  }

  /**
   * primitive를 차트 시리즈에 부착
   * @param {ChartManager} cm - chartManager 인스턴스
   */
  function attach(cm) {
    if (!cm || !cm.candleSeries) return;

    _chartRef = cm;
    _drawings = _loadDrawings();

    // 기존 primitive가 있으면 먼저 해제
    if (_primitive && _attachedSeries) {
      try { _attachedSeries.detachPrimitive(_primitive); } catch (e) {}
    }

    _primitive = new DrawingOverlayPrimitive();
    cm.candleSeries.attachPrimitive(_primitive);
    _attachedSeries = cm.candleSeries;
  }

  /**
   * primitive를 차트에서 분리
   */
  function detach() {
    if (_attachedSeries && _primitive) {
      try { _attachedSeries.detachPrimitive(_primitive); } catch (e) {}
    }
    _primitive = null;
    _attachedSeries = null;
    _chartRef = null;
  }

  /**
   * 현재 종목 코드 설정 (종목 전환 시 호출)
   * @param {string} code - 종목 코드
   */
  function setStockCode(code) {
    _currentStockCode = code;
    _clickPoints = [];
    _previewPoint = null;
    _refresh();
  }

  /**
   * 현재 종목의 모든 드로잉 삭제
   */
  function clearAll() {
    _drawings = _drawings.filter(d => d.stockCode !== _currentStockCode);
    _saveDrawings();
    _refresh();
  }

  /**
   * 정리 (차트 파괴 시 호출)
   */
  function cleanup() {
    _activeTool = null;
    _clickPoints = [];
    _previewPoint = null;
    // 버튼 상태 리셋
    document.querySelectorAll('.draw-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const mc = document.getElementById('main-chart-container');
    if (mc) mc.classList.remove('drawing-mode');
  }


  // ── 공개 인터페이스 ──
  return {
    setTool,
    getActiveTool,
    handleChartClick,
    handleChartMouseMove,
    attach,
    detach,
    setStockCode,
    clearAll,
    cleanup,
  };
})();
