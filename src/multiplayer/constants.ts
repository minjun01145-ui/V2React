export const SESSION_STATUS = {
  WAITING: "waiting",
  PLAYING: "playing",
  FINISHED: "finished",
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
export const MULTIPLAYER_COLLECTION = "multiplayerSessions";
