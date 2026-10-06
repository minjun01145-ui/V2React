import Phaser from "phaser";
import { FONT_FAMILY, TEXT_METRICS_SAMPLE, TEXT_RESOLUTION, ensureBodyTexture, playerColor, shade } from "./art.ts";

const BODY_WIDTH = 34;
const BODY_HEIGHT = 38;
const LANDING_SPEED = 260;
const PUNCH_MS = 200;
const RECOIL_MS = 320;
export const BLOB_TAG_Y = -54;

export interface BlobPose {
  /** Feet position in world coordinates. */
  readonly x: number;
  readonly feetY: number;
  readonly vx: number;
  readonly vy: number;
  readonly alpha?: number;
  /** Surface under the character; the shadow stays there while airborne. */
  readonly groundY?: number;
}

export function compactLabel(value: string, max: number): string {
  const normalized = value.trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

/**
 * A procedurally animated blob character shared by the Phaser games. It only
 * needs position and velocity, so local motion and interpolated remote frames
 * animate identically. Games decide what the name tag says and where it sits.
 */
export class BlobActor {
  readonly container: Phaser.GameObjects.Container;
  readonly tag: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Image;
  private readonly feet: readonly [Phaser.GameObjects.Ellipse, Phaser.GameObjects.Ellipse];
  private readonly eyes: readonly [Phaser.GameObjects.Ellipse, Phaser.GameObjects.Ellipse];
  private readonly pupils: readonly [Phaser.GameObjects.Arc, Phaser.GameObjects.Arc];
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly fist: Phaser.GameObjects.Arc;
  private readonly halo: Phaser.GameObjects.Ellipse;
  private glowing = false;
  private punchStartedAt = -Infinity;
  private recoilStartedAt = -Infinity;
  private recoilDirection = 1;
  private stride = 0;
  private facing = 1;
  private squashUntil = 0;
  private previousVy = 0;
  private scaleX = 1;
  private scaleY = 1;

  constructor(scene: Phaser.Scene, playerId: string, self: boolean) {
    const color = playerColor(playerId);
    this.shadow = scene.add.ellipse(0, 0, 34, 8, 0x0f172a, 0.18);
    const footColor = shade(color, -0.4);
    this.feet = [
      scene.add.ellipse(-8, -3, 13, 8, footColor),
      scene.add.ellipse(8, -3, 13, 8, footColor),
    ];
    this.body = scene.add.image(0, -4, ensureBodyTexture(scene, color))
      .setOrigin(0.5, 1)
      .setDisplaySize(BODY_WIDTH, BODY_HEIGHT);
    this.eyes = [
      scene.add.ellipse(-7, -30, 10, 12, 0xffffff),
      scene.add.ellipse(7, -30, 10, 12, 0xffffff),
    ];
    this.pupils = [
      scene.add.circle(-6, -29, 3, 0x111827),
      scene.add.circle(8, -29, 3, 0x111827),
    ];
    this.halo = scene.add.ellipse(0, -22, 58, 60, 0xfde047, 0.45).setVisible(false);
    this.fist = scene.add.circle(0, -18, 7, shade(color, -0.25)).setStrokeStyle(2, shade(color, -0.6)).setVisible(false);
    this.tag = scene.add.text(0, BLOB_TAG_Y, "", {
      fontFamily: FONT_FAMILY,
      fontSize: self ? "13px" : "10px",
      fontStyle: "300",
      // Remote names are tinted with their body colour so a tag is easy to match to its runner.
      color: self ? "#7c2d12" : `#${shade(color, -0.55).toString(16).padStart(6, "0")}`,
      backgroundColor: self ? "#fef3c7" : "rgba(255,255,255,.88)",
      padding: { x: self ? 6 : 4, y: 2 },
      testString: TEXT_METRICS_SAMPLE,
    }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
    this.container = scene.add.container(0, 0, [
      this.shadow,
      this.halo,
      ...this.feet,
      this.body,
      ...this.eyes,
      ...this.pupils,
      this.fist,
      this.tag,
    ]).setDepth(self ? 22 : 18);
  }

  get facingDirection(): number {
    return this.facing;
  }

  /**
   * Instant "got hit" reaction, pushed in `direction`. Remote positions arrive a
   * few hundred ms late, so this shows the hit on the attacker's screen at once.
   */
  recoil(time: number, direction: number): void {
    this.recoilStartedAt = time;
    this.recoilDirection = direction < 0 ? -1 : 1;
    this.flash(0xffffff);
  }

  /** Quick jab in `direction` (−1 left, 1 right). */
  punch(time: number, direction: number): void {
    this.punchStartedAt = time;
    this.facing = direction < 0 ? -1 : 1;
  }

  setTag(text: string): void {
    if (this.tag.text !== text) this.tag.setText(text);
  }

  /** Short squash impulse, e.g. crouching before a scripted jump. */
  squash(time: number, durationMs = 110): void {
    this.squashUntil = time + durationMs;
  }

  /** Returns true on the frame the character lands hard, so the scene can kick up dust. */
  update(pose: BlobPose, time: number, delta: number): boolean {
    // A short jolt backwards (returns to 0) plus a lean; the real knockback follows via positions.
    const recoilAge = (time - this.recoilStartedAt) / RECOIL_MS;
    const recoil = recoilAge >= 0 && recoilAge < 1 ? Math.sin(Math.PI * recoilAge) : 0;
    const recoilLean = recoilAge >= 0 && recoilAge < 1 ? this.recoilDirection * 0.55 * (1 - recoilAge) : 0;
    this.container.setPosition(Math.round(pose.x + this.recoilDirection * recoil * 22), Math.round(pose.feetY - recoil * 10));
    this.container.setAlpha(pose.alpha ?? 1);

    const grounded = Math.abs(pose.vy) < 30;
    const landed = this.previousVy > LANDING_SPEED && grounded;
    this.previousVy = pose.vy;
    if (landed) this.squashUntil = time + 110;
    const punchAge = time - this.punchStartedAt;
    const punching = punchAge >= 0 && punchAge < PUNCH_MS;
    if (Math.abs(pose.vx) > 20 && !punching) this.facing = Math.sign(pose.vx);
    if (punching) {
      const reach = Math.sin(Math.PI * punchAge / PUNCH_MS);
      this.fist.setVisible(true).setPosition(this.facing * (14 + reach * 22), -18 - reach * 2).setScale(0.8 + reach * 0.4);
    } else if (this.fist.visible) {
      this.fist.setVisible(false);
    }

    const running = grounded && Math.abs(pose.vx) > 30;
    if (running) this.stride += delta * Math.min(Math.abs(pose.vx), 320) * 0.00005;
    const swing = Math.sin(this.stride);

    let targetX = 1;
    let targetY = 1 + Math.sin(time / 320) * 0.025;
    if (time < this.squashUntil) {
      targetX = 1.18;
      targetY = 0.8;
    } else if (!grounded) {
      targetX = pose.vy < 0 ? 0.9 : 0.96;
      targetY = pose.vy < 0 ? 1.12 : 1.05;
    }
    const blend = Math.min(1, delta / 60);
    this.scaleX += (targetX - this.scaleX) * blend;
    this.scaleY += (targetY - this.scaleY) * blend;
    this.body.setDisplaySize(BODY_WIDTH * this.scaleX, BODY_HEIGHT * this.scaleY);
    this.body.setY(-4 - (running ? Math.abs(swing) * 3 : 0));
    this.body.setRotation(Phaser.Math.Clamp(pose.vx / 2600, -0.12, 0.12) + recoilLean);

    const [leftFoot, rightFoot] = this.feet;
    if (running) {
      leftFoot.setPosition(-8 + swing * 5, -3 - Math.max(0, swing) * 4);
      rightFoot.setPosition(8 - swing * 5, -3 - Math.max(0, -swing) * 4);
    } else if (!grounded) {
      leftFoot.setPosition(-7, -6);
      rightFoot.setPosition(7, -6);
    } else {
      leftFoot.setPosition(-8, -3);
      rightFoot.setPosition(8, -3);
    }

    // Eyes ride along with the squash/stretch and look where the character is heading.
    const eyeY = -30 - BODY_HEIGHT * (this.scaleY - 1) * 0.7 - (running ? Math.abs(swing) * 3 : 0);
    const lookY = Phaser.Math.Clamp(pose.vy / 400, -1.5, 1.5);
    const [leftEye, rightEye] = this.eyes;
    const [leftPupil, rightPupil] = this.pupils;
    leftEye.setPosition(-7 + this.facing * 1.5, eyeY);
    rightEye.setPosition(7 + this.facing * 1.5, eyeY);
    leftPupil.setPosition(-7 + this.facing * 3, eyeY + 1 + lookY);
    rightPupil.setPosition(7 + this.facing * 3, eyeY + 1 + lookY);

    const height = pose.groundY === undefined ? 0 : Math.max(0, pose.groundY - pose.feetY);
    this.shadow.setY(height);
    this.shadow.setScale(grounded ? 1 : Math.max(0.45, 0.8 - height / 300), 1).setAlpha(grounded ? 0.18 : 0.1);
    return landed;
  }

  /** Super-star look: a pulsing halo and rainbow body while `active`. */
  setStarGlow(active: boolean, time: number): void {
    if (!active) {
      if (this.glowing) {
        this.glowing = false;
        this.halo.setVisible(false);
        this.body.clearTint();
      }
      return;
    }
    this.glowing = true;
    const color = Phaser.Display.Color.HSLToColor((time / 600) % 1, 1, 0.75).color;
    this.body.setTint(color);
    this.halo.setVisible(true).setFillStyle(color, 0.35 + Math.sin(time / 90) * 0.15).setScale(1 + Math.sin(time / 120) * 0.08);
  }

  flash(color: number): void {
    this.body.setTint(color);
    this.body.scene.time.delayedCall(260, () => this.body.clearTint());
  }

  destroy(): void {
    this.container.destroy();
  }
}
