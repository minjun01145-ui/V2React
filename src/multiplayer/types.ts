import type { SessionStatus } from "./constants.ts";

export interface Player {
  readonly id: string;
  readonly playerId: string;
  readonly studentNumber: string;
  readonly displayName: string;
  readonly nickname: string | null;
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
  readonly nickname: string | null;
}

/** 대기실·게임에 표시할 이름. 임시 닉네임이 있으면 닉네임, 없으면 본명. */
export function displayLabel(displayName: string, nickname: string | null | undefined): string {
  const trimmed = (nickname ?? "").trim();
  return trimmed || displayName;
}

export interface StartSessionOptions {
  readonly gameId?: string;
  readonly gameConfig?: Readonly<Record<string, unknown>>;
}
