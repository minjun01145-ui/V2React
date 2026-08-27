# Timed game layer

Games registered with `defineGame` are timed by default. Use `timing: "untimed"` only for an explicit exception such as Pokémon Catch.

The shared student boundary in `GameHost` always renders the synchronized clock and replaces the game with the final-score screen when time expires. Question-style games should pass `repeatQuestions: true` and the boundary's expiration state (or `useTimedGameClock(session).expired`) as `disabled` to `useQuestionEngine`. Custom games should likewise stop submissions when the clock expires and reset their local deck after a full cycle while preserving cumulative score.

Teacher modules for standard score games should render `LiveLeaderboard`. It combines active room players with round progress, includes students who still have zero points, and updates ordering from Firestore snapshots.
