export interface ChunkLineUpSourceGroup {
  readonly id: string;
  readonly prompt: string;
  readonly slots: readonly string[];
}

export interface ChunkLineUpSlot {
  readonly id: string;
  readonly text: string;
  readonly fixed: boolean;
  readonly filledBy: string | null;
  readonly filledLabel: string | null;
}

export interface ChunkLineUpGroup {
  readonly id: string;
  readonly sourceId: string;
  readonly prompt: string;
  readonly slots: readonly ChunkLineUpSlot[];
}

export interface ChunkLineUpAssignment {
  readonly playerId: string;
  readonly label: string;
  readonly token: string;
  readonly targetGroupId: string;
  readonly targetSlotId: string;
  readonly score: number;
  readonly recentGroupId: string | null;
}

export interface ChunkLineUpBoard {
  readonly revision: number;
  readonly groups: readonly ChunkLineUpGroup[];
  readonly assignments: Readonly<Record<string, ChunkLineUpAssignment>>;
  readonly completedGroupCount: number;
}

export interface ChunkLineUpServerState {
  readonly sourceGroups: readonly ChunkLineUpSourceGroup[];
  readonly nextSourceIndex: number;
  readonly nextGroupSequence: number;
  readonly endsAtMs: number;
  readonly board: ChunkLineUpBoard;
}

export interface ChunkLineUpBaseInput {
  readonly roomId: string;
  readonly roundId: string;
}

export interface ChunkLineUpElevatorState {
  readonly cycle: number;
  readonly seats: readonly string[];
}

export interface ChunkLineUpElevatorResult extends ChunkLineUpElevatorState {
  readonly accepted: boolean;
}

export interface ChunkLineUpConfirmInput extends ChunkLineUpBaseInput {
  readonly operationId: string;
  readonly revision: number;
  readonly groupId: string;
  readonly slotId: string;
}

export type ChunkLineUpActionResult =
  | {
      readonly accepted: true;
      readonly revision: number;
      readonly score: number;
      readonly completedGroup: boolean;
    }
  | {
      readonly accepted: false;
      readonly revision: number;
      readonly reason: "wrong" | "stale" | "expired";
    };
