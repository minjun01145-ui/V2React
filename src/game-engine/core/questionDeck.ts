import type { BaseQuestion } from "../types.ts";
import { shuffled } from "./random.ts";

interface QuestionDeckOptions {
  readonly seed?: unknown;
  readonly shuffleQuestions?: boolean;
}

export function createQuestionDeck<TQuestion extends BaseQuestion>(
  questions: readonly TQuestion[],
  options: QuestionDeckOptions = {},
): TQuestion[] {
  const ids = questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) throw new Error("Question IDs must be unique within a set.");
  return (options.shuffleQuestions ?? true) ? shuffled(questions, options.seed) : [...questions];
}
