import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { createEmptyProgress, normalizeProgress } from "../../game-engine/progress/index.ts";
import { usePlayerGameProgress } from "../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt, type GameAttemptSubmission } from "../../multiplayer/game-progress/repository.ts";
import { goldRunQuestionAt, passGate, type GoldRunAnswer, type GoldRunDetails, type GoldRunProgress, type GoldRunQuestion } from "./model/questions.ts";
import type { GateReport } from "./scene/GoldRunScene.ts";

type Attempt = GameAttemptSubmission<GoldRunQuestion, GoldRunAnswer, GoldRunDetails>;

const MAX_PENDING = 8;

export interface GateFeedback {
  readonly id: number;
  readonly correct: boolean;
  readonly question: GoldRunQuestion;
}

/**
 * Saves each passed gate as an attempt, in order, without ever making the runner wait for the
 * network. Gate ordinals of this run start at the saved progress, so a reload continues the deck.
 */
export function useGoldRun({ roomId, session, player, questions }: StudentGameModuleProps & { readonly questions: readonly GoldRunQuestion[] }) {
  const remote = usePlayerGameProgress(roomId, session.roundId, player.id);
  const [progress, setProgress] = useState<GoldRunProgress>(() => createEmptyProgress());
  const current = useRef(progress);
  const [start, setStart] = useState<{ index: number; score: number } | null>(null);
  const [feedback, setFeedback] = useState<GateFeedback | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const queue = useRef<Attempt[]>([]);
  const saving = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (remote.loading || remote.error || start) return;
    current.current = normalizeProgress(remote.value, Number.MAX_SAFE_INTEGER);
    setProgress(current.current);
    setStart({ index: current.current.currentIndex, score: current.current.score });
  }, [remote.error, remote.loading, remote.value, start]);

  const flush = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    if (mounted.current) setSaveError(null);
    try {
      while (queue.current.length) {
        await persistGameAttempt({ roomId, roundId: session.roundId, gameId: session.gameId, player, ...queue.current[0]! });
        queue.current.shift();
        if (mounted.current) setPending(queue.current.length);
      }
    } catch {
      // The same attempt ID is retried, so an uncertain write cannot count twice.
      if (mounted.current) setSaveError("기록을 저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      saving.current = false;
    }
  }, [player, roomId, session.gameId, session.roundId]);

  const questionAt = useCallback((ordinal: number) => goldRunQuestionAt(questions, (start?.index ?? 0) + ordinal), [questions, start]);
  const isTrue = useCallback((ordinal: number) => questionAt(ordinal).isTrue, [questionAt]);

  const onGate = useCallback((report: GateReport) => {
    const question = questionAt(report.question);
    const previousProgress = current.current;
    const next = passGate(previousProgress, question, { value: report.chose }, report.points, report.coins);
    current.current = next.progress;
    setProgress(next.progress);
    setFeedback({ id: next.progress.attemptCount, correct: next.result.isCorrect, question });
    queue.current.push({ attemptId: crypto.randomUUID(), item: question, answer: { value: report.chose },
      result: next.result, previousProgress, progress: next.progress });
    setPending(queue.current.length);
    void flush();
  }, [flush, questionAt]);

  return {
    ready: start !== null,
    startScore: start?.score ?? 0,
    progress,
    feedback,
    questionAt,
    isTrue,
    onGate,
    blocked: start === null || Boolean(saveError || remote.error) || pending >= MAX_PENDING,
    error: saveError ?? remote.error?.message ?? null,
    retry: flush,
  };
}
