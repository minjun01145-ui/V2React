import { STUDENT_QUESTION_ACTIVITY_KIND, type LatestStudentQuestionResult, type StudentQuestionActivity, type StudentQuestionSubmission } from "./types.ts";
import { parseStudentQuestionConfig } from "./validation.ts";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parseStudentQuestionActivity(value: unknown): StudentQuestionActivity | null {
  const data = record(value);
  if (!data || data.kind !== STUDENT_QUESTION_ACTIVITY_KIND || typeof data.runId !== "string" || !data.runId) return null;
  if (data.phase !== "active" && data.phase !== "finalizing") return null;
  try {
    return {
      kind: STUDENT_QUESTION_ACTIVITY_KIND,
      runId: data.runId,
      phase: data.phase,
      config: parseStudentQuestionConfig(data.config),
      expectedPlayerIds: Array.isArray(data.expectedPlayerIds) ? data.expectedPlayerIds.filter((id): id is string => typeof id === "string" && Boolean(id)) : [],
      resultSetId: typeof data.resultSetId === "string" && data.resultSetId ? data.resultSetId : null,
    };
  } catch { return null; }
}

export function parseLatestStudentQuestionResult(value: unknown): LatestStudentQuestionResult | null {
  const data = record(value);
  return data && typeof data.runId === "string" && typeof data.resultSetId === "string" && typeof data.finalizedAtMs === "number"
    ? { runId: data.runId, resultSetId: data.resultSetId, finalizedAtMs: data.finalizedAtMs }
    : null;
}

export function parseStudentQuestionSubmission(id: string, value: unknown): StudentQuestionSubmission | null {
  const data = record(value);
  if (!data || data.playerId !== id || data.submitted !== true || !Array.isArray(data.questions)) return null;
  const questions = data.questions.flatMap((raw) => {
    const item = record(raw);
    return item && typeof item.question === "string" && typeof item.referenceAnswer === "string"
      ? [{ question: item.question, referenceAnswer: item.referenceAnswer }] : [];
  });
  return typeof data.submittedAtMs === "number" ? { playerId: id, questions, submitted: true, submittedAtMs: data.submittedAtMs } : null;
}
