import type { LobbyGathering } from "../../../multiplayer/lobbyGathering.ts";

export type LobbyActivity = "solo" | "drawing" | "sentence" | "acid-rain" | "platformer" | "deathmatch" | null;

export interface LobbyActivityState {
  readonly activity: LobbyActivity;
  readonly gatheringRunId: string | null;
  readonly gatheringActive: boolean;
}

export function synchronizeLobbyActivity(state: LobbyActivityState, gathering: LobbyGathering | null | undefined): LobbyActivityState {
  const runId = gathering?.runId ?? null;
  const active = gathering?.active ?? false;
  const changed = state.gatheringRunId !== runId || state.gatheringActive !== active;
  const activity = active ? "platformer" : changed ? null : state.activity;
  if (!changed && activity === state.activity) return state;
  return { activity, gatheringRunId: runId, gatheringActive: active };
}
