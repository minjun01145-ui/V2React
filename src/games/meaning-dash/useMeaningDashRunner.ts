import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAnswerResult } from "../../game-engine/core/answerResult.ts";
import { movementAction } from "../../game-engine/input/movementKeys.ts";
import { applyResultToProgress, createEmptyProgress, normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { LiveMovementState } from "../../live-world/core/types.ts";
import { usePlayerGameProgress } from "../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt } from "../../multiplayer/game-progress/repository.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import {
  MEANING_DASH_LANE_SPEED,
  MEANING_DASH_RUN_SPEED,
  MEANING_DASH_SLOW_SPEED,
  MEANING_DASH_WRONG_SLOW_MS,
  meaningDashGateIndexAtY,
  meaningDashGateY,
  meaningDashLaneX,
  meaningDashQuestionForGate,
  nearestMeaningDashLane,
  meaningDashReward,
  meaningDashSpeed,
  type DashImpact,
  type MeaningDashCourse,
} from "./model.ts";

interface DashDetails {
  readonly gateIndex: number;
  readonly selectedLane: number;
  readonly correctLane: number;
}

export interface MeaningDashRunnerState extends LiveMovementState {
  readonly lane: 0 | 1 | 2;
}

const INITIAL_RUNNER: MeaningDashRunnerState = { x: 0, y: 0, vx: 0, vy: MEANING_DASH_RUN_SPEED, lane: 1 };
const PERSIST_RETRY_DELAYS_MS = [250, 750, 1_500, 3_000, 5_000] as const;
const RETRYABLE_PERSISTENCE_CODES = new Set([
  "aborted",
  "cancelled",
  "deadline-exceeded",
  "internal",
  "resource-exhausted",
  "unavailable",
  "unknown",
]);

function approach(current: number, target: number, maximumDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maximumDelta) return target;
  return current + Math.sign(delta) * maximumDelta;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function persistenceErrorCode(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("code" in value)) return null;
  const code = (value as { readonly code?: unknown }).code;
  if (typeof code !== "string") return null;
  const slash = code.lastIndexOf("/");
  return slash >= 0 ? code.slice(slash + 1) : code;
}

function isRetryablePersistenceError(value: unknown): boolean {
  const code = persistenceErrorCode(value);
  return code !== null && RETRYABLE_PERSISTENCE_CODES.has(code);
}

