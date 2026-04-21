"""Wrap bare Greek characters in MASTER.md with LaTeX math mode ($\name$).

Phase 8 P7-003 fix: MASTER.md prose contains bare Greek chars (σ, β, λ, Δ, Σ, ...)
that trigger `Missing $ inserted` when pandoc → xelatex. This script context-aware
replaces them with inline math form, preserving chars inside $...$, $$...$$, `...`,
and fenced ```...``` code blocks.

Idempotent: re-running on already-wrapped content is a no-op.

Usage:
    python scripts/fix_master_greek_for_latex.py                # dry-run
    python scripts/fix_master_greek_for_latex.py --apply        # write in place
    python scripts/fix_master_greek_for_latex.py --file PATH
"""
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path

GREEK_MAP = {
    'α': r'\alpha',  'β': r'\beta',   'γ': r'\gamma',  'δ': r'\delta',
    'ε': r'\epsilon','ζ': r'\zeta',   'η': r'\eta',    'θ': r'\theta',
    'ι': r'\iota',   'κ': r'\kappa',  'λ': r'\lambda', 'μ': r'\mu',
    'ν': r'\nu',     'ξ': r'\xi',     'π': r'\pi',     'ρ': r'\rho',
    'σ': r'\sigma',  'τ': r'\tau',    'υ': r'\upsilon','φ': r'\phi',
    'χ': r'\chi',    'ψ': r'\psi',    'ω': r'\omega',
    'Γ': r'\Gamma',  'Δ': r'\Delta',  'Θ': r'\Theta',  'Λ': r'\Lambda',
    'Ξ': r'\Xi',     'Π': r'\Pi',     'Σ': r'\Sigma',  'Υ': r'\Upsilon',
    'Φ': r'\Phi',    'Ψ': r'\Psi',    'Ω': r'\Omega',
    # Unicode combining/composed Greek
    'β̄': r'\bar{\beta}',  # beta with macron (L.861 β̄_U)
}

# ASCII fallback for Greek inside fenced code blocks (xelatex Highlighting env
# struggles with bare Greek). Word form preserves readability.
GREEK_ASCII = {
    'α': 'alpha', 'β': 'beta',  'γ': 'gamma', 'δ': 'delta',
    'ε': 'epsilon','ζ': 'zeta', 'η': 'eta',   'θ': 'theta',
    'ι': 'iota',  'κ': 'kappa', 'λ': 'lambda','μ': 'mu',
    'ν': 'nu',    'ξ': 'xi',    'π': 'pi',    'ρ': 'rho',
    'σ': 'sigma', 'τ': 'tau',   'υ': 'upsilon','φ': 'phi',
    'χ': 'chi',   'ψ': 'psi',   'ω': 'omega',
    'Γ': 'Gamma', 'Δ': 'Delta', 'Θ': 'Theta', 'Λ': 'Lambda',
    'Ξ': 'Xi',    'Π': 'Pi',    'Σ': 'Sigma', 'Υ': 'Upsilon',
    'Φ': 'Phi',   'Ψ': 'Psi',   'Ω': 'Omega',
}
GREEK_SET = set(GREEK_MAP.keys()) | set('αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΥΦΨΩ')


def find_protected_ranges(line: str) -> list[tuple[int, int]]:
    """Return [(start, end), ...] char ranges that are protected (math/code)."""
    ranges: list[tuple[int, int]] = []
    # Block math $$...$$ first
    for m in re.finditer(r'\$\$[^$]*\$\$', line):
        ranges.append((m.start(), m.end()))
    # Inline math $...$ (non-greedy, no newline)
    for m in re.finditer(r'\$[^$\n]+?\$', line):
        s, e = m.start(), m.end()
        if not any(rs <= s < re for rs, re_ in ranges for re in [re_]):
            ranges.append((s, e))
    # Code spans `...`
    for m in re.finditer(r'`[^`\n]+?`', line):
        s, e = m.start(), m.end()
        if not any(rs <= s < re for rs, re_ in ranges for re in [re_]):
            ranges.append((s, e))
    return ranges


def in_protected(pos: int, ranges: list[tuple[int, int]]) -> bool:
    for s, e in ranges:
        if s <= pos < e:
            return True
    return False


def transform_line(line: str) -> tuple[str, int]:
    """Replace bare Greek chars in prose segments with $\\name$. Returns (new_line, n_changes)."""
    ranges = find_protected_ranges(line)
    out = []
    i = 0
    n = 0
    while i < len(line):
        c = line[i]
        # Handle β̄ composed (β + combining macron U+0304)
        if c == 'β' and i + 1 < len(line) and line[i + 1] == '\u0304':
            if not in_protected(i, ranges):
                out.append(r'$\bar{\beta}$')
                n += 1
                i += 2
                continue
        if c in GREEK_MAP and not in_protected(i, ranges):
            out.append(f'${GREEK_MAP[c]}$')
            n += 1
            i += 1
            continue
        out.append(c)
        i += 1
    return ''.join(out), n


def transform_fenced_line(line: str) -> tuple[str, int]:
    """Inside fenced blocks, replace Greek chars with ASCII word form."""
    out = []
    n = 0
    i = 0
    while i < len(line):
        c = line[i]
        # Handle β̄ composed (β + combining macron U+0304)
        if c == 'β' and i + 1 < len(line) and line[i + 1] == '\u0304':
            out.append('beta_bar')
            n += 1
            i += 2
            continue
        if c in GREEK_ASCII:
            out.append(GREEK_ASCII[c])
            n += 1
            i += 1
            continue
        out.append(c)
        i += 1
    return ''.join(out), n


def transform(text: str) -> tuple[str, int, list[tuple[int, int, str]]]:
    lines = text.splitlines(keepends=True)
    in_fence = False
    out_lines = []
    total = 0
    changed_lines: list[tuple[int, int, str]] = []
    for idx, line in enumerate(lines, 1):
        stripped = line.lstrip()
        if stripped.startswith('```'):
            in_fence = not in_fence
            out_lines.append(line)
            continue
        if in_fence:
            new_line, n = transform_fenced_line(line)
            if n:
                total += n
                changed_lines.append((idx, n, 'fenced'))
            out_lines.append(new_line)
            continue
        new_line, n = transform_line(line)
        if n:
            total += n
            changed_lines.append((idx, n, 'prose'))
        out_lines.append(new_line)
    return ''.join(out_lines), total, changed_lines


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument('--file', default='docs/anatomy_v8/CheeseStock_Anatomy_V8_KO_MASTER.md')
    p.add_argument('--apply', action='store_true', help='Write changes in place')
    args = p.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f'ERR: {path} not found', file=sys.stderr)
        return 1

    text = path.read_text(encoding='utf-8')
    new_text, total, changed = transform(text)

    print(f'File: {path}')
    print(f'Greek replacements: {total}')
    print(f'Lines changed: {len(changed)}')
    for ln, n, kind in changed[:40]:
        print(f'  L.{ln} [{kind}]: {n} replacement(s)')
    if len(changed) > 40:
        print(f'  ... and {len(changed) - 40} more')

    if total == 0:
        print('No bare Greek found. File is LaTeX-safe.')
        return 0

    if args.apply:
        path.write_text(new_text, encoding='utf-8')
        print(f'\nWROTE {path} ({total} replacements applied)')
    else:
        print('\n(dry-run - use --apply to write)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
