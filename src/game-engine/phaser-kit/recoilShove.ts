/**
 * Predicted shove for a remote player who was just hit. Their real position
 * arrives a few hundred ms late, so the drawing snaps out at once, holds until
 * the real knockback has had time to arrive, then fades into it. It never
 * swings back early, which would read as being knocked twice.
 */
export const RECOIL_SHOVE_RISE_MS = 80;
export const RECOIL_SHOVE_HOLD_MS = 320;
export const RECOIL_SHOVE_FADE_MS = 320;

/** 0 → 1 quickly, held, then back to 0 while the real knockback takes over. */
export function recoilShove(ageMs: number): number {
  if (ageMs < 0 || ageMs >= RECOIL_SHOVE_RISE_MS + RECOIL_SHOVE_HOLD_MS + RECOIL_SHOVE_FADE_MS) return 0;
  if (ageMs < RECOIL_SHOVE_RISE_MS) return Math.sin((ageMs / RECOIL_SHOVE_RISE_MS) * Math.PI / 2);
  if (ageMs < RECOIL_SHOVE_RISE_MS + RECOIL_SHOVE_HOLD_MS) return 1;
  return 1 - (ageMs - RECOIL_SHOVE_RISE_MS - RECOIL_SHOVE_HOLD_MS) / RECOIL_SHOVE_FADE_MS;
}
