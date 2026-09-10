import { useEffect, useState } from "react";
import { getLearningSet } from "../../learning-sets/readRepository.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";

export function useCooperativeSentenceSet(session: ActiveGameSession) {
  const setId = typeof session.gameConfig?.setId === "string" ? session.gameConfig.setId : "";
  const [state, setState] = useState<{ readonly set: unknown | null; readonly error: Error | null; readonly loading: boolean }>({ set: null, error: null, loading: true });
  useEffect(() => {
    let active = true;
    setState({ set: null, error: null, loading: true });
    if (!setId) { setState({ set: null, error: new Error("선택된 끊어읽기 세트가 없습니다."), loading: false }); return () => { active = false; }; }
    void getLearningSet(setId, session.roundId).then((set) => { if (active) setState({ set, error: null, loading: false }); }).catch((reason: unknown) => { if (active) setState({ set: null, error: reason instanceof Error ? reason : new Error("세트를 불러오지 못했습니다."), loading: false }); });
    return () => { active = false; };
  }, [session.roundId, setId]);
  return state;
}
