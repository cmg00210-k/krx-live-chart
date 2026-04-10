\newpage
### 4.2.1 색채 이론과 문화적 부호 (Color Theory & Cultural Encoding)

**개요**

동아시아 색상 기호학에서 적색은 번영과 길조를 상징하며, 청색은 안정과 보수적 태도를 나타낸다. 한국 주식시장(KRX)은 이 문화적 맥락에 따라 서양과 반대의 색상 관례를 채택한다: 상승·매수는 적색(`#E05050`), 하락·매도는 청색(`#5086DC`)으로 표시한다. 삼성증권, 미래에셋, NH투자증권, 키움증권 등 국내 모든 트레이딩 플랫폼이 동일한 관례를 따르며, CheeseStock도 사용자의 학습된 기대와 일치시킨다. 이 선택은 미적 선호가 아닌 **문화적 인지 관례**의 준수이다.

Shannon(1948) 정보이론의 채널 용량 공식은 색상 설계에 직접 적용된다: 하나의 색상 채널이 복수의 의미를 동시에 전달하면 수신자(트레이더)의 정보 해석 오류 확률이 증가한다. CheeseStock은 이를 방지하기 위해 3개 열에 완전히 독립적인 색상 의미 체계를 부여한다. B열(차트)은 적색·청색으로 **가격 방향**만을, C열(패턴)은 민트·보라로 **분석 유형**만을, D열(재무)은 녹색·청색으로 **재무 품질**만을 부호화한다. 각 채널은 상호 직교(orthogonal)하여 의미 혼선이 발생하지 않는다.

패턴 색상의 경우, 매수 패턴과 매도 패턴 모두 동일한 민트 색상(`rgba(150,220,200,0.65)`)을 사용한다. 이는 Bloomberg Terminal 및 TradingView의 전문가 표준을 따른 설계 결정이다. 패턴 감지는 **중립적 분석 관찰**이지 방향적 추천이 아니기 때문이다. 예를 들어, 해머 패턴은 지지선에서 출현하면 강세 신호이지만 저항선에서 출현하면 신뢰도가 낮다. 패턴 자체에 방향적 색상을 부여하면 이론이 뒷받침하지 않는 인지적 편향을 유발한다. 방향 정보는 색상이 아닌 **라벨 텍스트**와 **수직 위치**(가격 위/아래)로 전달된다.

캔들 패턴은 차트 패턴과 구별하기 위해 별도의 연보라 색상(`#B388FF`)을 사용한다. 캔들 패턴(해머, 도지 등)은 1-3봉 단위의 단기 신호이고, 차트 패턴(삼각형, 이중바닥 등)은 수십 봉에 걸친 구조적 패턴이다. 두 유형은 서로 다른 분석 계층에 속하므로, 색상으로도 명확히 구분된다.

**핵심 공식**

Shannon 채널 용량:
$$C = B \log_2\!\left(1 + \frac{S}{N}\right)$$

3채널 직교 색상 독립성:
$$\text{방향 채널} \perp \text{유형 채널} \perp \text{품질 채널}$$

