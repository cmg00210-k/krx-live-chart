# CheeseStock 배포 가이드 (www.cheesestock.com)

## 아키텍처 개요

```
[사용자 브라우저]
    │
    ├── HTTPS ──→ [Vercel CDN] ──→ 정적 파일 (HTML/JS/CSS)
    │               www.cheesestock.com
    │
    └── WSS ───→ [Cloudflare Tunnel] ──→ [Kiwoom 서버 PC]
                  ws.cheesestock.com         ws://localhost:8765
```

- **프론트엔드**: Vercel에서 정적 호스팅 (빌드 불필요)
- **WebSocket 서버**: Kiwoom OCX 서버 PC에서 Cloudflare Tunnel을 통해 외부 노출
- **DNS**: Cloudflare에서 관리

---

## 1. Vercel 배포 (프론트엔드)

### 1.1 Vercel 프로젝트 연결

1. [vercel.com](https://vercel.com)에서 GitHub 계정으로 로그인
2. "New Project" → GitHub 리포지토리 `cmg00210-k/krx-live-chart` 선택
3. Framework Preset: **Other** (빌드 시스템 없음)
4. Build Command: (비워두기 — `vercel.json`에서 `null` 설정됨)
5. Output Directory: `.` (루트 — `vercel.json`에서 설정됨)
6. Branch: `feature/technical-analysis` (또는 `main` — 배포 대상 브랜치)
7. "Deploy" 클릭

### 1.2 커스텀 도메인 설정

1. Vercel 프로젝트 Settings → Domains
2. `www.cheesestock.com` 추가
3. Vercel이 제공하는 CNAME 레코드를 Cloudflare DNS에 추가:
   ```
   타입: CNAME
   이름: www
   대상: cname.vercel-dns.com
   프록시: DNS only (회색 구름) ← Vercel이 자체 SSL 발급하므로 Cloudflare 프록시 비활성화
   ```
4. Apex 도메인 (`cheesestock.com`) 리다이렉트:
   ```
   타입: A
   이름: @
   값: 76.76.21.21
   ```

### 1.3 vercel.json 설명

프로젝트 루트의 `vercel.json`이 자동 적용됩니다:
- `buildCommand: null` — 빌드 단계 건너뛰기
- `cleanUrls: true` — `.html` 확장자 없는 깔끔한 URL
- 보안 헤더: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- WebSocket 리라이트: `/ws/*` → `https://ws.cheesestock.com/*`

### 1.4 배포 제외 파일

`.vercelignore` 파일로 불필요한 파일 제외:
- `data/` — 주식 데이터 JSON (대용량)
- `server/` — Kiwoom 서버 코드
- `scripts/` — 다운로드 스크립트
- `core_data/`, `pattern_impl/` — 학술 문서
- `*.bat`, `*.py`, `*.md` — 비웹 파일 (`index.html`은 예외)

---

## 2. Cloudflare Tunnel (WebSocket 서버)

Kiwoom OCX 서버 PC (Windows, 로컬 네트워크)를 `wss://ws.cheesestock.com`으로 외부 노출합니다.

### 2.1 사전 요구사항

- Kiwoom 서버 PC에서 `ws_server.py`가 `ws://localhost:8765`에서 실행 중
- Cloudflare 계정 + `cheesestock.com` 도메인이 Cloudflare DNS에 등록됨
- 서버 PC에 인터넷 연결

### 2.2 cloudflared 설치

1. [Cloudflare Tunnel 다운로드 페이지](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)에서 Windows 64-bit 다운로드
2. 또는 winget으로 설치:
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
3. 설치 확인:
   ```powershell
   cloudflared --version
   ```

### 2.3 Cloudflare 로그인 + 터널 생성

```powershell
# Cloudflare 인증 (브라우저 열림 → 도메인 선택)
cloudflared tunnel login

# 터널 생성
cloudflared tunnel create cheesestock-ws

# 생성된 터널 ID 확인 (예: a1b2c3d4-...)
cloudflared tunnel list
```

### 2.4 터널 설정 파일 생성

`C:\Users\<사용자>\.cloudflared\config.yml` 파일을 생성합니다:

```yaml
tunnel: <터널-ID>
credentials-file: C:\Users\<사용자>\.cloudflared\<터널-ID>.json

ingress:
  - hostname: ws.cheesestock.com
    service: ws://localhost:8765
    originRequest:
      # WebSocket 지원 활성화
      noTLSVerify: true
      connectTimeout: 10s
      # WebSocket idle timeout (Kiwoom 데이터 간격 고려)
      tcpKeepAlive: 30s
  - service: http_status:404
```

**중요**: `<터널-ID>`를 실제 터널 ID로 교체하세요.

### 2.5 DNS 레코드 추가

```powershell
cloudflared tunnel route dns cheesestock-ws ws.cheesestock.com
```

이 명령은 Cloudflare DNS에 자동으로 CNAME 레코드를 추가합니다:
```
타입: CNAME
이름: ws
대상: <터널-ID>.cfargotunnel.com
프록시: 활성화 (주황 구름)
```

### 2.6 터널 실행

#### 수동 실행 (테스트용)
```powershell
cloudflared tunnel run cheesestock-ws
```

#### Windows 서비스로 등록 (권장 — PC 재시작 시 자동 실행)
```powershell
# 관리자 권한 PowerShell에서 실행
cloudflared service install
```

서비스 등록 후:
- Windows 서비스 이름: `Cloudflared`
- 시작 유형: 자동
- 서비스 관리: `services.msc`에서 확인 가능

### 2.7 실행 순서

서버 PC 시작 시 순서:
1. Cloudflare Tunnel 서비스 자동 시작 (Windows 서비스)
2. `CheeseStock.bat` 또는 `server/start_server.bat` 실행 → Kiwoom 로그인 → `ws://localhost:8765` 시작
3. Tunnel이 자동으로 `wss://ws.cheesestock.com` ↔ `ws://localhost:8765` 연결

---

## 3. DNS 설정 (Cloudflare)

### 3.1 전체 DNS 레코드

`cheesestock.com` 도메인의 Cloudflare DNS 설정:

| 타입 | 이름 | 값 | 프록시 |
|------|------|------|--------|
| A | `@` | `76.76.21.21` | DNS only (회색) |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only (회색) |
| CNAME | `ws` | `<터널-ID>.cfargotunnel.com` | Proxied (주황) |

### 3.2 주의사항

- `www` 레코드: Vercel이 자체 SSL을 발급하므로 **Cloudflare 프록시 비활성화** (회색 구름)
- `ws` 레코드: Cloudflare Tunnel이므로 **프록시 활성화 필수** (주황 구름)
- Apex 도메인 (`cheesestock.com`): Vercel이 `www.cheesestock.com`으로 리다이렉트 처리

---

## 4. SSL 인증서

### 4.1 Vercel (www.cheesestock.com)

- **자동 발급**: Vercel이 Let's Encrypt 인증서를 자동 발급/갱신
- 설정 불필요 — 도메인 연결 시 자동 처리

### 4.2 Cloudflare Tunnel (ws.cheesestock.com)

- **자동 발급**: Cloudflare가 엣지 인증서를 자동 발급
- 클라이언트 ↔ Cloudflare: TLS 자동 (wss://)
- Cloudflare ↔ 서버 PC: Tunnel 내부 암호화 (추가 설정 불필요)
- `ws://localhost:8765` (로컬)에는 SSL 불필요 — Tunnel이 암호화 처리

---

## 5. 자동 환경 감지

`js/realtimeProvider.js`의 `RealtimeProvider` 생성자에서 배포 환경을 자동 감지합니다:

```javascript
if (window.location.hostname === 'www.cheesestock.com' || window.location.hostname === 'cheesestock.com') {
  KRX_API_CONFIG.wsUrl = 'wss://ws.cheesestock.com/ws';
}
```

- **로컬 개발**: `localhost` → 기본값 `ws://localhost:8765` 유지
- **배포 환경**: `cheesestock.com` → `wss://ws.cheesestock.com/ws`로 자동 전환
- 사용자가 연결 설정 UI에서 수동 변경 가능 (localStorage에 저장됨)

---

## 6. 체크리스트

### 최초 배포
- [ ] Cloudflare에 `cheesestock.com` 도메인 등록 + 네임서버 변경
- [ ] Vercel 프로젝트 생성 + GitHub 리포 연결
- [ ] Vercel 커스텀 도메인 `www.cheesestock.com` 추가
- [ ] Cloudflare DNS에 A/CNAME 레코드 추가 (3.1 참조)
- [ ] 서버 PC에 `cloudflared` 설치 + 터널 생성
- [ ] `config.yml` 작성 + DNS 라우팅 설정
- [ ] `cloudflared service install`로 Windows 서비스 등록
- [ ] `https://www.cheesestock.com` 접속 확인
- [ ] 브라우저 F12 → Network → WebSocket이 `wss://ws.cheesestock.com/ws`에 연결되는지 확인

### 운영
- [ ] Kiwoom 서버가 장 시작 전에 실행 중인지 확인
- [ ] Cloudflare Tunnel 서비스가 실행 중인지 확인 (`services.msc`)
- [ ] Vercel 배포가 최신 커밋을 반영하는지 확인 (자동 배포)

---

## 7. 트러블슈팅

### WebSocket 연결 실패
1. 서버 PC에서 `ws://localhost:8765` 직접 테스트 (브라우저 콘솔)
2. `cloudflared tunnel run cheesestock-ws` 수동 실행 → 로그 확인
3. Cloudflare Dashboard → Zero Trust → Tunnels에서 터널 상태 확인
4. DNS 레코드가 올바른지 확인 (`nslookup ws.cheesestock.com`)

### Vercel 배포 실패
1. Vercel Dashboard → Deployments → 빌드 로그 확인
2. `.vercelignore`가 필요한 파일을 제외하지 않는지 확인
3. `vercel.json` 문법 오류 확인

### SSL 인증서 문제
- Vercel: 도메인 DNS가 올바르게 설정되었는지 확인 (회색 구름)
- Cloudflare: SSL/TLS 모드가 "Full" 이상인지 확인
