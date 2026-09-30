import Phaser from "phaser";
import type { ChunkLineUpRect } from "../layout.ts";
import { FONT_FAMILY, TEXT_RESOLUTION, TEXTURE } from "./art.ts";

const CONFETTI = [0xf87171, 0xfbbf24, 0x34d399, 0x60a5fa, 0xc084fc, 0xf472b6];

/** Short-lived feedback: dust, sparkles, confetti, floating score text. */
export class Effects {
  private readonly scene: Phaser.Scene;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly stars: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.dust = scene.add.particles(0, 0, TEXTURE.dot, {
      emitting: false,
      speed: { min: 30, max: 90 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: 0xe7dcc7,
      lifespan: 360,
      gravityY: -40,
    }).setDepth(19);
    this.stars = scene.add.particles(0, 0, TEXTURE.star, {
      emitting: false,
      speed: { min: 140, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      rotate: { min: -180, max: 180 },
      tint: [0xfde047, 0xfacc15, 0x4ade80, 0xffffff],
      lifespan: 650,
      gravityY: 420,
    }).setDepth(30);
    this.confetti = scene.add.particles(0, 0, TEXTURE.dot, {
      emitting: false,
      speed: { min: 160, max: 380 },
      angle: { min: 225, max: 315 },
      scaleX: { min: 0.6, max: 1.2 },
      scaleY: { min: 0.3, max: 0.6 },
      rotate: { min: 0, max: 360 },
      tint: CONFETTI,
      lifespan: 1_300,
      gravityY: 520,
    }).setDepth(31);
    this.sparks = scene.add.particles(0, 0, TEXTURE.dot, {
      emitting: false,
      speed: { min: 90, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      tint: [0xef4444, 0xf97316],
      lifespan: 380,
    }).setDepth(30);
  }

  landingDust(x: number, y: number): void {
    this.dust.explode(7, x, y);
  }

  jumpPuff(x: number, y: number): void {
    this.dust.explode(4, x, y);
  }

  correct(x: number, y: number): void {
    this.stars.explode(14, x, y);
    this.floatText(x, y - 40, "+1", "#16a34a");
  }

  wrong(x: number, y: number): void {
    this.sparks.explode(12, x, y);
    this.floatText(x, y - 40, "✕", "#dc2626");
  }

  slotFilled(rect: ChunkLineUpRect): void {
    this.stars.explode(8, rect.x + rect.width / 2, rect.y + rect.height / 2);
    const glow = this.scene.add.rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height, 0xffffff, 0.8)
      .setDepth(9);
    this.scene.tweens.add({
      targets: glow,
      alpha: 0,
      scaleX: 1.15,
      scaleY: 1.6,
      duration: 420,
      ease: "Quad.easeOut",
      onComplete: () => glow.destroy(),
    });
  }

  rowCompleted(left: number, right: number, y: number): void {
    for (let x = left; x <= right; x += (right - left) / 8) this.confetti.explode(8, x, y);
    this.floatText((left + right) / 2, y - 30, "문장 완성!", "#b45309", 26);
  }

  private floatText(x: number, y: number, value: string, color: string, size = 20): void {
    const text = this.scene.add.text(x, y, value, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: "900",
      color,
      stroke: "#ffffff",
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(40).setResolution(TEXT_RESOLUTION).setScale(0.4);
    this.scene.tweens.add({ targets: text, scale: 1, duration: 160, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: text,
      y: y - 36,
      alpha: 0,
      delay: 380,
      duration: 520,
      ease: "Quad.easeIn",
      onComplete: () => text.destroy(),
    });
  }
}
