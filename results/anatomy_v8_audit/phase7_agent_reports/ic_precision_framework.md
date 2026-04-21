# IC Precision Framework — 10-Layer Information Coefficient Measurement

**Agent**: statistical-validation-expert
**Planning date**: 2026-04-21
**Target**: Phase 7 P7-001 APT 5-factor 활성화 후 client-side IC 정밀 측정
**Scope**: `js/backtester.js` `_computeStats` L.1483-2236
**Execution context**: Web Worker (`importScripts` via `analysisWorker.js`) — `aptModel` 접근 불가, `occ.aptFactors` / `occ.aptPrediction` 기반 사후 계산

---

## Executive Summary

현재 구현 상태 (Phase 6, commit 7511a44e6):

```javascript
// js/backtester.js L.2208-2230
if (h === 5 && validOccs.length >= 20) {
  // Pooled Spearman IC over all occurrences, point estimate only.
  // No pairing with WLS baseline; no cross-sectional aggregation;
  // no ICIR; h=5 only; no CI; no null-contamination split.
  stats.icApt = +icApt.toFixed(3);
}
```

**진단된 구조적 결함 6종**:

1. **Pairing 실패**: `stats.ic` (5-col WLS baseline, OOS rolling) 와 `stats.icApt` (APT pooled, in-sample)이 서로 다른 n·표본 부분집합에서 측정 → 비교 무효 (fair comparison principle 위반)
2. **Pooled bias**: 전 occurrence를 한 벡터로 합쳐 Spearman 계산 → cross-sectional date-effect 평균화 안됨. 실제로 single-date에서 signal이 noise라도 calendar drift가 유사 IC를 유도 가능 (Hou-Xue-Zhang 2020)
3. **Precision 부재**: ICIR (= mean/std of IC_t) 없음 → IC=0.10이 운 좋은 single-date 결과인지 stable signal인지 구분 불가 (Grinold-Kahn 1999)
4. **Horizon myopia**: h=5만 측정, h∈{1,3,10,20} 미수집 → persistence 구조 판단 불가
5. **CI 부재**: 점 추정만 존재, Fisher z-transform 또는 bootstrap 없음 → `IC=0.08`이 0과 통계적으로 유의한지 미검증
6. **Null contamination**: `aptPrediction != null` 조건만 필터링. 5-factor 중 1-4개 null인 경우도 포함될 수 있음 → full-factor subset과 partial subset의 IC가 섞여 있음

**P7-MVP 범위 (6 layers)**: L1 + L2 + L3 + L4 + L5 + L9
**Phase 8 이월 (4 layers)**: L6 + L7 + L8 + L10

**성공 임계값** (5/5 통과 시 GO):

| Criterion | Threshold | 근거 |
|-----------|-----------|------|
| annualized ICIR (h=5) | ≥ 0.3 | Grinold (1999), active manager benchmark |
| mean IC lift vs WLS baseline (paired subset) | ≥ +0.015 | Harvey-Liu-Zhu (2016) meaningful effect |
| Fisher 95% CI lower bound (h=5) | > 0 | Statistical significance |
| fullFactorRatio (5/5 non-null) | ≥ 0.5 | Data coverage sanity |
| Sign consistency h∈{3,5,10} | 3/3 same sign | Persistence / not noise |

---

## Layer-by-Layer Specification

### L1 — Pairing (Fair Comparison)

#### 수학적 정의

APT와 WLS가 동일한 occurrence 집합 `S_pair ⊆ validOccs`에서 정의될 때만 비교:

$$
S_{\text{pair}} = \{ i \in \{1, \ldots, N\} : \hat{y}_i^{\text{APT}} \ne \text{null} \land \hat{y}_i^{\text{WLS}} \ne \text{null} \land r_i^{(h)} \text{ defined} \}
$$

$$
\text{IC}_{\text{APT}}^{\text{paired}} = \rho_S(\hat{y}^{\text{APT}}_{S_{\text{pair}}},\; r^{(h)}_{S_{\text{pair}}}), \quad
\text{IC}_{\text{WLS}}^{\text{paired}} = \rho_S(\hat{y}^{\text{WLS}}_{S_{\text{pair}}},\; r^{(h)}_{S_{\text{pair}}})
$$

$\rho_S$는 Spearman rank correlation. **IC lift = IC_APT_paired − IC_WLS_paired**.

#### 구현 난이도

- LOC: **~25 lines** (기존 `_spearmanCorr` 재사용)
- 난이도: 낮음 (filtering + 2회 Spearman 호출)

#### P7-MVP 배정 근거

**MVP 필수**. Unpaired 비교는 methodology 자체가 무효하므로 이 layer가 빠지면 다른 9개 layer가 모두 무의미. 비용 최저(25 LOC), 효익 최대.

#### Pseudocode

```javascript
// Step L1: Build paired subset
var pairedIdx = [];
var aptPreds = [];
var wlsPreds = [];
var rets = [];

for (var i = 0; i < validOccs.length; i++) {
  var occ = validOccs[i];
  // APT prediction must exist
  if (occ.aptPrediction == null || !isFinite(occ.aptPrediction)) continue;

  // Compute WLS prediction for same occurrence (mirrors L.2162-2173 WLS baseline)
  // reg must be available from the surrounding WLS-fit block
  if (!reg || !reg.coeffs) continue;
  var xWLS = [
    1,
    (occ.confidencePred || occ.confidence || 50) / 100,
    occ.trendStrength || 0,
    Math.log(Math.max(occ.volumeRatio || 1, 0.1)),
    occ.atrNorm || 0.02,
  ];
  var wlsPred = 0;
  for (var j = 0; j < xWLS.length; j++) wlsPred += xWLS[j] * reg.coeffs[j];
  if (!isFinite(wlsPred)) continue;

  pairedIdx.push(i);
  aptPreds.push(occ.aptPrediction);
  wlsPreds.push(wlsPred);
  rets.push(returns[i]);
}

var nPaired = pairedIdx.length;
if (nPaired < 20) {
  // Abort diagnostic — sample too small for reliable comparison
  return null;
}

var aptPairs = aptPreds.map(function(p, k) { return [p, rets[k]]; });
var wlsPairs = wlsPreds.map(function(p, k) { return [p, rets[k]]; });
var icAptPaired = this._spearmanCorr(aptPairs);
var icWlsPaired = this._spearmanCorr(wlsPairs);
var icLift = (icAptPaired != null && icWlsPaired != null)
  ? +(icAptPaired - icWlsPaired).toFixed(4)
  : null;
```

#### 임계값 판정

| Outcome | Action |
|---------|--------|
| `nPaired < 20` | return diagnostic=null, log warning "insufficient_paired_sample" |
| `nPaired ≥ 20` & `icLift ≥ +0.015` | PASS (lift criterion met at L1 level) |
| `nPaired ≥ 20` & `icLift ∈ [0, +0.015)` | WARN (positive but below threshold) |
| `nPaired ≥ 20` & `icLift < 0` | FAIL (APT worse than WLS on same cohort) |

#### Phase 8 진입 트리거

- `icLift < -0.005` → Phase 8 L7 (factor decomposition) 활성화 필요: 어떤 factor가 WLS baseline 대비 손해를 입히는지 LOO 진단
- `nPaired < 20` 지속 → Phase 8 data collection 우선 (P7 GO 불가)

---

### L2 — Cross-Sectional IC per Date

#### 수학적 정의

날짜 $t$ 에 occur한 pattern 집합 $S_t$ 내에서의 rank correlation:

$$
\text{IC}_t = \rho_S\left(\hat{y}^{\text{APT}}_{S_t},\; r^{(h)}_{S_t}\right), \quad |S_t| \ge k_{\min}
$$

