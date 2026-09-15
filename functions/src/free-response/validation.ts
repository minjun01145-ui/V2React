import { HttpsError } from "firebase-functions/v2/https";
import { isRecord } from "../shared/validation.js";

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
  readonly phase: "answering" | "submissions" | "leaderboard" | "complete";
  readonly startedAtMs: number;
  readonly durationMs: number;
}

export function parseFreeResponseRound(value: unknown, roundId: string): FreeResponseRound {
  if (!isRecord(value) || value.status !== "playing" || value.roundId !== roundId || value.gameId !== "free-response"
    || !isRecord(value.quizGame) || !isRecord(value.quizGame.plan) || !Array.isArray(value.quizGame.plan.rounds)
    || typeof value.quizGame.currentRoundIndex !== "number" || !Number.isInteger(value.quizGame.currentRoundIndex)) {
    throw new HttpsError("failed-precondition", "현재 진행 중인 자유 답안 라운드를 확인해 주세요.");
  }
  const round: unknown = value.quizGame.plan.rounds[value.quizGame.currentRoundIndex];
  const phase = value.quizGame.phase;
  if (!isRecord(round) || round.gameId !== "free-response" || !isRecord(round.source) || round.source.kind !== "free-response"
    || typeof round.source.prompt !== "string" || !round.source.prompt.trim() || round.source.prompt.length > 1000
    || typeof round.durationSeconds !== "number" || !Number.isInteger(round.durationSeconds) || round.durationSeconds < 10 || round.durationSeconds > 600
    || (phase !== "answering" && phase !== "submissions" && phase !== "leaderboard" && phase !== "complete")) {
    throw new HttpsError("failed-precondition", "자유 답안 라운드 설정을 확인해 주세요.");
  }
  // 서버 타임스탬프와 시작 지연은 학생 화면의 시작 시각과 동일하게 해석한다.
  const timestamp = value.startedAt;
  const hasTimestamp = isRecord(timestamp) && typeof timestamp.toMillis === "function";
  const start: unknown = isRecord(timestamp) && typeof timestamp.toMillis === "function" ? timestamp.toMillis() : value.startedAtMs;
  const delay = typeof value.startDelayMs === "number" && Number.isFinite(value.startDelayMs) && value.startDelayMs >= 0 ? value.startDelayMs : 0;
  if (typeof start !== "number" || !Number.isFinite(start)) throw new HttpsError("failed-precondition", "답안 제출이 아직 시작되지 않았습니다.");
  return { prompt: round.source.prompt.trim(), phase, startedAtMs: start + (hasTimestamp ? delay : 0), durationMs: round.durationSeconds * 1000 };
}
