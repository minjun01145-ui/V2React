# Authentication & security setup

This version intentionally does **not** store an administrator password in HTML, TypeScript, `.env`, Firestore, or localStorage.

## Security model

### Students

1. Student enters **student number + name** on `/`.
2. The browser signs in with Firebase **Anonymous Authentication** and receives a unique Firebase Auth UID.
3. `prepareStudentLogin` checks the submitted values against the private `studentRoster` collection on the server.
4. On first login the student creates a four-digit PIN. Later logins require that PIN through `completeStudentLogin`.
5. Only a salted scrypt hash is stored in `studentPinCredentials`; the browser cannot read that collection.
6. On success the server sets Firebase custom claims (`role`, `studentNumber`, `displayName`) and creates `studentProfiles/{uid}`.
7. The client refreshes its Firebase ID token. Firestore rules then use the signed token claims plus the active roster entry.

The browser never receives the full roster or PIN hashes. The endpoints rate-limit attempts per anonymous UID and per student number; Firebase Authentication separately applies abuse limits to new anonymous sign-ins.

**Important limitation:** the first person who knows another student's exact number and name could claim that student's initial PIN. For stronger first-person identity assurance, add a teacher-issued setup code or school Google/Workspace SSO.

### Teachers / administrators

1. `/teacher/` shows a **password-only** form.
2. The actual account identifier comes from `VITE_ADMIN_AUTH_EMAIL`. Email is an identifier, not a secret.
3. The password is sent directly to Firebase Authentication with `signInWithEmailAndPassword`; it is never stored by this app.
4. After Firebase Auth succeeds, the app checks that `admins/{uid}` exists and is active.
5. Firestore rules independently check the same admin allow-list for privileged reads/writes.

Knowing the `/teacher/` URL or inspecting the frontend bundle does not grant administrator access.

## One-time Firebase Console setup

### 1. Authentication providers

Firebase Console → Authentication → Sign-in method:

- Enable **Anonymous** for students.
- Enable **Email/Password** for the dedicated administrator account.

For the admin account, use a unique generated password. In Authentication settings, configure a password policy (long minimum plus uppercase/lowercase/numeric/symbol requirements) and keep email-enumeration protection enabled.

### 2. Create the administrator account

Create one dedicated Email/Password user in Firebase Authentication. Example identifier:

`jurye-admin@your-school-domain.example`

Copy its Firebase Auth **UID**.

Create this Firestore document manually once:

`admins/{ADMIN_UID}`

```json
{
  "active": true,
  "label": "Teacher Admin"
}
```

Do not create admin accounts from the public website.

Set only the account email in `.env.local`:

```env
VITE_ADMIN_AUTH_EMAIL=jurye-admin@your-school-domain.example
```

**Never put the password in a `VITE_...` variable. Vite browser variables are public.**

### 3. Student roster

관리자 로그인 후 `학생 관리` 메뉴에서 한 명씩 등록하거나 엑셀의 학번·이름 두 열을 붙여넣습니다. 관리 UI는 Cloud Functions를 통해 다음 문서를 만듭니다.

`studentRoster/10101`

```json
{
  "displayName": "홍길동",
  "active": true
}
```

Document ID = student number. `displayName` must match what the student types after Unicode/whitespace normalization. PIN 해시는 별도 `studentPinCredentials` 컬렉션에 저장되며 어떤 브라우저 사용자에게도 직접 공개되지 않습니다.

### 4. Deploy Cloud Functions

The new functions are in `functions/` and use Node 22.

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions:jurye-v2
```

The project defaults to function region `asia-northeast3` (Seoul). The client uses the same region.

After the initial setup, changes under `functions/` are deployed automatically from `main` by `.github/workflows/firebase-backend-live.yml`.

### 5. Firestore Security Rules — required

`security/firestore.rules.secure` contains the rules for the new collections.

**Do not blindly replace the old Jurye rules if the legacy app is still live.** Merge these matches into the currently deployed rules, then test them. If the old rules contain a broad rule such as `allow read, write: if true`, that broad allow must be removed for these collections to be secure; Firestore overlapping `allow` rules are permissive (one true allow is enough).

The client code alone cannot secure an open Firestore database.

Changes to this rules file are deployed automatically from `main` by the backend workflow after the Functions tests pass.

### 6. App Check — recommended after the basic login works

For a new web integration, use Firebase App Check with **reCAPTCHA Enterprise**. Add the public site key to:

```env
VITE_FIREBASE_APP_CHECK_SITE_KEY=...
```

Monitor App Check metrics first. After legitimate traffic is verified, enable enforcement for Authentication, Firestore, and Cloud Functions, and change callable functions' `enforceAppCheck` option to `true`.

## Firebase project isolation recommendation

The safest migration from the old project (which previously had little/no security) is either:

- create a **new Firebase project under the same Google/Firebase account** for Jurye v2, or
- carefully audit and replace the old project's permissive Firestore rules before using this new app with real student data.

The code is environment-driven, so moving to a new Firebase project only requires changing `.env.local` and Firebase CLI project selection.

## Do not store

Never store any of these in browser source, `VITE_` variables, GitHub, or Firestore documents readable by clients:

- administrator password
- service-account private key
- Firebase Admin SDK credentials
- reCAPTCHA secret

Firebase Web API keys and the App Check site key are public identifiers; access control must come from Auth, Security Rules, App Check, and server-side credentials.
