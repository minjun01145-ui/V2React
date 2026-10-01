import {
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
  runTransaction,
  serverTimestamp,
  type DataSnapshot,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { TenantId } from "../tenant/scope.ts";
import type { LiveWorldScope } from "./core/types.ts";
import { liveChannelPath, livePathSegment } from "./paths.ts";

/**
 * All-time best score per player in a channel (e.g. highest floor reached).
 * Each player owns one record and the rules only accept a higher score, so the
 * board can only go up and nobody can lower or overwrite someone else's best.
 */
export interface LiveRecord {
  readonly playerId: string;
  readonly score: number;
  readonly label: string;
}

export interface LiveRecords {
  /** Saves `score` if it beats this player's stored best. */
  submit(score: number, label: string): void;
  close(): void;
}

const MAX_LABEL = 40;

function parseRecord(snapshot: DataSnapshot): LiveRecord | null {
  const playerId = snapshot.key;
  const raw: unknown = snapshot.val();
  if (!playerId || typeof raw !== "object" || raw === null) return null;
  const { s, l } = raw as Record<string, unknown>;
  return typeof s === "number" && Number.isSafeInteger(s) && s >= 0 && typeof l === "string"
    ? { playerId, score: s, label: l.slice(0, MAX_LABEL) }
    : null;
}

export function connectLiveRecords(
  database: Database,
  tenantId: TenantId,
  scope: LiveWorldScope,
  playerId: string,
  topCount: number,
  onTop: (records: readonly LiveRecord[]) => void,
  onOwnBest: (score: number) => void,
  onError: (error: Error) => void,
): LiveRecords {
  const recordsPath = `${liveChannelPath(tenantId, scope)}/records`;
  const ownRef = ref(database, `${recordsPath}/${livePathSegment(playerId, "playerId")}`);
  let ownBest = 0;
  let closed = false;
  const fail = (error: Error): void => { if (!closed) onError(error); };

  const subscriptions: Unsubscribe[] = [
    onValue(query(ref(database, recordsPath), orderByChild("s"), limitToLast(topCount)), (snapshot) => {
      const records: LiveRecord[] = [];
      snapshot.forEach((child) => {
        const record = parseRecord(child);
        if (record) records.push(record);
      });
      records.sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "ko-KR"));
      if (!closed) onTop(records);
    }, fail),
    onValue(ownRef, (snapshot) => {
      ownBest = parseRecord(snapshot)?.score ?? 0;
      if (!closed) onOwnBest(ownBest);
    }, fail),
  ];

  return {
    submit(score: number, label: string): void {
      if (closed || !Number.isSafeInteger(score) || score <= ownBest) return;
      ownBest = score;
      void runTransaction(ownRef, (current: unknown) => {
        const stored = typeof current === "object" && current !== null ? (current as Record<string, unknown>).s : null;
        if (typeof stored === "number" && stored >= score) return undefined;
        return { s: score, l: label.trim().slice(0, MAX_LABEL) || "학생", t: serverTimestamp() };
      }, { applyLocally: false }).catch((reason: unknown) => {
        fail(reason instanceof Error ? reason : new Error("Record save failed."));
      });
    },
    close(): void {
      closed = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
    },
  };
}
