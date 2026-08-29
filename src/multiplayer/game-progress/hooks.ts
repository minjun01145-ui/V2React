import { useCallback, useEffect, useState } from "react";
import { subscribePlayerProgress, subscribeRoundAttempts, subscribeRoundProgress } from "./repository.ts";
import type { RoundAttemptRecord, RoundProgressRecord } from "./types.ts";

interface AsyncValue<T> {
  readonly value: T;
  readonly loading: boolean;
  readonly error: Error | null;
}

function useSubscription<T>(initialValue: T, enabled: boolean, subscribe: (onValue: (value: T) => void, onError: (error: Error) => void) => () => void): AsyncValue<T> {
  const [value, setValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!enabled) {
      setValue(initialValue);
      setLoading(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    setError(null);
    return subscribe((nextValue) => {
      setValue(nextValue);
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError(nextError);
      setLoading(false);
    });
  }, [enabled, subscribe]);
  return { value, loading, error };
}

export function usePlayerGameProgress(roomId: string, roundId: string, playerId: string): AsyncValue<unknown> {
  const subscribe = useCallback((onValue: (value: unknown) => void, onError: (error: Error) => void) => subscribePlayerProgress(roomId, roundId, playerId, onValue, onError), [playerId, roomId, roundId]);
  return useSubscription(null, Boolean(roomId && roundId && playerId), subscribe);
}

export function useRoundAttempts(roomId: string, roundId: string): AsyncValue<RoundAttemptRecord[]> {
  const subscribe = useCallback((onValue: (value: RoundAttemptRecord[]) => void, onError: (error: Error) => void) => subscribeRoundAttempts(roomId, roundId, onValue, onError), [roomId, roundId]);
  return useSubscription([], Boolean(roomId && roundId), subscribe);
}

export function useRoundProgress(roomId: string, roundId: string): AsyncValue<RoundProgressRecord[]> {
  const subscribe = useCallback((onValue: (value: RoundProgressRecord[]) => void, onError: (error: Error) => void) => subscribeRoundProgress(roomId, roundId, onValue, onError), [roomId, roundId]);
  return useSubscription([], Boolean(roomId && roundId), subscribe);
}
