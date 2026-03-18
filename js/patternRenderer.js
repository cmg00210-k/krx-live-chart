// ══════════════════════════════════════════════════════
//  패턴 시각화 렌더러 v3.1 — HTS급 전문 시각화 + Forecast Zone
//
//  증권사 HTS/MTS 벤치마크 수준의 패턴 차트 시각화
//  ISeriesPrimitive Canvas2D 기반, 캔들과 조화로운 표현
//
//  핵심 원칙:
//  - 패턴 영역을 은은한 그라데이션으로 표시
//  - 라벨은 HTS 스타일 pill badge (Pretendard 11px)
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
  const MAX_PATTERNS = 5;

  // ── 패턴 유형별 분류 ──
  const ZONE_PATTERNS = {
    threeWhiteSoldiers: { color: BUY_COLOR, fill: BUY_FILL, candles: 3 },
    threeBlackCrows:    { color: SELL_COLOR, fill: SELL_FILL, candles: 3 },
    bullishEngulfing:   { color: BUY_COLOR, fill: BUY_FILL, candles: 2 },
    bearishEngulfing:   { color: SELL_COLOR, fill: SELL_FILL, candles: 2 },
    morningStar:        { color: BUY_COLOR, fill: BUY_FILL, candles: 3 },
    eveningStar:        { color: SELL_COLOR, fill: SELL_FILL, candles: 3 },
    bullishHarami:      { color: BUY_COLOR, fill: BUY_FILL, candles: 2, useBody: true },
    bearishHarami:      { color: SELL_COLOR, fill: SELL_FILL, candles: 2, useBody: true },
    piercingLine:       { color: BUY_COLOR, fill: BUY_FILL, candles: 2 },
    darkCloud:          { color: SELL_COLOR, fill: SELL_FILL, candles: 2 },
    tweezerBottom:      { color: BUY_COLOR, fill: BUY_FILL, candles: 2 },
    tweezerTop:         { color: SELL_COLOR, fill: SELL_FILL, candles: 2 },
  };

  const SINGLE_PATTERNS = {
    hammer:         { key: 'low',   color: BUY_COLOR,     direction: 'buy' },
    invertedHammer: { key: 'high',  color: BUY_COLOR,     direction: 'buy' },
    hangingMan:     { key: 'low',   color: SELL_COLOR,    direction: 'sell' },
    shootingStar:   { key: 'high',  color: SELL_COLOR,    direction: 'sell' },
    doji:           { key: 'close', color: NEUTRAL_COLOR, direction: 'neutral' },
    dragonflyDoji:  { key: 'low',   color: BUY_COLOR,     direction: 'buy' },
    gravestoneDoji: { key: 'high',  color: SELL_COLOR,    direction: 'sell' },
  };

  const CHART_PATTERNS = new Set([
    'doubleBottom', 'doubleTop',
    'headAndShoulders', 'inverseHeadAndShoulders',
    'ascendingTriangle', 'descendingTriangle',
    'risingWedge', 'fallingWedge',
  ]);

  // ── 3계층 분류용 캔들스틱 패턴 Set ──
  const CANDLE_PATTERN_TYPES = new Set([
    'hammer', 'invertedHammer', 'shootingStar', 'hangingMan',
    'doji', 'dragonflyDoji', 'gravestoneDoji',
    'bullishEngulfing', 'bearishEngulfing',
    'bullishHarami', 'bearishHarami',
    'morningStar', 'eveningStar',
    'threeWhiteSoldiers', 'threeBlackCrows',
    'piercingLine', 'darkCloud',
    'tweezerBottom', 'tweezerTop',
  ]);

  // ── 패턴 한글 이름 (간결) ──
  const PATTERN_NAMES_KO = {
    hammer: '망치형', invertedHammer: '역망치', hangingMan: '교수형',
    shootingStar: '유성형', doji: '도지', dragonflyDoji: '잠자리도지',
    gravestoneDoji: '비석도지',
    bullishEngulfing: '상승장악', bearishEngulfing: '하락장악',
    bullishHarami: '상승잉태', bearishHarami: '하락잉태',
    piercingLine: '관통형', darkCloud: '먹구름',
    tweezerBottom: '족집게바닥', tweezerTop: '족집게천장',
    morningStar: '샛별형', eveningStar: '석별형',
    threeWhiteSoldiers: '적삼병', threeBlackCrows: '흑삼병',
    doubleBottom: '이중바닥', doubleTop: '이중천장',
    headAndShoulders: 'H&S', inverseHeadAndShoulders: '역H&S',
    ascendingTriangle: '상승삼각', descendingTriangle: '하락삼각',
    risingWedge: '상승쐐기', fallingWedge: '하락쐐기',
    symmetricTriangle: '대칭삼각', bullishFlag: '상승깃발',
    bearishFlag: '하락깃발', cupAndHandle: '컵핸들',
    channel: '채널', rectangle: '박스권',
  };

  // ── 패턴 방향 판별 ──
  const BULLISH_TYPES = new Set([
    'hammer', 'invertedHammer', 'bullishEngulfing', 'bullishHarami',
    'morningStar', 'threeWhiteSoldiers', 'doubleBottom',
    'inverseHeadAndShoulders', 'fallingWedge', 'bullishFlag',
    'ascendingTriangle', 'cupAndHandle', 'piercingLine',
    'dragonflyDoji', 'tweezerBottom',
  ]);
  const BEARISH_TYPES = new Set([
    'hangingMan', 'shootingStar', 'bearishEngulfing', 'bearishHarami',
    'eveningStar', 'threeBlackCrows', 'doubleTop', 'headAndShoulders',
    'risingWedge', 'bearishFlag', 'descendingTriangle',
    'darkCloud', 'gravestoneDoji', 'tweezerTop',
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

        // ── 1. 캔들 글로우 (단일 캔들 패턴 하이라이트) ──
        if (d.glows && d.glows.length) {
          d.glows.forEach(g => {
            if (g.x == null || g.y1 == null || g.y2 == null) return;
            // 화면 밖 글로우 스킵
            if (g.x < -20 || g.x > w + 20) return;
            const glowW = g.width || 16;
            const rx = g.x - glowW / 2;
            const ry = Math.min(g.y1, g.y2);
            const rh = Math.abs(g.y2 - g.y1);

            // 그라데이션 글로우 (캔들 뒤에 은은한 발광)
            const gradient = ctx.createRadialGradient(
              g.x, (g.y1 + g.y2) / 2, 0,
              g.x, (g.y1 + g.y2) / 2, Math.max(glowW, rh) * 0.8
            );
            gradient.addColorStop(0, g.fillCenter || g.fill);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(rx - glowW * 0.3, ry - rh * 0.15, glowW * 1.6, rh * 1.3);

            // 얇은 테두리 라인 (좌우 수직선)
            ctx.strokeStyle = g.border;
            ctx.lineWidth = 0.8;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(rx, ry - 2);
            ctx.lineTo(rx, ry + rh + 2);
            ctx.moveTo(rx + glowW, ry - 2);
            ctx.lineTo(rx + glowW, ry + rh + 2);
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }

        // ── 2. 구간 브래킷 (2-3봉 캔들스틱 패턴 그룹핑) ──
        if (d.brackets && d.brackets.length) {
          d.brackets.forEach(br => {
            if (br.x1 == null || br.y1 == null || br.x2 == null || br.y2 == null) return;
            // 완전히 화면 밖이면 스킵
            if (br.x2 < 0 || br.x1 > w) return;
            const rx = Math.min(br.x1, br.x2) - 3;
            const ry = Math.min(br.y1, br.y2) - 2;
            const rw = Math.abs(br.x2 - br.x1) + 6;
            const rh = Math.abs(br.y2 - br.y1) + 4;
            const radius = 4;

            // 반투명 영역 채우기 (그라데이션)
            const grad = ctx.createLinearGradient(rx, ry, rx, ry + rh);
            grad.addColorStop(0, br.fillTop || br.fill);
            grad.addColorStop(1, br.fillBottom || 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            _roundRect(ctx, rx, ry, rw, rh, radius);
            ctx.fill();

            // 점선 테두리
            ctx.strokeStyle = br.border;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            _roundRect(ctx, rx, ry, rw, rh, radius);
            ctx.stroke();
            ctx.setLineDash([]);
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
            ctx.fillStyle = ta.fill || 'rgba(200,200,200,0.04)';
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
            ctx.setLineDash(hl.dash || [4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // 우측 가격 라벨 (HTS 스타일 태그 — 확대)
            if (hl.priceLabel) {
              const labelText = hl.priceLabel;
              ctx.font = "600 11px 'JetBrains Mono', monospace";
              const tm = ctx.measureText(labelText);
              const tagW = tm.width + 16;
              const tagH = 20;
              // 우측 끝에서 최소 60px 안쪽 (잘림 방지)
              const lx = Math.min(x2 - tm.width - 18, w - tagW - 60);
              const ly = hl.y;

              // 태그 배경
              ctx.fillStyle = 'rgba(19,23,34,0.92)';
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

        // ── 6. 패턴 연결선 (H&S 어깨-머리 연결, 삼각형 꼭짓점 등) ──
        if (d.connectors && d.connectors.length) {
          d.connectors.forEach(cn => {
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
            ctx.setLineDash(cn.dash || [2, 2]);
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
        if (d.labels && d.labels.length) {
          ctx.setLineDash([]);
          const fontSize = 11;
          ctx.font = `600 ${fontSize}px 'Pretendard', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // 라벨 겹침 방지: 이미 배치된 라벨 위치 추적
          const placedLabels = [];

          d.labels.forEach(lb => {
            if (lb.x == null) return;
            // 화면 밖 라벨 스킵
            if (lb.x < -50 || lb.x > w + 50) return;

            // OHLC 바 겹침 방지: 상단 30px 이내에 라벨 금지
            // OHLC 바 높이(~24px) + top(8px) = ~32px → 안전 마진 30px
            const OHLC_SAFE_Y = 30;

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
            const boxW = textMetrics.width + 10;
            const boxH = fontSize + 6;
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
              labelY += (lb.placement === 'top' ? 1 : -1) * (boxH + 2);
              attempts++;
            }

            // 범위 제한 (OHLC 바 영역 아래에서만 표시)
            labelY = Math.max(OHLC_SAFE_Y, Math.min(h - boxH / 2 - 2, labelY));
            // 화면 밖 라벨 스킵 (y축)
            if (labelY < -20 || labelY > h + 20) return;

            placedLabels.push({ x: lb.x, y: labelY, w: boxW });

            const boxX = lb.x - boxW / 2;
            const boxY = labelY - boxH / 2;
            const radius = 3;

            // ── pill 배경: 살짝 투명한 다크 ──
            ctx.fillStyle = lb.bgColor || 'rgba(19,23,34,0.88)';
            ctx.beginPath();
            _roundRect(ctx, boxX, boxY, boxW, boxH, radius);
            ctx.fill();

            // ── 좌측 컬러 바 (패턴 방향 인디케이터) ──
            ctx.fillStyle = lb.color;
            ctx.beginPath();
            _roundRect(ctx, boxX, boxY, 3, boxH, [radius, 0, 0, radius]);
            ctx.fill();

            // ── 테두리 ──
            ctx.strokeStyle = lb.color;
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.65;
            ctx.beginPath();
            _roundRect(ctx, boxX, boxY, boxW, boxH, radius);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // ── 텍스트 ──
            ctx.fillStyle = lb.color;
            ctx.fillText(lb.text, lb.x + 1.5, labelY);

            // (신뢰도 도트 제거 — 라벨 텍스트에 이미 "이중바닥 82%" 포함)
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

            // ── 목표 영역 (수익 구간): 부드러운 그라데이션 ──
            if (fz.yTarget != null) {
              const tY = Math.min(fz.yEntry, fz.yTarget);
              const tH = Math.abs(fz.yTarget - fz.yEntry);
              if (tH > 2) {
                const tGrad = ctx.createLinearGradient(0, fz.yEntry, 0, fz.yTarget);
                tGrad.addColorStop(0, fz.targetFillNear || 'rgba(150,220,200,0.12)');
                tGrad.addColorStop(1, fz.targetFillFar  || 'rgba(150,220,200,0.03)');
                ctx.fillStyle = tGrad;
                ctx.fillRect(zoneX, tY, zoneW, tH);

                // 목표가 도달 점선 (가장자리)
                ctx.strokeStyle = fz.targetBorder || 'rgba(150,220,200,0.35)';
                ctx.lineWidth = 0.8;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(zoneX, fz.yTarget);
                ctx.lineTo(zoneX + zoneW, fz.yTarget);
                ctx.stroke();
                ctx.setLineDash([]);

                // 수익률 텍스트 (영역 중앙)
                if (fz.returnText) {
                  const retX = zoneX + zoneW / 2;
                  const retY = (fz.yEntry + fz.yTarget) / 2;
                  ctx.font = "700 10px 'Pretendard', sans-serif";
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  // 텍스트 배경 (가독성)
                  const rtm = ctx.measureText('목표 ' + fz.returnText);
                  ctx.fillStyle = 'rgba(19,23,34,0.75)';
                  ctx.beginPath();
                  _roundRect(ctx, retX - rtm.width / 2 - 4, retY - 7, rtm.width + 8, 14, 3);
                  ctx.fill();
                  ctx.fillStyle = fz.returnColor || 'rgba(150,220,200,0.85)';
                  ctx.fillText('목표 ' + fz.returnText, retX, retY);
                }
              }
            }

            // ── 손절 영역 (위험 구간): 사선 줄무늬 패턴 ──
            if (fz.yStop != null) {
              const sY = Math.min(fz.yEntry, fz.yStop);
              const sH = Math.abs(fz.yStop - fz.yEntry);
              if (sH > 2) {
                // 반투명 배경
                ctx.fillStyle = fz.stopFill || 'rgba(150,220,200,0.06)';
                ctx.fillRect(zoneX, sY, zoneW, sH);

                // 사선 줄무늬 (위험 표시)
                ctx.save();
                ctx.beginPath();
                ctx.rect(zoneX, sY, zoneW, sH);
                ctx.clip();
                ctx.strokeStyle = fz.stopStripe || 'rgba(150,220,200,0.12)';
                ctx.lineWidth = 1.0;
                const step = 6;
                for (let sx = zoneX - sH; sx < zoneX + zoneW + sH; sx += step) {
                  ctx.beginPath();
                  ctx.moveTo(sx, sY + sH);
                  ctx.lineTo(sx + sH, sY);
                  ctx.stroke();
                }
                ctx.restore();

                // 손절가 점선
                ctx.strokeStyle = fz.stopBorder || 'rgba(150,220,200,0.35)';
                ctx.lineWidth = 0.8;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(zoneX, fz.yStop);
                ctx.lineTo(zoneX + zoneW, fz.yStop);
                ctx.stroke();
                ctx.setLineDash([]);

                // [UX] 손절 텍스트 라벨 (작은 빨강/파랑 폰트)
                if (fz.stopColor) {
                  const slText = '손절';
                  ctx.font = "600 9px 'Pretendard', sans-serif";
                  ctx.textAlign = 'right';
                  ctx.textBaseline = 'middle';
                  const slm = ctx.measureText(slText);
                  const slX = zoneX + zoneW - 4;
                  const slY = fz.yStop;
                  ctx.fillStyle = 'rgba(19,23,34,0.75)';
                  ctx.beginPath();
                  _roundRect(ctx, slX - slm.width - 4, slY - 6, slm.width + 8, 12, 2);
                  ctx.fill();
                  ctx.fillStyle = fz.stopColor;
                  ctx.fillText(slText, slX, slY);
                }
              }
            }
          });
        }

        // ── 9. 연장 구조선 (visible 밖 차트 패턴의 넥라인/추세선 → 현재 범위까지 연장) ──
        //  accent 금색 점선, lineWidth 1.2, dash [6, 4], alpha 0.5
        if (d._extendedLines && d._extendedLines.length) {
          d._extendedLines.forEach(line => {
            const pts = line.points;
            if (!pts || pts.length < 2) return;

            const p1 = pts[0];
            const p2 = pts[pts.length - 1];

            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = KRX_COLORS.ACCENT;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 4]);

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
    }

    zOrder() { return 'normal'; }

    update() {
      const src = this._source;
      if (!src._chart || !src._series || !src._patterns) {
        this._drawData = _emptyData();
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
        } else if (p.type === 'ascendingTriangle' || p.type === 'descendingTriangle') {
          this._buildTriangle(candles, p, toXY, data);
        } else if (p.type === 'risingWedge' || p.type === 'fallingWedge') {
          this._buildWedge(candles, p, toXY, data);
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

      // 패턴 방향에 따른 글로우 색상
      const isBuy = cfg.direction === 'buy';
      const isSell = cfg.direction === 'sell';
      const glowColor = isBuy
        ? 'rgba(150,220,200,0.18)'
        : isSell ? 'rgba(150,220,200,0.18)' : 'rgba(200,200,200,0.12)';
      const glowCenter = isBuy
        ? 'rgba(150,220,200,0.25)'
        : isSell ? 'rgba(150,220,200,0.25)' : 'rgba(200,200,200,0.18)';
      const borderColor = cfg.color;

      glows.push({
        x: hi.x,
        y1: hi.y,
        y2: lo.y,
        width: 18,
        fill: glowColor,
        fillCenter: glowCenter,
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

      const isBuy = _isBullish(p);

      // 위에서 아래로 그라데이션 (매수: 아래서 진해짐, 매도: 위에서 진해짐)
      const fillTop = isBuy
        ? 'rgba(150,220,200,0.02)' : 'rgba(150,220,200,0.10)';
      const fillBottom = isBuy
        ? 'rgba(150,220,200,0.10)' : 'rgba(150,220,200,0.02)';

      brackets.push({
        x1: tl.x, y1: tl.y,
        x2: br.x, y2: br.y,
        fill: cfg.fill,
        fillTop, fillBottom,
        border: cfg.color,
      });
    }

    // ══════════════════════════════════════════════════
    //  이중 바닥 (W형): 부드러운 곡선 + 넥라인
    // ══════════════════════════════════════════════════
    _buildDoubleBottom(candles, p, toXY, data) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      // 넥라인 찾기 (두 저점 사이 최고점)
      let neckline = -Infinity, neckIdx = si;
      for (let j = si; j <= ei && j < candles.length; j++) {
        if (candles[j].high > neckline) { neckline = candles[j].high; neckIdx = j; }
      }
      if (!isFinite(neckline)) return;

      const p1 = toXY(candles[si].time, candles[si].low);
      const pn = toXY(candles[neckIdx].time, neckline);
      const p2 = toXY(candles[ei].time, candles[ei].low);

      // W형 부드러운 곡선
      data.polylines.push({
        points: [p1, pn, p2],
        color: BUY_COLOR,
        width: 1.8,
        dash: [],
        smooth: true,
        dots: true,
      });

      // 넥라인 수평 연장 (점선)
      const extIdx = Math.min(ei + 8, candles.length - 1);
      const nStart = toXY(candles[Math.max(si - 2, 0)].time, neckline);
      const nEnd = toXY(candles[extIdx].time, neckline);
      data.hlines.push({
        y: nStart.y,
        x1: nStart.x, x2: nEnd.x,
        color: GOLD_COLOR,
        width: 1,
        dash: [5, 3],
        priceLabel: neckline.toLocaleString('ko-KR'),
      });

      // W 영역 반투명 채우기
      if (p1.x != null && pn.x != null && p2.x != null) {
        data.trendAreas.push({
          points: [
            p1,
            { x: (p1.x + pn.x) / 2, y: Math.min(p1.y, pn.y) - 5 },
            pn,
            { x: (pn.x + p2.x) / 2, y: Math.min(p2.y, pn.y) - 5 },
            p2,
            { x: p2.x, y: pn.y },
            { x: p1.x, y: pn.y },
          ],
          fill: 'rgba(150,220,200,0.05)',
        });
      }
    }

    // ══════════════════════════════════════════════════
    //  이중 천장 (M형): 부드러운 곡선 + 넥라인
    // ══════════════════════════════════════════════════
    _buildDoubleTop(candles, p, toXY, data) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      let neckline = Infinity, neckIdx = si;
      for (let j = si; j <= ei && j < candles.length; j++) {
        if (candles[j].low < neckline) { neckline = candles[j].low; neckIdx = j; }
      }
      if (!isFinite(neckline)) return;

      const p1 = toXY(candles[si].time, candles[si].high);
      const pn = toXY(candles[neckIdx].time, neckline);
      const p2 = toXY(candles[ei].time, candles[ei].high);

      // M형 부드러운 곡선
      data.polylines.push({
        points: [p1, pn, p2],
        color: SELL_COLOR,
        width: 1.8,
        dash: [],
        smooth: true,
        dots: true,
      });

      // 넥라인 수평 연장
      const extIdx = Math.min(ei + 8, candles.length - 1);
      const nStart = toXY(candles[Math.max(si - 2, 0)].time, neckline);
      const nEnd = toXY(candles[extIdx].time, neckline);
      data.hlines.push({
        y: nStart.y,
        x1: nStart.x, x2: nEnd.x,
        color: GOLD_COLOR,
        width: 1,
        dash: [5, 3],
        priceLabel: neckline.toLocaleString('ko-KR'),
      });

      // M 영역 반투명 채우기
      if (p1.x != null && pn.x != null && p2.x != null) {
        data.trendAreas.push({
          points: [
            p1,
            { x: (p1.x + pn.x) / 2, y: Math.max(p1.y, pn.y) + 5 },
            pn,
            { x: (pn.x + p2.x) / 2, y: Math.max(p2.y, pn.y) + 5 },
            p2,
            { x: p2.x, y: pn.y },
            { x: p1.x, y: pn.y },
          ],
          fill: 'rgba(150,220,200,0.05)',
        });
      }
    }

    // ══════════════════════════════════════════════════
    //  머리어깨 (H&S) / 역머리어깨: 어깨-머리 연결 + 넥라인
    // ══════════════════════════════════════════════════
    _buildHeadAndShoulders(candles, p, toXY, data, inverse) {
      if (!p.trendlines || !p.trendlines.length) return;
      const neckTL = p.trendlines[0];
      if (!neckTL.points || neckTL.points.length < 2) return;

      const pt1 = neckTL.points[0], pt2 = neckTL.points[1];
      const i1 = candles.findIndex(c => c.time === pt1.time);
      const i2 = candles.findIndex(c => c.time === pt2.time);
      if (i1 < 0 || i2 < 0 || i1 === i2) return;

      // 넥라인 (실선 + 연장 점선)
      const nk1 = toXY(pt1.time, pt1.value);
      const nk2 = toXY(pt2.time, pt2.value);
      data.polylines.push({
        points: [nk1, nk2],
        color: GOLD_COLOR,
        width: 1.5,
        dash: [],
      });

      // 넥라인 연장 (점선)
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
        color: GOLD_COLOR,
        width: 1,
        dash: [4, 3],
      });
      data.polylines.push({
        points: [
          nk2,
          toXY(candles[extIdx].time, extVal),
        ],
        color: GOLD_COLOR,
        width: 1,
        dash: [4, 3],
      });

      // 어깨-머리 연결선 (스윙 포인트 연결)
      // 패턴의 시작-중간-끝에서 실제 고/저점을 찾아 연결
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      // 왼쪽 어깨 / 머리 / 오른쪽 어깨의 극값을 찾기
      const mid = Math.floor((si + ei) / 2);
      const leftRange = candles.slice(si, Math.min(mid, candles.length));
      const rightRange = candles.slice(Math.min(mid + 1, candles.length), Math.min(ei + 1, candles.length));

      if (inverse) {
        // 역H&S: 저점들 연결
        const leftLow = _findExtreme(leftRange, 'low', 'min');
        const headLow = _findExtreme(candles.slice(
          Math.max(si, Math.floor(si + (ei - si) * 0.25)),
          Math.min(ei + 1, Math.floor(si + (ei - si) * 0.75) + 1)
        ), 'low', 'min');
        const rightLow = _findExtreme(rightRange, 'low', 'min');

        if (leftLow && headLow && rightLow) {
          const lsP = toXY(leftLow.time, leftLow.low);
          const hdP = toXY(headLow.time, headLow.low);
          const rsP = toXY(rightLow.time, rightLow.low);
          data.connectors.push({
            points: [lsP, hdP, rsP],
            color: BUY_COLOR,
            width: 1.8,
            dash: [3, 2],
            alpha: 0.75,
            showDots: true,
          });
        }
      } else {
        // H&S: 고점들 연결
        const leftHigh = _findExtreme(leftRange, 'high', 'max');
        const headHigh = _findExtreme(candles.slice(
          Math.max(si, Math.floor(si + (ei - si) * 0.25)),
          Math.min(ei + 1, Math.floor(si + (ei - si) * 0.75) + 1)
        ), 'high', 'max');
        const rightHigh = _findExtreme(rightRange, 'high', 'max');

        if (leftHigh && headHigh && rightHigh) {
          const lsP = toXY(leftHigh.time, leftHigh.high);
          const hdP = toXY(headHigh.time, headHigh.high);
          const rsP = toXY(rightHigh.time, rightHigh.high);
          data.connectors.push({
            points: [lsP, hdP, rsP],
            color: SELL_COLOR,
            width: 1.8,
            dash: [3, 2],
            alpha: 0.75,
            showDots: true,
          });
        }
      }
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

      // 상단 추세선
      const u1 = toXY(upperTL.points[0].time, upperTL.points[0].value);
      const u2 = toXY(upperTL.points[1].time, upperTL.points[1].value);
      data.polylines.push({
        points: [u1, u2],
        color: isBuy ? SELL_COLOR : SELL_COLOR,   // 저항선은 항상 sell색
        width: 2.0,
        dash: [],
        dots: true,
      });

      // 하단 추세선
      const l1 = toXY(lowerTL.points[0].time, lowerTL.points[0].value);
      const l2 = toXY(lowerTL.points[1].time, lowerTL.points[1].value);
      data.polylines.push({
        points: [l1, l2],
        color: isBuy ? BUY_COLOR : BUY_COLOR,    // 지지선은 항상 buy색
        width: 2.0,
        dash: [],
        dots: true,
      });

      // 수렴 영역 반투명 채우기
      if (u1.x != null && u2.x != null && l1.x != null && l2.x != null) {
        data.trendAreas.push({
          points: [u1, u2, l2, l1],
          fill: isBuy ? 'rgba(150,220,200,0.04)' : 'rgba(150,220,200,0.04)',
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

      // 상단 추세선 (실선)
      const u1 = toXY(upperTL.points[0].time, upperTL.points[0].value);
      const u2 = toXY(upperTL.points[1].time, upperTL.points[1].value);
      data.polylines.push({
        points: [u1, u2],
        color: isBuy ? GOLD_COLOR : SELL_COLOR,
        width: 2.0,
        dash: [],
        dots: true,
      });

      // 하단 추세선 (실선)
      const l1 = toXY(lowerTL.points[0].time, lowerTL.points[0].value);
      const l2 = toXY(lowerTL.points[1].time, lowerTL.points[1].value);
      data.polylines.push({
        points: [l1, l2],
        color: isBuy ? BUY_COLOR : GOLD_COLOR,
        width: 2.0,
        dash: [],
        dots: true,
      });

      // 수렴 영역 그라데이션 채우기
      if (u1.x != null && u2.x != null && l1.x != null && l2.x != null) {
        data.trendAreas.push({
          points: [u1, u2, l2, l1],
          fill: isBuy ? 'rgba(150,220,200,0.05)' : 'rgba(150,220,200,0.05)',
        });
      }
    }

    // ══════════════════════════════════════════════════
    //  패턴 라벨 (HTS 스타일 pill badge)
    // ══════════════════════════════════════════════════
    _buildLabel(candles, p, toXY, labels) {
      const si = p.startIndex, ei = p.endIndex;
      if (si == null || ei == null || si >= candles.length || ei >= candles.length) return;

      const baseName = PATTERN_NAMES_KO[p.type] || p.type;
      // 신뢰도(%) 추가: "이중바닥 82%"
      const confVal = p.quality != null ? p.quality : p.confidence;
      const name = confVal != null ? `${baseName} ${Math.round(confVal)}%` : baseName;

      // X 위치: 패턴 중앙
      const midIdx = Math.round((si + ei) / 2);
      const midTime = candles[Math.min(midIdx, candles.length - 1)].time;
      const coordX = toXY(midTime, 0);
      if (coordX.x == null) return;

      const isBullish = _isBullish(p);
      const isBearish = _isBearish(p);

      // 색상: 패턴 전용 민트/라벤더/실버
      const color = isBullish ? BUY_COLOR : (isBearish ? SELL_COLOR : NEUTRAL_COLOR);

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

      labels.push({
        x: coordX.x,
        y: labelYVal,
        placement: isBullish ? 'bottom' : 'top',
        text: name,
        color: color,
        bgColor: 'rgba(19,23,34,0.88)',
        borderColor: color,
        confidence: p.confidence,
      });
    }

    // ══════════════════════════════════════════════════
    //  손절/목표가 수평선
    // ══════════════════════════════════════════════════
    _buildStopTarget(patterns, candles, series, toXY, hlines) {
      const top = patterns.find(p => p.stopLoss != null || p.priceTarget != null);
      if (!top) return;

      if (top.stopLoss != null) {
        const y = series.priceToCoordinate(top.stopLoss);
        if (y != null) {
          hlines.push({
            y: y,
            color: KRX_COLORS.PTN_STOP,
            width: 1.5,
            dash: [6, 3],
            marker: 'stop',
            priceLabel: '손절 ' + top.stopLoss.toLocaleString('ko-KR'),
          });
        }
      }
      if (top.priceTarget != null) {
        const y = series.priceToCoordinate(top.priceTarget);
        if (y != null) {
          hlines.push({
            y: y,
            color: KRX_COLORS.PTN_TARGET,
            width: 1.5,
            dash: [6, 3],
            marker: 'target',
            priceLabel: '목표 ' + top.priceTarget.toLocaleString('ko-KR'),
          });
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
      if (ei == null || ei >= candles.length) return;

      const entry = candles[ei].close;
      if (!entry || entry === 0) return;

      const isBuy = _isBullish(p);

      // Forecast Zone 너비: 패턴 끝 → 오른쪽 8봉 연장
      const fzStart = ei;
      const fzEnd = Math.min(ei + 8, candles.length - 1);

      const startCoord = toXY(candles[fzStart].time, entry);
      const endCoord = toXY(candles[fzEnd].time, entry);
      if (startCoord.x == null || endCoord.x == null) return;

      const zone = {
        x1: startCoord.x,
        x2: endCoord.x,
        yEntry: startCoord.y,
        yTarget: null,
        yStop: null,
        returnText: null,
        returnColor: null,
        targetFillNear: null,
        targetFillFar: null,
        targetBorder: null,
        stopFill: null,
        stopStripe: null,
        stopBorder: null,
      };

      // 목표가 영역
      if (p.priceTarget != null) {
        const targetCoord = toXY(candles[fzStart].time, p.priceTarget);
        if (targetCoord.y != null) {
          zone.yTarget = targetCoord.y;

          // 예상 수익률 계산
          const retPct = ((p.priceTarget - entry) / entry * 100);
          const retSign = retPct >= 0 ? '+' : '';
          zone.returnText = `${retSign}${retPct.toFixed(1)}%`;

          // [UX] 목표가 수익률 텍스트: 매수=빨강(UP), 매도=파랑(DOWN) — 작은 폰트로 방향 전달
          zone.returnColor = isBuy ? '#E05050' : '#5086DC';
          zone.targetFillNear = 'rgba(150,220,200,0.22)';
          zone.targetFillFar  = 'rgba(150,220,200,0.05)';
          zone.targetBorder   = 'rgba(150,220,200,0.45)';
        }
      }

      // 손절가 영역
      if (p.stopLoss != null) {
        const stopCoord = toXY(candles[fzStart].time, p.stopLoss);
        if (stopCoord.y != null) {
          zone.yStop = stopCoord.y;

          // [UX] 손절존: 민트 통일, 손절 텍스트는 반대색 (매수 손절=파랑, 매도 손절=빨강)
          zone.stopFill   = 'rgba(150,220,200,0.10)';
          zone.stopStripe = 'rgba(150,220,200,0.16)';
          zone.stopBorder = 'rgba(150,220,200,0.35)';
          zone.stopColor  = isBuy ? '#5086DC' : '#E05050';
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

    setPatterns(candles, patterns, extendedLines) {
      this._patterns = { candles, patterns };
      this._extendedLines = extendedLines || [];
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
              });
            }
          }
        }
        // doubleBottom/doubleTop은 trendlines 없음 → 넥라인 수평선으로 연장
        // (neckline은 패턴 객체에 포함되지 않으므로 candles에서 직접 계산)
        if ((p.type === 'doubleBottom' || p.type === 'doubleTop') &&
            si < candles.length && ei < candles.length) {
          var neckVal = null;
          if (p.type === 'doubleBottom') {
            neckVal = -Infinity;
            for (var ni = si; ni <= ei && ni < candles.length; ni++) {
              if (candles[ni].high > neckVal) neckVal = candles[ni].high;
            }
          } else {
            neckVal = Infinity;
            for (var ni = si; ni <= ei && ni < candles.length; ni++) {
              if (candles[ni].low < neckVal) neckVal = candles[ni].low;
            }
          }
          if (neckVal != null && isFinite(neckVal)) {
            extendedStructLines.push({
              points: [
                { time: candles[si].time, value: neckVal },
                { time: candles[Math.min(ei, candles.length - 1)].time, value: neckVal },
              ],
              isNeckline: true,
              patternType: p.type,
              patternName: PATTERN_NAMES_KO[p.type] || p.type,
            });
          }
        }
      }
      // 계층 1 (캔들스틱) visible 밖 → 아무것도 안 함 (skip)
      // 계층 3 (지지/저항) → hlines가 이미 전체 너비, visiblePatterns에 자동 포함
    }

    if (!visiblePatterns.length && !extendedStructLines.length) {
      _primitive.clearPatterns();
      return;
    }

    // 신뢰도 순 정렬, 최대 MAX_PATTERNS개
    var sorted = visiblePatterns.slice().sort(function(a, b) {
      return (b.confidence || 0) - (a.confidence || 0);
    });
    _primitive.setPatterns(candles, sorted.slice(0, MAX_PATTERNS), extendedStructLines);
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
