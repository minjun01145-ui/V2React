import { createSeededRandom } from "../../game-engine/core/random.ts";

const TYPE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  normal: "노말", fire: "불꽃", water: "물", electric: "전기", grass: "풀",
  ice: "얼음", fighting: "격투", poison: "독", ground: "땅", flying: "비행",
  psychic: "에스퍼", bug: "벌레", rock: "바위", ghost: "고스트", dragon: "드래곤",
  dark: "악", steel: "강철", fairy: "페어리",
});

const LEGENDARY_IDS = new Set([144, 145, 146, 150, 151]);

export function pokemonTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function encounterLevel(seed: string, speciesId: number, captureRate: number): number {
  const random = createSeededRandom(`${seed}:level`)();
  if (LEGENDARY_IDS.has(speciesId)) return 50 + Math.floor(random * 21);
  const rarityLevel = Math.round((255 - Math.min(Math.max(captureRate, 0), 255)) / 255 * 32);
  return Math.min(60, 3 + rarityLevel + Math.floor(random * 13));
}
