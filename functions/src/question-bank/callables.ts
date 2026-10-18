import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AiProviderError } from "../ai/ollamaProvider.js";
import { requireAdminTenant } from "../shared/auth.js";
import { ExamQuestionValidationError } from "./model.js";
import { generateExamQuestionDraft } from "./service.js";

export const generateExamQuestions = onCall({ region: "asia-northeast3", enforceAppCheck: false, invoker: "public", timeoutSeconds: 360, maxInstances: 3, memory: "256MiB" }, async (request) => {
  await requireAdminTenant(request);
  try {
    return await generateExamQuestionDraft(request.data);
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof ExamQuestionValidationError) throw new HttpsError("invalid-argument", error.message);
    if (error instanceof AiProviderError) {
      logger.warn("Exam question AI provider failed", { status: error.status, message: error.message });
      throw new HttpsError("unavailable", error.message);
    }
    logger.error("Exam question generation failed", { message: error instanceof Error ? error.message : "unknown" });
    throw new HttpsError("failed-precondition", "문제를 만들지 못했습니다.");
  }
});
