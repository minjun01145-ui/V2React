import { useCallback, useEffect, useState } from "react";
import { subscribeRoundLiveMetrics } from "./repository.ts";
import type { RoundLiveMetricRecord } from "./types.ts";

export function useRoundLiveMetrics(roomId: string, roundId: string): {
  readonly value: readonly RoundLiveMetricRecord[];
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const enabled = Boolean(roomId && roundId);
  const subscribe = useCallback(
    (onValue: (value: RoundLiveMetricRecord[]) => void, onError: (error: Error) => void) => (
      subscribeRoundLiveMetrics(roomId, roundId, onValue, onError)
    ),
    [roomId, roundId],
  );
  const [state, setState] = useState<{
    readonly value: readonly RoundLiveMetricRecord[];
    readonly loading: boolean;
    readonly error: Error | null;
  }>({ value: [], loading: enabled, error: null });

  useEffect(() => {
    if (!enabled) {
      setState({ value: [], loading: false, error: null });
      return undefined;
    }
    setState({ value: [], loading: true, error: null });
    return subscribe(
      (value) => setState({ value, loading: false, error: null }),
      (error) => setState((current) => ({ ...current, loading: false, error })),
    );
  }, [enabled, subscribe]);
  return state;
}
