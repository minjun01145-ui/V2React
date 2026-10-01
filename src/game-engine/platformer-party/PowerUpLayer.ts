import type Phaser from "phaser";
import type { Effects } from "../phaser-kit/Effects.ts";
import type { ActiveBuff, ItemClaim, PartyItemKind } from "./buffs.ts";
import { ItemsView } from "./ItemsView.ts";
import { PowerUpTracker, type PartyItemSource } from "./PowerUpTracker.ts";

export interface PowerUpLayerOptions {
  readonly source: PartyItemSource;
  readonly localPlayerId?: string;
  readonly nowMs: () => number;
  readonly claimItem?: (id: string) => Promise<boolean>;
  readonly onBuffsChange?: (buffs: readonly ActiveBuff[]) => void;
}

const TRAIL_INTERVAL_MS = 70;

/** Field items, pickups and buffs for a party platformer scene. */
export class PowerUpLayer {
  private readonly options: PowerUpLayerOptions;
  private readonly effects: Effects;
  private readonly view: ItemsView;
  private readonly tracker: PowerUpTracker;
  private localBuffs = new Map<PartyItemKind, number>();
  private buffsKey = "";
  private readonly lastTrailAt = new Map<string, number>();

  constructor(scene: Phaser.Scene, effects: Effects, options: PowerUpLayerOptions) {
    this.options = options;
    this.effects = effects;
    this.view = new ItemsView(scene);
    this.tracker = new PowerUpTracker(options.source);
  }

  setSource(source: PartyItemSource): void {
    this.tracker.setSource(source);
  }

  receiveClaim(claim: ItemClaim): void {
    this.tracker.addClaim(claim);
  }

  has(kind: PartyItemKind): boolean {
    return (this.localBuffs.get(kind) ?? 0) > this.options.nowMs();
  }

  /** `local` is the local player's body centre, or null when it cannot pick things up. */
  update(time: number, local: { readonly x: number; readonly y: number } | null): void {
    const nowMs = this.options.nowMs();
    this.view.update(this.tracker.available(nowMs), time);
    if (local) this.tryPickup(local.x, local.y);
    this.refreshLocalBuffs(nowMs);
  }

  /** Little stars behind anyone running with the speed buff. */
  trail(playerId: string, x: number, feetY: number, vx: number, time: number): void {
    if (Math.abs(vx) < 60) return;
    if ((this.lastTrailAt.get(playerId) ?? -Infinity) > time - TRAIL_INTERVAL_MS) return;
    const nowMs = this.options.nowMs();
    const speedUntil = playerId === this.options.localPlayerId
      ? this.localBuffs.get("speed") ?? 0
      : this.tracker.buffs(playerId, nowMs).get("speed") ?? 0;
    if (speedUntil <= nowMs) return;
    this.lastTrailAt.set(playerId, time);
    this.effects.sparkle(x, feetY);
  }

  private tryPickup(x: number, y: number): void {
    const item = this.view.itemNear(x, y);
    const claimItem = this.options.claimItem;
    if (!item || !claimItem || !this.tracker.beginClaim(item.id)) return;
    this.effects.pickup(item.x, item.y);
    void claimItem(item.id).then((won) => {
      if (!won) this.tracker.releaseClaim(item.id);
    });
  }

  private refreshLocalBuffs(nowMs: number): void {
    const playerId = this.options.localPlayerId;
    if (!playerId) return;
    this.localBuffs = this.tracker.buffs(playerId, nowMs);
    const key = [...this.localBuffs].map(([kind, until]) => `${kind}:${until}`).sort().join("|");
    if (key === this.buffsKey) return;
    this.buffsKey = key;
    const offset = Date.now() - nowMs;
    this.options.onBuffsChange?.([...this.localBuffs].map(([kind, until]) => ({ kind, endsAtLocalMs: until + offset })));
  }
}
