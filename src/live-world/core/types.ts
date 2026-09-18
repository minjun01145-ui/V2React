export interface LiveMovementState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface LiveMovementUpdate {
  readonly sequence: number;
  readonly state: LiveMovementState;
}

export interface LiveMovementSnapshot extends LiveMovementUpdate {
  readonly playerId: string;
  readonly sentAtMs: number;
}

export interface LiveRemoteFrame extends LiveMovementState {
  readonly playerId: string;
  readonly sequence: number;
}

export interface LiveWorldScope {
  readonly roomId: string;
  readonly roundId: string;
  readonly channelId: string;
}
