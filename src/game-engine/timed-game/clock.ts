import type { TimedGameConfig } from "./config.ts";

export interface TimedGameClockSnapshot {
  readonly durationMs: number | null;
  readonly elapsedMs: number;
  readonly remainingMs: number | null;
  readonly progress: number | null;
  readonly expired: boolean;
}

export function timedGameClockSnapshot(
  config: TimedGameConfig,
  startedAtMs: number | null,
  nowMs: number,
): TimedGameClockSnapshot {
  const elapsedMs = startedAtMs === null ? 0 : Math.max(0, nowMs - startedAtMs);
  if (config.durationMs === null) {
    return { durationMs: null, elapsedMs, remainingMs: null, progress: null, expired: false };
  }
  const remainingMs = Math.max(0, config.durationMs - elapsedMs);
  return {
    durationMs: config.durationMs,
    elapsedMs,
    remainingMs,
    progress: Math.min(1, elapsedMs / config.durationMs),
    expired: remainingMs <= 0,
  };
}

export function formatClock(milliseconds: number | null): string {
  if (milliseconds === null) return "∞";
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
