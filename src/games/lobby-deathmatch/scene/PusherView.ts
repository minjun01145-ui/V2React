import Phaser from "phaser";
import { ARENA_PUSHERS, ARENA_WIDTH, pusherSpan, type ArenaPusher } from "../arena.ts";

interface LivePusher {
  readonly pusher: ArenaPusher;
  readonly zone: Phaser.GameObjects.Zone;
  readonly art: Phaser.GameObjects.Graphics;
}

/** Rod length, so the whole rod (partly hidden in the wall) slides instead of growing. */
function rodLength(pusher: ArenaPusher): number {
  return pusher.reach + 40;
}

/**
 * Cylinders that slide out of the side walls and back. Each is a fixed-length
 * rod, solid on every side and moved by direct control, so Arcade sees real
 * displacement and separates anyone it runs into: standing in the way means
 * being shoved along.
 */
export class PusherView {
  readonly group: Phaser.Physics.Arcade.Group;
  private readonly pushers: LivePusher[];

  constructor(scene: Phaser.Scene) {
    this.group = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.pushers = ARENA_PUSHERS.map((pusher) => {
      const zone = scene.add.zone(0, pusher.y + pusher.height / 2, rodLength(pusher), pusher.height);
      this.group.add(zone);
      (zone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true).setDirectControl(true);
      return { pusher, zone, art: scene.add.graphics().setDepth(8) };
    });
  }

  update(nowMs: number): void {
    for (const { pusher, zone, art } of this.pushers) {
      const span = pusherSpan(pusher, nowMs);
      const length = rodLength(pusher);
      zone.setX(pusher.wall === "left" ? span.right - length / 2 : span.left + length / 2);
      this.draw(art, pusher, span.left, span.right);
    }
  }

  private draw(g: Phaser.GameObjects.Graphics, pusher: ArenaPusher, left: number, right: number): void {
    const { y, height } = pusher;
    const towardsArena = pusher.wall === "left" ? 1 : -1;
    const head = pusher.wall === "left" ? right : left;
    g.clear();
    // Shaft with sliding highlights.
    g.fillStyle(0x475569, 1).fillRect(left, y + 6, right - left, height - 12);
    g.fillStyle(0x94a3b8, 1).fillRect(left, y + 9, right - left, 5);
    g.fillStyle(0x1e293b, 0.35).fillRect(left, y + height - 12, right - left, 4);
    // Wall housing.
    const housingX = pusher.wall === "left" ? -10 : ARENA_WIDTH + 10 - 38;
    g.fillStyle(0x334155, 1).fillRoundedRect(housingX, y - 8, 38, height + 16, 6);
    g.fillStyle(0xfacc15, 1).fillRect(housingX + 4, y - 4, 30, 4).fillRect(housingX + 4, y + height, 30, 4);
    // Rounded cylinder head with warning stripes.
    const headLeft = head - (towardsArena > 0 ? 22 : 0);
    g.fillStyle(0xef4444, 1).fillRoundedRect(headLeft, y, 22, height, 8);
    g.fillStyle(0xffffff, 0.9);
    for (let stripe = 0; stripe < 3; stripe += 1) g.fillRect(headLeft + 3, y + 7 + stripe * 11, 16, 4);
    g.lineStyle(2, 0x7f1d1d, 1).strokeRoundedRect(headLeft, y, 22, height, 8);
  }
}
