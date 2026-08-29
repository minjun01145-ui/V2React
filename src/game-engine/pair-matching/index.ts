export type PairMatchingSide = "term" | "meaning";

export interface PairMatchingPair {
  readonly id: string;
  readonly term: string;
  readonly meaning: string;
}

export interface PairMatchingCard {
  readonly id: string;
  readonly pairId: string;
  readonly kind: PairMatchingSide;
  readonly text: string;
}

export function createPairCard(pair: PairMatchingPair, kind: PairMatchingSide): PairMatchingCard {
  return {
    id: `${kind}:${pair.id}`,
    pairId: pair.id,
    kind,
    text: kind === "term" ? pair.term : pair.meaning,
  };
}

export function createPairCards(pairs: readonly PairMatchingPair[]): readonly PairMatchingCard[] {
  return [
    ...pairs.map((pair) => createPairCard(pair, "term")),
    ...pairs.map((pair) => createPairCard(pair, "meaning")),
  ];
}

export function isMatchingPair(first: PairMatchingCard, second: PairMatchingCard): boolean {
  return first.kind !== second.kind && first.pairId === second.pairId;
}