단일 채널에 복수 의미 부여 시 정보 오류율:
$$P_e > 0 \quad \Leftrightarrow \quad H(\text{의미} \mid \text{색상}) > 0$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| `#E05050` (UP) | 상승/매수 적색 | RGB hex | 문화적 관례 (동아시아) |
| `#5086DC` (DOWN) | 하락/매도 청색 | RGB hex | 문화적 관례 |
| `#ffeb3b` (NEUTRAL) | 중립 노랑 | RGB hex | 설계 결정 |
| `#A08830` (ACCENT) | 강조 금색 (구조선) | RGB hex | 설계 결정 |
| `rgba(224,80,80,a)` (UP_FILL) | 상승 반투명 채우기 | RGBA | 파생 |
| `rgba(80,134,220,a)` (DOWN_FILL) | 하락 반투명 채우기 | RGBA | 파생 |
| `rgba(160,136,48,a)` (ACCENT_FILL) | 강조 반투명 채우기 | RGBA | 파생 |
| `#FF6B6B` (MA_SHORT) | 단기 이동평균선 | RGB hex | 설계 결정 |
| `#FFD93D` (MA_MID) | 중기 이동평균선 | RGB hex | 설계 결정 |
| `#6BCB77` (MA_LONG) | 장기 이동평균선 / 재무 양호 | RGB hex | 설계 결정 |
| `#C77DFF` (EMA_12) | EMA 12 지수이동평균 | RGB hex | 설계 결정 |
| `#7B68EE` (EMA_26) | EMA 26 지수이동평균 | RGB hex | 설계 결정 |
| `#FF8C42` (BB) | 볼린저밴드 상/하단 | RGB hex | 설계 결정 |
| `rgba(255,140,66,0.4)` (BB_MID) | 볼린저밴드 중심선 | RGBA | 설계 결정 |
| `#E040FB` (ICH_TENKAN) | 일목균형 전환선 | RGB hex | 설계 결정 |
| `#00BFA5` (ICH_KIJUN) | 일목균형 기준선 | RGB hex | 설계 결정 |
| `rgba(129,199,132,0.35)` (ICH_SPANA) | 일목균형 선행스팬A (양운) | RGBA | 설계 결정 |
| `rgba(239,154,154,0.35)` (ICH_SPANB) | 일목균형 선행스팬B (음운) | RGBA | 설계 결정 |
| `#78909C` (ICH_CHIKOU) | 일목균형 후행스팬 | RGB hex | 설계 결정 |
| `#76FF03` (KALMAN) | 칼만 필터 추세선 | RGB hex | 설계 결정 |
| `#ff9800` (RSI) | RSI 오실레이터 | RGB hex | 설계 결정 |
| `#B0BEC5` (VOL_MA) | 거래량 이동평균 (청회색) | RGB hex | 설계 결정 |
| `#2962ff` (MACD_LINE) | MACD 선 | RGB hex | 설계 결정 |
| `#ff9800` (MACD_SIGNAL) | MACD 시그널선 | RGB hex | 설계 결정 |
| `#7CB342` (STOCH_K) | 스토캐스틱 %K | RGB hex | 설계 결정 |
| `#e91e63` (STOCH_D) | 스토캐스틱 %D | RGB hex | 설계 결정 |
| `#26C6DA` (CCI) | 상품채널지수 | RGB hex | 설계 결정 |
| `#AB47BC` (ADX) | 평균방향성지수 | RGB hex | 설계 결정 |
| `#FF7043` (WILLR) | 윌리엄스 %R | RGB hex | 설계 결정 |
| `#FFA726` (ATR_LINE) | ATR 변동성선 | RGB hex | 설계 결정 |
| `#B388FF` (PTN_CANDLE) | 캔들 패턴 연보라 | RGB hex | 설계 결정 |
| `rgba(179,136,255,a)` (PTN_CANDLE_FILL) | 캔들 패턴 채우기 | RGBA | 파생 |
| `#FF6B35` (PTN_INVALID) | 패턴 무효화 오렌지 | RGB hex | 설계 결정 |
| `rgba(150,220,200,0.65)` (PTN_BUY) | 차트 패턴 민트 테두리 (매수 통일) | RGBA | 설계 결정 |
| `rgba(150,220,200,0.12)` (PTN_BUY_FILL) | 차트 패턴 민트 채우기 | RGBA | 파생 |
| `rgba(150,220,200,0.65)` (PTN_SELL) | 차트 패턴 민트 테두리 (매도 통일) | RGBA | 설계 결정 |
| `rgba(150,220,200,0.12)` (PTN_SELL_FILL) | 차트 패턴 민트 채우기 (매도 통일) | RGBA | 파생 |
| `rgba(200,200,200,0.55)` (PTN_NEUTRAL) | 중립 패턴 실버 (도지 등) | RGBA | 설계 결정 |
| `rgba(200,200,200,0.45)` (PTN_STRUCT) | 구조선 실버 (넥라인 등) | RGBA | 설계 결정 |
| `rgba(255,107,53,0.55)` (PTN_STOP) | 손절가 오렌지 | RGBA | 설계 결정 |
| `rgba(150,220,200,0.55)` (PTN_TARGET) | 목표가 민트 | RGBA | 설계 결정 |
| `rgba(150,220,200,0.22)` (FZ_TARGET_NEAR) | 예측구간 목표 그라데이션 근단 | RGBA | 파생 |
| `rgba(150,220,200,0.05)` (FZ_TARGET_FAR) | 예측구간 목표 그라데이션 원단 | RGBA | 파생 |
| `rgba(150,220,200,0.45)` (FZ_TARGET_BORDER) | 목표가 점선 | RGBA | 파생 |
| `rgba(255,107,53,0.15)` (FZ_STOP_NEAR) | 예측구간 손절 그라데이션 근단 | RGBA | 파생 |
| `rgba(255,107,53,0.03)` (FZ_STOP_FAR) | 예측구간 손절 그라데이션 원단 | RGBA | 파생 |
| `rgba(255,107,53,0.25)` (FZ_STOP_BORDER) | 손절가 점선 | RGBA | 파생 |
| `rgba(130,210,185,0.8)` (PTN_MARKER_BUY) | 매수 패턴 마커 민트 | RGBA | 설계 결정 |
| `rgba(130,210,185,0.8)` (PTN_MARKER_SELL) | 매도 패턴 마커 민트 (통일) | RGBA | 설계 결정 |
| `#131722` (CHART_BG) | 차트 배경 (KNOWSTOCK 테마) | RGB hex | 설계 결정 |
| `#d1d4dc` (CHART_TEXT) | 차트 텍스트 | RGB hex | 설계 결정 |
| `#2a2e39` (CHART_BORDER) | 차트 테두리 | RGB hex | 설계 결정 |
| `#C9A84C` (DRAW_GOLD) | 드로잉 추세선 기본 금색 | RGB hex | 설계 결정 |
| `#787B86` (DRAW_GRAY) | 드로잉 수평/수직/피보나치 기본 | RGB hex | 설계 결정 |
| `#2962FF` (DRAW_BLUE) | 드로잉 파랑 (TradingView 관례) | RGB hex | 설계 결정 |
| `#26C6DA` (DRAW_CYAN) | 드로잉 선택 핸들 | RGB hex | 설계 결정 |
| `#2ecc71` (TIER_A) | 신뢰도 Tier A 배지 (고신뢰) | RGB hex | 설계 결정 |
| `#3498db` (TIER_B) | 신뢰도 Tier B 배지 (중신뢰) | RGB hex | 설계 결정 |
| `#f39c12` (TIER_C) | 신뢰도 Tier C 배지 (저신뢰) | RGB hex | 설계 결정 |
| `#95a5a6` (TIER_D) | 신뢰도 Tier D 배지 (데이터 부족) | RGB hex | 설계 결정 |
| $B$ | Shannon 채널 대역폭 | Hz | Shannon (1948) |
| $S/N$ | 신호 대 잡음비 | 무차원 | Shannon (1948) |

