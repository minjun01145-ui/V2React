import Phaser from "phaser";
import type { LiveMovementState } from "../../live-world/core/types.ts";
import { PLAYER_HEIGHT } from "./level.ts";

export interface PlatformerActor {
  readonly container: Phaser.GameObjects.Container;
  readonly image: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
}

export function createActor(scene: Phaser.Scene, label: string, self: boolean): PlatformerActor {
  const shadow = scene.add.ellipse(0, -2, 34, 9, 0x243b53, 0.16);
  const image = scene.add.image(0, 0, "runner").setOrigin(0.5, 1).setDisplaySize(44, 53);
  if (!self) image.setTint(0xb8e8ff);
  const name = scene.add.text(0, -66, label, {
    fontFamily: "sans-serif", fontSize: "12px", color: self ? "#155e48" : "#24445e",
    backgroundColor: "#ffffff", padding: { x: 7, y: 4 },
  }).setOrigin(0.5);
  return { container: scene.add.container(0, 0, [shadow, image, name]).setDepth(self ? 10 : 9), image, label: name };
}

export function positionActor(actor: PlatformerActor, state: LiveMovementState, time: number): void {
  actor.container.setPosition(state.x, state.y + PLAYER_HEIGHT / 2);
  const running = Math.abs(state.vx) > 15 && Math.abs(state.vy) < 5;
  actor.image.setY(running ? -Math.abs(Math.sin(time / 85)) * 3 : 0);
  actor.image.setRotation(running ? Math.sin(time / 85) * 0.06 : Phaser.Math.Clamp(state.vx / 4000, -0.08, 0.08));
  if (Math.abs(state.vx) > 5) actor.image.setFlipX(state.vx < 0);
}
