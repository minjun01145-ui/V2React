import { hashString } from "../../../game-engine/core/random.ts";
import { SKATING_GATE_SPACING, skatingGateIndexAtX, skatingGateX, skatingLaneY, type SkatingLane } from "../model.ts";
import { SKATING_BASE_SPEED } from "./physics.ts";

export type SkatingItemKind = "booster" | "speed-up";

export interface SkatingItem {
  /** Index of the gap after gate `id`; one item at most per gap. */
  readonly id: number;
  readonly kind: SkatingItemKind;
  readonly x: number;
  readonly lane: SkatingLane;
}

export interface SkatingBuffs {
  readonly boostUntilMs: number;
  readonly speedUps: number;
}

export const NO_BUFFS: SkatingBuffs = { boostUntilMs: 0, speedUps: 0 };
export const BOOSTER_MS = 10_000;
export const BOOSTER_MULTIPLIER = 1.9;
export const SPEED_UP_STEP = 0.1;
/** Speed-ups stack, but stop at +50% so the gates stay readable. */
export const MAX_SPEED_UPS = 5;
/** Sideways distance from an item's lane centre that still collects it. */
export const ITEM_PICKUP_REACH = 0.5;

const ITEM_CHANCE_PERCENT = 45;
const BOOSTER_SHARE_PERCENT = 45;

/**
 * Items are laid out from the round seed, so every student sees them in the
 * same places; each student collects their own copy.
 */
export function skatingItemAfterGate(seed: string, gateIndex: number): SkatingItem | null {
  if (gateIndex < 0) return null;
  const roll = hashString(`${seed}:item:${gateIndex}`);
  if (roll % 100 >= ITEM_CHANCE_PERCENT) return null;
  const kindRoll = hashString(`${seed}:kind:${gateIndex}`) % 100;
  return {
    id: gateIndex,
    kind: kindRoll < BOOSTER_SHARE_PERCENT ? "booster" : "speed-up",
    x: skatingGateX(gateIndex) + SKATING_GATE_SPACING / 2,
    lane: (Math.floor(roll / 100) % 3) as SkatingLane,
  };
}

export function skatingItemsBetween(seed: string, fromX: number, toX: number): SkatingItem[] {
  const items: SkatingItem[] = [];
  for (let gateIndex = Math.max(0, skatingGateIndexAtX(fromX)); skatingGateX(gateIndex) <= toX; gateIndex += 1) {
    const item = skatingItemAfterGate(seed, gateIndex);
    if (item && item.x >= fromX && item.x <= toX) items.push(item);
  }
  return items;
}

export function canCollectItem(item: SkatingItem, y: number): boolean {
  return Math.abs(y - skatingLaneY(item.lane)) <= ITEM_PICKUP_REACH;
}

export function applySkatingItem(buffs: SkatingBuffs, kind: SkatingItemKind, nowMs: number): SkatingBuffs {
  if (kind === "booster") return { ...buffs, boostUntilMs: Math.max(buffs.boostUntilMs, nowMs) + BOOSTER_MS };
  return { ...buffs, speedUps: Math.min(MAX_SPEED_UPS, buffs.speedUps + 1) };
}

export function isBoosting(buffs: SkatingBuffs, nowMs: number): boolean {
  return nowMs < buffs.boostUntilMs;
}

/** Faster skating means less time per gate; that is the point of the items. */
export function skatingForwardSpeed(buffs: SkatingBuffs, nowMs: number): number {
  const permanent = 1 + buffs.speedUps * SPEED_UP_STEP;
  return SKATING_BASE_SPEED * permanent * (isBoosting(buffs, nowMs) ? BOOSTER_MULTIPLIER : 1);
}
