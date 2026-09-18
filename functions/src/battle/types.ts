export interface BattleInput {
  readonly roomId: string;
  readonly roundId: string;
}

export interface BattleGenerationInput extends BattleInput {
  readonly generation: number;
}

export interface BattleIssueInput extends BattleGenerationInput {
  readonly itemId: string;
  readonly side: "source" | "meaning";
}

export interface BattleSubmitInput extends BattleGenerationInput {
  readonly submissionId: string;
  readonly answer: string;
}

export interface BattleExpireInput extends BattleGenerationInput {
  readonly deadlineAtMs: number;
}

export interface BattleUseItemInput extends BattleGenerationInput {
  readonly operationId: string;
  readonly itemId: "ink";
}

export interface BattleProfile {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: unknown;
}

export interface BattleItem {
  readonly id: string;
  readonly source: string;
  readonly meaning: string;
}

export interface StoredBattleMatch {
  readonly memberIds: readonly string[];
  readonly memberProfiles: readonly BattleProfile[];
  readonly hearts: Readonly<Record<string, number>>;
  readonly usedItemIds: readonly string[];
  readonly itemCount: number;
  readonly questionNumber: number;
  readonly attackerIndex: number;
  readonly defenderIndex: number;
  readonly generation: number;
  readonly phase: "choosing" | "answering" | "grading";
  readonly deadlineAtMs: number | null;
  readonly selectedItemId: string | null;
  readonly selectedSide: "source" | "meaning" | null;
  readonly prompt: string | null;
  readonly expectedAnswer: string | null;
  readonly gradingSubmissionId: string | null;
  readonly eventRevision: number;
  readonly rewardItemId: "ink" | null;
  readonly inkBlockedUntilAtMs: Readonly<Record<string, number>>;
}
