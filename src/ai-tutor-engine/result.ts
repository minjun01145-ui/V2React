import { createAnswerResult } from "../game-engine/core/answerResult.ts";
import type { AnswerResult } from "../game-engine/core/types.ts";
import type { AiTutorEvaluationDetails, AiTutorReply } from "./types.ts";

export function aiTutorAnswerResult(reply: AiTutorReply): AnswerResult<AiTutorEvaluationDetails> {
  return createAnswerResult({
    isCorrect: reply.isCorrect,
    scoreDelta: reply.scoreDelta,
    feedback: reply.feedback,
    details: { kind: reply.kind, focus: reply.focus, hint: reply.hint },
  });
}

