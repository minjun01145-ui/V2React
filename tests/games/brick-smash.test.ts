import assert from "node:assert/strict";
import { buildBrickQuestions, brickAt, brickComboBonus, brickSpeedScore, currentBrickQuestion, strikeBrick } from "../../src/games/brick-smash/model.ts";
import { activateBrickItem, brickItemAt, BRICK_ITEM_IDS, EMPTY_BRICK_BUFFS, parseBrickBuffs } from "../../src/games/brick-smash/items.ts";
import { createEmptyProgress } from "../../src/game-engine/progress/index.ts";
import type { MultipleChoiceEvaluationDetails } from "../../src/game-engine/question-engine/multiple-choice/index.ts";
import type { LearningSet } from "../../src/learning-sets/types.ts";
import { getGame } from "../../src/games/registry.ts";
import { settingAppliesToSet } from "../../src/game-engine/contracts/gameDefinition.ts";

const set: LearningSet = { id: "bricks", name: "단어", type: "vocabulary", itemCount: 3, createdAtMs: 1, updatedAtMs: 1,
  items: [{ id: "a", sourceText: "apple", meaning: "사과" }, { id: "b", sourceText: "banana", meaning: "바나나" }, { id: "c", sourceText: "cherry", meaning: "체리" }] };

for (const direction of ["source-to-meaning", "meaning-to-source"]) {
  for (const count of ["2", "3"]) {
    const questions = buildBrickQuestions(set, { direction, "choice-count": count }, "round");
    assert.deepEqual(questions, buildBrickQuestions(set, { direction, "choice-count": count }, "round"), "Same round must restore the same brick order");
    for (const question of questions) {
      const item = set.items.find((item) => item.id === question.source.itemId)!;
      assert.equal(question.prompt, direction === "source-to-meaning" ? item.sourceText : item.meaning);
      assert.equal(question.options.length, Number(count));
      assert.equal(new Set(question.options.map((option) => option.text)).size, Number(count));
      assert.equal(question.options.find((option) => option.id === question.correctOptionId)?.text, direction === "source-to-meaning" ? item.meaning : item.sourceText);
    }
  }
}
const questions = buildBrickQuestions(set, {}, "round");
let progress = createEmptyProgress<MultipleChoiceEvaluationDetails>();
for (let i = 0; i < 15; i++) {
  const question = brickAt(questions, progress.currentIndex);
  const wrong = question.options.find((option) => option.id !== question.correctOptionId)!;
  const failed = strikeBrick(progress, question, wrong.id);
  assert.equal(failed.result.isCorrect, false);
  assert.equal(failed.progress.currentIndex, i, "Wrong answer must leave the bottom brick in place");
  assert.equal(failed.progress.score, i * 100);
  assert.equal(failed.progress.combo, 0);
  const correct = strikeBrick(failed.progress, question, question.correctOptionId);
  progress = correct.progress;
  assert.equal(progress.currentIndex, i + 1);
  assert.equal(progress.score, (i + 1) * 100, "Repeated decks must still award a full instant brick");
  assert.equal(progress.correctCount, i + 1);
  assert.equal(progress.attemptCount, (i + 1) * 2);
}
assert.equal(strikeBrick(progress, brickAt(questions, progress.currentIndex), "missing").result.isCorrect, false);
assert.throws(() => buildBrickQuestions({ ...set, type: "form-changes" }, {}, "round"), /단어 또는 끊어읽기/);
assert.throws(() => buildBrickQuestions({ ...set, items: set.items.slice(0, 2) }, { "choice-count": "3" }, "round"), /정답이 부족/);
assert.throws(() => buildBrickQuestions({ ...set, items: set.items.map((item) => ({ ...item, meaning: "같은 뜻" })) }, {}, "round"), /정답이 부족/);
assert.deepEqual(getGame("brick-smash").supportedSetTypes, ["vocabulary", "reading-chunks"]);
assert.equal(getGame("brick-smash").handlesOwnTimedBoundary, true);
assert.equal(buildBrickQuestions(set, { "choice-count": "invalid", direction: null }, "round")[0]?.options.length, 2);
const first = questions[0]!;
const correctId = first.correctOptionId;
const wrongId = first.options.find((option) => option.id !== correctId)!.id;
const empty = createEmptyProgress<MultipleChoiceEvaluationDetails>();
const bomb = strikeBrick(empty, first, correctId, { itemAt: () => "bomb", buffs: EMPTY_BRICK_BUFFS, now: 100, elapsedMs: 0 });
assert.equal(bomb.progress.currentIndex, 4);
assert.equal(bomb.progress.score, 400);
assert.equal(bomb.progress.correctCount, 1, "Collateral bricks are not extra correct answers");
const hammer = activateBrickItem(EMPTY_BRICK_BUFFS, "hammer", 100);
assert.equal(hammer.hammer, 20_100);
assert.equal(strikeBrick(empty, first, correctId, { itemAt: () => null, buffs: hammer, now: 20_099, elapsedMs: 0 }).progress.currentIndex, 2);
assert.equal(strikeBrick(empty, first, correctId, { itemAt: () => null, buffs: hammer, now: 20_100, elapsedMs: 0 }).progress.currentIndex, 1);
const gold = activateBrickItem(hammer, "gold", 100);
const stacked = strikeBrick(empty, first, correctId, { itemAt: () => "bomb", buffs: gold, now: 101, elapsedMs: 0 });
assert.equal(stacked.progress.currentIndex, 5);
assert.equal(stacked.progress.score, 1_000);
assert.equal(strikeBrick(empty, first, correctId, { itemAt: () => null, buffs: gold, now: 20_100, elapsedMs: 0 }).progress.score, 100);
assert.equal(activateBrickItem(hammer, "hammer", 1_000).hammer, 21_000, "Repicking refreshes duration");
const shield = activateBrickItem(EMPTY_BRICK_BUFFS, "shield", 100);
const guarded = strikeBrick({ ...empty, combo: 5 }, first, wrongId, { itemAt: () => "bomb", buffs: shield, now: 200, elapsedMs: 0 });
assert.equal(guarded.progress.combo, 5);
assert.equal(guarded.progress.currentIndex, 0);
assert.equal(guarded.progress.score, 0);
assert.equal(guarded.result.details?.activatedItem, null, "A wrong hit never activates a special brick");
assert.equal(guarded.result.details?.buffs?.shield, false);
const unguarded = strikeBrick(guarded.progress, first, wrongId, { itemAt: () => null, buffs: guarded.result.details!.buffs!, now: 201, elapsedMs: 0 });
assert.equal(unguarded.progress.combo, 0);
assert.deepEqual(parseBrickBuffs(JSON.parse(JSON.stringify(gold))), gold, "Reconnect restores absolute expiry without extending it");
assert.deepEqual(parseBrickBuffs({ hammer: Infinity, gold: -1, shield: "true" }), EMPTY_BRICK_BUFFS);
assert.deepEqual(parseBrickBuffs(null), EMPTY_BRICK_BUFFS);
// Regression: a special brick knocked out by the double hammer's second head used to vanish without effect.
const secondHead = strikeBrick(empty, first, correctId, { itemAt: (index) => index === 1 ? "gold" : null, buffs: hammer, now: 200, elapsedMs: 0 });
assert.equal(secondHead.result.details?.activatedItem, "gold");
assert.equal(secondHead.result.details?.buffs?.gold, 20_200);
assert.equal(strikeBrick(empty, first, correctId, { itemAt: (index) => index === 1 ? "gold" : null, buffs: EMPTY_BRICK_BUFFS, now: 200, elapsedMs: 0 }).result.details?.activatedItem, null);
const drops = Array.from({ length: 36 }, (_, i) => brickItemAt("round", i)).filter(Boolean);
assert.equal(drops.length, BRICK_ITEM_IDS.length);
assert.deepEqual([...drops].sort(), [...BRICK_ITEM_IDS].sort());
const dropIndexes = Array.from({ length: 900 }, (_, i) => i).filter((i) => brickItemAt("round", i));
assert.ok(dropIndexes.every((index, i) => i === 0 || index - dropIndexes[i - 1]! > 5), "One strike (max 5 bricks) can never reach two special bricks");
assert.deepEqual(drops, Array.from({ length: 36 }, (_, i) => brickItemAt("round", i)).filter(Boolean));

