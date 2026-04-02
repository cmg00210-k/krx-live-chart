#!/usr/bin/env python3
"""
KRX ETF 시장 데이터 다운로더 (Open API v2)

데이터 소스: data-dbg.krx.co.kr (KRX Open API)
인증 방식: AUTH_KEY 헤더 (krx_api.py KRXClient)

출력:
  data/derivatives/etf_daily.json   — ETF 가격/NAV/괴리율/순자산/거래량
  data/derivatives/etf_summary.json — 거래 요약 + 레버리지/인버스 심리 비율

학술 근거: core_data/28_cross_market_correlation.md §4
  ETF 자금 흐름은 시장 심리의 선행 지표.
  레버리지 ETF/인버스 ETF 거래 비율은 개인투자자 낙관·비관 프록시.

Migration note (2026-04-02):
  OTP 2-call (MDCSTAT04301 + MDCSTAT04501) → KRX Open API single call
  etp/etf_bydd_trd 엔드포인트 하나로 가격+NAV 통합 조회.
  괴리율(trackingError)은 (close - NAV) / NAV * 100 으로 직접 계산.
  설정/환매(creation/redemption)는 Open API 미제공 → 제거.

사용법:
    python scripts/download_etf.py
    python scripts/download_etf.py --start 2024-01-01
    python scripts/download_etf.py --verbose
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DERIV_DIR = os.path.join(DATA_DIR, "derivatives")

# ── krx_api.py import ──
sys.path.insert(0, os.path.join(PROJECT_ROOT, "scripts"))
from krx_api import KRXClient

# ── 레버리지/인버스 ETF 분류용 패턴 ──
# 종목명에서 레버리지(2x) vs 인버스(-1x, -2x) 판별
LEVERAGE_PATTERN = re.compile(
    r"레버리지|2X|2배|LEVERAGE",
    re.IGNORECASE,
)
INVERSE_PATTERN = re.compile(
    r"인버스|곰|INVERSE|BEAR|숏|SHORT",
    re.IGNORECASE,
)


def parse_number(val_str, as_int=False):
    """
    KRX Open API 숫자 파싱. 모든 값이 문자열로 반환됨.
    쉼표, 공백, '-' 처리.

    Parameters:
        val_str: 원시 문자열
        as_int: True면 int, False면 float 반환

    Returns:
        파싱된 숫자 또는 None
    """
    if val_str is None:
        return None
    s = str(val_str).strip().replace(",", "")
    if not s or s == "-":
        return None
    try:
        return int(s) if as_int else float(s)
    except ValueError:
        return None


def parse_etf_records(raw_records: list, verbose: bool = False) -> list:
    """
    KRX Open API etp/etf_bydd_trd 응답을 etf_daily.json 스키마로 변환.

    Open API 필드 매핑 (Phase 0-R 확인 완료, 19 fields):
        ISU_CD       → (short code 추출)
        ISU_NM       → name
        TDD_CLSPRC   → close
        CMPPREVDD_PRC → change
        FLUC_RT      → changePct
        NAV          → nav
        TDD_OPNPRC   → open
        TDD_HGPRC    → high
        TDD_LWPRC    → low
        ACC_TRDVOL   → volume
        ACC_TRDVAL   → tradeValue
        MKTCAP       → marketCap (시가총액)
        LIST_SHRS    → shares (상장주수)
        OBJ_STKPRC_IDX → baseIndex (기초지수명)
        OBJ_STKPRC_IDX_CLSPRC → baseClose (기초지수 종가) — may not exist
        OBJ_STKPRC_IDX_CMPPREVDD_PRC → baseChange — may not exist
        OBJ_STKPRC_IDX_FLUC_RT → baseChangePct — may not exist

    trackingError = (close - NAV) / NAV * 100  (Open API 미제공, 직접 계산)

    Parameters:
        raw_records: client.get() 반환 OutBlock_1 리스트
        verbose: 디버그 출력 여부

    Returns:
        list of dicts — ETF 가격/NAV 데이터 (etf_daily.json etfs[] 스키마)
    """
    records = []

    if verbose and raw_records:
        print(f"  [Open API] 응답 필드: {list(raw_records[0].keys())}")

    for row in raw_records:
        try:
            # 종목코드 — ISU_CD 에서 short code 추출
            # ISU_CD 형식: "KR7069500007" (ISIN) 또는 "069500" (short)
            isu_cd = row.get("ISU_CD", "").strip()
            if not isu_cd:
                continue

            # ISIN → short code (KR7 + 6자리 + check digit)
            if len(isu_cd) == 12 and isu_cd.startswith("KR"):
                code = isu_cd[3:9]
            else:
                code = isu_cd

            name = row.get("ISU_NM", "").strip()
            close = parse_number(row.get("TDD_CLSPRC"))
            change = parse_number(row.get("CMPPREVDD_PRC"))
            change_pct = parse_number(row.get("FLUC_RT"))
            nav = parse_number(row.get("NAV"))
            opn = parse_number(row.get("TDD_OPNPRC"))
            high = parse_number(row.get("TDD_HGPRC"))
            low = parse_number(row.get("TDD_LWPRC"))
            volume = parse_number(row.get("ACC_TRDVOL"), as_int=True)
            trade_value = parse_number(row.get("ACC_TRDVAL"), as_int=True)
            shares = parse_number(row.get("LIST_SHRS"), as_int=True)
            market_cap = parse_number(row.get("MKTCAP"), as_int=True)

            # 기초지수 관련 (존재 여부 불확실 — 안전하게 처리)
            base_index = row.get("OBJ_STKPRC_IDX", "").strip() if row.get("OBJ_STKPRC_IDX") else ""
            base_close = parse_number(row.get("OBJ_STKPRC_IDX_CLSPRC"))
            base_change_pct = parse_number(row.get("OBJ_STKPRC_IDX_FLUC_RT"))

            if close is None:
                continue

            # trackingError 직접 계산: (close - NAV) / NAV * 100
            tracking_error = None
            if nav is not None and nav != 0 and close is not None:
                tracking_error = round((close - nav) / nav * 100, 4)

            # AUM 계산: 시가총액을 억원 단위로 (Open API MKTCAP은 원 단위)
            # 또는 LIST_SHRS * NAV / 1e8 로 순자산 추정
            aum = None
            if market_cap is not None and market_cap > 0:
                aum = round(market_cap / 1e8, 1)
            elif shares is not None and nav is not None:
                aum = round(shares * nav / 1e8, 1)

            record = {
                "code": code,
                "name": name,
                "close": close,
            }

            # 선택 필드 — 존재할 때만 추가 (기존 스키마 호환)
            if change is not None:
                record["change"] = change
            if change_pct is not None:
                record["changePct"] = change_pct
            if nav is not None:
                record["nav"] = nav
            if tracking_error is not None:
                record["trackingError"] = tracking_error
            if volume is not None:
                record["volume"] = volume
            if trade_value is not None:
                record["tradeValue"] = trade_value
            if shares is not None:
                record["shares"] = shares
            if aum is not None:
                record["aum"] = aum
            if base_index:
                record["baseIndex"] = base_index
            if base_close is not None:
                record["baseClose"] = base_close
            if base_change_pct is not None:
                record["baseChangePct"] = base_change_pct

            records.append(record)

        except (ValueError, KeyError):
            continue

    if verbose:
        print(f"  [Open API] 파싱 완료: {len(records)}개 ETF")

    return records


def classify_etf_type(name: str) -> str:
    """
    ETF 종목명으로 레버리지/인버스/일반 분류.

    인버스 레버리지 (예: KODEX 200선물인버스2X) → 'inverse'로 분류.
    순서: 인버스 우선 판별 (인버스2X는 인버스).

    Parameters:
        name: ETF 종목명

    Returns:
        'leverage' | 'inverse' | 'normal'
    """
    if INVERSE_PATTERN.search(name):
        return "inverse"
    if LEVERAGE_PATTERN.search(name):
        return "leverage"
    return "normal"


def build_leverage_sentiment(records: list) -> dict:
    """
    레버리지/인버스 ETF 거래량 비율로 시장 심리 계산.

    leverage_ratio = sum(레버리지 거래량) / sum(인버스 거래량)
      > 1.0: 낙관 (bullish), < 1.0: 비관 (bearish)

    Parameters:
        records: ETF 가격 데이터 리스트

    Returns:
        dict — 레버리지/인버스 심리 지표
    """
    leverage_volume = 0
    inverse_volume = 0
    leverage_etfs = []
    inverse_etfs = []

    for r in records:
        name = r.get("name", "")
        vol = r.get("volume", 0) or 0
        etf_type = classify_etf_type(name)

        if etf_type == "leverage":
            leverage_volume += vol
            leverage_etfs.append({
                "code": r["code"],
                "name": name,
                "volume": vol,
            })
        elif etf_type == "inverse":
            inverse_volume += vol
            inverse_etfs.append({
                "code": r["code"],
                "name": name,
                "volume": vol,
            })

    # 비율 계산 (0 나누기 방지)
    if inverse_volume > 0:
        leverage_ratio = round(leverage_volume / inverse_volume, 4)
    else:
        leverage_ratio = None  # 인버스 거래량 0이면 비율 의미 없음

    # 심리 레이블
    if leverage_ratio is None:
        sentiment = "unknown"
    elif leverage_ratio > 2.0:
        sentiment = "strong_bullish"
    elif leverage_ratio > 1.0:
        sentiment = "bullish"
    elif leverage_ratio > 0.5:
        sentiment = "bearish"
    else:
        sentiment = "strong_bearish"

    return {
        "leverageVolume": leverage_volume,
        "inverseVolume": inverse_volume,
        "leverageRatio": leverage_ratio,
        "sentiment": sentiment,
        "leverageCount": len(leverage_etfs),
        "inverseCount": len(inverse_etfs),
        "topLeverage": sorted(
            leverage_etfs, key=lambda x: x["volume"], reverse=True
        )[:5],
        "topInverse": sorted(
            inverse_etfs, key=lambda x: x["volume"], reverse=True
        )[:5],
    }


def build_summary(records: list, trd_date: str) -> dict:
    """
    ETF 거래 요약 + 레버리지/인버스 심리 구성.

    Parameters:
        records: ETF 가격 데이터 리스트
        trd_date: 조회일 (YYYY-MM-DD)

    Returns:
        etf_summary.json 구조
    """
    # 거래량 상위 20
    top_volume = sorted(
        [r for r in records if r.get("volume", 0)],
        key=lambda x: x.get("volume", 0),
        reverse=True,
    )[:20]

    top_volume_summary = [
        {
            "code": r["code"],
            "name": r.get("name", ""),
            "close": r.get("close"),
            "volume": r.get("volume"),
            "changePct": r.get("changePct"),
        }
        for r in top_volume
    ]

    # 순자산 상위 20
    top_aum = sorted(
        [r for r in records if r.get("aum")],
        key=lambda x: x.get("aum", 0),
        reverse=True,
    )[:20]

    top_aum_summary = [
        {
            "code": r["code"],
            "name": r.get("name", ""),
            "aum": r.get("aum"),
            "close": r.get("close"),
            "volume": r.get("volume"),
        }
        for r in top_aum
    ]

    # 괴리율 이상 (|괴리율| > 1.0%)
    premium_anomalies = [
        {
            "code": r["code"],
            "name": r.get("name", ""),
            "trackingError": r.get("trackingError"),
            "premiumDiscount": r.get("trackingError"),  # trackingError = premium/discount
            "close": r.get("close"),
            "nav": r.get("nav"),
        }
        for r in records
        if abs(r.get("trackingError") or 0) > 1.0
    ]

    # 레버리지/인버스 심리
    leverage_sentiment = build_leverage_sentiment(records)

    summary = {
        "date": trd_date,
        "totalETFs": len(records),
        "topByVolume": top_volume_summary,
        "topByAUM": top_aum_summary,
        "premiumAnomalies": premium_anomalies,
        "leverageSentiment": leverage_sentiment,
    }

    return summary


def main():
    parser = argparse.ArgumentParser(
        description="KRX ETF 시장 데이터 다운로더 (Open API)"
    )
    parser.add_argument(
        "--start",
        default=datetime.now().strftime("%Y-%m-%d"),
        help="조회일 (YYYY-MM-DD, 기본: 오늘)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="디버그 출력 활성화 (필드명, 파싱 상세)",
    )
    parser.add_argument(
        "--output-dir",
        default=DERIV_DIR,
        help="출력 디렉터리 (기본: data/derivatives/)",
    )
    args = parser.parse_args()

    # stdout UTF-8 (Windows 호환)
    sys.stdout.reconfigure(encoding="utf-8")

    # 날짜 형식 검증
    try:
        query_dt = datetime.strptime(args.start, "%Y-%m-%d")
    except ValueError as e:
        print(f"[ETF] 날짜 형식 오류: {e} (YYYY-MM-DD 사용)")
        raise SystemExit(1)

    trd_dd = query_dt.strftime("%Y%m%d")
    trd_date = query_dt.strftime("%Y-%m-%d")

    print("=" * 50)
    print("  KRX ETF 시장 데이터 다운로더 (Open API)")
    print("=" * 50)
    print(f"\n  조회일: {trd_date}")
    print(f"  출력:   {args.output_dir}/")
    print()

    # ── KRX Open API 클라이언트 초기화 ──
    try:
        client = KRXClient(verbose=args.verbose)
    except ValueError as e:
        print(f"[ETF] {e}")
        raise SystemExit(1)

    # ── 1. ETF 일별 시세 다운로드 (단일 API 호출) ──
    print("[ETF] 1/1 — ETF 일별 시세 다운로드 중 (etp/etf_bydd_trd)...")

    raw_records = client.get("etp/etf_bydd_trd", basDd=trd_dd)

    if not raw_records:
        print("[ETF] 경고: 데이터 없음 (공휴일/주말이거나 API 키 확인 필요)")
        print("[ETF] 팁: --verbose 옵션으로 API 응답을 확인하세요.")
        raise SystemExit(1)

    if args.verbose:
        print(f"  [Open API] 원시 레코드: {len(raw_records)}개")
        if raw_records:
            print(f"  [Open API] 첫 번째 레코드 예시:")
            for k, v in list(raw_records[0].items())[:10]:
                print(f"    {k}: {v}")

    # 파싱
    records = parse_etf_records(raw_records, verbose=args.verbose)

    if not records:
        print("[ETF] 경고: 유효한 ETF 데이터 없음 (파싱 실패)")
        raise SystemExit(1)

    print(f"  {len(records)}개 ETF 데이터 수집 완료")

    # ── 2. 출력 디렉터리 생성 ──
    os.makedirs(args.output_dir, exist_ok=True)

    # ── 3. etf_daily.json 저장 ──
    daily_path = os.path.join(args.output_dir, "etf_daily.json")

    daily_output = {
        "date": trd_date,
        "count": len(records),
        "etfs": records,
    }

    with open(daily_path, "w", encoding="utf-8") as f:
        json.dump(daily_output, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(daily_path) / 1024
    print(f"\n  [저장] {daily_path} ({size_kb:.1f}KB, {len(records)}개 ETF)")

    # ── 4. etf_summary.json 저장 ──
    summary = build_summary(records, trd_date)
    summary_path = os.path.join(args.output_dir, "etf_summary.json")

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    size_kb_s = os.path.getsize(summary_path) / 1024
    print(f"  [저장] {summary_path} ({size_kb_s:.1f}KB)")

    # ── 5. 레버리지/인버스 심리 요약 출력 ──
    ls = summary.get("leverageSentiment", {})
    print(f"\n  레버리지/인버스 심리:")
    print(f"    레버리지 ETF: {ls.get('leverageCount', 0)}개, "
          f"거래량 합계: {ls.get('leverageVolume', 0):,}")
    print(f"    인버스   ETF: {ls.get('inverseCount', 0)}개, "
          f"거래량 합계: {ls.get('inverseVolume', 0):,}")

    ratio = ls.get("leverageRatio")
    if ratio is not None:
        print(f"    레버리지 비율: {ratio:.4f} ({ls.get('sentiment', '?')})")
    else:
        print(f"    레버리지 비율: N/A (인버스 거래량 0)")

    # 괴리율 이상 종목 요약
    anomalies = summary.get("premiumAnomalies", [])
    if anomalies:
        print(f"\n  괴리율 이상 (|괴리율| > 1.0%): {len(anomalies)}개")
        for a in anomalies[:5]:
            te = a.get("trackingError") or 0
            print(f"    {a['code']} {a.get('name', ''):20s} 괴리율: {te:+.2f}%")
        if len(anomalies) > 5:
            print(f"    ... 외 {len(anomalies) - 5}개")

    print(f"\n  [쿼터] 남은 일일 쿼터: {client.remaining_quota}")
    print(f"\n[ETF] 완료. signalEngine.js ETF 심리 프록시로 활용 가능.")


if __name__ == "__main__":
    main()
