#!/usr/bin/env python3
"""
KRX 업종별 펀더멘탈 데이터 다운로더
FinanceDataReader + data/financials/*.json 활용

출력: data/sector_fundamentals.json
"""
import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def main():
    print("============================================")
    print("  KRX 섹터 펀더멘탈 빌더")
    print("============================================\n")

    # 1. index.json에서 종목 목록 + 섹터 정보 로드
    index_path = os.path.join(DATA_DIR, "index.json")
    if not os.path.exists(index_path):
        print("  ⚠ data/index.json이 없습니다. download_ohlcv.py를 먼저 실행하세요.")
        return

    with open(index_path, "r", encoding="utf-8") as f:
        index_data = json.load(f)

    stocks = index_data.get("stocks", [])
    print(f"  종목 수: {len(stocks)}개")

    # 2. 각 종목의 재무 데이터에서 PER/PBR/ROE 수집
    fin_dir = os.path.join(DATA_DIR, "financials")
    sector_stocks = {}  # { sector: [{ code, name, per, pbr, roe, opm }] }
    market_all = []     # KOSPI 전체 평균용

    for s in stocks:
        code = s.get("code", "")
        sector = s.get("sector", "")
        market = s.get("market", "KOSPI")
        if not sector:
            sector = "기타"

        # 재무 데이터 로드
        fin_path = os.path.join(fin_dir, f"{code}.json")
        per, pbr, roe, opm = 0, 0, 0, 0
        mcap = s.get("marketCap", 0)  # 억원 단위

        if os.path.exists(fin_path):
            try:
                with open(fin_path, "r", encoding="utf-8") as f:
                    fin = json.load(f)
                # 데모/시드 데이터 제외 — 단위(억원)가 DART(원)와 다름
                fin_source = fin.get("source", "")
                if fin_source in ("demo", "seed"):
                    pass  # PER/PBR/ROE/OPM 모두 0 유지 (데모 데이터 무시)
                elif fin.get("quarterly"):
                    quarterly = fin["quarterly"]
                    latest = quarterly[-1]
                    # opm/roe는 "14.1%" 문자열 → float 변환
                    opm_str = str(latest.get("opm", "0"))
                    roe_str = str(latest.get("roe", "0"))
                    try:
                        opm = float(opm_str.replace("%", ""))
                    except (ValueError, TypeError):
                        opm = 0
                    try:
                        roe = float(roe_str.replace("%", ""))
                    except (ValueError, TypeError):
                        roe = 0

                    # PER = 시가총액(원) / TTM 순이익(원)
                    if mcap > 0:
                        # TTM NI: 최근 4분기 합산 (가능하면), 아니면 최신 분기 × 4
                        ttm_ni = 0
                        if len(quarterly) >= 4:
                            ttm_ni = sum(q.get("ni", 0) or 0 for q in quarterly[-4:])
                        elif latest.get("ni"):
                            ttm_ni = (latest["ni"] or 0) * 4  # 연율화
                        if ttm_ni > 0:
                            _per = mcap * 1e8 / ttm_ni
                            if 0 < _per < 500:  # PER 500 이상은 이상치 제외
                                per = round(_per, 1)

                        # PBR = 시가총액(원) / 자본총계(원)
                        equity = latest.get("total_equity", 0) or 0
                        if equity > 0:
                            _pbr = mcap * 1e8 / equity
                            if 0 < _pbr < 100:  # PBR 100 이상은 이상치 제외
                                pbr = round(_pbr, 2)
            except Exception:
                pass

        entry = {
            "code": code,
            "name": s.get("name", ""),
            "market": market,
            "per": per,
            "pbr": pbr,
            "roe": roe,
            "opm": opm,
            "marketCap": mcap,
        }

        if sector not in sector_stocks:
            sector_stocks[sector] = []
        sector_stocks[sector].append(entry)
        market_all.append(entry)

    # 3. 섹터별 평균 계산
    def calc_avg(entries, field):
        vals = []
        for e in entries:
            v = e.get(field, 0)
            try:
                v = float(v)
                if v > 0:
                    vals.append(v)
            except (TypeError, ValueError):
                continue
        if not vals:
            return 0
        return round(sum(vals) / len(vals), 2)

    sectors = {}
    for sector_name, entries in sector_stocks.items():
        sectors[sector_name] = {
            "name": sector_name,
            "count": len(entries),
            "avgPer": calc_avg(entries, "per"),
            "avgPbr": calc_avg(entries, "pbr"),
            "avgRoe": calc_avg(entries, "roe"),
            "avgOpm": calc_avg(entries, "opm"),
            "stocks": [e["code"] for e in entries],
        }

    # 4. 시장 전체 평균
    kospi_entries = [e for e in market_all if e["market"] == "KOSPI"]
    kosdaq_entries = [e for e in market_all if e["market"] == "KOSDAQ"]

    output = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "kospiAvg": {
            "per": calc_avg(kospi_entries, "per"),
            "pbr": calc_avg(kospi_entries, "pbr"),
            "roe": calc_avg(kospi_entries, "roe"),
            "opm": calc_avg(kospi_entries, "opm"),
            "count": len(kospi_entries),
        },
        "kosdaqAvg": {
            "per": calc_avg(kosdaq_entries, "per"),
            "pbr": calc_avg(kosdaq_entries, "pbr"),
            "roe": calc_avg(kosdaq_entries, "roe"),
            "opm": calc_avg(kosdaq_entries, "opm"),
            "count": len(kosdaq_entries),
        },
        "sectors": sectors,
    }

    # 5. 저장
    filepath = os.path.join(DATA_DIR, "sector_fundamentals.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n  섹터 수: {len(sectors)}개")
    print(f"  KOSPI 평균: PER {output['kospiAvg']['per']}, PBR {output['kospiAvg']['pbr']}, ROE {output['kospiAvg']['roe']}%")
    print(f"  KOSDAQ 평균: PER {output['kosdaqAvg']['per']}, PBR {output['kosdaqAvg']['pbr']}, ROE {output['kosdaqAvg']['roe']}%")
    print(f"\n  저장: {filepath}")
    print("============================================")


if __name__ == "__main__":
    main()
