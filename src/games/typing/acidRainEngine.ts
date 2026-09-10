export const ACID_RAIN_MAX_STAGE = 10;
export const ACID_RAIN_LANE_COUNT = 5;

export interface AcidRainStageRule {
  readonly stage: number;
  readonly targetHits: number;
  readonly spawnIntervalMs: number;
  readonly fallDurationMs: number;
  readonly maxVisibleWords: number;
}

const ACID_RAIN_STAGE_RULES: readonly Omit<AcidRainStageRule, "stage">[] = Object.freeze([
  { targetHits: 8, spawnIntervalMs: 5_000, fallDurationMs: 28_000, maxVisibleWords: 2 },
  { targetHits: 9, spawnIntervalMs: 4_600, fallDurationMs: 26_000, maxVisibleWords: 2 },
  { targetHits: 10, spawnIntervalMs: 4_200, fallDurationMs: 24_000, maxVisibleWords: 2 },
  { targetHits: 11, spawnIntervalMs: 3_800, fallDurationMs: 22_000, maxVisibleWords: 3 },
  { targetHits: 12, spawnIntervalMs: 3_400, fallDurationMs: 20_000, maxVisibleWords: 3 },
  { targetHits: 14, spawnIntervalMs: 3_000, fallDurationMs: 18_000, maxVisibleWords: 3 },
  { targetHits: 16, spawnIntervalMs: 2_650, fallDurationMs: 16_000, maxVisibleWords: 3 },
  { targetHits: 18, spawnIntervalMs: 2_300, fallDurationMs: 14_000, maxVisibleWords: 4 },
  { targetHits: 20, spawnIntervalMs: 1_950, fallDurationMs: 12_000, maxVisibleWords: 4 },
  { targetHits: 22, spawnIntervalMs: 1_650, fallDurationMs: 10_000, maxVisibleWords: 4 },
]);

export function getAcidRainStageRule(stage: number): AcidRainStageRule {
  const safeStage = Math.max(1, Math.min(ACID_RAIN_MAX_STAGE, Math.trunc(stage) || 1));
  const rule = ACID_RAIN_STAGE_RULES[safeStage - 1];
  if (!rule) throw new Error("산성비 스테이지 규칙을 찾을 수 없습니다.");
  return { stage: safeStage, ...rule };
}

export function shuffledQuestionIndex(length: number, randomValue = Math.random()): number {
  if (length <= 1) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(randomValue * length)));
}

export function availableAcidRainLane(occupiedLanes: readonly number[], randomValue = Math.random()): number {
  const occupied = new Set(occupiedLanes);
  const available = Array.from({ length: ACID_RAIN_LANE_COUNT }, (_, lane) => lane)
    .filter((lane) => !occupied.has(lane));
  const pool = available.length > 0 ? available : Array.from({ length: ACID_RAIN_LANE_COUNT }, (_, lane) => lane);
  const validOccupied = [...occupied].filter((lane) => lane >= 0 && lane < ACID_RAIN_LANE_COUNT);
  const greatestDistance = validOccupied.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.max(...pool.map((lane) => Math.min(...validOccupied.map((occupiedLane) => Math.abs(lane - occupiedLane)))));
  const candidates = validOccupied.length === 0
    ? pool
    : pool.filter((lane) => Math.min(...validOccupied.map((occupiedLane) => Math.abs(lane - occupiedLane))) === greatestDistance);
  return candidates[shuffledQuestionIndex(candidates.length, randomValue)] ?? 0;
}