$$
\overline{\text{IC}}_{\text{XS}} = \frac{1}{|T_{\text{valid}}|} \sum_{t \in T_{\text{valid}}} \text{IC}_t
$$

여기서 $T_{\text{valid}} = \{ t : |S_t| \ge k_{\min} \}$, $k_{\min}=5$ (Spearman 최소 n).

#### 구현 난이도

- LOC: **~40 lines** (groupBy + Spearman per group)
- 난이도: 중 (날짜 정규화, min-count guard)

#### P7-MVP 배정 근거

**MVP 필수**. Pooled IC의 가장 큰 편향 원인이 cross-date contamination. Fama-MacBeth 전통 + Hou-Xue-Zhang (2020) "Replicating Anomalies" 표준 프로토콜. Browser-scale (수천 occs)에서 date별 group size가 대개 작아 (Korean market ~200 patterns/day maximum), per-date IC 분산이 큼 → ICIR 분모 확보(L3 전제)에도 반드시 필요.

#### Pseudocode

```javascript
// Step L2: Cross-sectional IC aggregation
// Each occurrence has occ.dateKey (YYYY-MM-DD at pattern-detection time)
// For Worker context, dateKey is set from candles[occ.idx].time

function normalizeDate(t) {
  // t may be string "YYYY-MM-DD" (daily) or Unix timestamp seconds (intraday)
  if (typeof t === 'string') return t.slice(0, 10);
  if (typeof t === 'number') {
    // KST = UTC+9; match data.js convention: add 9h offset before taking date
    var d = new Date((t + 9 * 3600) * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

var byDate = Object.create(null);  // dateKey → [{pred, ret}, ...]
for (var i = 0; i < pairedIdx.length; i++) {
  var occ = validOccs[pairedIdx[i]];
  var dk = normalizeDate(candles[occ.idx] && candles[occ.idx].time);
  if (!dk) continue;
  if (!byDate[dk]) byDate[dk] = [];
  byDate[dk].push([aptPreds[i], rets[i]]);
}

var K_MIN = 5;
var icPerDate = [];  // IC_t values
var dateKeys = [];
for (var key in byDate) {
  var pairs = byDate[key];
  if (pairs.length < K_MIN) continue;
  var ic_t = this._spearmanCorr(pairs);
  if (ic_t != null && isFinite(ic_t)) {
    icPerDate.push(ic_t);
    dateKeys.push(key);
  }
}

var nDates = icPerDate.length;
if (nDates < 10) {
  // Fall back to pooled IC with flag
  diagnostic.icApt = icAptPaired;
  diagnostic.icXS = null;
  diagnostic.icXSIsPooled = true;
  diagnostic.xsWarning = 'insufficient_dates';
} else {
  var sumIC = 0;
  for (var d = 0; d < nDates; d++) sumIC += icPerDate[d];
  var meanIC_XS = sumIC / nDates;
  diagnostic.icApt = +meanIC_XS.toFixed(4);  // primary XS IC
  diagnostic.icXS = +meanIC_XS.toFixed(4);
  diagnostic.icXSIsPooled = false;
  diagnostic.nDates = nDates;
}
```

#### 임계값 판정

| Outcome | Action |
|---------|--------|
| `nDates < 10` | FAIL (insufficient cross-section), fallback to pooled IC with `icXSIsPooled=true` flag |
| `nDates ∈ [10, 30)` | WARN (sparse panel), ICIR will be noisy |
| `nDates ≥ 30` | OK (proceed to L3) |

#### Phase 8 진입 트리거

- `nDates < 10` in production → Phase 8 L8 (stratified IC)로 우회: 전체를 KOSPI/KOSDAQ × size × vol-regime 27 cells로 쪼개 각 cell 내 누적 표본 확보

---

### L3 — ICIR (Information Coefficient Information Ratio)

#### 수학적 정의

$$
\text{ICIR} = \frac{\overline{\text{IC}}_{\text{XS}}}{\sigma(\text{IC}_t)}, \quad
\sigma(\text{IC}_t) = \sqrt{\frac{1}{n_{\text{dates}} - 1}\sum_{t}(\text{IC}_t - \overline{\text{IC}}_{\text{XS}})^2}
$$

연율화 (Grinold 1999):

$$
\text{ICIR}_{\text{ann}} = \text{ICIR} \cdot \sqrt{\frac{252}{h}}
$$

$h=5$ 기준 scaling factor $\sqrt{50.4} \approx 7.1$. 주의: 이 annualization은 per-date IC가 해당 horizon window 내에서 i.i.d.라는 가정 — h=5에서는 partial overlap (Monday pattern의 t+5 = Monday 다음 주, Tuesday pattern의 t+5 = 다음 주 화요일) 존재하므로 Newey-West 보정이 이상적이나, 현 단계에서는 simple √ annualization 사용하고 Phase 8 L6 bootstrap CI에서 해결.

#### 구현 난이도

- LOC: **~15 lines** (L2 결과 재사용)
- 난이도: 낮음

#### P7-MVP 배정 근거

**MVP 필수**. IC 점 추정만으로는 "IC=0.08이 stable signal인지 한 날 운이었는지" 구분 불가. Active-management 문헌의 표준 (Grinold-Kahn 1999 "Active Portfolio Management" Ch.4). ICIR≥0.3 annualized는 top-quartile manager benchmark.

#### Pseudocode

```javascript
// Step L3: ICIR computation
if (nDates >= 10) {
  var sumSq = 0;
  for (var d = 0; d < nDates; d++) {
    var dev = icPerDate[d] - meanIC_XS;
    sumSq += dev * dev;
  }
  var varIC = sumSq / (nDates - 1);
  var stdIC = Math.sqrt(Math.max(varIC, 0));

  if (stdIC > 1e-6) {
    var icir = meanIC_XS / stdIC;
    // Annualize: ICIR_ann = ICIR * sqrt(252 / h)
    var icirAnn = icir * Math.sqrt(252 / h);
    diagnostic.icir = +icir.toFixed(3);
    diagnostic.icirAnn = +icirAnn.toFixed(3);
    diagnostic.stdICPerDate = +stdIC.toFixed(4);
  } else {
    diagnostic.icir = null;
    diagnostic.icirAnn = null;
    diagnostic.stdICPerDate = 0;
  }
}
```

#### 임계값 판정

| icirAnn (h=5) | Grade | Action |
|---------------|-------|--------|
| ≥ 0.50 | Excellent | PASS |
| ∈ [0.30, 0.50) | Good | PASS |
| ∈ [0.10, 0.30) | Weak | WARN (signal exists but low consistency) |
| ∈ [0, 0.10) | Marginal | FAIL (not distinguishable from random manager) |
| < 0 | Adverse | FAIL (reverse signal) |

P7 GO 임계값: **icirAnn (h=5) ≥ 0.30**.

#### Phase 8 진입 트리거

- `icirAnn ∈ [0.10, 0.30)` → Phase 8 L6 (block bootstrap CI)로 ICIR의 불확실성 정량화: 만약 bootstrap CI lower가 0.3 이상이면 recoverable; 아니면 Phase 8 L7 (factor decomp)으로 어떤 factor가 consistency를 해치는지 진단
- `icirAnn < 0.10` 지속 → APT 모델 자체 재학습 (offline pipeline regression)

---

### L4 — Multi-Horizon h ∈ {1, 3, 5, 10, 20}

#### 수학적 정의

각 $h \in \mathcal{H} = \{1, 3, 5, 10, 20\}$ 에 대해 L1-L3을 반복:

$$
\text{IC}_{\text{XS}}(h), \quad \text{ICIR}_{\text{ann}}(h) = \text{ICIR}(h) \cdot \sqrt{\frac{252}{h}}
$$

**Sign consistency test**:

