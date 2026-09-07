import type { StudentQuestionActivity, StudentQuestionSubmission } from "./types.ts";

export function shouldShowStudentQuestionAuthoring(activity: StudentQuestionActivity | null | undefined, playerId: string, submission: StudentQuestionSubmission | null): boolean {
  return Boolean(activity && activity.phase === "active" && activity.expectedPlayerIds.includes(playerId) && !submission?.submitted);
}
