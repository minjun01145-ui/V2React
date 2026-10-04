import { useEffect, useState } from "react";
import { loadPlayerRoundProgress } from "../../multiplayer/game-progress/repository.ts";
import type { SlideShowSessionState } from "../../slide-show/types.ts";

/**
 * A student's running total: own engine scores (students may only read their own
 * progress) plus teacher awards. Reloaded whenever an engine changes phase.
 */
export function useMyShowScore(roomId: string, playerId: string, slideShow: SlideShowSessionState): number {
  const [engineScore, setEngineScore] = useState(0);
  const roundsKey = slideShow.scoredRoundIds.join(":");
  const phase = slideShow.engine?.phase ?? "slide";
  useEffect(() => {
    let active = true;
    void Promise.all(slideShow.scoredRoundIds.map((roundId) => loadPlayerRoundProgress(roomId, roundId, playerId)))
      .then((records) => { if (active) setEngineScore(records.reduce((total, record) => total + (record?.score ?? 0), 0)); })
      .catch((error: unknown) => console.error(error));
    return () => { active = false; };
    // The key captures the round list; phase changes mean new scores may exist.
  }, [phase, playerId, roomId, roundsKey]);
  return engineScore + (slideShow.awards[playerId] ?? 0);
}
