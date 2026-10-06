import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import {
  createLiveEventChannel,
  createLiveMovementEngine,
  createLiveMovementObserver,
  type LiveEvent,
} from "../../live-world/client.ts";
import { SKATING_CHANNEL_ID } from "./model.ts";

/**
 * Skaters share positions (x = distance, y = side, vx = forward speed) and
 * short events (punches, crashes). Frames are sampled by the scene every
 * animation frame instead of being pushed through React state.
 */
export interface SkatingLiveWorld {
  readonly error: Error | null;
  sample(): readonly LiveRemoteFrame[];
  publish(state: LiveMovementState): void;
  publishEvent(kind: string, target: string, value: number): void;
}

export function useSkatingLiveWorld(input: {
  readonly roomId: string;
  readonly roundId: string;
  /** Null for the teacher's read-only view. */
  readonly playerId: string | null;
  /** Where the local skater starts; ignored for the teacher. */
  readonly initialState?: LiveMovementState;
  readonly onEvent: (event: LiveEvent) => void;
}): SkatingLiveWorld {
  const { roomId, roundId, playerId } = input;
  const onEventRef = useRef(input.onEvent);
  onEventRef.current = input.onEvent;
  const initialStateRef = useRef(input.initialState);
  initialStateRef.current = input.initialState;
  const sampleRef = useRef<() => readonly LiveRemoteFrame[]>(() => []);
  const publishRef = useRef<(state: LiveMovementState) => void>(() => undefined);
  const publishEventRef = useRef<(kind: string, target: string, value: number) => void>(() => undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const fail = (reason: unknown, fallback: string): void => {
      if (active) setError(reason instanceof Error ? reason : new Error(fallback));
    };
    const scope = { roomId, roundId, channelId: SKATING_CHANNEL_ID };
    const events = createLiveEventChannel(scope, playerId, (event) => onEventRef.current(event), (reason) => fail(reason, "실시간 이벤트 연결에 실패했습니다."));
    publishEventRef.current = (kind, target, value) => events.publish(kind, target, value);
    let close: () => Promise<void>;
    if (playerId) {
      const engine = createLiveMovementEngine(playerId, { onError: setError, sendHz: 10 });
      sampleRef.current = () => engine.sampleRemotePlayers();
      publishRef.current = (state) => engine.updateLocal(state);
      void engine.connect(scope, initialStateRef.current ?? { x: 0, y: 0, vx: 0, vy: 0 })
        .catch((reason: unknown) => fail(reason, "실시간 이동 연결에 실패했습니다."));
      close = () => engine.close();
    } else {
      const observer = createLiveMovementObserver({ onError: setError });
      sampleRef.current = () => observer.samplePlayers();
      void observer.connect(scope).catch((reason: unknown) => fail(reason, "실시간 중계 연결에 실패했습니다."));
      close = () => observer.close();
    }
    return () => {
      active = false;
      sampleRef.current = () => [];
      publishRef.current = () => undefined;
      publishEventRef.current = () => undefined;
      void close();
      void events.close();
    };
  }, [playerId, roomId, roundId]);

  const sample = useCallback(() => sampleRef.current(), []);
  const publish = useCallback((state: LiveMovementState) => publishRef.current(state), []);
  const publishEvent = useCallback((kind: string, target: string, value: number) => publishEventRef.current(kind, target, value), []);
  return useMemo(() => ({ error, sample, publish, publishEvent }), [error, sample, publish, publishEvent]);
}
