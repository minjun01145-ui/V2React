import assert from "node:assert/strict";
import { normalizeProgress } from "../src/game-engine/progress/index.ts";
import { createLeaderboard } from "../src/game-engine/timed-game/leaderboard.ts";
import { resolveStudentSessionState, type StudentSessionSnapshot } from "../src/features/student/session/studentSessionState.ts";
import { SESSION_STATUS } from "../src/multiplayer/constants.ts";
import { participantIdentity, parseRoundParticipant, type RoundParticipant } from "../src/multiplayer/round-participants/model.ts";
import type { GameSession, Player } from "../src/multiplayer/types.ts";

const waitingSession: GameSession = {
  id: "room-1",
  roomId: "room-1",
  gameId: "matching",
  status: SESSION_STATUS.WAITING,
  roundId: null,
  gameConfig: null,
  createdAtMs: 1,
  updatedAtMs: 1,
  startedAtMs: null,
};
const playingSession: GameSession = { ...waitingSession, status: SESSION_STATUS.PLAYING, roundId: "round-1", startedAtMs: 1 };
const player: Player = {
  id: "student-1",
  playerId: "student-1",
  studentNumber: "10101",
  displayName: "홍길동",
  nickname: "길동이",
  state: SESSION_STATUS.PLAYING,
  joinedAtMs: 1,
  lastSeenAtMs: 2,
};
const base: Omit<StudentSessionSnapshot, "session" | "player"> = {
  sessionLoading: false,
  playerLoading: false,
  joining: false,
  sessionError: null,
  playerError: null,
  joinError: null,
  heartbeatError: null,
};

assert.equal(resolveStudentSessionState({ ...base, session: waitingSession, player }).view, "lobby", "WAITING refresh 후 같은 membership이면 lobby로 복원되어야 합니다.");
assert.equal(resolveStudentSessionState({ ...base, session: playingSession, player: null }).view, "joining", "PLAYING 중 membership이 없으면 재입장을 시도해야 합니다.");
assert.equal(resolveStudentSessionState({ ...base, session: playingSession, player }).view, "playing");

const restoredProgress = normalizeProgress({
  currentIndex: 3,
  score: 300,
  correctCount: 3,
  attemptCount: 4,
  combo: 2,
  completedItemIds: ["a", "b", "c"],
  lastResult: null,
  completedAtMs: null,
}, 10);
assert.deepEqual({
  score: restoredProgress.score,
  correctCount: restoredProgress.correctCount,
  attemptCount: restoredProgress.attemptCount,
  combo: restoredProgress.combo,
  completedItemIds: restoredProgress.completedItemIds,
}, { score: 300, correctCount: 3, attemptCount: 4, combo: 2, completedItemIds: ["a", "b", "c"] });

const storedParticipant = parseRoundParticipant(player.id, { ...participantIdentity(player), joinedAtMs: 10 });
assert.ok(storedParticipant);
assert.equal(storedParticipant.id, player.id);
assert.equal(storedParticipant.nickname, "길동이");
const reconnectedParticipant = parseRoundParticipant(player.id, { ...participantIdentity(player), joinedAtMs: storedParticipant.joinedAtMs });
assert.deepEqual(reconnectedParticipant, storedParticipant, "같은 authenticated UID는 같은 participant identity를 복원해야 합니다.");

const offlineParticipant: RoundParticipant = storedParticipant;
const leaderboard = createLeaderboard([offlineParticipant], []);
assert.equal(leaderboard.length, 1);
assert.equal(leaderboard[0]?.score, 0, "presence/progress가 없어도 participant는 0점으로 리더보드에 남아야 합니다.");

const lateJoinPlayer: Player = {
  ...player,
  id: "student-2",
  playerId: "student-2",
  studentNumber: "10102",
  displayName: "김새봄",
  nickname: null,
};
const lateJoinParticipant = parseRoundParticipant(
  lateJoinPlayer.id,
  { ...participantIdentity(lateJoinPlayer), joinedAtMs: 20 },
);
assert.ok(lateJoinParticipant, "PLAYING 중 처음 접속한 학생도 현재 round participant로 등록할 수 있어야 합니다.");
assert.equal(createLeaderboard([lateJoinParticipant], [])[0]?.score, 0, "late join 학생은 progress가 없으면 0점으로 시작해야 합니다.");
assert.equal(
  parseRoundParticipant("different-document", { ...participantIdentity(player), joinedAtMs: 10 }),
  null,
  "participant 문서 ID와 authenticated playerId가 달라 중복 identity가 생기면 거부해야 합니다.",
);

console.log("multiplayer reconnect and participant tests passed");
