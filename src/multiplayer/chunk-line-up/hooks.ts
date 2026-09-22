import { useEffect, useState } from "react";
import { ensureChunkLineUpRound, subscribeChunkLineUpBoard, subscribeChunkLineUpElevator } from "./repository.ts";
import type { ChunkLineUpBoard, ChunkLineUpElevatorState } from "./types.ts";

export function useChunkLineUpBoard(roomId: string, roundId: string, initialize = false): {
  readonly value: ChunkLineUpBoard | null;
  readonly loading: boolean;
  readonly error: Error | null;
} {
  const [value, setValue] = useState<ChunkLineUpBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    let hasBoard = false;
    setValue(null);
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeChunkLineUpBoard(
      roomId,
      roundId,
      (next) => {
        if (!active) return;
        if (next) {
          hasBoard = true;
          setValue(next);
          setError(null);
          setLoading(false);
        }
      },
      (reason) => {
        if (!active) return;
        setError(reason);
        setLoading(false);
      },
    );
    if (initialize) {
      void ensureChunkLineUpRound(roomId, roundId).catch((reason: unknown) => {
        if (!active || hasBoard) return;
        setError(reason instanceof Error ? reason : new Error("Chunk Line-Up 준비에 실패했습니다."));
        setLoading(false);
      });
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [initialize, roomId, roundId]);

  return { value, loading, error };
}

export function useChunkLineUpElevator(roomId: string, roundId: string): {
  readonly value: ChunkLineUpElevatorState | null;
  readonly error: Error | null;
} {
  const [value, setValue] = useState<ChunkLineUpElevatorState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    setValue(null);
    setError(null);
    return subscribeChunkLineUpElevator(roomId, roundId, setValue, setError);
  }, [roomId, roundId]);
  return { value, error };
}
