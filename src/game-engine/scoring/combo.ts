export interface ComboScoringConfig {
  readonly bonusPerStep: number;
  readonly maximumBonus: number;
}

export interface ComboScoreResult {
  readonly combo: number;
  readonly scoreDelta: number;
  readonly bonusScore: number;
}

export function applyComboScore(
  currentCombo: number,
  correct: boolean,
  baseScore: number,
  config: ComboScoringConfig,
): ComboScoreResult {
  if (!correct) return { combo: 0, scoreDelta: 0, bonusScore: 0 };
  const combo = Math.max(0, Math.floor(currentCombo)) + 1;
  const normalizedBaseScore = Math.max(0, Math.floor(baseScore));
  const bonusScore = Math.min(
    Math.max(combo - 1, 0) * Math.max(0, Math.floor(config.bonusPerStep)),
    Math.max(0, Math.floor(config.maximumBonus)),
  );
  return { combo, scoreDelta: normalizedBaseScore + bonusScore, bonusScore };
}
