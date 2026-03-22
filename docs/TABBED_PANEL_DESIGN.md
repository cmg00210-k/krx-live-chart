# Tabbed Right Panel Design Specification

## CheeseStock — C+D 열 통합 탭 패널 설계서

---

## 1. Investing.com 및 글로벌 벤치마크 분석

### 1.1 Investing.com 탭 시스템 (데스크톱)

Investing.com의 종목 상세 페이지는 다음과 같은 탭 구조를 사용:

**탭 항목**: Overview | Chart | Financials | Technical | Forum | Forecast

**탭 바 디자인**:
- 높이: 약 44-48px (상하 패딩 포함)
- 폰트: 14px, weight 500, 대문자 없음
- 활성 탭: 하단 2px 솔리드 보더 (파란색 계열 `#2962FF`)
- 비활성 탭: `color: #6a6d78` (서브 텍스트), 하단 보더 없음
- 배경: 페이지 배경과 동일 (투명), 호버 시 미세 밝아짐
- 구분선: 탭 바 하단에 1px `border-bottom` (전체 너비)
- 간격: 탭 간 24-32px gap (justify 아닌 left-aligned)

**반응형 동작**:
- 데스크톱 (>1280px): 전체 탭 인라인 표시, 차트 위 수평 배치
- 태블릿 (768-1280px): 탭 수 유지하나 간격 축소, 가로 스크롤 없음
- 모바일 (<768px): 탭이 가로 스크롤 가능한 strip으로 변환, 고정 상단
- **핵심**: Investing.com은 우측 패널 탭이 아닌 **페이지 전체 탭**을 사용

### 1.2 StockAnalysis.com 탭 시스템

**탭 항목**: Overview | Financials | Statistics | Dividends | Profile | Chart

**탭 바 디자인**:
- 주가 헤더 바로 아래 수평 배치
- 활성 탭: 하단 2px 보더 + 굵은 폰트
- 간격: 균등 분배가 아닌 콘텐츠 기반 너비
- 반응형: 좁은 화면에서 가로 스크롤

### 1.3 TradingView 위젯바

**우측 패널**: 접이식 위젯바 (widgetbar)
- `is-widgetbar-expanded` 클래스로 토글
- 차트와 독립된 고정 우측 패널
- 와치리스트, 뉴스, 캘린더 등 탭형 위젯
- 넓은 화면(>1576px): `popup-wide` 모드
- **핵심**: 페이지 탭이 아닌 **사이드 패널 내 세그먼트**

### 1.4 네이버 증권 / 한국 증권 앱

**탭 구조**: 현재가 | 차트 | 투자자 | 뉴스 | 종목분석 | 전자공시
- 탭 바가 종목 헤더 바로 아래
- 활성 탭: 하단 3px 보더 (주로 빨간색 계열)
- 모바일 앱: 스와이프로 탭 전환, bottom nav와 별개

### 1.5 핵심 인사이트 종합

| 플랫폼 | 탭 위치 | 활성 표시 | 반응형 전략 |
|---------|---------|-----------|------------|
| Investing.com | 페이지 상단 (헤더 아래) | 하단 2px 보더 | 스크롤 strip |
| StockAnalysis | 헤더 아래 수평 | 하단 보더 + 굵은 폰트 | 스크롤 |
| TradingView | 우측 사이드바 내 | 배경색 변경 | 접이식 |
| 네이버 증권 | 헤더 아래 수평 | 하단 3px 보더 (빨강) | 앱: 스와이프 |
| Yahoo Finance | 헤더 아래 수평 | 하단 보더 | 반응형 축소 |

**CheeseStock에 적합한 모델**: TradingView의 **사이드 패널 내 탭** 접근 방식이 가장 적합.
차트가 메인이고 우측에 보조 정보를 표시하는 구조이므로, 페이지 탭보다 패널 내 탭이 자연스러움.

---

## 2. CheeseStock 탭 패널 설계

### 2.1 설계 원칙

1. **차트 우선**: 차트 영역(B열)이 항상 최대 공간 확보
2. **스크롤 최소화**: 탭 전환으로 정보 분리, 각 탭 내 스크롤 최소화 (feedback: no-scrollbar 정책)
3. **기존 UX 보존**: 현재 C/D열 사용자가 학습한 패턴 유지
4. **점진적 축소**: 넓은 화면에서는 C+D 분리 유지, 좁아질수록 통합

