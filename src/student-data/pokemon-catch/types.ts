export const POKEMON_ITEM = {
  POKE_BALL: "pokeBall",
  GREAT_BALL: "greatBall",
  SLEEP_SPRAY: "sleepSpray",
  ANGER: "anger",
} as const;

export type PokemonItemId = typeof POKEMON_ITEM[keyof typeof POKEMON_ITEM];

export interface PokemonInventory {
  readonly pokeBall: number;
  readonly greatBall: number;
  readonly sleepSpray: number;
  readonly anger: number;
}

export interface StoredCapturedPokemon {
  readonly captureId: string;
  readonly speciesId: number;
  readonly name: string;
  readonly nickname: string | null;
  readonly level: number;
  readonly types: readonly string[];
  readonly description: string;
  readonly heightMeters: number | null;
  readonly weightKg: number | null;
  readonly spriteUrl: string;
  readonly fallbackSpriteUrl: string | null;
  readonly caughtAtMs: number;
}

export const EMPTY_POKEMON_INVENTORY: PokemonInventory = Object.freeze({
  pokeBall: 0,
  greatBall: 0,
  sleepSpray: 0,
  anger: 0,
});

export const NEW_PLAYER_POKEMON_INVENTORY: PokemonInventory = Object.freeze({
  ...EMPTY_POKEMON_INVENTORY,
  pokeBall: 1,
});
