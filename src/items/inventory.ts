import { SHARED_ITEM_IDS, type SharedItemId } from "./catalog.ts";
import type { ItemInventory, ItemStack } from "./types.ts";

export type SharedItemInventory = ItemInventory<SharedItemId>;

export const EMPTY_SHARED_ITEM_INVENTORY: SharedItemInventory = Object.freeze({});

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storedQuantity(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function positiveQuantity(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("아이템 수량은 1 이상의 안전한 정수여야 합니다.");
  }
  return value;
}

/** Parse untrusted persisted/API data at the item boundary. Unknown item ids are ignored. */
export function parseSharedItemInventory(value: unknown): SharedItemInventory {
  if (!record(value)) return EMPTY_SHARED_ITEM_INVENTORY;
  const parsed: Partial<Record<SharedItemId, number>> = {};
  for (const itemId of SHARED_ITEM_IDS) {
    const quantity = storedQuantity(value[itemId]);
    if (quantity > 0) parsed[itemId] = quantity;
  }
  return parsed;
}

export function sharedItemQuantity(inventory: SharedItemInventory, itemId: SharedItemId): number {
  return storedQuantity(inventory[itemId]);
}

export function grantSharedItem(
  inventory: SharedItemInventory,
  itemId: SharedItemId,
  quantity = 1,
): SharedItemInventory {
  const amount = positiveQuantity(quantity);
  return {
    ...inventory,
    [itemId]: sharedItemQuantity(inventory, itemId) + amount,
  };
}

export interface ConsumeSharedItemResult {
  readonly consumed: boolean;
  readonly inventory: SharedItemInventory;
}

export function consumeSharedItem(
  inventory: SharedItemInventory,
  itemId: SharedItemId,
  quantity = 1,
): ConsumeSharedItemResult {
  const amount = positiveQuantity(quantity);
  const current = sharedItemQuantity(inventory, itemId);
  if (current < amount) return { consumed: false, inventory };

  const next: Partial<Record<SharedItemId, number>> = { ...inventory };
  const remaining = current - amount;
  if (remaining > 0) next[itemId] = remaining;
  else delete next[itemId];
  return { consumed: true, inventory: next };
}

export function sharedItemStacks(inventory: SharedItemInventory): readonly ItemStack<SharedItemId>[] {
  return SHARED_ITEM_IDS.flatMap((itemId) => {
    const quantity = sharedItemQuantity(inventory, itemId);
    return quantity > 0 ? [{ itemId, quantity }] : [];
  });
}
