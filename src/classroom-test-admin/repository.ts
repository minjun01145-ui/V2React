import { httpsCallable } from "firebase/functions";
import type { MultiplayerTestSession, MultiplayerTestStudentCredential } from "../classroom-test/types.ts";
import { functions } from "../firebase/firebaseClient.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStudent(value: unknown): MultiplayerTestStudentCredential | null {
  if (!isRecord(value)) return null;
  const slot = typeof value.slot === "number" && Number.isInteger(value.slot) ? value.slot : 0;
  const uid = typeof value.uid === "string" ? value.uid : "";
  const studentNumber = typeof value.studentNumber === "string" ? value.studentNumber : "";
  const displayName = typeof value.displayName === "string" ? value.displayName : "";
  const customToken = typeof value.customToken === "string" ? value.customToken : "";
  return slot > 0 && uid && studentNumber && displayName && customToken
    ? { slot, uid, studentNumber, displayName, customToken }
    : null;
}

function parseSession(value: unknown): MultiplayerTestSession {
  if (!isRecord(value) || !Array.isArray(value.students)) throw new Error("테스트 세션 응답 형식이 올바르지 않습니다.");
  const runId = typeof value.runId === "string" ? value.runId : "";
  const roomId = typeof value.roomId === "string" ? value.roomId : "";
  const expiresAtMs = typeof value.expiresAtMs === "number" ? value.expiresAtMs : 0;
  const students = value.students.map(parseStudent).filter((student): student is MultiplayerTestStudentCredential => student !== null);
  if (!runId || !roomId || !expiresAtMs || students.length !== 3) throw new Error("테스트 학생 세션을 준비하지 못했습니다.");
  return { runId, roomId, expiresAtMs, students };
}

export async function createMultiplayerTestSession(): Promise<MultiplayerTestSession> {
  const callable = httpsCallable<Record<string, never>, unknown>(functions, "createMultiplayerTestSession");
  const response = await callable({});
  return parseSession(response.data);
}

export async function stopMultiplayerTestSession(runId: string): Promise<void> {
  const callable = httpsCallable<{ readonly runId: string }, { readonly ok: boolean }>(functions, "stopMultiplayerTestSession");
  await callable({ runId });
}
