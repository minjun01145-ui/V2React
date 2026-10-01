import {
  chunkLineUpActiveBuffs,
  chunkLineUpItemKind,
  chunkLineUpItemsAt,
  type ChunkLineUpItem,
  type ChunkLineUpItemKind,
  type ItemClaim,
} from "./items.ts";

/** Claims seen so far plus the pickups this client is still waiting on. */
export class ChunkLineUpPowerUps {
  private readonly roundId: string;
  private readonly claims: ItemClaim[] = [];
  private readonly claimed = new Set<string>();
  private readonly pending = new Set<string>();
  private readonly kinds = new Map<string, ChunkLineUpItemKind | null>();
  private floorCount = 0;

  constructor(roundId: string) {
    this.roundId = roundId;
  }

  setFloorCount(floorCount: number): void {
    if (floorCount === this.floorCount) return;
    this.floorCount = floorCount;
    this.kinds.clear();
  }

  addClaim(claim: ItemClaim): void {
    if (this.claimed.has(claim.id)) return;
    this.claimed.add(claim.id);
    this.pending.delete(claim.id);
    this.claims.push(claim);
  }

  /** Items still up for grabs at `nowMs`. */
  available(nowMs: number): ChunkLineUpItem[] {
    return chunkLineUpItemsAt(this.roundId, this.floorCount, nowMs)
      .filter((item) => !this.claimed.has(item.id) && !this.pending.has(item.id));
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

  buffs(playerId: string, nowMs: number): Map<ChunkLineUpItemKind, number> {
    return chunkLineUpActiveBuffs(this.claims, playerId, (id) => this.kindOf(id), nowMs);
  }

  kindOf(id: string): ChunkLineUpItemKind | null {
    if (!this.kinds.has(id)) this.kinds.set(id, chunkLineUpItemKind(this.roundId, this.floorCount, id));
    return this.kinds.get(id) ?? null;
  }
}
