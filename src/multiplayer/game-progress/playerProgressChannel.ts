import { reconcileProgressSnapshot } from "./mutation.ts";
import { subscribePlayerProgress } from "./repository.ts";

export interface PlayerProgressSnapshot {
  readonly value: unknown;
  readonly loading: boolean;
  readonly error: Error | null;
}

type Listener = (snapshot: PlayerProgressSnapshot) => void;

interface Channel {
  readonly listeners: Set<Listener>;
  snapshot: PlayerProgressSnapshot;
  unsubscribe: (() => void) | null;
  idleTimer: ReturnType<typeof globalThis.setTimeout> | null;
}

const channels = new Map<string, Channel>();
const IDLE_GRACE_MS = 15_000;

function channelKey(roomId: string, roundId: string, playerId: string): string {
  return JSON.stringify([roomId, roundId, playerId]);
}

function notify(channel: Channel): void {
  for (const listener of channel.listeners) listener(channel.snapshot);
}

function ensureChannel(roomId: string, roundId: string, playerId: string): { readonly key: string; readonly channel: Channel } {
  const key = channelKey(roomId, roundId, playerId);
  const existing = channels.get(key);
  if (existing) return { key, channel: existing };
  const channel: Channel = {
    listeners: new Set(),
    snapshot: { value: null, loading: true, error: null },
    unsubscribe: null,
    idleTimer: null,
  };
  channel.unsubscribe = subscribePlayerProgress(roomId, roundId, playerId, (incoming) => {
    channel.snapshot = {
      value: reconcileProgressSnapshot(channel.snapshot.value, incoming),
      loading: false,
      error: null,
    };
    notify(channel);
  }, (error) => {
    channel.snapshot = { ...channel.snapshot, loading: false, error };
    notify(channel);
  });
  channels.set(key, channel);
  return { key, channel };
}

export function subscribeSharedPlayerProgress(
  roomId: string,
  roundId: string,
  playerId: string,
  listener: Listener,
): () => void {
  const { key, channel } = ensureChannel(roomId, roundId, playerId);
  if (channel.idleTimer !== null) {
    globalThis.clearTimeout(channel.idleTimer);
    channel.idleTimer = null;
  }
  channel.listeners.add(listener);
  listener(channel.snapshot);
  return () => {
    channel.listeners.delete(listener);
    if (channel.listeners.size > 0 || channel.idleTimer !== null) return;
    channel.idleTimer = globalThis.setTimeout(() => {
      if (channel.listeners.size > 0) return;
      channel.unsubscribe?.();
      channels.delete(key);
    }, IDLE_GRACE_MS);
  };
}

export function warmPlayerGameProgress(roomId: string, roundId: string, playerId: string): Promise<() => void> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    let settled = false;
    unsubscribe = subscribeSharedPlayerProgress(roomId, roundId, playerId, (snapshot) => {
      if (snapshot.loading || settled) return;
      settled = true;
      if (snapshot.error) {
        queueMicrotask(() => unsubscribe?.());
        reject(snapshot.error);
      } else {
        resolve(() => unsubscribe?.());
      }
    });
  });
}