$$
\text{signConsistent} = \mathbb{1}\Big[\text{sign}(\text{IC}_{\text{XS}}(3)) = \text{sign}(\text{IC}_{\text{XS}}(5)) = \text{sign}(\text{IC}_{\text{XS}}(10))\Big]
$$

#### 구현 난이도

- LOC: **~0 추가** (`_computeStats`의 outer horizon loop에 자연스럽게 포함)
- 난이도: 낮음 (단 L2/L3 결과를 horizon별로 저장 구조만 필요)

#### P7-MVP 배정 근거

**MVP 필수**. Single-horizon IC는 coincidence 가능성 높음 (Jegadeesh-Titman 1993 momentum horizon sensitivity). Sign consistency는 random-walk null과 구분하는 cheapest-yet-strongest test. 추가 LOC 비용 거의 0 (loop 재사용).

#### Pseudocode

```javascript
// Outer loop in _computeStats — already exists
// for (const h of horizons) { ... }
// horizons must include [1, 3, 5, 10, 20] for L4

// After L1-L3 per horizon:
stats.aptDiagnostic = {
  icApt: diagnostic.icApt,
  icir: diagnostic.icir,
  icirAnn: diagnostic.icirAnn,
  // ... (per-horizon fields)
};

// After the outer horizon loop completes, aggregate sign consistency:
// (Place this AFTER the for-horizon loop closes)
var aggDiag = {};
var signs = {};
for (var h of [3, 5, 10]) {
  var d = result[h] && result[h].aptDiagnostic;
  if (d && d.icApt != null) signs[h] = Math.sign(d.icApt);
}
if (signs[3] != null && signs[5] != null && signs[10] != null) {
  aggDiag.signH = { '3': signs[3], '5': signs[5], '10': signs[10] };
  aggDiag.signConsistent = (signs[3] === signs[5] && signs[5] === signs[10] && signs[5] !== 0);
}
// Attach to result as meta (not horizon-keyed)
result._aptMeta = aggDiag;
```

#### 임계값 판정

| Sign consistency h∈{3,5,10} | Action |
|------------------------------|--------|
| 3/3 positive & `icirAnn(5) ≥ 0.3` | PASS (signal + persistence confirmed) |
| 2/3 positive | WARN (horizon-specific noise) |
| 3/3 negative | FAIL but useful (invert signal direction — rare but diagnostic) |
| Mixed signs | FAIL (noise) |

Additional horizon-specific checks:
- h=1: IC often dominated by microstructure noise (bid-ask bounce). If |IC(1)| > |IC(5)| × 1.5 → WARN (likely leakage/look-ahead)
- h=20: Requires ≥20-trading-day lookback post-pattern. If many occurrences recent → nValid(20) low → skip gracefully

#### Phase 8 진입 트리거

- Sign consistency 2/3 → Phase 8 L6 (block bootstrap) 각 horizon별 CI 산출해 어느 h가 noise 영역인지 확인
- h=1 anomaly → look-ahead bias 조사 (occ.idx vs entry idx 검증)

---

### L5 — Fisher 95% CI via z-Transform

#### 수학적 정의

Fisher (1921) z-transformation:

$$
z = \frac{1}{2} \ln\left(\frac{1 + r}{1 - r}\right) = \text{arctanh}(r)
$$

$z$의 표준오차:

$$
\text{SE}(z) = \frac{1}{\sqrt{n_{\text{eff}} - 3}}
$$

95% CI in z-space:

$$
z \pm 1.96 \cdot \text{SE}(z)
$$

역변환 (tanh):

$$
r_{\text{lower}} = \tanh(z - 1.96 / \sqrt{n_{\text{eff}} - 3}), \quad
r_{\text{upper}} = \tanh(z + 1.96 / \sqrt{n_{\text{eff}} - 3})
$$

**$n_{\text{eff}}$ 선택 (중요)**:
- IC is per-date cross-sectional mean over $n_{\text{dates}}$ dates
- Each IC_t is itself estimated from $|S_t|$ pairs, but the sampling distribution of the mean IC is over dates → $n_{\text{eff}} = n_{\text{dates}}$
- Using $n_{\text{pairs}}$ (전체 N) would under-state SE because of within-date clustering (dependence)
- **규칙**: `nEff = nDates` for cross-sectional IC, `nEff = nPairs` for pooled IC only

Edge cases:
- $n_{\text{eff}} \le 3$: CI undefined → return `{lower: null, upper: null}`
- $|r| \ge 1 - 10^{-6}$: clip to $r \mapsto \text{sign}(r) \cdot (1 - 10^{-6})$ before arctanh (prevents $\pm\infty$)
- $r = 0$ exactly: $z=0$, CI = $\tanh(\pm 1.96/\sqrt{n-3})$

#### 구현 난이도

- LOC: **~20 lines** (pure math)
- 난이도: 낮음

#### P7-MVP 배정 근거

**MVP 필수**. 점 추정만으로는 "IC=0.08 > 0?" 검정 불가. Fisher CI는 Bootstrap(L6) 대비 compute cost 10,000× 낮음 (O(1) vs O(B·n·log n)). Browser scale에서 즉시 계산 가능. APT predictor와 returns의 ranks가 bivariate normal이라는 가정이 약간 있으나 (rank-correlation이므로 덜 민감), robust alternative (bootstrap)는 Phase 8.

#### Pseudocode

```javascript
/**
 * Fisher 95% CI for correlation coefficient.
 * @param {number} r - correlation (Spearman rho)
 * @param {number} nEff - effective sample size for SE of mean IC
 *   - For cross-sectional IC: nEff = nDates
 *   - For pooled IC: nEff = nPairs
 * @returns {{lower: number|null, upper: number|null}}
 */
_fisherCI(r, nEff) {
  if (r == null || !isFinite(r) || nEff == null || nEff < 4) {
    return { lower: null, upper: null };
  }
  // Clip extreme r to prevent log(0)
  var rClip = r;
  if (rClip >= 1) rClip = 1 - 1e-6;
  if (rClip <= -1) rClip = -1 + 1e-6;
  var z = 0.5 * Math.log((1 + rClip) / (1 - rClip));  // arctanh(r)
  var se = 1 / Math.sqrt(nEff - 3);
  var zLo = z - 1.96 * se;
  var zHi = z + 1.96 * se;
  // Back-transform: r = tanh(z) = (e^{2z} - 1) / (e^{2z} + 1)
  function tanh(x) {
    var e2 = Math.exp(2 * x);
    return (e2 - 1) / (e2 + 1);
  }
  return {
    lower: +tanh(zLo).toFixed(4),
    upper: +tanh(zHi).toFixed(4),
  };
}

// Usage in diagnostic:
var ci95 = this._fisherCI(diagnostic.icApt, diagnostic.nDates);
diagnostic.ci95 = ci95;
```

#### 임계값 판정

| CI state | Action |
|----------|--------|
| `ci95.lower > 0` | PASS (IC significantly positive at α=0.05) |
| `ci95.lower ≤ 0 < ci95.upper` | WARN (CI spans zero — effect direction uncertain) |
| `ci95.upper ≤ 0` | FAIL (IC significantly negative — inverse predictor) |
| `ci95.lower == null` | FAIL (insufficient n) |

P7 GO 임계값: **ci95.lower (h=5) > 0**.

#### Phase 8 진입 트리거

- `ci95.lower ∈ [-0.01, 0.01]` (boundary case) → Phase 8 L6 (block bootstrap) 활성화: Fisher CI는 i.i.d. 가정 위반 시 (within-date clustering) over-precise 가능. Bootstrap CI가 더 conservative한 판단 제공
- `ci95.upper ≤ 0` → 신호 반전 가능성 → Phase 8 L7 (factor decomp) 필수

