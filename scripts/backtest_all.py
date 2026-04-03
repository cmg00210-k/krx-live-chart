#!/usr/bin/env python3
"""
KRX LIVE — Backtest Orchestrator + Aggregator

Node backtest_runner.js --batch 실행 후 결과를 집계하여
Stage 5 분석용 JSON 파일 6종을 생성한다.

Usage:
    python scripts/backtest_all.py               # Full run
    python scripts/backtest_all.py --incremental  # Only re-run changed stocks (mtime-based)
    python scripts/backtest_all.py --skip-run     # Aggregate existing raw_results.ndjson
    python scripts/backtest_all.py --code 005930  # Single stock test

Output files (data/backtest/):
    1. results/{market}_{code}.json   — 종목별 원시 데이터
    2. aggregate_stats.json           — 전체 통계
    3. pattern_performance.json       — 30패턴별 WLS beta + t-stat
    4. theory_vs_actual.json          — 이론 목표가 vs 실제 달성률
"""

import hashlib
import json
import os
import shutil
import subprocess
import sys
sys.stdout.reconfigure(encoding='utf-8')
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BACKTEST_DIR = DATA_DIR / "backtest"
RESULTS_DIR = BACKTEST_DIR / "results"
RAW_NDJSON = BACKTEST_DIR / "raw_results.ndjson"

MANIFEST_PATH = BACKTEST_DIR / ".backtest_manifest.json"
INCREMENTAL_CODES_PATH = BACKTEST_DIR / ".incremental_codes.json"
JS_ENGINE_FILES = ["colors.js", "indicators.js", "patterns.js", "backtester.js"]

HORIZONS = [1, 3, 5, 10, 20]


def compute_engine_hash():
    """JS 엔진 파일 4개의 MD5 해시 — 엔진 변경 시 전체 재실행 트리거"""
    h = hashlib.md5()
    for fname in JS_ENGINE_FILES:
        fpath = ROOT / "js" / fname
        if fpath.exists():
            h.update(fpath.read_bytes())
    return h.hexdigest()


def load_manifest():
    """이전 .backtest_manifest.json 로드 (없으면 빈 dict)"""
    if MANIFEST_PATH.exists():
        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_manifest(entries, engine_hash):
    """매니페스트 저장 — entries: {code: {market, file, mtime, size}}, engine_hash: str"""
    manifest = {
        "engine_hash": engine_hash,
        "updated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "entries": entries,
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)


def detect_changed_stocks(index_stocks, manifest, engine_hash):
    """파일 mtime 기반 변경 종목 감지. 엔진 해시 변경 시 전체 재실행.

    Returns:
        (changed_codes: list[str], current_entries: dict)
    """
    prev_engine = manifest.get("engine_hash", "")
    prev_entries = manifest.get("entries", {})
    engine_changed = (engine_hash != prev_engine)

    if engine_changed:
        print("  [INC] JS 엔진 파일 변경 감지 — 전체 재실행")

    current_entries = {}
    changed_codes = []

    for stock in index_stocks:
        code = stock.get("code", "")
        market = stock.get("market", "").lower()
        rel_file = stock.get("file", "")
        if not code or not rel_file:
            continue

        fpath = DATA_DIR / rel_file
        if not fpath.exists():
            continue

        stat = fpath.stat()
        entry = {
            "market": market,
            "file": rel_file,
            "mtime": stat.st_mtime,
            "size": stat.st_size,
        }
        current_entries[code] = entry

        if engine_changed:
            changed_codes.append(code)
        else:
            prev = prev_entries.get(code)
            if prev is None:
                changed_codes.append(code)
            elif prev.get("mtime") != stat.st_mtime or prev.get("size") != stat.st_size:
                changed_codes.append(code)

    return changed_codes, current_entries


