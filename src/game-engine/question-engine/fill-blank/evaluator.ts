import { createAnswerResult } from "../../core/answerResult.ts";
import type { AnswerResult } from "../../core/types.ts";
import type { FillBlankAnswer, FillBlankEvaluationDetails, FillBlankQuestion } from "./types.ts";

export function evaluateFillBlank(question: FillBlankQuestion, answer: FillBlankAnswer, correctScore = 100): AnswerResult<FillBlankEvaluationDetails> {
  if (!Number.isFinite(correctScore) || correctScore < 0) throw new Error("빈칸 정답 점수는 0 이상의 숫자여야 합니다.");
  const selectedOptionId = String(answer.optionId ?? "");
  const selectedExists = question.options.some((option) => option.id === selectedOptionId);
  const isCorrect = selectedExists && selectedOptionId === question.correctOptionId;
  return createAnswerResult({
    isCorrect,
    scoreDelta: isCorrect ? correctScore : 0,
    feedback: selectedExists ? null : "선택한 보기를 찾을 수 없습니다.",
    details: { selectedOptionId, correctOptionId: question.correctOptionId, answer: question.answer },
  });
}
