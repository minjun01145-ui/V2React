export const GAME_EFFECT_LEVEL = {
  STANDARD: "standard",
  COMBO: "combo",
  SUPER: "super",
  MAX: "max",
} as const;

export type GameEffectLevel = (typeof GAME_EFFECT_LEVEL)[keyof typeof GAME_EFFECT_LEVEL];

export interface GameEffectDefinition {
  readonly kind: "score-celebration";
  readonly tone: "success";
  readonly headline: string;
  readonly metric: string;
  readonly detail: string | null;
  readonly combo: number;
  readonly bonusScore: number;
  readonly level: GameEffectLevel;
  readonly durationMs: number;
}

export interface ActiveGameEffect extends GameEffectDefinition {
  readonly id: string;
}

export function gameEffectLevel(combo: number): GameEffectLevel {
  if (combo >= 6) return GAME_EFFECT_LEVEL.MAX;
  if (combo >= 4) return GAME_EFFECT_LEVEL.SUPER;
  if (combo >= 2) return GAME_EFFECT_LEVEL.COMBO;
  return GAME_EFFECT_LEVEL.STANDARD;
}

export function createScoreCelebration(input: {
  readonly scoreDelta: number;
  readonly combo: number;
  readonly baseScore?: number;
}): GameEffectDefinition {
  const combo = Math.max(1, Math.floor(input.combo));
  const scoreDelta = Math.max(0, Math.floor(input.scoreDelta));
  const baseScore = Math.max(0, Math.floor(input.baseScore ?? 100));
  const bonusScore = Math.max(0, scoreDelta - baseScore);
  const level = gameEffectLevel(combo);
  const headline = level === GAME_EFFECT_LEVEL.STANDARD
    ? "정답!"
    : level === GAME_EFFECT_LEVEL.COMBO
      ? `${combo} COMBO!`
      : level === GAME_EFFECT_LEVEL.SUPER
        ? `${combo} SUPER COMBO!`
        : `${combo} MAX COMBO!`;

  return {
    kind: "score-celebration",
    tone: "success",
    headline,
    metric: `+${scoreDelta}점`,
    detail: bonusScore > 0 ? `콤보 보너스 +${bonusScore}점` : null,
    combo,
    bonusScore,
    level,
    durationMs: level === GAME_EFFECT_LEVEL.STANDARD ? 780 : 1_050,
  };
}
