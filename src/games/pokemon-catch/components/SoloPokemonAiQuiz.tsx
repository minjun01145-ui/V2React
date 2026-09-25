import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeProgress } from "../../../game-engine/progress/index.ts";
import type { AiTutorDirection, AiTutorReply } from "../../../ai-tutor-engine/types.ts";
import { adaptLearningSetToAiTutor } from "../../../learning-sets/aiTutorAdapter.ts";
import type { RuntimeLearningSet } from "../../../learning-sets/types.ts";
import type { SoloRun } from "../../../solo/contracts.ts";
import { submitSoloAiTutorTurn } from "../../../solo/persistence/repository.ts";
import { useSoloRunProgress } from "../../../solo/runtime/useSoloRunProgress.ts";
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

export function SoloPokemonAiQuiz({ run, set, disabled = false, advanceRequestId, onQuestionComplete, onAdvanced }: {
  readonly run: SoloRun;
  readonly set: RuntimeLearningSet;
  readonly disabled?: boolean;
  readonly advanceRequestId: number;
  readonly onQuestionComplete: (completionId: string) => void;
  readonly onAdvanced: () => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(() => randomIndex(set.items.length));
  const [direction, setDirection] = useState<AiTutorDirection>(() => randomDirection());
  const [challengeId, setChallengeId] = useState(() => crypto.randomUUID());
  const [reply, setReply] = useState<AiTutorReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const handledAdvanceRef = useRef(advanceRequestId);
  const pendingAttemptIdRef = useRef<string | null>(null);
  const stored = useSoloRunProgress(run, 10_000);
  const questions = useMemo(() => adaptLearningSetToAiTutor(set, direction), [direction, set]);
  const question = questions[questionIndex] ?? questions[0] ?? null;

  useEffect(() => {
    if (advanceRequestId === handledAdvanceRef.current) return;
    handledAdvanceRef.current = advanceRequestId;
    setQuestionIndex((current) => randomIndex(set.items.length, current));
    setDirection(randomDirection());
    setChallengeId(crypto.randomUUID());
    pendingAttemptIdRef.current = null;
    setReply(null);
    setError("");
    onAdvanced();
  }, [advanceRequestId, onAdvanced, set.items.length]);

  const submit = async (answer: string): Promise<void> => {
    if (!question || busy || disabled || stored.loading || reply?.isCorrect || !answer.trim()) return;
    setBusy(true);
    setError("");
    const attemptId = pendingAttemptIdRef.current ?? crypto.randomUUID();
    pendingAttemptIdRef.current = attemptId;
    try {
      const response = await submitSoloAiTutorTurn(run, {
        attemptId,
        questionId: `pokemon-ai:${challengeId}`,
        itemId: question.id,
        currentIndex: stored.progress.correctCount,
        direction,
        message: answer.trim(),
      });
      const progress = normalizeProgress(response.progress, 10_000);
      stored.adopt(progress);
      setReply(response.reply);
      pendingAttemptIdRef.current = null;
      if (response.reply.isCorrect) onQuestionComplete(`solo-pokemon-ai:${run.runId}:${challengeId}`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "AI 문답을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return <PokemonAiQuizView
    question={question}
    questionKey={challengeId}
    disabled={disabled || stored.loading}
    busy={busy}
    reply={reply}
    error={error}
    onSubmit={submit}
  />;
}
