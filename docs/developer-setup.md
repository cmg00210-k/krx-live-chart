# CheeseStock 개발자 온보딩 가이드 (최민규용)

이 문서를 Claude에 붙여넣으면, AI가 프로젝트 구조를 이해하고 개발을 도울 수 있습니다.

---

## 1. 프로젝트 개요

CheeseStock은 한국 주식시장(KOSPI/KOSDAQ) 실시간 차트 + 기술적 분석 웹앱입니다.

- **GitHub**: https://github.com/cmg00210-k/krx-live-chart.git
- **브랜치**: `main` (배포용)
- **홈페이지**: https://cheesestock.co.kr/ ✅ 운영 중
- **빌드 시스템 없음**: HTML/CSS/JS만 사용. `index.html`을 브라우저에서 열면 동작.
- **서버**: `server/ws_server.py` — Python 3.9 32-bit + Kiwoom OCX로 실시간 데이터 수신

---

## 2. 아키텍처

### 개발 환경 (두 개발자 독립 구조)

```
┌─────────────────────────────────────┐
│  개발자 A (seth1) 노트북             │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ Kiwoom HTS  │→│ ws_server.py │  │
│  │ (본인 계정)  │  │ port 8765    │  │
│  └─────────────┘  └──────┬───────┘  │
│                          │           │
│  브라우저 ← ws://localhost:8765      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  개발자 B (최민규) 노트북            │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ Kiwoom HTS  │→│ ws_server.py │  │
│  │ (본인 계정)  │  │ port 8765    │  │
│  └─────────────┘  └──────┬───────┘  │
│                          │           │
│  브라우저 ← ws://localhost:8765      │
└─────────────────────────────────────┘
```

→ 서로 완전 독립. 상대 노트북이 꺼져 있어도 동작.
→ 코드만 GitHub으로 공유. 데이터는 각자 로컬.

### 공개 서버 (cheesestock.co.kr)

```
[사용자 브라우저]
    └── HTTPS ──→ [AWS Lightsail / Nginx] ──→ /var/www/cheesesstock
                  52.79.112.255 (서울)
```

- WS 서버 없음 → file 모드 (JSON 데이터) 또는 demo 모드 자동 선택
- 배포: `git push` → 서버에서 `git pull`

---

## 3. 파일 구조

```
krx-live-chart/
├── index.html              ← 메인 페이지
├── css/style.css           ← 전체 스타일
├── js/
│   ├── colors.js           ← 색상 상수 (KRX_COLORS)
│   ├── api.js              ← 데이터 서비스 (WS/파일/데모 모드 자동 전환)
│   ├── realtimeProvider.js ← WebSocket 클라이언트 (Kiwoom 서버 연결)
│   ├── indicators.js       ← 기술 지표 계산 (MA, RSI, MACD, WLS 회귀 등)
│   ├── patterns.js         ← 26개 캔들/차트 패턴 감지 엔진
│   ├── signalEngine.js     ← 16개 시그널 + 6개 복합 시그널
│   ├── chart.js            ← TradingView Lightweight Charts 래퍼
│   ├── patternRenderer.js  ← 패턴 캔버스 시각화 (ISeriesPrimitive)
│   ├── signalRenderer.js   ← 시그널 캔버스 시각화
│   ├── backtester.js       ← 패턴 수익률 백테스트 + WLS 회귀
│   ├── drawingTools.js     ← 드로잉 도구 6종 (추세선, 피보나치 등)
│   ├── sidebar.js          ← 좌측 사이드바 (가상 스크롤 2700+종목)
│   ├── patternPanel.js     ← 패턴 분석 패널 (C열)
│   ├── financials.js       ← 재무지표 패널 (D열, PER/ROE/CAGR)
│   ├── app.js              ← 앱 진입점 (상태관리, 이벤트, 초기화)
│   └── analysisWorker.js   ← Web Worker (패턴+시그널 비동기 분석)
├── server/
│   ├── ws_server.py        ← Kiwoom OCX WebSocket 서버 (Python 3.9 32-bit)
│   ├── start_server.bat    ← 서버 시작 스크립트
│   └── requirements.txt    ← PyQt5, websockets
├── scripts/
│   ├── download_ohlcv.py   ← 일봉 OHLCV 다운로드 (pykrx)
│   ├── download_financials.py ← DART 재무 데이터 다운로드
│   └── generate_intraday.py   ← 분봉 보간 데이터 생성
├── data/                   ← 일부 git 포함 (아래 참조)
│   ├── index.json          ← git 포함 (100개 종목 목록)
│   ├── kospi/*.json        ← git 포함 (35개 종목 실제 데이터)
│   ├── kosdaq/*.json       ← git 포함 (20개 종목 실제 데이터)
│   └── financials/*.json   ← gitignore (download_financials.py로 생성)
├── docs/
│   ├── developer-setup.md  ← 이 파일
│   ├── deployment.md       ← 배포 가이드 (Lightsail)
│   ├── qa_checklist.md     ← QA 체크리스트 (100+항목)
│   └── ambiguous_items.md  ← 모호/주관적 사항 기록
└── core_data/              ← 학술 문서 17개 (수학/통계/금융이론)
```