---

### L6 — Block Bootstrap CI (PHASE 8)

#### 수학적 정의

Politis-Romano (1994) stationary block bootstrap. Resample blocks of length $L \sim \text{Geometric}(1/L_{\text{avg}})$ with $L_{\text{avg}} = 5-10$ (daily data).

$$
\text{IC}^{*(b)} = \rho_S(\hat{y}^{\text{APT}*(b)}, r^{*(b)}), \quad b = 1, \ldots, B
$$

95% CI: percentile method $[\text{IC}^{(B\cdot 0.025)}, \text{IC}^{(B\cdot 0.975)}]$ 또는 BCa (기존 `_bcaCI` 재사용).

#### 구현 난이도

- LOC: **~80 lines** (block resampler + B=1000 loop)
- 난이도: 높음 (B=1000 × n=2000 occs × per-date groupby = 10^7 ops, ~2-5s. `_computeStats` 전체 500ms 예산 초과)

#### P7-MVP 배정 근거

**Phase 8 이월**. 이유:
1. **Compute cost**: Browser scale에서 B=1000 × Spearman(n~2000)은 Worker에서도 무시 불가. 다른 horizons과 stratification 곱하면 분 단위.
2. **Fisher CI로 대체 충분 (95%)**: L5 Fisher CI는 within-date clustering을 무시하므로 over-precise 경향이 있으나, boundary 케이스(CI가 0 부근)에서만 문제. 대부분 pattern은 Fisher CI로 판정 충분.
3. **우선순위**: L1-L5가 먼저 통과해야 L6 의미 있음. L5 fail시 L6 해봐도 fail.

#### Pseudocode (참고용, Phase 8 구현)

```javascript
_blockBootstrapIC(pairs, blockAvg, B) {
  blockAvg = blockAvg || 7;  // stationary block avg length
  B = B || 1000;
  var n = pairs.length;
  if (n < 30) return null;
  var bootICs = [];
  for (var b = 0; b < B; b++) {
    var resampled = [];
    while (resampled.length < n) {
      var start = Math.floor(Math.random() * n);
      var blockLen = Math.ceil(-blockAvg * Math.log(Math.random()));  // Geom(1/L)
      for (var k = 0; k < blockLen && resampled.length < n; k++) {
        resampled.push(pairs[(start + k) % n]);
      }
    }
    var icB = this._spearmanCorr(resampled);
    if (icB != null) bootICs.push(icB);
  }
  bootICs.sort(function(a, b) { return a - b; });
  return {
    lower: bootICs[Math.floor(B * 0.025)],
    upper: bootICs[Math.floor(B * 0.975)],
    median: bootICs[Math.floor(B * 0.5)],
  };
}
```

#### 임계값 판정

Phase 8 내부. Fisher CI가 통과한 경우에만 bootstrap CI로 confirm. Bootstrap CI가 Fisher보다 넓고 lower > 0 유지하면 "robust significant".

#### Phase 7 → Phase 8 트리거

- L5 Fisher CI lower ∈ [-0.01, 0.01] (boundary) → L6 required
- L5 PASS + critic review 요구 시 confirmatory analysis

---

### L7 — Factor Decomposition (LOO-IC + SFO-IC) (PHASE 8)

#### 수학적 정의

5 factors $\mathcal{F} = \{\text{size}, \text{value}, \text{momentum}, \text{liquidity}, \text{reversal}\}$. 각 factor $f$ 에 대해:

**LOO (Leave-One-Out)** — factor $f$ 제외 예측:

$$
\hat{y}_i^{-f} = \sum_{g \ne f} \beta_g \cdot z_{i,g}, \quad \text{IC}_{-f} = \rho_S(\hat{y}^{-f}, r^{(h)})
$$

**Marginal contribution of $f$**:

$$
\Delta\text{IC}_f^{\text{LOO}} = \text{IC}_{\text{full}} - \text{IC}_{-f}
$$

**SFO (Single-Factor-Only)**:

$$
\hat{y}_i^{\{f\}} = \beta_f \cdot z_{i,f}, \quad \text{IC}_{\{f\}} = \rho_S(\hat{y}^{\{f\}}, r^{(h)})
$$

양자 비교: LOO > 0 이면 factor $f$는 portfolio에 기여. SFO > 0 이면 독자적 signal. (LOO high + SFO low) = factor는 다른 factor와 interaction으로만 유용.

#### 구현 난이도

- LOC: **~120 lines** (5 × 2 × horizons combinations + aggregation)
- 난이도: 중-상 (factor-specific reprediction은 `aptModel.predict()` 없이 client에서 재계산 필요 → `occ.aptFactors[f]` 와 `occ.aptBetas` 둘 다 필요. Phase 7 상태에서 `aptBetas`가 `occ`에 주입되어야 함)

#### P7-MVP 배정 근거

**Phase 8 이월**. 이유:
1. **L7은 진단 도구**: P7-MVP는 "APT가 WLS보다 낫다" 판정만 요구. 어떤 factor가 기여하는지는 follow-up.
2. **Data dependency**: `occ.aptBetas` 주입이 `aptModel.predict()` API 수정 수반 → Phase 7 scope 초과.
3. **L1 fail 시 L7 필요**: L1에서 icLift < 0이면 L7 진입 트리거로 활용.

#### Phase 7 → Phase 8 트리거

- L1 `icLift < -0.005` → L7으로 어떤 factor가 손해 원인인지 진단
- L4 sign consistency 2/3 → L7으로 어떤 factor가 horizon-specific인지 조사

---

### L8 — Stratified IC (27 cells) (PHASE 8)

#### 수학적 정의

3 axes × 3 levels = 27 strata:

| Axis | Levels |
|------|--------|
| Market | KOSPI / KOSDAQ / KONEX |
| Size | Small (bottom 33%) / Mid (34-67%) / Large (top 33%) |
| Vol regime | Low (VKOSPI<15) / Mid (15-25) / High (>25) |

각 cell $c$ 내 IC:

$$
\text{IC}_c = \rho_S(\hat{y}^{\text{APT}}_{S_c}, r^{(h)}_{S_c}), \quad |S_c| \ge k_{\min}
$$

Consistency test: $\#\{c : \text{IC}_c > 0\} / \#\{c : |S_c| \ge k_{\min}\} \ge 0.6$ → signal is not regime-specific.

#### 구현 난이도

- LOC: **~100 lines** (3-axis grouping + per-cell IC)
- 난이도: 중 (size는 marketCap quantile, vol regime은 VKOSPI lookup 필요)

#### P7-MVP 배정 근거

**Phase 8 이월**. 이유:
1. **Data dependency**: vol regime은 `_macroLatest.vkospi` 참조 필요 — Worker 내에서 `_macroLatest` 접근 불가 (main thread 전용)
2. **Browser scale**: n~2000 occ를 27 cells로 쪼개면 평균 74 occ/cell → 일부 cell은 $k_{\min}=5$ 미만. Statistical power 부족.
3. **L2 fail 시 L8 필요**: L2에서 nDates<10이면 L8로 우회 (date 대신 cell aggregation)

#### Phase 7 → Phase 8 트리거

- L2 `nDates < 10` → L8으로 stratified aggregation 대체 (cell이 date보다 sample-rich)
- L4 sign inconsistency + `icir ≥ 0.3` (aggregate positive but horizon-mixed) → regime dependency 의심 → L8 진단

---

### L9 — Null Contamination Split

#### 수학적 정의

