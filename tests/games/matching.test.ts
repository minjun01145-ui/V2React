import assert from "node:assert/strict";
import { countVisiblePairs, createMatchingBoard, isMatchingPair, matchingComboResult, matchingPairs, refillMatchingBoard } from "../../src/games/matching/engine.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../src/learning-sets/types.ts";

const vocabularySet: LearningSet = {
  id: "matching-test",
  name: "짝맞추기 테스트",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 10,
  createdAtMs: 1,
  updatedAtMs: 1,
  items: Array.from({ length: 10 }, (_, index) => ({
    id: `pair-${index}`,
    sourceText: `word-${index}`,
    meaning: `뜻-${index}`,
  })),
};

const pairs = matchingPairs(vocabularySet);
const firstBoard = createMatchingBoard(pairs, [], "round-1");
assert.equal(firstBoard.length, 8);
assert.equal(firstBoard.filter((card) => card.kind === "term").length, 4);
assert.equal(firstBoard.filter((card) => card.kind === "meaning").length, 4);
assert.ok([1, 2].includes(countVisiblePairs(firstBoard)), "보드에는 실제 짝이 1~2개 있어야 합니다.");
assert.deepEqual(createMatchingBoard(pairs, [], "round-1"), firstBoard, "같은 진행 상태와 시드는 같은 보드를 재현해야 합니다.");

const matchingTerm = firstBoard.find((card) => card.kind === "term" && firstBoard.some((other) => other.kind === "meaning" && other.pairId === card.pairId));
assert.ok(matchingTerm);
const matchingMeaning = firstBoard.find((card) => card.kind === "meaning" && card.pairId === matchingTerm.pairId);
assert.ok(matchingMeaning);
assert.equal(isMatchingPair(matchingTerm, matchingMeaning), true);
assert.equal(isMatchingPair(matchingTerm, matchingTerm), false);
assert.deepEqual(matchingComboResult(0, true), { combo: 1, scoreDelta: 100 });
assert.deepEqual(matchingComboResult(3, true), { combo: 4, scoreDelta: 160 });
assert.deepEqual(matchingComboResult(9, true), { combo: 10, scoreDelta: 200 }, "콤보 보너스는 최대 100점이어야 합니다.");
assert.deepEqual(matchingComboResult(4, false), { combo: 0, scoreDelta: 0 });

const refilledBoard = refillMatchingBoard(firstBoard, matchingTerm.pairId, pairs, [matchingTerm.pairId], "refill-1");
assert.equal(refilledBoard.length, 8);
assert.equal(refilledBoard.filter((card) => firstBoard.includes(card)).length, 6, "맞춘 두 카드 외의 카드는 그대로 남아야 합니다.");
assert.ok([1, 2].includes(countVisiblePairs(refilledBoard)));

const secondBoard = createMatchingBoard(pairs, [matchingTerm.pairId], "round-2");
assert.ok(secondBoard.every((card) => card.pairId !== matchingTerm.pairId), "맞춘 짝은 다음 보드에서 사라져야 합니다.");
assert.ok([1, 2].includes(countVisiblePairs(secondBoard)));

const lateBoard = createMatchingBoard(pairs, pairs.slice(0, 6).map((pair) => pair.id), "late-round");
assert.equal(lateBoard.length, 8, "마지막 구간에도 가능한 동안 2×4 보드를 유지해야 합니다.");
assert.equal(countVisiblePairs(lateBoard), 2);

assert.throws(() => matchingPairs({ ...vocabularySet, itemCount: 5, items: vocabularySet.items.slice(0, 5) }), /6개 이상/);
console.log("matching game tests passed");
