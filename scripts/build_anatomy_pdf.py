#!/usr/bin/env python3
"""
build_anatomy_pdf.py — ANATOMY V8 MASTER.md → PDF build pipeline (P6-004)

Runs pandoc with the project XeLaTeX template to produce
docs/anatomy_v8/CheeseStock_Anatomy_V8_KO_MASTER.pdf and writes a SHA256
sidecar that pairs the source MD hash with the resulting PDF hash. This
allows verify.py --check anatomy to detect source/output drift before deploy.

Usage:
  python scripts/build_anatomy_pdf.py            # build + write sidecar
  python scripts/build_anatomy_pdf.py --check    # sha256 sidecar validation only
  python scripts/build_anatomy_pdf.py --force    # rebuild even if md SHA unchanged

Requirements:
  - pandoc >= 3.0 (PATH)
  - xelatex (TeX Live / MiKTeX)
  - Pretendard font installed system-wide (fallback: Malgun Gothic)

Idempotency:
  When md SHA matches the sidecar's md_sha, skips pandoc invocation unless
  --force is passed. Useful for CI / daily_deploy.bat chaining.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD_PATH = os.path.join(ROOT, 'docs', 'anatomy_v8', 'CheeseStock_Anatomy_V8_KO_MASTER.md')
PDF_PATH = os.path.join(ROOT, 'docs', 'anatomy_v8', 'CheeseStock_Anatomy_V8_KO_MASTER.pdf')
SHA_PATH = os.path.join(ROOT, 'docs', 'anatomy_v8', 'CheeseStock_Anatomy_V8_KO_MASTER.sha256.json')
TEMPLATE = os.path.join(ROOT, 'scripts', 'templates', 'cheesestock-v8.tex')


def sha256_of(path):
    if not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def load_sidecar():
    if not os.path.exists(SHA_PATH):
        return None
    try:
        with open(SHA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def write_sidecar(md_sha, pdf_sha, pandoc_version):
    data = {
        'md_sha': md_sha,
        'pdf_sha': pdf_sha,
        'md_path': os.path.relpath(MD_PATH, ROOT).replace(os.sep, '/'),
        'pdf_path': os.path.relpath(PDF_PATH, ROOT).replace(os.sep, '/'),
        'pandoc_version': pandoc_version,
        'built_at': datetime.now().isoformat(timespec='seconds'),
    }
    os.makedirs(os.path.dirname(SHA_PATH), exist_ok=True)
    with open(SHA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'[build_anatomy_pdf] Sidecar written: {SHA_PATH}')


def run_pandoc():
    if shutil.which('pandoc') is None:
        print('[build_anatomy_pdf] ERROR: pandoc not found on PATH', file=sys.stderr)
        return None
    version = subprocess.run(['pandoc', '--version'], capture_output=True, text=True, check=False)
    ver_line = (version.stdout or '').splitlines()[0] if version.returncode == 0 else 'unknown'

    # pandoc >=3.x: --listings was deprecated + requires listings package which
    # cheesestock-v8.tex does not load. Use pandoc's built-in highlighter instead.
    cmd = [
        'pandoc', MD_PATH,
        '-o', PDF_PATH,
        '--pdf-engine=xelatex',
        '--template', TEMPLATE,
        '--toc', '--toc-depth=3',
        '--highlight-style=tango',
        '-V', 'geometry:a4paper,margin=2cm',
        '-V', 'CJKmainfont:Pretendard',
        '-V', 'CJKmainfontoptions:AutoFakeSlant',
        '--lua-filter', os.path.join(ROOT, 'scripts', 'templates', 'diagram-protect.lua'),
    ]
    print('[build_anatomy_pdf] Running pandoc...')
    print('  cmd:', ' '.join('"' + a + '"' if ' ' in a else a for a in cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        print('[build_anatomy_pdf] ERROR: pandoc failed:', file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        return None
    print('[build_anatomy_pdf] PDF built OK')
    return ver_line


def cmd_check():
    md_sha = sha256_of(MD_PATH)
    if md_sha is None:
        print(f'[build_anatomy_pdf] ERROR: MD not found at {MD_PATH}', file=sys.stderr)
        return 2
    sidecar = load_sidecar()
    if sidecar is None:
        print(f'[build_anatomy_pdf] WARN: sidecar missing at {SHA_PATH}')
        print(f'                         run without --check to build and pin')
        return 1
    if sidecar.get('md_sha') != md_sha:
        print(f'[build_anatomy_pdf] DRIFT: MD SHA mismatch')
        print(f'  current:  {md_sha}')
        print(f'  sidecar:  {sidecar.get("md_sha")}')
        print(f'  rebuild:  python scripts/build_anatomy_pdf.py')
        return 1
    pdf_sha_now = sha256_of(PDF_PATH)
    if pdf_sha_now is None:
        print(f'[build_anatomy_pdf] WARN: PDF missing at {PDF_PATH}')
        return 1
    if sidecar.get('pdf_sha') != pdf_sha_now:
        print(f'[build_anatomy_pdf] DRIFT: PDF SHA mismatch (PDF modified since build?)')
        print(f'  current:  {pdf_sha_now}')
        print(f'  sidecar:  {sidecar.get("pdf_sha")}')
        return 1
    print(f'[build_anatomy_pdf] OK: md and pdf SHA256 match sidecar')
    print(f'  md_sha:  {md_sha}')
    print(f'  pdf_sha: {pdf_sha_now}')
    print(f'  built:   {sidecar.get("built_at")}')
    return 0


def cmd_build(force):
    md_sha = sha256_of(MD_PATH)
    if md_sha is None:
        print(f'[build_anatomy_pdf] ERROR: MD not found at {MD_PATH}', file=sys.stderr)
        return 2
    sidecar = load_sidecar()
    if not force and sidecar and sidecar.get('md_sha') == md_sha and os.path.exists(PDF_PATH):
        pdf_sha = sha256_of(PDF_PATH)
        if pdf_sha == sidecar.get('pdf_sha'):
            print(f'[build_anatomy_pdf] SKIP: md SHA unchanged ({md_sha[:16]}...), PDF current.')
            print(f'                    Use --force to rebuild.')
            return 0
    ver = run_pandoc()
    if ver is None:
        return 2
    pdf_sha = sha256_of(PDF_PATH)
    if pdf_sha is None:
        print(f'[build_anatomy_pdf] ERROR: PDF not produced', file=sys.stderr)
        return 2
    write_sidecar(md_sha, pdf_sha, ver)
    print(f'[build_anatomy_pdf] DONE')
    print(f'  MD SHA:  {md_sha}')
    print(f'  PDF SHA: {pdf_sha}')
    return 0


def main():
    ap = argparse.ArgumentParser(description='ANATOMY V8 MD -> PDF build + SHA256 sync')
    ap.add_argument('--check', action='store_true', help='sidecar validation only')
    ap.add_argument('--force', action='store_true', help='rebuild even if md SHA unchanged')
    args = ap.parse_args()
    if args.check:
        return cmd_check()
    return cmd_build(args.force)


if __name__ == '__main__':
    sys.exit(main())
