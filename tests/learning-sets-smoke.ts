import assert from "node:assert/strict";
import { parseLearningSet } from "../src/learning-sets/codec.ts";
import { LEARNING_SET_TYPE, isLearningSetType, learningSetTypeLabel } from "../src/learning-sets/types.ts";
import { parseLearningSetPaste, serializeLearningSetItems, validateLearningSetName } from "../src/learning-sets/validation.ts";

const words = parseLearningSetPaste("단어\t뜻\napple\t사과\nclassroom\t교실", LEARNING_SET_TYPE.VOCABULARY);
assert.equal(isLearningSetType("vocabulary"), true);
assert.equal(isLearningSetType("future-set-type"), false);
assert.equal(learningSetTypeLabel(LEARNING_SET_TYPE.READING_CHUNKS), "끊어읽기");
assert.deepEqual(words, [
  { id: "item-001", sourceText: "apple", meaning: "사과" },
  { id: "item-002", sourceText: "classroom", meaning: "교실" },
]);
assert.equal(serializeLearningSetItems(words), "apple\t사과\nclassroom\t교실");

const reading = parseLearningSetPaste("I go / to school.\t나는 학교에 간다.", LEARNING_SET_TYPE.READING_CHUNKS);
assert.equal(reading[0]?.sourceText, "I go / to school.");
assert.throws(() => parseLearningSetPaste("I go to school.\t나는 학교에 간다.", LEARNING_SET_TYPE.READING_CHUNKS), /기호로 나눠/);
assert.throws(() => parseLearningSetPaste("I go / to school.\t나는 / 학교에 / 간다.", LEARNING_SET_TYPE.READING_CHUNKS), /덩어리 수/);
assert.throws(() => parseLearningSetPaste("apple", LEARNING_SET_TYPE.VOCABULARY), /두 칸/);
assert.equal(validateLearningSetName("  필수 단어  "), "필수 단어");
assert.deepEqual(parseLearningSet("set-1", { name: "필수 단어", type: "vocabulary", itemCount: 2, createdAtMs: 1, updatedAtMs: 2 }, { items: words }), {
  id: "set-1",
  name: "필수 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 2,
  createdAtMs: 1,
  updatedAtMs: 2,
  items: words,
});

console.log("learning set parser tests passed");
