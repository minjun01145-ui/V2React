import type { SharedItemId } from "../items/model.js";

export const ACID_RAIN_REWARD_ITEM_IDS = ["bomb", "ice"] as const;
export type AcidRainRewardItemId = (typeof ACID_RAIN_REWARD_ITEM_IDS)[number];

export const ACID_RAIN_REWARD_COOLDOWN_MS = 25_000;

export function isAcidRainRewardItemId(value: unknown): value is AcidRainRewardItemId {
  return typeof value === "string"
    && (ACID_RAIN_REWARD_ITEM_IDS as readonly SharedItemId[]).includes(value as SharedItemId);
}
