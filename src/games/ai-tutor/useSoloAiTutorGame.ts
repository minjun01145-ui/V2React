import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adaptLearningSetToAiTutor } from "../../learning-sets/aiTutorAdapter.ts";
import { normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { AiTutorDirection, AiTutorEvaluationDetails, AiTutorQuestion, AiTutorReply } from "../../ai-tutor-engine/types.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import type { SoloRun } from "../../solo/contracts.ts";
import { useSoloRunProgress } from "../../solo/runtime/useSoloRunProgress.ts";
import { submitSoloAiTutorTurn } from "../../solo/persistence/repository.ts";

export function useSoloAiTutorGame(run: SoloRun, set: RuntimeLearningSet) {
  const direction: AiTutorDirection = run.gameConfig.direction === "meaning-to-source" ? "meaning-to-source" : "source-to-meaning";
  const questions = useMemo(() => adaptLearningSetToAiTutor(set, direction), [direction, set]);
  const stored = useSoloRunProgress<AiTutorEvaluationDetails>(run, questions.length);
  const [reply, setReply] = useState<AiTutorReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const busyRef = useRef(false);
  const pendingAttemptIdRef = useRef<string | null>(null);
  const progress = stored.progress;
  const currentQuestion: AiTutorQuestion | null = questions[progress.currentIndex] ?? null;

  useEffect(() => {
    setReply(null);
    setError(null);
  }, [currentQuestion?.id, run.runId]);

  const submit = useCallback(async (message: string): Promise<void> => {
    if (!currentQuestion || busyRef.current || progress.lastResult?.isCorrect || !message.trim()) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const attemptId = pendingAttemptIdRef.current ?? crypto.randomUUID();
    pendingAttemptIdRef.current = attemptId;
    try {
      const response = await submitSoloAiTutorTurn(run, {
        attemptId,
        questionId: currentQuestion.id,
        itemId: currentQuestion.id,
        currentIndex: progress.currentIndex,
        direction,
        message,
      });
      const nextProgress = normalizeProgress<AiTutorEvaluationDetails>(response.progress, questions.length);
      stored.adopt(nextProgress);
      setReply(response.reply);
      pendingAttemptIdRef.current = null;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught : new Error("AI 문답을 처리하지 못했습니다."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [currentQuestion, direction, progress.currentIndex, progress.lastResult?.isCorrect, questions.length, run, stored.adopt]);

  const goNext = useCallback(async (): Promise<void> => {
    if (!currentQuestion || !progress.lastResult?.isCorrect || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const nextIndex = Math.min(progress.currentIndex + 1, questions.length);
    const nextProgress: GameProgress<AiTutorEvaluationDetails> = {
      ...progress,
      currentIndex: nextIndex,
      lastResult: null,
      completedAtMs: nextIndex >= questions.length ? Date.now() : null,
    };
    try {
      await stored.persist(nextProgress);
      setReply(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught : new Error("다음 문제로 이동하지 못했습니다."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [currentQuestion, progress, questions.length, stored.persist]);

  const persistedResult = progress.lastResult?.itemId === currentQuestion?.id ? progress.lastResult : null;
  const persistedDetails = persistedResult?.details;
  const visibleReply = reply ?? (persistedResult && persistedDetails
    ? {
        kind: persistedDetails.kind,
        isCorrect: persistedResult.isCorrect,
        feedback: persistedResult.feedback ?? "",
        hint: persistedDetails.hint,
        focus: persistedDetails.focus,
        scoreDelta: persistedResult.scoreDelta,
      }
    : null);

  return {
    title: set.name,
    currentQuestion,
    progress,
    totalCount: questions.length,
    reply: visibleReply,
    busy,
    loading: stored.loading,
    error: error ?? stored.error,
    submit,
    goNext,
  } as const;
}
