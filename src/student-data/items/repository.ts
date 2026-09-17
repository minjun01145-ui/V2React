import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/firebaseClient.ts";
import {
  parseSharedItemInventory,
  type SharedItemInventory,
} from "../../items/inventory.ts";
import type { SharedItemId } from "../../items/catalog.ts";

export type AcidRainPersistentItemId = Extract<SharedItemId, "bomb" | "ice">;

interface InventoryResponse {
  readonly inventory: SharedItemInventory;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInventoryResponse(value: unknown): InventoryResponse {
  return {
    inventory: parseSharedItemInventory(record(value) ? value.inventory : null),
  };
}

const getInventoryCallable = httpsCallable<undefined, unknown>(functions, "getStudentItemInventory");
const grantAcidRainItemCallable = httpsCallable<
  { readonly itemId: AcidRainPersistentItemId; readonly operationId: string },
  unknown
>(functions, "grantAcidRainItem");
const consumeItemCallable = httpsCallable<
  { readonly itemId: SharedItemId; readonly operationId: string },
  unknown
>(functions, "consumeStudentItem");

export async function getStudentItemInventory(): Promise<SharedItemInventory> {
  const result = await getInventoryCallable();
  return parseInventoryResponse(result.data).inventory;
}

export async function persistAcidRainItemGrant(
  itemId: AcidRainPersistentItemId,
  operationId: string,
): Promise<SharedItemInventory> {
  const result = await grantAcidRainItemCallable({ itemId, operationId });
  return parseInventoryResponse(result.data).inventory;
}

export async function persistStudentItemConsumption(
  itemId: SharedItemId,
  operationId: string,
): Promise<SharedItemInventory> {
  const result = await consumeItemCallable({ itemId, operationId });
  return parseInventoryResponse(result.data).inventory;
}
