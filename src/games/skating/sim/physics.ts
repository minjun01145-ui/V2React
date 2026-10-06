import { SKATING_RINK_HALF_WIDTH } from "../model.ts";

/** Forward speed with no items, in world units per second. */
export const SKATING_BASE_SPEED = 3.2;
/**
 * Ice feel: steering only adds sideways acceleration and the drag is low, so a
 * skater keeps sliding after the key is released and must counter-steer to stop.
 */
export const SKATING_STEER_ACCEL = 7.5;
export const SKATING_ICE_DRAG = 1.5;
export const SKATING_MAX_SIDE_SPEED = 3.6;
/** How far the skater's centre may go before bouncing off the rink boards. */
export const SKATING_WALL_Y = SKATING_RINK_HALF_WIDTH - 0.14;
const WALL_BOUNCE = 0.45;

export type SkatingSteer = -1 | 0 | 1;

export interface LateralState {
  readonly y: number;
  readonly vy: number;
}

export interface LateralStep extends LateralState {
  /** Set when the skater hit a board this step; the scene kicks up ice. */
  readonly bumped: boolean;
}

/** One sideways physics step: slippery acceleration, low drag, bouncy boards. */
export function stepLateral(state: LateralState, steer: SkatingSteer, seconds: number): LateralStep {
  let vy = state.vy + steer * SKATING_STEER_ACCEL * seconds;
  vy *= Math.exp(-SKATING_ICE_DRAG * seconds);
  vy = Math.max(-SKATING_MAX_SIDE_SPEED, Math.min(SKATING_MAX_SIDE_SPEED, vy));
  let y = state.y + vy * seconds;
  let bumped = false;
  if (Math.abs(y) > SKATING_WALL_Y) {
    y = Math.sign(y) * SKATING_WALL_Y;
    if (Math.sign(vy) === Math.sign(y)) {
      bumped = Math.abs(vy) > 0.6;
      vy = -vy * WALL_BOUNCE;
    }
  }
  return { y, vy, bumped };
}
