import assert from "node:assert/strict";
import { mock } from "node:test";

const now = 100_000;
const player = (id, lastSeenAtMs) => ({
  id, playerId: id, studentNumber: id, displayName: id, nickname: null,
  state: "playing", joinedAtMs: 1, lastSeenAtMs,
});
const canvas = JSON.stringify({ objects: [], background: "#ffffff" });
const engine = {
  frame: { x: 140, y: 90, width: 1000, height: 540 },
  round: { gameId: "simple-quiz", source: { kind: "stored-set", setId: "set-1" }, durationSeconds: 30, gameConfig: {} },
};
const fixture = {
  players: [player("online", now - 1_000), player("offline", now - 31_000)],
  participants: new Map(),
  documents: new Map([
    ["multiplayerSessions/room-1", {
      status: "playing", roundId: "run-1", gameId: "slide-show",
      slideShow: { runId: "run-1", showId: "show-1", name: "수업", slideIds: ["s1", "s2"], currentSlideIndex: 1, engine: null, scoredRoundIds: [], awards: {} },
    }],
    ["multiplayerSessions/room-1/showRuns/run-1/slides/s2", { canvas, engine }],
  ]),
};
const session = () => fixture.documents.get("multiplayerSessions/room-1");
// Replace only persistence and environment boundaries; run the actual transition.
const unexpected = () => { throw new Error("Unexpected persistence operation"); };
const path = (base, ...parts) => [...(typeof base === "string" ? [base] : []), ...parts].join("/");
mock.module("firebase/firestore", {
  namedExports: {
    doc: path,
    collection: path,
    deleteField: () => undefined,
    serverTimestamp: () => "server-time",
    setDoc: unexpected,
    getDocs: unexpected,
    runTransaction: async (_db, work) => work({
      get: async (ref) => {
        const data = fixture.documents.get(ref);
        return { id: ref.split("/").at(-1), exists: () => data !== undefined, data: () => data };
      },
      update: (ref, patch) => Object.assign(fixture.documents.get(ref), patch),
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
  namedExports: { roundParticipantRef: (_room, round, playerId) => `${round}:${playerId}` },
});
mock.method(Date, "now", () => now);
try {
  const { startShowSlideEngine, goToShowSlide, closeShowEngine } = await import("../src/slide-show/multiplayerService.ts");
  await startShowSlideEngine("room-1");
  const started = session();
  assert.equal(started.status, "preparing", "an engine uses the normal readiness handshake");
  assert.equal(started.gameId, "simple-quiz");
  assert.deepEqual(started.gameConfig, { setId: "set-1", quizRoundDurationMs: 30_000 });
  assert.deepEqual(started.expectedPlayerIds, ["online"], "disconnected students must not block the engine start");
  assert.equal(started.slideShow.engine.phase, "answering");
  assert.equal(started.slideShow.engine.roundId, started.roundId);
  assert.deepEqual(started.slideShow.scoredRoundIds, [started.roundId]);
  assert.equal(fixture.participants.get(`${started.roundId}:online`)?.playerId, "online");
  assert.equal(fixture.participants.has(`${started.roundId}:offline`), false);

  await assert.rejects(goToShowSlide("room-1", 0), /문제를 마친 뒤/);
  await closeShowEngine("room-1");
  assert.equal(session().status, "playing", "abandoning a preparing engine returns to the slide");
  assert.equal(session().gameId, "slide-show");
  assert.equal(session().slideShow.engine, null);
  await goToShowSlide("room-1", 0);
  assert.equal(session().slideShow.currentSlideIndex, 0);
  await assert.rejects(startShowSlideEngine("room-1"), /문제 엔진이 없습니다/, "slides without an engine cannot start one");
} finally {
  mock.restoreAll();
}
console.log("slide show session transition tests passed");
