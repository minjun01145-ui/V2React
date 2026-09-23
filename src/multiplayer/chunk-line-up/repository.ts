import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/firebaseClient.ts";
import { MULTIPLAYER_COLLECTION } from "../constants.ts";
import type {
  ChunkLineUpActionResult,
  ChunkLineUpAssignment,
  ChunkLineUpBoard,
  ChunkLineUpElevatorCarState,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorResult,
  ChunkLineUpElevatorRider,
  ChunkLineUpElevatorState,
  ChunkLineUpGroup,
  ChunkLineUpSlot,
  ConfirmChunkLineUpSlotInput,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

function slot(value: unknown): ChunkLineUpSlot | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  if (!id || typeof value.text !== "string" || typeof value.fixed !== "boolean") return null;
  return {
    id,
    text: value.text.trim(),
    fixed: value.fixed,
    filledBy: typeof value.filledBy === "string" && value.filledBy ? value.filledBy : null,
    filledLabel: typeof value.filledLabel === "string" && value.filledLabel ? value.filledLabel : null,
  };
}

function group(value: unknown): ChunkLineUpGroup | null {
  if (!isRecord(value) || !Array.isArray(value.slots)) return null;
  const id = text(value.id);
  const sourceId = text(value.sourceId);
  const prompt = text(value.prompt);
  const slots = value.slots.map(slot).filter((item): item is ChunkLineUpSlot => item !== null);
  return id && sourceId && prompt && slots.length === value.slots.length
    ? { id, sourceId, prompt, slots }
    : null;
}

function assignment(value: unknown): ChunkLineUpAssignment | null {
  if (!isRecord(value)) return null;
  const playerId = text(value.playerId);
  const label = text(value.label);
  const token = text(value.token);
  const score = integer(value.score);
  return playerId && label && token && score >= 0
    ? { playerId, label, token, score }
    : null;
}

function board(value: unknown): ChunkLineUpBoard | null {
  if (!isRecord(value) || !Array.isArray(value.groups) || !isRecord(value.assignments)) return null;
  const groups = value.groups.map(group).filter((item): item is ChunkLineUpGroup => item !== null);
  if (groups.length !== value.groups.length) return null;
  const assignments: Record<string, ChunkLineUpAssignment> = {};
  for (const [playerId, raw] of Object.entries(value.assignments)) {
    const parsed = assignment(raw);
    if (!parsed || parsed.playerId !== playerId) return null;
    assignments[playerId] = parsed;
  }
  const revision = integer(value.revision);
  const completedGroupCount = integer(value.completedGroupCount);
  return revision >= 1 && completedGroupCount >= 0
    ? { revision, groups, assignments, completedGroupCount }
    : null;
}

function actionResult(value: unknown): ChunkLineUpActionResult {
  if (!isRecord(value)) throw new Error("Chunk Line-Up 응답이 올바르지 않습니다.");
  const revision = integer(value.revision);
  if (revision < 1) throw new Error("Chunk Line-Up 상태 번호가 올바르지 않습니다.");
  if (value.accepted === true) {
    const score = integer(value.score);
    if (score < 0) throw new Error("Chunk Line-Up 점수가 올바르지 않습니다.");
    return { accepted: true, revision, score, completedGroup: value.completedGroup === true };
  }
  if (value.accepted === false && (value.reason === "wrong" || value.reason === "stale" || value.reason === "expired")) {
    return { accepted: false, revision, reason: value.reason };
  }
  throw new Error("Chunk Line-Up 처리 결과가 올바르지 않습니다.");
}

function elevatorRider(value: unknown): ChunkLineUpElevatorRider | null {
  if (!isRecord(value)) return null;
  const playerId = text(value.playerId);
  const destinationFloor = value.destinationFloor === null
    ? null
    : typeof value.destinationFloor === "number" && Number.isInteger(value.destinationFloor)
      ? value.destinationFloor
      : -1;
  return playerId && (destinationFloor === null || destinationFloor >= 0)
    ? { playerId, destinationFloor }
    : null;
}

