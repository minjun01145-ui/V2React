import assert from "node:assert/strict";
import { buildNinjaQuestions, isGoldenWave, itemForWave, MAX_WAVE_OPTIONS, NINJA_ITEMS, ninjaComboBonus, ninjaQuestionAt, ninjaSpeedScore, sliceFruit, withDecoys, type NinjaProgress } from "../../src/games/word-ninja/model.ts";
import { activeTimedBuffs } from "../../src/game-engine/timed-buffs/model.ts";
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

// Frenzy: every option of the wave is correct, each pays out, and only the wave's last fruit moves on.
const wave = ninjaQuestionAt(questions, 0);
let frenzy: NinjaProgress = createEmptyProgress();
wave.options.forEach((option, index) => {
  const last = index === wave.options.length - 1;
  const cut = sliceFruit(frenzy, wave, option.id, { elapsedMs: 0, golden: false, frenzy: true, advance: last });
  assert.equal(cut.result.isCorrect, true, "every fruit is correct during a frenzy");
  assert.equal(cut.result.details?.frenzy, true);
  frenzy = cut.progress;
  assert.equal(frenzy.currentIndex, last ? 1 : 0, "the question changes only after the whole wave");
});
assert.equal(frenzy.combo, wave.options.length);
assert.equal(frenzy.score, 100 + 105 + 110, "a cleared frenzy wave pays once per fruit");
assert.equal(sliceFruit(createEmptyProgress(), wave, "missing", { elapsedMs: 0, golden: false, frenzy: true }).result.isCorrect, false,
  "a frenzy does not accept options that were never thrown");

// Curses add stable decoys from other answers, up to the arena's limit; a small set runs out of decoys.
assert.equal(withDecoys(wave, questions, 2, "round").options.length, set.items.length);
const words = ["apple", "banana", "cherry", "grape", "lemon", "mango", "peach", "plum", "kiwi", "melon"];
const bigSet: LearningSet = { ...set, itemCount: words.length, items: words.map((word, index) => ({ id: word, sourceText: word, meaning: `뜻${index}` })) };
const bigQuestions = buildNinjaQuestions(bigSet, {}, "round");
const bigWave = bigQuestions[0]!;
const cursed = withDecoys(bigWave, bigQuestions, 2, "round");
assert.equal(cursed.options.length, bigWave.options.length + 2);
assert.deepEqual(withDecoys(bigWave, bigQuestions, 2, "round"), cursed, "reloads see the same decoys");
assert.equal(new Set(cursed.options.map((option) => option.text)).size, cursed.options.length, "decoys never repeat an option");
assert.equal(sliceFruit(createEmptyProgress(), cursed, cursed.options.at(-1)!.id, { elapsedMs: 0, golden: false }).result.isCorrect, false);
assert.equal(sliceFruit(createEmptyProgress(), cursed, cursed.correctOptionId, { elapsedMs: 0, golden: false }).result.isCorrect, true);
assert.equal(withDecoys(bigWave, bigQuestions, 100, "round").options.length, MAX_WAVE_OPTIONS);
assert.equal(withDecoys(wave, questions, 0, "round"), wave);

// One item in every five waves, never on a golden one, and both kinds appear.
const items = Array.from({ length: 500 }, (_, index) => itemForWave("round", index));
for (let group = 0; group < 100; group++) assert.ok(items.slice(group * 5, group * 5 + 5).filter(Boolean).length <= 1);
items.forEach((kind, index) => { if (kind) assert.equal(isGoldenWave("round", index), false); });
assert.ok(items.filter((kind) => kind === "frenzy").length > items.filter((kind) => kind === "curse").length);
assert.ok(items.includes("curse"));

// Timed items: each pickup lasts its duration and pickups of one kind stack (two curses = +4 decoys).
const duration = (kind: keyof typeof NINJA_ITEMS) => NINJA_ITEMS[kind].durationMs;
const pickups = [{ kind: "curse" as const, atMs: 0 }, { kind: "curse" as const, atMs: 4_000 }, { kind: "frenzy" as const, atMs: 1_000 }];
assert.deepEqual(activeTimedBuffs(pickups, duration, 5_000).find((buff) => buff.kind === "curse"), { kind: "curse", endsAtLocalMs: 14_000, stacks: 2 });
assert.equal(activeTimedBuffs(pickups, duration, 10_500).find((buff) => buff.kind === "curse")?.stacks, 1);
assert.equal(activeTimedBuffs(pickups, duration, 11_000).some((buff) => buff.kind === "frenzy"), false);

const game = getGame("word-ninja");
assert.equal(game.id, "word-ninja");
assert.deepEqual(game.supportedSetTypes, ["vocabulary"]);
assert.equal(game.handlesOwnTimedBoundary, true);
console.log("word ninja waves, slicing, combo, golden fruit, frenzy, curse decoys and item tests passed");
