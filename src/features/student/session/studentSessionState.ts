import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import type { GameSession, Player } from "../../../multiplayer/types.ts";

export type StudentSessionState =
  | { readonly view: "loading" }
  | { readonly view: "session-error"; readonly error: Error }
  | { readonly view: "player-error"; readonly error: Error }
  | { readonly view: "join-error"; readonly error: Error }
  | { readonly view: "heartbeat-error"; readonly error: Error }
  | { readonly view: "waiting-for-session" }
  | { readonly view: "awaiting-nickname" }
  | { readonly view: "joining" }
  | { readonly view: "playing"; readonly session: GameSession; readonly player: Player }
  | { readonly view: "lobby"; readonly session: GameSession; readonly player: Player };

export type StudentStatusState = Exclude<StudentSessionState, { readonly view: "playing" | "lobby" }>;

export interface StudentSessionSnapshot {
  readonly session: GameSession | null;
  readonly player: Player | null;
  readonly sessionLoading: boolean;
  readonly playerLoading: boolean;
  readonly joining: boolean;
  readonly sessionError: Error | null;
  readonly playerError: Error | null;
  readonly joinError: Error | null;
  readonly heartbeatError: Error | null;
}

export function resolveStudentSessionState(snapshot: StudentSessionSnapshot): StudentSessionState {
  if (snapshot.sessionLoading || snapshot.playerLoading || snapshot.joining) return { view: "loading" };
  if (snapshot.sessionError) return { view: "session-error", error: snapshot.sessionError };
  if (snapshot.playerError) return { view: "player-error", error: snapshot.playerError };
  if (snapshot.joinError) return { view: "join-error", error: snapshot.joinError };
  if (!snapshot.session) return { view: "waiting-for-session" };
  if (!snapshot.player && snapshot.session.status === SESSION_STATUS.PLAYING) return { view: "joining" };
  if (!snapshot.player) return { view: "awaiting-nickname" };
  if (snapshot.session.status === SESSION_STATUS.PLAYING) {
    return { view: "playing", session: snapshot.session, player: snapshot.player };
  }
  if (snapshot.heartbeatError) return { view: "heartbeat-error", error: snapshot.heartbeatError };
  return { view: "lobby", session: snapshot.session, player: snapshot.player };
}
