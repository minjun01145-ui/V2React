import { useEffect, useState } from "react";
import { adjustTimerSeconds, countdownSeconds } from "./model.ts";

export interface CountdownTimer {
  readonly remainingSeconds: number;
  readonly running: boolean;
  readonly finished: boolean;
  readonly adjust: (delta: number) => void;
  readonly start: () => void;
  readonly pause: () => void;
  readonly reset: () => void;
}

/** Keep the deadline while panels change; background throttling must not slow the timer. */
export function useCountdownTimer(): CountdownTimer {
  const [durationSeconds, setDurationSeconds] = useState(180);
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  useEffect(() => {
    if (deadlineMs === null) return;
    const update = (): void => {
      const seconds = countdownSeconds(deadlineMs, Date.now());
      setRemainingSeconds(seconds);
      if (seconds === 0) setDeadlineMs(null);
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [deadlineMs]);

  return {
    remainingSeconds,
    running: deadlineMs !== null,
    finished: remainingSeconds === 0 && durationSeconds > 0,
    adjust: (delta) => {
      if (deadlineMs !== null) return;
      const seconds = adjustTimerSeconds(remainingSeconds, delta);
      setDurationSeconds(seconds);
      setRemainingSeconds(seconds);
    },
    start: () => {
      if (deadlineMs !== null || remainingSeconds === 0) return;
      setDeadlineMs(Date.now() + remainingSeconds * 1_000);
    },
    pause: () => {
      if (deadlineMs === null) return;
      setRemainingSeconds(countdownSeconds(deadlineMs, Date.now()));
      setDeadlineMs(null);
    },
    reset: () => {
      setDeadlineMs(null);
      setRemainingSeconds(durationSeconds);
    },
  };
}
