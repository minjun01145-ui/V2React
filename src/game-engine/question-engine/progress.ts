import type { AnswerResult } from "../core/types.ts";
import { applyResultToProgress } from "../progress/index.ts";
import type { GameProgress } from "../progress/index.ts";
import type { BaseQuestion } from "./types.ts";

export { createEmptyProgress, normalizeProgress } from "../progress/index.ts";

export function applyAnswerToProgress<TQuestion extends BaseQuestion, TDetails>(
  progress: GameProgress<TDetails>,
  question: TQuestion,
  result: AnswerResult<TDetails>,
): GameProgress<TDetails> {
  return applyResultToProgress(progress, question.id, result);
}

export function moveToNextQuestion<TDetails>(
  progress: GameProgress<TDetails>,
  questionCount: number,
  options: { readonly repeat?: boolean } = {},
): GameProgress<TDetails> {
  const repeats = options.repeat === true && questionCount > 0;
  if (repeats && progress.currentIndex + 1 >= questionCount) {
    return {
      ...progress,
      currentIndex: 0,
      completedItemIds: [],
      lastResult: null,
      completedAtMs: null,
    };
  }
  const nextIndex = Math.min(progress.currentIndex + 1, questionCount);
  const isComplete = nextIndex >= questionCount;
  return {
    ...progress,
    currentIndex: nextIndex,
    lastResult: null,
    completedAtMs: isComplete ? Date.now() : null,
  };
}
