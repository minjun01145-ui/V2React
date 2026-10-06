import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import { resolveSessionStartedAtMs } from "../shared/sessionTime.js";
import { effectiveTenantId, belongsToTenant, type TenantId } from "../shared/tenant.js";
import { tenantLearningSetsCollection } from "../shared/tenantData.js";
import { isRecord } from "../shared/validation.js";
import { readSentenceUnit, sentenceUnits, type SentenceUnit } from "../shared/sentenceWords.js";
import {
  buildInitialChunkLineUpBoard,
  isChunkLineUpElevatorDestinationOpen,
  placeChunkLineUpCard,
  publicChunkLineUpBoard,
  type ChunkLineUpPlayerProfile,
} from "./model.js";
import {
  boardChunkLineUpElevatorRide,
  CHUNK_LINE_UP_ELEVATOR_CAPACITY,
  createChunkLineUpElevatorState,
  resolveChunkLineUpElevatorState,
} from "./elevatorModel.js";
import type {
  ChunkLineUpActionResult,
  ChunkLineUpAssignment,
  ChunkLineUpBaseInput,
  ChunkLineUpBoard,
  ChunkLineUpConfirmInput,
  ChunkLineUpElevatorBoardInput,
  ChunkLineUpElevatorCarState,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorResult,
  ChunkLineUpElevatorRideInput,
  ChunkLineUpElevatorRider,
  ChunkLineUpElevatorState,
  ChunkLineUpGroup,
  ChunkLineUpServerState,
  ChunkLineUpSourceGroup,
} from "./types.js";

const GAME_ID = "chunk-line-up";
const ROUND_MS = 180_000;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

interface ValidRound {
  readonly unit: SentenceUnit;
  readonly roundRef: DocumentReference;
  readonly setId: string;
  readonly tenantId: TenantId;
  readonly expectedPlayerIds: readonly string[];
  readonly startedAtMs: number;
  readonly endsAtMs: number;
  readonly setRef: DocumentReference;
}

async function validateRound(input: ChunkLineUpBaseInput, verifyReadingSet = true): Promise<ValidRound> {
  const sessionRef = db.collection("multiplayerSessions").doc(input.roomId);
  const session = await sessionRef.get();
  const data: unknown = session.exists ? session.data() : null;
  if (!isRecord(data) || data.status !== "playing" || data.roundId !== input.roundId || data.gameId !== GAME_ID) {
    throw new HttpsError("failed-precondition", "진행 중인 Chunk Line-Up 라운드가 아닙니다.");
  }
  const config = isRecord(data.gameConfig) ? data.gameConfig : {};
  const setId = text(config.setId);
  const startedAtMs = resolveSessionStartedAtMs(data.startedAt, data.startedAtMs, data.startDelayMs) ?? 0;
  const expectedPlayerIds = Array.isArray(data.expectedPlayerIds)
    ? [...new Set(data.expectedPlayerIds.filter((item): item is string => typeof item === "string" && Boolean(item)))]
    : [];
  if (!setId || startedAtMs <= 0 || expectedPlayerIds.length === 0) {
    throw new HttpsError("failed-precondition", "Chunk Line-Up 시작 정보를 찾을 수 없습니다.");
  }
  const tenantId = effectiveTenantId(data.tenantId);
  const setRef = tenantLearningSetsCollection(tenantId).doc(setId);
  if (verifyReadingSet) {
    const metadata = await setRef.get();
    const meta: unknown = metadata.exists ? metadata.data() : null;
    if (!isRecord(meta) || !belongsToTenant(meta.tenantId, tenantId) || meta.type !== "reading-chunks") {
      throw new HttpsError("failed-precondition", "Chunk Line-Up은 끊어읽기 세트만 사용할 수 있습니다.");
    }
  }
  return {
    roundRef: sessionRef.collection("rounds").doc(input.roundId),
    unit: readSentenceUnit(config),
    setId,
    tenantId,
    expectedPlayerIds,
    startedAtMs,
    endsAtMs: startedAtMs + ROUND_MS,
    setRef,
  };
}

function stateRef(roundRef: DocumentReference): DocumentReference {
  return roundRef.collection("chunkLineUpState").doc("main");
}

function boardRef(roundRef: DocumentReference): DocumentReference {
  return roundRef.collection("chunkLineUpBoard").doc("main");
}

function elevatorRef(roundRef: DocumentReference): DocumentReference {
  return roundRef.collection("chunkLineUpElevator").doc("main");
}

function operationRef(roundRef: DocumentReference, uid: string, operationId: string): DocumentReference {
  return roundRef.collection("chunkLineUpOperations").doc(uid).collection("items").doc(operationId);
}

