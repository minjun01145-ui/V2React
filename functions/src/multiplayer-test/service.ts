import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import {
  MULTIPLAYER_TEST_STUDENTS,
  type JoinedMultiplayerTestStudent,
  type MultiplayerTestSessionResult,
  type MultiplayerTestStudentCredential,
} from "./types.js";

const TEST_RUN_COLLECTION = "multiplayerTestRuns";
const SESSION_COLLECTION = "multiplayerSessions";
const TEST_SESSION_LIFETIME_MS = 60 * 60 * 1000;

interface StoredTestRun {
  readonly runId: string;
  readonly roomId: string;
  readonly expiresAtMs: number;
  readonly students: readonly StoredTestStudent[];
}

interface StoredTestStudent {
  readonly slot: number;
  readonly studentNumber: string;
  readonly displayName: string;
  readonly secretHash: string;
  readonly uid: string | null;
}

function parseStoredTestRun(value: unknown): StoredTestRun | null {
  if (!isRecord(value)) return null;
  const runId = typeof value.runId === "string" ? value.runId : "";
  const roomId = typeof value.roomId === "string" ? value.roomId : "";
  const expiresAtMs = typeof value.expiresAtMs === "number" ? value.expiresAtMs : 0;
  const students = Array.isArray(value.students)
    ? value.students.map(parseStoredTestStudent).filter((student): student is StoredTestStudent => student !== null)
    : [];
  return runId && roomId && expiresAtMs && students.length === MULTIPLAYER_TEST_STUDENTS.length
    ? { runId, roomId, expiresAtMs, students }
    : null;
}

function parseStoredTestStudent(value: unknown): StoredTestStudent | null {
  if (!isRecord(value)) return null;
  const slot = typeof value.slot === "number" && Number.isInteger(value.slot) ? value.slot : 0;
  const studentNumber = typeof value.studentNumber === "string" ? value.studentNumber : "";
  const displayName = typeof value.displayName === "string" ? value.displayName : "";
  const secretHash = typeof value.secretHash === "string" ? value.secretHash : "";
  const uid = typeof value.uid === "string" && value.uid ? value.uid : null;
  return slot && studentNumber && displayName && secretHash ? { slot, studentNumber, displayName, secretHash, uid } : null;
}

function hashJoinSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function secretsMatch(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashJoinSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function deleteAuthUsers(uids: readonly string[]): Promise<void> {
  if (uids.length === 0) return;
  await adminAuth.deleteUsers([...uids]);
}

async function deleteStudentGameData(uids: readonly string[]): Promise<void> {
  await Promise.all(uids.map((uid) => db.recursiveDelete(db.collection("studentGameData").doc(`test-${uid}`))));
}

async function deleteStoredRun(run: StoredTestRun): Promise<void> {
  const studentUids = run.students.flatMap((student) => student.uid ? [student.uid] : []);
  await Promise.all([
    db.recursiveDelete(db.collection(SESSION_COLLECTION).doc(run.roomId)),
    deleteStudentGameData(studentUids).then(() => deleteAuthUsers(studentUids)),
  ]);
}

async function loadActiveRun(adminUid: string): Promise<StoredTestRun | null> {
  const snapshot = await db.collection(TEST_RUN_COLLECTION).doc(adminUid).get();
  return snapshot.exists ? parseStoredTestRun(snapshot.data()) : null;
}

export async function createMultiplayerTestRun(adminUid: string): Promise<MultiplayerTestSessionResult> {
  const previous = await loadActiveRun(adminUid);
  if (previous) await deleteStoredRun(previous);

  const runId = randomUUID();
  const roomId = `test-${runId}`;
  const expiresAtMs = Date.now() + TEST_SESSION_LIFETIME_MS;
  const students: MultiplayerTestStudentCredential[] = [];
  const storedStudents: StoredTestStudent[] = [];

  for (const student of MULTIPLAYER_TEST_STUDENTS) {
    const joinSecret = randomBytes(32).toString("base64url");
    students.push({ ...student, joinSecret });
    storedStudents.push({ ...student, secretHash: hashJoinSecret(joinSecret), uid: null });
  }

  const now = Date.now();
  const batch = db.batch();
  batch.set(db.collection(SESSION_COLLECTION).doc(roomId), {
    roomId,
    gameId: "sentence-builder",
    status: "waiting",
    roundId: null,
    isTestSession: true,
    testOwnerUid: adminUid,
    testRunId: runId,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
    expiresAtMs,
    expiresAt: Timestamp.fromMillis(expiresAtMs),
  });
  batch.set(db.collection(TEST_RUN_COLLECTION).doc(adminUid), {
    runId,
    roomId,
    students: storedStudents,
    expiresAtMs,
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
  });
  await batch.commit();

  return { runId, roomId, expiresAtMs, students };
}

export async function joinMultiplayerTestRun(
  uid: string,
  runId: string,
  roomId: string,
  slot: number,
  joinSecret: string,
): Promise<JoinedMultiplayerTestStudent> {
  const sessionRef = db.collection(SESSION_COLLECTION).doc(roomId);
  const initialSession = await sessionRef.get();
  const initialData: unknown = initialSession.exists ? initialSession.data() : null;
  const ownerUid = isRecord(initialData) && typeof initialData.testOwnerUid === "string" ? initialData.testOwnerUid : "";
  if (!ownerUid) throw new Error("유효한 테스트 방이 아닙니다.");
  const runRef = db.collection(TEST_RUN_COLLECTION).doc(ownerUid);
  const student = await db.runTransaction(async (tx) => {
    const [sessionSnapshot, runSnapshot] = await Promise.all([
      tx.get(sessionRef),
      tx.get(runRef),
    ]);
    const sessionData: unknown = sessionSnapshot.exists ? sessionSnapshot.data() : null;
    const run = runSnapshot.exists ? parseStoredTestRun(runSnapshot.data()) : null;
    if (!isRecord(sessionData) || sessionData.isTestSession !== true || sessionData.testRunId !== runId
        || !run || run.runId !== runId || run.roomId !== roomId || run.expiresAtMs <= Date.now()) {
      throw new Error("유효한 테스트 실행이 아닙니다.");
    }
    const selected = run.students.find((item) => item.slot === slot);
    if (!selected || !secretsMatch(joinSecret, selected.secretHash) || (selected.uid && selected.uid !== uid)) {
      throw new Error("테스트 학생 참가 정보가 올바르지 않습니다.");
    }
    tx.update(runRef, {
      students: run.students.map((item) => item.slot === slot ? { ...item, uid } : item),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
    });
    return selected;
  });

  await adminAuth.setCustomUserClaims(uid, {
    role: "test-student",
    testRoomId: roomId,
    testOwnerUid: ownerUid,
    studentNumber: student.studentNumber,
    displayName: student.displayName,
  });
  return { slot: student.slot, uid, studentNumber: student.studentNumber, displayName: student.displayName };
}

export async function stopMultiplayerTestRun(adminUid: string, requestedRunId: string): Promise<void> {
  const runRef = db.collection(TEST_RUN_COLLECTION).doc(adminUid);
  const current = await loadActiveRun(adminUid);
  if (!current || current.runId !== requestedRunId) return;
  await deleteStoredRun(current);
  const latest = await runRef.get();
  const latestRun = latest.exists ? parseStoredTestRun(latest.data()) : null;
  if (latestRun?.runId === requestedRunId) await runRef.delete();
}
