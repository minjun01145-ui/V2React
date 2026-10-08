import type Phaser from "phaser";
import { takeJump, type JumpState } from "../platformer/movement.ts";
import { BUFF_EFFECT, type PartyItemKind } from "./buffs.ts";

/**
 * One frame of jumping with the party items: "jump" makes every jump higher,
 * "dash" turns the second jump into a straight-up rocket. Returns what
 * happened so the scene can play the matching effect.
 */
export function partyJump(
  body: Phaser.Physics.Arcade.Body,
  jump: JumpState,
  input: { readonly grounded: boolean; readonly pressed: boolean; readonly time: number },
  has: (kind: PartyItemKind) => boolean,
): "jump" | "dash" | null {
  const velocity = takeJump(jump, input.grounded, input.pressed, input.time);
  if (velocity === null) return null;
  if (jump.used === 2 && has("dash")) {
    // Straight up: drop the sideways speed so the dash reads as a vertical launch.
    body.setVelocity(0, BUFF_EFFECT.dash.doubleJumpVelocity);
    return "dash";
  }
  body.setVelocityY(velocity * (has("jump") ? BUFF_EFFECT.jump.jumpMultiplier : 1));
  return "jump";
}
