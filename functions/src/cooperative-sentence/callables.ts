import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { ensureRound, refreshMatch, submitSentence } from "./service.js";
import type { CooperativeInput, CooperativeSubmitInput } from "./types.js";

const options = { region: "asia-northeast3", enforceAppCheck: false } as const;
function parseBase(value: unknown): CooperativeInput {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "협동 게임 정보가 없습니다.");
  const roomId = typeof value.roomId === "string" ? value.roomId.trim() : "";
  const roundId = typeof value.roundId === "string" ? value.roundId.trim() : "";
  if (!/^[\p{L}\p{N}._-]{1,64}$/u.test(roomId) || !/^[A-Za-z0-9_-]{1,128}$/.test(roundId)) throw new HttpsError("invalid-argument", "방 또는 라운드 정보가 올바르지 않습니다.");
  return { roomId, roundId };
}
async function authorize(request: CallableRequest<unknown>, input: CooperativeInput): Promise<string> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const uid = request.auth.uid;
  const admin = await db.collection("admins").doc(uid).get();
  const adminData: unknown = admin.exists ? admin.data() : null;
  if (isRecord(adminData) && adminData.active !== false) return uid;
  const player = await db.collection("multiplayerSessions").doc(input.roomId).collection("players").doc(uid).get();
  if (!player.exists) throw new HttpsError("permission-denied", "이 방의 학생이 아닙니다.");
  return uid;
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

export const ensureCooperativeRound = onCall(options, async (request) => { const input = parseBase(request.data); await authorize(request, input); await ensureRound(input); return { ok: true }; });
export const refreshCooperativeMatch = onCall(options, async (request) => { const input = parseBase(request.data); await authorize(request, input); await refreshMatch(input); return { ok: true }; });
export const submitCooperativeSentence = onCall(options, async (request) => { const input = parseSubmit(request.data); const uid = await authorize(request, input); return submitSentence(uid, input); });
