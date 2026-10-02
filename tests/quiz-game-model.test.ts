import assert from "node:assert/strict";
import { QUIZ_GAME_SCHEMA_VERSION, type QuizGamePlan } from "../src/quiz-game/types.ts";
import { parseQuizGamePlan, parseQuizGameSessionState, validateQuizGameRounds } from "../src/quiz-game/validation.ts";
import { advanceQuizGameRound, assertQuizGamePhaseTransition, canTransitionQuizGamePhase, completeQuizGame, createQuizGameSessionState } from "../src/quiz-game/stateMachine.ts";
import { quizRoundGameConfig } from "../src/quiz-game/runtimeConfig.ts";
import { usesFiniteQuestionSequence } from "../src/game-engine/question-engine/sessionConfig.ts";
import { createCumulativeLeaderboard } from "../src/features/teacher/quiz-game-runtime/cumulativeLeaderboard.ts";
import type { RoundParticipant } from "../src/multiplayer/round-participants/model.ts";
import type { RoundProgressRecord } from "../src/multiplayer/game-progress/types.ts";

const plan: QuizGamePlan = {
  id: "plan-1",
  name: "2단원 퀴즈",
  schemaVersion: QUIZ_GAME_SCHEMA_VERSION,
  rounds: [{ id: "round-1", title: "1번 문제", gameId: "simple-quiz", source: { kind: "stored-set", setId: "set-1" }, durationSeconds: 30, gameConfig: { "choice-count": "4" } }],
  createdAtMs: 1,
  updatedAtMs: 2,
};

