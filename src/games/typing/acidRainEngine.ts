export const ACID_RAIN_MAX_STAGE = 10;

export interface AcidRainStageRule {
  readonly stage: number;
  readonly targetHits: number;
  readonly spawnIntervalMs: number;
  readonly fallDurationMs: number;
  readonly maxVisibleWords: number;
}

const ACID_RAIN_STAGE_RULES: readonly Omit<AcidRainStageRule, "stage">[] = Object.freeze([
  { targetHits: 4, spawnIntervalMs: 4_000, fallDurationMs: 22_000, maxVisibleWords: 2 },
  { targetHits: 5, spawnIntervalMs: 3_400, fallDurationMs: 19_000, maxVisibleWords: 2 },
  { targetHits: 6, spawnIntervalMs: 2_900, fallDurationMs: 16_000, maxVisibleWords: 2 },
  { targetHits: 7, spawnIntervalMs: 2_350, fallDurationMs: 13_500, maxVisibleWords: 3 },
  { targetHits: 8, spawnIntervalMs: 1_850, fallDurationMs: 11_000, maxVisibleWords: 3 },
  { targetHits: 10, spawnIntervalMs: 1_550, fallDurationMs: 9_500, maxVisibleWords: 3 },
  { targetHits: 12, spawnIntervalMs: 1_300, fallDurationMs: 8_200, maxVisibleWords: 4 },
  { targetHits: 14, spawnIntervalMs: 1_100, fallDurationMs: 7_000, maxVisibleWords: 5 },
  { targetHits: 16, spawnIntervalMs: 900, fallDurationMs: 5_800, maxVisibleWords: 6 },
  { targetHits: 17, spawnIntervalMs: 770, fallDurationMs: 4_700, maxVisibleWords: 7 },
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
