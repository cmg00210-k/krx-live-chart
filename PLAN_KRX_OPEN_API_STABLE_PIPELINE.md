# KRX Open API Stable Pipeline — Grand Migration Plan

**Date:** 2026-04-02 | **Author:** 6-Agent Parallel Research Synthesis
**Status:** PLAN (코드 수정 없음 — 전 Phase 검증 후 순차 실행)
**Goal:** OTP 전면 폐지 가능 수준의 Open API 안정 파이프라인 구축

---

## 1. 상황 진단

### 1.1 Phase 0 실패 근본 원인 (2가지)

**원인 A — 엔드포인트 경로 오류 (17/25)**

| 틀린 경로 | 정확한 경로 | 오류 유형 |
|-----------|-----------|----------|
| `etf/etf_bydd_trd` | `etp/etf_bydd_trd` | 카테고리 프리픽스 (`etf/` → `etp/`) |
| `etn/etn_bydd_trd` | `etp/etn_bydd_trd` | 〃 |
| `elw/elw_bydd_trd` | `etp/elw_bydd_trd` | 〃 |
| `gld/gld_bydd_trd` | `gen/gold_bydd_trd` | 카테고리 + 약어 (`gld/gld` → `gen/gold`) |
| `oil/oil_bydd_trd` | `gen/oil_bydd_trd` | 카테고리 (`oil/` → `gen/`) |
| `ets/ets_bydd_trd` | `gen/ets_bydd_trd` | 카테고리 (`ets/` → `gen/`) |
| `drv/drvprdidx_prce_info` | `idx/drvprod_dd_trd` | 카테고리 + 접미사 (`drv/` → `idx/`, `_prce_info` → `_dd_trd`) |
| `idx/kospi_bydd_prce_info` | `idx/kospi_dd_trd` | 접미사 (`_bydd_prce_info` → `_dd_trd`) |
| `idx/ksq_bydd_prce_info` | `idx/kosdaq_dd_trd` | 약어 + 접미사 (`ksq` → `kosdaq`, `_bydd_prce_info` → `_dd_trd`) |
| `idx/krx_bydd_prce_info` | `idx/krx_dd_trd` | 접미사 |
| `bon/bdidx_prce_info` | `idx/bon_dd_trd` | 카테고리 (`bon/` → `idx/`) |
| `bon/smlbd_bydd_trd` | `bon/smb_bydd_trd` | 약어 (`smlbd` → `smb`) |
| `bon/gnbd_bydd_trd` | `bon/bnd_bydd_trd` | 약어 (`gnbd` → `bnd`) |
| `bon/ktbm_bydd_trd` | `bon/kts_bydd_trd` | 약어 (`ktbm` → `kts`) |
| `drv/stk_fut_bydd_trd` | `drv/eqsfu_stk_bydd_trd` | 약어 (`stk_fut` → `eqsfu_stk`) |
| `drv/stk_opt_bydd_trd` | `drv/eqsop_bydd_trd` | 약어 (`stk_opt` → `eqsop`) |
| `sto/wrnt_bydd_trd` | `sto/sw_bydd_trd` | 약어 (`wrnt` → `sw`) |

**원인 B — 서비스별 개별 승인 미완료**

KRX Open API는 2단계 인증:
1. 계정 AUTH_KEY 발급 (완료)
2. **서비스별 개별 "API 이용신청"** (25개 중 6개만 승인 상태)

미승인 서비스 호출 → HTTP 404 또는 401 반환. 경로가 맞아도 승인 없으면 실패.

### 1.2 KRX 생태계 변화 (2025.12.27)

- **data.krx.co.kr 전면 개편**: "KRX 데이터 마켓플레이스" 회원제 전환
- OTP 방식이 로그인 없이 "LOGOUT" 반환 → pykrx/FDR 전부 깨짐
- KRX 공식 입장: "AI 봇의 무단 데이터 수집으로 서버 과부하" → Open API가 공식 경로
- **OTP는 사실상 deprecated** — 언제 완전 차단될지 불명

### 1.3 Open API vs OTP 비교

