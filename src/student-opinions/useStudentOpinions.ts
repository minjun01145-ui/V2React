import { useEffect, useState } from "react";
import type { StudentOpinion } from "./model.ts";
import { subscribeOpinions } from "./repository.ts";

export function useStudentOpinions(roomId: string): { readonly opinions: readonly StudentOpinion[]; readonly loading: boolean; readonly error: Error | null } {
  const [state, setState] = useState<{ opinions: readonly StudentOpinion[]; loading: boolean; error: Error | null }>({ opinions: [], loading: true, error: null });
  useEffect(() => {
    setState({ opinions: [], loading: true, error: null });
    return subscribeOpinions(roomId, (opinions) => setState({ opinions, loading: false, error: null }), (error) => setState((current) => ({ ...current, loading: false, error })));
  }, [roomId]);
  return state;
}
