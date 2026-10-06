import Phaser from "phaser";
import { Effects } from "../../../game-engine/phaser-kit/Effects.ts";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../../game-engine/phaser-kit/art.ts";
import type { SkatingItemKind } from "../sim/items.ts";
import type { GateSign } from "./RinkView.ts";

const CHEERS = ["NICE!", "GREAT!", "SUPER!", "AMAZING!"] as const;
const SHARD_GRAVITY = 900;

/**
 * The game's big moments: gate bursts, crashes, item pickups and booster
 * streaks. Everything here is fire-and-forget and cleans itself up.
 */
export class SkatingEffects {
  private readonly kit: Effects;

  constructor(private readonly scene: Phaser.Scene, private readonly reducedMotion: boolean) {
    this.kit = new Effects(scene);
  }

  /** Correct gate: the chosen sign explodes forward and stars fly to the score. */
  gateBurst(sign: GateSign, color: number, combo: number, points: number): void {
    const { scene } = this;
    const { width, height } = scene.scale;
    const milestone = combo > 0 && combo % 5 === 0;
    const tint = milestone ? 0xffd56a : color;
    this.kit.pickup(sign.x, sign.y);
    this.kit.floatText(sign.x + 30, sign.y - sign.height / 2 - 10, `+${points}`, "#15803d", 28);
    if (this.reducedMotion) return;
    scene.cameras.main.shake(milestone ? 160 : 90, milestone ? 0.005 : 0.0025);
    this.flash(0xffffff, milestone ? 0.35 : 0.2);

    // A luminous beam shoots down the lane ahead.
    const beam = scene.add.rectangle(sign.x, sign.y, width, sign.height * 1.3, tint, 0.4).setOrigin(0, 0.5).setDepth(5);
    scene.tweens.add({ targets: beam, scaleY: 0.08, alpha: 0, duration: 450, ease: "Cubic.Out", onComplete: () => beam.destroy() });
    for (let ring = 0; ring < (milestone ? 3 : 2); ring += 1) {
      const circle = scene.add.circle(sign.x, sign.y, 16).setStrokeStyle(ring ? 3 : 7, ring ? tint : 0xffffff).setDepth(25);
      scene.tweens.add({ targets: circle, scale: milestone ? 9 : 6, alpha: 0, delay: ring * 70, duration: 480, ease: "Cubic.Out",
        onComplete: () => circle.destroy() });
    }
    // The sign shatters into pieces flung forward.
    for (let index = 0; index < 14; index += 1) {
      const startY = sign.y + (index / 13 - 0.5) * sign.height;
      const shard = scene.add.rectangle(sign.x, startY, index % 2 ? 10 : 18, sign.height / 7, index % 3 ? tint : 0xffffff).setDepth(24);
      scene.tweens.add({ targets: shard, x: sign.x + 60 + (index % 5) * 30, y: startY + (index - 6.5) * 14,
        angle: (index - 6.5) * 70, scale: 0.2, alpha: 0, duration: 600, ease: "Cubic.Out", onComplete: () => shard.destroy() });
    }
    // Stars pop out, then zip to the score in the HUD above.
    for (let index = 0; index < (milestone ? 12 : 6); index += 1) {
      const star = scene.add.star(sign.x, sign.y, 5, 4, milestone ? 12 : 9, 0xffd75e).setStrokeStyle(2, 0xfff8cb).setDepth(32);
      scene.tweens.add({ targets: star, x: sign.x + Math.cos(index * 2.4) * 70, y: sign.y + Math.sin(index * 2.4) * 50,
        angle: index * 40, duration: 230, ease: "Back.Out", onComplete: () => {
          scene.tweens.add({ targets: star, x: width / 2, y: -20, scale: 0.25, alpha: 0.2, delay: index * 25,
            duration: 380, ease: "Cubic.In", onComplete: () => star.destroy() });
        } });
    }
    this.banner(milestone ? `${combo} COMBO!` : CHEERS[(Math.max(combo, 1) - 1) % CHEERS.length]!, milestone ? "#ffdd78" : "#d4fff1");
    if (milestone) {
      this.kit.celebrate(width * 0.15, width * 0.85, height * 0.7, "");
      this.speedLines(14, tint);
    }
  }

