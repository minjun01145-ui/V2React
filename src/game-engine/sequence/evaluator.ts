import { createAnswerResult } from "../core/answerResult.ts";
import type { AnswerResult } from "../core/types.ts";
import type { SequenceAnswer, SequenceEvaluationDetails, SequenceQuestion } from "./types.ts";
import { sentenceTextKey } from "./words.ts";

export function evaluateSequence(question: SequenceQuestion, answer: SequenceAnswer, options: { readonly points?: number } = {}): AnswerResult<SequenceEvaluationDetails> {
  const tokens = new Map(question.tokens.map((token) => [token.id, token.text]));
  const isCorrect = answer.tokenIds.length === question.expectedTokenIds.length
    && new Set(answer.tokenIds).size === answer.tokenIds.length
    && answer.tokenIds.every((tokenId, index) => {
      const text = tokens.get(tokenId);
      const expectedText = tokens.get(question.expectedTokenIds[index]!);
      return text !== undefined && expectedText !== undefined && sentenceTextKey(text) === sentenceTextKey(expectedText);
    });
  return createAnswerResult({
    isCorrect,
    scoreDelta: isCorrect ? (options.points ?? 100) : 0,
    feedback: isCorrect ? "정답입니다! 다음 문제로 이동하세요." : "순서가 맞지 않습니다. 다시 배열해보세요.",
    details: { selectedCount: answer.tokenIds.length, expectedCount: question.expectedTokenIds.length },
  });
}
