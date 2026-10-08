import { useEffect, useState } from "react";
import type { ClassroomNotice } from "./model.ts";
import { subscribeNotice } from "./repository.ts";

export function useClassroomNotice(roomId: string): { readonly notice: ClassroomNotice | null; readonly loading: boolean; readonly error: Error | null } {
  const [state, setState] = useState<{ notice: ClassroomNotice | null; loading: boolean; error: Error | null }>({ notice: null, loading: true, error: null });
  useEffect(() => {
    setState({ notice: null, loading: true, error: null });
    return subscribeNotice(roomId, (notice) => setState({ notice, loading: false, error: null }), (error) => setState((current) => ({ ...current, loading: false, error })));
  }, [roomId]);
  return state;
}
