# CheeseStock 모호/주관적 사항 감사 기록

> 생성일: 2026-03-18 | 감사 범위: 전체 JS 17파일 + CSS + HTML

## 단위 정의 (Unit Definitions)

| 필드 | 단위 | 소스 | 비고 |
|------|------|------|------|
| marketCap | 억원 | download_ohlcv.py | index.json. 삼성 11,170,356 = 111.7조원 |
| volume | 주 (raw count) | pykrx/Kiwoom | 1,000,000 = 100만주 |
| revenue, op, ni | 억원 | DART (원) → toEok() | data.js에서 변환 |
| EPS, BPS | 원 | DART 직접 or 계산 | ni(억원)×1억 / shares |
| ATR | 원 (가격 단위) | 계산값 | high-low 기반 |
| shares_outstanding | 주 (raw count) | DART | 확인 필요: 만주 가능 |
| PER, PBR, PSR | 배 (ratio) | 계산값 | 소수 1자리 |
| ROE, ROA, OPM | % | 계산값 | 소수 1자리 |

## 핵심 용어 정의 (Key Concepts)

| 용어 | 정의 | 흔한 오해 |
|------|------|----------|
| 신뢰도 (Confidence) | 패턴 형태의 시각적 명확도 (0-100) | ❌ 수익 확률이 아님 |
| N일 수익률 | 패턴 다음날 시가 기준 N거래일 후 종가 대비 | ❌ 캘린더일 아님 |
| 승률 (Win Rate) | Buy: 양수 수익률 %, Sell: 음수 수익률 % | ❌ Buy/Sell 동일 기준 아님 |
| 투자 점수 | 수익성(30)+밸류(30)+성장(20)+안정(20) 합산 | ❌ 활성 카테고리 부재 시 비례 보정 |
| CAGR | 연평균성장률 (가용 연도 기준, 3년 미만 시 단기) | ❌ 항상 3년 아님 |
| 기대수익률 | WLS 회귀 모델 예측값 (R² 0.02-0.08) | ❌ 보장 수익 아님 |

## 데이터 출처 구분

| 출처 | 적용 범위 | 신뢰도 | 표시 |
|------|----------|--------|------|
| DART 공시 | data/financials/{code}.json 있는 종목 | 높음 | (현재 미표시) |
| 하드코딩 | 삼성전자, SK하이닉스 (data.js PAST_DATA) | 중간 | (현재 미표시) |
| 시드 시뮬레이션 | 나머지 전체 종목 | 매우 낮음 | (현재 미표시) ⚠ |

## 설계 판단 근거 (Undocumented Design Decisions)

| 항목 | 현재 값 | 근거 | 문서화 |
|------|---------|------|--------|
| Pattern Quality Weights | body:0.25, vol:0.25, trend:0.20, shadow:0.15, extra:0.15 | Nison+Morris 기반 추정 | core_data/07 |
| ENGULF_BODY_MULT | 1.2x | KRX 30% 제한 고려 (국제 1.3x) | patterns.js 주석 |
| RSI 과매수/과매도 | 70/30 | Wilder 표준 | 미명시 |
| Backtest Horizons | [1,3,5,10,20] | 1d/3d/1w/2w/1m 대략 매핑 | 미명시 |
| 부채비율 위험 임계값 | 200% | 일반적 기준 (금융사 제외) | 미명시 |
| Composite Signal Window | 5 candles | 일봉 기준 (분봉 미적합) | signalEngine.js 주석 |
| Divergence Lookback | 40 candles | 일봉 ~8주 (단기 트레이더에겐 길 수 있음) | signalEngine.js 주석 |
| WLS Lambda | 0.995 | 반감기 ~139일 (Lo AMH 2004) | core_data/17 |
| Stop Loss ATR Mult | 2.0x | 보수적 수준 (공격적 1x, 방어적 3x) | patterns.js 주석 |

## HIGH 우선순위 액션 아이템

1. 데이터 출처 라벨 UI 추가 (DART/하드코딩/시뮬레이션)
2. "신뢰도" → "형태 점수"로 용어 변경 검토
3. 백테스트 헤더 "5거래일" 명시
4. CAGR "(X년 기준)" 기간 표시
5. index.json에 generatedAt 타임스탬프 추가
6. shares_outstanding 단위 DART 스키마 검증
