# Firestore rules migration

`firestore.rules.secure` is the security model for the **new React app collections**.

Do **not** blindly replace the deployed rules of the legacy Jurye project if the old site is still in use. Firestore allows a single deployed ruleset per database, so first merge the matches for these new collections into the current production rules and test them in the Rules Playground / Emulator.

New-app collections covered here:

- `admins`
- `studentRoster`
- `studentProfiles`
- `multiplayerSessions`

Multiplayer progress는 `operations/{uid}/items/{operationId}`의 immutable operation과 `progress/{uid}`의 연속 `revision`을 같은 transaction에서 기록합니다. Rules는 progress write가 자기 operation의 revision을 참조하는지 확인합니다. `answers` 문서 ID는 `{uid}:{attemptId}`이며 학생과 round가 다른 동일 attempt 문자열은 서로 충돌하지 않습니다.

The old project previously had other collections. Their access policy is intentionally not guessed here.
