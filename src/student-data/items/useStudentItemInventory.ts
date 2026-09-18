import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_SHARED_ITEM_INVENTORY,
  type SharedItemInventory,
} from "../../items/inventory.ts";
import type { SharedItemId } from "../../items/catalog.ts";
import {
  consumeStudentItem,
  getStudentItemInventory,
  type ItemInventoryMutationResult,
} from "./repository.ts";

export function useStudentItemInventory() {
  const [inventory, setInventory] = useState<SharedItemInventory>(EMPTY_SHARED_ITEM_INVENTORY);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const applyInventory = useCallback((next: SharedItemInventory): void => {
    setInventory(next);
  }, []);

  useEffect(() => {
    let active = true;
    setAvailable(false);
    setError(null);

    void getStudentItemInventory()
      .then((next) => {
        if (!active) return;
        applyInventory(next);
        setAvailable(true);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason : new Error(String(reason)));
        setAvailable(false);
      });

    return () => {
      active = false;
    };
  }, [applyInventory]);

  const runMutation = useCallback(async <T extends ItemInventoryMutationResult>(
    operation: () => Promise<T>,
  ): Promise<T> => {
    let result: T | null = null;
    let failure: unknown = null;

    queue.current = queue.current
      .then(async () => {
        try {
          result = await operation();
          applyInventory(result.inventory);
          setError(null);
        } catch (reason: unknown) {
          failure = reason;
          setError(reason instanceof Error ? reason : new Error(String(reason)));
        }
      });

    await queue.current;

    if (failure) throw failure;
    if (!result) throw new Error("아이템 인벤토리 작업 결과를 받지 못했습니다.");
    return result;
  }, [applyInventory]);

  const consumeItem = useCallback(async (itemId: SharedItemId): Promise<boolean> => {
    const result = await runMutation(() => consumeStudentItem(itemId));
    return result.consumed;
  }, [runMutation]);

  return {
    inventory,
    available,
    error,
    consumeItem,
    runMutation,
  } as const;
}
