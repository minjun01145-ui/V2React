import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AiProviderError } from "../ai/ollamaProvider.js";
import { requireAdminTenant } from "../shared/auth.js";
import { assistSlideEdit, SlideAssistantError } from "./service.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public", timeoutSeconds: 180, maxInstances: 3, memory: "256MiB" } as const;

function callableError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof SlideAssistantError) return new HttpsError("invalid-argument", error.message);
  if (error instanceof AiProviderError) {
    logger.warn("Slide assistant AI provider request failed", { status: error.status, message: error.message });
    return new HttpsError(error.status === 401 || error.status === 403 ? "permission-denied" : "unavailable", error.message);
  }
  const message = error instanceof Error ? error.message : "슬라이드 AI 작업을 완료하지 못했습니다.";
  logger.error("Slide assistant failed", { message });
  return new HttpsError("failed-precondition", message);
}

export const assistSlide = onCall(options, async (request) => {
  await requireAdminTenant(request);
  try {
    return await assistSlideEdit(request.data);
  } catch (error: unknown) {
    throw callableError(error);
  }
});
