import type { AnswerResult } from "../../game-engine/core/types.ts";
import { evaluateSequence } from "../../game-engine/sequence/evaluator.ts";
import type { SentenceAnswer, SentenceEvaluationDetails, SentenceQuestion } from "./types.ts";

export function evaluateSentenceSequence(
  question: SentenceQuestion,
  answer: SentenceAnswer,
  options: { readonly points?: number } = {},
): AnswerResult<SentenceEvaluationDetails> {
  return evaluateSequence(question, answer, options);
}
