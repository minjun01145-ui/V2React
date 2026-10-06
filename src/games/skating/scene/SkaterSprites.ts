import Phaser from "phaser";
import { BlobActor } from "../../../game-engine/phaser-kit/BlobActor.ts";
import { ensureBodyTexture, playerColor } from "../../../game-engine/phaser-kit/art.ts";
import type { RinkLayout } from "./rinkLayout.ts";

export interface SkaterFrame {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Forward speed; 0 means standing still. */
  readonly vx: number;
  /** Sideways velocity; leans the skater into the slide. */
  readonly vy: number;
  readonly self: boolean;
  readonly hidden: boolean;
}

interface TrailPoint {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

const TRAIL_MS = 750;
const TRAIL_SAMPLE_MS = 45;
const BLINK_MS = 1_000;

/** Skaters on screen: one blob each, with blade marks left on the ice. */
export class SkaterSprites {
  private readonly actors = new Map<string, BlobActor>();
  private readonly trails = new Map<string, TrailPoint[]>();
  private readonly blinkUntil = new Map<string, number>();
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly positions = new Map<string, { readonly x: number; readonly y: number; readonly scale: number }>();

  constructor(private readonly scene: Phaser.Scene) {
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
    const sizeScale = Phaser.Math.Clamp(layout.laneHeight / 72, 0.75, 1.5);
    const marks = this.marks.clear();
    for (const frame of frames) {
      let actor = this.actors.get(frame.id);
      if (!actor) {
        actor = new BlobActor(this.scene, frame.id, frame.self);
        this.actors.set(frame.id, actor);
      }
      const x = layout.screenX(frame.x);
      const laneY = layout.screenY(frame.y);
      const feetY = laneY + layout.laneHeight * 0.24;
      const scale = sizeScale * (frame.self ? 1.15 : 1);
      this.positions.set(frame.id, { x, y: feetY - 20 * scale, scale });
      this.drawTrail(frame, layout, time, marks);
      const onScreen = x > -80 && x < layout.width + 80;
      actor.container.setVisible(!frame.hidden && onScreen);
      if (frame.hidden || !onScreen) continue;
      // A slow stride reads as skating strokes; gliding still faces forward.
      actor.update({ x, feetY, vx: frame.vx > 0 ? 45 : 0, vy: 0 }, time, delta);
      const blinking = time < (this.blinkUntil.get(frame.id) ?? 0) && Math.floor(time / 90) % 2 === 0;
      actor.container
        .setScale(scale)
        .setAngle(Phaser.Math.Clamp(frame.vy * 5, -12, 12))
        .setAlpha(blinking ? 0.25 : frame.self ? 1 : 0.8)
        .setDepth((frame.self ? 22 : 18) + laneY / 10_000);
      actor.setTag(frame.label);
      // Names stay readable at one size however big the skaters are drawn.
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
    if (frame.hidden) trail.length = 0;
    else if (frame.vx > 0 && (!last || time - last.at >= TRAIL_SAMPLE_MS)) trail.push({ x: frame.x, y: frame.y, at: time });
    while (trail.length > 0 && time - trail[0]!.at > TRAIL_MS) trail.shift();
    const offset = layout.laneHeight * 0.24;
    for (let index = 1; index < trail.length; index += 1) {
      const from = trail[index - 1]!, to = trail[index]!;
      const alpha = (1 - (time - to.at) / TRAIL_MS) * (frame.self ? 0.55 : 0.3);
      marks.lineStyle(2, 0x7aa7cf, alpha);
      for (const blade of [-4, 4]) {
        marks.lineBetween(layout.screenX(from.x), layout.screenY(from.y) + offset + blade,
          layout.screenX(to.x), layout.screenY(to.y) + offset + blade);
      }
    }
  }

  /** Body centre on screen, for effects; null when the skater is not drawn. */
  position(id: string): { readonly x: number; readonly y: number; readonly scale: number } | null {
    return this.positions.get(id) ?? null;
  }

  actor(id: string): BlobActor | null {
    return this.actors.get(id) ?? null;
  }

  bodyTexture(id: string): string {
    return ensureBodyTexture(this.scene, playerColor(id));
  }

  blink(id: string, time: number): void {
    this.blinkUntil.set(id, time + BLINK_MS);
  }
}
