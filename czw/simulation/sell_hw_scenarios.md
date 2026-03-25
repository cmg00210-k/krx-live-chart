# sell hw=(2-hw) 시뮬레이션 시나리오

## 현재 상태 진단

```
현재 공식: effectiveHw = 2 - hw (sell), hw (buy)
R^2 = 0.0008, corr_current = corr_new = 0.0286
결론: 선형 변환으로는 개선 불가 (단조 변환의 상관 불변성)
```

MRA 계수에서의 증거:
```
hw 계수: +3.607 (buy에서 양의 효과)
hw_x_signal 계수: -5.303 (sell에서 hw의 순효과 = 3.607-5.303 = -1.696)
```

## 시나리오 권장 실행 순서

### 1순위: SIM-D (반전 제거, baseline 정리)

```javascript
// 변경: patterns.js L326
// Before: var effectiveHw = patterns[pi].signal === 'sell' ? (2 - hurstWeight) : hurstWeight;
// After:  var effectiveHw = hurstWeight;
```

- IC 변화: ~0 (±0.001)
- 목적: 오염된 공식 제거, 깨끗한 baseline 확보
- 후속: mra_extended.py 재실행 (계수 재교정)

### 2순위: SIM-A (sell 전용 다변수 Ridge)

```
scripts/calibrate_sell_hw.py 신규 작성:
  df_sell에서 hw, mw, hw^2, hw*mw, confidence_norm, pattern_tier로 회귀
  Walk-forward IC 측정
  교정 계수를 calibrated_constants.json에 저장
```

- IC 기대: +0.003~0.008
- 근거: hw^2 비선형항이 극단 hw값에서의 비선형 관계 포착

### 3순위: SIM-C (sell 전용 LinUCB)

```
scripts/train_rl_sell.py 신규 작성:
  rl_context.csv에서 sell 샘플만 추출
  sell 전용 5-action 정책 학습
  rl_policy_sell.json 생성
```

- IC 기대: +0.002~0.005
- 근거: reverse 액션이 전체 52% → sell 전용 정책에서 명시적 포착

### 보류: SIM-B (처분효과)

- volume 데이터가 wc_return_pairs.csv에 없음
- 추후 CSV 확장 후 재검토

## self-verification 검증 계획

각 시나리오 적용 후:
1. sell 샘플 1000개 무작위 추출 → CZW 분포 비교
2. Walk-forward IC 전후 비교 (paired Wilcoxon test)
3. buy IC 불변 확인 (독립성 보장)
4. verify.py --strict 통과
