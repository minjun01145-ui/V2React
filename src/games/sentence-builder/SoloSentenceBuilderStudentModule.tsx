import { useCallback } from "react";
import type { SoloGameModuleProps } from "../../solo/contracts.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import SentenceBuilderPlay from "./SentenceBuilderPlay.tsx";
import { useSoloSentenceBuilderGame } from "./useSoloSentenceBuilderGame.ts";

export default function SoloSentenceBuilderStudentModule({ run, set, onFinish, onExit }: SoloGameModuleProps) {
  const clock = useTimedGameClock({ gameConfig: run.gameConfig, roundId: run.runId, startedAtMs: run.startedAtMs });
  const game = useSoloSentenceBuilderGame(run, set, clock.expired);
  const finish = useCallback(() => onFinish(), [onFinish]);
  const exit = useCallback(() => onExit(), [onExit]);
  return <SentenceBuilderPlay
    engine={game}
    roundId={run.runId}
    playerId={run.ownerUid}
    disabled={clock.expired}
    clockExpired={clock.expired}
    remainingMs={clock.remainingMs}
    onFinish={finish}
    onExit={exit}
  />;
}
