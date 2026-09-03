import assert from "node:assert/strict";
import {
  resolvePlayingParticipation,
  resolveStudentSessionState,
  type StudentSessionSnapshot,
} from "../src/features/student/session/studentSessionState.ts";
import { SESSION_STATUS } from "../src/multiplayer/constants.ts";
import type { RoundParticipant } from "../src/multiplayer/round-participants/model.ts";
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
  expectedPlayerIds: [],
  sessionData: {},
};

const player: Player = {
  id: "student-1",
  playerId: "student-1",
  studentNumber: "10101",
  displayName: "홍길동",
  nickname: null,
  state: SESSION_STATUS.WAITING,
  joinedAtMs: 0,
  lastSeenAtMs: 0,
};
const participant: RoundParticipant = {
  id: player.id,
  playerId: player.id,
  studentNumber: player.studentNumber,
  displayName: player.displayName,
  nickname: player.nickname,
  joinedAtMs: 1,
};
const playingSession: GameSession = {
  ...session,
  status: SESSION_STATUS.PLAYING,
  roundId: "round-1",
  startedAtMs: 1,
};

const baseSnapshot: StudentSessionSnapshot = {
  session,
  player,
  participant: null,
  sessionLoading: false,
  playerLoading: false,
  participantLoading: false,
  joining: false,
  sessionError: null,
  playerError: null,
  participantError: null,
  readinessError: null,
  joinError: null,
  heartbeatError: null,
};

assert.equal(resolveStudentSessionState(baseSnapshot).view, "lobby");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: { ...session, status: SESSION_STATUS.PREPARING, roundId: "round-1", expectedPlayerIds: [player.id] },
  participant,
}).view, "preparing", "시작 확인 중에는 게임 화면을 먼저 열면 안 됩니다.");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, player: null, joining: true }).view, "loading");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, session: null, player: null }).view, "waiting-for-session");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, player: null }).view, "awaiting-nickname");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: playingSession,
  player: null,
}).view, "joining", "PLAYING 중 player가 없으면 현재 round 재입장을 시도해야 합니다.");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: playingSession,
}).view, "joining", "player가 있어도 current round participant가 없으면 게임에 진입하면 안 됩니다.");
assert.equal(resolvePlayingParticipation({
  session: playingSession,
  player,
  participant: null,
  participantLoading: false,
}), "ensure");
assert.equal(resolvePlayingParticipation({
  session: playingSession,
  player,
  participant: null,
  participantLoading: true,
}), "waiting", "participant initial snapshot 전에는 ensure 결과를 추측하거나 게임에 진입하면 안 됩니다.");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: playingSession,
  participant,
}).view, "playing", "current round participant 확인 후에만 게임에 진입해야 합니다.");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: playingSession,
  participant,
  heartbeatError: new Error("presence temporarily unavailable"),
}).view, "playing", "presence 오류가 게임 시작 전환을 막으면 안 됩니다.");

const playerError = new Error("player subscription failed");
const playerErrorState = resolveStudentSessionState({ ...baseSnapshot, playerError });
assert.equal(playerErrorState.view, "player-error");
if (playerErrorState.view === "player-error") assert.equal(playerErrorState.error, playerError);

const joinError = new Error("join failed");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, player: null, joinError }).view, "join-error");
assert.equal(resolveStudentSessionState({ ...baseSnapshot, joinError }).view, "lobby", "늦게 정상 player snapshot이 도착하면 stale joinError보다 membership을 우선해야 합니다.");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  session: playingSession,
  participant,
  joinError,
}).view, "playing", "늦게 participant까지 확인되면 stale timeout 오류 대신 게임으로 복구해야 합니다.");
assert.equal(resolveStudentSessionState({
  ...baseSnapshot,
  sessionLoading: true,
  sessionError: new Error("session failed"),
}).view, "loading");

console.log("student session state tests passed");
