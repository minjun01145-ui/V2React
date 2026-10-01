import { createSeededRandom } from "../../game-engine/core/random.ts";
import { ITEM_HOVER, PARTY_ITEM_KINDS, type PartyItem, type PartyItemKind } from "../../game-engine/platformer-party/buffs.ts";
import {
  CHUNK_LINE_UP_ROW_LEFT,
  CHUNK_LINE_UP_ROW_RIGHT,
  chunkLineUpFloorY,
  chunkLineUpGroundY,
  chunkLineUpProps,
} from "./layout.ts";

/**
 * Where and when power-ups appear in the tower. Every client derives the same
 * spawns from the round id and the shared server clock; the pickup rules and
 * buffs themselves live in game-engine/platformer-party.
 */

export const ITEM_SLOT_MS = 10_000;
export const ITEM_LIFETIME_MS = 20_000;
export const ITEMS_PER_SLOT = 2;

export interface ChunkLineUpItem extends PartyItem {
  readonly spawnAtMs: number;
  readonly expiresAtMs: number;
}

/** Surfaces items can rest on: sentence shelves, static steps and the lobby. */
export function chunkLineUpItemSpots(floorCount: number): Array<{ readonly x: number; readonly surfaceY: number }> {
  const spots: Array<{ readonly x: number; readonly surfaceY: number }> = [];
  const rowWidth = CHUNK_LINE_UP_ROW_RIGHT - CHUNK_LINE_UP_ROW_LEFT;
  for (let floor = 0; floor < floorCount; floor += 1) {
    for (const ratio of [0.18, 0.5, 0.82]) {
      spots.push({ x: Math.round(CHUNK_LINE_UP_ROW_LEFT + rowWidth * ratio), surfaceY: chunkLineUpFloorY(floor, floorCount) });
    }
  }
  for (const prop of chunkLineUpProps(floorCount)) {
    if (prop.kind === "step") spots.push({ x: Math.round(prop.x + prop.width / 2), surfaceY: prop.y });
  }
  for (const ratio of [0.25, 0.75]) {
    spots.push({ x: Math.round(CHUNK_LINE_UP_ROW_LEFT + rowWidth * ratio), surfaceY: chunkLineUpGroundY(floorCount) });
  }
  return spots;
}

function slotItems(roundId: string, floorCount: number, slot: number): ChunkLineUpItem[] {
  const spots = chunkLineUpItemSpots(floorCount);
  const random = createSeededRandom(`chunk-line-up:items:${roundId}:${slot}`);
  const used = new Set<number>();
  const items: ChunkLineUpItem[] = [];
  for (let index = 0; index < ITEMS_PER_SLOT && used.size < spots.length; index += 1) {
    let spotIndex = Math.floor(random() * spots.length);
    while (used.has(spotIndex)) spotIndex = (spotIndex + 1) % spots.length;
    used.add(spotIndex);
    const spot = spots[spotIndex]!;
    const kind: PartyItemKind = PARTY_ITEM_KINDS[Math.floor(random() * PARTY_ITEM_KINDS.length)] ?? "speed";
    const spawnAtMs = slot * ITEM_SLOT_MS;
    items.push({
      id: `i${slot}-${index}`,
      kind,
      x: spot.x,
      y: spot.surfaceY - ITEM_HOVER,
      spawnAtMs,
      expiresAtMs: spawnAtMs + ITEM_LIFETIME_MS,
    });
  }
  return items;
}

/** Items on the field at `nowMs` (before removing claimed ones). */
export function chunkLineUpItemsAt(roundId: string, floorCount: number, nowMs: number): ChunkLineUpItem[] {
  if (floorCount < 1) return [];
  const currentSlot = Math.floor(nowMs / ITEM_SLOT_MS);
  const oldestSlot = Math.floor((nowMs - ITEM_LIFETIME_MS) / ITEM_SLOT_MS) + 1;
  const items: ChunkLineUpItem[] = [];
  for (let slot = oldestSlot; slot <= currentSlot; slot += 1) {
    items.push(...slotItems(roundId, floorCount, slot).filter((item) => nowMs >= item.spawnAtMs && nowMs < item.expiresAtMs));
  }
  return items;
}

/** Kind of a claimed item id, recomputed from the same seed. */
export function chunkLineUpItemKind(roundId: string, floorCount: number, id: string): PartyItemKind | null {
  const match = /^i(-?\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  return slotItems(roundId, floorCount, Number(match[1]))[Number(match[2])]?.kind ?? null;
}
