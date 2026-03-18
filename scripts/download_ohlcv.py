"""
KRX 전체 종목 OHLCV 데이터 다운로더

데이터 소스: pykrx (KRX 공식 데이터 스크래핑)
종목 리스트: FinanceDataReader (KRX 상장 전종목)
출력 형식:   TradingView Lightweight Charts 호환 JSON

폴더 구조 (코스콤 전환 대비):
  data/
  ├── index.json          ← 전체 종목 인덱스 (코드, 이름, 시장)
  ├── kospi/
  │   ├── 005930.json     ← 삼성전자 일봉
  │   └── ...
  └── kosdaq/
      ├── 247540.json     ← 에코프로비엠 일봉
      └── ...

사용법:
  python scripts/download_ohlcv.py              # 기본 1년치, 전체 종목
  python scripts/download_ohlcv.py --years 3    # 3년치
  python scripts/download_ohlcv.py --market KOSPI  # KOSPI만
  python scripts/download_ohlcv.py --code 005930   # 삼성전자만
  python scripts/download_ohlcv.py --top 100       # 시가총액 상위 100개
"""

import sys
import os
import json
import time
import argparse
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

from pykrx import stock
import FinanceDataReader as fdr

# ── 경로 설정 ──
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")


def get_all_stocks():
    """KRX 전체 상장종목 리스트 (FinanceDataReader 사용, 재시도 포함)"""
    print("  종목 리스트 로딩 중...")

    for attempt in range(3):
        try:
            kospi = fdr.StockListing('KOSPI')
            kosdaq = fdr.StockListing('KOSDAQ')
            break
        except Exception as e:
            print(f"  ⚠ 종목 리스트 로드 실패 (시도 {attempt+1}/3): {e}")
            if attempt < 2:
                time.sleep(3)
            else:
                raise

    stocks = []
    for _, row in kospi.iterrows():
        code = str(row['Code']).strip()
        name = str(row['Name']).strip()
        if code and name and len(code) == 6:
            stocks.append({"code": code, "name": name, "market": "KOSPI"})

    for _, row in kosdaq.iterrows():
        code = str(row['Code']).strip()
        name = str(row['Name']).strip()
        if code and name and len(code) == 6:
            stocks.append({"code": code, "name": name, "market": "KOSDAQ"})

    print(f"  KOSPI {len(kospi)}개 + KOSDAQ {len(kosdaq)}개 = {len(stocks)}개")
    return stocks


def download_stock(code, name, market, start_date, end_date, output_dir):
    """단일 종목 OHLCV 다운로드 → 시장별 폴더에 JSON 저장"""
    try:
        df = stock.get_market_ohlcv(start_date, end_date, code)

        if df.empty:
            return None

        candles = []
        for date_idx, row in df.iterrows():
            o = int(row["시가"])
            h = int(row["고가"])
            l = int(row["저가"])
            c = int(row["종가"])
            v = int(row["거래량"])

            if o <= 0 or h <= 0 or l <= 0 or c <= 0:
                continue

            candles.append({
                "time": date_idx.strftime("%Y-%m-%d"),
                "open": o, "high": h, "low": l, "close": c,
                "volume": v
            })

        if not candles:
            return None

        # 시장별 하위 폴더에 저장
        market_dir = os.path.join(output_dir, market.lower())
        os.makedirs(market_dir, exist_ok=True)

        data = {
            "code": code,
            "name": name,
            "market": market,
            "timeframe": "1d",
            "count": len(candles),
            "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
            "candles": candles
        }

        filepath = os.path.join(market_dir, f"{code}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        return {
            "code": code,
            "name": name,
            "market": market,
            "count": len(candles),
            "size_kb": os.path.getsize(filepath) / 1024,
            "last_close": candles[-1]["close"],
            "file": f"{market.lower()}/{code}.json"
        }

    except Exception as e:
        return {"error": str(e)}


def fetch_market_caps(date_str):
    """FinanceDataReader로 전체 종목 시가총액 조회 (억원 단위)

    pykrx의 get_market_cap_by_ticker가 컬럼명 인코딩 문제로 실패하므로
    FinanceDataReader.StockListing()의 Marcap 필드를 사용.

    Args:
        date_str: "YYYYMMDD" 형식의 날짜 (미사용, FDR은 최신 데이터 반환)

    Returns:
        dict: { 종목코드: 시총(억원) }
    """
    market_caps = {}
    try:
        import FinanceDataReader as fdr

        for market in ["KOSPI", "KOSDAQ"]:
            try:
                df = fdr.StockListing(market)
                if df is not None and not df.empty and "Marcap" in df.columns:
                    for _, row in df.iterrows():
                        code = str(row.get("Code", ""))
                        marcap = row.get("Marcap", 0)
                        if code and marcap and marcap > 0:
                            cap_억 = int(marcap / 100_000_000)  # 원 → 억원
                            if cap_억 > 0:
                                market_caps[code] = cap_억
            except Exception as e:
                print(f"  ⚠ {market} 시총 조회 실패: {e}")

        print(f"  시가총액 데이터: {len(market_caps)}종목 로드 완료")

    except Exception as e:
        print(f"  ⚠ 시가총액 조회 전체 실패: {e}")

    return market_caps


