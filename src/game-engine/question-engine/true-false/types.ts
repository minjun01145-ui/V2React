import type { CanonicalQuestionSet } from "../types.ts";
import type { ChoiceDirection, MultipleChoicePair } from "../multiple-choice/types.ts";

/** "dog - 고양이": is this pairing right (O) or wrong (X)? */
export interface TrueFalseQuestion<TSource = unknown> {
  readonly id: string;
  readonly kind: "true-false";
  readonly prompt: string;
  /** The answer shown next to the prompt; the real one when `isTrue`, another item's otherwise. */
  readonly statement: string;
  readonly isTrue: boolean;
  /** The actual answer, for feedback after a wrong guess. */
  readonly correctAnswer: string;
  readonly direction: ChoiceDirection;
  readonly source: TSource;
}

export type TrueFalseQuestionSet<TSource = unknown> = CanonicalQuestionSet<TrueFalseQuestion<TSource>> & {
  readonly type: "true-false";
  readonly direction: ChoiceDirection;
};

export interface TrueFalseAnswer {
  /** true = O, false = X. */
  readonly value: boolean;
}

export interface TrueFalseEvaluationDetails {
  readonly selected: boolean;
  readonly isTrue: boolean;
  readonly correctAnswer: string;
}

export interface BuildTrueFalseSetInput<TSource = unknown> {
  readonly id: string;
  readonly title: string;
  readonly pairs: readonly MultipleChoicePair<TSource>[];
  readonly direction: ChoiceDirection;
  /** Share of questions whose statement is correct; 0.5 by default. */
  readonly trueRatio?: number;
  readonly seed?: unknown;
  readonly questionLimit?: number;
  readonly shuffleQuestions?: boolean;
}
