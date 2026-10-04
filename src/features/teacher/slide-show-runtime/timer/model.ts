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