| 항목 | OTP (data.krx.co.kr) | Open API (data-dbg.krx.co.kr) |
|------|---------------------|-------------------------------|
| 인증 | 세션 쿠키 + 로그인 | AUTH_KEY 헤더 (stateless) |
| 요청 | 2-step (OTP 생성 → CSV) | 1-step GET → JSON |
| 인코딩 | EUC-KR CSV | UTF-8 JSON |
| 차단 위험 | **높음** (IP 차단 다수 사례) | **낮음** (공식 지원) |
| 일일 한도 | 미공개 (휴리스틱 차단) | 10,000건/일 (공식) |
| 안정성 | 불안정 (비공식, 무고지 변경) | 안정 (공식 버전 API) |
| 커버리지 | 완전 (웹 UI 전체) | 31 엔드포인트 (투자자/공매도 제외) |

---

## 2. 확정 엔드포인트 전수 목록 (31개, 7카테고리)

출처: krx-rs (KRX_API_Spec.md) + pykrx-openapi (constants.py) + openkrx-mcp — 3개 독립 교차검증

### Base URL: `https://data-dbg.krx.co.kr/svc/apis/{path}`

### 2.1 idx (지수) — 5개
| # | 서비스명 | 경로 | 파라미터 | 우리 사용 |
|---|---------|------|---------|----------|
| 1 | KRX 시리즈 일별시세정보 | `idx/krx_dd_trd` | basDd | signalEngine 레짐 |
| 2 | KOSPI 시리즈 일별시세정보 | `idx/kospi_dd_trd` | basDd | signalEngine 레짐 |
| 3 | KOSDAQ 시리즈 일별시세정보 | `idx/kosdaq_dd_trd` | basDd | signalEngine 레짐 |
| 4 | 채권지수 시세정보 | `idx/bon_dd_trd` | basDd | 매크로 팩터 |
| 5 | **파생상품지수 시세정보 (VKOSPI)** | `idx/drvprod_dd_trd` | basDd | **signalEngine VIX 대체** |

### 2.2 sto (주식) — 8개
| # | 서비스명 | 경로 | 파라미터 | 우리 사용 |
|---|---------|------|---------|----------|
| 6 | 유가증권 일별매매정보 | `sto/stk_bydd_trd` | basDd | **확정 OK** |
| 7 | 코스닥 일별매매정보 | `sto/ksq_bydd_trd` | basDd | **확정 OK** |
| 8 | 코넥스 일별매매정보 | `sto/knx_bydd_trd` | basDd | **확정 OK** |
| 9 | 신주인수권증권 일별매매정보 | `sto/sw_bydd_trd` | basDd | 미사용 |
| 10 | 신주인수권증서 일별매매정보 | `sto/sr_bydd_trd` | basDd | 미사용 |
| 11 | 유가증권 종목기본정보 | `sto/stk_isu_base_info` | — | **확정 OK** |
| 12 | 코스닥 종목기본정보 | `sto/ksq_isu_base_info` | — | 신규 활용 가능 |
| 13 | 코넥스 종목기본정보 | `sto/knx_isu_base_info` | — | 미사용 |

### 2.3 etp (증권상품) — 3개
| # | 서비스명 | 경로 | 파라미터 | 우리 사용 |
|---|---------|------|---------|----------|
| 14 | **ETF 일별매매정보** | `etp/etf_bydd_trd` | basDd | **download_etf.py 전환** |
| 15 | ETN 일별매매정보 | `etp/etn_bydd_trd` | basDd | 향후 확장 |
| 16 | ELW 일별매매정보 | `etp/elw_bydd_trd` | basDd | 미사용 |

### 2.4 bon (채권) — 3개
| # | 서비스명 | 경로 | 파라미터 | 우리 사용 |
|---|---------|------|---------|----------|
| 17 | 국채전문유통시장 일별매매정보 | `bon/kts_bydd_trd` | basDd | 매크로 팩터 |
| 18 | 일반채권시장 일별매매정보 | `bon/bnd_bydd_trd` | basDd | 미사용 |
| 19 | 소액채권시장 일별매매정보 | `bon/smb_bydd_trd` | basDd | 미사용 |

### 2.5 drv (파생상품) — 6개
| # | 서비스명 | 경로 | 파라미터 | 우리 사용 |
|---|---------|------|---------|----------|
| 20 | 선물 일별매매정보 | `drv/fut_bydd_trd` | basDd | **확정 OK** |
| 21 | 주식선물(유가) 일별매매정보 | `drv/eqsfu_stk_bydd_trd` | basDd | 승인 후 검증 |
| 22 | 주식선물(코스닥) 일별매매정보 | `drv/eqkfu_ksq_bydd_trd` | basDd | 승인 후 검증 |
| 23 | 옵션 일별매매정보 | `drv/opt_bydd_trd` | basDd | **확정 OK** |
| 24 | 주식옵션(유가) 일별매매정보 | `drv/eqsop_bydd_trd` | basDd | 승인 후 검증 |
| 25 | 주식옵션(코스닥) 일별매매정보 | `drv/eqkop_bydd_trd` | basDd | 승인 후 검증 |

