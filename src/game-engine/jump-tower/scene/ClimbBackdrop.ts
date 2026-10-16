import Phaser from "phaser";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../phaser-kit/art.ts";
import { BakedLayer, bakeSprite } from "../../phaser-kit/BakedLayer.ts";
import { CLIMB_WORLD_WIDTH } from "../course.ts";
import { CLIMB_MAPS, type ClimbMapDefinition } from "../maps/index.ts";

const WALL_WIDTH = 46;

/** Theme data drives the same layers for every tower; no map-specific scene subclasses. */
export class ClimbBackdrop {
  private readonly scene: Phaser.Scene;
  private readonly map: ClimbMapDefinition;
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly scenery: Phaser.GameObjects.TileSprite;
  private readonly walls: readonly Phaser.GameObjects.TileSprite[];
  private width = 0;
  private height = 0;

  constructor(scene: Phaser.Scene, map: ClimbMapDefinition = CLIMB_MAPS[0], showSign = true) {
    this.scene = scene;
    this.map = map;
    const { theme } = map;
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(-50);
    const sceneryKey = `climb-scenery-${map.id}`;
    bakeSprite(scene, sceneryKey, 512, 512, (graphics) => {
      if (theme.scenery === "clouds") {
        graphics.fillStyle(theme.accent, 0.7);
        for (const [x, y, size] of [[40, 80, 1], [290, 230, 0.7], [110, 410, 0.85]] as const) {
          graphics.fillEllipse(x, y, 110 * size, 42 * size);
          graphics.fillEllipse(x + 40 * size, y - 14 * size, 96 * size, 60 * size);
          graphics.fillEllipse(x + 80 * size, y, 100 * size, 42 * size);
        }
      } else {
        const random = new Phaser.Math.RandomDataGenerator([map.id]);
        for (let index = 0; index < 65; index += 1) {
          const x = random.between(0, 511);
          const y = random.between(0, 511);
          graphics.fillStyle(theme.accent, random.realInRange(0.25, 0.85));
          if (theme.scenery === "snow") graphics.fillCircle(x, y, random.realInRange(1, 3));
          else graphics.fillEllipse(x, y, 3, random.between(4, 9));
        }
      }
    });
    const wallKey = `climb-wall-${map.id}`;
    bakeSprite(scene, wallKey, WALL_WIDTH, 184, (graphics) => {
      graphics.fillStyle(theme.wall[0], 1).fillRect(0, 0, WALL_WIDTH, 184);
      for (let y = 0; y < 184; y += 46) {
        graphics.fillStyle(theme.wall[1], 1).fillRoundedRect(3, y + 3, WALL_WIDTH - 6, 40, theme.shape === "ice" ? 1 : 7);
        if (theme.shape === "ice") {
          graphics.fillStyle(theme.accent, 0.65).fillTriangle(4, y + 4, 28, y + 4, 10, y + 39);
        } else if (theme.shape === "rock") {
          graphics.lineStyle(2, theme.accent, 0.65).lineBetween(8, y + 4, 28, y + 22).lineBetween(28, y + 22, 21, y + 40);
        }
      }
    });
    this.scenery = scene.add.tileSprite(0, 0, 100, 100, sceneryKey).setOrigin(0).setScrollFactor(0).setDepth(-39);
    this.walls = [-WALL_WIDTH, CLIMB_WORLD_WIDTH].map((x) => scene.add.tileSprite(x, 0, WALL_WIDTH, 100, wallKey)
      .setOrigin(0).setScrollFactor(1, 0).setDepth(-5));

    new BakedLayer(scene, `climb-ground-${map.id}`, -6).draw({ x: -600, y: -40, width: CLIMB_WORLD_WIDTH + 1200, height: 400 }, (graphics) => {
      graphics.fillStyle(theme.ground[0], 1).fillRect(-600, 0, CLIMB_WORLD_WIDTH + 1200, 12);
      graphics.fillStyle(theme.ground[1], 1).fillRect(-600, 12, CLIMB_WORLD_WIDTH + 1200, 350);
      if (theme.scenery === "embers") {
        graphics.fillStyle(theme.accent, 0.9).fillRect(-600, 28, CLIMB_WORLD_WIDTH + 1200, 16);
        graphics.fillStyle(0xffdf80, 0.8).fillRect(-600, 28, CLIMB_WORLD_WIDTH + 1200, 4);
      }
    });
    if (showSign) scene.add.text(70, -24, map.name, {
      fontFamily: FONT_FAMILY, fontSize: "18px", fontStyle: "600", color: "#ffffff",
      stroke: "#17324d", strokeThickness: 4,
    }).setOrigin(0, 1).setDepth(-4).setResolution(TEXT_RESOLUTION);
  }

  update(nowMs: number): void {
    const camera = this.scene.cameras.main;
    const width = camera.width / camera.zoom;
    const height = camera.height / camera.zoom;
    const left = camera.width / 2 - width / 2;
    const top = camera.height / 2 - height / 2;
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      const [upper, lower] = this.map.theme.sky;
      this.sky.clear().fillGradientStyle(upper, upper, lower, lower, 1).fillRect(left, top, width, height);
    }
    this.scenery.setPosition(left, top).setSize(width, height);
    const drift = this.map.theme.scenery === "snow" ? -nowMs / 65 : this.map.theme.scenery === "embers" ? nowMs / 45 : 0;
    this.scenery.setTilePosition(camera.scrollX * 0.2, camera.scrollY * 0.25 + drift);
    for (const wall of this.walls) wall.setY(top).setSize(wall.width, height).setTilePosition(0, camera.scrollY);
  }
}
