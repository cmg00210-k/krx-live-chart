# P7-001 Z-score Normalization Design
## ANATOMY V8 Phase 7 — APT 5-Factor Activation

**Author**: financial-engineering-expert (agent)
**Date**: 2026-04-21
**Status**: DECISION READY — Phase B 착수 가능
**Scope**: `js/aptModel.js` + `js/backtester.js _collectOccurrences` + offline pipeline

---

## (A) Preflight 요약 — μ/σ 미저장이 실제로 의미하는 것

### 확정 사실

1. **`data/backtest/mra_apt_coefficients.json`에 normalization parameter 부재**
   재확인 (Read 결과, Line 46-72):
   ```json
   "apt_factors": {
     "momentum_60d": { "description": "...", "z_scored": true, "coverage_pct": 75.6 },
     ...
   }
   ```
   `mean`, `std`, `median`, `mad` 필드 없음. `z_scored: true` 플래그와 커버리지만 메타데이터로 제공.

2. **오프라인 파이프라인은 per-date cross-sectional z-score** — 단일 전역 μ/σ는 존재하지 않음
   `scripts/mra_apt_extended.py` L.360-397 `zscore_by_date()`:
   - 각 `dt ∈ unique_dates`마다 독립적으로 median + MAD 계산
   - Training 기간 동안 거래일 수 N일이면 **N개의 (μ_dt, σ_dt) 쌍**이 존재
   - 학습 시점에만 쓰이고 dump 되지 않음 → 파일에 저장할 단일 값 없음

3. **Winsorization + NaN imputation 포함**
   - L.393 `np.clip(z, -3, 3)` — 3σ clip
   - L.389-390 NaN → 0 (cross-sectional median imputation)

4. **Market return 계산은 top-N cap-weighted** (L.252)
   - `w_sum > 0.3` gate (cap coverage 30% 이상)
   - client가 동일 logic을 재현하려면 상위 종목 시가총액 목록 + 일간 수익률 필요

### 이 의미

> **옵션 A (offline backfill of μ/σ)는 설계상 불가능.** 학습은 per-date normalization을 사용했으므로 "backfill할 단일 (μ, σ) 쌍"이 존재하지 않는다. Backfill하려면 `{date → (μ, σ) per factor}` 매핑 전체를 dump해야 하고, 이는 (a) 파일 크기 폭증 (영업일 × 5 factor), (b) training cohort 일자만 커버 (run-time new date는 여전히 빈 값), (c) 특허 노출도 증가 (μ/σ 시계열은 training cohort의 정보 우위를 드러냄).

따라서 **실질적 선택지는 B, C, D로 좁혀진다.** D는 math mismatch로 IC 0 보장이므로 실제로는 **B vs C**의 이항 결정이다.

---

## (B) 옵션 비교 매트릭스

| 기준 | A: Offline Backfill (단일 μ/σ) | A′: Offline Backfill (per-date dict) | B: Client Cohort (mean+std) | C: Client Cohort (robust median+MAD) | D: Raw (no z-score) |
|---|---|---|---|---|---|
| **Math fidelity vs training** | N/A (training은 per-date) | High (training 일자) / Zero (new date) | Low-Mid (distribution shift) | Mid (training과 같은 robust 공식 + shift) | Zero (coefficient scale mismatch) |
| **구현 시간** | N/A | +3h (script 수정 + schema + 배포) | 40 min | 50 min | 10 min |
| **배포 의존성** | N/A | Every model retrain → 새 JSON dump | None | None | None |
| **특허 노출도** | N/A | High (μ/σ 시계열 = training 정보 공개) | Low (client 자체 계산) | Low (client 자체 계산) | None (zero IP) |
| **File size impact** | N/A | +50KB~수백KB (dict) | 0 | 0 | 0 |
| **Edge case 견고성** | N/A | Training 일자 외 fallback 필요 | 이상치 민감 | 이상치 저항 (MAD×1.4826) | N/A |
| **Winsorization 재현** | N/A | 가능 | 명시적 구현 필요 | 명시적 구현 필요 | N/A |
| **Coverage 일치** | N/A | 동일 cohort | 현재 cohort ≠ training | 현재 cohort ≠ training | N/A |
| **예상 IC (h=5)** | N/A | 0.03-0.05 (training 기간) / 0 (new) | 0.01-0.02 | **0.02-0.03** | ~0 |

### 상세 근거

