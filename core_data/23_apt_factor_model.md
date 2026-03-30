# APT Factor Model — CZW 연결

## APT (Ross 1976) 기본 공식

```
E[R_i] = R_f + beta_1*lambda_1 + beta_2*lambda_2 + ... + beta_k*lambda_k + epsilon_i
```

## 현재 MRA 12열 = APT 특수 케이스

MRA 12열 회귀의 설계행렬:
```
hw, vw(제외), mw, rw(제외), confidence, signal_dir, market_type,
log_confidence, pattern_tier, hw*signal, vw*signal, conf*signal
```

이는 APT에서 beta_j = 회귀 계수, lambda_j = 팩터 리스크 프리미엄으로 해석 가능.
차이점: APT는 체계적 위험만 가격결정, 현재 MRA는 비체계적(패턴 특수) 팩터도 포함.

## 추가 가능한 APT 팩터 (KRX 데이터 이미 보유)

| 팩터 | 수식 | 데이터원 | 기대 IC | 구현난도 |
|------|------|---------|---------|---------|
| Market Beta | Cov(stock_r, KOSPI_r)/Var(KOSPI_r) | OHLCV+index.json | +0.01~0.03 | LOW |
| Momentum | Return(t-3 to t-12m) | 1년 OHLCV rolling | +0.02~0.05 | LOW |
| Value (1/PBR) | 시총/자본총계 역수 | financials/*.json | +0.01~0.02 | MEDIUM |
| Size (log 시총) | log(marketCap) | index.json | +0.005~0.01 | LOW |
| Liquidity | 거래량/시총 | OHLCV+index.json | +0.005~0.01 | LOW |
| Volatility | ATR/close | OHLCV (이미 계산) | +0.005 | LOW |

## Fama-French 연결

- SMB = Small(시총 하위 50%) - Big(상위 50%) 포트폴리오 수익률
- HML = High(PBR 하위=가치) - Low(PBR 상위=성장) 수익률
- 구성 가능: index.json(시총) + financials(자본총계) → PBR rank → SMB/HML

## CZW 확장 공식 (제안)

```
CZW_v2 = hw * mw * (1 + alpha_momentum * momentum_rank
                       + alpha_value * value_rank
                       + alpha_size * size_rank)
```

alpha 계수: mra_apt_extended.py에서 17열 Ridge로 calibration 완료
```
코드 매핑: backtester.js:600-615 (WLS 7열 회귀), rl_residuals.py (17열 Ridge)

Phase 4-1 실측 결과 (2026-03-25, 297K samples):
  12-col WF IC: 0.0567 → 17-col WF IC: 0.0998 (delta: +0.0430)
  모든 5개 APT 팩터 p<0.001 유의
  liquidity t=-27.6, log_size t=+20.0, value t=-14.6, beta t=+11.9, momentum t=-6.0
```
