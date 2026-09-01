export const LIVE_METRIC_KIND = Object.freeze({
  TYPING_CPM: "typing-cpm",
} as const);

export interface TypingLiveMetricValues {
  readonly currentCpm: number;
  readonly averageCpm: number;
  readonly bestCpm: number;
  readonly totalValidStrokes: number;
}

export interface RoundLiveMetricRecord extends TypingLiveMetricValues {
  readonly id: string;
  readonly gameId: string;
  readonly playerId: string;
  readonly displayName: string;
  readonly kind: (typeof LIVE_METRIC_KIND)[keyof typeof LIVE_METRIC_KIND];
  readonly sampledAtMs: number;
  readonly committedAtMs: number;
}
