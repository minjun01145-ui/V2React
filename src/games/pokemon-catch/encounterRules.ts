import { createSeededRandom } from "../../game-engine/core/random.ts";
import { FIRERED_WILD_ENCOUNTERS } from "./fireredEncounterData.ts";

const totalWeight = FIRERED_WILD_ENCOUNTERS.reduce((sum, encounter) => sum + encounter.weight, 0);
const encounterIds = new Set<number>(FIRERED_WILD_ENCOUNTERS.map((encounter) => encounter.id));

export function encounterId(seed: string): number {
  let roll = createSeededRandom(seed)() * totalWeight;
  for (const encounter of FIRERED_WILD_ENCOUNTERS) {
    roll -= encounter.weight;
    if (roll < 0) return encounter.id;
  }
  return FIRERED_WILD_ENCOUNTERS[FIRERED_WILD_ENCOUNTERS.length - 1]!.id;
}

export function isFireRedWildEncounter(id: number): boolean {
  return encounterIds.has(id);
}
