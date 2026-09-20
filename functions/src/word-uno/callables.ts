import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { requireRoomCaller } from "../shared/auth.js";
import { isRecord } from "../shared/validation.js";
import {
  drawWordUnoCardService,
  ensureWordUnoRoundService,
  expireWordUnoRoundService,
  expireWordUnoTurnService,
  playWordUnoCardService,
} from "./service.js";
import type {
  WordUnoBaseInput,
  WordUnoDrawInput,
  WordUnoExpireTurnInput,
  WordUnoPlayInput,
  WordUnoStage,
} from "./types.js";

const options = { region: "asia-northeast3", enforceAppCheck: false, invoker: "public", timeoutSeconds: 120 } as const;

function base(value: unknown): WordUnoBaseInput {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "Word UNO 정보가 없습니다.");
  const roomId = typeof value.roomId === "string" ? value.roomId.trim() : "";
  const roundId = typeof value.roundId === "string" ? value.roundId.trim() : "";
  if (!/^[\p{L}\p{N}._-]{1,64}$/u.test(roomId) || !/^[A-Za-z0-9_-]{1,128}$/.test(roundId)) {
    throw new HttpsError("invalid-argument", "방 또는 라운드 정보가 올바르지 않습니다.");
  }
  return { roomId, roundId };
}

function revision(value: unknown): number {
  if (!isRecord(value) || typeof value.revision !== "number" || !Number.isInteger(value.revision) || value.revision < 1) {
    throw new HttpsError("invalid-argument", "Word UNO 상태 번호가 올바르지 않습니다.");
  }
  return value.revision;
}

function operationId(value: unknown): string {
  const id = isRecord(value) && typeof value.operationId === "string" ? value.operationId.trim() : "";
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(id)) throw new HttpsError("invalid-argument", "Word UNO 작업 번호가 올바르지 않습니다.");
  return id;
}

function optionalStage(value: unknown): WordUnoStage | undefined {
  if (!isRecord(value) || value.wildStage === undefined || value.wildStage === null) return undefined;
  if (value.wildStage !== 1 && value.wildStage !== 2 && value.wildStage !== 3) throw new HttpsError("invalid-argument", "WILD 단계가 올바르지 않습니다.");
  return value.wildStage;
}

function play(value: unknown): WordUnoPlayInput {
  const parsed = base(value);
  const cardId = isRecord(value) && typeof value.cardId === "string" ? value.cardId.trim() : "";
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(cardId)) throw new HttpsError("invalid-argument", "Word UNO 카드 정보가 올바르지 않습니다.");
  const wildStage = optionalStage(value);
  return {
    ...parsed,
    operationId: operationId(value),
    revision: revision(value),
    cardId,
    ...(wildStage === undefined ? {} : { wildStage }),
  };
}

function draw(value: unknown): WordUnoDrawInput {
  return { ...base(value), operationId: operationId(value), revision: revision(value) };
}

function expireTurn(value: unknown): WordUnoExpireTurnInput {
  const parsed = base(value);
  const deadlineAtMs = isRecord(value) && typeof value.deadlineAtMs === "number" && Number.isInteger(value.deadlineAtMs)
    ? value.deadlineAtMs
    : 0;
  if (deadlineAtMs <= 0) throw new HttpsError("invalid-argument", "Word UNO 턴 제한시간이 올바르지 않습니다.");
  return { ...parsed, revision: revision(value), deadlineAtMs };
}

async function authorize(request: CallableRequest<unknown>, input: WordUnoBaseInput): Promise<string> {
  return requireRoomCaller(request, input.roomId);
}

export const ensureWordUnoRound = onCall(options, async (request) => {
  const input = base(request.data);
  await authorize(request, input);
  await ensureWordUnoRoundService(input);
  return { accepted: true };
});

export const playWordUnoCard = onCall(options, async (request) => {
  const input = play(request.data);
  const uid = await authorize(request, input);
  return playWordUnoCardService(uid, input);
});

export const drawWordUnoCard = onCall(options, async (request) => {
  const input = draw(request.data);
  const uid = await authorize(request, input);
  return drawWordUnoCardService(uid, input);
});

export const expireWordUnoTurn = onCall(options, async (request) => {
  const input = expireTurn(request.data);
  const uid = await authorize(request, input);
  return expireWordUnoTurnService(uid, input);
});

export const expireWordUnoRound = onCall(options, async (request) => {
  const input = base(request.data);
  await authorize(request, input);
  return expireWordUnoRoundService(input);
});