---

## 4. 스크립트 로드 순서 (절대 변경 금지)

`index.html`에서 이 순서로 로드됩니다. 순서가 바뀌면 전역 변수 참조 에러가 발생합니다:

```
colors.js → data.js → api.js → realtimeProvider.js → indicators.js
→ patterns.js → signalEngine.js → chart.js → patternRenderer.js
→ signalRenderer.js → backtester.js → sidebar.js → patternPanel.js
→ financials.js → drawingTools.js → app.js
```

---

## 5. 최민규 PC 초기 설정

### Step 1: 필수 소프트웨어 설치

1. **Python 3.9 32-bit**
   - https://www.python.org/downloads/release/python-3913/
   - "Windows installer (32-bit)" 선택
   - 기본 경로 설치: `%LOCALAPPDATA%\Programs\Python\Python39-32\`

2. **Kiwoom OpenAPI+**
   - Kiwoom HTS(영웅문) 설치 → 도구 → OpenAPI+ 신청
   - `C:\OpenAPI\khopenapi.ocx` 파일 존재 확인

3. **Git**: https://git-scm.com/download/win

4. **Node.js** (선택사항 — HTTP 서버용): https://nodejs.org/

### Step 2: 저장소 클론

```bash
git clone https://github.com/cmg00210-k/krx-live-chart.git
cd krx-live-chart
```

### Step 3: Python 패키지 설치

```bash
%LOCALAPPDATA%\Programs\Python\Python39-32\python.exe -m pip install -r server\requirements.txt
```

Python 설치 경로가 다르면:
```bash
setx KRX_PYTHON32 "C:\your\path\to\python.exe"
```

### Step 4: 주식 데이터 다운로드 (선택 — git에 55개 포함됨)

git clone 시 `data/kospi/` (35개) + `data/kosdaq/` (20개)가 자동으로 포함됩니다.
전체 종목(~2700개)이 필요하면:

```bash
python scripts\download_ohlcv.py --years 1   # ~40분 소요
```

### Step 5: 재무 데이터 다운로드 (선택)

```bash
# DART API 키 발급: https://opendart.fss.or.kr/ (무료, 즉시)
python scripts\download_financials.py --api-key YOUR_DART_KEY

# 또는 API 키 없이 테스트:
python scripts\download_financials.py --demo
```

DART 키가 없으면 재무지표 패널에 "—" 표시 (정상).

### Step 6: Kiwoom 로그인 + 서버 시작

```bash
# 1. Kiwoom HTS에 본인 계정으로 로그인 (반드시 먼저!)
# 2. 서버 시작:
server\start_server.bat
```

성공 시 콘솔 메시지:
```
KRX WebSocket Server v3.0
로그인 성공 (ID: your_id, 서버: 실서버)
Server ready — waiting for client connections
```

### Step 7: 브라우저에서 열기

```bash
# 방법 A: 원클릭 (Node.js 필요)
CheeseStock.bat

# 방법 B: VS Code Live Server
# → index.html 우클릭 → "Open with Live Server"

# 방법 C: 수동 HTTP 서버
npx serve -l 5500 -s
# → http://localhost:5500 접속
```

> ⚠️ `file://`로 직접 열면 CORS 에러로 `data/index.json` 로드 실패. 반드시 HTTP 서버로 열어야 합니다.

---

## 6. 데이터 모드 (자동 전환)

