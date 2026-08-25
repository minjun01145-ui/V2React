import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../shared/auth.js";
import { isRecord } from "../shared/validation.js";
import { createMultiplayerTestRun, stopMultiplayerTestRun } from "./service.js";

const callableOptions = { region: "asia-northeast3", enforceAppCheck: false } as const;

function parseRunId(value: unknown): string {
  const runId = isRecord(value) && typeof value.runId === "string" ? value.runId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new HttpsError("invalid-argument", "테스트 실행 ID가 올바르지 않습니다.");
  return runId;
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
