export interface LobbyGathering {
  readonly runId: string;
  readonly active: boolean;
}

export function parseLobbyGathering(value: unknown): LobbyGathering | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.runId !== "string" || !data.runId.trim() || data.runId.length > 128 || typeof data.active !== "boolean") return null;
  return { runId: data.runId, active: data.active };
}
