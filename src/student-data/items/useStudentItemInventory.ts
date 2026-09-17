import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../../firebase/firebaseClient.ts";
import {
  consumeSharedItem,
  EMPTY_SHARED_ITEM_INVENTORY,
  grantSharedItem,
  type SharedItemInventory,
} from "../../items/inventory.ts";
import type { SharedItemId } from "../../items/catalog.ts";
import {
  getStudentItemInventory,
  persistAcidRainItemGrant,
  persistStudentItemConsumption,
  type AcidRainPersistentItemId,
} from "./repository.ts";

function newOperationId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `${prefix}:${randomId}`;
}

export function useStudentItemInventory() {
  const [inventory, setInventory] = useState<SharedItemInventory>(EMPTY_SHARED_ITEM_INVENTORY);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inventoryRef = useRef<SharedItemInventory>(EMPTY_SHARED_ITEM_INVENTORY);
  const mutationVersion = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const applyInventory = useCallback((next: SharedItemInventory): void => {
    inventoryRef.current = next;
    setInventory(next);
  }, []);

  const enqueue = useCallback((
    version: number,
    operation: () => Promise<SharedItemInventory>,
  ): void => {
    queue.current = queue.current
      .then(operation)
      .then((next) => {
        if (mutationVersion.current === version) applyInventory(next);
        setError(null);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason : new Error(String(reason)));
      });
  }, [applyInventory]);

  useEffect(() => {
    mutationVersion.current += 1;
    const loadVersion = mutationVersion.current;
    inventoryRef.current = EMPTY_SHARED_ITEM_INVENTORY;
    setInventory(EMPTY_SHARED_ITEM_INVENTORY);
    setError(null);

    if (!auth.currentUser) {
      setAvailable(false);
      return undefined;
    }

    let active = true;
    setAvailable(true);
    void getStudentItemInventory()
      .then((next) => {
        if (!active || mutationVersion.current !== loadVersion) return;
        applyInventory(next);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason : new Error(String(reason)));
      });

    return () => {
      active = false;
    };
  }, [applyInventory]);

  const grantAcidRainItem = useCallback((itemId: AcidRainPersistentItemId): void => {
    if (!available) return;
    const next = grantSharedItem(inventoryRef.current, itemId);
    const version = mutationVersion.current + 1;
    mutationVersion.current = version;
    applyInventory(next);
    enqueue(version, () => persistAcidRainItemGrant(itemId, newOperationId("acid-rain-grant")));
  }, [applyInventory, available, enqueue]);

  const consumeItem = useCallback((itemId: SharedItemId): boolean => {
    if (!available) return false;
    const result = consumeSharedItem(inventoryRef.current, itemId);
    if (!result.consumed) return false;

    const version = mutationVersion.current + 1;
    mutationVersion.current = version;
    applyInventory(result.inventory);
    enqueue(version, () => persistStudentItemConsumption(itemId, newOperationId("consume")));
    return true;
  }, [applyInventory, available, enqueue]);

  return {
    inventory,
    available,
    error,
    grantAcidRainItem,
    consumeItem,
  } as const;
}
