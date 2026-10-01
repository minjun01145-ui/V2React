import {
  onChildAdded,
  onChildChanged,
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
import type { TenantId } from "../tenant/scope.ts";
import type { LiveWorldScope } from "./core/types.ts";
import { liveChannelPath, livePathSegment } from "./paths.ts";

/**
 * Short-lived player actions (e.g. a punch) broadcast to everyone in a channel.
 * Each player owns one slot holding their latest event, so the database never
 * grows; listeners see every overwrite as a new event.
 */
export interface LiveEvent {
  readonly playerId: string;
  readonly sequence: number;
  readonly kind: string;
  readonly target: string;
  readonly value: number;
}

export interface LiveEventChannel {
  publish(kind: string, target: string, value: number): void;
  close(): Promise<void>;
}

/** Events older than this when first seen are leftovers from before we joined. */
const STALE_EVENT_MS = 2_000;
const KIND_PATTERN = /^[a-z-]{1,16}$/;

function parseEvent(snapshot: DataSnapshot, serverNowMs: number): LiveEvent | null {
  const playerId = snapshot.key;
  const raw: unknown = snapshot.val();
  if (!playerId || typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const { k, g, v, q, t } = value;
  if (typeof k !== "string" || !KIND_PATTERN.test(k) || typeof g !== "string" || g.length > 128) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || typeof q !== "number" || !Number.isSafeInteger(q)) return null;
  if (typeof t !== "number" || serverNowMs - t > STALE_EVENT_MS) return null;
  return { playerId, sequence: q, kind: k, target: g, value: v };
}

/**
 * Connects to a channel's event slots. Pass `playerId: null` to only listen
 * (teacher view). Own events are not echoed back.
 */
export function connectLiveEvents(
  database: Database,
  tenantId: TenantId,
  scope: LiveWorldScope,
  playerId: string | null,
  onEvent: (event: LiveEvent) => void,
  onError: (error: Error) => void,
): LiveEventChannel {
  const eventsPath = `${liveChannelPath(tenantId, scope)}/events`;
  const eventsRef = ref(database, eventsPath);
  const ownRef = playerId ? ref(database, `${eventsPath}/${livePathSegment(playerId, "playerId")}`) : null;
  let serverOffsetMs = 0;
  // Clock-based start so a reloaded page never reuses sequence numbers others already saw.
  let sequence = Date.now() * 1_000;
  let closed = false;
  const lastSequence = new Map<string, number>();

  const receive = (snapshot: DataSnapshot): void => {
    if (closed || snapshot.key === playerId) return;
    const event = parseEvent(snapshot, Date.now() + serverOffsetMs);
    if (!event || (lastSequence.get(event.playerId) ?? -1) >= event.sequence) return;
    lastSequence.set(event.playerId, event.sequence);
    onEvent(event);
  };
  const fail = (error: Error): void => { if (!closed) onError(error); };
  const subscriptions: Unsubscribe[] = [
    onValue(ref(database, ".info/serverTimeOffset"), (snapshot) => {
      const value: unknown = snapshot.val();
      serverOffsetMs = typeof value === "number" && Number.isFinite(value) ? value : 0;
    }, fail),
    onChildAdded(eventsRef, receive, fail),
    onChildChanged(eventsRef, receive, fail),
  ];
  if (ownRef) void onDisconnect(ownRef).remove().catch(fail);

  return {
    publish(kind: string, target: string, value: number): void {
      if (closed || !ownRef || !KIND_PATTERN.test(kind)) return;
      sequence += 1;
      void set(ownRef, { k: kind, g: target, v: value, q: sequence, t: serverTimestamp() })
        .catch((reason: unknown) => fail(reason instanceof Error ? reason : new Error("Live event publish failed.")));
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      if (ownRef) {
        await onDisconnect(ownRef).cancel().catch(() => undefined);
        await remove(ownRef).catch(() => undefined);
      }
    },
  };
}
