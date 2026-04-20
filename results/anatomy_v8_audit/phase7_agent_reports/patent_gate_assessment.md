# Patent Gate Assessment — Phase 7 P7-001 APT 5-Factor Activation

**Assessor**: financial-systems-architect agent
**Date**: 2026-04-21
**Branch**: audit/anatomy-v8-fix
**Scope**: Go/No-Go for Phase B (P7-001 implementation) based on IP exposure delta

---

## 1. Executive Summary

**Verdict: HOLD — pending one-time mitigation action (estimated 30-60 min work)**

`mra_apt_coefficients.json` is currently deployed as a **world-readable static asset with no authentication** (`HTTP 200`, `Access-Control-Allow-Origin: *`, `Cache-Control: public`). The 18 Ridge coefficients, λ=2.0, and full feature vector schema are already public. This fact is confirmed by live curl.

P7-001 does not introduce new secrets that are not already exposed. The Ridge coefficients are the IP; they are live now. **However, this pre-existing exposure is itself the HOLD trigger**: activating the APT factors in the client will make the exploit path obvious to any observer (coefficients in hand + client that calls predict() with real factors = immediate reverse-engineering of the full inference pipeline). The correct gate action is to move `mra_apt_coefficients.json` behind the V48-SEC origin-gating layer **before** enabling predict() with real values, not after.

**GO condition**: Move `mra_apt_coefficients.json` to `SEC_PROTECTED_JSONS` (functions/_data/) and serve it via `/api/apt/coefficients` with HMAC+Origin guard. Estimated effort: 30-60 min (same pattern as `calibrated_constants.json`). Once deployed, Phase B may proceed immediately.

---

## 2. Current IP Exposure State (Phase 6 Baseline)

### 2a. Live Verification

```
curl -I https://cheesestock.co.kr/data/backtest/mra_apt_coefficients.json

HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *      ← fully world-readable, cross-origin allowed
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
ETag: "d6f7ffb269f60bd9a168516b752847ed"
```

Response body size: **1,557 bytes**. The full file is accessible with a single unauthenticated GET from any origin.

### 2b. What Is Already Public

| Item | Public? | How |
|------|---------|-----|
| 18 Ridge coefficients (full vector) | YES | static JSON, no auth |
| λ=2.0, horizon=5d, n=237,977 | YES | same file |
| Full feature_names schema (17-col + intercept) | YES | same file |
| z_scored=true flag per factor | YES | same file |
| coverage_pct per APT factor | YES | same file |
| Academic citations for each factor | YES | same file |
| computeFactors() implementation | YES | aptModel.js is deployed (obfuscated but recoverable) |
| predict() dot-product logic | YES | aptModel.js is deployed |
| z-score normalization: per-date cross-sectional, MAD×1.4826, winsorize [-3,3] | YES | mra_apt_extended.py is in repo but not deployed — **NOT public from production** |
| Per-date training cohort μ/σ (actual training statistics) | NO | mra_apt_extended.py computes locally and discards — NOT written to any JSON |

### 2c. Key Finding: μ/σ NOT Saved

The z-scoring uses a **cross-sectional, per-date** normalization (line 382-393 of `mra_apt_extended.py`). At each trading date, `mu = median(cross_section)` and `scale = MAD × 1.4826` are computed locally and used only for that date's observations. These statistics are **never written to `mra_apt_coefficients.json`** or any other deployed file. The output JSON contains only the final Ridge coefficient vector. The per-date μ/σ values are transient Python variables that exist only during the training run.

This is the pivotal z-score question from the task brief. **Option (b) is the current state by default**: the training normalization statistics are not exposed because they were never persisted.

### 2d. Obfuscation Coverage

`js/aptModel.js` is included in the build pipeline with `stringArray + selfDefending` obfuscation (`controlFlowFlattening: false` per V48 Phase 1 learning). The dot-product loop in `predict()` and the factor assembly in `computeFactors()` will survive to the bundle but require 4-8 hours of AST deobfuscation to extract cleanly. However, with the coefficient JSON already public, a competitor does not need to reverse the JS — they can directly query the JSON endpoint and reconstruct the model from first principles.

---

## 3. P7-001 IP Delta: What Phase B Adds

