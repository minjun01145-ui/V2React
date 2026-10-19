import type { ChoiceDirection } from "../game-engine/question-engine/multiple-choice/types.ts";
import { buildTrueFalseSet, type TrueFalseQuestionSet } from "../game-engine/question-engine/true-false/index.ts";
import { LEARNING_SET_QUESTION_SCOPE, type LearningSetQuestionScope, type LearningSetQuestionSource } from "./multipleChoiceTypes.ts";
import { learningSetPairs } from "./questionPairs.ts";
import type { RuntimeLearningSet } from "./types.ts";

export interface LearningSetTrueFalseOptions {
  readonly direction: ChoiceDirection;
  /** Reading sets: whole sentences (entry) or each reading chunk (chunk). */
  readonly scope?: LearningSetQuestionScope;
  readonly trueRatio?: number;
  readonly seed?: string | number;
  readonly questionLimit?: number;
}

/** OX questions from any vocabulary or reading set. */
export function adaptLearningSetToTrueFalse(set: RuntimeLearningSet, options: LearningSetTrueFalseOptions): TrueFalseQuestionSet<LearningSetQuestionSource> {
  const scope = options.scope ?? LEARNING_SET_QUESTION_SCOPE.ENTRY;
  return buildTrueFalseSet({
    id: `${set.id}:true-false:${scope}:${options.direction}`,
    title: set.name,
    pairs: learningSetPairs(set, scope),
    direction: options.direction,
    ...(options.trueRatio === undefined ? {} : { trueRatio: options.trueRatio }),
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.questionLimit === undefined ? {} : { questionLimit: options.questionLimit }),
  });
}
