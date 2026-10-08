import { createSeededRandom } from "../../game-engine/core/random.ts";
import { ITEM_HOVER, type PartyItem, type PartyItemKind } from "../../game-engine/platformer-party/buffs.ts";
import type { PartyItemSource } from "../../game-engine/platformer-party/PowerUpTracker.ts";
import { ARENA_PLATFORMS } from "./arena.ts";

/** The tower's items minus the star (no invincibility here), plus the fighting extras. */
export const DEATHMATCH_ITEM_KINDS: readonly PartyItemKind[] = ["speed", "jump", "dash", "punch", "attack", "sword"];
/** A fresh pair of items appears every window; unclaimed ones vanish when it ends. */
export const DEATHMATCH_ITEM_WINDOW_MS = 12_000;
const ITEMS_PER_WINDOW = 2;
/** Items rest on the static platforms only, so nobody has to chase a moving one. */
const SPOT_PLATFORMS = ARENA_PLATFORMS.filter((platform) => platform.kind === "step");

function windowItems(window: number): PartyItem[] {
  const random = createSeededRandom(`deathmatch:items:${window}`);
  const spots = [...SPOT_PLATFORMS.keys()];
  const items: PartyItem[] = [];
  for (let slot = 0; slot < ITEMS_PER_WINDOW && spots.length > 0; slot += 1) {
    const spot = spots.splice(Math.floor(random() * spots.length), 1)[0]!;
    const platform = SPOT_PLATFORMS[spot]!;
    const kind = DEATHMATCH_ITEM_KINDS[Math.floor(random() * DEATHMATCH_ITEM_KINDS.length)]!;
    items.push({ id: `d${spot}-${window}`, kind, x: platform.x + platform.width / 2, y: platform.y - ITEM_HOVER });
  }
  return items;
}

export const DEATHMATCH_ITEMS: PartyItemSource = {
  itemsAt: (nowMs) => windowItems(Math.floor(nowMs / DEATHMATCH_ITEM_WINDOW_MS)),
  kindOf: (id) => {
    const match = /^d(\d+)-(\d+)$/.exec(id);
    if (!match) return null;
    return windowItems(Number(match[2])).find((item) => item.id === id)?.kind ?? null;
  },
};
