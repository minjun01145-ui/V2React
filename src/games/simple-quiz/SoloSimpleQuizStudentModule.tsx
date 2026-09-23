import { useCallback, useMemo } from "react";
import type { SoloGameModuleProps } from "../../solo/contracts.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import SimpleQuizPlay from "./SimpleQuizPlay.tsx";
import { useSoloSimpleQuizGame } from "./useSoloSimpleQuizGame.ts";

export default function SoloSimpleQuizStudentModule({ run, set, onFinish, onExit }: SoloGameModuleProps) {
  const clock = useTimedGameClock({
    gameConfig: run.gameConfig,
    roundId: run.runId,
    startedAtMs: run.startedAtMs,
  });
  const game = useSoloSimpleQuizGame(run, set);
  const finish = useCallback(() => onFinish(), [onFinish]);
  const gameWithClock = useMemo(() => ({ ...game, submitAnswer: async (answer: Parameters<typeof game.submitAnswer>[0]) => {
    if (clock.expired) return null;
    return game.submitAnswer(answer);
  } }), [clock.expired, game]);
  return <SimpleQuizPlay
    game={gameWithClock}
    clockExpired={clock.expired}
    remainingMs={clock.remainingMs}
    onFinish={finish}
    onReturnToLobby={onExit}
  />;
}
