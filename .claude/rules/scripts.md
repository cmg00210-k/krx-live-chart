# Scripts Reference

## Stock Data (OHLCV)
```bash
python scripts/download_ohlcv.py              # All stocks, 1 year
python scripts/download_ohlcv.py --years 3    # 3 years
python scripts/download_ohlcv.py --market KOSPI
python scripts/download_ohlcv.py --code 005930
python scripts/download_ohlcv.py --cron        # Unattended mode
```
Requires: `pip install pykrx FinanceDataReader`

## Intraday (Interpolation)
```bash
python scripts/generate_intraday.py                    # All stocks, all timeframes
python scripts/generate_intraday.py --code 005930
python scripts/generate_intraday.py --timeframe 5m     # 1m/5m/15m/30m/1h
```
Uses Brownian bridge + `calendar.timegm()` (KST-safe).

## Financial Statements (DART)
```bash
python scripts/download_financials.py --api-key YOUR_DART_KEY
python scripts/download_financials.py --api-key YOUR_KEY --code 005930
python scripts/download_financials.py --demo
```
Requires: `pip install requests`. API key: https://opendart.fss.or.kr/

## Index Price Update (fast, no OHLCV re-download)
```bash
python scripts/update_index_prices.py             # FDR latest + OHLCV summary
python scripts/update_index_prices.py --offline    # OHLCV summary only (no FDR)
```
Updates `data/index.json` with prevClose/change/changePercent/volume for sidebar display.

## Sector Fundamentals
```bash
python scripts/download_sector.py    # Generates data/sector_fundamentals.json
```
Uses FinanceDataReader + `data/financials/*.json`.

## Verification (Pre-Deploy)
```bash
python scripts/verify.py              # 5 categories, exit 0=pass / 1=fail
python scripts/verify.py --strict     # Fail on warnings too
python scripts/verify.py --check colors   # Single: colors/patterns/dashes/globals/scripts
```

## Daily Update / Deploy
```bash
scripts\daily_update.bat    # OHLCV + intraday + index price update
scripts\auto_update.bat     # Hourly: OHLCV + intraday + index prices + wrangler deploy
scripts\daily_deploy.bat    # daily_update + wrangler deploy
```
Task Scheduler: `CheeseStock_HourlyDeploy` hourly 09:30-16:05 Mon-Fri.

## Deployment (Cloudflare Pages)
```bash
# NEVER deploy from root (.) — 100MB+ files will fail the 25MB limit.
# Always stage first, then deploy from deploy/ directory.
python scripts/stage_deploy.py
wrangler pages deploy deploy --project-name cheesestock --branch main --commit-dirty=true --commit-message="deploy"

# Or use the npm script (does both steps):
npm run deploy
```
`stage_deploy.py` is the sole deploy gatekeeper — wrangler has no file exclusion mechanism.
ASCII-only commit messages (Korean causes Cloudflare API error).

## One-Click Launch
```bash
CheeseStock.bat    # Starts Kiwoom WS server + HTTP server + browser
```
