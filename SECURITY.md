# Security boundaries

The browser is untrusted. React route guards and hidden links are UX only; authorization is enforced by Firebase Authentication, server-side student verification, and Firestore Security Rules.

## Student boundary

- Student number/name are verified by `claimStudentIdentity` on Cloud Functions against `studentRoster`.
- Students use Firebase Anonymous Authentication and receive a unique UID.
- The server sets student custom claims on the Firebase Auth account; the browser force-refreshes the ID token before entering Firestore.
- `studentProfiles/{uid}` is written only by the Admin SDK and is used for persisted profile display.
- Student Firestore writes must match `request.auth.uid` and the signed custom claims.

Student number/name alone cannot prove real-world identity if another person already knows them. Add per-student PIN or school SSO if impersonation resistance is required.

## Administrator boundary

- Admin password is handled only by Firebase Authentication.
- Frontend configuration contains only the dedicated admin account email, which is not a secret.
- Successful password authentication is not enough: `admins/{uid}` must also exist and be active.
- Teacher actions are independently protected by Firestore rules.

## App Check

The web client supports reCAPTCHA Enterprise App Check through `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Enforcement is intentionally not enabled in the included Cloud Functions until production metrics have been verified, to avoid locking out the existing deployment during migration.

See `SECURITY_SETUP.md` before deployment.

## Game-result integrity

The included rules prevent one student from writing another student's progress, but the current game evaluator still runs in the browser. A determined student with developer tools could fabricate their own score payload. For normal classroom activities this may be acceptable; if scores become high-stakes, move answer evaluation/scoring to a callable server function and store only server-produced results.
