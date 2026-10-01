import { createSeededRandom } from "../../game-engine/core/random.ts";
import type { LiveMovementState } from "../../live-world/core/types.ts";
import type { ChunkLineUpElevatorId } from "../../multiplayer/chunk-line-up/types.ts";
import { CHUNK_LINE_UP_WORLD_WIDTH } from "./model.ts";

// Every client lays the tower out in the same world coordinates, derived only
// from the shared floor count. Live movement packets carry raw x/y values, so a
// viewport-dependent layout would put remote players on different floors.

export interface ChunkLineUpRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const CHUNK_LINE_UP_PLAYER_WIDTH = 26;
export const CHUNK_LINE_UP_PLAYER_HEIGHT = 44;
export const CHUNK_LINE_UP_SHAFT_WIDTH = 88;
/** Open gap between each shaft and the floors: walking off a floor's end here is how players go down. */
export const CHUNK_LINE_UP_LANDING_WIDTH = 64;
export const CHUNK_LINE_UP_SLOT_HEIGHT = 27;
/** Taller than a double jump, so floors are climbed via props or the elevator. */
export const CHUNK_LINE_UP_FLOOR_GAP = 230;
export const CHUNK_LINE_UP_TOWER_TOP = 180;
export const CHUNK_LINE_UP_JUMP_PAD_VELOCITY = -880;

const SHAFT_MARGIN = 14;
const LANDING_ROW_GAP = 12;
const SLOT_GAP = 8;
const LOW_STEP = 88;
const HIGH_STEP = 158;

/** Walkable area between the two elevator shafts. */
export const CHUNK_LINE_UP_WALK_LEFT = SHAFT_MARGIN + CHUNK_LINE_UP_SHAFT_WIDTH;
export const CHUNK_LINE_UP_WALK_RIGHT = CHUNK_LINE_UP_WORLD_WIDTH - CHUNK_LINE_UP_WALK_LEFT;
export const CHUNK_LINE_UP_ROW_LEFT = CHUNK_LINE_UP_WALK_LEFT + CHUNK_LINE_UP_LANDING_WIDTH + LANDING_ROW_GAP;
export const CHUNK_LINE_UP_ROW_RIGHT = CHUNK_LINE_UP_WORLD_WIDTH - CHUNK_LINE_UP_ROW_LEFT;

export function chunkLineUpGroundY(floorCount: number): number {
  return CHUNK_LINE_UP_TOWER_TOP + Math.max(1, floorCount) * CHUNK_LINE_UP_FLOOR_GAP;
}

export function chunkLineUpWorldHeight(floorCount: number): number {
  return chunkLineUpGroundY(floorCount) + 60;
}

/**
 * Surface y of a floor. Floors 0..floorCount-1 are sentence shelves from the top;
 * floor === floorCount is the ground (elevator lobby). Fractional floors are
 * used while an elevator cabin travels between stops.
 */
export function chunkLineUpFloorY(floor: number, floorCount: number): number {
  const bounded = Math.max(0, Math.min(floorCount, floor));
  return CHUNK_LINE_UP_TOWER_TOP + bounded * CHUNK_LINE_UP_FLOOR_GAP;
}

/** The floor whose surface a player with these feet stands on or is climbing up from. */
export function chunkLineUpFloorAt(feetY: number, floorCount: number): number {
  const floor = Math.ceil((feetY - CHUNK_LINE_UP_TOWER_TOP - 2) / CHUNK_LINE_UP_FLOOR_GAP);
  return Math.max(0, Math.min(floorCount, floor));
}

/** Building-style floor names: the lobby is 1F, the top sentence shelf is the highest. */
export function chunkLineUpFloorLabel(floor: number, floorCount: number): string {
  return `${floorCount - floor + 1}F`;
}

export function chunkLineUpShaftX(id: ChunkLineUpElevatorId): number {
  const center = SHAFT_MARGIN + CHUNK_LINE_UP_SHAFT_WIDTH / 2;
  return id === "left" ? center : CHUNK_LINE_UP_WORLD_WIDTH - center;
}


