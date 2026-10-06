import type { SkatingLane } from "./model.ts";
import type { SkatingItemKind } from "./sim/items.ts";

/**
 * One-off moments the scene and the sound both react to. The runner and the
 * live channel emit them; nothing here changes game state.
 */
export type SkatingFxEvent =
  | { readonly type: "gate"; readonly gateIndex: number; readonly lane: SkatingLane; readonly correct: boolean; readonly combo: number; readonly points: number }
  | { readonly type: "crash"; readonly playerId: string }
  | { readonly type: "respawn"; readonly playerId: string }
  | { readonly type: "item"; readonly kind: SkatingItemKind; readonly itemId: number }
  | { readonly type: "punch"; readonly attackerId: string; readonly targetId: string | null; readonly direction: -1 | 1 }
  | { readonly type: "bump" }
  | { readonly type: "tick"; readonly count: number };

export type SkatingFxListener = (event: SkatingFxEvent) => void;

export interface SkatingFx {
  emit(event: SkatingFxEvent): void;
  subscribe(listener: SkatingFxListener): () => void;
}

export function createSkatingFx(): SkatingFx {
  const listeners = new Set<SkatingFxListener>();
  return {
    emit(event) {
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
