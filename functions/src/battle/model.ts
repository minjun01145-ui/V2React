import type { BattleItem } from "./types.js";

export function battleGroupSizes(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  if (count % 2 === 0) return Array.from({ length: count / 2 }, () => 2);
  return [...Array.from({ length: (count - 3) / 2 }, () => 2), 3];
}

export function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const left = result[index]; const right = result[swap];
    if (left !== undefined && right !== undefined) { result[index] = right; result[swap] = left; }
  }
  return result;
}

export function nextBattleIndices(memberCount: number, currentDefenderIndex: number): { readonly attackerIndex: number; readonly defenderIndex: number } {
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
