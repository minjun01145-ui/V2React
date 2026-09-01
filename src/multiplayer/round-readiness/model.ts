export interface RoundReadiness {
  readonly playerId: string;
  readonly readyAtMs: number;
}

export function parseRoundReadiness(id: string, value: unknown): RoundReadiness | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.playerId !== id || typeof data.readyAtMs !== "number" || !Number.isFinite(data.readyAtMs)) return null;
  return { playerId: id, readyAtMs: data.readyAtMs };
}

export function countExpectedReady(expectedPlayerIds: readonly string[], readiness: readonly RoundReadiness[]): number {
  const readyIds = new Set(readiness.map((item) => item.playerId));
  return new Set(expectedPlayerIds).size === 0
    ? 0
    : [...new Set(expectedPlayerIds)].filter((id) => readyIds.has(id)).length;
}
