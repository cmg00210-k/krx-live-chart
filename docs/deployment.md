# CheeseStock 배포 가이드 (cheesestock.co.kr)

## 현재 배포 구조 (2026-03-18 기준)

```
[사용자 브라우저]
    │
    └── HTTPS ──→ [AWS Lightsail] ──→ Nginx ──→ /var/www/cheesesstock
                  cheesestock.co.kr              (정적 파일 서빙)
                  52.79.112.255
                  서울 (ap-northeast-2a)
```

- **호스팅**: AWS Lightsail (Ubuntu 22.04, 512MB RAM, 2 vCPUs, 20GB SSD)
- **웹서버**: Nginx
- **HTTPS**: Let's Encrypt (certbot), 만료일 2026-06-16 (자동 갱신)
- **실시간 WS**: 미연결 (file 모드로 자동 전환, 데이터 없으면 demo 폴백)

---

## 1. 코드 배포 (업데이트)

### 로컬에서 푸시

```bash
git add js/파일명.js
git commit -m "feat: 변경 내용"
git push origin main
```

### 서버에서 pull

Lightsail 콘솔 → cheesesstock-prod → Connect → Connect using SSH

```bash
cd /var/www/cheesesstock
git pull
```

Nginx는 정적 파일을 직접 서빙하므로 **재시작 불필요**.

---

## 2. 서버 접속 방법

1. [AWS Lightsail](https://lightsail.aws.amazon.com) 접속
2. `cheesesstock-prod` 인스턴스 클릭
3. **Connect** 탭 → **Connect using SSH** 버튼

---

## 3. Nginx 설정

설정 파일 위치: `/etc/nginx/sites-enabled/cheesesstock`

주요 설정:
- Root: `/var/www/cheesesstock`
- HTTPS 자동 리다이렉트 (HTTP → HTTPS)
- Let's Encrypt 인증서 자동 적용 (certbot이 설정)

Nginx 재시작 (설정 변경 시):
```bash
sudo nginx -t          # 설정 검증
sudo systemctl reload nginx
```

---

## 4. HTTPS 인증서

Let's Encrypt 인증서 (certbot):
- 인증서 경로: `/etc/letsencrypt/live/cheesesstock.co.kr/`
- 만료일: 2026-06-16
- 자동 갱신: systemd timer 등록됨

갱신 테스트:
```bash
sudo certbot renew --dry-run
```

---

## 5. 방화벽 (Lightsail Firewall)

IPv4 + IPv6 모두 아래 포트 오픈:

| Application | Protocol | Port |
|-------------|----------|------|
| SSH | TCP | 22 |
| HTTP | TCP | 80 |
| HTTPS | TCP | 443 |

---

## 6. 데이터 파일

- **git에 포함**: `data/index.json`, `data/kospi/*.json` (35개), `data/kosdaq/*.json` (20개)
- `git pull` 시 자동으로 서버에 배포됨
- 데이터 없는 종목은 demo 모드로 자동 폴백

추가 종목 데이터 다운로드 (서버에서):
```bash
pip3 install pykrx FinanceDataReader
python3 scripts/download_ohlcv.py --top 100
```

---

## 7. 데이터 모드 (공개 서버)

공개 서버(`cheesestock.co.kr`)에서의 모드 순서:

1. **ws 모드 프로브** → 실패 (Kiwoom 서버 없음)
2. **file 모드 자동 전환** → JSON 파일 있으면 실제 데이터 표시
3. **demo 폴백** → JSON 파일 없는 종목은 시뮬레이션 데이터

> 로컬 개발 환경(`localhost`)에서만 WS 연결 가이드 팝업 표시.
> 공개 서버에서는 팝업 없이 자동으로 file/demo 모드 진입.

---

## 8. 체크리스트

### 최초 배포 (완료 ✅)
- [x] AWS Lightsail 인스턴스 생성 (서울)
- [x] Nginx 설치 및 설정
- [x] 코드 업로드 (`git clone`)
- [x] 도메인 연결 (`cheesestock.co.kr` → 52.79.112.255)
- [x] HTTPS 설정 (certbot + Let's Encrypt)
- [x] Lightsail 방화벽 포트 80/443 오픈

### 운영
- [ ] 코드 변경 시: `git push` → 서버에서 `git pull`
- [ ] 인증서 갱신 확인 (3개월마다 자동 갱신, 만료 30일 전 알림 이메일)
- [ ] 추가 종목 데이터 필요 시 서버에서 `download_ohlcv.py` 실행

---

## 9. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 사이트 접속 불가 | Lightsail 방화벽 | 포트 80/443 오픈 확인 |
| HTTPS 인증서 오류 | 인증서 만료 | `sudo certbot renew` |
| 코드 업데이트 안됨 | git pull 미실행 | 서버에서 `git pull` |
| 차트 데이터 없음 | data/ 파일 없음 | `download_ohlcv.py` 실행 |
| Nginx 502 오류 | Nginx 설정 오류 | `sudo nginx -t` 후 재시작 |
