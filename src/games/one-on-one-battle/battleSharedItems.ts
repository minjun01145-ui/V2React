import type { SharedGameItemEffects } from "../../items/gameRules.ts";
import type { BattlePhase, BattleRole } from "../../multiplayer/battle/types.ts";

export interface BattleSharedItemEffect {
  readonly kind: "obscure-opponent";
}

export const BATTLE_SHARED_ITEM_EFFECTS = Object.freeze({
  ink: { kind: "obscure-opponent" },
} as const satisfies SharedGameItemEffects<BattleSharedItemEffect>);

export function canUseBattleInk(phase: BattlePhase | null, role: BattleRole): boolean {
  return (phase === "choosing" && role === "defender")
    || (phase === "answering" && role === "attacker");
}
