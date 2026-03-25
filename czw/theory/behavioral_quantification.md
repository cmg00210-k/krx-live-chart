# 행동재무학 계량화 — CZW 통합

## 1. 공포-탐욕 지수 (Fear-Greed Index) KRX 버전

CNN Fear & Greed Index를 KRX 데이터로 재구성:

```
FearGreed = w1*RSI_norm + w2*volSurge_norm + w3*volRatio_norm + w4*newHighLow_norm

RSI_norm: RSI(14)를 [0,1] 정규화 (50=중립)
volSurge_norm: ATR14/ATR50 (>1.2=공포, <0.8=탐욕)
volRatio_norm: 거래량/VMA20 (>2=극단)
newHighLow_norm: (신고가 종목수 - 신저가 종목수) / 전체종목

w1=0.30, w2=0.30, w3=0.20, w4=0.20 (가중치)
```

CZW 적용: R:R gate의 lambda를 fearGreed에 따라 동적 조정
- 공포장 (FG < 0.3): lambda 상향 → 높은 R:R 요구
- 탐욕장 (FG > 0.7): lambda 하향 → 낮은 R:R 허용

## 2. 처분효과 계수 (Disposition Factor)

Odean (1998) "Are Investors Reluctant to Realize Their Losses?"

```
disposition = volume_at_support / avg_volume - 1
```

- 지지선 근처 대량거래 = 보유자의 이익실현 압력
- sell 신호에서: disposition이 높으면 매도 신호 약화 (이미 처분 완료)
- buy 신호에서: disposition이 높으면 매수 기회 (처분 후 반등)

CZW 적용: sell_czw에 disposition_factor 반영
- 현재 제약: wc_return_pairs.csv에 volume 미포함 → 추가 수집 필요

## 3. 군집행동 지표 (Herding Measure)

Lakonishok, Shleifer & Vishny (1992)

```
herding = |buy_ratio - expected_buy_ratio| - E[|buy_ratio - expected_buy_ratio|]
```

KRX 간이 구현: 개인/기관/외국인 순매수 동향
- 현재 제약: 투자주체별 거래 데이터 미보유 → Koscom 전환 후 가능

## 4. 과잉/과소반응

- 장기 과잉반응 (DeBondt-Thaler 1985): moveATR > 3 → mw 감쇠 (이미 구현)
- 단기 과소반응 (Jegadeesh-Titman 1993): 모멘텀 팩터 → APT 확장에서 처리

## 5. sell hw 개선 기여

처분효과가 sell hw의 R^2=0.0008 문제를 설명할 수 있는 후보 이론:
- sell 신호 발생 시점의 매물 압력이 이미 반영되어 있으면, hw 반전이 무의미
- 대안: sell_czw = hw * (1 - 0.3 * disposition_factor) (처분효과 보정)
- 검증 필요: volume 데이터 수집 후 Spearman corr(disposition, sell_ret5) 측정

```
코드 매핑: patterns.js:326 (sell hw), signalEngine.js:555 (volume ratio)
엔진 효과: 처분효과 계량화 → sell IC 개선 가능성 (데이터 수집 후 검증)
```
