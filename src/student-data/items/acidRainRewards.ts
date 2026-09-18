import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/firebaseClient.ts";
import {
  parseSharedItemInventory,
  type SharedItemInventory,
} from "../../items/inventory.ts";
import type { SharedItemId } from "../../items/catalog.ts";
import type { ItemInventoryMutationResult } from "./repository.ts";

type AcidRainRewardItemId = Extract<SharedItemId, "bomb" | "ice">;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function operationId(): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `acid-rain-grant:${randomId}`;
}

const grantAcidRainItemCallable = httpsCallable<
  { readonly itemId: AcidRainRewardItemId; readonly operationId: string },
  unknown
>(functions, "grantAcidRainItem");

export async function grantAcidRainReward(
  itemId: AcidRainRewardItemId,
): Promise<ItemInventoryMutationResult> {
  const result = await grantAcidRainItemCallable({
    itemId,
    operationId: operationId(),
  });
  const data = record(result.data) ? result.data : {};
  const inventory: SharedItemInventory = parseSharedItemInventory(data.inventory);
  return { inventory };
}
