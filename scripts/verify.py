#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CheeseStock Pre-Deploy Verification
=====================================
Checks 5 categories without a build system, node_modules, or bundler.

Usage:
  python scripts/verify.py              # Full check, exit 0=pass / 1=fail
  python scripts/verify.py --strict     # Fail on warnings too
  python scripts/verify.py --check colors
  python scripts/verify.py --check patterns
  python scripts/verify.py --check dashes
  python scripts/verify.py --check globals
  python scripts/verify.py --check scripts

Run from the project root (same dir as index.html).
"""

import re
import sys
import os
import io
import argparse
from pathlib import Path

# Force UTF-8 output on Windows (avoids cp949 UnicodeEncodeError)
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
JS   = ROOT / "js"

# ---- Terminal colors (ANSI) --------------------------------------------------
RED    = "\033[91m"
YELLOW = "\033[93m"
GREEN  = "\033[92m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

try:
    import ctypes
    ctypes.windll.kernel32.SetConsoleMode(
        ctypes.windll.kernel32.GetStdHandle(-11), 7
    )
except Exception:
    pass


# ---- Helpers -----------------------------------------------------------------

def read(path):
    return path.read_text(encoding="utf-8", errors="replace")


def section(title):
    print(f"\n{BOLD}{CYAN}{'=' * 58}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 58}{RESET}")


def ok(msg):
    print(f"  {GREEN}PASS{RESET}  {msg}")


def warn(msg):
    print(f"  {YELLOW}WARN{RESET}  {msg}")


def fail(msg):
    print(f"  {RED}FAIL{RESET}  {msg}")


def info(msg):
    print(f"        {msg}")


# =============================================================================
# CHECK 1 - Pattern Registry (7 locations across 5 files)
# =============================================================================

# Canonical set comes from patterns.js analyze() calls (normalised).
# detectSupportResistance -> support/resistance (excluded from checklist).
CANONICAL_PATTERNS = {
    "threeWhiteSoldiers", "threeBlackCrows",
    "hammer", "invertedHammer", "hangingMan", "shootingStar",
    "doji", "dragonflyDoji", "gravestoneDoji", "spinningTop",
    "longLeggedDoji",
    "bullishEngulfing", "bearishEngulfing",
    "bullishHarami", "bearishHarami",
    "piercingLine", "darkCloud",
    "tweezerBottom", "tweezerTop",
    "morningStar", "eveningStar",
    "bullishMarubozu", "bearishMarubozu",
    "bullishBeltHold", "bearishBeltHold",
    "threeInsideUp", "threeInsideDown",
    "abandonedBabyBullish", "abandonedBabyBearish",
    "ascendingTriangle", "descendingTriangle",
    "risingWedge", "fallingWedge", "symmetricTriangle",
    "doubleBottom", "doubleTop",
    "headAndShoulders", "inverseHeadAndShoulders",
    "channel",
}

# Neutral direction - not required in BULLISH_TYPES or BEARISH_TYPES
NEUTRAL_PATTERNS = {"doji", "spinningTop", "longLeggedDoji", "symmetricTriangle", "channel"}

# Chart patterns - appear in CHART_PATTERNS + _VIZ_CHART_TYPES
CHART_PATTERNS_SET = {
    "ascendingTriangle", "descendingTriangle",
    "risingWedge", "fallingWedge", "symmetricTriangle",
    "doubleBottom", "doubleTop",
    "headAndShoulders", "inverseHeadAndShoulders",
    "channel",
}

CANDLE_PATTERNS_SET = CANONICAL_PATTERNS - CHART_PATTERNS_SET


def _extract_set_literal(text, var_name):
    """Extract string literals from  new Set([...]) declaration."""
    m = re.search(
        r"(?:const|var)\s+" + re.escape(var_name) + r"\s*=\s*new Set\(\[(.*?)\]\)",
        text, re.DOTALL
    )
    if not m:
        return set()
    return set(re.findall(r"['\"](\w+)['\"]", m.group(1)))


def _extract_obj_keys(text, marker, indent=2):
    """Extract top-level camelCase keys from an object literal starting at marker."""
    idx = text.find(marker)
    if idx == -1:
        return set()
    body = text[idx:]
    end = body.find("\n};")
    if end == -1:
        end = body.find("\n  });")
    body = body[:end] if end != -1 else body
    space = " " * indent
    return set(re.findall(r"^" + re.escape(space) + r"(\w+)\s*:", body, re.MULTILINE))


def check_patterns(strict=False):
    section("CHECK 1 - Pattern Registry (7 locations / 5 files)")
    errors = 0
    warnings = 0

    patterns_src   = read(JS / "patterns.js")
    renderer_src   = read(JS / "patternRenderer.js")
    backtester_src = read(JS / "backtester.js")
    panel_src      = read(JS / "patternPanel.js")
    app_src        = read(JS / "app.js")

    # Derive canonical from analyze() detect calls
    detect_calls = set(re.findall(r"this\.detect(\w+)\(", patterns_src))
    expand = {
        "Engulfing":      ["bullishEngulfing",      "bearishEngulfing"],
        "Harami":         ["bullishHarami",          "bearishHarami"],
        "Marubozu":       ["bullishMarubozu",        "bearishMarubozu"],
        "BeltHold":       ["bullishBeltHold",        "bearishBeltHold"],
        "AbandonedBaby":  ["abandonedBabyBullish",   "abandonedBabyBearish"],
        "ThreeInsideUp":  ["threeInsideUp"],
        "ThreeInsideDown":["threeInsideDown"],
    }
    derived = set()
    for call in detect_calls:
        if call == "SupportResistance":
            continue
        if call in expand:
            derived.update(expand[call])
        else:
            derived.add(call[0].lower() + call[1:])

    derived_unexpected = derived - CANONICAL_PATTERNS
    canonical_undetected = CANONICAL_PATTERNS - derived
    if derived_unexpected:
        warn(f"patterns.js detect calls not in expected canonical set: {sorted(derived_unexpected)}")
        warnings += 1
    if canonical_undetected:
        fail(f"Expected patterns not found in patterns.js analyze(): {sorted(canonical_undetected)}")
        errors += 1
    else:
        ok("patterns.js analyze() - all canonical patterns detected")

    # --- patternRenderer.js extractions ---
    single_keys = _extract_obj_keys(renderer_src, "const SINGLE_PATTERNS = {", indent=4)
    zone_keys   = _extract_obj_keys(renderer_src, "const ZONE_PATTERNS = {",   indent=4)

    cp_m = re.search(
        r"const CHART_PATTERNS = new Set\(\[(.*?)\]\)",
        renderer_src, re.DOTALL
    )
    chart_keys = set(re.findall(r"['\"](\w+)['\"]", cp_m.group(1))) if cp_m else set()

    cp_types = _extract_set_literal(renderer_src, "CANDLE_PATTERN_TYPES")
    bullish  = _extract_set_literal(renderer_src, "BULLISH_TYPES")
    bearish  = _extract_set_literal(renderer_src, "BEARISH_TYPES")

    ko_m = re.search(r"const PATTERN_NAMES_KO\s*=\s*\{(.*?)\n  \}", renderer_src, re.DOTALL)
    names_ko = set(re.findall(r"\b(\w+)\s*:", ko_m.group(1))) if ko_m else set()

    # --- backtester._META ---
    bt_m = re.search(r"this\._META\s*=\s*\{(.*?)\n\s*\}", backtester_src, re.DOTALL)
    bt_keys = set(re.findall(r"^\s{6}(\w+)\s*:", bt_m.group(1), re.MULTILINE)) if bt_m else set()

    # --- patternPanel.js PATTERN_ACADEMIC_META ---
    panel_keys = _extract_obj_keys(
        panel_src, "const PATTERN_ACADEMIC_META = Object.freeze({", indent=2
    )

    # --- app.js viz sets ---
    viz_candle = _extract_set_literal(app_src, "_VIZ_CANDLE_TYPES")
    viz_chart  = _extract_set_literal(app_src, "_VIZ_CHART_TYPES")

    # Helper: validate one location
    def check_location(name, actual, expected, allow_extra=False):
        nonlocal errors, warnings
        missing = expected - actual
        extra   = actual - CANONICAL_PATTERNS
        if missing:
            fail(f"{name}  MISSING: {sorted(missing)}")
            errors += 1
        if extra and not allow_extra:
            warn(f"{name}  extra non-canonical entries: {sorted(extra)}")
            warnings += 1
        if not missing:
            ok(f"{name} ({len(actual)} entries)")

    # Single-candle candle patterns
    single_expected = {
        "hammer", "invertedHammer", "hangingMan", "shootingStar",
        "doji", "dragonflyDoji", "gravestoneDoji", "spinningTop",
        "bullishMarubozu", "bearishMarubozu",
    }
    # Multi-candle candle patterns
    zone_expected = CANDLE_PATTERNS_SET - single_expected

    # SINGLE/ZONE: only care about canonical coverage, not extra reserved names
    check_location("patternRenderer SINGLE_PATTERNS",     single_keys & CANONICAL_PATTERNS, single_expected)
    check_location("patternRenderer ZONE_PATTERNS",        zone_keys   & CANONICAL_PATTERNS, zone_expected)
    check_location("patternRenderer CHART_PATTERNS",       chart_keys,  CHART_PATTERNS_SET)
    check_location("patternRenderer CANDLE_PATTERN_TYPES", cp_types,    CANDLE_PATTERNS_SET)
    check_location("patternRenderer BULLISH_TYPES",        bullish,
                   CANONICAL_PATTERNS - NEUTRAL_PATTERNS - bearish, allow_extra=True)
    check_location("patternRenderer BEARISH_TYPES",        bearish,
                   CANONICAL_PATTERNS - NEUTRAL_PATTERNS - bullish, allow_extra=True)
    # PATTERN_NAMES_KO may contain reserved future patterns — only check canonical coverage
    check_location("patternRenderer PATTERN_NAMES_KO",     names_ko,   CANONICAL_PATTERNS, allow_extra=True)
    check_location("backtester _META",                     bt_keys,    CANONICAL_PATTERNS)
    check_location("patternPanel PATTERN_ACADEMIC_META",   panel_keys, CANONICAL_PATTERNS)
    check_location("app _VIZ_CANDLE_TYPES",                viz_candle, CANDLE_PATTERNS_SET)
    check_location("app _VIZ_CHART_TYPES",                 viz_chart,  CHART_PATTERNS_SET)

    return errors, warnings


# =============================================================================
# CHECK 2 - Hardcoded Color Constants
# =============================================================================

def _build_krx_color_whitelist():
    """All literal hex values in colors.js are approved by definition."""
    colors_src = read(JS / "colors.js")
    hex_vals = set(re.findall(r"#[0-9A-Fa-f]{6}\b", colors_src))
    hex_vals |= set(re.findall(r"#[0-9A-Fa-f]{3}\b", colors_src))
    return hex_vals


# Explicit allowed exceptions -- UI/UX colors that don't belong in KRX_COLORS
COLOR_EXCEPTIONS = {
    # Drawing tool color picker palette (intentionally explicit)
    "#C9A84C", "#787B86", "#2962FF", "#E05050", "#5086DC", "#26C6DA",
    "#A08830", "#2962ff", "#787b86",
    # TradingView axis label requires white
    "#ffffff", "#fff", "#FFFFFF",
    # App.js CSS variable fallback
    "#141414",
    # realtimeProvider.js -- error notification banner (not a chart color)
    "#B71C1C", "#E53935", "#E65100", "#FF6D00",
    # sidebar.js -- neutral gray for missing data, DEMO badge (#ff9800 = RSI color)
    "#888", "#ff9800",
    # financials.js -- axis lines / tick marks
    "#808080", "#E8E8E8",
    # app.js -- empty state UI text
    "#555e78",
    # drawingTools.js -- anchor handle stroke white
    "#ffffff",
    # Pure black/white utility
    "#000000", "#000",
}

COLOR_SCAN_FILES = [
    "chart.js", "drawingTools.js", "financials.js",
    "patternRenderer.js", "signalRenderer.js", "sidebar.js",
    "app.js", "realtimeProvider.js", "patterns.js",
    "indicators.js", "patternPanel.js", "backtester.js",
]


def check_colors(strict=False):
    section("CHECK 2 - Hardcoded Color Constants")
    errors = 0
    warnings = 0

    whitelist_hex = _build_krx_color_whitelist()
    all_allowed = whitelist_hex | {h.lower() for h in COLOR_EXCEPTIONS} | COLOR_EXCEPTIONS

    total_violations = 0
    for fname in COLOR_SCAN_FILES:
        fpath = JS / fname
        if not fpath.exists():
            continue
        src = read(fpath)
        lines = src.splitlines()

        file_violations = []
        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            # Only scan code portion (before inline comment)
            code_part = line.split("//")[0]
            hex_matches = re.findall(r"(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})\b", code_part)
            for m in hex_matches:
                if m not in all_allowed and m.lower() not in all_allowed:
                    file_violations.append((lineno, m, line.strip()))

        if file_violations:
            fail(f"{fname} - {len(file_violations)} unapproved color(s):")
            for lineno, color, snippet in file_violations[:5]:
                info(f"  line {lineno}: {color}  ->  {snippet[:72]}")
            if len(file_violations) > 5:
                info(f"  ... and {len(file_violations) - 5} more")
            total_violations += len(file_violations)
            errors += 1
        else:
            ok(f"{fname} - no stray hex values")

    if total_violations == 0:
        ok("All JS files use KRX_COLORS constants")

    return errors, warnings


# =============================================================================
# CHECK 3 - setLineDash Standardization
# =============================================================================

ALLOWED_DASHES = {"[]", "[2,3]", "[5,3]", "[8,4]"}

# Matches dynamic dash references like  pl.dash || []  or  hl.dash || [5,3]
DYNAMIC_DASH_RE = re.compile(
    r"setLineDash\(\s*\w[\w.]*\s*(?:\|\|\s*\[[^\]]*\])?\s*\)"
)


def normalise_dash(raw):
    return re.sub(r"\s+", "", raw)


def check_dashes(strict=False):
    section("CHECK 3 - setLineDash Standardization  ([] [2,3] [5,3] [8,4])")
    errors = 0
    warnings = 0
    total_violations = 0

    for fpath in sorted((JS / f for f in JS.glob("*.js")), key=lambda p: p.name):
        if fpath.name == "analysisWorker.js":
            continue
        src = read(fpath)
        lines = src.splitlines()
        file_violations = []

        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if DYNAMIC_DASH_RE.search(line):
                continue
            m = re.search(r"setLineDash\(\s*(\[[^\]]*\])\s*\)", line)
            if m:
                norm = normalise_dash(m.group(1))
                if norm not in ALLOWED_DASHES:
                    file_violations.append((lineno, norm, line.strip()))

        if file_violations:
            fail(f"{fpath.name} - non-standard dash pattern(s):")
            for lineno, dash, snippet in file_violations:
                info(f"  line {lineno}: {dash}  ->  {snippet[:72]}")
            total_violations += len(file_violations)
            errors += 1

    if total_violations == 0:
        ok("All setLineDash calls use standard tiers: [] [2,3] [5,3] [8,4]")

    return errors, warnings


# =============================================================================
# CHECK 4 - Script Load Order & Global Exports
# =============================================================================

FILE_EXPORTS = {
    "colors.js":           {"KRX_COLORS"},
    "data.js":             {"PAST_DATA", "getPastData", "getFinancialData"},
    "api.js":              {"_idb", "KRX_API_CONFIG", "ALL_STOCKS", "DEFAULT_STOCKS",
                            "TIMEFRAMES", "dataService"},
    "realtimeProvider.js": {"realtimeProvider"},
    "indicators.js":       {"calcMA", "calcEMA", "calcBB", "calcRSI", "calcMACD",
                            "calcATR", "calcIchimoku", "calcKalman", "calcHurst",
                            "calcWLSRegression", "_invertMatrix", "IndicatorCache"},
    "patterns.js":         {"patternEngine"},
    "signalEngine.js":     {"COMPOSITE_SIGNAL_DEFS", "signalEngine"},
    "chart.js":            {"chartManager"},
    "patternRenderer.js":  {"patternRenderer"},
    "signalRenderer.js":   {"signalRenderer"},
    "backtester.js":       {"backtester"},
    "sidebar.js":          {"sidebarManager"},
    "patternPanel.js":     {"PATTERN_ACADEMIC_META", "renderPatternPanel"},
    "financials.js":       {"updateFinancials", "drawFinTrendChart"},
    "drawingTools.js":     {"drawingTools"},
    "app.js":              set(),  # consumer, not exporter
}

LOAD_ORDER = [
    "colors.js", "data.js", "api.js", "realtimeProvider.js",
    "indicators.js", "patterns.js", "signalEngine.js", "chart.js",
    "patternRenderer.js", "signalRenderer.js", "backtester.js",
    "sidebar.js", "patternPanel.js", "financials.js", "drawingTools.js", "app.js",
]


def _parse_script_order_from_html():
    html_path = ROOT / "index.html"
    if not html_path.exists():
        return []
    html = read(html_path)
    srcs = re.findall(r'<script\b[^>]*\bsrc=["\']([^"\']+\.js)(?:\?[^"\']*)?["\']', html)
    return [s for s in srcs if not s.startswith("http")]


def check_globals(strict=False):
    section("CHECK 4 - Script Load Order & Global Exports")
    errors = 0
    warnings = 0

    # 4a. Verify index.html script order
    html_order = _parse_script_order_from_html()
    html_fnames = [os.path.basename(s) for s in html_order]

    if html_fnames == LOAD_ORDER:
        ok(f"index.html script load order - correct ({len(LOAD_ORDER)} files)")
    else:
        missing_from_html = [f for f in LOAD_ORDER if f not in html_fnames]
        extra_in_html     = [f for f in html_fnames if f not in LOAD_ORDER]

        if missing_from_html:
            fail(f"Scripts missing from index.html: {missing_from_html}")
            errors += 1
        if extra_in_html:
            warn(f"Extra scripts in index.html (not in expected order): {extra_in_html}")
            warnings += 1

        for i in range(min(len(LOAD_ORDER), len(html_fnames))):
            if LOAD_ORDER[i] != html_fnames[i]:
                fail(f"Load order mismatch at position {i+1}: expected {LOAD_ORDER[i]}, got {html_fnames[i]}")
                errors += 1

    # 4b. Verify each file exists and declares its exports
    all_present = True
    for fname in LOAD_ORDER:
        fpath = JS / fname
        if not fpath.exists():
            fail(f"js/{fname} does not exist")
            errors += 1
            all_present = False
            continue
        src = read(fpath)
        for export in sorted(FILE_EXPORTS.get(fname, set())):
            pattern = (
                r"^(?:const|var|let|async\s+function|function|class)\s+" + re.escape(export) + r"\b"
                r"|^" + re.escape(export) + r"\s*="
            )
            if not re.search(pattern, src, re.MULTILINE):
                warn(f"js/{fname}: expected export '{export}' not found at module scope")
                warnings += 1

    if all_present:
        ok(f"All {len(LOAD_ORDER)} JS files present")

    return errors, warnings


# =============================================================================
# CHECK 5 - Deployment & Script Health
# =============================================================================

def check_scripts(strict=False):
    section("CHECK 5 - Deployment & Script Health")
    errors = 0
    warnings = 0

    # 5a. Service worker cache name
    sw_path = ROOT / "sw.js"
    if sw_path.exists():
        sw_src = read(sw_path)
        cache_m = re.search(r"CACHE_NAME\s*=\s*['\"]([^'\"]+)['\"]", sw_src)
        if cache_m:
            ok(f"sw.js CACHE_NAME = '{cache_m.group(1)}'")
        else:
            warn("sw.js: CACHE_NAME constant not found")
            warnings += 1
    else:
        warn("sw.js not found")
        warnings += 1

    # 5b. daily_deploy.bat includes verify step
    deploy_bat = ROOT / "scripts" / "daily_deploy.bat"
    if deploy_bat.exists():
        bat_src = read(deploy_bat)
        if "verify.py" in bat_src:
            ok("daily_deploy.bat includes verify.py pre-check")
        else:
            warn("daily_deploy.bat does not call verify.py (add it as step [1/N])")
            warnings += 1
    else:
        warn("scripts/daily_deploy.bat not found")
        warnings += 1

    # 5c. SRI integrity on CDN scripts
    html_path = ROOT / "index.html"
    if html_path.exists():
        html = read(html_path)
        cdn_scripts = re.findall(
            r'<script\b[^>]*src=["\']https?://[^"\']+["\'][^>]*>', html
        )
        for tag in cdn_scripts:
            src_m = re.search(r'src=["\']([^"\']+)["\']', tag)
            src = src_m.group(1) if src_m else "(unknown)"
            if "integrity=" not in tag:
                fail(f"CDN script missing SRI integrity: {src}")
                errors += 1
            else:
                ok(f"SRI present: {src.split('/')[-1]}")
    else:
        fail("index.html not found")
        errors += 1

    # 5d. Project name in deploy bat
    if deploy_bat.exists():
        bat_src = read(deploy_bat)
        if "cheesestock" in bat_src.lower():
            ok("daily_deploy.bat references 'cheesestock' project")
        else:
            warn("daily_deploy.bat may be missing --project-name cheesestock")
            warnings += 1

    # 5e. No Korean / non-ASCII chars in non-echo bat command lines
    bat_files = list((ROOT / "scripts").glob("*.bat")) + list(ROOT.glob("*.bat"))
    for bat_path in sorted(bat_files):
        lines = read(bat_path).splitlines()
        non_ascii_lines = []
        for lineno, line in enumerate(lines, 1):
            stripped = line.strip().lower()
            if stripped.startswith("echo") or stripped.startswith("rem") or stripped.startswith("::"):
                continue
            if any(ord(c) > 127 for c in line):
                non_ascii_lines.append((lineno, line.strip()))
        if non_ascii_lines:
            warn(f"{bat_path.name}: non-ASCII chars in command lines (may break wrangler):")
            for lineno, line in non_ascii_lines[:3]:
                info(f"  line {lineno}: {line[:60]}")
            warnings += 1
        else:
            ok(f"{bat_path.name} - ASCII-safe command lines")

    return errors, warnings


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="CheeseStock pre-deploy verifier")
    parser.add_argument(
        "--check",
        choices=["patterns", "colors", "dashes", "globals", "scripts", "all"],
        default="all",
        help="Which check to run (default: all)"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with failure code on warnings too"
    )
    args = parser.parse_args()

    os.chdir(ROOT)

    total_errors   = 0
    total_warnings = 0

    checks = {
        "patterns": check_patterns,
        "colors":   check_colors,
        "dashes":   check_dashes,
        "globals":  check_globals,
        "scripts":  check_scripts,
    }

    run = list(checks.keys()) if args.check == "all" else [args.check]

    for name in run:
        e, w = checks[name](strict=args.strict)
        total_errors   += e
        total_warnings += w

    print(f"\n{BOLD}{'=' * 58}{RESET}")
    print(f"{BOLD}  SUMMARY{RESET}")
    print(f"{'=' * 58}")
    if total_errors == 0 and total_warnings == 0:
        print(f"  {GREEN}{BOLD}ALL CHECKS PASSED{RESET}")
    else:
        if total_errors > 0:
            print(f"  {RED}ERRORS:   {total_errors}{RESET}")
        if total_warnings > 0:
            print(f"  {YELLOW}WARNINGS: {total_warnings}{RESET}")
    print(f"{'=' * 58}\n")

    fail_on_warn = args.strict and total_warnings > 0
    sys.exit(1 if (total_errors > 0 or fail_on_warn) else 0)


if __name__ == "__main__":
    main()
