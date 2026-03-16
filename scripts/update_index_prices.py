"""
전체 종목 인덱스 종가+시총 갱신 (auto_update.bat 2단계용)

기존 data/index.json을 읽어 FinanceDataReader의 최신 종가/시총으로 갱신.
OHLCV를 다시 다운로드하지 않으므로 빠르게 완료됨.
"""

import sys
import json
import os

sys.stdout.reconfigure(encoding='utf-8')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX_PATH = os.path.join(PROJECT_ROOT, "data", "index.json")


def main():
    # 기존 index.json 로드
    if not os.path.exists(IDX_PATH):
        print("  기존 인덱스 없음 — 먼저 download_ohlcv.py를 실행하세요")
        return

    with open(IDX_PATH, "r", encoding="utf-8") as f:
        existing = json.load(f)

    print(f"  기존 인덱스: {len(existing.get('stocks', []))}종목")

    # FinanceDataReader로 전체 종목 최신 시총+종가 갱신
    try:
        import FinanceDataReader as fdr

        updated = 0
        for market in ["KOSPI", "KOSDAQ"]:
            df = fdr.StockListing(market)
            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    code = str(row.get("Code", ""))
                    close = int(row.get("Close", 0))
                    marcap_raw = row.get("Marcap", 0)
                    marcap = int(marcap_raw / 100_000_000) if marcap_raw else 0
                    if not code:
                        continue
                    # 기존 stocks에서 찾아서 갱신
                    for s in existing.get("stocks", []):
                        if s["code"] == code:
                            if close > 0:
                                s["lastClose"] = close
                            if marcap > 0:
                                s["marketCap"] = marcap
                            updated += 1
                            break

        with open(IDX_PATH, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False)

        print(f"  갱신 완료: {updated}종목의 종가+시총 업데이트")
    except Exception as e:
        print(f"  갱신 실패: {e}")


if __name__ == "__main__":
    main()
