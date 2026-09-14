import { useEffect, useState } from "react";
import type { WaitingDiceState } from "./model.ts";
import { subscribeWaitingDice } from "./repository.ts";

export function useWaitingDice(roomId: string, playerId: string | null): {
  readonly value: WaitingDiceState | null;
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const [value, setValue] = useState<WaitingDiceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!playerId) {
      setValue(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    setError(null);
    return subscribeWaitingDice(roomId, playerId, (nextValue) => {
      setValue(nextValue);
      setLoading(false);
    }, (nextError) => {
      console.error(nextError);
      setError(nextError);
      setLoading(false);
    });
  }, [playerId, roomId]);

  return { value, loading, error };
}