### 2.2 탭 항목

| 탭 | 한글 | 아이콘 | 내용 |
|----|------|--------|------|
| 재무 | 재무 | &#8942; (그리드) | 현재 D열 전체 (주요재무지표) |
| 패턴 | 패턴 | &#9670; (다이아몬드) | 현재 C열 전체 (기술적 패턴 분석) |
| (미래) 분석 | 분석 | &#9733; (별) | 시그널 요약, 복합 분석 결과 |

### 2.3 탭 바 디자인

```
┌──────────────────────────────────┐
│  재무        패턴                │  ← 탭 바 (36px)
│  ════                           │  ← 활성 인디케이터 (2px)
├──────────────────────────────────┤
│                                  │
│  (탭 콘텐츠 영역)                │
│                                  │
└──────────────────────────────────┘
```

**탭 바 CSS 스펙**:
```css
.tab-bar {
  height: 36px;
  display: flex;
  gap: 0;
  padding: 0;
  background: var(--panel);           /* #141414 */
  border-bottom: 1px solid var(--border);  /* #252525 */
  flex-shrink: 0;
}

.tab-item {
  flex: 1;                            /* 균등 분배 (2탭) */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 var(--sp-3);
  font-family: var(--font-sans);      /* Pretendard */
  font-size: var(--fs-body);          /* 12px */
  font-weight: 500;
  color: var(--text-muted);           /* #808080 */
  cursor: pointer;
  border: none;
  background: transparent;
  position: relative;
  transition: color var(--transition);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.tab-item:hover {
  color: var(--text-sub);             /* #A0A0A0 */
}

.tab-item.active {
  color: var(--accent);               /* #A08830 — 금색 */
  font-weight: 600;
}

/* 활성 탭 하단 인디케이터 */
.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background: var(--accent);
  border-radius: 1px 1px 0 0;
  transition: left .2s ease, right .2s ease;
}
```

**디자인 근거**:
- `var(--accent)` 사용: 기존 `.rp-header`, `.pp-header`가 이미 accent 컬러를 사용중
- 36px 높이: 기존 toolbar(32px)보다 약간 크지만 header(40px)보다 작음 — 시각적 계층에 자연스럽게 위치
- 하단 인디케이터: Investing.com/네이버 증권과 동일한 패턴, 토글 버튼(`.tf-btn.active`)과 구분됨
- `flex: 1` 균등 분배: 2개 탭이므로 50/50이 깔끔. 3탭으로 확장 시에도 33/33/33

### 2.4 기존 버튼 스타일과의 차별화

| 요소 | 스타일 | 용도 |
|------|--------|------|
| `.tf-btn.active` | 배경색 변경 (`var(--accent)`) | 상태 토글 (하나만 선택) |
| `.ind-btn.active` | 배경색 변경 | 기능 on/off |
| `.fin-trend-tab.active` | 미세 배경 + 보더 | 데이터 필터 |
| **`.tab-item.active`** | **하단 인디케이터 + 텍스트색** | **콘텐츠 영역 전환** |

핵심 차이: 탭은 **배경색 없이 하단 바만** 사용하여 "영역 전환"의 시맨틱을 전달.
토글 버튼은 **배경색 채움**으로 "상태 활성/비활성"을 전달.

---

## 3. 브레이크포인트별 패널 동작

### 3.1 전체 요약

```
 Breakpoint    Grid columns                          Tab panel
 ──────────    ──────────────────────────────────     ─────────────────────
 >1440px       A(260) | B(1fr) | C(240) | D(380)     C+D 분리 유지 (탭 없음)
 1201-1440px   A(var) | B(1fr) | C(220) | D(340)     C+D 분리 유지 (탭 없음)
 1024-1200px   A(var) | B(1fr) | TP(300)              C+D 통합 탭 패널
 768-1024px    0 | B(1fr) | TP(260)                   C+D 통합 탭 패널, A=드로어
 <768px        B(1fr)                                  탭 바텀시트 (60vh)
```

### 3.2 >1440px — 4열 분리 (현재 유지)

```
 ┌─────────┬──────────────────────────┬────────┬──────────┐
 │ sidebar │         chart            │ pattern│ financial│
 │  260px  │          1fr             │  240px │   380px  │
 │         │                          │        │          │
 │  종목   │    캔들차트 + 서브차트    │ 패턴   │ 재무     │
 │  목록   │                          │ 카드   │ 지표     │
 │         │                          │        │          │
 └─────────┴──────────────────────────┴────────┴──────────┘
```

