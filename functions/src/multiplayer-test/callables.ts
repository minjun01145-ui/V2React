import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin, requireAnonymous } from "../shared/auth.js";
import { isRecord } from "../shared/validation.js";
import { createMultiplayerTestRun, joinMultiplayerTestRun, stopMultiplayerTestRun } from "./service.js";

const callableOptions = { region: "asia-northeast3", enforceAppCheck: false } as const;

function parseRunId(value: unknown): string {
  const runId = isRecord(value) && typeof value.runId === "string" ? value.runId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new HttpsError("invalid-argument", "테스트 실행 ID가 올바르지 않습니다.");
  return runId;
}

function parseJoinInput(value: unknown): { readonly runId: string; readonly roomId: string; readonly slot: number; readonly joinSecret: string } {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "테스트 학생 참가 정보가 없습니다.");
  const runId = parseRunId(value);
  const roomId = typeof value.roomId === "string" ? value.roomId.trim() : "";
  const slot = typeof value.slot === "number" && Number.isInteger(value.slot) ? value.slot : 0;
  const joinSecret = typeof value.joinSecret === "string" ? value.joinSecret : "";
  if (!/^test-[0-9a-f-]{36}$/i.test(roomId) || slot < 1 || slot > 3 || !/^[A-Za-z0-9_-]{40,60}$/.test(joinSecret)) {
    throw new HttpsError("invalid-argument", "테스트 학생 참가 정보가 올바르지 않습니다.");
  }
  return { runId, roomId, slot, joinSecret };
}

export const createMultiplayerTestSession = onCall(callableOptions, async (request) => {
  const adminUid = await requireAdmin(request);
  return createMultiplayerTestRun(adminUid);
});

export const stopMultiplayerTestSession = onCall(callableOptions, async (request) => {
  const adminUid = await requireAdmin(request);
  await stopMultiplayerTestRun(adminUid, parseRunId(request.data));
  return { ok: true } as const;
});

export const joinMultiplayerTestSession = onCall(callableOptions, async (request) => {
  const uid = requireAnonymous(request);
  const input = parseJoinInput(request.data);
  try {
    return await joinMultiplayerTestRun(uid, input.runId, input.roomId, input.slot, input.joinSecret);
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("permission-denied", error instanceof Error ? error.message : "테스트 학생으로 참가할 수 없습니다.");
  }
});
