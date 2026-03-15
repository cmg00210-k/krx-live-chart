# KRX 라이브 차트 — 개발 가이드 & 협업 규칙

## 프로젝트 구조
```
krx-live-chart/
├── index.html           ← 페이지 뼈대 (상대방 담당)
├── css/style.css        ← 디자인 (상대방 담당)
├── js/colors.js         ← 색상 상수 (공유)
├── js/data.js           ← 종목 재무 데이터
├── js/api.js            ← 데이터 서비스 (file/demo/kis)
├── js/realtimeProvider.js ← 실시간 데이터 폴링
├── js/indicators.js     ← 지표 계산 함수 (내 담당)
├── js/patterns.js       ← 패턴 엔진 26종 (내 담당)
├── js/signalEngine.js   ← 시그널 엔진 (내 담당)
├── js/chart.js          ← 차트 렌더링 (내 담당)
├── js/patternRenderer.js ← 패턴 시각화 (내 담당)
├── js/signalRenderer.js ← 시그널 시각화 (내 담당)
├── js/backtester.js     ← 백테스트 (내 담당)
├── js/analysisWorker.js ← Web Worker (내 담당)
├── js/sidebar.js        ← 사이드바 (공유)
├── js/app.js            ← 상태관리, UI 이벤트 (공유)
├── core_data/           ← 학술 문서 (17편)
├── pattern_impl/        ← 패턴 구현 문서 (5편)
├── scripts/             ← Python 스크립트
└── .gitignore
```

## 역할 분담
- **나**: js/indicators.js, patterns.js, signalEngine.js, chart.js, patternRenderer.js, signalRenderer.js, backtester.js, analysisWorker.js — 기술적 분석 전체
- **상대방**: css/style.css + index.html 중심 — UI 디자인, 레이아웃

## 매일 작업 루틴

### 1. 작업 시작 전 (반드시!)
```bash
cd C:\Users\seth1\krx-live-chart-remote
git pull origin main
```

### 2. 코드 수정
- VS Code에서 담당 파일 수정
- Live Server로 브라우저 확인

### 3. 작업 완료 후 올리기
```bash
git add js/chart.js                    # 수정한 파일만!
git commit -m "무엇을 했는지 설명"
git push origin main
```

## 절대 하지 말 것
- `git add .` (전체 추가 금지)
- `git push --force` (강제 푸시 금지)
- pull 안 하고 작업 시작
- F12 에러 확인 안 하고 push

## push 전 체크리스트
- [ ] 브라우저에서 페이지 정상 로드?
- [ ] F12 → Console에 빨간 에러 없음?
- [ ] 차트 정상 표시?
- [ ] 내가 안 건드린 기능 안 깨짐?
- [ ] git pull 먼저 했음?

## 소통 필수
- 오늘 어떤 파일 작업할지 공유
- 공유 파일(app.js) 수정 시 사전 합의
- 새 파일/구조 변경 시 합의

## 충돌 발생 시
```
<<<<<<< HEAD
내 코드
=======
상대방 코드
>>>>>>> origin/main
```
→ 맞는 코드 남기고 <<<, ===, >>> 삭제 → add → commit → push

## 실수 복구
```bash
git checkout -- js/chart.js    # 수정 되돌리기 (commit 전)
git reset HEAD~1               # 커밋 취소 (push 전)
git revert HEAD                # push 후 되돌리기 (안전)
```

## 디버깅
- F12 → Console: JS 에러 확인
- F12 → Elements: HTML 구조 확인
- F12 → Network: 파일 로딩 실패 확인

## GitHub 저장소
https://github.com/cmg00210-k/krx-live-chart
