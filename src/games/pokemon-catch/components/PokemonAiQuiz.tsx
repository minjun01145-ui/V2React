import { useEffect, useMemo, useRef, useState } from "react";
import { submitAiTutorTurn } from "../../../ai-tutor-engine/repository.ts";
import { aiTutorAnswerResult } from "../../../ai-tutor-engine/result.ts";
import type { AiTutorDirection, AiTutorReply } from "../../../ai-tutor-engine/types.ts";
import { applyResultToProgress, createEmptyProgress, normalizeProgress, type GameProgress } from "../../../game-engine/progress/index.ts";
import { adaptLearningSetToAiTutor } from "../../../learning-sets/aiTutorAdapter.ts";
import type { RuntimeLearningSet } from "../../../learning-sets/types.ts";
import { usePlayerGameProgress } from "../../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt } from "../../../multiplayer/game-progress/repository.ts";
import type { ActiveGameSession, Player } from "../../../multiplayer/types.ts";
import { PokemonAiQuizView } from "./PokemonAiQuizView.tsx";

function randomIndex(length: number, previous = -1): number {
  if (length <= 1) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  const candidate = values[0]! % (length - 1);
  return candidate >= previous ? candidate + 1 : candidate;
}

function randomDirection(): AiTutorDirection {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0]! % 2 === 0 ? "source-to-meaning" : "meaning-to-source";
}

export function PokemonAiQuiz({ roomId, session, player, set, disabled = false, advanceRequestId, onQuestionComplete, onAdvanced }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: RuntimeLearningSet;
  readonly disabled?: boolean;
  readonly advanceRequestId: number;
  readonly onQuestionComplete: (completionId: string) => void;
  readonly onAdvanced: () => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(() => randomIndex(set.items.length));
  const [direction, setDirection] = useState<AiTutorDirection>(() => randomDirection());
  const [reply, setReply] = useState<AiTutorReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remoteProgress = usePlayerGameProgress(roomId, session.roundId, player.id);
  const [progress, setProgress] = useState<GameProgress>(() => createEmptyProgress());
  const attemptRef = useRef(0);
  const appliedRevisionRef = useRef(-1);
  const completionRef = useRef<string | null>(null);
  const handledAdvanceRef = useRef(advanceRequestId);
  const questions = useMemo(() => adaptLearningSetToAiTutor(set, direction), [direction, set]);
  const question = questions[questionIndex] ?? questions[0] ?? null;

  useEffect(() => {
    if (remoteProgress.loading || remoteProgress.revision <= appliedRevisionRef.current) return;
    setProgress(normalizeProgress(remoteProgress.value, set.items.length));
    appliedRevisionRef.current = remoteProgress.revision;
  }, [remoteProgress.loading, remoteProgress.revision, remoteProgress.value, set.items.length]);

  useEffect(() => {
    if (advanceRequestId === handledAdvanceRef.current) return;
    handledAdvanceRef.current = advanceRequestId;
    setQuestionIndex((current) => randomIndex(set.items.length, current));
    setDirection(randomDirection());
    setReply(null);
    setError("");
    attemptRef.current = 0;
    completionRef.current = null;
    onAdvanced();
  }, [advanceRequestId, onAdvanced, set.items.length]);

  const submit = async (answer: string): Promise<void> => {
    if (!question || busy || disabled || reply?.isCorrect || !answer.trim()) return;
    setBusy(true);
    setError("");
    try {
      const nextReply = await submitAiTutorTurn({
        roomId,
        roundId: session.roundId,
        itemId: question.id,
        message: answer.trim(),
        attemptNumber: Math.min(attemptRef.current + 1, 20),
        previousFeedback: reply?.feedback ?? null,
        direction,
      });
      if (nextReply.kind !== "help" && nextReply.kind !== "off-topic") {
        attemptRef.current += 1;
        const result = aiTutorAnswerResult(nextReply);
        const nextProgress = applyResultToProgress(progress, question.id, result);
        const committed = await persistGameAttempt({
          roomId,
          roundId: session.roundId,
          gameId: session.gameId,
          player,
          attemptId: crypto.randomUUID(),
          item: { id: question.id, prompt: question.prompt },
          answer: answer.trim(),
          result,
          previousProgress: progress,
          progress: nextProgress,
        });
        appliedRevisionRef.current = committed.revision;
        setProgress(normalizeProgress(committed.progress, set.items.length));
      }
      setReply(nextReply);
      if (nextReply.isCorrect && !completionRef.current) {
        completionRef.current = `pokemon-ai:${session.roundId}:${player.id}:${crypto.randomUUID()}`;
        onQuestionComplete(completionRef.current);
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "AI 문답을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return <PokemonAiQuizView
    question={question}
    questionKey={`${advanceRequestId}:${questionIndex}:${direction}`}
    disabled={disabled || remoteProgress.loading}
    busy={busy}
    reply={reply}
    error={error}
    onSubmit={submit}
  />;
}
