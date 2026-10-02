import assert from "node:assert/strict";
import { mock } from "node:test";

const now = 100_000;
const player = (id, lastSeenAtMs) => ({
  id, playerId: id, studentNumber: id, displayName: id, nickname: null,
  state: "playing", joinedAtMs: 1, lastSeenAtMs,
});
const round = (id) => ({
  id, title: id, gameId: "simple-quiz", durationSeconds: 30,
  source: { kind: "stored-set", setId: "set-1" }, gameConfig: {},
});
const previousParticipants = new Map([["round-old:offline", { playerId: "offline" }]]);
const fixture = {
  players: [player("online", now - 1_000), player("offline", now - 31_000)],
  participants: new Map(previousParticipants),
  session: {
    status: "playing", roundId: "round-old",
    quizGame: {
      plan: { id: "plan-1", name: "퀴즈", schemaVersion: 1, createdAtMs: 1, updatedAtMs: 1, rounds: [round("q1"), round("q2")] },
      currentRoundIndex: 0, phase: "leaderboard", roundIds: ["round-old"],
    },
  },
};
// Replace only persistence and environment boundaries; run the actual round transition.
const unexpected = () => { throw new Error("Unexpected persistence operation"); };
mock.module("firebase/firestore", {
  namedExports: {
    doc: (_db, ...parts) => parts.join("/"),
    deleteField: () => undefined,
    serverTimestamp: () => "server-time",
    setDoc: unexpected,
    runTransaction: async (_db, work) => work({
      get: async () => ({ exists: () => true, data: () => fixture.session }),
      update: (_ref, patch) => Object.assign(fixture.session, patch),
      set: (ref, data) => fixture.participants.set(ref, data),
    }),
  },
});
mock.module(new URL("../src/config/appConfig.ts", import.meta.url), {
  namedExports: { appConfig: { playerStaleAfterMs: 30_000 } },
});
mock.module(new URL("../src/firebase/firebaseClient.ts", import.meta.url), {
  namedExports: { db: {} },
});
mock.module(new URL("../src/multiplayer/repository.ts", import.meta.url), {
  namedExports: { loadPlayers: async () => fixture.players, ensureSession: unexpected, subscribeSessionField: unexpected },
});
mock.module(new URL("../src/multiplayer/round-participants/repository.ts", import.meta.url), {
  namedExports: { roundParticipantRef: (_room, round, player) => `${round}:${player}` },
});
mock.method(Date, "now", () => now);
try {
  const { advanceQuizGame } = await import("../src/quiz-game/multiplayerService.ts");
  await advanceQuizGame("room-1");
  assert.deepEqual(fixture.session.expectedPlayerIds, ["online"], "Disconnected students must not block the next round's readiness.");
  assert.equal(fixture.session.status, "preparing");
  assert.equal(fixture.session.quizGame.currentRoundIndex, 1);
  assert.deepEqual(fixture.session.quizGame.roundIds, ["round-old", fixture.session.roundId]);
  assert.equal(fixture.participants.get(`${fixture.session.roundId}:online`)?.playerId, "online");
  assert.equal(fixture.participants.has(`${fixture.session.roundId}:offline`), false);
  assert.deepEqual(fixture.participants.get("round-old:offline"), previousParticipants.get("round-old:offline"), "Previous round participants must remain available for cumulative rankings.");
} finally {
  mock.restoreAll();
}
console.log("quiz game session transition tests passed");
