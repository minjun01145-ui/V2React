# Jurye React classroom base

Firebase Hosting과 GitHub Actions 자동 배포 절차는 [FIREBASE_GITHUB_DEPLOY_KO.md](./FIREBASE_GITHUB_DEPLOY_KO.md)를 참고하세요.

학생 로그인과 명단 관리 구조는 [STUDENT_LOGIN.md](./STUDENT_LOGIN.md)를 참고하세요.

Ollama Cloud 기반 AI API 공통 구조와 게임 연결 원칙은 [AI_API.md](./AI_API.md)를 참고하세요.

엑셀 붙여넣기 기반 학습 세트 구조와 게임 연결 방법은 [LEARNING_SETS.md](./LEARNING_SETS.md)를 참고하세요.

사이트 내부 메시지·입력 팝업과 확장 방법은 [POPUP_ENGINE.md](./POPUP_ENGINE.md)를 참고하세요.

React + TypeScript strict + Vite + Firebase base for browser-only Chromebook classroom games.

## Current system

### Student app `/`

- first screen: student number + name, followed by a four-digit PIN setup/login step
- student credentials are checked **server-side** against `studentRoster`
- Firebase Anonymous Auth gives each browser session an authenticated UID
- server issues verified student custom claims after roster validation
- verified student automatically enters the multiplayer waiting room
- teacher start signal switches the student into the selected game
- students cannot list other students' player documents under the included rules
- small `관리자 페이지` link is shown below the student form

### Teacher app `/teacher/`

- separate HTML/React entry point
- password-only login UI
- password is verified by Firebase Email/Password Authentication
- admin account email comes from `VITE_ADMIN_AUTH_EMAIL` and is not treated as a secret
- a successfully authenticated Firebase user must also be allow-listed in `admins/{uid}`
- after login: administrator home / multiplayer lobby / student roster / learning set editor / AI API / settings
- teacher logout included

## Security model

Frontend route guards are not security. Real authorization comes from:

1. Firebase Authentication
2. server-side `prepareStudentLogin` / `completeStudentLogin` Cloud Functions
3. Firebase custom claims for verified students
4. `admins/{uid}` allow-list for teachers
5. Firestore Security Rules
6. optional/recommended Firebase App Check with reCAPTCHA Enterprise

Read `SECURITY_SETUP.md` before deploying.
한국어 설치/배포 순서는 `SETUP_KO.md`를 참고하세요.

## Project structure

```text
src/
├── apps/
│   ├── student/
│   └── teacher/
├── auth/                 # auth clients, hooks, shared auth types
├── features/
│   ├── student/
│   │   └── login/
│   └── teacher/
│       ├── auth/
│       ├── dashboard/
│       ├── lobby/
│       └── settings/
├── firebase/
├── game-engine/
│   ├── core/              # 최소 공통 계약/순수 유틸
│   ├── question-engine/   # 문제→답→판정→진행 패턴 전용
│   └── contracts/
├── games/
├── learning-sets/         # 세트 타입, parser, Firestore read/admin repositories
├── multiplayer/
├── shared/
└── styles/

functions/
└── src/index.ts          # private roster verification + student claim issuance

security/
└── firestore.rules.secure
```

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Firebase Web config.
2. Enable Anonymous and Email/Password Auth in Firebase Console.
3. Follow `SECURITY_SETUP.md` to create the admin allow-list and student roster.
4. Install/deploy `functions/`.
5. Merge and deploy the secure Firestore rules.
6. Install the web dependencies and run checks.

```bash
npm install
npm run check
npm run dev
```

Production:

```bash
npm run build
```

## Automated checks

`npm run check` runs:

- TypeScript strict typecheck
- architecture boundary check
- security invariant check
- game engine smoke tests
- 2~5지선다 생성·양방향 adapter·정답 판정 테스트
- per-game evaluator/adapter tests
- teacher routing test
- auth input validation test
- popup input model and accessibility contract test
- learning set paste parser test

## Student identity limitation

Student number + name are convenient classroom identifiers, not strong secrets. The included system protects Firebase data and server-verifies the roster, but a person who already knows another student's exact number and name could still attempt impersonation. If that becomes important, add a per-student PIN or school Google/Workspace SSO without changing the game engine.


## Before adding features

- Question-style games use `src/game-engine/question-engine/`; do not stretch it to realtime/board/timing games.
- `StudentIdentity` is authentication identity only. Add long-lived student data in a separate domain when the first such feature exists.
- Keep game evaluator/adapter pure and add `tests/games/<game-id>.test.ts`.
- Promote UI to `shared/ui` only when semantics are domain-neutral, not merely because styling looks similar.
