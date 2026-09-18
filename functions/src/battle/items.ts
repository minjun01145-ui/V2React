import type { StoredBattleMatch } from "./types.js";

export const BATTLE_INK_REWARD_CHANCE = 0.3;
export const BATTLE_INK_BLOCK_MS = 5_000;

export type BattleRewardItemId = "ink";

export function rollBattleReward(random = Math.random): BattleRewardItemId | null {
  return random() < BATTLE_INK_REWARD_CHANCE ? "ink" : null;
}

export function battleInkTargetId(match: StoredBattleMatch, actorId: string): string | null {
  if (match.phase === "grading") return null;
  const actingIndex = match.phase === "choosing" ? match.attackerIndex : match.defenderIndex;
  const targetId = match.memberIds[actingIndex];
  if (!targetId || targetId === actorId) return null;
  return targetId;
}
