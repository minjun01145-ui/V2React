import { getGame } from "../../../games/registry.ts";
import { getLearningSet } from "../../../learning-sets/readRepository.ts";
import { warmPlayerGameProgress } from "../../../multiplayer/game-progress/playerProgressChannel.ts";
import type { GameSession, Player } from "../../../multiplayer/types.ts";

function configuredSetId(session: GameSession): string | null {
  const value = session.gameConfig?.setId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export interface PreparedStudentRound {
  readonly release: () => void;
}

export async function prepareStudentRound(input: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly player: Player;
}): Promise<PreparedStudentRound> {
  const { roomId, session, player } = input;
  if (!session.roundId) throw new Error("준비할 라운드 정보가 없습니다.");
  const game = getGame(session.gameId);
  const setId = configuredSetId(session);
  const progressRelease = game.preloadPlayerProgress
    ? await warmPlayerGameProgress(roomId, session.roundId, player.id)
    : () => undefined;
  let gameRelease = (): void => undefined;
  const gamePreparation = (game.prepareStudent?.({ session, player }) ?? Promise.resolve())
    .then((release) => { gameRelease = release ?? (() => undefined); });
  try {
    await Promise.all([
      game.loadStudent().then(() => undefined),
      setId ? getLearningSet(setId, session.roundId).then(() => undefined) : Promise.resolve(),
      gamePreparation,
    ]);
    return { release: () => { progressRelease(); gameRelease(); } };
  } catch (error: unknown) {
    await gamePreparation.catch(() => undefined);
    progressRelease();
    gameRelease();
    throw error;
  }
}
