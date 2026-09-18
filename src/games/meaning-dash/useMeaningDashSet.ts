import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";

function configuredSetId(session: ActiveGameSession): string | null {
  const value = session.gameConfig?.setId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function useMeaningDashSet(session: ActiveGameSession) {
  return useLearningSet(configuredSetId(session), session.roundId);
}
