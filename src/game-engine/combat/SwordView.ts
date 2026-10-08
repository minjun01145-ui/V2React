import Phaser from "phaser";
import { SWORD_REACH } from "./sword.ts";

export interface SwordHolder {
  /** Body centre on screen. */
  readonly x: number;
  readonly y: number;
  readonly facing: number;
}

/** Toy swords in the holders' hands and the short slash wave they send out on a swing. */
export class SwordView {
  private readonly scene: Phaser.Scene;
  private readonly held: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.held = scene.add.graphics().setDepth(23);
  }

  drawHeld(holders: readonly SwordHolder[], time: number): void {
    const g = this.held.clear();
    for (const { x, y, facing } of holders) {
      const handX = x + facing * 14;
      const handY = y - 4 + Math.sin(time / 220) * 1.5;
      const tipX = handX + facing * 20;
      const tipY = handY - 18;
      g.lineStyle(5, 0xc4b5fd, 1).lineBetween(handX, handY, tipX, tipY);
      g.lineStyle(2, 0xffffff, 0.9).lineBetween(handX + facing, handY - 2, tipX, tipY);
      g.lineStyle(4, 0x7c3aed, 1).lineBetween(handX - 5, handY + 4, handX + 5, handY - 4);
    }
  }

  /** A crescent of light shooting out in front of the swinger, as far as the sword reaches. */
  slash(x: number, y: number, facing: number): void {
    const wave = this.scene.add.graphics({ x, y }).setDepth(28);
    const radius = 34;
    wave.lineStyle(10, 0xddd6fe, 0.95);
    wave.beginPath();
    wave.arc(0, 0, radius, -Math.PI / 2.6, Math.PI / 2.6);
    wave.strokePath();
    wave.lineStyle(4, 0xffffff, 1);
    wave.beginPath();
    wave.arc(0, 0, radius + 4, -Math.PI / 3.2, Math.PI / 3.2);
    wave.strokePath();
    wave.setScale(facing < 0 ? -0.6 : 0.6, 0.6);
    this.scene.tweens.add({
      targets: wave,
      x: x + facing * (SWORD_REACH.forward - radius),
      scaleX: facing < 0 ? -1.2 : 1.2,
      scaleY: 1.5,
      alpha: 0,
      duration: 220,
      ease: "Cubic.Out",
      onComplete: () => wave.destroy(),
    });
  }
}
