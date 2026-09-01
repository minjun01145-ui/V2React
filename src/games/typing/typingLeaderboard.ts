import type { RoundLiveMetricRecord } from "../../multiplayer/live-metrics/types.ts";
import type { RoundParticipant } from "../../multiplayer/round-participants/model.ts";
import { displayLabel } from "../../multiplayer/types.ts";

export interface TypingLeaderboardEntry {
  readonly playerId: string;
  readonly displayName: string;
  readonly studentNumber: string;
  readonly rank: number;
  readonly currentCpm: number;
  readonly averageCpm: number;
  readonly bestCpm: number;
  readonly totalValidStrokes: number;
}

export function createTypingLeaderboard(
  participants: readonly RoundParticipant[],
  metrics: readonly RoundLiveMetricRecord[],
): readonly TypingLeaderboardEntry[] {
  const metricByPlayer = new Map(metrics.map((metric) => [metric.playerId, metric] as const));
  const sorted = participants.map((participant) => {
    const metric = metricByPlayer.get(participant.playerId);
    return {
      playerId: participant.playerId,
      displayName: displayLabel(participant.displayName, participant.nickname),
      studentNumber: participant.studentNumber,
      currentCpm: metric?.currentCpm ?? 0,
      averageCpm: metric?.averageCpm ?? 0,
      bestCpm: metric?.bestCpm ?? 0,
      totalValidStrokes: metric?.totalValidStrokes ?? 0,
    };
  }).sort((first, second) => (
    second.averageCpm - first.averageCpm
    || second.totalValidStrokes - first.totalValidStrokes
    || second.bestCpm - first.bestCpm
    || first.studentNumber.localeCompare(second.studentNumber, "ko")
  ));

  let currentRank = 0;
  return sorted.map((entry, index) => {
    const previous = sorted[index - 1];
    const tied = previous
      && previous.averageCpm === entry.averageCpm
      && previous.totalValidStrokes === entry.totalValidStrokes
      && previous.bestCpm === entry.bestCpm;
    if (!tied) currentRank = index + 1;
    return { ...entry, rank: currentRank };
  });
}
