export function shouldFinalizeStudentQuestionRun(expectedPlayerIds: readonly string[], submittedPlayerIds: readonly string[], force: boolean): boolean {
  if (force) return true;
  const submitted = new Set(submittedPlayerIds);
  return [...new Set(expectedPlayerIds)].every((id) => submitted.has(id));
}

export function studentQuestionResultSetId(roomId: string, runId: string): string {
  return `student-questions-${roomId}-${runId}`;
}