function sourceGroups(value: unknown, unit: SentenceUnit): ChunkLineUpSourceGroup[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  return value.items.flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const sourceText = text(raw.sourceText);
    const prompt = text(raw.meaning);
    const chunks = sourceText.split("/").map((item) => item.trim()).filter(Boolean);
    if (!prompt || chunks.length < 2) return [];
    const slots = sentenceUnits(chunks, unit);
    return [{
      id: text(raw.id) || `sentence-${index + 1}`,
      prompt,
      slots,
    }];
  });
}

function profile(playerId: string, value: unknown): ChunkLineUpPlayerProfile {
  const raw = isRecord(value) ? value : {};
  return {
    playerId,
    label: text(raw.nickname) || text(raw.displayName) || playerId,
  };
}

function parseSlot(value: unknown) {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const slotText = text(value.text);
  if (!id || !slotText || typeof value.fixed !== "boolean") return null;
  return {
    id,
    text: slotText,
    fixed: value.fixed,
    filledBy: typeof value.filledBy === "string" && value.filledBy ? value.filledBy : null,
    filledLabel: typeof value.filledLabel === "string" && value.filledLabel ? value.filledLabel : null,
  };
}

function parseGroup(value: unknown): ChunkLineUpGroup | null {
  if (!isRecord(value) || !Array.isArray(value.slots)) return null;
  const id = text(value.id);
  const sourceId = text(value.sourceId);
  const prompt = text(value.prompt);
  const slots = value.slots.map(parseSlot).filter((slot): slot is NonNullable<ReturnType<typeof parseSlot>> => slot !== null);
  return id && sourceId && prompt && slots.length === value.slots.length
    ? { id, sourceId, prompt, slots }
    : null;
}

function parseAssignment(value: unknown): ChunkLineUpAssignment | null {
  if (!isRecord(value)) return null;
  const playerId = text(value.playerId);
  const label = text(value.label);
  const token = text(value.token);
  const targetGroupId = text(value.targetGroupId);
  const targetSlotId = text(value.targetSlotId);
  const attachedGroupId = text(value.attachedGroupId) || null;
  const recentGroupId = value.recentGroupId === null ? null : text(value.recentGroupId);
  const score = integer(value.score);
  // A card needs its target; an attached or waiting player holds no card.
  const consistent = token
    ? Boolean(targetGroupId && targetSlotId) && attachedGroupId === null
    : !targetGroupId && !targetSlotId;
  return playerId && label && consistent && score >= 0
    ? { playerId, label, token, targetGroupId, targetSlotId, attachedGroupId, score, recentGroupId: recentGroupId || null }
    : null;
}

function parseBoard(value: unknown): ChunkLineUpBoard | null {
  if (!isRecord(value) || !Array.isArray(value.groups) || !isRecord(value.assignments)) return null;
  const groups = value.groups.map(parseGroup).filter((group): group is ChunkLineUpGroup => group !== null);
  if (groups.length !== value.groups.length) return null;
  const assignments: Record<string, ChunkLineUpAssignment> = {};
  for (const [playerId, raw] of Object.entries(value.assignments)) {
    const assignment = parseAssignment(raw);
    if (!assignment || assignment.playerId !== playerId) return null;
    assignments[playerId] = assignment;
  }
  const revision = integer(value.revision);
  const completedGroupCount = integer(value.completedGroupCount);
  return revision >= 1 && completedGroupCount >= 0 ? { revision, groups, assignments, completedGroupCount } : null;
}

function parseServerState(value: unknown): ChunkLineUpServerState | null {
  if (!isRecord(value) || !Array.isArray(value.sourceGroups)) return null;
  const groups = value.sourceGroups.flatMap((raw) => {
    if (!isRecord(raw) || !Array.isArray(raw.slots)) return [];
    const id = text(raw.id);
    const prompt = text(raw.prompt);
    const slots = raw.slots.map(text).filter(Boolean);
    return id && prompt && slots.length >= 2 ? [{ id, prompt, slots }] : [];
  });
  const nextSourceIndex = integer(value.nextSourceIndex);
  const nextGroupSequence = integer(value.nextGroupSequence);
  const endsAtMs = integer(value.endsAtMs);
  const board = parseBoard(value.board);
  return groups.length === value.sourceGroups.length && nextSourceIndex >= 0 && nextGroupSequence >= 1 && endsAtMs > 0 && board
    ? { sourceGroups: groups, nextSourceIndex, nextGroupSequence, endsAtMs, board }
    : null;
}

function persistBoard(tx: Transaction, ref: DocumentReference, board: ChunkLineUpBoard, now: number): void {
  tx.set(ref, {
    gameId: GAME_ID,
    ...publicChunkLineUpBoard(board),
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
  });
}

