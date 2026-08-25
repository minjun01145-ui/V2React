import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { appConfig } from "../config/appConfig.ts";
import { db } from "../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION, SESSION_STATUS, type SessionStatus } from "./constants.ts";
import { deduplicatePlayers, selectActivePlayers } from "./presence.ts";
import type { GameSession, JoinSessionInput, Player, StartSessionOptions } from "./types.ts";

const sessionRef = (roomId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId);
const playersRef = (roomId: string) => collection(db, MULTIPLAYER_COLLECTION, roomId, "players");
const playerRef = (roomId: string, playerId: string) => doc(db, MULTIPLAYER_COLLECTION, roomId, "players", playerId);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return numberOrNull(value) ?? fallback;
}

function parseStatus(value: unknown): SessionStatus {
  if (value === SESSION_STATUS.PLAYING || value === SESSION_STATUS.FINISHED) return value;
  return SESSION_STATUS.WAITING;
}

function parseGameConfig(value: unknown): Readonly<Record<string, unknown>> | null {
  return isRecord(value) ? value : null;
}

function parseSession(snapshot: DocumentSnapshot<DocumentData>): GameSession | null {
  if (!snapshot.exists()) return null;
  const data: unknown = snapshot.data();
  if (!isRecord(data)) return null;
  return {
    id: snapshot.id,
    roomId: stringValue(data.roomId, snapshot.id),
    gameId: stringValue(data.gameId, appConfig.defaultGameId),
    status: parseStatus(data.status),
    roundId: typeof data.roundId === "string" && data.roundId ? data.roundId : null,
    gameConfig: parseGameConfig(data.gameConfig),
    createdAtMs: numberOrNull(data.createdAtMs),
    updatedAtMs: numberOrNull(data.updatedAtMs),
    startedAtMs: numberOrNull(data.startedAtMs),
  };
}

function parsePlayer(snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): Player | null {
  if (!snapshot.exists()) return null;
  const data: unknown = snapshot.data();
  if (!isRecord(data)) return null;
  const displayName = stringValue(data.displayName).trim();
  const studentNumber = stringValue(data.studentNumber).trim();
  if (!displayName || !studentNumber) return null;
  const rawNickname = typeof data.nickname === "string" ? data.nickname.trim() : "";
  return {
    id: snapshot.id,
    playerId: stringValue(data.playerId, snapshot.id),
    studentNumber,
    displayName,
    nickname: rawNickname ? rawNickname : null,
    state: parseStatus(data.state),
    joinedAtMs: numberValue(data.joinedAtMs),
    lastSeenAtMs: numberValue(data.lastSeenAtMs),
  };
}

export async function ensureSession(roomId: string): Promise<void> {
  const ref = sessionRef(roomId);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;
  const now = Date.now();
  await setDoc(ref, {
    roomId,
    gameId: appConfig.defaultGameId,
    status: SESSION_STATUS.WAITING,
    roundId: null,
    createdAt: serverTimestamp(),
    createdAtMs: now,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  });
}

export function subscribeSession(roomId: string, onValue: (value: GameSession | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(sessionRef(roomId), (snapshot) => onValue(parseSession(snapshot)), onError);
}

export function subscribePlayers(roomId: string, onValue: (value: Player[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(playersRef(roomId), (snapshot) => {
    const players = deduplicatePlayers(snapshot.docs
      .map((playerDoc) => parsePlayer(playerDoc))
      .filter((player): player is Player => player !== null));
    onValue(players);
  }, onError);
}

export function subscribePlayer(roomId: string, playerId: string, onValue: (value: Player | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(playerRef(roomId, playerId), (snapshot) => onValue(parsePlayer(snapshot)), onError);
}

export async function joinSession({ roomId, playerId, studentNumber, displayName, nickname }: JoinSessionInput): Promise<void> {
  const now = Date.now();
  const sRef = sessionRef(roomId);
  const pRef = playerRef(roomId, playerId);
  await runTransaction(db, async (tx) => {
    const sessionSnapshot = await tx.get(sRef);
    const sessionData: unknown = sessionSnapshot.exists() ? sessionSnapshot.data() : null;
    const sessionStatus = isRecord(sessionData) ? parseStatus(sessionData.status) : null;
    if (sessionStatus !== SESSION_STATUS.WAITING && sessionStatus !== SESSION_STATUS.PLAYING) {
      throw new Error("참여할 수 있는 수업 세션이 없습니다.");
    }
    const current = await tx.get(pRef);
    const currentData: unknown = current.exists() ? current.data() : null;
    const currentJoinedAt = isRecord(currentData) ? currentData.joinedAt : undefined;
    const currentJoinedAtMs = isRecord(currentData) ? numberOrNull(currentData.joinedAtMs) : null;
    const trimmedNickname = nickname?.trim() || null;
    tx.set(pRef, {
      playerId,
      studentNumber,
      displayName,
      nickname: trimmedNickname,
      state: sessionStatus,
      joinedAt: currentJoinedAt ?? serverTimestamp(),
      joinedAtMs: currentJoinedAtMs ?? now,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: now,
    }, { merge: true });
  });
}

async function prunePlayerPresence(roomId: string, now: number): Promise<void> {
  const snapshot = await getDocs(playersRef(roomId));
  const parsed = snapshot.docs
    .map((playerDoc) => parsePlayer(playerDoc))
    .filter((player): player is Player => player !== null);
  const keepIds = new Set(selectActivePlayers(parsed, now, appConfig.playerStaleAfterMs).map((player) => player.id));
  const removals = snapshot.docs.filter((playerDoc) => !keepIds.has(playerDoc.id));
  for (let offset = 0; offset < removals.length; offset += 400) {
    const batch = writeBatch(db);
    for (const playerDoc of removals.slice(offset, offset + 400)) batch.delete(playerDoc.ref);
    await batch.commit();
  }
}

export async function touchPlayer(roomId: string, playerId: string): Promise<void> {
  await setDoc(playerRef(roomId, playerId), {
    lastSeenAt: serverTimestamp(),
    lastSeenAtMs: Date.now(),
  }, { merge: true });
}

export async function leaveSession(roomId: string, playerId: string): Promise<void> {
  await deleteDoc(playerRef(roomId, playerId));
}

export async function startSession(roomId: string, options: StartSessionOptions = {}): Promise<void> {
  await ensureSession(roomId);
  const now = Date.now();
  await prunePlayerPresence(roomId, now);
  const nextSession: Record<string, unknown> = {
    gameId: options.gameId ?? appConfig.defaultGameId,
    status: SESSION_STATUS.PLAYING,
    roundId: crypto.randomUUID(),
    startedAt: serverTimestamp(),
    startedAtMs: now,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  };
  if (options.gameConfig !== undefined) nextSession.gameConfig = options.gameConfig;
  await setDoc(sessionRef(roomId), nextSession, { merge: true });
}

export async function resetSession(roomId: string): Promise<void> {
  await ensureSession(roomId);
  await setDoc(sessionRef(roomId), {
    status: SESSION_STATUS.WAITING,
    roundId: null,
    startedAt: deleteField(),
    startedAtMs: deleteField(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  }, { merge: true });
}
