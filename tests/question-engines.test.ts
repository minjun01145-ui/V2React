import assert from "node:assert/strict";
import { evaluateFillBlank } from "../src/game-engine/question-engine/fill-blank/index.ts";
import { wordClass } from "../src/game-engine/question-engine/fill-blank/wordClass.ts";
import { CHOICE_DIRECTION } from "../src/game-engine/question-engine/multiple-choice/index.ts";
import { evaluateTrueFalse } from "../src/game-engine/question-engine/true-false/index.ts";
import { parseFillBlankBank } from "../src/learning-sets/fillBlankBank.ts";
import { adaptLearningSetToFillBlank } from "../src/learning-sets/fillBlankAdapter.ts";
import { LEARNING_SET_QUESTION_SCOPE } from "../src/learning-sets/multipleChoiceTypes.ts";
import { adaptLearningSetToTrueFalse } from "../src/learning-sets/trueFalseAdapter.ts";
import type { RuntimeLearningSet } from "../src/learning-sets/types.ts";

const words: RuntimeLearningSet = { id: "words", name: "단어", type: "vocabulary", itemCount: 5, items: [
  { id: "a", sourceText: "dog", meaning: "개" }, { id: "b", sourceText: "cat", meaning: "고양이" },
  { id: "c", sourceText: "bird", meaning: "새" }, { id: "d", sourceText: "fish", meaning: "물고기" },
  { id: "e", sourceText: "dog", meaning: "강아지" },
] };

// OX: a false statement is never a synonym of the prompt, and the mix is roughly balanced.
let trues = 0;
let total = 0;
for (const seed of ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"]) {
  const set = adaptLearningSetToTrueFalse(words, { direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, seed });
  for (const question of set.questions) {
    total += 1;
    const accepted = words.items.filter((item) => item.sourceText === question.prompt).map((item) => item.meaning);
    if (question.isTrue) { trues += 1; assert(accepted.includes(question.statement)); }
    else assert(!accepted.includes(question.statement), `${question.prompt} – ${question.statement} would be marked wrong but is right`);
    assert.equal(evaluateTrueFalse(question, { value: question.isTrue }).isCorrect, true);
    assert.equal(evaluateTrueFalse(question, { value: !question.isTrue }).isCorrect, false);
  }
}
assert(trues / total > 0.3 && trues / total < 0.7, `balanced O/X (${trues}/${total})`);
assert.equal(adaptLearningSetToTrueFalse(words, { direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, trueRatio: 1, seed: "x" }).questions.every((q) => q.isTrue), true);

const reading: RuntimeLearningSet = { id: "reading", name: "본문", type: "reading-chunks", itemCount: 6, items: [
  { id: "s1", sourceText: "I / have / a dog.", meaning: "나는 / 가지고 있다 / 개를." },
  { id: "s2", sourceText: "She / likes / playing tennis / after school.", meaning: "그녀는 / 좋아한다 / 테니스 치는 것을 / 방과 후에." },
  { id: "s3", sourceText: "We / went / to the park / yesterday.", meaning: "우리는 / 갔다 / 공원에 / 어제." },
  { id: "s4", sourceText: "My brother / is taller / than me.", meaning: "내 남동생은 / 더 키가 크다 / 나보다." },
  { id: "s5", sourceText: "They / watched / a movie / in the evening.", meaning: "그들은 / 봤다 / 영화를 / 저녁에." },
  { id: "s6", sourceText: "Tom / wants / to visit / his grandmother.", meaning: "Tom은 / 원한다 / 방문하기를 / 그의 할머니를." },
] };
const chunkOx = adaptLearningSetToTrueFalse(reading, { direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, scope: LEARNING_SET_QUESTION_SCOPE.CHUNK, seed: "c" });
assert.equal(chunkOx.questions.length, 22, "chunk scope makes one question per reading chunk");
assert(adaptLearningSetToTrueFalse(reading, { direction: CHOICE_DIRECTION.LEFT_TO_RIGHT, seed: "e" }).questions.every((q) => !q.prompt.includes("/")), "entry scope uses whole sentences");

