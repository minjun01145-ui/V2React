import { createSeededRandom } from "../../game-engine/core/random.ts";
import {
  CHUNK_LINE_UP_ROW_LEFT,
  CHUNK_LINE_UP_ROW_RIGHT,
  chunkLineUpFloorY,
  chunkLineUpGroundY,
  chunkLineUpProps,
} from "./layout.ts";

/**
 * Power-up items. Every client derives the same spawns from the round id and
 * the shared server clock, so only the pickup itself needs the network: a
 * first-come claim on the item id. Buffs are derived from those claims, which
 * also lets everyone see who is currently boosted.
 */

export type ChunkLineUpItemKind = "speed" | "jump" | "punch";

export const ITEM_SLOT_MS = 10_000;
export const ITEM_LIFETIME_MS = 20_000;
export const ITEMS_PER_SLOT = 2;
export const BUFF_DURATION_MS = 30_000;
export const ITEM_HOVER = 26;
const ITEM_KINDS: readonly ChunkLineUpItemKind[] = ["speed", "jump", "punch"];

export const BUFF_EFFECT = {
  speed: { runMultiplier: 2 },
  jump: { jumpMultiplier: 1.32 },
  punch: { powered: true },
} as const;

export const ITEM_LABEL: Readonly<Record<ChunkLineUpItemKind, string>> = {
  speed: "이동속도 2배",
  jump: "슈퍼 점프",
  punch: "펀치 강화",
};

export interface ChunkLineUpItem {
  readonly id: string;
  readonly kind: ChunkLineUpItemKind;
  /** Centre of the item; it floats ITEM_HOVER above the surface it rests on. */
  readonly x: number;
  readonly y: number;
  readonly spawnAtMs: number;
  readonly expiresAtMs: number;
}

export interface ItemClaim {
  readonly id: string;
  readonly by: string;
  readonly atMs: number;
}

export type ActiveBuffs = ReadonlyMap<ChunkLineUpItemKind, number>;

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
    const kind = ITEM_KINDS[Math.floor(random() * ITEM_KINDS.length)] ?? "speed";
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
export function chunkLineUpItemKind(roundId: string, floorCount: number, id: string): ChunkLineUpItemKind | null {
  const match = /^i(-?\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  return slotItems(roundId, floorCount, Number(match[1]))[Number(match[2])]?.kind ?? null;
}

/** Active buffs for one player: kind -> end time. Re-picking a kind restarts its timer. */
export function chunkLineUpActiveBuffs(
  claims: readonly ItemClaim[],
  playerId: string,
  kindOf: (id: string) => ChunkLineUpItemKind | null,
  nowMs: number,
): Map<ChunkLineUpItemKind, number> {
  const buffs = new Map<ChunkLineUpItemKind, number>();
  for (const claim of claims) {
    if (claim.by !== playerId) continue;
    const kind = kindOf(claim.id);
    const endsAt = claim.atMs + BUFF_DURATION_MS;
    if (!kind || endsAt <= nowMs) continue;
    buffs.set(kind, Math.max(buffs.get(kind) ?? 0, endsAt));
  }
  return buffs;
}
