import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { requireAdminForRoom, requireRoomCaller } from "../shared/auth.js";
import { isRecord } from "../shared/validation.js";
import { enableHardMode, ensureRound, expireTurn, refreshMatch, submitSentence } from "./service.js";
import type { CooperativeExpireInput, CooperativeInput, CooperativeSubmitInput } from "./types.js";

const options = { region: "asia-northeast3", enforceAppCheck: false } as const;
function parseBase(value: unknown): CooperativeInput {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "커플 게임 정보가 없습니다.");
  const roomId = typeof value.roomId === "string" ? value.roomId.trim() : "";
  const roundId = typeof value.roundId === "string" ? value.roundId.trim() : "";
  if (!/^[\p{L}\p{N}._-]{1,64}$/u.test(roomId) || !/^[A-Za-z0-9_-]{1,128}$/.test(roundId)) throw new HttpsError("invalid-argument", "방 또는 라운드 정보가 올바르지 않습니다.");
  return { roomId, roundId };
}
async function authorize(request: CallableRequest<unknown>, input: CooperativeInput): Promise<string> {
  return requireRoomCaller(request, input.roomId);
}
function parseSubmit(value: unknown): CooperativeSubmitInput {
  const base = parseBase(value);
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "답안이 없습니다.");
  const generation = typeof value.generation === "number" && Number.isInteger(value.generation) ? value.generation : -1;
  const submissionId = typeof value.submissionId === "string" ? value.submissionId : "";
  const questionId = typeof value.questionId === "string" ? value.questionId : "";
  const tokenIds = Array.isArray(value.tokenIds) ? value.tokenIds.filter((item): item is string => typeof item === "string") : [];
  if (!/^[0-9a-f-]{36}$/i.test(submissionId) || generation < 0 || !questionId || tokenIds.length === 0 || tokenIds.length > 100) throw new HttpsError("invalid-argument", "답안 형식이 올바르지 않습니다.");
  return { ...base, submissionId, generation, questionId, tokenIds };
}
function parseExpire(value: unknown): CooperativeExpireInput {
  const base = parseBase(value);
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "제한시간 정보가 없습니다.");
  const generation = typeof value.generation === "number" && Number.isInteger(value.generation) ? value.generation : -1;
  const deadlineAtMs = typeof value.deadlineAtMs === "number" && Number.isInteger(value.deadlineAtMs) ? value.deadlineAtMs : 0;
  if (generation < 0 || deadlineAtMs <= 0) throw new HttpsError("invalid-argument", "제한시간 정보가 올바르지 않습니다.");
  return { ...base, generation, deadlineAtMs };
}

export const ensureCooperativeRound = onCall(options, async (request) => { const input = parseBase(request.data); await authorize(request, input); await ensureRound(input); return { ok: true }; });
export const refreshCooperativeMatch = onCall(options, async (request) => { const input = parseBase(request.data); await authorize(request, input); await refreshMatch(input); return { ok: true }; });
export const submitCooperativeSentence = onCall(options, async (request) => { const input = parseSubmit(request.data); const uid = await authorize(request, input); return submitSentence(uid, input); });
export const enableCooperativeHardMode = onCall(options, async (request) => { const input = parseBase(request.data); await requireAdminForRoom(request, input.roomId); await enableHardMode(input); return { ok: true }; });
export const expireCooperativeTurn = onCall(options, async (request) => { const input = parseExpire(request.data); const uid = await authorize(request, input); return expireTurn(uid, input); });
