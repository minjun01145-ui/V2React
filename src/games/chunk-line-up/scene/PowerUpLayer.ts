import type Phaser from "phaser";
import type { Effects } from "../../../game-engine/phaser-kit/Effects.ts";
import type { ChunkLineUpItemKind, ItemClaim } from "../items.ts";
import { ChunkLineUpPowerUps } from "../powerUps.ts";
import { ItemsView } from "./ItemsView.ts";

export interface ActiveBuff {
  readonly kind: ChunkLineUpItemKind;
  /** End time on this device's clock (Date.now), ready for UI countdowns. */
  readonly endsAtLocalMs: number;
}

export interface PowerUpLayerOptions {
  readonly roundId: string;
  readonly localPlayerId?: string;
  readonly nowMs: () => number;
  readonly claimItem?: (id: string) => Promise<boolean>;
  readonly onBuffsChange?: (buffs: readonly ActiveBuff[]) => void;
}

const TRAIL_INTERVAL_MS = 70;

/** Field items, pickups and buffs for the scene; rules live in ../items.ts. */
export class PowerUpLayer {
  private readonly options: PowerUpLayerOptions;
  private readonly effects: Effects;
  private readonly view: ItemsView;
  private readonly state: ChunkLineUpPowerUps;
  private localBuffs = new Map<ChunkLineUpItemKind, number>();
  private buffsKey = "";
  private readonly lastTrailAt = new Map<string, number>();

  constructor(scene: Phaser.Scene, effects: Effects, options: PowerUpLayerOptions) {
    this.options = options;
    this.effects = effects;
    this.view = new ItemsView(scene);
    this.state = new ChunkLineUpPowerUps(options.roundId);
  }

  setFloorCount(floorCount: number): void {
    this.state.setFloorCount(floorCount);
  }

  receiveClaim(claim: ItemClaim): void {
    this.state.addClaim(claim);
  }

  has(kind: ChunkLineUpItemKind): boolean {
    return (this.localBuffs.get(kind) ?? 0) > this.options.nowMs();
  }

  /** `local` is the local player's body centre, or null when it cannot pick things up (riding, teacher). */
  update(time: number, local: { readonly x: number; readonly y: number } | null): void {
    const nowMs = this.options.nowMs();
    this.view.update(this.state.available(nowMs), time);
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
      : this.state.buffs(playerId, nowMs).get("speed") ?? 0;
    if (speedUntil <= nowMs) return;
    this.lastTrailAt.set(playerId, time);
    this.effects.sparkle(x, feetY);
  }

  private tryPickup(x: number, y: number): void {
    const item = this.view.itemNear(x, y);
    const claimItem = this.options.claimItem;
    if (!item || !claimItem || !this.state.beginClaim(item.id)) return;
    this.effects.pickup(item.x, item.y);
    void claimItem(item.id).then((won) => {
      if (!won) this.state.releaseClaim(item.id);
    });
  }

  private refreshLocalBuffs(nowMs: number): void {
    const playerId = this.options.localPlayerId;
    if (!playerId) return;
    this.localBuffs = this.state.buffs(playerId, nowMs);
    const key = [...this.localBuffs].map(([kind, until]) => `${kind}:${until}`).sort().join("|");
    if (key === this.buffsKey) return;
    this.buffsKey = key;
    const offset = Date.now() - nowMs;
    this.options.onBuffsChange?.([...this.localBuffs].map(([kind, until]) => ({ kind, endsAtLocalMs: until + offset })));
  }
}
