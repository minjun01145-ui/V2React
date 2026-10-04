import { SHARED_ITEM_CATALOG } from "../../items/catalog.ts";
import type { GameItemEffects, SharedItemDefinition } from "../../items/types.ts";
import { hashString, shuffled } from "../../game-engine/core/random.ts";
import { createGameAnnouncement } from "../../game-engine/effects/model.ts";

// These are round pickups, not grants to the account-owned inventory.
export const BRICK_ITEMS = {
  bomb: { ...SHARED_ITEM_CATALOG.bomb, name: "3폭탄", description: "위의 벽돌 3개 폭발" },
  hammer: { id: "hammer", name: "슈퍼 망치", emoji: "🔨", category: "utility", consumable: true, description: "20초간 한 번에 벽돌 2개" },
  gold: { id: "gold", name: "황금 망치", emoji: "✨", category: "utility", consumable: true, description: "20초간 점수 2배" },
  lightning: { id: "lightning", name: "번개 망치", emoji: "⚡", category: "utility", consumable: true, description: "10초간 연타 속도 2배" },
  shield: { id: "shield", name: "보호막", emoji: "🛡️", category: "defense", consumable: true, description: "오답 1회 콤보·반동 보호" },
} as const satisfies Record<string, SharedItemDefinition>;
export type BrickItemId = keyof typeof BRICK_ITEMS;
export const BRICK_ITEM_IDS = Object.keys(BRICK_ITEMS) as BrickItemId[];
type BrickItemEffect = { readonly kind: "blast"; readonly extra: number }
  | { readonly kind: "buff"; readonly durationMs: number }
  | { readonly kind: "shield" };
export const BRICK_ITEM_EFFECTS = {
  bomb: { kind: "blast", extra: 3 },
  hammer: { kind: "buff", durationMs: 20_000 },
  gold: { kind: "buff", durationMs: 20_000 },
  lightning: { kind: "buff", durationMs: 10_000 },
  shield: { kind: "shield" },
} as const satisfies GameItemEffects<BrickItemId, BrickItemEffect>;

export interface BrickBuffs {
  readonly hammer: number;
  readonly gold: number;
  readonly lightning: number;
  readonly shield: boolean;
}
export const EMPTY_BRICK_BUFFS: BrickBuffs = { hammer: 0, gold: 0, lightning: 0, shield: false };

/** Validate buff timestamps read back from persisted attempt details. */
export function parseBrickBuffs(value: unknown): BrickBuffs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_BRICK_BUFFS;
  const raw = value as Record<string, unknown>;
  const timestamp = (key: string) => typeof raw[key] === "number" && Number.isSafeInteger(raw[key]) && raw[key] >= 0 ? raw[key] : 0;
  return { hammer: timestamp("hammer"), gold: timestamp("gold"), lightning: timestamp("lightning"), shield: raw.shield === true };
}

/** One luminous brick in each nine-brick stretch; stable through retries/reconnects. */
export function brickItemAt(seed: string, index: number): BrickItemId | null {
  const group = Math.floor(index / 9);
  const slot = 5 + hashString(`${seed}:slot:${group}`) % 3;
  if (index % 9 !== slot) return null;
  const rotation = shuffled(BRICK_ITEM_IDS, `${seed}:items:${Math.floor(group / 5)}`);
  return rotation[group % rotation.length]!;
}

export function activateBrickItem(buffs: BrickBuffs, item: BrickItemId | null, now: number): BrickBuffs {
  if (!item || item === "bomb") return buffs;
  if (item === "shield") return { ...buffs, shield: true };
  return { ...buffs, [item]: now + BRICK_ITEM_EFFECTS[item].durationMs };
}

export function brickItemAnnouncement(item: BrickItemId) {
  return createGameAnnouncement({ headline: `${BRICK_ITEMS[item].emoji} ${BRICK_ITEMS[item].name}!!`,
    metric: BRICK_ITEMS[item].description, durationMs: 1_150 });
}
