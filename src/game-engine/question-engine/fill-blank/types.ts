import type { CanonicalQuestionSet } from "../types.ts";
import type { MultipleChoiceOption } from "../multiple-choice/types.ts";
import type { WordClass } from "./wordClass.ts";

/** One sentence of the source text, chunk markers already removed. */
export interface FillBlankSentence<TSource = unknown> {
  readonly id: string;
  readonly text: string;
  readonly meaning: string;
  readonly source: TSource;
}

/** "I ____ a dog. (나는 강아지를 가지고 있다)" with have / like / play to choose from. */
export interface FillBlankQuestion<TSource = unknown> {
  readonly id: string;
  readonly kind: "fill-blank";
  /** The sentence around the blank: render `before`, a blank, then `after`. */
  readonly before: string;
  readonly after: string;
  readonly meaning: string;
  readonly options: readonly MultipleChoiceOption[];
  readonly correctOptionId: string;
  readonly answer: string;
  /** The guessed role of the blanked word; distractors were chosen to share it. */
  readonly wordClass: WordClass;
  readonly source: TSource;
}

export type FillBlankQuestionSet<TSource = unknown> = CanonicalQuestionSet<FillBlankQuestion<TSource>> & {
  readonly type: "fill-blank";
  readonly choiceCount: number;
};

export interface FillBlankAnswer {
  readonly optionId: string;
}

export interface FillBlankEvaluationDetails {
  readonly selectedOptionId: string;
  readonly correctOptionId: string;
  readonly answer: string;
}

export interface BuildFillBlankSetInput<TSource = unknown> {
  readonly id: string;
  readonly title: string;
  readonly sentences: readonly FillBlankSentence<TSource>[];
  /** Options per question including the answer, 2–5. */
  readonly choiceCount: number;
  readonly seed?: unknown;
  readonly questionLimit?: number;
  readonly shuffleQuestions?: boolean;
}