**왜 옵션 B (mean+std)는 C보다 나쁜가?**
- `compute_apt_factors` L.300: momentum_60d는 60일 수익률(%). 급등주 +200%, 부실주 -80% 등 두꺼운 꼬리 분포. sample std가 outlier에 pull → z-score가 압축되어 coefficient 곱 시 underweight.
- L.350 liquidity_20d: turnover는 log-normal + spike. 거래량 급등일(공시/이벤트)이 std를 10× 부풀림.
- MAD×1.4826은 **training pipeline이 사용한 바로 그 공식** → math symmetry가 있음. μ와 σ 이름만 같고 공식이 다르면 오히려 더 나쁘다.

**왜 옵션 C (robust)는 zero cost?**
- Median + MAD 계산은 `Array.prototype.sort` + `Math.abs` 루프 2회. 전체 cohort가 수천 occurrence 규모면 5 factor × 2회 정렬 ≈ O(n log n) × 10. 수만 occurrence에서도 sub-10ms.
- `scripts/mra_apt_extended.py` L.382-393의 JavaScript 포트만 있으면 됨 (20줄 미만).

**왜 옵션 A′ (per-date dict backfill)는 거부하는가?**
- 메모리 시드 `project_ip_protection_benchmarks.md`에 μ/σ normalization 파라미터는 "구성 가능 상수"로 IP 보호 candidate. Date-indexed dict를 공개하면 경쟁사가 training cohort 복원 단서를 얻음.
- Run-time에 지금 관찰 중인 occurrence가 training cohort의 date 외일 수 있음 (new date → fallback 필요). Fallback이 결국 B/C로 수렴 → dict 자체가 잉여.
- ANATOMY V8 P6-002 wiring이 "orphan field, zero chain coupling"으로 설계되었음. Offline 재빌드는 이 철학에 반함.

---

## (C) 최종 권장안

### 권장: **옵션 C (Client-side robust z-score, median + MAD×1.4826)**

**Phase 7에서 즉시 활성화.** Phase 8 이월 불필요.

### 권장 이유 (우선순위 순)

1. **Math fidelity** — offline pipeline과 동일한 robust 공식(`median + MAD × 1.4826`) 사용. 분포 shift는 남지만, 공식 symmetry로 인해 coefficient와의 곱이 비선형 왜곡 없이 스케일링됨.
2. **Zero deployment cost** — JSON schema 수정, 재학습, 배포 chain 모두 불필요.
3. **Patent-safe** — μ/σ는 client runtime에서만 존재. 서버 전송 없음. 특허 문서의 "novel algorithm" 범위 내.
4. **Phase 6 Option C 철학 보존** — aptPrediction은 여전히 orphan field. `_collectOccurrences`에 2단계 pass (factor 계산 → cohort z-score)만 추가.
5. **Fallback graceful** — cohort가 작으면 (n<5) z-score skip, factor=0으로 신호 소실 (coefficient 곱 0). 안전한 degradation.

### 예상 IC lift (h=5)

Phase 7 성공 임계(`IC lift ≥ +0.015`) 달성 가능성 평가:
- Training IC (17-col Ridge, n=237977): 미공개 (coefficient만 제공). 그러나 `momentum_60d` 계수 -0.099, `liquidity_20d` 계수 -0.375 → pattern confidence 대비 보조 신호 역할.
- Client cohort robust z-score는 training과 **동일한 공식 + 다른 cohort**. Distribution shift가 심하지 않으면 (KOSPI/KOSDAQ full market이므로 training과 유사) IC 감소폭 ≤ 30%.
- Reasonable 예상: **IC_apt ≈ 0.02~0.03 @ h=5**. baseline IC ≈ 0.01 가정 시 lift = +0.01~0.02 → **임계 경계에 있음**.

⚠️ **Risk**: 만약 run-time smoke에서 ICIR < 0.3 or lift < +0.015이면 **Phase 8에서 옵션 A′를 재고**할 경로가 남아있음. C는 non-destructive이므로 나중에 A′로 migration 가능.

### 만약 C에서도 IC 임계 미충족이면

- 현 세션에서는 B-1~B-4 구현 완료 후 diagnostic 관찰 (`icApt @ h=5/n≥20`). Fail 시:
  - **Phase 8 이월 조건**: Script `mra_apt_extended.py`에 `apt_factors[factor].train_median` / `.train_mad` per-date dict dump 추가 + aptModel.js가 date 기반 lookup.
  - **현 세션 대응**: `aptPrediction` orphan field는 그대로 두되, IC diagnostic을 MASTER L.172에 기록 ("Phase 7 APT: IC_baseline=X, IC_apt=Y, lift=Z, ICIR=W. Phase 8에서 per-date normalization 도입 검토").

