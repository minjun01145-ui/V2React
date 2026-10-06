import { activeTimedBuffs, type TimedBuffDefinitions } from "../timed-buffs/model.ts";

/**
 * Power-up rules shared by the party platformers. Each game decides where and
 * when items appear (deterministically, so every client agrees); pickups are
 * first-come claims, and buffs are derived from those claims.
 */

export type PartyItemKind = "speed" | "jump" | "punch" | "dash" | "star";

/** Items every party platformer drops; "dash" and "star" are lobby jump tower extras. */
export const PARTY_ITEM_KINDS: readonly PartyItemKind[] = ["speed", "jump", "punch"];
export const BUFF_DURATION_MS = 30_000;
/** Items float this far above the surface they rest on. */
export const ITEM_HOVER = 26;

export const BUFF_EFFECT = {
  speed: { runMultiplier: 2 },
  jump: { jumpMultiplier: 1.32 },
  punch: { powered: true },
  /** The second jump becomes a straight-up rocket. */
  dash: { doubleJumpVelocity: -1_080 },
  /** Touching the glowing player is a punch, at most twice a second per victim. */
  star: { hitIntervalMs: 500 },
} as const;

export const ITEM_LABEL: Readonly<Record<PartyItemKind, string>> = {
  speed: "이동속도 2배",
  jump: "슈퍼 점프",
  punch: "펀치 강화",
  dash: "2단 점프 강화",
  star: "무적 밀치기",
};

export const ITEM_STYLE: Readonly<Record<PartyItemKind, { readonly color: number; readonly icon: string }>> = {
  speed: { color: 0xf59e0b, icon: "⚡" },
  jump: { color: 0x22c55e, icon: "⤒" },
  punch: { color: 0xef4444, icon: "✊" },
  dash: { color: 0x0ea5e9, icon: "🚀" },
  star: { color: 0xeab308, icon: "★" },
};

export const PARTY_BUFF_DEFINITIONS: TimedBuffDefinitions<PartyItemKind> = {
  speed: { label: ITEM_LABEL.speed, icon: ITEM_STYLE.speed.icon, durationMs: BUFF_DURATION_MS, color: "linear-gradient(135deg, #f59e0b, #f97316)" },
  jump: { label: ITEM_LABEL.jump, icon: ITEM_STYLE.jump.icon, durationMs: BUFF_DURATION_MS, color: "linear-gradient(135deg, #22c55e, #16a34a)" },
  punch: { label: ITEM_LABEL.punch, icon: ITEM_STYLE.punch.icon, durationMs: BUFF_DURATION_MS, color: "linear-gradient(135deg, #ef4444, #dc2626)" },
  dash: { label: ITEM_LABEL.dash, icon: ITEM_STYLE.dash.icon, durationMs: BUFF_DURATION_MS, color: "linear-gradient(135deg, #38bdf8, #0284c7)" },
  star: { label: ITEM_LABEL.star, icon: ITEM_STYLE.star.icon, durationMs: BUFF_DURATION_MS, color: "linear-gradient(135deg, #facc15, #f472b6, #a78bfa)" },
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
  const pickups = claims.flatMap((claim) => {
    const kind = claim.by === playerId ? kindOf(claim.id) : null;
    return kind ? [{ kind, atMs: claim.atMs }] : [];
  });
  return new Map(activeTimedBuffs(pickups, () => BUFF_DURATION_MS, nowMs).map((buff) => [buff.kind, buff.endsAtLocalMs]));
}
