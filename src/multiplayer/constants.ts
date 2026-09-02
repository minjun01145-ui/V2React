export const SESSION_STATUS = {
  WAITING: "waiting",
  PREPARING: "preparing",
  PLAYING: "playing",
  FINISHED: "finished",
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export function canStartSession(status: SessionStatus): boolean {
  return status === SESSION_STATUS.WAITING;
}

export const MULTIPLAYER_COLLECTION = "multiplayerSessions";
export const ROUND_START_COUNTDOWN_MS = 3_000;
