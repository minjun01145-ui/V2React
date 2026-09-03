import type { StoredCapturedPokemon } from "../../student-data/pokemon-catch/types.ts";
import type { PokemonEncounter } from "./types.ts";

export const MAX_POKEMON_NICKNAME_LENGTH = 12;

export function normalizePokemonNickname(value: string): string | null {
  const nickname = value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, MAX_POKEMON_NICKNAME_LENGTH);
  return nickname || null;
}

export function capturedPokemonFromEncounter(encounter: PokemonEncounter, nickname: string): StoredCapturedPokemon {
  return {
    captureId: crypto.randomUUID(),
    speciesId: encounter.id,
    name: encounter.name,
    nickname: normalizePokemonNickname(nickname),
    level: encounter.level,
    types: encounter.types,
    description: encounter.description,
    heightMeters: encounter.heightMeters,
    weightKg: encounter.weightKg,
    spriteUrl: encounter.spriteUrl,
    fallbackSpriteUrl: encounter.fallbackSpriteUrl,
    caughtAtMs: Date.now(),
  };
}

export function capturedPokemonDisplayName(pokemon: Pick<StoredCapturedPokemon, "name" | "nickname">): string {
  return pokemon.nickname ?? pokemon.name;
}
