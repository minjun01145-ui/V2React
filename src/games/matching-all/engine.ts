import { shuffled } from "../../game-engine/core/random.ts";
import { applyComboScore } from "../../game-engine/scoring/combo.ts";
import type { MatchingCard, MatchingPair } from "../matching/engine.ts";

export const ALL_MATCHING_PAIR_COUNT = 4;
export const ALL_MATCHING_BASE_SCORE = 400;

export function createAllMatchingBoard(
  pairs: readonly MatchingPair[],
  recentlyUsedPairIds: readonly string[],
  seed: string,
): readonly MatchingCard[] {
  if (pairs.length < ALL_MATCHING_PAIR_COUNT) throw new Error("짝맞추기(모든카드)에는 단어가 4개 이상 필요합니다.");
  const recentlyUsed = new Set(recentlyUsedPairIds);
  const freshPairs = pairs.filter((pair) => !recentlyUsed.has(pair.id));
  const candidates = freshPairs.length >= ALL_MATCHING_PAIR_COUNT ? freshPairs : pairs;
  const selected = shuffled(candidates, `${seed}:pairs`).slice(0, ALL_MATCHING_PAIR_COUNT);
  return shuffled([
    ...selected.map((pair) => ({ id: `term:${pair.id}`, pairId: pair.id, kind: "term" as const, text: pair.term })),
    ...selected.map((pair) => ({ id: `meaning:${pair.id}`, pairId: pair.id, kind: "meaning" as const, text: pair.meaning })),
  ], `${seed}:cards`);
}

export function allMatchingRoundResult(currentCombo: number, boardComplete: boolean): {
  readonly combo: number;
  readonly scoreDelta: number;
} {
  const result = applyComboScore(currentCombo, boardComplete, ALL_MATCHING_BASE_SCORE, { bonusPerStep: 50, maximumBonus: 250 });
  return { combo: result.combo, scoreDelta: result.scoreDelta };
}

export function nextUsedPairIds(
  currentIds: readonly string[],
  board: readonly MatchingCard[],
  totalPairCount: number,
): readonly string[] {
  const boardPairIds = [...new Set(board.map((card) => card.pairId))];
  const combined = [...new Set([...currentIds, ...boardPairIds])];
  return totalPairCount - combined.length >= ALL_MATCHING_PAIR_COUNT ? combined : [];
}
