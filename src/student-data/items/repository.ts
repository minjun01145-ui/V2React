import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/firebaseClient.ts";
import {
  parseSharedItemInventory,
  type SharedItemInventory,
} from "../../items/inventory.ts";
import type { SharedItemId } from "../../items/catalog.ts";

export interface ItemInventoryMutationResult {
  readonly inventory: SharedItemInventory;
}

export interface ConsumeItemResult extends ItemInventoryMutationResult {
  readonly consumed: boolean;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function operationId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `${prefix}:${randomId}`;
}

function parseInventory(value: unknown): SharedItemInventory {
  return parseSharedItemInventory(record(value) ? value.inventory : null);
}

const getInventoryCallable = httpsCallable<undefined, unknown>(functions, "getStudentItemInventory");
const consumeItemCallable = httpsCallable<
  { readonly itemId: SharedItemId; readonly operationId: string },
  unknown
>(functions, "consumeStudentItem");

export async function getStudentItemInventory(): Promise<SharedItemInventory> {
  const result = await getInventoryCallable();
  return parseInventory(result.data);
}

export async function consumeStudentItem(itemId: SharedItemId): Promise<ConsumeItemResult> {
  const result = await consumeItemCallable({
    itemId,
    operationId: operationId("consume"),
  });
  const data = record(result.data) ? result.data : {};
  return {
    inventory: parseInventory(data),
    consumed: data.consumed === true,
  };
}