export function chunkLineUpSlotRects(slotCount: number, floor: number, floorCount: number): ChunkLineUpRect[] {
  const count = Math.max(1, slotCount);
  const rowWidth = CHUNK_LINE_UP_ROW_RIGHT - CHUNK_LINE_UP_ROW_LEFT;
  const width = (rowWidth - SLOT_GAP * (count - 1)) / count;
  const y = chunkLineUpFloorY(floor, floorCount);
  return Array.from({ length: slotCount }, (_unused, index) => ({
    x: CHUNK_LINE_UP_ROW_LEFT + index * (width + SLOT_GAP),
    y,
    width,
    height: CHUNK_LINE_UP_SLOT_HEIGHT,
  }));
}

export type ChunkLineUpPropKind = "step" | "moving" | "pad";

/** A climbing prop between two floors. `x` is the left edge (at rest for moving platforms). */
export interface ChunkLineUpProp {
  readonly id: string;
  readonly kind: ChunkLineUpPropKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly range: number;
  readonly periodMs: number;
}

/**
 * Deterministic climbing course. Each band between two floors gets a zig-zag
 * of low and high steps; odd bands swap a step for a moving platform and even
 * bands put a jump pad on a low step. The lobby has one pad for a quick start.
 */
export function chunkLineUpProps(floorCount: number): ChunkLineUpProp[] {
  const props: ChunkLineUpProp[] = [];
  const left = CHUNK_LINE_UP_ROW_LEFT + 24;
  const columnWidth = (CHUNK_LINE_UP_ROW_RIGHT - 24 - left) / 4;
  for (let band = 0; band < floorCount; band += 1) {
    const random = createSeededRandom(`chunk-line-up:band:${band}`);
    const lowerY = chunkLineUpFloorY(band + 1, floorCount);
    for (let column = 0; column < 4; column += 1) {
      const high = (column + band) % 2 === 1;
      const width = Math.round(96 + random() * 32);
      const x = Math.round(left + column * columnWidth + random() * (columnWidth - width));
      const y = lowerY - (high ? HIGH_STEP : LOW_STEP);
      const moving = high && band % 2 === 1 && (column === 1 || column === 2);
      props.push({
        id: `b${band}c${column}`,
        kind: moving ? "moving" : "step",
        x,
        y,
        width,
        range: moving ? Math.min(90, x - left + 10, CHUNK_LINE_UP_ROW_RIGHT - 24 - x - width + 10) : 0,
        periodMs: moving ? 3_400 + Math.round(random() * 1_200) : 0,
      });
      if (!high && band % 2 === 0 && column === (band % 4 === 0 ? 0 : 3)) {
        props.push({ id: `b${band}pad`, kind: "pad", x: x + width / 2 - 22, y, width: 44, range: 0, periodMs: 0 });
      }
    }
  }
  props.push({
    id: "lobby-pad",
    kind: "pad",
    x: CHUNK_LINE_UP_WORLD_WIDTH / 2 - 22,
    y: chunkLineUpGroundY(floorCount),
    width: 44,
    range: 0,
    periodMs: 0,
  });
  return props;
}

/** Left edge of a moving platform, driven by the shared server clock so every client agrees. */
export function chunkLineUpPropX(prop: ChunkLineUpProp, nowMs: number): number {
  if (prop.kind !== "moving" || prop.periodMs <= 0) return prop.x;
  return prop.x + Math.sin((nowMs / prop.periodMs) * Math.PI * 2) * prop.range;
}

/** Players enter at the lobby, spread out so a whole class does not stack on one pixel. */
export function chunkLineUpSpawnState(seed: number, floorCount: number): LiveMovementState {
  const spread = (CHUNK_LINE_UP_ROW_RIGHT - CHUNK_LINE_UP_ROW_LEFT) * 0.8;
  const ratio = ((Math.abs(seed) % 997) / 996) - 0.5;
  return {
    x: CHUNK_LINE_UP_WORLD_WIDTH / 2 + ratio * spread,
    y: chunkLineUpGroundY(floorCount) - CHUNK_LINE_UP_PLAYER_HEIGHT / 2,
    vx: 0,
    vy: 0,
  };
}
