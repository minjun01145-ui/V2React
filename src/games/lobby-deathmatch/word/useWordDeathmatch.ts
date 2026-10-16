import { useEffect, useMemo, useRef, useState } from "react";
import { useLearningSet } from "../../../learning-sets/useLearningSet.ts";
import { subscribeLiveServerTimeOffset } from "../../../live-world/client.ts";
import type { ActiveGameSession } from "../../../multiplayer/types.ts";
import { buildWordQuiz, roundAt, type WordQuiz, type WordRound } from "./model.ts";

export interface PreparedWordQuiz {
  readonly quiz: WordQuiz | null;
  readonly loading: boolean;
  readonly error: Error | null;
}

export function useWordQuiz(session: ActiveGameSession): PreparedWordQuiz {
  const setId = session.gameConfig?.setId;
  const learningSet = useLearningSet(typeof setId === "string" && setId.trim() ? setId.trim() : null, session.roundId);
  const direction = session.gameConfig?.direction === "meaning-to-source" ? "meaning-to-source" : "source-to-meaning";
  const prepared = useMemo(() => {
    if (!learningSet.set) return { quiz: null, error: null };
    try {
      return { quiz: buildWordQuiz(learningSet.set, direction, session.roundId), error: null };
    } catch (reason) {
      return { quiz: null, error: reason instanceof Error ? reason : new Error("단어 데스매치를 준비하지 못했습니다.") };
    }
  }, [learningSet.set, direction, session.roundId]);
  return { quiz: prepared.quiz, loading: learningSet.loading, error: learningSet.error ?? prepared.error };
}

export interface WordRoundClock {
  readonly round: WordRound | null;
  /** Server-aligned clock, shared with the scene so the HUD and the judging never disagree. */
  readonly nowMs: () => number;
}

export function useWordRoundClock(startedAtMs: number | null, endsAtMs: number | null): WordRoundClock {
  const offsetRef = useRef(0);
  const [nowMs] = useState(() => () => Date.now() + offsetRef.current);
  const [round, setRound] = useState<WordRound | null>(null);

  useEffect(() => subscribeLiveServerTimeOffset((offset) => { offsetRef.current = offset; }), []);
  useEffect(() => {
    const tick = (): void => {
      const now = nowMs();
      setRound(startedAtMs === null || (endsAtMs !== null && now >= endsAtMs) ? null : roundAt(startedAtMs, now));
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [endsAtMs, nowMs, startedAtMs]);
  return { round, nowMs };
}
