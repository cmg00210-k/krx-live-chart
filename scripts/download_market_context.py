#!/usr/bin/env python3
"""
download_market_context.py — 외부 API 시장 맥락 수집기
Layer 2: getContextualConfidence()에서 사용되는 data/market_context.json 생성

수집 항목:
  1. ECOS API — 소비자심리지수(CCSI, 통계코드 721Y001)
  2. KRX 투자자 순매수 (외국인/기관) — 공시 데이터
  3. VKOSPI — 변동성 지수 (KRX API)
  4. 어닝시즌 플래그 — 1월/4월/7월/10월 실적 발표 기간

의존성:
    pip install requests

사용법:
    python scripts/download_market_context.py
    python scripts/download_market_context.py --ecos-key YOUR_KEY
    python scripts/download_market_context.py --demo  # 실제 API 없이 시드 기반 데모

출력:
    data/market_context.json
"""

import json, os, argparse, datetime, hashlib, math, sys
sys.stdout.reconfigure(encoding='utf-8')
from typing import Optional
from pathlib import Path

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ──────────────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────────────
OUTPUT_PATH = Path(__file__).parent.parent / 'data' / 'market_context.json'
ECOS_BASE = 'https://ecos.bok.or.kr/api'
TIMEOUT = 15  # 초

# ──────────────────────────────────────────────────────
# 유틸
# ──────────────────────────────────────────────────────
def _seed_value(code, key, lo, hi):
    """재현 가능한 시드 기반 값 생성 (데모 모드용)"""
    h = int(hashlib.md5(f'{code}{key}'.encode()).hexdigest(), 16)
    return lo + (h % 1000) / 1000 * (hi - lo)


def _earning_season_flag():
    """어닝시즌 여부: 1월/4월/7월/10월 (국내 분기 실적 발표 기간)
    Returns 1 if current month is earnings season, 0 otherwise."""
    month = datetime.date.today().month
    return 1 if month in (1, 4, 7, 10) else 0


# ──────────────────────────────────────────────────────
# ECOS 소비자심리지수
# ──────────────────────────────────────────────────────
def fetch_ccsi(api_key: str) -> Optional[float]:
    """한국은행 ECOS API → 소비자심리지수(CCSI) 최신값 조회
    API 문서: https://ecos.bok.or.kr/api/#/DevGuide/userGuide
    통계코드: 721Y001 / 항목: CCSI (종합)
    """
    if not HAS_REQUESTS or not api_key:
        return None
    today = datetime.date.today()
    # 최근 3개월 범위로 조회 (월별 발표이므로 여유 확보)
    start_ym = (today.replace(day=1) - datetime.timedelta(days=90)).strftime('%Y%m')
    end_ym = today.strftime('%Y%m')
    url = (
        f'{ECOS_BASE}/StatisticSearch/{api_key}/json/kr/1/10/'
        f'721Y001/MM/{start_ym}/{end_ym}/CCSI'
    )
    try:
        r = requests.get(url, timeout=TIMEOUT)
        data = r.json()
        rows = data.get('StatisticSearch', {}).get('row', [])
        if rows:
            # 가장 최근 값 반환
            return float(rows[-1].get('DATA_VALUE', 0))
    except Exception as e:
        print(f'[CCSI] ECOS 조회 실패: {e}', file=sys.stderr)
    return None


# ──────────────────────────────────────────────────────
# VKOSPI (KRX 변동성 지수)
# ──────────────────────────────────────────────────────
def fetch_vkospi() -> Optional[float]:
    """VKOSPI: data/vkospi.json(Open API) → FDR VIX fallback"""
    # 1) data/vkospi.json (download_vkospi.py Open API output)
    vkospi_path = Path(__file__).parent.parent / 'data' / 'vkospi.json'
    try:
        if vkospi_path.exists():
            with open(vkospi_path, 'r', encoding='utf-8') as f:
                records = json.load(f)
            if isinstance(records, dict):
                records = records.get('candles', records.get('data', []))
            if records:
                last = records[-1] if isinstance(records, list) else records
                val = last.get('close') or last.get('Close')
                if val is not None:
                    return float(val)
    except Exception:
        pass
    # 2) FDR VIX fallback (VKOSPI proxy)
    try:
        import FinanceDataReader as fdr
        today = datetime.date.today()
        start = (today - datetime.timedelta(days=10)).strftime('%Y-%m-%d')
        df = fdr.DataReader('VIX', start)
        if not df.empty:
            return float(df['Close'].iloc[-1])
    except Exception:
        pass
    return None


