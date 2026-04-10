\newpage
### 4.1.1 렌더링 아키텍처와 계층 체계 (Rendering Architecture & Layer System)

**개요**

CheeseStock은 2,700개 이상의 KRX 종목에 대해 9개 패턴 계층과 신호·서브차트 오버레이를 동시 렌더링한다. 렌더링 엔진으로 Canvas2D 기반의 TradingView Lightweight Charts(LWC) v5.1.0을 채택한 근거는 성능과 API 간결성이다. SVG는 O(n) DOM 노드 비용으로 1,000개 이상의 요소에서 성능이 급격히 저하되고, WebGL은 GPU 셰이더 파이프라인이 2D 금융 차트에 과잉 복잡성을 초래한다. Canvas2D는 래스터화 속도, 간결한 드로잉 API, DPR(장치 픽셀 비율) 제어의 세 요건을 동시에 충족한다. 히트 테스팅 불가와 수동 텍스트 레이아웃이라는 단점은 수용 가능한 트레이드오프이다.

9계층 아키텍처는 화가 알고리즘(Painter's Algorithm)을 따른다: 후순위 계층이 선순위 위에 그려진다. 계층 1(글로우)이 가장 먼저 그려져 배경에 놓이고, 계층 9(연장선)이 마지막으로 그려져 전경에 위치한다. 이 순서는 게슈탈트 원리의 시각 위계(visual hierarchy)를 반영한다: 단일 캔들 강조(계층 1-2)는 미묘하게, 예측 구간(계층 8)은 명료하게 표시된다. 각 계층은 제3장의 특정 출력 유형(캔들 패턴, 차트 패턴, S/R 수준, 신뢰도 점수)을 시각화하는 책임이 분리되어 있어, 특정 계층만 선택적으로 렌더링하거나 비활성화할 수 있다.

LWC의 `ISeriesPrimitive` API는 차트 캔버스 위에 직접 그리기를 허용하며, 이것이 패턴·신호·예측 구간 렌더링의 기반이다. 그러나 종목 변경이나 차트 유형 전환(캔들 $\leftrightarrow$ 라인) 시 `candleSeries`가 재생성되므로, 기존 프리미티브가 파괴된 시리즈에 부착된 채로 남으면 렌더링이 중단된다. 이를 방지하기 위해 ISeriesPrimitive 재연결 프로토콜이 필수적이며, `patternRenderer`, `signalRenderer`, `drawingTools` 세 모듈이 동일한 프로토콜을 공유한다.

고해상도 디스플레이(Retina, 4K)에서의 DPR 누적은 미묘하지만 치명적인 버그를 유발한다. 매 리드로우마다 `ctx.scale(dpr, dpr)`을 반복 호출하면 좌표가 기하급수적으로 증가(2배 $\to$ 4배 $\to$ 8배...)하여 그리기 요소가 화면 밖으로 이탈하거나 보이지 않게 된다. 이를 방지하려면 스케일링 전에 반드시 변환 행렬을 항등행렬로 초기화해야 한다. 신호 렌더러는 이중 PaneView 아키텍처를 사용하여 골든/데드 크로스 영역(배경, `zOrder='bottom'`)과 다이아몬드·별 마커(전경, `zOrder='top'`)를 분리 렌더링함으로써, 영역 신호가 캔들스틱 패턴을 가리는 문제를 해결한다.

**핵심 공식**

$$\text{DPR 초기화:} \quad \texttt{ctx.setTransform}(1,0,0,1,0,0); \quad \texttt{ctx.scale}(dpr,\, dpr)$$

$$\text{라벨 충돌:} \quad \mathrm{bbox}(l_i) \cap \mathrm{bbox}(l_j) \neq \emptyset \;\Rightarrow\; y_j \leftarrow y_j \pm 18\,\text{px} \quad (\text{6회 반복})$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| $dpr$ | 장치 픽셀 비율 (Device Pixel Ratio) | 무차원 | 브라우저 API |
| $\alpha$ | 계층 불투명도 | 0.0–1.0 | 본 Stage |
| $\textcolor{stageThreeMarker}{\text{patterns}}$ | 감지된 패턴 배열 | 객체 배열 | **Stage 3** |
| $\textcolor{stageThreeMarker}{\text{confidence}}$ | 패턴 신뢰도 점수 | 0–100 | **Stage 3** |
| $\textcolor{stageThreeMarker}{\text{priceTarget}}$ | 패턴 목표가 | KRW | **Stage 3** |
| $\textcolor{stageThreeMarker}{\text{stopLoss}}$ | 패턴 손절가 | KRW | **Stage 3** |
| $\mathrm{bbox}(l_i)$ | 라벨 $i$의 바운딩 박스 | px | 본 Stage |
| MAX\_PATTERNS | 최대 패턴 표시 수 | 정수 (3) | 상수 [B] |
| MAX\_EXTENDED\_LINES | 최대 연장선 수 | 정수 (5) | 상수 [B] |
| MAX\_DIAMONDS | 최대 다이아몬드 신호 수 | 정수 (6) | 상수 [B] |
| MAX\_STARS | 최대 별 신호 수 | 정수 (2) | 상수 [B] |
| MAX\_DIV\_LINES | 최대 다이버전스선 수 | 정수 (4) | 상수 [B] |
| RECENT\_BAR\_LIMIT | 렌더링 대상 최근 봉 수 | 정수 (50) | 상수 [B] |

> **이전 Stage 데이터:** $\textcolor{stageThreeMarker}{\text{patterns}}$, $\textcolor{stageThreeMarker}{\text{confidence}}$, $\textcolor{stageThreeMarker}{\text{priceTarget}}$, $\textcolor{stageThreeMarker}{\text{stopLoss}}$는 Stage 3 (제3장 3.2–3.4절)에서 산출된 패턴 감지 결과 및 7계층 신뢰도 조정 점수이다. 본 Stage(제4장)는 이 값들을 소비하여 시각 부호로 변환하며, 수정하지 않는다.

**렌더링 엔진 비교**

| 엔진 | 장점 | 단점 | 판정 |
|------|------|------|------|
| SVG | DOM 접근 가능, CSS 스타일링 | O(n) DOM 노드 → 1,000개 이상에서 성능 저하 | 기각 |
| WebGL | GPU 가속, 대량 처리 | 셰이더 파이프라인 복잡, 2D 차트에 과잉 | 기각 |
| Canvas2D | 빠른 래스터화, 간결한 API, DPR 제어 | 히트 테스팅 불가, 수동 텍스트 레이아웃 | **채택** |

**9개 그리기 계층 상세**

| 순서 | 계층명 | 시각 요소 | 제3장 출력 | 색상 (fill $\alpha$ / stroke $\alpha$) |
|------|--------|----------|-----------|--------------------------------------|
| 1 | 글로우(Glows) | 개별 캔들 수직 줄무늬 (폭 16px) | 단일 캔들스틱 패턴 | \#B388FF fill=0.06 / stroke=0.25 |
| 2 | 브래킷(Brackets) | 2–3개 캔들 둥근 사각형 (r=4) | 이중/삼중 패턴 | \#B388FF fill=0.06 / stroke=0.25 |
| 3 | 추세영역(TrendAreas) | 그라데이션 다각형 + 피벗 마커 | 삼각형/쐐기형 차트 패턴 | \#96DCC8 fill=0.04 |
| 4 | 폴리라인(Polylines) | 피벗점 연결선 (W/M/넥라인) | 이중바닥/천정 | `PTN_BUY` rgba 내장 $\alpha$=0.65, 선폭 1.5 |
| 5 | 수평선(Hlines) | 지지/저항, 손절/목표 수평선 | S/R 클러스터링, 패턴 목표가 | 은색/\#FF6B35/민트 점선 [5,3] |
| 6 | 커넥터(Connectors) | H\&S 빈 원 + 어깨 연결선 | 머리어깨 피벗점 | 민트 globalAlpha=0.5, 점선 [2,3] |
| 7 | 라벨(Labels) | 알약형 배지 (Pretendard 12px 700) | 모든 감지 패턴 | 흰색 텍스트 / \#1A1A2E 배경 |
| 8 | 예측구간(ForecastZones) | 목표/손절 그라데이션 + R:R 바 | 패턴 목표가/손절가 | 민트 목표 / 오렌지 손절 |
| 9 | 연장선(ExtendedLines) | 화면 밖 구조선 연장 | 추세선/넥라인 | `KRX_COLORS.ACCENT` globalAlpha=0.35, 점선 [8,4] |

**계층 활성화 조건**

| 패턴 분류 | 활성화 계층 | 라우팅 기준 |
|-----------|-----------|-----------|
| 단일 캔들 (도지, 해머 등 13종) | 1 → 7 → 8 | 단일 패턴 사전 멤버 |
| 이중/삼중 캔들 (장악형, 적삼병 등 20종) | 2 → 7 → 8 | 영역 패턴 사전 멤버 |
| 이중바닥/천정 | 4 → 5 → 7 → 8 | W/M 폴리라인 + 넥라인 수평선 |
| 삼각형/쐐기 (5종) | 3 → 5 → 7 → 8 | 추세 영역 다각형 + 돌파선 |
| 머리어깨/역머리어깨 | 4 → 5 → 6 → 7 → 8 | 피벗 폴리라인 + 넥라인 + 어깨 커넥터 |
| 지지/저항 | 5 | 수평선만 (라벨 없음) |
| 모든 패턴 (조건부) | 9 | 화면 밖 구조선이 존재할 때만 |

계층 8 활성화 조건: 예측 구간은 패턴에 `priceTarget`과 `stopLoss`가 모두 존재할 때만 렌더링된다. 승률 조건부 착색: 승률 > 60% → 민트, 40–60% → 노랑(`#ffeb3b`), < 40% → 청색.

**줌 적응형 밀도 제어**

| 가시 봉 수 | 유효 최대 패턴 | 근거 |
|-----------|--------------|------|
| $\leq$ 50봉 (고배율 줌인) | 1 | 좁은 시야 → 정보 밀도 감소 필수 |
| 51–200봉 (표준 뷰) | 2 | 중간 맥락 |
| > 200봉 (축소 뷰) | 3 (기본값) | 넓은 맥락에서 다수 패턴 수용 가능 |

정렬 우선순위: (1) 활성 패턴(`priceTarget`/`stopLoss` 보유) 우선, (2) 동순위 시 신뢰도 내림차순. 연장선도 동일한 신뢰도 정렬 후 MAX\_EXTENDED\_LINES=5로 절삭.

**ISeriesPrimitive 재연결 시퀀스**

```
1. 대상 시리즈 결정:
   chartType == 'line' → cm.indicatorSeries._priceLine (null 방어)
   그 외              → cm.candleSeries

2. 시리즈 변경 감지:
   _attachedSeries !== targetSeries ?

3. 예 → 분리(detach):
   try { _attachedSeries.detachPrimitive(_primitive); } catch(e) {}
   // try-catch: 이미 파괴된 시리즈에서의 분리 실패를 방어

4. 새 프리미티브 생성 및 부착:
   _primitive = new PatternOverlayPrimitive();
   targetSeries.attachPrimitive(_primitive);
   _attachedSeries = targetSeries;
```

라인 모드에서 `_priceLine`이 `null`일 수 있으므로 반드시 null 가드가 필요하다. `patternRenderer`, `signalRenderer`, `drawingTools` 세 모듈이 동일한 프로토콜을 사용한다.

**신호 렌더러 이중 PaneView**

| 패인 | zOrder | 시각 요소 | 근거 |
|------|--------|----------|------|
| **배경** | `'bottom'` | 수직 밴드 (골든/데드 크로스 영역) | 맥락 신호가 가격 동작을 가리지 않아야 함 |
| **전경** | `'top'` | 다이아몬드, 별, 다이버전스선, 거래량 라벨 | 고신뢰 신호는 가격 위에 반드시 노출 |

골든/데드 크로스 영역은 다수 봉에 걸쳐 확장되어 전경에 렌더링하면 캔들스틱 패턴을 완전히 가릴 수 있다. 반면 다이아몬드/별 마커는 특정 봉의 점(point) 신호로, 캔들과 공존할 수 있을 만큼 작다.

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 9계층 렌더링 (화가 알고리즘) | `js/patternRenderer.js` `_drawFn()` | 글로우→연장선 9단계 고정 순서 |
| 신호 렌더링 이중 패인 | `js/signalRenderer.js` dual PaneView | 배경 밴드(`zOrder='bottom'`) / 전경 마커(`zOrder='top'`) |
| DPR 안전성 초기화 | `js/financials.js` `drawFinTrendChart()` | `ctx.setTransform(1,0,0,1,0,0)` 선행 |
| 라벨 충돌 회피 | `js/patternRenderer.js` `_labelCollision()` | 6회 반복 수직 재배치, 실패 시 생략 |
| ISeriesPrimitive 재연결 | `js/patternRenderer.js`, `js/signalRenderer.js`, `js/drawingTools.js` | 종목 변경·차트 유형 전환 시 detach→reattach |
| 줌 적응 밀도 | `js/patternRenderer.js` effectiveMax 계산 | 가시 봉 수 기반 MAX\_PATTERNS 동적 조정 |
| Miller(1956) 인지 부하 | MAX\_PATTERNS=3, RECENT\_BAR\_LIMIT=50 | 시각 요소 수 상한 설계 |

\newpage
### 4.4.1 시각화 도출 요약 (Visualization Derivation Summary)

**개요**

제3장(기술적 분석)의 수학적 출력은 제4장(차트 시각화)에서 시각 부호로 변환된다. 이 변환은 일대다 매핑이다: 하나의 수치(예: 신뢰도 점수)가 라벨 불투명도, 티어 배지 색상, 예측 구간 가시성 등 여러 시각 채널에 동시에 영향을 미친다. 매핑 설계의 핵심 원칙은 정보이론적 채널 분리이다: 가격 방향(상승/하락)은 적색/청색으로, 분석 유형(차트/캔들 패턴)은 민트/보라로, 재무 품질은 녹색/청색으로 인코딩되어 세 채널이 독립적으로 디코딩 가능하다.

시각화 토글(`vizToggles`)은 렌더링 시점에 `_filterPatternsForViz()`로 필터링을 수행하므로, 제3장의 분석은 토글 상태와 무관하게 항상 완전히 실행된다. 이 연산-표시 분리 원칙은 패턴 감지 정확도가 사용자의 표시 설정에 독립적임을 보장하며, 백테스트 결과가 시각화 상태에 오염되지 않게 한다.

**제3장 출력 → 제4장 시각 부호 종합 매핑**

| $\textcolor{stageThreeMarker}{\text{Stage 3 출력 유형}}$ | 제4장 계층 | 시각적 부호화 | 예시 |
|----------------------------------------------------------|-----------|-------------|------|
| $\textcolor{stageThreeMarker}{\text{지표값 (MA, BB)}}$ | 차트 오버레이 | 색상 선 | MA5 = 적색 선 |
| $\textcolor{stageThreeMarker}{\text{캔들 패턴}}$ | 계층 1–2 + 계층 7 | 보라 하이라이트 + 배지 | "해머" 배지 |
| $\textcolor{stageThreeMarker}{\text{차트 패턴}}$ | 계층 3–6 | 민트 다각형 + 선 | 삼각형 채우기 |
| $\textcolor{stageThreeMarker}{\text{S/R 수준}}$ | 계층 5 | 은색 수평선 + 가격 라벨 | 50,000원 지지선 |
| $\textcolor{stageThreeMarker}{\text{신호}}$ | 신호 렌더러 전경 | 다이아몬드(중) 또는 별(강) | 골든크로스 다이아몬드 |
| $\textcolor{stageThreeMarker}{\text{예측 구간}}$ | 계층 8 | 민트/오렌지 그라데이션 | 목표/손절 투영 |
| $\textcolor{stageThreeMarker}{\text{신뢰도 점수}}$ | 라벨 불투명도 + 티어 배지 | $\alpha$ 0.4–1.0 + A/B/C/D 색상 | Tier A = 녹색 배지 |
| $\textcolor{stageThreeMarker}{\text{백테스트 결과}}$ | 패턴 패널 카드 (C열) | 승률 %, 평균 수익률 % | "승률 62%" 텍스트 |

> **이전 Stage 데이터:** 위 표의 모든 Stage 3 출력 유형은 `js/patterns.js` (`patternEngine.analyze()`), `js/signalEngine.js` (`signalEngine.analyze()`), `js/backtester.js` (`backtester.backtestAll()`)에서 산출된다. 본 Stage(제4장)는 이 값들을 소비하는 종단점이며, 역방향 의존성이 없다.

**시각화 파이프라인 전체 흐름**

| 단계 | 위치 | 역할 |
|------|------|------|
| 1. 패턴 감지 | `js/patterns.js` | ATR 정규화, 품질 점수, S/R 클러스터링 |
| 2. 신호 생성 | `js/signalEngine.js` | 16개 지표 신호 + 6개 복합 신호 |
| 3. 백테스트 | `js/backtester.js` | 패턴별 N일 수익률 통계 |
| 4. 시각 필터 | `appUI.js` `_filterPatternsForViz()` | 4범주 토글 기반 렌더 시점 필터링 |
| 5. 패턴 렌더링 | `js/patternRenderer.js` | 9계층 Canvas2D 드로잉 |
| 6. 신호 렌더링 | `js/signalRenderer.js` | 이중 PaneView (배경/전경) |
| 7. 패널 표시 | `js/patternPanel.js` | C열 카드: 승률, 평균 수익률, 학술 메타데이터 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 정보이론 채널 분리 (Shannon 1948) | `js/colors.js` KRX\_COLORS | 방향(UP/DOWN) · 유형(PTN\_BUY/CANDLE) · 품질(fin-good) 독립 채널 |
| Miller(1956) 인지 부하 한계 | MAX\_PATTERNS=3, MAX\_DIAMONDS=6 | 계층별 밀도 상한으로 시각 포화 방지 |
| 화가 알고리즘 | `patternRenderer._drawFn()` 9단계 고정 순서 | 글로우(배경) → 연장선(전경) 계층 위계 |
| 연산-표시 분리 원칙 | `_filterPatternsForViz()` 렌더 시점 필터 | 분석 완전성 보존, 토글 상태 독립성 |
| Tufte(1983) 데이터-잉크 비율 | $\alpha$=0.06–1.0 불투명도 차등 | 신뢰도 높을수록 불투명, 낮을수록 투명 |
| 한국 시장 색상 관례 | KRX\_COLORS.UP=\#E05050, DOWN=\#5086DC | 적색=상승, 청색=하락 (서양과 반대) |
| 패턴 방향 중립성 | PTN\_BUY = PTN\_SELL = 민트 | 방향 정보는 라벨 텍스트·위치로만 전달 |

\newpage
