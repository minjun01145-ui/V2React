import assert from "node:assert/strict";
import {
  resolveStudentSessionState,
  type StudentSessionSnapshot,
} from "../src/features/student/session/studentSessionState.ts";
import { SESSION_STATUS } from "../src/multiplayer/constants.ts";
import type { GameSession, Player } from "../src/multiplayer/types.ts";

const session: GameSession = {
  id: "room-1",
  roomId: "room-1",
  gameId: "sentence-builder",
  status: SESSION_STATUS.WAITING,
  roundId: null,
  gameConfig: null,
  createdAtMs: null,
  updatedAtMs: null,
  startedAtMs: null,
};

const player: Player = {
  id: "student-1",
  playerId: "student-1",
  studentNumber: "10101",
  displayName: "홍길동",
  state: SESSION_STATUS.WAITING,
  joinedAtMs: 0,
  lastSeenAtMs: 0,
};

const baseSnapshot: StudentSessionSnapshot = {
  session,
  player,
  sessionLoading: false,
  playerLoading: false,
  joining: false,
  sessionError: null,
  playerError: null,
  joinError: null,
  heartbeatError: null,
};

assert.equal(resolveStudentSessionState(baseSnapshot).view, "lobby");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, joining: true }).view, "loading");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, session: null, player: null }).view, "waiting-for-session");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, player: null }).view, "joining");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: { ...session, status: SESSION_STATUS.PLAYING },
  player: null,
}).view, "game-already-playing");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: { ...session, status: SESSION_STATUS.PLAYING },
}).view, "playing");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: { ...session, status: SESSION_STATUS.PLAYING },
  heartbeatError: new Error("presence temporarily unavailable"),
}).view, "playing", "presence 오류가 게임 시작 전환을 막으면 안 됩니다.");

const playerError = new Error("player subscription failed");
const playerErrorState = resolveStudentSessionState({ ...baseSnapshot, playerError });
assert.equal(playerErrorState.view, "player-error");
if (playerErrorState.view === "player-error") assert.equal(playerErrorState.error, playerError);

const joinError = new Error("join failed");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, player: null, joinError }).view, "join-error");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  sessionLoading: true,
  sessionError: new Error("session failed"),
}).view, "loading");

console.log("student session state tests passed");
