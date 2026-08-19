# Firebase 설정 가이드 (초심자용)

이 가이드는 Firebase를 처음 설정하는 분들을 위한 단계별 안내입니다.

## 필요한 것

- Google 계정 (무료)
- 인터넷 브라우저

## 1단계: Firebase 프로젝트 만들기

1. https://console.firebase.google.com/ 에 접속합니다.
2. **프로젝트 만들기** 버튼을 클릭합니다.
3. 프로젝트 이름을 입력합니다 (예: `jurye-classroom`).
4. Google Analytics는 "지금 사용 중지"를 선택해도 됩니다 (수업용이라 불필요).
5. **프로젝트 만들기** 버튼을 클릭합니다.

> 기존 프로젝트(`test2222-e2458`)가 있다면 그것을 그대로 사용해도 됩니다.

## 2단계: 웹 앱 추가 및 설정값 얻기

1. Firebase Console 좌측 상단 프로젝트 개요 옆의 **웹 아이콘(</>)** 버튼을 클릭합니다.
2. 앱 닉네임 입력 (예: `jurye-web`).
3. **Firebase Hosting 설정** 체크는 해제해도 됩니다.
4. **앱 등록** 버튼을 클릭합니다.
5. 다음 화면에 표시되는 `firebaseConfig` 블록에서 값을 복사합니다:

```
const firebaseConfig = {
  apiKey: "AIzaXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234:web:abcd1234"
};
```

이 값들을 `.env.local` 파일에 채워 넣습니다:

```env
VITE_FIREBASE_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234:web:abcd1234
```

## 3단계: 인증 제공자 활성화

Firebase Console → **Authentication** → **Sign-in method** 탭:

### 3-1. 익명 인증 (학생용)

1. **Anonymous(익명)** 항목을 클릭합니다.
2. **사용 설정** 토글을 켭니다.
3. **저장** 버튼을 클릭합니다.

### 3-2. 이메일/비밀번호 인증 (관리자용)

1. **Email/Password(이메일/비밀번호)** 항목을 클릭합니다.
2. **사용 설정** 토글을 켭니다.
3. **저장** 버튼을 클릭합니다.

## 4단계: 관리자 계정 만들기

### 4-1. 인증 사용자 생성

Firebase Console → **Authentication** → **Users** 탭:

1. **사용자 추가** 버튼을 클릭합니다.
2. 이메일 입력: 예) `admin@jurye.school`
3. 비밀번호 입력: **강한 비밀번호** (12자 이상, 대소문자+숫자+특수문자 포함 권장)
4. **사용자 추가** 버튼을 클릭합니다.
5. 생성된 사용자의 **User UID** (예: `abc123xyz`)를 복사합니다.

### 4-2. admins 문서 만들기

Firebase Console → **Firestore Database** (아직 만들지 않았다면 "데이터베이스 만들기" 클릭 → 테스트 모드로 시작):

1. **컬렉션 시작** 버튼을 클릭합니다.
2. 컬렉션 ID: `admins` 입력 → 다음.
3. 문서 ID: 4-1에서 복사한 **User UID** 입력.
4. 필드 추가:

   | 필드 | 유형 | 값 |
   |------|------|-----|
   | `active` | boolean | `true` |
   | `label` | string | `Teacher Admin` |

5. **저장** 버튼을 클릭합니다.

### 4-3. 관리자 이메일을 .env.local에 설정

```env
VITE_ADMIN_AUTH_EMAIL=admin@jurye.school
```

> **주의:** 비밀번호는 절대 `.env.local`이나 코드에 입력하지 마세요. 비밀번호는 Firebase Console에만 존재합니다.

## 5단계: 학생 명부(roster) 만들기

Firebase Console → **Firestore Database** → **컬렉션 시작**:

1. 컬렉션 ID: `studentRoster` 입력 → 다음.
2. 각 학생마다 문서를 하나씩 만듭니다:

   - **문서 ID**: 학번 (예: `10101`)
   - 필드:

   | 필드 | 유형 | 값 |
   |------|------|-----|
   | `displayName` | string | 학생 이름 (예: `홍길동`) |
   | `active` | boolean | `true` |

3. 예시:

   ```
   문서 ID: 10101
   displayName: "홍길동"
   active: true
   
   문서 ID: 10102
   displayName: "김철수"
   active: true
   ```

> 학생이 로그인할 때 이 학번과 이름이 정확히 일치해야 합니다.

## 6단계: Cloud Functions 배포

학생 로그인 검증은 Cloud Function에서 처리됩니다.

### 6-1. Firebase CLI 설치

터미널(PowerShell)에서 실행:

```powershell
npm install -g firebase-tools
```

### 6-2. Firebase 로그인

```powershell
firebase login
```

브라우저가 열리면 Google 계정으로 로그인합니다.

### 6-3. Functions 의존성 설치 및 배포

```powershell
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

배포가 완료되면 학생 로그인 기능이 동작합니다.

> Functions 배포 시 Firebase Blaze 요금제(종량제)가 필요합니다. 학생 수가 적으면 월 $0~1 이하입니다.

## 7단계: Firestore 보안 규칙 배포

```powershell
firebase deploy --only firestore:rules
```

> 기존에 배포된 규칙이 있다면 `security/firestore.rules.secure` 내용을 병합해야 합니다.

## 8단계: 로컬에서 실행

```powershell
npm run dev
```

브라우저에서:
- **학생 페이지**: http://localhost:5173/
- **관리자 페이지**: http://localhost:5173/teacher/

## 확인 체크리스트

- [ ] `.env.local`에 6개 Firebase 값 채움
- [ ] `.env.local`에 `VITE_ADMIN_AUTH_EMAIL` 채움
- [ ] Authentication: 익명 + 이메일/비밀번호 활성화
- [ ] 관리자 계정 생성 + `admins/{UID}` 문서 생성
- [ ] `studentRoster` 컬렉션에 학생 문서 추가
- [ ] Cloud Functions 배포 완료
- [ ] Firestore 보안 규칙 배포 완료
- [ ] `npm run dev`로 페이지 접속 확인

## 문제 해결

### "Missing Firebase configuration" 에러
→ `.env.local` 값이 비어 있습니다. 2단계를 다시 확인하세요.

### 학생 로그인 실패
→ Cloud Functions이 배포되지 않았습니다. 6단계를 수행하세요.
→ `studentRoster`에 해당 학번 문서가 있는지, 이름이 정확히 일치하는지 확인하세요.

### 관리자 로그인 실패
→ `VITE_ADMIN_AUTH_EMAIL`이 Firebase Authentication의 사용자 이메일과 일치하는지 확인하세요.
→ `admins/{UID}` 문서가 존재하고 `active: true`인지 확인하세요.

### Firebase CLI 명령이 안 됨
→ PowerShell에서 `firebase.ps1` 실행이 막혀 있을 수 있습니다. `firebase.cmd`로 직접 실행해 보세요.