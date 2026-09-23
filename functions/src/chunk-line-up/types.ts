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

export type ChunkLineUpElevatorId = "left" | "right";
export type ChunkLineUpElevatorPhase = "open" | "closing" | "moving" | "opening";

export interface ChunkLineUpElevatorRider {
  readonly playerId: string;
  readonly destinationFloor: number | null;
}

export interface ChunkLineUpElevatorCarState {
  readonly id: ChunkLineUpElevatorId;
  readonly phase: ChunkLineUpElevatorPhase;
  readonly floor: number;
  readonly targetFloor: number | null;
  readonly phaseStartedAtMs: number;
  readonly seats: readonly ChunkLineUpElevatorRider[];
  readonly queue: readonly number[];
}

export interface ChunkLineUpElevatorState {
  readonly revision: number;
  readonly lobbyFloor: number;
  readonly left: ChunkLineUpElevatorCarState;
  readonly right: ChunkLineUpElevatorCarState;
}

export interface ChunkLineUpElevatorBoardInput extends ChunkLineUpBaseInput {
  readonly elevatorId: ChunkLineUpElevatorId;
  readonly floor: number;
}

export interface ChunkLineUpElevatorDestinationInput extends ChunkLineUpBaseInput {
  readonly elevatorId: ChunkLineUpElevatorId;
  readonly destinationFloor: number;
  readonly destinationGroupId: string;
}

export interface ChunkLineUpElevatorRideInput extends ChunkLineUpBaseInput {
  readonly elevatorId: ChunkLineUpElevatorId;
  readonly floor: number;
  readonly destinationFloor: number;
  readonly destinationGroupId: string;
}

export interface ChunkLineUpElevatorResult {
  readonly accepted: boolean;
  readonly state: ChunkLineUpElevatorState;
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