assert.deepEqual(validateQuizGameRounds(plan.rounds), plan.rounds);
assert.deepEqual(parseQuizGamePlan(plan.id, plan), plan);
assert.deepEqual(parseQuizGameSessionState({ plan, currentRoundIndex: 0, phase: "answering", roundIds: ["runtime-1"] }), {
  plan,
  currentRoundIndex: 0,
  phase: "answering",
  roundIds: ["runtime-1"],
});
assert.equal(parseQuizGameSessionState({ plan, currentRoundIndex: 2, phase: "answering", roundIds: ["runtime-1"] }), null);
assert.throws(() => validateQuizGameRounds([{ ...plan.rounds[0]!, durationSeconds: 5 }]), /10~600초/);
assert.deepEqual(validateQuizGameRounds([{
  ...plan.rounds[0]!,
  gameId: "sentence-builder",
  source: { kind: "custom", setType: "reading-chunks", items: [{ id: "item-1", sourceText: "I go / to school.", meaning: "나는 학교에 간다." }] },
}])[0]?.source.kind, "custom");
assert.throws(() => validateQuizGameRounds([{
  ...plan.rounds[0]!,
  source: { kind: "custom", setType: "reading-chunks", items: [{ id: "item-1", sourceText: "No slash", meaning: "조각 없음" }] },
}]), /\//);
assert.equal(canTransitionQuizGamePhase("answering", "submissions"), true);
assert.equal(canTransitionQuizGamePhase("answering", "leaderboard"), false);
assert.throws(() => assertQuizGamePhaseTransition("submissions", "complete"), /허용되지 않은/);
const twoRoundPlan: QuizGamePlan = { ...plan, rounds: [...plan.rounds, { ...plan.rounds[0]!, id: "round-2", title: "2번 문제" }] };
const initialState = createQuizGameSessionState(twoRoundPlan, "runtime-1");
assert.deepEqual(initialState, { plan: twoRoundPlan, currentRoundIndex: 0, phase: "answering", roundIds: ["runtime-1"] });
const leaderboardState = { ...initialState, phase: "leaderboard" as const };
const advanced = advanceQuizGameRound(leaderboardState, "runtime-2");
assert.equal(advanced.round.id, "round-2");
assert.deepEqual(advanced.state, { plan: twoRoundPlan, currentRoundIndex: 1, phase: "answering", roundIds: ["runtime-1", "runtime-2"] });
assert.deepEqual(completeQuizGame({ ...advanced.state, phase: "leaderboard" }), { ...advanced.state, phase: "complete" });
const directConfig = quizRoundGameConfig({
  ...plan.rounds[0]!,
  gameId: "sentence-builder",
  source: { kind: "custom", setType: "reading-chunks", items: [{ id: "item-1", sourceText: "I go / home.", meaning: "나는 집에 간다." }] },
});
assert.equal(usesFiniteQuestionSequence(directConfig), true);
assert.deepEqual(directConfig.set, {
  id: "quiz-round-1",
  name: "1번 문제",
  type: "reading-chunks",
  itemCount: 1,
  items: [{ id: "item-1", sourceText: "I go / home.", meaning: "나는 집에 간다." }],
});
assert.equal(Object.hasOwn(directConfig.set as object, "createdAtMs"), false);
assert.equal(Object.hasOwn(directConfig.set as object, "updatedAtMs"), false);
assert.deepEqual(quizRoundGameConfig(plan.rounds[0]!), {
  setId: "set-1",
  "choice-count": "4",
  quizRoundDurationMs: 30_000,
});
assert.equal(usesFiniteQuestionSequence(quizRoundGameConfig(plan.rounds[0]!)), false);

const freeRound = {
  ...plan.rounds[0]!, id: "free-round", gameId: "free-response", source: { kind: "free-response" as const, prompt: "오늘 배운 내용을 설명해 보세요." }, gameConfig: {},
};
const freePlan = { ...plan, rounds: [freeRound, plan.rounds[0]!] };
assert.deepEqual(parseQuizGamePlan(plan.id, freePlan), freePlan);
assert.deepEqual(quizRoundGameConfig(freeRound), { freeResponsePrompt: freeRound.source.prompt, quizRoundDurationMs: 30000 });
assert.throws(() => validateQuizGameRounds([{ ...freeRound, source: { kind: "free-response", prompt: " " } }]), /질문/);
assert.throws(() => validateQuizGameRounds([{ ...freeRound, source: { kind: "free-response", prompt: "가".repeat(1001) } }]), /1000/);
assert.throws(() => validateQuizGameRounds([{ ...freeRound, source: { kind: "stored-set", setId: null } }]), /자유 답안/);
assert.throws(() => validateQuizGameRounds([{ ...freeRound, gameId: "ai-tutor" }]), /자유 답안/);
assert.equal(parseQuizGamePlan(plan.id, { ...freePlan, rounds: [{ ...freeRound, source: { kind: "free-response", prompt: "" } }] }), null);
const freeLeaderboard = { ...createQuizGameSessionState(freePlan, "free-runtime"), phase: "leaderboard" as const };
assert.equal(advanceQuizGameRound(freeLeaderboard, "next-runtime").round.gameId, "simple-quiz");

function participant(playerId: string, studentNumber: string, nickname: string | null): RoundParticipant {
  return { id: playerId, playerId, studentNumber, displayName: `이름-${playerId}`, nickname, joinedAtMs: 1 };
}
function progress(playerId: string, score: number, correctCount: number, attemptCount: number): RoundProgressRecord {
  return { id: playerId, playerId, gameId: "simple-quiz", displayName: `저장된 이름-${playerId}`, score, correctCount, attemptCount, currentIndex: correctCount, completedAtMs: null, updatedAtMs: 1, revision: 1 };
}
const cumulative = createCumulativeLeaderboard([
  {
    participants: [participant("a", "101", "이전 별명"), participant("b", "102", null), participant("c", "103", "달"), participant("unanswered", "104", "대기")],
    progress: [progress("a", 100, 1, 1), progress("b", 200, 2, 2), progress("c", 200, 2, 3)],
  },
  {
    participants: [participant("a", "101", "별"), participant("late", "105", "새 참가자")],
    progress: [progress("a", 100, 1, 1), progress("late", 50, 1, 1)],
  },
]);
assert.deepEqual(cumulative.map((entry) => ({ playerId: entry.playerId, rank: entry.rank })), [
  { playerId: "a", rank: 1 }, { playerId: "b", rank: 1 }, { playerId: "c", rank: 3 }, { playerId: "late", rank: 4 }, { playerId: "unanswered", rank: 5 },
], "누적 점수에도 공동 순위와 시도 수 기준을 적용하고 모든 라운드의 참가자를 유지해야 합니다.");
assert.deepEqual(cumulative[0], {
  playerId: "a", displayName: "별", studentNumber: "101", score: 200, correctCount: 2, attemptCount: 2, rank: 1,
}, "점수·정답·시도를 합산하고 마지막 참여 라운드의 닉네임을 표시해야 합니다.");
assert.equal(cumulative[1]?.displayName, "이름-b", "닉네임이 없는 이전 라운드 참가자는 이름과 점수를 유지해야 합니다.");
assert.equal(cumulative[1]?.score, 200, "다음 라운드에 참여하지 않아도 이전 점수가 사라지면 안 됩니다.");
assert.equal(cumulative[4]?.score, 0, "답안을 저장하지 않은 참가자도 0점으로 표시해야 합니다.");
assert.deepEqual(createCumulativeLeaderboard([]), []);

console.log("quiz game model tests passed");
