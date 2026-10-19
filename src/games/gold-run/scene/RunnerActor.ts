import Phaser from "phaser";
import { playerColor, shade } from "../../../game-engine/phaser-kit/art.ts";
import { PALETTE } from "./palette.ts";

/*
 * The player's blob seen from behind, as it runs into the screen: the same body colour as in the
 * other games, no face, and a sack of gold on its back. Drawn as vectors at a reference size and
 * scaled to the perspective, so it stays crisp at any screen size.
 */

/** Reference body height in px; the container is scaled from this. */
const REFERENCE_HEIGHT = 92;

export interface RunnerPose {
  readonly x: number;
  readonly feetY: number;
  /** Ground under the runner; the shadow stays there during a jump. */
  readonly groundY: number;
  /** Screen px per reference px. */
  readonly scale: number;
  /** Strides per second; 0 stands still. */
  readonly cadence: number;
  /** -1…1, leans into lane changes. */
  readonly lean: number;
  readonly airborne: boolean;
  readonly stumbling: boolean;
  readonly down: boolean;
}

export class RunnerActor {
  private readonly root: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly feet: readonly [Phaser.GameObjects.Ellipse, Phaser.GameObjects.Ellipse];
  private readonly torso: Phaser.GameObjects.Container;
  private phase = 0;
  private landSquash = 0;
  private wasAirborne = false;

  constructor(scene: Phaser.Scene, playerId: string) {
    const color = playerColor(playerId);
    this.shadow = scene.add.ellipse(0, 0, 70, 16, PALETTE.shadow, 0.3);
    const footColor = shade(color, -0.45);
    this.feet = [scene.add.ellipse(-17, -7, 26, 17, footColor), scene.add.ellipse(17, -7, 26, 17, footColor)];

    const body = scene.add.graphics();
    body.fillStyle(shade(color, -0.45), 1).fillRoundedRect(-36, -REFERENCE_HEIGHT, 72, REFERENCE_HEIGHT - 8, 32);
    body.fillStyle(color, 1).fillRoundedRect(-33, -REFERENCE_HEIGHT + 2, 66, REFERENCE_HEIGHT - 13, 30);
    body.fillStyle(shade(color, 0.35), 0.55).fillEllipse(16, -REFERENCE_HEIGHT + 20, 22, 14);
    // Straps over the shoulders, then the sack and its knot.
    body.lineStyle(5, 0x6b4423, 1)
      .lineBetween(-20, -REFERENCE_HEIGHT + 16, -9, -54)
      .lineBetween(20, -REFERENCE_HEIGHT + 16, 9, -54);
    body.fillStyle(0x7a5130, 1).fillEllipse(0, -34, 50, 42);
    body.fillStyle(0x9c6a3e, 1).fillEllipse(-3, -36, 42, 36);
    body.fillStyle(PALETTE.gold, 1).fillCircle(-7, -54, 6).fillCircle(5, -56, 5);
    body.fillStyle(PALETTE.goldLight, 1).fillCircle(-8, -56, 2);
    body.fillStyle(0x6b4423, 1).fillEllipse(0, -51, 20, 8);
    this.torso = scene.add.container(0, 0, [body]);

    this.root = scene.add.container(0, 0, [...this.feet, this.torso]);
  }

  setDepth(depth: number): void {
    this.shadow.setDepth(depth - 1);
    this.root.setDepth(depth);
  }

  update(pose: RunnerPose, deltaSeconds: number): void {
    this.phase += deltaSeconds * pose.cadence * Math.PI * 2;
    if (this.wasAirborne && !pose.airborne) this.landSquash = 1;
    this.wasAirborne = pose.airborne;
    this.landSquash = Math.max(0, this.landSquash - deltaSeconds * 5);

    this.shadow.setPosition(pose.x, pose.groundY).setScale(pose.scale * (pose.airborne ? 0.75 : 1));
    this.root.setPosition(pose.x, pose.feetY).setScale(pose.scale);

    const stride = Math.sin(this.phase);
    const running = pose.cadence > 0 && !pose.airborne && !pose.down;
    // Feet pump up and down alternately; in the air they tuck together.
    this.feet[0].setY(-7 - (running ? Math.max(0, stride) * 12 : pose.airborne ? 8 : 0));
    this.feet[1].setY(-7 - (running ? Math.max(0, -stride) * 12 : pose.airborne ? 8 : 0));
    const bob = running ? Math.abs(stride) * 5 : 0;
    const squash = this.landSquash * 0.16 + (running ? Math.abs(stride) * 0.03 : 0);
    this.torso.setPosition(0, -bob).setScale(1 + squash, pose.airborne ? 1.08 : 1 - squash);
    this.root.setRotation(pose.down ? 1.25 * Math.sign(pose.lean || 1) : pose.lean * 0.18 + (running ? stride * 0.035 : 0));
    this.root.setAlpha(pose.stumbling ? (Math.floor(this.phase * 2) % 2 === 0 ? 0.35 : 1) : 1);
  }
}
