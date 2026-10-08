/** A fall into the lava counts as a kill for whoever punched the victim within this window. */
export const KILL_CREDIT_MS = 6_000;

export interface KillCredit {
  /** Remember the latest punch that hit the local player. */
  hitBy(attackerId: string, atMs: number): void;
  /** Who gets the kill for a death at `atMs` (null for a plain fall), then forget the hit. */
  claim(atMs: number): string | null;
}

/**
 * Only the victim's own client knows for sure that a punch landed on it, so it
 * decides who gets the kill and announces it.
 */
export function createKillCredit(): KillCredit {
  let last: { readonly attackerId: string; readonly atMs: number } | null = null;
  return {
    hitBy(attackerId, atMs) {
      last = { attackerId, atMs };
    },
    claim(atMs) {
      const credited = last && atMs - last.atMs <= KILL_CREDIT_MS ? last.attackerId : null;
      last = null;
      return credited;
    },
  };
}
