import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";

function configuredSetId(session: ActiveGameSession): string | null {
  const value = session.gameConfig?.setId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function useAiTutorSet(session: ActiveGameSession) {
  const setId = configuredSetId(session);
  const remote = useLearningSet(setId, session.roundId);
  return {
    set: remote.set,
    loading: Boolean(setId) && remote.loading,
    error: setId ? remote.error : new Error("AI 문답에는 저장된 학습 세트를 선택해야 합니다."),
  };
}

