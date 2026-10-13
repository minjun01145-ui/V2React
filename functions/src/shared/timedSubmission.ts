import { HttpsError } from "firebase-functions/v2/https";
import { isRecord } from "./validation.js";

function id(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^[\p{L}\p{N}._-]{1,128}$/u.test(text)) throw new HttpsError("invalid-argument", "답안 요청 ID가 올바르지 않습니다.");
  return text;
}

export function parseSubmissionScope(value: unknown): { readonly roomId: string; readonly roundId: string } {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "답안 요청 형식이 올바르지 않습니다.");
  return { roomId: id(value.roomId), roundId: id(value.roundId) };
}

export function assertSubmissionOpen(round: { readonly phase: string; readonly startedAtMs: number; readonly durationMs: number }, nowMs: number): void {
  if (round.phase !== "answering" || nowMs >= round.startedAtMs + round.durationMs) throw new HttpsError("failed-precondition", "답안 제출이 마감되었습니다.");
  if (nowMs < round.startedAtMs) throw new HttpsError("failed-precondition", "답안 제출이 아직 시작되지 않았습니다.");
}
