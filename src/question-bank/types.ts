/**
 * Teacher-approved questions kept per learning set. They are stored independently of any worksheet so
 * later features (quizzes, games, other worksheets) can reuse them.
 *
 * Text markup: "______" is a blank and [[...]] marks an underlined part.
 */
export type ExamQuestionContent = {
  /** The instruction, e.g. "다음 문장의 빈칸에 알맞은 것은?" */
  readonly prompt: string;
  /** A boxed passage, <보기> or dialogue; null when the prompt stands alone. */
  readonly context: string | null;
  readonly explanation: string;
} & (
  | { readonly format: "choice"; readonly choices: readonly string[]; /** 1-based, like ①–⑤. */ readonly correctChoice: number }
  | { readonly format: "written"; readonly answer: string }
);

export interface BankQuestion {
  readonly id: string;
  readonly setId: string;
  readonly content: ExamQuestionContent;
  readonly createdAtMs: number;
}

export const EXAM_CHOICE_COUNT = 5;
export const CHOICE_MARKS = ["①", "②", "③", "④", "⑤"] as const;

/** The answer as printed on an answer key. */
export function examAnswerText(content: ExamQuestionContent): string {
  return content.format === "choice" ? CHOICE_MARKS[content.correctChoice - 1] ?? String(content.correctChoice) : content.answer;
}
