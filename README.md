# CZW (CheeseStock Weight) Framework

> Wc(CheeseStock Weight)의 공식 명칭. 다른 학술 공식과의 충돌을 피하기 위해 CZW를 사용한다.

## 현재 CZW 공식

```
CZW_buy  = hw * mw          [0.36 ~ 1.4]
CZW_sell = (2-hw) * mw      [0.36 ~ 1.4]  ← D등급, 개선 대상
```

- hw = clamp(2 * H_shrunk, 0.6, 1.4) — 허스트 지수 기반 추세 지속성
- mw = clamp(exp(-0.1386 * excess), 0.6, 1.0) — 평균회귀 보정
- vw, rw: 계산되나 CZW에 미포함 (IC 음수, E등급)

## 학술 통합 로드맵

### Stage 현황
- Stage A-1 (완료): 12열 MRA Ridge, IC 0.099
- Stage B (완료): LinUCB 10-dim, IC 0.325
- **Stage CZW (계획)**: APT 팩터 + 행동재무학 + 다중회귀 확장

### 탐색된 학술 이론

| 이론 | KRX 적용성 | CZW 기여 | 파일 |
|------|-----------|---------|------|
| APT (Ross 1976) | HIGH | MRA를 APT 특수 케이스로 재해석, 추가 팩터 | core_data/23_apt_factor_model.md |
| Fama-French 3/5 | MEDIUM | SMB/HML 팩터 (시총/PBR 데이터 있음) | core_data/23_apt_factor_model.md |
| 행동재무학 계량화 | HIGH | 공포-탐욕 지수, 처분효과, 군집행동 | core_data/24_behavioral_quantification.md |
| 다중회귀 확장 | HIGH | 비선형항, Quantile regression, LASSO | core_data/17_regression_backtesting.md |
| 정보이론 | MEDIUM | Shannon entropy, Mutual Information | core_data/13_information_geometry.md |

## 데이터 학습 등급 분류

### FIXED-A (6건, 변경 불필요)
mw [0.6,1.0], STOP_LOSS=2, RSI 30/70, WLS lambda=0.995, Holm, Cornish-Fisher

### FIXED-B (3건, 미세 조정 가능)
excess=3, CHART_TARGET_ATR=6, 골든크로스=0.4

### LEARNABLE-C (11건, calibration 가능)
R:R -15/-5, hw clamp, TARGET_ATR, RAW_CAP, RSI conf, 거래량, confidence 공식,
Tier 가중치, Ridge lambda, 시총하한, PER밴드

### LEARNABLE-D (2건, 온라인 학습)
sell hw=(2-hw), 슬리피지=0

### ADAPTIVE-E (1건, 시변 적응)
단순/로그 수익률

## sell hw 시뮬레이션 시나리오

| 시나리오 | 설명 | IC 기대 | 권장순서 |
|---------|------|---------|---------|
| D: 반전 제거 | effectiveHw=hw (buy/sell 동일) | ~0 (baseline) | 1순위 |
| A: sell 다변수 | sell 전용 Ridge (hw, mw, hw^2, hw*mw) | +0.003~0.008 | 2순위 |
| C: sell LinUCB | sell 전용 정책 학습 | +0.002~0.005 | 3순위 |
| B: 처분효과 | volume 기반 disposition factor | 불확실 | 보류 |

## 폴더 구조

```
(root)/
├── README.md              ← 이 파일
├── core_data/             학술 이론 문서 (01~24)
├── scripts/               Python 분석/교정 스크립트
├── docs/                  설계 문서, 시나리오
└── data/backtest/         교정 결과, 백테스트 출력
```

## 실행 계획

Phase 1: C등급 즉시 적용 (C-1 R:R + C-3 TARGET_ATR) → IC +0.008~0.015
Phase 2: sell hw D→A→C 순서 (baseline 정리 → 다변수 → RL)
Phase 3: C등급 배치 인프라 (C-8 Tier 가중치 + C-6 거래량 z-score)
Phase 4: 슬리피지 모델 + UX 개선 (PER밴드, 시총하한)
