import assert from "node:assert/strict";
import { buildLearningTower, towerLandingFeedback } from "../../src/games/learning-jump-tower/model.ts";
import { CLIMB_GRAVITY, CLIMB_PLAYER_HEIGHT, CLIMB_PLAYER_WIDTH, CLIMB_STEP, CLIMB_WORLD_WIDTH } from "../../src/game-engine/jump-tower/course.ts";
import type { RuntimeLearningSet } from "../../src/learning-sets/types.ts";

const set: RuntimeLearningSet = { id: "words", name: "단어", type: "vocabulary", itemCount: 5, items: [
  { id: "a", sourceText: "apple", meaning: "사과" },
  { id: "b", sourceText: "banana", meaning: "바나나" },
  { id: "c", sourceText: "cat", meaning: "고양이" },
  { id: "d", sourceText: "dog", meaning: "개" },
  { id: "e", sourceText: "bird", meaning: "새" },
] };

assert(CLIMB_STEP < 550 ** 2 / (2 * CLIMB_GRAVITY) - 6);
for (const direction of ["source-to-meaning", "meaning-to-source"] as const) {
  for (const seed of ["room-a", "room-b", "room-c"]) {
    const tower = buildLearningTower(set, direction, seed);
    assert.equal(tower.platformsAt(0).length, 1);
    assert(Math.abs(tower.respawnState(tower.initialProgress()).x - CLIMB_WORLD_WIDTH / 2) <= 10);
    for (let floor = 0; floor < 300; floor += 2) {
      const prompts = tower.platformsAt(floor);
      const answers = tower.platformsAt(floor + 1);
      const nextWords = tower.platformsAt(floor + 2);
      assert.notEqual(prompts[0]!.style.top, answers[0]!.style.top, "word and meaning rows have distinct platform colors, including milestone floors");
      assert.notEqual(prompts[0]!.style.labelBackground, answers[0]!.style.labelBackground);
      for (const platform of prompts) assert.deepEqual(platform.style, tower.platformsAt(0)[0]!.style);
      for (const platform of answers) assert.deepEqual(platform.style, tower.platformsAt(1)[0]!.style);
      assert(answers.length >= 2 && answers.length <= 3);
      assert(nextWords.length >= 2 && nextWords.length <= 3);
      assert.equal(new Set(answers.map((platform) => platform.label)).size, answers.length);
      for (const prompt of prompts) {
        const progress = { floor, platformIndex: prompt.index, prompt: prompt.label, best: floor };
        const correct = answers.filter((answer) => tower.land(progress, answer.index) !== null);
        assert.equal(correct.length, 1, "every freely chosen prompt has exactly one correct platform above");
        const expected = set.items.find((item) => (direction === "source-to-meaning" ? item.sourceText : item.meaning) === prompt.label)!;
        assert.equal(correct[0]!.label, direction === "source-to-meaning" ? expected.meaning : expected.sourceText);
        const landed = tower.land(progress, correct[0]!.index)!;
        assert.equal(towerLandingFeedback(progress, landed), "correct", "matching a pair triggers success feedback");
        assert.equal(towerLandingFeedback(landed, tower.land(landed, landed.platformIndex)!), null,
          "landing again after a jump or respawn cannot replay success feedback");
        assert.equal(towerLandingFeedback(progress, tower.land(progress, prompt.index)!), null);
        for (const other of prompts.filter((platform) => platform.index !== prompt.index)) {
          assert.equal(towerLandingFeedback(progress, tower.land(progress, other.index)!), "question",
            "changing the selected prompt on the same floor restarts the answer row effect");
        }
        for (const next of nextWords) {
          assert(tower.land(landed, next.index), "every next prompt is freely selectable");
          assert.equal(towerLandingFeedback(landed, tower.land(landed, next.index)!), "question",
            "each freely selected new prompt highlights its answer row");
          assert.equal(tower.land(progress, next.index), null, "double jumps and jump buffs must not skip answer rows");
          const horizontalHop = Math.abs((next.x + next.width / 2) - (correct[0]!.x + correct[0]!.width / 2));
          const doubleJumpFlight = 550 / CLIMB_GRAVITY + 520 / CLIMB_GRAVITY
            + Math.sqrt(2 * ((550 ** 2 + 520 ** 2) / (2 * CLIMB_GRAVITY) - CLIMB_STEP) / CLIMB_GRAVITY);
          assert(horizontalHop - (next.width + correct[0]!.width) / 2 < 300 * doubleJumpFlight - 30,
            "every choice is reachable with the original double jump and acceleration");
        }
        const respawn = tower.respawnState(progress);
        assert.equal(respawn.y + CLIMB_PLAYER_HEIGHT / 2, prompt.y, "wrong answers respawn on the last valid platform");
        assert.equal(respawn.x, prompt.x + prompt.width / 2);
        assert.deepEqual(tower.parseProgress(progress), progress);
      }
      for (const platform of [...prompts, ...answers]) assert(platform.x >= 0 && platform.x + platform.width <= CLIMB_WORLD_WIDTH);
      for (const row of [prompts, answers]) {
        for (let slot = 1; slot < row.length; slot += 1) assert(row[slot]!.x - (row[slot - 1]!.x + row[slot - 1]!.width) > CLIMB_PLAYER_WIDTH,
          "a player cannot land on two answer platforms at once");
      }
    }
    assert.deepEqual(tower.platformsAt(81), buildLearningTower(set, direction, seed).platformsAt(81));
    const items = tower.source.itemsAt(1_790_000_000_000, 33);
    assert(items.length > 0);
    for (const item of items) assert.equal(tower.source.kindOf(item.id), item.kind);
    assert.equal(tower.source.kindOf("garbage"), null);
    assert.notDeepEqual(items.map((item) => item.id), tower.source.itemsAt(1_790_000_025_000, 33).map((item) => item.id));
    const initial = tower.initialProgress();
    for (const raw of [null, {}, { ...initial, floor: -1 }, { ...initial, platformIndex: 2 }, { ...initial, best: Infinity }, { ...initial, prompt: "wrong" }]) {
      assert.deepEqual(tower.parseProgress(raw), initial, "malformed stored progress restarts safely");
    }
  }
}

