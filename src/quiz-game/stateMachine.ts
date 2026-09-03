import type { QuizGamePhase, QuizGamePlan, QuizGameRound, QuizGameSessionState } from "./types.ts";

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

export function createQuizGameSessionState(plan: QuizGamePlan, roundId: string): QuizGameSessionState {
  if (!plan.rounds[0]) throw new Error("시작할 퀴즈 라운드가 없습니다.");
  return { plan, currentRoundIndex: 0, phase: "answering", roundIds: [roundId] };
}

export function advanceQuizGameRound(state: QuizGameSessionState, roundId: string): {
  readonly round: QuizGameRound;
  readonly state: QuizGameSessionState;
} {
  assertQuizGamePhaseTransition(state.phase, "answering");
  const currentRoundIndex = state.currentRoundIndex + 1;
  const round = state.plan.rounds[currentRoundIndex];
  if (!round) throw new Error("진행할 다음 퀴즈 라운드가 없습니다.");
  return {
    round,
    state: { ...state, currentRoundIndex, phase: "answering", roundIds: [...state.roundIds, roundId] },
  };
}

export function completeQuizGame(state: QuizGameSessionState): QuizGameSessionState {
  assertQuizGamePhaseTransition(state.phase, "complete");
  return { ...state, phase: "complete" };
}
