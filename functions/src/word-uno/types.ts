export type WordUnoStage = 1 | 2 | 3;

export interface WordUnoFamilyInput {
  readonly sourceText: string;
  readonly form2: string;
  readonly form3: string;
  readonly meaning: string;
}

export interface WordUnoFamily {
  readonly familyId: string;
  readonly forms: readonly [string, string, string];
  readonly meaning: string;
}

export interface WordUnoWordCard {
  readonly id: string;
  readonly kind: "word";
  readonly text: string;
  readonly meaning: string;
  readonly familyId: string;
  readonly familyForms: readonly [string, string, string];
  readonly stage: WordUnoStage;
}

export interface WordUnoActionCard {
  readonly id: string;
  readonly kind: "skip" | "draw-two" | "wild";
}

export type WordUnoCard = WordUnoWordCard | WordUnoActionCard;

export interface WordUnoMemberProfile {
  readonly playerId: string;
  readonly nickname: string;
}

export interface WordUnoMemberView {
  readonly playerId: string;
  readonly nickname: string;
  readonly handCount: number;
  readonly rank: number | null;
}

export type WordUnoAssignmentStatus = "active" | "finished" | "completed" | "waiting";

export interface WordUnoAssignment {
  readonly playerId: string;
  readonly groupId: string | null;
  readonly groupLabel: string | null;
  readonly status: WordUnoAssignmentStatus;
  readonly generation: number;
  readonly revision: number;
  readonly hand: readonly WordUnoCard[];
  readonly members: readonly WordUnoMemberView[];
  readonly topCard: WordUnoCard | null;
  readonly activeStage: WordUnoStage | null;
  readonly activeFamilyId: string | null;
  readonly activeFamilyForms: readonly [string, string, string] | null;
  readonly currentPlayerId: string | null;
  readonly turnDeadlineAtMs: number | null;
  readonly endsAtMs: number | null;
  readonly rank: number | null;
}

export interface WordUnoGroupState {
  readonly groupId: string;
  readonly groupLabel: string;
  readonly memberIds: readonly string[];
  readonly memberProfiles: readonly WordUnoMemberProfile[];
  readonly status: "active" | "completed";
  readonly generation: number;
  readonly revision: number;
  readonly hands: Readonly<Record<string, readonly WordUnoCard[]>>;
  readonly drawPile: readonly WordUnoCard[];
  readonly discardPile: readonly WordUnoCard[];
  readonly activeStage: WordUnoStage;
  readonly activeFamilyId: string;
  readonly currentPlayerId: string | null;
  readonly turnDeadlineAtMs: number | null;
  readonly endsAtMs: number;
  readonly ranks: Readonly<Record<string, number | null>>;
}

export interface WordUnoBaseInput {
  readonly roomId: string;
  readonly roundId: string;
}

export interface WordUnoPlayInput extends WordUnoBaseInput {
  readonly operationId: string;
  readonly revision: number;
  readonly cardId: string;
  readonly wildStage?: WordUnoStage;
}

export interface WordUnoDrawInput extends WordUnoBaseInput {
  readonly operationId: string;
  readonly revision: number;
}

export interface WordUnoExpireTurnInput extends WordUnoBaseInput {
  readonly revision: number;
  readonly deadlineAtMs: number;
}

export interface WordUnoActionResult {
  readonly accepted: boolean;
  readonly revision: number;
  readonly completed: boolean;
  readonly rank: number | null;
}