### 3a. Option A — Offline Backfill: μ/σ Added to JSON

If Phase B implementation chose to add per-factor training statistics (overall or per-date μ/σ) to `mra_apt_coefficients.json` to enable client-side standardization consistent with the training cohort:

| New Exposure | Standalone Exploitability | Independence Claim |
|-------------|--------------------------|-------------------|
| Per-factor median μ | LOW (median of published KRX data is not proprietary) | None |
| Per-factor MAD σ | LOW (computable from public OHLCV) | None |
| Combined μ/σ + coefficients in one file | MEDIUM (turnkey inference pipeline) | LOW |

Option A does not create material new protectable IP. Median and MAD of publicly available KRX price/financial data are not trade secrets. However, combining them with coefficients in a single unauthenticated JSON file further reduces the reverse-engineering cost from "several hours" to "several minutes".

**Option A is NOT recommended** regardless of patent gate outcome.

### 3b. Option B — Client Cohort (Current Default Behavior)

The current `aptModel.js` calls `predict()` with factors that are z-scored by the caller using their own runtime cohort (e.g., the loaded candle set for a given stock). This is already the intended Phase 6 design: `aptModel.js` line 23 states "Client callers must supply already-standardized values (z-score vs the training cohort) or pass null to set factor contribution to zero."

Under Option B (the status quo), the **gap between client z-score and training z-score** is an acknowledged modeling approximation. The per-date cross-sectional normalization is not replicated client-side. This:

