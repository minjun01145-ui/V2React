import assert from "node:assert/strict";
import { BATTLE_INK_BLOCK_MS, BATTLE_INK_REWARD_CHANCE, battleInkTargetId, rollBattleReward } from "../lib/battle/items.js";
import { BATTLE_MAX_TURNS, battleGroupSizes, displayName, nextBattleIndices, preferredBattlePairs, questionText } from "../lib/battle/model.js";

assert.deepEqual(battleGroupSizes(2), [2]);
assert.deepEqual(battleGroupSizes(3), [2, 1]);
assert.deepEqual(battleGroupSizes(7), [2, 2, 2, 1]);
assert.deepEqual(nextBattleIndices(2, 1), { attackerIndex: 1, defenderIndex: 0 });
assert.equal(BATTLE_MAX_TURNS, 10);

assert.deepEqual(preferredBattlePairs([
  { id: "a", lastOpponentId: "b", allowRepeat: false },
  { id: "b", lastOpponentId: "a", allowRepeat: false },
  { id: "c", lastOpponentId: null, allowRepeat: false },
  { id: "d", lastOpponentId: null, allowRepeat: false },
]), {
  pairs: [["a", "c"], ["b", "d"]],
  waiting: [],
});
assert.deepEqual(preferredBattlePairs([
  { id: "a", lastOpponentId: "b", allowRepeat: false },
  { id: "b", lastOpponentId: "a", allowRepeat: false },
]), {
  pairs: [],
  waiting: ["a", "b"],
});
assert.deepEqual(preferredBattlePairs([
  { id: "a", lastOpponentId: "b", allowRepeat: true },
  { id: "b", lastOpponentId: "a", allowRepeat: true },
]), {
  pairs: [["a", "b"]],
  waiting: [],
});

assert.equal(BATTLE_INK_REWARD_CHANCE, 0.3);
assert.equal(BATTLE_INK_BLOCK_MS, 5_000);
assert.equal(rollBattleReward(() => 0), "ink");
assert.equal(rollBattleReward(() => 0.299), "ink");
assert.equal(rollBattleReward(() => 0.3), null);
assert.equal(rollBattleReward(() => 0.99), null);

const choosingMatch = {
  memberIds: ["a", "b"],
  memberProfiles: [],
  hearts: { a: 2, b: 2 },
  usedItemIds: [],
  itemCount: 10,
  questionNumber: 0,
  attackerIndex: 0,
  defenderIndex: 1,
  generation: 1,
  phase: "choosing",
  deadlineAtMs: 1,
  selectedItemId: null,
  selectedSide: null,
  prompt: null,
  expectedAnswer: null,
  gradingSubmissionId: null,
  eventRevision: 0,
  rewardItemId: null,
  inkBlockedUntilAtMs: { a: 0, b: 0 },
};
assert.equal(battleInkTargetId(choosingMatch, "b"), "a");
assert.equal(battleInkTargetId(choosingMatch, "a"), null);
assert.equal(battleInkTargetId({ ...choosingMatch, phase: "answering" }, "a"), "b");
assert.equal(battleInkTargetId({ ...choosingMatch, phase: "grading" }, "a"), null);

assert.equal(displayName("별", "본명"), "별");
assert.equal(displayName(null, "본명"), "본명");
const item = { id: "dog", source: "dog", meaning: "강아지" };
assert.deepEqual(questionText(item, "source"), { prompt: "강아지", expectedAnswer: "dog" });
assert.deepEqual(questionText(item, "meaning"), { prompt: "dog", expectedAnswer: "강아지" });

console.log("battle server model tests passed");
