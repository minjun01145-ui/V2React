import { useSessionSubscription } from "../../multiplayer/hooks.ts";
import type { JumpRace } from "./model.ts";
import { subscribeJumpRace } from "./repository.ts";

/** The jump race running in this slide show run, if any. */
export function useJumpRace(roomId: string, showRunId: string): JumpRace | null {
  const { value } = useSessionSubscription(roomId, subscribeJumpRace);
  return value && value.showRunId === showRunId ? value : null;
}
