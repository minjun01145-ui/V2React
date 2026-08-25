import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import {
  MULTIPLAYER_TEST_STUDENTS,
  type MultiplayerTestSessionResult,
  type MultiplayerTestStudentCredential,
} from "./types.js";

const TEST_RUN_COLLECTION = "multiplayerTestRuns";
const SESSION_COLLECTION = "multiplayerSessions";
const TEST_SESSION_LIFETIME_MS = 60 * 60 * 1000;

interface StoredTestRun {
  readonly runId: string;
  readonly roomId: string;
  readonly studentUids: readonly string[];
}

function parseStoredTestRun(value: unknown): StoredTestRun | null {
  if (!isRecord(value)) return null;
  const runId = typeof value.runId === "string" ? value.runId : "";
  const roomId = typeof value.roomId === "string" ? value.roomId : "";
  const studentUids = Array.isArray(value.studentUids)
    ? value.studentUids.filter((uid): uid is string => typeof uid === "string" && Boolean(uid))
    : [];
  return runId && roomId ? { runId, roomId, studentUids } : null;
}

async function deleteAuthUsers(uids: readonly string[]): Promise<void> {
  if (uids.length === 0) return;
  await adminAuth.deleteUsers([...uids]);
}

async function deleteStoredRun(run: StoredTestRun): Promise<void> {
  await Promise.all([
    db.recursiveDelete(db.collection(SESSION_COLLECTION).doc(run.roomId)),
    deleteAuthUsers(run.studentUids),
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

  for (const student of MULTIPLAYER_TEST_STUDENTS) {
    const uid = `test-${runId}-${student.slot}`;
    const customToken = await adminAuth.createCustomToken(uid, {
      role: "test-student",
      testRoomId: roomId,
      testOwnerUid: adminUid,
      studentNumber: student.studentNumber,
      displayName: student.displayName,
    });
    students.push({ ...student, uid, customToken });
  }

  const now = Date.now();
  const studentUids = students.map((student) => student.uid);
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
    studentUids,
    expiresAtMs,
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
  });
  await batch.commit();

  return { runId, roomId, expiresAtMs, students };
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
