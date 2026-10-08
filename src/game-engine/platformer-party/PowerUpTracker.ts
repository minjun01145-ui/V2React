import { activePartyBuffs, permanentPartyItemCount, type ItemClaim, type PartyItem, type PartyItemKind, type PermanentPartyItemKind } from "./buffs.ts";

/** How a game exposes its deterministic item schedule. */
export interface PartyItemSource {
  /** Items that exist at `nowMs`, claimed or not. */
  itemsAt(nowMs: number): readonly PartyItem[];
  /** Kind of an item id (also for items no longer on the field). */
  kindOf(id: string): PartyItemKind | null;
}

/** Claims seen so far plus the pickups this client is still waiting on. */
export class PowerUpTracker {
  private source: PartyItemSource;
  private readonly claims: ItemClaim[] = [];
  private readonly claimed = new Set<string>();
  private readonly pending = new Set<string>();
  private readonly kinds = new Map<string, PartyItemKind | null>();

  constructor(source: PartyItemSource) {
    this.source = source;
  }

  /** Swap the schedule (e.g. the tower changed size); cached kinds are recomputed. */
  setSource(source: PartyItemSource): void {
    this.source = source;
    this.kinds.clear();
  }

  addClaim(claim: ItemClaim): void {
    if (this.claimed.has(claim.id)) return;
    this.claimed.add(claim.id);
    this.pending.delete(claim.id);
    this.claims.push(claim);
  }

  /** Items still up for grabs at `nowMs`. */
  available(nowMs: number): PartyItem[] {
    return this.source.itemsAt(nowMs).filter((item) => !this.claimed.has(item.id) && !this.pending.has(item.id));
  }

  /** Marks an item as being claimed; false if it is already taken or in flight. */
  beginClaim(id: string): boolean {
    if (this.claimed.has(id) || this.pending.has(id)) return false;
    this.pending.add(id);
    return true;
  }

  /** A lost or failed claim; if someone else won, their claim keeps the item hidden. */
  releaseClaim(id: string): void {
    this.pending.delete(id);
  }

  buffs(playerId: string, nowMs: number): ReadonlyMap<PartyItemKind, number> {
    return activePartyBuffs(this.claims, playerId, (id) => this.kindOf(id), nowMs);
  }

  permanentCount(playerId: string, kind: PermanentPartyItemKind): number {
    return permanentPartyItemCount(this.claims, playerId, (id) => this.kindOf(id), kind);
  }

  kindOf(id: string): PartyItemKind | null {
    if (!this.kinds.has(id)) this.kinds.set(id, this.source.kindOf(id));
    return this.kinds.get(id) ?? null;
  }
}
