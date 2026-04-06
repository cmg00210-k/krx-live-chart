// ══════════════════════════════════════════════════════
//  패턴 시각화 렌더러 v3.1 — HTS급 전문 시각화 + Forecast Zone
//
//  증권사 HTS/MTS 벤치마크 수준의 패턴 차트 시각화
//  ISeriesPrimitive Canvas2D 기반, 캔들과 조화로운 표현
//
//  핵심 원칙:
//  - 패턴 영역을 은은한 그라데이션으로 표시
//  - 라벨은 HTS 스타일 pill badge (Pretendard 12px Bold)
//  - 추세선은 점선+실선 조합으로 전문적 표시
//  - 매수 = 민트/시안, 매도 = 라벤더/퍼플, 구조선 = 금색/회색
//  - MAX 5개 패턴, 신뢰도 순 정렬
//
//  v3.1 추가:
//  - Forecast Zone: 목표가/손절가 예측 영역 (Autochartist 벤치마크)
//    목표 구간은 부드러운 그라데이션, 손절 구간은 사선 줄무늬
//    예상 수익률 텍스트를 영역 중앙에 표시
//
//  벤치마크 소스:
//  - Autochartist: Forecast Zone (목표가 도달 확률 영역)
//  - TrendSpider: Projected Move + R:R ratio bar
//  - TradingView Auto Chart Patterns: 패턴 영역 + 타겟 라인
//  - Thomas Bulkowski: 패턴 높이 기반 measured move 공식
//  - Steve Nison: 캔들스틱 패턴 시각화 원칙
// ══════════════════════════════════════════════════════

