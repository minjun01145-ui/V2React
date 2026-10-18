import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AiProviderError } from "../ai/ollamaProvider.js";
import { requireAdminTenant } from "../shared/auth.js";
import { WorksheetValidationError } from "./model.js";
import { generateWorksheetDraft } from "./service.js";

export const generateWorksheet = onCall({ region: "asia-northeast3", enforceAppCheck: false, invoker: "public", timeoutSeconds: 360, maxInstances: 3, memory: "256MiB" }, async request => {
  await requireAdminTenant(request);
  try { return await generateWorksheetDraft(request.data); }
  catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof WorksheetValidationError) throw new HttpsError("invalid-argument", error.message);
    if (error instanceof AiProviderError) {
      logger.warn("Worksheet AI provider failed", { status: error.status, message: error.message });
      throw new HttpsError("unavailable", error.message);
    }
    logger.error("Worksheet generation failed", { message: error instanceof Error ? error.message : "unknown" });
    throw new HttpsError("failed-precondition", "학습지 생성을 완료하지 못했습니다.");
  }
});
