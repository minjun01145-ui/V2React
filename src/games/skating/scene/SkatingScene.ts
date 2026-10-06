import Phaser from "phaser";
import { ensureSharedTextures, playerColor } from "../../../game-engine/phaser-kit/art.ts";
import type { LiveRemoteFrame } from "../../../live-world/core/types.ts";
import type { SkatingFx, SkatingFxEvent } from "../fx.ts";
import type { SkatingCourse } from "../model.ts";
import { BOOSTER_MULTIPLIER } from "../sim/items.ts";
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

const BOOST_TRAIL_MS = 45;
/** Remote skaters faster than this are drawn with booster flames. */
const REMOTE_BOOST_SPEED = SKATING_BASE_SPEED * (1 + BOOSTER_MULTIPLIER) / 2;

export class SkatingScene extends Phaser.Scene {
  private rink!: RinkView;
  private sprites!: SkaterSprites;
  private effects!: SkatingEffects;
  private pending: SkatingFxEvent[] = [];
  private readonly crashedUntil = new Map<string, number>();
  private speedFactor = 1;
  private lastTrailAt = 0;
  private readonly read: () => SkatingSceneSource;

  constructor(read: () => SkatingSceneSource) {
    super("skating");
    this.read = read;
  }

  create(): void {
    ensureSharedTextures(this);
    this.rink = new RinkView(this);
    this.sprites = new SkaterSprites(this);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.effects = new SkatingEffects(this, calm);
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
      boosting: snapshot?.boosting ?? false,
    });
    this.sprites.sync(this.frames(source, snapshot, time), layout, time, delta);

    const events = this.pending;
    this.pending = [];
    for (const event of events) this.play(event, layout, source, time);

    if (!self || !snapshot || snapshot.respawnAtMs !== null) return;
    this.effects.wind(this.speedFactor, snapshot.boosting, delta);
    const position = this.sprites.position(self.id);
    if (snapshot.boosting && position && time - this.lastTrailAt > BOOST_TRAIL_MS) {
      this.lastTrailAt = time;
      this.effects.boostTrail({ x: position.x, y: position.feetY }, this.sprites.bodyTexture(self.id), position.scale);
    }
  }

  /** The student camera follows their skater and zooms out with speed; the teacher camera fits everyone. */
  private layout(source: SkatingSceneSource, snapshot: SkaterSnapshot | null, delta: number): RinkLayout {
    const { width, height } = this.scale;
    if (snapshot) {
      const target = Math.max(snapshot.respawnAtMs === null ? 1 : 0, snapshot.vx / SKATING_BASE_SPEED);
      this.speedFactor += (target - this.speedFactor) * Math.min(1, delta / 350);
      return createRinkLayout({ width, height, cameraX: snapshot.x, anchor: 0.24, pixelsPerUnit: skaterPixelsPerUnit(width, this.speedFactor) });
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
        hidden: time < (this.crashedUntil.get(remote.playerId) ?? 0), boosting: remote.vx > REMOTE_BOOST_SPEED });
    }
    if (source.self && snapshot) {
      frames.push({ id: source.self.id, label: `▶ ${source.self.label}`, x: snapshot.x, y: snapshot.y, vx: snapshot.vx, vy: snapshot.vy,
        self: true, hidden: snapshot.respawnAtMs !== null, boosting: snapshot.boosting });
    }
    return frames;
  }

  private play(event: SkatingFxEvent, layout: RinkLayout, source: SkatingSceneSource, time: number): void {
    const selfId = source.self?.id ?? null;
    const selfPosition = selfId ? this.sprites.position(selfId) : null;
    switch (event.type) {
      case "gate":
        if (!event.correct) return;
        this.effects.gateBurst(RinkView.sign(layout, event.gateIndex, event.lane), LANE_COLORS[event.lane], event.combo, event.points, selfPosition);
        if (selfId) this.sprites.actor(selfId)?.hop(time, event.combo > 0 && event.combo % 5 === 0);
        return;
      case "crash": {
        if (event.playerId !== selfId) this.crashedUntil.set(event.playerId, time + SKATING_RESPAWN_MS);
        const position = this.sprites.position(event.playerId);
        if (position) this.effects.shatter(position, playerColor(event.playerId), event.playerId === selfId);
        return;
      }
      case "respawn":
        this.sprites.blink(event.playerId, time);
        if (selfPosition) this.effects.respawn(selfPosition);
        return;
      case "item":
        if (selfPosition) this.effects.item(selfPosition, event.kind);
        if (selfId) this.sprites.actor(selfId)?.hop(time, false);
        return;
      case "punch": {
        this.sprites.actor(event.attackerId)?.lunge(time, event.direction);
        if (event.targetId) this.sprites.actor(event.targetId)?.spin(time, event.direction);
        this.effects.punch(this.sprites.position(event.attackerId), event.targetId ? this.sprites.position(event.targetId) : null,
          event.direction, event.attackerId === selfId || event.targetId === selfId);
        return;
      }
      case "bump":
        if (selfPosition) this.effects.bump({ x: selfPosition.x, y: selfPosition.feetY });
        return;
      case "tick":
        return;
    }
  }
}
