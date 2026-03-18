# CheeseStock Vercel 배포 가이드 (완전 초보용)

> 이 가이드는 Vercel을 한 번도 써본 적 없는 사람을 위한 단계별 안내서입니다.
> 도메인: `cheesestock.co.kr` | GitHub: `cmg00210-k/krx-live-chart`

---

## 목차

1. [사전 준비물 확인](#1-사전-준비물-확인)
2. [Vercel 회원가입 (GitHub 연동)](#2-vercel-회원가입)
3. [프로젝트 가져오기 (Import)](#3-프로젝트-가져오기)
4. [첫 배포 확인](#4-첫-배포-확인)
5. [커스텀 도메인 추가 (cheesestock.co.kr)](#5-커스텀-도메인-추가)
6. [DNS 설정 (도메인 구매처에서)](#6-dns-설정)
7. [SSL 인증서 & 최종 확인](#7-ssl-인증서--최종-확인)
8. [배포 후 관리](#8-배포-후-관리)
9. [문제 해결 (FAQ)](#9-문제-해결)
10. [프로젝트 설정 파일 설명](#10-프로젝트-설정-파일-설명)

---

## 1. 사전 준비물 확인

시작하기 전에 아래 3가지가 준비되어 있는지 확인하세요:

| # | 준비물 | 상태 |
|---|--------|------|
| 1 | **GitHub 계정** (`cmg00210-k`) 에 `krx-live-chart` 리포지토리가 있어야 함 | 확인 필요 |
| 2 | **도메인** `cheesestock.co.kr` 가 구매되어 있어야 함 | 확인 필요 |
| 3 | **도메인 관리 페이지** 접속 가능해야 함 (가비아, 카페24, 호스팅KR 등 — 도메인 구매한 곳) | 확인 필요 |

> **참고**: 이 프로젝트에는 이미 `vercel.json`과 `.vercelignore` 파일이 설정되어 있습니다.
> 별도로 설정 파일을 만들 필요가 없습니다.

---

## 2. Vercel 회원가입

### 2-1. Vercel 사이트 접속

1. 브라우저에서 **https://vercel.com** 에 접속합니다
2. 화면 오른쪽 상단의 **"Sign Up"** 버튼을 클릭합니다

```
[화면 설명]
┌─────────────────────────────────────────────┐
│  Vercel 로고        [Log In]  [Sign Up]     │
│                                             │
│   Develop. Preview. Ship.                   │
│                                             │
│   → "Sign Up" 클릭                          │
└─────────────────────────────────────────────┘
```

### 2-2. 플랜 선택

1. **"Hobby"** 를 선택합니다 (무료 플랜)
2. 이름을 입력합니다 (영문으로, 예: `seth`)
3. **"Continue"** 클릭

```
[화면 설명]
┌─────────────────────────────────────────────┐
│   Select your plan                          │
│                                             │
│   [■ Hobby]     [ Pro $20/mo]               │
│    Free          For teams                  │
│    개인용 무료     팀용 유료                   │
│                                             │
│   Your Name: [seth        ]                 │
│                                             │
│   [Continue]                                │
└─────────────────────────────────────────────┘

→ "Hobby" 선택 후 이름 입력 → "Continue" 클릭
```

> **주의**: Hobby 플랜은 개인/비상업적 용도입니다.
> 나중에 상용 서비스로 전환 시 Pro 플랜($20/월)으로 업그레이드하면 됩니다.

### 2-3. GitHub으로 가입

1. **"Continue with GitHub"** 버튼을 클릭합니다

```
[화면 설명]
┌─────────────────────────────────────────────┐
│   Let's connect your Git provider           │
│                                             │
│   [🐙 Continue with GitHub]   ← 이것 클릭!  │
│   [   Continue with GitLab]                 │
│   [   Continue with Bitbucket]              │
│                                             │
└─────────────────────────────────────────────┘
```

2. GitHub 로그인 페이지가 나타납니다
   - **Username**: `cmg00210-k` (또는 본인 GitHub 계정)
   - **Password**: GitHub 비밀번호 입력
   - **"Sign in"** 클릭

```
[화면 설명 — GitHub 로그인]
┌─────────────────────────────────────────────┐
│   🐙 Sign in to GitHub                     │
│                                             │
│   Username: [cmg00210-k     ]               │
│   Password: [***************]               │
│                                             │
│   [Sign in]                                 │
└─────────────────────────────────────────────┘
```

3. **"Authorize Vercel"** 화면이 나타납니다
   - Vercel이 GitHub 저장소에 접근할 수 있도록 허용하는 것입니다
   - 초록색 **"Authorize Vercel"** 버튼을 클릭합니다

```
[화면 설명 — GitHub 권한 승인]
┌─────────────────────────────────────────────┐
│   Authorize Vercel                          │
│                                             │
│   Vercel by Vercel Inc. would like          │
│   permission to:                            │
│                                             │
│   ✓ Read your profile information           │
│   ✓ Read and write access to code           │
│   ✓ Read and write access to commit status  │
│   ✓ Read and write access to pull requests  │
│                                             │
│   [Authorize Vercel]  ← 초록색 버튼 클릭!    │
└─────────────────────────────────────────────┘
```

4. 이메일 인증이 필요할 수 있습니다
   - Vercel에서 이메일을 보내면 받은편지함에서 인증 링크 클릭

**축하합니다! Vercel 가입이 완료되었습니다.**

---

## 3. 프로젝트 가져오기

### 3-1. 새 프로젝트 만들기

1. Vercel 대시보드에서 **"Add New..."** 버튼을 클릭합니다
2. 드롭다운에서 **"Project"** 를 선택합니다

```
[화면 설명 — Vercel 대시보드]
┌─────────────────────────────────────────────┐
│  Vercel        [Add New... ▼]  [Settings]   │
│                    │                        │
│  Overview          ├─ Project  ← 이것 클릭! │
│                    ├─ Domain                │
│  No projects yet   └─ Store                 │
│                                             │
└─────────────────────────────────────────────┘
```

### 3-2. Git 저장소 선택

1. **"Import Git Repository"** 섹션이 보입니다
2. GitHub 계정(`cmg00210-k`)의 저장소 목록이 나타납니다
3. **`krx-live-chart`** 저장소 옆의 **"Import"** 버튼을 클릭합니다

```
[화면 설명 — Import Repository]
┌─────────────────────────────────────────────┐
│  Import Git Repository                      │
│                                             │
│  ┌─ cmg00210-k ──────────────────────────┐  │
│  │                                       │  │
│  │  krx-live-chart          [Import]     │  │
│  │  ↑ 이 저장소의 Import 버튼 클릭!       │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

> **저장소가 보이지 않나요?**
>
> "Adjust GitHub App Permissions" 링크를 클릭하세요.
> GitHub 설정 페이지가 열리면:
> - **"Repository access"** 에서 **"All repositories"** 선택
> - 또는 **"Only select repositories"** 에서 `krx-live-chart` 추가
> - **"Save"** 클릭 후 Vercel 페이지로 돌아오기

### 3-3. 프로젝트 설정 (Configure Project)

Import를 클릭하면 설정 화면이 나타납니다. 아래와 같이 설정하세요:

```
[화면 설명 — Configure Project]
┌─────────────────────────────────────────────┐
│  Configure Project                          │
│                                             │
│  Project Name: [krx-live-chart]             │
│  (자동으로 채워짐 — 그대로 두세요)             │
│                                             │
│  Framework Preset: [Other        ▼]         │
│  ※ 중요! "Other" 를 선택하세요               │
│  (Next.js, React 등 아닙니다)                │
│                                             │
│  Root Directory: [              ]           │
│  → 비워두세요 (건드리지 마세요)                │
│                                             │
│  ▼ Build and Output Settings (클릭해서 열기) │
│  ┌───────────────────────────────────────┐  │
│  │ Build Command:                        │  │
│  │ [Override] 토글 OFF (비활성)           │  │
│  │ → 건드리지 마세요                      │  │
│  │                                       │  │
│  │ Output Directory:                     │  │
│  │ [Override] 토글 OFF (비활성)           │  │
│  │ → 건드리지 마세요                      │  │
│  │                                       │  │
│  │ Install Command:                      │  │
│  │ [Override] 토글 OFF (비활성)           │  │
│  │ → 건드리지 마세요                      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ▼ Environment Variables                    │
│  → 추가할 것 없음 (건드리지 마세요)           │
│                                             │
│  [Deploy]  ← 파란색 버튼 클릭!               │
└─────────────────────────────────────────────┘
```

**핵심 설정 요약:**

| 항목 | 값 | 설명 |
|------|-----|------|
| **Project Name** | `krx-live-chart` (자동) | 변경 불필요 |
| **Framework Preset** | **`Other`** | 반드시 Other 선택! |
| **Root Directory** | (비움) | 건드리지 않음 |
| **Build Command** | Override 하지 않음 | `vercel.json`에 이미 `null`로 설정됨 |
| **Output Directory** | Override 하지 않음 | `vercel.json`에 이미 `.`으로 설정됨 |
| **Install Command** | Override 하지 않음 | npm 패키지 없음 |
| **Environment Variables** | 없음 | 추가할 것 없음 |

> **중요**: 이 프로젝트에는 이미 `vercel.json` 파일이 있어서 빌드 명령어(`null`)와
> 출력 디렉토리(`.`)가 자동으로 적용됩니다.
> Build and Output Settings를 Override할 필요가 없습니다!

### 3-4. Deploy 클릭

1. **"Deploy"** 파란색 버튼을 클릭합니다
2. 배포가 시작됩니다 (보통 10~30초 소요)
3. 화면에 빌드 로그가 실시간으로 표시됩니다

```
[화면 설명 — 배포 진행 중]
┌─────────────────────────────────────────────┐
│  🎉 Deploying...                            │
│                                             │
│  Building                                   │
│  ├─ Cloning github.com/cmg00210-k/krx...   │
│  ├─ No Build Command found                  │
│  ├─ Output Directory: .                     │
│  └─ Uploading static files...               │
│                                             │
│  ███████████████████░░ 85%                  │
└─────────────────────────────────────────────┘
```

---

## 4. 첫 배포 확인

### 4-1. 배포 완료 화면

배포가 성공하면 축하 화면이 나타납니다:

```
[화면 설명 — 배포 완료!]
┌─────────────────────────────────────────────┐
│                                             │
│   🎉 Congratulations!                       │
│                                             │
│   Your project has been deployed to Vercel  │
│                                             │
│   ┌─────────────────────────────┐           │
│   │  [사이트 미리보기 이미지]      │           │
│   │   CheeseStock 차트 화면      │           │
│   └─────────────────────────────┘           │
│                                             │
│   krx-live-chart-xxxxx.vercel.app           │
│   ↑ 이것이 임시 URL입니다                    │
│                                             │
│   [Continue to Dashboard]                   │
└─────────────────────────────────────────────┘
```

### 4-2. 사이트 동작 확인

1. 화면에 표시된 URL (예: `krx-live-chart-xxxxx.vercel.app`)을 클릭합니다
2. 새 탭에서 CheeseStock 차트가 정상 로드되는지 확인합니다
3. 확인할 것들:
   - 차트가 제대로 그려지는가?
   - 사이드바에 종목 목록이 나오는가?
   - 종목 클릭 시 차트가 변경되는가?

> **주의**: `data/` 폴더는 `.gitignore`에 포함되어 있어 GitHub에 올라가지 않습니다.
> 따라서 Vercel 배포 시 실제 주식 데이터(JSON)가 없으므로 **데모 모드**로 동작합니다.
> 이것은 정상입니다! 실시간 데이터는 별도 WebSocket 서버가 필요합니다.

### 4-3. 배포 실패 시

빌드 에러가 나면 아래를 확인하세요:

| 에러 메시지 | 해결 방법 |
|------------|----------|
| `No Output Directory named "build" found` | Framework Preset이 "Other"로 되어 있는지 확인 |
| `404 - Page not found` | Output Directory가 `.`인지 확인 (`vercel.json` 참고) |
| `Build Failed` | Vercel 대시보드 → Deployments → 실패한 배포 클릭 → 로그 확인 |

---

## 5. 커스텀 도메인 추가

### 5-1. 프로젝트 설정 이동

1. Vercel 대시보드에서 `krx-live-chart` 프로젝트를 클릭합니다
2. 상단 탭에서 **"Settings"** 를 클릭합니다
3. 왼쪽 메뉴에서 **"Domains"** 를 클릭합니다

```
[화면 설명 — Settings → Domains]
┌─────────────────────────────────────────────┐
│  krx-live-chart                             │
│  [Overview] [Deployments] [Analytics]       │
│  [Logs] [Storage] [Settings] ← 클릭!       │
│                                             │
│  Settings                                   │
│  ┌──────────┐ ┌──────────────────────────┐  │
│  │ General   │ │                          │  │
│  │ Domains ← │ │  Domains                 │  │
│  │  이것 클릭!│ │                          │  │
│  │ Git       │ │  Add your domain...      │  │
│  │ ...       │ │                          │  │
│  └──────────┘ └──────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5-2. 메인 도메인 추가 (cheesestock.co.kr)

1. 도메인 입력 필드에 **`cheesestock.co.kr`** 을 입력합니다
2. **"Add"** 버튼을 클릭합니다

```
[화면 설명]
┌─────────────────────────────────────────────┐
│  Domains                                    │
│                                             │
│  [cheesestock.co.kr    ] [Add]              │
│                          ↑ 클릭!             │
└─────────────────────────────────────────────┘
```

3. Vercel이 도메인 설정 방법을 물어봅니다. 아래 중 하나가 나타납니다:

```
[화면 설명 — 도메인 설정 선택]
┌─────────────────────────────────────────────┐
│  How would you like to configure             │
│  cheesestock.co.kr?                         │
│                                             │
│  ● Recommended: Add www.cheesestock.co.kr   │
│    and redirect cheesestock.co.kr to it     │
│                                             │
│  ○ Add cheesestock.co.kr and redirect       │
│    www.cheesestock.co.kr to it              │
│                                             │
│  → 두 번째 옵션을 선택하세요!                 │
│    (www 없는 주소를 메인으로 사용)             │
│                                             │
│  [Add]                                      │
└─────────────────────────────────────────────┘
```

**추천**: 두 번째 옵션을 선택하세요.
- `cheesestock.co.kr` 이 메인 주소가 됩니다
- `www.cheesestock.co.kr` 은 자동으로 `cheesestock.co.kr`로 리다이렉트됩니다
- 둘 다 자동으로 추가됩니다

### 5-3. Vercel이 DNS 레코드를 알려줌

도메인 추가 후, Vercel 화면에 **빨간색 경고**와 함께 DNS 설정 정보가 표시됩니다.
이 정보를 메모하세요! (다음 단계에서 사용합니다)

```
[화면 설명 — DNS 설정 안내]
┌─────────────────────────────────────────────┐
│  Domains                                    │
│                                             │
│  ⚠️ cheesestock.co.kr                       │
│     Invalid Configuration                   │
│                                             │
│     A Record                                │
│     ┌──────────────────────────────────┐    │
│     │ Type: A                          │    │
│     │ Name: @                          │    │
│     │ Value: 76.76.21.21               │    │
│     └──────────────────────────────────┘    │
│     ※ Value가 다를 수 있습니다!              │
│     ※ Vercel 화면에 표시된 IP를 사용하세요    │
│                                             │
│  ⚠️ www.cheesestock.co.kr                   │
│     Invalid Configuration                   │
│                                             │
│     CNAME Record                            │
│     ┌──────────────────────────────────┐    │
│     │ Type: CNAME                      │    │
│     │ Name: www                        │    │
│     │ Value: cname.vercel-dns.com      │    │
│     └──────────────────────────────────┘    │
│     ※ Value가 다를 수 있습니다!              │
│     ※ Vercel 화면에 표시된 값을 사용하세요    │
│                                             │
└─────────────────────────────────────────────┘
```

> **매우 중요**: 위의 IP 주소(`76.76.21.21`)와 CNAME 값(`cname.vercel-dns.com`)은
> 예시입니다. **반드시 Vercel 화면에 실제로 표시된 값을 사용하세요!**
> 2026년 현재 Vercel은 프로젝트별로 고유한 IP/CNAME을 발급할 수 있습니다.

---

## 6. DNS 설정

이 단계는 **도메인을 구매한 사이트**에서 진행합니다.
도메인 구매처에 따라 화면이 다르지만, 설정할 내용은 동일합니다.

### 6-0. 먼저 확인: 도메인 어디서 샀나요?

| 구매처 | DNS 관리 접속 방법 |
|--------|-------------------|
| **가비아** (gabia.com) | My가비아 → 도메인 → DNS 관리툴 → 설정 → 레코드 수정 |
| **카페24** (cafe24.com) | 나의서비스관리 → 도메인관리 → DNS 관리 |
| **호스팅KR** (hosting.kr) | 마이페이지 → 도메인관리 → DNS 설정 |
| **Cloudflare** | Dashboard → 도메인 선택 → DNS → Records |
| **GoDaddy** | My Products → DNS → Manage |
| **네임칩** (namecheap.com) | Domain List → Manage → Advanced DNS |

---

### 6-A. 가비아 (Gabia) DNS 설정 — 가장 상세한 안내

> 한국에서 `.co.kr` 도메인을 가비아에서 사는 경우가 가장 많으므로
> 가비아 기준으로 상세하게 안내합니다.

#### Step 1: 가비아 로그인

1. **https://www.gabia.com** 에 접속합니다
2. 오른쪽 상단 **"로그인"** 클릭
3. 아이디/비밀번호 입력 후 로그인

#### Step 2: DNS 관리 페이지 이동

1. 로그인 후 오른쪽 상단 **"My가비아"** 클릭
2. **"이용 중인 서비스"** 섹션에서 **"도메인"** 옆 숫자를 클릭
3. `cheesestock.co.kr` 도메인을 찾습니다
4. 도메인 오른쪽의 **"관리"** 버튼 클릭
5. **"DNS 관리"** 또는 **"DNS 관리툴"** 클릭

```
[화면 설명 — 가비아 My가비아]
┌─────────────────────────────────────────────┐
│  My가비아                                    │
│                                             │
│  이용 중인 서비스                              │
│  ┌───────────────────────────────────────┐  │
│  │ 도메인   [1개]  ← 숫자 클릭!           │  │
│  │ 호스팅   [0개]                         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  도메인 목록                                  │
│  ┌───────────────────────────────────────┐  │
│  │ cheesestock.co.kr    [관리] ← 클릭!   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

#### Step 3: DNS 레코드 수정

1. DNS 설정 화면에서 **"레코드 수정"** 버튼을 클릭합니다
2. 기존 레코드가 있으면 먼저 확인합니다 (기존 A 레코드가 있다면 삭제하거나 수정)

#### Step 4: A 레코드 추가 (메인 도메인용)

**"레코드 추가"** 버튼을 클릭하고 아래와 같이 입력합니다:

```
[가비아 DNS 레코드 추가]
┌─────────────────────────────────────────────────────────┐
│  타입     호스트    값/위치             TTL              │
│  ─────   ──────   ──────────────────   ─────            │
│  [A  ▼]  [@    ]  [76.76.21.21     ]   [300 ▼]         │
│                                                         │
│  ※ "값/위치"는 Vercel 화면에 표시된 IP를 입력하세요!     │
│  ※ "호스트"에 @ 을 입력합니다 (도메인 자체를 의미)       │
│  ※ TTL은 300 또는 기본값으로 두세요                      │
└─────────────────────────────────────────────────────────┘
```

| 필드 | 입력값 | 설명 |
|------|--------|------|
| **타입** | `A` | A 레코드 (IP 주소 연결) |
| **호스트** | `@` | 도메인 자체 (`cheesestock.co.kr`) |
| **값/위치** | `76.76.21.21` | **Vercel 화면에 표시된 IP** 사용! |
| **TTL** | `300` | 5분 (또는 기본값) |

#### Step 5: CNAME 레코드 추가 (www 서브도메인용)

다시 **"레코드 추가"** 를 클릭하고:

```
[가비아 DNS 레코드 추가]
┌──────────────────────────────────────────────────────────────┐
│  타입       호스트    값/위치                      TTL       │
│  ─────     ──────   ──────────────────────────    ─────     │
│  [CNAME ▼] [www  ]  [cname.vercel-dns.com.   ]   [300 ▼]   │
│                                                              │
│  ※ 가비아에서는 값 끝에 마침표(.)를 붙여야 합니다!            │
│  ※ cname.vercel-dns.com 뒤에 점(.) 추가!                    │
│  ※ Vercel 화면에 다른 값이 표시되면 그 값을 사용하세요        │
└──────────────────────────────────────────────────────────────┘
```

| 필드 | 입력값 | 설명 |
|------|--------|------|
| **타입** | `CNAME` | 별칭 레코드 (도메인 → 도메인) |
| **호스트** | `www` | `www.cheesestock.co.kr` 의 www 부분 |
| **값/위치** | `cname.vercel-dns.com.` | **끝에 마침표(.) 필수!** (가비아 규칙) |
| **TTL** | `300` | 5분 (또는 기본값) |

> **가비아 CNAME 주의사항**: 가비아에서 CNAME 값을 입력할 때
> **반드시 끝에 마침표(`.`)를 붙여야** 합니다!
> - 올바른 입력: `cname.vercel-dns.com.` (마침표 있음)
> - 잘못된 입력: `cname.vercel-dns.com` (마침표 없음 → 오류 발생!)

#### Step 6: 저장

1. 모든 레코드 입력이 끝나면 **"확인"** 또는 **"저장"** 버튼을 클릭합니다
2. "변경 사항을 저장하시겠습니까?" → **"확인"**

#### 최종 확인 — 가비아 DNS 레코드 목록

설정 완료 후 아래와 비슷하게 보여야 합니다:

```
┌──────────────────────────────────────────────────────┐
│  DNS 레코드 목록                                      │
│                                                      │
│  타입    호스트   값/위치                  TTL         │
│  ─────  ──────  ───────────────────────  ─────       │
│  A      @       76.76.21.21              300         │
│  CNAME  www     cname.vercel-dns.com.    300         │
│                                                      │
│  (기존 NS 레코드 등은 건드리지 마세요!)                │
└──────────────────────────────────────────────────────┘
```

---

### 6-B. 카페24 / 호스팅KR / 기타 업체

가비아가 아닌 다른 업체에서 도메인을 구매한 경우에도 설정 내용은 동일합니다:

| 설정 | 값 |
|------|-----|
| **A 레코드**: 호스트 `@`, 값 = Vercel에서 알려준 IP | 예: `76.76.21.21` |
| **CNAME 레코드**: 호스트 `www`, 값 = Vercel에서 알려준 CNAME | 예: `cname.vercel-dns.com` |

> **팁**: DNS 관리 페이지를 못 찾겠으면 해당 업체 고객센터에 전화하세요.
> "도메인 A 레코드랑 CNAME 설정하고 싶은데 어디서 하나요?" 라고 물으면 안내해줍니다.

---

### 6-C. Cloudflare 사용 시 주의사항

Cloudflare에서 DNS를 관리하는 경우:

1. A 레코드와 CNAME 레코드를 동일하게 추가합니다
2. **매우 중요**: 프록시 상태를 반드시 **"DNS only" (회색 구름)** 으로 설정하세요!
   - 주황색 구름(Proxied) → **안 됨!** SSL 충돌 발생
   - 회색 구름(DNS only) → **정상 작동**

```
[Cloudflare 설정]
┌───────────────────────────────────────────────┐
│  Type    Name    Content              Proxy    │
│  A       @       76.76.21.21          ☁ DNS   │ ← 회색 구름!
│  CNAME   www     cname.vercel-dns.com ☁ DNS   │ ← 회색 구름!
│                                                │
│  ※ 주황색 구름 ☁ 이 아닌 회색 구름!              │
└───────────────────────────────────────────────┘
```

---

## 7. SSL 인증서 & 최종 확인

### 7-1. DNS 전파 대기

DNS 설정 후 전파되기까지 시간이 걸립니다:

| 상황 | 소요 시간 |
|------|----------|
| 빠른 경우 | 5~15분 |
| 보통 | 30분~2시간 |
| 느린 경우 (드묾) | 최대 24~48시간 |

### 7-2. Vercel에서 확인

1. Vercel 대시보드 → `krx-live-chart` → Settings → Domains 로 이동합니다
2. DNS가 올바르게 전파되면:
   - 빨간 ⚠️ 경고가 사라지고
   - **초록색 ✓ Valid Configuration** 으로 변경됩니다

```
[화면 설명 — 도메인 설정 완료]
┌─────────────────────────────────────────────┐
│  Domains                                    │
│                                             │
│  ✓ cheesestock.co.kr         ← 초록색!     │
│    Valid Configuration                      │
│                                             │
│  ✓ www.cheesestock.co.kr     ← 초록색!     │
│    Valid Configuration                      │
│    Redirects to cheesestock.co.kr           │
│                                             │
│  ✓ krx-live-chart-xxx.vercel.app            │
│    (기본 Vercel 서브도메인)                   │
└─────────────────────────────────────────────┘
```

### 7-3. SSL 자동 발급

- DNS가 정상 연결되면 Vercel이 자동으로 **Let's Encrypt SSL 인증서**를 발급합니다
- 별도 설정이나 결제가 필요 없습니다
- 발급까지 보통 1~5분 소요
- 완료 후 **https://** 로 접속 가능

### 7-4. 최종 접속 테스트

아래 URL들을 모두 테스트하세요:

| URL | 예상 동작 |
|-----|----------|
| `https://cheesestock.co.kr` | 정상 접속 (메인) |
| `https://www.cheesestock.co.kr` | → `cheesestock.co.kr` 로 리다이렉트 |
| `http://cheesestock.co.kr` | → `https://cheesestock.co.kr` 로 리다이렉트 |
| `http://www.cheesestock.co.kr` | → `https://cheesestock.co.kr` 로 리다이렉트 |

4개 URL 모두 최종적으로 `https://cheesestock.co.kr` 에서 차트가 보이면 성공입니다!

---

## 8. 배포 후 관리

### 8-1. 자동 재배포 (핵심!)

GitHub `main` 브랜치에 push하면 Vercel이 **자동으로 재배포**합니다.

```
개발 흐름:
  코드 수정 → git add/commit → git push origin main
                                    ↓
                              Vercel 자동 감지
                                    ↓
                              새 배포 시작 (10~30초)
                                    ↓
                              사이트 업데이트 완료!
```

### 8-2. 프리뷰 배포

- `main` 이외의 브랜치에 push하면 **프리뷰 URL**이 생성됩니다
- 예: `feature/xxx` 브랜치 push → `krx-live-chart-git-feature-xxx.vercel.app`
- Pull Request를 만들면 PR 코멘트에 프리뷰 URL이 자동 추가됩니다
- 본 배포에 영향 없이 변경사항을 미리 확인할 수 있습니다

### 8-3. 수동 재배포

자동 배포가 작동하지 않을 때:
1. Vercel 대시보드 → `krx-live-chart` → **Deployments** 탭
2. 가장 최근 배포 옆 **"..."** 메뉴 클릭
3. **"Redeploy"** 선택

### 8-4. 배포 상태 확인

- Vercel 대시보드: https://vercel.com/dashboard
- Deployments 탭에서 모든 배포 이력 확인 가능
- 각 배포의 빌드 로그, URL, 상태(성공/실패) 확인

---

## 9. 문제 해결

### Q1: 도메인이 연결 안 됩니다 (계속 빨간 경고)

**원인**: DNS 전파가 아직 안 됨
**해결**:
1. DNS 레코드가 정확히 입력되었는지 다시 확인
2. 최대 48시간까지 기다리기
3. DNS 전파 확인 사이트에서 조회:
   - https://www.whatsmydns.net/ 에서 `cheesestock.co.kr` 검색
   - A 레코드가 Vercel IP로 나오면 전파 완료

### Q2: 사이트는 열리는데 차트가 안 나옵니다

**원인**: `data/` 폴더가 GitHub에 없음 (`.gitignore`에 포함)
**이것은 정상입니다!** 데모 모드로 동작합니다.
실제 데이터를 보려면:
- WebSocket 서버 연동이 필요 (별도 서버 구축)
- 또는 `data/` 폴더를 별도로 호스팅

### Q3: "이 사이트에 연결할 수 없습니다" 에러

**확인 순서**:
1. Vercel 대시보드에서 배포가 성공(초록색)인지 확인
2. `.vercel.app` 기본 URL로 접속 가능한지 확인
3. DNS 레코드가 올바른지 확인
4. 기존에 다른 곳에서 사용하던 DNS 레코드가 남아있지 않은지 확인

### Q4: SSL(https) 인증서 에러

**원인**: DNS 전파 전에 https로 접속 시도
**해결**:
1. DNS가 완전히 전파될 때까지 기다리기
2. Vercel Domains 페이지에서 초록색 체크가 뜬 후 접속
3. 그래도 안 되면 Vercel 대시보드 → Domains → **"Refresh"** 클릭

### Q5: Vercel에 GitHub 저장소가 안 보입니다

**해결**:
1. Vercel Import 화면에서 **"Adjust GitHub App Permissions"** 클릭
2. GitHub 설정에서 **"All repositories"** 선택
3. 또는 **"Only select repositories"** 에서 `krx-live-chart` 추가
4. Save 후 Vercel로 돌아가기

### Q6: Framework Preset을 잘못 선택했습니다

**해결**:
1. Vercel 대시보드 → `krx-live-chart` → **Settings** → **General**
2. **"Framework Preset"** 에서 **"Other"** 로 변경
3. **"Save"** 클릭
4. **Deployments** 탭 → 최근 배포 → **"Redeploy"**

### Q7: "Hobby" 무료 플랜 한도가 궁금합니다

| 항목 | 무료 한도 (월) |
|------|---------------|
| 대역폭 (Bandwidth) | 100GB |
| 배포 횟수 | 무제한 |
| 빌드 시간 | 6,000분 |
| 서버리스 함수 | 100만 회 |
| 이미지 변환 | 5,000회 |

> 정적 사이트라면 100GB 대역폭으로 충분합니다.
> 일일 수천 명 방문해도 문제없는 수준입니다.

---

## 10. 프로젝트 설정 파일 설명

이 프로젝트에는 이미 Vercel 배포용 설정 파일이 포함되어 있습니다.
아래는 각 파일이 하는 역할입니다 (수정할 필요 없음):

### vercel.json

```json
{
  "buildCommand": null,         ← 빌드 명령어 없음 (정적 사이트)
  "outputDirectory": ".",       ← 프로젝트 루트가 곧 배포 디렉토리
  "cleanUrls": true,            ← .html 확장자 없이 접속 가능
  "headers": [...],             ← 보안 헤더 (XSS, HSTS 등)
  "rewrites": [...]             ← WebSocket 프록시 규칙
}
```

### .vercelignore

```
data/          ← 주식 데이터 (대용량, 배포 불필요)
server/        ← Kiwoom WebSocket 서버 (로컬 전용)
scripts/       ← 데이터 다운로드 스크립트
core_data/     ← 학술 문서
pattern_impl/  ← 구현 문서
.git/          ← Git 내부 파일
.claude/       ← Claude 설정
*.bat          ← Windows 배치 파일
*.py           ← Python 스크립트
*.md           ← 마크다운 문서 (README 등)
!index.html    ← index.html은 제외하지 않음 (배포에 포함)
```

### robots.txt / sitemap.xml

> **주의**: 현재 `robots.txt`와 `sitemap.xml`에는 도메인이 `cheesestock.co.kr`으로
> 되어 있습니다. `cheesestock.co.kr`로 수정이 필요합니다.
> (이 파일들을 수정하지 않아도 사이트 동작에는 영향 없지만,
> 검색엔진 최적화(SEO)를 위해 나중에 수정하는 것을 권장합니다.)

---

## 체크리스트 (완료 시 하나씩 확인)

```
[ ] 1. Vercel 회원가입 완료 (GitHub 연동)
[ ] 2. krx-live-chart 프로젝트 Import 완료
[ ] 3. Framework Preset = "Other" 확인
[ ] 4. 첫 배포 성공 (.vercel.app URL 접속 확인)
[ ] 5. cheesestock.co.kr 도메인 추가
[ ] 6. www.cheesestock.co.kr 도메인 추가
[ ] 7. DNS A 레코드 설정 (@ → Vercel IP)
[ ] 8. DNS CNAME 레코드 설정 (www → cname.vercel-dns.com)
[ ] 9. Vercel Domains에서 초록색 체크 확인
[ ] 10. https://cheesestock.co.kr 접속 성공
[ ] 11. https://www.cheesestock.co.kr → cheesestock.co.kr 리다이렉트 확인
[ ] 12. robots.txt / sitemap.xml 도메인 수정 (선택)
```

---

## 소요 시간 예상

| 단계 | 예상 소요 시간 |
|------|---------------|
| Vercel 가입 | 3분 |
| 프로젝트 Import & 배포 | 5분 |
| 도메인 추가 (Vercel 측) | 3분 |
| DNS 설정 (도메인 업체 측) | 10분 |
| DNS 전파 대기 | 5분~48시간 |
| SSL 발급 | 1~5분 (자동) |
| **합계** | **약 20분** + DNS 대기 시간 |

---

*이 가이드는 2026년 3월 기준으로 작성되었습니다.*
*Vercel UI가 변경될 수 있으나 기본 흐름은 동일합니다.*
