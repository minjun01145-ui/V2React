import assert from "node:assert/strict";
import { evaluateSentenceSequence } from "../../src/games/sentence-builder/evaluator.ts";
import { adaptReadingChunksSet, isReadingChunksSet } from "../../src/games/sentence-builder/readingChunksAdapter.ts";

const slashSet = {
  id: "lesson-1",
  title: "Lesson 1",
  type: "reading-chunks",
  items: [
    {
      id: "q1",
      korean: "나는 매일 학교에 간다.",
      english: "I go / to school / every day.",
    },
  ],
};

assert.equal(isReadingChunksSet(slashSet), true);
const adapted = adaptReadingChunksSet(slashSet);
assert.equal(adapted.questions.length, 1);
const question = adapted.questions[0];
assert.ok(question);
assert.deepEqual(question.tokens.map((token) => token.text), ["I go", "to school", "every day."]);

const correct = evaluateSentenceSequence(question, { tokenIds: question.expectedTokenIds, text: "I go to school every day." });
assert.equal(correct.isCorrect, true);
assert.equal(correct.scoreDelta, 100);

const reversed = [...question.expectedTokenIds].reverse();
const incorrect = evaluateSentenceSequence(question, { tokenIds: reversed, text: "every day. to school I go" });
assert.equal(incorrect.isCorrect, false);
assert.equal(incorrect.scoreDelta, 0);

const repeatedTextSet = adaptReadingChunksSet({
  id: "repeat",
  type: "reading-chunks",
  items: [{
    id: "repeat-q",
    korean: "아주 아주 좋아요.",
    chunks: ["It is", "very", "very", "good."],
  }],
});
const repeatedQuestion = repeatedTextSet.questions[0];
assert.ok(repeatedQuestion);
assert.equal(new Set(repeatedQuestion.tokens.map((token) => token.id)).size, 4);
assert.equal(evaluateSentenceSequence(repeatedQuestion, { tokenIds: repeatedQuestion.expectedTokenIds, text: "It is very very good." }).isCorrect, true);

assert.throws(() => adaptReadingChunksSet({
  id: "bad",
  type: "reading-chunks",
  items: [{ korean: "잘못된 문항", chunks: ["only-one"] }],
}), /2개 이상/);

assert.throws(() => adaptReadingChunksSet({
  id: "duplicate",
  type: "reading-chunks",
  items: [
    { id: "same", korean: "첫 문장", chunks: ["A", "B"] },
    { id: "same", korean: "둘째 문장", chunks: ["C", "D"] },
  ],
}), /Question IDs must be unique|unique|Duplicate question id/i);

console.log("sentence-builder evaluator/adapter tests passed");
