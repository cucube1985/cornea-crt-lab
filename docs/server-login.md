# 서버 로그인과 계정 관리

이 버전은 Node.js 24 서버가 앱과 인증 API를 같은 HTTPS origin에서 제공합니다. GitHub Pages에서는 안내 페이지만 제공하고, 앱 HTML/JS 및 계정 API는 인증 서버가 요청별로 권한을 검사합니다. 브라우저에서 CSS를 숨기는 잠금이나 localStorage 비밀번호 검사는 사용하지 않습니다. 공개 GitHub에 있는 모델 소스의 복제·열람을 제한하는 기능은 아닙니다.

## 현재 배포 단계

`codex/server-login`은 인증 서버 구현 브랜치입니다. 보안 서버와 영구 저장소를 먼저 배포·확인한 후 GitHub 저장소 변수 `CORNEA_SERVER_ORIGIN`에 그 HTTPS origin을 등록하고 `main`에 반영합니다. 이 순서 전에는 현재 공개 사이트에 서버 인증이 적용된 것이 아닙니다. GitHub Pages는 Node 서버를 실행하지 않으며, 변경된 Pages workflow는 `dist/` 대신 안내 페이지만 게시합니다.

## 초기 관리자

- 관리자 ID는 `admin`입니다. 최초 실행 시 서버 secret `ADMIN_INITIAL_PASSWORD`로 지정한 비밀번호를 salted scrypt 해시로 저장합니다.
- 비밀번호 원문, 계정 DB, 세션 쿠키, 초기화 secret은 Git에 올리지 않습니다. `.private/`, `.env*`, SQLite 파일은 Git/Docker 빌드에서 제외합니다.
- 관리자 초기화는 기존 관리자 비밀번호를 덮어쓰지 않습니다. 처음 설정한 뒤에는 secret을 제거할 수 있으며, 비밀번호 변경은 로그인 후 설정에서 합니다.
- 로컬에서 비밀번호를 stdin으로 전달해 `npm run init-admin -- --password-stdin`을 실행한 뒤 `npm start`로 시작할 수 있습니다. Node 24가 필요합니다.
- DB 기본 경로는 `.private/accounts.sqlite`이며 `AUTH_DATA_DIR`로 변경할 수 있습니다.

## 배포에 필요한 값

| 값 | 설정 |
| --- | --- |
| 실행 | `node server.mjs` / Dockerfile 제공 |
| Node | 24.x |
| `NODE_ENV` | `production` |
| `PUBLIC_ORIGIN` | 실제 방문할 HTTPS origin, 예: `https://cornea.example.com` (끝 `/` 없음) |
| `PORT` | 호스팅에서 지정한 내부 포트, 기본 4173 |
| `AUTH_DATA_DIR` | **영구 디스크/볼륨** 내부의 쓰기 가능한 디렉터리 |
| `ADMIN_INITIAL_PASSWORD` | 최초 실행에만 필요한 비공개 서버 secret |
| 상태 검사 | `/healthz` |
| `TRUST_PROXY` | 기본 0. 단일 신뢰 프록시가 IP 헤더를 정리/추가하는 환경에서만 1 |

SQLite와 세션은 영구 볼륨에 두고 **인스턴스 1개**로 운영합니다. DB 디렉터리가 임시 파일 시스템에 있으면 재배포 시 계정이 사라질 수 있습니다. Docker volume의 쓰기 권한을 실행 사용자 `node`에게 부여해야 합니다. 서비스 도메인의 HTTPS 종료와 내부 포트 접근은 호스팅/리버스 프록시에서 구성합니다. `PUBLIC_ORIGIN`과 실제 브라우저 주소가 다르면 변경 요청이 차단됩니다. 기기마다 다른 origin을 쓰지 않습니다.

Render에서는 계정 DB를 유지할 persistent disk가 필요하며, 해당 디스크는 유료 서비스에서 지원합니다. Railway에서도 persistent volume을 연결해야 합니다. 호스팅 비용 승인은 별도로 받아야 하며 이 코드나 Dockerfile을 작성하는 것만으로 유료 서비스가 생성되지는 않습니다.

## 새 서버 배포안: Render

`render.yaml`에 검토 가능한 배포안을 포함했습니다. **유료 서비스 생성 전에 사용자 비용 승인과 Render 계정 연결이 필요합니다.** 설정 파일을 GitHub에 올리는 것만으로 서버가 생성되지는 않습니다.

