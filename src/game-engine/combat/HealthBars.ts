import Phaser from "phaser";

export interface HealthBarEntry {
  readonly x: number;
  /** Vertical centre of the bar on screen. */
  readonly y: number;
  /** 0..1 */
  readonly ratio: number;
}

const WIDTH = 40;
const HEIGHT = 6;

/** One bar over every fighter, redrawn each frame from the current health. */
export class HealthBars {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, depth = 25) {
    this.graphics = scene.add.graphics().setDepth(depth);
  }

  draw(entries: readonly HealthBarEntry[]): void {
    const g = this.graphics.clear();
    for (const { x, y, ratio } of entries) {
      const left = x - WIDTH / 2;
      const top = y - HEIGHT / 2;
      const filled = Math.max(0, Math.min(1, ratio));
      const color = filled > 0.5 ? 0x22c55e : filled > 0.25 ? 0xfacc15 : 0xef4444;
      g.fillStyle(0x0f172a, 0.75).fillRoundedRect(left - 1, top - 1, WIDTH + 2, HEIGHT + 2, 3);
      if (filled > 0) g.fillStyle(color, 1).fillRoundedRect(left, top, Math.max(2, WIDTH * filled), HEIGHT, 2);
      g.fillStyle(0xffffff, 0.35).fillRect(left + 1, top + 1, Math.max(0, WIDTH * filled - 2), 2);
    }
  }
}
