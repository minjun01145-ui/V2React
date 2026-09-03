import { pokemonTypeLabel } from "./pokemonMetadata.ts";
import type { PokemonProfile } from "./types.ts";

const POKE_API = "https://pokeapi.co/api/v2";
const MAX_FETCH_ATTEMPTS = 3;
const encounterCache = new Map<number, PokemonProfile>();

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

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { ...(signal ? { signal } : {}), headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`PokeAPI 요청에 실패했습니다. (${response.status})`);
      return await response.json() as unknown;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (attempt < MAX_FETCH_ATTEMPTS) await abortableDelay(250 * 2 ** (attempt - 1), signal);
    }
  }
  throw lastError;
}

function localizedKoreanName(species: Record<string, unknown>, fallback: string): string {
  if (!Array.isArray(species.names)) return fallback;
  const name = species.names.find((entry) => isRecord(entry)
    && isRecord(entry.language)
    && entry.language.name === "ko"
    && typeof entry.name === "string");
  return isRecord(name) && typeof name.name === "string" ? name.name : fallback;
}

function localizedDescription(species: Record<string, unknown>): string {
  if (!Array.isArray(species.flavor_text_entries)) return "새롭게 만난 포켓몬입니다.";
  const entries = species.flavor_text_entries.filter((entry) => isRecord(entry)
    && isRecord(entry.language)
    && typeof entry.flavor_text === "string");
  const selected = entries.find((entry) => (entry.language as Record<string, unknown>).name === "ko")
    ?? entries.find((entry) => (entry.language as Record<string, unknown>).name === "en");
  return selected && typeof selected.flavor_text === "string"
    ? selected.flavor_text.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim()
    : "새롭게 만난 포켓몬입니다.";
}

function pokemonTypes(pokemon: Record<string, unknown>): readonly string[] {
  if (!Array.isArray(pokemon.types)) return [];
  return pokemon.types
    .filter((entry) => isRecord(entry) && isRecord(entry.type) && typeof entry.type.name === "string")
    .sort((left, right) => Number(left.slot ?? 0) - Number(right.slot ?? 0))
    .map((entry) => pokemonTypeLabel((entry.type as Record<string, unknown>).name as string));
}

function positiveMeasurement(value: unknown, divisor: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value / divisor * 10) / 10
    : null;
}

export async function fetchPokemonEncounter(id: number, signal?: AbortSignal): Promise<PokemonProfile> {
  if (!Number.isInteger(id) || id < 1 || id > 386) throw new Error("FireRed 도감 번호는 1~386이어야 합니다.");
  const cached = encounterCache.get(id);
  if (cached) return cached;
  const [pokemonValue, speciesValue] = await Promise.all([
    fetchJson(`${POKE_API}/pokemon/${id}`, signal),
    fetchJson(`${POKE_API}/pokemon-species/${id}`, signal),
  ]);
  if (!isRecord(pokemonValue) || !isRecord(speciesValue)) throw new Error("PokeAPI 응답 형식이 올바르지 않습니다.");

  const fireRedSprites = recordAt(pokemonValue, "sprites", "versions", "generation-iii", "firered-leafgreen");
  const defaultSprites = recordAt(pokemonValue, "sprites");
  const fireRedSpriteUrl = optionalUrl(fireRedSprites?.front_default);
  const defaultSpriteUrl = optionalUrl(defaultSprites?.front_default);
  const spriteUrl = fireRedSpriteUrl ?? defaultSpriteUrl;
  if (!spriteUrl) throw new Error("사용 가능한 포켓몬 스프라이트를 찾을 수 없습니다.");
  const cries = recordAt(pokemonValue, "cries");
  const rawName = typeof pokemonValue.name === "string" ? pokemonValue.name : `No.${id}`;
  const encounter: PokemonProfile = {
    id,
    name: localizedKoreanName(speciesValue, rawName),
    spriteUrl,
    fallbackSpriteUrl: fireRedSpriteUrl ? defaultSpriteUrl : null,
    shinySpriteUrl: optionalUrl(fireRedSprites?.front_shiny),
    cryUrl: optionalUrl(cries?.legacy) ?? optionalUrl(cries?.latest),
    captureRate: typeof speciesValue.capture_rate === "number" ? speciesValue.capture_rate : 45,
    types: pokemonTypes(pokemonValue),
    description: localizedDescription(speciesValue),
    heightMeters: positiveMeasurement(pokemonValue.height, 10),
    weightKg: positiveMeasurement(pokemonValue.weight, 10),
  };
  encounterCache.set(id, encounter);
  return encounter;
}

export function prefetchPokemonEncounter(id: number): void {
  if (encounterCache.has(id)) return;
  void fetchPokemonEncounter(id).catch(() => undefined);
}
