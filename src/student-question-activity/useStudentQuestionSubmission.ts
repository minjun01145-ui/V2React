import { useEffect, useState } from "react";
import { subscribeStudentQuestionSubmission } from "./repository.ts";
import type { StudentQuestionSubmission } from "./types.ts";

export function useStudentQuestionSubmission(roomId: string, runId: string | null, playerId: string) {
  const [submission, setSubmission] = useState<StudentQuestionSubmission | null>(null);
  const [loading, setLoading] = useState(Boolean(runId));
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    setSubmission(null);
    setError(null);
    if (!runId) { setLoading(false); return undefined; }
    setLoading(true);
    return subscribeStudentQuestionSubmission(roomId, runId, playerId, (value) => { setSubmission(value); setLoading(false); }, (value) => { setError(value); setLoading(false); });
  }, [playerId, roomId, runId]);
  return { submission, loading, error };
}