**변경사항**: 없음. 화면이 충분히 넓으므로 C/D 분리 유지.
탭 바 불필요 — 각 열 헤더(`.pp-header`, `.rp-header`)가 이미 제목 역할.

**CSS**:
```css
/* 기존 그대로 유지 */
#main {
  grid-template-columns:
    minmax(0, var(--sidebar-w))
    minmax(360px, 1fr)
    minmax(200px, var(--pattern-panel-w))
    minmax(260px, var(--rpanel-w));
}
```

### 3.3 1201-1440px — 4열 분리, 축소 (현재 유지)

```
 ┌───────┬────────────────────────┬──────┬────────┐
 │sidebar│        chart           │patter│financil│
 │ 220px │         1fr            │220px │ 340px  │
 │       │                        │      │        │
 └───────┴────────────────────────┴──────┴────────┘
```

**변경사항**: 없음. 기존 미디어 쿼리 유지.

### 3.4 1024-1200px — C+D 통합 (핵심 변경)

```
 ┌───────┬────────────────────────────┬─────────────┐
 │sidebar│           chart            │ ┌──────────┐│
 │ 200px │            1fr             │ │ 재무│패턴 ││ ← 탭 바
 │       │                            │ │ ════     ││
 │       │                            │ │          ││
 │       │                            │ │ 탭 콘텐츠││ 300px
 │       │                            │ │          ││
 │       │                            │ └──────────┘│
 └───────┴────────────────────────────┴─────────────┘
```

**CSS**:
```css
@media (max-width: 1200px) {
  #main {
    grid-template-columns:
      minmax(0, var(--sidebar-w))     /* A */
      minmax(360px, 1fr)              /* B */
      0px                             /* C: hidden */
      300px;                          /* D: 통합 탭 패널 */
  }

  /* C열 내용을 D열로 이동은 JS에서 처리.
     CSS에서는 #pattern-panel을 숨기고
     #right-panel 내부에 탭 바 + 패턴 콘텐츠 영역 표시 */

  #pattern-panel {
    display: none;  /* C열 그리드 슬롯에서 완전 제거 */
  }

  /* 탭 바 활성화 */
  .rp-tab-bar {
    display: flex;  /* 데스크톱에서는 display:none */
  }

  /* 기존 rp-header 숨김 (탭이 대체) */
  .rp-header {
    display: none;
  }
}
```

**탭 바 높이**: 36px
**패널 너비**: 300px (현재 1200px에서 rpanel=280 + pattern=200 → 통합 300px로 공간 절약)
**chart 영역 확보**: 약 120-180px 더 넓어짐 (현재 C+D = 480px → 300px)

### 3.5 768-1024px — A=드로어, B+통합패널

```
 ┌────────────────────────────────┬──────────┐
 │            chart               │┌────────┐│
 │             1fr                ││재무│패턴││ ← 탭 바
 │                                ││════    ││
 │                                ││        ││ 260px
 │  (사이드바는 좌측 드로어)       ││ 콘텐츠 ││
 │                                ││        ││
 │                                │└────────┘│
 └────────────────────────────────┴──────────┘
```

**CSS**:
```css
@media (max-width: 1024px) {
  #main {
    grid-template-columns: 0px 1fr 0px 260px;
  }

  /* A열: 기존 드로어 스타일 유지 */
  /* 통합 탭 패널 너비 축소 */
}
```

### 3.6 <768px — 탭 바텀시트

```
 ┌────────────────────────────────┐
 │            chart               │
 │          전체 너비              │
 │                                │
 │                                │
 ├────────────────────────────────┤ ← 상단 그립 핸들
 │  재무    │   패턴               │ ← 탭 바 (바텀시트 내)
 │  ════                          │
 │                                │
 │  (탭 콘텐츠)                    │ 60vh
 │                                │
 └────────────────────────────────┘
```

**CSS**:
```css
@media (max-width: 768px) {
  #main {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }

  /* 통합 패널 → 바텀시트 */
  #right-panel {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: min(60vh, 480px);
    z-index: 190;
    transform: translateY(100%);
    transition: transform .3s ease, box-shadow .3s ease;
    border-radius: 12px 12px 0 0;
  }

  #right-panel.rp-sheet-open {
    transform: translateY(0);
    box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
  }

  /* 그립 핸들 (기존 ::before 유지) */

  /* 탭 바: 바텀시트 내 상단 */
  .rp-tab-bar {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--panel);
  }
}
```

