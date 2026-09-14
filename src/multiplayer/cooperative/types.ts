import type { PlayerAvatar } from "../types.ts";

export type CooperativeAssignmentStatus = "active" | "searching" | "completed";

export interface RevealedPartner {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: PlayerAvatar | null;
}

export interface CooperativeAssignment {
  readonly playerId: string;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly status: CooperativeAssignmentStatus;
  readonly hearts: number;
  readonly currentQuestionIndex: number;
  readonly questionCount: number;
  readonly isMyTurn: boolean;
  readonly generation: number;
  readonly searchStartedAtMs: number | null;
  readonly revealedPartners: readonly RevealedPartner[];
  readonly hardMode: boolean;
  readonly hardModeRevision: number;
  readonly turnDeadlineAtMs: number | null;
}

export interface CooperativeRoundState {
  readonly hardMode: boolean;
  readonly hardModeRevision: number;
}

export interface CooperativeTeam {
  readonly id: string;
  readonly name: string;
  readonly status: "active" | "completed" | "eliminated";
  readonly hearts: number;
  readonly currentQuestionIndex: number;
  readonly questionCount: number;
  readonly memberCount: number;
  readonly updatedAtMs: number;
}

export interface CooperativeSubmitResult {
  readonly isCorrect: boolean;
  readonly eliminated: boolean;
  readonly completed: boolean;
  readonly timedOut: boolean;
}

export interface CooperativeExpireResult {
  readonly applied: boolean;
  readonly eliminated: boolean;
}