export function useMeaningDashRunner(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly course: MeaningDashCourse;
  readonly publish: (state: LiveMovementState) => void;
}) {
  const { roomId, session, player, course, publish } = input;
  const remoteProgress = usePlayerGameProgress(roomId, session.roundId, player.id);
  const [runner, setRunner] = useState<MeaningDashRunnerState>(INITIAL_RUNNER);
  const [progress, setProgress] = useState<GameProgress<DashDetails>>(() => createEmptyProgress());
  const [feedback, setFeedback] = useState("");
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [impact, setImpact] = useState<DashImpact | null>(null);
  const startAtRef = useRef<number | null>(null);
  const runnerRef = useRef<MeaningDashRunnerState>(INITIAL_RUNNER);
  const progressRef = useRef<GameProgress<DashDetails>>(createEmptyProgress());
  const targetLaneRef = useRef<0 | 1 | 2>(1);
  const slowUntilRef = useRef(0);
  const initializedRoundRef = useRef<string | null>(null);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const feedbackTimerRef = useRef<number | null>(null);
  const saveBlockedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    // StrictMode replays effects; do not reset a round that was already hydrated.
    if (initializedRoundRef.current === session.roundId) return;
    const emptyProgress = createEmptyProgress<DashDetails>();
    targetLaneRef.current = 1;
    slowUntilRef.current = 0;
    saveBlockedRef.current = false;
    runnerRef.current = INITIAL_RUNNER;
    progressRef.current = emptyProgress;
    setRunner(INITIAL_RUNNER);
    setProgress(emptyProgress);
    setFeedback("");
    setSaveError(null);
    setReady(false);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, [session.roundId]);

  useEffect(() => {
    if (remoteProgress.loading || remoteProgress.error || initializedRoundRef.current === session.roundId) return;
    const hydrated = normalizeProgress<DashDetails>(remoteProgress.value, Number.MAX_SAFE_INTEGER);
    const y = hydrated.currentIndex > 0 ? meaningDashGateY(hydrated.currentIndex - 1) + 0.15 : 0;
    const nextRunner = { ...INITIAL_RUNNER, y };
    progressRef.current = hydrated;
    runnerRef.current = nextRunner;
    setProgress(hydrated);
    setRunner(nextRunner);
    initializedRoundRef.current = session.roundId;
    setReady(true);
  }, [remoteProgress.loading, remoteProgress.error, remoteProgress.value, session.roundId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const recordGate = useCallback((gateIndex: number, selectedLane: 0 | 1 | 2): void => {
    const question = meaningDashQuestionForGate(course, gateIndex);
    const correct = selectedLane === question.correctLane;
    const previous = progressRef.current;
    const reward = meaningDashReward(correct, previous.combo);
    const gateItemId = `meaning-dash-gate-${gateIndex}`;
    const details: DashDetails = { gateIndex, selectedLane, correctLane: question.correctLane };
    const result = createAnswerResult({
      isCorrect: correct,
      scoreDelta: reward.points,
      feedback: correct ? "정답!" : `정답: ${question.choices[question.correctLane]}`,
      details,
    });
    const applied = applyResultToProgress(previous, gateItemId, result);
    const nextProgress: GameProgress<DashDetails> = {
      ...applied,
      currentIndex: gateIndex + 1,
      combo: reward.combo,
    };
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    setImpact({ gateIndex, correct, lane: selectedLane, prompt: question.prompt,
      answer: question.choices[question.correctLane], combo: reward.combo, points: reward.points });
    setFeedback(result.feedback ?? "");
    if (!correct) slowUntilRef.current = Date.now() + MEANING_DASH_WRONG_SLOW_MS;
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(""), 1_800);

    const submission = {
      roomId,
      roundId: session.roundId,
      gameId: session.gameId,
      player,
      attemptId: `meaning-dash-${gateIndex}`,
      item: { id: gateItemId, prompt: question.prompt },
      answer: details,
      result,
      previousProgress: previous,
      progress: nextProgress,
    };
    persistQueueRef.current = persistQueueRef.current.then(async () => {
      if (saveBlockedRef.current) return;
      let retryAttempt = 0;
      while (mountedRef.current) {
        try {
          await persistGameAttempt(submission);
          saveBlockedRef.current = false;
          if (mountedRef.current) setSaveError(null);
          return;
        } catch (reason: unknown) {
          saveBlockedRef.current = true;
          if (!isRetryablePersistenceError(reason)) {
            if (mountedRef.current) {
              setSaveError(reason instanceof Error ? reason : new Error("게임 결과를 저장하지 못했습니다."));
            }
            return;
          }
          if (mountedRef.current) {
            setSaveError(new Error("네트워크 연결을 복구하는 동안 게임을 잠시 멈췄습니다."));
          }
          const retryDelay = PERSIST_RETRY_DELAYS_MS[
            Math.min(retryAttempt, PERSIST_RETRY_DELAYS_MS.length - 1)
          ] ?? 5_000;
          retryAttempt += 1;
          await wait(retryDelay);
        }
      }
    });
  }, [course, player, roomId, session.gameId, session.roundId]);

  useEffect(() => {
    if (!ready || initializedRoundRef.current !== session.roundId) return undefined;
    let animationFrame = 0;
    let lastAt = performance.now();
    const tick = (now: number): void => {
      const elapsedSeconds = Math.min(Math.max((now - lastAt) / 1_000, 0), 0.05);
      lastAt = now;
      if (startAtRef.current === null || document.hidden) {
        animationFrame = requestAnimationFrame(tick);
        return;
      }
      const remaining = Math.ceil((startAtRef.current - now) / 1000);
      setCountdown(remaining > 0 ? remaining : 0);
      if (remaining > 0) {
        animationFrame = requestAnimationFrame(tick);
        return;
      }
      const current = runnerRef.current;
      const targetX = meaningDashLaneX(targetLaneRef.current);
      const nextX = approach(current.x, targetX, MEANING_DASH_LANE_SPEED * elapsedSeconds);
      const speed = saveBlockedRef.current
        ? 0
        : Date.now() < slowUntilRef.current ? MEANING_DASH_SLOW_SPEED : meaningDashSpeed(progressRef.current.combo);
      const nextY = current.y + speed * elapsedSeconds;
      const next: MeaningDashRunnerState = {
        x: nextX,
        y: nextY,
        vx: elapsedSeconds > 0 ? (nextX - current.x) / elapsedSeconds : 0,
        vy: speed,
        lane: targetLaneRef.current,
      };

      const previousGate = meaningDashGateIndexAtY(current.y);
      const currentGate = meaningDashGateIndexAtY(nextY);
      if (currentGate > previousGate) {
        for (let gateIndex = previousGate + 1; gateIndex <= currentGate; gateIndex += 1) {
          if (gateIndex >= progressRef.current.currentIndex) recordGate(gateIndex, nearestMeaningDashLane(nextX));
        }
      }

      runnerRef.current = next;
      setRunner(next);
      publish(next);
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [publish, ready, recordGate]);

  const selectLane = useCallback((lane: 0 | 1 | 2): void => {
    targetLaneRef.current = lane;
    setRunner((current) => ({ ...current, lane }));
  }, []);

  const moveLane = useCallback((direction: -1 | 1): void => {
    const next = Math.max(0, Math.min(2, targetLaneRef.current + direction)) as 0 | 1 | 2;
    targetLaneRef.current = next;
    setRunner((current) => ({ ...current, lane: next }));
  }, []);

  const readyForRound = ready && initializedRoundRef.current === session.roundId;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.repeat) return;
      if (["Digit1", "Digit2", "Digit3"].includes(event.code)) {
        event.preventDefault();
        selectLane((Number(event.code.slice(-1)) - 1) as 0 | 1 | 2);
        return;
      }
      const action = movementAction(event.code, event.key);
      if (action === "left") {
        event.preventDefault();
        moveLane(-1);
      } else if (action === "right") {
        event.preventDefault();
        moveLane(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveLane, selectLane]);

  const nextQuestion = useMemo(
    () => meaningDashQuestionForGate(course, Math.max(progress.currentIndex, 0)),
    [course, progress.currentIndex],
  );

  return {
    runner,
    progress,
    feedback,
    saveError: saveError ?? remoteProgress.error,
    ready: readyForRound,
    nextQuestion,
    impact,
    started,
    countdown,
    selectLane,
    start: () => {
      if (startAtRef.current !== null) return;
      startAtRef.current = performance.now() + 3000;
      setCountdown(3);
      setStarted(true);
    },
    moveLeft: () => moveLane(-1),
    moveRight: () => moveLane(1),
  };
}
