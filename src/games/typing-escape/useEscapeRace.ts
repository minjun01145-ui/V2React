import { useEffect, useRef, useState } from "react";
import { createLiveMovementEngine, createLiveMovementObserver, createLiveRecords, observeLiveRecords, subscribeLiveServerTimeOffset, type LiveRecord } from "../../live-world/client.ts";
import type { LiveMovementEngine } from "../../live-world/LiveMovementEngine.ts";
import type { LiveRemoteFrame } from "../../live-world/core/types.ts";
import { FINISH, advanceEscape, escapeScore, exposeEscape, hiddenAt, initialProgress, inputEscape, parseProgress, type EscapeProgress } from "./model.ts";

export function useEscapeRace(roomId: string, roundId: string, playerId: string | null, label: string,
  start: number | null, end: number | null, targets: readonly string[]) {
  const storageKey = `v2r:typing-escape:v2:${roomId}:${roundId}:${playerId}`;
  const [progress, setProgress] = useState(() => {
    try { return parseProgress(JSON.parse(sessionStorage.getItem(storageKey) ?? "null")); }
    catch { return initialProgress(); }
  });
  const current = useRef(progress);
  const offset = useRef(0);
  const engine = useRef<LiveMovementEngine | null>(null);
  const [now, setNow] = useState(Date.now());
  const [frames, setFrames] = useState<readonly LiveRemoteFrame[]>([]);
  const [records, setRecords] = useState<readonly LiveRecord[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState(false);
  const commit = (next: EscapeProgress) => {
    if (next === current.current) return;
    current.current = next;
    setProgress(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Optional local recovery. */ }
  };
  const callbacks = useRef({ start, end, commit });
  callbacks.current = { start, end, commit };
  useEffect(() => {
    let disposed = false;
    const fail = (reason: Error) => { if (!disposed) setError(reason); };
    const scope = { roomId, roundId, channelId: "typing-escape" };
    const options = { interpolationDelayMs: 0, maxExtrapolationMs: 0, onError: fail };
    const movement = playerId ? createLiveMovementEngine(playerId, { ...options, sendHz: 15 }) : null;
    const observer = playerId ? null : createLiveMovementObserver(options);
    engine.current = movement;
    const state = () => {
      const time = Date.now() + offset.current;
      const progress = current.current;
      return { x: progress.escapes, y: progress.distance, vx: progress.hits,
        vy: time < progress.stunnedUntil ? -1 : progress.distance >= FINISH ? 2 : hiddenAt(progress, time) ? 0 : 1 };
    };
    const opening = movement ? movement.connect(scope, state()) : observer!.connect(scope);
    void opening.then(() => { if (!disposed) setConnected(true); }).catch(fail);
    const timeOff = subscribeLiveServerTimeOffset(value => { offset.current = value; }, fail);
    const liveRecords = playerId ? createLiveRecords(scope, playerId, 100, setRecords, () => {}, fail) : null;
    const recordsOff = playerId ? null : observeLiveRecords(scope, 100, setRecords, fail);
    let savedBest = -1;
    const timer = window.setInterval(() => {
      const clock = Date.now() + offset.current;
      const { start: currentStart, end: currentEnd, commit: save } = callbacks.current;
      const simulationTime = currentEnd === null ? clock : Math.min(clock, currentEnd);
      if (playerId) {
        save(advanceEscape(current.current, currentStart, simulationTime));
        movement?.updateLocal(state());
        if (liveRecords && escapeScore(current.current) > savedBest) {
          savedBest = escapeScore(current.current);
          liveRecords.submit(savedBest, label);
        }
      }
      setNow(clock);
      setFrames(movement?.sampleRemotePlayers() ?? observer?.samplePlayers() ?? []);
    }, 50);
    return () => {
      disposed = true; window.clearInterval(timer); timeOff(); recordsOff?.(); liveRecords?.close();
      engine.current = null;
      void movement?.close().catch(() => {}); void observer?.close().catch(() => {});
    };
  }, [roomId, roundId, playerId, label]);
  const input = (value: string, composing = false) => {
    const clock = Date.now() + offset.current;
    if (!connected || error || (end !== null && clock >= end)) return;
    commit(inputEscape(current.current, targets[current.current.question % targets.length] ?? "", value, start, clock, composing));
  };
  const activity = () => {
    const clock = Date.now() + offset.current;
    if (!connected || error || (end !== null && clock >= end)) return;
    commit(exposeEscape(current.current, start, clock));
  };
  return { progress, input, activity, now, frames, records, error, connected };
}
