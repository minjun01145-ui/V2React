import { useEffect, useState } from "react";
import { subscribePlayerProgress, subscribeRoundAnswers, subscribeRoundProgress } from "./repository.ts";
import type { RoundAnswerRecord, RoundProgressRecord } from "./types.ts";

interface AsyncValue<T> {
  readonly value: T;
  readonly loading: boolean;
  readonly error: Error | null;
}

export function usePlayerGameProgress(roomId: string, roundId: string, playerId: string): AsyncValue<unknown> {
  const [value, setValue] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(roomId && roundId && playerId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomId || !roundId || !playerId) {
      setValue(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    setError(null);
    return subscribePlayerProgress(roomId, roundId, playerId, (nextValue) => {
      setValue(nextValue);
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError(nextError);
      setLoading(false);
    });
  }, [playerId, roomId, roundId]);

  return { value, loading, error };
}

export function useRoundAnswers(roomId: string, roundId: string): AsyncValue<RoundAnswerRecord[]> {
  const [value, setValue] = useState<RoundAnswerRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(roomId && roundId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribeRoundAnswers(roomId, roundId, (nextValue) => {
      setValue(nextValue);
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError(nextError);
      setLoading(false);
    });
  }, [roomId, roundId]);

  return { value, loading, error };
}

export function useRoundProgress(roomId: string, roundId: string): AsyncValue<RoundProgressRecord[]> {
  const [value, setValue] = useState<RoundProgressRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(roomId && roundId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribeRoundProgress(roomId, roundId, (nextValue) => {
      setValue(nextValue);
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError(nextError);
      setLoading(false);
    });
  }, [roomId, roundId]);

  return { value, loading, error };
}
