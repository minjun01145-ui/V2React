import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import { createLiveMovementEngine, createLiveMovementObserver } from "../../live-world/client.ts";
import { MEANING_DASH_CHANNEL_ID } from "./model.ts";

export function useMeaningDashPlayerLiveWorld(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly playerId: string;
  readonly initialState: LiveMovementState;
  readonly enabled: boolean;
}) {
  const { roomId, roundId, playerId, initialState, enabled } = input;
  const engineRef = useRef<ReturnType<typeof createLiveMovementEngine> | null>(null);
  const [frames, setFrames] = useState<readonly LiveRemoteFrame[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const engine = createLiveMovementEngine(playerId, { onError: setError, sendHz: 10 });
    engineRef.current = engine;
    let active = true;
    void engine.connect({ roomId, roundId, channelId: MEANING_DASH_CHANNEL_ID }, initialState)
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason : new Error("실시간 이동 연결에 실패했습니다."));
      });
    return () => {
      active = false;
      if (engineRef.current === engine) engineRef.current = null;
      void engine.close();
    };
  }, [enabled, playerId, roomId, roundId]);

  useEffect(() => {
    if (!enabled) {
      setFrames([]);
      return undefined;
    }
    let frame = 0;
    const sample = (): void => {
      const engine = engineRef.current;
      if (engine) setFrames(engine.sampleRemotePlayers());
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  const publish = useCallback((state: LiveMovementState): void => {
    engineRef.current?.updateLocal(state);
  }, []);

  return { frames, error, publish };
}

export function useMeaningDashObserverLiveWorld(roomId: string, roundId: string) {
  const observerRef = useRef<ReturnType<typeof createLiveMovementObserver> | null>(null);
  const [frames, setFrames] = useState<readonly LiveRemoteFrame[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const observer = createLiveMovementObserver({ onError: setError });
    observerRef.current = observer;
    let active = true;
    void observer.connect({ roomId, roundId, channelId: MEANING_DASH_CHANNEL_ID })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason : new Error("실시간 중계 연결에 실패했습니다."));
      });
    return () => {
      active = false;
      if (observerRef.current === observer) observerRef.current = null;
      void observer.close();
    };
  }, [roomId, roundId]);

  useEffect(() => {
    let frame = 0;
    const sample = (): void => {
      const observer = observerRef.current;
      if (observer) setFrames(observer.samplePlayers());
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frame);
  }, []);

  return { frames, error };
}
