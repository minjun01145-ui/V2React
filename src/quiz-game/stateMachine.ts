import type { QuizGamePhase } from "./types.ts";

const allowedTransitions: Readonly<Record<QuizGamePhase, readonly QuizGamePhase[]>> = Object.freeze({
  answering: ["submissions"],
  submissions: ["leaderboard"],
  leaderboard: ["answering", "complete"],
  complete: [],
});

export function canTransitionQuizGamePhase(from: QuizGamePhase, to: QuizGamePhase): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertQuizGamePhaseTransition(from: QuizGamePhase, to: QuizGamePhase): void {
  if (!canTransitionQuizGamePhase(from, to)) throw new Error(`허용되지 않은 퀴즈 단계 전환입니다: ${from} → ${to}`);
}