> **이전 Stage 데이터:** 제3장(패턴 감지)에서 출력된 `direction` 필드(bullish/bearish/neutral)는 B열에서는 적색/청색으로, C열에서는 색상이 아닌 라벨 위치(가격 위/아래)로 표현된다. 동일한 `direction` 값이 열에 따라 서로 다른 시각 채널로 부호화된다.

| 방향 | 한국 (KRX) | 서양 (NYSE) | 근거 |
|------|-----------|------------|------|
| 상승/매수 | **적색** `#E05050` | 녹색 | 동아시아 문화에서 적색은 번영과 길조를 상징 |
| 하락/매도 | **청색** `#5086DC` | 적색 | 청색은 안정과 보수적 태도를 상징 |

| 열 | 영역 | 색상 체계 | 의미 |
|----|------|----------|------|
| B (차트) | 가격 움직임, 지표 | 적색/청색 | 가격 **방향** (상승/하락) |
| C (패턴) | 패턴 주석 | 민트/보라 | 분석 **유형** (차트/캔들) |
| D (재무) | 펀더멘털 지표 | 녹색/청색 | 재무 **품질** (양호/부진) |

**패턴 색상 통일 규칙:**

```javascript
PTN_BUY:  'rgba(150,220,200,0.65)',   // 민트
PTN_SELL: 'rgba(150,220,200,0.65)',   // [통일] 매도도 민트
```

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| 문화적 색상 관례 (동아시아 적/청) | `js/colors.js` `KRX_COLORS.UP` / `KRX_COLORS.DOWN` | B열 차트 방향 표시 |
| Shannon 채널 독립성 (3채널 직교) | `css/style.css` `var(--up)` / `var(--down)` / `var(--fin-good)` | 전체 UI 색상 체계 |
| 패턴 색상 통일 (Bloomberg 표준) | `js/colors.js` `KRX_COLORS.PTN_BUY` = `KRX_COLORS.PTN_SELL` | C열 패턴 렌더러 |
| 캔들/차트 패턴 유형 구분 | `js/colors.js` `KRX_COLORS.PTN_CANDLE` (`#B388FF`) vs `PTN_BUY` (민트) | C열 계층 1-2 vs 3-6 |
| 재무 품질 색상 (방향과 독립) | `css/style.css` `var(--fin-good)` = `#6BCB77` | D열 재무 패널 |
| 신뢰도 Tier 배지 | `js/colors.js` `KRX_COLORS.TIER_A/B/C/D` | 패턴 라벨 배지 |
| 예측구간 색상 (손절/목표 구분) | `js/colors.js` `FZ_STOP_*` (오렌지) vs `FZ_TARGET_*` (민트) | C열 계층 8 |

