import type { ChoiceCount, ChoiceDirection } from "../game-engine/question-engine/multiple-choice/types.ts";

export const LEARNING_SET_QUESTION_SCOPE = Object.freeze({
  ENTRY: "entry",
  CHUNK: "chunk",
} as const);

export type LearningSetQuestionScope = typeof LEARNING_SET_QUESTION_SCOPE[keyof typeof LEARNING_SET_QUESTION_SCOPE];

export interface LearningSetQuestionSource {
  readonly setId: string;
  readonly itemId: string;
  readonly itemIndex: number;
  readonly scope: LearningSetQuestionScope;
  readonly chunkIndex: number | null;
}

export interface LearningSetMultipleChoiceOptions {
  readonly choiceCount: ChoiceCount;
  readonly direction: ChoiceDirection;
  readonly scope?: LearningSetQuestionScope;
  readonly seed?: string | number;
  readonly questionLimit?: number;
  readonly shuffleQuestions?: boolean;
}
