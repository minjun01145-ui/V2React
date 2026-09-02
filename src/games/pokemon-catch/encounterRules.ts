import { createSeededRandom } from "../../game-engine/core/random.ts";
import { FIRERED_WILD_ENCOUNTERS } from "./fireredEncounterData.ts";

// Area totals from FireRed preserve which species feel common or rare. A power
// curve softens those differences so the classroom game has more variety.
const LEGENDARY_ENCOUNTERS = [
  { id: 144, weight: 5.5 },
  { id: 145, weight: 5.5 },
  { id: 146, weight: 5.5 },
  { id: 150, weight: 4.5 },
  { id: 151, weight: 3 },
] as const;
const ENCOUNTERS = [
  ...FIRERED_WILD_ENCOUNTERS.map(({ id, weight }) => ({ id, weight: Math.max(1, weight ** .58) })),
  ...LEGENDARY_ENCOUNTERS,
] as const;
const totalWeight = ENCOUNTERS.reduce((sum, encounter) => sum + encounter.weight, 0);
const encounterIds = new Set<number>(ENCOUNTERS.map((encounter) => encounter.id));

export function encounterId(seed: string): number {
  let roll = createSeededRandom(seed)() * totalWeight;
  for (const encounter of ENCOUNTERS) {
    roll -= encounter.weight;
    if (roll < 0) return encounter.id;
  }
  return ENCOUNTERS[ENCOUNTERS.length - 1]!.id;
}

export function isFireRedWildEncounter(id: number): boolean {
  return encounterIds.has(id);
}
