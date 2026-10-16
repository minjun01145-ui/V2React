import assert from "node:assert/strict";
import { CLIMB_GRAVITY, CLIMB_PLAYER_HEIGHT } from "../../src/game-engine/jump-tower/course.ts";
import blackHole from "../../src/games/lobby-deathmatch/maps/black-hole.ts";
import deepOcean from "../../src/games/lobby-deathmatch/maps/deep-ocean.ts";
import lavaCavern from "../../src/games/lobby-deathmatch/maps/lava-cavern.ts";
import { QUESTION_MS, REVEAL_MS, answerPlatforms, buildWordQuiz, isOnPlatform, roundAt, wordArena } from "../../src/games/lobby-deathmatch/word/model.ts";
import type { RuntimeLearningSet } from "../../src/learning-sets/types.ts";

const set: RuntimeLearningSet = { id: "words", name: "단어", type: "vocabulary", itemCount: 5, items: [
  { id: "a", sourceText: "dog", meaning: "개" },
  { id: "b", sourceText: "cat", meaning: "고양이" },
  { id: "c", sourceText: "bird", meaning: "새" },
  { id: "d", sourceText: "fish", meaning: "물고기" },
  { id: "e", sourceText: "dog", meaning: "강아지" },
] };

const quiz = buildWordQuiz(set, "source-to-meaning", "round-1");
const seen = new Set<string>();
for (let index = 0; index < 40; index += 1) {
  const question = quiz.questionAt(index);
  assert.deepEqual(question, buildWordQuiz(set, "source-to-meaning", "round-1").questionAt(index), "every client derives the same question");
  const accepted = set.items.filter((item) => item.sourceText === question.prompt).map((item) => item.meaning);
  assert(accepted.includes(question.options[question.correctSlot]));
  assert(!accepted.includes(question.options[1 - question.correctSlot]!), "a synonym is never the wrong platform");
  if (index < 4) seen.add(question.prompt);
}
assert.equal(seen.size, 4, "each word appears once before any repeats");
assert.throws(() => buildWordQuiz({ ...set, items: set.items.slice(0, 1) }, "source-to-meaning", "x"));

assert.equal(roundAt(10_000, 9_999), null);
assert.deepEqual(roundAt(0, QUESTION_MS - 1), { index: 0, phase: "question", remainingMs: 1 });
assert.deepEqual(roundAt(0, QUESTION_MS), { index: 0, phase: "reveal", remainingMs: REVEAL_MS });
assert.equal(roundAt(0, QUESTION_MS + REVEAL_MS)?.index, 1);

const doubleJump = 550 ** 2 / (2 * CLIMB_GRAVITY) + 520 ** 2 / (2 * CLIMB_GRAVITY);
for (const map of [lavaCavern, deepOcean, blackHole]) {
  const arena = wordArena(map);
  const [left, right] = answerPlatforms(map);
  assert(right.x - (left.x + left.width) > 0 && left.width >= 300, `${map.id}: two large, separate answer platforms`);
  assert(left.y - map.ceilingY > CLIMB_PLAYER_HEIGHT + 40, `${map.id}: headroom under the ceiling`);
  assert(arena.platforms.filter((platform) => platform.y === left.y && platform.width === left.width).length === 2);
  assert(!arena.hazards.some((hazard) => hazard.kind === "attractor"), `${map.id}: nothing drags players off an answer`);
  assert.equal(new Set(arena.platforms.map((platform) => platform.index)).size, arena.platforms.length);
  const steps = arena.platforms.filter((platform) => platform.y > left.y && left.y > platform.y - doubleJump + 20
    && platform.x < right.x + right.width && platform.x + platform.width > left.x);
  assert(steps.length >= 2, `${map.id}: the answers are reachable from below`);
  assert(isOnPlatform({ x: left.x + 10, y: left.y }, left));
  assert(!isOnPlatform({ x: left.x + 10, y: left.y + 40 }, left), "standing under a platform does not count");
  assert(!isOnPlatform({ x: right.x - 5, y: right.y }, right));
}

console.log("word deathmatch tests passed");