- Does not expose new IP
- Is consistent with current `predict()` return null when factors are null (Phase 6 state: all 5 factors null = zero contribution)
- Phase B simply wires `computeFactors()` → normalize → `predict()` using a per-stock self-contained z-score (mean/std of the stock's own 60-day factor history, not the cross-sectional training cohort)

**Option B IP delta is essentially zero from Phase 6.** The additional exposure is `predict()` receiving non-null factors, making the inference chain observable in browser DevTools — but since the coefficient JSON is already public, this adds no material IP risk.

### 3c. IP Novelty Assessment by Component

| Component | Academic Basis | KRX Specialization | Novelty Level | Patent Worthiness |
|-----------|---------------|-------------------|--------------|------------------|
| 5-factor APT selection (Ross/FF3/Jegadeesh-Titman/Amihud) | Ross 1976, FF 1993, JT 1993, Amihud 2002 | None | ZERO | Not patentable |
| Ridge λ=2.0 | Standard Ridge regression | Tuned on KRX dataset | LOW | Not patentable alone |
| 17-col feature vector (Wc × APT combination) | Wc weights from prior work | Combination | MID | Patentable as combination claim |
| Cross-sectional MAD z-score with Amihud scale 1.4826 | Huber/Hampel robust statistics | KRX daily frequency | MID | Patentable if integrated into system claim |
| Per-date cohort normalization at pattern occurrence date | Standard practice | Applied to pattern detection timing | LOW-MID | May strengthen system claim |
| Full inference pipeline (pattern → factors → Ridge → predicted return) | Novel combination | YES | HIGH | Core patentable claim |

**The genuinely patentable element is the end-to-end pipeline combination**: candlestick pattern detection → ATR-normalized confidence scoring → WLS weighted Wc → APT factor augmentation → Ridge-regularized predicted return → client-side inference. No individual component is novel, but the specific integration in a browser-based KRX trading system is.

---

## 4. Reverse-Engineering Cost Estimate

### Current State (Phase 6, pre-P7-001 activation)

| Step | Technique | Time (competent adversary) |
|------|-----------|---------------------------|
| 1. Obtain Ridge coefficients | GET /data/backtest/mra_apt_coefficients.json | < 1 minute |
| 2. Decode feature vector schema | feature_names in same JSON | < 1 minute |
| 3. Reconstruct predict() dot-product | Trivial given schema | 15 minutes |
| 4. Understand factor definitions | Academic citations in JSON | 30 minutes |
| 5. Implement computeFactors() from scratch | Standard finance formulas | 2-4 hours |
| **Total to replicate inference** | | **3-5 hours** |

### After P7-001 Activation (Option B, no protection)

| Step | Additional vs. current | Time delta |
|------|----------------------|------------|
| Observe predict() being called with non-null factors | Browser DevTools Network | 0 min additional |
| Confirm factors are z-scored (from JSON) | Already public | 0 min |
| Sample factor values from DevTools | Runtime profiling | 30 min |
| **Total delta** | | **+30 min** |

**Critical observation**: With the coefficients JSON publicly accessible, P7-001 activation reduces reverse-engineering time from 3-5 hours to approximately 3.5 hours — a marginal increase in risk, not a step change. The coefficient JSON is the primary IP surface, not the client-side activation.

### After mra_apt_coefficients.json is Protected (Recommended Path)

| Step | Technique | Time (competent adversary) |
|------|-----------|---------------------------|
| 1. Attempt direct JSON access | GET → 403 (Origin-gated) | Blocked |
| 2. Obtain valid session token | Create cheesestock.co.kr account | 5-10 min |
| 3. Extract HMAC-signed request | DevTools intercept | 30-60 min |
| 4. Replay request | Valid Origin still required | Reduced to same-browser scenario |
| 5. Deobfuscate predict() JS to recover coefficient structure | AST walker | 4-8 hours |
| **Total to replicate inference** | | **5-10 hours + HMAC replay complexity** |

This represents a meaningful increase in attacker cost, buying time for patent filing.

---

## 5. §30 Grace Period vs. Exposure Risk

### Timeline

| Date | Event |
|------|-------|
| 2026-03-11 | First public commit to cheesestock.co.kr (earliest prior art date) |
| 2026-04-21 | Today. 341 days remaining in §30 grace period |
| 2027-03-11 | §30 grace period expires (Korean Patent Act Art. 30, 12-month window) |
| Current | mra_apt_coefficients.json LIVE and unauthenticated |

### §30 Risk Assessment

Korean Patent Act §30 grace period protects self-disclosure. The key risk is **third-party independent publication of the same combination**, not the self-disclosure itself. Since the coefficients are live:

1. **A competitor who downloads the JSON today** can file a patent claim on the APT+Ridge+Wc combination before CheeseStock files. §30 does not protect against third-party prior art.
2. **The 341-day window is sufficient** to file before expiration — this is not the urgent constraint.
3. **The urgent constraint is competitive reverse-engineering**, not the §30 deadline per se.
4. **2-person disclosure risk** (§30 inapplicable): Since CheeseStock is operated by 2 founders and the disclosure is a joint deployment, §30 remains applicable. The 2-person exception applies to third-party disclosure, not co-inventor deployment.

### Risk Quantification

| Risk Scenario | Probability (12 months) | Impact | Priority |
|-------------|------------------------|--------|---------|
| Competitor downloads JSON + files patent before CheeseStock | LOW (requires intent + awareness) | CRITICAL | Mitigate now |
| Competitor reverse-engineers from live site, builds competing product | MEDIUM (no IP barrier) | HIGH | Mitigate in 30-60 min |
| §30 grace period expires before filing | LOW (341 days) | CRITICAL | Track deadline |
| Third-party independent discovery of same combination | LOW (obscure domain) | HIGH | File early |

---

## 6. Recommended Path

**HOLD on Phase B until `mra_apt_coefficients.json` is protected. Estimated effort: 30-60 minutes.**

### Action Plan (before Phase B)

**Step 1: Add to `SEC_PROTECTED_JSONS` in `stage_deploy.py`**

```python
# In stage_deploy.py EXCLUDE_EXACT dict:
os.path.join("data", "backtest", "mra_apt_coefficients.json"),

# In stage_deploy.py SEC_PROTECTED_JSONS list:
os.path.join("data", "backtest", "mra_apt_coefficients.json"),
```

**Step 2: Create `/api/apt/coefficients` endpoint**

New file `functions/api/apt/coefficients.js` — pattern identical to `functions/api/confidence/macro.js`. GET endpoint with `guardGet` (HMAC + Origin check). Returns the JSON content. The endpoint can be `guardGet` or a lighter read-only guard since coefficients are not per-user sensitive.

**Step 3: Update `aptModel.js` fetch path**

Change line 40:
```javascript
// Before:
_loading = fetch('/data/backtest/mra_apt_coefficients.json', { cache: 'default' })
// After:
_loading = fetch('/api/apt/coefficients', { cache: 'default' })
```

Session token header must be attached (same pattern as other `/api/` callers in `appWorker.js`).

**Step 4: CDN purge for stale cached JSON**

After deploy, purge `https://cheesestock.co.kr/data/backtest/mra_apt_coefficients.json` via Cloudflare dashboard custom purge (reference CLAUDE.md stale-while-revalidate trap). Current ETag: `d6f7ffb269f60bd9a168516b752847ed` (confirmed from curl). The file is 1,557 bytes; a custom purge will confirm success.

**Step 5: Deploy placeholder at old URL**

To avoid stale-while-revalidate 86400s leak, deploy a placeholder:
```json
{"moved": "/api/apt/coefficients", "protected": true}
```
at `data/backtest/mra_apt_coefficients.json` in the static deploy. This evicts the real content from CDN cache within minutes.

**Total: 5 changes, ~30-60 min, same security pattern already proven by V48 Phase 1.**

### z-Score Option Decision

Option B (client cohort) is recommended. **Do not write μ/σ to any JSON file.** The modeling approximation is acceptable — IC measurements already account for the client-side normalization gap. Adding μ/σ to the JSON would: (a) increase the IP surface without adding patent value, and (b) require storing per-date statistics that inflate file size significantly.

---

## 7. HOLD Actions Required Before Phase B

If the current HOLD verdict stands, the user must complete:

1. **Coefficient JSON protection** (Steps 1-5 above, 30-60 min): This is the blocking gate item. It is a pure engineering task requiring no external dependency.

2. **변리사 공지예외 신청서 (Patent §30 Declaration)**: Not a blocking gate for Phase B, but remains the highest-priority parallel action. The coefficient JSON being public since deployment is a confirmed self-disclosure event. The §30 declaration formalizes this and prevents any ambiguity in the filing. Target: within 30 days.

3. **No additional patent consultation is required before Phase B**: The IP risk from P7-001 itself is low once the coefficient JSON is protected. Phase B does not expose μ/σ (Option B) and does not add any new architectural claim beyond what is already in the codebase.

---

## 8. GO Conditions for Phase B

Phase B may proceed immediately when **all three** of the following are true:

| Condition | Verification |
|-----------|-------------|
| G1: `mra_apt_coefficients.json` returns 403 from unauthenticated GET to cheesestock.co.kr | `curl -I https://cheesestock.co.kr/data/backtest/mra_apt_coefficients.json` → 403 |
| G2: `/api/apt/coefficients` returns 200 from Origin-gated request | `curl -H "Origin: https://cheesestock.co.kr" ...` → 200 with JSON |
| G3: Old static URL returns placeholder or 403, NOT the 1,557-byte full file | `curl -o /dev/null -w "%{size_download}" ...` → NOT 1557 |

G1 + G3 can be verified immediately after deploy. G2 requires a valid session token from the live site.

**If user confirms G1+G2+G3: VERDICT UPGRADES TO GO. Phase B may proceed.**

---

## 9. Summary Matrix

| Factor | Assessment | Phase B Impact |
|--------|-----------|----------------|
| §30 grace period | 341 days remaining, sufficient | No urgency on timeline |
| Coefficient JSON public access | CONFIRMED: HTTP 200, no auth, CORS * | BLOCKING — must protect first |
| P7-001 IP delta (Option B) | Near-zero new exposure | Low risk once coefficients protected |
| μ/σ exposure (Option A) | Not recommended — do not persist | N/A |
| z-score uniqueness | KRX per-date MAD cross-sectional is novel-in-context | Patentable element in system claim |
| Reverse-engineering cost (current) | 3-5 hours post-JSON-access | Unacceptably low for deployed IP |
| Reverse-engineering cost (post-protection) | 5-10 hours + HMAC complexity | Acceptable while patent pending |
| Obfuscation contribution | stringArray+selfDefending adds ~4-8h deobfuscation | Secondary defense, not primary |
| Patentable core claim | End-to-end pipeline combination | Present and protectable |

**Final verdict: HOLD → GO with modification. The modification (protecting the coefficient JSON) takes approximately 30-60 minutes and follows the exact V48 Phase 1 pattern already proven in production. This is not a design decision — it is an engineering task with a known solution.**