def fetch_sector_info():
    """FinanceDataReader로 전체 종목 섹터/업종 정보 조회

    Returns:
        dict: { 종목코드: { 'sector': '...', 'industry': '...' } }
    """
    sector_map = {}
    try:
        import FinanceDataReader as fdr
        for market in ['KRX-DESC']:
            df = fdr.StockListing(market)
            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    code = str(row.get('Code', ''))
                    raw_sector = row.get('Sector', '')
                    raw_industry = row.get('Industry', '')
                    import math
                    def _safe_str(v):
                        if v is None: return ''
                        if isinstance(v, float) and math.isnan(v): return ''
                        s = str(v).strip()
                        return '' if s.lower() == 'nan' else s
                    sector = _safe_str(raw_sector)
                    industry = _safe_str(raw_industry)
                    # FDR에서 Sector가 대부분 NaN이므로 Industry를 sector로 사용
                    if not sector and industry:
                        sector = industry
                    if code and sector:
                        sector_map[code] = {
                            'sector': sector,
                            'industry': industry,
                        }
        print(f"  섹터 정보: {len(sector_map)}종목 로드 완료")
    except Exception as e:
        print(f"  섹터 정보 조회 실패: {e}")
    return sector_map


def _fetch_indices():
    """KOSPI/KOSDAQ 최신 지수 조회"""
    indices = {}
    try:
        import FinanceDataReader as fdr
        # KOSPI 지수
        df = fdr.DataReader('KS11', start=(datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        if df is not None and not df.empty:
            indices['kospi'] = float(df.iloc[-1]['Close'])
        # KOSDAQ 지수
        df = fdr.DataReader('KQ11', start=(datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        if df is not None and not df.empty:
            indices['kosdaq'] = float(df.iloc[-1]['Close'])
        if indices:
            print(f"  지수 조회 완료: KOSPI {indices.get('kospi', '?')}, KOSDAQ {indices.get('kosdaq', '?')}")
    except Exception as e:
        print(f"  지수 조회 실패: {e}")
    return indices


def build_index(stocks_meta, start_date, end_date, market_caps=None, sector_map=None):
    """data/index.json 생성 — js/api.js에서 읽는 전체 종목 인덱스

    Args:
        stocks_meta: 종목 메타 리스트
        start_date: 시작일
        end_date: 종료일
        market_caps: { 종목코드: 시총(억원) } (선택)
        sector_map: { 종목코드: { 'sector': '...', 'industry': '...' } } (선택)
    """
    # 시가총액 필드 추가
    if market_caps:
        for s in stocks_meta:
            code = s["code"]
            if code in market_caps:
                s["marketCap"] = market_caps[code]

    # 섹터/업종 필드 추가
    if sector_map:
        for s in stocks_meta:
            code = s["code"]
            if code in sector_map:
                s["sector"] = sector_map[code].get("sector", "")
                s["industry"] = sector_map[code].get("industry", "")

    index = {
        "source": "pykrx (KRX)",
        "license": "개발용 (사업화 시 코스콤 전환 필요)",
        "period": f"{start_date}~{end_date}",
        "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "total": len(stocks_meta),
        "kospi": len([s for s in stocks_meta if s["market"] == "KOSPI"]),
        "kosdaq": len([s for s in stocks_meta if s["market"] == "KOSDAQ"]),
        "stocks": stocks_meta,
        "indices": _fetch_indices(),
    }

    filepath = os.path.join(DATA_DIR, "index.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    return filepath


def main():
    parser = argparse.ArgumentParser(description="KRX 전체 종목 OHLCV 다운로더")
    parser.add_argument("--years", type=int, default=1, help="다운로드 연수 (기본: 1)")
    parser.add_argument("--market", type=str, choices=["KOSPI", "KOSDAQ"], help="특정 시장만")
    parser.add_argument("--code", type=str, help="특정 종목 코드만")
    parser.add_argument("--top", type=int, help="시가총액 상위 N개만")
    parser.add_argument("--delay", type=float, default=0.8, help="요청 간 대기(초, 기본: 0.8)")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    end_date = datetime.now().strftime("%Y%m%d")
    start_date = (datetime.now() - timedelta(days=args.years * 365)).strftime("%Y%m%d")

    print(f"═══════════════════════════════════════════")
    print(f"  KRX OHLCV 다운로더")
    print(f"  기간: {start_date} ~ {end_date} ({args.years}년)")
    print(f"  저장: data/kospi/, data/kosdaq/")
    print(f"═══════════════════════════════════════════")
    print()

    # ── 종목 리스트 가져오기 ──
    if args.code:
        # 단일 종목 모드
        name = stock.get_market_ticker_name(args.code) or args.code
        targets = [{"code": args.code, "name": name, "market": "KOSPI"}]
        print(f"  단일 종목: {name}({args.code})")
    else:
        targets = get_all_stocks()

        if args.market:
            targets = [s for s in targets if s["market"] == args.market]
            print(f"  필터: {args.market}만 ({len(targets)}개)")

        if args.top:
            targets = targets[:args.top]
            print(f"  필터: 상위 {args.top}개")

    print(f"\n── 다운로드 시작 ({len(targets)}개 종목) ──\n")

    success = 0
    fail = 0
    skip = 0
    stocks_meta = []
    start_time = time.time()

    for i, s in enumerate(targets):
        result = download_stock(s["code"], s["name"], s["market"], start_date, end_date, DATA_DIR)

        if result is None:
            skip += 1
        elif "error" in result:
            fail += 1
            if (i + 1) % 50 == 0 or fail <= 3:
                print(f"  ✗ [{i+1}/{len(targets)}] {s['name']}({s['code']}): {result['error']}")
        else:
            success += 1
            entry = {
                "code": result["code"],
                "name": result["name"],
                "market": result["market"],
                "file": result["file"],
                "lastClose": result["last_close"]
            }

            # [OPT] 사이드바 즉시 표시용 요약 데이터 (index.json에서 바로 사용)
            # 마지막 2봉에서 전일 종가, 변동폭, 등락률, 거래량 추출
            candle_path = os.path.join(DATA_DIR, result["file"])
            try:
                with open(candle_path, "r", encoding="utf-8") as cf:
                    candle_data = json.load(cf)
                candles = candle_data.get("candles", [])
                if len(candles) >= 2:
                    last = candles[-1]
                    prev = candles[-2]
                    entry["prevClose"] = prev["close"]
                    entry["change"] = last["close"] - prev["close"]
                    entry["changePercent"] = round(
                        (last["close"] - prev["close"]) / prev["close"] * 100, 2
                    ) if prev["close"] > 0 else 0.0
                    entry["volume"] = last.get("volume", 0)
                elif len(candles) == 1:
                    entry["prevClose"] = candles[-1]["close"]
                    entry["change"] = 0
                    entry["changePercent"] = 0.0
                    entry["volume"] = candles[-1].get("volume", 0)
            except Exception:
                pass  # 요약 추출 실패 시 기존 필드만 유지

            stocks_meta.append(entry)
            # 진행률 표시 (50개마다 또는 처음 5개)
            if (i + 1) % 50 == 0 or i < 5:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                eta = (len(targets) - i - 1) / rate if rate > 0 else 0
                print(f"  ✓ [{i+1}/{len(targets)}] {s['name']}({s['code']}): "
                      f"{result['count']}봉 {result['size_kb']:.0f}KB "
                      f"| 남은 시간: {int(eta//60)}분 {int(eta%60)}초")

        # KRX 서버 부하 방지
        if i < len(targets) - 1:
            time.sleep(args.delay)

    # ── 시가총액 데이터 조회 ──
    print(f"\n── 시가총액 데이터 조회 ──\n")
    market_caps = fetch_market_caps(end_date)

    # ── 섹터/업종 정보 조회 ──
    print(f"\n── 섹터/업종 정보 조회 ──\n")
    sector_map = fetch_sector_info()

    # ── 인덱스 파일 생성 (시총 + 섹터 포함) ──
    index_path = build_index(stocks_meta, start_date, end_date, market_caps, sector_map)

    # ── 용량 계산 ──
    total_size = 0
    for root, dirs, files in os.walk(DATA_DIR):
        for f in files:
            if f.endswith(".json"):
                total_size += os.path.getsize(os.path.join(root, f))

    elapsed = time.time() - start_time

    print(f"\n═══════════════════════════════════════════")
    print(f"  완료! ({int(elapsed//60)}분 {int(elapsed%60)}초 소요)")
    print(f"  성공: {success} | 실패: {fail} | 건너뜀: {skip}")
    print(f"  인덱스: {len(stocks_meta)}종목 (data/index.json)")
    print(f"  총 용량: {total_size / 1024 / 1024:.1f}MB")
    print(f"═══════════════════════════════════════════")


if __name__ == "__main__":
    main()
