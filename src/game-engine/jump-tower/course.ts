import { createSeededRandom } from "../core/random.ts";
import { ITEM_HOVER, PARTY_ITEM_KINDS, type PartyItem, type PartyItemKind } from "../platformer-party/buffs.ts";

/**
 * The endless climb. Platform `k` sits k steps above the ground; its position,
 * width and gadgets come from the room seed, so every player in the room climbs
 * the same tower and remote players line up with local platforms.
 */

export const CLIMB_WORLD_WIDTH = 900;
/** Vertical distance between consecutive platforms: one plain jump clears it. */
export const CLIMB_STEP = 92;
export const CLIMB_GRAVITY = 1_450;
export const CLIMB_PLAYER_WIDTH = 26;
export const CLIMB_PLAYER_HEIGHT = 44;
export const CLIMB_JUMP_PAD_VELOCITY = -880;
export const CLIMB_MILESTONE_EVERY = 10;
/** Largest centre-to-centre hop; keeps every platform reachable from the one below. */
export const CLIMB_MAX_SHIFT = 230;

const MARGIN = 70;
const MILESTONE_WIDTH = 260;

export type ClimbPlatformKind = "step" | "moving" | "pad" | "milestone";

export interface ClimbPlatformStyle {
  readonly top: number;
  readonly side: number;
  readonly labelColor: string;
  readonly labelBackground: string;
}

export interface ClimbPlatform {
  readonly index: number;
  readonly floor?: number;
  readonly label?: string;
  readonly style?: ClimbPlatformStyle;
  readonly kind: ClimbPlatformKind;
  /** Left edge at rest and surface y (negative: above the ground at y = 0). */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly range: number;
  readonly periodMs: number;
}

/** A tower supplies its own rows while sharing the physics, artwork and party items. */
export interface ClimbCourseSource {
  readonly platformsAt: (floor: number) => readonly ClimbPlatform[];
  readonly itemsAt: (nowMs: number, nearFloor: number) => PartyItem[];
  readonly kindOf: (id: string) => PartyItemKind | null;
}

export function climbPlatformWidth(index: number): number {
  if (index % CLIMB_MILESTONE_EVERY === 0) return MILESTONE_WIDTH;
  return Math.max(90, 170 - index);
}

function kindOf(index: number): ClimbPlatformKind {
  if (index % CLIMB_MILESTONE_EVERY === 0) return "milestone";
  if (index % 15 === 7) return "pad";
  if (index > 12 && index % 4 === 1) return "moving";
  return "step";
}

/** Platform centres are a bounded random walk, cached per seed because each depends on the previous one. */
const centreCache = new Map<string, number[]>();

function centres(seed: string, upTo: number): number[] {
  let list = centreCache.get(seed);
  if (!list) {
    list = [CLIMB_WORLD_WIDTH / 2];
    centreCache.set(seed, list);
  }
  for (let index = list.length; index <= upTo; index += 1) {
    const previous = list[index - 1]!;
    const width = climbPlatformWidth(index);
    const random = createSeededRandom(`climb:${seed}:${index}`);
    const min = Math.max(MARGIN + width / 2, previous - CLIMB_MAX_SHIFT);
    const max = Math.min(CLIMB_WORLD_WIDTH - MARGIN - width / 2, previous + CLIMB_MAX_SHIFT);
    // Prefer real sideways hops so the climb zig-zags instead of stacking.
    let centre = min + random() * (max - min);
    if (Math.abs(centre - previous) < 70) centre = previous + (centre >= previous ? 1 : -1) * 90;
    list.push(Math.round(Math.max(min, Math.min(max, centre))));
  }
  return list;
}

export function climbPlatform(seed: string, index: number): ClimbPlatform {
  const width = climbPlatformWidth(index);
  const centre = centres(seed, index)[index] ?? CLIMB_WORLD_WIDTH / 2;
  const kind = kindOf(index);
  const moving = kind === "moving";
  const random = createSeededRandom(`climb:${seed}:${index}:motion`);
  return {
    index,
    kind,
    x: Math.round(centre - width / 2),
    y: -index * CLIMB_STEP,
    width,
    range: moving ? Math.min(70, centre - width / 2 - MARGIN / 2, CLIMB_WORLD_WIDTH - MARGIN / 2 - centre - width / 2) : 0,
    periodMs: moving ? 3_000 + Math.round(random() * 1_400) : 0,
  };
}

/** Left edge of a moving platform, driven by the shared server clock so every client agrees. */
export function climbPlatformX(platform: ClimbPlatform, nowMs: number): number {
  if (platform.kind !== "moving") return platform.x;
  return platform.x + Math.sin((nowMs / platform.periodMs) * Math.PI * 2) * platform.range;
}

/** Floor number for feet at `feetY` (0 is the ground). */
export function climbFloorAt(feetY: number): number {
  return Math.max(0, Math.round(-feetY / CLIMB_STEP));
}

// --- Power-up items -------------------------------------------------------

export const CLIMB_ITEM_WINDOW_MS = 25_000;
const ITEM_EVERY = 5;
const ITEM_OFFSET = 3;
const CLIMB_ITEM_KINDS: readonly PartyItemKind[] = [...PARTY_ITEM_KINDS, "dash", "star"];

/**
 * Every 5th platform holds an item that respawns each 25 s window. Only the
 * platforms around the viewer are considered, since the tower never ends.
 */
export function climbItemsAt(seed: string, nowMs: number, nearFloor: number, radius = 30): PartyItem[] {
  const window = Math.floor(nowMs / CLIMB_ITEM_WINDOW_MS);
  const items: PartyItem[] = [];
  const first = Math.max(ITEM_OFFSET, nearFloor - radius);
  for (let index = first; index <= nearFloor + radius; index += 1) {
    if (index % ITEM_EVERY !== ITEM_OFFSET) continue;
    const platform = climbPlatform(seed, index);
    if (platform.kind === "moving" || platform.kind === "pad") continue;
    const kind = climbItemKind(seed, index, window);
    items.push({ id: `c${index}-${window}`, kind, x: platform.x + platform.width / 2, y: platform.y - ITEM_HOVER });
  }
  return items;
}

function climbItemKind(seed: string, index: number, window: number): PartyItemKind {
  const random = createSeededRandom(`climb:${seed}:item:${index}:${window}`);
  return CLIMB_ITEM_KINDS[Math.floor(random() * CLIMB_ITEM_KINDS.length)] ?? "speed";
}

export function climbItemKindOf(seed: string, id: string): PartyItemKind | null {
  const match = /^c(\d+)-(\d+)$/.exec(id);
  return match ? climbItemKind(seed, Number(match[1]), Number(match[2])) : null;
}
