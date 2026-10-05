import { useCallback, useEffect, useRef, useState } from "react";
import { createEmptyProgress, normalizeProgress } from "../../game-engine/progress/index.ts";
import { usePlayerGameProgress } from "../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt, type GameAttemptSubmission } from "../../multiplayer/game-progress/repository.ts";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { isGoldenWave, ninjaQuestionAt, sliceFruit, type NinjaDetails, type NinjaProgress, type NinjaQuestion } from "./model.ts";

type Attempt = GameAttemptSubmission<NinjaQuestion, { optionId: string }, NinjaDetails>;

const MAX_PENDING = 12;

// Only writes are queued: the next wave never waits for a network round trip.
export function useWordNinja({ roomId, session, player, questions, expired }: StudentGameModuleProps & {
  readonly questions: readonly NinjaQuestion[];
  readonly expired: boolean;
}) {
  const remote = usePlayerGameProgress(roomId, session.roundId, player.id);
  const [progress, setProgress] = useState<NinjaProgress>(() => createEmptyProgress());
  const current = useRef(progress);
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const queue = useRef<Attempt[]>([]);
  const saving = useRef(false);
  const blocked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (remote.loading || remote.error || initialized.current) return;
    current.current = normalizeProgress(remote.value, Number.MAX_SAFE_INTEGER);
    setProgress(current.current);
    initialized.current = true;
    setReady(true);
  }, [remote.error, remote.loading, remote.value]);

  const flush = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    blocked.current = false;
    if (mounted.current) setSaveError(null);
    try {
      while (queue.current.length) {
        const attempt = queue.current[0]!;
        await persistGameAttempt({ roomId, roundId: session.roundId, gameId: session.gameId, player, ...attempt });
        queue.current.shift();
        if (mounted.current) setPending(queue.current.length);
      }
    } catch {
      // Keep the same attempt ID on retry so an uncertain write cannot count twice.
      blocked.current = true;
      if (mounted.current) setSaveError("기록을 저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      saving.current = false;
    }
  }, [player, roomId, session.gameId, session.roundId]);

  /** `elapsedMs` is how long the current wave has been in the air. */
  const slice = useCallback((optionId: string, elapsedMs: number) => {
    if (!initialized.current || expired || blocked.current || remote.error || queue.current.length >= MAX_PENDING) return null;
    const previousProgress = current.current;
    const question = ninjaQuestionAt(questions, previousProgress.currentIndex);
    const next = sliceFruit(previousProgress, question, optionId, { elapsedMs, golden: isGoldenWave(session.roundId, previousProgress.currentIndex) });
    current.current = next.progress;
    setProgress(next.progress);
    queue.current.push({ attemptId: crypto.randomUUID(), item: question, answer: { optionId },
      result: next.result, previousProgress, progress: next.progress });
    setPending(queue.current.length);
    void flush();
    return next.result;
  }, [expired, flush, questions, remote.error, session.roundId]);

  return { progress, ready, pending, error: saveError ?? remote.error?.message ?? null,
    blocked: !ready || Boolean(saveError || remote.error) || pending >= MAX_PENDING || expired, slice, retry: flush };
}