---

## (D) `computeFactors` 신규 API 설계

### 현재 API (Phase 6)

```js
aptModel.computeFactors(candles, idx, meta)
// returns: { momentum60d, beta60d, valueInvPbr, logSize, liquidity20d } or null
// 각 필드는 RAW (z-score 전)
```

### Phase 7 신규 API (backward-compatible extension)

```js
// 단일 occurrence factor 계산 (기존 그대로, 이름 보존)
aptModel.computeFactors(candles, idx, meta)
// → { momentum60d, beta60d, valueInvPbr, logSize, liquidity20d } | null
//   각 필드: raw value or null

// 신규: cohort robust z-score
aptModel.zscoreCohort(rawFactorsArray)
// Input: Array<{ momentum60d, beta60d, valueInvPbr, logSize, liquidity20d }> (RAW, null 포함)
// Output: 같은 길이의 Array<{...}> (z-scored, clipped [-3,3], null→0)
// n<5 이면 모든 entry를 { 0,0,0,0,0 }으로 반환 (safe fallback)
```

### 호출 예 (backtester.js _collectOccurrences)

```js
// Pass 1: raw factor 수집
const rawFactorsList = [];
for (let idx of patternIndices) {
  const raw = aptModel.computeFactors(candles, idx, {
    marketCap: stockMeta.marketCap,
    pbr: stockMeta.pbr,
    marketReturns60d: marketReturnsSlice  // 60개 일일 수익률
  });
  rawFactorsList.push(raw);  // null 가능
}

// Pass 2: cohort robust z-score (한 번만 계산)
const zFactorsList = aptModel.zscoreCohort(rawFactorsList);

// Pass 3: predict with z-scored factors
for (let i = 0; i < patternIndices.length; i++) {
  const z = zFactorsList[i];
  const aptPrediction = aptModel.predict({
    confidence, signal, marketType, hw, vw, mw, rw, patternTier,
    momentum60d: z.momentum60d,
    beta60d: z.beta60d,
    valueInvPbr: z.valueInvPbr,
    logSize: z.logSize,
    liquidity20d: z.liquidity20d
  });
  // ... occurrence push
}
```

### 반환 스키마

```
zscoreCohort output per entry:
{
  momentum60d: number,   // clipped [-3, 3], 0 if cohort too small or raw was null
  beta60d:     number,   // ditto
  valueInvPbr: number,
  logSize:     number,
  liquidity20d: number
}
```

**Invariants**:
- 배열 길이 입력 === 출력
- 모든 반환 값은 유한 실수 (NaN/Infinity 절대 불반환)
- `|z| ≤ 3` (winsorized)
- cohort n<5 → 모든 entry가 `{0,0,0,0,0}` (predict는 intercept+pattern 부분만 반영)

---

## (E) Edge Case 처리 코드 스케치

### E-1: `marketCap ≤ 0` (상장폐지, 데이터 누락)

```js
// js/aptModel.js computeFactors 내부
if (!(meta.marketCap > 0)) {
  // logSize, liquidity20d 모두 null 유지
  // (기존 코드 L.172, L.175가 이미 이 gate 보유 — 변경 없음)
}
```

### E-2: `pbr ≤ 0` (자본잠식, 적자 지속)

```js
// 기존 L.169: if (meta.pbr > 0) out.valueInvPbr = 1 / meta.pbr;
// 강화: NaN/Infinity/음수 모두 필터
if (typeof meta.pbr === 'number' && isFinite(meta.pbr) && meta.pbr > 0.01) {
  out.valueInvPbr = 1 / meta.pbr;
}
// pbr < 0.01 (극단적 저PBR)도 제외 → 1/pbr 폭주 방지
// training pipeline L.331 `if pbr > 0.01` 과 정합
```

### E-3: `liquidity_20d` 거래정지일 포함 (volume=0)

```js
// 현재 L.175-186은 volume > 0 filter 이미 존재하지만 count 최소 임계 없음
// 강화:
var sumTurnover = 0, count = 0;
for (var w = idx - 19; w <= idx; w++) {
  var c = candles[w];
  if (c && c.close > 0 && c.volume > 0) {
    sumTurnover += (c.close * c.volume) / (meta.marketCap * 1e8);
    count++;
  }
}
// 최소 10일 이상 거래 있어야 신뢰 (거래정지 11일 이상 시 null)
if (count >= 10) out.liquidity20d = (sumTurnover / count) * 100;  // × 100 for %
// training L.350 와 unit 정합 (daily_turnover * 100)
```

