#!/usr/bin/env python3
"""
Download VKOSPI (Korea Volatility Index) historical data from KRX.

Source: data.krx.co.kr (KRX Market Data System)
API endpoint: /contents/MDC/MAIN/showMain (IndTp = VKOSPI)

Status: STUB — data pipeline not yet implemented.
When complete, this eliminates the VIX*1.1 proxy in signalEngine.js:1535.

Usage:
    python scripts/download_vkospi.py [--start YYYY-MM-DD] [--end YYYY-MM-DD]

Output:
    data/vkospi.json — { date: "YYYY-MM-DD", close: float, high: float, low: float }[]
"""

import argparse
import json
import sys
from datetime import datetime


def main():
    parser = argparse.ArgumentParser(description='Download VKOSPI data from KRX')
    parser.add_argument('--start', default='2020-01-01', help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end', default=datetime.now().strftime('%Y-%m-%d'), help='End date')
    parser.add_argument('--output', default='data/vkospi.json', help='Output file path')
    args = parser.parse_args()

    # TODO: Implement KRX data.krx.co.kr API call
    # Reference: https://data.krx.co.kr/contents/MDC/MDI/mdiIdx/MKD13000/MKD13000.cmd
    # Headers required: User-Agent, OTP token from generate.cmd
    #
    # Steps:
    #   1. POST to http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd
    #      with params: locale=ko_KR, indIdx=VKOSPI, ...
    #   2. POST OTP to http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd
    #   3. Parse CSV response into JSON

    print(f"[VKOSPI] STUB: download_vkospi.py not yet implemented")
    print(f"[VKOSPI] When complete, eliminates VIX*1.1 proxy in signalEngine.js")
    print(f"[VKOSPI] Requested range: {args.start} ~ {args.end}")
    sys.exit(1)  # Non-zero exit = not implemented


if __name__ == '__main__':
    main()
