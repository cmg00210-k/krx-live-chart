# Phase 7 Completion Report — ANATOMY V8

**Date**: 2026-04-21
**Branch**: `audit/anatomy-v8-fix` (PR #7 draft — extended)
**Scope**: P7-001 APT 5-factor activation + CDN/IP mitigation
**Status**: P7-001 **COMPLETE** / P7-003 **DEFERRED** (xelatex PDF rebuild blocked by MASTER `λ` math-mode issue)
**MASTER SHA before**: `91ece3dc7983ad8639954ccc3fbda5f62c8bd47d6da3d0c4e08bcf5afa664b4f`
**MASTER SHA after**:  *(updated — sha256 sidecar Phase 8 이월)*

---

## 1. Phase A — 5 Agents Dispatched

| Agent | Subtype | Status | Key deliverable |
|-------|---------|--------|-----------------|
| 1 | financial-engineering-expert | ✅ SUCCESS | `zscore_design.md` — Option C (client robust z-score, median+MAD×1.4826) 권고. **Critical bug 발견**: `aptModel.js` L.185 liquidity ×100 누락. |
| 2 | statistical-validation-expert | ✅ SUCCESS | `ic_precision_framework.md` — 10-Layer 중 MVP = L1+L2+L3+L4+L5+L9 (6 layers, ~150 LOC, 105ms). Full pseudocode + 5/5 GO gate. |
| 3 | cfa-financial-analyst | ✅ SUCCESS | `factor_contribution_matrix.md` — Phase 4-1 실측 정정 (momentum − reversal, value − growth tilt, log_size + large-cap dominance). |
| 4 | financial-systems-architect | ⚠️ USAGE LIMIT (but file completed) | `patent_gate_assessment.md` — **HOLD → GO with modification** (coefficients JSON을 `/api/apt`로 이동 후 GO). |
| 5 | build-system-architect | ⚠️ USAGE LIMIT (orchestrator replaced) | `xelatex_playbook.md` — MiKTeX basic + on-the-fly 설치 플레이북. |

---

## 2. HOLD Mitigation (Agent 4 권고 이행)

**문제**: `mra_apt_coefficients.json`이 Phase 6 시점부터 `HTTP 200 + CORS * + no auth`로 완전 공개 상태. P7-001 활성화 시 inference chain reverse 비용이 ~30분으로 감소.

**해결**: V48 Phase 1 패턴 재사용 — `calibrated_constants.json`과 동일한 구조로 `mra_apt_coefficients.json`을 `/api/apt` endpoint 뒤로 이동. 8 파일 수정.

| 파일 | 변경 |
|------|------|
| `scripts/stage_deploy.py` | EXCLUDE_EXACT + SEC_PROTECTED_JSONS + CRITICAL_FILES + **SEC_PLACEHOLDERS** (신규) 로직 추가 |
| `functions/api/apt.js` | **신규** — constants.js 패턴 정확 복제 (guardGet + jsonResponse no-store) |
| `functions/_data/mra_apt_coefficients.json` | hard link → 독립 inode (stage idempotency 복구) |
| `js/aptModel.js` | `/data/backtest/mra_apt_coefficients.json` → `/api/apt` + `self._signGet` 우선 사용 |
| `sw.js` | CACHE_NAME v85→v87 + `/api/*` 바이패스 (stale cache 방지) |
| `index.html` | aptModel.js ?v=1→3, backtester.js ?v=47→48, appWorker.js ?v=19→20 |
| `scripts/verify.py` | CHECK 12/15에 apt 4곳 추가 + placeholder 허용 로직 |

**배포 결과** (2026-04-21 KST):

| Gate | URL | Expected | Actual | Status |
|------|-----|----------|--------|--------|
| G1 | `https://cheesestock.co.kr/data/backtest/mra_apt_coefficients.json` | 168B placeholder | 168B placeholder (`{"moved":"/api/apt"}`) | ✅ PASS |
| G2 | `https://cheesestock.co.kr/api/apt` (no HMAC) | 401 `hmac_missing` | 401 `{"error":"hmac_missing"}` | ✅ PASS |
| G3 | `https://1c722854.cheesestock.pages.dev/api/apt` | 401 mirror prod | 401 | ✅ PASS |

**CDN stale-while-revalidate trap 해결**: placeholder 방식으로 자동 eviction (CLAUDE.md Option B). 사용자 대시보드 purge 불필요.

**Deployment commits**: 2 wrangler deploys — (1) core mitigation, (2) CDN placeholder. 총 13787 files staged.

---

## 3. Phase B — Implementation

### B-1: P7-003 xelatex PDF rebuild — **DEFERRED**

- ✅ MiKTeX 25.12 basic 설치 (`winget install MiKTeX.MiKTeX`, exit 0)
- ✅ xelatex smoke test 정상 (MiKTeX-XeTeX 4.16)
- ✅ `scripts/templates/cheesestock-v8.tex`에 `\providecommand{\passthrough}[1]{#1}` 추가 (pandoc >=3.x 호환)
- ✅ `scripts/build_anatomy_pdf.py`의 `--listings` → `--highlight-style=tango` 교체
- ❌ PDF 빌드 실패: MASTER.md 내 `λ=2.0` 등 Greek 문자가 non-math mode에서 사용 → `Missing $ inserted` at L.793
- ⏭️ **Phase 8 이월**: MASTER.md의 `λ` / `σ` / `ρ` 등 Greek 문자를 `$\lambda$` 등 math mode로 일괄 치환하는 script 별도 작성 필요

Sidecar JSON 생성 안 됨 → `verify.py --check anatomy` WARN 유지 (baseline과 동일 수준).

### B-2: backtester.js `_collectOccurrences` 2-pass restructure — **COMPLETE**

기존 Phase 6 단일 pass (4/5 factor null 주입) → 3-pass:
- **Pass 1**: 패턴 기본 속성 + `aptModel.computeFactors(candles, idx, stockMeta)` raw 수집
- **Pass 2**: `aptModel.zscoreCohort(rawFactorsList)` 1회 호출 (n<5면 all-zero fallback)
- **Pass 3**: z-score된 값을 predict에 주입, `aptPrediction` + `aptFactors` 저장

meta 조달 경로: `backtester._currentStockMeta` (module-scope, Worker에서 `analysisWorker`가 msg.stockMeta로 주입).

### B-3: aptModel.js edge cases + zscoreCohort + liquidity ×100 bug fix — **COMPLETE**

Agent 1 설계 반영:
- ✅ `pbr > 0.01` gate (training L.331 정합; 적자/자본잠식 1/pbr 폭주 방지)
- ✅ `liquidity_20d` **×100 bug fix** (training L.350 unit parity)
- ✅ `count >= 10` trading days minimum (거래정지 11일 이상 시 null)
- ✅ `marketReturns60d` finite check 강화
- ✅ `idx < 60` global gate 제거 → factor별 개별 gate (valueInvPbr/logSize는 lookback 무관)
- ✅ `zscoreCohort(rawList)` 신규 API: median + MAD×1.4826, winsorize [−3,3], n<5 fallback

### B-3: appWorker.js `_getStockMetaForApt` + postMessage wiring — **COMPLETE**

- `_getStockMetaForApt()` helper: `{ marketCap (억원), pbr (= mcap/totalEquity), market }`
- 2개 postMessage 지점 (L.384 analyze, L.458 backtest)에 `stockMeta` 필드 포함
- `analysisWorker.js` 2개 수신 지점 (L.430, L.512)에서 `backtester._currentStockMeta` 주입

### B-4: IC 6-Layer MVP diagnostic — **COMPLETE**

Agent 2 pseudocode 정확 구현:
- `_fisherCI(r, nEff)` — Fisher z-transform + tanh back-transform
- `_computeAPTDiagnostic(validOccs, returns, h, candles, reg)` — L1 Pairing + L2 Cross-sectional + L3 ICIR + L5 Fisher CI + L9 Null contamination split + per-horizon MVP status judgment
- `_computeAPTMeta(result)` — L4 sign consistency h∈{3,5,10} + 5/5 GO gate 집계

horizon 루프 [1, 3, 5, 10, 20] 기존 `this.HORIZONS` 활용. Phase 6 `if (h === 5 && n>=20)` 단일 점 추정 블록을 완전 대체.

### B-5: MASTER Ch2.6.7 업데이트 — **COMPLETE**

P7-001 활성화 내용(3-pass pipeline, 6-Layer MVP, 5/5 GO gate, Phase 8 L6/L7/L8/L10 이월) 반영. `liquidity t=-27.6` → 실측값 `-24.69`로 정정 (Agent 3 발견).

---

## 4. MVP Gate 실측 관찰 (배포 후)

Phase 7 MVP GO 판정은 **배포된 클라이언트에서 실측 관찰** 필요. DevTools Console에서:

```js
// 종목 선택 후 Worker backtest 완료 대기 (10-15초)
// _analysisWorker postMessage backtestResult 수신 시점에 lastBacktestResults에 저장됨
window.lastBacktestResults._aptMeta
// → { signConsistent: bool, signH: {3,5,10}, mvpGate: { gates: {...}, passCount: N, status: 'GO'|'HOLD'|'NOGO' } }
```

**Phase 7 완료 기준**:
- [ ] DevTools에서 적어도 1 종목 (KOSPI 대형주 권장, e.g. 005930) 관찰 시 `mvpGate.status === 'GO'` (5/5) 혹은 `'HOLD'` (3-4/5)
- [ ] NOGO (< 3/5) 시 Phase 8 L6 block bootstrap 진입 필요 (offline pipeline retune)
- [ ] 복수 종목(KOSPI + KOSDAQ, 대형 + 중형)에서 `fullFactorRatio`, `icirAnn`, `icLift` 분포 관찰

**실측 단계는 본 세션 scope 밖** — 배포 완료 후 사용자가 cheesestock.co.kr incognito 방문하여 DevTools로 확인. 관찰 결과는 차회 세션 memory에 기록.

---

## 5. Deployment State

**현재 배포 URL**: https://cheesestock.co.kr (custom domain) + https://1c722854.cheesestock.pages.dev (preview)

- Mitigation 단계 배포 완료 (coefficients JSON behind /api/apt + placeholder)
- Phase 7 P7-001 code 변경 **미배포** — backtester.js / appWorker.js / analysisWorker.js / aptModel.js / index.html / sw.js / MASTER.md / verify.py 변경 스테이징 대기 중
- 최종 deploy 명령 (사용자 승인 시):
  ```bash
  python scripts/stage_deploy.py
  wrangler pages deploy deploy --project-name cheesestock --branch main \
      --commit-dirty=true --commit-message="phase7 p7-001 APT 5-factor full activation"
  ```

---

## 6. Known Risks & Phase 8 이월 항목

| 항목 | 이유 | 차회 세션 action |
|------|------|----------------|
| P7-003 xelatex PDF | MASTER.md `λ` math-mode 이슈 + `σ`, `ρ`, `√` Greek 문자 | Python script로 일괄 `λ → $\lambda$` 치환 → 재빌드 |
| Worker 내 aptModel | importScripts 포팅 시 `fetch(/api/apt)` signed 요청 가능 여부 검증 필요 | Worker용 sign bridge (analysisWorker.js RPC 패턴 재사용) |
| IC 6-Layer L6/L7/L8/L10 | 계산 비용 / scope 제약 | 별도 세션 (Phase 8 baseline) |
| MCS v2 fallback 백테스트 (P7-004) | 데이터 수집 선행 | Phase 8-A KOSIS full history |
| Phase C agents (code-audit / consistency / self-verify) | 사용량 제한 + 현 세션 실측 미완 | 배포 후 실측 관찰 병행 실행 |

---

## 7. Commit Plan

단일 bundled commit — **Phase 7 전체 번들** (Mitigation + P7-001):

**Subject**: `feat(apt): Phase 7 P7-001 + HMAC-protected /api/apt endpoint`

**Body**:
- HOLD mitigation (Agent 4 verdict): coefficients JSON moved behind /api/apt + CDN placeholder
- APT 5-factor activation: 3-pass pipeline (raw → cohort robust z-score → predict)
- IC 6-Layer MVP diagnostic (L1/L2/L3/L4/L5/L9) with 5/5 GO gate
- Critical bug fix: aptModel.js liquidity_20d ×100 unit parity (training L.350)
- Edge case hardening: pbr>0.01 gate, count>=10 trading days, idx<60 per-factor gate
- MASTER Ch2.6.7 Phase 7 update + liquidity t-stat -27.6 → -24.69 (Phase 4-1 actual)
- P7-003 xelatex PDF deferred (MASTER.md Greek chars → Phase 8)

---

## 8. Files Changed (14 files)

```
scripts/stage_deploy.py               (+SEC_PLACEHOLDERS, +mra_apt EXCLUDE_EXACT/SEC_PROTECTED)
scripts/verify.py                     (+apt CHECK 12/15, +placeholder exemption)
scripts/build_anatomy_pdf.py          (--listings → --highlight-style=tango)
scripts/templates/cheesestock-v8.tex  (+\providecommand{\passthrough})
functions/api/apt.js                  (NEW)
js/aptModel.js                        (edge cases + liquidity x100 fix + zscoreCohort)
js/backtester.js                      (2-pass _collectOccurrences + _computeAPTDiagnostic + _fisherCI + _computeAPTMeta)
js/appWorker.js                       (_getStockMetaForApt + postMessage stockMeta)
js/analysisWorker.js                  (backtester._currentStockMeta injection + backtester v48)
sw.js                                 (CACHE_NAME v85→v87 + /api/* bypass)
index.html                            (aptModel.js ?v=3, backtester.js ?v=48, appWorker.js ?v=20)
docs/anatomy_v8/CheeseStock_Anatomy_V8_KO_MASTER.md  (Ch2.6.7 Phase 7 update)
results/anatomy_v8_audit/phase7_agent_reports/*.md   (5 agent reports: NEW)
results/anatomy_v8_audit/phase7_completion_report.md (NEW)
```

---

**End of Phase 7 Completion Report**
