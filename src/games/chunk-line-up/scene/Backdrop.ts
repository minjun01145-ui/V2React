import Phaser from "phaser";
import { CHUNK_LINE_UP_WORLD_HEIGHT, CHUNK_LINE_UP_WORLD_WIDTH } from "../model.ts";
import {
  CHUNK_LINE_UP_GROUND_Y,
  CHUNK_LINE_UP_WALK_LEFT,
  CHUNK_LINE_UP_WALK_RIGHT,
  chunkLineUpFloorGap,
  chunkLineUpFloorY,
} from "../layout.ts";
import { TEXTURE } from "./art.ts";

// The camera letterboxes the fixed world on odd aspect ratios, so the sky and
// ground are painted well past the world edges instead of leaving bare bars.
const BLEED = 1_600;

interface Cloud {
  readonly image: Phaser.GameObjects.Image;
  readonly speed: number;
}

export class Backdrop {
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly tower: Phaser.GameObjects.Graphics;
  private readonly clouds: Cloud[] = [];

  constructor(scene: Phaser.Scene) {
    this.sky = scene.add.graphics().setDepth(-30);
    this.tower = scene.add.graphics().setDepth(-10);
    this.drawSky();
    for (let index = 0; index < 7; index += 1) {
      const image = scene.add.image(
        Phaser.Math.Between(-300, CHUNK_LINE_UP_WORLD_WIDTH + 300),
        Phaser.Math.Between(20, 150),
        TEXTURE.cloud,
      ).setDepth(-20).setAlpha(Phaser.Math.FloatBetween(0.55, 0.9));
      image.setScale(Phaser.Math.FloatBetween(0.45, 1));
      this.clouds.push({ image, speed: Phaser.Math.FloatBetween(4, 12) });
    }
  }

  drawTower(floorCount: number): void {
    const graphics = this.tower.clear();
    const gap = chunkLineUpFloorGap(floorCount);
    const topY = chunkLineUpFloorY(0, floorCount) - gap - 18;
    const left = CHUNK_LINE_UP_WALK_LEFT - 6;
    const right = CHUNK_LINE_UP_WALK_RIGHT + 6;

    // Roof and facade.
    graphics.fillStyle(0x3d5a80, 1).fillRoundedRect(left - 14, topY - 16, right - left + 28, 22, 8);
    graphics.fillStyle(0xf7f1e3, 1).fillRect(left, topY, right - left, CHUNK_LINE_UP_GROUND_Y - topY);

    for (let floor = 0; floor < floorCount; floor += 1) {
      const floorY = chunkLineUpFloorY(floor, floorCount);
      const bandTop = floorY - gap;
      graphics.fillStyle(floor % 2 === 0 ? 0xfaf6ec : 0xf1eadb, 1).fillRect(left, bandTop, right - left, gap);
      // Windows on the back wall give each floor a sense of depth.
      const windowHeight = Math.min(32, gap - 44);
      if (windowHeight > 10) {
        for (let x = left + 40; x < right - 40; x += 118) {
          graphics.fillStyle(0xcfe6f2, 0.8).fillRoundedRect(x, bandTop + 12, 46, windowHeight, 5);
          graphics.fillStyle(0xffffff, 0.55).fillRect(x + 6, bandTop + 15, 6, windowHeight - 6);
          graphics.lineStyle(2, 0xd8cbb0, 1).strokeRoundedRect(x, bandTop + 12, 46, windowHeight, 5);
        }
      }
    }
    // Lobby band above the ground.
    const lobbyTop = chunkLineUpFloorY(floorCount, floorCount) - gap;
    graphics.fillStyle(0xe9f1f4, 1).fillRect(left, lobbyTop, right - left, gap);
    graphics.fillStyle(0xd6e4ea, 1).fillRect(left, CHUNK_LINE_UP_GROUND_Y - 10, right - left, 10);
    graphics.lineStyle(3, 0xd8cbb0, 1).strokeRect(left, topY, right - left, CHUNK_LINE_UP_GROUND_Y - topY);
  }

  update(delta: number): void {
    const seconds = delta / 1_000;
    for (const cloud of this.clouds) {
      cloud.image.x += cloud.speed * seconds;
      if (cloud.image.x > CHUNK_LINE_UP_WORLD_WIDTH + BLEED / 2) cloud.image.x = -BLEED / 2;
    }
  }

  private drawSky(): void {
    const graphics = this.sky;
    const left = -BLEED;
    const width = CHUNK_LINE_UP_WORLD_WIDTH + BLEED * 2;
    graphics.fillGradientStyle(0x7cc4f5, 0x7cc4f5, 0xdff3ff, 0xdff3ff, 1);
    graphics.fillRect(left, -BLEED, width, BLEED + CHUNK_LINE_UP_GROUND_Y);

    // Distant hills.
    graphics.fillStyle(0xb9dfc8, 1);
    for (let x = left; x < left + width; x += 220) {
      graphics.fillEllipse(x + 110, CHUNK_LINE_UP_GROUND_Y + 8, 320, 150);
    }
    // Ground: grass lip, soil below.
    graphics.fillStyle(0x6dbf73, 1).fillRect(left, CHUNK_LINE_UP_GROUND_Y, width, 12);
    graphics.fillStyle(0x4f9a58, 1).fillRect(left, CHUNK_LINE_UP_GROUND_Y + 12, width, 4);
    graphics.fillStyle(0xc9a878, 1).fillRect(left, CHUNK_LINE_UP_GROUND_Y + 16, width, CHUNK_LINE_UP_WORLD_HEIGHT + BLEED);
    graphics.fillStyle(0xb8966a, 1);
    for (let x = left; x < left + width; x += 46) {
      graphics.fillRoundedRect(x + (x % 3) * 7, CHUNK_LINE_UP_GROUND_Y + 22 + (x % 2) * 6, 16, 5, 2);
    }
  }
}