\newpage
### 4.3.1 인지 부하와 밀도 제어 (Cognitive Load & Density Control)

**개요**

George Miller(1956)의 "마법의 숫자 7, ±2"는 인간의 작업 기억(working memory)이 동시에 처리할 수 있는 정보 청크(chunk)의 수를 7±2개로 한정한다는 실험적 발견이다. 이 한계를 초과하면 인지 부하가 포화 상태에 이르며, 추가 정보는 처리되지 못하고 오히려 기존 정보의 해석 정확도를 저하시킨다. 차트 시각화에서 이 한계를 무시하면 더 많은 패턴을 표시할수록 오히려 의사결정 품질이 하락하는 역효과가 발생한다.

`MAX_PATTERNS = 3`은 Miller(1956) 이론에서 직접 도출된 설계 상수이다. 패턴 1개는 약 5개의 시각 요소(글로우/브래킷 배경 + 폴리라인/추세영역 + 라벨 배지 + 수평선 + 예측구간)를 생성한다. 패턴 3개 × 5 = 15개 시각 요소에 캔들스틱 봉, 이동평균선, 볼린저밴드, 축 라벨을 더하면 전체 시각 원소 총량은 인지 용량의 포화점에 도달한다. 패턴을 4개 이상 표시하면 Miller 한계를 초과하며, 트레이더는 가장 중요한 신호를 식별하지 못하게 된다. 분석 완전성은 제3장(패턴 감지)에서 보존되며, 제4장의 필터링은 분석 정확도가 아닌 **인지적 표시 한계**만을 관리한다.

연산-표시 분리 원칙(Computation-Display Separation)은 vizToggles 아키텍처의 핵심이다. 사용자가 캔들/차트/신호/예측 토글을 켜고 끄더라도 제3장의 패턴 분석과 백테스트 연산은 항상 완전하게 실행된다. `_filterPatternsForViz()`는 렌더링 시점에서만 필터를 적용한다. 이 분리로 인해 사용자는 재분석 없이 표시 설정을 전환할 수 있으며, 백테스트 결과는 시각화 상태와 무관하게 신뢰할 수 있다.

타이포그래피 설계는 이중 서체 체계를 채택한다. Pretendard(한국어 최적화 가변 폰트)는 12px 700 굵기에서도 일관된 자폭을 유지하여 패턴 라벨과 한국어 텍스트에 사용된다. JetBrains Mono는 OpenType `tnum`(tabular numbers) 기능으로 소수점 정렬을 보장하며, 가격 라벨과 종목코드에 적용된다. 가격 데이터에 비례폭 폰트를 사용하면 자릿수에 따라 열 너비가 변동하여 시각적 비교가 어려워진다.

**핵심 공식**

Miller(1956) 작업 기억 한계:
$$\text{작업 기억 용량} = 7 \pm 2 \quad \text{[정보 청크]}$$

차트 시각 원소 총량:
$$E_{\text{total}} = |\mathcal{P}_{\text{vis}}| \times \bar{e}_{\text{per\_pattern}} + E_{\text{base}}$$

밀도 제한 조건:
$$|\mathcal{P}_{\text{vis}}| \leq 3 \quad \Rightarrow \quad E_{\text{total}} \approx 15 + E_{\text{base}} \quad \text{(인지 포화 임계에 도달)}$$

**기호 주석**

| 기호 | 의미 | 단위 | 출처 |
|------|------|------|------|
| MAX_PATTERNS | 최대 패턴 표시 수 | 정수 (3) | 상수 [B] — Miller (1956) |
| MAX_EXTENDED_LINES | 최대 구조 연장선 표시 수 | 정수 (5) | 상수 [B] — 어수선함 방지 |
| MAX_DIAMONDS | 최대 다이아몬드 신호 표시 수 | 정수 (6) | 상수 [B] — 최근 신호 집중 |
| MAX_STARS | 최대 별(고신뢰 복합) 신호 표시 수 | 정수 (2) | 상수 [B] — 설계상 희소 |
| MAX_DIV_LINES | 최대 다이버전스선 표시 수 | 정수 (4) | 상수 [B] — RSI/MACD 구조선 |
| RECENT_BAR_LIMIT | 렌더링 대상 최근 봉 수 | 정수 (50) | 상수 [B] — 시간적 집중 |
| $\mathcal{P}_{\text{vis}}$ | 현재 표시 중인 패턴 집합 | 집합 | `_filterPatternsForViz()` |
| $\bar{e}_{\text{per\_pattern}}$ | 패턴 1개당 평균 시각 요소 수 | 정수 (~5) | 설계 추정 |
| $E_{\text{base}}$ | 기본 차트 요소 수 (캔들+지표+축) | 정수 | 시스템 상수 |
| vizToggles | 4범주 시각화 토글 상태 | 객체 | `js/appState.js` |
| `_filterPatternsForViz()` | 렌더링 시점 패턴 필터 함수 | 함수 | `js/appUI.js` |

