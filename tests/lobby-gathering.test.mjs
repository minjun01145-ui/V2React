import assert from "node:assert/strict";
import { mock } from "node:test";
import { parseLobbyGathering } from "../src/multiplayer/lobbyGathering.ts";
import { synchronizeLobbyActivity } from "../src/features/student/lobby/lobbyActivity.ts";

const idle = () => ({ activity: null, gatheringRunId: null, gatheringActive: false });
const gathering = { runId: "gather-1", active: true };
for (const invalid of [undefined, null, [], true, {}, { runId: "", active: true }, { runId: " ", active: true }, { runId: "x".repeat(129), active: true }, { runId: "run", active: "true" }]) {
  assert.equal(parseLobbyGathering(invalid), null);
}
assert.deepEqual(parseLobbyGathering(gathering), gathering);
assert.deepEqual(parseLobbyGathering({ ...gathering, active: false }), { ...gathering, active: false });
for (const activity of [null, "solo", "drawing", "sentence", "acid-rain", "platformer", "deathmatch"]) {
  const local = { ...idle(), activity };
  assert.equal(synchronizeLobbyActivity(local, null), local, "free play is unchanged without a teacher command");
  const gathered = synchronizeLobbyActivity(local, gathering);
  assert.equal(gathered.activity, "platformer", `${activity}: gathering takes over every lobby activity`);
  assert.equal(gathered.gatheringActive, true, "the game exit control is locked during gathering");
  assert.equal(synchronizeLobbyActivity(gathered, { ...gathering }), gathered, "repeated snapshots do not re-enter/reset the tower");
  assert.equal(synchronizeLobbyActivity({ ...gathered, activity: null }, gathering).activity, "platformer", "a stale free-play exit cannot escape an active gathering");
  const dismissed = synchronizeLobbyActivity(gathered, { ...gathering, active: false });
  assert.equal(dismissed.activity, null, "dismissal returns free players and gathered players alike to the lobby");
  assert.equal(dismissed.gatheringActive, false);
  const freeAgain = { ...dismissed, activity: "platformer" };
  assert.equal(synchronizeLobbyActivity(freeAgain, { ...gathering, active: false }), freeAgain, "a completed gathering does not interfere with new free play");
  const exited = { ...freeAgain, activity: null };
  assert.equal(synchronizeLobbyActivity(exited, { ...gathering, active: false }), exited, "free exit works after dismissal");
}
assert.equal(synchronizeLobbyActivity(idle(), gathering).activity, "platformer", "late join/reload follows the persisted active command");
assert.equal(synchronizeLobbyActivity({ ...idle(), activity: "drawing" }, { ...gathering, active: false }).activity, null, "a missed gather/dismiss while reconnecting also returns to the lobby");
assert.equal(synchronizeLobbyActivity({ ...idle(), activity: "platformer" }, gathering).activity, "platformer", "gathering an existing tower player keeps the same game on screen");

