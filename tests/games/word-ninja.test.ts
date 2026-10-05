import assert from "node:assert/strict";
import { buildNinjaQuestions, isGoldenWave, ninjaComboBonus, ninjaQuestionAt, ninjaSpeedScore, sliceFruit, type NinjaProgress } from "../../src/games/word-ninja/model.ts";
import { createEmptyProgress } from "../../src/game-engine/progress/index.ts";
import type { LearningSet } from "../../src/learning-sets/types.ts";
import { getGame } from "../../src/games/registry.ts";

const set: LearningSet = { id: "fruit", name: "단어", type: "vocabulary", itemCount: 4, createdAtMs: 1, updatedAtMs: 1,
  items: [{ id: "a", sourceText: "apple", meaning: "사과" }, { id: "b", sourceText: "banana", meaning: "바나나" },
    { id: "c", sourceText: "cherry", meaning: "체리" }, { id: "d", sourceText: "grape", meaning: "포도" }] };

for (const direction of ["source-to-meaning", "meaning-to-source"]) {
  for (const count of ["3", "4"]) {
    const questions = buildNinjaQuestions(set, { direction, "choice-count": count }, "round");
    assert.deepEqual(questions, buildNinjaQuestions(set, { direction, "choice-count": count }, "round"), "Same round must restore the same waves");
    for (const question of questions) {
      const item = set.items.find((entry) => entry.id === question.source.itemId)!;
      assert.equal(question.prompt, direction === "source-to-meaning" ? item.sourceText : item.meaning);
      assert.equal(question.options.length, Number(count));
      assert.equal(question.options.find((option) => option.id === question.correctOptionId)?.text, direction === "source-to-meaning" ? item.meaning : item.sourceText);
    }
  }
}
assert.equal(buildNinjaQuestions(set, { "choice-count": "invalid" }, "round")[0]?.options.length, 3);
assert.throws(() => buildNinjaQuestions({ ...set, type: "reading-chunks" }, {}, "round"), /단어 세트/);

// Slicing a wrong fruit keeps the same question and breaks the combo; the right one advances.
const questions = buildNinjaQuestions(set, {}, "round");
let progress: NinjaProgress = createEmptyProgress();
for (let i = 0; i < 10; i++) {
  const question = ninjaQuestionAt(questions, progress.currentIndex);
  const wrong = question.options.find((option) => option.id !== question.correctOptionId)!;
  const missed = sliceFruit(progress, question, wrong.id, { elapsedMs: 0, golden: false });
  assert.equal(missed.result.isCorrect, false);
  assert.equal(missed.progress.currentIndex, i);
  assert.equal(missed.progress.combo, 0);
  assert.equal(missed.result.scoreDelta, 0);
  const hit = sliceFruit(missed.progress, question, question.correctOptionId, { elapsedMs: 0, golden: false });
  progress = hit.progress;
  assert.equal(progress.currentIndex, i + 1);
  assert.equal(progress.score, (i + 1) * 100, "Repeated decks must still award a full fast slice");
}

// Combos and golden fruit stack on top of the speed score.
const first = questions[0]!;
let streak: NinjaProgress = createEmptyProgress();
for (let i = 0; i < 3; i++) streak = sliceFruit(streak, ninjaQuestionAt(questions, i), ninjaQuestionAt(questions, i).correctOptionId, { elapsedMs: 0, golden: false }).progress;
assert.equal(streak.combo, 3);
assert.equal(streak.score, 100 + 105 + 110);
const gold = sliceFruit(createEmptyProgress(), first, first.correctOptionId, { elapsedMs: 0, golden: true });
assert.equal(gold.result.scoreDelta, 200);
assert.equal(gold.result.details?.golden, true);
assert.equal(sliceFruit(createEmptyProgress(), first, first.correctOptionId, { elapsedMs: 60_000, golden: false }).result.scoreDelta, 50);
assert.equal(ninjaSpeedScore(0), 100);
assert.equal(ninjaComboBonus(100), 100);

// Exactly one golden wave in every seven, stable for the same round.
for (let group = 0; group < 20; group++) {
  const golden = Array.from({ length: 7 }, (_, offset) => isGoldenWave("round", group * 7 + offset)).filter(Boolean).length;
  assert.equal(golden, 1);
}

const game = getGame("word-ninja");
assert.equal(game.id, "word-ninja");
assert.deepEqual(game.supportedSetTypes, ["vocabulary"]);
assert.equal(game.handlesOwnTimedBoundary, true);
console.log("word ninja waves, slicing, combo and golden fruit tests passed");
