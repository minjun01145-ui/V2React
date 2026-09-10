import { useEffect, useState } from "react";
import { ensureCooperativeRound, refreshCooperativeMatch, subscribeCooperativeAssignment, subscribeCooperativeTeams } from "./repository.ts";
import type { CooperativeAssignment, CooperativeTeam } from "./types.ts";

export function useCooperativeAssignment(roomId: string, roundId: string, playerId: string, matchingEnabled = true) {
  const [value, setValue] = useState<CooperativeAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void ensureCooperativeRound(roomId, roundId).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error("조 편성에 실패했습니다.")); });
    const unsubscribe = subscribeCooperativeAssignment(roomId, roundId, playerId, (next) => { if (active) { setValue(next); setLoading(false); } }, (reason) => { if (active) { setError(reason); setLoading(false); } });
    return () => { active = false; unsubscribe(); };
  }, [playerId, roomId, roundId]);
  useEffect(() => {
    if (value?.status !== "searching" || !matchingEnabled) return undefined;
    const refresh = (): void => { void refreshCooperativeMatch(roomId, roundId).catch(console.error); };
    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, [matchingEnabled, roomId, roundId, value?.status]);
  return { value, loading: loading && !error, error };
}

export function useCooperativeTeams(roomId: string, roundId: string) {
  const [value, setValue] = useState<CooperativeTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    void ensureCooperativeRound(roomId, roundId).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error("조 편성에 실패했습니다.")); });
    const unsubscribe = subscribeCooperativeTeams(roomId, roundId, (next) => { if (active) { setValue(next); setLoading(false); } }, (reason) => { if (active) { setError(reason); setLoading(false); } });
    return () => { active = false; unsubscribe(); };
  }, [roomId, roundId]);
  return { value, loading, error };
}
