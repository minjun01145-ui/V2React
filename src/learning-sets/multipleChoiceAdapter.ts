import {
  buildMultipleChoiceSet,
  CHOICE_DIRECTION,
  type MultipleChoiceQuestionSet,
} from "../game-engine/question-engine/multiple-choice/index.ts";
import {
  LEARNING_SET_QUESTION_SCOPE,
  type LearningSetMultipleChoiceOptions,
  type LearningSetQuestionSource,
} from "./multipleChoiceTypes.ts";
import { learningSetPairs } from "./questionPairs.ts";
import type { RuntimeLearningSet } from "./types.ts";

export function adaptLearningSetToMultipleChoice(
  set: RuntimeLearningSet,
  options: LearningSetMultipleChoiceOptions,
): MultipleChoiceQuestionSet<LearningSetQuestionSource> {
  const scope = options.scope ?? LEARNING_SET_QUESTION_SCOPE.ENTRY;
  return buildMultipleChoiceSet({
    id: `${set.id}:multiple-choice:${scope}:${options.direction}:${options.choiceCount}`,
    title: set.name,
    pairs: learningSetPairs(set, scope),
    choiceCount: options.choiceCount,
    direction: options.direction,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.questionLimit === undefined ? {} : { questionLimit: options.questionLimit }),
    ...(options.shuffleQuestions === undefined ? {} : { shuffleQuestions: options.shuffleQuestions }),
  });
}

export { CHOICE_DIRECTION };
export { LEARNING_SET_QUESTION_SCOPE } from "./multipleChoiceTypes.ts";
export type { LearningSetMultipleChoiceOptions, LearningSetQuestionSource, LearningSetQuestionScope } from "./multipleChoiceTypes.ts";