각 occurrence는 5 factor z-scores $\{z_1, \ldots, z_5\}$. `fullFactorCount_i = \#\{k : z_{i,k} \ne \text{null}\}$.

**Full subset** $S_{\text{full}} = \{i : \text{fullFactorCount}_i = 5\}$
**Partial subset** $S_{\text{part}} = \{i : 1 \le \text{fullFactorCount}_i \le 4\}$

각 subset에서 L1-L5 반복:

$$
\text{IC}_{\text{full}} = \rho_S(\hat{y}^{\text{APT}}_{S_{\text{full}}}, r^{(h)}_{S_{\text{full}}}), \quad
\text{IC}_{\text{part}} = \rho_S(\hat{y}^{\text{APT}}_{S_{\text{part}}}, r^{(h)}_{S_{\text{part}}})
$$

$$
\text{fullFactorRatio} = \frac{|S_{\text{full}}|}{|S_{\text{full}}| + |S_{\text{part}}|}
$$

**Contamination diagnosis**:
- $|\text{IC}_{\text{full}} - \text{IC}_{\text{part}}| > 0.05$ and $\text{IC}_{\text{full}} > \text{IC}_{\text{part}}$ → partial subset pollutes overall IC
- fullFactorRatio < 0.5 → 대부분 occurrence에 factor missing → data quality 문제

#### 구현 난이도

- LOC: **~40 lines** (split + 2회 IC 계산)
- 난이도: 낮음

#### P7-MVP 배정 근거

**MVP 필수**. Phase 7 P7-001이 "5-factor 전면 활성화"라는 것의 의미는 `occ.aptFactors`의 non-null 비율이 크게 개선된다는 것. 그러나 일부 종목(신규 상장, 적자 PBR 등)에서 factor missing 여전. 이 비율과 full-subset IC quality를 측정해야 Phase 8 scaling 계획 가능. **40 LOC 비용으로 data quality 판정**.

#### Pseudocode

```javascript
// Step L9: Null contamination split
// Requires occ.aptFactors = { size, value, momentum, liquidity, reversal } with possible null values
var fullPairs = [], partialPairs = [];
var fullDates = Object.create(null), partialDates = Object.create(null);

for (var i = 0; i < pairedIdx.length; i++) {
  var occ = validOccs[pairedIdx[i]];
  if (!occ.aptFactors) continue;
  var nonNull = 0;
  var factorKeys = ['size', 'value', 'momentum', 'liquidity', 'reversal'];
  for (var k = 0; k < factorKeys.length; k++) {
    var v = occ.aptFactors[factorKeys[k]];
    if (v != null && isFinite(v)) nonNull++;
  }
  var dk = normalizeDate(candles[occ.idx] && candles[occ.idx].time);
  if (nonNull === 5) {
    fullPairs.push([aptPreds[i], rets[i]]);
    if (dk) {
      if (!fullDates[dk]) fullDates[dk] = [];
      fullDates[dk].push([aptPreds[i], rets[i]]);
    }
  } else if (nonNull >= 1) {
    partialPairs.push([aptPreds[i], rets[i]]);
    if (dk) {
      if (!partialDates[dk]) partialDates[dk] = [];
      partialDates[dk].push([aptPreds[i], rets[i]]);
    }
  }
}

var nFull = fullPairs.length;
var nPartial = partialPairs.length;
var fullFactorRatio = (nFull + nPartial > 0) ? nFull / (nFull + nPartial) : 0;

diagnostic.fullFactorN = nFull;
diagnostic.partialFactorN = nPartial;
diagnostic.fullFactorRatio = +fullFactorRatio.toFixed(3);

// Full-subset cross-sectional IC
if (nFull >= 20) {
  var icFullXS = _xsMeanIC.call(this, fullDates, 5);  // helper below
  diagnostic.icFull = icFullXS.mean;
  diagnostic.icFullNDates = icFullXS.nDates;
  var ciFull = this._fisherCI(icFullXS.mean, icFullXS.nDates);
  diagnostic.icFullCI = ciFull;
}
// Partial-subset (contrast diagnostic only)
if (nPartial >= 20) {
  var icPartXS = _xsMeanIC.call(this, partialDates, 5);
  diagnostic.icPart = icPartXS.mean;
  diagnostic.icPartNDates = icPartXS.nDates;
}
if (diagnostic.icFull != null && diagnostic.icPart != null) {
  diagnostic.fullPartDelta = +(diagnostic.icFull - diagnostic.icPart).toFixed(4);
}

// Helper: cross-sectional mean IC from date-grouped pairs
function _xsMeanIC(dateMap, kMin) {
  var icArr = [];
  for (var key in dateMap) {
    if (dateMap[key].length < kMin) continue;
    var ic_t = this._spearmanCorr(dateMap[key]);
    if (ic_t != null && isFinite(ic_t)) icArr.push(ic_t);
  }
  if (icArr.length < 10) return { mean: null, nDates: icArr.length };
  var s = 0;
  for (var j = 0; j < icArr.length; j++) s += icArr[j];
  return { mean: +(s / icArr.length).toFixed(4), nDates: icArr.length };
}
```

#### 임계값 판정

| fullFactorRatio | Action |
|-----------------|--------|
| ≥ 0.8 | Excellent (5-factor activation 성공) |
| ∈ [0.5, 0.8) | PASS (MVP 목표치) |
| ∈ [0.3, 0.5) | WARN (data coverage 부족, Phase 8에서 개선 필요) |
| < 0.3 | FAIL (5-factor activation이 의도대로 작동 안함) |

| fullPartDelta | Interpretation |
|---------------|----------------|
| ≥ +0.03 | Full factor set이 partial보다 명확히 우수 — 5/5 요구 정당화 |
| ∈ [-0.03, +0.03] | No difference — partial factor도 사용 가능 (data efficiency 고려) |
| < -0.03 | Adverse — partial subset이 더 나음 (overfitting 가능성) |

#### Phase 7 → Phase 8 트리거

- `fullFactorRatio < 0.3` → Phase 7 P7-001 재검토 (financials meta 주입 실패 가능성)
- `fullPartDelta < -0.03` → Phase 8 L7 factor decomposition 필요: 어떤 factor가 존재할 때 성능 저하 일으키는지 조사

---

### L10 — HLZ Multiple Testing BH-FDR (PHASE 8)

#### 수학적 정의

Harvey-Liu-Zhu (2016, RFS): family-wise error rate correction across $K = 5 \text{ factors} \times 5 \text{ horizons} = 25$ hypotheses.

각 hypothesis $H_{f,h}: \text{IC}_{f,h} = 0$, $p$-value Fisher test:

$$
t_{f,h} = \text{IC}_{f,h} \cdot \sqrt{\frac{n_{\text{dates}} - 2}{1 - \text{IC}_{f,h}^2}} \sim t_{n_{\text{dates}} - 2}, \quad p_{f,h} = 2 \cdot (1 - F_t(|t_{f,h}|))
$$

Benjamini-Hochberg (1995) step-up at FDR level $q = 0.10$:

1. Sort $p_{(1)} \le p_{(2)} \le \ldots \le p_{(K)}$
2. Find largest $k$ : $p_{(k)} \le \frac{k}{K} \cdot q$
3. Reject all $H_{(i)}$ for $i \le k$

#### 구현 난이도

- LOC: **~80 lines** (t-dist CDF, BH sort, result aggregation)
- 난이도: 중 (t-CDF 구현 필요 — 기존에 없음. IncBeta incomplete beta function 근사 약 40 LOC)

#### P7-MVP 배정 근거

**Phase 8 이월**. 이유:
1. **Compute complexity**: t-CDF 구현 (incomplete beta) + BH sort는 사소하지만 필요한 인프라. P7-MVP scope에 부적합.
2. **Family-wise error는 L7 이후에만 의미**: Single factor 진단(L7)이 먼저 있어야 다중비교 대상 명확. L7 Phase 8이므로 L10도 Phase 8.
3. **현재 상황**: Phase 4-1 offline baseline에서 5 factor 모두 $p < 0.001$ 이미 확인 — 재검정 우선순위 낮음.

#### Phase 7 → Phase 8 트리거

- P7-001 MVP PASS 후 운영 단계에서 factor별 contribution 평가 요구 시

---

## Integrated Diagnostic Method

### `_computeAPTDiagnostic(validOccs, returns, h, candles, reg)` — Full Pseudocode

```javascript
/**
 * APT Diagnostic — 10-Layer IC Precision (MVP subset: L1+L2+L3+L4+L5+L9).
 * Called from _computeStats per horizon h.
 *
 * Phase 8 deferred layers: L6 (block bootstrap), L7 (factor decomp),
 * L8 (stratification), L10 (HLZ FDR).
 *
 * Invariants:
 * - Runs inside Web Worker context — no aptModel access, only occ.aptFactors.
 * - Returns plain object (postMessage-safe: no functions, no circular refs).
 * - Safe for n < 20 (returns null).
 * - Cost bound: O(n log n) per horizon for Spearman + O(nDates) for XS agg.
 *   n=2000, 5 horizons → ~100ms total on modern browser.
 *
 * @param {Array} validOccs - occurrences with aptPrediction + aptFactors
 * @param {Array} returns - aligned realized returns (same index as validOccs)
 * @param {number} h - horizon (days)
 * @param {Array} candles - full candle array for date lookup
 * @param {Object} reg - WLS regression result (for L1 pairing)
 * @returns {Object|null} diagnostic schema (see below) or null if insufficient
 *
 * Return schema:
 * {
 *   // L1 pairing
 *   icApt: number,          // paired cross-sectional mean IC (primary)
 *   icWls: number,          // paired WLS IC (comparison)
 *   icLift: number,         // icApt - icWls
 *   nPairs: number,         // |S_pair|
 *
 *   // L2 cross-sectional
 *   nDates: number,         // |T_valid|
 *   icXSIsPooled: boolean,  // true if fell back to pooled (nDates<10)
 *
 *   // L3 ICIR
 *   icir: number|null,      // raw ICIR (per-horizon)
 *   icirAnn: number|null,   // annualized ICIR = ICIR * sqrt(252/h)
 *   stdICPerDate: number,   // std of IC_t
 *
 *   // L5 Fisher CI
 *   ci95: { lower: number|null, upper: number|null },
 *
 *   // L9 null contamination
 *   fullFactorN: number,
 *   partialFactorN: number,
 *   fullFactorRatio: number,
 *   icFull: number|null,
 *   icFullCI: { lower, upper }|null,
 *   icPart: number|null,
 *   fullPartDelta: number|null,
 *
 *   // Meta
 *   horizon: number,
 *   kMin: number,
 *   mvpStatus: 'PASS'|'WARN'|'FAIL'|'INSUFFICIENT',
 *   failReason: string|null
 * }
 *
 * Sign consistency (L4) across horizons is aggregated AFTER the horizon loop
 * in result._aptMeta.
 */
