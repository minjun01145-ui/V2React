import { SKATING_RINK_HALF_WIDTH } from "../model.ts";

/** Height of the rink boards drawn above and below the ice, in pixels. */
export const BOARD_HEIGHT = 24;
export const LANE_COLORS = [0x0ea5e9, 0x8b5cf6, 0xf59e0b] as const;

/**
 * World ↔ screen mapping for one frame. World x scrolls left as the camera
 * follows `cameraX`; world y spans the rink from the top board to the bottom one.
 */
export interface RinkLayout {
  readonly width: number;
  readonly height: number;
  readonly laneHeight: number;
  readonly pixelsPerUnit: number;
  /** World x range currently on screen. */
  readonly left: number;
  readonly right: number;
  screenX(x: number): number;
  screenY(y: number): number;
}

export function createRinkLayout(input: {
  readonly width: number;
  readonly height: number;
  readonly cameraX: number;
  /** Where `cameraX` sits on screen, as a share of the width. */
  readonly anchor: number;
  readonly pixelsPerUnit: number;
}): RinkLayout {
  const { width, height, cameraX, anchor, pixelsPerUnit } = input;
  const iceHeight = Math.max(1, height - BOARD_HEIGHT * 2);
  const anchorX = width * anchor;
  return {
    width,
    height,
    laneHeight: iceHeight / 3,
    pixelsPerUnit,
    left: cameraX - anchorX / pixelsPerUnit,
    right: cameraX + (width - anchorX) / pixelsPerUnit,
    screenX: (x) => anchorX + (x - cameraX) * pixelsPerUnit,
    screenY: (y) => BOARD_HEIGHT + (y + SKATING_RINK_HALF_WIDTH) / (SKATING_RINK_HALF_WIDTH * 2) * iceHeight,
  };
}

/**
 * Default zoom: about one gate gap fits ahead of the skater. Faster skaters
 * see further (zoomed out by the square root of their speed-up) so a booster
 * is fast but not blind.
 */
export function skaterPixelsPerUnit(width: number, speedFactor: number): number {
  const base = Math.max(46, Math.min(110, width / 10));
  return base / Math.sqrt(Math.max(1, speedFactor));
}
