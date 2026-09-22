import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { requireRoomCaller } from "../shared/auth.js";
import { isRecord } from "../shared/validation.js";
import {
  confirmChunkLineUpSlotService,
  ensureChunkLineUpRoundService,
  reserveChunkLineUpElevatorSeatService,
  setChunkLineUpElevatorDestinationService,
} from "./service.js";
import type {
  ChunkLineUpBaseInput,
  ChunkLineUpConfirmInput,
  ChunkLineUpElevatorBoardInput,
  ChunkLineUpElevatorDestinationInput,
} from "./types.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public", timeoutSeconds: 120 } as const;
const ROOM_PATTERN = /^[\p{L}\p{N}._-]{1,64}$/u;
const ROUND_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9:_-]{1,160}$/;

function base(value: unknown): ChunkLineUpBaseInput {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "Chunk Line-Up 정보가 없습니다.");
  const roomId = typeof value.roomId === "string" ? value.roomId.trim() : "";
  const roundId = typeof value.roundId === "string" ? value.roundId.trim() : "";
  if (!ROOM_PATTERN.test(roomId) || !ROUND_PATTERN.test(roundId)) {
    throw new HttpsError("invalid-argument", "방 또는 라운드 정보가 올바르지 않습니다.");
  }
  return { roomId, roundId };
}

function confirm(value: unknown): ChunkLineUpConfirmInput {
  const parsed = base(value);
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "Chunk Line-Up 슬롯 정보가 없습니다.");
  const operationId = typeof value.operationId === "string" ? value.operationId.trim() : "";
  const groupId = typeof value.groupId === "string" ? value.groupId.trim() : "";
  const slotId = typeof value.slotId === "string" ? value.slotId.trim() : "";
  const revision = typeof value.revision === "number" && Number.isInteger(value.revision) ? value.revision : 0;
  if (!TOKEN_PATTERN.test(operationId) || !TOKEN_PATTERN.test(groupId) || !TOKEN_PATTERN.test(slotId) || revision < 1) {
    throw new HttpsError("invalid-argument", "Chunk Line-Up 슬롯 정보가 올바르지 않습니다.");
  }
  return { ...parsed, operationId, groupId, slotId, revision };
}

function elevatorId(value: unknown): "left" | "right" {
  if (value === "left" || value === "right") return value;
  throw new HttpsError("invalid-argument", "엘리베이터 정보가 올바르지 않습니다.");
}

function elevatorBoard(value: unknown): ChunkLineUpElevatorBoardInput {
  const parsed = base(value);
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "엘리베이터 탑승 정보가 없습니다.");
  const floor = typeof value.floor === "number" && Number.isInteger(value.floor) ? value.floor : -1;
  if (floor < 0) throw new HttpsError("invalid-argument", "엘리베이터 층 정보가 올바르지 않습니다.");
  return { ...parsed, elevatorId: elevatorId(value.elevatorId), floor };
}

function elevatorDestination(value: unknown): ChunkLineUpElevatorDestinationInput {
  const parsed = base(value);
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "엘리베이터 행선지 정보가 없습니다.");
  const destinationFloor = typeof value.destinationFloor === "number" && Number.isInteger(value.destinationFloor)
    ? value.destinationFloor
    : -1;
  if (destinationFloor < 0) throw new HttpsError("invalid-argument", "엘리베이터 행선지가 올바르지 않습니다.");
  return { ...parsed, elevatorId: elevatorId(value.elevatorId), destinationFloor };
}

async function authorize(request: CallableRequest<unknown>, input: ChunkLineUpBaseInput): Promise<string> {
  return requireRoomCaller(request, input.roomId);
}

export const ensureChunkLineUpRound = onCall(options, async (request) => {
  const input = base(request.data);
  await authorize(request, input);
  await ensureChunkLineUpRoundService(input);
  return { accepted: true };
});

export const confirmChunkLineUpSlot = onCall(options, async (request) => {
  const input = confirm(request.data);
  const uid = await authorize(request, input);
  return confirmChunkLineUpSlotService(uid, input);
});

export const reserveChunkLineUpElevatorSeat = onCall(options, async (request) => {
  const input = elevatorBoard(request.data);
  const uid = await authorize(request, input);
  return reserveChunkLineUpElevatorSeatService(uid, input);
});

export const setChunkLineUpElevatorDestination = onCall(options, async (request) => {
  const input = elevatorDestination(request.data);
  const uid = await authorize(request, input);
  return setChunkLineUpElevatorDestinationService(uid, input);
});
