# Firestore rules migration

`firestore.rules.secure` is the security model for the **new React app collections**.

Do **not** blindly replace the deployed rules of the legacy Jurye project if the old site is still in use. Firestore allows a single deployed ruleset per database, so first merge the matches for these new collections into the current production rules and test them in the Rules Playground / Emulator.

New-app collections covered here:

- `admins`
- `studentRoster`
- `studentProfiles`
- `multiplayerSessions`

The old project previously had other collections. Their access policy is intentionally not guessed here.
