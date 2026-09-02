import { useEffect, useState } from "react";
import { getLearningSet } from "./readRepository.ts";
import type { LearningSet } from "./types.ts";

interface LearningSetState {
  readonly set: LearningSet | null;
  readonly loading: boolean;
  readonly error: Error | null;
}

export function useLearningSet(setId: string | null, reloadKey = ""): LearningSetState {
  const [state, setState] = useState<LearningSetState>({ set: null, loading: Boolean(setId), error: null });

  useEffect(() => {
    let active = true;
    if (!setId) {
      setState({ set: null, loading: false, error: null });
      return () => { active = false; };
    }
    setState({ set: null, loading: true, error: null });
    void getLearningSet(setId, reloadKey || "default")
      .then((set) => { if (active) setState({ set, loading: false, error: null }); })
      .catch((value: unknown) => { if (active) setState({ set: null, loading: false, error: value instanceof Error ? value : new Error("학습 세트를 불러오지 못했습니다.") }); });
    return () => { active = false; };
  }, [reloadKey, setId]);

  return state;
}
