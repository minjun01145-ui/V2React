import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../shared/auth.js";
import { getAdminAiSettings, generateAiReply, saveAdminAiSettings, testAiProviderConnection } from "./service.js";
import { AiProviderError } from "./ollamaProvider.js";
import { AiValidationError, parseAdminTestMessage, parseAiProviderSettings, parseOptionalApiKey } from "./validation.js";

const readOptions = { region: "asia-northeast3", enforceAppCheck: false, timeoutSeconds: 30, maxInstances: 3 } as const;
const inferenceOptions = { region: "asia-northeast3", enforceAppCheck: false, timeoutSeconds: 120, maxInstances: 3, memory: "256MiB" } as const;

function callableError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof AiValidationError) return new HttpsError("invalid-argument", error.message);
  if (error instanceof AiProviderError) {
    logger.warn("AI provider request failed", { status: error.status, message: error.message });
    return new HttpsError(error.status === 401 || error.status === 403 ? "permission-denied" : "unavailable", error.message);
  }
  const message = error instanceof Error ? error.message : "AI 작업을 완료하지 못했습니다.";
  logger.error("AI admin operation failed", { message });
  return new HttpsError("failed-precondition", message);
}

export const getAiProviderSettings = onCall(readOptions, async (request) => {
  await requireAdmin(request);
  try {
    return await getAdminAiSettings();
  } catch (error: unknown) {
    throw callableError(error);
  }
});

export const saveAiProviderSettings = onCall(readOptions, async (request) => {
  const adminUid = await requireAdmin(request);
  try {
    return await saveAdminAiSettings(
      parseAiProviderSettings(request.data),
      parseOptionalApiKey(typeof request.data === "object" && request.data !== null && "apiKey" in request.data ? request.data.apiKey : null),
      adminUid,
    );
  } catch (error: unknown) {
    throw callableError(error);
  }
});

export const testAiConnection = onCall(inferenceOptions, async (request) => {
  await requireAdmin(request);
  try {
    return await testAiProviderConnection();
  } catch (error: unknown) {
    throw callableError(error);
  }
});

export const sendAiTestMessage = onCall(inferenceOptions, async (request) => {
  await requireAdmin(request);
  try {
    return await generateAiReply(parseAdminTestMessage(request.data).messages);
  } catch (error: unknown) {
    throw callableError(error);
  }
});
