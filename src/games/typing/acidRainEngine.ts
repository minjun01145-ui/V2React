export const ACID_RAIN_MAX_STAGE = 10;

export interface AcidRainStageRule {
  readonly stage: number;
  readonly targetHits: number;
  readonly spawnIntervalMs: number;
  readonly fallDurationMs: number;
  readonly maxVisibleWords: number;
}

export function getAcidRainStageRule(stage: number): AcidRainStageRule {
  const safeStage = Math.max(1, Math.min(ACID_RAIN_MAX_STAGE, Math.trunc(stage) || 1));
  return {
    stage: safeStage,
    targetHits: 7 + safeStage,
    spawnIntervalMs: Math.max(650, 1_850 - ((safeStage - 1) * 120)),
    fallDurationMs: Math.max(4_200, 11_000 - ((safeStage - 1) * 700)),
    maxVisibleWords: Math.min(7, 3 + Math.floor(safeStage / 2)),
  };
}

export function shuffledQuestionIndex(length: number, randomValue = Math.random()): number {
  if (length <= 1) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(randomValue * length)));
}