⚠️ **Unit fix**: 기존 L.185 `out.liquidity20d = sumTurnover / count;` 는 training (`factors[i, 4] = daily_turnover * 100`) 대비 100× 부족. **B-2에서 반드시 ×100 추가**.

### E-4: 60-day lookback 미확보 (`idx < 60`)

```js
// 기존 L.129: if (candles.length < 60 || idx < 60 ...) return null;
// 이는 전체 factor 객체를 null로 반환 → 보수적
// 부분 결측 허용으로 변경 (training과 일치):
//   - momentum60d, beta60d: idx >= 60 필요 → 미만 시 null (현재 동작 유지)
//   - valueInvPbr, logSize: lookback 무관 → 항상 계산
//   - liquidity20d: idx >= 19 필요
// 권장: return null 대신 항상 object 반환, 부족한 필드만 null
if (!candles || idx == null || idx < 0 || idx >= candles.length) return null;
// (기존 idx < 60 gate 제거; 각 factor 내부에서 개별 gate)
```

### E-5: `marketReturns60d` 누락 또는 길이 불일치

```js
// beta60d: 현재 L.148 `length === 60` 체크 양호
// 강화: finite check 추가
if (Array.isArray(meta.marketReturns60d) &&
    meta.marketReturns60d.length === 60 &&
    meta.marketReturns60d.every(function(r) { return typeof r === 'number' && isFinite(r); })) {
  // ... 기존 beta 계산
}
// 누락 시 null 유지 → zscoreCohort에서 0으로 변환 → predict 기여 0
```

### 추가: zscoreCohort 핵심 구현 (10-20줄)

```js
function zscoreCohort(rawList) {
  var n = rawList.length;
  if (n < 5) {
    // 표본 부족 → 모두 0
    return rawList.map(function() {
      return { momentum60d: 0, beta60d: 0, valueInvPbr: 0, logSize: 0, liquidity20d: 0 };
    });
  }
  var factors = ['momentum60d','beta60d','valueInvPbr','logSize','liquidity20d'];
  var params = {};  // factor → { median, mad }
  factors.forEach(function(fname) {
    var vals = rawList
      .map(function(r) { return r ? r[fname] : null; })
      .filter(function(v) { return typeof v === 'number' && isFinite(v); });
    if (vals.length < 3) { params[fname] = null; return; }
    vals.sort(function(a, b) { return a - b; });
    var median = vals[Math.floor(vals.length / 2)];
    var absdev = vals.map(function(v) { return Math.abs(v - median); }).sort(function(a, b) { return a - b; });
    var mad = absdev[Math.floor(absdev.length / 2)];
    var scale = mad > 1e-10 ? mad * 1.4826 : null;
    if (scale == null) {
      // MAD 0 → fallback: sample std
      var mean = vals.reduce(function(s, v) { return s + v; }, 0) / vals.length;
      var varS = vals.reduce(function(s, v) { return s + (v - mean) * (v - mean); }, 0) / (vals.length - 1);
      scale = Math.sqrt(varS);
    }
    params[fname] = (scale > 1e-10) ? { median: median, scale: scale } : null;
  });

  return rawList.map(function(raw) {
    var out = { momentum60d: 0, beta60d: 0, valueInvPbr: 0, logSize: 0, liquidity20d: 0 };
    if (!raw) return out;
    factors.forEach(function(fname) {
      var v = raw[fname];
      var p = params[fname];
      if (p && typeof v === 'number' && isFinite(v)) {
        var z = (v - p.median) / p.scale;
        out[fname] = Math.max(-3, Math.min(3, z));  // winsorize
      }
    });
    return out;
  });
}
```

---

## (F) Phase B 구현 체크리스트

### Pre-B: μ/σ backfill 필요 여부

**불필요.** 옵션 C 채택 → offline pipeline 수정 없음, `mra_apt_coefficients.json` schema 변경 없음.

### B-1: aptModel.js 확장 (30 min)

- [ ] `computeFactors` edge case 강화 (E-1~E-5 반영)
  - `pbr > 0.01` gate (training L.331 정합)
  - `liquidity20d` unit fix: `× 100` 추가 (training L.350 정합) ← **BUG FIX**
  - `liquidity20d` count ≥ 10 minimum
  - `marketReturns60d` 배열 원소 finite check
  - return early 조건 완화 (`idx < 60` 제거, factor별 gate로 분산)
