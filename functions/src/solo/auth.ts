import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { requireAnonymous, requireRegularStudent } from "../shared/auth.js";
import { db } from "../shared/firebase.js";
import { isRecord, normalizePersonName } from "../shared/validation.js";
import { effectiveTenantId, type TenantId } from "../shared/tenant.js";

const TEST_RUN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SoloStudent {
  readonly uid: string;
  readonly tenantId: TenantId;
  readonly studentNumber: string;
  readonly studentAccountId: string;
  readonly displayName: string;
  readonly isTestStudent: boolean;
}

export async function requireSoloStudent(request: CallableRequest<unknown>): Promise<SoloStudent> {
  const uid = requireAnonymous(request);
  const token = request.auth?.token;
  if (token?.role === "student") return { ...await requireRegularStudent(request), isTestStudent: false };
  if (token?.role !== "test-student") throw new HttpsError("permission-denied", "학생 인증 정보를 확인할 수 없습니다.");

  const studentNumber = typeof token.studentNumber === "string" ? token.studentNumber : "";
  const displayName = typeof token.displayName === "string" ? normalizePersonName(token.displayName) : "";
  const roomId = typeof token.testRoomId === "string" ? token.testRoomId : "";
  const ownerUid = typeof token.testOwnerUid === "string" ? token.testOwnerUid : "";
  if (!/^[0-9]{1,12}$/.test(studentNumber) || !displayName || displayName.length > 30
    || !roomId.startsWith("test-") || !TEST_RUN_UUID.test(roomId.slice("test-".length)) || !ownerUid) {
    throw new HttpsError("permission-denied", "학생 인증 정보를 확인할 수 없습니다.");
  }

  const tenantId = effectiveTenantId(token.tenantId);
  const sessionRef = db.collection("multiplayerSessions").doc(roomId);
  const testRunRef = db.collection("multiplayerTestRuns").doc(ownerUid);
  const playerRef = sessionRef.collection("players").doc(uid);
  const [sessionSnapshot, testRunSnapshot, playerSnapshot] = await Promise.all([
    sessionRef.get(),
    testRunRef.get(),
    playerRef.get(),
  ]);
  const session: unknown = sessionSnapshot.exists ? sessionSnapshot.data() : null;
  const testRun: unknown = testRunSnapshot.exists ? testRunSnapshot.data() : null;
  const player: unknown = playerSnapshot.exists ? playerSnapshot.data() : null;
  const expiresAtMs = isRecord(session) && typeof session.expiresAtMs === "number" ? session.expiresAtMs : 0;
  const runExpiresAtMs = isRecord(testRun) && typeof testRun.expiresAtMs === "number" ? testRun.expiresAtMs : 0;
  const runId = isRecord(session) && typeof session.testRunId === "string" ? session.testRunId : "";
  const storedStudents = isRecord(testRun) && Array.isArray(testRun.students) ? testRun.students : [];
  const matchingStudents = storedStudents.filter((candidate) => isRecord(candidate)
    && candidate.uid === uid
    && candidate.studentNumber === studentNumber
    && normalizePersonName(candidate.displayName) === displayName);

  if (!Number.isSafeInteger(expiresAtMs) || !Number.isSafeInteger(runExpiresAtMs)
    || !isRecord(session) || session.roomId !== roomId || session.isTestSession !== true
    || session.testOwnerUid !== ownerUid || effectiveTenantId(session.tenantId) !== tenantId
    || !TEST_RUN_UUID.test(runId) || expiresAtMs <= Date.now()
    || !isRecord(testRun) || testRun.runId !== runId || testRun.roomId !== roomId
    || runExpiresAtMs <= Date.now() || matchingStudents.length !== 1
    || !isRecord(player) || player.playerId !== uid || player.studentNumber !== studentNumber
    || normalizePersonName(player.displayName) !== displayName) {
    throw new HttpsError("permission-denied", "학생 인증 정보를 확인할 수 없습니다.");
  }

  return { uid, tenantId, studentNumber, studentAccountId: `test-${uid}`, displayName, isTestStudent: true };
}
