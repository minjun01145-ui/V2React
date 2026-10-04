import { SHARED_ITEM_CATALOG } from "../../items/catalog.ts";
import type { GameItemEffects, SharedItemDefinition } from "../../items/types.ts";
import { hashString, shuffled } from "../../game-engine/core/random.ts";

// These are round pickups, not grants to the account-owned inventory.
export const BRICK_ITEMS = {
  bomb: { ...SHARED_ITEM_CATALOG.bomb, name: "폭탄", description: "벽돌 3개 더 폭파" },
  hammer: { id: "hammer", name: "쌍망치", emoji: "🔨", category: "utility", consumable: true, description: "20초 동안 한 번에 2개" },
  gold: { id: "gold", name: "황금 망치", emoji: "👑", category: "utility", consumable: true, description: "20초 동안 점수 2배" },
  shield: { id: "shield", name: "보호막", emoji: "🛡️", category: "defense", consumable: true, description: "오답 1번 막기" },
} as const satisfies Record<string, SharedItemDefinition>;
export type BrickItemId = keyof typeof BRICK_ITEMS;
export const BRICK_ITEM_IDS = Object.keys(BRICK_ITEMS) as BrickItemId[];
export type BrickTimedItemId = "hammer" | "gold";
export const BRICK_TIMED_ITEM_IDS: readonly BrickTimedItemId[] = ["hammer", "gold"];
type BrickItemEffect = { readonly kind: "blast"; readonly extra: number }
  | { readonly kind: "buff"; readonly durationMs: number }
  | { readonly kind: "shield" };
export const BRICK_ITEM_EFFECTS = {
  bomb: { kind: "blast", extra: 3 },
  hammer: { kind: "buff", durationMs: 20_000 },
  gold: { kind: "buff", durationMs: 20_000 },
  shield: { kind: "shield" },
} as const satisfies GameItemEffects<BrickItemId, BrickItemEffect>;

export interface BrickBuffs {
  readonly hammer: number;
  readonly gold: number;
  readonly shield: boolean;
}
export const EMPTY_BRICK_BUFFS: BrickBuffs = { hammer: 0, gold: 0, shield: false };

/** Validate buff timestamps read back from persisted attempt details. */
export function parseBrickBuffs(value: unknown): BrickBuffs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_BRICK_BUFFS;
  const raw = value as Record<string, unknown>;
  const timestamp = (key: string) => typeof raw[key] === "number" && Number.isSafeInteger(raw[key]) && raw[key] >= 0 ? raw[key] : 0;
  return { hammer: timestamp("hammer"), gold: timestamp("gold"), shield: raw.shield === true };
}

const ITEM_STRETCH = 9;

/**
 * One special brick in each nine-brick stretch, at slot 5-7; stable through retries/reconnects.
 * Special bricks are therefore at least 7 apart, more than one strike can ever remove (5).
 */
export function brickItemAt(seed: string, index: number): BrickItemId | null {
  const group = Math.floor(index / ITEM_STRETCH);
  const slot = 5 + hashString(`${seed}:slot:${group}`) % 3;
  if (index % ITEM_STRETCH !== slot) return null;
  const rotation = shuffled(BRICK_ITEM_IDS, `${seed}:items:${Math.floor(group / BRICK_ITEM_IDS.length)}`);
  return rotation[group % rotation.length]!;
}

export function activateBrickItem(buffs: BrickBuffs, item: BrickItemId | null, now: number): BrickBuffs {
  if (!item || item === "bomb") return buffs;
  if (item === "shield") return { ...buffs, shield: true };
  return { ...buffs, [item]: now + BRICK_ITEM_EFFECTS[item].durationMs };
}
