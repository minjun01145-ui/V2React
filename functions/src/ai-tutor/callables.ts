import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AiProviderError } from "../ai/ollamaProvider.js";
import { requireAnonymous } from "../shared/auth.js";
import { consumeAiTutorTurn } from "./rateLimit.js";
import { evaluateAiTutorTurn } from "./service.js";
import { AiTutorValidationError, parseAiTutorTurnInput } from "./validation.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, timeoutSeconds: 120, maxInstances: 6, memory: "256MiB" } as const;

function callableError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof AiTutorValidationError) return new HttpsError("invalid-argument", error.message);
  if (error instanceof AiProviderError) {
    logger.warn("AI tutor provider request failed", { status: error.status, message: error.message });
    return new HttpsError("unavailable", "AI 선생님이 잠시 응답하지 못했습니다. 다시 시도해주세요.");
  }
  logger.error("AI tutor turn failed", { message: error instanceof Error ? error.message : "unknown" });
  return new HttpsError("internal", "AI 문답을 처리하지 못했습니다.");
}

export const submitAiTutorTurn = onCall(options, async (request) => {
  const uid = requireAnonymous(request);
  try {
    const turn = parseAiTutorTurnInput(request.data);
    await consumeAiTutorTurn(uid);
    return await evaluateAiTutorTurn(uid, turn);
  } catch (error: unknown) {
    throw callableError(error);
  }
});

