import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import { pokemonCatchDemoSet } from "./demoSet.ts";

function configuredSetId(session: ActiveGameSession): string | null {
  const value = session.gameConfig?.setId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function usePokemonCatchSet(session: ActiveGameSession): {
  readonly set: LearningSet | null;
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const inlineSet = session.gameConfig?.set;
  const setId = inlineSet ? null : configuredSetId(session);
  const remote = useLearningSet(setId, session.roundId);
  return {
    set: (inlineSet as LearningSet | undefined) ?? remote.set ?? (setId ? null : pokemonCatchDemoSet),
    loading: Boolean(setId) && remote.loading,
    error: remote.error,
  };
}

