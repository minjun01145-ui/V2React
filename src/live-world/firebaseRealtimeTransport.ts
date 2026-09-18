import {
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  type DataSnapshot,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { LiveMovementSnapshot, LiveMovementUpdate, LiveWorldScope } from "./core/types.ts";
import type {
  LiveMovementConnection,
  LiveMovementObserverConnection,
  LiveMovementObserverTransport,
  LiveMovementTransport,
  LiveMovementTransportHandlers,
} from "./transport.ts";

const FORBIDDEN_PATH_CHARACTERS = /[.#$\/[\]]/;

function pathSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || FORBIDDEN_PATH_CHARACTERS.test(normalized)) {
    throw new Error(`Invalid live movement ${label}.`);
  }
  return normalized;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSnapshot(snapshot: DataSnapshot): LiveMovementSnapshot | null {
  const playerId = snapshot.key;
  const value: unknown = snapshot.val();
  if (!playerId || typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const raw = value as Readonly<Record<string, unknown>>;
  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  const vx = finiteNumber(raw.vx);
  const vy = finiteNumber(raw.vy);
  const sentAtMs = finiteNumber(raw.t);
  const sequence = finiteNumber(raw.q);
  if (x === null || y === null || vx === null || vy === null || sentAtMs === null || sequence === null) return null;
  if (!Number.isSafeInteger(sequence) || sequence < 0) return null;

  return {
    playerId,
    sequence,
    sentAtMs,
    state: { x, y, vx, vy },
  };
}

function reportInvalidSnapshot(snapshot: DataSnapshot, handlers: LiveMovementTransportHandlers): void {
  const parsed = parseSnapshot(snapshot);
  if (parsed) handlers.onSnapshot(parsed);
  else handlers.onError?.(new Error("Ignored malformed live movement snapshot."));
}

function livePlayersPath(scope: LiveWorldScope): string {
  const roomId = pathSegment(scope.roomId, "roomId");
  const roundId = pathSegment(scope.roundId, "roundId");
  const channelId = pathSegment(scope.channelId, "channelId");
  return `liveWorld/v1/${roomId}/${roundId}/${channelId}/players`;
}

function subscribePlayers(
  playersRef: ReturnType<typeof ref>,
  handlers: LiveMovementTransportHandlers,
): Unsubscribe[] {
  return [
    onChildAdded(playersRef, (snapshot) => reportInvalidSnapshot(snapshot, handlers)),
    onChildChanged(playersRef, (snapshot) => reportInvalidSnapshot(snapshot, handlers)),
    onChildRemoved(playersRef, (snapshot) => {
      if (snapshot.key) handlers.onLeave(snapshot.key);
    }),
  ];
}

export function createFirebaseRealtimeMovementTransport(database: Database): LiveMovementTransport {
  return {
    async connect(
      scope: LiveWorldScope,
      rawPlayerId: string,
      handlers: LiveMovementTransportHandlers,
    ): Promise<LiveMovementConnection> {
      const playerId = pathSegment(rawPlayerId, "playerId");
      const playersRef = ref(database, livePlayersPath(scope));
      const ownRef = ref(database, `${livePlayersPath(scope)}/${playerId}`);
      const connectedRef = ref(database, ".info/connected");
      let lastUpdate: LiveMovementUpdate | null = null;
      let closed = false;

      const write = async (update: LiveMovementUpdate): Promise<void> => {
        await set(ownRef, {
          x: update.state.x,
          y: update.state.y,
          vx: update.state.vx,
          vy: update.state.vy,
          q: update.sequence,
          t: serverTimestamp(),
        });
      };

      const subscriptions: Unsubscribe[] = [
        ...subscribePlayers(playersRef, handlers),
        onValue(connectedRef, (snapshot) => {
          if (closed || snapshot.val() !== true) return;
          void onDisconnect(ownRef).remove()
            .then(() => lastUpdate ? write(lastUpdate) : undefined)
            .catch((reason: unknown) => {
              handlers.onError?.(reason instanceof Error ? reason : new Error("Live movement reconnect failed."));
            });
        }),
      ];

      return {
        async publish(update: LiveMovementUpdate): Promise<void> {
          if (closed) return;
          lastUpdate = update;
          await write(update);
        },
        async close(): Promise<void> {
          if (closed) return;
          closed = true;
          subscriptions.forEach((unsubscribe) => unsubscribe());
          await onDisconnect(ownRef).cancel().catch(() => undefined);
          await remove(ownRef).catch(() => undefined);
        },
      };
    },
  };
}

export function createFirebaseRealtimeMovementObserverTransport(database: Database): LiveMovementObserverTransport {
  return {
    async subscribe(
      scope: LiveWorldScope,
      handlers: LiveMovementTransportHandlers,
    ): Promise<LiveMovementObserverConnection> {
      const playersRef = ref(database, livePlayersPath(scope));
      const subscriptions = subscribePlayers(playersRef, handlers);
      let closed = false;
      return {
        async close(): Promise<void> {
          if (closed) return;
          closed = true;
          subscriptions.forEach((unsubscribe) => unsubscribe());
        },
      };
    },
  };
}
