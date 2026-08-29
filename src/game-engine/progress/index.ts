import { assertAnswerResult } from "../core/answerResult.ts";
import type { AnswerResult } from "../core/types.ts";

export type LastGameResult<TDetails = unknown> = AnswerResult<TDetails> & {
  readonly itemId: string;
};

export interface GameProgress<TDetails = unknown> {
  readonly currentIndex: number;
  readonly score: number;
  readonly correctCount: number;
  readonly attemptCount: number;
  readonly combo: number;
  readonly completedItemIds: readonly string[];
  readonly lastResult: LastGameResult<TDetails> | null;
  readonly completedAtMs: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function parseLastResult<TDetails>(value: unknown): LastGameResult<TDetails> | null {
  if (!isRecord(value) || typeof value.itemId !== "string" || !value.itemId) return null;
  try {
    return { itemId: value.itemId, ...assertAnswerResult<TDetails>(value) };
  } catch {
    return null;
  }
}

export function createEmptyProgress<TDetails = unknown>(): GameProgress<TDetails> {
  return {
    currentIndex: 0,
    score: 0,
    correctCount: 0,
    attemptCount: 0,
    combo: 0,
    completedItemIds: [],
    lastResult: null,
    completedAtMs: null,
  };
}

export function normalizeProgress<TDetails = unknown>(progress: unknown, itemCount: number): GameProgress<TDetails> {
  const base = createEmptyProgress<TDetails>();
  if (!isRecord(progress)) return base;
  const completedItemIds = Array.isArray(progress.completedItemIds)
    ? [...new Set(progress.completedItemIds.filter((id): id is string => typeof id === "string" && Boolean(id)))]
    : [];
  return {
    currentIndex: Math.min(nonNegativeNumber(progress.currentIndex), Math.max(itemCount, 0)),
    score: nonNegativeNumber(progress.score),
    correctCount: nonNegativeNumber(progress.correctCount),
    attemptCount: nonNegativeNumber(progress.attemptCount),
    combo: nonNegativeNumber(progress.combo),
    completedItemIds,
    lastResult: parseLastResult<TDetails>(progress.lastResult),
    completedAtMs: typeof progress.completedAtMs === "number" && Number.isFinite(progress.completedAtMs)
      ? progress.completedAtMs
      : null,
  };
}

export function applyResultToProgress<TDetails>(
  progress: GameProgress<TDetails>,
  itemId: string,
  result: AnswerResult<TDetails>,
): GameProgress<TDetails> {
  const alreadyCompleted = progress.completedItemIds.includes(itemId);
  const newlyCorrect = result.isCorrect && !alreadyCompleted;
  return {
    ...progress,
    score: progress.score + (newlyCorrect ? result.scoreDelta : 0),
    correctCount: progress.correctCount + (newlyCorrect ? 1 : 0),
    attemptCount: progress.attemptCount + 1,
    completedItemIds: newlyCorrect ? [...progress.completedItemIds, itemId] : progress.completedItemIds,
    lastResult: { itemId, ...result },
  };
}
