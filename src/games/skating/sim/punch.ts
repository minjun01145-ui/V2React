/**
 * Shoulder-punches on the ice. As in the jump tower, the attacker picks the
 * target and the victim's own client applies the shove, because each client
 * owns its skater's physics. The shove is sideways (up/down on screen) only,
 * so it can push someone into a wrong lane but never stops them.
 */
export { PUNCH_COOLDOWN_MS, PUNCH_EVENT } from "../../../game-engine/platformer-party/punch.ts";

/** A crash is shown to everyone so the shatter is visible on other screens too. */
export const CRASH_EVENT = "crash";

const FORWARD_REACH = 1.1;
const SIDE_REACH = 1.05;
/** Sideways velocity added to the victim; on low-drag ice this slides roughly two thirds of a lane. */
export const PUNCH_SHOVE_SPEED = 1.35;

export interface SkaterPosition {
  readonly playerId: string;
  readonly x: number;
  readonly y: number;
}

/** The nearest skater beside the attacker. Players exactly level are shoved towards the rink centre. */
export function chooseSkatingPunchTarget(
  attacker: { readonly x: number; readonly y: number },
  candidates: readonly SkaterPosition[],
): { readonly target: SkaterPosition; readonly direction: -1 | 1 } | null {
  let best: SkaterPosition | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const dx = candidate.x - attacker.x;
    const dy = candidate.y - attacker.y;
    if (Math.abs(dx) > FORWARD_REACH || Math.abs(dy) > SIDE_REACH) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  const dy = best.y - attacker.y;
  const direction = Math.abs(dy) > 0.05 ? Math.sign(dy) : best.y > 0 ? -1 : 1;
  return { target: best, direction: direction < 0 ? -1 : 1 };
}

/** Sideways velocity for a received punch event; the event value's sign is the shove direction. */
export function skatingPunchShove(value: number): number {
  return (value < 0 ? -1 : 1) * PUNCH_SHOVE_SPEED;
}
