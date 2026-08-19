export const ANSWER_STATUS = {
  CORRECT: "correct",
  INCORRECT: "incorrect",
} as const;

export type AnswerStatus = (typeof ANSWER_STATUS)[keyof typeof ANSWER_STATUS];

export interface AnswerResult<TDetails = unknown> {
  readonly status: AnswerStatus;
  readonly isCorrect: boolean;
  readonly scoreDelta: number;
  readonly feedback: string | null;
  readonly details: TDetails | null;
}
