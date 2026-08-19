import type { SessionStatus } from "./constants.ts";

export interface Player {
  readonly id: string;
  readonly playerId: string;
  readonly studentNumber: string;
  readonly displayName: string;
  readonly state: SessionStatus;
  readonly joinedAtMs: number;
  readonly lastSeenAtMs: number;
}

export interface GameSession {
  readonly id: string;
  readonly roomId: string;
  readonly gameId: string;
  readonly status: SessionStatus;
  readonly roundId: string | null;
  readonly gameConfig: Readonly<Record<string, unknown>> | null;
  readonly createdAtMs: number | null;
  readonly updatedAtMs: number | null;
  readonly startedAtMs: number | null;
}

export type ActiveGameSession = GameSession & {
  readonly status: "playing";
  readonly roundId: string;
};

export type GameRole = "student" | "teacher";

export interface JoinSessionInput {
  readonly roomId: string;
  readonly playerId: string;
  readonly studentNumber: string;
  readonly displayName: string;
}

export interface StartSessionOptions {
  readonly gameId?: string;
  readonly gameConfig?: Readonly<Record<string, unknown>>;
}
