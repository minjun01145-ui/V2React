export const DICE_COUNTS = [1, 2, 3] as const;
export const DICE_ROLL_ANIMATION_MS = 1_100;

export type DiceCount = (typeof DICE_COUNTS)[number];
export type DicePhase = "idle" | "rolling" | "result";

export interface DiceRollState {
  readonly phase: DicePhase;
  readonly diceCount: DiceCount;
  readonly results: readonly number[];
}

export function isDiceCount(value: unknown): value is DiceCount {
  return value === 1 || value === 2 || value === 3;
}

export function isDiceResult(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 6;
}

export function createDiceResults(
  count: DiceCount,
  random: () => number = Math.random,
): readonly number[] {
  return Array.from({ length: count }, () => Math.min(6, Math.max(1, Math.floor(random() * 6) + 1)));
}

export function diceTotal(results: readonly number[]): number {
  return results.reduce((total, value) => total + value, 0);
}
