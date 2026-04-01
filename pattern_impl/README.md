# pattern_impl/ -- 학술 기반 -> 패턴 정의 -> 차트 구현 아키텍처

> 학술 이론(core_data/) -> 패턴 정의(pattern_impl/) -> 코드 구현(js/) 흐름을 체계화한 문서 모음

---

## 문서 구조

| # | 파일 | 역할 | 핵심 질문 |
|---|------|------|----------|
| 1 | [01_theory_pattern_mapping.md](01_theory_pattern_mapping.md) | 학술-구현 연계 매핑 | "각 패턴/지표의 이론적 근거는 어디에?" |
| 2 | [02_candle_patterns.md](02_candle_patterns.md) | 캔들스틱 패턴 정의 + 구현 상태 | "42종 중 몇 종이 구현되었나?" |
| 3 | [03_composite_signals.md](03_composite_signals.md) | 캔들+지표 복합 조건 시그널 | "패턴과 지표를 어떻게 결합하나?" |
| 4 | [04_implementation_map.md](04_implementation_map.md) | 코드 위치 매핑 + 우선순위 | "어디를 고치고 뭘 추가해야 하나?" |
| 5 | [05_pipeline_analysis.md](05_pipeline_analysis.md) | 파이프라인 효율성 분석 | "현재 체계의 장단점은?" |

---

## 데이터 흐름도 (학술 -> 구현)

```
[Stage 1] 학술 이론 (core_data/ -- 24편)
    01_mathematics.md ─── 확률과정, 이동평균 이론
    02_statistics.md ──── 시계열, 회귀, 베이지안
    04_psychology.md ──── 전망이론, 군중심리
    05_finance_theory.md  EMH, MPT, 변동성
    06_technical_analysis  다우이론, 캔들스틱, 차트패턴
    07_pattern_algorithms  패턴 수학, 품질점수, 하모닉
    14_finance_management  켈리, VaR, 리스크관리
    16_pattern_reference   42종 패턴 정의 + 시각 가이드
         │
         ▼
[Stage 2] 패턴 정의 (pattern_impl/ -- 5편)
    01 이론-구현 매핑
    02 캔들 패턴 정의서
    03 복합 시그널 설계
    04 구현 위치 매핑
    05 파이프라인 분석
         │
         ▼
[Stage 3] 코드 구현 (js/ -- 14파일, 5,130행)
    colors.js ──────── KRX_COLORS 중앙 색상 관리
    indicators.js ──── 지표 계산 함수 9종 + IndicatorCache
    patterns.js ────── PatternEngine (26종 패턴 탐지)
    signalEngine.js ── SignalEngine (16종 지표 시그널 + 6종 복합 시그널)
    chart.js ────────── ChartManager (차트 렌더링)
    patternRenderer.js  Canvas 패턴 시각화 (ISeriesPrimitive)
    signalRenderer.js ─ Canvas 시그널 시각화 (ISeriesPrimitive)
    backtester.js ───── 패턴 백테스팅 (N일 수익률)
    analysisWorker.js ─ Web Worker (분석 오프로드)
    sidebar.js ──────── 사이드바 UI
    app.js ──────────── 상태 관리, UI 바인딩
```

---

## 스크립트 로드 순서 (index.html)

```
colors.js -> data.js -> api.js -> realtimeProvider.js -> indicators.js
-> patterns.js -> signalEngine.js -> chart.js
-> patternRenderer.js -> signalRenderer.js -> backtester.js
-> sidebar.js -> app.js
```

> colors.js가 최선두 — KRX_COLORS를 모든 JS에서 참조 가능.
> indicators.js가 patterns.js보다 먼저 — calcATR 등 전역 함수 사용 가능.
> signalEngine.js는 indicators.js + patterns.js 양쪽 의존.
> analysisWorker.js는 별도 Worker 컨텍스트 — importScripts로 4개 파일 로드.

---

## 현재 시스템 요약

- **PatternEngine v2.0** (patterns.js, 1,488행): 26종 패턴 (캔들 17종 + 차트 8종 + 지지/저항)
- **SignalEngine** (signalEngine.js, 1,129행): 16종 지표 시그널 (5카테고리) + 6종 복합 시그널 (3 Tier)
- **IndicatorCache** (indicators.js, 378행): 9종 전역 계산 함수 + Lazy Evaluation 캐시 클래스
- **Backtester** (backtester.js, 497행): 패턴별 [1,3,5,10,20]일 수익률 통계
- **Web Worker** (analysisWorker.js, 103행): 메인 스레드 블로킹 방지
- **학술 문서**: 24편 (core_data/01~24 + 11B)
- **타겟 시장**: KRX (KOSPI/KOSDAQ), 약 2,733종목
- **시간프레임**: 일봉(file mode) + 분봉(demo mode)

---

## 용어 규약

| 한국어 | 영문 | 설명 |
|--------|------|------|
| 캔들 패턴 | Candlestick Pattern | 1~3봉 단위의 가격 형태 |
| 차트 패턴 | Chart Pattern | 다봉 구조적 형태 (삼각형, 쐐기 등) |
| 복합 시그널 | Composite Signal | 캔들 패턴 + 지표 조건의 동시 충족 |
| 컨플루언스 | Confluence | 다수 시그널의 합류 |
| ATR 정규화 | ATR Normalization | 가격 독립적 비교를 위한 변동성 단위 변환 |
| 품질 점수 | Quality Score | 패턴의 이상적 형태 대비 적합도 (0-100) |