_computeAPTDiagnostic(validOccs, returns, h, candles, reg) {
  var K_MIN = 5;  // min occurrences per date for IC_t
  var MIN_PAIRS = 20;

  // ---------- L1: Pairing ----------
  var pairedIdx = [];
  var aptPreds = [], wlsPreds = [], rets = [];
  for (var i = 0; i < validOccs.length; i++) {
    var occ = validOccs[i];
    if (occ.aptPrediction == null || !isFinite(occ.aptPrediction)) continue;
    if (!reg || !reg.coeffs) continue;

    var xWLS = [
      1,
      (occ.confidencePred || occ.confidence || 50) / 100,
      occ.trendStrength || 0,
      Math.log(Math.max(occ.volumeRatio || 1, 0.1)),
      occ.atrNorm || 0.02,
    ];
    var wlsPred = 0;
    for (var j = 0; j < xWLS.length; j++) wlsPred += xWLS[j] * reg.coeffs[j];
    if (!isFinite(wlsPred)) continue;

    pairedIdx.push(i);
    aptPreds.push(occ.aptPrediction);
    wlsPreds.push(wlsPred);
    rets.push(returns[i]);
  }
  var nPaired = pairedIdx.length;
  if (nPaired < MIN_PAIRS) {
    return {
      horizon: h, kMin: K_MIN, nPairs: nPaired,
      mvpStatus: 'INSUFFICIENT',
      failReason: 'nPaired_lt_' + MIN_PAIRS,
      icApt: null, icWls: null, icLift: null, nDates: 0,
      icXSIsPooled: false, icir: null, icirAnn: null,
      stdICPerDate: 0, ci95: { lower: null, upper: null },
      fullFactorN: 0, partialFactorN: 0, fullFactorRatio: 0,
      icFull: null, icFullCI: null, icPart: null, fullPartDelta: null,
    };
  }

  // Pooled paired baseline (for L1 icLift + fallback)
  var aptPairsPooled = aptPreds.map(function(p, k) { return [p, rets[k]]; });
  var wlsPairsPooled = wlsPreds.map(function(p, k) { return [p, rets[k]]; });
  var icAptPooled = this._spearmanCorr(aptPairsPooled);
  var icWlsPooled = this._spearmanCorr(wlsPairsPooled);
  var icLift = (icAptPooled != null && icWlsPooled != null)
    ? +(icAptPooled - icWlsPooled).toFixed(4)
    : null;

  // ---------- L2: Cross-Sectional per-Date ----------
  var self = this;
  function normalizeDate(t) {
    if (typeof t === 'string') return t.slice(0, 10);
    if (typeof t === 'number') {
      var d = new Date((t + 9 * 3600) * 1000);  // KST
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  var byDate = Object.create(null);
  for (var i2 = 0; i2 < pairedIdx.length; i2++) {
    var occ2 = validOccs[pairedIdx[i2]];
    var c = candles[occ2.idx];
    var dk = c && normalizeDate(c.time);
    if (!dk) continue;
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk].push([aptPreds[i2], rets[i2]]);
  }

  var icPerDate = [];
  for (var key in byDate) {
    if (byDate[key].length < K_MIN) continue;
    var ic_t = this._spearmanCorr(byDate[key]);
    if (ic_t != null && isFinite(ic_t)) icPerDate.push(ic_t);
  }
  var nDates = icPerDate.length;

  var meanIC_XS, icXSIsPooled;
  if (nDates >= 10) {
    var sumIC = 0;
    for (var d = 0; d < nDates; d++) sumIC += icPerDate[d];
    meanIC_XS = sumIC / nDates;
    icXSIsPooled = false;
  } else {
    meanIC_XS = icAptPooled;
    icXSIsPooled = true;
  }

  // ---------- L3: ICIR ----------
  var icir = null, icirAnn = null, stdIC = 0;
  if (nDates >= 10 && !icXSIsPooled) {
    var sumSq = 0;
    for (var d2 = 0; d2 < nDates; d2++) {
      var dev = icPerDate[d2] - meanIC_XS;
      sumSq += dev * dev;
    }
    stdIC = Math.sqrt(Math.max(sumSq / (nDates - 1), 0));
    if (stdIC > 1e-6) {
      icir = meanIC_XS / stdIC;
      icirAnn = icir * Math.sqrt(252 / h);
    }
  }

  // ---------- L5: Fisher 95% CI ----------
  var nEff = icXSIsPooled ? nPaired : nDates;
  var ci95 = this._fisherCI(meanIC_XS, nEff);

  // ---------- L9: Null Contamination Split ----------
  var fullDates = Object.create(null), partialDates = Object.create(null);
  var nFull = 0, nPartial = 0;
  var factorKeys = ['size', 'value', 'momentum', 'liquidity', 'reversal'];
  for (var i3 = 0; i3 < pairedIdx.length; i3++) {
    var occ3 = validOccs[pairedIdx[i3]];
    if (!occ3.aptFactors) continue;
    var nonNull = 0;
    for (var fk = 0; fk < factorKeys.length; fk++) {
      var v = occ3.aptFactors[factorKeys[fk]];
      if (v != null && isFinite(v)) nonNull++;
    }
    var c3 = candles[occ3.idx];
    var dk3 = c3 && normalizeDate(c3.time);
    if (nonNull === 5) {
      nFull++;
      if (dk3) {
        if (!fullDates[dk3]) fullDates[dk3] = [];
        fullDates[dk3].push([aptPreds[i3], rets[i3]]);
      }
    } else if (nonNull >= 1) {
      nPartial++;
      if (dk3) {
        if (!partialDates[dk3]) partialDates[dk3] = [];
        partialDates[dk3].push([aptPreds[i3], rets[i3]]);
      }
    }
  }
  var fullFactorRatio = (nFull + nPartial > 0) ? nFull / (nFull + nPartial) : 0;

  function _xsMean(dateMap, kMin) {
    var arr = [];
    for (var k in dateMap) {
      if (dateMap[k].length < kMin) continue;
      var ic = self._spearmanCorr(dateMap[k]);
      if (ic != null && isFinite(ic)) arr.push(ic);
    }
    if (arr.length < 10) return { mean: null, nDates: arr.length };
    var s = 0;
    for (var j = 0; j < arr.length; j++) s += arr[j];
    return { mean: s / arr.length, nDates: arr.length };
  }

  var fullRes = _xsMean(fullDates, K_MIN);
  var partRes = _xsMean(partialDates, K_MIN);
  var icFullCI = (fullRes.mean != null)
    ? this._fisherCI(fullRes.mean, fullRes.nDates)
    : null;
  var fullPartDelta = (fullRes.mean != null && partRes.mean != null)
    ? +(fullRes.mean - partRes.mean).toFixed(4)
    : null;

  // ---------- MVP Status Judgment (aggregate L1+L3+L5+L9 at this horizon) ----------
  var mvpStatus = 'PASS';
  var failReason = null;
  if (icXSIsPooled && nDates < 10) {
    mvpStatus = 'WARN';
    failReason = 'nDates_lt_10_fell_back_pooled';
  }
  if (ci95.lower != null && ci95.upper != null && ci95.upper <= 0) {
    mvpStatus = 'FAIL';
    failReason = 'ci_upper_lt_zero_adverse_signal';
  } else if (ci95.lower != null && ci95.lower <= 0) {
    if (mvpStatus === 'PASS') mvpStatus = 'WARN';
    if (!failReason) failReason = 'ci_spans_zero';
  }
  if (h === 5 && icirAnn != null && icirAnn < 0.3) {
    if (mvpStatus === 'PASS') mvpStatus = 'WARN';
    if (!failReason) failReason = 'icir_ann_lt_0_3_at_h5';
  }
  if (h === 5 && icLift != null && icLift < 0.015) {
    if (mvpStatus === 'PASS') mvpStatus = 'WARN';
    if (!failReason) failReason = 'ic_lift_lt_0_015_at_h5';
  }
  if (fullFactorRatio < 0.5) {
    if (mvpStatus === 'PASS') mvpStatus = 'WARN';
    if (!failReason) failReason = 'full_factor_ratio_lt_0_5';
  }

  return {
    horizon: h, kMin: K_MIN,
    icApt: +meanIC_XS.toFixed(4),
    icWls: icWlsPooled != null ? +icWlsPooled.toFixed(4) : null,
    icLift: icLift,
    nPairs: nPaired,
    nDates: nDates,
    icXSIsPooled: icXSIsPooled,
    icir: icir != null ? +icir.toFixed(3) : null,
    icirAnn: icirAnn != null ? +icirAnn.toFixed(3) : null,
    stdICPerDate: +stdIC.toFixed(4),
    ci95: ci95,
    fullFactorN: nFull,
    partialFactorN: nPartial,
    fullFactorRatio: +fullFactorRatio.toFixed(3),
    icFull: fullRes.mean != null ? +fullRes.mean.toFixed(4) : null,
    icFullCI: icFullCI,
    icPart: partRes.mean != null ? +partRes.mean.toFixed(4) : null,
    fullPartDelta: fullPartDelta,
    mvpStatus: mvpStatus,
    failReason: failReason,
  };
}
```

---

## Horizon Loop Integration

`_computeStats` 수정 패턴 (기존 outer `for (const h of horizons)` 루프 활용):

```javascript
// At top of _computeStats, ensure horizons includes [1, 3, 5, 10, 20]
// (Current default may be [5, 10, 20] — extend if needed)

_computeStats(candles, occurrences, horizons, patternSignal, patternType) {
  // P7-MVP: enforce horizon set for IC precision
  var icHorizons = [1, 3, 5, 10, 20];
  for (var hk = 0; hk < icHorizons.length; hk++) {
    if (horizons.indexOf(icHorizons[hk]) === -1) horizons.push(icHorizons[hk]);
  }
  horizons.sort(function(a, b) { return a - b; });

  const result = {};
  for (const h of horizons) {
    // ... existing per-horizon computation ...
    // After stats computed and WLS reg fit:

    // [P7-001 L1-L9 MVP] APT IC diagnostic
    var aptDiag = this._computeAPTDiagnostic(validOccs, returns, h, candles, reg);
    if (aptDiag) {
      stats.aptDiagnostic = aptDiag;
      // Legacy Phase 6 fields (preserve for backward compat)
      stats.icApt = aptDiag.icApt;
      stats.icAptN = aptDiag.nPairs;
      stats.icAptDelta = aptDiag.icLift;
    }

    result[h] = stats;
  }

  // [P7-001 L4] Sign consistency aggregated across horizons
  result._aptMeta = this._computeAPTMeta(result);

  return result;
}

_computeAPTMeta(result) {
  var meta = { signConsistent: null, signH: {}, mvpGate: null };
  var signs = {};
  for (var h of [3, 5, 10]) {
    var d = result[h] && result[h].aptDiagnostic;
    if (d && d.icApt != null) signs[h] = Math.sign(d.icApt);
  }
  if (signs[3] != null && signs[5] != null && signs[10] != null) {
    meta.signH = signs;
    meta.signConsistent = (signs[3] === signs[5] && signs[5] === signs[10] && signs[5] !== 0);
  }

  // Aggregate P7-MVP GO gate: 5 criteria must all pass
  var d5 = result[5] && result[5].aptDiagnostic;
  if (d5) {
    var gates = {
      icirAnn: d5.icirAnn != null && d5.icirAnn >= 0.3,
      icLift: d5.icLift != null && d5.icLift >= 0.015,
      ci95Lower: d5.ci95 && d5.ci95.lower != null && d5.ci95.lower > 0,
      fullRatio: d5.fullFactorRatio >= 0.5,
      signConsistent: meta.signConsistent === true,
    };
    var passCount = 0;
    for (var g in gates) if (gates[g]) passCount++;
    meta.mvpGate = {
      gates: gates,
      passCount: passCount,
      status: passCount === 5 ? 'GO' : passCount >= 3 ? 'HOLD' : 'NOGO',
    };
  }
  return meta;
}
```

**postMessage safety**: `aptDiagnostic` 및 `_aptMeta`는 모두 plain objects (number/string/boolean/null + nested plain objects/arrays). 함수 속성 없음. Structured clone 통과.

**Performance**: n=2000 occurrences, 5 horizons, per-date groupby + Spearman:
- Per horizon: O(n log n) Spearman (pooled) + O(nDates × kAvg log kAvg) XS + O(n) L9 split = ~20ms
- 5 horizons: ~100ms
- L4/L9 aggregation: ~5ms
- **Total ~105ms < 500ms budget**

---

## Edge Cases & Defensive Programming

### E1: `occ.aptFactors` 누락 (Phase 7 미완 상태)

Phase 6 상태에서는 `aptFactors` 필드가 대부분 undefined. L9 split은 `nFull=0, nPartial=0, fullFactorRatio=0` → `mvpStatus='WARN'` + `failReason='full_factor_ratio_lt_0_5'`. **의도된 동작** — P7-001 미완 상태임을 MVP gate가 포착.

### E2: 날짜 정규화 실패 (intraday timestamp edge case)

`candles[occ.idx].time`이 number인데 < 1970-01-01 (음수) 또는 > 2100 이면 `normalizeDate`가 이상 값 반환. Defensive check:

```javascript
function normalizeDate(t) {
  if (typeof t === 'string') return t.slice(0, 10);
  if (typeof t === 'number' && t > 0 && t < 4102444800) {  // < 2100-01-01
    var d = new Date((t + 9 * 3600) * 1000);
    var iso = d.toISOString();
    return iso.slice(0, 10);
  }
  return null;
}
```

### E3: Spearman = null (ties 전체 동점 등)

`_spearmanCorr` 내부 den=0 → return 0. L2에서 `ic_t === 0`은 실제 zero correlation인지 degenerate case인지 모호. Defensive: `if (ic_t != null && isFinite(ic_t) && Math.abs(ic_t) < 0.9999) icPerDate.push(ic_t);` — 완전 |1| 상관은 data error 의심하여 제외.

### E4: `reg.coeffs` undefined (WLS 회귀 실패)

L1에서 WLS prediction 계산 불가 → pairing 실패 → `return null` 경로. 대신 aptApp-only IC라도 계산? — **No**. Pairing 없으면 lift 계산 불가 → 목적 상실. Null return이 옳음.

### E5: 모든 occurrences가 같은 date (single-day pattern rush)

`nDates = 1 < 10` → pooled fallback. `icXSIsPooled = true`. ICIR 계산 안함. **Expected**: regime event (IPO day 등) 스냅샷.

### E6: `returns[i]` 모두 동일 (dead stock suspension)

`_spearmanCorr` den=0 → 0 반환. IC=0 모든 cell에서. ICIR undefined (std=0). mvpStatus='FAIL' or 'WARN'. **방어책**: ret의 std 사전 체크 가능하지만 그 자체가 진단 signal이므로 그대로 통과 + failReason 기록이 더 유익.

---

## Summary Table

| Layer | Status | LOC | Cost | P7-MVP Gate Contribution |
|-------|--------|-----|------|------|
| **L1 Pairing** | MVP | 25 | O(n) | IC lift ≥ +0.015 |
| **L2 Cross-sectional** | MVP | 40 | O(n + nDates log nDates) | nDates ≥ 10 (pooled fallback) |
| **L3 ICIR** | MVP | 15 | O(nDates) | icirAnn ≥ 0.3 |
| **L4 Multi-horizon** | MVP | 0 (reuse loop) | ×5 (horizons) | sign consistent h∈{3,5,10} |
| **L5 Fisher CI** | MVP | 20 | O(1) | ci95.lower > 0 |
| L6 Block Bootstrap | Phase 8 | 80 | O(B·n log n) | — |
| L7 Factor Decomp | Phase 8 | 120 | O(F × n log n) | — |
| L8 Stratified (27 cells) | Phase 8 | 100 | O(n + 27·kAvg log kAvg) | — |
| **L9 Null Split** | MVP | 40 | O(n) | fullFactorRatio ≥ 0.5 |
| L10 HLZ BH-FDR | Phase 8 | 80 | O(K log K) | — |
| **MVP Total** | — | **~150** | **~105ms** | 5/5 gates |

---

## MVP GO Gate — Integrated Logic

```javascript
// Called by test harness or UI after _computeStats returns
function evaluateP7MVPGate(result) {
  var meta = result._aptMeta;
  if (!meta || !meta.mvpGate) return { status: 'NO_DATA', detail: 'No APT diagnostic available' };

  var g = meta.mvpGate.gates;
  var d5 = result[5] && result[5].aptDiagnostic;
  return {
    status: meta.mvpGate.status,
    passCount: meta.mvpGate.passCount,
    detail: {
      icirAnn_h5: { value: d5 && d5.icirAnn, threshold: 0.3, pass: g.icirAnn },
      icLift_h5: { value: d5 && d5.icLift, threshold: 0.015, pass: g.icLift },
      ci95Lower_h5: { value: d5 && d5.ci95 && d5.ci95.lower, threshold: 0, pass: g.ci95Lower },
      fullRatio: { value: d5 && d5.fullFactorRatio, threshold: 0.5, pass: g.fullRatio },
      signConsistent: { signs: meta.signH, pass: g.signConsistent },
    },
  };
}
```

**GO**: 5/5 gates pass → Phase 7 P7-001 승인, APT 5-factor 프로덕션 활성화
**HOLD**: 3-4/5 → Phase 8 진입 (L6/L7/L8 진단 실시)
**NOGO**: <3/5 → APT 모델 재학습 (offline pipeline regression)

---

## Phase 8 Transition Triggers (Summary)

| P7 Failure Mode | Phase 8 Layer Activated | 기대 효과 |
|-----------------|-------------------------|----------|
| L1 icLift < -0.005 | L7 (factor decomposition) | 어떤 factor가 손해 원인인지 진단 |
| L2 nDates < 10 지속 | L8 (27-cell stratification) | date 대신 cell로 aggregation 우회 |
| L3 icirAnn ∈ [0.1, 0.3) | L6 (block bootstrap CI) | ICIR 불확실성 정량화, robust 판정 |
| L4 sign consistency 2/3 | L6 + L7 | horizon-specific noise 원인 추적 |
| L5 CI boundary | L6 (block bootstrap CI) | within-date clustering 보정 |
| L9 fullPartDelta < -0.03 | L7 (factor decomposition) | partial subset 우위 원인 조사 |
| 운영 단계 review 요구 | L10 (BH-FDR) | family-wise error 공식 controlled |

---

## References

1. **Fama, E. F. & MacBeth, J. D. (1973)**. "Risk, return, and equilibrium: Empirical tests." *Journal of Political Economy* 81(3): 607-636.
2. **Fisher, R. A. (1921)**. "On the 'probable error' of a coefficient of correlation deduced from a small sample." *Metron* 1: 3-32.
3. **Grinold, R. C. & Kahn, R. N. (1999)**. *Active Portfolio Management* (2nd ed.), Ch. 4. McGraw-Hill.
4. **Harvey, C. R., Liu, Y. & Zhu, H. (2016)**. "…and the cross-section of expected returns." *Review of Financial Studies* 29(1): 5-68.
5. **Hou, K., Xue, C. & Zhang, L. (2020)**. "Replicating anomalies." *Review of Financial Studies* 33(5): 2019-2133.
6. **Jegadeesh, N. & Titman, S. (1993)**. "Returns to buying winners and selling losers." *Journal of Finance* 48(1): 65-91.
7. **Politis, D. N. & Romano, J. P. (1994)**. "The stationary bootstrap." *JASA* 89(428): 1303-1313.
8. **Benjamini, Y. & Hochberg, Y. (1995)**. "Controlling the false discovery rate." *JRSS-B* 57(1): 289-300.
9. **Lo, A. W. (2002)**. "The statistics of Sharpe ratios." *FAJ* 58(4): 36-52.
10. **Qian, E. E., Hua, R. H. & Sorensen, E. H. (2007)**. *Quantitative Equity Portfolio Management*, Ch. 3. Chapman & Hall.
