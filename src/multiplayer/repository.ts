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
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { appConfig } from "../config/appConfig.ts";
import { db } from "../firebase/firebaseClient.ts";
import { canStartSession, MULTIPLAYER_COLLECTION, ROUND_START_COUNTDOWN_MS, SESSION_STATUS, type SessionStatus } from "./constants.ts";
import { deduplicatePlayers, selectActivePlayers } from "./presence.ts";
import { participantIdentity, parseRoundParticipant } from "./round-participants/model.ts";
import { roundParticipantRef } from "./round-participants/repository.ts";
import { resolveSessionStartedAtMs, type GameSession, type JoinSessionInput, type Player, type PlayerAvatar, type StartSessionOptions } from "./types.ts";

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
  if (value === SESSION_STATUS.PREPARING || value === SESSION_STATUS.PLAYING || value === SESSION_STATUS.FINISHED) return value;
  return SESSION_STATUS.WAITING;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function parseGameConfig(value: unknown): Readonly<Record<string, unknown>> | null {
  return isRecord(value) ? value : null;
}

function parsePlayerAvatar(value: unknown): PlayerAvatar | null {
  if (!isRecord(value)) return null;
  if (value.kind === "character" && typeof value.characterId === "string" && value.characterId) {
    return { kind: "character", characterId: value.characterId };
  }
  if (value.kind === "pokemon"
    && typeof value.captureId === "string"
    && typeof value.name === "string"
    && typeof value.spriteUrl === "string") {
    return {
      kind: "pokemon",
      captureId: value.captureId,
      name: value.name,
      spriteUrl: value.spriteUrl,
      fallbackSpriteUrl: typeof value.fallbackSpriteUrl === "string" ? value.fallbackSpriteUrl : null,
    };
  }
  return null;
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
    waitingTypingConfig: parseGameConfig(data.waitingTypingConfig),
    createdAtMs: numberOrNull(data.createdAtMs),
    updatedAtMs: numberOrNull(data.updatedAtMs),
    startedAtMs: resolveSessionStartedAtMs(data.startedAt, data.startedAtMs, data.startDelayMs),
    expectedPlayerIds: stringArray(data.expectedPlayerIds),
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
    avatar: parsePlayerAvatar(data.avatar),
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
    expectedPlayerIds: [],
  });
}

export function subscribeSession(roomId: string, onValue: (value: GameSession | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(sessionRef(roomId), (snapshot) => onValue(parseSession(snapshot)), onError);
}

export function subscribeSessionField<T>(
  roomId: string,
  fieldName: string,
  parseField: (value: unknown) => T,
  onValue: (value: { readonly session: GameSession; readonly field: T } | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(sessionRef(roomId), (snapshot) => {
    const session = parseSession(snapshot);
    if (!session) {
      onValue(null);
      return;
    }
    const data: unknown = snapshot.data();
    if (!isRecord(data)) {
      onValue(null);
      return;
    }
    onValue({ session, field: parseField(data[fieldName]) });
  }, onError);
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
    const snapshotData: unknown = sessionSnapshot.exists() ? sessionSnapshot.data() : null;
    const sessionStatus = isRecord(snapshotData) ? parseStatus(snapshotData.status) : null;
    const roundId = isRecord(snapshotData) && typeof snapshotData.roundId === "string" ? snapshotData.roundId : null;
    if (sessionStatus !== SESSION_STATUS.WAITING && sessionStatus !== SESSION_STATUS.PREPARING && sessionStatus !== SESSION_STATUS.PLAYING) {
      throw new Error("참여할 수 있는 수업 세션이 없습니다.");
    }
    const current = await tx.get(pRef);
    const currentData: unknown = current.exists() ? current.data() : null;
    const participantRef = sessionStatus === SESSION_STATUS.PLAYING && roundId
      ? roundParticipantRef(roomId, roundId, playerId)
      : null;
    const participantSnapshot = participantRef ? await tx.get(participantRef) : null;
    const participantData: unknown = participantSnapshot?.exists() ? participantSnapshot.data() : null;
    const participant = participantSnapshot?.exists()
      ? parseRoundParticipant(participantSnapshot.id, participantData)
      : null;
    const currentJoinedAt = isRecord(currentData) ? currentData.joinedAt : undefined;
    const currentJoinedAtMs = isRecord(currentData) ? numberOrNull(currentData.joinedAtMs) : null;
    const currentNickname = isRecord(currentData) && typeof currentData.nickname === "string" ? currentData.nickname.trim() : "";
    const resolvedNickname = nickname?.trim() || participant?.nickname || currentNickname || null;
    tx.set(pRef, {
      playerId,
      studentNumber,
      displayName,
      nickname: resolvedNickname,
      state: sessionStatus,
      joinedAt: currentJoinedAt ?? serverTimestamp(),
      joinedAtMs: currentJoinedAtMs ?? now,
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: now,
    }, { merge: true });
    if (participantRef) {
      tx.set(participantRef, {
        playerId,
        studentNumber,
        displayName,
        nickname: resolvedNickname,
        joinedAt: isRecord(participantData) && participantData.joinedAt !== undefined
          ? participantData.joinedAt
          : serverTimestamp(),
        joinedAtMs: participant?.joinedAtMs || now,
      }, { merge: true });
    }
  });
}

