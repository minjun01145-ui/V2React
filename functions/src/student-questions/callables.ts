import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { AiProviderError } from "../ai/ollamaProvider.js";
import { requireAdmin, requireAnonymous } from "../shared/auth.js";
import { consumeAiTutorTurn } from "../ai-tutor/rateLimit.js";
import { finalizeStudentQuestionRun as finalizeRun, getAuthoringHelp } from "./service.js";
import { parseFinalizeInput, parseHelpInput, StudentQuestionValidationError } from "./validation.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, timeoutSeconds: 120, maxInstances: 6, memory: "256MiB" } as const;
function mapped(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof StudentQuestionValidationError) return new HttpsError("invalid-argument", error.message);
  if (error instanceof AiProviderError) return new HttpsError("unavailable", "AI 선생님이 잠시 응답하지 못했습니다.");
  logger.error("Student question operation failed", { message: error instanceof Error ? error.message : "unknown" });
  return new HttpsError("internal", "학생 질문 작업을 처리하지 못했습니다.");
}
export const getStudentQuestionAuthoringHelp = onCall(options, async (request) => {
  const uid = requireAnonymous(request);
  try { const input = parseHelpInput(request.data); await consumeAiTutorTurn(uid); return await getAuthoringHelp(uid, input); } catch (error: unknown) { throw mapped(error); }
});
export const finalizeStudentQuestionRun = onCall(options, async (request) => {
  try {
    const input = parseFinalizeInput(request.data);
    const callerUid = input.force ? (await requireAdmin(request), null) : requireAnonymous(request);
    return await finalizeRun(input.roomId, input.runId, input.force, callerUid);
  } catch (error: unknown) { throw mapped(error); }
});

export const onStudentQuestionSubmissionCreated = onDocumentCreated({
  document: "multiplayerSessions/{roomId}/studentQuestionRuns/{runId}/submissions/{uid}",
  region: "asia-northeast3",
  retry: true,
}, async (event) => {
  const { roomId, runId, uid } = event.params;
  try { await finalizeRun(roomId, runId, false, uid); }
  catch (error: unknown) { logger.error("Automatic student question finalization failed", { roomId, runId, message: error instanceof Error ? error.message : "unknown" }); throw error; }
});
