# Firebase Hosting + GitHub Actions 배포

이 프로젝트는 GitHub를 소스 저장소로 계속 사용하고, `main` 브랜치에 푸시할 때 Firebase Hosting으로 자동 배포합니다.

```text
코드 수정 -> GitHub Desktop Commit -> Push -> GitHub Actions 빌드 -> Firebase Hosting 배포
```

## 준비물

- GitHub 저장소: `minjun01145-ui/V2React`
- Firebase 프로젝트: `test2222-e2458`
- Node.js 22 이상
- Firebase CLI

Firebase CLI가 없다면 한 번만 설치합니다.

```powershell
npm install -g firebase-tools
```

## 1. Firebase CLI 로그인

프로젝트 루트에서 실행합니다.

```powershell
firebase login
firebase use test2222-e2458
```

## 2. Hosting 사이트와 GitHub 배포 권한 연결

현재 `firebase.json`에는 `dist`를 배포하는 Hosting 설정이 들어 있습니다. GitHub Actions용 서비스 계정과 GitHub Secret을 만들기 위해 다음 명령을 한 번 실행합니다.

```powershell
firebase init hosting:github
```

질문에는 다음 기준으로 답합니다.

- GitHub 저장소: `minjun01145-ui/V2React`
- 빌드 명령: `npm ci && npm run build`
- PR마다 preview channel 생성: Yes
- `main` 브랜치 live 배포: Yes
- live branch: `main`

CLI가 생성하는 워크플로 파일이 이미 존재한다고 물으면 현재 저장소의 파일을 유지합니다. 설정이 끝나면 GitHub 저장소에 다음 Secret이 생성되어 있어야 합니다.

```text
FIREBASE_SERVICE_ACCOUNT_TEST2222_E2458
```

## 3. GitHub Actions Secrets 등록

GitHub 저장소에서 다음 메뉴로 이동합니다.

```text
Settings -> Secrets and variables -> Actions -> Secrets -> New repository secret
```

로컬 `.env.local`의 값을 같은 이름으로 각각 등록합니다.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_ADMIN_AUTH_EMAIL
VITE_FIREBASE_FUNCTIONS_REGION
VITE_DEFAULT_ROOM_ID
VITE_FIREBASE_APP_CHECK_SITE_KEY
```

`VITE_ADMIN_AUTH_EMAIL`과 `VITE_FIREBASE_APP_CHECK_SITE_KEY`는 로컬 값이 비어 있으면 등록을 생략할 수 있습니다. 교사 로그인을 사용하기 전에는 관리자 이메일을, App Check를 활성화하기 전에는 reCAPTCHA Enterprise 사이트 키를 반드시 추가합니다.

관리자 비밀번호, Firebase Admin SDK 키, 서비스 계정 JSON, reCAPTCHA secret은 `VITE_` 환경변수로 등록하지 않습니다.

## 4. 최초 배포

GitHub Desktop에서 이 설정 파일들을 커밋하고 `main`에 Push합니다. GitHub 저장소의 `Actions` 탭에서 `Deploy Firebase Hosting (live)` 작업을 확인합니다.

성공하면 다음 주소로 배포됩니다.

```text
https://test2222-e2458.web.app/
https://test2222-e2458.firebaseapp.com/
```

## 5. 이후 작업 방법

평소에는 아래 과정만 반복합니다.

1. 코드 수정
2. GitHub Desktop에서 Commit
3. Push
4. GitHub Actions가 자동 배포

터미널에서 직접 배포해야 할 때는 다음 명령을 사용합니다.

```powershell
npm run deploy:hosting
```

## 6. Preview 배포

브랜치를 만든 뒤 Pull Request를 열면 `Deploy Firebase Hosting (preview)` 워크플로가 7일 동안 유효한 미리보기 주소를 생성하고 PR에 표시합니다. Preview도 실제 Firebase 백엔드에 접속하므로 테스트 데이터를 사용할 때 주의합니다.

## 7. Functions 배포

Hosting 자동화는 프런트엔드 `dist`만 배포합니다. `functions/`를 수정했을 때는 별도로 배포합니다.

```powershell
firebase deploy --only functions
```

## 8. App Check 확인

reCAPTCHA Enterprise 키의 허용 도메인과 Firebase Authentication의 Authorized domains에 다음 Firebase Hosting 도메인이 등록되어 있는지 확인합니다.

```text
test2222-e2458.web.app
test2222-e2458.firebaseapp.com
```