**FAB 버튼 변경**: 기존 `#fin-toggle`을 유지하되, 열면 탭 바텀시트가 나타남.
기본 활성 탭은 "재무"이지만 패턴이 감지된 상태라면 "패턴" 탭에 배지/dot 표시.

---

## 4. 탭 전환 UX

### 4.1 콘텐츠 전환 애니메이션

**선택: 크로스페이드 (opacity)**
- 슬라이드(translateX)는 두 콘텐츠가 동시에 공간을 차지해야 해서 복잡
- 크로스페이드는 단순하고, 트레이딩 플랫폼에서 표준적

```css
.rp-tab-content {
  display: none;
  opacity: 0;
  transition: opacity .15s ease;
}

.rp-tab-content.active {
  display: flex;
  flex-direction: column;
  opacity: 1;
}
```

**참고**: `display: none → flex` 전환은 transition이 먹지 않으므로, JS에서 2단계로:
1. `display: flex` 설정 + `requestAnimationFrame`
2. `opacity: 1` 적용

또는 더 단순하게 `visibility` + `height` 조합:
```css
.rp-tab-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.rp-tab-content[hidden] {
  display: none;
}
```

**최종 권장**: 트레이딩 앱에서 즉각 반응이 중요하므로, 복잡한 전환보다 **즉시 전환(display toggle)** 권장. `opacity` 페이드는 100ms 이하로 짧게.

### 4.2 스크롤 위치 보존

각 탭의 스크롤 위치를 JS에서 저장/복원:
```javascript
// 탭 전환 시
const scrollPositions = { fin: 0, pattern: 0 };

function switchTab(tabId) {
  // 현재 탭 스크롤 위치 저장
  const currentContent = document.querySelector('.rp-tab-content.active');
  if (currentContent) {
    scrollPositions[currentTabId] = currentContent.scrollTop;
  }

  // 탭 전환
  // ...

  // 새 탭 스크롤 위치 복원
  const newContent = document.querySelector('.rp-tab-content.active');
  if (newContent) {
    newContent.scrollTop = scrollPositions[tabId] || 0;
  }
}
```

### 4.3 터치 스와이프 (모바일)

현재 탭이 2개뿐이므로 좌/우 스와이프로 전환 가능.
단, 차트 영역과의 터치 충돌 방지 필요 — **패널 내부에서만** 스와이프 감지.

```
swipe threshold: 50px
direction: 좌 → 다음 탭, 우 → 이전 탭
velocity threshold: 0.3px/ms (우연한 터치 방지)
```

**우선순위**: 낮음. 탭 클릭이 1차, 스와이프는 개선 사항으로 후순위.

### 4.4 활성 탭 인디케이터 애니메이션

인디케이터가 탭 간 슬라이드하는 효과 (Investing.com 스타일):

```css
.rp-tab-bar {
  position: relative;
}

/* 슬라이딩 인디케이터 (JS에서 left/width 제어) */
.rp-tab-indicator {
  position: absolute;
  bottom: 0;
  height: 2px;
  background: var(--accent);
  border-radius: 1px 1px 0 0;
  transition: left .2s ease, width .2s ease;
  pointer-events: none;
}
```

JS에서 활성 탭의 `offsetLeft`와 `offsetWidth`를 읽어 인디케이터 위치 업데이트.
이 방식이 `::after` 보다 자연스러운 슬라이딩 효과를 줌.

---

## 5. DOM 구조 설계

### 5.1 현재 구조

```html
<!-- C열 -->
<div id="pattern-panel">
  <div class="pp-header">기술적 패턴 분석</div>
  <div class="pp-content" id="pp-content">...</div>
</div>

<!-- D열 -->
<div id="right-panel">
  <div class="rp-header">주요재무지표</div>
  <div id="fin-content">...</div>
</div>
```

### 5.2 제안 구조

