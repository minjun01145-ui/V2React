import type { Player } from "../types.ts";

export interface RoundParticipant {
  readonly id: string;
  readonly playerId: string;
  readonly studentNumber: string;
  readonly displayName: string;
  readonly nickname: string | null;
  readonly joinedAtMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function participantIdentity(player: Player): Omit<RoundParticipant, "id" | "joinedAtMs"> {
  return {
    playerId: player.id,
    studentNumber: player.studentNumber,
    displayName: player.displayName,
    nickname: player.nickname,
  };
}

export function parseRoundParticipant(id: string, value: unknown): RoundParticipant | null {
  if (!isRecord(value)) return null;
  const playerId = typeof value.playerId === "string" ? value.playerId : "";
  const studentNumber = typeof value.studentNumber === "string" ? value.studentNumber.trim() : "";
  const displayName = typeof value.displayName === "string" ? value.displayName.trim() : "";
  const nickname = typeof value.nickname === "string" && value.nickname.trim() ? value.nickname.trim() : null;
  const joinedAtMs = typeof value.joinedAtMs === "number" && Number.isFinite(value.joinedAtMs) ? value.joinedAtMs : 0;
  return playerId === id && studentNumber && displayName
    ? { id, playerId, studentNumber, displayName, nickname, joinedAtMs }
    : null;
}
