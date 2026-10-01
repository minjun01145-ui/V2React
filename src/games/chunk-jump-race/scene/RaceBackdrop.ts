import Phaser from "phaser";
import { bakeSprite } from "../../../game-engine/phaser-kit/BakedLayer.ts";

const SKY_TOP = 0x5fb3ef;
const SKY_BOTTOM = 0xe6f6ff;

interface Layer {
  readonly sprite: Phaser.GameObjects.TileSprite;
  readonly factor: number;
}

/**
 * Screen-anchored sky with repeating parallax layers. The course is endless to
 * the right, so every layer is a TileSprite scrolled from the camera position.
 */
export class RaceBackdrop {
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly layers: Layer[] = [];

  constructor(scene: Phaser.Scene, worldHeight: number) {
    bakeSprite(scene, "race-clouds", 640, 160, (graphics) => {
      graphics.fillStyle(0xffffff, 0.9);
      for (const [x, y, scale] of [[80, 60, 1], [300, 100, 0.7], [500, 50, 0.85]] as const) {
        graphics.fillEllipse(x, y, 90 * scale, 40 * scale);
        graphics.fillEllipse(x + 36 * scale, y - 12 * scale, 80 * scale, 52 * scale);
        graphics.fillEllipse(x + 72 * scale, y, 86 * scale, 38 * scale);
      }
    });
    bakeSprite(scene, "race-mountains", 720, 200, (graphics) => {
      graphics.fillStyle(0xa5cfe8, 1);
      graphics.fillTriangle(0, 200, 150, 40, 300, 200);
      graphics.fillTriangle(220, 200, 400, 70, 580, 200);
      graphics.fillTriangle(480, 200, 620, 30, 760, 200);
      graphics.fillStyle(0xffffff, 0.8);
      graphics.fillTriangle(128, 62, 150, 40, 172, 62);
      graphics.fillTriangle(600, 52, 620, 30, 640, 52);
    });
    bakeSprite(scene, "race-hills", 640, 160, (graphics) => {
      graphics.fillStyle(0x9fd8b5, 1);
      graphics.fillEllipse(120, 150, 360, 200);
      graphics.fillEllipse(440, 160, 420, 190);
      graphics.fillStyle(0x86c9a0, 1);
      graphics.fillEllipse(300, 170, 300, 120);
    });
    bakeSprite(scene, "race-mist", 256, 120, (graphics) => {
      // Baked textures cannot hold gradients, so fade in with stacked bands.
      for (let band = 0; band < 12; band += 1) {
        graphics.fillStyle(0xcfe8f7, 0.1 + band * 0.075).fillRect(0, band * 10, 256, 10);
      }
    });

    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(-40);
    this.addLayer(scene, "race-clouds", 40, 0.08, -32, 0.85);
    this.addLayer(scene, "race-mountains", 150, 0.18, -31, 1);
    this.addLayer(scene, "race-hills", 250, 0.35, -30, 1);
    this.addLayer(scene, "race-mist", worldHeight - 70, 0.6, -2, 0.9);
    this.resize(scene);
  }

  resize(scene: Phaser.Scene): void {
    const camera = scene.cameras.main;
    // Scroll-factor-0 objects are still zoomed around the view centre, so cover generously.
    const width = camera.width / camera.zoom * 3;
    const height = camera.height / camera.zoom * 3;
    const left = camera.width / 2 - width / 2;
    const top = camera.height / 2 - height / 2;
    this.sky.clear();
    this.sky.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_BOTTOM, SKY_BOTTOM, 1);
    this.sky.fillRect(left, top, width, height);
    for (const layer of this.layers) {
      layer.sprite.setSize(width, layer.sprite.height).setX(left);
    }
  }

  update(scrollX: number): void {
    for (const layer of this.layers) layer.sprite.tilePositionX = scrollX * layer.factor;
  }

  private addLayer(scene: Phaser.Scene, key: string, y: number, factor: number, depth: number, alpha: number): void {
    const frame = scene.textures.getFrame(key);
    const sprite = scene.add.tileSprite(0, y, 100, frame.height, key)
      .setOrigin(0, 0)
      .setScrollFactor(0, 1)
      .setDepth(depth)
      .setAlpha(alpha);
    this.layers.push({ sprite, factor });
  }
}
