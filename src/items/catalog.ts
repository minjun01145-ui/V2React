import type { SharedItemDefinition } from "./types.ts";

export const SHARED_ITEM_CATALOG = Object.freeze({
  ink: {
    id: "ink",
    name: "먹물",
    emoji: "🦑",
    category: "attack",
    description: "게임마다 다른 방해 효과로 해석되는 소비형 아이템",
    consumable: true,
  },
  bomb: {
    id: "bomb",
    name: "폭탄",
    emoji: "💣",
    category: "attack",
    description: "게임마다 다른 공격 효과로 해석되는 소비형 아이템",
    consumable: true,
  },
  ice: {
    id: "ice",
    name: "얼음",
    emoji: "❄️",
    category: "utility",
    description: "게임마다 다른 감속·방해 효과로 해석되는 소비형 아이템",
    consumable: true,
  },
} as const satisfies Record<string, SharedItemDefinition>);

export type SharedItemId = keyof typeof SHARED_ITEM_CATALOG;

export const SHARED_ITEM_IDS = Object.freeze(
  Object.keys(SHARED_ITEM_CATALOG) as SharedItemId[],
);

export function isSharedItemId(value: unknown): value is SharedItemId {
  return typeof value === "string"
    && Object.prototype.hasOwnProperty.call(SHARED_ITEM_CATALOG, value);
}

export function getSharedItemDefinition(itemId: SharedItemId): SharedItemDefinition {
  return SHARED_ITEM_CATALOG[itemId];
}
