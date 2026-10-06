import assert from "node:assert/strict";
import { parseLearningSet } from "../src/learning-sets/codec.ts";
import { chunksToWords, sentenceTextKey, splitSentenceWords } from "../src/game-engine/sequence/words.ts";
import { LEARNING_SET_TYPE, isLearningSetType, learningSetTypeLabel } from "../src/learning-sets/types.ts";
import { parseLearningSetPaste, serializeLearningSetItems, validateLearningSetName } from "../src/learning-sets/validation.ts";

const words = parseLearningSetPaste("단어\t뜻\napple\t사과\nclassroom\t교실", LEARNING_SET_TYPE.VOCABULARY);
assert.equal(isLearningSetType("vocabulary"), true);
assert.equal(isLearningSetType("form-changes"), true);
assert.equal(isLearningSetType("future-set-type"), false);
assert.equal(learningSetTypeLabel(LEARNING_SET_TYPE.READING_CHUNKS), "끊어읽기");
assert.equal(learningSetTypeLabel(LEARNING_SET_TYPE.FORM_CHANGES), "단어 변화형");
assert.deepEqual(words, [
  { id: "item-001", sourceText: "apple", meaning: "사과" },
  { id: "item-002", sourceText: "classroom", meaning: "교실" },
]);
assert.equal(serializeLearningSetItems(words), "apple\t사과\nclassroom\t교실");

const reading = parseLearningSetPaste("I go / to school.\t나는 학교에 간다.", LEARNING_SET_TYPE.READING_CHUNKS);
assert.equal(reading[0]?.sourceText, "I go / to school.");
// Regression: a passage sentence the teacher did not split ("What did they say?") blocked the whole set.
assert.deepEqual(
  parseLearningSetPaste("There were / four eyewitnesses.\t있었다 / 네 명의 목격자가.\nWhat did they say?\t그들은 무엇이라고 말했는가?", LEARNING_SET_TYPE.READING_CHUNKS).map((item) => item.sourceText),
  ["There were / four eyewitnesses.", "What did they say?"],
);
assert.throws(() => parseLearningSetPaste("I go / to school.\t나는 / 학교에 / 간다.", LEARNING_SET_TYPE.READING_CHUNKS), /덩어리 수/);
// Regression: a comma inside a chunked sentence was taken as the column separator.
assert.deepEqual(
  parseLearningSetPaste("Yes, / I do.\t응, / 그래.", LEARNING_SET_TYPE.READING_CHUNKS).map((item) => [item.sourceText, item.meaning]),
  [["Yes, / I do.", "응, / 그래."]],
);
assert.deepEqual(
  parseLearningSetPaste("When I was young, / I lived / in Seoul. 어렸을 때, / 나는 살았다 / 서울에", LEARNING_SET_TYPE.READING_CHUNKS).map((item) => [item.sourceText, item.meaning]),
  [["When I was young, / I lived / in Seoul.", "어렸을 때, / 나는 살았다 / 서울에"]],
);
assert.deepEqual(
  parseLearningSetPaste("He / likes / hiking, too.\n그는 / 좋아한다 / 하이킹도\nI go / to school.\n나는 / 학교에 간다", LEARNING_SET_TYPE.READING_CHUNKS).map((item) => [item.sourceText, item.meaning]),
  [["He / likes / hiking, too.", "그는 / 좋아한다 / 하이킹도"], ["I go / to school.", "나는 / 학교에 간다"]],
);

const formChanges = parseLearningSetPaste([
  "뜻\t원급\t비교급\t최상급",
  "빠른\tfast\tfaster\tthe fastest",
  "무거운\theavy\theavier\tthe heaviest",
  "비싼\texpensive\tmore expensive\tthe most expensive",
  "좋은\tgood\tbetter\tthe best",
].join("\n"), LEARNING_SET_TYPE.FORM_CHANGES);
assert.deepEqual(formChanges[0], { id: "item-001", sourceText: "fast", meaning: "빠른", form2: "faster", form3: "the fastest" });
assert.equal(serializeLearningSetItems(formChanges, LEARNING_SET_TYPE.FORM_CHANGES), [
  "빠른\tfast\tfaster\tthe fastest",
  "무거운\theavy\theavier\tthe heaviest",
  "비싼\texpensive\tmore expensive\tthe most expensive",
  "좋은\tgood\tbetter\tthe best",
].join("\n"));
assert.throws(() => parseLearningSetPaste("빠른\tfast\tfaster", LEARNING_SET_TYPE.FORM_CHANGES), /1·2·3단계/);
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
assert.equal(parseLearningSet("forms", { name: "비교급", type: "form-changes", itemCount: 4, createdAtMs: 1, updatedAtMs: 2 }, { items: formChanges })?.items[3]?.form3, "the best");
assert.equal(parseLearningSet("bad-forms", { name: "비교급", type: "form-changes", itemCount: 1, createdAtMs: 1, updatedAtMs: 2 }, { items: [{ id: "x", sourceText: "fast", meaning: "빠른" }] }), null);

// Shared word engine: chunked sentences break into ordered words; the key ignores case, spacing and edge punctuation.
assert.deepEqual(chunksToWords(["I am", "a middle school student."]), ["I", "am", "a", "middle", "school", "student."]);
assert.deepEqual(splitSentenceWords("  Don't   stop!  "), ["Don't", "stop!"]);
assert.equal(sentenceTextKey("I  am"), sentenceTextKey("i am"));
assert.equal(sentenceTextKey("student."), sentenceTextKey("student"));
assert.notEqual(sentenceTextKey("I am"), sentenceTextKey("I"));
assert.equal(sentenceTextKey("?"), "?");

console.log("learning set parser tests passed");
