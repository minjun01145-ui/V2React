import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import type { Player } from "../types.ts";
import { LIVE_METRIC_KIND, type RoundLiveMetricRecord, type TypingLiveMetricValues } from "./types.ts";

const liveMetricsRef = (roomId: string, roundId: string) => collection(
  db,
  MULTIPLAYER_COLLECTION,
  roomId,
  "rounds",
  roundId,
  "liveMetrics",
);

function finiteNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function timestampMilliseconds(value: unknown): number {
  if (typeof value !== "object" || value === null || !("toMillis" in value)) return 0;
  const toMillis = (value as { readonly toMillis?: unknown }).toMillis;
  if (typeof toMillis !== "function") return 0;
  try {
    const result = toMillis.call(value);
    return typeof result === "number" && Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

function parseLiveMetric(id: string, data: DocumentData): RoundLiveMetricRecord | null {
  const raw: unknown = data;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.kind !== LIVE_METRIC_KIND.TYPING_CPM
    || typeof record.playerId !== "string"
    || !record.playerId
    || typeof record.gameId !== "string") return null;
  return {
    id,
    kind: LIVE_METRIC_KIND.TYPING_CPM,
    gameId: record.gameId,
    playerId: record.playerId,
    displayName: typeof record.displayName === "string" ? record.displayName : "",
    currentCpm: finiteNonNegativeInteger(record.currentCpm),
    averageCpm: finiteNonNegativeInteger(record.averageCpm),
    bestCpm: finiteNonNegativeInteger(record.bestCpm),
    totalValidStrokes: finiteNonNegativeInteger(record.totalValidStrokes),
    sampledAtMs: finiteNonNegativeInteger(record.sampledAtMs),
    committedAtMs: timestampMilliseconds(record.committedAt),
  };
}

export async function publishTypingLiveMetric(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly gameId: string;
  readonly player: Player;
  readonly values: TypingLiveMetricValues;
}): Promise<void> {
  const { roomId, roundId, gameId, player, values } = input;
  await setDoc(doc(liveMetricsRef(roomId, roundId), player.id), {
    kind: LIVE_METRIC_KIND.TYPING_CPM,
    gameId,
    playerId: player.id,
    displayName: player.displayName,
    currentCpm: finiteNonNegativeInteger(values.currentCpm),
    averageCpm: finiteNonNegativeInteger(values.averageCpm),
    bestCpm: finiteNonNegativeInteger(values.bestCpm),
    totalValidStrokes: finiteNonNegativeInteger(values.totalValidStrokes),
    sampledAtMs: Date.now(),
    committedAt: serverTimestamp(),
  });
}

export function subscribeRoundLiveMetrics(
  roomId: string,
  roundId: string,
  onValue: (value: RoundLiveMetricRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(liveMetricsRef(roomId, roundId), (snapshot) => {
    onValue(snapshot.docs.map((metricDoc) => parseLiveMetric(metricDoc.id, metricDoc.data()))
      .filter((metric): metric is RoundLiveMetricRecord => metric !== null));
  }, onError);
}
