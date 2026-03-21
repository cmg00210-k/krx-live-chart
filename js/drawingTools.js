// ══════════════════════════════════════════════════════
//  KRX LIVE — 드로잉 도구 v2.0
//  좌측 수직 툴바 + ISeriesPrimitive 기반 캔버스 렌더링
//
//  도구 목록:
//    0. 선택/이동 (select) — 기존 드로잉 선택 + 드래그 이동
//    1. 추세선 (trendline) — 2점 클릭
//    2. 수평선 (hline) — 1점 클릭
//    3. 수직선 (vline) — 1점 클릭
//    4. 사각형 (rect) — 2점 클릭 (대각선 꼭짓점)
//    5. 피보나치 되돌림 (fib) — 2점 클릭 (고/저)
//    6. 삭제 (eraser) — 클릭한 드로잉 제거
//
//  v2.0 신기능:
//    - 선택 도구 (S): 기존 드로잉 클릭 선택 → 드래그로 이동
//    - 색상 선택기: 우클릭 또는 툴바 스와치로 드로잉 색상 변경
//    - 선택 앵커 핸들 (하이라이트 표시)
//
//  렌더링: ISeriesPrimitive (patternRenderer.js 와 동일 패턴)
//  저장: localStorage (종목별, color 필드 포함)
//  단축키: S=선택, T=추세선, H=수평선, V=수직선, R=사각형, G=피보나치, Del=삭제, Esc=해제
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

  // ── 선택/이동 상태 ──
  let _selectedDrawing = null;  // 현재 선택된 드로잉 객체 (또는 null)
  let _dragState = null;        // 드래그 중 상태: { drawing, startPrice, startTime, origPoints }

  // ── 색상 선택기 상태 ──
  let _currentColor = null;     // 사용자 선택 색상 (null이면 도구별 기본값 사용)

  // ── Undo/Redo 스택 ──
  const MAX_UNDO = 50;
  let _undoStack = [];  // { type: 'add'|'remove'|'move', drawing: {...}, prevState?: {points} }
  let _redoStack = [];

  // localStorage 키
  const STORAGE_KEY = 'krx_drawings_v1';

  // 피보나치 레벨
  const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const FIB_LABELS = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%'];

  // 사용자 선택 가능 색상 팔레트 (6개)
  const DRAW_COLORS = [
    '#C9A84C',   // gold (기본 추세선)
    '#787B86',   // gray (기본 수평/수직선)
    '#2962FF',   // blue (TradingView 관례)
    '#E05050',   // red (KRX 상승)
    '#5086DC',   // blue (KRX 하락)
    '#26C6DA',   // cyan
  ];

  // 드로잉 기본 색상 (도구별)
  const DEFAULT_COLORS = {
    trendline: '#C9A84C',     // 금색 (accent)
    hline:     '#787B86',     // 회색
    vline:     '#787B86',     // 회색
    rect:      '#2962FF',     // 파란색 (테두리 기준)
    fib:       '#787B86',     // 회색
  };

  // 렌더링에서 쓰는 기본 색상 (하위 호환)
  const COLORS = {
    trendline: '#A08830',
    hline:     '#787B86',
    vline:     '#787B86',
    rect:      'rgba(41,98,255,0.25)',
    rectBorder:'#2962ff',
    fib:       '#787B86',
    fibFill:   'rgba(41,98,255,0.06)',
    eraser:    '#E05050',
    preview:   'rgba(160,136,48,0.5)',
    select:    '#26C6DA',     // 선택 앵커 핸들 색상 (시안)
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
      // 직렬화 가능한 필드만 저장 (color 필드 추가)
      const serializable = _drawings.map(d => ({
        id: d.id,
        type: d.type,
        points: d.points,
        stockCode: d.stockCode,
        color: d.color || null,   // 사용자 지정 색상 (null이면 기본값)
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

  /**
   * 드로잉의 실제 렌더링 색상 결정
   * 우선순위: 사용자 지정 색상 > 도구별 기본값
   */
  function _getDrawingColor(d) {
    if (d.color) return d.color;
    return DEFAULT_COLORS[d.type] || COLORS.trendline;
  }

  /**
   * 색상으로부터 반투명 채우기 생성 (rect, fib 용)
   */
  function _colorToFill(hexColor, alpha) {
    // hex → rgba 변환
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
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
              const isSelected = (_selectedDrawing && d.id === _selectedDrawing.id);
              _renderOneDrawing(ctx, d, toX, toY, w, h, false, isSelected);
            });

            // ── 선택된 드로잉의 앵커 핸들 렌더링 ──
            if (_selectedDrawing) {
              const sel = drawings.find(d => d.id === _selectedDrawing.id);
              if (sel) {
                _renderSelectionHandles(ctx, sel, toX, toY);
              }
            }

            // ── 프리뷰 렌더링 (미완성 드로잉 미리보기) ──
            const preview = src._getPreviewDrawing();
            if (preview) {
              _renderOneDrawing(ctx, preview, toX, toY, w, h, true, false);
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

  function _renderOneDrawing(ctx, d, toX, toY, canvasW, canvasH, isPreview, isSelected) {
    const alpha = isPreview ? 0.5 : 1.0;

    if (d.type === 'hline' && d.points.length >= 1) {
      _drawHLine(ctx, d, toX, toY, canvasW, alpha, isSelected);
    } else if (d.type === 'vline' && d.points.length >= 1) {
      _drawVLine(ctx, d, toX, toY, canvasH, alpha, isSelected);
    } else if (d.type === 'trendline' && d.points.length >= 2) {
      _drawTrendline(ctx, d, toX, toY, canvasW, alpha, isSelected);
    } else if (d.type === 'rect' && d.points.length >= 2) {
      _drawRect(ctx, d, toX, toY, alpha, isSelected);
    } else if (d.type === 'fib' && d.points.length >= 2) {
      _drawFib(ctx, d, toX, toY, canvasW, alpha, isSelected);
    }
  }

  /** 수평선 렌더링 */
  function _drawHLine(ctx, d, toX, toY, canvasW, alpha, isSelected) {
    const y = toY(d.points[0].price);
    if (y == null || isNaN(y)) return;

    const color = _getDrawingColor(d);

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.setLineDash(isSelected ? [] : [5, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 가격 라벨
    const priceText = Math.round(d.points[0].price).toLocaleString('ko-KR');
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(priceText, 4, y - 3);
    ctx.globalAlpha = 1;
  }

  /** 수직선 렌더링 */
  function _drawVLine(ctx, d, toX, toY, canvasH, alpha, isSelected) {
    const x = toX(d.points[0].time);
    if (x == null || isNaN(x)) return;

    const color = _getDrawingColor(d);

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.setLineDash(isSelected ? [] : [5, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /** 추세선 렌더링 (양방향 무한 연장) */
  function _drawTrendline(ctx, d, toX, toY, canvasW, alpha, isSelected) {
    const x1 = toX(d.points[0].time);
    const y1 = toY(d.points[0].price);
    const x2 = toX(d.points[1].time);
    const y2 = toY(d.points[1].price);

    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

    const color = _getDrawingColor(d);

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
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
      ctx.fillStyle = color;
      ctx.fill();
    });

    ctx.globalAlpha = 1;
  }

  /** 사각형 렌더링 */
  function _drawRect(ctx, d, toX, toY, alpha, isSelected) {
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

    const color = _getDrawingColor(d);

    ctx.globalAlpha = alpha;

    // 채우기 (색상 기반 반투명)
    ctx.fillStyle = _colorToFill(color, 0.12);
    ctx.fillRect(rx, ry, rw, rh);

    // 테두리
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.setLineDash([]);
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.globalAlpha = 1;
  }

  /** 피보나치 되돌림 렌더링 */
  function _drawFib(ctx, d, toX, toY, canvasW, alpha, isSelected) {
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

    const color = _getDrawingColor(d);

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
          ctx.fillStyle = _colorToFill(color, 0.06);
          ctx.fillRect(0, Math.min(y, nextY), canvasW, Math.abs(nextY - y));
        }
      }

      // 수평선
      const lineAlpha = (level === 0 || level === 0.5 || level === 1) ? 0.8 : 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? ((level === 0.5) ? 2 : 1.2) : ((level === 0.5) ? 1.2 : 0.8);
      ctx.setLineDash((level === 0 || level === 1) ? [] : [4, 3]);
      ctx.globalAlpha = alpha * lineAlpha;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();

      // 라벨 (좌측)
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      const label = FIB_LABELS[i] + '  ' + Math.round(price).toLocaleString('ko-KR');
      ctx.fillText(label, 4, y);
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }


  // ══════════════════════════════════════════════════
  //  선택 앵커 핸들 렌더링 (select 모드)
  // ══════════════════════════════════════════════════

  /**
   * 선택된 드로잉의 앵커 포인트에 정사각형 핸들 표시
   * 시안(#26C6DA) 색상으로 눈에 잘 띄게 함
   */
  function _renderSelectionHandles(ctx, d, toX, toY) {
    const handleSize = 5;   // 핸들 반지름 (픽셀)
    const handleColor = COLORS.select;

    // 드로잉 포인트들의 (x,y) 좌표 수집
    const anchors = [];
    d.points.forEach(pt => {
      const x = toX(pt.time);
      const y = toY(pt.price);
      if (x != null && y != null && !isNaN(x) && !isNaN(y)) {
        anchors.push({ x, y });
      }
    });

    if (!anchors.length) return;

    ctx.save();
    ctx.globalAlpha = 1.0;

    anchors.forEach(a => {
      // 외곽 사각형 (흰색 테두리 + 색상 채우기)
      ctx.fillStyle = handleColor;
      ctx.fillRect(a.x - handleSize, a.y - handleSize, handleSize * 2, handleSize * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(a.x - handleSize, a.y - handleSize, handleSize * 2, handleSize * 2);
    });

    ctx.restore();
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
      if (_activeTool === 'hline' || _activeTool === 'vline' || _activeTool === 'eraser' || _activeTool === 'select') return null;

      // 첫 번째 클릭 포인트 + 현재 마우스 위치로 프리뷰 생성
      return {
        type: _activeTool,
        points: [..._clickPoints, _previewPoint],
        stockCode: _currentStockCode,
        color: _currentColor,
      };
    }
  }


  // ══════════════════════════════════════════════════
  //  히트 테스트 — 범용 (가장 가까운 드로잉 찾기)
  // ══════════════════════════════════════════════════

  /**
   * 마우스 좌표에서 가장 가까운 드로잉 찾기 (범용)
   * @param {number} price - 클릭한 가격
   * @param {string} time  - 클릭한 시간
   * @param {number} threshold - 최대 허용 거리 (픽셀, 기본 20)
   * @returns {Object|null} 가장 가까운 드로잉 객체 또는 null
   */
  function _findNearestDrawing(price, time, threshold) {
    if (threshold == null) threshold = 20;
    if (!_chartRef || !_chartRef.mainChart || !_chartRef.candleSeries) return null;

    const ts = _chartRef.mainChart.timeScale();
    const series = _chartRef.candleSeries;
    const clickX = ts.timeToCoordinate(time);
    const clickY = series.priceToCoordinate(price);
    if (clickX == null || clickY == null) return null;

    const visibleDrawings = _drawings.filter(d => d.stockCode === _currentStockCode);
    if (!visibleDrawings.length) return null;

    let bestDist = Infinity;
    let bestDrawing = null;

    visibleDrawings.forEach(d => {
      const dist = _distToDrawing(d, clickX, clickY, ts, series);
      if (dist < bestDist) {
        bestDist = dist;
        bestDrawing = d;
      }
    });

    return (bestDrawing && bestDist < threshold) ? bestDrawing : null;
  }

  /**
   * 마우스 좌표에서 가장 가까운 드로잉을 찾아 삭제
   * @param {number} price - 클릭한 가격
   * @param {string} time  - 클릭한 시간
   * @returns {boolean} 삭제 성공 여부
   */
  function _removeNearestDrawing(price, time) {
    const target = _findNearestDrawing(price, time, 20);
    if (!target) return false;

    const globalIdx = _drawings.indexOf(target);
    if (globalIdx >= 0) {
      // 선택된 드로잉이 삭제 대상이면 선택 해제
      if (_selectedDrawing && _selectedDrawing.id === target.id) {
        _selectedDrawing = null;
      }
      // Undo 기록: 삭제된 드로잉의 깊은 복사 저장
      const copy = { ...target, points: target.points.map(p => ({ ...p })) };
      _pushUndo({ type: 'remove', drawing: copy });
      _drawings.splice(globalIdx, 1);
      _saveDrawings();
      _refresh();
      return true;
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
  //  색상 선택기 (Color Picker)
  // ══════════════════════════════════════════════════

  /**
   * 색상 선택기 DOM 초기화 — draw-toolbar 옆에 팝업 생성
   * 최초 1회만 호출 (attach 시)
   */
  function _initColorPicker() {
    // 이미 존재하면 스킵
    if (document.getElementById('draw-color-picker')) return;

    const picker = document.createElement('div');
    picker.id = 'draw-color-picker';
    picker.className = 'draw-color-picker';
    picker.style.display = 'none';

    DRAW_COLORS.forEach(hex => {
      const swatch = document.createElement('div');
      swatch.className = 'draw-color-swatch';
      swatch.style.background = hex;
      swatch.dataset.color = hex;
      // 기본 선택 (첫 번째)
      if (hex === DRAW_COLORS[0]) swatch.classList.add('active');
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        _setColor(hex);
      });
      picker.appendChild(swatch);
    });

    // draw-toolbar의 부모에 추가 (chart-wrap 내부)
    const toolbar = document.getElementById('draw-toolbar');
    if (toolbar && toolbar.parentElement) {
      toolbar.parentElement.appendChild(picker);
    }
  }

  /**
   * 색상 선택 → _currentColor 업데이트 + 선택된 드로잉에 적용
   */
  function _setColor(hex) {
    _currentColor = hex;

    // 색상 선택기 스와치 활성화 상태 갱신
    const picker = document.getElementById('draw-color-picker');
    if (picker) {
      picker.querySelectorAll('.draw-color-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === hex);
      });
    }

    // 선택된 드로잉이 있으면 즉시 색상 변경
    if (_selectedDrawing) {
      _selectedDrawing.color = hex;
      _saveDrawings();
      _refresh();
    }
  }

  /**
   * 색상 선택기 토글 (표시/숨김)
   */
  function _toggleColorPicker(show) {
    const picker = document.getElementById('draw-color-picker');
    if (!picker) return;

    if (show === undefined) {
      show = picker.style.display === 'none';
    }
    picker.style.display = show ? 'flex' : 'none';

    // 현재 색상에 맞게 활성 스와치 표시
    if (show) {
      const activeColor = _selectedDrawing ? (_selectedDrawing.color || _getDrawingColor(_selectedDrawing)) : (_currentColor || DRAW_COLORS[0]);
      picker.querySelectorAll('.draw-color-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === activeColor);
      });
    }
  }

  /** 외부 클릭 시 색상 선택기 닫기 (최초 1회만 등록) */
  let _dismissRegistered = false;
  function _setupColorPickerDismiss() {
    if (_dismissRegistered) return;
    _dismissRegistered = true;
    document.addEventListener('click', (e) => {
      const picker = document.getElementById('draw-color-picker');
      if (!picker || picker.style.display === 'none') return;
      // 색상 선택기 내부 클릭이면 무시
      if (picker.contains(e.target)) return;
      // 색상 버튼 클릭이면 무시 (토글은 버튼 핸들러에서 처리)
      if (e.target.closest('.draw-color-btn')) return;
      _toggleColorPicker(false);
    });
  }


  // ══════════════════════════════════════════════════
  //  선택/이동 로직 (select 모드)
  // ══════════════════════════════════════════════════

  /**
   * select 모드에서 차트 클릭 시 호출
   * - 드로잉 근처 클릭 → 선택 (드래그 시작 준비)
   * - 빈 곳 클릭 → 선택 해제
   */
  function _handleSelectClick(price, time) {
    const hit = _findNearestDrawing(price, time, 20);

    if (hit) {
      _selectedDrawing = hit;
      // 드래그 시작 상태 저장 (mousedown에서 시작, mousemove로 이동)
      _dragState = {
        drawing: hit,
        startPrice: price,
        startTime: time,
        origPoints: hit.points.map(p => ({ ...p })),  // 깊은 복사
        isDragging: false,  // 실제로 이동했는지 여부
      };
    } else {
      _selectedDrawing = null;
      _dragState = null;
    }

    _refresh();
  }

  /**
   * select 모드에서 마우스 이동 시 호출 (드래그 이동)
   * 선택된 드로잉의 모든 포인트를 delta만큼 이동
   */
  function _handleSelectMouseMove(price, time) {
    if (!_dragState || !_dragState.drawing) return;

    const dPrice = price - _dragState.startPrice;

    // 시간 좌표 차이 계산 — time이 문자열("YYYY-MM-DD")일 수 있으므로
    // 픽셀 좌표 기반으로 역산하여 각 포인트의 time을 조정
    // 간단한 접근: time delta를 일수 단위로 계산
    const dTime = _calcTimeDelta(_dragState.startTime, time);

    if (Math.abs(dPrice) < 0.001 && dTime === 0) return;

    _dragState.isDragging = true;

    // 원래 포인트에 delta를 적용하여 이동
    const drawing = _dragState.drawing;
    drawing.points = _dragState.origPoints.map(orig => ({
      price: orig.price + dPrice,
      time: _addTimeDelta(orig.time, dTime),
    }));

    _refresh();
  }

  /**
   * select 모드에서 마우스 릴리즈 시 호출 (드래그 종료)
   */
  function _handleSelectMouseUp() {
    if (_dragState && _dragState.isDragging) {
      // Undo 기록: 이동 전/후 좌표 저장
      _pushUndo({
        type: 'move',
        drawing: _dragState.drawing,
        prevState: { points: _dragState.origPoints.map(p => ({ ...p })) },
        newState: { points: _dragState.drawing.points.map(p => ({ ...p })) },
      });
      _saveDrawings();
    }
    if (_dragState) {
      _dragState = null;
    }
  }

  /**
   * 시간 좌표 간의 차이를 일수 단위로 계산
   * "YYYY-MM-DD" 문자열 또는 Unix timestamp 지원
   */
  function _calcTimeDelta(t1, t2) {
    const d1 = _timeToUnix(t1);
    const d2 = _timeToUnix(t2);
    if (d1 == null || d2 == null) return 0;
    // 86400초 = 1일
    return Math.round((d2 - d1) / 86400) * 86400;
  }

  /**
   * 시간 좌표에 delta(초)를 더함
   * 입력 형식 보존 (문자열이면 문자열로 반환)
   */
  function _addTimeDelta(t, deltaSec) {
    if (deltaSec === 0) return t;

    if (typeof t === 'string') {
      // "YYYY-MM-DD" → Unix → +delta → "YYYY-MM-DD"
      const unix = _timeToUnix(t);
      if (unix == null) return t;
      const newDate = new Date((unix + deltaSec) * 1000);
      const yyyy = newDate.getFullYear();
      const mm = String(newDate.getMonth() + 1).padStart(2, '0');
      const dd = String(newDate.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    // 숫자(Unix timestamp)
    return t + deltaSec;
  }

  /**
   * 시간 좌표 → Unix timestamp 변환
   */
  function _timeToUnix(t) {
    if (typeof t === 'number') return t;
    if (typeof t === 'string') {
      const d = new Date(t + 'T00:00:00');
      return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
    }
    return null;
  }


  // ══════════════════════════════════════════════════
  //  Undo / Redo
  // ══════════════════════════════════════════════════

  /**
   * undoStack에 액션 기록 + redoStack 초기화
   * @param {{ type: string, drawing: Object, prevState?: Object }} action
   */
  function _pushUndo(action) {
    _undoStack.push(action);
    if (_undoStack.length > MAX_UNDO) _undoStack.shift();
    _redoStack = [];
  }

  /**
   * 마지막 작업을 되돌림 (Ctrl+Z)
   */
  function undo() {
    if (!_undoStack.length) return;
    const action = _undoStack.pop();

    if (action.type === 'add') {
      // 추가된 드로잉 제거
      const idx = _drawings.findIndex(d => d.id === action.drawing.id);
      if (idx >= 0) _drawings.splice(idx, 1);
    } else if (action.type === 'remove') {
      // 삭제된 드로잉 복원
      _drawings.push(action.drawing);
    } else if (action.type === 'move') {
      // 이동 전 좌표로 복원
      const d = _drawings.find(dd => dd.id === action.drawing.id);
      if (d && action.prevState) {
        d.points = action.prevState.points.map(p => ({ ...p }));
      }
    }

    _redoStack.push(action);
    if (_redoStack.length > MAX_UNDO) _redoStack.shift();

    _selectedDrawing = null;
    _dragState = null;
    _saveDrawings();
    _refresh();
  }

  /**
   * 되돌린 작업을 다시 실행 (Ctrl+Y / Ctrl+Shift+Z)
   */
  function redo() {
    if (!_redoStack.length) return;
    const action = _redoStack.pop();

    if (action.type === 'add') {
      // 드로잉 다시 추가
      _drawings.push(action.drawing);
    } else if (action.type === 'remove') {
      // 드로잉 다시 삭제
      const idx = _drawings.findIndex(d => d.id === action.drawing.id);
      if (idx >= 0) _drawings.splice(idx, 1);
    } else if (action.type === 'move') {
      // 이동 후 좌표로 다시 적용
      const d = _drawings.find(dd => dd.id === action.drawing.id);
      if (d && action.newState) {
        d.points = action.newState.points.map(p => ({ ...p }));
      }
    }

    _undoStack.push(action);
    if (_undoStack.length > MAX_UNDO) _undoStack.shift();

    _selectedDrawing = null;
    _dragState = null;
    _saveDrawings();
    _refresh();
  }

  // ── Undo/Redo 키보드 단축키 (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z) ──
  let _keyboardRegistered = false;
  function _setupUndoRedoKeys() {
    if (_keyboardRegistered) return;
    _keyboardRegistered = true;
    document.addEventListener('keydown', (e) => {
      // 드로잉 툴바가 보이지 않으면 무시
      const toolbar = document.getElementById('draw-toolbar');
      if (!toolbar || toolbar.style.display === 'none') return;
      // input/textarea에 포커스 중이면 무시
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            redo();
          } else {
            e.preventDefault();
            undo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          if (!e.shiftKey) {
            e.preventDefault();
            redo();
          }
        }
      }
    });
  }


  // ══════════════════════════════════════════════════
  //  공개 API
  // ══════════════════════════════════════════════════

  /**
   * 도구 선택/해제 토글
   * @param {string} toolName - 'select' | 'trendline' | 'hline' | 'vline' | 'rect' | 'fib' | 'eraser'
   */
  function setTool(toolName) {
    // 같은 도구 다시 클릭 → 해제
    _activeTool = (_activeTool === toolName) ? null : toolName;
    _clickPoints = [];
    _previewPoint = null;

    // 도구 변경 시 드래그 상태 초기화
    _dragState = null;

    // 도구 변경 시 선택 해제 (select 외의 도구로 전환 시)
    if (_activeTool !== 'select') {
      _selectedDrawing = null;
    }

    // 버튼 활성화 상태 갱신
    document.querySelectorAll('.draw-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === _activeTool);
    });

    // 차트 커서 모드 전환
    const mc = document.getElementById('main-chart-container');
    if (mc) {
      mc.classList.remove('drawing-mode', 'select-mode');
      if (_activeTool === 'select') {
        mc.classList.add('select-mode');
      } else if (_activeTool) {
        mc.classList.add('drawing-mode');
      }
    }

    // [FIX] 드로잉 도구 활성 시 차트 드래그 스크롤 + 축 드래그 줌 비활성화
    // pressedMouseMove=true이면 차트가 클릭을 스크롤로 소비하여 subscribeClick 차단됨
    // axisPressedMouseMove=true이면 축 드래그가 클릭 이벤트를 가로챔
    if (_chartRef && _chartRef.mainChart) {
      const active = !!_activeTool;
      _chartRef.mainChart.applyOptions({
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: !active,   // 도구 활성 → 드래그 스크롤 OFF
          horzTouchDrag: !active,
          vertTouchDrag: !active,
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: !active,  // 도구 활성 → 축 드래그 줌 OFF
        },
      });
      console.log('[Draw] setTool:', toolName, '→ _activeTool:', _activeTool, ', scroll/scale locked:', active);
    }

    // 색상 선택기: select 모드에서 선택된 드로잉이 있으면 열 수 있게 준비
    // (자동으로 열지는 않음 — 우클릭으로 열기)

    _refresh();
  }

  /** 현재 활성 도구 반환 */
  function getActiveTool() {
    return _activeTool;
  }

  /** 현재 선택된 드로잉 반환 */
  function getSelectedDrawing() {
    return _selectedDrawing;
  }

  /**
   * 차트 클릭 이벤트 처리 (app.js에서 호출)
   * @param {number} price - 클릭한 가격 좌표
   * @param {string} time  - 클릭한 시간 좌표
   */
  function handleChartClick(price, time) {
    if (!_activeTool) return;

    // ── 선택 도구 ──
    if (_activeTool === 'select') {
      _handleSelectClick(price, time);
      return;
    }

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
      const drawing = {
        id: _genId(),
        type: 'hline',
        points: [{ price, time }],
        stockCode: _currentStockCode,
        color: _currentColor,
      };
      _drawings.push(drawing);
      _pushUndo({ type: 'add', drawing });
      _saveDrawings();
      _refresh();
      return;
    }

    if (_activeTool === 'vline') {
      const drawing = {
        id: _genId(),
        type: 'vline',
        points: [{ price, time }],
        stockCode: _currentStockCode,
        color: _currentColor,
      };
      _drawings.push(drawing);
      _pushUndo({ type: 'add', drawing });
      _saveDrawings();
      _refresh();
      return;
    }

    // ── 2클릭 완성 도구: 추세선, 사각형, 피보나치 ──
    _clickPoints.push({ price, time });

    if (_clickPoints.length >= 2) {
      const drawing = {
        id: _genId(),
        type: _activeTool,
        points: _clickPoints.slice(),
        stockCode: _currentStockCode,
        color: _currentColor,
      };
      _drawings.push(drawing);
      _pushUndo({ type: 'add', drawing });
      _clickPoints = [];
      _previewPoint = null;
      _saveDrawings();
      _refresh();
    }
  }

  /**
   * 차트 마우스 이동 이벤트 처리 (프리뷰 + 드래그 이동)
   * @param {number} price - 현재 마우스 가격 좌표
   * @param {string} time  - 현재 마우스 시간 좌표
   */
  function handleChartMouseMove(price, time) {
    // ── select 모드 드래그 이동 ──
    if (_activeTool === 'select' && _dragState) {
      _handleSelectMouseMove(price, time);
      return;
    }

    // ── 생성 도구 프리뷰 ──
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
   * 마우스 릴리즈 이벤트 처리 (드래그 종료)
   * app.js에서 mouseup 이벤트에 연결
   */
  function handleChartMouseUp() {
    if (_activeTool === 'select') {
      _handleSelectMouseUp();
    }
  }

  /**
   * 색상 선택기 토글 (외부 호출용)
   * @param {boolean} [show] - true=표시, false=숨김, 생략=토글
   */
  function toggleColorPicker(show) {
    _toggleColorPicker(show);
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

    // 색상 선택기 DOM 초기화 (최초 1회)
    _initColorPicker();
    _setupColorPickerDismiss();

    // Undo/Redo 키보드 단축키 등록 (최초 1회)
    _setupUndoRedoKeys();
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
    _selectedDrawing = null;
    _dragState = null;
    _undoStack = [];
    _redoStack = [];
    _refresh();
  }

  /**
   * 현재 종목의 모든 드로잉 삭제
   */
  function clearAll() {
    _drawings = _drawings.filter(d => d.stockCode !== _currentStockCode);
    _selectedDrawing = null;
    _dragState = null;
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
    _selectedDrawing = null;
    _dragState = null;
    _undoStack = [];
    _redoStack = [];
    // 차트 스크롤 + 축 줌 복원
    if (_chartRef && _chartRef.mainChart) {
      try {
        _chartRef.mainChart.applyOptions({
          handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
          handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
        });
      } catch (e) {}
    }
    // 버튼 상태 리셋
    document.querySelectorAll('.draw-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const mc = document.getElementById('main-chart-container');
    if (mc) {
      mc.classList.remove('drawing-mode', 'select-mode');
    }
    // 색상 선택기 닫기
    _toggleColorPicker(false);
  }


  // ── 공개 인터페이스 ──
  return {
    setTool,
    getActiveTool,
    getSelectedDrawing,
    handleChartClick,
    handleChartMouseMove,
    handleChartMouseUp,
    toggleColorPicker,
    attach,
    detach,
    setStockCode,
    clearAll,
    cleanup,
    undo,
    redo,
    // 상수 (외부 참조용)
    DRAW_COLORS,
  };
})();
