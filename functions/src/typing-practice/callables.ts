import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireRoomStudent } from "../shared/auth.js";
import { db } from "../shared/firebase.js";
import { effectiveTenantId, tenantAccountId } from "../shared/tenant.js";
import { isRecord } from "../shared/validation.js";
import { classroomLabel, practiceMonth, rankPracticeRecords, type PracticeRecord } from "./model.js";

// Like live typing metrics, speeds are measured by the client. Identity, month,
// publication scope and deduplication are controlled here.
export const completeTypingPractice = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  const data: unknown = request.data;
  if (!isRecord(data) || typeof data.roomId !== "string" || !/^[\w-]{1,128}$/.test(data.roomId)
    || typeof data.runId !== "string" || !/^[\w-]{8,128}$/.test(data.runId)
    || ![data.averageCpm, data.bestCpm].every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 10000)
    || typeof data.completedCount !== "number" || !Number.isInteger(data.completedCount) || data.completedCount < 1
    || data.completedCount !== data.questionCount) {
    throw new HttpsError("invalid-argument", "완주 기록을 확인해주세요.");
  }
  const uid = await requireRoomStudent(request, data.roomId);
  const token = request.auth!.token;
  if (token.role !== "student" || typeof token.studentNumber !== "string") {
    throw new HttpsError("permission-denied", "학생 계정으로 기록할 수 있습니다.");
  }
  const tenantId = effectiveTenantId(token.tenantId);
  const profile = await db.collection("studentProfiles").doc(uid).get();
  if (profile.data()?.studentNumber !== token.studentNumber || effectiveTenantId(profile.data()?.tenantId) !== tenantId) {
    throw new HttpsError("permission-denied", "학생 계정 정보가 일치하지 않습니다.");
  }
  const player = await db.collection("multiplayerSessions").doc(data.roomId).collection("players").doc(uid).get();
  const nickname = player.data()?.nickname || player.data()?.displayName || "학생";
  const accountId = tenantAccountId(tenantId, token.studentNumber);
  const completedAt = Date.now();
  const month = practiceMonth(completedAt);
  const result: PracticeRecord = {
    accountId, nickname: String(nickname).slice(0, 40), classroom: classroomLabel(token.studentNumber),
    averageCpm: data.averageCpm as number, bestCpm: data.bestCpm as number, completedAt,
  };
  const operation = db.collection("studentGameData").doc(accountId).collection("typingPracticeRuns").doc(data.runId);
  const board = db.collection("typingPracticeMonths").doc(`${tenantId}-${month}`);
  const saved = await db.runTransaction(async (tx) => {
    const previous = await tx.get(operation);
    if (previous.exists) return previous.data()!;
    const snapshot = await tx.get(board);
    const records = rankPracticeRecords((snapshot.data()?.records ?? []) as PracticeRecord[], result);
    const response = {
      month,
      result: publicRecord(result),
      records: records.map(publicRecord),
    };
    tx.set(board, { records });
    tx.create(operation, response);
    return response;
  });
  return saved;
});

function publicRecord({ accountId: _accountId, ...record }: PracticeRecord) {
  return record;
}
