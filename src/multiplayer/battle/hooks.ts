import { useEffect, useState } from "react";
import { ensureBattleRound, subscribeBattleAssignment, subscribeBattleStandings } from "./repository.ts";
import type { BattleAssignment, BattleStanding } from "./types.ts";

export function useBattleAssignment(roomId: string, roundId: string, playerId: string) {
  const [value, setValue] = useState<BattleAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void ensureBattleRound(roomId, roundId).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error("배틀 준비에 실패했습니다.")); });
    const unsubscribe = subscribeBattleAssignment(roomId, roundId, playerId, (next) => { if (active) { setValue(next); setLoading(false); } }, (reason) => { if (active) { setError(reason); setLoading(false); } });
    return () => { active = false; unsubscribe(); };
  }, [playerId, roomId, roundId]);
  return { value, loading: loading && !error, error };
}

export function useBattleStandings(roomId: string, roundId: string) {
  const [value, setValue] = useState<BattleStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    void ensureBattleRound(roomId, roundId).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error("배틀 준비에 실패했습니다.")); });
    const unsubscribe = subscribeBattleStandings(roomId, roundId, (next) => { if (active) { setValue(next); setLoading(false); } }, (reason) => { if (active) { setError(reason); setLoading(false); } });
    return () => { active = false; unsubscribe(); };
  }, [roomId, roundId]);
  return { value, loading, error };
}
