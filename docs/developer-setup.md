# CheeseStock 개발자 설정 가이드

두 명의 개발자가 각자의 PC에서 독립적으로 Kiwoom 서버를 운영하는 구조입니다.

```
seth1 PC                          최민규 PC
┌──────────────────┐              ┌──────────────────┐
│ Kiwoom HTS       │              │ Kiwoom HTS       │
│ (본인 계정)      │              │ (본인 계정)      │
│       ↓          │              │       ↓          │
│ ws_server.py     │              │ ws_server.py     │
│ (localhost:8765) │              │ (localhost:8765) │
│       ↓          │              │       ↓          │
│ Cloudflare Tunnel│              │ 브라우저 직접    │
│       ↓          │              │ 접속             │
│ wss://ws.cheese  │              └──────────────────┘
│ stock.co.kr      │
└──────────────────┘
        ↓
  cheesestock.co.kr
  (공개 사이트)
```

## 필수 사전 준비

1. **Python 3.9 32-bit** 설치
   - 다운로드: https://www.python.org/downloads/release/python-3913/
   - 반드시 **Windows installer (32-bit)** 선택
   - Kiwoom OpenAPI+ OCX가 32-bit COM 전용이므로 64-bit 불가

2. **Kiwoom OpenAPI+ OCX** 설치 및 등록
   - Kiwoom 영웅문 HTS 설치 후 OpenAPI+ 모듈 추가 설치
   - `C:\OpenAPI\khopenapi.ocx` 파일 존재 확인

3. **Kiwoom HTS 계정** (본인 계정)
   - 동일 계정 동시 로그인 불가 — 각자 계정 사용 필수
   - 모의투자 계정도 가능

4. **Git + GitHub 접근 권한**
   - 저장소: `https://github.com/cmg00210-k/krx-live-chart.git`
   - push 권한 필요 시 seth1에게 collaborator 초대 요청

## 설치 순서

### Step 1: 저장소 클론

```bash
git clone https://github.com/cmg00210-k/krx-live-chart.git
cd krx-live-chart
```

### Step 2: Python 경로 설정

Python이 기본 위치(`%LOCALAPPDATA%\Programs\Python\Python39-32`)에 설치되지 않은 경우,
환경변수를 설정합니다:

```batch
:: 시스템 환경변수 설정 (관리자 권한 CMD)
setx KRX_PYTHON32 "C:\실제\Python39-32\경로\python.exe"

:: 또는 현재 세션에서만 사용
set KRX_PYTHON32=C:\실제\Python39-32\경로\python.exe
```

기본 위치에 설치했다면 이 단계는 건너뛰어도 됩니다.

### Step 3: Python 의존성 설치

```bash
# 기본 경로인 경우
%LOCALAPPDATA%\Programs\Python\Python39-32\python.exe -m pip install -r server/requirements.txt

# 환경변수 설정한 경우
%KRX_PYTHON32% -m pip install -r server/requirements.txt
```

필수 패키지: `PyQt5>=5.15.0`, `websockets>=11.0`

### Step 4: OHLCV 데이터 다운로드 (최초 1회)

```bash
python scripts/download_ohlcv.py --years 1
```

- 약 2,700+ 종목, 소요시간 ~40분
- 출력: `data/kospi/*.json`, `data/kosdaq/*.json`
- `data/index.json`은 git에 포함되어 있으므로 이 단계 없이도 종목 목록은 표시됨

### Step 5: DART 재무 데이터 (선택)

```bash
# API 키 발급: https://opendart.fss.or.kr/ → 인증키 신청/관리
python scripts/download_financials.py --api-key YOUR_DART_KEY

# 테스트용 더미 데이터 (API 키 불필요)
python scripts/download_financials.py --demo
```

### Step 6: 서버 시작

```bash
# 일반 시작 (콘솔 출력 표시)
server\start_server.bat

# 원클릭 (서버 + HTTP + 브라우저)
CheeseStock.bat
```

서버 시작 전 Kiwoom HTS에 로그인되어 있어야 합니다.

## 실시간 데이터 구조

- 각 개발자가 **자신의 Kiwoom 계정**으로 HTS 로그인
- 각자의 PC에서 `ws_server.py` 실행 (포트 8765)
- 브라우저는 `ws://localhost:8765` 연결 (자동)
- 홈페이지(`cheesestock.co.kr`)는 seth1의 Cloudflare Tunnel을 통해 `wss://ws.cheesestock.co.kr/ws` 연결

## 데이터 없이 실행하기

`data/` 폴더가 없어도 앱은 동작합니다:
- `data/index.json`은 git에 포함 → 종목 목록 정상 표시
- OHLCV 데이터 없으면 → demo 모드 (시뮬레이션 데이터)
- 재무 데이터 없으면 → 시드 기반 더미 데이터

## 동시 개발 시 주의사항

1. **Kiwoom 계정**: 같은 계정 동시 로그인 불가 → 각자 계정 사용
2. **app.js 수정**: 충돌 가능성 높음 → 브랜치 분리 권장
3. **data/ 폴더**: `.gitignore` 대상 (`data/index.json` 제외)
4. **커밋 전 확인**: `git pull` 먼저 실행
5. **파일별 담당**:
   - `chart.js` + `patternRenderer.js` = 기술적 분석 담당
   - `css/style.css` + `index.html` = UI/디자인 담당
   - `app.js` = 공유 파일 — 수정 전 조율

## 문제 해결

### Python을 찾을 수 없습니다

```
[오류] Python 3.9-32bit를 찾을 수 없습니다
```

→ `KRX_PYTHON32` 환경변수를 실제 Python 경로로 설정하세요.

### Kiwoom 로그인 실패

```
[CRITICAL] Kiwoom 로그인 에러
```

→ Kiwoom HTS가 실행 중이고 로그인되어 있는지 확인하세요.
→ 다른 프로그램(KNOWSTOCK 등)이 Kiwoom을 사용 중이면 종료하세요.

### WebSocket 연결 실패

```
WebSocket 재연결 실패
```

→ `server\start_server.bat`이 실행 중인지 확인하세요.
→ 포트 8765가 다른 프로세스에 사용 중인지 확인: `netstat -an | findstr 8765`
