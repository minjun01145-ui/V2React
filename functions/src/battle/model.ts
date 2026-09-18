import type { BattleItem } from "./types.js";

export const BATTLE_MAX_TURNS = 10;

export function battleGroupSizes(count: number): number[] {
  if (count <= 0) return [];
  const pairs = Array.from({ length: Math.floor(count / 2) }, () => 2);
  return count % 2 === 0 ? pairs : [...pairs, 1];
}

export function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const left = result[index];
    const right = result[swap];
    if (left !== undefined && right !== undefined) {
      result[index] = right;
      result[swap] = left;
    }
  }
  return result;
}

export function nextBattleIndices(
  memberCount: number,
  currentDefenderIndex: number,
): { readonly attackerIndex: number; readonly defenderIndex: number } {
  const attackerIndex = Math.max(0, currentDefenderIndex % memberCount);
  return { attackerIndex, defenderIndex: (attackerIndex + 1) % memberCount };
}

export function questionText(item: BattleItem, side: "source" | "meaning") {
  return side === "source"
    ? { prompt: item.meaning, expectedAnswer: item.source }
    : { prompt: item.source, expectedAnswer: item.meaning };
}

export function displayName(nickname: unknown, fallback: unknown): string {
  const preferred = typeof nickname === "string" ? nickname.trim() : "";
  const secondary = typeof fallback === "string" ? fallback.trim() : "";
  return preferred || secondary || "이름 없음";
}

export interface BattlePairCandidate {
  readonly id: string;
  readonly lastOpponentId: string | null;
  readonly allowRepeat: boolean;
}

export interface BattlePairingResult {
  readonly pairs: readonly (readonly [string, string])[];
  readonly waiting: readonly string[];
}

/**
 * Prefer a player who was not the previous opponent for either student.
 * A same-opponent rematch is only allowed after both candidates opt into fallback.
 */
export function preferredBattlePairs(
  candidates: readonly BattlePairCandidate[],
): BattlePairingResult {
  const remaining = [...candidates];
  const pairs: Array<readonly [string, string]> = [];
  const waiting: string[] = [];

  while (remaining.length > 0) {
    const first = remaining.shift();
    if (!first) break;

    let partnerIndex = remaining.findIndex((candidate) =>
      candidate.id !== first.lastOpponentId
      && first.id !== candidate.lastOpponentId,
    );

    if (partnerIndex < 0 && first.allowRepeat) {
      partnerIndex = remaining.findIndex((candidate) => candidate.allowRepeat);
    }

    if (partnerIndex < 0) {
      waiting.push(first.id);
      continue;
    }

    const partner = remaining.splice(partnerIndex, 1)[0];
    if (partner) pairs.push([first.id, partner.id]);
  }

  return { pairs, waiting };
}
