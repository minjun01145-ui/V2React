import type { LavaHazard } from "../maps/types.ts";

/** Feet crossing the surface die, independent of camera position. */
export function touchesLava(lava: LavaHazard, x: number, feetY: number): boolean {
  return x >= lava.left && x <= lava.right && feetY >= lava.y + 4;
}
