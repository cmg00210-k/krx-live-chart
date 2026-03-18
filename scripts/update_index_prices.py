"""
전체 종목 인덱스 종가+시총+등락률 갱신 (auto_update.bat 2단계용)

기존 data/index.json을 읽어:
  1) FinanceDataReader 최신 종가/시총으로 갱신 (FDR 사용 가능 시)
  2) 각 종목 OHLCV 파일에서 prevClose/change/changePercent/volume 추출
     (사이드바에서 개별 OHLCV 로드 없이 즉시 가격/등락률 표시용)

OHLCV를 다시 다운로드하지 않으므로 빠르게 완료됨.

사용법:
  python scripts/update_index_prices.py            # FDR + OHLCV 요약 둘 다
  python scripts/update_index_prices.py --offline   # OHLCV 요약만 (FDR 없이)
"""

import sys
import json
import os
import argparse

sys.stdout.reconfigure(encoding='utf-8')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
IDX_PATH = os.path.join(DATA_DIR, "index.json")


def extract_summary_from_ohlcv(stock_entry):
    """개별 종목 OHLCV JSON에서 사이드바 요약 데이터 추출

    마지막 2봉에서 prevClose, change, changePercent, volume 계산.
    사이드바가 개별 OHLCV 파일을 로드하지 않고도 즉시 가격/등락률 표시 가능.
    """
    file_path = stock_entry.get("file", "")
    if not file_path:
        return

    full_path = os.path.join(DATA_DIR, file_path)
    if not os.path.exists(full_path):
        return

    try:
        with open(full_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        candles = data.get("candles", [])
        if len(candles) >= 2:
            last = candles[-1]
            prev = candles[-2]
            prev_close = prev["close"]

            stock_entry["prevClose"] = prev_close
            stock_entry["change"] = last["close"] - prev_close
            stock_entry["changePercent"] = round(
                (last["close"] - prev_close) / prev_close * 100, 2
            ) if prev_close > 0 else 0.0
            stock_entry["volume"] = last.get("volume", 0)

            # lastClose도 최신 값으로 갱신 (FDR 미사용 시 이걸로 대체)
            if last["close"] > 0:
                stock_entry["lastClose"] = last["close"]

        elif len(candles) == 1:
            stock_entry["prevClose"] = candles[-1]["close"]
            stock_entry["change"] = 0
            stock_entry["changePercent"] = 0.0
            stock_entry["volume"] = candles[-1].get("volume", 0)

    except Exception as e:
        # 요약 추출 실패 시 기존 필드만 유지
        pass


def update_with_fdr(existing):
    """FinanceDataReader로 전체 종목 최신 시총+종가 갱신"""
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

        print(f"  FDR 갱신 완료: {updated}종목의 종가+시총 업데이트")
    except ImportError:
        print("  FinanceDataReader 미설치 — FDR 갱신 건너뜀")
    except Exception as e:
        print(f"  FDR 갱신 실패: {e}")


def main():
    parser = argparse.ArgumentParser(description="KRX 인덱스 가격/등락률 갱신")
    parser.add_argument("--offline", action="store_true",
                        help="FDR 없이 OHLCV 파일에서만 요약 추출")
    args = parser.parse_args()

    # 기존 index.json 로드
    if not os.path.exists(IDX_PATH):
        print("  기존 인덱스 없음 -- 먼저 download_ohlcv.py를 실행하세요")
        return

    with open(IDX_PATH, "r", encoding="utf-8") as f:
        existing = json.load(f)

    stocks = existing.get("stocks", [])
    print(f"  기존 인덱스: {len(stocks)}종목")

    # 1단계: FDR으로 최신 종가/시총 갱신 (온라인 모드)
    if not args.offline:
        update_with_fdr(existing)

    # 2단계: 각 종목 OHLCV 파일에서 사이드바 요약 데이터 추출
    print(f"\n  OHLCV 요약 데이터 추출 중...")
    summary_count = 0
    for s in stocks:
        had_prev = "prevClose" in s
        extract_summary_from_ohlcv(s)
        if "prevClose" in s:
            summary_count += 1

    # 저장
    with open(IDX_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False)

    print(f"  요약 데이터 추출 완료: {summary_count}/{len(stocks)}종목")
    print(f"  저장: {IDX_PATH}")


if __name__ == "__main__":
    main()
