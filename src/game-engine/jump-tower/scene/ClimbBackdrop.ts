import Phaser from "phaser";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../phaser-kit/art.ts";
import { BakedLayer, bakeSprite } from "../../phaser-kit/BakedLayer.ts";
import { CLIMB_STEP, CLIMB_WORLD_WIDTH } from "../course.ts";

/** Sky colours by altitude (floor number): day → dusk → night with stars. */
const SKY: ReadonlyArray<readonly [number, number]> = [
  [0, 0x8fd3ff],
  [60, 0x5aa9ec],
  [150, 0x3b5bb5],
  [260, 0x221e5c],
  [400, 0x0b0a24],
];
const WALL_WIDTH = 46;

function skyColor(floor: number): number {
  for (let index = 1; index < SKY.length; index += 1) {
    const [toFloor, toColor] = SKY[index]!;
    const [fromFloor, fromColor] = SKY[index - 1]!;
    if (floor > toFloor) continue;
    const t = (floor - fromFloor) / (toFloor - fromFloor);
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(fromColor),
      Phaser.Display.Color.ValueToColor(toColor),
      100,
      Math.round(t * 100),
    );
    return Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
  }
  return SKY[SKY.length - 1]![1];
}

/** Everything behind the platforms. Repeating layers follow the camera, since the tower never ends. */
export class ClimbBackdrop {
  private readonly scene: Phaser.Scene;
  private readonly clouds: Phaser.GameObjects.TileSprite;
  private readonly stars: Phaser.GameObjects.TileSprite;
  private readonly walls: readonly Phaser.GameObjects.TileSprite[];
  private lastColor = -1;

  constructor(scene: Phaser.Scene, showSign = true) {
    this.scene = scene;
    bakeSprite(scene, "climb-clouds", 512, 512, (graphics) => {
      graphics.fillStyle(0xffffff, 0.85);
      for (const [x, y, s] of [[60, 80, 1], [330, 210, 0.7], [140, 380, 0.85], [420, 450, 0.6]] as const) {
        graphics.fillEllipse(x, y, 110 * s, 44 * s);
        graphics.fillEllipse(x + 40 * s, y - 14 * s, 96 * s, 60 * s);
        graphics.fillEllipse(x + 84 * s, y, 104 * s, 42 * s);
      }
    });
    bakeSprite(scene, "climb-stars", 256, 256, (graphics) => {
      const random = new Phaser.Math.RandomDataGenerator(["climb-stars"]);
      for (let index = 0; index < 40; index += 1) {
        graphics.fillStyle(0xffffff, random.realInRange(0.4, 1)).fillCircle(random.between(0, 255), random.between(0, 255), random.realInRange(0.6, 1.8));
      }
    });
    bakeSprite(scene, "climb-wall", WALL_WIDTH, 92, (graphics) => {
      graphics.fillStyle(0x7c6a55, 1).fillRect(0, 0, WALL_WIDTH, 92);
      graphics.fillStyle(0x968069, 1).fillRect(3, 3, WALL_WIDTH - 6, 40).fillRect(3, 49, WALL_WIDTH - 6, 40);
      graphics.fillStyle(0xffffff, 0.12).fillRect(6, 6, WALL_WIDTH - 12, 4);
    });

    this.stars = scene.add.tileSprite(0, 0, 100, 100, "climb-stars").setOrigin(0).setScrollFactor(0).setDepth(-40).setAlpha(0);
    this.clouds = scene.add.tileSprite(0, 0, 100, 100, "climb-clouds").setOrigin(0).setScrollFactor(0).setDepth(-39);
    this.walls = [-WALL_WIDTH, CLIMB_WORLD_WIDTH].map((x) => scene.add.tileSprite(x, 0, WALL_WIDTH, 100, "climb-wall")
      .setOrigin(0).setScrollFactor(1, 0).setDepth(-5));

    // Ground with a little welcome sign; baked because it never changes.
    new BakedLayer(scene, "climb-ground", -6).draw({ x: -600, y: -40, width: CLIMB_WORLD_WIDTH + 1_200, height: 400 }, (graphics) => {
      graphics.fillStyle(0x6dbf73, 1).fillRect(-600, 0, CLIMB_WORLD_WIDTH + 1_200, 12);
      graphics.fillStyle(0x4f9a58, 1).fillRect(-600, 12, CLIMB_WORLD_WIDTH + 1_200, 4);
      graphics.fillStyle(0xc9a878, 1).fillRect(-600, 16, CLIMB_WORLD_WIDTH + 1_200, 340);
      if (showSign) graphics.fillStyle(0x64748b, 1).fillRect(CLIMB_WORLD_WIDTH / 2 - 3, -40, 6, 40);
    });
    if (showSign) scene.add.text(CLIMB_WORLD_WIDTH / 2, -46, "점프 타워 · 끝까지 올라가 보자!", {
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#1e3a5f",
      backgroundColor: "#fef3c7",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(-4).setResolution(TEXT_RESOLUTION);
  }

  update(): void {
    const camera = this.scene.cameras.main;
    const width = camera.width / camera.zoom;
    const height = camera.height / camera.zoom;
    // Scroll-factor-0 sprites are still zoomed around the view centre; size them to cover it.
    const left = camera.width / 2 - width / 2;
    const top = camera.height / 2 - height / 2;
    for (const layer of [this.stars, this.clouds]) layer.setPosition(left, top).setSize(width, height);
    this.clouds.setTilePosition(camera.scrollX * 0.2, camera.scrollY * 0.25);
    this.stars.setTilePosition(camera.scrollX * 0.05, camera.scrollY * 0.05);
    for (const wall of this.walls) wall.setY(top).setSize(wall.width, height).setTilePosition(0, camera.scrollY);

    const floor = Math.max(0, -camera.midPoint.y / CLIMB_STEP);
    const color = skyColor(floor);
    if (color !== this.lastColor) {
      this.lastColor = color;
      camera.setBackgroundColor(color);
    }
    this.clouds.setAlpha(Phaser.Math.Clamp(1 - (floor - 150) / 150, 0.15, 1));
    this.stars.setAlpha(Phaser.Math.Clamp((floor - 120) / 140, 0, 1));
  }
}
