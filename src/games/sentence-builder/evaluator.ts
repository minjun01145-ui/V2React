import { createAnswerResult } from "../../game-engine/core/answerResult.ts";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import type { SentenceAnswer, SentenceEvaluationDetails, SentenceQuestion } from "./types.ts";

export function evaluateSentenceSequence(
  question: SentenceQuestion,
  answer: SentenceAnswer,
  options: { readonly points?: number } = {},
): AnswerResult<SentenceEvaluationDetails> {
  const points = options.points ?? 100;
  const selectedTokenIds = answer.tokenIds;
  const expectedTokenIds = question.expectedTokenIds;
  const isCorrect = selectedTokenIds.length === expectedTokenIds.length
    && selectedTokenIds.every((tokenId, index) => tokenId === expectedTokenIds[index]);

  return createAnswerResult({
    isCorrect,
    scoreDelta: isCorrect ? points : 0,
    feedback: isCorrect ? "정답입니다! 다음 문제로 이동하세요." : "순서가 맞지 않습니다. 다시 배열해보세요.",
    details: {
      selectedCount: selectedTokenIds.length,
      expectedCount: expectedTokenIds.length,
    },
  });
}
