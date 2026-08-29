import { useEffect, useMemo, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { appConfig } from "../config/appConfig.ts";
import {
  ensureSession,
  subscribePlayer,
  subscribePlayers,
  subscribeSession,
  touchPlayer,
} from "./repository.ts";
import { selectActivePlayers } from "./presence.ts";
import { subscribeRoundParticipants } from "./round-participants/repository.ts";
import type { RoundParticipant } from "./round-participants/model.ts";
import type { GameSession, Player } from "./types.ts";

interface SubscriptionResult<T> {
  readonly value: T;
  readonly loading: boolean;
  readonly error: Error | null;
}

type SubscribeFunction<T> = (
  onValue: (value: T) => void,
  onError: (error: Error) => void,
) => Unsubscribe;

function useSubscription<T>(subscribe: SubscribeFunction<T>, initialValue: T): SubscriptionResult<T> {
  const [value, setValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribe(
      (nextValue) => {
        setValue(nextValue);
        setLoading(false);
      },
      (nextError) => {
        console.error(nextError);
        setError(nextError);
        setLoading(false);
      },
    );
  }, [subscribe]);

  return { value, loading, error };
}

export function useSession(roomId: string, options: { readonly ensure?: boolean } = {}): {
  readonly session: GameSession | null;
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const subscribe = useMemo<SubscribeFunction<GameSession | null>>(
    () => (onValue, onError) => subscribeSession(roomId, onValue, onError),
    [roomId],
  );
  useEffect(() => {
    if (options.ensure) void ensureSession(roomId).catch(console.error);
  }, [options.ensure, roomId]);
  const result = useSubscription(subscribe, null);
  return { session: result.value, loading: result.loading, error: result.error };
}

export function usePlayers(roomId: string): {
  readonly players: Player[];
  readonly activePlayers: Player[];
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const subscribe = useMemo<SubscribeFunction<Player[]>>(
    () => (onValue, onError) => subscribePlayers(roomId, onValue, onError),
    [roomId],
  );
  const result = useSubscription(subscribe, []);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    players: result.value,
    activePlayers: selectActivePlayers(result.value, now, appConfig.playerStaleAfterMs),
    loading: result.loading,
    error: result.error,
  };
}

export function useRoundParticipants(roomId: string, roundId: string): SubscriptionResult<RoundParticipant[]> {
  const subscribe = useMemo<SubscribeFunction<RoundParticipant[]>>(
    () => (onValue, onError) => subscribeRoundParticipants(roomId, roundId, onValue, onError),
    [roomId, roundId],
  );
  return useSubscription(subscribe, []);
}

export function usePlayer(roomId: string, playerId?: string): {
  readonly player: Player | null;
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const subscribe = useMemo<SubscribeFunction<Player | null> | null>(
    () => playerId ? (onValue, onError) => subscribePlayer(roomId, playerId, onValue, onError) : null,
    [roomId, playerId],
  );
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(Boolean(playerId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!subscribe) {
      setPlayer(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    setError(null);
    return subscribe(
      (nextPlayer) => {
        setPlayer(nextPlayer);
        setLoading(false);
      },
      (nextError) => {
        console.error(nextError);
        setError(nextError);
        setLoading(false);
      },
    );
  }, [subscribe]);

  return { player, loading, error };
}

export function usePlayerHeartbeat(
  roomId: string,
  playerId: string | undefined,
  enabled: boolean,
): { readonly error: Error | null } {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !playerId) {
      setError(null);
      return undefined;
    }

    let active = true;
    const tick = async (): Promise<void> => {
      try {
        await touchPlayer(roomId, playerId);
        if (active) setError(null);
      } catch (value: unknown) {
        const nextError = value instanceof Error ? value : new Error("Heartbeat failed");
        console.error(nextError);
        if (active) setError(nextError);
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), appConfig.playerHeartbeatMs);
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [roomId, playerId, enabled]);

  return { error };
}
