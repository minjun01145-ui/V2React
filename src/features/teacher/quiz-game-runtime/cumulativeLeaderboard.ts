import { createLeaderboard } from "../../../game-engine/timed-game/leaderboard.ts";
import type { RoundProgressRecord } from "../../../multiplayer/game-progress/types.ts";
import type { RoundParticipant } from "../../../multiplayer/round-participants/model.ts";

export function createCumulativeLeaderboard(rounds: readonly {
  readonly participants: readonly RoundParticipant[];
  readonly progress: readonly RoundProgressRecord[];
}[]) {
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
  return createLeaderboard([...participants.values()], [...totals.values()]);
}
