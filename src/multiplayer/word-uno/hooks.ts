import { useEffect, useState } from "react";
import {
  ensureWordUnoRound,
  subscribeWordUnoAssignment,
  subscribeWordUnoAssignments,
} from "./repository.ts";
import type { WordUnoAssignment } from "./types.ts";

export function useWordUnoAssignment(roomId: string, roundId: string, playerId: string) {
  const [value, setValue] = useState<WordUnoAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ensureWordUnoRound(roomId, roundId).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason : new Error("Word UNO 준비에 실패했습니다."));
    });
    const unsubscribe = subscribeWordUnoAssignment(
      roomId,
      roundId,
      playerId,
      (next) => { if (active) { setValue(next); setLoading(false); } },
      (reason) => { if (active) { setError(reason); setLoading(false); } },
    );
    return () => { active = false; unsubscribe(); };
  }, [playerId, roomId, roundId]);

  return { value, loading: loading && !error, error };
}

export function useWordUnoAssignments(roomId: string, roundId: string) {
  const [value, setValue] = useState<WordUnoAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ensureWordUnoRound(roomId, roundId).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason : new Error("Word UNO 준비에 실패했습니다."));
    });
    const unsubscribe = subscribeWordUnoAssignments(
      roomId,
      roundId,
      (next) => { if (active) { setValue(next); setLoading(false); } },
      (reason) => { if (active) { setError(reason); setLoading(false); } },
    );
    return () => { active = false; unsubscribe(); };
  }, [roomId, roundId]);

  return { value, loading: loading && !error, error };
}