```html
<!-- C열: 넓은 화면에서만 표시 (>1200px) -->
<div id="pattern-panel">
  <div class="pp-header">기술적 패턴 분석</div>
  <div class="pp-content" id="pp-content">
    <div id="pp-cards">...</div>
  </div>
</div>

<!-- D열 (또는 통합 탭 패널) -->
<div id="right-panel">
  <!-- 기존 헤더: 넓은 화면에서만 (탭 없을 때) -->
  <div class="rp-header">주요재무지표<span id="fin-source-badge" ...></span></div>

  <!-- 탭 바: 1200px 이하에서 표시 -->
  <div class="rp-tab-bar" id="rp-tab-bar">
    <button class="rp-tab active" data-tab="fin">재무</button>
    <button class="rp-tab" data-tab="pattern">패턴</button>
    <div class="rp-tab-indicator"></div>
  </div>

  <!-- 재무 탭 콘텐츠 (기존 fin-content) -->
  <div id="fin-content" class="rp-tab-content active">
    ... (기존 재무 지표 전체)
  </div>

  <!-- 패턴 탭 콘텐츠 (JS에서 C열 내용을 이동하거나 미러링) -->
  <div id="rp-pattern-content" class="rp-tab-content">
    <!-- 1200px 이하에서 JS가 #pp-cards를 여기로 appendChild
         또는 별도 렌더링 -->
  </div>
</div>
```

### 5.3 JS 연동 전략

**Option A: DOM 이동 (권장)**
- `<=1200px`일 때 `#pp-cards`를 `#rp-pattern-content`로 `appendChild`
- `>1200px`로 복귀 시 원래 `#pp-content`로 복귀
- 장점: 단일 DOM, 이벤트 유지, 메모리 효율
- 단점: matchMedia change 리스너 필요

**Option B: 듀얼 렌더링**
- patternPanel.js가 양쪽 컨테이너에 모두 렌더링
- 화면 크기에 따라 하나만 보이게 CSS 제어
- 장점: JS 변경 최소
- 단점: DOM 중복, 성능 영향

**추천**: Option A — DOM 이동 방식. 패턴 카드가 최대 3개이므로 이동 비용 미미.

---

## 6. 완전한 CSS 스펙

### 6.1 탭 바 (공통)

```css
/* ── 통합 탭 바 ── */
.rp-tab-bar {
  display: none;                      /* 기본: 숨김 (>1200px) */
  height: 36px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: relative;
  padding: 0;
}

.rp-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0 var(--sp-3);
  font-family: var(--font-sans);
  font-size: var(--fs-body);          /* 12px */
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--transition);
  letter-spacing: 0.03em;
  white-space: nowrap;
  position: relative;
}

.rp-tab:hover {
  color: var(--text-sub);
}

.rp-tab.active {
  color: var(--accent);
  font-weight: 600;
}

/* 슬라이딩 인디케이터 */
.rp-tab-indicator {
  position: absolute;
  bottom: 0;
  height: 2px;
  background: var(--accent);
  border-radius: 1px 1px 0 0;
  transition: left .2s ease, width .2s ease;
  pointer-events: none;
}

/* 탭 콘텐츠 (1200px 이하에서만 #right-panel 내부에 표시) */
.rp-tab-content {
  display: none;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.rp-tab-content.active {
  display: flex;
}

/* 패턴 탭 내부 (C열 콘텐츠 미러링) */
#rp-pattern-content {
  padding: var(--sp-2);
  gap: var(--sp-2);
}
```

### 6.2 브레이크포인트별

