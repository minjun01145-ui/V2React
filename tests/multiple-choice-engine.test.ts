import assert from "node:assert/strict";
import { evaluateMultipleChoice } from "../src/game-engine/question-engine/multiple-choice/evaluator.ts";
import { buildMultipleChoiceSet } from "../src/game-engine/question-engine/multiple-choice/generator.ts";
import { CHOICE_DIRECTION, type ChoiceCount, type MultipleChoicePair } from "../src/game-engine/question-engine/multiple-choice/types.ts";
import { adaptLearningSetToMultipleChoice, LEARNING_SET_QUESTION_SCOPE } from "../src/learning-sets/multipleChoiceAdapter.ts";
import { parseLearningSetMultipleChoiceOptions } from "../src/learning-sets/multipleChoiceConfig.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../src/learning-sets/types.ts";

const pairs: readonly MultipleChoicePair<{ readonly row: number }>[] = [
  { id: "a", left: "apple", right: "사과", source: { row: 1 } },
  { id: "b", left: "book", right: "책", source: { row: 2 } },
  { id: "c", left: "classroom", right: "교실", source: { row: 3 } },
  { id: "d", left: "desk", right: "책상", source: { row: 4 } },
  { id: "e", left: "eraser", right: "지우개", source: { row: 5 } },
  { id: "f", left: "friend", right: "친구", source: { row: 6 } },
];

for (const choiceCount of [2, 3, 4, 5] as const) {
  const set = buildMultipleChoiceSet({ id: `words-${choiceCount}`, title: "단어", pairs, choiceCount, direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, seed: "same-round" });
  assert.ok(set.questions.length > 0);
  for (const question of set.questions) {
    assert.equal(question.options.length, choiceCount);
    assert.equal(new Set(question.options.map((option) => option.text)).size, choiceCount);
    assert.equal(question.options.filter((option) => option.id === question.correctOptionId).length, 1);
  }
}

const deterministicA = buildMultipleChoiceSet({ id: "det", title: "결정적", pairs, choiceCount: 4, direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, seed: "round-7" });
const deterministicB = buildMultipleChoiceSet({ id: "det", title: "결정적", pairs, choiceCount: 4, direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, seed: "round-7" });
assert.deepEqual(deterministicA, deterministicB);

const reverse = buildMultipleChoiceSet({ id: "reverse", title: "반대", pairs, choiceCount: 3, direction: CHOICE_DIRECTION.RIGHT_TO_LEFT, seed: "reverse", shuffleQuestions: false });
assert.equal(reverse.questions[0]?.prompt, "사과");
assert.ok(reverse.questions[0]?.options.some((option) => option.text === "apple"));

const firstQuestion = deterministicA.questions[0];
assert.ok(firstQuestion);
assert.equal(evaluateMultipleChoice(firstQuestion, { optionId: firstQuestion.correctOptionId }).isCorrect, true);
assert.equal(evaluateMultipleChoice(firstQuestion, { optionId: "missing" }).isCorrect, false);
assert.equal(evaluateMultipleChoice(firstQuestion, { optionId: "missing" }).feedback, "선택한 보기를 찾을 수 없습니다.");
assert.throws(() => evaluateMultipleChoice(firstQuestion, { optionId: firstQuestion.correctOptionId }, -1), /0 이상/);
assert.deepEqual(parseLearningSetMultipleChoiceOptions({ choiceCount: "4", direction: "right-to-left", scope: "chunk", questionLimit: 12, seed: "round" }), {
  choiceCount: 4,
  direction: CHOICE_DIRECTION.RIGHT_TO_LEFT,
  scope: LEARNING_SET_QUESTION_SCOPE.CHUNK,
  questionLimit: 12,
  seed: "round",
});
assert.throws(() => parseLearningSetMultipleChoiceOptions({ choiceCount: 3, direction: "left-to-right", scope: "unknown" }), /범위/);

const ambiguous = buildMultipleChoiceSet({
  id: "ambiguous",
  title: "모호성 제거",
  pairs: [
    { id: "same-a", left: "same", right: "A", source: null },
    { id: "same-b", left: "same", right: "B", source: null },
    { id: "safe-a", left: "safe-a", right: "C", source: null },
    { id: "safe-b", left: "safe-b", right: "D", source: null },
  ],
  choiceCount: 2,
  direction: CHOICE_DIRECTION.LEFT_TO_RIGHT,
  shuffleQuestions: false,
});
assert.deepEqual(ambiguous.questions.map((question) => question.prompt), ["safe-a", "safe-b"]);
assert.throws(() => buildMultipleChoiceSet({
  id: "short",
  title: "부족",
  pairs: [
    { id: "one", left: "one", right: "같음", source: null },
    { id: "two", left: "two", right: "같음", source: null },
  ],
  choiceCount: 2,
  direction: CHOICE_DIRECTION.LEFT_TO_RIGHT,
}), /서로 다른 정답이 부족/);
assert.throws(() => buildMultipleChoiceSet({ id: "bad-count", title: "오류", pairs, choiceCount: 6 as ChoiceCount, direction: CHOICE_DIRECTION.LEFT_TO_RIGHT }), /2개부터 5개/);

const vocabularySet: LearningSet = {
  id: "vocab",
  name: "필수 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: pairs.length,
  createdAtMs: 1,
  updatedAtMs: 2,
  items: pairs.map((pair) => ({ id: pair.id, sourceText: pair.left, meaning: pair.right })),
};
const vocabularyQuestions = adaptLearningSetToMultipleChoice(vocabularySet, { choiceCount: 5, direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, seed: "vocabulary" });
assert.equal(vocabularyQuestions.questions[0]?.source.scope, LEARNING_SET_QUESTION_SCOPE.ENTRY);

const readingSet: LearningSet = {
  id: "reading",
  name: "끊어읽기",
  type: LEARNING_SET_TYPE.READING_CHUNKS,
  itemCount: 3,
  createdAtMs: 1,
  updatedAtMs: 2,
  items: [
    { id: "r1", sourceText: "I go / to school.", meaning: "나는 간다 / 학교에." },
    { id: "r2", sourceText: "She reads / a book.", meaning: "그녀는 읽는다 / 책을." },
    { id: "r3", sourceText: "We play / after class.", meaning: "우리는 논다 / 수업 후에." },
  ],
};
const fullReading = adaptLearningSetToMultipleChoice(readingSet, { choiceCount: 3, direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, scope: LEARNING_SET_QUESTION_SCOPE.ENTRY, seed: "full", shuffleQuestions: false });
assert.equal(fullReading.questions[0]?.prompt, "I go to school.");
assert.ok(fullReading.questions[0]?.options.some((option) => option.text === "나는 간다 학교에."));

const chunkReading = adaptLearningSetToMultipleChoice(readingSet, { choiceCount: 4, direction: CHOICE_DIRECTION.RIGHT_TO_LEFT, scope: LEARNING_SET_QUESTION_SCOPE.CHUNK, seed: "chunks", shuffleQuestions: false });
assert.equal(chunkReading.questions[0]?.prompt, "나는 간다");
assert.ok(chunkReading.questions[0]?.options.some((option) => option.text === "I go"));
assert.equal(chunkReading.questions[0]?.source.chunkIndex, 0);

assert.throws(() => adaptLearningSetToMultipleChoice({
  ...readingSet,
  items: [{ id: "bad", sourceText: "I go / home.", meaning: "나는 집에 간다." }],
}, { choiceCount: 2, direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, scope: LEARNING_SET_QUESTION_SCOPE.CHUNK }), /덩어리 수가 같아야/);

console.log("multiple-choice engine tests passed");
