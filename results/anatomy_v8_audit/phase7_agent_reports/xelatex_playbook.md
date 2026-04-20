# Xelatex Install Playbook — Phase 7 P7-003 PDF Rebuild + Sidecar Pin

**Author**: orchestrator (build-system-architect subagent unavailable — usage limit reset 1am Asia/Seoul)
**Date**: 2026-04-21
**Scope**: Windows 11 Home — xelatex install + `scripts/build_anatomy_pdf.py` 첫 빌드 + sidecar 생성

---

## Preflight Status (확인됨)

- `xelatex: command not found` — 현재 미설치
- `pandoc 3.9.0.2` — 설치됨
- `scripts/build_anatomy_pdf.py` 157 lines — 3 modes (build/check/force)
- `scripts/templates/cheesestock-v8.tex` + `diagram-protect.lua` filter 존재
- MASTER MD: `docs/anatomy_v8/CheeseStock_Anatomy_V8_KO_MASTER.md` SHA256 `91ece3dc7983ad8639954ccc3fbda5f62c8bd47d6da3d0c4e08bcf5afa664b4f`
- PDF: `docs/anatomy_v8/CheeseStock_Anatomy_V8_KO_MASTER.pdf` 존재하나 Phase 6 md와 unsyncd 가능
- Sidecar: 부재 → `verify.py --check anatomy` WARN

---

## 권장 경로: MiKTeX Basic + On-the-Fly Install

### Step 1. 설치

```powershell
# 관리자 권한 불필요 (user-mode install)
winget install MiKTeX.MiKTeX

# 또는 수동 GUI:
# https://miktex.org/download → Basic Installer
```

**소요**: 5-10분 (~300MB 초기 설치)

### Step 2. 쉘 재시작 후 검증

```bash
# 새 Git Bash 세션 열기 (PATH 업데이트 반영)
xelatex --version
# 기대 출력: MiKTeX-XeTeX 4.x.x (TeX Live 20xx/MiKTeX 25.x)
```

### Step 3. On-the-Fly 패키지 자동 설치 활성화

```bash
# GUI 방식 (권장):
# Windows Start → "MiKTeX Console" 실행 → Settings → General
#   "You want MiKTeX to install missing packages on-the-fly:" = Yes (Never ask)

# CLI 방식 대안:
initexmf --set-config-value="[MPM]AutoInstall=1"
```

### Step 4. Pretendard 폰트 확인

```powershell
# PowerShell에서 확인
powershell.exe -c "Get-ChildItem 'C:\Windows\Fonts' | Where-Object { \$_.Name -like '*Pretendard*' }"
```

- 이미 설치 (Phase 6 성공 기록): SKIP
- 미설치: https://github.com/orioncactus/pretendard/releases 최신 .zip → 압축해제 → Pretendard-Bold.otf, Pretendard-Regular.otf 더블클릭 → "Install for all users"

### Step 5. Smoke Test (한글 + 수식)

```bash
cat > /tmp/test.tex << 'EOF'
\documentclass{article}
\usepackage{fontspec}
\setmainfont{Pretendard}
\begin{document}
한국어 테스트. Hello World. $\sqrt{2} \approx 1.414$.
\end{document}
EOF
xelatex -output-directory=/tmp /tmp/test.tex
ls -la /tmp/test.pdf
```

- 성공: test.pdf 존재 + 크기 > 10KB → Step 6 진행
- 실패: Pretendard not found → `Malgun Gothic` fallback + 재시도 또는 Pretendard 재설치

### Step 6. Master PDF 빌드

```bash
cd /c/Users/seth1/krx-live-chart-remote
python scripts/build_anatomy_pdf.py
# 첫 빌드 3-8분 (MiKTeX 패키지 on-the-fly 설치 포함)
# 두번째 빌드 30-90초 (TOC 2-pass, 패키지 캐시된 상태)
```

**Bash tool 호출 시 timeout 옵션 필수**:
```
Bash(command="python scripts/build_anatomy_pdf.py", timeout=600000)
```

### Step 7. Sidecar 검증

```bash
python scripts/verify.py --check anatomy
# 기대: PASS — md_sha/pdf_sha 동기
ls -la docs/anatomy_v8/CheeseStock_Anatomy_V8_KO_MASTER.sha256.json
cat docs/anatomy_v8/CheeseStock_Anatomy_V8_KO_MASTER.sha256.json
```

`build_anatomy_pdf.py` 자동 sidecar 생성 확인됨 (L.60-72 `write_sidecar()` 함수).

### Step 8. OneDrive 바탕화면 백업

```bash
cp docs/anatomy_v8/CheeseStock_Anatomy_V8_KO_MASTER.pdf "/c/Users/seth1/OneDrive/바탕 화면/Cheesestock_Anatomy_V8.pdf"
```

