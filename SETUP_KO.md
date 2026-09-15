# 환경 설정과 배포

이 문서는 로컬 실행과 운영에 필요한 절차만 다룹니다. 실제 설정은 [.env.example](./.env.example), [firebase.json](./firebase.json), [.firebaserc](./.firebaserc), 각 workflow와 package script를 기준으로 합니다. 보안 신뢰 경계는 [SECURITY.md](./SECURITY.md)를 참고하세요.

## Local

Node.js 22 이상을 사용합니다. 현재 루트 패키지의 최소 버전은 22.12.0입니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local`은 다음 실제 변수 이름을 기준으로 채웁니다.

- Firebase Web config: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
- `VITE_ADMIN_AUTH_EMAIL`: 관리자 Firebase Auth 계정 이메일.
- `VITE_FIREBASE_FUNCTIONS_REGION`: 현재 서버와 같은 `asia-northeast3`.
- `VITE_DEFAULT_ROOM_ID`: 기본 수업 방. 기본값은 `.env.example`에 있습니다.
- `VITE_FIREBASE_APP_CHECK_SITE_KEY`: App Check를 사용하는 경우 reCAPTCHA Enterprise 공개 site key.

Firebase Web config, 관리자 이메일과 App Check site key는 공개 식별자이며 비밀이 아닙니다. 관리자 비밀번호, 서비스 계정 키와 API secret은 넣지 않습니다. 환경 변수를 변경하면 dev 서버를 다시 실행하고 배포용 앱은 다시 빌드합니다.

학생은 `http://localhost:5173/`, 교사는 `http://localhost:5173/teacher/`에서 확인합니다.

```bash
npm run check
npm run build
```

## Firebase one-time setup

1. 전용 프로젝트 `v2react-jurye-classroom`의 웹 앱 설정을 사용하고 Firestore를 준비합니다.
2. Firebase Authentication에서 Anonymous와 Email/Password를 활성화합니다.
3. 관리자 Email/Password 사용자를 만들고 이메일을 `VITE_ADMIN_AUTH_EMAIL`에 설정합니다.
4. 해당 Auth UID로 Firestore의 `admins/{uid}` 문서를 만들고 `active: true`로 설정합니다. 이 allow-list는 공개 앱에서 작성하지 않습니다.
5. 아래 절차로 Functions와 [security/firestore.rules.secure](./security/firestore.rules.secure)를 배포합니다. `firebase.json`이 이 Rules 파일을 사용합니다.
6. 관리자 UI의 `학생 관리`에서 명단을 등록하거나 엑셀의 학번·이름 두 열을 붙여넣습니다. PIN 초기화도 이 화면에서 처리합니다.

필요 시 App Check 웹 앱과 reCAPTCHA Enterprise 키를 설정합니다. 허용 도메인과 정상 요청 metrics를 확인한 뒤 enforcement를 적용합니다. 현재 callable은 App Check enforcement를 사용하지 않으므로 site key 설정만으로 Functions enforcement가 활성화되지는 않습니다. 일반 설정은 [Firebase App Check 공식 문서](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)를 참고하세요.

## Functions

[functions/package.json](./functions/package.json)의 검증 명령을 사용합니다.

```bash
npm ci --prefix functions
npm test --prefix functions
```

`test`는 빌드도 실행합니다. 빌드만 필요하면 `npm run build --prefix functions`를 실행합니다.

## GitHub Actions

- [Hosting live workflow](./.github/workflows/firebase-hosting-live.yml): `main` push 또는 수동 실행 시 웹 검사·빌드 후 `dist`를 Hosting live에 배포합니다. Firebase Web config는 YAML에 공개 설정으로 들어 있습니다.
- [Backend live workflow](./.github/workflows/firebase-backend-live.yml): `main`의 Functions, Rules, Firebase 설정 또는 해당 workflow 변경 시 실행하며 수동 실행도 가능합니다. Firestore Rules 배포와 Functions 테스트·빌드 후 `jurye-v2` 배포는 별도 job으로 병렬 실행됩니다. Rules 배포가 Functions 테스트 성공을 기다리는 구조는 아닙니다.