```css
/* ── >1440px: 4열 분리, 탭 없음 ── */
@media (min-width: 2000px) {
  :root {
    --rpanel-w: 420px;
    --pattern-panel-w: 300px;
  }
}

/* ── 1201-1440px: 4열 분리, 축소 ── */
@media (max-width: 1440px) {
  :root {
    --rpanel-w: 340px;
    --pattern-panel-w: 220px;
  }
}

/* ── 1024-1200px: C+D 통합 탭 패널 ── */
@media (max-width: 1200px) {
  :root {
    --rpanel-w: 300px;          /* 통합 패널 너비 */
  }

  #main {
    grid-template-columns:
      minmax(0, var(--sidebar-w))
      minmax(360px, 1fr)
      0px                       /* C열 숨김 */
      var(--rpanel-w);           /* D열 = 통합 탭 패널 */
  }

  #pattern-panel {
    display: none;               /* 그리드에서 완전 제거 */
  }

  .rp-tab-bar {
    display: flex;               /* 탭 바 활성화 */
  }

  .rp-header {
    display: none;               /* 기존 헤더 숨김 (탭이 대체) */
  }

  /* fin-content는 이제 .rp-tab-content 역할 */
  #fin-content.rp-tab-content { /* specificity 확보 */ }
}

/* ── 768-1024px: A=드로어, 통합 탭 축소 ── */
@media (max-width: 1024px) {
  :root {
    --rpanel-w: 260px;
  }

  #main {
    grid-template-columns: 0px 1fr 0px var(--rpanel-w);
  }

  /* 사이드바 드로어: 기존 유지 */

  /* 탭 바: 폰트 축소 */
  .rp-tab {
    font-size: var(--fs-caption);  /* 11px */
  }
}

/* ── <768px: 탭 바텀시트 ── */
@media (max-width: 768px) {
  #main {
    grid-template-columns: 1fr;
  }

  #right-panel {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: min(60vh, 480px);
    z-index: 190;
    transform: translateY(100%);
    transition: transform .3s ease;
    border-radius: 12px 12px 0 0;
    border-top: 1px solid var(--border);
  }

  #right-panel.rp-sheet-open {
    transform: translateY(0);
    box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
  }

  /* 바텀시트 내 탭 바: sticky */
  .rp-tab-bar {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--panel);
    border-radius: 12px 12px 0 0;   /* 시트 모서리 따름 */
  }

  .rp-header { display: none; }

  /* 그립 핸들을 탭 바 위에 배치 */
  #right-panel::before {
    content: '';
    display: block;
    width: 36px; height: 4px;
    background: var(--text-muted);
    border-radius: 2px;
    margin: var(--sp-2) auto var(--sp-1);
    opacity: 0.5;
    flex-shrink: 0;
  }
}
```

### 6.3 패턴 배지 (패턴 감지 알림)

패턴이 감지되었을 때 "패턴" 탭에 작은 dot을 표시:

```css
.rp-tab[data-tab="pattern"]::before {
  content: '';
  display: none;                     /* 기본 숨김 */
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  position: absolute;
  top: 8px;
  right: calc(50% - 24px);          /* 텍스트 오른쪽 끝 근처 */
}

.rp-tab[data-tab="pattern"].has-patterns::before {
  display: block;
}
```

---

## 7. 텍스트 와이어프레임

### 7.1 >1440px (4열 분리)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ☰ CheeseStock              삼성전자 검색...        KOSPI 2,547  KOSDAQ 742   │
├──────────┬──────────────────────────────────────┬──────────┬──────────────────┤
│          │ 삼성전자 005930 KOSPI ● LIVE          │기술적    │주요재무지표 DART│
│ 즐겨찾기 │ 54,200  ▼ -800 (-1.45%)              │패턴 분석 │                │
│ ────────│─────────────────────────────────────── │──────────│2024Q3 연결기준  │
│ 최근본   │ 1분 5분 15분 30분 1시간 [일봉] │ 캔들..  │          │                │
│ ────────│────────────────────────────────────── │▌ 이브닝  │주요손익 지표    │
│          │                                      │▌ 스타    │매출액    67.3조 │
│ ▲ 삼성전 │        ┌─────────────┐               │▌ ────── │영업이익   9.8조 │
│   54,200 │        │             │               │▌ 신뢰도  │순이익     7.2조 │
│   -1.45% │        │   캔들차트   │               │▌ ████░ │                │
│ ▲ SK하이 │        │             │               │▌ 75%    │수익성 지표     │
│   97,800 │        │             │               │          │OPM   ROE   EPS │
│   +2.3%  │        └─────────────┘               │▌ 더블    │14.6% 8.2% 5180│
│ ▼ 현대차 │ [RSI 14]                              │▌ 바텀    │                │
│   186,500│ ──────────────────────                │▌ ────── │밸류에이션 지표  │
│   -0.8%  │ [MACD (12,26,9)]                      │▌ 신뢰도  │PER  PBR  PSR  │
│ ...      │ ──────────────────────                │▌ ████░ │10.5 0.97 1.02 │
│          │                                      │▌ 82%    │                │
│ 2,734종목│ [패턴 수익률 통계...]                  │          │투자판단 72/B   │
├──────────┴──────────────────────────────────────┴──────────┴──────────────────┤
│ ⓘ TradingView Lightweight Charts                                            │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 1024-1200px (C+D 통합 탭)

