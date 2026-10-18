/** Tokens one AI generation used, as reported by the server; null where the provider gave no count. */
export interface AiUsage {
  readonly promptTokens: number | null;
  readonly outputTokens: number | null;
}

export function parseAiUsage(value: unknown): AiUsage | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const tokens = (count: unknown): number | null => typeof count === "number" && Number.isFinite(count) && count >= 0 ? Math.trunc(count) : null;
  return { promptTokens: tokens(raw.promptTokens), outputTokens: tokens(raw.outputTokens) };
}

export function aiUsageLabel(usage: AiUsage): string {
  const format = (count: number | null): string => count === null ? "-" : count.toLocaleString("ko-KR");
  return `AI 토큰 입력 ${format(usage.promptTokens)} · 출력 ${format(usage.outputTokens)}`;
}
