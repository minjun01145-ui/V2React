import { hashString, shuffled } from "../../game-engine/core/random.ts";
import { applyComboScore } from "../../game-engine/scoring/combo.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../learning-sets/types.ts";

export type MatchingCardKind = "term" | "meaning";

export interface MatchingPair {
  readonly id: string;
  readonly term: string;
  readonly meaning: string;
}

export interface MatchingCard {
  readonly id: string;
  readonly pairId: string;
  readonly kind: MatchingCardKind;
  readonly text: string;
}

export function matchingPairs(set: LearningSet, minimumPairCount = 6): readonly MatchingPair[] {
  if (set.type !== LEARNING_SET_TYPE.VOCABULARY) throw new Error("짝맞추기는 단어 세트만 사용할 수 있습니다.");
  const pairs = set.items.map((item) => ({
    id: item.id,
    term: item.sourceText.trim(),
    meaning: item.meaning.trim(),
  }));
  if (pairs.length < minimumPairCount) throw new Error(`짝맞추기에는 단어가 ${minimumPairCount}개 이상 필요합니다.`);
  if (pairs.some((pair) => !pair.id || !pair.term || !pair.meaning)) throw new Error("비어 있는 단어나 뜻은 짝맞추기에 사용할 수 없습니다.");
  if (new Set(pairs.map((pair) => pair.id)).size !== pairs.length) throw new Error("단어 ID는 서로 달라야 합니다.");
  return pairs;
}

export function createMatchingBoard(
  pairs: readonly MatchingPair[],
  completedPairIds: readonly string[],
  seed: string,
): readonly MatchingCard[] {
  const completed = new Set(completedPairIds);
  const remaining = pairs.filter((pair) => !completed.has(pair.id));
  const completedPairs = pairs.filter((pair) => completed.has(pair.id));
  if (remaining.length === 0) return [];

  const remainingTerms = shuffled(remaining, `${seed}:terms`).slice(0, 4);
  const termFillers = shuffled(completedPairs, `${seed}:term-fillers`).slice(0, Math.max(0, 4 - remainingTerms.length));
  const termPairs = [...remainingTerms, ...termFillers];
  const desiredOverlap = remaining.length >= 7 ? 1 + (completedPairIds.length % 2) : Math.min(2, remaining.length);
  const overlapCount = Math.min(desiredOverlap, remainingTerms.length);
  const overlap = shuffled(remainingTerms, `${seed}:overlap`).slice(0, overlapCount);
  const termIds = new Set(termPairs.map((pair) => pair.id));
  const decoys = shuffled(remaining.filter((pair) => !termIds.has(pair.id)), `${seed}:decoys`)
    .slice(0, Math.max(0, 4 - overlap.length));
  const meaningFillers = shuffled(completedPairs.filter((pair) => !termIds.has(pair.id)), `${seed}:meaning-fillers`)
    .slice(0, Math.max(0, 4 - overlap.length - decoys.length));
  const meaningPairs = shuffled([...overlap, ...decoys, ...meaningFillers], `${seed}:meanings`).slice(0, 4);

  const cards: MatchingCard[] = [
    ...termPairs.map((pair) => ({ id: `term:${pair.id}`, pairId: pair.id, kind: "term" as const, text: pair.term })),
    ...meaningPairs.map((pair) => ({ id: `meaning:${pair.id}`, pairId: pair.id, kind: "meaning" as const, text: pair.meaning })),
  ];
  return shuffled(cards, `${seed}:grid`);
}

export function isMatchingPair(first: MatchingCard, second: MatchingCard): boolean {
  return first.kind !== second.kind && first.pairId === second.pairId;
}

export function matchingComboResult(currentCombo: number, correct: boolean): { readonly combo: number; readonly scoreDelta: number } {
  const result = applyComboScore(currentCombo, correct, 100, { bonusPerStep: 20, maximumBonus: 100 });
  return { combo: result.combo, scoreDelta: result.scoreDelta };
}

export function countVisiblePairs(cards: readonly MatchingCard[]): number {
  const terms = new Set(cards.filter((card) => card.kind === "term").map((card) => card.pairId));
  return new Set(cards.filter((card) => card.kind === "meaning" && terms.has(card.pairId)).map((card) => card.pairId)).size;
}

export function refillMatchingBoard(
  cards: readonly MatchingCard[],
  matchedPairId: string,
  pairs: readonly MatchingPair[],
  completedPairIds: readonly string[],
  seed: string,
): readonly MatchingCard[] {
  const retained = cards.filter((card) => card.pairId !== matchedPairId);
  const completed = new Set(completedPairIds);
  const available = shuffled(pairs.filter((pair) => !completed.has(pair.id)), `${seed}:refill`);
  const termIds = new Set(retained.filter((card) => card.kind === "term").map((card) => card.pairId));
  const meaningIds = new Set(retained.filter((card) => card.kind === "meaning").map((card) => card.pairId));
  const existingPairCount = countVisiblePairs(retained);
  const targetPairCount = 1 + (hashString(seed) % 2);
  const termCandidates = available.filter((pair) => !termIds.has(pair.id));
  const meaningCandidates = available.filter((pair) => !meaningIds.has(pair.id));
  const candidateTargets = targetPairCount === 1 ? [1, 2] : [2, 1];
  let nextTerm: MatchingPair | undefined;
  let nextMeaning: MatchingPair | undefined;

  for (const target of candidateTargets) {
    for (const term of termCandidates) {
      const meaning = meaningCandidates.find((candidate) => {
        if (candidate.id === term.id) return false;
        const resultingPairs = existingPairCount
          + (meaningIds.has(term.id) ? 1 : 0)
          + (termIds.has(candidate.id) ? 1 : 0);
        return resultingPairs === target;
      });
      if (!meaning) continue;
      nextTerm = term;
      nextMeaning = meaning;
      break;
    }
    if (nextTerm && nextMeaning) break;
  }

  if (!nextTerm || !nextMeaning) return createMatchingBoard(pairs, completedPairIds, `${seed}:fallback`);
  return cards.map((card) => {
    if (card.pairId !== matchedPairId) return card;
    const pair = card.kind === "term" ? nextTerm : nextMeaning;
    return { id: `${card.kind}:${pair.id}`, pairId: pair.id, kind: card.kind, text: card.kind === "term" ? pair.term : pair.meaning };
  });
}
