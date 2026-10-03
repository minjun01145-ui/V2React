import { useMemo } from "react";
import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import { buildLearningTower } from "./model.ts";

export function useLearningTower(session: ActiveGameSession) {
  const setId = session.gameConfig?.setId;
  const learningSet = useLearningSet(typeof setId === "string" && setId.trim() ? setId.trim() : null, session.roundId);
  const direction = session.gameConfig?.direction === "meaning-to-source" ? "meaning-to-source" : "source-to-meaning";
  const prepared = useMemo(() => {
    if (!learningSet.set) return { tower: null, error: null };
    try {
      return { tower: buildLearningTower(learningSet.set, direction, session.roundId), error: null };
    } catch (reason) {
      return { tower: null, error: reason instanceof Error ? reason : new Error("학습 점프타워를 준비하지 못했습니다.") };
    }
  }, [learningSet.set, direction, session.roundId]);
  return { ...prepared, loading: learningSet.loading, error: learningSet.error ?? prepared.error };
}
