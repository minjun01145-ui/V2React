import { SKATING_RINK_HALF_WIDTH } from "../model.ts";

/** Rink boards drawn above and below the ice, in pixels. */
export const BOARD_HEIGHT = 14;
export const LANE_COLORS = [0x0ea5e9, 0x8b5cf6, 0xf59e0b] as const;

/**
 * World ↔ screen mapping for one frame. From the top: the crowd stand, a board,
 * the three-lane ice, a board. World x scrolls left as the camera follows
 * `cameraX`; world y spans the ice between the boards.
 */
export interface RinkLayout {
  readonly width: number;
  readonly height: number;
  readonly standHeight: number;
  readonly iceTop: number;
  readonly iceBottom: number;
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
  const standHeight = Math.round(Math.max(24, Math.min(54, height * 0.11)));
  const iceTop = standHeight + BOARD_HEIGHT;
  const iceBottom = Math.max(iceTop + 3, height - BOARD_HEIGHT);
  const anchorX = width * anchor;
  return {
    width,
    height,
    standHeight,
    iceTop,
    iceBottom,
    laneHeight: (iceBottom - iceTop) / 3,
    pixelsPerUnit,
    left: cameraX - anchorX / pixelsPerUnit,
    right: cameraX + (width - anchorX) / pixelsPerUnit,
    screenX: (x) => anchorX + (x - cameraX) * pixelsPerUnit,
    screenY: (y) => iceTop + (y + SKATING_RINK_HALF_WIDTH) / (SKATING_RINK_HALF_WIDTH * 2) * (iceBottom - iceTop),
  };
}

/**
 * Default zoom: about ten world units ahead of the skater, so the next
 * question is visible for a few seconds. Faster skaters see further (zoomed
 * out by the square root of their speed-up) so a booster is fast but not blind.
 */
export function skaterPixelsPerUnit(width: number, speedFactor: number): number {
  const base = Math.max(38, Math.min(92, width / 13));
  return base / Math.sqrt(Math.max(1, speedFactor));
}