### 2.6 gen (일반상품) — 3개
| # | 서비스명 | 경로 | 파라미터 | 우리 사용 |
|---|---------|------|---------|----------|
| 26 | 금시장 일별매매정보 | `gen/gold_bydd_trd` | basDd | 매크로 팩터 |
| 27 | 석유시장 일별매매정보 | `gen/oil_bydd_trd` | basDd | 매크로 팩터 |
| 28 | 배출권시장 일별매매정보 | `gen/ets_bydd_trd` | basDd | 미사용 |

### 2.7 esg (ESG) — 3개
| # | 서비스명 | 경로 | 우리 사용 |
|---|---------|------|----------|
| 29 | SRI채권 정보 | `esg/sri_bond_info` | 미사용 |
| 30 | ESG ETP 정보 | `esg/esg_etp_info` | 미사용 |
| 31 | ESG 지수 정보 | `esg/esg_index_info` | 미사용 |

---

## 3. Open API 서비스 미제공 확정 (OTP 영구 유지)

| 데이터 | KRX Stat Page | OTP url 파라미터 | 이유 |
|--------|---------------|-----------------|------|
| 투자자별 매매동향 | MDCSTAT02301 | `dbms/MDC/STAT/standard/MDCSTAT02301` | 31개 서비스 카탈로그에 없음 |
| 외국인 보유현황 | MDCSTAT03602 | `dbms/MDC/STAT/standard/MDCSTAT03602` | 〃 |
| 공매도 거래현황 | MDCSTAT08601 | `dbms/MDC/STAT/standard/MDCSTAT08601` | 〃 |
| 공매도 잔고현황 | MDCSTAT08301 | `dbms/MDC/STAT/standard/MDCSTAT08301` | 〃 |

→ `download_investor.py`, `download_shortselling.py`는 OTP 유지 + 안정화 대상

---

## 4. 실행 계획 (7 Phase)

### Phase 0-R: 포털 승인 + 정정 경로 재검증 [수동 + 자동]

**목표:** 31개 엔드포인트 전수 검증, OK/EMPTY/401/404 완전 분류

**Step 1 (수동 — 사용자):**
1. `openapi.krx.co.kr` 로그인
2. "서비스 이용" → 7개 카테고리 순회
3. 각 서비스에 "API 이용 신청" 클릭 (이미 승인된 6개 제외)
4. 승인 대기 (통상 1영업일)
5. MyPage에서 승인 상태 확인

**Step 2 (자동 — krx_probe_phase0.py 정정):**
```
PROBE_TARGETS의 endpoint + alt_endpoints를 §2의 확정 경로로 교체
→ python scripts/krx_probe_phase0.py --verbose --output results/probe_phase0r.json
```

**성공 기준:** 우리가 사용하는 15개 서비스 전부 OK 또는 EMPTY (공휴일)
**실패 시:** 401 = 미승인 (포털 재확인), 404 = 경로 오류 (§2 재검증)

---

### Phase 1: krx_api.py 프로덕션 강화 [1 Agent]

**목표:** 안정적 프로덕션 파이프라인의 공통 기반

#### 1-A. ENDPOINTS 확장
```python
ENDPOINTS = {
    # 지수 (5)
    "idx_krx":      "idx/krx_dd_trd",
    "idx_kospi":    "idx/kospi_dd_trd",
    "idx_kosdaq":   "idx/kosdaq_dd_trd",
    "idx_bond":     "idx/bon_dd_trd",
    "idx_deriv":    "idx/drvprod_dd_trd",      # VKOSPI
    # 주식 (6)
    "stock_daily":  "sto/stk_bydd_trd",         # 확정
    "stock_info":   "sto/stk_isu_base_info",    # 확정
    "kosdaq_daily": "sto/ksq_bydd_trd",         # 확정
    "kosdaq_info":  "sto/ksq_isu_base_info",
    "konex_daily":  "sto/knx_bydd_trd",         # 확정
    "konex_info":   "sto/knx_isu_base_info",
    # ETP (3)
    "etf_daily":    "etp/etf_bydd_trd",
    "etn_daily":    "etp/etn_bydd_trd",
    "elw_daily":    "etp/elw_bydd_trd",
    # 채권 (3)
    "bond_govt":    "bon/kts_bydd_trd",
    "bond_general": "bon/bnd_bydd_trd",
    "bond_small":   "bon/smb_bydd_trd",
    # 파생 (6)
    "futures_daily":       "drv/fut_bydd_trd",  # 확정
    "futures_stock_kospi": "drv/eqsfu_stk_bydd_trd",
    "futures_stock_kosdaq":"drv/eqkfu_ksq_bydd_trd",
    "options_daily":       "drv/opt_bydd_trd",  # 확정
    "options_stock_kospi": "drv/eqsop_bydd_trd",
    "options_stock_kosdaq":"drv/eqkop_bydd_trd",
    # 일반상품 (3)
    "gold_daily":   "gen/gold_bydd_trd",
    "oil_daily":    "gen/oil_bydd_trd",
    "ets_daily":    "gen/ets_bydd_trd",
}
```