> **이전 Stage 데이터:** 제3장에서 산출된 `patterns[]` 배열 전체는 Worker 분석 캐시(`_analyzeCache`)에 보존된다. 제4장의 밀도 제한은 `patternRenderer.render()` 호출 시점에 적용되며, 원본 분석 결과를 변경하지 않는다. `backtester.backtestAll()` 역시 표시 여부와 무관하게 전체 패턴에 대해 실행된다.

**타이포그래피 스케일**

| 폰트 | 용도 | 선정 근거 |
|------|------|----------|
| **Pretendard** 12px 700 | 패턴 라벨, 한국어 텍스트 | 한국어 최적화 가변 폰트, 12px에서도 일관된 자폭 유지 |
| **JetBrains Mono** | 가격 라벨, 종목코드 | 표 형식 숫자(`tnum`)로 소수점 정렬 보장 |

**밀도 제한 상수**

| 상수 | 값 | 근거 |
|------|---|------|
| MAX_PATTERNS | 3 | Miller(1956): 작업 기억 7±2 항목. 패턴 3개 × 5 시각요소 = 15개, 이미 인지 한계 |
| MAX_EXTENDED_LINES | 5 | 다수 역사적 패턴의 선 어수선함 방지 |
| MAX_DIAMONDS | 6 | 최근 신호에 집중 |
| MAX_STARS | 2 | 고신뢰 복합 신호 — 설계상 희소 |
| MAX_DIV_LINES | 4 | RSI/MACD 다이버전스선 — 구조적, 비과밀 |
| RECENT_BAR_LIMIT | 50 | 시간적 집중: 최근 ~50봉의 분석만 렌더링 |

**vizToggles 4범주**

| 범주 | 대상 패턴 유형 | 토글 끔 시 효과 |
|------|--------------|---------------|
| 캔들 | 캔들스틱 패턴 21종 (해머, 도지 등) | 글로우/브래킷 미표시, 분석은 유지 |
| 차트 | 차트 패턴 9종 (삼각형, 이중바닥 등) | 추세영역/폴리라인 미표시, 분석은 유지 |
| 신호 | 복합 신호 (다이아몬드, 별) | 신호 마커 미표시, 분석은 유지 |
| 예측 | 예측구간 (Forecast Zone) | 목표/손절 그라데이션 미표시, 분석은 유지 |

**CheeseStock 적용**

| 학술 개념 | 구현 함수/상수 | 적용 영역 |
|-----------|--------------|----------|
| Miller(1956) 작업 기억 한계 (7±2) | `js/patternRenderer.js` `MAX_PATTERNS = 3` | C열 패턴 최대 표시 수 |
| 시각 원소 밀도 상한 | `js/patternRenderer.js` `MAX_EXTENDED_LINES = 5`; `js/signalRenderer.js` `MAX_DIAMONDS = 6` | 계층 9, SignalRenderer |
| 고신뢰 신호 희소성 설계 | `js/signalRenderer.js` `MAX_STARS = 2`, `MAX_DIV_LINES = 4` | SignalRenderer 별/괴리선 마커 |
| 시간적 집중 (최근 봉 우선) | `js/signalRenderer.js` `RECENT_BAR_LIMIT = 50` | SignalRenderer 렌더 파이프라인 |
| 연산-표시 분리 원칙 | `js/appState.js` `vizToggles` + `js/appUI.js` `_filterPatternsForViz()` | 4범주 렌더 필터 |
| 한국어 가변폰트 (자폭 안정성) | `css/style.css` Pretendard CDN | C열 패턴 라벨 배지 |
| Tabular numbers (소수점 정렬) | `css/style.css` `font-feature-settings: "tnum"` + JetBrains Mono | B열 가격 라벨 |
| 라벨 충돌 회피 | `js/patternRenderer.js` 계층 7 수직 오프셋 알고리즘 | 패턴 라벨 위치 조정 |

\newpage
