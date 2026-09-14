export interface DeadlineCountdownSnapshot {
  readonly durationMs: number;
  readonly remainingMs: number;
  readonly progress: number;
  readonly expired: boolean;
}

export function deadlineCountdownSnapshot(deadlineAtMs: number, durationMs: number, nowMs = Date.now()): DeadlineCountdownSnapshot {
  const safeDuration = Math.max(1, durationMs);
  const remainingMs = Math.min(safeDuration, Math.max(0, deadlineAtMs - nowMs));
  return {
    durationMs: safeDuration,
    remainingMs,
    progress: Math.max(0, Math.min(1, remainingMs / safeDuration)),
    expired: remainingMs === 0,
  };
}