#### 1-B. 프로덕션 안정화 8대 개선

| # | 개선 항목 | 현재 | 목표 |
|---|----------|------|------|
| 1 | 레이트 리밋 | 0.3s | **0.5s** (커뮤니티 기준) |
| 2 | 타임아웃 | 단일 60s | **분리 (10s connect, 60s read)** |
| 3 | 재시도 | 없음 | **3회 지수 백오프 (1s, 2s, 4s)** — 5xx/timeout만 |
| 4 | 에러 분류 | respCode != 200 → 빈 배열 | **retryable (5xx, timeout) vs fatal (401, 404)** |
| 5 | 일일 쿼터 | 미추적 | **카운터 + 9,000건 경고, 10,000건 중단** |
| 6 | AUTH_KEY 만료 | 미추적 | **발급일 기록, 30일 전 경고** |
| 7 | 응답 검증 | HTTP status만 | **HTTP status + JSON respCode 이중 검증** |
| 8 | 서비스 승인 캐시 | 없음 | **approved_services.json — 401 시 fast-fail** |

#### 1-C. OTP 공통 유틸 (investor + shortselling용)

```python
# scripts/krx_otp.py — OTP 2-step 공통 래퍼
class KRXOTPClient:
    def __init__(self, max_retries=3, backoff_base=1.0):
        ...
    def fetch_csv(self, stat_url, params, encoding='euc-kr'):
        """OTP 생성 → CSV 다운로드, 재시도 + 지수 백오프"""
        ...
```

---

### Phase 2: 스크립트 마이그레이션 [5 Parallel Agents]

**원칙:**
- 출력 JSON 스키마 불변 (app.js 하위 호환)
- Open API 실패 시 OTP 자동 폴백 (전환 초기 안전망)
- 각 스크립트 독립적으로 검증 가능

#### 2-A. download_vkospi.py → Open API

| 항목 | OTP (현재) | Open API (목표) |
|------|-----------|----------------|
| 소스 | MDCSTAT01701 OTP | `idx/drvprod_dd_trd` |
| 요청 | 2-step × 1 (날짜 범위) | 1-step GET × N (일별) |
| 출력 | `data/vkospi.json` | **동일** |
| 스키마 | `[{time, open, high, low, close}]` | **동일** |

**매핑:** Open API 필드 → 출력 필드 (Phase 0-R에서 실제 필드명 확인 필요)

**주의:** VKOSPI는 idx 카테고리의 파생상품지수. `idx/drvprod_dd_trd` 응답에서 VKOSPI 행을 필터링해야 할 수 있음.

#### 2-B. download_etf.py → Open API

| 항목 | OTP (현재) | Open API (목표) |
|------|-----------|----------------|
| 소스 | MDCSTAT04301 + MDCSTAT04501 | `etp/etf_bydd_trd` |
| 요청 | 4-step (OTP×2 + CSV×2) | 1-step GET |
| 출력 | `etf_daily.json` + `etf_summary.json` | **동일** |

**주의:**
- OTP는 2개 stat page (가격/NAV + 괴리율/설정환매)
- Open API `etp/etf_bydd_trd`가 어디까지 커버하는지 Phase 0-R에서 필드 확인 필수
- 누락 필드 있으면 OTP 보완 또는 필드 생략 결정

#### 2-C. download_derivatives.py → Open API

