# Security boundaries

The browser is untrusted. React route guards and hidden links are UX only; authorization is enforced by Firebase Authentication, server-side student verification, and Firestore Security Rules.

## Student boundary

- Student number/name are verified by `prepareStudentLogin` on Cloud Functions against `studentRoster`.
- First login creates a four-digit PIN; later logins verify it with `completeStudentLogin`.
- PIN plaintext is never stored. A per-student salt and scrypt hash live in `studentPinCredentials`, which browser clients cannot read.
- Students use Firebase Anonymous Authentication and receive a unique UID.
- The server sets student custom claims on the Firebase Auth account; the browser force-refreshes the ID token before entering Firestore.
- `studentProfiles/{uid}` is written only by the Admin SDK and is used for persisted profile display.
- Student Firestore writes must match `request.auth.uid` and the signed custom claims.

The first person who knows a correct student number/name can claim that student's initial PIN. This is acceptable only for low-stakes classroom use. Use a teacher-issued setup code or school SSO for stronger first-person identity assurance.

## Administrator boundary

- Admin password is handled only by Firebase Authentication.
- Frontend configuration contains only the dedicated admin account email, which is not a secret.
- Successful password authentication is not enough: `admins/{uid}` must also exist and be active.
- Teacher actions are independently protected by Firestore rules.

## App Check

The web client supports reCAPTCHA Enterprise App Check through `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Enforcement is intentionally not enabled in the included Cloud Functions until production metrics have been verified, to avoid locking out the existing deployment during migration.

See `SECURITY_SETUP.md` before deployment.

## AI provider boundary

- Ollama API keys are written to Google Secret Manager by an administrator-only callable and are never returned to the browser.
- Non-secret provider options are stored in `aiProviderConfigs`, which Firestore rules deny to every browser client.
- Provider endpoints are fixed in server code. The administrator cannot turn the Cloud Function into an arbitrary URL proxy.
- Connection and message tests require an active `admins/{uid}` record.
- Games must expose narrow game-specific callable contracts; students are never given a general-purpose AI chat proxy.

## Learning set boundary

- `learningSets` contains non-sensitive classroom content and intentionally allows public reads.
- Only an allow-listed administrator can create, update, or delete learning-set metadata and content.
- Do not store student information, API keys, passwords, or private teacher notes in learning sets.

## Game-result integrity

The included rules prevent one student from writing another student's progress, but the current game evaluator still runs in the browser. A determined student with developer tools could fabricate their own score payload. For normal classroom activities this may be acceptable; if scores become high-stakes, move answer evaluation/scoring to a callable server function and store only server-produced results.
