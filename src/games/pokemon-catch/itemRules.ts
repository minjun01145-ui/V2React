import { POKEMON_ITEM, type PokemonItemId } from "../../student-data/pokemon-catch/types.ts";

export const ENCOUNTER_TIME_MS = 45_000;
export const ANGER_TIME_BONUS_MS = 15_000;
export const SLEEP_CAPTURE_MULTIPLIER = 2;

export interface PokemonItemDefinition {
  readonly id: PokemonItemId;
  readonly name: string;
  readonly description: string;
  readonly rewardWeight: number;
  readonly kind: "ball" | "effect";
  readonly ballMultiplier?: number;
}

export const POKEMON_ITEMS: readonly PokemonItemDefinition[] = Object.freeze([
  { id: POKEMON_ITEM.POKE_BALL, name: "포켓볼", description: "기본 포획 도구", rewardWeight: 35, kind: "ball", ballMultiplier: 1 },
  { id: POKEMON_ITEM.SLEEP_SPRAY, name: "잠재우기 스프레이", description: "현재 포켓몬의 포획률 2배", rewardWeight: 35, kind: "effect" },
  { id: POKEMON_ITEM.ANGER, name: "화나게 하기", description: "현재 포켓몬의 제한시간 15초 증가", rewardWeight: 20, kind: "effect" },
  { id: POKEMON_ITEM.GREAT_BALL, name: "슈퍼볼", description: "포획률 1.5배인 포획 도구", rewardWeight: 10, kind: "ball", ballMultiplier: 1.5 },
]);

const totalRewardWeight = POKEMON_ITEMS.reduce((sum, item) => sum + item.rewardWeight, 0);

export function itemDefinition(itemId: PokemonItemId): PokemonItemDefinition {
  return POKEMON_ITEMS.find((item) => item.id === itemId)!;
}

export function rewardItem(roll: number): PokemonItemId {
  let weightedRoll = Math.min(Math.max(roll, 0), 1 - Number.EPSILON) * totalRewardWeight;
  for (const item of POKEMON_ITEMS) {
    weightedRoll -= item.rewardWeight;
    if (weightedRoll < 0) return item.id;
  }
  return POKEMON_ITEMS[POKEMON_ITEMS.length - 1]!.id;
}
