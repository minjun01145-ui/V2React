import Phaser from "phaser";
import { TEXTURE } from "../../../game-engine/phaser-kit/art.ts";
import type { LavaHazard } from "../maps/types.ts";

const DEPTH = 300;

/** Waves, glow and splashes for one declared lava region. */
export class LavaView {
  private readonly scene: Phaser.Scene;
  private readonly lava: Phaser.GameObjects.Graphics;
  private readonly splashes: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly hazard: LavaHazard;
  private readonly points: Phaser.Math.Vector2[] = [];

  constructor(scene: Phaser.Scene, hazard: LavaHazard) {
    this.scene = scene;
    this.hazard = hazard;
    for (let x = hazard.left; x <= hazard.right; x += 16) this.points.push(new Phaser.Math.Vector2(x, hazard.y));
    this.points.push(new Phaser.Math.Vector2(hazard.right, hazard.y + DEPTH), new Phaser.Math.Vector2(hazard.left, hazard.y + DEPTH));
    this.lava = scene.add.graphics().setDepth(10);
    const glow = scene.add.graphics().setDepth(-2);
    for (let band = 1; band <= 8; band += 1) {
      glow.fillStyle(hazard.color, 0.025 * band).fillRect(hazard.left, hazard.y - 100 + band * 10, hazard.right - hazard.left, 100 - band * 10);
    }
    this.splashes = scene.add.particles(0, 0, TEXTURE.dot, {
      emitting: false,
      speed: { min: 160, max: 380 },
      angle: { min: 220, max: 320 },
      scale: { start: 1.6, end: 0 },
      gravityY: 900,
      tint: [hazard.glow, hazard.color],
      lifespan: 800,
    }).setDepth(42);
  }

  update(time: number): void {
    const g = this.lava.clear();
    const { left, right, y, color, glow } = this.hazard;
    const surface = (x: number): number => y + Math.sin(x / 60 + time / 420) * 4 + Math.sin(x / 23 - time / 300) * 2;
    for (let i = 0; i < this.points.length - 2; i += 1) this.points[i]!.y = surface(this.points[i]!.x);
    g.fillStyle(color, 1).fillPoints(this.points, true);
    for (let x = left; x < right; x += 16) {
      g.fillStyle(glow, 0.5).fillRect(x, surface(x) + 1, 16, 4);
    }
    for (let bubble = 0; bubble < 24; bubble += 1) {
      const life = (time / 1_400 + bubble * 0.37) % 1;
      const x = left + (bubble * 137 + Math.floor(time / 1_400 + bubble * 0.37) * 211) % (right - left);
      g.fillStyle(glow, 0.9 * (1 - life)).fillCircle(x, y + 8 - life * 8, 3 + life * 9);
    }
  }

  splash(x: number): void {
    this.splashes.explode(36, x, this.hazard.y);
    const ring = this.scene.add.ellipse(x, this.hazard.y + 4, 30, 10).setStrokeStyle(4, this.hazard.glow).setDepth(43);
    this.scene.tweens.add({ targets: ring, scaleX: 4, scaleY: 2, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
  }
}
