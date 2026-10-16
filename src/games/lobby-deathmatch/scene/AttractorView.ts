import type Phaser from "phaser";
import type { AttractorHazard } from "../maps/types.ts";

export class AttractorView {
  private readonly disk: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, hole: AttractorHazard) {
    const glow = scene.add.graphics().setDepth(-1);
    for (let ring = 6; ring > 0; ring -= 1) {
      glow.fillStyle(hole.color, 0.025).fillCircle(hole.x, hole.y, hole.coreRadius + ring * 12);
    }
    this.disk = scene.add.graphics().setPosition(hole.x, hole.y).setDepth(8);
    this.disk.lineStyle(10, hole.color, 0.25).strokeEllipse(0, 0, 146, 68);
    this.disk.lineStyle(3, 0xfde7ff, 0.85).strokeEllipse(0, 0, 122, 55);
    this.disk.lineStyle(2, hole.color, 0.5).strokeCircle(0, 0, hole.coreRadius + 10);
    scene.add.circle(hole.x, hole.y, hole.coreRadius, 0x010107).setDepth(9)
      .setStrokeStyle(2, hole.color, 0.9);
  }

  update(time: number): void {
    this.disk.setRotation(time / 2_600);
  }
}
