import Phaser from "phaser";
import { ensureBodyTexture, playerColor } from "../../../game-engine/phaser-kit/art.ts";
import { SKATING_BASE_SPEED } from "../sim/physics.ts";
import type { RinkLayout } from "./rinkLayout.ts";
import { SkaterActor } from "./SkaterActor.ts";

export interface SkaterFrame {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Forward speed; 0 means standing still. */
  readonly vx: number;
  /** Sideways velocity. */
  readonly vy: number;
  readonly self: boolean;
  readonly hidden: boolean;
  readonly boosting: boolean;
}

export interface SkaterScreenPosition {
  /** Body centre. */
  readonly x: number;
  readonly y: number;
  readonly feetY: number;
  readonly scale: number;
}

interface TrailPoint {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

const TRAIL_MS = 900;
const TRAIL_SAMPLE_MS = 40;
const BLINK_MS = 1_000;

/** Skaters on screen: one actor each, with blade marks carved into the ice. */
export class SkaterSprites {
  private readonly actors = new Map<string, SkaterActor>();
  private readonly trails = new Map<string, TrailPoint[]>();
  private readonly blinkUntil = new Map<string, number>();
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly positions = new Map<string, SkaterScreenPosition>();
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.marks = scene.add.graphics().setDepth(3);
  }

  sync(frames: readonly SkaterFrame[], layout: RinkLayout, time: number, delta: number): void {
    const ids = new Set(frames.map((frame) => frame.id));
    for (const [id, actor] of this.actors) {
      if (ids.has(id)) continue;
      actor.destroy();
      this.actors.delete(id);
      this.trails.delete(id);
      this.positions.delete(id);
    }
    const sizeScale = Phaser.Math.Clamp(layout.laneHeight / 66, 0.8, 1.7);
    const marks = this.marks.clear();
    for (const frame of frames) {
      let actor = this.actors.get(frame.id);
      if (!actor) {
        actor = new SkaterActor(this.scene, frame.id, frame.self);
        this.actors.set(frame.id, actor);
      }
      const x = layout.screenX(frame.x);
      const feetY = layout.screenY(frame.y) + layout.laneHeight * 0.26;
      const scale = sizeScale * (frame.self ? 1.12 : 1);
      this.positions.set(frame.id, { x, y: feetY - 24 * scale, feetY, scale });
      this.drawTrail(frame, layout, time, marks);
      const onScreen = x > -90 && x < layout.width + 90;
      actor.container.setVisible(!frame.hidden && onScreen);
      if (frame.hidden || !onScreen) continue;
      actor.update({ x, y: feetY, speedFactor: Math.max(0, frame.vx) / SKATING_BASE_SPEED, side: frame.vy, boosting: frame.boosting },
        time, delta);
      const blinking = time < (this.blinkUntil.get(frame.id) ?? 0) && Math.floor(time / 90) % 2 === 0;
      actor.container.setScale(scale).setAlpha(blinking ? 0.25 : frame.self ? 1 : 0.85)
        .setDepth((frame.self ? 22 : 18) + feetY / 10_000);
      actor.setTag(frame.label);
      // Names stay one size however big the skaters are drawn.
      actor.tag.setScale(1 / scale);
    }
  }

  private drawTrail(frame: SkaterFrame, layout: RinkLayout, time: number, marks: Phaser.GameObjects.Graphics): void {
    let trail = this.trails.get(frame.id);
    if (!trail) {
      trail = [];
      this.trails.set(frame.id, trail);
    }
    const last = trail[trail.length - 1];
    if (frame.hidden || (last && time < last.at)) trail.length = 0;
    else if (frame.vx > 0 && (!last || time - last.at >= TRAIL_SAMPLE_MS)) trail.push({ x: frame.x, y: frame.y, at: time });
    while (trail.length > 0 && time - trail[0]!.at > TRAIL_MS) trail.shift();
    const offset = layout.laneHeight * 0.26;
    for (let index = 1; index < trail.length; index += 1) {
      const from = trail[index - 1]!, to = trail[index]!;
      const alpha = (1 - (time - to.at) / TRAIL_MS) * (frame.self ? 0.6 : 0.35);
      marks.lineStyle(frame.boosting ? 3 : 2, frame.boosting ? 0xfb923c : 0x7aa7cf, alpha);
      for (const blade of [-4, 4]) {
        marks.lineBetween(layout.screenX(from.x), layout.screenY(from.y) + offset + blade,
          layout.screenX(to.x), layout.screenY(to.y) + offset + blade);
      }
    }
  }

  position(id: string): SkaterScreenPosition | null {
    return this.positions.get(id) ?? null;
  }

  actor(id: string): SkaterActor | null {
    return this.actors.get(id) ?? null;
  }

  bodyTexture(id: string): string {
    return ensureBodyTexture(this.scene, playerColor(id));
  }

  blink(id: string, time: number): void {
    this.blinkUntil.set(id, time + BLINK_MS);
  }
}