function persistState(tx: Transaction, ref: DocumentReference, setId: string, state: ChunkLineUpServerState, now: number): void {
  tx.set(ref, {
    gameId: GAME_ID,
    setId,
    ...state,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
  });
}

export async function ensureChunkLineUpRoundService(input: ChunkLineUpBaseInput): Promise<void> {
  const round = await validateRound(input);
  const sRef = stateRef(round.roundRef);
  if ((await sRef.get()).exists) return;
  const [content, ...participantDocs] = await Promise.all([
    round.setRef.collection("content").doc("main").get(),
    ...round.expectedPlayerIds.map((playerId) => round.roundRef.collection("participants").doc(playerId).get()),
  ]);
  const groups = sourceGroups(content.exists ? content.data() : null, round.unit);
  if (groups.length === 0) throw new HttpsError("failed-precondition", "Chunk Line-Up에 사용할 끊어읽기 문장이 없습니다.");
  const players = round.expectedPlayerIds.map((playerId, index) => profile(playerId, participantDocs[index]?.data()));
  const initial = buildInitialChunkLineUpBoard(groups, players, input.roundId);
  const state: ChunkLineUpServerState = {
    sourceGroups: initial.orderedSourceGroups,
    nextSourceIndex: initial.nextSourceIndex,
    nextGroupSequence: initial.nextGroupSequence,
    endsAtMs: round.endsAtMs,
    board: initial.board,
  };
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    if ((await tx.get(sRef)).exists) return;
    persistState(tx, sRef, round.setId, state, now);
    persistBoard(tx, boardRef(round.roundRef), initial.board, now);
    tx.set(elevatorRef(round.roundRef), {
      ...createChunkLineUpElevatorState(initial.board.groups.length, now),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
    });
  });
}

function resultFromOperation(value: unknown): ChunkLineUpActionResult | null {
  if (!isRecord(value) || value.accepted !== true) return null;
  const revision = integer(value.revision);
  const score = integer(value.score);
  return revision >= 1 && score >= 0
    ? { accepted: true, revision, score, completedGroup: value.completedGroup === true }
    : null;
}

function parseElevatorState(value: unknown): ChunkLineUpElevatorState | null {
  if (!isRecord(value)) return null;
  const revision = integer(value.revision);
  const lobbyFloor = integer(value.lobbyFloor);
  const parseRider = (raw: unknown): ChunkLineUpElevatorRider | null => {
    if (!isRecord(raw) || typeof raw.boarded !== "boolean") return null;
    const playerId = text(raw.playerId);
    const originFloor = typeof raw.originFloor === "number" && Number.isInteger(raw.originFloor) ? raw.originFloor : -1;
    const destinationFloor = typeof raw.destinationFloor === "number" && Number.isInteger(raw.destinationFloor) ? raw.destinationFloor : -1;
    return playerId && originFloor >= 0 && destinationFloor >= 0
      ? { playerId, originFloor, destinationFloor, boarded: raw.boarded }
      : null;
  };
  const parseCar = (raw: unknown, id: ChunkLineUpElevatorId): ChunkLineUpElevatorCarState | null => {
    if (!isRecord(raw) || raw.id !== id || !Array.isArray(raw.seats)) return null;
    const phase = raw.phase;
    if (phase !== "open" && phase !== "closing" && phase !== "moving" && phase !== "opening") return null;
    const direction = raw.direction === -1 || raw.direction === 1 ? raw.direction : 0;
    const floor = integer(raw.floor);
    const targetFloor = raw.targetFloor === null ? null : integer(raw.targetFloor);
    const phaseStartedAtMs = integer(raw.phaseStartedAtMs);
    const seats = raw.seats.map(parseRider).filter((seat): seat is ChunkLineUpElevatorRider => seat !== null);
    if (floor < 0 || phaseStartedAtMs <= 0 || seats.length !== raw.seats.length || seats.length > CHUNK_LINE_UP_ELEVATOR_CAPACITY
      || new Set(seats.map((seat) => seat.playerId)).size !== seats.length
      || (targetFloor !== null && targetFloor < 0)) return null;
    return { id, phase, floor, targetFloor, direction, phaseStartedAtMs, seats };
  };
  const left = parseCar(value.left, "left");
  const right = parseCar(value.right, "right");
  return revision >= 1 && lobbyFloor >= 1 && left && right ? { revision, lobbyFloor, left, right } : null;
}

/**
 * Seat-only reservations were replaced by booking a ride with a destination.
 * The callable stays deployed for old tabs and simply declines.
 */
