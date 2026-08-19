# Jurye v2 기본 로그인/보안 설정

이 버전의 목표는 다음과 같습니다.

- 학생 화면 `/`: **학번 + 이름**만 입력
- 학생 정보 검증: 브라우저가 아니라 **Cloud Functions 서버**에서 `studentRoster`와 비교
- 학생 권한: Firebase Anonymous Auth + 서버가 발급한 custom claims
- 관리자 화면 `/teacher/`: **비밀번호만 입력**
- 관리자 비밀번호: 소스코드/.env/Firestore에 저장하지 않고 **Firebase Authentication**이 검증
- 관리자 권한: Auth 성공 후 `admins/{uid}` 허용 목록을 추가 확인
- Firestore: 학생은 자기 데이터만, 관리자는 관리 데이터에 접근

## 1. `.env.local` 만들기

`.env.example`을 복사하여 `.env.local`을 만듭니다.

```bash
cp .env.example .env.local
```

Firebase Console의 웹 앱 설정값을 채웁니다. `VITE_ADMIN_AUTH_EMAIL`에는 관리자 전용 Firebase Auth 계정 이메일을 넣습니다.

**관리자 비밀번호는 절대 `.env.local`이나 `VITE_...` 변수에 넣지 않습니다.**

Firebase Web API key와 Firebase config는 브라우저에서 보이는 공개 식별 정보입니다. 실제 권한 보호는 Authentication + Security Rules + 서버 함수가 담당합니다.

## 2. Firebase Authentication 켜기

Firebase Console → Authentication → Sign-in method에서:

- Anonymous: 사용
- Email/Password: 사용

관리자용 Email/Password 계정을 Firebase Console에서 직접 하나 생성합니다. 사이트에서 관리자 회원가입 기능은 제공하지 않습니다.

## 3. 관리자 허용 목록 만들기

Firebase Authentication에서 만든 관리자 계정의 UID를 확인합니다.

Firestore에 다음 문서를 1개 만듭니다.

```text
admins/{관리자_UID}
```

예:

```json
{
  "active": true,
  "label": "Teacher Admin"
}
```

`admins` 문서는 클라이언트가 생성/수정할 수 없도록 Security Rules에서 막습니다.

## 4. 학생 명단 넣기

학생 로그인은 단순히 이름을 브라우저에서 비교하지 않습니다. 서버에서 비공개 명단을 확인합니다.

학생 한 명당 다음 문서를 만듭니다.

```text
studentRoster/{학번}
```

예: `studentRoster/20315`

```json
{
  "displayName": "홍길동",
  "active": true
}
```

학생이 `20315 / 홍길동`을 입력하면 Cloud Function이 이 문서를 서버에서 확인합니다. 전체 명단은 학생 브라우저로 내려가지 않습니다.

> 학번+이름은 강한 비밀정보는 아닙니다. 다른 학생의 학번과 이름을 이미 아는 사람이 그 학생인 척하는 것까지 완전히 막으려면 나중에 학생별 PIN 또는 학교 Google 계정 로그인을 추가해야 합니다.

## 5. Cloud Functions 배포

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

새 학생 인증 함수는 서울 리전(`asia-northeast3`)을 사용합니다.

## 6. Firestore Security Rules 적용 — 필수

새 앱 규칙은 다음 파일에 있습니다.

```text
security/firestore.rules.secure
```

기존 Jurye 프로젝트를 계속 사용한다면 이 파일을 무작정 전체 교체하지 말고, 현재 배포된 rules와 **병합**해야 합니다.

특히 기존 rules에 다음과 같은 광범위 허용이 있으면 제거해야 합니다.

```text
allow read, write: if true;
```

Firestore에서는 더 구체적인 새 규칙을 추가해도 다른 겹치는 규칙이 허용하면 접근이 허용될 수 있습니다.

새 앱에서 사용하는 보안 대상 컬렉션:

- `admins`
- `studentRoster`
- `studentProfiles`
- `multiplayerSessions`

## 7. App Check는 기본 로그인 확인 후 권장

`.env.local`에 reCAPTCHA Enterprise의 공개 site key를 넣을 수 있습니다.

```env
VITE_FIREBASE_APP_CHECK_SITE_KEY=...
```

처음부터 enforcement를 켜지 말고 정상 요청이 App Check metrics에 잡히는지 확인한 뒤 Authentication / Firestore / Functions 쪽 enforcement를 켜는 것을 권장합니다. 이후 `functions/src/index.ts`의 callable functions도 `enforceAppCheck: true`로 변경할 수 있습니다.

## 8. 실행 및 검사

웹 앱:

```bash
npm install
npm run check
npm run dev
```

학생:

```text
http://localhost:5173/
```

관리자:

```text
http://localhost:5173/teacher/
```

`npm run check`는 TypeScript, 아키텍처 경계, 보안 불변조건, 인증 입력 검증, 게임 엔진 테스트를 함께 실행합니다.

## 브라우저 소스에서 보여도 되는 것 / 안 되는 것

보여도 되는 것:

- Firebase Web API key/config
- Firebase project ID
- 관리자 계정 이메일(현재 password-only UI의 내부 식별자)
- reCAPTCHA Enterprise site key

절대 넣지 않는 것:

- 관리자 비밀번호
- 서비스 계정 private key
- Firebase Admin SDK credential
- reCAPTCHA secret
- 학생 전체 명단
