import Phaser from "phaser";
import { chunkLineUpPropX, chunkLineUpProps, type ChunkLineUpProp } from "../layout.ts";

const STEP_HEIGHT = 14;
const PAD_HEIGHT = 10;

interface MovingPlatform {
  readonly prop: ChunkLineUpProp;
  readonly zone: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Graphics;
}

interface Pad {
  readonly prop: ChunkLineUpProp;
  readonly art: Phaser.GameObjects.Graphics;
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

function drawPad(graphics: Phaser.GameObjects.Graphics, width: number, squash: number): void {
  graphics.clear();
  const spring = 6 * squash;
  graphics.fillStyle(0x64748b, 1).fillRect(-width / 2 + 6, -spring - 2, 4, spring + 2).fillRect(width / 2 - 10, -spring - 2, 4, spring + 2);
  graphics.fillStyle(0xef4444, 1).fillRoundedRect(-width / 2, -spring - PAD_HEIGHT, width, PAD_HEIGHT, 5);
  graphics.fillStyle(0xfecaca, 1).fillRoundedRect(-width / 2 + 5, -spring - PAD_HEIGHT + 2, width - 10, 3, 2);
}

/** The climbing course between floors: static steps, clock-synced moving platforms and jump pads. */
export class PropsView {
  private readonly scene: Phaser.Scene;
  private readonly staticArt: Phaser.GameObjects.Graphics;
  readonly steps: Phaser.Physics.Arcade.StaticGroup;
  readonly movers: Phaser.Physics.Arcade.Group;
  private moving: MovingPlatform[] = [];
  private pads: Pad[] = [];
  private floorCount = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.staticArt = scene.add.graphics().setDepth(5);
    this.steps = scene.physics.add.staticGroup();
    this.movers = scene.physics.add.group({ allowGravity: false, immovable: true });
  }

  build(floorCount: number, nowMs: number): void {
    if (floorCount === this.floorCount) return;
    this.floorCount = floorCount;
    this.staticArt.clear();
    this.steps.clear(true, true);
    this.movers.clear(true, true);
    this.moving.forEach((platform) => platform.art.destroy());
    this.pads.forEach((pad) => pad.art.destroy());
    this.moving = [];
    this.pads = [];

    for (const prop of chunkLineUpProps(floorCount)) {
      if (prop.kind === "pad") {
        const art = this.scene.add.graphics().setDepth(7).setPosition(prop.x + prop.width / 2, prop.y);
        drawPad(art, prop.width, 1);
        this.pads.push({ prop, art });
      } else if (prop.kind === "step") {
        drawStep(this.staticArt, prop.x, prop.y, prop.width, false);
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
        const art = this.scene.add.graphics().setDepth(5);
        drawStep(art, -prop.width / 2, 0, prop.width, true);
        art.setPosition(x + prop.width / 2, prop.y);
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
    drawPad(pad.art, pad.prop.width, 2.2);
    this.scene.time.delayedCall(140, () => drawPad(pad.art, pad.prop.width, 1));
  }
}

function oneWay(body: { checkCollision: Phaser.Types.Physics.Arcade.ArcadeBodyCollision }): void {
  body.checkCollision.down = false;
  body.checkCollision.left = false;
  body.checkCollision.right = false;
}
