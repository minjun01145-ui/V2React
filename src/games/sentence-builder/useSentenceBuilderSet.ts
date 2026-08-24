import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import { sentenceBuilderDemoSet } from "./demoSet.ts";

function configuredSetId(session: ActiveGameSession): string | null {
  const value = session.gameConfig?.setId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function useSentenceBuilderSet(session: ActiveGameSession): {
  readonly set: unknown;
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const inlineSet = session.gameConfig?.set;
  const setId = inlineSet ? null : configuredSetId(session);
  const remote = useLearningSet(setId, session.roundId);
  return {
    set: inlineSet ?? remote.set ?? (setId ? null : sentenceBuilderDemoSet),
    loading: Boolean(setId) && remote.loading,
    error: remote.error,
  };
}
