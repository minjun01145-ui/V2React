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
import { subscribeRoundParticipant, subscribeRoundParticipants } from "./round-participants/repository.ts";
import type { RoundParticipant } from "./round-participants/model.ts";
import { subscribeRoundReadiness } from "./round-readiness/repository.ts";
import type { RoundReadiness } from "./round-readiness/model.ts";
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

type RoomSubscribeFunction<T> = (
  roomId: string,
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

function useScopedSubscription<T>(
  subscribe: SubscribeFunction<T> | null,
  subscriptionKey: string | null,
  initialValue: T,
): SubscriptionResult<T> {
  const [result, setResult] = useState<SubscriptionResult<T> & { readonly key: string | null }>(() => ({
    key: null,
    value: initialValue,
    loading: Boolean(subscriptionKey),
    error: null,
  }));

  useEffect(() => {
    if (!subscribe || !subscriptionKey) {
      setResult({ key: null, value: initialValue, loading: false, error: null });
      return undefined;
    }
    let active = true;
    setResult({ key: subscriptionKey, value: initialValue, loading: true, error: null });
    const unsubscribe = subscribe(
      (value) => {
        if (active) setResult({ key: subscriptionKey, value, loading: false, error: null });
      },
      (error) => {
        console.error(error);
        if (active) setResult({ key: subscriptionKey, value: initialValue, loading: false, error });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [subscribe, subscriptionKey]);

  return result.key === subscriptionKey
    ? result
    : { value: initialValue, loading: Boolean(subscriptionKey), error: null };
}

function subscriptionKey(...parts: readonly string[]): string {
  return JSON.stringify(parts);
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

export function useSessionSubscription<T>(
  roomId: string,
  subscribeSessionValue: RoomSubscribeFunction<T | null>,
  options: { readonly ensure?: boolean } = {},
): SubscriptionResult<T | null> {
  const subscribe = useMemo<SubscribeFunction<T | null>>(
    () => (onValue, onError) => subscribeSessionValue(roomId, onValue, onError),
    [roomId, subscribeSessionValue],
  );
  useEffect(() => {
    if (options.ensure) void ensureSession(roomId).catch(console.error);
  }, [options.ensure, roomId]);
  return useSubscription(subscribe, null);
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
    const refreshNow = (): void => setNow(Date.now());
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "visible") refreshNow();
    };
    const timer = window.setInterval(refreshNow, 5_000);
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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

export function useRoundReadiness(roomId: string, roundId: string | undefined): SubscriptionResult<RoundReadiness[]> {
  const scope = roundId ? subscriptionKey(roomId, roundId, "readiness") : null;
  const subscribe = useMemo<SubscribeFunction<RoundReadiness[]> | null>(
    () => roundId
      ? (onValue, onError) => subscribeRoundReadiness(roomId, roundId, onValue, onError)
      : null,
    [roomId, roundId],
  );
  return useScopedSubscription(subscribe, scope, []);
}

export function useRoundParticipant(
  roomId: string,
  roundId: string | undefined,
  playerId: string | undefined,
): SubscriptionResult<RoundParticipant | null> {
  const scope = roundId && playerId ? subscriptionKey(roomId, roundId, playerId) : null;
  const subscribe = useMemo<SubscribeFunction<RoundParticipant | null> | null>(
    () => roundId && playerId
      ? (onValue, onError) => subscribeRoundParticipant(roomId, roundId, playerId, onValue, onError)
      : null,
    [playerId, roomId, roundId],
  );
  return useScopedSubscription(subscribe, scope, null);
}

export function usePlayer(roomId: string, playerId?: string): {
  readonly player: Player | null;
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const scope = playerId ? subscriptionKey(roomId, playerId) : null;
  const subscribe = useMemo<SubscribeFunction<Player | null> | null>(
    () => playerId ? (onValue, onError) => subscribePlayer(roomId, playerId, onValue, onError) : null,
    [roomId, playerId],
  );
  const result = useScopedSubscription(subscribe, scope, null);
  return { player: result.value, loading: result.loading, error: result.error };
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
    const onFocus = (): void => { void tick(); };
    const onOnline = (): void => { void tick(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [roomId, playerId, enabled]);

  return { error };
}
