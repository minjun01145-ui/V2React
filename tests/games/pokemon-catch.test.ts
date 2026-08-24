import assert from "node:assert/strict";
import { adaptVocabularySet } from "../../src/games/pokemon-catch/adapter.ts";
import { captureChance, captureScore, didCapture, encounterId } from "../../src/games/pokemon-catch/captureRules.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../src/learning-sets/types.ts";

const vocabularySet: LearningSet = {
  id: "vocab-1",
  name: "기초 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 4,
  createdAtMs: 1,
  updatedAtMs: 1,
  items: [
    { id: "a", sourceText: "apple", meaning: "사과" },
    { id: "b", sourceText: "book", meaning: "책" },
    { id: "c", sourceText: "cat", meaning: "고양이" },
    { id: "d", sourceText: "desk", meaning: "책상" },
  ],
};

const questions = adaptVocabularySet(vocabularySet, "round-1");
assert.equal(questions.questions.length, 4);
assert.equal(questions.choiceCount, 4);
assert.ok(questions.questions.every((question) => question.options.length === 4));
assert.deepEqual(adaptVocabularySet(vocabularySet, "round-1"), questions, "같은 라운드는 같은 문제 순서를 재현해야 합니다.");

assert.throws(() => adaptVocabularySet({ ...vocabularySet, type: LEARNING_SET_TYPE.READING_CHUNKS }, "round-1"), /단어 세트/);
assert.equal(encounterId("same-seed"), encounterId("same-seed"));
assert.ok(encounterId("range") >= 1 && encounterId("range") <= 386);
assert.ok(captureChance(255) > captureChance(3));
assert.equal(didCapture(.5, .49), true);
assert.equal(didCapture(.5, .5), false);
assert.ok(captureScore(200, 3) > captureScore(50, 255));

console.log("pokemon catch tests passed");

