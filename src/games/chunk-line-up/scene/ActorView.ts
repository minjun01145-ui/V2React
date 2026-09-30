import Phaser from "phaser";
import type { LiveMovementState } from "../../../live-world/core/types.ts";
import { CHUNK_LINE_UP_PLAYER_HEIGHT } from "../layout.ts";
import { FONT_FAMILY, TEXT_RESOLUTION, ensureBodyTexture, playerColor, shade } from "./art.ts";

const BODY_WIDTH = 34;
const BODY_HEIGHT = 38;
const LANDING_SPEED = 260;

function compact(value: string, max: number): string {
  const normalized = value.trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

/**
 * A procedurally animated blob character. It only needs position and velocity,
 * so local physics bodies and interpolated remote frames animate identically.
 */
export class ActorView {
  readonly container: Phaser.GameObjects.Container;
  private readonly self: boolean;
  private readonly body: Phaser.GameObjects.Image;
  private readonly feet: readonly [Phaser.GameObjects.Ellipse, Phaser.GameObjects.Ellipse];
  private readonly eyes: readonly [Phaser.GameObjects.Ellipse, Phaser.GameObjects.Ellipse];
  private readonly pupils: readonly [Phaser.GameObjects.Arc, Phaser.GameObjects.Arc];
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly tag: Phaser.GameObjects.Text;
  private stride = 0;
  private facing = 1;
  private squashUntil = 0;
  private previousVy = 0;
  private scaleX = 1;
  private scaleY = 1;

  constructor(scene: Phaser.Scene, playerId: string, self: boolean) {
    this.self = self;
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
    // One compact tag per character: floors are only a jump apart, so stacked
    // name + chunk labels would cover the shelf above.
    this.tag = scene.add.text(0, -54, "", {
      fontFamily: FONT_FAMILY,
      fontSize: self ? "13px" : "10px",
      fontStyle: "bold",
      color: self ? "#7c2d12" : "#1e293b",
      backgroundColor: self ? "#fef3c7" : "rgba(255,255,255,.85)",
      padding: { x: self ? 6 : 4, y: 2 },
    }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
    this.container = scene.add.container(0, 0, [
      this.shadow,
      ...this.feet,
      this.body,
      ...this.eyes,
      ...this.pupils,
      this.tag,
    ]).setDepth(self ? 22 : 18);
  }

  setTag(label: string, token: string | undefined): void {
    const chunk = compact(token ?? "", this.self ? 26 : 14);
    const name = compact(label, 8);
    const next = this.self
      ? `▼ ${chunk || "나"}`
      : chunk ? `${name} · ${chunk}` : name;
    if (this.tag.text !== next) this.tag.setText(next);
  }

  /** Returns true on the frame the character lands hard, so the scene can kick up dust. */
  update(state: LiveMovementState, time: number, delta: number, inside: boolean): boolean {
    this.container.setPosition(Math.round(state.x), Math.round(state.y + CHUNK_LINE_UP_PLAYER_HEIGHT / 2));
    this.container.setAlpha(inside ? 0.35 : 1);

    const grounded = Math.abs(state.vy) < 30;
    const landed = this.previousVy > LANDING_SPEED && grounded;
    this.previousVy = state.vy;
    if (landed) this.squashUntil = time + 110;
    if (Math.abs(state.vx) > 20) this.facing = Math.sign(state.vx);

    const running = grounded && Math.abs(state.vx) > 30;
    if (running) this.stride += delta * Math.min(Math.abs(state.vx), 320) * 0.00005;
    const swing = Math.sin(this.stride);

    let targetX = 1;
    let targetY = 1 + Math.sin(time / 320) * 0.025;
    if (time < this.squashUntil) {
      targetX = 1.18;
      targetY = 0.8;
    } else if (!grounded) {
      targetX = state.vy < 0 ? 0.9 : 0.96;
      targetY = state.vy < 0 ? 1.12 : 1.05;
    }
    const blend = Math.min(1, delta / 60);
    this.scaleX += (targetX - this.scaleX) * blend;
    this.scaleY += (targetY - this.scaleY) * blend;
    this.body.setDisplaySize(BODY_WIDTH * this.scaleX, BODY_HEIGHT * this.scaleY);
    this.body.setY(-4 - (running ? Math.abs(swing) * 3 : 0));
    this.body.setRotation(Phaser.Math.Clamp(state.vx / 2600, -0.12, 0.12));

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
    const lookY = Phaser.Math.Clamp(state.vy / 400, -1.5, 1.5);
    const [leftEye, rightEye] = this.eyes;
    const [leftPupil, rightPupil] = this.pupils;
    leftEye.setPosition(-7 + this.facing * 1.5, eyeY);
    rightEye.setPosition(7 + this.facing * 1.5, eyeY);
    leftPupil.setPosition(-7 + this.facing * 3, eyeY + 1 + lookY);
    rightPupil.setPosition(7 + this.facing * 3, eyeY + 1 + lookY);
    this.shadow.setScale(grounded ? 1 : 0.7, 1).setAlpha(grounded ? 0.18 : 0.08);
    return landed;
  }

  flash(color: number): void {
    this.body.setTint(color);
    this.body.scene.time.delayedCall(260, () => this.body.clearTint());
  }

  destroy(): void {
    this.container.destroy();
  }
}
