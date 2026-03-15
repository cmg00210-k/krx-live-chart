# KRX Live Chart v5.0 — 전면 재구축 설계안

> 작성일: 2026-03-15
> 작성자: Font/UI Designer Agent
> 상태: 설계 단계 (구현 전)
> 벤치마크: investing.com, TradingView, Bloomberg Terminal, 네이버증권

---

## 목차

1. [현재 상태 분석](#1-현재-상태-분석)
2. [목표 아키텍처: 4열 레이아웃](#2-목표-아키텍처-4열-레이아웃)
3. [CSS Grid 설계](#3-css-grid-설계)
4. [A열: 좌측 메뉴 (접이식)](#4-a열-좌측-메뉴-접이식)
5. [B열: 차트 + 하단 수익률](#5-b열-차트--하단-수익률)
6. [C열: 기술적 패턴 설명 (신규)](#6-c열-기술적-패턴-설명-신규)
7. [D열: 손익지표 (확대)](#7-d열-손익지표-확대)
8. [폰트/서식 시스템 전면 재설계](#8-폰트서식-시스템-전면-재설계)
9. [CSS 변수 체계 v5.0](#9-css-변수-체계-v50)
10. [반응형 전략](#10-반응형-전략)
11. [HTML 구조 변경 명세](#11-html-구조-변경-명세)
12. [app.js 영향 분석](#12-appjs-영향-분석)
13. [구현 로드맵](#13-구현-로드맵)

---

## 1. 현재 상태 분석

### 현재 레이아웃 (v4.0, 3열)
```
[사이드바 210px] [차트 영역 1fr] [재무 패널 220px]
```

### 문제점
| 문제 | 상세 |
|------|------|
| 차트 비중 과다 | 1fr이 화면 대부분 차지, 캔들 수백 개 표시 — 패턴 인식 어려움 |
| 패턴 가시성 부족 | patternRenderer가 Canvas 위에 도형만 그림 — 교과서적 설명 없음 |
| 재무 패널 협소 | 220px에 모든 재무 지표 압축 — fundamental analysis 불충분 |
| 과거 수익률 부재 | 패턴 발생 이후 실제 수익률 통계를 시각적으로 보여주지 않음 |
| 패턴별 종목 탐색 불가 | 사이드바가 시가총액순 정렬만 — 패턴 기반 필터링 없음 |
| 폰트 체계 단조 | 5단계 크기 (10-24px)만 정의 — 계층 구분 미흡 |

### 유지할 것
- 한국식 색상 체계 (상승=빨강, 하락=파랑)
- Pretendard + JetBrains Mono 폰트 스택
- 다크 테마 기조 (#0A0A0A 배경)
- Lightweight Charts v4.2.3 기반 차트
- 접이식 사이드바 메커니즘
- 스크롤바 없는 UI 정책 (feedback_no_scrollbar.md)

---

## 2. 목표 아키텍처: 4열 레이아웃

### 구조 개요
```
┌─────────┬──────────────────────┬───────────────┬────────────────┐
│  A열    │       B열            │     C열       │      D열       │
│ 좌측메뉴 │   차트 + 수익률      │ 기술적 패턴   │   손익지표     │
│ (접이식) │                      │    설명       │ (fundamental)  │
│         │                      │              │               │
│ 180px   │   나머지 공간        │   260px      │    300px      │
│         │   (min 400px)        │              │               │
└─────────┴──────────────────────┴───────────────┴────────────────┘
```

### investing.com 참조 포인트
investing.com 종목 페이지는 다음 영역으로 구성됨:
- **좌측**: 종목 목록/네비게이션 (접이식)
- **중앙**: 차트 + 기술적 분석 요약 + 뉴스
- **우측 상단**: 가격/등락률 카드
- **우측 하단**: 재무 데이터 (Income Statement, Balance Sheet, Cash Flow 탭)
- **차트 하단**: 기술 지표 요약 테이블 (MA, 오실레이터 매수/매도 판단)

KRX v5.0은 이 구조를 4열 그리드로 재해석하되, 패턴 교육 열(C열)을 추가하여 차별화함.

### Bloomberg Terminal 참조 포인트
Bloomberg Terminal은 4개 Panel로 구성되며, 각 Panel이 독립 명령줄을 가짐:
- 밀도 높은 정보 배치 (1px 여백도 활용)
- 밝은 색상 텍스트 on 검은 배경 — 고대비
- 모노스페이스 숫자 정렬이 핵심

---

## 3. CSS Grid 설계

### 3.1 기본 Grid (1440px+)

```css
/* ═══ v5.0 4열 그리드 ═══ */
#main {
  display: grid;
  grid-template-columns:
    minmax(0, var(--sidebar-w))     /* A열: 좌측 메뉴 */
    minmax(400px, 1fr)              /* B열: 차트 + 수익률 */
    var(--pattern-panel-w)          /* C열: 기술적 패턴 설명 */
    var(--rpanel-w);                /* D열: 손익지표 */
  grid-template-rows: 1fr;
  height: calc(100vh - var(--header-h));
  gap: 0;
  transition: grid-template-columns .25s ease;
}

/* 사이드바 접힘 */
#main.sidebar-collapsed {
  grid-template-columns:
    var(--sidebar-collapsed)
    minmax(400px, 1fr)
    var(--pattern-panel-w)
    var(--rpanel-w);
}
```

### 3.2 Grid 영역 명시 배치

```css
#sidebar        { grid-column: 1; grid-row: 1; }
#chart-area     { grid-column: 2; grid-row: 1; }
#pattern-panel  { grid-column: 3; grid-row: 1; }  /* 신규 */
#right-panel    { grid-column: 4; grid-row: 1; }
```

### 3.3 너비 변수 (v5.0)

```css
:root {
  /* 레이아웃 */
  --header-h:          44px;
  --toolbar-h:         34px;
  --sidebar-w:         180px;     /* 210px → 180px 축소 */
  --sidebar-collapsed: 0px;
  --pattern-panel-w:   260px;     /* 신규: 기술적 패턴 설명 열 */
  --rpanel-w:          300px;     /* 220px → 300px 확대 */
}
```

### 3.4 너비 비율 분석 (1920px 기준)

```
전체: 1920px
A열(사이드바):        180px  =  9.4%
B열(차트):           1180px  = 61.5%  (1920 - 180 - 260 - 300)
C열(패턴설명):        260px  = 13.5%
D열(손익지표):        300px  = 15.6%
```

```
전체: 1440px
A열(사이드바):        180px  = 12.5%
B열(차트):            700px  = 48.6%  (1440 - 180 - 260 - 300)
C열(패턴설명):        260px  = 18.1%
D열(손익지표):        300px  = 20.8%
```

사이드바 접힌 경우 (1440px):
```
B열(차트): 880px = 61.1%  — 충분한 차트 공간
```

### 3.5 차트 내부 비율 (2:3 참고)

사용자 요구: "차트와 패턴 사이 간격 2:3 비율"
- 이것은 B열 내부에서 메인 차트 vs 하단 수익률 영역의 비율로 해석
- B열 내부 flex 구성:

```css
#chart-area {
  display: flex;
  flex-direction: column;
}

/* 차트 래퍼: 상단 60% (2/3.33) */
#chart-wrap {
  flex: 2;            /* 2:1 비율에서 차트 부분 */
  min-height: 0;
}

/* 수익률 그래프 영역: 하단 (1/3.33) — 최소 180px */
#return-stats-area {
  flex: 1;
  min-height: 180px;
  max-height: 280px;
}
```

실제 계산 (화면 높이 1080px, 헤더 44px = 가용 1036px):
```
stock-header:    56px
chart-toolbar:   34px
chart-wrap:     ~560px  (차트 + 서브차트)
return-stats:   ~220px  (과거 수익률)
나머지 여유:    ~166px  (패턴 요약 바 등)
```

---

## 4. A열: 좌측 메뉴 (접이식)

### 4.1 구조

```
┌──────────────────┐
│ [검색 박스]       │ ← 상단 고정
├──────────────────┤
│ 정렬 기준 선택    │ ← 시가총액순 / 패턴별
│ [시총순 ▼]       │
├──────────────────┤
│ ┌── KOSPI ─────┐ │
│ │ 삼성전자 73,400│ │
│ │ SK하이닉스    │ │
│ │ ...           │ │
│ └──────────────┘ │
│ ┌── KOSDAQ ────┐ │
│ │ 에코프로비엠  │ │
│ │ ...           │ │
│ └──────────────┘ │
└──────────────────┘
```

### 4.2 검색 박스 (상단 고정)

```html
<div id="sidebar">
  <!-- 신규: 사이드바 내부 검색 -->
  <div class="sb-search">
    <input id="sb-search-input" type="text"
           placeholder="종목명/코드 검색..."
           autocomplete="off">
  </div>

  <!-- 신규: 정렬 기준 선택 -->
  <div class="sb-sort-bar">
    <button class="sb-sort-btn active" data-sort="mcap">시총순</button>
    <button class="sb-sort-btn" data-sort="pattern">패턴별</button>
    <button class="sb-sort-btn" data-sort="change">등락률</button>
  </div>

  <!-- 기존: KOSPI/KOSDAQ 섹션 -->
  <div class="sb-section" data-section="kospi">...</div>
  <div class="sb-section" data-section="kosdaq">...</div>
</div>
```

### 4.3 CSS

```css
/* ── 사이드바 v5.0 ── */
#sidebar {
  background: var(--panel);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  width: var(--sidebar-w);           /* 180px */
  min-width: 0;
  overflow: hidden;
  transition: width .25s ease;
}

/* 사이드바 내부 검색 */
.sb-search {
  padding: var(--sp-2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sb-search input {
  width: 100%;
  height: 28px;
  background: var(--bg-element);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0 var(--sp-2);
  color: var(--text);
  font-size: var(--fs-caption);      /* 11px */
  font-family: var(--font-sans);
  outline: none;
  transition: border-color var(--transition);
}
.sb-search input:focus {
  border-color: var(--accent);
}
.sb-search input::placeholder {
  color: var(--text-muted);
}

/* 정렬 기준 바 */
.sb-sort-bar {
  display: flex;
  gap: 2px;
  padding: var(--sp-1) var(--sp-2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-element);
}
.sb-sort-btn {
  flex: 1;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius);
  padding: 3px 0;
  color: var(--text-muted);
  font-size: 9px;                    /* 아주 작게 — 공간 절약 */
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition);
  text-align: center;
  letter-spacing: 0.02em;
}
.sb-sort-btn:hover {
  color: var(--text);
  background: var(--bg-elevated);
}
.sb-sort-btn.active {
  color: var(--accent);
  background: rgba(201,168,76,0.12);
  border-color: rgba(201,168,76,0.3);
}
```

### 4.4 패턴별 정렬 모드

"패턴별" 정렬 활성화 시, 종목 목록이 다음처럼 재구성됨:

```
┌──────────────────┐
│ 검색...           │
│ [시총순] [패턴별] │
├──────────────────┤
│ ▼ 이중바닥 (3)   │ ← 패턴 이름 + 발생 종목 수
│   삼성전자  +2.1% │
│   SK하이닉스 -0.3%│
│   현대차    +1.5% │
│ ▼ 상승쐐기 (2)   │
│   NAVER    +0.8% │
│   카카오   -1.2% │
│ ▼ 망치형 (5)     │
│   ...             │
└──────────────────┘
```

### 4.5 종목 아이템 (180px 최적화)

180px은 210px 대비 30px 좁으므로, 종목명 최대 너비를 줄이고 가격만 우측 표시:

```css
/* 180px 사이드바용 종목 아이템 */
.sb-item {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  padding: 6px var(--sp-2);          /* sp-3 → sp-2 축소 */
  gap: 1px var(--sp-1);
  min-height: 36px;                  /* 42px → 36px 축소 */
  border-left: 2px solid transparent;
  cursor: pointer;
  font-size: var(--fs-caption);      /* 12px → 11px */
  transition: background .12s;
}
.sb-name {
  max-width: 88px;                   /* 110px → 88px 축소 */
  font-size: var(--fs-caption);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-price {
  font-family: var(--font-mono);
  font-size: 10px;                   /* 11px → 10px */
  font-weight: 600;
  text-align: right;
  min-width: 52px;                   /* 60px → 52px 축소 */
}
```

---

## 5. B열: 차트 + 하단 수익률

### 5.1 캔들 10-15개 기본 표시

Lightweight Charts의 `setVisibleLogicalRange()`를 사용하여 초기 로드 시 마지막 15개 캔들만 표시:

```javascript
// chart.js 또는 app.js에서
const totalCandles = candles.length;
chart.timeScale().setVisibleLogicalRange({
  from: totalCandles - 15,
  to: totalCandles - 1
});
```

이 설정은 CSS가 아닌 JS 로직이지만, 캔들 크기가 충분히 커져서 패턴이 교과서처럼 뚜렷하게 보임.

### 5.2 차트 영역 내부 구조

```
┌──────────────────────────────────┐
│ stock-header (종목명, 가격, OHLC) │ 56px
├──────────────────────────────────┤
│ chart-toolbar (타임프레임, 지표)   │ 34px
├──────────────────────────────────┤
│                                  │
│        메인 차트 캔들             │ flex: 2
│  (캔들 10-15개, 패턴 오버레이)    │ min-height: 280px
│                                  │
├──────────────────────────────────┤
│ pattern-summary-bar              │ 28px
├──────────────────────────────────┤
│ RSI 서브차트 (선택적)             │ 100px
├──────────────────────────────────┤
│ MACD 서브차트 (선택적)            │ 100px
├──────────────────────────────────┤
│                                  │
│   과거 수익률 열/행 그래프        │ flex: 1
│   (패턴 발생 후 수익률 통계)      │ min: 180px, max: 260px
│                                  │
└──────────────────────────────────┘
```

### 5.3 과거 수익률 영역 (신규: #return-stats-area)

네이버증권의 투자지표 테이블 스타일 참조 + 바 차트 시각화:

```html
<!-- B열 하단: 과거 패턴 수익률 통계 -->
<div id="return-stats-area">
  <div class="rs-header">
    <span class="rs-title">패턴 발생 후 수익률</span>
    <div class="rs-period-tabs">
      <button class="rs-tab active" data-period="5d">5일</button>
      <button class="rs-tab" data-period="10d">10일</button>
      <button class="rs-tab" data-period="20d">20일</button>
    </div>
  </div>
  <div class="rs-body">
    <!-- JS에서 동적 생성: 패턴별 수익률 바 -->
    <div class="rs-grid" id="rs-grid">
      <!-- 예시 구조 (JS 렌더링) -->
      <!--
      <div class="rs-row">
        <span class="rs-pattern-name">이중바닥</span>
        <div class="rs-bar-wrap">
          <div class="rs-bar up" style="width: 72%"></div>
        </div>
        <span class="rs-return up">+3.2%</span>
        <span class="rs-winrate">승률 68%</span>
        <span class="rs-count">N=47</span>
      </div>
      -->
    </div>
  </div>
  <div class="rs-footer">
    <span class="rs-note">* 과거 수익률은 미래 수익을 보장하지 않습니다</span>
  </div>
</div>
```

### 5.4 수익률 바 CSS

```css
/* ═══ 과거 수익률 영역 ═══ */
#return-stats-area {
  flex-shrink: 0;
  min-height: 180px;
  max-height: 260px;
  border-top: 2px solid var(--border);
  background: var(--panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;                   /* 스크롤 없는 UI */
}

.rs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.rs-title {
  font-size: var(--fs-caption);
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.03em;
}
.rs-period-tabs {
  display: flex;
  gap: 2px;
}
.rs-tab {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius);
  padding: 2px var(--sp-2);
  color: var(--text-muted);
  font-size: var(--fs-micro);        /* 10px */
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition);
}
.rs-tab.active {
  color: var(--accent);
  background: rgba(201,168,76,0.12);
  border-color: rgba(201,168,76,0.3);
}

.rs-body {
  flex: 1;
  padding: var(--sp-2) var(--sp-3);
  overflow: hidden;
}

/* 수익률 행 그리드 — 네이버증권 테이블 참조 */
.rs-grid {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.rs-row {
  display: grid;
  grid-template-columns: 80px 1fr 56px 50px 40px;
  align-items: center;
  gap: var(--sp-2);
  height: 24px;
}
.rs-pattern-name {
  font-size: var(--fs-caption);
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rs-bar-wrap {
  height: 14px;
  background: var(--bg-element);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}
.rs-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
  min-width: 2px;
}
.rs-bar.up { background: var(--up); opacity: 0.7; }
.rs-bar.dn { background: var(--down); opacity: 0.7; }
.rs-return {
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  font-weight: 700;
  text-align: right;
}
.rs-return.up { color: var(--up); }
.rs-return.dn { color: var(--down); }
.rs-winrate {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-sub);
  text-align: right;
}
.rs-count {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  text-align: right;
}

.rs-footer {
  padding: var(--sp-1) var(--sp-3);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.rs-note {
  font-size: 8px;
  color: var(--text-muted);
  font-style: italic;
}
```

### 5.5 캔들 위 패턴 교과서 스타일 표시

현재 `patternRenderer`는 Canvas에 도형(직사각형, 폴리라인)만 그림.
교과서 스타일로 개선하려면 다음 요소를 추가:

1. **패턴 영역 배경 하이라이트**: 패턴이 걸치는 캔들 범위에 반투명 배경
2. **패턴 이름 라벨**: 해당 영역 상단에 패턴 이름 텍스트
3. **방향 화살표**: 매수/매도 방향을 가리키는 곡선 화살표
4. **목표가/손절 수평선**: 점선으로 목표가/손절가 표시

이것은 `patternRenderer.js` (chart.js 팀 소유)의 변경이 필요하므로 **협의 대상**.
CSS/HTML 측에서는 패턴 오버레이 스타일만 정의:

```css
/* patternRenderer Canvas 위 오버레이 스타일 가이드 */
/* (실제 구현은 Canvas2D API로 patternRenderer.js에서 수행) */

/* 색상 가이드:
   매수 패턴 배경: rgba(224, 80, 80, 0.06)
   매도 패턴 배경: rgba(80, 134, 220, 0.06)
   패턴 이름 텍스트: Pretendard 11px Bold, #fff
   목표가 점선: var(--up) 또는 var(--down), 1px dashed
   방향 화살표: 3px solid, 동일 색상
*/
```

---

## 6. C열: 기술적 패턴 설명 (신규)

### 6.1 개요

이 열은 **교과서 역할**을 함: 현재 감지된 패턴 2-3개의 상세한 기술적 설명을 제공.

### 6.2 구조

```
┌──────────────────────┐
│ 기술적 패턴 분석       │ ← 헤더 (accent 색상)
├──────────────────────┤
│                      │
│ ┌── 패턴 카드 1 ────┐ │
│ │ ● 이중바닥         │ │ ← 패턴 이름 + 신호(매수/매도)
│ │ ─────────────     │ │
│ │ [미니 다이어그램]   │ │ ← Canvas/SVG 교과서 패턴 도형
│ │                    │ │
│ │ 두 개의 저점이...  │ │ ← 패턴 설명 (2-3줄)
│ │                    │ │
│ │ 신뢰도: ████░ 78% │ │ ← 진행 바
│ │ 발생빈도: 12회/년  │ │
│ │ 평균수익: +3.2%    │ │ ← 과거 통계
│ │ 승률: 68%          │ │
│ └──────────────────┘ │
│                      │
│ ┌── 패턴 카드 2 ────┐ │
│ │ ● 상승쐐기         │ │
│ │ ...                │ │
│ └──────────────────┘ │
│                      │
│ ┌── 합류 분석 ──────┐ │
│ │ MA + RSI 일치     │ │ ← 여러 지표 합류 요약
│ │ 종합 점수: 7.2/10 │ │
│ └──────────────────┘ │
│                      │
│ [패턴이 없으면]       │
│ "현재 감지된 패턴    │
│  없음. 다른 종목을   │
│  선택하거나 타임      │
│  프레임을 변경해      │
│  보세요."            │
└──────────────────────┘
```

### 6.3 HTML 구조

```html
<!-- C열: 기술적 패턴 설명 패널 (신규) -->
<div id="pattern-panel">
  <div class="pp-header">기술적 패턴 분석</div>
  <div class="pp-content" id="pp-content">
    <!-- JS에서 동적 생성 — 최대 3개 패턴 카드 -->

    <!-- 패턴 카드 템플릿 -->
    <!--
    <div class="pp-card buy">
      <div class="pp-card-header">
        <span class="pp-card-signal buy">매수</span>
        <span class="pp-card-name">이중바닥 (Double Bottom)</span>
      </div>
      <div class="pp-card-diagram">
        <canvas class="pp-diagram-canvas" width="220" height="80"></canvas>
      </div>
      <div class="pp-card-desc">
        두 개의 비슷한 저점을 형성한 후 목선(neckline)을 돌파하며
        상승 반전을 시사하는 강력한 매수 신호입니다.
      </div>
      <div class="pp-card-stats">
        <div class="pp-stat-row">
          <span class="pp-stat-label">신뢰도</span>
          <div class="pp-stat-bar-wrap">
            <div class="pp-stat-bar" style="width:78%"></div>
          </div>
          <span class="pp-stat-value">78%</span>
        </div>
        <div class="pp-stat-row">
          <span class="pp-stat-label">발생빈도</span>
          <span class="pp-stat-value">12회/년</span>
        </div>
        <div class="pp-stat-row">
          <span class="pp-stat-label">평균수익</span>
          <span class="pp-stat-value up">+3.2%</span>
        </div>
        <div class="pp-stat-row">
          <span class="pp-stat-label">승률</span>
          <span class="pp-stat-value">68%</span>
        </div>
      </div>
    </div>
    -->

    <!-- 합류 분석 (confluence) -->
    <!--
    <div class="pp-confluence">
      <div class="pp-confluence-title">합류 분석 (Confluence)</div>
      <div class="pp-confluence-items">
        <div class="pp-conf-item match">MA 골든크로스 일치</div>
        <div class="pp-conf-item match">RSI 과매도 탈출 확인</div>
        <div class="pp-conf-item miss">MACD 미확인</div>
      </div>
      <div class="pp-conf-score">
        종합: <span class="pp-score-value">7.2</span>/10
      </div>
    </div>
    -->

    <!-- 빈 상태 -->
    <div class="pp-empty" id="pp-empty">
      현재 감지된 패턴이 없습니다.<br>
      다른 종목을 선택하거나<br>
      타임프레임을 변경해 보세요.
    </div>
  </div>
</div>
```

### 6.4 CSS (C열)

```css
/* ═══ C열: 기술적 패턴 설명 패널 ═══ */
#pattern-panel {
  background: var(--panel);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pp-header {
  padding: var(--sp-3);
  font-size: var(--fs-title);        /* 14px */
  font-weight: 700;
  color: var(--accent);
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.pp-content {
  flex: 1;
  padding: var(--sp-2);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  overflow: hidden;                   /* 스크롤 없는 UI */
}

/* ── 패턴 카드 ── */
.pp-card {
  background: var(--bg-element);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: var(--sp-2) var(--sp-3);
  border-left: 3px solid var(--text-muted);
  transition: border-color var(--transition);
}
.pp-card.buy { border-left-color: var(--up); }
.pp-card.sell { border-left-color: var(--down); }
.pp-card.neutral { border-left-color: var(--neutral); }

.pp-card-header {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}
.pp-card-signal {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.pp-card-signal.buy {
  background: rgba(224,80,80,0.15);
  color: var(--up);
}
.pp-card-signal.sell {
  background: rgba(80,134,220,0.15);
  color: var(--down);
}
.pp-card-signal.neutral {
  background: rgba(255,235,59,0.15);
  color: var(--neutral);
}
.pp-card-name {
  font-size: var(--fs-body);         /* 12px */
  font-weight: 700;
  color: #fff;
}

/* 교과서 패턴 다이어그램 */
.pp-card-diagram {
  margin: var(--sp-1) 0;
  background: var(--bg);
  border-radius: var(--radius);
  padding: var(--sp-1);
  display: flex;
  justify-content: center;
}
.pp-diagram-canvas {
  width: 100%;
  height: 70px;
  display: block;
}

/* 패턴 설명 텍스트 */
.pp-card-desc {
  font-size: var(--fs-caption);      /* 11px */
  color: var(--text-sub);
  line-height: 1.6;
  margin-bottom: var(--sp-2);
  /* 3줄 제한 — 스크롤 방지 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 통계 행 */
.pp-card-stats {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.pp-stat-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.pp-stat-label {
  font-size: 9px;
  color: var(--text-muted);
  min-width: 48px;
  flex-shrink: 0;
}
.pp-stat-bar-wrap {
  flex: 1;
  height: 4px;
  background: var(--bg);
  border-radius: 2px;
  overflow: hidden;
}
.pp-stat-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.4s ease;
}
.pp-stat-value {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--text);
  min-width: 36px;
  text-align: right;
}
.pp-stat-value.up { color: var(--up); }
.pp-stat-value.dn { color: var(--down); }

/* ── 합류 분석 ── */
.pp-confluence {
  background: var(--bg-element);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: var(--sp-2) var(--sp-3);
  margin-top: auto;                  /* 하단 고정 */
}
.pp-confluence-title {
  font-size: var(--fs-micro);
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: var(--sp-2);
}
.pp-confluence-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pp-conf-item {
  font-size: 10px;
  padding: 2px 0;
  position: relative;
  padding-left: 14px;
}
.pp-conf-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.pp-conf-item.match {
  color: var(--text);
}
.pp-conf-item.match::before {
  background: rgba(76, 175, 80, 0.6);
}
.pp-conf-item.miss {
  color: var(--text-muted);
}
.pp-conf-item.miss::before {
  background: rgba(244, 67, 54, 0.4);
}
.pp-conf-score {
  margin-top: var(--sp-2);
  padding-top: var(--sp-1);
  border-top: 1px solid var(--border-subtle);
  font-size: var(--fs-caption);
  color: var(--text-sub);
}
.pp-score-value {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: var(--fs-title);
  color: var(--accent);
}

/* ── 빈 상태 ── */
.pp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: var(--fs-caption);
  line-height: 1.8;
  text-align: center;
  padding: var(--sp-4);
}

/* 높이 예산 (1080p 기준, 가용 1036px):
   pp-header:              42px
   pp-card (패턴 1):      ~220px  (헤더20 + 다이어그램80 + 설명50 + 통계70)
   pp-card (패턴 2):      ~220px
   pp-confluence:         ~120px
   여유/gap:               ~40px
   합계:                  ~642px  < 1036px -- 충분
   ※ 패턴 3개 표시 시 다이어그램 생략하여 공간 확보
*/
```

### 6.5 교과서 패턴 다이어그램 (Canvas)

각 패턴 카드 안의 `.pp-diagram-canvas`에 교과서 스타일 패턴 다이어그램을 그림.
이것은 **app.js에 새 함수 추가** 또는 별도 `patternDiagram.js` 파일 필요:

```
이중바닥:  V 형태 두 개 → W 모양
상승쐐기:  수렴하는 두 추세선 (상향)
헤드앤숄더: 세 봉우리 (가운데 높음)
망치형:    짧은 몸통 + 긴 아래꼬리
잉태형:    큰 캔들 안에 작은 캔들
```

색상 가이드:
- 캔들 몸통: `var(--text)` (중립), `var(--up)` (상승), `var(--down)` (하락)
- 추세선: `var(--accent)` 1px solid
- 목선/지지선: `var(--text-muted)` 1px dashed
- 화살표: 매수=`var(--up)`, 매도=`var(--down)`

---

## 7. D열: 손익지표 (확대)

### 7.1 너비 확대: 220px -> 300px

300px에서 가능해지는 추가 콘텐츠:
- 2x2 그리드 → 2x3 또는 3x2 그리드 (더 많은 지표)
- 바 차트 더 넓게 표시
- PER, PBR 밸류에이션 지표 추가
- 배당 정보 추가

### 7.2 구조

```
┌──────────────────────────────┐
│ 주요재무지표                  │ ← 헤더
├──────────────────────────────┤
│ 2024 Q4 | 연결기준           │ ← 기간
├──────────────────────────────┤
│ ▎ 주요손익지표                │ ← 섹션
│ 매출액          758,900 억    │
│   YoY -4.1%    QoQ +0.2%    │
│ 영업이익          64,400 억   │
│   YoY -29.9%   QoQ +5.1%   │
│ 순이익            52,380 억   │
│   YoY -28.3%   QoQ -1.2%   │
├──────────────────────────────┤
│ ▎ 수익성 지표                 │ ← 섹션
│ ┌────────┬────────┬────────┐ │
│ │ OPM ⓘ │ ROE ⓘ │ ROA ⓘ │ │
│ │ 8.5%   │ 7.5%  │ 3.2%  │ │
│ ├────────┼────────┼────────┤ │
│ │ EPS ⓘ │ BPS ⓘ │ NPM ⓘ │ │
│ │ 780    │32,400 │ 6.9%  │ │
│ └────────┴────────┴────────┘ │
├──────────────────────────────┤
│ ▎ 밸류에이션                  │ ← 신규 확장
│ ┌────────┬────────┬────────┐ │
│ │ PER    │ PBR    │ PSR   │ │
│ │ 12.3x  │ 1.2x  │ 1.8x  │ │
│ ├────────┼────────┼────────┤ │
│ │ EV/    │ 부채   │ 배당   │ │
│ │ EBITDA │ 비율   │ 수익률 │ │
│ │ 8.7x   │ 42%   │ 2.1%  │ │
│ └────────┴────────┴────────┘ │
├──────────────────────────────┤
│ ▎ 추이 [매출] [영익] [EPS]   │ ← 탭 전환 바차트
│ ┌────────────────────────┐   │
│ │ ████ ████ ████ ████    │   │
│ │ Q1   Q2   Q3   Q4     │   │
│ └────────────────────────┘   │
├──────────────────────────────┤
│ 영업이익률 추이 (스파크라인)  │
│ ┌────────────────────────┐   │
│ │ ~~~~~/\~~~~            │   │
│ └────────────────────────┘   │
├──────────────────────────────┤
│ 면책 조항 ▾                   │
│ 출처: DART 전자공시           │
└──────────────────────────────┘
```

### 7.3 CSS (D열 확장)

```css
/* ═══ D열: 손익지표 패널 (300px) ═══ */
#right-panel {
  background: var(--panel);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: var(--rpanel-w);            /* 300px */
}

/* 수익성 지표: 2x2 → 3x2 그리드 */
.fin-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;  /* 2열 → 3열 */
  gap: var(--sp-1);                     /* sp-2 → sp-1 밀도 증가 */
  margin-top: var(--sp-1);
}

.fin-grid-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sp-1) var(--sp-2);   /* 약간 축소 */
  background: var(--bg-element);
  border-radius: var(--radius);
}

/* 추이 차트: 300px 너비에서 더 넓은 바 */
#fin-trend-canvas {
  width: 100%;
  height: 75px;                       /* 70px → 75px */
}

/* 높이 예산 (300px 너비, 1080p 기준):
   rp-header:           42px
   fin-period-row:      24px
   주요손익지표 섹션:   ~140px  (3행 x 2줄)
   수익성 3x2 그리드:   ~80px
   밸류에이션 3x2:      ~80px
   추이 차트:          ~100px
   OPM 스파크라인:      ~60px
   면책/출처:           ~40px
   합계:               ~566px  < 1036px 가용
*/
```

### 7.4 밸류에이션 섹션 (신규)

```html
<!-- 밸류에이션 (신규 확장) -->
<div class="fin-section-title">밸류에이션</div>
<div class="fin-grid">
  <div class="fin-grid-item">
    <span class="fin-grid-label">PER <span class="fin-info" data-tooltip="주가수익비율. 주가를 EPS로 나눈 값. 동종업종 대비 고평가/저평가 판단에 사용합니다.">&#9432;</span></span>
    <span class="fin-grid-value" id="fin-per">&mdash;</span>
  </div>
  <div class="fin-grid-item">
    <span class="fin-grid-label">PBR <span class="fin-info" data-tooltip="주가순자산비율. 주가를 BPS로 나눈 값. 1배 미만이면 자산 대비 저평가로 볼 수 있습니다.">&#9432;</span></span>
    <span class="fin-grid-value" id="fin-pbr">&mdash;</span>
  </div>
  <div class="fin-grid-item">
    <span class="fin-grid-label">PSR <span class="fin-info" data-tooltip="주가매출비율. 시가총액을 매출액으로 나눈 값. 적자 기업 밸류에이션에 유용합니다.">&#9432;</span></span>
    <span class="fin-grid-value" id="fin-psr">&mdash;</span>
  </div>
  <div class="fin-grid-item">
    <span class="fin-grid-label">EV/EBITDA <span class="fin-info" data-tooltip="기업가치 대비 세전영업이익. 기업의 인수 매력도를 평가하는 핵심 지표입니다.">&#9432;</span></span>
    <span class="fin-grid-value" id="fin-ev-ebitda">&mdash;</span>
  </div>
  <div class="fin-grid-item">
    <span class="fin-grid-label">부채비율 <span class="fin-info" data-tooltip="부채총계를 자본총계로 나눈 비율. 200% 이하가 안정적이며 업종별로 차이가 있습니다.">&#9432;</span></span>
    <span class="fin-grid-value" id="fin-debt-ratio">&mdash;</span>
  </div>
  <div class="fin-grid-item">
    <span class="fin-grid-label">배당률 <span class="fin-info" data-tooltip="주당배당금을 현재 주가로 나눈 비율. 안정적인 배당주 선별에 활용합니다.">&#9432;</span></span>
    <span class="fin-grid-value" id="fin-div-yield">&mdash;</span>
  </div>
</div>
```

---

## 8. 폰트/서식 시스템 전면 재설계

### 8.1 현재 vs 목표 타이포그래피 스케일

현재 (v4.0):
```
--fs-display: 24px   (현재가)
--fs-title:   14px   (섹션 제목)
--fs-body:    12px   (본문)
--fs-caption: 11px   (부가)
--fs-micro:   10px   (최소)
```

목표 (v5.0) — 8단계 스케일:
```
--fs-hero:     28px   (신규: 종목 현재가 — 더 강조)
--fs-display:  20px   (종목명 등 큰 제목)
--fs-heading:  16px   (신규: 섹션 제목, 패널 헤더)
--fs-title:    14px   (부제목, 라벨)
--fs-body:     12px   (기본 본문)
--fs-caption:  11px   (보조 텍스트)
--fs-micro:    10px   (최소 텍스트)
--fs-nano:      9px   (신규: 면책, 출처, 극소 라벨)
```

### 8.2 Font Weight 체계

```css
/* 폰트 가중치 시맨틱 변수 */
:root {
  --fw-regular:   400;
  --fw-medium:    500;
  --fw-semibold:  600;
  --fw-bold:      700;
}
```

사용 가이드:
| 용도 | Weight | 예시 |
|------|--------|------|
| 본문 텍스트 | 400 (Regular) | 패턴 설명, 면책 조항 |
| 라벨, 메뉴 항목 | 500 (Medium) | 종목명, 지표명 |
| 수치, 배지 | 600 (SemiBold) | 가격, 등락률, 섹션 카운트 |
| 헤더, 강조 수치 | 700 (Bold) | 현재가, 패널 제목, 신뢰도 |

### 8.3 Letter Spacing 체계

```css
:root {
  --ls-tight:    -0.03em;   /* 큰 숫자 (현재가, 24px+) */
  --ls-normal:    0;         /* 기본 본문 */
  --ls-wide:      0.03em;   /* 중간 라벨 (영문 대문자) */
  --ls-wider:     0.06em;   /* 섹션 제목 (uppercase) */
}
```

### 8.4 Line Height 체계

```css
:root {
  --lh-tight:    1.1;   /* 큰 숫자 표시 (현재가) */
  --lh-normal:   1.4;   /* 기본 본문 */
  --lh-relaxed:  1.6;   /* 설명 텍스트 (패턴 설명, 면책) */
  --lh-loose:    1.8;   /* 교육적 콘텐츠 */
}
```

### 8.5 숫자 표시 규칙 (investing.com 참조)

| 데이터 종류 | 폰트 | 크기 | 색상 | 예시 |
|------------|-------|------|------|------|
| 현재가 | JetBrains Mono Bold | 28px | up/down | `73,400` |
| 등락률 | JetBrains Mono Bold | 14px | up/down (배경 tint) | `+1.66%` |
| OHLCV | JetBrains Mono Bold | 12px | text/up/down | `73,400` |
| 재무 금액 (억) | JetBrains Mono Bold | 14px | text | `758,900` |
| 재무 비율 (%) | JetBrains Mono Bold | 12px | up/down | `8.5%` |
| 재무 변화율 | JetBrains Mono SemiBold | 10px | up/down | `YoY -4.1%` |
| 사이드바 가격 | JetBrains Mono SemiBold | 10px | up/down | `73,400` |
| 패턴 신뢰도 | JetBrains Mono Bold | 11px | accent | `78%` |
| 수익률 | JetBrains Mono Bold | 11px | up/down | `+3.2%` |
| 종목코드 | JetBrains Mono Regular | 10px | text-muted | `005930` |

### 8.6 한글 텍스트 규칙 (Pretendard)

| 데이터 종류 | Weight | 크기 | 색상 | 예시 |
|------------|--------|------|------|------|
| 종목명 (헤더) | 700 | 20px | #fff | `삼성전자` |
| 종목명 (사이드바) | 500 | 11px | text | `삼성전자` |
| 패널 제목 | 700 | 16px | accent | `주요재무지표` |
| 섹션 제목 | 600 | 10px (uppercase) | text-muted | `수익성` |
| 패턴 이름 | 700 | 12px | #fff | `이중바닥` |
| 패턴 설명 | 400 | 11px | text-sub | `두 개의 저점이...` |
| 지표 라벨 | 500 | 10px | text-muted | `영업이익률` |
| 면책 조항 | 400 | 9px | text-muted | `본 데이터는...` |
| 버튼 텍스트 | 500 | 11px | text-muted/active | `일봉` |

### 8.7 간격 체계 확장

현재 5단계 → 7단계로 확장:

```css
:root {
  --sp-0:  2px;    /* 신규: 극소 (아이콘-텍스트 간격) */
  --sp-1:  4px;    /* 인라인 간격 */
  --sp-2:  8px;    /* 요소 내부 패딩 */
  --sp-3: 12px;    /* 패널 패딩 */
  --sp-4: 16px;    /* 섹션 간격 */
  --sp-5: 24px;    /* 대형 간격 */
  --sp-6: 32px;    /* 신규: 섹션 분리 (거의 안 씀) */
}
```

### 8.8 테두리/구분선 체계

```css
:root {
  /* 기존 */
  --border:        #252525;
  --border-subtle:  rgba(255,255,255,0.04);

  /* 신규 */
  --border-strong:  #353535;          /* 열 간 구분 (좌/우 패널 경계) */
  --border-accent:  rgba(201,168,76,0.2);  /* 강조 구분선 */
}
```

### 8.9 그림자 체계

```css
:root {
  --shadow-sm:   0 1px 3px rgba(0,0,0,0.3);
  --shadow-md:   0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg:   0 8px 24px rgba(0,0,0,0.5);
  --shadow-tooltip: 0 4px 16px rgba(0,0,0,0.6);
}
```

---

## 9. CSS 변수 체계 v5.0

### 전체 `:root` 블록

```css
:root {
  /* ══ 색상 4계층 ══ */
  --bg:            #0A0A0A;
  --panel:         #141414;
  --bg-element:    #1E1E1E;
  --bg-elevated:   #282828;

  /* ══ 테두리 ══ */
  --border:        #252525;
  --border-subtle: rgba(255,255,255,0.04);
  --border-strong: #353535;
  --border-accent: rgba(201,168,76,0.2);

  /* ══ 시맨틱 색상 (한국식) ══ */
  --accent:        #C9A84C;
  --up:            #E05050;
  --down:          #5086DC;
  --neutral:       #ffeb3b;

  /* ══ 텍스트 3계층 ══ */
  --text:          #E8E8E8;
  --text-sub:      #A0A0A0;
  --text-muted:    #707070;

  /* ══ 폰트 ══ */
  --font-sans:     'Pretendard', 'Segoe UI', sans-serif;
  --font-mono:     'JetBrains Mono', monospace;

  /* ══ 타이포그래피 스케일 (8단계) ══ */
  --fs-hero:       28px;
  --fs-display:    20px;
  --fs-heading:    16px;
  --fs-title:      14px;
  --fs-body:       12px;
  --fs-caption:    11px;
  --fs-micro:      10px;
  --fs-nano:        9px;

  /* ══ 폰트 가중치 ══ */
  --fw-regular:    400;
  --fw-medium:     500;
  --fw-semibold:   600;
  --fw-bold:       700;

  /* ══ 자간 ══ */
  --ls-tight:      -0.03em;
  --ls-normal:      0;
  --ls-wide:        0.03em;
  --ls-wider:       0.06em;

  /* ══ 행간 ══ */
  --lh-tight:      1.1;
  --lh-normal:     1.4;
  --lh-relaxed:    1.6;
  --lh-loose:      1.8;

  /* ══ 간격 (7단계) ══ */
  --sp-0:  2px;
  --sp-1:  4px;
  --sp-2:  8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 24px;
  --sp-6: 32px;

  /* ══ 레이아웃 ══ */
  --header-h:          44px;
  --toolbar-h:         34px;
  --sidebar-w:         180px;
  --sidebar-collapsed:   0px;
  --pattern-panel-w:   260px;
  --rpanel-w:          300px;

  /* ══ 기타 ══ */
  --radius:        4px;
  --radius-lg:     6px;
  --radius-xl:     8px;
  --transition:    .15s ease;
  --min-touch:     28px;

  /* ══ 그림자 ══ */
  --shadow-sm:     0 1px 3px rgba(0,0,0,0.3);
  --shadow-md:     0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg:     0 8px 24px rgba(0,0,0,0.5);
  --shadow-tooltip: 0 4px 16px rgba(0,0,0,0.6);
}
```

변수 총 개수: **57개** (v4.0 ~40개 → v5.0 57개)

---

## 10. 반응형 전략

### 10.1 브레이크포인트 4단계

| 이름 | 너비 | 열 구성 | 숨기는 것 |
|------|------|---------|----------|
| Desktop XL | 1440px+ | 4열 전체 | 없음 |
| Desktop | 1200-1439px | 3열 (C열 축소) | 패턴 다이어그램 |
| Tablet | 1024-1199px | 2열 (A,C열 숨김) | 사이드바, 패턴 패널 |
| Mobile | <1024px | 1열 | 사이드바, 패턴 패널, D열 |

### 10.2 CSS 미디어 쿼리

```css
/* ═══ 반응형 v5.0 ═══ */

/* Desktop (1200-1439px): C열 축소, D열 축소 */
@media (max-width: 1440px) {
  :root {
    --pattern-panel-w: 220px;        /* 260 → 220 */
    --rpanel-w: 260px;               /* 300 → 260 */
  }
  .pp-card-diagram { display: none; } /* 패턴 다이어그램 숨김 */
  .pp-card-desc { -webkit-line-clamp: 2; } /* 2줄 제한 */
  .fin-grid { grid-template-columns: 1fr 1fr; } /* 3열 → 2열 */
}

/* Tablet (1024-1199px): C열 숨김, A열 접힘, D열 축소 */
@media (max-width: 1200px) {
  :root {
    --sidebar-w: 0px;
    --rpanel-w: 220px;
  }
  #main {
    grid-template-columns:
      0px
      minmax(400px, 1fr)
      0px                            /* C열 숨김 */
      minmax(180px, var(--rpanel-w));
  }
  #sidebar { width: 0; border-right: none; }
  #pattern-panel { display: none; }  /* C열 완전 숨김 */
  .ticker-item:last-child { display: none; }
  .sh-details { gap: var(--sp-1); }
  .sh-detail-item { min-width: 56px; }
  .fin-grid { grid-template-columns: 1fr 1fr; }
  #fin-trend-canvas { height: 55px; }
  /* 수익률 영역 축소 */
  #return-stats-area { min-height: 140px; max-height: 200px; }
}

/* Small Tablet / Large Phone (768-1023px): D열도 숨김 */
@media (max-width: 1024px) {
  #main {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  #right-panel { display: none; }
  #pattern-panel { display: none; }
  #sidebar { display: none; }
  .sh-price { font-size: var(--fs-display); }   /* 28→20px */
  .sh-name { font-size: var(--fs-title); }       /* 20→14px */
  #stock-header { min-height: 48px; }
  .sh-details { display: none; }
  #chart-toolbar { flex-wrap: wrap; height: auto; }
  .sub-chart { height: 90px; }
  #main-chart-container { min-height: 220px; }
  /* 수익률 영역 축소 */
  #return-stats-area { min-height: 120px; max-height: 160px; }
  .rs-row { grid-template-columns: 60px 1fr 48px 44px; }
  .rs-count { display: none; }       /* 표본수 숨김 */
}

/* Mobile (<768px) */
@media (max-width: 768px) {
  :root { --header-h: 40px; }
  #header { padding: 0 var(--sp-2); }
  #search-wrap { max-width: none; }
  #ticker-strip { gap: var(--sp-1); }
  .ticker-val { font-size: var(--fs-micro); }
  #return-stats-area { display: none; }  /* 수익률 영역 숨김 */
}
```

### 10.3 최소 너비

```css
#main { min-width: 640px; }
```

4열 전체 표시 최소: `180 + 400 + 260 + 300 = 1140px`
사이드바 접힌 상태: `0 + 400 + 260 + 300 = 960px`

---

## 11. HTML 구조 변경 명세

### 11.1 현재 vs 목표 DOM 트리

```
현재 (v4.0):
body
├── #header
├── #main (3열 grid)
│   ├── #sidebar
│   ├── #chart-area
│   │   ├── #stock-header
│   │   ├── #chart-toolbar
│   │   └── #chart-wrap
│   │       ├── #ohlc-bar
│   │       ├── #main-chart-container
│   │       ├── #pattern-summary-wrap
│   │       ├── #pattern-history-bar
│   │       ├── .sub-chart-wrap (RSI)
│   │       └── .sub-chart-wrap (MACD)
│   └── #right-panel

목표 (v5.0):
body
├── #header
├── #main (4열 grid)
│   ├── #sidebar                     ← 검색+정렬 추가
│   │   ├── .sb-search              [신규]
│   │   ├── .sb-sort-bar            [신규]
│   │   ├── .sb-section (kospi)
│   │   └── .sb-section (kosdaq)
│   ├── #chart-area
│   │   ├── #stock-header
│   │   ├── #chart-toolbar
│   │   └── #chart-wrap
│   │       ├── #ohlc-bar
│   │       ├── #main-chart-container
│   │       ├── #pattern-tooltip
│   │       ├── #pattern-summary-wrap
│   │       ├── .sub-chart-wrap (RSI)
│   │       ├── .sub-chart-wrap (MACD)
│   │       └── #return-stats-area  [신규]
│   ├── #pattern-panel              [신규 열]
│   │   ├── .pp-header
│   │   └── .pp-content
│   │       ├── .pp-card (동적)
│   │       ├── .pp-confluence (동적)
│   │       └── .pp-empty
│   └── #right-panel                 ← 밸류에이션 섹션 추가
│       ├── .rp-header
│       └── #fin-content
│           ├── 주요손익지표
│           ├── 수익성 (3x2 그리드)
│           ├── 밸류에이션 (3x2, 신규)
│           ├── 추이 차트
│           ├── OPM 스파크라인
│           └── 면책/출처
```

### 11.2 신규 요소 ID 충돌 검사

현재 사용 중인 ID (app.js + sidebar.js에서 getElementById 호출):
```
rsi-chart-container, rsi-label, macd-chart-container, macd-label,
main-chart-container, fin-trend-toggle, fin-trend-body,
fin-disclaimer-toggle, fin-disclaimer-body, ohlc-open, ohlc-high,
ohlc-low, ohlc-close, ohlc-vol, live-status, live-label,
stock-name, stock-code, stock-market, stock-price, stock-change,
sh-open, sh-high, sh-low, sh-volume, fin-period, fin-revenue,
fin-rev-yoy, fin-rev-qoq, fin-op, fin-op-yoy, fin-op-qoq,
fin-ni, fin-ni-yoy, fin-ni-qoq, fin-opm, fin-roe, fin-eps, fin-bps,
fin-roa, fin-debt-ratio, fin-npm, opm-sparkline, fin-trend-canvas,
pattern-list, pattern-summary-bar, psb-text, pattern-history-bar,
signal-filter-wrap, signal-filter-toggle, signal-filter-menu,
psb-detail-btn, pattern-detail-popup, pdp-close, pattern-tooltip,
chart-wrap, search-input, search-dropdown, ind-dropdown-toggle,
ind-dropdown-menu, sidebar-toggle, sb-kospi-count, sb-kosdaq-count,
sb-kospi, sb-kosdaq
```

신규 ID (충돌 없음 확인):
```
sb-search-input       — 사이드바 내부 검색
pattern-panel         — C열 패널
pp-content            — C열 콘텐츠
pp-empty              — C열 빈 상태
return-stats-area     — 수익률 영역
rs-grid               — 수익률 그리드
fin-per               — PER 값
fin-pbr               — PBR 값
fin-psr               — PSR 값
fin-ev-ebitda         — EV/EBITDA 값
fin-div-yield         — 배당수익률 값
```

---

## 12. app.js 영향 분석

### 12.1 변경 필요 사항 (app.js — 공유 파일, 협의 필요)

| 기능 | 변경 내용 | 복잡도 |
|------|----------|--------|
| 캔들 수 제한 | `setVisibleLogicalRange({from: N-15, to: N-1})` 호출 추가 | 낮음 |
| 패턴 패널 렌더링 | `renderPatternPanel()` → `#pp-content` 대신 `#pattern-panel` 렌더 | 중간 |
| 수익률 통계 렌더링 | 신규 `renderReturnStats(patterns, period)` 함수 | 높음 |
| 밸류에이션 데이터 | `updateFinancials()`에 PER/PBR/PSR/EV 계산 추가 | 중간 |
| 패턴 다이어그램 | 신규 `drawPatternDiagram(canvas, patternType)` 함수 | 중간 |
| 합류 분석 표시 | 신규 `renderConfluence(patterns, signals)` 함수 | 중간 |

### 12.2 변경 필요 사항 (sidebar.js — 공유 파일, 협의 필요)

| 기능 | 변경 내용 | 복잡도 |
|------|----------|--------|
| 사이드바 내부 검색 | `#sb-search-input` 이벤트 바인딩 + 필터링 | 중간 |
| 정렬 기준 전환 | `.sb-sort-btn` 클릭 → `build()` 재호출 with 정렬 기준 | 중간 |
| 패턴별 정렬 | `patternEngine.analyze()` 결과로 종목 그룹핑 | 높음 |

### 12.3 변경 불필요 (기존 유지)

- `chart.js`: ChartManager 내부 변경 없음 (컨테이너 ID 동일)
- `patternRenderer.js`: 기존 동작 유지 (교과서 스타일은 별도 Canvas)
- `data.js`: 기존 데이터 구조 유지
- `api.js`: 기존 데이터 서비스 유지
- `patterns.js`: 기존 패턴 엔진 유지

---

## 13. 구현 로드맵

### Phase 1: Grid + 폰트 기반 (CSS/HTML만)
**변경 파일**: `css/style.css`, `index.html`
**예상 작업량**: CSS ~300줄 변경, HTML ~50줄 추가

1. CSS 변수 v5.0 적용 (`:root` 블록 교체)
2. `#main` grid 4열 전환
3. `#pattern-panel` DOM 추가 (빈 상태만)
4. `#return-stats-area` DOM 추가 (빈 상태만)
5. 사이드바 검색+정렬 DOM 추가
6. 폰트 스케일 8단계 적용
7. D열 300px 확대 + 밸류에이션 HTML 추가
8. 반응형 미디어 쿼리 4단계 적용

### Phase 2: 패턴 패널 동적 콘텐츠 (app.js 협의)
**변경 파일**: `app.js`, `css/style.css`

1. `renderPatternPanel()` → C열로 리다이렉트
2. 패턴 카드 HTML 동적 생성
3. 합류 분석 표시

### Phase 3: 수익률 통계 (app.js 협의)
**변경 파일**: `app.js`, `css/style.css`

1. `renderReturnStats()` 신규 함수
2. 기간 탭 전환 이벤트
3. 바 차트 렌더링

### Phase 4: 사이드바 고도화 (sidebar.js 협의)
**변경 파일**: `sidebar.js`, `css/style.css`

1. 사이드바 내부 검색 기능
2. 정렬 기준 전환 (시총순/패턴별/등락률)
3. 패턴별 그룹핑 로직

### Phase 5: 교과서 패턴 다이어그램 (신규 파일 또는 app.js)
**변경 파일**: `patternDiagram.js` (신규) 또는 `app.js`

1. 각 패턴 타입별 Canvas 다이어그램
2. pp-diagram-canvas 렌더링

### Phase 6: 밸류에이션 데이터 연결 (app.js + data.js 협의)
**변경 파일**: `app.js`, `data.js`

1. PER/PBR/PSR 계산 로직
2. EV/EBITDA 계산
3. 배당수익률 계산

---

## 부록 A: 전체 레이아웃 시각화 (1920x1080)

```
┌─ header (44px) ──────────────────────────────────────────────────┐
│ [≡] KRX LIVE │ [검색...]              │ KOSPI 2,687 │ KOSDAQ 868│
├──────┬───────────────────────────┬──────────────┬────────────────┤
│      │                           │              │                │
│ 좌측 │  삼성전자  005930  KOSPI   │  기술적      │  주요재무지표   │
│ 메뉴 │  73,400  ▲ +1,200 (+1.66%)│  패턴 분석   │                │
│      │ ─────────────────────────│              │  2024 Q4       │
│검색..│ [일봉] [캔들] [지표▼]     │  ┌─────────┐ │  연결기준       │
│      │ ─────────────────────────│  │ ● 이중바닥│ │                │
│시총순│                           │  │ [매수]    │ │  매출 758,900  │
│      │     ┌─┐    ┌─┐          │  │           │ │  영업 64,400   │
│KOSPI │     │ │ ┌─┐│ │   ┌─┐   │  │ [도형]    │ │  순이 52,380   │
│ 삼성 │  ┌─┐│ │ │ ││ │┌─┐│ │   │  │           │ │                │
│ SK   │  │ ││ │ │ ││ ││ ││ │   │  │ 신뢰도 78%│ │  OPM  ROE ROA │
│ 현대 │──┘ └┘ └─┘ └┘ └┘ └┘ └── │  │ 수익 +3.2%│ │  8.5  7.5 3.2 │
│ ...  │                           │  └─────────┘ │                │
│      │ ─────────────────────────│              │  PER  PBR PSR  │
│KOSDAQ│  패턴 발생 후 수익률       │  ┌─────────┐ │ 12.3  1.2 1.8 │
│ 에코 │  [5일] [10일] [20일]      │  │ 합류 분석│ │                │
│ 알테 │  이중바닥 ████░ +3.2% 68% │  │ MA ✓    │ │  추이 [매출]   │
│ ...  │  상승쐐기 ██░░░ +1.1% 55% │  │ RSI ✓   │ │  ████ ████     │
│      │  망치형   ███░░ +2.4% 62% │  │ 7.2/10  │ │  Q3   Q4       │
│      │                           │  └─────────┘ │                │
│      │  * 과거 수익률은 미래를    │              │  출처: DART     │
│      │    보장하지 않습니다       │              │                │
└──────┴───────────────────────────┴──────────────┴────────────────┘
  180px         ~700px (1440 기준)       260px          300px
```

## 부록 B: 색상 팔레트 전체 (v5.0)

```
배경 계층:
  #0A0A0A  ──  --bg           (최하위, body)
  #141414  ──  --panel        (패널 배경)
  #1E1E1E  ──  --bg-element   (카드, 입력 필드)
  #282828  ──  --bg-elevated  (드롭다운, 팝업)
  #1a1a1f  ──  차트 영역 전용 (하드코딩)

텍스트 계층:
  #FFFFFF  ──  종목명, 패턴 이름 (최고 강조)
  #E8E8E8  ──  --text         (기본 텍스트)
  #A0A0A0  ──  --text-sub     (보조 텍스트)
  #707070  ──  --text-muted   (비활성 텍스트)

시맨틱 색상 (한국식):
  #E05050  ──  --up           (상승/매수)
  #5086DC  ──  --down         (하락/매도)
  #ffeb3b  ──  --neutral      (중립/경고)
  #C9A84C  ──  --accent       (금색/구조선)

기능 색상:
  #4caf50  ──  live dot (실시간)
  #00bcd4  ──  WebSocket 연결
  #ff9800  ──  데모 모드
  #f44336  ──  오프라인/에러
  #5b8af5  ──  KOSPI 배지
  #ce93d8  ──  KOSDAQ 배지

상승/하락 배경 tint:
  rgba(224, 80, 80, 0.15-0.35)   ──  상승 배경
  rgba(80, 134, 220, 0.15-0.35)  ──  하락 배경
  rgba(201, 168, 76, 0.12-0.20)  ──  accent 배경
  rgba(255, 235, 59, 0.15)       ──  중립 배경
```

## 부록 C: 참조 출처

### 레이아웃 참조
- [TradingView 레이아웃 옵션](https://www.tradingview.com/blog/en/more-chart-layout-options-52228/)
- [TradingView 레이아웃 가이드](https://www.tradingview.com/support/solutions/43000746975-tradingview-layouts-a-quick-guide/)
- [Bloomberg Terminal 접근성 디자인](https://www.bloomberg.com/company/stories/designing-the-terminal-for-color-accessibility/)
- [CSS Grid 반응형 대시보드](https://compile7.org/decompile/build-a-responsive-dashboard-layout-with-css-grid/)

### 패턴 표시 참조
- [캔들스틱 패턴 오버레이 (Optuma)](https://www.optuma.com/kb/optuma/tools/price/candlestick-pattern-overlay)
- [thinkorswim 패턴 에디터](https://toslc.thinkorswim.com/center/howToTos/thinkManual/charts/Patterns/Candlestick-Pattern-Editor)
- [캔들스틱 차트 가이드 (Domo)](https://www.domo.com/learn/charts/candlestick-charts)

### 타이포그래피 참조
- [핀테크 타이포그래피 가이드 (Smashing Magazine)](https://www.smashingmagazine.com/2023/10/choose-typefaces-fintech-products-guide-part1/)
- [핀테크 폰트 전략 (Telerik)](https://www.telerik.com/blogs/font-strategies-fintech-websites-apps)
- [데이터 시각화 폰트 (Datawrapper)](https://www.datawrapper.de/blog/fonts-for-data-visualization)
- [JetBrains Mono 공식](https://www.jetbrains.com/lp/mono/)

### 재무 지표 참조
- [PER/PBR/ROE/EPS 가이드](https://medium.com/@shcorp001/a-non-experts-complete-guide-to-financial-metrics-per-roe-eps-pbr-548b68ba71bc)
- [Financial Metrics Dashboard (TradingView)](https://www.tradingview.com/script/5vJIVtlf-Financial-Metrics-Dashboard/)
- [금융 대시보드 가이드 (FineReport)](https://www.finereport.com/en/dashboard-tools/financial-dashboard.html)

---

*이 설계안은 구현 전 검토 문서입니다. Phase 1 (CSS/HTML)은 즉시 구현 가능하며, Phase 2-6은 app.js/sidebar.js 파일 소유자와 협의 후 진행합니다.*
