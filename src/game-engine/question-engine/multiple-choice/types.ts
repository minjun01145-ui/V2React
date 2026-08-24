import type { CanonicalQuestionSet } from "../types.ts";

export type ChoiceCount = 2 | 3 | 4 | 5;

export const CHOICE_DIRECTION = Object.freeze({
  LEFT_TO_RIGHT: "left-to-right",
  RIGHT_TO_LEFT: "right-to-left",
} as const);

export type ChoiceDirection = typeof CHOICE_DIRECTION[keyof typeof CHOICE_DIRECTION];

export interface MultipleChoicePair<TSource = unknown> {
  readonly id: string;
  readonly left: string;
  readonly right: string;
  readonly source: TSource;
}

export interface MultipleChoiceOption {
  readonly id: string;
  readonly text: string;
}

export interface MultipleChoiceQuestion<TSource = unknown> {
  readonly id: string;
  readonly kind: "multiple-choice";
  readonly prompt: string;
  readonly options: readonly MultipleChoiceOption[];
  readonly correctOptionId: string;
  readonly direction: ChoiceDirection;
  readonly source: TSource;
}

export type MultipleChoiceQuestionSet<TSource = unknown> = CanonicalQuestionSet<MultipleChoiceQuestion<TSource>> & {
  readonly type: "multiple-choice";
  readonly choiceCount: ChoiceCount;
  readonly direction: ChoiceDirection;
};

export interface MultipleChoiceAnswer {
  readonly optionId: string;
}

export interface MultipleChoiceEvaluationDetails {
  readonly selectedOptionId: string;
  readonly correctOptionId: string;
}

export interface BuildMultipleChoiceSetInput<TSource = unknown> {
  readonly id: string;
  readonly title: string;
  readonly pairs: readonly MultipleChoicePair<TSource>[];
  readonly choiceCount: ChoiceCount;
  readonly direction: ChoiceDirection;
  readonly seed?: unknown;
  readonly questionLimit?: number;
  readonly shuffleQuestions?: boolean;
}
