import assert from "node:assert/strict";
import { QUIZ_GAME_SCHEMA_VERSION, type QuizGamePlan } from "../src/quiz-game/types.ts";
import { parseQuizGamePlan, parseQuizGameSessionState, validateQuizGameRounds } from "../src/quiz-game/validation.ts";
import { assertQuizGamePhaseTransition, canTransitionQuizGamePhase } from "../src/quiz-game/stateMachine.ts";
import { quizRoundGameConfig } from "../src/quiz-game/runtimeConfig.ts";
import { usesFiniteQuestionSequence } from "../src/game-engine/question-engine/sessionConfig.ts";

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
const directConfig = quizRoundGameConfig({
  ...plan.rounds[0]!,
  gameId: "sentence-builder",
  source: { kind: "custom", setType: "reading-chunks", items: [{ id: "item-1", sourceText: "I go / home.", meaning: "나는 집에 간다." }] },
});
assert.equal(usesFiniteQuestionSequence(directConfig), true);
assert.equal((directConfig.set as { readonly itemCount: number }).itemCount, 1);
assert.equal(usesFiniteQuestionSequence(quizRoundGameConfig(plan.rounds[0]!)), false);

console.log("quiz game model tests passed");
