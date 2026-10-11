export const MAX_TIMER_SECONDS = 99 * 60 + 59;

export function adjustTimerSeconds(seconds: number, delta: number): number {
  return Math.max(0, Math.min(MAX_TIMER_SECONDS, seconds + delta));
}

export function countdownSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1_000));
}

export function formatTimerSeconds(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export interface TimerSnapshot {
  readonly durationSeconds: number;
  readonly remainingSeconds: number;
  readonly running: boolean;
  readonly finished: boolean;
}

/** Only the teacher's manually started timer is stored here, never an engine deadline. */
export interface SlideTimerState {
  readonly durationSeconds: number;
  /** Seconds available at the most recent start (or while paused). */
  readonly remainingSeconds: number;
  readonly startedAtMs: number | null;
}

export function slideTimerSnapshot(timer: SlideTimerState | null, nowMs: number): TimerSnapshot {
  const durationSeconds = timer?.durationSeconds ?? 180;
  const remainingSeconds = !timer ? durationSeconds : timer.startedAtMs === null ? timer.remainingSeconds
    : Math.min(timer.remainingSeconds, countdownSeconds(timer.startedAtMs + timer.remainingSeconds * 1_000, nowMs));
  return { durationSeconds, remainingSeconds, running: timer?.startedAtMs != null && remainingSeconds > 0, finished: remainingSeconds === 0 && durationSeconds > 0 };
}

/** Firestore boundary: accept only a bounded timer and a resolved server timestamp. */
export function parseSlideTimer(value: unknown): SlideTimerState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { durationSeconds, remainingSeconds, startedAt } = value as Record<string, unknown>;
  if (typeof durationSeconds !== "number" || !Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > MAX_TIMER_SECONDS
    || typeof remainingSeconds !== "number" || !Number.isInteger(remainingSeconds) || remainingSeconds < 0 || remainingSeconds > durationSeconds) return null;
  if (startedAt === null) return { durationSeconds, remainingSeconds, startedAtMs: null };
  if (typeof startedAt !== "object" || startedAt === null || !("toMillis" in startedAt) || typeof startedAt.toMillis !== "function") return null;
  try {
    const startedAtMs: unknown = startedAt.toMillis();
    return typeof startedAtMs === "number" && Number.isFinite(startedAtMs) && startedAtMs >= 0 ? { durationSeconds, remainingSeconds, startedAtMs } : null;
  } catch {
    return null;
  }
}
