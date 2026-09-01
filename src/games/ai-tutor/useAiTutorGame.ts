import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiTutorAnswerResult } from "../../ai-tutor-engine/result.ts";
import { submitAiTutorTurn } from "../../ai-tutor-engine/repository.ts";
import type { AiTutorEvaluationDetails, AiTutorQuestion, AiTutorReply } from "../../ai-tutor-engine/types.ts";
import { applyResultToProgress, createEmptyProgress, normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import { usePlayerGameProgress } from "../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt, persistGameProgress } from "../../multiplayer/game-progress/repository.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { adaptLearningSetToAiTutor } from "./adapter.ts";
import { aiTutorDirection } from "./config.ts";

export function useAiTutorGame(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
}) {
  const { roomId, session, player, set } = input;
  const questions = useMemo(() => adaptLearningSetToAiTutor(set, aiTutorDirection(session)), [session, set]);
  const remote = usePlayerGameProgress(roomId, session.roundId, player.id);
  const [progress, setProgress] = useState<GameProgress<AiTutorEvaluationDetails>>(() => createEmptyProgress());
  const [reply, setReply] = useState<AiTutorReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const questionAttemptRef = useRef(0);
  const appliedRevisionRef = useRef(-1);
  const busyRef = useRef(false);

  useEffect(() => {
    if (remote.loading || remote.revision <= appliedRevisionRef.current) return;
    setProgress(normalizeProgress<AiTutorEvaluationDetails>(remote.value, questions.length));
    appliedRevisionRef.current = remote.revision;
  }, [questions.length, remote.loading, remote.revision, remote.value]);

  const currentQuestion: AiTutorQuestion | null = questions[progress.currentIndex] ?? null;
  const submit = useCallback(async (message: string): Promise<void> => {
    if (!currentQuestion || busyRef.current || progress.lastResult?.isCorrect) return;
    const clean = message.trim();
    if (!clean) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const nextReply = await submitAiTutorTurn({
        roomId,
        roundId: session.roundId,
        itemId: currentQuestion.id,
        message: clean,
        attemptNumber: Math.min(questionAttemptRef.current + 1, 20),
        previousFeedback: reply?.feedback ?? null,
      });
      if (nextReply.kind === "help" || nextReply.kind === "off-topic") {
        setReply(nextReply);
        return;
      }
      questionAttemptRef.current += 1;
      const result = aiTutorAnswerResult(nextReply);
      const nextProgress = applyResultToProgress(progress, currentQuestion.id, result);
      const committed = await persistGameAttempt({
        roomId,
        roundId: session.roundId,
        gameId: session.gameId,
        player,
        attemptId: crypto.randomUUID(),
        item: { id: currentQuestion.id, prompt: currentQuestion.prompt },
        answer: clean,
        result,
        previousProgress: progress,
        progress: nextProgress,
      });
      appliedRevisionRef.current = committed.revision;
      setProgress(normalizeProgress<AiTutorEvaluationDetails>(committed.progress, questions.length));
      setReply(nextReply);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught : new Error("AI 문답을 처리하지 못했습니다."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [currentQuestion, player, progress, questions.length, reply?.feedback, roomId, session.gameId, session.roundId]);

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
      const committed = await persistGameProgress({
        roomId,
        roundId: session.roundId,
        gameId: session.gameId,
        player,
        operationId: crypto.randomUUID(),
        previousProgress: progress,
        progress: nextProgress,
      });
      appliedRevisionRef.current = committed.revision;
      setProgress(normalizeProgress<AiTutorEvaluationDetails>(committed.progress, questions.length));
      setReply(null);
      questionAttemptRef.current = 0;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught : new Error("다음 문제로 이동하지 못했습니다."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [currentQuestion, player, progress, questions.length, roomId, session.gameId, session.roundId]);

  return {
    title: set.name,
    currentQuestion,
    progress,
    totalCount: questions.length,
    reply,
    busy,
    loading: remote.loading,
    error: error ?? remote.error,
    submit,
    goNext,
  };
}
