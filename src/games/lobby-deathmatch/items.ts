import { createSeededRandom } from "../../game-engine/core/random.ts";
import { ITEM_HOVER, type PartyItem, type PartyItemKind } from "../../game-engine/platformer-party/buffs.ts";
import type { PartyItemSource } from "../../game-engine/platformer-party/PowerUpTracker.ts";
import type { ArenaMap } from "./maps/types.ts";

/** The tower's items minus the star (no invincibility here), plus the fighting extras. */
export const DEATHMATCH_ITEM_KINDS: readonly PartyItemKind[] = ["speed", "jump", "dash", "punch", "attack", "sword"];
/** A fresh pair of items appears every window; unclaimed ones vanish when it ends. */
export const DEATHMATCH_ITEM_WINDOW_MS = 12_000;
const ITEMS_PER_WINDOW = 2;
/** Pickups use the selected map's world positions on every client. */
export function createDeathmatchItems(map: ArenaMap): PartyItemSource {
  const spots = map.platforms.filter((platform) => platform.kind === "step");
  const windowItems = (window: number): PartyItem[] => {
    const random = createSeededRandom(`deathmatch:${map.id}:items:${window}`);
    const available = [...spots.keys()];
    const items: PartyItem[] = [];
    for (let slot = 0; slot < ITEMS_PER_WINDOW && available.length > 0; slot += 1) {
      const spot = available.splice(Math.floor(random() * available.length), 1)[0]!;
      const platform = spots[spot]!;
      const kind = DEATHMATCH_ITEM_KINDS[Math.floor(random() * DEATHMATCH_ITEM_KINDS.length)]!;
      items.push({ id: `d${spot}-${window}`, kind, x: platform.x + platform.width / 2, y: platform.y - ITEM_HOVER });
    }
    return items;
  };
  return {
    itemsAt: (nowMs) => windowItems(Math.floor(nowMs / DEATHMATCH_ITEM_WINDOW_MS)),
    kindOf: (id) => {
      const match = /^d(\d+)-(\d+)$/.exec(id);
      if (!match) return null;
      return windowItems(Number(match[2])).find((item) => item.id === id)?.kind ?? null;
    },
  };
}