export async function reserveChunkLineUpElevatorSeatService(
  uid: string,
  input: ChunkLineUpElevatorBoardInput,
): Promise<ChunkLineUpElevatorResult> {
  const round = await validateRound(input, false);
  if (!round.expectedPlayerIds.includes(uid)) throw new HttpsError("permission-denied", "현재 라운드 참가자가 아닙니다.");
  const stateSnapshot = await stateRef(round.roundRef).get();
  const gameState = parseServerState(stateSnapshot.exists ? stateSnapshot.data() : null);
  if (!gameState) throw new HttpsError("failed-precondition", "Chunk Line-Up 상태를 찾을 수 없습니다.");
  const snapshot = await elevatorRef(round.roundRef).get();
  const now = Date.now();
  const current = parseElevatorState(snapshot.exists ? snapshot.data() : null)
    ?? createChunkLineUpElevatorState(gameState.board.groups.length, now);
  return { accepted: false, state: resolveChunkLineUpElevatorState(current, now) };
}

export async function boardChunkLineUpElevatorRideService(
  uid: string,
  input: ChunkLineUpElevatorRideInput,
): Promise<ChunkLineUpElevatorResult> {
  const round = await validateRound(input);
  if (!round.expectedPlayerIds.includes(uid)) throw new HttpsError("permission-denied", "현재 라운드 참가자가 아닙니다.");
  const sRef = stateRef(round.roundRef);
  const ref = elevatorRef(round.roundRef);
  return db.runTransaction(async (tx) => {
    const [stateSnapshot, elevatorSnapshot] = await Promise.all([tx.get(sRef), tx.get(ref)]);
    const gameState = parseServerState(stateSnapshot.exists ? stateSnapshot.data() : null);
    if (!gameState) throw new HttpsError("failed-precondition", "Chunk Line-Up 상태를 찾을 수 없습니다.");
    const floorCount = gameState.board.groups.length;
    if (input.floor < 0 || input.floor > floorCount
      || input.destinationFloor < 0 || input.destinationFloor >= floorCount) {
      throw new HttpsError("invalid-argument", "엘리베이터 층 또는 행선지가 올바르지 않습니다.");
    }
    const now = Date.now();
    const current = resolveChunkLineUpElevatorState(
      parseElevatorState(elevatorSnapshot.exists ? elevatorSnapshot.data() : null)
        ?? createChunkLineUpElevatorState(floorCount, now),
      now,
    );
    if (!isChunkLineUpElevatorDestinationOpen(gameState.board, input.destinationFloor, input.destinationGroupId)) {
      return { accepted: false, state: current };
    }
    const result = boardChunkLineUpElevatorRide(
      current,
      input.elevatorId,
      uid,
      input.floor,
      input.destinationFloor,
      floorCount,
      now,
    );
    if (!result.accepted) return { accepted: false, state: current };
    const nextState = { ...result.state, revision: current.revision + 1 };
    tx.set(ref, {
      ...nextState,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
    });
    return { accepted: true, state: nextState };
  });
}
export async function confirmChunkLineUpSlotService(
  uid: string,
  input: ChunkLineUpConfirmInput,
): Promise<ChunkLineUpActionResult> {
  const round = await validateRound(input, false);
  if (!round.expectedPlayerIds.includes(uid)) throw new HttpsError("permission-denied", "현재 라운드 참가자가 아닙니다.");
  const sRef = stateRef(round.roundRef);
  const bRef = boardRef(round.roundRef);
  const opRef = operationRef(round.roundRef, uid, input.operationId);

  return db.runTransaction(async (tx) => {
    const [operationDoc, stateDoc] = await Promise.all([tx.get(opRef), tx.get(sRef)]);
    if (operationDoc.exists) {
      const previous = resultFromOperation(operationDoc.data());
      if (previous) return previous;
    }
    const state = parseServerState(stateDoc.exists ? stateDoc.data() : null);
    if (!state) throw new HttpsError("failed-precondition", "Chunk Line-Up 상태를 찾을 수 없습니다.");
    const board = state.board;
    if (Date.now() >= state.endsAtMs) return { accepted: false, revision: board.revision, reason: "expired" };
    const placement = placeChunkLineUpCard(state, uid, input.groupId, input.slotId, input.roundId);
    if (placement.kind !== "placed") return { accepted: false, revision: board.revision, reason: placement.kind };
    const nextBoard: ChunkLineUpBoard = placement.state.board;
    const nextState: ChunkLineUpServerState = { ...state, ...placement.state };
    const completedGroup = placement.completedGroup;    const now = Date.now();
    persistBoard(tx, bRef, nextBoard, now);
    persistState(tx, sRef, round.setId, { ...nextState, board: nextBoard }, now);
    const result: ChunkLineUpActionResult = {
      accepted: true,
      revision: nextBoard.revision,
      score: placement.score,
      completedGroup,
    };
    tx.set(opRef, { ...result, createdAt: FieldValue.serverTimestamp(), createdAtMs: now });
    return result;
  });
}
