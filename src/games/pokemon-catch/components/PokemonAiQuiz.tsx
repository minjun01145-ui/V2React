import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { submitAiTutorTurn } from "../../../ai-tutor-engine/repository.ts";
import { aiTutorAnswerResult } from "../../../ai-tutor-engine/result.ts";
import type { AiTutorDirection, AiTutorReply } from "../../../ai-tutor-engine/types.ts";
import { applyResultToProgress, createEmptyProgress, normalizeProgress, type GameProgress } from "../../../game-engine/progress/index.ts";
import { adaptLearningSetToAiTutor } from "../../../learning-sets/aiTutorAdapter.ts";
import type { LearningSet } from "../../../learning-sets/types.ts";
import { usePlayerGameProgress } from "../../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt } from "../../../multiplayer/game-progress/repository.ts";
import type { ActiveGameSession, Player } from "../../../multiplayer/types.ts";
import styles from "../PokemonCatch.module.css";

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
  readonly set: LearningSet;
  readonly disabled?: boolean;
  readonly advanceRequestId: number;
  readonly onQuestionComplete: (completionId: string) => void;
  readonly onAdvanced: () => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(() => randomIndex(set.items.length));
  const [direction, setDirection] = useState<AiTutorDirection>(() => randomDirection());
  const [message, setMessage] = useState("");
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
    setMessage("");
    setReply(null);
    setError("");
    attemptRef.current = 0;
    completionRef.current = null;
    onAdvanced();
  }, [advanceRequestId, onAdvanced, set.items.length]);

  if (!question) return <p className={styles.quizFeedback}>출제할 학습 문제가 없습니다.</p>;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const answer = message.trim();
    if (!answer || busy || disabled || reply?.isCorrect) return;
    setBusy(true);
    setError("");
    try {
      const nextReply = await submitAiTutorTurn({
        roomId,
        roundId: session.roundId,
        itemId: question.id,
        message: answer,
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
          answer,
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

  return <div className={styles.aiQuiz}>
    <section className={styles.aiQuestion}>
      <span>{question.promptLabel}</span>
      <strong>{question.prompt}</strong>
      <small>{question.answerLabel} · AI가 표현의 의미까지 살펴봅니다.</small>
    </section>
    <form onSubmit={(event) => void submit(event)}>
      <textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy || disabled || Boolean(reply?.isCorrect)} maxLength={1000} placeholder="답을 입력하세요" autoFocus />
      <button type="submit" disabled={busy || disabled || !message.trim() || Boolean(reply?.isCorrect)}>{busy ? "AI가 채점하는 중…" : "답 확인하기"}</button>
    </form>
    {reply ? <div className={styles.aiReply} data-kind={reply.kind} role="status">
      <strong>{reply.isCorrect ? "정답이에요!" : reply.kind === "retry" ? "조금 더 생각해 보세요" : reply.kind === "help" ? "AI 도움말" : "문제에 집중해 주세요"}</strong>
      <p>{reply.feedback}</p>
      {reply.focus ? <small>확인할 부분: {reply.focus}</small> : null}
      {reply.hint ? <small>힌트: {reply.hint}</small> : null}
    </div> : null}
    {error ? <p className={styles.quizFeedback} role="alert">{error}</p> : null}
  </div>;
}
