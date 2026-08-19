import type { AnswerResult } from "../core/types.ts";

export interface BaseQuestion {
  readonly id: string;
  readonly prompt?: string;
}

export interface CanonicalQuestionSet<TQuestion extends BaseQuestion = BaseQuestion> {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly questions: readonly TQuestion[];
}

export type LastAnswerResult<TDetails = unknown> = AnswerResult<TDetails> & {
  readonly questionId: string;
};

export interface GameProgress<TDetails = unknown> {
  readonly currentIndex: number;
  readonly score: number;
  readonly correctCount: number;
  readonly attemptCount: number;
  readonly completedQuestionIds: readonly string[];
  readonly lastResult: LastAnswerResult<TDetails> | null;
  readonly completedAtMs: number | null;
}

export type Evaluator<TQuestion extends BaseQuestion, TAnswer, TDetails = unknown> = (
  question: TQuestion,
  answer: TAnswer,
) => AnswerResult<TDetails>;

export interface AnswerSubmission<TQuestion extends BaseQuestion, TAnswer, TDetails = unknown> {
  readonly attemptId: string;
  readonly question: TQuestion;
  readonly answer: TAnswer;
  readonly result: AnswerResult<TDetails>;
  readonly progress: GameProgress<TDetails>;
}
