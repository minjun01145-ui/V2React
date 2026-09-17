export const SHARED_ITEM_IDS = ["ink", "bomb", "ice"] as const;
export type SharedItemId = (typeof SHARED_ITEM_IDS)[number];

export const ACID_RAIN_REWARD_ITEM_IDS = ["bomb", "ice"] as const;
export type AcidRainRewardItemId = (typeof ACID_RAIN_REWARD_ITEM_IDS)[number];

export type StoredSharedItemInventory = Readonly<Record<SharedItemId, number>>;

export const EMPTY_STORED_SHARED_ITEM_INVENTORY: StoredSharedItemInventory = Object.freeze({
  ink: 0,
  bomb: 0,
  ice: 0,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function quantity(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export function isSharedItemId(value: unknown): value is SharedItemId {
  return typeof value === "string" && (SHARED_ITEM_IDS as readonly string[]).includes(value);
}

export function isAcidRainRewardItemId(value: unknown): value is AcidRainRewardItemId {
  return typeof value === "string" && (ACID_RAIN_REWARD_ITEM_IDS as readonly string[]).includes(value);
}

export function parseStoredSharedItemInventory(value: unknown): StoredSharedItemInventory {
  const source = isRecord(value) ? value : {};
  return {
    ink: quantity(source.ink),
    bomb: quantity(source.bomb),
    ice: quantity(source.ice),
  };
}

export function grantStoredSharedItem(
  inventory: StoredSharedItemInventory,
  itemId: SharedItemId,
): StoredSharedItemInventory {
  return { ...inventory, [itemId]: inventory[itemId] + 1 };
}

export interface ConsumeStoredSharedItemResult {
  readonly consumed: boolean;
  readonly inventory: StoredSharedItemInventory;
}

export function consumeStoredSharedItem(
  inventory: StoredSharedItemInventory,
  itemId: SharedItemId,
): ConsumeStoredSharedItemResult {
  if (inventory[itemId] <= 0) return { consumed: false, inventory };
  return {
    consumed: true,
    inventory: { ...inventory, [itemId]: inventory[itemId] - 1 },
  };
}
