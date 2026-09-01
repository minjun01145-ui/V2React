import assert from "node:assert/strict";
import { evaluateMultipleChoice } from "../../src/game-engine/question-engine/multiple-choice/index.ts";
import { adaptSimpleQuizSet } from "../../src/games/simple-quiz/adapter.ts";
import { DEFAULT_SIMPLE_QUIZ_CHOICE_COUNT, simpleQuizChoiceCount } from "../../src/games/simple-quiz/config.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../src/learning-sets/types.ts";
import type { ActiveGameSession } from "../../src/multiplayer/types.ts";

const vocabularySet: LearningSet = {
  id: "simple-quiz-test",
  name: "심플퀴즈 테스트",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 6,
  createdAtMs: 1,
  updatedAtMs: 1,
  items: Array.from({ length: 6 }, (_, index) => ({
    id: `word-${index}`,
    sourceText: `english-${index}`,
    meaning: `뜻-${index}`,
  })),
};

function session(gameConfig: Readonly<Record<string, unknown>> | null): ActiveGameSession {
  return {
    id: "session-1",
    roomId: "room-1",
    gameId: "simple-quiz",
    status: "playing",
    roundId: "round-1",
    expectedPlayerIds: [],
    gameConfig,
    createdAtMs: 1,
    updatedAtMs: 1,
    startedAtMs: 1,
  };
}

assert.equal(simpleQuizChoiceCount(session(null)), DEFAULT_SIMPLE_QUIZ_CHOICE_COUNT);
for (const choiceCount of [2, 3, 4, 5] as const) {
  assert.equal(simpleQuizChoiceCount(session({ "choice-count": String(choiceCount) })), choiceCount);
  const set = adaptSimpleQuizSet(vocabularySet, "round-1", choiceCount);
  assert.equal(set.choiceCount, choiceCount);
  assert.ok(set.questions.every((question) => question.options.length === choiceCount));
}
assert.equal(simpleQuizChoiceCount(session({ "choice-count": 1 })), DEFAULT_SIMPLE_QUIZ_CHOICE_COUNT);
assert.equal(simpleQuizChoiceCount(session({ "choice-count": 6 })), DEFAULT_SIMPLE_QUIZ_CHOICE_COUNT);
assert.equal(simpleQuizChoiceCount(session({ "choice-count": "invalid" })), DEFAULT_SIMPLE_QUIZ_CHOICE_COUNT);

const adapted = adaptSimpleQuizSet(vocabularySet, "round-policy", 4);
assert.equal(adapted.direction, "right-to-left", "심플퀴즈는 뜻을 보고 단어를 고르는 정책을 유지해야 합니다.");
const question = adapted.questions[0];
assert.ok(question);
assert.ok(question.prompt.startsWith("뜻-"));
assert.equal(evaluateMultipleChoice(question, { optionId: question.correctOptionId }, 100).scoreDelta, 100);
assert.equal(evaluateMultipleChoice(question, { optionId: "missing" }, 100).isCorrect, false);

assert.throws(() => adaptSimpleQuizSet({ ...vocabularySet, items: vocabularySet.items.slice(0, 3), itemCount: 3 }, "short", 5), /서로 다른 정답이 부족/);
console.log("simple quiz game tests passed");
