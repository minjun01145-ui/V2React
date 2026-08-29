import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assertAnswerResult } from "../core/answerResult.ts";
import { applyComboScore, type ComboScoringConfig } from "../scoring/combo.ts";
import { applyAnswerToProgress, createEmptyProgress, moveToNextQuestion, normalizeProgress } from "./progress.ts";
import type { AnswerResult } from "../core/types.ts";
import type { AnswerSubmission, BaseQuestion, Evaluator, GameProgress, ProgressSubmission } from "./types.ts";

interface UseQuestionEngineInput<TQuestion extends BaseQuestion, TAnswer, TDetails> {
  readonly questions: readonly TQuestion[];
  readonly roundId: string;
  readonly evaluator: Evaluator<TQuestion, TAnswer, TDetails>;
  readonly initialProgress: unknown;
  readonly progressLoading?: boolean;
  readonly repeatQuestions?: boolean;
  readonly disabled?: boolean;
  readonly comboScoring?: ComboScoringConfig;
  readonly advanceAfterAnyAnswer?: boolean;
  readonly onSubmit?: (submission: AnswerSubmission<TQuestion, TAnswer, TDetails>) => Promise<GameProgress<TDetails> | void> | GameProgress<TDetails> | void;
  readonly onProgress?: (submission: ProgressSubmission<TDetails>) => Promise<GameProgress<TDetails> | void> | GameProgress<TDetails> | void;
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
  repeatQuestions = false,
  disabled = false,
  comboScoring,
  advanceAfterAnyAnswer = false,
  onSubmit,
  onProgress,
}: UseQuestionEngineInput<TQuestion, TAnswer, TDetails>): QuestionEngine<TQuestion, TAnswer, TDetails> {
  const [progress, setProgress] = useState<GameProgress<TDetails>>(() => createEmptyProgress<TDetails>());
  const operationRef = useRef(false);

  useEffect(() => {
    if (progressLoading) return;
    const normalized = normalizeProgress<TDetails>(initialProgress, questions.length);
    setProgress(repeatQuestions && questions.length > 0 && normalized.currentIndex >= questions.length
      ? { ...normalized, currentIndex: 0, completedItemIds: [], lastResult: null, completedAtMs: null }
      : normalized);
  }, [initialProgress, progressLoading, questions.length, repeatQuestions, roundId]);

  const displayIndex = repeatQuestions && questions.length > 0 ? progress.currentIndex % questions.length : progress.currentIndex;
  const currentQuestion = questions[displayIndex] ?? null;
  const isComplete = !repeatQuestions && questions.length > 0 && progress.currentIndex >= questions.length;

  const submitAnswer = useCallback(async (answer: TAnswer): Promise<AnswerResult<TDetails> | null> => {
    if (!currentQuestion || isComplete || disabled || operationRef.current) return null;
    operationRef.current = true;
    try {
      const evaluated = assertAnswerResult<TDetails>(evaluator(currentQuestion, answer));
      const comboResult = comboScoring
        ? applyComboScore(progress.combo, evaluated.isCorrect, evaluated.scoreDelta, comboScoring)
        : { combo: progress.combo, scoreDelta: evaluated.scoreDelta };
      const result = { ...evaluated, scoreDelta: comboResult.scoreDelta };
      const nextProgress = applyAnswerToProgress({ ...progress, combo: comboResult.combo }, currentQuestion, result);
      const attemptId = globalThis.crypto.randomUUID();
      const committed = await onSubmit?.({ attemptId, question: currentQuestion, answer, result, previousProgress: progress, progress: nextProgress });
      setProgress(committed ?? nextProgress);
      return result;
    } finally {
      operationRef.current = false;
    }
  }, [comboScoring, currentQuestion, disabled, evaluator, isComplete, onSubmit, progress]);

  const nextQuestion = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion || !progress.lastResult || (!advanceAfterAnyAnswer && !progress.lastResult.isCorrect) || disabled || operationRef.current) return false;
    operationRef.current = true;
    try {
      const nextProgress = moveToNextQuestion(progress, questions.length, { repeat: repeatQuestions });
      const committed = await onProgress?.({
        operationId: globalThis.crypto.randomUUID(),
        previousProgress: progress,
        progress: nextProgress,
      });
      setProgress(committed ?? nextProgress);
      return true;
    } finally {
      operationRef.current = false;
    }
  }, [advanceAfterAnyAnswer, currentQuestion, disabled, onProgress, progress, questions.length, repeatQuestions]);

  return useMemo(() => ({
    currentQuestion,
    currentIndex: displayIndex,
    questionCount: questions.length,
    progress,
    isComplete,
    submitAnswer,
    nextQuestion,
  }), [currentQuestion, displayIndex, isComplete, nextQuestion, progress, questions.length, submitAnswer]);
}