// Word classes from spelling and context.
assert.equal(wordClass("have", "I"), "verb");
assert.equal(wordClass("visit", "to"), "verb");
assert.equal(wordClass("park", "the"), "noun");
assert.equal(wordClass("in", "movie"), "preposition");
assert.equal(wordClass("watched", "They"), "verb");

// Fill blank: the answer is a word of the sentence, distractors differ from it and share its role.
const blanks = adaptLearningSetToFillBlank(reading, { choiceCount: 4, seed: "fb" });
assert.equal(blanks.questions.length, reading.items.length);
for (const question of blanks.questions) {
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options.map((option) => option.text.toLowerCase())).size, 4, "no duplicate options");
  const sentence = reading.items.find((item) => item.id === question.source.itemId)!.sourceText.replaceAll(" / ", " ");
  assert.equal(`${question.before}${question.answer}${question.after}`, sentence);
  assert.notEqual(question.wordClass, "determiner", "articles are not blanked when content words exist");
  assert.equal(evaluateFillBlank(question, { optionId: question.correctOptionId }).isCorrect, true);
  assert.equal(evaluateFillBlank(question, { optionId: question.options.find((option) => option.id !== question.correctOptionId)!.id }).isCorrect, false);
  assert(!question.options.some((option) => option.text === "Tom" && question.answer !== "Tom"), "names are never distractors");
}
// A blanked preposition is offered other prepositions; a past verb gets past-tense or verb distractors first.
const toPark = adaptLearningSetToFillBlank({ ...reading, items: [reading.items[2]!, ...reading.items.slice(0, 2), ...reading.items.slice(3)] }, { choiceCount: 3, seed: "p" }).questions;
for (const question of [...blanks.questions, ...toPark]) {
  if (question.wordClass === "preposition") assert(question.options.every((option) => wordClass(option.text, null) === "preposition"), `prepositions for "${question.answer}"`);
}
assert.throws(() => adaptLearningSetToFillBlank(words, { choiceCount: 3 }), "fill blank needs a reading set");
assert.throws(() => adaptLearningSetToFillBlank(reading, { choiceCount: 6 }));

// AI-prepared blanks: several per sentence give different questions across rounds; unsafe distractors are dropped.
const bank = parseFillBlankBank({ sentences: {
  s1: { sourceText: "I / have / a dog.", blanks: [
    { answer: "have", distractors: ["has", "having", "had", "keep", "keeps", "Tom"] },
    { answer: "dog", distractors: ["dogs", "cat", "bird", "fish", "pet", "rabbit"] },
    { answer: "I", distractors: ["He", "She", "They", "We", "You", "It"] },
  ] },
  s3: { sourceText: "We / went / to the moon / yesterday.", blanks: [{ answer: "went", distractors: ["go", "goes", "gone", "going", "came", "ran"] }] },
} });
const seen = new Set<string>();
const optionMixes = new Set<string>();
for (let round = 0; round < 30; round += 1) {
  const question = adaptLearningSetToFillBlank(reading, { choiceCount: 4, bank, seed: `round-${round}` }).questions.find((entry) => entry.source.itemId === "s1")!;
  seen.add(question.answer);
  optionMixes.add(question.options.map((option) => option.text).sort().join(","));
  assert(["have", "dog", "I"].includes(question.answer), "prepared blanks are used when present");
  assert(!question.options.some((option) => option.text === "Tom"), "prepared names are still filtered by the engine");
}
assert.equal(seen.size, 3, "every prepared blank appears across rounds");
assert(optionMixes.size >= 6, `option mixes vary across rounds (${optionMixes.size})`);
const stale = adaptLearningSetToFillBlank(reading, { choiceCount: 4, bank, seed: "stale" }).questions.find((entry) => entry.source.itemId === "s3")!;
assert.notDeepEqual(stale.options.map((option) => option.text).sort(), ["came", "go", "goes", "went"], "an edited sentence ignores its old prepared blanks");

console.log("OX and fill-blank engine tests passed");
