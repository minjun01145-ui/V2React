import {
  sharedItemEffectForGame,
  type SharedGameItemEffects,
} from "../../items/gameRules.ts";
import type { SharedItemId } from "../../items/catalog.ts";
import { ACID_RAIN_ITEM_KIND, type AcidRainItemKind } from "./acidRainEngine.ts";

export type AcidRainPersistentItemId = Extract<SharedItemId, "bomb" | "ice">;

export type AcidRainSharedItemEffect =
  | { readonly kind: "clear-all" }
  | { readonly kind: "slow-fall"; readonly durationMs: 10_000; readonly playbackRate: 0.5 };

export interface AcidRainItemStore {
  readonly inventory: Readonly<Record<AcidRainPersistentItemId, number>>;
  readonly grant: (itemId: AcidRainPersistentItemId) => Promise<boolean>;
  readonly consume: (itemId: AcidRainPersistentItemId) => Promise<boolean>;
}

export const ACID_RAIN_SHARED_ITEM_EFFECTS = Object.freeze({
  bomb: { kind: "clear-all" },
  ice: { kind: "slow-fall", durationMs: 10_000, playbackRate: 0.5 },
} as const satisfies SharedGameItemEffects<AcidRainSharedItemEffect>);

export function acidRainPersistentItemId(itemKind: AcidRainItemKind | null): AcidRainPersistentItemId | null {
  if (itemKind === ACID_RAIN_ITEM_KIND.BOMB) return "bomb";
  if (itemKind === ACID_RAIN_ITEM_KIND.ICE) return "ice";
  return null;
}

export function acidRainItemEffect(itemId: AcidRainPersistentItemId): AcidRainSharedItemEffect {
  const effect = sharedItemEffectForGame<AcidRainSharedItemEffect>(
    ACID_RAIN_SHARED_ITEM_EFFECTS,
    itemId,
  );
  if (!effect) throw new Error(`산성비 아이템 효과가 없습니다: ${itemId}`);
  return effect;
}