---

## 실패 시나리오 5종 + 대응

### (A) Pretendard 폰트 미발견

**증상**:
```
! Package fontspec Error: The font "Pretendard" cannot be found.
```

**대응 순서**:
1. Windows 폰트 재설치 (Step 4 재실행, "Install for all users" 필수)
2. fc-cache 업데이트 (MiKTeX의 경우 `initexmf --update-fndb --verbose`)
3. fallback: `scripts/templates/cheesestock-v8.tex`에서 `\setmainfont{Pretendard}` → `\setmainfont{Malgun Gothic}` 일시 교체 (빌드 성공 후 원복)

### (B) KoTeX 패키지 누락

**증상**:
```
! Package kotex Error
```

**대응**:
```bash
# MiKTeX 자동 설치 진행 대기 (첫 실행 시 수 분)
# 수동 설치:
miktex packages install kotex-utf
# 또는 MiKTeX Console → Packages → kotex 검색 → Install
```

### (C) `--listings` deprecated warning (pandoc 3.9)

**증상**:
```
[WARNING] --listings is deprecated
```

**대응**: Warning만 발생 시 무시 (빌드 성공 유지). 이후 Phase 8에서 `build_anatomy_pdf.py` L.88의 `--listings` → `--highlight-style=idiomatic`로 교체 고려.

### (D) LaTeX Memory Exhausted

**증상**:
```
! TeX capacity exceeded, sorry [main memory size=3000000]
```

**대응**:
```bash
# MiKTeX 기본 메모리 10배 증설
initexmf --edit-config-file=xelatex
# 파일에 추가:
# main_memory = 12000000
# extra_mem_top = 5000000
# save_size = 20000
# pool_size = 6000000
# 저장 후 재빌드
```

### (E) CJK 문자 박스 (□) 표시

**증상**: 한글이 □로 렌더링 (폰트 fallback 실패)

**대응**: 템플릿에 `\setCJKmainfont{Pretendard}` 확인 — 이미 있는지 `scripts/templates/cheesestock-v8.tex` 내 검색. 없으면 추가.

```bash
grep -n "CJKmainfont" scripts/templates/cheesestock-v8.tex
# 없으면:
# \usepackage{xeCJK}
# \setCJKmainfont{Pretendard}
```

pandoc 호출에 `-V CJKmainfont:Pretendard` 이미 있음 (`build_anatomy_pdf.py` L.92) → 정상이면 이 시나리오 불발.

---

## verify.py --check anatomy PASS 시나리오

build 성공 후 기대 상태:

```
[build_anatomy_pdf] OK: md and pdf SHA256 match sidecar
  md_sha:  91ece3dc7983ad8639954ccc3fbda5f62c8bd47d6da3d0c4e08bcf5afa664b4f
  pdf_sha: <new>
  built:   2026-04-21T...
```

---

## Phase 8 권장: CI 재현성 확보

현 세션 scope 밖이나 Phase 8에서 고려:
1. **Docker container**: `pandoc/extra` 베이스 이미지 + Pretendard 임베드
2. **GitHub Actions**: workflow로 MD edit 시 자동 PDF rebuild + sidecar commit
3. **pandoc pin**: 3.9.0.2 정확 버전 (breaking change 주의)

---

## Execution Checklist (사용자용)

```
[ ] 1. winget install MiKTeX.MiKTeX (사용자 승인 필요)
[ ] 2. 새 쉘 세션 → xelatex --version 확인
[ ] 3. MiKTeX Console → Settings → Install on-the-fly: Yes
[ ] 4. Pretendard 설치 확인 (이미 시스템 설치되어 있을 가능성 높음)
[ ] 5. Smoke test (한글 test.tex)
[ ] 6. python scripts/build_anatomy_pdf.py (timeout=600000)
[ ] 7. python scripts/verify.py --check anatomy → PASS
[ ] 8. OneDrive 바탕화면 백업
```

---

## 현 세션 대응 전략

**xelatex 설치는 사용자 `winget install` 승인이 필요한 환경 변경** (관리자 권한은 불필요하나 disk write + 패키지 매니저 access).

**Auto mode 하에서도 패키지 설치는 사용자 승인 후 진행**이 안전. 따라서:
- **옵션 A (권장)**: 사용자에 "winget install MiKTeX.MiKTeX 실행해도 되는가?" 확인 후 진행
- **옵션 B**: P7-003 skip, Phase 7 commit 1은 P7-001만 포함. P7-003은 별도 차회 세션에서 xelatex 설치 선행 후 진행

B 옵션을 기본값으로 채택 — Phase 7 핵심 가치는 P7-001 (APT 5-factor 활성화)이며, PDF rebuild는 인프라 작업. 사용자에 명시적으로 제안하고 결정 위임.
