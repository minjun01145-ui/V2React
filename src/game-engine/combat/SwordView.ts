import Phaser from "phaser";
import { SWORD_REACH } from "./sword.ts";

export interface SwordHolder {
  readonly id: string;
  /** Body centre on screen. */
  readonly x: number;
  readonly y: number;
  readonly facing: number;
}

const BLADE = 27;
/** Resting tilt: held up and forward. Angles are measured for a right-facing holder; up is negative. */
const REST_ANGLE = -0.73;
/** A swing raises the blade behind the head and chops it down to the front. */
const WINDUP_ANGLE = -2.2;
const CHOP_ANGLE = 0.55;
const SWING_MS = 240;

/** Blade angle `age` ms into a swing: snap up, chop down fast, then settle back to rest. */
function swingAngle(age: number): number {
  const t = age / SWING_MS;
  if (t < 0.2) return REST_ANGLE + (WINDUP_ANGLE - REST_ANGLE) * (t / 0.2);
  if (t < 0.55) return WINDUP_ANGLE + (CHOP_ANGLE - WINDUP_ANGLE) * Phaser.Math.Easing.Cubic.Out((t - 0.2) / 0.35);
  return CHOP_ANGLE + (REST_ANGLE - CHOP_ANGLE) * ((t - 0.55) / 0.45);
}

/** Toy swords in the holders' hands, swung on an attack, and the short slash wave they send out. */
export class SwordView {
  private readonly scene: Phaser.Scene;
  private readonly held: Phaser.GameObjects.Graphics;
  private readonly swungAt = new Map<string, number>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.held = scene.add.graphics().setDepth(23);
  }

  drawHeld(holders: readonly SwordHolder[], time: number): void {
    const g = this.held.clear();
    for (const { id, x, y, facing } of holders) {
      const age = time - (this.swungAt.get(id) ?? -Infinity);
      const swinging = age >= 0 && age < SWING_MS;
      const angle = swinging ? swingAngle(age) : REST_ANGLE;
      const handX = x + facing * 14;
      const handY = y - 4 + (swinging ? 0 : Math.sin(time / 220) * 1.5);
      const dx = facing * Math.cos(angle);
      const dy = Math.sin(angle);
      const tipX = handX + dx * BLADE;
      const tipY = handY + dy * BLADE;
      g.lineStyle(5, 0xc4b5fd, 1).lineBetween(handX, handY, tipX, tipY);
      g.lineStyle(2, 0xffffff, 0.9).lineBetween(handX + dx * 2, handY + dy * 2, tipX, tipY);
      // The cross-guard sits across the blade at the hand.
      g.lineStyle(4, 0x7c3aed, 1).lineBetween(handX + dy * 5, handY - dx * 5, handX - dy * 5, handY + dx * 5);
    }
  }

  /** Starts `holderId`'s blade swing and sends a crescent of light as far as the sword reaches. */
  slash(holderId: string, x: number, y: number, facing: number, time: number): void {
    this.swungAt.set(holderId, time);
    const wave = this.scene.add.graphics({ x, y }).setDepth(28);
    const radius = 34;
    wave.lineStyle(10, 0xddd6fe, 0.95);
    wave.beginPath();
    wave.arc(0, 0, radius, -Math.PI / 2.6, Math.PI / 2.6);
    wave.strokePath();
    wave.lineStyle(4, 0xffffff, 1);
    wave.beginPath();
    wave.arc(0, 0, radius + 4, -Math.PI / 3.2, Math.PI / 3.2);
    wave.strokePath();
    wave.setScale(facing < 0 ? -0.6 : 0.6, 0.6);
    this.scene.tweens.add({
      targets: wave,
      x: x + facing * (SWORD_REACH.forward - radius),
      scaleX: facing < 0 ? -1.2 : 1.2,
      scaleY: 1.5,
      alpha: 0,
      duration: 220,
      ease: "Cubic.Out",
      onComplete: () => wave.destroy(),
    });
  }
}
