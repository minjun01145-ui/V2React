import { HttpsError } from "firebase-functions/v2/https";
import { isRecord } from "../shared/validation.js";
import { resolveSessionStartedAtMs } from "../shared/sessionTime.js";

function id(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^[\p{L}\p{N}._-]{1,128}$/u.test(text)) throw new HttpsError("invalid-argument", "답안 요청 ID가 올바르지 않습니다.");
  return text;
}

export function parseFreeResponseScope(value: unknown): { readonly roomId: string; readonly roundId: string } {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "답안 요청 형식이 올바르지 않습니다.");
  return { roomId: id(value.roomId), roundId: id(value.roundId) };
}

export function parseSubmissionInput(value: unknown) {
  const scope = parseFreeResponseScope(value);
  const answer = isRecord(value) && typeof value.answer === "string" ? value.answer.trim() : "";
  if (!answer || answer.length > 2000) throw new HttpsError("invalid-argument", "답안은 1~2000자로 입력해 주세요.");
  return { ...scope, answer };
}

export function parseAwardInput(value: unknown) {
  const scope = parseFreeResponseScope(value);
  return { ...scope, playerId: id(isRecord(value) ? value.playerId : null) };
}

export interface FreeResponseRound {
  readonly prompt: string;
  readonly phase: "answering" | "submissions" | "results";
  readonly startedAtMs: number;
  readonly durationMs: number;
}

/** Free response runs as a slide-show engine; the session's active engine holds its prompt and time. */
export function parseFreeResponseRound(value: unknown, roundId: string): FreeResponseRound {
  const slideShow = isRecord(value) ? value.slideShow : null;
  const engine = isRecord(slideShow) ? slideShow.engine : null;
  if (!isRecord(value) || value.status !== "playing" || value.roundId !== roundId || value.gameId !== "free-response"
    || !isRecord(engine) || engine.roundId !== roundId) {
    throw new HttpsError("failed-precondition", "현재 진행 중인 자유 답변 문제를 확인해 주세요.");
  }
  const round = engine.round;
  const phase = engine.phase;
  if (!isRecord(round) || round.gameId !== "free-response" || !isRecord(round.source) || round.source.kind !== "free-response"
    || typeof round.source.prompt !== "string" || !round.source.prompt.trim() || round.source.prompt.length > 1000
    || typeof round.durationSeconds !== "number" || !Number.isInteger(round.durationSeconds) || round.durationSeconds < 10 || round.durationSeconds > 600
    || (phase !== "answering" && phase !== "submissions" && phase !== "results")) {
    throw new HttpsError("failed-precondition", "자유 답변 문제 설정을 확인해 주세요.");
  }
  const startedAtMs = resolveSessionStartedAtMs(value.startedAt, value.startedAtMs, value.startDelayMs);
  if (startedAtMs === null) throw new HttpsError("failed-precondition", "답안 제출이 아직 시작되지 않았습니다.");
  return { prompt: round.source.prompt.trim(), phase, startedAtMs, durationMs: round.durationSeconds * 1000 };
}
