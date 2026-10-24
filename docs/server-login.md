# 이 노트북 전용 로그인

2026-10-24 사용자가 **이 노트북에서만 사용**하도록 선택했습니다. 외부 서버·Render·Railway·유료 디스크 구성은 사용하지 않습니다. GitHub는 소스 관리, GitHub Pages는 사용 안내를 담당합니다.

## 실행

- **앱 시작.cmd**: 서버가 없다면 백그라운드에서 실행하고 브라우저를 엽니다. 이미 실행 중이면 기존 서버를 사용합니다.
- **앱 종료.cmd**: 로컬 제어 파일과 실행 식별자를 확인하고 해당 서버를 정상 종료합니다. 계정 DB를 삭제하거나 다른 프로세스를 종료하지 않습니다.
- 주소: `http://127.0.0.1:4173/`
- 초기 관리자 ID: `admin`. 실제 초기 비밀번호는 이 노트북 DB에 해시로만 설정했고 공개 소스에는 포함하지 않습니다.
- 실행 조건: Node.js 24, 노트북이 켜져 있고 서버가 실행 중인 상태. 재부팅 후에는 시작 파일을 다시 실행합니다. 자동 시작 작업이나 Windows 서비스는 등록하지 않습니다.

서버는 `auth/local-config.mjs`에서 loopback 주소와 포트, 로그인 origin을 고정합니다. 외부 호스팅 관련 환경 변수는 이 값을 바꾸지 못합니다. 방화벽·공유기·VPN·터널 설정은 필요하지 않습니다. HTTP는 해당 노트북의 loopback 통신에만 사용합니다.

## 계정 관리

1. 로그인 후 상단 **설정**을 엽니다.
2. 관리자는 ID/비밀번호로 새 일반 계정을 추가하고 계정을 활성/비활성화합니다.
3. 일반 계정은 모델을 사용할 수 있지만 계정 관리는 서버에서 차단됩니다.
4. 모든 계정은 현재 비밀번호를 확인한 뒤 자신의 비밀번호를 변경할 수 있습니다.

로그아웃은 해당 세션을 폐기합니다. 계정 비활성화와 비밀번호 변경은 그 계정의 기존 모든 세션을 폐기합니다. 서버는 30분 미사용 또는 로그인 후 8시간이 지나면 세션을 만료시키고, 앱 화면은 주기적으로 세션을 확인합니다. 종료·절전으로 서버를 사용할 수 없으면 새 접속·로그인을 할 수 없습니다.

비밀번호는 salted scrypt 해시로 보관하며 세션 쿠키는 HttpOnly/SameSite=Strict를 사용합니다. 로그인과 변경 요청은 origin과 요청 헤더를 확인하고, 로그인 후 변경 요청은 CSRF 토큰도 확인합니다. 로그인·비밀번호 변경 시도 횟수는 제한됩니다. Node 서버가 앱 HTML/JS와 API 접근을 검사합니다.

## 저장 위치

| 파일 | 용도 |
| --- | --- |
| `.private/accounts.sqlite` | 계정, 해시, 세션 및 시도 제한 정보 |
| `.private/local-server.json` | 현재 실행 식별자와 비공개 종료 토큰. 정상 종료 시 정리 |
| `.private/server.log` | 백그라운드 실행 오류 확인. 비밀번호·쿠키·요청 본문은 기록하지 않음 |

`.private/`와 SQLite 파일은 Git에서 제외합니다. 새 계정을 만들거나 비밀번호를 바꿔도 공개 저장소에 기록되지 않습니다. 관리자 초기화는 기존 관리자 비밀번호를 변경하지 않습니다.

백업이 필요하면 **앱 종료.cmd로 종료한 뒤** `.private/accounts.sqlite`를 개인 보관 장소에 복사합니다. 이 파일은 계정 정보를 포함하므로 공개 저장소나 공유 폴더에 올리지 않습니다. 계정 DB는 삭제하지 않는 한 서버 재시작·소스 업데이트 후에도 유지됩니다.

환자 비교 설정은 계정 DB에 업로드하지 않습니다. JSON과 환자 측정값 처리는 브라우저 안에서 진행하며, 기기 보관을 선택한 경우 로그인 ID별로 저장 공간을 구분합니다. 이전 GitHub Pages에서 보관한 설정은 localhost로 자동 이동하지 않으므로 기존 JSON 내보내기/불러오기를 사용합니다.

## 검증

`npm test`는 기존 기하·모델·환자 비교 테스트에 로그인, 권한, origin·CSRF, 파일 직접 접근 차단, 비밀번호 변경, 비활성화, 세션 만료, 재시작 후 DB 유지, loopback 설정 고정 및 종료 요청 인증 검사를 포함합니다. 테스트에는 임시 DB와 가상 자격 증명만 사용합니다.

## 참고

- [Node crypto / scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
