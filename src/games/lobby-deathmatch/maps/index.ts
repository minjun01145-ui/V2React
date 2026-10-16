import { createSeededRandom } from "../../../game-engine/core/random.ts";
import type { ArenaMap } from "./types.ts";

// A new map needs only a definition file; Vite includes it in the shared registry.
const definitions = import.meta.glob<ArenaMap>(["./*.ts", "!./index.ts", "!./types.ts"], { eager: true, import: "default" });
export const ARENA_MAPS: readonly ArenaMap[] = Object.values(definitions).sort((a, b) => a.id.localeCompare(b.id));

/** The existing shared channel is the game session; never seed from a student's local clock or identity. */
export function selectArenaMap(sessionId: string): ArenaMap {
  const random = createSeededRandom(`deathmatch:map:${sessionId}`);
  return ARENA_MAPS[Math.floor(random() * ARENA_MAPS.length)]!;
}
