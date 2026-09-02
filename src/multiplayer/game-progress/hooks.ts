import { useCallback, useEffect, useState } from "react";
import { progressLastOperationId, progressRevision } from "./mutation.ts";
import { subscribeSharedPlayerProgress } from "./playerProgressChannel.ts";
import { subscribeRoundAttempts, subscribeRoundProgress } from "./repository.ts";
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

export function usePlayerGameProgress(roomId: string, roundId: string, playerId: string): AsyncValue<unknown> & {
  readonly revision: number;
  readonly lastOperationId: string | null;
} {
  const scope = JSON.stringify([roomId, roundId, playerId]);
  const enabled = Boolean(roomId && roundId && playerId);
  const [snapshot, setSnapshot] = useState<{
    readonly scope: string;
    readonly value: unknown;
    readonly loading: boolean;
    readonly error: Error | null;
  }>(() => ({ scope, value: null, loading: enabled, error: null }));

  useEffect(() => {
    if (!enabled) {
      setSnapshot({ scope, value: null, loading: false, error: null });
      return undefined;
    }
    let active = true;
    setSnapshot({ scope, value: null, loading: true, error: null });
    const unsubscribe = subscribeSharedPlayerProgress(roomId, roundId, playerId, (incoming) => {
      if (!active) return;
      setSnapshot({
        scope,
        value: incoming.value,
        loading: incoming.loading,
        error: incoming.error,
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled, playerId, roomId, roundId, scope]);

  const current = snapshot.scope === scope
    ? snapshot
    : { scope, value: null, loading: enabled, error: null };
  return {
    ...current,
    revision: progressRevision(current.value),
    lastOperationId: progressLastOperationId(current.value),
  };
}

export function useRoundAttempts(roomId: string, roundId: string): AsyncValue<RoundAttemptRecord[]> {
  const subscribe = useCallback((onValue: (value: RoundAttemptRecord[]) => void, onError: (error: Error) => void) => subscribeRoundAttempts(roomId, roundId, onValue, onError), [roomId, roundId]);
  return useSubscription([], Boolean(roomId && roundId), subscribe);
}

export function useRoundProgress(roomId: string, roundId: string): AsyncValue<RoundProgressRecord[]> {
  const subscribe = useCallback((onValue: (value: RoundProgressRecord[]) => void, onError: (error: Error) => void) => subscribeRoundProgress(roomId, roundId, onValue, onError), [roomId, roundId]);
  return useSubscription([], Boolean(roomId && roundId), subscribe);
}
