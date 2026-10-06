import { nearestSkatingLane, skatingGateIndexAtX, type SkatingLane } from "../model.ts";
import {
  applySkatingItem,
  canCollectItem,
  isBoosting,
  NO_BUFFS,
  skatingForwardSpeed,
  skatingItemsBetween,
  type SkatingBuffs,
  type SkatingItem,
} from "./items.ts";
import { stepLateral, type SkatingSteer } from "./physics.ts";

export const SKATING_RESPAWN_MS = 3_000;

export interface SkaterSnapshot {
  readonly x: number;
  readonly y: number;
  /** Forward speed (world units/s); 0 while crashed or paused. */
  readonly vx: number;
  readonly vy: number;
  readonly buffs: SkatingBuffs;
  readonly boosting: boolean;
  /** Set while the skater lies shattered; the time they come back. */
  readonly respawnAtMs: number | null;
}

export type SkaterEvent =
  | { readonly type: "gate"; readonly gateIndex: number; readonly lane: SkatingLane }
  | { readonly type: "item"; readonly item: SkatingItem }
  | { readonly type: "bump" }
  | { readonly type: "respawn" };

/**
 * The local skater's rules, free of React and Phaser: forward motion with
 * item buffs, slippery steering, gate crossings, item pickups and the
 * crash/respawn timer. Answer checking stays with the caller.
 */
export class SkaterSimulation {
  private x: number;
  private y = 0;
  private vy = 0;
  private vx = 0;
  private buffs: SkatingBuffs = NO_BUFFS;
  private respawnAtMs: number | null = null;
  private readonly collected = new Set<number>();
  private readonly seed: string;

  constructor(seed: string, startX: number) {
    this.seed = seed;
    this.x = startX;
  }

  step(nowMs: number, seconds: number, steer: SkatingSteer, paused: boolean): SkaterEvent[] {
    const events: SkaterEvent[] = [];
    if (this.respawnAtMs !== null) {
      if (nowMs < this.respawnAtMs) return events;
      this.respawnAtMs = null;
      this.y = 0;
      events.push({ type: "respawn" });
    }
    if (paused) {
      this.vx = 0;
      return events;
    }

    const lateral = stepLateral({ y: this.y, vy: this.vy }, steer, seconds);
    if (lateral.bumped) events.push({ type: "bump" });
    this.vx = skatingForwardSpeed(this.buffs, nowMs);
    const fromX = this.x;
    const toX = fromX + this.vx * seconds;
    this.x = toX;
    this.y = lateral.y;
    this.vy = lateral.vy;

    for (const item of skatingItemsBetween(this.seed, fromX, toX)) {
      if (item.x <= fromX || this.collected.has(item.id) || !canCollectItem(item, this.y)) continue;
      this.collected.add(item.id);
      this.buffs = applySkatingItem(this.buffs, item.kind, nowMs);
      events.push({ type: "item", item });
    }
    const lane = nearestSkatingLane(this.y);
    for (let gate = skatingGateIndexAtX(fromX) + 1; gate <= skatingGateIndexAtX(toX); gate += 1) {
      events.push({ type: "gate", gateIndex: gate, lane });
    }
    return events;
  }

  /** A wrong gate: the skater shatters, loses the booster and returns to the centre lane after a short wait. */
  crash(nowMs: number): void {
    this.respawnAtMs = nowMs + SKATING_RESPAWN_MS;
    this.buffs = { ...this.buffs, boostUntilMs: 0 };
    this.vx = 0;
    this.vy = 0;
  }

  shove(sideSpeed: number): void {
    if (this.respawnAtMs === null) this.vy += sideSpeed;
  }

  hasCollected(itemId: number): boolean {
    return this.collected.has(itemId);
  }

  snapshot(nowMs: number): SkaterSnapshot {
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      buffs: this.buffs,
      boosting: isBoosting(this.buffs, nowMs),
      respawnAtMs: this.respawnAtMs,
    };
  }
}