export async function touchPlayer(roomId: string, playerId: string): Promise<void> {
  await updateDoc(playerRef(roomId, playerId), {
    lastSeenAt: serverTimestamp(),
    lastSeenAtMs: Date.now(),
  });
}

export async function leaveSession(roomId: string, playerId: string): Promise<void> {
  await deleteDoc(playerRef(roomId, playerId));
}

export async function loadPlayers(roomId: string): Promise<Player[]> {
  const snapshot = await getDocs(playersRef(roomId));
  return deduplicatePlayers(snapshot.docs.map(parsePlayer).filter((player): player is Player => player !== null));
}

export async function startSession(roomId: string, options: StartSessionOptions = {}): Promise<void> {
  await ensureSession(roomId);
  const now = Date.now();
  const playerSnapshot = await getDocs(playersRef(roomId));
  const activePlayers = selectActivePlayers(
    playerSnapshot.docs.map(parsePlayer).filter((player): player is Player => player !== null),
    now,
    appConfig.playerStaleAfterMs,
  );
  const roundId = crypto.randomUUID();
  const nextSession: Record<string, unknown> = {
    gameId: options.gameId ?? appConfig.defaultGameId,
    status: SESSION_STATUS.PREPARING,
    roundId,
    expectedPlayerIds: activePlayers.map((player) => player.id),
    startedAt: deleteField(),
    startedAtMs: deleteField(),
    startDelayMs: deleteField(),
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  };
  if (options.gameConfig !== undefined) nextSession.gameConfig = options.gameConfig;
  await runTransaction(db, async (tx) => {
    const currentSession = await tx.get(sessionRef(roomId));
    const currentData: unknown = currentSession.exists() ? currentSession.data() : null;
    if (!isRecord(currentData) || !canStartSession(parseStatus(currentData.status))) return;

    tx.set(sessionRef(roomId), nextSession, { merge: true });
    for (const player of activePlayers) {
      tx.set(roundParticipantRef(roomId, roundId, player.id), {
        ...participantIdentity(player),
        joinedAt: serverTimestamp(),
        joinedAtMs: now,
      });
    }
  });
}

export async function updatePlayerAvatar(roomId: string, playerId: string, avatar: PlayerAvatar | null): Promise<void> {
  await updateDoc(playerRef(roomId, playerId), {
    avatar: avatar ?? deleteField(),
  });
}

export async function confirmRoundReady(roomId: string, roundId: string, playerId: string): Promise<void> {
  await setDoc(doc(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "readiness", playerId), {
    playerId,
    readyAt: serverTimestamp(),
    readyAtMs: Date.now(),
  });
}

export async function finalizeSessionStart(roomId: string, roundId: string): Promise<void> {
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const ref = sessionRef(roomId);
    const snapshot = await tx.get(ref);
    const data: unknown = snapshot.exists() ? snapshot.data() : null;
    if (!isRecord(data) || parseStatus(data.status) !== SESSION_STATUS.PREPARING || data.roundId !== roundId) return;
    tx.set(ref, {
      status: SESSION_STATUS.PLAYING,
      startedAt: serverTimestamp(),
      startedAtMs: now + ROUND_START_COUNTDOWN_MS,
      startDelayMs: ROUND_START_COUNTDOWN_MS,
      updatedAt: serverTimestamp(),
      updatedAtMs: now,
    }, { merge: true });
  });
}

export async function resetSession(roomId: string): Promise<void> {
  await ensureSession(roomId);
  await setDoc(sessionRef(roomId), {
    status: SESSION_STATUS.WAITING,
    roundId: null,
    startedAt: deleteField(),
    startedAtMs: deleteField(),
    startDelayMs: deleteField(),
    expectedPlayerIds: [],
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  }, { merge: true });
}

export async function updateWaitingTypingConfig(
  roomId: string,
  config: Readonly<Record<string, unknown>> | null,
): Promise<void> {
  await ensureSession(roomId);
  await updateDoc(sessionRef(roomId), {
    waitingTypingConfig: config ?? deleteField(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}
