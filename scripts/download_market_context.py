#!/usr/bin/env python3
"""
download_market_context.py — 외부 API 시장 맥락 수집기
Layer 2: getContextualConfidence()에서 사용되는 data/market_context.json 생성

수집 항목:
  1. ECOS API — 소비자심리지수(CCSI, 통계코드 511Y002/FME/99988)
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

import json, os, argparse, datetime, hashlib, sys
sys.stdout.reconfigure(encoding='utf-8')
from typing import Optional
from pathlib import Path

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ── 공통 상수/유틸 (api_constants.py) ──
sys.path.insert(0, str(Path(__file__).parent))
from api_constants import ECOS_BASE_URL as ECOS_BASE, TIMEOUT_QUICK as TIMEOUT

# ──────────────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────────────
OUTPUT_PATH = Path(__file__).parent.parent / 'data' / 'market_context.json'

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
    통계코드: 511Y002 (소비자동향조사, 2-그룹 테이블)
    Group1: FME (소비자심리지수)
    Group2: 99988 (전체/전국)
    주기: M (월별)
    정상 범위: 80~120 (100 = 장기 평균)
    """
    if not HAS_REQUESTS or not api_key:
        return None
    today = datetime.date.today()
    # 최근 3개월 범위로 조회 (월별 발표이므로 여유 확보)
    start_ym = (today.replace(day=1) - datetime.timedelta(days=90)).strftime('%Y%m')
    end_ym = today.strftime('%Y%m')
    url = (
        f'{ECOS_BASE}/StatisticSearch/{api_key}/json/kr/1/10/'
        f'511Y002/M/{start_ym}/{end_ym}/FME/99988'
    )
    try:
        r = requests.get(url, timeout=TIMEOUT)
        if r.status_code != 200:
            print(f'[CCSI] ECOS HTTP {r.status_code}', file=sys.stderr)
            return None
        data = r.json()
        rows = data.get('StatisticSearch', {}).get('row', [])
        if rows:
            # 가장 최근 값 반환
            # [M-5 FIX] 0 default 제거 — CCSI 정상 범위는 80~120, 0은 불가능한 값
            raw = rows[-1].get('DATA_VALUE')
            if raw is None or raw == '':
                print('[CCSI] DATA_VALUE가 비어 있음 — None 반환', file=sys.stderr)
                return None
            val = float(raw)
            if val < 50 or val > 150:
                print(f'[CCSI] 범위 이상: {val} (정상: 80~120) — None 반환', file=sys.stderr)
                return None
            return val
    except Exception as e:
        print(f'[CCSI] ECOS 조회 실패: {e}', file=sys.stderr)
    return None


# ──────────────────────────────────────────────────────
# VKOSPI (KRX 변동성 지수)
# ──────────────────────────────────────────────────────
def _load_json(path):
    """Load JSON file, return parsed dict or None."""
    try:
        if Path(path).exists():
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return None


def fetch_vkospi() -> Optional[float]:
    """VKOSPI: data/vkospi.json(Open API) → macro_latest.json VIX fallback"""
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
    except Exception as e:
        print(f'[WARN] VKOSPI local load error: {e}', file=sys.stderr)
    # 2) macro_latest.json VIX fallback (download_macro.py already fetches VIX from FRED/FDR)
    # Avoids duplicate FDR network call — reuse existing pipeline output.
    macro_path = Path(__file__).parent.parent / 'data' / 'macro' / 'macro_latest.json'
    macro = _load_json(macro_path)
    if macro:
        vix = macro.get('vix')
        if vix is not None:
            print(f'  [VKOSPI] Using VIX={vix} from macro_latest.json as fallback')
            return float(vix)
    return None


# ──────────────────────────────────────────────────────
# 투자자 순매수 (KRX 공시)
# ──────────────────────────────────────────────────────
def fetch_investor_flow() -> Optional[dict]:
    """외국인 순매수 최신값 (억원 단위)
    우선순위: 1) data/derivatives/investor_summary.json (download_investor.py 생성)
              2) pykrx 투자자별 거래실적
              3) FinanceDataReader fallback
    """
    # 1) investor_summary.json에서 읽기 (가장 확실)
    inv_path = Path(__file__).parent.parent / 'data' / 'derivatives' / 'investor_summary.json'
    try:
        if inv_path.exists():
            with open(inv_path, 'r', encoding='utf-8') as f:
                inv = json.load(f)
            # [H-13 FIX] source="sample" 데이터는 무시 — 가짜 데이터가 live로 전파 방지
            if inv.get('source') == 'sample':
                print('[investor] investor_summary.json is SAMPLE — skipping')
                return None
            # [C-2 FIX] nested (foreign.net_1d_eok) 또는 flat (foreign_net_1d) 둘 다 지원
            val = None
            foreign = inv.get('foreign')
            if isinstance(foreign, dict) and foreign.get('net_1d_eok') is not None:
                val = foreign['net_1d_eok']
            elif inv.get('foreign_net_1d') is not None:
                val = inv['foreign_net_1d']
            if val is not None:
                return {'net_foreign_eok': round(float(val), 1)}
    except Exception as e:
        print(f'[WARN] investor_summary load error: {e}', file=sys.stderr)

    # 2) pykrx fallback
    try:
        from pykrx import stock as pykrx_stock
        today = datetime.date.today()
        start = (today - datetime.timedelta(days=10)).strftime('%Y%m%d')
        end = today.strftime('%Y%m%d')
        df = pykrx_stock.get_market_trading_value_by_date(start, end, "KOSPI")
        if df is not None and not df.empty:
            # 외국인 순매수 (억원)
            foreign_col = [c for c in df.columns if '외국인' in c]
            if foreign_col:
                val = float(df[foreign_col[0]].iloc[-1])
                return {'net_foreign_eok': round(val / 1e8, 1)}
    except Exception as e:
        print(f'[WARN] investor pykrx fallback error: {e}', file=sys.stderr)

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
            # VKOSPI 정상 범위: 5~100 (사상 최고 ~89, 2020.03)
            if vkospi < 5 or vkospi > 100:
                print(f'  [WARN] VKOSPI={vkospi:.2f} 범위 이탈 [5, 100] — 데이터 무시')
                vkospi = None
            else:
                ctx['vkospi'] = round(vkospi, 2)
                print(f'  VKOSPI: {vkospi:.2f}')
        if vkospi is None:
            print('  VKOSPI: 조회 실패 또는 범위 이상')

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
