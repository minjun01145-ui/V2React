import { adaptLearningSetToMultipleChoice, CHOICE_DIRECTION } from "../../learning-sets/multipleChoiceAdapter.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../learning-sets/types.ts";
import type { PokemonCatchQuestionSet } from "./types.ts";

export function adaptVocabularySet(set: LearningSet, seed: string): PokemonCatchQuestionSet {
  if (set.type !== LEARNING_SET_TYPE.VOCABULARY) {
    throw new Error("포켓몬 잡기는 단어 세트만 사용할 수 있습니다.");
  }
  return adaptLearningSetToMultipleChoice(set, {
    choiceCount: 4,
    direction: CHOICE_DIRECTION.LEFT_TO_RIGHT,
    seed,
    shuffleQuestions: true,
  });
}

