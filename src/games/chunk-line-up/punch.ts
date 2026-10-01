/**
 * Just-for-fun punches: no score or energy, only a small knockback. The
 * attacker picks the target; the victim's own client applies the knockback
 * (each client owns its physics), so the payload only says direction and power.
 */

export const PUNCH_EVENT = "punch";
export const PUNCH_COOLDOWN_MS = 380;
const REACH = 64;
const VERTICAL_REACH = 34;

export interface PunchCandidate {
  readonly playerId: string;
  readonly x: number;
  readonly y: number;
}

/** The closest player in front of the attacker within arm's reach, if any. */
export function choosePunchTarget(
  attacker: { readonly x: number; readonly y: number; readonly facing: number },
  candidates: readonly PunchCandidate[],
): PunchCandidate | null {
  let best: PunchCandidate | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const ahead = (candidate.x - attacker.x) * attacker.facing;
    if (ahead < -6 || ahead > REACH || Math.abs(candidate.y - attacker.y) > VERTICAL_REACH) continue;
    const distance = Math.abs(candidate.x - attacker.x);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Event value: sign is the push direction, magnitude the power (1 normal, 2 with the punch item). */
export function encodePunch(facing: number, powered: boolean): number {
  return (facing < 0 ? -1 : 1) * (powered ? 2 : 1);
}

export function punchKnockback(value: number): { readonly vx: number; readonly vy: number } {
  const direction = value < 0 ? -1 : 1;
  const powered = Math.abs(value) >= 2;
  return { vx: direction * (powered ? 520 : 240), vy: powered ? -320 : -170 };
}