```
┌────────────────────────────────────────────────────────────────────┐
│ ☰ CheeseStock        삼성전자 검색...     KOSPI 2,547  KOSDAQ 742│
├──────┬──────────────────────────────────────┬──────────────────────┤
│      │ 삼성전자 005930 KOSPI ● LIVE         │ [재무]    패턴       │
│ 종목 │ 54,200  ▼ -800 (-1.45%)              │ ═════               │
│ 목록 │─────────────────────────────────────  │ 2024Q3 연결기준     │
│      │ 1분 5분 15분 30분 1시간 [일봉] │ 캔들 │                     │
│ 200px│──────────────────────────────────── │ 주요손익 지표        │
│      │                                      │ 매출액      67.3조  │
│      │        ┌─────────────┐               │ 영업이익     9.8조  │
│      │        │             │               │ 순이익       7.2조  │
│      │        │   캔들차트   │               │                     │
│      │        │    (확장)    │               │ 수익성 지표         │
│      │        │             │               │ OPM    ROE    EPS   │
│      │        └─────────────┘               │ 14.6%  8.2%  5180  │
│      │ [RSI]                                │                     │
│      │ ─────────────────                    │ 밸류에이션 지표      │
│      │ [MACD]                               │ PER   PBR    PSR   │
│      │ ─────────────────                    │ 10.5  0.97   1.02  │
│      │                                      │            300px   │
└──────┴──────────────────────────────────────┴──────────────────────┘
```

탭 전환 시:

```
                                               │ 재무     [패턴]     │
                                               │          ═════     │
                                               │ ▌ 이브닝스타       │
                                               │ ▌ ──────────      │
                                               │ ▌ 신뢰도 75%      │
                                               │ ▌ ████░           │
                                               │ ▌ 약세 반전 패턴...│
                                               │ ▌ 손절: 55,200    │
                                               │ ▌ 목표: 51,800    │
                                               │                    │
                                               │ ▌ 더블바텀         │
                                               │ ▌ ──────────      │
                                               │ ▌ 신뢰도 82%      │
```

### 7.3 768-1024px (A=드로어, 통합 축소)

```
┌──────────────────────────────────────────┬──────────────┐
│ ☰ CheeseStock      삼성전자...    KOSPI  │ [재무] 패턴  │
│──────────────────────────────────────────│ ═════        │
│ 삼성전자 005930 ● LIVE                    │              │
│ 54,200  ▼ -800 (-1.45%)                  │ 2024Q3       │
│──────────────────────────────────────── │ 매출 67.3조  │
│ 1분 5분 15분 30분 1시간 [일봉] │ 캔들..  │ 영익  9.8조  │
│──────────────────────────────────────── │ 순익  7.2조  │
│                                          │              │
│        ┌─────────────┐                   │ OPM   ROE   │
│        │   캔들차트    │                   │ 14.6% 8.2% │
│        │              │                   │              │
│        └─────────────┘                   │ PER   PBR   │
│ [RSI] ──────────────                     │ 10.5  0.97  │
│                                          │       260px │
└──────────────────────────────────────────┴──────────────┘
```

### 7.4 <768px (탭 바텀시트)

```
┌────────────────────────────┐
│ ☰ CheeseStock  검색...     │
│────────────────────────────│
│ 삼성전자 005930 ● LIVE      │
│ 54,200  ▼ -800 (-1.45%)    │
│────────────────────────────│
│ 1분 5분 15분.. [일봉] 캔들  │
│────────────────────────────│
│                             │
│    ┌─────────────┐          │
│    │   캔들차트    │          │
│    │              │          │
│    │              │          │
│    └─────────────┘          │
│ [RSI] ─────────             │
│                        [≡]  │ ← FAB 버튼
└────────────────────────────┘

      ↓ FAB 클릭 시 ↓

┌────────────────────────────┐
│    ┌─────────────┐          │
│    │   (차트 뒤)   │         │
├────│──── ── ────│──────────┤ ← 그립 핸들
│    └─────────────┘          │
│  [재무]      패턴   ●       │ ← 탭 바 (● = 패턴 감지 dot)
│  ═══════                    │
│  2024Q3 연결기준             │
│  매출액           67.3조    │
│  영업이익          9.8조    │
│  순이익            7.2조    │
│                             │
│  OPM     ROE     EPS       │
│  14.6%   8.2%    5,180     │
│                             │
│  PER     PBR     PSR       │
│  10.5x   0.97x   1.02x    │
│                             │
│  투자판단 72/B              │
└────────────────────────────┘
```

