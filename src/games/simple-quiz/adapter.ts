import { CHOICE_DIRECTION, type ChoiceCount, type MultipleChoiceQuestionSet } from "../../game-engine/question-engine/multiple-choice/index.ts";
import { adaptLearningSetToMultipleChoice } from "../../learning-sets/multipleChoiceAdapter.ts";
import type { LearningSetQuestionSource } from "../../learning-sets/multipleChoiceTypes.ts";
import type { LearningSet } from "../../learning-sets/types.ts";

export function adaptSimpleQuizSet(set: LearningSet, roundId: string, choiceCount: ChoiceCount): MultipleChoiceQuestionSet<LearningSetQuestionSource> {
  return adaptLearningSetToMultipleChoice(set, {
    choiceCount,
    direction: CHOICE_DIRECTION.RIGHT_TO_LEFT,
    seed: `${roundId}:${set.id}:simple-quiz`,
  });
}
