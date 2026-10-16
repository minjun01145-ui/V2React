import { hashString } from "../../core/random.ts";
import skyIslands from "./sky-islands.ts";
import iceCavern from "./ice-cavern.ts";
import lavaTower from "./lava-tower.ts";
export type { ClimbMapDefinition } from "./types.ts";

export const CLIMB_MAPS = [skyIslands, iceCavern, lavaTower] as const;

/** Room/session seed is shared by free players, late joiners and gathered students. */
export function climbMapForSeed(seed: string) {
  return CLIMB_MAPS[hashString(seed) % CLIMB_MAPS.length]!;
}
