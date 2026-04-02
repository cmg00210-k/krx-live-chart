#!/usr/bin/env python3
"""
KRX Open API Phase 0 — 28개 엔드포인트 전수 검증 + 파이프라인 헬스체크

각 엔드포인트에 대해:
  1. HTTP 상태 코드
  2. respCode (KRX 내부 에러코드)
  3. OutBlock_1 레코드 수
  4. 반환된 필드명 (첫 번째 레코드 기준)

사용법:
    python scripts/krx_probe_phase0.py                     # 전체 28개 엔드포인트
    python scripts/krx_probe_phase0.py --quick              # 파이프라인 13개만 (<30s)
    python scripts/krx_probe_phase0.py --quick --save-health  # + data/api_health.json 저장
    python scripts/krx_probe_phase0.py --date 20260401
    python scripts/krx_probe_phase0.py --verbose
    python scripts/krx_probe_phase0.py --output results/probe_20260402.json
    python scripts/krx_probe_phase0.py --id 8 --verbose    # VKOSPI 단독 확인
    python scripts/krx_probe_phase0.py --category 채권      # 채권 4개만

결과 해석:
  [OK   ] → endpoint 존재, 데이터 반환
  [EMPTY] → endpoint 존재하나 데이터 없음 (공휴일, 파라미터 필요)
  [ERR  ] → KRX respCode != "200" (잘못된 경로 또는 권한 없음)
  [HTTP ] → HTTP 4xx/5xx (경로 자체가 존재하지 않음)
  [FAIL ] → 네트워크 오류 / 타임아웃

종료코드:
  --quick 모드: 0=ALL OK/EMPTY, 1=ANY FAILED
  기본 모드:    0=ANY OK,       1=NONE OK
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta

try:
    import requests
except ImportError:
    raise SystemExit("[PROBE] requests 필요: pip install requests")

# ── 프로젝트 루트에서 krx_api.py 임포트 ──
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
from krx_api import _load_env_key, API_BASE, RATE_LIMIT_SEC, HEADERS


def _last_business_day(ref=None):
    """최근 영업일 (토/일 건너뜀)"""
    d = ref or datetime.now()
    d = d - timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


# ═══════════════════════════════════════════════════════════
# 25 승인 서비스 + 예상 엔드포인트 + 대안 경로
# ═══════════════════════════════════════════════════════════
PROBE_TARGETS = [
    # ──── 지수 (idx) ────  [접미사: _dd_trd]
    {"id": 1,  "name_ko": "KRX 시리즈 일별시세정보",        "category": "지수",   "endpoint": "idx/krx_dd_trd",           "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 2,  "name_ko": "KOSPI 시리즈 일별시세정보",      "category": "지수",   "endpoint": "idx/kospi_dd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 3,  "name_ko": "KOSDAQ 시리즈 일별시세정보",     "category": "지수",   "endpoint": "idx/kosdaq_dd_trd",        "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 4,  "name_ko": "채권지수 시세정보",             "category": "지수",   "endpoint": "idx/bon_dd_trd",           "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 5,  "name_ko": "파생상품지수 시세정보 (VKOSPI)", "category": "지수",   "endpoint": "idx/drvprod_dd_trd",       "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    # ──── 주식 (sto) ────  [접미사: _bydd_trd / _isu_base_info]
    {"id": 6,  "name_ko": "유가증권 일별매매정보",          "category": "주식",   "endpoint": "sto/stk_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 7,  "name_ko": "코스닥 일별매매정보",            "category": "주식",   "endpoint": "sto/ksq_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 8,  "name_ko": "코넥스 일별매매정보",            "category": "주식",   "endpoint": "sto/knx_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 9,  "name_ko": "신주인수권증권 일별매매정보",     "category": "주식",   "endpoint": "sto/sw_bydd_trd",          "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 10, "name_ko": "신주인수권증서 일별매매정보",     "category": "주식",   "endpoint": "sto/sr_bydd_trd",          "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 11, "name_ko": "유가증권 종목기본정보",          "category": "주식",   "endpoint": "sto/stk_isu_base_info",    "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 12, "name_ko": "코스닥 종목기본정보",            "category": "주식",   "endpoint": "sto/ksq_isu_base_info",    "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 13, "name_ko": "코넥스 종목기본정보",            "category": "주식",   "endpoint": "sto/knx_isu_base_info",    "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    # ──── 증권상품 (etp) ────
    {"id": 14, "name_ko": "ETF 일별매매정보",              "category": "ETP",    "endpoint": "etp/etf_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 15, "name_ko": "ETN 일별매매정보",              "category": "ETP",    "endpoint": "etp/etn_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 16, "name_ko": "ELW 일별매매정보",              "category": "ETP",    "endpoint": "etp/elw_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    # ──── 채권 (bon) ────
    {"id": 17, "name_ko": "국채전문유통시장 일별매매정보",   "category": "채권",   "endpoint": "bon/kts_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 18, "name_ko": "일반채권시장 일별매매정보",       "category": "채권",   "endpoint": "bon/bnd_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 19, "name_ko": "소액채권시장 일별매매정보",       "category": "채권",   "endpoint": "bon/smb_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    # ──── 파생상품 (drv) ────
    {"id": 20, "name_ko": "선물 일별매매정보",              "category": "파생",   "endpoint": "drv/fut_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 21, "name_ko": "주식선물(유가) 일별매매정보",     "category": "파생",   "endpoint": "drv/eqsfu_stk_bydd_trd",   "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 22, "name_ko": "주식선물(코스닥) 일별매매정보",   "category": "파생",   "endpoint": "drv/eqkfu_ksq_bydd_trd",   "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 23, "name_ko": "옵션 일별매매정보",              "category": "파생",   "endpoint": "drv/opt_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 24, "name_ko": "주식옵션(유가) 일별매매정보",     "category": "파생",   "endpoint": "drv/eqsop_bydd_trd",       "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 25, "name_ko": "주식옵션(코스닥) 일별매매정보",   "category": "파생",   "endpoint": "drv/eqkop_bydd_trd",       "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    # ──── 일반상품 (gen) ────
    {"id": 26, "name_ko": "금시장 일별매매정보",            "category": "일반상품","endpoint": "gen/gold_bydd_trd",        "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 27, "name_ko": "석유시장 일별매매정보",           "category": "일반상품","endpoint": "gen/oil_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
    {"id": 28, "name_ko": "배출권시장 일별매매정보",         "category": "일반상품","endpoint": "gen/ets_bydd_trd",         "alt_endpoints": [],                                           "params": {}, "confidence": "confirmed"},
]

CATEGORY_ORDER = ["지수", "주식", "ETP", "채권", "파생", "일반상품"]

# ── --quick 모드: 파이프라인이 실제 사용하는 13개 엔드포인트 ──
QUICK_ENDPOINTS = {
    "idx/drvprod_dd_trd",       # VKOSPI
    "idx/kospi_dd_trd",         # KOSPI 지수
    "idx/kosdaq_dd_trd",        # KOSDAQ 지수
    "sto/stk_bydd_trd",         # 유가증권 매매
    "sto/ksq_bydd_trd",         # 코스닥 매매
    "sto/knx_bydd_trd",         # 코넥스 매매
    "sto/stk_isu_base_info",    # 유가증권 종목기본정보
    "etp/etf_bydd_trd",         # ETF 매매
    "bon/kts_bydd_trd",         # 국채 매매
    "drv/fut_bydd_trd",         # 선물 매매
    "drv/opt_bydd_trd",         # 옵션 매매
    "gen/gold_bydd_trd",        # 금시장
    "gen/oil_bydd_trd",         # 석유시장
}

STATUS_ICONS = {
    "OK": "[OK   ]", "EMPTY": "[EMPTY]", "ERR": "[ERR  ]",
    "HTTP": "[HTTP ]", "FAIL": "[FAIL ]",
}


def probe_endpoint(session, endpoint, params, verbose=False, timeout=30):
    """단일 엔드포인트 프로브."""
    url = f"{API_BASE}/{endpoint}"
    result = {"status": "FAIL", "http_code": None, "resp_code": None,
              "resp_msg": None, "record_count": 0, "fields": [], "sample": None}

    try:
        resp = session.get(url, params=params, timeout=timeout)
        result["http_code"] = resp.status_code
        if resp.status_code >= 400:
            result["status"] = "HTTP"
            return result
        try:
            data = resp.json()
        except Exception:
            result["status"] = "FAIL"
            result["resp_msg"] = f"JSON parse error: {resp.text[:80]}"
            return result

        result["resp_code"] = str(data.get("respCode", ""))
        result["resp_msg"] = data.get("respMsg", "")
        if result["resp_code"] and result["resp_code"] != "200":
            result["status"] = "ERR"
            return result

        records = data.get("OutBlock_1", [])
        result["record_count"] = len(records)
        if records:
            result["status"] = "OK"
            result["fields"] = list(records[0].keys())
            if verbose:
                result["sample"] = records[0]
        else:
            result["status"] = "EMPTY"
    except requests.exceptions.Timeout:
        result["status"] = "FAIL"
        result["resp_msg"] = "timeout"
    except requests.exceptions.RequestException as e:
        result["status"] = "FAIL"
        result["resp_msg"] = str(e)[:100]
    return result


def probe_with_fallback(session, target, bas_dd, verbose=False, timeout=30):
    """Primary + alt_endpoints 순차 시도."""
    all_params = dict(target["params"])
    all_params["basDd"] = bas_dd

    primary = probe_endpoint(session, target["endpoint"], all_params, verbose, timeout=timeout)
    primary["endpoint_tried"] = target["endpoint"]
    if primary["status"] in ("OK", "EMPTY"):
        primary["resolved_endpoint"] = target["endpoint"]
        return primary

    for alt in target.get("alt_endpoints", []):
        if verbose:
            print(f"    [fallback] {alt}")
        time.sleep(RATE_LIMIT_SEC)
        alt_result = probe_endpoint(session, alt, dict(all_params), verbose, timeout=timeout)
        alt_result["endpoint_tried"] = alt
        if alt_result["status"] in ("OK", "EMPTY"):
            alt_result["resolved_endpoint"] = alt
            alt_result["note"] = f"primary {target['endpoint']} failed, resolved via {alt}"
            return alt_result

    primary["resolved_endpoint"] = None
    return primary


def print_report(results, verbose=False, quick_mode=False):
    """결과 요약 리포트."""
    print()
    print("=" * 80)
    title = "Pipeline Health Check" if quick_mode else "Endpoint Verification Report"
    print(f"  KRX Open API Phase 0 — {title}")
    print("=" * 80)

    by_cat = {}
    for r in results:
        cat = r["target"]["category"]
        by_cat.setdefault(cat, []).append(r)

    total = len(results)
    ok_count = sum(1 for r in results if r["probe"]["status"] == "OK")
    empty_count = sum(1 for r in results if r["probe"]["status"] == "EMPTY")
    err_count = total - ok_count - empty_count

    for cat in CATEGORY_ORDER:
        if cat not in by_cat:
            continue
        print(f"\n  [{cat}]")
        print(f"  {'#':>2}  {'서비스명':<32} {'상태':>7}  {'레코드':>6}  {'확정 경로'}")
        print(f"  {'─'*2}  {'─'*32} {'─'*7}  {'─'*6}  {'─'*40}")
        for r in by_cat[cat]:
            t, p = r["target"], r["probe"]
            icon = STATUS_ICONS.get(p["status"], "[?]")
            rec = str(p["record_count"]) if p["record_count"] else "-"
            resolved = p.get("resolved_endpoint") or "???"
            print(f"  {t['id']:>2}  {t['name_ko']:<32} {icon}  {rec:>6}  {resolved}")
            if p["status"] == "ERR":
                print(f"      respCode={p['resp_code']} msg={p.get('resp_msg', '')}")
            if verbose and p["status"] == "OK" and p.get("fields"):
                fields_str = ", ".join(p["fields"][:8])
                if len(p["fields"]) > 8:
                    fields_str += f" ... (+{len(p['fields'])-8})"
                print(f"      fields: {fields_str}")
            if p.get("note"):
                print(f"      NOTE: {p['note']}")

    print()
    print(f"  Summary: {total} probed | OK={ok_count} | EMPTY={empty_count} | FAILED={err_count}")

    if not quick_mode:
        print()
        print("  GAP — 미신청 서비스:")
        print("  [MISSING] 투자자별 매매동향 → openapi.krx.co.kr 추가 신청 필요")
        print("  [MISSING] 공매도 현황       → openapi.krx.co.kr 추가 신청 필요")

    print("=" * 80)


def _save_health_json(results, bas_dd, output_path):
    """data/api_health.json 저장."""
    ok_count = sum(1 for r in results if r["probe"]["status"] in ("OK", "EMPTY"))
    fail_count = len(results) - ok_count
    health = {
        "checked_at": datetime.now().isoformat(),
        "bas_dd": bas_dd,
        "ok_count": ok_count,
        "fail_count": fail_count,
        "endpoints": [
            {
                "endpoint": r["probe"].get("resolved_endpoint") or r["target"]["endpoint"],
                "status": r["probe"]["status"],
                "records": r["probe"]["record_count"],
            }
            for r in results
        ],
    }
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(health, f, ensure_ascii=False, indent=2)
    print(f"\n[PROBE] Health JSON 저장: {output_path}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="KRX Open API — 엔드포인트 검증 + 파이프라인 헬스체크")
    parser.add_argument("--date", default=None, help="조회일 YYYYMMDD (기본: 최근 영업일)")
    parser.add_argument("--verbose", action="store_true", help="필드명 + 첫 레코드 상세")
    parser.add_argument("--output", default=None, help="JSON 결과 저장 경로")
    parser.add_argument("--category", default=None, choices=CATEGORY_ORDER, help="특정 카테고리만")
    parser.add_argument("--id", type=int, default=None, help="특정 서비스 번호만 (1-28)")
    parser.add_argument("--quick", action="store_true",
                        help="파이프라인 사용 13개 엔드포인트만 검증 (<30s)")
    parser.add_argument("--save-health", action="store_true",
                        help="data/api_health.json 에 결과 저장 (--quick 와 함께 사용 권장)")

    sys.stdout.reconfigure(encoding="utf-8")
    args = parser.parse_args()

    try:
        api_key = _load_env_key()
    except ValueError as e:
        print(e)
        sys.exit(1)

    bas_dd = args.date or _last_business_day()
    mode_label = "QUICK" if args.quick else "FULL"
    print(f"[PROBE] 모드: {mode_label} | 조회일: {bas_dd} | API Base: {API_BASE}")

    session = requests.Session()
    session.headers.update(HEADERS)
    session.headers["AUTH_KEY"] = api_key

    # ── 대상 필터링 ──
    targets = PROBE_TARGETS
    if args.quick:
        targets = [t for t in targets if t["endpoint"] in QUICK_ENDPOINTS]
    if args.category:
        targets = [t for t in targets if t["category"] == args.category]
    if args.id:
        targets = [t for t in targets if t["id"] == args.id]

    # quick 모드: 타임아웃 단축 (15s vs 30s)
    req_timeout = 15 if args.quick else 30

    print(f"[PROBE] 총 대상: {len(targets)} endpoints\n")

    t_start = time.time()
    all_results = []
    for i, target in enumerate(targets, 1):
        print(f"[{i:>2}/{len(targets)}] #{target['id']:>2} {target['name_ko']:<32} ...", end=" ", flush=True)
        result = probe_with_fallback(session, target, bas_dd, verbose=args.verbose, timeout=req_timeout)
        icon = STATUS_ICONS.get(result["status"], "[?]")
        rec = result["record_count"]
        if result["status"] == "OK":
            print(f"{icon} {rec} records | {result.get('resolved_endpoint', '?')}")
        elif result["status"] == "EMPTY":
            print(f"{icon} (no data for {bas_dd})")
        elif result["status"] == "ERR":
            print(f"{icon} respCode={result.get('resp_code')} {result.get('resp_msg', '')[:50]}")
        else:
            print(f"{icon} {(result.get('resp_msg') or '')[:50]}")
        all_results.append({"target": target, "probe": result})
        time.sleep(RATE_LIMIT_SEC)

    elapsed = time.time() - t_start
    print_report(all_results, verbose=args.verbose, quick_mode=args.quick)
    print(f"  Elapsed: {elapsed:.1f}s")

    # ── JSON 출력: --output (상세) ──
    if args.output:
        out_dir = os.path.dirname(args.output)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        output_data = {
            "run_at": datetime.now().isoformat(),
            "bas_dd": bas_dd,
            "api_base": API_BASE,
            "mode": mode_label,
            "results": [
                {"id": r["target"]["id"], "name_ko": r["target"]["name_ko"],
                 "category": r["target"]["category"], "status": r["probe"]["status"],
                 "record_count": r["probe"]["record_count"], "fields": r["probe"]["fields"],
                 "resolved_endpoint": r["probe"].get("resolved_endpoint")}
                for r in all_results
            ],
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print(f"\n[PROBE] JSON 저장: {args.output}")

    # ── --save-health → data/api_health.json ──
    if args.save_health:
        health_path = os.path.join(_HERE, "..", "data", "api_health.json")
        health_path = os.path.normpath(health_path)
        _save_health_json(all_results, bas_dd, health_path)

    # ── 종료코드: quick=strict (ALL must pass), default=any OK ──
    if args.quick:
        all_pass = all(r["probe"]["status"] in ("OK", "EMPTY") for r in all_results)
        sys.exit(0 if all_pass else 1)
    else:
        any_ok = any(r["probe"]["status"] == "OK" for r in all_results)
        sys.exit(0 if any_ok else 1)


if __name__ == "__main__":
    main()
