import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { requireStudentItemAccount } from "../items/service.js";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import {
  ensureRound,
  expirePhase,
  issueQuestion,
  refreshMatch,
  submitAnswer,
  useBattleItem as useBattleItemService,
} from "./service.js";
import type {
  BattleExpireInput,
  BattleInput,
  BattleIssueInput,
  BattleSubmitInput,
  BattleUseItemInput,
} from "./types.js";

const options = {
  region: "asia-northeast3",
  enforceAppCheck: false,
  timeoutSeconds: 120,
} as const;

function base(value: unknown): BattleInput {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "배틀 정보가 없습니다.");
  const roomId = typeof value.roomId === "string" ? value.roomId.trim() : "";
  const roundId = typeof value.roundId === "string" ? value.roundId.trim() : "";
  if (
    !/^[\p{L}\p{N}._-]{1,64}$/u.test(roomId)
    || !/^[A-Za-z0-9_-]{1,128}$/.test(roundId)
  ) {
    throw new HttpsError("invalid-argument", "방 또는 라운드 정보가 올바르지 않습니다.");
  }
  return { roomId, roundId };
}

function generation(value: unknown) {
  if (
    !isRecord(value)
    || typeof value.generation !== "number"
    || !Number.isInteger(value.generation)
    || value.generation < 0
  ) {
    throw new HttpsError("invalid-argument", "배틀 세대 정보가 올바르지 않습니다.");
  }
  return value.generation;
}

function issue(value: unknown): BattleIssueInput {
  const parsed = base(value);
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "문제 정보가 없습니다.");
  const itemId = typeof value.itemId === "string" ? value.itemId.trim() : "";
  const side = value.side === "source" || value.side === "meaning" ? value.side : null;
  if (!itemId || !side) {
    throw new HttpsError("invalid-argument", "선택한 문제가 올바르지 않습니다.");
  }
  return { ...parsed, generation: generation(value), itemId, side };
}

function submit(value: unknown): BattleSubmitInput {
  const parsed = base(value);
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "답안이 없습니다.");
  const submissionId = typeof value.submissionId === "string" ? value.submissionId : "";
  const answer = typeof value.answer === "string"
    ? value.answer.normalize("NFKC").trim()
    : "";
  if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !answer || answer.length > 1000) {
    throw new HttpsError("invalid-argument", "답안 형식이 올바르지 않습니다.");
  }
  return { ...parsed, generation: generation(value), submissionId, answer };
}

function expire(value: unknown): BattleExpireInput {
  const parsed = base(value);
  if (
    !isRecord(value)
    || typeof value.deadlineAtMs !== "number"
    || !Number.isInteger(value.deadlineAtMs)
    || value.deadlineAtMs <= 0
  ) {
    throw new HttpsError("invalid-argument", "제한시간 정보가 올바르지 않습니다.");
  }
  return {
    ...parsed,
    generation: generation(value),
    deadlineAtMs: value.deadlineAtMs,
  };
}

function useItem(value: unknown): BattleUseItemInput {
  const parsed = base(value);
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "아이템 정보가 없습니다.");
  const operationId = typeof value.operationId === "string" ? value.operationId.trim() : "";
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(operationId) || value.itemId !== "ink") {
    throw new HttpsError("invalid-argument", "배틀 아이템 정보가 올바르지 않습니다.");
  }
  return {
    ...parsed,
    generation: generation(value),
    operationId,
    itemId: "ink",
  };
}

async function authorize(request: CallableRequest<unknown>, input: BattleInput) {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const uid = request.auth.uid;
  const admin = await db.collection("admins").doc(uid).get();
  if (admin.exists && admin.data()?.active !== false) return uid;
  if (
    !(await db.collection("multiplayerSessions")
      .doc(input.roomId)
      .collection("players")
      .doc(uid)
      .get()).exists
  ) {
    throw new HttpsError("permission-denied", "이 방의 학생이 아닙니다.");
  }
  return uid;
}

export const ensureBattleRound = onCall(options, async (request) => {
  const input = base(request.data);
  await authorize(request, input);
  await ensureRound(input);
  return { accepted: true };
});

export const refreshBattleMatch = onCall(options, async (request) => {
  const input = base(request.data);
  await authorize(request, input);
  await refreshMatch(input);
  return { accepted: true };
});

export const issueBattleQuestion = onCall(options, async (request) => {
  const input = issue(request.data);
  const uid = await authorize(request, input);
  return issueQuestion(uid, input);
});

export const submitBattleAnswer = onCall(options, async (request) => {
  const input = submit(request.data);
  const uid = await authorize(request, input);
  const accountId = await requireStudentItemAccount(request);
  return submitAnswer(uid, accountId, input);
});

export const expireBattlePhase = onCall(options, async (request) => {
  const input = expire(request.data);
  const uid = await authorize(request, input);
  return expirePhase(uid, input);
});

export const useBattleItem = onCall(options, async (request) => {
  const input = useItem(request.data);
  const uid = await authorize(request, input);
  const accountId = await requireStudentItemAccount(request);
  return useBattleItemService(uid, accountId, input);
});
