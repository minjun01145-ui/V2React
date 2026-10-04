import assert from "node:assert/strict";
import { mock } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { selectActivePlayers } from "../src/multiplayer/presence.ts";

const identity = { uid: "student-1", studentNumber: "1", displayName: "학생1" };
let now = 100_000;
let membership = {
  id: identity.uid, playerId: identity.uid, studentNumber: "1", displayName: "학생1",
  nickname: null, state: "waiting", joinedAtMs: now, lastSeenAtMs: now,
};
let session = { id: "room-1", roomId: "room-1", tenantId: "minjun", gameId: "sentence-builder", status: "waiting", roundId: null, expectedPlayerIds: [] };
let participant = null;
let heartbeatEnabled = false;
let studentView;
const result = (value) => ({ value, loading: false, error: null });
// In-memory subscription/presence boundary; render the actual student session hook.
mock.module(new URL("../src/multiplayer/hooks.ts", import.meta.url), {
  namedExports: {
    useSessionSubscription: () => result({ session, slideShow: null }),
    usePlayer: () => ({ player: membership, loading: false, error: null }),
    useRoundParticipant: () => result(participant),
    usePlayerHeartbeat: (_roomId, _playerId, enabled) => {
      heartbeatEnabled = enabled;
      return { error: null };
    },
  },
});
const unexpected = () => { throw new Error("Unexpected membership mutation"); };
mock.module(new URL("../src/multiplayer/repository.ts", import.meta.url), {
  namedExports: { confirmRoundReady: unexpected, joinSession: unexpected, leaveSession: unexpected },
});
mock.module(new URL("../src/slide-show/multiplayerService.ts", import.meta.url), {
  namedExports: { subscribeSlideShowSession: unexpected },
});
mock.module(new URL("../src/features/student/session/prepareStudentRound.ts", import.meta.url), {
  namedExports: { prepareStudentRound: unexpected },
});
try {
  const { useStudentSession } = await import("../src/features/student/session/useStudentSession.ts");
  function Student() {
    studentView = useStudentSession({ roomId: "room-1", identity, onChangeStudent: unexpected }).state.view;
    return null;
  }
  const render = () => renderToString(createElement(Student));
  const teacherRoster = () => selectActivePlayers(membership ? [membership] : [], now, 30_000);
  const elapse = (seconds) => {
    for (let elapsed = 0; elapsed < seconds; elapsed += 10) {
      now += 10_000;
      if (heartbeatEnabled && membership) membership = { ...membership, lastSeenAtMs: now };
    }
  };

  render();
  elapse(40);
  assert.equal(studentView, "lobby");
  assert.equal(teacherRoster().length, 1);
  for (const gameId of ["slide-show", "simple-quiz", "typing-escape"]) {
    session = { ...session, gameId, status: "preparing", roundId: `round-${gameId}` };
    participant = { ...identity, id: identity.uid, playerId: identity.uid, joinedAtMs: now };
    render();
    elapse(40);
    assert.equal(teacherRoster().length, 1, "preparation must preserve presence");
    session = { ...session, status: "playing" };
    render();
    elapse(120);
    assert.equal(studentView, "playing");
    assert.equal(teacherRoster().length, 1, `${gameId}: a connected student must remain available to the teacher during play`);
    session = { ...session, status: "waiting", roundId: null };
    participant = null;
    render();
    assert.equal(studentView, "lobby");
    assert.equal(teacherRoster().length, 1, "returning to the lobby must not briefly erase the roster");
  }
  // A closed student screen stops sending heartbeats and still expires normally.
  heartbeatEnabled = false;
  elapse(40);
  assert.equal(teacherRoster().length, 0);
  membership = null;
  render();
  assert.equal(studentView, "awaiting-nickname");
  assert.equal(heartbeatEnabled, false, "a removed membership must not be recreated by the heartbeat");
} finally {
  mock.restoreAll();
}
console.log("student session presence lifecycle tests passed");
