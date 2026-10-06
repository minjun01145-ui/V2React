import Phaser from "phaser";
import { ensureSharedTextures, playerColor } from "../../../game-engine/phaser-kit/art.ts";
import type { LiveRemoteFrame } from "../../../live-world/core/types.ts";
import type { SkatingFx, SkatingFxEvent } from "../fx.ts";
import type { SkatingCourse } from "../model.ts";
import { SKATING_BASE_SPEED } from "../sim/physics.ts";
import { SKATING_RESPAWN_MS, type SkaterSnapshot } from "../sim/SkaterSimulation.ts";
import { RinkView } from "./RinkView.ts";
import { createRinkLayout, LANE_COLORS, skaterPixelsPerUnit, type RinkLayout } from "./rinkLayout.ts";
import { SkaterSprites, type SkaterFrame } from "./SkaterSprites.ts";
import { SkatingEffects } from "./SkatingEffects.ts";

/** Everything the scene reads each frame; supplied by the student or teacher view. */
export interface SkatingSceneSource {
  readonly course: SkatingCourse;
  /** Round seed; places the items. */
  readonly seed: string;
  readonly fx: SkatingFx;
  /** The local skater, or null for the teacher's broadcast view. */
  readonly self: {
    readonly id: string;
    readonly label: string;
    snapshot(): SkaterSnapshot;
    hasCollected(itemId: number): boolean;
  } | null;
  remotes(): readonly LiveRemoteFrame[];
  label(playerId: string): string | undefined;
}

const BOOST_TRAIL_MS = 55;

export class SkatingScene extends Phaser.Scene {
  private rink!: RinkView;
  private sprites!: SkaterSprites;
  private effects!: SkatingEffects;
  private pending: SkatingFxEvent[] = [];
  private readonly crashedUntil = new Map<string, number>();
  private speedFactor = 1;
  private lastTrailAt = 0;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private readonly read: () => SkatingSceneSource) {
    super("skating");
  }

  create(): void {
    ensureSharedTextures(this);
    this.rink = new RinkView(this);
    this.sprites = new SkaterSprites(this);
    this.effects = new SkatingEffects(this, this.reducedMotion);
    const unsubscribe = this.read().fx.subscribe((event) => this.pending.push(event));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }

  override update(time: number, delta: number): void {
    const source = this.read();
    const self = source.self;
    const snapshot = self?.snapshot() ?? null;
    const layout = this.layout(source, snapshot, delta);
    this.rink.draw({
      layout,
      course: source.course,
      seed: source.seed,
      time,
      hideGatesBefore: snapshot?.x ?? -Infinity,
      hideItem: (item) => self?.hasCollected(item.id) ?? false,
      showPrompts: !self,
      boosting: snapshot?.boosting ?? false,
    });
    this.sprites.sync(this.frames(source, snapshot, time), layout, time, this.reducedMotion ? 0 : delta);

    const events = this.pending;
    this.pending = [];
    for (const event of events) this.play(event, layout, source, time);

    if (self && snapshot?.boosting && snapshot.respawnAtMs === null && time - this.lastTrailAt > BOOST_TRAIL_MS) {
      this.lastTrailAt = time;
      const position = this.sprites.position(self.id);
      if (position) this.effects.boostTrail(position.x, position.y + 20 * position.scale, this.sprites.bodyTexture(self.id), position.scale);
    }
  }

  /** The student camera follows their skater and zooms out with speed; the teacher camera fits everyone. */
  private layout(source: SkatingSceneSource, snapshot: SkaterSnapshot | null, delta: number): RinkLayout {
    const { width, height } = this.scale;
    if (snapshot) {
      const target = Math.max(1, snapshot.vx / SKATING_BASE_SPEED);
      this.speedFactor += (target - this.speedFactor) * Math.min(1, delta / 400);
      return createRinkLayout({ width, height, cameraX: snapshot.x, anchor: 0.26, pixelsPerUnit: skaterPixelsPerUnit(width, this.speedFactor) });
    }
    const xs = source.remotes().map((frame) => frame.x);
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const spread = xs.length > 0 ? Math.max(...xs) - minX : 0;
    const pixelsPerUnit = Math.min(skaterPixelsPerUnit(width, 1), width * 0.78 / Math.max(spread, 6));
    return createRinkLayout({ width, height, cameraX: minX, anchor: 0.1, pixelsPerUnit });
  }

  private frames(source: SkatingSceneSource, snapshot: SkaterSnapshot | null, time: number): SkaterFrame[] {
    const frames: SkaterFrame[] = [];
    for (const remote of source.remotes()) {
      const label = source.label(remote.playerId);
      if (label === undefined) continue;
      frames.push({ id: remote.playerId, label, x: remote.x, y: remote.y, vx: remote.vx, vy: remote.vy, self: false,
        hidden: time < (this.crashedUntil.get(remote.playerId) ?? 0) });
    }
    if (source.self && snapshot) {
      frames.push({ id: source.self.id, label: `▶ ${source.self.label}`, x: snapshot.x, y: snapshot.y, vx: snapshot.vx, vy: snapshot.vy,
        self: true, hidden: snapshot.respawnAtMs !== null });
    }
    return frames;
  }

  private play(event: SkatingFxEvent, layout: RinkLayout, source: SkatingSceneSource, time: number): void {
    const selfId = source.self?.id ?? null;
    const selfPosition = selfId ? this.sprites.position(selfId) : null;
    switch (event.type) {
      case "gate":
        if (!event.correct) return;
        this.effects.gateBurst(RinkView.sign(layout, event.gateIndex, event.lane), LANE_COLORS[event.lane], event.combo, event.points);
        if (selfId) this.sprites.actor(selfId)?.squash(time, 160);
        return;
      case "crash": {
        if (event.playerId !== selfId) this.crashedUntil.set(event.playerId, time + SKATING_RESPAWN_MS);
        const position = this.sprites.position(event.playerId);
        if (position) this.effects.shatter(position.x, position.y, playerColor(event.playerId), event.playerId === selfId);
        return;
      }
      case "respawn":
        this.sprites.blink(event.playerId, time);
        if (selfPosition) this.effects.respawn(selfPosition.x, selfPosition.y);
        return;
      case "item":
        if (selfPosition) this.effects.item(selfPosition.x, selfPosition.y, event.kind);
        return;
      case "punch": {
        this.sprites.actor(event.attackerId)?.punchVertically(time, event.direction);
        const target = event.targetId ? this.sprites.position(event.targetId) : null;
        if (target) this.effects.punch(target.x, target.y, true);
        if (event.targetId !== null && event.targetId === selfId) {
          this.sprites.actor(selfId)?.flash(0xffd0d0);
          if (!this.reducedMotion) this.cameras.main.shake(120, 0.004);
        }
        return;
      }
      case "bump":
        if (selfPosition) this.effects.bump(selfPosition.x, selfPosition.y + 18 * selfPosition.scale);
        return;
      case "tick":
        return;
    }
  }
}
