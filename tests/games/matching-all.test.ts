import assert from "node:assert/strict";
import { ALL_MATCHING_BASE_SCORE, allMatchingRoundResult, createAllMatchingBoard, nextUsedPairIds } from "../../src/games/matching-all/engine.ts";
import { adaptLearningSetToPairMatching } from "../../src/learning-sets/pairMatchingAdapter.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../src/learning-sets/types.ts";

const vocabularySet: LearningSet = {
  id: "matching-all-test",
  name: "모든 카드 테스트",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 10,
  createdAtMs: 1,
  updatedAtMs: 1,
  items: Array.from({ length: 10 }, (_, index) => ({ id: `pair-${index}`, sourceText: `word-${index}`, meaning: `뜻-${index}` })),
};

const pairs = adaptLearningSetToPairMatching(vocabularySet);
const board = createAllMatchingBoard(pairs, [], "board-1");
assert.equal(board.length, 8);
assert.equal(new Set(board.map((card) => card.pairId)).size, 4);
for (const pairId of new Set(board.map((card) => card.pairId))) {
  assert.equal(board.filter((card) => card.pairId === pairId).length, 2, "모든 카드에는 정확히 한 장의 짝이 있어야 합니다.");
}
assert.deepEqual(createAllMatchingBoard(pairs, [], "board-1"), board);
assert.deepEqual(allMatchingRoundResult(3, false), { combo: 0, scoreDelta: 0 });
assert.deepEqual(allMatchingRoundResult(0, true), { combo: 1, scoreDelta: ALL_MATCHING_BASE_SCORE });
assert.deepEqual(allMatchingRoundResult(3, true), { combo: 4, scoreDelta: 550 });
assert.deepEqual(allMatchingRoundResult(9, true), { combo: 10, scoreDelta: 650 });

const used = nextUsedPairIds([], board, pairs.length);
const nextBoard = createAllMatchingBoard(pairs, used, "board-2");
assert.equal(nextBoard.some((card) => used.includes(card.pairId)), false, "남은 단어가 충분하면 직전 짝을 반복하지 않아야 합니다.");
assert.deepEqual(nextUsedPairIds(used, nextBoard, pairs.length), [], "다음 판을 만들 단어가 부족하면 사용 기록을 순환시켜야 합니다.");

assert.throws(() => createAllMatchingBoard(pairs.slice(0, 3), [], "short"), /4개 이상/);
console.log("all-card matching game tests passed");
