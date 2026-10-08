import type Phaser from "phaser";
import { PUNCH_KNOCKBACK_MAX_SPEED, punchKnockback } from "../platformer-party/punch.ts";
import type { PlatformerInput } from "./movement.ts";

/** Shared feel of the blob platformers: run speed, grip on the ground, looser control in the air. */
export const PLATFORMER_RUN_SPEED = 300;
export const PLATFORMER_MAX_FALL_SPEED = 1_100;
const GROUND_ACCELERATION = 2_600;
const AIR_ACCELERATION = 1_700;
const GROUND_DRAG = 2_800;
const AIR_DRAG = 700;

/**
 * Left/right control for one frame. A knocked player flies freely for a
 * moment (no steering, light drag, no speed cap) so a punch reads as a whoosh.
 */
export function steerPlatformerBody(
  body: Phaser.Physics.Arcade.Body,
  input: PlatformerInput,
  options: { readonly grounded: boolean; readonly knocked: boolean; readonly speedMultiplier?: number },
): void {
  const { grounded, knocked } = options;
  const speedMultiplier = options.speedMultiplier ?? 1;
  const directions = [...input.held.values()];
  const left = directions.includes("left");
  const right = directions.includes("right");
  body.setMaxVelocity(knocked ? PUNCH_KNOCKBACK_MAX_SPEED : PLATFORMER_RUN_SPEED * speedMultiplier, PLATFORMER_MAX_FALL_SPEED);
  const steer = knocked ? 0 : Number(right) - Number(left);
  body.setAccelerationX(steer * (grounded ? GROUND_ACCELERATION : AIR_ACCELERATION) * speedMultiplier);
  if (grounded && !knocked && ((right && body.velocity.x < 0) || (left && body.velocity.x > 0))) body.setVelocityX(body.velocity.x * 0.5);
  body.setDragX(grounded && !knocked && !left && !right ? GROUND_DRAG : AIR_DRAG);
}

/** Applies a received punch to the victim's own body; keep it knocked for `PUNCH_KNOCKBACK_MS`. */
export function launchFromPunch(body: Phaser.Physics.Arcade.Body, value: number): void {
  const knockback = punchKnockback(value);
  body.setVelocity(knockback.vx, knockback.vy);
  // Lift the speed cap now: physics steps before the next update and would clamp the hit.
  body.setMaxVelocity(PUNCH_KNOCKBACK_MAX_SPEED, PLATFORMER_MAX_FALL_SPEED);
}