| 모드 | 조건 | UI 표시 |
|------|------|---------|
| **ws** | Kiwoom 서버 연결 성공 | "LIVE" 초록 |
| **file** | WS 실패 + JSON 파일 있음 | "FILE" 연두 |
| **demo** | WS 실패 + JSON 파일 없음 | "DEMO" 주황 + 워터마크 |

**공개 서버(cheesestock.co.kr)**: WS 실패 → file 모드 자동 진입 (팝업 없음)
**로컬 개발(localhost)**: WS 실패 → 연결 가이드 팝업 표시

---

## 7. 공개 서버 업데이트 방법

```bash
# 1. 로컬에서 수정 후 푸시
git add js/파일명.js
git commit -m "feat: 변경 내용"
git push origin main

# 2. 서버 터미널에서 (Lightsail SSH)
cd /var/www/cheesesstock
git pull
```

서버 터미널 열기: AWS Lightsail → cheesesstock-prod → Connect → Connect using SSH

---

## 8. Git 작업 규칙

```bash
# 작업 시작 전 항상:
git pull origin main

# 커밋 시 파일 지정 (git add . 금지):
git add js/specific-file.js css/style.css
git commit -m "feat: 기능 설명"

# 절대 금지:
git push --force
git add .     # → 실수로 불필요한 파일 커밋 위험
```

파일 소유권:
- `chart.js` + `patternRenderer.js` = 기술적 분석 담당
- `css/style.css` + `index.html` = UI/디자인 담당
- `app.js` = 공유 파일 — 수정 전 상의

---

## 9. 로그인 안전 체계 (중요!)

Kiwoom은 비밀번호 5회 오류 시 계정 잠금 (3-4일 해제 소요). 코드에 7중 방어 적용:

1. 세션당 최대 2회 로그인 시도
2. 시도 간 60초 쿨다운
3. 비밀번호 오류 시 즉시 영구 차단
4. `.login_guard.json`: 서버 재시작해도 누적 3회 제한
5. 치명적 오류 시 가드 파일에 locked 기록
6. 브라우저: loginError 수신 시 WS 재연결 차단
7. 브라우저: 최대 20회 재연결 시도 후 중단

> ⚠️ 절대로 코드에서 `CommConnect()`를 반복 호출하는 로직을 추가하지 마세요.

---

## 10. 색상 체계 (한국식)

```javascript
// js/colors.js
UP: '#E05050'      // 상승 = 빨강 (한국 관례)
DOWN: '#5086DC'    // 하락 = 파랑
ACCENT: '#A08830'  // 강조 = 어두운 골드
NEUTRAL: '#ffeb3b' // 중립 = 노랑
```

---

## 11. 앞으로의 작업 방향

| 우선순위 | 작업 | 상태 |
|----------|------|------|
| 1 | cheesestock.co.kr 운영 | ✅ 완료 (AWS Lightsail) |
| 2 | HTTPS 적용 | ✅ 완료 (Let's Encrypt) |
| 3 | 전체 종목 데이터 다운로드 | 서버에서 download_ohlcv.py 실행 필요 |
| 4 | Cloudflare Tunnel (실시간 WS 공개) | seth1 PC에서 설정 필요 |
| 5 | DART 재무 데이터 전종목 | API 키 필요 |
| 6 | 모바일 반응형 QA | 768px 이하 테스트 |
| 7 | Koscom API 전환 (장기) | 사업화 단계 |

---

## 12. 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 빈 페이지 | CDN 차단 (unpkg.com) | 인터넷 연결 확인 |
| 차트 데이터 없음 | data/*.json 없음 | `download_ohlcv.py` 실행 |
| "서버 연결 필요" | ws_server.py 미실행 | `start_server.bat` 실행 |
| 재무 "—" 표시 | DART 미다운로드 | `download_financials.py` 또는 무시 (정상) |
| "DEMO" 뱃지 | 데모 모드 진입 | 데이터 다운로드 또는 서버 시작 |
| 로그인 실패 반복 | Kiwoom HTS 미로그인 | HTS 먼저 로그인 후 서버 시작 |
| CORS 에러 | file:// 프로토콜 | HTTP 서버로 열기 (localhost:5500) |
| 공개 서버 코드 미반영 | git pull 안함 | 서버 SSH에서 `git pull` |