  /** Wrong gate: the skater bursts into ice-glass shards. */
  shatter(x: number, y: number, color: number, self: boolean): void {
    const { scene } = this;
    this.kit.wrong(x, y);
    if (this.reducedMotion) return;
    if (self) {
      scene.cameras.main.shake(260, 0.008);
      this.flash(0xef4444, 0.3);
      this.banner("CRASH!", "#fecaca");
    }
    const pieces = self ? 32 : 16;
    for (let index = 0; index < pieces; index += 1) {
      const size = (8 + (index % 4) * 5) * (self ? 1.2 : 0.9);
      const fill = index % 4 === 0 ? 0xffffff : index % 4 === 1 ? 0xbae6fd : color;
      const shard = scene.add.triangle(x, y, 0, 0, size, size * 0.3, size * 0.4, size * 1.2, fill).setDepth(26);
      const angle = (index / pieces) * Math.PI * 2 + Math.sin(index * 7.3) * 0.4;
      const speed = 160 + (index % 5) * 55;
      const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed - 220;
      const spin = (index % 2 ? 1 : -1) * (360 + index * 40);
      scene.tweens.addCounter({
        from: 0, to: 1, duration: 950, ease: "Linear",
        onUpdate: (tween) => {
          const t = (tween.getValue() ?? 0) * 0.95;
          shard.setPosition(x + vx * t, y + vy * t + 0.5 * SHARD_GRAVITY * t * t).setAngle(spin * t).setAlpha(1 - t);
        },
        onComplete: () => shard.destroy(),
      });
    }
    const ring = scene.add.circle(x, y, 10, 0xffffff, 0.8).setDepth(25);
    scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 380, ease: "Cubic.Out", onComplete: () => ring.destroy() });
  }

  /** The skater pops back in, with a ring so the eye finds them. */
  respawn(x: number, y: number): void {
    this.kit.pickup(x, y);
    if (this.reducedMotion) return;
    const ring = this.scene.add.circle(x, y, 60).setStrokeStyle(5, 0x38bdf8).setDepth(25);
    this.scene.tweens.add({ targets: ring, scale: 0.2, alpha: 0, duration: 420, ease: "Cubic.In", onComplete: () => ring.destroy() });
  }

  item(x: number, y: number, kind: SkatingItemKind): void {
    const booster = kind === "booster";
    this.kit.pickup(x, y);
    this.kit.floatText(x, y - 30, booster ? "부스터!" : "속도 +10%", booster ? "#c2410c" : "#15803d", 26);
    if (this.reducedMotion) return;
    this.flash(booster ? 0xfb923c : 0x4ade80, 0.28);
    const ring = this.scene.add.circle(x, y, 20).setStrokeStyle(6, booster ? 0xf97316 : 0x22c55e).setDepth(25);
    this.scene.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 520, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    if (booster) {
      this.scene.cameras.main.shake(200, 0.004);
      this.speedLines(18, 0xfb923c);
    }
  }

  punch(x: number, y: number, hit: boolean): void {
    if (hit) this.kit.punchHit(x, y, false);
  }

  bump(x: number, y: number): void {
    this.kit.landingDust(x, y);
  }

  /** Called every few frames while boosting: streaks race past and the skater leaves an afterimage. */
  boostTrail(x: number, y: number, texture: string, scale: number): void {
    if (this.reducedMotion) return;
    this.kit.sparkle(x - 14, y);
    this.speedLines(1, 0xfdba74);
    const ghost = this.scene.add.image(x, y, texture).setOrigin(0.5, 1).setDisplaySize(34 * scale, 38 * scale)
      .setTint(0xffb36b).setAlpha(0.45).setDepth(15);
    this.scene.tweens.add({ targets: ghost, x: x - 50, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
  }

  private speedLines(count: number, color: number): void {
    const { width, height } = this.scene.scale;
    for (let index = 0; index < count; index += 1) {
      const y = Phaser.Math.Between(10, Math.max(11, height - 10));
      const line = this.scene.add.rectangle(width + 40, y, Phaser.Math.Between(60, 160), 2 + (index % 3), color, 0.7).setDepth(8);
      this.scene.tweens.add({ targets: line, x: -200, duration: Phaser.Math.Between(220, 380), onComplete: () => line.destroy() });
    }
  }

  private flash(color: number, alpha: number): void {
    const { width, height } = this.scene.scale;
    const veil = this.scene.add.rectangle(0, 0, width, height, color, alpha).setOrigin(0).setDepth(45);
    this.scene.tweens.add({ targets: veil, alpha: 0, duration: 260, onComplete: () => veil.destroy() });
  }

  private banner(text: string, color: string): void {
    const { width, height } = this.scene.scale;
    const label = this.scene.add.text(width / 2, height * 0.32, text, {
      fontFamily: FONT_FAMILY, fontSize: `${Math.min(46, width / 9)}px`, fontStyle: "500",
      color, stroke: "#0f172a", strokeThickness: 7, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5).setDepth(50).setScale(0.2).setAngle(-8);
    this.scene.tweens.add({ targets: label, scale: 1.15, angle: 3, duration: 220, ease: "Back.Out" });
    this.scene.tweens.add({ targets: label, y: height * 0.25, alpha: 0, scale: 0.9, delay: 560, duration: 240,
      onComplete: () => label.destroy() });
  }
}
