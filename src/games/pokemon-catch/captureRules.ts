import { createSeededRandom } from "../../game-engine/core/random.ts";

export const FIRERED_NATIONAL_DEX_MAX = 386;

export function encounterId(seed: string): number {
  return Math.floor(createSeededRandom(seed)() * FIRERED_NATIONAL_DEX_MAX) + 1;
}

export function captureChance(captureRate: number): number {
  const normalized = Math.min(Math.max(captureRate, 0), 255) / 255;
  return 0.18 + normalized * 0.64;
}

export function didCapture(chance: number, roll: number): boolean {
  return roll >= 0 && roll < Math.min(Math.max(chance, 0), 1);
}

export function captureScore(baseExperience: number, captureRate: number): number {
  const rarityBonus = Math.round((255 - Math.min(Math.max(captureRate, 0), 255)) * 1.5);
  return Math.max(50, Math.round(baseExperience) + rarityBonus);
}