function elevatorCar(value: unknown, id: ChunkLineUpElevatorId): ChunkLineUpElevatorCarState | null {
  if (!isRecord(value) || value.id !== id || !Array.isArray(value.seats) || !Array.isArray(value.queue)) return null;
  if (value.phase !== "open" && value.phase !== "closing" && value.phase !== "moving" && value.phase !== "opening") return null;
  const floor = integer(value.floor);
  const targetFloor = value.targetFloor === null ? null : integer(value.targetFloor);
  const phaseStartedAtMs = integer(value.phaseStartedAtMs);
  const seats = value.seats.map(elevatorRider).filter((seat): seat is ChunkLineUpElevatorRider => seat !== null);
  const queue = value.queue.map(integer);
  if (floor < 0 || phaseStartedAtMs <= 0 || seats.length !== value.seats.length || seats.length > 3
    || new Set(seats.map((seat) => seat.playerId)).size !== seats.length
    || queue.some((item) => item < 0) || new Set(queue).size !== queue.length
    || (targetFloor !== null && targetFloor < 0)) return null;
  return { id, phase: value.phase, floor, targetFloor, phaseStartedAtMs, seats, queue };
}

function elevatorState(value: unknown): ChunkLineUpElevatorState | null {
  if (!isRecord(value)) return null;
  const revision = integer(value.revision);
  const lobbyFloor = integer(value.lobbyFloor);
  const left = elevatorCar(value.left, "left");
  const right = elevatorCar(value.right, "right");
  return revision >= 1 && lobbyFloor >= 1 && left && right ? { revision, lobbyFloor, left, right } : null;
}

function elevatorResult(value: unknown): ChunkLineUpElevatorResult {
  if (!isRecord(value) || typeof value.accepted !== "boolean") throw new Error("엘리베이터 좌석 응답이 올바르지 않습니다.");
  const parsed = elevatorState(value.state);
  if (!parsed) throw new Error("엘리베이터 좌석 상태가 올바르지 않습니다.");
  return { accepted: value.accepted, state: parsed };
}

function boardRef(roomId: string, roundId: string) {
  return doc(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "chunkLineUpBoard", "main");
}

function elevatorRef(roomId: string, roundId: string) {
  return doc(db, MULTIPLAYER_COLLECTION, roomId, "rounds", roundId, "chunkLineUpElevator", "main");
}

export function subscribeChunkLineUpBoard(
  roomId: string,
  roundId: string,
  onValue: (value: ChunkLineUpBoard | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    boardRef(roomId, roundId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onValue(null);
        return;
      }
      const parsed = board(snapshot.data());
      if (!parsed) {
        onError(new Error("Chunk Line-Up 게임판 데이터가 올바르지 않습니다."));
        return;
      }
      onValue(parsed);
    },
    onError,
  );
}

export function subscribeChunkLineUpElevator(
  roomId: string,
  roundId: string,
  onValue: (value: ChunkLineUpElevatorState | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    elevatorRef(roomId, roundId),
    (snapshot) => onValue(snapshot.exists() ? elevatorState(snapshot.data()) : null),
    onError,
  );
}

export async function ensureChunkLineUpRound(roomId: string, roundId: string): Promise<void> {
  await httpsCallable(functions, "ensureChunkLineUpRound")({ roomId, roundId });
}

export async function confirmChunkLineUpSlot(input: ConfirmChunkLineUpSlotInput): Promise<ChunkLineUpActionResult> {
  const response = await httpsCallable(functions, "confirmChunkLineUpSlot")(input);
  return actionResult(response.data);
}

export async function reserveChunkLineUpElevatorSeat(
  roomId: string,
  roundId: string,
  elevatorId: ChunkLineUpElevatorId,
  floor: number,
): Promise<ChunkLineUpElevatorResult> {
  const response = await httpsCallable(functions, "reserveChunkLineUpElevatorSeat")({ roomId, roundId, elevatorId, floor });
  return elevatorResult(response.data);
}

export async function boardChunkLineUpElevatorRide(
  roomId: string,
  roundId: string,
  elevatorId: ChunkLineUpElevatorId,
  floor: number,
  destinationFloor: number,
  destinationGroupId: string,
): Promise<ChunkLineUpElevatorResult> {
  const response = await httpsCallable(functions, "boardChunkLineUpElevatorRide")({
    roomId,
    roundId,
    elevatorId,
    floor,
    destinationFloor,
    destinationGroupId,
  });
  return elevatorResult(response.data);
}

export async function setChunkLineUpElevatorDestination(
  roomId: string,
  roundId: string,
  elevatorId: ChunkLineUpElevatorId,
  destinationFloor: number,
  destinationGroupId: string,
): Promise<ChunkLineUpElevatorResult> {
  const response = await httpsCallable(functions, "setChunkLineUpElevatorDestination")({
    roomId,
    roundId,
    elevatorId,
    destinationFloor,
    destinationGroupId,
  });
  return elevatorResult(response.data);
}
