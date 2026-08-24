import type { PokemonEncounter } from "./types.ts";

const POKE_API = "https://pokeapi.co/api/v2";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, ...keys: string[]): Record<string, unknown> | null {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}

function optionalUrl(value: unknown): string | null {
  return typeof value === "string" && /^https:\/\//.test(value) ? value : null;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { ...(signal ? { signal } : {}), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`PokeAPI 요청에 실패했습니다. (${response.status})`);
  return response.json() as Promise<unknown>;
}

function localizedKoreanName(species: Record<string, unknown>, fallback: string): string {
  if (!Array.isArray(species.names)) return fallback;
  const name = species.names.find((entry) => isRecord(entry)
    && isRecord(entry.language)
    && entry.language.name === "ko"
    && typeof entry.name === "string");
  return isRecord(name) && typeof name.name === "string" ? name.name : fallback;
}

export async function fetchPokemonEncounter(id: number, signal?: AbortSignal): Promise<PokemonEncounter> {
  if (!Number.isInteger(id) || id < 1 || id > 386) throw new Error("FireRed 도감 번호는 1~386이어야 합니다.");
  const [pokemonValue, speciesValue] = await Promise.all([
    fetchJson(`${POKE_API}/pokemon/${id}`, signal),
    fetchJson(`${POKE_API}/pokemon-species/${id}`, signal),
  ]);
  if (!isRecord(pokemonValue) || !isRecord(speciesValue)) throw new Error("PokeAPI 응답 형식이 올바르지 않습니다.");

  const fireRedSprites = recordAt(pokemonValue, "sprites", "versions", "generation-iii", "firered-leafgreen");
  const spriteUrl = optionalUrl(fireRedSprites?.front_default);
  if (!spriteUrl) throw new Error("FireRed 스프라이트를 찾을 수 없습니다.");
  const cries = recordAt(pokemonValue, "cries");
  const rawName = typeof pokemonValue.name === "string" ? pokemonValue.name : `No.${id}`;
  return {
    id,
    name: localizedKoreanName(speciesValue, rawName),
    spriteUrl,
    shinySpriteUrl: optionalUrl(fireRedSprites?.front_shiny),
    cryUrl: optionalUrl(cries?.legacy) ?? optionalUrl(cries?.latest),
    captureRate: typeof speciesValue.capture_rate === "number" ? speciesValue.capture_rate : 45,
    baseExperience: typeof pokemonValue.base_experience === "number" ? pokemonValue.base_experience : 50,
  };
}