현재 workflow가 참조하는 GitHub Actions Secrets:

| 이름 | 준비할 값 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_V2REACT_JURYE_CLASSROOM` | 이 프로젝트 배포 권한이 있는 서비스 계정 JSON. 실제 비밀값이며 저장소에 커밋하지 않습니다. |
| `VITE_ADMIN_AUTH_EMAIL` | 교사 로그인에 필요한 공개 계정 이메일. |
| `VITE_FIREBASE_FUNCTIONS_REGION` | 리전 설정. 생략하면 클라이언트 기본값을 사용합니다. |
| `VITE_DEFAULT_ROOM_ID` | 기본 방 설정. 생략하면 클라이언트 기본값을 사용합니다. |
| `VITE_FIREBASE_APP_CHECK_SITE_KEY` | App Check 사용 시 공개 site key. |

`GITHUB_TOKEN`은 GitHub가 자동 제공하므로 직접 준비하지 않습니다. GitHub Secrets에 보관하더라도 `VITE_` 값은 빌드 후 공개됩니다.

[Hosting preview workflow](./.github/workflows/firebase-hosting-preview.yml)는 같은 저장소의 PR에서 검사·빌드 후 7일 preview를 배포합니다. live와 달리 위 Local 항목의 Firebase Web config 6개도 같은 이름의 GitHub Secrets에서 읽으므로 preview를 쓰려면 준비해야 합니다. preview도 설정된 Firebase 백엔드에 연결됩니다.

## AI secret

관리자 UI의 `AI API`에서 키를 등록·교체합니다. 서버는 Secret Manager의 `jurye-ollama-cloud-api-key`에 버전을 저장합니다. 이 Secret과 Secret Manager API를 준비하고 실제 Functions 실행 계정에 해당 Secret의 읽기·버전 추가 권한을 부여합니다. 권한 설정은 [Secret Manager 공식 문서](https://docs.cloud.google.com/secret-manager/docs/access-control)를 참고하세요.

AI API key는 GitHub Secret이나 `VITE_` 변수에 중복 저장하지 않습니다. 저장된 키는 브라우저에 다시 표시하지 않습니다.

## Manual deployment

저장소 루트에서 Firebase CLI로 로그인하고 프로젝트를 선택합니다. CLI 설치·인증은 [Firebase 공식 문서](https://firebase.google.com/docs/cli)를 참고하세요.

```bash
firebase login
firebase use v2react-jurye-classroom
npm run build
firebase deploy --only hosting
npm ci --prefix functions
npm run build --prefix functions
firebase deploy --only "functions:jurye-v2"
firebase deploy --only firestore:rules
```

필요한 대상만 배포합니다. `firebase.json`에 Functions predeploy 빌드가 없으므로 수동 Functions 배포 전 빌드를 실행합니다. 기존 배포 Rules와 다른 경우 덮어쓸 정책을 먼저 확인하고, 보호 대상에 겹치는 광범위 공개 허용이 없는지 검토합니다.

## Troubleshooting

- Firebase 설정 누락: `.env.local`의 Web config 6개와 실행 중인 앱의 프로젝트를 확인하고 dev 서버를 재시작합니다.
- 학생 로그인 실패: 서버·클라이언트 리전, Functions 배포 상태, 관리자 UI의 명단·로그인 허용 상태를 확인합니다. PIN 문제는 관리자 UI에서 초기화합니다.
- 관리자 로그인 실패: Auth 계정 이메일·비밀번호와 `admins/{uid}` allow-list 상태를 확인합니다.
- 권한 또는 App Check 오류: 배포된 Rules, 인증 신원, 허용 도메인과 App Check metrics를 확인합니다. route guard 변경으로 해결하려 하지 않습니다.
- AI 키 저장·조회 실패: Secret 존재 여부와 Functions 실행 계정의 해당 Secret 권한을 확인합니다.
- PowerShell에서 CLI 스크립트 실행이 막히면 `firebase.cmd`로 실행합니다.
