import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { SoloRun } from "../contracts.ts";
import { loadSoloRunProgress, persistSoloRunProgress } from "../persistence/repository.ts";

export function useSoloRunProgress<TDetails>(run: SoloRun, itemCount: number) {
  const scope = `${run.tenantId}:${run.runId}`;
  const [stored, setStored] = useState<{ readonly scope: string; readonly value: unknown; readonly loading: boolean; readonly error: Error | null }>(
    () => ({ scope, value: null, loading: true, error: null }),
  );

  useEffect(() => {
    let active = true;
    setStored({ scope, value: null, loading: true, error: null });
    void loadSoloRunProgress(run)
      .then((value) => { if (active) setStored({ scope, value, loading: false, error: null }); })
      .catch((reason: unknown) => {
        if (!active) return;
        setStored({ scope, value: null, loading: false, error: reason instanceof Error ? reason : new Error("Solo 진행 상황을 불러오지 못했습니다.") });
      });
    return () => { active = false; };
  }, [run, scope]);

  const current = stored.scope === scope ? stored : { scope, value: null, loading: true, error: null };
  const progress = useMemo(() => normalizeProgress<TDetails>(current.value, itemCount), [current.value, itemCount]);
  const adopt = useCallback((value: GameProgress<TDetails>): void => {
    setStored((currentValue) => currentValue.scope === scope
      ? { ...currentValue, value, loading: false }
      : currentValue);
  }, [scope]);
  const persist = useCallback(async (value: GameProgress<TDetails>): Promise<GameProgress<TDetails>> => {
    await persistSoloRunProgress(run, value);
    adopt(value);
    return value;
  }, [adopt, run]);

  return { progress, loading: current.loading, error: current.error, adopt, persist } as const;
}
