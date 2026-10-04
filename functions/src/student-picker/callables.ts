import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AiProviderError } from "../ai/ollamaProvider.js";
import { requireAdminForRoom } from "../shared/auth.js";
import { isRecord } from "../shared/validation.js";
import { generateDateStudentPick } from "./service.js";
import { StudentPickError } from "./model.js";

export const pickSlideShowStudent = onCall({ region: "asia-northeast3", invoker: "public", enforceAppCheck: false, timeoutSeconds: 120, maxInstances: 3, memory: "256MiB" }, async (request) => {
  if (!isRecord(request.data) || typeof request.data.roomId !== "string" || !/^[\p{L}\p{N}._-]{1,128}$/u.test(request.data.roomId)) throw new HttpsError("invalid-argument", "대기실을 확인해 주세요.");
  await requireAdminForRoom(request, request.data.roomId);
  try {
    return await generateDateStudentPick(request.data.roomId);
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof StudentPickError) throw new HttpsError("failed-precondition", error.message);
    if (error instanceof AiProviderError) throw new HttpsError("unavailable", "연결된 AI가 응답하지 못했습니다. 잠시 후 다시 뽑아 주세요.");
    logger.error("Date student pick failed", { message: error instanceof Error ? error.message : "unknown" });
    throw new HttpsError("failed-precondition", "AI 뽑기를 완료하지 못했습니다. 교사 AI 설정과 연결 상태를 확인해 주세요.");
  }
});
