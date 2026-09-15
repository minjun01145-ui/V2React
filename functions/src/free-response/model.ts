import { HttpsError } from "firebase-functions/v2/https";
import type { FreeResponseRound } from "./validation.js";

export const FREE_RESPONSE_AWARD_POINTS = 100;

export function assertSubmissionOpen(round: FreeResponseRound, nowMs: number): void {
  if (round.phase !== "answering" || nowMs >= round.startedAtMs + round.durationMs) throw new HttpsError("failed-precondition", "답안 제출이 마감되었습니다.");
  if (nowMs < round.startedAtMs) throw new HttpsError("failed-precondition", "답안 제출이 아직 시작되지 않았습니다.");
}

export function assertAwardOpen(round: FreeResponseRound): void {
  if (round.phase !== "submissions") throw new HttpsError("failed-precondition", "답안 제출 마감 후 현황판에서 점수를 부여해 주세요.");
}

export function freeResponseProgress(playerId: string, displayName: string, score: 0 | 100, submittedAtMs: number, revision: number, nowMs: number) {
  return {
    gameId: "free-response", playerId, displayName,
    currentIndex: 1, score, correctCount: score === FREE_RESPONSE_AWARD_POINTS ? 1 : 0, attemptCount: 1, combo: 0,
    completedQuestionIds: ["free-response"], lastResult: null, completedAtMs: submittedAtMs,
    revision, updatedAtMs: nowMs,
  };
}
