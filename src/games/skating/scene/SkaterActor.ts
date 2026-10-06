import Phaser from "phaser";
import { hashString } from "../../../game-engine/core/random.ts";
import { FONT_FAMILY, TEXT_METRICS_SAMPLE, TEXT_RESOLUTION, TEXTURE, ensureBodyTexture, playerColor, shade } from "../../../game-engine/phaser-kit/art.ts";

const BODY_WIDTH = 34;
const BODY_HEIGHT = 38;
const SCARF_COLORS = [0xef4444, 0xfacc15, 0x22d3ee, 0xffffff, 0x4ade80] as const;
const HOP_MS = 460;
const SPIN_MS = 700;
const LUNGE_MS = 260;
const DIZZY_MS = 1_000;
const TAG_Y = -62;

export interface SkaterPose {
  /** Feet position on screen. */
  readonly x: number;
  readonly y: number;
  /** Forward speed relative to the base speed; 0 while standing. */
  readonly speedFactor: number;
  /** Sideways velocity in world units/s; the eyes and lean follow it. */
  readonly side: number;
  readonly boosting: boolean;
}

/**
 * The representative blob character on skates. It strokes left and right
 * foot in turn (faster with speed), leans into the wind, trails a scarf, and
 * has short reactions: a hop for a correct gate, a lunge for a punch, a spin
 * when punched.
 */
export class SkaterActor {
  readonly container: Phaser.GameObjects.Container;
  readonly tag: Phaser.GameObjects.Text;
  private readonly torso: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly eyes: readonly [Phaser.GameObjects.Ellipse, Phaser.GameObjects.Ellipse];
  private readonly pupils: readonly [Phaser.GameObjects.Arc, Phaser.GameObjects.Arc];
  private readonly skates: readonly [Phaser.GameObjects.Container, Phaser.GameObjects.Container];
  private readonly scarf: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly dizzy: Phaser.GameObjects.Image[];
  private readonly scarfColor: number;
  private phase = 0;
  private hopAt = -Infinity;
  private hopFlip = false;
  private spinAt = -Infinity;
  private spinDirection = 1;
  private lungeAt = -Infinity;
  private lungeDirection = 1;
  private crouch = 0;

