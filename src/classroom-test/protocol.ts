import type { MultiplayerTestStudentCredential, TestStudentClientStatus } from "./types.ts";

export interface TestStudentBootstrapMessage {
  readonly type: "classroom-test/bootstrap";
  readonly roomId: string;
  readonly student: MultiplayerTestStudentCredential;
}

export interface TestStudentReadyMessage {
  readonly type: "classroom-test/ready";
  readonly slot: number;
}

export interface TestStudentStatusMessage {
  readonly type: "classroom-test/status";
  readonly slot: number;
  readonly status: Exclude<TestStudentClientStatus, "loading">;
  readonly message: string;
}

export type TestStudentToParentMessage = TestStudentReadyMessage | TestStudentStatusMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSlot(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3;
}

export function createTestStudentBootstrapMessage(
  roomId: string,
  student: MultiplayerTestStudentCredential,
): TestStudentBootstrapMessage {
  return { type: "classroom-test/bootstrap", roomId, student };
}

export function parseTestStudentBootstrapMessage(value: unknown): TestStudentBootstrapMessage | null {
  if (!isRecord(value) || value.type !== "classroom-test/bootstrap" || typeof value.roomId !== "string" || !isRecord(value.student)) return null;
  const student = value.student;
  if (!isSlot(student.slot) || typeof student.uid !== "string" || typeof student.studentNumber !== "string"
      || typeof student.displayName !== "string" || typeof student.customToken !== "string") return null;
  return {
    type: "classroom-test/bootstrap",
    roomId: value.roomId,
    student: {
      slot: student.slot,
      uid: student.uid,
      studentNumber: student.studentNumber,
      displayName: student.displayName,
      customToken: student.customToken,
    },
  };
}

export function parseTestStudentToParentMessage(value: unknown): TestStudentToParentMessage | null {
  if (!isRecord(value) || !isSlot(value.slot)) return null;
  if (value.type === "classroom-test/ready") return { type: value.type, slot: value.slot };
  if (value.type !== "classroom-test/status" || typeof value.message !== "string") return null;
  if (value.status !== "connecting" && value.status !== "connected" && value.status !== "error" && value.status !== "left") return null;
  return { type: value.type, slot: value.slot, status: value.status, message: value.message };
}

export function createTestStudentStatusMessage(
  slot: number,
  status: Exclude<TestStudentClientStatus, "loading">,
  message: string,
): TestStudentStatusMessage {
  return { type: "classroom-test/status", slot, status, message };
}