const forward = buildLearningTower(set, "source-to-meaning", "colors");
const reversed = buildLearningTower(set, "meaning-to-source", "colors");
assert.deepEqual(forward.platformsAt(0)[0]!.style, reversed.platformsAt(1)[0]!.style);
assert.deepEqual(forward.platformsAt(1)[0]!.style, reversed.platformsAt(0)[0]!.style);

const aliases: RuntimeLearningSet = { ...set, items: [...set.items, { id: "alias", sourceText: "apple", meaning: "사과 열매" },
  { id: "synonym", sourceText: "kitten", meaning: "고양이" }, { id: "duplicate", sourceText: "apple", meaning: "사과" }] };
for (const direction of ["source-to-meaning", "meaning-to-source"] as const) {
  const tower = buildLearningTower(aliases, direction, "aliases");
  for (let floor = 0; floor < 200; floor += 2) {
    for (const prompt of tower.platformsAt(floor)) {
      const progress = { floor, platformIndex: prompt.index, prompt: prompt.label, best: floor };
      const accepted = aliases.items.filter((item) => (direction === "source-to-meaning" ? item.sourceText : item.meaning) === prompt.label)
        .map((item) => direction === "source-to-meaning" ? item.meaning : item.sourceText);
      const answers = tower.platformsAt(floor + 1);
      assert.equal(answers.filter((answer) => accepted.includes(answer.label)).length, 1, "synonyms must not appear as false distractors");
      assert.equal(answers.filter((answer) => tower.land(progress, answer.index)).length, 1);
    }
  }
}
const twoWords = buildLearningTower({ ...set, items: set.items.slice(0, 2) }, "source-to-meaning", "two");
for (let floor = 1; floor < 100; floor += 1) assert.equal(twoWords.platformsAt(floor).length, 2);
assert.throws(() => buildLearningTower({ ...set, items: [set.items[0]!] }, "source-to-meaning", "empty"));
assert.throws(() => buildLearningTower({ ...set, type: "reading-chunks" }, "source-to-meaning", "sentence"));
console.log("learning jump tower tests passed");
