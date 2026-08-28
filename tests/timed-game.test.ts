import assert from "node:assert/strict";
import { formatClock, timedGameClockSnapshot } from "../src/game-engine/timed-game/clock.ts";
import { DEFAULT_TIMED_GAME_MODE, TIMED_GAME_MODE, readTimedGameConfig, timedGameConfig, withTimedGameConfig } from "../src/game-engine/timed-game/config.ts";
import { createLeaderboard } from "../src/game-engine/timed-game/leaderboard.ts";
import { moveToNextQuestion } from "../src/game-engine/question-engine/progress.ts";
import type { GameProgress } from "../src/game-engine/question-engine/types.ts";
import type { RoundProgressRecord } from "../src/game-engine/question-engine/multiplayer/types.ts";
import type { Player } from "../src/multiplayer/types.ts";

assert.equal(DEFAULT_TIMED_GAME_MODE, TIMED_GAME_MODE.THREE_MINUTES);
assert.deepEqual(timedGameConfig(TIMED_GAME_MODE.UNLIMITED), { mode: "unlimited", durationMs: null });
assert.equal(readTimedGameConfig(null).durationMs, 180_000);
assert.equal(readTimedGameConfig(withTimedGameConfig({ setId: "set-1" }, TIMED_GAME_MODE.FIVE_MINUTES)).durationMs, 300_000);

const running = timedGameClockSnapshot(timedGameConfig(TIMED_GAME_MODE.THREE_MINUTES), 1_000, 61_000);
assert.equal(running.remainingMs, 120_000);
assert.equal(running.expired, false);
assert.equal(running.progress, 1 / 3);
assert.equal(timedGameClockSnapshot(timedGameConfig(TIMED_GAME_MODE.THREE_MINUTES), 1_000, 181_000).expired, true);
assert.equal(timedGameClockSnapshot(timedGameConfig(TIMED_GAME_MODE.UNLIMITED), 1_000, 999_000).expired, false);
assert.equal(formatClock(120_000), "2:00");
assert.equal(formatClock(null), "∞");

const progress: GameProgress = {
  currentIndex: 1,
  score: 200,
  correctCount: 2,
  attemptCount: 3,
  combo: 0,
  completedQuestionIds: ["q1", "q2"],
  lastResult: { questionId: "q2", status: "correct", isCorrect: true, scoreDelta: 100, feedback: null, details: null },
  completedAtMs: null,
};
const repeated = moveToNextQuestion(progress, 2, { repeat: true });
assert.equal(repeated.currentIndex, 0);
assert.equal(repeated.score, 200);
assert.equal(repeated.combo, 0);
assert.deepEqual(repeated.completedQuestionIds, []);
assert.equal(repeated.completedAtMs, null);

function player(id: string, studentNumber: string, name: string, nickname: string | null = null): Player {
  return { id, playerId: id, studentNumber, displayName: name, nickname, state: "playing", joinedAtMs: 1, lastSeenAtMs: 1 };
}
function roundProgress(playerId: string, score: number, correctCount: number, attemptCount: number): RoundProgressRecord {
  return { id: playerId, gameId: "matching", playerId, displayName: playerId, currentIndex: correctCount, score, correctCount, attemptCount, completedAtMs: null, updatedAtMs: 1 };
}

const leaderboard = createLeaderboard([
  player("a", "101", "가람", "별"), player("b", "102", "나래"), player("c", "103", "다온"),
], [roundProgress("a", 300, 3, 4), roundProgress("b", 500, 4, 6)]);
assert.deepEqual(leaderboard.map((entry) => entry.playerId), ["b", "a", "c"]);
assert.deepEqual(leaderboard.map((entry) => entry.rank), [1, 2, 3]);
assert.equal(leaderboard[1]?.displayName, "별");
assert.equal(leaderboard[2]?.score, 0, "아직 답하지 않은 접속 학생도 0점으로 보여야 합니다.");

const tied = createLeaderboard([player("a", "101", "가람"), player("b", "102", "나래")], [
  roundProgress("a", 100, 1, 1), roundProgress("b", 100, 1, 1),
]);
assert.deepEqual(tied.map((entry) => entry.rank), [1, 1]);
console.log("timed game and leaderboard tests passed");
