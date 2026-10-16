import type Phaser from "phaser";
import type { PlatformerInput } from "../../platformer/movement.ts";

export const ICE_ACCELERATION = 620;
export const ICE_DRAG = 150;

/** Override ground grip without changing airborne steering, jump or punch rules. */
export function steerOnIce(body: Phaser.Physics.Arcade.Body, input: PlatformerInput, multiplier: number): void {
  let left = false;
  let right = false;
  for (const held of input.held.values()) {
    if (held === "left") left = true;
    if (held === "right") right = true;
  }
  body.setAccelerationX((Number(right) - Number(left)) * ICE_ACCELERATION * multiplier).setDragX(ICE_DRAG);
}
