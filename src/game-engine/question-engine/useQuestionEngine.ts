import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assertAnswerResult } from "../core/answerResult.ts";
import {
  beginLogicalOperation,
  completeLogicalOperation,
  logicalOperationKey,
  reconcileLogicalOperation,
  type PendingLogicalOperation,
} from "../core/logicalOperation.ts";
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
  readonly canonicalRevision?: number;
  readonly canonicalOperationId?: string | null;
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
  canonicalRevision = 0,
  canonicalOperationId = null,
  onSubmit,
  onProgress,
}: UseQuestionEngineInput<TQuestion, TAnswer, TDetails>): QuestionEngine<TQuestion, TAnswer, TDetails> {
  const [progress, setProgress] = useState<GameProgress<TDetails>>(() => createEmptyProgress<TDetails>());
  const operationRef = useRef(false);
  const operationRoundRef = useRef(roundId);
  const pendingOperationRef = useRef<PendingLogicalOperation<
    | { readonly kind: "answer"; readonly submission: Omit<AnswerSubmission<TQuestion, TAnswer, TDetails>, "attemptId">; readonly result: AnswerResult<TDetails> }
    | { readonly kind: "progress"; readonly submission: Omit<ProgressSubmission<TDetails>, "operationId"> }
  > | null>(null);
  const canonicalResultRef = useRef<typeof pendingOperationRef.current>(null);

  useEffect(() => {
    if (operationRoundRef.current !== roundId) {
      operationRoundRef.current = roundId;
      pendingOperationRef.current = null;
      canonicalResultRef.current = null;
    }
    if (progressLoading) return;
    const pending = pendingOperationRef.current;
    const reconciled = reconcileLogicalOperation(
      pending,
      canonicalRevision,
      canonicalOperationId,
    );
    if (pending && !reconciled) canonicalResultRef.current = pending;
    pendingOperationRef.current = reconciled;
    const normalized = normalizeProgress<TDetails>(initialProgress, questions.length);
    setProgress(repeatQuestions && questions.length > 0 && normalized.currentIndex >= questions.length
      ? { ...normalized, currentIndex: 0, completedItemIds: [], lastResult: null, completedAtMs: null }
      : normalized);
  }, [canonicalOperationId, canonicalRevision, initialProgress, progressLoading, questions.length, repeatQuestions, roundId]);

  const displayIndex = repeatQuestions && questions.length > 0 ? progress.currentIndex % questions.length : progress.currentIndex;
  const currentQuestion = questions[displayIndex] ?? null;
  const isComplete = !repeatQuestions && questions.length > 0 && progress.currentIndex >= questions.length;

  const submitAnswer = useCallback(async (answer: TAnswer): Promise<AnswerResult<TDetails> | null> => {
    if (!currentQuestion || isComplete || disabled || operationRef.current) return null;
    operationRef.current = true;
    try {
      const logicalKey = logicalOperationKey(["answer", roundId, currentQuestion.id, progress.currentIndex, answer]);
      const canonicalResult = canonicalResultRef.current;
      if (canonicalResult?.logicalKey === logicalKey && canonicalResult.payload.kind === "answer") {
        canonicalResultRef.current = null;
        return canonicalResult.payload.result;
      }
      canonicalResultRef.current = null;
      const pending = beginLogicalOperation({
        pending: pendingOperationRef.current,
        logicalKey,
        baseRevision: canonicalRevision,
        createPayload: () => {
          const evaluated = assertAnswerResult<TDetails>(evaluator(currentQuestion, answer));
          const comboResult = comboScoring
            ? applyComboScore(progress.combo, evaluated.isCorrect, evaluated.scoreDelta, comboScoring)
            : { combo: progress.combo, scoreDelta: evaluated.scoreDelta };
          const result = { ...evaluated, scoreDelta: comboResult.scoreDelta };
          const nextProgress = applyAnswerToProgress({ ...progress, combo: comboResult.combo }, currentQuestion, result);
          return {
            kind: "answer" as const,
            result,
            submission: { question: currentQuestion, answer, result, previousProgress: progress, progress: nextProgress },
          };
        },
      });
      pendingOperationRef.current = pending;
      if (pending.payload.kind !== "answer") return null;
      const committed = await onSubmit?.({ attemptId: pending.operationId, ...pending.payload.submission });
      pendingOperationRef.current = completeLogicalOperation(pendingOperationRef.current, pending.operationId);
      canonicalResultRef.current = null;
      setProgress(committed ?? pending.payload.submission.progress);
      return pending.payload.result;
    } finally {
      operationRef.current = false;
    }
  }, [canonicalRevision, comboScoring, currentQuestion, disabled, evaluator, isComplete, onSubmit, progress, roundId]);

  const nextQuestion = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion || !progress.lastResult || (!advanceAfterAnyAnswer && !progress.lastResult.isCorrect) || disabled || operationRef.current) return false;
    operationRef.current = true;
    try {
      const logicalKey = logicalOperationKey(["next-question", roundId, currentQuestion.id, progress.currentIndex]);
      const canonicalResult = canonicalResultRef.current;
      if (canonicalResult?.logicalKey === logicalKey && canonicalResult.payload.kind === "progress") {
        canonicalResultRef.current = null;
        return true;
      }
      canonicalResultRef.current = null;
      const pending = beginLogicalOperation({
        pending: pendingOperationRef.current,
        logicalKey,
        baseRevision: canonicalRevision,
        createPayload: () => ({
          kind: "progress" as const,
          submission: {
            previousProgress: progress,
            progress: moveToNextQuestion(progress, questions.length, { repeat: repeatQuestions }),
          },
        }),
      });
      pendingOperationRef.current = pending;
      if (pending.payload.kind !== "progress") return false;
      const committed = await onProgress?.({ operationId: pending.operationId, ...pending.payload.submission });
      pendingOperationRef.current = completeLogicalOperation(pendingOperationRef.current, pending.operationId);
      canonicalResultRef.current = null;
      setProgress(committed ?? pending.payload.submission.progress);
      return true;
    } finally {
      operationRef.current = false;
    }
  }, [advanceAfterAnyAnswer, canonicalRevision, currentQuestion, disabled, onProgress, progress, questions.length, repeatQuestions, roundId]);

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
