import type { SharedItemId } from "./catalog.ts";
import { sharedItemStacks, type SharedItemInventory } from "./inventory.ts";
import type { GameItemEffects, ItemStack } from "./types.ts";

export type SharedGameItemEffects<Effect> = GameItemEffects<SharedItemId, Effect>;

export function gameSupportsSharedItem<Effect>(
  effects: SharedGameItemEffects<Effect>,
  itemId: SharedItemId,
): boolean {
  return Object.prototype.hasOwnProperty.call(effects, itemId);
}

export function sharedItemEffectForGame<Effect>(
  effects: SharedGameItemEffects<Effect>,
  itemId: SharedItemId,
): Effect | null {
  if (!gameSupportsSharedItem(effects, itemId)) return null;
  return effects[itemId] ?? null;
}

/** Only exposes account-owned items that the current concrete game explicitly supports. */
export function usableSharedItemStacks<Effect>(
  inventory: SharedItemInventory,
  effects: SharedGameItemEffects<Effect>,
): readonly ItemStack<SharedItemId>[] {
  return sharedItemStacks(inventory).filter(({ itemId }) => gameSupportsSharedItem(effects, itemId));
}
