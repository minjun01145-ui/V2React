import type { GameProgress } from "../../game-engine/progress/index.ts";

export interface ProgressMutationResult<TDetails> {
  readonly progress: GameProgress<TDetails>;
  readonly revision: number;
  readonly duplicate: boolean;
}

function applyDelta(current: number, previous: number, next: number): number {
  return Math.max(0, current + (next - previous));
}

export function mergeProgressTransition<TDetails>(
  current: GameProgress<TDetails>,
  previous: GameProgress<TDetails>,
  next: GameProgress<TDetails>,
): GameProgress<TDetails> {
  const removedItems = new Set(previous.completedItemIds.filter((itemId) => !next.completedItemIds.includes(itemId)));
  const addedItems = next.completedItemIds.filter((itemId) => !previous.completedItemIds.includes(itemId));
  const completedItemIds = current.completedItemIds.filter((itemId) => !removedItems.has(itemId));
  const completedSet = new Set(completedItemIds);
  for (const itemId of addedItems) {
    if (!completedSet.has(itemId)) {
      completedSet.add(itemId);
      completedItemIds.push(itemId);
    }
  }

  return {
    currentIndex: applyDelta(current.currentIndex, previous.currentIndex, next.currentIndex),
    score: applyDelta(current.score, previous.score, next.score),
    correctCount: applyDelta(current.correctCount, previous.correctCount, next.correctCount),
    attemptCount: applyDelta(current.attemptCount, previous.attemptCount, next.attemptCount),
    combo: applyDelta(current.combo, previous.combo, next.combo),
    completedItemIds,
    lastResult: next.lastResult,
    completedAtMs: next.completedAtMs,
  };
}

export function progressOperationId(playerId: string, operationId: string): string {
  return `${playerId}:${operationId}`;
}

function versionOf(value: unknown): { readonly revision: number; readonly updatedAtMs: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { revision: -1, updatedAtMs: -1 };
  const record = value as Record<string, unknown>;
  return {
    revision: typeof record.revision === "number" && Number.isInteger(record.revision) ? record.revision : 0,
    updatedAtMs: typeof record.updatedAtMs === "number" && Number.isFinite(record.updatedAtMs) ? record.updatedAtMs : 0,
  };
}

export function reconcileProgressSnapshot(current: unknown, incoming: unknown): unknown {
  const currentVersion = versionOf(current);
  const incomingVersion = versionOf(incoming);
  if (incomingVersion.revision !== currentVersion.revision) {
    return incomingVersion.revision > currentVersion.revision ? incoming : current;
  }
  return incomingVersion.updatedAtMs >= currentVersion.updatedAtMs ? incoming : current;
}

export function progressRevision(value: unknown): number {
  return versionOf(value).revision;
}
