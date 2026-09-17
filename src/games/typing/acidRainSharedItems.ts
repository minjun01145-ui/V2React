import type { SharedGameItemEffects } from "../../items/gameRules.ts";
import type { SharedItemId } from "../../items/catalog.ts";
import { ACID_RAIN_ITEM_KIND, type AcidRainItemKind } from "./acidRainEngine.ts";

export type AcidRainPersistentItemId = Extract<SharedItemId, "bomb" | "ice">;

export type AcidRainSharedItemEffect =
  | { readonly kind: "clear-all" }
  | { readonly kind: "slow-fall"; readonly durationMs: 10_000; readonly playbackRate: 0.5 };

export const ACID_RAIN_SHARED_ITEM_EFFECTS = Object.freeze({
  bomb: { kind: "clear-all" },
  ice: { kind: "slow-fall", durationMs: 10_000, playbackRate: 0.5 },
} as const satisfies SharedGameItemEffects<AcidRainSharedItemEffect>);

export function acidRainPersistentItemId(itemKind: AcidRainItemKind | null): AcidRainPersistentItemId | null {
  if (itemKind === ACID_RAIN_ITEM_KIND.BOMB) return "bomb";
  if (itemKind === ACID_RAIN_ITEM_KIND.ICE) return "ice";
  return null;
}
