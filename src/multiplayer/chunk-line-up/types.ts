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
  readonly score: number;
}

export interface ChunkLineUpBoard {
  readonly revision: number;
  readonly groups: readonly ChunkLineUpGroup[];
  readonly assignments: Readonly<Record<string, ChunkLineUpAssignment>>;
  readonly completedGroupCount: number;
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

export interface ChunkLineUpElevatorResult {
  readonly accepted: boolean;
  readonly state: ChunkLineUpElevatorState;
}

export interface ChunkLineUpElevatorRideInfo {
  readonly elevatorId: ChunkLineUpElevatorId;
  readonly currentFloor: number;
  readonly destinationFloor: number | null;
}

export interface ConfirmChunkLineUpSlotInput {
  readonly roomId: string;
  readonly roundId: string;
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
