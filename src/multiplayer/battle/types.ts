import type { PlayerAvatar } from "../types.ts";

export type BattlePhase = "choosing" | "answering" | "grading";
export type BattleRole = "attacker" | "defender" | "waiting";

export interface BattleProfile {
  readonly nickname: string;
  readonly avatar: PlayerAvatar | null;
}

export interface BattleResult {
  readonly outcome: "knockout" | "draw" | "joint-win";
  readonly players: readonly BattleProfile[];
  readonly headline: string;
}

export interface BattleAssignment {
  readonly playerId: string;
  readonly matchId: string | null;
  readonly status: "active" | "searching" | "completed";
  readonly phase: BattlePhase | null;
  readonly role: BattleRole;
  readonly hearts: number;
  readonly kills: number;
  readonly deaths: number;
  readonly itemCount: number;
  readonly questionNumber: number;
  readonly turnLimit: number;
  readonly usedItemIds: readonly string[];
  readonly generation: number;
  readonly deadlineAtMs: number | null;
  readonly prompt: string | null;
  readonly selectedItemId: string | null;
  readonly selectedSide: "source" | "meaning" | null;
  readonly eventRevision: number;
  readonly eventType: "question-issued" | "correct" | "wrong" | "timeout" | "ink-used" | null;
  readonly eventWasMine: boolean;
  readonly eventRewardItemId: "ink" | null;
  readonly rewardAvailable: boolean;
  readonly inkBlockedUntilAtMs: number | null;
  readonly searchStartedAtMs: number | null;
  readonly resultUntilAtMs: number | null;
  readonly result: BattleResult | null;
}

export interface BattleStanding {
  readonly id: string;
  readonly nickname: string;
  readonly avatar: PlayerAvatar | null;
  readonly kills: number;
  readonly deaths: number;
  readonly status: "active" | "searching" | "completed";
}

export interface BattleActionResult {
  readonly accepted: boolean;
}