const patternRenderer = (() => {

  let _primitive = null;
  let _attachedSeries = null;

  // ── 색상 (패턴 전용 — KRX_COLORS 참조) ──
  const BUY_COLOR    = KRX_COLORS.PTN_BUY;
  const BUY_FILL     = KRX_COLORS.PTN_BUY_FILL;
  const SELL_COLOR   = KRX_COLORS.PTN_SELL;
  const SELL_FILL    = KRX_COLORS.PTN_SELL_FILL;
  const GOLD_COLOR   = KRX_COLORS.PTN_STRUCT;
  const NEUTRAL_COLOR = KRX_COLORS.PTN_NEUTRAL;
  const MAX_PATTERNS = 3;
  const MAX_EXTENDED_LINES = 5;

  // ── 캔들 패턴 전용 색상 (연보라 — 차트 패턴 민트와 구분) ──
  const CANDLE_COLOR = KRX_COLORS.PTN_CANDLE;
  const CANDLE_FILL  = KRX_COLORS.PTN_CANDLE_FILL;
  const CANDLE_NEUTRAL = KRX_COLORS.PTN_NEUTRAL;  // rgba(200,200,200,0.55)

  // ── 패턴 유형별 분류 ──
  const ZONE_PATTERNS = {
    threeWhiteSoldiers: { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    threeBlackCrows:    { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    bullishEngulfing:   { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2 },
    bearishEngulfing:   { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2 },
    bullishHarami:      { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2, useBody: true },
    bearishHarami:      { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2, useBody: true },
    morningStar:        { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    eveningStar:        { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    piercingLine:       { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2 },
    darkCloud:          { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2 },
    tweezerBottom:      { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2 },
    tweezerTop:         { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2 },
    threeInsideUp:      { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    threeInsideDown:    { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    bullishHaramiCross: { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2, useBody: true },
    bearishHaramiCross: { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 2, useBody: true },
    stickSandwich:      { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    abandonedBabyBullish:  { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    abandonedBabyBearish:  { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 3 },
    risingThreeMethods:    { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 5 },
    fallingThreeMethods:   { color: CANDLE_COLOR, fill: CANDLE_FILL, candles: 5 },
  };

  const SINGLE_PATTERNS = {
    hammer:           { key: 'low',   color: CANDLE_COLOR,   direction: 'buy' },
    invertedHammer:   { key: 'low',   color: CANDLE_COLOR,   direction: 'buy' },
    hangingMan:       { key: 'high',  color: CANDLE_COLOR,   direction: 'sell' },
    shootingStar:     { key: 'high',  color: CANDLE_COLOR,   direction: 'sell' },
    doji:             { key: 'high',  color: CANDLE_COLOR,   direction: 'neutral' },
    dragonflyDoji:    { key: 'low',   color: CANDLE_COLOR,   direction: 'buy' },
    gravestoneDoji:   { key: 'high',  color: CANDLE_COLOR,   direction: 'sell' },
    longLeggedDoji:   { key: 'low',   color: CANDLE_COLOR,   direction: 'neutral' },
    spinningTop:      { key: 'high',  color: CANDLE_COLOR,   direction: 'neutral' },
    bullishMarubozu:  { key: 'low',   color: CANDLE_COLOR,   direction: 'buy' },
    bearishMarubozu:  { key: 'high',  color: CANDLE_COLOR,   direction: 'sell' },
    bullishBeltHold:  { key: 'low',   color: CANDLE_COLOR,   direction: 'buy' },
    bearishBeltHold:  { key: 'high',  color: CANDLE_COLOR,   direction: 'sell' },
  };

  const CHART_PATTERNS = new Set([
    'doubleBottom', 'doubleTop',
    'headAndShoulders', 'inverseHeadAndShoulders',
    'ascendingTriangle', 'descendingTriangle', 'symmetricTriangle',
    'risingWedge', 'fallingWedge', 'channel', 'cupAndHandle',
  ]);

  // ── 3계층 분류용 캔들스틱 패턴 Set ──
  const CANDLE_PATTERN_TYPES = new Set([
    'hammer', 'invertedHammer', 'hangingMan', 'shootingStar',
    'doji', 'dragonflyDoji', 'gravestoneDoji', 'longLeggedDoji', 'spinningTop',
    'bullishEngulfing', 'bearishEngulfing',
    'bullishHarami', 'bearishHarami',
    'morningStar', 'eveningStar',
    'threeWhiteSoldiers', 'threeBlackCrows',
    'threeInsideUp', 'threeInsideDown',
    'piercingLine', 'darkCloud',
    'tweezerBottom', 'tweezerTop',
    'bullishMarubozu', 'bearishMarubozu',
    'bullishBeltHold', 'bearishBeltHold',
    'bullishHaramiCross', 'bearishHaramiCross',
    'stickSandwich',
    'abandonedBabyBullish', 'abandonedBabyBearish',
    'risingThreeMethods', 'fallingThreeMethods',
  ]);

  // ── 패턴 한글 이름 (간결) ──
  // ── 패턴 한국어 명칭 (PATTERN_ACADEMIC_META.nameKo 기준) ──
  // 한국 트레이더가 실제 사용하는 용어 (일본어 유래 표준 용어 포함)
  const PATTERN_NAMES_KO = {
    hammer: '해머', invertedHammer: '역해머', hangingMan: '교수형', shootingStar: '유성형',
    doji: '도지', dragonflyDoji: '잠자리도지', gravestoneDoji: '비석도지', longLeggedDoji: '긴다리도지',
    spinningTop: '팽이형',
    bullishEngulfing: '상승장악형', bearishEngulfing: '하락장악형',
    bullishHarami: '상승잉태형', bearishHarami: '하락잉태형',
    piercingLine: '관통형', darkCloud: '먹구름형',
    tweezerBottom: '족집게바닥', tweezerTop: '족집게천장',
    morningStar: '샛별형', eveningStar: '석별형',
    threeWhiteSoldiers: '적삼병', threeBlackCrows: '흑삼병',
    threeInsideUp: '상승삼내형', threeInsideDown: '하락삼내형',
    bullishMarubozu: '양봉마루보주', bearishMarubozu: '음봉마루보주',
    bullishBeltHold: '강세띠두름', bearishBeltHold: '약세띠두름',
    bullishHaramiCross: '강세잉태십자', bearishHaramiCross: '약세잉태십자',
    stickSandwich: '스틱샌드위치',
    abandonedBabyBullish: '강세버림받은아기', abandonedBabyBearish: '약세버림받은아기',
    risingThreeMethods: '상승삼법', fallingThreeMethods: '하락삼법',
    doubleBottom: '이중바닥', doubleTop: '이중천장',
    headAndShoulders: '머리어깨형', inverseHeadAndShoulders: '역머리어깨형',
    ascendingTriangle: '상승삼각형', descendingTriangle: '하락삼각형',
    symmetricTriangle: '대칭삼각형',
    risingWedge: '상승쐐기', fallingWedge: '하락쐐기',
    channel: '채널', cupAndHandle: '컵앤핸들',
  };

  // ── 패턴 방향 판별 ──
  const BULLISH_TYPES = new Set([
    'hammer', 'invertedHammer', 'bullishEngulfing', 'bullishHarami',
    'morningStar', 'threeWhiteSoldiers', 'threeInsideUp', 'doubleBottom',
    'inverseHeadAndShoulders', 'fallingWedge',
    'ascendingTriangle', 'piercingLine', 'cupAndHandle',
    'dragonflyDoji', 'tweezerBottom', 'bullishMarubozu',
    'bullishBeltHold', 'bullishHaramiCross', 'stickSandwich', 'abandonedBabyBullish',
    'risingThreeMethods',
  ]);
  const BEARISH_TYPES = new Set([
    'shootingStar', 'hangingMan', 'bearishEngulfing', 'bearishHarami',
    'eveningStar', 'threeBlackCrows', 'threeInsideDown', 'doubleTop', 'headAndShoulders',
    'risingWedge', 'descendingTriangle',
    'darkCloud', 'gravestoneDoji', 'tweezerTop', 'bearishMarubozu',
    'bearishBeltHold', 'bearishHaramiCross', 'abandonedBabyBearish',
    'fallingThreeMethods',
  ]);


  // ══════════════════════════════════════════════════
  //  Canvas2D Renderer — HTS급 드로잉
  // ══════════════════════════════════════════════════

  class PatternRenderer {
    constructor(data) { this._data = data; }

    draw(target) {
      target.useMediaCoordinateSpace(scope => {
        const ctx = scope.context;
        const w = scope.mediaSize.width;
        const h = scope.mediaSize.height;
        const d = this._data;

        // 빈 데이터 → 즉시 반환
        const hasData = (d.glows && d.glows.length) ||
                        (d.brackets && d.brackets.length) ||
                        (d.trendAreas && d.trendAreas.length) ||
                        (d.polylines && d.polylines.length) ||
                        (d.hlines && d.hlines.length) ||
                        (d.labels && d.labels.length) ||
                        (d.connectors && d.connectors.length) ||
                        (d.forecastZones && d.forecastZones.length) ||
                        (d._extendedLines && d._extendedLines.length);
        if (!hasData) return;

        ctx.save();

        // ── 1. 캔들 글로우 (단일 캔들 패턴 — 수직 스트라이프) ──
        if (d.glows && d.glows.length) {
          d.glows.forEach(g => {
            if (g.x == null || g.y1 == null || g.y2 == null) return;
            // 화면 밖 글로우 스킵
            if (g.x < -20 || g.x > w + 20) return;
            const glowW = g.width || 16;
            const rx = g.x - glowW / 2;
            const ry = Math.min(g.y1, g.y2);
            const rh = Math.abs(g.y2 - g.y1);

            // 반투명 사각형 (캔들 뒤에 연보라 수직 스트라이프)
            ctx.fillStyle = g.fill;
            ctx.fillRect(rx, ry, glowW, rh);

            // 실선 테두리 (alpha 0.25 — 캔들 가시성 우선)
            ctx.strokeStyle = g.border;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.rect(rx, ry, glowW, rh);
            ctx.stroke();
            ctx.globalAlpha = 1;
          });
        }

        // ── 2. 구간 브래킷 (2-3봉 캔들스틱 패턴 그룹핑) ──
        if (d.brackets && d.brackets.length) {
          d.brackets.forEach(br => {
            if (br.x1 == null || br.y1 == null || br.x2 == null || br.y2 == null) return;
            // 완전히 화면 밖이면 스킵
            if (br.x2 < 0 || br.x1 > w) return;
            const rx = Math.min(br.x1, br.x2) - 1;
            const ry = Math.min(br.y1, br.y2) - 1;
            const rw = Math.abs(br.x2 - br.x1) + 2;
            const rh = Math.abs(br.y2 - br.y1) + 2;
            const radius = 4;

            // 균일 반투명 채우기 (연보라)
            ctx.fillStyle = br.fill;
            ctx.beginPath();
            _roundRect(ctx, rx, ry, rw, rh, radius);
            ctx.fill();

            // 실선 테두리 (연보라, alpha 0.25 — 캔들 가시성 우선)
            ctx.strokeStyle = br.border;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            _roundRect(ctx, rx, ry, rw, rh, radius);
            ctx.stroke();
            ctx.globalAlpha = 1;
          });
        }

        // ── 3. 추세 영역 (삼각형/쐐기 수렴 영역 그라데이션) ──
        if (d.trendAreas && d.trendAreas.length) {
          d.trendAreas.forEach(ta => {
            const pts = ta.points;
            if (!pts || pts.length < 3) return;
            const validPts = pts.filter(p => p.x != null && p.y != null);
            if (validPts.length < 3) return;
            // 모든 점이 화면 밖이면 스킵
            const allLeft = validPts.every(p => p.x < 0);
            const allRight = validPts.every(p => p.x > w);
            if (allLeft || allRight) return;

            ctx.beginPath();
            ctx.moveTo(validPts[0].x, validPts[0].y);
            for (let i = 1; i < validPts.length; i++) {
              ctx.lineTo(validPts[i].x, validPts[i].y);
            }
            ctx.closePath();
            ctx.fillStyle = ta.fill || KRX_COLORS.PTN_NEUTRAL_FILL(0.04);
            ctx.fill();
          });
        }

        // ── 4. 폴리라인 (W/M, 넥라인, H&S 연결선) ──
        if (d.polylines && d.polylines.length) {
          d.polylines.forEach(pl => {
            const pts = pl.points.filter(p => p.x != null && p.y != null);
            if (pts.length < 2) return;
            // 모든 점이 화면 밖이면 스킵
            const allLeft = pts.every(p => p.x < 0);
            const allRight = pts.every(p => p.x > w);
            if (allLeft || allRight) return;

            ctx.beginPath();
            if (pl.smooth && pts.length >= 3) {
              // 부드러운 곡선 (W/M 형태)
              ctx.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length - 1; i++) {
                const xc = (pts[i].x + pts[i + 1].x) / 2;
                const yc = (pts[i].y + pts[i + 1].y) / 2;
                ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
              }
              ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            } else {
              ctx.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            }

            ctx.strokeStyle = pl.color;
            ctx.lineWidth = pl.width || 1.5;
            ctx.setLineDash(pl.dash || []);
            ctx.stroke();
            ctx.setLineDash([]);

            // 끝점 원형 마커 (선택적)
            if (pl.dots) {
              ctx.fillStyle = pl.color;
              pts.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
                ctx.fill();
              });
            }
          });
        }

        // ── 5. 수평선 (지지/저항, 손절/목표가) ──
        if (d.hlines && d.hlines.length) {
          d.hlines.forEach(hl => {
            if (hl.y == null) return;
            const x1 = hl.x1 != null ? hl.x1 : 0;
            const x2 = hl.x2 != null ? hl.x2 : w;

            ctx.beginPath();
            ctx.moveTo(x1, hl.y);
            ctx.lineTo(x2, hl.y);
            ctx.strokeStyle = hl.color;
            ctx.lineWidth = hl.width || 1;
            ctx.setLineDash(hl.dash || [5, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // 우측 가격 라벨 (HTS 스타일 태그 — 확대)
            if (hl.priceLabel) {
              const labelText = hl.priceLabel;
              ctx.font = "700 12px 'JetBrains Mono', monospace";
              const tm = ctx.measureText(labelText);
              const tagW = tm.width + 16;
              const tagH = 20;
              // 우측 끝에서 최소 60px 안쪽 (잘림 방지)
              const lx = Math.min(x2 - tm.width - 18, w - tagW - 60);
              const ly = hl.y;

              // 태그 배경
              ctx.fillStyle = KRX_COLORS.TAG_BG(0.92);
              ctx.beginPath();
              _roundRect(ctx, lx - 4, ly - tagH / 2, tagW, tagH, 3);
              ctx.fill();
              ctx.strokeStyle = hl.color;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              _roundRect(ctx, lx - 4, ly - tagH / 2, tagW, tagH, 3);
              ctx.stroke();

              ctx.fillStyle = hl.color;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, lx, ly);
            }

            // 끝점 삼각형 (손절/목표)
            if (hl.marker) {
              ctx.setLineDash([]);
              ctx.fillStyle = hl.color;
              ctx.beginPath();
              if (hl.marker === 'stop') {
                // 아래 삼각형 (손절)
                ctx.moveTo(w - 50, hl.y - 5);
                ctx.lineTo(w - 45, hl.y + 4);
                ctx.lineTo(w - 55, hl.y + 4);
              } else if (hl.marker === 'invalid') {
                // 다이아몬드 (무효화)
                ctx.moveTo(w - 50, hl.y - 5);
                ctx.lineTo(w - 45, hl.y);
                ctx.lineTo(w - 50, hl.y + 5);
                ctx.lineTo(w - 55, hl.y);
                ctx.closePath();
              } else {
                // 위 삼각형 (목표)
                ctx.moveTo(w - 50, hl.y + 5);
                ctx.lineTo(w - 45, hl.y - 4);
                ctx.lineTo(w - 55, hl.y - 4);
              }
              ctx.fill();
            }
          });
        }

        // ── 6. 패턴 연결선 + 빈 원 마커 (H&S 등) ──
        if (d.connectors && d.connectors.length) {
          d.connectors.forEach(cn => {
            // 빈 원 마커 (H&S 어깨/머리 위치)
            if (cn.hollowCircle) {
              if (cn.circleX == null || cn.circleY == null) return;
              if (cn.circleX < -20 || cn.circleX > w + 20) return;
              ctx.beginPath();
              ctx.arc(cn.circleX, cn.circleY, cn.circleR || 4, 0, Math.PI * 2);
              ctx.strokeStyle = cn.color;
              ctx.lineWidth = cn.circleWidth || 1.5;
              ctx.stroke();
              return;
            }

            const pts = cn.points.filter(p => p.x != null && p.y != null);
            if (pts.length < 2) return;
            // 모든 점이 화면 밖이면 스킵
            const allLeft = pts.every(p => p.x < 0);
            const allRight = pts.every(p => p.x > w);
            if (allLeft || allRight) return;

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);

            ctx.strokeStyle = cn.color;
            ctx.lineWidth = cn.width || 1;
            ctx.setLineDash(cn.dash || [2, 3]);
            ctx.globalAlpha = cn.alpha || 0.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);

            // 꼭짓점에 작은 원
            if (cn.showDots) {
              ctx.fillStyle = cn.color;
              pts.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
              });
            }
          });
        }

        // ── 7. 패턴 라벨 (HTS 스타일 pill badge) ──
        // [Audit C-3] extreme zoom-out: 라벨 텍스트 생략 (구조적 오버레이만 유지)
        if (d.labels && d.labels.length && !(d._visibleBars > 800)) {
          ctx.setLineDash([]);
          // [Audit C-1] Zoom-adaptive font size: visibleBars 기반 스케일
          var vbars = d._visibleBars || 200;
          var fontSize = vbars <= 30 ? 11 : (vbars <= 150 ? 12 : (vbars <= 400 ? 11 : 10));
          ctx.font = `700 ${fontSize}px 'Pretendard', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // 라벨 겹침 방지: 이미 배치된 라벨 위치 추적
          const placedLabels = [];

          d.labels.forEach(lb => {
            if (lb.x == null) return;
            // 화면 밖 라벨 스킵
            if (lb.x < -50 || lb.x > w + 50) return;

            // OHLC 바 겹침 방지: 상단 40px 이내에 라벨 금지
            // OHLC 바 높이(~24px) + top(8px) + 여유 = ~40px → 안전 마진 확대
            const OHLC_SAFE_Y = 40;

            let labelY;
            if (lb.y != null) {
              labelY = lb.y;
              // 명시적 y좌표도 OHLC 바와 겹치면 아래로 밀기
              if (labelY < OHLC_SAFE_Y) labelY = OHLC_SAFE_Y;
            } else if (lb.placement === 'bottom') {
              labelY = h * 0.84;
            } else if (lb.placement === 'top') {
              labelY = Math.max(OHLC_SAFE_Y, h * 0.06);
            } else {
              return;
            }

            // 겹침 방지: 기존 라벨과 충돌 시 y 오프셋
            const textMetrics = ctx.measureText(lb.text);
            // [Audit C-2] Zoom-adaptive padding
            var pad = fontSize <= 10 ? 7 : 10;
            const boxW = textMetrics.width + pad;
            const boxH = fontSize + (fontSize <= 10 ? 4 : 6);
            let attempts = 0;
            while (attempts < 6) {
              let collision = false;
              for (const placed of placedLabels) {
                if (Math.abs(placed.x - lb.x) < (boxW + placed.w) / 2 + 4 &&
                    Math.abs(placed.y - labelY) < boxH + 2) {
                  collision = true;
                  break;
                }
              }
              if (!collision) break;
              // [Audit A-1 BUG FIX] 충돌 시 차트 밖으로 탈출: top→위(−Y), bottom→아래(+Y)
              labelY += (lb.placement === 'top' ? -1 : 1) * (boxH + 2);
              attempts++;
            }

            // 범위 제한 (OHLC 바 영역 아래에서만 표시)
            labelY = Math.max(OHLC_SAFE_Y, Math.min(h - boxH / 2 - 2, labelY));
            // 화면 밖 라벨 스킵 (y축)
            if (labelY < -20 || labelY > h + 20) return;

            placedLabels.push({ x: lb.x, y: labelY, w: boxW });

            const boxX = lb.x - boxW / 2;
            const boxY = labelY - boxH / 2;
            const radius = fontSize <= 10 ? 2 : 3;

            // [Phase2-B] Active 패턴: 배경 틴트 + 두꺼운 테두리, Expired: 흐린 배경
            var isActive = lb.outcome === 'active';
            var isExpired = lb.outcome === 'hit' || lb.outcome === 'failed';
            // [Phase2-C] Aging decay: expired 패턴은 alpha 감소 (decayAlpha는 labels에 전달)
            var agingAlpha = lb.decayAlpha != null ? lb.decayAlpha : 1.0;

            // ── pill 배경 ──
            ctx.globalAlpha = agingAlpha;
            if (isActive) {
              // Active: 방향 색상 틴트 배경 (KRX_COLORS 기반)
              var isBuyLabel = BULLISH_TYPES.has(lb._patternType || '');
              ctx.fillStyle = isBuyLabel
                ? BUY_FILL
                : (typeof CANDLE_FILL === 'function' ? CANDLE_FILL(0.12) : CANDLE_FILL);
            } else {
              ctx.fillStyle = lb.bgColor || KRX_COLORS.TAG_BG(0.88);
            }
            ctx.beginPath();
            _roundRect(ctx, boxX, boxY, boxW, boxH, radius);
            ctx.fill();

            // ── 좌측 컬러 바 (패턴 방향 인디케이터) ──
            ctx.fillStyle = lb.color;
            ctx.beginPath();
            _roundRect(ctx, boxX, boxY, 3, boxH, [radius, 0, 0, radius]);
            ctx.fill();

            // ── 테두리 (Active: 두껍고 불투명, Expired: 흐림) ──
            // [Audit B-2] 저신뢰 패턴(confidence<50): 점선 테두리로 불확실성 표현
            var confScore = lb.confidence != null ? lb.confidence : 50;
            var isLowConf = confScore < 50;
            ctx.strokeStyle = lb.color;
            if (isActive) {
              ctx.lineWidth = isLowConf ? 1.2 : 1.8;
              ctx.globalAlpha = 1.0;
              if (isLowConf) ctx.setLineDash([2, 3]);
            } else {
              var wcAlpha = lb.wc != null ? Math.min(0.3 + 0.5 * lb.wc, 1.0) : 0.65;
              ctx.lineWidth = lb.wc != null ? Math.max(0.5, Math.min(lb.wc * 1.2, 2.0)) : 0.8;
              ctx.globalAlpha = wcAlpha * agingAlpha;
              if (isLowConf) ctx.setLineDash([2, 3]);
            }
            ctx.beginPath();
            _roundRect(ctx, boxX, boxY, boxW, boxH, radius);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = agingAlpha;

            // ── 텍스트 ──
            // [Audit D-2] 극저 신뢰(confidence<35): 텍스트 반투명 처리 (ghost label)
            var textAlpha = confScore < 35 ? 0.55 : agingAlpha;
            ctx.globalAlpha = textAlpha;
            ctx.fillStyle = lb.color;
            ctx.fillText(lb.text, lb.x + 1.5, labelY);

            // ── 적중 상태 도트 (Active=금색◌ / Hit=빨강● / Failed=파랑●) ──
            ctx.globalAlpha = 1;
            // [Audit D-3] 극저 신뢰 패턴은 도트 생략 — 추적 의미 없음
            if (lb.outcome && confScore >= 35) {
              const dotX = boxX + boxW + 5;
              const dotR = isActive ? 4.5 : 3.5;
              ctx.beginPath();
              ctx.arc(dotX, labelY, dotR, 0, Math.PI * 2);
              if (lb.outcome === 'hit') {
                ctx.fillStyle = KRX_COLORS.UP;
                ctx.fill();
              } else if (lb.outcome === 'failed') {
                ctx.fillStyle = KRX_COLORS.DOWN;
                ctx.fill();
              } else {
                // active: 두꺼운 빈 원 + 금색 (진행 중 강조)
                ctx.strokeStyle = KRX_COLORS.ACCENT;
                ctx.lineWidth = 2.0;
                ctx.stroke();
              }
            }
            // [Audit A-2] Canvas2D state leak 방지: 다음 라벨 iteration 전 초기화
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
          });
        }

        // ── 8. 예측 영역 (Forecast Zone — 목표가/손절가 구간 시각화) ──
        //  벤치마크: Autochartist의 Forecast Zone, TrendSpider의 Projected Move
        //  패턴 완성 후 예상 이동 영역을 반투명 그라데이션으로 표시
        //  매수: 현재가 → 목표가 (민트 그라데이션), 현재가 → 손절가 (라벤더 줄무늬)
        //  매도: 반대 방향
        if (d.forecastZones && d.forecastZones.length) {
          d.forecastZones.forEach(fz => {
            if (fz.x1 == null || fz.x2 == null || fz.yEntry == null) return;
            let zoneW = Math.abs(fz.x2 - fz.x1);
            let zoneX = Math.min(fz.x1, fz.x2);
            // 화면 밖이면 스킵
            if (zoneX + zoneW < 0 || zoneX > w) return;
            // canvas 경계로 클리핑
            if (zoneX < 0) { zoneW += zoneX; zoneX = 0; }
            if (zoneX + zoneW > w) { zoneW = w - zoneX; }

            // ── Wc × CI95 기반 전체 영역 alpha 변조 ──
            // Wc: 적응형 가중치 (낮을수록 투명)
            // ciAlpha: 95% 신뢰구간 폭 기반 (넓을수록 투명)
            // 곱연산: 독립적 불확실성 소스 2개를 곱으로 결합
            //   — Wc만 높아도 CI가 넓으면 낮은 확신, 반대도 마찬가지
            var wcAlpha = fz.wc != null ? Math.min(0.4 + 0.5 * fz.wc, 1.0) : 1.0;
            var ciAlpha = fz.ciAlpha != null ? fz.ciAlpha : 1.0;
            var fzAlpha = Math.max(0.18, wcAlpha * ciAlpha);
            ctx.globalAlpha = fzAlpha;

            // ── 목표 영역 (수익 구간): 부드러운 그라데이션 ──
            if (fz.yTarget != null) {
              const tY = Math.min(fz.yEntry, fz.yTarget);
              const tH = Math.abs(fz.yTarget - fz.yEntry);
              if (tH > 2) {
                const tGrad = ctx.createLinearGradient(0, fz.yEntry, 0, fz.yTarget);
                tGrad.addColorStop(0, fz.targetFillNear || KRX_COLORS.FZ_TARGET_NEAR);
                tGrad.addColorStop(1, fz.targetFillFar  || KRX_COLORS.FZ_TARGET_FAR);
                ctx.fillStyle = tGrad;
                ctx.fillRect(zoneX, tY, zoneW, tH);

                // 목표가 점선 제거됨 — hline(Layer 5)이 동일 Y에 이미 그림

                // 수익률 텍스트 (영역 중앙, 퍼센트만 표시)
                if (fz.returnText) {
                  const retX = zoneX + zoneW / 2;
                  const retY = (fz.yEntry + fz.yTarget) / 2;
                  ctx.font = "700 11px 'Pretendard', sans-serif";
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  const rtm = ctx.measureText(fz.returnText);
                  ctx.fillStyle = KRX_COLORS.TAG_BG(0.75);
                  ctx.beginPath();
                  _roundRect(ctx, retX - rtm.width / 2 - 4, retY - 7, rtm.width + 8, 14, 3);
                  ctx.fill();
                  ctx.fillStyle = fz.returnColor || KRX_COLORS.PTN_BUY;
                  ctx.fillText(fz.returnText, retX, retY);

                  // 승률 텍스트 (return % 아래, sampleSize >= 10 조건 충족 시만)
                  if (fz.probWinRate != null) {
                    const wrText = '승률 ' + Math.round(fz.probWinRate) + '%';
                    const wrY = retY + 14;
                    // 영역 내에 들어가는지 확인 (목표존 경계 벗어나면 표시 안함)
                    const zoneTop = Math.min(fz.yEntry, fz.yTarget);
                    const zoneBot = Math.max(fz.yEntry, fz.yTarget);
                    if (wrY - 6 >= zoneTop && wrY + 6 <= zoneBot) {
                      // 조건부 색상: winRate > 60 → 민트, 40~60 → 노랑, <40 → 파랑
                      let wrColor;
                      if (fz.probWinRate > 60) {
                        wrColor = KRX_COLORS.PTN_BUY;
                      } else if (fz.probWinRate >= 40) {
                        wrColor = KRX_COLORS.NEUTRAL;
                      } else {
                        wrColor = KRX_COLORS.DOWN;
                      }
                      ctx.save();
                      ctx.font = "700 10px 'Pretendard', sans-serif";
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      const wrm = ctx.measureText(wrText);
                      ctx.fillStyle = KRX_COLORS.TAG_BG(0.70);
                      ctx.beginPath();
                      _roundRect(ctx, retX - wrm.width / 2 - 4, wrY - 6, wrm.width + 8, 12, 3);
                      ctx.fill();
                      ctx.fillStyle = wrColor;
                      ctx.fillText(wrText, retX, wrY);
                      ctx.restore();
                    }
                  }
                }
              }
            }

            // ── 목표가 화면 밖 fallback: 차트 경계 화살표 + 수익률 라벨 ──
            // 목표가 y좌표가 null(화면 외부)이면 상/하단 경계에 방향 화살표를 표시한다.
            // buy 패턴 → 위(y≈0), sell 패턴 → 아래(y≈h)
            if (fz.offScreenTarget && fz.returnText) {
              ctx.save();

              const arrowX = zoneX + zoneW / 2;
              const isBuyDir = fz.isBuy !== false;  // 기본값 true(보수적)
              const edgeY = isBuyDir ? 6 : h - 6;
              const arrowDir = isBuyDir ? -1 : 1;   // -1=위(▲), +1=아래(▼)

              const arrowColor = fz.returnColor || KRX_COLORS.PTN_BUY;

              // 삼각형 화살표
              const aW = 7;   // 화살표 가로 반폭
              const aH = 6;   // 화살표 세로 높이
              ctx.fillStyle = arrowColor;
              ctx.globalAlpha = 0.85;
              ctx.beginPath();
              ctx.moveTo(arrowX,        edgeY);
              ctx.lineTo(arrowX - aW,   edgeY + arrowDir * aH);
              ctx.lineTo(arrowX + aW,   edgeY + arrowDir * aH);
              ctx.closePath();
              ctx.fill();

              // 수익률 pill 라벨 (화살표 바로 아래/위)
              const lblY = isBuyDir ? edgeY + aH + 10 : edgeY - aH - 10;
              ctx.font = "700 10px 'Pretendard', sans-serif";
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const rtm = ctx.measureText(fz.returnText);
              ctx.globalAlpha = 0.82;
              ctx.fillStyle = KRX_COLORS.TAG_BG(0.80);
              ctx.beginPath();
              _roundRect(ctx, arrowX - rtm.width / 2 - 5, lblY - 7, rtm.width + 10, 14, 3);
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.fillStyle = arrowColor;
              ctx.fillText(fz.returnText, arrowX, lblY);

              ctx.restore();
            }

            // ── 손절 영역 (위험 구간): 오렌지 그라데이션 ──
            if (fz.yStop != null) {
              const sY = Math.min(fz.yEntry, fz.yStop);
              const sH = Math.abs(fz.yStop - fz.yEntry);
              if (sH > 2) {
                // 그라데이션 채우기 (진입점 → 손절가: 오렌지 fade)
                const stopGrad = ctx.createLinearGradient(zoneX, fz.yEntry, zoneX, fz.yStop);
                stopGrad.addColorStop(0, fz.stopFill || KRX_COLORS.FZ_STOP_NEAR);
                stopGrad.addColorStop(1, KRX_COLORS.FZ_STOP_FAR);
                ctx.fillStyle = stopGrad;
                ctx.fillRect(zoneX, sY, zoneW, sH);

                // 손절가 점선 제거됨 — hline(Layer 5)이 동일 Y에 이미 그림

                // 손절 텍스트 라벨 (퍼센트만 표시)
                if (fz.stopColor) {
                  const stopPct = (fz.entry && fz.stopPrice)
                    ? (Math.abs(fz.entry - fz.stopPrice) / fz.entry * 100).toFixed(1)
                    : null;
                  const slText = stopPct ? '-' + stopPct + '%' : '';
                  if (slText) {
                    const slX = zoneX + zoneW / 2;
                    const slY = (fz.yEntry + fz.yStop) / 2;
                    ctx.font = "700 11px 'Pretendard', sans-serif";
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const slm = ctx.measureText(slText);
                    ctx.fillStyle = KRX_COLORS.TAG_BG(0.75);
                    ctx.beginPath();
                    _roundRect(ctx, slX - slm.width / 2 - 4, slY - 7, slm.width + 8, 14, 3);
                    ctx.fill();
                    ctx.fillStyle = fz.stopColor;
                    ctx.fillText(slText, slX, slY);
                  }
                }
              }
            }
            // ── R:R 비율 수직 바 (목표/손절 양쪽 존재 시) ──
            if (fz.rrRatio != null && fz.yTarget != null && fz.yStop != null) {
              const barX = fz.x2 + 6;
              if (barX < w - 40) {
                // 목표 구간 수직선 (민트)
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = fz.targetBorder || KRX_COLORS.FZ_TARGET_BORDER;
                ctx.beginPath();
                ctx.moveTo(barX, fz.yEntry);
                ctx.lineTo(barX, fz.yTarget);
                ctx.stroke();
                // 손절 구간 수직선 (오렌지 — 목표 민트와 시각 구분)
                ctx.strokeStyle = fz.stopColor || KRX_COLORS.PTN_STOP;
                ctx.beginPath();
                ctx.moveTo(barX, fz.yEntry);
                ctx.lineTo(barX, fz.yStop);
                ctx.stroke();
                // 진입점 마커
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(barX, fz.yEntry, 2.5, 0, Math.PI * 2);
                ctx.fill();
                // R:R 텍스트 라벨
                ctx.font = "700 10px 'Pretendard', sans-serif";
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                const rrText = 'R:R ' + (fz.rrRatio >= 10 ? fz.rrRatio.toFixed(0) : fz.rrRatio.toFixed(1));
                const rrY = (fz.yEntry + fz.yTarget) / 2;
                const rrM = ctx.measureText(rrText);
                ctx.fillStyle = KRX_COLORS.TAG_BG(0.80);
                ctx.beginPath();
                _roundRect(ctx, barX + 5, rrY - 7, rrM.width + 8, 14, 3);
                ctx.fill();
                ctx.fillStyle = fz.rrRatio >= 1.5 ? KRX_COLORS.PTN_BUY : KRX_COLORS.PTN_TARGET;
                ctx.fillText(rrText, barX + 9, rrY);
              }
            }
            // Wc alpha 복원
            ctx.globalAlpha = 1;
          });
        }

        // ── 9. 연장 구조선 (visible 밖 차트 패턴의 넥라인/추세선 → 현재 범위까지 연장) ──
        //  accent 금색 점선, lineWidth 1.5, dash [8, 4] (LONG), alpha 0.25
        if (d._extendedLines && d._extendedLines.length) {
          d._extendedLines.forEach(line => {
            const pts = line.points;
            if (!pts || pts.length < 2) return;

            const p1 = pts[0];
            const p2 = pts[pts.length - 1];

            ctx.save();
            ctx.globalAlpha = 0.35;  // 0.25→0.35: 구조선 가시성 향상 (Kiwoom 0.35 기준)
            ctx.strokeStyle = KRX_COLORS.ACCENT;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 4]);

            if (line.isNeckline) {
              // 넥라인: 수평선으로 전체 너비 연장
              const avgY = (p1.y + p2.y) / 2;
              ctx.beginPath();
              ctx.moveTo(0, avgY);
              ctx.lineTo(w, avgY);
              ctx.stroke();
            } else {
              // 추세선: 기울기 기반으로 visible 범위 전체까지 외삽
              const dx = p2.x - p1.x;
              const slope = dx !== 0 ? (p2.y - p1.y) / dx : 0;

              // 화면 좌측 (x=0) 과 우측 (x=w) 에서의 y 좌표 계산
              var extStartX = 0;
              var extEndX = w;
              var extStartY = p1.y + slope * (extStartX - p1.x);
              var extEndY = p1.y + slope * (extEndX - p1.x);

              // y 범위 제한 (차트 영역 밖으로 너무 벗어나지 않도록)
              if (slope !== 0) {
                if (extStartY < -h) { extStartX = p1.x + (-h - p1.y) / slope; extStartY = -h; }
                if (extStartY > h * 2) { extStartX = p1.x + (h * 2 - p1.y) / slope; extStartY = h * 2; }
                if (extEndY < -h) { extEndX = p1.x + (-h - p1.y) / slope; extEndY = -h; }
                if (extEndY > h * 2) { extEndX = p1.x + (h * 2 - p1.y) / slope; extEndY = h * 2; }
              }

              ctx.beginPath();
              ctx.moveTo(extStartX, extStartY);
              ctx.lineTo(extEndX, extEndY);
              ctx.stroke();
            }

            ctx.setLineDash([]);
            ctx.restore();
          });
        }

        ctx.restore();
      });
    }
  }

  // ── roundRect 유틸리티 (브라우저 호환) ──
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
  //  PaneView — 데이터 → 픽셀 좌표 변환
  // ══════════════════════════════════════════════════

  class PatternPaneView {
    constructor(source) {
      this._source = source;
      this._drawData = _emptyData();
      this._outcomeCache = new Map(); // Fix 3: cache outcome per pattern to avoid per-frame O(n)
    }

    zOrder() { return 'normal'; }

    update() {
      const src = this._source;
      if (!src._chart || !src._series || !src._patterns) {
        this._drawData = _emptyData();
        this._outcomeCache.clear();
        return;
      }

      const { candles, patterns } = src._patterns;
      const extLines = src._extendedLines || [];
      const series = src._series;
      const ts = src._chart.timeScale();

      // 가격/시간 → 픽셀 좌표 헬퍼
      const toXY = (time, price) => ({
        x: ts.timeToCoordinate(time),
        y: series.priceToCoordinate(price),
      });

      const data = _emptyData();
      // [Audit C-1] Zoom-adaptive: visibleBars를 draw data에 전달
      data._visibleBars = src._visibleBars || 200;

      patterns.forEach(p => {
        // ── 단일 캔들 패턴: 글로우 하이라이트 ──
        if (SINGLE_PATTERNS[p.type]) {
          this._buildSingleGlow(candles, p, toXY, data.glows);
        }

        // ── 다중 캔들 패턴: 그룹핑 브래킷 ──
        if (ZONE_PATTERNS[p.type]) {
          this._buildBracket(candles, p, toXY, data.brackets);
        }

        // ── 차트 패턴별 특화 시각화 ──
        if (p.type === 'doubleBottom') {
          this._buildDoubleBottom(candles, p, toXY, data);
        } else if (p.type === 'doubleTop') {
          this._buildDoubleTop(candles, p, toXY, data);
        } else if (p.type === 'headAndShoulders') {
          this._buildHeadAndShoulders(candles, p, toXY, data, false);
        } else if (p.type === 'inverseHeadAndShoulders') {
          this._buildHeadAndShoulders(candles, p, toXY, data, true);
        } else if (p.type === 'ascendingTriangle' || p.type === 'descendingTriangle' || p.type === 'symmetricTriangle') {
          this._buildTriangle(candles, p, toXY, data);
        } else if (p.type === 'risingWedge' || p.type === 'fallingWedge') {
          this._buildWedge(candles, p, toXY, data);
        } else if (p.type === 'channel') {
          this._buildChannel(candles, p, toXY, data);
        } else if (p.type === 'cupAndHandle') {
          this._buildCupAndHandle(candles, p, toXY, data);
        }

        // ── 패턴 라벨 생성 (모든 패턴 공통) ──
        this._buildLabel(candles, p, toXY, data.labels);

        // ── 예측 영역 생성 (목표가/손절가가 있는 최상위 패턴) ──
        if (p === patterns[0]) {
          this._buildForecastZone(candles, p, toXY, ts, data.forecastZones);
        }
      });

      // ── 손절/목표가 수평선 (최상위 1개) ──
      this._buildStopTarget(patterns, candles, series, toXY, data.hlines);

      // ── 연장 구조선 (visible 밖 차트 패턴의 넥라인/추세선) ──
      if (extLines.length > 0) {
        data._extendedLines = [];
        extLines.forEach(line => {
          if (!line.points || line.points.length < 2) return;
          // 포인트를 픽셀 좌표로 변환
          const pixelPts = line.points.map(pt => toXY(pt.time, pt.value));
          // 좌표 변환 실패 체크
          if (pixelPts.some(pt => pt.x == null || pt.y == null)) return;
          data._extendedLines.push({
            points: pixelPts,
            isNeckline: !!line.isNeckline,
            patternType: line.patternType,
            patternName: line.patternName,
          });
        });
      }

      this._drawData = data;
    }

    renderer() { return new PatternRenderer(this._drawData); }

    // ══════════════════════════════════════════════════
    //  단일 캔들 패턴: 은은한 글로우 + 미세한 수평선
    // ══════════════════════════════════════════════════
    _buildSingleGlow(candles, p, toXY, glows) {
      const cfg = SINGLE_PATTERNS[p.type];
      const idx = p.endIndex;
      if (idx == null || idx >= candles.length) return;

      const c = candles[idx];
      const hi = toXY(c.time, c.high);
      const lo = toXY(c.time, c.low);
      if (hi.x == null || hi.y == null || lo.y == null) return;

      // 캔들 패턴: 연보라 수직 스트라이프 (채우기 0.06 — 캔들 가시성 우선)
      const isNeutral = cfg.direction === 'neutral';
      const fillColor = isNeutral
        ? KRX_COLORS.PTN_NEUTRAL_FILL(0.06)
        : KRX_COLORS.PTN_CANDLE_FILL(0.06);
      const borderColor = isNeutral
        ? CANDLE_NEUTRAL
        : CANDLE_COLOR;

      glows.push({
        x: hi.x,
        y1: hi.y,
        y2: lo.y,
        width: 14,
        fill: fillColor,
        border: borderColor,
      });
    }

    // ══════════════════════════════════════════════════
    //  다중 캔들 패턴: 라운드 브래킷 그룹핑
    // ══════════════════════════════════════════════════
    _buildBracket(candles, p, toXY, brackets) {
      const cfg = ZONE_PATTERNS[p.type];
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      let upper = -Infinity, lower = Infinity;
      if (cfg.useBody) {
        // 잉태형: 모봉 기준
        const m = candles[si];
        upper = Math.max(m.open, m.close);
        lower = Math.min(m.open, m.close);
      } else {
        for (let i = si; i <= ei && i < candles.length; i++) {
          if (candles[i].high > upper) upper = candles[i].high;
          if (candles[i].low < lower) lower = candles[i].low;
        }
      }
      if (!isFinite(upper) || !isFinite(lower)) return;

      const tl = toXY(candles[si].time, upper);
      const br = toXY(candles[ei].time, lower);
      if (tl.x == null || tl.y == null || br.x == null || br.y == null) return;

      // 캔들 패턴: 균일 연보라 채우기 (0.06 — 캔들 가시성 우선)
      brackets.push({
        x1: tl.x, y1: tl.y,
        x2: br.x, y2: br.y,
        fill: KRX_COLORS.PTN_CANDLE_FILL(0.06),
        border: CANDLE_COLOR,
      });
    }

    // ══════════════════════════════════════════════════
    //  이중 바닥: 사각형 영역 + 넥라인 + 저점 삼각 마커
    // ══════════════════════════════════════════════════
    _buildDoubleBottom(candles, p, toXY, data) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      // 넥라인: 패턴 객체에서 직접 읽기 (독립 재계산 제거 — patterns.js와 완전 일치 보장)
      const neckline = p.neckline;
      if (neckline == null || !isFinite(neckline)) return;

      // 두 저점의 최저가
      let minLow = Infinity;
      for (let j = si; j <= ei && j < candles.length; j++) {
        if (candles[j].low < minLow) minLow = candles[j].low;
      }
      if (!isFinite(minLow)) return;

      // 좌/우 수직 경계선 (lines-only — TradingView 스타일, 채우기 없음)
      const topLeft = toXY(candles[si].time, neckline);
      const bottomRight = toXY(candles[ei].time, minLow);
      if (topLeft.x != null && topLeft.y != null && bottomRight.x != null && bottomRight.y != null) {
        const rx = Math.min(topLeft.x, bottomRight.x);
        const ry = Math.min(topLeft.y, bottomRight.y);
        const rw = Math.abs(bottomRight.x - topLeft.x);
        const rh = Math.abs(bottomRight.y - topLeft.y);

        data.polylines.push({
          points: [{ x: rx, y: ry }, { x: rx, y: ry + rh }],
          color: BUY_COLOR,
          width: 1.5,
          dash: [5, 3],
        });
        data.polylines.push({
          points: [{ x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }],
          color: BUY_COLOR,
          width: 1.5,
          dash: [5, 3],
        });
      }

      // 넥라인 수평 연장 — 패턴 범위 + 우측 3봉만 (공간 분리)
      // 돌파 확인 시: 실선 + mint 색상 (확정된 구조선)
      // 미확인 시: 점선 + silver (잠정 구조선)
      const breakConfirmed = !!p.necklineBreakConfirmed;
      const neckColor = breakConfirmed ? BUY_COLOR : GOLD_COLOR;
      const neckDash = breakConfirmed ? [] : [5, 3];
      const neckWidth = breakConfirmed ? 2 : 1.5;
      const extIdx = Math.min(ei + 3, candles.length - 1);
      const nStart = toXY(candles[Math.max(si - 1, 0)].time, neckline);
      const nEnd = toXY(candles[extIdx].time, neckline);
      data.hlines.push({
        y: nStart.y,
        x1: nStart.x, x2: nEnd.x,
        color: neckColor,
        width: neckWidth,
        dash: neckDash,
        priceLabel: neckline.toLocaleString('ko-KR'),
      });

      // 돌파 지점 마커 (breakIndex 위치에 solid circle, 4px)
      if (breakConfirmed && p.breakIndex != null && p.breakIndex < candles.length) {
        const brkPt = toXY(candles[p.breakIndex].time, neckline);
        if (brkPt.x != null && brkPt.y != null) {
          data.trendAreas.push({
            points: [
              { x: brkPt.x, y: brkPt.y - 4 },
              { x: brkPt.x + 4, y: brkPt.y },
              { x: brkPt.x, y: brkPt.y + 4 },
              { x: brkPt.x - 4, y: brkPt.y },
            ],
            fill: BUY_COLOR,
          });
        }
      }

      // 두 저점에 상향 삼각형 마커 (▲, 5px) — trendAreas를 사용해 삼각형 렌더링
      const trough1 = toXY(candles[si].time, candles[si].low);
      const trough2 = toXY(candles[ei].time, candles[ei].low);
      [trough1, trough2].forEach(pt => {
        if (pt.x != null && pt.y != null) {
          const ty = pt.y + 8;  // 저가 아래
          data.trendAreas.push({
            points: [
              { x: pt.x, y: ty - 5 },       // 꼭짓점 (위)
              { x: pt.x + 5, y: ty + 4 },   // 우하
              { x: pt.x - 5, y: ty + 4 },   // 좌하
            ],
            fill: BUY_COLOR,
          });
        }
      });
    }

    // ══════════════════════════════════════════════════
    //  이중 천장: 사각형 영역 + 넥라인 + 고점 삼각 마커
    // ══════════════════════════════════════════════════
    _buildDoubleTop(candles, p, toXY, data) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      // 넥라인: 패턴 객체에서 직접 읽기 (독립 재계산 제거 — patterns.js와 완전 일치 보장)
      const neckline = p.neckline;
      if (neckline == null || !isFinite(neckline)) return;

      // 두 고점의 최고가
      let maxHigh = -Infinity;
      for (let j = si; j <= ei && j < candles.length; j++) {
        if (candles[j].high > maxHigh) maxHigh = candles[j].high;
      }
      if (!isFinite(maxHigh)) return;

      // 좌/우 수직 경계선 (lines-only — TradingView 스타일, 채우기 없음)
      const topLeft = toXY(candles[si].time, maxHigh);
      const bottomRight = toXY(candles[ei].time, neckline);
      if (topLeft.x != null && topLeft.y != null && bottomRight.x != null && bottomRight.y != null) {
        const rx = Math.min(topLeft.x, bottomRight.x);
        const ry = Math.min(topLeft.y, bottomRight.y);
        const rw = Math.abs(bottomRight.x - topLeft.x);
        const rh = Math.abs(bottomRight.y - topLeft.y);

        data.polylines.push({
          points: [{ x: rx, y: ry }, { x: rx, y: ry + rh }],
          color: BUY_COLOR,
          width: 1.5,
          dash: [5, 3],
        });
        data.polylines.push({
          points: [{ x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }],
          color: BUY_COLOR,
          width: 1.5,
          dash: [5, 3],
        });
      }

      // 넥라인 수평 연장 — 패턴 범위 + 우측 3봉만 (공간 분리)
      // 돌파 확인 시: 실선 + mint 색상 (확정된 구조선)
      // 미확인 시: 점선 + silver (잠정 구조선)
      const breakConfirmed = !!p.necklineBreakConfirmed;
      const neckColor = breakConfirmed ? BUY_COLOR : GOLD_COLOR;
      const neckDash = breakConfirmed ? [] : [5, 3];
      const neckWidth = breakConfirmed ? 2 : 1.5;
      const extIdx = Math.min(ei + 3, candles.length - 1);
      const nStart = toXY(candles[Math.max(si - 1, 0)].time, neckline);
      const nEnd = toXY(candles[extIdx].time, neckline);
      data.hlines.push({
        y: nStart.y,
        x1: nStart.x, x2: nEnd.x,
        color: neckColor,
        width: neckWidth,
        dash: neckDash,
        priceLabel: neckline.toLocaleString('ko-KR'),
      });

      // 돌파 지점 마커 (breakIndex 위치에 다이아몬드, 4px)
      if (breakConfirmed && p.breakIndex != null && p.breakIndex < candles.length) {
        const brkPt = toXY(candles[p.breakIndex].time, neckline);
        if (brkPt.x != null && brkPt.y != null) {
          data.trendAreas.push({
            points: [
              { x: brkPt.x, y: brkPt.y - 4 },
              { x: brkPt.x + 4, y: brkPt.y },
              { x: brkPt.x, y: brkPt.y + 4 },
              { x: brkPt.x - 4, y: brkPt.y },
            ],
            fill: BUY_COLOR,
          });
        }
      }

      // 두 고점에 하향 삼각형 마커 (▼, 5px) — trendAreas를 사용
      const peak1 = toXY(candles[si].time, candles[si].high);
      const peak2 = toXY(candles[ei].time, candles[ei].high);
      [peak1, peak2].forEach(pt => {
        if (pt.x != null && pt.y != null) {
          const ty = pt.y - 8;  // 고가 위
          data.trendAreas.push({
            points: [
              { x: pt.x, y: ty + 5 },       // 꼭짓점 (아래)
              { x: pt.x + 5, y: ty - 4 },   // 우상
              { x: pt.x - 5, y: ty - 4 },   // 좌상
            ],
            fill: SELL_COLOR,
          });
        }
      });
    }

    // ══════════════════════════════════════════════════
    //  컵앤핸들: U-shape polyline + handle box + neckline
    //  O'Neil (1988): 7-65주 U자형 컵 + 1-4주 핸들 → 돌파
    // ══════════════════════════════════════════════════
    _buildCupAndHandle(candles, p, toXY, data) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      const neckline = p.neckline;
      if (neckline == null || !isFinite(neckline)) return;

      const bottomIdx = p.bottomIndex;
      if (bottomIdx == null || bottomIdx >= candles.length) return;
      const bottomPrice = candles[bottomIdx].low;

      // Cup U-shape polyline: sample points along the cup (left rim → bottom → right rim)
      // Right rim index: if handle exists, it's before the handle
      const rightRimIdx = p.handleFound ? ei - Math.max(1, Math.floor((ei - si) * 0.15)) : ei;
      const cupEnd = Math.min(rightRimIdx, ei, candles.length - 1);
      const cupStart = si;

      // Sample ~15 points along the cup for a smooth U-shape curve
      const nSamples = Math.min(15, cupEnd - cupStart + 1);
      const step = Math.max(1, Math.floor((cupEnd - cupStart) / (nSamples - 1)));
      const cupPoints = [];
      for (let j = cupStart; j <= cupEnd; j += step) {
        const pt = toXY(candles[j].time, candles[j].low);
        if (pt.x != null && pt.y != null) cupPoints.push(pt);
      }
      // Ensure last point is included
      const lastPt = toXY(candles[cupEnd].time, candles[cupEnd].low);
      if (lastPt.x != null && lastPt.y != null) {
        if (!cupPoints.length || cupPoints[cupPoints.length - 1].x !== lastPt.x) {
          cupPoints.push(lastPt);
        }
      }

      if (cupPoints.length >= 3) {
        data.polylines.push({
          points: cupPoints,
          color: BUY_COLOR,
          width: 2,
          dash: [],
          smooth: true,
        });
      }

      // Handle area: small rectangle showing the pullback zone
      if (p.handleFound && cupEnd < ei) {
        const handleStart = cupEnd;
        const handleEnd = ei;
        let handleHigh = -Infinity, handleLow = Infinity;
        for (let j = handleStart; j <= handleEnd && j < candles.length; j++) {
          if (candles[j].high > handleHigh) handleHigh = candles[j].high;
          if (candles[j].low < handleLow) handleLow = candles[j].low;
        }
        if (isFinite(handleHigh) && isFinite(handleLow)) {
          const tl = toXY(candles[handleStart].time, handleHigh);
          const br = toXY(candles[handleEnd].time, handleLow);
          if (tl.x != null && tl.y != null && br.x != null && br.y != null) {
            data.brackets.push({
              x: Math.min(tl.x, br.x) - 2,
              y: Math.min(tl.y, br.y) - 2,
              w: Math.abs(br.x - tl.x) + 4,
              h: Math.abs(br.y - tl.y) + 4,
              color: BUY_COLOR,
            });
          }
        }
      }

      // Rim markers: hollow circles at left rim peak and right rim peak
      const leftRimPt = toXY(candles[si].time, candles[si].high);
      const rightRimPt = toXY(candles[cupEnd].time, candles[cupEnd].high);
      [leftRimPt, rightRimPt].forEach(pt => {
        if (pt.x != null && pt.y != null) {
          data.connectors.push({
            points: [pt, { x: pt.x, y: pt.y + 0.1 }],
            color: BUY_COLOR, width: 0, dash: [], alpha: 0, showDots: false,
            hollowCircle: true, circleX: pt.x, circleY: pt.y - 6, circleR: 4, circleWidth: 1.5,
          });
        }
      });

      // Bottom marker: upward triangle at cup bottom
      const bottomPt = toXY(candles[bottomIdx].time, bottomPrice);
      if (bottomPt.x != null && bottomPt.y != null) {
        const ty = bottomPt.y + 8;
        data.trendAreas.push({
          points: [
            { x: bottomPt.x, y: ty - 5 },
            { x: bottomPt.x + 5, y: ty + 4 },
            { x: bottomPt.x - 5, y: ty + 4 },
          ],
          fill: BUY_COLOR,
        });
      }

      // Neckline (rim level) — same pattern as doubleBottom
      const breakConfirmed = !!p.necklineBreakConfirmed;
      const neckColor = breakConfirmed ? BUY_COLOR : GOLD_COLOR;
      const neckDash = breakConfirmed ? [] : [5, 3];
      const neckWidth = breakConfirmed ? 2 : 1.5;
      const extIdx = Math.min(ei + 3, candles.length - 1);
      const nStart = toXY(candles[Math.max(si - 1, 0)].time, neckline);
      const nEnd = toXY(candles[extIdx].time, neckline);
      data.hlines.push({
        y: nStart.y,
        x1: nStart.x, x2: nEnd.x,
        color: neckColor,
        width: neckWidth,
        dash: neckDash,
        priceLabel: neckline.toLocaleString('ko-KR'),
      });

      // Break point marker
      if (breakConfirmed && p.breakIndex != null && p.breakIndex < candles.length) {
        const brkPt = toXY(candles[p.breakIndex].time, neckline);
        if (brkPt.x != null && brkPt.y != null) {
          data.trendAreas.push({
            points: [
              { x: brkPt.x, y: brkPt.y - 4 },
              { x: brkPt.x + 4, y: brkPt.y },
              { x: brkPt.x, y: brkPt.y + 4 },
              { x: brkPt.x - 4, y: brkPt.y },
            ],
            fill: BUY_COLOR,
          });
        }
      }
    }

    // ══════════════════════════════════════════════════
    //  머리어깨 (H&S) / 역머리어깨: 넥라인 + 빈 원 마커
    // ══════════════════════════════════════════════════
    _buildHeadAndShoulders(candles, p, toXY, data, inverse) {
      if (!p.trendlines || !p.trendlines.length) return;
      const neckTL = p.trendlines[0];
      if (!neckTL.points || neckTL.points.length < 2) return;

      const pt1 = neckTL.points[0], pt2 = neckTL.points[1];
      const i1 = candles.findIndex(c => c.time === pt1.time);
      const i2 = candles.findIndex(c => c.time === pt2.time);
      if (i1 < 0 || i2 < 0 || i1 === i2) return;

      // 돌파 확인 시: mint 색상 + 연장선도 실선 (확정된 구조선)
      // 미확인 시: silver 실선 + 연장 점선 (잠정 구조선)
      const breakConfirmed = !!p.necklineBreakConfirmed;
      const neckColor = breakConfirmed ? BUY_COLOR : GOLD_COLOR;
      const neckWidth = breakConfirmed ? 2 : 1.5;
      const extDash = breakConfirmed ? [] : [5, 3];
      const extWidth = breakConfirmed ? 1.5 : 1;

      // 넥라인 (실선)
      const nk1 = toXY(pt1.time, pt1.value);
      const nk2 = toXY(pt2.time, pt2.value);
      data.polylines.push({
        points: [nk1, nk2],
        color: neckColor,
        width: neckWidth,
        dash: [],
      });

      // 넥라인 연장
      const slope = (pt2.value - pt1.value) / (i2 - i1);
      const extIdx = Math.min(p.endIndex + 12, candles.length - 1);
      const extVal = pt2.value + slope * (extIdx - i2);
      const preIdx = Math.max(0, i1 - 3);
      const preVal = pt1.value + slope * (preIdx - i1);

      data.polylines.push({
        points: [
          toXY(candles[preIdx].time, preVal),
          nk1,
        ],
        color: neckColor,
        width: extWidth,
        dash: extDash,
      });
      data.polylines.push({
        points: [
          nk2,
          toXY(candles[extIdx].time, extVal),
        ],
        color: neckColor,
        width: extWidth,
        dash: extDash,
      });

      // 돌파 지점 마커 (breakIndex 위치에 넥라인 가격 기준 다이아몬드, 4px)
      if (breakConfirmed && p.breakIndex != null && p.breakIndex < candles.length) {
        const brkNeckVal = pt1.value + slope * (p.breakIndex - i1);
        const brkPt = toXY(candles[p.breakIndex].time, brkNeckVal);
        if (brkPt.x != null && brkPt.y != null) {
          data.trendAreas.push({
            points: [
              { x: brkPt.x, y: brkPt.y - 4 },
              { x: brkPt.x + 4, y: brkPt.y },
              { x: brkPt.x, y: brkPt.y + 4 },
              { x: brkPt.x - 4, y: brkPt.y },
            ],
            fill: BUY_COLOR,
          });
        }
      }

      // 어깨/머리 극값 찾기 (빈 원 마커용)
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      const mid = Math.floor((si + ei) / 2);
      const leftRange = candles.slice(si, Math.min(mid, candles.length));
      const rightRange = candles.slice(Math.min(mid + 1, candles.length), Math.min(ei + 1, candles.length));

      let extremePoints = [];
      if (inverse) {
        const leftLow = _findExtreme(leftRange, 'low', 'min');
        const headLow = _findExtreme(candles.slice(
          Math.max(si, Math.floor(si + (ei - si) * 0.25)),
          Math.min(ei + 1, Math.floor(si + (ei - si) * 0.75) + 1)
        ), 'low', 'min');
        const rightLow = _findExtreme(rightRange, 'low', 'min');
        if (leftLow) extremePoints.push(toXY(leftLow.time, leftLow.low));
        if (headLow) extremePoints.push(toXY(headLow.time, headLow.low));
        if (rightLow) extremePoints.push(toXY(rightLow.time, rightLow.low));
      } else {
        const leftHigh = _findExtreme(leftRange, 'high', 'max');
        const headHigh = _findExtreme(candles.slice(
          Math.max(si, Math.floor(si + (ei - si) * 0.25)),
          Math.min(ei + 1, Math.floor(si + (ei - si) * 0.75) + 1)
        ), 'high', 'max');
        const rightHigh = _findExtreme(rightRange, 'high', 'max');
        if (leftHigh) extremePoints.push(toXY(leftHigh.time, leftHigh.high));
        if (headHigh) extremePoints.push(toXY(headHigh.time, headHigh.high));
        if (rightHigh) extremePoints.push(toXY(rightHigh.time, rightHigh.high));
      }

      // 빈 원 마커 (4px 반지름, 1.5px 선) — connector로 렌더링
      const markerColor = inverse ? BUY_COLOR : SELL_COLOR;
      extremePoints.forEach(pt => {
        if (pt.x != null && pt.y != null) {
          data.connectors.push({
            points: [pt, { x: pt.x, y: pt.y + 0.1 }],   // 최소 2점
            color: markerColor,
            width: 0,
            dash: [],
            alpha: 0,
            showDots: false,
            hollowCircle: true,  // 커스텀: 빈 원 마커
            circleX: pt.x,
            circleY: pt.y,
            circleR: 4,
            circleWidth: 1.5,
          });
        }
      });
    }

    // ══════════════════════════════════════════════════
    //  삼각형 (상승/하락): 수렴 추세선 + 영역 채우기
    // ══════════════════════════════════════════════════
    _buildTriangle(candles, p, toXY, data) {
      if (!p.trendlines || p.trendlines.length < 2) return;

      const upperTL = p.trendlines[0];
      const lowerTL = p.trendlines[1];
      if (!upperTL.points || upperTL.points.length < 2 ||
          !lowerTL.points || lowerTL.points.length < 2) return;

      const isBuy = _isBullish(p);

      // 상단 추세선 (dots 제거, 선폭 축소)
      const u1 = toXY(upperTL.points[0].time, upperTL.points[0].value);
      const u2 = toXY(upperTL.points[1].time, upperTL.points[1].value);
      data.polylines.push({
        points: [u1, u2],
        color: SELL_COLOR,
        width: 1.5,
        dash: [],
        dots: false,
      });

      // 하단 추세선 (dots 제거, 선폭 축소)
      const l1 = toXY(lowerTL.points[0].time, lowerTL.points[0].value);
      const l2 = toXY(lowerTL.points[1].time, lowerTL.points[1].value);
      data.polylines.push({
        points: [l1, l2],
        color: BUY_COLOR,
        width: 1.5,
        dash: [],
        dots: false,
      });

      // 수렴 영역 반투명 채우기 (불투명도 증가: 0.04 → 0.10)
      if (u1.x != null && u2.x != null && l1.x != null && l2.x != null) {
        data.trendAreas.push({
          points: [u1, u2, l2, l1],
          fill: BUY_FILL,
        });
      }
    }

    // ══════════════════════════════════════════════════
    //  쐐기형 (상승/하락): 수렴 추세선 + 영역 채우기
    // ══════════════════════════════════════════════════
    _buildWedge(candles, p, toXY, data) {
      if (!p.trendlines || p.trendlines.length < 2) return;

      const upperTL = p.trendlines[0];
      const lowerTL = p.trendlines[1];
      if (!upperTL.points || upperTL.points.length < 2 ||
          !lowerTL.points || lowerTL.points.length < 2) return;

      const isBuy = _isBullish(p);

      // 상단 추세선 (dots 제거, 선폭 축소)
      const u1 = toXY(upperTL.points[0].time, upperTL.points[0].value);
      const u2 = toXY(upperTL.points[1].time, upperTL.points[1].value);
      data.polylines.push({
        points: [u1, u2],
        color: isBuy ? GOLD_COLOR : SELL_COLOR,
        width: 1.5,
        dash: [],
        dots: false,
      });

      // 하단 추세선 (dots 제거, 선폭 축소)
      const l1 = toXY(lowerTL.points[0].time, lowerTL.points[0].value);
      const l2 = toXY(lowerTL.points[1].time, lowerTL.points[1].value);
      data.polylines.push({
        points: [l1, l2],
        color: isBuy ? BUY_COLOR : GOLD_COLOR,
        width: 1.5,
        dash: [],
        dots: false,
      });

      // 수렴 영역 채우기 (불투명도 증가: 0.05 → 0.10)
      if (u1.x != null && u2.x != null && l1.x != null && l2.x != null) {
        data.trendAreas.push({
          points: [u1, u2, l2, l1],
          fill: BUY_FILL,
        });
      }
    }

    // ══════════════════════════════════════════════════
    //  채널 패턴 렌더러 — 상하 평행 추세선 + 채우기
    // ══════════════════════════════════════════════════
    _buildChannel(candles, p, toXY, data) {
      if (p.upperSlope == null || p.lowerSlope == null) return;
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length) return;

      const eiClamped = Math.min(ei, candles.length - 1);
      // 추세선 시작/끝 좌표 (slope*index + intercept → price)
      const upperStart = p.upperSlope * si + p.upperIntercept;
      const upperEnd = p.upperSlope * eiClamped + p.upperIntercept;
      const lowerStart = p.lowerSlope * si + p.lowerIntercept;
      const lowerEnd = p.lowerSlope * eiClamped + p.lowerIntercept;

      const u1 = toXY(candles[si].time, upperStart);
      const u2 = toXY(candles[eiClamped].time, upperEnd);
      const l1 = toXY(candles[si].time, lowerStart);
      const l2 = toXY(candles[eiClamped].time, lowerEnd);

      const lineColor = GOLD_COLOR;

      // 상단 추세선
      data.polylines.push({ points: [u1, u2], color: lineColor, width: 1.5, dash: [5, 3], dots: false });
      // 하단 추세선
      data.polylines.push({ points: [l1, l2], color: lineColor, width: 1.5, dash: [5, 3], dots: false });
      // 채널 영역 채우기
      if (u1.x != null && u2.x != null && l1.x != null && l2.x != null) {
        data.trendAreas.push({ points: [u1, u2, l2, l1], fill: BUY_FILL });
      }
    }

    // ══════════════════════════════════════════════════
    //  패턴 라벨 (HTS 스타일 pill badge)
    // ══════════════════════════════════════════════════
    _buildLabel(candles, p, toXY, labels) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      let baseName = PATTERN_NAMES_KO[p.type] || p.type;
      // 넥라인 돌파 확인 시 라벨에 "(확인)" 추가 — 패턴 유효성 확정 표시
      if (p.necklineBreakConfirmed) baseName += ' (확인)';
      // 신뢰도(%) 추가: "이중바닥 82%" 또는 "이중바닥 (확인) 82%"
      const confVal = p.quality != null ? p.quality : p.confidence;
      let name = confVal != null ? `${baseName} ${Math.round(confVal)}%` : baseName;
      if (p.wc != null && Math.abs(p.wc - 1) > 0.01) {
        name += ` W${p.wc.toFixed(2)}`;
      }

      // ── 패턴 적중 추적: Active/Hit/Failed (Fix 3: cached) ──
      let outcome = null;
      if ((p.priceTarget != null || p.stopLoss != null) && ei < candles.length - 1) {
        const cacheKey = p.type + '_' + ei;
        const cached = this._outcomeCache.get(cacheKey);
        if (cached && cached.checkedLength === candles.length) {
          outcome = cached.outcome;
        } else {
          const isBuy = _isBullish(p);
          outcome = 'active';
          for (let ci = ei + 1; ci < candles.length; ci++) {
            if (p.priceTarget != null) {
              if (isBuy && candles[ci].high >= p.priceTarget) { outcome = 'hit'; break; }
              if (!isBuy && candles[ci].low <= p.priceTarget) { outcome = 'hit'; break; }
            }
            if (p.stopLoss != null) {
              if (isBuy && candles[ci].low <= p.stopLoss) { outcome = 'failed'; break; }
              if (!isBuy && candles[ci].high >= p.stopLoss) { outcome = 'failed'; break; }
            }
          }
          this._outcomeCache.set(cacheKey, { outcome, checkedLength: candles.length });
        }
      }

      // X 위치: 패턴 중앙
      const midIdx = Math.round((si + ei) / 2);
      const midTime = candles[Math.min(midIdx, candles.length - 1)].time;
      const coordX = toXY(midTime, 0);
      if (coordX.x == null) return;

      const isBullish = _isBullish(p);
      const isBearish = _isBearish(p);

      // 색상: 캔들 패턴=연보라, 차트 패턴=민트, 중립=실버
      const isCandle = CANDLE_PATTERN_TYPES.has(p.type);
      const color = isCandle
        ? (p.type === 'doji' ? CANDLE_NEUTRAL : CANDLE_COLOR)
        : (isBullish ? BUY_COLOR : (isBearish ? SELL_COLOR : NEUTRAL_COLOR));

      // Y 좌표: 패턴 캔들 범위의 실제 고가/저가 기반
      var patternHigh = -Infinity, patternLow = Infinity;
      for (var ci = si; ci <= ei && ci < candles.length; ci++) {
        if (candles[ci].high > patternHigh) patternHigh = candles[ci].high;
        if (candles[ci].low < patternLow) patternLow = candles[ci].low;
      }
      var labelYVal = null;
      if (isFinite(patternHigh) && isFinite(patternLow)) {
        if (isBullish) {
          // 매수 패턴: 저가 아래 (toXY로 변환 → y가 큰 쪽이 아래)
          var lowCoord = toXY(midTime, patternLow);
          if (lowCoord.y != null) labelYVal = lowCoord.y + 24;
        } else {
          // 매도/중립 패턴: 고가 위 (y가 작은 쪽이 위)
          var highCoord = toXY(midTime, patternHigh);
          if (highCoord.y != null) labelYVal = highCoord.y - 24;
        }
      }

      // [Phase2-C] Pattern aging decay: active=면제, hit/failed=10봉 후 fade
      var decayAlpha = 1.0;
      if (outcome === 'hit' || outcome === 'failed') {
        var age = candles.length - 1 - ei;
        if (age > 10) {
          decayAlpha = Math.max(0.25, 1.0 - (age - 10) * 0.05);
        }
      }

      labels.push({
        x: coordX.x,
        y: labelYVal,
        placement: isBullish ? 'bottom' : 'top',
        text: name,
        color: color,
        bgColor: KRX_COLORS.TAG_BG(0.88),
        borderColor: color,
        confidence: p.confidence,
        outcome: outcome,
        wc: p.wc || 1,
        decayAlpha: decayAlpha,
        _patternType: p.type,
      });
    }

    // ══════════════════════════════════════════════════
    //  손절/목표가 수평선
    // ══════════════════════════════════════════════════
    _buildStopTarget(patterns, candles, series, toXY, hlines) {
      const top = patterns.find(p => p.stopLoss != null || p.priceTarget != null);
      if (!top) return;

      // 손절/목표선은 패턴 endIndex 이후부터만 표시 (과거 캔들 위 수평선 제거 — 공간 분리)
      const ei = top.endIndex, si = top.startIndex;
      let x1 = null;
      if (ei != null && ei < candles.length) {
        const eiCoord = toXY(candles[ei].time, candles[ei].close);
        if (eiCoord.x != null) x1 = eiCoord.x;
      }

      if (top.stopLoss != null) {
        const y = series.priceToCoordinate(top.stopLoss);
        if (y != null) {
          var hl = {
            y: y,
            color: KRX_COLORS.PTN_STOP,
            width: 1.5,
            dash: [8, 4],
            marker: 'stop',
            priceLabel: top.stopLoss.toLocaleString('ko-KR'),
          };
          if (x1 != null) hl.x1 = x1;
          hlines.push(hl);
        }
      }
      if (top.priceTarget != null) {
        const y = series.priceToCoordinate(top.priceTarget);
        if (y != null) {
          var hl = {
            y: y,
            color: KRX_COLORS.PTN_TARGET,
            width: 1.5,
            dash: [8, 4],
            marker: 'target',
            priceLabel: top.priceTarget.toLocaleString('ko-KR'),
          };
          if (x1 != null) hl.x1 = x1;
          hlines.push(hl);
        }
      }

      // ── 무효화 가격선: 패턴 범위 내에서만 표시 (si ~ ei) ──
      if (ei != null && si != null && ei < candles.length) {
        const isBuy = _isBullish(top);
        let invalidPrice = null;
        if (isBuy) {
          invalidPrice = Infinity;
          for (let ci = si; ci <= ei && ci < candles.length; ci++) {
            if (candles[ci].low < invalidPrice) invalidPrice = candles[ci].low;
          }
        } else {
          invalidPrice = -Infinity;
          for (let ci = si; ci <= ei && ci < candles.length; ci++) {
            if (candles[ci].high > invalidPrice) invalidPrice = candles[ci].high;
          }
        }
        // 손절선과 유의미하게 다를 때만 표시
        if (invalidPrice != null && isFinite(invalidPrice) &&
            (top.stopLoss == null || Math.abs(invalidPrice - top.stopLoss) / (top.stopLoss || 1) > 0.005)) {
          const y = series.priceToCoordinate(invalidPrice);
          if (y != null) {
            var invHl = {
              y: y,
              color: KRX_COLORS.PTN_INVALID,
              width: 1.2,
              dash: [5, 3],
              marker: 'invalid',
              priceLabel: '패턴이탈 ' + invalidPrice.toLocaleString('ko-KR'),
            };
            // 패턴 범위 내에서만 표시
            if (si < candles.length) {
              var siCoord = toXY(candles[si].time, candles[si].close);
              if (siCoord.x != null) invHl.x1 = siCoord.x;
            }
            if (x1 != null) invHl.x2 = x1;
            hlines.push(invHl);
          }
        }
      }
    }

    // ══════════════════════════════════════════════════
    //  예측 영역 (Forecast Zone)
    //
    //  벤치마크: Autochartist Forecast Zone, TrendSpider Projected Move
    //  패턴 완성 후 목표가/손절가까지의 예상 이동 영역을 시각화
    //  - 목표 영역: 부드러운 민트/라벤더 그라데이션 (방향에 따라)
    //  - 손절 영역: 사선 줄무늬 패턴 (위험 표시)
    //  - 예상 수익률 텍스트: 영역 중앙에 표시
    // ══════════════════════════════════════════════════
    _buildForecastZone(candles, p, toXY, ts, forecastZones) {
      if (p.priceTarget == null && p.stopLoss == null) return;

      const ei = p.endIndex;
      if (ei == null || ei < 0 || ei >= candles.length) return;

      const entry = candles[ei].close;
      if (!entry || entry === 0) return;

      const isBuy = _isBullish(p);

      // Forecast Zone 너비: 패턴 끝 → 오른쪽 8봉 연장
      const fzStart = ei;
      const fzEnd = Math.min(ei + 8, candles.length - 1);

      const startCoord = toXY(candles[fzStart].time, entry);
      var fzX1, fzX2;

      if (fzEnd <= fzStart) {
        // [UX-FIX] 마지막 봉 패턴: 차트 우측 끝까지 미래 영역 연장
        if (startCoord.x == null) return;
        fzX1 = startCoord.x;
        // timeScale 우측 끝 좌표 (마지막 봉 x + 봉 간격 * 8)
        var lastCoord = toXY(candles[candles.length - 1].time, entry);
        var barWidth = candles.length >= 2
          ? Math.abs((lastCoord.x || 0) - (toXY(candles[candles.length - 2].time, entry).x || 0))
          : 8;
        fzX2 = fzX1 + barWidth * 8;
      } else {
        var endCoord = toXY(candles[fzEnd].time, entry);
        // [Phase2-A] null-safe: 패턴이 화면 밖이면 x1=0 fallback (줌인 시 zone 유지)
        fzX1 = startCoord.x != null ? startCoord.x : 0;
        fzX2 = endCoord.x != null ? endCoord.x : null;
        // endCoord가 완전히 null이면 표시 불가
        if (fzX2 == null) return;
      }
      // 좌표 변환 후에도 폭 0 체크 (같은 봉이 같은 x로 변환된 경우)
      if (Math.abs(fzX2 - fzX1) < 2) return;

      // ── CI95 기반 예측 영역 opacity 변조 ──────────────────
      // ci95Width = |ci95Upper - ci95Lower| (return % 단위, 주가 무관)
      // 넓은 CI = 낮은 예측 확신 → 투명하게, 좁은 CI = 높은 확신 → 불투명
      // 공식: ciAlpha = clamp(1 - ci95Width / (2 × CI_REF), CI_ALPHA_MIN, CI_ALPHA_MAX)
      //   CI_REF=5.5%: 5.5% 폭에서 alpha≈0.5 (중간값), 11%+ 이상에서 최소
      //   sigmoid 대비 선형이 해석성 우위 + learnable threshold 1개
      // Chatfield (2004), "The Analysis of Time Series": PI width ∝ forecast uncertainty
      var CI_REF = 5.5;        // [D][L:GS] 기준 CI 폭 (%), pred_std=1.41 → E[CI]=2*1.96*1.41≈5.5%
      var CI_ALPHA_MIN = 0.15; // 최소 opacity (넓은 CI — 거의 투명이지만 존재 표시)
      var CI_ALPHA_MAX = 1.0;  // 최대 opacity (좁은 CI — Wc에만 의존)
      var ciAlpha = CI_ALPHA_MAX;
      if (p.backtestCi95Lower != null && p.backtestCi95Upper != null) {
        var ci95Width = Math.abs(p.backtestCi95Upper - p.backtestCi95Lower);
        // 선형 감쇠: width=0 → 1.0, width=2×CI_REF → 0.0 (clamped to min)
        ciAlpha = Math.max(CI_ALPHA_MIN, Math.min(CI_ALPHA_MAX,
          1 - ci95Width / (2 * CI_REF)));
      }

      const zone = {
        x1: fzX1,
        x2: fzX2,
        // [Fix-2] yEntry fallback: startCoord.y가 null이면 priceToCoordinate 직접 호출
        // y는 가격축에만 의존하므로 아무 time으로 호출해도 동일
        yEntry: startCoord.y != null ? startCoord.y
          : (candles.length > 0 ? toXY(candles[0].time, entry).y : null),
        yTarget: null,
        yStop: null,
        entry: entry,
        isBuy: isBuy,
        stopPrice: null,
        returnText: null,
        returnColor: null,
        targetFillNear: null,
        targetFillFar: null,
        targetBorder: null,
        stopFill: null,
        stopStripe: null,
        stopBorder: null,
        offScreenTarget: false,
        wc: p.wc || 1,
        ciAlpha: ciAlpha,
        // 백테스트 5일 승률 (backtester → analysisWorker → patterns → 여기)
        // sampleSize < 10 또는 null이면 렌더러에서 표시하지 않음
        probWinRate: (p.backtestSampleSize >= 10) ? p.backtestWinRate : null,
        probSampleSize: p.backtestSampleSize || null,
      };

      // 목표가 영역
      if (p.priceTarget != null) {
        const targetCoord = toXY(candles[fzStart].time, p.priceTarget);

        // 예상 수익률 계산 (화면 내/밖 공통으로 미리 계산)
        const retPct = ((p.priceTarget - entry) / entry * 100);
        const retSign = retPct >= 0 ? '+' : '';
        zone.returnText = `${retSign}${retPct.toFixed(1)}%`;
        zone.returnColor = KRX_COLORS.PTN_BUY;

        if (targetCoord.y != null) {
          zone.yTarget = targetCoord.y;

          // [UX] 목표가 수익률 텍스트: 민트 통일 (패턴 전용 색상 — 차트 UP/DOWN과 무관)
          zone.targetFillNear = KRX_COLORS.FZ_TARGET_NEAR;
          zone.targetFillFar  = KRX_COLORS.FZ_TARGET_FAR;
          zone.targetBorder   = KRX_COLORS.FZ_TARGET_BORDER;
        } else {
          // 목표가가 현재 화면 밖 → 차트 경계에 방향 화살표 + 수익률 라벨 표시
          zone.offScreenTarget = true;
        }
      }

      // 손절가 영역
      if (p.stopLoss != null) {
        const stopCoord = toXY(candles[fzStart].time, p.stopLoss);
        if (stopCoord.y != null) {
          zone.yStop = stopCoord.y;
          zone.stopPrice = p.stopLoss;

          // [UX] 손절존: 오렌지 경고색 (PTN_INVALID #FF6B35 기반 — 목표 민트와 시각 구분)
          zone.stopFill   = KRX_COLORS.FZ_STOP_NEAR;
          zone.stopStripe = null;  // v3.1: 사선 줄무늬 제거, 그라데이션으로 대체
          zone.stopBorder = KRX_COLORS.FZ_STOP_BORDER;
          zone.stopColor  = KRX_COLORS.PTN_STOP;
        }
      }

      // R:R 비율 바 데이터 (목표가 + 손절가 모두 존재 시)
      if (p.priceTarget != null && p.stopLoss != null) {
        const targetDist = Math.abs(p.priceTarget - entry);
        const stopDist = Math.abs(p.stopLoss - entry);
        if (stopDist > 0) {
          zone.rrRatio = +(targetDist / stopDist).toFixed(2);
        }
      }

      forecastZones.push(zone);
    }
  }


  // ══════════════════════════════════════════════════
  //  유틸리티 함수
  // ══════════════════════════════════════════════════

  function _emptyData() {
    return {
      glows: [],
      brackets: [],
      trendAreas: [],
      polylines: [],
      hlines: [],
      labels: [],
      connectors: [],
      forecastZones: [],
    };
  }

  function _isBullish(p) {
    return p.signal === 'buy' || p.direction === 'bullish' || BULLISH_TYPES.has(p.type);
  }

  function _isBearish(p) {
    return p.signal === 'sell' || p.direction === 'bearish' || BEARISH_TYPES.has(p.type);
  }

  function _findExtreme(arr, key, mode) {
    if (!arr || !arr.length) return null;
    let result = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (mode === 'max' && arr[i][key] > result[key]) result = arr[i];
      if (mode === 'min' && arr[i][key] < result[key]) result = arr[i];
    }
    return result;
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

    setPatterns(candles, patterns, extendedLines, visibleBars) {
      this._patterns = { candles, patterns };
      this._extendedLines = extendedLines || [];
      this._visibleBars = visibleBars || 200;
      if (this._requestUpdate) this._requestUpdate();
    }

    clearPatterns() {
      this._patterns = null;
      this._extendedLines = [];
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
    // [FIX-6] 라인 모드 _priceLine null 안전 처리
    const targetSeries = (chartType === 'line' && cm.indicatorSeries._priceLine)
      ? cm.indicatorSeries._priceLine : cm.candleSeries;
    if (!targetSeries) return;
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

    // visible range 가져오기
    var visibleRange = null;
    if (cm.mainChart) {
      visibleRange = cm.mainChart.timeScale().getVisibleLogicalRange();
    }

    var from = visibleRange ? Math.floor(visibleRange.from) : 0;
    var to = visibleRange ? Math.ceil(visibleRange.to) : candles.length - 1;

    // ── 3계층 차등 필터링 ──
    //  계층 1 (캔들스틱): visible 밖 → skip
    //  계층 2 (차트 패턴): visible 밖 → 본체 skip, 구조선(넥라인/추세선)만 연장
    //  계층 3 (지지/저항): 항상 표시 (hlines가 전체 너비)
    var visiblePatterns = [];
    var extendedStructLines = [];

    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      var si = p.startIndex || 0;
      var ei = p.endIndex || si;
      var isVisible = (ei >= from && si <= to);

      if (isVisible) {
        // visible 범위 안의 모든 패턴 포함
        visiblePatterns.push(p);
      } else if (CHART_PATTERNS.has(p.type)) {
        // 계층 2: visible 밖 차트 패턴 → 구조선만 연장
        if (p.trendlines && p.trendlines.length > 0) {
          for (var ti = 0; ti < p.trendlines.length; ti++) {
            var tl = p.trendlines[ti];
            if (tl.points && tl.points.length >= 2) {
              extendedStructLines.push({
                points: tl.points,
                patternType: p.type,
                patternName: PATTERN_NAMES_KO[p.type] || p.type,
                confidence: p.confidence || 0,
              });
            }
          }
        }
        // doubleBottom/doubleTop은 trendlines 없음 → 넥라인 수평선으로 연장
        // neckline은 패턴 객체에서 직접 읽기 (독립 재계산 제거 — high/low 불일치 버그 수정)
        if ((p.type === 'doubleBottom' || p.type === 'doubleTop') &&
            si < candles.length && ei < candles.length) {
          var neckVal = p.neckline || null;
          if (neckVal != null && isFinite(neckVal)) {
            extendedStructLines.push({
              points: [
                { time: candles[si].time, value: neckVal },
                { time: candles[Math.min(ei, candles.length - 1)].time, value: neckVal },
              ],
              isNeckline: true,
              patternType: p.type,
              patternName: PATTERN_NAMES_KO[p.type] || p.type,
              confidence: p.confidence || 0,
            });
          }
        }
      }
      // 계층 1 (캔들스틱) visible 밖 → 아무것도 안 함 (skip)
      // 계층 3 (지지/저항) → hlines가 이미 전체 너비, visiblePatterns에 자동 포함
    }

    // ── Fix 1: Cap extendedStructLines to MAX_EXTENDED_LINES, keep highest confidence ──
    if (extendedStructLines.length > MAX_EXTENDED_LINES) {
      // Attach source pattern confidence for sorting
      extendedStructLines.sort(function(a, b) {
        return (b.confidence || 0) - (a.confidence || 0);
      });
      extendedStructLines = extendedStructLines.slice(0, MAX_EXTENDED_LINES);
    }

    if (!visiblePatterns.length && !extendedStructLines.length) {
      _primitive.clearPatterns();
      return;
    }

    // [Phase3-B] Zoom-adaptive MAX_PATTERNS: 줌인 시 패턴 수 축소 + active 우선
    var visibleBars = to - from;
    var effectiveMax = visibleBars <= 50 ? 1 : (visibleBars <= 200 ? 2 : MAX_PATTERNS);

    // Active 패턴(outcome=active)을 우선 정렬 → 줌인 시 active가 최우선 표시
    var sorted = visiblePatterns.slice().sort(function(a, b) {
      // active 패턴 우선 (priceTarget/stopLoss 있고 아직 미결)
      var aHasTarget = (a.priceTarget != null || a.stopLoss != null) ? 1 : 0;
      var bHasTarget = (b.priceTarget != null || b.stopLoss != null) ? 1 : 0;
      if (bHasTarget !== aHasTarget) return bHasTarget - aHasTarget;
      return (b.confidence || 0) - (a.confidence || 0);
    });
    _primitive.setPatterns(candles, sorted.slice(0, effectiveMax), extendedStructLines, visibleBars);
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
