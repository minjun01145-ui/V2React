import type { RoundLiveMetricRecord } from "../../multiplayer/live-metrics/types.ts";
import type { RoundParticipant } from "../../multiplayer/round-participants/model.ts";
import { displayLabel } from "../../multiplayer/types.ts";

export interface AcidRainLeaderboardEntry {
  readonly playerId: string;
  readonly displayName: string;
  readonly studentNumber: string;
  readonly rank: number;
  readonly currentStage: number;
  readonly averageCpm: number;
}

export function createAcidRainLeaderboard(
  participants: readonly RoundParticipant[],
  metrics: readonly RoundLiveMetricRecord[],
): readonly AcidRainLeaderboardEntry[] {
  const metricByPlayer = new Map(metrics.map((metric) => [metric.playerId, metric] as const));
  const sorted = participants.map((participant) => {
    const metric = metricByPlayer.get(participant.playerId);
    return {
      playerId: participant.playerId,
      displayName: displayLabel(participant.displayName, participant.nickname),
      studentNumber: participant.studentNumber,
      currentStage: metric?.currentStage ?? 0,
      averageCpm: metric?.averageCpm ?? 0,
    };
  }).sort((first, second) => (
    second.currentStage - first.currentStage
    || second.averageCpm - first.averageCpm
    || first.studentNumber.localeCompare(second.studentNumber, "ko")
  ));

  let currentRank = 0;
  return sorted.map((entry, index) => {
    const previous = sorted[index - 1];
    if (!previous || previous.currentStage !== entry.currentStage) currentRank = index + 1;
    return { ...entry, rank: currentRank };
  });
}
