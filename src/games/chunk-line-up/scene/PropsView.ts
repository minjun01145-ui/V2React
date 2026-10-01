import Phaser from "phaser";
import { BakedLayer, bakeSprite } from "../../../game-engine/phaser-kit/BakedLayer.ts";
import {
  chunkLineUpFloorY,
  chunkLineUpGroundY,
  chunkLineUpPropX,
  chunkLineUpProps,
  type ChunkLineUpProp,
} from "../layout.ts";
import { CHUNK_LINE_UP_WORLD_WIDTH } from "../model.ts";

const STEP_HEIGHT = 14;
const PAD_HEIGHT = 10;

const PAD_ART_HEIGHT = 26;

interface MovingPlatform {
  readonly prop: ChunkLineUpProp;
  readonly zone: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Image;
}

interface Pad {
  readonly prop: ChunkLineUpProp;
  readonly art: Phaser.GameObjects.Image;
}

function drawStep(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, moving: boolean): void {
  const top = moving ? 0x60a5fa : 0x8bd17c;
  const side = moving ? 0x2563eb : 0x5a9e4b;
  graphics.fillStyle(0x0f172a, 0.12).fillRoundedRect(x + 3, y + 5, width, STEP_HEIGHT, 6);
  graphics.fillStyle(side, 1).fillRoundedRect(x, y + 3, width, STEP_HEIGHT - 3, 6);
  graphics.fillStyle(top, 1).fillRoundedRect(x, y, width, STEP_HEIGHT - 5, 6);
  graphics.fillStyle(0xffffff, 0.4).fillRoundedRect(x + 6, y + 2, width - 12, 2, 1);
  if (moving) {
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillTriangle(x + 8, y + 7, x + 14, y + 3, x + 14, y + 11);
    graphics.fillTriangle(x + width - 8, y + 7, x + width - 14, y + 3, x + width - 14, y + 11);
  }
}

/** Pad art is drawn with its base on the bottom edge of the sprite. */
function padTexture(scene: Phaser.Scene, width: number, squash: number): string {
  return bakeSprite(scene, `cl-pad-${width}-${squash}`, width, PAD_ART_HEIGHT, (graphics) => {
    const base = PAD_ART_HEIGHT;
    const spring = 6 * squash;
    graphics.fillStyle(0x64748b, 1).fillRect(6, base - spring - 2, 4, spring + 2).fillRect(width - 10, base - spring - 2, 4, spring + 2);
    graphics.fillStyle(0xef4444, 1).fillRoundedRect(0, base - spring - PAD_HEIGHT, width, PAD_HEIGHT, 5);
    graphics.fillStyle(0xfecaca, 1).fillRoundedRect(5, base - spring - PAD_HEIGHT + 2, width - 10, 3, 2);
  });
}

function moverTexture(scene: Phaser.Scene, width: number): string {
  return bakeSprite(scene, `cl-mover-${width}`, width + 4, STEP_HEIGHT + 6, (graphics) => drawStep(graphics, 0, 0, width, true));
}

/** The climbing course between floors: static steps, clock-synced moving platforms and jump pads. */
export class PropsView {
  private readonly scene: Phaser.Scene;
  private readonly staticArt: BakedLayer;
  readonly steps: Phaser.Physics.Arcade.StaticGroup;
  readonly movers: Phaser.Physics.Arcade.Group;
  private moving: MovingPlatform[] = [];
  private pads: Pad[] = [];
  private floorCount = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.staticArt = new BakedLayer(scene, "cl-steps", 5);
    this.steps = scene.physics.add.staticGroup();
    this.movers = scene.physics.add.group({ allowGravity: false, immovable: true });
  }

  build(floorCount: number, nowMs: number): void {
    if (floorCount === this.floorCount) return;
    this.floorCount = floorCount;
    this.steps.clear(true, true);
    this.movers.clear(true, true);
    this.moving.forEach((platform) => platform.art.destroy());
    this.pads.forEach((pad) => pad.art.destroy());
    this.moving = [];
    this.pads = [];

    const props = chunkLineUpProps(floorCount);
    const top = chunkLineUpFloorY(0, floorCount);
    this.staticArt.draw(
      { x: 0, y: top, width: CHUNK_LINE_UP_WORLD_WIDTH, height: chunkLineUpGroundY(floorCount) - top },
      (graphics) => props.filter((prop) => prop.kind === "step")
        .forEach((prop) => drawStep(graphics, prop.x, prop.y, prop.width, false)),
    );
    for (const prop of props) {
      if (prop.kind === "pad") {
        const art = this.scene.add.image(prop.x + prop.width / 2, prop.y, padTexture(this.scene, prop.width, 1))
          .setOrigin(0.5, 1)
          .setDepth(7);
        this.pads.push({ prop, art });
      } else if (prop.kind === "step") {
        const zone = this.scene.add.zone(prop.x + prop.width / 2, prop.y + 6, prop.width, 12);
        this.steps.add(zone);
        oneWay(zone.body as Phaser.Physics.Arcade.StaticBody);
      } else {
        const x = chunkLineUpPropX(prop, nowMs);
        const zone = this.scene.add.zone(x + prop.width / 2, prop.y + 6, prop.width, 12);
        this.movers.add(zone);
        const body = zone.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false).setImmovable(true);
        oneWay(body);
        const art = this.scene.add.image(x + prop.width / 2, prop.y, moverTexture(this.scene, prop.width))
          .setOrigin(0.5, 0)
          .setDepth(5);
        this.moving.push({ prop, zone, art });
      }
    }
    this.steps.refresh();
  }

  /** Steer moving platforms by velocity (not teleport) so riders are carried along. */
  update(nowMs: number, delta: number): void {
    const seconds = Math.max(delta, 1) / 1_000;
    for (const platform of this.moving) {
      const body = platform.zone.body as Phaser.Physics.Arcade.Body;
      const targetCenter = chunkLineUpPropX(platform.prop, nowMs + delta) + platform.prop.width / 2;
      body.setVelocityX((targetCenter - body.center.x) / seconds);
      body.setVelocityY(0);
      platform.art.setPosition(body.center.x, platform.prop.y);
    }
  }

  /** Horizontal speed of the moving platform under these feet (0 when not on one). */
  carrySpeedAt(centerX: number, feetY: number): number {
    for (const platform of this.moving) {
      const body = platform.zone.body as Phaser.Physics.Arcade.Body;
      if (Math.abs(feetY - body.top) <= 3 && centerX >= body.left - 4 && centerX <= body.right + 4) return body.velocity.x;
    }
    return 0;
  }

  /** Returns the pad under these feet, if any. */
  padAt(centerX: number, feetY: number): ChunkLineUpProp | null {
    return this.pads.find(({ prop }) => Math.abs(feetY - prop.y) <= 4
      && centerX >= prop.x - 6
      && centerX <= prop.x + prop.width + 6)?.prop ?? null;
  }

  bouncePad(id: string): void {
    const pad = this.pads.find((item) => item.prop.id === id);
    if (!pad) return;
    pad.art.setTexture(padTexture(this.scene, pad.prop.width, 2));
    this.scene.time.delayedCall(140, () => pad.art.setTexture(padTexture(this.scene, pad.prop.width, 1)));
  }
}

function oneWay(body: { checkCollision: Phaser.Types.Physics.Arcade.ArcadeBodyCollision }): void {
  body.checkCollision.down = false;
  body.checkCollision.left = false;
  body.checkCollision.right = false;
}
