import { httpsCallable } from "firebase/functions";
import type { JoinedMultiplayerTestStudent, MultiplayerTestStudentCredential } from "../classroom-test/types.ts";
import { functions } from "../firebase/firebaseClient.ts";

interface JoinInput {
  readonly runId: string;
  readonly roomId: string;
  readonly slot: number;
  readonly joinSecret: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJoinedStudent(value: unknown): JoinedMultiplayerTestStudent {
  if (!isRecord(value)) throw new Error("테스트 학생 인증 응답이 올바르지 않습니다.");
  const slot = typeof value.slot === "number" ? value.slot : 0;
  const uid = typeof value.uid === "string" ? value.uid : "";
  const studentNumber = typeof value.studentNumber === "string" ? value.studentNumber : "";
  const displayName = typeof value.displayName === "string" ? value.displayName : "";
  if (!slot || !uid || !studentNumber || !displayName) throw new Error("테스트 학생 인증 정보를 확인하지 못했습니다.");
  return { slot, uid, studentNumber, displayName };
}

export async function joinMultiplayerTestSession(
  runId: string,
  roomId: string,
  student: MultiplayerTestStudentCredential,
): Promise<JoinedMultiplayerTestStudent> {
  const callable = httpsCallable<JoinInput, unknown>(functions, "joinMultiplayerTestSession");
  const response = await callable({ runId, roomId, slot: student.slot, joinSecret: student.joinSecret });
  return parseJoinedStudent(response.data);
}
