#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CheeseStock Pre-Deploy Verification
=====================================
Checks 9 categories without a build system, node_modules, or bundler.

Usage:
  python scripts/verify.py              # Full check, exit 0=pass / 1=fail
  python scripts/verify.py --strict     # Fail on warnings too
  python scripts/verify.py --check colors
  python scripts/verify.py --check patterns
  python scripts/verify.py --check dashes
  python scripts/verify.py --check globals
  python scripts/verify.py --check scripts
  python scripts/verify.py --check pipeline
  python scripts/verify.py --check criteria

Run from the project root (same dir as index.html).
"""

import re
import sys
import os
import io
import json
import argparse
from pathlib import Path
from datetime import date, timedelta

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
    "doji", "dragonflyDoji", "gravestoneDoji", "longLeggedDoji",
    "spinningTop",
    "bullishEngulfing", "bearishEngulfing",
    "bullishHarami", "bearishHarami",
    "piercingLine", "darkCloud",
    "tweezerBottom", "tweezerTop",
    "morningStar", "eveningStar",
    "threeInsideUp", "threeInsideDown",
    "bullishMarubozu", "bearishMarubozu",
    "bullishBeltHold", "bearishBeltHold",
    "bullishHaramiCross", "bearishHaramiCross",
    "stickSandwich",
    "abandonedBabyBullish", "abandonedBabyBearish",
    "risingThreeMethods", "fallingThreeMethods",
    "cupAndHandle",
    "ascendingTriangle", "descendingTriangle",
    "risingWedge", "fallingWedge", "symmetricTriangle",
    "doubleBottom", "doubleTop",
    "headAndShoulders", "inverseHeadAndShoulders",
    "channel",
}

# Neutral direction - not required in BULLISH_TYPES or BEARISH_TYPES
NEUTRAL_PATTERNS = {"symmetricTriangle", "channel", "longLeggedDoji", "doji", "spinningTop"}

# Chart patterns - appear in CHART_PATTERNS + _VIZ_CHART_TYPES
CHART_PATTERNS_SET = {
    "ascendingTriangle", "descendingTriangle",
    "risingWedge", "fallingWedge", "symmetricTriangle",
    "doubleBottom", "doubleTop",
    "headAndShoulders", "inverseHeadAndShoulders",
    "channel", "cupAndHandle",
}

CANDLE_PATTERNS_SET = CANONICAL_PATTERNS - CHART_PATTERNS_SET


def _extract_set_literal(text, var_name):
    """Extract string literals from  new Set([...]) declaration.
    Handles both plain literals and spread references (...otherSet)."""
    m = re.search(
        r"(?:const|var)\s+" + re.escape(var_name) + r"\s*=\s*new Set\(\[(.*?)\]\)",
        text, re.DOTALL
    )
    if not m:
        return set()
    body = m.group(1)
    # Direct string literals
    result = set(re.findall(r"['\"](\w+)['\"]", body))
    # Spread references: ...varName  -> resolve each recursively
    spreads = re.findall(r"\.\.\.\s*(\w+)", body)
    for ref in spreads:
        result |= _extract_set_literal(text, ref)
    return result


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
    # app.js 4-split: 상태/설정은 appState.js, 나머지는 app.js
    app_src        = read(JS / "app.js")
    appstate_src   = read(JS / "appState.js") if (JS / "appState.js").exists() else ""

    # Derive canonical from analyze() detect calls
    detect_calls = set(re.findall(r"this\.detect(\w+)\(", patterns_src))
    expand = {
        "Engulfing":      ["bullishEngulfing",      "bearishEngulfing"],
        "Harami":         ["bullishHarami",          "bearishHarami"],
        "Marubozu":       ["bullishMarubozu",        "bearishMarubozu"],
        "BeltHold":       ["bullishBeltHold",        "bearishBeltHold"],
        "HaramiCross":    ["bullishHaramiCross",     "bearishHaramiCross"],
        "AbandonedBaby":  ["abandonedBabyBullish",   "abandonedBabyBearish"],
    }
    derived = set()
    for call in detect_calls:
        if call in ("SupportResistance", "ValuationSR"):
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

    # --- app.js viz sets (spread-composed) + D-tier exclusions ---
    # appState.js가 있으면 거기서 읽기 (4-split), 없으면 app.js 폴백
    state_src    = appstate_src if appstate_src else app_src
    viz_candle   = _extract_set_literal(state_src, "_VIZ_CANDLE_TYPES")
    viz_chart    = _extract_set_literal(state_src, "_VIZ_CHART_TYPES")
    suppressed   = _extract_set_literal(state_src, "_SUPPRESS_PATTERNS")
    context_only = _extract_set_literal(state_src, "_CONTEXT_ONLY_PATTERNS")

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

    # Single-candle candle patterns (1-candle glow/stripe rendering in SINGLE_PATTERNS)
    single_expected = {
        "hammer", "invertedHammer", "hangingMan", "shootingStar",
        "doji", "dragonflyDoji", "gravestoneDoji", "longLeggedDoji", "spinningTop",
        "bullishMarubozu", "bearishMarubozu",
        "bullishBeltHold", "bearishBeltHold",
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
    # VIZ sets exclude D-tier (SUPPRESS + CONTEXT_ONLY) by design
    viz_candle_expected = CANDLE_PATTERNS_SET - suppressed - context_only
    viz_chart_expected  = CHART_PATTERNS_SET  - suppressed - context_only
    check_location("app _VIZ_CANDLE_TYPES",                viz_candle, viz_candle_expected)
    check_location("app _VIZ_CHART_TYPES",                 viz_chart,  viz_chart_expected)

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

    # 2b. rgba() audit — colors.js is the only approved source of rgba() values
    colors_src = read(JS / "colors.js")
    # Build whitelist from colors.js rgba values (normalize spaces)
    rgba_whitelist = set()
    for m in re.findall(r"rgba\(\s*([^)]+)\)", colors_src):
        rgba_whitelist.add(re.sub(r"\s+", "", m))

    rgba_violations = 0
    for fname in COLOR_SCAN_FILES:
        fpath = JS / fname
        if not fpath.exists():
            continue
        src = read(fpath)
        lines = src.splitlines()
        file_rgba = []
        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            code_part = line.split("//")[0]
            for m in re.finditer(r"rgba\(\s*([^)]+)\)", code_part):
                normalized = re.sub(r"\s+", "", m.group(1))
                if normalized not in rgba_whitelist:
                    file_rgba.append((lineno, f"rgba({normalized})", line.strip()))
        if file_rgba:
            warn(f"{fname} - {len(file_rgba)} rgba() value(s) not from colors.js:")
            for lineno, color, snippet in file_rgba[:3]:
                info(f"  line {lineno}: {color}")
            rgba_violations += len(file_rgba)
            warnings += 1

    if rgba_violations == 0:
        ok("All rgba() values traced to colors.js")

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
    "data.js":             {"getFinancialData"},  # PAST_DATA, getPastData are data.js-internal helpers
    "api.js":              {"_idb", "KRX_API_CONFIG", "ALL_STOCKS", "DEFAULT_STOCKS",
                            "TIMEFRAMES", "dataService"},
    "realtimeProvider.js": {"realtimeProvider"},
    "indicators.js":       {"calcMA", "calcEMA", "calcBB", "calcRSI", "calcMACD",
                            "calcATR", "calcIchimoku", "calcKalman", "calcHurst",
                            "calcWLSRegression", "IndicatorCache"},  # _invertMatrix is indicators.js-internal
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
    "appState.js":         set(),  # shared state (global vars)
    "appWorker.js":        set(),  # worker + analysis pipeline
    "appUI.js":            set(),  # DOM events + rendering
    "app.js":              set(),  # init orchestration
}

LOAD_ORDER = [
    "colors.js", "data.js", "api.js", "realtimeProvider.js",
    "indicators.js", "patterns.js", "signalEngine.js", "chart.js",
    "patternRenderer.js", "signalRenderer.js", "backtester.js",
    "sidebar.js", "patternPanel.js", "financials.js", "drawingTools.js",
    "appState.js", "appWorker.js", "appUI.js", "app.js",
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

    # 5b. deploy bat files include verify step
    for bat_name in ("daily_deploy.bat", "deploy.bat"):
        bat_path = ROOT / "scripts" / bat_name
        if bat_path.exists():
            bat_src = read(bat_path)
            if "verify.py" in bat_src:
                ok(f"{bat_name} includes verify.py pre-check")
            else:
                warn(f"{bat_name} does not call verify.py (add it as step [1/N])")
                warnings += 1
        else:
            warn(f"scripts/{bat_name} not found")
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
    deploy_bat_5d = ROOT / "scripts" / "daily_deploy.bat"
    if deploy_bat_5d.exists():
        bat_src = read(deploy_bat_5d)
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

    # 5f. ?v=N version sync: index.html <script> tags vs analysisWorker.js importScripts
    index_html    = ROOT / "index.html"
    worker_js     = ROOT / "js" / "analysisWorker.js"
    if index_html.exists() and worker_js.exists():
        html_src    = read(index_html)
        worker_src  = read(worker_js)
        # Extract filename->version from index.html <script src="js/FILE.js?v=N">
        html_vers   = {m.group(1): int(m.group(2))
                       for m in re.finditer(r'<script[^>]+src="js/([^"?]+\.js)\?v=(\d+)"', html_src)}
        # Extract filename->version from importScripts('FILE.js?v=N', ...)
        worker_vers = {m.group(1): int(m.group(2))
                       for m in re.finditer(r"['\"]([^'\"?]+\.js)\?v=(\d+)['\"]", worker_src)}
        mismatches = []
        for fname, wv in worker_vers.items():
            hv = html_vers.get(fname)
            if hv is not None and hv != wv:
                mismatches.append((fname, hv, wv))
        if mismatches:
            for fname, hv, wv in mismatches:
                fail(f"Version mismatch: {fname} index.html ?v={hv} != analysisWorker.js ?v={wv}")
                errors += 1
        else:
            ok("index.html <-> analysisWorker.js ?v=N versions in sync")
    else:
        warn("5f skipped: index.html or js/analysisWorker.js not found")
        warnings += 1

    # [V6-FIX] P0-3: Worker constructor URL ?v=N validation
    # new Worker('js/analysisWorker.js?v=N') and new Worker('js/screenerWorker.js?v=N')
    # must reference valid Worker files, and the constructor ?v=N should match the
    # importScripts versions inside the Worker file (internal consistency).
    if index_html.exists():
        if 'html_src' not in dir() or html_src is None:
            html_src = read(index_html)
        if 'html_vers' not in dir():
            html_vers = {m.group(1): int(m.group(2))
                         for m in re.finditer(r'<script[^>]+src="js/([^"?]+\.js)\?v=(\d+)"', html_src)}
        # Scan all main-thread JS files for new Worker(...) constructor calls
        worker_constructor_re = re.compile(
            r"""new\s+Worker\(\s*['"]js/([^'"?]+\.js)\?v=(\d+)['"]\s*\)"""
        )
        worker_constructors = []  # (host_file, worker_file, version)
        for js_fname in LOAD_ORDER:
            js_fpath = JS / js_fname
            if not js_fpath.exists():
                continue
            js_src = read(js_fpath)
            for m in worker_constructor_re.finditer(js_src):
                worker_constructors.append((js_fname, m.group(1), int(m.group(2))))

        if worker_constructors:
            for host_file, wk_file, ctor_ver in worker_constructors:
                wk_path = JS / wk_file
                if not wk_path.exists():
                    fail(f"Worker constructor in {host_file}: js/{wk_file} does not exist")
                    errors += 1
                    continue
                # Read Worker file and extract its importScripts ?v=N versions
                wk_src = read(wk_path)
                wk_import_vers = {m2.group(1): int(m2.group(2))
                                  for m2 in re.finditer(r"['\"]([^'\"?]+\.js)\?v=(\d+)['\"]", wk_src)}
                # Check: each importScripts version should match index.html
                wk_mismatches = []
                for imp_file, imp_ver in wk_import_vers.items():
                    hv = html_vers.get(imp_file)
                    if hv is not None and hv != imp_ver:
                        wk_mismatches.append((imp_file, hv, imp_ver))
                if wk_mismatches:
                    for imp_file, hv, iv in wk_mismatches:
                        fail(f"Worker desync: {wk_file} importScripts {imp_file} ?v={iv} != index.html ?v={hv}")
                        errors += 1
                else:
                    ok(f"Worker constructor {host_file} -> {wk_file}?v={ctor_ver}: importScripts versions in sync")
        else:
            ok("No Worker constructor calls found (skipping Worker URL validation)")

    # 5g. SW STATIC_ASSETS ↔ index.html local script sync
    sw_path2 = ROOT / "sw.js"
    if sw_path2.exists() and index_html.exists():
        sw_src2   = read(sw_path2)
        html_src2 = read(index_html) if not index_html.exists() else html_src if 'html_src' in dir() else read(index_html)
        # Parse STATIC_ASSETS entries
        sa_m = re.search(r"STATIC_ASSETS\s*=\s*\[(.*?)\]", sw_src2, re.DOTALL)
        sw_assets = set()
        if sa_m:
            # Active (non-commented) entries only
            for line in sa_m.group(1).splitlines():
                stripped = line.strip()
                if stripped.startswith("//"):
                    continue
                m = re.search(r"['\"]([^'\"]+)['\"]", stripped)
                if m:
                    sw_assets.add(m.group(1))
        # Local scripts from index.html (js/*.js, not CDN)
        html_local_scripts = set()
        for m in re.finditer(r'<script\b[^>]*src=["\']([^"\'?]+)(?:\?[^"\']*)?["\']', html_src2):
            src = m.group(1)
            if not src.startswith("http"):
                html_local_scripts.add("/" + src if not src.startswith("/") else src)
        # CSS from index.html
        html_local_css = set()
        for m in re.finditer(r'<link\b[^>]*href=["\']([^"\'?]+\.css)(?:\?[^"\']*)?["\']', html_src2):
            href = m.group(1)
            if not href.startswith("http"):
                html_local_css.add("/" + href if not href.startswith("/") else href)
        # Check: every local script in index.html should be in STATIC_ASSETS
        missing_in_sw = (html_local_scripts | html_local_css) - sw_assets
        if missing_in_sw:
            fail(f"sw.js STATIC_ASSETS missing {len(missing_in_sw)} file(s) from index.html:")
            for f in sorted(missing_in_sw):
                info(f"  {f}")
            errors += 1
        else:
            ok(f"sw.js STATIC_ASSETS covers all {len(html_local_scripts)} scripts + {len(html_local_css)} CSS from index.html")

    # 5h. SW STATIC_ASSETS file existence check
    if sw_assets:
        missing_files = []
        for asset in sorted(sw_assets):
            if asset == "/":
                continue
            fpath = ROOT / asset.lstrip("/")
            if not fpath.exists():
                missing_files.append(asset)
        if missing_files:
            fail(f"sw.js STATIC_ASSETS references {len(missing_files)} non-existent file(s):")
            for f in missing_files:
                info(f"  {f}")
            errors += 1
        else:
            ok(f"sw.js STATIC_ASSETS - all {len(sw_assets) - 1} files exist on disk")

    return errors, warnings


# =============================================================================
# CHECK 6 - JSON Pipeline Connectivity
# =============================================================================

# Canonical contract: appWorker.js fetch() targets → required keys → guards.
# Each tuple: (file_path, required_keys, sample_guard_field, is_array)
#   - required_keys: top-level keys (or dotted paths) that JS code accesses
#   - sample_guard_field: if set, FAIL when data[field] == "sample" or "error"
#   - is_array: if True, check keys against the last element of the array
PIPELINE_CONTRACT = [
    # ── appWorker.js: macro/derivatives pipeline (12 original) ──
    ("data/macro/macro_latest.json",                ["updated", "mcs", "vix", "bok_rate"],  None,      False),
    ("data/macro/bonds_latest.json",                ["updated"],                             None,      False),
    ("data/macro/kosis_latest.json",                ["updated", "source"],                   None,      False),
    ("data/macro/macro_composite.json",             ["mcsV2"],                               None,      False),
    ("data/vkospi.json",                            ["close", "time"],                       None,      True),
    ("data/derivatives/derivatives_summary.json",   ["time"],                                None,      True),
    ("data/derivatives/investor_summary.json",      ["date", "foreign_net_1d"],              "source",  False),
    ("data/derivatives/etf_summary.json",           ["date"],                                None,      False),
    ("data/derivatives/shortselling_summary.json",  ["date", "market_short_ratio"],          "source",  False),
    ("data/derivatives/basis_analysis.json",        ["basis", "basisPct"],                   None,      True),
    ("data/backtest/flow_signals.json",             ["stocks", "hmmRegimeLabel"],            "status",  False),
    ("data/derivatives/options_analytics.json",     [],                                      "status",  False),
    # ── P1-fix: 7 additional JS runtime data sources ──
    ("data/backtest/capm_beta.json",                ["stocks"],                              None,      False),
    ("data/backtest/eva_scores.json",               ["stocks"],                              None,      False),
    ("data/backtest/hmm_regimes.json",              ["daily"],                               None,      False),
    ("data/backtest/rl_policy.json",                ["thetas", "d"],                         None,      False),
    ("data/macro/ff3_factors.json",                 ["daily", "rf_daily"],                   None,      False),
    ("data/macro/bond_metrics.json",                ["benchmarks"],                          None,      False),
    ("data/sector_fundamentals.json",               ["sectors", "date"],                     None,      False),
    # ── Gap B: canonical OOS split config ──
    ("config/oos_split.json",                       ["cutoff_date", "oos_ratio"],             None,      False),
]

# Staleness threshold: WARN if data file not updated within this many days
PIPELINE_STALENESS_DAYS = 14


def _resolve_dotted_key(data, dotted_key):
    """Walk a dotted key path like 'analytics.straddleImpliedMove'."""
    parts = dotted_key.split(".")
    cur = data
    for part in parts:
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def _parse_date_field(data, field_candidates):
    """Try to parse a date from common field names. Returns date or None."""
    for field in field_candidates:
        val = data.get(field) if isinstance(data, dict) else None
        if not val or not isinstance(val, str):
            continue
        try:
            return date.fromisoformat(val[:10])
        except (ValueError, TypeError):
            continue
    return None


def check_pipeline(strict=False):
    section("CHECK 6 - JSON Pipeline Connectivity (19 data sources)")
    errors = 0
    warnings = 0

    for file_path, required_keys, guard_field, is_array in PIPELINE_CONTRACT:
        fpath = ROOT / file_path
        fname = file_path.split("/")[-1]

        # 6a. File exists
        if not fpath.exists():
            fail(f"{file_path} — file not found")
            errors += 1
            continue

        # 6b. Parse JSON
        try:
            raw = fpath.read_text(encoding="utf-8", errors="replace")
            data = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            fail(f"{fname} — JSON parse error: {e}")
            errors += 1
            continue

        # 6c. Array handling: check last element
        check_target = data
        if is_array:
            if not isinstance(data, list) or len(data) == 0:
                warn(f"{fname} — expected non-empty array, got {'empty array' if isinstance(data, list) else type(data).__name__}")
                warnings += 1
                continue
            check_target = data[-1]

        # 6d. Required keys present
        missing_keys = []
        for key in required_keys:
            if "." in key:
                if _resolve_dotted_key(check_target, key) is None:
                    missing_keys.append(key)
            elif not isinstance(check_target, dict) or key not in check_target:
                missing_keys.append(key)

        if missing_keys:
            fail(f"{fname} — missing required keys: {missing_keys}")
            errors += 1
        else:
            ok(f"{fname} — {len(required_keys)} required key(s) present")

        # [V6-FIX] P2-1: Validate required key values are not null/empty
        # Keys that exist but hold None, "", or [] indicate upstream data failures.
        # Numeric 0 is allowed for "bok_rate" (zero interest rate is valid) but not for
        # keys like "mcs", "vix" where 0 is economically implausible.
        _ALLOW_ZERO_KEYS = {"bok_rate", "rf_daily"}  # rates can legitimately be 0
        if isinstance(check_target, dict) and not missing_keys:
            null_keys = []
            for key in required_keys:
                if "." in key:
                    val = _resolve_dotted_key(check_target, key)
                else:
                    val = check_target.get(key)
                if val is None:
                    null_keys.append((key, "null"))
                elif val == "":
                    null_keys.append((key, "empty string"))
                elif isinstance(val, list) and len(val) == 0:
                    null_keys.append((key, "empty array"))
                elif isinstance(val, dict) and len(val) == 0:
                    null_keys.append((key, "empty object"))
                elif val == 0 and key not in _ALLOW_ZERO_KEYS:
                    # Numeric 0 for metrics like mcs/vix is suspect
                    null_keys.append((key, "zero (suspect)"))
            if null_keys:
                for key, reason in null_keys:
                    warn(f"{fname} — key '{key}' is {reason} (possible upstream failure)")
                warnings += len(null_keys)

        # 6e. Sample/error data guard
        if guard_field and isinstance(check_target, dict):
            guard_val = check_target.get(guard_field, "")
            if guard_val == "sample":
                fail(f"{fname} — {guard_field}='sample' (daily update has not run real data)")
                errors += 1
            elif guard_val == "error":
                fail(f"{fname} — {guard_field}='error' (upstream API failure)")
                errors += 1
            elif guard_val == "unavailable":
                warn(f"{fname} — {guard_field}='unavailable' (data source blocked, no alternative)")
                warnings += 1
            elif guard_val == "cached":
                pass  # cached real data is acceptable

        # 6f. Staleness check
        if isinstance(check_target, dict):
            parsed_date = _parse_date_field(check_target, ["updated", "date", "generated", "time"])
            if parsed_date:
                age_days = (date.today() - parsed_date).days
                if age_days > PIPELINE_STALENESS_DAYS:
                    warn(f"{fname} — data is {age_days} days old (threshold: {PIPELINE_STALENESS_DAYS}d)")
                    warnings += 1

    # 6g. options_analytics.json nested key check
    opts_path = ROOT / "data/derivatives/options_analytics.json"
    if opts_path.exists():
        try:
            opts_data = json.loads(opts_path.read_text(encoding="utf-8", errors="replace"))
            if isinstance(opts_data, dict):
                implied_move = _resolve_dotted_key(opts_data, "analytics.straddleImpliedMove")
                if implied_move is None:
                    warn(f"options_analytics.json — analytics.straddleImpliedMove not found")
                    warnings += 1
                else:
                    ok(f"options_analytics.json — nested analytics keys present")
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass  # Already caught above

    # 6h. screenerWorker.js importScripts version sync
    screener_js = JS / "screenerWorker.js"
    index_html = ROOT / "index.html"
    if screener_js.exists() and index_html.exists():
        html_src = read(index_html)
        screener_src = read(screener_js)
        html_vers = {m.group(1): int(m.group(2))
                     for m in re.finditer(r'<script[^>]+src="js/([^"?]+\.js)\?v=(\d+)"', html_src)}
        screener_vers = {m.group(1): int(m.group(2))
                         for m in re.finditer(r"['\"]([^'\"?]+\.js)\?v=(\d+)['\"]", screener_src)}
        mismatches = []
        for fname_s, sv in screener_vers.items():
            hv = html_vers.get(fname_s)
            if hv is not None and hv != sv:
                mismatches.append((fname_s, hv, sv))
        if mismatches:
            for fname_s, hv, sv in mismatches:
                fail(f"Version mismatch: {fname_s} index.html ?v={hv} != screenerWorker.js ?v={sv}")
                errors += 1
        else:
            ok(f"screenerWorker.js <-> index.html ?v=N versions in sync")

    return errors, warnings


# =============================================================================
# CHECK 7 - Global Name Collisions
# =============================================================================

# Files that run in isolated Worker scope (not global namespace collision risk)
WORKER_FILES = {"analysisWorker.js", "screenerWorker.js"}

# Known intentional re-declarations (e.g., Worker-local copies)
COLLISION_WHITELIST = {
    "_VIX_PROXY",       # signalEngine.js Worker-safe copy of VIX_VKOSPI_PROXY
}


def _extract_top_level_decls(src):
    """Extract all top-level var/let/const/function/class names from JS source."""
    decls = set()
    for m in re.finditer(
        r"^(?:var|let|const|async\s+function|function|class)\s+(\w+)",
        src, re.MULTILINE
    ):
        decls.add(m.group(1))
    return decls


def check_globals_collision(strict=False):
    section("CHECK 7 - Global Name Collisions (19 files)")
    errors = 0
    warnings = 0

    # Collect declarations per file (main-thread files only)
    file_decls = {}
    for fname in LOAD_ORDER:
        if fname in WORKER_FILES:
            continue
        fpath = JS / fname
        if not fpath.exists():
            continue
        src = read(fpath)
        decls = _extract_top_level_decls(src)
        file_decls[fname] = decls

    # Find collisions: same name declared in 2+ files
    name_to_files = {}
    for fname, decls in file_decls.items():
        for d in decls:
            name_to_files.setdefault(d, []).append(fname)

    # Known exports are intentionally in one file — filter those out
    all_exports = set()
    for exports in FILE_EXPORTS.values():
        all_exports |= exports

    collisions = []
    for name, files in sorted(name_to_files.items()):
        if len(files) > 1 and name not in COLLISION_WHITELIST:
            collisions.append((name, files))

    if collisions:
        for name, files in collisions[:10]:
            if name in all_exports:
                warn(f"Global '{name}' declared in multiple files: {files} (exported — verify intentional)")
                warnings += 1
            else:
                fail(f"Global '{name}' collision: declared in {files}")
                errors += 1
        if len(collisions) > 10:
            info(f"... and {len(collisions) - 10} more collision(s)")
    else:
        ok(f"No global name collisions across {len(file_decls)} main-thread files")

    return errors, warnings


# =============================================================================
# CHECK 8 - Dead Global Exports
# =============================================================================

def check_dead_exports(strict=False):
    section("CHECK 8 - Dead Global Exports")
    errors = 0
    warnings = 0

    # Read all main-thread file sources
    all_sources = {}
    for fname in LOAD_ORDER:
        fpath = JS / fname
        if fpath.exists():
            all_sources[fname] = read(fpath)

    # Also check index.html for references
    index_src = ""
    if (ROOT / "index.html").exists():
        index_src = read(ROOT / "index.html")

    dead_count = 0
    for fname, exports in FILE_EXPORTS.items():
        for export_name in sorted(exports):
            # Check if any OTHER file references this export
            referenced = False
            for other_fname, other_src in all_sources.items():
                if other_fname == fname:
                    continue
                # Simple word-boundary check
                if re.search(r"\b" + re.escape(export_name) + r"\b", other_src):
                    referenced = True
                    break
            # Also check index.html
            if not referenced and re.search(r"\b" + re.escape(export_name) + r"\b", index_src):
                referenced = True
            # Also check Worker files (they importScripts some modules)
            if not referenced:
                for wf in WORKER_FILES:
                    wpath = JS / wf
                    if wpath.exists():
                        wsrc = read(wpath)
                        if re.search(r"\b" + re.escape(export_name) + r"\b", wsrc):
                            referenced = True
                            break
            if not referenced:
                warn(f"js/{fname}: '{export_name}' exported but never referenced by other files")
                warnings += 1
                dead_count += 1

    if dead_count == 0:
        total_exports = sum(len(v) for v in FILE_EXPORTS.values())
        ok(f"All {total_exports} exported globals are referenced by at least one other file")

    return errors, warnings


# =============================================================================
# CHECK 9 - Canvas Safety (save/restore balance + DPR setTransform)
# =============================================================================

CANVAS_FILES = [
    "patternRenderer.js", "signalRenderer.js", "financials.js",
    "drawingTools.js", "chart.js",
]


def check_canvas(strict=False):
    section("CHECK 9 - Canvas Safety (save/restore + DPR)")
    errors = 0
    warnings = 0

    for fname in CANVAS_FILES:
        fpath = JS / fname
        if not fpath.exists():
            continue
        src = read(fpath)
        lines = src.splitlines()

        # 9a. save/restore balance per file
        saves = len(re.findall(r"\.save\(\)", src))
        restores = len(re.findall(r"\.restore\(\)", src))
        if saves != restores:
            warn(f"{fname}: ctx.save()={saves} vs ctx.restore()={restores} (imbalanced by {abs(saves - restores)})")
            warnings += 1
        else:
            ok(f"{fname}: save/restore balanced ({saves} pairs)")

        # 9b. DPR safety: ctx.scale(dpr must be preceded by setTransform within 4 lines
        #     Standard pattern: setTransform → clearRect → scale(dpr)
        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if re.search(r"\.scale\(\s*dpr", stripped):
                # Look back up to 4 lines for setTransform
                found_transform = False
                for j in range(lineno - 2, max(0, lineno - 6), -1):
                    if "setTransform" in lines[j]:
                        found_transform = True
                        break
                if not found_transform:
                    fail(f"{fname} line {lineno}: ctx.scale(dpr) without preceding setTransform (within 4 lines)")
                    errors += 1

    return errors, warnings


# =============================================================================
# CHECK 11 - Bundle integrity (V48-SEC Phase 1)
# =============================================================================

def check_bundle_integrity(strict=False):
    section("CHECK 11 - Bundle Integrity (deploy.bundled/)")
    errors = 0
    warnings = 0

    bundled = ROOT / "deploy.bundled"
    if not bundled.exists():
        warn("deploy.bundled/ not found — run 'node scripts/build.mjs --minify --obfuscate' first")
        return errors, warnings + 1

    # 11a. manifest.json exists and is parseable
    manifest_path = bundled / "manifest.json"
    if not manifest_path.exists():
        fail("deploy.bundled/manifest.json missing")
        return errors + 1, warnings
    try:
        manifest = json.loads(read(manifest_path))
    except Exception as e:
        fail(f"manifest.json parse error: {e}")
        return errors + 1, warnings
    ok(f"manifest.json loaded (minify={manifest.get('minify')}, obfuscate={manifest.get('obfuscate')})")

    # 11b. Main and worker bundles referenced in manifest exist on disk
    for key in ("main", "worker"):
        entry = manifest.get(key) or {}
        rel = entry.get("file")
        if not rel:
            fail(f"manifest.{key}.file is missing")
            errors += 1
            continue
        path = bundled / rel
        if not path.exists():
            fail(f"manifest.{key} points at {rel} but that file is missing")
            errors += 1
        else:
            ok(f"{key} bundle present: {rel} ({entry.get('bytes', '?')} bytes)")

    # 11c. index.html references the main bundle (single script tag)
    index_path = bundled / "index.html"
    if index_path.exists():
        html = read(index_path)
        main_basename = (manifest.get("main") or {}).get("file", "")
        if main_basename and main_basename in html:
            ok(f"index.html references main bundle ({os.path.basename(main_basename)})")
        else:
            fail(f"index.html does NOT reference {main_basename}")
            errors += 1
        # No stale version-query references to raw js files.
        stale = re.findall(r'src="js/\w+\.js\?v=\d+"', html)
        if stale:
            fail(f"index.html still contains {len(stale)} pre-bundle <script src='js/*.js?v=N'> tags")
            errors += 1
    else:
        fail("deploy.bundled/index.html missing")
        errors += 1

    # 11d. sw.js STATIC_ASSETS references both bundles and CACHE_NAME is hash-bumped
    sw_path = bundled / "sw.js"
    if sw_path.exists():
        sw = read(sw_path)
        for key in ("main", "worker"):
            entry = manifest.get(key) or {}
            rel = entry.get("file", "")
            if rel and f"'/{rel}'" in sw:
                ok(f"sw.js STATIC_ASSETS contains /{rel}")
            else:
                fail(f"sw.js STATIC_ASSETS missing /{rel}")
                errors += 1
        cache_match = re.search(r"CACHE_NAME\s*=\s*['\"]cheesestock-v([a-f0-9]+)['\"]", sw)
        main_hash = (manifest.get("main") or {}).get("hash", "")
        if cache_match and main_hash and main_hash in cache_match.group(1):
            ok(f"sw.js CACHE_NAME bumped to hash {cache_match.group(1)}")
        else:
            warn(f"sw.js CACHE_NAME may be stale (expected hash prefix {main_hash})")
            warnings += 1
    else:
        fail("deploy.bundled/sw.js missing")
        errors += 1

    # 11e. analysisWorker.js importScripts -> worker bundle (rewritten version)
    aw_path = bundled / "js" / "analysisWorker.js"
    if aw_path.exists():
        aw = read(aw_path)
        worker_basename = os.path.basename((manifest.get("worker") or {}).get("file", ""))
        if worker_basename and worker_basename in aw:
            ok(f"analysisWorker.js importScripts references {worker_basename}")
        else:
            fail(f"analysisWorker.js does NOT reference worker bundle {worker_basename}")
            errors += 1
    else:
        warn("deploy.bundled/js/analysisWorker.js missing (build.mjs should have copied it)")
        warnings += 1

    # 11f. No source map leakage in deploy.bundled/
    for dirpath, _, filenames in os.walk(bundled):
        for fn in filenames:
            if fn.endswith(".map"):
                fail(f"Source map leaked in deploy.bundled/: {os.path.relpath(os.path.join(dirpath, fn), bundled)}")
                errors += 1

    # 11g. No raw js/*.js (other than workers) in deploy.bundled/js/
    js_dir = bundled / "js"
    if js_dir.exists():
        for fn in os.listdir(js_dir):
            if fn in ("analysisWorker.js", "screenerWorker.js"):
                continue
            if fn.endswith(".js") and not re.match(r"^(app|worker)\.[a-f0-9]{10}\.js$", fn):
                warn(f"Unexpected raw JS file in deploy.bundled/js/: {fn}")
                warnings += 1

    return errors, warnings


# =============================================================================
# CHECK 12 - V48-SEC Phase 1: IP JSON exclusion from deploy/
# =============================================================================

IP_PROTECTED_JSONS = [
    "data/backtest/calibrated_constants.json",
    "data/backtest/composite_calibration.json",
    "data/backtest/flow_signals.json",
    "data/backtest/hmm_regimes.json",
    "data/backtest/eva_scores.json",
]

IP_PAGES_FUNCTIONS = [
    "functions/_shared/origin.js",
    "functions/api/constants.js",
    "functions/api/flow.js",
    "functions/api/hmm.js",
    "functions/api/eva.js",
]


def check_ip_protection(strict=False):
    section("CHECK 12 - IP JSON Protection (V48-SEC Phase 1)")
    errors = 0
    warnings = 0

    # 12a. Source tree has the Pages Functions
    for rel in IP_PAGES_FUNCTIONS:
        p = ROOT / rel
        if not p.exists():
            fail(f"{rel} missing (Pages Function source)")
            errors += 1
        else:
            ok(f"Pages Function present: {rel}")

    # 12b. stage_deploy.py excludes all 5 IP JSONs from deploy/data/backtest/
    stage_src = read(ROOT / "scripts" / "stage_deploy.py")
    for rel in IP_PROTECTED_JSONS:
        basename = os.path.basename(rel)
        if basename not in stage_src:
            fail(f"stage_deploy.py EXCLUDE_EXACT missing {basename}")
            errors += 1
        else:
            ok(f"stage_deploy.py excludes {basename}")

    # 12c. deploy/ (if staged) has the 4 runtime IP JSONs under functions/_data/
    #      and does NOT have them under data/backtest/
    deploy = ROOT / "deploy"
    if deploy.exists():
        for rel in IP_PROTECTED_JSONS:
            p = deploy / rel
            if p.exists():
                fail(f"LEAK: deploy/{rel} present — IP file not excluded!")
                errors += 1
            else:
                ok(f"deploy/{rel} correctly excluded")
        # The 4 runtime files should be under functions/_data/
        for rel in IP_PROTECTED_JSONS[:1] + IP_PROTECTED_JSONS[2:]:  # skip composite_calibration
            basename = os.path.basename(rel)
            p = deploy / "functions" / "_data" / basename
            if not p.exists():
                warn(f"deploy/functions/_data/{basename} missing (run stage_deploy.py)")
                warnings += 1
            else:
                ok(f"deploy/functions/_data/{basename} present")
    else:
        warn("deploy/ not staged — run 'python scripts/stage_deploy.py' to verify exclusion")
        warnings += 1

    # 12d. Client fetch sites reference /api/* primary URL
    client_checks = [
        (JS / "backtester.js", "/api/constants"),
        (JS / "backtester.js", "/api/hmm"),
        (JS / "appWorker.js", "/api/flow"),
        (JS / "appWorker.js", "/api/eva"),
        (JS / "financials.js", "/api/eva"),
    ]
    for path, endpoint in client_checks:
        if not path.exists():
            fail(f"{path.name} missing")
            errors += 1
            continue
        src = read(path)
        if endpoint in src:
            ok(f"{path.name} uses {endpoint}")
        else:
            fail(f"{path.name} does NOT use {endpoint}")
            errors += 1

    return errors, warnings


# =============================================================================
# CHECK 13 - Server Endpoints (V48-SEC Phase 2)
# =============================================================================

PHASE2_ENDPOINTS = [
    "functions/api/confidence/macro.js",
    "functions/api/confidence/phase8.js",
    "functions/api/backtest/analyze.js",
]

PHASE2_CLIENT_FETCHES = [
    (JS / "appWorker.js",  "/api/confidence/macro",  "_fetchMacroConfidence"),
    (JS / "appWorker.js",  "/api/confidence/phase8", "_fetchPhase8Confidence"),
    (JS / "backtester.js", "/api/backtest/analyze",  "backtestAllServerFirst"),
    (JS / "analysisWorker.js", "backtestAllServerFirst", None),
]


def check_server_endpoints(strict=False):
    section("CHECK 13 - Server Endpoints (V48-SEC Phase 2)")
    errors = 0
    warnings = 0

    # 13a. Endpoint files exist and call guardRequest + return jsonResponse
    for rel in PHASE2_ENDPOINTS:
        p = ROOT / rel
        if not p.exists():
            fail(f"{rel} missing (Phase 2 endpoint)")
            errors += 1
            continue
        src = read(p)
        if "guardRequest(request)" not in src:
            fail(f"{rel} does not call guardRequest(request)")
            errors += 1
        else:
            ok(f"{rel} calls guardRequest")
        if "jsonResponse(" not in src:
            fail(f"{rel} does not call jsonResponse()")
            errors += 1
        else:
            ok(f"{rel} returns jsonResponse")
        if "Cache-Control" not in src or "no-store" not in src:
            warn(f"{rel} does not set Cache-Control: no-store at function level")
            warnings += 1

    # 13b. macro_tables shared lib exists
    lib = ROOT / "functions" / "_lib" / "macro_tables.mjs"
    if not lib.exists():
        fail("functions/_lib/macro_tables.mjs missing (server-side helpers)")
        errors += 1
    else:
        ok("functions/_lib/macro_tables.mjs present")

    # 13c. Client-side wrappers and fetch sites
    for entry in PHASE2_CLIENT_FETCHES:
        path, needle, alt = entry
        if not path.exists():
            fail(f"{path.name} missing")
            errors += 1
            continue
        src = read(path)
        if needle in src:
            ok(f"{path.name} references {needle}")
        else:
            fail(f"{path.name} does NOT reference {needle}")
            errors += 1
        if alt and alt not in src:
            fail(f"{path.name} missing wrapper {alt}")
            errors += 1

    # 13d. _headers has /api/* no-store
    headers = ROOT / "_headers"
    if headers.exists():
        h = read(headers)
        if "/api/*" in h and "no-store" in h:
            ok("_headers sets /api/* no-store at edge")
        else:
            warn("_headers may be missing /api/* no-store directive")
            warnings += 1
    else:
        warn("_headers file not found")
        warnings += 1

    return errors, warnings


# =============================================================================
# CHECK 14 - V48-Phase2.5 Client Cleanup (fallback-body removal + SW orphan)
# =============================================================================

def check_phase25_cleanup(strict=False):
    section("CHECK 14 - V48-Phase2.5 Client Cleanup")
    errors = 0
    warnings = 0

    app_worker_path = JS / "appWorker.js"
    backtester_path = JS / "backtester.js"
    sw_path         = ROOT / "sw.js"

    if not app_worker_path.exists() or not backtester_path.exists() or not sw_path.exists():
        fail("required source files missing (appWorker.js / backtester.js / sw.js)")
        return 1, 0

    app_worker = read(app_worker_path)
    backtester = read(backtester_path)
    sw = read(sw_path)

    # 14a. _applyMacroConfidenceToPatterns body must be throw-only
    m = re.search(
        r"function\s+_applyMacroConfidenceToPatterns\s*\([^)]*\)\s*\{([^}]*)\}",
        app_worker, re.DOTALL
    )
    if not m:
        fail("_applyMacroConfidenceToPatterns definition not found")
        errors += 1
    else:
        body = m.group(1).strip()
        non_empty = [ln for ln in body.splitlines() if ln.strip() and not ln.strip().startswith("//")]
        if len(non_empty) > 2:
            fail(f"_applyMacroConfidenceToPatterns body has {len(non_empty)} non-comment lines (expected 1-2)")
            errors += 1
        elif "throw new Error('[V48-Phase2.5] removed" not in body:
            fail("_applyMacroConfidenceToPatterns does not throw the V48-Phase2.5 stub")
            errors += 1
        else:
            ok("_applyMacroConfidenceToPatterns body is throw-only")

    # 14b. _applyPhase8ConfidenceToPatterns body must be throw-only
    m = re.search(
        r"function\s+_applyPhase8ConfidenceToPatterns\s*\([^)]*\)\s*\{([^}]*)\}",
        app_worker, re.DOTALL
    )
    if not m:
        fail("_applyPhase8ConfidenceToPatterns definition not found")
        errors += 1
    else:
        body = m.group(1).strip()
        non_empty = [ln for ln in body.splitlines() if ln.strip() and not ln.strip().startswith("//")]
        if len(non_empty) > 2:
            fail(f"_applyPhase8ConfidenceToPatterns body has {len(non_empty)} non-comment lines (expected 1-2)")
            errors += 1
        elif "throw new Error('[V48-Phase2.5] removed" not in body:
            fail("_applyPhase8ConfidenceToPatterns does not throw the V48-Phase2.5 stub")
            errors += 1
        else:
            ok("_applyPhase8ConfidenceToPatterns body is throw-only")

    # 14c. backtester.js must not contain KRX cost constants or cost helpers
    # Allow comment-only mentions. Strip // line comments and /* block */ comments first.
    bt_noblock = re.sub(r"/\*.*?\*/", "", backtester, flags=re.DOTALL)
    bt_noline  = re.sub(r"//[^\n]*", "", bt_noblock)
    forbidden  = ["KRX_COMMISSION", "KRX_TAX", "KRX_SLIPPAGE",
                  "_horizonCost", "_getAdaptiveSlippage"]
    for tok in forbidden:
        hits = bt_noline.count(tok)
        if hits > 0:
            fail(f"backtester.js still contains '{tok}' ({hits} live refs)")
            errors += 1
        else:
            ok(f"backtester.js: no live references to {tok}")

    # 14d. fetch wrappers must not end with client fallback calls
    # Look for any line that invokes _applyMacroConfidenceToPatterns(...) outside
    # of the function definition itself. Same for phase8.
    bad_macro = re.findall(
        r"^\s*_applyMacroConfidenceToPatterns\s*\(",
        app_worker, re.MULTILINE
    )
    # "bad_macro" includes both the definition and any callers. Subtract 0 for
    # definition (it is matched as 'function _applyMacro...' not as call). If
    # count > 0, we have direct callers.
    direct_macro_calls = len(bad_macro)
    if direct_macro_calls > 0:
        fail(f"appWorker.js has {direct_macro_calls} direct _applyMacroConfidenceToPatterns(...) call(s) — should route through _fetchMacroConfidence")
        errors += 1
    else:
        ok("appWorker.js: no direct _applyMacroConfidenceToPatterns calls remain")

    bad_phase8 = re.findall(
        r"^\s*_applyPhase8ConfidenceToPatterns\s*\(",
        app_worker, re.MULTILINE
    )
    direct_phase8_calls = len(bad_phase8)
    if direct_phase8_calls > 0:
        fail(f"appWorker.js has {direct_phase8_calls} direct _applyPhase8ConfidenceToPatterns(...) call(s) — should route through _fetchPhase8Confidence")
        errors += 1
    else:
        ok("appWorker.js: no direct _applyPhase8ConfidenceToPatterns calls remain")

    # 14e. backtestAllServerFirst must not reference clientResult = this.backtestAll at top
    if "var clientResult = this.backtestAll(candles, stockCode);\n    try {" in backtester:
        fail("backtester.backtestAllServerFirst still pre-computes clientResult before server fetch")
        errors += 1
    else:
        ok("backtester.backtestAllServerFirst: no unconditional client fallback pre-computation")

    # 14f. SW install handler must contain orphan removal logic
    if "validUrls" in sw and "cache.delete(req)" in sw:
        ok("sw.js install handler performs orphan cleanup")
    else:
        fail("sw.js install handler missing orphan cleanup logic")
        errors += 1

    # 14g. SW activate handler must postMessage sw-updated
    if "sw-updated" in sw:
        ok("sw.js activate handler posts sw-updated message")
    else:
        warn("sw.js activate handler does not postMessage sw-updated")
        warnings += 1

    # 14h. CACHE_NAME must be cheesestock-v82 or higher
    cm = re.search(r"CACHE_NAME\s*=\s*['\"]cheesestock-v(\d+)['\"]", sw)
    if cm:
        v = int(cm.group(1))
        if v < 82:
            fail(f"sw.js CACHE_NAME is cheesestock-v{v} (expected v82+ for Phase 2.5)")
            errors += 1
        else:
            ok(f"sw.js CACHE_NAME = cheesestock-v{v} (Phase 2.5 compliant)")
    else:
        warn("sw.js CACHE_NAME pattern not detected")
        warnings += 1

    # 14i. appState.js dead constants removed
    app_state = read(JS / "appState.js")
    as_noblock = re.sub(r"/\*.*?\*/", "", app_state, flags=re.DOTALL)
    as_noline  = re.sub(r"//[^\n]*", "", as_noblock)
    for tok in ["_STOVALL_CYCLE", "_RATE_BETA", "MCS_THRESHOLDS", "REGIME_CONFIDENCE_MULT"]:
        if tok in as_noline:
            fail(f"appState.js still contains live '{tok}' definition")
            errors += 1
        else:
            ok(f"appState.js: no live '{tok}' definition")

    return errors, warnings


# =============================================================================
# CHECK 10 - Backtest Acceptance Criteria (7 criteria)
# =============================================================================

def _resolve_nested(data, key_path):
    """Resolve a dot-separated key path in nested dicts. Returns None if any segment missing."""
    parts = key_path.split(".")
    cur = data
    for p in parts:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def check_criteria(strict=False):
    section("CHECK 10 - Backtest Acceptance Criteria (7 criteria)")
    errors = 0
    warnings = 0

    # --- Load data files ---
    agg_path = ROOT / "data" / "backtest" / "aggregate_stats.json"
    tva_path = ROOT / "data" / "backtest" / "theory_vs_actual.json"
    cal_path = ROOT / "data" / "backtest" / "calibrated_constants.json"
    oos_path = ROOT / "data" / "backtest" / "pattern_winrates_oos.json"

    agg_data = None
    tva_data = None
    cal_data = None
    oos_data = None

    for label, fpath, target_name in [
        ("aggregate_stats.json",       agg_path, "agg_data"),
        ("theory_vs_actual.json",      tva_path, "tva_data"),
        ("calibrated_constants.json",  cal_path, "cal_data"),
        ("pattern_winrates_oos.json",  oos_path, "oos_data"),
    ]:
        if not fpath.exists():
            fail(f"{label} -- file not found")
            errors += 1
            continue
        try:
            raw = fpath.read_text(encoding="utf-8", errors="replace")
            parsed = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            fail(f"{label} -- JSON parse error: {e}")
            errors += 1
            continue
        if target_name == "agg_data":
            agg_data = parsed
        elif target_name == "tva_data":
            tva_data = parsed
        elif target_name == "cal_data":
            cal_data = parsed
        elif target_name == "oos_data":
            oos_data = parsed

    if not cal_data:
        fail("calibrated_constants.json is required for criteria check -- cannot proceed")
        return errors + 1, warnings

    # =========================================================================
    # Criterion 1: direction_accuracy >= 0.52
    # Source: calibrated_constants.json -> C2_conf_L.overall_direction_accuracy
    # =========================================================================
    dir_acc = _resolve_nested(cal_data, "C2_conf_L.overall_direction_accuracy")
    if dir_acc is None:
        warn("Criterion 1 (direction_accuracy): field C2_conf_L.overall_direction_accuracy not found")
        warnings += 1
    elif dir_acc >= 0.52:
        ok(f"Criterion 1: direction_accuracy = {dir_acc:.4f} >= 0.52")
    else:
        warn(f"Criterion 1: direction_accuracy = {dir_acc:.4f} < 0.52")
        warnings += 1

    # =========================================================================
    # Criterion 2: IC > 0 (Information Coefficient)
    # Source: calibrated_constants.json -> oos_validation.oos_ic
    # =========================================================================
    ic_val = _resolve_nested(cal_data, "oos_validation.oos_ic")
    if ic_val is None:
        warn("Criterion 2 (IC > 0): field oos_validation.oos_ic not found")
        warnings += 1
    elif ic_val > 0:
        ok(f"Criterion 2: IC = {ic_val:.6f} > 0")
    else:
        warn(f"Criterion 2: IC = {ic_val:.6f} <= 0")
        warnings += 1

    # =========================================================================
    # Criterion 3: b_confidence significant
    # Source: calibrated_constants.json -> C2_conf_L.b_conf_CI_95
    #   If 95% CI excludes 0, coefficient is significant at p < 0.05.
    #   Also check logistic_coeffs.b_confidence for existence.
    # =========================================================================
    b_conf = _resolve_nested(cal_data, "C2_conf_L.logistic_coeffs.b_confidence")
    b_conf_ci = _resolve_nested(cal_data, "C2_conf_L.b_conf_CI_95")

    if b_conf is None:
        warn("Criterion 3 (b_confidence): field C2_conf_L.logistic_coeffs.b_confidence not found")
        warnings += 1
    elif b_conf_ci is None:
        warn("Criterion 3 (b_confidence): field C2_conf_L.b_conf_CI_95 not found (cannot check significance)")
        warnings += 1
    elif isinstance(b_conf_ci, list) and len(b_conf_ci) == 2:
        ci_lo, ci_hi = b_conf_ci
        # Significant if 95% CI does not include 0
        if ci_lo > 0 or ci_hi < 0:
            ok(f"Criterion 3: b_confidence = {b_conf:.4f}, 95% CI [{ci_lo:.4f}, {ci_hi:.4f}] excludes 0 (significant)")
        else:
            warn(f"Criterion 3: b_confidence = {b_conf:.4f}, 95% CI [{ci_lo:.4f}, {ci_hi:.4f}] includes 0 (not significant)")
            warnings += 1
    else:
        warn(f"Criterion 3 (b_confidence): b_conf_CI_95 has unexpected format: {b_conf_ci}")
        warnings += 1

    # =========================================================================
    # Criterion 4: OOS WR > 50%
    # Source: calibrated_constants.json -> oos_validation.oos_wr
    # Fallback: pattern_winrates_oos.json -> grand_mean_candle_oos / grand_mean_chart_oos
    # =========================================================================
    oos_wr = _resolve_nested(cal_data, "oos_validation.oos_wr")
    oos_wr_source = "calibrated_constants.json -> oos_validation.oos_wr"

    if oos_wr is None and oos_data:
        # Fallback: use grand means from pattern_winrates_oos.json
        candle_oos = oos_data.get("grand_mean_candle_oos")
        chart_oos = oos_data.get("grand_mean_chart_oos")
        if candle_oos is not None and chart_oos is not None:
            oos_wr = (candle_oos + chart_oos) / 2.0
            oos_wr_source = "pattern_winrates_oos.json -> avg(candle_oos, chart_oos)"

    if oos_wr is None:
        warn("Criterion 4 (OOS WR > 50%): no OOS win rate field found")
        warnings += 1
    elif oos_wr > 50.0:
        ok(f"Criterion 4: OOS WR = {oos_wr:.2f}% > 50% (source: {oos_wr_source})")
    else:
        warn(f"Criterion 4: OOS WR = {oos_wr:.2f}% <= 50% (source: {oos_wr_source})")
        warnings += 1

    # =========================================================================
    # Criterion 5: cascade_range < 3
    # Interpretation: count of calibration dimensions that changed.
    # A cascade_range >= 3 means too many parameters shifted simultaneously,
    # risking overfitting. Source: calibrated_constants.json dimension sections.
    # =========================================================================
    # Check for explicit field first
    cascade_val = cal_data.get("cascade_range")
    if cascade_val is not None:
        if cascade_val < 3:
            ok(f"Criterion 5: cascade_range = {cascade_val} < 3")
        else:
            warn(f"Criterion 5: cascade_range = {cascade_val} >= 3")
            warnings += 1
    else:
        # Derive: count calibration sections with "changed": true
        dim_sections = ["C1_rr_thresholds", "C2_conf_L", "D1_candle_target_atr",
                        "D2_sell_hw_inversion", "D3_rr_penalty"]
        n_changed = 0
        for dim in dim_sections:
            if isinstance(cal_data.get(dim), dict) and cal_data[dim].get("changed") is True:
                n_changed += 1
        if n_changed < 3:
            ok(f"Criterion 5: cascade_range (derived) = {n_changed} < 3 ({n_changed}/{len(dim_sections)} dims changed)")
        else:
            warn(f"Criterion 5: cascade_range (derived) = {n_changed} >= 3 ({n_changed}/{len(dim_sections)} dims changed)")
            warnings += 1

    # =========================================================================
    # Criterion 6: calibrator changed == false
    # At least the core confidence formula (C2_conf_L) should be stable.
    # Source: calibrated_constants.json -> C2_conf_L.changed
    # =========================================================================
    cal_changed = _resolve_nested(cal_data, "C2_conf_L.changed")
    if cal_changed is None:
        warn("Criterion 6 (calibrator changed): field C2_conf_L.changed not found")
        warnings += 1
    elif cal_changed is False:
        ok("Criterion 6: calibrator changed = false (confidence formula stable)")
    else:
        warn(f"Criterion 6: calibrator changed = {cal_changed} (confidence formula was recalibrated)")
        warnings += 1

    # =========================================================================
    # Criterion 7: direction_accuracy improvement >= 0
    # Baseline: 0.50 (random). Improvement = actual - baseline.
    # Source: calibrated_constants.json -> C2_conf_L.overall_direction_accuracy
    # =========================================================================
    BASELINE_ACCURACY = 0.50
    if dir_acc is not None:
        improvement = dir_acc - BASELINE_ACCURACY
        if improvement >= 0:
            ok(f"Criterion 7: direction_accuracy improvement = {improvement:+.4f} >= 0 (vs baseline {BASELINE_ACCURACY})")
        else:
            warn(f"Criterion 7: direction_accuracy improvement = {improvement:+.4f} < 0 (vs baseline {BASELINE_ACCURACY})")
            warnings += 1
    else:
        warn("Criterion 7 (direction_accuracy improvement): direction_accuracy not available (see Criterion 1)")
        warnings += 1

    # --- Summary ---
    n_pass = 7 - errors - warnings
    info(f"")
    n_criteria_warn = warnings  # criteria threshold misses (data quality, not code defects)
    info(f"Criteria summary: {n_pass} PASS, {n_criteria_warn} below threshold, {errors} data errors out of 7")

    return errors, warnings


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="CheeseStock pre-deploy verifier")
    parser.add_argument(
        "--check",
        choices=["patterns", "colors", "dashes", "globals", "scripts", "pipeline",
                 "collision", "dead_exports", "canvas", "criteria",
                 "bundle", "ip", "server", "phase25", "all"],
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
        "patterns":      check_patterns,
        "colors":        check_colors,
        "dashes":        check_dashes,
        "globals":       check_globals,
        "scripts":       check_scripts,
        "pipeline":      check_pipeline,
        "collision":     check_globals_collision,
        "dead_exports":  check_dead_exports,
        "canvas":        check_canvas,
        "criteria":      check_criteria,
        "bundle":        check_bundle_integrity,
        "ip":            check_ip_protection,
        "server":        check_server_endpoints,
        "phase25":       check_phase25_cleanup,
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
