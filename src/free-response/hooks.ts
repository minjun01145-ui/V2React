import { useCallback, useEffect, useState } from "react";
import { subscribeFreeResponse, subscribeFreeResponses } from "./repository.ts";
import type { FreeResponse } from "./types.ts";

interface Snapshot<T> { readonly value: T; readonly loading: boolean; readonly error: Error | null }

function useResponseSubscription<T>(scope: string, initialValue: T, subscribe: (onValue: (value: T) => void, onError: (error: Error) => void) => () => void): Snapshot<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T> & { readonly scope: string }>(() => ({ scope, value: initialValue, loading: true, error: null }));
  useEffect(() => {
    let active = true;
    setSnapshot({ scope, value: initialValue, loading: true, error: null });
    const unsubscribe = subscribe(
      (value) => { if (active) setSnapshot({ scope, value, loading: false, error: null }); },
      (error) => { if (active) setSnapshot({ scope, value: initialValue, loading: false, error }); },
    );
    return () => { active = false; unsubscribe(); };
  }, [scope, subscribe]);
  return snapshot.scope === scope ? snapshot : { value: initialValue, loading: true, error: null };
}

export function useFreeResponse(roomId: string, roundId: string, playerId: string) {
  const subscribe = useCallback((onValue: (value: FreeResponse | null) => void, onError: (error: Error) => void) => subscribeFreeResponse(roomId, roundId, playerId, onValue, onError), [roomId, roundId, playerId]);
  return useResponseSubscription(JSON.stringify([roomId, roundId, playerId]), null, subscribe);
}

export function useFreeResponses(roomId: string, roundId: string) {
  const subscribe = useCallback((onValue: (value: readonly FreeResponse[]) => void, onError: (error: Error) => void) => subscribeFreeResponses(roomId, roundId, onValue, onError), [roomId, roundId]);
  return useResponseSubscription<readonly FreeResponse[]>(JSON.stringify([roomId, roundId]), [], subscribe);
}