---

## 8. 패턴 패널 토글 버튼 변경

### 8.1 현재 상태

- `#pp-toggle`: 데스크톱에서 C열 접기/펼치기, 모바일에서 슬라이드 오버레이
- 위치: `right: var(--rpanel-w)` (D열 왼쪽 가장자리)

### 8.2 탭 통합 후

- **>1200px**: `#pp-toggle` 기존 동작 유지 (C열 접기/펼치기)
- **<=1200px**: `#pp-toggle` 제거 (탭으로 대체)
- **<768px**: FAB 버튼(`#fin-toggle`)이 통합 바텀시트 열기

```css
@media (max-width: 1200px) {
  #pp-toggle {
    display: none;  /* 탭이 대체 */
  }
  #pp-backdrop {
    display: none;
  }
}
```

---

## 9. app.js 수정 영향 분석

### 9.1 영향받는 함수/IIFE

| 함수 | 현재 동작 | 필요한 변경 |
|------|-----------|------------|
| `initPatternPanelToggle()` | C열 접기/펼치기 + 오버레이 | 탭 전환 로직 추가 |
| `initMobileFinSheet()` | D열 바텀시트 | 통합 탭 바텀시트로 확장 |
| `_applyPpCollapsed()` | C열 그리드 제어 | >1200px에서만 동작하도록 guard |
| `renderPatternPanel()` | C열에 패턴 카드 렌더링 | DOM 대상 분기 (C열 또는 D열 내 탭) |

### 9.2 신규 필요 함수

```javascript
// 탭 전환
function initTabPanel() {
  const tabBar = document.getElementById('rp-tab-bar');
  const tabs = tabBar?.querySelectorAll('.rp-tab');
  const indicator = tabBar?.querySelector('.rp-tab-indicator');

  // 탭 클릭 리스너
  // matchMedia(1200px) change: DOM 이동
  // 인디케이터 위치 업데이트
}
```

### 9.3 주의사항

- `patternPanel.js`의 `renderPatternPanel()`은 `#pp-cards` 컨테이너에 렌더링
- DOM 이동 시 `#pp-cards`가 이동하므로 렌더링 대상은 변하지 않음
- `financials.js`의 `updateFinancials()`는 ID 기반 접근이므로 DOM 구조 변경 없이 동작
- `drawFinTrendChart()`는 `#fin-trend-canvas` 기반 — 탭 전환 시 canvas 리사이즈 필요할 수 있음

---

## 10. 구현 우선순위

### Phase 1: CSS + HTML 구조 (font-ui-designer 소유)
1. `index.html`에 `.rp-tab-bar` DOM 추가
2. `index.html`에 `#rp-pattern-content` 컨테이너 추가
3. `css/style.css`에 탭 바 기본 스타일 추가
4. 미디어 쿼리 수정 (1200px 이하에서 탭 활성화)
5. 768px 바텀시트 내 탭 바 통합

### Phase 2: JS 로직 (app.js 수정 — 협의 필요)
1. 탭 클릭 전환 로직
2. matchMedia 기반 DOM 이동 (`#pp-cards` ↔ `#rp-pattern-content`)
3. 인디케이터 슬라이딩 애니메이션
4. 스크롤 위치 보존
5. 패턴 감지 시 배지 dot 업데이트

### Phase 3: 검증
1. 모든 8개 브레이크포인트에서 레이아웃 확인
2. 탭 전환 시 기존 JS 기능 (재무 업데이트, 패턴 렌더링) 정상 동작 확인
3. ResizeObserver 호환성 확인
4. 한글 텍스트 렌더링 확인 (Pretendard)
5. 성능: 탭 전환 시 layout shift 없는지 확인

---

## 부록: 색상 토큰 참조

| 용도 | CSS 변수 | 값 |
|------|----------|-----|
| 탭 바 배경 | `var(--panel)` | `#141414` |
| 탭 바 하단 보더 | `var(--border)` | `#252525` |
| 비활성 탭 텍스트 | `var(--text-muted)` | `#808080` |
| 호버 탭 텍스트 | `var(--text-sub)` | `#A0A0A0` |
| 활성 탭 텍스트 | `var(--accent)` | `#A08830` |
| 활성 인디케이터 | `var(--accent)` | `#A08830` |
| 패턴 배지 dot | `var(--accent)` | `#A08830` |
