import type { PairMatchingPair } from "../game-engine/pair-matching/index.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "./types.ts";

export function adaptLearningSetToPairMatching(set: LearningSet): readonly PairMatchingPair[] {
  if (set.type !== LEARNING_SET_TYPE.VOCABULARY) throw new Error("짝맞추기는 단어 세트만 사용할 수 있습니다.");
  const pairs = set.items.map((item) => ({
    id: item.id,
    term: item.sourceText.trim(),
    meaning: item.meaning.trim(),
  }));
  if (pairs.some((pair) => !pair.id || !pair.term || !pair.meaning)) throw new Error("비어 있는 단어나 뜻은 짝맞추기에 사용할 수 없습니다.");
  if (new Set(pairs.map((pair) => pair.id)).size !== pairs.length) throw new Error("단어 ID는 서로 달라야 합니다.");
  return pairs;
}
