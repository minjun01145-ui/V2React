import Phaser from "phaser";
import { TEXTURE } from "../../../game-engine/phaser-kit/art.ts";
import { ARENA_LAVA_Y, ARENA_VIEW_HEIGHT, ARENA_WIDTH } from "../arena.ts";

const DEPTH = 300;
const MARGIN = 200;

/** The lava floor and the dark cave behind the arena; the lava waves, bubbles and splashes. */
export class LavaView {
  private readonly scene: Phaser.Scene;
  private readonly lava: Phaser.GameObjects.Graphics;
  private readonly splashes: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const cave = scene.add.graphics().setDepth(-10);
    const top = ARENA_LAVA_Y - ARENA_VIEW_HEIGHT - MARGIN;
    // Dark cave warming towards the lava; solid bands work on both the WebGL and canvas renderers.
    cave.fillStyle(0x1e1b4b, 1).fillRect(-MARGIN, top, ARENA_WIDTH + MARGIN * 2, ARENA_LAVA_Y - top);
    const bands = 8;
    for (let band = 1; band <= bands; band += 1) {
      const bandTop = ARENA_LAVA_Y - (ARENA_VIEW_HEIGHT * 0.6) * (1 - (band - 1) / bands);
      cave.fillStyle(0x9a3412, 0.07 * band / 2).fillRect(-MARGIN, bandTop, ARENA_WIDTH + MARGIN * 2, ARENA_LAVA_Y - bandTop);
    }
    // Rocky silhouettes at the edges.
    cave.fillStyle(0x0f0a1e, 0.85);
    for (const [x, width, height] of [[-40, 120, 260], [60, 90, 150], [840, 90, 170], [900, 140, 280]] as const) {
      cave.fillTriangle(x, ARENA_LAVA_Y, x + width / 2, ARENA_LAVA_Y - height, x + width, ARENA_LAVA_Y);
    }
    this.lava = scene.add.graphics().setDepth(40);
    // Embers drifting up from the lava.
    scene.add.particles(0, 0, TEXTURE.dot, {
      x: { min: 0, max: ARENA_WIDTH },
      y: ARENA_LAVA_Y,
      speedY: { min: -90, max: -30 },
      speedX: { min: -15, max: 15 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xfde047, 0xfb923c, 0xef4444],
      lifespan: 1_800,
      frequency: 90,
    }).setDepth(41);
    this.splashes = scene.add.particles(0, 0, TEXTURE.dot, {
      emitting: false,
      speed: { min: 160, max: 380 },
      angle: { min: 220, max: 320 },
      scale: { start: 1.6, end: 0 },
      gravityY: 900,
      tint: [0xfde047, 0xfb923c, 0xef4444],
      lifespan: 800,
    }).setDepth(42);
  }

  update(time: number): void {
    const g = this.lava.clear();
    const surface = (x: number, offset: number): number => ARENA_LAVA_Y + Math.sin(x / 60 + time / 420 + offset) * 4 + Math.sin(x / 23 - time / 300) * 2;
    const points: Phaser.Math.Vector2[] = [];
    for (let x = -MARGIN; x <= ARENA_WIDTH + MARGIN; x += 16) points.push(new Phaser.Math.Vector2(x, surface(x, 0)));
    points.push(new Phaser.Math.Vector2(ARENA_WIDTH + MARGIN, ARENA_LAVA_Y + DEPTH), new Phaser.Math.Vector2(-MARGIN, ARENA_LAVA_Y + DEPTH));
    g.fillStyle(0xdc2626, 1).fillPoints(points, true);
    // Brighter crust bands drifting on top.
    g.fillStyle(0xf97316, 0.9);
    for (let x = -MARGIN; x < ARENA_WIDTH + MARGIN; x += 16) g.fillRect(x, surface(x, 0) + 2, 16, 10 + Math.sin(x / 40 + time / 500) * 4);
    g.fillStyle(0xfde047, 0.75);
    for (let x = -MARGIN; x < ARENA_WIDTH + MARGIN; x += 16) g.fillRect(x, surface(x, 0) + 1, 16, 3);
    // Bubbles that swell and pop.
    for (let bubble = 0; bubble < 9; bubble += 1) {
      const life = (time / 1_400 + bubble * 0.37) % 1;
      const x = ((bubble * 137 + Math.floor(time / 1_400 + bubble * 0.37) * 211) % (ARENA_WIDTH + 80)) - 40;
      g.fillStyle(0xfbbf24, 0.9 * (1 - life)).fillCircle(x, ARENA_LAVA_Y + 8 - life * 8, 3 + life * 9);
    }
  }

  splash(x: number): void {
    this.splashes.explode(36, x, ARENA_LAVA_Y);
    const ring = this.scene.add.ellipse(x, ARENA_LAVA_Y + 4, 30, 10).setStrokeStyle(4, 0xfde047).setDepth(43);
    this.scene.tweens.add({ targets: ring, scaleX: 4, scaleY: 2, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
  }
}
