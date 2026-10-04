import { createLeaderboard, type LeaderboardEntry } from "../../game-engine/timed-game/leaderboard.ts";
import type { RoundProgressRecord } from "../../multiplayer/game-progress/types.ts";
import type { RoundParticipant } from "../../multiplayer/round-participants/model.ts";

export interface LeaderboardRound {
  readonly participants: readonly RoundParticipant[];
  readonly progress: readonly RoundProgressRecord[];
}

export function createCumulativeLeaderboard(rounds: readonly LeaderboardRound[]): readonly LeaderboardEntry[] {
  return createLeaderboard(...mergeRounds(rounds));
}

/** Engine scores across the show plus points the teacher handed out directly. */
export function createShowLeaderboard(rounds: readonly LeaderboardRound[], awards: Readonly<Record<string, number>>): readonly LeaderboardEntry[] {
  const [participants, totals] = mergeRounds(rounds);
  const byPlayer = new Map(totals.map((item) => [item.playerId, item] as const));
  const withAwards = participants.map((participant) => {
    const award = awards[participant.playerId] ?? 0;
    const progress = byPlayer.get(participant.playerId);
    return progress
      ? { ...progress, score: progress.score + award }
      : { ...emptyProgress(participant), score: award };
  });
  return createLeaderboard(participants, withAwards);
}

function emptyProgress(participant: RoundParticipant): RoundProgressRecord {
  return {
    id: participant.playerId, playerId: participant.playerId, gameId: "", displayName: participant.displayName,
    score: 0, correctCount: 0, attemptCount: 0, currentIndex: 0, completedAtMs: null, updatedAtMs: 0, revision: 0,
  };
}

function mergeRounds(rounds: readonly LeaderboardRound[]): [RoundParticipant[], RoundProgressRecord[]] {
  const participants = new Map<string, RoundParticipant>();
  const totals = new Map<string, RoundProgressRecord>();
  // Rounds are chronological: retain earlier participants and use their latest identity.
  for (const round of rounds) {
    for (const participant of round.participants) participants.set(participant.playerId, participant);
    for (const item of round.progress) {
      const current = totals.get(item.playerId);
      totals.set(item.playerId, {
        ...item,
        score: (current?.score ?? 0) + item.score,
        correctCount: (current?.correctCount ?? 0) + item.correctCount,
        attemptCount: (current?.attemptCount ?? 0) + item.attemptCount,
      });
    }
  }
  return [[...participants.values()], [...totals.values()]];
}
