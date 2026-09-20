export type WordUnoStage = 1 | 2 | 3;

export interface WordUnoWordCard {
  readonly id: string;
  readonly kind: "word";
  readonly text: string;
  readonly meaning: string;
  readonly familyId: string;
  readonly stage: WordUnoStage;
  readonly familyForms?: readonly [string, string, string];
}

export interface WordUnoActionCard {
  readonly id: string;
  readonly kind: "skip" | "draw-two" | "wild";
}

export type WordUnoCard = WordUnoWordCard | WordUnoActionCard;

export interface WordUnoMember {
  readonly playerId: string;
  readonly nickname: string;
  readonly handCount: number;
  readonly rank: number | null;
}

export interface WordUnoAssignment {
  readonly playerId: string;
  readonly groupId: string | null;
  readonly groupLabel: string | null;
  readonly status: "active" | "finished" | "completed" | "waiting";
  readonly generation: number;
  readonly revision: number;
  readonly hand: readonly WordUnoCard[];
  readonly members: readonly WordUnoMember[];
  readonly topCard: WordUnoCard | null;
  readonly activeStage: WordUnoStage | null;
  readonly activeFamilyId: string | null;
  readonly activeFamilyForms: readonly [string, string, string] | null;
  readonly currentPlayerId: string | null;
  readonly turnDeadlineAtMs: number | null;
  readonly endsAtMs: number | null;
  readonly rank: number | null;
}

export interface PlayWordUnoCardInput {
  readonly roomId: string;
  readonly roundId: string;
  readonly operationId: string;
  readonly revision: number;
  readonly cardId: string;
  readonly wildStage?: WordUnoStage;
}

export interface DrawWordUnoCardInput {
  readonly roomId: string;
  readonly roundId: string;
  readonly operationId: string;
  readonly revision: number;
}

export interface ExpireWordUnoTurnInput {
  readonly roomId: string;
  readonly roundId: string;
  readonly revision: number;
  readonly deadlineAtMs: number;
}
