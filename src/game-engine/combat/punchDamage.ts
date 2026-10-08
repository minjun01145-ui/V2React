/**
 * Punch damage. It travels inside the existing punch event value as
 * `direction × damage / 10`, so a plain punch is still ±1 and a boosted one
 * ±2, exactly what the party platformers already send for knockback.
 */
export const BASE_PUNCH_DAMAGE = 10;
export const BOOSTED_PUNCH_MULTIPLIER = 2;
/** Hits at or above this are shown bigger, with an exclamation mark. */
export const HEAVY_HIT_DAMAGE = 20;
const VALUE_UNIT = 10;

export function punchDamage(options: { readonly boosted: boolean; readonly attackBonus: number }): number {
  const raw = BASE_PUNCH_DAMAGE * (options.boosted ? BOOSTED_PUNCH_MULTIPLIER : 1) * (1 + Math.max(0, options.attackBonus));
  return Math.round(raw);
}

export function encodePunchDamage(direction: number, damage: number): number {
  return (direction < 0 ? -1 : 1) * (damage / VALUE_UNIT);
}

export function decodePunchDamage(value: number): number {
  return Math.round(Math.abs(value) * VALUE_UNIT);
}

export function isHeavyHit(damage: number): boolean {
  return damage >= HEAVY_HIT_DAMAGE;
}
