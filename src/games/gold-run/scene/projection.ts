/*
 * Chase-camera perspective: the camera floats behind and above the runner and looks down the track.
 * World units are metres: x across the road (0 = centre), z ahead of the camera, y up from the road.
 */

export const LANE_WIDTH = 2.3;
export const ROAD_HALF_WIDTH = LANE_WIDTH * 1.5 + 0.35;
/** Camera height on wide screens; narrow ones raise the camera so the road still fills the view. */
const CAMERA_HEIGHT = 3.1;
const MAX_CAMERA_HEIGHT = 7;
/** How far ahead of the camera the runner's feet are. */
export const RUNNER_Z = 6;
/** Nothing is drawn beyond this. */
export const DRAW_DISTANCE = 95;
/** Closer than this is behind the screen edge. */
export const NEAR_Z = 1.2;

export interface View {
  readonly width: number;
  readonly height: number;
  readonly focal: number;
  readonly horizonY: number;
  readonly centerX: number;
  readonly cameraHeight: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  /** Screen pixels per world metre at this depth. */
  readonly scale: number;
}

/**
 * Fits the three lanes and the runner into any aspect ratio. When the width limits the zoom
 * (phones in portrait), the camera rises instead of leaving the top half of the screen as sky.
 */
export function createView(width: number, height: number): View {
  const feetY = height * 0.84;
  const horizonY = height * 0.3;
  const byHeight = (feetY - horizonY) * RUNNER_Z / CAMERA_HEIGHT;
  // The outer lanes must fit; the kerbs may run off a narrow screen.
  const byWidth = width * 0.96 * RUNNER_Z / (LANE_WIDTH * 3);
  const focal = Math.min(byHeight, byWidth);
  const cameraHeight = Math.min(MAX_CAMERA_HEIGHT, (feetY - horizonY) * RUNNER_Z / focal);
  return { width, height, focal, horizonY: feetY - cameraHeight * focal / RUNNER_Z, centerX: width / 2, cameraHeight };
}

export function project(view: View, x: number, z: number, y = 0): ScreenPoint {
  const depth = Math.max(z, NEAR_Z);
  const scale = view.focal / depth;
  return { x: view.centerX + x * scale, y: view.horizonY + (view.cameraHeight - y) * scale, scale };
}

export const laneX = (lane: number): number => lane * LANE_WIDTH;

/** Track distance → camera depth, given where the runner is. */
export const depthOf = (at: number, runnerDistance: number): number => at - runnerDistance + RUNNER_Z;
