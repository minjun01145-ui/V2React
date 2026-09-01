import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import type { RoundParticipant } from "../../../multiplayer/round-participants/model.ts";
import type { GameSession, Player } from "../../../multiplayer/types.ts";

export type StudentSessionState =
  | { readonly view: "loading" }
  | { readonly view: "session-error"; readonly error: Error }
  | { readonly view: "player-error"; readonly error: Error }
  | { readonly view: "participant-error"; readonly error: Error }
  | { readonly view: "readiness-error"; readonly error: Error }
  | { readonly view: "join-error"; readonly error: Error }
  | { readonly view: "heartbeat-error"; readonly error: Error }
  | { readonly view: "waiting-for-session" }
  | { readonly view: "awaiting-nickname" }
  | { readonly view: "joining" }
  | { readonly view: "preparing" }
  | { readonly view: "playing"; readonly session: GameSession; readonly player: Player }
  | { readonly view: "lobby"; readonly session: GameSession; readonly player: Player };

export type StudentStatusState = Exclude<StudentSessionState, { readonly view: "playing" | "lobby" }>;

export interface StudentSessionSnapshot {
  readonly session: GameSession | null;
  readonly player: Player | null;
  readonly participant: RoundParticipant | null;
  readonly sessionLoading: boolean;
  readonly playerLoading: boolean;
  readonly participantLoading: boolean;
  readonly joining: boolean;
  readonly sessionError: Error | null;
  readonly playerError: Error | null;
  readonly participantError: Error | null;
  readonly readinessError: Error | null;
  readonly joinError: Error | null;
  readonly heartbeatError: Error | null;
}

export type PlayingParticipationDecision = "not-playing" | "waiting" | "ensure" | "ready";

export function resolvePlayingParticipation(snapshot: Pick<
  StudentSessionSnapshot,
  "session" | "player" | "participant" | "participantLoading"
>): PlayingParticipationDecision {
  if (snapshot.session?.status !== SESSION_STATUS.PLAYING) return "not-playing";
  if (!snapshot.session.roundId || snapshot.participantLoading) return "waiting";
  return snapshot.player && snapshot.participant?.playerId === snapshot.player.id ? "ready" : "ensure";
}

export function resolveStudentSessionState(snapshot: StudentSessionSnapshot): StudentSessionState {
  if (snapshot.sessionLoading || snapshot.playerLoading) return { view: "loading" };
  if (snapshot.sessionError) return { view: "session-error", error: snapshot.sessionError };
  if (snapshot.playerError) return { view: "player-error", error: snapshot.playerError };
  if (!snapshot.session) return { view: "waiting-for-session" };

  if (snapshot.session.status === SESSION_STATUS.PREPARING) {
    if (snapshot.participantError) return { view: "participant-error", error: snapshot.participantError };
    if (snapshot.readinessError) return { view: "readiness-error", error: snapshot.readinessError };
    return { view: "preparing" };
  }

  const playingParticipation = resolvePlayingParticipation(snapshot);
  if (playingParticipation !== "not-playing") {
    if (playingParticipation === "ready" && snapshot.player) {
      return { view: "playing", session: snapshot.session, player: snapshot.player };
    }
    if (snapshot.joinError) return { view: "join-error", error: snapshot.joinError };
    if (snapshot.participantError) return { view: "participant-error", error: snapshot.participantError };
    return { view: "joining" };
  }

  if (snapshot.player) {
    if (snapshot.heartbeatError) return { view: "heartbeat-error", error: snapshot.heartbeatError };
    return { view: "lobby", session: snapshot.session, player: snapshot.player };
  }
  if (snapshot.joining) return { view: "loading" };
  if (snapshot.joinError) return { view: "join-error", error: snapshot.joinError };
  return { view: "awaiting-nickname" };
}