  constructor(scene: Phaser.Scene, playerId: string, self: boolean) {
    const color = playerColor(playerId);
    this.scarfColor = SCARF_COLORS[hashString(playerId) % SCARF_COLORS.length]!;
    this.shadow = scene.add.ellipse(0, 0, 40, 9, 0x0f172a, 0.2);
    const boot = shade(color, -0.45);
    const makeSkate = (): Phaser.GameObjects.Container => scene.add.container(0, 0, [
      scene.add.rectangle(0, 3, 18, 2.5, 0xcbd5e1),
      scene.add.rectangle(-6, 1.5, 1.5, 3, 0x94a3b8),
      scene.add.rectangle(6, 1.5, 1.5, 3, 0x94a3b8),
      scene.add.ellipse(1, -2, 15, 8, boot),
    ]);
    this.skates = [makeSkate(), makeSkate()];
    this.scarf = scene.add.graphics();
    this.body = scene.add.image(0, 0, ensureBodyTexture(scene, color)).setOrigin(0.5, 1).setDisplaySize(BODY_WIDTH, BODY_HEIGHT);
    this.eyes = [scene.add.ellipse(-6, -26, 10, 12, 0xffffff), scene.add.ellipse(8, -26, 10, 12, 0xffffff)];
    this.pupils = [scene.add.circle(-4, -25, 3, 0x111827), scene.add.circle(10, -25, 3, 0x111827)];
    // The torso pivots at the hips so leaning, hops and spins rotate body, face and scarf together.
    this.torso = scene.add.container(0, -5, [this.scarf, this.body, ...this.eyes, ...this.pupils]);
    this.dizzy = [0, 1, 2].map(() => scene.add.image(0, 0, TEXTURE.star).setTint(0xfde047).setScale(0.7).setVisible(false));
    this.tag = scene.add.text(0, TAG_Y, "", {
      fontFamily: FONT_FAMILY,
      fontSize: self ? "14px" : "11px",
      fontStyle: "500",
      color: self ? "#7c2d12" : `#${shade(color, -0.55).toString(16).padStart(6, "0")}`,
      backgroundColor: self ? "#fef3c7" : "rgba(255,255,255,.9)",
      padding: { x: self ? 6 : 4, y: 2 },
      testString: TEXT_METRICS_SAMPLE,
    }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
    this.container = scene.add.container(0, 0, [this.shadow, ...this.skates, this.torso, ...this.dizzy, this.tag]);
  }

  /** A happy hop after a correct gate; every fifth answer in a row adds a full flip. */
  hop(time: number, flip: boolean): void {
    this.hopAt = time;
    this.hopFlip = flip;
  }

  /** Shoulder-check towards `direction` (−1 up, 1 down on screen). */
  lunge(time: number, direction: -1 | 1): void {
    this.lungeAt = time;
    this.lungeDirection = direction;
  }

  /** Knocked: spin around with stars over the head. */
  spin(time: number, direction: -1 | 1): void {
    this.spinAt = time;
    this.spinDirection = direction;
    this.flash(0xffffff, 180);
  }

  flash(color: number, durationMs = 220): void {
    this.body.setTint(color);
    this.body.scene.time.delayedCall(durationMs, () => this.body.clearTint());
  }

  setTag(text: string): void {
    if (this.tag.text !== text) this.tag.setText(text);
  }

  update(pose: SkaterPose, time: number, delta: number): void {
    const moving = pose.speedFactor > 0.05;
    // Stroke rate rises with speed: about one push per foot per second at base, much quicker on a booster.
    if (moving) this.phase += (delta / 1_000) * Math.PI * 2 * (0.9 + 0.55 * pose.speedFactor);
    const blend = Math.min(1, delta / 120);
    this.crouch += ((pose.boosting ? 1 : 0) - this.crouch) * blend;

    const stroke = moving ? Math.sin(this.phase) : 0;
    const lungeAge = (time - this.lungeAt) / LUNGE_MS;
    const lunge = lungeAge >= 0 && lungeAge < 1 ? Math.sin(Math.PI * lungeAge) : 0;
    const hopAge = (time - this.hopAt) / HOP_MS;
    const hop = hopAge >= 0 && hopAge < 1 ? Math.sin(Math.PI * hopAge) : 0;
    const spinAge = (time - this.spinAt) / SPIN_MS;
    const spinning = spinAge >= 0 && spinAge < 1;

    this.container.setPosition(pose.x, pose.y + lunge * 26 * this.lungeDirection);

    // Feet: the pushing foot sweeps back and lifts, the other glides under the body.
    const reach = 7 + Math.min(pose.speedFactor, 2.5) * 3;
    const [left, right] = this.skates;
    const leftPush = Math.max(0, stroke), rightPush = Math.max(0, -stroke);
    const lift = hop * 20;
    left.setPosition(-5 - leftPush * reach, -1 - leftPush * 5 - lift).setAngle(-leftPush * 18);
    right.setPosition(7 - rightPush * reach, -1 - rightPush * 5 - lift).setAngle(-rightPush * 18);

    // Torso: lean forward with speed, rock with each stroke, bob, crouch on a booster.
    const lean = moving ? 0.1 + Math.min(pose.speedFactor - 1, 1.5) * 0.08 + this.crouch * 0.12 : 0;
    let rotation = lean + stroke * 0.08 + Phaser.Math.Clamp(pose.side * 0.05, -0.12, 0.12);
    if (spinning) rotation += this.spinDirection * Phaser.Math.Easing.Cubic.Out(spinAge) * Math.PI * 3;
    else if (this.hopFlip && hop > 0) rotation += Math.PI * 2 * hopAge;
    const bob = moving ? Math.abs(Math.cos(this.phase)) * 3 : Math.sin(time / 300) * 1;
    this.torso.setPosition(stroke * 2, -5 - bob - lift + this.crouch * 3).setRotation(rotation);
    this.body.setDisplaySize(BODY_WIDTH * (1 + this.crouch * 0.08 + lunge * 0.06), BODY_HEIGHT * (1 - this.crouch * 0.1 + lunge * 0.1));

    // Eyes look ahead and towards where the skater is sliding.
    const look = Phaser.Math.Clamp(pose.side * 0.9, -2.2, 2.2);
    this.pupils[0].setPosition(-4 + (moving ? 1 : 0), -25 + look);
    this.pupils[1].setPosition(10 + (moving ? 1 : 0), -25 + look);

    this.drawScarf(time, moving ? pose.speedFactor : 0);

    const dizzyAge = (time - this.spinAt) / DIZZY_MS;
    this.dizzy.forEach((star, index) => {
      const visible = dizzyAge >= 0 && dizzyAge < 1;
      star.setVisible(visible);
      if (!visible) return;
      const angle = time / 140 + (index * Math.PI * 2) / 3;
      star.setPosition(Math.cos(angle) * 16, -50 + Math.sin(angle) * 5).setAlpha(1 - dizzyAge);
    });

    this.shadow.setScale(1 - hop * 0.4, 1).setAlpha(0.2 - hop * 0.1);
  }

  /** A ribbon from the neck streaming backwards; longer and wavier the faster the skater goes. */
  private drawScarf(time: number, speedFactor: number): void {
    const g = this.scarf.clear();
    const length = 10 + Math.min(speedFactor, 3) * 9;
    const wave = 2 + Math.min(speedFactor, 3) * 1.2;
    const segments = 7;
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index <= segments; index += 1) {
      const t = index / segments;
      points.push(new Phaser.Math.Vector2(-8 - t * length, -16 + t * (4 - speedFactor * 2) + Math.sin(time / 70 - index * 0.9) * wave * t));
    }
    g.lineStyle(6, this.scarfColor, 1).strokePoints(points);
    g.fillStyle(this.scarfColor, 1).fillRoundedRect(-14, -19, 20, 6, 3);
  }

  destroy(): void {
    this.container.destroy();
  }
}
