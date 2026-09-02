export interface AppConfig {
  readonly defaultRoomId: string;
  readonly defaultGameId: string;
  readonly playerHeartbeatMs: number;
  readonly playerStaleAfterMs: number;
  readonly adminAuthEmail: string;
}

export const appConfig = Object.freeze({
  defaultRoomId: import.meta.env.VITE_DEFAULT_ROOM_ID || "main-class",
  defaultGameId: "sentence-builder",
  playerHeartbeatMs: 10_000,
  playerStaleAfterMs: 30_000,
  adminAuthEmail: String(import.meta.env.VITE_ADMIN_AUTH_EMAIL || "").trim(),
} satisfies AppConfig);
