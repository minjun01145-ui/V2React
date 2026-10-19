import Phaser from "phaser";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../../game-engine/phaser-kit/art.ts";
import { PALETTE } from "./palette.ts";

/* Short-lived screen effects: gold sparkles, score pop-ups, hit flashes and speed streaks. */

const DEPTH = 30;

export class RunEffects {
  private readonly scene: Phaser.Scene;
  private readonly streaks: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.streaks = scene.add.graphics().setDepth(DEPTH - 1);
  }

  sparkle(x: number, y: number, size: number): void {
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2 + Math.random() * 0.5;
      const dot = this.scene.add.circle(x, y, Math.max(2, size * 0.09), index % 2 ? PALETTE.goldLight : PALETTE.gold).setDepth(DEPTH);
      this.scene.tweens.add({ targets: dot, x: x + Math.cos(angle) * size, y: y + Math.sin(angle) * size * 0.7,
        alpha: 0, scale: 0.3, duration: 360, ease: "Cubic.easeOut", onComplete: () => dot.destroy() });
    }
  }

  popup(x: number, y: number, text: string, color: string, big = false): void {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: FONT_FAMILY, fontSize: big ? "34px" : "20px", fontStyle: "900", color,
      stroke: "#1b1424", strokeThickness: big ? 7 : 5,
    }).setOrigin(0.5).setResolution(TEXT_RESOLUTION).setDepth(DEPTH + 1).setScale(0.6);
    this.scene.tweens.add({ targets: label, scale: 1, duration: 140, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: label, y: y - (big ? 70 : 46), alpha: 0, delay: big ? 520 : 220, duration: 520, ease: "Cubic.easeIn", onComplete: () => label.destroy() });
  }

  hit(): void {
    this.scene.cameras.main.shake(220, 0.012);
    this.scene.cameras.main.flash(180, 255, 70, 60);
  }

  burst(correct: boolean): void {
    if (correct) this.scene.cameras.main.flash(220, 120, 255, 160);
    else this.hit();
  }

  /** Streaks from the vanishing point; they thicken as the run gets faster (`intensity` 0–1). */
  speedLines(width: number, height: number, horizonY: number, intensity: number, time: number): void {
    this.streaks.clear();
    if (intensity <= 0.05) return;
    for (let index = 0; index < 14; index += 1) {
      const side = index % 2 ? 1 : -1;
      const angle = (index * 0.37 + 0.2) % 1;
      const travel = ((time / 380 + index * 0.173) % 1);
      const startX = width / 2 + side * width * (0.08 + angle * 0.3);
      const x0 = width / 2 + (startX - width / 2) * (1 + travel * 2.2);
      const y0 = horizonY + (height * (0.15 + angle * 0.5)) * travel;
      const x1 = width / 2 + (startX - width / 2) * (1.25 + travel * 2.6);
      const y1 = horizonY + (height * (0.15 + angle * 0.5)) * (travel + 0.18);
      this.streaks.lineStyle(1 + travel * 2.5, 0xffffff, intensity * 0.35 * (1 - travel)).lineBetween(x0, y0, x1, y1);
    }
  }
}
