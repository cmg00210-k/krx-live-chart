#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Core Data Corpus Integrity Verifier
=====================================
core_data/ 학술 문서 (Doc 01~47) 무결성 검증.

5가지 검증:
  1. Existence     — 기대 파일 47개 존재 여부
  2. Line count    — 각 문서 >= 100줄 (stub/빈 파일 탐지)
  3. Cross-refs    — "Doc XX" / "Doc XX §Y" 참조 대상 존재 확인
  4. README sync   — core_data/README.md 테이블 ↔ 실제 파일 비교
  5. Dup formulas  — 동일 수식 블록 2+ 문서에서 중복 경고

Usage:
  python scripts/verify_corpus.py              # 전체 검증
  python scripts/verify_corpus.py --verbose    # 상세 출력
"""

import re
import sys
import io
import argparse
from pathlib import Path
from collections import defaultdict

# Force UTF-8 output on Windows (avoids cp949 UnicodeEncodeError)
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
CORE = ROOT / "core_data"

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


# ---- Expected document catalog -----------------------------------------------
# (doc_id, filename) — doc_id is the string used in cross-refs ("11B", "42", etc.)
EXPECTED_DOCS = [
    ("01",  "01_mathematics.md"),
    ("02",  "02_statistics.md"),
    ("03",  "03_physics.md"),
    ("04",  "04_psychology.md"),
    ("05",  "05_finance_theory.md"),
    ("06",  "06_technical_analysis.md"),
    ("07",  "07_pattern_algorithms.md"),
    ("08",  "08_references.md"),
    ("09",  "09_game_theory.md"),
    ("10",  "10_optimal_control.md"),
    ("11",  "11_reinforcement_learning.md"),
    ("11B", "11B_rl_advanced.md"),
    ("12",  "12_extreme_value_theory.md"),
    ("13",  "13_information_geometry.md"),
    ("14",  "14_finance_management.md"),
    ("15",  "15_advanced_patterns.md"),
    ("16",  "16_pattern_reference.md"),
    ("17",  "17_regression_backtesting.md"),
    ("18",  "18_behavioral_market_microstructure.md"),
    ("19",  "19_social_network_effects.md"),
    ("20",  "20_krx_structural_anomalies.md"),
    ("21",  "21_adaptive_pattern_modeling.md"),
    ("22",  "22_learnable_constants_guide.md"),
    ("23",  "23_apt_factor_model.md"),
    ("24",  "24_behavioral_quantification.md"),
    ("25",  "25_capm_delta_covariance.md"),
    ("26",  "26_options_volatility_signals.md"),
    ("27",  "27_futures_basis_program_trading.md"),
    ("28",  "28_cross_market_correlation.md"),
    ("29",  "29_macro_sector_rotation.md"),
    ("30",  "30_macroeconomics_islm_adas.md"),
    ("31",  "31_microeconomics_market_signals.md"),
    ("32",  "32_search_attention_pricing.md"),
    ("33",  "33_agency_costs_industry_concentration.md"),
    ("34",  "34_volatility_risk_premium_harv.md"),
    ("35",  "35_bond_signals_yield_curve.md"),
    ("36",  "36_futures_microstructure_oi.md"),
    ("37",  "37_options_iv_surface_skew.md"),
    ("38",  "38_etf_ecosystem_fund_flow.md"),
    ("39",  "39_investor_flow_information.md"),
    ("40",  "40_short_selling_securities_lending.md"),
    ("41",  "41_bond_equity_relative_value.md"),
    ("42",  "42_advanced_asset_pricing.md"),
    ("43",  "43_corporate_finance_advanced.md"),
    ("44",  "44_bond_pricing_duration.md"),
    ("45",  "45_options_pricing_advanced.md"),
    ("46",  "46_options_strategies.md"),
    ("47",  "47_credit_risk_models.md"),
]

# Valid doc IDs for cross-reference resolution
VALID_DOC_IDS = {doc_id for doc_id, _ in EXPECTED_DOCS}

MIN_LINES = 100


def _normalize_doc_id(raw_id):
    """Normalize doc ID: '1' -> '01', '9' -> '09', '11B' -> '11B', '42' -> '42'."""
    m = re.match(r'^(\d+)([A-Z]?)$', raw_id)
    if not m:
        return raw_id
    num_part = m.group(1).zfill(2)
    return num_part + m.group(2)


# ---- Helpers -----------------------------------------------------------------

def read(path):
    """Read file as UTF-8, replacing undecodable bytes."""
    return path.read_text(encoding="utf-8", errors="replace")


def section(title):
    print(f"\n{BOLD}{CYAN}{'=' * 62}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 62}{RESET}")


def ok(msg):
    print(f"  {GREEN}PASS{RESET}  {msg}")


def warn(msg):
    print(f"  {YELLOW}WARN{RESET}  {msg}")


def fail(msg):
    print(f"  {RED}FAIL{RESET}  {msg}")


def info(msg):
    print(f"        {msg}")


# =============================================================================
# CHECK 1 — File Existence
# =============================================================================

def check_existence(verbose=False):
    section("CHECK 1 - File Existence (47 expected documents)")
    errors = 0
    warnings = 0

    present = []
    missing = []

    for doc_id, fname in EXPECTED_DOCS:
        fpath = CORE / fname
        if fpath.exists():
            present.append((doc_id, fname))
        else:
            missing.append((doc_id, fname))

    if missing:
        fail(f"{len(missing)} document(s) missing:")
        for doc_id, fname in missing:
            info(f"Doc {doc_id}: {fname}")
        errors += len(missing)
    else:
        ok(f"All {len(EXPECTED_DOCS)} documents present")

    # Also check for unexpected .md files in core_data/ (excluding README.md)
    expected_fnames = {fname for _, fname in EXPECTED_DOCS}
    expected_fnames.add("README.md")
    actual_fnames = {f.name for f in CORE.glob("*.md")}
    unexpected = actual_fnames - expected_fnames
    if unexpected:
        warn(f"{len(unexpected)} unexpected .md file(s) in core_data/:")
        for fname in sorted(unexpected):
            info(fname)
        warnings += len(unexpected)
    elif verbose:
        ok("No unexpected .md files in core_data/")

    return errors, warnings


# =============================================================================
# CHECK 2 — Minimum Line Count
# =============================================================================

def check_line_counts(verbose=False):
    section(f"CHECK 2 - Minimum Line Count (>= {MIN_LINES} lines each)")
    errors = 0
    warnings = 0

    stubs = []
    counts = {}

    for doc_id, fname in EXPECTED_DOCS:
        fpath = CORE / fname
        if not fpath.exists():
            continue
        line_count = len(read(fpath).splitlines())
        counts[(doc_id, fname)] = line_count
        if line_count < MIN_LINES:
            stubs.append((doc_id, fname, line_count))

    if stubs:
        fail(f"{len(stubs)} document(s) below {MIN_LINES} lines (stub/empty):")
        for doc_id, fname, lc in stubs:
            info(f"Doc {doc_id}: {fname} ({lc} lines)")
        errors += len(stubs)
    else:
        ok(f"All existing documents >= {MIN_LINES} lines")

    if verbose:
        # Show top 5 shortest
        sorted_counts = sorted(counts.items(), key=lambda x: x[1])
        info("Shortest documents:")
        for (doc_id, fname), lc in sorted_counts[:5]:
            info(f"  Doc {doc_id}: {lc} lines")

    return errors, warnings


# =============================================================================
# CHECK 3 — Cross-Reference Integrity
# =============================================================================

# Pattern: "Doc XX" or "Doc XX §..." where XX is 1-2 digits optionally followed by a letter
# Avoid matching inside code blocks or URLs
XREF_PATTERN = re.compile(r'\bDoc\s+(\d{1,2}[A-Z]?)\b')


def check_cross_refs(verbose=False):
    section("CHECK 3 - Cross-Reference Integrity")
    errors = 0
    warnings = 0

    # Collect all existing doc IDs from files actually on disk (normalized)
    existing_ids = set()
    for doc_id, fname in EXPECTED_DOCS:
        if (CORE / fname).exists():
            existing_ids.add(doc_id)

    broken_refs = []   # (source_file, line_no, referenced_id)
    ref_counts = defaultdict(int)
    total_refs = 0

    for doc_id, fname in EXPECTED_DOCS:
        fpath = CORE / fname
        if not fpath.exists():
            continue
        lines = read(fpath).splitlines()
        in_code_block = False
        for lineno, line in enumerate(lines, 1):
            # Track fenced code blocks
            stripped = line.strip()
            if stripped.startswith("```"):
                in_code_block = not in_code_block
                continue
            if in_code_block:
                continue

            for m in XREF_PATTERN.finditer(line):
                raw_id = m.group(1)
                ref_id = _normalize_doc_id(raw_id)
                total_refs += 1
                ref_counts[ref_id] += 1

                # Self-reference is allowed (doc title lines like "# Doc 42: ...")
                if ref_id == doc_id:
                    continue

                if ref_id not in existing_ids:
                    broken_refs.append((fname, lineno, ref_id))

    if broken_refs:
        fail(f"{len(broken_refs)} broken cross-reference(s):")
        # Group by referenced doc ID
        by_target = defaultdict(list)
        for src, lineno, ref_id in broken_refs:
            by_target[ref_id].append((src, lineno))
        for ref_id in sorted(by_target, key=lambda x: int(re.match(r'\d+', x).group())):
            sources = by_target[ref_id]
            info(f"Doc {ref_id} (missing) referenced from:")
            for src, lineno in sources[:5]:
                info(f"    {src}:{lineno}")
            if len(sources) > 5:
                info(f"    ... and {len(sources) - 5} more")
        errors += 1
    else:
        ok("All cross-references resolve to existing documents")

    ok(f"Total cross-references found: {total_refs}")

    if verbose:
        # Show most-referenced docs
        top = sorted(ref_counts.items(), key=lambda x: -x[1])[:10]
        info("Most referenced documents:")
        for ref_id, count in top:
            info(f"  Doc {ref_id}: {count} references")

    return errors, warnings


# =============================================================================
# CHECK 4 — README.md Consistency
# =============================================================================

# Parse table rows like: | 42 | [42_advanced_asset_pricing.md](...) | ...
README_ROW_PATTERN = re.compile(
    r'^\|\s*(\d{1,2}[A-Z]?)\s*\|\s*\[([^\]]+\.md)\]'
)


def check_readme_sync(verbose=False):
    section("CHECK 4 - README.md Consistency")
    errors = 0
    warnings = 0

    readme_path = CORE / "README.md"
    if not readme_path.exists():
        fail("core_data/README.md not found")
        return 1, 0

    readme_src = read(readme_path)
    readme_entries = {}  # doc_id (normalized) -> filename from README table

    for line in readme_src.splitlines():
        m = README_ROW_PATTERN.match(line.strip())
        if m:
            doc_id = _normalize_doc_id(m.group(1))
            fname = m.group(2)
            readme_entries[doc_id] = fname

    # Compare README entries with expected catalog
    expected_map = {doc_id: fname for doc_id, fname in EXPECTED_DOCS}

    # Docs in expected catalog but missing from README
    missing_from_readme = []
    for doc_id, fname in EXPECTED_DOCS:
        if doc_id not in readme_entries:
            missing_from_readme.append((doc_id, fname))

    # Docs in README but not in expected catalog
    extra_in_readme = []
    for doc_id, fname in readme_entries.items():
        if doc_id not in expected_map:
            extra_in_readme.append((doc_id, fname))

    # Filename mismatches
    name_mismatches = []
    for doc_id in readme_entries:
        if doc_id in expected_map and readme_entries[doc_id] != expected_map[doc_id]:
            name_mismatches.append((doc_id, expected_map[doc_id], readme_entries[doc_id]))

    # Compare README entries with actual files on disk
    actual_fnames = {f.name for f in CORE.glob("*.md") if f.name != "README.md"}
    readme_fnames = set(readme_entries.values())
    in_readme_not_on_disk = readme_fnames - actual_fnames
    on_disk_not_in_readme = actual_fnames - readme_fnames

    if missing_from_readme:
        fail(f"{len(missing_from_readme)} expected doc(s) missing from README table:")
        for doc_id, fname in missing_from_readme:
            info(f"Doc {doc_id}: {fname}")
        errors += 1

    if extra_in_readme:
        warn(f"{len(extra_in_readme)} README entry(ies) not in expected catalog:")
        for doc_id, fname in extra_in_readme:
            info(f"Doc {doc_id}: {fname}")
        warnings += 1

    if name_mismatches:
        fail(f"{len(name_mismatches)} filename mismatch(es) between catalog and README:")
        for doc_id, expected, actual in name_mismatches:
            info(f"Doc {doc_id}: expected '{expected}', README has '{actual}'")
        errors += 1

    if in_readme_not_on_disk:
        fail(f"{len(in_readme_not_on_disk)} file(s) listed in README but missing on disk:")
        for fname in sorted(in_readme_not_on_disk):
            info(fname)
        errors += 1

    if on_disk_not_in_readme:
        warn(f"{len(on_disk_not_in_readme)} file(s) on disk but not in README table:")
        for fname in sorted(on_disk_not_in_readme):
            info(fname)
        warnings += 1

    if not missing_from_readme and not name_mismatches and not in_readme_not_on_disk:
        ok(f"README table consistent ({len(readme_entries)} entries)")

    return errors, warnings


# =============================================================================
# CHECK 5 — Duplicate Formula Detection (warning only)
# =============================================================================

def _extract_formula_blocks(text):
    """Extract fenced code/math blocks with >= 2 non-empty lines.

    Returns list of (start_line, block_text) tuples.
    """
    blocks = []
    lines = text.splitlines()
    in_block = False
    block_start = 0
    block_lines = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("```"):
            if in_block:
                # End of block
                content = "\n".join(block_lines)
                non_empty = [l for l in block_lines if l.strip()]
                if len(non_empty) >= 2:
                    blocks.append((block_start + 1, content.strip()))
                block_lines = []
                in_block = False
            else:
                # Start of block
                in_block = True
                block_start = i + 1  # next line is the first content line
                block_lines = []
        elif in_block:
            block_lines.append(line)

    return blocks


def check_dup_formulas(verbose=False):
    section("CHECK 5 - Duplicate Formula Detection")
    errors = 0
    warnings = 0

    # Collect all formula blocks across all docs
    # Key: normalized block text -> list of (filename, line_no)
    formula_index = defaultdict(list)

    for doc_id, fname in EXPECTED_DOCS:
        fpath = CORE / fname
        if not fpath.exists():
            continue
        text = read(fpath)
        blocks = _extract_formula_blocks(text)
        for line_no, block_text in blocks:
            # Normalize: strip whitespace from each line, collapse multiple spaces
            normalized = "\n".join(l.strip() for l in block_text.splitlines() if l.strip())
            if len(normalized) < 20:
                # Too short to be meaningful formula
                continue
            formula_index[normalized].append((fname, line_no))

    # Find cross-file duplicates (same block in 2+ different files)
    duplicates = {}
    for block_text, locations in formula_index.items():
        unique_files = {fname for fname, _ in locations}
        if len(unique_files) >= 2:
            duplicates[block_text] = locations

    if duplicates:
        warn(f"{len(duplicates)} formula block(s) appear in 2+ documents:")
        shown = 0
        for block_text, locations in sorted(duplicates.items(), key=lambda x: -len(x[1])):
            if shown >= 10:
                info(f"... and {len(duplicates) - shown} more")
                break
            preview = block_text[:80].replace("\n", " | ")
            if len(block_text) > 80:
                preview += "..."
            info(f"  [{len(locations)} docs] \"{preview}\"")
            if verbose:
                for fname, line_no in locations:
                    info(f"      {fname}:{line_no}")
            shown += 1
        warnings += len(duplicates)
    else:
        ok("No duplicate formula blocks detected")

    total_blocks = sum(len(v) for v in formula_index.values())
    ok(f"Total formula blocks scanned: {total_blocks}")

    return errors, warnings


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Core Data corpus integrity verifier (47 academic documents)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed stats and listings"
    )
    args = parser.parse_args()

    total_errors = 0
    total_warnings = 0

    checks = [
        check_existence,
        check_line_counts,
        check_cross_refs,
        check_readme_sync,
        check_dup_formulas,
    ]

    for check_fn in checks:
        e, w = check_fn(verbose=args.verbose)
        total_errors += e
        total_warnings += w

    print(f"\n{BOLD}{'=' * 62}{RESET}")
    print(f"{BOLD}  SUMMARY{RESET}")
    print(f"{'=' * 62}")
    if total_errors == 0 and total_warnings == 0:
        print(f"  {GREEN}{BOLD}ALL CHECKS PASSED{RESET}")
    else:
        if total_errors > 0:
            print(f"  {RED}ERRORS:   {total_errors}{RESET}")
        if total_warnings > 0:
            print(f"  {YELLOW}WARNINGS: {total_warnings}{RESET}")
    print(f"{'=' * 62}\n")

    sys.exit(1 if total_errors > 0 else 0)


if __name__ == "__main__":
    main()
