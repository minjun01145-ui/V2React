import Phaser from "phaser";
import { CHUNK_LINE_UP_WORLD_WIDTH } from "../model.ts";
import {
  CHUNK_LINE_UP_FLOOR_GAP,
  CHUNK_LINE_UP_WALK_LEFT,
  CHUNK_LINE_UP_WALK_RIGHT,
  chunkLineUpFloorY,
  chunkLineUpGroundY,
} from "../layout.ts";
import { TEXTURE } from "../../../game-engine/phaser-kit/art.ts";
import { BakedLayer } from "../../../game-engine/phaser-kit/BakedLayer.ts";

// The camera may show more than the world on odd aspect ratios, so the sky and
// ground are painted well past the world edges instead of leaving bare bars.
const BLEED = 1_600;
/** Hills are baked, so they only cover the widths a camera can realistically show. */
const DETAIL_BLEED = 700;

interface Cloud {
  readonly image: Phaser.GameObjects.Image;
  readonly speed: number;
}

export class Backdrop {
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly ground: BakedLayer;
  private readonly tower: BakedLayer;
  private readonly clouds: Cloud[] = [];

  constructor(scene: Phaser.Scene) {
    this.sky = scene.add.graphics().setDepth(-30);
    this.ground = new BakedLayer(scene, "cl-ground", -29);
    this.tower = new BakedLayer(scene, "cl-tower", -10);
    for (let index = 0; index < 9; index += 1) {
      const image = scene.add.image(
        Phaser.Math.Between(-300, CHUNK_LINE_UP_WORLD_WIDTH + 300),
        Phaser.Math.Between(-120, 140),
        TEXTURE.cloud,
      ).setDepth(-20).setAlpha(Phaser.Math.FloatBetween(0.55, 0.9));
      image.setScale(Phaser.Math.FloatBetween(0.45, 1));
      this.clouds.push({ image, speed: Phaser.Math.FloatBetween(4, 12) });
    }
  }

  draw(floorCount: number): void {
    const groundY = chunkLineUpGroundY(floorCount);
    this.drawSky(groundY);
    const topY = chunkLineUpFloorY(0, floorCount) - CHUNK_LINE_UP_FLOOR_GAP * 0.55;
    const left = CHUNK_LINE_UP_WALK_LEFT - 6;
    const right = CHUNK_LINE_UP_WALK_RIGHT + 6;
    this.tower.draw(
      { x: left - 16, y: topY - 72, width: right - left + 32, height: groundY - topY + 74 },
      (graphics) => this.paintTower(graphics, floorCount, topY, left, right, groundY),
    );
  }

  private paintTower(graphics: Phaser.GameObjects.Graphics, floorCount: number, topY: number, left: number, right: number, groundY: number): void {

    // Roof, flag and facade.
    graphics.fillStyle(0x3d5a80, 1).fillRoundedRect(left - 14, topY - 16, right - left + 28, 22, 8);
    graphics.fillStyle(0x64748b, 1).fillRect(CHUNK_LINE_UP_WORLD_WIDTH / 2 - 2, topY - 70, 4, 56);
    graphics.fillStyle(0xf97316, 1).fillTriangle(
      CHUNK_LINE_UP_WORLD_WIDTH / 2 + 2, topY - 70,
      CHUNK_LINE_UP_WORLD_WIDTH / 2 + 40, topY - 58,
      CHUNK_LINE_UP_WORLD_WIDTH / 2 + 2, topY - 46,
    );
    graphics.fillStyle(0xf7f1e3, 1).fillRect(left, topY, right - left, groundY - topY);

    for (let floor = 0; floor <= floorCount; floor += 1) {
      const floorY = chunkLineUpFloorY(floor, floorCount);
      const bandTop = Math.max(topY, floorY - CHUNK_LINE_UP_FLOOR_GAP);
      graphics.fillStyle(floor === floorCount ? 0xe9f1f4 : floor % 2 === 0 ? 0xfaf6ec : 0xf1eadb, 1)
        .fillRect(left, bandTop, right - left, floorY - bandTop);
      // Windows on the back wall give each floor depth; they sit high so they never hide props.
      for (let x = left + 60; x < right - 90; x += 150) {
        const y = floorY - 150;
        if (y < bandTop + 50) continue;
        graphics.fillStyle(0xcfe6f2, 0.75).fillRoundedRect(x, y, 56, 44, 6);
        graphics.fillStyle(0xffffff, 0.5).fillRect(x + 7, y + 4, 7, 36);
        graphics.lineStyle(2, 0xd8cbb0, 1).strokeRoundedRect(x, y, 56, 44, 6);
      }
    }
    graphics.fillStyle(0xd6e4ea, 1).fillRect(left, groundY - 10, right - left, 10);
    graphics.lineStyle(3, 0xd8cbb0, 1).strokeRect(left, topY, right - left, groundY - topY);
  }

  update(delta: number): void {
    const seconds = delta / 1_000;
    for (const cloud of this.clouds) {
      cloud.image.x += cloud.speed * seconds;
      if (cloud.image.x > CHUNK_LINE_UP_WORLD_WIDTH + BLEED / 2) cloud.image.x = -BLEED / 2;
    }
  }

  private drawSky(groundY: number): void {
    // Live layer: only plain rectangles (the gradient cannot be baked).
    const graphics = this.sky.clear();
    const left = -BLEED;
    const width = CHUNK_LINE_UP_WORLD_WIDTH + BLEED * 2;
    graphics.fillGradientStyle(0x5fb3ef, 0x5fb3ef, 0xdff3ff, 0xdff3ff, 1);
    graphics.fillRect(left, -BLEED, width, BLEED + groundY);
    paintGround(graphics, left, width, groundY);
    graphics.fillStyle(0xc9a878, 1).fillRect(left, groundY + 16, width, BLEED);

    // Baked layer: hills and soil specks around the tower.
    const detailLeft = -DETAIL_BLEED;
    const detailWidth = CHUNK_LINE_UP_WORLD_WIDTH + DETAIL_BLEED * 2;
    this.ground.draw({ x: detailLeft, y: groundY - 70, width: detailWidth, height: 110 }, (detail) => {
      detail.fillStyle(0xb9dfc8, 1);
      for (let x = detailLeft; x < detailLeft + detailWidth; x += 220) detail.fillEllipse(x + 110, groundY + 8, 320, 150);
      paintGround(detail, detailLeft, detailWidth, groundY);
      detail.fillStyle(0xc9a878, 1).fillRect(detailLeft, groundY + 16, detailWidth, 24);
      detail.fillStyle(0xb8966a, 1);
      for (let x = detailLeft; x < detailLeft + detailWidth; x += 46) {
        detail.fillRoundedRect(x + Math.abs(x % 3) * 7, groundY + 22 + Math.abs(x % 2) * 6, 16, 5, 2);
      }
    });
  }
}

function paintGround(graphics: Phaser.GameObjects.Graphics, left: number, width: number, groundY: number): void {
  graphics.fillStyle(0x6dbf73, 1).fillRect(left, groundY, width, 12);
  graphics.fillStyle(0x4f9a58, 1).fillRect(left, groundY + 12, width, 4);
}