- [ ] `zscoreCohort(rawList)` 신규 함수 (E 섹션 구현체 그대로)
- [ ] public API 추가: `return { ..., zscoreCohort: zscoreCohort }`
- [ ] JSDoc 업데이트 (`@returns` 스키마 명시)

### B-2: backtester.js _collectOccurrences 변경 (30 min)

- [ ] **2-pass 재구성**:
  - Pass 1: 기존 for 루프에서 각 pattern idx에 대해 `aptModel.computeFactors(candles, idx, meta)` 호출 → `rawFactorsList[i]` 저장 (aptPrediction 계산은 연기)
  - Pass 2: 루프 밖에서 `zFactorsList = aptModel.zscoreCohort(rawFactorsList)` 1회 호출
  - Pass 3: 각 occurrence push 시 `aptModel.predict({ ..., z fields })` 호출 후 `aptPrediction` 주입
- [ ] `meta` 공급: 현재 stock의 `marketCap` / `pbr` / `marketReturns60d`를 어디서 받아올지 결정
  - **Option 1 (권장)**: `_collectOccurrences(candles, patternType, stockMeta)` signature 확장. 호출처 (`backtestAll`)에서 `window.appState`나 `currentStock` meta 전달
  - **Option 2**: `candles`에 meta 필드 주입 (비침습적이나 cache invalidation 복잡)
- [ ] Worker context에서는 `typeof aptModel === 'undefined'` → Pass 2, 3 skip, `aptPrediction = null` (Phase 6 현재 동작 유지)

### B-3: financials.js helper 필요 여부

**조건부 필요.** 현재 `_collectOccurrences`는 meta 없이 동작. B-2 Option 1을 채택하면:

- [ ] `js/financials.js`에 `getStockMeta(stockCode)` getter 추가 (memory cache 활용)
  - 반환: `{ marketCap, pbr, marketType, currentPrice }`
  - ALL_STOCKS index.json + `data/financials/{code}.json` 조합
- [ ] `marketReturns60d`는 별도 source 필요:
  - **권장**: `data/kospi_index.json` 또는 `data/macro/bonds_latest.json` 같은 형식의 index OHLCV 일간 수익률 60개
  - 없으면 **beta60d는 null 유지** (training coverage 75.6% → 나머지도 null 많음, missing-data tolerant)

**단순화 경로**: `marketReturns60d`를 제공하지 않아 beta60d=null이어도 4/5 factor(momentum/value/size/liquidity) 활성화 → lift의 주된 원천. Phase 7 MVP로 충분. Phase 8에서 beta 활성화.

### B-4: 검증 및 diagnostic (30 min)

- [ ] `aptModel.zscoreCohort` 유닛 테스트 (브라우저 콘솔):
  - n=3 → 모두 0 반환
  - n=10, 한 필드 전부 동일 값 → 해당 필드 z=0 반환 (MAD=0 fallback 동작 확인)
  - 극단값 포함 → `|z| ≤ 3` 보장
- [ ] `backtester.js` IC diagnostic 확장 (기존 2209 라인 근처):
  - `icApt_h5`: Spearman(aptPrediction, actualReturn_h5) for n≥20
  - `icBaseline_h5`: Spearman(baseline_confidence, actualReturn_h5) — already exists?
  - `ic_lift = icApt - icBaseline`
  - `icir_apt = mean(icApt_daily) / std(icApt_daily)` (Phase 7 성공 임계 ICIR≥0.3용)
- [ ] Phase 7 성공 임계 5항 측정 로그 콘솔 출력 (나중 Phase C audit agent 검증용)

### 배포 순서

1. B-1 (aptModel.js) 먼저 — 단독 배포 가능 (zscoreCohort 미사용이면 no-op)
2. B-2 + B-3 동시 — _collectOccurrences signature 변경과 meta 공급 helper는 동반 배포
3. B-4 diagnostic — 이미 수집된 occurrence 활용, observation-only

**Non-breaking 보장**: aptPrediction이 여전히 orphan field (Phase 6 계약 보존). Failure 시 null → 기존 UI path 영향 없음.

---

## 결론 (one-line)

**옵션 C (client cohort robust z-score: median + MAD×1.4826, winsorize [-3,3])** — offline pipeline과 동일한 공식을 client에 포팅하여 math symmetry 확보, μ/σ backfill/재배포 불필요, 특허 노출도 최소, 40-50분 구현. Phase B 즉시 착수 가능.

**Critical bug found during design**: 기존 `aptModel.computeFactors` L.185의 `liquidity20d` unit은 training pipeline L.350 대비 `×100` 누락 → B-1에서 반드시 수정.
