import { LEARNING_SET_TYPE, type LearningSet } from "../../learning-sets/types.ts";

export type PokemonQuizKind = "matching-all" | "sentence-builder";

export function pokemonQuizKind(set: LearningSet): PokemonQuizKind {
  return set.type === LEARNING_SET_TYPE.VOCABULARY ? "matching-all" : "sentence-builder";
}

