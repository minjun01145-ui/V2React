import Phaser from "phaser";
import { Effects } from "../../../game-engine/phaser-kit/Effects.ts";
import { FONT_FAMILY, TEXT_RESOLUTION, TEXTURE } from "../../../game-engine/phaser-kit/art.ts";
import type { SkatingItemKind } from "../sim/items.ts";
import type { GateSign } from "./RinkView.ts";

const CHEERS = ["NICE!", "GREAT!", "SUPER!", "AWESOME!", "AMAZING!"] as const;
const SHARD_GRAVITY = 900;

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The game's big moments: gate explosions, crashes, item pickups, punches,
 * and the wind and flames that make speed visible. Everything is
 * fire-and-forget and cleans itself up. `calm` (reduced motion) only drops
 * camera shake, zoom kicks and full-screen flashes; the feedback itself stays.
 */
export class SkatingEffects {
  private readonly kit: Effects;
  private readonly scene: Phaser.Scene;
  private readonly calm: boolean;
  private readonly flames: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly burst: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, calm: boolean) {
    this.scene = scene;
    this.calm = calm;
    this.kit = new Effects(scene);
    this.flames = scene.add.particles(0, 0, TEXTURE.dot, {
      emitting: false,
      speed: { min: 60, max: 160 },
      angle: { min: 165, max: 195 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xfde047, 0xfb923c, 0xef4444],
      lifespan: 320,
    }).setDepth(16);
    this.burst = scene.add.particles(0, 0, TEXTURE.dot, {
      emitting: false,
      speed: { min: 220, max: 520 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      lifespan: 520,
      tint: [0xffffff, 0xfde047, 0x7dd3fc],
    }).setDepth(33);
  }

  /** Correct gate: the sign explodes, the camera kicks, stars and score fly. */
  gateBurst(sign: GateSign, color: number, combo: number, points: number, skater: Point | null): void {
    const { scene } = this;
    const { width, height } = scene.scale;
    const milestone = combo > 0 && combo % 5 === 0;
    const tint = milestone ? 0xffd56a : color;
    this.kick(milestone ? 1.12 : 1.07, milestone ? 220 : 130, milestone ? 0.008 : 0.005);
    this.flash(0xffffff, milestone ? 0.5 : 0.32);

    // Bang: radial particles, starburst rays and shockwaves out of the sign.
    this.burst.setParticleTint(tint);
    this.burst.explode(milestone ? 70 : 42, sign.x, sign.y);
    this.kit.pickup(sign.x, sign.y);
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = (ray / 12) * Math.PI * 2;
      const beam = scene.add.rectangle(sign.x, sign.y, 120, ray % 2 ? 6 : 12, ray % 2 ? 0xffffff : tint, 0.95)
        .setOrigin(0, 0.5).setRotation(angle).setDepth(31).setScale(0.1, 1);
      scene.tweens.add({ targets: beam, scaleX: milestone ? 2.6 : 1.8, alpha: 0, duration: 380, ease: "Cubic.Out", onComplete: () => beam.destroy() });
    }
    for (let ring = 0; ring < (milestone ? 4 : 3); ring += 1) {
      const circle = scene.add.circle(sign.x, sign.y, 18).setStrokeStyle(ring ? 4 : 10, ring % 2 ? tint : 0xffffff).setDepth(32);
      scene.tweens.add({ targets: circle, scale: milestone ? 12 : 8, alpha: 0, delay: ring * 60, duration: 520, ease: "Cubic.Out",
        onComplete: () => circle.destroy() });
    }
    // Light rushes down the lane ahead.
    const beam = scene.add.rectangle(sign.x, sign.y, width, sign.height * 1.4, tint, 0.45).setOrigin(0, 0.5).setDepth(5);
    scene.tweens.add({ targets: beam, scaleY: 0.05, alpha: 0, duration: 500, ease: "Cubic.Out", onComplete: () => beam.destroy() });
    // The sign itself breaks into big pieces.
    for (let index = 0; index < 16; index += 1) {
      const startY = sign.y + (index / 15 - 0.5) * sign.height;
      const shard = scene.add.rectangle(sign.x + (index % 3 - 1) * sign.width * 0.3, startY, index % 2 ? 16 : 28, sign.height / 5,
        index % 3 ? tint : 0xffffff).setDepth(30);
      scene.tweens.add({ targets: shard, x: shard.x + 80 + (index % 5) * 45, y: startY + (index - 7.5) * 22,
        angle: (index - 7.5) * 80, scale: 0.15, alpha: 0, duration: 700, ease: "Cubic.Out", onComplete: () => shard.destroy() });
    }
    // Stars pop out, then zip up to the score.
    for (let index = 0; index < (milestone ? 14 : 8); index += 1) {
      const star = scene.add.star(sign.x, sign.y, 5, 5, milestone ? 14 : 11, 0xffd75e).setStrokeStyle(2, 0xfff8cb).setDepth(34);
      scene.tweens.add({ targets: star, x: sign.x + Math.cos(index * 2.4) * 90, y: sign.y + Math.sin(index * 2.4) * 70,
        angle: index * 40, duration: 240, ease: "Back.Out", onComplete: () => {
          scene.tweens.add({ targets: star, x: width * 0.5, y: -20, scale: 0.3, alpha: 0.3, delay: index * 22,
            duration: 380, ease: "Cubic.In", onComplete: () => star.destroy() });
        } });
    }
    const anchor = skater ?? sign;
    this.popText(anchor.x, anchor.y - 50, `+${points}`, "#fde047", 40);
    if (combo >= 2) this.popText(anchor.x + 10, anchor.y - 92, `${combo} COMBO`, "#7dd3fc", 24, 90);
    this.banner(milestone ? `${combo} COMBO!!` : CHEERS[(Math.max(combo, 1) - 1) % CHEERS.length]!, milestone ? "#ffdd78" : "#d9fff4", milestone ? 64 : 52);
    if (milestone) this.kit.celebrate(width * 0.1, width * 0.9, height * 0.75, "");
  }

  /** Wrong gate: the skater bursts into ice-glass shards. */
  shatter(at: Point, color: number, self: boolean): void {
    const { scene } = this;
    this.kit.wrong(at.x, at.y);
    if (self) {
      this.kick(0.94, 320, 0.012);
      this.flash(0xef4444, 0.4);
      this.banner("CRASH!", "#fecaca", 60);
    }
    const pieces = self ? 36 : 18;
    for (let index = 0; index < pieces; index += 1) {
      const size = (9 + (index % 4) * 5) * (self ? 1.3 : 0.9);
      const fill = index % 4 === 0 ? 0xffffff : index % 4 === 1 ? 0xbae6fd : color;
      const shard = scene.add.triangle(at.x, at.y, 0, 0, size, size * 0.3, size * 0.4, size * 1.2, fill).setDepth(26);
      const angle = (index / pieces) * Math.PI * 2 + Math.sin(index * 7.3) * 0.4;
      const speed = 180 + (index % 5) * 70;
      const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed - 260;
      const spin = (index % 2 ? 1 : -1) * (420 + index * 40);
      scene.tweens.addCounter({
        from: 0, to: 1, duration: 1_000,
        onUpdate: (tween) => {
          const t = (tween.getValue() ?? 0) * 1.0;
          shard.setPosition(at.x + vx * t, at.y + vy * t + 0.5 * SHARD_GRAVITY * t * t).setAngle(spin * t).setAlpha(1 - t);
        },
        onComplete: () => shard.destroy(),
      });
    }
    const ring = scene.add.circle(at.x, at.y, 12, 0xffffff, 0.9).setDepth(25);
    scene.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 400, ease: "Cubic.Out", onComplete: () => ring.destroy() });
  }

  respawn(at: Point): void {
    this.kit.pickup(at.x, at.y);
    const ring = this.scene.add.circle(at.x, at.y, 70).setStrokeStyle(6, 0x38bdf8).setDepth(25);
    this.scene.tweens.add({ targets: ring, scale: 0.2, alpha: 0, duration: 420, ease: "Cubic.In", onComplete: () => ring.destroy() });
  }

  item(at: Point, kind: SkatingItemKind): void {
    const booster = kind === "booster";
    const color = booster ? 0xf97316 : 0x22c55e;
    this.burst.setParticleTint(color);
    this.burst.explode(40, at.x, at.y);
    this.flash(color, 0.35);
    for (let ring = 0; ring < 3; ring += 1) {
      const circle = this.scene.add.circle(at.x, at.y, 20).setStrokeStyle(8 - ring * 2, ring === 1 ? 0xffffff : color).setDepth(32);
      this.scene.tweens.add({ targets: circle, scale: 10, alpha: 0, delay: ring * 80, duration: 560, ease: "Cubic.Out",
        onComplete: () => circle.destroy() });
    }
    if (booster) {
      this.kick(0.88, 260, 0.007);
      this.banner("BOOST!!", "#fdba74", 72);
      this.speedLines(40, 0xfb923c, 6);
    } else {
      this.kick(1.06, 160, 0.004);
      this.banner("SPEED UP!", "#86efac", 58);
      this.popText(at.x, at.y - 60, "+10%", "#4ade80", 34);
      // Chevrons shoot forward from the skater.
      for (let index = 0; index < 6; index += 1) {
        const chevron = this.scene.add.text(at.x, at.y + (index - 2.5) * 14, "»", {
          fontFamily: FONT_FAMILY, fontSize: "40px", fontStyle: "700", color: "#22c55e", stroke: "#ffffff", strokeThickness: 5,
        }).setOrigin(0.5).setDepth(33);
        this.scene.tweens.add({ targets: chevron, x: at.x + 260 + index * 30, alpha: 0, delay: index * 30, duration: 420, ease: "Cubic.In",
          onComplete: () => chevron.destroy() });
      }
    }
  }

  /** A shoulder check: a whoosh arc from the attacker and, on contact, a comic POW on the target. */
  punch(attacker: Point | null, target: Point | null, direction: -1 | 1, selfInvolved: boolean): void {
    const { scene } = this;
    if (attacker) {
      const arc = scene.add.graphics().setDepth(29);
      arc.lineStyle(9, 0xffffff, 0.95);
      arc.beginPath();
      arc.arc(attacker.x, attacker.y + direction * 10, 42, direction > 0 ? Math.PI * 0.15 : Math.PI * 1.15, direction > 0 ? Math.PI * 0.85 : Math.PI * 1.85);
      arc.strokePath();
      scene.tweens.add({ targets: arc, alpha: 0, duration: 240, onComplete: () => arc.destroy() });
    }
    if (!target) return;
    const pow = scene.add.star(target.x, target.y, 12, 22, 46, 0xfde047).setStrokeStyle(5, 0xdc2626).setDepth(35).setScale(0.2);
    const label = scene.add.text(target.x, target.y, "POW!", {
      fontFamily: FONT_FAMILY, fontSize: "30px", fontStyle: "700", color: "#dc2626", stroke: "#ffffff", strokeThickness: 6,
      resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5).setDepth(36).setScale(0.2).setAngle(-12);
    scene.tweens.add({ targets: [pow, label], scale: 1.1, duration: 140, ease: "Back.Out" });
    scene.tweens.add({ targets: [pow, label], alpha: 0, scale: 1.4, delay: 320, duration: 200, onComplete: () => { pow.destroy(); label.destroy(); } });
    this.burst.setParticleTint(0xfde047);
    this.burst.explode(22, target.x, target.y);
    if (selfInvolved) this.kick(1.04, 140, 0.007);
  }

  bump(at: Point): void {
    this.kit.landingDust(at.x, at.y);
    this.burst.setParticleTint(0xe0f2fe);
    this.burst.explode(8, at.x, at.y);
  }

  /** Every frame: streaks rushing past, more and longer the faster the skater goes. */
  wind(speedFactor: number, boosting: boolean, delta: number): void {
    const expected = (delta / 1_000) * (boosting ? 55 : Math.max(0, speedFactor - 0.6) * 14);
    let count = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
    while (count-- > 0) this.speedLines(1, boosting ? 0xfb923c : 0xbfdbfe, boosting ? 5 : 3, boosting ? 1.8 : speedFactor);
  }

  /** Booster flames and afterimages behind the skater. */
  boostTrail(feet: Point, texture: string, scale: number): void {
    this.flames.explode(3, feet.x - 14 * scale, feet.y - 10 * scale);
    const ghost = this.scene.add.image(feet.x, feet.y - 5 * scale, texture).setOrigin(0.5, 1).setDisplaySize(34 * scale, 38 * scale)
      .setTint(0xff9d4d).setAlpha(0.5).setDepth(15);
    this.scene.tweens.add({ targets: ghost, x: feet.x - 70, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
  }

  private speedLines(count: number, color: number, thickness: number, speed = 1.5): void {
    const { width, height } = this.scene.scale;
    for (let index = 0; index < count; index += 1) {
      const y = Phaser.Math.Between(10, Math.max(11, height - 10));
      const line = this.scene.add.rectangle(width + 40, y, Phaser.Math.Between(80, 200) * Math.min(speed, 2.5) / 1.5, thickness, color, 0.75)
        .setOrigin(0, 0.5).setDepth(8);
      this.scene.tweens.add({ targets: line, x: -260, duration: Phaser.Math.Between(260, 420) / Math.min(Math.max(speed, 1), 2.5),
        onComplete: () => line.destroy() });
    }
  }

  /** Camera zoom kick and shake; skipped for reduced motion. */
  private kick(zoom: number, duration: number, shake: number): void {
    if (this.calm) return;
    const camera = this.scene.cameras.main;
    camera.shake(duration, shake);
    camera.setZoom(zoom);
    this.scene.tweens.add({ targets: camera, zoom: 1, duration: duration + 120, ease: "Cubic.Out" });
  }

  private flash(color: number, alpha: number): void {
    if (this.calm) return;
    const { width, height } = this.scene.scale;
    const veil = this.scene.add.rectangle(0, 0, width, height, color, alpha).setOrigin(0).setDepth(45).setScrollFactor(0);
    this.scene.tweens.add({ targets: veil, alpha: 0, duration: 280, onComplete: () => veil.destroy() });
  }

  private popText(x: number, y: number, text: string, color: string, size: number, delay = 0): void {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: FONT_FAMILY, fontSize: `${size}px`, fontStyle: "700", color, stroke: "#0f172a", strokeThickness: 6,
      resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5).setDepth(40).setScale(0.2);
    this.scene.tweens.add({ targets: label, scale: 1.25, delay, duration: 160, ease: "Back.Out" });
    this.scene.tweens.add({ targets: label, y: y - 40, alpha: 0, scale: 1, delay: delay + 520, duration: 320, onComplete: () => label.destroy() });
  }

  private banner(text: string, color: string, size: number): void {
    const { width, height } = this.scene.scale;
    const label = this.scene.add.text(width / 2, height * 0.42, text, {
      fontFamily: FONT_FAMILY, fontSize: `${Math.min(size, width / 7)}px`, fontStyle: "700",
      color, stroke: "#0f172a", strokeThickness: 9, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5).setDepth(50).setScale(0.1).setAngle(-10);
    this.scene.tweens.add({ targets: label, scale: 1.2, angle: 4, duration: 200, ease: "Back.Out" });
    this.scene.tweens.add({ targets: label, scale: 1, angle: 0, delay: 200, duration: 140 });
    this.scene.tweens.add({ targets: label, y: height * 0.3, alpha: 0, delay: 650, duration: 260, onComplete: () => label.destroy() });
  }
}
