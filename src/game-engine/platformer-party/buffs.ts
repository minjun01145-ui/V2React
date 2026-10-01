/**
 * Power-up rules shared by the party platformers. Each game decides where and
 * when items appear (deterministically, so every client agrees); pickups are
 * first-come claims, and buffs are derived from those claims.
 */

export type PartyItemKind = "speed" | "jump" | "punch";

export const PARTY_ITEM_KINDS: readonly PartyItemKind[] = ["speed", "jump", "punch"];
export const BUFF_DURATION_MS = 30_000;
/** Items float this far above the surface they rest on. */
export const ITEM_HOVER = 26;

export const BUFF_EFFECT = {
  speed: { runMultiplier: 2 },
  jump: { jumpMultiplier: 1.32 },
  punch: { powered: true },
} as const;

export const ITEM_LABEL: Readonly<Record<PartyItemKind, string>> = {
  speed: "이동속도 2배",
  jump: "슈퍼 점프",
  punch: "펀치 강화",
};

export const ITEM_STYLE: Readonly<Record<PartyItemKind, { readonly color: number; readonly icon: string }>> = {
  speed: { color: 0xf59e0b, icon: "⚡" },
  jump: { color: 0x22c55e, icon: "⤒" },
  punch: { color: 0xef4444, icon: "✊" },
};

export interface PartyItem {
  readonly id: string;
  readonly kind: PartyItemKind;
  /** Centre of the item. */
  readonly x: number;
  readonly y: number;
}

export interface ActiveBuff {
  readonly kind: PartyItemKind;
  /** End time on this device's clock (Date.now), ready for UI countdowns. */
  readonly endsAtLocalMs: number;
}

export interface ItemClaim {
  readonly id: string;
  readonly by: string;
  readonly atMs: number;
}

/** Active buffs for one player: kind -> end time. Re-picking a kind restarts its timer. */
export function activePartyBuffs(
  claims: readonly ItemClaim[],
  playerId: string,
  kindOf: (id: string) => PartyItemKind | null,
  nowMs: number,
): Map<PartyItemKind, number> {
  const buffs = new Map<PartyItemKind, number>();
  for (const claim of claims) {
    if (claim.by !== playerId) continue;
    const kind = kindOf(claim.id);
    const endsAt = claim.atMs + BUFF_DURATION_MS;
    if (!kind || endsAt <= nowMs) continue;
    buffs.set(kind, Math.max(buffs.get(kind) ?? 0, endsAt));
  }
  return buffs;
}
