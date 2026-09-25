import { useCallback } from "react";
import type { SoloGameModuleProps } from "../../solo/contracts.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import AiTutorPlayView from "./AiTutorPlayView.tsx";
import { useSoloAiTutorGame } from "./useSoloAiTutorGame.ts";

export default function SoloAiTutorStudentModule({ run, set, onFinish, onExit }: SoloGameModuleProps) {
  const clock = useTimedGameClock({ gameConfig: run.gameConfig, roundId: run.runId, startedAtMs: run.startedAtMs });
  const game = useSoloAiTutorGame(run, set);
  const finish = useCallback(() => onFinish(), [onFinish]);
  const exit = useCallback(() => onExit(), [onExit]);
  return <AiTutorPlayView
    game={game}
    clockExpired={clock.expired}
    remainingMs={clock.remainingMs}
    onFinish={finish}
    onExit={exit}
  />;
}
