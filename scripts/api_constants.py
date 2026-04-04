"""
Shared API constants and utilities for KRX Live Chart pipeline.
All download_*.py and compute_*.py scripts should import from here.
"""

import os
import math

# === API Base URLs ===
ECOS_BASE_URL = "https://ecos.bok.or.kr/api"
FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"
KOSIS_BASE_URL = "https://kosis.kr/openapi/Param/statisticsParameterData.do"
DART_BASE_URL = "https://opendart.fss.or.kr/api"
KRX_OPEN_API_BASE = "https://data-dbg.krx.co.kr/svc/apis"
KRX_OTP_URL = "http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd"
KRX_CSV_URL = "http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd"

# === Rate Limits (seconds) ===
RATE_LIMIT_SEC = 0.5

# === Timeouts (seconds) ===
TIMEOUT_QUICK = 15
TIMEOUT_NORMAL = 30
TIMEOUT_HEAVY = 60
TIMEOUT_EXTREME = 120

# === Default HTTP Headers ===
DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CheeseStock/1.0"

# === Shared Utilities ===
def load_env_key(key_name, env_path=".env"):
    """Load API key from environment or .env file."""
    val = os.environ.get(key_name)
    if val:
        return val.strip()
    if os.path.isfile(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(key_name + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

def generate_business_days(start_date, end_date):
    """Generate weekday-only dates between start and end (inclusive)."""
    from datetime import timedelta
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:
            yield current
        current += timedelta(days=1)

def parse_number(val, default=None):
    """Safely parse a number string (handles commas, whitespace)."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return val
    val = str(val).replace(",", "").strip()
    if not val or val == "-":
        return default
    try:
        return float(val) if "." in val else int(val)
    except ValueError:
        return default

def clean_csv_fieldnames(fieldnames):
    """Remove BOM and whitespace from CSV fieldnames."""
    return [f.lstrip("\ufeff").strip() for f in fieldnames] if fieldnames else []

def normal_cdf(x):
    """Abramowitz-Stegun approximation for standard normal CDF."""
    if x < -10:
        return 0.0
    if x > 10:
        return 1.0
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    sign = 1 if x >= 0 else -1
    x = abs(x) / math.sqrt(2)
    t = 1.0 / (1.0 + p * x)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-x * x)
    return 0.5 * (1.0 + sign * y)
