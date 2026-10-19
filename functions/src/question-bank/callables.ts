import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { AiProviderError } from "../ai/ollamaProvider.js";
import { requireAdminTenant, requireRegularStudent } from "../shared/auth.js";
import { ExamQuestionValidationError } from "./model.js";
import { generateExamQuestionDraft } from "./service.js";
import { generateStudentPracticeQuestions } from "./studentPractice.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public", timeoutSeconds: 360, maxInstances: 3, memory: "256MiB" } as const;

function callableError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof ExamQuestionValidationError) return new HttpsError("invalid-argument", error.message);
  if (error instanceof AiProviderError) {
    logger.warn("Exam question AI provider failed", { status: error.status, message: error.message });
    return new HttpsError("unavailable", error.message);
  }
  logger.error("Exam question generation failed", { message: error instanceof Error ? error.message : "unknown" });
  return new HttpsError("failed-precondition", "문제를 만들지 못했습니다.");
}

export const generateExamQuestions = onCall(options, async (request) => {
  await requireAdminTenant(request);
  try {
    return await generateExamQuestionDraft(request.data);
  } catch (error: unknown) {
    throw callableError(error);
  }
});

/** Student exam practice from the lobby: questions only, on a set the server reads itself. */
export const generateStudentExamPractice = onCall(options, async (request) => {
  const student = await requireRegularStudent(request);
  try {
    return await generateStudentPracticeQuestions(student, request.data);
  } catch (error: unknown) {
    throw callableError(error);
  }
});
