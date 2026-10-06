import assert from "node:assert/strict";
import { evaluateSentenceSequence } from "../../src/games/sentence-builder/evaluator.ts";
import { adaptReadingChunksSet, isReadingChunksSet } from "../../src/games/sentence-builder/readingChunksAdapter.ts";
import { readSentenceUnit } from "../../src/game-engine/sequence/words.ts";
import { settingAppliesToSet } from "../../src/game-engine/contracts/gameDefinition.ts";
import { getGame } from "../../src/games/registry.ts";

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
}), /두 조각 이상/);

// Unsplit passage sentences are skipped; the remaining questions keep their original item index.
const mixed = adaptReadingChunksSet({
  id: "mixed",
  type: "reading-chunks",
  items: [
    { id: "a", sourceText: "What did they say?", meaning: "그들은 무엇이라고 말했는가?" },
    { id: "b", sourceText: "There were / four eyewitnesses.", meaning: "있었다 / 네 명의 목격자가." },
  ],
});
assert.deepEqual(mixed.questions.map((item) => [item.id, item.source.itemIndex]), [["b", 1]]);

assert.throws(() => adaptReadingChunksSet({
  id: "duplicate",
  type: "reading-chunks",
  items: [
    { id: "same", korean: "첫 문장", chunks: ["A", "B"] },
    { id: "same", korean: "둘째 문장", chunks: ["C", "D"] },
  ],
}), /Question IDs must be unique|unique|Duplicate question id/i);

const unitSetting = getGame("sentence-builder").settings.find((setting) => setting.key === "sentence-unit");
assert.ok(unitSetting);
assert.equal(unitSetting.defaultValue, "chunk");
assert.equal(settingAppliesToSet(unitSetting, "reading-chunks"), true);
assert.equal(settingAppliesToSet(unitSetting, "vocabulary"), false);
assert.equal(settingAppliesToSet(unitSetting, null), false);
assert.equal(readSentenceUnit(undefined), "chunk");
assert.equal(readSentenceUnit(null), "chunk");
assert.equal(readSentenceUnit({ "sentence-unit": "invalid" }), "chunk");
assert.equal(readSentenceUnit({ "sentence-unit": "word" }), "word");

const wordQuestion = adaptReadingChunksSet({
  ...slashSet,
  items: [{ id: "words", sourceText: "It is very / VERY good.", meaning: "아주 아주 좋아요." }],
}, "word").questions[0]!;
assert.deepEqual(wordQuestion.tokens.map((token) => token.text), ["It", "is", "very", "VERY", "good."]);
assert.deepEqual(wordQuestion.expectedTokenIds, [0, 1, 2, 3, 4].map((index) => `words:chunk:${index}`));
const wordIds = wordQuestion.expectedTokenIds;
const swapped = [wordIds[0]!, wordIds[1]!, wordIds[3]!, wordIds[2]!, wordIds[4]!];
const swappedResult = evaluateSentenceSequence(wordQuestion, { tokenIds: swapped, text: "It is VERY very good." });
assert.equal(swappedResult.isCorrect, true);
assert.equal(swappedResult.scoreDelta, 100);
assert.deepEqual(swappedResult.details, { selectedCount: 5, expectedCount: 5 });
assert.equal(evaluateSentenceSequence(wordQuestion, { tokenIds: [wordIds[0]!, wordIds[1]!, wordIds[2]!, wordIds[2]!, wordIds[4]!], text: "" }).isCorrect, false);
assert.equal(evaluateSentenceSequence(wordQuestion, { tokenIds: [...swapped.slice(0, -1), "foreign:chunk:4"], text: "" }).isCorrect, false);
assert.equal(evaluateSentenceSequence(wordQuestion, { tokenIds: swapped.slice(0, -1), text: "" }).isCorrect, false);
assert.equal(evaluateSentenceSequence(wordQuestion, { tokenIds: [...wordIds].reverse(), text: "" }).isCorrect, false);
assert.equal(evaluateSentenceSequence(repeatedQuestion, { tokenIds: ["repeat-q:chunk:0", "repeat-q:chunk:2", "repeat-q:chunk:1", "repeat-q:chunk:3"], text: "" }).isCorrect, true);
assert.deepEqual(adaptReadingChunksSet({
  ...slashSet,
  items: [{ id: "unsplit", sourceText: "It is good.", meaning: "좋아요." }, { id: "split", sourceText: "It is / good.", meaning: "좋아요." }],
}, "word").questions.map((item) => item.id), ["split"]);

console.log("sentence-builder evaluator/adapter tests passed");
