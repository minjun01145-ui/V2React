import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import type { LearningSet } from "../../learning-sets/types.ts";

function configuredSetId(session: ActiveGameSession): string | null {
  const value = session.gameConfig?.setId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function useAiTutorSet(session: ActiveGameSession) {
  const inlineSet = session.gameConfig?.set;
  const setId = inlineSet ? null : configuredSetId(session);
  const remote = useLearningSet(setId, session.roundId);
  return {
    set: (inlineSet as LearningSet | undefined) ?? remote.set,
    loading: Boolean(setId) && remote.loading,
    error: inlineSet || setId ? remote.error : new Error("AI 문답에는 학습 세트 또는 직접 출제 문항이 필요합니다."),
  };
}
