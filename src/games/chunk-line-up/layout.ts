import type { LiveMovementState } from "../../live-world/core/types.ts";
import type { ChunkLineUpElevatorId } from "../../multiplayer/chunk-line-up/types.ts";
import { CHUNK_LINE_UP_WORLD_HEIGHT, CHUNK_LINE_UP_WORLD_WIDTH } from "./model.ts";

// Every client lays the tower out in the same fixed world coordinates. Live
// movement packets carry raw x/y values, so a viewport-dependent layout would
// place remote players on different floors for different screen sizes.

export interface ChunkLineUpRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const CHUNK_LINE_UP_PLAYER_WIDTH = 26;
export const CHUNK_LINE_UP_PLAYER_HEIGHT = 44;
export const CHUNK_LINE_UP_GROUND_Y = CHUNK_LINE_UP_WORLD_HEIGHT - 34;
export const CHUNK_LINE_UP_SHAFT_WIDTH = 88;
export const CHUNK_LINE_UP_LANDING_WIDTH = 64;
export const CHUNK_LINE_UP_SLOT_HEIGHT = 27;
export const CHUNK_LINE_UP_MAX_FLOOR_GAP = 90;

const SHAFT_MARGIN = 14;
const TOP_FLOOR_MIN_Y = 150;
const LANDING_ROW_GAP = 12;
const SLOT_GAP = 8;

/** Walkable area between the two elevator shafts. */
export const CHUNK_LINE_UP_WALK_LEFT = SHAFT_MARGIN + CHUNK_LINE_UP_SHAFT_WIDTH;
export const CHUNK_LINE_UP_WALK_RIGHT = CHUNK_LINE_UP_WORLD_WIDTH - CHUNK_LINE_UP_WALK_LEFT;
export const CHUNK_LINE_UP_ROW_LEFT = CHUNK_LINE_UP_WALK_LEFT + CHUNK_LINE_UP_LANDING_WIDTH + LANDING_ROW_GAP;
export const CHUNK_LINE_UP_ROW_RIGHT = CHUNK_LINE_UP_WORLD_WIDTH - CHUNK_LINE_UP_ROW_LEFT;

export function chunkLineUpFloorGap(floorCount: number): number {
  if (floorCount < 1) return CHUNK_LINE_UP_MAX_FLOOR_GAP;
  return Math.min(CHUNK_LINE_UP_MAX_FLOOR_GAP, (CHUNK_LINE_UP_GROUND_Y - TOP_FLOOR_MIN_Y) / floorCount);
}

/**
 * Surface y of a floor. Floors 0..floorCount-1 are sentence rows from the top;
 * floor === floorCount is the ground (elevator lobby). Fractional floors are
 * used while an elevator cabin travels between stops.
 */
export function chunkLineUpFloorY(floor: number, floorCount: number): number {
  const bounded = Math.max(0, Math.min(floorCount, floor));
  return CHUNK_LINE_UP_GROUND_Y - (floorCount - bounded) * chunkLineUpFloorGap(floorCount);
}

export function chunkLineUpShaftX(id: ChunkLineUpElevatorId): number {
  const center = SHAFT_MARGIN + CHUNK_LINE_UP_SHAFT_WIDTH / 2;
  return id === "left" ? center : CHUNK_LINE_UP_WORLD_WIDTH - center;
}

export function chunkLineUpLandingRect(id: ChunkLineUpElevatorId, floor: number, floorCount: number): ChunkLineUpRect {
  const x = id === "left" ? CHUNK_LINE_UP_WALK_LEFT : CHUNK_LINE_UP_WALK_RIGHT - CHUNK_LINE_UP_LANDING_WIDTH;
  return { x, y: chunkLineUpFloorY(floor, floorCount), width: CHUNK_LINE_UP_LANDING_WIDTH, height: 12 };
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

/** Players enter at the lobby, spread out so a whole class does not stack on one pixel. */
export function chunkLineUpSpawnState(seed: number): LiveMovementState {
  const spread = (CHUNK_LINE_UP_ROW_RIGHT - CHUNK_LINE_UP_ROW_LEFT) * 0.8;
  const ratio = ((Math.abs(seed) % 997) / 996) - 0.5;
  return {
    x: CHUNK_LINE_UP_WORLD_WIDTH / 2 + ratio * spread,
    y: CHUNK_LINE_UP_GROUND_Y - CHUNK_LINE_UP_PLAYER_HEIGHT / 2,
    vx: 0,
    vy: 0,
  };
}
