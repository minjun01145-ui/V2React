import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AiProviderError } from "../ai/ollamaProvider.js";
import { requireAdminTenant } from "../shared/auth.js";
import { generateLearningSetDraft, LearningSetGenerationError } from "./service.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public", timeoutSeconds: 300, maxInstances: 3, memory: "512MiB" } as const;

function callableError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof LearningSetGenerationError) return new HttpsError("invalid-argument", error.message);
  if (error instanceof AiProviderError) {
    logger.warn("Learning set AI provider request failed", { status: error.status, message: error.message });
    return new HttpsError(error.status === 401 || error.status === 403 ? "permission-denied" : "unavailable", error.message);
  }
  const message = error instanceof Error ? error.message : "AI 학습세트 생성을 완료하지 못했습니다.";
  logger.error("Learning set generation failed", { message });
  return new HttpsError("failed-precondition", message);
}

export const generateLearningSet = onCall(options, async (request) => {
  await requireAdminTenant(request);
  try {
    return await generateLearningSetDraft(request.data);
  } catch (error: unknown) {
    throw callableError(error);
  }
});
