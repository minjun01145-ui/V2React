import { createAnswerResult } from "../../core/answerResult.ts";
import type { AnswerResult } from "../../core/types.ts";
import type { TrueFalseAnswer, TrueFalseEvaluationDetails, TrueFalseQuestion } from "./types.ts";

export function evaluateTrueFalse(question: TrueFalseQuestion, answer: TrueFalseAnswer, correctScore = 100): AnswerResult<TrueFalseEvaluationDetails> {
  if (!Number.isFinite(correctScore) || correctScore < 0) throw new Error("OX 정답 점수는 0 이상의 숫자여야 합니다.");
  if (typeof answer.value !== "boolean") throw new Error("O 또는 X를 선택해야 합니다.");
  const isCorrect = answer.value === question.isTrue;
  return createAnswerResult({
    isCorrect,
    scoreDelta: isCorrect ? correctScore : 0,
    details: { selected: answer.value, isTrue: question.isTrue, correctAnswer: question.correctAnswer },
  });
}
