import { useEffect, useState } from "react";
import { subscribeQuestionKey, subscribeQuestionResponses } from "./repository.ts";
import type { GradingKey, PublicQuestion, QuestionResponse } from "./model.ts";

export function useQuestionResponses(roomId: string, roundId: string, playerId: string | null = null) {
  const [value, setValue] = useState<readonly QuestionResponse[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setValue([]); setError(null); setLoading(true);
    return subscribeQuestionResponses(roomId, roundId, playerId, (next) => { setValue(next); setLoading(false); }, (next) => { setError(next); setLoading(false); });
  }, [roomId, roundId, playerId]);
  return { value, error, loading };
}
export function useQuestionKey(roomId: string, runId: string, slideId: string, question: PublicQuestion) {
  const [value, setValue] = useState<GradingKey | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    setValue(null); setError(null);
    return subscribeQuestionKey(roomId, runId, slideId, question, setValue, setError);
  }, [roomId, runId, slideId, question]);
  return { value, error };
}
