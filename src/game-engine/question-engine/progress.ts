import { assertAnswerResult } from "../core/answerResult.ts";
import type { AnswerResult } from "../core/types.ts";
import type { BaseQuestion, GameProgress, LastAnswerResult } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function parseLastResult<TDetails>(value: unknown): LastAnswerResult<TDetails> | null {
  if (!isRecord(value) || typeof value.questionId !== "string" || !value.questionId) return null;
  try {
    const result = assertAnswerResult<TDetails>(value);
    return { questionId: value.questionId, ...result };
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
    completedQuestionIds: [],
    lastResult: null,
    completedAtMs: null,
  };
}

export function normalizeProgress<TDetails = unknown>(progress: unknown, questionCount: number): GameProgress<TDetails> {
  const base = createEmptyProgress<TDetails>();
  if (!isRecord(progress)) return base;

  const completedQuestionIds = Array.isArray(progress.completedQuestionIds)
    ? [...new Set(progress.completedQuestionIds.filter((id): id is string => typeof id === "string" && Boolean(id)))]
    : [];

  const rawIndex = nonNegativeNumber(progress.currentIndex);
  return {
    currentIndex: Math.min(rawIndex, Math.max(questionCount, 0)),
    score: nonNegativeNumber(progress.score),
    correctCount: nonNegativeNumber(progress.correctCount),
    attemptCount: nonNegativeNumber(progress.attemptCount),
    completedQuestionIds,
    lastResult: parseLastResult<TDetails>(progress.lastResult),
    completedAtMs: typeof progress.completedAtMs === "number" && Number.isFinite(progress.completedAtMs)
      ? progress.completedAtMs
      : null,
  };
}

export function applyAnswerToProgress<TQuestion extends BaseQuestion, TDetails>(
  progress: GameProgress<TDetails>,
  question: TQuestion,
  result: AnswerResult<TDetails>,
): GameProgress<TDetails> {
  const alreadyCompleted = progress.completedQuestionIds.includes(question.id);
  const newlyCorrect = result.isCorrect && !alreadyCompleted;
  return {
    ...progress,
    score: progress.score + (newlyCorrect ? result.scoreDelta : 0),
    correctCount: progress.correctCount + (newlyCorrect ? 1 : 0),
    attemptCount: progress.attemptCount + 1,
    completedQuestionIds: newlyCorrect ? [...progress.completedQuestionIds, question.id] : progress.completedQuestionIds,
    lastResult: { questionId: question.id, ...result },
  };
}

export function moveToNextQuestion<TDetails>(
  progress: GameProgress<TDetails>,
  questionCount: number,
): GameProgress<TDetails> {
  const nextIndex = Math.min(progress.currentIndex + 1, questionCount);
  const isComplete = nextIndex >= questionCount;
  return {
    ...progress,
    currentIndex: nextIndex,
    lastResult: null,
    completedAtMs: isComplete ? Date.now() : null,
  };
}