| 항목 | OTP (현재) | Open API (목표) |
|------|-----------|----------------|
| 소스 | MDCSTAT12501 + MDCSTAT12601 | `drv/fut_bydd_trd` + `drv/opt_bydd_trd` |
| 요청 | N일 × 4-step = **88+ 요청** | N일 × 2 GET = **~44 요청** |
| 출력 | 3개 JSON (futures, options, summary) | **동일** |

**필드 매핑 (확정):**

선물:
```
BAS_DD → time, ISU_NM → contractName
TDD_OPNPRC → open, TDD_HGPRC → high, TDD_LWPRC → low, TDD_CLSPRC → close
CMPPREVDD_PRC → change, ACC_TRDVOL → volume, ACC_TRDVAL → tradingValue
ACC_OPNINT_QTY → openInterest, SETL_PRC → settlementPrice
SPOT_PRC → (basis 계산용)
```

옵션:
```
RGHT_TP_NM → optionType (콜/풋 판별)
IMP_VOLT → iv
```

#### 2-D. download_investor.py — OTP 안정화

OTP 영구 유지. `KRXOTPClient` 적용:
- 3회 재시도 + 지수 백오프
- "LOGOUT" 에러 감지 + 재인증 로직
- 날짜 폴백 (비영업일 5일 워크백)

#### 2-E. download_shortselling.py — OTP 안정화

OTP 영구 유지. `KRXOTPClient` 적용:
- 동일한 재시도 + 백오프 패턴
- 시장별 (STK/KSQ) 독립 실패 허용

---

### Phase 3: Probe 스크립트 영구 업그레이드 [1 Agent]

`krx_probe_phase0.py` → `krx_probe.py` 리네임 + 상시 모니터링용:

- PROBE_TARGETS를 §2의 31개 확정 경로로 교체
- `--quick` 모드: 우리가 사용하는 15개만 (일일 파이프라인 전 헬스체크)
- `--full` 모드: 31개 전수 검증 (주간 감사용)
- 결과를 `data/api_health.json`에 저장 → app.js에서 데이터 신선도 표시 가능
- cron 연동: `daily_update.bat` 시작 전 `--quick` 실행, 실패 시 중단

---

### Phase 4: Worker H-2 + Frontend 통합 [2 Agents]

**Phase 2의 출력 JSON 스키마가 불변이므로 app.js 변경 최소화**

#### 4-A. analysisWorker.js — 'marketContext' 핸들러
- 수신: `{ type: 'marketContext', vkospi, pcr, basis, leverageRatio }`
- signalEngine에 주입: `signalEngine._marketContext = data`
- 레짐 분류만 Worker 내부, 멀티플라이어는 메인 스레드 (이중 적용 방지)

#### 4-B. app.js — 발송 로직
- `_loadDerivativesData()` 완료 후 Worker에 marketContext 전달
- 기존 `_applyDerivativesConfidenceToPatterns()` 유지 (메인 스레드)

---

### Phase 5: SW v52 + 배포 [1 Agent]

1. `sw.js` CACHE_NAME `cheesestock-v51` → `cheesestock-v52`
2. `index.html` 내 `?v=51` → `?v=52` (모든 JS 참조)
3. `sw.js` STATIC_ASSETS에 신규/변경 파일 반영
4. `python scripts/verify.py --strict` 통과
5. `python scripts/stage_deploy.py` + `wrangler pages deploy deploy/`

---

### Phase 6: 일일 파이프라인 통합 [1 Agent]

`scripts/daily_update.bat` 업데이트:

```batch
@echo off
REM ── Phase 0: API 헬스체크 ──
python scripts/krx_probe.py --quick
if %ERRORLEVEL% NEQ 0 (
    echo [ALERT] KRX API health check failed, aborting
    exit /b 1
)

REM ── Phase 1: Open API 데이터 ──
python scripts/download_derivatives.py
python scripts/download_vkospi.py
python scripts/download_etf.py

REM ── Phase 2: OTP 데이터 (investor + shortselling) ──
python scripts/download_investor.py
python scripts/download_shortselling.py

REM ── Phase 3: 기존 OHLCV + 인트라데이 ──
python scripts/download_ohlcv.py
python scripts/generate_intraday.py
python scripts/update_index_prices.py
```

---

### Phase 7 (Deferred): download_ohlcv.py Open API 전환

