import assert from "node:assert/strict";
import { isMatchingPair } from "../../src/game-engine/pair-matching/index.ts";
import { countVisiblePairs, createMatchingBoard, matchingComboResult, refillMatchingBoard } from "../../src/games/matching/engine.ts";
import { adaptLearningSetToPairMatching } from "../../src/learning-sets/pairMatchingAdapter.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../src/learning-sets/types.ts";
import { minimumSetItemCountForType } from "../../src/game-engine/contracts/gameDefinition.ts";
import { readMatchingCardMode } from "../../src/games/matching/config.ts";
import { getGame, listGames } from "../../src/games/registry.ts";
import { engineRoundForGame, engineSetIssue } from "../../src/features/teacher/slide-show/engineDraft.ts";

const game = getGame("matching");
assert.equal(listGames().filter((entry) => entry.id === "matching" || entry.id === "matching-all").length, 1);
assert.equal(getGame("matching-all"), game, "기존 모든 카드 세션도 통합 게임을 불러와야 합니다.");
assert.equal(game.settings[0]?.defaultValue, "all");
assert.equal(readMatchingCardMode({ "matching-cards": "all" }), "all");
assert.equal(readMatchingCardMode({ "matching-cards": "partial" }), "partial");
assert.equal(readMatchingCardMode(null), "partial", "옵션이 없는 기존 일부 카드 세션은 규칙을 유지해야 합니다.");
assert.equal(readMatchingCardMode(null, "matching-all"), "all");
for (const value of ["invalid", true, 4, {}, null]) {
  assert.equal(readMatchingCardMode({ "matching-cards": value }), "partial", "잘못된 외부 옵션은 기존 규칙으로 처리합니다.");
}
assert.equal(minimumSetItemCountForType(game, "vocabulary", { "matching-cards": "all" }), 4);
assert.equal(minimumSetItemCountForType(game, "vocabulary", { "matching-cards": "partial" }), 6);
const round = engineRoundForGame("matching", []);
assert.equal(round.gameConfig["matching-cards"], "all", "새 슬라이드도 모든 카드를 기본으로 사용합니다.");
const shortSet = { id: "short", name: "4개 세트", type: LEARNING_SET_TYPE.VOCABULARY, itemCount: 4, createdAtMs: 1, updatedAtMs: 1 };
const shortRound = { ...round, source: { kind: "stored-set" as const, setId: shortSet.id } };
assert.equal(engineSetIssue(shortRound, [shortSet]), null);
assert.ok(engineSetIssue({ ...shortRound, gameConfig: { "matching-cards": "partial" } }, [shortSet]));
assert.equal(engineSetIssue({ ...shortRound, gameId: "matching-all", gameConfig: {} }, [shortSet]), null);

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

const pairs = adaptLearningSetToPairMatching(vocabularySet);
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
const retainedCards = firstBoard.filter((card) => card.pairId !== matchingTerm.pairId);
const replacementCards = refilledBoard.filter((card) => !retainedCards.includes(card));
assert.equal(replacementCards.length, 2);
assert.notEqual(replacementCards[0]?.pairId, replacementCards[1]?.pairId, "새 카드 두 장이 서로 정답인 구조를 만들면 안 됩니다.");

const visiblePairCounts = new Set<number>();
for (let index = 0; index < 24; index += 1) {
  const board = createMatchingBoard(pairs, [], `variation-board-${index}`);
  const visibleTerm = board.find((card) => card.kind === "term" && board.some((other) => other.kind === "meaning" && other.pairId === card.pairId));
  assert.ok(visibleTerm);
  const next = refillMatchingBoard(board, visibleTerm.pairId, pairs, [visibleTerm.pairId], `variation-refill-${index}`);
  visiblePairCounts.add(countVisiblePairs(next));
  const kept = board.filter((card) => card.pairId !== visibleTerm.pairId);
  const replacements = next.filter((card) => !kept.includes(card));
  if (replacements.length === 2) assert.notEqual(replacements[0]?.pairId, replacements[1]?.pairId);
}
assert.deepEqual([...visiblePairCounts].sort(), [1, 2], "진행 중 실제 짝이 한 개 또는 두 개로 다양하게 나타나야 합니다.");

const secondBoard = createMatchingBoard(pairs, [matchingTerm.pairId], "round-2");
assert.ok(secondBoard.every((card) => card.pairId !== matchingTerm.pairId), "맞춘 짝은 다음 보드에서 사라져야 합니다.");
assert.ok([1, 2].includes(countVisiblePairs(secondBoard)));

const lateBoard = createMatchingBoard(pairs, pairs.slice(0, 6).map((pair) => pair.id), "late-round");
assert.equal(lateBoard.length, 8, "마지막 구간에도 가능한 동안 2×4 보드를 유지해야 합니다.");
assert.equal(countVisiblePairs(lateBoard), 2);

assert.throws(() => createMatchingBoard(pairs.slice(0, 5), [], "short"), /6개 이상/);
console.log("matching game tests passed");
