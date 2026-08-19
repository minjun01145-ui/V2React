import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assertAnswerResult } from "../core/answerResult.ts";
import { applyAnswerToProgress, createEmptyProgress, moveToNextQuestion, normalizeProgress } from "./progress.ts";
import type { AnswerResult } from "../core/types.ts";
import type { AnswerSubmission, BaseQuestion, Evaluator, GameProgress } from "./types.ts";

interface UseQuestionEngineInput<TQuestion extends BaseQuestion, TAnswer, TDetails> {
  readonly questions: readonly TQuestion[];
  readonly roundId: string;
  readonly evaluator: Evaluator<TQuestion, TAnswer, TDetails>;
  readonly initialProgress: unknown;
  readonly progressLoading?: boolean;
  readonly onSubmit?: (submission: AnswerSubmission<TQuestion, TAnswer, TDetails>) => Promise<void> | void;
  readonly onProgress?: (progress: GameProgress<TDetails>) => Promise<void> | void;
}

export interface QuestionEngine<TQuestion extends BaseQuestion, TAnswer, TDetails> {
  readonly currentQuestion: TQuestion | null;
  readonly currentIndex: number;
  readonly questionCount: number;
  readonly progress: GameProgress<TDetails>;
  readonly isComplete: boolean;
  readonly submitAnswer: (answer: TAnswer) => Promise<AnswerResult<TDetails> | null>;
  readonly nextQuestion: () => Promise<boolean>;
}

export function useQuestionEngine<TQuestion extends BaseQuestion, TAnswer, TDetails = unknown>({
  questions,
  roundId,
  evaluator,
  initialProgress,
  progressLoading = false,
  onSubmit,
  onProgress,
}: UseQuestionEngineInput<TQuestion, TAnswer, TDetails>): QuestionEngine<TQuestion, TAnswer, TDetails> {
  const [progress, setProgress] = useState<GameProgress<TDetails>>(() => createEmptyProgress<TDetails>());
  const hydratedRoundRef = useRef<string | null>(null);
  const operationRef = useRef(false);

  useEffect(() => {
    if (progressLoading || hydratedRoundRef.current === roundId) return;
    setProgress(normalizeProgress<TDetails>(initialProgress, questions.length));
    hydratedRoundRef.current = roundId;
  }, [initialProgress, progressLoading, questions.length, roundId]);

  const currentQuestion = questions[progress.currentIndex] ?? null;
  const isComplete = questions.length > 0 && progress.currentIndex >= questions.length;

  const submitAnswer = useCallback(async (answer: TAnswer): Promise<AnswerResult<TDetails> | null> => {
    if (!currentQuestion || isComplete || operationRef.current) return null;
    operationRef.current = true;
    try {
      const result = assertAnswerResult<TDetails>(evaluator(currentQuestion, answer));
      const nextProgress = applyAnswerToProgress(progress, currentQuestion, result);
      const attemptId = globalThis.crypto.randomUUID();
      await onSubmit?.({ attemptId, question: currentQuestion, answer, result, progress: nextProgress });
      setProgress(nextProgress);
      return result;
    } finally {
      operationRef.current = false;
    }
  }, [currentQuestion, evaluator, isComplete, onSubmit, progress]);

  const nextQuestion = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion || !progress.lastResult?.isCorrect || operationRef.current) return false;
    operationRef.current = true;
    try {
      const nextProgress = moveToNextQuestion(progress, questions.length);
      await onProgress?.(nextProgress);
      setProgress(nextProgress);
      return true;
    } finally {
      operationRef.current = false;
    }
  }, [currentQuestion, onProgress, progress, questions.length]);

  return useMemo(() => ({
    currentQuestion,
    currentIndex: progress.currentIndex,
    questionCount: questions.length,
    progress,
    isComplete,
    submitAnswer,
    nextQuestion,
  }), [currentQuestion, isComplete, nextQuestion, progress, questions.length, submitAnswer]);
}