const reading: LearningSet = { ...set, type: "reading-chunks", itemCount: 2, items: [
  { id: "s1", sourceText: "I / like / apples", meaning: "나는 사과를 좋아해요" },
  { id: "s2", sourceText: "We / can / can / it", meaning: "우리는 그것을 통조림으로 만들 수 있다" },
] };
for (const count of ["2", "3"]) {
  const sentences = buildBrickQuestions(reading, { "choice-count": count, direction: "meaning-to-source" }, "round");
  let sentenceProgress = empty;
  for (let i = 0; i < sentences.length * 2; i++) {
    const question = currentBrickQuestion(sentences, sentenceProgress);
    const sentence = question.sentence!;
    assert.equal(question.options.find((option) => option.id === question.correctOptionId)?.text, sentence.chunks[sentence.chunkIndex]);
    assert.equal(question.options.length, Number(count));
    assert.equal(new Set(question.options.map((option) => option.text)).size, Number(count), "Duplicate chunks must not create ambiguous options");
    const wrong = question.options.find((option) => option.id !== question.correctOptionId)!;
    const retry = strikeBrick(sentenceProgress, question, wrong.id);
    assert.equal(currentBrickQuestion(sentences, retry.progress).id, question.id);
    sentenceProgress = strikeBrick(retry.progress, question, question.correctOptionId, { itemAt: () => "bomb", buffs: hammer, now: 200, elapsedMs: 0 }).progress;
    assert.equal(sentenceProgress.currentIndex, (i + 1) * 5);
    assert.equal(currentBrickQuestion(sentences, sentenceProgress).id, sentences[(i + 1) % sentences.length]?.id, "Items must not skip sentence chunks");
  }
}
assert.throws(() => buildBrickQuestions({ ...reading, items: [{ id: "bad", sourceText: "no chunks", meaning: "뜻" }] }, {}, "round"), /두 조각 이상/);
// Speed: instant answers earn 100, slow ones never drop below 50.
assert.equal(brickSpeedScore(0), 100);
assert.equal(brickSpeedScore(700), 100);
assert.ok(brickSpeedScore(1_500) < brickSpeedScore(1_000) && brickSpeedScore(1_000) < 100);
assert.equal(brickSpeedScore(60_000), 50);
// Combo bonus grows with the streak and is capped.
assert.equal(brickComboBonus(1), 0);
assert.equal(brickComboBonus(11), 50);
assert.equal(brickComboBonus(500), 100);
const slow = strikeBrick({ ...empty, combo: 10 }, first, correctId, { itemAt: () => null, buffs: EMPTY_BRICK_BUFFS, now: 0, elapsedMs: 60_000 });
assert.equal(slow.result.scoreDelta, 50 + 50);
assert.equal(slow.result.details?.judgment, "good");
assert.equal(slow.progress.combo, 11);
const fast = strikeBrick({ ...empty, combo: 10 }, first, correctId, { itemAt: () => null, buffs: gold, now: 101, elapsedMs: 100 });
assert.equal(fast.result.scoreDelta, (100 + 50) * 2 * 2, "Double hammer bricks and gold both multiply the per-brick score");
assert.equal(fast.result.details?.judgment, "perfect");
assert.equal(strikeBrick({ ...empty, combo: 10 }, first, wrongId).result.scoreDelta, 0);
// Reading sets: word buttons follow the sentence word by word; wrong buttons come from the whole set.
const school: LearningSet = { ...set, type: "reading-chunks", itemCount: 2, items: [
  { id: "m1", sourceText: "I am / a middle school student.", meaning: "나는 중학생이다" },
  { id: "m2", sourceText: "She likes / green apples", meaning: "그녀는 풋사과를 좋아한다" },
] };
const words = buildBrickQuestions(school, { "brick-unit": "word", "choice-count": "3" }, "round");
assert.deepEqual(words.filter((question) => question.source.itemId === "m1").map((question) => question.options.find((option) => option.id === question.correctOptionId)?.text),
  ["I", "am", "a", "middle", "school", "student."]);