현재 pykrx + FDR 사용. Open API `sto/stk_bydd_trd` + `sto/ksq_bydd_trd`로 대체 가능하나:
- pykrx가 이미 로그인 적응 중 (Milestone #2)
- OHLCV는 2,700+ 종목 × 250+ 영업일 = 대량 요청
- 10,000건/일 쿼터에 영향
- **pykrx 안정화 확인 후 별도 세션에서 검토**

---

## 5. 의존성 그래프

```
Phase 0-R (수동 포털 승인 + 재검증)
    │
    ├── Phase 1 (krx_api.py 강화)
    │       │
    │       ├── Phase 2-A (vkospi)  ─┐
    │       ├── Phase 2-B (etf)      ├── 병렬 가능
    │       ├── Phase 2-C (deriv)    │
    │       ├── Phase 2-D (investor) │
    │       └── Phase 2-E (short)   ─┘
    │
    ├── Phase 3 (probe 영구화) ── Phase 1과 병렬 가능
    │
    └── Phase 2 전부 완료
            │
            ├── Phase 4 (Worker H-2) ── Phase 5와 순차
            │
            └── Phase 5 (SW v52)
                    │
                    └── Phase 6 (daily pipeline)
```

---

## 6. 에이전트 배치 계획

| Phase | Agent 수 | 병렬 | 예상 작업 |
|-------|---------|------|----------|
| 0-R | 0 (수동) + 1 | — | 포털 승인 + probe 정정 |
| 1 | 1 | — | krx_api.py 강화 + krx_otp.py 신규 |
| 2 | 5 | **전체 병렬** | 5개 스크립트 마이그레이션/안정화 |
| 3 | 1 | Phase 1과 병렬 | probe 영구화 |
| 4 | 2 | 순차 (4-A → 4-B) | Worker + app.js |
| 5 | 1 | — | SW + deploy |
| 6 | 1 | — | daily_update.bat |
| **합계** | **12 agents** | | |

---

## 7. 위험 매트릭스

| 위험 | 확률 | 영향 | 완화 |
|------|------|------|------|
| Phase 0-R 재검증 실패 (경로 여전히 404) | 낮음 | 차단 | 3개 독립 소스 교차검증 완료, 높은 신뢰도 |
| 서비스 승인 지연 (>1영업일) | 중간 | 지연 | 승인 대기 중 OTP 폴백 유지 |
| VKOSPI 필드 누락 (idx/drvprod_dd_trd가 OHLC 미제공) | 중간 | 우회 | OTP 폴백, Phase 0-R에서 필드 확인 |
| ETF Open API 필드 부족 (NAV/괴리율 미제공) | 중간 | 부분 | OTP 보완 or 필드 생략 |
| AUTH_KEY 쿼터 초과 (10,000/일) | 낮음 | 일시 중단 | 쿼터 추적 + 9,000건 경고 |
| OTP 완전 차단 (investor/shortselling) | 낮음 | 심각 | KRX에 Open API 서비스 추가 요청, 대체 소스 탐색 |

---

## 8. 성공 기준

- [ ] Phase 0-R: 우리가 사용하는 15개 엔드포인트 전부 OK
- [ ] Phase 1: krx_api.py 8대 개선 적용, 재시도 + 쿼터 추적 동작
- [ ] Phase 2: 5개 스크립트 정상 실행, 출력 JSON 스키마 불변 확인
- [ ] Phase 3: `--quick` 헬스체크 30초 이내 완료
- [ ] Phase 4: Worker marketContext 핸들러 동작, 콘솔 로그 확인
- [ ] Phase 5: verify.py --strict 통과, cheesestock-v52 배포
- [ ] Phase 6: daily_update.bat 무인 실행 성공

---

## 9. 참조 소스

| 소스 | 유형 | URL |
|------|------|-----|
| krx-rs KRX_API_Spec.md | 31 엔드포인트 명세 | github.com/seobaeksol/krx-rs |
| pykrx-openapi constants.py | 31 경로 + 파라미터 | github.com/raccoonyy/pykrx-openapi |
| openkrx-mcp | 31 도구 독립 검증 | github.com/RealYoungk/openkrx-mcp |
| KRX Open API 포털 | 공식 서비스 목록 | openapi.krx.co.kr |
| bbangpower 블로그 | 입문 가이드 | bbangpower-blog.blogspot.com |
| velog ETF 튜토리얼 | etp/etf_bydd_trd 확인 | velog.io/@pys573 |
| pykrx Issue #244 | 2025.12 변경 사항 | github.com/sharebook-kr/pykrx |
| pykrx Issue #252 | pykrx-openapi 등장 | 〃 |
| i-whale 블로그 | 서비스별 승인 경험 | i-whale.com |
