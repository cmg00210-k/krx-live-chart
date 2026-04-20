# Phase 6 Uplift Backlog — ANATOMY V8 Audit Follow-ups

**Context**: Phase 0-4 (ANATOMY V8 audit session 2026-04-20) 에서 식별되었으나 현 세션 범위를 초과한 작업들.

---

## P6-001: MCS v2 선행 대체 4-component fallback

**Source**: H6 (discrepancies.md), MASTER L.172 단기 note
**Owner**: macro-economist agent
**File**: `scripts/compute_macro_composite.py`

### Specification

현재 compute_macro_composite.py는 단일 8-component MCS만 산출. ECOS primary 데이터 stale (>14일) 시 KOSIS 4-component (CLI·ESI·IPI·소매판매) 기반 fallback MCS로 대체하는 로직 추가.

### Acceptance

1. ECOS primary freshness check (mcs_components.json.updated < 14일)
2. Stale 시 → KOSIS 4-component 재계산 → 별도 `mcsV2Fallback` 필드
3. `data/macro/macro_composite.json` 스키마 확장: `{ mcsV2, mcsV2Fallback, fallbackActive: bool }`
4. `appWorker.js`에서 `mcsV2Fallback` 소비 로직 (서버 이관 범위에 따라 `functions/api/confidence/macro.js` 병행 업데이트)
5. verify.py `--check pipeline` (Gate 1 CHECK 6) PASS
6. MASTER L.172 note 제거 + 정식 구성요소 표 추가

### Priority: P2 (non-blocking)
### ETA: Phase 6 Wave 6B (macro-economist wave)

---

## P6-002: APT model 예측 pipeline wiring

**Source**: C6 확장 (current session은 client loader/predict API 까지 완료)
**Owner**: cfa-financial-analyst + financial-engineering-expert
**Files**: `js/backtester.js`, `js/appWorker.js`, possibly new `functions/api/confidence/apt.js`

### Specification

`js/aptModel.js` 는 `predict(features)` API를 노출하되, 현재 아무 consumer가 호출하지 않음. backtester.js occurrence loop 또는 appWorker.js confidence pipeline에 연동 필요.

### Acceptance

1. **Option A (client)**: `js/backtester.js _computeOccurrences` 루프에서 종목별 factor 계산 → aptModel.predict() 호출 → `occ.aptPrediction` 필드 추가
2. **Option B (server)**: V48 Phase 2.5 패턴 따라 `functions/api/confidence/apt.js` 신규 엔드포인트 → HMAC 인증 → 서버에서 prediction 계산
3. APT prediction을 기존 confidence에 어떻게 결합할지 설계 결정:
   - New Layer 10 (post-PCA budget)?
   - Layer 4 (Micro) 내부 factor로 embed?
   - 별도 `confidenceAPT` 필드 (UI 표시용)?
4. Walk-Forward IC 비교 (APT-augmented vs baseline) + backtest 성능 측정
5. Gate 2 smoke test + Gate 1 CHECK 6 PASS

### Priority: P2 (productive extension, not blocking)
### ETA: Phase 6 Wave 6A (derivatives/CFA domain experts)

---

## P6-003: FF3 loadings → confidence layer wiring

**Source**: H1 / evidence_financials.md A12 finding
**Owner**: cfa-financial-analyst
**File**: `js/financials.js`, `js/appWorker.js`

### Specification

현재 FF3 분해(`_renderFF3Factors` at `financials.js:295`)는 D 칼럼 UI orphan — loadings가 confidence 조정 계층으로 흐르지 않음. MASTER L.19는 "정합적 구조" 언급. 실제 정합을 위해 FF3 loadings를 Layer 4 (Micro) 또는 신규 Layer에 연결.

### Acceptance

1. 종목별 FF3 loadings 계산 (MKT/SMB/HML 베타) — 이미 `financials.js`에 있으면 재활용
2. Micro layer에 FF3-based factor 추가 또는 별도 CONF-계층 신설
3. 학술적 justification: Fama-French (1993) 팩터가 기대수익률 설명력 → 신뢰도 multiplier 방향성 결정
4. clamp range [0.90, 1.10] conservative 권장 (FF3는 패턴-수익 직접 모형 아님)
5. MASTER Ch2.6.8 FF3 절에 client wiring 반영

### Priority: P3 (theoretical enhancement)
### ETA: Phase 6 Wave 6B

---

## P6-004: HTML/PDF 재생성 파이프라인 정식화

**Source**: Phase 4 deferral (FINAL_REPORT)
**Owner**: orchestrator
**Files**: `scripts/build_master_pdf.py` (or equivalent)

### Specification

MASTER.md → HTML/PDF 변환 시 Pretendard 폰트 임베드 + 수식 렌더링 정확성 보장 필요. 현재 수동 pandoc + LibreOffice 경로는 font fallback 위험.

### Acceptance

1. `scripts/build_anatomy_pdf.py` 스크립트 정식화
2. Pretendard 폰트 번들링 (subsetting OK)
3. LaTeX math rendering 검증 (Ch2 수식 전수 통과)
4. verify.py 체크 추가: md SHA256 ↔ pdf SHA256 동기화
5. 배포 스크립트 통합 (stage_deploy.py 옵션)

### Priority: P3
### ETA: Phase 6 Wave 6C (infrastructure)

---

## Scheduling notes

- Phase 6 실행 세션은 본 감사 세션과 분리된 독립 세션이어야 함 (context 효율)
- P6-001 → P6-002 → P6-003 → P6-004 순서 권장 (dependencies 낮은 순)
- 각 티켓은 Gate 5 세션 시작/종료 체크리스트 준수 (verify.py --strict + Gate 2 smoke 필수)
- 배포는 security/v48-phase3 머지 완료 + 특허 공지예외(§30) 신청 완료 후