assert.deepEqual(words[0]?.sentence?.chunks, ["I", "am", "a", "middle", "school", "student."]);
const chunkUnits = buildBrickQuestions(school, { "brick-unit": "chunk" }, "round");
assert.deepEqual(chunkUnits.filter((question) => question.source.itemId === "m1").map((question) => question.options.find((option) => option.id === question.correctOptionId)?.text), ["I am", "a middle school student."]);
const otherSentenceWords = new Set(["She", "likes", "green", "apples"]);
assert.ok(words.some((question) => question.source.itemId === "m1" && question.options.some((option) => otherSentenceWords.has(option.text))), "Wrong buttons may come from other sentences");
for (const question of words) {
  const correctText = question.options.find((option) => option.id === question.correctOptionId)!.text.toLowerCase().replace(/\.$/, "");
  assert.ok(question.options.filter((option) => option.id !== question.correctOptionId).every((option) => option.text.toLowerCase().replace(/\.$/, "") !== correctText), "A wrong button never repeats the answer");
}
// The same text from another sentence counts as the answer.
const twin = { ...words[0]!, options: [...words[0]!.options, { id: "other-sentence-I", text: "I" }] };
assert.equal(strikeBrick(empty, twin, "other-sentence-I").result.isCorrect, true);
// Teachers see the direction only for word sets and the button unit only for reading sets.
const visible = (setType: string) => getGame("brick-smash").settings.filter((setting) => settingAppliesToSet(setting, setType)).map((setting) => setting.key);
assert.deepEqual(visible("vocabulary"), ["direction", "choice-count"]);
assert.deepEqual(visible("reading-chunks"), ["brick-unit", "choice-count"]);
console.log("brick smash game tests passed");
