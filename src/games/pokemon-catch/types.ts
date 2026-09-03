export interface PokemonProfile {
  readonly id: number;
  readonly name: string;
  readonly spriteUrl: string;
  readonly fallbackSpriteUrl: string | null;
  readonly shinySpriteUrl: string | null;
  readonly cryUrl: string | null;
  readonly captureRate: number;
  readonly types: readonly string[];
  readonly description: string;
  readonly heightMeters: number | null;
  readonly weightKg: number | null;
}

export interface PokemonEncounter extends PokemonProfile {
  readonly level: number;
}

export type EncounterLoadStatus = "loading" | "ready" | "error";
export type EncounterActionPhase = "ready" | "throwing" | "shaking" | "failed" | "caught" | "escaped";
export type EncounterPhase = "loading" | EncounterActionPhase | "error";
