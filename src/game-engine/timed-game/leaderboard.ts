import type { RoundProgressRecord } from "../question-engine/multiplayer/types.ts";
import type { Player } from "../../multiplayer/types.ts";
import { displayLabel } from "../../multiplayer/types.ts";

export interface LeaderboardEntry {
  readonly playerId: string;
  readonly displayName: string;
  readonly studentNumber: string;
  readonly rank: number;
  readonly score: number;
  readonly correctCount: number;
  readonly attemptCount: number;
}

export function createLeaderboard(
  players: readonly Player[],
  progressRecords: readonly RoundProgressRecord[],
): readonly LeaderboardEntry[] {
  const progressByPlayer = new Map(progressRecords.map((progress) => [progress.playerId, progress] as const));
  const sorted = players.map((player) => {
    const progress = progressByPlayer.get(player.id);
    return {
      playerId: player.id,
      displayName: displayLabel(player.displayName, player.nickname),
      studentNumber: player.studentNumber,
      score: progress?.score ?? 0,
      correctCount: progress?.correctCount ?? 0,
      attemptCount: progress?.attemptCount ?? 0,
    };
  }).sort((first, second) =>
    second.score - first.score
    || second.correctCount - first.correctCount
    || first.attemptCount - second.attemptCount
    || first.studentNumber.localeCompare(second.studentNumber, "ko"),
  );

  let currentRank = 0;
  return sorted.map((entry, index) => {
    const previous = sorted[index - 1];
    const tied = previous
      && previous.score === entry.score
      && previous.correctCount === entry.correctCount
      && previous.attemptCount === entry.attemptCount;
    if (!tied) currentRank = index + 1;
    return { ...entry, rank: currentRank };
  });
}