# ──────────────────────────────────────────────────────
# 투자자 순매수 (KRX 공시)
# ──────────────────────────────────────────────────────
def fetch_investor_flow() -> Optional[dict]:
    """외국인/기관 순매수 최신값 (억원 단위)
    FinanceDataReader KRX 투자자 동향 조회
    """
    try:
        import FinanceDataReader as fdr
        today = datetime.date.today()
        start = (today - datetime.timedelta(days=5)).strftime('%Y-%m-%d')
        df = fdr.DataReader('KRX/PER', start)
        if df is not None and not df.empty:
            # PER 조회 성공 시 외국인/기관 데이터를 별도 조회
            pass
    except Exception:
        pass
    # 투자자 데이터 직접 조회 (DataReader 지원 항목)
    try:
        import FinanceDataReader as fdr
        today = datetime.date.today()
        start = (today - datetime.timedelta(days=10)).strftime('%Y-%m-%d')
        df = fdr.DataReader('KOSPI/FOREIGN', start)
        if df is not None and not df.empty:
            val = float(df.iloc[-1].get('Net', df.iloc[-1, 0]))
            return {'net_foreign_eok': round(val / 1e8, 1)}
    except Exception:
        pass
    return None


# ──────────────────────────────────────────────────────
# 데모 모드
# ──────────────────────────────────────────────────────
def build_demo_context() -> dict:
    """실제 API 없이 재현 가능한 시드 기반 데모 데이터 생성
    주의: 실제 시장 데이터가 아님 — getContextualConfidence()에서 demo 플래그 확인 필요
    """
    today = datetime.date.today().isoformat()
    return {
        'generated_at': today,
        'source': 'demo',  # getContextualConfidence()에서 실제 데이터와 구별
        'ccsi': round(_seed_value(today, 'ccsi', 85, 110), 1),
        'vkospi': round(_seed_value(today, 'vkospi', 12, 35), 1),
        'net_foreign_eok': round(_seed_value(today, 'flow', -2000, 2000), 0),
        'earning_season': _earning_season_flag(),
    }


# ──────────────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='시장 맥락 데이터 수집 → data/market_context.json')
    parser.add_argument('--ecos-key', default='', help='한국은행 ECOS API 키')
    parser.add_argument('--demo', action='store_true', help='데모 모드 (실제 API 미사용)')
    args = parser.parse_args()

    # .env 파일에서 ECOS API 키 자동 로드
    if not args.ecos_key and not args.demo:
        env_path = Path(__file__).parent.parent / '.env'
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if line.startswith("ECOS_API_KEY="):
                    args.ecos_key = line.split("=", 1)[1].strip()
                    print("[INFO] .env에서 ECOS API 키 로드 완료")
                    break

    if args.demo:
        ctx = build_demo_context()
        print('[demo] 시드 기반 데모 데이터 생성')
    else:
        print('[시작] 시장 맥락 데이터 수집 중...')
        ctx = {
            'generated_at': datetime.date.today().isoformat(),
            'source': 'live',
        }

        # CCSI
        ccsi = fetch_ccsi(args.ecos_key)
        if ccsi is not None:
            ctx['ccsi'] = round(ccsi, 1)
            print(f'  CCSI: {ccsi:.1f}')
        else:
            print('  CCSI: 조회 실패 (ECOS API 키 필요 또는 네트워크 오류)')

        # VKOSPI
        vkospi = fetch_vkospi()
        if vkospi is not None:
            ctx['vkospi'] = round(vkospi, 2)
            print(f'  VKOSPI: {vkospi:.2f}')
        else:
            print('  VKOSPI: 조회 실패 (FinanceDataReader 필요)')

        # 투자자 순매수
        flow = fetch_investor_flow()
        if flow:
            ctx.update(flow)
            print(f'  외국인 순매수: {flow.get("net_foreign_eok")}억원')
        else:
            print('  투자자 순매수: 조회 실패')

        # 어닝시즌 (로컬 계산 — API 불필요)
        ctx['earning_season'] = _earning_season_flag()
        print(f'  어닝시즌: {ctx["earning_season"]} ({datetime.date.today().month}월)')

    # 저장
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(ctx, f, ensure_ascii=False, indent=2)
    print(f'[완료] {OUTPUT_PATH}')
    print(json.dumps(ctx, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