def load_previous_results_by_code():
    """기존 raw_results.ndjson을 code 기준 dict로 로드"""
    result_map = {}
    if not RAW_NDJSON.exists():
        return result_map
    with open(RAW_NDJSON, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                code = obj.get("code", "")
                if code:
                    result_map[code] = line  # raw JSON line 보존
            except json.JSONDecodeError:
                pass
    return result_map


def merge_results(prev_map, new_ndjson_path, changed_codes, current_codes):
    """이전 결과 + 증분 결과 병합 → merged raw_results.ndjson 작성

    Args:
        prev_map: {code: raw_json_line} 이전 전체 결과
        new_ndjson_path: 증분 실행 결과 파일 경로
        changed_codes: 이번에 재실행한 코드 목록
        current_codes: 현재 유효한 전체 코드 set
    Returns:
        merged line count
    """
    changed_set = set(changed_codes)

    # 증분 결과 로드
    new_map = {}
    if new_ndjson_path.exists():
        with open(new_ndjson_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    code = obj.get("code", "")
                    if code:
                        new_map[code] = line
                except json.JSONDecodeError:
                    pass

    # 병합: 변경된 종목은 new_map에서, 나머지는 prev_map에서
    merged_count = 0
    with open(RAW_NDJSON, "w", encoding="utf-8") as f:
        for code in sorted(current_codes):
            if code in changed_set and code in new_map:
                f.write(new_map[code] + "\n")
                merged_count += 1
            elif code in prev_map:
                f.write(prev_map[code] + "\n")
                merged_count += 1
            # current_codes에 없는 종목은 자연스럽게 제거됨

    return merged_count


def run_node_incremental(changed_codes):
    """증분 모드 — 변경된 종목만 backtest_runner.js 실행"""
    runner = ROOT / "scripts" / "backtest_runner.js"
    if not runner.exists():
        print(f"[ERROR] {runner} not found")
        sys.exit(1)

    BACKTEST_DIR.mkdir(parents=True, exist_ok=True)

    # 변경 종목 목록 파일 작성
    with open(INCREMENTAL_CODES_PATH, "w", encoding="utf-8") as f:
        json.dump(changed_codes, f)

    partial_ndjson = BACKTEST_DIR / "raw_results_partial.ndjson"
    print(f"  Running Node backtest_runner.js --batch --incremental ({len(changed_codes)} stocks)...")
    start = time.time()

    try:
        with open(partial_ndjson, "w", encoding="utf-8") as out_f, \
             open(BACKTEST_DIR / "batch_log.txt", "w", encoding="utf-8") as log_f:
            proc = subprocess.run(
                ["node", str(runner), "--batch", "--incremental"],
                stdout=out_f,
                stderr=log_f,
                timeout=600,
            )

        elapsed = time.time() - start
        if proc.returncode != 0:
            print(f"[ERROR] Node process exited with code {proc.returncode}")
            sys.exit(1)

        line_count = sum(1 for _ in open(partial_ndjson, encoding="utf-8"))
        print(f"  -> {line_count} stocks processed in {elapsed:.1f}s")
        return partial_ndjson

    finally:
        # 임시 파일 정리
        if INCREMENTAL_CODES_PATH.exists():
            INCREMENTAL_CODES_PATH.unlink()


def run_node_batch(delisted=False):
    """Node backtest_runner.js --batch 실행 (delisted=True: 상폐 종목 모드)"""
    runner = ROOT / "scripts" / "backtest_runner.js"
    if not runner.exists():
        print(f"[ERROR] {runner} not found")
        sys.exit(1)

    BACKTEST_DIR.mkdir(parents=True, exist_ok=True)

    output_path = BACKTEST_DIR / ("delisted_raw_results.ndjson" if delisted else "raw_results.ndjson")
    cmd = ["node", str(runner), "--batch"]
    if delisted:
        cmd.append("--delisted")

    tag = " (delisted)" if delisted else ""
    print(f"[1/4] Running Node backtest_runner.js --batch{tag} ...")
    start = time.time()

    # Delisted stocks have ~4x more candles per stock (avg 980 vs 244)
    # → longer per-stock processing time → higher timeout needed
    # v56: 6 indicator columns add ~20% overhead → 1200s for 2651 stocks at ~2.5/s
    batch_timeout = 1800 if delisted else 1200

    with open(output_path, "w", encoding="utf-8") as out_f, \
         open(BACKTEST_DIR / "batch_log.txt", "w", encoding="utf-8") as log_f:
        proc = subprocess.run(
            cmd,
            stdout=out_f,
            stderr=log_f,
            timeout=batch_timeout,
        )

    elapsed = time.time() - start
    if proc.returncode != 0:
        print(f"[ERROR] Node process exited with code {proc.returncode}")
        sys.exit(1)

    line_count = sum(1 for _ in open(output_path, encoding="utf-8"))
    print(f"  -> {line_count} stocks processed in {elapsed:.1f}s")
    return line_count


def load_raw_results():
    """NDJSON 파일에서 결과 로드"""
    results = []
    errors = 0
    with open(RAW_NDJSON, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                results.append(obj)
            except json.JSONDecodeError:
                errors += 1
                if errors <= 5:
                    print(f"  [WARN] JSON parse error at line {line_no}")
    if errors:
        print(f"  [WARN] {errors} total parse errors")
    return results


def save_individual_results(results):
    """종목별 원시 데이터 파일 저장"""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    for r in results:
        code = r.get("code", "")
        market = r.get("market", "").lower()
        if not code or not market:
            continue
        fname = RESULTS_DIR / f"{market}_{code}.json"
        with open(fname, "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False)


def aggregate_stats(results):
    """전체 통계 집계"""
    total = len(results)
    skipped = sum(1 for r in results if r.get("skipped"))
    errored = sum(1 for r in results if r.get("error"))
    analyzed = total - skipped - errored

    total_patterns = sum(r.get("patternCount", 0) for r in results)
    total_candles = sum(r.get("candleCount", 0) for r in results)

    # 패턴 타입별 발견 빈도
    type_freq = defaultdict(int)
    for r in results:
        for p in r.get("patterns", []):
            type_freq[p["type"]] += 1

    # 백테스트 가능한 종목 수
    bt_count = sum(1 for r in results if r.get("backtest") and len(r["backtest"]) > 0)

    stats = {
        "total_stocks": total,
        "analyzed": analyzed,
        "skipped": skipped,
        "errored": errored,
        "total_candles": total_candles,
        "total_patterns_detected": total_patterns,
        "avg_patterns_per_stock": round(total_patterns / max(analyzed, 1), 1),
        "stocks_with_backtest": bt_count,
        "pattern_frequency": dict(sorted(type_freq.items(), key=lambda x: -x[1])),
    }
    return stats


def aggregate_pattern_performance(results):
    """30패턴별 성과 집계 — 각 horizon별 평균 수익률, 승률, WLS beta"""
    # pattern -> horizon -> list of stats
    pool = defaultdict(lambda: defaultdict(list))

    for r in results:
        bt = r.get("backtest", {})
        for ptype, pdata in bt.items():
            horizons = pdata.get("horizons", {})
            for h_str, hstats in horizons.items():
                if hstats and hstats.get("n", 0) >= 2:
                    pool[ptype][h_str].append(hstats)

    perf = {}
    for ptype in sorted(pool.keys()):
        perf[ptype] = {}
        for h_str in sorted(pool[ptype].keys(), key=lambda x: int(x)):
            stats_list = pool[ptype][h_str]
            if not stats_list:
                continue

            # Weighted average by sample size
            total_n = sum(s["n"] for s in stats_list)
            if total_n == 0:
                continue

            w_mean = sum(s["mean"] * s["n"] for s in stats_list) / total_n
            w_winrate = sum(s["winRate"] * s["n"] for s in stats_list) / total_n
            num_significant = sum(1 for s in stats_list if s.get("significant"))
            num_adj_significant = sum(1 for s in stats_list if s.get("adjustedSignificant"))

            # Collect WLS regression coefficients
            reg_coeffs = []
            reg_r2 = []
            for s in stats_list:
                reg = s.get("regression")
                if reg and reg.get("coeffs"):
                    reg_coeffs.append(reg["coeffs"])
                    reg_r2.append(reg["rSquared"])

            horizon_perf = {
                "stock_count": len(stats_list),
                "total_occurrences": total_n,
                "weighted_mean_return": round(w_mean, 3),
                "weighted_win_rate": round(w_winrate, 1),
                "significant_count": num_significant,
                "adjusted_significant_count": num_adj_significant,
            }

            if reg_coeffs:
                # Average WLS coefficients
                n_coeffs = len(reg_coeffs[0])
                avg_coeffs = [0.0] * n_coeffs
                for c in reg_coeffs:
                    for i in range(min(len(c), n_coeffs)):
                        avg_coeffs[i] += c[i]
                avg_coeffs = [round(c / len(reg_coeffs), 6) for c in avg_coeffs]
                avg_r2 = round(sum(reg_r2) / len(reg_r2), 4)

                horizon_perf["avg_wls_coeffs"] = avg_coeffs
                horizon_perf["avg_r_squared"] = avg_r2
                horizon_perf["regression_count"] = len(reg_coeffs)

            perf[ptype][h_str] = horizon_perf

    return perf


def aggregate_theory_vs_actual(results):
    """이론 목표가 vs 실제 달성률 분석"""
    records = []

    for r in results:
        code = r.get("code")
        candle_count = r.get("candleCount", 0)
        patterns = r.get("patterns", [])

        for p in patterns:
            target = p.get("priceTarget")
            stop = p.get("stopLoss")
            end_idx = p.get("endIndex")

            if target is None or end_idx is None:
                continue

            hw = p.get("hw") or 1
            vw = p.get("vw") or 1
            mw = p.get("mw") or 1
            rw = p.get("rw") or 1
            records.append({
                "code": code,
                "type": p["type"],
                "signal": p.get("signal"),
                "confidence": p.get("confidence"),
                "endIndex": end_idx,
                "priceTarget": target,
                "stopLoss": stop,
                "riskReward": p.get("riskReward"),
                "hw": p.get("hw"),
                "vw": p.get("vw"),
                "mw": p.get("mw"),
                "rw": p.get("rw"),
                "wc": round(hw * mw, 4),
                "candleCount": candle_count,
            })

    # Summary by pattern type
    by_type = defaultdict(list)
    for rec in records:
        by_type[rec["type"]].append(rec)

    summary = {}
    for ptype, recs in sorted(by_type.items()):
        hw_vals = [r["hw"] for r in recs if r.get("hw") is not None]
        vw_vals = [r["vw"] for r in recs if r.get("vw") is not None]
        mw_vals = [r["mw"] for r in recs if r.get("mw") is not None]
        rw_vals = [r["rw"] for r in recs if r.get("rw") is not None]
        conf_vals = [r["confidence"] for r in recs if r.get("confidence") is not None]
        rr_vals = [r["riskReward"] for r in recs if r.get("riskReward") is not None]

        def _stats(vals):
            if not vals:
                return None
            n = len(vals)
            mean = sum(vals) / n
            variance = sum((v - mean) ** 2 for v in vals) / max(n - 1, 1)
            return {
                "n": n,
                "mean": round(mean, 4),
                "std": round(variance ** 0.5, 4),
                "min": round(min(vals), 4),
                "max": round(max(vals), 4),
            }

        wc_vals = [r["wc"] for r in recs if r.get("wc") is not None]

        summary[ptype] = {
            "count": len(recs),
            "confidence": _stats(conf_vals),
            "riskReward": _stats(rr_vals),
            "hw": _stats(hw_vals),
            "vw": _stats(vw_vals),
            "mw": _stats(mw_vals),
            "rw": _stats(rw_vals),
            "wc": _stats(wc_vals),
        }

    return {
        "total_targets": len(records),
        "by_pattern_type": summary,
    }


def generate_wc_return_pairs(results):
    """Per-occurrence (Wc, actual returns) CSV — Phase C의 핵심 입력 파일"""
    import csv

    csv_path = BACKTEST_DIR / "wc_return_pairs.csv"
    fieldnames = [
        "code", "market", "type", "signal", "date",
        "wc", "hw", "vw", "mw", "rw", "confidence",
        "signal_direction", "market_type", "log_confidence",
        "pattern_tier", "hw_x_signal", "vw_x_signal",
        "trendStrength", "volumeRatio", "atrNorm",
        "rsi_14", "macd_hist", "bb_position",
        "ret_1", "ret_3", "ret_5", "ret_10", "ret_20",
    ]

    total = 0
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for r in results:
            code = r.get("code", "")
            market = r.get("market", "").lower()
            occ_list = r.get("occurrenceReturns", [])

            for occ in occ_list:
                rets = occ.get("returns", {})
                row = {
                    "code": code,
                    "market": market,
                    "type": occ.get("type", ""),
                    "signal": occ.get("signal", ""),
                    "date": occ.get("date", ""),
                    "wc": occ.get("wc"),
                    "hw": occ.get("hw"),
                    "vw": occ.get("vw"),
                    "mw": occ.get("mw"),
                    "rw": occ.get("rw"),
                    "confidence": occ.get("confidence"),
                    "signal_direction": occ.get("signal_direction"),
                    "market_type": occ.get("market_type"),
                    "log_confidence": occ.get("log_confidence"),
                    "pattern_tier": occ.get("pattern_tier"),
                    "hw_x_signal": occ.get("hw_x_signal"),
                    "vw_x_signal": occ.get("vw_x_signal"),
                    "trendStrength": occ.get("trendStrength"),
                    "volumeRatio": occ.get("volumeRatio"),
                    "atrNorm": occ.get("atrNorm"),
                    "rsi_14": occ.get("rsi_14"),
                    "macd_hist": occ.get("macd_hist"),
                    "bb_position": occ.get("bb_position"),
                    "ret_1": rets.get("1"),
                    "ret_3": rets.get("3"),
                    "ret_5": rets.get("5"),
                    "ret_10": rets.get("10"),
                    "ret_20": rets.get("20"),
                }
                writer.writerow(row)
                total += 1

    return total


def _run_delisted_pipeline():
    """D-1 Survivorship Bias: 상폐 종목 전용 백테스트 파이프라인.

    backtest_runner.js --batch --delisted 실행 후
    delisted_pattern_performance.json 생성.
    """
    delisted_ndjson = BACKTEST_DIR / "delisted_raw_results.ndjson"

    # Step 1: Run Node batch in delisted mode
    run_node_batch(delisted=True)

    # Step 2: Load results
    print("[2/4] Loading delisted raw results...")
    results = []
    errors = 0
    with open(delisted_ndjson, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                results.append(obj)
            except json.JSONDecodeError:
                errors += 1
    print(f"  -> {len(results)} results loaded ({errors} parse errors)")

    # Step 3: Aggregate pattern performance (same logic as listed stocks)
    print("[3/4] Aggregating delisted pattern performance...")
    pattern_perf = aggregate_pattern_performance(results)
    perf_path = BACKTEST_DIR / "delisted_pattern_performance.json"
    with open(perf_path, "w", encoding="utf-8") as f:
        json.dump(pattern_perf, f, ensure_ascii=False, indent=2)
    print(f"  -> delisted_pattern_performance.json ({len(pattern_perf)} pattern types)")

    # Step 3b: Aggregate stats
    agg_stats = aggregate_stats(results)
    stats_path = BACKTEST_DIR / "delisted_aggregate_stats.json"
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(agg_stats, f, ensure_ascii=False, indent=2)
    print(f"  -> delisted_aggregate_stats.json ({agg_stats['analyzed']} analyzed)")

    # Step 4: Summary
    total = len(results)
    skipped = sum(1 for r in results if r.get("skipped"))
    errored = sum(1 for r in results if r.get("error"))
    analyzed = total - skipped - errored
    bt_count = sum(1 for r in results if r.get("backtest") and len(r["backtest"]) > 0)

    print("[4/4] Delisted Backtest Summary:")
    print(f"  Total stocks:     {total}")
    print(f"  Analyzed:         {analyzed}")
    print(f"  Skipped:          {skipped}")
    print(f"  Errors:           {errored}")
    print(f"  Backtest-ready:   {bt_count}")
    print(f"  Pattern types:    {len(pattern_perf)}")


def main():
    args = sys.argv[1:]
    skip_run = "--skip-run" in args
    incremental = "--incremental" in args
    delisted_mode = "--delisted" in args

    BACKTEST_DIR.mkdir(parents=True, exist_ok=True)

    # ── D-1: Delisted mode — separate pipeline ──
    if delisted_mode:
        _run_delisted_pipeline()
        return

    # Step 1: Run Node batch (or skip)
    if skip_run:
        if not RAW_NDJSON.exists():
            print(f"[ERROR] {RAW_NDJSON} not found. Run without --skip-run first.")
            sys.exit(1)
        print("[1/4] Skipping Node run (using existing raw_results.ndjson)")

    elif incremental:
        print("[1/4] Incremental backtest mode")

        # index.json 로드
        index_path = DATA_DIR / "index.json"
        if not index_path.exists():
            print(f"[ERROR] {index_path} not found")
            sys.exit(1)
        with open(index_path, "r", encoding="utf-8") as f:
            index_data = json.load(f)
        index_stocks = index_data.get("stocks", [])

        # 매니페스트 + 엔진 해시
        manifest = load_manifest()
        engine_hash = compute_engine_hash()
        changed_codes, current_entries = detect_changed_stocks(
            index_stocks, manifest, engine_hash
        )
        current_codes = set(current_entries.keys())
        total_stocks = len(current_codes)
        changed_count = len(changed_codes)

        print(f"  Total: {total_stocks}, Changed: {changed_count}")

        if changed_count == 0:
            print("  [INC] 변경 없음 — 기존 결과 재사용")
        elif changed_count >= total_stocks * 0.9:
            # 90% 이상 변경 → 풀 모드로 폴백 (병합 오버헤드 불필요)
            print(f"  [INC] {changed_count}/{total_stocks} 변경 (>= 90%) — 풀 모드 폴백")
            run_node_batch()
            save_manifest(current_entries, engine_hash)
        else:
            # 증분 실행
            if not RAW_NDJSON.exists():
                print("  [INC] 기존 raw_results.ndjson 없음 — 풀 모드 폴백")
                run_node_batch()
                save_manifest(current_entries, engine_hash)
            else:
                # 기존 결과 백업
                backup_path = BACKTEST_DIR / "raw_results.ndjson.bak"
                shutil.copy2(RAW_NDJSON, backup_path)

                # 이전 결과 로드
                prev_map = load_previous_results_by_code()

                # 증분 실행
                partial_path = run_node_incremental(changed_codes)

                # 병합
                print("  [INC] 결과 병합 중...")
                merged_count = merge_results(
                    prev_map, partial_path, changed_codes, current_codes
                )
                print(f"  -> {merged_count} stocks in merged raw_results.ndjson")

                # partial 파일 정리
                if partial_path.exists():
                    partial_path.unlink()
                if backup_path.exists():
                    backup_path.unlink()

                save_manifest(current_entries, engine_hash)

    else:
        run_node_batch()

    # Step 2: Load + save individual results
    print("[2/4] Loading raw results...")
    results = load_raw_results()
    print(f"  -> {len(results)} results loaded")

    print("  Saving individual result files...")
    save_individual_results(results)
    print(f"  -> {len(results)} files saved to data/backtest/results/")

    # Step 3: Aggregate
    print("[3/4] Aggregating statistics...")

    agg_stats = aggregate_stats(results)
    with open(BACKTEST_DIR / "aggregate_stats.json", "w", encoding="utf-8") as f:
        json.dump(agg_stats, f, ensure_ascii=False, indent=2)
    print(f"  -> aggregate_stats.json ({agg_stats['analyzed']} analyzed, "
          f"{agg_stats['total_patterns_detected']} patterns)")

    pattern_perf = aggregate_pattern_performance(results)
    with open(BACKTEST_DIR / "pattern_performance.json", "w", encoding="utf-8") as f:
        json.dump(pattern_perf, f, ensure_ascii=False, indent=2)
    print(f"  -> pattern_performance.json ({len(pattern_perf)} pattern types)")

    theory_actual = aggregate_theory_vs_actual(results)
    with open(BACKTEST_DIR / "theory_vs_actual.json", "w", encoding="utf-8") as f:
        json.dump(theory_actual, f, ensure_ascii=False, indent=2)
    print(f"  -> theory_vs_actual.json ({theory_actual['total_targets']} targets)")

    wc_pairs_count = generate_wc_return_pairs(results)
    print(f"  -> wc_return_pairs.csv ({wc_pairs_count} occurrence-return pairs)")

    # Step 4: Summary
    print("[4/4] Summary:")
    print(f"  Total stocks:     {agg_stats['total_stocks']}")
    print(f"  Analyzed:         {agg_stats['analyzed']}")
    print(f"  Skipped:          {agg_stats['skipped']}")
    print(f"  Errors:           {agg_stats['errored']}")
    print(f"  Total patterns:   {agg_stats['total_patterns_detected']}")
    print(f"  Avg per stock:    {agg_stats['avg_patterns_per_stock']}")
    print(f"  Backtest-ready:   {agg_stats['stocks_with_backtest']}")

    # Top 5 patterns
    freq = agg_stats.get("pattern_frequency", {})
    top5 = list(freq.items())[:5]
    if top5:
        print(f"\n  Top 5 patterns:")
        for ptype, count in top5:
            print(f"    {ptype:30s} {count:6d}")

    print(f"\n  Output: {BACKTEST_DIR}")
    print("  Done.")


if __name__ == "__main__":
    main()