const documents = new Map([["multiplayerSessions/room-1", { roomId: "room-1", tenantId: "minjun", status: "waiting" }]]);
const snapshot = (ref) => ({ id: ref.split("/").at(-1), exists: () => documents.has(ref), data: () => documents.get(ref) });
let writes = 0;
let tenantId = "minjun";
const unexpected = () => { throw new Error("Unexpected persistence operation"); };
mock.module("firebase/firestore", {
  namedExports: {
    collection: (_db, ...parts) => parts.join("/"),
    doc: (_db, ...parts) => parts.join("/"),
    deleteDoc: unexpected, deleteField: () => undefined,
    getDoc: async (ref) => snapshot(ref), getDocs: async () => ({ docs: [] }),
    serverTimestamp: () => "server-time", setDoc: unexpected, updateDoc: unexpected,
    onSnapshot: (ref, receive) => { receive(snapshot(ref)); return () => {}; },
    runTransaction: async (_db, work) => work({
      get: async (ref) => snapshot(ref),
      update: (ref, patch) => { writes += 1; Object.assign(documents.get(ref), patch); },
      set: (ref, data, options) => {
        writes += 1;
        documents.set(ref, options?.merge ? { ...documents.get(ref), ...data } : data);
      },
    }),
  },
});
mock.module(new URL("../src/config/appConfig.ts", import.meta.url), { namedExports: { appConfig: { defaultGameId: "simple-quiz" } } });
mock.module(new URL("../src/firebase/firebaseClient.ts", import.meta.url), { namedExports: { db: {}, functions: {} } });
mock.module(new URL("../src/tenant/config.ts", import.meta.url), { namedExports: { currentTenantConfig: () => ({ id: tenantId }) } });
mock.module("firebase/functions", { namedExports: { httpsCallable: unexpected } });
try {
  const { gatherLobbyForJumpTower, dismissLobbyGathering, subscribeSession, startSession } = await import("../src/multiplayer/repository.ts");
  const { startStudentQuestionActivity } = await import("../src/student-question-activity/repository.ts");
  const stored = () => documents.get("multiplayerSessions/room-1");
  const read = () => {
    let value;
    subscribeSession("room-1", (session) => { value = session; }, unexpected)();
    return value;
  };
  await gatherLobbyForJumpTower("room-1");
  const first = read().lobbyGathering;
  assert.equal(first.active, true);
  assert.ok(first.runId);
  assert.equal(stored().status, "waiting", "gathering does not change tenant/session routing or start a classroom round");
  assert.equal(read().roomId, "room-1");
  assert.equal(read().tenantId, "minjun");
  await gatherLobbyForJumpTower("room-1");
  assert.equal(writes, 1, "duplicate teacher gathers keep the same run");
  await dismissLobbyGathering("room-1", "stale-run");
  assert.equal(read().lobbyGathering.active, true, "a stale teacher screen cannot dismiss a different gathering");
  await dismissLobbyGathering("room-1", first.runId);
  assert.deepEqual(read().lobbyGathering, { ...first, active: false });
  await dismissLobbyGathering("room-1", first.runId);
  assert.equal(writes, 2, "repeat dismissal is harmless");
  await gatherLobbyForJumpTower("room-1");
  assert.notEqual(read().lobbyGathering.runId, first.runId, "a new gathering gets a distinct persistent command");
  await dismissLobbyGathering("room-1", first.runId);
  assert.equal(read().lobbyGathering.active, true);
  const writesBeforeStart = writes;
  await startSession("room-1");
  assert.equal(writes, writesBeforeStart, "a stale teacher launch cannot start a regular game during gathering");
  assert.equal(stored().status, "waiting");
  await assert.rejects(startStudentQuestionActivity("room-1", { questionCount: 1, englishQuestionsOnly: false }, ["student"]), /집합을 해산/, "a stale teacher cannot start authoring during gathering");
  assert.equal(writes, writesBeforeStart, "rejected authoring does not write a run or replace the lobby command");
  for (const status of ["preparing", "playing", "finished"]) {
    stored().status = status;
    await assert.rejects(gatherLobbyForJumpTower("room-1"), /대기실에서만/);
  }
  stored().status = "waiting";
  stored().classroomActivity = { phase: "active" };
  await assert.rejects(gatherLobbyForJumpTower("room-1"), /대기실에서만/);
  delete stored().classroomActivity;
  tenantId = "hana";
  await assert.rejects(gatherLobbyForJumpTower("room-1"), /속한 대기실/);
  await assert.rejects(dismissLobbyGathering("room-1", read().lobbyGathering.runId), /속한 대기실/);
  const priorWrites = writes;
  documents.set("multiplayerSessions/hana--room-1", { roomId: "hana--room-1", tenantId: "hana", status: "waiting" });
  await gatherLobbyForJumpTower("hana--room-1");
  assert.equal(writes, priorWrites + 1);
  assert.equal(documents.get("multiplayerSessions/hana--room-1").lobbyGathering.active, true);
  await dismissLobbyGathering("hana--room-1", documents.get("multiplayerSessions/hana--room-1").lobbyGathering.runId);
  assert.equal(documents.get("multiplayerSessions/hana--room-1").lobbyGathering.active, false);
  tenantId = "minjun";
  stored().lobbyGathering = { runId: 42, active: true };
  assert.equal(read().lobbyGathering, null, "malformed Firestore commands are rejected at the repository boundary");
  stored().lobbyGathering = { runId: "completed-run", active: false };
  await startStudentQuestionActivity("room-1", { questionCount: 1, englishQuestionsOnly: false }, ["student"]);
  assert.equal(stored().classroomActivity.phase, "active", "question authoring is available after dismissal");
  delete stored().classroomActivity;
  await startSession("room-1");
  assert.equal(stored().status, "preparing", "regular game launch is available after dismissal");
} finally {
  mock.restoreAll();
}
console.log("lobby gathering lifecycle, free-play and repository transition tests passed");
