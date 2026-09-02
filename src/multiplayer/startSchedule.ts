export function millisecondsUntilRoundStart(startedAtMs: number | null, nowMs: number): number {
  if (startedAtMs === null || !Number.isFinite(startedAtMs)) return 0;
  return Math.max(0, startedAtMs - nowMs);
}

export function roundStartCountdownValue(remainingMs: number): number {
  return Math.max(1, Math.ceil(Math.max(0, remainingMs) / 1_000));
}