- 싱가포르 리전, Node 24, 512 MB / 0.5 CPU 서버 1개
- 계정 DB 전용 1GB 영구 디스크 (`/var/data/cornea`)
- 공식 요금 기준 서버 US$7/월 + 디스크 US$0.25/월 = 기본 약 **US$7.25/월** (2026-10-24 확인). 세금, 결제 환율, 포함량 초과 비용은 별도이며 생성 화면에서 다시 확인합니다.
- 자동 배포는 끄고, 검증한 서버 로그인 브랜치를 배포합니다. 실제 생성·검증 후 main 전환 및 Pages 입구 연결을 진행합니다.
- Render가 제공하는 `RENDER_EXTERNAL_URL`을 로그인 origin으로 사용합니다. 사용자 도메인을 쓸 때는 `PUBLIC_ORIGIN`을 명시합니다.
- 초기 관리자 비밀번호는 Render의 비공개 환경 변수 입력으로 전달하며 YAML·공개 저장소에 쓰지 않습니다.

배포 순서:

1. 비용 승인 후 Render 연동을 설치·연결하거나 Render 계정에서 GitHub 저장소 접근을 연결합니다. 계정 생성 시 약관 동의·결제 수단 등록은 사용자가 직접 처리합니다.
2. `codex/server-login` 브랜치의 Blueprint를 생성합니다. 실제 청구 항목이 승인 범위와 일치하는지 확인하고, `ADMIN_INITIAL_PASSWORD`는 secret으로 지정합니다.
3. health check, 관리자 로그인, 추가 사용자 로그인, 재배포 후 계정 유지, 비로그인 앱 접근 차단을 실제 HTTPS 주소에서 검증합니다.
4. GitHub 변수 `CORNEA_SERVER_ORIGIN`에 검증한 origin을 설정한 후 main과 GitHub Pages를 전환합니다. 현재 사이트가 보호된다고 안내하는 시점은 이 검증과 전환이 끝난 뒤입니다.

## 사용

1. 로그인 화면에서 ID/비밀번호로 로그인합니다.
2. 상단 **설정**에서 관리자는 계정 목록, 계정 추가, 활성/비활성 상태를 관리합니다. 새 계정은 일반 사용자이며 관리자 권한을 지정하는 공개 API는 없습니다.
3. 모든 사용자는 설정에서 현재 비밀번호를 확인한 뒤 자신의 비밀번호를 변경할 수 있습니다. 변경 후에는 모든 기기의 기존 세션이 폐기됩니다.
4. 로그아웃은 해당 세션을 서버에서도 폐기합니다. 비활성화된 계정의 모든 세션도 폐기됩니다. 앱 화면의 주기적 확인은 최대 약 1분 안에 이를 감지합니다.

30분 미사용 또는 로그인 후 8시간이 지나면 세션이 만료됩니다. 활성 화면에서 최근 입력이 있을 때만 주기적으로 유효 활동을 갱신합니다. 숨겨진 탭의 백그라운드 확인은 만료 시간을 연장하지 않습니다. 세션 쿠키는 HTTPS에서 `__Host-` prefix, Secure, HttpOnly, SameSite=Strict 속성을 사용합니다. 로그인과 변경 요청은 origin/JSON/custom header를 검사하고, 로그인 후 변경 요청은 CSRF 토큰도 확인합니다. 로그인·비밀번호 변경은 서버에서 시도 횟수를 제한합니다.

## 환자 설정

계정 DB에는 로그인 계정과 세션/시도 제한 정보만 저장합니다. 환자 측정값을 서버로 업로드하거나 계정 간 동기화하는 기능은 추가하지 않았습니다. 환자 비교 JSON은 기존처럼 브라우저에서 처리하며, 기기 보관을 선택한 경우 로그인 ID별로 저장 공간을 구분합니다. 공유 기기의 브라우저 저장소 자체는 보안 저장소가 아닙니다. 기존 공개 사이트에서 보관한 설정은 새 서버 origin으로 자동 이동하지 않으므로 필요한 설정은 기존 JSON 내보내기/불러오기를 사용합니다.

## 확인

`npm test`는 기존 기하 테스트와 함께 로그인 실패/권한, origin·CSRF, 앱 파일 직접 접근, 두 기기의 계정 세션, 비활성화/재활성화, 비밀번호 변경, 로그아웃, 시도 제한, 세션 만료, 재시작 후 계정 유지 및 DB의 원문 비밀번호 미저장을 확인합니다. 테스트는 임시 DB와 가상 자격 증명만 사용합니다. 실제 초기 비밀번호는 테스트나 소스에 포함하지 않습니다.

## 참고

- [GitHub Pages 정적 호스팅](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Node crypto / scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Render Persistent Disks](https://render.com/docs/disks)
- [Railway Volumes](https://docs.railway.com/volumes/reference)
